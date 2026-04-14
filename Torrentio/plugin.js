(function () {
  // Torrentio - Torrent streams via Stremio addon
  const TAG = "Torrentio";
  const stremioUrl = "https://torrentio.strem.fun";

  async function getHome(cb) {
    cb({ success: true, data: { "Trending": [
      new MultimediaItem({ title: "Search for a movie or series to find torrent streams", url: "#", type: "movie", posterUrl: "" })
    ]}});
  }

  async function search(query, cb) {
    try {
      // Search TMDB for IDs
      const resp = await fetch(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(query)}.json`);
      const json = JSON.parse(await resp.text());
      const movieResults = (json.metas || []).map((m) => new MultimediaItem({
        title: m.name, url: JSON.stringify({ imdbId: m.imdb_id, type: "movie" }),
        posterUrl: m.poster, type: "movie", year: m.year ? parseInt(m.year) : undefined,
      }));
      const resp2 = await fetch(`https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(query)}.json`);
      const json2 = JSON.parse(await resp2.text());
      const seriesResults = (json2.metas || []).map((m) => new MultimediaItem({
        title: m.name, url: JSON.stringify({ imdbId: m.imdb_id, type: "series" }),
        posterUrl: m.poster, type: "series", year: m.year ? parseInt(m.year) : undefined,
      }));
      cb({ success: true, data: [...movieResults, ...seriesResults] });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const data = JSON.parse(url);
      const metaType = data.type === "series" ? "series" : "movie";
      const resp = await fetch(`https://v3-cinemeta.strem.io/meta/${metaType}/${data.imdbId}.json`);
      const json = JSON.parse(await resp.text());
      const meta = json.meta;
      const item = new MultimediaItem({
        title: meta.name, url: url, posterUrl: meta.poster, bannerUrl: meta.background,
        type: data.type, year: meta.year ? parseInt(meta.year) : undefined,
        description: meta.description || "", score: meta.imdbRating ? parseFloat(meta.imdbRating) : undefined,
        cast: (meta.cast || []).map((c) => new Actor({ name: c })),
        syncData: { imdb: data.imdbId },
        playbackPolicy: "torrent",
      });
      if (metaType === "series" && meta.videos) {
        item.episodes = meta.videos.map((v) => new Episode({
          name: v.title || v.name || `S${v.season}E${v.episode}`,
          url: JSON.stringify({ imdbId: data.imdbId, type: "series", season: v.season, episode: v.episode }),
          season: v.season, episode: v.episode,
        }));
      }
      cb({ success: true, data: item });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const data = JSON.parse(url);
      let streamPath;
      if (data.type === "series") {
        streamPath = `${stremioUrl}/stream/series/${data.imdbId}:${data.season}:${data.episode}.json`;
      } else {
        streamPath = `${stremioUrl}/stream/movie/${data.imdbId}.json`;
      }
      const resp = await fetch(streamPath);
      const json = JSON.parse(await resp.text());
      const streams = (json.streams || []).map((s) => new StreamResult({
        url: s.url || s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : "",
        quality: s.name || s.title || "Unknown",
      })).filter((s) => s.url);
      cb({ success: true, data: streams });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
