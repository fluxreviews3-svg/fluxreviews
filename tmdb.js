/* =========================================================
   FluxReviews — TMDB API Service
   Single reusable module for all TMDB calls across the site.
   ========================================================= */

import { TMDB_API_KEY } from "./config.js";

const TMDB_BASE = "https://api.themoviedb.org/3";

export const TMDB_IMG = {
  poster: (path, size = "w342") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : ""),
  backdrop: (path, size = "w780") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : ""),
  logo: (path, size = "w92") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : "")
};

async function tmdbGet(endpoint, params = {}) {
  const qs = new URLSearchParams({ api_key: TMDB_API_KEY, language: "en-US", ...params });
  const res = await fetch(`${TMDB_BASE}${endpoint}?${qs.toString()}`);
  if (!res.ok) throw new Error(`TMDB request failed (${res.status}): ${endpoint}`);
  return res.json();
}

/* ---------------------------------------------------------
   Discovery feeds
--------------------------------------------------------- */
export function getTrending() {
  return tmdbGet("/trending/movie/day").then((d) => d.results || []);
}

export function getUpcoming(region = "IN") {
  return tmdbGet("/movie/upcoming", { region }).then((d) => d.results || []);
}

export function getTopRated() {
  return tmdbGet("/movie/top_rated").then((d) => d.results || []);
}

/* ---------------------------------------------------------
   Search / details / cast / OTT providers
--------------------------------------------------------- */
export function searchMovies(query) {
  return tmdbGet("/search/movie", { query }).then((d) => d.results || []);
}

export function getMovieDetails(movieId) {
  return tmdbGet(`/movie/${movieId}`, { append_to_response: "credits" });
}

export function getWatchProviders(movieId) {
  return tmdbGet(`/movie/${movieId}/watch/providers`);
}

/* ---------------------------------------------------------
   Small shared helpers
--------------------------------------------------------- */
export function yearFromDate(dateStr) {
  return (dateStr || "").slice(0, 4) || "—";
}

export function formatReleaseDate(dateStr) {
  if (!dateStr) return "TBA";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
