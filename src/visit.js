'use strict';
// ===== CASTLES (v3.3): the king visits the castles of his vassals, of foreign lords and the courts of foreign rulers =====
// The yard (the keep, the stable and the paddock, the granary, the kitchen, the smithy, the barracks, the training ground,
// a herb garden, an orchard or the kennels on one side, a garden, a chapel or an orchard on the other), the great hall
// (the high table on the dais, two long tables, the steward's desk, the stairs) and the guest chamber upstairs.
// Everything comes from the settlement id and the world seed: a castle looks the same on every visit and after loading a save.
let KMAP = null; // the layout of the castle being visited
const KCARP = { K: ['navy', 'gold'], C: ['red', 'gold'], R: ['wine', 'gold'], T: ['purple', 'gold'], E: ['wine', 'gold'], F: ['forest', 'gold'] };
function kHouseOf(sid) { const S = G.setts[sid]; if (!S || S.ctrl !== G.player.realm || !G.houses) return null;
  const H0 = S.house >= 0 ? G.houses[S.house] : null; if (H0 && H0.alive && H0.fief === sid) return H0;
  const c = S.lord >= 0 ? charOf(S.lord) : null; return c && c.alive && c.house >= 0 && G.houses[c.house] && G.houses[c.house].alive ? G.houses[c.house] : null; }
function kBuild(sid) { const s = WD.setts[sid], S = G.setts[sid], rl = S.ctrl, cap = s.type === 'capital', env = vEnv(sid), r = vRng(sid, 31), T = GT, key = REALM_DEF[rl].key;
  const kw = cap ? 26 : r.pick([20, 22, 24]), kx = 25 - (kw >> 1), H = kHouseOf(sid), sty = VSTY_T[env.cul] || VSTY_T.K;
  const ne = key === 'T' ? 'chapel' : cap ? 'garden' : r.pick(['garden', 'chapel', 'orchard', 'chapel']), nw = r.pick(ne === 'orchard' ? ['herbs', 'kennel'] : ['herbs', 'orchard', 'kennel']);
  const M = KMAP = { sid, rl, cap, env, key, r, kw, kx, H, ne, nw, carp: KCARP[key] || KCARP.K, rooms: [] };
  const L = mkLoc('k_yard', 'Двор замка', 50, 44, 500 + sid % 97, true);
  tfill(L, 0, 0, 49, 43, T.GRASS);
  tfill(L, 0, 0, kx - 1, 3, T.CWALL); tfill(L, kx + kw, 0, 49, 3, T.CWALL); tfill(L, 0, 0, 1, 39, T.CWALL); tfill(L, 48, 0, 49, 39, T.CWALL); tfill(L, 0, 36, 49, 39, T.CWALL);
  tfill(L, kx, 0, kx + kw - 1, 9, T.VOID);
  // roads & grounds
  tfill(L, 23, 10, 26, 35, T.COBBLE); tfill(L, 19, 17, 30, 24, T.COBBLE); tfill(L, 24, 36, 25, 39, T.COBBLE); tfill(L, 23, 40, 26, 43, T.DIRT); tfill(L, 22, 41, 27, 43, T.DIRT);
  tfill(L, 3, 34, 46, 35, T.DIRT); tfill(L, 9, 20, 22, 20, T.DIRT); tfill(L, 31, 25, 37, 25, T.DIRT); tfill(L, 37, 16, 38, 25, T.DIRT);
  tfill(L, 38, 17, 46, 24, T.SAND); tfill(L, 2, 22, 9, 25, T.DIRT); tfill(L, kx, 10, kx + kw - 1, 11, T.COBBLE);
  for (let i = 0; i < L.w * L.h; i++) if (L.ter[i] === T.CWALL || L.ter[i] === T.VOID) L.solid[i] = 1;
  sfill(L, 24, 36, 25, 39, 0);
  // the keep (its banners fly the colours of the realm, or of the vassal's house) and the door
  L.keep = { x: kx * CT, y: 0, w: kw }; L.keepRealm = rl; if (H) L.keepHB = { house: H.her, ck: 'hb' + H.id };
  door(L, 24, 10, 25, 10, 'k_hall', 15 * CT, 16 * CT + 10, 'up', { label: cap ? 'Во дворец' : 'В замок' });
  const po = H ? { house: H.her, ramp: H.her.ramp, ck: 'kph' + H.id } : { realm: rl, ck: 'r' + rl };
  place(L, 'pole', po, 21, 10, { anim: 4, fps: 3, solid: [21, 10, 21, 10], dx: 6 }); place(L, 'pole', po, 28, 10, { anim: 4, fps: 3, solid: [28, 10, 28, 10], dx: 6 });
  // towers & the gatehouse; the king's men wait inside the gate
  const ro = { realm: rl, ck: 'r' + rl }; place(L, 'tower', ro, 0, 39, { cx: 2 * CT, solid: [0, 34, 3, 39] }); place(L, 'tower', ro, 46, 39, { cx: 48 * CT, solid: [46, 34, 49, 39] });
  place(L, 'gatehouse', ro, 19, 39, { anim: 2, fps: 2, solid: [19, 34, 23, 35], light: null, winLight: false }); sfill(L, 26, 34, 30, 35);
  lightAt(L, 23 * CT + 2, 35 * CT, 44, '#ffa040', 0.8, { fl: 0.15, night: 1 }); lightAt(L, 26 * CT + 14, 35 * CT, 44, '#ffa040', 0.8, { fl: 0.15, night: 1 });
  spot(L, 'k_gate0', 23, 33, 'down'); spot(L, 'k_gate1', 26, 33, 'down'); spot(L, 'k_arrive', 25, 31, 'up'); spot(L, 'k_ret0', 22, 32, 'right'); spot(L, 'k_ret1', 27, 32, 'left');
  act(L, 'k_exit', 24, 41, 'Ворота: к войску', { x: 25 * CT, y: 41 * CT + 8, r: 34 }); M.horses = [21, 41, 28, 42];
  // the stable and the paddock
  const st = r.pick(sty), wl = st[0] === 'stone' ? 'timber' : st[0];
  place(L, 'bld', { w: 7, fh: 42, rh: 38, wall: wl, roof: st[1], kind: 'stable', stalls: 3, seed: 4 + sid % 9, ck: 'kb' + sid + '_st' }, 2, 19, { dx: -2, solid: [2, 17, 8, 19] });
  place(L, 'hay', {}, 9, 19, { solid: [9, 19, 9, 19], dx: 2 }); place(L, 'hay', {}, 10, 18, { solid: [10, 18, 10, 18] });
  place(L, 'fence', { n: 5, ck: 5 }, 2, 21, { solid: [2, 21, 6, 21] }); place(L, 'fence', { n: 2, ck: 2 }, 8, 21, { solid: [8, 21, 9, 21] }); place(L, 'gate', { ck: 'g1' }, 7, 21, { dy: 2, fr: gateFr });
  place(L, 'fence', { n: 8, ck: 8 }, 2, 26, { solid: [2, 26, 9, 26] }); place(L, 'fence', { n: 5, v: 1, ck: 'v5' }, 10, 26, { dx: 5, solid: [10, 21, 10, 26] });
  place(L, 'trough', {}, 3, 22, { solid: [3, 22, 4, 22] }); M.paddock = [3, 23, 9, 25];
  act(L, 'k_stable', 5, 20, 'Конюшня', { r: 30 }); spot(L, 'k_stable', 6, 20, 'up');
  // the north-west corner: herbs and a dovecote, an orchard or the kennels
  if (nw === 'herbs') { tfill(L, 3, 8, 7, 11, T.SOIL); place(L, 'dovecote', {}, 9, 7, { cx: 10 * CT, solid: [9, 6, 10, 7] }); act(L, 'k_dove', 10, 8, 'Голубятня', { r: 26 });
    for (let x = 3; x <= 7; x++) for (const y of [8, 10]) place(L, 'herbs', { seed: x * 3 + y, ck: 'h' + ((x + y) % 4) }, x, y, { bake: 1 });
    spot(L, 'k_herbs', 5, 12, 'up'); M.rooms.push([2, 4, kx - 1, 15, 'Травяной садик']); }
  else if (nw === 'orchard') { for (let x = 3; x <= kx - 3; x += 3) for (const y of [6, 9, 12]) place(L, 'fruit', { seed: x * 3 + y + sid, ck: 'vfr' + ((x + y) % 4) }, x, y, { cx: x * CT + 8, solid: [x, y, x, y], shadow: [14, 5] });
    place(L, 'beehive', {}, 2, 14, { solid: [2, 14, 2, 14] }); place(L, 'beehive', {}, 3, 14, { solid: [3, 14, 3, 14] }); spot(L, 'k_herbs', 5, 14, 'up'); M.rooms.push([2, 4, kx - 1, 15, 'Яблоневый сад']); }
  else { place(L, 'bld', { w: 5, fh: 38, rh: 34, wall: 'plank', roof: st[1] === 'tile' ? 'tile' : 'shake', doors: [[28, 14, 20, 1]], wins: [[6, 10]], seed: 13, sign: [56, 'dog'], ck: 'kb' + sid + '_ke' }, 3, 9, { dx: -2, solid: [3, 7, 7, 9] });
    act(L, 'k_kennel', 5, 10, 'Псарня', { r: 28 }); place(L, 'woodpile', {}, 9, 9, { solid: [9, 9, 10, 9] }); M.kennel = [2, 11, 10, 14]; spot(L, 'k_herbs', 8, 12, 'left'); M.rooms.push([2, 4, kx - 1, 15, 'Псарня']); }
  // the north-east corner: a garden with a fountain, the chapel with its graves, or an orchard
  if (ne === 'garden') { tfill(L, 42, 4, 43, 15, T.SAND); tfill(L, 38, 9, 47, 10, T.SAND);
    place(L, 'hedge', { n: 4, ck: 'h4' }, 38, 15, { solid: [38, 15, 41, 15] }); place(L, 'hedge', { n: 4, seed: 2, ck: 'h4b' }, 44, 15, { solid: [44, 15, 47, 15] });
    place(L, 'fountain', {}, 42, 10, { cx: 43 * CT, anim: 4, fps: 5, solid: [41, 9, 44, 10] }); act(L, 'k_fount', 43, 11, 'Фонтан', { r: 30 });
    [[39, 6], [45, 6], [39, 13], [45, 13]].forEach(([bx, by], i) => { place(L, 'bench', {}, bx, by, { solid: [bx, by, bx + 1, by], dx: 1 }); spot(L, 'k_gb' + i, bx, by, 'down', { sit: 1, sx: (bx + 1) * CT, sy: by * CT + 8 }); });
    place(L, 'fruit', { seed: 3, ck: 'f3' }, 40, 4, { cx: 40.5 * CT, solid: [40, 4, 40, 4], shadow: [14, 5] }); place(L, 'fruit', { seed: 8, fruit: 'gold', ck: 'f8' }, 46, 4, { cx: 46 * CT, solid: [45, 4, 46, 4], shadow: [14, 5] });
    for (const by of [5, 12]) place(L, 'bush', { seed: by, flower: by === 12 ? 1 : 0, ck: 'bu' + by }, 38, by, { dx: 2, solid: [38, by, 38, by] });
    for (const [fx, fy] of [[38, 14], [39, 14], [46, 14], [47, 14]]) place(L, 'flowers', { n: 1, seed: fx, ck: 'fl' + (fx % 3) }, fx, fy, { bake: 1 });
    spot(L, 'k_garden', 43, 14, 'up'); M.rooms.push([kx + kw, 4, 47, 15, 'Сад']); }
  else if (ne === 'chapel') { place(L, 'chapelb', {}, 39, 8, { solid: [39, 6, 46, 8] }); act(L, 'k_chapel', 42, 9, 'Часовня', { x: 43 * CT, y: 9 * CT + 8, r: 28 }); spot(L, 'k_chapd', 42, 9, 'up', { away: 1 });
    for (let x = 39; x <= 46; x += 2) for (const y of [12, 14]) if (r.f() < 0.6) place(L, 'grave', { seed: x * 5 + y, ck: 'vg' + ((x + y) % 4) }, x, y, { dx: 2, solid: [x, y, x, y] });
    spot(L, 'k_garden', 44, 10, 'left'); M.rooms.push([kx + kw, 4, 47, 15, 'Часовня']); }
  else { for (let x = 39; x <= 46; x += 3) for (const y of [6, 9, 12]) place(L, 'fruit', { seed: x * 3 + y + sid, ck: 'vfr' + ((x + y) % 4) }, x, y, { cx: x * CT + 8, solid: [x, y, x, y], shadow: [14, 5] });
    place(L, 'beehive', {}, 46, 14, { solid: [46, 14, 46, 14] }); place(L, 'beehive', {}, 47, 14, { solid: [47, 14, 47, 14] }); spot(L, 'k_garden', 41, 14, 'up'); M.rooms.push([kx + kw, 4, 47, 15, 'Яблоневый сад']); }
  for (let x = kx + kw; x < 38; x += 2) vTree(L, r, x, 5 + (x % 2) * 6, r.f() < 0.3);
  for (let x = 11; x < kx; x += 2) vTree(L, r, x, 6 + (x % 2) * 5, r.f() < 0.3);
  // the granary, the kitchen, the smithy, the barracks along the south wall
  const s2 = r.pick(sty);
  place(L, 'bld', { w: 6, fh: 38, rh: 40, wall: s2[0] === 'stone' ? 'plank' : s2[0], roof: 'thatch', doors: [[32, 16, 24, 0]], wins: [[12, 10]], seed: 7 + sid % 5, sign: [70, 'grain'], ck: 'kb' + sid + '_gr' }, 2, 33, { dx: -2, solid: [2, 31, 7, 33] });
  [[8, 33], [9, 33], [8, 32]].forEach((p, i) => place(L, 'sack', {}, p[0], p[1], { dx: 2 + (i % 2) * 3 }));
  place(L, 'cart', {}, 8, 29, { solid: [8, 29, 10, 29] }); act(L, 'k_granary', 4, 34, 'Амбар', { r: 30 }); spot(L, 'k_granf', 5, 34, 'up');
  place(L, 'bld', { w: 7, fh: 40, rh: 40, wall: 'stone', roof: st[1], doors: [[48, 14, 22, 1]], wins: [[14, 12], [84, 12]], chim: 90, seed: 3 + sid % 4, shut: r.pick(VSHUT), box: 1, sign: [70, 'bread'], ck: 'kb' + sid + '_ki' }, 12, 33, { dx: -2, solid: [12, 31, 18, 33] });
  place(L, 'woodpile', {}, 19, 33, { solid: [19, 33, 20, 33] }); place(L, 'cauldron', {}, 21, 31, { anim: 3, fps: 6, solid: [21, 31, 21, 31], light: { r: 26, col: '#ff8030', a: 0.6, fl: 0.2, dy: 6 } }); place(L, 'barrel', {}, 11, 33, { solid: [11, 33, 11, 33] });
  spot(L, 'k_kitchen', 15, 34, 'up', { away: 1 }); spot(L, 'k_cauldron', 21, 32, 'up'); act(L, 'k_kitchen', 15, 34, 'Кухня', { r: 26 });
  place(L, 'bld', { w: 7, fh: 40, rh: 40, wall: s2[0] === 'stone' ? 'timber' : s2[0], roof: s2[1], kind: 'forge', chim: 24, seed: 5, sign: [96, 'anvil'], ck: 'kb' + sid + '_fo' }, 31, 33, { dx: -2, anim: 3, fps: 6, solid: [31, 31, 37, 33], light: { r: 48, col: '#ff7020', a: 0.9, fl: 0.25, dx: -40, dy: 30 } });
  spot(L, 'k_smith', 33, 34, 'up'); act(L, 'k_forge', 33, 34, 'Кузня', { r: 26 });
  place(L, 'bld', { w: 9, fh: 44, rh: 44, wall: st[0], roof: st[1] === 'thatch' ? 'shake' : st[1], doors: [[32, 14, 22, 0], [96, 14, 22, 0]], wins: [[10, 12], [56, 12], [76, 12], [122, 12]], seed: 6 + sid % 3, shut: r.pick(VSHUT), sign: [56, 'sword'], ck: 'kb' + sid + '_ba' }, 39, 33, { dx: -2, solid: [39, 31, 47, 33] });
  spot(L, 'k_barr0', 41, 34, 'up', { away: 1 }); spot(L, 'k_barr1', 45, 34, 'up', { away: 1 }); act(L, 'k_barracks', 43, 34, 'Казармы', { r: 34 });
  // the training ground
  for (const dx0 of [39, 41, 43]) { place(L, 'dummy', {}, dx0, 19, { solid: [dx0, 19, dx0, 19], dx: -2 }); spot(L, 'k_train' + dx0, dx0, 20, 'up'); }
  place(L, 'target', {}, 46, 18, { solid: [46, 18, 46, 18], dx: -3 }); place(L, 'target', {}, 46, 22, { solid: [46, 22, 46, 22], dx: -3 }); spot(L, 'k_archer', 42, 22, 'right');
  place(L, 'rack', {}, 39, 24, { solid: [39, 24, 40, 24] }); place(L, 'rack', {}, 44, 27, { solid: [44, 27, 45, 27] }); spot(L, 'k_master', 42, 24, 'up'); act(L, 'k_dummy', 41, 20, 'Учебный двор', { r: 24 });
  // the plaza, the well, lamps, trees, benches
  place(L, 'well', {}, 24, 21, { cx: 25 * CT, solid: [24, 20, 25, 21] }); act(L, 'k_well', 25, 22, 'Колодец', { r: 28 }); spot(L, 'k_well0', 23, 21, 'right'); spot(L, 'k_well1', 26, 22, 'left');
  for (const [lx, ly] of [[22, 13], [27, 13], [22, 28], [27, 28], [18, 17], [31, 17]]) place(L, 'lamppost', { lit: 1, ck: 'lit' }, lx, ly, { dx: 2, solid: [lx, ly, lx, ly], light: LAMPL });
  for (const [tx, ty, pine] of [[14, 15, 0], [34, 14, 0], [16, 25, 0], [3, 29, 1], [47, 26, 1], [30, 29, 0], [8, 42, 0], [41, 42, 0], [14, 43, 1], [34, 43, 1], [4, 43, 1], [45, 43, 0], [17, 41, 1], [32, 41, 0]]) vTree(L, r, tx, ty, !!pine);
  [[20, 14], [29, 14]].forEach(([bx, by], i) => { place(L, 'bench', {}, bx, by, { solid: [bx, by, bx + 1, by], dx: 1 }); spot(L, 'k_bench' + i, bx, by, 'down', { sit: 1, sx: (bx + 1) * CT, sy: by * CT + 8 }); });
  spot(L, 'k_plaza_w', 21, 21, 'right'); spot(L, 'k_plaza_e', 28, 21, 'left'); spot(L, 'k_plaza_n', 25, 18, 'down'); spot(L, 'k_door', 25, 11, 'down'); spot(L, 'k_road', 24, 29, 'up');
  spot(L, 'k_lane_w', 9, 35, 'right'); spot(L, 'k_lane_e', 37, 35, 'left');
  L.rooms = M.rooms.concat([[38, 16, 47, 25, 'Учебный двор'], [1, 16, 11, 27, 'Конюшня'], [0, 28, 20, 35, 'Хозяйственный двор'], [28, 26, 47, 35, 'Кузня и казармы'], [0, 36, 49, 43, 'Ворота замка'], [0, 0, 49, 43, 'Двор замка']]);
  for (const id in L.spots) { const sp = L.spots[id]; if (sp.sit || sp.away) continue; const tx = Math.floor(sp.x / CT), ty = Math.floor(sp.y / CT); if (solidAt(L, tx, ty)) { const [nx, ny] = nearFree(L, tx, ty); sp.x = nx * CT + 8; sp.y = ny * CT + 12; } }
  return [L, kHall(M), kGuest(M)]; }
// ---------- the great hall ----------
function kHall(M) { const w = 30, h = 20, T = GT, rl = M.rl, cap = M.cap, L = mkLoc('k_hall', cap ? 'Тронный зал' : 'Большой зал', w, h, 510 + M.sid % 7, false);
  tfill(L, 0, 0, w - 1, h - 1, T.WALL); tfill(L, 1, 3, w - 2, h - 4, cap ? T.MARBLE : T.FLAG); tfill(L, 8, 3, 21, 6, T.DAIS); tfill(L, 14, h - 3, 15, h - 1, T.FLAG);
  for (let i = 0; i < w * h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.rooms = [[8, 3, 21, 6, 'Высокий стол'], [0, 0, w - 1, h - 1, L.name]]; L.carpets = [[14, 7, 2, h - 11, M.carp[0], M.carp[1]]]; L.wains = () => 1; L.beams = [];
  door(L, 14, h - 2, 15, h - 1, 'k_yard', 25 * CT, 11 * CT + 12, 'down', { label: 'Во двор' });
  for (const wx of [2, 7, 22, 27]) { place(L, 'window', {}, wx, 2, { wall: 1, dy: -2, id: 'win' }); L.beams.push([wx * CT + 8, 3 * CT]); }
  for (const fx of [4, 24]) place(L, 'fireplace', {}, fx, 2, { wall: 1, dy: 4, anim: 4, fps: 8, light: { r: 64, col: '#ff9a40', a: 0.85, fl: 0.15, dy: 10 } });
  for (const bx of [10, 19]) { if (M.H) place(L, 'housebanner', { house: M.H.her, ck: 'hb' + M.H.id }, bx, 2, { wall: 1, dy: 1, dx: 1, anim: 4, fps: 3 }); else place(L, 'banner', { realm: rl, ck: 'r' + rl }, bx, 2, { wall: 1, dy: -1, anim: 4, fps: 3 }); }
  place(L, 'tapestry', { ramp: M.carp[0], ck: 'kt' + M.carp[0] }, 14, 2, { wall: 1, dy: -2 });
  // the high table: the host in the middle (on the throne at a foreign court), his family on one side, the guest of honour on the other
  place(L, 'ltable', { w: 160, ck: 'lt160' }, 10, 6, { solid: [10, 5, 19, 6] });
  [[10, 'k_heir'], [12, 'k_lady'], [17, 'k_kseat'], [19, 'k_stewt']].forEach(([x, nm]) => { place(L, 'chair', { dir: 'down' }, x, 4, { so: -3 }); spot(L, nm, x, 4, 'down', { sit: 1, sx: x * CT + 8, sy: 4 * CT + 9 }); });
  if (cap) { place(L, 'throne', {}, 14, 4, { cx: 15 * CT, solid: [14, 3, 15, 4] }); spot(L, 'k_host', 14, 4, 'down', { sit: 1, sx: 15 * CT, sy: 4 * CT + 10 }); }
  else { place(L, 'chair', { dir: 'down', ramp: 'gold', ck: 'dg' }, 14, 4, { so: -3, dx: 8 }); spot(L, 'k_host', 14, 4, 'down', { sit: 1, sx: 15 * CT, sy: 4 * CT + 9 }); }
  act(L, 'k_dine', 17, 6, 'Высокий стол', { x: 17 * CT + 8, y: 6 * CT + 6, r: 30 }); Object.defineProperty(L.acts[L.acts.length - 1], 'label', { get: () => kDineLabel() });
  place(L, 'platter', { w: 144, seed: 5, ck: 'kplh' }, 10, 6, { dx: 8, dy: -22, so: 24, show: () => kDinner() });
  for (const bx of [8, 21]) place(L, 'brazier', {}, bx, 5, { anim: 4, fps: 8, solid: [bx, 5, bx, 5], light: { r: 60, col: '#ffa040', a: 0.9, fl: 0.12, dy: -14 } });
  // the long tables with benches
  L.seats = [];
  for (const tx of [3, 17]) { const ty = 11; place(L, 'ltable', { w: 160, ck: 'lt160' }, tx, ty, { solid: [tx, ty - 1, tx + 9, ty] });
    place(L, 'lbench', { w: 160, ck: 'lb160' }, tx, ty - 2, {}); place(L, 'lbench', { w: 160, ck: 'lb160' }, tx, ty + 1, {});
    place(L, 'platter', { w: 144, seed: tx + 3, ck: 'kpl' + tx }, tx, ty, { dx: 8, dy: -22, so: 24, show: () => kDinner() });
    for (let k = 0; k < 5; k++) { const x = tx + 1 + k * 2, a = 'k_s' + tx + '_' + k; spot(L, a + 'n', x, ty - 2, 'down', { sit: 1, sx: x * CT + 8, sy: (ty - 2) * CT + 10 }); spot(L, a + 's', x, ty + 1, 'up', { sit: 1, sx: x * CT + 8, sy: (ty + 1) * CT + 7 }); L.seats.push(a + 'n', a + 's'); } }
  // the steward's desk, the stairs up to the guest chamber, the corners
  place(L, 'desk', { candle: 1, ck: 'c' }, 2, 14, { solid: [2, 14, 3, 14], light: { r: 34, col: '#ffc060', a: 0.6, fl: 0.1, dx: 12, dy: -10 } }); place(L, 'chest', {}, 5, 14, { solid: [5, 14, 5, 14] });
  spot(L, 'k_stew', 3, 15, 'up');
  place(L, 'stairs', {}, 26, h - 4, { solid: [26, h - 6, 27, h - 6] }); door(L, 26, h - 5, 27, h - 4, 'k_guest', 6 * CT, 6 * CT + 10, 'up', { label: 'Наверх, в гостевые покои' }); spot(L, 'k_priv', 26, h - 5, 'up', { away: 1 });
  candle(L, 1, 7); candle(L, 28, 7); place(L, 'armor', {}, 1, 3, { solid: [1, 3, 1, 3] }); place(L, 'armor', {}, 28, 3, { solid: [28, 3, 28, 3] });
  place(L, 'plant', {}, 1, h - 4, { solid: [1, h - 4, 1, h - 4] }); place(L, 'plant', {}, 28, h - 4, { solid: [28, h - 4, 28, h - 4] });
  if (cap) for (const px of [6, 23]) place(L, 'pillar', {}, px, 8, { solid: [px, 8, px, 8] });
  spot(L, 'k_hg0', 8, 7, 'down'); spot(L, 'k_hg1', 21, 7, 'down'); spot(L, 'k_recv', 15, 7, 'down'); spot(L, 'k_win', 7, 3, 'up'); spot(L, 'k_fire0', 5, 4, 'up'); spot(L, 'k_hearth', 24, 4, 'up');
  spot(L, 'k_min', 27, 8, 'left'); spot(L, 'k_srv0', 13, 8, 'down'); spot(L, 'k_srv1', 16, 13, 'left'); spot(L, 'k_srv2', 2, 8, 'right'); spot(L, 'k_kn0', 1, 10, 'right'); spot(L, 'k_kn1', 28, 10, 'left');
  return L; }
// ---------- the guest chamber upstairs ----------
function kGuest(M) { const w = 12, h = 10, T = GT, L = mkLoc('k_guest', 'Гостевые покои', w, h, 520 + M.sid % 5, false);
  tfill(L, 0, 0, w - 1, h - 1, T.WALL); tfill(L, 1, 3, w - 2, h - 3, T.WOOD); tfill(L, 5, h - 2, 6, h - 1, T.WOOD);
  for (let i = 0; i < w * h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.wains = () => 1; L.beams = []; L.rooms = [[0, 0, w - 1, h - 1, 'Гостевые покои']]; L.rugs = [[4, 4, 3, 2, M.carp[0]]];
  door(L, 5, h - 2, 6, h - 1, 'k_hall', 25 * CT + 8, 16 * CT + 10, 'left', { label: 'Вниз, в зал' });
  place(L, 'bed', { ramp: M.carp[0], ck: 'kbed' + M.carp[0] }, 1, 5, { dy: 2, solid: [1, 3, 2, 5] }); spot(L, 'k_bed', 1, 4, 'down', { sx: 2 * CT, sy: 4 * CT + 4, lie: 1 });
  act(L, 'k_bed', 3, 4, 'Лечь спать', { r: 28 }); place(L, 'window', {}, 4, 2, { wall: 1, dy: -2, id: 'win' }); L.beams.push([4 * CT + 8, 3 * CT]);
  place(L, 'fireplace', {}, 6, 2, { wall: 1, dy: 4, anim: 4, fps: 8, light: { r: 50, col: '#ff9a40', a: 0.8, fl: 0.15, dy: 10 } });
  place(L, 'wardrobe', {}, 9, 3, { dy: 2, dx: 1, solid: [9, 3, 10, 3] }); place(L, 'chest', {}, 2, 7, { solid: [2, 7, 2, 7] });
  place(L, 'ttable', {}, 8, 6, { dx: 2, solid: [8, 6, 9, 6] }); place(L, 'stool', {}, 7, 6, { dx: 2 }); candle(L, 10, 7);
  spot(L, 'k_gin', 5, 6, 'up'); return L; }
