'use strict';
// ===== FAUNA 2 (v3.4): dogs, hounds, cats, the hare and the rat; hens, doves, ducks, the pheasant and the falcon; how beasts move and look in the world =====
// ---------- yard dog: a mongrel — tan, black-and-tan, grey or white with patches; sits when idle ----------
const FDOG = { W: 20, H: 15, bx: 0, by: 5, stride: 1.5,
  body: [
    '......##########....',
    '.....############...',
    '.....############...',
    '.....###########....',
    '.....##bbb...###....',
    '.....##......##.....'],
  tails: [{ x: 15, y: 1, rows: ['.##', '..#', '..#', '.#.', '#..'] }, { x: 15, y: 1, rows: ['##.', '.#.', '..#', '.#.', '#..'] }],
  tailRun: { x: 15, y: 4, rows: ['..###', '###..'] },
  heads: {
    up: { x: 0, y: 1, rows: ['....d..', '...dd..', '..####.', '.##e##.', '#####..', 'kbb###.', '..bb##.'] },
    run: { x: 0, y: 2, rows: ['.....d.', '...ddd.', '..####.', '.##e##.', '#####..', 'kbb###.', '..bb##.'] } },
  poses: { 5: { x: 0, y: 0, rows: [
    '...................',
    '....d..............',
    '...dd..............',
    '..####.............',
    '.##e##.............',
    '#####..............',
    'kbb####............',
    '..bb####...........',
    '...b#####..........',
    '...b######.........',
    '...b#######........',
    '...b########.##....',
    '....#.#######......',
    '....#.#######......',
    '...kk.kkkk.........'] } },
  legs: { f: { x: 6, y: 10, w0: 2, wj: 2, w1: 1 }, h: { x: 14, y: 10, w0: 2, wj: 2, w1: 1, hind: 1, hock: 1 }, off: 1 },
  foot: P => FFOOT.paw(P.paw), pal: col => FDOGP[col] || FDOGP.tan };
const FDOGP = {}; { const tanB = ['#7a5a3a', '#a8845c', '#c8a47a', '#dcbe96', '#ecd6b4'];
  FDOGP.tan = fP({ '#': ['#3a1e0c', '#6a3a18', '#9a5c28', '#c0803c', '#d8a058'], d: ['#2a140a', '#4e2a12', '#74441e', '#94602c', '#b07a3e'], b: tanB, leg: ['#6a3a18', '#9a5c28', '#c0803c'], far: ['#3a1e0c', '#5a3214', '#74441e'], paw: '#2a140a' });
  FDOGP.black = fP({ '#': ['#0e0c10', '#1a1820', '#2a2832', '#3c3a46', '#52505e'], d: ['#0a080c', '#141218', '#201e26', '#2e2c36', '#3e3c48'], b: ['#5a3a1e', '#8a5a2e', '#ae7a40', '#c89656', '#dcb070'], leg: ['#1a1820', '#2a2832', '#3c3a46'], far: ['#0e0c10', '#16141a', '#201e26'], paw: '#5a3a1e' });
  FDOGP.grey = fP({ '#': ['#2a2a2e', '#46464c', '#64646a', '#828288', '#a2a2a6'], d: ['#1e1e22', '#323238', '#46464c', '#5a5a60', '#707076'], b: ['#6a6a6e', '#8e8e92', '#aeaeb2', '#c8c8cc', '#dcdcde'], leg: ['#46464c', '#64646a', '#828288'], far: ['#2a2a2e', '#3a3a40', '#4c4c52'], paw: '#1e1e22' });
  FDOGP.white = Object.assign(fP({ '#': ['#6a6660', '#a29e98', '#cac6c0', '#e4e0da', '#f6f4f0'], d: ['#3a1e0c', '#6a3a18', '#9a5c28', '#c0803c', '#d8a058'], b: ['#8a867e', '#b2aea6', '#d2cec6', '#e8e4de', '#f8f6f2'], leg: ['#a29e98', '#cac6c0', '#e4e0da'], far: ['#6a6660', '#8a8680', '#a29e98'], paw: '#4a4640', q: ['#3a1e0c', '#6a3a18', '#9a5c28', '#c0803c', '#d8a058'] }), { mark: fblob(3, 0.6, 2) }); }
// ---------- scent hound: tall and lean, long ears, white with patches, the tail carried high ----------
const FHOUND = { W: 22, H: 16, bx: 0, by: 5, stride: 1.5,
  body: [
    '.......##########.....',
    '......############....',
    '......############....',
    '......#bb#########....',
    '.......bbb.....###....',
    '.......##.......##....'],
  tails: [{ x: 16, y: 0, rows: ['...w', '..#.', '..#.', '.#..', '#...'] }, { x: 16, y: 0, rows: ['..w.', '..#.', '.#..', '.#..', '#...'] }],
  tailRun: { x: 16, y: 3, rows: ['....#w', '.###..', '#.....'] },
  heads: {
    up: { x: 0, y: 1, rows: ['...qqq..', '..qqqqq.', '.qqeqdd.', 'wwqqqdd.', 'kwwwqdd.', '..ww.dd.', '...ww.d.'] },
    run: { x: 0, y: 2, rows: ['...qqq..', '..qqqqq.', '.qqeqdd.', 'wwqqqdd.', 'kwwwqddd', '..ww..dd', '...w....'] },
    down: { x: 0, y: 5, rows: ['....qqq.', '...qqqdd', '..qqeqdd', '.wqqqqdd', '.wwqq.dd', '.www...d', '.kw.....'] } },
  poses: { 5: { x: 0, y: 0, rows: [
    '....qqq...............',
    '...qqqqq..............',
    '..qqeqdd..............',
    '.wwqqqdd..............',
    '.kwwwqdd..............',
    '...ww#dd..............',
    '...w####d.............',
    '...w#####.............',
    '...w######............',
    '...w#######...........',
    '...w########..........',
    '....#.#######.###.....',
    '....#.########w.......',
    '....#.#######.........',
    '....#.#######.........',
    '...kk.kkkk............'] } },
  legs: { f: { x: 8, y: 10, w0: 2, wj: 2, w1: 1 }, h: { x: 16, y: 10, w0: 2, wj: 2, w1: 1, hind: 1, hock: 1 }, off: 1 },
  foot: P => FFOOT.paw(P.paw), pal: col => FHOUNDP[col] || FHOUNDP.brown };
const FHOUNDP = {}; { const W0 = ['#6a6660', '#a29e98', '#cac6c0', '#e4e0da', '#f6f4f0'];
  const tan = ['#3a1a08', '#6e3610', '#a2581e', '#c47a34', '#dc9a52'], tanD = ['#2a1206', '#56280c', '#7e3e14', '#9a5420', '#b46a30'];
  for (const [k, q, d, sad] of [['brown', tan, tanD, ['#1e1008', '#3a2010', '#56321a', '#6e4424', '#865630']], ['black', tan, tanD, ['#0e0c10', '#1a1820', '#2a2832', '#3c3a46', '#52505e']], ['orange', ['#5a3a10', '#9a6a20', '#c8902e', '#e0b04a', '#f0cc72'], ['#3a2408', '#6a4612', '#9a6a20', '#b8862e', '#d0a040'], ['#5a3a10', '#9a6a20', '#c8902e', '#e0b04a', '#f0cc72']]])
    FHOUNDP[k] = Object.assign(fP({ '#': W0, w: W0, b: W0, q, d, s: sad, leg: ['#a29e98', '#cac6c0', '#e4e0da'], far: ['#6a6660', '#8a8680', '#a29e98'], paw: '#5a5650' }), { mark: (x, y) => (y <= 8 && x >= 9 && x <= 16 && (y <= 6 || vnz(x, y, 2, 3) > 0.45)) ? 's' : (x >= 16 && y <= 7 ? 's' : null) }); }
// ---------- cat: grey tabby, ginger, black or white; the tail up; sits and washes ----------
const FCAT = { W: 14, H: 11, bx: 0, by: 4, stride: 1,
  body: [
    '....#######...',
    '...#########..',
    '...#########..',
    '...##bbbbb##..',
    '...##.....##..'],
  tails: [{ x: 11, y: 0, rows: ['.##', '..#', '..#', '.#.', '#..'] }, { x: 11, y: 0, rows: ['##.', '#..', '.#.', '.#.', '#..'] }],
  tailRun: { x: 11, y: 3, rows: ['..##', '##..'] },
  heads: { up: { x: 0, y: 1, rows: ['.#..#.', '.####.', '#e###.', '####..', '.bb#..'] } },
  poses: { 5: { x: 0, y: 0, rows: [
    '.#..#.........',
    '.####.........',
    '#e###.........',
    '####..........',
    '.bb##.........',
    '..b###........',
    '..b####.......',
    '..b#####......',
    '...#.####..##.',
    '...#.#####d#..',
    '..kk.kkkk.....'] } },
  legs: { f: { x: 4, y: 8, w0: 1, wj: 1, w1: 1 }, h: { x: 11, y: 8, w0: 2, wj: 1, w1: 1, hind: 1, hock: 0 }, off: 1 },
  foot: P => FFOOT.paw(P.paw), pal: col => FCATP[col] || FCATP.grey };
const FCATP = {}; { const mk = (coat, b, e, stripes) => Object.assign(fP({ '#': coat, b, d: coat, e, leg: coat.slice(1, 4), far: coat.slice(0, 3), paw: coat[1], q: [coat[0], coat[0], coat[1], coat[2], coat[3]] }), stripes ? { mark: (x, y, ch) => ch === '#' && y > 3 && y < 8 && (x % 3 === 0) } : {});
  FCATP.grey = mk(['#1e1e24', '#3a3a42', '#5a5a62', '#7a7a82', '#9a9aa0'], ['#6a6a70', '#8e8e94', '#aeaeb2', '#c6c6ca', '#dcdcde'], '#d8c040', 1);
  FCATP.ginger = mk(['#3a1a08', '#6e3410', '#a2561e', '#c87a32', '#e09a4e'], ['#a88660', '#c8a47e', '#dec09a', '#ecd6b8', '#f6e8d4'], '#a8d040', 1);
  FCATP.black = mk(['#0a0a0e', '#141418', '#202026', '#2e2e36', '#3e3e48'], ['#141418', '#202026', '#2e2e36', '#3e3e48', '#4e4e58'], '#e8d040');
  FCATP.white = mk(['#6a6660', '#a29e98', '#cac6c0', '#e4e0da', '#f6f4f0'], ['#a29e98', '#cac6c0', '#e4e0da', '#f0ece6', '#fbfaf8'], '#60a8e0'); }
// ---------- hare: whole poses — crouched, ears laid back, slow hops, long bounds ----------
const FHARE = { W: 17, H: 13,
  poses: {}, pal: col => col === 'snow' ? FHAREP.snow : FHAREP.sand };
{ const SIT = ['.....k...........', '....k#...........', '....##...........', '....##...........', '...###...........', '..####.####......', '.##e##########...', '##############w..', 'k#############w..', '.bbb##########...', '...b#.########...', '...kk.kkkkkkk....'];
  const LOW = ['.................', '.................', '.................', '.................', '......kk.........', '...####..###.....', '.##e##########...', '##############w..', 'k#############w..', '.bbb##########...', '...b#.########...', '...kk.kkkkkkk....'];
  const HOP = ['....k............', '...k#............', '...##............', '...##.....#####..', '..###..#########.', '.####.##########w', '##e############w.', '##########bbb##..', 'k####bb.......##.', '.bb..##.......#..', '......##.......#.', '.......kk.......k'];
  const STR = ['.................', '.....kk..........', '....##...........', '...###....####...', '..####..#######..', '.##e###########w.', '###############w.', 'k#bb######bbb##..', '..b#.......###...', '...##.......##...', '....##.......kk..', '.....kk..........'];
  const GAT = ['.................', '.................', '....kk...........', '...##.....###....', '..###..#######...', '.##e##########w..', '##############w..', 'k#############...', '.bb#####.####....', '...##.##..##.....', '...k#.kkk.#k.....', '..kk.............'];
  const DEAD = ['.................', '.................', '.................', '.................', '.................', '.................', '.................', '..........######.', '.kk....##########', '##d############w.', 'k#bbb##bbbbbb##..', '.bb.kk.......kk..'];
  const P = FHARE.poses; [SIT, SIT, HOP, HOP].forEach((r, i) => { P[i] = { rows: i === 2 ? HOP : i === 3 ? STR : SIT }; }); P[1] = { rows: GAT };
  P[4] = { rows: SIT }; P[5] = { rows: LOW }; P[6] = { rows: STR }; P[7] = { rows: HOP }; P[8] = { rows: GAT }; P[9] = { rows: HOP }; P[10] = { rows: DEAD }; }
const FHAREP = { sand: fP({ '#': ['#3a2a1c', '#5e4632', '#846648', '#a68660', '#c4a67e'], b: ['#a8987e', '#c6b89e', '#dcd0b8', '#ece4d2', '#f8f4ea'], w: '#f4f0e8', e: '#140c08' }), snow: fP({ '#': ['#7a7a84', '#a6a6ae', '#cacad0', '#e4e4e8', '#f8f8fa'], b: ['#a6a6ae', '#cacad0', '#e4e4e8', '#f0f0f2', '#fcfcfd'], w: '#ffffff', e: '#140c08' }) };
// ---------- rat: a low grey body, a long naked tail ----------
const FRAT = { W: 12, H: 7, bx: 0, by: 2, stride: 1,
  body: ['...######...', '..########..', '..#bbbbbb#..'],
  tails: [{ x: 9, y: 3, rows: ['.p.', '..p', '..p'] }, { x: 9, y: 3, rows: ['.p.', '.pp', '...'] }],
  heads: { up: { x: 0, y: 2, rows: ['.p##.', '##e#.', 'k###.', '.bb..'] } },
  legs: { f: { x: 3, y: 5, w0: 1, wj: 1, w1: 1 }, h: { x: 8, y: 5, w0: 1, wj: 1, w1: 1, hind: 1, hock: 0 }, off: 1 },
  pal: fP({ '#': ['#1e1c20', '#34303a', '#4a4650', '#625e66', '#7a767e'], b: ['#4a4650', '#625e66', '#7a767e', '#928e96', '#aaa6ae'], p: '#c08890', e: '#0a0608', leg: ['#8a6a70', '#a07a80', '#b08a90'], far: ['#5a4a50', '#6a5a60', '#7a6a70'] }) };
Object.assign(FAUNA, { dog: (f, col) => fquad(FDOG, f, col), hound: (f, col) => fquad(FHOUND, f, col), cat: (f, col) => fquad(FCAT, f, col), hare: (f, col) => fquad(FHARE, f, col), rat: f => fquad(FRAT, f) });
// ---------- birds: body + head (up / pecking) + wings by flap phase; thin legs that step ----------
function fbird(S, f, col) { const P = typeof S.pal === 'function' ? S.pal(col) : S.pal, b = new PB(S.W, S.H), gy = S.H - 1, fly = f >= 6 && f <= 9, swim = /swim/.test(col || '');
  if (f === FA_DEAD && S.dead) { fshape(b, S.dead, 0, 0, P); b.outline(OUTL); return b; }
  const walk = f < 4, bob = walk && (f & 1) ? 1 : 0, peck = f === 5 && !fly;
  if (fly) { const ph = ['up', 'mid', 'down', 'mid'][f - 6], W0 = S.wings[ph]; if (S.wingsFar) { const Wf = S.wingsFar[ph]; if (Wf) fshape(b, Wf.rows, Wf.x, Wf.y, P.farP || P); }
    fshape(b, (S.flyBody || S.body).rows, (S.flyBody || S.body).x, (S.flyBody || S.body).y, P); const H0 = S.heads.fly || S.heads.up; fshape(b, H0.rows, H0.x, H0.y, P); if (W0) fshape(b, W0.rows, W0.x, W0.y, P); b.outline(OUTL); return b; }
  if (!swim && S.legs) { const L = S.legs, st = [[-1, 0, 1, 0], [0, 1, 0, 0], [1, 0, -1, 0], [0, 0, 0, 1]][walk ? f : 1]; const lc = P.legc || P.o;
    const leg = (x, dx, up, c) => { const fx = x + dx, top = L.y; b.vl(x, top, Math.max(1, gy - up - top), c); if (fx !== x) b.set(fx, gy - up, c); b.set(fx - 1, gy - up, c); b.set(fx, gy - up, c); };
    leg(L.x[1], st[2], st[3], P.legf || lc); leg(L.x[0], st[0], st[1], lc); }
  const B = swim && S.swimBody ? S.swimBody : S.body; fshape(b, B.rows, B.x, B.y + (swim ? S.swimDy || 0 : 0), P);
  const H0 = peck && S.heads.down ? S.heads.down : S.heads.up; fshape(b, H0.rows, H0.x - (walk && !(f & 1) && S.nod ? 1 : 0), H0.y + (swim ? S.swimDy || 0 : 0) + (peck ? 0 : bob * 0), P);
  b.outline(OUTL);
  if (swim) { const y = (S.swimLine || gy - 2); for (let x = 1; x < S.W - 2; x++) if (b.get(x, y - 1) && (x + f) % 3) b.set(x, y, hx('#a8d8f0')); }
  return b; }
// hen and cock
const FHEN = { W: 12, H: 12, nod: 1,
  body: { x: 0, y: 4, rows: ['.........dd.', '..##....ddd.', '..#########.', '..##########', '...#dd#####.', '....######..'] },
  heads: { up: { x: 0, y: 1, rows: ['.rr.', '.r##', 'o#e#', '.r##', '..##'] }, down: { x: 0, y: 6, rows: ['..##', '.###', 'r#e#', 'o##.', 'or..'] } },
  wings: { up: { x: 4, y: 1, rows: ['..dd..', '.dddd.', 'ddddd.'] }, mid: { x: 4, y: 3, rows: ['...dd.', 'ddddd.'] }, down: { x: 4, y: 8, rows: ['ddddd.', '.dddd.', '..dd..'] } },
  flyBody: { x: 0, y: 4, rows: ['.........dd.', '..##....ddd.', '..#########.', '..##########', '...#######..', '....oo.oo...'] },
  legs: { x: [6, 7], y: 10 }, pal: col => FHENP[col] || FHENP.white };
const FHENP = { white: fP({ '#': ['#6e6a72', '#a8a4ac', '#d0ccd2', '#ece8ec', '#fdfbf8'], d: ['#5a5660', '#8a8690', '#b4b0b8', '#cecad0', '#e2dee4'], r: '#d02838', o: '#e8a030', e: '#1a1418' }),
  brown: fP({ '#': ['#3a1e0e', '#66381a', '#925428', '#b4723a', '#cc8e50'], d: ['#2a1408', '#4a2812', '#6a3c1c', '#86502a', '#a06438'], r: '#d02838', o: '#e8a030', e: '#1a1418' }),
  black: fP({ '#': ['#0e0e14', '#1c1c26', '#2c2c3a', '#3e3e50', '#545468'], d: ['#0a0a10', '#14141e', '#20202c', '#2c2c3a', '#3c3c4c'], r: '#d02838', o: '#c8a040', e: '#e8d0a0' }),
  cock: fP({ '#': ['#4a1a08', '#82300e', '#b84e18', '#d87028', '#ec9440'], d: ['#081a14', '#102c24', '#1a4436', '#265c48', '#36785c'], r: '#e02030', o: '#e8a030', e: '#1a1418' }) };
FHEN.cock = Object.assign({}, FHEN, { body: { x: 0, y: 0, rows: ['.........dd.', '........dddd', '.......dd.dd', '.......d...d', '.......dd..d', '..##..ddd...', '..#########.', '..##########', '...#dd#####.', '....######..'] },
  heads: { up: { x: 0, y: 0, rows: ['.rrr', '.r##', 'o#e#', '.r##', '.r##', '..##'] }, down: { x: 0, y: 6, rows: ['..##', '.###', 'r#e#', 'o##.', 'or..'] } } });
// rock dove — grey, the neck shot with green and violet, two dark wing bars
const FPIGEON = { W: 10, H: 8, nod: 1,
  body: { x: 0, y: 3, rows: ['..g#......', '..gg#####.', '...##dd###', '....#####.'] },
  heads: { up: { x: 0, y: 1, rows: ['.##.', 'ke#.'] }, down: { x: 0, y: 4, rows: ['.##', 'ke#', 'k..'] } },
  wings: { up: { x: 3, y: 0, rows: ['....##', '..####', '.####.'] }, mid: { x: 3, y: 2, rows: ['...###', '.####.'] }, down: { x: 3, y: 5, rows: ['.####.', '..####', '....##'] } },
  flyBody: { x: 0, y: 3, rows: ['..g#......', '..gg######', '...#####d.'] },
  legs: { x: [5, 6], y: 7 }, pal: col => FPIGP2[col] || FPIGP2.grey };
const FPIGP2 = { grey: fP({ '#': ['#3a3a48', '#5a5a6c', '#7c7c90', '#9e9eb0', '#bcbcca'], d: '#2a2a36', g: ['#203a30', '#2e5444', '#3e6c58', '#5a7a90', '#8a8aa8'], k: '#2a2228', e: '#e87830', o: '#c85860', legc: hx('#c85860') }),
  white: fP({ '#': ['#8a8a94', '#b4b4be', '#d8d8de', '#eeeef2', '#fcfcfd'], d: '#a0a0aa', g: ['#8a8a94', '#b4b4be', '#d8d8de', '#eeeef2', '#fcfcfd'], k: '#5a4a50', e: '#e87830', o: '#c85860', legc: hx('#c85860') }),
  brown: fP({ '#': ['#3a2a24', '#5e4438', '#82604e', '#a07c66', '#bc9a84'], d: '#2a1e1a', g: ['#2e2e3a', '#44445a', '#5e5e7a', '#7a7a94', '#9a9ab0'], k: '#2a2228', e: '#e87830', o: '#c85860', legc: hx('#c85860') }) };
// mallard — drake (green head, white collar, chestnut breast) or duck (mottled brown); afloat with a ripple
const FDUCK = { W: 14, H: 11, swimDy: 2, swimLine: 10,
  body: { x: 0, y: 5, rows: ['...cc.....k...', '..ccc#######k.', '..cc#########.', '...b########..', '....######....'] },
  swimBody: { x: 0, y: 5, rows: ['...cc.....k...', '..ccc#######k.', '..cc#########.', '...bbbbbbbbb..'] },
  heads: { up: { x: 0, y: 1, rows: ['..gg.', '.ggeg', 'ooggg', '...wg'] }, down: { x: 0, y: 5, rows: ['..gg.', '.ggeg', '.oggg', 'oo...'] } },
  wings: { up: { x: 5, y: 0, rows: ['...###', '..####', '.####.', '####..'] }, mid: { x: 5, y: 3, rows: ['....##', '..####', '#####.'] }, down: { x: 5, y: 7, rows: ['####..', '.####.', '..##s#', '...##.'] } },
  flyBody: { x: 0, y: 4, rows: ['...cc.........', '..ccc#######k.', '..cc#########k', '...b#######...'] }, heads2: 0,
  legs: { x: [6, 8], y: 10 }, pal: col => /hen/.test(col || '') ? FDUCKP.hen : FDUCKP.drake,
  dead: ['..............', '..............', '..............', '..............', '..............', '.....k....##..', '..gg.######...', 'ooggwcc#####..', '.ggegcc####s..', '..gg.bbbbb....', '....oo..oo....'] };
const FDUCKP = { drake: fP({ '#': ['#4a4a52', '#6e6e78', '#94949e', '#b6b6be', '#d4d4da'], c: ['#3a1a10', '#5e2c18', '#7e3e22', '#9a5030', '#b46640'], g: ['#0a2a18', '#124228', '#1a5a36', '#287848', '#3a965c'], w: '#f4f4f0', o: '#e8c030', b: ['#8a8a92', '#aeaeb6', '#cacad0', '#dedee2', '#ececee'], k: '#141418', e: '#0a0a0e', s: '#3a50c8', legc: hx('#e88a30') }),
  hen: fP({ '#': ['#3a2a1a', '#5a4228', '#7c5c3a', '#9a7a52', '#b49668'], c: ['#3a2a1a', '#5a4228', '#7c5c3a', '#9a7a52', '#b49668'], g: ['#3a2a1a', '#5a4228', '#7c5c3a', '#9a7a52', '#b49668'], w: '#9a7a52', o: '#c87a30', b: ['#7c5c3a', '#9a7a52', '#b49668', '#c8ac80', '#d8c09a'], k: '#3a2a1a', e: '#0a0a0e', s: '#3a50c8', legc: hx('#e88a30') }) };
// cock pheasant — copper, the dark green head and red face, a white ring, a long barred tail
const FPHEAS = { W: 20, H: 11, nod: 1,
  body: { x: 0, y: 5, rows: ['..###.....tt........', '.#######.ttttt......', '.##########ttttttt..', '..##dd####....ttttt.', '...#####............'] },
  heads: { up: { x: 0, y: 1, rows: ['.gg.', 'grrg', 'ogeg', '..wg'] }, down: { x: 0, y: 5, rows: ['.gg.', 'grrg', 'ogeg', 'o.w.'] } },
  wings: { up: { x: 4, y: 0, rows: ['...dd.', '..ddd.', '.dddd.', 'dddd..'] }, mid: { x: 4, y: 3, rows: ['...dd.', '.dddd.', 'dddd..'] }, down: { x: 4, y: 7, rows: ['dddd..', '.dddd.', '..ddd.', '...dd.'] } },
  flyBody: { x: 0, y: 4, rows: ['..###...............', '.#######..ttttttt...', '.##########ttttttttt', '..#######.....ttt...'] },
  legs: { x: [5, 6], y: 10 }, pal: fP({ '#': ['#3a1408', '#6e2a10', '#a4441a', '#c8622a', '#e08440'], d: ['#2a1a10', '#4a3420', '#6e5232', '#8e6e46', '#ae8c5e'], t: ['#3a2a18', '#5e4628', '#846640', '#a8865a', '#c4a676'], g: ['#08180e', '#0e2a1a', '#164028', '#205a3a', '#2e7650'], r: '#d02830', w: '#f4f0e8', o: '#c8b060', e: '#0a0a0e', legc: hx('#8a7a5a') }),
  dead: ['....................', '....................', '....................', '....................', '....................', '....................', '..........tttttt....', '.gg.###.ttttttttttt.', 'grrg#########tt.....', 'oge#ddd#####........', '..w...k..k..........'] };
// falcon — slate back, a dark moustache, a barred pale breast, yellow feet; perched, flying, mantling
const FFALC = { W: 18, H: 13,
  body: { x: 0, y: 1, rows: ['......###.........', '.....#####........', '....o#e##.........', '.....m#bb#........', '.....m#bbb#.......', '......#bbbd#......', '......#bbbdd#.....', '.......#bbdd#.....', '.......#bbd##.....', '........#dd##.....', '........dddd......', '........oo.o......'] },
  heads: { up: { x: 0, y: 0, rows: ['..'] }, fly: { x: 0, y: 5, rows: ['...###', '..o#e#', '...m##'] } },
  wings: { up: { x: 6, y: 0, rows: ['.......###', '.....####.', '...#####..', '..#####...', '.####.....'] }, mid: { x: 6, y: 3, rows: ['......##', '...#####', '.######.', '#####...'] }, down: { x: 6, y: 8, rows: ['.####.....', '..#####...', '...#####..', '.....####.', '.......###'] } },
  flyBody: { x: 0, y: 5, rows: ['...###............', '..o#e#######......', '...m##bbbb###dd...', '.....######dddd...'] },
  pal: fP({ '#': ['#1e222e', '#323848', '#4a5266', '#646e84', '#808aa0'], b: ['#8a826e', '#b0a68e', '#cec4aa', '#e2dac2', '#f0eadc'], d: ['#2a2a32', '#3e3e4a', '#545462', '#6c6c7a', '#848494'], m: '#141820', o: '#e8c030', e: '#0a0a0e' }) };
FFALC.poses = {}; FFALC.mantle = { x: 0, y: 3, rows: ['.###..............', 'o#e#####......###.', '.m##############..', '..#bbbb##########.', '....bbbdd####.....', '......oo.oo.......'] };
const FAUNA3 = {
  hen: (f, col) => fbird(col === 'cock' ? FHEN.cock : FHEN, f, col), pigeon: (f, col) => fbird(FPIGEON, f, col), duck: (f, col) => fbird(FDUCK, f, col), pheasant: (f, col) => fbird(FPHEAS, f, col),
  falcon: (f, col) => { if (f === 5) { const b = new PB(FFALC.W, FFALC.H); fshape(b, FFALC.mantle.rows, FFALC.mantle.x, FFALC.mantle.y, FFALC.pal); b.outline(OUTL); return b; }
    if (f === 4) { const b = new PB(FFALC.W, FFALC.H); fshape(b, FFALC.body.rows, FFALC.body.x, FFALC.body.y, FFALC.pal); b.outline(OUTL); return b; } return fbird(FFALC, f < 4 ? 6 + f : f, col); } };
Object.assign(FAUNA, FAUNA3);
// ---------- in the world: coats for the yard beasts, the stag's tines, the winter coat; which frame to show ----------
const FA_STEP = { deer: 4, boar: 3, wolf: 4, fox: 3, bear: 4, sheep: 3, cow: 4, pig: 3, goat: 3, dog: 3, hound: 3.5, cat: 2.5, hare: 3, rat: 2, hen: 2.5, pigeon: 2, duck: 2.5, pheasant: 3, falcon: 3 };
const FA_RUNV = { deer: 60, boar: 50, wolf: 60, fox: 50, bear: 45, sheep: 20, cow: 14, pig: 20, goat: 22, dog: 60, hound: 90, cat: 35, hare: 50, rat: 30 };
const FA_BIRD = { hen: 1, pigeon: 1, duck: 1, pheasant: 1, falcon: 1 }, FA_SIT = { dog: 1, hound: 1, cat: 1 };
const FA_VAR = { dog: ['tan', 'black', 'grey', 'white', 'tan'], cat: ['grey', 'ginger', 'black', 'white', 'grey', 'ginger'], hen: ['white', 'brown', 'brown', 'black', 'white', 'brown'], pigeon: ['grey', 'grey', 'grey', 'white', 'brown'],
  sheep: ['white', 'white', 'white', 'pale', 'brown', 'white', 'black'], cow: ['red', 'pied', 'black', 'dun'], pig: ['pink', 'spotted', 'dark', 'pink'], goat: ['white', 'brown', 'pied'], duck: ['drake', 'hen', 'drake', 'hen', 'hen'] };
let FA_SEQ = 0;
const faRnd = k => hsh(FA_SEQ++, k, 17);
// points of a stag's head: most carry 8–12, a royal 14, an imperial 16
function faPts(a) { if (a.pts === undefined) { const r = faRnd(3); a.pts = r < 0.12 ? 6 : r < 0.36 ? 8 : r < 0.62 ? 10 : r < 0.84 ? 12 : r < 0.96 ? 14 : 16; } return a.pts; }
function faCol(a) { const k = a.kind;
  if (k === 'deer') { const w = G && G.day !== undefined && seasonOf(G.day) === 3 ? 'w' : ''; if (a.col === 'hart') return 'hart' + faPts(a); return a.col === 'doe' ? w + 'doe' : w + 'stag' + faPts(a); }
  if (k === 'hare' || k === 'hound' || k === 'horse') return a.col || null;
  if (k === 'duck') { const c = a.col || a.vc || (a.vc = FA_VAR.duck[Math.floor(faRnd(5) * 5)]), L = LOCS[a.loc];
    if (L && L.ter && !(a.h > 0) && a.st !== 'dead') { const i = Math.floor(a.y / CT) * L.w + Math.floor(a.x / CT); if (L.ter[i] === GT.WATER) return c + '_swim'; } return c; }
  if (k === 'hen' && a.vc === undefined && COURT.ani) { const n = COURT.ani.filter(b => b.kind === 'hen' && b.loc === a.loc && b.vc === 'cock').length; a.vc = n ? FA_VAR.hen[Math.floor(faRnd(7) * 6)] : 'cock'; }
  if (a.col) return a.col; const V = FA_VAR[k]; if (!V) return null; if (a.vc === undefined) a.vc = V[Math.floor(faRnd(11) * V.length)]; return a.vc; }
function faFrame(a) { const k = a.kind; if (a.st === 'dead') return FA_DEAD;
  const now = NOW, dt = now - (a._t === undefined ? now : a._t), mv = a._x === undefined ? 0 : Math.hypot(a.x - a._x, a.y - a._y); if (dt > 0 && dt < 0.5) a._v = (a._v || 0) * 0.75 + (mv / dt) * 0.25; else if (dt >= 0.5) a._v = 0; a._x = a.x; a._y = a.y; a._t = now;
  if (a.vs === undefined) a.vs = faRnd(13) * 20;
  if (FA_BIRD[k]) { if (a.fly > 0 || a.h > 0 || a.st === 'fly') return 6 + Math.floor(a.f / 3) % 4; if (a.moving) return Math.floor(a.f / FA_STEP[k]) % 4; return a.peck ? 5 : 4; }
  if (a.st === 'lie') return FA_DEAD;
  if (a.moving || (a._v || 0) > 6) { const run = (a._v || 0) > (FA_RUNV[k] || 50) || a.st === 'flee' || a.st === 'charge'; return (run ? 6 : 0) + Math.floor(a.f / ((FA_STEP[k] || 3) * (run ? 1.7 : 1))) % 4; }
  if (a.st === 'alert' || a.st === 'bay' || a.st === 'charge' || a.st === 'heel') return 4;
  if (FA_SIT[k]) return Math.sin(now * 0.21 + a.vs) > -0.3 ? 5 : 4;
  if (k === 'rat') return Math.sin(now * 1.3 + a.vs) > 0.6 ? 5 : 4;
  return Math.sin(now * 0.45 + a.vs) > -0.2 ? 5 : 4; }
function faDraw(g, a) { const f = faFrame(a), s = animalSprite(a.kind, f, a.flip, faCol(a)), x = Math.round(a.x - s.width / 2), y = Math.round(a.y - s.height - (a.h || 0)), big = s.width > 20;
  if (f === FA_DEAD && a.st === 'dead') { if (!a.h) { g.fillStyle = 'rgba(90,16,16,0.55)'; g.fillRect(Math.round(a.x - 5), Math.round(a.y - 1), 10, 2); g.fillRect(Math.round(a.x - 3), Math.round(a.y + 1), 6, 1); } }
  else g.drawImage(shadowSpr(big ? 22 : 9), Math.round(a.x - (big ? 11 : 4.5)), Math.round(a.y - 2));
  g.drawImage(s, x, y); }
