(function () {
  // OnlineSerieTV - Italian TV Series
  const TAG = "OnlineSerieTV";
  async function getHome(cb) {
    try {
      const resp = await fetch(manifest.baseUrl);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        posts: { query: ".post, .film-item, article", multiple: true, fields: {
          title: { query: "h2 a, h3 a, .title a", attr: "textContent" },
          href: { query: "h2 a, h3 a, .title a, a", attr: "href" },
          poster: { query: "img", attr: "data-src" },
          posterFallback: { query: "img", attr: "src" },
        }},
      });
      const series = (items.posts || []).filter((p) => p.title && p.href).map((p) => new MultimediaItem({
        title: p.title.trim(), url: p.href.startsWith("http") ? p.href : manifest.baseUrl + p.href,
        posterUrl: p.poster || p.posterFallback, type: "series",
      }));
      cb({ success: true, data: { "Trending": series.slice(0, 20), "Tutte le Serie": series } });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const resp = await fetch(`${manifest.baseUrl}/?s=${encodeURIComponent(query)}`);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        posts: { query: ".post, .film-item, article", multiple: true, fields: {
          title: { query: "h2 a, h3 a, .title a", attr: "textContent" },
          href: { query: "h2 a, h3 a, .title a, a", attr: "href" },
          poster: { query: "img", attr: "src" },
        }},
      });
      const results = (items.posts || []).filter((p) => p.title && p.href).map((p) => new MultimediaItem({
        title: p.title.trim(), url: p.href.startsWith("http") ? p.href : manifest.baseUrl + p.href,
        posterUrl: p.poster, type: "series",
      }));
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const details = await nativeExtract(html, {
        title: { query: "h1", attr: "textContent", first: true },
        poster: { query: ".locandina img, .poster img, .thumb img", attr: "src", first: true },
        plot: { query: ".trama, .desc, .description", attr: "textContent", first: true },
        seasons: { query: ".accordion-item, .season, [data-season]", multiple: true, fields: {
          seasonTitle: { query: ".accordion-header, .season-title, h3", attr: "textContent" },
          episodes: { query: "a[href], li a", multiple: true, fields: {
            name: { attr: "textContent" }, href: { attr: "href" },
          }},
        }},
      });
      const item = new MultimediaItem({
        title: (details.title || "Serie TV").trim(), url, posterUrl: details.poster,
        type: "series", description: (details.plot || "").trim(),
      });
      item.episodes = [];
      let globalEp = 0;
      for (const season of details.seasons || []) {
        const seasonMatch = season.seasonTitle?.match(/\d+/);
        const seasonNum = seasonMatch ? parseInt(seasonMatch[0]) : 1;
        for (const ep of season.episodes || []) {
          if (!ep.href) continue;
          globalEp++;
          item.episodes.push(new Episode({
            name: ep.name?.trim() || `Episodio ${globalEp}`,
            url: ep.href.startsWith("http") ? ep.href : manifest.baseUrl + ep.href,
            season: seasonNum, episode: globalEp,
          }));
        }
      }
      cb({ success: true, data: item });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const streams = [];
      // Extract iframes
      const data = await nativeExtract(html, { iframes: { query: "iframe", multiple: true, attr: "src" } });
      for (const iframe of data.iframes || []) {
        if (!iframe) continue;
        try {
          const fixedUrl = iframe.startsWith("//") ? "https:" + iframe : iframe;
          const iResp = await fetch(fixedUrl);
          const iHtml = await iResp.text();
          // MaxStream
          const maxMatch = iHtml.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/);
          if (maxMatch) { streams.push(new StreamResult({ url: maxMatch[1], quality: "MaxStream" })); continue; }
          // StreamTape
          const stMatch = iHtml.match(/document\.getElementById\('robotlink'\)\.innerHTML\s*=\s*['"]([^'"]+)['"]/);
          if (stMatch) {
            let stUrl = stMatch[1];
            const tokenMatch = iHtml.match(/token=([^'"&]+)/);
            if (tokenMatch) stUrl += "&token=" + tokenMatch[1];
            if (stUrl.startsWith("//")) stUrl = "https:" + stUrl;
            streams.push(new StreamResult({ url: stUrl, quality: "StreamTape" })); continue;
          }
          // Generic m3u8/mp4
          const genMatch = iHtml.match(/['"]([^'"]+\.m3u8[^'"]*)['"]/);
          if (genMatch) streams.push(new StreamResult({ url: genMatch[1], quality: "Auto" }));
        } catch (e) {}
      }
      cb({ success: true, data: streams });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
