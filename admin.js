/* =========================================================
   FluxReviews — Admin Dashboard Logic
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, push, set, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ---------------------------------------------------------
   🔥 FIREBASE CONFIGURATION
   Replace the values below with your own Firebase project
   credentials (Firebase Console → Project Settings → General
   → Your apps → SDK setup and configuration).
   IMPORTANT: keep this identical to the config in viewer.js
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
const auth = getAuth(app);
const reviewsRef = ref(db, "reviews");

/* ---------------------------------------------------------
   🎬 TMDB CONFIGURATION
   Get a free "API Key (v3 auth)" from:
   https://www.themoviedb.org/settings/api
--------------------------------------------------------- */
const TMDB_API_KEY = "d7373cd851ba19a21a9adacc706be25a";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w780"; // HD poster size
const TMDB_THUMB_BASE = "https://image.tmdb.org/t/p/w92"; // small thumb for result list

// TMDB genre names that differ from our local genre list
const TMDB_GENRE_MAP = { "Science Fiction": "Sci-Fi" };

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
let selectedGenres = new Set();
let editingId = null;
let pendingDeleteId = null;
let reviewsListenerAttached = false;

/* ---------------------------------------------------------
   DOM refs
--------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const authGate = $("authGate");
const adminApp = $("adminApp");
const loginForm = $("loginForm");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const loginError = $("loginError");
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");

const formTitle = $("formTitle");
const reviewForm = $("reviewForm");
const reviewIdInput = $("reviewId");
const tmdbSearchInput = $("tmdbSearchInput");
const tmdbSearchBtn = $("tmdbSearchBtn");
const tmdbResults = $("tmdbResults");
const movieNameInput = $("movieName");
const posterUrlInput = $("posterUrl");
const posterPreview = $("posterPreview");
const genreCloud = $("genreCloud");
const castInput = $("castInput");
const castPreview = $("castPreview");
const releaseYearInput = $("releaseYear");
const reviewDateInput = $("reviewDate");
const ratingRange = $("ratingRange");
const ratingValueLabel = $("ratingValueLabel");
const movieOverviewInput = $("movieOverview");
const reviewTextInput = $("reviewText");
const submitBtn = $("submitBtn");
const cancelEditBtn = $("cancelEditBtn");

const adminGrid = $("adminGrid");
const reviewCount = $("reviewCount");
const searchInput = $("searchInput");
const genreFilter = $("genreFilter");
const sortSelect = $("sortSelect");

const detailModal = $("detailModal");
const detailModalCard = $("detailModalCard");
const confirmModal = $("confirmModal");
const confirmCancelBtn = $("confirmCancelBtn");
const confirmDeleteBtn = $("confirmDeleteBtn");

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

function truncate(text = "", len = 130) {
  if (text.length <= len) return text;
  return text.slice(0, len).trim() + "…";
}

/* ---------------------------------------------------------
   Firebase CRUD functions
--------------------------------------------------------- */
function saveReview(data) {
  const newRef = push(reviewsRef);
  return set(newRef, { ...data, likes: 0, createdAt: Date.now() });
}

function updateReview(id, data) {
  return update(ref(db, `reviews/${id}`), data);
}

function deleteReview(id) {
  return remove(ref(db, `reviews/${id}`));
}

function loadReviews() {
  onValue(
    reviewsRef,
    (snapshot) => {
      reviewsCache = snapshot.val() || {};
      reviewCount.textContent = Object.keys(reviewsCache).length;
      renderList();
    },
    (error) => showToast("Failed to load reviews: " + error.message, "error")
  );
}

/* ---------------------------------------------------------
   Genre chip cloud (form) + filter dropdown (toolbar)
--------------------------------------------------------- */
function renderGenreCloud() {
  genreCloud.innerHTML = GENRES.map(
    (g) => `<button type="button" class="chip" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`
  ).join("");

  genreCloud.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const g = chip.dataset.genre;
      if (selectedGenres.has(g)) {
        selectedGenres.delete(g);
        chip.classList.remove("selected");
      } else {
        selectedGenres.add(g);
        chip.classList.add("selected");
      }
    });
  });
}

function syncGenreCloudSelection() {
  genreCloud.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("selected", selectedGenres.has(chip.dataset.genre));
  });
}

function renderGenreFilterOptions() {
  const options = GENRES.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  genreFilter.innerHTML = `<option value="">All Genres</option>${options}`;
}

/* ---------------------------------------------------------
   Form field live previews
--------------------------------------------------------- */
posterUrlInput.addEventListener("input", () => {
  const url = posterUrlInput.value.trim();
  if (!url) {
    posterPreview.innerHTML = "No image";
    return;
  }
  posterPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Poster preview" onerror="this.parentElement.innerHTML='Image failed to load'" />`;
});

castInput.addEventListener("input", renderCastPreview);

function getCastArray() {
  return castInput.value.split(",").map((s) => s.trim()).filter(Boolean);
}

function renderCastPreview() {
  const names = getCastArray();
  castPreview.innerHTML = names.map((n) => `<span class="cast-tag">${escapeHtml(n)}</span>`).join("");
}

ratingRange.addEventListener("input", () => {
  ratingValueLabel.textContent = Number(ratingRange.value).toFixed(1);
});

/* ---------------------------------------------------------
   TMDB auto-fill
--------------------------------------------------------- */
async function tmdbSearch(query) {
  const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("TMDB request failed (check your API key)");
  const data = await res.json();
  return data.results || [];
}

async function tmdbGetDetails(movieId) {
  const url = `${TMDB_BASE}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load movie details from TMDB");
  return res.json();
}

function renderTmdbResults(results) {
  if (results.length === 0) {
    tmdbResults.innerHTML = `<div class="tmdb-status">No matches found. Try a different title.</div>`;
    return;
  }

  tmdbResults.innerHTML = results
    .slice(0, 6)
    .map((m) => {
      const year = (m.release_date || "").slice(0, 4) || "—";
      const thumb = m.poster_path ? `${TMDB_THUMB_BASE}${m.poster_path}` : "";
      return `
        <button type="button" class="tmdb-result-item" data-id="${m.id}">
          ${thumb ? `<img class="tmdb-result-poster" src="${escapeHtml(thumb)}" alt="" loading="lazy" />` : `<div class="tmdb-result-poster"></div>`}
          <div class="tmdb-result-info">
            <div class="tmdb-result-title">${escapeHtml(m.title)}</div>
            <div class="tmdb-result-year">${year}</div>
          </div>
        </button>`;
    })
    .join("");

  tmdbResults.querySelectorAll(".tmdb-result-item").forEach((btn) => {
    btn.addEventListener("click", () => applyTmdbSelection(btn.dataset.id));
  });
}

async function runTmdbSearch() {
  const query = tmdbSearchInput.value.trim();
  if (!query) return;

  tmdbResults.innerHTML = `<div class="tmdb-status">Searching TMDB...</div>`;
  try {
    const results = await tmdbSearch(query);
    renderTmdbResults(results);
  } catch (err) {
    tmdbResults.innerHTML = `<div class="tmdb-status error">⚠️ ${escapeHtml(err.message)}</div>`;
  }
}

async function applyTmdbSelection(movieId) {
  tmdbResults.innerHTML = `<div class="tmdb-status">Loading details...</div>`;
  try {
    const data = await tmdbGetDetails(movieId);

    movieNameInput.value = data.title || "";

    if (data.poster_path) {
      posterUrlInput.value = `${TMDB_IMG_BASE}${data.poster_path}`;
      posterUrlInput.dispatchEvent(new Event("input"));
    }

    const tmdbGenreNames = (data.genres || []).map((g) => TMDB_GENRE_MAP[g.name] || g.name);
    selectedGenres = new Set(GENRES.filter((g) => tmdbGenreNames.includes(g)));
    syncGenreCloudSelection();

    const topCast = (data.credits?.cast || []).slice(0, 8).map((c) => c.name);
    castInput.value = topCast.join(", ");
    renderCastPreview();

    releaseYearInput.value = (data.release_date || "").slice(0, 4) || "";

    if (typeof data.vote_average === "number" && data.vote_average > 0) {
      const r = Math.max(1, Math.min(10, data.vote_average));
      ratingRange.value = r.toFixed(1);
      ratingValueLabel.textContent = r.toFixed(1);
    }

    movieOverviewInput.value = data.overview || "";

    tmdbResults.innerHTML = `<div class="tmdb-status">✅ Auto-filled from TMDB — review the fields, then write your review below.</div>`;
    showToast("Movie details auto-filled from TMDB", "success");
  } catch (err) {
    tmdbResults.innerHTML = `<div class="tmdb-status error">⚠️ ${escapeHtml(err.message)}</div>`;
    showToast("TMDB error: " + err.message, "error");
  }
}

tmdbSearchBtn.addEventListener("click", runTmdbSearch);
tmdbSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); runTmdbSearch(); }
});

/* ---------------------------------------------------------
   Form submit (Add / Update)
--------------------------------------------------------- */
reviewForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const payload = {
    movieName: movieNameInput.value.trim(),
    poster: posterUrlInput.value.trim(),
    genres: Array.from(selectedGenres),
    cast: getCastArray(),
    releaseYear: Number(releaseYearInput.value),
    reviewDate: reviewDateInput.value,
    rating: Number(ratingRange.value),
    overview: movieOverviewInput.value.trim(),
    reviewText: reviewTextInput.value.trim()
  };

  if (!payload.movieName) return showToast("Movie name is required", "error");
  if (!payload.poster) return showToast("Poster URL is required", "error");
  if (payload.genres.length === 0) return showToast("Select at least one genre", "error");
  if (payload.cast.length === 0) return showToast("Add at least one cast member", "error");
  if (!payload.releaseYear) return showToast("Release year is required", "error");
  if (!payload.reviewDate) return showToast("Review date is required", "error");
  if (!payload.reviewText) return showToast("Review text is required", "error");

  submitBtn.disabled = true;

  const task = editingId ? updateReview(editingId, payload) : saveReview(payload);

  task
    .then(() => {
      showToast(editingId ? "Review updated successfully" : "Review added successfully", "success");
      resetForm();
    })
    .catch((err) => showToast("Error: " + err.message, "error"))
    .finally(() => { submitBtn.disabled = false; });
});

function resetForm() {
  reviewForm.reset();
  reviewIdInput.value = "";
  tmdbSearchInput.value = "";
  tmdbResults.innerHTML = "";
  movieOverviewInput.value = "";
  selectedGenres.clear();
  syncGenreCloudSelection();
  castPreview.innerHTML = "";
  posterPreview.innerHTML = "No image";
  ratingRange.value = 7;
  ratingValueLabel.textContent = "7.0";
  editingId = null;
  formTitle.textContent = "📝 Add New Review";
  submitBtn.textContent = "💾 Save Review";
  cancelEditBtn.style.display = "none";
}

cancelEditBtn.addEventListener("click", resetForm);

function startEdit(id) {
  const r = reviewsCache[id];
  if (!r) return;

  editingId = id;
  reviewIdInput.value = id;
  movieNameInput.value = r.movieName || "";
  posterUrlInput.value = r.poster || "";
  posterPreview.innerHTML = r.poster
    ? `<img src="${escapeHtml(r.poster)}" alt="Poster preview" onerror="this.parentElement.innerHTML='Image failed to load'" />`
    : "No image";

  selectedGenres = new Set(r.genres || []);
  syncGenreCloudSelection();

  castInput.value = (r.cast || []).join(", ");
  renderCastPreview();

  releaseYearInput.value = r.releaseYear || "";
  reviewDateInput.value = r.reviewDate || "";
  ratingRange.value = r.rating || 7;
  ratingValueLabel.textContent = Number(r.rating || 7).toFixed(1);
  movieOverviewInput.value = r.overview || "";
  reviewTextInput.value = r.reviewText || "";

  formTitle.textContent = "✏️ Edit Review";
  submitBtn.textContent = "💾 Update Review";
  cancelEditBtn.style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------------------------------------------------
   List rendering — search, filter, sort
--------------------------------------------------------- */
function getFilteredSortedReviews() {
  let arr = Object.entries(reviewsCache).map(([id, r]) => ({ id, ...r }));

  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    arr = arr.filter(
      (r) =>
        (r.movieName || "").toLowerCase().includes(q) ||
        (r.cast || []).some((c) => c.toLowerCase().includes(q))
    );
  }

  const genreVal = genreFilter.value;
  if (genreVal) arr = arr.filter((r) => (r.genres || []).includes(genreVal));

  switch (sortSelect.value) {
    case "newest": arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
    case "oldest": arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); break;
    case "rating-high": arr.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    case "rating-low": arr.sort((a, b) => (a.rating || 0) - (b.rating || 0)); break;
    case "name-az": arr.sort((a, b) => (a.movieName || "").localeCompare(b.movieName || "")); break;
    case "name-za": arr.sort((a, b) => (b.movieName || "").localeCompare(a.movieName || "")); break;
    case "year-new": arr.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0)); break;
    case "year-old": arr.sort((a, b) => (a.releaseYear || 0) - (b.releaseYear || 0)); break;
  }

  return arr;
}

function buildAdminCard(r) {
  const genreTags = (r.genres || [])
    .slice(0, 3)
    .map((g) => `<span class="genre-tag">${escapeHtml(g)}</span>`)
    .join("");
  const extra = (r.genres || []).length > 3 ? `<span class="genre-tag">+${r.genres.length - 3}</span>` : "";

  return `
    <article class="movie-card" data-id="${r.id}">
      <div class="poster-wrap">
        <img src="${escapeHtml(r.poster)}" alt="${escapeHtml(r.movieName)} poster" loading="lazy" decoding="async"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="poster-fallback" style="display:none;">🎬<br>${escapeHtml(r.movieName)}</div>
        <div class="poster-gradient"></div>
        <div class="card-rating-badge">⭐ ${Number(r.rating).toFixed(1)}</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(r.movieName)}</div>
          <div class="card-meta"><span>${r.releaseYear || "—"}</span><span class="dot"></span><span>${escapeHtml(r.reviewDate || "")}</span></div>
          <div class="card-genres">${genreTags}${extra}</div>
          <div class="card-snippet">${escapeHtml(truncate(r.reviewText || "", 110))}</div>
          <div class="card-footer">
            ${starRatingMarkup(r.rating || 0)}
            <div class="card-admin-actions">
              <button type="button" class="icon-btn btn-edit" data-id="${r.id}" title="Edit">✏️</button>
              <button type="button" class="icon-btn danger btn-delete" data-id="${r.id}" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderList() {
  const arr = getFilteredSortedReviews();

  if (arr.length === 0) {
    adminGrid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🎬</div>
        <h3>No reviews found</h3>
        <p>Try adjusting your search or add a new review.</p>
      </div>`;
    return;
  }

  adminGrid.innerHTML = arr.map(buildAdminCard).join("");
  animateStarFills(adminGrid);
}

searchInput.addEventListener("input", debounce(renderList, 200));
genreFilter.addEventListener("change", renderList);
sortSelect.addEventListener("change", renderList);

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/* ---------------------------------------------------------
   Card click delegation — edit / delete / preview
--------------------------------------------------------- */
adminGrid.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".btn-edit");
  const deleteBtn = e.target.closest(".btn-delete");
  const card = e.target.closest(".movie-card");

  if (editBtn) { startEdit(editBtn.dataset.id); return; }
  if (deleteBtn) { openConfirmDelete(deleteBtn.dataset.id); return; }
  if (card) { openDetailModal(card.dataset.id); }
});

/* ---------------------------------------------------------
   Delete confirmation modal
--------------------------------------------------------- */
function openConfirmDelete(id) {
  pendingDeleteId = id;
  confirmModal.classList.add("active");
}
function closeConfirmDelete() {
  pendingDeleteId = null;
  confirmModal.classList.remove("active");
}
confirmCancelBtn.addEventListener("click", closeConfirmDelete);
confirmModal.addEventListener("click", (e) => { if (e.target === confirmModal) closeConfirmDelete(); });

confirmDeleteBtn.addEventListener("click", () => {
  if (!pendingDeleteId) return;
  confirmDeleteBtn.disabled = true;
  deleteReview(pendingDeleteId)
    .then(() => showToast("Review deleted", "success"))
    .catch((err) => showToast("Error: " + err.message, "error"))
    .finally(() => {
      confirmDeleteBtn.disabled = false;
      closeConfirmDelete();
    });
});

/* ---------------------------------------------------------
   Detail preview modal (read-only)
--------------------------------------------------------- */
function openDetailModal(id) {
  const r = reviewsCache[id];
  if (!r) return;

  const genres = (r.genres || []).map((g) => `<span class="genre-tag">${escapeHtml(g)}</span>`).join("");
  const cast = (r.cast || []).map((c) => `<span class="cast-tag">${escapeHtml(c)}</span>`).join("");

  detailModalCard.innerHTML = `
    <div class="modal-poster">
      <img src="${escapeHtml(r.poster)}" alt="${escapeHtml(r.movieName)} poster" onerror="this.style.opacity=0" />
    </div>
    <div class="modal-content">
      <button class="modal-close" id="closeDetailBtn">✕</button>
      <h3 class="modal-title">${escapeHtml(r.movieName)}</h3>
      <div class="modal-meta-row">
        <span>📅 ${r.releaseYear || "—"}</span><span>·</span>
        <span>📝 Reviewed ${escapeHtml(r.reviewDate || "")}</span><span>·</span>
        <span>❤️ ${r.likes || 0} likes</span>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">Rating</div>
        ${starRatingMarkup(r.rating || 0)}
      </div>
      <div class="modal-section">
        <div class="modal-section-label">Genres</div>
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
    </div>
  `;

  detailModal.classList.add("active");
  animateStarFills(detailModalCard);
  $("closeDetailBtn").addEventListener("click", closeDetailModal);
}

function closeDetailModal() {
  detailModal.classList.remove("active");
}
detailModal.addEventListener("click", (e) => { if (e.target === detailModal) closeDetailModal(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDetailModal();
    closeConfirmDelete();
  }
});

/* ---------------------------------------------------------
   Authentication — login / logout / auth state gate
--------------------------------------------------------- */
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loginError.textContent = "";
  loginBtn.disabled = true;

  signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value)
    .catch((err) => {
      loginError.textContent = "Incorrect email or password.";
    })
    .finally(() => { loginBtn.disabled = false; });
});

logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => showToast("Signed out", "info"));
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    authGate.classList.add("auth-gate-hidden");
    adminApp.classList.remove("admin-app-hidden");
    loginForm.reset();
    loginError.textContent = "";
    if (!reviewsListenerAttached) {
      reviewsListenerAttached = true;
      loadReviews();
    }
  } else {
    adminApp.classList.add("admin-app-hidden");
    authGate.classList.remove("auth-gate-hidden");
  }
});

/* ---------------------------------------------------------
   Init — UI setup that doesn't depend on auth state
--------------------------------------------------------- */
renderGenreCloud();
renderGenreFilterOptions();
resetForm();
