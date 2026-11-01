'use strict';
// ===== BATTLE SCREEN v3: camera & battle map, regiments under captains, formations, orders by courier =====
let FIELD = null, BMINI = null, OVC = null;
const REGD = { C: '1', R: '2', L: '3', V: '4', S: '5' };
const REGC = { C: '#f7d35c', R: '#9fe07a', L: '#8ac8ff', V: '#ffb070', S: '#e8a0ff' };
const ORD_TIP = {
  hold: 'Стоять: держать место. Отряды отбивают подошедших вплотную, стрелки бьют, кого достанут.',
  adv: 'Наступать: полк единым строем идёт на ближайшего врага и вступает в бой.',
  flank: 'Обход: полк обходит крайний отряд врага и бьёт во фланг и тыл. Коннице — с руки, пехоте — долго.',
  skirm: 'Перестрелка: стрелки выходят на выстрел и отходят за свою пехоту, когда к ним рвётся рукопашная.',
  wait: 'Ждать сигнала: полк стоит (в лесу — невидим) и ударит по сигналу рога — или когда враг подойдёт вплотную.',
  pursue: 'Преследовать: гнать бегущих. Больше всего жизней и пленных берут именно в погоне.',
  back: 'Отход: отойти шагов на сто и встать. Из рукопашной уходят под ударами в спину.',
  auto: 'На усмотрение: воевода решает сам — по обстановке и своему умению.',
};
const ORD_BTN = [['hold', 'Стоять'], ['adv', 'Вперёд'], ['flank', 'Обход'], ['skirm', 'Стрелять'], ['wait', 'Ждать'], ['pursue', 'Гнать'], ['back', 'Назад'], ['auto', 'Сами']];
const FORM_TIP = {
  line: 'Строй: обычный порядок — ровно во всём.',
  close: 'Стена щитов: щит к щиту. Держат удар (+35%) и стрелы (−45%), но медленны. Арбалетчики стоят за павезами.',
  loose: 'Рассыпной: стрелы почти не берут (−55%), но рукопашная и конница рвут такой строй.',
  wedge: 'Клин: пробивает строй (атака +25%, натиск конницы сильнее), бока уязвимы.',
  square: 'Ёж: копья во все стороны — ни фланга, ни тыла, конница разбивается. Стоят на месте, а стрелы бьют больно.',
  column: 'Колонна: быстрый марш (+35%), но в бою беззащитна и не стреляет.',
};
const FORM_BTN = [['line', 'Строй'], ['close', 'Стена'], ['loose', 'Россыпь'], ['wedge', 'Клин'], ['square', 'Ёж'], ['column', 'Колонна']];
const TPLS = [['std', 'Обычный', 'Обычный строй: Большой полк в центре, полки правой и левой руки по бокам с конницей на крыльях, Передовой полк стрелков впереди, рыцари Засадного полка в резерве.'],
  ['def', 'Оборона', 'Оборона: копья вперёд стеной щитов, крылья загнуты назад, стрелки за строем. «Сначала сделай себя непобедимым».'],
  ['amb', 'Засада', 'Засада: вся конница Засадного полка скрыта в лесу и ждёт сигнала рога. «Нападай там, где враг не готов».'],
  ['wedge', 'Клин', 'Клин: рыцари и латники клином впереди строя — пробить центр одним ударом.'],
  ['cres', 'Полумесяц', 'Полумесяц: слабый центр отведён назад, сильные крылья выдвинуты — враг втягивается в мешок.']];
function startBattle(A, Bs, tile, o) {
  o = Object.assign({}, o || {}); o.ambush = !!o.amb; o.ai = [false, true];
  BT = setupBattle(A, Bs, tile, o); const B = BT; B.speed = 1; B.weather = weatherOf(); B.sel = []; B.selRegs = []; B.deadN = 0; B.ov = false; B.visRT = 0;
  if (o.amb) for (const u of B.units) if (u.side === 1) u.morale = Math.max(10, u.morale - 20);
  updateVis(B); FIELD = buildField(B.F); BMINI = buildMini(FIELD); OVC = buildOverview(FIELD);
  const z = deployZoneF(B.F, 0); bcamTo(B, (z[0] + z[1]) / 2 + 90, BF.H / 2);
  SCREEN = 'battle'; if (typeof Snd !== 'undefined') Snd.music('battle'); if (typeof TUT !== 'undefined') TUT.ev('battleStart');
}
function buildField(F) {
  useField(F); const [c, g] = mkCanvas(BF.W, BF.H); const img = g.createImageData(BF.W, BF.H); const b = new Uint32Array(img.data.buffer);
  const winter = seasonOf(G.day) === 3 && F.temp < 0.55, base = F.base;
  const pal = winter || base === TR.SNOW ? ['#c8d2d8', '#d8e0e4', '#e8eef2', '#f2f6f8'] : base === TR.STEPPE ? ['#9a9450', '#a8a25a', '#b4ae62', '#c0ba70'] : base === TR.BEACH ? ['#c8b07a', '#d9c48a', '#e2d098', '#ecdcaa'] : base === TR.FARM ? ['#8a9a44', '#9aa84c', '#a8b456', '#b8a850'] : base === TR.MARSH ? ['#4a6440', '#56704a', '#607a52', '#6a845a'] : ['#4f8a3a', '#5a9a40', '#62a044', '#6aaa4a'];
  const P = pal.map(h => rgbOf(h)); const seed = F.tile;
  for (let y = 0; y < BF.H; y++) for (let x = 0; x < BF.W; x++) {
    const i = (y >> 2) * BCW + (x >> 2), k = F.g[i], h = F.hgt[i];
    let n = vnoise(x * 0.04, y * 0.04, seed) * 0.6 + vnoise(x * 0.15, y * 0.15, seed + 1) * 0.4; let ci = clamp(Math.floor(n * 4), 0, 3); let [r, gg, bb] = P[ci];
    let f = 1 + h * 0.07;
    if (h > 0) { const il = ((y - 4) >> 2) * BCW + ((x - 4) >> 2); if (y >= 4 && x >= 4 && F.hgt[il] < h) f += 0.08; const ir = ((y + 4) >> 2) * BCW + ((x + 4) >> 2); if (y < BF.H - 4 && x < BF.W - 4 && F.hgt[ir] < h) f -= 0.1; }
    if (k === GC.ROAD) { const d = rgbOf(winter ? '#b8b0a0' : '#a08a5a'); [r, gg, bb] = d; f *= 0.92 + n * 0.16; }
    else if (k === GC.WATER) { [r, gg, bb] = rgbOf('#3a7eaa'); f = 0.9 + Math.sin(x * 0.3 + y * 0.1) * 0.05 + (hash2(x, y, 5) < 0.02 ? 0.25 : 0); }
    else if (k === GC.FORD) { [r, gg, bb] = rgbOf('#7aa0a0'); f = 0.95 + n * 0.1 + (hash2(x, y, 6) < 0.04 ? -0.2 : 0); }
    else if (k === GC.BRIDGE) { [r, gg, bb] = rgbOf('#8a5a34'); f = (y % 3 === 0) ? 0.75 : 1; }
    else if (k === GC.MARSH) { [r, gg, bb] = rgbOf(n > 0.62 ? '#3e6a72' : '#56704a'); }
    else if (k === GC.FOREST) { f *= 0.78; }
    else if (k === GC.WALL) { [r, gg, bb] = rgbOf('#8a8478'); f = ((x + (y >> 2) * 3) % 6 === 0 || y % 4 === 0) ? 0.7 : 1 - n * 0.1; }
    else if (k === GC.GATE) { [r, gg, bb] = rgbOf('#5a3a20'); f = x % 3 === 0 ? 0.7 : 1; }
    if (F.siege && F.rv && (x >> 2) > F.rv.wall + 2 && k !== GC.WALL && k !== GC.GATE) { [r, gg, bb] = rgbOf('#9a8a70'); f = ((x >> 3) + (y >> 3)) % 2 ? 0.95 : 1.02; }
    if (h > 0 && k !== GC.WATER) { const iu = Math.max(0, (y - 1) >> 2) * BCW + (x >> 2); if (F.hgt[iu] !== h && (y & 3) === 0) f *= 0.85; }
    b[y * BF.W + x] = pack(clamp(r * f, 0, 255) | 0, clamp(gg * f, 0, 255) | 0, clamp(bb * f, 0, 255) | 0);
  }
  for (let y = 1; y < BF.H - 1; y++) for (let x = 1; x < BF.W - 1; x++) { const k = F.g[(y >> 2) * BCW + (x >> 2)]; if (k === GC.WATER) continue; const kl = F.g[(y >> 2) * BCW + ((x - 1) >> 2)], kr = F.g[(y >> 2) * BCW + ((x + 1) >> 2)]; if (kl === GC.WATER || kr === GC.WATER) b[y * BF.W + x] = pack(200, 180, 130); }
  g.putImageData(img, 0, 0);
  const rng = mkRng(F.tile * 13 + 7); const trees = winter ? MSPR.spine : F.temp < 0.4 ? MSPR.pine : MSPR.oak;
  const pts = []; for (let cy = 0; cy < BCH; cy++) for (let cx = 0; cx < BCW; cx++) { const k = F.g[cy * BCW + cx]; if (k === GC.FOREST && rng.f() < 0.55) pts.push([cx * 4 + rng.i(0, 3), cy * 4 + rng.i(0, 3), 't']); else if (k === GC.MARSH && rng.f() < 0.2) pts.push([cx * 4, cy * 4, 'r']); else if (k === GC.OPEN && rng.f() < 0.012) pts.push([cx * 4, cy * 4, rng.f() < 0.5 ? 'k' : 'b']); }
  pts.sort((p, q) => p[1] - q[1]);
  for (const [x, y, t] of pts) { if (t === 't') { const s = trees[rng.i(0, trees.length - 1)]; g.drawImage(s, x - (s.width >> 1), y - s.height + 2); } else if (t === 'r') g.drawImage(rng.pick(MSPR.reed), x, y); else if (t === 'k') g.drawImage(rng.pick(MSPR.rock), x, y); else g.drawImage(rng.pick(winter ? MSPR.rock : MSPR.tuft), x, y); }
  if (F.siege && F.rv) { const wx = F.rv.wall * 4; for (let k = 0; k < 7; k++) { const hx = wx + 30 + (k % 3) * 40 + rng.i(0, 10), hy = 30 + Math.floor(k / 3) * Math.round(BF.H / 3) + rng.i(0, 20); g.fillStyle = '#c8b090'; g.fillRect(hx, hy, 18, 10); g.fillStyle = '#8a3a2a'; g.fillRect(hx - 2, hy - 6, 22, 6); g.fillStyle = '#3a2a20'; g.fillRect(hx + 7, hy + 4, 4, 6); }
    for (let y = 0; y < BF.H; y += 8) { g.fillStyle = '#6a6458'; g.fillRect(wx - 1, y, 3, 4); g.fillStyle = '#a8a294'; g.fillRect(wx + 8, y + 4, 4, 3); } }
  return c;
}
function buildMini(FC) { const w = 96, h = Math.max(20, Math.round(FC.height * 96 / FC.width)); const [c, g] = mkCanvas(w, h); g.imageSmoothingEnabled = true; g.drawImage(FC, 0, 0, w, h); return c; }
// the commander's map: the field shrunk to fit, washed in parchment
function buildOverview(FC) { const sc = Math.min(BF.VW / FC.width, BF.VH / FC.height), w = Math.round(FC.width * sc), h = Math.round(FC.height * sc); const [c, g] = mkCanvas(w, h); g.imageSmoothingEnabled = true; g.drawImage(FC, 0, 0, w, h);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(236,212,160,1)'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(238,222,180,0.28)'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(90,60,30,0.10)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 1); c.sc = sc; return c; }
// ---------- camera ----------
function ovGeo(B) { const sc = Math.min(BF.VW / BF.W, BF.VH / BF.H); return { sc, ox: Math.round((BF.VW - BF.W * sc) / 2), oy: Math.round((BF.VH - BF.H * sc) / 2) }; }
function bcamClamp(B) { B.cam.x = clamp(B.cam.x, 0, Math.max(0, BF.W - BF.VW)); B.cam.y = clamp(B.cam.y, 0, Math.max(0, BF.H - BF.VH)); }
function bcamTo(B, x, y) { B.cam.x = Math.round(x - BF.VW / 2); B.cam.y = Math.round(y - BF.VH / 2); bcamClamp(B); }
function b2s(B, x, y) { if (B.ov) { const o = ovGeo(B); return [o.ox + x * o.sc, BF.Y0 + o.oy + y * o.sc]; } return [x - B.cam.x, y - B.cam.y + BF.Y0]; }
function s2b(B, sx, sy) { if (B.ov) { const o = ovGeo(B); return [(sx - o.ox) / o.sc, (sy - BF.Y0 - o.oy) / o.sc]; } return [sx + B.cam.x, sy - BF.Y0 + B.cam.y]; }
function inView(B, x, y, m) { const [sx, sy] = b2s(B, x, y); m = m || 30; return sx > -m && sx < BF.VW + m && sy > BF.Y0 - m && sy < BF.Y0 + BF.VH + m; }
function sideCol(B, side) { const r = B.sides[side].realm; const d = REALM_DEF[r === undefined ? 6 : r]; return [d.col, d.dark]; }
// what the player knows of a block: 'full' — seen; 'rough' — a scouted shape; 'ghost' — last seen; null — nothing
function knowU(B, u) { if (u.side === 0) return 'full'; if (!bAlive(u)) return null;
  if (B.phase === 'deploy') { if (u.hidden) return B.scout[0] >= 0.75 ? 'rough' : null; return B.scout[0] >= 0.55 ? 'full' : B.scout[0] >= 0.25 ? 'rough' : null; }
  return B.vis[0][u.id] ? 'full' : null; }
// ---------- figures: formation layouts with smooth re-forming ----------
const FSPC = { levy: [5.4, 5.4, 1.8], spear: [4.6, 4.8, 0.4], sword: [5, 5.2, 0.6], archer: [6, 6.4, 1.4], xbow: [5.6, 6, 1], horse: [10, 12, 1.5], harch: [10, 12, 2], knight: [10.5, 12, 1] };
function figCount(B, u) { const M = MOUNTED[u.type], mpf = Math.max(M ? 4 : 5, B.bmax / (M ? 14 : 24)); return clamp(Math.ceil(u.men / mpf), 1, M ? 14 : 26); }
function formSlots(u, n, form) {
  const [sx0, sy0, j0] = FSPC[u.type], M = MOUNTED[u.type], out = [];
  const grid = (files, sx, sy, j) => { const ranks = Math.ceil(n / files); for (let k = 0; k < n; k++) { const f = k % files, r = Math.floor(k / files), inRow = r === ranks - 1 ? n - r * files : files; out.push([(f - (inRow - 1) / 2) * sx + (hash2(u.id, k, 1) - 0.5) * j * 2, ((ranks - 1) / 2 - r) * sy + (hash2(u.id, k, 2) - 0.5) * j * 2]); } };
  if (form === 'close') grid(clamp(Math.ceil(n / 4), 1, 10), sx0 * 0.78, sy0 * 0.8, j0 * 0.3);
  else if (form === 'loose') grid(clamp(Math.ceil(n / 2), 1, 14), sx0 * 1.5, sy0 * 1.5, j0 * 2 + 1);
  else if (form === 'column') grid(M || n <= 8 ? 2 : 3, sx0 * 0.9, sy0 * 0.85, j0 * 0.5);
  else if (form === 'wedge') { let k = 0, r = 0; while (k < n) { const w = 2 * r + 1; for (let i = 0; i < w && k < n; i++, k++) out.push([(i - (w - 1) / 2) * sx0 * 0.85, -r * sy0 * 0.75 + (hash2(u.id, k, 2) - 0.5) * j0]); r++; } const my = out.reduce((s, p) => s + p[1], 0) / out.length; for (const p of out) p[1] -= my; }
  else if (form === 'square') { const s = Math.max(2, Math.ceil(n / 4)), L = s * Math.min(sx0, sy0) * 0.95, per = []; for (let i = 0; i < s; i++) per.push([i / s * 2 - 1, -1], [1, i / s * 2 - 1], [1 - i / s * 2, 1], [-1, 1 - i / s * 2]); for (let k = 0; k < n; k++) { const p = per[Math.floor(k * per.length / n)]; out.push([p[0] * L / 2, p[1] * L / 2]); } }
  else grid(clamp(Math.ceil(n / (M ? 2 : 3)), 1, 12), sx0, sy0, j0);
  return out; }
function unitFigs(B, u, out) {
  const n = figCount(B, u), form = u.state === 'rout' ? 'loose' : (u.formTo || u.form);
  let F = u._fig; if (!F || F.n !== n || F.form !== form) { const tgt = formSlots(u, n, form); if (!F) F = u._fig = { cur: tgt.map(p => p.slice()) }; F.n = n; F.form = form; F.tgt = tgt; while (F.cur.length > n) F.cur.pop(); while (F.cur.length < n) F.cur.push(tgt[F.cur.length].slice()); }
  if (F.t !== NOW) { const a = Math.min(1, (F.t ? NOW - F.t : 1) * 2.5); F.t = NOW; for (let k = 0; k < n; k++) { F.cur[k][0] += (F.tgt[k][0] - F.cur[k][0]) * a; F.cur[k][1] += (F.tgt[k][1] - F.cur[k][1]) * a; } }
  const fx = Math.cos(u.face), fy = Math.sin(u.face), rout = u.state === 'rout', sq = form === 'square' && !u.formTo, fb = n >= 4 && !sq ? Math.floor(n / 2) : -1;
  for (let k = 0; k < n; k++) { const ox = F.cur[k][0], oy = F.cur[k][1]; let px = u.x - fy * ox + fx * oy, py = u.y + fx * ox + fy * oy; if (rout) { px += (hash2(u.id, k, 3) - 0.5) * 16; py += (hash2(u.id, k, 4) - 0.5) * 12; }
    out.push([py, px, u, k, k === fb && !rout, sq ? px < u.x : fx < 0]); } }
function unitAt(B, x, y, side) { let best = null, bd = 1e9; const pad = B.ov ? 4 / ovGeo(B).sc : 4;
  for (const u of B.units) { if (!bAlive(u) || (side !== undefined && u.side !== side)) continue; if (u.side === 1 && knowU(B, u) !== 'full') continue; const d = Math.hypot(u.x - x, u.y - y); if (d < bRad(u) + pad && d < bd) { bd = d; best = u; } } return best; }
// ---------- selection ----------
function selUnits(B) { return B.sel.map(i => B.units[i]).filter(u => u && u.side === 0 && bAlive(u)); }
function selClear(B) { B.sel = []; B.selRegs = []; }
// regiments whose every block is selected are commanded as regiments (through their captains)
function selFix(B) { const s = new Set(B.sel); B.selRegs = REGK.filter(k => { const us = regUnits(B, 0, k, true); return us.length && us.every(u => s.has(u.id)); }); }
function selReg(B, k, add) {
  const us = regUnits(B, 0, k, true); if (!us.length) return;
  if (add && B.selRegs.includes(k)) { B.sel = B.sel.filter(i => B.units[i].reg !== k); selFix(B); return; }
  if (!add) B.sel = []; for (const u of us) if (!B.sel.includes(u.id)) B.sel.push(u.id); selFix(B);
  if (typeof Snd !== 'undefined') Snd.sfx('click'); }
function selSplit(B) { const us = selUnits(B), regs = B.selRegs.filter(k => regUnits(B, 0, k).length); return { regs, blocks: us.filter(u => !regs.includes(u.reg) && u.state !== 'rout'), us }; }
// pass selected blocks to another regiment (Shift+1…5)
function reassign(B, k) {
  const us = selUnits(B).filter(u => u.reg !== k && u.state !== 'rout'); if (!us.length) return; const g = B.regs[0][k], old = new Set(us.map(u => u.reg));
  const had = regUnits(B, 0, k).length; if (!had) { const cx = us.reduce((s, u) => s + u.x, 0) / us.length, cy = us.reduce((s, u) => s + u.y, 0) / us.length; g.ax = cx; g.ay = cy; g.af = us[0].face; if (B.phase === 'fight') { g.order = { k: 'hold' }; g.cur = 'hold'; } }
  for (const u of us) { u.reg = k; u.man = false; setSlot(g, u); }
  for (const q of old.add(k)) { const gq = B.regs[0][q], L = leadOf(B, gq); if (!L || L.reg !== q) { const rest = regUnits(B, 0, q); gq.lead = rest.length ? pickLead(rest).id : -1; } }
  if (B.phase === 'deploy') for (const u of us) hideCheck(B, u);
  selFix(B); bsayUI(B, REGN[k] + ': +' + us.length + ' ' + plural(us.length, 'отряд', 'отряда', 'отрядов'), REGC[k]);
  if (typeof Snd !== 'undefined') Snd.sfx('click'); }
// UI messages work in deploy too (battle time stands still there)
function bsayUI(B, t, c) { B.log.push({ t: B.t, s: t, c: c || '#f7d35c', n0: NOW }); if (B.log.length > 40) B.log.shift(); }
function hideCheck(B, u) { if (u.side !== 0) return; const g = B.regs[0][u.reg]; u.hidden = g.order.k === 'wait' && B.F.g[cellAt(B.F, u.x, u.y)] === GC.FOREST; }
function placeU(B, u, x, y) { const z = deployZoneF(B.F, 0); x = clamp(x, z[0], z[1]); y = clamp(y, 12, BF.H - 12); if (!passCell(B.F, cellAt(B.F, x, y), u)) return false; u.x = x; u.y = y; return true; }
// ---------- orders from the field ----------
function enemyCentre(B) { let x = 0, y = 0, n = 0; for (const u of B.units) if (u.side === 1 && bAlive(u) && (B.vis[0][u.id] || B.phase === 'deploy' && knowU(B, u))) { x += u.x; y += u.y; n++; } return n ? [x / n, y / n] : [BF.W, BF.H / 2]; }
// spread the selection along a dragged line (or keep its shape around a point); facing turns toward the enemy
function placeAlong(B, regs, blocks, x, y, ln) {
  const items = [];
  for (const k of regs) { const g = B.regs[0][k], us = regUnits(B, 0, k); if (!us.length) continue; let lo = 1e9, hi = -1e9, ms = 0, md = 0; for (const u of us) { lo = Math.min(lo, u.sy - bRad(u)); hi = Math.max(hi, u.sy + bRad(u)); ms += u.sy; md += u.sx; }
    items.push({ g, x: g.ax, y: g.ay, f: g.af, w: hi - lo, ms: ms / us.length, md: md / us.length }); }
  for (const u of blocks) items.push({ u, x: u.x, y: u.y, f: u.face, w: 2 * bRad(u), ms: 0, md: 0 });
  if (!items.length) return [];
  if (!ln || Math.hypot(ln[2] - ln[0], ln[3] - ln[1]) < 12) { const cx = items.reduce((s, p) => s + p.x, 0) / items.length, cy = items.reduce((s, p) => s + p.y, 0) / items.length;
    return items.map(p => ({ g: p.g, u: p.u, x: clamp(x + p.x - cx, 12, BF.W - 12), y: clamp(y + p.y - cy, 12, BF.H - 12), f: p.f })); }
  const L = Math.hypot(ln[2] - ln[0], ln[3] - ln[1]), dx = (ln[2] - ln[0]) / L, dy = (ln[3] - ln[1]) / L, E = enemyCentre(B), mx = (ln[0] + ln[2]) / 2, my = (ln[1] + ln[3]) / 2;
  let nx = -dy, ny = dx; if ((E[0] - mx) * nx + (E[1] - my) * ny < 0) { nx = -nx; ny = -ny; } const f = Math.atan2(ny, nx);
  items.sort((p, q) => (p.x * dx + p.y * dy) - (q.x * dx + q.y * dy));
  const gap = 6, tot = items.reduce((s, p) => s + p.w, 0) + gap * (items.length - 1), spare = Math.max(0, L - tot) / Math.max(1, items.length - 1);
  let at = tot > L ? (L - tot) / 2 : 0; if (items.length === 1) at = (L - items[0].w) / 2;
  return items.map(p => { const c = at + p.w / 2; at += p.w + gap + (tot > L ? 0 : spare); let px = ln[0] + dx * c, py = ln[1] + dy * c;
    if (p.g) { const cs = Math.cos(f), sn = Math.sin(f); px -= cs * p.md - sn * p.ms; py -= sn * p.md + cs * p.ms; }
    return { g: p.g, u: p.u, x: clamp(px, 12, BF.W - 12), y: clamp(py, 12, BF.H - 12), f }; }); }
function orderAt(B, x, y, ln) {
  const { regs, blocks } = selSplit(B); if (!regs.length && !blocks.length) return false;
  if (B.phase === 'deploy') { deployMove(B, regs, blocks, x, y, ln); return true; }
  const tgt = ln ? null : pickAt(B, ...b2s(B, x, y), 1);
  if (tgt) { for (const k of regs) issueReg(B, B.regs[0][k], { k: 'attack', t: tgt.id }); for (const u of blocks) { issue(B, u, { k: 'attack', t: tgt.id }); u.man = true; } B.fx.push({ k: 'mark', x: tgt.x, y: tgt.y, c: '#ee7a6a', n0: NOW }); }
  else { for (const p of placeAlong(B, regs, blocks, x, y, ln)) { if (p.g) issueReg(B, p.g, { k: 'move', x: p.x, y: p.y, f: p.f }); else { issue(B, p.u, { k: 'move', x: p.x, y: p.y, f: p.f }); p.u.man = true; } }
    B.fx.push({ k: 'mark', x, y, c: '#fff2c8', n0: NOW }); if (ln) B.fx.push({ k: 'line', x: ln[0], y: ln[1], x1: ln[2], y1: ln[3], c: '#fff2c8', n0: NOW }); }
  if (typeof Snd !== 'undefined') Snd.sfx('horn_short'); if (typeof TUT !== 'undefined') TUT.ev('order'); return true; }
// before the battle orders are instant: regiments and blocks simply stand where they are put
function deployMove(B, regs, blocks, x, y, ln) {
  for (const p of placeAlong(B, regs, blocks, x, y, ln)) {
    if (p.g) { const g = p.g, z = deployZoneF(B.F, 0); g.ax = clamp(p.x, z[0], z[1]); g.ay = p.y; g.af = p.f; for (const u of regUnits(B, 0, g.k)) { const [sx, sy] = slotOf(g, u); if (!placeU(B, u, sx, sy)) placeU(B, u, g.ax, g.ay); u.face = g.af; setSlot(g, u); hideCheck(B, u); } }
    else { const u = p.u; if (placeU(B, u, p.x, p.y)) { u.face = p.f; setSlot(B.regs[0][u.reg], u); hideCheck(B, u); } } }
  if (typeof Snd !== 'undefined') Snd.sfx('click'); }
// a block or banner under the cursor (screen coords)
function pickAt(B, sx, sy, side) {
  if (B._bn) for (let i = B._bn.length - 1; i >= 0; i--) { const r = B._bn[i]; if (sx >= r.x && sx < r.x + r.w && sy >= r.y && sy < r.y + r.h && (side === undefined || r.u.side === side) && bAlive(r.u)) return r.u; }
  const [x, y] = s2b(B, sx, sy); return unitAt(B, x, y, side); }
function bfieldClick(c) {
  const B = BT; if (!B || B.res) return;
  if (c.b === 2) { if (c.drag) { const [x0, y0] = s2b(B, c.x, c.y), [x1, y1] = s2b(B, c.ux, c.uy); orderAt(B, x1, y1, [x0, y0, x1, y1]); } else { const [x, y] = s2b(B, c.ux, c.uy); if (!orderAt(B, x, y)) selClear(B); } return; }
  if (c.drag) return;
  const own = pickAt(B, c.ux, c.uy, 0);
  if (own) { const dbl = B.lastClk && B.lastClk.id === own.id && NOW - B.lastClk.t < 0.4; B.lastClk = { id: own.id, t: NOW };
    if (dbl) selReg(B, own.reg, c.shift);
    else if (c.shift) { const i = B.sel.indexOf(own.id); if (i >= 0) B.sel.splice(i, 1); else B.sel.push(own.id); selFix(B); }
    else { B.sel = [own.id]; selFix(B); }
    if (typeof Snd !== 'undefined') Snd.sfx('click'); return; }
  // left click on the ground or an enemy: an order if something is chosen (as before), else clear
  const [x, y] = s2b(B, c.ux, c.uy);
  if (B.sel.length && B.phase === 'fight') orderAt(B, x, y); else selClear(B);
}
// ---------- raw input: drags, box select, camera ----------
function battleInput(B, dt) {
  const d0 = input.down[0], fieldHov = HOVER && HOVER.id === 'bfield';
  if (d0 && !B.drag && fieldHov && d0.y >= BF.Y0 && d0.y < BF.Y0 + BF.VH && !B.res) {
    const u = B.phase === 'deploy' ? pickAt(B, d0.x, d0.y, 0) : null, [bx, by] = s2b(B, d0.x, d0.y);
    if (u) { const grp = B.sel.includes(u.id) ? selUnits(B) : [u]; if (!B.sel.includes(u.id)) { B.sel = [u.id]; selFix(B); }
      B.drag = { grp: grp.map(v => ({ id: v.id, ox: v.x - bx, oy: v.y - by, x0: v.x, y0: v.y })) }; }
    else B.drag = { box: true, x0: d0.x, y0: d0.y };
  }
  if (B.drag && d0 && d0.moved && B.drag.grp) { const [mx, my] = s2b(B, input.mx, input.my); for (const q of B.drag.grp) { const v = B.units[q.id]; placeU(B, v, mx + q.ox, my + q.oy); } }
  if (!d0 && B.drag) { const dr = B.drag; B.drag = null;
    if (dr.box) { const x0 = Math.min(dr.x0, input.mx), x1 = Math.max(dr.x0, input.mx), y0 = Math.min(dr.y0, input.my), y1 = Math.max(dr.y0, input.my);
      if (x1 - x0 > 4 || y1 - y0 > 4) { const [ax, ay] = s2b(B, x0, y0), [bx2, by2] = s2b(B, x1, y1); const inBox = B.units.filter(u => u.side === 0 && bAlive(u) && u.x >= ax && u.x <= bx2 && u.y >= ay && u.y <= by2).map(u => u.id);
        B.sel = input.held.has('ShiftLeft') || input.held.has('ShiftRight') ? [...new Set(B.sel.concat(inBox))] : inBox; selFix(B); } }
    else if (dr.grp) { const by = {}; for (const q of dr.grp) { const v = B.units[q.id]; (by[v.reg] = by[v.reg] || []).push([v, v.x - q.x0, v.y - q.y0]); }
      for (const k in by) { const g = B.regs[0][k], L = by[k], all = regUnits(B, 0, k, true).length === L.length; if (all) { g.ax += L.reduce((s, p) => s + p[1], 0) / L.length; g.ay += L.reduce((s, p) => s + p[2], 0) / L.length; } for (const [v] of L) { setSlot(g, v); hideCheck(B, v); } } }
  }
  // camera: middle-drag, keys, screen edges; the wheel and Tab switch to the commander's map
  const d1 = input.down[1];
  if (d1 && !B.ov) { if (!B.pan) B.pan = { mx: d1.x, my: d1.y, cx: B.cam.x, cy: B.cam.y }; B.cam.x = B.pan.cx - (input.mx - B.pan.mx); B.cam.y = B.pan.cy - (input.my - B.pan.my); bcamClamp(B); } else B.pan = null;
  if (input.wheel && !UI.modalOpen() && input.my >= BF.Y0 && input.my < BF.Y0 + BF.VH) { if (input.wheel > 0 && !B.ov) B.ov = true; else if (input.wheel < 0 && B.ov) { const [x, y] = s2b(B, input.mx, input.my); B.ov = false; bcamTo(B, x, y); } }
  if (!B.ov && !UI.modalOpen()) { const H0 = input.held, sp = 260 * dt; let vx = 0, vy = 0;
    if (H0.has('KeyA') || H0.has('ArrowLeft')) vx--; if (H0.has('KeyD') || H0.has('ArrowRight')) vx++; if (H0.has('KeyW') || H0.has('ArrowUp')) vy--; if (H0.has('KeyS') || H0.has('ArrowDown')) vy++;
    const m = input.mx, n = input.my, inF = n >= BF.Y0 && n < BF.Y0 + BF.VH && m >= 0 && m < W; let ex = 0, ey = 0;
    if (inF && !input.down[0]) { if (m <= 3) ex = -1; else if (m >= W - 4) ex = 1; if (n <= BF.Y0 + 3) ey = -1; else if (n >= BF.Y0 + BF.VH - 4) ey = 1; }
    if (ex || ey) { B.edgeT = (B.edgeT || 0) + dt; if (B.edgeT > 0.3) { vx += ex; vy += ey; } } else B.edgeT = 0;
    if (vx || vy) { B.cam.x += vx * sp; B.cam.y += vy * sp; bcamClamp(B); } }
}
function battleUpdate(dt) {
  const B = BT; if (!B) return; useField(B.F); battleInput(B, dt);
  if (B.phase === 'fight' && !B.over && B.speed > 0) { let t = Math.min(0.25, dt) * B.speed; const t0 = performance.now(); while (t > 1e-4) { const s = Math.min(0.1, t); bStep(B, s); t -= s; if (B.over || performance.now() - t0 > 40) break; } }
  if (B.phase === 'deploy') { B.visRT -= dt; if (B.visRT <= 0) { B.visRT = 0.5; updateVis(B); } }
  if (B.over && !B.res) finishBattle(B);
  B.arrows = B.arrows.filter(a => B.t < a.t0 + a.d); B.fx = B.fx.filter(f => f.n0 !== undefined ? NOW - f.n0 < 1.6 : B.t - f.t0 < 2); B.couriers = B.couriers.filter(c => B.t < c.t1);
  if (B.phase === 'fight' && !B.over && typeof Snd !== 'undefined') { let n = 0; for (const u of B.units) if (u.contact.length && bAlive(u)) n++; if (n) Snd.battleNoise(n); }
}
function goFight(B) { if (B.phase !== 'deploy') return; B.phase = 'fight'; B.speed = 1; for (const u of B.units) if (u.side === 0) hideCheck(B, u); updateVis(B); B.visT = B.t + 0.5;
  if (typeof Snd !== 'undefined') Snd.sfx('horn'); if (typeof TUT !== 'undefined') TUT.ev('fight'); }
function sigBtn(B) { const n = signal(B, 0); if (!n) bsayUI(B, B.t - B.sigT[0] < 2 ? 'Рог уже трубил.' : 'Ни один полк не ждёт сигнала.', '#c8b898'); }
function rallyBtn(B) { const gu = genOf(B, 0); if (!gu) { bsayUI(B, 'Полководца нет на поле — некому сплотить войско.', '#ee7a6a'); return; } if (gu.state === 'rout') { bsayUI(B, 'Отряд полководца бежит!', '#ee7a6a'); return; }
  if (!rally(B, 0)) bsayUI(B, 'Сплотить снова можно через ' + Math.ceil(30 - (B.t - B.rallyT[0])) + ' с.', '#c8b898'); }
function chargeAll(B) { let n = 0; for (const k of REGK) { const g = B.regs[0][k]; if (!regUnits(B, 0, k).length) continue; issueReg(B, g, { k: RANGED_REG(B, k) ? 'skirm' : 'adv' }); n++; }
  for (const u of B.units) if (u.side === 0) u.man = false; if (n) { bsayUI(B, 'Общий натиск! Все полки — вперёд!', '#f7d35c'); if (typeof Snd !== 'undefined') Snd.sfx('horn'); } }
const RANGED_REG = (B, k) => { const us = regUnits(B, 0, k); return us.length && us.every(u => RANGED[u.type] && u.ammo > 0); };
function fleeField(B) { if (!B.retArm || NOW - B.retArm > 3) { B.retArm = NOW; return; } for (const u of B.units) if (u.side === 0 && bAlive(u)) { u.state = 'rout'; u.routT = B.t; } B.over = { win: 1, retreat: true }; }
function finishBattle(B) {
  const res = applyBattle(B); B.res = res; res.sett = B.o.sett; const gf = B.sides[0].genFate, ef = B.sides[1].genFate;
  const KG = { captured: 'Король попал в плен!', freed: 'Короля едва не схватили — свои отбили!', killed: 'Король тяжело ранен и вынесен с поля.', escaped: B.sides[0].genFlee ? 'Король ушёл с поля боя.' : '' }, EG = { captured: 'Вражеский полководец взят в плен!', freed: 'Вражеского полководца почти взяли — его отбили.', killed: 'Вражеский полководец пал.', escaped: B.sides[1].genFlee ? 'Вражеский полководец бежал с поля.' : '' };
  res.genFate = [gf ? KG[gf] : '', ef ? EG[ef] : ''].filter(Boolean).join(' '); res.genBad = gf === 'captured' || gf === 'killed';
  if (ef === 'captured') { const g = B.sides[1].gen; if (g && g.realm < 5) msg({ kind: 'ransom', from: g.realm, char: g.id, gold: 40 + g.mar * 5, text: rulerOf(g.realm).title + ' ' + rulerOf(g.realm).name + ' предлагает ' + (40 + g.mar * 5) + ' зол. выкупа за полководца ' + g.name + '. Отказ — он останется у нас, и войско врага лишится вождя.', until: G.day + 20 }); }
  B.ov = false; B.sel = []; B.selRegs = [];
  if (typeof TUT !== 'undefined') TUT.ev('battle', res); if (typeof Snd !== 'undefined') Snd.sfx(res.win === 0 ? 'fanfare' : 'defeat');
}
function endBattleScreen() {
  const B = BT, res = B.res; SCREEN = 'map'; BT = null; FIELD = null; BMINI = null; OVC = null; if (typeof Snd !== 'undefined') Snd.music('auto'); autoPause('Битва окончена');
  if (res && res.sett !== undefined && res.win === 0) { const pa = playerArmy(); const S = G.setts[res.sett]; if (pa && S.ctrl !== G.player.realm) captureSett(pa, S, 'штурм'); }
}
function battleKeys() {
  const B = BT; if (!B) { input.keys.length = 0; return; }
  for (const k of input.keys) { const c = k.code;
    if (c === 'KeyM') Snd.toggle(); if (c === 'F3') FPS.show = !FPS.show;
    if (UI.modalOpen() || B.res) continue;
    if (c === 'Space' && B.phase === 'fight') { if (B.speed > 0) { B.lastSp = B.speed; B.speed = 0; } else B.speed = B.lastSp || 1; Snd.sfx('click'); }
    else if ((c === 'Equal' || c === 'NumpadAdd') && B.phase === 'fight') B.speed = B.speed === 0 ? 1 : Math.min(4, B.speed * 2);
    else if ((c === 'Minus' || c === 'NumpadSubtract') && B.phase === 'fight') B.speed = B.speed <= 1 ? 0 : B.speed / 2;
    else if (/^Digit[1-5]$/.test(c)) { const q = REGK[+c.slice(5) - 1]; if (k.shift && B.sel.length) reassign(B, q); else selReg(B, q, k.ctrl); }
    else if (c === 'Tab') B.ov = !B.ov;
    else if (c === 'KeyA' && k.ctrl) { B.sel = B.units.filter(u => u.side === 0 && bAlive(u)).map(u => u.id); selFix(B); }
    else if (c === 'Escape') selClear(B);
    else if (c === 'KeyH' && B.phase === 'fight') sigBtn(B);
    else if (c === 'KeyG' && B.phase === 'fight') rallyBtn(B);
    else if (c === 'Enter' && B.phase === 'deploy') goFight(B);
  }
  input.keys.length = 0;
}
