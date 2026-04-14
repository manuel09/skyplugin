(function () {
  // ============================================================
  // CB01 - Italian Movies & TV Series
  // Ported from CloudStream Kotlin plugin by doGior
  // ============================================================

  const TAG = "CB01";

  function fixTitle(title, isMovie) {
    if (isMovie) return title.replace(/(\[HD] )*\(\d{4}\)$/, "").trim();
    return title
      .replace(/[-–] Stagione \d+/, "")
      .replace(/[-–] ITA/, "")
      .replace(/[-–] *\d+[x×]\d*(\/?\d*)*/, "")
      .replace(/[-–] COMPLETA/, "")
      .trim();
  }

  async function getHome(cb) {
    try {
      const data = {};

      // Movies
      try {
        const resp = await fetch(manifest.baseUrl);
        const html = await resp.text();
        const items = await nativeExtract(html, {
          posts: {
            query: ".sequex-one-columns .post",
            multiple: true,
            fields: {
              poster: { query: "img", attr: "src" },
              scriptData: { query: "script", attr: "textContent" },
            },
          },
        });

        const movies = [];
        for (const post of items.posts || []) {
          if (!post.scriptData) continue;
          try {
            const jsonStr = post.scriptData.split("=")[1]?.split(";")[0]?.trim();
            if (!jsonStr) continue;
            const obj = JSON.parse(jsonStr);
            const quality = obj.title.includes("HD") ? "HD" : undefined;
            movies.push(new MultimediaItem({
              title: fixTitle(obj.title, true),
              url: obj.permalink,
              posterUrl: post.poster,
              type: "movie",
            }));
          } catch (e) {}
        }
        if (movies.length > 0) data["Trending"] = movies;
      } catch (e) {
        console.error(TAG, "Movies failed:", e);
      }

      // TV Series
      try {
        const resp = await fetch(`${manifest.baseUrl}/serietv`);
        const html = await resp.text();
        const items = await nativeExtract(html, {
          posts: {
            query: ".sequex-one-columns .post",
            multiple: true,
            fields: {
              poster: { query: "img", attr: "src" },
              scriptData: { query: "script", attr: "textContent" },
            },
          },
        });

        const series = [];
        for (const post of items.posts || []) {
          if (!post.scriptData) continue;
          try {
            const jsonStr = post.scriptData.split("=")[1]?.split(";")[0]?.trim();
            if (!jsonStr) continue;
            const obj = JSON.parse(jsonStr);
            series.push(new MultimediaItem({
              title: fixTitle(obj.title, false),
              url: obj.permalink,
              posterUrl: post.poster,
              type: "series",
            }));
          } catch (e) {}
        }
        if (series.length > 0) data["Serie TV"] = series;
      } catch (e) {
        console.error(TAG, "Series failed:", e);
      }

      cb({ success: true, data });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function search(query, cb) {
    try {
      const searchUrls = [
        `${manifest.baseUrl}/?s=${encodeURIComponent(query)}`,
        `${manifest.baseUrl}/serietv/?s=${encodeURIComponent(query)}`,
      ];

      const results = [];
      for (const searchUrl of searchUrls) {
        try {
          const resp = await fetch(searchUrl);
          const html = await resp.text();
          const isSeries = searchUrl.includes("serietv");

          const items = await nativeExtract(html, {
            posts: {
              query: ".sequex-one-columns .post",
              multiple: true,
              fields: {
                poster: { query: "img", attr: "src" },
                scriptData: { query: "script", attr: "textContent" },
              },
            },
          });

          for (const post of items.posts || []) {
            if (!post.scriptData) continue;
            try {
              const jsonStr = post.scriptData.split("=")[1]?.split(";")[0]?.trim();
              if (!jsonStr) continue;
              const obj = JSON.parse(jsonStr);
              results.push(new MultimediaItem({
                title: fixTitle(obj.title, !isSeries),
                url: obj.permalink,
                posterUrl: post.poster,
                type: isSeries ? "series" : "movie",
              }));
            } catch (e) {}
          }
        } catch (e) {}
      }

      cb({ success: true, data: results });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const isMovie = !url.includes("serietv");

      const details = await nativeExtract(html, {
        poster: { query: "img.responsive-locandina", attr: "src", first: true },
        banner: { query: "#sequex-page-title-img", attr: "data-img", first: true },
        title: { query: "h1", attr: "textContent", first: true },
        description: { query: ".ignore-css > p:nth-child(2)", attr: "textContent", first: true },
        tags: { query: ".ignore-css > p:nth-child(1) > strong:nth-child(1)", attr: "textContent", first: true },
      });

      const title = details.title || "Sconosciuto";
      const yearMatch = title.match(/\d{4}/);

      const item = new MultimediaItem({
        title: fixTitle(title, isMovie),
        url: url,
        posterUrl: details.poster,
        bannerUrl: details.banner,
        type: isMovie ? "movie" : "series",
        year: yearMatch ? parseInt(yearMatch[0]) : undefined,
        description: details.description
          ? details.description.replace("+Info »", "").trim()
          : "",
      });

      if (isMovie) {
        // Extract movie links
        const linkData = await nativeExtract(html, {
          links: {
            query: "table.cbtable > tbody > tr:first-child > td:first-child a",
            multiple: true,
            fields: {
              text: { attr: "textContent" },
              href: { attr: "href" },
            },
          },
        });

        const movieLinks = (linkData.links || [])
          .filter((l) => l.text === "Maxstream" || l.text === "Mixdrop")
          .map((l) => l.href);

        item.url = JSON.stringify(movieLinks);
      } else {
        // Extract TV episodes
        const epData = await nativeExtract(html, {
          seasons: {
            query: ".sp-wrap",
            multiple: true,
            fields: {
              seasonName: { query: "div.sp-head", attr: "textContent" },
              episodes: {
                query: "div.sp-body strong p",
                multiple: true,
                fields: {
                  name: { attr: "textContent" },
                  links: { query: "a", multiple: true, attr: "href" },
                },
              },
            },
          },
        });

        item.episodes = [];
        let globalEpNum = 0;

        for (const season of epData.seasons || []) {
          const seasonMatch = season.seasonName?.match(/\d+/);
          const seasonNum = seasonMatch ? parseInt(seasonMatch[0]) : 1;

          for (const ep of season.episodes || []) {
            globalEpNum++;
            const epName = ep.name?.split("–")[0]?.trim() || `Episodio ${globalEpNum}`;
            const epLinks = (ep.links || []).filter(
              (l) => l.includes("uprot") || l.includes("stayonline") || l.includes("maxstream")
            );

            if (epLinks.length > 0) {
              item.episodes.push(new Episode({
                name: epName,
                url: JSON.stringify(epLinks),
                season: seasonNum,
                episode: globalEpNum,
              }));
            }
          }
        }
      }

      cb({ success: true, data: item });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function loadStreams(url, cb) {
    try {
      const links = JSON.parse(url);
      const streams = [];

      for (const link of links) {
        if (!link) continue;
        try {
          // MaxStream extractor
          if (link.includes("maxstream") || link.includes("uprot") || link.includes("stayonline")) {
            let actualLink = link;

            // Bypass short links
            if (link.includes("uprot") || link.includes("stayonline")) {
              try {
                const shortResp = await fetch(link, { redirect: "follow" });
                actualLink = shortResp.url || link;
              } catch (e) {
                continue;
              }
            }

            const resp = await fetch(actualLink);
            const html = await resp.text();
            const srcMatch = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/) ||
              html.match(/file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);

            if (srcMatch) {
              streams.push(new StreamResult({
                url: srcMatch[1],
                quality: "MaxStream",
              }));
            }
          }

          // MixDrop extractor
          if (link.includes("mixdrop")) {
            const resp = await fetch(link);
            const html = await resp.text();
            const srcMatch = html.match(/wurl\s*=\s*['"]([^'"]+)['"]/);
            if (srcMatch) {
              let videoUrl = srcMatch[1];
              if (videoUrl.startsWith("//")) videoUrl = "https:" + videoUrl;
              streams.push(new StreamResult({
                url: videoUrl,
                quality: "MixDrop",
              }));
            }
          }
        } catch (e) {
          console.error(TAG, "Extractor failed:", e);
        }
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
