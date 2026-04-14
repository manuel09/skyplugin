(function () {
  // IlCorsaroViola - Italian Torrent Search (alternative)
  const TAG = "IlCorsaroViola";

  async function getHome(cb) {
    try {
      const resp = await fetch(manifest.baseUrl);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        torrents: { query: "table tbody tr, .torrent-list tr", multiple: true, fields: {
          title: { query: "a[href*=torrent], .torrent-title a", attr: "textContent" },
          href: { query: "a[href*=torrent], .torrent-title a", attr: "href" },
          size: { query: ".size, td:nth-child(3)", attr: "textContent" },
          seeds: { query: ".seeds, td.s", attr: "textContent" },
        }},
      });
      const torrents = (items.torrents || []).filter((t) => t.title && t.href).map((t) => new MultimediaItem({
        title: t.title.trim(),
        url: t.href.startsWith("http") ? t.href : manifest.baseUrl + t.href,
        type: "movie",
      }));
      cb({ success: true, data: { "Trending": torrents.slice(0, 30) } });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const resp = await fetch(`${manifest.baseUrl}/search?q=${encodeURIComponent(query)}`);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        torrents: { query: "table tbody tr, .torrent-list tr", multiple: true, fields: {
          title: { query: "a[href*=torrent], .torrent-title a", attr: "textContent" },
          href: { query: "a[href*=torrent], .torrent-title a", attr: "href" },
          size: { query: ".size, td:nth-child(3)", attr: "textContent" },
          seeds: { query: ".seeds, td.s", attr: "textContent" },
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
        title: { query: "h1, .page-title", attr: "textContent", first: true },
        description: { query: ".descrizione, .desc, .content", attr: "textContent", first: true },
        magnetLink: { query: "a[href^='magnet:']", attr: "href", first: true },
      });
      cb({ success: true, data: new MultimediaItem({
        title: (details.title || "Torrent").trim(), url: details.magnetLink || url,
        type: "movie", description: (details.description || "").trim(),
      })});
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
