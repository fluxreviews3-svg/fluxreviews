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
import { firebaseConfig, TMDB_API_KEY } from "/config.js";
import { escapeHtml, truncate, starRatingMarkup, animateStarFills, generateSlug } from "/utils.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const reviewsRef = ref(db, "reviews");
const ottRef = ref(db, "ott_updates");
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w780"; // HD poster size
const TMDB_THUMB_BASE = "https://image.tmdb.org/t/p/w92"; // small thumb for result list

// TMDB genre names that differ from our local genre list
const TMDB_GENRE_MAP = { "Science Fiction": "Sci-Fi" };

/* ---------------------------------------------------------
   Constants
--------------------------------------------------------- */
const GENRES = [
  "Action", "Adventure", "Animation", "Anime", "Biography", "Comedy", "Crime",
  "Documentary", "Drama", "Family", "Fantasy", "Film-Noir", "History", "Horror",
  "Music", "Musical", "Mystery", "Psychological Thriller", "Romance", "Sci-Fi",
  "Sport", "Superhero", "Suspense", "Thriller", "War", "Western", "Cyberpunk",
  "Dark Comedy", "Slice of Life", "Coming of Age"
];

/* ---------------------------------------------------------
   State
--------------------------------------------------------- */
let reviewsCache = {};
let selectedGenres = new Set();
let editingId = null;
let pendingDeleteId = null;
let pendingDeleteType = "review";
let reviewsListenerAttached = false;

let ottCache = {};
let editingOttId = null;
let ottListenerAttached = false;
const OTT_PLATFORMS = ["Netflix", "Prime Video", "JioHotstar", "SonyLiv", "ZEE5", "Aha", "ETV Win", "Others"];

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

const adminTabBtns = document.querySelectorAll(".admin-tab-btn");
const reviewsTabPanel = $("reviewsTabPanel");
const ottTabPanel = $("ottTabPanel");

const ottForm = $("ottForm");
const ottIdInput = $("ottId");
const ottTitleInput = $("ottTitle");
const ottPosterInput = $("ottPoster");
const ottTmdbSearchInput = $("ottTmdbSearchInput");
const ottTmdbSearchBtn = $("ottTmdbSearchBtn");
const ottTmdbResults = $("ottTmdbResults");
const ottPosterPreview = $("ottPosterPreview");
const ottPlatformInput = $("ottPlatform");
const ottReleaseDateInput = $("ottReleaseDate");
const ottDescriptionInput = $("ottDescription");
const ottSubmitBtn = $("ottSubmitBtn");
const ottCancelEditBtn = $("ottCancelEditBtn");
const ottFormTitle = $("ottFormTitle");

const ottGrid = $("ottGrid");
const ottCount = $("ottCount");
const ottPlatformFilter = $("ottPlatformFilter");
const ottSortSelect = $("ottSortSelect");

const confirmTitle = $("confirmTitle");
const confirmText = $("confirmText");

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
   Admin tab switching — Reviews / OTT Updates
--------------------------------------------------------- */
adminTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    adminTabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const isReviews = btn.dataset.tab === "reviews";
    reviewsTabPanel.classList.toggle("hidden", !isReviews);
    ottTabPanel.classList.toggle("hidden", isReviews);
  });
});

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

  const rawName = movieNameInput.value.trim();

  const payload = {
    movieName: rawName,
    slug: editingId && reviewsCache[editingId]?.slug
      ? reviewsCache[editingId].slug          // keep existing slug when editing
      : generateSlug(rawName),                // generate fresh slug for new reviews
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
    .map((g) => `<span class="genre-tag clickable" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</span>`)
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
  const genreTag = e.target.closest(".genre-tag.clickable");
  const card = e.target.closest(".movie-card");

  if (editBtn) { startEdit(editBtn.dataset.id); return; }
  if (deleteBtn) { openConfirmDelete(deleteBtn.dataset.id); return; }
  if (genreTag) {
    e.stopPropagation();
    genreFilter.value = genreTag.dataset.genre;
    searchInput.value = "";
    renderList();
    showToast(`Filtered to ${genreTag.dataset.genre}`, "info");
    return;
  }
  if (card) { openDetailModal(card.dataset.id); }
});

/* ---------------------------------------------------------
   Delete confirmation modal (shared between Reviews and OTT)
--------------------------------------------------------- */
function openConfirmDelete(id, type = "review") {
  pendingDeleteId = id;
  pendingDeleteType = type;
  if (type === "ott") {
    confirmTitle.textContent = "Delete this OTT update?";
    confirmText.textContent = "This action cannot be undone. The OTT update will be permanently removed from the database.";
  } else {
    confirmTitle.textContent = "Delete this review?";
    confirmText.textContent = "This action cannot be undone. The review will be permanently removed from the database.";
  }
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
  const task = pendingDeleteType === "ott" ? deleteOtt(pendingDeleteId) : deleteReview(pendingDeleteId);
  task
    .then(() => showToast(pendingDeleteType === "ott" ? "OTT update deleted" : "Review deleted", "success"))
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

  const genres = (r.genres || [])
    .map((g) => `<span class="genre-tag clickable" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</span>`)
    .join("");
  const cast = (r.cast || []).map((c) => `<span class="cast-tag">${escapeHtml(c)}</span>`).join("");

  detailModalCard.innerHTML = `
    <div class="modal-bg-blur" style="background-image: url('${escapeHtml(r.poster)}')"></div>
    <button class="modal-close" id="closeDetailBtn">✕</button>
    <div class="modal-scroll-inner">
      <div class="modal-poster">
        <img src="${escapeHtml(r.poster)}" alt="${escapeHtml(r.movieName)} poster" onerror="this.style.opacity=0" />
      </div>
      <div class="modal-content">
        <h3 class="modal-title">${escapeHtml(r.movieName)}</h3>
        <div class="modal-meta-row">
          <span>📅 ${r.releaseYear || "—"}</span><span>·</span>
          <span>📝 Reviewed ${escapeHtml(r.reviewDate || "")}</span><span>·</span>
          <span>❤️ ${r.likes || 0} likes</span><span>·</span>
          <span>✍️ FluxReviews Team</span>
        </div>
        <div class="modal-section">
          <div class="modal-section-label">Rating</div>
          ${starRatingMarkup(r.rating || 0)}
        </div>
        <div class="modal-section">
          <div class="modal-section-label">Genres <span style="font-weight:400; color:var(--text-muted);">(tap to filter list)</span></div>
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
    </div>
  `;

  detailModal.classList.add("active");
  animateStarFills(detailModalCard);
  $("closeDetailBtn").addEventListener("click", closeDetailModal);
  detailModalCard.querySelectorAll(".genre-tag.clickable").forEach((tag) => {
    tag.addEventListener("click", () => {
      closeDetailModal();
      genreFilter.value = tag.dataset.genre;
      searchInput.value = "";
      renderList();
      showToast(`Filtered to ${tag.dataset.genre}`, "info");
    });
  });
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

/* ===========================================================
   OTT UPDATES — Firebase CRUD, form handling, list rendering
   =========================================================== */
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

function saveOtt(data) {
  const newRef = push(ottRef);
  return set(newRef, { ...data, createdAt: Date.now() });
}
function updateOtt(id, data) {
  return update(ref(db, `ott_updates/${id}`), data);
}
function deleteOtt(id) {
  return remove(ref(db, `ott_updates/${id}`));
}
function loadOttUpdates() {
  onValue(
    ottRef,
    (snapshot) => {
      ottCache = snapshot.val() || {};
      ottCount.textContent = Object.keys(ottCache).length;
      renderOttList();
    },
    (error) => showToast("Failed to load OTT updates: " + error.message, "error")
  );
}

ottPosterInput.addEventListener("input", () => {
  const url = ottPosterInput.value.trim();
  if (!url) { ottPosterPreview.innerHTML = "No image"; return; }
  ottPosterPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Poster preview" onerror="this.parentElement.innerHTML='Image failed to load'" />`;
});

/* ---------------------------------------------------------
   OTT TMDB auto-fill — search and populate title/poster/desc
--------------------------------------------------------- */
async function runOttTmdbSearch() {
  const query = ottTmdbSearchInput.value.trim();
  if (!query) return;
  ottTmdbResults.innerHTML = `<div class="tmdb-status">Searching TMDB...</div>`;
  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("TMDB request failed");
    const data = await res.json();
    const results = (data.results || []).slice(0, 6);

    if (!results.length) {
      ottTmdbResults.innerHTML = `<div class="tmdb-status">No matches found.</div>`;
      return;
    }

    ottTmdbResults.innerHTML = results.map((m) => {
      const year = (m.release_date || "").slice(0, 4) || "—";
      const thumb = m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : "";
      return `
        <button type="button" class="tmdb-result-item" data-id="${m.id}"
          data-title="${escapeHtml(m.title)}"
          data-poster="${m.poster_path ? `https://image.tmdb.org/t/p/w780${m.poster_path}` : ""}"
          data-overview="${escapeHtml(m.overview || "")}">
          ${thumb ? `<img class="tmdb-result-poster" src="${escapeHtml(thumb)}" alt="" loading="lazy" />` : `<div class="tmdb-result-poster"></div>`}
          <div class="tmdb-result-info">
            <div class="tmdb-result-title">${escapeHtml(m.title)}</div>
            <div class="tmdb-result-year">${year}</div>
          </div>
        </button>`;
    }).join("");

    ottTmdbResults.querySelectorAll(".tmdb-result-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        ottTitleInput.value = btn.dataset.title;
        ottPosterInput.value = btn.dataset.poster;
        ottDescriptionInput.value = btn.dataset.overview;
        if (btn.dataset.poster) {
          ottPosterPreview.innerHTML = `<img src="${escapeHtml(btn.dataset.poster)}" alt="Poster preview" onerror="this.parentElement.innerHTML='Image failed to load'" />`;
        }
        ottTmdbResults.innerHTML = `<div class="tmdb-status">✅ Auto-filled — now select a platform and release date.</div>`;
        showToast("OTT details auto-filled from TMDB", "success");
      });
    });
  } catch (err) {
    ottTmdbResults.innerHTML = `<div class="tmdb-status error">⚠️ ${escapeHtml(err.message)}</div>`;
  }
}

ottTmdbSearchBtn.addEventListener("click", runOttTmdbSearch);
ottTmdbSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); runOttTmdbSearch(); }
});

ottForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const payload = {
    title: ottTitleInput.value.trim(),
    poster: ottPosterInput.value.trim(),
    platform: ottPlatformInput.value,
    releaseDate: ottReleaseDateInput.value,
    description: ottDescriptionInput.value.trim()
  };

  if (!payload.title) return showToast("OTT title is required", "error");
  if (!payload.poster) return showToast("Poster URL is required", "error");
  if (!payload.platform) return showToast("Select a platform", "error");
  if (!payload.releaseDate) return showToast("Release date is required", "error");

  ottSubmitBtn.disabled = true;
  const task = editingOttId ? updateOtt(editingOttId, payload) : saveOtt(payload);

  task
    .then(() => {
      showToast(editingOttId ? "OTT update updated" : "OTT update added", "success");
      resetOttForm();
    })
    .catch((err) => showToast("Error: " + err.message, "error"))
    .finally(() => { ottSubmitBtn.disabled = false; });
});

function resetOttForm() {
  ottForm.reset();
  ottIdInput.value = "";
  ottPosterPreview.innerHTML = "No image";
  ottTmdbSearchInput.value = "";
  ottTmdbResults.innerHTML = "";
  editingOttId = null;
  ottFormTitle.textContent = "📺 Add OTT Update";
  ottSubmitBtn.textContent = "💾 Save Update";
  ottCancelEditBtn.style.display = "none";
}
ottCancelEditBtn.addEventListener("click", resetOttForm);

function startEditOtt(id) {
  const o = ottCache[id];
  if (!o) return;

  editingOttId = id;
  ottIdInput.value = id;
  ottTitleInput.value = o.title || "";
  ottPosterInput.value = o.poster || "";
  ottPosterPreview.innerHTML = o.poster
    ? `<img src="${escapeHtml(o.poster)}" alt="Poster preview" onerror="this.parentElement.innerHTML='Image failed to load'" />`
    : "No image";
  ottPlatformInput.value = o.platform || "";
  ottReleaseDateInput.value = o.releaseDate || "";
  ottDescriptionInput.value = o.description || "";

  ottFormTitle.textContent = "✏️ Edit OTT Update";
  ottSubmitBtn.textContent = "💾 Update";
  ottCancelEditBtn.style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getFilteredSortedOtt() {
  let arr = Object.entries(ottCache).map(([id, o]) => ({ id, ...o }));

  const platformVal = ottPlatformFilter.value;
  if (platformVal) arr = arr.filter((o) => o.platform === platformVal);

  switch (ottSortSelect.value) {
    case "date-new": arr.sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || "")); break;
    case "date-old": arr.sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || "")); break;
    case "name-az": arr.sort((a, b) => (a.title || "").localeCompare(b.title || "")); break;
  }
  return arr;
}

function buildOttAdminCard(o) {
  return `
    <article class="movie-card" data-id="${o.id}">
      <div class="poster-wrap">
        <img src="${escapeHtml(o.poster)}" alt="${escapeHtml(o.title)} poster"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="poster-fallback" style="display:none;">📺<br>${escapeHtml(o.title)}</div>
        <div class="poster-gradient"></div>
        <span class="platform-badge ${platformBadgeClass(o.platform)}" style="position:absolute; top:12px; right:12px;">${escapeHtml(o.platform || "Others")}</span>
        <div class="card-body">
          <div class="card-title">${escapeHtml(o.title)}</div>
          <div class="ott-card-meta">
            <span class="card-meta">📅 ${escapeHtml(o.releaseDate || "TBA")}</span>
          </div>
          <div class="card-snippet">${escapeHtml(truncate(o.description || "", 110))}</div>
          <div class="card-footer">
            <span></span>
            <div class="card-admin-actions">
              <button type="button" class="icon-btn btn-edit-ott" data-id="${o.id}" title="Edit">✏️</button>
              <button type="button" class="icon-btn danger btn-delete-ott" data-id="${o.id}" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderOttList() {
  const arr = getFilteredSortedOtt();
  if (arr.length === 0) {
    ottGrid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📺</div>
        <h3>No OTT updates yet</h3>
        <p>Add one using the form, or wait for TMDB auto-detection on the viewer page.</p>
      </div>`;
    return;
  }
  ottGrid.innerHTML = arr.map(buildOttAdminCard).join("");
}

ottPlatformFilter.addEventListener("change", renderOttList);
ottSortSelect.addEventListener("change", renderOttList);

ottGrid.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".btn-edit-ott");
  const deleteBtn = e.target.closest(".btn-delete-ott");
  if (editBtn) { startEditOtt(editBtn.dataset.id); return; }
  if (deleteBtn) { openConfirmDelete(deleteBtn.dataset.id, "ott"); return; }
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
    if (!ottListenerAttached) {
      ottListenerAttached = true;
      loadOttUpdates();
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
resetOttForm();
