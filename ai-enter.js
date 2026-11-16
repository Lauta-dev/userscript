// ==UserScript==
// @name         AI Chat: ENTER = salto de línea, CTRL+ENTER = enviar
// @namespace    https://github.com/lautaro/youtube-lite
// @version      0.1.0
// @description  En Claude, ChatGPT y Gemini: ENTER inserta un salto de línea en el composer y CTRL+ENTER (⌘+ENTER en macOS) envía el mensaje.
// @match        https://claude.ai/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://gemini.google.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Marca para reconocer los eventos sintéticos que disparamos nosotros.
  const MINE = '__aiEnterSwap';

  /* ---------- 1. Detección del composer ---------- */

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) return true;
    if (el.isContentEditable) return true; // heredado: también vale para hijos del editor
    return el.getAttribute && el.getAttribute('role') === 'textbox';
  }

  function isSearchBox(el) {
    const placeholder = el.getAttribute('placeholder') || '';
    return !!el.closest('[role="search"], form[role="search"]') || /search|buscar/i.test(placeholder);
  }

  // Enter falso con los modificadores que queremos. Va marcado para que nuestro
  // propio listener (capture, en window) lo ignore y lo reciba recién la app.
  function syntheticEnter(mods) {
    const ev = new KeyboardEvent('keydown', Object.assign({
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    }, mods || {}));
    Object.defineProperty(ev, MINE, { value: true });
    return ev;
  }

  /* ---------- 2. ENTER = salto de línea ---------- */

  function newlineInInput(el) {
    const start = el.selectionStart == null ? el.value.length : el.selectionStart;
    const end = el.selectionEnd == null ? start : el.selectionEnd;
    // setter del prototype: React trackea .value y si lo asignamos directo
    // descarta el cambio; así su onChange sí dispara.
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, el.value.slice(0, start) + '\n' + el.value.slice(end));
    el.selectionStart = el.selectionEnd = start + 1;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function newlineInContentEditable(el) {
    // El target suele ser un hijo del editor; comparamos el raíz para no
    // confundir un "split de bloque" con "no insertó nada".
    const root = el.closest('[contenteditable="true"], [contenteditable=""]') || el;

    // Mejor opción: dejar que el editor (ProseMirror/Tiptap/Quill) procese un
    // Shift+Enter, que es su forma nativa de insertar salto y conserva el undo.
    const before = root.innerHTML;
    el.dispatchEvent(syntheticEnter({ shiftKey: true }));
    if (root.innerHTML !== before) return;

    // Fallback si el editor no escuchó el keydown sintético.
    let ok = false;
    try { ok = document.execCommand('insertLineBreak'); } catch (_) { /* noop */ }
    if (ok && root.innerHTML !== before) return;

    // Último recurso: insertar un <br> en el caret y avisar con input.
    const sel = getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const br = document.createElement('br');
    range.insertNode(br);
    const after = document.createRange();
    after.setStartAfter(br);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---------- 3. CTRL/CMD+ENTER = enviar ---------- */

  const SEND_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[data-testid*="send" i]',
    'button[aria-label*="send" i]',
    'button[aria-label*="enviar" i]',
    'button[mattooltip*="send" i]',
    'button[type="submit"]',
    '[role="button"][aria-label*="send" i]',
  ].join(',');

  const NOT_SEND = /feedback|bug|report|issue|survey|share|invite|stop|cancel|voice|audio|record/i;

  function usableButton(b) {
    if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
    const label = (b.getAttribute('aria-label') || '') + ' ' +
                  (b.getAttribute('title') || '') + ' ' + (b.textContent || '');
    if (NOT_SEND.test(label)) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden';
  }

  function findSendButton(el) {
    const scopes = [];
    const form = el.closest('form');
    if (form) scopes.push(form);
    let node = el;
    for (let i = 0; i < 6 && node; i++, node = node.parentElement) scopes.push(node);
    scopes.push(document);

    for (const scope of scopes) {
      const found = Array.prototype.find.call(scope.querySelectorAll(SEND_SELECTORS), usableButton);
      if (found) return found;
    }
    return null;
  }

  function send(el) {
    const button = findSendButton(el);
    if (button) {
      button.click();
      return;
    }
    // Sin botón detectable: que la app envíe con su propio handler de Enter.
    el.dispatchEvent(syntheticEnter({}));
  }

  /* ---------- 4. Handler (capture en window = lo antes posible) ---------- */

  window.addEventListener('keydown', (e) => {
    if (e[MINE]) return;                       // nuestro evento sintético: lo maneja la app
    if (e.isComposing || e.keyCode === 229) return; // no romper IME
    if (e.key !== 'Enter') return;

    const el = e.target;
    if (!isEditable(el) || isSearchBox(el)) return;
    if (e.shiftKey || e.altKey) return;        // la app ya hace salto de línea con Shift+Enter

    e.preventDefault();
    e.stopImmediatePropagation();

    if (e.ctrlKey || e.metaKey) {
      send(el);
      return;
    }

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') newlineInInput(el);
    else newlineInContentEditable(el);
  }, true);
})();
