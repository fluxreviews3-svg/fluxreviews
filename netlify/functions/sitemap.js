const SITE_URL = "https://fluxreviews.netlify.app";

const DB_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  "https://fluxreviews-default-rtdb.asia-southeast1.firebasedatabase.app"
).replace(/\/$/, "");

const STATIC_PAGES = [
  { path: "/",              changefreq: "daily",   priority: "1.0" },
  { path: "/about.html",   changefreq: "monthly", priority: "0.7" },
  { path: "/ott.html",     changefreq: "daily",   priority: "0.8" },
  { path: "/upcoming.html",changefreq: "daily",   priority: "0.8" },
  { path: "/privacy.html", changefreq: "yearly",  priority: "0.3" },
  { path: "/terms.html",   changefreq: "yearly",  priority: "0.3" },
];

function generateSlug(title) {
  return (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-");
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(ts) {
  if (!ts) return null;
  try {
    return new Date(typeof ts === "number" ? ts : Date.parse(ts))
      .toISOString()
      .slice(0, 10);
  } catch (e) {
    return null;
  }
}

function urlEntry(loc, lastmod, changefreq, priority) {
  var lines = [
    "  <url>",
    "    <loc>" + escapeXml(SITE_URL + loc) + "</loc>",
  ];
  if (lastmod) lines.push("    <lastmod>" + lastmod + "</lastmod>");
  lines.push("    <changefreq>" + changefreq + "</changefreq>");
  lines.push("    <priority>" + priority + "</priority>");
  lines.push("  </url>");
  return lines.join("\n");
}

async function fetchFirebase(path) {
  var url = DB_URL + path + ".json";
  console.log("[sitemap] fetching: " + url);
  var res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  var body = await res.text();
  console.log("[sitemap] status: " + res.status + " body length: " + body.length);
  if (!res.ok) {
    throw new Error("Firebase " + res.status + " " + res.statusText + " body: " + body.slice(0, 300));
  }
  return JSON.parse(body);
}

exports.handler = async function (event, context) {
  try {
    console.log("[sitemap] started. DB_URL=" + DB_URL);

    var today = new Date().toISOString().slice(0, 10);
    var reviewEntries = [];
    var reviewError = null;
    var ottError = null;

    try {
      var reviews = await fetchFirebase("/reviews");
      if (reviews && typeof reviews === "object") {
        var keys = Object.keys(reviews);
        console.log("[sitemap] got " + keys.length + " reviews");
        keys.forEach(function (id) {
          var r = reviews[id];
          var slug = r.slug || (r.movieName ? generateSlug(r.movieName) : null);
          if (!slug) return;
          reviewEntries.push({
            loc: "/movie/" + slug,
            lastmod: isoDate(r.createdAt) || isoDate(r.reviewDate) || today,
            changefreq: "monthly",
            priority: "0.9",
          });
        });
      }
    } catch (e) {
      reviewError = e.message;
      console.error("[sitemap] reviews error: " + e.message);
    }

    try {
      var ott = await fetchFirebase("/ott_updates");
      if (ott && typeof ott === "object") {
        console.log("[sitemap] got " + Object.keys(ott).length + " ott_updates");
      }
    } catch (e) {
      ottError = e.message;
      console.error("[sitemap] ott_updates error: " + e.message);
    }

    if (reviewError && ottError) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain" },
        body: "Both Firebase requests failed.\nReviews error: " + reviewError + "\nOTT error: " + ottError,
      };
    }

    var parts = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

    STATIC_PAGES.forEach(function (p) {
      parts.push(urlEntry(p.path, today, p.changefreq, p.priority));
    });

    reviewEntries.forEach(function (e) {
      parts.push(urlEntry(e.loc, e.lastmod, e.changefreq, e.priority));
    });

    parts.push("</urlset>");

    var xml = parts.join("\n");
    console.log("[sitemap] done. total URLs: " + (STATIC_PAGES.length + reviewEntries.length));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
      body: xml,
    };

  } catch (err) {
    console.error("[sitemap] FATAL: " + err.message + "\n" + err.stack);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Sitemap crashed.\nName: " + (err.name || "Unknown") +
            "\nMessage: " + (err.message || String(err)) +
            "\nStack: " + (err.stack || "none"),
    };
  }
};
