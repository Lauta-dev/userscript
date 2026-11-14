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
      position: static !important;
      inset: auto !important;
      flex: 0 0 auto;
      margin-left: auto;
      height: auto !important;
      border: 0 !important;
      padding: 0 4px 0 0 !important;
      background: transparent !important;
      justify-content: flex-end !important;
      gap: 2px;
      z-index: auto !important;
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
    html.yt-lite .html5-video-player.yt-lite-cursor-off,
    html.yt-lite .html5-video-player.yt-lite-cursor-off * {
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
    if (header && pivot && pivot.parentElement !== header)
      header.appendChild(pivot);
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

  // Si el mouse queda quieto ~1 s dentro del reproductor se oculta el cursor;
  // reaparece en cuanto se mueve.
  let cursorEl = null;
  let cursorTimer = 0;

  addEventListener(
    "mousemove",
    (e) => {
      const target = e.target;
      const player =
        target && target.closest ? target.closest(".html5-video-player") : null;
      clearTimeout(cursorTimer);
      if (cursorEl && cursorEl !== player) {
        cursorEl.classList.remove("yt-lite-cursor-off");
        cursorEl = null;
      }
      if (!player) {
        cursorEl = null;
        return;
      }
      if (cursorEl === player) {
        player.classList.remove("yt-lite-cursor-off");
        cursorEl = null;
      }
      cursorTimer = setTimeout(() => {
        player.classList.add("yt-lite-cursor-off");
        cursorEl = player;
      }, 1000);
    },
    true,
  );
})();
