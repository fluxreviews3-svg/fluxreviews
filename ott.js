/* =========================================================
   FluxReviews — OTT Releases Page Logic
   Merges admin-entered manual updates (Firebase) with
   TMDB-auto-detected streaming availability.
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./config.js";
import { escapeHtml } from "./utils.js";
import { getUpcoming, getWatchProviders, TMDB_IMG, formatReleaseDate } from "./tmdb.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ottRef = ref(db, "ott_updates");

const ottGrid = document.getElementById("ottGrid");
const ottPlatformChips = document.getElementById("ottPlatformChips");

const OTT_PLATFORMS = ["Netflix", "Prime Video", "JioHotstar", "SonyLiv", "ZEE5", "Others"];
let manualOttCache = {};
let autoOttEntries = [];
let activeOttPlatform = "";

function skeletonCards(count = 8) {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="discover-card discover-skeleton">
        <div class="discover-poster skeleton-pulse"></div>
        <div class="discover-info">
          <div class="skeleton-title skeleton-pulse" style="height:10px; width:80%;"></div>
          <div class="skeleton-meta skeleton-pulse" style="height:8px; width:40%; margin-bottom:0;"></div>
        </div>
      </div>`
    )
    .join("");
}

function platformBadgeClass(platform) {
  const map = {
    "Netflix": "platform-netflix",
    "Prime Video": "platform-prime-video",
    "JioHotstar": "platform-jiohotstar",
    "SonyLiv": "platform-sonyliv",
    "ZEE5": "platform-zee5"
  };
  return map[platform] || "platform-others";
}

function mapProviderToPlatform(providerName = "") {
  const n = providerName.toLowerCase();
  if (n.includes("netflix")) return "Netflix";
  if (n.includes("prime video") || n.includes("amazon")) return "Prime Video";
  if (n.includes("hotstar") || n.includes("disney")) return "JioHotstar";
  if (n.includes("sonyliv") || n.includes("sony liv")) return "SonyLiv";
  if (n.includes("zee5")) return "ZEE5";
  return "Others";
}

function loadAutoOttEntries() {
  const today = new Date().toISOString().slice(0, 10);

  return getUpcoming()
    .then((movies) => {
      // Only check movies that released at least 30 days ago
      // (gives time for theatrical run before OTT)
      const ottCandidates = movies.filter((m) => {
        if (!m.release_date) return false;
        const releaseDate = new Date(m.release_date);
        const daysSinceRelease = (Date.now() - releaseDate) / (1000 * 60 * 60 * 24);
        return daysSinceRelease >= 30;
      });

      return Promise.all(
        ottCandidates.slice(0, 15).map((movie) =>
          getWatchProviders(movie.id)
            .then((res) => {
              const inRegion = res.results?.IN;
              if (!inRegion) return [];
              // Only use flatrate (actual streaming) — skip rent/buy
              const providers = [...(inRegion.flatrate || [])];
              const seenPlatforms = new Set();
              const entries = [];
              providers.forEach((p) => {
                const platform = mapProviderToPlatform(p.provider_name);
                // Skip "Others" — unreliable/unknown platforms
                if (platform === "Others") return;
                if (seenPlatforms.has(platform)) return;
                seenPlatforms.add(platform);
                entries.push({
                  id: `tmdb-${movie.id}-${platform}`,
                  title: movie.title,
                  poster: TMDB_IMG.poster(movie.poster_path, "w342"),
                  platform,
                  releaseDate: movie.release_date || "",
                  description: movie.overview || "",
                  source: "tmdb"
                });
              });
              return entries;
            })
            .catch(() => [])
        )
      ).then((results) => results.flat());
    })
    .catch(() => []);
}

function renderPlatformChips() {
  ottPlatformChips.innerHTML =
    `<button type="button" class="chip selected" data-platform="">All</button>` +
    OTT_PLATFORMS.map((p) => `<button type="button" class="chip" data-platform="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("");

  ottPlatformChips.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      ottPlatformChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      activeOttPlatform = chip.dataset.platform;
      renderOttSection();
    });
  });
}

function buildOttCard(o) {
  const sourceTag = o.source === "tmdb" ? `<span class="ott-source-tag">Auto</span>` : "";
  return `
    <article class="discover-card ott-card">
      <div class="discover-poster">
        ${o.poster ? `<img src="${escapeHtml(o.poster)}" alt="${escapeHtml(o.title)}" loading="lazy" decoding="async" onerror="this.style.display='none'" />` : ""}
        <span class="platform-badge ${platformBadgeClass(o.platform)}">${escapeHtml(o.platform || "Others")}</span>
        ${sourceTag}
      </div>
      <div class="discover-info">
        <div class="discover-title">${escapeHtml(o.title)}</div>
        <div class="discover-meta">📅 ${formatReleaseDate(o.releaseDate)}</div>
        ${o.description ? `<div class="discover-overview">${escapeHtml(o.description)}</div>` : ""}
      </div>
    </article>
  `;
}

function renderOttSection() {
  const manual = Object.entries(manualOttCache).map(([id, o]) => ({ id, ...o, source: "manual" }));
  let combined = [...manual, ...autoOttEntries];

  if (activeOttPlatform) combined = combined.filter((o) => o.platform === activeOttPlatform);
  combined.sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));

  if (combined.length === 0) {
    ottGrid.innerHTML = `<div class="empty-state"><div class="emoji">📺</div><h3>No OTT releases to show yet</h3></div>`;
    return;
  }
  ottGrid.innerHTML = combined.map(buildOttCard).join("");
}

function loadManualOtt() {
  onValue(
    ottRef,
    (snapshot) => {
      manualOttCache = snapshot.val() || {};
      renderOttSection();
    },
    () => { /* fail quietly — auto entries can still show */ }
  );
}

function init() {
  renderPlatformChips();
  ottGrid.innerHTML = skeletonCards();

  loadAutoOttEntries().then((entries) => {
    autoOttEntries = entries;
    renderOttSection();
  });

  loadManualOtt();
}

if (window.AOS) AOS.init({ duration: 700, once: true, offset: 40 });
init();
