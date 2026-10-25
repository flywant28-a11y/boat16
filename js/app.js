/* =========================================================
   App: верхняя панель, роутер и общие события.
   Маршруты:
     #/                    — поиск EcoPlant (js/views/search.js)
     #/science             — научные статьи через поиск EcoPlant
     #/courses             — курсы: модули today, calendar, темы, stats
     #/t/<id>[/<вкладка>]  — тема: video · notes · review · practice
     #/calendar[/ГГГГ-ММ]  — календарь: повторы, план до ОГЭ, сделанное по дням
     #/materials           — материалы Равиля из Telegram
     #/settings            — прогресс, о сайте
   ИИ и Area monitoring — внешние сайты EcoPlant, открываются из переключателя сразу.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  let view = null, bar = null;

  const OUT = '<svg class="ext" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  // Логотип и ~/крошки слева; страницы курсов и переключатель разделов (как в Lirra) справа
  function topbar() {
    bar = el('header', 'topbar');
    const home = el('a', 'brand');
    home.href = '#/';
    home.setAttribute('aria-label', 'EcoPlant — home');
    home.innerHTML = '<img class="brand-mark" src="icons/ecoplant-mark.png" width="96" height="96" alt="EcoPlant">';
    bar.appendChild(home);
    bar.appendChild(el('nav', 'crumbs'));

    const nav = el('nav', 'topnav');
    nav.innerHTML = '<a href="#/calendar" data-page="calendar">calendar</a><a href="#/materials" data-page="materials">materials</a><a href="#/settings" data-page="settings">settings</a>';
    bar.appendChild(nav);

    function item(key, href, text, ext) {
      return '<a href="' + href + '"' + (key ? ' data-sec="' + key + '"' : ' target="_blank" rel="noopener"') +
        '><i class="pd pd-' + (key || ext) + '"></i>' + text + (ext ? OUT : '') + '</a>';
    }
    const sw = el('nav', 'pswitch');
    sw.setAttribute('aria-label', 'Sections');
    sw.innerHTML = '<span class="pind"></span>' +
      item('search', '#/', 'Search') +
      item('', SearchView.aiUrl(), 'AI', 'ai') +
      item('science', '#/science', 'Articles') +
      item('courses', '#/courses', 'Courses') +
      item('', 'https://ecoplant.org/signin', 'Area monitoring', 'monitor');
    bar.appendChild(sw);
    // Кнопки меняют ширину при загрузке шрифта и на узком экране — бегунок догоняет
    const again = function () { section(bar.getAttribute('data-sec'), bar.getAttribute('data-page')); };
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(again);
      sw.querySelectorAll('a').forEach(function (a) { ro.observe(a); });
    } else window.addEventListener('resize', again);
    return bar;
  }

  // Подсветка раздела: «бегунок» переезжает под активную кнопку
  function section(key, page) {
    bar.setAttribute('data-sec', key);
    bar.setAttribute('data-page', page || '');
    let on = null;
    bar.querySelectorAll('[data-sec]').forEach(function (a) {
      const hit = a.getAttribute('data-sec') === key;
      a.setAttribute('aria-current', hit ? 'page' : 'false');
      if (hit) on = a;
    });
    bar.querySelectorAll('[data-page]').forEach(function (a) {
      a.setAttribute('aria-current', a.getAttribute('data-page') === page ? 'page' : 'false');
    });
    if (!on) return;
    const sw = bar.querySelector('.pswitch'), ind = sw.querySelector('.pind');
    ind.style.left = on.offsetLeft + 'px';
    ind.style.width = on.offsetWidth + 'px';
    // На телефоне переключатель прокручивается: показываем активную кнопку
    if (sw.scrollWidth > sw.clientWidth) sw.scrollLeft = Math.max(0, on.offsetLeft - 12);
  }

  // Хлебные крошки: ~/courses / social / тема
  function crumbs(parts) {
    const box = bar.querySelector('.crumbs');
    box.innerHTML = !parts.length ? '' : '<a href="#/courses">~/courses</a>' + parts.map(function (p) {
      return '<span class="sep">/</span>' + (p.href ? '<a href="' + p.href + '">' + esc(p.text) + '</a>' : '<span>' + esc(p.text) + '</span>');
    }).join('');
  }

  function route() {
    Timer.stop();
    Plan.refresh();   // прогресс мог измениться — план пересчитается
    const hash = location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
    view.innerHTML = '';
    view.className = 'view';
    view._screen = null;
    document.querySelectorAll('.overlay').forEach(function (o) { if (!o.querySelector('.quiz-modal')) o.remove(); });
    if (parts[0] === 't' && parts[1]) {
      const found = Subjects.find(parts[1]);
      if (found) {
        section('courses');
        crumbs([{ text: Subjects.get(found.subject).dir, href: '#/courses' }, { text: found.topic.title }]);
        TopicView.render(view, found, parts[2]);
        return;
      }
    }
    if (parts[0] === 'science') { section('science'); crumbs([]); SearchView.render(view, 'science'); }
    else if (parts[0] === 'courses') { section('courses'); crumbs([]); HomeView.render(view); }
    else if (parts[0] === 'calendar') { section('courses', 'calendar'); crumbs([{ text: 'calendar' }]); CalendarView.render(view, parts[1]); }
    else if (parts[0] === 'materials') { section('courses', 'materials'); crumbs([{ text: 'materials' }]); MaterialsView.render(view); }
    else if (parts[0] === 'settings') { section('courses', 'settings'); crumbs([{ text: 'settings' }]); SettingsView.render(view); }
    else { section('search'); crumbs([]); SearchView.render(view); }
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

    window.addEventListener('offline', function () { UI.toast('No internet: videos won\'t load, everything else works.'); });
  }

  window.App = { start, crumbs, route };
})();
