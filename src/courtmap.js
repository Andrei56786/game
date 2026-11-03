'use strict';
// ===== COURT MAP: locations (castle yard & keep), prerender, collision, spots, doors, interactables =====
const LOCS = {};
function mkLoc(id, name, w, h, seed, out) { const L = { id, name, w, h, seed, out: !!out, ter: new Uint8Array(w * h), solid: new Uint8Array(w * h), objs: [], deco: [], spots: {}, doors: [], acts: [], lights: [], rooms: [], smoke: [], wins: [], dyn: [] }; LOCS[id] = L; return L; }
function tfill(L, x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < L.w && y < L.h) L.ter[y * L.w + x] = t; }
function sfill(L, x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < L.w && y < L.h) L.solid[y * L.w + x] = v === undefined ? 1 : v; }
// place an object standing on the bottom edge of tile row ty. op.cx = centre x (px); else left = tx*CT + dx
function place(L, k, o, tx, ty, op) {
  op = op || {}; const s = objSprite(k, o, 0), w = s.width, h = s.height;
  const x = op.cx !== undefined ? Math.round(op.cx - w / 2) : tx * CT + (op.dx || 0), y = (ty + 1) * CT + (op.dy || 0) - h;
  const ob = { k, o, x, y, w, h, sy: (ty + 1) * CT + (op.dy || 0) + (op.so || 0), fr: op.fr, anim: op.anim || 0, fps: op.fps || 6, bake: !!op.bake, id: op.id, show: op.show, shadow: op.shadow };
  if (op.solid) sfill(L, op.solid[0], op.solid[1], op.solid[2], op.solid[3]);
  if (op.light) L.lights.push(Object.assign({ x: x + w / 2, y: y + h / 2 }, op.light));
  if (s.pb && s.pb.meta) { for (const p of s.pb.meta.lights || []) if (op.winLight !== false) L.wins.push({ x: x + p[0], y: y + p[1] }); for (const p of s.pb.meta.smoke || []) L.smoke.push({ x: x + p[0], y: y + p[1], k: op.smokeK || 1 }); }
  (op.wall ? L.deco : L.objs).push(ob); return ob;
}
function spot(L, name, tx, ty, dir, op) { L.spots[name] = Object.assign({ loc: L.id, x: tx * CT + 8, y: ty * CT + 12, dir: dir || 'down' }, op || {}); }
function act(L, id, tx, ty, label, op) { const a = Object.assign({ id, loc: L.id, x: tx * CT + 8, y: ty * CT + 8, r: 26, label }, op || {}); L.acts.push(a); return a; }
function door(L, x0, y0, x1, y1, to, ax, ay, dir, op) { L.doors.push(Object.assign({ x0, y0, x1, y1, to, ax, ay, dir }, op || {})); }
function lightAt(L, x, y, r, col, a, op) { L.lights.push(Object.assign({ x, y, r, col, a }, op || {})); }
// ---------- keep interior ----------
function buildKeep() {
  const L = mkLoc('keep', 'Замок', 50, 31, 57, false), T = GT;
  tfill(L, 0, 0, 49, 30, T.WALL);
  tfill(L, 1, 3, 11, 12, T.WOOD); tfill(L, 13, 3, 34, 27, T.MARBLE); tfill(L, 18, 3, 29, 6, T.DAIS); tfill(L, 36, 3, 48, 12, T.WOOD);
  tfill(L, 1, 16, 11, 27, T.WOOD); tfill(L, 36, 16, 41, 27, T.FLAGD); tfill(L, 43, 16, 48, 27, T.FLAG);
  tfill(L, 12, 9, 12, 10, T.FLAG); tfill(L, 12, 22, 12, 23, T.FLAG); tfill(L, 35, 9, 35, 10, T.FLAG); tfill(L, 35, 22, 35, 23, T.FLAG); tfill(L, 42, 20, 42, 21, T.FLAG); tfill(L, 23, 28, 24, 30, T.FLAG);
  for (let i = 0; i < L.w * L.h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.rooms = [[1, 0, 11, 12, 'Библиотека'], [13, 0, 34, 30, 'Тронный зал'], [36, 0, 48, 12, 'Зал совета'], [1, 13, 11, 27, 'Королевские покои'], [36, 13, 41, 27, 'Казна'], [43, 13, 48, 27, 'Кабинет Ока']];
  L.carpets = [[22, 7, 4, 21, 'red', 'gold']]; L.rugs = [[4, 20, 5, 4, 'navy'], [38, 20, 3, 3, 'wine']];
  L.wains = (tx) => tx < 12 || tx > 35;
  // --- throne hall ---
  place(L, 'throne', {}, 23, 5, { cx: 24 * CT, solid: [23, 4, 24, 5], id: 'throne' });
  for (const bx of [19, 28]) place(L, 'brazier', {}, bx, 5, { anim: 4, fps: 8, solid: [bx, 5, bx, 5], light: { r: 70, col: '#ffa040', a: 0.95, fl: 0.12, dy: -14 } });
  for (const px0 of [15, 32]) for (const py of [8, 13, 18, 23]) place(L, 'pillar', {}, px0, py, { solid: [px0, py, px0, py] });
  for (const wx of [14, 18, 29, 33]) { place(L, 'window', {}, wx, 2, { wall: 1, dy: -2, id: 'win' }); L.beams = (L.beams || []).concat([[wx * CT + 8, 3 * CT]]); }
  place(L, 'tapestry', { ramp: 'navy', ck: 'n' }, 22, 2, { wall: 1, dy: -2 }); place(L, 'tapestry', { ramp: 'navy', ck: 'n' }, 24, 2, { wall: 1, dy: -2 });
  place(L, 'banner', { realm: 0 }, 21, 2, { wall: 1, dy: -1, anim: 4, fps: 3 }); place(L, 'banner', { realm: 0 }, 26, 2, { wall: 1, dy: -1, anim: 4, fps: 3 });
  L.hbSlots = [[16, 2], [20, 2], [27, 2], [31, 2], [13, 2], [34, 2]]; // house banners on the north face (drawn dynamically)
  for (const sx of [17, 30]) place(L, 'sconce', {}, sx, 2, { wall: 1, dy: -6, dx: 3, anim: 3, fps: 7, light: { r: 46, col: '#ffb050', a: 0.75, fl: 0.15 } });
  for (const [sx, sy] of [[13, 12], [13, 17], [34, 12], [34, 17]]) lightAt(L, sx * CT + 8, sy * CT, 40, '#ffb060', 0.5, { fl: 0.1 });
  place(L, 'stairs', {}, 13, 26, { solid: [13, 24, 14, 24] }); spot(L, 'stairs', 13, 25, 'up', { away: 1 });
  place(L, 'statue', {}, 16, 26, { solid: [16, 26, 16, 26], dx: -2 }); place(L, 'statue', {}, 31, 26, { solid: [31, 26, 31, 26], dx: -2 });
  place(L, 'plant', {}, 17, 27, { solid: [17, 27, 17, 27] }); place(L, 'plant', {}, 30, 27, { solid: [30, 27, 30, 27] });
  spot(L, 'throne', 23, 5, 'down', { sit: 1, sx: 24 * CT, sy: 5 * CT + 10 }); spot(L, 'throne_front', 23, 7, 'up');
  spot(L, 'guard_dl', 20, 6, 'down'); spot(L, 'guard_dr', 27, 6, 'down'); spot(L, 'guard_hl', 21, 26, 'down'); spot(L, 'guard_hr', 26, 26, 'down');
  spot(L, 'consort_hall', 25, 6, 'down'); spot(L, 'hall_w', 17, 10, 'right'); spot(L, 'hall_e', 30, 10, 'left'); spot(L, 'hall_w2', 17, 16, 'right'); spot(L, 'hall_e2', 30, 16, 'left'); spot(L, 'hall_sw', 19, 21, 'up'); spot(L, 'hall_se', 28, 21, 'up');
  for (let q = 0; q < 6; q++) spot(L, 'q' + q, q % 2 ? 24 : 23, 10 + q * 2, 'up'); spot(L, 'petition', 23, 7, 'up'); spot(L, 'envoy', 24, 8, 'up');
  act(L, 'throne', 23, 5, 'Сесть на трон', { x: 24 * CT, y: 6 * CT, r: 30 }); act(L, 'stairs', 13, 25, 'Лестница в покои придворных', { r: 22 });
  door(L, 23, 29, 24, 30, 'yard', 25 * CT, 11 * CT + 12, 'down', { label: 'Во двор' });
  // --- council chamber ---
  place(L, 'fireplace', {}, 41, 2, { wall: 1, dy: 4, anim: 4, fps: 8, light: { r: 64, col: '#ff9a40', a: 0.85, fl: 0.15, dy: 10 } });
  place(L, 'ltable', { w: 112, map: 1, ck: 'm' }, 39, 8, { solid: [39, 6, 45, 8], id: 'ctable' });
  const seatsTop = [40, 42, 44];
  seatsTop.forEach((x, i) => { place(L, 'chair', { dir: 'down' }, x, 5, { so: -3 }); spot(L, 'seat' + i, x, 5, 'down', { sit: 1, sy: 5 * CT + 9 }); });
  seatsTop.forEach((x, i) => { place(L, 'chair', { dir: 'up', ck: 'u' }, x, 9, { so: 6 }); spot(L, 'seat' + (3 + i), x, 9, 'up', { sit: 1, sy: 9 * CT + 6 }); });
  place(L, 'chair', { dir: 'left', ck: 'l' }, 46, 7, { so: -2, dx: 3 }); spot(L, 'seat6', 46, 7, 'left', { sit: 1, sy: 7 * CT + 9 });
  place(L, 'chair', { dir: 'right', ck: 'r', ramp: 'gold' }, 37, 7, { so: -2, dx: -2 }); spot(L, 'seat_king', 37, 7, 'right', { sit: 1, sy: 7 * CT + 9, sx: 37 * CT + 10 });
  act(L, 'council', 37, 7, 'Сесть во главе стола', { r: 24 }); act(L, 'maptable', 42, 7, 'Карта королевства', { r: 46 });
  place(L, 'mapboard', {}, 38, 2, { wall: 1, dy: -2 }); place(L, 'window', {}, 45, 2, { wall: 1, dy: -2 }); L.beams.push([45 * CT + 8, 3 * CT]);
  place(L, 'candelabra', {}, 36, 4, { anim: 2, fps: 4, solid: [36, 4, 36, 4], light: { r: 40, col: '#ffc060', a: 0.7, fl: 0.1, dy: -8 } }); place(L, 'candelabra', {}, 48, 4, { anim: 2, fps: 4, solid: [48, 4, 48, 4], dx: -2, light: { r: 40, col: '#ffc060', a: 0.7, fl: 0.1, dy: -8 } });
  place(L, 'bookshelf', { seed: 11, ck: 11 }, 46, 3, { solid: [46, 3, 47, 3] }); place(L, 'armor', {}, 36, 11, { solid: [36, 11, 36, 11] }); place(L, 'plant', {}, 48, 11, { solid: [48, 11, 48, 11], dx: 1 });
  spot(L, 'council_wait', 40, 11, 'up');
  // --- library ---
  for (const bx of [1, 3, 7, 9]) place(L, 'bookshelf', { seed: bx * 7, fill: 0.6, ck: 'b' + bx }, bx, 3, { solid: [bx, 3, bx + 1, 3], id: 'books' });
  place(L, 'window', {}, 5, 2, { wall: 1, dy: -2 }); place(L, 'window', {}, 6, 2, { wall: 1, dy: -2 }); L.beams.push([5 * CT + 16, 3 * CT]);
  place(L, 'desk', { candle: 1, ck: 'c' }, 5, 8, { solid: [5, 8, 6, 8], light: { r: 34, col: '#ffc060', a: 0.6, fl: 0.1, dx: 12, dy: -10 } });
  place(L, 'chair', { dir: 'up', ck: 'u' }, 6, 9, { so: 6, dx: -8 }); spot(L, 'lib_desk', 5, 9, 'up', { sit: 1, sx: 6 * CT, sy: 9 * CT + 6 });
  place(L, 'lectern', {}, 9, 9, { solid: [9, 9, 9, 9] }); place(L, 'globe', {}, 2, 10, { solid: [2, 10, 2, 10] }); place(L, 'candelabra', {}, 10, 6, { anim: 2, fps: 4, solid: [10, 6, 10, 6], light: { r: 36, col: '#ffc060', a: 0.65, fl: 0.1, dy: -8 } });
  place(L, 'shelfs', { seed: 5 }, 1, 12, { solid: [1, 12, 2, 12] });
  act(L, 'research', 9, 10, 'Книги и исследования', { r: 24 }); spot(L, 'lib_shelf', 8, 4, 'up'); spot(L, 'lib_globe', 3, 10, 'left'); spot(L, 'lib_read', 9, 10, 'up');
  // --- royal chambers ---
  place(L, 'bed', { ramp: 'blue' }, 2, 19, { dy: 2, solid: [2, 17, 3, 19], id: 'bed' }); place(L, 'wardrobe', {}, 7, 16, { dy: 2, solid: [7, 16, 8, 16] });
  place(L, 'fireplace', {}, 9, 15, { wall: 1, dy: 4, anim: 4, fps: 8, light: { r: 60, col: '#ff9a40', a: 0.85, fl: 0.15, dy: 10 } }); place(L, 'wallpic', { kind: 'hunt', ck: 'wp_hunt' }, 5, 15, { wall: 1, dy: -8, dx: -4 }); // behind this wall is the library, so a painting rather than a window
  place(L, 'chest', {}, 2, 21, { solid: [2, 21, 2, 21], dx: 7 }); place(L, 'crib', {}, 10, 20, { solid: [10, 20, 10, 20], dx: -2, id: 'crib', show: () => COURT.hasBaby }); place(L, 'toys', {}, 7, 26, { id: 'toys', show: () => COURT.hasKids });
  place(L, 'candelabra', {}, 1, 25, { anim: 2, fps: 4, solid: [1, 25, 1, 25], light: { r: 36, col: '#ffc060', a: 0.65, fl: 0.1, dy: -8 } }); place(L, 'plant', {}, 11, 26, { solid: [11, 26, 11, 26] });
  act(L, 'bed', 4, 18, 'Лечь спать', { r: 30 }); act(L, 'crib', 10, 21, 'Колыбель', { r: 22, show: () => COURT.hasBaby });
  spot(L, 'bed_king', 2, 18, 'down', { sx: 3 * CT, sy: 18 * CT + 4, lie: 1 }); spot(L, 'ch_chair', 9, 22, 'left'); spot(L, 'ch_window', 5, 17, 'up'); spot(L, 'ch_rug', 6, 23, 'down'); spot(L, 'ch_crib', 9, 21, 'right');
  // --- treasury ---
  place(L, 'desk', { candle: 1, scales: 1, ck: 'cs' }, 37, 19, { solid: [37, 19, 38, 19], light: { r: 34, col: '#ffc060', a: 0.6, fl: 0.1, dx: 12, dy: -10 } });
  place(L, 'chair', { dir: 'up', ck: 'u' }, 38, 20, { so: 6, dx: -8 }); spot(L, 'tr_desk', 37, 20, 'up', { sit: 1, sx: 38 * CT, sy: 20 * CT + 6 });
  for (const [cx, cy] of [[36, 16], [38, 16], [40, 16], [36, 23]]) place(L, 'chest', {}, cx, cy, { solid: [cx, cy, cx, cy] });
  L.goldSpots = [[39, 22], [40, 23], [38, 24], [40, 25], [37, 26], [39, 26], [41, 21], [41, 26], [36, 25], [38, 22]];
  L.goldSpots.forEach((g, i) => place(L, 'gold', { n: 2 + (i % 3), seed: i + 3, ck: 'g' + i }, g[0], g[1], { id: 'gold', show: () => COURT.goldPiles > i }));
  place(L, 'barrel', {}, 41, 18, { solid: [41, 18, 41, 18] }); act(L, 'treasury', 39, 22, 'Осмотреть казну', { r: 40 });
  // --- eye's cabinet ---
  place(L, 'desk', { candle: 1, ck: 'c' }, 44, 20, { solid: [44, 20, 45, 20], light: { r: 30, col: '#ffc060', a: 0.55, fl: 0.1, dx: 12, dy: -10 } });
  place(L, 'chair', { dir: 'up', ck: 'u' }, 45, 21, { so: 6, dx: -8 }); spot(L, 'eye_desk', 44, 21, 'up', { sit: 1, sx: 45 * CT, sy: 21 * CT + 6 });
  place(L, 'mapboard', {}, 45, 15, { wall: 1, dy: -2 }); place(L, 'cage', {}, 47, 18, { anim: 2, fps: 2, solid: [47, 18, 47, 18] }); place(L, 'shelfs', { seed: 9, ck: 9 }, 43, 16, { solid: [43, 16, 44, 16], dy: 2 });
  place(L, 'crate', {}, 48, 26, { solid: [48, 26, 48, 26] }); place(L, 'candelabra', {}, 48, 23, { anim: 2, fps: 4, solid: [48, 23, 48, 23], dx: -2, light: { r: 30, col: '#ffc060', a: 0.55, fl: 0.1, dy: -8 } });
  act(L, 'eyeboard', 45, 16, 'Доска Ока: донесения', { r: 30 }); spot(L, 'eye_board', 45, 17, 'up');
  spot(L, 'hall_door', 23, 27, 'down'); spot(L, 'lib_mid', 6, 6, 'down'); spot(L, 'council_door', 37, 10, 'right');
  keepUp(L); // v3.3: the stairs lead to the upper floor
  return L;
}
// ---------- castle yard ----------
function buildYard() {
  const L = mkLoc('yard', 'Двор замка', 74, 44, 31, true), T = GT;
  tfill(L, 0, 0, 73, 43, T.GRASS);
  tfill(L, 0, 0, 11, 3, T.CWALL); tfill(L, 38, 0, 73, 3, T.CWALL); tfill(L, 0, 0, 1, 39, T.CWALL); tfill(L, 72, 0, 73, 39, T.CWALL); tfill(L, 0, 36, 73, 39, T.CWALL);
  tfill(L, 12, 0, 37, 9, T.VOID);
  // roads & grounds
  tfill(L, 23, 10, 26, 35, T.COBBLE); tfill(L, 19, 17, 30, 24, T.COBBLE); tfill(L, 24, 36, 25, 39, T.COBBLE); tfill(L, 23, 40, 26, 43, T.DIRT); tfill(L, 22, 41, 27, 43, T.DIRT);
  tfill(L, 3, 34, 46, 35, T.DIRT); tfill(L, 9, 20, 22, 20, T.DIRT); tfill(L, 31, 25, 37, 25, T.DIRT); tfill(L, 37, 16, 38, 25, T.DIRT);
  tfill(L, 38, 17, 46, 24, T.SAND); tfill(L, 2, 22, 9, 25, T.DIRT); tfill(L, 3, 8, 7, 11, T.SOIL);
  tfill(L, 42, 4, 43, 15, T.SAND); tfill(L, 38, 9, 47, 10, T.SAND); tfill(L, 12, 10, 37, 11, T.COBBLE);
  for (let i = 0; i < L.w * L.h; i++) if (L.ter[i] === T.CWALL || L.ter[i] === T.VOID) L.solid[i] = 1;
  sfill(L, 24, 36, 25, 39, 0);
  L.rooms = [[37, 4, 47, 15, 'Сад'], [38, 16, 47, 25, 'Ристалище'], [1, 13, 11, 27, 'Конюшни'], [0, 28, 20, 35, 'Хозяйственный двор'], [28, 26, 47, 35, 'Кузня и казармы'], [0, 36, 49, 43, 'Ворота замка'], [0, 0, 49, 43, 'Двор замка']];
  // keep facade (static) + door
  L.keep = { x: 12 * CT, y: 0, w: 26 }; door(L, 24, 10, 25, 10, 'keep', 24 * CT, 27 * CT + 10, 'up', { label: 'В замок' }); // the doorstep row: row 9 is the facade itself and cannot be stood on
  place(L, 'pole', { realm: 0 }, 21, 10, { anim: 4, fps: 3, solid: [21, 10, 21, 10], dx: 6 }); place(L, 'pole', { realm: 0 }, 28, 10, { anim: 4, fps: 3, solid: [28, 10, 28, 10], dx: 6 });
  // towers & gatehouse
  place(L, 'tower', {}, 0, 39, { cx: 2 * CT, solid: [0, 34, 3, 39] }); place(L, 'tower', {}, 46, 42, { cx: 48 * CT, solid: [46, 36, 49, 42] }); // v3.6: the flanking tower stands out from the curtain — the road along the barracks runs past it
  place(L, 'gatehouse', {}, 19, 39, { anim: 2, fps: 2, solid: [19, 34, 23, 35], light: null, winLight: false }); sfill(L, 26, 34, 30, 35);
  lightAt(L, 23 * CT + 2, 35 * CT, 44, '#ffa040', 0.8, { fl: 0.15, night: 1 }); lightAt(L, 26 * CT + 14, 35 * CT, 44, '#ffa040', 0.8, { fl: 0.15, night: 1 });
  spot(L, 'gate_l', 23, 33, 'down'); spot(L, 'gate_r', 26, 33, 'down'); spot(L, 'gate_out', 24, 43, 'up', { away: 1 }); spot(L, 'gate_in', 25, 33, 'up');
  act(L, 'gate', 24, 41, 'Покинуть замок', { x: 25 * CT, y: 41 * CT + 8, r: 40, auto: 1 });
  // stable & paddock
  place(L, 'bld', { w: 7, fh: 42, rh: 38, wall: 'plank', roof: 'shake', kind: 'stable', stalls: 3, seed: 4, ck: 'stable' }, 2, 19, { dx: -2, solid: [2, 17, 8, 19] });
  place(L, 'hay', {}, 9, 19, { solid: [9, 19, 9, 19], dx: 2 }); place(L, 'hay', {}, 10, 18, { solid: [10, 18, 10, 18] });
  place(L, 'fence', { n: 5, ck: 5 }, 2, 21, { solid: [2, 21, 6, 21] }); place(L, 'fence', { n: 2, ck: 2 }, 8, 21, { solid: [8, 21, 9, 21] });
  place(L, 'gate', { ck: 'g1' }, 7, 21, { dy: 2, fr: gateFr }); // the groom's gate
  place(L, 'fence', { n: 5, v: 1, ck: 'v5' }, 10, 26, { dx: 5, solid: [10, 21, 10, 26] }); place(L, 'fence', { n: 8, ck: 8 }, 2, 26, { solid: [2, 26, 9, 26] });
  place(L, 'trough', {}, 3, 22, { solid: [3, 22, 4, 22] }); L.paddock = [2, 23, 9, 25];
  act(L, 'stable', 5, 20, 'Конюшня', { r: 30 }); spot(L, 'stable', 6, 20, 'up');
  // dovecote & herb garden
  place(L, 'dovecote', {}, 9, 7, { cx: 10 * CT, solid: [9, 6, 10, 7] }); act(L, 'dovecote', 10, 8, 'Голубятня: письма', { r: 26 });
  for (let x = 3; x <= 7; x++) for (const y of [8, 10]) place(L, 'herbs', { seed: x * 3 + y, ck: 'h' + ((x + y) % 4) }, x, y, { bake: 1 });
  spot(L, 'herbs', 5, 12, 'up'); spot(L, 'dove', 10, 8, 'up');
  // granary, kitchen, smithy, barracks
  place(L, 'bld', { w: 6, fh: 38, rh: 40, wall: 'plank', roof: 'thatch', doors: [[32, 16, 24, 0]], wins: [[12, 10]], seed: 7, sign: [70, 'grain'], ck: 'gran' }, 2, 33, { dx: -2, solid: [2, 31, 7, 33] });
  L.sackSpots = [[8, 33], [9, 33], [8, 32], [10, 33], [9, 32], [11, 32]]; L.sackSpots.forEach((p, i) => place(L, 'sack', {}, p[0], p[1], { id: 'sack', dx: 2 + (i % 2) * 3, show: () => COURT.sacks > i }));
  place(L, 'cart', {}, 8, 29, { solid: [8, 29, 10, 29] }); act(L, 'granary', 4, 34, 'Амбар', { r: 30 });
  place(L, 'bld', { w: 7, fh: 40, rh: 40, wall: 'stone', roof: 'tile', doors: [[48, 14, 22, 1]], wins: [[14, 12], [84, 12]], chim: 90, seed: 3, shut: 'green', box: 1, sign: [70, 'bread'], ck: 'kitchen' }, 12, 33, { dx: -2, solid: [12, 31, 18, 33] });
  place(L, 'woodpile', {}, 19, 33, { solid: [19, 33, 20, 33] }); place(L, 'cauldron', {}, 21, 31, { anim: 3, fps: 6, solid: [21, 31, 21, 31], light: { r: 26, col: '#ff8030', a: 0.6, fl: 0.2, dy: 6 } }); place(L, 'barrel', {}, 11, 33, { solid: [11, 33, 11, 33] });
  spot(L, 'kitchen', 15, 34, 'up', { away: 1 }); spot(L, 'granary_f', 5, 34, 'up'); spot(L, 'cauldron', 21, 32, 'up'); act(L, 'kitchen', 15, 34, 'Кухня', { r: 26 });
  place(L, 'bld', { w: 7, fh: 40, rh: 40, wall: 'timber', roof: 'slate', kind: 'forge', chim: 24, seed: 5, sign: [96, 'anvil'], ck: 'forge' }, 31, 33, { dx: -2, anim: 3, fps: 6, solid: [31, 31, 37, 33], light: { r: 48, col: '#ff7020', a: 0.9, fl: 0.25, dx: -40, dy: 30 } });
  spot(L, 'smith', 33, 34, 'up'); act(L, 'smithy', 33, 34, 'Кузня', { r: 26 });
  place(L, 'bld', { w: 9, fh: 44, rh: 44, wall: 'timber', roof: 'slate', doors: [[32, 14, 22, 0], [96, 14, 22, 0]], wins: [[10, 12], [56, 12], [76, 12], [122, 12]], seed: 6, shut: 'red', sign: [56, 'sword'], ck: 'barracks' }, 39, 33, { dx: -2, solid: [39, 31, 47, 33] });
  spot(L, 'barracks1', 41, 34, 'up', { away: 1 }); spot(L, 'barracks2', 45, 34, 'up', { away: 1 }); act(L, 'barracks', 43, 34, 'Казармы', { r: 34 });
  // training ground
  for (const dx0 of [39, 41, 43]) { place(L, 'dummy', {}, dx0, 19, { solid: [dx0, 19, dx0, 19], dx: -2 }); spot(L, 'train' + dx0, dx0, 20, 'up'); }
  place(L, 'target', {}, 46, 18, { solid: [46, 18, 46, 18], dx: -3 }); place(L, 'target', {}, 46, 22, { solid: [46, 22, 46, 22], dx: -3 }); spot(L, 'archer1', 42, 22, 'right'); spot(L, 'archer2', 42, 18, 'right');
  place(L, 'rack', {}, 39, 24, { solid: [39, 24, 40, 24] }); place(L, 'rack', {}, 39, 27, { solid: [39, 27, 40, 27] }); place(L, 'rack', {}, 44, 27, { solid: [44, 27, 45, 27] });
  spot(L, 'master', 42, 24, 'up'); act(L, 'dummy', 41, 20, 'Поупражняться с мечом', { r: 24 });
  // garden
  place(L, 'hedge', { n: 4, ck: 'h4' }, 38, 15, { solid: [38, 15, 41, 15] }); place(L, 'hedge', { n: 4, seed: 2, ck: 'h4b' }, 44, 15, { solid: [44, 15, 47, 15] });
  for (const by of [5, 8, 12]) place(L, 'bush', { seed: by, flower: by === 8 ? 1 : 0, ck: 'bu' + by }, 37, by, { dx: 2, solid: [37, by, 37, by] });
  place(L, 'fountain', {}, 42, 10, { cx: 43 * CT, anim: 4, fps: 5, solid: [41, 9, 44, 10] }); act(L, 'fountain', 43, 11, 'Фонтан', { r: 30 });
  for (const [bx, by] of [[39, 6], [45, 6], [39, 13], [45, 13]]) { place(L, 'bench', {}, bx, by, { solid: [bx, by, bx + 1, by], dx: 1 }); }
  spot(L, 'bench_nw', 39, 6, 'down', { sit: 1, sy: 6 * CT + 8, sx: 40 * CT }); spot(L, 'bench_ne', 45, 6, 'down', { sit: 1, sy: 6 * CT + 8, sx: 46 * CT }); spot(L, 'bench_sw', 39, 13, 'down', { sit: 1, sy: 13 * CT + 8, sx: 40 * CT }); spot(L, 'bench_se', 45, 13, 'down', { sit: 1, sy: 13 * CT + 8, sx: 46 * CT });
  spot(L, 'whisper_a', 45, 12, 'left'); spot(L, 'whisper_b', 44, 12, 'right'); spot(L, 'garden_n', 42, 6, 'down'); spot(L, 'garden_s', 43, 14, 'up'); spot(L, 'garden_w', 39, 10, 'right'); spot(L, 'garden_e', 46, 10, 'left');
  place(L, 'fruit', { seed: 3, ck: 'f3' }, 40, 4, { cx: 40.5 * CT, solid: [40, 4, 40, 4], shadow: [14, 5] }); place(L, 'fruit', { seed: 8, fruit: 'gold', ck: 'f8' }, 46, 4, { cx: 46 * CT, solid: [45, 4, 46, 4], shadow: [14, 5] });
  for (const [fx, fy] of [[38, 14], [39, 14], [46, 14], [47, 14]]) place(L, 'flowers', { n: 1, seed: fx, ck: 'fl' + (fx % 3) }, fx, fy, { bake: 1 });
  // plaza, lamps, trees, stall
  place(L, 'well', {}, 24, 21, { cx: 25 * CT, solid: [24, 20, 25, 21] }); act(L, 'well', 25, 22, 'Колодец', { r: 28 }); spot(L, 'well', 23, 21, 'right');
  for (const [lx, ly] of [[22, 13], [27, 13], [22, 28], [27, 28], [18, 17], [31, 17]]) place(L, 'lamppost', { lit: 1, ck: 'lit' }, lx, ly, { dx: 2, solid: [lx, ly, lx, ly], light: { r: 52, col: '#ffc060', a: 0.9, fl: 0.06, night: 1, dy: -12 } });
  for (const [tx, ty, k] of [[14, 15, 'oak'], [34, 14, 'oak'], [16, 25, 'oak'], [3, 29, 'pine'], [47, 26, 'pine'], [30, 29, 'oak'], [8, 42, 'oak'], [41, 42, 'oak'], [14, 43, 'pine'], [34, 43, 'pine'], [4, 43, 'pine'], [45, 43, 'oak']]) place(L, k, { seed: tx * 7 + ty, ck: k + tx }, tx, ty, { cx: tx * CT + 8, solid: [tx, ty, tx, ty], shadow: k === 'pine' ? [12, 4] : [20, 6] });
  place(L, 'stall', {}, 18, 27, { solid: [18, 27, 19, 27] }); spot(L, 'stall', 18, 28, 'up'); act(L, 'stall', 19, 28, 'Лоток торговца', { r: 26 });
  for (const [bx, by] of [[20, 14], [29, 14]]) place(L, 'bench', {}, bx, by, { solid: [bx, by, bx + 1, by] });
  spot(L, 'plaza_w', 21, 21, 'right'); spot(L, 'plaza_e', 28, 21, 'left'); spot(L, 'plaza_n', 25, 18, 'down'); spot(L, 'keep_door', 25, 10, 'down'); spot(L, 'road', 24, 29, 'up'); spot(L, 'lane_w', 9, 35, 'right'); spot(L, 'lane_e', 37, 35, 'left');
  yardEast(L); // v3.3: the chapel, the feast hall, the lists, the kennels and the forest gate
  return L;
}
// ---------- prerender static layers ----------
function bakeLoc(L) { // v3.5: outdoors the season is baked in too — the bare ground is kept and the season repainted over it (seaGround etc. in season.js)
  const first = !L.bakeObjs, sv = L.out ? seaVarOf(L) : '', b = new PB(L.w * CT, L.h * CT);
  if (first || !L.gnd) { const gid = paintGround(b, L.ter, L.w, L.h, L.seed); if (L.out) { L.gid = gid; L.gnd = b.d.slice(); } } else b.d.set(L.gnd);
  if (L.out && sv) seaGround(b, L, sv);
  SEA_PB = L.out && sv ? (k, what) => seaStruct(k, sv, what) : null;
  if (L.out) { paintCurtain(b, L.ter, L.w, L.h, L.seed); if (sv) seaCurtain(b, L, sv); if (L.keep) { const m = paintKeepFacade(b, L.keep.x, L.keep.y, L.keep.w, L.seed); if (first) L.keepMeta = m; } }
  else paintWalls(b, L.ter, L.w, L.h, L.seed, { wains: L.wains });
  SEA_PB = null;
  for (const c of L.carpets || []) paintCarpet(b, c[0] * CT, c[1] * CT, c[2] * CT, c[3] * CT, c[4], c[5]);
  for (const r of L.rugs || []) paintRug(b, r[0] * CT, r[1] * CT, r[2] * CT, r[3] * CT, r[4]);
  if (first) { L.shObjs = L.objs.filter(o => o.shadow); L.bakeObjs = L.objs.filter(o => o.bake).sort((p, q) => p.sy - q.sy); }
  for (const o of L.shObjs) shadowEll(b, o.x + o.w / 2, o.sy - 2, o.shadow[0], o.shadow[1]);
  const sv0 = SEAV; SEAV = sv; for (const o of L.bakeObjs) b.blit(objSprite(o.k, sv ? seaObjOpt(o) : o.o, 0).pb, o.x, o.y); SEAV = sv0;
  if (first) L.objs = L.objs.filter(o => !o.bake);
  if (first && L.keepMeta) { for (const p of L.keepMeta.wins) L.wins.push({ x: p[0], y: p[1], big: 1 }); for (const p of L.keepMeta.banners) L.deco.push(L.keepHB ? { k: 'housebanner', o: L.keepHB, x: p[0] - 7, y: p[1] + 3, w: 14, h: 26, anim: 4, fps: 3 } : { k: 'banner', o: L.keepRealm ? { realm: L.keepRealm, ck: 'r' + L.keepRealm } : { realm: 0 }, x: p[0] - 8, y: p[1], w: 16, h: 32, anim: 4, fps: 3 }); for (const p of L.keepMeta.sconces) { L.deco.push({ k: 'sconce', o: {}, x: p[0] - 5, y: p[1] - 7, w: 10, h: 14, anim: 3, fps: 7 }); lightAt(L, p[0], p[1] - 6, 40, '#ffb050', 0.8, { fl: 0.15, night: 1 }); } }
  L.cv = b.canvas(); L.pb = b; L.sv = sv; L.sk = L.out ? seaKeyOf(L) : '';
}
function buildCourt() { const sd = G ? G.seed : 0; if (LOCS.keep && LOCS.yard && LOCS.upper && COURT.bSeed === sd) return; for (const k in LOCS) delete LOCS[k]; COURT.npcs = []; COURT.ani = []; const t0 = performance.now();
  for (const f of [buildKeep, buildYard, buildUpper, buildDungeon, buildHall, buildChapel, buildForest]) { const L = f(); L.site = 'home'; bakeLoc(L); }
  COURT.bSeed = sd; projSetup(); for (const f of BUILD_EXT) f(); COURT.bakeMs = performance.now() - t0; }
const solidAt = (L, tx, ty) => tx < 0 || ty < 0 || tx >= L.w || ty >= L.h || L.solid[ty * L.w + tx] === 1;
function roomName(L, tx, ty) { for (const r of L.rooms) if (tx >= r[0] && tx <= r[2] && ty >= r[1] && ty <= r[3]) return r[4]; return L.name; }
