(function () {
  // Huhu - Italian Live TV
  const TAG = "Huhu";
  async function getHome(cb) {
    try {
      const resp = await fetch(manifest.baseUrl);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        channels: { query: ".channel-item, .card, a[href*=channel]", multiple: true, fields: {
          title: { attr: "textContent" }, href: { attr: "href" },
          poster: { query: "img", attr: "src" },
        }},
      });
      const channels = (items.channels || []).filter((c) => c.title && c.href).map((c) => {
        const url = c.href.startsWith("http") ? c.href : manifest.baseUrl + c.href;
        return new MultimediaItem({ title: c.title.trim(), url, posterUrl: c.poster, type: "livestream" });
      });
      cb({ success: true, data: { "Trending": channels } });
    } catch (e) { cb({ success: false, error: e.message }); }
  }
  async function search(query, cb) {
    try {
      const resp = await fetch(manifest.baseUrl);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        channels: { query: ".channel-item, .card, a[href*=channel]", multiple: true, fields: {
          title: { attr: "textContent" }, href: { attr: "href" },
        }},
      });
      const q = query.toLowerCase();
      const results = (items.channels || []).filter((c) => c.title?.toLowerCase().includes(q))
        .map((c) => new MultimediaItem({ title: c.title.trim(), url: c.href.startsWith("http") ? c.href : manifest.baseUrl + c.href, type: "livestream" }));
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }
  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || html.match(/<title>([^<]+)<\/title>/) || [, "Channel"])[1].trim();
      const iframes = await nativeExtract(html, { iframes: { query: "iframe", multiple: true, attr: "src" } });
      cb({ success: true, data: new MultimediaItem({ title, url: JSON.stringify(iframes.iframes || []), type: "livestream" }) });
    } catch (e) { cb({ success: false, error: e.message }); }
  }
  async function loadStreams(url, cb) {
    try {
      const iframes = JSON.parse(url);
      const streams = [];
      for (const iframe of iframes) {
        if (!iframe) continue;
        try {
          const fixedUrl = iframe.startsWith("//") ? "https:" + iframe : iframe;
          const resp = await fetch(fixedUrl);
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
