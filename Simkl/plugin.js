(function () {
  // Simkl - Metadata and tracking search
  const TAG = "Simkl";
  const clientID = "5300f8658826d40f4381273950fb4662d007c6f0932c0d8324e93bb2f5852ff5"; // Sample public client ID

  async function search(query, cb) {
    try {
      const resp = await fetch(`https://api.simkl.com/search/all?q=${encodeURIComponent(query)}&client_id=${clientID}`);
      const json = JSON.parse(await resp.text());
      const results = (Array.isArray(json) ? json : []).map((m) => new MultimediaItem({
        title: m.title,
        url: JSON.stringify({ simklId: m.ids?.simkl, type: m.type }),
        posterUrl: m.poster ? `https://simkl.in/posters/${m.poster}_m.jpg` : "",
        type: m.type === "anime" ? "anime" : m.type === "show" ? "series" : "movie",
        year: m.year ? parseInt(m.year) : undefined,
      }));
      cb({ success: true, data: results });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function load(url, cb) {
    try {
      const data = JSON.parse(url);
      const resp = await fetch(`https://api.simkl.com/search/id?simkl=${data.simklId}&client_id=${clientID}`);
      const json = JSON.parse(await resp.text());
      const item = json[0] || json;
      
      const result = new MultimediaItem({
        title: item.title,
        url: url,
        posterUrl: item.poster ? `https://simkl.in/posters/${item.poster}_m.jpg` : "",
        type: data.type === "anime" ? "anime" : data.type === "show" ? "series" : "movie",
        description: item.overview || "",
        year: item.year ? parseInt(item.year) : undefined,
        score: item.ratings?.simkl?.rating ? parseFloat(item.ratings.simkl.rating) : undefined,
      });

      // No streams from Simkl, it's a metadata provider
      cb({ success: true, data: result });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  async function loadStreams(url, cb) {
    cb({ success: true, data: [] }); // Simkl doesn't provide streams
  }

  async function getHome(cb) {
    cb({ success: true, data: { "Trending": [
      new MultimediaItem({ title: "Search Simkl for metadata", url: "#", type: "movie", posterUrl: "" })
    ]}});
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
