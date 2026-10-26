/* =========================================================
   Темы рабочего стола: обои и палитра терминала меняются вместе.
   Обои рисуются кодом (SVG): небо, солнце или луна, холмы и сакура;
   поверх — медленно падающие лепестки (их нет при reduced motion).
   Палитра окон — в css/app.css под [data-theme=…], здесь — только сцена.
   Тема хранится в Store 'theme'. Место под арт персонажа — .wall-art
   (Store 'wallart' — адрес картинки), пока пустое.
   ========================================================= */
(function () {
  'use strict';

  const W = 1600, H = 900;

  const THEMES = {
    sakura: {
      label: 'sakura', note: 'day, pink and blue',
      sky: ['#78ACE6', '#A8CBF1', '#F2D2E1'], sun: '#FFF7EA', sunX: 1270, sunY: 170, sunR: 58, glow: .5,
      clouds: .55, cloud: '#FFFFFF', hill: ['#C9B6DC', '#B29CCB'], trunk: '#5A4258',
      bloom: ['#FFE6EE', '#F8C0D2', '#EC98B4', '#C66F8E'], stars: 0, lanterns: false
    },
    dusk: {
      label: 'dusk', note: 'sunset, orange and violet',
      sky: ['#3A2E6A', '#B3618A', '#F5A86A'], sun: '#FFD7A0', sunX: 1210, sunY: 560, sunR: 96, glow: .7,
      clouds: .22, cloud: '#FFC9B0', hill: ['#7C4A77', '#5B345E'], trunk: '#382134',
      bloom: ['#FFD8C4', '#F5A7A0', '#DC7D8E', '#A35372'], stars: 0, lanterns: false
    },
    night: {
      label: 'night', note: 'dark blue, stars and lanterns',
      sky: ['#070B1F', '#131B44', '#2B336E'], sun: '#F3F0FF', sunX: 1280, sunY: 160, sunR: 44, glow: .35,
      clouds: .06, cloud: '#C9CCF5', hill: ['#1C2250', '#14193B'], trunk: '#110E23',
      bloom: ['#EAD8F6', '#C1A6E5', '#8E78C8', '#574A91'], stars: 160, lanterns: true
    },
    mint: {
      label: 'mint', note: 'fresh green, white blossoms',
      sky: ['#93D9C8', '#C6EEE1', '#F3FBF1'], sun: '#FFFBE6', sunX: 1260, sunY: 150, sunR: 54, glow: .5,
      clouds: .6, cloud: '#FFFFFF', hill: ['#A4D7C2', '#84C2AB'], trunk: '#4A5C51',
      bloom: ['#FFFFFF', '#E6F6EA', '#BEE2CB', '#84BEA0'], stars: 0, lanterns: false
    }
  };
  const ORDER = ['sakura', 'dusk', 'night', 'mint'];

  // Один и тот же «случай» каждый раз: сцена не прыгает между перезагрузками
  function rng(seed) {
    return function () { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  }
  function f(n) { return Math.round(n * 10) / 10; }

  // Ветки дерева: путь и толщина
  const BRANCHES = [
    ['M150 900C170 780 230 690 300 600', 54],
    ['M300 600C380 520 500 470 640 440', 30],
    ['M300 600C260 520 220 460 150 400', 24],
    ['M640 440C720 425 800 400 900 360', 16],
    ['M150 400C110 370 70 350 20 340', 12],
    ['M450 495C470 420 520 360 560 300', 14],
    ['M380 540C420 600 520 640 600 650', 13],
    ['M760 410C800 360 820 320 860 280', 8],
    ['M230 470C200 430 210 380 250 330', 9]
  ];
  // Облака цветов: x, y, радиус. Нижние — кусты вдоль края экрана
  const CLUMPS = [
    [20, 330, 110], [150, 380, 115], [250, 310, 95], [340, 430, 125], [480, 360, 115], [565, 290, 95],
    [650, 430, 115], [770, 380, 105], [880, 335, 90], [600, 640, 110], [470, 560, 105], [200, 520, 115],
    [60, 520, 115], [100, 720, 130], [330, 710, 135], [560, 770, 140], [800, 820, 140], [1040, 860, 150],
    [1290, 875, 150], [1530, 860, 145], [0, 880, 150], [260, 880, 140]
  ];

  function scene(t) {
    const r = rng(16);
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="s" x1="0" y1="0" x2=".25" y2="1">' +
      '<stop offset="0" stop-color="' + t.sky[0] + '"/><stop offset=".55" stop-color="' + t.sky[1] + '"/><stop offset="1" stop-color="' + t.sky[2] + '"/></linearGradient>' +
      '<radialGradient id="g"><stop offset="0" stop-color="' + t.sun + '" stop-opacity="' + t.glow + '"/><stop offset="1" stop-color="' + t.sun + '" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="l"><stop offset="0" stop-color="#FFC27A" stop-opacity=".85"/><stop offset="1" stop-color="#FFC27A" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#s)"/>';

    for (let i = 0; i < t.stars; i++) {
      s += '<circle cx="' + f(r() * W) + '" cy="' + f(r() * 560) + '" r="' + f(.5 + r() * 1.3) + '" fill="#fff" opacity="' + f(.25 + r() * .7) + '"/>';
    }
    s += '<circle cx="' + t.sunX + '" cy="' + t.sunY + '" r="' + t.sunR * 4.5 + '" fill="url(#g)"/>' +
      '<circle cx="' + t.sunX + '" cy="' + t.sunY + '" r="' + t.sunR + '" fill="' + t.sun + '"/>';

    // Облака — связки мягких эллипсов
    [[980, 250, 1], [1420, 330, .8], [700, 150, .7], [1180, 420, .6]].forEach(function (c) {
      for (let i = 0; i < 6; i++) {
        s += '<ellipse cx="' + f(c[0] + (r() - .5) * 220 * c[2]) + '" cy="' + f(c[1] + (r() - .5) * 30 * c[2]) + '" rx="' + f((60 + r() * 70) * c[2]) +
          '" ry="' + f((18 + r() * 16) * c[2]) + '" fill="' + t.cloud + '" opacity="' + f(t.clouds * (.5 + r() * .5)) + '"/>';
      }
    });

    s += '<path d="M0 640Q300 560 620 610T1200 590T1600 600V900H0Z" fill="' + t.hill[0] + '"/>' +
      '<path d="M0 730Q400 655 800 705T1600 690V900H0Z" fill="' + t.hill[1] + '"/>';

    BRANCHES.forEach(function (b) {
      s += '<path d="' + b[0] + '" fill="none" stroke="' + t.trunk + '" stroke-width="' + b[1] + '" stroke-linecap="round"/>';
    });

    // Цветы: тёмные внизу облака и сзади, светлые — сверху и поверх
    // Под каждым облаком — тень-масса, сверху — много мелких кружков-соцветий
    CLUMPS.forEach(function (c) {
      s += '<ellipse cx="' + c[0] + '" cy="' + f(c[1] + c[2] * .12) + '" rx="' + f(c[2] * .92) + '" ry="' + f(c[2] * .7) + '" fill="' + t.bloom[3] + '" opacity=".55"/>';
    });
    const dots = [];
    CLUMPS.forEach(function (c) {
      const n = Math.round(c[2] * 1.15);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = c[2] * Math.sqrt(r());
        const x = c[0] + Math.cos(a) * d, y = c[1] + Math.sin(a) * d * .8;
        const shade = Math.max(0, Math.min(3, Math.floor(((y - c[1]) / c[2] + 1) * 1.6 + r() * 1.4 - .5)));
        const k = r();
        dots.push([x, y, 3.5 + k * k * c[2] * (shade === 0 ? .1 : .17), shade, .8 + r() * .2]);
      }
    });
    dots.sort(function (a, b) { return b[3] - a[3]; });
    dots.forEach(function (d) { s += '<circle cx="' + f(d[0]) + '" cy="' + f(d[1]) + '" r="' + f(d[2]) + '" fill="' + t.bloom[d[3]] + '" opacity="' + f(d[4]) + '"/>'; });

    if (t.lanterns) {
      [[360, 560, 70], [450, 505, 95], [545, 470, 60], [700, 432, 85], [820, 398, 55]].forEach(function (l) {
        const y = l[1] + l[2];
        s += '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[0] + '" y2="' + y + '" stroke="#2A2340" stroke-width="2"/>' +
          '<circle cx="' + l[0] + '" cy="' + (y + 16) + '" r="70" fill="url(#l)"/>' +
          '<rect x="' + (l[0] - 13) + '" y="' + y + '" width="26" height="34" rx="11" fill="#FFB466"/>' +
          '<rect x="' + (l[0] - 9) + '" y="' + (y - 3) + '" width="18" height="5" fill="#7A3B2E"/>' +
          '<rect x="' + (l[0] - 9) + '" y="' + (y + 32) + '" width="18" height="5" fill="#7A3B2E"/>';
      });
    }
    return s + '</svg>';
  }

  let wall = null;
  const cache = {};

  function mount(root) {
    wall = UI.el('div', 'wall');
    wall.setAttribute('aria-hidden', 'true');
    wall.appendChild(UI.el('div', 'wall-img'));
    const art = UI.el('div', 'wall-art');
    const src = Store.get('wallart', '');
    if (src) art.style.backgroundImage = 'url("' + String(src).replace(/"/g, '') + '")';
    wall.appendChild(art);
    const petals = UI.el('div', 'petals');
    const r = rng(7);
    for (let i = 0; i < 18; i++) {
      const p = UI.el('i', 'petal');
      p.style.cssText = '--x:' + f(r() * 100) + 'vw;--d:' + f(16 + r() * 18) + 's;--w:-' + f(r() * 30) + 's;--s:' + f(.6 + r() * .7) + ';--dx:' + f(-10 - r() * 18) + 'vw';
      petals.appendChild(p);
    }
    wall.appendChild(petals);
    root.appendChild(wall);
    set(current(), true);
  }

  function current() { const t = Store.get('theme', 'sakura'); return THEMES[t] ? t : 'sakura'; }

  function set(name, quiet) {
    if (!THEMES[name]) return false;
    Store.set('theme', name);
    document.documentElement.setAttribute('data-theme', name);
    if (wall) {
      if (!cache[name]) cache[name] = 'url("data:image/svg+xml,' + encodeURIComponent(scene(THEMES[name])) + '")';
      wall.querySelector('.wall-img').style.backgroundImage = cache[name];
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEMES[name].sky[0];
    if (!quiet) window.dispatchEvent(new CustomEvent('theme-changed', { detail: { name } }));
    return true;
  }

  function next() { set(ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length]); }

  window.Themes = { ORDER, list: THEMES, mount, current, set, next };
})();
