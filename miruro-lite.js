// ==UserScript==
// @name         Miruro Lite
// @namespace    https://github.com/lautaro/miruro-lite
// @version      0.1.0
// @description  Miruro liviano: sin blur/sombras/animaciones/gradientes, sin banner de anuncios, hero simplificado (sin backdrops ni dots) y sin scripts de publicidad.
// @match        https://miruro.cx/*
// @match        https://www.miruro.cx/*
// @match        https://miruro.com/*
// @match        https://www.miruro.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ---------- 1. CSS ---------- */

  const CSS = `
    /* Sin banner: el sitio usa --banner-offset para correr header/rail/content */
    html.miruro-lite { --banner-offset: 0px !important; }
    html.miruro-lite [data-announcements] { display: none !important; }

    /* --- Sin blur, sombras, gradientes ni animaciones --- */
    /* Se usan durations en 0 en vez de animation:none para no dejar elementos
       a mitad de fade (las cards usan reveal animado). */
    html.miruro-lite *,
    html.miruro-lite *::before,
    html.miruro-lite *::after {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      scroll-behavior: auto !important;
    }
    html.miruro-lite [style*="background-image"],
    html.miruro-lite [class*="gradient"],
    html.miruro-lite [class*="bg-linear"] {
      background-image: none !important;
    }

    /* --- Hero: se van los 9 backdrops con kenburns, el scrim y los dots --- */
    html.miruro-lite .hero .banner-bg,
    html.miruro-lite .hero .indicators { display: none !important; }
    html.miruro-lite .hero { min-height: 0 !important; }

    /* --- Página de reproducción --- */
    /* Backdrop fijo del player: imagen con blur-xs + bg-background/55 +
       gradiente. Es lo más pesado de la página y no aporta al video. */
    html.miruro-lite [data-route-content] > div > div.pointer-events-none.fixed {
      display: none !important;
    }
    /* --- Comentarios: no se cargan hasta que se pulse el botón --- */
    html.miruro-lite #anime-community-comment-section:not(.lite-loaded) {
      display: none !important;
    }
    html.miruro-lite #miruro-lite-comments-btn {
      appearance: none;
      background: transparent !important;
      border: 1px solid currentColor !important;
      border-radius: 6px;
      color: inherit !important;
      cursor: pointer;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.4rem 0.8rem;
    }

    /* --- Ads --- */
    html.miruro-lite [id^="monkey-pop-"],
    html.miruro-lite .monetag,
    html.miruro-lite .hilltopads,
    html.miruro-lite .adcash,
    html.miruro-lite .adsterra,
    html.miruro-lite [data-ad],
    html.miruro-lite [data-ad-container] { display: none !important; }

    /* --- Compaction leve --- */
    html.miruro-lite [data-route-content] > div {
      padding-top: 1rem !important;
      padding-bottom: 2rem !important;
    }
    html.miruro-lite .gap-10 { gap: 1.5rem !important; }
  `;

  const root = document.documentElement;
  if (root) root.classList.add('miruro-lite');
  else addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('miruro-lite'), { once: true });

  function injectStyle() {
    if (document.getElementById('miruro-lite-style')) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    const style = document.createElement('style');
    style.id = 'miruro-lite-style';
    style.textContent = CSS;
    host.appendChild(style);
    return true;
  }
  if (!injectStyle()) {
    new MutationObserver((_, obs) => { if (injectStyle()) obs.disconnect(); })
      .observe(document, { childList: true, subtree: true });
    addEventListener('DOMContentLoaded', injectStyle, { once: true });
  }

  /* ---------- 2. Bloqueo de publicidad ---------- */

  // Ojo: NO incluir keeply.top, es el proxy de streams (PUBLIC_PROXY_A/B).
  const AD = /llvpn\.com|gregariousstretch\.com|hilltopads|acscdn\.com|adcash\.com|adsterra\.com|otieu\.com|dvwztnx4ab3fl\.cloudfront\.net/i;

  function isAdScript(node) {
    if (!node || node.tagName !== 'SCRIPT') return false;
    const src = node.getAttribute('src') || '';
    return AD.test(src);
  }

  function neutralize(node) {
    if (!node || node.nodeType !== 1) return;
    if (isAdScript(node)) {
      node.setAttribute('type', 'text/plain'); // evitar ejecución aunque ya se haya insertado
      node.remove();
      return;
    }
    if (node.querySelectorAll) {
      node.querySelectorAll('script').forEach((s) => {
        if (isAdScript(s)) { s.setAttribute('type', 'text/plain'); s.remove(); }
      });
    }
  }

  // Firefox: última chance antes de ejecutar el script.
  addEventListener('beforescriptexecute', (e) => {
    if (isAdScript(e.target)) e.preventDefault();
  }, true);

  // fetch / XHR / beacon
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (AD.test(url)) return Promise.resolve(new Response(null, { status: 204 }));
      return origFetch.apply(this, arguments);
    };
  }

  const xp = XMLHttpRequest.prototype;
  const origOpen = xp.open;
  xp.open = function (method, url) {
    if (AD.test(String(url))) this.__miruroLiteBlocked = true;
    return origOpen.apply(this, arguments);
  };
  const origSend = xp.send;
  xp.send = function () {
    if (this.__miruroLiteBlocked) return;
    return origSend.apply(this, arguments);
  };

  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url) {
      if (AD.test(String(url))) return true;
      return origBeacon.apply(this, arguments);
    };
  }

  /* ---------- 3. Comentarios bajo demanda ---------- */

  const FRAME_ID = 'anime-community-comment-section-iframe';
  const WRAP_ID = 'anime-community-comment-section';
  const BTN_ID = 'miruro-lite-comments-btn';
  const BLANK = 'about:blank';

  const seenFrames = new WeakSet();
  let commentsLoaded = false;

  function addButton() {
    if (document.getElementById(BTN_ID)) return;
    const controls = document.querySelector('[role="group"][aria-label="Comments controls"]');
    if (!controls) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = BTN_ID;
    btn.textContent = 'Cargar comentarios';
    btn.addEventListener('click', () => {
      const frame = document.getElementById(FRAME_ID);
      if (!frame) return;
      const src = frame.getAttribute('data-lite-src') || frame.getAttribute('src');
      commentsLoaded = true;
      if (src && src !== BLANK) frame.setAttribute('src', src);
      const wrap = document.getElementById(WRAP_ID);
      if (wrap) wrap.classList.add('lite-loaded');
      btn.remove();
    });
    controls.appendChild(btn);
  }

  function parkFrame(frame) {
    if (seenFrames.has(frame)) return;
    seenFrames.add(frame);
    commentsLoaded = false; // cada episodio requiere un click nuevo
    const src = frame.getAttribute('src');
    if (src && src !== BLANK) {
      frame.setAttribute('data-lite-src', src);
      frame.setAttribute('src', BLANK); // cancela la carga del widget
    }
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.classList.remove('lite-loaded');
    addButton();
  }

  function findFrames(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.id === FRAME_ID) parkFrame(root);
    if (root.querySelectorAll) root.querySelectorAll('#' + FRAME_ID).forEach(parkFrame);
  }

  // Si la app cambia el src (botones Anime / Ep X) antes del click, lo guardamos
  // y lo volvemos a estacionar para que no se cargue igual.
  new MutationObserver((records) => {
    for (const r of records) {
      const frame = r.target;
      if (!frame || frame.id !== FRAME_ID || r.attributeName !== 'src') continue;
      const src = frame.getAttribute('src');
      if (!src || src === BLANK) continue; // el cambio que hicimos nosotros
      frame.setAttribute('data-lite-src', src);
      if (!commentsLoaded) frame.setAttribute('src', BLANK);
    }
  }).observe(document, { attributes: true, attributeFilter: ['src'], subtree: true });

  /* ---------- 4. Mantenimiento del DOM ---------- */

  const AD_NODES = '[id^="monkey-pop-"], .monetag, .hilltopads, .adcash, .adsterra, [data-ad], [data-ad-container]';

  function sweep() {
    document.querySelectorAll(AD_NODES).forEach((el) => el.remove());
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sweep(); });
  }

  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) { neutralize(n); findFrames(n); }
    }
    schedule();
  }).observe(document, { childList: true, subtree: true });

  sweep();
  findFrames(document); // cubre el iframe que ya venía en el HTML inicial
  addButton();
  addEventListener('load', sweep, { once: true });
})();
