/* =========================================================
   FluxReviews — Viewer Page Logic
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, onValue, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ---------------------------------------------------------
   🔥 FIREBASE CONFIGURATION
   Replace the values below with your own Firebase project
   credentials (Firebase Console → Project Settings → General
   → Your apps → SDK setup and configuration).
   IMPORTANT: keep this identical to the config in admin.js
   so both pages read/write the same database.
--------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyBJHgN6x3LQm3a9Y6OEyLIrlwHYBeHZsXI",
  authDomain: "fluxreviews.firebaseapp.com",
  databaseURL: "https://fluxreviews-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fluxreviews",
  storageBucket: "fluxreviews.appspot.com",
  messagingSenderId: "776993219438",
  appId: "1:776993219438:web:77a7f23d9742469db6577f"
};

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
   One-like-per-device tracking
   (the only piece of this app that uses localStorage — needed
   because Firebase has no concept of "this visitor already liked
   this," and there's no login system for anonymous viewers)
--------------------------------------------------------- */
const LIKED_KEY = "flux_liked_review_ids";

function getLikedSet() {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markAsLiked(id) {
  try {
    const set = getLikedSet();
    set.add(id);
    localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
  } catch {
    /* localStorage unavailable (private browsing etc.) — like still works, just not remembered */
  }
}

function hasLiked(id) {
  return getLikedSet().has(id);
}

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
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, type = "info") {
  const icons = { success: "✅", error: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ️"}</span><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function starRatingMarkup(rating) {
  const pct = Math.max(0, Math.min(100, (rating / 10) * 100));
  return `
    <span class="star-rating" style="--rating-pct:${pct}%">
      <span class="stars-bg">★★★★★</span>
      <span class="stars-fg">★★★★★</span>
    </span>
    <span class="rating-num">${Number(rating).toFixed(1)}/10</span>
  `;
}

function animateStarFills(scope = document) {
  requestAnimationFrame(() => {
    scope.querySelectorAll(".star-rating:not(.filled)").forEach((el) => el.classList.add("filled"));
  });
}

function truncate(text = "", len = 120) {
  if (text.length <= len) return text;
  return text.slice(0, len).trim() + "…";
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
   Like system (Firebase transaction — race-condition safe)
--------------------------------------------------------- */
function toggleLike(id, btnEl) {
  if (!id || likeInFlight.has(id)) return;

  if (hasLiked(id)) {
    showToast("You've already liked this one!", "info");
    return;
  }

  likeInFlight.add(id);

  const likesRef = ref(db, `reviews/${id}/likes`);
  runTransaction(likesRef, (current) => (current || 0) + 1)
    .then((result) => {
      btnEl.classList.add("liked", "bounce");
      setTimeout(() => btnEl.classList.remove("bounce"), 500);
      const countEl = btnEl.querySelector(".like-count");
      if (countEl && result.snapshot.exists()) countEl.textContent = result.snapshot.val();
      markAsLiked(id);
      showToast("Thanks for the like!", "success");
    })
    .catch((err) => showToast("Error: " + err.message, "error"))
    .finally(() => likeInFlight.delete(id));
}

/* ---------------------------------------------------------
   Share button
--------------------------------------------------------- */
function handleShare(r) {
  const shareUrl = `${location.origin}${location.pathname}#${r.id}`;
  const shareText = `${r.movieName} (${r.releaseYear}) — ${Number(r.rating).toFixed(1)}/10 on FluxReviews`;

  if (navigator.share) {
    navigator.share({ title: r.movieName, text: shareText, url: shareUrl }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => showToast("Link copied to clipboard!", "success"));
  } else {
    showToast(shareUrl, "info");
  }
}

/* ---------------------------------------------------------
   Grid click delegation
--------------------------------------------------------- */
viewerGrid.addEventListener("click", (e) => {
  const heartBtn = e.target.closest(".heart-btn");
  const shareBtn = e.target.closest(".share-btn");
  const genreTag = e.target.closest(".genre-tag.clickable");
  const card = e.target.closest(".movie-card");

  if (heartBtn) { toggleLike(heartBtn.dataset.id, heartBtn); return; }
  if (shareBtn) {
    const r = reviewsCache[shareBtn.dataset.id];
    if (r) handleShare({ id: shareBtn.dataset.id, ...r });
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
  $("modalHeartBtn").addEventListener("click", () => toggleLike(r.id, $("modalHeartBtn")));
  $("modalShareBtn").addEventListener("click", () => handleShare(r));
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
