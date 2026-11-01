'use strict';
// ===== BATTLE SCREEN 2 (from bscreen.js): drawing the field, panels =====
// ---------- drawing the field ----------
function drawBattle() {
  const B = BT; if (!B) return; useField(B.F); rect(0, 0, W, H, '#1b1420'); const fy = BF.Y0;
  if (B.dead.length > B.deadN) { const g = FIELD.getContext('2d'); for (let i = B.deadN; i < B.dead.length; i++) { const d = B.dead[i]; const [, c1] = sideCol(B, d.side); g.fillStyle = 'rgba(90,20,20,0.5)'; g.fillRect(d.x - 1, d.y, 3, 1); g.fillStyle = c1; g.fillRect(d.x, d.y - 1, 2, 1); g.fillStyle = MOUNTED[d.t] ? '#5c3420' : '#d8b090'; g.fillRect(d.x + 2, d.y - 1, MOUNTED[d.t] ? 2 : 1, 1); } B.deadN = B.dead.length; }
  ctx.save(); ctx.beginPath(); ctx.rect(0, fy, BF.VW, BF.VH); ctx.clip();
  if (B.ov) { const o = ovGeo(B); rect(0, fy, BF.VW, BF.VH, '#3a2e22'); ctx.drawImage(OVC, o.ox, fy + o.oy); }
  else ctx.drawImage(FIELD, Math.round(B.cam.x), Math.round(B.cam.y), BF.VW, BF.VH, 0, fy, BF.VW, BF.VH);
  hit(0, fy, BF.VW, BF.VH, { id: 'bfield', onClick: bfieldClick, tip: () => fieldTip(B) });
  if (B.phase === 'deploy') { const z = deployZoneF(B.F, 0), [x0, y0] = b2s(B, z[0], 0), [x1, y1] = b2s(B, z[1], BF.H); ctx.globalAlpha = 0.12; rect(x0, y0, x1 - x0, y1 - y0, '#a8c8ff'); ctx.globalAlpha = 0.5; vline(Math.round(x1), y0, y1 - y0, '#d8e8ff'); ctx.globalAlpha = 1; }
  B._bn = [];
  const known = [], rough = [];
  for (const u of B.units) { if (!bAlive(u)) continue; const kn = knowU(B, u); if (kn === 'full') known.push(u); else if (kn === 'rough') rough.push(u); }
  // ghosts: where the enemy was last seen
  for (const id in B.ghost[0]) { const gh = B.ghost[0][id], age = B.t - gh.t; if (age > 40) continue; const [sx, sy] = b2s(B, gh.x, gh.y); ctx.globalAlpha = age < 12 ? 0.5 : 0.28;
    if (B.ov) { strokeR(Math.round(sx - 4), Math.round(sy - 3), 8, 6, '#8a3a2a'); } else { rect(sx - 8, sy - 14, 16, 8, PAL.o); rect(sx - 7, sy - 13, 14, 6, '#5a4a44'); spr(UICON[gh.type], sx - 6, sy - 13); txt('?', sx + 1, sy - 12, '#fff', { f: 's' }); }
    ctx.globalAlpha = 1; }
  // scouts' reports before the battle: a shape and a guess of numbers
  for (const u of rough) { const jx = (hash2(u.id, 9, 1) - 0.5) * 30, jy = (hash2(u.id, 9, 2) - 0.5) * 24, [sx, sy] = b2s(B, u.x + jx, u.y + jy), r = B.ov ? 5 : bRad(u);
    ctx.globalAlpha = 0.28; rect(sx - r, sy - r * 0.6, r * 2, r * 1.2, '#6a5a4a'); ctx.globalAlpha = 0.85; rect(sx - 10, sy - r - 10, 20, 8, PAL.o); rect(sx - 9, sy - r - 9, 18, 6, '#5a4a44'); txt('~' + Math.max(50, Math.round(u.men / 50) * 50), sx - 8, sy - r - 8, '#e8dcc0', { f: 's' }); ctx.globalAlpha = 1; }
  if (B.ov) drawTokens(B, known); else drawFigures(B, known);
  // selection, orders, regiment anchors
  const selS = new Set(B.sel);
  for (const k of B.selRegs) { const g = B.regs[0][k], us = regUnits(B, 0, k); if (!us.length) continue; const [ax, ay] = b2s(B, g.ax, g.ay), cx = us.reduce((s, u) => s + u.x, 0) / us.length, cy = us.reduce((s, u) => s + u.y, 0) / us.length, [csx, csy] = b2s(B, cx, cy), o = g.pend ? g.pend.ord : g.order;
    if (o.k === 'attack' && B.units[o.t]) { const t = B.units[o.t], [tx, ty] = b2s(B, t.x, t.y); line(csx, csy, tx, ty, 'rgba(238,122,106,0.65)', 3); }
    else if (Math.hypot(ax - csx, ay - csy) > 10) line(csx, csy, ax, ay, 'rgba(255,242,200,0.45)', 3);
    rect(ax - 2, ay - 2, 5, 5, PAL.o); rect(ax - 1, ay - 1, 3, 3, REGC[k]); line(ax, ay, ax + Math.cos(g.af) * 9, ay + Math.sin(g.af) * 9, REGC[k]); }
  for (const id of selS) { const u = B.units[id]; if (!u || !bAlive(u)) continue; const [sx, sy] = b2s(B, u.x, u.y), r = Math.max(4, Math.round(bRad(u) * (B.ov ? ovGeo(B).sc : 1)));
    ctx.globalAlpha = 0.65; ring(Math.round(sx), Math.round(sy), r + 2, B.selRegs.includes(u.reg) ? REGC[u.reg] : '#fff2c8'); ctx.globalAlpha = 1;
    if (u.man && u.order) { if (u.order.k === 'move') { const [tx, ty] = b2s(B, u.order.x, u.order.y); line(sx, sy, tx, ty, 'rgba(255,242,200,0.5)', 3); } else if (u.order.k === 'attack' && B.units[u.order.t]) { const t = B.units[u.order.t], [tx, ty] = b2s(B, t.x, t.y); line(sx, sy, tx, ty, 'rgba(238,122,106,0.6)', 3); } } }
  if (!B.ov) for (const u of known) drawBanner(B, u);
  else drawRegLabels(B);
  // the right-drag line: where the selection will stand and which way it will face
  const d2 = input.down[2]; if (d2 && d2.moved && B.sel.length && !B.res) { line(d2.x, d2.y, input.mx, input.my, '#fff2c8', 2); const [x0, y0] = s2b(B, d2.x, d2.y), [x1, y1] = s2b(B, input.mx, input.my), L = Math.hypot(x1 - x0, y1 - y0);
    if (L > 6) { const E = enemyCentre(B); let nx = -(y1 - y0) / L, ny = (x1 - x0) / L; if ((E[0] - (x0 + x1) / 2) * nx + (E[1] - (y0 + y1) / 2) * ny < 0) { nx = -nx; ny = -ny; } for (const t of [0, 0.5, 1]) { const px0 = d2.x + (input.mx - d2.x) * t, py0 = d2.y + (input.my - d2.y) * t; line(px0, py0, px0 + nx * 7, py0 + ny * 7, '#fff2c8'); } } }
  // couriers riding with orders
  for (const c of B.couriers) { if (c.side !== 0) continue; const u = B.units[c.u]; if (!u) continue; const t = clamp((B.t - c.t0) / Math.max(0.01, c.t1 - c.t0), 0, 1), [sx, sy] = b2s(B, c.x0 + (u.x - c.x0) * t, c.y0 + (u.y - c.y0) * t); rect(sx - 1, sy - 2, 3, 3, PAL.o); px(sx, sy - 1, '#f7d35c'); }
  // arrows and bolts
  if (!B.ov) for (const a of B.arrows) { if (B.t < a.t0) continue; const t = (B.t - a.t0) / a.d, arc = a.arc || 26, x = a.x0 + (a.x1 - a.x0) * t, y = a.y0 + (a.y1 - a.y0) * t - Math.sin(t * Math.PI) * arc; if (!inView(B, x, y, 6)) continue;
    const vx = a.x1 - a.x0, vy = (a.y1 - a.y0) - Math.cos(t * Math.PI) * arc * Math.PI, L = Math.hypot(vx, vy) || 1, [sx, sy] = b2s(B, x, y), k = a.xb ? 3 : 4; line(sx, sy, sx - vx / L * k, sy - vy / L * k, a.xb ? '#22160e' : '#3a2a1a'); }
  for (const f of B.fx) { const ui = f.n0 !== undefined, age = ui ? NOW - f.n0 : B.t - f.t0, a = 1 - age / (ui ? 1.6 : 2); if (!inView(B, f.x, f.y, 20)) continue; ctx.globalAlpha = clamp(a, 0, 1); const [sx, sy] = b2s(B, f.x, f.y);
    if (f.k === 'txt') txt(f.t, sx, sy - age * 8, f.c, { al: 'c', sh: PAL.o, f: B.ov ? 's' : 'm' }); else if (f.k === 'mark') ring(Math.round(sx), Math.round(sy), 3 + Math.round(age * 4), f.c); else if (f.k === 'line') { const [ex, ey] = b2s(B, f.x1, f.y1); line(sx, sy, ex, ey, f.c, 2); } ctx.globalAlpha = 1; }
  if (B.drag && B.drag.box && input.down[0] && input.down[0].moved) strokeR(Math.min(B.drag.x0, input.mx), Math.min(B.drag.y0, input.my), Math.abs(input.mx - B.drag.x0), Math.abs(input.my - B.drag.y0), '#fff2c8');
  drawHerald(B);
  if (B.phase === 'deploy') txt('Расстановка: тащите отряды в своей зоне · ПКМ — поставить выбранных · протяните ПКМ — линия фронта · 2×ЛКМ — весь полк', 6, fy + BF.VH - (B.ov ? 19 : 9), B.ov ? '#3a2614' : '#fff2c8', B.ov ? { f: 's' } : { sh: PAL.o, f: 's' });
  if (B.ov) txt('Карта полководца · колесо вверх или Tab — назад к войскам', BF.VW / 2, fy + BF.VH - 9, '#3a2614', { al: 'c', f: 's' });
  if (B.speed === 0 && B.phase === 'fight' && !B.res) txt('ПАУЗА — отдавайте приказы', BF.VW / 2, fy + 5, '#fff2c8', { al: 'c', sh: PAL.o });
  ctx.restore();
  drawBattleTop(B); drawBattleBottom(B);
  if (B.res) drawBattleEnd(B);
}
function drawFigures(B, known) {
  const figs = []; for (const u of known) if (inView(B, u.x, u.y, 40)) unitFigs(B, u, figs);
  figs.sort((p, q) => p[0] - q[0]);
  for (const [py, pxx, u, k, fb, flip] of figs) { const [c0, c1] = sideCol(B, u.side), FR = figFrames(u.type, c0, c1); let fr = figFrameFor(B, u, k);
    if (fb && !(charger(u) && u.ch > 0.25)) fr = Math.sin(NOW * 3.2 + u.id) > 0 ? 'flag1' : 'flag2';
    const s = FR[fr] || FR.stand, mv = u.state === 'move' || u.state === 'rout', bob = mv && !MOUNTED[u.type] ? Math.round(Math.abs(Math.sin(NOW * 9 + k * 1.7)) * 0.8) : 0, [sx, sy] = b2s(B, pxx, py);
    if (u.hidden || u.state === 'rout') ctx.globalAlpha = u.hidden ? 0.5 : 0.8; spr(s, Math.round(sx - (flip ? s.width - 1 - s.cx : s.cx)), Math.round(sy - s.fy - bob), { flip }); ctx.globalAlpha = 1; } }
// the commander's map: blocks as tokens, facing marked
function drawTokens(B, known) { const sc = ovGeo(B).sc;
  for (const u of known) { const [sx, sy] = b2s(B, u.x, u.y), [c0, c1] = sideCol(B, u.side), r = Math.max(4, bRad(u) * sc), fx = Math.cos(u.face), fy = Math.sin(u.face);
    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(u.face); ctx.globalAlpha = u.state === 'rout' ? 0.5 : u.hidden ? 0.6 : 1;
    const dw = MOUNTED[u.type] ? r * 1.1 : r * 0.8; ctx.fillStyle = PAL.o; ctx.fillRect(-dw / 2 - 1, -r - 1, dw + 2, 2 * r + 2); ctx.fillStyle = c1; ctx.fillRect(-dw / 2, -r, dw, 2 * r); ctx.fillStyle = c0; ctx.fillRect(dw / 2 - 2, -r, 2, 2 * r);
    ctx.restore(); ctx.globalAlpha = 1; spr(UICON[u.type], Math.round(sx - 2 - fx), Math.round(sy - 2 - fy));
    if (u.gen) spr('i_crown', Math.round(sx - 3), Math.round(sy - r - 7));
    B._bn.push({ u, x: sx - r, y: sy - r, w: 2 * r, h: 2 * r }); } }
function drawRegLabels(B) { for (const k of REGK) { const us = regUnits(B, 0, k); if (!us.length) continue; const cx = us.reduce((s, u) => s + u.x, 0) / us.length, cy = Math.min(...us.map(u => u.y - bRad(u))), [sx, sy] = b2s(B, cx, cy);
  txt(REGD[k] + ' ' + REGS[k], sx, sy - 9, REGC[k], { al: 'c', f: 's', sh: PAL.o }); } }
function drawBanner(B, u) {
  const own = u.side === 0, [, c1] = sideCol(B, u.side), [sx, sy] = b2s(B, u.x, u.y); if (!inView(B, u.x, u.y, 30)) return;
  const bw = 28, bx = Math.round(sx - bw / 2), by = Math.round(sy - bRad(u) - 15), g = B.regs[u.side][u.reg];
  if (u.hidden) ctx.globalAlpha = 0.6;
  rect(bx, by, bw, 9, PAL.o); rect(bx + 1, by + 1, bw - 2, 7, c1); rect(bx + 1, by + 1, 6, 7, own ? REGC[u.reg] : '#3a1a1a'); txt(own ? REGD[u.reg] : '·', bx + 3, by + 2, own ? PAL.o : '#ffb4a8', { f: 's' });
  spr(UICON[u.type], bx + 8, by + 2); txt(String(Math.round(u.men)), bx + 15, by + 2, '#fff', { f: 's' });
  bar(bx, by + 9, bw, 3, u.morale / 100, u.morale < 30 ? '#c0353f' : u.morale < 55 ? '#d8a040' : '#7fb04c');
  if (u.gen) spr('i_crown', bx + bw / 2 - 3, by - 7);
  else if (own && g.lead === u.id && cmdOk(g)) { vline(bx + bw - 3, by - 6, 6, '#3a2a1a'); rect(bx + bw - 2, by - 6, 4, 3, REGC[u.reg]); }
  if (u.formTo) { const ph = Math.floor(NOW * 4) % 3; for (let i = 0; i < 3; i++) px(bx + 2 + i * 3, by - 2, i === ph ? '#fff2c8' : '#8a7a60'); }
  if (own && (u.pend || u.pendF || (g.pend && g.lead === u.id)) && Math.sin(NOW * 8) > 0) spr('i_raven', bx + bw + 1, by);
  if (u.man && own) px(bx + bw - 2, by + 1, '#fff2c8');
  ctx.globalAlpha = 1; B._bn.push({ u, x: bx, y: by, w: bw, h: 12 }); }
// the herald: what happens out of sight
function drawHerald(B) { const L = B.log.filter(l => (l.n0 !== undefined ? NOW - l.n0 : B.t - l.t) < 6 && (l.x === undefined || !inView(B, l.x, l.y, -20) || B.ov)).slice(-3);
  L.forEach((l, i) => { const age = l.n0 !== undefined ? NOW - l.n0 : B.t - l.t; ctx.globalAlpha = clamp(6 - age, 0, 1); txt(l.s, 6, BF.Y0 + 4 + i * 10, l.c, { sh: PAL.o }); ctx.globalAlpha = 1; }); }
function fieldTip(B) { if (B.drag || input.down[2]) return null; const u = pickAt(B, input.mx, input.my); if (u) return bUnitTip(B, u);
  const [x, y] = s2b(B, input.mx, input.my); for (const id in B.ghost[0]) { const gh = B.ghost[0][id]; if (Math.hypot(gh.x - x, gh.y - y) < 12) return [UNIT[gh.type].n + ' (враг) — видели ' + Math.round(B.t - gh.t) + ' с назад', { t: 'Около ' + Math.round(gh.men) + ' воинов. Где они сейчас — неизвестно.', c: UIC.dim }]; }
  return null; }
const TRN0 = { brave: 'храбрый', cautious: 'осторожный', reckless: 'горячий', craven: 'робкий', cunning: 'хитрый', strategist: 'стратег' };
const trN = t => TRN0[t] || (typeof TRAITS !== 'undefined' && TRAITS[t] ? TRAITS[t].n.toLowerCase() : '');
function bUnitTip(B, u) {
  const own = u.side === 0, g = B.regs[u.side][u.reg], c = g.cmd, st = { idle: 'стоят', move: 'идут', melee: 'в рукопашной', rout: 'БЕГУТ' }[u.state] || u.state;
  const L = [UNIT[u.type].n + (own ? '' : ' (враг)') + ' · ' + formName(u.type, u.formTo || u.form) + (u.formTo ? ' (перестраиваются)' : ''), Math.round(u.men) + ' из ' + u.men0 + ' · дух ' + Math.round(u.morale) + ' · устал. ' + Math.round(u.fat) + ' · ' + st];
  if (RANGED[u.type]) L.push((u.type === 'xbow' ? 'Болтов' : 'Стрел') + ' на ' + Math.round(u.ammo) + ' залп.');
  if (own) { L.push({ t: REGN[u.reg] + (c ? ' · ' + capName(c) + ' (воин. ' + c.mar + ')' : ' · без воеводы'), c: REGC[u.reg] });
    L.push({ t: u.man ? 'Под вашим приказом. «В полк» — вернуть воеводе.' : 'Приказ полка: ' + (ORDN[g.cur] || g.cur), c: UIC.dim }); if (u.formLock) L.push({ t: 'Строй задан вами — воевода его не меняет.', c: UIC.dim }); }
  if (u.gen) L.push({ t: own ? 'Здесь полководец: гонцы скачут от него.' : 'Здесь вражеский полководец.', c: PAL.y });
  if (own && (u.pend || u.pendF)) L.push({ t: 'Гонец с приказом в пути…', c: UIC.warn });
  if (u.hidden) L.push({ t: own ? 'Скрыты в лесу: враг их не видит.' : 'Засада!', c: '#9fe07a' });
  return L; }
// ---------- panels ----------
function drawBattleTop(B) {
  rect(0, 0, W, BF.Y0, '#2a1d16'); hline(0, BF.Y0 - 1, W, '#6a4428');
  const side = s => { let m = 0, m0 = 0, mor = 0, n = 0; for (const u of B.units) if (u.side === s) { m += Math.max(0, u.men); m0 += u.men0; if (bAlive(u) && (s === 0 || B.phase === 'fight' || knowU(B, u))) { mor += u.morale; n++; } } return { m: Math.round(m), m0, mor: n ? mor / n : 0 }; };
  const a = side(0), b = side(1), seen = B.phase === 'fight' || B.scout[0] >= 0.55;
  spr('shield' + (B.sides[0].realm || 0), 4, 4); txt(B.sides[0].name || 'Мы', 18, 3, '#cfe2ff'); txt(a.m + ' / ' + a.m0, 18, 12, PAL.w, { f: 's' }); bar(80, 13, 70, 5, a.mor / 100, '#7fb04c');
  const rr = B.sides[1].realm === undefined ? 6 : B.sides[1].realm; spr('shield' + rr, W - 16, 4); txt(B.sides[1].name || 'Враг', W - 20, 3, '#ffb4a8', { al: 'r' });
  txt(seen ? b.m + ' / ' + b.m0 : '~' + Math.round(b.m0 / 100) * 100 + '?', W - 20, 12, PAL.w, { al: 'r', f: 's' }); if (seen) bar(W - 150, 13, 70, 5, b.mor / 100, '#c0353f');
  const tt = Math.floor(B.t), mm = s => Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2);
  txt((B.phase === 'deploy' ? 'Расстановка' : 'Бой ' + mm(tt) + ' из ' + mm(B.tl)) + ' · ' + B.weather.n + ' · поле ' + { S: 'малое', M: 'среднее', L: 'большое' }[B.F.size || 'S'], W / 2, 4, PAL.y, { al: 'c' });
  if (B.phase === 'fight') { const st = B.stance[1]; txt(B.F.siege ? 'Штурм' : 'Враг ' + (st === 'attack' ? 'наступает' : 'выжидает') + ' · шаблон: ' + tplName(B.tpl[1], B.vis && B.t > 20), W / 2, 13, '#c8b898', { al: 'c', f: 's' }); }
  else txt('Разведка: ' + scoutWord(B.scout[0]), W / 2, 13, '#c8b898', { al: 'c', f: 's' });
}
const tplName = (k, known) => known ? ({ std: 'обычный строй', def: 'оборона', amb: 'засада?', wedge: 'клин', cres: 'полумесяц', wall: 'на стенах' }[k] || k) : 'неясен';
const scoutWord = s => s >= 0.75 ? 'видим всё, даже засады' : s >= 0.55 ? 'враг виден целиком' : s >= 0.25 ? 'видны лишь очертания войска' : 'о враге ничего не известно — нужна лёгкая конница';
function drawBattleBottom(B) {
  const y = BF.Y0 + BF.VH; rect(0, y, W, H - y, '#2a1d16'); hline(0, y, W, '#6a4428');
  if (B.res) return;
  if (B.phase === 'deploy') drawDeployPanel(B, y); else drawFightPanel(B, y);
}
const fitT = (s, w, o) => { s = String(s); if (tw(s, o) <= w) return s; while (s.length > 1 && tw(s + '…', o) > w) s = s.slice(0, -1); return s + '…'; };
function regTypes(us) { const m = {}; for (const u of us) m[u.type] = (m[u.type] || 0) + u.men; return Object.keys(m).sort((a, b) => m[b] - m[a]); }
const DEP_ORD = k => ['hold', 'adv', 'wait', 'auto'].concat(k === 'V' ? ['skirm'] : [], k === 'R' || k === 'L' || k === 'S' ? ['flank'] : []);
function drawDeployPanel(B, y) {
  txt('Построение:', 4, y + 6, '#c8b898', { f: 's' });
  TPLS.forEach(([k, l, tip], i) => { const dis = k === 'amb' && !B.F.forest[0]; btn('bd_' + k, 52 + i * 58, y + 3, 56, 13, { label: l, active: B.tpl[0] === k, disabled: dis || !!B.F.siege, tip: B.F.siege ? 'При штурме полки строятся у стен.' : dis ? 'Нет леса рядом — засада невозможна.' : tip, onClick: () => { deployRegs(B, 0, k); selClear(B); updateVis(B); } }); });
  formRow(B, y + 3, 346, 46, 13, false);
  REGK.forEach((k, i) => regCardBig(B, k, 4 + i * 100, y + 19));
  btn('bd_go', 506, y + 19, 130, 24, { label: 'К бою!', ic: 'i_sword', tip: 'Начать сражение (Enter). Дальше приказы повезут гонцы.', onClick: () => goFight(B) });
  para('Дальше полки ведут воеводы — каждый как умеет.', 506, y + 47, 130, '#9a8a70', { f: 's', lh: 7 });
}
function regCardBig(B, k, x, y) {
  const w = 98, h = 44, g = B.regs[0][k], us = regUnits(B, 0, k, true), sel = B.selRegs.includes(k), c = g.cmd, empty = !us.length, id = 'rc' + k;
  panelDark(x, y, w, h, sel || hov(id)); rect(x + 1, y + 1, 2, h - 2, empty ? '#4a3a30' : REGC[k]); if (sel) strokeR(x, y, w, h, REGC[k]);
  hit(x, y, w, h, { id, cursor: !empty, tip: () => regTip(B, k), onClick: c2 => { if (!empty) selReg(B, k, c2.shift); } });
  txt(REGD[k], x + 6, y + 3, REGC[k], { sh: PAL.o }); txt(REGS[k], x + 14, y + 3, empty ? '#7a6a5a' : PAL.y);
  if (c) { drawPortrait(captChar(c), x + 5, y + 12, 1 / 3); strokeR(x + 4, y + 11, 18, 18, c.gen ? '#f7d35c' : '#6a4a30');
    txt(fitT(capName(c), w - 27, { f: 's' }), x + 25, y + 13, c.gen ? '#f7d35c' : PAL.w, { f: 's' }); txt(fitT('воин. ' + c.mar + (c.tr && c.tr.length && trN(c.tr[0]) ? ' · ' + trN(c.tr[0]) : ''), w - 27, { f: 's' }), x + 25, y + 21, '#c8b898', { f: 's' }); }
  else txt('без воеводы', x + 6, y + 15, UIC.bad, { f: 's' });
  if (empty) { txt('нет отрядов', x + 25, y + 30, '#7a6a5a', { f: 's' }); }
  else { const men = Math.round(us.reduce((s, u) => s + u.men, 0)); txt(String(men), x + 25, y + 30, PAL.w, { f: 's' }); regTypes(us).slice(0, 5).forEach((t, i) => spr(UICON[t], x + 46 + i * 8, y + 29));
    const ords = DEP_ORD(k), cur = g.order.k; btn('ro' + k, x + 3, y + h - 7, w - 6, 6, { label: '', style: 'dark', tip: ['Приказ полку: ' + ORDN[cur] + ' (щелчок — сменить)', { t: ORD_TIP[cur] || '', c: UIC.dim }], onClick: () => { const n = ords[(ords.indexOf(cur) + 1) % ords.length]; setRegOrder(B, g, { k: n }); for (const u of regUnits(B, 0, k)) hideCheck(B, u); } });
    txt(ORDN[cur], x + w / 2, y + h - 6, '#fff2c8', { al: 'c', f: 's' }); }
  // pass the chosen blocks to this regiment
  const mv = selSplit(B).blocks.filter(u => u.reg !== k); if (mv.length && !B.selRegs.includes(k)) btn('ra' + k, x + w - 13, y + 2, 11, 9, { label: '+', style: 'dark', tip: 'Перевести выбранные отряды (' + mv.length + ') в ' + REGN[k] + ' (Shift+' + REGD[k] + ').', onClick: () => reassign(B, k) });
}
function regTip(B, k) { const g = B.regs[0][k], us = regUnits(B, 0, k, true), c = g.cmd; const L = [REGD[k] + ' · ' + REGN[k]];
  if (c) L.push({ t: (c.gen ? 'Ведёт сам полководец: ' : 'Воевода: ') + capName(c) + ', воинское умение ' + c.mar + (c.tr && c.tr.length ? ', ' + c.tr.map(trN).filter(Boolean).join(', ') : ''), c: c.gen ? PAL.y : PAL.w }); else L.push({ t: 'Без воеводы: полк действует вяло и медленно.', c: UIC.bad });
  if (us.length) { const m = {}; for (const u of us) m[u.type] = (m[u.type] || 0) + u.men; L.push(Object.keys(m).map(t => UNIT[t].n + ' ' + Math.round(m[t])).join(', ')); }
  L.push({ t: 'Приказ: ' + (ORDN[g.pend ? g.pend.ord.k : g.order.k] || '') + (g.pend ? ' (гонец в пути)' : '') + (B.phase === 'fight' && g.cur !== g.order.k ? ' — сейчас: ' + (ORDN[g.cur] || g.cur).toLowerCase() : ''), c: UIC.dim });
  L.push({ t: 'Щелчок или ' + REGD[k] + ' — выбрать полк; Shift — добавить.', c: UIC.dim }); return L; }
function regCardSmall(B, k, x, y) {
  const w = 76, h = 30, g = B.regs[0][k], us = regUnits(B, 0, k, true), sel = B.selRegs.includes(k), c = cmdOk(g), empty = !us.length, id = 'rc' + k;
  panelDark(x, y, w, h, sel || hov(id)); rect(x + 1, y + 1, 2, h - 2, empty ? '#4a3a30' : REGC[k]); if (sel) strokeR(x, y, w, h, REGC[k]);
  hit(x, y, w, h, { id, cursor: !empty, tip: () => regTip(B, k), onClick: c2 => { if (!empty) selReg(B, k, c2.shift); } });
  txt(REGD[k], x + 6, y + 3, REGC[k], { sh: PAL.o }); txt(fitT(REGS[k], w - 17, { f: 's' }), x + 13, y + 4, empty ? '#7a6a5a' : PAL.y, { f: 's' });
  if (empty) { txt('разбит', x + 13, y + 14, '#7a6a5a', { f: 's' }); return; }
  const men = us.reduce((s, u) => s + u.men, 0), act = us.filter(u => u.state !== 'rout'), mor = act.length ? act.reduce((s, u) => s + u.morale, 0) / act.length : 0;
  const ms = String(Math.round(men)), mw = tw(ms, { f: 's' }); txt(ms, x + w - 4, y + 10, PAL.w, { al: 'r', f: 's' }); bar(x + 5, y + 12, w - 12 - mw, 3, mor / 100, mor < 30 ? '#c0353f' : mor < 55 ? '#d8a040' : '#7fb04c');
  const rt = us.length - act.length; txt(fitT((g.pend ? '→ ' + ORDN[g.pend.ord.k] : ORDN[g.cur] || g.cur) + (rt ? ' · бегут ' + rt : ''), w - (g.pend ? 20 : 10), { f: 's' }), x + 6, y + 17, g.pend ? UIC.warn : rt ? '#ee7a6a' : '#fff2c8', { f: 's' });
  txt(c ? fitT(capName(c), w - 10, { f: 's' }) : 'без воеводы!', x + 6, y + 23, c ? '#9a8a70' : UIC.bad, { f: 's' });
  if (g.pend && Math.sin(NOW * 8) > 0) spr('i_raven', x + w - 10, y + 15);
}
// formation buttons for whatever is chosen
function formRow(B, y, x0, bw, bh, unlock) {
  const us = selUnits(B).filter(u => u.state !== 'rout');
  FORM_BTN.forEach(([k, l], i) => { const ok = us.filter(u => FORM_OK[u.type].includes(k)), cur = ok.length && ok.every(u => (u.formTo || u.form) === k);
    btn('bf_' + k, x0 + i * (bw + 2), y, bw, bh, { label: l, active: cur, disabled: !ok.length, tip: [FORM_TIP[k], { t: !us.length ? 'Сначала выберите полк или отряды.' : ok.length < us.length ? 'Встанут ' + ok.length + ' из ' + us.length + ' отрядов: не всем этот строй по силам.' : B.phase === 'fight' ? 'Перестроение займёт несколько секунд — и приказ ещё должен довезти гонец.' : '', c: UIC.dim }], onClick: () => { for (const u of ok) issueForm(B, u, k, true); } }); });
  if (unlock) { const lk = us.filter(u => u.formLock); btn('bf_auto', x0 + 6 * (bw + 2), y, bw, bh, { label: 'Сами', disabled: !lk.length, tip: 'Пусть воеводы сами выбирают строй по обстановке: стена против стрел, ёж против конницы, колонна на марше.', onClick: () => { for (const u of lk) issueForm(B, u, null, false); } }); }
}
function drawFightPanel(B, y) {
  REGK.forEach((k, i) => regCardSmall(B, k, 4 + i * 79, y + 3));
  const { regs, blocks, us } = selSplit(B);
  if (regs.length) { const hasR = regs.some(k => regUnits(B, 0, k).some(u => RANGED[u.type] && u.ammo > 0));
    ORD_BTN.forEach(([k, l], i) => { const dis = k === 'skirm' && !hasR, act = regs.every(q => { const g = B.regs[0][q]; return (g.pend ? g.pend.ord.k : g.order.k) === k; });
      btn('bo_' + k, 4 + i * 49, y + 36, 48, 14, { label: l, active: act, disabled: dis, tip: [ORD_TIP[k], { t: 'Приказ повезёт гонец от полководца к воеводе — чем дальше, тем дольше.', c: UIC.dim }], onClick: () => { for (const q of regs) { const g = B.regs[0][q]; if (k === 'hold') { const m = regUnits(B, 0, q); issueReg(B, g, { k: 'hold', x: m.reduce((s, u) => s + u.x, 0) / m.length, y: m.reduce((s, u) => s + u.y, 0) / m.length, re: true }); } else issueReg(B, g, { k }); } if (typeof Snd !== 'undefined') Snd.sfx('horn_short'); if (typeof TUT !== 'undefined') TUT.ev('order'); } }); }); }
  else if (blocks.length) { const S = (i, id, l, f, tip) => btn(id, 4 + i * 98, y + 36, 96, 14, { label: l, onClick: () => { f(); if (typeof Snd !== 'undefined') Snd.sfx('horn_short'); }, tip });
    S(0, 'bb_hold', 'Стоять', () => blocks.forEach(u => { issue(B, u, { k: 'move', x: u.x, y: u.y, f: u.face }); u.man = true; }), 'Отряды встанут, где стоят, — воевода ими больше не распоряжается.');
    S(1, 'bb_atk', 'В атаку', () => blocks.forEach(u => { const e = enemyOf(B, u); if (e) { issue(B, u, { k: 'attack', t: e.id }); u.man = true; } }), 'Атаковать ближайшего видимого врага.');
    S(2, 'bb_back', 'Отход', () => blocks.forEach(u => { issue(B, u, { k: 'move', x: clamp(u.x - 70, 14, BF.W - 14), y: u.y, f: u.face, dis: 1 }); u.man = true; }), ['Отойти назад шагов на семьдесят.', { t: 'Выйти можно и из рукопашной — но враг будет рубить в спину.', c: UIC.dim }]);
    S(3, 'bb_reg', 'В полк', () => blocks.forEach(u => { u.man = false; }), 'Вернуть отряды под начало воеводы их полка — пусть снова держат своё место в строю.'); }
  else para('Выберите полк: карточка, цифра 1–5 или двойной щелчок по отряду. Отряд — щелчок или рамка. ПКМ — приказ, протянуть ПКМ — линия фронта.', 4, y + 36, 392, '#9a8a70', { f: 's', lh: 7 });
  formRow(B, y + 52, 4, 54, 12, true);
  // right block: time, horn, rally, charge, map, flight + minimap
  const rx = 400; [0, 1, 2, 4].forEach((s, i) => btn('bs' + s, rx + i * 15, y + 3, 14, 14, { ic: ['i_pause', 'i_play1', 'i_play2', 'i_play3'][i], style: 'dark', active: B.speed === s, onClick: () => { B.speed = s; }, tip: ['Пауза (Пробел) — отдавать приказы', 'Скорость 1', 'Скорость 2 (+/−)', 'Скорость 4'][i] }));
  btn('bo_map', rx + 62, y + 3, 70, 14, { label: B.ov ? 'К войскам' : 'Карта', ic: 'i_map', active: B.ov, tip: 'Карта полководца (Tab или колесо мыши): всё поле разом.', onClick: () => { B.ov = !B.ov; } });
  const sigOk = REGK.some(k => B.regs[0][k].order.k === 'wait' && regUnits(B, 0, k).length);
  btn('bo_sig', rx, y + 19, 65, 14, { label: 'Сигнал', active: sigOk && Math.sin(NOW * 4) > 0.3, disabled: !sigOk, tip: ['Трубить в рог (H): полки, ждущие сигнала, ударят разом.', { t: 'Сигнал слышат сразу — гонец не нужен.', c: UIC.dim }], onClick: () => sigBtn(B) });
  const rcd = Math.max(0, 30 - (B.t - B.rallyT[0])); btn('bo_ral', rx + 67, y + 19, 65, 14, { label: rcd > 0 ? 'Сплотить ' + Math.ceil(rcd) : 'Сплотить', disabled: rcd > 0 || !genOf(B, 0), tip: 'Полководец скачет вдоль строя (G): дрогнувшие крепнут духом, часть бегущих поблизости возвращается. Раз в 30 с.', onClick: () => rallyBtn(B) });
  btn('bo_all', rx, y + 35, 65, 14, { label: 'Натиск!', tip: 'Общий натиск: всем полкам наступать, стрелкам — стрелять с ходу.', onClick: () => chargeAll(B) });
  const arm = B.retArm && NOW - B.retArm < 3; btn('bo_ret', rx + 67, y + 35, 65, 14, { label: arm ? 'Точно?' : 'Бежать', active: arm, tip: 'Отступить с поля (нажать дважды): бой проигран, но уцелевшие спасутся.', onClick: () => fleeField(B) });
  txt(B.speed === 0 ? 'Пауза' : 'Скорость ×' + B.speed, rx, y + 54, '#9a8a70', { f: 's' }); if (us.length) txt('Выбрано: ' + us.length, rx + 67, y + 54, '#9a8a70', { f: 's' });
  drawBMini(B, W - 100, y + 3);
}
function drawBMini(B, x, y) { const w = BMINI.width, h = BMINI.height, sc = w / BF.W; rect(x - 1, y - 1, w + 2, h + 2, PAL.o); ctx.drawImage(BMINI, x, y);
  for (const u of B.units) { if (!bAlive(u) || knowU(B, u) !== 'full') continue; rect(x + u.x * sc - 1, y + u.y * sc - 1, 2, 2, u.side === 0 ? (B.sel.includes(u.id) ? '#fff2c8' : '#8ac8ff') : '#ee5a4a'); }
  if (!B.ov) strokeR(Math.round(x + B.cam.x * sc), Math.round(y + B.cam.y * sc), Math.round(BF.VW * sc), Math.round(BF.VH * sc), '#fff2c8');
  hit(x, y, w, h, { id: 'bmini', tip: 'Мини-карта: щёлкните, чтобы перейти.', onClick: c => { B.ov = false; bcamTo(B, (c.ux - x) / sc, (c.uy - y) / sc); } }); }
// how the men fell on each side, and the lessons a wise commander takes from it
function battleLessons(B) { if (B.res.les) return B.res.les; const st = B.stat, L = [], sum = s => st.mel[s] + st.sht[s] + st.pur[s], ourL = Math.max(1, sum(1)), theirL = Math.max(1, sum(0)), won = B.res.win === 0;
  if (st.sht[1] / ourL > 0.35) L.push(['Вражеские стрелы выкосили наших. От стрел — «стена» или натиск конницы на стрелков.', '#a0302a']);
  if (st.chg[1] / ourL > 0.25) L.push(['Решил удар вражеской конницы. От всадников — копья, а лучше «ёж».', '#a0302a']);
  if (st.flk[1] / ourL > 0.3) L.push(['Враг бил нам во фланг и тыл. Края строя прикрывают лес, река или резерв.', '#a0302a']);
  if (st.pur[1] / ourL > 0.3) L.push(['Больше всего полегло бегущих. Дрогнувший полк гибнет — сплачивайте и держите резерв.', '#a0302a']);
  if (st.flk[0] / theirL > 0.3) L.push(['Удары во фланг и тыл ломали врага — так и бейте.', '#2a6a2a']);
  if (st.chg[0] / theirL > 0.25) L.push(['Натиск нашей конницы решил дело.', '#2a6a2a']);
  if (st.sht[0] / theirL > 0.35) L.push(['Наши стрелки сделали своё дело.', '#2a6a2a']);
  if (!won && theirL >= ourL * 0.9) L.unshift(['Врагов полегло не меньше, но наш дух сломался раньше: бегство одного полка увлекает соседей. Держите резерв и сплачивайте (G).', '#a0302a']);
  if (won && ourL > theirL * 1.1) L.push(['Победа дорогой ценой: наших полегло больше, чем врагов.', '#8a5a2a']);
  if (!L.length) L.push([won ? (B.over && B.over.time ? 'Враг так и не сломил наш строй — поле осталось за нами.' : 'Победа далась упорством строя: наши полки держались дольше врага.') : 'Враг оказался крепче. Ищите выгодное поле, стрелков и удар во фланг.', won ? '#2a6a2a' : INK]);
  if (B.pursuit > 0) L.push(won ? ['Конница гнала бегущих: враг потерял ещё ' + B.pursuit + '.', '#2a6a2a'] : ['Враг гнал наших: ещё ' + B.pursuit + ' не вернулись.', '#a0302a']);

  return (B.res.les = L.slice(0, 3)); }
function drawBattleReport(B, x, yy) { const st = B.stat; if (!st) return; hline(x + 12, yy, 416, '#b89a68'); yy += 4;
  txt('Как полегли', x + 14, yy, INK2, { f: 's' }); txt('врагов', x + 130, yy, INK2, { f: 's' }); txt('наших', x + 168, yy, INK2, { f: 's' }); txt('Уроки боя', x + 214, yy, INK2, { f: 's' });
  const rows = [['от стрел и болтов', 'sht'], ['в рукопашной', 'mel'], ['· натиском конницы', 'chg'], ['· ударом во фланг', 'flk'], ['бегущими', 'pur']]; let y2 = yy + 9;
  for (const [l, k] of rows) { txt(l, x + 14, y2, INK, { f: 's' }); txt(String(Math.round(st[k][0])), x + 130, y2, INK, { f: 's' }); txt(String(Math.round(st[k][1])), x + 168, y2, INK, { f: 's' }); y2 += 8; }
  if (B.pursuit > 0) { txt('в погоне', x + 14, y2, INK, { f: 's' }); txt(B.res.win === 0 ? String(B.pursuit) : '—', x + 130, y2, INK, { f: 's' }); txt(B.res.win === 0 ? '—' : String(B.pursuit), x + 168, y2, INK, { f: 's' }); }
  let y3 = yy + 9; for (const [t, c] of battleLessons(B)) y3 += para(t, x + 214, y3, 212, c, { f: 's', lh: 8 }) + 2; }
function drawBattleEnd(B) {
  const res = B.res, pw = res.win === 0, our = res.sides[0], their = res.sides[1];
  const [x, y] = dlg(440, 246, pw ? 'Победа!' : res.retreat || B.over.retreat ? 'Отступление' : 'Поражение');
  spr(pw ? 'i_crown' : 'i_flag', x + 18, y + 28, { scale: 3 });
  let yy = y + 26; txt('Наши потери: ' + our.lost + ' (убито ' + our.killed + ', ранено ' + our.wounded + ') · потери врага: ' + their.lost, x + 56, yy, INK, { f: 's' }); yy += 10;
  if (pw && res.loot) { const L = res.loot, parts = []; if (L.gold) parts.push(L.gold + ' зол.'); if (L.food) parts.push('провиант ' + L.food); if (L.arrows) parts.push('стрелы ' + L.arrows); if (L.weap) parts.push('оружие ' + L.weap); if (L.horses) parts.push('кони ' + L.horses); if (L.prisoners) parts.push('пленные ' + L.prisoners); if (parts.length) yy += para('Добыча: ' + parts.join(', ') + '.', x + 56, yy, 370, INK, { f: 's', lh: 8 }); }
  if (res.genFate) yy += para(res.genFate, x + 56, yy, 370, res.genBad ? '#a0302a' : '#2a6a2a', { f: 's', lh: 8 }) + 1;
  if (res.sett !== undefined && pw) { txt('Крепость наша!', x + 56, yy, '#2a6a2a', { f: 's' }); yy += 9; }
  // how each regiment and its captain fared
  yy = Math.max(yy + 4, y + 62); hline(x + 12, yy, 416, '#b89a68'); yy += 4;
  txt('Полк', x + 14, yy, INK2, { f: 's' }); txt('Воевода', x + 110, yy, INK2, { f: 's' }); txt('Итог', x + 226, yy, INK2, { f: 's' }); txt('Было', x + 262, yy, INK2, { f: 's' }); txt('Осталось', x + 296, yy, INK2, { f: 's' }); txt('Сразили', x + 344, yy, INK2, { f: 's' }); yy += 9;
  const FT = { killed: ['пал', '#a0302a'], captured: ['в плену', '#a0302a'], fled: ['бежал', '#8a5a2a'], freed: ['отбит из плена', '#2a6a2a'] };
  for (const r of res.regs[0] || []) { txt(REGD[r.k] + ' ' + REGS[r.k], x + 14, yy, INK, { f: 's' }); const ft = r.fate && FT[r.fate];
    txt(r.cmd ? fitT(r.cmd, 120, { f: 's' }) : '—', x + 110, yy, r.gen ? '#7a5a10' : INK, { f: 's' }); if (ft) txt(ft[0], x + 226, yy, ft[1], { f: 's' }); else if (r.up) txt('+' + r.up + ' умение', x + 222, yy, '#2a6a2a', { f: 's' }); else if (r.fled) txt('бежали', x + 226, yy, '#8a5a2a', { f: 's' });
    txt(String(r.men0), x + 262, yy, INK, { f: 's' }); txt(String(r.men), x + 296, yy, r.men < r.men0 * 0.5 ? '#a0302a' : INK, { f: 's' }); txt(String(r.kills), x + 344, yy, INK, { f: 's' }); yy += 9; }
  const er = res.regs[1] || []; if (er.length) { yy += 3; txt(fitT('Враг: ' + er.map(r => REGS[r.k] + ' ' + r.men + '/' + r.men0).join(' · '), 412, { f: 's' }), x + 14, yy, INK2, { f: 's' }); yy += 9; }
  drawBattleReport(B, x, Math.max(yy + 4, y + 128));
  btn('be_ok', x + 140, y + 224, 160, 16, { label: 'На карту', onClick: endBattleScreen });
}
