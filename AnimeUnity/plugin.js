(function () {
  // ============================================================
  // AnimeUnity - Italian Anime
  // Ported from CloudStream Kotlin plugin by doGior
  // ============================================================

  const TAG = "AnimeUnity";
  let csrfToken = "";
  let cookieString = "";

  async function setupHeaders() {
    const resp = await fetch(`${manifest.baseUrl}/archivio`);
    const html = await resp.text();
    const csrfMatch = html.match(/meta\s+name="csrf-token"\s+content="([^"]+)"/);
    csrfToken = csrfMatch ? csrfMatch[1] : "";

    const cookies = {};
    const setCookies = resp.headers?.["set-cookie"];
    if (setCookies) {
      (Array.isArray(setCookies) ? setCookies : [setCookies]).forEach((c) => {
        const parts = c.split(";")[0].split("=");
        if (parts.length >= 2) cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
      });
    }
    cookieString = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  function getApiHeaders() {
    const host = manifest.baseUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return {
      Host: host,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json;charset=utf-8",
      "X-CSRF-Token": csrfToken,
      Referer: manifest.baseUrl,
      Cookie: cookieString,
    };
  }

  function getImageUrl(imageUrl, anilistId) {
    if (imageUrl) {
      const fileName = imageUrl.split("/").pop();
      return `https://img.animeunity.so/anime/${fileName}`;
    }
    return null;
  }

  function animeToItem(anime) {
    const title = anime.title_it || anime.title_eng || anime.title || "?";
    const isDub = anime.dub === 1 || title.includes("(ITA)");
    return new MultimediaItem({
      title: title.replace(" (ITA)", ""),
      url: `${manifest.baseUrl}/anime/${anime.id}-${anime.slug}`,
      posterUrl: getImageUrl(anime.imageUrl || anime.image_url),
      type: anime.type === "Movie" || anime.episodes_count === 1 ? "movie" : "anime",
      score: anime.score ? parseFloat(anime.score) : undefined,
      status: anime.status === "In Corso" ? "ongoing" : anime.status === "Finito" ? "completed" : undefined,
    });
  }

  async function getHome(cb) {
    try {
      if (!csrfToken) await setupHeaders();

      const sections = [
        { name: "Trending", orderBy: "Popolarità", status: "In Corso" },
        { name: "Popolari", orderBy: "Popolarità" },
        { name: "I migliori", orderBy: "Valutazione" },
        { name: "In Arrivo", status: "In Uscita" },
      ];

      const data = {};
      for (const section of sections) {
        try {
          const body = {
            title: "",
            type: false,
            year: false,
            order: false,
            status: section.status || false,
            genres: false,
            offset: 0,
            dubbed: 0,
            season: false,
          };
          if (section.orderBy) body.order = section.orderBy;

          const resp = await fetch(`${manifest.baseUrl}/archivio/get-animes`, {
            method: "POST",
            headers: getApiHeaders(),
            body: JSON.stringify(body),
          });
          const json = JSON.parse(await resp.text());
          const titles = json.titles || [];
          data[section.name] = titles.map(animeToItem);
        } catch (e) {
          console.error(TAG, `Section ${section.name} failed:`, e);
        }
      }

      cb({ success: true, data });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function search(query, cb) {
    try {
      if (!csrfToken) await setupHeaders();

      const body = {
        title: query,
        type: false,
        year: false,
        order: false,
        status: false,
        genres: false,
        offset: 0,
        dubbed: 0,
        season: false,
      };

      const resp = await fetch(`${manifest.baseUrl}/archivio/get-animes`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      const json = JSON.parse(await resp.text());
      const results = (json.titles || []).map(animeToItem);

      cb({ success: true, data: results });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function load(url, cb) {
    try {
      if (!csrfToken) await setupHeaders();

      const resp = await fetch(url);
      const html = await resp.text();

      // Extract anime data from video-player component
      const animeMatch = html.match(/video-player[^>]*anime="([^"]+)"/);
      const epsMatch = html.match(/video-player[^>]*episodes="([^"]+)"/);
      const epsCountMatch = html.match(/video-player[^>]*episodes_count="(\d+)"/);

      if (!animeMatch) {
        cb({ success: false, error: "Could not parse anime data" });
        return;
      }

      const animeStr = animeMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      const anime = JSON.parse(animeStr);

      const title = anime.title_it || anime.title_eng || anime.title || "?";
      const isDub = anime.dub === 1 || title.includes("(ITA)");

      const item = new MultimediaItem({
        title: title.replace(" (ITA)", ""),
        url: url,
        posterUrl: getImageUrl(anime.imageUrl || anime.image_url),
        type: anime.type === "Movie" || anime.episodes_count === 1 ? "movie" : "anime",
        year: anime.date ? parseInt(anime.date) : undefined,
        score: anime.score ? parseFloat(anime.score) : undefined,
        description: anime.plot || "",
        duration: anime.episodes_length || undefined,
        status: anime.status === "In Corso" ? "ongoing" : anime.status === "Finito" ? "completed" : undefined,
        syncData: {},
      });

      if (anime.anilist_id) item.syncData.mal = String(anime.anilist_id);

      // Parse episodes
      if (epsMatch) {
        const epsStr = epsMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
        const episodes = JSON.parse(epsStr);
        const totalEps = epsCountMatch ? parseInt(epsCountMatch[1]) : episodes.length;

        item.episodes = episodes.map((ep) => new Episode({
          name: `Episodio ${ep.number}`,
          url: `${url}/${ep.id}`,
          season: 1,
          episode: parseInt(ep.number) || 1,
          dubStatus: isDub ? "dubbed" : "subbed",
        }));

        // Fetch remaining episodes if > 120
        if (totalEps > 120) {
          const ranges = Math.ceil(totalEps / 120);
          for (let i = 2; i <= ranges; i++) {
            const endRange = i === ranges ? totalEps : i * 120;
            try {
              const infoResp = await fetch(
                `${manifest.baseUrl}/info_api/${anime.id}/1?start_range=${1 + (i - 1) * 120}&end_range=${endRange}`
              );
              const infoJson = JSON.parse(await infoResp.text());
              if (infoJson.episodes) {
                infoJson.episodes.forEach((ep) => {
                  item.episodes.push(new Episode({
                    name: `Episodio ${ep.number}`,
                    url: `${url}/${ep.id}`,
                    season: 1,
                    episode: parseInt(ep.number) || 1,
                    dubStatus: isDub ? "dubbed" : "subbed",
                  }));
                });
              }
            } catch (e) {
              console.error(TAG, "Extra episodes fetch failed:", e);
            }
          }
        }
      }

      // Related anime
      const relatedMatch = html.match(/layout-items[^>]*items-json="([^"]+)"/);
      if (relatedMatch) {
        try {
          const relStr = relatedMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
          const related = JSON.parse(relStr);
          item.recommendations = related.map(animeToItem);
        } catch (e) {}
      }

      cb({ success: true, data: item });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function loadStreams(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();

      const embedMatch = html.match(/video-player[^>]*embed_url="([^"]+)"/);
      if (!embedMatch) {
        cb({ success: false, error: "No embed URL found" });
        return;
      }

      const embedUrl = embedMatch[1].replace(/&amp;/g, "&");
      const streams = [];

      // VixCloud extraction (same as StreamingCommunity)
      try {
        const vResp = await fetch(embedUrl, {
          headers: {
            Accept: "*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
          },
        });
        const vHtml = await vResp.text();

        const scriptMatch = vHtml.match(/masterPlaylist[^}]*url\s*:\s*['"]([^'"]+)['"]/);
        const tokenMatch = vHtml.match(/token\s*:\s*['"]([^'"]+)['"]/);
        const expiresMatch = vHtml.match(/expires\s*:\s*['"]([^'"]+)['"]/);
        const canFHDMatch = vHtml.match(/canPlayFHD\s*:\s*(true|false)/);

        if (scriptMatch) {
          let playlistUrl = scriptMatch[1];
          const params = [];
          if (tokenMatch) params.push(`token=${tokenMatch[1]}`);
          if (expiresMatch) params.push(`expires=${expiresMatch[1]}`);

          if (playlistUrl.includes("?b")) {
            playlistUrl = playlistUrl.replace("?b:1", "?b=1") + "&" + params.join("&");
          } else {
            playlistUrl += "?" + params.join("&");
          }
          if (canFHDMatch && canFHDMatch[1] === "true") playlistUrl += "&h=1";

          streams.push(new StreamResult({
            url: playlistUrl,
            quality: "Auto",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
            },
          }));
        }
      } catch (e) {
        console.error(TAG, "VixCloud extraction failed:", e);
      }

      cb({ success: true, data: streams });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
