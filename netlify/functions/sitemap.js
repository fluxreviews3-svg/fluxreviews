const SITE_URL = "https://fluxreviews.netlify.app";

const API_BASE_URL = process.env.FLUXREVIEWS_API_URL || "https://fluxreviews-backend.onrender.com";

const STATIC_PAGES = [
  { path: "/",              changefreq: "daily",   priority: "1.0" },
  { path: "/about.html",   changefreq: "monthly", priority: "0.7" },
  { path: "/ott.html",     changefreq: "daily",   priority: "0.8" },
  { path: "/upcoming.html",changefreq: "daily",   priority: "0.8" },
  { path: "/privacy.html", changefreq: "yearly",  priority: "0.3" },
  { path: "/terms.html",   changefreq: "yearly",  priority: "0.3" },
];

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

async function fetchApi(path) {
  var url = API_BASE_URL + path;
  console.log("[sitemap] fetching: " + url);
  var res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  var body = await res.text();
  console.log("[sitemap] status: " + res.status + " body length: " + body.length);
  if (!res.ok) {
    throw new Error("API " + res.status + " " + res.statusText + " body: " + body.slice(0, 300));
  }
  return JSON.parse(body);
}

exports.handler = async function (event, context) {
  try {