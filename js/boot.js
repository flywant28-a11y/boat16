/* =========================================================
   Точка входа: по очереди грузит данные и модули и запускает App.
   ========================================================= */
(function () {
  'use strict';

  const VERSION = '3.0.1';

  // Порядок важен: данные → ядро → модули → экраны → App
  const SCRIPTS = [
    'data/social.js', 'data/math-topics.js', 'data/math-bank.js',
    'data/videos.js', 'data/embeds.js', 'data/review.js', 'data/materials.js',
    'vendor/katex/katex.min.js', 'vendor/katex/contrib/auto-render.min.js',
    'js/progress.js', 'js/bank.js', 'js/text.js', 'js/timer.js', 'js/files.js',
    'js/quiz.js', 'js/practice.js', 'js/popquiz.js',
    'js/plan.js', 'js/themes.js', 'js/term.js', 'js/wm.js',
    'js/views/calendar.js', 'js/views/home.js', 'js/views/topic.js', 'js/views/materials.js',
    'js/views/settings.js', 'js/views/stats.js',
    'js/app.js'
  ];

  window.BOAT = { version: VERSION };

  // Стили — с той же версией, что и скрипты, иначе браузер держит старые
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'css/app.css?v=' + VERSION;
  document.head.appendChild(css);

  // PWA: service worker берёт файлы из сети, а без интернета — из кеша (sw.js).
  // Он же убирает кеш старого service worker, из-за которого приложение не обновлялось.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function (e) { console.warn('SW:', e); });
    });
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
