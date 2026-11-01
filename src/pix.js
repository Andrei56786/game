'use strict';
// ===== PIX: pixel-art toolkit — packed-colour buffers, hue-shifted ramps, outlines, procedural textures =====
const HXC = new Map();
function hx(h) { // '#rrggbb[aa]' -> packed little-endian ABGR
  let v = HXC.get(h); if (v !== undefined) return v;
  const n = parseInt(h.slice(1, 7), 16), a = h.length > 7 ? parseInt(h.slice(7, 9), 16) : 255;
  v = ((a << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0; HXC.set(h, v); return v;
}
const cR = c => c & 255, cG = c => (c >>> 8) & 255, cB = c => (c >>> 16) & 255, cA = c => c >>> 24;
const pk = (r, g, b, a) => (((a === undefined ? 255 : a) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
function cmix(a, b, t) { return pk(cR(a) + (cR(b) - cR(a)) * t, cG(a) + (cG(b) - cG(a)) * t, cB(a) + (cB(b) - cB(a)) * t, cA(a) + (cA(b) - cA(a)) * t); }
function cmul(a, k) { return pk(clamp(cR(a) * k, 0, 255), clamp(cG(a) * k, 0, 255), clamp(cB(a) * k, 0, 255), cA(a)); }
function chex(c) { const h = v => ('0' + (v | 0).toString(16)).slice(-2); return '#' + h(cR(c)) + h(cG(c)) + h(cB(c)); }
// integer hash noise
function hsh(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s | 0) * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnz(x, y, sc, s) { const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hsh(ix, iy, s), b = hsh(ix + 1, iy, s), c = hsh(ix, iy + 1, s), d = hsh(ix + 1, iy + 1, s); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }
function fbm(x, y, sc, s) { return vnz(x, y, sc, s) * 0.6 + vnz(x, y, sc / 2, s + 7) * 0.28 + vnz(x, y, sc / 4, s + 13) * 0.12; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
// worley (cellular) noise on a jittered grid: returns [f1, f2, cellId, cellX, cellY]
function worley(x, y, cw, ch, s, jit) {
  jit = jit === undefined ? 0.8 : jit; const gx = Math.floor(x / cw), gy = Math.floor(y / ch); let f1 = 1e9, f2 = 1e9, id = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = gx + i, cy = gy + j; const px0 = (cx + 0.5 + (hsh(cx, cy, s) - 0.5) * jit) * cw, py0 = (cy + 0.5 + (hsh(cx, cy, s + 1) - 0.5) * jit) * ch;
    const d = Math.hypot((x - px0) / cw, (y - py0) / ch); if (d < f1) { f2 = f1; f1 = d; id = (cx * 7919 + cy * 104729) | 0; bx = px0; by = py0; } else if (d < f2) f2 = d; }
  return [f1, f2, id, bx, by];
}
// ---------- ramps (dark -> light, hue-shifted) ----------
const RAMP = {
  skin0: ['#6a3430', '#b0605a', '#e6a084', '#f6c6a2', '#fde2c6'], skin1: ['#62322a', '#a45c46', '#d8926a', '#eab288', '#f6ceaa'],
  skin2: ['#52281e', '#8a4c36', '#ba7850', '#d69868', '#eab684'], skin3: ['#3a1e16', '#683824', '#945a38', '#b2784e', '#ca9868'],
  skin4: ['#28140e', '#48281c', '#6c422e', '#8a5a3e', '#a67658'],
  h_black: ['#100c14', '#221a28', '#382e40', '#544a5c'], h_dkbrown: ['#1c100c', '#382014', '#583620', '#785230'], h_brown: ['#28140c', '#583216', '#805028', '#a6723e'],
  h_auburn: ['#2c100e', '#682816', '#984222', '#c26638'], h_ginger: ['#38140a', '#883812', '#c25e26', '#e68c46'], h_blond: ['#48300e', '#98722e', '#d2a64c', '#eed286'],
  h_gray: ['#2c2830', '#5c5860', '#8c888e', '#bab6ba'], h_white: ['#46424c', '#96929c', '#ceCad0', '#f0eef0'],
  red: ['#2c0c14', '#5c1824', '#8c2830', '#be423c', '#de6e58'], blue: ['#0c1230', '#1c2c5c', '#2c4c92', '#4876c2', '#78a6de'],
  green: ['#0c1e12', '#1c4022', '#2c6832', '#489244', '#7cbe60'], purple: ['#1c0c28', '#3c1c50', '#5c2e7e', '#8250a6', '#aa7aca'],
  gold: ['#382006', '#784e0e', '#b6821c', '#deb23e', '#f6de7e'], brown: ['#1c100a', '#3c2416', '#5c3a22', '#805634', '#a6764a'],
  black: ['#08080e', '#14141c', '#22222c', '#343442', '#4c4c5c'], white: ['#4c4854', '#8c8894', '#c2bec6', '#e4e0e4', '#fffaf4'],
  gray: ['#1c1c24', '#383844', '#585864', '#7c7c88', '#a4a4ae'], teal: ['#082020', '#144242', '#206864', '#389286', '#68beaa'],
  orange: ['#381808', '#78340e', '#b6581c', '#de8234', '#f2ae62'], wine: ['#20060c', '#48101e', '#6e1c2e', '#942e42', '#b64e5e'],
  forest: ['#0a180c', '#18321e', '#284c2c', '#3c683a', '#58884e'], navy: ['#080c20', '#121c3e', '#1c2c5c', '#2c427e', '#4862a2'],
  steel: ['#181a24', '#383c4c', '#5c6274', '#8890a2', '#bec6d2', '#ecf0f4'], gmetal: ['#381e04', '#784c0a', '#b68016', '#e6b62e', '#fae078', '#fff4c6'],
  wood: ['#22120a', '#3c2212', '#5c361e', '#7e4e2a', '#a26a3a', '#c68a52'], dwood: ['#160a06', '#2a140e', '#402018', '#583022', '#744430'],
  stone: ['#1a1822', '#2c2a38', '#434158', '#5e5c72', '#7c7a8e', '#a09eae', '#c6c4d0'], sand: ['#28201a', '#48382a', '#6a5842', '#8c785c', '#ae9a7a', '#cebe9e'],
  grass: ['#14341c', '#204e28', '#2c6c2e', '#469038', '#6ab242', '#96ce56', '#c2e678'], dirt: ['#382012', '#5c381c', '#88582a', '#ae7a3a', '#ce9c52', '#e6be78'],
  water: ['#0c183a', '#142e5c', '#1c4884', '#2864a8', '#3e86c6', '#68aede', '#a6daf2'], rred: ['#280c0c', '#501814', '#7c281c', '#a63c26', '#ca5836', '#e67e4e'],
  slate: ['#10141e', '#1c2434', '#2a364a', '#3c4c64', '#546882', '#788ca4'], thatch: ['#382808', '#684c18', '#987226', '#c29838', '#debc58'],
  leaf: ['#0c2212', '#16361c', '#204e28', '#2c6830', '#44863a', '#64a648', '#8cc458'], pine: ['#08181a', '#102c26', '#184232', '#22583e', '#34724a', '#4c8c58'],
  fire: ['#781c08', '#c23e0c', '#ea7818', '#fab234', '#fee688', '#fffade'], parch: ['#583a1c', '#9e7848', '#d2ae78', '#eacf9e', '#f6e6c2'],
  pink: ['#3a1420', '#6e2a3c', '#a4485a', '#d0707c', '#eea0a4'], ivory: ['#5a5040', '#9a8e74', '#cec2a2', '#eae0c4', '#fcf6e4'],
};
const RPK = {}; for (const k in RAMP) RPK[k] = RAMP[k].map(hx);
function rp(name, i) { const r = RPK[name] || RPK.gray; return r[clamp(i | 0, 0, r.length - 1)]; }
const OUTL = hx('#1a1018'), OUTL2 = hx('#2a1a22'), CLEAR = 0;
// ---------- pixel buffer ----------
function PB(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
PB.prototype.set = function (x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; const a = c >>> 24, i = y * this.w + x; if (a === 255 || !this.d[i]) { this.d[i] = c; return; } const o = this.d[i], t = a / 255; this.d[i] = pk(cR(o) + (cR(c) - cR(o)) * t, cG(o) + (cG(c) - cG(o)) * t, cB(o) + (cB(c) - cB(o)) * t, Math.max(cA(o), a)); };
PB.prototype.get = function (x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[y * this.w + x]; };
PB.prototype.put = function (x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[y * this.w + x] = c; };
PB.prototype.rect = function (x, y, w, h, c) { for (let j = y | 0; j < (y + h) | 0; j++) for (let i = x | 0; i < (x + w) | 0; i++) this.set(i, j, c); return this; };
PB.prototype.hl = function (x, y, w, c) { this.rect(x, y, w, 1, c); }; PB.prototype.vl = function (x, y, h, c) { this.rect(x, y, 1, h, c); };
PB.prototype.ell = function (cx, cy, rx, ry, c, f) { for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx); x++) { const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (d <= 1) { const col = f ? f(x, y, d) : c; if (col) this.set(x, y, col); } } return this; };
PB.prototype.line = function (x0, y0, x1, y1, c) { x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (let k = 0; k < 999; k++) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } return this; };
PB.prototype.poly = function (pts, c, f) { let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) { const yc = y + 0.5, xs = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { const col = f ? f(x, y) : c; if (col) this.set(x, y, col); } } return this; };
PB.prototype.fill = function (x, y, w, h, f) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const c = f(i, j); if (c) this.set(i, j, c); } return this; };
PB.prototype.map = function (f) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const i = y * this.w + x; if (this.d[i]) { const c = f(x, y, this.d[i]); if (c !== undefined) this.d[i] = c; } } return this; };
// outer outline: transparent pixels touching opaque ones (4-neighbourhood); o.diag adds corners; o.skipBottom leaves the base open
PB.prototype.outline = function (c, o) { o = o || {}; const w = this.w, h = this.h, d = this.d, src = d.slice(), op = i => src[i] >>> 24 > 100;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (op(i)) continue; let n = (x > 0 && op(i - 1)) || (x < w - 1 && op(i + 1)) || (y > 0 && op(i - w)) || (!o.skipBottom && y < h - 1 && op(i + w));
    if (!n && o.diag) n = (x > 0 && y > 0 && op(i - w - 1)) || (x < w - 1 && y > 0 && op(i - w + 1)) || (x > 0 && y < h - 1 && op(i + w - 1)) || (x < w - 1 && y < h - 1 && op(i + w + 1)); if (n) d[i] = typeof c === 'function' ? c(x, y) : c; } return this; };
// inner edge darkening: opaque pixels next to transparency get recoloured by f(col)
PB.prototype.rim = function (f, sides) { const w = this.w, h = this.h, d = this.d, src = d.slice(), tr = (x, y) => x < 0 || y < 0 || x >= w || y >= h || (src[y * w + x] >>> 24) < 100; sides = sides || 'lrtb';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (tr(x, y)) continue; if ((sides.includes('l') && tr(x - 1, y)) || (sides.includes('r') && tr(x + 1, y)) || (sides.includes('t') && tr(x, y - 1)) || (sides.includes('b') && tr(x, y + 1))) d[i] = f(src[i], x, y); } return this; };
PB.prototype.blit = function (s, dx, dy, flip) { for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = s.d[y * s.w + (flip ? s.w - 1 - x : x)]; if (c) this.set(dx + x, dy + y, c); } return this; };
PB.prototype.copy = function () { const b = new PB(this.w, this.h); b.d.set(this.d); return b; };
PB.prototype.flipX = function () { const b = new PB(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) b.d[y * this.w + x] = this.d[y * this.w + this.w - 1 - x]; return b; };
PB.prototype.canvas = function () { const [c, g] = mkCanvas(this.w, this.h); const im = g.createImageData(this.w, this.h); new Uint32Array(im.data.buffer).set(this.d); g.putImageData(im, 0, 0); return c; };
// drop shadow ellipse under objects (semi-transparent)
const SHADOW = pk(18, 10, 28, 90), SHADOW2 = pk(18, 10, 28, 55);
function shadowEll(b, cx, cy, rx, ry) { b.ell(cx, cy, rx, ry, 0, (x, y, d) => d < 0.55 ? SHADOW : SHADOW2); }
// shaded box helper (front face + top face), light from upper-left
function shadedBox(b, x, y, w, h, top, ramp, o) { o = o || {}; const r = RPK[ramp];
  b.rect(x, y, w, top, r[o.ti === undefined ? 4 : o.ti]); b.rect(x, y + top, w, h - top, r[o.fi === undefined ? 3 : o.fi]); b.hl(x, y + top, w, r[2]); b.rect(x + w - 1, y + top, 1, h - top, r[2]); b.hl(x, y + h - 1, w, r[1]); b.hl(x, y, w, r[Math.min(r.length - 1, (o.ti === undefined ? 4 : o.ti) + 1)]); return b; }
// cylinder shading across width (light on the left third)
function cylCol(ramp, x, w, base) { const t = (x + 0.5) / w, r = RPK[ramp]; base = base === undefined ? 3 : base; const i = t < 0.18 ? base + 1 : t < 0.55 ? base : t < 0.82 ? base - 1 : base - 2; return r[clamp(i, 0, r.length - 1)]; }
