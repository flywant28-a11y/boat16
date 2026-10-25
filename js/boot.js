/* =========================================================
   Точка входа: по очереди грузит данные и модули и запускает App.
   ========================================================= */
(function () {
  'use strict';

  const VERSION = '2.2.3';

  // Порядок важен: данные → ядро → модули → экраны → App
  const SCRIPTS = [
    'data/social.js', 'data/math-topics.js', 'data/math-bank.js',
    'data/videos.js', 'data/embeds.js', 'data/review.js', 'data/materials.js',
    'vendor/katex/katex.min.js', 'vendor/katex/contrib/auto-render.min.js',
    'js/progress.js', 'js/bank.js', 'js/text.js', 'js/timer.js', 'js/files.js',
    'js/quiz.js', 'js/practice.js', 'js/popquiz.js',
    'js/plan.js', 'js/views/calendar.js', 'js/views/search.js',
    'js/views/home.js', 'js/views/topic.js', 'js/views/materials.js', 'js/views/settings.js',
    'js/app.js'
  ];

  window.BOAT = { version: VERSION };

  // Раньше сайт был PWA: снимаем старый service worker, иначе он отдаёт кеш прошлой версии
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) {
        const w = r.active || r.waiting || r.installing;
        if (w && new URL('sw.js', location.href).href === w.scriptURL) r.unregister();
      });
    }).catch(function () {});
    if (window.caches) caches.keys().then(function (keys) {
      keys.filter(function (k) { return /^boat16-/.test(k); }).forEach(function (k) { caches.delete(k); });
    }).catch(function () {});
  }

  load(0);

  function load(i) {
    if (i >= SCRIPTS.length) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { App.start(); });
      else App.start();
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPTS[i] + '?v=' + VERSION;   // новая VERSION — браузер берёт свежие файлы, а не кеш
    s.onload = function () { load(i + 1); };
    s.onerror = function () { fail(SCRIPTS[i]); };
    document.head.appendChild(s);
  }

  function fail(src) {
    document.addEventListener('DOMContentLoaded', show);
    if (document.readyState !== 'loading') show();
    function show() {
      document.getElementById('root').innerHTML = '<div class="boot-fail card"><b>Failed to load ' + src +
        '</b><p>Check your internet connection and reload the page.</p></div>';
    }
  }
})();
