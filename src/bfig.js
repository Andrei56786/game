'use strict';
// ===== BFIG: battle figures — PB-drawn soldiers per type with frames (stand / walk / attack), outlined, in realm colours =====
const FIGF = {};
function figRamp(col, dark) { const m = hx(col), d = hx(dark); return { m, d, l: cmix(m, hx('#ffffff'), 0.32), dd: cmix(d, hx('#000000'), 0.4) }; }
const FIG_FRAMES = { foot: ['stand', 'walk1', 'walk2', 'atk', 'flag1', 'flag2'], horse: ['stand', 'walk1', 'walk2', 'atk', 'chg1', 'chg2', 'flag1', 'flag2'] };
function figFrames(type, col, dark) { const k = type + col; if (FIGF[k]) return FIGF[k]; const R = figRamp(col, dark), o = {}, M = MOUNTED[type];
  for (const fr of FIG_FRAMES[M ? 'horse' : 'foot']) { const b = M ? figHorse(fr, R, type) : figFoot(type, fr, R); b.outline(OUTL); const c = b.canvas(); c.fy = M ? 19 : b.h - 2; c.cx = M ? 11 : 8; o[fr] = c; }
  return (FIGF[k] = o); }
// a little flag on a pole: cloth top-left at (x,y), w×h, waving phase ph (0/1)
function figBanner(b, x, y, w, h, R, ph) { for (let i = 0; i < w; i++) { const dy = ph ? (i % 4 === 1 || i % 4 === 2 ? 1 : 0) : (i % 4 === 3 || i % 4 === 0 ? 1 : 0); for (let j = 0; j < h; j++) b.put(x + i, y + j + dy, j === 0 ? R.l : j === h - 1 ? R.d : (i === 1 || i === 2) && j === 2 ? R.l : R.m); } }
function figFoot(type, fr, R) {
  const flag = fr === 'flag1' || fr === 'flag2', top = flag ? 8 : 0, b = new PB(18, 16 + top), X = 6, Y = 3 + top; // torso X..X+4 (y Y+4..Y+8), head X+1..X+3 (y Y+1..Y+3), feet at Y+11
  const skin = rp('skin1', 3), skinS = rp('skin1', 2), eye = hx('#2a1a14'), st = i => rp('steel', i), wd = i => rp('wood', i);
  const boot = hx('#2a1e1a'), belt = hx('#3c2416'), trou = type === 'levy' ? hx('#6a5840') : hx('#3e3846');
  const walk = fr === 'walk1' ? 1 : fr === 'walk2' ? 2 : 0, atk = fr === 'atk';
  // legs: [x at hip, x at foot]
  const legs = walk === 1 || (atk && type !== 'archer') ? [[X + 1, X], [X + 3, X + 4]] : walk === 2 ? [[X + 2, X + 1], [X + 2, X + 3]] : [[X + 1, X + 1], [X + 3, X + 3]];
  for (const [h, f] of legs) { b.put(h, Y + 9, trou); b.put(Math.round((h + f) / 2), Y + 10, trou); b.put(f, Y + 11, boot); b.put(f + 1, Y + 11, boot); }
  // torso
  if (type === 'xbow') { b.rect(X - 4, Y + 2, 3, 9, R.m); b.vl(X - 4, Y + 2, 9, R.l); b.vl(X - 2, Y + 2, 9, R.d); b.hl(X - 4, Y + 1, 3, R.d); b.vl(X - 3, Y + 4, 3, hx('#f4ecd8')); b.put(X - 3, Y + 10, R.dd); } // pavise slung on the back
  const tun = type === 'levy' ? { l: cmix(hx('#a08a62'), R.l, 0.25), m: cmix(hx('#8a7452'), R.m, 0.25), d: hx('#5a4a34') } : type === 'xbow' ? { l: cmix(hx('#d8c8a0'), R.l, 0.3), m: cmix(hx('#b4a47c'), R.m, 0.3), d: cmix(hx('#7a6a48'), R.d, 0.3) } : R;
  for (let y = Y + 4; y <= Y + 8; y++) for (let x = X; x <= X + 4; x++) b.put(x, y, x === X ? tun.l : x === X + 4 ? tun.d : tun.m);
  b.hl(X, Y + 8, 5, belt); if (type === 'levy') { b.put(X + 1, Y + 4, R.m); b.put(X + 2, Y + 5, R.m); b.put(X + 3, Y + 6, R.m); b.put(X + 4, Y + 7, R.d); } // sash in realm colour
  if (type === 'sword') { for (let y = Y + 4; y <= Y + 7; y++) { b.put(X, y, st(2)); b.put(X + 4, y, st(1)); } b.hl(X, Y + 4, 5, st(3)); b.put(X + 1, Y + 4, st(4)); } // mail with a surcoat
  if (type === 'spear') { b.hl(X, Y + 4, 5, st(2)); b.put(X + 1, Y + 4, st(3)); } // gorget/shoulders
  if (type === 'xbow') { for (const yy of [Y + 5, Y + 7]) { b.put(X + 1, yy, tun.d); b.put(X + 3, yy, tun.d); } } // quilted gambeson
  // head
  for (let y = Y + 1; y <= Y + 3; y++) for (let x = X + 1; x <= X + 3; x++) b.put(x, y, x === X + 1 ? skinS : skin);
  b.put(X + 3, Y + 2, eye); b.put(X + 4, Y + 2, skin); // eye + nose (facing right)
  if (type === 'spear') { b.hl(X + 1, Y, 3, st(3)); b.hl(X, Y + 1, 5, st(2)); b.put(X + 1, Y + 1, st(4)); b.put(X + 4, Y + 2, st(3)); } // nasal helm
  else if (type === 'sword') { b.hl(X + 1, Y - 1, 3, st(3)); b.hl(X, Y, 5, st(2)); b.put(X + 1, Y, st(4)); b.vl(X, Y + 1, 3, st(1)); b.vl(X + 1, Y + 1, 2, st(2)); b.hl(X + 2, Y + 1, 3, st(2)); b.put(X + 3, Y + 1, st(0)); } // great helm w/ eye slit
  else if (type === 'xbow') { b.hl(X - 1, Y + 1, 7, st(2)); b.hl(X, Y, 5, st(3)); b.hl(X + 1, Y - 1, 3, st(4)); b.put(X - 1, Y + 1, st(1)); b.put(X + 5, Y + 1, st(1)); } // kettle hat
  else if (type === 'archer') { b.hl(X + 1, Y, 3, R.d); b.hl(X, Y + 1, 3, R.d); b.vl(X, Y + 2, 3, R.d); b.put(X + 1, Y + 3, R.dd); b.put(X + 4, Y + 1, R.d); } // hood
  else { b.hl(X, Y, 5, rp('thatch', 3)); b.hl(X + 1, Y - 1, 3, rp('thatch', 2)); b.put(X - 1, Y + 1, rp('thatch', 2)); b.put(X + 5, Y + 1, rp('thatch', 2)); b.put(X, Y + 1, rp('h_brown', 2)); } // straw hat
  // weapons & shields
  const hand = (x, y) => b.put(x, y, skin);
  if (flag) { const ph = fr === 'flag2' ? 1 : 0; b.vl(X - 1, 1, Y + 10, wd(4)); b.put(X - 1, 0, rp('gmetal', 4)); figBanner(b, X, 1, 7, 5, R, ph); hand(X, Y + 6); }
  if (type === 'spear') {
    if (!flag) { if (atk) { b.hl(X - 4, Y + 5, 15, wd(3)); b.put(X + 11, Y + 5, st(4)); b.put(X + 12, Y + 5, st(3)); b.put(X + 11, Y + 4, st(2)); b.put(X + 11, Y + 6, st(2)); hand(X + 1, Y + 5); hand(X + 4, Y + 5); }
      else { b.vl(X - 1, Y - 2, Y + 11, wd(3)); b.put(X - 1, Y - 3, st(4)); b.put(X - 1, Y - 2, st(3)); b.put(X - 2, Y - 1, st(2)); b.put(X, Y - 1, st(2)); hand(X, Y + 6); } }
    b.ell(X + 5, Y + 6, 2.6, 2.9, R.m); b.put(X + 5, Y + 6, st(4)); for (const [dx, dy] of [[-2, -2], [-2, 2], [2, -2], [2, 2], [0, -3], [0, 3], [-3, 0], [3, 0]]) b.put(X + 5 + dx, Y + 6 + dy, R.d); b.put(X + 4, Y + 4, R.l); // round shield
  } else if (type === 'sword') {
    if (!flag) { if (atk) { b.line(X + 3, Y + 4, X + 9, Y - 2, st(4)); b.line(X + 4, Y + 4, X + 9, Y - 1, st(2)); b.hl(X + 1, Y + 5, 3, rp('gmetal', 3)); hand(X + 2, Y + 5); }
      else { b.vl(X - 1, Y + 1, 6, st(4)); b.vl(X - 2, Y + 2, 5, st(2)); b.hl(X - 3, Y + 7, 4, rp('gmetal', 3)); hand(X - 1, Y + 8); } }
    const kx = X + 4, ky = Y + 4; for (let j = 0; j < 7; j++) { const w = j < 4 ? 3 : j < 6 ? 2 : 1, x0 = kx + (j < 4 ? 0 : j < 6 ? 1 : 1); for (let i = 0; i < w; i++) b.put(x0 + i, ky + j, i === 0 && j < 6 ? R.l : R.m); }
    b.vl(kx + 1, ky + 1, 4, hx('#f4ecd8')); b.hl(kx, ky + 2, 3, hx('#f4ecd8')); b.put(kx + 3, ky + 1, R.d); b.put(kx + 3, ky + 2, R.d); b.put(kx + 3, ky + 3, R.d); // kite shield with a cross
  } else if (type === 'archer') {
    b.vl(X - 1, Y + 3, 5, rp('brown', 3)); b.vl(X - 2, Y + 4, 4, rp('brown', 2)); b.put(X - 2, Y + 2, hx('#f4ecd8')); b.put(X - 1, Y + 2, hx('#e0d0b0')); b.put(X - 3, Y + 3, R.l); // quiver + fletching
    const bowC = wd(4), bowD = wd(2), str = hx('#e8dcc0');
    if (flag) { } else if (atk) { b.hl(X + 3, Y + 5, 4, skin); b.put(X + 8, Y + 1, bowC); b.vl(X + 9, Y + 2, 7, bowC); b.put(X + 8, Y + 9, bowC); b.put(X + 10, Y + 5, bowD); b.line(X + 8, Y + 1, X + 3, Y + 5, str); b.line(X + 3, Y + 5, X + 8, Y + 9, str); b.hl(X + 3, Y + 5, 8, wd(3)); b.put(X + 11, Y + 5, st(4)); hand(X + 3, Y + 5); hand(X + 9, Y + 5); }
    else { b.put(X + 5, Y + 2, bowC); b.vl(X + 6, Y + 3, 6, bowC); b.put(X + 5, Y + 9, bowC); b.vl(X + 5, Y + 3, 6, str); hand(X + 6, Y + 6); }
  } else if (type === 'xbow') {
    const stk = wd(3), prod = st(3), str = hx('#e8dcc0');
    if (flag) { } else if (atk) { b.hl(X + 1, Y + 4, 9, stk); b.vl(X + 9, Y + 2, 5, prod); b.put(X + 8, Y + 2, st(2)); b.put(X + 8, Y + 6, st(2)); b.line(X + 8, Y + 2, X + 6, Y + 4, str); b.line(X + 6, Y + 4, X + 8, Y + 6, str); b.put(X + 10, Y + 4, st(4)); hand(X + 2, Y + 4); hand(X + 6, Y + 5); }
    else { b.line(X + 1, Y + 7, X + 7, Y + 6, stk); b.vl(X + 7, Y + 4, 5, prod); b.put(X + 6, Y + 4, st(2)); b.put(X + 6, Y + 8, st(2)); hand(X + 3, Y + 7); }
  } else { // levy: pitchfork
    if (!flag) { const fc = rp('steel', 2), fl = rp('steel', 3);
      if (atk) { b.hl(X - 3, Y + 5, 13, wd(3)); b.vl(X + 10, Y + 4, 3, fc); b.hl(X + 10, Y + 3, 3, fl); b.hl(X + 10, Y + 7, 3, fl); b.put(X + 11, Y + 5, fl); b.put(X + 12, Y + 5, fl); hand(X + 1, Y + 5); hand(X + 4, Y + 5); }
      else { b.vl(X - 1, Y - 1, Y + 10, wd(3)); b.hl(X - 2, Y - 1, 3, fc); b.vl(X - 2, Y - 3, 2, fl); b.vl(X, Y - 3, 2, fl); b.put(X - 1, Y - 3, fl); hand(X, Y + 6); } }
  }
  return b; }
// knight: barded destrier, great helm, lance; horse: lighter rider with a nasal helm, round shield and spear; harch: steppe pony, fur cap, bow
function figHorse(fr, R, type) {
  type = type || 'knight'; const kn = type === 'knight', ha = type === 'harch';
  const b = new PB(26, 22), st = i => rp('steel', i), wd = i => rp('wood', i), skin = rp('skin1', 3), eye = hx('#2a1a14');
  const hc = ha ? [hx('#4a3018'), hx('#7a5430'), hx('#a27a4a'), hx('#c29c6a')] : kn ? [hx('#3a2014'), hx('#5c3420'), hx('#7a4a2a'), hx('#98603a')] : [hx('#2e1a10'), hx('#4a2a18'), hx('#64381e'), hx('#80502c')];
  const mane = hx('#24140e'), boot = hx('#2a1e1a');
  const gallop = fr === 'chg1' || fr === 'chg2', ph = fr === 'walk1' || fr === 'chg1' ? 1 : fr === 'walk2' || fr === 'chg2' ? 2 : 0, lowered = fr === 'atk' || gallop, flag = fr === 'flag1' || fr === 'flag2';
  const BX = 5, BY = 11; // horse body top-left
  const LG = ph === 0 ? [[BX + 1, BX + 1], [BX + 3, BX + 3], [BX + 9, BX + 9], [BX + 11, BX + 11]]
    : ph === 1 ? (gallop ? [[BX + 1, BX - 2], [BX + 3, BX - 1], [BX + 9, BX + 13], [BX + 11, BX + 14]] : [[BX + 1, BX], [BX + 3, BX + 4], [BX + 9, BX + 8], [BX + 11, BX + 12]])
      : (gallop ? [[BX + 1, BX + 4], [BX + 3, BX + 5], [BX + 9, BX + 7], [BX + 11, BX + 8]] : [[BX + 1, BX + 2], [BX + 3, BX + 2], [BX + 9, BX + 10], [BX + 11, BX + 10]]);
  LG.forEach(([t, f], i) => { const c = i % 2 ? hc[1] : hc[0]; b.line(t, BY + 4, f, BY + 7, c); b.put(f, BY + 8, mane); });
  b.ell(BX + 6.5, BY + 2.5, 7, 3, hc[2]); b.hl(BX + 2, BY, 9, hc[3]);
  if (kn) { for (let x = BX + 1; x <= BX + 11; x++) for (let y = BY + 1; y <= BY + 4; y++) b.put(x, y, y === BY + 4 ? R.d : (x + y) % 5 === 0 ? R.l : R.m); b.hl(BX + 1, BY + 4, 11, R.d); for (let x = BX + 1; x <= BX + 11; x += 2) b.put(x, BY + 5, R.dd); } // full caparison
  else if (ha) { b.rect(BX + 5, BY, 3, 3, R.d); b.put(BX + 5, BY + 3, R.dd); b.put(BX + 7, BY + 3, R.dd); } // a felt saddle blanket
  else { b.rect(BX + 4, BY, 5, 4, R.m); b.hl(BX + 4, BY + 3, 5, R.d); b.put(BX + 4, BY, R.l); } // saddle cloth
  const nx = BX + 12; b.rect(nx, BY - 3, 2, 5, hc[2]); b.rect(nx + 1, BY - 4, 3, 3, hc[2]); b.hl(nx + 2, BY - 2, 3, hc[1]); b.put(nx + 4, BY - 2, hc[0]); b.put(nx + 2, BY - 5, hc[1]); b.put(nx + 2, BY - 3, mane);
  b.vl(nx - 1, BY - 3, 4, mane); b.put(nx, BY - 4, mane);
  if (kn) { b.rect(nx, BY - 3, 2, 3, R.m); b.put(nx + 1, BY - 1, R.d); } else b.line(nx + 3, BY - 2, nx - 1, BY - 0, hx('#2a1a10')); // chanfron or reins
  b.line(BX - 1, BY + 1, BX - 2, BY + 5, mane); b.put(BX - 1, BY + 2, mane);
  const RX = BX + 5, RY = BY - 8; // rider torso top-left
  const tor = ha ? { l: rp('brown', 4), m: rp('brown', 3), d: rp('brown', 2) } : R;
  for (let y = RY + 3; y <= RY + 7; y++) for (let x = RX; x <= RX + 3; x++) b.put(x, y, x === RX ? tor.l : x === RX + 3 ? tor.d : tor.m);
  if (ha) { b.line(RX, RY + 3, RX + 3, RY + 6, R.m); } else b.hl(RX, RY + 3, 4, st(kn ? 3 : 2));
  b.hl(RX, RY + 7, 4, hx('#3c2416'));
  b.vl(RX + 2, RY + 8, 3, ha ? rp('brown', 2) : R.d); b.put(RX + 2, RY + 11, boot); b.put(RX + 3, RY + 11, boot);
  if (kn) { b.hl(RX, RY, 4, st(3)); b.rect(RX, RY + 1, 4, 2, st(2)); b.put(RX + 2, RY + 1, st(0)); b.put(RX + 3, RY + 1, st(0)); b.put(RX, RY + 1, st(4)); b.put(RX + 1, RY - 1, R.m); b.put(RX + 2, RY - 1, R.l); } // great helm + crest
  else { b.rect(RX + 1, RY + 1, 3, 2, skin); b.put(RX + 3, RY + 1, eye); b.put(RX + 4, RY + 2, skin);
    if (ha) { b.hl(RX, RY, 4, rp('brown', 1)); b.hl(RX + 1, RY - 1, 2, R.m); b.put(RX, RY + 1, rp('brown', 1)); } // fur cap
    else { b.hl(RX, RY, 4, st(2)); b.hl(RX + 1, RY - 1, 2, st(3)); b.put(RX + 2, RY - 2, st(4)); b.put(RX + 3, RY + 1, st(3)); } } // conical helm with a nasal
  if (kn) { b.rect(RX - 1, RY + 4, 3, 4, R.m); b.vl(RX - 1, RY + 4, 3, R.l); b.put(RX, RY + 8, R.m); b.hl(RX - 1, RY + 5, 3, hx('#f4ecd8')); } // heater shield
  else if (!ha) { b.ell(RX, RY + 6, 1.8, 2.2, R.m); b.put(RX, RY + 6, st(4)); b.put(RX - 1, RY + 4, R.l); } // round shield
  else { b.vl(RX - 1, RY + 5, 4, rp('brown', 2)); b.put(RX - 1, RY + 4, hx('#f4ecd8')); b.put(RX - 2, RY + 4, hx('#e0d0b0')); } // quiver
  if (flag) { b.vl(RX + 4, RY - 9, 15, wd(4)); b.put(RX + 4, RY - 10, rp('gmetal', 4)); figBanner(b, RX + 5, RY - 9, 8, 5, R, fr === 'flag2' ? 1 : 0); b.put(RX + 4, RY + 5, skin); }
  else if (ha) { const bowC = wd(4), str = hx('#e8dcc0');
    if (lowered) { b.put(RX + 7, RY + 1, bowC); b.vl(RX + 8, RY + 2, 6, bowC); b.put(RX + 7, RY + 8, bowC); b.line(RX + 7, RY + 1, RX + 3, RY + 4, str); b.line(RX + 3, RY + 4, RX + 7, RY + 8, str); b.hl(RX + 3, RY + 4, 7, wd(3)); b.put(RX + 10, RY + 4, st(4)); b.put(RX + 3, RY + 4, skin); b.put(RX + 8, RY + 4, skin); }
    else { b.put(RX + 5, RY + 2, bowC); b.vl(RX + 6, RY + 3, 5, bowC); b.put(RX + 5, RY + 8, bowC); b.vl(RX + 5, RY + 3, 5, str); b.put(RX + 5, RY + 5, skin); } }
  else if (lowered) { const L = kn ? 21 : 16; b.hl(RX - 2, RY + 5, L, wd(kn ? 4 : 3)); b.put(RX - 2 + L - 2, RY + 5, st(4)); b.put(RX - 2 + L - 1, RY + 5, st(3)); b.put(RX + 3, RY + 4, st(3)); b.put(RX + 3, RY + 6, st(3)); b.put(RX + 4, RY + 5, skin); }
  else if (kn) { b.vl(RX + 4, RY - 7, 14, wd(4)); b.put(RX + 4, RY - 8, st(4)); b.put(RX + 4, RY - 9, st(3)); b.hl(RX + 5, RY - 6, 4, R.m); b.hl(RX + 5, RY - 5, 3, R.d); b.put(RX + 4, RY + 5, skin); } // lance with a pennon
  else { b.vl(RX + 4, RY - 4, 11, wd(3)); b.put(RX + 4, RY - 5, st(4)); b.put(RX + 4, RY - 6, st(3)); b.put(RX + 4, RY + 5, skin); } // spear
  return b; }
// draw one unit standard-bearer / figure helper used by drawBattle
function figFrameFor(B, u, k) {
  const ph = hash2(u.id, k, 7) * 6.283, mv = u.state === 'move' || u.state === 'rout', shot = B.t - u.lastShot < (u.type === 'xbow' ? 0.5 : 0.75) + (hash2(u.id, k, 8) - 0.5) * 0.3;
  if (MOUNTED[u.type]) { if (charger(u) && u.ch > 0.25 && u.state !== 'rout') return mv ? (Math.sin(NOW * 16 + ph) > 0 ? 'chg1' : 'chg2') : 'atk';
    if (u.type === 'harch' && shot && u.state !== 'rout') return mv ? (Math.sin(NOW * 13 + ph) > 0 ? 'chg1' : 'chg2') : 'atk';
    if (mv) return Math.sin(NOW * 10 + ph) > 0 ? 'walk1' : 'walk2'; if (u.state === 'melee') return Math.sin(NOW * 4 + ph) > -0.2 ? 'atk' : 'stand'; return 'stand'; }
  if (mv) return Math.sin(NOW * 9 + ph) > 0 ? 'walk1' : 'walk2';
  if (RANGED[u.type]) return u.state === 'melee' ? (Math.sin(NOW * 5 + ph) > 0.3 ? 'atk' : 'stand') : shot ? 'atk' : 'stand';
  if (u.state === 'melee') return u.type === 'spear' ? (Math.sin(NOW * 6 + ph) > -0.6 ? 'atk' : 'stand') : (Math.sin(NOW * 5 + ph) > 0.1 ? 'atk' : 'stand');
  return 'stand'; }
