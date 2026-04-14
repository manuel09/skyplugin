(function () {
  // YouTube - Video search and playback via Invidious API
  const TAG = "YouTube";
  const invidiousInstances = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://iv.ggtyler.dev",
  ];
  let activeInstance = invidiousInstances[0];

  async function tryFetch(path) {
    for (const instance of invidiousInstances) {
      try {
        const resp = await fetch(`${instance}${path}`);
        if (resp.status === 200) {
          activeInstance = instance;
          return await resp.text();
        }
      } catch (e) {}
    }
    throw new Error("All Invidious instances failed");
  }

  async function getHome(cb) {
    try {
      const categories = {
        "Trending": "/api/v1/trending?region=IT",
        "Popolari": "/api/v1/popular",
        "Musica": "/api/v1/trending?type=Music&region=IT",
        "Gaming": "/api/v1/trending?type=Gaming&region=IT",
        "Film": "/api/v1/trending?type=Movies&region=IT",
      };

      const data = {};
      for (const [name, path] of Object.entries(categories)) {
        try {
          const text = await tryFetch(path);
          const json = JSON.parse(text);
          const items = (Array.isArray(json) ? json : []).map((v) => new MultimediaItem({
            title: v.title,
            url: JSON.stringify({ videoId: v.videoId }),
            posterUrl: v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
            type: "movie",
            duration: v.lengthSeconds ? Math.floor(v.lengthSeconds / 60) : undefined,
          })).filter((i) => i.title);
          if (items.length > 0) data[name] = items;
        } catch (e) {}
      }
      cb({ success: true, data });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const text = await tryFetch(`/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      const json = JSON.parse(text);
      const results = (Array.isArray(json) ? json : [])
        .filter((v) => v.type === "video")
        .map((v) => new MultimediaItem({
          title: v.title,
          url: JSON.stringify({ videoId: v.videoId }),
          posterUrl: v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          type: "movie",
          duration: v.lengthSeconds ? Math.floor(v.lengthSeconds / 60) : undefined,
        }));
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const loadData = JSON.parse(url);
      const text = await tryFetch(`/api/v1/videos/${loadData.videoId}`);
      const video = JSON.parse(text);

      const item = new MultimediaItem({
        title: video.title,
        url: url,
        posterUrl: video.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${loadData.videoId}/maxresdefault.jpg`,
        type: "movie",
        description: video.description || video.descriptionHtml || "",
        duration: video.lengthSeconds ? Math.floor(video.lengthSeconds / 60) : undefined,
        year: video.published ? new Date(video.published * 1000).getFullYear() : undefined,
        cast: video.author ? [new Actor({ name: video.author })] : [],
      });

      // For channels/playlists - add related videos as recommendations
      if (video.recommendedVideos) {
        item.recommendations = video.recommendedVideos.map((r) => new MultimediaItem({
          title: r.title,
          url: JSON.stringify({ videoId: r.videoId }),
          posterUrl: r.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
          type: "movie",
        }));
      }

      cb({ success: true, data: item });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const loadData = JSON.parse(url);
      const text = await tryFetch(`/api/v1/videos/${loadData.videoId}`);
      const video = JSON.parse(text);
      const streams = [];

      // Adaptive streams (best quality)
      if (video.adaptiveFormats) {
        const videoFormats = video.adaptiveFormats
          .filter((f) => f.type?.startsWith("video/") && f.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        for (const fmt of videoFormats.slice(0, 3)) {
          streams.push(new StreamResult({
            url: fmt.url,
            quality: `${fmt.qualityLabel || fmt.quality || "Auto"} (${fmt.container || "mp4"})`,
          }));
        }
      }

      // Progressive streams (audio+video combined)
      if (video.formatStreams) {
        for (const fmt of video.formatStreams) {
          if (fmt.url) {
            streams.push(new StreamResult({
              url: fmt.url,
              quality: `${fmt.qualityLabel || fmt.quality || "Auto"} (combined)`,
            }));
          }
        }
      }

      // HLS fallback
      if (video.hlsUrl) {
        streams.push(new StreamResult({ url: video.hlsUrl, quality: "HLS Auto" }));
      }

      // DASH fallback
      if (video.dashUrl) {
        streams.push(new StreamResult({ url: video.dashUrl, quality: "DASH Auto" }));
      }

      cb({ success: true, data: streams });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
