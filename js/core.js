/* =========================================================
   Ядро: мелкие помощники разметки (UI) и хранилище (Store).
   Store — localStorage с префиксом boat16:, все обращения в try/catch:
   в приватном режиме приложение работает, но помнит только до закрытия.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- UI ---------- */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // forms: [одно, много] — английское правило
  function plural(n, forms) { return Math.abs(n) === 1 ? forms[0] : forms[1]; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function button(cls, text, onClick) {
    const b = el('button', cls, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function mmss(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Кнопка «Дальше» по Enter — только новым нажатием. Фокус на кнопку не ставим:
  // Enter, которым отправили ответ, иначе сразу «нажимал» её и вопрос пролистывался.
  function nextOnEnter(btn) {
    const since = Date.now();
    function onKey(e) {
      if (!document.body.contains(btn)) { document.removeEventListener('keydown', onKey); return; }
      if (e.key !== 'Enter' || e.repeat || Date.now() - since < 500) return;
      if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName) && document.activeElement !== btn) return;
      e.preventDefault();
      document.removeEventListener('keydown', onKey);
      btn.click();
    }
    document.addEventListener('keydown', onKey);
  }

  // Таймкод ролика: 9:48, 1:06:44
  function clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Короткое уведомление внизу экрана
  let toastBox = null;
  function toast(text, opts) {
    opts = opts || {};
    if (!toastBox) {
      toastBox = el('div', 'toasts');
      toastBox.setAttribute('role', 'status');
      document.body.appendChild(toastBox);
    }
    const t = el('div', 'toast' + (opts.kind ? ' ' + opts.kind : ''));
    t.appendChild(el('span', 'toast-text', esc(text)));
    (opts.actions || []).forEach(function (a) {
      t.appendChild(button('toast-btn', esc(a.label), function () { close(); a.run(); }));
    });
    toastBox.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('on'); });
    let timer = setTimeout(close, opts.ms || (opts.actions ? 15000 : 3800));
    function close() {
      clearTimeout(timer);
      t.classList.remove('on');
      setTimeout(function () { t.remove(); }, 250);
    }
    return close;
  }

  // Картинка на весь экран по клику
  function lightbox(src, opts) {
    opts = opts || {};
    const box = el('div', 'lightbox' + (opts.photo ? ' photo' : ''));
    box.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(opts.alt || '') + '">';
    box.addEventListener('click', function () { box.remove(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', onKey); }
    });
    document.body.appendChild(box);
  }

  window.UI = { el, esc, plural, shuffle, button, mmss, clock, toast, lightbox, nextOnEnter };

  /* ---------- Store ---------- */
  const PREFIX = 'boat16:';
  const memory = {};

  function get(key, fallback) {
    let raw = null;
    try { raw = localStorage.getItem(PREFIX + key); }
    catch (e) { raw = Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function set(key, value) {
    const raw = JSON.stringify(value);
    memory[key] = raw;
    try { localStorage.setItem(PREFIX + key, raw); return true; } catch (e) { return false; }
  }

  function remove(key) {
    delete memory[key];
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ничего страшного */ }
  }

  window.Store = { get, set, remove };
})();
