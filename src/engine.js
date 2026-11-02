'use strict';
// ===== ENGINE: canvas, input, rng, fonts, sprites, ui kit =====
const W = 640, H = 360;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const k = s >= 1 ? Math.floor(s) : s;
  cv.style.width = Math.round(W * k) + 'px'; cv.style.height = Math.round(H * k) + 'px';
}
addEventListener('resize', fit); fit();

// ---------- RNG ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mkRng(seed) {
  let f = mulberry32(seed >>> 0);
  const r = {
    f: () => f(), i: (a, b) => a + Math.floor(f() * (b - a + 1)), pick: a => a[Math.floor(f() * a.length)],
    chance: p => f() < p, range: (a, b) => a + (b - a) * f(), seed: s => { f = mulberry32(s >>> 0); },
    shuffle: a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    wpick: (a, wf) => { let s = 0; for (const x of a) s += wf(x); let k = f() * s; for (const x of a) { k -= wf(x); if (k <= 0) return x; } return a[a.length - 1]; },
  };
  return r;
}
const R = mkRng((Date.now() ^ 0x5bd1e995) >>> 0); // gameplay rng
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
let NOW = 0, DT = 0;

// ---------- input ----------
const input = { mx: -100, my: -100, clicks: [], keys: [], down: {}, held: new Set(), wheel: 0, drag: null, rx: 0, ry: 0 };
function evPos(e) { const r = cv.getBoundingClientRect(); input.mx = Math.floor((e.clientX - r.left) * W / r.width); input.my = Math.floor((e.clientY - r.top) * H / r.height); }
cv.addEventListener('pointermove', e => {
  evPos(e);
  for (const b in input.down) { const d = input.down[b]; if (d && !d.moved && Math.abs(input.mx - d.x) + Math.abs(input.my - d.y) > 4) d.moved = true; }
});
cv.addEventListener('pointerdown', e => {
  evPos(e); cv.focus(); input.down[e.button] = { x: input.mx, y: input.my, moved: false, t: performance.now() };
  try { cv.setPointerCapture(e.pointerId); } catch (_) { }
  if (typeof Snd !== 'undefined') Snd.unlock();
  e.preventDefault();
});
cv.addEventListener('pointerup', e => {
  evPos(e); const d = input.down[e.button]; delete input.down[e.button];
  if (d) input.clicks.push({ x: d.x, y: d.y, ux: input.mx, uy: input.my, b: e.button, drag: d.moved, shift: e.shiftKey });
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerleave', () => { if (!Object.keys(input.down).length) { input.mx = -100; input.my = -100; } });
cv.addEventListener('wheel', e => { input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
addEventListener('keydown', e => {
  if (!input.held.has(e.code)) input.keys.push({ k: e.key, code: e.code, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA' && typeof SCREEN !== 'undefined' && SCREEN === 'battle') e.preventDefault();
  input.held.add(e.code);
  if ([' ', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
});
addEventListener('keyup', e => input.held.delete(e.code));
addEventListener('blur', () => input.held.clear());

// ---------- hit regions (immediate-mode UI) ----------
let HITS = [], LAST = [], HOVER = null;
function hit(x, y, w, h, o) { const r = Object.assign({ x, y, w, h }, o || {}); HITS.push(r); return r; }
function inR(r, px, py) { return px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h; }
function topHit(list, px, py) { for (let i = list.length - 1; i >= 0; i--) if (inR(list[i], px, py)) return list[i]; return null; }
function hov(id) { return !!(HOVER && HOVER.id === id); }
function blocker(tip) { hit(0, 0, W, H, { id: 'blocker', block: true, tip }); }

// ---------- primitives ----------
function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
function px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); }
function hline(x, y, w, c) { rect(x, y, w, 1, c); }
function vline(x, y, h, c) { rect(x, y, 1, h, c); }
function strokeR(x, y, w, h, c) { hline(x, y, w, c); hline(x, y + h - 1, w, c); vline(x, y, h, c); vline(x + w - 1, y, h, c); }
function dim(a) { ctx.fillStyle = 'rgba(10,8,14,' + a + ')'; ctx.fillRect(0, 0, W, H); }
function line(x0, y0, x1, y1, c, dash, off) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, n = off || 0;
  ctx.fillStyle = c;
  for (let g = 0; g < 4000; g++) {
    if (!dash || (n % dash[0] + dash[0]) % dash[0] < dash[1]) ctx.fillRect(x0, y0, 1, 1);
    n++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function disc(cx, cy, r, c) { for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.8)); rect(cx - w, cy + y, w * 2 + 1, 1, c); } }
function ring(cx, cy, r, c) { let x = r, y = 0, e = 0; ctx.fillStyle = c; while (x >= y) { for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) ctx.fillRect(cx + a, cy + b, 1, 1); y++; e += 1 + 2 * y; if (2 * (e - x) + 1 > 0) { x--; e += 1 - 2 * x; } } }

// ---------- palette ----------
const PAL = {
  o: '#1b1420', k: '#0c0a10', w: '#f4ecd8', W: '#ffffff', C: '#e8d5a8', c: '#c9b47a', P: '#d6be8c', B: '#b89a68',
  G: '#d8dde4', g: '#9aa3b0', d: '#5c6470', D: '#3a4048', y: '#f7d35c', Y: '#e0a630', b: '#a8641e',
  r: '#c0353f', R: '#7a1e2a', p: '#ee7a6a', u: '#3b6fd0', U: '#22408a', l: '#a8c8ff', i: '#6a9ae0', I: '#3a62b0',
  v: '#8a46b0', V: '#552a70', h: '#7fb04c', f: '#4f8a3a', e: '#2f5a2a', n: '#6a4224', N: '#a8743e', m: '#945a3c',
  s: '#b8ab98', S: '#7a6c5e', t: '#f0d890', q: '#d0a850', Q: '#9a7030', x: '#5a4440', J: '#ece4cc', K: '#b5aa88',
  z: '#f2c29b', Z: '#c98b6b', a: '#ff9a3c', A: '#ffe07a', j: '#2a1a12', T: '#6a4428', M: '#3c2a20', E: '#bfe8f0',
  F: '#e8b48a', H: '#8a5a3a', L: '#4a3020', O: '#ffd8a0', X: '#2a2430', '1': '#9fe07a', '2': '#ee7a6a', '3': '#7ab0ee',
};
const UIC = { ink: '#2a1a12', ink2: '#6a4a2a', good: '#9fe07a', bad: '#ee7a6a', warn: '#f7d35c', dim: '#9a8a70', title: '#f7d35c', text: '#f4ecd8', parch: '#e8d5a8', parchInk: '#3a2614', blue: '#a8c8ff' };

// ---------- sprites ----------
const SPR = {};
function mkSprite(rows, pal) {
  if (typeof rows === 'string') rows = rows.split('|');
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x]; if (ch === '.' || ch === ' ') continue;
    const col = (pal && pal[ch]) || PAL[ch]; if (!col) continue;
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  return c;
}
function spr(name, x, y, o) {
  const s = typeof name === 'string' ? SPR[name] : name; if (!s) return;
  if (o && o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o && o.scale) ctx.drawImage(s, x | 0, y | 0, s.width * o.scale, s.height * o.scale);
  else if (o && o.flip) { ctx.save(); ctx.translate((x | 0) + s.width, y | 0); ctx.scale(-1, 1); ctx.drawImage(s, 0, 0); ctx.restore(); }
  else ctx.drawImage(s, x | 0, y | 0);
  if (o && o.alpha !== undefined) ctx.globalAlpha = 1;
}
function sprW(n) { return SPR[n] ? SPR[n].width : 0; }
function sprH(n) { return SPR[n] ? SPR[n].height : 0; }
function tinted(name, col) {
  const key = name + '@' + col; if (SPR[key]) return key;
  const s = SPR[name]; const c = document.createElement('canvas'); c.width = s.width; c.height = s.height;
  const g = c.getContext('2d'); g.drawImage(s, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  SPR[key] = c; return key;
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }

// ---------- fonts ----------
// S: small caps (cap 5). M: main (cap 7, x-height 5, descenders 2). Glyph: [top, rows]
const GS = {
  'А': '.##.|#..#|####|#..#|#..#', 'Б': '####|#...|###.|#..#|###.', 'В': '###.|#..#|###.|#..#|###.', 'Г': '###|#..|#..|#..|#..',
  'Д': '.###.|.#.#.|.#.#.|.#.#.|#####|#...#', 'Е': '###|#..|##.|#..|###', 'Ё': '^#.#|###|#..|##.|#..|###',
  'Ж': '#.#.#|#.#.#|.###.|#.#.#|#.#.#', 'З': '###.|...#|.##.|...#|###.', 'И': '#..#|#..#|#.##|##.#|#..#',
  'Й': '^.##.|#..#|#..#|#.##|##.#|#..#', 'К': '#..#|#.#.|##..|#.#.|#..#', 'Л': '.###|.#.#|.#.#|.#.#|#..#',
  'М': '#...#|##.##|#.#.#|#...#|#...#', 'Н': '#..#|#..#|####|#..#|#..#', 'О': '.##.|#..#|#..#|#..#|.##.',
  'П': '####|#..#|#..#|#..#|#..#', 'Р': '###.|#..#|###.|#...|#...', 'С': '.###|#...|#...|#...|.###',
  'Т': '###|.#.|.#.|.#.|.#.', 'У': '#..#|#..#|.###|...#|###.', 'Ф': '.###.|#.#.#|#.#.#|.###.|..#..',
  'Х': '#.#|#.#|.#.|#.#|#.#', 'Ц': '#.#.|#.#.|#.#.|#.#.|####|...#', 'Ч': '#..#|#..#|.###|...#|...#',
  'Ш': '#.#.#|#.#.#|#.#.#|#.#.#|#####', 'Щ': '#.#.#|#.#.#|#.#.#|#.#.#|#####|....#', 'Ъ': '##..|.#..|.##.|.#.#|.##.',
  'Ы': '#...#|#...#|##..#|#.#.#|##..#', 'Ь': '#..|#..|##.|#.#|##.', 'Э': '###.|...#|.###|...#|###.',
  'Ю': '#..#.|#.#.#|###.#|#.#.#|#..#.', 'Я': '.###|#..#|.###|.#.#|#..#',
  '0': '###|#.#|#.#|#.#|###', '1': '.#.|##.|.#.|.#.|###', '2': '###|..#|###|#..|###', '3': '###|..#|.##|..#|###',
  '4': '#.#|#.#|###|..#|..#', '5': '###|#..|###|..#|###', '6': '###|#..|###|#.#|###', '7': '###|..#|..#|.#.|.#.',
  '8': '###|#.#|###|#.#|###', '9': '###|#.#|###|..#|###',
  '.': '.|.|.|.|#', '…': '.....|.....|.....|.....|#.#.#', ',': '.|.|.|.|#|#', ':': '.|#|.|#|.', ';': '.|#|.|.|#|#', '!': '#|#|#|.|#', '?': '###|..#|.##|...|.#.',
  '-': '..|..|##|..|..', '+': '...|.#.|###|.#.|...', '±': '.#.|###|.#.|...|###', '/': '..#|..#|.#.|#..|#..', '(': '.#|#.|#.|#.|.#', ')': '#.|.#|.#|.#|#.',
  '%': '#.#|..#|.#.|#..|#.#', '"': '#.#|#.#|...|...|...', '×': '...|#.#|.#.|#.#|...', '→': '....|..#.|####|..#.|....',
  '←': '....|.#..|####|.#..|....', '·': '.|.|#|.|.', '—': '...|...|###|...|...', '=': '...|###|...|###|...', "'": '#|#|.|.|.',
  '>': '#..|.#.|..#|.#.|#..', '<': '..#|.#.|#..|.#.|..#', '~': '....|.#.#|#.#.|....|....', '«': '...|.##|##.|.##|...', '»': '...|##.|.##|##.|...',
  // latin letters without a cyrillic look-alike (Shift, Tab, Esc, F1…)
  'D': '##.|#.#|#.#|#.#|##.', 'F': '###|#..|##.|#..|#..', 'G': '###|#..|#.#|#.#|###', 'I': '###|.#.|.#.|.#.|###', 'J': '..#|..#|..#|#.#|###', 'L': '#..|#..|#..|#..|###',
  'N': '#..#|##.#|#.##|#..#|#..#', 'Q': '###|#.#|#.#|###|..#', 'R': '##.|#.#|##.|#.#|#.#', 'S': '.##|#..|.#.|..#|##.', 'U': '#.#|#.#|#.#|#.#|###', 'V': '#.#|#.#|#.#|#.#|.#.',
  'W': '#...#|#...#|#.#.#|#.#.#|.#.#.', 'Z': '###|..#|.#.|#..|###',
};
const GM = {
  // uppercase (rows 0..6)
  'А': [0, '.###.|#...#|#...#|#####|#...#|#...#|#...#'], 'Б': [0, '#####|#....|#....|####.|#...#|#...#|####.'],
  'В': [0, '####.|#...#|#...#|####.|#...#|#...#|####.'], 'Г': [0, '#####|#....|#....|#....|#....|#....|#....'],
  'Д': [0, '.####.|.#..#.|.#..#.|.#..#.|.#..#.|.#..#.|######|#....#'], 'Е': [0, '#####|#....|#....|####.|#....|#....|#####'],
  'Ё': [-2, '.#.#.|.....|#####|#....|#....|####.|#....|#....|#####'],
  'Ж': [0, '#..#..#|#..#..#|.#.#.#.|..###..|.#.#.#.|#..#..#|#..#..#'], 'З': [0, '.###.|#...#|....#|..##.|....#|#...#|.###.'],
  'И': [0, '#...#|#...#|#..##|#.#.#|##..#|#...#|#...#'], 'Й': [-2, '#...#|.###.|#...#|#...#|#..##|#.#.#|##..#|#...#|#...#'],
  'К': [0, '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#'], 'Л': [0, '..###|.#..#|.#..#|.#..#|.#..#|.#..#|#...#'],
  'М': [0, '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#'], 'Н': [0, '#...#|#...#|#...#|#####|#...#|#...#|#...#'],
  'О': [0, '.###.|#...#|#...#|#...#|#...#|#...#|.###.'], 'П': [0, '#####|#...#|#...#|#...#|#...#|#...#|#...#'],
  'Р': [0, '####.|#...#|#...#|####.|#....|#....|#....'], 'С': [0, '.###.|#...#|#....|#....|#....|#...#|.###.'],
  'Т': [0, '#####|..#..|..#..|..#..|..#..|..#..|..#..'], 'У': [0, '#...#|#...#|#...#|.####|....#|#...#|.###.'],
  'Ф': [0, '..#..|.###.|#.#.#|#.#.#|#.#.#|.###.|..#..'], 'Х': [0, '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#'],
  'Ц': [0, '#..#.|#..#.|#..#.|#..#.|#..#.|#..#.|#####|....#'], 'Ч': [0, '#...#|#...#|#...#|.####|....#|....#|....#'],
  'Ш': [0, '#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#####'], 'Щ': [0, '#.#.#.|#.#.#.|#.#.#.|#.#.#.|#.#.#.|#.#.#.|######|.....#'],
  'Ъ': [0, '##...|.#...|.#...|.###.|.#..#|.#..#|.###.'], 'Ы': [0, '#....#|#....#|#....#|###..#|#..#.#|#..#.#|###..#'],
  'Ь': [0, '#....|#....|#....|####.|#...#|#...#|####.'], 'Э': [0, '.###.|#...#|....#|..###|....#|#...#|.###.'],
  'Ю': [0, '#..##.|#.#..#|#.#..#|###..#|#.#..#|#.#..#|#..##.'], 'Я': [0, '.####|#...#|#...#|.####|..#.#|.#..#|#...#'],
  // lowercase (x-height rows 2..6)
  'а': [2, '.###.|....#|.####|#...#|.####'], 'б': [0, '.####|#....|####.|#...#|#...#|#...#|.###.'],
  'в': [2, '####.|#...#|####.|#...#|####.'], 'г': [2, '####|#...|#...|#...|#...'],
  'д': [2, '.###.|.#.#.|.#.#.|.#.#.|#####|#...#'], 'е': [2, '.###.|#...#|#####|#....|.###.'],
  'ё': [0, '.#.#.|.....|.###.|#...#|#####|#....|.###.'], 'ж': [2, '#.#.#|#.#.#|.###.|#.#.#|#.#.#'],
  'з': [2, '####.|....#|.###.|....#|####.'], 'и': [2, '#...#|#..##|#.#.#|##..#|#...#'],
  'й': [0, '.###.|.....|#...#|#..##|#.#.#|##..#|#...#'], 'к': [2, '#..#|#.#.|##..|#.#.|#..#'],
  'л': [2, '..###|.#..#|.#..#|.#..#|#...#'], 'м': [2, '#...#|##.##|#.#.#|#...#|#...#'],
  'н': [2, '#...#|#...#|#####|#...#|#...#'], 'о': [2, '.###.|#...#|#...#|#...#|.###.'],
  'п': [2, '#####|#...#|#...#|#...#|#...#'], 'р': [2, '####.|#...#|#...#|#...#|####.|#....|#....'],
  'с': [2, '.####|#....|#....|#....|.####'], 'т': [2, '#####|..#..|..#..|..#..|..#..'],
  'у': [2, '#...#|#...#|#...#|#...#|.####|....#|.###.'], 'ф': [0, '..#..|..#..|.###.|#.#.#|#.#.#|#.#.#|.###.|..#..|..#..'],
  'х': [2, '#...#|.#.#.|..#..|.#.#.|#...#'], 'ц': [2, '#..#.|#..#.|#..#.|#..#.|#####|....#'],
  'ч': [2, '#...#|#...#|.####|....#|....#'], 'ш': [2, '#.#.#|#.#.#|#.#.#|#.#.#|#####'],
  'щ': [2, '#.#.#.|#.#.#.|#.#.#.|#.#.#.|######|.....#'], 'ъ': [2, '##...|.#...|.###.|.#..#|.###.'],
  'ы': [2, '#....#|#....#|###..#|#..#.#|###..#'], 'ь': [2, '#...|#...|###.|#..#|###.'],
  'э': [2, '####.|....#|..###|....#|####.'], 'ю': [2, '#..##.|#.#..#|###..#|#.#..#|#..##.'], 'я': [2, '.####|#...#|.####|.#..#|#...#'],
  // latin (only those that differ)
  'D': [0, '####.|#...#|#...#|#...#|#...#|#...#|####.'], 'F': [0, '#####|#....|#....|####.|#....|#....|#....'],
  'G': [0, '.###.|#...#|#....|#.###|#...#|#...#|.###.'], 'I': [0, '###|.#.|.#.|.#.|.#.|.#.|###'], 'L': [0, '#....|#....|#....|#....|#....|#....|#####'],
  'N': [0, '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#'], 'Q': [0, '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#'], 'R': [0, '####.|#...#|#...#|####.|#.#..|#..#.|#...#'],
  'S': [0, '.####|#....|#....|.###.|....#|....#|####.'], 'U': [0, '#...#|#...#|#...#|#...#|#...#|#...#|.###.'], 'V': [0, '#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..'],
  'W': [0, '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#'], 'Z': [0, '#####|....#|...#.|..#..|.#...|#....|#####'], 'J': [0, '..###|...#.|...#.|...#.|...#.|#..#.|.##..'],
  // digits
  '0': [0, '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.'], '1': [0, '..#..|.##..|..#..|..#..|..#..|..#..|.###.'],
  '2': [0, '.###.|#...#|....#|...#.|..#..|.#...|#####'], '3': [0, '.###.|#...#|....#|..##.|....#|#...#|.###.'],
  '4': [0, '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.'], '5': [0, '#####|#....|####.|....#|....#|#...#|.###.'],
  '6': [0, '.###.|#....|#....|####.|#...#|#...#|.###.'], '7': [0, '#####|....#|...#.|..#..|..#..|..#..|..#..'],
  '8': [0, '.###.|#...#|#...#|.###.|#...#|#...#|.###.'], '9': [0, '.###.|#...#|#...#|.####|....#|....#|.###.'],
  // punctuation
  '.': [6, '#'], ',': [6, '#|#'], ':': [2, '#|.|.|.|#'], ';': [2, '#|.|.|.|#|#'], '!': [0, '#|#|#|#|#|.|#'],
  '?': [0, '.###.|#...#|....#|...#.|..#..|.....|..#..'], '-': [4, '####'], '+': [2, '..#..|..#..|#####|..#..|..#..'], '±': [2, '..#..|#####|..#..|.....|#####'],
  '/': [0, '....#|...#.|...#.|..#..|.#...|.#...|#....'], '(': [0, '.#|#.|#.|#.|#.|#.|.#'], ')': [0, '#.|.#|.#|.#|.#|.#|#.'],
  '%': [0, '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##'], '"': [0, '#.#|#.#'], "'": [0, '#|#'], '«': [2, '..#.#|.#.#.|#.#..|.#.#.|..#.#'],
  '»': [2, '#.#..|.#.#.|..#.#|.#.#.|#.#..'], '—': [4, '######'], '–': [4, '####'], '·': [4, '#'], '×': [2, '#...#|.#.#.|..#..|.#.#.|#...#'],
  '=': [3, '####|....|####'], '<': [1, '...#|..#.|.#..|#...|.#..|..#.|...#'], '>': [1, '#...|.#..|..#.|...#|..#.|.#..|#...'],
  '*': [1, '#.#.#|.###.|#.#.#'], '→': [2, '..#..|...#.|#####|...#.|..#..'], '←': [2, '..#..|.#...|#####|.#...|..#..'],
  '↑': [0, '..#..|.###.|#.#.#|..#..|..#..|..#..|..#..'], '↓': [0, '..#..|..#..|..#..|..#..|#.#.#|.###.|..#..'],
  '…': [6, '#.#.#'], '▶': [1, '#..|##.|###|##.|#..'], '▼': [2, '#####|.###.|..#..'], '■': [2, '###|###|###'], '♥': [1, '.#.#.|#####|#####|.###.|..#..'], '[': [0, '##|#.|#.|#.|#.|#.|##'], ']': [0, '##|.#|.#|.#|.#|.#|##'], '№': [0, '#..#....|##.#....|#.##.##.|#..##..#|#..##..#|#..#.##.|#..#....'],
  '#': [1, '.#.#.|#####|.#.#.|#####|.#.#.'], '&': [0, '.##..|#..#.|.##..|.#...|#.#.#|#..#.|.##.#'], '~': [3, '.#..#|#.##.'], '°': [0, '.#.|#.#|.#.'],
};
const LAT = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', n: 'п', i: 'I', l: 'I', s: 'S', d: 'D', r: 'г', t: 'т', u: 'и', v: 'V', w: 'W', z: 'Z', b: 'б', f: 'F', g: 'G', h: 'н', j: 'J', q: 'Q', '−': '-', '±': '+', '✓': '+', '✗': '×', '≈': '~', '✉': '·', '✝': '+', '∞': '~', '•': '·', '–': '-', '▶': '>', "'": '"', '’': '"', '‘': '"' };
function buildFont(def, cap) {
  const F = { map: {}, atlas: {}, width: 0, cap };
  let x = 0;
  for (const ch in def) {
    let top, s;
    if (Array.isArray(def[ch])) { top = def[ch][0]; s = def[ch][1]; } else { s = def[ch]; top = 0; if (s[0] === '^') { top = -1; s = s.slice(1); } }
    const rows = s.split('|'); const w = Math.max(...rows.map(r => r.length));
    F.map[ch] = { rows, w, top, x };
    x += w + 1;
  }
  F.width = x; F.hgt = cap + 5;
  return F;
}
const FONTS = { s: buildFont(GS, 5), m: buildFont(GM, 7) };
function fontAtlas(F, col) {
  if (F.atlas[col]) return F.atlas[col];
  const [c, g] = mkCanvas(F.width, F.hgt); g.fillStyle = col;
  for (const ch in F.map) { const m = F.map[ch]; m.rows.forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') g.fillRect(m.x + i, y + m.top + 2, 1, 1); }); }
  F.atlas[col] = c; return c;
}
function glyph(F, ch) {
  if (F === FONTS.s) { ch = ch.toUpperCase(); if (F.map[ch]) return F.map[ch]; if (LAT[ch]) return F.map[LAT[ch]]; return null; }
  if (F.map[ch]) return F.map[ch]; if (LAT[ch] && F.map[LAT[ch]]) return F.map[LAT[ch]];
  const u = ch.toUpperCase(); if (F.map[u]) return F.map[u]; if (LAT[u] && F.map[LAT[u]]) return F.map[LAT[u]];
  return null;
}
function tw(s, o) {
  const F = FONTS[(o && o.f) || 'm'], sc = (o && o.sc) || 1, sp = F === FONTS.m ? 4 : 3; let w = 0;
  for (const ch of String(s)) { if (ch === ' ') { w += sp; continue; } const g = glyph(F, ch); w += g ? g.w + 1 : 4; }
  return Math.max(0, w - 1) * sc;
}
// draw text. y = top of cap height. o: {f:'s'|'m', sh: shadow col, al:'c'|'r', sc}
function txt(s, x, y, col, o) {
  s = String(s); o = o || {}; const F = FONTS[o.f || 'm'], sc = o.sc || 1, sp = F === FONTS.m ? 4 : 3; col = col || PAL.w;
  if (o.al === 'c') x -= Math.floor(tw(s, o) / 2); else if (o.al === 'r') x -= tw(s, o);
  x |= 0; y |= 0;
  if (o.sh) { txt(s, x, y + sc, o.sh, { f: o.f, sc }); if (o.ol) { txt(s, x + sc, y, o.sh, { f: o.f, sc }); txt(s, x - sc, y, o.sh, { f: o.f, sc }); txt(s, x, y - sc, o.sh, { f: o.f, sc }); } }
  const at = fontAtlas(F, col);
  for (const ch of s) {
    if (ch === ' ') { x += sp * sc; continue; }
    const g = glyph(F, ch);
    if (!g) { x += 4 * sc; continue; }
    ctx.drawImage(at, g.x, 0, g.w, F.hgt, x, y - 2 * sc, g.w * sc, F.hgt * sc);
    x += (g.w + 1) * sc;
  }
  return x;
}
function wrap(s, maxW, o) {
  const out = [];
  for (const para of String(s).split('\n')) {
    const words = para.split(' '); let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (tw(t, o) > maxW && cur) { out.push(cur); cur = wd; } else cur = t; }
    out.push(cur);
  }
  return out;
}
// rich paragraph: returns height. lines of {t,c}
function para(s, x, y, maxW, col, o) { const lines = wrap(s, maxW, o); const lh = (o && o.lh) || 10; lines.forEach((l, i) => txt(l, x, y + i * lh, col, o)); return lines.length * lh; }

// ---------- number formatting ----------
const fmt = n => { n = Math.round(n); return Math.abs(n) >= 10000 ? (n / 1000).toFixed(0) + 'к' : String(n); };
const fmtS = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
function plural(n, a, b, c) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }

// ---------- panels ----------
function panelWood(x, y, w, h) {
  rect(x, y, w, h, PAL.o); rect(x + 1, y + 1, w - 2, h - 2, '#7a5030'); rect(x + 2, y + 2, w - 4, h - 4, '#4a3020');
  rect(x + 3, y + 3, w - 6, h - 6, '#241610'); hline(x + 3, y + 3, w - 6, '#3a2618');
  for (const [cx, cy] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) { rect(cx, cy, 2, 2, '#c9a060'); px(cx, cy, '#f0d890'); }
}
function panelParch(x, y, w, h) {
  rect(x + 1, y, w - 2, h, PAL.k); rect(x, y + 1, w, h - 2, PAL.k);
  rect(x + 1, y + 1, w - 2, h - 2, PAL.B); rect(x + 2, y + 2, w - 4, h - 4, PAL.C);
  hline(x + 2, y + h - 3, w - 4, PAL.P); vline(x + w - 3, y + 2, h - 4, PAL.P);
  // subtle fibres
  for (let i = 0; i < (w * h) / 900; i++) { const fx = x + 4 + ((i * 73) % Math.max(1, w - 10)), fy = y + 4 + ((i * 131) % Math.max(1, h - 10)); hline(fx, fy, 3, '#dcc596'); }
}
function panelDark(x, y, w, h, hl) { rect(x, y, w, h, PAL.o); rect(x + 1, y + 1, w - 2, h - 2, hl ? '#3a2a22' : '#22170f'); }
function glass(x, y, w, h, a) { ctx.fillStyle = 'rgba(16,11,14,' + (a || 0.78) + ')'; ctx.fillRect(x, y, w, h); }
// button. returns hovered. o: {label, ic, disabled, onClick, tip, style:'wood'|'parch'|'dark', active, sfx}
function btn(id, x, y, w, h, o) {
  o = o || {};
  const dis = !!o.disabled; const hv = hov(id) && !dis; const st = o.style || 'wood';
  if (st === 'wood') {
    rect(x, y, w, h, PAL.o);
    rect(x + 1, y + 1, w - 2, h - 2, dis ? '#3a2e28' : o.active ? '#b07a3c' : hv ? '#8a5a34' : PAL.T);
    hline(x + 1, y + 1, w - 2, dis ? '#4a3c34' : hv ? '#b07a4a' : '#8a5a38'); hline(x + 1, y + h - 2, w - 2, dis ? '#2a201c' : '#3c2a20');
  } else if (st === 'parch') {
    rect(x, y, w, h, PAL.B); rect(x + 1, y + 1, w - 2, h - 2, dis ? '#cdbb94' : o.active ? '#f7e3a0' : hv ? '#f8eccc' : PAL.w); hline(x + 1, y + h - 2, w - 2, PAL.P);
  } else {
    rect(x, y, w, h, PAL.o); rect(x + 1, y + 1, w - 2, h - 2, dis ? '#1d1612' : o.active ? '#5a4030' : hv ? '#4a3428' : '#2c2018');
  }
  const tc = st === 'parch' ? (dis ? '#9a8a70' : UIC.ink) : (dis ? '#7a6a5a' : hv || o.active ? '#fff2c8' : PAL.w);
  let cx = x + (w >> 1);
  if (o.ic && o.label) {
    const iw = sprW(o.ic), tot = iw + 3 + tw(o.label);
    spr(o.ic, cx - (tot >> 1), y + ((h - sprH(o.ic)) >> 1), { alpha: dis ? 0.45 : 1 });
    txt(o.label, cx - (tot >> 1) + iw + 3, y + ((h - 7) >> 1), tc, st === 'parch' ? {} : { sh: PAL.o });
  } else if (o.ic) spr(o.ic, cx - (sprW(o.ic) >> 1), y + ((h - sprH(o.ic)) >> 1) - (hv ? 1 : 0), { alpha: dis ? 0.45 : 1 });
  else if (o.label) txt(o.label, cx, y + ((h - 7) >> 1), tc, st === 'parch' ? { al: 'c' } : { al: 'c', sh: PAL.o });
  hit(x, y, w, h, { id, onClick: dis ? (o.onDis || null) : o.onClick, tip: o.tip, cursor: !dis, sfx: o.sfx });
  return hv;
}
// tooltip box (lines: strings or {t,c,ic})
function drawTipBox(lines, mx, my) {
  if (!lines) return; if (typeof lines === 'string') lines = [lines];
  const rows = []; for (const l of lines) { if (!l) continue; const o = typeof l === 'string' ? { t: l } : l; for (const w of wrap(o.t, 220)) rows.push({ t: w, c: o.c, ic: rows.length && o.ic ? null : o.ic }); }
  if (!rows.length) return;
  const w = Math.max(...rows.map(r => tw(r.t) + (r.ic ? sprW(r.ic) + 3 : 0))) + 10, h = rows.length * 10 + 6;
  let x = mx + 10, y = my + 12; if (x + w > W - 2) x = mx - w - 6; if (y + h > H - 2) y = my - h - 6; x = Math.max(2, x); y = Math.max(2, y);
  rect(x, y, w, h, PAL.o); rect(x + 1, y + 1, w - 2, h - 2, '#20160f'); hline(x + 1, y + 1, w - 2, '#3a2a1c');
  rows.forEach((r, i) => { let tx = x + 5; if (r.ic) { spr(r.ic, tx, y + 4 + i * 10); tx += sprW(r.ic) + 3; } txt(r.t, tx, y + 5 + i * 10, r.c || (i === 0 ? PAL.y : PAL.w)); });
}
// bar
function bar(x, y, w, h, v, col, bg) { rect(x, y, w, h, PAL.o); rect(x + 1, y + 1, w - 2, h - 2, bg || '#2a1d16'); rect(x + 1, y + 1, Math.round((w - 2) * clamp(v, 0, 1)), h - 2, col); }
