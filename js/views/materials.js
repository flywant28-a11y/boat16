/* =========================================================
   materials — полезное от Равиля Кандинского из закрепа его Telegram.
   Ссылка открывает пост в Telegram. Скачанные PDF подключаются здесь
   (js/files.js) и дальше открываются без интернета.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  let stored = {};   // ключи файлов в IndexedDB

  function refreshKeys() {
    return Files.keys().then(function (keys) { stored = {}; keys.forEach(function (k) { stored[k] = true; }); });
  }

  // Строка материала (используется и в шпоре темы)
  function row(it) {
    const r = el('div', 'mat-row');
    r.appendChild(el('span', 'mat-kind kind-' + it.kind, it.kind));
    const main = el('div', 'mat-main');
    main.appendChild(el('span', 'mat-title', esc(it.title)));
    const note = [it.note, it.size].filter(Boolean).join(' · ');
    if (note) main.appendChild(el('span', 'mat-note', esc(note)));
    r.appendChild(main);
    const act = el('div', 'mat-act');
    if (stored[it.id]) act.appendChild(UI.button('btn btn-sm', 'открыть', function () { Files.open(it.id).catch(function (e) { UI.toast(e.message); }); }));
    const a = el('a', 'btn btn-sm btn-ghost', it.kind === 'video' ? 'youtube ↗' : 'telegram ↗');
    a.href = it.url;
    a.target = '_blank';
    a.rel = 'noopener';
    act.appendChild(a);
    if (it.kind === 'pdf') {
      const pick = el('label', 'btn btn-sm btn-ghost', stored[it.id] ? 'заменить' : 'подключить');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.hidden = true;
      input.addEventListener('change', function () {
        if (!input.files[0]) return;
        Files.put(it.id, input.files[0]).then(refreshKeys).then(function () {
          UI.toast('«' + it.title + '» сохранён в приложении.', { kind: 'ok' });
          r.replaceWith(row(it));
        }, function (e) { UI.toast('Не удалось сохранить: ' + e.message); });
      });
      pick.appendChild(input);
      act.appendChild(pick);
    }
    r.appendChild(act);
    return r;
  }

  function render(view) {
    view.classList.add('page');
    const token = {};
    view._screen = token;
    refreshKeys().then(function () { if (view._screen === token) draw(); });

    function draw() {
      view.innerHTML = '';
      const head = el('section', 'mod');
      head.innerHTML = '<div class="mod-head"><span class="mod-name">materials</span><span class="mod-meta">' + esc(MATERIALS.author) + ' · telegram</span></div>';
      const body = el('div', 'mod-body');
      body.appendChild(el('p', null, 'Полезные файлы и ролики из закрепа канала <a href="' + MATERIALS.post + '" target="_blank" rel="noopener">t.me/ravilcandi</a>. Ссылка открывает пост в Telegram, там файл можно скачать.'));
      body.appendChild(el('p', 'muted', 'Скачанные PDF подключи сюда — они сохранятся в этом приложении и будут открываться без интернета. Можно выбрать сразу все файлы: Boat 16 сам разложит их по названиям.'));
      const bulk = el('label', 'btn btn-primary', '+ подключить файлы');
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'application/pdf,.pdf';
      input.hidden = true;
      input.addEventListener('change', function () {
        if (!input.files.length) return;
        Files.addMany(input.files).then(function (res) {
          const matched = res.filter(function (x) { return x.item; }).length;
          UI.toast('Сохранено файлов: ' + res.length + (matched < res.length ? ', без пары в списке: ' + (res.length - matched) : ''), { kind: 'ok' });
          refreshKeys().then(draw);
        }, function (e) { UI.toast('Не удалось сохранить: ' + e.message); });
      });
      bulk.appendChild(input);
      body.appendChild(bulk);
      head.appendChild(body);
      view.appendChild(head);

      MATERIALS.groups.forEach(function (g) {
        const m = el('section', 'mod');
        m.appendChild(el('div', 'mod-head', '<span class="mod-name">' + esc(g.title.toLowerCase()) + '</span><span class="mod-meta">' + g.items.length + '</span>'));
        const b = el('div', 'mod-body rows');
        g.items.forEach(function (it) { b.appendChild(row(it)); });
        m.appendChild(b);
        view.appendChild(m);
      });

      // Файлы, которые не удалось сопоставить
      const extra = Object.keys(stored).filter(function (k) { return k.indexOf('file:') === 0; });
      if (extra.length) {
        const m = el('section', 'mod');
        m.appendChild(el('div', 'mod-head', '<span class="mod-name">другие файлы</span>'));
        const b = el('div', 'mod-body rows');
        extra.forEach(function (k) {
          const r = el('div', 'mat-row');
          r.appendChild(el('span', 'mat-kind kind-pdf', 'pdf'));
          r.appendChild(el('div', 'mat-main', '<span class="mat-title">' + esc(k.slice(5)) + '</span>'));
          const act = el('div', 'mat-act');
          act.appendChild(UI.button('btn btn-sm', 'открыть', function () { Files.open(k); }));
          act.appendChild(UI.button('btn btn-sm btn-ghost', 'удалить', function () { Files.remove(k).then(refreshKeys).then(draw); }));
          r.appendChild(act);
          b.appendChild(r);
        });
        m.appendChild(b);
        view.appendChild(m);
      }
    }
  }

  window.MaterialsView = { render, row, refreshKeys };
  refreshKeys();
})();
