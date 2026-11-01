'use strict';
// ===== RENDER: world map art =====
const MAPR = { quarter: null, ready: false, chunks: new Map(), polV: 0 };
const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pack = (r, g, b, a) => (((a === undefined ? 255 : a) << 24) | (b << 16) | (g << 8) | r) >>> 0;
const NSH = 9;
function mkPal(hexes) { return hexes.map(h => { const [r, g, b] = rgbOf(h); const o = new Uint32Array(NSH); for (let s = 0; s < NSH; s++) { const f = 0.76 + s * 0.06; o[s] = pack(clamp(r * f, 0, 255) | 0, clamp(g * f, 0, 255) | 0, clamp(b * f, 0, 255) | 0); } return o; }); }
function vnoise(x, y, s, p) { // p: optional period (lattice cells) for seamless textures
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = p ? ((xi % p) + p) % p : xi, y0 = p ? ((yi % p) + p) % p : yi, x1 = p ? (x0 + 1) % p : xi + 1, y1 = p ? (y0 + 1) % p : yi + 1;
  const a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const TPAL = {
  grassT: mkPal(['#4a8a3c', '#559643', '#61a24a', '#6dae52']), grassW: mkPal(['#6c9a40', '#78a446', '#85ae4e', '#92b856']), grassC: mkPal(['#58885a', '#639262', '#6f9c6c', '#7ba676']),
  steppe: mkPal(['#a2984e', '#aea456', '#bab060', '#c6bb6c']), tundra: mkPal(['#9eaa98', '#aab5a2', '#b6c0ad', '#c4cdb9']),
  forest: mkPal(['#2c5a28', '#33642e', '#3a6e34', '#42783a']), dforest: mkPal(['#20422a', '#264c2e', '#2d5634', '#346038']),
  hills: mkPal(['#66863f', '#729246', '#7e9e4e', '#8aa858']), hillsW: mkPal(['#8a9248', '#969e50', '#a2a858', '#aeb262']), hillsC: mkPal(['#687c52', '#74885a', '#809464', '#8c9e6e']),
  mount: mkPal(['#6e665c', '#7a7166', '#867c70', '#92887a']), peak: mkPal(['#c4ccd6', '#d4dae2', '#e2e7ee', '#f0f3f7']),
  marsh: mkPal(['#465f44', '#4e684a', '#567150', '#5e7a56']), beach: mkPal(['#c8ae76', '#d4ba82', '#dec68e', '#e8d29a']),
  deep: mkPal(['#1a3866', '#1d3f70', '#21477a', '#254f84']), shal: mkPal(['#2a5f92', '#30699c', '#3773a6', '#3f7eb0']), lake: mkPal(['#2c6898', '#3272a2', '#397cac', '#4186b4']),
  crops: [mkPal(['#c4a444', '#d2b452']), mkPal(['#689a42', '#76a84c']), mkPal(['#988a4e', '#a6985a']), mkPal(['#86673f', '#93744a']), mkPal(['#a8a84c', '#b6b658']), mkPal(['#7e9a3e', '#8ca848'])],
};
const C_FOAM = pack(170, 206, 222), C_FOAM2 = pack(120, 168, 200), C_WET = pack(150, 132, 92), C_HEDGE = pack(76, 104, 52), C_WAVE = pack(52, 94, 150);

// ---------- sprite generators ----------
function genTree(kind, sz, v) {
  const rng = mkRng(1000 + v * 31 + sz * 7 + kind.length * 101);
  if (kind === 'pine' || kind === 'snowpine') {
    const w = sz === 0 ? 5 : 7, h = sz === 0 ? 8 : sz === 1 ? 10 : 12;
    const [c, g] = mkCanvas(w, h); const cx = (w - 1) / 2;
    const cols = ['#173a26', '#1f4a2e', '#2a5c36', '#3a7044', '#4c8450'];
    for (let y = 0; y < h - 1; y++) {
      const t = y / (h - 2); const layer = (y % 3) / 3; const hw = Math.max(0, (0.5 + t * (w / 2 - 0.4)) * (0.75 + layer * 0.35));
      for (let x = 0; x < w; x++) {
        const d = x - cx; if (Math.abs(d) > hw) continue;
        let k = 2 + (d < 0 ? 1 : -1) + (Math.abs(d) > hw - 1 ? -1 : 0) + (rng.f() < 0.15 ? 1 : 0);
        if (y === 0) k = 3;
        g.fillStyle = cols[clamp(k, 0, 4)]; g.fillRect(x, y, 1, 1);
        if (kind === 'snowpine' && d <= 0 && (y % 3 === 0 || Math.abs(d) > hw - 1) && rng.f() < 0.7) { g.fillStyle = rng.f() < 0.5 ? '#eef4f6' : '#d0dce4'; g.fillRect(x, y, 1, 1); }
      }
    }
    g.fillStyle = '#4a3020'; g.fillRect(Math.floor(cx), h - 1, 1, 1);
    return c;
  }
  const w = [5, 7, 9][sz], h = [6, 8, 10][sz];
  const [c, g] = mkCanvas(w, h); const cx = (w - 1) / 2, cy = (h - 3) / 2, rx = w / 2, ry = (h - 1.5) / 2;
  const cols = kind === 'birch' ? ['#3c6a2c', '#4e8036', '#64983e', '#7cb04a', '#98c45e'] : v % 3 === 2 ? ['#24481e', '#2e5a26', '#3d7030', '#50883a', '#64a046'] : ['#26501f', '#326426', '#43792f', '#57903a', '#6ea846'];
  g.fillStyle = kind === 'birch' ? '#e8e4d8' : '#4a3020'; g.fillRect(Math.floor(cx), h - 3, 1, 3);
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry; const d = dx * dx + dy * dy + (rng.f() - 0.5) * 0.35;
    if (d > 1) continue;
    const l = -dx * 0.6 - dy * 0.8; let k = 2 + Math.round(l * 1.6) + (rng.f() < 0.2 ? (rng.f() < 0.5 ? 1 : -1) : 0);
    if (d > 0.72 && (dx > 0.1 || dy > 0.2)) k = Math.min(k, 1);
    g.fillStyle = cols[clamp(k, 0, 4)]; g.fillRect(x, y, 1, 1);
  }
  return c;
}
function genMountain(w, h, v, snowy) {
  const rng = mkRng(5000 + v * 97 + w * 13 + (snowy ? 7 : 0));
  const [c, g] = mkCanvas(w, h);
  const peakX = w * (0.38 + rng.f() * 0.24); const sub = rng.f() < 0.6 ? { x: w * (rng.f() < 0.5 ? 0.2 : 0.8), h: h * (0.45 + rng.f() * 0.2) } : null;
  const top = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let t = h - 1 - Math.max(0, (1 - Math.abs(x - peakX) / (w * 0.5)) * (h - 1));
    if (sub) t = Math.min(t, h - 1 - Math.max(0, (1 - Math.abs(x - sub.x) / (w * 0.32)) * sub.h));
    top[x] = t + (rng.f() - 0.5) * 1.2;
  }
  const rs = rng.f() * 0.6 - 0.3;
  const ridge = y => peakX + (y / h) * rs * 2 + Math.sin(y * 0.9 + v) * 0.8;
  const lit = ['#8c8072', '#9e9282', '#b0a392', '#c2b6a4'], drk = ['#4e463e', '#5a5148', '#665c52', '#72685c'];
  const snL = ['#dde4ea', '#eef2f6', '#ffffff'], snD = ['#9aa8b8', '#aebacb', '#c0cad6'];
  const snowLine = snowy ? h * (0.42 + rng.f() * 0.12) : h * (0.16 + rng.f() * 0.08);
  for (let x = 0; x < w; x++) for (let y = Math.max(0, Math.ceil(top[x])); y < h; y++) {
    const rx = ridge(y); const left = x < rx; const n = rng.f();
    const edge = y <= top[x] + 1;
    let col;
    const sl = snowLine + Math.sin(x * 1.7 + v) * 1.5 + (left ? 0 : 1.5);
    if (y < sl) col = left ? snL[n < 0.2 ? 0 : n < 0.8 ? 1 : 2] : snD[n < 0.3 ? 0 : n < 0.85 ? 1 : 2];
    else { const k = clamp(Math.floor(n * 2.2 + (left ? 1.2 : 0.4) - (y / h) * 0.9), 0, 3); col = left ? lit[k] : drk[k]; if ((x + y * 3) % 7 === 0 && n < 0.3) col = left ? lit[0] : drk[0]; }
    if (edge && !left) col = drk[0];
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  return c;
}
function genHill(w, h, pal, v) {
  const rng = mkRng(9000 + v * 17 + w); const [c, g] = mkCanvas(w, h);
  const cx = (w - 1) / 2 + (rng.f() - 0.5) * 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - cx) / (w / 2), dy = (h - 1 - y) / (h - 0.5); const d = dx * dx + dy * dy;
    if (d > 1 || (y === h - 1 && Math.abs(dx) > 0.9)) continue;
    const l = -dx * 0.8 + dy * 0.4; let k = clamp(Math.round(1.5 + l * 1.5 + (rng.f() - 0.5) * 0.6), 0, 3);
    if (d > 0.8 && dx > 0) k = 0;
    g.fillStyle = pal[k]; g.fillRect(x, y, 1, 1);
  }
  return c;
}
function mkSprSmall(rows, pal) { return mkSprite(rows.split('|'), pal); }
const MSPR = {};
function initMapSprites() {
  MSPR.oak = []; MSPR.pine = []; MSPR.spine = []; MSPR.birch = [];
  for (let v = 0; v < 4; v++) for (let s = 0; s < 3; s++) { MSPR.oak.push(genTree('oak', s, v)); MSPR.pine.push(genTree('pine', s, v)); MSPR.spine.push(genTree('snowpine', s, v)); MSPR.birch.push(genTree('birch', s, v)); }
  MSPR.mount = []; MSPR.mountS = []; MSPR.peak = [];
  for (let v = 0; v < 6; v++) { MSPR.mount.push(genMountain(15 + (v % 3) * 2, 10 + (v % 2) * 2, v, false)); MSPR.mountS.push(genMountain(15 + (v % 3) * 2, 11 + (v % 2) * 2, v + 10, true)); MSPR.peak.push(genMountain(20 + (v % 3) * 3, 15 + (v % 2) * 3, v + 20, true)); }
  MSPR.hill = []; MSPR.hillW = []; MSPR.hillC = [];
  const hp = ['#56743a', '#668644', '#789a4e', '#8cac5a'], hpw = ['#7a8040', '#8a9248', '#9ca454', '#aeb462'], hpc = ['#5e7048', '#6e8052', '#80925e', '#92a46a'];
  for (let v = 0; v < 6; v++) { const w = [9, 11, 13, 15, 17, 12][v], h = [4, 5, 5, 6, 7, 5][v]; MSPR.hill.push(genHill(w, h, hp, v)); MSPR.hillW.push(genHill(w, h, hpw, v)); MSPR.hillC.push(genHill(w, h, hpc, v)); }
  MSPR.reed = [mkSprSmall('#.#|#.#|.#.', { '#': '#6a8a3a' }), mkSprSmall('.#.|##.|.#.', { '#': '#7a9a44' }), mkSprSmall('#..#|.##.', { '#': '#5a7a34' })];
  MSPR.pud = [mkSprSmall('.##.|####', { '#': '#3e6a72' }), mkSprSmall('###', { '#': '#46747c' })];
  MSPR.tuft = [mkSprSmall('#.#|.#.', { '#': '#8a8a40' }), mkSprSmall('.#|##', { '#': '#9c9848' })];
  MSPR.rock = [mkSprSmall('.#.|###', { '#': '#8a908c' }), mkSprSmall('##', { '#': '#7a827e' })];
  MSPR.bush = [mkSprSmall('.##.|####', { '#': '#3e6e30' })];
}

// ---------- base map: prepared once, painted lazily in chunks ----------
// The world is too big to paint whole (WPW×WPH px): the overview (1 px = 4 world px) is painted at once,
// full-detail chunks of 256×256 px are painted when the camera looks at them and kept in a small cache.
const CH = 256, CHM = 24, QS = 4, CH_KEEP = 56; // chunk size, margin for sprites, overview scale, chunks kept
const NCX = Math.ceil(WPW / CH), NCY = Math.ceil(WPH / CH);
const C_RIV = pack(52, 110, 168), C_RIVL = pack(78, 140, 196), C_BANK = pack(58, 86, 60), RWID = [0, 0.75, 1.15, 1.7];
const C_RD = pack(160, 128, 84), C_RDE = pack(108, 84, 56), C_TR = pack(170, 146, 102);
const chaikin = (pts, it) => { for (let k = 0; k < it; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2]], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, b[2]]); } o.push(pts[pts.length - 1]); pts = o; } return pts; };
function renderBase(WD) {
  const t0 = performance.now();
  const ter = WD.ter, NZ = mkNoise(mkRng(WD.seed + 99));
  const wf = new Float32Array(NT), shd = new Float32Array(NT), wdep = new Float32Array(NT);
  for (let i = 0; i < NT; i++) wf[i] = TINFO[ter[i]].water ? 1 : -1;
  {
    const q = new Int32Array(NT); let qh = 0, qt = 0; const d = new Uint8Array(NT).fill(255);
    for (let i = 0; i < NT; i++) if (!TINFO[ter[i]].water) { d[i] = 0; q[qt++] = i; }
    while (qh < qt) { const i = q[qh++], x = i % MW; if (d[i] >= 9) continue; for (let k = 0; k < 4; k++) { const j = nb4(i, x, k); if (j >= 0 && d[j] === 255) { d[j] = d[i] + 1; q[qt++] = j; } } }
    for (let i = 0; i < NT; i++) wdep[i] = Math.min(d[i], 9);
  }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x, a = WD.rel[Math.max(0, y - 1) * MW + Math.max(0, x - 1)], b = WD.rel[Math.min(MH - 1, y + 1) * MW + Math.min(MW - 1, x + 1)];
    shd[i] = clamp((a - b) * 9, -1, 1);
  }
  const GW = (WPW >> 2) + 2, GH = (WPH >> 2) + 2, wgx = new Float32Array(GW * GH), wgy = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const k = y * GW + x; wgx[k] = NZ.fbm(x / 9, y / 9, 3) * 7 + NZ.n2(x / 2.2 + 50, y / 2.2) * 1.6; wgy[k] = NZ.fbm(x / 9 + 40, y / 9 + 17, 3) * 7 + NZ.n2(x / 2.2, y / 2.2 + 50) * 1.6; }
  const F = MAPR.F = { WD, ter, wf, shd, wdep, wgx, wgy, GW, GH, NZ };
  const warpAt = (x, y) => { const gx0 = clamp(Math.floor(x / 4), 0, GW - 2), gy0 = clamp(Math.floor(y / 4), 0, GH - 2), k = gy0 * GW + gx0; return [wgx[k], wgy[k]]; };
  const center = t => { const x = (t % MW) * TS + TS / 2, y = ((t / MW) | 0) * TS + TS / 2; const [wx, wy] = warpAt(x, y); return [x - wx * 0.85, y - wy * 0.85]; };
  MAPR.tileCenter = center; MAPR.warpPt = (x, y) => { const [wx, wy] = warpAt(x, y); return [x - wx * 0.85, y - wy * 0.85]; };
  // the tile under a world pixel (same warp as the painter, so clicks hit what is drawn)
  MAPR.pxTile = (px, py) => {
    const gx = px / 4, gy = py / 4, gx0 = clamp(Math.floor(gx), 0, GW - 2), gy0 = clamp(Math.floor(gy), 0, GH - 2), gu = gx - gx0, gv = gy - gy0, k = gy0 * GW + gx0;
    const wx = wgx[k] + (wgx[k + 1] - wgx[k]) * gu + (wgx[k + GW] - wgx[k]) * gv + (wgx[k] - wgx[k + 1] - wgx[k + GW] + wgx[k + GW + 1]) * gu * gv;
    const wy = wgy[k] + (wgy[k + 1] - wgy[k]) * gu + (wgy[k + GW] - wgy[k]) * gv + (wgy[k] - wgy[k + 1] - wgy[k + GW] + wgy[k + GW + 1]) * gu * gv;
    const jx = (hash2(px >> 1, py >> 1, 5) - 0.5) * 5, jy = (hash2(py >> 1, px >> 1, 6) - 0.5) * 5;
    const fx = (px + wx + jx) / TS, fy = (py + wy + jy) / TS; const tx = fx < 0 ? 0 : fx >= MW ? MW - 1 : fx | 0, ty = fy < 0 ? 0 : fy >= MH ? MH - 1 : fy | 0; return ty * MW + tx;
  };
  // rivers & roads as smoothed polylines, indexed by chunk (a chunk paints only what crosses it)
  const NCH = NCX * NCY, idxR = Array.from({ length: NCH }, () => []), idxD = Array.from({ length: NCH }, () => []);
  const index = (arr, P, id, pad) => { for (let i = 0; i < P.length / 3 - 1; i++) { const ax = P[i * 3], ay = P[i * 3 + 1], bx = P[i * 3 + 3], by = P[i * 3 + 4];
    const c0 = clamp(Math.floor((Math.min(ax, bx) - pad) / CH), 0, NCX - 1), c1 = clamp(Math.floor((Math.max(ax, bx) + pad) / CH), 0, NCX - 1), r0 = clamp(Math.floor((Math.min(ay, by) - pad) / CH), 0, NCY - 1), r1 = clamp(Math.floor((Math.max(ay, by) + pad) / CH), 0, NCY - 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) arr[r * NCX + c].push(id, i); } };
  const flat = P => { const a = new Float32Array(P.length * 3); P.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; }); return a; };
  F.rivP = WD.rivers.map((pts, k) => { const P = flat(chaikin(pts.map(t => { const c = center(t); return [c[0], c[1], Math.max(1, WD.river[t] || 1)]; }), 3)); index(idxR, P, k, CHM + 4); return P; });
  F.roadP = []; F.roadL = [];
  for (const lvl of [1, 2]) for (const R0 of WD.roadList) { if (R0.lvl !== lvl) continue; const P = flat(chaikin(R0.p.map(t => { const c = center(t); return [c[0], c[1], 0]; }), 2)); index(idxD, P, F.roadP.length, CHM + 3); F.roadP.push(P); F.roadL.push(lvl); }
  F.idxR = idxR; F.idxD = idxD;
  // little sprites for the overview: mountains and hills at a quarter of their size
  const shrink = s => { const w = Math.max(1, Math.round(s.width / QS)), h = Math.max(1, Math.round(s.height / QS)); const [c, g] = mkCanvas(w, h); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, w, h); return c; };
  if (!MSPR.q) { MSPR.q = {}; for (const k of ['mount', 'mountS', 'peak', 'hill', 'hillW', 'hillC']) MSPR.q[k] = MSPR[k].map(shrink); }
  MAPR.chunks = new Map(); MAPR.queue = []; MAPR.polV = (MAPR.polV || 0) + 1; MAPR.bordQ = null; MAPR.polq = null;
  const t1 = performance.now(); renderOverview(); MAPR.msQ = Math.round(performance.now() - t1);
  MAPR.ready = true; MAPR.ms = Math.round(performance.now() - t0);
}
// the colour of one world pixel; writes the tile into PT[o] and water kind into MK[o] (1 sea, 2 lake)
function shadeRegion(X0, Y0, RW, RH, buf, MK, PT) {
  const F = MAPR.F, WD = F.WD, ter = F.ter, wf = F.wf, wdep = F.wdep, shd = F.shd, wgx = F.wgx, wgy = F.wgy, GW = F.GW, GH = F.GH, NZ = F.NZ, temp = WD.temp;
  const bil = (A, fx, fy) => { fx -= 0.5; fy -= 0.5; let x0 = Math.floor(fx), y0 = Math.floor(fy); const u = fx - x0, v = fy - y0; const x1 = Math.min(MW - 1, Math.max(0, x0 + 1)), y1 = Math.min(MH - 1, Math.max(0, y0 + 1)); x0 = Math.min(MW - 1, Math.max(0, x0)); y0 = Math.min(MH - 1, Math.max(0, y0)); const a = A[y0 * MW + x0], b = A[y0 * MW + x1], c = A[y1 * MW + x0], d = A[y1 * MW + x1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  for (let ry = 0; ry < RH; ry++) {
    const py = Y0 + ry; if (py < 0 || py >= WPH) continue;
    const gy = py / 4, gy0 = Math.min(GH - 2, Math.floor(gy)), gv = gy - gy0;
    for (let rx = 0; rx < RW; rx++) {
      const px = X0 + rx; if (px < 0 || px >= WPW) continue;
      const gx = px / 4, gx0 = Math.min(GW - 2, Math.floor(gx)), gu = gx - gx0, k = gy0 * GW + gx0;
      const wx = wgx[k] + (wgx[k + 1] - wgx[k]) * gu + (wgx[k + GW] - wgx[k]) * gv + (wgx[k] - wgx[k + 1] - wgx[k + GW] + wgx[k + GW + 1]) * gu * gv;
      const wy = wgy[k] + (wgy[k + 1] - wgy[k]) * gu + (wgy[k + GW] - wgy[k]) * gv + (wgy[k] - wgy[k + 1] - wgy[k + GW] + wgy[k + GW + 1]) * gu * gv;
      const jh = hash2(px >> 1, py >> 1, 5), jx = (jh - 0.5) * 5, jy = (hash2(py >> 1, px >> 1, 6) - 0.5) * 5;
      const fx = (px + wx + jx) / TS, fy = (py + wy + jy) / TS;
      const tx = fx < 0 ? 0 : fx >= MW ? MW - 1 : fx | 0, ty = fy < 0 ? 0 : fy >= MH ? MH - 1 : fy | 0; const t = ty * MW + tx;
      const o = ry * RW + rx; PT[o] = t;
      let T = ter[t];
      const n1 = vnoise(px / 5, py / 5, 1), n2 = hash2(px, py, 2);
      const wv = bil(wf, (px + wx * 0.4) / TS, (py + wy * 0.4) / TS) + (n1 - 0.5) * 0.35;
      if (wv > 0) {
        let lake = T === TR.LAKE; if (!TINFO[T].water) { lake = false; for (let d = 0; d < 8; d++) { const j = nb8(tx, ty, d); if (j >= 0 && ter[j] === TR.LAKE) { lake = true; break; } } }
        MK[o] = lake ? 2 : 1;
        const dep = bil(wdep, fx, fy) + (n1 - 0.5) * 1.2 + (n2 - 0.5) * 0.5;
        let col;
        if (lake) col = TPAL.lake[clamp(3 - Math.floor(dep * 1.3), 0, 3)][4];
        else if (dep < 2.2) col = TPAL.shal[clamp(3 - Math.floor(dep * 1.4), 0, 3)][4];
        else col = TPAL.deep[clamp(3 - Math.floor((dep - 2.2) * 0.75), 0, 3)][4];
        if (!lake && dep > 3.2 && hash2(px >> 2, py, 7) < 0.012 && (px & 3) !== 3 && (py & 1)) col = C_WAVE;
        buf[o] = col; continue;
      }
      if (TINFO[T].water) T = T === TR.LAKE ? TR.GRASS : TR.BEACH;
      const s = bil(shd, fx, fy); const tmp = bil(temp, fx, fy) + (n2 - 0.5) * 0.05;
      const sIdx = clamp(Math.round(4 + s * (T === TR.HILLS || T === TR.MOUNT || T === TR.PEAK ? 4.2 : 2.4) + (n2 - 0.5) * 0.9), 0, 8);
      const nIdx = clamp(Math.floor(n1 * 3.2 + n2 * 1.1 - 0.15), 0, 3);
      let pal;
      switch (T) {
        case TR.GRASS: pal = tmp < 0.32 ? TPAL.grassC : tmp > 0.78 ? TPAL.grassW : TPAL.grassT; break;
        case TR.STEPPE: pal = TPAL.steppe; break; case TR.SNOW: pal = TPAL.tundra; break;
        case TR.FOREST: pal = TPAL.forest; break; case TR.DFOREST: pal = TPAL.dforest; break;
        case TR.HILLS: pal = tmp < 0.3 ? TPAL.hillsC : tmp > 0.78 ? TPAL.hillsW : TPAL.hills; break;
        case TR.MOUNT: pal = TPAL.mount; break; case TR.PEAK: pal = TPAL.peak; break;
        case TR.MARSH: pal = TPAL.marsh; break; case TR.BEACH: pal = TPAL.beach; break;
        case TR.FARM: {
          const fxp = px + NZ.n2(px / 23, py / 23) * 3, fyp = py + NZ.n2(px / 23 + 9, py / 23) * 3;
          const cxI = Math.floor(fxp / 9), cyI = Math.floor(fyp / 7); const hsh = hash2(cxI, cyI, 11);
          const lx = fxp - cxI * 9, ly = fyp - cyI * 7;
          if (lx < 1 || ly < 1) { buf[o] = hsh < 0.5 ? C_HEDGE : TPAL.grassT[1][sIdx]; continue; }
          const cp = TPAL.crops[Math.floor(hsh * 6)]; const st = (hsh * 97) % 1 < 0.5 ? (Math.floor(lx) & 1) : (Math.floor(ly) & 1);
          buf[o] = cp[st][clamp(sIdx + (n2 < 0.1 ? -1 : 0), 0, 8)]; continue;
        }
        default: pal = TPAL.grassT;
      }
      buf[o] = pal[nIdx][sIdx];
    }
  }
}
function renderChunk(cx, cy) {
  const t0 = performance.now(), F = MAPR.F, WD = F.WD, ter = F.ter;
  const RW = CH + 2 * CHM, RH = RW, X0 = cx * CH - CHM, Y0 = cy * CH - CHM;
  if (!MAPR.scr) { [MAPR.scr, MAPR.scrg] = mkCanvas(RW, RH); MAPR.scrImg = MAPR.scrg.createImageData(RW, RH); MAPR.scrBuf = new Uint32Array(MAPR.scrImg.data.buffer); MAPR.scrMask = new Uint8Array(RW * RH); MAPR.scrPt = new Int32Array(RW * RH); }
  const buf = MAPR.scrBuf, mask = MAPR.scrMask, PT = MAPR.scrPt, g0 = MAPR.scrg; buf.fill(0); mask.fill(0); PT.fill(-1);
  shadeRegion(X0, Y0, RW, RH, buf, mask, PT);
  // foam on the water's edge, wet sand on the shore
  for (let y = 1; y < RH - 1; y++) for (let x = 1; x < RW - 1; x++) {
    const o = y * RW + x; const m = mask[o]; if (PT[o] < 0) continue;
    if (m) {
      let nl = 0; if (!mask[o - 1]) nl++; if (!mask[o + 1]) nl++; if (!mask[o - RW]) nl++; if (!mask[o + RW]) nl++;
      if (nl) { buf[o] = m === 1 ? C_FOAM : C_FOAM2; continue; }
      if (m === 1 && y > 2 && x > 2 && y < RH - 3 && x < RW - 3) { let n2c = 0; for (let k = -2; k <= 2; k += 4) { if (!mask[o + k]) n2c++; if (!mask[o + k * RW]) n2c++; } if (n2c && ((X0 + x + Y0 + y) & 1)) buf[o] = C_FOAM2; }
    } else if (mask[o - 1] === 1 || mask[o + 1] === 1 || mask[o - RW] === 1 || mask[o + RW] === 1) buf[o] = C_WET;
  }
  const stamp = (x, y, r, col, onlyLand, setMask) => {
    x -= X0; y -= Y0; const r2 = r * r, x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(RW - 1, Math.ceil(x + r)), y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(RH - 1, Math.ceil(y + r));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const dx = xx + 0.5 - x, dy = yy + 0.5 - y; if (dx * dx + dy * dy > r2) continue; const o = yy * RW + xx; if (PT[o] < 0 || (onlyLand && mask[o])) continue; buf[o] = col; if (setMask) mask[o] = 3; }
  };
  const runs = (idx, f) => { for (let k = 0; k < idx.length;) { const id = idx[k], segs = []; while (k < idx.length && idx[k] === id) { segs.push(idx[k + 1]); k += 2; } f(id, segs); } };
  const ci = cy * NCX + cx;
  runs(F.idxR[ci], (id, segs) => { const P = F.rivP[id];
    for (let pass = 0; pass < 2; pass++) for (const i of segs) {
      const ax = P[i * 3], ay = P[i * 3 + 1], aw = P[i * 3 + 2], bx = P[i * 3 + 3], by = P[i * 3 + 4], bw = P[i * 3 + 5], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L * 2));
      for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, w = RWID[Math.round(aw + (bw - aw) * t)];
        if (pass === 0) stamp(x, y, w + 0.9, C_BANK, true); else stamp(x, y, w, w > 1.2 && ((x + y) | 0) % 5 === 0 ? C_RIVL : C_RIV, false, true); }
    } });
  runs(F.idxD[ci], (id, segs) => { const P = F.roadP[id], lvl = F.roadL[id];
    for (let pass = 0; pass < 2; pass++) for (const i of segs) {
      const ax = P[i * 3], ay = P[i * 3 + 1], bx = P[i * 3 + 3], by = P[i * 3 + 4], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L * 1.5));
      for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; const lx = (x | 0) - X0, ly = (y | 0) - Y0; if (lx < 0 || ly < 0 || lx >= RW || ly >= RH) continue; const o = ly * RW + lx; if (mask[o] === 3 || mask[o] === 1 || PT[o] < 0) continue;
        if (lvl === 2) { if (pass === 0) stamp(x, y, 1.25, C_RDE, true); else stamp(x, y, 0.75, C_RD, true); }
        else if (pass === 1 && ((x * 7 + y * 3) | 0) % 4 !== 0) buf[o] = C_TR; }
    } });
  g0.putImageData(MAPR.scrImg, 0, 0);
  const tx0 = Math.max(0, Math.floor(X0 / TS)), tx1 = Math.min(MW - 1, Math.floor((X0 + RW - 1) / TS)), ty0 = Math.max(0, Math.floor(Y0 / TS)), ty1 = Math.min(MH - 1, Math.floor((Y0 + RH - 1) / TS));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const i = ty * MW + tx;
    if (WD.bridge[i]) { const [x, y] = MAPR.tileCenter(i); const X = Math.round(x) - X0, Y = Math.round(y) - Y0; g0.fillStyle = '#3a2a1a'; g0.fillRect(X - 3, Y - 2, 6, 4); g0.fillStyle = '#a07a4a'; g0.fillRect(X - 2, Y - 1, 4, 2); g0.fillStyle = '#c8a070'; g0.fillRect(X - 2, Y - 1, 4, 1); }
    else if (WD.ford[i]) { const [x, y] = MAPR.tileCenter(i); g0.fillStyle = '#c8d8d0'; for (let k = -1; k <= 1; k++) g0.fillRect(Math.round(x) - X0 + k * 2 - 1, Math.round(y) - Y0 + k, 2, 1); } }
  const items = mapItems(WD, tx0, ty0, tx1, ty1, (x, y) => { x = (x | 0) - X0; y = (y | 0) - Y0; if (x < 0 || y < 0 || x >= RW || y >= RH) return false; const o = y * RW + x; return mask[o] === 0 && PT[o] >= 0; });
  for (const it of items) {
    const x = it.x - X0, y = it.y - Y0;
    if (it.sh) { g0.fillStyle = 'rgba(10,20,10,0.28)'; g0.fillRect(x + 1, y + it.s.height - 1, it.s.width, 2); }
    if (it.msh) { g0.fillStyle = 'rgba(20,16,30,0.22)'; g0.fillRect(x + (it.s.width >> 1), y + it.s.height - 2, (it.s.width >> 1) + 2, 3); }
    g0.drawImage(it.s, x, y);
  }
  const [c, g] = mkCanvas(CH, CH); g.drawImage(MAPR.scr, CHM, CHM, CH, CH, 0, 0, CH, CH);
  // province of every pixel (2 px around the chunk too) for the borders
  const PW = CH + 4, P = new Int16Array(PW * PW), pr = WD.prov;
  for (let y = 0; y < PW; y++) for (let x = 0; x < PW; x++) { const o = (y + CHM - 2) * RW + x + CHM - 2, m = mask[o]; P[y * PW + x] = PT[o] < 0 ? -3 : m === 1 || m === 2 ? -2 : pr[PT[o]]; }
  const ch = { cx, cy, c, P, bv: -1, bv2: -1, b1: null, b2: null, ms: performance.now() - t0 };
  MAPR.chunks.set(ci, ch); MAPR.cms = (MAPR.cms || 0) * 0.9 + ch.ms * 0.1; MAPR.nch = (MAPR.nch || 0) + 1;
  if (MAPR.chunks.size > CH_KEEP) for (const k of MAPR.chunks.keys()) { if (MAPR.chunks.size <= CH_KEEP) break; if (!MAPR.seen || !MAPR.seen.has(k)) MAPR.chunks.delete(k); }
  return ch;
}
// trees, mountains, hills, reeds… of the tiles in a rectangle (deterministic: every chunk gets the same ones)
function mapItems(WD, tx0, ty0, tx1, ty1, landAt) {
  const ter = WD.ter, items = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * MW + tx, T = ter[i], tmp = WD.temp[i], bx = tx * TS, by = ty * TS;
    const h0 = hash2(tx, ty, 21);
    if (T === TR.FOREST || T === TR.DFOREST) {
      const n = T === TR.DFOREST ? 5 : 3;
      for (let k = 0; k < n; k++) {
        const x = bx + hash2(tx, ty, 30 + k) * 8, y = by + hash2(tx, ty, 40 + k) * 8; if (!landAt(x, y)) continue; if (WD.road[i] && hash2(tx, ty, 50 + k) < 0.6) continue;
        const cold = tmp < 0.3, conifer = cold || (T === TR.DFOREST && hash2(tx, ty, 60 + k) < 0.45) || hash2(tx, ty, 61 + k) < 0.15;
        const v = Math.floor(hash2(tx, ty, 70 + k) * 4), sz = T === TR.DFOREST ? (hash2(tx, ty, 80 + k) < 0.6 ? 2 : 1) : (hash2(tx, ty, 80 + k) < 0.5 ? 1 : hash2(tx, ty, 81 + k) < 0.5 ? 0 : 2);
        let s; if (conifer) s = (tmp < 0.22 ? MSPR.spine : MSPR.pine)[v * 3 + sz]; else s = (tmp < 0.36 && hash2(tx, ty, 90 + k) < 0.3 ? MSPR.birch : MSPR.oak)[v * 3 + sz];
        items.push({ s, x: Math.round(x - s.width / 2), y: Math.round(y - s.height + 1), b: y, sh: 1 });
      }
    } else if (T === TR.MOUNT || T === TR.PEAK) {
      if (T === TR.MOUNT && h0 < 0.04) continue;
      const v = Math.floor(hash2(tx, ty, 22) * 6); const snowy = T === TR.PEAK || tmp < 0.25 || WD.rel[i] > 0.8;
      const s = T === TR.PEAK ? MSPR.peak[v] : snowy ? MSPR.mountS[v] : MSPR.mount[v];
      const x = bx + 4 + (hash2(tx, ty, 23) - 0.5) * 5, y = by + 7 + (hash2(tx, ty, 24) - 0.5) * 3;
      items.push({ s, x: Math.round(x - s.width / 2), y: Math.round(y - s.height), b: y, msh: 1 });
    } else if (T === TR.HILLS) {
      if (h0 < 0.4) continue;
      const v = Math.floor(hash2(tx, ty, 25) * 6); const s = (tmp < 0.3 ? MSPR.hillC : tmp > 0.78 ? MSPR.hillW : MSPR.hill)[v];
      const x = bx + 4 + (hash2(tx, ty, 26) - 0.5) * 4, y = by + 6 + (hash2(tx, ty, 27) - 0.5) * 4; if (!landAt(x, y)) continue;
      items.push({ s, x: Math.round(x - s.width / 2), y: Math.round(y - s.height), b: y });
      if (hash2(tx, ty, 28) < 0.25) { const t2 = MSPR.oak[Math.floor(hash2(tx, ty, 29) * 4) * 3]; items.push({ s: t2, x: Math.round(x + 3), y: Math.round(y - 6), b: y + 0.5, sh: 1 }); }
    } else if (T === TR.MARSH) {
      for (let k = 0; k < 3; k++) { const x = bx + hash2(tx, ty, 31 + k) * 7, y = by + hash2(tx, ty, 41 + k) * 7; if (!landAt(x, y)) continue; const s = k === 0 && h0 < 0.6 ? MSPR.pud[Math.floor(hash2(tx, ty, 9) * 2)] : MSPR.reed[Math.floor(hash2(tx, ty, 51 + k) * 3)]; items.push({ s, x: x | 0, y: y | 0, b: y }); }
    } else if (T === TR.STEPPE) {
      if (h0 < 0.5) { const x = bx + hash2(tx, ty, 32) * 7, y = by + hash2(tx, ty, 42) * 7; if (landAt(x, y)) items.push({ s: MSPR.tuft[h0 < 0.25 ? 0 : 1], x: x | 0, y: y | 0, b: y }); }
    } else if (T === TR.SNOW) {
      if (h0 < 0.35) { const x = bx + hash2(tx, ty, 33) * 7, y = by + hash2(tx, ty, 43) * 7; if (landAt(x, y)) items.push({ s: h0 < 0.12 ? MSPR.spine[Math.floor(hash2(tx, ty, 34) * 4) * 3] : MSPR.rock[h0 < 0.22 ? 0 : 1], x: x | 0, y: y | 0, b: y, sh: h0 < 0.12 }); }
    } else if (T === TR.GRASS) {
      if (h0 < 0.06 && !WD.road[i]) { const x = bx + hash2(tx, ty, 35) * 7, y = by + hash2(tx, ty, 45) * 7; if (landAt(x, y)) { const s = MSPR.oak[Math.floor(hash2(tx, ty, 36) * 4) * 3 + 1]; items.push({ s, x: Math.round(x - s.width / 2), y: Math.round(y - s.height), b: y, sh: 1 }); } }
      else if (h0 < 0.12) { const x = bx + hash2(tx, ty, 37) * 7, y = by + hash2(tx, ty, 47) * 7; if (landAt(x, y)) items.push({ s: MSPR.bush[0], x: x | 0, y: y | 0, b: y }); }
    }
  }
  items.sort((a, b) => a.b - b.b);
  return items;
}
// the overview map (1 px = 4 world px): painted at once, a lighter recipe with the same colours, coasts and rivers
function renderOverview() {
  const F = MAPR.F, WD = F.WD, ter = F.ter, wf = F.wf, wdep = F.wdep, shd = F.shd, wgx = F.wgx, wgy = F.wgy, GW = F.GW, NZ = F.NZ, temp = WD.temp;
  const QW = Math.ceil(WPW / QS), QH = Math.ceil(WPH / QS); const [c, g] = mkCanvas(QW, QH); const img = g.createImageData(QW, QH); const b = new Uint32Array(img.data.buffer);
  const qm = new Uint8Array(QW * QH), qt = new Int32Array(QW * QH);
  const bil = (A, fx, fy) => { fx -= 0.5; fy -= 0.5; let x0 = Math.floor(fx), y0 = Math.floor(fy); const u = fx - x0, v = fy - y0; const x1 = Math.min(MW - 1, Math.max(0, x0 + 1)), y1 = Math.min(MH - 1, Math.max(0, y0 + 1)); x0 = Math.min(MW - 1, Math.max(0, x0)); y0 = Math.min(MH - 1, Math.max(0, y0)); const a = A[y0 * MW + x0], bb = A[y0 * MW + x1], cc = A[y1 * MW + x0], d = A[y1 * MW + x1]; return a + (bb - a) * u + (cc - a) * v + (a - bb - cc + d) * u * v; };
  const CAN = { oak: [pack(50, 100, 38), pack(87, 144, 58), pack(36, 72, 30)], pine: [pack(31, 74, 46), pack(58, 112, 68), pack(23, 58, 38)], snow: [pack(60, 96, 74), pack(226, 234, 238), pack(31, 74, 46)], reed: [pack(106, 138, 58), pack(62, 106, 114)] };
  for (let qy = 0; qy < QH; qy++) for (let qx = 0; qx < QW; qx++) {
    const px = qx * QS + 2, py = qy * QS + 2, o = qy * QW + qx;
    const gx0 = (px >> 2), gy0 = (py >> 2), gu = (px & 3) / 4, gv = (py & 3) / 4, k = gy0 * GW + gx0;
    const wx = wgx[k] + (wgx[k + 1] - wgx[k]) * gu + (wgx[k + GW] - wgx[k]) * gv + (wgx[k] - wgx[k + 1] - wgx[k + GW] + wgx[k + GW + 1]) * gu * gv;
    const wy = wgy[k] + (wgy[k + 1] - wgy[k]) * gu + (wgy[k + GW] - wgy[k]) * gv + (wgy[k] - wgy[k + 1] - wgy[k + GW] + wgy[k + GW + 1]) * gu * gv;
    const fx = (px + wx) / TS, fy = (py + wy) / TS, tx = clamp(fx | 0, 0, MW - 1), ty = clamp(fy | 0, 0, MH - 1), t = ty * MW + tx; qt[o] = t;
    let T = ter[t]; const n1 = vnoise(px / 5, py / 5, 1), h = hash2(qx, qy, 3);
    const wv = bil(wf, (px + wx * 0.4) / TS, (py + wy * 0.4) / TS) + (n1 - 0.5) * 0.35;
    if (wv > 0) {
      let lake = T === TR.LAKE; if (!TINFO[T].water) { lake = false; for (let d = 0; d < 8; d++) { const j = nb8(tx, ty, d); if (j >= 0 && ter[j] === TR.LAKE) { lake = true; break; } } }
      qm[o] = lake ? 2 : 1; const dep = bil(wdep, fx, fy) + (n1 - 0.5) * 1.2;
      b[o] = lake ? TPAL.lake[clamp(3 - Math.floor(dep * 1.3), 0, 3)][4] : dep < 2.2 ? TPAL.shal[clamp(3 - Math.floor(dep * 1.4), 0, 3)][4] : TPAL.deep[clamp(3 - Math.floor((dep - 2.2) * 0.75), 0, 3)][4]; continue;
    }
    if (TINFO[T].water) T = T === TR.LAKE ? TR.GRASS : TR.BEACH;
    const s = bil(shd, fx, fy), tmp = bil(temp, fx, fy);
    const sIdx = clamp(Math.round(4 + s * (T === TR.HILLS || T === TR.MOUNT || T === TR.PEAK ? 4.2 : 2.4)), 0, 8), nIdx = clamp(Math.floor(n1 * 3.2 + 0.4), 0, 3);
    let col;
    switch (T) {
      case TR.GRASS: col = (tmp < 0.32 ? TPAL.grassC : tmp > 0.78 ? TPAL.grassW : TPAL.grassT)[nIdx][sIdx]; if (h < 0.035) col = CAN.oak[0]; break;
      case TR.STEPPE: col = TPAL.steppe[nIdx][sIdx]; break; case TR.SNOW: col = TPAL.tundra[nIdx][sIdx]; if (h < 0.05) col = pack(138, 144, 140); break;
      case TR.FOREST: case TR.DFOREST: { const cold = tmp < 0.3, cn = cold ? (tmp < 0.22 ? CAN.snow : CAN.pine) : (T === TR.DFOREST && h > 0.6 ? CAN.pine : CAN.oak); const k2 = hash2(qx, qy, 4);
        col = k2 < (T === TR.DFOREST ? 0.1 : 0.22) ? (T === TR.DFOREST ? TPAL.dforest : TPAL.forest)[nIdx][sIdx] : k2 < 0.55 ? cn[0] : k2 < 0.8 ? cn[1] : cn[2]; if (cold && tmp >= 0.22 && k2 > 0.93) col = pack(200, 212, 220); break; }
      case TR.HILLS: col = (tmp < 0.3 ? TPAL.hillsC : tmp > 0.78 ? TPAL.hillsW : TPAL.hills)[nIdx][sIdx]; break;
      case TR.MOUNT: col = TPAL.mount[nIdx][sIdx]; break; case TR.PEAK: col = TPAL.peak[nIdx][sIdx]; break;
      case TR.MARSH: col = h < 0.25 ? CAN.reed[0] : h < 0.4 ? CAN.reed[1] : TPAL.marsh[nIdx][sIdx]; break; case TR.BEACH: col = TPAL.beach[nIdx][sIdx]; break;
      case TR.FARM: { const fxp = px + NZ.n2(px / 23, py / 23) * 3, fyp = py + NZ.n2(px / 23 + 9, py / 23) * 3; const hsh = hash2(Math.floor(fxp / 9), Math.floor(fyp / 7), 11); col = TPAL.crops[Math.floor(hsh * 6)][(qx + qy) & 1][sIdx]; break; }
      default: col = TPAL.grassT[nIdx][sIdx];
    }
    b[o] = col;
  }
  // coasts: a light rim of surf on the water, wet sand on the land
  const mix = (a, c2, k) => pack(((a & 255) * (1 - k) + (c2 & 255) * k) | 0, (((a >> 8) & 255) * (1 - k) + ((c2 >> 8) & 255) * k) | 0, (((a >> 16) & 255) * (1 - k) + ((c2 >> 16) & 255) * k) | 0);
  for (let y = 1; y < QH - 1; y++) for (let x = 1; x < QW - 1; x++) { const o = y * QW + x, m = qm[o];
    if (m) { if (!qm[o - 1] || !qm[o + 1] || !qm[o - QW] || !qm[o + QW]) b[o] = mix(b[o], m === 1 ? C_FOAM : C_FOAM2, 0.55); }
    else if (qm[o - 1] === 1 || qm[o + 1] === 1 || qm[o - QW] === 1 || qm[o + QW] === 1) b[o] = mix(b[o], C_WET, 0.45); }
  g.putImageData(img, 0, 0);
  // rivers and roads as thin lines
  g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (P, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(P[0] / QS, P[1] / QS); for (let i = 3; i < P.length; i += 3) g.lineTo(P[i] / QS, P[i + 1] / QS); g.stroke(); };
  F.roadP.forEach((P, k) => { if (F.roadL[k] === 1) line(P, 'rgba(170,146,102,0.45)', 0.45); });
  F.roadP.forEach((P, k) => { if (F.roadL[k] === 2) line(P, 'rgba(150,118,76,0.85)', 0.7); });
  for (const w of [1, 2, 3]) F.rivP.forEach(P => { // split each river by width class
    g.strokeStyle = w === 3 ? 'rgb(58,116,172)' : 'rgb(52,110,168)'; g.lineWidth = [0, 0.55, 0.75, 1.05][w]; g.beginPath(); let on = false;
    for (let i = 0; i < P.length / 3; i++) { const ok = Math.round(P[i * 3 + 2]) === w; if (ok && !on) { g.moveTo(P[i * 3] / QS, P[i * 3 + 1] / QS); on = true; } else if (ok) g.lineTo(P[i * 3] / QS, P[i * 3 + 1] / QS); else if (on) { g.lineTo(P[i * 3] / QS, P[i * 3 + 1] / QS); on = false; } }
    g.stroke(); });
  // mountains and hills as little sprites
  g.imageSmoothingEnabled = true;
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const i = ty * MW + tx, T = ter[i]; if (T !== TR.MOUNT && T !== TR.PEAK && T !== TR.HILLS) continue; const h0 = hash2(tx, ty, 21), tmp = temp[i];
    if (T === TR.HILLS) { if (h0 < 0.4) continue; const v = Math.floor(hash2(tx, ty, 25) * 6), s = (tmp < 0.3 ? MSPR.q.hillC : tmp > 0.78 ? MSPR.q.hillW : MSPR.q.hill)[v]; const x = tx * TS + 4 + (hash2(tx, ty, 26) - 0.5) * 4, y = ty * TS + 6 + (hash2(tx, ty, 27) - 0.5) * 4; g.drawImage(s, x / QS - s.width / 2, y / QS - s.height); continue; }
    if (T === TR.MOUNT && h0 < 0.04) continue;
    const v = Math.floor(hash2(tx, ty, 22) * 6), snowy = T === TR.PEAK || tmp < 0.25 || WD.rel[i] > 0.8, s = T === TR.PEAK ? MSPR.q.peak[v] : snowy ? MSPR.q.mountS[v] : MSPR.q.mount[v];
    const x = tx * TS + 4 + (hash2(tx, ty, 23) - 0.5) * 5, y = ty * TS + 7 + (hash2(tx, ty, 24) - 0.5) * 3; g.drawImage(s, x / QS - s.width / 2, y / QS - s.height);
  }
  g.imageSmoothingEnabled = false;
  const pr = WD.prov, QP = new Int16Array(QW * QH); for (let o = 0; o < QW * QH; o++) QP[o] = qm[o] ? -2 : pr[qt[o]];
  MAPR.quarter = c; MAPR.QW = QW; MAPR.QH = QH; MAPR.QP = QP;
}
// ---------- political / borders ----------
function renderPolitics(WD, ownerOf, colors) {
  const rc = colors.map(h => rgbOf(h));
  const own = new Int8Array(WD.provs.length); for (let k = 0; k < own.length; k++) own[k] = ownerOf(k);
  MAPR.own = own; MAPR.rc = rc; MAPR.polV++;
  // overview level: borders and the political wash
  const QW = MAPR.QW, QH = MAPR.QH, P = MAPR.QP;
  const [c, g] = mkCanvas(QW, QH); const img = g.createImageData(QW, QH); const b = new Uint32Array(img.data.buffer);
  const [pc, pg] = mkCanvas(QW, QH); const im2 = pg.createImageData(QW, QH); const b2 = new Uint32Array(im2.data.buffer);
  for (let y = 1; y < QH - 1; y++) for (let x = 1; x < QW - 1; x++) {
    const o = y * QW + x, p = P[o]; if (p < 0) continue; const r = own[p];
    b2[o] = r < 0 ? pack(150, 140, 120, 110) : pack(rc[r][0], rc[r][1], rc[r][2], 150);
    let eR = false, eP = false;
    for (let d = 0; d < 4; d++) { const q = P[o + (d === 0 ? 1 : d === 1 ? -1 : d === 2 ? QW : -QW)]; if (q === -2) continue; if (q !== p) { if (q < 0 || own[q] !== r) eR = true; else eP = true; } }
    if (eR) { const cc = r >= 0 ? rc[r] : [120, 110, 90]; b[o] = pack(cc[0] * 0.55 | 0, cc[1] * 0.55 | 0, cc[2] * 0.55 | 0, 235); }
    else if (eP) b[o] = pack(30, 24, 20, 70);
  }
  g.putImageData(img, 0, 0); pg.putImageData(im2, 0, 0); MAPR.bordQ = c; MAPR.polq = pc;
}
// borders of one chunk: sc 1 = full detail (with the inner glow of the realm colour), sc 2 = half size
function chunkBorders(ch, sc) {
  const own = MAPR.own, rc = MAPR.rc, PW = CH + 4, P = ch.P, w = CH / sc; const [c, g] = mkCanvas(w, w); const img = g.createImageData(w, w); const b = new Uint32Array(img.data.buffer);
  const at = (x, y) => P[(y + 2) * PW + x + 2]; // x, y in chunk pixels
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const X = x * sc + (sc >> 1), Y = y * sc + (sc >> 1), p = at(X, Y); if (p < 0) continue; const r = own[p]; let eR = false, eP = false;
    for (let d = 0; d < 4; d++) { const q = at(X + (d === 0 ? sc : d === 1 ? -sc : 0), Y + (d === 2 ? sc : d === 3 ? -sc : 0)); if (q === -2 || q === -3) continue; if (q !== p) { if (q < 0 || own[q] !== r) eR = true; else eP = true; } }
    const o = y * w + x;
    if (eR) { const cc = r >= 0 ? rc[r] : [120, 110, 90]; b[o] = pack(cc[0] * 0.55 | 0, cc[1] * 0.55 | 0, cc[2] * 0.55 | 0, 235); }
    else if (eP && (sc > 1 || (((ch.cx * CH + X) + (ch.cy * CH + Y)) & 1))) b[o] = pack(30, 24, 20, sc > 1 ? 70 : 90);
    else if (sc === 1 && r >= 0) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) { const q = at(X + dx, Y + dy); if (q >= 0 && own[q] !== r) { const cc = rc[r]; b[o] = pack(cc[0], cc[1], cc[2], 150); break; } } }
  }
  g.putImageData(img, 0, 0); return c;
}
// ---------- camera & layers ----------
const cam = { x: WPW / 2, y: WPH / 2, z: 1 };
const ZOOMS = [0.125, 0.25, 0.5, 1, 2];
function camClamp() {
  const vw = W / cam.z, vh = H / cam.z;
  cam.x = clamp(cam.x, Math.min(vw / 2, WPW / 2), Math.max(WPW - vw / 2, WPW / 2)); cam.y = clamp(cam.y, Math.min(vh / 2 - 20 / cam.z, WPH / 2), Math.max(WPH - vh / 2 + 40 / cam.z, WPH / 2));
}
const w2s = (x, y) => [Math.round((x - cam.x) * cam.z + W / 2), Math.round((y - cam.y) * cam.z + H / 2)];
const s2w = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];
function drawLayer(src, scale, smooth, alpha, tg) {
  const g = tg || ctx;
  const z = cam.z, vw = W / z, vh = H / z; const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
  let sx = x0 * scale, sy = y0 * scale, sw = vw * scale, sh = vh * scale; let dx = 0, dy = 0, dw = W, dh = H; const k = z / scale;
  if (sx < 0) { dx = -sx * k; dw -= dx; sw += sx; sx = 0; } if (sy < 0) { dy = -sy * k; dh -= dy; sh += sy; sy = 0; }
  if (sx + sw > src.width) { const ex = sx + sw - src.width; sw -= ex; dw -= ex * k; } if (sy + sh > src.height) { const ey = sy + sh - src.height; sh -= ey; dh -= ey * k; }
  if (sw <= 0 || sh <= 0) return;
  if (alpha !== undefined) g.globalAlpha = alpha; if (smooth) g.imageSmoothingEnabled = true;
  g.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
  g.imageSmoothingEnabled = false; g.globalAlpha = 1;
}
// chunks in view: painted ones are drawn, missing ones show the overview until they are painted (a few per frame)
function drawChunks(mode) {
  const z = cam.z, vw = W / z, vh = H / z, x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
  const c0 = Math.max(0, Math.floor(x0 / CH)), c1 = Math.min(NCX - 1, Math.floor((x0 + vw) / CH)), r0 = Math.max(0, Math.floor(y0 / CH)), r1 = Math.min(NCY - 1, Math.floor((y0 + vh) / CH));
  const miss = [], seen = MAPR.seen = new Set(); const sz = CH * z, half = z < 1;
  const tStart = performance.now(); let bud = 0;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const ci = r * NCX + c; seen.add(ci); const sx = Math.round((c * CH - cam.x) * z + W / 2), sy = Math.round((r * CH - cam.y) * z + H / 2);
    const ch = MAPR.chunks.get(ci);
    if (!ch) { miss.push([c, r, Math.hypot(c * CH + CH / 2 - cam.x, r * CH + CH / 2 - cam.y)]); ctx.imageSmoothingEnabled = true; ctx.drawImage(MAPR.quarter, c * CH / QS, r * CH / QS, CH / QS, CH / QS, sx, sy, sz, sz); ctx.imageSmoothingEnabled = false; continue; }
    MAPR.chunks.delete(ci); MAPR.chunks.set(ci, ch); // keep recently seen chunks
    if (half) ctx.imageSmoothingEnabled = true; ctx.drawImage(ch.c, sx, sy, sz, sz); ctx.imageSmoothingEnabled = false;
    if (MAPR.own) {
      const sc = half ? 2 : 1, key = sc === 1 ? 'b1' : 'b2', kv = sc === 1 ? 'bv' : 'bv2';
      if (ch[kv] !== MAPR.polV && (bud++ < 3 || !ch[key])) { ch[key] = chunkBorders(ch, sc); ch[kv] = MAPR.polV; }
      ctx.globalAlpha = half ? 0.95 : mode === 'pol' ? 1 : 0.85; ctx.drawImage(ch[key], sx, sy, sz, sz); ctx.globalAlpha = 1;
    }
  }
  // paint the missing chunks nearest to the centre: at least one per frame, more while time allows
  miss.sort((a, b) => a[2] - b[2]);
  for (let k = 0; k < miss.length; k++) { if (k > 0 && performance.now() - tStart > 14) break; renderChunk(miss[k][0], miss[k][1]); }
  // nothing missing: quietly prepare a neighbour of the view
  if (!miss.length && performance.now() - tStart < 6 && NOW - (MAPR.preT || 0) > 0.12) {
    MAPR.preT = NOW; let best = null, bd = 1e9;
    for (let r = Math.max(0, r0 - 1); r <= Math.min(NCY - 1, r1 + 1); r++) for (let c = Math.max(0, c0 - 1); c <= Math.min(NCX - 1, c1 + 1); c++) { const ci = r * NCX + c; if (MAPR.chunks.has(ci)) continue; const d = Math.hypot(c * CH + CH / 2 - cam.x, r * CH + CH / 2 - cam.y); if (d < bd) { bd = d; best = [c, r]; } }
    if (best && MAPR.chunks.size < CH_KEEP - 2) renderChunk(best[0], best[1]);
  }
}
function drawMapBase(mode) {
  rect(0, 0, W, H, '#1a3866');
  const z = cam.z;
  if (z >= 0.5) drawChunks(mode); else drawLayer(MAPR.quarter, 1 / QS, z < 0.25);
  if (MAPR.polq && mode === 'pol') drawLayer(MAPR.polq, 1 / QS, true, 0.72);
  if (MAPR.bordQ && z < 0.5) drawLayer(MAPR.bordQ, 1 / QS, z < 0.25, 1);
}
