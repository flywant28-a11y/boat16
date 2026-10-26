/* =========================================================
   jaba (#/jaba[/файл]) — редактор языка Jaba (js/jaba.js).
   Слева код с подсветкой и номерами строк, справа вывод программы:
   там же ask спрашивает и ждёт ответ. Run — Ctrl+Enter, Stop — останавливает.
   Файлы — ~/code/*.jaba (сохраняются сами), примеры — ~/code/examples
   (только чтение: правка сохраняет копию). Lessons — уроки сверху.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  const FROG = '<svg class="frog" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6.5a2.2 2.2 0 1 1 3.6-1.7h2.8A2.2 2.2 0 1 1 13 6.5c1 .9 1.5 2 1.5 3.2C14.5 12.6 11.6 14 8 14s-6.5-1.4-6.5-4.3c0-1.2.5-2.3 1.5-3.2z" fill="currentColor"/><circle cx="4.9" cy="4.6" r=".9" fill="#0D0F12"/><circle cx="11.1" cy="4.6" r=".9" fill="#0D0F12"/><path d="M5.5 10.2c1.5 1 3.5 1 5 0" stroke="#0D0F12" stroke-width=".9" fill="none" stroke-linecap="round"/></svg>';

  // Вывод программы в узел: print, ask (поле ввода прямо в выводе), clear
  function consoleHost(log, onScroll) {
    let pending = null;
    function line(cls, html) { const d = el('div', 'jl ' + (cls || ''), html); log.appendChild(d); onScroll(); return d; }
    return {
      print: function (text) { line('', esc(text)); },
      info: function (text) { line('jl-i', esc(text)); },
      error: function (text) { line('jl-e', esc(text)); },
      clear: function () { log.innerHTML = ''; },
      ask: function (q) {
        return new Promise(function (done) {
          const row = line('jl-ask', '<span class="jl-q">' + esc(q) + '</span>');
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'jl-in';
          input.autocomplete = 'off';
          input.spellcheck = false;
          input.setAttribute('aria-label', q || 'Answer');
          row.appendChild(input);
          input.focus({ preventScroll: true });
          onScroll();
          function finish(v) {
            pending = null;
            input.replaceWith(el('span', 'jl-a', esc(v)));
            done(v);
          }
          pending = function () { finish(''); };
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
          });
        });
      },
      cancel: function () { if (pending) pending(); }
    };
  }

  function render(box, arg, win) {
    box.classList.add('jb');
    let file = arg && arg.file && Jaba.files.read(arg.file) !== null ? arg.file : (Jaba.files.list()[0] || null);
    if (!file) { Jaba.files.all(); file = Jaba.files.list()[0]; }
    let running = null, lesson = Store.get('jaba:lesson', 0), saveTimer = null;

    /* ---------- Разметка ---------- */
    const bar = el('div', 'jb-bar');
    const runBtn = UI.button('btn btn-primary btn-sm', '▶ run', function () { run(); });
    runBtn.title = 'Run (Ctrl+Enter)';
    const stopBtn = UI.button('btn btn-sm', '■ stop', function () { stop(); });
    stopBtn.hidden = true;
    const name = UI.button('jb-name', '');
    name.title = 'Rename';
    const filesBtn = UI.button('btn btn-sm btn-ghost', 'files', function () { toggleFiles(); });
    const newBtn = UI.button('btn btn-sm btn-ghost', 'new', function () { create(); });
    const lessonsBtn = UI.button('btn btn-sm btn-ghost', 'lessons', function () { toggleLessons(); });
    const helpBtn = UI.button('btn btn-sm btn-ghost', '?', function () { reference(); });
    helpBtn.title = 'Everything Jaba knows';
    bar.appendChild(el('span', 'jb-logo', FROG));
    bar.appendChild(runBtn);
    bar.appendChild(stopBtn);
    bar.appendChild(name);
    bar.appendChild(el('span', 'jb-sp'));
    [filesBtn, newBtn, lessonsBtn, helpBtn].forEach(function (b) { bar.appendChild(b); });
    box.appendChild(bar);

    const filesPop = el('div', 'jb-pop');
    filesPop.hidden = true;
    box.appendChild(filesPop);
    const lessonBox = el('div', 'jb-lesson');
    lessonBox.hidden = !Store.get('jaba:lessons-open', false);
    box.appendChild(lessonBox);

    const main = el('div', 'jb-main');
    const ed = el('div', 'jb-ed');
    const gutter = el('div', 'jb-gut');
    gutter.setAttribute('aria-hidden', 'true');
    const code = el('div', 'jb-code');
    const hl = el('pre', 'jb-hl');
    hl.setAttribute('aria-hidden', 'true');
    const ta = document.createElement('textarea');
    ta.className = 'jb-ta';
    ta.spellcheck = false;
    ta.autocapitalize = 'off';
    ta.setAttribute('autocorrect', 'off');
    ta.setAttribute('aria-label', 'Jaba code');
    code.appendChild(hl);
    code.appendChild(ta);
    ed.appendChild(gutter);
    ed.appendChild(code);
    const out = el('div', 'jb-out');
    const outHead = el('div', 'jb-out-head', '<span>output</span>');
    outHead.appendChild(UI.button('link-btn', 'clear', function () { log.innerHTML = ''; }));
    const log = el('div', 'jb-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    out.appendChild(outHead);
    out.appendChild(log);
    main.appendChild(ed);
    main.appendChild(out);
    box.appendChild(main);

    const host = consoleHost(log, function () { log.scrollTop = log.scrollHeight; });

    /* ---------- Подсветка и номера строк ---------- */
    let errLine = 0;
    function paint() {
      const v = ta.value;
      hl.innerHTML = Jaba.highlight(v) + (v.slice(-1) === '\n' || !v ? ' ' : '');
      const lines = v.split('\n').length;
      let g = '';
      for (let i = 1; i <= lines; i++) g += '<span' + (i === errLine ? ' class="err"' : '') + '>' + i + '</span>';
      gutter.innerHTML = g;
      sync();
    }
    function sync() {
      hl.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
      gutter.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
    }
    ta.addEventListener('scroll', sync);

    /* ---------- Файл ---------- */
    function isExample(f) { return /^examples\//.test(f); }
    function load(f) {
      if (Jaba.files.read(f) === null) return;
      file = f;
      win.arg = { file: f };
      ta.value = Jaba.files.read(f);
      errLine = 0;
      name.textContent = '~/code/' + f + (isExample(f) ? '  (read-only)' : '');
      WM.setTitle(win);
      if (WM.focused() === win) history.replaceState(null, '', '#/jaba/' + encodeURIComponent(f));
      paint();
    }
    function save() {
      clearTimeout(saveTimer);
      if (isExample(file)) {
        if (ta.value === Jaba.files.read(file)) return;
        const copy = Jaba.files.free(file.slice(9));
        Jaba.files.write(copy, ta.value);
        UI.toast('Examples are read-only — your version is saved as ' + copy + '.');
        const keep = ta.selectionStart;
        load(copy);
        ta.selectionStart = ta.selectionEnd = keep;
        return;
      }
      Jaba.files.write(file, ta.value);
    }
    ta.addEventListener('input', function () {
      errLine = 0;
      paint();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 500);
    });

    function create() {
      const f = Jaba.files.free('untitled.jaba');
      Jaba.files.write(f, '# ' + f + '\nsay "hi"\n');
      load(f);
      rename();
    }

    // Имя файла в панели превращается в поле ввода
    function rename() {
      if (isExample(file)) { UI.toast('Examples can\'t be renamed — edit it and Jaba saves your own copy.'); return; }
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'jb-rename';
      input.value = file.replace(/\.jaba$/, '');
      input.setAttribute('aria-label', 'File name');
      name.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      function commit(ok) {
        if (done) return;
        done = true;
        input.replaceWith(name);
        const want = Jaba.files.clean(input.value);
        if (!ok || !want || want === file) return;
        if (Jaba.files.read(want) !== null) { UI.toast('There is already a file called ' + want + '.'); return; }
        Jaba.files.write(want, ta.value);
        Jaba.files.remove(file);
        load(want);
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commit(true); }
        else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
      });
      input.addEventListener('blur', function () { commit(true); });
    }
    name.addEventListener('click', rename);

    /* ---------- Список файлов ---------- */
    function toggleFiles(force) {
      filesPop.hidden = force === undefined ? !filesPop.hidden : !force;
      if (filesPop.hidden) return;
      filesPop.innerHTML = '';
      filesPop.appendChild(el('div', 'jb-pop-h', '~/code'));
      Jaba.files.list().forEach(function (f) {
        const row = el('div', 'jb-pop-r' + (f === file ? ' on' : ''));
        row.appendChild(UI.button('jb-pop-f', esc(f), function () { save(); load(f); toggleFiles(false); ta.focus(); }));
        const del = UI.button('jb-pop-x', '×', function () {
          if (!confirm('Delete ' + f + '? This can\'t be undone.')) return;
          Jaba.files.remove(f);
          if (f === file) load(Jaba.files.list()[0] || 'examples/guess.jaba');
          toggleFiles(true);
        });
        del.setAttribute('aria-label', 'Delete ' + f);
        row.appendChild(del);
        filesPop.appendChild(row);
      });
      filesPop.appendChild(el('div', 'jb-pop-h', '~/code/examples'));
      Object.keys(Jaba.EXAMPLES).forEach(function (f) {
        const row = el('div', 'jb-pop-r' + ('examples/' + f === file ? ' on' : ''));
        row.appendChild(UI.button('jb-pop-f', esc(f), function () { save(); load('examples/' + f); toggleFiles(false); }));
        filesPop.appendChild(row);
      });
    }

    /* ---------- Уроки ---------- */
    function inline(text) { return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>'); }
    function paintLesson() {
      const L = Jaba.LESSONS[lesson];
      lessonBox.innerHTML = '';
      const head = el('div', 'jb-lh', '<span class="jb-ln">lesson ' + (lesson + 1) + '/' + Jaba.LESSONS.length + '</span> <b>' + esc(L.title) + '</b>');
      const nav = el('span', 'jb-lnav');
      nav.appendChild(UI.button('link-btn', '‹ back', function () { go(lesson - 1); }));
      nav.appendChild(UI.button('link-btn', 'next ›', function () { go(lesson + 1); }));
      nav.appendChild(UI.button('link-btn', 'close', function () { toggleLessons(false); }));
      head.appendChild(nav);
      lessonBox.appendChild(head);
      lessonBox.appendChild(el('p', null, inline(L.text)));
      const task = el('p', 'jb-task', '<span>try it:</span> ' + inline(L.task));
      lessonBox.appendChild(task);
      lessonBox.appendChild(UI.button('btn btn-sm', 'put the example in the editor', function () {
        const f = Jaba.files.free('lesson-' + (lesson + 1) + '.jaba');
        const existing = 'lesson-' + (lesson + 1) + '.jaba';
        if (Jaba.files.read(existing) !== null) { save(); load(existing); return; }
        Jaba.files.write(f, '# lesson ' + (lesson + 1) + ': ' + L.title + '\n# ' + L.task + '\n\n' + L.code);
        save();
        load(f);
        ta.focus();
      }));
      lessonBox.querySelectorAll('.link-btn')[0].disabled = lesson === 0;
      lessonBox.querySelectorAll('.link-btn')[1].disabled = lesson === Jaba.LESSONS.length - 1;
    }
    function go(i) { lesson = Math.max(0, Math.min(Jaba.LESSONS.length - 1, i)); Store.set('jaba:lesson', lesson); paintLesson(); }
    function toggleLessons(force) {
      lessonBox.hidden = force === undefined ? !lessonBox.hidden : !force;
      Store.set('jaba:lessons-open', !lessonBox.hidden);
      if (!lessonBox.hidden) paintLesson();
    }

    // Справка: все слова и встроенные функции
    function reference() {
      host.info('— Jaba words —');
      host.print('let  say  ask  if … then … else if … else … end  repeat N times … end  repeat forever … end');
      host.print('while … end  for each x in list … end  for i from 1 to 10 step 1 … end');
      host.print('function name(a, b) … return … end  stop  skip  and  or  not  is  is not  true  false  nothing');
      host.print('# notes start with #   "text {expression} text"   [1, 2, 3]   {name: "Ann"}   list[1] is the first item');
      host.info('— built-in functions —');
      Jaba.builtins().forEach(function (b) { host.print(b.name + '()  ' + b.about); });
    }

    /* ---------- Запуск ---------- */
    function run() {
      if (running) stop();
      save();
      errLine = 0;
      paint();
      log.innerHTML = '';
      host.info('▶ ' + file);
      runBtn.hidden = true;
      stopBtn.hidden = false;
      const me = Jaba.run(ta.value, host);
      running = me;
      me.done.then(function (r) {
        if (running !== me) return;
        running = null;
        runBtn.hidden = false;
        stopBtn.hidden = true;
        if (r.ok) host.info('✓ done in ' + (r.ms < 1000 ? Math.max(1, Math.round(r.ms)) + ' ms' : (r.ms / 1000).toFixed(1) + ' s'));
        else if (r.stopped) host.info('■ stopped');
        else {
          host.error('line ' + r.line + ': ' + r.error);
          errLine = r.line;
          paint();
        }
      });
    }
    function stop() {
      if (!running) return;
      const r = running;
      running = null;
      r.stop();
      runBtn.hidden = false;
      stopBtn.hidden = true;
      host.info('■ stopped');
    }
    win.onCloseApp = stop;

    /* ---------- Клавиши редактора ---------- */
    function insert(text) {
      ta.focus();
      if (!document.execCommand || !document.execCommand('insertText', false, text)) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    }
    ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); UI.toast('Saved ' + file + '.'); return; }
      if (e.key === 'Escape' && running) { e.preventDefault(); stop(); return; }
      if (e.key === 'Tab' && !e.altKey) {
        e.preventDefault();
        if (e.shiftKey) {
          // убрать два пробела в начале строки
          const s = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
          if (ta.value.substr(s, 2) === '  ') {
            const pos = ta.selectionStart;
            ta.setSelectionRange(s, s + 2);
            insert('');
            ta.setSelectionRange(Math.max(s, pos - 2), Math.max(s, pos - 2));
          }
        } else insert('  ');
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // новая строка с тем же отступом, после if/repeat/… — на шаг глубже
        const s = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
        const cur = ta.value.slice(s, ta.selectionStart);
        let indent = /^\s*/.exec(cur)[0];
        if (Jaba.OPENERS.test(cur) && !/\bend\s*$/.test(cur)) indent += '  ';
        e.preventDefault();
        insert('\n' + indent);
      }
    });

    // Клик мимо списка файлов закрывает его
    box.addEventListener('pointerdown', function (e) {
      if (!filesPop.hidden && !filesPop.contains(e.target) && e.target !== filesBtn) filesPop.hidden = true;
    });

    load(file);
    if (!lessonBox.hidden) paintLesson();
    win.focusEditor = function () { if (!window.matchMedia('(max-width: 760px)').matches) ta.focus({ preventScroll: true }); };
    setTimeout(win.focusEditor, 30);
  }

  window.JabaView = { render, consoleHost, FROG };
})();
