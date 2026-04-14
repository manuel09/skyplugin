(function () {
  // Arte - Documentaries and cultural content from Arte.tv
  const TAG = "Arte";
  const apiUrl = "https://api.arte.tv/api/player/v2";

  async function getHome(cb) {
    try {
      const categories = { "Trending": "most-viewed", "Recenti": "most-recent" };
      const data = {};
      for (const [name, sort] of Object.entries(categories)) {
        try {
          const resp = await fetch(`https://www.arte.tv/api/rproxy/emac/v4/it/web/pages/HOME/`);
          const json = JSON.parse(await resp.text());
          const zones = json.value?.zones || [];
          const items = [];
          zones.forEach((zone) => {
            (zone.content?.data || []).forEach((item) => {
              if (!item.title || !item.url) return;
              items.push(new MultimediaItem({
                title: item.title, url: item.url || `https://www.arte.tv${item.url}`,
                posterUrl: item.mainImage?.url, type: item.type === "SERIES" ? "series" : "movie",
                duration: item.duration ? Math.floor(item.duration / 60) : undefined,
              }));
            });
          });
          if (items.length > 0) data[name] = items.slice(0, 30);
        } catch (e) {}
      }
      cb({ success: true, data });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const resp = await fetch(`https://www.arte.tv/api/rproxy/emac/v4/it/web/pages/SEARCH/?query=${encodeURIComponent(query)}`);
      const json = JSON.parse(await resp.text());
      const results = [];
      (json.value?.zones || []).forEach((zone) => {
        (zone.content?.data || []).forEach((item) => {
          if (!item.title) return;
          results.push(new MultimediaItem({
            title: item.title, url: item.url || `https://www.arte.tv${item.url}`,
            posterUrl: item.mainImage?.url, type: item.type === "SERIES" ? "series" : "movie",
          }));
        });
      });
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
      let title = "", description = "", poster = "";
      if (jsonLdMatch) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
          title = ld.name || ""; description = ld.description || ""; poster = ld.thumbnailUrl || ld.image || "";
        } catch (e) {}
      }
      if (!title) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        title = titleMatch ? titleMatch[1].split("|")[0].trim() : "Arte";
      }
      const item = new MultimediaItem({ title, url, posterUrl: poster, type: "movie", description });
      cb({ success: true, data: item });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const streams = [];
      // Look for Arte player config
      const configMatch = html.match(/data-config="([^"]+)"/) || html.match(/"config"\s*:\s*"([^"]+)"/);
      if (configMatch) {
        try {
          const configUrl = configMatch[1].replace(/&amp;/g, "&");
          const cResp = await fetch(configUrl);
          const config = JSON.parse(await cResp.text());
          const videoStreams = config.data?.attributes?.streams || [];
          videoStreams.forEach((s) => {
            if (s.url) streams.push(new StreamResult({ url: s.url, quality: s.mainQuality?.label || "Auto" }));
          });
        } catch (e) {}
      }
      // Fallback: look for m3u8 in page
      const m3u8Match = html.match(/['"]([^'"]+\.m3u8[^'"]*)['"]/);
      if (m3u8Match && streams.length === 0) {
        streams.push(new StreamResult({ url: m3u8Match[1], quality: "Auto" }));
      }
      cb({ success: true, data: streams });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
