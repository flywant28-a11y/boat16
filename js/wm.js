/* =========================================================
   Оконный менеджер рабочего стола: плавающие окна, рабочие столы 1–4,
   статус-бар сверху (как polybar) и лаунчер (как rofi).
   Окно — приложение из реестра (js/app.js): render(узел, arg, окно).
   Окна, их место и рабочие столы помнятся в Store 'wm' и
   восстанавливаются после перезагрузки.
   Клавиши: Alt+Enter — терминал, Alt+D — лаунчер, Alt+Q — закрыть,
   Alt+F — развернуть, Alt+1…4 — рабочий стол, Alt+Shift+1…4 — перенести окно.
   На узком экране окна открываются на весь экран, видно одно — активное.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  const WS = 4, MIN_W = 320, MIN_H = 200, EDGE = 90;
  const narrow = window.matchMedia('(max-width: 760px)');

  let apps = {}, desk = null, bar = null;
  let wins = [], focused = null, ws = 1, z = 10, seq = 0, saveTimer = null;

  function init(root, registry) {
    apps = registry;
    root.appendChild(buildBar());
    desk = el('main', 'desk');
    // Значок на рабочем столе — под окнами
    const icons = el('div', 'dicons');
    const jaba = UI.button('dicon', JabaView.FROG.replace('width="15" height="15"', 'width="40" height="40"') + '<span>jaba</span>', function () { App.go('#/jaba'); });
    jaba.title = 'Jaba — our mini programming language';
    icons.appendChild(jaba);
    desk.appendChild(icons);
    root.appendChild(desk);
    keys();
    window.addEventListener('resize', function () { wins.forEach(function (w) { clamp(w); apply(w); }); });
    window.addEventListener('theme-changed', function () { tick(true); });
    setInterval(function () { tick(false); }, 1000);
    tick(true);
  }

  function area() { return { w: desk.clientWidth, h: desk.clientHeight }; }

  /* ---------- Окна ---------- */
  function open(appId, arg, opts) {
    opts = opts || {};
    const app = apps[appId];
    if (!app) return null;
    const key = app.key ? app.key(arg) : (app.multi ? null : appId);
    const same = key && wins.find(function (w) { return w.key === key; });
    if (same) {
      if (app.reuse) app.reuse(same, arg);
      focus(same, true);
      return same;
    }
    const d = area();
    const size = app.size ? app.size(d) : [Math.min(940, d.w * .62), Math.min(680, d.h * .86)];
    const w = { id: ++seq, app: appId, arg: arg, key: key, ws: opts.ws || ws, max: !!opts.max, w: opts.w || size[0], h: opts.h || size[1] };
    if (opts.x !== undefined) { w.x = opts.x; w.y = opts.y; }
    else place(w, d, app);
    clamp(w);
    build(w);
    wins.push(w);
    render(w);
    if (!opts.background) focus(w, true);
    else hideOthers();
    save();
    return w;
  }

  // Новое окно — лесенкой от места приложения, чтобы не легло ровно на старое
  function place(w, d, app) {
    const n = wins.filter(function (o) { return o.ws === w.ws; }).length;
    const p = app.pos ? app.pos(d, w) : [Math.max(12, (d.w - w.w) / 2 + d.w * .08), Math.max(12, (d.h - w.h) / 2)];
    w.x = p[0] + (n % 6) * 28;
    w.y = p[1] + (n % 6) * 24;
    // Новое окно целиком на экране, если помещается
    w.x = Math.max(0, Math.min(w.x, d.w - w.w - 8));
    w.y = Math.max(0, Math.min(w.y, d.h - w.h - 8));
  }

  function clamp(w) {
    const d = area();
    w.w = Math.max(Math.min(MIN_W, d.w), Math.min(w.w, d.w));
    w.h = Math.max(Math.min(MIN_H, d.h), Math.min(w.h, d.h));
    w.x = Math.min(Math.max(w.x, -w.w + EDGE), d.w - EDGE);
    w.y = Math.min(Math.max(w.y, 0), d.h - 30);
  }

  function apply(w) {
    const s = w.el.style;
    s.left = Math.round(w.x) + 'px';
    s.top = Math.round(w.y) + 'px';
    s.setProperty('--wx', Math.round(w.x) + 'px');
    s.setProperty('--wy', Math.round(w.y) + 'px');
    s.width = Math.round(w.w) + 'px';
    s.height = Math.round(w.h) + 'px';
    w.el.classList.toggle('max', w.max);
  }

  function build(w) {
    const e = el('section', 'win');
    e.dataset.app = w.app;
    const head = el('header', 'win-bar');
    const title = el('span', 'win-title');
    head.appendChild(title);
    const btns = el('span', 'win-btns');
    btns.appendChild(UI.button('win-btn', '<span aria-hidden="true">□</span>', function () { toggleMax(w); }));
    btns.lastChild.setAttribute('aria-label', 'Maximize');
    btns.appendChild(UI.button('win-btn close', '<span aria-hidden="true">×</span>', function () { close(w); }));
    btns.lastChild.setAttribute('aria-label', 'Close window');
    head.appendChild(btns);
    e.appendChild(head);
    const body = el('div', 'win-body');
    e.appendChild(body);
    ['e', 's', 'se'].forEach(function (dir) {
      const h = el('i', 'rz rz-' + dir);
      h.addEventListener('pointerdown', function (ev) { resize(ev, w, dir); });
      e.appendChild(h);
    });
    e.addEventListener('pointerdown', function (ev) {
      if (focused !== w) focus(w);
      if (ev.altKey && ev.button === 0) drag(ev, w);   // как floating_modifier в i3
    }, true);
    head.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.target.closest('button') || ev.altKey) return;
      drag(ev, w);
    });
    head.addEventListener('dblclick', function (ev) { if (!ev.target.closest('button')) toggleMax(w); });
    e.style.zIndex = ++z;
    desk.appendChild(e);
    w.el = e; w.head = head; w.titleEl = title; w.body = body;
    apply(w);
  }

  function render(w) {
    const content = el('div', 'app app-' + w.app);
    w.body.innerHTML = '';
    w.body.appendChild(content);
    w.content = content;
    apps[w.app].render(content, w.arg, w);
    setTitle(w);
  }

  // Перерисовать, не теряя прокрутку (данные изменились в другом окне)
  function rerender(w) {
    const top = w.body.scrollTop;
    render(w);
    w.body.scrollTop = top;
  }

  function setTitle(w, text) {
    if (text !== undefined) w.customTitle = text;
    const app = apps[w.app];
    w.title = w.customTitle || (app.title ? app.title(w.arg, w) : w.app);
    w.titleEl.textContent = w.title;
    w.el.setAttribute('aria-label', w.title);
    if (focused === w) paint();
  }

  function focus(w, raise) {
    const prev = focused;
    focused = w;
    w.el.style.zIndex = ++z;
    if (w.ws !== ws) { ws = w.ws; }
    hideOthers();
    wins.forEach(function (o) { o.el.classList.toggle('on', o === w); });
    const app = apps[w.app];
    if (prev !== w && app.live && w.stale) { w.stale = false; rerender(w); }
    const hash = app.hash ? app.hash(w.arg, w) : '#/';
    if (location.hash !== hash) history.replaceState(null, '', hash);
    if (raise && app.onFocus) app.onFocus(w);
    paint();
    save();
  }

  function hideOthers() {
    wins.forEach(function (o) { o.el.classList.toggle('away', o.ws !== ws); });
  }

  function top(n) {
    let best = null;
    wins.forEach(function (o) { if (o.ws === n && (!best || +o.el.style.zIndex > +best.el.style.zIndex)) best = o; });
    return best;
  }

  function close(w) {
    if (!w) return;
    if (apps[w.app].onClose) apps[w.app].onClose(w);
    w.el.remove();
    wins = wins.filter(function (o) { return o !== w; });
    if (focused === w) {
      focused = null;
      const next = top(ws);
      if (next) focus(next, true);
      else { history.replaceState(null, '', '#/'); paint(); }
    }
    save();
  }

  function toggleMax(w) {
    w.max = !w.max;
    apply(w);
    save();
  }

  function switchWs(n) {
    ws = n;
    hideOthers();
    const t = top(n);
    if (t) focus(t, true);
    else {
      focused = null;
      wins.forEach(function (o) { o.el.classList.remove('on'); });
      history.replaceState(null, '', '#/');
      paint();
      save();
    }
  }

  function moveTo(w, n) {
    if (!w || w.ws === n) return;
    w.ws = n;
    focused = null;
    switchWs(ws);
    UI.toast('Window moved to workspace ' + n + '.');
  }

  /* ---------- Перетаскивание и размер ---------- */
  function drag(ev, w) {
    if (narrow.matches) return;
    ev.preventDefault();
    const d = area();
    if (w.max) {
      // Развёрнутое окно отрывается от края под курсором, как в i3
      const ratio = (ev.clientX - desk.getBoundingClientRect().left) / d.w;
      w.max = false;
      w.x = ev.clientX - desk.getBoundingClientRect().left - w.w * ratio;
      w.y = 0;
      apply(w);
    }
    const sx = ev.clientX, sy = ev.clientY, ox = w.x, oy = w.y;
    track(ev, function (e) {
      w.x = ox + e.clientX - sx;
      w.y = oy + e.clientY - sy;
      clamp(w);
      apply(w);
    });
  }

  function resize(ev, w, dir) {
    if (narrow.matches || ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (w.max) { w.max = false; apply(w); }
    const sx = ev.clientX, sy = ev.clientY, ow = w.w, oh = w.h;
    track(ev, function (e) {
      const d = area();
      if (dir !== 's') w.w = Math.max(MIN_W, Math.min(ow + e.clientX - sx, d.w - w.x));
      if (dir !== 'e') w.h = Math.max(MIN_H, Math.min(oh + e.clientY - sy, d.h - w.y));
      apply(w);
    });
  }

  // Движение мыши — не чаще кадра: окно двигается один раз за кадр
  function track(ev, handler) {
    document.body.classList.add('dragging');
    let last = null, frame = 0;
    function move(e) {
      last = e;
      if (!frame) frame = requestAnimationFrame(function () { frame = 0; if (last) handler(last); });
    }
    function up() {
      if (frame) { cancelAnimationFrame(frame); frame = 0; if (last) handler(last); }
      document.body.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      save();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /* ---------- Сессия ---------- */
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      Store.set('wm', {
        ws: ws,
        focus: focused ? wins.indexOf(focused) : -1,
        wins: wins.map(function (w) {
          const app = apps[w.app];
          return { app: w.app, arg: app.saveArg ? app.saveArg(w) : w.arg, x: w.x, y: w.y, w: w.w, h: w.h, max: w.max, ws: w.ws };
        })
      });
    }, 250);
  }

  function restore() {
    const s = Store.get('wm', null);
    if (!s || !Array.isArray(s.wins) || !s.wins.length) return false;
    const made = [];
    s.wins.forEach(function (o) {
      try {
        if (!apps[o.app] || (apps[o.app].valid && !apps[o.app].valid(o.arg))) return;
        made.push(open(o.app, o.arg, { x: o.x, y: o.y, w: o.w, h: o.h, max: o.max, ws: o.ws, background: true }));
      } catch (e) { /* испорченное окно просто не открываем */ }
    });
    ws = s.ws >= 1 && s.ws <= WS ? s.ws : 1;
    const want = made[s.focus];
    if (want) focus(want, true);
    else switchWs(ws);
    return made.length > 0;
  }

  /* ---------- Статус-бар ---------- */
  const SAIL = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M7.5 1v10H2.2z" fill="currentColor"/><path d="M8.6 3.2l4.8 7.8H8.6z" fill="currentColor" opacity=".65"/><path d="M1 12.4h14l-2.2 2.6H3.2z" fill="currentColor"/></svg>';

  function buildBar() {
    bar = el('header', 'bar');
    bar.innerHTML =
      '<div class="bar-l"><button type="button" class="b-launch" aria-label="Launcher (Alt+D)" title="Launcher (Alt+D)">' + SAIL + '</button>' +
      '<nav class="b-ws" aria-label="Workspaces"></nav><button type="button" class="b-title" title="Switch window"></button></div>' +
      '<div class="bar-r">' +
      '<button type="button" class="bm bm-jaba" title="Jaba — our mini programming language">' + JabaView.FROG + '<span>jaba</span></button>' +
      '<button type="button" class="bm bm-timer" hidden></button>' +
      '<button type="button" class="bm bm-due" title="Reviews due today"></button>' +
      '<button type="button" class="bm bm-oge" title="Days until the OGE"></button>' +
      '<span class="bm bm-streak" title="Days in a row"></span>' +
      '<button type="button" class="bm bm-theme" title="Switch theme"></button>' +
      '<span class="bm bm-clock"></span></div>';
    bar.querySelector('.b-launch').addEventListener('click', rofi);
    bar.querySelector('.b-title').addEventListener('click', rofi);
    bar.querySelector('.bm-timer').addEventListener('click', function () { const s = Timer.state(); if (s) App.go('#/t/' + s.id + '/practice'); });
    bar.querySelector('.bm-due').addEventListener('click', function () { App.go('#/courses'); });
    bar.querySelector('.bm-oge').addEventListener('click', function () { App.go('#/calendar'); });
    bar.querySelector('.bm-theme').addEventListener('click', Themes.next);
    bar.querySelector('.bm-jaba').addEventListener('click', function () { App.go('#/jaba'); });
    return bar;
  }

  // Рабочие столы и заголовок активного окна
  function paint() {
    if (!bar) return;
    const box = bar.querySelector('.b-ws');
    box.innerHTML = '';
    for (let n = 1; n <= WS; n++) {
      const used = wins.some(function (w) { return w.ws === n; });
      if (!used && n !== ws) continue;
      const b = UI.button('b-w' + (n === ws ? ' on' : '') + (used ? ' used' : ''), String(n), function () { switchWs(n); });
      b.setAttribute('aria-label', 'Workspace ' + n);
      if (n === ws) b.setAttribute('aria-current', 'true');
      box.appendChild(b);
    }
    bar.querySelector('.b-title').textContent = focused ? focused.title : 'student@boat16: ~';
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  let slowAt = 0;

  function tick(force) {
    if (!bar) return;
    const now = new Date();
    bar.querySelector('.bm-clock').textContent = pad(now.getDate()) + '/' + pad(now.getMonth() + 1) + '/' + now.getFullYear() + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    const s = window.Timer && Timer.state();
    const tm = bar.querySelector('.bm-timer');
    tm.hidden = !s;
    if (s) {
      tm.classList.toggle('idle', !s.run);
      tm.innerHTML = '<span class="k">' + (s.run ? '●' : '❚❚') + '</span> ' + UI.mmss(s.sec) + '<span class="dim">/' + Math.round(s.goal / 60) + ':00</span>';
      tm.title = 'Practice timer · ' + (s.run ? 'running' : 'paused');
    }
    if (!force && Date.now() - slowAt < 20000) return;
    slowAt = Date.now();
    const due = Progress.dueList(Subjects.all()).length;
    const dm = bar.querySelector('.bm-due');
    dm.innerHTML = '<span class="k">↻</span> ' + due + ' due';
    dm.classList.toggle('warn', due > 0);
    const ex = Plan.exams();
    const days = Math.min(Progress.diffDays(Progress.today(), ex.social), Progress.diffDays(Progress.today(), ex.math));
    bar.querySelector('.bm-oge').innerHTML = '<span class="k">oge</span> ' + Math.max(0, days) + 'd';
    bar.querySelector('.bm-streak').innerHTML = '<span class="k">streak</span> ' + Progress.streak() + 'd';
    bar.querySelector('.bm-theme').innerHTML = '<span class="k">◐</span> ' + Themes.current();
  }

  /* ---------- Лаунчер ---------- */
  function rofi() {
    if (document.querySelector('.rofi')) return;
    const back = el('div', 'rofi');
    const box = el('div', 'rofi-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Launcher');
    const row = el('label', 'rofi-in', '<span class="rofi-p">drun</span>');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'app, window or topic…';
    input.setAttribute('aria-label', 'Search apps, windows and topics');
    input.autocomplete = 'off';
    input.spellcheck = false;
    row.appendChild(input);
    box.appendChild(row);
    const list = el('div', 'rofi-list');
    list.setAttribute('role', 'listbox');
    box.appendChild(list);
    back.appendChild(box);
    document.body.appendChild(back);
    let items = [], sel = 0;

    function entries(q) {
      const out = [];
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      function hit(text) { text = text.toLowerCase(); return words.every(function (w) { return text.indexOf(w) !== -1; }); }
      wins.forEach(function (w) {
        if (!words.length || hit(w.title + ' window')) out.push({ name: w.title, kind: 'window ' + w.ws, run: function () { focus(w, true); } });
      });
      App.launchers().forEach(function (a) {
        if (!words.length || hit(a.name + ' ' + a.note)) out.push({ name: a.name, kind: a.note, run: a.run });
      });
      if (words.length) {
        Subjects.all().forEach(function (tp) {
          const path = App.topicPath(tp);
          if (out.length < 60 && hit(path + ' ' + tp.title + ' ' + tp.section)) out.push({ name: path, kind: tp.title, run: function () { App.go('#/t/' + tp.id); } });
        });
      }
      return out;
    }

    function draw() {
      items = entries(input.value.trim());
      sel = Math.min(sel, Math.max(0, items.length - 1));
      list.innerHTML = '';
      if (!items.length) list.appendChild(el('div', 'rofi-empty', 'Nothing found. Try a topic word, like “власть” or “дроби”.'));
      items.forEach(function (it, i) {
        const b = UI.button('rofi-item' + (i === sel ? ' on' : ''), '<span class="ri-n">' + esc(it.name) + '</span><span class="ri-k">' + esc(it.kind) + '</span>', function () { pick(i); });
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(i === sel));
        list.appendChild(b);
      });
      const on = list.querySelector('.on');
      if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function pick(i) { const it = items[i]; done(); if (it) it.run(); }
    function done() { back.remove(); }

    input.addEventListener('input', function () { sel = 0; draw(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); sel = (sel + 1) % Math.max(1, items.length); draw(); }
      else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(1, items.length); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); done(); }
    });
    back.addEventListener('pointerdown', function (e) { if (e.target === back) done(); });
    draw();
    input.focus();
  }

  /* ---------- Клавиши ---------- */
  function keys() {
    document.addEventListener('keydown', function (e) {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (e.code === 'Enter') open('term');
      else if (e.code === 'KeyD') rofi();
      else if (e.code === 'KeyQ') close(focused);
      else if (e.code === 'KeyF') { if (focused) toggleMax(focused); }
      else if (digit && +digit[1] <= WS) { if (e.shiftKey) moveTo(focused, +digit[1]); else switchWs(+digit[1]); }
      else return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  /* ---------- Для приложений ---------- */
  function containing(node) { return wins.find(function (w) { return w.el.contains(node); }) || null; }
  function isFocused(node) { return !!focused && focused.el.contains(node) && !document.querySelector('.rofi, .overlay'); }

  // Данные изменились: «живые» окна (курсы, статистика) обновятся — сразу или при фокусе
  function refreshLive() {
    wins.forEach(function (w) {
      if (!apps[w.app].live) return;
      if (w === focused) rerender(w);
      else w.stale = true;
    });
    tick(true);
  }

  window.WM = {
    init, open, close, focus, rerender, setTitle, restore, refreshLive, containing, isFocused, rofi, switchWs, toggleMax,
    focused: function () { return focused; },
    list: function () { return wins.slice(); },
    rerenderFor: function (node) { const w = containing(node); if (w) rerender(w); }
  };
})();
