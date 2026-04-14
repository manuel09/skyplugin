(function () {
  // Nebula - Free content from Nebula streaming
  const TAG = "Nebula";
  const apiUrl = "https://content.api.nebula.app";

  const homeCategories = {
    "Trending": "/video_episodes/?category=news",
    "Animation": "/video_episodes/?category=animation",
    "Culture": "/video_episodes/?category=culture",
    "Engineering": "/video_episodes/?category=engineering",
    "History": "/video_episodes/?category=history",
    "Science": "/video_episodes/?category=science",
    "New Channels": "/video_channels/?ordering=-published_at",
    "Recent Uploads": "/video_channels/?ordering=-episode_published",
  };

  async function getHome(cb) {
    try {
      const data = {};
      for (const [name, path] of Object.entries(homeCategories)) {
        try {
          const resp = await fetch(`${apiUrl}${path}&offset=0`);
          const json = JSON.parse(await resp.text());
          const items = (json.results || []).map((item) => {
            const isVideo = !!item.share_url && item.share_url.includes("/videos/");
            if (!isVideo && !item.share_url) return null;
            const hasFree = item.attributes ? item.attributes.includes("free_sample_eligible") : true;
            if (item.attributes && !hasFree) return null;
            return new MultimediaItem({
              title: item.title,
              url: item.share_url || item.url,
              posterUrl: item.images?.thumbnail?.src || item.images?.avatar?.src,
              type: isVideo ? "movie" : "series",
              duration: item.duration ? Math.floor(item.duration / 60) : undefined,
            });
          }).filter(Boolean);
          if (items.length > 0) data[name] = items;
        } catch (e) { console.error(TAG, `${name} failed:`, e); }
      }
      cb({ success: true, data });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const urls = [
        `${apiUrl}/video_channels/search/?q=${encodeURIComponent(query)}`,
        `${apiUrl}/video_episodes/search/?q=${encodeURIComponent(query)}`,
      ];
      const results = [];
      for (const url of urls) {
        try {
          const resp = await fetch(url);
          const json = JSON.parse(await resp.text());
          (json.results || []).forEach((item) => {
            const isVideo = url.includes("episodes");
            if (item.attributes && !item.attributes.includes("free_sample_eligible")) return;
            results.push(new MultimediaItem({
              title: item.title,
              url: item.share_url || item.url,
              posterUrl: item.images?.thumbnail?.src || item.images?.avatar?.src,
              type: isVideo ? "movie" : "series",
            }));
          });
        } catch (e) {}
      }
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const isVideo = url.includes("/videos/");
      const apiPath = isVideo
        ? apiUrl + "/content" + url.replace("https://nebula.tv", "")
        : apiUrl + "/video_channels" + url.replace("https://nebula.tv", "");
      const resp = await fetch(apiPath);
      const item = JSON.parse(await resp.text());

      const result = new MultimediaItem({
        title: item.title,
        url: isVideo
          ? `${apiUrl}/video_episodes/${item.id}/manifest.m3u8?app_version=25.10.1&platform=web&compatibility=true&all_manifest=false`
          : url,
        posterUrl: item.images?.thumbnail?.src || item.images?.avatar?.src,
        bannerUrl: item.images?.banner?.src,
        type: isVideo ? "movie" : "series",
        description: item.description || item.short_description || "",
        duration: item.duration ? Math.floor(item.duration / 60) : undefined,
        year: item.published_at ? parseInt(item.published_at.split("-")[0]) : undefined,
      });

      if (!isVideo) {
        // Load channel episodes
        try {
          const epResp = await fetch(
            `${apiUrl}/video_channels/${item.id}/video_episodes/?ordering=-published_at&page_size=100`
          );
          const epJson = JSON.parse(await epResp.text());
          result.episodes = (epJson.results || [])
            .filter((v) => !v.attributes || v.attributes.includes("free_sample_eligible"))
            .map((v, i) => new Episode({
              name: v.title,
              url: `${apiUrl}/video_episodes/${v.id}/manifest.m3u8?app_version=25.10.1&platform=web&compatibility=true&all_manifest=false`,
              season: 1,
              episode: i + 1,
              runtime: v.duration ? Math.floor(v.duration / 60) : undefined,
              airDate: v.published_at?.split("T")[0],
            }));
        } catch (e) {}
      }

      cb({ success: true, data: result });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const tokenResp = await fetch("https://users.api.nebula.app/api/v1/authorization/", { method: "POST" });
      const tokenJson = JSON.parse(await tokenResp.text());
      const token = tokenJson.token;
      const streamUrl = `${url}&token=${token}`;
      cb({ success: true, data: [new StreamResult({ url: streamUrl, quality: "Auto" })] });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
