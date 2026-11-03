'use strict';
// ===== SEASONS (v3.5): the year in the castle, the forest and the villages — thaw and blossom, summer, three autumns, snow or the mild winter of the south =====
// The look of an outdoor place (seaVarOf): '' summer · 'th' thaw · 'sp' blossom · 'au1' 'au2' 'au3' early, full and late autumn · 'w' snow · 'wm' mild winter.
// The bare ground of an outdoor place is kept (L.gnd); when the look changes, bakeLoc repaints the season over it: grass, paths, ice, walls, roofs.
// Outdoor sprites are recoloured per look (objSprite → key + SEAV): leaves turn, deciduous trees go bare, snow lies on roofs and tops, icicles hang.
let SEAV = '', SEA_PB = null;
const SEA_SNOW = ['#6a7a96', '#8898b2', '#a6b6ca', '#c2cede', '#d8e2ec', '#eaf0f6', '#f8fbff'].map(hx);
const SEA_ICE = ['#3e6282', '#5a82a2', '#7ea4c0', '#a2c2d8', '#c4dcea', '#e2eef6'].map(hx);
const SEA_R = {
  sp: ['#10341c', '#1c5226', '#2c7430', '#4a983a', '#70b846', '#9cd45c', '#c6ec80'],
  au1: ['#183218', '#2a4c20', '#466828', '#688632', '#8ca23e', '#acb850', '#ccce6c'],
  au2: ['#262a14', '#42441c', '#626024', '#847c2e', '#a2943a', '#bcac4c', '#d6c46a'],
  au3: ['#28221a', '#403422', '#5a4a2c', '#746036', '#8c7642', '#a48c54', '#bca468'],
  wm: ['#1c2818', '#2e3e20', '#465828', '#607032', '#7a883e', '#94a050', '#aeb868'],
  young: ['#12301a', '#1e4a22', '#2e6a2a', '#4a9032', '#70b23e', '#98cc52', '#c0e478'],
  au1g: ['#10261a', '#1e4024', '#30602a', '#4c7e30', '#6a9a3a', '#8cb04a', '#b0c864'],
  gold: ['#2c1e08', '#54380e', '#7e5a14', '#a8801e', '#cc9e2c', '#e6bc44', '#f6d870'],
  orng: ['#2c1208', '#56240c', '#843c12', '#b0581a', '#d07a28', '#e89c3e', '#f6be62'],
  red: ['#260a0c', '#4a1414', '#741e1a', '#9e2e22', '#c2462c', '#da6a3c', '#ec9058'],
  olive: ['#1c2410', '#2e3a16', '#46521e', '#5e6a26', '#7a8432', '#969c42', '#b0b25a'],
  dry: ['#2a2016', '#3e3020', '#54422a', '#6a5434', '#80683e', '#987e4c', '#b0965e'],
  pined: ['#061418', '#0c2422', '#14382c', '#1c4a36', '#2a5e42', '#3c724e', '#4c8058'] };
for (const k in SEA_R) SEA_R[k] = SEA_R[k].map(hx);
const lumP = c => ((c & 255) * 0.299 + ((c >>> 8) & 255) * 0.587 + ((c >>> 16) & 255) * 0.114) / 255;
const isGreen = c => { const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255; return g > r + 4 && g >= b; };
const rampAt = (R, l, lo, hi) => R[clamp(Math.round((l - lo) / (hi - lo) * (R.length - 1)), 0, R.length - 1)];
const SEA_NAME = { '': 'лето', th: 'оттепель', sp: 'цветение', au1: 'ранняя осень', au2: 'золотая осень', au3: 'поздняя осень', w: 'зима', wm: 'мягкая зима' };
// ---------- the look of a place from the day of the year and its climate (WD.temp: 0 north … 1 south) ----------
function seaVar(day, tmp) {
  const d = ((day % DAYS_YEAR) + DAYS_YEAR) % DAYS_YEAR, cold = tmp < 0.34, warm = tmp > 0.7;
  if (d < 21) { if (!warm && d < (cold ? 8 : 4)) return 'th'; return d < (warm ? 11 : cold ? 16 : 14) ? 'sp' : ''; }
  if (d < 42) return '';
  if (d < 63) { if (cold) return d < 47 ? 'au1' : d < 53 ? 'au2' : d < 58 ? 'au3' : 'w'; if (warm) return d < 53 ? 'au1' : 'au2'; return d < 49 ? 'au1' : d < 57 ? 'au2' : 'au3'; }
  return warm ? 'wm' : 'w';
}
function placeTemp(L) { let s = null; try { s = L.site === 'v' && G.visit ? WD.setts[G.visit.sid] : WD.setts[G.realms[0].capital]; } catch (_) { } return s && WD.temp ? WD.temp[s.y * MW + s.x] : 0.5; }
function seaVarOf(L) { if (!L || !L.out || !G || G.day === undefined) return ''; if (L.tmp === undefined) L.tmp = placeTemp(L); return seaVar(G.day, L.tmp); }
function seaCropStage(k, day) { const d = ((day % DAYS_YEAR) + DAYS_YEAR) % DAYS_YEAR; if (k === 'vine') return d < 6 ? 3 : d < 21 ? 0 : d < 42 ? 1 : d < 57 ? 2 : 3; return d < 7 ? 3 : d < 21 ? 0 : d < 36 ? 1 : d < 49 ? 2 : 3; }
function seaKeyOf(L) { return L && L.out ? seaVarOf(L) + '/' + seaCropStage('crops', G.day) + seaCropStage('vine', G.day) : ''; }
function seaObjOpt(o) { if (o.k !== 'crops' && o.k !== 'vine') return o.o; const st = seaCropStage(o.k, G.day); return o.o.s === st ? o.o : Object.assign({}, o.o, { s: st, ck: (o.o.ck || '') + '~' + st }); }
// ---------- ground ----------
function seaSnowC(l, x, y, s) { let i = Math.round(3.6 + (l - 0.45) * 4.5 + (fbm(x, y, 9, s + 3) - 0.5) * 2.2); if (hsh(x, y, s + 9) < 0.006) i = 6; return SEA_SNOW[clamp(i, 0, 6)]; }
function seaGrass(c, x, y, s, sv, R) {
  const l = lumP(c), green = isGreen(c);
  if (sv === 'w') return seaSnowC(l, x, y, s);
  if (sv === 'th') { if (fbm(x, y, 22, s + 5) > 0.56) return seaSnowC(l, x, y, s); return green ? rampAt(SEA_R.wm, l, 0.15, 0.8) : cmix(c, SEA_R.dry[3], 0.6); }
  if (!green) return sv === 'sp' || sv === 'au1' ? c : cmix(c, SEA_R.dry[3], sv === 'au2' ? 0.5 : 0.7);
  const n = vnz(x, y, 40, s + 71);
  if (sv === 'au1') return n > 0.55 ? rampAt(R, l, 0.15, 0.8) : c;
  if (sv === 'au2' && n > 0.62) return rampAt(SEA_R.au1, l, 0.15, 0.8);
  if (sv === 'au3' && n > 0.62) return rampAt(SEA_R.au2, l, 0.15, 0.8);
  return rampAt(R, l, 0.15, 0.8);
}
function seaDirt(c, x, y, s, sv, t) {
  if (sv === 'w') { if (t !== GT.DIRT || fbm(x, y, 7, s + 44) > 0.43) return seaSnowC(lumP(c) - 0.06, x, y, s); return cmix(cmul(c, 0.78), hx('#6a7488'), 0.35); } // a trodden path: slush in the ruts
  if (sv === 'th' || sv === 'wm') { if (t === GT.SAND) return c; const m = cmul(cmix(c, hx('#3a2a1c'), 0.3), 0.92); return sv === 'th' && fbm(x, y, 11, s + 31) > 0.68 ? cmix(m, hx('#5a6a7c'), 0.45) : m; } // mud and puddles
  if (sv === 'au3') { if (t === GT.SAND) return cmul(c, 0.9); const m = cmul(cmix(c, hx('#3a2a1c'), 0.24), 0.9); return fbm(x, y, 11, s + 31) > 0.7 ? cmix(m, hx('#56606c'), 0.4) : m; } // late autumn: wet, dark, puddles
  return sv === 'au2' ? cmul(c, 0.94) : c;
}
function seaStone(c, x, y, s, sv) { const l = lumP(c); if (sv === 'th') return fbm(x, y, 16, s + 8) > 0.6 && l > 0.3 ? seaSnowC(l, x, y, s) : cmul(c, 0.9);
  if (fbm(x, y, 18, s + 12) > 0.6) return l > 0.3 ? cmix(c, hx('#9aa6bc'), 0.3) : cmix(c, hx('#3a4458'), 0.3); // swept patches: wet cold stone
  return l > 0.3 ? seaSnowC(l, x, y, s) : cmix(c, SEA_SNOW[1], 0.5); }
function seaIce(c, x, y, s) { const l = lumP(c), w = worley(x, y, 22, 16, s + 3, 0.9); if (w[1] - w[0] < 0.05) return SEA_ICE[1]; if (fbm(x, y, 13, s + 9) > 0.64) return SEA_SNOW[clamp(Math.round(4 + (l - 0.4) * 3), 3, 6)]; return SEA_ICE[clamp(Math.round(2 + (l - 0.35) * 5), 1, 5)]; }
function seaShore(gid, W0, H0, x, y) { for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, 4], [4, -4], [-4, -4]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W0 && yy < H0 && gid[yy * W0 + xx] !== GT.WATER) return true; } return false; }
function seaGround(b, L, sv) {
  const W0 = b.w, H0 = b.h, d = b.d, gid = L.gid, s = (L.seed | 0) + 17, T = GT, R = SEA_R[sv]; if (!gid) return;
  const coast = L.id === 'v_out' && typeof VMAP !== 'undefined' && VMAP && VMAP.env && VMAP.env.coast;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) { const i = y * W0 + x, t = gid[i], c = d[i]; if (!c) continue;
    if (t === T.GRASS) d[i] = seaGrass(c, x, y, s, sv, R);
    else if (t === T.DIRT || t === T.SAND || t === T.SOIL) d[i] = seaDirt(c, x, y, s, sv, t);
    else if (t === T.COBBLE || t === T.FLAG || t === T.FLAGD) { if (sv === 'w' || sv === 'th') d[i] = seaStone(c, x, y, s, sv); }
    else if (t === T.WATER && sv === 'w' && (!coast || seaShore(gid, W0, H0, x, y))) d[i] = seaIce(c, x, y, s); }
  const put = (x, y, c) => { x |= 0; y |= 0; if (x < 1 || y < 1 || x >= W0 - 1 || y >= H0 - 1) return; const t = gid[y * W0 + x]; if (t === T.GRASS || t === T.DIRT || t === T.SOIL) b.put(x, y, c); };
  if (sv === 'sp') { const FL = ['#f8f4ee', '#f6d84c', '#9ab8f0', '#f0a0b8', '#ffffff'].map(hx); // spring flowers
    for (let cy = 2; cy < H0 - 3; cy += 6) for (let cx = 2; cx < W0 - 3; cx += 6) { const h = hsh(cx, cy, s + 61); if (h > 0.07) continue; const x = cx + (hsh(cx, cy, s + 62) * 6 | 0), y = cy + (hsh(cx, cy, s + 63) * 6 | 0); if (gid[y * W0 + x] !== T.GRASS) continue;
      const fc = FL[(hsh(x, y, s + 64) * FL.length) | 0]; b.put(x, y, fc); b.put(x, y + 1, SEA_R.sp[2]); if (h < 0.025) { b.put(x + 2, y + 1, fc); b.put(x + 2, y + 2, SEA_R.sp[2]); } } }
  if (sv === 'au1' || sv === 'au2' || sv === 'au3') { // fallen leaves: thick under the trees, scattered over the grass
    const n = sv === 'au1' ? 10 : sv === 'au2' ? 34 : 46, P = sv === 'au3' ? [SEA_R.dry[4], SEA_R.dry[3], SEA_R.orng[3], SEA_R.dry[5]] : sv === 'au2' ? [SEA_R.gold[4], SEA_R.orng[4], SEA_R.red[4], SEA_R.gold[5], SEA_R.orng[3]] : [SEA_R.gold[4], SEA_R.gold[5], SEA_R.olive[5]];
    for (const o of L.objs) { if (o.k !== 'oak' && o.k !== 'fruit') continue; const cx = o.x + o.w / 2, cy = o.sy - 4, R0 = o.w * 0.75;
      for (let k = 0; k < n; k++) { const a = hsh(k, o.x, s) * 6.283, r = Math.sqrt(hsh(k, o.y, s + 1)) * R0, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.55 + 4, col = P[(hsh(k, 3, o.x + s) * P.length) | 0]; put(x, y, col); if (hsh(k, 4, o.y) < 0.5) put(x + 1, y, cmul(col, 0.85)); } }
    if (sv !== 'au1') for (let cy = 0; cy < H0; cy += 7) for (let cx = 0; cx < W0; cx += 7) { if (hsh(cx, cy, s + 81) > (sv === 'au3' ? 0.12 : 0.07)) continue; const x = cx + (hsh(cx, cy, s + 82) * 7 | 0), y = cy + (hsh(cx, cy, s + 83) * 7 | 0); put(x, y, P[(hsh(x, y, s) * P.length) | 0]); } }
}
// curtain walls (painted into the ground layer): snow on the wall-walks, a lip and icicles on the faces
function seaCurtain(b, L, sv) {
  if (sv !== 'w' && sv !== 'th') return; const w = L.w, h = L.h, ter = L.ter, s = L.seed | 0, IC = ['#e6f2fa', '#c2dcee', '#a4c6e0'].map(hx);
  const at = (tx, ty) => tx < 0 || ty < 0 || tx >= w || ty >= h ? -1 : ter[ty * w + tx], isW = (tx, ty) => at(tx, ty) === GT.CWALL, isF = (tx, ty) => { const t = at(tx, ty); return t > 0 && t !== GT.CWALL; };
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) { if (!isW(tx, ty)) continue; const face = isF(tx, ty + 1) ? 2 : (isW(tx, ty + 1) && isF(tx, ty + 2)) ? 1 : 0, X = tx * CT, Y = ty * CT;
    if (!face) { for (let y = 0; y < CT; y++) for (let x = 0; x < CT; x++) { const gx = X + x, gy = Y + y, c = b.get(gx, gy); if (!c || (sv === 'th' && fbm(gx, gy, 10, s + 5) < 0.55)) continue; b.put(gx, gy, seaSnowC(lumP(c), gx, gy, s)); } }
    else if (face === 1) { for (let x = 0; x < CT; x++) { b.put(X + x, Y, SEA_SNOW[6]); if (sv === 'w') b.put(X + x, Y + 1, SEA_SNOW[4]); }
      if (sv === 'w') for (let x = 0; x < CT; x++) if (hsh(X + x, Y, s + 7) < 0.18) { const n = 1 + (hsh(X + x, Y, s + 8) * 3 | 0); for (let y = 0; y < n; y++) b.put(X + x, Y + 2 + y, IC[y]); } } }
}
// ---------- sprites ----------
function pbCopy(a) { const b = new PB(a.w, a.h); b.d.set(a.d); b.rm = a.rm; b.meta = a.meta; return b; }
function seaRoofs(b, sv) { const m = b.rm; if (!m) return; const w = b.w, h = b.h, d = b.d, IC = ['#e6f2fa', '#c2dcee', '#a4c6e0'].map(hx);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!m[i] || !d[i]) continue; const eave = y + 1 >= h || !m[i + w];
    if (sv === 'th' && fbm(x, y, 7, 5) < 0.55) continue;
    if (eave) { if (sv === 'w' && hsh(x, y, 11) < 0.22) { const n = 1 + (hsh(x, y, 12) * 3 | 0); for (let k = 0; k < n && y + 1 + k < h; k++) { const j = i + w * (k + 1); if (d[j] && !m[j]) d[j] = IC[k]; } } continue; }
    d[i] = seaSnowC(lumP(d[i]) + 0.05, x, y, 3); } }
function seaCap(b, th, p) { // snow on every top edge; the outline stays above it
  const w = b.w, h = b.h, d = b.d, src = d.slice(), op = i => (src[i] >>> 24) > 100;
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const i = y * w + x; if (!op(i) || (y > 0 && op(i - w))) continue; if (p < 1 && hsh(x, y, 21) > p) continue;
    let yy = y; if (src[i] === OUTL || src[i] === OUTL2 || lumP(src[i]) < 0.12) yy++;
    const t = th - (hsh(x, y, 22) < 0.3 ? 1 : 0); for (let k = 0; k < t; k++, yy++) { if (yy >= h) break; const j = yy * w + x; if (!op(j)) break; d[j] = SEA_SNOW[k === 0 ? 6 : k === 1 ? 5 : 4]; } } }
function seaGreens(b, f) { const d = b.d, w = b.w; for (let i = 0; i < d.length; i++) { const c = d[i]; if (!c || (c >>> 24) < 100 || !isGreen(c)) continue; d[i] = f(c, i % w, (i / w) | 0, lumP(c)); } }
function seaIvy(b, sv) { if (sv === 'au1' || sv === 'au2') seaGreens(b, (c, x, y, l) => rampAt(vnz(x, y, 5, 9) < 0.5 ? SEA_R.red : SEA_R.orng, l, 0.08, 0.68)); else if (sv !== 'sp') seaGreens(b, (c, x, y, l) => rampAt(SEA_R.dry, l, 0.08, 0.68)); }
function seaStruct(b, sv) { if (sv === 'w' || sv === 'th') { seaRoofs(b, sv); seaCap(b, sv === 'w' ? (b.h > 40 ? 3 : 2) : 1, sv === 'th' ? 0.45 : 1); } if (sv && sv !== 'sp') seaIvy(b, sv); return b; }
function seaLeaves(b, sv, s, k, o) {
  seaGreens(b, (c, x, y, l) => { let R; const n = vnz(x, y, 6, s + 5);
    if (sv === 'sp') R = SEA_R.young; else if (sv === 'au1') R = n < 0.34 ? SEA_R.gold : n < 0.44 ? SEA_R.olive : SEA_R.au1g; else R = n < 0.28 ? SEA_R.red : n < 0.58 ? SEA_R.orng : n < 0.86 ? SEA_R.gold : SEA_R.olive;
    return rampAt(R, l, 0.08, 0.68); });
  if (sv === 'sp' && k === 'fruit') { const BL = ['#fbf4f6', '#f4c8d4', '#e8a4b8'].map(hx), FR = RPK[o.fruit || 'red'] || [], d = b.d, w = b.w; // blossom: the fruit turns to flowers, and more of them
    for (let i = 0; i < d.length; i++) if (FR.includes(d[i])) d[i] = BL[i % 3];
    for (let n = 0; n < 46; n++) { const x = 3 + (hsh(n, 7, s + 3) * (w - 6) | 0), y = 2 + (hsh(n, 8, s + 3) * (b.h * 0.55) | 0), c = b.get(x, y); if (!c || !isGreen(c)) continue; b.put(x, y, BL[n % 3]); if (n % 2) b.put(x + 1, y, BL[(n + 1) % 3]); } } }
function seaBare(k, o, sv) { // a deciduous tree out of leaf: trunk, limbs to where the leaf clusters were, twigs; buds in a thaw, a few last leaves late in autumn, snow on the limbs in winter
  const s = o.seed || (k === 'oak' ? 1 : k === 'fruit' ? 2 : 4); let b, cx, ty, tw, bl;
  if (k === 'oak') { b = new PB(56, 64); cx = 28; ty = 36; tw = 8; bl = [[28, 22, 17], [16, 28, 11], [41, 28, 11], [22, 13, 11], [36, 14, 11], [28, 34, 10]]; for (const p of bl) { p[0] += (hsh(p[0], 1, s) - 0.5) * 4; p[1] += (hsh(p[1], 2, s) - 0.5) * 3; } trunk(b, 28, 34, 62, 8); }
  else if (k === 'fruit') { b = new PB(40, 48); cx = 20; ty = 28; tw = 6; bl = [[20, 17, 12], [11, 21, 8], [29, 21, 8], [20, 9, 8]]; trunk(b, 20, 26, 46, 6); }
  else { b = new PB(24, 20); cx = 12; ty = 18; tw = 3; bl = [[12, 8, 7], [6, 12, 5], [18, 12, 5]]; }
  const W0 = RPK.dwood, tips = [];
  for (const [px, py, r] of bl) { const n = Math.max(1, Math.round(tw / 3)); for (let q = 0; q < n; q++) { const of = q - (n - 1) / 2; b.line(cx + of, ty, px + of * 0.3, py, W0[q === 0 ? 4 : q === n - 1 ? 2 : 3]); }
    const m = 3 + (hsh(px | 0, py | 0, s) * 3 | 0); for (let j = 0; j < m; j++) { const a = -Math.PI / 2 + (hsh(j, px | 0, s + 1) - 0.5) * 2.6, len = r * (0.6 + hsh(j, py | 0, s + 2) * 0.45); tips.push([px + Math.cos(a) * len, py + Math.sin(a) * len * 0.8, px, py]); } }
  b.outline(OUTL);
  const TW = hx('#3a2a24'), TW2 = hx('#4e3a2e');
  for (const [ex, ey, px, py] of tips) { b.line(px, py, ex, ey, TW); const mx = (px + ex) / 2, my = (py + ey) / 2; b.line(mx, my, mx + (ex - px) * 0.35 + 2, my + (ey - py) * 0.2 - 2, TW2); }
  if (sv === 'th') for (const [ex, ey] of tips) if (hsh(ex | 0, ey | 0, s) < 0.6) b.put(ex, ey, hx('#9ccc5a'));
  if (sv === 'au3') { const P = [SEA_R.orng[4], SEA_R.gold[4], SEA_R.dry[4], SEA_R.red[4]]; for (const [ex, ey, px, py] of tips) for (let q = 0; q < 3; q++) { if (hsh(ex | 0, q, s + 9) > 0.45) continue; const t = 0.4 + q * 0.3, x = px + (ex - px) * t, y = py + (ey - py) * t; b.put(x, y, P[q % 4]); b.put(x + 1, y, P[(q + 1) % 4]); } }
  if (sv === 'w') { const src = b.d.slice(), w = b.w; for (let y = 1; y < b.h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!src[i] || src[i - w] || (y > ty + 4 && k !== 'bush')) continue; if (hsh(x, y, s + 4) < 0.72) b.put(x, y - 1, SEA_SNOW[hsh(x, y, s + 5) < 0.5 ? 6 : 5]); } }
  return b; }
function seaPlant(b, sv) { const d = b.d;
  if (sv === 'w') { for (let i = 0; i < d.length; i++) if (d[i] && (d[i] >>> 24) > 100) d[i] = SEA_SNOW[clamp(Math.round(3 + (lumP(d[i]) - 0.3) * 5), 2, 6)]; return; }
  if (sv === 'au2' || sv === 'au3' || sv === 'wm' || sv === 'th') { const k = sv === 'au2' ? 0.55 : 0.8; for (let i = 0; i < d.length; i++) { const c = d[i]; if (!c || (c >>> 24) < 100 || c === OUTL || c === OUTL2) continue; d[i] = cmix(c, rampAt(SEA_R.dry, lumP(c), 0.08, 0.7), k); } } }
const SEA_DECID = { oak: 1, fruit: 1, bush: 1 }, SEA_EVER = { pine: 1, hedge: 1 }, SEA_PLANT = { flowers: 1, herbs: 1, rosebush: 1, crops: 1, vine: 1 };
const SEA_SKIP = { campfire: 1, banner: 1, housebanner: 1, sconce: 1, window: 1, washline: 1, lamppost: 0, sheaf: 0 };
function seaSprite(k, o, base, sv) {
  if (k === 'bush' && (sv === 'th' || sv === 'w' || sv === 'au3')) { // hedge shrubs keep their dead leaves through the winter (like beech and hornbeam)
    const b = pbCopy(base), s = o.seed || 4, d = b.d, w = b.w; for (let i = 0; i < d.length; i++) { const c = d[i]; if (!c || (c >>> 24) < 100 || c === OUTL) continue; const x = i % w, y = (i / w) | 0, l = lumP(c);
      d[i] = isGreen(c) && hsh(x, y, s) < 0.12 ? 0 : rampAt(hsh(x >> 1, y >> 1, s + 1) < 0.3 ? SEA_R.au3 : SEA_R.dry, Math.min(l, 0.62) + (sv === 'au3' ? 0.06 : 0), 0.08, 0.68); } // flowers wither too
    if (sv === 'w') seaCap(b, 2, 1); else if (sv === 'th') seaCap(b, 1, 0.4); return b; }
  if (SEA_DECID[k]) { if (sv === 'th' || sv === 'w' || sv === 'wm' || sv === 'au3') return seaBare(k, o, sv); const b = pbCopy(base); seaLeaves(b, sv, o.seed || 1, k, o); return b; }
  const b = pbCopy(base);
  if (SEA_EVER[k]) { if (sv === 'w' || sv === 'th') { if (k === 'pine') seaGreens(b, (c, x, y, l) => rampAt(SEA_R.pined, l, 0.06, 0.5)); seaCap(b, sv === 'w' ? 2 : 1, sv === 'w' ? 1 : 0.5); if (sv === 'w') { const d = b.d; for (let i = 0; i < d.length; i++) { const c = d[i]; if (c && (c >>> 24) > 100 && c !== OUTL && lumP(c) > 0.2 && hsh(i, 3, 77) < 0.16) d[i] = SEA_SNOW[5]; } } } return b; }
  if (SEA_PLANT[k]) { seaPlant(b, sv); return b; }
  return seaStruct(b, sv); }
{ const os0 = objSprite; objSprite = function (k, o, f) { const sv = SEAV; if (!sv || SEA_SKIP[k] || (sv === 'sp' && !SEA_DECID[k] && !SEA_PLANT[k])) return os0(k, o, f);
    const key = k + '|' + (o.ck || '') + '|' + (f || 0) + '|' + sv; let c = OBJC[key]; if (!c) { const base = os0(k, o, f), b = seaSprite(k, o, base.pb, sv); c = b.canvas(); c.pb = b; OBJC[key] = c; } return c; }; }
// the place is repainted when its look changes; outdoor sprites take the look while it is drawn
{ const cr0 = courtRender; courtRender = function () { const L = curLoc(); if (L && L.out && L.gnd && L.sk !== seaKeyOf(L)) { const t0 = performance.now(); bakeLoc(L); COURT.seaMs = Math.round(performance.now() - t0); } SEAV = L && L.out ? (L.sv || '') : ''; try { cr0(); } finally { SEAV = ''; } }; }
// ---------- the length of the day: long summer evenings, short winter days (only the light; the hours of court life stay) ----------
function seaSolar(h) { if (!G) return h; const d = ((G.day % DAYS_YEAR) + DAYS_YEAR) % DAYS_YEAR + (G.frac || 0), c = Math.cos(2 * Math.PI * (d - 31.5) / DAYS_YEAR), SR = 7 - 0.9 * c, SS = 19.8 + 1.2 * c;
  if (h < SR) return 5 + (h - 5) * (2 / (SR - 5)); if (h < 13.4) return 7 + (h - SR) * (6.4 / (13.4 - SR)); if (h < SS) return 13.4 + (h - 13.4) * (6.4 / (SS - 13.4)); return 19.8 + (h - SS) * (9.2 / (29 - SS)); }
{ const ao0 = ambientOut; ambientOut = h => ao0(seaSolar(h)); }
