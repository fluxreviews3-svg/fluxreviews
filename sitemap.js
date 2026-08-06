/**
 * FluxReviews — Dynamic Sitemap Generator
 * Netlify Function: netlify/functions/sitemap.js
 *
 * Runs every time /sitemap.xml is requested.
 * Fetches live data from Firebase REST API (no SDK needed — reads are public)
 * and returns a complete, up-to-date sitemap.xml.
 *
 * No rebuilds needed. New reviews appear in the sitemap the moment
 * they are published through the admin panel.
 */

const SITE_URL = "https://fluxreviews.netlify.app";
const DB_URL = "https://fluxreviews-default-rtdb.asia-southeast1.firebasedatabase.app";

/* -------------------------------------------------------
   Fetch data from Firebase REST API
   (appending .json to any path returns that node as JSON)
------------------------------------------------------- */
async function fetchFromFirebase(path) {
  const url = `${DB_URL}${path}.json?shallow=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firebase fetch failed: ${res.status} ${path}`);
  return res.json();
}

/* -------------------------------------------------------
   Slug helper — mirrors generateSlug() in utils.js
   so URL generation is consistent
------------------------------------------------------- */
function generateSlug(title = "") {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-");
}

/* -------------------------------------------------------
   Format a timestamp or YYYY-MM-DD string to ISO date
------------------------------------------------------- */
function toISODate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  // Firebase createdAt is a Unix ms timestamp
  if (typeof value === "number") {
    return new Date(value).toISOString().slice(0, 10);
  }
  // reviewDate is already YYYY-MM-DD
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

/* -------------------------------------------------------
   Build one <url> block
------------------------------------------------------- */
function urlEntry(loc, lastmod, changefreq = "weekly", priority = "0.8") {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/* -------------------------------------------------------
   Main handler
------------------------------------------------------- */
exports.handler = async function () {
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Fetch reviews and OTT updates in parallel
    const [reviews, ottUpdates] = await Promise.all([
      fetchFromFirebase("/reviews").catch(() => null),
      fetchFromFirebase("/ott_updates").catch(() => null),
    ]);

    let entries = "";

    /* --- Static pages --- */
    entries += urlEntry(`${SITE_URL}/`,             today,     "daily",   "1.0");
    entries += urlEntry(`${SITE_URL}/about.html`,   today,     "monthly", "0.7");
    entries += urlEntry(`${SITE_URL}/ott.html`,     today,     "daily",   "0.8");
    entries += urlEntry(`${SITE_URL}/upcoming.html`,today,     "daily",   "0.8");
    entries += urlEntry(`${SITE_URL}/privacy.html`, today,     "yearly",  "0.3");
    entries += urlEntry(`${SITE_URL}/terms.html`,   today,     "yearly",  "0.3");

    /* --- Movie review pages --- */
    if (reviews && typeof reviews === "object") {
      for (const [id, review] of Object.entries(reviews)) {
        if (!review || !review.movieName) continue;

        // Use stored slug if available, otherwise generate from title
        const slug = review.slug || generateSlug(review.movieName);
        if (!slug) continue;

        const lastmod = toISODate(review.reviewDate || review.createdAt);
        entries += urlEntry(
          `${SITE_URL}/movie/${encodeURIComponent(slug)}`,
          lastmod,
          "monthly",
          "0.9"
        );
      }
    }

    /* --- OTT update pages --- */
    // OTT entries live on /ott.html (one page, filtered by entry)
    // We include individual OTT entries as additional signals for Google
    if (ottUpdates && typeof ottUpdates === "object") {
      for (const [, ott] of Object.entries(ottUpdates)) {
        if (!ott || !ott.title) continue;
        const lastmod = toISODate(ott.releaseDate || ott.createdAt);
        // OTT entries route to the OTT page — include as alternate signals
        entries += urlEntry(
          `${SITE_URL}/ott.html`,
          lastmod,
          "weekly",
          "0.7"
        );
      }
    }

    // Deduplicate /ott.html entries (multiple OTT items would repeat it)
    const seen = new Set();
    const deduped = entries
      .split("\n  <url>")
      .filter((block) => {
        const locMatch = block.match(/<loc>(.*?)<\/loc>/);
        if (!locMatch) return true;
        const loc = locMatch[1];
        if (seen.has(loc)) return false;
        seen.add(loc);
        return true;
      })
      .join("\n  <url>");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  ${deduped.trim()}
</urlset>`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Cache for 1 hour — fresh enough for Google, light on function calls
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
      body: xml,
    };
  } catch (err) {
    // On error return a minimal valid sitemap so Google doesn't get a 500
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: fallback,
    };
  }
};
