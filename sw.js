/* =========================================================
   Service worker boat16: сначала сеть, кеш — только без интернета.
   Так установленное приложение (PWA) всегда показывает свежую версию
   сайта, а без сети открывает последнюю сохранённую.
   Старый service worker (boat16-v3) отдавал всё из кеша и не обновлялся:
   этот при активации удаляет его кеши и перезагружает открытые окна —
   застрявшее приложение само переходит на новую версию.
   ========================================================= */
const CACHE = 'boat16-cache';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    const old = keys.filter(function (k) { return k !== CACHE; });
    return Promise.all(old.map(function (k) { return caches.delete(k); })).then(function () {
      return self.clients.claim();
    }).then(function () {
      if (!old.length) return;
      return self.clients.matchAll({ type: 'window' }).then(function (list) {
        list.forEach(function (c) { c.navigate(c.url).catch(function () {}); });
      });
    });
  }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // YouTube, Telegram — только из сети
  // Ключ кеша — путь без ?v=…: на каждый файл одна, последняя копия
  const key = url.origin + url.pathname;
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then(function (c) { return c.put(key, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(key).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match(new URL('index.html', self.registration.scope).href);
      return Response.error();
    });
  }));
});
