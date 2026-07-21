/* =========================================================
   FluxReviews — Upcoming Releases Page Logic
   ========================================================= */

import { escapeHtml } from "./utils.js";
import { getUpcoming, TMDB_IMG, formatReleaseDate } from "./tmdb.js";

const upcomingGrid = document.getElementById("upcomingGrid");

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

function buildUpcomingCard(movie) {
  const poster = TMDB_IMG.poster(movie.poster_path, "w342");
  return `
    <article class="discover-card" data-tmdb-id="${movie.id}">
      <div class="discover-poster">
        ${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(movie.title)}" loading="lazy" decoding="async" onerror="this.style.display='none'" />` : ""}
      </div>
      <div class="discover-info">
        <div class="discover-title">${escapeHtml(movie.title)}</div>
        <div class="discover-meta">📅 ${formatReleaseDate(movie.release_date)}</div>
        <div class="discover-overview">${escapeHtml(movie.overview || "No synopsis yet.")}</div>
      </div>
    </article>
  `;
}

function wireClicks() {
  upcomingGrid.querySelectorAll(".discover-card[data-tmdb-id]").forEach((card) => {
    card.addEventListener("click", () => {
      window.open(`https://www.themoviedb.org/movie/${card.dataset.tmdbId}`, "_blank", "noopener");
    });
  });
}

function load() {
  upcomingGrid.innerHTML = skeletonCards();

  getUpcoming()
    .then((movies) => {
      if (!movies.length) {
        upcomingGrid.innerHTML = `<div class="empty-state"><div class="emoji">🎬</div><h3>Nothing upcoming right now</h3></div>`;
        return;
      }
      upcomingGrid.innerHTML = movies.map(buildUpcomingCard).join("");
      wireClicks();
    })
    .catch((err) => {
      upcomingGrid.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><h3>Couldn't load TMDB data</h3><p>${escapeHtml(err.message)}</p></div>`;
    });
}

if (window.AOS) AOS.init({ duration: 700, once: true, offset: 40 });
load();
