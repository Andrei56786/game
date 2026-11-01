'use strict';
// ===== BATTLE SIMULATION (from battle.js): orders by courier, signals & rally, sight, the step of the fight (movement, melee, missiles, morale), fallen generals =====
// ---------- simulation ----------
const UST = { levy: 13, spear: 12, sword: 11, archer: 13, xbow: 12, horse: 26, harch: 28, knight: 21 };
const ARM = { levy: [1, 1], spear: [0.8, 0.95], sword: [0.55, 0.85], archer: [1, 1], xbow: [0.9, 0.95], horse: [0.95, 0.95], harch: [1, 1], knight: [0.45, 0.8] };
const SHOT = { archer: { hit: 0.3, wet: 0.6, vol: 1 }, xbow: { hit: 0.42, wet: 0.8, vol: 1.45 }, harch: { hit: 0.3, wet: 0.6, vol: 1 } };
const DISC = (u, q) => (55 / UNIT[u.type].mor) ** 1.5 * (1 - u.xp / 300) / (q || 1);
// a captain's hand on his regiment: a skilled one makes his men fight harder and hold longer, most of all where he rides himself
function capQ(B, u) { const g = B.regs[u.side][u.reg], c = cmdOk(g); if (!c) return 0.88; const L = leadOf(B, g), near = L && Math.abs(L.x - u.x) < 120 && Math.hypot(L.x - u.x, L.y - u.y) < 120; return 1 + (c.mar - 5) * (near ? 0.03 : 0.015); }
function bRadN(m) { return 6 + Math.sqrt(m) * 0.9; }
function bRad(u) { return bRadN(u.men) * FORMS[u.form].r; }
function bAlive(u) { return u.men > 0.5 && u.state !== 'gone'; }
const charger = u => u.type === 'horse' || u.type === 'knight';
function terrMul(B, u) { const k = B.F.g[cellAt(B.F, u.x, u.y)], M = MOUNTED[u.type]; if (k === GC.FOREST) return M ? (u.type === 'knight' ? 0.4 : 0.45) : 0.65; if (k === GC.MARSH) return M ? 0.4 : 0.5; if (k === GC.FORD) return 0.45; if (k === GC.WALL) return 0.4; if (k === GC.ROAD) return 1.1; return 1; }
function bSpeed(B, u, Wt) { const f = u.formTo ? Math.min(FORMS[u.form].sp, FORMS[u.formTo].sp) * 0.5 : FORMS[u.form].sp; return UST[u.type] * f * terrMul(B, u) * (1 - u.fat / 250) * (Wt.cold ? 0.85 : 1); }
function bRange(B, u) { const h = B.F.hgt[cellAt(B.F, u.x, u.y)]; let r = (UNIT[u.type].rng || 150) + h * 12; const Wt = B.weather || weatherOf(); if (Wt.vis < 0.6) r *= 0.65; return r; }
function bsay(B, x, y, t, c) { if (B.headless) return; B.fx.push({ k: 'txt', x, y, t, c: c || '#f7d35c', t0: B.t }); B.log.push({ t: B.t, s: t, c: c || '#f7d35c', x, y }); if (B.log.length > 40) B.log.shift(); }
// a block order: through a courier riding from the general (players' and generals' orders) — captains give theirs at once
function courierDelay(B, u, show) { const g = genOf(B, u.side); if (g && g.id === u.id) return 0.1; const d = g ? Math.hypot(g.x - u.x, g.y - u.y) : 300, sk = B.sides[u.side].gen ? B.sides[u.side].gen.mar : 5;
  const delay = (0.3 + d / 140) * (g ? 1 : 2) * (1.15 - sk * 0.015); if (g && show) B.couriers.push({ x0: g.x, y0: g.y, u: u.id, t0: B.t, t1: B.t + delay, side: u.side }); return delay; }
function issue(B, u, ord, delay) {
  if (B.phase === 'deploy') { bApply(B, u, ord); return; }
  if (delay === undefined) delay = courierDelay(B, u, true);
  u.pend = { at: B.t + delay, ord };
}
// a change of formation, by courier too (f null: let the captain choose again)
function issueForm(B, u, f, lock) { if (B.phase === 'deploy') { if (f) setForm(B, u, f, lock); else u.formLock = false; return; } u.pendF = { at: B.t + courierDelay(B, u, !u.pend), f, lock }; }
function bApply(B, u, ord) { u.order = ord; if (ord.k === 'move') { u.tx = ord.x; u.ty = ord.y; } if (u.state === 'idle' || u.state === 'move') u.state = 'move'; if ((u.form === 'square' || u.formTo === 'square') && (ord.k === 'move' || ord.k === 'attack')) { u.formLock = false; setForm(B, u, 'line'); } }
// a captain's own command to a block of his regiment (no courier); skips repeats
function cmd(B, u, ord) { const o = u.order;
  if (o && o.k === ord.k) { if (ord.k === 'attack' && o.t === ord.t) return; if (ord.k === 'move' && Math.hypot(o.x - ord.x, o.y - ord.y) < 8 && !!o.dis === !!ord.dis) { o.vmax = ord.vmax; o.f = ord.f; return; } }
  if (!o && ord.k === 'move' && Math.hypot(u.x - ord.x, u.y - ord.y) < 5) { if (ord.f !== undefined) u.wantF = ord.f; return; }
  bApply(B, u, ord); }
// a regiment order: a courier rides from the general to the regiment's captain
function issueReg(B, g, ord) {
  if (B.phase === 'deploy') { setRegOrder(B, g, ord); return; }
  const side = g.side, gu = genOf(B, side), L = leadOf(B, g) || regUnits(B, side, g.k)[0]; if (!L) { setRegOrder(B, g, ord); return; }
  const sk = B.sides[side].gen ? B.sides[side].gen.mar : 5, d = gu ? Math.hypot(gu.x - L.x, gu.y - L.y) : 300;
  let delay = (0.3 + d / 140) * (gu ? 1 : 2) * (1.15 - sk * 0.015); if (gu && gu.reg === g.k) delay = 0.15;
  if (gu && gu !== L && delay > 0.2) B.couriers.push({ x0: gu.x, y0: gu.y, u: L.id, t0: B.t, t1: B.t + delay, side, reg: g.k });
  g.pend = { at: B.t + delay, ord };
}
function setRegOrder(B, g, ord) {
  g.order = Object.assign({}, ord); g.fl = 0; g.backTo = null; g.thinkT = Math.min(g.thinkT, 0.25);
  const us = regUnits(B, g.side, g.k);
  if (ord.x !== undefined && (ord.k === 'move' || ord.k === 'hold')) { if (ord.f !== undefined) g.af = ord.f; g.ax = ord.x; g.ay = ord.y; if (ord.k === 'hold' && ord.x !== undefined && ord.re) for (const u of us) setSlot(g, u); }
  if (ord.k !== 'wait') for (const u of us) u.man = false;
  if (B.phase === 'deploy') g.cur = ord.k;
}
// the horn: regiments waiting for the signal strike at once
function signal(B, side) { if (B.t - B.sigT[side] < 2) return 0; let n = 0; for (const k of REGK) { const g = B.regs[side][k]; if (g.order.k === 'wait' && regUnits(B, side, k).length) { setRegOrder(B, g, { k: g.then || 'auto' }); n++; } }
  if (n) { B.sigT[side] = B.t; const gu = genOf(B, side) || B.units.find(u => u.side === side && bAlive(u)); if (gu) bsay(B, gu.x, gu.y - 30, side === 0 ? 'Сигнал! Засадный полк — вперёд!' : 'Враг трубит в рог!', side === 0 ? '#f7d35c' : '#ffb4a8'); if (!B.headless && typeof Snd !== 'undefined') Snd.sfx('horn'); }
  return n; }
// the general rides along the line: shaken men steady, some of the fleeing turn back
function rally(B, side) { const gu = genOf(B, side); if (!gu || B.t - B.rallyT[side] < 30 || gu.state === 'rout') return false; B.rallyT[side] = B.t; const mar = B.sides[side].gen ? B.sides[side].gen.mar : 5, R0 = 90 + mar * 4; let n = 0;
  for (const u of B.units) { if (u.side !== side || !bAlive(u) || Math.hypot(u.x - gu.x, u.y - gu.y) > R0) continue;
    if (u.state === 'rout') { if (u.men > u.men0 * 0.15 && R.f() < 0.35 + mar * 0.04) { u.state = 'idle'; u.order = null; u.man = false; u.morale = Math.max(u.morale, 30 + mar); n++; bsay(B, u.x, u.y - 20, 'Вернулись!', '#9fe07a'); } }
    else u.morale = Math.min(100, u.morale + 8 + mar); }
  bsay(B, gu.x, gu.y - 30, (side === 0 && B.sides[0].king ? 'Король' : 'Полководец') + ': «За мной!»', '#fff2c8'); if (!B.headless && typeof Snd !== 'undefined') Snd.sfx('horn_short'); return true; }
function enemyOf(B, u, maxD) { let best = null, bd = maxD || 1e9; const V = B.vis ? B.vis[u.side] : null; for (const v of B.units) { if (v.side === u.side || !bAlive(v) || v.state === 'rout') continue; if (V && !V[v.id]) continue; const d = Math.hypot(v.x - u.x, v.y - u.y); if (d < bd) { bd = d; best = v; } } return best; }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
// who sees whom: plain sight is long, forests hide all but the nearest, an ambush only shows itself when it is too late
function updateVis(B) {
  const us = B.units, F = B.F, Wt = B.weather || weatherOf();
  const sight = us.map(u => bAlive(u) ? (330 * Wt.vis + F.hgt[cellAt(F, u.x, u.y)] * 30) * (MOUNTED[u.type] ? 1.1 : 1) : 0);
  for (const side of [0, 1]) { const V = B.vis[side], gh = B.ghost[side];
    for (const v of us) { if (v.side === side) continue; let s = 0;
      if (bAlive(v)) { if (v.contact.some(c => c.side === side) || (B.phase === 'deploy' && !v.hidden && B.scout[side] >= 0.25)) s = 1;
        else { const inF = F.g[cellAt(F, v.x, v.y)] === GC.FOREST, lim = v.hidden ? 46 : inF ? (B.t - v.lastShot < 2 ? 140 : 54) : 1e9;
          for (const u of us) { if (u.side !== side || !bAlive(u)) continue; const d = Math.hypot(u.x - v.x, u.y - v.y); if (d < lim && d < sight[u.id]) { s = 1; break; } } } }
      if (V[v.id] && !s && bAlive(v)) gh[v.id] = { x: v.x, y: v.y, t: B.t, type: v.type, men: v.men, reg: v.reg, face: v.face }; if (s || !bAlive(v)) delete gh[v.id];
      V[v.id] = s; } } }
function bStep(B, dt) {
  useField(B.F); B.t += dt; const us = B.units, F = B.F, Wt = B.weather || weatherOf();
  B.genU = [genOf(B, 0), genOf(B, 1)];
  for (const u of us) { if (u.pend && B.t >= u.pend.at) { const o = u.pend.ord; u.pend = null; bApply(B, u, o); } if (u.pendF && B.t >= u.pendF.at) { const p = u.pendF; u.pendF = null; if (p.f) setForm(B, u, p.f, p.lock); else u.formLock = false; } if (u.formTo && B.t >= u.formT) { u.form = u.formTo; u.formTo = null; } }
  for (const side of [0, 1]) for (const k of REGK) { const g = B.regs[side][k]; if (g.pend && B.t >= g.pend.at) { const o = g.pend.ord; g.pend = null; setRegOrder(B, g, o); } }
  // contacts (the fleeing do not strike back)
  for (const u of us) u.contact.length = 0;
  for (let i = 0; i < us.length; i++) { const a = us[i]; if (!bAlive(a)) continue; const ar = a.state === 'rout', ra = bRad(a);
    for (let j = i + 1; j < us.length; j++) { const b = us[j]; if (b.side === a.side || !bAlive(b)) continue; const br = b.state === 'rout'; if (ar && br) continue; const dx = a.x - b.x, dy = a.y - b.y, m = ra + bRad(b); if (dx * dx + dy * dy >= m * m) continue;
      if (!ar) a.contact.push(b); if (!br) b.contact.push(a); if (a.hidden || b.hidden) a.hidden = b.hidden = false; } }
  for (const u of us) if (u.contact.length > 1) u.contact.sort((p, q) => (p.state === 'rout' ? 1 : 0) - (q.state === 'rout' ? 1 : 0));
  if (B.t >= B.visT) { B.visT = B.t + 0.5; updateVis(B); }
  // horse archers wheel away by reflex, not waiting for the captain's word
  for (const u of us) { if (u.type !== 'harch' || !bAlive(u) || u.state === 'rout' || u.man || u.ammo <= 0 || B.t < (u.hrT || 0)) continue; u.hrT = B.t + 0.4; const k = B.regs[u.side][u.reg].cur; if (k === 'hold' || k === 'wait' || (u.order && u.order.dis && B.t - (u.harT || -9) < 1.5)) continue;
    let e = null, bd = 1e9; for (const v of us) { if (v.side === u.side || !bAlive(v) || v.state === 'rout' || RANGED[v.type] || (v.contact.length && !v.contact.includes(u))) continue; const d = Math.hypot(v.x - u.x, v.y - u.y) - bRad(v) - bRad(u); if (d < (charger(v) ? 45 : 22) && d < bd) { bd = d; e = v; } } if (e) harchFlee(B, u, e); }
  // movement & facing
  for (const u of us) {
    if (!bAlive(u)) continue;
    const sp = bSpeed(B, u, Wt);
    if (u.state === 'rout') { // flee to own edge
      const ex = u.side === 0 ? -20 : BF.W + 20; const dx = ex - u.x; u.face = dx < 0 ? Math.PI : 0; const rs = UST[u.type] * terrMul(B, u) * 1.25; u.x += Math.sign(dx) * rs * dt; u.y += (hash2(u.id, 1, 1) - 0.5) * 6 * dt; u.y = clamp(u.y, 8, BF.H - 8);
      u.morale = Math.min(100, u.morale + dt * 2); const pursued = us.some(v => v.side !== u.side && bAlive(v) && v.state !== 'rout' && Math.abs(v.x - u.x) < 60 && Math.hypot(v.x - u.x, v.y - u.y) < 60);
      if (u.x < -10 || u.x > BF.W + 10) { u.state = 'gone'; u.fled = true; }
      else if (!pursued && u.morale > 45 && B.t - u.routT > 8 && !u.rallied && B.lostF[u.side] < 0.5) { u.state = 'idle'; u.order = null; u.man = false; u.rallied = 1; bsay(B, u.x, u.y - 20, 'Собрались!', '#9fe07a'); }
      continue;
    }
    const fight = u.contact.find(e => e.state !== 'rout'), dis = u.order && u.order.k === 'move' && u.order.dis;
    if (fight && !dis) { const want = Math.atan2(fight.y - u.y, fight.x - u.x); u.face += clamp(angDiff(want, u.face), -1.6 * dt, 1.6 * dt); u.state = 'melee'; u.ch = Math.max(0, u.ch - dt * 0.6); u.fat = Math.min(100, u.fat + dt * 0.3); continue; }
    if (u.state === 'melee') u.state = u.order ? 'move' : 'idle';
    if (u.hidden && F.g[cellAt(F, u.x, u.y)] !== GC.FOREST) u.hidden = false;
    let tx = null, ty = null, aimT = null;
    if (u.order && u.order.k === 'attack') { const t = us[u.order.t];
      if (!t || !bAlive(t) || (t.state === 'rout' && !charger(u) && !u.order.pur)) u.order = null;
      else if (!B.vis[u.side][t.id]) { const gh = B.ghost[u.side][t.id]; if (gh && B.t - gh.t < 12 && Math.hypot(gh.x - u.x, gh.y - u.y) > 10) { tx = gh.x; ty = gh.y; } else u.order = null; }
      else { tx = t.x; ty = t.y; if (RANGED[u.type] && u.ammo > 0 && u.form !== 'column') { const d = Math.hypot(t.x - u.x, t.y - u.y); if (d < bRange(B, u) * (u.type === 'harch' ? 0.85 : 0.9)) { tx = null; aimT = t; } } } }
    else if (u.order && u.order.k === 'move') { tx = u.order.x; ty = u.order.y; if (Math.hypot(tx - u.x, ty - u.y) < 3) { if (u.order.f !== undefined) u.wantF = u.order.f; u.order = null; u.state = 'idle'; tx = null; } }
    else if (!u.order && u.state === 'idle' && !RANGED[u.type] && !u.hidden && u.form !== 'square' && B.regs[u.side][u.reg].cur !== 'wait') { const e = enemyOf(B, u, 40); if (e) { tx = e.x; ty = e.y; } }
    if (tx !== null) {
      const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy); if (d < 0.5) continue;
      let s = sp; if (u.order && u.order.vmax) s = Math.min(s, u.order.vmax);
      if (charger(u) && u.order && u.order.k === 'attack' && d < 70 && u.form !== 'column') { s = sp * (u.type === 'knight' ? 1.4 : 1.5) * (u.form === 'wedge' ? 1.08 : 1); u.ch = Math.min(1, u.ch + dt * 0.8); } else u.ch = Math.max(0, u.ch - dt);
      if (!u.wp || B.t - u.wp.t > 0.4 || Math.abs(u.wp.tx - tx) + Math.abs(u.wp.ty - ty) > 8) u.wp = { t: B.t, tx, ty, p: steerPoint(F, u, tx, ty) };
      const want = u.wp.p ? Math.atan2(u.wp.p[1] - u.y, u.wp.p[0] - u.x) : Math.atan2(dy, dx); u.face += clamp(angDiff(want, u.face), -2.5 * dt, 2.5 * dt);
      const st = Math.min(s * dt, d), nx = u.x + Math.cos(want) * st, ny = u.y + Math.sin(want) * st;
      if (passCell(F, cellAt(F, nx, ny), u)) { u.x = nx; u.y = ny; }
      else { for (const w of [want + 0.8, want - 0.8, want + 1.6, want - 1.6]) { const ax = u.x + Math.cos(w) * st, ay = u.y + Math.sin(w) * st; if (passCell(F, cellAt(F, ax, ay), u)) { u.x = ax; u.y = ay; break; } } }
      u.fat = Math.min(100, u.fat + dt * (u.ch > 0 ? 1.2 : u.form === 'column' ? 0.15 : 0.25) * (u.type === 'knight' ? 1.3 : 1)); u.state = 'move';
    } else {
      u.fat = Math.max(0, u.fat - dt * 0.4); if (u.state === 'move') u.state = 'idle'; u.ch = Math.max(0, u.ch - dt);
      const wf = aimT ? Math.atan2(aimT.y - u.y, aimT.x - u.x) : u.wantF; if (wf !== undefined && !u.contact.length) { const d = angDiff(wf, u.face); if (Math.abs(d) > 0.02) u.face += clamp(d, -1.5 * dt, 1.5 * dt); else if (!aimT) u.wantF = undefined; }
    }
    u.x = clamp(u.x, -30, BF.W + 30); u.y = clamp(u.y, 8, BF.H - 8);
  }
  // separation among friends
  for (let i = 0; i < us.length; i++) { const a = us[i]; if (!bAlive(a)) continue; const ra = bRad(a); for (let j = i + 1; j < us.length; j++) { const b = us[j]; if (b.side !== a.side || !bAlive(b)) continue; const dx0 = a.x - b.x, dy0 = a.y - b.y, m = (ra + bRad(b)) * 0.8; if (Math.abs(dx0) > m || Math.abs(dy0) > m) continue; const d = Math.hypot(dx0, dy0); if (d < m && d > 0.01) { const k = (m - d) / d * 0.25, wa = a.form === 'square' ? 0.2 : 1, wb = b.form === 'square' ? 0.2 : 1; const dx = dx0 * k, dy = dy0 * k; if (passCell(F, cellAt(F, a.x + dx * wa, a.y + dy * wa), a)) { a.x += dx * wa; a.y += dy * wa; } if (passCell(F, cellAt(F, b.x - dx * wb, b.y - dy * wb), b)) { b.x -= dx * wb; b.y -= dy * wb; } } } }
  // melee: a block can only be struck by so many men at once — crowding round it adds flank blows, not endless swords
  for (const u of us) u.atkN = 0; for (const u of us) if (bAlive(u) && u.state !== 'rout' && u.contact.length) u.contact[0].atkN++;
  for (const u of us) {
    if (!bAlive(u) || u.state === 'rout' || !u.contact.length) continue;
    const e = u.contact[0], U = UNIT[u.type], E = UNIT[e.type], fu = FORMS[u.form], fe = FORMS[e.form], er = e.state === 'rout';
    const fight = Math.min(u.men, 25 + u.men * 0.45) * fu.fr;
    let m = fu.atk * (u.formTo ? 0.85 : 1), flank = 0;
    if (er) { m *= 2; flank = 2; }
    else if (e.form !== 'square') { const rel = Math.abs(angDiff(Math.atan2(u.y - e.y, u.x - e.x), e.face)); if (rel > 2.2) { m *= 2; flank = 2; } else if (rel > 1.05) { m *= 1.5; flank = 1; } if (flank && e.form === 'column') m *= 1.2; }
    if (charger(u) && u.ch > 0.3 && !er) { let c = u.type === 'knight' ? 3 : 2.4; if (u.form === 'wedge') c *= 1.15;
      const sq = e.form === 'square', brace = sq ? 0.17 : (e.type === 'spear' && flank === 0 && e.form !== 'loose' && e.form !== 'column') ? 0.23 : (e.form === 'close' && flank === 0) ? 0.4 : 1;
      if (brace < 1) { c *= brace * (u.type === 'knight' ? 1.25 : 1); u.men -= dt * fight * 0.05 * (sq ? 1.3 : 1) * (u.type === 'knight' ? 0.6 : 1); } else if (e.form === 'loose') c *= 1.25;
      m *= c; }
    if (u.type === 'spear' && MOUNTED[e.type]) m *= 1.6;
    if (u.type === 'levy' && u.form === 'square' && MOUNTED[e.type]) m *= 1.25;
    if (e.type === 'spear' && charger(u) && flank === 0 && !er) m *= 0.65;
    const hu = F.hgt[cellAt(F, u.x, u.y)], he = F.hgt[cellAt(F, e.x, e.y)]; if (hu > he) m *= 1.25; else if (hu < he) m *= 0.85;
    const ku = F.g[cellAt(F, u.x, u.y)], ke = F.g[cellAt(F, e.x, e.y)];
    if (ku === GC.FORD || ku === GC.MARSH) m *= 0.7; if (ke === GC.FORD || ke === GC.MARSH) m *= 1.15;
    if (ke === GC.WALL || (F.siege && e.side === F.defSide && e.x > F.rv.wall * BF.CELL - 4 && e.x < F.rv.wall * BF.CELL + 16)) m *= 0.45;
    if (MOUNTED[u.type] && ku === GC.FOREST) m *= u.type === 'knight' ? 0.5 : 0.6; if (ke === GC.FOREST) m *= 0.85;
    m *= (1 - u.fat / 220) * (u.morale < 30 ? 0.75 : 1) * (1 + u.xp / 220);
    const gA = B.genU[u.side]; if (gA && Math.abs(gA.x - u.x) < 80 && Math.hypot(gA.x - u.x, gA.y - u.y) < 80) m *= 1.1;
    m *= capQ(B, u);
    if (B.sides[u.side].ground === 'open' && MOUNTED[u.type]) m *= 1.1;
    if (B.sides[e.side].ground === 'contentious' && e.side === 1) m *= 0.83;
    const def = E.def * fe.def * (e.formTo ? 0.85 : 1) * (er ? 0.5 : 1);
    const A2 = U.atk * U.atk, D2 = (def * 1.3) ** 2, dmg = fight * A2 / (A2 + D2) * 0.016 * m * dt * Math.min(1, 1.6 / Math.max(1, e.atkN));
    const kills = Math.min(e.men, dmg * 12 / E.hp);
    e.men -= kills; u.kills += kills; e.lastHit = B.t; if (B.stat) { B.stat[er ? 'pur' : 'mel'][u.side] += kills; if (charger(u) && u.ch > 0.3 && !er) B.stat.chg[u.side] += kills; if (flank && !er) B.stat.flk[u.side] += kills; }
    // being taken in the flank shakes a block as much as the blows that come with it: a peasant mob on the flank of men-at-arms frightens less than knights in the rear
    if (!er) { const thr = flank ? clamp(fight * A2 / (A2 + D2) / Math.max(10, e.men) / 0.26, 0.25, 1.5) * Math.min(1, 1.6 / Math.max(1, e.atkN)) : 0; e.morale -= (kills / Math.max(10, e.men0) * 150 + (flank === 2 ? 3.2 : flank === 1 ? 1.6 : 0) * thr * dt) * DISC(e, capQ(B, e)); }
    if (!B.headless && kills > 0 && R.f() < kills * 0.6) B.dead.push({ x: e.x + (R.f() - 0.5) * bRad(e) * 1.4, y: e.y + (R.f() - 0.5) * bRad(e) * 1.4, side: e.side, t: e.type });
  }
  // shooting: bows arc, crossbows punch through mail, horse archers loose on the move
  for (const u of us) {
    if (!RANGED[u.type] || !bAlive(u) || u.state === 'rout' || u.ammo <= 0 || u.form === 'column') continue;
    if (u.contact.length && u.contact.some(e => e.state !== 'rout')) continue;
    u.cd -= dt * (u.formTo ? 0.5 : 1); if (u.cd > 0) continue;
    if (u.state === 'move' && u.type !== 'harch') continue;
    const rng = bRange(B, u); let tgt = u.order && u.order.k === 'attack' ? us[u.order.t] : null;
    if (!tgt || !bAlive(tgt) || tgt.state === 'rout' || !B.vis[u.side][tgt.id] || Math.hypot(tgt.x - u.x, tgt.y - u.y) > rng) tgt = enemyOf(B, u, rng);
    if (!tgt) continue;
    const S = SHOT[u.type]; u.cd = UNIT[u.type].cd * (0.9 + R.f() * 0.2); u.ammo -= 1; u.shots += u.men; u.lastShot = B.t;
    let hit = S.hit * (Wt.wet ? S.wet : 1) * (1 + u.xp / 250) * (u.form === 'loose' ? 0.9 : 1) * ARM[tgt.type][u.type === 'xbow' ? 1 : 0] * FORMS[tgt.form].arr;
    // shields face the front: arrows from the flank or the rear find bodies (the hedgehog has no flank); galloping horsemen are hard to hit
    const relS = tgt.form === 'square' ? 0 : Math.abs(angDiff(Math.atan2(u.y - tgt.y, u.x - tgt.x), tgt.face)), fs = relS > 2.2 ? 1.6 : relS > 1.05 ? 1.3 : 1; hit *= fs;
    if (MOUNTED[tgt.type] && tgt.state === 'move') hit *= 0.8;
    // loosing into a melee: the shooters aim short of their own men, and some shafts still find friends
    const pal = tgt.contact.find(x => x.side === u.side && x.state !== 'rout'), palNear = pal && (pal.x - tgt.x) * (u.x - tgt.x) + (pal.y - tgt.y) * (u.y - tgt.y) > 0; if (pal) hit *= palNear ? 0.5 : 0.85;
    const kt = F.g[cellAt(F, tgt.x, tgt.y)]; if (kt === GC.FOREST) hit *= 0.4;
    if (F.siege && tgt.side === F.defSide && tgt.x > F.rv.wall * BF.CELL - 4) hit *= 0.5;
    if (F.hgt[cellAt(F, u.x, u.y)] > F.hgt[cellAt(F, tgt.x, tgt.y)]) hit *= 1.1;
    const kills = Math.min(tgt.men, u.men * hit * 0.085 * 12 / UNIT[tgt.type].hp * S.vol);
    tgt.men -= kills; u.kills += kills; if (palNear) { const fk = Math.min(pal.men, kills * 0.2 * UNIT[tgt.type].hp / UNIT[pal.type].hp); pal.men -= fk; pal.morale -= fk / Math.max(10, pal.men0) * 60; if (B.stat) B.stat.ff[u.side] += fk; } if (B.stat) { B.stat.sht[u.side] += kills; if (fs > 1) B.stat.flk[u.side] += kills; } tgt.morale -= (kills / Math.max(10, tgt.men0) * 90 + 0.8 + (fs - 1) * 2.5) * DISC(tgt, capQ(B, tgt)); tgt.lastHit = B.t; tgt.lastArr = B.t;
    if (!B.headless) { const n = Math.min(14, 3 + Math.floor(u.men / 10)), xb = u.type === 'xbow'; for (let k = 0; k < n; k++) B.arrows.push({ x0: u.x + (R.f() - 0.5) * 14, y0: u.y + (R.f() - 0.5) * 14, x1: tgt.x + (R.f() - 0.5) * 18, y1: tgt.y + (R.f() - 0.5) * 18, t0: B.t + R.f() * (xb ? 0.4 : 0.25), d: xb ? 0.55 : 0.9, arc: xb ? 8 : 26, xb }); if (typeof Snd !== 'undefined') Snd.sfx('arrows'); }
  }
  // the army's spirit: how much of it has fallen or fled
  if (!B.lostF || B.t >= (B.lfT || 0)) { B.lfT = B.t + 0.5; B.lostF = [0, 1].map(s => { let m0 = 0, m = 0; for (const u of us) if (u.side === s) { m0 += u.men0; if (bAlive(u) && u.state !== 'rout') m += u.men; } return m0 ? 1 - m / m0 : 1; }); }
  // morale: rout / recover
  for (const u of us) {
    if (!bAlive(u)) continue;
    const rg = B.regs[u.side][u.reg];
    if (u.men < 1) { u.men = 0; u.state = 'gone'; if (u.gen) onGenFall(B, u); if (rg.lead === u.id) onCaptFall(B, rg, u, true); continue; }
    if (u.state === 'rout') continue;
    if (!u.mor0) u.mor0 = u.morale; const engaged = u.contact.some(e => e.state !== 'rout'), gA = B.genU[u.side];
    if (!engaged && B.t - u.lastHit > 3) { let r = 0.5; if (gA && Math.hypot(gA.x - u.x, gA.y - u.y) < 90) r = 1.4; else { const cc = cmdOk(rg), L = cc && leadOf(B, rg); if (L && Math.hypot(L.x - u.x, L.y - u.y) < 70) r = 0.9 + cc.mar * 0.03 + (hasTr(cc, 'brave') ? 0.2 : 0); } if (u.morale < u.mor0) u.morale = Math.min(u.mor0, u.morale + dt * r); }
    const lf = B.lostF[u.side], lo = B.lostF[1 - u.side]; if (lf > 0.4) u.morale -= (lf - 0.4) * 7 * dt; else if (lo > 0.4 && lf < 0.25 && u.morale < u.mor0 + 10) u.morale += dt * 0.4;
    const floor = B.sides[u.side].ground === 'death' ? 4 : 14;
    if (u.morale < floor || u.men < u.men0 * 0.12) { if (B.routLog) B.routLog.push(Math.round(B.t) + ' s' + u.side + ' ' + u.type + '/' + u.reg + ' ' + Math.round(u.men) + '/' + u.men0 + ' m' + Math.round(u.morale) + ' c' + u.contact.length + ' ' + (u.contact[0] ? u.contact[0].type : '-') + ' lf' + B.lostF[u.side].toFixed(2)); u.state = 'rout'; u.routT = B.t; u.order = null; u.pend = null; u.pendF = null; u.recover = false; if (u.formTo) u.formTo = null; if (u.form === 'square' || u.form === 'close') u.form = 'loose';
      if (!B.headless) { bsay(B, u.x, u.y - 20, 'Бегут!', '#ee7a6a'); if (typeof Snd !== 'undefined') Snd.sfx('horn_low'); }
      for (const v of us) if (v.side === u.side && v !== u && bAlive(v) && v.state !== 'rout' && Math.hypot(v.x - u.x, v.y - u.y) < 60) v.morale -= (v.reg === u.reg ? 6 : 4) * clamp(u.men0 / Math.max(1, v.men0), 0.4, 1.2);
      if (u.gen) onGenFall(B, u, true); if (rg.lead === u.id) onCaptFall(B, rg, u, false); }
  }
  // captains think; generals of AI sides command
  if (B.t >= (B.stT || 0)) { B.stT = B.t + 2; B.stance = [calcStance(B, 0), calcStance(B, 1)]; }
  for (const side of [0, 1]) { for (const k of REGK) { const g = B.regs[side][k]; g.thinkT -= dt; if (g.thinkT <= 0) { g.thinkT = thinkInt(g); regThink(B, g); } }
    if (B.ai[side]) { B.aiT[side] -= dt; if (B.aiT[side] <= 0) { const gm = B.sides[side].gen ? B.sides[side].gen.mar : 4; B.aiT[side] = 2.4 - gm * 0.08; aiGeneral(B, side); } } }
  // end
  const alive = s => us.some(u => u.side === s && bAlive(u) && u.state !== 'rout');
  for (const s of [0, 1]) if (B.lostF[s] > 0.82 && B.lostF[1 - s] < 0.6 && alive(s) && !(B.F.siege && s === B.F.defSide)) { for (const u of us) if (u.side === s && bAlive(u) && u.state !== 'rout') { u.state = 'rout'; u.routT = B.t; u.order = null; u.pend = null; u.pendF = null; } const gu = genOf(B, s) || us.find(u => u.side === s && bAlive(u)); if (gu) bsay(B, gu.x, gu.y - 30, s === 0 ? 'Войско дрогнуло и бежит с поля!' : 'Враг бежит с поля!', s === 0 ? '#ee7a6a' : '#9fe07a'); }
  if (!alive(0) || !alive(1) || B.t > B.tl) {
    let win; if (!alive(0) && alive(1)) win = 1; else if (!alive(1) && alive(0)) win = 0;
    else { const pw = s => us.reduce((a, u) => a + (u.side === s && bAlive(u) && u.state !== 'rout' ? u.men * (UNIT[u.type].atk + UNIT[u.type].def) * (0.5 + u.morale / 200) : 0), 0); win = B.F.siege ? (pw(0) > pw(1) * 1.5 ? 0 : 1) : pw(0) >= pw(1) ? 0 : 1; }
    B.over = { win, time: B.t > B.tl };
  }
}
// the general's block was destroyed or broke: he rides over to another block; only if none is left does he flee the field
function onGenFall(B, u, routed) {
  const s = B.sides[u.side]; u.gen = false; const C = B.regs[u.side].C; if (!s.gen || s.genFate) return;
  const mine = B.units.filter(v => v.side === u.side && v !== u && bAlive(v) && v.state !== 'rout');
  const say = (t, c) => bsay(B, u.x, u.y - 28, t, c);
  const r = R.f(), lead = u.side === 0 && B.sides[0].king ? 'Король' : 'Полководец';
  if (!routed && r < 0.03) { s.genFate = 'killed'; } else if (r < (routed ? 0.02 : 0.08)) { s.genFate = 'captured'; }
  if (s.genFate) { if (C.cmd && C.cmd.gen) { if (s.genFate === 'killed') C.cmd.alive = 0; else C.cmd.away = 1; } C.lead = -1; for (const v of B.units) if (v.side === u.side && bAlive(v)) v.morale -= 15; say(s.genFate === 'killed' ? lead + ' пал!' : lead + ' в плену!'); return; }
  if (mine.length) { const pref = t => t === 'knight' ? 0 : t === 'horse' ? 1 : t === 'sword' ? 2 : t === 'spear' ? 3 : 4;
    const g = mine.sort((a, b) => (Math.hypot(a.x - u.x, a.y - u.y) + pref(a.type) * 25 + (a.reg === 'C' ? 0 : 30)) - (Math.hypot(b.x - u.x, b.y - u.y) + pref(b.type) * 25 + (b.reg === 'C' ? 0 : 30)))[0];
    g.gen = true; if (C.cmd && C.cmd.gen) C.lead = g.id; for (const v of mine) v.morale -= 4; say(lead + ' перешёл к другому отряду'); return; }
  s.genFlee = 1; if (C.cmd && C.cmd.gen) C.cmd.away = 1; C.lead = -1; say(lead + ' покидает поле боя', '#ffb4a8'); }
// a captain's block broke or was cut down: he may fall, be taken, or ride to another block of his regiment
function onCaptFall(B, g, u, destroyed) {
  const c = g.cmd; if (!c || !c.alive || c.away || c.gen) return;
  const r = R.f(), nm = (c.t ? c.t + ' ' : '') + c.n, us = regUnits(B, g.side, g.k).filter(v => v !== u);
  if (r < (destroyed ? 0.3 : 0.04)) { c.alive = 0; c.fate = 'killed'; g.lead = -1; for (const v of us) v.morale -= 10; bsay(B, u.x, u.y - 28, nm + ' пал!', g.side === 0 ? '#ffb4a8' : '#f7d35c'); return; }
  if (r < (destroyed ? 0.45 : 0.1)) { c.away = 1; c.fate = 'captured'; g.lead = -1; for (const v of us) v.morale -= 8; bsay(B, u.x, u.y - 28, nm + ' в плену!', g.side === 0 ? '#ffb4a8' : '#f7d35c'); return; }
  if (us.length) { g.lead = pickLead(us).id; for (const v of us) v.morale -= 3; return; }
  c.away = 1; c.fate = 'fled'; g.lead = -1; }
// at the end of the battle: a captured general may be freed by the victors; a fleeing one may be caught by the pursuers
function settleGenFates(B) { const win = B.over.win;
  for (const side of [0, 1]) { const s = B.sides[side]; if (!s.gen) continue; const won = side === win;
    if (s.genFate === 'captured' && won) s.genFate = 'freed';
    else if (!s.genFate && s.genFlee) s.genFate = won ? 'escaped' : (R.f() < 0.2 && !B.over.retreat ? 'captured' : 'escaped'); } }