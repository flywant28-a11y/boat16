/* =========================================================
   Service worker Boat 16.
   Оболочка (HTML, стили, скрипты, данные, шрифты, иконки) кешируется
   при установке — приложение открывается без интернета.
   Картинки задач, рисунки и шрифты KaTeX кешируются по ходу: первый
   раз берутся из сети, дальше — из кеша. Сообщение {type:'cache-all', urls}
   докачивает список целиком (кнопка в settings).
   При смене VERSION старые кеши удаляются.
   ========================================================= */
const VERSION = 'boat16-v2';
const SHELL = VERSION + '-shell';
const RUNTIME = 'boat16-runtime';
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'fonts/jbm-latin-400.woff2', 'fonts/jbm-latin-600.woff2', 'fonts/jbm-cyrillic-400.woff2', 'fonts/jbm-cyrillic-600.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/favicon-64.png',
  'js/art.js', 'js/core.js', 'js/boot.js',
  'data/social.js', 'data/math-topics.js', 'data/math-bank.js', 'data/videos.js', 'data/review.js', 'data/materials.js',
  'vendor/katex/katex.min.css', 'vendor/katex/katex.min.js', 'vendor/katex/contrib/auto-render.min.js',
  'js/progress.js', 'js/bank.js', 'js/text.js', 'js/timer.js', 'js/files.js',
  'js/quiz.js', 'js/practice.js', 'js/popquiz.js',
  'js/plan.js', 'js/views/calendar.js',
  'js/views/home.js', 'js/views/topic.js', 'js/views/materials.js', 'js/views/settings.js', 'js/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== SHELL && k !== RUNTIME; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // YouTube, Telegram — только из сети

  // Разработка на localhost: сначала сеть, кеш — только если сети нет
  if (DEV) {
    e.respondWith(fetch(req).catch(function () { return caches.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true }); }));
    return;
  }

  // Страница: из кеша оболочки, без query (?app и т. п.)
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then(function (r) { return r || fetch(req); }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res.ok && /\/(math\/img|review\/img|vendor\/katex\/fonts)\//.test(url.pathname)) {
        const copy = res.clone();
        caches.open(RUNTIME).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});

// Докачать список картинок целиком, сообщая прогресс
self.addEventListener('message', function (e) {
  const msg = e.data || {};
  if (msg.type !== 'cache-all' || !Array.isArray(msg.urls)) return;
  const client = e.source;
  e.waitUntil(caches.open(RUNTIME).then(async function (cache) {
    let done = 0, failed = 0;
    const urls = msg.urls.slice();
    async function worker() {
      while (urls.length) {
        const u = urls.shift();
        try {
          if (!(await cache.match(u))) {
            const res = await fetch(u);
            if (res.ok) await cache.put(u, res); else failed++;
          }
        } catch (err) { failed++; }
        done++;
        if (done % 25 === 0 || !urls.length) client.postMessage({ type: 'cache-progress', done, total: msg.urls.length, failed });
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
  }));
});
