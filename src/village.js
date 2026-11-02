'use strict';
// ===== VILLAGE (v3.3): villages and towns the king can walk into =====
// Row A — houses along the street (doors onto it), the green (the market square in towns), row B — houses along the back lane,
// then fields, the pasture, the pond or the shore, the mill. Inside: the tavern and the headman's house (the town hall in towns).
// Everything comes from the settlement id and the world seed: a village looks the same on every visit and after loading a save.
const VSTY = { K: [['timber', 'thatch'], ['timber', 'thatch'], ['plank', 'thatch']], C: [['plank', 'thatch'], ['plank', 'shake'], ['plank', 'shake']],
  R: [['stone', 'tile'], ['stone', 'tile'], ['timber', 'tile']], T: [['timber', 'slate'], ['stone', 'slate'], ['plank', 'thatch']],
  E: [['stone', 'tile'], ['stone', 'tile'], ['timber', 'tile']], F: [['plank', 'thatch'], ['timber', 'thatch'], ['plank', 'shake']] };
const VSTY_T = { K: [['timber', 'tile'], ['timber', 'slate'], ['stone', 'slate']], C: [['plank', 'shake'], ['timber', 'shake'], ['stone', 'slate']],
  R: [['stone', 'tile'], ['timber', 'tile'], ['stone', 'tile']], T: [['stone', 'slate'], ['timber', 'slate'], ['stone', 'slate']],
  E: [['stone', 'tile'], ['stone', 'tile'], ['timber', 'tile']], F: [['timber', 'thatch'], ['plank', 'shake'], ['timber', 'tile']] };
const VSHUT = ['green', 'blue', 'red', 'wood', 'teal', 'wine'];
const VGEO = { village: { w: 64, h: 42, yA: 12, st: [14, 16], gr: [17, 21], yB: 25, ln: [27, 28], sb: 29 }, town: { w: 72, h: 46, yA: 12, st: [14, 16], gr: [17, 23], yB: 28, ln: [30, 31], sb: 32 } };
let VMAP = null; // the layout of the place being visited (rebuilt with its locations)
function vRng(sid, salt) { return mkRng(((((G && G.seed) || 1) * 2654435761) ^ (sid * 7919 + (salt || 0) * 104729 + 0x9e37)) >>> 0); }
function vEnv(sid) { const s = WD.setts[sid], c = { wat: 0, forest: 0, hill: 0, steppe: 0, snow: 0, marsh: 0 };
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = s.x + dx, y = s.y + dy; if (!inMap(x, y)) continue; const t = WD.ter[y * MW + x];
    if (t <= TR.LAKE) c.wat++; else if (t === TR.FOREST || t === TR.DFOREST) c.forest++; else if (t >= TR.HILLS && t <= TR.PEAK) c.hill++; else if (t === TR.STEPPE) c.steppe++; else if (t === TR.SNOW) c.snow++; else if (t === TR.MARSH) c.marsh++; }
  const cul = WD.provs[s.prov].cul || 'K';
  return { coast: !!s.coast || c.wat >= 9, forest: c.forest >= 10, hill: c.hill >= 8, steppe: c.steppe >= 12, snow: c.snow >= 8, marsh: c.marsh >= 6, south: cul === 'R' || cul === 'E', cul }; }
const vTree = (L, r, tx, ty, pine, occ) => { if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h || L.solid[ty * L.w + tx]) return; if (occ) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (occ[(ty + dy) * L.w + tx + dx]) return; occ[ty * L.w + tx] = 1; }
  const v = r.i(0, 5); place(L, pine ? 'pine' : 'oak', { seed: 300 + v * 17 + (pine ? 7 : 0), ck: 'f' + (pine ? 'pine' : 'oak') + v }, tx, ty, { cx: tx * CT + 8, solid: [tx, ty, tx, ty], shadow: pine ? [12, 4] : [20, 6] }); };
// one building of a row: { kind, w (tiles), dt (door tile offset), dw (door width in tiles), k (sprite), o (sprite options) }
function vSpec(kind, r, M, idx) { const st = r.pick(M.sty), ck = 'vb' + M.sid + '_' + idx, seed = r.i(1, 900), shut = r.f() < 0.65 ? r.pick(VSHUT) : undefined;
  const wins = (W0, fh, dpx, dw, rows) => { const o = []; for (const wy of rows) for (let x = 7; x <= W0 - 15; x += 19) { if (wy + 9 > fh - 24 && x + 10 > dpx && x < dpx + dw + 2) continue; o.push([x, wy, 8, 9]); } return o; };
  if (kind === 'house' || kind === 'house2' || kind === 'bake' || kind === 'shop') { const two = kind !== 'house' || M.town, w = two ? r.pick([5, 6]) : r.pick([4, 5, 5]), W0 = w * 16, fh = two ? 46 : 30, rh = two ? 32 : 28, dt = r.i(1, w - 2), dpx = dt * 16 + 1;
    const o = { w, fh, rh, wall: st[0], roof: st[1], doors: [[dpx, 14, 20, 0]], wins: wins(W0, fh, dpx, 14, two ? [8, 26] : [9]), chim: kind === 'bake' || r.f() < 0.85 ? r.i(4, W0 - 16) : undefined, seed, shut, box: r.f() < 0.45, ck };
    if (kind === 'bake') o.sign = [dpx + 16 > W0 - 12 ? dpx - 14 : dpx + 16, 'bread']; if (kind === 'shop') o.sign = [dpx + 16 > W0 - 12 ? dpx - 14 : dpx + 16, r.pick(['sword', 'grain', 'fish', 'mug'])];
    return { kind, w, dt, dw: 1, k: 'bld', o }; }
  if (kind === 'tav') { const w = M.town ? 9 : 8, W0 = w * 16, fh = M.town ? 46 : 36, dt = 3, dpx = dt * 16 + 4;
    return { kind, w, dt, dw: 2, k: 'bld', o: { w, fh, rh: 32, wall: st[0], roof: st[1], doors: [[dpx, 24, 24, 1]], wins: wins(W0, fh, dpx, 24, M.town ? [8, 26] : [10]), chim: W0 - 22, seed, shut: 'red', box: 1, sign: [dpx + 28, 'mug'], ck } }; }
  if (kind === 'head') { const w = 6, W0 = 96, dt = 2, dpx = dt * 16 + 1; return { kind, w, dt, dw: 1, k: 'bld', o: { w, fh: 34, rh: 30, wall: st[0], roof: st[1], doors: [[dpx, 14, 20, 0]], wins: wins(W0, 34, dpx, 14, [10]), chim: 70, seed, shut: 'green', box: 1, ck } }; }
  if (kind === 'smith') { const w = 6; return { kind, w, dt: 1, dw: 1, k: 'bld', anim: 4, o: { w, fh: 34, rh: 28, wall: M.town ? 'stone' : 'plank', roof: st[1] === 'thatch' ? 'shake' : st[1], kind: 'forge', doors: [], wins: [], chim: 8, seed, sign: [70, 'anvil'], ck } }; }
  if (kind === 'barn') { const w = 6; return { kind, w, dt: 2, dw: 1, k: 'bld', o: { w, fh: 36, rh: 28, wall: 'plank', roof: st[1], kind: 'stable', stalls: 3, doors: [], wins: [], seed, ck } }; }
  if (kind === 'chap' || kind === 'church') return { kind, w: 8, dt: 3, dw: 2, k: 'chapelb', o: {} };
  if (kind === 'hall') { const w = 10, W0 = 160, dt = 4, dpx = dt * 16 + 4; return { kind, w, dt, dw: 2, k: 'bld', o: { w, fh: 52, rh: 40, wall: 'stone', roof: 'slate', doors: [[dpx, 24, 28, 0]], wins: wins(W0, 52, dpx, 24, [8, 30]), seed, shut: 'navy', box: 1, ck } }; }
  return null; }
function vPlace(L, M, b, tx, y, row) { const T = GT;
  const ob = place(L, b.k, b.o, tx, y, { dx: b.k === 'bld' ? -2 : 0, solid: [tx, y - 2, tx + b.w - 1, y], anim: b.anim || 0, fps: 7 });
  if (b.kind === 'smith') lightAt(L, tx * CT + 40, (y - 1) * CT, 46, '#ff8a3a', 0.75, { fl: 0.25 });
  const d = tx + b.dt, H = { i: M.houses.length, kind: b.kind, tx, w: b.w, y, door: d, dw: b.dw, row }; M.houses.push(H); if (!M[b.kind]) M[b.kind] = H;
  // the front strip: a wattle fence (village) or flowerbeds (town), a gap at the door
  const segs = [[tx, d - 1], [d + b.dw, tx + b.w - 1]];
  for (const [a, z] of segs) { if (z < a) continue; sfill(L, a, y + 1, z, y + 1);
    if (b.kind === 'tav' || b.kind === 'hall' || b.kind === 'chap' || b.kind === 'church' || M.town) { for (let x = a; x <= z; x++) { const p = M.r.f(); if (p < 0.12 && b.kind !== 'chap' && b.kind !== 'church') place(L, 'barrel', {}, x, y + 1, { dx: 1 }); else place(L, M.r.f() < 0.5 ? 'flowers' : 'herbs', { n: 1, seed: x * 7 + y, ck: 'vfl' + (x % 4) }, x, y + 1, { bake: 1 }); } }
    else if (b.kind === 'smith') { place(L, 'anvil', {}, a + 1 <= z ? a + 1 : a, y + 1, { dx: -1 }); for (let x = a; x <= z; x++) if (x !== a + 1) place(L, 'crate', {}, x, y + 1, {}); }
    else place(L, 'fence', { n: z - a + 1, ck: 'vf' + (z - a + 1) }, a, y + 1, {}); }
  const kind = b.kind; spot(L, 'vh' + H.i, d, y + 1, 'up', { away: 1 }); spot(L, 'vf' + H.i, d, y + 2, 'down');
  if (b.dw === 2) spot(L, 'vf' + H.i + 'b', d + 1, y + 2, 'down');
  if (kind === 'smith') spot(L, 'v_smith', d + 1, y + 2, 'up');
  if (kind === 'chap' || kind === 'church') spot(L, 'v_priest', d, y + 2, 'down');
  return H; }
function vRow(L, M, list, y, x0, x1, row) { const r = M.r; let specs = list.map((k, i) => vSpec(k, r, M, M.houses.length + i)).filter(Boolean);
  const need = () => specs.reduce((s, b) => s + b.w, 0) + 2 * (specs.length - 1);
  while (need() > x1 - x0 + 1) { const j = specs.map(b => b.kind).lastIndexOf(M.town ? 'house2' : 'house'); if (j < 0) break; specs.splice(j, 1); }
  const gaps = specs.map(() => 2); gaps[specs.length - 1] = 0; let extra = x1 - x0 + 1 - need(), lead = 0;
  while (extra > 0) { const k = r.i(-1, specs.length - 2); if (k < 0) lead++; else gaps[k]++; extra--; }
  let x = x0 + Math.min(lead, 3); specs.forEach((b, i) => { vPlace(L, M, b, x, y, row); x += b.w + gaps[i]; }); }
// ---------- the outdoor map ----------
function vBuild(sid) { const s = WD.setts[sid], town = s.type !== 'village', g = VGEO[town ? 'town' : 'village'], env = vEnv(sid), r = vRng(sid, 1), T = GT, W0 = g.w, H0 = g.h, sea = seasonOf(G.day);
  const M = VMAP = { sid, town, g, env, r, sty: (town ? VSTY_T : VSTY)[env.cul] || VSTY.K, houses: [], stalls: [], benches: [], seats: [], rooms: [], fields: [], gardens: [], cx: W0 >> 1 };
  const L = mkLoc('v_out', s.name, W0, H0, 300 + sid % 97, true), occ = new Uint8Array(W0 * H0), road = town ? T.COBBLE : T.DIRT, cx = M.cx;
  tfill(L, 0, 0, W0 - 1, H0 - 1, T.GRASS);
  if (town) { tfill(L, 0, 0, W0 - 1, 2, T.CWALL); tfill(L, 0, 0, 1, H0 - 1, T.CWALL); tfill(L, W0 - 2, 0, W0 - 1, H0 - 1, T.CWALL); if (!env.coast) tfill(L, 0, H0 - 2, W0 - 1, H0 - 1, T.CWALL); }
  tfill(L, 0, g.st[0], W0 - (town ? 3 : 1), g.st[1], road); tfill(L, town ? 2 : 3, g.ln[0], W0 - (town ? 3 : 4), g.ln[1], road);
  if (town) tfill(L, 2, g.gr[0], W0 - 3, g.gr[1], T.COBBLE);
  for (let i = 0; i < W0 * H0; i++) if (L.ter[i] === T.CWALL) L.solid[i] = 1;
  // the two rows of houses
  const rA = town ? ['house2', 'tav', 'house2', 'hall', 'house2', 'church', 'house2', 'house2'] : [r.f() < 0.75 ? 'smith' : 'house', 'house', 'head', 'tav', 'house', (r.f() < 0.85 || !!(G.folk && G.folk[sid] && G.folk[sid].chap)) ? 'chap' : 'house', 'house', 'house'];
  const rB = town ? ['house2', 'bake', 'house2', 'shop', 'house2', 'smith', 'house2', 'shop', 'house2'] : ['house', 'house', 'barn', 'house', 'house', 'house', 'house'];
  vRow(L, M, rA, g.yA, town ? 3 : 4, W0 - 4, 'A'); vRow(L, M, rB, g.yB, 3, W0 - 4, 'B');
  // the north band: kitchen gardens behind the houses, an orchard in the gaps, the graveyard behind the chapel, beehives, woodpiles
  const nb0 = town ? 3 : 2, nb1 = g.yA - 6, cs = sea === 3 ? 3 : sea === 2 ? 2 : sea === 1 ? 1 : 0;
  for (const H of M.houses.filter(h => h.row === 'A')) { const x0 = H.tx, x1 = H.tx + H.w - 1;
    if (H.kind === 'chap' || H.kind === 'church') { for (let x = x0 + 1; x <= x1 - 1; x += 2) for (let y = nb0 + 1; y <= nb1; y += 2) if (r.f() < 0.7) place(L, 'grave', { seed: x * 5 + y, ck: 'vg' + ((x + y) % 4) }, x, y, { dx: 2, solid: [x, y, x, y] }); if (!town) place(L, 'fence', { n: H.w, ck: 'vf' + H.w }, x0, nb0 - 1, { solid: [x0, nb0 - 1, x1, nb0 - 1] }); continue; }
    if (H.kind === 'tav') { place(L, 'cask', {}, x0 + 1, nb1, { solid: [x0 + 1, nb1, x0 + 2, nb1] }); place(L, 'barrel', {}, x0 + 4, nb1, { solid: [x0 + 4, nb1, x0 + 4, nb1] }); place(L, 'cart', {}, x0 + 5, nb1 - 2, { solid: [x0 + 5, nb1 - 2, x0 + 7, nb1 - 2] }); continue; }
    if (H.kind === 'hall') { place(L, 'fountain', {}, x0 + 3, nb1, { cx: (x0 + 5) * CT, anim: 4, fps: 5, solid: [x0 + 3, nb1 - 1, x0 + 6, nb1] }); continue; }
    if (H.kind === 'smith') { place(L, 'woodpile', {}, x0 + 1, nb1, { solid: [x0 + 1, nb1, x0 + 2, nb1] }); place(L, 'woodpile', {}, x0 + 3, nb1 - 2, { solid: [x0 + 3, nb1 - 2, x0 + 4, nb1 - 2] }); continue; }
    tfill(L, x0, nb0 + 1, x1, nb1, T.SOIL); M.gardens.push([x0, nb0 + 1, x1, nb1, H.i]);
    for (let x = x0; x <= x1; x++) for (let y = nb0 + 1; y <= nb1; y++) place(L, 'crops', { s: cs, k: 'cabbage', seed: x + y * 3, ck: 'vcc' + cs + ((x + y) % 3) }, x, y, { bake: 1 });
    if (H.kind === 'head' || r.f() < 0.3) { place(L, 'beehive', {}, x1, nb0, { solid: [x1, nb0, x1, nb0] }); if (x1 - 1 > x0) place(L, 'beehive', {}, x1 - 1, nb0, { solid: [x1 - 1, nb0, x1 - 1, nb0] }); }
    else if (r.f() < 0.4) place(L, 'woodpile', {}, x0, nb0, { solid: [x0, nb0, x0 + 1, nb0] }); }
  for (let x = 2; x < W0 - 2; x++) { if (L.solid[nb1 * W0 + x] || L.ter[nb1 * W0 + x] === T.SOIL) continue; if (M.houses.some(h => h.row === 'A' && x >= h.tx - 1 && x <= h.tx + h.w)) continue; if (r.f() < 0.5) { place(L, 'fruit', { seed: x, ck: 'vfr' + (x % 4) }, x, nb1 - 1, { cx: x * CT + 8, solid: [x, nb1 - 1, x, nb1 - 1], shadow: [14, 5] }); occ[(nb1 - 1) * W0 + x] = 1; x += 2; } else if (r.f() < 0.25) { place(L, 'hay', {}, x, nb1, { solid: [x, nb1, x, nb1] }); } }
  M.rooms.push([0, 0, W0 - 1, g.yA - 4, town ? 'Сады за домами' : 'Огороды']);
  // the green (the market square in towns)
  const gy0 = g.gr[0], gy1 = g.gr[1];
  if (!town) { for (let y = gy0; y <= gy1; y++) for (let x = cx - 6; x <= cx + 6; x++) if (((x - cx + 0.5) / 6) ** 2 + ((y - 19.5) / 2.4) ** 2 <= 1) tfill(L, x, y, x, y, T.DIRT);
    place(L, 'well', {}, cx - 1, 20, { cx: cx * CT, solid: [cx - 1, 19, cx, 20] }); act(L, 'v_well', cx, 21, 'Колодец', { x: cx * CT, y: 21 * CT + 6, r: 26 });
    spot(L, 'v_well0', cx - 2, 20, 'right'); spot(L, 'v_well1', cx + 1, 20, 'left'); spot(L, 'v_well2', cx - 1, 21, 'up'); spot(L, 'v_well3', cx, 18, 'down');
    place(L, 'lotsign', {}, cx + 4, 18, { solid: [cx + 4, 18, cx + 4, 18] }); act(L, 'v_board', cx + 4, 19, 'Доска у колодца', { r: 24 });
    for (const [bx, by, dir] of [[cx - 8, 18, 'down'], [cx + 6, 21, 'down']]) { place(L, 'bench', {}, bx, by, { solid: [bx, by, bx + 1, by], dx: 1 }); const nm = 'v_bench' + M.benches.length; spot(L, nm, bx, by, dir, { sit: 1, sx: (bx + 1) * CT, sy: by * CT + 8 }); M.benches.push(nm); }
    vTree(L, r, cx - 14, 20, false, occ); vTree(L, r, cx + 14, 18, false, occ);
    place(L, 'cart', {}, 6, 20, { solid: [6, 20, 8, 20] }); place(L, 'hay', {}, W0 - 8, 19, { solid: [W0 - 8, 19, W0 - 8, 19] }); place(L, 'hay', {}, W0 - 7, 20, { solid: [W0 - 7, 20, W0 - 7, 20] });
    place(L, 'washline', {}, cx + 17, 21, { solid: [cx + 17, 21, cx + 18, 21] });
    M.fest = { x: cx + 9, y: 19 }; M.rooms.push([0, gy0, W0 - 1, gy1, 'Луг у колодца']); }
  else { place(L, 'fountain', {}, cx - 2, 20, { cx: cx * CT, anim: 4, fps: 5, solid: [cx - 2, 19, cx + 1, 20] }); act(L, 'v_fount', cx, 21, 'Фонтан', { x: cx * CT, y: 21 * CT + 6, r: 28 });
    spot(L, 'v_crier', cx - 3, 21, 'down'); spot(L, 'v_well0', cx - 3, 20, 'right'); spot(L, 'v_well1', cx + 2, 20, 'left'); spot(L, 'v_well2', cx - 1, 21, 'up'); spot(L, 'v_well3', cx, 18, 'down');
    const ST = [[cx - 15, 18], [cx - 11, 18], [cx - 7, 18], [cx + 5, 18], [cx + 9, 18], [cx + 13, 18], [cx - 17, 22], [cx - 13, 22], [cx + 11, 22], [cx + 15, 22]];
    ST.forEach(([x, y], i) => { const ramp = ['red', 'blue', 'green', 'gold', 'teal', 'orange', 'wine', 'navy', 'red', 'green'][i]; place(L, 'stall', { ramp, ck: 'vst' + ramp }, x, y, { solid: [x, y, x + 1, y] });
      spot(L, 'v_st' + i, x + 1, y - 1, 'down'); act(L, 'v_stall' + i, x + 1, y + 1, 'Лоток', { r: 22 }); M.stalls.push({ i, x, y, ramp }); });
    for (const [bx, by] of [[cx - 5, 22], [cx + 4, 22]]) { place(L, 'bench', {}, bx, by, { solid: [bx, by, bx + 1, by], dx: 1 }); const nm = 'v_bench' + M.benches.length; spot(L, nm, bx, by, 'down', { sit: 1, sx: (bx + 1) * CT, sy: by * CT + 8 }); M.benches.push(nm); }
    for (const [lx, ly] of [[cx - 19, 17], [cx + 18, 17], [cx - 19, 23], [cx + 18, 23], [cx - 1, 23]]) place(L, 'lamppost', { lit: 1, ck: 'lit' }, lx, ly, { dx: 2, solid: [lx, ly, lx, ly], light: LAMPL });
    spot(L, 'v_sq0', cx - 21, 20, 'right'); spot(L, 'v_sq1', cx + 20, 20, 'left'); M.fest = { x: cx + 6, y: 21 }; M.rooms.push([2, gy0, W0 - 3, gy1, 'Рыночная площадь']); }
  M.rooms.unshift([0, g.st[0] - 1, W0 - 1, g.st[1], town ? 'Главная улица' : 'Улица']); M.rooms.push([0, g.ln[0] - 1, W0 - 1, g.ln[1], 'Задняя улица']);
  spot(L, 'v_meet', 6, (g.st[0] + g.st[1]) >> 1, 'left'); spot(L, 'v_festb', M.fest.x + 2, M.fest.y, 'left');
  place(L, 'campfire', {}, M.fest.x, M.fest.y, { anim: 4, fps: 6, show: () => typeof folkFestOn === 'function' && folkFestOn(), light: { r: 60, col: '#ff9030', a: 0.9, fl: 0.25, dy: -4, show: () => typeof folkFestOn === 'function' && folkFestOn() } });
  // the south band: the pasture, the pond (or the shore), the mill, the fields — or, in towns, gardens, an orchard and the stable yard
  const sb = g.sb, coast = env.coast, wy0 = coast ? H0 - (town ? 6 : 5) : H0, sy1 = coast ? wy0 - 3 : H0 - 3;
  if (coast) { tfill(L, 0, wy0 - 2, W0 - 1, wy0 - 1, T.SAND); tfill(L, 0, wy0, W0 - 1, H0 - 1, T.WATER); sfill(L, 0, wy0, W0 - 1, H0 - 1);
    if (town) { sfill(L, 0, wy0 - 2, 1, wy0 - 1); sfill(L, W0 - 2, wy0 - 2, W0 - 1, wy0 - 1); }
    for (const px of [cx - 1, cx + 12]) { tfill(L, px, wy0 - 1, px + 1, H0 - 2, T.WOOD); sfill(L, px, wy0, px + 1, H0 - 2, 0); }
    place(L, 'boat', {}, cx - 6, wy0 + 2, { dx: 4 }); place(L, 'boat', {}, cx + 4, wy0 + 3, { dx: 2 }); place(L, 'nets', {}, cx - 10, wy0 - 1, { solid: [cx - 10, wy0 - 1, cx - 9, wy0 - 1] }); place(L, 'nets', {}, cx + 7, wy0 - 1, { solid: [cx + 7, wy0 - 1, cx + 8, wy0 - 1] });
    spot(L, 'v_fish0', cx - 1, H0 - 2, 'down'); spot(L, 'v_fish1', cx + 13, H0 - 2, 'down'); spot(L, 'v_fish2', cx - 7, wy0 - 1, 'down'); M.shore = [2, wy0 - 2, W0 - 3, wy0 - 1]; M.rooms.push([0, wy0 - 2, W0 - 1, H0 - 1, town ? 'Гавань' : 'Берег']); }
  if (!town) { // pasture
    const px0 = 3, px1 = 18, py0 = sb + 1, py1 = Math.min(sy1, sb + 9);
    place(L, 'fence', { n: 7, ck: 'vf7' }, px0, py0, { solid: [px0, py0, px0 + 6, py0] }); place(L, 'fence', { n: px1 - px0 - 8, ck: 'vf' + (px1 - px0 - 8) }, px0 + 9, py0, { solid: [px0 + 9, py0, px1 - 1, py0] });
    place(L, 'fence', { n: px1 - px0, ck: 'vf' + (px1 - px0) }, px0, py1, { solid: [px0, py1, px1 - 1, py1] });
    place(L, 'fence', { n: py1 - py0, v: 1, ck: 'vv' + (py1 - py0) }, px0, py1, { solid: [px0, py0, px0, py1] }); place(L, 'fence', { n: py1 - py0, v: 1, ck: 'vv' + (py1 - py0) }, px1, py1, { dx: 12, solid: [px1, py0, px1, py1] });
    place(L, 'trough', {}, px0 + 2, py0 + 2, { solid: [px0 + 2, py0 + 2, px0 + 3, py0 + 2] }); M.pasture = [px0 + 1, py0 + 1, px1 - 1, py1 - 1]; M.rooms.push([px0, py0, px1, py1, 'Выгон']); spot(L, 'v_shep', px0 + 8, py0 + 2, 'down');
    // the pond
    if (!coast) { const pcx = cx - 2, pcy = sb + 6; for (let y = pcy - 4; y <= pcy + 4; y++) for (let x = pcx - 8; x <= pcx + 8; x++) { const d = ((x - pcx) / 6.5) ** 2 + ((y - pcy) / 3.2) ** 2; if (d <= 1) { tfill(L, x, y, x, y, T.WATER); sfill(L, x, y, x, y); } else if (d <= 1.6) tfill(L, x, y, x, y, T.SAND); }
      for (const [x, y] of [[pcx - 7, pcy - 1], [pcx + 6, pcy + 2], [pcx - 4, pcy + 3], [pcx + 3, pcy - 3]]) if (!L.solid[y * W0 + x]) { place(L, 'bush', { seed: x + y, ck: 'vrd' + ((x + y) % 3) }, x, y, { dx: -4, solid: [x, y, x, y] }); occ[y * W0 + x] = 1; }
      spot(L, 'v_fish0', pcx - 7, pcy + 1, 'right'); spot(L, 'v_fish1', pcx + 7, pcy - 1, 'left'); M.pond = [pcx - 9, pcy - 4, pcx + 9, pcy + 4]; M.rooms.push([pcx - 8, pcy - 4, pcx + 8, pcy + 4, 'Пруд']); }
    // the mill and the fields
    const fx0 = W0 - 19, fx1 = W0 - 4, fy0 = sb + 1, fy1 = Math.min(sy1, sb + 8), cropS = cs, cropK = env.south && r.f() < 0.5 ? 'vine' : 'wheat';
    if (r.f() < 0.8) { const mx = fx0 - 5; place(L, 'mill', {}, mx, fy0 + 4, { solid: [mx, fy0 + 3, mx + 2, fy0 + 4], anim: 4, fps: 4 }); spot(L, 'v_miller', mx + 1, fy0 + 5, 'up'); M.mill = { x: mx + 1, y: fy0 + 5 }; }
    tfill(L, fx0, fy0, fx1, fy1, T.SOIL); tfill(L, fx0 + 8, fy0, fx0 + 8, fy1, T.DIRT);
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) { if (x === fx0 + 8) continue; if (cropK === 'vine' && x > fx0 + 8) { if ((y - fy0) % 2 === 0) place(L, 'vine', { s: cropS, seed: x, ck: 'vvn' + cropS + (x % 3) }, x, y, { solid: [x, y, x, y] }); continue; }
      place(L, 'crops', { s: cropS, k: 'wheat', seed: x * 3 + y, ck: 'vcw' + cropS + ((x + y) % 3) }, x, y, { bake: 1 }); if (cropS === 2 && (x * 7 + y * 3) % 11 === 0) place(L, 'sheaf', {}, x, y, { solid: [x, y, x, y] }); }
    if (cropS < 3) place(L, 'scarecrow', {}, fx0 + 3, fy0 + 3, { solid: [fx0 + 3, fy0 + 3, fx0 + 3, fy0 + 3] });
    M.fields = [[fx0, fy0, fx0 + 7, fy1], [fx0 + 9, fy0, fx1, fy1]]; M.rooms.push([fx0, fy0, fx1, fy1, 'Поля']); }
  else { // town: gardens, an orchard, the stable yard
    const gy = sb + 1; tfill(L, 3, gy, 20, gy + 3, T.SOIL); for (let x = 3; x <= 20; x++) for (let y = gy; y <= gy + 3; y++) place(L, 'crops', { s: cs, k: 'cabbage', seed: x + y, ck: 'vcc' + cs + ((x + y) % 3) }, x, y, { bake: 1 }); M.gardens.push([3, gy, 20, gy + 3, -1]);
    for (let x = 25; x <= 44; x += 3) for (let y = gy; y <= sy1 - 1; y += 3) { place(L, 'fruit', { seed: x * 3 + y, ck: 'vfr' + ((x + y) % 4) }, x, y, { cx: x * CT + 8, solid: [x, y, x, y], shadow: [14, 5] }); occ[y * W0 + x] = 1; }
    const sx = W0 - 20; tfill(L, sx, gy, W0 - 4, gy + 5, T.DIRT); place(L, 'cart', {}, sx + 1, gy + 1, { solid: [sx + 1, gy + 1, sx + 3, gy + 1] }); place(L, 'hay', {}, sx + 6, gy, { solid: [sx + 6, gy, sx + 6, gy] }); place(L, 'hay', {}, sx + 7, gy + 1, { solid: [sx + 7, gy + 1, sx + 7, gy + 1] });
    place(L, 'trough', {}, sx + 10, gy + 3, { solid: [sx + 10, gy + 3, sx + 11, gy + 3] }); M.yard = [sx, gy, W0 - 4, gy + 5]; M.rooms.push([3, gy, 20, gy + 3, 'Огороды'], [24, gy, 46, sy1, 'Сад'], [sx, gy, W0 - 4, gy + 5, 'Конный двор']); }
  // the edges: woods round a village, a few trees inside the walls of a town
  if (!town) { const dense = env.forest ? 0.85 : env.steppe ? 0.35 : 0.65, pineK = env.snow || env.cul === 'C' ? 0.7 : env.forest ? 0.35 : 0.12;
    for (let x = 0; x < W0; x++) for (const y of [0, 1].concat(coast ? [] : [H0 - 2, H0 - 1])) if (r.f() < dense) vTree(L, r, x, y, r.f() < pineK, occ);
    for (let y = 2; y < H0 - 2; y++) for (const x of [0, 1, W0 - 2, W0 - 1]) { if (x < 2 && y >= g.st[0] - 1 && y <= g.gr[0] + 3) continue; if (coast && y >= wy0 - 2) continue; if (r.f() < dense) vTree(L, r, x, y, r.f() < pineK, occ); }
    for (let k = 0; k < 70; k++) { const x = r.i(2, W0 - 3), y = r.i(sb + 1, (coast ? wy0 - 3 : H0 - 3)), i = y * W0 + x; if (L.solid[i] || occ[i] || L.ter[i] !== T.GRASS) continue;
      if (M.pasture && x >= M.pasture[0] - 1 && x <= M.pasture[2] + 1 && y >= M.pasture[1] - 1 && y <= M.pasture[3] + 1) continue; const p = r.f();
      if (p < 0.3) vTree(L, r, x, y, r.f() < pineK, occ); else if (p < 0.55) { place(L, 'bush', { seed: k, flower: r.f() < 0.3 ? 1 : 0, ck: 'vbu' + (k % 4) }, x, y, { dx: -4, solid: [x, y, x, y] }); occ[i] = 1; } else if (p < 0.7 && env.hill) { place(L, 'rock', { seed: k % 4 + 1, ck: 'rk' + (k % 4) }, x, y, { dx: -3, solid: [x, y, x, y] }); occ[i] = 1; } else place(L, 'flowers', { n: 1, seed: k, ck: 'fl' + (k % 3) }, x, y, { bake: 1 }); }
    if (env.hill) { place(L, 'mine', {}, W0 - 9, 6, { solid: [W0 - 9, 4, W0 - 7, 6] }); } }
  // the way out: the king's men wait at the west end of the street
  act(L, 'v_exit', 1, (g.st[0] + g.st[1]) >> 1, town ? 'Городские ворота: к войску' : 'Околица: к войску', { r: 26 }); spot(L, 'v_arrive', 3, (g.st[0] + g.st[1]) >> 1, 'right');
  spot(L, 'v_grd0', 2, g.st[0] - 1, 'down'); spot(L, 'v_grd1', 2, g.st[1] + 1, 'up'); M.horses = town ? [2, g.gr[0] + 1, 4, g.gr[0] + 3] : [1, g.gr[0] + 1, 3, g.gr[0] + 3];
  if (town) { place(L, 'gatepost', { ck: 'gp0' }, 0, g.st[0] - 1, { dx: -1, light: { r: 30, col: '#ffa040', a: 0.8, fl: 0.2, night: 1, dx: 9, dy: 4 } }); place(L, 'gatepost', { flip: 1, ck: 'gp1' }, 0, g.st[1] + 1, { dx: -1, light: { r: 30, col: '#ffa040', a: 0.8, fl: 0.2, night: 1, dx: -11, dy: 4 } });
    spot(L, 'v_gate0', 3, g.st[0] - 1, 'down'); spot(L, 'v_gate1', 3, g.st[1] + 1, 'up'); }
  M.green = town ? [4, gy0, W0 - 5, gy1] : [4, gy0, W0 - 5, gy1]; L.rooms = M.rooms;
  // the inside places
  const Ls = [L, vTavern(M, s, r), vRoom(M)]; if (M.head) Ls.push(vHead(M, s, r)); if (M.hall) Ls.push(vHall(M, s, r));
  const tv = M.tav; door(L, tv.door, tv.y + 1, tv.door + 1, tv.y + 1, 'v_tav', Ls[1].w * 8, (Ls[1].h - 3) * CT + 10, 'up', { label: 'В ' + (town ? 'таверну' : 'корчму') });
  if (M.head) { const H = M.head; door(L, H.door, H.y + 1, H.door, H.y + 1, 'v_head', LOCS.v_head.w * 8, (LOCS.v_head.h - 3) * CT + 10, 'up', { label: 'В избу старосты' }); }
  if (M.hall) { const H = M.hall; door(L, H.door, H.y + 1, H.door + 1, H.y + 1, 'v_hall', LOCS.v_hall.w * 8, (LOCS.v_hall.h - 3) * CT + 10, 'up', { label: 'В ратушу' }); }
  for (const id in L.spots) { const sp = L.spots[id]; if (sp.sit || sp.away) continue; const tx = Math.floor(sp.x / CT), ty = Math.floor(sp.y / CT); if (solidAt(L, tx, ty)) { const [nx, ny] = nearFree(L, tx, ty); sp.x = nx * CT + 8; sp.y = ny * CT + 12; } }
  return Ls; }
// ---------- inside: the tavern, the room upstairs, the headman's house, the town hall ----------
const VTAV_N = ['Золотой гусь', 'Пьяный вепрь', 'Три подковы', 'Старый дуб', 'Весёлый мельник', 'Рыжая лиса', 'Сломанное колесо', 'Синий кабан', 'Медный котёл', 'Белая лошадь', 'Хромой петух', 'Королевская кружка', 'У переправы', 'Добрый путник'],
  VTAV_NC = ['Серебряная рыба', 'Морской конёк', 'Якорь', 'Пьяный краб', 'Три сети'];
function vTavName(sid) { const r = vRng(sid, 5), env = vEnv(sid); return r.pick(env.coast && r.f() < 0.6 ? VTAV_NC : VTAV_N); }
function vTavern(M, s, r) { const town = M.town, w = town ? 24 : 20, h = 14, T = GT, nm = (town ? 'Таверна «' : 'Корчма «') + vTavName(M.sid) + '»', dx = (w >> 1) - 1, cw = town ? 6 : 5, tx0 = w - 9, fx = town ? 10 : 8, sx = w - 3;
  const L = mkLoc('v_tav', nm, w, h, 400 + M.sid % 89, false); M.tavName = nm;
  tfill(L, 0, 0, w - 1, h - 1, T.WALL); tfill(L, 1, 3, w - 2, h - 3, T.WOOD); tfill(L, dx, h - 2, dx + 1, h - 1, T.WOOD);
  for (let i = 0; i < w * h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.wains = () => 1; L.beams = []; L.rooms = [[1, 3, cw + 1, 7, 'У стойки'], [0, 0, w - 1, h - 1, nm]]; L.rugs = [[fx - 1, 4, 4, 2, 'wine']];
  door(L, dx, h - 2, dx + 1, h - 1, 'v_out', (M.tav.door + 1) * CT, (M.tav.y + 2) * CT + 12, 'down', { label: 'На улицу' });
  // the north wall: windows, the hearth, a boar's head, sconces
  for (const wx of town ? [14, 17, 20] : [12, 15]) { place(L, 'window', {}, wx, 2, { wall: 1, dy: -2 }); L.beams.push([wx * CT + 8, 3 * CT]); }
  place(L, 'fireplace', {}, fx, 2, { wall: 1, dy: 4, anim: 4, fps: 8, light: { r: 72, col: '#ff9a40', a: 0.9, fl: 0.15, dy: 10 } }); sfill(L, fx, 3, fx + 1, 3);
  place(L, 'trophy', { k: r.f() < 0.5 ? 'boar' : 'deer', ck: 'vtr' + (M.sid % 2) }, fx + 3, 2, { wall: 1, dy: -10, dx: -5 });
  for (const qx of [fx - 2, fx + 5]) place(L, 'sconce', {}, qx, 2, { wall: 1, dy: -6, dx: 3, anim: 3, fps: 7, light: { r: 40, col: '#ffb050', a: 0.7, fl: 0.15 } });
  // the bar: shelves and casks behind, the counter, stools in front
  place(L, 'shelfs', { seed: 7 + M.sid % 5, ck: 'vts' + (M.sid % 5) }, 1, 3, { solid: [1, 3, 2, 3] }); place(L, 'cask', {}, cw - 2, 3, { solid: [cw - 2, 3, cw - 1, 3] });
  place(L, 'counter', { w: cw * 16, ck: 'vc' + cw }, 1, 6, { solid: [1, 5, cw, 6] }); spot(L, 'vt_keep', cw - 2, 4, 'down'); spot(L, 'vt_back', 1, 4, 'left', { away: 1 });
  L.seats = []; const seat = (nm0, x, y, dir, o) => { spot(L, nm0, x, y, dir, Object.assign({ sit: 1 }, o || {})); L.seats.push(nm0); };
  for (let k = 0; k < (town ? 3 : 2); k++) { const x = 2 + k * 2; place(L, 'stool', {}, x, 7, { dx: 2 }); seat('vt_b' + k, x, 7, 'up', { sx: x * CT + 8, sy: 7 * CT + 6 }); }
  lightAt(L, (cw * 16) / 2 + 16, 5 * CT, 34, '#ffc060', 0.5, { fl: 0.1 });
  // two long tables with benches
  for (const [ty, nm0] of [[5, 'a'], [9, 'b']]) { place(L, 'ltable', { w: 96, ck: 'lt96' }, tx0, ty, { solid: [tx0, ty - 1, tx0 + 5, ty] });
    place(L, 'lbench', { w: 96, ck: 'lb96' }, tx0, ty - 2, {}); place(L, 'lbench', { w: 96, ck: 'lb96' }, tx0, ty + 1, {});
    place(L, 'platter', { w: 80, seed: ty + M.sid, ck: 'vpl' + ty }, tx0, ty, { dx: 8, dy: -22, so: 24, show: () => typeof folkTavBusy === 'function' && folkTavBusy() });
    for (let k = 0; k < 3; k++) { const x = tx0 * CT + 16 + k * 32, t = Math.floor(x / CT); seat('vt_' + nm0 + k + 'n', t, ty - 2, 'down', { sx: x, sy: (ty - 2) * CT + 10 }); seat('vt_' + nm0 + k + 's', t, ty + 1, 'up', { sx: x, sy: (ty + 1) * CT + 7 }); }
    lightAt(L, tx0 * CT + 48, ty * CT - 4, 40, '#ffc060', 0.55, { fl: 0.1 }); }
  // round tables with stools; the dice table by the wall
  const rts = town ? [[8, 7], [12, 7]] : [[7, 7]];
  rts.forEach(([x, y], i) => { place(L, 'jtable', { mugs: 1, ck: 'jm' }, x, y, { solid: [x, y, x + 1, y] }); place(L, 'stool', {}, x - 1, y, { dx: 2 }); place(L, 'stool', {}, x + 2, y, { dx: 2 });
    seat('vt_r' + i + 'w', x - 1, y, 'right', { sx: (x - 1) * CT + 8, sy: y * CT + 8 }); seat('vt_r' + i + 'e', x + 2, y, 'left', { sx: (x + 2) * CT + 8, sy: y * CT + 8 }); lightAt(L, (x + 1) * CT, y * CT, 30, '#ffc060', 0.5, { fl: 0.1 }); });
  place(L, 'ttable', {}, 4, 10, { dx: 2, solid: [4, 10, 5, 10] }); place(L, 'stool', {}, 3, 10, { dx: 2 }); place(L, 'stool', {}, 6, 10, { dx: 2 });
  seat('vt_d0', 3, 10, 'right', { sx: 3 * CT + 8, sy: 10 * CT + 8 }); seat('vt_d1', 6, 10, 'left', { sx: 6 * CT + 8, sy: 10 * CT + 8 });
  act(L, 'v_dice', 5, 11, 'Кости', { x: 5 * CT, y: 11 * CT + 4, r: 24 }); lightAt(L, 5 * CT, 10 * CT, 30, '#ffc060', 0.5, { fl: 0.1 });
  // the stairs to the rooms upstairs, a few casks
  place(L, 'stairs', {}, sx, 10, { solid: [sx, 8, sx + 1, 8] }); door(L, sx, 9, sx + 1, 10, 'v_room', 5 * CT, 6 * CT + 10, 'up', { label: 'Наверх, в комнаты' });
  place(L, 'barrel', {}, w - 2, 3, { solid: [w - 2, 3, w - 2, 3] }); place(L, 'barrel', {}, w - 3, 3, { dx: 1, solid: [w - 3, 3, w - 3, 3] }); place(L, 'crate', {}, 1, h - 3, { solid: [1, h - 3, 1, h - 3] });
  place(L, 'plant', {}, w - 2, h - 3, { solid: [w - 2, h - 3, w - 2, h - 3] });
  spot(L, 'vt_bard', fx + 2, 4, 'down'); spot(L, 'vt_stand0', w - 3, 5, 'left'); spot(L, 'vt_stand1', cw + 1, 9, 'up'); spot(L, 'vt_in', dx + 1, h - 3, 'up'); spot(L, 'vt_fire', fx, 4, 'up');
  M.seats = L.seats.slice(); M.tavW = w; return L; }
function vRoom(M) { const w = 10, h = 9, T = GT, L = mkLoc('v_room', 'Комната наверху', w, h, 401, false), sx = M.tavW - 3;
  tfill(L, 0, 0, w - 1, h - 1, T.WALL); tfill(L, 1, 3, w - 2, h - 3, T.WOOD); tfill(L, 4, h - 2, 5, h - 1, T.WOOD);
  for (let i = 0; i < w * h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.wains = () => 1; L.beams = []; L.rooms = [[0, 0, w - 1, h - 1, 'Комната наверху']]; L.rugs = [[3, 4, 3, 2, 'green']];
  door(L, 4, h - 2, 5, h - 1, 'v_tav', (sx + 1) * CT, 11 * CT + 10, 'down', { label: 'Вниз, в ' + (M.town ? 'таверну' : 'корчму') });
  place(L, 'bed', { ramp: 'brown', ck: 'bedbr' }, 1, 5, { dy: 2, solid: [1, 3, 2, 5] }); spot(L, 'vr_bed', 1, 4, 'down', { sx: 2 * CT, sy: 4 * CT + 4, lie: 1 });
  act(L, 'v_bed', 3, 4, 'Лечь спать', { r: 28 }); place(L, 'window', {}, 5, 2, { wall: 1, dy: -2 }); L.beams.push([5 * CT + 8, 3 * CT]);
  place(L, 'chest', {}, 8, 3, { solid: [8, 3, 8, 3] }); place(L, 'ttable', {}, 7, 5, { dx: 2, solid: [7, 5, 8, 5] }); place(L, 'stool', {}, 6, 5, { dx: 2 });
  lightAt(L, 8 * CT, 5 * CT, 34, '#ffc060', 0.6, { fl: 0.1 }); return L; }
function vHead(M, s, r) { const w = 14, h = 10, T = GT, L = mkLoc('v_head', 'Изба старосты', w, h, 402 + M.sid % 7, false), dx = (w >> 1) - 1;
  tfill(L, 0, 0, w - 1, h - 1, T.WALL); tfill(L, 1, 3, w - 2, h - 3, T.WOOD); tfill(L, dx, h - 2, dx + 1, h - 1, T.WOOD);
  for (let i = 0; i < w * h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.wains = () => 1; L.beams = []; L.rooms = [[0, 0, w - 1, h - 1, 'Изба старосты']]; L.rugs = [[4, 4, 5, 3, r.pick(['wine', 'green', 'navy'])]];
  const H = M.head; door(L, dx, h - 2, dx + 1, h - 1, 'v_out', H.door * CT + 8, (H.y + 2) * CT + 12, 'down', { label: 'На улицу' });
  place(L, 'fireplace', {}, 2, 2, { wall: 1, dy: 4, anim: 4, fps: 8, light: { r: 60, col: '#ff9a40', a: 0.9, fl: 0.15, dy: 10 } }); sfill(L, 2, 3, 3, 3);
  for (const wx of [6, 9]) { place(L, 'window', {}, wx, 2, { wall: 1, dy: -2 }); L.beams.push([wx * CT + 8, 3 * CT]); }
  place(L, 'cot', { ramp: 'brown', ck: 'cotb' }, 11, 4, { solid: [11, 3, 11, 4] }); spot(L, 'vhd_bed', 11, 4, 'down', { sx: 11 * CT + 9, sy: 5 * CT - 8, lie: 1 });
  place(L, 'cot', { ramp: 'wine', ck: 'cotw' }, 12, 4, { solid: [12, 3, 12, 4] }); spot(L, 'vhd_bed2', 12, 4, 'down', { sx: 12 * CT + 9, sy: 5 * CT - 8, lie: 1 });
  place(L, 'chest', {}, 12, 6, { solid: [12, 6, 12, 6] }); place(L, 'shelfs', { seed: 3, ck: 'vhs' }, 7, 3, { solid: [7, 3, 8, 3] });
  place(L, 'loom', {}, 1, 7, { solid: [1, 7, 2, 7] }); place(L, 'sack', {}, 4, 3, { solid: [4, 3, 4, 3] }); place(L, 'barrel', {}, 5, 3, { solid: [5, 3, 5, 3] });
  place(L, 'jtable', { mugs: 1, ck: 'jm' }, 6, 6, { solid: [6, 6, 7, 6] }); place(L, 'chair', { dir: 'left', ck: 'l' }, 8, 6, { so: -2 }); spot(L, 'vhd_seat', 8, 6, 'left', { sit: 1, sx: 8 * CT + 9, sy: 6 * CT + 9 });
  place(L, 'stool', {}, 5, 6, { dx: 2 }); spot(L, 'vhd_guest', 5, 6, 'right', { sit: 1, sx: 5 * CT + 8, sy: 6 * CT + 8 }); lightAt(L, 7 * CT, 6 * CT - 4, 30, '#ffc060', 0.55, { fl: 0.1 });
  spot(L, 'vhd_wife', 3, 7, 'left'); spot(L, 'vhd_cook', 3, 4, 'up'); spot(L, 'vhd_in', dx, h - 3, 'up');
  return L; }
function vHall(M, s, r) { const w = 22, h = 14, T = GT, S = G.setts[M.sid], L = mkLoc('v_hall', 'Ратуша', w, h, 403 + M.sid % 7, false), dx = (w >> 1) - 1, rl = S ? S.ctrl : 5;
  tfill(L, 0, 0, w - 1, h - 1, T.WALL); tfill(L, 1, 3, w - 2, h - 3, T.FLAG); tfill(L, 7, 3, 14, 5, T.DAIS); tfill(L, dx, h - 2, dx + 1, h - 1, T.FLAG);
  for (let i = 0; i < w * h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.wains = () => 1; L.beams = []; L.rooms = [[7, 3, 14, 5, 'Кресло бургомистра'], [0, 0, w - 1, h - 1, 'Ратуша']]; L.carpets = [[dx, 6, 2, 6, 'red', 'gold']];
  const H = M.hall; door(L, dx, h - 2, dx + 1, h - 1, 'v_out', (H.door + 1) * CT, (H.y + 2) * CT + 12, 'down', { label: 'На площадь' });
  for (const bx of [1, 3, 17, 19]) place(L, 'bookshelf', { seed: bx * 5 + M.sid, fill: 0.8, ck: 'vhb' + bx }, bx, 3, { solid: [bx, 3, bx + 1, 3] });
  for (const wx of [6, 15]) { place(L, 'window', {}, wx, 2, { wall: 1, dy: -2 }); L.beams.push([wx * CT + 8, 3 * CT]); }
  for (const bx of [8, 13]) place(L, 'banner', { realm: rl, ck: 'r' + rl }, bx, 2, { wall: 1, dy: -1, anim: 4, fps: 3 });
  place(L, 'tapestry', { ramp: REALM_RAMP[rl] || 'navy', ck: 'vt' + rl }, dx, 2, { wall: 1, dy: -2, dx: 8 });
  place(L, 'desk', { candle: 1, ck: 'c' }, dx, 5, { dx: 8, solid: [dx, 5, dx + 1, 5], light: { r: 34, col: '#ffc060', a: 0.6, fl: 0.1, dx: 12, dy: -10 } });
  place(L, 'chair', { dir: 'down', ramp: 'navy', ck: 'dn' }, dx, 4, { so: -3, dx: 8 }); spot(L, 'vtl_burg', dx, 4, 'down', { sit: 1, sx: (dx + 1) * CT, sy: 4 * CT + 9 });
  // the council table
  place(L, 'ltable', { w: 112, ck: 'lt112' }, 7, 9, { dx: 0, solid: [7, 8, 13, 9] }); place(L, 'lbench', { w: 112, ck: 'lb112' }, 7, 7, {}); place(L, 'lbench', { w: 112, ck: 'lb112' }, 7, 10, {});
  L.seats = []; for (let k = 0; k < 3; k++) { const x = 7 * CT + 24 + k * 32, t = Math.floor(x / CT); spot(L, 'vtl_s' + k + 'n', t, 7, 'down', { sit: 1, sx: x, sy: 7 * CT + 10 }); spot(L, 'vtl_s' + k + 's', t, 10, 'up', { sit: 1, sx: x, sy: 10 * CT + 7 }); L.seats.push('vtl_s' + k + 'n', 'vtl_s' + k + 's'); }
  // clerks' desks
  for (const [x, nm0] of [[2, 'vtl_clerk0'], [17, 'vtl_clerk1']]) { place(L, 'desk', { candle: 1, ck: 'c' }, x, 8, { solid: [x, 8, x + 1, 8], light: { r: 30, col: '#ffc060', a: 0.55, fl: 0.1, dx: 12, dy: -10 } });
    place(L, 'chair', { dir: 'up', ck: 'u' }, x + 1, 9, { so: 6, dx: -8 }); spot(L, nm0, x, 9, 'up', { sit: 1, sx: (x + 1) * CT, sy: 9 * CT + 6 }); }
  candle(L, 6, 4); candle(L, 15, 4); place(L, 'chest', {}, 19, 10, { solid: [19, 10, 19, 10] }); place(L, 'lectern', {}, 16, 6, { solid: [16, 6, 16, 6] });
  place(L, 'plant', {}, 1, h - 3, { solid: [1, h - 3, 1, h - 3] }); place(L, 'plant', {}, w - 2, h - 3, { solid: [w - 2, h - 3, w - 2, h - 3] });
  act(L, 'v_books', 4, 4, 'Городские книги', { r: 26 });
  spot(L, 'vtl_grd0', dx - 1, h - 3, 'up'); spot(L, 'vtl_grd1', dx + 2, h - 3, 'up'); spot(L, 'vtl_in', dx, h - 3, 'up'); spot(L, 'vtl_front', dx, 7, 'up');
  return L; }
