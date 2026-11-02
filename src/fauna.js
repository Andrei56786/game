'use strict';
// ===== FAUNA (v3.4): beasts and birds redrawn — silhouettes shaded by light from above, legs on a little rig =====
// Frames: 0–3 walk · 4 stand · 5 graze / root / sniff / sit / peck · 6–9 run or fly · 10 lying dead. animalPB() asks FAUNA first.
// Coat letters in the shapes: '#' coat, 'd' dark coat, 'b' pale coat, 'w' white, 'k' black, 'p' pink, 'h' horn or tusk, 'e' eye; '.' or ' ' empty.
const FA_N = 11, FA_DEAD = 10;
const fhx = a => a.map(hx);
function fop(ch) { return ch !== ' ' && ch !== '.' && ch !== undefined; }
// paint ASCII rows at (ox, oy); ramps get shade by depth from the top / bottom edge (light from above), flat colours are put as they are
function fshape(b, rows, ox, oy, P, o, dy) {
  o = o || {}; dy = dy || 0; const H = rows.length, at = (x, y) => (y < 0 || y >= H) ? ' ' : rows[y][x];
  for (let y = 0; y < H; y++) { const r = rows[y]; for (let x = 0; x < r.length; x++) { const ch = r[x]; if (!fop(ch)) continue; let c = P[ch]; if (c === undefined) continue;
    if (typeof c === 'number') { b.set(ox + x, oy + y, c); continue; }
    if (P.mark && (ch === '#' || ch === 'b')) { const mk = P.mark(ox + x, oy - dy + y, ch); if (mk && P[mk]) c = P[mk]; }
    let t = 0, d = 0; while (t < 6 && fop(at(x, y - t - 1))) t++; while (d < 6 && fop(at(x, y + d + 1))) d++;
    const n = c.length, tot = t + d; let s = n - 2;
    if (t === 0) s = n - 1; else if (d === 0) s = tot >= 3 ? 1 : n - 3; else if (d === 1 && tot >= 4) s = n - 3;
    if (t > 0 && !fop(r[x + 1])) s--;
    if (o.fur && t > 0 && d > 0 && hsh(x + ox, y + oy, o.seed || 5) < o.fur) s--;
    if (o.wool && t > 0 && ((x + (y >> 1) * 2 + (o.seed || 0)) % 4 === 0) && (y & 1)) s--;
    b.set(ox + x, oy + y, c[clamp(s, 0, n - 1)]); } }
  return b; }
// a tapering limb segment: horizontal runs along the bone, lit on the left, shaded on the right
function fseg(b, x0, y0, x1, y1, w0, w1, C) { const n = Math.max(1, Math.round(Math.max(Math.abs(y1 - y0), Math.abs(x1 - x0))));
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = Math.round(y0 + (y1 - y0) * t), w = Math.max(1, Math.round(w0 + (w1 - w0) * t)), xa = Math.round(x - (w - 1) / 2);
    for (let k = 0; k < w; k++) b.set(xa + k, y, typeof C === 'number' ? C : C[w === 1 ? 1 : k === 0 ? 2 : k === w - 1 ? 0 : 1]); } }
// one leg: top (ax, ay) → joint → foot on the ground (gy − lift); fore legs bend forward at the knee, hind legs keep the hock behind
function fleg(b, L, ax, ay, gy, ph, C, foot) { const len = gy - ay, j = L.hind ? 0.5 : 0.55, jy = ay + Math.round(len * j) - (ph.lift > 1 ? 1 : 0);
  const jx = ax + (ph.jx !== undefined ? ph.jx : ph.dx * 0.5) + (L.hind ? (L.hock || 1) : 0), fx = ax + ph.dx, fy = gy - (ph.lift || 0);
  fseg(b, ax, ay, jx, jy, L.w0, L.wj, C); fseg(b, jx, jy, fx, fy - (foot ? foot.h : 0), L.wj, L.w1, C); if (foot) foot.draw(b, Math.round(fx), fy, ph); }
const FFOOT = {
  hoof: c => ({ h: 1, draw: (b, x, y) => { b.set(x, y, c); } }),
  hoof2: c => ({ h: 1, draw: (b, x, y) => { b.set(x, y, c); b.set(x - 1, y, c); } }),
  paw: c => ({ h: 0, draw: (b, x, y) => { b.set(x - 1, y, c); } }),
  bpaw: c => ({ h: 1, draw: (b, x, y) => { b.set(x - 1, y, c); b.set(x, y, c); b.set(x + 1, y, c); b.set(x - 2, y, c); } }),
};
// gait tables: walk (lateral four-beat) and run (gallop / bound). Per leg: dx (+ = backwards, the beast faces left), lift, optional knee jx
function fgait(f, run, s) { const W = [{ dx: -s, lift: 0 }, { dx: 0, lift: 0 }, { dx: s, lift: 0 }, { dx: 0, lift: 2, jx: -1 }];
  if (!run) return { nh: W[f % 4], nf: W[(f + 1) % 4], fh: W[(f + 2) % 4], ff: W[(f + 3) % 4], dy: 0 };
  const S = s * 1.6, R = [
    { nf: { dx: -S, lift: 2, jx: -S - 1 }, ff: { dx: -S + 2, lift: 1 }, nh: { dx: S, lift: 1 }, fh: { dx: S - 2, lift: 2 }, dy: -1 },
    { nf: { dx: -S / 2, lift: 0 }, ff: { dx: 0, lift: 0 }, nh: { dx: S / 3, lift: 3, jx: 0 }, fh: { dx: S / 2, lift: 2 }, dy: 0 },
    { nf: { dx: S / 2, lift: 1 }, ff: { dx: S / 3 + 1, lift: 0 }, nh: { dx: -S * 0.7, lift: 0 }, fh: { dx: -S * 0.5, lift: 0 }, dy: 1 },
    { nf: { dx: -S * 0.6, lift: 3, jx: -S }, ff: { dx: -S * 0.3, lift: 2 }, nh: { dx: S * 0.6, lift: 0 }, fh: { dx: S * 0.3, lift: 0 }, dy: 0 } ];
  return R[f % 4]; }
// generic four-legged beast from a spec: body rows, head parts (up / down / dead), legs, palette, extras
function fquad(S, f, col) { const P = typeof S.pal === 'function' ? S.pal(col) : S.pal; let b = new PB(S.W, S.H); const gy = S.H - 1;
  const pose = S.poses && S.poses[f]; if (pose) { fshape(b, pose.rows, pose.x || 0, pose.y || 0, P, S.shade); if (S.extra) S.extra(b, P, f, col, 0, pose); b.outline(OUTL); if (S.post) S.post(b, P, f, col, 0, pose); return S.crop ? new PB(S.W, S.H - S.crop).blit(b, 0, -S.crop) : b; }
  const dead = f === FA_DEAD, run = f >= 6 && f <= 9, walk = f < 4, idle = f === 5, g = dead ? null : fgait(walk || run ? f % 4 : 1, run, S.stride || 2);
  const stand = { dx: 0, lift: 0 }, G = g || {}, ph = k => (walk || run) ? G[k] : (S.standPh && S.standPh[k]) || stand, dy = dead ? S.deadDy : (g ? g.dy || 0 : 0) + (idle && S.idleDy || 0);
  const LC = P.leg || P['#'], FC = P.far || LC, ft = S.foot ? S.foot(P) : null, L = S.legs;
  if (S.back) S.back(b, P, f, col, dy);
  if (!dead) { fleg(b, L.h, L.h.x - (L.off || 2), L.h.y + dy, gy, ph('fh'), FC, ft); fleg(b, L.f, L.f.x + (L.off || 2) - 1, L.f.y + dy, gy, ph('ff'), FC, ft); }
  fshape(b, S.body, S.bx, S.by + dy, P, S.shade, dy);
  if (S.tails) { const T = run && S.tailRun ? S.tailRun : S.tails[(walk ? f : 0) % S.tails.length]; fshape(b, T.rows, T.x, T.y + dy, P, S.shade, dy); }
  const hp = dead ? S.heads.dead : idle && S.heads.down ? S.heads.down : (run && S.heads.run) || S.heads.up;
  if (S.preHead) S.preHead(b, P, f, col, dy, hp);
  fshape(b, hp.rows, hp.x, hp.y + (hp.abs ? 0 : dy), P, S.shade, hp.abs ? 0 : dy);
  if (!dead) { fleg(b, L.h, L.h.x, L.h.y + dy, gy, ph('nh'), LC, ft); fleg(b, L.f, L.f.x, L.f.y + dy, gy, ph('nf'), LC, ft); }
  else if (S.deadLegs) S.deadLegs(b, P, gy, ft);
  if (S.extra) S.extra(b, P, f, col, dy, hp);
  b.outline(OUTL); if (S.post) S.post(b, P, f, col, dy, hp); return S.crop ? new PB(S.W, S.H - S.crop).blit(b, 0, -S.crop) : b; }
// ---------- antlers: beam up and back from the skull, tines thrown forward; pts = points in all (6…16); rot turns the whole rack with the head ----------
function fantler(b, x, y, rot, pts, C, C2) { const cr = Math.cos(rot), sr = Math.sin(rot), T = ([dx, dy]) => [Math.round(x + dx * cr - dy * sr), Math.round(y + dx * sr + dy * cr)];
  const beam = [[0, 0], [1, -2], [2, -4], [3, -6], [4, -8], [4, -10]], tines = [[[0, -1], [-3, -2]], [[3, -6], [1, -8]], [[4, -10], [3, -12]], [[1, -2], [-1, -4]], [[4, -9], [6, -11]], [[4, -10], [2, -12]], [[4, -8], [6, -9]]];
  for (let i = 1; i < beam.length; i++) { const [x0, y0] = T(beam[i - 1]), [x1, y1] = T(beam[i]); b.line(x0, y0, x1, y1, i > 3 ? C2 : C); }
  const n = clamp(Math.round(pts / 2) - 1, 2, tines.length); for (let k = 0; k < n; k++) { const [p, q] = tines[k], [x0, y0] = T(p), [x1, y1] = T(q); b.line(x0, y0, x1, y1, C2); } }
// ---------- red deer: stag (antlers by points), hind ('doe'), grey in winter ('w…') ----------
const FDEER = { W: 32, H: 35, bx: 0, by: 17, stride: 2,
  body: [
    '............##########..........',
    '..........###############.......',
    '.........#################dd....',
    '.........#################wwd...',
    '........###################ww...',
    '........###################ww...',
    '........###################ww...',
    '........############..######w...',
    '.........#bbbbbbb.....######....',
    '.........####.........#####.....',
    '..........###..........####.....',
    '........................###.....'],
  heads: {
    up: { x: 0, y: 6, rows: [
      '.......d.....',
      '......d#d....',
      '......d##....',
      '...######....',
      '.#####k#b....',
      'k######bd....',
      '.bbbbb#ddd...',
      '....bb#ddd#..',
      '.....b##ddd#.',
      '.....bb##ddd#',
      '......b###ddd#',
      '.......b######',
      '........b#####',
      '.........b###',
      '.........b##'] },
    down: { x: 0, y: 17, rows: [
      '...........###',
      '.........#####',
      '........b####.',
      '.......b####d.',
      '.......b###d..',
      '......b###d...',
      '.....b###d....',
      '.....b##d.....',
      '....b##dd.....',
      '...b###.d.....',
      '..######......',
      '..##k##.......',
      '..####........',
      '..###.........',
      '..b##.........',
      '...k#.........'] },
    dead: { x: 0, y: 27, abs: 1, rows: [
      '..........###',
      '....dd..#####',
      '...##########',
      '..#d#########',
      '.#######bbbbb',
      'k######b.....',
      '.bbbbb.......'] } },
  legs: { f: { x: 10, y: 26, w0: 3, wj: 2, w1: 1 }, h: { x: 25, y: 28, w0: 3, wj: 2, w1: 1, hind: 1, hock: 1 }, off: 2 },
  deadDy: 6, foot: P => FFOOT.hoof(P.hoof),
  deadLegs: (b, P, gy, ft) => { fseg(b, 12, gy - 3, 16, gy - 1, 2, 1, P.leg); b.set(17, gy - 1, P.hoof); fseg(b, 24, gy - 1, 30, gy, 2, 1, P.leg); b.set(31, gy, P.hoof); },
  pal: col => FDEERP[(col || 'stag').replace(/\d+$/, '')] || FDEERP.stag,
  post: (b, P, f, col, dy) => { const a = FDEERA(f, col, dy); if (a) { fantler(b, a[0] - 1, a[1] - 1, a[2] - 0.35, a[3], P.ant[0], P.ant[1]); fantler(b, a[0], a[1], a[2], a[3], P.ant[1], P.ant[3]); } } };
// [x, y, turn, points]: the skull top in each pose; the antler turns with the head
function FDEERA(f, col, dy) { if (/doe/.test(col || '')) return null; const m = /(\d+)$/.exec(col || ''), pts = m ? +m[1] : 10;
  if (f === FA_DEAD) return [4, 28, 0.55, pts]; if (f === 5) return [4, 26 + dy, 0.5, pts]; return [6, 9 + dy, 0, pts]; }
// the hind: a row less in the barrel, a slimmer neck, cropped canvas (no antlers)
const FDOE = Object.assign({}, FDEER, { H: 34, crop: 5, body: FDEER.body.filter((r, i) => i !== 4), legs: { f: Object.assign({}, FDEER.legs.f, { y: 25 }), h: Object.assign({}, FDEER.legs.h, { y: 27 }), off: 2 }, deadDy: 6,
  heads: { up: FDEER.heads.up, down: { x: 0, y: 17, rows: FDEER.heads.down.rows.slice(0, 14).concat(['..k#.........']) }, dead: Object.assign({}, FDEER.heads.dead, { y: 26 }) },
  deadLegs: (b, P, gy) => { fseg(b, 12, gy - 3, 16, gy - 1, 2, 1, P.leg); b.set(17, gy - 1, P.hoof); fseg(b, 24, gy - 1, 30, gy, 2, 1, P.leg); b.set(31, gy, P.hoof); }, post: null });
const FDEERP = {}; { const mk = (coat, dark, belly, leg, far) => ({ '#': fhx(coat), d: fhx(dark), b: fhx(belly), w: fhx(['#7a6a52', '#b4a284', '#d8c8a8', '#ece0c4', '#f8f0de']), k: DK, leg: fhx(leg), far: fhx(far), hoof: hx('#1a1214'), ant: fhx(['#3e3022', '#5c4a36', '#8a7658', '#d8ccb0']) });
  FDEERP.stag = mk(['#2e1a10', '#5a3420', '#80502e', '#a26a3c', '#c08850'], ['#24140c', '#40261a', '#5a3822', '#704a2c', '#8a5e38'], ['#5a4634', '#8a7258', '#b29a7c', '#cdb898', '#e2d2b4'], ['#40261a', '#6e4428', '#8e5c34'], ['#2a1810', '#45291a', '#563422']);
  FDEERP.doe = Object.assign({}, FDEERP.stag, { d: FDEERP.stag['#'] });
  FDEERP.wstag = mk(['#2a2420', '#4a3e34', '#6a5a4a', '#857260', '#a08c76'], ['#1e1814', '#342a22', '#4a3c30', '#5c4c3c', '#706050'], ['#5a5448', '#8a8270', '#aea690', '#c8c0aa', '#ddd6c2'], ['#3a3028', '#5a4a3c', '#74604e'], ['#28201a', '#3c3228', '#4c4034']);
  FDEERP.wdoe = Object.assign({}, FDEERP.wstag, { d: FDEERP.wstag['#'] });
  // the white hart of the old tales: cream coat, pale antlers, a sign of good fortune
  FDEERP.hart = Object.assign(mk(['#8a8476', '#b6b0a2', '#d8d4c8', '#ebe8de', '#faf8f0'], ['#746e62', '#969084', '#b2ac9e', '#c8c2b4', '#dcd8cc'], ['#a8a498', '#cecac0', '#e6e3da', '#f4f2ea', '#ffffff'], ['#8a8476', '#a8a294', '#c4beb0'], ['#6a6458', '#827c70', '#969084']), { ant: fhx(['#5a5040', '#857a64', '#b4aa90', '#ece4cc']) }); }
const FAUNA = {
  deer: (f, col) => fquad(/doe/.test(col || '') ? FDOE : FDEER, f, col),
};
// ---------- palettes ----------
function fP(o) { const P = { k: DK }; for (const k in o) P[k] = Array.isArray(o[k]) ? fhx(o[k]) : typeof o[k] === 'string' ? hx(o[k]) : o[k]; return P; }
const fblob = (sc, th, sd, k) => (x, y) => vnz(x, y, sc, sd) > th ? (k || 'q') : null;
// ---------- wild boar: high bristly withers, wedge head, tusks ----------
const FBOAR = { W: 30, H: 19, bx: 0, by: 3, stride: 2, shade: { fur: 0.16, seed: 3 },
  body: [
    '..........d.d.d...............',
    '.........ddddddddd............',
    '........dd########dd..........',
    '.......################.......',
    '.......#################......',
    '.......##################.....',
    '.......##################d....',
    '.......#################..d...',
    '........###############...d...',
    '........##bbbbbbbbb####...k...',
    '........###.......####........'],
  heads: {
    up: { x: 0, y: 4, rows: ['......dd..', '.....d#d..', '....#####.', '...######.', '..##k####.', '.########.', '########..', 'p#h####...', 'pd#h##b...', '.dbb.b....'] },
    down: { x: 0, y: 6, rows: ['.......d..', '......dd..', '.....####.', '....#####.', '...##k###.', '..#######.', '.#######..', '.######...', 'p#h###....', 'pd#h#.....', 'pdb.......'] },
    dead: { x: 0, y: 11, abs: 1, rows: ['.......###', '....d.####', '...#######', '..##d#####', '.########.', 'p#h#####..', 'pd#hbbb...'] } },
  legs: { f: { x: 9, y: 13, w0: 3, wj: 2, w1: 2 }, h: { x: 19, y: 13, w0: 3, wj: 2, w1: 2, hind: 1, hock: 1 }, off: 2 },
  deadDy: 5, foot: P => FFOOT.hoof2(P.hoof), deadLegs: (b, P, gy) => { fseg(b, 10, gy - 1, 14, gy, 2, 1, P.leg); fseg(b, 19, gy - 1, 24, gy, 2, 1, P.leg); },
  pal: fP({ '#': ['#1c1612', '#30261e', '#4a3a2c', '#64503c', '#7e6a52'], d: ['#14100e', '#241c16', '#3a2e24', '#5a4a3a', '#8a7a64'], b: ['#2e241c', '#4a3c30', '#625040', '#76644e', '#8a7660'],
    p: '#5e4a4a', h: '#efe6d0', leg: ['#1a1410', '#2c221a', '#3e3024'], far: ['#120e0c', '#1e1814', '#2a221c'], hoof: '#0e0a0a' }) };
// ---------- wolf: grizzled grey, dark saddle, pale legs and muzzle, low bushy tail ----------
const FWOLF = { W: 30, H: 21, bx: 0, by: 7, stride: 2, shade: { fur: 0.1, seed: 7 },
  body: [
    '..........dddddd..............',
    '........ddddddddddd...........',
    '.......#ddddddddddd##d........',
    '.......##############dd.......',
    '.......###############dd......',
    '.......#bb#########.###dd.....',
    '........bbbb.......####.dd....',
    '........###.........###..dd...',
    '.........##.........##....dd..',
    '...........................k..'],
  heads: {
    up: { x: 0, y: 3, rows: ['......d.d..', '.....dd#d..', '....######.', '..########d', '.###e####dd', '#########dd', 'kbbbb###ddd', '..bbbbb##dd', '....bbb##d.', '.....bbb#..'] },
    run: { x: 0, y: 4, rows: ['......d.d..', '.....dd#d..', '....######.', '..########d', '.###e####dd', '#########dd', 'kbbbb###ddd', '..bbbbb##dd', '....bbb##d.', '.....bbb#..'] },
    down: { x: 0, y: 7, rows: ['........dd.', '.......ddd.', '......#ddd.', '.....##dd..', '....###d...', '..dd###....', '.######....', '.##e##.....', '.#####.....', '.####......', '..bb#......', '..k#.......'] },
    dead: { x: 0, y: 14, abs: 1, rows: ['........dd.', '..d.d..#ddd', '.#######ddd', '##d########', 'k#######bbb', '.bbbbbbb...'] } },
  legs: { f: { x: 9, y: 14, w0: 2, wj: 2, w1: 1 }, h: { x: 20, y: 15, w0: 2, wj: 2, w1: 1, hind: 1, hock: 1 }, off: 2 },
  deadDy: 6, foot: P => FFOOT.paw(P.paw), deadLegs: (b, P, gy) => { fseg(b, 10, gy - 1, 15, gy, 2, 1, P.leg); fseg(b, 20, gy - 1, 26, gy, 2, 1, P.leg); },
  pal: fP({ '#': ['#2c2824', '#4c443c', '#6e645a', '#8e8476', '#ada292'], d: ['#1a1816', '#2e2a26', '#44403a', '#5a554e', '#767068'], b: ['#6a6254', '#9a917e', '#bdb39c', '#d6ccb4', '#e8e0cc'],
    e: '#e8b030', leg: ['#5a5248', '#7e7464', '#9a8e7c'], far: ['#3a342e', '#524a42', '#645a50'], paw: '#2e2824' }) };
// ---------- red fox: black stockings, white bib, a great brush with a white tip ----------
const FFOX = { W: 22, H: 13, bx: 0, by: 4, stride: 1.5,
  body: [
    '......#######.........',
    '.....#########........',
    '.....##########.......',
    '.....##########.......',
    '.....ww#######........',
    '.....kk......kk.......'],
  tails: [{ x: 13, y: 4, rows: ['..####..', '.######.', '########', '..####ww', '.....ww.'] }, { x: 13, y: 4, rows: ['..###...', '.######.', '#######w', '..#####w', '......w.'] }],
  tailRun: { x: 13, y: 3, rows: ['....##..', '.#######', '#######w', '..####ww'] },
  heads: {
    up: { x: 0, y: 1, rows: ['...k.k..', '...#k##.', '..#####.', '.##k###.', '######..', 'kwww##..', '..www#..', '...ww...'] },
    run: { x: 0, y: 2, rows: ['...k.k..', '...#k##.', '..#####.', '.##k###.', '######..', 'kwww##..', '..www#..', '...ww...'] },
    down: { x: 0, y: 4, rows: ['....k.k.', '...k###.', '..#####.', '.##k##..', '#####...', 'kww#....', '.ww.....'] },
    dead: { x: 0, y: 7, abs: 1, rows: ['..k.k.##', '.######.', '##d####.', 'kwww##..', '.www....'] } },
  legs: { f: { x: 6, y: 9, w0: 2, wj: 1, w1: 1 }, h: { x: 14, y: 9, w0: 2, wj: 1, w1: 1, hind: 1, hock: 1 }, off: 1 },
  deadDy: 2, foot: P => FFOOT.paw(P.paw), deadLegs: (b, P, gy) => { fseg(b, 7, gy, 10, gy, 1, 1, P.leg); fseg(b, 13, gy, 17, gy, 1, 1, P.leg); },
  pal: fP({ '#': ['#3a1408', '#782e0e', '#b2501c', '#d8742c', '#ee9a4a'], d: ['#2a0e06', '#4e1e0a', '#702c10', '#8e3c16', '#a84e20'], w: ['#8a8278', '#bab2a6', '#dcd6cc', '#eeeae2', '#fbf9f4'],
    k: '#1a1214', leg: ['#140e10', '#221a1c', '#30262a'], far: ['#0e0a0c', '#181214', '#221a1e'], paw: '#120c0e' }) };
// ---------- brown bear: the hump, the long pale muzzle, round ears, great paws ----------
const FBEAR = { W: 34, H: 25, bx: 0, by: 7, stride: 2, shade: { fur: 0.2, seed: 11 },
  body: [
    '...........dddddd.................',
    '.........dddddddddd...............',
    '........##############............',
    '.......##################.........',
    '.......#####################......',
    '.......######################.....',
    '.......#######################....',
    '.......#######################....',
    '.......#######################....',
    '........######################....',
    '........#####bbbbbbbbbbb######....',
    '........######.........######.....',
    '.........#####.........#####......'],
  heads: {
    up: { x: 0, y: 9, rows: ['.....dd....', '....d##d...', '...######..', '..###k####.', '.bbb#######', 'kbbb#######', '.bbbb#####.', '...bbb####.', '......###..'] },
    down: { x: 0, y: 12, rows: ['........dd.', '.......d##d', '.....######', '....##k####', '...########', '..bbb######', '.bbbb####..', 'kbbb###....', '.bbb.......'] },
    dead: { x: 0, y: 16, abs: 1, rows: ['......d.d##', '....#######', '..##d######', '.##########', 'kbb#######.', '.bbbbbb....'] } },
  legs: { f: { x: 11, y: 19, w0: 5, wj: 4, w1: 4 }, h: { x: 25, y: 19, w0: 5, wj: 4, w1: 4, hind: 1, hock: 1 }, off: 3 },
  deadDy: 4, foot: P => FFOOT.bpaw(P.paw), deadLegs: (b, P, gy) => { fseg(b, 12, gy - 1, 16, gy, 4, 3, P.leg); fseg(b, 25, gy - 1, 30, gy, 4, 3, P.leg); },
  pal: fP({ '#': ['#1a100a', '#2e1c12', '#48301e', '#64442a', '#7e5a38'], d: ['#20140c', '#3a2616', '#58402a', '#7a5c3e', '#9a7a56'], b: ['#4a3424', '#6e5038', '#8e6c4c', '#a88660', '#c0a078'],
    leg: ['#1a100a', '#2a1a10', '#3c2818'], far: ['#120a06', '#1e120a', '#2a1a10'], paw: '#140c08' }) };
// ---------- sheep: a fleece cloud on thin legs; white, brown or black ----------
const FSHEEP = { W: 20, H: 15, bx: 0, by: 3, stride: 1.5, shade: { wool: 1, seed: 1 },
  body: [
    '.......#.##.#.......',
    '......############..',
    '.....##############.',
    '.....##############.',
    '.....###############',
    '.....##############.',
    '......############..',
    '.......#.##.##.#....'],
  heads: {
    up: { x: 0, y: 4, rows: ['...##..', '..fffff', '.ffeff.', 'ffff...', '.fff...'] },
    down: { x: 0, y: 8, rows: ['...##..', '..ffff.', '.ffeff.', '.ffff..', '.fff...', '..f....'] } },
  legs: { f: { x: 7, y: 10, w0: 2, wj: 1, w1: 1 }, h: { x: 15, y: 10, w0: 2, wj: 1, w1: 1, hind: 1, hock: 0 }, off: 1 },
  foot: P => FFOOT.hoof(P.hoof),
  pal: col => FSHEEPP[col] || FSHEEPP.white };
const FSHEEPP = { white: fP({ '#': ['#6e665a', '#a29a8a', '#c8c0ae', '#e2dccc', '#f4f0e6'], f: ['#1e1614', '#2e2420', '#40322c', '#54443c', '#6a5850'], e: '#0a0608', leg: ['#1e1614', '#2e2420', '#40322c'], far: ['#140e0c', '#201816', '#2c221e'], hoof: '#0e0a0a' }) };
FSHEEPP.brown = Object.assign({}, FSHEEPP.white, { '#': fhx(['#3a2a1e', '#5a4430', '#7a5e44', '#96785a', '#ae9272']) });
FSHEEPP.black = Object.assign({}, FSHEEPP.white, { '#': fhx(['#141216', '#222026', '#34303a', '#48444e', '#5e5a64']) });
FSHEEPP.pale = Object.assign({}, FSHEEPP.white, { f: fhx(['#7a6a5a', '#a8968a', '#c8b8a8', '#ddd0c0', '#ece2d4']), leg: fhx(['#6a5a4a', '#8a7a68', '#a89886']) });
// ---------- cow: small old breeds — red, black, dun or pied; horns, udder, a tufted tail ----------
const FCOW = { W: 32, H: 23, bx: 0, by: 7, stride: 1.5,
  body: [
    '..........############.###......',
    '.........##################d....',
    '........###################.d...',
    '........###################.d...',
    '........###################.d...',
    '........###################.d...',
    '........##################..d...',
    '.........#################..d...',
    '.........##bbbbbbbbbpp####..kk..',
    '.........###.......pp.###...kk..'],
  heads: {
    up: { x: 0, y: 5, rows: ['....h.....', '...h..hh..', '...#####dd', '..########', '..##e#####', '..#######.', '.#######..', '.######...', 'pppp##....', '.ppbb.....'] },
    down: { x: 0, y: 11, rows: ['......##dd', '.....#####', '...h######', '..h#####..', '..##e##...', '..#####...', '..####....', '..####....', '..ppp.....', '..ppb.....'] } },
  legs: { f: { x: 10, y: 16, w0: 3, wj: 2, w1: 2 }, h: { x: 23, y: 16, w0: 3, wj: 2, w1: 2, hind: 1, hock: 1 }, off: 2 },
  foot: P => FFOOT.hoof2(P.hoof), pal: col => FCOWP[col] || FCOWP.red };
const FCOWP = {}; { const base = { b: ['#5a3a28', '#7e5438', '#9e6e4a', '#b88a60', '#cca274'], p: ['#3a2a2a', '#5e4644', '#7e6260', '#9a7e7a', '#b29894'], h: '#d8ccae', hoof: '#16100e' };
  const mk = (coat, leg, far, o) => fP(Object.assign({}, base, { '#': coat, d: coat, leg, far }, o || {}));
  FCOWP.red = mk(['#2a120c', '#4e2214', '#74361e', '#94502c', '#b0693c'], ['#3a1a10', '#5e2c18', '#7c4024'], ['#26110a', '#3e1d10', '#542a18']);
  FCOWP.black = mk(['#0e0c10', '#1a181e', '#2a2630', '#3a3642', '#4e4a56'], ['#141218', '#221e26', '#302c36'], ['#0a080c', '#141218', '#1e1a22'], { b: ['#2a2630', '#3a3642', '#4e4a56', '#625e6a', '#76727e'] });
  FCOWP.dun = mk(['#3a2c1e', '#5e4a34', '#82684a', '#a08462', '#ba9e7a'], ['#4a3a2a', '#6e583e', '#8a7254'], ['#32261a', '#4a3a2a', '#5e4a36']);
  FCOWP.pied = Object.assign({}, FCOWP.red, fP({ '#': ['#6a6660', '#a29e96', '#cac6bc', '#e4e0d8', '#f6f4ee'], b: ['#6a6660', '#a29e96', '#cac6bc', '#e4e0d8', '#f6f4ee'], leg: ['#a29e96', '#cac6bc', '#e4e0d8'], far: ['#6a6660', '#8a867e', '#a29e96'] }), { q: FCOWP.red['#'], mark: fblob(4, 0.56, 9) }); }
// ---------- pig: the old long-legged, long-snouted kind — pink, spotted or dark and bristly ----------
const FPIG = { W: 22, H: 14, bx: 0, by: 3, stride: 1.5,
  body: [
    '.......#######........',
    '......###########.....',
    '.....##############...',
    '.....###############d.',
    '.....###############.d',
    '.....#bbbbbbbbbbbb#d..',
    '......##........##....'],
  heads: {
    up: { x: 0, y: 4, rows: ['....dd.', '...d##.', '..#####', '.##e###', 'p######', 'pp###..'] },
    down: { x: 0, y: 6, rows: ['....dd.', '...d##.', '..#####', '.##e###', '.######', 'p####..', 'pp#....'] } },
  legs: { f: { x: 7, y: 9, w0: 2, wj: 2, w1: 1 }, h: { x: 16, y: 9, w0: 2, wj: 2, w1: 1, hind: 1, hock: 0 }, off: 1 },
  foot: P => FFOOT.hoof(P.hoof), pal: col => FPIGP[col] || FPIGP.pink };
const FPIGP = {}; { const pink = ['#5a2a30', '#8a4a50', '#b46a6c', '#d08a88', '#e6a8a2'];
  FPIGP.pink = fP({ '#': pink, b: ['#7a4448', '#a46064', '#c47e7c', '#dc9a94', '#ecb4aa'], p: '#a05a5e', d: ['#6e3a40', '#9a5a5e', '#bc7676', '#d29090', '#e2a8a4'], e: '#1a0e10', leg: ['#8a4a50', '#b46a6c', '#d08a88'], far: ['#5a2a30', '#7a3e44', '#94545a'], hoof: '#3a2024' });
  FPIGP.spotted = Object.assign({}, FPIGP.pink, fP({ q: ['#2a1a1a', '#3e2a28', '#56403a', '#6e5448', '#84685a'] }), { mark: fblob(2, 0.5, 4) });
  FPIGP.dark = Object.assign({}, FPIGP.pink, fP({ '#': ['#1e1614', '#2e2420', '#42342c', '#56463a', '#6c5a4a'], b: ['#2e2420', '#42342c', '#56463a', '#6c5a4a', '#806c5a'], d: ['#1e1614', '#2e2420', '#42342c', '#56463a', '#6c5a4a'], p: '#4a3434', leg: ['#1e1614', '#2e2420', '#42342c'], far: ['#140e0c', '#1e1614', '#2a201c'] })); }
// ---------- goat: back-swept horns, a beard, the tail cocked up ----------
const FGOAT = { W: 20, H: 19, bx: 0, by: 7, stride: 1.5,
  body: [
    '........#########.d.',
    '.......###########d.',
    '.......###########..',
    '.......###########..',
    '.......##########...',
    '.......##bbbbbb###..',
    '........##......##..'],
  heads: {
    up: { x: 0, y: 1, rows: ['......h..', '.....h.h.', '....h.h..', '...##h...', '..####d..', '.##e##...', '######...', '.####....', '.dd##....', '.d..##...', '.....##..', '......##.'] },
    down: { x: 0, y: 7, rows: ['......##.', '.....##..', '..h.##...', '.h.###...', '.h####d..', '.##e##...', '.#####...', '.####....', '.###.....', '.d##.....', '.d.......'] } },
  legs: { f: { x: 8, y: 13, w0: 2, wj: 1, w1: 1 }, h: { x: 16, y: 13, w0: 2, wj: 1, w1: 1, hind: 1, hock: 1 }, off: 1 },
  foot: P => FFOOT.hoof(P.hoof), pal: col => FGOATP[col] || FGOATP.white };
const FGOATP = {}; { FGOATP.white = fP({ '#': ['#6a6458', '#a09886', '#c6bea8', '#e0d8c4', '#f2ecdc'], d: ['#4a443a', '#6e6656', '#8e8470', '#a89e88', '#c0b6a0'], b: ['#8a8270', '#b4ac98', '#d4ccb8', '#e8e0ce', '#f6f0e4'], h: '#5a4c3c', e: '#140c08', leg: ['#8a8270', '#b4ac98', '#d4ccb8'], far: ['#5a5448', '#7a7262', '#948c7a'], hoof: '#2a2420' });
  FGOATP.brown = Object.assign({}, FGOATP.white, fP({ '#': ['#2e1c12', '#4e3220', '#704a30', '#8e6442', '#a87e58'], b: ['#4e3220', '#704a30', '#8e6442', '#a87e58', '#c09870'], d: ['#1a100a', '#2e1c12', '#4e3220', '#704a30', '#8e6442'], leg: ['#3e281a', '#5e3e28', '#7a5436'], far: ['#2a1a10', '#3e281a', '#523622'] }));
  FGOATP.pied = Object.assign({}, FGOATP.white, { q: FGOATP.brown['#'], mark: fblob(3, 0.55, 6) }); }
Object.assign(FAUNA, {
  boar: f => fquad(FBOAR, f), wolf: f => fquad(FWOLF, f), fox: f => fquad(FFOX, f), bear: f => fquad(FBEAR, f),
  sheep: (f, col) => fquad(FSHEEP, f, col), cow: (f, col) => fquad(FCOW, f, col), pig: (f, col) => fquad(FPIG, f, col), goat: (f, col) => fquad(FGOAT, f, col) });
