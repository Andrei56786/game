'use strict';
// ===== CASTLE 2 (v3.3): the bigger capital — east yard (chapel, feast hall, lists, kennels, building plots, forest gate),
// the upper floor (queen's rooms, gallery of ancestors, bedrooms), the dungeon, the feast hall, the chapel, the royal forest; beds & new staff =====
SIGN_EXT.dog = (b, x, y) => { const I = RPK.ivory; b.rect(x + 3, y + 4, 5, 2, I[3]); b.rect(x + 2, y + 2, 2, 2, I[4]); b.set(x + 1, y + 3, I[3]); b.set(x + 3, y + 2, RPK.black[1]); b.set(x + 3, y + 6, I[2]); b.set(x + 7, y + 6, I[2]); b.set(x + 8, y + 3, I[3]); };
const ADV_ROOMS = ['chancellor', 'treasurer', 'eye', 'seneschal', 'magister', 'justice', 'marshal'];
const ADV_RAMP = { chancellor: 'navy', treasurer: 'gold', eye: 'black', seneschal: 'brown', magister: 'teal', justice: 'wine', marshal: 'red' };
const ADV_ITEM = { chancellor: 'globe', treasurer: 'scales', eye: 'cage', seneschal: 'sack', magister: 'lectern', justice: 'lectern', marshal: 'armor' };
const ADV_RN = { chancellor: 'Покои канцлера', treasurer: 'Покои казначея', eye: 'Покои Ока', seneschal: 'Покои сенешаля', magister: 'Покои магистра', justice: 'Покои судьи', marshal: 'Покои маршала' };
const LAMPL = { r: 52, col: '#ffc060', a: 0.9, fl: 0.06, night: 1, dy: -12 }, CANDL = { r: 36, col: '#ffc060', a: 0.65, fl: 0.1, dy: -8 };
const candle = (L, x, y, op) => place(L, 'candelabra', {}, x, y, Object.assign({ anim: 2, fps: 4, solid: [x, y, x, y], light: CANDL }, op || {}));
const bedSpot = (L, name, tx, ty) => spot(L, name, tx, ty - 1, 'down', { sx: (tx + 1) * CT, sy: (ty - 1) * CT + 4, lie: 1 });
// ---------- yard: east wing (the yard is 74 tiles wide now) ----------
function yardEast(L) { const T = GT;
  for (let y = 4; y <= 15; y++) if (y < 9 || y > 10) place(L, 'bush', { seed: 40 + y, flower: y % 3 === 0 ? 1 : 0, ck: 'gb' + (y % 3) }, 48, y, { dx: -4, solid: [48, y, 48, y] });
  tfill(L, 48, 9, 50, 10, T.SAND); tfill(L, 49, 10, 73, 11, T.COBBLE); tfill(L, 52, 9, 71, 9, T.COBBLE); tfill(L, 72, 10, 73, 11, T.COBBLE); sfill(L, 72, 10, 73, 11, 0);
  tfill(L, 50, 12, 51, 33, T.DIRT); tfill(L, 50, 32, 69, 33, T.DIRT); tfill(L, 52, 16, 71, 25, T.SAND); tfill(L, 52, 26, 71, 31, T.DIRT);
  // chapel & feast hall along the north wall
  place(L, 'chapelb', {}, 52, 8, { solid: [52, 6, 59, 8] }); door(L, 55, 9, 56, 9, 'chapel', 13 * CT, 17 * CT + 10, 'up', { label: 'В часовню' }); spot(L, 'chapel_door', 57, 10, 'up');
  place(L, 'bld', { w: 11, fh: 52, rh: 46, wall: 'stone', roof: 'tile', doors: [[69, 22, 28, 1]], wins: [[10, 14, 10, 14], [34, 14, 10, 14], [116, 14, 10, 14], [140, 14, 10, 14]], chim: 150, seed: 12, shut: 'red', ck: 'hallb' }, 61, 8, { dx: -2, solid: [61, 6, 71, 8] });
  door(L, 65, 9, 66, 9, 'hall', 22 * CT, 21 * CT + 10, 'up', { label: 'В пиршественный зал' }); spot(L, 'hall_door_y', 64, 10, 'up');
  place(L, 'pole', { realm: 0 }, 63, 9, { anim: 4, fps: 3, solid: [63, 9, 63, 9], dx: 6 }); place(L, 'pole', { realm: 0 }, 68, 9, { anim: 4, fps: 3, solid: [68, 9, 68, 9], dx: 6 });
  for (const [lx, ly] of [[52, 12], [60, 12], [70, 12], [71, 9], [53, 26], [63, 26]]) place(L, 'lamppost', { lit: 1, ck: 'lit' }, lx, ly, { dx: 2, solid: [lx, ly, lx, ly], light: LAMPL });
  // the forest gate in the east curtain
  door(L, 73, 10, 73, 11, 'forest', 3 * CT + 8, 30 * CT + 12, 'right', { label: 'В королевский лес' }); spot(L, 'forest_gate', 71, 12, 'left');
  place(L, 'gatepost', { flip: 1, ck: 'gp1' }, 72, 9, { dx: -1, light: { r: 30, col: '#ffa040', a: 0.8, fl: 0.2, night: 1, dx: -11, dy: 4 } }); place(L, 'gatepost', { ck: 'gp0' }, 72, 12, { dx: -1, light: { r: 30, col: '#ffa040', a: 0.8, fl: 0.2, night: 1, dx: 9, dy: 4 } });
  // the lists (stands are a project)
  place(L, 'tilt', { n: 14, ramp: 'navy', ck: 't14' }, 55, 21, { solid: [55, 21, 68, 21] });
  place(L, 'tent', { ramp: 'red', ck: 'tr' }, 52, 18, { solid: [52, 17, 53, 18] }); place(L, 'tent', { ramp: 'blue', ck: 'tb' }, 70, 18, { dx: -2, solid: [70, 17, 71, 18] });
  place(L, 'rack', {}, 52, 24, { solid: [52, 24, 53, 24] }); place(L, 'rack', {}, 70, 24, { solid: [70, 24, 71, 24] });
  for (const bx of [53, 68]) place(L, 'bush', { seed: bx, ck: 'lb' + bx }, bx, 13, { dx: -4, solid: [bx, 13, bx, 13] });
  act(L, 'lists', 61, 23, 'Турнирное поле', { r: 40 }); spot(L, 'lists_n', 61, 19, 'down'); spot(L, 'lists_s', 61, 23, 'up'); spot(L, 'lists_w', 51, 23, 'right'); spot(L, 'lists_e', 69, 20, 'left');
  // kennels & the hounds' run
  place(L, 'bld', { w: 5, fh: 38, rh: 34, wall: 'plank', roof: 'shake', doors: [[28, 14, 20, 1]], wins: [[6, 10]], seed: 13, sign: [56, 'dog'], ck: 'kennel' }, 52, 30, { dx: -2, solid: [52, 28, 56, 30] });
  place(L, 'fence', { n: 6, ck: 6 }, 57, 27, { solid: [57, 27, 62, 27] }); place(L, 'fence', { n: 6, ck: 6 }, 57, 31, { solid: [57, 31, 62, 31] });
  place(L, 'fence', { n: 4, v: 1, ck: 'v4' }, 57, 31, { solid: [57, 27, 57, 31] }); place(L, 'fence', { n: 4, v: 1, ck: 'v4' }, 62, 31, { dx: 12, solid: [62, 27, 62, 31] });
  place(L, 'trough', {}, 59, 29, { solid: [59, 29, 60, 29] });
  act(L, 'kennel', 54, 31, 'Псарня: выехать на охоту', { r: 30 }); spot(L, 'hunter', 55, 32, 'up'); spot(L, 'kennel_in', 54, 31, 'up', { away: 1 });
  // the dungeon hatch by the smithy
  place(L, 'cellar', {}, 34, 28, { dx: -4, solid: [33, 27, 36, 27] }); sfill(L, 33, 28, 33, 28); sfill(L, 36, 28, 36, 28);
  door(L, 34, 28, 35, 28, 'dungeon', 3 * CT + 8, 8 * CT + 12, 'right', { label: 'В темницу' });
  // outside the walls
  place(L, 'tower', {}, 70, 39, { cx: 72 * CT, solid: [70, 34, 73, 39] });
  for (const [tx, ty, k] of [[53, 42, 'oak'], [58, 41, 'pine'], [62, 43, 'oak'], [66, 41, 'oak'], [71, 42, 'pine'], [56, 43, 'pine']]) place(L, k, { seed: tx * 7 + ty, ck: k + tx }, tx, ty, { cx: tx * CT + 8, solid: [tx, ty, tx, ty], shadow: k === 'pine' ? [12, 4] : [20, 6] });
  L.rooms = [[51, 4, 59, 9, 'Часовня'], [60, 4, 71, 9, 'Пиршественный зал'], [52, 12, 71, 25, 'Турнирное поле'], [52, 26, 62, 31, 'Псарня'], [63, 26, 71, 31, 'Хозяйственные постройки'], [70, 10, 73, 12, 'Лесные ворота']]
    .concat(L.rooms.map(r => r[4] === 'Двор замка' || r[4] === 'Ворота замка' ? [r[0], r[1], 73, r[3], r[4]] : r));
}
function keepUp(L) { L.acts = L.acts.filter(a => a.id !== 'stairs'); door(L, 13, 25, 14, 26, 'upper', 13 * CT + 8, 6 * CT + 12, 'down', { label: 'Наверх' }); }
// ---------- upper floor ----------
function buildUpper() {
  const L = mkLoc('upper', 'Верхний этаж', 50, 28, 61, false), T = GT;
  tfill(L, 0, 0, 49, 27, T.WALL);
  tfill(L, 1, 3, 10, 8, T.WOOD); tfill(L, 12, 3, 14, 8, T.FLAG); tfill(L, 16, 3, 33, 8, T.MARBLE); tfill(L, 35, 3, 41, 8, T.WOOD); tfill(L, 43, 3, 48, 8, T.FLAGD);
  tfill(L, 1, 12, 48, 14, T.WOOD);
  tfill(L, 5, 9, 6, 11, T.WOOD); tfill(L, 12, 9, 14, 11, T.FLAG); tfill(L, 24, 9, 25, 11, T.MARBLE); tfill(L, 38, 9, 38, 11, T.WOOD); tfill(L, 45, 9, 45, 11, T.FLAGD);
  tfill(L, 1, 18, 8, 25, T.WOOD); for (let i = 0; i < 7; i++) tfill(L, 10 + i * 5, 18, 13 + i * 5, 25, T.WOOD); tfill(L, 45, 18, 48, 25, T.FLAG);
  tfill(L, 4, 15, 5, 17, T.WOOD); for (let i = 0; i < 7; i++) tfill(L, 11 + i * 5, 15, 11 + i * 5, 17, T.WOOD); tfill(L, 46, 15, 46, 17, T.FLAG);
  for (let i = 0; i < L.w * L.h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.rooms = [[1, 3, 10, 8, 'Покои королевы'], [12, 3, 14, 11, 'Лестница'], [16, 3, 33, 8, 'Галерея предков'], [35, 3, 41, 8, 'Гостевые покои'], [43, 3, 48, 8, 'Звездочётная'], [1, 12, 48, 14, 'Коридор'], [1, 18, 8, 25, 'Детская']]
    .concat(ADV_ROOMS.map((k, i) => [10 + i * 5, 18, 13 + i * 5, 25, ADV_RN[k]])).concat([[45, 18, 48, 25, 'Комната слуг'], [0, 0, 49, 27, 'Верхний этаж']]);
  L.wains = (tx, ty) => ty > 9; L.carpets = [[2, 13, 46, 1, 'red', 'gold']]; L.rugs = [[5, 5, 3, 3, 'wine'], [37, 5, 3, 2, 'green'], [2, 21, 5, 3, 'blue']]; L.beams = [];
  const win = (x, y) => { place(L, 'window', {}, x, y, { wall: 1, dy: -2, id: 'win' }); L.beams.push([x * CT + 8, (y + 1) * CT]); };
  // queen's chambers
  place(L, 'bed', { ramp: 'wine', ck: 'bq' }, 2, 7, { dy: 2, solid: [2, 5, 3, 7] }); bedSpot(L, 'bed_queen', 2, 7);
  win(4, 2); place(L, 'vanity', {}, 6, 3, { solid: [6, 3, 7, 3] }); place(L, 'fireplace', {}, 8, 2, { wall: 1, dy: 4, anim: 4, fps: 8, light: { r: 56, col: '#ff9a40', a: 0.85, fl: 0.15, dy: 10 } });
  place(L, 'loom', {}, 9, 6, { solid: [9, 6, 10, 6] }); place(L, 'chest', {}, 4, 7, { dx: 7, solid: [4, 7, 4, 7] }); candle(L, 1, 3); place(L, 'plant', {}, 10, 8, { solid: [10, 8, 10, 8] });
  spot(L, 'q_vanity', 6, 4, 'up'); spot(L, 'q_loom', 8, 6, 'right'); spot(L, 'q_window', 4, 4, 'up'); spot(L, 'q_rug', 6, 6, 'down');
  // landing with the stairs down
  place(L, 'stairdn', {}, 12, 4, {}); door(L, 12, 3, 13, 4, 'keep', 14 * CT + 8, 27 * CT + 10, 'down', { label: 'Вниз, в тронный зал' });
  place(L, 'armor', {}, 14, 5, { solid: [14, 5, 14, 5] }); place(L, 'plant', {}, 14, 8, { solid: [14, 8, 14, 8] }); spot(L, 'landing', 13, 7, 'down');
  // gallery of ancestors (portraits are drawn live, see galleryDraw)
  L.gallery = [24, 64, 104, 144, 184, 224, 264].map((c, i) => ({ x: 256 + c, i, big: i === 3 }));
  L.gallery.forEach(s => { const a = act(L, 'gallery', Math.floor(s.x / CT), 3, '', { x: s.x, y: 3 * CT + 10, r: 20, slot: s.i }); Object.defineProperty(a, 'label', { get: () => galleryLabel(s.i) }); });
  for (const bx of [19, 29]) place(L, 'bench', {}, bx, 7, { solid: [bx, 7, bx + 1, 7], dx: 1 }); spot(L, 'gal_bench', 19, 7, 'up', { sit: 1, sx: 20 * CT, sy: 7 * CT + 8 });
  place(L, 'statue', {}, 16, 8, { solid: [16, 8, 16, 8], dx: -2 }); place(L, 'statue', {}, 33, 8, { solid: [33, 8, 33, 8], dx: -2 }); candle(L, 16, 4); candle(L, 33, 4);
  spot(L, 'gal_w', 19, 5, 'up'); spot(L, 'gal_e', 30, 5, 'up'); spot(L, 'gal_mid', 25, 5, 'up');
  // guest chambers
  place(L, 'bed', { ramp: 'green', ck: 'bg' }, 36, 7, { dy: 2, solid: [36, 5, 37, 7] }); bedSpot(L, 'bed_guest', 36, 7);
  place(L, 'wardrobe', {}, 39, 3, { dy: 2, solid: [39, 3, 40, 3] }); place(L, 'chest', {}, 40, 7, { solid: [40, 7, 40, 7] }); win(38, 2); candle(L, 41, 5); spot(L, 'guest_mid', 38, 6, 'down');
  // star chamber (the telescope is a project)
  win(46, 2); spot(L, 'obs_scope', 44, 6, 'right');
  for (const [x, y, k] of [[43, 4, 'crate'], [44, 4, 'crate'], [48, 4, 'barrel'], [47, 8, 'crate']]) place(L, k, {}, x, y, { id: 'obs_junk', show: () => !projDone('observatory') });
  // corridor
  for (const sx of [3, 9, 17, 21, 28, 33, 41, 47]) place(L, 'sconce', {}, sx, 11, { wall: 1, dy: -6, dx: 3, anim: 3, fps: 7, light: { r: 40, col: '#ffb050', a: 0.7, fl: 0.15 } });
  for (const bx of [8, 29]) place(L, 'bench', {}, bx, 14, { solid: [bx, 14, bx + 1, 14] }); place(L, 'plant', {}, 1, 14, { solid: [1, 14, 1, 14] }); place(L, 'plant', {}, 48, 14, { solid: [48, 14, 48, 14] });
  spot(L, 'cor_w', 3, 13, 'right'); spot(L, 'cor_e', 46, 13, 'left'); spot(L, 'cor_mid', 25, 13, 'down');
  // nursery
  ['blue', 'pink', 'teal', 'green'].forEach((rp0, i) => { const x = 1 + i * 2; place(L, 'cot', { ramp: rp0, ck: 'cot' + rp0 }, x, 20, { solid: [x, 19, x, 20] }); spot(L, 'bed_kid' + i, x, 20, 'down', { sx: x * CT + 9, sy: 21 * CT - 8, lie: 1 }); });
  place(L, 'rhorse', {}, 3, 23, { solid: [3, 23, 3, 23] }); place(L, 'toys', {}, 6, 24, {}); place(L, 'chest', {}, 8, 22, { solid: [8, 22, 8, 22] }); win(4, 17); candle(L, 1, 24);
  spot(L, 'nur_rug', 4, 22, 'down'); spot(L, 'nur_play', 6, 23, 'left');
  // advisors' bedrooms
  ADV_ROOMS.forEach((k, i) => { const x0 = 10 + i * 5; place(L, 'bed', { ramp: ADV_RAMP[k], ck: 'b_' + k }, x0, 21, { dy: 2, solid: [x0, 19, x0 + 1, 21] }); bedSpot(L, 'bed_' + k, x0, 21);
    place(L, 'chest', {}, x0 + 3, 19, { solid: [x0 + 3, 19, x0 + 3, 19] }); candle(L, x0 + 3, 24); win(x0 + 2, 17);
    place(L, ADV_ITEM[k], { seed: i + 3, ck: 'ai' + i }, x0, 24, { solid: [x0, 24, x0, 24] }); spot(L, 'room_' + k, x0 + 2, 22, 'down'); });
  // servants
  place(L, 'cot', { ramp: 'gray', ck: 'cotg' }, 45, 20, { solid: [45, 19, 45, 20] }); spot(L, 'bed_maid', 45, 20, 'down', { sx: 45 * CT + 9, sy: 21 * CT - 8, lie: 1 });
  place(L, 'cot', { ramp: 'brown', ck: 'cotb' }, 47, 20, { solid: [47, 19, 47, 20] }); spot(L, 'bed_page', 47, 20, 'down', { sx: 47 * CT + 9, sy: 21 * CT - 8, lie: 1 });
  place(L, 'chest', {}, 46, 24, { solid: [46, 24, 46, 24] }); place(L, 'barrel', {}, 48, 24, { solid: [48, 24, 48, 24] }); win(47, 17);
  return L;
}
// portraits in the gallery: ancestors to the left, the king (big frame) in the middle, his family to the right
function galleryChars() { const k = kingC(), C = G.court; const anc = ((C && C.ancestors) || []).map(charOf).filter(Boolean).slice(-3);
  const sp = k.spouse >= 0 ? charOf(k.spouse) : null, h = heirOf(k), kid = royalFamily().find(c => c !== sp && c !== h && !c.dowager && c.age >= 3) || null;
  const L = [null, null, null, k, sp && sp.alive ? sp : null, h, kid]; anc.slice().reverse().forEach((c, i) => { L[2 - i] = c; }); return L; }
function galleryLabel(i) { const c = galleryChars()[i]; if (!c) return i === 3 ? 'Место для парадного портрета' : 'Пустая рама'; return 'Портрет: ' + (c.title ? c.title + ' ' : '') + c.name + (c.alive ? '' : ' †'); }
function galleryAct(a) { const c = galleryChars()[a.slot]; const k = kingC();
  if (!c) { DLG.say(null, a.slot === 3 ? 'Над камином — пустое место для парадного портрета. Придворный живописец ждёт заказа (см. «Замыслы» у сенешаля).' : 'Пустая золочёная рама. Её место — для тех, кого ещё не нарисовали.'); return; }
  const dead = !c.alive, role = c.id === k.id ? 'Ныне царствующий государь.' : dead ? 'Правил до вас. Покоится в склепе под часовней.' : famRole(c) + '.';
  DLG.say(c, (dead ? 'Старый портрет, потемневший от свечной копоти. ' : '') + c.name + ' — ' + role + (c.id === k.id && projBuiltFor('portrait') ? ' Парадный портрет в полный рост: художник польстил вам ровно настолько, насколько было уплачено.' : ''), { name: 'Галерея предков' }); }
ACTS_EXT.gallery = galleryAct;
CRENDER.push((g, L) => { if (L.id !== 'upper' || !L.gallery) return; const ch = galleryChars();
  for (const s of L.gallery) { const c = ch[s.i], w = s.big ? 38 : 28, h = s.big ? 44 : 32, x = Math.round(s.x - w / 2), y = s.big ? 6 : 15;
    if (s.big && !(c && projBuiltFor('portrait'))) { g.fillStyle = '#1c1418'; g.fillRect(x + 3, y + 3, w - 6, h - 6); g.drawImage(objSprite('pframe', { w, h, ck: 'pf' + w }, 0), x, y); continue; }
    g.fillStyle = '#20161a'; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    if (c) { const p = portrait(c); if (p) { const ps = s.big ? 32 : 22; g.drawImage(p, 0, 0, 48, 48, Math.round(s.x - ps / 2), y + (s.big ? 5 : 4), ps, ps); if (!c.alive) { g.globalAlpha = 0.25; g.fillStyle = '#3a2a10'; g.fillRect(x + 3, y + 3, w - 6, h - 6); g.globalAlpha = 1; } } }
    g.drawImage(objSprite('pframe', { w, h, ck: 'pf' + w }, 0), x, y); } });
// ---------- dungeon ----------
function buildDungeon() {
  const L = mkLoc('dungeon', 'Темница', 40, 16, 67, false), T = GT;
  tfill(L, 0, 0, 39, 15, T.WALL); tfill(L, 1, 3, 3, 12, T.FLAGD); tfill(L, 1, 8, 38, 12, T.FLAGD);
  for (let i = 0; i < 6; i++) tfill(L, 5 + i * 5, 3, 8 + i * 5, 7, T.FLAGD); tfill(L, 35, 3, 38, 7, T.FLAG);
  for (let i = 0; i < L.w * L.h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.dark = 0.5; L.rooms = [[1, 3, 3, 7, 'Лестница наверх'], [5, 3, 33, 7, 'Камеры'], [35, 3, 38, 7, 'Каморка тюремщика'], [0, 0, 39, 15, 'Темница']];
  place(L, 'stairs', {}, 1, 6, { solid: [1, 3, 2, 4] }); door(L, 1, 5, 2, 6, 'yard', 35 * CT, 29 * CT + 12, 'down', { label: 'Наверх, во двор' });
  L.cells = [];
  for (let i = 0; i < 6; i++) { const x0 = 5 + i * 5; place(L, 'bars', { n: 4, door: 1, ck: 'bars4' }, x0, 7, { solid: [x0, 7, x0 + 3, 7] });
    place(L, 'straw', { seed: i + 1, ck: 'st' + i }, x0, 5, { bake: 1 }); place(L, 'chains', {}, x0 + 3, 2, { wall: 1, dy: 6 }); if (i % 2) place(L, 'stool', {}, x0 + 3, 4, { solid: [x0 + 3, 4, x0 + 3, 4] });
    spot(L, 'cell' + i, x0 + 1, 5, 'down'); spot(L, 'cell' + i + 'b', x0 + 2, 4, 'down'); L.cells.push(i); }
  place(L, 'jtable', {}, 35, 5, { solid: [35, 4, 36, 5] }); place(L, 'stool', {}, 37, 5, {}); place(L, 'chains', {}, 36, 2, { wall: 1, dy: 6 }); place(L, 'rack', {}, 37, 3, { solid: [37, 3, 38, 3] });
  place(L, 'brazier', {}, 38, 7, { anim: 4, fps: 8, solid: [38, 7, 38, 7], light: { r: 60, col: '#ff8a30', a: 0.9, fl: 0.18, dy: -14 } });
  for (const bx of [10, 23, 33]) place(L, 'brazier', {}, bx, 12, { anim: 4, fps: 8, solid: [bx, 12, bx, 12], light: { r: 64, col: '#ff8a30', a: 0.9, fl: 0.18, dy: -14 } });
  place(L, 'barrel', {}, 1, 12, { solid: [1, 12, 1, 12] }); place(L, 'crate', {}, 36, 12, { solid: [36, 12, 36, 12] }); place(L, 'crate', {}, 37, 12, { solid: [37, 12, 37, 12] }); place(L, 'straw', { seed: 9, ck: 'st9' }, 15, 11, { bake: 1 }); place(L, 'straw', { seed: 11, ck: 'st11' }, 28, 12, { bake: 1 });
  spot(L, 'jailer', 37, 6, 'left'); spot(L, 'jail_desk', 37, 5, 'left', { sit: 1, sy: 5 * CT + 9 }); spot(L, 'jail_in', 38, 4, 'left', { away: 1 }); spot(L, 'dun_in', 3, 8, 'right');
  return L;
}
// ---------- feast hall ----------
function buildHall() {
  const L = mkLoc('hall', 'Пиршественный зал', 44, 26, 71, false), T = GT;
  tfill(L, 0, 0, 43, 25, T.WALL); tfill(L, 1, 3, 42, 22, T.FLAG); tfill(L, 9, 3, 34, 6, T.DAIS); tfill(L, 21, 23, 22, 25, T.FLAG);
  for (let i = 0; i < L.w * L.h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.rooms = [[9, 3, 34, 6, 'Высокий стол'], [0, 0, 43, 25, 'Пиршественный зал']]; L.carpets = [[20, 7, 4, 16, 'wine', 'gold']]; L.wains = () => 1; L.beams = [];
  door(L, 21, 24, 22, 25, 'yard', 66 * CT, 10 * CT + 12, 'down', { label: 'Во двор' }); spot(L, 'hall_in', 22, 22, 'up', { away: 1 });
  for (const wx of [2, 6, 37, 41]) { place(L, 'window', {}, wx, 2, { wall: 1, dy: -2, id: 'win' }); L.beams.push([wx * CT + 8, 3 * CT]); }
  for (const fx of [4, 38]) place(L, 'fireplace', {}, fx, 2, { wall: 1, dy: 4, anim: 4, fps: 8, light: { r: 70, col: '#ff9a40', a: 0.9, fl: 0.15, dy: 10 } });
  place(L, 'banner', { realm: 0 }, 19, 2, { wall: 1, dy: -1, anim: 4, fps: 3 }); place(L, 'banner', { realm: 0 }, 24, 2, { wall: 1, dy: -1, anim: 4, fps: 3 });
  for (const tx of [9, 31]) place(L, 'tapestry', { ramp: 'wine', ck: 'hw' }, tx, 2, { wall: 1, dy: -2, show: () => projDone('tapestries') });
  place(L, 'tapestry', { ramp: 'navy', ck: 'n' }, 21, 2, { wall: 1, dy: -2 }); L.hbSlots = [[13, 2], [16, 2], [27, 2], [30, 2], [12, 2], [33, 2]];
  // the high table on the dais
  place(L, 'ltable', { w: 224, ck: 'ht' }, 15, 6, { solid: [15, 5, 28, 6] });
  L.highSeats = []; [16, 18, 20, 24, 26, 28].forEach((x, i) => { place(L, 'chair', { dir: 'down' }, x, 4, { so: -3, dx: x > 21 ? -8 : 0 }); spot(L, 'ht' + i, x, 4, 'down', { sit: 1, sx: x * CT + (x > 21 ? 0 : 8), sy: 4 * CT + 9 }); L.highSeats.push('ht' + i); });
  place(L, 'chair', { dir: 'down', ramp: 'gold', ck: 'dg' }, 21, 4, { so: -3, dx: 8 }); spot(L, 'hall_king', 21, 4, 'down', { sit: 1, sx: 22 * CT, sy: 4 * CT + 9 });
  act(L, 'hall_king', 22, 5, 'Высокий стол', { x: 22 * CT, y: 6 * CT + 6, r: 30 }); Object.defineProperty(L.acts[L.acts.length - 1], 'label', { get: () => feastLabel() });
  place(L, 'platter', { w: 208, seed: 7, ck: 'plh' }, 15, 6, { dx: 8, dy: -22, so: 24, show: () => feastOn() });
  // long tables with benches
  L.seats = [];
  for (const [ty, tx] of [[10, 5], [10, 25], [16, 5], [16, 25]]) { place(L, 'ltable', { w: 224, ck: 'ht' }, tx, ty, { solid: [tx, ty - 1, tx + 13, ty] });
    place(L, 'lbench', { w: 224, ck: 'lb224' }, tx, ty - 2, {}); place(L, 'lbench', { w: 224, ck: 'lb224' }, tx, ty + 1, {});
    place(L, 'platter', { w: 208, seed: tx + ty, ck: 'pl' + tx + ty }, tx, ty, { dx: 8, dy: -22, so: 24, show: () => feastOn() });
    for (let k = 0; k < 6; k++) { const x = tx + 1 + k * 2; const a = 's' + ty + '_' + x; spot(L, a + 'n', x, ty - 2, 'down', { sit: 1, sx: x * CT + 8, sy: (ty - 2) * CT + 10 }); spot(L, a + 's', x, ty + 1, 'up', { sit: 1, sx: x * CT + 8, sy: (ty + 1) * CT + 7 }); L.seats.push(a + 'n', a + 's'); } }
  candle(L, 9, 7); candle(L, 34, 7); place(L, 'plant', {}, 1, 21, { solid: [1, 21, 1, 21] }); place(L, 'plant', {}, 42, 21, { solid: [42, 21, 42, 21] });
  place(L, 'cask', {}, 39, 21, { solid: [39, 20, 41, 21] }); place(L, 'barrel', {}, 1, 18, { solid: [1, 18, 1, 18] }); place(L, 'barrel', {}, 2, 18, { solid: [2, 18, 2, 18] });
  spot(L, 'minstrel', 35, 8, 'left'); spot(L, 'hall_srv1', 20, 13, 'right'); spot(L, 'hall_srv2', 23, 19, 'left'); spot(L, 'hall_mid', 22, 20, 'up');
  return L;
}
// ---------- chapel ----------
function buildChapel() {
  const L = mkLoc('chapel', 'Часовня', 26, 22, 73, false), T = GT;
  tfill(L, 0, 0, 25, 21, T.WALL); tfill(L, 1, 3, 24, 18, T.FLAG); tfill(L, 8, 3, 17, 6, T.MARBLE); tfill(L, 12, 19, 13, 21, T.FLAG);
  for (let i = 0; i < L.w * L.h; i++) if (L.ter[i] === T.WALL) L.solid[i] = 1;
  L.rooms = [[8, 3, 17, 6, 'Алтарь'], [0, 0, 25, 21, 'Часовня']]; L.carpets = [[12, 7, 2, 12, 'red', 'gold']]; L.wains = () => 0; L.beams = [];
  door(L, 12, 20, 13, 21, 'yard', 56 * CT, 10 * CT + 12, 'down', { label: 'Во двор' });
  place(L, 'altar', {}, 12, 5, { cx: 13 * CT, solid: [11, 4, 14, 5] }); candle(L, 9, 5); candle(L, 16, 5);
  for (const wx of [3, 6, 19, 22]) { place(L, 'window', {}, wx, 2, { wall: 1, dy: -2, show: () => !projDone('stainglass') }); place(L, 'stainwin', { ck: 'sw' }, wx, 2, { wall: 1, dy: -2, show: () => projDone('stainglass') }); L.beams.push([wx * CT + 8, 3 * CT]); }
  place(L, 'statue', {}, 2, 4, { solid: [2, 4, 2, 4], dx: -2 }); place(L, 'statue', {}, 23, 4, { solid: [23, 4, 23, 4], dx: -2 });
  for (const ty of [9, 11, 13, 15]) for (const tx of [2, 16]) { place(L, 'pew', { n: 8, ck: 'pew8' }, tx, ty, { solid: [tx, ty, tx + 7, ty] }); }
  place(L, 'font', {}, 4, 17, { solid: [4, 17, 5, 17] }); candle(L, 21, 17); place(L, 'plant', {}, 1, 18, { solid: [1, 18, 1, 18] });
  act(L, 'pray', 13, 7, 'Помолиться у алтаря', { x: 13 * CT, y: 7 * CT + 8, r: 26 });
  spot(L, 'altar_front', 12, 7, 'up'); spot(L, 'chap_side', 19, 7, 'left'); spot(L, 'chap_door', 14, 17, 'up'); spot(L, 'chapel_in', 24, 6, 'left', { away: 1 }); spot(L, 'chap_pew', 4, 9, 'up', { sit: 1, sy: 9 * CT + 6 });
  return L;
}
// ---------- the royal forest (hunting grounds) ----------
function buildForest() {
  const W0 = 84, H0 = 60, L = mkLoc('forest', 'Королевский лес', W0, H0, 79, true), T = GT, r = mkRng((((G && G.seed) || 1) * 2654435761 + 977) >>> 0);
  L.dark = 0.92; tfill(L, 0, 0, W0 - 1, H0 - 1, T.GRASS);
  const open = new Uint8Array(W0 * H0), occ = new Uint8Array(W0 * H0), mark = (x, y, v) => { if (x >= 0 && y >= 0 && x < W0 && y < H0) open[y * W0 + x] = Math.max(open[y * W0 + x], v); };
  const CL = [[14, 30, 5, 4], [30, 13, 7, 5], [34, 46, 8, 6], [64, 16, 7, 5], [68, 44, 8, 6], [44, 30, 4, 3], [76, 30, 5, 6]].map(([cx, cy, rx, ry]) => [cx + r.i(-2, 2), cy + r.i(-2, 2), rx, ry]);
  for (const [cx, cy, rx, ry] of CL) for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) mark(x, y, 1);
  for (let y = 21; y <= 37; y++) for (let x = 0; x <= 12; x++) mark(x, y, 1);
  // the stream (north to south), then the trail across it (fords)
  let sx = 50 + r.i(-2, 2); for (let y = 0; y < H0; y++) { if (y % 3 === 0 && r.f() < 0.5) sx = clamp(sx + r.pick([-1, 1]), 46, 56); tfill(L, sx, y, sx + 1, y, T.WATER); sfill(L, sx, y, sx + 1, y); mark(sx, y, 3); mark(sx + 1, y, 3); mark(sx - 1, y, 1); mark(sx + 2, y, 1); }
  const pc = CL[2]; for (let y = pc[1] - 2; y <= pc[1] + 2; y++) for (let x = pc[0] - 3; x <= pc[0] + 3; x++) if (((x - pc[0]) / 3.2) ** 2 + ((y - pc[1]) / 2.2) ** 2 <= 1) { tfill(L, x, y, x, y, T.WATER); sfill(L, x, y, x, y); mark(x, y, 3); }
  const path = (x, y) => { if (x < 0 || y < 0 || x >= W0 || y >= H0) return; const i = y * W0 + x; tfill(L, x, y, x, y, L.ter[i] === T.WATER ? T.SAND : T.DIRT); L.solid[i] = 0; mark(x, y, 2); };
  let y = 30; const trail = []; for (let x = 0; x < W0 - 2; x++) { if (x > 7 && r.f() < 0.22) y = clamp(y + r.pick([-1, 1]), 24, 36); trail.push([x, y]); path(x, y); path(x, y - 1); mark(x, y + 1, 1); mark(x, y - 2, 1); }
  const branch = (i0, c, sw) => { let [x, yy] = trail[i0]; const [x1, y1] = c; for (let k = 0; k < 300 && (x !== x1 || yy !== y1); k++) { let nx = x, ny = yy; if (x !== x1 && (yy === y1 || r.f() < 0.5)) nx += Math.sign(x1 - x); else ny += Math.sign(y1 - yy); if (sw && L.ter[ny * W0 + nx] === T.WATER) break; x = nx; yy = ny; path(x, yy); mark(x + 1, yy, 1); mark(x - 1, yy, 1); } };
  branch(30, CL[1]); branch(34, CL[2], 1); branch(62, CL[3]); branch(66, CL[4]);
  for (let x = 0; x < W0; x++) { sfill(L, x, 0, x, 0); sfill(L, x, H0 - 1, x, H0 - 1); } for (let yy = 0; yy < H0; yy++) { if (yy < 27 || yy > 33) sfill(L, 0, yy, 0, yy); sfill(L, W0 - 1, yy, W0 - 1, yy); }
  // trees: denser towards the edges, pines in the north
  const tree = (tx, ty) => { const i = ty * W0 + tx; if (L.solid[i] || open[i]) return; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (occ[(ty + dy) * W0 + tx + dx]) return;
    const pine = r.f() < (ty < 22 ? 0.7 : tx > 60 ? 0.5 : 0.25), k = pine ? 'pine' : 'oak', v = r.i(0, 5); place(L, k, { seed: 300 + v * 17 + (pine ? 7 : 0), ck: 'f' + k + v }, tx, ty, { cx: tx * CT + 8, solid: [tx, ty, tx, ty], shadow: pine ? [12, 4] : [20, 6] }); occ[i] = 1; };
  for (let ty = 1; ty < H0 - 1; ty++) for (let tx = 1; tx < W0 - 1; tx++) { const edge = Math.min(tx, ty, W0 - 1 - tx, H0 - 1 - ty); if (r.f() < (edge < 3 ? 0.7 : 0.2 + 0.08 * Math.sin(tx * 0.21 + ty * 0.13))) tree(tx, ty); }
  for (let k = 0; k < 170; k++) { const tx = r.i(2, W0 - 3), ty = r.i(2, H0 - 3), i = ty * W0 + tx; if (L.solid[i] || open[i] >= 2 || occ[i]) continue; const p = r.f();
    if (p < 0.33) place(L, 'bush', { seed: k, flower: r.f() < 0.2 ? 1 : 0, ck: 'fb' + (k % 5) }, tx, ty, { dx: -4, solid: [tx, ty, tx, ty] });
    else if (p < 0.47) place(L, 'rock', { seed: k % 4 + 1, ck: 'rk' + (k % 4) }, tx, ty, { dx: -3, solid: [tx, ty, tx, ty] });
    else if (p < 0.58) { if (L.solid[i + 1] || occ[i + 1]) continue; place(L, 'log', {}, tx, ty, { solid: [tx, ty, tx + 1, ty] }); occ[i + 1] = 1; }
    else if (p < 0.68) place(L, 'stump', {}, tx, ty, { dx: 1 });
    else place(L, 'flowers', { n: 1, seed: k, ck: 'fl' + (k % 3) }, tx, ty, { bake: 1 });
    occ[i] = 1; }
  // the huntsman's lodge by the gate
  place(L, 'bld', { w: 4, fh: 34, rh: 32, wall: 'plank', roof: 'shake', doors: [[24, 14, 20, 0]], wins: [[6, 9]], seed: 17, chim: 46, ck: 'lodge' }, 3, 26, { dx: -2, solid: [3, 24, 6, 26] });
  place(L, 'campfire', {}, 8, 27, { anim: 4, fps: 6, solid: [8, 27, 8, 27], light: { r: 44, col: '#ff9030', a: 0.85, fl: 0.25, dy: -4 } }); place(L, 'woodpile', {}, 9, 25, { solid: [9, 25, 10, 25] }); place(L, 'log', {}, 10, 27, {});
  spot(L, 'f_gate', 3, 30, 'right'); spot(L, 'f_fire', 8, 28, 'up'); spot(L, 'f_lodge', 5, 27, 'down'); spot(L, 'f_dogs', 6, 30, 'right');
  door(L, 0, 27, 0, 33, 'yard', 71 * CT + 8, 10 * CT + 16, 'left', { label: 'Назад, в замок' });
  const nm = ['Поляна у сторожки', 'Оленья поляна', 'Тихий пруд', 'Кабанья балка', 'Волчий лог', 'Поляна у брода', 'Дальняя поляна'];
  L.rooms = CL.map(([cx, cy, rx, ry], i) => [cx - rx, cy - ry, cx + rx, cy + ry, nm[i]]).concat([[0, 21, 12, 37, 'Охотничья сторожка'], [0, 0, W0 - 1, H0 - 1, 'Королевский лес']]);
  L.clearings = CL; L.trail = trail; L.open = open; return L;
}
// ---------- new staff, beds, prisoners, animals ----------
SERVANTS.push(['chaplain', 'priest', 0, 52, 'Отец Ансгар', 'chapel_in'], ['hunter', 'hunter', 0, 38, 'Ловчий Бертрам', 'kennel_in'], ['jailer', 'jailer', 0, 45, 'Тюремщик Гуго', 'jail_in']);
Object.assign(SCHED, {
  chaplain: [[5, 'chapel_in'], [6.5, 'altar_front'], [9, 'chap_side'], [11, 'garden_e'], [12.5, 'altar_front'], [15, 'chap_door'], [17, 'altar_front'], [20, 'chapel_in']],
  hunter: [[5, 'kennel_in'], [6, 'hunter'], [10, 'lists_w'], [11.5, 'hunter'], [13, 'kitchen'], [14, 'hunter'], [19.5, 'kennel_in']],
  jailer: [[5, 'jailer'], [8, 'wander:5,9,33,11@dungeon'], [11, 'jail_desk'], [14, 'wander:5,9,33,11@dungeon'], [17, 'jailer'], [21, 'jail_desk'], [23, 'jail_in']],
});
GUARDS.push(['fgate', 'forest_gate']);
Object.assign(STAFF_LINES, {
  chaplain: ['Благослови вас Господь, государь.', 'Свечи у алтаря горят за ваше здравие.', 'Молитва короля стоит десятка проповедей.'],
  hunter: ['Олени нынче жирные, государь. Самое время.', 'Гончие застоялись — им бы в лес.', 'Кабан у брода изрыл весь берег.'],
  jailer: ['Сидят тихо, государь. Пока.', 'Ключи при мне, будьте покойны.', 'Крысы — вот кто здесь настоящий хозяин.'],
});
function assignBeds() { let kid = 0, guest = 0;
  for (const n of COURT.npcs) { n.bed = null;
    if (n.seat) n.bed = 'bed_' + n.seat; else if (n.key === 'spouse') n.bed = 'bed_queen';
    else if (n.key.startsWith('kid') || n.key.startsWith('ward')) { if (n.c.age >= 16 && !guest) { n.bed = 'bed_guest'; guest = 1; } else if (kid < 4) n.bed = 'bed_kid' + kid++; }
    else if (n.staff === 'maid') n.bed = 'bed_maid'; else if (n.staff === 'page') n.bed = 'bed_page'; } }
function homeExtras() { // prisoners held by the crown sit in the cells
  const P = G.chars.filter(c => c.alive && c.prison === 0 && c.id !== G.player.char).slice(0, 12);
  P.forEach((c, i) => { const sp = 'cell' + (i % 6) + (i >= 6 ? 'b' : ''); const n = mkNpc('pris' + c.id, c, { pris: 1, post: sp, talkR: 52, sub: 'Узник короны', talk: m => prisonerTalk(m) }); npcPlace(n, spotOf(sp)); n.away = 0; }); projNpcs(); for (const f of POP_EXT) f(); }
function homeAnimals(A) { A('hound', 'yard', [58, 28, 61, 30], 'brown', 2); A('hound', 'yard', [58, 28, 61, 30], 'black', 1); A('hound', 'yard', [58, 28, 61, 30], 'orange', 1);
  A('rat', 'dungeon', [4, 9, 34, 11], null, 3); A('dog', 'hall', [3, 12, 40, 13], null, 1); A('cat', 'upper', [2, 12, 47, 14], null, 1); A('pigeon', 'yard', [52, 9, 70, 11], null, 3); huntFauna(''); }
Object.assign(ANISP, { deer: 30, doe: 30, boar: 26, hare: 34, fox: 32, wolf: 36, bear: 20, pheasant: 16, duck: 8, sheep: 8, cow: 6, pig: 8, goat: 10, rat: 22, hound: 46, falcon: 70 });
