/* =========================================================
   settings — прогресс (экспорт, импорт, в том числе файл со старого
   сайта), офлайн-кеш картинок задач, сброс, о приложении.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;

  function mod(name, meta) {
    const m = el('section', 'mod');
    m.appendChild(el('div', 'mod-head', '<span class="mod-name">' + name + '</span><span class="mod-meta">' + (meta || '') + '</span>'));
    const b = el('div', 'mod-body');
    m.appendChild(b);
    return { m, b };
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // Все картинки задач и разборов — для кнопки «скачать для офлайна»
  function imageUrls() {
    const urls = [];
    Object.keys(MATH_BANK).forEach(function (k) {
      const b = MATH_BANK[k];
      (b.tasks || []).forEach(function (t) { urls.push(t.img); if (t.aimg) urls.push(t.aimg); });
      (b.variants || []).forEach(function (v) { v.images.forEach(function (i) { urls.push(i); }); });
    });
    MATH_TOPICS.forEach(function (tp) {
      tp.subtopics.forEach(function (s) {
        (s.source || []).join('\n').replace(/\[\[fig:([A-Za-z0-9_.-]+)\]\]/g, function (_, n) { urls.push('math/img/figs/' + n + '.webp'); });
      });
    });
    REVIEW_TASKS.forEach(function (r) { if (r.img) urls.push('review/img/' + r.img + '.webp'); if (r.simg) urls.push('review/img/' + r.simg + '.webp'); });
    urls.push('review/img/ma-01-5.webp');
    return urls.filter(function (u, i) { return u && urls.indexOf(u) === i; });
  }

  function render(view) {
    view.classList.add('page');

    /* ---------- Прогресс ---------- */
    const p = mod('progress', Object.keys((Store.get('progress', {}) || {}).topics || {}).length + ' тем в записи');
    p.b.appendChild(el('p', 'muted', 'Прогресс хранится только в этом приложении. Сохрани файл, чтобы перенести его на другое устройство. Импорт понимает и файл экспорта со старого сайта «Тетрадь ОГЭ».'));
    const row = el('div', 'btn-row');
    row.appendChild(UI.button('btn', '↓ экспорт', function () { download('boat16-progress-' + Progress.today() + '.json', Progress.exportJSON()); }));
    const imp = el('label', 'btn', '↑ импорт');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    input.addEventListener('change', function () {
      const f = input.files[0];
      if (!f) return;
      f.text().then(function (text) {
        if (!confirm('Заменить текущий прогресс данными из файла «' + f.name + '»?')) return;
        try {
          const n = Progress.importJSON(text);
          Bank.reload();
          UI.toast('Импортировано тем: ' + n + '.', { kind: 'ok' });
          location.hash = '#/';
        } catch (e) { UI.toast('Не получилось: ' + e.message); }
      });
    });
    imp.appendChild(input);
    row.appendChild(imp);
    row.appendChild(UI.button('btn btn-ghost danger', 'сбросить всё', function () {
      if (!confirm('Удалить весь прогресс: изученные темы, повторы, минуты и решённые задачи?')) return;
      Progress.resetAll();
      Bank.reload();
      UI.toast('Прогресс сброшен.');
      location.hash = '#/';
    }));
    p.b.appendChild(row);
    view.appendChild(p.m);

    /* ---------- Офлайн ---------- */
    const o = mod('offline', '');
    const urls = imageUrls();
    o.b.appendChild(el('p', 'muted', 'Шпоры, тесты и задачи работают без интернета сразу. Картинки задач сохраняются, когда открываешь их. Можно скачать все ' + urls.length + ' картинок заранее (≈60 МБ). Ролики YouTube без интернета не работают.'));
    const status = el('p', 'note');
    const btn = UI.button('btn', '↓ скачать картинки для офлайна', function () {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) { UI.toast('Офлайн-режим ещё не готов — перезапусти приложение.'); return; }
      btn.disabled = true;
      status.textContent = 'скачиваю…';
      navigator.serviceWorker.addEventListener('message', function onMsg(e) {
        if (!e.data || e.data.type !== 'cache-progress') return;
        status.textContent = e.data.done + '/' + e.data.total + (e.data.failed ? ' · ошибок ' + e.data.failed : '');
        if (e.data.done >= e.data.total) {
          navigator.serviceWorker.removeEventListener('message', onMsg);
          btn.disabled = false;
          status.textContent = 'готово: ' + e.data.total + (e.data.failed ? ', не скачалось ' + e.data.failed : '');
        }
      });
      navigator.serviceWorker.controller.postMessage({ type: 'cache-all', urls: urls.map(function (u) { return new URL(u, location.href).href; }) });
    });
    o.b.appendChild(btn);
    o.b.appendChild(status);
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (est) {
        o.m.querySelector('.mod-meta').textContent = 'занято ' + Math.round((est.usage || 0) / 1048576) + ' МБ';
      });
    }
    view.appendChild(o.m);

    /* ---------- О приложении ---------- */
    const a = mod('about', 'v' + BOAT.version);
    a.b.innerHTML =
      '<p>Boat 16 — подготовка к ОГЭ по обществознанию и математике. Тема проходит путь <b>video → notes → review → practice</b>, потом повторы через 3 и 7 дней. Каждые 15 минут практики — по желанию опрос по закреплённым темам.</p>' +
      '<ul class="credits">' +
      '<li>Шпоры и задачи — материалы старого сайта: шпаргалки Умскула, открытый банк заданий ФИПИ.</li>' +
      '<li>Разборы — демонстрационные варианты ФИПИ 2026–2027 (fipi.ru).</li>' +
      '<li>Ролики — Данир Баев (<a href="' + VIDEO_AUTHORS.math.channel + '" target="_blank" rel="noopener">YouTube</a>) и Равиль Кандинский (<a href="' + VIDEO_AUTHORS.social.channel + '" target="_blank" rel="noopener">YouTube</a>, <a href="' + MATERIALS.channel + '" target="_blank" rel="noopener">Telegram</a>), онлайн-школа «Умскул».</li>' +
      '<li>Формулы — KaTeX, шрифт — JetBrains Mono (OFL).</li>' +
      '</ul>';
    view.appendChild(a.m);
  }

  window.SettingsView = { render };
})();
