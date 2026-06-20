/* =========================================================
   FluxReviews — About / Landing Page Logic
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, onValue, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ---------------------------------------------------------
   🔥 FIREBASE CONFIGURATION — keep identical to admin.js / viewer.js
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

const LIKED_KEY = "flux_liked_review_ids";
let likeInFlight = new Set();

/* ---------------------------------------------------------
   Helpers (shared patterns with viewer.js)
--------------------------------------------------------- */
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(text = "", len = 100) {
  if (text.length <= len) return text;
  return text.slice(0, len).trim() + "…";
}

function starRatingMarkup(rating) {
  const pct = Math.max(0, Math.min(100, (rating / 10) * 100));
  return `
    <span class="star-rating filled" style="--rating-pct:${pct}%">
      <span class="stars-bg">★★★★★</span>
      <span class="stars-fg">★★★★★</span>
    </span>
    <span class="rating-num">${Number(rating).toFixed(1)}/10</span>
  `;
}

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
  } catch { /* private browsing etc. — like still works, just not remembered */ }
}
function hasLiked(id) { return getLikedSet().has(id); }

function toggleLike(id, btnEl) {
  if (!id || likeInFlight.has(id)) return;
  if (hasLiked(id)) return;
  likeInFlight.add(id);

  const likesRef = ref(db, `reviews/${id}/likes`);
  runTransaction(likesRef, (current) => (current || 0) + 1)
    .then((result) => {
      btnEl.classList.add("liked", "bounce");
      setTimeout(() => btnEl.classList.remove("bounce"), 500);
      const countEl = btnEl.querySelector(".like-count");
      if (countEl && result.snapshot.exists()) countEl.textContent = result.snapshot.val();
      markAsLiked(id);
    })
    .finally(() => likeInFlight.delete(id));
}

/* ---------------------------------------------------------
   Reviews preview (latest 3)
--------------------------------------------------------- */
const previewGrid = document.getElementById("previewGrid");

function buildPreviewCard(r) {
  const genreTags = (r.genres || [])
    .slice(0, 2)
    .map((g) => `<span class="genre-tag">${escapeHtml(g)}</span>`)
    .join("");
  const likedClass = hasLiked(r.id) ? "liked" : "";

  return `
    <article class="movie-card" style="animation:none; opacity:1;">
      <div class="poster-wrap">
        <img src="${escapeHtml(r.poster)}" alt="${escapeHtml(r.movieName)} poster" loading="lazy" decoding="async"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="poster-fallback" style="display:none;">🎬<br>${escapeHtml(r.movieName)}</div>
        <div class="poster-gradient"></div>
        <div class="card-rating-badge">⭐ ${Number(r.rating).toFixed(1)}</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(r.movieName)}</div>
          <div class="card-meta"><span>${r.releaseYear || "—"}</span></div>
          <div class="card-genres">${genreTags}</div>
          <div class="card-snippet" style="max-height:60px; opacity:1; margin-bottom:8px;">${escapeHtml(truncate(r.reviewText || "", 90))}</div>
          <div class="card-footer">
            <button type="button" class="heart-btn ${likedClass}" data-id="${r.id}">
              <span class="heart-icon">❤️</span><span class="like-count">${r.likes || 0}</span>
            </button>
            <a class="share-btn" href="viewer.html#${r.id}">📖 Read More</a>
          </div>
        </div>
      </div>
    </article>
  `;
}

function loadPreview() {
  onValue(
    reviewsRef,
    (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.entries(data)
        .map(([id, r]) => ({ id, ...r }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 3);

      if (arr.length === 0) {
        previewGrid.innerHTML = `<div class="empty-state"><div class="emoji">🎬</div><h3>No reviews published yet</h3></div>`;
        return;
      }

      previewGrid.innerHTML = arr.map(buildPreviewCard).join("");
      previewGrid.querySelectorAll(".heart-btn").forEach((btn) => {
        btn.addEventListener("click", () => toggleLike(btn.dataset.id, btn));
      });
    },
    () => {
      previewGrid.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><h3>Couldn't load reviews right now</h3></div>`;
    }
  );
}

/* ---------------------------------------------------------
   Mouse-tracking tilt effect for feature/team cards
--------------------------------------------------------- */
function initTilt() {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--rx", `${x * 10}deg`);
      card.style.setProperty("--ry", `${-y * 10}deg`);
    });
    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
document.getElementById("footerYear").textContent = new Date().getFullYear();

if (window.AOS) {
  AOS.init({ duration: 700, once: true, offset: 60 });
}

if (window.Typed) {
  new Typed("#typedText", {
    strings: ["Where Stories Meet Opinions."],
    typeSpeed: 45,
    showCursor: false,
    onComplete: () => {
      const cursor = document.querySelector(".typed-cursor");
      if (cursor) cursor.style.display = "inline";
    }
  });
} else {
  document.getElementById("typedText").textContent = "Where Stories Meet Opinions.";
}

initTilt();
loadPreview();
