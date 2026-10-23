/* =========================================================
   App: верхняя панель, роутер и общие события.
   Маршруты:
     #/                    — главный экран (модули: today, calendar, темы, stats)
     #/t/<id>[/<вкладка>]  — тема: video · notes · review · practice
     #/materials           — материалы Равиля из Telegram
     #/settings            — прогресс, офлайн, о приложении
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  let view = null, bar = null;

  function topbar() {
    bar = el('header', 'topbar');
    const home = el('a', 'brand');
    home.href = '#/';
    const logo = el('canvas', 'brand-logo');
    Art.paint(logo, Art.logo());
    home.appendChild(logo);
    home.appendChild(el('span', 'brand-name', 'boat16'));
    bar.appendChild(home);
    bar.appendChild(el('nav', 'crumbs'));

    const search = el('label', 'search');
    search.innerHTML = '<span class="search-key">/</span><input type="search" placeholder="найти тему" aria-label="Найти тему" autocomplete="off" spellcheck="false">';
    bar.appendChild(search);
    const input = search.querySelector('input');
    input.addEventListener('input', function () {
      if (location.hash !== '#/' && location.hash !== '') location.hash = '#/';
      window.dispatchEvent(new CustomEvent('topic-filter', { detail: { q: input.value } }));
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        const first = document.querySelector('.topic-row:not([hidden])');
        if (first) { input.value = ''; window.dispatchEvent(new CustomEvent('topic-filter', { detail: { q: '' } })); location.hash = first.getAttribute('href'); }
      }
      if (e.key === 'Escape') { input.value = ''; input.blur(); window.dispatchEvent(new CustomEvent('topic-filter', { detail: { q: '' } })); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });

    const nav = el('nav', 'topnav');
    nav.innerHTML = '<a href="#/materials">materials</a><a href="#/settings">settings</a>';
    bar.appendChild(nav);
    return bar;
  }

  // Хлебные крошки: ~/boat16 / общество / тема
  function crumbs(parts) {
    const box = bar.querySelector('.crumbs');
    box.innerHTML = '<a href="#/">~</a>' + parts.map(function (p) {
      return '<span class="sep">/</span>' + (p.href ? '<a href="' + p.href + '">' + esc(p.text) + '</a>' : '<span>' + esc(p.text) + '</span>');
    }).join('');
  }

  function route() {
    Timer.stop();
    const hash = location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
    view.innerHTML = '';
    view.className = 'view';
    view._screen = null;
    document.querySelectorAll('.overlay').forEach(function (o) { if (!o.querySelector('.quiz-modal')) o.remove(); });
    if (parts[0] === 't' && parts[1]) {
      const found = Subjects.find(parts[1]);
      if (found) {
        crumbs([{ text: Subjects.get(found.subject).dir, href: '#/' }, { text: found.topic.title }]);
        TopicView.render(view, found, parts[2]);
        return;
      }
    }
    if (parts[0] === 'materials') { crumbs([{ text: 'materials' }]); MaterialsView.render(view); }
    else if (parts[0] === 'settings') { crumbs([{ text: 'settings' }]); SettingsView.render(view); }
    else { crumbs([]); HomeView.render(view); }
    window.scrollTo(0, 0);
  }

  function start() {
    const root = document.getElementById('root');
    root.innerHTML = '';
    root.appendChild(topbar());
    view = el('main', 'view');
    root.appendChild(view);
    window.addEventListener('hashchange', route);
    route();

    // Новая версия service worker — подсказка перезапустить
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (start.swSeen) UI.toast('Boat 16 обновился.', { actions: [{ label: 'Перезапустить', run: function () { location.reload(); } }] });
        start.swSeen = true;
      });
      start.swSeen = !!navigator.serviceWorker.controller;
    }
    window.addEventListener('offline', function () { UI.toast('Нет интернета: ролики не загрузятся, всё остальное работает.'); });
  }

  window.App = { start, crumbs, route };
})();
