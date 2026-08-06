/* =========================================================
   FluxReviews — OTT Releases Page Logic
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "/config.js";
import { escapeHtml } from "/utils.js";
import { getUpcoming, getWatchProviders, TMDB_IMG, formatReleaseDate } from "/tmdb.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ottRef = ref(db, "ott_updates");

const ottGrid = document.getElementById("ottGrid");
const ottPlatformChips = document.getElementById("ottPlatformChips");
const ottTotalCount = document.getElementById("ottTotalCount");
const ottModal = document.getElementById("ottModal");
const ottModalCard = document.getElementById("ottModalCard");

const OTT_PLATFORMS = ["Netflix", "Prime Video", "JioHotstar", "SonyLiv", "ZEE5", "Aha", "ETV Win", "Others"];
let manualOttCache = {};
let autoOttEntries = [];
let activeOttPlatform = "";

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
function platformBadgeClass(platform) {
  const map = {
    "Netflix": "platform-netflix",
    "Prime Video": "platform-prime-video",
    "JioHotstar": "platform-jiohotstar",
    "SonyLiv": "platform-sonyliv",
    "ZEE5": "platform-zee5",
    "Aha": "platform-aha",
    "ETV Win": "platform-etv-win"
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

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00") - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function releaseBadge(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return "";
  if (days < 0) return `<span class="release-badge badge-out">Streaming now</span>`;
  if (days === 0) return `<span class="release-badge badge-today">Today!</span>`;
  if (days <= 7) return `<span class="release-badge badge-soon">In ${days} day${days === 1 ? "" : "s"}</span>`;
  return "";
}

/* ---------------------------------------------------------
   Skeleton
--------------------------------------------------------- */
function skeletonCards(count = 12) {
  return Array.from({ length: count }).map(() => `
    <div class="ott-page-card ott-skeleton">
      <div class="ott-page-poster skeleton-pulse"></div>
      <div class="ott-page-body">
        <div class="skeleton-title skeleton-pulse" style="height:12px; width:85%; margin-bottom:8px;"></div>
        <div class="skeleton-meta skeleton-pulse" style="height:9px; width:50%; margin-bottom:6px;"></div>
        <div class="skeleton-snippet skeleton-pulse" style="height:9px; width:90%;"></div>
      </div>
    </div>`).join("");
}

/* ---------------------------------------------------------
   Card builder — bigger, richer, clickable
--------------------------------------------------------- */
function buildOttCard(o, index) {
  const badge = releaseBadge(o.releaseDate);
  const sourceTag = o.source === "tmdb" ? `<span class="ott-source-tag">Auto</span>` : "";
  const desc = o.description ? escapeHtml(o.description).slice(0, 120) + (o.description.length > 120 ? "…" : "") : "";

  return `
    <article class="ott-page-card" data-index="${index}" style="animation-delay:${Math.min(index * 0.04, 0.5)}s">
      <div class="ott-page-poster">
        ${o.poster ? `<img src="${escapeHtml(o.poster)}" alt="${escapeHtml(o.title)}" loading="lazy" decoding="async" onerror="this.style.display='none'" />` : `<div class="ott-no-poster">🎬</div>`}
        <div class="ott-poster-gradient"></div>
        <span class="platform-badge ${platformBadgeClass(o.platform)}">${escapeHtml(o.platform || "Others")}</span>
        ${sourceTag}
        ${badge}
      </div>
      <div class="ott-page-body">
        <div class="ott-page-title">${escapeHtml(o.title)}</div>
        <div class="ott-page-date">📅 ${formatReleaseDate(o.releaseDate)}</div>
        ${desc ? `<div class="ott-page-desc">${desc}</div>` : ""}
        <button type="button" class="ott-read-more btn btn-ghost" data-index="${index}">More info →</button>
      </div>
    </article>`;
}

/* ---------------------------------------------------------
   Modal
--------------------------------------------------------- */
let currentEntries = [];

function openOttModal(index) {
  const o = currentEntries[index];
  if (!o) return;

  ottModalCard.innerHTML = `
    <div class="modal-bg-blur" style="background-image: url('${escapeHtml(o.poster || "")}')"></div>
    <button class="modal-close" id="ottModalClose">✕</button>
    <div class="modal-scroll-inner">
      <div class="modal-poster">
        ${o.poster
          ? `<img src="${escapeHtml(o.poster)}" alt="${escapeHtml(o.title)}" loading="lazy" onerror="this.style.opacity=0" />`
          : `<div class="ott-no-poster" style="height:100%;">🎬</div>`}
      </div>
      <div class="modal-content">
        <h3 class="modal-title">${escapeHtml(o.title)}</h3>
        <div class="modal-meta-row">
          <span class="platform-badge ${platformBadgeClass(o.platform)}">${escapeHtml(o.platform || "Others")}</span>
          <span>·</span>
          <span>📅 ${formatReleaseDate(o.releaseDate)}</span>
          ${o.source === "tmdb" ? `<span>·</span><span class="ott-source-tag" style="position:static; font-size:11px;">Auto-detected</span>` : ""}
        </div>
        ${releaseBadge(o.releaseDate)
          ? `<div class="modal-section" style="margin-bottom:10px;">${releaseBadge(o.releaseDate).replace('position: absolute;', '')}</div>`
          : ""}
        <div class="modal-section">
          <div class="modal-section-label">Platform</div>
          <p style="font-size:14px; color:var(--text-primary); font-weight:600;">${escapeHtml(o.platform || "Others")}</p>
        </div>
        <div class="modal-section">
          <div class="modal-section-label">Streaming From</div>
          <p style="font-size:14px; color:var(--text-primary);">📅 ${formatReleaseDate(o.releaseDate)}</p>
        </div>
        ${o.description ? `
        <div class="modal-section">
          <div class="modal-section-label">Description</div>
          <p class="modal-review-text">${escapeHtml(o.description)}</p>
        </div>` : ""}
      </div>
    </div>`;

  ottModal.classList.add("active");
  document.getElementById("ottModalClose").addEventListener("click", closeOttModal);
}

function closeOttModal() {
  ottModal.classList.remove("active");
}

ottModal.addEventListener("click", (e) => { if (e.target === ottModal) closeOttModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOttModal(); });

/* ---------------------------------------------------------
   Render
--------------------------------------------------------- */
function renderOttSection() {
  const manual = Object.entries(manualOttCache).map(([id, o]) => ({ id, ...o, source: "manual" }));
  let combined = [...manual, ...autoOttEntries];

  if (activeOttPlatform) combined = combined.filter((o) => o.platform === activeOttPlatform);
  combined.sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));

  currentEntries = combined;
  if (ottTotalCount) ottTotalCount.textContent = combined.length;

  if (combined.length === 0) {
    ottGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="emoji">📺</div><h3>No OTT releases to show yet</h3></div>`;
    return;
  }

  ottGrid.innerHTML = combined.map((o, i) => buildOttCard(o, i)).join("");

  // Wire click events
  ottGrid.querySelectorAll(".ott-page-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".ott-read-more")) return;
      openOttModal(Number(card.dataset.index));
    });
  });
  ottGrid.querySelectorAll(".ott-read-more").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openOttModal(Number(btn.dataset.index));
    });
  });
}

/* ---------------------------------------------------------
   Platform chips
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   Data loading
--------------------------------------------------------- */
function loadAutoOttEntries() {
  return getUpcoming()
    .then((movies) =>
      Promise.all(movies.slice(0, 12).map((movie) =>
        getWatchProviders(movie.id)
          .then((res) => {
            const inRegion = res.results?.IN;
            if (!inRegion) return [];
            const providers = [...(inRegion.flatrate || []), ...(inRegion.rent || []), ...(inRegion.buy || [])];
            const seen = new Set();
            const entries = [];
            providers.forEach((p) => {
              const platform = mapProviderToPlatform(p.provider_name);
              if (seen.has(platform)) return;
              seen.add(platform);
              entries.push({
                id: `tmdb-${movie.id}-${platform}`,
                title: movie.title,
                poster: TMDB_IMG.poster(movie.poster_path, "w500"),
                platform,
                releaseDate: movie.release_date || "",
                description: movie.overview || "",
                source: "tmdb"
              });
            });
            return entries;
          })
          .catch(() => [])
      ))
    )
    .then((r) => r.flat())
    .catch(() => []);
}

function loadManualOtt() {
  onValue(ottRef, (snapshot) => {
    manualOttCache = snapshot.val() || {};
    renderOttSection();
  }, () => {});
}

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
function init() {
  renderPlatformChips();
  ottGrid.innerHTML = skeletonCards();

  loadAutoOttEntries().then((entries) => {
    autoOttEntries = entries;
    renderOttSection();
  });

  loadManualOtt();
}

if (window.AOS) AOS.init({ duration: 600, once: true, offset: 40 });
init();
