'use strict';
// ===== COURT ART: ground textures, castle interior walls & furniture (all procedural pixel art, 16px tiles) =====
const CT = 16;
// ---------- ground textures (painted per pixel into a location buffer) ----------
const GT = { VOID: 0, GRASS: 1, DIRT: 2, COBBLE: 3, FLAG: 4, WOOD: 5, SOIL: 6, WATER: 7, WALL: 8, DAIS: 9, SAND: 10, FLAGD: 11, MARBLE: 12, CWALL: 13 };
const VOIDC = hx('#0e0b12');
function texGrass(x, y, s) { const n = fbm(x, y, 26, s), m = vnz(x, y, 4, s + 3), d = bay(x, y); let i = n > 0.66 ? 4 : n > 0.5 ? (d < (n - 0.5) * 6 ? 4 : 3) : n > 0.28 ? 3 : (d < (0.28 - n) * 5 ? 2 : 3); if (m > 0.82) i = Math.max(2, i - 1); return rp('grass', i); }
function texDirt(x, y, s) { const n = fbm(x, y, 14, s + 5), k = hsh(x, y, s); let i = n > 0.6 ? 5 : n > 0.35 ? 4 : 3; if (k < 0.04) i = 3; if (k > 0.985) i = 5; return rp('dirt', i); }
function texSand(x, y, s) { const n = fbm(x, y, 12, s + 9); return rp('sand', n > 0.55 ? 5 : n > 0.3 ? 4 : 3); }
function texSoil(x, y, s) { const row = y % 5, n = hsh(x, y, s + 2), w = vnz(x, y, 4, s); if (row === 0) return rp('dirt', 0); if (row === 1) return rp('dirt', n < 0.2 ? 0 : 1); return rp('dirt', row === 2 ? (w > 0.6 ? 2 : 1) : n < 0.1 ? 1 : 2); }
function texCobble(x, y, s) { const [f1, f2, id, cx, cy] = worley(x, y, 7, 6, s, 0.9); if (f2 - f1 < 0.16) return rp('stone', 1); const t = hsh(id, 1, s); const dx = x - cx, dy = y - cy; let i = 4 + (t > 0.66 ? 1 : t < 0.25 ? -1 : 0); if (dx + dy < -3.5) i++; if (dx + dy > 3) i--; if (f2 - f1 < 0.3 && dx + dy > 0) i--; const c = rp('stone', i); return t > 0.82 ? cmix(c, rp('sand', 4), 0.35) : c; }
function texFlag(x, y, s, dark) { // large floor flagstones: rows of 12px, widths 14..24, bevelled
  const row = Math.floor(y / 12), off = (hsh(row, 0, s) * 24) | 0, xx = x + off, wcell = 14 + ((hsh(row, 1, s) * 10) | 0), col = Math.floor(xx / wcell), lx = xx - col * wcell, ly = y - row * 12, id = row * 131 + col;
  const base = dark ? 2 : 3; if (ly === 0 || lx === 0) return cmix(rp('stone', base - 2), rp('sand', 1), 0.25);
  const t = hsh(id, 3, s), n = vnz(x, y, 6, s + id); let i = base + (t > 0.75 ? 1 : 0); if (ly === 1 || lx === 1) i++; if (ly === 11 || lx === wcell - 1) i--; if (n > 0.78) i--; const k = hsh(x, y, s + 4); if (k < 0.025) i--;
  let c = cmix(rp('stone', i), rp('sand', i), 0.28); if (t < 0.18) c = cmix(c, rp('dirt', 2), 0.18); return c; }
function texMarble(x, y, s) { // checkered marble with veins (throne hall)
  const cx = x >> 4, cy = y >> 4, lx = x & 15, ly = y & 15, light = ((cx + cy) & 1) === 0; if (lx === 0 || ly === 0) return light ? hx('#8a8496') : hx('#2a2434');
  const v = Math.abs(fbm(x * 1.3 + cx * 40, y + cy * 40, 9, s + (light ? 1 : 2)) - 0.5); let c = light ? (v < 0.025 ? hx('#a8a2b4') : lx === 1 || ly === 1 ? hx('#ece6f0') : hx('#d4cede')) : (v < 0.03 ? hx('#5a4a62') : lx === 1 || ly === 1 ? hx('#4a3c56') : hx('#3a3046'));
  if (lx === 15 || ly === 15) c = cmul(c, 0.86); return c; }
function texWood(x, y, s) { const row = Math.floor(y / 4), ly = y % 4; if (ly === 3) return rp('wood', 1); const off = (hsh(row, 2, s) * 40) | 0, len = 24 + ((hsh(row, 5, s) * 20) | 0); const lx = (x + off) % len; if (lx === 0) return rp('wood', 1); const t = hsh(row * 7 + Math.floor((x + off) / len), 9, s); let i = t > 0.6 ? 4 : t > 0.25 ? 3 : 3; const g = Math.sin((x + off) * 0.35 + row * 2.1) + Math.sin((x + off) * 0.11 + t * 9); if (g > 1.5 && ly === 1) i--; if (ly === 0) i++; if (lx === 2 && ly === 1 && t > 0.5) return rp('wood', 1); return rp('wood', clamp(i, 2, 5)); }
function texWater(x, y, s) { const n = fbm(x, y, 10, s + 11), k = Math.sin(x * 0.45 + Math.sin(y * 0.7) * 2) + Math.sin(y * 0.9 + x * 0.1); return rp('water', k > 1.75 ? 5 : n > 0.62 ? 4 : n > 0.3 ? 3 : 2); }
const TEX = { [GT.GRASS]: texGrass, [GT.DIRT]: texDirt, [GT.COBBLE]: texCobble, [GT.FLAG]: (x, y, s) => texFlag(x, y, s, 0), [GT.FLAGD]: (x, y, s) => texFlag(x, y, s, 1), [GT.WOOD]: texWood, [GT.SOIL]: texSoil, [GT.WATER]: texWater, [GT.SAND]: texSand, [GT.DAIS]: (x, y, s) => texMarble(x + 8, y, s + 9), [GT.MARBLE]: texMarble };
const BLEND = { [GT.GRASS]: 1, [GT.DIRT]: 1, [GT.COBBLE]: 1, [GT.SAND]: 1 };
// paint a whole ground layer; ter = Uint8Array(w*h)
function paintGround(b, ter, w, h, seed) {
  const at = (tx, ty) => tx < 0 || ty < 0 || tx >= w || ty >= h ? GT.VOID : ter[ty * w + tx];
  const PW = w * CT, PH = h * CT, gid = new Uint8Array(PW * PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    let T = at(x >> 4, y >> 4);
    if (BLEND[T]) { const nx = (vnz(x, y, 7, seed) - 0.5) * 9, ny = (vnz(x + 77, y + 31, 7, seed) - 0.5) * 9; const T2 = at((x + nx) >> 4, (y + ny) >> 4); if (BLEND[T2]) T = T2; }
    gid[y * PW + x] = T; const f = TEX[T]; b.put(x, y, f ? f(x, y, seed) : VOIDC);
  }
  // edges: grass rim + shadow on lower terrain, tufts overhang
  for (let y = 1; y < PH - 1; y++) for (let x = 1; x < PW - 1; x++) { const i = y * PW + x, T = gid[i]; if (T !== GT.GRASS) continue;
    const nb = [gid[i - 1], gid[i + 1], gid[i - PW], gid[i + PW]]; if (nb.some(v => v === GT.DIRT || v === GT.COBBLE || v === GT.SAND)) { b.put(x, y, rp('grass', 2)); if (gid[i + PW] !== GT.GRASS && y + 1 < PH) b.put(x, y + 1, cmix(b.get(x, y + 1), hx('#20140c'), 0.35)); } }
  // tufts and flowers on grass
  const fl = ['#f4ecd8', '#f7d35c', '#e87a9a', '#8ab4f0', '#f0a040'];
  for (let cy = 0; cy < PH; cy += 5) for (let cx = 0; cx < PW; cx += 5) { const hsv = hsh(cx, cy, seed + 21); const x = cx + ((hsv * 5) | 0), y = cy + ((hsh(cx, cy, seed + 22) * 5) | 0); if (x < 1 || y < 2 || x >= PW - 1 || y >= PH - 1) continue; if (gid[y * PW + x] !== GT.GRASS) continue;
    if (hsv < 0.55) { b.put(x, y, rp('grass', 6)); b.put(x, y + 1, rp('grass', 5)); b.put(x - 1, y + 1, rp('grass', 2)); b.put(x + 1, y + 1, rp('grass', 2)); b.put(x, y + 2, rp('grass', 2)); }
    else if (hsv < 0.6) { const c = hx(fl[(hsh(x, y, 5) * fl.length) | 0]); b.put(x, y + 1, rp('grass', 2)); b.put(x, y, c); b.put(x - 1, y, cmix(c, hx('#000000'), 0.15)); b.put(x + 1, y, cmix(c, hx('#000000'), 0.15)); b.put(x, y - 1, cmix(c, hx('#ffffff'), 0.3)); }
    else if (hsv < 0.66) { b.put(x, y, rp('grass', 2)); b.put(x + 1, y, rp('grass', 3)); } }
  // raised dais: front step + side edges
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) { if (at(tx, ty) !== GT.DAIS) continue; const X = tx * CT, Y = ty * CT;
    if (at(tx, ty + 1) !== GT.DAIS) for (let x = 0; x < CT; x++) { b.put(X + x, Y + 11, hx('#f4eef8')); for (let y = 12; y < 16; y++) b.put(X + x, Y + y, ((X + x) % 8 === 0) ? rp('stone', 1) : rp('stone', y < 13 ? 4 : y < 15 ? 3 : 2)); if (Y + 16 < PH) b.put(X + x, Y + 16, cmix(b.get(X + x, Y + 16), hx('#120a18'), 0.45)); }
    if (at(tx - 1, ty) !== GT.DAIS) for (let y = 0; y < CT; y++) b.put(X, Y + y, rp('stone', 2));
    if (at(tx + 1, ty) !== GT.DAIS) for (let y = 0; y < CT; y++) { b.put(X + CT - 1, Y + y, rp('stone', 1)); if (X + CT < PW) b.put(X + CT, Y + y, cmix(b.get(X + CT, Y + y), hx('#120a18'), 0.4)); } }
  return gid;
}
// ---------- interior walls ----------
// classify wall tiles: face (2 rows above a floor tile), cap otherwise
function paintWalls(b, ter, w, h, seed, opt) {
  const at = (tx, ty) => tx < 0 || ty < 0 || tx >= w || ty >= h ? GT.VOID : ter[ty * w + tx];
  const isW = (tx, ty) => at(tx, ty) === GT.WALL, isF = (tx, ty) => { const t = at(tx, ty); return t !== GT.WALL && t !== GT.VOID; };
  const kind = new Uint8Array(w * h); // 1 cap, 2 face-hi, 3 face-lo
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) { if (!isW(tx, ty)) continue; if (isF(tx, ty + 1)) kind[ty * w + tx] = 3; else if (isW(tx, ty + 1) && isF(tx, ty + 2)) kind[ty * w + tx] = 2; else kind[ty * w + tx] = 1; }
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) { const k = kind[ty * w + tx]; if (!k) continue; const X = tx * CT, Y = ty * CT;
    if (k === 1) { for (let y = 0; y < CT; y++) for (let x = 0; x < CT; x++) { const n = hsh(X + x, Y + y, seed); b.put(X + x, Y + y, n < 0.08 ? rp('stone', 0) : rp('stone', 1)); }
      // lit edges toward floors / faces
      const edge = (dx, dy) => isF(tx + dx, ty + dy) || (dy === 1 && kind[(ty + 1) * w + tx] >= 2);
      if (edge(0, 1)) for (let x = 0; x < CT; x++) { b.put(X + x, Y + CT - 1, rp('stone', 3)); b.put(X + x, Y + CT - 2, rp('stone', 2)); }
      if (edge(-1, 0)) for (let y = 0; y < CT; y++) { b.put(X, Y + y, rp('stone', 3)); b.put(X + 1, Y + y, rp('stone', 2)); }
      if (edge(1, 0)) for (let y = 0; y < CT; y++) { b.put(X + CT - 1, Y + y, rp('stone', 0)); b.put(X + CT - 2, Y + y, rp('stone', 2)); }
      if (edge(0, -1)) for (let x = 0; x < CT; x++) b.put(X + x, Y, rp('stone', 2));
    } else { // face: ashlar blocks (+ optional wood wainscot below a chair rail)
      const wn = opt && opt.wains ? opt.wains(tx, ty) : 0;
      for (let y = 0; y < CT; y++) for (let x = 0; x < CT; x++) { const gy = (k === 2 ? 0 : CT) + y, X1 = X + x; // 0..31 within the face
        const row = Math.floor((gy - 3) / 6), ly = (gy - 3) % 6, off = (row & 1) ? 7 : 0, xx = X1 + off, bw = 14, lx = xx % bw, id = row * 97 + Math.floor(xx / bw) + tx * 3;
        let c; if (gy >= 29) c = gy === 29 ? rp('dwood', 4) : gy === 30 ? rp('dwood', 3) : rp('dwood', 1); else if (gy < 3) c = gy === 0 ? rp('wood', 4) : gy === 1 ? rp('wood', 3) : rp('dwood', 1);
        else if (wn && gy >= 20) { const st = X1 % 16; if (gy === 20) c = rp('wood', 4); else if (gy === 21) c = rp('dwood', 2); else if (st < 2) c = st === 0 ? rp('dwood', 3) : rp('dwood', 2); else if (gy === 22) c = rp('wood', 3); else if (gy === 28) c = rp('dwood', 1); else c = st === 2 ? rp('wood', 1) : st === 15 ? rp('dwood', 1) : rp('wood', (X1 * 7 + gy * 3) % 11 === 0 ? 3 : 2); }
        else if (ly === 0 || lx === 0) c = rp('stone', 2); else { const t = hsh(id, 7, seed); let i = 4 + (t > 0.72 ? 1 : t < 0.22 ? -1 : 0); if (ly === 1) i++; if (ly === 5) i--; if (gy > 20) i--; if (gy < 9) i++; c = rp('stone', clamp(i, 2, 6)); c = cmix(c, rp('sand', clamp(i, 2, 5)), 0.22); if (t > 0.9) c = cmix(c, rp('sand', 4), 0.3); }
        b.put(X1, Y + y, c); } }
  }
  // ambient occlusion: floors under faces and beside side walls
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) { if (!isF(tx, ty)) continue; const X = tx * CT, Y = ty * CT;
    if (isW(tx, ty - 1)) for (let y = 0; y < 5; y++) for (let x = 0; x < CT; x++) b.put(X + x, Y + y, cmix(b.get(X + x, Y + y), hx('#120a18'), 0.42 - y * 0.08));
    if (isW(tx - 1, ty)) for (let x = 0; x < 3; x++) for (let y = 0; y < CT; y++) b.put(X + x, Y + y, cmix(b.get(X + x, Y + y), hx('#120a18'), 0.3 - x * 0.09));
    if (isW(tx + 1, ty)) for (let x = 0; x < 2; x++) for (let y = 0; y < CT; y++) b.put(X + CT - 1 - x, Y + y, cmix(b.get(X + CT - 1 - x, Y + y), hx('#120a18'), 0.22 - x * 0.08)); }
  return kind;
}
// ---------- carpets & rugs (painted into the ground layer) ----------
function paintCarpet(b, x0, y0, w, h, ramp, border) { const R0 = RPK[ramp], G0 = RPK[border || 'gold'];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ex = Math.min(x, w - 1 - x), ey = Math.min(y, h - 1 - y), e = Math.min(ex, ey); let c;
    if (e === 0) c = R0[1]; else if (e === 1) c = G0[3]; else if (e === 2) c = R0[2]; else { const px0 = (x - 3) % 8, py0 = (y - 3) % 8; const d = Math.abs(px0 - 3.5) + Math.abs(py0 - 3.5); c = d < 1.6 ? G0[2] : d < 2.6 ? R0[3] : R0[2]; if (((x + y) & 7) === 0 && d > 3) c = R0[3]; }
    if (e === 1 && ((ex === 1 && (y & 3) === 0) || (ey === 1 && (x & 3) === 0))) c = G0[4];
    b.put(x0 + x, y0 + y, c); } }
function paintRug(b, x0, y0, w, h, ramp) { const R0 = RPK[ramp]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2); const d = dx * dx + dy * dy; if (d > 1) continue; let c = d > 0.8 ? R0[1] : d > 0.65 ? RPK.ivory[3] : ((Math.floor(d * 10) & 1) ? R0[3] : R0[2]); if (d < 0.08) c = RPK.gold[3]; b.put(x0 + x, y0 + y, c); } }
// ---------- interior objects: return PB ----------
function wplanks(b, x, y, w, h, ramp, vertical) { const R0 = RPK[ramp || 'wood']; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = vertical ? i % 5 : j % 4; const t = hsh(vertical ? (x + i) / 5 | 0 : (y + j) / 4 | 0, 3, 7); let c = p === 0 ? R0[1] : R0[t > 0.5 ? 3 : 4]; if (p === 1) c = R0[t > 0.5 ? 4 : 5]; b.set(x + i, y + j, c); } }
const OBJP = {
  throne(o) { const b = new PB(36, 48), G0 = RPK.gmetal, R0 = RPK.red, W0 = RPK.dwood;
    b.poly([[4, 6], [18, 0], [32, 6], [32, 30], [4, 30]], 0, (x, y) => { const e = x < 6 || x > 29 || y < 7 + Math.abs(x - 18) * -0.33 + 2; return e ? G0[x < 12 ? 4 : x > 26 ? 2 : 3] : R0[x < 12 ? 3 : x > 25 ? 1 : 2]; });
    for (let y = 8; y < 30; y += 4) for (let x = 9; x < 28; x += 5) b.set(x + ((y >> 2) & 1) * 2, y, R0[3]); // tufted velvet
    b.ell(18, 3, 3, 3, 0, (x, y) => G0[x < 18 ? 5 : 3]); b.set(18, 3, hx('#d02838')); // crest gem
    b.rect(2, 26, 32, 10, G0[2]); b.rect(3, 27, 30, 3, R0[2]); b.hl(3, 27, 30, R0[3]); // seat cushion
    b.rect(1, 22, 5, 16, G0[3]); b.rect(30, 22, 5, 16, G0[2]); b.hl(1, 22, 5, G0[5]); b.hl(30, 22, 5, G0[4]); // armrests
    b.rect(4, 36, 28, 10, W0[2]); b.rect(4, 36, 28, 2, G0[3]); for (let x = 6; x < 30; x += 6) b.rect(x, 39, 3, 6, W0[3]); b.rect(2, 44, 32, 4, G0[2]); b.hl(2, 44, 32, G0[4]);
    b.outline(OUTL); return b; },
  brazier(o, f) { const b = new PB(16, 28), M = RPK.steel; b.rect(7, 14, 2, 12, M[2]); b.set(7, 14, M[4]); b.rect(4, 24, 8, 2, M[1]); b.rect(3, 26, 10, 2, M[2]); b.ell(8, 12, 6, 3, 0, (x, y) => y < 12 ? M[1] : M[3]); b.hl(2, 11, 12, M[4]);
    const F = RPK.fire; for (let k = 0; k < 14; k++) { const x = 4 + (k % 8), hgt = 4 + ((hsh(k, f, 3) * 6) | 0); for (let y = 0; y < hgt; y++) b.set(x, 10 - y, F[clamp(4 - (y * 4 / hgt | 0) + (x > 6 && x < 10 ? 1 : 0), 0, 5)]); } b.outline(OUTL); return b; },
  pillar(o) { const b = new PB(16, 52), S = RPK.stone; for (let y = 6; y < 46; y++) for (let x = 3; x < 13; x++) b.set(x, y, cylCol('stone', x - 3, 10, 4)); for (let y = 8; y < 44; y += 7) for (let x = 3; x < 13; x++) b.set(x, y, cylCol('stone', x - 3, 10, 3));
    b.rect(1, 2, 14, 4, S[4]); b.hl(1, 2, 14, S[6]); b.hl(1, 5, 14, S[2]); b.rect(2, 0, 12, 2, S[5]); b.rect(1, 46, 14, 4, S[4]); b.hl(1, 46, 14, S[5]); b.hl(1, 49, 14, S[2]); b.rect(0, 50, 16, 2, S[3]);
    b.outline(OUTL); return b; },
  sconce(o, f) { const b = new PB(10, 14), M = RPK.steel, F = RPK.fire; b.rect(4, 7, 2, 6, M[1]); b.rect(2, 6, 6, 2, M[2]); b.rect(3, 4, 4, 2, RPK.dwood[3]); const fl = f % 3; for (let y = 0; y < 4 + fl % 2; y++) { b.set(4, 3 - y, F[4 - y]); b.set(5, 3 - y + (fl === 1 ? 1 : 0), F[3 - Math.min(y, 2)]); } b.set(4, 0, F[5]); b.outline(OUTL); return b; },
  banner(o, f) { const b = new PB(16, 32), d = REALM_DEF[o.realm || 0], R0 = RPK[REALM_RAMP[o.realm || 0]], G0 = RPK.gmetal; b.rect(1, 0, 14, 2, RPK.dwood[3]); b.set(0, 0, G0[4]); b.set(15, 0, G0[4]);
    for (let y = 2; y < 30; y++) for (let x = 2; x < 14; x++) { const sw = Math.sin(y * 0.4 + f * 0.9) * 0.6; if (y > 24 && Math.abs(x - 7.5) < (y - 24) * 1.1 - 0.5) continue; b.set(x + Math.round(sw * (y / 30)), y, x < 4 ? R0[3] : x > 11 ? R0[1] : R0[2]); }
    for (let y = 2; y < 24; y++) { b.set(3, y, G0[3]); b.set(12, y, G0[2]); }
    const chg = CHARGES[d.charge].split('|'); chg.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { const q = row[xx]; if (q === '.') continue; b.set(4 + xx, 9 + yy, q === 'y' ? G0[4] : q === 'k' ? hx('#1a1418') : q === 'G' ? RPK.steel[4] : q === 'r' ? R0[0] : hx('#f4ecd8')); } }); b.outline(OUTL); return b; },
  housebanner(o, f) { const b = new PB(14, 26), H0 = o.house; b.rect(0, 0, 14, 2, RPK.dwood[3]); const R0 = RPK[H0 ? H0.ramp : 'wine'], R1 = RPK[H0 ? H0.ramp2 : 'gold'];
    for (let y = 2; y < 24; y++) for (let x = 1; x < 13; x++) { if (y > 19 && Math.abs(x - 6.5) < (y - 19) * 1.2 - 0.5) continue; const div = H0 ? heraldDiv(H0, x - 1, y - 2, 12, 18) : 0; b.set(x, y, div ? R1[x > 9 ? 2 : 3] : R0[x > 9 ? 1 : x < 3 ? 3 : 2]); }
    if (H0) heraldCharge(b, H0, 4, 8); b.outline(OUTL); return b; },
  window(o, f) { const b = new PB(16, 28), S = RPK.stone; b.rect(2, 3, 12, 22, S[2]); b.ell(8, 6, 6, 5, 0, () => S[2]); const glass = o.night ? ['#3a3060', '#2a2450', '#4a3a70'] : ['#7ab0e0', '#a8d4f2', '#5a8ac8'];
    for (let y = 4; y < 24; y++) for (let x = 4; x < 12; x++) { if (y < 8 && (x + 0.5 - 8) ** 2 / 16 + (y + 0.5 - 8) ** 2 / 16 > 1) continue; const lead = x === 8 || y % 5 === 0; b.set(x, y, lead ? hx('#2a2430') : hx(glass[(x + y) % 7 === 0 ? 1 : x < 6 ? 1 : 0])); }
    b.rect(1, 24, 14, 3, S[4]); b.hl(1, 24, 14, S[5]); b.outline(OUTL); return b; },
  tapestry(o) { const b = new PB(32, 28), R0 = RPK[o.ramp || 'wine'], G0 = RPK.gmetal; b.rect(0, 0, 32, 2, RPK.dwood[3]); for (let y = 2; y < 26; y++) for (let x = 1; x < 31; x++) { let c = R0[2]; if (x < 3 || x > 28 || y < 4 || y > 23) c = G0[3]; else { const v = Math.sin(x * 0.5) + Math.cos(y * 0.45); c = v > 1.2 ? G0[2] : v < -1.3 ? R0[1] : R0[2]; } b.set(x, y, c); }
    b.ell(16, 13, 6, 6, 0, (x, y) => ((x + y) & 1) ? G0[4] : G0[3]); b.ell(16, 13, 3, 3, 0, () => R0[3]); for (let x = 2; x < 30; x += 3) b.set(x, 26, G0[3]); b.outline(OUTL); return b; },
  fireplace(o, f) { const b = new PB(32, 34), S = RPK.stone, F = RPK.fire; b.rect(0, 2, 32, 32, S[4]); for (let y = 2; y < 34; y += 5) for (let x = (y % 10 ? 0 : 4); x < 32; x += 8) b.vl(x, y, 5, S[2]); for (let y = 6; y < 34; y += 5) b.hl(0, y, 32, S[2]);
    b.rect(0, 0, 32, 4, S[5]); b.hl(0, 0, 32, S[6]); b.hl(0, 3, 32, S[2]); b.rect(6, 12, 20, 22, hx('#1a1018')); b.ell(16, 13, 10, 5, 0, (x, y) => y < 13 ? hx('#1a1018') : null);
    for (let k = 0; k < 18; k++) { const x = 9 + (k % 14), hh = 5 + ((hsh(k, f, 5) * 9) | 0); for (let y = 0; y < hh; y++) b.set(x, 32 - y, F[clamp(4 - (y * 5 / hh | 0) + (x > 13 && x < 19 ? 1 : 0), 0, 5)]); }
    b.rect(8, 31, 16, 2, RPK.dwood[2]); b.outline(OUTL); return b; },
  bookshelf(o) { const b = new PB(32, 40), W0 = RPK.dwood; b.rect(0, 0, 32, 40, W0[2]); b.rect(0, 0, 32, 3, W0[4]); b.hl(0, 0, 32, W0[5] || W0[4]); b.vl(0, 0, 40, W0[3]); b.vl(31, 0, 40, W0[1]);
    const cols = ['wine', 'navy', 'forest', 'brown', 'teal', 'gold', 'purple', 'red']; const fillK = o.fill === undefined ? 1 : o.fill;
    for (let sh = 0; sh < 4; sh++) { const y0 = 4 + sh * 9; b.rect(2, y0, 28, 8, W0[0]); b.hl(1, y0 + 8, 30, W0[3]); let x = 3; while (x < 29) { const bw = 2 + ((hsh(x, sh, o.seed || 1) * 2.2) | 0), bh = 5 + ((hsh(x, sh + 9, o.seed || 1) * 3) | 0); if (hsh(x, sh + 3, o.seed || 1) > fillK) { x += bw + 1; continue; } const R0 = RPK[cols[(hsh(x, sh + 5, o.seed || 1) * cols.length) | 0]];
        for (let i = 0; i < bw; i++) for (let j = 0; j < bh; j++) b.set(x + i, y0 + 8 - bh + j, i === 0 ? R0[3] : R0[2]); b.set(x, y0 + 9 - bh + 1, RPK.gold[3]); x += bw; } }
    b.outline(OUTL); return b; },
  desk(o) { const b = new PB(32, 26), W0 = RPK.wood; b.rect(0, 4, 32, 8, W0[4]); b.hl(0, 4, 32, W0[5]); b.rect(0, 12, 32, 10, W0[2]); b.hl(0, 12, 32, W0[1]); b.rect(2, 13, 10, 7, W0[3]); b.rect(20, 13, 10, 7, W0[3]); b.set(7, 16, RPK.gold[4]); b.set(25, 16, RPK.gold[4]); b.rect(0, 22, 3, 4, W0[1]); b.rect(29, 22, 3, 4, W0[1]);
    b.rect(5, 2, 9, 5, RPK.ivory[4]); b.hl(5, 6, 9, RPK.ivory[2]); b.line(6, 3, 12, 3, RPK.parch[1]); b.line(6, 5, 10, 5, RPK.parch[1]); // papers
    b.rect(18, 1, 6, 4, RPK.wine[2]); b.hl(18, 1, 6, RPK.wine[3]); b.line(25, 0, 28, 5, RPK.white[4]); // book + quill
    if (o.candle) { b.rect(27, 1, 2, 4, RPK.ivory[4]); b.set(27, 0, RPK.fire[4]); } if (o.scales) { b.vl(24, -0, 5, RPK.gmetal[3]); b.hl(20, 0, 9, RPK.gmetal[4]); }
    b.outline(OUTL); return b; },
  chair(o) { const b = new PB(16, 24), W0 = RPK.wood, R0 = RPK[o.ramp || 'red']; const d = o.dir || 'down';
    if (d === 'down') { b.rect(3, 0, 10, 12, W0[2]); b.rect(4, 1, 8, 10, R0[2]); b.hl(4, 1, 8, R0[3]); b.rect(2, 11, 12, 5, W0[3]); b.rect(3, 11, 10, 3, R0[3]); b.rect(2, 16, 2, 7, W0[1]); b.rect(12, 16, 2, 7, W0[1]); }
    else if (d === 'up') { b.rect(2, 8, 12, 5, W0[3]); b.rect(3, 8, 10, 3, R0[3]); b.rect(2, 13, 2, 9, W0[1]); b.rect(12, 13, 2, 9, W0[1]); b.rect(3, 10, 10, 12, W0[2]); b.rect(4, 11, 8, 9, R0[1]); }
    else { b.rect(4, 0, 3, 18, W0[2]); b.vl(4, 0, 18, W0[3]); b.rect(5, 2, 1, 9, R0[2]); b.rect(4, 11, 10, 4, W0[3]); b.rect(5, 11, 8, 2, R0[3]); b.rect(4, 15, 2, 8, W0[1]); b.rect(12, 15, 2, 8, W0[1]); if (d === 'left') { b.outline(OUTL); return b.flipX(); } } // side view: backrest sits behind the sitter's back
    b.outline(OUTL); return b; },
  ltable(o) { const w = o.w || 112, b = new PB(w, 44), W0 = RPK.wood; b.rect(0, 0, w, 30, W0[4]); for (let x = 0; x < w; x += 7) b.vl(x, 0, 30, W0[3]); b.hl(0, 0, w, W0[5]); b.rect(0, 30, w, 8, W0[2]); b.hl(0, 30, w, W0[1]); b.rect(2, 38, 4, 6, W0[1]); b.rect(w - 6, 38, 4, 6, W0[1]);
    if (o.map) { b.rect(w / 2 - 22, 5, 44, 20, RPK.parch[3]); b.hl(w / 2 - 22, 24, 44, RPK.parch[1]); for (let k = 0; k < 9; k++) b.ell(w / 2 - 16 + (hsh(k, 1, 3) * 32), 9 + hsh(k, 2, 3) * 12, 3, 2, 0, () => hx(['#7ab060', '#5a9050', '#9ac070'][k % 3])); b.line(w / 2 - 18, 18, w / 2 + 14, 8, hx('#3a6ac0')); b.set(w / 2 - 4, 12, hx('#d02838')); b.set(w / 2 + 8, 16, hx('#1a1418')); b.set(w / 2 - 12, 19, hx('#1a1418')); }
    for (const cx of [10, w - 12]) { b.rect(cx, 4, 2, 6, RPK.ivory[4]); b.set(cx, 3, RPK.fire[4]); b.rect(cx - 2, 10, 6, 2, RPK.gmetal[3]); }
    for (const cx of [26, w - 28]) { b.rect(cx, 8, 3, 4, RPK.gmetal[3]); b.set(cx, 8, RPK.gmetal[5]); }
    b.outline(OUTL); return b; },
  chest(o) { const b = new PB(18, 16), W0 = RPK.wood, M = RPK.gmetal; b.rect(1, 2, 16, 13, W0[3]); b.rect(1, 2, 16, 5, W0[4]); b.hl(1, 2, 16, W0[5]); b.hl(1, 7, 16, W0[1]); b.vl(4, 2, 13, M[2]); b.vl(13, 2, 13, M[2]); b.rect(8, 6, 2, 3, M[4]); b.hl(1, 14, 16, W0[1]); if (o.open) { b.rect(2, 3, 14, 3, RPK.gold[4]); } b.outline(OUTL); return b; },
  gold(o) { const b = new PB(18, 12), G0 = RPK.gmetal, n = o.n || 3; b.ell(9, 9, 8, 3, 0, () => G0[2]); for (let k = 0; k < n * 5; k++) { const x = 3 + hsh(k, 1, o.seed || 2) * 12, y = 9 - hsh(k, 2, o.seed || 2) * (2 + n); b.set(x, y, G0[4]); b.set(x + 1, y, G0[3]); b.set(x, y + 1, G0[2]); } b.ell(9, 7, 5, 3, 0, (x, y) => ((x + y) & 1) ? G0[4] : G0[3]); b.set(7, 5, G0[5]); b.outline(OUTL); return b; },
  sack(o) { const b = new PB(12, 14), C0 = RPK.thatch; b.ell(6, 8, 5, 5.5, 0, (x, y) => C0[x < 5 ? 4 : x > 8 ? 2 : 3]); b.rect(4, 1, 4, 3, C0[3]); b.hl(4, 3, 4, RPK.dwood[2]); b.outline(OUTL); return b; },
  barrel(o) { const b = new PB(14, 18), W0 = RPK.wood, M = RPK.steel; for (let y = 2; y < 17; y++) for (let x = 1; x < 13; x++) b.set(x, y, cylCol('wood', x - 1, 12, 3)); b.ell(7, 3, 6, 2, 0, () => W0[4]); b.ell(7, 3, 4, 1, 0, () => W0[3]); for (const yy of [5, 13]) for (let x = 1; x < 13; x++) b.set(x, yy, cylCol('steel', x - 1, 12, 2)); b.outline(OUTL); return b; },
  crate(o) { const b = new PB(16, 16), W0 = RPK.wood; b.rect(1, 1, 14, 4, W0[4]); b.rect(1, 5, 14, 10, W0[3]); b.hl(1, 5, 14, W0[1]); b.line(2, 6, 13, 13, W0[2]); b.line(2, 13, 13, 6, W0[2]); b.vl(1, 5, 10, W0[2]); b.vl(14, 5, 10, W0[1]); b.outline(OUTL); return b; },
  bed(o) { const b = new PB(34, 56), W0 = RPK.dwood, R0 = RPK[o.ramp || 'blue'], C0 = RPK.wine;
    b.rect(1, 0, 3, 40, W0[3]); b.rect(30, 0, 3, 40, W0[2]); b.rect(1, 0, 32, 5, C0[2]); b.hl(1, 0, 32, C0[3]); for (let x = 2; x < 32; x += 4) b.vl(x, 5, 3, C0[1]); // canopy
    b.rect(3, 5, 4, 30, C0[2]); b.rect(27, 5, 4, 30, C0[1]); // curtains
    b.rect(4, 8, 26, 10, W0[3]); b.rect(5, 16, 24, 6, RPK.white[4]); b.ell(11, 18, 5, 3, 0, () => RPK.white[4]); b.ell(23, 18, 5, 3, 0, () => RPK.white[3]); // headboard + pillows
    b.rect(4, 22, 26, 22, R0[2]); for (let y = 24; y < 44; y += 4) b.hl(5, y, 24, R0[3]); b.rect(4, 22, 26, 3, RPK.white[4]); b.vl(4, 22, 22, R0[3]); b.vl(29, 22, 22, R0[1]); b.hl(4, 43, 26, R0[0]);
    b.rect(2, 44, 30, 6, W0[2]); b.hl(2, 44, 30, W0[3]); b.rect(2, 50, 3, 5, W0[1]); b.rect(29, 50, 3, 5, W0[1]); b.outline(OUTL); return b; },
  wardrobe(o) { const b = new PB(30, 40), W0 = RPK.wood; b.rect(1, 2, 28, 36, W0[3]); b.rect(0, 0, 30, 4, W0[4]); b.hl(0, 0, 30, W0[5]); b.vl(15, 4, 34, W0[1]); b.rect(3, 6, 10, 28, W0[2]); b.rect(17, 6, 10, 28, W0[2]); b.set(13, 20, RPK.gold[4]); b.set(17, 20, RPK.gold[4]); b.rect(1, 36, 28, 2, W0[1]); b.outline(OUTL); return b; },
  candelabra(o, f) { const b = new PB(14, 26), G0 = RPK.gmetal; b.vl(6, 8, 16, G0[3]); b.vl(7, 8, 16, G0[2]); b.rect(3, 23, 8, 3, G0[2]); b.hl(2, 8, 10, G0[3]); for (const x of [2, 6, 11]) { b.rect(x, 4, 2, 4, RPK.ivory[4]); b.set(x, 3 - (f + x) % 2, RPK.fire[4]); b.set(x, 2 - (f + x) % 2, RPK.fire[5]); } b.outline(OUTL); return b; },
  lectern(o) { const b = new PB(16, 24), W0 = RPK.wood; b.rect(6, 10, 4, 12, W0[2]); b.rect(3, 21, 10, 3, W0[1]); b.poly([[1, 6], [15, 2], [15, 9], [1, 12]], 0, () => W0[3]); b.rect(3, 3, 11, 6, RPK.ivory[4]); b.vl(8, 3, 6, RPK.parch[1]); b.outline(OUTL); return b; },
  globe(o) { const b = new PB(16, 24), W0 = RPK.wood; b.rect(7, 14, 2, 8, W0[2]); b.rect(3, 21, 10, 3, W0[1]); b.ell(8, 8, 6, 6, 0, (x, y) => (hsh(x >> 1, y >> 1, 3) > 0.55 ? hx('#7ab060') : hx('#4a7ab8'))); b.ell(6, 6, 2, 2, 0, () => hx('#a8d4f2')); b.vl(1, 2, 12, RPK.gmetal[3]); b.outline(OUTL); return b; },
  mapboard(o) { const b = new PB(32, 26), W0 = RPK.wood; b.rect(0, 0, 32, 26, W0[2]); b.rect(2, 2, 28, 22, RPK.parch[3]); for (let k = 0; k < 6; k++) b.ell(5 + hsh(k, 4, 5) * 22, 5 + hsh(k, 6, 5) * 15, 3, 2, 0, () => hx('#9ac070')); const pins = [[7, 6], [24, 9], [14, 18], [26, 20], [9, 15]]; for (let i = 0; i < pins.length - 1; i++) b.line(pins[i][0], pins[i][1], pins[i + 1][0], pins[i + 1][1], hx('#b02838')); for (const [x, y] of pins) { b.set(x, y, hx('#e8e0d8')); b.set(x, y - 1, hx('#d02838')); } b.outline(OUTL); return b; },
  cage(o, f) { const b = new PB(14, 18), M = RPK.gmetal; b.ell(7, 4, 6, 4, 0, (x, y) => y < 3 ? M[3] : null); for (let x = 1; x < 14; x += 3) b.vl(x, 3, 12, M[2]); b.hl(1, 15, 13, M[3]); b.hl(1, 9, 13, M[2]); b.ell(7, 12, 2.5, 2, 0, () => RPK.gray[3]); b.set(5 + (f % 2), 11, RPK.gray[4]); b.outline(OUTL); return b; },
  armor(o) { const b = new PB(16, 32), S = RPK.steel; b.rect(7, 26, 2, 4, RPK.dwood[2]); b.rect(3, 29, 10, 3, RPK.dwood[1]); b.ell(8, 6, 4, 4.5, 0, (x) => S[x < 7 ? 4 : 2]); b.rect(7, 6, 2, 3, hx('#1a1418')); b.rect(3, 11, 10, 12, S[3]); b.vl(3, 11, 12, S[4]); b.vl(12, 11, 12, S[1]); b.ell(3, 12, 2.5, 2, 0, () => S[4]); b.ell(13, 12, 2.5, 2, 0, () => S[2]); b.rect(5, 23, 6, 4, S[2]); b.outline(OUTL); return b; },
  plant(o) { const b = new PB(14, 20), C0 = RPK.rred; b.rect(3, 12, 8, 7, C0[3]); b.hl(2, 12, 10, C0[4]); b.vl(10, 12, 7, C0[2]); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r0 = 3 + hsh(k, 2, 3) * 3; b.set(7 + Math.cos(a) * r0, 7 + Math.sin(a) * r0 * 0.8, RPK.leaf[3 + (k % 3)]); } b.ell(7, 7, 3, 3, 0, () => RPK.leaf[4]); b.outline(OUTL); return b; },
  crib(o) { const b = new PB(20, 18), W0 = RPK.wood; b.rect(1, 4, 18, 12, W0[3]); b.rect(2, 5, 16, 6, RPK.ivory[4]); b.ell(7, 7, 3, 2.4, 0, () => RPK.skin1[3]); for (let x = 2; x < 19; x += 3) b.vl(x, 10, 6, W0[2]); b.hl(1, 4, 18, W0[5]); b.outline(OUTL); return b; },
  toys(o) { const b = new PB(18, 12); b.rect(1, 6, 4, 4, RPK.red[3]); b.rect(5, 7, 4, 3, RPK.blue[3]); b.rect(3, 3, 4, 3, RPK.gold[3]); b.ell(13, 8, 3.5, 2.4, 0, () => RPK.wood[4]); b.vl(11, 3, 4, RPK.wood[3]); b.set(10, 3, RPK.wood[4]); b.outline(OUTL); return b; },
  statue(o) { const b = new PB(20, 46), S = RPK.stone; b.rect(2, 34, 16, 10, S[3]); b.hl(2, 34, 16, S[5]); b.rect(1, 44, 18, 2, S[2]); b.ell(10, 7, 4, 4.5, 0, (x) => S[x < 9 ? 5 : 3]); b.poly([[4, 13], [16, 13], [17, 34], [3, 34]], 0, (x) => S[x < 8 ? 5 : x > 13 ? 3 : 4]); b.vl(15, 4, 30, S[2]); b.set(15, 3, S[5]); b.outline(OUTL); return b; },
  stairs(o) { const b = new PB(32, 56), W0 = RPK.wood, S = RPK.stone; b.rect(0, 0, 32, 10, hx('#0e0a12')); for (let k = 0; k < 8; k++) { const y = 8 + k * 6; b.rect(3, y, 26, 6, W0[k % 2 ? 3 : 4]); b.hl(3, y, 26, W0[5]); b.hl(3, y + 5, 26, W0[1]); } b.rect(0, 4, 3, 52, S[4]); b.rect(29, 4, 3, 52, S[2]); b.vl(0, 4, 52, S[5]); b.outline(OUTL); return b; },
  shelfs(o) { const b = new PB(32, 40), W0 = RPK.dwood; b.rect(0, 0, 32, 40, W0[2]); b.rect(0, 0, 32, 3, W0[4]); for (let sh = 0; sh < 4; sh++) { const y0 = 4 + sh * 9; b.rect(2, y0, 28, 8, W0[0]); b.hl(1, y0 + 8, 30, W0[3]); for (let k = 0; k < 6; k++) { const x = 3 + k * 4.5; if (hsh(k, sh, o.seed || 3) < 0.25) continue; b.ell(x + 1.5, y0 + 6, 2, 1.6, 0, () => RPK.parch[3]); b.set(x + 1, y0 + 6, RPK.parch[1]); } } b.outline(OUTL); return b; },
  scales(o) { const b = new PB(16, 14), G0 = RPK.gmetal; b.vl(8, 1, 11, G0[3]); b.hl(2, 2, 13, G0[4]); b.ell(3, 7, 2.6, 1.2, 0, () => G0[3]); b.ell(13, 6, 2.6, 1.2, 0, () => G0[3]); b.line(3, 2, 2, 6, G0[2]); b.line(13, 2, 14, 5, G0[2]); b.rect(5, 12, 7, 2, G0[2]); b.outline(OUTL); return b; },
};
// heraldry helpers (used by banners/shields; houses defined in dynasty.js)
function heraldDiv(H0, x, y, w, h) { switch (H0.div) { case 'pale': return x >= w / 2; case 'fess': return y >= h * 0.45; case 'bend': return x - y * (w / h) > -1 && x - y * (w / h) < 4; case 'chevron': return Math.abs(x - w / 2) * 1.2 > (y - h * 0.3) * 1.0 - 2 && Math.abs(x - w / 2) * 1.2 < (y - h * 0.3) + 2; case 'quarter': return (x >= w / 2) !== (y >= h / 2); case 'chief': return y < h * 0.28; case 'bordure': return x < 2 || x >= w - 2 || y < 2 || y >= h - 2; default: return false; } }
const HCHG = { star: '..y..|.yyy.|yyyyy|.y.y.', tower: 'y.y.y|yyyyy|.yyy.|.y.y.', tree: '.yyy.|yyyyy|.yyy.|..y..', moon: '.yy..|y....|y....|.yy..', key: '.yy..|y..y.|.yy..|..y..|..yy.', boar: '.....|yyyy.|yyyyy|y..y.', fish: '..y..|.yyy.|yyyyy|.yyy.|y.y.y', hand: 'y.y.y|yyyyy|yyyy.|.yyy.', bell: '.yyy.|.yyy.|yyyyy|..y..', ship: '..y..|.yy..|yyyyy|.yyy.', stag: 'y...y|.y.y.|.yyy.|.y.y.', rose: '.y.y.|yyyyy|.yyy.|..y..' };
function heraldCharge(b, H0, x0, y0) { const rows = (HCHG[H0.charge] || HCHG.star).split('|'); const C0 = RPK[H0.ramp3 || 'white']; rows.forEach((r, yy) => { for (let xx = 0; xx < r.length; xx++) if (r[xx] === 'y') b.set(x0 + xx, y0 + yy, C0[xx < 2 ? 4 : 3]); }); }
// cache frames of objects
const OBJC = {};
function objSprite(k, o, f) { const key = k + '|' + (o.ck || '') + '|' + (f || 0); let c = OBJC[key]; if (!c) { const b = OBJP[k](o, f || 0); c = b.canvas(); c.pb = b; OBJC[key] = c; } return c; }
