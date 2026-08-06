/* =========================================================
   FluxReviews — Viewer Page Logic
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./config.js";
import {
  escapeHtml, truncate, starRatingMarkup, animateStarFills,
  hasLiked, toggleLike, handleShare, generateSlug
} from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const reviewsRef = ref(db, "reviews");

/* ---------------------------------------------------------
   Constants
--------------------------------------------------------- */
const GENRES = [
  "Action","Adventure","Animation","Anime","Biography","Comedy","Crime",
  "Documentary","Drama","Family","Fantasy","Film-Noir","History","Horror",
  "Music","Musical","Mystery","Psychological Thriller","Romance","Sci-Fi",
  "Sport","Superhero","Suspense","Thriller","War","Western","Cyberpunk",
  "Dark Comedy","Slice of Life","Coming of Age"
];

/* ---------------------------------------------------------
   State
--------------------------------------------------------- */
let reviewsCache = {};
let likeInFlight = new Set();



/* ---------------------------------------------------------
   DOM refs
--------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const viewerGrid = $("viewerGrid");
const searchInput = $("searchInput");
const genreFilter = $("genreFilter");
const sortSelect = $("sortSelect");

const statTotal = $("statTotal");
const statGenres = $("statGenres");
const statAvg = $("statAvg");

const detailModal = $("detailModal");
const detailModalCard = $("detailModalCard");
const toastContainer = $("toastContainer");

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
function showToast(message, type = "info") {
  const icons = { success: "✅", error: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ️"}</span><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ---------------------------------------------------------
   Genre filter dropdown
--------------------------------------------------------- */
function renderGenreFilterOptions() {
  const options = GENRES.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  genreFilter.innerHTML = `<option value="">All Genres</option>${options}`;
}

/* ---------------------------------------------------------
   Realtime listener
--------------------------------------------------------- */
function loadReviews() {
  onValue(
    reviewsRef,
    (snapshot) => {
      reviewsCache = snapshot.val() || {};
      updateStats();
      renderGrid();
      backfillMissingSlugs();
      resolvePageUrl();
    },
    (error) => showToast("Failed to load reviews: " + error.message, "error")
  );
}

function updateStats() {
  const arr = Object.values(reviewsCache);
  statTotal.textContent = arr.length;

  const genreSet = new Set();
  arr.forEach((r) => (r.genres || []).forEach((g) => genreSet.add(g)));
  statGenres.textContent = genreSet.size;

  const avg = arr.length ? arr.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / arr.length : 0;
  statAvg.textContent = avg.toFixed(1);
}

/* ---------------------------------------------------------
   Filtering / sorting
--------------------------------------------------------- */
function getFilteredSortedReviews() {
  let arr = Object.entries(reviewsCache).map(([id, r]) => ({ id, ...r }));

  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    arr = arr.filter(
      (r) =>
        (r.movieName || "").toLowerCase().includes(q) ||
        (r.cast || []).some((c) => c.toLowerCase().includes(q)) ||
        (r.genres || []).some((g) => g.toLowerCase().includes(q))
    );
  }

  const genreVal = genreFilter.value;
  if (genreVal) arr = arr.filter((r) => (r.genres || []).includes(genreVal));

  switch (sortSelect.value) {
    case "newest": arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
    case "rating-high": arr.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    case "rating-low": arr.sort((a, b) => (a.rating || 0) - (b.rating || 0)); break;
    case "most-liked": arr.sort((a, b) => (b.likes || 0) - (a.likes || 0)); break;
    case "name-az": arr.sort((a, b) => (a.movieName || "").localeCompare(b.movieName || "")); break;
    case "year-new": arr.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0)); break;
    case "year-old": arr.sort((a, b) => (a.releaseYear || 0) - (b.releaseYear || 0)); break;
  }

  return arr;
}

/* ---------------------------------------------------------
   Card rendering
--------------------------------------------------------- */
function buildCard(r, index) {
  const genreTags = (r.genres || [])
    .slice(0, 3)
    .map((g) => `<span class="genre-tag clickable" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</span>`)
    .join("");
  const extra = (r.genres || []).length > 3 ? `<span class="genre-tag">+${r.genres.length - 3}</span>` : "";
  const likedClass = hasLiked(r.id) ? "liked" : "";

  return `
    <article class="movie-card" data-id="${r.id}" style="animation-delay:${Math.min(index * 0.04, 0.4)}s">
      <div class="poster-wrap">
        <img src="${escapeHtml(r.poster)}" alt="${escapeHtml(r.movieName)} poster" loading="lazy" decoding="async"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="poster-fallback" style="display:none;">🎬<br>${escapeHtml(r.movieName)}</div>
        <div class="poster-gradient"></div>
        <div class="card-rating-badge">⭐ ${Number(r.rating).toFixed(1)}</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(r.movieName)}</div>
          <div class="card-meta"><span>${r.releaseYear || "—"}</span><span class="dot"></span><span>${escapeHtml((r.cast || [])[0] || "")}</span></div>
          <div class="card-genres">${genreTags}${extra}</div>
          <div class="card-snippet">${escapeHtml(truncate(r.reviewText || "", 100))}</div>
          <div class="card-footer">
            <button type="button" class="heart-btn ${likedClass}" data-id="${r.id}" title="Like this review">
              <span class="heart-icon">❤️</span><span class="like-count">${r.likes || 0}</span>
            </button>
            <button type="button" class="share-btn" data-id="${r.id}" title="Share">
              🔗 Share
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

const AD_EVERY_N_CARDS = 10; // injects an ad after every 2 rows (~5 cards/row on desktop)
const ADSENSE_PUB = "ca-pub-4625904588019368";
const ADSENSE_SLOT = "9083552590"; // replace with your slot ID from AdSense dashboard

function buildAdSlot(index) {
  return `
    <div class="ad-slot-wrap" aria-label="Advertisement">
      <span class="ad-slot-label">Advertisement</span>
      <ins class="adsbygoogle ad-slot-ins"
        data-ad-client="${ADSENSE_PUB}"
        data-ad-slot="${ADSENSE_SLOT}"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    </div>`;
}

function renderGrid() {
  const arr = getFilteredSortedReviews();

  if (arr.length === 0) {
    viewerGrid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🍿</div>
        <h3>No reviews match your search</h3>
        <p>Try a different keyword, genre, or sort order.</p>
      </div>`;
    return;
  }

  let html = "";
  arr.forEach((r, i) => {
    html += buildCard(r, i);
    // inject ad after every AD_EVERY_N_CARDS cards (but not after the last card)
    if ((i + 1) % AD_EVERY_N_CARDS === 0 && i < arr.length - 1) {
      html += buildAdSlot(i);
    }
  });
  viewerGrid.innerHTML = html;

  // tell AdSense to fill the newly injected ad slots
  if (window.adsbygoogle) {
    viewerGrid.querySelectorAll(".adsbygoogle:not([data-adsbygoogle-status])").forEach(() => {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }
}

searchInput.addEventListener("input", debounce(renderGrid, 200));
genreFilter.addEventListener("change", renderGrid);
sortSelect.addEventListener("change", renderGrid);

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}



/* ---------------------------------------------------------
   Grid click delegation
--------------------------------------------------------- */
viewerGrid.addEventListener("click", (e) => {
  const heartBtn = e.target.closest(".heart-btn");
  const shareBtn = e.target.closest(".share-btn");
  const genreTag = e.target.closest(".genre-tag.clickable");
  const card = e.target.closest(".movie-card");

  if (heartBtn) { toggleLike(heartBtn.dataset.id, heartBtn, db, showToast); return; }
  if (shareBtn) {
    const r = reviewsCache[shareBtn.dataset.id];
    if (r) handleShare({ id: shareBtn.dataset.id, ...r }, showToast);
    return;
  }
  if (genreTag) { e.stopPropagation(); filterByGenre(genreTag.dataset.genre); return; }
  if (card) openDetailModal(card.dataset.id);
});

/* ---------------------------------------------------------
   Click a genre anywhere → jump back to the grid filtered to it
--------------------------------------------------------- */
function filterByGenre(genre) {
  closeDetailModal();
  genreFilter.value = genre;
  searchInput.value = "";
  renderGrid();
  showToast(`Showing ${genre} reviews`, "info");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------------------------------------------------
   Detail modal
--------------------------------------------------------- */
function openDetailModal(id) {
  const r = reviewsCache[id] ? { id, ...reviewsCache[id] } : null;
  if (!r) return;

  const genres = (r.genres || [])
    .map((g) => `<span class="genre-tag clickable" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</span>`)
    .join("");
  const cast = (r.cast || []).map((c) => `<span class="cast-tag">${escapeHtml(c)}</span>`).join("");
  const likedClass = hasLiked(r.id) ? "liked" : "";

  detailModalCard.innerHTML = `
    <div class="modal-bg-blur" style="background-image: url('${escapeHtml(r.poster)}')"></div>
    <button class="modal-close" id="closeDetailBtn">✕</button>
    <div class="modal-scroll-inner">
      <div class="modal-poster">
        <img src="${escapeHtml(r.poster)}" alt="${escapeHtml(r.movieName)} poster" loading="lazy" decoding="async" onerror="this.style.opacity=0" />
      </div>
      <div class="modal-content">
        <h3 class="modal-title">${escapeHtml(r.movieName)}</h3>
        <div class="modal-meta-row">
          <span>📅 ${r.releaseYear || "—"}</span><span>·</span>
          <span>📝 Reviewed ${escapeHtml(r.reviewDate || "")}</span><span>·</span>
          <span>✍️ FluxReviews Team</span>
        </div>
        <div class="modal-section">
          <div class="modal-section-label">Rating</div>
          ${starRatingMarkup(r.rating || 0)}
        </div>
        <div class="modal-section">
          <div class="modal-section-label">Genres <span style="font-weight:400; color:var(--text-muted);">(tap to browse)</span></div>
          <div class="modal-genres">${genres}</div>
        </div>
        <div class="modal-section">
          <div class="modal-section-label">Cast</div>
          <div class="modal-genres">${cast}</div>
        </div>
        ${r.overview ? `
        <div class="modal-section">
          <div class="modal-section-label">Synopsis</div>
          <p class="modal-review-text">${escapeHtml(r.overview)}</p>
        </div>` : ""}
        <div class="modal-section">
          <div class="modal-section-label">Full Review</div>
          <p class="modal-review-text">${escapeHtml(r.reviewText || "")}</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="heart-btn ${likedClass}" id="modalHeartBtn" data-id="${r.id}">
            <span class="heart-icon">❤️</span><span class="like-count">${r.likes || 0}</span> Like
          </button>
          <button type="button" class="share-btn" id="modalShareBtn" data-id="${r.id}">🔗 Share this review</button>
        </div>
      </div>
    </div>
  `;

  detailModal.classList.add("active");
  animateStarFills(detailModalCard);

  // Use slug for the URL if available, fall back to the Firebase key
  const urlSlug = r.slug || id;
  history.replaceState({ reviewId: id }, r.movieName || "", `/movie/${urlSlug}`);

  $("closeDetailBtn").addEventListener("click", closeDetailModal);
  $("modalHeartBtn").addEventListener("click", () => toggleLike(r.id, $("modalHeartBtn"), db, showToast));
  $("modalShareBtn").addEventListener("click", () => handleShare(r, showToast));
  detailModalCard.querySelectorAll(".genre-tag.clickable").forEach((tag) => {
    tag.addEventListener("click", () => filterByGenre(tag.dataset.genre));
  });
}

function closeDetailModal() {
  detailModal.classList.remove("active");
  history.replaceState(null, "", "/");
}

detailModal.addEventListener("click", (e) => { if (e.target === detailModal) closeDetailModal(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetailModal();
});

/* ---------------------------------------------------------
   Slug backfill — auto-generate slugs for old reviews that
   don't have one yet, and save them back to Firebase.
   Runs silently once after reviews load.
--------------------------------------------------------- */
function backfillMissingSlugs() {
  const entries = Object.entries(reviewsCache).filter(([, r]) => !r.slug && r.movieName);
  if (!entries.length) return;

  entries.forEach(([id, r]) => {
    const slug = generateSlug(r.movieName);
    update(ref(db, `reviews/${id}`), { slug })
      .then(() => { reviewsCache[id].slug = slug; })
      .catch(() => { /* silent — backfill is best-effort */ });
  });
}

/* ---------------------------------------------------------
   URL resolver — handles three URL shapes:
   1. /movie/hrudhayam-murali  (new slug format)
   2. /movie/-OxAqiC2s9luPMmMr4A0  (Firebase key via slug path)
   3. /#-OxAqiC2s9luPMmMr4A0  (legacy hash format — still works)
--------------------------------------------------------- */
function resolvePageUrl() {
  if (detailModal.classList.contains("active")) return;

  const path = location.pathname;          // e.g. /movie/hrudhayam-murali
  const hash = location.hash.replace("#", ""); // e.g. -OxAqiC2s9...

  // Shape 1 & 2 — /movie/{slugOrKey}
  const moviePathMatch = path.match(/^\/movie\/(.+)$/);
  if (moviePathMatch) {
    const slugOrKey = decodeURIComponent(moviePathMatch[1]);

    // First try: exact Firebase key match
    if (reviewsCache[slugOrKey]) {
      openDetailModal(slugOrKey);
      return;
    }

    // Second try: match by slug field
    const bySlug = Object.entries(reviewsCache).find(([, r]) => r.slug === slugOrKey);
    if (bySlug) {
      openDetailModal(bySlug[0]);
      return;
    }

    // Third try: slug might match a generated slug from the title
    const byGenerated = Object.entries(reviewsCache).find(
      ([, r]) => r.movieName && generateSlug(r.movieName) === slugOrKey
    );
    if (byGenerated) {
      openDetailModal(byGenerated[0]);
      return;
    }
    return; // not found — just show the grid
  }

  // Shape 3 — legacy #key hash (old shared links still work)
  if (hash && reviewsCache[hash]) {
    openDetailModal(hash);
  }
}

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
renderGenreFilterOptions();
loadReviews();
