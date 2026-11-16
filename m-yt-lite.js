// ==UserScript==
// @name         YouTube Lite (móvil)
// @namespace    https://github.com/lautaro/youtube-lite
// @version      0.2.0
// @description  Interfaz liviana para m.youtube.com: sin blur/sombras/transparencias, sin Shorts ni publicaciones en el feed, sin footer, barra inferior integrada a la derecha del header y barra de filtros (Todos, Videojuegos, RAM...) eliminada. Reproduce aunque la pestaña/ventana pierda el foco y oculta el cursor sobre el video cuando queda quieto.
// @match        https://m.youtube.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /* ---------- 1. CSS (se inyecta lo antes posible) ---------- */

  const CSS = `
    /* --- Sin blur, sombras ni transparencias --- */
    html.yt-lite * {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    /* Barras de vidrio esmerilado -> color sólido del tema */
    html.yt-lite .frosted-glass,
    html.yt-lite ytm-pivot-bar-renderer,
    html.yt-lite ytm-feed-filter-chip-bar-renderer,
    html.yt-lite ytm-mobile-topbar-renderer,
    html.yt-lite ytm-header,
    html.yt-lite header.ghost-header {
      background-color: var(--yt-lite-bg, #0f0f0f) !important;
      opacity: 1 !important;
    }
    /* El header no se oculta al hacer scroll (anula las clases .out/.in de YouTube) */
    html.yt-lite ytm-mobile-topbar-renderer.sticky-player,
    html.yt-lite ytm-header.sticky-player {
      top: 0 !important;
      transform: none !important;
      transition: none !important;
      -webkit-transition: none !important;
    }
    /* Al scrollear YouTube deja el header visible en modo "ghost" pero con
       pointer-events: none, así que los clicks atravesaban. Lo forzamos
       interactivo (pointer-events se hereda, así que alcanza a los hijos,
       incluida la pivot bar integrada y el searchbox). */
    html.yt-lite ytm-mobile-topbar-renderer,
    html.yt-lite ytm-header,
    html.yt-lite header.mobile-topbar-header,
    html.yt-lite header.ghost-header {
      pointer-events: auto !important;
    }

    /* --- Feed: sin publicaciones ni Shorts --- */
    html.yt-lite ytm-backstage-post-thread-renderer,
    html.yt-lite ytm-rich-section-renderer:has(ytm-backstage-post-thread-renderer),
    html.yt-lite ytm-rich-section-renderer:has(ytm-backstage-post-renderer),
    html.yt-lite ytm-rich-item-renderer:has(ytm-backstage-post-thread-renderer),
    html.yt-lite ytm-shorts-lockup-view-model,
    html.yt-lite ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model),
    html.yt-lite ytm-rich-section-renderer:has(a[href*="/shorts/"]),
    html.yt-lite ytm-rich-item-renderer:has(a[href*="/shorts/"]) {
      display: none !important;
    }

    /* --- Footer fuera, y compensar el padding que dejaba la barra inferior --- */
    html.yt-lite footer,
    html.yt-lite #footer,
    html.yt-lite ytm-footer-renderer,
    html.yt-lite ytm-guide-links-renderer {
      display: none !important;
    }
    html.yt-lite body[has-pivot-bar="true"] ytm-app {
      padding-bottom: 0 !important;
    }

    /* --- Barra de filtros (Todos, Videojuegos, RAM, ...) fuera --- */
    html.yt-lite ytm-feed-filter-chip-bar-renderer,
    html.yt-lite #filter-chip-bar,
    html.yt-lite .chip-bar,
    html.yt-lite .rich-grid-renderer-header.rich-grid-sticky-header {
      display: none !important;
    }
    html.yt-lite .rich-grid-top-margin {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }

    /* --- Barra inferior (Principal/Shorts/Suscripciones/Tú) integrada al header --- */
    html.yt-lite header.mobile-topbar-header {
      display: flex !important;
      align-items: center !important;
      gap: 4px;
    }
    html.yt-lite header.mobile-topbar-header > yt-searchbox {
      flex: 1 1 auto;
      min-width: 0;
    }
    html.yt-lite header.mobile-topbar-header > ytm-pivot-bar-renderer {
      position: relative !important;
      inset: auto !important;
      flex: 0 0 auto;
      margin-left: auto;
      height: auto !important;
      border: 0 !important;
      padding: 0 4px 0 0 !important;
      background: transparent !important;
      justify-content: flex-end !important;
      gap: 2px;
      z-index: 2 !important;
      /* El topbar tiene pointer-events: none en modo ghost y sólo algunos
         hijos traen auto explícito. Al mudar la pivot bar adentro heredaba
         ese none; lo forzamos en el host y en todos sus descendientes. */
      pointer-events: auto !important;
    }
    html.yt-lite header.mobile-topbar-header ytm-pivot-bar-renderer * {
      pointer-events: auto !important;
    }
    html.yt-lite header.mobile-topbar-header .pivot-bar-item-tab {
      height: auto !important;
      min-height: 40px;
      padding: 4px 10px !important;
    }
    /* Solo íconos: sin textos y un solo ícono por pestaña */
    html.yt-lite header.mobile-topbar-header .pivot-bar-item-title {
      display: none !important;
    }
    html.yt-lite header.mobile-topbar-header ytm-pivot-bar-renderer c3-icon {
      display: none !important;
    }
    html.yt-lite header.mobile-topbar-header ytm-pivot-bar-renderer c3-icon[icon-state-outline] {
      display: inline-block !important;
    }
    /* En modo búsqueda el header se transforma; ahí la nav sobra */
    html.yt-lite header.mobile-topbar-header[data-mode="search"] > ytm-pivot-bar-renderer {
      display: none !important;
    }

    /* --- Cursor oculto sobre el video (tras ~1 s quieto) --- */
    /* Se aplica al container completo, no sólo al .html5-video-player: en m.youtube
       los controles/overlays pueden ser hermanos y son los que reciben el hover. */
    html.yt-lite.yt-lite-cursor-idle .html5-video-player,
    html.yt-lite.yt-lite-cursor-idle .html5-video-player *,
    html.yt-lite.yt-lite-cursor-idle .player-container,
    html.yt-lite.yt-lite-cursor-idle .player-container * {
      cursor: none !important;
    }
  `;

  const root = document.documentElement;
  if (root) root.classList.add("yt-lite");
  else
    addEventListener(
      "DOMContentLoaded",
      () => document.documentElement.classList.add("yt-lite"),
      { once: true },
    );

  function injectStyle() {
    if (document.getElementById("yt-lite-style")) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    const style = document.createElement("style");
    style.id = "yt-lite-style";
    style.textContent = CSS;
    host.appendChild(style);
    return true;
  }
  if (!injectStyle()) {
    // document-start: aún no hay <head>; inyectar apenas aparezca
    new MutationObserver((_, obs) => {
      if (injectStyle()) obs.disconnect();
    }).observe(document, { childList: true, subtree: true });
    addEventListener("DOMContentLoaded", injectStyle, { once: true });
  }

  /* ---------- 2. Mantenimiento del DOM ---------- */

  // ¿El navegador soporta :has()? Si no, el barrido JS suple al CSS
  const supportsHas =
    typeof CSS !== "undefined" &&
    CSS.supports &&
    CSS.supports("selector(:has(*))");

  function tuneBackground() {
    // Fija el color de fondo real del tema para las barras sólidas
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
        root.style.setProperty("--yt-lite-bg", bg);
      }
    } catch (_) {
      /* noop */
    }
  }

  function moveNav() {
    // Mueve la barra inferior (pivot bar) a la derecha del header superior
    const header = document.querySelector(
      "ytm-mobile-topbar-renderer header.mobile-topbar-header",
    );
    const pivot = document.querySelector("ytm-pivot-bar-renderer");
    if (!header || !pivot) return;
    if (pivot.parentElement !== header) header.appendChild(pivot);
    // Por si YouTube lo dejó como inline (un !important de stylesheet no gana
    // a un inline !important), forzamos que la barra reciba eventos.
    pivot.style.setProperty("pointer-events", "auto", "important");
  }

  function hideShelf(el) {
    const target =
      el.closest("ytm-rich-section-renderer") ||
      el.closest("ytm-rich-item-renderer") ||
      el;
    target.style.display = "none";
  }

  function sweep() {
    // Footer que aparece de forma diferida (enlaces legales, etc.)
    document
      .querySelectorAll(
        "footer, #footer, ytm-footer-renderer, ytm-guide-links-renderer",
      )
      .forEach((el) => {
        el.style.display = "none";
      });

    if (supportsHas) return; // el CSS :has ya cubre esto

    // Fallback sin :has: publicaciones
    document
      .querySelectorAll(
        "ytm-backstage-post-thread-renderer, ytm-backstage-post-renderer",
      )
      .forEach(hideShelf);
    // Fallback sin :has: Shorts del feed
    document
      .querySelectorAll("ytm-shorts-lockup-view-model")
      .forEach(hideShelf);
    document.querySelectorAll('a[href*="/shorts/"]').forEach((a) => {
      hideShelf(
        a.closest("ytm-rich-section-renderer, ytm-rich-item-renderer") || a,
      );
    });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      tuneBackground();
      moveNav();
      sweep();
    });
  }

  function start() {
    if (!document.body) return false;
    tuneBackground();
    moveNav();
    sweep();
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
    });
    addEventListener("yt-navigate-finish", schedule); // navegaciones SPA de YouTube
    return true;
  }

  if (!start()) {
    const obs = new MutationObserver((_, o) => {
      if (start()) o.disconnect();
    });
    obs.observe(document, { childList: true, subtree: true });
    addEventListener(
      "DOMContentLoaded",
      () => {
        start();
        obs.disconnect();
      },
      { once: true },
    );
  }

  /* ---------- 3. Reproducción aunque la pestaña pierda el foco ---------- */

  // YouTube pausa el video cuando la pestaña deja de estar visible (otra
  // pestaña, minimizar o pasar a otra ventana). Se le hace creer a la página
  // que siempre está visible y se bloquea el evento visibilitychange antes de
  // que llegue a los listeners del reproductor.
  try {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(document, "webkitHidden", {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    Object.defineProperty(document, "webkitVisibilityState", {
      configurable: true,
      get: () => "visible",
    });
  } catch (_) {
    /* noop */
  }

  for (const type of ["visibilitychange", "webkitvisibilitychange"]) {
    addEventListener(type, (e) => e.stopImmediatePropagation(), true);
  }

  /* ---------- 4. Cursor oculto sobre el video ---------- */

  // Antes se detectaba con e.target.closest('.html5-video-player'), pero en
  // m.youtube los controles personalizados (has-player-custom-control) son
  // overlays hermanos: el evento caía fuera del player y nunca se ocultaba.
  // Ahora se usa la posición del rect del reproductor y se oculta el cursor
  // del elemento real que hay debajo del puntero.
  let lastX = -1;
  let lastY = -1;
  let idleTimer = 0;
  let idleInterval = 0;
  let styled = [];

  function videoRect() {
    const player =
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player") ||
      document.querySelector("#player");
    if (!player) return null;
    const r = player.getBoundingClientRect();
    return r.width && r.height ? r : null;
  }

  function overVideo() {
    if (lastX < 0 || lastY < 0) return false;
    const r = videoRect();
    return (
      !!r &&
      lastX >= r.left &&
      lastX <= r.right &&
      lastY >= r.top &&
      lastY <= r.bottom
    );
  }

  function paintIdle() {
    const el = document.elementFromPoint(lastX, lastY);
    if (el && styled.indexOf(el) === -1) {
      el.style.setProperty("cursor", "none", "important");
      styled.push(el);
    }
  }

  function showCursor() {
    clearTimeout(idleTimer);
    clearInterval(idleInterval);
    idleInterval = 0;
    document.documentElement.classList.remove("yt-lite-cursor-idle");
    for (const el of styled) el.style.removeProperty("cursor");
    styled = [];
  }

  function onMove(e) {
    lastX = e.clientX;
    lastY = e.clientY;
    showCursor();
    if (!overVideo()) return;
    idleTimer = setTimeout(() => {
      document.documentElement.classList.add("yt-lite-cursor-idle");
      paintIdle();
      // Si YouTube reemplaza el elemento bajo el puntero mientras sigue quieto,
      // repintamos para que el cursor no reaparezca.
      idleInterval = setInterval(paintIdle, 250);
    }, 1000);
  }

  addEventListener("mousemove", onMove, true);
  addEventListener("mouseover", onMove, true);
  addEventListener("mouseout", (e) => {
    if (!e.relatedTarget) showCursor(); // salió de la ventana
  }, true);
})();
