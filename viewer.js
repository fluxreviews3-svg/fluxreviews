/* =========================================================
   FluxReviews — Viewer Page Logic
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./config.js";
import {
  escapeHtml, truncate, starRatingMarkup, animateStarFills, hasLiked, toggleLike, handleShare
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
      maybeOpenFromHash();
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

  viewerGrid.innerHTML = arr.map((r, i) => buildCard(r, i)).join("");
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
          <span>📝 Reviewed ${escapeHtml(r.reviewDate || "")}</span>
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
  history.replaceState(null, "", `#${id}`);

  $("closeDetailBtn").addEventListener("click", closeDetailModal);
  $("modalHeartBtn").addEventListener("click", () => toggleLike(r.id, $("modalHeartBtn"), db, showToast));
  $("modalShareBtn").addEventListener("click", () => handleShare(r, showToast));
  detailModalCard.querySelectorAll(".genre-tag.clickable").forEach((tag) => {
    tag.addEventListener("click", () => filterByGenre(tag.dataset.genre));
  });
}

function closeDetailModal() {
  detailModal.classList.remove("active");
  history.replaceState(null, "", location.pathname);
}

detailModal.addEventListener("click", (e) => { if (e.target === detailModal) closeDetailModal(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetailModal();
});

function maybeOpenFromHash() {
  const id = location.hash.replace("#", "");
  if (id && reviewsCache[id] && !detailModal.classList.contains("active")) {
    openDetailModal(id);
  }
}

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
renderGenreFilterOptions();
loadReviews();
