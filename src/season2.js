'use strict';
// ===== SEASONS 2: tracks in the snow and breath in the cold at court; the world map through the year =====
// ---------- court: footprints (king, people, beasts) and breath ----------
const SEAFX = { pr: [], br: [], loc: '', last: new WeakMap() };
const SEA_BIG = { deer: 1, hart: 1, stag: 1, roe: 1, boar: 1, bear: 1, wolf: 1, horse: 1, cow: 1, ox: 1, hound: 1, dog: 1, fox: 1, goat: 1, sheep: 1, pig: 1 };
function seaCold(L) { const sv = L && L.out ? L.sv || '' : ''; if (sv === 'w' || sv === 'wm' || sv === 'th') return true; if (sv === 'au3' || sv === 'sp') { const h = hourAbs() % 24; return h < 8.5 || h > 19.5; } return false; }
function seaTrack(L, e, big, W0) {
  const lp = SEAFX.last.get(e); if (!lp) { SEAFX.last.set(e, { x: e.x, y: e.y, s: 0 }); return; }
  const dx = e.x - lp.x, dy = e.y - lp.y, d = Math.hypot(dx, dy), st = big ? 5 : 3; if (d > 40) { lp.x = e.x; lp.y = e.y; return; } if (d < st) return;
  lp.s ^= 1; const sd = (lp.s ? 1 : -1) * (big ? 1.6 : 0.8), x = Math.round(e.x - dy / d * sd), y = Math.round(e.y - 1 + dx / d * sd); lp.x = e.x; lp.y = e.y;
  if (x < 0 || y < 0 || x >= W0 || y >= L.h * CT) return; const t = L.gid[y * W0 + x];
  if (t === GT.GRASS || t === GT.DIRT || t === GT.SOIL || t === GT.SAND || t === GT.COBBLE || t === GT.FLAG) SEAFX.pr.push({ x, y, t: NOW, h: Math.abs(dx) > Math.abs(dy) ? 1 : 0, b: big ? 1 : 0 });
}
CRENDER.push((g, L) => {
  if (SEAFX.loc !== L.id) { SEAFX.loc = L.id; SEAFX.pr.length = 0; SEAFX.br.length = 0; }
  if (!L.out || L.sv !== 'w' || !L.gid) { if (SEAFX.pr.length) SEAFX.pr.length = 0; return; }
  const W0 = L.w * CT, P = COURT.p;
  if (P && !P.hide) seaTrack(L, P, 1, W0);
  for (const n of COURT.npcs) if (n.loc === L.id && !n.away && !n.sit && !n.lie) seaTrack(L, n, 1, W0);
  for (const a of COURT.ani) if (a.loc === L.id && !a.dead && !a.fly && !a.air) seaTrack(L, a, SEA_BIG[a.kind], W0);
  if (SEAFX.pr.length > 320) SEAFX.pr.splice(0, SEAFX.pr.length - 320);
  for (let i = SEAFX.pr.length - 1; i >= 0; i--) { const p = SEAFX.pr[i], a = 1 - (NOW - p.t) / 120; if (a <= 0) { SEAFX.pr.splice(i, 1); continue; } const k = Math.min(1, a * 3);
    g.globalAlpha = 0.75 * k; g.fillStyle = '#56648a'; if (!p.b) g.fillRect(p.x, p.y, 1, 1); else if (p.h) g.fillRect(p.x - 1, p.y, 2, 1); else g.fillRect(p.x, p.y - 1, 1, 2);
    if (p.b) { g.globalAlpha = 0.6 * k; g.fillStyle = '#f6f9fc'; if (p.h) g.fillRect(p.x - 1, p.y + 1, 2, 1); else g.fillRect(p.x + 1, p.y - 1, 1, 2); } } // the pressed print and the snow pushed up at its rim
  g.globalAlpha = 1;
});
CRENDER2.push((g, L) => {
  if (!seaCold(L)) { if (SEAFX.br.length) SEAFX.br.length = 0; return; }
  const P = COURT.p, list = P && !P.hide ? [P] : [];
  for (const n of COURT.npcs) if (n.loc === L.id && !n.away && !n.lie && !n.sit) list.push(n);
  for (const e of list) { if (!e.brT) e.brT = NOW + Math.random() * 2.5; if (NOW < e.brT) continue; e.brT = NOW + (e.moving || e.path ? 1.5 : 2.8) + Math.random() * 0.9; if (e.dir === 'up') continue;
    const sx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0; SEAFX.br.push({ x: e.x + sx * 5, y: e.y - 21, vx: sx * 6 + windX() * 2, t: NOW }); }
  if (SEAFX.br.length > 60) SEAFX.br.splice(0, SEAFX.br.length - 60);
  g.fillStyle = '#eef4fa';
  for (let i = SEAFX.br.length - 1; i >= 0; i--) { const p = SEAFX.br[i], t = NOW - p.t; if (t > 1.3) { SEAFX.br.splice(i, 1); continue; }
    const r = 1 + t * 2.4, x = p.x + p.vx * t, y = p.y - t * 5; g.globalAlpha = 0.4 * (1 - t / 1.3); g.fillRect(Math.round(x - r / 2), Math.round(y - r / 3), Math.max(1, Math.round(r)), Math.max(1, Math.round(r * 0.66))); }
  g.globalAlpha = 1;
});

// ---------- the world map through the year ----------
// Every map pixel takes the same look as a court in that climate would (seaVar by its temperature): snow and frozen lakes and rivers in winter,
// a ragged thaw, fresh green and blossom in spring, gold and red woods in autumn, then bare boughs; ploughed and stubble fields.
// The overview is repainted when the look changes; full-detail chunks are repainted one per frame while the old ones stay on screen.
const MSEA = { day: 0, k: undefined, V: ['', '', ''], spr: new Map(), kind: null, ms: 0 };
const MS_C = { sprout: hx('#86b850'), plough: hx('#6e5034'), stub: hx('#c8aa5a'), fresh: hx('#8ccc50'), dry: hx('#a89a50'), brown: hx('#7a6a46'), wm: hx('#6a7a5a'), ice1: hx('#a6c4da'), ice2: hx('#c8deec'), twig: hx('#5a4838'), twig2: hx('#7a6656'), twigS: hx('#9a8c80'), snow: hx('#eef3f8') };
function mapSeaKey() { return [0.2, 0.5, 0.85].map(t => seaVar(G.day, t)).join(','); }
function msSet(day) { MSEA.day = day; MSEA.V = [0.2, 0.5, 0.85].map(t => seaVar(day, t)); MSEA.k = MSEA.V.join(','); }
const msVar = tmp => tmp < 0.34 ? MSEA.V[0] : tmp > 0.7 ? MSEA.V[2] : MSEA.V[1];
const msTmp = (t, px, py) => MAPR.F.WD.temp[t] + (vnoise(px / 13, py / 13, 7) - 0.5) * 0.06;
const msOn = () => MSEA.k && MSEA.k !== ',,';
function msSnow(c, px, py) { const l = lumP(c), d = l - 0.43; return SEA_SNOW[clamp(Math.round(4 + d * (d < 0 ? 5 : 2.2) + (hash2(px, py, 91) - 0.5) * 0.7), 2, 6)]; }
const msThaw = (px, py) => vnoise(px / 26, py / 26, 4) * 0.65 + vnoise(px / 7, py / 7, 5) * 0.35 > 0.6; // the last snow lies in big patches
function msIce(c, px, py) { const h = hash2(px >> 1, py, 92); return h < 0.04 ? SEA_ICE[1] : SEA_ICE[clamp(Math.round(3 + (vnoise(px / 6, py / 6, 9) - 0.5) * 3), 2, 5)]; }
function msLand(c, T, sv, px, py) {
  if (sv === 'w' || (sv === 'th' && T !== TR.FARM && msThaw(px, py))) return T === TR.MARSH ? cmix(msSnow(c, px, py), c, 0.25) : msSnow(c, px, py);
  if (T === TR.FARM) { if (sv === 'sp' || sv === 'th') return cmix(c, MS_C.sprout, 0.45); if (sv === 'au2' || sv === 'au3' || sv === 'wm') return cmix(c, MS_C.plough, sv === 'au2' ? 0.4 : 0.55); if (sv === 'au1') return cmix(c, MS_C.stub, 0.3); return c; }
  if (T === TR.GRASS || T === TR.HILLS || T === TR.STEPPE || T === TR.FOREST || T === TR.DFOREST || T === TR.MARSH) {
    if (sv === 'sp') return cmix(c, MS_C.fresh, 0.14); if (sv === 'au1') return cmix(c, MS_C.dry, 0.1); if (sv === 'au2') return cmix(c, MS_C.dry, 0.24);
    if (sv === 'au3' || sv === 'th') return cmix(c, MS_C.brown, 0.32); if (sv === 'wm') return cmix(c, MS_C.wm, 0.25); }
  return c;
}
{ const sr0 = shadeRegion; shadeRegion = function (X0, Y0, RW, RH, buf, MK, PT) { sr0(X0, Y0, RW, RH, buf, MK, PT); if (!msOn()) return; const ter = MAPR.F.ter;
  for (let ry = 0; ry < RH; ry++) for (let rx = 0; rx < RW; rx++) { const o = ry * RW + rx, t = PT[o]; if (t < 0) continue; const px = X0 + rx, py = Y0 + ry, tmp = msTmp(t, px, py), sv = msVar(tmp); if (!sv) continue; const m = MK[o];
    if (m) { if (m === 2 && sv === 'w' && tmp < 0.55) buf[o] = msIce(buf[o], px, py); continue; }
    buf[o] = msLand(buf[o], ter[t], sv, px, py); } }; }
function msChunkPost(ch, cx, cy) { // rivers freeze, banks and roads under snow (painted after the sprites, so matched by colour)
  const PT = MAPR.scrPt, RW = CH + 2 * CHM, X0 = cx * CH, Y0 = cy * CH, g = ch.c.getContext('2d'), img = g.getImageData(0, 0, CH, CH), b = new Uint32Array(img.data.buffer); let n = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) { const o = y * CH + x, c = b[o]; if (c !== C_RIV && c !== C_RIVL && c !== C_BANK && c !== C_RD && c !== C_RDE && c !== C_TR) continue; const t = PT[(y + CHM) * RW + x + CHM]; if (t < 0) continue;
    const px = X0 + x, py = Y0 + y, tmp = msTmp(t, px, py), sv = msVar(tmp); if (sv !== 'w' && sv !== 'th') continue;
    if (c === C_RIV || c === C_RIVL) { if (sv === 'w' && tmp < 0.46) { b[o] = (c === C_RIVL || hash2(px, py, 94) < 0.2) ? MS_C.ice2 : MS_C.ice1; n++; } }
    else if (c === C_BANK) { if (sv === 'w') { b[o] = SEA_SNOW[2]; n++; } }
    else { b[o] = cmix(c, SEA_SNOW[4], sv === 'w' ? 0.4 : 0.15); n++; } }
  if (n) g.putImageData(img, 0, 0);
}
{ const rc0 = renderChunk; renderChunk = function (cx, cy) { const ch = rc0(cx, cy); ch.sk = MSEA.k; if (msOn()) msChunkPost(ch, cx, cy); return ch; }; }
// trees, hills, reeds: a seasonal twin of each sprite, made on demand and kept
function msKinds() { if (MSEA.kind) return MSEA.kind; const K = MSEA.kind = new Map(), add = (arr, k) => arr && arr.forEach((s, i) => K.set(s, [k, i]));
  add(MSPR.oak, 'd'); add(MSPR.bush, 'd'); add(MSPR.birch, 'b'); add(MSPR.pine, 'c'); add(MSPR.mount, 'm'); add(MSPR.hill, 'h'); add(MSPR.hillW, 'h'); add(MSPR.hillC, 'h'); add(MSPR.reed, 'g'); add(MSPR.tuft, 'g'); add(MSPR.pud, 'p'); return K; }
function msPix(p, mode, x, y, w, d, i) {
  const l = lumP(p), gr = isGreen(p);
  switch (mode) {
    case 'sp': return gr ? rampAt(SEA_R.young, l, 0.08, 0.62) : p;
    case 'spb': return gr ? (hash2(x, y, 96) < 0.2 ? (hash2(y, x, 97) < 0.5 ? hx('#f8f0f4') : hx('#f0c0d4')) : rampAt(SEA_R.young, l, 0.08, 0.62)) : p;
    case 'gold': case 'orng': case 'red': case 'au3': return gr ? rampAt(SEA_R[mode], l, 0.08, 0.6) : p;
    case 'dull': return gr ? cmix(p, MS_C.wm, 0.35) : p;
    case 'bare': case 'bareS': { if (!gr) return p; if (hash2(x, y, 98) > 0.55) return 0; const up = y === 0 || (d[i - w] >>> 24) < 40 || (isGreen(d[i - w]) && hash2(x, y - 1, 98) > 0.55);
      return mode === 'bareS' && up ? MS_C.snow : l > 0.3 ? MS_C.twig2 : MS_C.twig; }
    case 'snow': return rampAt(SEA_SNOW, l, 0.2, 0.7);
    case 'dry': return cmix(p, MS_C.dry, 0.3);
    case 'snowg': return cmix(p, hx('#c8d0d8'), 0.6);
    case 'ice': return MS_C.ice1;
  }
  return p;
}
function msRecol(s, mode) { let m = MSEA.spr.get(s); if (!m) MSEA.spr.set(s, m = {}); if (m[mode]) return m[mode];
  const w = s.width, h = s.height, [c, g] = mkCanvas(w, h); g.drawImage(s, 0, 0); const img = g.getImageData(0, 0, w, h), d = new Uint32Array(img.data.buffer), o = d.slice();
  for (let i = 0; i < d.length; i++) { const p = o[i]; if ((p >>> 24) < 40) continue; d[i] = msPix(p, mode, i % w, (i / w) | 0, w, o, i); }
  g.putImageData(img, 0, 0); return m[mode] = c; }
function msSpr(s, kd, sv, h) {
  const [k, i] = kd;
  if (k === 'd' || k === 'b') {
    if (sv === 'sp') return msRecol(s, k === 'd' && h < 0.14 ? 'spb' : 'sp');
    if (sv === 'au1') return k === 'b' || h < 0.3 ? msRecol(s, 'gold') : null;
    if (sv === 'au2') return h > 0.92 ? null : msRecol(s, k === 'b' || h < 0.45 ? 'gold' : h < 0.75 ? 'orng' : 'red');
    if (sv === 'au3') return msRecol(s, h < 0.55 ? 'bare' : 'au3');
    if (sv === 'w') return msRecol(s, 'bareS'); if (sv === 'th') return msRecol(s, 'bare'); if (sv === 'wm') return k === 'b' ? msRecol(s, 'bare') : msRecol(s, 'dull'); return null; }
  if (k === 'c') return sv === 'w' || (sv === 'th' && h < 0.5) ? MSPR.spine[i] : null;
  if (k === 'm') return sv === 'w' ? MSPR.mountS[i] : null;
  if (k === 'h') return sv === 'w' ? msRecol(s, 'snow') : sv === 'au2' || sv === 'au3' ? msRecol(s, 'dry') : null;
  if (k === 'g') return sv === 'w' ? msRecol(s, 'snowg') : null;
  if (k === 'p') return sv === 'w' ? msRecol(s, 'ice') : null;
  return null;
}
{ const mi0 = mapItems; mapItems = function (WD, tx0, ty0, tx1, ty1, landAt) { const items = mi0(WD, tx0, ty0, tx1, ty1, landAt); if (!msOn()) return items; const K = msKinds();
  for (const it of items) { const kd = K.get(it.s); if (!kd) continue; const x = it.x + (it.s.width >> 1), tx = clamp((x / TS) | 0, 0, MW - 1), ty = clamp((it.b / TS) | 0, 0, MH - 1), sv = msVar(msTmp(ty * MW + tx, x, it.b | 0)); if (!sv) continue;
    const v = msSpr(it.s, kd, sv, hash2(tx * 7 + (it.x & 7), ty, 93)); if (v) it.s = v; }
  return items; }; }
// the overview (1 px = 4 world px): one pass over the painted picture
function msCanopy(oi, sv, h, p) {
  if (sv === 'sp') return rampAt(SEA_R.young, lumP(p), 0.08, 0.62);
  if (sv === 'au1') return h < 0.3 ? rampAt(SEA_R.gold, lumP(p), 0.08, 0.6) : p;
  if (sv === 'au2') return h > 0.9 ? p : rampAt(h < 0.45 ? SEA_R.gold : h < 0.75 ? SEA_R.orng : SEA_R.red, lumP(p), 0.08, 0.6);
  if (sv === 'au3' || sv === 'th') return oi === 1 ? MS_C.twig2 : MS_C.twig;
  if (sv === 'w') return oi === 1 ? MS_C.snow : oi === 0 ? MS_C.twigS : MS_C.twig2;
  if (sv === 'wm') return cmix(p, MS_C.wm, 0.35);
  return p;
}
function msOverview() {
  const c = MAPR.quarter, g = c.getContext('2d'), QW = MAPR.QW, QH = MAPR.QH, QP = MAPR.QP, ter = MAPR.F.ter, img = g.getImageData(0, 0, QW, QH), b = new Uint32Array(img.data.buffer);
  const OAK = [pack(50, 100, 38), pack(87, 144, 58), pack(36, 72, 30)], PINE = [pack(31, 74, 46), pack(58, 112, 68), pack(23, 58, 38)];
  for (let qy = 0; qy < QH; qy++) for (let qx = 0; qx < QW; qx++) { const o = qy * QW + qx, px = qx * QS + 2, py = qy * QS + 2, t = clamp((py / TS) | 0, 0, MH - 1) * MW + clamp((px / TS) | 0, 0, MW - 1);
    const tmp = msTmp(t, px, py), sv = msVar(tmp); if (!sv) continue; const p = b[o], T = ter[t];
    if (QP[o] === -2) { if (sv === 'w' && T === TR.LAKE && tmp < 0.55) b[o] = msIce(p, px, py); continue; }
    const r = p & 255, gg = (p >>> 8) & 255, bb = (p >>> 16) & 255;
    if (bb > r + 50 && bb > gg + 10) { if (sv === 'w' && tmp < 0.46) b[o] = MS_C.ice1; continue; } // a river line
    if (T === TR.FOREST || T === TR.DFOREST) { const oi = OAK.indexOf(p); if (oi >= 0) { b[o] = msCanopy(oi, sv, hash2(qx, qy, 95), p); continue; }
      const pi = PINE.indexOf(p); if (pi >= 0) { if (sv === 'w') b[o] = pi === 1 ? MS_C.snow : p; continue; } }
    b[o] = msLand(p, T, sv, px, py); }
  g.putImageData(img, 0, 0);
}
{ const ro0 = renderOverview; renderOverview = function () { ro0(); if (msOn()) msOverview(); }; }
{ const rb0 = renderBase; renderBase = function (WD) { if (typeof G !== 'undefined' && G && G.day !== undefined) msSet(G.day); return rb0(WD); }; }
{ const dm0 = drawMapBase; drawMapBase = function (mode) {
  if (MAPR.ready && MAPR.F && G) { const k = mapSeaKey();
    if (k !== MSEA.k) { msSet(G.day); const t0 = performance.now(); renderOverview(); MSEA.ms = Math.round(performance.now() - t0); for (const ci of [...MAPR.chunks.keys()]) if (!MAPR.seen || !MAPR.seen.has(ci)) MAPR.chunks.delete(ci); }
    else if (MAPR.seen) for (const ci of MAPR.seen) { const ch = MAPR.chunks.get(ci); if (ch && ch.sk !== k) { renderChunk(ch.cx, ch.cy); break; } } }
  return dm0(mode); }; }
