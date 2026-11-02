'use strict';
// ===== ART 2 (v3.3): sprites for the bigger castle, hunting grounds, villages & taverns; game animals & livestock; extra looks =====
const DK = hx('#120a10'), DK2 = hx('#1c1216');
// ---------- castle interiors ----------
// stairs down: a stairwell in the floor, nine shallow steps sinking into the dark (same stone and runner as the flight below)
OBJP.stairdn = function () { const b = new PB(32, 30), S = RPK.stone, R0 = RPK.red, Gd = RPK.gmetal;
  b.rect(0, 0, 32, 30, S[3]); b.hl(0, 0, 32, S[5]); b.vl(0, 0, 30, S[4]); b.vl(31, 0, 30, S[2]); b.hl(0, 29, 32, S[2]);
  const n = 9; for (let k = 0; k < n; k++) { const y = 27 - k * 3, d = k / (n - 1); // k = 0 at the bottom edge (nearest, highest), sinking toward the top
    for (let yy = y - 2; yy <= y; yy++) for (let x = 3; x < 29; x++) { const run = x >= 10 && x <= 21, edge = yy === y - 2;
      const c = run ? cmix(R0[edge ? 4 : 3], DK, d * 0.85) : cmix(S[edge ? 5 : 4], DK, d * 0.85); b.set(x, yy, c); }
    b.hl(10, y, 12, cmix(Gd[3], DK, d * 0.8)); }
  b.rect(3, 0, 26, 2, DK); for (let y = 2; y < 29; y++) { b.set(2, y, S[1]); b.set(29, y, S[1]); }
  b.outline(OUTL); return b; };
// the way down to the dungeon: a stone stairwell with an arched doorway, a raised portcullis and two torches (f = flicker frame)
OBJP.cellar = function (o, f) { const b = new PB(64, 54), S = RPK.stone, M = RPK.steel, SL = RPK.slate, W0 = RPK.wood, F = RPK.fire;
  b.rect(6, 2, 52, 10, SL[3]); b.hl(6, 2, 52, SL[5]); b.hl(6, 3, 52, SL[4]);
  for (let y = 5; y < 12; y += 2) { b.hl(6, y, 52, SL[2]); for (let x = 6 + (y & 2 ? 0 : 3); x < 58; x += 6) b.set(x, y + 1, SL[2]); }
  b.hl(6, 12, 52, SL[1]);
  b.fill(8, 13, 48, 26, (x, y) => { const r = (y - 13) / 5 | 0, j = (y - 13) % 5, sx = (x - 8 + (r & 1) * 4) % 8; return j === 4 || sx === 0 ? S[2] : j === 0 ? S[4] : hsh(x >> 3, r, 7) < 0.3 ? S[4] : S[3]; });
  b.ell(32, 25, 14, 11, S[5]); b.rect(18, 25, 28, 14, S[5]); for (let k = -3; k <= 3; k++) { const a = Math.PI / 2 + k * 0.42; b.line(32 + Math.cos(a) * 10, 25 - Math.sin(a) * 8, 32 + Math.cos(a) * 14, 25 - Math.sin(a) * 11, S[3]); }
  b.vl(18, 25, 14, S[4]); b.vl(45, 25, 14, S[3]); b.rect(29, 13, 6, 4, S[6]); b.hl(29, 16, 6, S[4]);
  b.ell(32, 25, 10.5, 8.5, DK); b.rect(22, 25, 21, 14, DK);
  for (let y = 27; y < 39; y += 3) b.hl(23, y, 19, y < 30 ? DK2 : S[y < 34 ? 0 : 1]);
  for (let x = 23; x < 43; x += 3) for (let y = 17; y < 27; y++) if (b.get(x, y) === DK || b.get(x, y) === DK2) b.set(x, y, y === 26 ? M[4] : M[2]);
  b.hl(22, 21, 21, M[1]); b.hl(22, 22, 21, M[3]); for (let x = 23; x < 43; x += 3) b.set(x, 27, M[3]);
  for (const tx of [12, 51]) { b.rect(tx - 1, 27, 3, 2, M[1]); b.set(tx - 2, 27, M[2]); b.set(tx + 2, 27, M[2]); b.rect(tx, 21, 1, 7, W0[3]); b.set(tx, 21, W0[1]);
    const fl = (f || 0) ^ (tx > 32 ? 1 : 0), h = fl ? 6 : 7; b.ell(tx + 0.5, 20, 2.2, h / 2 + 0.5, F[1]); b.ell(tx + 0.5 + (fl ? 0.6 : -0.4), 19.6, 1.4, h / 2 - 0.6, F[3]); b.set(tx, 20, F[5]); b.set(tx + (fl ? 1 : 0), 20 - h + 2, F[2]); }
  for (const [y, k] of [[39, 1], [42, 2], [46, 3], [50, 4]]) { b.rect(16, y, 32, 54 - y, S[k]); b.hl(16, y, 32, S[Math.max(0, k - 2)]); b.hl(16, y + 1, 32, S[k - 1]); }
  b.rect(16, 39, 2, 15, S[0]); b.hl(16, 53, 32, S[5]);
  for (const [x0, w] of [[2, 14], [48, 14]]) { b.rect(x0, 32, w, 15, S[4]); b.hl(x0, 32, w, S[6]); b.hl(x0, 39, w, S[3]); b.vl(x0 + 7, 32, 7, S[3]); b.vl(x0 + 3, 40, 7, S[3]);
    b.rect(x0, 47, w, 7, S[3]); b.hl(x0, 47, w, S[2]); for (let x = x0 + 4; x < x0 + w; x += 6) b.vl(x, 48, 6, S[2]); }
  b.outline(OUTL); return b; };
OBJP.bars = function (o) { const n = o.n || 1, w = n * 16, b = new PB(w, 34), M = RPK.steel, S = RPK.stone; b.rect(0, 0, w, 4, S[4]); b.hl(0, 0, w, S[6]); b.rect(0, 30, w, 4, S[2]); b.hl(0, 30, w, S[3]);
  for (let x = 2; x < w - 1; x += 4) { b.vl(x, 4, 26, M[1]); b.vl(x + 1, 4, 26, M[3]); b.set(x + 1, 5, M[5]); } b.hl(0, 11, w, M[2]); b.hl(0, 12, w, M[4]); b.hl(0, 23, w, M[2]); b.hl(0, 24, w, M[4]);
  if (o.door) { const dx = (w >> 1) - 2; b.rect(dx, 15, 5, 5, RPK.gmetal[2]); b.set(dx + 2, 17, DK); } b.outline(OUTL); return b; };
OBJP.straw = function (o) { const b = new PB(22, 10), T = RPK.thatch; for (let k = 0; k < 70; k++) { const x = 1 + ((hsh(k, 3, o.seed || 1) * 20) | 0), y = 2 + ((hsh(k, 5, o.seed || 1) * 7) | 0); b.set(x, y, T[1 + (k % 4)]); b.set(x + 1, y - (k & 1), T[2 + (k % 3)]); } return b; };
OBJP.chains = function () { const b = new PB(12, 22), M = RPK.steel; b.rect(2, 0, 8, 3, M[2]); for (let y = 3; y < 15; y += 3) { b.set(3, y, M[4]); b.set(3, y + 1, M[2]); b.set(8, y + 1, M[4]); b.set(8, y + 2, M[2]); } b.ell(3.5, 17, 2.5, 2, 0, (x, y, d) => d > 0.4 ? M[3] : null); b.ell(8.5, 18, 2.5, 2, 0, (x, y, d) => d > 0.4 ? M[3] : null); b.outline(OUTL); return b; };
OBJP.jtable = function (o) { const b = new PB(32, 24), W0 = RPK.wood; b.rect(0, 5, 32, 8, W0[3]); b.hl(0, 5, 32, W0[4]); b.rect(0, 13, 32, 3, W0[1]); b.rect(2, 16, 3, 7, W0[1]); b.rect(27, 16, 3, 7, W0[1]);
  if (o && o.mugs) { for (const mx of [4, 23]) { b.rect(mx, 3, 4, 6, RPK.wood[1]); b.rect(mx + 1, 4, 2, 4, RPK.wood[2]); b.hl(mx, 3, 4, RPK.ivory[4]); b.set(mx + 4, 5, RPK.wood[1]); b.set(mx + 4, 6, RPK.wood[1]); }
    b.ell(15, 8, 4, 2.5, 0, (x, y) => RPK.dirt[y < 8 ? 4 : 3]); b.hl(13, 6, 4, RPK.dirt[5]); b.set(15, 8, RPK.dirt[2]); }
  else { b.ell(8, 8, 3, 2, 0, (x, y, d) => d > 0.5 ? RPK.gmetal[3] : null); b.set(11, 9, RPK.gmetal[4]); b.set(12, 10, RPK.gmetal[3]); b.rect(18, 2, 5, 7, RPK.dirt[2]); b.hl(18, 2, 5, RPK.dirt[4]); b.rect(26, 1, 2, 5, RPK.ivory[4]); b.set(26, 0, RPK.fire[4]); }
  b.outline(OUTL); return b; };
OBJP.stool = function () { const b = new PB(12, 12), W0 = RPK.wood; b.ell(6, 4, 5, 2.5, 0, (x, y) => W0[y < 4 ? 4 : 3]); b.rect(2, 6, 2, 5, W0[1]); b.rect(8, 6, 2, 5, W0[1]); b.outline(OUTL); return b; };
OBJP.altar = function () { const b = new PB(48, 38), S = RPK.stone, G0 = RPK.gmetal, I = RPK.ivory;
  b.vl(24, 2, 14, G0[2]); b.ell(24, 6, 6, 6, 0, (x, y, d) => d > 0.7 ? G0[4] : d > 0.4 ? G0[3] : G0[5]); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; b.set(24 + Math.round(Math.cos(a) * 8), 6 + Math.round(Math.sin(a) * 8), G0[4]); }
  b.rect(4, 18, 40, 18, S[3]); b.hl(4, 18, 40, S[5]); for (let x = 8; x < 44; x += 9) b.vl(x, 22, 13, S[2]);
  b.rect(3, 16, 42, 6, I[4]); b.hl(3, 16, 42, I[4]); b.rect(18, 16, 12, 16, RPK.wine[2]); b.vl(18, 16, 16, RPK.wine[3]); b.rect(21, 22, 6, 6, G0[3]); b.set(23, 24, G0[5]);
  for (const cx of [8, 39]) { b.rect(cx, 9, 2, 7, I[4]); b.set(cx, 8, RPK.fire[4]); b.set(cx, 7, RPK.fire[5]); b.rect(cx - 1, 15, 4, 1, G0[3]); } b.outline(OUTL); return b; };
OBJP.pew = function (o) { const w = (o.n || 3) * 16, b = new PB(w, 22), W0 = RPK.dwood; b.rect(1, 4, w - 2, 5, W0[3]); b.hl(1, 4, w - 2, W0[4]); b.rect(0, 10, w, 8, W0[2]); b.hl(0, 10, w, W0[4]); for (let x = 6; x < w - 4; x += 10) b.vl(x, 11, 6, W0[1]);
  b.rect(1, 18, 3, 3, W0[1]); b.rect(w - 4, 18, 3, 3, W0[1]); b.outline(OUTL); return b; };
OBJP.stainwin = function (o, f) { const b = new PB(16, 30), S = RPK.stone, cols = [RPK.red[3], RPK.blue[3], RPK.gold[4], RPK.green[3], RPK.purple[3]]; b.rect(2, 3, 12, 24, S[2]); b.ell(8, 7, 6, 5, 0, () => S[2]);
  for (let y = 4; y < 26; y++) for (let x = 4; x < 12; x++) { if (y < 9 && (x + 0.5 - 8) ** 2 / 16 + (y + 0.5 - 9) ** 2 / 16 > 1) continue; const lead = x === 8 || y % 6 === 0; const ci = ((x >> 1) + (y >> 2) * 3) % 5; b.set(x, y, lead ? hx('#2a1a22') : o.night ? cmul(cols[ci], 0.5) : cols[ci]); }
  b.rect(1, 26, 14, 3, S[4]); b.hl(1, 26, 14, S[5]); b.outline(OUTL); return b; };
OBJP.font = function () { const b = new PB(22, 24), S = RPK.stone; b.rect(8, 12, 6, 9, S[3]); b.vl(8, 12, 9, S[5]); b.rect(5, 20, 12, 3, S[2]); b.ell(11, 9, 9, 5, 0, (x, y) => S[x < 9 ? 5 : 3]); b.ell(11, 8, 6, 3, 0, (x, y) => RPK.water[(x + y) % 3 + 3]); b.outline(OUTL); return b; };
OBJP.pframe = function (o) { const w = o.w || 24, h = o.h || 28, b = new PB(w, h), G0 = RPK.gmetal; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const e = Math.min(x, y, w - 1 - x, h - 1 - y); if (e > 2) continue; b.set(x, y, e === 0 ? G0[1] : e === 1 ? G0[(x + y) % 5 === 0 ? 5 : 4] : G0[2]); } b.outline(OUTL); return b; };
OBJP.vanity = function () { const b = new PB(26, 32), W0 = RPK.wood; b.ell(13, 8, 7, 8, 0, (x, y, d) => d > 0.75 ? RPK.gmetal[3] : RPK.water[(y >> 2) % 2 ? 5 : 6]); b.rect(1, 16, 24, 6, W0[4]); b.hl(1, 16, 24, W0[5]); b.rect(1, 22, 24, 6, W0[2]); b.rect(2, 28, 3, 4, W0[1]); b.rect(21, 28, 3, 4, W0[1]);
  b.rect(4, 13, 3, 3, RPK.pink[3]); b.rect(19, 12, 3, 4, RPK.teal[3]); b.set(20, 11, RPK.gmetal[4]); b.outline(OUTL); return b; };
OBJP.loom = function () { const b = new PB(28, 32), W0 = RPK.wood; b.rect(1, 0, 3, 30, W0[2]); b.rect(24, 0, 3, 30, W0[2]); b.rect(1, 1, 26, 3, W0[3]); b.rect(1, 22, 26, 3, W0[3]);
  const cl = [RPK.wine[3], RPK.gold[3], RPK.navy[3], RPK.ivory[3]]; for (let y = 4; y < 22; y++) for (let x = 5; x < 23; x++) b.set(x, y, y < 14 ? cl[((x >> 2) + (y >> 1)) % 4] : (x & 1) ? RPK.ivory[4] : RPK.ivory[2]); b.rect(4, 26, 20, 3, W0[1]); b.outline(OUTL); return b; };
OBJP.cot = function (o) { const b = new PB(18, 30), W0 = RPK.wood, R0 = RPK[o.ramp || 'blue']; b.rect(1, 0, 16, 6, W0[3]); b.hl(1, 0, 16, W0[4]); b.rect(2, 6, 14, 6, RPK.white[4]); b.ell(9, 8, 4, 2.4, 0, () => RPK.white[3]);
  b.rect(2, 12, 14, 14, R0[2]); for (let y = 14; y < 26; y += 4) b.hl(3, y, 12, R0[3]); b.rect(1, 26, 16, 3, W0[2]); b.outline(OUTL); return b; };
OBJP.rhorse = function () { const b = new PB(20, 18), W0 = RPK.wood; b.ell(10, 15, 9, 2, 0, (x, y, d) => d > 0.6 ? W0[2] : null); b.ell(10, 8, 6, 3, 0, () => RPK.white[4]); b.rect(3, 3, 4, 6, RPK.white[4]); b.set(3, 4, DK); for (let y = 2; y < 8; y++) b.set(7, y, RPK.rred[3]);
  b.rect(6, 10, 2, 5, W0[3]); b.rect(13, 10, 2, 5, W0[3]); b.rect(9, 6, 4, 2, RPK.red[3]); b.outline(OUTL); return b; };
OBJP.scope = function () { const b = new PB(22, 34), W0 = RPK.wood, G0 = RPK.gmetal; b.rect(10, 18, 2, 12, W0[2]); b.rect(5, 29, 12, 3, W0[1]); b.ell(11, 10, 8, 8, 0, (x, y, d) => d > 0.8 ? G0[3] : null); b.ell(11, 10, 8, 3, 0, (x, y, d) => d > 0.7 ? G0[4] : null);
  b.ell(11, 10, 3, 8, 0, (x, y, d) => d > 0.6 ? G0[2] : null); b.ell(11, 10, 2, 2, 0, () => RPK.blue[3]); b.line(2, 3, 20, 17, G0[4]); b.outline(OUTL); return b; };
OBJP.lbench = function (o) { const w = o.w || 64, b = new PB(w, 13), W0 = RPK.wood; b.rect(0, 2, w, 5, W0[3]); b.hl(0, 2, w, W0[4]); b.hl(0, 6, w, W0[1]); for (let x = 3; x < w - 3; x += Math.max(20, w / 3)) b.rect(x, 7, 3, 5, W0[1]); b.rect(w - 5, 7, 3, 5, W0[1]); b.outline(OUTL); return b; };
OBJP.platter = function (o) { const w = o.w || 96, b = new PB(w, 16), s = o.seed || 3; for (let x = 6; x < w - 8; x += 14) { const k = ((hsh(x, 2, s) * 5) | 0);
    if (k === 0) { b.ell(x + 4, 9, 5, 3, 0, (xx, yy) => RPK.rred[yy < 8 ? 4 : 3]); b.set(x + 8, 7, RPK.ivory[4]); } else if (k === 1) { b.ell(x + 4, 10, 4, 2.5, 0, () => RPK.dirt[4]); b.hl(x + 2, 9, 4, RPK.dirt[5]); }
    else if (k === 2) { b.ell(x + 4, 10, 4, 2, 0, () => RPK.steel[4]); b.set(x + 3, 9, RPK.red[3]); b.set(x + 5, 9, RPK.green[4]); b.set(x + 4, 8, RPK.gold[4]); } else { b.rect(x + 2, 6, 3, 5, RPK.gmetal[3]); b.set(x + 3, 6, RPK.wine[2]); b.rect(x + 7, 7, 3, 4, RPK.gmetal[4]); } }
  for (let x = 14; x < w - 10; x += 34) { b.rect(x, 2, 2, 6, RPK.ivory[4]); b.set(x, 1, RPK.fire[4]); } b.outline(OUTL2); return b; };
OBJP.tilt = function (o) { const n = o.n || 8, w = n * 16, b = new PB(w, 22), W0 = RPK.wood, R0 = RPK[o.ramp || 'navy']; for (let x = 0; x < w; x += 16) b.rect(x + 1, 6, 3, 15, W0[2]); b.rect(0, 6, w, 4, W0[4]); b.hl(0, 6, w, W0[5]);
  for (let x = 0; x < w; x++) for (let y = 10; y < 17; y++) b.set(x, y, ((x >> 3) & 1) ? R0[3] : RPK.ivory[4]); b.hl(0, 16, w, R0[1]); b.outline(OUTL); return b; };
// tournament stands: three tiers of benches under a striped awning, a cloth skirt with shields and a royal box in the middle
OBJP.stands = function (o) { const n = o.n || 12, w = n * 16, b = new PB(w, 54), W0 = RPK.wood, R0 = RPK[o.ramp || 'red'], I = RPK.ivory, Gd = RPK.gmetal, P = RPK.purple, m = w >> 1;
  // three tiers of benches with risers
  for (let t = 0; t < 3; t++) { const y = 22 + t * 9; b.rect(0, y, w, 6, W0[4 - t]); b.hl(0, y, w, W0[5 - t]); for (let x = 6; x < w; x += 12) b.vl(x, y + 1, 5, W0[3 - t]); b.rect(0, y + 6, w, 3, W0[1]); }
  // posts and the striped awning with a scalloped edge
  for (let x = 0; x < w; x += 24) { b.rect(x + 2, 10, 3, 42, W0[2]); b.vl(x + 2, 10, 42, W0[3]); }
  for (let x = 0; x < w; x++) { const st = ((x / 8) | 0) & 1, sc = Math.abs((x % 8) - 3.5) < 2.6; for (let y = 4; y < (sc ? 15 : 13); y++) b.set(x, y, st ? R0[y < 6 ? 4 : 3] : I[y < 6 ? 4 : 3]); b.set(x, 4, st ? R0[4] : I[4]); }
  for (let x = 4; x < w; x += 32) { if (Math.abs(x - m) < 26) continue; b.vl(x, 0, 6, W0[1]); b.rect(x + 1, 0, 6, 3, R0[4]); b.set(x + 7, 1, R0[3]); }
  // the cloth skirt along the front, with shields
  for (let x = 0; x < w; x++) { for (let y = 46; y < 53; y++) b.set(x, y, R0[y < 48 ? 3 : 2]); b.set(x, 46, Gd[3]); if (x % 6 === 0) b.set(x, 52, Gd[2]); }
  for (let x = 14; x < w - 8; x += 32) { if (Math.abs(x - m) < 22) continue; b.rect(x, 46, 7, 5, I[4]); b.rect(x + 1, 51, 5, 1, I[4]); b.set(x + 3, 52, I[4]); b.rect(x + 1, 47, 5, 4, ((x / 32) | 0) % 2 ? RPK.blue[3] : RPK.green[3]); b.vl(x + 3, 47, 4, Gd[4]); }
  // the royal box in the middle: a raised canopy in purple and gold
  const bx0 = m - 22, bx1 = m + 22; b.rect(bx0, 14, bx1 - bx0, 12, W0[1]); b.rect(bx0 + 2, 18, bx1 - bx0 - 4, 8, P[1]); // shade inside
  for (const px of [bx0, bx1 - 3]) { b.rect(px, 0, 3, 52, W0[3]); b.vl(px, 0, 52, W0[4]); b.set(px + 1, 0, Gd[4]); }
  for (let x = bx0; x < bx1; x++) { const st = ((x - bx0) / 6 | 0) & 1, sc = Math.abs(((x - bx0) % 6) - 2.5) < 2; for (let y = 2; y < (sc ? 14 : 12); y++) b.set(x, y, st ? P[y < 5 ? 4 : 3] : Gd[y < 5 ? 4 : 3]); b.hl(x, 2, 1, Gd[5]); }
  b.rect(bx0 + 1, 26, bx1 - bx0 - 2, 2, Gd[3]); b.rect(bx0, 28, bx1 - bx0, 18, P[2]); for (let y = 29; y < 46; y += 4) b.hl(bx0, y, bx1 - bx0, P[3]); b.hl(bx0, 28, bx1 - bx0, Gd[4]);
  b.rect(m - 5, 30, 11, 10, Gd[3]); b.rect(m - 4, 31, 9, 8, P[1]); b.rect(m - 3, 36, 7, 2, Gd[4]); for (const x of [m - 3, m, m + 3]) { b.set(x, 35, Gd[4]); b.set(x, 34, Gd[5]); } b.set(m - 2, 35, Gd[3]); b.set(m + 2, 35, Gd[3]); b.set(m, 37, RPK.red[4]); // a crown
  b.vl(m, -1, 1, 0); b.rect(m - 1, 0, 3, 2, Gd[4]);
  b.outline(OUTL); return b; };
OBJP.tent = function (o, f) { const W = 58, H = 66, b = new PB(W, H), R0 = RPK[o.ramp || 'red'], I = RPK.ivory, Wd = RPK.wood, cx = 29;
  shadowEll(b, cx, H - 4, 27, 4);
  // guy ropes and pegs
  b.line(3, 34, 0, H - 6, Wd[2]); b.line(W - 4, 34, W - 1, H - 6, Wd[2]); b.rect(0, H - 6, 2, 2, Wd[3]); b.rect(W - 2, H - 6, 2, 2, Wd[3]);
  // the drum: vertical stripes shaded as a cylinder
  const x0 = 5, x1 = W - 6, yt = 34, yb = H - 7;
  for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0), stripe = Math.floor((x - x0) / 6) % 2, sh = t < 0.2 ? 1 : t < 0.6 ? 0 : t < 0.85 ? -1 : -2;
    const c = stripe ? R0[clamp(3 + sh, 0, 4)] : I[clamp(4 + sh, 0, 4)]; for (let y = yt; y <= yb + (Math.abs(t - 0.5) < 0.45 ? 1 : 0); y++) b.set(x, y, c); }
  b.hl(x0, yb + 1, x1 - x0 + 1, R0[1]);
  // the doorway with tied-back flaps
  b.rect(cx - 6, yt + 9, 12, yb - yt - 8, DK2); b.rect(cx - 5, yt + 10, 10, 3, hx('#2a1a14')); b.rect(cx - 4, yb - 3, 8, 3, RPK.dirt[2]);
  b.poly([[cx - 7, yt + 8], [cx - 2, yt + 8], [cx - 7, yt + 24]], 0, () => I[3]); b.poly([[cx + 7, yt + 8], [cx + 2, yt + 8], [cx + 7, yt + 24]], 0, () => I[2]);
  b.set(cx - 7, yt + 16, Wd[3]); b.set(cx + 6, yt + 16, Wd[3]);
  // the cone: radiating stripes, light from the left
  const ay = 9, ey = 33;
  b.poly([[cx, ay], [W - 1, ey], [0, ey]], 0, (x, y) => { const k = (y - ay) / (ey - ay), u = (x - cx) / Math.max(1, k * 29), seg = Math.floor((u + 1) * 4.5) % 2, sh = u < -0.5 ? 1 : u < 0.2 ? 0 : u < 0.7 ? -1 : -2;
    return seg ? R0[clamp(3 + sh, 0, 4)] : I[clamp(4 + sh, 0, 4)]; });
  // scalloped valance
  for (let x = 0; x < W; x++) { const s = Math.floor(x / 5) % 2, d = Math.abs((x % 5) - 2); for (let y = ey; y < ey + 4 - (d > 1 ? 1 : 0); y++) b.set(x, y, s ? R0[2] : R0[3]); b.set(x, ey, R0[4]); }
  // a shield with a charge above the door
  b.rect(cx - 3, yt + 1, 7, 6, I[4]); b.rect(cx - 2, yt + 7, 5, 1, I[4]); b.set(cx, yt + 8, I[4]); b.rect(cx - 2, yt + 2, 5, 5, R0[2]); b.set(cx, yt + 3, RPK.gmetal[4]); b.set(cx - 1, yt + 4, RPK.gmetal[4]); b.set(cx + 1, yt + 4, RPK.gmetal[4]); b.set(cx, yt + 5, RPK.gmetal[4]);
  // the pole, a gilded knob and a long pennant (two frames: it streams in the wind)
  b.vl(cx, 0, ay + 1, Wd[2]); b.set(cx, 0, RPK.gmetal[4]); b.set(cx - 1, 1, RPK.gmetal[3]); b.set(cx + 1, 1, RPK.gmetal[3]);
  const fl = f ? 1 : 0; for (let k = 0; k < 13; k++) { const y = 2 + Math.round(Math.sin(k * 0.6 + fl * 1.6) * 0.8) + (k > 8 ? 1 : 0), hh = k < 9 ? 3 : 2; for (let j = 0; j < hh; j++) b.set(cx + 1 + k, y + j, (k + j) % 4 === 0 ? R0[2] : R0[4]); }
  b.outline(OUTL); return b; };
OBJP.chapelb = function (o) { const W0 = 112, b = new PB(W0 + 4, 104), S = RPK.stone, fy = 52; wallTex(b, 2, fy, W0, 50, 'stone', 21); for (let x = 2; x < W0 + 2; x++) b.put(x, fy + 48, S[2]);
  roofTex(b, 0, 18, W0 + 4, 36, 'slate', 21); for (let x = 2; x < W0 + 2; x++) for (let y = 0; y < 3; y++) b.set(x, fy + y, pk(18, 10, 28, 110 - y * 30));
  const gx = 46; b.poly([[gx, 22], [gx + 12, 4], [gx + 24, 22]], 0, (x, y) => S[x < gx + 12 ? 5 : 3]); b.rect(gx + 2, 22, 20, 30, S[4]); b.vl(gx + 2, 22, 30, S[5]); b.rect(gx + 8, 26, 8, 10, DK); b.ell(gx + 12, 31, 3, 3, 0, () => RPK.gmetal[3]); b.set(gx + 12, 1, RPK.gmetal[4]); b.vl(gx + 12, 0, 5, RPK.gmetal[3]);
  b.ell(58, fy + 15, 8, 8, 0, (x, y, d) => d > 0.8 ? S[5] : [RPK.red[3], RPK.blue[3], RPK.gold[4], RPK.green[3]][((Math.atan2(y - fy - 15, x - 58) + 4) * 1.3 | 0) % 4]);
  doorArt(b, 50, fy + 25, 16, 22, {}); for (const wx of [14, 32, 82, 100]) archWin(b, wx, fy + 12, 6, 16); b.outline(OUTL); b.meta = { lights: [[58, fy + 15], [17, fy + 20], [103, fy + 20]], smoke: [] }; return b; };
OBJP.perch = function () { const b = new PB(14, 24), W0 = RPK.wood; b.rect(6, 8, 2, 15, W0[2]); b.rect(1, 7, 12, 2, W0[3]); b.rect(3, 22, 8, 2, W0[1]); b.ell(7, 4, 3, 3.5, 0, (x, y) => RPK.brown[y < 3 ? 4 : 3]); b.set(6, 2, RPK.gold[4]); b.set(5, 3, DK); b.rect(5, 0, 4, 2, RPK.wine[2]); b.outline(OUTL); return b; };
OBJP.scaffold = function (o) { const w = (o.w || 4) * 16, h = o.h || 48, b = new PB(w + 4, h), W0 = RPK.wood, S = RPK.stone, p = o.p || 0; const wh = Math.round((h - 10) * p);
  for (let y = h - 4 - wh; y < h - 4; y++) for (let x = 6; x < w - 2; x++) b.set(x, y, ((y >> 2) + (x >> 3)) % 5 === 0 ? S[2] : S[(y >> 2) % 2 ? 4 : 3]);
  for (let x = 2; x < w + 2; x += 18) b.rect(x, 4, 2, h - 4, W0[2]); for (let y = h - 6; y > 6; y -= 14) { b.rect(0, y, w + 4, 3, W0[4]); b.hl(0, y, w + 4, W0[5]); }
  for (let x = 2; x + 18 < w; x += 36) b.line(x, h - 6, x + 18, Math.max(6, h - 20), W0[1]); b.rect(w - 8, 8, 2, h - 10, W0[3]); b.rect(w - 2, 8, 2, h - 10, W0[3]); for (let y = 10; y < h - 4; y += 4) b.hl(w - 8, y, 8, W0[2]);
  b.rect(0, h - 6, 10, 4, S[4]); b.rect(2, h - 9, 6, 3, S[3]); b.outline(OUTL); return b; };
OBJP.lotsign = function () { const b = new PB(16, 22), W0 = RPK.wood; b.rect(7, 8, 2, 13, W0[2]); b.rect(1, 1, 14, 9, W0[4]); b.hl(1, 1, 14, W0[5]); b.hl(3, 4, 10, RPK.dwood[1]); b.hl(3, 6, 8, RPK.dwood[1]); b.outline(OUTL); return b; };
OBJP.kstatue = function () { const b = new PB(26, 54), S = RPK.stone, B0 = RPK.gmetal; b.rect(3, 38, 20, 14, S[3]); b.hl(3, 38, 20, S[5]); b.rect(1, 50, 24, 4, S[2]); b.rect(6, 42, 14, 6, S[4]);
  b.ell(13, 8, 4, 4.5, 0, (x, y) => B0[x < 13 ? 4 : 2]); b.rect(9, 2, 9, 3, B0[4]); for (const x of [9, 12, 15, 17]) b.set(x, 1, B0[5]); b.rect(8, 13, 11, 14, B0[3]); b.vl(8, 13, 14, B0[4]); b.poly([[7, 27], [20, 27], [22, 38], [5, 38]], 0, (x) => B0[x < 12 ? 3 : 2]);
  b.vl(21, 6, 26, RPK.steel[4]); b.hl(19, 22, 5, B0[4]); b.rect(4, 15, 4, 9, B0[2]); b.outline(OUTL); return b; };
// ---------- villages, fields, water ----------
OBJP.crops = function (o) { const b = new PB(16, 16), s = o.s | 0, k = o.k || 'wheat', sd = o.seed || 1;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { const x = 2 + i * 4 + ((hsh(i, r, sd) * 2) | 0), y = 5 + r * 5;
    if (k === 'cabbage') { if (s === 3) continue; b.ell(x, y, 2, 1.6, 0, () => RPK.green[s === 0 ? 3 : 4]); b.set(x, y - 1, RPK.leaf[6]); continue; }
    if (s === 0) { b.set(x, y, RPK.leaf[5]); b.set(x, y - 1, RPK.leaf[6]); } else if (s === 1) { for (let j = 0; j < 5; j++) b.set(x + (j & 1), y - j, j > 3 ? RPK.thatch[4] : RPK.leaf[4 + (j & 1)]); }
    else if (s === 2) { if ((i + r) % 2) { b.rect(x, y - 3, 2, 4, RPK.thatch[3]); b.set(x, y - 4, RPK.thatch[4]); } else b.set(x, y, RPK.thatch[2]); } else b.set(x, y, RPK.dirt[2]); } return b; };
OBJP.vine = function (o) { const b = new PB(16, 24), s = o.s | 0, W0 = RPK.wood; b.rect(2, 6, 2, 17, W0[2]); b.rect(12, 6, 2, 17, W0[2]); b.hl(1, 7, 14, W0[1]);
  if (s < 3) { canopy(b, [[8, 11, 6], [4, 14, 3], [12, 14, 3]], 'leaf', o.seed || 3, null); if (s >= 1) for (let k = 0; k < 4; k++) b.ell(4 + k * 3, 16 + (k & 1), 1.5, 2, 0, () => RPK.purple[s === 2 ? 3 : 2]); } else { b.line(2, 9, 14, 12, W0[1]); b.line(3, 13, 13, 10, W0[1]); }
  b.outline(OUTL2); return b; };
OBJP.boat = function (o) { const b = new PB(44, 18), W0 = RPK.wood; b.poly([[0, 6], [44, 6], [38, 15], [6, 15]], 0, (x, y) => W0[y < 8 ? 4 : y > 12 ? 1 : 2]); b.rect(4, 7, 36, 5, W0[1]); for (let x = 12; x < 36; x += 10) b.rect(x, 7, 2, 5, W0[3]);
  b.line(8, 4, 2, 16, W0[3]); b.line(34, 4, 42, 16, W0[3]); if (o.net) b.ell(24, 9, 5, 2, 0, () => RPK.thatch[2]); b.outline(OUTL); return b; };
OBJP.mill = function (o, f) { const b = new PB(48, 78), W0 = RPK.wood, S = RPK.stone; b.poly([[14, 30], [34, 30], [38, 76], [10, 76]], 0, (x, y) => S[x < 20 ? 5 : x > 30 ? 3 : 4]); for (let y = 34; y < 76; y += 6) b.hl(12, y, 25, S[2]);
  b.poly([[11, 31], [24, 16], [37, 31]], 0, (x) => RPK.rred[x < 24 ? 4 : 3]); doorArt(b, 19, 60, 10, 15, {}); b.rect(22, 40, 4, 6, DK);
  const cx = 24, cy = 26, a0 = (f || 0) * Math.PI / 8; for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2, ex = Math.cos(a), ey = Math.sin(a);
    for (let t = 2; t < 22; t++) { const x = cx + ex * t, y = cy + ey * t; b.set(x, y, W0[1]); if (t > 6) for (let s2 = 1; s2 < 5; s2++) b.set(x - ey * s2, y + ex * s2, (t + s2) % 3 ? RPK.ivory[3] : W0[3]); } }
  b.ell(cx, cy, 2, 2, 0, () => W0[4]); b.outline(OUTL); return b; };
OBJP.rock = function (o) { const b = new PB(22, 16), S = RPK.stone, s = o.seed || 1; b.ell(11, 9, 9 + hsh(s, 1, 3) * 2, 6, 0, (x, y) => { const n = hsh(x, y, s); return S[y < 7 ? (x < 10 ? 5 : 4) : y > 11 ? 2 : 3 + (n > 0.85 ? 1 : 0)]; }); b.set(8, 5, S[6]); b.set(14, 10, RPK.leaf[3]); b.set(15, 10, RPK.leaf[4]); b.outline(OUTL); return b; };
OBJP.log = function () { const b = new PB(32, 12), W0 = RPK.wood; b.rect(4, 2, 26, 8, W0[2]); b.hl(4, 2, 26, W0[4]); b.hl(4, 9, 26, W0[1]); for (let x = 8; x < 28; x += 6) b.set(x, 5, W0[1]); b.ell(4, 6, 3.5, 4, 0, (x, y, d) => d > 0.6 ? W0[3] : RPK.wood[5]); b.set(4, 6, W0[2]); b.set(20, 1, RPK.leaf[4]); b.outline(OUTL); return b; };
OBJP.stump = function () { const b = new PB(14, 12), W0 = RPK.wood; b.rect(2, 4, 10, 6, W0[2]); b.vl(2, 4, 6, W0[3]); b.ell(7, 4, 5, 2.4, 0, (x, y, d) => d > 0.6 ? W0[3] : W0[5]); b.set(7, 4, W0[3]); b.outline(OUTL); return b; };
OBJP.shrine = function () { const b = new PB(16, 28), W0 = RPK.wood; b.rect(7, 10, 2, 17, W0[2]); b.rect(3, 8, 10, 7, W0[3]); b.rect(5, 9, 6, 5, DK2); b.set(7, 11, RPK.fire[4]); b.set(8, 11, RPK.fire[3]); b.poly([[1, 9], [8, 2], [15, 9]], 0, (x) => RPK.rred[x < 8 ? 4 : 3]); b.rect(4, 26, 8, 2, RPK.stone[3]); b.outline(OUTL); return b; };
OBJP.sheaf = function () { const b = new PB(12, 16), T = RPK.thatch; b.poly([[6, 1], [11, 14], [1, 14]], 0, (x, y) => T[x < 6 ? 4 : 3]); b.hl(3, 8, 6, T[1]); b.outline(OUTL); return b; };
OBJP.scarecrow = function () { const b = new PB(18, 32), W0 = RPK.wood; b.rect(8, 8, 2, 23, W0[2]); b.rect(1, 12, 16, 2, W0[3]); b.ell(9, 6, 3.5, 3.5, 0, () => RPK.thatch[3]); b.rect(4, 1, 10, 3, RPK.brown[2]); b.set(8, 6, DK); b.set(10, 6, DK);
  b.rect(5, 13, 8, 9, RPK.wine[2]); b.set(3, 14, RPK.thatch[4]); b.set(15, 14, RPK.thatch[4]); b.outline(OUTL); return b; };
OBJP.beehive = function () { const b = new PB(14, 18), T = RPK.thatch; b.ell(7, 9, 6, 7, 0, (x, y) => T[(y >> 1) % 2 ? 3 : 4]); b.rect(0, 15, 14, 3, RPK.wood[2]); b.set(7, 13, DK); b.outline(OUTL); return b; };
OBJP.washline = function (o) { const b = new PB(38, 26), W0 = RPK.wood; b.rect(1, 2, 2, 23, W0[2]); b.rect(35, 2, 2, 23, W0[2]); b.line(2, 4, 36, 4, RPK.ivory[2]); const cl = [RPK.ivory[4], RPK.blue[3], RPK.wine[3], RPK.ivory[3], RPK.thatch[3]];
  for (let k = 0; k < 4; k++) { const x = 5 + k * 8, c = cl[(k + (o.seed || 0)) % 5]; b.rect(x, 5, 6, 8 + (k & 1) * 3, c); b.hl(x, 5, 6, cmul(c, 1.1)); } b.outline(OUTL); return b; };
OBJP.nets = function () { const b = new PB(26, 22), W0 = RPK.wood; b.rect(1, 2, 2, 19, W0[2]); b.rect(23, 2, 2, 19, W0[2]); for (let y = 4; y < 16; y += 2) for (let x = 3; x < 23; x++) if ((x + y) % 3 === 0) b.set(x, y + Math.round(Math.sin(x * 0.4)), RPK.thatch[2]); for (let x = 4; x < 23; x += 3) b.vl(x, 4, 12, RPK.thatch[1]); b.outline(OUTL2); return b; };
OBJP.mine = function () { const b = new PB(46, 40), S = RPK.stone, W0 = RPK.wood; b.ell(23, 22, 22, 18, 0, (x, y) => { const n = hsh(x, y, 9); return S[y < 14 ? 5 : y > 30 ? 2 : n > 0.8 ? 4 : 3]; }); b.rect(13, 16, 20, 24, DK); b.rect(11, 14, 4, 26, W0[2]); b.rect(31, 14, 4, 26, W0[2]); b.rect(10, 12, 26, 4, W0[3]); b.hl(10, 12, 26, W0[4]);
  b.hl(16, 36, 14, RPK.steel[3]); b.hl(16, 38, 14, RPK.steel[3]); b.outline(OUTL); return b; };
OBJP.grave = function (o) { const b = new PB(12, 16), S = RPK.stone; b.rect(2, 3, 8, 11, S[4]); b.ell(6, 3, 4, 2.5, 0, () => S[4]); b.vl(2, 3, 11, S[5]); b.hl(4, 6, 4, S[2]); b.rect(1, 13, 10, 3, RPK.dirt[2]); b.outline(OUTL); return b; };
OBJP.campfire = function (o, f) { const b = new PB(18, 18), W0 = RPK.wood, F = RPK.fire; b.ell(9, 14, 7, 3, 0, () => RPK.stone[3]); b.line(3, 15, 15, 12, W0[2]); b.line(3, 12, 15, 15, W0[1]); for (let k = 0; k < 10; k++) { const x = 6 + (k % 6), hh = 3 + ((hsh(k, f, 7) * 6) | 0); for (let y = 0; y < hh; y++) b.set(x, 12 - y, F[Math.min(5, 1 + y + ((k + f) & 1))]); } b.outline(OUTL); return b; };
OBJP.counter = function (o) { const w = o.w || 64, b = new PB(w, 28), W0 = RPK.wood; b.rect(0, 4, w, 7, W0[4]); b.hl(0, 4, w, W0[5]); b.rect(0, 11, w, 15, W0[2]); for (let x = 4; x < w; x += 12) b.rect(x, 13, 8, 11, W0[3]);
  for (let x = 6; x < w - 6; x += 15) { b.rect(x, 0, 4, 5, RPK.gmetal[3]); b.set(x + 4, 2, RPK.gmetal[2]); b.hl(x, 0, 4, RPK.ivory[4]); } b.outline(OUTL); return b; };
OBJP.ttable = function (o) { const b = new PB(28, 22), W0 = RPK.wood; b.ell(14, 8, 12, 6, 0, (x, y) => W0[y < 6 ? 5 : y > 11 ? 2 : 4]); b.rect(12, 13, 4, 7, W0[1]); b.rect(7, 19, 14, 2, W0[1]);
  b.rect(7, 4, 3, 4, RPK.gmetal[3]); b.hl(7, 4, 3, RPK.ivory[4]); b.rect(17, 6, 3, 4, RPK.gmetal[3]); b.ell(14, 9, 3, 1.6, 0, () => RPK.dirt[4]); b.outline(OUTL); return b; };
OBJP.cask = function () { const b = new PB(30, 26), W0 = RPK.wood, M = RPK.steel; b.rect(0, 20, 30, 5, W0[1]); for (const [cx, cy] of [[8, 13], [22, 13], [15, 5]]) { b.ell(cx, cy, 7, 6.5, 0, (x, y, d) => d > 0.85 ? M[2] : (x - cx + 7) % 5 === 0 ? W0[2] : W0[y < cy ? 4 : 3]); b.ell(cx, cy, 2, 2, 0, () => W0[1]); } b.outline(OUTL); return b; };
// tavern & guild signs on buildings (adds icons to OBJP.bld signs)
const SIGN_EXT = { mug: (b, x, y) => { b.rect(x + 2, y + 2, 5, 6, RPK.gmetal[3]); b.hl(x + 2, y + 2, 5, RPK.ivory[4]); b.vl(x + 7, y + 4, 2, RPK.gmetal[2]); }, fish: (b, x, y) => { b.ell(x + 5, y + 5, 3.5, 1.8, 0, () => RPK.steel[4]); b.set(x + 1, y + 4, RPK.steel[3]); b.set(x + 1, y + 6, RPK.steel[3]); },
  sun: (b, x, y) => { b.ell(x + 5, y + 4, 2.5, 2.5, 0, () => RPK.gmetal[4]); }, scales: (b, x, y) => { b.vl(x + 5, y + 2, 6, RPK.gmetal[3]); b.hl(x + 2, y + 3, 7, RPK.gmetal[4]); b.set(x + 2, y + 5, RPK.gmetal[4]); b.set(x + 8, y + 5, RPK.gmetal[4]); },
  coin: (b, x, y) => { b.ell(x + 5, y + 4, 3, 3, 0, (xx, yy, d) => d > 0.6 ? RPK.gmetal[2] : RPK.gmetal[4]); }, horse: (b, x, y) => { b.rect(x + 3, y + 3, 5, 3, RPK.brown[3]); b.set(x + 2, y + 2, RPK.brown[3]); b.set(x + 3, y + 6, RPK.brown[2]); b.set(x + 7, y + 6, RPK.brown[2]); } };
{ const bld0 = OBJP.bld; OBJP.bld = function (o, f) { const b = bld0(o, f); const fn = o.sign && SIGN_EXT[o.sign[1]]; if (fn) fn(b, o.sign[0], (o.chim !== undefined ? 12 : 0) + o.rh + 8); return b; }; }
// ---------- animals: game & livestock (extends animalPB) ----------
function legs4(b, xs, y0, y1, C, f) { xs.forEach((x, i) => { const up = ((i + f) & 1) ? 1 : 0; for (let y = y0; y < y1 - up; y++) b.set(x, y, C); b.set(x, y1 - up, DK2); }); }
const ANIM_EXT = {
  deer(f, col) { const b = new PB(30, 28), C0 = RPK.brown, stag = col !== 'doe'; b.ell(16, 15, 8.5, 4.6, 0, (x, y) => C0[y < 13 ? 4 : y > 17 ? 2 : 3]); b.ell(17, 18, 5, 1.5, 0, () => RPK.ivory[3]);
    b.poly([[8, 14], [12, 12], [8, 5], [5, 5], [4, 8]], 0, (x, y) => C0[y < 8 ? 4 : 3]); b.ell(5, 7, 3, 2.2, 0, () => C0[4]); b.set(2, 8, DK); b.set(5, 6, DK); b.set(8, 4, C0[3]); b.set(9, 3, C0[3]);
    if (stag) { const A = RPK.ivory[2]; b.line(6, 4, 4, 0, A); b.line(7, 4, 10, 0, A); b.set(3, 1, A); b.set(11, 1, A); b.set(5, 2, A); b.set(9, 2, A); }
    legs4(b, [10, 12, 20, 22], 19, 27, C0[2], f); b.rect(24, 11, 2, 3, RPK.ivory[4]); b.outline(OUTL); return b; },
  boar(f) { const b = new PB(24, 16), C0 = RPK.dwood; b.ell(13, 8, 9, 5, 0, (x, y) => C0[y < 6 ? 4 : y > 10 ? 1 : 3]); for (let x = 7; x < 20; x += 2) b.set(x, 3, C0[2]); b.poly([[5, 6], [1, 9], [2, 11], [6, 11]], 0, () => C0[3]); b.set(1, 10, RPK.pink[2]);
    b.set(3, 8, RPK.ivory[4]); b.set(2, 8, RPK.ivory[4]); b.set(5, 6, DK); b.set(6, 4, C0[2]); legs4(b, [7, 9, 16, 18], 12, 15, C0[1], f); b.set(22, 6, C0[2]); b.set(23, 5, C0[2]); b.outline(OUTL); return b; },
  hare(f, col) { const b = new PB(12, 10), C0 = col === 'snow' ? RPK.white : RPK.sand; b.ell(6, 6, 4, 2.6, 0, (x, y) => C0[y < 6 ? 4 : 3]); b.ell(2.5, 5, 2, 1.8, 0, () => C0[4]); b.set(1, 5, DK); b.rect(3, 1, 1, 3, C0[3]); b.rect(4, 0, 1, 4, C0[4]);
    b.set(10, 5, RPK.ivory[4]); if (f % 2) { b.set(3, 9, C0[2]); b.set(9, 9, C0[2]); } else { b.set(5, 9, C0[2]); b.set(8, 9, C0[2]); } b.outline(OUTL); return b; },
  fox(f) { const b = new PB(20, 11), C0 = RPK.orange; b.ell(9, 5, 5, 2.6, 0, (x, y) => C0[y < 5 ? 4 : 3]); b.poly([[4, 4], [0, 6], [4, 7]], 0, () => C0[4]); b.set(3, 2, C0[3]); b.set(5, 2, C0[3]); b.set(1, 6, DK); b.set(3, 4, DK);
    b.ell(16, 4, 3.5, 1.8, 0, (x) => x > 17 ? RPK.ivory[4] : C0[3]); legs4(b, [6, 8, 11, 13], 7, 10, RPK.dwood[2], f); b.outline(OUTL); return b; },
  wolf(f) { const b = new PB(24, 15), C0 = RPK.gray; b.ell(12, 7, 7, 3.6, 0, (x, y) => C0[y < 6 ? 4 : y > 9 ? 2 : 3]); b.poly([[6, 5], [1, 7], [2, 9], [6, 9]], 0, () => C0[4]); b.set(5, 3, C0[3]); b.set(7, 3, C0[3]); b.set(1, 8, DK); b.set(4, 6, hx('#e8c040'));
    b.line(18, 6, 23, 9, C0[3]); b.line(18, 7, 22, 10, C0[2]); legs4(b, [8, 10, 15, 17], 10, 14, C0[2], f); b.outline(OUTL); return b; },
  bear(f) { const b = new PB(32, 24), C0 = RPK.brown; b.ell(17, 12, 12, 7.5, 0, (x, y) => C0[y < 9 ? 3 : y > 15 ? 1 : 2]); b.ell(5, 11, 4.5, 4, 0, () => C0[3]); b.set(2, 8, C0[2]); b.set(7, 7, C0[2]); b.set(1, 12, DK); b.set(4, 10, DK); b.set(1, 11, RPK.sand[3]);
    legs4(b, [9, 12, 22, 25], 17, 23, C0[1], f); b.outline(OUTL); return b; },
  pheasant(f) { const b = new PB(16, 10), fly = f % 2; b.ell(6, 6, 3.5, 2.4, 0, (x, y) => RPK.rred[y < 6 ? 4 : 3]); b.ell(3, 4, 1.6, 1.6, 0, () => RPK.green[3]); b.set(2, 3, RPK.red[4]); b.set(1, 4, RPK.gold[4]); b.line(9, 6, 15, 4, RPK.dirt[3]); b.line(9, 7, 14, 6, RPK.dirt[2]);
    if (fly) { b.line(4, 4, 7, 0, RPK.dirt[3]); b.line(6, 4, 10, 1, RPK.dirt[4]); } else { b.set(5, 9, RPK.dirt[1]); b.set(7, 9, RPK.dirt[1]); } b.outline(OUTL); return b; },
  duck(f) { const b = new PB(12, 9), C0 = RPK.white; b.ell(6, 6, 4, 2.4, 0, (x, y) => C0[y < 6 ? 4 : 3]); b.ell(3, 3, 1.8, 1.8, 0, () => RPK.green[3]); b.set(1, 3, RPK.gold[4]); b.set(0, 3, RPK.gold[4]); if (f % 2) b.set(8, 4, C0[2]); b.outline(OUTL); return b; },
  sheep(f) { const b = new PB(18, 13), W0 = RPK.ivory; b.ell(10, 6, 6.5, 4, 0, (x, y) => (hsh(x, y, 3) > 0.7 ? W0[2] : W0[y < 5 ? 4 : 3])); b.ell(3, 6, 2.4, 2, 0, () => RPK.dwood[2]); b.set(2, 5, DK); legs4(b, [6, 8, 12, 14], 9, 12, RPK.dwood[1], f); b.outline(OUTL); return b; },
  cow(f, col) { const b = new PB(30, 22), C0 = RPK.white, P = RPK[col || 'brown'] || RPK.brown; b.ell(16, 10, 10, 5.5, 0, (x, y) => (hsh(x >> 2, y >> 2, 7) > 0.62 ? P[2] : C0[y < 8 ? 4 : 3])); b.poly([[7, 7], [1, 8], [1, 13], [6, 13]], 0, () => C0[4]); b.rect(1, 11, 4, 3, RPK.pink[3]);
    b.set(2, 9, DK); b.set(5, 6, RPK.ivory[2]); b.set(7, 5, RPK.ivory[2]); legs4(b, [9, 11, 21, 23], 15, 21, C0[2], f); b.set(27, 9, C0[2]); b.set(28, 13, P[2]); b.ell(15, 15, 2, 1.2, 0, () => RPK.pink[3]); b.outline(OUTL); return b; },
  pig(f) { const b = new PB(18, 12), C0 = RPK.pink; b.ell(10, 6, 6.5, 3.6, 0, (x, y) => C0[y < 5 ? 4 : 3]); b.rect(2, 5, 3, 3, C0[3]); b.set(2, 6, C0[1]); b.set(5, 4, DK); b.set(6, 2, C0[2]); legs4(b, [6, 8, 12, 14], 9, 11, C0[2], f); b.set(17, 5, C0[2]); b.outline(OUTL); return b; },
  goat(f) { const b = new PB(16, 14), C0 = RPK.ivory; b.ell(9, 7, 5.5, 3, 0, (x, y) => C0[y < 6 ? 4 : 3]); b.poly([[5, 6], [2, 4], [1, 7], [4, 9]], 0, () => C0[4]); b.set(2, 2, RPK.dwood[2]); b.set(3, 1, RPK.dwood[2]); b.set(2, 9, RPK.dwood[3]); b.set(2, 5, DK);
    legs4(b, [6, 7, 11, 12], 9, 13, RPK.dwood[2], f); b.outline(OUTL); return b; },
  rat(f) { const b = new PB(10, 6), C0 = RPK.gray; b.ell(5, 3, 3, 1.6, 0, () => C0[2]); b.set(1, 3, C0[3]); b.set(2, 2, DK); b.line(8, 3, 9, 5 - (f % 2), RPK.pink[2]); b.outline(OUTL); return b; },
  hound(f, col) { const b = new PB(18, 12), C0 = RPK.white, P = RPK[col || 'brown'] || RPK.brown; b.ell(9, 6, 5.5, 2.8, 0, (x, y) => (x > 9 && y < 7 ? P[3] : C0[y < 5 ? 4 : 3])); b.ell(3, 4, 2.4, 2.2, 0, () => P[3]); b.set(2, 3, DK); b.set(1, 5, DK); b.set(4, 6, P[2]); b.set(4, 7, P[2]);
    legs4(b, [6, 8, 11, 13], 8, 11, C0[2], f); b.set(15, 4 - (f % 2), C0[3]); b.set(16, 3 - (f % 2), C0[3]); b.outline(OUTL); return b; },
  falcon(f) { const b = new PB(14, 9), C0 = RPK.brown; b.ell(7, 5, 2.4, 2, 0, () => C0[3]); b.set(5, 4, RPK.gold[4]); if (f % 2) { b.line(1, 2, 6, 5, C0[4]); b.line(13, 2, 8, 5, C0[4]); } else { b.line(1, 6, 6, 5, C0[4]); b.line(13, 6, 8, 5, C0[4]); } b.set(7, 8, C0[2]); b.outline(OUTL); return b; },
};
// ---------- extra looks for walkers & portraits ----------
const LOOK_EXT = {
  priest: (r, fem) => ({ o: 'robe', cl: r.pick(['black', 'gray', 'brown']), bg: 'navy', hat: fem ? 'veil' : r.pick(['none', 'skull']) }),
  hunter: (r) => ({ o: 'tunic', cl: r.pick(['forest', 'green', 'brown']), bg: 'forest', hat: r.pick(['hoodcl', 'cap', 'none']) }),
  jailer: () => ({ o: 'tunic', cl: 'black', bg: 'gray', hat: 'none', keys: 1 }),
  minstrel: (r) => ({ o: 'doublet', cl: r.pick(['orange', 'teal', 'purple', 'red']), bg: 'wine', hat: 'cap' }),
  innkeeper: (r, fem) => ({ o: 'tunic', cl: r.pick(['brown', 'wine', 'green']), bg: 'brown', hat: fem ? 'kerchief' : 'none', apron: 1 }),
  villager: (r, fem) => ({ o: fem ? 'dress' : 'tunic', cl: r.pick(['brown', 'forest', 'orange', 'gray', 'wine', 'navy']), bg: 'forest', hat: r.pick(['none', 'straw', fem ? 'kerchief' : 'cap']) }),
  elder: (r, fem) => ({ o: fem ? 'dress' : 'robe', cl: r.pick(['brown', 'gray', 'navy']), bg: 'brown', hat: fem ? 'kerchief' : 'none' }),
  headman: (r) => ({ o: 'doublet', cl: r.pick(['brown', 'navy', 'wine']), bg: 'brown', hat: 'cap', chain: 1 }),
  traveler: () => ({ o: 'cloak', cl: 'brown', bg: 'gray', hat: 'hoodcl' }),
  steward: (r) => ({ o: 'doublet', cl: r.pick(['navy', 'wine', 'teal']), bg: 'brown', hat: 'none', keys: 1, chain: 1 }),
};
// a square stone post flanking a postern in the curtain wall (o.flip: torch on the other side)
OBJP.gatepost = function (o) { const b = new PB(34, 42), S = RPK.stone, F = RPK.fire;
  b.rect(2, 13, 30, 29, S[3]); for (let y = 13, k = 0; y < 42; y += 5, k++) { b.hl(2, y, 30, S[2]); for (let x = 2 + (k % 2) * 4; x < 32; x += 8) b.vl(x, y, 5, S[2]); }
  for (let y = 15; y < 41; y += 5) for (let x = 5; x < 31; x += 8) if (hsh(x, y, 5) > 0.6) b.hl(x, y, 3, S[4]);
  b.vl(2, 13, 29, S[4]); b.vl(31, 13, 29, S[1]); b.rect(0, 7, 34, 7, S[5]); b.hl(0, 7, 34, S[6]); b.hl(0, 13, 34, S[1]);
  for (let x = 0; x < 34; x += 7) { b.rect(x, 1, 5, 6, S[4]); b.hl(x, 1, 5, S[6]); b.vl(x + 4, 2, 5, S[2]); }
  b.rect(16, 21, 2, 8, DK2); const tx = o.flip ? 5 : 26; b.rect(tx, 28, 3, 6, RPK.wood[1]); b.rect(tx - 1, 26, 5, 2, RPK.steel[2]); b.set(tx + 1, 25, F[4]); b.set(tx, 24, F[3]); b.set(tx + 2, 24, F[3]); b.set(tx + 1, 23, F[5]);
  b.outline(OUTL); return b; };
// a framed painting or a wall hanging for rooms whose back wall is inside the castle (o.kind: land | hunt | sea | flowers | saint | stars | pegs)
OBJP.wallpic = function (o) { const k = o.kind || 'land';
  if (k === 'pegs') { const b = new PB(30, 22), W0 = RPK.wood; b.rect(0, 2, 30, 3, W0[3]); b.hl(0, 2, 30, W0[4]); for (const [x, c] of [[4, 'brown'], [14, 'forest'], [24, 'wine']]) { const C = RPK[c]; b.rect(x, 0, 2, 3, W0[1]);
      b.poly([[x - 1, 4], [x + 3, 4], [x + 5, 20], [x - 3, 20]], 0, (xx, y) => C[xx < x ? 3 : xx > x + 2 ? 1 : 2]); b.hl(x - 3, 20, 9, C[1]); b.rect(x, 4, 2, 2, C[3]); } b.outline(OUTL); return b; }
  if (k === 'stars') { const b = new PB(22, 28), N = RPK.navy, Gd = RPK.gmetal; b.rect(0, 0, 22, 2, RPK.dwood[3]); for (let y = 2; y < 25; y++) for (let x = 2; x < 20; x++) b.set(x, y, N[y < 6 ? 3 : 2]);
      for (let x = 2; x < 20; x++) { const d = Math.abs((x - 2) % 6 - 2.5); if (d < 2) b.set(x, 25, N[2]); if (d < 1) b.set(x, 26, N[2]); }
      b.ell(14, 9, 3.2, 3.2, 0, () => Gd[4]); b.ell(15.5, 8, 2.6, 2.6, 0, () => N[2]); for (const [x, y] of [[5, 6], [8, 14], [5, 19], [12, 18], [16, 21], [10, 6], [17, 14]]) { b.set(x, y, Gd[5]); if ((x + y) % 2) { b.set(x - 1, y, Gd[3]); b.set(x + 1, y, Gd[3]); } } b.outline(OUTL); return b; }
  const b = new PB(24, 20), Gd = RPK.gmetal; for (let y = 0; y < 20; y++) for (let x = 0; x < 24; x++) { const e = Math.min(x, y, 23 - x, 19 - y); if (e < 2) b.set(x, y, e === 0 ? Gd[2] : (x + y) % 3 ? Gd[3] : Gd[4]); }
  const I = (x, y, c) => { if (x >= 2 && x < 22 && y >= 2 && y < 18) b.set(x, y, c); };
  if (k === 'land' || k === 'hunt') { for (let y = 2; y < 18; y++) for (let x = 2; x < 22; x++) I(x, y, y < 9 ? hx(y < 5 ? '#7ab0e0' : '#a8d0ea') : RPK.grass[y < 12 ? 4 : 3]);
    for (let x = 2; x < 22; x++) { const hgt = 9 + Math.round(Math.sin(x * 0.45) * 1.6); for (let y = hgt; y < 12; y++) I(x, y, RPK.forest[3]); }
    if (k === 'land') { b.rect(13, 5, 5, 5, RPK.stone[4]); b.rect(14, 3, 2, 3, RPK.stone[4]); b.set(14, 2, RPK.red[3]); b.rect(15, 8, 1, 2, DK2); for (let x = 3; x < 12; x++) I(x, 14 + Math.round(Math.sin(x) * 0.6), RPK.water[4]); }
    else { const D = RPK.brown; b.rect(6, 11, 6, 3, D[3]); b.set(5, 10, D[3]); b.set(4, 10, D[3]); b.set(5, 9, D[2]); b.set(6, 8, D[2]); b.set(7, 9, D[2]); for (const x of [6, 7, 10, 11]) I(x, 14, D[2]); I(6, 15, D[1]); I(11, 15, D[1]);
      for (const hx0 of [15, 19]) { I(hx0, 13, RPK.ivory[4]); I(hx0 + 1, 13, RPK.ivory[4]); I(hx0 - 1, 12, RPK.ivory[4]); I(hx0, 14, RPK.ivory[3]); I(hx0 + 1, 14, RPK.ivory[3]); I(hx0 + 2, 12, RPK.ivory[3]); } } }
  else if (k === 'sea') { for (let y = 2; y < 18; y++) for (let x = 2; x < 22; x++) I(x, y, y < 11 ? hx(y < 6 ? '#e0b070' : '#f0d0a0') : RPK.water[(x + y) % 4 ? 3 : 4]);
    b.ell(16, 7, 2, 2, 0, () => hx('#fff2c0')); b.poly([[5, 12], [16, 12], [14, 14], [7, 14]], 0, () => RPK.wood[2]); b.vl(10, 4, 8, RPK.wood[1]); b.poly([[10, 4], [15, 10], [10, 10]], 0, () => RPK.ivory[4]); b.poly([[10, 5], [6, 10], [10, 10]], 0, () => RPK.ivory[3]); b.set(10, 3, RPK.red[4]); }
  else if (k === 'flowers') { for (let y = 2; y < 18; y++) for (let x = 2; x < 22; x++) I(x, y, RPK.wine[y < 10 ? 1 : 2]); b.rect(9, 12, 6, 5, RPK.gmetal[3]); b.rect(10, 11, 4, 1, RPK.gmetal[4]); b.hl(8, 16, 8, RPK.dwood[3]);
    for (const [x, y, c] of [[9, 6, 'red'], [13, 5, 'ivory'], [16, 8, 'pink'], [7, 9, 'gold'], [12, 8, 'red'], [15, 4, 'gold'], [10, 3, 'pink']]) { b.set(x, y, RPK[c][4]); b.set(x + 1, y, RPK[c][3]); b.set(x, y + 1, RPK[c][3]); b.line(x, y + 2, 12, 11, RPK.leaf[4]); } }
  else if (k === 'saint') { for (let y = 2; y < 18; y++) for (let x = 2; x < 22; x++) I(x, y, Gd[y < 10 ? 4 : 3]); b.ell(12, 7, 4.5, 4.5, 0, () => Gd[5]); b.ell(12, 7.5, 2.2, 2.6, 0, () => RPK.skin1[3]); b.poly([[7, 18], [9, 11], [15, 11], [17, 18]], 0, (x) => RPK.blue[x < 12 ? 3 : 2]); b.set(11, 7, DK2); b.set(13, 7, DK2); b.hl(10, 5, 5, RPK.h_brown[2]); }
  b.outline(OUTL); return b; };
// a rose bush in bloom (o.col: red | pink | ivory)
OBJP.rosebush = function (o) { const b = new PB(22, 20), L0 = RPK.leaf, F = RPK[o.col || 'red'] || RPK.red;
  b.ell(11, 11, 9.5, 7.5, 0, (x, y) => { const n = hsh(x, y, 7); return L0[y < 8 ? (n > 0.5 ? 5 : 4) : y > 14 ? 2 : 3]; });
  for (let k = 0; k < 13; k++) { const x = 3 + Math.floor(hsh(k, 3, 11) * 16), y = 5 + Math.floor(hsh(k, 9, 13) * 10); b.set(x, y, F[3]); b.set(x + 1, y, F[4]); if (hsh(k, 1, 5) > 0.5) b.set(x, y + 1, F[2]); }
  b.rect(10, 17, 2, 3, RPK.wood[2]); b.outline(OUTL); return b; };
// a painter's easel with a canvas under way
OBJP.easel = function () { const b = new PB(20, 34), W0 = RPK.wood; b.line(4, 33, 9, 2, W0[2]); b.line(15, 33, 10, 2, W0[2]); b.line(10, 4, 10, 33, W0[1]);
  b.rect(2, 8, 16, 14, RPK.parch[4]); b.rect(3, 9, 14, 12, RPK.parch[3]); b.ell(10, 13, 3, 3, 0, () => RPK.brown[3]); b.rect(6, 16, 8, 5, RPK.red[2]); b.set(9, 12, RPK.gold[4]); b.set(11, 12, RPK.gold[4]); b.rect(1, 22, 18, 2, W0[3]); b.outline(OUTL); return b; };
