// Значок приложения: пиксельная корона на щите 16×16, увеличенная до 256×256 (PNG без сторонних пакетов).
import fs from 'fs';
import zlib from 'zlib';
const P = { '.': null, k: [26, 20, 16], g: [232, 190, 64], y: [255, 226, 120], o: [176, 120, 30], b: [34, 64, 138], l: [70, 110, 190], w: [240, 232, 210], r: [180, 40, 50] };
const A = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.klbbbbbbbbbbbk.',
  '.klybbbyybbbybk.',
  '.klgybbggbbygbk.',
  '.klggybggbyggbk.',
  '.klggggggggggbk.',
  '.klgrggwwggrgbk.',
  '.klggggggggggbk.',
  '.kloooooooooobk.',
  '.klbbbbbbbbbbbk.',
  '..klbbbbbbbbbk..',
  '...klbbbbbbbk...',
  '....klbbbbbk....',
  '.....kkbbkk.....',
  '.......kk.......'];
const S = 16, N = 16 * S, raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; for (let x = 0; x < N; x++) { const ch = A[(y / S) | 0][(x / S) | 0], c = P[ch] || (ch === '.' && false); const o = y * (N * 4 + 1) + 1 + x * 4;
  if (c) { raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255; } } }
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(N, 0); ih.writeUInt32BE(N, 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(new URL('./icon.png', import.meta.url), png); console.log('icon.png', png.length, 'bytes');
