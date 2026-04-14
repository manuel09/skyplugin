(function () {
  // DaddyLive - Live TV Channels
  const TAG = "DaddyLive";
  const poster = "https://raw.githubusercontent.com/doGior/doGiorsHadEnough/refs/heads/master/DaddyLive/daddylive.jpg";

  async function getHome(cb) {
    try {
      const resp = await fetch(`${manifest.baseUrl}/24-7-channels.php`);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        channels: { query: "div.grid > a", multiple: true, fields: {
          name: { query: "div.card__title", attr: "textContent" },
          href: { attr: "href" },
        }},
      });
      const channels = {};
      for (const ch of items.channels || []) {
        if (!ch.name || !ch.href) continue;
        const country = ch.name.split(/\s+/).pop().replace(")", "").trim() || "Other";
        if (!channels[country]) channels[country] = [];
        const url = ch.href.startsWith("http") ? ch.href : manifest.baseUrl + ch.href;
        channels[country].push(new MultimediaItem({
          title: ch.name.trim(), url, posterUrl: poster, type: "livestream",
        }));
      }
      // Put first few countries as Trending
      const keys = Object.keys(channels).sort();
      const data = {};
      if (keys.length > 0) data["Trending"] = channels[keys[0]] || [];
      keys.forEach((k) => { data[k] = channels[k]; });
      cb({ success: true, data });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const resp = await fetch(`${manifest.baseUrl}/24-7-channels.php`);
      const html = await resp.text();
      const items = await nativeExtract(html, {
        channels: { query: "div.grid > a", multiple: true, fields: {
          name: { query: "div.card__title", attr: "textContent" },
          href: { attr: "href" },
        }},
      });
      const q = query.toLowerCase().replace(/\s/g, "");
      const results = (items.channels || [])
        .filter((ch) => ch.name && ch.name.toLowerCase().replace(/\s/g, "").includes(q))
        .map((ch) => {
          const url = ch.href.startsWith("http") ? ch.href : manifest.baseUrl + ch.href;
          return new MultimediaItem({ title: ch.name.trim(), url, posterUrl: poster, type: "livestream" });
        });
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
      const h2 = h2Match ? h2Match[1] : "Channel";
      const title = h2.split("(")[0].trim();
      const idMatch = h2.match(/ID\s+(\d+)/);
      const id = idMatch ? idMatch[1] : "";
      const item = new MultimediaItem({
        title, url: JSON.stringify({ baseUrl: manifest.baseUrl, id }), posterUrl: poster, type: "livestream",
      });
      cb({ success: true, data: item });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const loadData = JSON.parse(url);
      const players = ["stream", "cast", "watch", "plus", "casting", "player"];
      const streams = [];
      for (const player of players) {
        try {
          const streamUrl = `${loadData.baseUrl}/${player}/stream-${loadData.id}.php`;
          const resp = await fetch(streamUrl);
          const html = await resp.text();
          const m3u8Match = html.match(/['"]([^'"]+\.m3u8[^'"]*)['"]/);
          if (m3u8Match) {
            streams.push(new StreamResult({ url: m3u8Match[1], quality: player }));
          }
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
