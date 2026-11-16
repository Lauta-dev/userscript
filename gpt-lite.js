// ==UserScript==
// @name         ChatGPT Lite
// @namespace    https://github.com/lautaro/youtube-lite
// @version      0.1.0
// @description  ChatGPT liviano: sin blur/sombras/animaciones/gradientes, sin banners de Upgrade, sin chips de sugerencias, sin botones de voz/imagen y sin el disclaimer de "can make mistakes". El sidebar se conserva.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ---------- 1. CSS ---------- */

  const CSS = `
    /* --- Sin blur, sombras ni transparencias --- */
    html.gpt-lite * {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
      animation: none !important;
      -webkit-animation: none !important;
      transition: none !important;
      -webkit-transition: none !important;
    }
    /* Fondos sólidos: nada de gradientes */
    html.gpt-lite [style*="background-image"],
    html.gpt-lite [class*="gradient"] {
      background-image: none !important;
    }

    /* --- Upsells y banners --- */
    html.gpt-lite a[href*="upgrade" i],
    html.gpt-lite a[href*="/plus" i],
    html.gpt-lite button[data-testid*="upgrade" i],
    html.gpt-lite [data-testid*="upgrade" i],
    html.gpt-lite [data-testid*="paywall" i],
    html.gpt-lite [data-testid*="promo" i],
    html.gpt-lite [data-testid*="banner" i],
    html.gpt-lite [aria-label*="upgrade" i] {
      display: none !important;
    }

    /* --- Chips de sugerencias / starters --- */
    html.gpt-lite [data-testid*="suggestion" i],
    html.gpt-lite [data-testid*="starter" i],
    html.gpt-lite [data-testid*="quick-prompt" i] {
      display: none !important;
    }

    /* --- Botones de voz / imagen del composer --- */
    html.gpt-lite button[aria-label*="voice" i],
    html.gpt-lite button[aria-label*="dictate" i],
    html.gpt-lite button[aria-label*="microphone" i],
    html.gpt-lite button[aria-label*="image" i] {
      display: none !important;
    }
  `;

  const root = document.documentElement;
  if (root) root.classList.add('gpt-lite');
  else addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('gpt-lite'), { once: true });

  function injectStyle() {
    if (document.getElementById('gpt-lite-style')) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    const style = document.createElement('style');
    style.id = 'gpt-lite-style';
    style.textContent = CSS;
    host.appendChild(style);
    return true;
  }
  if (!injectStyle()) {
    new MutationObserver((_, obs) => { if (injectStyle()) obs.disconnect(); })
      .observe(document, { childList: true, subtree: true });
    addEventListener('DOMContentLoaded', injectStyle, { once: true });
  }

  /* ---------- 2. Barrido por texto (selectores frágiles -> texto) ---------- */

  const UPGRADE = /upgrade|get plus|subscribe|premium/i;
  const SUGGEST = /create image|help me write|summarize text|make a plan|analyze data|brainstorm|write code|give me ideas|surprise me/i;
  const DISCLAIMER = /ChatGPT (can|may) (make mistakes|produce inaccurate)|Check important info/i;

  function hide(el) {
    el.style.setProperty('display', 'none', 'important');
  }

  function sweep() {
    const body = document.body;
    if (!body) return;

    // Botones/enlaces de upsell (en todo el documento) y de sugerencias (sólo en main).
    for (const b of document.querySelectorAll('button, a, [role="button"]')) {
      const label = (b.getAttribute('aria-label') || '') + ' ' +
                    (b.getAttribute('title') || '') + ' ' + (b.textContent || '');
      if (UPGRADE.test(label) || (SUGGEST.test(label) && b.closest('main'))) hide(b);
    }

    // Disclaimer: ocultamos el elemento padre del nodo de texto que lo contiene.
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const hits = [];
    let node;
    while ((node = walker.nextNode())) {
      if (DISCLAIMER.test(node.nodeValue || '')) hits.push(node.parentElement);
    }
    for (const el of hits) if (el) hide(el);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sweep(); });
  }

  function start() {
    if (!document.body) return false;
    sweep();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    addEventListener('popstate', schedule);
    return true;
  }

  if (!start()) {
    const obs = new MutationObserver((_, o) => { if (start()) o.disconnect(); });
    obs.observe(document, { childList: true, subtree: true });
    addEventListener('DOMContentLoaded', () => { start(); obs.disconnect(); }, { once: true });
  }
})();
