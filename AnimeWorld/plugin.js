(function () {
  // ============================================================
  // AnimeWorld - Italian Anime (Sub & Dub)
  // Ported from CloudStream Kotlin plugin by doGior
  // ============================================================

  const TAG = "AnimeWorld";

  const mainCategories = {
    "Trending": "/filter?sort=6&language[]=1",
    "Ultimi Aggiunti": "/filter?sort=2&language[]=1",
    "Più Visti": "/filter?sort=3&language[]=1",
    "Più Votati": "/filter?sort=4&language[]=1",
    "In Corso": "/filter?status=0&sort=6&language[]=1",
  };

  function fixUrl(url) {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    if (url.startsWith("//")) return "https:" + url;
    return manifest.baseUrl + url;
  }

  async function getHome(cb) {
    try {
      const data = {};
      for (const [name, path] of Object.entries(mainCategories)) {
        try {
          const resp = await fetch(`${manifest.baseUrl}${path}`);
          const html = await resp.text();
          const items = await nativeExtract(html, {
            anime: {
              query: ".film-list .item",
              multiple: true,
              fields: {
                title: { query: "a.name", attr: "textContent" },
                href: { query: "a.name", attr: "href" },
                poster: { query: "img", attr: "src" },
              },
            },
          });
          data[name] = (items.anime || [])
            .filter((a) => a.title && a.href)
            .map((a) => new MultimediaItem({
              title: a.title.trim(),
              url: fixUrl(a.href),
              posterUrl: fixUrl(a.poster),
              type: "anime",
            }));
        } catch (e) {
          console.error(TAG, `Category ${name} failed:`, e);
        }
      }
      cb({ success: true, data });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function search(query, cb) {
    try {
      const resp = await fetch(`${manifest.baseUrl}/search?keyword=${encodeURIComponent(query)}`);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        anime: {
          query: ".film-list .item",
          multiple: true,
          fields: {
            title: { query: "a.name", attr: "textContent" },
            href: { query: "a.name", attr: "href" },
            poster: { query: "img", attr: "src" },
          },
        },
      });
      const results = (items.anime || [])
        .filter((a) => a.title && a.href)
        .map((a) => new MultimediaItem({
          title: a.title.trim(),
          url: fixUrl(a.href),
          posterUrl: fixUrl(a.poster),
          type: "anime",
        }));
      cb({ success: true, data: results });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const details = await nativeExtract(html, {
        title: { query: "h1.title", attr: "textContent", first: true },
        altTitle: { query: "h2.title", attr: "textContent", first: true },
        poster: { query: ".thumb img", attr: "src", first: true },
        plot: { query: ".desc .long", attr: "textContent", first: true },
        plotShort: { query: ".desc", attr: "textContent", first: true },
        genres: { query: ".info .genre a", multiple: true, attr: "textContent" },
        status: { query: ".info .status a", attr: "textContent", first: true },
        year: { query: ".info .year a", attr: "textContent", first: true },
        episodes: {
          query: ".server[data-name=9] .episode a, .server .episode a",
          multiple: true,
          fields: {
            name: { attr: "textContent" },
            href: { attr: "href" },
            epNum: { attr: "data-episode-num" },
          },
        },
      });

      const item = new MultimediaItem({
        title: (details.title || "").trim(),
        url: url,
        posterUrl: fixUrl(details.poster),
        type: "anime",
        year: details.year ? parseInt(details.year) : undefined,
        description: (details.plot || details.plotShort || "").trim(),
        status: details.status?.includes("In Corso") ? "ongoing" : details.status?.includes("Finito") ? "completed" : undefined,
      });

      item.episodes = (details.episodes || []).map((ep, i) => new Episode({
        name: ep.name?.trim() || `Episodio ${i + 1}`,
        url: fixUrl(ep.href),
        season: 1,
        episode: ep.epNum ? parseInt(ep.epNum) : i + 1,
      }));

      cb({ success: true, data: item });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function loadStreams(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const streams = [];

      // Extract video sources from each server
      const serverData = await nativeExtract(html, {
        servers: { query: "#servers a[data-id]", multiple: true, attr: "data-id" },
        directSource: { query: "video source", attr: "src", first: true },
        iframeSrc: { query: "#player iframe", attr: "src", first: true },
      });

      // Direct source
      if (serverData.directSource) {
        streams.push(new StreamResult({ url: fixUrl(serverData.directSource), quality: "Direct" }));
      }

      // Iframe source
      if (serverData.iframeSrc) {
        try {
          const iResp = await fetch(fixUrl(serverData.iframeSrc));
          const iHtml = await iResp.text();
          const srcMatch = iHtml.match(/file\s*:\s*['"]([^'"]+)['"]/) ||
            iHtml.match(/src\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
          if (srcMatch) {
            streams.push(new StreamResult({ url: srcMatch[1], quality: "Auto" }));
          }
        } catch (e) {}
      }

      // Alternative: grab download links as fallback
      const dlData = await nativeExtract(html, {
        downloads: { query: "#download a[href]", multiple: true, attr: "href" },
      });
      for (const dl of dlData.downloads || []) {
        if (dl.includes(".mp4") || dl.includes(".m3u8")) {
          streams.push(new StreamResult({ url: dl, quality: "Download" }));
        }
      }

      cb({ success: true, data: streams });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
