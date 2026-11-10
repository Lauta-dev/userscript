// ==UserScript==
// @name         YouTube Lite
// @namespace    https://github.com/lautaro/youtube-lite
// @version      1.4.0
// @description  Deja YouTube liviano y sin distracciones: oculta Shorts, recomendaciones, comentarios, anuncios, quita animaciones y limita la calidad de video.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  /* ---------- Configuración (se guarda con el menú de Tampermonkey/Violentmonkey) ---------- */
  const DEFAULTS = {
    hideShorts: true,        // Shorts en home, búsqueda, sidebar y suscripciones
    hideHomeFeed: false,     // Feed de recomendaciones de la home (deja solo la búsqueda)
    transparentHeader: true, // Header (masthead) transparente en todas las vistas y sin la capa #frosted-glass
    hideChips: true,         // Barra de filtros de la home (Todos, Videojuegos, Música...)
    hideRelated: false,      // Videos recomendados al costado/abajo del video
    hideComments: false,     // Sección de comentarios
    hideEndCards: true,      // Tarjetas y pantalla final sobre el video
    hideAds: true,           // Banners y slots de anuncios (no toca los anuncios dentro del video)
    noAnimations: true,      // Quita transiciones y animaciones CSS
    noHeavyEffects: true,    // Quita blur, sombras, backdrop-filter y el modo cine (luces ambientales)
    noHoverPreview: true,    // Desactiva la reproducción al pasar el mouse por miniaturas
    disableAutoplayNext: true, // Apaga "Reproducción automática"
    blockTelemetry: true,    // Cancela métricas/logging de YouTube (log_event, qoe, ptracking, play.google.com/log)
    blockAdRequests: true,   // Cancela pedidos a dominios y rutas de anuncios (pagead, doubleclick, etc.)
    blockShortsApi: true,    // Cancela la API interna de Shorts (/youtubei/v1/reel/)
    blockHistoryPings: false,// Cancela playback/watchtime: YA NO se guarda el historial ni el progreso de los videos
    fluidGrid: true,         // Grid de miniaturas que se adapta al ancho de la pantalla (home, suscripciones, canales)
    gridMinItemWidth: 300,   // Ancho mínimo de cada miniatura en px; menos = más columnas
    maxQuality: 'off',       // off | small(240p) | medium(360p) | large(480p) | hd720
  };

  const QUALITY_CYCLE = ['off', 'small', 'medium', 'large', 'hd720'];
  const QUALITY_LABEL = { off: 'sin límite', small: '240p', medium: '360p', large: '480p', hd720: '720p' };

  const cfg = {};
  for (const k in DEFAULTS) cfg[k] = GM_getValue(k, DEFAULTS[k]);

  /* ---------- Menú ---------- */
  const labels = {
    hideShorts: 'Ocultar Shorts',
    hideHomeFeed: 'Ocultar feed de la home',
    transparentHeader: 'Header transparente (sin frosted-glass)',
    hideChips: 'Ocultar barra de filtros (Todos, Videojuegos...)',
    hideRelated: 'Ocultar videos relacionados',
    hideComments: 'Ocultar comentarios',
    hideEndCards: 'Ocultar end cards',
    hideAds: 'Ocultar anuncios (banners)',
    noAnimations: 'Quitar animaciones',
    noHeavyEffects: 'Quitar efectos pesados (blur/sombras/modo cine)',
    noHoverPreview: 'Sin preview al hacer hover',
    disableAutoplayNext: 'Desactivar autoplay',
    fluidGrid: 'Grid adaptable a la pantalla',
    blockTelemetry: 'Bloquear telemetría',
    blockAdRequests: 'Bloquear pedidos de anuncios',
    blockShortsApi: 'Bloquear API de Shorts',
    blockHistoryPings: 'Bloquear historial/progreso (⚠️ no guarda lo que mirás)',
  };

  for (const key in labels) {
    GM_registerMenuCommand(`${cfg[key] ? '✅' : '❌'} ${labels[key]}`, () => {
      GM_setValue(key, !cfg[key]);
      location.reload();
    });
  }
  const GRID_WIDTHS = [220, 260, 300, 360, 420];
  GM_registerMenuCommand(`📐 Ancho mínimo de miniatura: ${cfg.gridMinItemWidth}px (cambiar)`, () => {
    const i = GRID_WIDTHS.indexOf(cfg.gridMinItemWidth);
    GM_setValue('gridMinItemWidth', GRID_WIDTHS[(i + 1) % GRID_WIDTHS.length]);
    location.reload();
  });
  GM_registerMenuCommand(`🎞️ Calidad máxima: ${QUALITY_LABEL[cfg.maxQuality]} (cambiar)`, () => {
    const next = QUALITY_CYCLE[(QUALITY_CYCLE.indexOf(cfg.maxQuality) + 1) % QUALITY_CYCLE.length];
    GM_setValue('maxQuality', next);
    location.reload();
  });

  /* ---------- Intercepción de pedidos (fetch / XHR / sendBeacon) ---------- */
  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  const BLOCK_RULES = [];
  const rule = (enabled, test) => { if (enabled) BLOCK_RULES.push(test); };

  // Telemetría
  rule(cfg.blockTelemetry, (h, p) =>
    /^\/youtubei\/v1\/log_event/.test(p) ||
    /^\/api\/stats\/(qoe|atr|delayplay|engage)/.test(p) ||
    /^\/ptracking/.test(p) ||
    /^\/generate_204/.test(p) ||
    (h === 'play.google.com' && /^\/log/.test(p)));
  // Anuncios
  rule(cfg.blockAdRequests, (h, p) =>
    /(^|\.)(doubleclick\.net|googlesyndication\.com|googleadservices\.com)$/.test(h) ||
    /^\/pagead\//.test(p) ||
    /^\/api\/stats\/ads/.test(p));
  // Shorts
  rule(cfg.blockShortsApi, (h, p) => /^\/youtubei\/v1\/reel\//.test(p));
  // Historial y progreso de reproducción
  rule(cfg.blockHistoryPings, (h, p) => /^\/api\/stats\/(playback|watchtime)/.test(p));

  function shouldBlock(url) {
    if (!BLOCK_RULES.length || !url) return false;
    try {
      const u = new URL(String(url), location.href);
      return BLOCK_RULES.some((t) => t(u.hostname, u.pathname));
    } catch (e) {
      return false;
    }
  }

  if (BLOCK_RULES.length) {
    // fetch
    const origFetch = W.fetch;
    W.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || input;
      if (shouldBlock(url)) return Promise.resolve(new W.Response(null, { status: 204 }));
      return origFetch.apply(this, arguments);
    };

    // XMLHttpRequest
    const XHR = W.XMLHttpRequest.prototype;
    const origOpen = XHR.open;
    const origSend = XHR.send;
    XHR.open = function (method, url) {
      this.__ytLiteBlocked = shouldBlock(url);
      return origOpen.apply(this, arguments);
    };
    XHR.send = function () {
      if (this.__ytLiteBlocked) return; // no se envía
      return origSend.apply(this, arguments);
    };

    // sendBeacon
    if (W.navigator.sendBeacon) {
      const origBeacon = W.navigator.sendBeacon;
      W.navigator.sendBeacon = function (url) {
        if (shouldBlock(url)) return true;
        return origBeacon.apply(this, arguments);
      };
    }
  }

  /* ---------- CSS ---------- */
  const css = [];

  if (cfg.hideShorts) css.push(`
    ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
    ytd-rich-shelf-renderer[is-shorts],
    ytd-reel-shelf-renderer,
    ytd-shorts,
    ytd-guide-entry-renderer:has(a[title="Shorts"]),
    ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
    grid-shelf-view-model:has(a[href^="/shorts/"]),
    ytd-video-renderer:has(a[href^="/shorts/"]),
    ytd-grid-video-renderer:has(a[href^="/shorts/"]),
    ytd-rich-item-renderer:has(a[href^="/shorts/"]),
    ytm-shorts-lockup-view-model,
    ytm-shorts-lockup-view-model-v2,
    ytm-reel-shelf-renderer { display: none !important; }
  `);

  if (cfg.hideHomeFeed) css.push(`
    ytd-browse[page-subtype="home"] #contents.ytd-rich-grid-renderer,
    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #header { display: none !important; }
  `);

  if (cfg.transparentHeader) css.push(`
    #frosted-glass { display: none !important; }
    ytd-masthead,
    ytd-masthead #background,
    #masthead-container {
      background: transparent !important;
      background-color: transparent !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
      border-bottom: none !important;
    }
  `);

  if (cfg.hideChips) css.push(`
    ytd-rich-grid-renderer ytd-feed-filter-chip-bar-renderer,
    ytd-rich-grid-renderer > #header:has(ytd-feed-filter-chip-bar-renderer) { display: none !important; }
  `);

  if (cfg.hideRelated) css.push(`
    ytd-watch-flexy #secondary,
    ytd-watch-next-secondary-results-renderer { display: none !important; }
    ytd-watch-flexy[flexy]:not([fullscreen]) #primary { max-width: 1280px; margin: 0 auto; }
  `);

  if (cfg.hideComments) css.push(`
    ytd-comments#comments,
    ytd-comments-entry-point-header-renderer { display: none !important; }
  `);

  if (cfg.hideEndCards) css.push(`
    .ytp-ce-element,
    .ytp-endscreen-content,
    .ytp-ce-covering-overlay,
    .ytp-cards-teaser,
    .ytp-cards-button,
    .ytp-suggested-action,
    .videowall-endscreen { display: none !important; }
  `);

  if (cfg.hideAds) css.push(`
    #masthead-ad,
    ytd-ad-slot-renderer,
    ytd-in-feed-ad-layout-renderer,
    ytd-banner-promo-renderer,
    ytd-statement-banner-renderer,
    ytd-companion-slot-renderer,
    ytd-promoted-sparkles-web-renderer,
    ytd-display-ad-renderer,
    ytd-merch-shelf-renderer,
    ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
    #player-ads,
    ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
    ytd-rich-section-renderer:has(ytd-ad-slot-renderer),
    ytd-rich-section-renderer:has(ytd-statement-banner-renderer) { display: none !important; }
  `);

  if (cfg.noAnimations) css.push(`
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  `);

  if (cfg.noHeavyEffects) css.push(`
    #cinematics,
    #cinematics-container,
    #cinematics-full-bleed-container,
    .ytp-gradient-top,
    .ytp-gradient-bottom { display: none !important; }
    *:not(video):not(.html5-video-container) {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
      will-change: auto !important;
    }
  `);

  if (cfg.noHoverPreview) css.push(`
    ytd-video-preview,
    #video-preview,
    #mouseover-overlay,
    ytd-thumbnail #hover-overlays { display: none !important; }
  `);

  const style = document.createElement('style');
  style.id = 'yt-lite-style';
  style.textContent = css.join('\n');
  (document.head || document.documentElement).appendChild(style);

  /* ---------- Grid fluido ---------- */
  // YouTube calcula --ytd-rich-grid-items-per-row por JS (2 columnas a 1366px). Medimos el ancho real
  // del grid, calculamos cuántas miniaturas de gridMinItemWidth entran y lo forzamos con !important.
  if (cfg.fluidGrid) {
    const GAP = 16;        // --ytd-rich-grid-item-margin
    const MAX_COLS = 10;
    const gridStyle = document.createElement('style');
    gridStyle.id = 'yt-lite-grid';
    (document.head || document.documentElement).appendChild(gridStyle);
    let lastCols = 0;
    let raf = 0;

    function updateGrid() {
      raf = 0;
      const grid = document.querySelector('ytd-rich-grid-renderer');
      if (!grid) return;
      const w = grid.getBoundingClientRect().width;
      if (!w) return;
      const cols = Math.max(1, Math.min(MAX_COLS, Math.floor(w / (cfg.gridMinItemWidth + GAP))));
      if (cols === lastCols) return;
      lastCols = cols;
      gridStyle.textContent =
        'ytd-rich-grid-renderer {' +
        ' --ytd-rich-grid-items-per-row: ' + cols + ' !important;' +
        ' --ytd-rich-grid-item-min-width: ' + cfg.gridMinItemWidth + 'px !important;' +
        ' --ytd-rich-grid-item-max-width: none !important; }';
    }

    const schedule = () => { if (!raf) raf = requestAnimationFrame(updateGrid); };
    // El grid se renderiza después de la navegación: reintentos cortos
    const kick = () => { lastCols = 0; [0, 300, 1000, 2500].forEach((ms) => setTimeout(schedule, ms)); };

    window.addEventListener('resize', schedule);
    window.addEventListener('yt-navigate-finish', kick);
    window.addEventListener('yt-page-data-updated', kick);
    document.addEventListener('DOMContentLoaded', kick);
    kick();
  }

  /* ---------- Quitar el hueco que deja la barra de filtros ---------- */
  // YouTube reserva espacio arriba del grid para la barra de filtros aunque la ocultemos. No sabemos
  // qué regla lo genera (cambia seguido), así que medimos la distancia entre el masthead y la primera
  // fila y la reducimos con un margen negativo hasta dejar TOP_GAP px.
  if (cfg.hideChips) {
    const TOP_GAP = 20;     // px entre el masthead y la primera fila
    const MAX_SHIFT = 240;  // tope de seguridad
    const PAGES = ['home', 'subscriptions'];
    const shiftStyle = document.createElement('style');
    shiftStyle.id = 'yt-lite-shift';
    (document.head || document.documentElement).appendChild(shiftStyle);
    let shift = 0;
    let rafGap = 0;

    function fixTopGap() {
      rafGap = 0;
      let grid = null;
      for (const sub of PAGES) {
        const g = document.querySelector('ytd-browse:not([hidden])[page-subtype="' + sub + '"] ytd-rich-grid-renderer');
        if (g && g.offsetParent !== null) { grid = g; break; }
      }
      if (!grid) return;
      const contents = grid.querySelector(':scope > #contents');
      if (!contents) return;
      const mast = document.querySelector('#masthead-container') || document.querySelector('ytd-masthead');
      const mastH = mast ? mast.getBoundingClientRect().height : 56;

      for (let i = 0; i < 3; i++) {
        const first = Array.from(contents.children).find((el) => el.offsetHeight > 0);
        if (!first) return;
        const gap = first.getBoundingClientRect().top + window.scrollY - mastH;
        const extra = Math.round(gap - TOP_GAP);
        if (Math.abs(extra) < 3) return;
        const next = Math.max(0, Math.min(MAX_SHIFT, shift + extra));
        if (next === shift) return;
        shift = next;
        shiftStyle.textContent = PAGES.map((sub) =>
          'ytd-browse[page-subtype="' + sub + '"] ytd-rich-grid-renderer > #contents' +
          ' { margin-top: -' + shift + 'px !important; }').join('\n');
      }
    }

    const scheduleGap = () => { if (!rafGap) rafGap = requestAnimationFrame(fixTopGap); };
    const kickGap = () => [0, 300, 1000, 2500, 5000].forEach((ms) => setTimeout(scheduleGap, ms));

    window.addEventListener('resize', scheduleGap);
    window.addEventListener('yt-navigate-finish', kickGap);
    window.addEventListener('yt-page-data-updated', kickGap);
    document.addEventListener('DOMContentLoaded', kickGap);
    kickGap();
  }

  /* ---------- Comportamiento del reproductor ---------- */
  function tuneQuality() {
    if (cfg.maxQuality === 'off') return;
    const p = document.getElementById('movie_player');
    if (!p || typeof p.setPlaybackQualityRange !== 'function') return false;
    try {
      p.setPlaybackQualityRange(cfg.maxQuality, cfg.maxQuality);
      if (typeof p.setPlaybackQuality === 'function') p.setPlaybackQuality(cfg.maxQuality);
      return true;
    } catch (e) {
      return false;
    }
  }

  function disableAutoplay() {
    if (!cfg.disableAutoplayNext) return;
    const btn = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
    if (btn) btn.click();
  }

  // Reintenta unas veces porque el reproductor tarda en inicializarse
  function applyPlayerTweaks() {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      tuneQuality();
      disableAutoplay();
      if (tries >= 10) clearInterval(timer);
    }, 1000);
  }

  window.addEventListener('yt-navigate-finish', applyPlayerTweaks);
  window.addEventListener('yt-page-data-updated', applyPlayerTweaks);
  document.addEventListener('DOMContentLoaded', applyPlayerTweaks);
})();
