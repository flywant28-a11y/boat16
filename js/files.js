/* =========================================================
   Свои PDF в браузере (IndexedDB, база boat16-files).
   Файлы материалов на сайт не выкладываются: их скачивают из Telegram
   и подключают сюда — дальше они открываются без интернета.
   Ключ записи — id материала (data/materials.js) или имя файла,
   если файл не удалось сопоставить ни с одним материалом.
   ========================================================= */
(function () {
  'use strict';

  const DB = 'boat16-files', STORE = 'files';
  let dbp = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB недоступна')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbp;
  }

  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        const t = d.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(req && req.result); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  function put(key, file) {
    return tx('readwrite', function (s) { return s.put({ name: file.name, size: file.size, type: file.type || 'application/pdf', blob: file, added: Date.now() }, key); });
  }
  function get(key) { return tx('readonly', function (s) { return s.get(key); }); }
  function remove(key) { return tx('readwrite', function (s) { return s.delete(key); }); }
  function keys() { return tx('readonly', function (s) { return s.getAllKeys(); }).catch(function () { return []; }); }

  function norm(name) {
    // NFC: в именах файлов macOS «й» и «ё» бывают разложены на две буквы
    return String(name || '').normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/[–—]/g, '-').replace(/\.pdf$/, '').replace(/[^a-zа-я0-9]+/g, ' ').trim();
  }

  // Ищем материал по имени файла из поста
  function matchItem(fileName) {
    const n = norm(fileName);
    let found = null;
    (window.MATERIALS ? MATERIALS.groups : []).forEach(function (g) {
      g.items.forEach(function (it) { if (it.file && norm(it.file) === n) found = it; });
    });
    return found;
  }

  // Несколько файлов разом: сопоставленные — под id материала
  function addMany(fileList) {
    const jobs = Array.prototype.map.call(fileList, function (f) {
      const it = matchItem(f.name);
      return put(it ? it.id : 'file:' + f.name, f).then(function () { return { name: f.name, item: it }; });
    });
    return Promise.all(jobs);
  }

  function open(key) {
    return get(key).then(function (rec) {
      if (!rec) throw new Error('Файл не найден');
      const url = URL.createObjectURL(rec.blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    });
  }

  window.Files = { put, get, remove, keys, addMany, open, matchItem };
})();
