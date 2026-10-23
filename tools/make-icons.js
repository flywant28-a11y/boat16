/* Иконки приложения из пиксельного логотипа (js/art.js): node tools/make-icons.js
   Логотип 32×32 увеличивается без сглаживания, PNG собирается вручную через zlib. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Art = require('../js/art.js');

const OUT = path.join(__dirname, '..', 'icons');

const CRC = new Uint32Array(256).map(function (_, n) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Увеличение в size пикселей: целый масштаб, остаток — рамка цветом неба
function scaled(b, size) {
  const k = Math.floor(size / b.w);
  const pad = Math.floor((size - b.w * k) / 2);
  const out = new Uint8ClampedArray(size * size * 4);
  const bg = Art.colors.sky[0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - pad) / k), sy = Math.floor((y - pad) / k);
      const o = (y * size + x) * 4;
      if (sx < 0 || sy < 0 || sx >= b.w || sy >= b.h) { out[o] = bg[0]; out[o + 1] = bg[1]; out[o + 2] = bg[2]; out[o + 3] = 255; continue; }
      const i = (sy * b.w + sx) * 4;
      out[o] = b.data[i]; out[o + 1] = b.data[i + 1]; out[o + 2] = b.data[i + 2]; out[o + 3] = 255;
    }
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
const logo = Art.logo();
[['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-32.png', 32], ['favicon-64.png', 64]]
  .forEach(function (f) {
    fs.writeFileSync(path.join(OUT, f[0]), png(f[1], f[1], scaled(logo, f[1])));
    console.log('icons/' + f[0]);
  });
