'use strict';
// ===== CHARS: walking sprites 16x32 (4 directions x 4 frames) built from the same "look" as portraits =====
const WALK = {}; // cache key -> canvas
const DIRS = ['down', 'left', 'right', 'up'];
function walkerKey(L, d, f, small) { return L.key + '|' + L.skin + L.hair + L.hs + L.o + L.cl + L.hat + '|' + d + f + (small ? 's' : ''); }
function walkerSprite(c, dir, f) {
  const L = c.look || lookOf(c), small = L.child; const k = walkerKey(L, dir, f, small) + (c.id || 0); if (WALK[k]) return WALK[k];
  let b;
  if (dir === 'right') { b = walkerPB(L, 'left', f, small, c).flipX(); } else b = walkerPB(L, dir, f, small, c);
  const cv2 = b.canvas(); WALK[k] = cv2; return cv2;
}
function walkerPB(L, dir, f, small, c) {
  const b = new PB(16, 32), SK = RPK[L.skin], HR = RPK[L.hair], CL = RPK[L.cl] || RPK.brown, ST = RPK.steel, GM = RPK.gmetal;
  const BOOT = RPK.dwood, HOSE = L.o === 'armor' || L.o === 'mail' ? RPK.steel : RPK[L.cl === 'black' ? 'gray' : 'brown'];
  const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = step !== 0 ? -1 : 0;
  const dy0 = (small ? 7 : 0) + bob; // vertical offset of upper body
  const long = L.o === 'robe' || L.o === 'monk' || L.o === 'dress' || L.o === 'judge' || L.o === 'cloak' || (L.fem && L.o !== 'armor' && L.o !== 'mail' && L.o !== 'fur');
  const cape = L.o === 'royal' || c.seat === 'marshal' || L.o === 'fur';
  const torsoH = small ? 6 : 9, legTop = 16 + torsoH + dy0 - bob, legLen = small ? 4 : 6;
  const shade = (R0, x, x0, w, base) => { const t = (x - x0 + 0.5) / w; let i = base; if (t < 0.3) i++; else if (t > 0.72) i--; return R0[clamp(i, 0, R0.length - 1)]; };
  const ARMC = L.o === 'armor' ? ST : L.o === 'mail' ? ST : CL;
  // --- legs / skirt
  if (!long) {
    if (dir === 'down' || dir === 'up') {
      const lL = step > 0 ? legLen - 2 : legLen, lR = step < 0 ? legLen - 2 : legLen;
      for (const [x0, ln] of [[4, lL], [9, lR]]) { for (let y = 0; y < ln; y++) for (let x = 0; x < 3; x++) { const yy = legTop + y; b.set(x0 + x, yy, y >= ln - 2 ? (x === 0 ? BOOT[3] : BOOT[2]) : shade(HOSE, x, 0, 3, 2)); } }
    } else {
      const sp = step === 0 ? 0 : 2; const legs = step === 0 ? [[6, 0]] : [[6 - sp, 1], [7 + sp, -1]];
      for (const [x0, lean] of legs) for (let y = 0; y < legLen; y++) { const xo = Math.round(lean * (y / legLen) * -1.5); for (let x = 0; x < 3; x++) b.set(x0 + x + xo, legTop + y, y >= legLen - 2 ? (x === 0 ? BOOT[3] : BOOT[2]) : shade(HOSE, x, 0, 3, 2)); }
      if (step === 0) for (let x = 5; x < 10; x++) b.set(x, legTop + legLen - 1, BOOT[2]);
    }
  }
  // --- cape behind (side & back views)
  const CPC = L.o === 'royal' ? RPK.red : L.o === 'fur' ? RPK.brown : RPK[c.realm === 0 ? 'blue' : 'red'];
  if (cape && dir === 'left') for (let y = 15 + dy0; y < 30; y++) for (let x = 9; x < 13; x++) if (x - 9 < 2 + (y - 15) / 6) b.set(x, y, CPC[x > 10 ? 1 : 2]);
  // --- torso
  const tx0 = dir === 'left' ? 4 : 3, tw0 = dir === 'left' ? 8 : 10, ty0 = 15 + dy0;
  const tEnd = long ? 30 : ty0 + torsoH;
  for (let y = ty0; y < tEnd; y++) { let xa = tx0, wa = tw0; if (long && y > ty0 + torsoH - 2) { const fl = Math.min(2, Math.floor((y - ty0 - torsoH + 2) / 2)); xa -= fl; wa += fl * 2; if (dir === 'left') { xa = tx0 - Math.min(1, fl); wa = tw0 + Math.min(2, fl); } }
    for (let x = xa; x < xa + wa; x++) { let col;
      if (L.o === 'armor') col = shade(ST, x, xa, wa, 3); else if (L.o === 'mail') col = ((x + y) & 1) ? shade(ST, x, xa, wa, 3) : shade(ST, x, xa, wa, 2); else col = shade(CL, x, xa, wa, 3);
      if ((L.o === 'armor' || L.o === 'mail') && dir !== 'up' && x >= xa + 2 && x < xa + wa - 2 && y > ty0 + 2) col = shade(CL, x, xa, wa, 3); // tabard
      if (L.o === 'royal' && y <= ty0 + 1) col = (x + y) % 3 === 0 ? hx('#1a1418') : hx('#f2eef0');
      if (L.apron && dir !== 'up' && x > xa + 1 && x < xa + wa - 2 && y > ty0 + 2) col = RPK.ivory[3];
      if (long && y >= 29) col = shade(CL, x, xa, wa, 2);
      b.set(x, y, col); } }
  // belt
  if (!long || L.o === 'robe') { const by = ty0 + torsoH - 2; for (let x = tx0; x < tx0 + tw0; x++) b.set(x, by, RPK.dwood[x === tx0 + (dir === 'left' ? 3 : 5) ? 4 : 2]); if (dir === 'down') b.set(tx0 + 5, by, GM[4]); }
  if (long) { for (let x = 1; x < 15; x++) if (b.get(x, 29)) b.set(x, 30, CL[1]); if (dir !== 'up') { b.set(5 + (step > 0 ? -1 : 0), 31, BOOT[2]); b.set(6 + (step > 0 ? -1 : 0), 31, BOOT[2]); b.set(9 + (step < 0 ? 1 : 0), 31, BOOT[2]); b.set(10 + (step < 0 ? 1 : 0), 31, BOOT[2]); } }
  if (L.chain && dir === 'down') for (let x = 4; x < 12; x++) b.set(x, ty0 + 1 + (x === 4 || x === 11 ? 0 : x === 5 || x === 10 ? 1 : 2), (x & 1) ? GM[4] : GM[2]);
  if (L.stole && dir === 'down') for (let y = ty0; y < ty0 + 8; y++) { b.set(4, y, RPK[L.stole][3]); b.set(11, y, RPK[L.stole][2]); }
  if (L.o === 'judge' && dir === 'down') { b.set(7, ty0, RPK.white[4]); b.set(8, ty0, RPK.white[4]); b.set(7, ty0 + 1, RPK.white[3]); b.set(8, ty0 + 1, RPK.white[3]); }
  // --- arms
  const armLen = small ? 6 : 8;
  if (dir === 'down' || dir === 'up') {
    for (const [x0, sgn] of [[1, 1], [13, -1]]) { const sw = step * sgn; for (let y = 0; y < armLen; y++) { const yy = ty0 + 1 + y + (y > 2 ? sw : 0); const hand = y >= armLen - 2; for (let x = 0; x < 2; x++) b.set(x0 + x, yy, hand ? SK[x === 0 ? 3 : 2] : (x === (sgn > 0 ? 0 : 1) ? shade(ARMC, 0, 0, 3, 3) : ARMC[2])); } }
  } else {
    const sw = step; const ax = 6 - sw; for (let y = 0; y < armLen; y++) { const xo = Math.round(sw * -(y / armLen) * 2); const hand = y >= armLen - 2; for (let x = 0; x < 3; x++) b.set(ax + x + xo, ty0 + 1 + y, hand ? SK[x === 0 ? 3 : 2] : (x === 0 ? ARMC[4] : x === 1 ? ARMC[3] : ARMC[2])); }
  }
  // --- cape in back view (over torso)
  if (cape && dir === 'up') for (let y = ty0; y < 30; y++) { const fl = Math.min(2, Math.floor((y - ty0) / 5)); for (let x = 2 - fl; x < 14 + fl; x++) b.set(x, y, CPC[x < 4 ? 3 : x > 11 ? 1 : 2]); }
  if (cape && dir === 'down') for (let y = ty0 + 1; y < 29; y++) { b.set(1, y, CPC[1]); b.set(14, y, CPC[1]); }
  // --- head
  const hy = dy0; // head top offset
  const hcx = 8, hcy = 8.5 + hy, hrx = dir === 'left' ? 5.6 : 6.2, hry = 6.6;
  b.ell(hcx, hcy, hrx, hry, 0, (x, y) => { const u = (x + 0.5 - hcx) / hrx; return SK[u < -0.35 ? 3 : u > 0.45 ? 1 : 2]; });
  // face features
  const EYD = hx('#2a1a22');
  if (dir === 'down') { b.set(5, 9 + hy, EYD); b.set(5, 10 + hy, EYD); b.set(10, 9 + hy, EYD); b.set(10, 10 + hy, EYD); b.set(1, 10 + hy, SK[1]); b.set(14, 10 + hy, SK[1]);
    if (L.fem || L.child) { b.set(4, 12 + hy, cmix(SK[2], hx('#e86a6a'), 0.4)); b.set(11, 12 + hy, cmix(SK[2], hx('#e86a6a'), 0.4)); } else b.set(7, 13 + hy, SK[1]), b.set(8, 13 + hy, SK[1]); }
  if (dir === 'left') { b.set(4, 9 + hy, EYD); b.set(4, 10 + hy, EYD); b.set(2, 11 + hy, SK[3]); b.set(1, 11 + hy, SK[2]); b.set(8, 10 + hy, SK[1]); }
  // beard
  if (L.beard && L.beard !== 'none' && L.beard !== 'stubble' && !L.child) { const bc = HR[2], bd = HR[1];
    if (dir === 'down') { for (let x = 3; x < 13; x++) for (let y = 12 + hy; y <= 15 + hy; y++) { const ok = y >= 13 + hy || x < 5 || x > 10; if (!ok) continue; if (L.beard === 'mustache' && y > 12 + hy) continue; if (L.beard === 'goatee' && (x < 6 || x > 9) && y > 12 + hy) continue; if (b.get(x, y) || y === 15 + hy) b.set(x, y, x > 9 ? bd : bc); } if (L.beard === 'long') for (let y = 16 + hy; y < 19 + hy; y++) for (let x = 5; x < 11; x++) b.set(x, y, x > 8 ? bd : bc); }
    if (dir === 'left') { for (let x = 2; x < 8; x++) for (let y = 12 + hy; y <= 15 + hy; y++) if (b.get(x, y) || y === 15 + hy) b.set(x, y, x > 5 ? bd : bc); }
  }
  // hair
  const hs = L.hs, hat = L.hat; const hood = hat === 'hood' || hat === 'hoodcl' || hat === 'veil' || hat === 'kerchief';
  if (hs !== 'bald' && !hood) {
    const longH = hs === 'longf' || hs === 'curlyf' || hs === 'long' || hs === 'braid';
    for (let y = 1 + hy; y < 16 + hy + (longH ? 6 : 0); y++) for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - hcx, dyy = y + 0.5 - hcy; const inHead = (dx * dx) / ((hrx + 0.8) ** 2) + (dyy * dyy) / ((hry + 0.9) ** 2) <= 1;
      let cover = false;
      if (dir === 'up') cover = inHead || (longH && y >= 9 + hy && Math.abs(dx) < hrx + 0.3);
      else if (dir === 'down') { const fringe = hs === 'crop' ? 5 : hs === 'receding' ? 4 : L.fem ? 7 : 6; cover = inHead && (y < fringe + hy + (Math.abs(dx) < 2 ? 0 : 0) || Math.abs(dx) > hrx - 1.4 && y < (longH ? 17 : 11) + hy); if (longH && Math.abs(dx) > hrx - 1.5 && Math.abs(dx) < hrx + 1 && y >= 9 + hy && y < 20 + hy) cover = true; }
      else { cover = inHead && (y < 6 + hy || dx > -0.5 && y < 12 + hy || (dx > 2.5 && y < 15 + hy)); if (longH && dx > 0 && dx < hrx + 1 && y >= 9 + hy && y < 21 + hy) cover = true; if (hs === 'tied' || hs === 'tiedf') { if (dx > 4 && dx < 7 && y >= 9 + hy && y < 15 + hy) cover = true; } }
      if (!cover) continue; let i = 2; if (dx > hrx * 0.3) i = 1; if (dx < -1.5 && y < 4 + hy) i = 3; if ((x * 3 + y) % 5 === 0 && i === 2) i = 3;
      b.set(x, y, HR[i]);
    }
    if (hs === 'bun' && dir !== 'down') b.ell(8, 1.5 + hy, 2.6, 2.2, 0, (x) => HR[x > 8 ? 1 : 2]);
    if (hs === 'bun' && dir === 'down') b.ell(8, 1 + hy, 2.4, 1.8, 0, (x) => HR[x > 8 ? 1 : 3]);
  }
  // headwear
  if (hat === 'crown' || hat === 'tiara' || hat === 'circlet') { const yb = hat === 'crown' ? 2 + hy : 4 + hy; const x0 = dir === 'left' ? 3 : 3, x1 = dir === 'left' ? 12 : 13; for (let x = x0; x < x1; x++) { b.set(x, yb, GM[x > 10 ? 2 : 4]); if (hat === 'crown') b.set(x, yb + 1, GM[x > 10 ? 2 : 3]); }
    if (hat === 'crown') for (const px0 of [3, 6, 9, 12]) if (px0 < x1) { b.set(px0, yb - 1, GM[4]); if (px0 === 6 || px0 === 9) b.set(px0, yb - 2, GM[5]); }
    if (dir === 'down' && hat !== 'circlet') b.set(7, yb + (hat === 'crown' ? 1 : 0), hx('#d02838')); }
  else if (hat === 'helm') { b.ell(8, 6 + hy, hrx + 0.9, 5.4, 0, (x, y) => y > 8 + hy ? null : ST[(x + 0.5 - 8) < -2 ? 4 : (x + 0.5 - 8) > 2 ? 2 : 3]); for (let x = 1; x < 15; x++) if (b.get(x, 8 + hy)) b.set(x, 8 + hy, ST[1]); if (dir === 'down') { b.set(7, 9 + hy, ST[3]); b.set(7, 10 + hy, ST[3]); b.set(8, 9 + hy, ST[2]); b.set(8, 10 + hy, ST[2]); } if (dir === 'left') { b.set(2, 9 + hy, ST[3]); b.set(2, 10 + hy, ST[3]); } }
  else if (hat === 'cap' || hat === 'skull' || hat === 'doge' || hat === 'chef' || hat === 'furhat') { const R0 = hat === 'skull' ? RPK.black : hat === 'chef' ? RPK.white : hat === 'doge' ? RPK.gold : hat === 'furhat' ? RPK.brown : CL; const ry = hat === 'chef' ? 4 : 2.4, cy = hat === 'chef' ? 1.5 + hy : 2.4 + hy; b.ell(dir === 'left' ? 7.5 : 7.4, cy, hat === 'skull' ? 4.6 : 7, ry, 0, (x) => R0[x > 9 ? 2 : x < 5 ? 4 : 3]); if (hat === 'cap') for (let x = 1; x < 15; x++) if (b.get(x, 4 + hy)) b.set(x, 4 + hy, R0[1]); }
  else if (hood) { const R0 = hat === 'veil' ? RPK.ivory : hat === 'kerchief' ? RPK.wine : hat === 'hoodcl' ? CL : RPK.black; const bottom = hat === 'kerchief' ? 7 : 17;
    for (let y = 0 + hy; y < bottom + hy; y++) for (let x = 0; x < 16; x++) { const dx = x + 0.5 - hcx, dyy = y + 0.5 - (hcy + 1); const inH = (dx * dx) / ((hrx + 1.3) ** 2) + (dyy * dyy) / ((hry + 2) ** 2) <= 1; if (!inH) continue;
      let face = false; if (dir === 'down') face = y >= 5 + hy && Math.abs(dx) < hrx - 1.6 && y < 15 + hy; if (dir === 'left') face = y >= 5 + hy && dx < 0.5 && dx > -hrx && y < 15 + hy; if (face) continue;
      b.set(x, y, R0[dx > 2 ? 1 : dx < -2 ? 3 : 2]); }
    if (dir === 'down') for (let x = 3; x < 13; x++) if (b.get(x, 5 + hy) && b.get(x, 6 + hy) === SK[2]) b.set(x, 6 + hy, SK[1]); }
  else if (hat === 'straw') { for (let x = 0; x < 16; x++) { b.set(x, 5 + hy, RPK.thatch[x > 11 ? 2 : 3]); b.set(x, 6 + hy, RPK.thatch[2]); } b.ell(8, 3 + hy, 5, 2.6, 0, (x) => RPK.thatch[x > 9 ? 2 : 4]); }
  else if (hat === 'laurel') { for (let x = 3; x < 13; x++) b.set(x, 4 + hy, (x & 1) ? hx('#4a8a3a') : hx('#7ab84e')); }
  else if (hat === 'mitre') { b.poly([[4, 4 + hy], [12, 4 + hy], [10, -2 + hy], [8, -4 + hy], [6, -2 + hy]], 0, (x) => x === 8 ? GM[4] : RPK.white[x > 9 ? 2 : 4]); }
  b.outline(OUTL);
  return b;
}
// a horse in side view, facing left (32×26): sloping neck with a mane, long head, jointed legs with hooves
function horsePB(f, col) { // side view facing left, 32×26
  const b = new PB(32, 26), C0 = RPK[col || 'brown'] || RPK.brown, wh = col === 'white';
  const MN = wh ? RPK.gray : col === 'dwood' ? RPK.black : RPK.dwood, HO = RPK.black, EYE = hx('#120a10');
  const tone = (y, d) => C0[clamp((y < 10 ? 4 : y < 13 ? 3 : y < 15 ? 2 : 1) - (d || 0), 0, 4)];
  // legs: far pair first (darker), then near pair; phase f swaps which diagonal pair steps forward
  const leg = (x, hind, fwd, dark) => { const C = i => C0[clamp(i - dark, 0, 4)], lx = fwd ? -1 : 0, up = fwd ? 1 : 0;
    if (hind) { for (let y = 14; y < 19; y++) { b.set(x, y, C(3)); b.set(x + 1, y, C(2)); b.set(x + 2, y, C(2)); }
      b.set(x + 1, 19, C(2)); b.set(x + 2, 19, C(1)); // hock
      for (let y = 20; y < 24 - up; y++) { b.set(x + 1 + lx, y, C(3)); b.set(x + 2 + lx, y, C(2)); } }
    else { for (let y = 15; y < 19; y++) { b.set(x, y, C(3)); b.set(x + 1, y, C(2)); b.set(x + 2, y, C(2)); }
      b.set(x, 19, C(3)); b.set(x + 1, 19, C(2)); // knee
      for (let y = 20; y < 24 - up; y++) { b.set(x + lx, y, C(3)); b.set(x + 1 + lx, y, C(2)); } }
    const hx0 = (hind ? x + 1 : x) + lx, hy = 24 - up; b.set(hx0, hy, HO[2]); b.set(hx0 + 1, hy, HO[2]); b.set(hx0 - 1, hy + 1, HO[3]); b.set(hx0, hy + 1, HO[3]); b.set(hx0 + 1, hy + 1, HO[2]); };
  const p = f % 2;
  leg(12, 0, p === 1, 1); leg(24, 1, p === 0, 1); // far legs
  // tail (behind body)
  b.poly([[26, 9], [29, 10], [30, 15], [31, 21], [29, 22], [28, 17], [26, 12]], 0, (x, y) => MN[y < 13 ? 2 : (x + y) % 3 ? 2 : 1]);
  // body: barrel, chest, hindquarters
  b.ell(17.5, 12.6, 9.2, 4.3, 0, (x, y) => tone(y));
  b.ell(10.6, 12.4, 3.6, 4.0, 0, (x, y) => tone(y));
  b.ell(24.2, 11.9, 4.2, 4.4, 0, (x, y) => tone(y));
  // neck: thick at the shoulder, narrowing to the poll
  b.poly([[7, 2], [10, 1], [18, 9], [13, 13], [8, 12], [6, 6]], 0, (x, y) => tone(y + 2));
  // head: long wedge pointing down-forward, rounded cheek, soft muzzle
  b.poly([[5, 1], [9, 1], [9, 5], [5, 9], [2, 11], [0, 10], [0, 8], [3, 4]], 0, (x, y) => C0[y < 4 ? 4 : y < 8 ? 3 : 3]);
  b.ell(7.4, 4.6, 2.4, 2.4, 0, (x, y) => C0[y < 4 ? 4 : 3]);
  b.ell(1.6, 9.4, 1.8, 1.6, 0, () => C0[wh ? 3 : 2]); // muzzle
  b.set(0, 9, C0[1]); b.set(2, 11, C0[1]); b.set(1, 10, C0[1]); // nostril, mouth
  b.set(6, 3, EYE); b.set(7, 3, C0[2]);
  b.set(7, 0, C0[3]); b.set(8, 0, C0[2]); b.set(9, 0, C0[3]); // ears
  // mane along the crest + forelock
  for (const [x, y] of [[9, 1], [10, 1], [10, 2], [11, 2], [11, 3], [12, 3], [12, 4], [13, 4], [13, 5], [14, 5], [14, 6], [15, 6], [15, 7], [16, 7], [16, 8], [17, 8]]) b.set(x, y, MN[2]);
  for (const [x, y] of [[10, 3], [11, 4], [12, 5], [13, 6], [14, 7]]) b.set(x, y, MN[1]);
  b.set(6, 1, MN[2]); b.set(5, 2, MN[2]);
  // belly shadow & shoulder line
  for (let x = 12; x < 23; x++) if (b.get(x, 16)) b.set(x, 16, C0[1]);
  for (const [x, y] of [[8, 6], [7, 7], [6, 8], [5, 9], [9, 7], [9, 8]]) b.set(x, y, C0[2]); // jaw line & throat
  leg(9, 0, p === 0, 0); leg(21, 1, p === 1, 0); // near legs
  b.outline(OUTL); return b; }
// ---------- small animals and props that walk ----------
function animalPB(kind, f, dir) {
  if (kind === 'horse') return horsePB(f, dir);
  if (FAUNA[kind]) return FAUNA[kind](f, dir);
  if (kind === 'dog') { const b = new PB(16, 12), C0 = RPK.orange; b.ell(8, 6, 5, 2.8, 0, (x, y) => C0[y < 5 ? 4 : 3]); b.ell(3, 4, 2.4, 2.2, 0, () => C0[4]); b.set(2, 3, hx('#1a1418')); b.set(1, 5, hx('#1a1418')); b.set(4, 2, C0[1]); const l = f % 2; for (const [x, p] of [[5, 0], [11, 1]]) { const up = p === l ? 1 : 0; b.set(x, 9 - up, C0[2]); b.set(x, 10 - up, C0[1]); b.set(x + 1, 9, C0[2]); } b.set(13, 4 - l, C0[3]); b.set(14, 3 - l, C0[3]); b.outline(OUTL); return b; }
  if (kind === 'cat') { const b = new PB(12, 10), C0 = RPK.gray; b.ell(6, 6, 4, 2.2, 0, (x, y) => C0[y < 5 ? 3 : 2]); b.ell(2.5, 4, 2, 1.8, 0, () => C0[3]); b.set(1, 2, C0[2]); b.set(3, 2, C0[2]); b.set(2, 4, hx('#e8d040')); b.set(10, 4 - (f % 2), C0[3]); b.set(11, 3, C0[3]); b.set(4, 8, C0[1]); b.set(8, 8, C0[1]); b.outline(OUTL); return b; }
  if (kind === 'hen') { const b = new PB(10, 10), C0 = RPK.white; b.ell(5, 6, 3.4, 2.6, 0, (x, y) => C0[y < 6 ? 4 : 3]); b.ell(2.5, 3.5, 1.6, 1.6, 0, () => C0[4]); b.set(2, 1, hx('#d02838')); b.set(0, 4, hx('#e8a030')); b.set(2, 3, hx('#1a1418')); b.set(4, 9, hx('#e8a030')); b.set(6, 9, hx('#e8a030')); if (f % 2) b.set(1, 5, hx('#e8a030')); b.outline(OUTL); return b; }
  if (kind === 'pigeon') { const b = new PB(8, 6), C0 = RPK.gray; const w = f % 2; b.ell(4, 3, 2.4, 1.4, 0, () => C0[3]); if (w) { b.set(2, 0, C0[4]); b.set(6, 0, C0[4]); b.set(3, 1, C0[4]); b.set(5, 1, C0[4]); } else { b.set(1, 3, C0[2]); b.set(7, 3, C0[2]); } b.set(1, 2, C0[4]); b.outline(OUTL); return b; }
  return ANIM_EXT[kind] ? ANIM_EXT[kind](f, dir) : new PB(4, 4);
}
const ANIM = {}; function animalSprite(kind, f, flip, col) { const k = kind + f + (flip ? 'f' : '') + (col || ''); if (!ANIM[k]) { let b = animalPB(kind, f, col); if (flip) b = b.flipX(); ANIM[k] = b.canvas(); } return ANIM[k]; }
