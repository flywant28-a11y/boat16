/* =========================================================
   Точка входа. Сайт в обычном браузере — только страница установки;
   установленное приложение (display-mode: standalone) грузит данные
   и модули и запускает App. На localhost страницу можно открыть
   приложением с ?app — для разработки.
   ========================================================= */
(function () {
  'use strict';

  const VERSION = '1.2.0';

  // Порядок важен: данные → ядро → модули → экраны → App
  const SCRIPTS = [
    'data/social.js', 'data/math-topics.js', 'data/math-bank.js',
    'data/videos.js', 'data/embeds.js', 'data/review.js', 'data/materials.js',
    'vendor/katex/katex.min.js', 'vendor/katex/contrib/auto-render.min.js',
    'js/progress.js', 'js/bank.js', 'js/text.js', 'js/timer.js', 'js/files.js',
    'js/quiz.js', 'js/practice.js', 'js/popquiz.js',
    'js/plan.js', 'js/views/calendar.js',
    'js/views/home.js', 'js/views/topic.js', 'js/views/materials.js', 'js/views/settings.js',
    'js/app.js'
  ];

  const standalone = matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;
  const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]app\b/.test(location.search);

  // Service worker — и для установки, и для работы без интернета
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW:', e); });
    });
  }

  window.BOAT = { version: VERSION, standalone, dev };

  if (standalone || dev) {
    document.documentElement.classList.add('mode-app');
    load(0);
  } else {
    document.documentElement.classList.add('mode-gate');
    document.addEventListener('DOMContentLoaded', function () { Gate.mount(document.getElementById('root')); });
  }

  function load(i) {
    if (i >= SCRIPTS.length) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { App.start(); });
      else App.start();
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPTS[i];
    s.onload = function () { load(i + 1); };
    s.onerror = function () { fail(SCRIPTS[i]); };
    document.head.appendChild(s);
  }

  function fail(src) {
    document.addEventListener('DOMContentLoaded', show);
    if (document.readyState !== 'loading') show();
    function show() {
      document.getElementById('root').innerHTML = '<div class="boot-fail card"><b>Не загрузился ' + src +
        '</b><p>Похоже, приложение открыто первый раз без интернета. Подключись к сети и перезапусти Boat 16.</p></div>';
    }
  }

  /* =========================================================
     Страница установки
     ========================================================= */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (window.Gate) Gate.refresh();
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    if (window.Gate) Gate.installed();
  });

  function browser() {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (/DuckDuckGo|Ddg/i.test(ua)) return 'other';
    if (/Firefox|FxiOS/i.test(ua)) return 'other';
    if (ios) return /CriOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios-safari';
    if (/Edg\//.test(ua)) return 'chromium';
    if (/Chrome|Chromium|YaBrowser|OPR/.test(ua)) return 'chromium';
    if (/Macintosh/.test(ua) && /Safari/.test(ua)) return 'mac-safari';
    return 'other';
  }

  const STEPS = {
    'mac-safari': [
      'Открой меню <b>Файл</b> в строке меню.',
      'Нажми <b>Добавить в Dock…</b>, затем <b>Добавить</b>.',
      'Boat 16 появится в Dock и в Launchpad — запускай его оттуда.'
    ],
    'chromium': [
      'Нажми <b>Установить</b> ниже — или значок установки ⊕ справа в адресной строке.',
      'Подтверди установку.',
      'Boat 16 откроется отдельным окном; на Mac он будет в Launchpad и Dock.'
    ],
    'ios-safari': [
      'Нажми <b>Поделиться</b> (квадрат со стрелкой).',
      'Выбери <b>На экран «Домой»</b> и нажми <b>Добавить</b>.',
      'Запускай Boat 16 с главного экрана.'
    ],
    'ios-other': [
      'На iPhone и iPad приложение ставится только из <b>Safari</b>.',
      'Скопируй ссылку ниже и открой её в Safari.'
    ],
    'other': [
      'Этот браузер не умеет устанавливать веб-приложения (так ведут себя DuckDuckGo и Firefox).',
      'Скопируй ссылку и открой её в <b>Safari</b> или <b>Chrome</b> — там будет кнопка установки.'
    ]
  };

  const Gate = {
    root: null,
    mount: function (root) {
      this.root = root;
      root.innerHTML =
        '<main class="gate">' +
        '  <div class="gate-card card">' +
        '    <canvas class="gate-logo" width="32" height="32" aria-label="Логотип Boat 16: лодка под парусом в ночном океане"></canvas>' +
        '    <h1 class="gate-title">Boat 16</h1>' +
        '    <p class="gate-sub">подготовка к ОГЭ · обществознание + математика</p>' +
        '    <div class="term">' +
        '      <div class="term-line"><span class="prompt">$</span> boat16 --install</div>' +
        '      <ol class="term-steps"></ol>' +
        '      <div class="gate-actions"></div>' +
        '    </div>' +
        '    <ul class="gate-facts">' +
        '      <li><b>92</b> темы: 54 по обществу, 38 по математике</li>' +
        '      <li><b>2 965</b> задач ФИПИ + 80 вариантов №1–5</li>' +
        '      <li><b>1 632</b> вопроса тестов по обществознанию</li>' +
        '      <li><b>108</b> роликов Данира Баева и Равиля Кандинского</li>' +
        '      <li>разборы демоверсий 2026–2027, повторы через 3 и 7 дней</li>' +
        '      <li>работает без интернета после первого запуска</li>' +
        '    </ul>' +
        '    <p class="gate-note">Этот сайт только устанавливает приложение. Учиться — в установленном Boat 16.</p>' +
        '  </div>' +
        '</main>';
      Art.paint(root.querySelector('.gate-logo'), Art.logo());
      this.refresh();
    },
    refresh: function () {
      if (!this.root) return;
      let kind = browser();
      const steps = STEPS[kind];
      this.root.querySelector('.term-steps').innerHTML = steps.map(function (s) { return '<li>' + s + '</li>'; }).join('');
      const actions = this.root.querySelector('.gate-actions');
      actions.innerHTML = '';
      if (deferred) {
        const b = document.createElement('button');
        b.className = 'btn btn-primary';
        b.textContent = 'Установить Boat 16';
        b.addEventListener('click', function () {
          deferred.prompt();
          deferred.userChoice.finally(function () { deferred = null; Gate.refresh(); });
        });
        actions.appendChild(b);
      }
      if (kind === 'other' || kind === 'ios-other') {
        const c = document.createElement('button');
        c.className = 'btn';
        c.textContent = 'Скопировать ссылку';
        c.addEventListener('click', function () {
          const url = location.origin + location.pathname;
          (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
            c.textContent = 'Ссылка скопирована';
          }, function () { prompt('Скопируй ссылку:', url); });
        });
        actions.appendChild(c);
      }
    },
    installed: function () {
      if (!this.root) return;
      this.root.querySelector('.term-steps').innerHTML = '<li>Готово — Boat 16 установлен. Открой его из Dock, Launchpad или с главного экрана.</li>';
      this.root.querySelector('.gate-actions').innerHTML = '';
    }
  };
  window.Gate = Gate;
})();
