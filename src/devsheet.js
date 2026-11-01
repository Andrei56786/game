'use strict';
// ===== DEV: art sheets for visual checks (open index.html#art or #art2 ...) =====
let DEVP = 0; const DEVC = [];
function devChars() {
  if (DEVC.length) return DEVC; const roles = [['ruler', 'K', 0, 0, 34], ['consort', 'K', 1, 0, 30], ['heir', 'K', 0, 0, 12], ['child', 'K', 1, 0, 8], ['ruler', 'C', 0, 1, 41], ['ruler', 'R', 0, 2, 58], ['ruler', 'T', 1, 3, 49], ['ruler', 'E', 0, 4, 52],
    ['council', 'K', 0, 0, 52, 'chancellor'], ['council', 'K', 0, 0, 44, 'treasurer'], ['council', 'K', 0, 0, 38, 'marshal'], ['council', 'K', 1, 0, 33, 'eye'], ['council', 'K', 0, 0, 47, 'seneschal'], ['council', 'K', 0, 0, 66, 'magister'], ['council', 'K', 0, 0, 58, 'justice'],
    ['knight', 'K', 0, 0, 28], ['knight', 'K', 1, 0, 26], ['general', 'C', 0, 1, 36], ['merchant', 'R', 0, 2, 45], ['bandit', 'B', 0, 6, 30], ['peasant', 'K', 0, 0, 40], ['peasant', 'K', 1, 0, 24], ['guard', 'K', 0, 0, 30], ['servant', 'K', 1, 0, 20], ['cook', 'K', 0, 0, 50], ['scholar', 'K', 0, 0, 30], ['courtier', 'K', 1, 0, 27], ['courtier', 'K', 0, 0, 35], ['envoy', 'E', 0, 4, 40], ['mentor', 'E', 0, 5, 70], ['lord', 'F', 0, 5, 45], ['knight', 'T', 0, 3, 33]];
  roles.forEach((d, i) => DEVC.push({ id: 900 + i, name: d[0], role: d[0], cul: d[1], fem: d[2], realm: d[3], age: d[4], seat: d[5], pseed: 1000 + i * 7777, traits: i % 3 === 0 ? ['brave', 'wrathful'] : i % 3 === 1 ? ['honest', 'generous'] : ['cunning', 'proud'], alive: 1, prison: -1 }));
  return DEVC;
}
function drawArtSheet() {
  rect(0, 0, W, H, '#2a2230');
  const L = devChars();
  if (DEVP === 0) { L.forEach((c, i) => { const x = 6 + (i % 12) * 52, y = 6 + Math.floor(i / 12) * 62; drawPortrait(c, x, y, 1); txt((c.seat || c.role).slice(0, 9), x + 24, y + 50, '#f4ecd8', { al: 'c', f: 's' }); }); }
  else if (DEVP === 1) { L.slice(0, 12).forEach((c, i) => { const x = 4 + (i % 6) * 106, y = 4 + Math.floor(i / 6) * 100; drawPortrait(c, x, y, 2); }); }
  else if (DEVP === 2) { rect(0, 0, W, H, '#5a8a3a'); L.slice(0, 16).forEach((c, i) => { for (let d = 0; d < 4; d++) for (let f = 0; f < 4; f++) { const x = 4 + (i % 4) * 158 + f * 38 + (d >= 2 ? 0 : 0), y = 4 + Math.floor(i / 4) * 88 + (d % 2) * 0; const s = walkerSprite(c, DIRS[d], f); ctx.drawImage(s, 4 + (i % 8) * 79 + f * 19, 4 + Math.floor(i / 8) * 178 + d * 44, 16 * 1, 32 * 1); } }); }
  else if (DEVP === 3) { rect(0, 0, W, H, '#5a8a3a'); L.slice(0, 10).forEach((c, i) => { for (let d = 0; d < 4; d++) { const s = walkerSprite(c, DIRS[d], (Math.floor(NOW * 6)) % 4); ctx.drawImage(s, 6 + i * 63, 6 + d * 70, 32, 64); } }); ['horse', 'dog', 'cat', 'hen', 'pigeon'].forEach((k, i) => { const s = animalSprite(k, Math.floor(NOW * 4) % 2); ctx.drawImage(s, 6 + i * 70, 296, s.width * 2, s.height * 2); }); }
  else if (typeof drawArtSheet2 === 'function') drawArtSheet2(DEVP);
}
const DEVG = {};
function devGround() {
  if (DEVG.c) return DEVG.c; const w = 40, h = 22, ter = new Uint8Array(w * h).fill(GT.GRASS);
  const R = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ter[y * w + x] = t; };
  R(2, 2, 9, 8, GT.DIRT); R(12, 2, 19, 8, GT.COBBLE); R(22, 2, 29, 8, GT.SAND); R(32, 2, 37, 8, GT.SOIL); R(2, 11, 9, 12, GT.WATER);
  // interior room: walls + floors
  R(12, 10, 39, 21, GT.WALL); R(14, 13, 25, 20, GT.FLAG); R(28, 13, 37, 20, GT.WOOD); R(26, 16, 27, 17, GT.FLAG); R(17, 13, 22, 14, GT.DAIS); R(14, 15, 16, 20, GT.MARBLE);
  const b = new PB(w * CT, h * CT); paintGround(b, ter, w, h, 7); paintWalls(b, ter, w, h, 7, { wains: tx => tx > 26 }); paintCarpet(b, 19 * CT, 15 * CT, 2 * CT, 5 * CT, 'red'); paintRug(b, 30 * CT, 15 * CT, 5 * CT, 4 * CT, 'navy');
  DEVG.c = b.canvas(); return DEVG.c;
}
function drawArtSheet2(p) {
  if (p === 4) { ctx.drawImage(devGround(), 0, 0); return; }
  if (p === 5) { const c = devGround(); ctx.drawImage(c, 180, 140, 320, 180, 0, 0, 640, 360); return; }
  if (p === 6 || p === 7) { rect(0, 0, W, H, '#5e5c72'); const f = Math.floor(NOW * 6) % 4; const H0 = { div: 'pale', ramp: 'navy', ramp2: 'gold', ramp3: 'white', charge: 'stag' };
    const L = [['throne', {}], ['brazier', {}], ['pillar', {}], ['sconce', {}], ['banner', { realm: 0 }], ['housebanner', { house: H0, ck: 'h0' }], ['window', {}], ['window', { night: 1, ck: 'n' }], ['tapestry', {}], ['fireplace', {}], ['bookshelf', { seed: 3 }], ['desk', { candle: 1, ck: 'c' }], ['chair', { dir: 'down' }], ['chair', { dir: 'up', ck: 'u' }], ['chair', { dir: 'left', ck: 'l' }],
      ['ltable', { w: 112, map: 1, ck: 'm' }], ['chest', {}], ['chest', { open: 1, ck: 'o' }], ['gold', { n: 4, ck: 4 }], ['sack', {}], ['barrel', {}], ['crate', {}], ['bed', {}], ['wardrobe', {}], ['candelabra', {}], ['lectern', {}], ['globe', {}], ['mapboard', {}], ['cage', {}], ['armor', {}], ['plant', {}], ['crib', {}], ['toys', {}], ['statue', {}], ['scales', {}]];
    const sc = p === 6 ? 2 : 1; let x = 4, y = 4, rowH = 0;
    for (const [k, o] of L) { const s = objSprite(k, o, ['brazier', 'sconce', 'banner', 'fireplace', 'candelabra', 'cage'].includes(k) ? f : 0); if (x + s.width * sc > W - 4) { x = 4; y += rowH + 6; rowH = 0; } ctx.drawImage(s, x, y, s.width * sc, s.height * sc); x += s.width * sc + 6; rowH = Math.max(rowH, s.height * sc); }
    return; }
  if (typeof drawArtSheet3 === 'function') drawArtSheet3(p);
}
function drawArtSheet3(p) {
  const f = Math.floor(NOW * 6) % 4;
  if (p === 8) { rect(0, 0, W, H, '#469038'); if (!DEVG.k) { const b = new PB(416, 170); DEVG.km = paintKeepFacade(b, 0, 0, 26, 5); DEVG.k = b.canvas(); } ctx.drawImage(DEVG.k, 4, 4); const t = objSprite('gatehouse', {}, f); ctx.drawImage(t, 430, 4); const tw2 = objSprite('tower', {}, 0); ctx.drawImage(tw2, 430, 170); const d = objSprite('dovecote', {}, 0); ctx.drawImage(d, 500, 170); return; }
  if (p === 9 || p === 10) { rect(0, 0, W, H, '#469038'); const sc = p === 9 ? 2 : 1; const L = [['oak', {}], ['fruit', {}], ['pine', {}], ['hedge', { n: 3, ck: 3 }], ['bush', {}], ['bush', { flower: 1, ck: 'f' }], ['flowers', { n: 2, ck: 2 }], ['herbs', {}], ['fountain', {}], ['well', {}], ['dummy', {}], ['target', {}], ['rack', {}], ['lamppost', { lit: 1, ck: 'l' }], ['pole', {}], ['bench', {}], ['hay', {}], ['trough', {}], ['cart', {}], ['woodpile', {}], ['cauldron', {}], ['anvil', {}], ['fence', { n: 2, ck: 2 }], ['fence', { n: 2, v: 1, ck: 'v' }], ['stall', {}]];
    let x = 4, y = 4, rowH = 0; for (const [k, o] of L) { const s = objSprite(k, o, ['fountain', 'pole', 'cauldron'].includes(k) ? f : 0); if (x + s.width * sc > W - 4) { x = 4; y += rowH + 6; rowH = 0; } ctx.drawImage(s, x, y, s.width * sc, s.height * sc); x += s.width * sc + 6; rowH = Math.max(rowH, s.height * sc); } return; }
  if (p === 11) { rect(0, 0, W, H, '#469038'); const B = [{ w: 7, fh: 40, rh: 40, wall: 'stone', roof: 'tile', doors: [[40, 14, 22, 1]], wins: [[14, 12], [80, 12]], chim: 86, seed: 3, shut: 'green', box: 1, sign: [62, 'bread'], ck: 'kit' }, { w: 7, fh: 42, rh: 38, wall: 'plank', roof: 'shake', kind: 'stable', stalls: 3, seed: 4, ck: 'st' }, { w: 7, fh: 40, rh: 40, wall: 'timber', roof: 'slate', kind: 'forge', chim: 20, seed: 5, sign: [86, 'anvil'], ck: 'fo' }, { w: 9, fh: 44, rh: 44, wall: 'timber', roof: 'slate', doors: [[30, 14, 22, 0], [96, 14, 22, 0]], wins: [[10, 12], [52, 12], [74, 12], [120, 12]], seed: 6, shut: 'red', sign: [52, 'sword'], ck: 'bar' }, { w: 6, fh: 38, rh: 40, wall: 'plank', roof: 'thatch', doors: [[38, 16, 24, 0]], wins: [[12, 10]], seed: 7, sign: [12, 'grain'], ck: 'gr' }];
    let x = 4, y = 4; for (const o of B) { const s = objSprite('bld', o, f); if (x + s.width > W) { x = 4; y += 110; } ctx.drawImage(s, x, y); x += s.width + 8; } return; }
}
