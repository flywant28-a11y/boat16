/* =========================================================
   Пиксельная графика Boat 16.
     scene(w, h, opts) — ночной океан с луной в буфере RGBA;
     logo()            — сцена 32×32 с одинокой лодкой под парусом;
     mountSea(canvas)  — живой фон на весь экран (звёзды мерцают,
                         лунная дорожка рябит, волны медленно плывут).
   Работает и в браузере, и в node (tools/make-icons.js рисует иконки).
   ========================================================= */
(function (root) {
  'use strict';

  const C = {
    sky: [[9, 11, 16], [12, 14, 21], [15, 18, 27], [19, 23, 34], [25, 30, 43], [32, 38, 54]],
    sea: [[21, 26, 37], [16, 20, 29], [12, 15, 22], [9, 11, 17]],
    horizon: [40, 47, 64],
    wave: [30, 36, 50], wave2: [42, 50, 67],
    starDim: [92, 98, 112], star: [176, 182, 196], starHi: [236, 234, 222],
    moon: [238, 231, 205], moonEdge: [214, 206, 177], crater: [200, 192, 162],
    halo1: [46, 50, 62], halo2: [34, 38, 50],
    glint: [236, 229, 203], glint2: [178, 170, 142], glint3: [98, 96, 88],
    deck: [112, 116, 128], hullHi: [58, 63, 77], hull: [36, 40, 50], mast: [140, 134, 118],
    sail: [222, 216, 194], sailShade: [168, 162, 143], pennant: [196, 120, 96]
  };

  // Порог упорядоченного дизеринга (Байер 4×4), 0..1
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

  // Детерминированный генератор случайных чисел
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buffer(w, h) { return { w, h, data: new Uint8ClampedArray(w * h * 4) }; }

  function px(b, x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    const i = (y * b.w + x) * 4;
    b.data[i] = c[0]; b.data[i + 1] = c[1]; b.data[i + 2] = c[2]; b.data[i + 3] = 255;
  }

  function hline(b, x0, x1, y, c) { for (let x = x0; x <= x1; x++) px(b, x, y, c); }

  // Градиент полосами с дизерингом между соседними цветами
  function bands(b, y0, y1, colors) {
    const n = colors.length - 1;
    for (let y = y0; y < y1; y++) {
      const f = (y - y0) / Math.max(1, y1 - y0 - 1) * n;
      const i = Math.min(n - 1, Math.floor(f)), frac = f - i;
      for (let x = 0; x < b.w; x++) px(b, x, y, frac > bayer(x, y) ? colors[i + 1] : colors[i]);
    }
  }

  /* ---------- Небо ---------- */
  function sky(b, H) { bands(b, 0, H, C.sky); }

  function stars(b, H, moon, seed, time) {
    const r = rng(seed);
    const count = Math.round(b.w * H / 70);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(r() * b.w), y = Math.floor(r() * (H - 4));
      const kind = r(), phase = r() * 6.28, speed = 0.6 + r() * 1.6;
      const dx = x - moon.x, dy = y - moon.y;
      if (dx * dx + dy * dy < (moon.r * 2.6) * (moon.r * 2.6)) continue;
      // Ближе к горизонту звёзд меньше и они тусклее
      if (y > H * 0.7 && r() < 0.6) continue;
      const tw = Math.sin(time * speed + phase);
      if (kind < 0.78) {
        px(b, x, y, tw > 0.55 ? C.star : C.starDim);
      } else if (kind < 0.95) {
        px(b, x, y, tw > -0.2 ? C.star : C.starDim);
        if (tw > 0.7) px(b, x + 1, y, C.starDim);
      } else {
        // Яркая звезда-крестик
        const c = tw > 0 ? C.starHi : C.star;
        px(b, x, y, c);
        if (tw > -0.5) { px(b, x - 1, y, C.starDim); px(b, x + 1, y, C.starDim); px(b, x, y - 1, C.starDim); px(b, x, y + 1, C.starDim); }
      }
    }
  }

  function drawMoon(b, m) {
    const R = m.r;
    // Ореол
    const h1 = R * 1.55, h2 = R * 2.2;
    for (let y = Math.floor(m.y - h2); y <= m.y + h2; y++) {
      for (let x = Math.floor(m.x - h2); x <= m.x + h2; x++) {
        const d = Math.hypot(x - m.x, y - m.y);
        if (d <= R) continue;
        if (d <= h1) { if ((h1 - d) / (h1 - R) * 0.8 + 0.15 > bayer(x, y)) px(b, x, y, C.halo1); }
        else if (d <= h2) { if ((h2 - d) / (h2 - h1) * 0.45 > bayer(x, y)) px(b, x, y, C.halo2); }
      }
    }
    // Диск, край и кратеры
    const r = rng(7);
    const craters = [];
    for (let i = 0; i < 4; i++) {
      const a = r() * 6.28, dist = r() * R * 0.55;
      craters.push({ x: m.x + Math.cos(a) * dist, y: m.y + Math.sin(a) * dist, r: Math.max(0.8, R * (0.12 + r() * 0.16)) });
    }
    for (let y = Math.floor(m.y - R); y <= m.y + R; y++) {
      for (let x = Math.floor(m.x - R); x <= m.x + R; x++) {
        const d = Math.hypot(x - m.x, y - m.y);
        if (d > R) continue;
        let c = d > R - 1 ? C.moonEdge : C.moon;
        // Лёгкая тень снизу слева
        if (c === C.moon && (x - m.x) * -0.6 + (y - m.y) * 0.8 > R * 0.45 && bayer(x, y) < 0.5) c = C.moonEdge;
        for (const k of craters) if (Math.hypot(x - k.x, y - k.y) <= k.r) c = C.crater;
        px(b, x, y, c);
      }
    }
  }

  /* ---------- Океан ---------- */
  function sea(b, H, seed, time) {
    hline(b, 0, b.w - 1, H, C.horizon);
    bands(b, H + 1, b.h, C.sea);
    const r = rng(seed + 101);
    const depth = b.h - H;
    const count = Math.round(b.w * depth / 55);
    for (let i = 0; i < count; i++) {
      const k = r();                                 // 0 — у горизонта, 1 — у зрителя
      const y = H + 2 + Math.floor(k * k * (depth - 2));
      const near = (y - H) / depth;
      const len = 1 + Math.floor(near * 7 * r() + near * 2);
      const drift = time * (0.4 + near * 1.6) * (r() < 0.5 ? 1 : -1);
      const x = Math.floor((r() * b.w + drift) % b.w + b.w) % b.w;
      const c = r() < 0.25 + near * 0.3 ? C.wave2 : C.wave;
      hline(b, x, x + len, y, c);
    }
  }

  // Лунная дорожка: под луной, мелкие блики шире к зрителю и дрожат со временем
  function moonPath(b, H, m, time) {
    const depth = b.h - H;
    const frame = Math.floor(time * 2.5);
    for (let y = H + 1; y < b.h; y++) {
      const near = (y - H) / depth;
      if ((y - H) % (near < 0.3 ? 1 : 2) !== 0) continue;
      const r = rng(y * 131 + frame * 7919);
      const half = Math.round(m.r * (0.35 + near * 1.6));
      const shift = Math.round((r() - 0.5) * (1 + near * 3));
      let x = m.x - half + shift;
      const end = m.x + half + shift;
      while (x <= end) {
        const len = 1 + Math.floor(r() * (1 + near * 4));
        const gap = Math.floor(r() * (1 + near * 3));
        const edge = Math.abs((x + len / 2) - m.x) / Math.max(1, half);
        const c = edge < 0.35 && r() < 0.8 - near * 0.3 ? C.glint : edge < 0.75 ? C.glint2 : C.glint3;
        hline(b, x, Math.min(end, x + len - 1), y, c);
        x += len + gap;
      }
    }
  }

  /* ---------- Спрайты логотипа ----------
     Нарисованы вручную: на сетке 32×32 формулы дают рваные края. */
  function sprite(b, x0, y0, rows, pal) {
    rows.forEach(function (row, y) {
      for (let x = 0; x < row.length; x++) {
        const c = pal[row[x]];
        if (c) px(b, x0 + x, y0 + y, c);
      }
    });
  }

  // Луна 9×9 с ореолом: M — диск, e — край в тени, c — кратер, h/g — ореол
  const MOON = [
    '...hhhhh...',
    '..hgMMMgh..',
    '.hMMMMMMMh.',
    'hgMMMcMMMgh',
    'hMMMMMMMMMh',
    'hMMcMMMMMMh',
    'hMMMMMcMMeh',
    'hgeMMMMMeeh',
    '.heeMMMeee.',
    '..hgeeegh..',
    '...hhhhh...'
  ];

  // Лодка: s — грот в лунном свете, d — стаксель в тени, m — мачта, p — вымпел,
  // k — палуба, H — борт, K — киль, r — рябь отражения
  const BOAT = [
    '.....pp.......',
    '.....mp.......',
    '.....ms.......',
    '.....mss......',
    '.....msss.....',
    '....dmsss.....',
    '....dmssss....',
    '...ddmssss....',
    '...ddmsssss...',
    '..dddmsssss...',
    '..dddmssssss..',
    '.ddddmssssss..',
    'kkkkkkkkkkkkkk',
    '.HHHHHHHHHHHH.',
    '..KKKKKKKKKK..',
    '...r.rr..r....',
    '.....r..r.....'
  ];

  function boat(b) {
    sprite(b, 6, 8, BOAT, {
      s: C.sail, d: C.sailShade, m: C.mast, p: C.pennant,
      k: C.deck, H: C.hullHi, K: C.hull, r: C.glint3
    });
  }

  /* ---------- Сцены ---------- */
  function layout(w, h) {
    const H = Math.round(h * 0.64);
    const r = Math.max(4, Math.round(Math.min(h * 0.055, w * 0.06)));
    return { H, moon: { x: Math.round(w * 0.74), y: Math.round(h * 0.2), r } };
  }

  function scene(w, h, opts) {
    opts = opts || {};
    const b = buffer(w, h);
    const L = opts.layout || layout(w, h);
    const t = opts.time || 0, seed = opts.seed || 16;
    sky(b, L.H);
    stars(b, L.H, L.moon, seed, t);
    drawMoon(b, L.moon);
    sea(b, L.H, seed, t);
    moonPath(b, L.H, L.moon, t);
    return b;
  }

  // Логотип 32×32: те же луна и море, плюс лодка. Всё важное — в центральных 80 %,
  // чтобы маскируемая иконка не обрезала луну и парус.
  function logo() {
    const b = buffer(32, 32);
    const H = 18;
    bands(b, 0, H, C.sky);
    [[3, 3], [9, 2], [16, 4], [29, 13], [3, 12], [14, 1], [28, 1], [1, 7]].forEach(function (s, i) {
      px(b, s[0], s[1], i % 3 === 0 ? C.star : C.starDim);
    });
    px(b, 4, 3, C.starDim); px(b, 2, 3, C.starDim); px(b, 3, 2, C.starDim); px(b, 3, 4, C.starDim);
    sprite(b, 19, 2, MOON, { M: C.moon, e: C.moonEdge, c: C.crater, g: C.halo1, h: C.halo2 });
    hline(b, 0, 31, H, C.horizon);
    bands(b, H + 1, 32, C.sea);
    [[1, 22, 3], [27, 21, 3], [2, 27, 4], [28, 28, 2], [16, 30, 3]].forEach(function (w) { hline(b, w[0], w[0] + w[2], w[1], C.wave); });
    // Дорожка от луны
    [[23, 19, 3, C.glint], [22, 21, 2, C.glint2], [25, 21, 2, C.glint], [23, 23, 4, C.glint2], [24, 23, 1, C.glint],
     [21, 25, 2, C.glint3], [24, 25, 3, C.glint2], [22, 27, 4, C.glint2], [23, 27, 1, C.glint],
     [20, 29, 2, C.glint3], [24, 29, 4, C.glint2], [22, 31, 5, C.glint3]
    ].forEach(function (g) { hline(b, g[0], g[0] + g[2] - 1, g[1], g[3]); });
    boat(b);
    return b;
  }

  /* ---------- Браузер: живой фон ---------- */
  function mountSea(canvas) {
    const ctx = canvas.getContext('2d');
    const still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let L = null, img = null, timer = null, t0 = Date.now();

    function size() {
      const P = Math.max(3, Math.ceil(root.innerHeight / 210));
      canvas.width = Math.ceil(root.innerWidth / P);
      canvas.height = Math.ceil(root.innerHeight / P);
      L = layout(canvas.width, canvas.height);
      img = ctx.createImageData(canvas.width, canvas.height);
      draw();
    }
    function draw() {
      const b = scene(canvas.width, canvas.height, { layout: L, time: still ? 0 : (Date.now() - t0) / 1000 });
      img.data.set(b.data);
      ctx.putImageData(img, 0, 0);
    }
    function loop() {
      clearInterval(timer);
      if (!still && root.document.visibilityState === 'visible') timer = setInterval(draw, 250);
    }
    let resizeT = 0;
    root.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(size, 120); });
    root.document.addEventListener('visibilitychange', loop);
    size();
    loop();
  }

  function paint(canvas, b) {
    canvas.width = b.w; canvas.height = b.h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(b.w, b.h);
    img.data.set(b.data);
    ctx.putImageData(img, 0, 0);
  }

  const Art = { scene, logo, mountSea, paint, colors: C };
  if (typeof module !== 'undefined' && module.exports) module.exports = Art;
  else root.Art = Art;
})(typeof window !== 'undefined' ? window : globalThis);
