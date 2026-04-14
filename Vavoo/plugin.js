(function () {
  // Vavoo - Movies, Series and Live TV
  const TAG = "Vavoo";
  const apiBase = "https://vavoo.to/api";

  async function getHome(cb) {
    try {
      const categories = [
        { name: "Trending", path: "/list/movie/trending" },
        { name: "Film Popolari", path: "/list/movie/popular" },
        { name: "Serie TV", path: "/list/series/trending" },
        { name: "Live TV", path: "/list/live" },
      ];
      const data = {};
      for (const cat of categories) {
        try {
          const resp = await fetch(`${manifest.baseUrl}${cat.path}`);
          const json = JSON.parse(await resp.text());
          const items = (json.items || json || []).map((item) => new MultimediaItem({
            title: item.name || item.title, url: JSON.stringify({ id: item.id, type: item.type || "movie" }),
            posterUrl: item.poster || item.image || item.thumbnail,
            type: item.type === "series" ? "series" : item.type === "live" ? "livestream" : "movie",
          })).filter((i) => i.title);
          if (items.length > 0) data[cat.name] = items;
        } catch (e) {}
      }
      cb({ success: true, data });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const resp = await fetch(`${manifest.baseUrl}/search?q=${encodeURIComponent(query)}`);
      const json = JSON.parse(await resp.text());
      const results = (json.items || json || []).map((item) => new MultimediaItem({
        title: item.name || item.title,
        url: JSON.stringify({ id: item.id, type: item.type || "movie" }),
        posterUrl: item.poster || item.image,
        type: item.type === "series" ? "series" : item.type === "live" ? "livestream" : "movie",
      })).filter((i) => i.title);
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const loadData = JSON.parse(url);
      const resp = await fetch(`${manifest.baseUrl}/detail/${loadData.type}/${loadData.id}`);
      const json = JSON.parse(await resp.text());
      const item = new MultimediaItem({
        title: json.name || json.title, url: url, posterUrl: json.poster || json.image,
        type: loadData.type === "series" ? "series" : loadData.type === "live" ? "livestream" : "movie",
        description: json.description || json.plot || "",
        year: json.year ? parseInt(json.year) : undefined,
      });
      if (json.seasons || json.episodes) {
        item.episodes = [];
        const seasons = json.seasons || [{ episodes: json.episodes, number: 1 }];
        for (const season of seasons) {
          for (const ep of season.episodes || []) {
            item.episodes.push(new Episode({
              name: ep.name || ep.title || `E${ep.number || ep.episode}`,
              url: JSON.stringify({ id: ep.id || loadData.id, type: "episode", seasonNum: season.number, epNum: ep.number }),
              season: season.number || 1, episode: ep.number || ep.episode || 1,
            }));
          }
        }
      }
      cb({ success: true, data: item });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const loadData = JSON.parse(url);
      const resp = await fetch(`${manifest.baseUrl}/play/${loadData.id}`);
      const json = JSON.parse(await resp.text());
      const streams = [];
      if (json.url) streams.push(new StreamResult({ url: json.url, quality: "Auto" }));
      if (json.streams) {
        json.streams.forEach((s) => {
          streams.push(new StreamResult({ url: s.url, quality: s.quality || s.label || "Auto" }));
        });
      }
      cb({ success: true, data: streams });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
