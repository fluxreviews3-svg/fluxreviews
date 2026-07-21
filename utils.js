import { ref, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const LIKED_KEY = "flux_liked_review_ids";
const likeInFlight = new Set();

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncate(text = "", len = 100) {
  if (text.length <= len) return text;
  return text.slice(0, len).trim() + "…";
}

export function starRatingMarkup(rating) {
  const pct = Math.max(0, Math.min(100, (rating / 10) * 100));
  return `
    <span class="star-rating" style="--rating-pct:${pct}%">
      <span class="stars-bg">★★★★★</span>
      <span class="stars-fg">★★★★★</span>
    </span>
    <span class="rating-num">${Number(rating).toFixed(1)}/10</span>
  `;
}

export function animateStarFills(scope = document) {
  requestAnimationFrame(() => {
    scope.querySelectorAll(".star-rating:not(.filled)").forEach((el) => el.classList.add("filled"));
  });
}

export function getLikedSet() {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markAsLiked(id) {
  try {
    const set = getLikedSet();
    set.add(id);
    localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
  } catch {
    /* localStorage unavailable (private browsing etc.) */
  }
}

export function hasLiked(id) {
  return getLikedSet().has(id);
}

export function toggleLike(id, btnEl, db, showToast = console.log) {
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
      if (countEl && result.snapshot.exists()) {
        countEl.textContent = result.snapshot.val();
      }
      markAsLiked(id);
      showToast("Thanks for the like!", "success");
    })
    .catch((err) => showToast("Error: " + err.message, "error"))
    .finally(() => likeInFlight.delete(id));
}

export function handleShare(r, showToast = console.log) {
  const shareUrl = `${location.origin}${location.pathname === '/' ? '' : location.pathname}#${r.id}`;
  const shareText = `${r.movieName} (${r.releaseYear}) — ${Number(r.rating).toFixed(1)}/10 on FluxReviews`;

  if (navigator.share) {
    navigator.share({ title: r.movieName, text: shareText, url: shareUrl }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => showToast("Link copied to clipboard!", "success"));
  } else {
    showToast(shareUrl, "info");
  }
}
