(function () {
  // IPTV - Live TV from M3U playlists
  // Ported from CloudStream TV/IPTV plugins by doGior
  const TAG = "IPTV";
  const defaultLists = [
    { name: "Italy", url: "https://raw.githubusercontent.com/Free-TV/IPTV/refs/heads/master/playlists/playlist_italy.m3u8" },
    { name: "Global", url: "https://raw.githubusercontent.com/Free-TV/IPTV/refs/heads/master/playlists/playlist_global.m3u8" },
  ];

  async function parseM3U(url) {
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      const lines = text.split("\n");
      const channels = [];
      let currentChannel = {};

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith("#EXTINF:")) {
          const info = line.substring(8);
          const titleMatch = info.match(/,(.*)$/);
          const logoMatch = info.match(/tvg-logo="([^"]+)"/);
          const groupMatch = info.match(/group-title="([^"]+)"/);
          
          currentChannel = {
            title: titleMatch ? titleMatch[1].trim() : "Unknown",
            poster: logoMatch ? logoMatch[1] : "",
            group: groupMatch ? groupMatch[1] : "Other",
          };
        } else if (line.startsWith("http")) {
          currentChannel.url = line;
          channels.push(currentChannel);
          currentChannel = {};
        }
      }
      return channels;
    } catch (e) {
      console.error(TAG, "M3U parse failed:", e);
      return [];
    }
  }

  async function getHome(cb) {
    try {
      const data = {};
      for (const list of defaultLists) {
        const channels = await parseM3U(list.url);
        data[list.name] = channels.slice(0, 50).map((ch) => new MultimediaItem({
          title: ch.title,
          url: JSON.stringify({ streamUrl: ch.url, title: ch.title, poster: ch.poster }),
          posterUrl: ch.poster,
          type: "livestream",
        }));
      }
      cb({ success: true, data });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function search(query, cb) {
    try {
      const results = [];
      for (const list of defaultLists) {
        const channels = await parseM3U(list.url);
        const q = query.toLowerCase();
        channels.forEach((ch) => {
          if (ch.title.toLowerCase().includes(q)) {
            results.push(new MultimediaItem({
              title: ch.title,
              url: JSON.stringify({ streamUrl: ch.url, title: ch.title, poster: ch.poster }),
              posterUrl: ch.poster,
              type: "livestream",
            }));
          }
        });
      }
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const data = JSON.parse(url);
      cb({ success: true, data: new MultimediaItem({
        title: data.title,
        url: url,
        posterUrl: data.poster,
        type: "livestream",
      })});
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    try {
      const data = JSON.parse(url);
      cb({ success: true, data: [new StreamResult({ url: data.streamUrl, quality: "Auto" })] });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
