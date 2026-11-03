'use strict';
// ===== YARD ART: courtyard buildings, curtain walls, towers, trees & props (procedural pixel art) =====
// ---------- surface textures for buildings ----------
// v3.5: roofs mark their pixels (b.rm) — in winter the snow lies on them
function roofMark(b, on) { if (!on) { delete b.set; return; } if (!b.rm) b.rm = new Uint8Array(b.w * b.h); b.set = function (x, y, c) { PB.prototype.set.call(this, x, y, c); x |= 0; y |= 0; if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.rm[y * this.w + x] = 1; }; }
function roofTex(b, x0, y0, w, h, kind, seed, flat) { // hipped roof in oblique view: back slope, ridge, front slope, lit left hip, shaded right hip
  roofMark(b, 1);
  const R0 = RPK[kind === 'slate' ? 'slate' : kind === 'thatch' ? 'thatch' : kind === 'tile' ? 'rred' : 'wood'], N = R0.length - 1;
  const rb = flat ? 0 : Math.max(3, Math.round(h * 0.24)), hip = flat ? 0 : Math.min(w * 0.16, (h - rb) * 0.85);
  const hipW = y => y < rb ? hip * (y + 1) / rb : hip * (h - y) / (h - rb);
  const texel = (x, y) => { let i;
    if (kind === 'thatch') { const row = Math.floor(y / 6), ly = y % 6, v = hsh(x + row * 5, row, seed), s2 = hsh(x, row * 3 + 1, seed + 1); i = ly === 5 ? 1 : ly < 2 ? 4 : 3; if (v < 0.3) i--; if (s2 > 0.8 && ly < 5) i = Math.min(4, i + 1); if (((x + row) % 3) === 0 && ly > 1 && ly < 5) i--; return R0[clamp(i, 0, 4)]; }
    if (kind === 'tile') { const row = Math.floor(y / 5), ly = y % 5, col = (x + (row & 1) * 2) % 4; i = col === 0 ? 1 : col === 1 ? 4 : col === 2 ? 3 : 2; if (ly === 4) i = 1; else if (ly === 0 && col === 1) i = 5; return R0[i]; }
    const row = Math.floor(y / 4), ly = y % 4, off = (row & 1) * 3, col = Math.floor((x + off) / 6), lx = (x + off) % 6, t = hsh(col, row, seed); i = 3; if (t > 0.72) i++; if (t < 0.2) i--; if (ly === 0) i++; if (ly === 3 || lx === 0) i = 1; return R0[clamp(i, 0, N)]; };
  for (let y = 0; y < h; y++) { const hw = hipW(y); for (let x = 0; x < w; x++) { let c;
      if (x < hw) c = cmul(texel(y * 2 + x, x), 1.16); else if (x >= w - hw) c = cmul(texel(y * 2 + x, x), 0.68);
      else if (y < rb) c = cmul(texel(x, rb - y + 2), 1.06); else { c = texel(x, y - rb); if (y > h - 3) c = cmul(c, 0.82); }
      b.set(x0 + x, y0 + y, c); }
    if (!flat) { b.set(x0 + Math.floor(hw), y0 + y, R0[N]); b.set(x0 + w - 1 - Math.floor(hw), y0 + y, R0[0]); } }
  if (rb) { for (let x = Math.floor(hip); x < w - hip; x++) { b.set(x0 + x, y0 + rb - 1, R0[N]); b.set(x0 + x, y0 + rb, R0[1]); } }
  b.hl(x0, y0 + h - 1, w, R0[0]); b.vl(x0, y0, h, R0[0]); b.vl(x0 + w - 1, y0, h, R0[0]); roofMark(b, 0);
}
function wallTex(b, x0, y0, w, h, kind, seed) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let c;
    if (kind === 'timber') { const D = RPK.dwood, S = RPK.ivory, half = h >> 1, px = x % 22, beam = y < 2 || y >= h - 2 || y === half || y === half - 1, post = px < 2 || x >= w - 2;
      if (beam || post) c = D[((x * 3 + y) % 9 === 0) ? 2 : (px === 1 || y === 1 || y === half) ? 4 : 3];
      else { const n = fbm(x0 + x, y0 + y, 5, seed); c = S[n > 0.66 ? 4 : n > 0.3 ? 3 : 2]; const panel = Math.floor(x / 22) * 3 + (y < half ? 0 : 1), py = y < half ? y - 2 : y - half - 1, ph = half - 3; if (hsh(panel, 1, seed) > 0.55 && Math.abs((px - 2) - (hsh(panel, 2, seed) > 0.5 ? py : ph - py) * 19 / ph) < 1.3) c = D[3]; } }
    else if (kind === 'plank') { const col = x % 5, t = hsh(Math.floor(x / 5), 2, seed); c = RPK.wood[col === 0 ? 1 : col === 1 ? (t > 0.5 ? 4 : 3) : t > 0.5 ? 3 : 2]; if (col > 1 && hsh(x, y, seed) < 0.03) c = RPK.wood[1]; }
    else { const row = Math.floor(y / 7), ly = y % 7, off = (row & 1) * 6, bw = 12 + ((hsh(row, 3, seed) * 5) | 0), lx = (x + off) % bw, id = row * 71 + Math.floor((x + off) / bw);
      if (ly === 6 || lx === 0) c = cmix(RPK.stone[2], RPK.sand[1], 0.2); else { const t = hsh(id, 5, seed); let i = 4 + (t > 0.72 ? 1 : t < 0.2 ? -1 : 0); if (ly === 0) i++; if (ly === 5) i--; c = cmix(RPK.stone[clamp(i, 1, 6)], RPK.sand[clamp(i, 1, 5)], 0.3); if (t > 0.92) c = cmix(c, RPK.leaf[3], 0.25); } }
    b.set(x0 + x, y0 + y, c); }
}
function doorArt(b, x, y, w, h, o) { o = o || {}; const W0 = RPK.wood, S = RPK.stone, M = RPK.steel; // arched plank door in a stone frame; y = top
  b.rect(x - 2, y + 2, w + 4, h - 2, S[4]); b.ell(x + w / 2, y + w / 2 + 1, w / 2 + 2, w / 2 + 1, 0, (px, py) => py < y + w / 2 + 1 ? S[5] : null);
  const inside = (px, py) => py >= y + w / 2 || ((px + 0.5 - (x + w / 2)) ** 2 / (w / 2) ** 2 + (py + 0.5 - (y + w / 2)) ** 2 / (w / 2) ** 2 <= 1);
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) { if (!inside(px, py)) continue; let c; if (o.open) c = py < y + 4 ? hx('#0e0810') : hx(py > y + h - 4 ? '#2a1a1e' : '#170e14'); else { const col = (px - x) % 5; c = W0[col === 0 ? 1 : col === 1 ? 4 : 3]; if (py === y + Math.round(h * 0.32) || py === y + Math.round(h * 0.75)) c = M[2]; } b.set(px, py, c); }
  if (!o.open) { b.set(x + w - 4, y + (h >> 1) + 2, RPK.gmetal[4]); b.set(x + w - 4, y + (h >> 1) + 3, RPK.gmetal[2]); }
  b.hl(x - 3, y + h, w + 6, S[3]);
}
function winArt(b, x, y, w, h, o) { o = o || {}; const S = RPK.stone, D = RPK.dwood; // window with shutters + optional flower box
  b.rect(x - 1, y - 1, w + 2, h + 2, o.frame || S[5]); for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) { const lead = px === x + (w >> 1) || py === y + (h >> 1); b.set(px, py, lead ? D[2] : (px + py) % 5 === 0 ? hx('#5a7ab8') : hx(o.lit ? '#f8d070' : '#2a3a68')); }
  b.set(x, y, hx('#7a9ad0')); if (o.shut) { b.rect(x - 4, y - 1, 3, h + 2, RPK[o.shut][3]); b.rect(x + w + 1, y - 1, 3, h + 2, RPK[o.shut][2]); b.vl(x - 3, y, h, RPK[o.shut][2]); b.vl(x + w + 2, y, h, RPK[o.shut][1]); }
  if (o.box) { b.rect(x - 2, y + h + 1, w + 4, 3, RPK.wood[2]); b.hl(x - 2, y + h + 1, w + 4, RPK.wood[4]); for (let k = 0; k < w + 3; k += 2) { const fc = ['#e8607a', '#f7d35c', '#f4ecd8', '#b070e0'][(k + x) % 4]; b.set(x - 1 + k, y + h, hx(fc)); b.set(x - 1 + k + 1, y + h, RPK.leaf[4]); } }
}
// ---------- buildings ----------
// o: {w tiles, fh face px, rh roof px, wall, roof, doors:[[x,w,h,open]], wins:[[x,y,w,h]], chim: x, seed, kind}
OBJP.bld = function (o, f) {
  const W0 = o.w * 16, ch = o.chim !== undefined ? 12 : 0, b = new PB(W0 + 4, ch + o.rh + o.fh), top = ch, fy = ch + o.rh;
  wallTex(b, 2, fy, W0, o.fh, o.wall || 'stone', o.seed || 1);
  for (let x = 2; x < W0 + 2; x++) for (let y = fy + o.fh - 3; y < fy + o.fh; y++) b.put(x, y, RPK.stone[y === fy + o.fh - 3 ? 4 : y === fy + o.fh - 1 ? 1 : 2]); // plinth
  if (o.kind === 'stable') { const n = o.stalls || 3, sw = Math.floor((W0 - 8) / n); for (let k = 0; k < n; k++) { const sx = 6 + k * sw, sy = fy + 8; b.rect(sx, sy, sw - 6, o.fh - 11, hx('#1c1216')); b.rect(sx, sy + o.fh - 22, sw - 6, 8, RPK.wood[3]); b.hl(sx, sy + o.fh - 22, sw - 6, RPK.wood[4]); b.line(sx, sy + o.fh - 21, sx + sw - 7, sy + o.fh - 15, RPK.wood[2]);
      if (k !== 1) stallHead(b, Math.round(sx + (sw - 6) / 2), sy + o.fh - 22, ['brown', 'dwood', 'white'][k % 3], k === 0); } }
  if (o.kind === 'forge') { const fx = 8, fw = W0 - 20; b.rect(fx, fy + 6, fw, o.fh - 9, hx('#1a1014')); for (let px = fx; px < fx + fw; px += 22) b.rect(px, fy + 4, 3, o.fh - 7, RPK.dwood[3]); const hx0 = fx + 6, hy = fy + o.fh - 20; b.rect(hx0, hy, 22, 17, RPK.stone[3]); b.hl(hx0, hy, 22, RPK.stone[5]); b.rect(hx0 + 4, hy + 4, 14, 8, hx('#2a0c08')); for (let k = 0; k < 12; k++) b.set(hx0 + 5 + (k * 7) % 12, hy + 6 + (k * 5 + f) % 5, RPK.fire[2 + ((k + f) % 4)]); b.rect(hx0 + 8, hy - 10, 6, 10, RPK.stone[2]);
    b.rect(hx0 + 32, fy + o.fh - 10, 10, 3, RPK.steel[3]); b.hl(hx0 + 32, fy + o.fh - 10, 10, RPK.steel[5]); b.rect(hx0 + 35, fy + o.fh - 7, 4, 4, RPK.steel[1]); for (let k = 0; k < 4; k++) b.vl(hx0 + 50 + k * 4, fy + 12, 9, RPK.steel[2 + (k & 1)]); }
  for (const d of o.doors || []) doorArt(b, 2 + d[0], fy + o.fh - 3 - d[2], d[1], d[2], { open: d[3] });
  for (const wv of o.wins || []) winArt(b, 2 + wv[0], fy + wv[1], wv[2] || 8, wv[3] || 9, { shut: o.shut, box: o.box && wv[1] < o.fh - 18 });
  for (let x = 2; x < W0 + 2; x++) for (let y = 0; y < 4; y++) b.set(x, fy + y, pk(18, 10, 28, 120 - y * 28)); // eave shadow
  roofTex(b, 0, top, W0 + 4, o.rh, o.roof || 'slate', o.seed || 1);
  if (o.chim !== undefined) { const cx = o.chim; b.rect(cx, 0, 10, ch + 6, RPK.stone[3]); for (let y = 0; y < ch + 6; y += 4) b.hl(cx, y, 10, RPK.stone[2]); b.vl(cx, 0, ch + 6, RPK.stone[4]); b.rect(cx - 1, 0, 12, 3, RPK.stone[4]); b.hl(cx - 1, 0, 12, RPK.stone[5]); b.rect(cx + 2, 0, 6, 1, hx('#1a1014')); }
  if (o.sign) { const sx = o.sign[0], sy = fy + 8; b.hl(sx - 2, sy - 1, 14, RPK.steel[2]); b.rect(sx, sy, 10, 9, RPK.wood[3]); b.vl(sx, sy, 9, RPK.wood[4]); const ic = o.sign[1]; if (ic === 'anvil') { b.rect(sx + 2, sy + 3, 6, 2, RPK.steel[4]); b.rect(sx + 4, sy + 5, 2, 2, RPK.steel[3]); } else if (ic === 'bread') { b.ell(sx + 5, sy + 5, 3.5, 2.5, 0, () => RPK.dirt[4]); } else if (ic === 'sword') { b.vl(sx + 5, sy + 1, 7, RPK.steel[5]); b.hl(sx + 3, sy + 6, 5, RPK.gmetal[3]); } else if (ic === 'grain') { for (let k = 0; k < 3; k++) b.vl(sx + 3 + k * 2, sy + 2, 6, RPK.thatch[4]); } }
  b.outline(OUTL); b.meta = { lights: (o.wins || []).map(wv => [2 + wv[0] + (wv[2] || 8) / 2, fy + wv[1] + (wv[3] || 9) / 2]), smoke: o.chim !== undefined ? [[o.chim + 5, 0]] : [] }; return b;
};
// ---------- keep facade (static, north side of the yard). local coords: w = 26 tiles, h = 10 tiles ----------
function coneRoof(b, cx, y0, r, hgt, ramp) { const R0 = RPK[ramp || 'slate']; // conical roof seen from the front: triangle with radial shingles
  roofMark(b, 1);
  for (let y = 0; y < hgt; y++) { const t = (y + 1) / hgt, half = r * t; for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) { const u = (x + 0.5 - cx) / Math.max(1, half); if (Math.abs(u) > 1) continue; let i = u < -0.45 ? 4 : u < 0.1 ? 3 : u < 0.6 ? 2 : 1; const row = Math.floor((y + (x & 1) * 2) / 4); if ((y + (x & 1) * 2) % 4 === 3) i--; if (hsh(x, row, 9) > 0.8) i++; b.set(x, y0 + y, R0[clamp(i, 0, R0.length - 1)]); } }
  for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) b.set(x, y0 + hgt - 1, R0[0]); roofMark(b, 0); }
function towerBody(b, cx, y0, r, h, seed) { // cylinder of stone blocks with shading
  for (let y = 0; y < h; y++) for (let x = Math.floor(cx - r); x < Math.ceil(cx + r); x++) { const u = (x + 0.5 - cx) / r; if (Math.abs(u) > 1) continue; const row = Math.floor(y / 7), ly = y % 7, ang = Math.asin(clamp(u, -1, 1)), col = Math.floor((ang * r / 1.1 + (row & 1) * 6) / 12); let i = u < -0.55 ? 5 : u < 0.05 ? 4 : u < 0.55 ? 3 : 2; if (ly === 6 || Math.abs(((ang * r / 1.1 + (row & 1) * 6) % 12)) < 1) i -= 2; else if (ly === 0) i++; if (hsh(col, row, seed) > 0.85) i--; b.set(x, y0 + y, cmix(RPK.stone[clamp(i, 0, 6)], RPK.sand[clamp(i, 0, 5)], 0.28)); } }
function crenel(b, x0, y0, w, hgt, mw, gap, ramp) { const S = RPK[ramp || 'stone']; for (let x = x0; x < x0 + w; x++) { const m = ((x - x0) % (mw + gap)) < mw; const top = m ? y0 : y0 + Math.round(hgt * 0.55); for (let y = top; y < y0 + hgt; y++) { const lx = (x - x0) % (mw + gap); let i = y === top ? 6 : lx === 0 && m ? 5 : lx === mw - 1 && m ? 3 : 4; b.set(x, y, cmix(S[i], RPK.sand[Math.min(5, i)], 0.25)); } } b.hl(x0, y0 + hgt - 1, w, S[2]); }
function slitArt(b, x, y, h) { b.rect(x, y, 2, h, hx('#120a10')); b.vl(x - 1, y - 1, h + 2, RPK.stone[5]); b.vl(x + 2, y, h, RPK.stone[2]); }
function archWin(b, x, y, w, h) { b.rect(x - 2, y + 2, w + 4, h, RPK.stone[5]); b.ell(x + w / 2, y + w / 2, w / 2 + 2, w / 2 + 2, 0, (px, py) => py <= y + w / 2 ? RPK.stone[5] : null); for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) { const d = ((px + 0.5 - x - w / 2) / (w / 2)) ** 2 + ((py + 0.5 - y - w / 2) / (w / 2)) ** 2; if (py < y + w / 2 && d > 1) continue; const lead = px === x + (w >> 1) || (py - y) % 6 === 5; b.set(px, py, lead ? hx('#1e1620') : hx((px + py) % 4 === 0 ? '#4a62a0' : '#2a3a6a')); } b.hl(x - 3, y + h + 1, w + 6, RPK.stone[6]); b.hl(x - 3, y + h + 2, w + 6, RPK.stone[3]); }
function paintKeepFacade(b, X0, Y0, wT, seed) { // draws into the location buffer at (X0,Y0); returns meta {wins:[[x,y]], banners:[[x,y]], door:[x,y]}
  const W0 = wT * 16, Hh = 160, k = new PB(W0, Hh), S = RPK.stone, meta = { wins: [], banners: [], sconces: [] };
  const tw0 = 60, mid = W0 / 2, bay0 = mid - 40, bay1 = mid + 40;
  // main roof (behind parapet)
  roofTex(k, tw0 - 6, 18, W0 - tw0 * 2 + 12, 42, 'slate', seed);
  // main face
  wallTex(k, tw0 - 4, 60, W0 - tw0 * 2 + 8, Hh - 60, 'stone', seed); crenel(k, tw0 - 6, 50, W0 - tw0 * 2 + 12, 12, 8, 6);
  for (let x = tw0 - 4; x < W0 - tw0 + 4; x++) { k.put(x, 104, S[6]); k.put(x, 105, S[4]); k.put(x, 106, S[2]); k.put(x, 62, S[2]); k.put(x, 63, S[1]); }
  // central entrance bay (protruding, taller)
  wallTex(k, bay0, 40, bay1 - bay0, Hh - 40, 'stone', seed + 3); crenel(k, bay0 - 2, 30, bay1 - bay0 + 4, 12, 8, 5); for (let y = 40; y < Hh; y++) { k.put(bay0, y, S[5]); k.put(bay0 + 1, y, S[5]); k.put(bay1 - 1, y, S[2]); k.put(bay1 - 2, y, S[2]); }
  for (let x = bay0; x < bay1; x++) { k.put(x, 104, S[6]); k.put(x, 105, S[4]); k.put(x, 106, S[2]); }
  // grand doorway (2 tiles wide, aligned to the door tiles)
  const dx = Math.round(mid - 16); k.rect(dx - 6, 112, 44, Hh - 112, S[5]); k.ell(mid, 122, 22, 18, 0, (px, py) => py < 124 ? S[5] : null); for (let a = 0; a < 15; a++) { const ang = Math.PI * (a / 14); const px = mid - Math.cos(ang) * 20, py = 122 - Math.sin(ang) * 16; k.rect(px - 1, py - 1, 3, 3, a % 2 ? S[6] : S[4]); }
  for (let py = 108; py < Hh - 2; py++) for (let px = dx; px < dx + 32; px++) { const d = ((px + 0.5 - mid) / 16) ** 2 + ((py + 0.5 - 124) / 16) ** 2; if (py < 124 && d > 1) continue; const col = (px - dx) % 6; let c = col === 0 ? RPK.dwood[1] : RPK.dwood[col === 1 ? 4 : 3]; if (py === 128 || py === 146) c = RPK.steel[2]; if (px === Math.round(mid) || px === Math.round(mid) - 1) c = RPK.dwood[0]; k.put(px, py, c); }
  k.set(mid - 5, 138, RPK.gmetal[4]); k.set(mid + 4, 138, RPK.gmetal[4]); for (let s = 0; s < 2; s++) { k.rect(dx - 8 - s * 3, Hh - 4 + s * 2, 48 + s * 6, 2, S[s ? 3 : 5]); }
  meta.door = [X0 + mid, Y0 + Hh]; meta.banners.push([X0 + bay0 + 14, Y0 + 56], [X0 + bay1 - 14, Y0 + 56]); meta.sconces.push([X0 + dx - 10, Y0 + 116], [X0 + dx + 42, Y0 + 116]);
  // windows: upper & lower rows (skip bay)
  for (const wy of [70, 112]) for (let x = tw0 + 14; x < W0 - tw0 - 18; x += 34) { if (x + 14 > bay0 - 4 && x < bay1 + 4) continue; archWin(k, x, wy, 12, 20); meta.wins.push([X0 + x + 6, Y0 + wy + 10]); }
  archWin(k, mid - 8, 62, 16, 24); meta.wins.push([X0 + mid, Y0 + 74]);
  // flanking round towers with conical roofs
  for (const cx of [tw0 / 2 + 2, W0 - tw0 / 2 - 2]) { towerBody(k, cx, 40, tw0 / 2, Hh - 40, seed + cx); crenel(k, cx - tw0 / 2 - 2, 32, tw0 + 4, 12, 7, 5); coneRoof(k, cx, 0, tw0 / 2 - 2, 34, 'slate');
    slitArt(k, cx - 1, 60, 10); archWin(k, cx - 6, 96, 12, 20); meta.wins.push([X0 + cx, Y0 + 106]); slitArt(k, cx - 1, 128, 9); }
  // ivy patches
  for (let n = 0; n < 7; n++) { const ix = tw0 + 4 + hsh(n, 1, seed) * (W0 - tw0 * 2 - 8), top = 100 + hsh(n, 2, seed) * 40; if (ix > bay0 - 10 && ix < bay1 + 10) continue; for (let y = top; y < Hh - 3; y++) for (let x = ix - 6; x < ix + 6; x++) { const v = hsh(x, y, seed + n); const r0 = (Hh - y) / (Hh - top); if (v < 0.42 * (1 - Math.abs(x - ix) / 7) * (0.6 + r0 * 0.6)) k.set(x, y, RPK.leaf[v < 0.12 ? 5 : v < 0.25 ? 4 : 3]); } }
  // base plinth
  for (let x = 0; x < W0; x++) { if (k.get(x, Hh - 1)) for (let y = Hh - 4; y < Hh; y++) if (k.get(x, y) && !(x >= dx - 10 && x < dx + 44)) k.put(x, y, S[y === Hh - 4 ? 4 : 2]); }
  k.outline(OUTL); if (typeof SEA_PB === 'function') SEA_PB(k, 'keep'); for (let y = 0; y < Hh; y++) for (let x = 0; x < W0; x++) { const c = k.get(x, y); if (c) b.set(X0 + x, Y0 + y, c); }
  return meta;
}
// ---------- curtain walls (painted into the ground layer) ----------
function paintCurtain(b, ter, w, h, seed) {
  const at = (tx, ty) => tx < 0 || ty < 0 || tx >= w || ty >= h ? -1 : ter[ty * w + tx], isW = (tx, ty) => at(tx, ty) === GT.CWALL, isF = (tx, ty) => { const t = at(tx, ty); return t > 0 && t !== GT.CWALL; };
  const S = RPK.stone, PW = w * CT;
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) { if (!isW(tx, ty)) continue; const X = tx * CT, Y = ty * CT; const face = isF(tx, ty + 1) ? 2 : (isW(tx, ty + 1) && isF(tx, ty + 2)) ? 1 : 0;
    for (let y = 0; y < CT; y++) for (let x = 0; x < CT; x++) { const gx = X + x, gy = Y + y; let c;
      if (face) { const fy = (face === 1 ? 0 : CT) + y, row = Math.floor(fy / 8), ly = fy % 8, off = (row & 1) * 7, bw = 15, lx = (gx + off) % bw, id = row * 53 + Math.floor((gx + off) / bw) + ty * 7; if (ly === 7 || lx === 0) c = cmix(S[2], RPK.sand[1], 0.2); else { const t = hsh(id, 3, seed); let i = 4 + (t > 0.7 ? 1 : t < 0.2 ? -1 : 0); if (ly === 0) i++; if (fy > 24) i--; c = cmix(S[clamp(i, 1, 6)], RPK.sand[clamp(i, 1, 5)], 0.3); } if (fy >= 29) c = S[fy === 29 ? 4 : 2]; }
      else { const row = Math.floor(gy / 10), off = hsh(row, 0, seed) * 12 | 0, lx = (gx + off) % 13, ly = gy % 10; c = (lx === 0 || ly === 0) ? cmix(S[2], RPK.sand[2], 0.3) : cmix(S[(hsh(Math.floor((gx + off) / 13), row, seed) > 0.6) ? 5 : 4], RPK.sand[4], 0.35); }
      b.put(gx, gy, c); }
    if (!face) { // merlons on outer side, parapet lip on the inner side
      const out = tx <= 1 ? 'l' : tx >= w - 2 ? 'r' : ty <= 1 ? 't' : 'b';
      const edgeTile = (out === 'l' && tx === 0) || (out === 'r' && tx === w - 1) || (out === 't' && ty === 0) || (out === 'b' && !isW(tx, ty + 1));
      if (edgeTile) for (let k = 0; k < CT; k++) { const along = (out === 'l' || out === 'r') ? Y + k : X + k, m = (along % 10) < 6; for (let d = 0; d < 5; d++) { const px = out === 'l' ? X + d : out === 'r' ? X + CT - 1 - d : X + k, py = out === 't' ? Y + d : out === 'b' ? Y + CT - 1 - d : Y + k; if (m) b.put(px, py, d === 4 ? S[2] : (out === 'b' && d === 0) ? S[3] : S[d < 2 ? 6 : 5]); else if (d < 2) b.put(px, py, S[3]); } }
      const inner = [[-1, 0, 'l'], [1, 0, 'r'], [0, -1, 't'], [0, 1, 'b']]; for (const [dx, dy, s] of inner) { if (!isF(tx + dx, ty + dy)) continue; for (let k = 0; k < CT; k++) { if (s === 'l') { b.put(X, Y + k, S[6]); b.put(X + 1, Y + k, S[5]); } else if (s === 'r') { b.put(X + CT - 1, Y + k, S[2]); b.put(X + CT - 2, Y + k, S[5]); } else if (s === 't') { b.put(X + k, Y, S[6]); } } } } }
  // cast shadows: light from the top-left -> darken ground right of and below walls
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) { if (!isF(tx, ty)) continue; const X = tx * CT, Y = ty * CT;
    if (isW(tx - 1, ty)) for (let y = 0; y < CT; y++) for (let x = 0; x < 7; x++) b.put(X + x, Y + y, cmix(b.get(X + x, Y + y), hx('#101a20'), 0.42 - x * 0.05));
    if (isW(tx, ty - 1)) for (let y = 0; y < 6; y++) for (let x = 0; x < CT; x++) b.put(X + x, Y + y, cmix(b.get(X + x, Y + y), hx('#101a20'), 0.4 - y * 0.06)); }
}
// ---------- towers & gatehouse (y-sorted objects) ----------
OBJP.tower = function (o) { const r = o.r || 26, fh = o.fh || 70, b = new PB(r * 2 + 6, fh + 44 + 12); const cx = r + 3; towerBody(b, cx, 44, r, fh, 3); crenel(b, 1, 36, r * 2 + 4, 12, 7, 5); coneRoof(b, cx, 10, r - 1, 30, 'slate'); b.vl(cx, 0, 11, RPK.dwood[2]); const R0 = RPK[REALM_RAMP[o.realm || 0]]; b.rect(cx + 1, 1, 8, 5, R0[3]); b.hl(cx + 1, 1, 8, R0[4]); b.set(cx + 8, 5, 0);
  slitArt(b, cx - 1, 60, 10); if (fh > 60) slitArt(b, cx - 1, 90, 9); for (let x = 0; x < b.w; x++) for (let y = b.h - 4; y < b.h; y++) if (b.get(x, y)) b.put(x, y, RPK.stone[y === b.h - 4 ? 4 : 2]); b.outline(OUTL); return b; };
OBJP.gatehouse = function (o, f) { // 12 tiles wide; passage at tiles 5-6 (local x 80..111)
  const b = new PB(192, 150), S = RPK.stone, base = 150; const ga = 80, gw = 32;
  wallTex(b, 40, 62, 112, base - 62, 'stone', 5); crenel(b, 38, 50, 116, 13, 8, 5); b.rect(40, 63, 112, 2, S[2]);
  // arch passage (transparent) with raised portcullis teeth
  for (let y = 92; y < base; y++) for (let x = ga; x < ga + gw; x++) { const d = ((x + 0.5 - ga - gw / 2) / (gw / 2)) ** 2 + ((y + 0.5 - 108) / 16) ** 2; if (y < 108 && d > 1) continue; b.put(x, y, 0); }
  for (let a = 0; a < 13; a++) { const ang = Math.PI * a / 12, px = ga + gw / 2 - Math.cos(ang) * (gw / 2 + 2), py = 108 - Math.sin(ang) * 18; b.rect(px - 1, py - 1, 3, 3, a % 2 ? S[6] : S[4]); }
  for (let x = ga + 1; x < ga + gw - 1; x += 4) { b.vl(x, 95 + (Math.abs(x - ga - gw / 2) < 10 ? -2 : 2), 7, RPK.steel[2]); b.set(x, 102, RPK.steel[4]); } b.hl(ga + 2, 97, gw - 4, RPK.steel[1]);
  for (const cx of [26, 166]) { towerBody(b, cx, 52, 26, base - 52, cx); crenel(b, cx - 28, 44, 56, 12, 7, 5); coneRoof(b, cx, 12, 25, 34, 'slate'); b.vl(cx, 2, 11, RPK.dwood[2]); const R0 = RPK[REALM_RAMP[o.realm || 0]]; const wv = f % 2; b.rect(cx + 1, 3 + wv, 9, 5, R0[3]); b.hl(cx + 1, 3 + wv, 9, R0[4]); slitArt(b, cx - 1, 76, 10); slitArt(b, cx - 1, 110, 10); }
  for (const bx of [58, 124]) { b.rect(bx, 70, 12, 22, RPK[REALM_RAMP[o.realm || 0]][2]); b.vl(bx, 70, 22, RPK[REALM_RAMP[o.realm || 0]][3]); b.rect(bx + 4, 76, 4, 4, RPK.gmetal[4]); b.hl(bx - 1, 69, 14, RPK.dwood[3]); }
  for (let x = 0; x < b.w; x++) for (let y = base - 4; y < base; y++) if (b.get(x, y)) b.put(x, y, S[y === base - 4 ? 4 : 2]);
  b.outline(OUTL); b.meta = { lights: [[56, 100], [136, 100]] }; return b; };
// ---------- trees & plants ----------
function canopy(b, blobs, ramp, seed, fruit) { const L = RPK[ramp]; // clustered round canopy lit from the top-left
  const inC = (x, y) => { for (const [cx, cy, r] of blobs) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) return [cx, cy, r]; return null; };
  let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9; for (const [cx, cy, r] of blobs) { X0 = Math.min(X0, cx - r); X1 = Math.max(X1, cx + r); Y0 = Math.min(Y0, cy - r); Y1 = Math.max(Y1, cy + r); }
  const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2, R = Math.max(X1 - X0, Y1 - Y0) / 2;
  for (let y = Math.floor(Y0); y <= Y1; y++) for (let x = Math.floor(X0); x <= X1; x++) { const bl = inC(x, y); if (!bl) continue; const [cx, cy, r] = bl;
    const lx = (x - cx) / r, ly = (y - cy) / r, gl = ((x - mx) / R) * 0.5 + ((y - my) / R) * 0.7; let v = -lx * 0.45 - ly * 0.6 - gl * 0.6 + (vnz(x, y, 3, seed) - 0.5) * 0.7; const lt = bay(x, y);
    let i = v > 0.55 ? 6 : v > 0.25 ? 5 : v > -0.05 ? 4 : v > -0.4 ? 3 : 2; if (lt < 0.2 && i > 2 && v < 0.1) i--; b.set(x, y, L[clamp(i, 1, L.length - 1)]);
    if (!inC(x, y - 1) || !inC(x - 1, y)) { if (v > -0.2) b.set(x, y, L[Math.min(L.length - 1, i + 1)]); } }
  // leaf clusters texture: small arcs
  for (let n = 0; n < 60; n++) { const x = X0 + hsh(n, 1, seed) * (X1 - X0), y = Y0 + hsh(n, 2, seed) * (Y1 - Y0); if (!inC(x, y) || !inC(x + 3, y)) continue; const c = b.get(x, y); b.set(x, y, cmul(c, 0.78)); b.set(x + 1, y + 1, cmul(c, 0.78)); b.set(x + 2, y + 1, cmul(c, 0.78)); b.set(x + 3, y, cmul(c, 0.82)); b.set(x + 1, y - 1, cmul(c, 1.15)); }
  if (fruit) for (let n = 0; n < 14; n++) { const x = X0 + 3 + hsh(n, 7, seed) * (X1 - X0 - 6), y = Y0 + 4 + hsh(n, 8, seed) * (Y1 - Y0 - 8); if (!inC(x, y)) continue; const F0 = RPK[fruit]; b.set(x, y, F0[3]); b.set(x + 1, y, F0[2]); b.set(x, y + 1, F0[2]); b.set(x + 1, y + 1, F0[1]); b.set(x, y - 1, F0[4]); }
}
function trunk(b, cx, y0, y1, w) { const W0 = RPK.dwood; for (let y = y0; y < y1; y++) for (let x = Math.round(cx - w / 2); x < Math.round(cx + w / 2); x++) { const u = (x + 0.5 - cx) / (w / 2); b.set(x, y, W0[u < -0.3 ? 4 : u < 0.4 ? 3 : 2]); if (hsh(x, y >> 1, 3) < 0.12) b.set(x, y, W0[1]); } b.set(cx - w / 2 - 1, y1 - 1, W0[3]); b.set(cx + w / 2, y1 - 1, W0[2]); b.set(cx - w / 2 - 2, y1 - 1, W0[3]); }
OBJP.oak = function (o) { const s = o.seed || 1, b = new PB(56, 64); trunk(b, 28, 34, 62, 8); b.line(28, 44, 18, 34, RPK.dwood[3]); b.line(29, 42, 38, 33, RPK.dwood[2]);
  const bl = [[28, 22, 17], [16, 28, 11], [41, 28, 11], [22, 13, 11], [36, 14, 11], [28, 34, 10]]; for (const p of bl) { p[0] += (hsh(p[0], 1, s) - 0.5) * 4; p[1] += (hsh(p[1], 2, s) - 0.5) * 3; } canopy(b, bl, 'leaf', s); b.outline(OUTL); return b; };
OBJP.fruit = function (o) { const s = o.seed || 2, b = new PB(40, 48); trunk(b, 20, 26, 46, 6); canopy(b, [[20, 17, 12], [11, 21, 8], [29, 21, 8], [20, 9, 8]], 'leaf', s, o.fruit || 'red'); b.outline(OUTL); return b; };
OBJP.pine = function (o) { const s = o.seed || 3, b = new PB(36, 64), P = RPK.pine; trunk(b, 18, 50, 62, 5);
  for (let tier = 0; tier < 4; tier++) { const y0 = 4 + tier * 11, hh = 20, rw = 7 + tier * 3.5; for (let y = 0; y < hh; y++) { const half = rw * (y + 2) / hh; for (let x = Math.floor(18 - half); x <= Math.ceil(18 + half); x++) { const u = (x + 0.5 - 18) / Math.max(1, half); if (Math.abs(u) > 1) continue; let i = u < -0.4 ? 5 : u < 0.15 ? 4 : u < 0.6 ? 3 : 2; if (y > hh - 4) i--; if (((x + y * 2 + tier) % 5) === 0) i--; b.set(x, y0 + y, P[clamp(i, 1, 5)]); } } }
  b.outline(OUTL); return b; };
OBJP.hedge = function (o) { const n = o.n || 1, b = new PB(n * 16, 22), L = RPK.leaf; for (let x = 0; x < n * 16; x++) { const top = 4 + Math.round(Math.sin(x * 0.55 + (o.seed || 0)) * 1.2 + hsh(x, 1, 7) * 1.4); for (let y = top; y < 21; y++) { const v = vnz(x, y, 3, 5); let i = y < top + 2 ? 6 : y < 9 ? 5 : y < 15 ? 4 : 3; if (v < 0.3) i--; if (y > 18) i = 2; b.set(x, y, L[clamp(i, 1, 6)]); } } b.outline(OUTL, { skipBottom: true }); return b; };
OBJP.bush = function (o) { const b = new PB(24, 20); canopy(b, [[12, 11, 8], [7, 13, 5], [17, 13, 5]], 'leaf', o.seed || 4, o.flower ? 'pink' : null); b.outline(OUTL); return b; };
OBJP.flowers = function (o) { const n = o.n || 1, b = new PB(n * 16, 12), fl = ['pink', 'gold', 'white', 'purple', 'red']; b.rect(0, 6, n * 16, 6, RPK.dirt[1]); b.hl(0, 6, n * 16, RPK.dirt[2]); for (let k = 0; k < n * 6; k++) { const x = 1 + k * 2.6 + hsh(k, 1, 3) * 1.5, y = 3 + hsh(k, 2, 3) * 4; b.vl(x, y + 1, 4, RPK.leaf[3]); const F0 = RPK[fl[(k + (o.seed || 0)) % fl.length]]; b.set(x, y, F0[4]); b.set(x - 1, y, F0[3]); b.set(x + 1, y, F0[3]); b.set(x, y - 1, F0[3]); } b.outline(OUTL); return b; };
OBJP.herbs = function (o) { const b = new PB(16, 12); for (let k = 0; k < 5; k++) { const x = 2 + k * 3, h0 = 4 + (hsh(k, o.seed || 1, 2) * 4 | 0); for (let y = 0; y < h0; y++) b.set(x + (y % 2), 11 - y, RPK.leaf[3 + (y > h0 - 3 ? 2 : 0)]); b.set(x - 1, 11 - h0 + 2, RPK.leaf[5]); } b.outline(OUTL); return b; };
// ---------- props ----------
OBJP.fountain = function (o, f) { const b = new PB(56, 40), S = RPK.stone, Wt = RPK.water; b.ell(28, 28, 26, 11, 0, (x, y) => S[y < 24 ? 5 : 3]); b.ell(28, 27, 22, 8, 0, (x, y) => { const k = Math.sin(x * 0.5 + f * 1.4) + Math.sin(y * 1.3 - f); return Wt[k > 1.4 ? 5 : k > 0.3 ? 4 : 3]; });
  for (let x = 2; x < 54; x++) { const yy = 28 + Math.sqrt(Math.max(0, 1 - ((x - 28) / 26) ** 2)) * 11; for (let y = Math.round(yy); y < yy + 5; y++) b.set(x, y, S[x < 18 ? 4 : x > 40 ? 2 : 3]); }
  b.rect(25, 10, 6, 18, S[4]); b.vl(25, 10, 18, S[5]); b.vl(30, 10, 18, S[2]); b.ell(28, 10, 9, 3, 0, (x, y) => S[y < 10 ? 5 : 3]); b.ell(28, 9, 6, 1.6, 0, () => Wt[4]);
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + f * 0.4, sx = 28 + Math.cos(a) * 8, sy = 11; for (let t = 0; t < 7; t++) b.set(sx + Math.cos(a) * t * 0.7, sy + t * 1.6 - (t < 2 ? 1 : 0), Wt[6 - (t >> 2)]); }
  b.vl(28, 2, 7, Wt[6]); b.set(28, 1 + (f & 1), Wt[6]); for (let k = 0; k < 4; k++) b.set(14 + k * 9 + f * 2 % 9, 26 + (k & 1) * 3, Wt[6]); b.outline(OUTL); return b; };
OBJP.well = function (o) { const b = new PB(28, 40), S = RPK.stone, W0 = RPK.wood; b.ell(14, 31, 12, 6, 0, (x, y) => S[x < 10 ? 5 : 3]); b.ell(14, 30, 8, 3, 0, () => hx('#0c0a14')); for (let x = 2; x < 26; x++) for (let y = 31; y < 38; y++) { const r0 = Math.sqrt(Math.max(0, 1 - ((x - 14) / 12) ** 2)) * 6; if (y > 31 + r0 - 6 + 6) continue; b.set(x, y + Math.round(r0 * 0.2), S[((x >> 2) + (y >> 2)) % 2 ? 4 : 3]); }
  b.rect(3, 10, 3, 24, W0[3]); b.rect(22, 10, 3, 24, W0[2]); b.hl(4, 14, 20, W0[4]); b.vl(14, 14, 10, RPK.thatch[2]); b.rect(12, 22, 5, 5, W0[3]); b.hl(12, 22, 5, RPK.steel[3]); b.poly([[0, 11], [14, 2], [28, 11]], 0, (x, y) => (y % 3 === 0) ? W0[2] : W0[x < 14 ? 4 : 3]); b.outline(OUTL); return b; };
OBJP.dummy = function (o) { const b = new PB(20, 32), T = RPK.thatch; b.vl(10, 12, 18, RPK.wood[2]); b.vl(9, 12, 18, RPK.wood[3]); b.rect(6, 28, 8, 3, RPK.wood[1]); b.rect(1, 12, 18, 3, RPK.wood[3]); b.ell(10, 17, 5, 6, 0, (x, y) => T[x < 9 ? 4 : 3]); b.hl(5, 17, 10, RPK.dwood[2]); b.ell(10, 7, 4, 4.5, 0, (x) => RPK.ivory[x < 9 ? 3 : 2]); b.set(8, 7, OUTL); b.set(11, 7, OUTL); b.line(8, 10, 12, 10, RPK.dwood[2]); b.outline(OUTL); return b; };
OBJP.target = function (o) { const b = new PB(22, 28); b.line(4, 27, 11, 10, RPK.wood[2]); b.line(18, 27, 11, 10, RPK.wood[3]); b.ell(11, 11, 9, 9, 0, (x, y, d) => d < 0.12 ? RPK.gold[4] : d < 0.32 ? RPK.red[3] : d < 0.58 ? RPK.ivory[4] : d < 0.8 ? RPK.red[2] : RPK.thatch[3]); b.line(13, 9, 17, 5, RPK.wood[3]); b.set(17, 4, RPK.ivory[4]); b.line(8, 13, 4, 11, RPK.wood[3]); b.set(3, 10, RPK.ivory[4]); b.outline(OUTL); return b; };
OBJP.rack = function (o) { const b = new PB(30, 26), W0 = RPK.wood; b.rect(1, 20, 28, 3, W0[3]); b.rect(1, 6, 28, 2, W0[4]); b.vl(2, 6, 19, W0[2]); b.vl(27, 6, 19, W0[2]); for (let k = 0; k < 5; k++) { const x = 6 + k * 4.5; b.vl(x, 1, 21, k % 2 ? W0[4] : W0[3]); if (k % 2) { b.vl(x, 0, 3, RPK.steel[5]); } else { b.rect(x - 1, 0, 3, 4, RPK.steel[4]); } } b.rect(20, 10, 7, 9, RPK.red[2]); b.ell(23.5, 14, 3.5, 4.5, 0, () => RPK.red[3]); b.set(23, 13, RPK.gmetal[4]); b.outline(OUTL); return b; };
OBJP.lamppost = function (o) { const b = new PB(12, 40), M = RPK.steel; b.rect(5, 12, 2, 26, M[1]); b.vl(5, 12, 26, M[2]); b.rect(3, 37, 6, 3, M[1]); b.rect(2, 3, 8, 9, M[1]); b.rect(3, 4, 6, 7, hx(o.lit ? '#ffd870' : '#5a5040')); if (o.lit) { b.rect(4, 6, 4, 4, hx('#fff4c0')); } b.hl(1, 2, 10, M[2]); b.set(6, 0, M[2]); b.set(6, 1, M[2]); b.outline(OUTL); return b; };
OBJP.pole = function (o, f) { const b = new PB(26, 56), R0 = RPK[o.ramp || REALM_RAMP[o.realm || 0]]; b.rect(2, 2, 2, 52, RPK.dwood[3]); b.vl(2, 2, 52, RPK.dwood[4]); b.rect(1, 52, 5, 3, RPK.stone[3]); b.set(2, 1, RPK.gmetal[4]); b.set(3, 1, RPK.gmetal[3]);
  for (let x = 0; x < 20; x++) { const wv = Math.sin(x * 0.45 - f * 1.3) * (x / 20) * 2.2; for (let y = 0; y < 12; y++) { let c = R0[y < 2 ? 4 : y > 9 ? 2 : 3]; if (Math.sin(x * 0.45 - f * 1.3) > 0.6) c = cmul(c, 1.12); if (Math.sin(x * 0.45 - f * 1.3) < -0.6) c = cmul(c, 0.82); if (o.house && heraldDiv(o.house, x, y, 20, 12)) c = RPK[o.house.ramp2][3]; b.set(4 + x, 4 + y + Math.round(wv), c); } }
  if (!o.house) { const chg = CHARGES[REALM_DEF[o.realm || 0].charge].split('|'); chg.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { if (row[xx] === '.') continue; b.set(10 + xx, 7 + yy + Math.round(Math.sin((7 + xx) * 0.45 - f * 1.3) * 0.8), row[xx] === 'y' ? RPK.gmetal[4] : row[xx] === 'k' ? OUTL : RPK.ivory[4]); } }); }
  b.outline(OUTL); return b; };
OBJP.bench = function (o) { const b = new PB(30, 18), W0 = RPK.wood; b.rect(1, 2, 28, 4, W0[3]); b.hl(1, 2, 28, W0[4]); b.rect(1, 8, 28, 4, W0[4]); b.hl(1, 11, 28, W0[2]); b.rect(3, 12, 3, 5, W0[1]); b.rect(24, 12, 3, 5, W0[1]); b.rect(3, 6, 2, 2, W0[2]); b.rect(25, 6, 2, 2, W0[2]); b.outline(OUTL); return b; };
OBJP.hay = function (o) { const b = new PB(22, 16), T = RPK.thatch; b.rect(1, 3, 20, 12, T[3]); b.rect(1, 3, 20, 3, T[4]); for (let x = 2; x < 21; x += 3) b.vl(x, 6, 8, T[2]); b.vl(7, 3, 12, RPK.wood[2]); b.vl(15, 3, 12, RPK.wood[2]); b.hl(1, 14, 20, T[1]); b.outline(OUTL); return b; };
OBJP.trough = function (o) { const b = new PB(32, 14), W0 = RPK.wood; b.rect(1, 3, 30, 9, W0[3]); b.rect(3, 4, 26, 3, RPK.water[4]); b.hl(3, 4, 26, RPK.water[5]); b.hl(1, 3, 30, W0[4]); b.rect(2, 11, 3, 3, W0[1]); b.rect(27, 11, 3, 3, W0[1]); b.outline(OUTL); return b; };
OBJP.cart = function (o) { const b = new PB(44, 30), W0 = RPK.wood; b.rect(4, 8, 30, 10, W0[3]); b.hl(4, 8, 30, W0[4]); for (let x = 6; x < 34; x += 6) b.vl(x, 9, 9, W0[2]); b.line(34, 14, 43, 20, W0[2]); b.line(34, 15, 43, 21, W0[3]); b.ell(10, 22, 7, 7, 0, (x, y, d) => d > 0.7 ? W0[1] : d < 0.12 ? RPK.steel[3] : ((Math.atan2(y - 22, x - 10) * 4 / Math.PI + 8) | 0) % 2 ? W0[3] : W0[2]);
  b.rect(8, 2, 8, 7, RPK.thatch[3]); b.rect(17, 3, 7, 6, RPK.thatch[4]); b.ell(28, 6, 4, 3, 0, () => RPK.red[3]); b.outline(OUTL); return b; };
OBJP.woodpile = function (o) { const b = new PB(30, 18), W0 = RPK.wood; for (let r = 0; r < 3; r++) for (let k = 0; k < 6 - r; k++) { const cx = 4 + k * 4.5 + r * 2.2, cy = 15 - r * 4; b.ell(cx, cy, 2.6, 2.4, 0, (x, y, d) => d < 0.25 ? RPK.dirt[4] : d < 0.6 ? RPK.dirt[3] : W0[2]); } b.outline(OUTL); return b; };
OBJP.cauldron = function (o, f) { const b = new PB(20, 20), M = RPK.black; b.ell(10, 10, 8, 6, 0, (x) => M[x < 8 ? 4 : 2]); b.ell(10, 6, 7, 2, 0, () => RPK.forest[3]); b.hl(2, 5, 16, M[4]); for (let k = 0; k < 6; k++) b.set(5 + k * 2, 17 + (k + f) % 2, RPK.fire[2 + ((k + f) % 3)]); b.set(8 + f % 3, 5, RPK.forest[4]); b.outline(OUTL); return b; };
OBJP.anvil = function (o) { const b = new PB(18, 12), M = RPK.steel; b.rect(1, 1, 16, 3, M[4]); b.hl(1, 1, 16, M[5]); b.rect(5, 4, 8, 3, M[2]); b.rect(3, 7, 12, 4, RPK.wood[2]); b.outline(OUTL); return b; };
OBJP.fence = function (o) { const n = o.n || 1, b = new PB(n * 16 + 2, 16), W0 = RPK.wood; if (o.v) { const bb = new PB(6, n * 16 + 4); for (let k = 0; k <= n; k++) { bb.rect(1, k * 16, 4, 5, W0[3]); bb.hl(1, k * 16, 4, W0[4]); } bb.rect(2, 2, 2, n * 16, W0[2]); bb.outline(OUTL); return bb; }
  for (let k = 0; k <= n; k++) { b.rect(k * 16, 2, 3, 13, W0[3]); b.vl(k * 16, 2, 13, W0[4]); } b.rect(0, 5, n * 16 + 2, 2, W0[4]); b.rect(0, 10, n * 16 + 2, 2, W0[3]); b.outline(OUTL); return b; };
// a horse looking out over a stall door, front view: ears, forelock, eyes at the sides, a long face and a soft muzzle
function stallHead(b, cx, by, col, blaze) { const C = RPK[col], wh = col === 'white', MN = wh ? RPK.gray : col === 'dwood' ? RPK.black : RPK.dwood, E = hx('#120a0a');
  b.rect(cx - 4, by - 8, 9, 8, C[1]); b.rect(cx - 3, by - 8, 7, 3, C[2]); // the neck in the dark of the stall
  for (let y = by - 15; y <= by + 1; y++) { const t = y - (by - 15), hw = t < 6 ? 3 : t < 12 ? 2 : 3; for (let x = cx - hw; x <= cx + hw; x++) b.set(x, y, C[x < cx ? 4 : x > cx ? 2 : 3]); }
  b.set(cx - 3, by - 17, C[3]); b.set(cx - 3, by - 16, C[3]); b.set(cx + 3, by - 17, C[2]); b.set(cx + 3, by - 16, C[2]); // ears
  b.vl(cx, by - 15, 3, MN[2]); b.set(cx - 1, by - 15, MN[2]); b.set(cx - 3, by - 11, E); b.set(cx + 3, by - 11, E);
  if (blaze) b.vl(cx, by - 11, 9, RPK.ivory[4]);
  b.rect(cx - 2, by - 2, 5, 3, wh ? RPK.pink[4] : C[2]); b.set(cx - 2, by, E); b.set(cx + 2, by, E); b.hl(cx - 1, by + 1, 3, wh ? RPK.pink[3] : C[1]); }
// a wooden gate in a fence line (o.n tiles: 1 = wicket, 2 = double gate); frame 1 = swung open toward the viewer
OBJP.gate = function (o, f) { const n = o.n || 1, w = n * 16 + 3, b = new PB(w, 20), W0 = RPK.wood, I = RPK.steel;
  const closed = (x0, x1, hl) => { for (let x = x0; x <= x1; x++) { const m = (x - x0) % 4; b.vl(x, 6, 11, m === 3 ? W0[2] : m === 0 ? W0[5] : W0[4]); b.set(x, 6 + (m === 1 || m === 2 ? 0 : 1), W0[5]); }
    b.rect(x0, 8, x1 - x0 + 1, 2, W0[3]); b.rect(x0, 13, x1 - x0 + 1, 2, W0[3]); b.hl(x0, 10, x1 - x0 + 1, W0[2]); b.hl(x0, 15, x1 - x0 + 1, W0[2]);
    b.line(hl ? x0 + 1 : x1 - 1, 13, hl ? x1 - 1 : x0 + 1, 10, W0[3]); const hx0 = hl ? x0 : x1; b.hl(hl ? hx0 : hx0 - 2, 8, 3, I[2]); b.hl(hl ? hx0 : hx0 - 2, 13, 3, I[2]); if (!o.n || o.n < 2) b.set(hl ? x1 - 1 : x0 + 1, 11, I[4]); };
  const open = (xh, dir) => { for (let k = 0; k < 4; k++) { const x = xh + dir * k; b.vl(x, 6 + k, 11, k === 3 ? W0[2] : k ? W0[3] : W0[4]); b.set(x, 8 + k, W0[2]); b.set(x, 13 + k, W0[2]); }
    b.set(xh, 8, I[2]); b.set(xh, 13, I[2]); };
  if (f) { open(3, 1); if (n > 1) open(w - 4, -1); }
  else if (n > 1) { const m = w >> 1; closed(3, m - 1, 1); closed(m, w - 4, 0); b.vl(m - 1, 9, 4, I[2]); }
  else closed(3, w - 4, 1);
  for (const px of [0, w - 3]) { b.rect(px, 2, 3, 17, W0[3]); b.vl(px, 2, 17, W0[4]); b.vl(px + 2, 3, 16, W0[2]); b.rect(px, 1, 3, 2, W0[5]); }
  b.outline(OUTL); return b; };
// gates swing open while somebody stands next to them
function gateFr(e) { const cx = e.x + e.w / 2, cy = e.sy - 4, r = e.w / 2 + 12, near = w => w && Math.abs(w.x - cx) < r && Math.abs(w.y - cy) < 20;
  if (near(COURT.p)) return 1; const L = curLoc(); for (const n of COURT.npcs) if (n.loc === L.id && !n.away && near(n)) return 1; return 0; }
OBJP.dovecote = function (o) { const b = new PB(36, 60); towerBody(b, 18, 26, 14, 32, 4); for (let k = 0; k < 6; k++) { const x = 10 + (k % 3) * 7, y = 32 + Math.floor(k / 3) * 10; b.rect(x, y, 4, 4, hx('#140c10')); b.hl(x - 1, y + 4, 6, RPK.wood[3]); } coneRoof(b, 18, 2, 17, 26, 'thatch'); b.outline(OUTL); return b; };
OBJP.stall = function (o) { const b = new PB(36, 34), R0 = RPK[o.ramp || 'red']; for (let x = 0; x < 36; x++) for (let y = 0; y < 8; y++) b.set(x, y + (x % 6 < 3 ? 0 : 0), ((x / 6) | 0) % 2 ? R0[3] : RPK.ivory[4]); for (let x = 0; x < 36; x += 6) b.ell(x + 3, 8, 3, 2, 0, () => (((x / 6) | 0) % 2 ? R0[2] : RPK.ivory[3])); b.vl(2, 8, 25, RPK.wood[2]); b.vl(33, 8, 25, RPK.wood[2]); b.rect(1, 20, 34, 8, RPK.wood[3]); b.hl(1, 20, 34, RPK.wood[4]); for (let k = 0; k < 5; k++) b.ell(6 + k * 6, 18, 2.5, 2, 0, () => RPK[['red', 'gold', 'green', 'orange', 'purple'][k]][3]); b.outline(OUTL); return b; };
