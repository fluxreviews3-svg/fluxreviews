/* =========================================================
   FluxReviews — Dynamic Sitemap Generator
   Netlify Function: netlify/functions/sitemap.js

   Served at: /sitemap.xml  (routed via netlify.toml)

   Fetches /reviews and /ott_updates from Firebase REST API
   and builds a proper XML sitemap with every movie slug URL,
   static pages, and the OTT page.

   Requirements met:
   ✅ Fetches all reviews and ott_updates from Firebase
   ✅ Returns Content-Type: application/xml
   ✅ Includes /movie/{slug} for every review
   ✅ Falls back to generated slug if slug field is missing
   ✅ Logs Firebase errors — never silently returns homepage-only
   ✅ Includes all static pages that actually exist
   ✅ Does not conflict with any static sitemap.xml
   ✅ Does not touch /movie/* SPA routing
   ========================================================= */

const SITE_URL = "https://fluxreviews.netlify.app";
const DB_URL =
  "https://fluxreviews-default-rtdb.asia-southeast1.firebasedatabase.app";

/* ── Static pages that actually exist in the repo ──────── */
const STATIC_PAGES = [
  { path: "/",               changefreq: "daily",   priority: "1.0" },
  { path: "/about.html",     changefreq: "monthly",  priority: "0.7" },
  { path: "/ott.html",       changefreq: "daily",   priority: "0.8" },
  { path: "/upcoming.html",  changefreq: "daily",   priority: "0.8" },
  { path: "/privacy.html",   changefreq: "yearly",  priority: "0.3" },
  { path: "/terms.html",     changefreq: "yearly",  priority: "0.3" },
];

/* ── Slug generator (mirrors utils.js exactly) ──────────── */
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

/* ── Fetch from Firebase REST API ───────────────────────── */
async function fetchFirebase(path) {
  const url = `${DB_URL}${path}.json`;
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `Firebase request failed: ${res.status} ${res.statusText} — ${url} — body: ${body}`
    );
  }

  const data = await res.json();
  return data;
}

/* ── XML helpers ─────────────────────────────────────────── */
function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry({ loc, lastmod, changefreq = "weekly", priority = "0.6" }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(SITE_URL + loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

function isoDate(ts) {
  if (!ts) return null;
  try {
    return new Date(typeof ts === "number" ? ts : Date.parse(ts))
      .toISOString()
      .slice(0, 10);
  } catch {
    return null;
  }
}

/* ── Main handler ────────────────────────────────────────── */
exports.handler = async function (event, context) {
  const today = new Date().toISOString().slice(0, 10);
  const errors = [];
  let reviewEntries = [];
  let ottEntries = [];

  /* ── Fetch reviews ──────────────────────────────────────── */
  try {
    const reviews = await fetchFirebase("/reviews");

    if (reviews && typeof reviews === "object") {
      reviewEntries = Object.entries(reviews)
        .map(([id, r]) => {
          const slug =
            r.slug ||
            (r.movieName ? generateSlug(r.movieName) : null);

          if (!slug) {
            console.warn(`[sitemap] Review ${id} has no movieName — skipped`);
            return null;
          }

          return {
            loc: `/movie/${slug}`,
            lastmod: isoDate(r.createdAt) || isoDate(r.reviewDate) || today,
            changefreq: "monthly",
            priority: "0.9",
          };
        })
        .filter(Boolean);

      console.log(
        `[sitemap] Fetched ${Object.keys(reviews).length} reviews → ${reviewEntries.length} URLs`
      );
    } else {
      console.warn("[sitemap] /reviews returned null or empty — no reviews in DB yet?");
    }
  } catch (err) {
    const msg = `[sitemap] ERROR fetching /reviews: ${err.message}`;
    console.error(msg);
    errors.push(msg);
  }

  /* ── Fetch OTT updates ──────────────────────────────────── */
  try {
    const ott = await fetchFirebase("/ott_updates");

    if (ott && typeof ott === "object") {
      const count = Object.keys(ott).length;
      console.log(`[sitemap] Fetched ${count} OTT updates — represented as /ott.html`);
      /* OTT updates are all on one page (/ott.html) — already in static pages.
         We log the count so you can verify Firebase is being read correctly. */
      ottEntries = [];
    } else {
      console.warn("[sitemap] /ott_updates returned null or empty");
    }
  } catch (err) {
    const msg = `[sitemap] ERROR fetching /ott_updates: ${err.message}`;
    console.error(msg);
    errors.push(msg);
  }

  /* ── Abort if Firebase completely failed ────────────────── */
  if (errors.length === 2) {
    // Both requests failed — return 500 so it's diagnosable, not a silent fallback
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: [
        "Sitemap generation failed — Firebase requests returned errors:",
        ...errors,
        "",
        "Check Netlify Function logs for details.",
      ].join("\n"),
    };
  }

  /* ── Build XML ──────────────────────────────────────────── */
  const staticUrls = STATIC_PAGES.map((p) =>
    urlEntry({ loc: p.path, lastmod: today, changefreq: p.changefreq, priority: p.priority })
  );

  const reviewUrls = reviewEntries.map(urlEntry);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticUrls,
    ...reviewUrls,
    "</urlset>",
  ].join("\n");

  /* ── Log summary ────────────────────────────────────────── */
  const totalUrls = STATIC_PAGES.length + reviewEntries.length;
  console.log(
    `[sitemap] Generated sitemap with ${totalUrls} URLs ` +
    `(${STATIC_PAGES.length} static + ${reviewEntries.length} reviews)`
  );

  if (errors.length > 0) {
    console.warn("[sitemap] Partial errors (some data may be missing):", errors);
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
    body: xml,
  };
};
