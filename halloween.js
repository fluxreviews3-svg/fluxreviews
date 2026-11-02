/* =========================================================
   FluxReviews — HALLOWEEN 2026 SEASONAL THEME CONTROLLER
   File: halloween.js   (classic script, loaded in <head>)

   What it does, only inside the season window below:
     • switches the theme on  (adds class "halloween" to <html>)
     • builds the animated background, webs, embers and spider
     • upgrades the homepage hero (heading, tagline, buttons)
     • marks the current page's nav link as active
     • turns OFF Google ads for the season  (FLUX_ADS_ENABLED=false)
     • tints the interactive particle background orange

   Season window — edit these two lines to change the dates:
   ========================================================= */
(function () {
  "use strict";

  var START = new Date(2026, 9, 30, 0, 0, 0);   // 30 Oct 2026, 00:00  (month is 0-based)
  var END   = new Date(2026, 11, 1, 0, 0, 0);   // 1 Dec 2026, 00:00 — theme AND ad-hiding stop here

  // Testing helpers:  ?halloween=on  forces the theme,  ?halloween=off  disables it.
  var override = null;
  try { override = new URLSearchParams(window.location.search).get("halloween"); } catch (e) {}

  var now = new Date();
  var active = override === "on" || (override !== "off" && now >= START && now < END);
  if (!active) return;                           // outside the season: do nothing at all

  var root = document.documentElement;
  root.classList.add("halloween", "hw-no-ads");

  /* Read by viewer.js (skips injecting ad slots) and particles.js (orange palette) */
  window.FLUX_ADS_ENABLED = false;
  window.FLUX_PARTICLE_COLORS = [
    "rgba(255, 138, 31, 0.75)",
    "rgba(255, 179, 64, 0.70)",
    "rgba(217, 72, 15, 0.75)"
  ];
  window.FLUX_PARTICLE_IDLE = "rgba(255, 170, 90, 0.13)";

  var WEB_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 340 340\" fill=\"none\" stroke=\"#d2d2dc\" stroke-linecap=\"round\"><line x1=\"340\" y1=\"0\" x2=\"0.0\" y2=\"0.0\" stroke-opacity=\".55\" stroke-width=\".9\"/><line x1=\"340\" y1=\"0\" x2=\"15.5\" y2=\"57.2\" stroke-opacity=\".55\" stroke-width=\".9\"/><line x1=\"340\" y1=\"0\" x2=\"26.4\" y2=\"126.7\" stroke-opacity=\".55\" stroke-width=\".9\"/><line x1=\"340\" y1=\"0\" x2=\"71.9\" y2=\"187.7\" stroke-opacity=\".55\" stroke-width=\".9\"/><line x1=\"340\" y1=\"0\" x2=\"120.3\" y2=\"244.0\" stroke-opacity=\".55\" stroke-width=\".9\"/><line x1=\"340\" y1=\"0\" x2=\"185.0\" y2=\"291.5\" stroke-opacity=\".55\" stroke-width=\".9\"/><line x1=\"340\" y1=\"0\" x2=\"262.4\" y2=\"311.1\" stroke-opacity=\".55\" stroke-width=\".9\"/><line x1=\"340\" y1=\"0\" x2=\"340.0\" y2=\"340.0\" stroke-opacity=\".55\" stroke-width=\".9\"/><path d=\"M305.1 0.0 Q312.9 2.3 308.1 5.6 Q313.5 7.7 307.8 13.0 Q315.5 13.4 312.2 19.5 Q320.0 17.7 317.7 24.8 Q325.1 21.4 324.4 29.4 Q330.8 23.9 332.3 30.9 Q336.7 27.3 340.0 34.1\" stroke-opacity=\"0.48\" stroke-width=\".7\"/><path d=\"M274.8 0.0 Q287.5 4.5 278.3 10.9 Q289.4 14.5 281.1 23.8 Q293.0 25.4 288.0 36.4 Q302.9 32.9 298.9 45.7 Q311.2 41.4 310.0 56.3 Q321.2 48.4 325.3 58.8 Q333.9 49.8 340.0 62.7\" stroke-opacity=\"0.44\" stroke-width=\".7\"/><path d=\"M235.7 0.0 Q255.6 7.4 237.4 18.1 Q259.2 23.4 242.9 39.2 Q268.7 38.5 259.6 56.3 Q278.3 54.5 271.4 76.2 Q294.7 64.7 293.5 87.5 Q310.4 76.1 316.6 93.8 Q330.1 82.1 340.0 102.6\" stroke-opacity=\"0.41\" stroke-width=\".7\"/><path d=\"M195.8 0.0 Q226.7 9.6 206.7 23.5 Q229.2 32.0 210.0 52.5 Q237.4 55.2 228.6 78.0 Q255.5 74.9 248.2 101.9 Q274.2 93.7 276.4 119.6 Q300.0 103.6 307.9 128.9 Q327.0 108.7 340.0 141.2\" stroke-opacity=\"0.38\" stroke-width=\".7\"/><path d=\"M146.7 0.0 Q185.9 13.1 159.2 31.9 Q189.5 43.4 163.1 71.5 Q202.5 74.4 187.7 106.7 Q226.9 100.1 218.3 135.2 Q254.0 122.4 253.6 162.5 Q285.9 140.5 295.0 180.6 Q321.4 155.6 340.0 196.8\" stroke-opacity=\"0.34\" stroke-width=\".7\"/><path d=\"M92.2 0.0 Q137.4 17.4 104.5 41.5 Q147.4 55.8 103.1 95.7 Q161.5 96.3 138.7 140.9 Q194.6 129.2 173.9 184.5 Q224.3 165.8 223.9 218.4 Q267.4 187.5 282.9 229.1 Q316.9 192.4 340.0 246.4\" stroke-opacity=\"0.30\" stroke-width=\".7\"/><path d=\"M33.1 0.0 Q94.8 21.2 45.0 52.0 Q101.2 68.5 55.8 114.8 Q111.5 123.6 84.3 179.0 Q156.3 162.5 135.3 227.3 Q198.9 201.7 200.5 262.4 Q252.2 228.2 266.1 296.4 Q309.9 251.1 340.0 314.8\" stroke-opacity=\"0.27\" stroke-width=\".7\"/><path d=\"M184.5 108.9 q-6 22 2 40\" stroke-opacity=\".35\" stroke-width=\".6\"/><path d=\"M223.7 218.6 q4 18 -3 34\" stroke-opacity=\".3\" stroke-width=\".6\"/></svg>";
  var SPIDER_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 84 96\"><defs><radialGradient id=\"hwb\" cx=\"38%\" cy=\"30%\" r=\"75%\"><stop offset=\"0\" stop-color=\"#6a6a74\"/><stop offset=\".45\" stop-color=\"#26262b\"/><stop offset=\"1\" stop-color=\"#0b0b0d\"/></radialGradient></defs><g class=\"hw-legs\" fill=\"none\" stroke=\"#9a9aa6\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M49 47 Q60 28 70 34 Q75 38 74 50\"/><path d=\"M50 50 Q66 38 77 48 Q81 54 78 66\"/><path d=\"M50 54 Q66 54 76 66 Q80 72 76 84\"/><path d=\"M49 58 Q60 66 66 78 Q68 84 64 92\"/><path d=\"M 35.0 47.0 Q 24.0 28.0 14.0 34.0 Q 9.0 38.0 10.0 50.0\"/><path d=\"M 34.0 50.0 Q 18.0 38.0 7.0 48.0 Q 3.0 54.0 6.0 66.0\"/><path d=\"M 34.0 54.0 Q 18.0 54.0 8.0 66.0 Q 4.0 72.0 8.0 84.0\"/><path d=\"M 35.0 58.0 Q 24.0 66.0 18.0 78.0 Q 16.0 84.0 20.0 92.0\"/></g><ellipse cx=\"42\" cy=\"53\" rx=\"8\" ry=\"9.5\" fill=\"url(#hwb)\" stroke=\"#8a8a96\" stroke-width=\".6\"/><ellipse cx=\"42\" cy=\"26\" rx=\"11.5\" ry=\"16\" fill=\"url(#hwb)\" stroke=\"#8a8a96\" stroke-width=\".6\"/><path d=\"M38.2 21.5h7.6L42 27.6zM42 27.6l3.8 6.1h-7.6z\" fill=\"#c2410c\" opacity=\".85\"/><ellipse cx=\"38\" cy=\"19\" rx=\"3.2\" ry=\"5.2\" fill=\"#fff\" opacity=\".10\"/><g fill=\"#ff8a1f\"><circle cx=\"39.2\" cy=\"50.2\" r=\".95\"/><circle cx=\"44.8\" cy=\"50.2\" r=\".95\"/><circle cx=\"40.6\" cy=\"47.8\" r=\".7\"/><circle cx=\"43.4\" cy=\"47.8\" r=\".7\"/></g><path d=\"M40 61.5v4.2M44 61.5v4.2\" stroke=\"#8a8a96\" stroke-width=\"1.1\" stroke-linecap=\"round\"/></svg>";
  var GHOST_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 120 160\"><defs><radialGradient id=\"hwgb\" cx=\"45%\" cy=\"35%\" r=\"80%\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\".6\" stop-color=\"#f1f1f8\"/><stop offset=\"1\" stop-color=\"#cfcfe0\"/></radialGradient><linearGradient id=\"hwgh\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#2a2a33\"/><stop offset=\"1\" stop-color=\"#0c0c10\"/></linearGradient></defs><path d=\"M30 92C18 88 8 94 6 104C5 111 12 114 17 110C22 106 26 105 30 106Z\" fill=\"url(#hwgb)\"/><path d=\"M90 92C102 88 112 94 114 104C115 111 108 114 103 110C98 106 94 105 90 106Z\" fill=\"url(#hwgb)\"/><path d=\"M60 36C38 36 28 54 28 76V128C28 136 34 140 40 136C46 132 50 146 58 144C66 146 70 132 76 136C82 140 92 136 92 128V76C92 54 82 36 60 36Z\" fill=\"url(#hwgb)\"/><path d=\"M80 50C88 58 92 68 92 80V128C92 136 86 139 82 137C88 130 88 90 80 50Z\" fill=\"#b9b9d2\" opacity=\".35\"/><ellipse cx=\"47\" cy=\"82\" rx=\"5.2\" ry=\"6.8\" fill=\"#14141a\"/><ellipse cx=\"73\" cy=\"82\" rx=\"5.2\" ry=\"6.8\" fill=\"#14141a\"/><ellipse cx=\"45.3\" cy=\"79.6\" rx=\"1.5\" ry=\"1.9\" fill=\"#fff\" opacity=\".8\"/><ellipse cx=\"71.3\" cy=\"79.6\" rx=\"1.5\" ry=\"1.9\" fill=\"#fff\" opacity=\".8\"/><ellipse cx=\"38\" cy=\"93\" rx=\"5\" ry=\"3\" fill=\"#ff9aa8\" opacity=\".35\"/><ellipse cx=\"82\" cy=\"93\" rx=\"5\" ry=\"3\" fill=\"#ff9aa8\" opacity=\".35\"/><path d=\"M52 94Q60 103 68 94\" fill=\"none\" stroke=\"#14141a\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><ellipse cx=\"60\" cy=\"42\" rx=\"38\" ry=\"9\" fill=\"url(#hwgh)\"/><path d=\"M42 40C44 26 52 14 60 8C64 4 72 2 80 8C74 8 70 11 70 17C70 26 74 34 78 40Z\" fill=\"url(#hwgh)\"/><path d=\"M43 37C52 41 68 41 77 37L78 41C68 46 52 46 42 41Z\" fill=\"#3a3a46\"/><rect x=\"53\" y=\"35\" width=\"14\" height=\"9.5\" rx=\"1.6\" fill=\"none\" stroke=\"#d8a53a\" stroke-width=\"2.4\"/><path d=\"M46 20C48 16 51 13 54 11\" stroke=\"#fff\" stroke-opacity=\".12\" stroke-width=\"2\" stroke-linecap=\"round\" fill=\"none\"/></svg>";
  var PUMPKIN_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 120 112\"><defs><radialGradient id=\"hwpb\" cx=\"50%\" cy=\"38%\" r=\"70%\"><stop offset=\"0\" stop-color=\"#f6a447\"/><stop offset=\".55\" stop-color=\"#df6d1a\"/><stop offset=\"1\" stop-color=\"#8f3a08\"/></radialGradient><radialGradient id=\"hwps\" cx=\"50%\" cy=\"40%\" r=\"70%\"><stop offset=\"0\" stop-color=\"#e98a2e\"/><stop offset=\"1\" stop-color=\"#7a3006\"/></radialGradient><radialGradient id=\"hwpl\" cx=\"50%\" cy=\"50%\" r=\"60%\"><stop offset=\"0\" stop-color=\"#fff0a8\"/><stop offset=\".5\" stop-color=\"#ffb43a\"/><stop offset=\"1\" stop-color=\"#ff7a14\"/></radialGradient><linearGradient id=\"hwpt\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#8a7a3a\"/><stop offset=\"1\" stop-color=\"#3b3216\"/></linearGradient></defs><ellipse cx=\"60\" cy=\"104\" rx=\"42\" ry=\"5\" fill=\"#000\" opacity=\".35\"/><ellipse cx=\"30\" cy=\"64\" rx=\"24\" ry=\"36\" fill=\"url(#hwps)\"/><ellipse cx=\"90\" cy=\"64\" rx=\"24\" ry=\"36\" fill=\"url(#hwps)\"/><ellipse cx=\"44\" cy=\"64\" rx=\"25\" ry=\"39\" fill=\"url(#hwpb)\"/><ellipse cx=\"76\" cy=\"64\" rx=\"25\" ry=\"39\" fill=\"url(#hwpb)\"/><ellipse cx=\"60\" cy=\"64\" rx=\"26\" ry=\"41\" fill=\"url(#hwpb)\"/><g fill=\"none\" stroke=\"#7a3006\" stroke-opacity=\".45\" stroke-width=\"1.2\" stroke-linecap=\"round\"><path d=\"M47 26Q36 64 47 102\"/><path d=\"M73 26Q84 64 73 102\"/><path d=\"M31 34Q16 64 31 96\"/><path d=\"M89 34Q104 64 89 96\"/></g><path d=\"M54 27C52 17 56 9 63 6L70 10C66 15 67 21 67 28Z\" fill=\"url(#hwpt)\"/><path d=\"M60 8C64 7 67 8 69 10\" stroke=\"#c9b86a\" stroke-opacity=\".5\" stroke-width=\"1.2\" fill=\"none\" stroke-linecap=\"round\"/><g class=\"hw-pk-light\" stroke=\"#6b2a04\" stroke-width=\"1.6\" stroke-linejoin=\"round\" fill=\"url(#hwpl)\"><path d=\"M32 52L50 52L41 67Z\"/><path d=\"M70 52L88 52L79 67Z\"/><path d=\"M56 66L64 66L60 74Z\"/><path d=\"M28 78L38 75L43 84L51 76L57 85L63 76L69 84L77 75L82 84L92 78Q60 108 28 78Z\"/></g><ellipse cx=\"46\" cy=\"44\" rx=\"9\" ry=\"14\" fill=\"#fff\" opacity=\".10\" transform=\"rotate(-12 46 44)\"/></svg>";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  /* ---------- animated background layer ---------- */
  function buildBackground() {
    var bg = document.createElement("div");
    bg.className = "hw-bg";
    bg.setAttribute("aria-hidden", "true");
    bg.innerHTML =
      '<div class="hw-vignette"></div>' +
      '<div class="hw-web hw-web-tr">' + WEB_SVG + "</div>" +
      '<div class="hw-web hw-web-bl">' + WEB_SVG + "</div>" +
      '<div class="hw-embers"></div>';

    var embers = bg.querySelector(".hw-embers");
    var small = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    var count = small ? 10 : 18;
    for (var i = 0; i < count; i++) {
      var s = document.createElement("span");
      s.className = "hw-ember";
      s.style.left = (Math.random() * 100).toFixed(1) + "%";
      s.style.setProperty("--s", (2 + Math.random() * 2.4).toFixed(1) + "px");
      s.style.setProperty("--hw-drift", (Math.random() * 90 - 45).toFixed(0) + "px");
      s.style.animationDuration = (16 + Math.random() * 18).toFixed(1) + "s";
      s.style.animationDelay = (-Math.random() * 30).toFixed(1) + "s";   // already mid-flight on load
      embers.appendChild(s);
    }
    document.body.appendChild(bg);
  }

  /* ---------- hanging spider ---------- */
  function buildSpider() {
    var rig = document.createElement("div");
    rig.className = "hw-spider-rig";
    rig.setAttribute("aria-hidden", "true");
    rig.innerHTML = '<div class="hw-thread"></div><div class="hw-spider">' + SPIDER_SVG + "</div>";
    document.body.appendChild(rig);
  }

  /* ---------- homepage hero (index only) ---------- */
  function upgradeHero() {
    var grid = document.getElementById("viewerGrid");
    var hero = document.querySelector(".hero");
    if (!grid || !hero || hero.getAttribute("data-hw")) return;
    var h1 = hero.querySelector("h1");
    var p = hero.querySelector("p");
    var strip = hero.querySelector(".stat-strip");
    if (!h1 || !p) return;
    hero.setAttribute("data-hw", "1");

    var kicker = document.createElement("div");
    kicker.className = "hw-kicker";
    kicker.textContent = "Halloween Edition";
    hero.insertBefore(kicker, h1);

    h1.classList.add("hw-h1");
    h1.innerHTML = 'Welcome to <span class="hw-hero-accent">Flux Reviews</span>';

    p.classList.add("hw-tagline");
    p.textContent = "Discover. Watch. Review.";

    var row = document.createElement("div");
    row.className = "hw-cta-row";
    row.innerHTML =
      '<a class="btn btn-primary hw-cta" href="#reviews" data-hw-scroll="1">Explore Reviews</a>' +
      '<a class="btn btn-ghost hw-cta" href="/upcoming.html">Upcoming Releases</a>' +
      '<a class="btn btn-ghost hw-cta" href="/ott.html">OTT Releases</a>';
    hero.insertBefore(row, strip || null);

    row.querySelector("[data-hw-scroll]").addEventListener("click", function (e) {
      e.preventDefault();
      var target = document.querySelector(".toolbar") || grid;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ---------- active-navigation underline ---------- */
  function markActiveNav() {
    function norm(path) { return path.replace(/index\.html$/, "").replace(/\/+$/, "") || "/"; }
    var here = norm(window.location.pathname);
    var links = document.querySelectorAll(".site-header a.nav-link-btn, a.stat-pill-link");
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      if (!href || href.charAt(0) === "#") continue;
      var target;
      try { target = norm(new URL(href, window.location.href).pathname); } catch (e) { continue; }
      if (target === here) {
        links[i].classList.add("hw-active");
        links[i].setAttribute("aria-current", "page");
      }
    }
  }

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- wandering ghost (40% opacity, drifts around the whole page) ---------- */
  function buildGhost() {
    var g = document.createElement("div");
    g.className = "hw-ghost";
    g.setAttribute("aria-hidden", "true");
    g.innerHTML = '<div class="hw-ghost-flip"><div class="hw-ghost-bob">' + GHOST_SVG + "</div></div>";
    document.body.appendChild(g);

    if (reduceMotion) { g.classList.add("hw-ghost-static"); return; }   // calm version: parked in a corner

    var x = 0, y = 0;
    function place(nx, ny, seconds) {
      g.style.transition = seconds ? "transform " + seconds + "s cubic-bezier(.45,.05,.55,.95)" : "none";
      g.style.transform = "translate3d(" + Math.round(nx) + "px," + Math.round(ny) + "px,0)";
      x = nx; y = ny;
    }
    function room() {
      return {
        w: Math.max(0, window.innerWidth - g.offsetWidth - 16),
        h: Math.max(0, window.innerHeight - g.offsetHeight - 16)
      };
    }

    var r0 = room();
    place(8 + Math.random() * r0.w, 8 + Math.random() * r0.h, 0);

    function wander() {
      if (document.hidden) { setTimeout(wander, 2000); return; }       // rest while the tab is in the background
      var r = room();
      var nx = 8 + Math.random() * r.w;
      var ny = 8 + Math.random() * r.h;
      var dist = Math.sqrt((nx - x) * (nx - x) + (ny - y) * (ny - y));
      var secs = Math.min(16, Math.max(6, dist / 45));                  // slow, floaty speed
      g.classList.toggle("hw-face-left", nx < x);                       // turn to face the direction of travel
      place(nx, ny, secs);
      setTimeout(wander, secs * 1000 + 300 + Math.random() * 1700);
    }
    setTimeout(wander, 600);
  }

  /* ---------- pumpkins that pop up in a random corner, then pop away ---------- */
  function startPumpkins() {
    if (reduceMotion) return;
    var layer = document.createElement("div");
    layer.className = "hw-popups";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);

    var corners = ["tl", "tr", "bl", "br"];
    var last = "";
    function pop() {
      if (document.hidden) { setTimeout(pop, 3000); return; }
      var pool = corners.filter(function (c) { return c !== last; });  // never the same corner twice in a row
      var c = pool[Math.floor(Math.random() * pool.length)];
      last = c;

      var el = document.createElement("div");
      el.className = "hw-pumpkin hw-pk-" + c;
      el.style.setProperty("--k", (0.85 + Math.random() * 0.3).toFixed(2));
      el.style.setProperty("--tilt", (Math.random() * 16 - 8).toFixed(1) + "deg");
      el.innerHTML = '<div class="hw-pk-bob">' + PUMPKIN_SVG + "</div>";
      layer.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 6600);

      setTimeout(pop, 8000 + Math.random() * 9000);
    }
    setTimeout(pop, 3000);
  }

  ready(function () {
    buildBackground();
    buildSpider();
    buildGhost();
    startPumpkins();
    upgradeHero();
    markActiveNav();
  });
})();
