(function () {
  // CalcioStreaming - Italian football live streams
  const TAG = "CalcioStreaming";
  async function getHome(cb) {
    try {
      const resp = await fetch(manifest.baseUrl);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        matches: { query: ".entry-content a, .post a, article a", multiple: true, fields: {
          title: { attr: "textContent" }, href: { attr: "href" },
        }},
      });
      const seen = new Set();
      const matches = (items.matches || []).filter((m) => {
        if (!m.title || !m.href || seen.has(m.href)) return false;
        if (m.href === manifest.baseUrl || m.href === manifest.baseUrl + "/") return false;
        seen.add(m.href);
        return m.title.trim().length > 3;
      }).map((m) => new MultimediaItem({
        title: m.title.trim(), url: m.href, type: "livestream",
      }));
      cb({ success: true, data: { "Trending": matches.slice(0, 20), "Tutti": matches } });
    } catch (e) { cb({ success: false, error: e.message }); }
  }
  async function search(query, cb) {
    try {
      const resp = await fetch(`${manifest.baseUrl}/?s=${encodeURIComponent(query)}`);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        results: { query: ".entry-title a, .post-title a, article a", multiple: true, fields: {
          title: { attr: "textContent" }, href: { attr: "href" },
        }},
      });
      const results = (items.results || []).filter((r) => r.title && r.href)
        .map((r) => new MultimediaItem({ title: r.title.trim(), url: r.href, type: "livestream" }));
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }
  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const data = await nativeExtract(html, {
        title: { query: "h1, .entry-title", attr: "textContent", first: true },
        iframes: { query: "iframe", multiple: true, attr: "src" },
      });
      const item = new MultimediaItem({
        title: (data.title || "Match").trim(), url: JSON.stringify(data.iframes || []), type: "livestream",
      });
      cb({ success: true, data: item });
    } catch (e) { cb({ success: false, error: e.message }); }
  }
  async function loadStreams(url, cb) {
    try {
      const iframes = JSON.parse(url);
      const streams = [];
      for (const iframe of iframes) {
        if (!iframe) continue;
        try {
          const resp = await fetch(iframe);
          const html = await resp.text();
          const m3u8 = html.match(/['"]([^'"]+\.m3u8[^'"]*)['"]/);
          if (m3u8) streams.push(new StreamResult({ url: m3u8[1], quality: "Auto" }));
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
