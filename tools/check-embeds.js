/* Какие ролики YouTube запрещено встраивать на сайты: node tools/check-embeds.js
   oEmbed отвечает 401 — автор запретил встраивание, 404 — ролик удалён или скрыт.
   Результат — data/embeds.js (window.NO_EMBED, window.GONE). Такие ролики
   приложение открывает на YouTube, а не во встроенном плеере. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const w = {};
w.window = w;
vm.createContext(w);
['data/videos.js', 'data/review.js', 'data/materials.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), w);
});

const ids = new Set();
Object.values(w.VIDEOS).forEach(function (list) { list.forEach(function (v) { ids.add(v.id); }); });
Object.values(w.REVIEW_SOURCES).forEach(function (s) { ids.add(s.video.id); });
w.REVIEW_CLIPS.forEach(function (c) { if (c.video) ids.add(c.video.id); });
w.MATERIALS.groups.forEach(function (g) { g.items.forEach(function (it) { if (it.yt) ids.add(it.yt); }); });

async function status(id) {
  const url = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id);
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return (await fetch(url)).status; } catch (e) { /* повторим */ }
  }
  return 0;
}

(async function () {
  const noEmbed = [], gone = [];
  for (const id of ids) {
    const s = await status(id);
    if (s === 401 || s === 403) noEmbed.push(id);
    else if (s === 404) gone.push(id);
    else if (s !== 200) console.warn('не проверен:', id, s);
  }
  const map = function (list) { return '{\n' + list.map(function (id) { return "  '" + id + "': true"; }).join(',\n') + '\n}'; };
  const out = '/* Сгенерировано tools/check-embeds.js ' + new Date().toISOString().slice(0, 10) + ' — руками не править.\n' +
    '   NO_EMBED — автор запретил смотреть ролик на других сайтах (открываем на YouTube);\n' +
    '   GONE — ролик удалён или скрыт. */\n' +
    'window.NO_EMBED = ' + map(noEmbed) + ';\n\nwindow.GONE = ' + map(gone) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'data/embeds.js'), out);
  console.log('всего ' + ids.size + ', без встраивания ' + noEmbed.length + ', удалено ' + gone.length);
})();
