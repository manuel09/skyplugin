(function () {
  // CorsaroNero - Italian Torrent Search
  const TAG = "CorsaroNero";

  async function getHome(cb) {
    try {
      const resp = await fetch(manifest.baseUrl);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        torrents: { query: "table.table tbody tr, .torrent-row, .lista tr", multiple: true, fields: {
          title: { query: "a.tab", attr: "textContent" },
          href: { query: "a.tab", attr: "href" },
          category: { query: "td:first-child a, .category", attr: "textContent" },
          size: { query: "td:nth-child(3), .size", attr: "textContent" },
          seeds: { query: "td.s, .seeds", attr: "textContent" },
        }},
      });
      const torrents = (items.torrents || []).filter((t) => t.title && t.href).map((t) => new MultimediaItem({
        title: t.title.trim(),
        url: t.href.startsWith("http") ? t.href : manifest.baseUrl + t.href,
        type: t.category?.toLowerCase().includes("film") ? "movie" : "series",
      }));
      cb({ success: true, data: { "Trending": torrents.slice(0, 30) } });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const resp = await fetch(`${manifest.baseUrl}/search?q=${encodeURIComponent(query)}`);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        torrents: { query: "table.table tbody tr, .torrent-row, .lista tr", multiple: true, fields: {
          title: { query: "a.tab, a[href*=torrent]", attr: "textContent" },
          href: { query: "a.tab, a[href*=torrent]", attr: "href" },
          size: { query: "td:nth-child(3), .size", attr: "textContent" },
          seeds: { query: "td.s, .seeds", attr: "textContent" },
        }},
      });
      const results = (items.torrents || []).filter((t) => t.title && t.href).map((t) => new MultimediaItem({
        title: `${t.title.trim()}${t.size ? ` [${t.size.trim()}]` : ""}${t.seeds ? ` 🌱${t.seeds.trim()}` : ""}`,
        url: t.href.startsWith("http") ? t.href : manifest.baseUrl + t.href,
        type: "movie",
      }));
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const details = await nativeExtract(html, {
        title: { query: "h1, .page-title, #titolo", attr: "textContent", first: true },
        description: { query: ".descrizione, .desc, .content p", attr: "textContent", first: true },
        magnetLink: { query: "a[href^='magnet:']", attr: "href", first: true },
        hash: { query: "#hash, .hash", attr: "textContent", first: true },
      });
      const item = new MultimediaItem({
        title: (details.title || "Torrent").trim(), url: details.magnetLink || url,
        type: "movie", description: (details.description || "").trim(),
      });
      cb({ success: true, data: item });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const streams = [];
      if (url.startsWith("magnet:")) {
        streams.push(new StreamResult({ url, quality: "Magnet" }));
      } else {
        const resp = await fetch(url);
        const html = await resp.text();
        const magnetMatch = html.match(/href=["'](magnet:[^"']+)["']/);
        if (magnetMatch) streams.push(new StreamResult({ url: magnetMatch[1], quality: "Magnet" }));
      }
      cb({ success: true, data: streams });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
