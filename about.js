/* =========================================================
   FluxReviews — About / Landing Page Logic
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./config.js";
import { escapeHtml, truncate, hasLiked, toggleLike } from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const reviewsRef = ref(db, "reviews");

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
            <a class="share-btn" href="index.html#${r.id}">📖 Read More</a>
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
        btn.addEventListener("click", () => toggleLike(btn.dataset.id, btn, db));
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
