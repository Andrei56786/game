'use strict';
// ===== CAPTAINS (from battle.js): regiment commanders' tactics, the AI general, headless & auto battles, results applied to the armies =====
// ---------- captains: each regiment's commander turns the general's order into orders for his blocks ----------
function thinkInt(g) { const c = cmdOk(g), mar = c ? c.mar : 2; return (2.4 - mar * 0.1) * (c ? 1 : 1.6) * (0.85 + R.f() * 0.3); }
const capName = c => (c.t ? c.t + ' ' : '') + c.n;
function calcStance(B, side) {
  const F = B.F; if (F.siege) return side === F.defSide ? 'hold' : 'attack';
  const V = B.vis[side], pw = u => u.men * (UNIT[u.type].atk + UNIT[u.type].def) * (u.state === 'rout' ? 0.1 : 1);
  let a = 0, b = 0; for (const u of B.units) { if (!bAlive(u)) continue; if (u.side === side) a += pw(u); else if (V[u.id] || B.ghost[side][u.id]) b += pw(u); }
  const st = B.sides[side], agg = st.gen ? traitSum(st.gen, 'agg') : 0;
  return (a / Math.max(1, b)) * (1 + agg) > 0.95 || B.t > 70 ? 'attack' : 'hold';
}
function regThink(B, g) {
  const side = g.side, us = B.units;
  const mine = regUnits(B, side, g.k); if (!mine.length) { g.cur = g.order.k; return; }
  const V = B.vis[side], foes = us.filter(v => v.side !== side && bAlive(v) && v.state !== 'rout' && V[v.id]), routers = us.filter(v => v.side !== side && bAlive(v) && v.state === 'rout' && V[v.id]);
  const c = cmdOk(g), mar = c ? c.mar : 2, int = clamp(B.t - (g.lastT === undefined ? B.t - 1.5 : g.lastT), 0.2, 4); g.lastT = B.t;
  if (mine.some(u => u.contact.length)) g.engT += int;
  const L0 = leadOf(B, g) || mine[0], warn = side === 0 ? '#ffb4a8' : '#f7d35c';
  let k = g.order.k;
  // temper: a reckless captain may not hold his men back, a craven one may pull them out
  if (c && !c.gen && !B.F.siege && k === 'hold' && hasTr(c, 'reckless') && foes.some(f => mine.some(u => Math.hypot(f.x - u.x, f.y - u.y) < 130)) && R.f() < 0.12) { g.order = { k: 'adv' }; k = 'adv'; bsay(B, L0.x, L0.y - 30, capName(c) + ' не удержал полк — в атаку!', warn); }
  if (c && !c.gen && hasTr(c, 'craven') && k !== 'back' && g.engT > 4 && mine.reduce((s, u) => s + u.morale, 0) / mine.length < 38 && R.f() < 0.12) { g.order = { k: 'back' }; k = 'back'; bsay(B, L0.x, L0.y - 30, capName(c) + ' дрогнул и отводит полк!', warn); }
  if (k === 'wait' && foes.some(f => mine.some(u => Math.hypot(f.x - u.x, f.y - u.y) < (u.hidden ? 50 : 75)))) { g.order = { k: g.then || 'auto' }; k = g.order.k; bsay(B, L0.x, L0.y - 30, REGN[g.k] + ' вступает в бой!', side === 0 ? '#f7d35c' : '#ffb4a8'); }
  if (k === 'auto') k = autoK(B, g, mine, foes, routers);
  if (k === 'attack') { const t = us[g.order.t]; if (!t || !bAlive(t) || t.state === 'rout' || (!V[t.id] && !B.ghost[side][t.id])) { g.order = { k: 'hold' }; k = 'hold'; g.ax = mine.reduce((s, u) => s + u.x, 0) / mine.length; g.ay = mine.reduce((s, u) => s + u.y, 0) / mine.length; } }
  g.cur = k;
  regAnchor(B, g, k, mine, foes, int);
  for (const u of mine) { if (u.man || u.pend) continue; autoForm(B, u, g, k, foes, mar); blockTac(B, u, g, k, foes, routers, mine, c); }
}
function autoK(B, g, mine, foes, routers) {
  const side = g.side, F = B.F, st = B.stance[side], tpl = B.tpl[side];
  if (F.siege) return side === F.defSide ? 'hold' : 'adv';
  if (g.k === 'V') return mine.some(u => RANGED[u.type] && u.ammo > 0) ? 'skirm' : 'reserve';
  if (g.k === 'S' && tpl !== 'wedge') { // the reserve: strike whoever turns our flank, plug a breaking line, or chase a broken enemy
    const threat = foes.find(f => f.contact.some(c => c.side === side && Math.abs(angDiff(Math.atan2(f.y - c.y, f.x - c.x), c.face)) > 1.05)) || foes.find(f => mine.some(u => Math.hypot(f.x - u.x, f.y - u.y) < 70)) || foes.find(f => f.contact.some(c => c.side === side && (c.morale < 32 || c.men < c.men0 * 0.35)));
    if (threat) { g.tgt = threat.id; return 'strike'; }
    if (routers.length && routers.length >= foes.length) return 'pursue';
    return st === 'attack' && B.t > 110 ? 'adv' : 'reserve'; }
  if (g.k === 'R' || g.k === 'L') { const sumM = f => mine.filter(f).reduce((s, u) => s + u.men, 0), all = sumM(() => true);
    if (sumM(u => u.type === 'harch') > all * 0.5) return 'flank'; // horse archers harass the flanks whatever the stance: they never close
    if (st === 'attack' && (tpl === 'cres' || sumM(u => MOUNTED[u.type]) > all * 0.5)) return 'flank'; }
  if (routers.length && !foes.length) return 'pursue';
  return st === 'attack' ? 'adv' : 'hold';
}
// the regiment's anchor (the centre of its array) moves with the order; blocks keep their places relative to it
function regAnchor(B, g, k, mine, foes, int) {
  const side = g.side, dir = side === 0 ? 1 : -1;
  g.vmin = Math.min(...mine.map(u => UST[u.type])) * 0.9; const step = g.vmin * int;
  const free = mine.filter(u => !u.contact.length && !u.man && !RANGED[u.type]); const lag = free.length ? free.reduce((s, u) => { const p = slotOf(g, u); return s + Math.hypot(p[0] - u.x, p[1] - u.y); }, 0) / free.length : 99;
  const cx = mine.reduce((s, u) => s + u.x, 0) / mine.length, cy = mine.reduce((s, u) => s + u.y, 0) / mine.length;
  const toward = (tx, ty, stop, turn) => { const a = Math.atan2(ty - g.ay, tx - g.ax), d = Math.hypot(tx - g.ax, ty - g.ay); if (turn) g.af += clamp(angDiff(a, g.af), -0.35, 0.35); const mv = lag > 28 ? 0 : Math.min(Math.max(0, d - stop), step * 1.05); g.ax += Math.cos(a) * mv; g.ay += Math.sin(a) * mv; return d; };
  if (k === 'move') { const o = g.order; g.ax = o.x; g.ay = o.y; if (o.f !== undefined) g.af = o.f; if (mine.every(u => { const p = slotOf(g, u); return Math.hypot(p[0] - u.x, p[1] - u.y) < 14 || u.contact.length; })) g.order = { k: 'hold' }; }
  else if (k === 'adv' || k === 'pursue' || k === 'attack' || k === 'strike') {
    let t = k === 'attack' ? B.units[g.order.t] : k === 'strike' ? B.units[g.tgt] : null;
    if (!t || !bAlive(t)) { t = null; let bd = 1e9; for (const f of foes) { const d = Math.hypot(f.x - g.ax, f.y - g.ay) + Math.abs(angDiff(Math.atan2(f.y - g.ay, f.x - g.ax), g.af)) * 40; if (d < bd) { bd = d; t = f; } } }
    if (t) toward(t.x, t.y, 24, true);
    else { const gh = Object.values(B.ghost[side]).sort((p, q) => Math.hypot(p.x - g.ax, p.y - g.ay) - Math.hypot(q.x - g.ax, q.y - g.ay))[0]; if (gh) toward(gh.x, gh.y, 20, true); else toward(g.ax + dir * 200, g.ay, 0, true); }
  } else if (k === 'flank') {
    const s = g.k === 'L' ? -1 : g.k === 'R' ? 1 : (Math.sign((cy - BF.H / 2) * latS(side)) || 1), ny = latS(side) * s;
    let f = null, bs = -1e9; for (const v of foes) { const sc = (v.y - BF.H / 2) * ny - Math.abs(v.x - cx) * 0.2; if (sc > bs) { bs = sc; f = v; } }
    if (!f) toward(g.ax + dir * 200, g.ay, 0, false);
    else { if (!g.fl) g.fl = 1;
      if (g.fl === 1) { const P = { x: f.x - dir * 30, y: clamp(f.y + ny * 85, 16, BF.H - 16) }; if (Math.abs(P.y - f.y) < 40 || Math.hypot(cx - P.x, cy - P.y) < 45) g.fl = 2; else toward(P.x, P.y, 0, false); }
      if (g.fl === 2) toward(f.x, f.y, 24, true); }
  } else if (k === 'back') { if (!g.backTo) g.backTo = { x: clamp(g.ax - dir * 90, 20, BF.W - 20), y: g.ay }; const a = Math.atan2(g.backTo.y - g.ay, g.backTo.x - g.ax), d = Math.hypot(g.backTo.x - g.ax, g.backTo.y - g.ay), mv = Math.min(d, step * 1.1); g.ax += Math.cos(a) * mv; g.ay += Math.sin(a) * mv; if (d < 6 && mine.every(u => !u.contact.length)) { g.order = { k: 'hold' }; g.backTo = null; } }
  else if (k === 'reserve') { const cu = regUnits(B, side, 'C'); if (cu.length) { const ccx = cu.reduce((s, u) => s + u.x, 0) / cu.length, ccy = cu.reduce((s, u) => s + u.y, 0) / cu.length; g.ax += clamp(ccx - dir * (g.k === 'V' ? 42 : 62) - g.ax, -step, step); g.ay += clamp(ccy - g.ay, -step, step); g.af = B.regs[side].C.af; } }
  g.ax = clamp(g.ax, 16, BF.W - 16); g.ay = clamp(g.ay, 16, BF.H - 16);
}
function nearestOf(u, L, maxD) { let best = null, bd = maxD || 1e9; for (const v of L) { const d = Math.hypot(v.x - u.x, v.y - u.y); if (d < bd) { bd = d; best = v; } } return best; }
function toSlot(B, u, g, slot, dis, coh) { const [x, y] = slot, d = Math.hypot(x - u.x, y - u.y); if (d > 5) cmd(B, u, { k: 'move', x: clamp(x, 10, BF.W - 10), y: clamp(y, 10, BF.H - 10), f: g.af, dis: dis ? 1 : 0, vmax: coh && d < 40 ? g.vmin : 0 }); else if (!u.order) u.wantF = g.af; }
function engageT(B, u, g, foes, er) { let best = null, bd = 1e9;
  for (const f of foes) { const d = Math.hypot(f.x - u.x, f.y - u.y); if (d > er) continue; const a = Math.abs(angDiff(Math.atan2(f.y - u.y, f.x - u.x), g.af)); if (a > 1.25 && d > 36) continue;
    const sc = d + (a > 1.25 ? 40 : 0) - (u.type === 'spear' && charger(f) ? 18 : 0) - (f.contact.length ? 10 : 0); if (sc < bd) { bd = sc; best = f; } }
  return best; }
function blockTac(B, u, g, k, foes, routers, mine, c) {
  const slot = slotOf(g, u);
  if (u.contact.some(e => e.state !== 'rout')) { if (charger(u)) cavMelee(B, u); else if (u.type === 'harch' && k !== 'hold') harchFlee(B, u, u.contact.find(e => e.state !== 'rout')); return; }
  if (u.recover) { if (u.morale > 52 || u.contact.length) u.recover = false; else return; }
  if (!RANGED[u.type] && k !== 'pursue' && k !== 'wait' && u.morale < 28 && u.men > u.men0 * 0.25) { u.recover = true; const dir = u.side === 0 ? 1 : -1; cmd(B, u, { k: 'move', x: clamp(u.x - dir * 60, 15, BF.W - 15), y: u.y, dis: 1 }); return; }
  if (u.type === 'harch') return harchTac(B, u, g, k, foes, routers, slot);
  if (RANGED[u.type]) return shootTac(B, u, g, k, foes, slot);
  if (charger(u)) return cavTac(B, u, g, k, foes, routers, mine, slot, c);
  return footTac(B, u, g, k, foes, routers, slot, c);
}
function footTac(B, u, g, k, foes, routers, slot, c) {
  const mar = c ? c.mar : 2, d2 = f => Math.hypot(f.x - u.x, f.y - u.y);
  if (u.form === 'square' && foes.some(f => charger(f) && d2(f) < 150)) return; // the hedgehog stands
  if (k === 'back') { toSlot(B, u, g, slot, 1); return; }
  if (k === 'move' || k === 'reserve') { const e = foes.find(f => d2(f) < 30); if (e) cmd(B, u, { k: 'attack', t: e.id }); else toSlot(B, u, g, slot, 0, k === 'move'); return; }
  if (k === 'pursue') { const r = nearestOf(u, routers, 200); if (r) { cmd(B, u, { k: 'attack', t: r.id, pur: 1 }); return; } }
  if (k === 'attack' || k === 'strike') { const T = B.units[k === 'attack' ? g.order.t : g.tgt]; if (T && bAlive(T) && T.state !== 'rout') { const alt = nearestOf(u, foes.filter(f => Math.hypot(f.x - T.x, f.y - T.y) < 60)); const t = alt && d2(alt) < d2(T) - 15 ? alt : T; cmd(B, u, { k: 'attack', t: t.id }); return; } }
  if (k === 'wait') { toSlot(B, u, g, slot); return; }
  const er = k === 'hold' || k === 'skirm' ? (B.F.siege ? 60 : 44) : k === 'flank' ? (g.fl === 2 ? 150 : 30) : k === 'pursue' ? 120 : 80;
  const leash = (k === 'hold' || k === 'skirm' ? 70 : 230) * (hasTr(c, 'reckless') ? 1.4 : 1) * (mar < 5 ? 1.3 : 1);
  const t = engageT(B, u, g, foes, er);
  if (t && Math.hypot(slot[0] - t.x, slot[1] - t.y) < leash + er * 0.5) { cmd(B, u, { k: 'attack', t: t.id }); return; }
  toSlot(B, u, g, slot, 0, k === 'adv' || k === 'flank');
}
function shootTac(B, u, g, k, foes, slot) {
  const side = u.side, dir = side === 0 ? 1 : -1, d2 = f => Math.hypot(f.x - u.x, f.y - u.y), rng = bRange(B, u), H = u.type === 'harch';
  if (k === 'wait' && u.hidden) return;
  const threat = k === 'wait' ? null : nearestOf(u, foes.filter(f => !RANGED[f.type] && !f.contact.length), H ? 80 : 60);
  if (threat) {
    if (H) { let vx = u.x - threat.x, vy = u.y - threat.y; const l = Math.hypot(vx, vy) || 1; vx = vx / l - dir * 0.5; vy /= l; const l2 = Math.hypot(vx, vy) || 1; cmd(B, u, { k: 'move', x: clamp(u.x + vx / l2 * 80, 12, BF.W - 12), y: clamp(u.y + vy / l2 * 80, 12, BF.H - 12), dis: 1 }); return; }
    const cover = nearestOf(u, B.units.filter(v => v.side === side && bAlive(v) && v.state !== 'rout' && !RANGED[v.type] && v.morale > 30 && !v.contact.length));
    const bx = cover ? cover.x - dir * 34 : u.x - dir * 60, by = cover ? cover.y + (u.y > cover.y ? 10 : -10) : u.y; cmd(B, u, { k: 'move', x: clamp(bx, 12, BF.W - 12), y: clamp(by, 12, BF.H - 12), dis: 1 }); return; }
  if (u.ammo <= 0) { if (k === 'adv' || k === 'pursue') { const t = foes.find(f => f.contact.some(x => x.side === side) && d2(f) < 90); if (t && u.morale > 40) { cmd(B, u, { k: 'attack', t: t.id }); return; } }
    const C = B.regs[side].C; toSlot(B, u, g, [C.ax - dir * 44, clamp(u.y, 16, BF.H - 16)]); return; }
  const inR = foes.filter(f => d2(f) < rng * 0.95);
  if (inR.length) { const pref = f => d2(f) + (f.contact.length ? 40 : 0) - (u.type === 'xbow' && (f.type === 'knight' || f.type === 'sword') ? 30 : 0) - (charger(f) ? 15 : 0); const t = inR.sort((a, b) => pref(a) - pref(b))[0]; cmd(B, u, { k: 'attack', t: t.id }); return; }
  if (k === 'skirm' || k === 'adv' || k === 'flank' || k === 'pursue' || k === 'attack' || k === 'strike') {
    const T = k === 'attack' ? B.units[g.order.t] : k === 'strike' ? B.units[g.tgt] : null, tg = T && bAlive(T) ? T : nearestOf(u, foes);
    if (tg) { const Cu = regUnits(B, side, 'C'), front = Cu.length ? (dir > 0 ? Math.max(...Cu.map(v => v.x)) : Math.min(...Cu.map(v => v.x))) : u.x;
      const lim = front + dir * (k === 'skirm' ? 90 : 400), a = Math.atan2(tg.y - u.y, tg.x - u.x), dd = Math.min(d2(tg) - rng * 0.85, 60); let nx = u.x + Math.cos(a) * dd, ny = u.y + Math.sin(a) * dd;
      if (!H && dir * (nx - lim) > 0) nx = lim; if (Math.abs(nx - u.x) + Math.abs(ny - u.y) > 4) { cmd(B, u, { k: 'move', x: clamp(nx, 12, BF.W - 12), y: clamp(ny, 12, BF.H - 12) }); return; } } }
  toSlot(B, u, g, slot, 0, k === 'adv');
}
// horse archers never trade blows: they ride round the flank, loose into the side and rear of the enemy line and wheel away from anyone who comes at them
function harchTac(B, u, g, k, foes, routers, slot) {
  const side = u.side, dir = side === 0 ? 1 : -1, rng = bRange(B, u), d2 = f => Math.hypot(f.x - u.x, f.y - u.y), cl = p => [clamp(p[0], 14, BF.W - 14), clamp(p[1], 14, BF.H - 14)];
  const go = (p, dis) => { p = cl(p); cmd(B, u, { k: 'move', x: p[0], y: p[1], dis: dis ? 1 : 0 }); };
  if (k === 'wait') { if (!u.hidden) toSlot(B, u, g, slot); return; }
  if (k === 'back' || k === 'move') { toSlot(B, u, g, slot, k === 'back' ? 1 : 0); return; }
  // 1. danger: horsemen or free foot closing in — wheel away, a little toward our own lines, sliding along the field's edge
  const thr = nearestOf(u, foes.filter(f => !f.contact.length && !RANGED[f.type] && d2(f) < (charger(f) ? 125 : 88)));
  if (thr) { harchFlee(B, u, thr); return; }
  // 2. quiver empty: ride down the fleeing or go back behind the lines
  if (u.ammo <= 0) { const r = (k === 'pursue' || k === 'adv') && nearestOf(u, routers, 220); if (r) { cmd(B, u, { k: 'attack', t: r.id, pur: 1 }); return; } const C = B.regs[side].C; toSlot(B, u, g, [C.ax - dir * 50, clamp(slot[1], 16, BF.H - 16)]); return; }
  const inR = foes.filter(f => d2(f) < rng * 0.95);
  // 3. holding: shoot whatever comes in range from where they stand
  if (k === 'hold' || k === 'reserve') { if (inR.length) { const t = inR.sort((a, b) => d2(a) + (RANGED[a.type] ? 30 : 0) - d2(b) - (RANGED[b.type] ? 30 : 0))[0]; cmd(B, u, { k: 'attack', t: t.id }); } else toSlot(B, u, g, slot); return; }
  if (!foes.length) { if (k === 'pursue') { const r = nearestOf(u, routers, 300); if (r) { cmd(B, u, { k: 'attack', t: r.id, pur: 1 }); return; } } toSlot(B, u, g, slot); return; }
  // 4. pick a mark: pinned foot first (it cannot chase), never the lances; keep clear of the enemy horse
  const ys = foes.map(f => f.y), minY = Math.min(...ys), maxY = Math.max(...ys), cav = foes.filter(f => charger(f) && !f.contact.length);
  const fire = f => { let s = Math.sign(angDiff(Math.atan2(u.y - f.y, u.x - f.x), f.face)) || (u.y > f.y ? 1 : -1); const a = f.face + s * (Math.PI / 2 + 0.72), r = rng * 0.78; return cl([f.x + Math.cos(a) * r, f.y + Math.sin(a) * r]); };
  const score = f => { if (charger(f)) return 1e9; let s = d2(f) * 0.6; if (f.contact.some(x => x.side === side)) s -= 130; if (RANGED[f.type]) s += f.type === 'harch' ? 40 : 95; const p = fire(f); if (cav.some(c => Math.hypot(c.x - p[0], c.y - p[1]) < 115)) s += 140; return s; };
  const T0 = k === 'attack' ? B.units[g.order.t] : k === 'strike' ? B.units[g.tgt] : null;
  const t = T0 && bAlive(T0) && T0.state !== 'rout' && !charger(T0) ? T0 : foes.slice().sort((a, b) => score(a) - score(b))[0];
  if (!t || score(t) >= 1e9) { if (inR.length) cmd(B, u, { k: 'attack', t: inR[0].id }); else toSlot(B, u, g, slot); return; }
  const P = fire(t), relU = Math.abs(angDiff(Math.atan2(u.y - t.y, u.x - t.x), t.face));
  // at a flank or the rear and in range: stand and loose
  if (d2(t) < rng * 0.92 && (relU > 1.15 || Math.hypot(P[0] - u.x, P[1] - u.y) < 22)) { cmd(B, u, { k: 'attack', t: t.id }); return; }
  // the way to the firing place is barred by the enemy: ride round the end of his line
  const sx = P[0] - u.x, sy = P[1] - u.y, sl = Math.hypot(sx, sy) || 1;
  const barred = foes.some(f => { const q = clamp(((f.x - u.x) * sx + (f.y - u.y) * sy) / (sl * sl), 0, 1); return Math.hypot(u.x + sx * q - f.x, u.y + sy * q - f.y) < 52 && f !== t; });
  if (barred) { const lat = P[1] >= t.y ? 1 : -1, wy = lat > 0 ? maxY + 78 : minY - 78; if (wy > 14 && wy < BF.H - 14) { go([t.x - dir * 15, wy]); return; } }
  go(P);
}
function harchFlee(B, u, thr) { const dir = u.side === 0 ? 1 : -1, cl = p => [clamp(p[0], 14, BF.W - 14), clamp(p[1], 14, BF.H - 14)], dd = Math.hypot(u.x - thr.x, u.y - thr.y) || 1;
  let vx = (u.x - thr.x) / dd - dir * 0.45, vy = (u.y - thr.y) / dd; const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
  let p = cl([u.x + vx * 85, u.y + vy * 85]); if (Math.hypot(p[0] - u.x, p[1] - u.y) < 35) p = cl([u.x - vy * 85 * (u.y < BF.H / 2 ? -1 : 1), u.y + Math.abs(vx) * 85 * (u.y < BF.H / 2 ? 1 : -1)]);
  cmd(B, u, { k: 'move', x: p[0], y: p[1], dis: 1 }); u.harT = B.t; }
// charge cycling: after a few seconds of grinding melee horsemen pull out and charge again
function cavMelee(B, u) { const dir = u.side === 0 ? 1 : -1, e = u.contact.find(x => x.state !== 'rout'); if (!e) return; u.meleeT = (u.meleeT || 0) + 1.5;
  if (u.meleeT > (u.type === 'knight' ? 7 : 4.5) && e.morale > 25 && u.morale > 25) { u.meleeT = 0; u.recoil = B.t + 2.5; const a = Math.atan2(u.y - e.y, u.x - e.x); cmd(B, u, { k: 'move', x: clamp(u.x + Math.cos(a) * 55 - dir * 15, 12, BF.W - 12), y: clamp(u.y + Math.sin(a) * 55, 12, BF.H - 12), dis: 1 }); } }
// the weight of missile fire that can reach a point (besides the mark itself), per man of the block — a captain will not ride into a storm of bolts while the lines still stand apart
function fireOn(B, u, x, y, foes, skip) { let s = 0; for (const f of foes) { if (f === skip || !RANGED[f.type] || f.ammo <= 0 || f.contact.length || f.form === 'column') continue; if (Math.hypot(f.x - x, f.y - y) < bRange(B, f) + 20) s += f.men * SHOT[f.type].hit * SHOT[f.type].vol / UNIT[f.type].cd * ARM[u.type][f.type === 'xbow' ? 1 : 0]; } return s / Math.max(10, u.men); }
// the straight way to (tx,ty) is barred by other enemy blocks: a waypoint round the end of the enemy line, or null if the way is clear
function detourPt(B, u, tx, ty, foes, t) { const sx = tx - u.x, sy = ty - u.y, sl2 = sx * sx + sy * sy || 1, dir = u.side === 0 ? 1 : -1;
  const barred = foes.some(f => { if (f === t || (t && t.contact.includes(f))) return false; const q = ((f.x - u.x) * sx + (f.y - u.y) * sy) / sl2; if (q <= 0.05 || q >= 0.97) return false; return Math.hypot(u.x + sx * q - f.x, u.y + sy * q - f.y) < bRad(f) + bRad(u) + 6; });
  if (!barred) return null; const ys = foes.map(f => f.y), lo = Math.min(...ys) - 70, hi = Math.max(...ys) + 70;
  const cand = [lo, hi].filter(y => y > 14 && y < BF.H - 14).sort((a, b) => Math.abs(a - u.y) + Math.abs(a - ty) * 0.5 - Math.abs(b - u.y) - Math.abs(b - ty) * 0.5);
  return cand.length ? [clamp(tx - dir * 20, 12, BF.W - 12), cand[0]] : false; }
function cavTac(B, u, g, k, foes, routers, mine, slot, c) {
  const side = u.side, dir = side === 0 ? 1 : -1, d2 = f => Math.hypot(f.x - u.x, f.y - u.y), byD = L => L.sort((a, b) => d2(a) - d2(b));
  if (k === 'wait') { toSlot(B, u, g, slot); return; }
  u.meleeT = 0; if (u.recoil && B.t < u.recoil) return;
  if (k === 'back' || k === 'move' || (k === 'flank' && g.fl !== 2)) { toSlot(B, u, g, slot, k === 'back' ? 1 : 0, k !== 'back'); return; }
  // a block already at the gallop holds to its mark
  if (u.order && u.order.k === 'attack' && u.ch > 0.2) { const T = B.units[u.order.t]; if (T && bAlive(T) && T.state !== 'rout' && d2(T) < 80) return; }
  const leash = (k === 'hold' || k === 'reserve' ? 100 : 300) * (hasTr(c, 'reckless') ? 1.3 : 1), inL = f => Math.hypot(f.x - slot[0], f.y - slot[1]) < leash;
  const prot = f => foes.some(h => h !== f && (h.type === 'spear' || h.type === 'sword' || h.type === 'knight') && Math.hypot(f.x - h.x, f.y - h.y) < 42);
  const frontal = t => t.form === 'square' || Math.abs(angDiff(Math.atan2(u.y - t.y, u.x - t.x), t.face)) < 1.0;
  // how much fire the captain will brave: more once the lines have closed, more for a reckless man, none of this when the king himself named the mark
  const engF = foes.length ? foes.filter(f => f.contact.some(x => x.side === side)).length / foes.length : 0;
  const Z = (engF > 0.3 ? 1.2 : 0.3) * (hasTr(c, 'reckless') ? 1.5 : 1) * (hasTr(c, 'cautious') ? 0.8 : 1);
  const safe = (f, z) => fireOn(B, u, f.x, f.y, foes, f) < (z || Z), noSq = f => f.form !== 'square';
  let t = null;
  if (k === 'attack') { const T = B.units[g.order.t]; if (T && bAlive(T) && B.vis[side][T.id]) t = T; }
  if (k === 'strike') { const T = B.units[g.tgt]; if (T && bAlive(T) && B.vis[side][T.id] && noSq(T) && !(T.type === 'spear' && frontal(T) && !T.contact.length)) t = T; }
  if (!t && k === 'pursue' && routers.length) { const r = byD(routers.slice())[0]; if (d2(r) < 300) t = r; }
  if (!t) { const arch = byD(foes.filter(f => RANGED[f.type] && !prot(f) && inL(f) && safe(f))); if (arch.length && (k !== 'hold' && k !== 'reserve' || d2(arch[0]) < 90)) t = arch[0]; }
  if (!t && k !== 'hold' && k !== 'reserve') { const eng = byD(foes.filter(f => f.contact.some(x => x.side === side) && !(f.type === 'spear' && frontal(f)) && noSq(f) && inL(f) && safe(f, Z * 1.4))); if (eng.length && d2(eng[0]) < 240) t = eng[0]; }
  if (!t) { const raid = byD(foes.filter(f => MOUNTED[f.type] && mine.concat(B.units.filter(v => v.side === side && RANGED[v.type] && bAlive(v))).some(m => RANGED[m.type] && Math.hypot(m.x - f.x, m.y - f.y) < 90) && inL(f))); if (raid.length) t = raid[0]; }
  if (!t && routers.length && k !== 'hold' && k !== 'reserve') { const r = byD(routers.slice())[0]; if (d2(r) < 150) t = r; }
  if (!t && (k === 'adv' || k === 'flank')) { t = byD(foes.filter(f => f.type !== 'spear' && noSq(f) && inL(f) && safe(f)))[0] || null; }
  if (!t && (k === 'hold' || k === 'reserve')) { t = byD(foes.filter(f => d2(f) < 70 && f.type !== 'spear' && noSq(f)))[0] || null; }
  // under arrows: ride down the shooters if nothing guards them, else draw back out of bowshot for a while
  if (!t && u.lastArr && B.t - u.lastArr < 2.5) { const sh = byD(foes.filter(f => RANGED[f.type] && d2(f) < bRange(B, f) + 25)); if (sh[0] && !prot(sh[0]) && d2(sh[0]) < 230 && safe(sh[0], Z * 1.3)) t = sh[0]; else u.shy = B.t + (k === 'hold' || k === 'reserve' ? 9 : 6); }
  if (!t) { let sv = u.shy && B.t < u.shy ? [slot[0] - dir * 75, slot[1]] : slot;
    // the place in the array lies under the enemy's bows: wait just out of their reach
    if (k !== 'hold' && k !== 'reserve' && fireOn(B, u, sv[0], sv[1], foes) > Z) { let p = [u.x, u.y]; for (let i = 0; i < 6 && fireOn(B, u, p[0], p[1], foes) > Z * 0.8; i++) p = [p[0] - dir * 30, p[1]]; sv = [clamp(p[0], 14, BF.W - 14), p[1]]; }
    toSlot(B, u, g, sv, 0, k === 'adv'); return; }
  const d = d2(t), rear = { x: t.x - Math.cos(t.face) * 42, y: t.y - Math.sin(t.face) * 42 };
  // ride round the end of the enemy line rather than through it
  if (t.state !== 'rout' && d > 60 && k !== 'attack') { const w = detourPt(B, u, t.x, t.y, foes, t); if (w) { cmd(B, u, { k: 'move', x: w[0], y: w[1] }); return; } if (w === false && RANGED[t.type]) { toSlot(B, u, g, slot); return; } }
  if (t.state !== 'rout' && d > 70 && frontal(t) && (t.contact.length || t.type === 'spear') && Math.hypot(u.x - rear.x, u.y - rear.y) > 30) cmd(B, u, { k: 'move', x: clamp(rear.x, 12, BF.W - 12), y: clamp(rear.y, 12, BF.H - 12) });
  else cmd(B, u, { k: 'attack', t: t.id, pur: t.state === 'rout' ? 1 : 0 });
}
// captains pick formations for blocks the player has not fixed; a skilled captain reacts sooner
function autoForm(B, u, g, k, foes, mar) {
  if (u.formLock || u.formTo || u.state === 'rout') return; if (R.f() > 0.35 + mar * 0.045) return;
  const T = u.type, d2 = f => Math.hypot(f.x - u.x, f.y - u.y);
  const cav = foes.some(f => charger(f) && d2(f) < 110 && !f.contact.length), arrows = B.t - u.lastArr < 4, melee = foes.some(f => !RANGED[f.type] && d2(f) < 70);
  const far = !u.contact.length && !foes.some(f => d2(f) < (MOUNTED[T] ? 220 : 170)), holdish = k === 'hold' || k === 'wait' || k === 'skirm' || k === 'reserve';
  const march = far && !holdish && u.order && u.order.k === 'move' && Math.hypot(u.order.x - u.x, u.order.y - u.y) > 60;
  let want = 'line';
  if (march) want = 'column';
  else if (T === 'spear') want = cav && !u.contact.length ? 'square' : holdish && !far ? 'close' : 'line';
  else if (T === 'levy') want = cav && !u.contact.length && holdish ? 'square' : arrows && !melee ? 'loose' : 'line';
  else if (T === 'sword') want = (holdish && !far) || (arrows && !melee) ? 'close' : 'line';
  else if (T === 'archer') want = arrows ? 'loose' : 'line';
  else if (T === 'xbow') want = arrows && !melee ? 'close' : 'line';
  else if (T === 'harch') want = 'loose';
  else if (T === 'knight') want = u.order && u.order.k === 'attack' ? 'wedge' : 'line';
  else if (T === 'horse') { const t = u.order && u.order.k === 'attack' ? B.units[u.order.t] : null; want = t && !MOUNTED[t.type] ? 'wedge' : 'line'; }
  if (u.form === 'square' && want !== 'square' && foes.some(f => charger(f) && d2(f) < 150)) return;
  if (want !== u.form && FORM_OK[T].includes(want)) setForm(B, u, want);
}
// AI generals: blow the horn for the ambush, ride to steady the wavering; the captains do the rest
function aiGeneral(B, side) {
  const regs = B.regs[side], us = B.units, V = B.vis[side], foes = us.filter(v => v.side !== side && bAlive(v) && v.state !== 'rout' && V[v.id]);
  const waiting = REGK.filter(k => regs[k].order.k === 'wait' && regUnits(B, side, k).length);
  if (waiting.length) { const engaged = ['C', 'R', 'L'].some(k => regs[k].engT > 5), close = foes.some(f => waiting.some(k => regUnits(B, side, k).some(u => Math.hypot(f.x - u.x, f.y - u.y) < 150))); if (engaged || close || B.t > 160) signal(B, side); }
  const gu = genOf(B, side); if (gu && B.t - B.rallyT[side] >= 30) { const n = us.filter(u => u.side === side && bAlive(u) && Math.hypot(u.x - gu.x, u.y - gu.y) < 110 && (u.state === 'rout' || u.morale < 30)).length; if (n >= 2) rally(B, side); }
}
// ---------- run headless ----------
function runHeadless(B) { B.headless = true; B.ai = [true, true]; for (const s of [0, 1]) initOrders(B, s); B.phase = 'fight'; updateVis(B); let n = 0; const lim = B.tl * 10 + 100; while (!B.over && n++ < lim) bStep(B, 0.1); if (!B.over) B.over = { win: 1 }; return B; }
function sideFromArmy(a, o) { const rn = rangedN(a.u);
  return { u: Object.assign(emptyU(), a.u), xp: techXp(a.realm, a.xp), morale: a.morale, fat: a.fat, gen: charOf(a.gen), ammo: rn > 0 ? Math.max(0, Math.min(40, a.arrows / Math.max(1, rn))) : 0, realm: a.realm, army: a.id, king: a.kind === 'player' && a.gen === G.player.char, ground: (o && o.ground) || (a.kind === 'lord' || a.kind === 'player' ? groundOf(a) : 'open'), name: armyLabel(a), capts: ensureCapts(a) };
}
function sideFromGarrison(S) { const lord = S.lord >= 0 ? charOf(S.lord) : null, rng = mkRng(S.id * 131 + 7); const capts = uniqCapts([0, 1, 2, 3].map(() => mkCaptain(S.ctrl, rng)), lord ? [lord.name] : [], rng);
  return { u: Object.assign(emptyU(), S.gar), xp: techXp(S.ctrl, { levy: 10, spear: 15, sword: 20, archer: 15, xbow: 15, horse: 15, harch: 15, knight: 25 }), morale: S.food > 0 ? 65 : 35, fat: 0, gen: lord && lord.alive && !(lord.prison >= 0) ? lord : null, ammo: 35, realm: S.ctrl, sett: S.id, ground: 'contentious', name: 'гарнизон ' + WD.setts[S.id].name, capts }; }
// collect survivors per side -> units
function survivors(B, side) { const u = emptyU(); for (const b of B.units) if (b.side === side) u[b.type] += Math.max(0, b.men); return roundU(u); }
function battleLosses(B, side) { let l = 0; for (const b of B.units) if (b.side === side) l += b.men0 - Math.max(0, b.men); return Math.round(l); }
function arrowsUsed(B, side) { let s = 0; for (const b of B.units) if (b.side === side && RANGED[b.type]) s += b.shots || 0; return Math.round(s); }
function regSummary(B, side) { return REGK.map(k => { const us = B.units.filter(u => u.side === side && u.reg === k); if (!us.length) return null; const g = B.regs[side][k], c = g.cmd;
  return { k, n: REGN[k], cmd: c ? capName(c) : null, mar: c ? c.mar : 0, gen: !!(c && c.gen), fate: c ? c.fate || null : null, up: c ? c.up || 0 : 0, men0: us.reduce((s, u) => s + u.men0, 0), men: Math.round(us.reduce((s, u) => s + Math.max(0, u.men), 0)), kills: Math.round(us.reduce((s, u) => s + u.kills, 0)), fled: us.some(u => u.fled || u.state === 'rout') }; }).filter(Boolean); }
// captains learn from battle (a level of skill per 10 experience); the fallen are replaced before the next fight
function settleCaptains(B) { const win = B.over.win;
  for (const side of [0, 1]) for (const k of REGK) { const g = B.regs[side][k], c = g.cmd; if (!c || c.gen) continue; if (!B.units.some(u => u.side === side && u.reg === k)) continue; const won = side === win;
    if (c.fate === 'captured' && won) c.fate = 'freed'; else if (c.fate === 'fled' && !won && !B.over.retreat && R.f() < 0.15) c.fate = 'captured';
    if (!c.ref) continue; if (c.fate === 'killed' || c.fate === 'captured') { c.ref.dead = 1; continue; }
    c.ref.xp = (c.ref.xp || 0) + (won ? 4 : 2) + (g.engT > 5 ? 2 : 0); c.up = 0; while (c.ref.xp >= 10) { c.ref.xp -= 10; if (c.ref.mar < 15) { c.ref.mar++; c.up++; } } } }
// apply results to armies / garrison
// the chase after the field is won: horsemen cut down and take the fleeing
function pursuitLoss(B) { const win = B.over.win, lo = 1 - win; let cav = 0, rest = 0; for (const u of B.units) { if (!bAlive(u)) continue; if (u.side === win && u.state !== 'rout' && MOUNTED[u.type]) cav += u.men * (u.type === 'harch' ? 0.7 : 1); if (u.side === lo) rest += u.men; }
  if (rest < 1) return 0; const p = clamp(0.06 + 0.45 * Math.min(1, cav / rest), 0.06, 0.4) * (B.over.retreat ? 0.6 : 1) * (B.F.siege && lo === B.F.defSide ? 1.3 : 1); let k = 0;
  for (const u of B.units) if (u.side === lo && bAlive(u)) { const m = u.men * p * (MOUNTED[u.type] ? 0.4 : 1); u.men -= m; k += m; } B.pursuit = Math.round(k); return k; }
function applyBattle(B) {
  pursuitLoss(B); settleGenFates(B); settleCaptains(B); const win = B.over.win, res = { win, sides: [], regs: [regSummary(B, 0), regSummary(B, 1)] };
  for (const side of [0, 1]) {
    const s = B.sides[side]; const surv = survivors(B, side); const lost = battleLosses(B, side); const winner = side === win;
    const r = { lost, killed: 0, wounded: 0, prisoners: 0 };
    r.wounded = Math.round(lost * (winner ? 0.42 : 0.25)); r.killed = lost - r.wounded;
    if (s.army) {
      const a = armyById(s.army); if (!a) { res.sides.push(r); continue; }
      a.u = surv; a.wounded += r.wounded; a.arrows = Math.max(0, a.arrows - arrowsUsed(B, side));
      a.morale = clamp(a.morale + (winner ? 8 : -18), 0, 100); a.vict = winner ? 12 : -15; a.fat = clamp(a.fat + 15, 0, 100);
      for (const t of UT) a.xp[t] = Math.min(100, (a.xp[t] || 0) + (winner ? 6 : 3));
      a.lastFight = G.day; if (a.capts) a.capts = a.capts.filter(c => !c.dead);
      if (s.genFate === 'killed' || (s.genFate === 'captured' && !winner)) { const g = charOf(a.gen); if (g) { if (s.genFate === 'killed' && a.kind !== 'player') { g.alive = 0; } else if (s.genFate === 'captured') { g.prison = B.sides[win].realm; } } }
    } else if (s.sett !== undefined) { const S = G.setts[s.sett]; S.gar = surv; }
    res.sides.push(r);
  }
  // loot & prisoners
  const W0 = B.sides[win], L0 = B.sides[1 - win];
  const wa = W0.army ? armyById(W0.army) : null, la = L0.army ? armyById(L0.army) : null;
  const loot = { food: 0, arrows: 0, weap: 0, horses: 0, gold: 0, prisoners: 0 };
  if (wa) {
    loot.prisoners = Math.round(res.sides[1 - win].lost * 0.18);
    loot.weap = Math.round(res.sides[1 - win].lost * 0.3);
    if (la) { loot.food = Math.round(la.food * 0.4); loot.arrows = Math.round(la.arrows * 0.3); loot.horses = Math.round(la.horses * 0.5 + res.sides[1 - win].lost * (mountedN(la.u) / Math.max(1, armyMen(la) + res.sides[1 - win].lost)) * 0.3); loot.gold = Math.round((la.goods || 0) * 0.8 + (la.loot || 0) + (la.kind === 'lord' ? 10 : 0) + (la.kind === 'caravan' ? caravanLoot(la) : 0)); la.food -= loot.food; la.arrows -= loot.arrows; la.horses = Math.max(0, la.horses - Math.round(la.horses * 0.5)); la.goods = 0; la.loot = 0; }
    const cap = armyCap(wa) - armyLoad(wa); loot.food = Math.min(loot.food, Math.max(0, cap));
    wa.food += loot.food; wa.arrows += loot.arrows; wa.weap += loot.weap; wa.horses += loot.horses; wa.prisoners = (wa.prisoners || 0) + loot.prisoners;
    if (wa.realm < 5) G.realms[wa.realm].gold += loot.gold;
  }
  res.loot = loot;
  // loser retreats / is destroyed
  if (la) { const m = armyMen(la); if (m < 15 || (res.sides[1 - win].lost > m * 2.5 && la.kind !== 'player')) destroyArmy(la, 'разбито'); else retreatArmy(la, wa); }
  if (wa && armyMen(wa) <= 0) destroyArmy(wa, 'погибло');
  // war score
  const ra = W0.realm, rb = L0.realm; if (ra < 5 && rb < 5 && ra !== rb) { const v = clamp(res.sides[1 - win].lost / 25, 2, 20); G.rel[ra][rb].bs = (G.rel[ra][rb].bs || 0) + v; G.rel[rb][ra].bs = (G.rel[rb][ra].bs || 0) - v; }
  if (ra === G.player.realm || rb === G.player.realm) { G.stats.battles++; if (ra === G.player.realm) G.stats.won++; if (rb < 7) G.realms[G.player.realm].fear = (G.realms[G.player.realm].fear || 0) + (ra === G.player.realm ? 3 : -2); }
  if ((ra === G.player.realm || rb === G.player.realm) && (W0.sett !== undefined || L0.sett !== undefined) && !(W0.army && armyById(W0.army) && armyById(W0.army).kind === 'player') && !(L0.army && armyById(L0.army) && armyById(L0.army).kind === 'player')) { const pw = ra === G.player.realm, mine = pw ? W0 : L0, foe = pw ? L0 : W0; log((mine.name || 'гарнизон') + (pw ? ' отбился от: ' : ' не устоял: ') + (foe.name || 'враг'), pw ? 'good' : 'bad'); }
  else if (ra === G.player.realm || rb === G.player.realm) { const pw = ra === G.player.realm, foe = pw ? L0 : W0; log((pw ? (B.over.retreat ? 'Враг отступил: ' : 'Победа над: ') : (B.over.retreat ? 'Отступили от: ' : 'Поражение от: ')) + (foe.name || 'врага') + ' · наши потери ' + res.sides[pw ? win : 1 - win].lost + ', вражеские ' + res.sides[pw ? 1 - win : win].lost, pw ? 'good' : 'bad'); }
  return res;
}
function retreatArmy(a, from) {
  if (a.siegeOf >= 0) endSiege(a);
  let dx = from ? a.x - from.x : 1, dy = from ? a.y - from.y : 0; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  for (let k = 4; k >= 1; k--) { const x = Math.floor(a.x + dx * k * 1.5), y = Math.floor(a.y + dy * k * 1.5); if (inMap(x, y) && TINFO[WD.ter[y * MW + x]].cost > 0) { a.x = x + 0.5; a.y = y + 0.5; break; } }
  a.path = null; if (a.ai) { a.ai.task = 'idle'; a.ai.t = 2; }
}
// AI-vs-AI or auto-resolve between two field armies
function autoBattle(a, b, o) {
  const B = setupBattle(sideFromArmy(a), sideFromArmy(b), armyTile(a), o); runHeadless(B); const res = applyBattle(B); res.winA = res.win === 0; return res;
}
function autoBattleGarrison(a, S, assault) {
  const wsT = WD.setts[S.id].i; const siege = assault && S.walls > 0;
  const B = setupBattle(sideFromArmy(a, { ground: 'open' }), sideFromGarrison(S), wsT, { siege, works: S.siege ? S.siege.works / Math.max(1, S.siege.need) : 1 }); runHeadless(B); const res = applyBattle(B); res.win = res.win === 0; return res;
}
