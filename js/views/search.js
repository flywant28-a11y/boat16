/* =========================================================
   Поиск EcoPlant — главный экран и научные статьи:
     #/         — строка поиска по интернету (ecoplant.org);
     #/science  — научные статьи через поиск EcoPlant.
   Сам поиск живёт на ecoplant.org/result/?search=… и открывается в браузере.
   aiUrl() — ИИ EcoPlant для кнопки в боковом меню: ecoplant.online в России,
   ecoplant.ai в других странах (по часовому поясу устройства).
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;

  const SEARCH = 'https://ecoplant.org/result/?search=';
  const AI = { ru: 'https://ecoplant.online', world: 'https://ecoplant.ai' };

  // Часовые пояса России (IANA) — по ним выбираем ссылку на ИИ
  const RU_ZONES = ['Europe/Kaliningrad', 'Europe/Moscow', 'Europe/Kirov', 'Europe/Volgograd', 'Europe/Astrakhan',
    'Europe/Saratov', 'Europe/Ulyanovsk', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk',
    'Asia/Barnaul', 'Asia/Tomsk', 'Asia/Novokuznetsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Chita', 'Asia/Yakutsk',
    'Asia/Khandyga', 'Asia/Vladivostok', 'Asia/Ust-Nera', 'Asia/Magadan', 'Asia/Sakhalin', 'Asia/Srednekolymsk',
    'Asia/Kamchatka', 'Asia/Anadyr'];

  function zone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }
  function aiUrl() { return RU_ZONES.indexOf(zone()) !== -1 ? AI.ru : AI.world; }

  function go(q, extra) {
    q = (q || '').trim();
    if (!q) return false;
    window.open(SEARCH + encodeURIComponent(q) + (extra || ''), '_blank', 'noopener');
    return true;
  }

  const ICON = {
    search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
  };

  // Строка поиска-«пилюля», как на главной Lirra
  function pill(opts) {
    const wrap = el('div', 'hsearch');
    const form = el('form', 'hpill');
    form.setAttribute('role', 'search');
    form.innerHTML = '<input type="search" autocomplete="off" spellcheck="false" placeholder="' + esc(opts.placeholder) + '" aria-label="' + esc(opts.label) + '">' +
      '<button type="submit" class="hgo" aria-label="Search">' + ICON.search + '</button>';
    const input = form.querySelector('input');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (go(input.value, opts.extra)) input.value = '';
      else input.focus();
    });
    wrap.appendChild(form);
    wrap.set = function (v) { input.value = v; input.focus(); };
    return wrap;
  }

  function tags(list, box) {
    const t = el('div', 'htags');
    t.innerHTML = list.map(function (w) { return '<button type="button" data-q="' + esc(w) + '">#' + esc(w) + '</button>'; }).join('');
    t.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (b) box.set(b.getAttribute('data-q'));
    });
    return t;
  }

  function home(view) {
    const hero = el('section', 'home');
    hero.innerHTML = '<img class="home-logo rise" src="icons/ecoplant-logo.png" width="587" height="124" alt="EcoPlant">' +
      '<p class="home-tag rise" style="--i:1">Knowledge to save nature</p>';
    const box = pill({ placeholder: 'Search the web', label: 'EcoPlant search' });
    box.classList.add('rise');
    box.style.setProperty('--i', 1);
    hero.appendChild(box);
    hero.appendChild(tags(['ecology', 'education', 'forest'], box));
    view.appendChild(hero);
    setTimeout(function () { const i = hero.querySelector('input'); if (i && matchMedia('(pointer: fine)').matches) i.focus(); }, 50);
  }

  function science(view) {
    const page = el('section', 'sect-page');
    page.innerHTML =
      '<div class="eyebrow">scientific</div>' +
      '<h1 class="page-title">Scientific articles</h1>' +
      '<p class="page-lead">Find research and reviews with EcoPlant. Results open on ecoplant.org — switch to the <b>Scientific article</b> tab there.</p>';
    const box = pill({ placeholder: 'Article topic', label: 'Search scientific articles', extra: '&tab=scientific' });
    page.appendChild(box);
    page.appendChild(tags(['photosynthesis', 'climate change', 'biodiversity', 'water pollution'], box));
    view.appendChild(page);
  }

  function render(view, section) {
    view.classList.add('view-search');
    if (section === 'science') science(view);
    else home(view);
  }

  window.SearchView = { render, aiUrl };
})();
