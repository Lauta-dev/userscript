// ==UserScript==
// @name         X Lite (Twitter)
// @namespace    https://github.com/lautaro/youtube-lite
// @version      0.1.1
// @description  X liviano: sin efectos pesados, header mínimo con solo íconos, main ampliado, sidebar derecha fuera, búsqueda como botón con popup, videos en 480p por defecto. Los cambios persisten al cambiar de vista (SPA).
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @noframes
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  /* ---------- 1. CSS (se inyecta lo antes posible) ---------- */

  const CSS = `
    /* --- Sin efectos pesados: blur, sombras, transiciones y animaciones --- */
    html.x-lite *, html.x-lite *::before, html.x-lite *::after {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
      transition: none !important;
      animation: none !important;
      animation-duration: 0s !important;
    }

    /* --- Header mínimo: columna estrecha, solo íconos, sin margen --- */
    html.x-lite header[role="banner"],
    html.x-lite header[role="banner"] > div:first-child {
      width: 68px !important;
      min-width: 68px !important;
      max-width: 68px !important;
      flex: 0 0 68px !important;
    }
    html.x-lite header[role="banner"] h1 { display: none !important; }            /* logo */
    html.x-lite header[role="banner"] .css-146c3p1 { display: none !important; }  /* textos/labels */
    html.x-lite header[role="banner"] [data-testid^="AppTabBar_"] > div,
    html.x-lite header[role="banner"] [data-testid="SideNav_NewTweet_Button"] {
      padding: 0 !important;
      margin: 0 !important;
    }
    /* Botón "Postear": pill de ícono (la pluma la agrega el JS) */
    html.x-lite header[role="banner"] a[data-testid="SideNav_NewTweet_Button"] {
      width: 52px !important;
      height: 52px !important;
      min-height: 52px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
      margin: 4px 8px !important;
      border-radius: 9999px !important;
    }
    /* Cambio de cuenta: solo el avatar */
    html.x-lite header[role="banner"] [data-testid="SideNav_AccountSwitcher_Button"] {
      width: 52px !important;
      padding: 0 !important;
      margin: 0 !important;
      justify-content: center !important;
    }
    html.x-lite header[role="banner"] [data-testid="SideNav_AccountSwitcher_Button"] svg {
      display: none !important;  /* tres puntos */
    }

    /* --- Sidebar derecha fuera y main ampliado --- */
    html.x-lite div[data-testid="sidebarColumn"] { display: none !important; }
    html.x-lite div[data-testid="primaryColumn"] {
      width: auto !important;
      max-width: min(calc(100vw - 92px), 1100px) !important;
    }

    /* --- Botón de búsqueda en el header + popup --- */
    .xlite-nav-item {
      width: 52px !important;
      height: 52px !important;
      display: flex !important;
      align-items: center;
      justify-content: center;
      border: 0;
      background: transparent;
      border-radius: 9999px;
      color: #e7e9ea;
      cursor: pointer;
      padding: 0;
    }
    .xlite-nav-item:hover { background: rgba(231, 233, 234, 0.1) !important; }
    #xlite-search-pop {
      position: fixed;
      top: 10px;
      left: 78px;
      z-index: 99999;
      width: 340px;
      background: #16181c;
      border: 1px solid #2f3336;
      border-radius: 16px;
      padding: 10px;
    }
    #xlite-search-pop input {
      width: 100%;
      box-sizing: border-box;
      background: #000;
      color: #e7e9ea;
      border: 1px solid #536471;
      border-radius: 9999px;
      padding: 10px 14px;
      font-size: 15px;
      outline: none;
    }
    .xlite-hint { color: #71767b; font-size: 12px; margin-top: 6px; }
  `;

  const root = document.documentElement;
  if (root) root.classList.add('x-lite');
  else addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('x-lite'), { once: true });

  function injectStyle() {
    if (document.getElementById('x-lite-style')) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    const style = document.createElement('style');
    style.id = 'x-lite-style';
    style.textContent = CSS;
    host.appendChild(style);
    return true;
  }
  if (!injectStyle()) {
    new MutationObserver((_, obs) => { if (injectStyle()) obs.disconnect(); })
      .observe(document, { childList: true, subtree: true });
    addEventListener('DOMContentLoaded', injectStyle, { once: true });
  }

  /* ---------- 2. Header: ocultar labels por estructura + inyectar botones ---------- */

  const SEARCH_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor"><g><path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z"></path></g></svg>';
  const FEATHER_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="#0f1419" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';

  function ensureHeader() {
    const nav = document.querySelector('header[role="banner"] nav');
    if (!nav) return;

    // Quitar labels/textos dejando solo el primer ícono de cada botón del nav
    nav.querySelectorAll('[data-testid^="AppTabBar_"]').forEach((el) => {
      const pill = el.firstElementChild;
      if (!pill) return;
      [...pill.children].slice(1).forEach((c) => { c.style.display = 'none'; });
    });

    // Botón "Postear": solo la pluma
    const post = document.querySelector('header[role="banner"] a[data-testid="SideNav_NewTweet_Button"]');
    if (post) {
      [...post.children].forEach((c) => { c.style.display = 'none'; });
      if (!post.querySelector('.xlite-feather')) {
        const w = document.createElement('span');
        w.className = 'xlite-feather';
        w.style.display = 'contents';
        w.innerHTML = FEATHER_ICON;
        post.appendChild(w);
      }
    }

    // Cambio de cuenta: mantener solo el bloque del avatar
    const acct = document.querySelector('header[role="banner"] [data-testid="SideNav_AccountSwitcher_Button"]');
    if (acct) {
      [...acct.children].forEach((c) => {
        if (!c.querySelector('[data-testid^="UserAvatar-Container"]')) c.style.display = 'none';
      });
    }

    // Botón de búsqueda (el input nativo vive en la sidebar que está oculta)
    if (!nav.querySelector('#xlite-search-btn')) {
      const btn = document.createElement('button');
      btn.id = 'xlite-search-btn';
      btn.type = 'button';
      btn.className = 'xlite-nav-item';
      btn.setAttribute('aria-label', 'Buscar');
      btn.innerHTML = SEARCH_ICON;
      btn.addEventListener('click', toggleSearch);
      const more = nav.querySelector('[data-testid="AppTabBar_More_Menu"]');
      if (more && more.parentElement === nav) more.insertAdjacentElement('afterend', btn);
      else nav.appendChild(btn);
    }
  }

  /* ---------- 3. Popup de búsqueda ---------- */

  let pop = null;
  let input = null;

  function ensurePopup() {
    if (pop && pop.isConnected) return;
    pop = document.createElement('div');
    pop.id = 'xlite-search-pop';
    pop.hidden = true;
    pop.innerHTML = '<form role="search"><input type="search" placeholder="Buscar en X" aria-label="Buscar en X"></form><div class="xlite-hint">Enter: buscar · Esc: cerrar</div>';
    document.body.appendChild(pop);
    input = pop.querySelector('input');
    pop.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      hideSearch();
      if (q) location.assign('https://x.com/search?q=' + encodeURIComponent(q) + '&src=typed_query');
    });
  }

  function showSearch() {
    ensurePopup();
    pop.hidden = false;
    input.value = '';
    input.focus();
  }
  function hideSearch() { if (pop) pop.hidden = true; }
  function toggleSearch() {
    ensurePopup();
    if (pop.hidden) showSearch(); else hideSearch();
  }

  document.addEventListener('click', (e) => {
    if (pop && !pop.hidden && !pop.contains(e.target) && !e.target.closest('#xlite-search-btn')) hideSearch();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideSearch(); return; }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!typing) { e.preventDefault(); showSearch(); }
    }
  });

  /* ---------- 4. Composer inline de la home fuera ---------- */

  // La raíz del composer ("¿Qué está pasando?" + avatar + íconos + Postear) no
  // tiene data-testid propio. Se la detecta por estructura: es el ancestro del
  // toolBar cuyos hermanos siguientes llevan a la cronología (section region).
  // Solo en la home (columna con pestañas), para no tocar el box de respuesta.
  function hideInlineComposer() {
    const col = document.querySelector('div[data-testid="primaryColumn"]');
    if (!col || !col.querySelector('[role="tablist"]')) return;
    const tb = col.querySelector('div[data-testid="toolBar"]');
    if (!tb) return;
    const timeline = col.querySelector('section[role="region"]');
    let a = tb;
    while (a && a.parentElement && col.contains(a)) {
      let sib = a.nextElementSibling;
      let hops = 0;
      let hit = false;
      while (sib && hops < 4) {
        if (timeline && (sib === timeline || sib.contains(timeline))) { hit = true; break; }
        sib = sib.nextElementSibling;
        hops++;
      }
      if (hit) {
        a.style.display = 'none';
        return;
      }
      a = a.parentElement;
    }
  }

  /* ---------- 5. Videos a 480p por defecto ---------- */

  // El <video> existe en el DOM (se monta al reproducir), pero la calidad no es
  // una propiedad del tag: la resuelve el player de X con su menú
  // "Calidad del video". El script abre ese menú y elige 480p por vos.
  function forceQuality(video, q) {
    try {
      const player = video.closest('[data-testid="videoPlayer"]') || video.closest('div[role="group"]') || video.parentElement;
      if (!player) return false;

      // Mostrar los controles (simula actividad del mouse)
      const r = player.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      ['pointermove', 'mousemove', 'mouseover', 'mouseenter'].forEach((t) => {
        player.dispatchEvent(t.startsWith('pointer') ? new PointerEvent(t, opts) : new MouseEvent(t, opts));
      });

      // Abrir el menú de configuración del player
      const cfg = player.querySelector('[aria-label*="configura" i], [aria-label*="settings" i], [data-testid*="settings" i]');
      if (!cfg) return false;
      cfg.click();

      return pickQuality(q);
    } catch (err) {
      console.debug('[x-lite] forceQuality:', err);
      return false;
    }
  }

  function pickQuality(q, depth = 0) {
    const visible = [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="radio"], [role="menu"] [role="button"], [role="dialog"] [role="button"]')]
      .filter((el) => el.offsetParent !== null);
    const txt = (el) => (el.textContent || '').trim().toLowerCase();

    // 1) ¿Hay una opción de calidad directa?
    const direct = visible.find((el) => txt(el).includes(q));
    if (direct) { direct.click(); return true; }

    // 2) Abrir el submenú "Calidad del video" y volver a buscar
    const quality = visible.find((el) => /calidad del video|video quality/.test(txt(el)));
    if (quality && depth < 2) {
      quality.click();
      return pickQuality(q, depth + 1);
    }
    return false;
  }

  const watched = new WeakSet();
  function watchVideos(scope) {
    scope.querySelectorAll('video').forEach((v) => {
      if (watched.has(v)) return;
      watched.add(v);
      // Al empezar a reproducirse: abrir el menú y fijar 480p (una vez por video)
      v.addEventListener('playing', () => {
        if (v.dataset.xlite480) return;
        v.dataset.xlite480 = '1';
        setTimeout(() => {
          const ok = forceQuality(v, '480');
          console.info('[x-lite] 480p ' + (ok ? 'aplicado' : 'no disponible (¿menú distinto?)'));
        }, 700);
      });
    });
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('480p: forzar en el video actual', () => {
      const v = [...document.querySelectorAll('video')].find((x) => !x.paused && !x.ended) || document.querySelector('video');
      if (v) forceQuality(v, '480');
    });
  }

  /* ---------- 5. Persistencia entre vistas (SPA) ---------- */

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureHeader();
      hideInlineComposer();
      watchVideos(document);
    });
  }

  function start() {
    if (!document.body) return false;
    schedule();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    return true;
  }

  if (!start()) {
    const obs = new MutationObserver((_, o) => { if (start()) o.disconnect(); });
    obs.observe(document, { childList: true, subtree: true });
    addEventListener('DOMContentLoaded', () => { start(); obs.disconnect(); }, { once: true });
  }
})();
