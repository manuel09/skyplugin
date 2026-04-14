(function () {
  // ============================================================
  // StreamingCommunity - Italian Movies & TV Series
  // Ported from CloudStream Kotlin plugin by doGior
  // ============================================================

  const TAG = "StreamingCommunity";
  let inertiaVersion = "";
  let decodedXsrfToken = "";
  let cookieString = "";
  const lang = "it";

  const defaultHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  };

  // --- Helpers ---

  function getDomain() {
    return manifest.baseUrl.replace(/\/$/, "");
  }

  function getCdnDomain() {
    const host = getDomain().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return `https://cdn.${host}`;
  }

  function getPosterUrl(images) {
    if (!images) return null;
    const poster = images.find((img) => img.type === "poster");
    return poster ? `${getCdnDomain()}/images/${poster.filename}` : null;
  }

  function getBackgroundUrl(images) {
    if (!images) return null;
    const bg = images.find((img) => img.type === "background");
    return bg ? `${getCdnDomain()}/images/${bg.filename}` : null;
  }

  async function setupHeaders() {
    try {
      const baseUrl = getDomain() + "/" + lang;
      const response = await fetch(`${baseUrl}/archive`);
      const html = await response.text();
      const cookies = {};

      // Extract cookies from response
      const setCookies = response.headers?.["set-cookie"];
      if (setCookies) {
        const cookieList = Array.isArray(setCookies)
          ? setCookies
          : [setCookies];
        cookieList.forEach((c) => {
          const parts = c.split(";")[0].split("=");
          if (parts.length >= 2) cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
        });
      }

      // CSRF cookie
      const csrfResp = await fetch(`${getDomain()}/sanctum/csrf-cookie`, {
        headers: {
          Referer: `${baseUrl}/`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const csrfCookies = csrfResp.headers?.["set-cookie"];
      if (csrfCookies) {
        const cookieList = Array.isArray(csrfCookies)
          ? csrfCookies
          : [csrfCookies];
        cookieList.forEach((c) => {
          const parts = c.split(";")[0].split("=");
          if (parts.length >= 2) cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
        });
      }

      cookieString = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      decodedXsrfToken = cookies["XSRF-TOKEN"]
        ? decodeURIComponent(cookies["XSRF-TOKEN"])
        : "";

      // Extract inertia version from data-page attribute
      const match = html.match(/data-page="([^"]+)"/);
      if (match) {
        const decoded = match[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&");
        try {
          const pageData = JSON.parse(decoded);
          inertiaVersion = pageData.version || "";
        } catch (e) {
          const vMatch = decoded.match(/"version":"([^"]+)"/);
          if (vMatch) inertiaVersion = vMatch[1];
        }
      }
    } catch (e) {
      console.error(TAG, "setupHeaders failed:", e);
    }
  }

  function getSliderFetchHeaders() {
    return {
      Cookie: cookieString,
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN": decodedXsrfToken,
      Referer: `${getDomain()}/${lang}/`,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: getDomain(),
    };
  }

  function getInertiaHeaders() {
    return {
      Cookie: cookieString,
      "X-Inertia": "true",
      "X-Inertia-Version": inertiaVersion,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    };
  }

  function titleToMultimediaItem(title) {
    const baseUrl = getDomain() + "/" + lang;
    return new MultimediaItem({
      title: title.name,
      url: `${baseUrl}/titles/${title.id}-${title.slug}`,
      posterUrl: getPosterUrl(title.images),
      type: title.type === "tv" ? "series" : "movie",
    });
  }

  // --- Core Functions ---

  async function getHome(cb) {
    try {
      if (!cookieString) await setupHeaders();

      const sliders = [
        { name: "top10", genre: null },
        { name: "trending", genre: null },
        { name: "latest", genre: null },
        { name: "upcoming", genre: null },
        { name: "genre", genre: "Animation" },
        { name: "genre", genre: "Adventure" },
        { name: "genre", genre: "Action" },
        { name: "genre", genre: "Comedy" },
        { name: "genre", genre: "Crime" },
        { name: "genre", genre: "Documentary" },
        { name: "genre", genre: "Drama" },
        { name: "genre", genre: "Family" },
        { name: "genre", genre: "Science Fiction" },
        { name: "genre", genre: "Fantasy" },
        { name: "genre", genre: "Horror" },
        { name: "genre", genre: "Romance" },
        { name: "genre", genre: "Thriller" },
      ];

      const categories = {};
      const maxBatch = 6;

      for (let i = 0; i < sliders.length; i += maxBatch) {
        const batch = sliders.slice(i, i + maxBatch);
        try {
          const resp = await fetch(
            `${getDomain()}/api/sliders/fetch?lang=${lang}`,
            {
              method: "POST",
              headers: getSliderFetchHeaders(),
              body: JSON.stringify({ sliders: batch }),
            }
          );
          const data = JSON.parse(await resp.text());
          if (Array.isArray(data)) {
            data.forEach((slider) => {
              const label = slider.label || slider.name;
              const items = slider.titles
                .filter((t) => t.type === "movie" || t.type === "tv")
                .map(titleToMultimediaItem);
              if (items.length > 0) {
                // Use "Trending" for the first batch trending slider
                const categoryName =
                  slider.name === "trending" ? "Trending" : label;
                categories[categoryName] = items;
              }
            });
          }
        } catch (e) {
          console.error(TAG, "Slider batch failed:", e);
        }
      }

      cb({ success: true, data: categories });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function search(query, cb) {
    try {
      if (!cookieString) await setupHeaders();

      const baseUrl = getDomain() + "/" + lang;
      const resp = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}`);
      const text = await resp.text();

      let titles = [];
      try {
        // Try direct JSON parse (Inertia response)
        const json = JSON.parse(text);
        titles = json.props?.titles || [];
      } catch (e) {
        // HTML fallback - extract data-page
        const match = text.match(/data-page="([^"]+)"/);
        if (match) {
          const decoded = match[1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&");
          const pageData = JSON.parse(decoded);
          titles = pageData.props?.titles || [];
        }
      }

      const items = titles
        .filter((t) => t.type === "movie" || t.type === "tv")
        .map(titleToMultimediaItem);

      cb({ success: true, data: items });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function load(url, cb) {
    try {
      if (!cookieString) await setupHeaders();

      const resp = await fetch(url, { headers: getInertiaHeaders() });
      const text = await resp.text();

      let props;
      try {
        const json = JSON.parse(text);
        props = json.props;
      } catch (e) {
        const match = text.match(/data-page="([^"]+)"/);
        if (match) {
          const decoded = match[1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&");
          props = JSON.parse(decoded).props;
        }
      }

      if (!props || !props.title) {
        cb({ success: false, error: "Could not parse title data" });
        return;
      }

      const title = props.title;
      const baseUrl = getDomain() + "/" + lang;

      const item = new MultimediaItem({
        title: title.name,
        url: url,
        posterUrl: getPosterUrl(title.images),
        bannerUrl: getBackgroundUrl(title.images),
        type: title.type === "tv" ? "series" : "movie",
        year: title.release_date
          ? parseInt(title.release_date.split("-")[0])
          : undefined,
        score: title.score ? parseFloat(title.score) : undefined,
        duration: title.runtime || undefined,
        description: title.plot || "",
        contentRating: title.age ? `${title.age}+` : undefined,
        cast: title.main_actors
          ? title.main_actors.map(
              (a) => new Actor({ name: a.name })
            )
          : [],
        trailers: title.trailers
          ? title.trailers
              .filter((t) => t.youtube_id)
              .map(
                (t) =>
                  new Trailer({
                    url: `https://www.youtube.com/watch?v=${t.youtube_id}`,
                  })
              )
          : [],
        syncData: {},
      });

      if (title.tmdb_id) item.syncData.tmdb = String(title.tmdb_id);
      if (title.imdb_id) item.syncData.imdb = title.imdb_id;

      // Episodes for TV series
      if (title.type === "tv" && title.seasons) {
        item.episodes = [];

        for (const season of title.seasons) {
          let episodes;
          if (
            props.loadedSeason &&
            season.id === props.loadedSeason.id
          ) {
            episodes = props.loadedSeason.episodes || [];
          } else {
            // Fetch season episodes
            try {
              const seasonUrl = `${baseUrl}/titles/${title.id}-${title.slug}/season-${season.number}`;
              const sResp = await fetch(seasonUrl, {
                headers: getInertiaHeaders(),
              });
              const sText = await sResp.text();
              let sProps;
              try {
                sProps = JSON.parse(sText).props;
              } catch (_) {
                const m = sText.match(/data-page="([^"]+)"/);
                if (m) {
                  const d = m[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, "&");
                  sProps = JSON.parse(d).props;
                }
              }
              episodes = sProps?.loadedSeason?.episodes || [];
            } catch (e) {
              episodes = [];
            }
          }

          episodes.forEach((ep) => {
            item.episodes.push(
              new Episode({
                name: ep.name || `S${season.number}E${ep.number}`,
                url: JSON.stringify({
                  iframeUrl: `${baseUrl}/iframe/${title.id}?episode_id=${ep.id}&canPlayFHD=1`,
                  type: "tv",
                  tmdbId: title.tmdb_id,
                  season: season.number,
                  episode: ep.number,
                }),
                season: season.number,
                episode: ep.number,
                runtime: ep.duration || undefined,
              })
            );
          });
        }

        // Related content
        if (props.sliders && props.sliders.length > 0) {
          item.recommendations = props.sliders[0].titles
            .filter((t) => t.type === "movie" || t.type === "tv")
            .map(titleToMultimediaItem);
        }
      } else {
        // Movie - store iframe URL as data
        item.url = JSON.stringify({
          iframeUrl: `${baseUrl}/iframe/${title.id}&canPlayFHD=1`,
          type: "movie",
          tmdbId: title.tmdb_id,
        });
      }

      cb({ success: true, data: item });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function loadStreams(url, cb) {
    try {
      const loadData = JSON.parse(url);
      const streams = [];

      // VixCloud extraction
      try {
        const iframeResp = await fetch(loadData.iframeUrl);
        const iframeHtml = await iframeResp.text();

        // Find the actual iframe src
        const iframeSrcMatch = iframeHtml.match(
          /src="([^"]*vixcloud[^"]*)"/i
        ) || iframeHtml.match(/src="(https?:\/\/[^"]+)"/i);

        if (iframeSrcMatch) {
          const vixUrl = iframeSrcMatch[1];
          const vixResp = await fetch(vixUrl, {
            headers: {
              Accept: "*/*",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
            },
          });
          const vixHtml = await vixResp.text();

          // Extract masterPlaylist from script
          const scriptMatch = vixHtml.match(
            /masterPlaylist[^}]*url\s*:\s*['"]([^'"]+)['"]/
          );
          const tokenMatch = vixHtml.match(
            /token\s*:\s*['"]([^'"]+)['"]/
          );
          const expiresMatch = vixHtml.match(
            /expires\s*:\s*['"]([^'"]+)['"]/
          );
          const canFHDMatch = vixHtml.match(
            /canPlayFHD\s*:\s*(true|false)/
          );

          if (scriptMatch) {
            let playlistUrl = scriptMatch[1];
            const params = [];
            if (tokenMatch) params.push(`token=${tokenMatch[1]}`);
            if (expiresMatch) params.push(`expires=${expiresMatch[1]}`);

            if (playlistUrl.includes("?b")) {
              playlistUrl = playlistUrl.replace("?b:1", "?b=1");
              playlistUrl += "&" + params.join("&");
            } else {
              playlistUrl += "?" + params.join("&");
            }

            if (canFHDMatch && canFHDMatch[1] === "true") {
              playlistUrl += "&h=1";
            }

            streams.push(
              new StreamResult({
                url: playlistUrl,
                quality: "Auto",
                headers: {
                  Accept: "*/*",
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
                },
              })
            );
          }
        }
      } catch (e) {
        console.error(TAG, "VixCloud extraction failed:", e);
      }

      // VixSrc fallback
      if (loadData.tmdbId) {
        try {
          let vixsrcUrl;
          if (loadData.type === "movie") {
            vixsrcUrl = `https://vixsrc.to/movie/${loadData.tmdbId}`;
          } else {
            vixsrcUrl = `https://vixsrc.to/tv/${loadData.tmdbId}/${loadData.season}/${loadData.episode}`;
          }
          const vResp = await fetch(vixsrcUrl, {
            headers: { Referer: "https://vixsrc.to/" },
          });
          const vHtml = await vResp.text();
          const sourceMatch = vHtml.match(
            /file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/
          ) || vHtml.match(/src\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
          if (sourceMatch) {
            streams.push(
              new StreamResult({
                url: sourceMatch[1],
                quality: "VixSrc",
                headers: { Referer: "https://vixsrc.to/" },
              })
            );
          }
        } catch (e) {
          console.error(TAG, "VixSrc extraction failed:", e);
        }
      }

      cb({ success: true, data: streams });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  // Export to SkyStream
  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
