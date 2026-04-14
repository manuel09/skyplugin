(function () {
  // ============================================================
  // AltaDefinizione - Italian Movies & TV Series
  // Ported from CloudStream Kotlin plugin by doGior
  // ============================================================

  const TAG = "AltaDefinizione";

  const categories = {
    "Ultimi Aggiunti": "/film/",
    "Ora al Cinema": "/cinema/",
    Netflix: "/netflix-streaming/",
    Animazione: "/animazione/",
    Avventura: "/avventura/",
    Azione: "/azione/",
    Commedia: "/commedia/",
    Crimine: "/crime/",
    Documentario: "/documentario/",
    Drammatico: "/drammatico/",
    Famiglia: "/famiglia/",
    Fantascienza: "/fantascienza/",
    Fantasy: "/fantasy/",
    Horror: "/horror/",
    Romantico: "/romantico/",
    Thriller: "/thriller/",
  };

  function fixUrl(url) {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    if (url.startsWith("//")) return "https:" + url;
    return manifest.baseUrl + url;
  }

  async function getHome(cb) {
    try {
      const data = {};

      for (const [catName, catPath] of Object.entries(categories)) {
        try {
          const url = `${manifest.baseUrl}${catPath}page/1/`;
          const resp = await fetch(url);
          const html = await resp.text();

          const items = await nativeExtract(html, {
            movies: {
              query: "#dle-content > div > div.movie",
              multiple: true,
              fields: {
                title: { query: "h2.movie-title > a", attr: "textContent" },
                href: { query: "a", attr: "href" },
                poster: { query: "img", attr: "data-src" },
                posterFallback: { query: "img", attr: "src" },
                rating: { query: "div.imdb-rate", attr: "textContent" },
              },
            },
          });

          if (items.movies && items.movies.length > 0) {
            const categoryName =
              catName === "Ultimi Aggiunti" ? "Trending" : catName;
            data[categoryName] = items.movies
              .filter((m) => m.title && m.href)
              .map(
                (m) =>
                  new MultimediaItem({
                    title: m.title.trim(),
                    url: m.href,
                    posterUrl: fixUrl(m.poster || m.posterFallback),
                    type: "movie",
                    score: m.rating
                      ? parseFloat(m.rating.trim())
                      : undefined,
                  })
              );
          }
        } catch (e) {
          console.error(TAG, `Category ${catName} failed:`, e);
        }

        // Only fetch first 4 categories for home page performance
        if (Object.keys(data).length >= 5) break;
      }

      cb({ success: true, data });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function search(query, cb) {
    try {
      const resp = await fetch(manifest.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `story=${encodeURIComponent(query)}&do=search&subaction=search`,
      });
      const html = await resp.text();

      const items = await nativeExtract(html, {
        movies: {
          query: "#dle-content > div.col div.movie",
          multiple: true,
          fields: {
            title: { query: "h2.movie-title > a", attr: "textContent" },
            href: { query: "a", attr: "href" },
            poster: { query: "img", attr: "data-src" },
            posterFallback: { query: "img", attr: "src" },
            rating: { query: "div.imdb-rate", attr: "textContent" },
          },
        },
      });

      const results = (items.movies || [])
        .filter((m) => m.title && m.href)
        .map(
          (m) =>
            new MultimediaItem({
              title: m.title.trim(),
              url: m.href,
              posterUrl: fixUrl(m.poster || m.posterFallback),
              type: m.href.includes("/serie-tv/") ? "series" : "movie",
              score: m.rating ? parseFloat(m.rating.trim()) : undefined,
            })
        );

      cb({ success: true, data: results });
    } catch (e) {
      cb({ success: false, error: e.message });
    }
  }

  async function load(url, cb) {
    try {
      const resp = await fetch(url);
      const html = await resp.text();

      const details = await nativeExtract(html, {
        title: {
          query: "h1.movie_entry-title",
          attr: "textContent",
          first: true,
        },
        poster: { query: "#movie-details img", attr: "data-src", first: true },
        plot: {
          query: "div.movie_entry-plot",
          attr: "textContent",
          first: true,
        },
        rating: { query: "span.label.imdb", attr: "textContent", first: true },
        genres: {
          query: "div.movie_entry-details a",
          multiple: true,
          attr: "textContent",
        },
        iframeSrc: { query: "iframe", attr: "src", first: true },
      });

      const isSeries = url.includes("/serie-tv/");
      const titleText = details.title
        ? details.title.trim()
        : "Sconosciuto";

      const item = new MultimediaItem({
        title: titleText,
        url: url,
        posterUrl: fixUrl(details.poster),
        type: isSeries ? "series" : "movie",
        description: details.plot
          ? details.plot.replace("...", "").replace("Leggi tutto", "").trim()
          : "",
        score: details.rating ? parseFloat(details.rating) : undefined,
      });

      if (isSeries) {
        // Parse episodes from series-select
        const epData = await nativeExtract(html, {
          episodes: {
            query: "div.series-select div.dropdown.mirrors",
            multiple: true,
            fields: {
              season: { attr: "data-season" },
              episode: { attr: "data-episode" },
              links: {
                query: "span[data-link]",
                multiple: true,
                attr: "data-link",
              },
            },
          },
        });

        item.episodes = (epData.episodes || []).map((ep) => {
          const epNum = ep.episode
            ? parseInt(ep.episode.split("-").pop())
            : undefined;
          return new Episode({
            name: `S${ep.season || 1}E${epNum || "?"}`,
            url: JSON.stringify(ep.links || []),
            season: parseInt(ep.season) || 1,
            episode: epNum || 1,
          });
        });
      } else {
        // Movie - get mirrors from mostraguarda iframe
        if (details.iframeSrc) {
          try {
            const mResp = await fetch(details.iframeSrc);
            const mHtml = await mResp.text();
            const mirrorData = await nativeExtract(mHtml, {
              mirrors: {
                query: "ul._player-mirrors > li",
                multiple: true,
                attr: "data-link",
              },
            });
            const links = (mirrorData.mirrors || []).filter(
              (l) => l && !l.includes("mostraguarda")
            );
            item.url = JSON.stringify(links);
          } catch (e) {
            item.url = JSON.stringify([]);
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
          if (link.includes("dropload")) {
            // Dropload extractor
            const resp = await fetch(link);
            const html = await resp.text();
            const sourceMatch = html.match(
              /sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/
            );
            if (sourceMatch) {
              streams.push(
                new StreamResult({
                  url: sourceMatch[1],
                  quality: "Dropload",
                })
              );
            }
          } else {
            // Generic extractor - look for video source
            const resp = await fetch(link);
            const html = await resp.text();
            const sourceMatch =
              html.match(
                /file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/
              ) ||
              html.match(
                /src\s*:\s*['"]([^'"]+\.mp4[^'"]*)['"]/
              ) ||
              html.match(
                /source\s+src=['"]([^'"]+)['"]/
              );
            if (sourceMatch) {
              streams.push(
                new StreamResult({
                  url: sourceMatch[1],
                  quality: "Auto",
                })
              );
            }
          }
        } catch (e) {
          console.error(TAG, "Extractor failed for:", link, e);
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
