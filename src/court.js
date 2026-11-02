'use strict';
// ===== COURT: the walkable castle (yard + keep) — player, NPC schedules, pathing, lighting, particles, HUD =====
const COURT_SPD = [Infinity, 360, 180, 60]; // real seconds per game day at court
const COURT = { Z: 2, loc: 'keep', p: null, npcs: [], parts: [], cam: { x: 0, y: 0 }, fade: 0, fadeT: 0, fadeFn: null, prompt: null, goldPiles: 4, sacks: 3, hasBaby: 0, hasKids: 0, path: null, onArrive: null, room: '', roomT: 0, lastDay: -1, seq: 0, flash: null, sneak: false };
const hourAbs = () => 5 + (G ? G.frac : 0) * 24; // 5..29 within one game day
const hourNow = () => hourAbs() % 24;
function clockStr(h) { h = h === undefined ? hourAbs() : h; const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 6) * 10; return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }
function isNight() { const h = hourAbs(); return h >= 20.5 || h < 6; }
// outdoor ambient: returns [r,g,b] multiplier colour (255 = no darkening)
function ambientOut(h) {
  const K = [[5, [70, 80, 140]], [6, [110, 105, 160]], [7, [230, 190, 170]], [8.5, [255, 250, 245]], [16.5, [255, 250, 240]], [18.5, [255, 205, 160]], [19.8, [190, 140, 150]], [21, [80, 90, 150]], [29, [70, 80, 140]]];
  for (let i = 0; i < K.length - 1; i++) { const [h0, c0] = K[i], [h1, c1] = K[i + 1]; if (h >= h0 && h <= h1) { const t = (h - h0) / (h1 - h0); return [0, 1, 2].map(k => Math.round(c0[k] + (c1[k] - c0[k]) * t)); } } return [255, 255, 255];
}
function ambientIn(h) { const o = ambientOut(h), d = [196, 184, 196]; return [0, 1, 2].map(k => Math.round(Math.min(d[k], o[k] * 0.55 + d[k] * 0.35))); }
// ---------- pathfinding (A*, 8-dir, no corner cutting) ----------
function castar(L, sx, sy, tx, ty, maxN) {
  const W0 = L.w, N = W0 * L.h, s = sy * W0 + sx, t = ty * W0 + tx; if (s === t) return [];
  if (sx < 0 || sy < 0 || tx < 0 || ty < 0 || sx >= W0 || tx >= W0 || sy >= L.h || ty >= L.h) return null;
  const g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [], hf = [];
  const push = (i, f) => { heap.push(i); hf.push(f); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; [hf[p], hf[k]] = [hf[k], hf[p]]; k = p; } };
  const pop = () => { const top = heap[0], lh = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lh; hf[0] = lf; let k = 0; for (;;) { const a = k * 2 + 1, b = a + 1; let m = k; if (a < heap.length && hf[a] < hf[m]) m = a; if (b < heap.length && hf[b] < hf[m]) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hf[m], hf[k]] = [hf[k], hf[m]]; k = m; } } return top; };
  const hh = i => { const x = i % W0, y = (i / W0) | 0, dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  g[s] = 0; push(s, hh(s)); let n = 0; const free = (x, y) => x >= 0 && y >= 0 && x < W0 && y < L.h && (L.solid[y * W0 + x] !== 1 || y * W0 + x === t);
  while (heap.length && n++ < (maxN || 4000)) { const i = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break; const x = i % W0, y = (i / W0) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (!free(nx, ny)) continue; if (dx && dy && (!free(x + dx, y) || !free(x, y + dy))) continue; const j = ny * W0 + nx, ng = g[i] + (dx && dy ? 1.414 : 1); if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + hh(j)); } } }
  if (from[t] < 0) return null; const out = []; for (let i = t; i !== s; i = from[i]) out.push([i % W0, (i / W0) | 0]); return out.reverse();
}
function nearFree(L, tx, ty) { if (!solidAt(L, tx, ty)) return [tx, ty]; for (let r = 1; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!solidAt(L, tx + dx, ty + dy)) return [tx + dx, ty + dy]; return [tx, ty]; }
// ---------- characters at court ----------
// npc: { key, c (char or pseudo), loc, x, y (feet px), dir, path, goal, state, f, sched, away, sit, bub, bubT, spd }
function mkNpc(key, c, o) { const prev = COURT.old && COURT.old.get(key); if (prev) { prev.c = c; Object.assign(prev, o || {}); COURT.npcs.push(prev); return prev; } const n = Object.assign({ fresh: 1,  key, c, loc: 'keep', x: 0, y: 0, dir: 'down', path: null, goal: null, state: 'idle', f: 0, sched: null, away: 1, sit: null, bub: null, bubT: 0, spd: 46 + (c.age > 60 ? -10 : 0), idleT: 0, seen: {} }, o || {}); COURT.npcs.push(n); return n; }
function npcByKey(k) { return COURT.npcs.find(n => n.key === k); }
function spotOf(name) { if (!name) return null; const site = curSite(); for (const id in LOCS) { const L = LOCS[id]; if (siteOf(L) !== site) continue; const s = L.spots[name]; if (s) return s; } return null; }
function npcPlace(n, sp) { n.loc = sp.loc; n.x = sp.x; n.y = sp.y; n.dir = sp.dir; n.path = null; }
function npcGoTo(n, spName, then) { const sp = spotOf(spName); if (sp) npcGoToSp(n, sp, then); }
function npcGoToSp(n, sp, then) { // walk to a spot (across locations via doors); away NPCs re-appear where they left
  n.goal = { sp, then }; n.sit = null; n.lie = 0; n.state = 'walk';
  if (n.away) { const from = n.awaySp || spotOf(n.home || 'stairs') || sp; npcPlace(n, from); n.away = 0; }
  npcRepath(n); }
function npcRepath(n) { const sp = n.goal && n.goal.sp; if (!sp) return; const L = LOCS[n.loc]; let tx, ty;
  if (sp.loc !== n.loc) { const d = L.doors.find(d => d.to === sp.loc) || doorToward(n.loc, sp.loc); if (!d) { npcPlace(n, sp); n.path = []; return; } tx = d.x0; ty = d.y1; n.goal.door = d; } else { [tx, ty] = nearFree(L, Math.floor(sp.x / CT), Math.floor(sp.y / CT)); n.goal.door = null; }
  const [sx, sy] = nearFree(L, Math.floor(n.x / CT), Math.floor(n.y / CT)); n.path = castar(L, sx, sy, tx, ty) || []; n.pi = 0; }
function npcArrive(n) { const g = n.goal; if (!g) return;
  if (g.door) { const d = g.door, L2 = LOCS[d.to]; n.loc = d.to; n.x = d.ax; n.y = d.ay; n.dir = d.dir; npcRepath(n); return; }
  const sp = g.sp; n.x = sp.sx !== undefined ? sp.sx : sp.x; n.y = sp.sy !== undefined ? sp.sy : sp.y; n.dir = sp.dir; n.path = null; n.goal = null; n.state = 'idle'; n.sit = sp.sit ? sp : null; n.lie = sp.lie ? 1 : 0;
  if (sp.away) { n.away = 1; n.state = 'away'; n.awaySp = sp; }
  if (g.then) g.then(n); }
function npcUpdate(n, dt) {
  if (n.away || n.hold) return; if (n.bubT && n.bubT < NOW) n.bub = null;
  if (n.path) { if (n.pi >= n.path.length) { npcArrive(n); return; } const [tx, ty] = n.path[n.pi]; const gx = tx * CT + 8, gy = ty * CT + 12, dx = gx - n.x, dy = gy - n.y, d = Math.hypot(dx, dy), step = n.spd * dt;
    if (d <= step) { n.x = gx; n.y = gy; n.pi++; } else { n.x += dx / d * step; n.y += dy / d * step; n.f += step; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
    return; }
  // idle: wander areas / small fidgets
  if (n.wander && --n.idleT < 0) { const [x0, y0, x1, y1] = n.wander; const L = LOCS[n.loc]; const tx = R.i(x0, x1), ty = R.i(y0, y1); if (!solidAt(L, tx, ty)) { const [sx, sy] = [Math.floor(n.x / CT), Math.floor(n.y / CT)]; const p = castar(L, sx, sy, tx, ty, 600); if (p) { n.path = p; n.pi = 0; n.goal = { sp: { loc: n.loc, x: tx * CT + 8, y: ty * CT + 12, dir: R.pick(DIRS) } }; } } n.idleT = R.i(120, 420); }
}
// schedule: list of [hour, spot] ; spot 'wander:x0,y0,x1,y1@loc' supported
function schedTarget(n) { const S = n.sched; if (!S) return null; const h = hourAbs(); let cur = S[0]; for (const e of S) if (e[0] <= h) cur = e; if (n.override && n.override.until > h && n.override.day === G.day) return n.override.spot; return cur[1] === 'stairs' && n.bed && spotOf(n.bed) ? n.bed : cur[1]; }
function schedTick(n) { if (n.hold || n.errand) return; const t = schedTarget(n); if (!t || t === n.curT) return; n.curT = t; n.wander = null;
  if (t.startsWith('wander:')) { const [rc, loc] = t.slice(7).split('@'); const r = rc.split(',').map(Number); const sp = { loc, x: Math.round((r[0] + r[2]) / 2) * CT + 8, y: Math.round((r[1] + r[3]) / 2) * CT + 12, dir: 'down' }; npcGoToSp(n, sp, m => { m.wander = r; m.idleT = 20; }); return; }
  npcGoTo(n, t); }
function say(n, s, dur) { n.bub = s; n.bubT = NOW + (dur || 3.5); }
// ---------- who lives at court ----------
const SCHED = {
  chancellor: [[5, 'stairs'], [7.5, 'hall_e'], [11.5, 'bench_nw'], [13.5, 'hall_e2'], [16.5, 'garden_n'], [18.5, 'hall_e'], [21.5, 'stairs']],
  treasurer: [[5, 'stairs'], [7, 'tr_desk'], [12, 'stall'], [13, 'tr_desk'], [18.5, 'plaza_e'], [19.5, 'tr_desk'], [22, 'stairs']],
  marshal: [[5, 'barracks1'], [6.5, 'master'], [10.5, 'hall_w'], [13, 'master'], [16.5, 'gate_in'], [18.5, 'hall_w2'], [21, 'barracks1']],
  eye: [[5, 'stairs'], [8, 'eye_desk'], [10.5, 'eye_board'], [12, 'garden_w'], [13.5, 'eye_desk'], [18, 'hall_sw'], [20, 'eye_desk'], [23, 'stairs']],
  seneschal: [[5, 'stairs'], [6.5, 'cauldron'], [8.5, 'hall_se'], [11.5, 'granary_f'], [13, 'hall_door'], [17.5, 'well'], [19, 'hall_se'], [21.5, 'stairs']],
  magister: [[5, 'stairs'], [7, 'lib_desk'], [11.5, 'herbs'], [13, 'lib_desk'], [16.5, 'lib_globe'], [18, 'lib_read'], [23, 'stairs']],
  justice: [[5, 'stairs'], [8, 'hall_w2'], [11.5, 'bench_sw'], [13.5, 'hall_w'], [16.5, 'plaza_w'], [18.5, 'hall_w2'], [21.5, 'stairs']],
  consort: [[5, 'stairs'], [7.5, 'ch_window'], [9.5, 'consort_hall'], [12, 'bench_ne'], [14, 'garden_e'], [16, 'ch_chair'], [18.5, 'consort_hall'], [21, 'stairs']],
  heir: [[5, 'stairs'], [7.5, 'train41'], [10, 'lib_read'], [12, 'plaza_n'], [13.5, 'train43'], [16, 'lib_globe'], [18, 'garden_s'], [20, 'stairs']],
  child: [[5, 'stairs'], [8, 'ch_rug'], [10, 'wander:38,5,47,14@yard'], [12.5, 'well'], [14, 'wander:38,5,47,14@yard'], [17, 'ch_rug'], [19.5, 'stairs']],
  cook: [[5, 'kitchen'], [6, 'cauldron'], [8, 'well'], [9, 'cauldron'], [11.5, 'kitchen'], [13.5, 'cauldron'], [16.5, 'herbs'], [17.5, 'cauldron'], [20, 'kitchen']],
  maid: [[5, 'stairs'], [6.5, 'lib_mid'], [8, 'ch_rug'], [9.5, 'council_wait'], [11, 'hall_sw'], [13, 'wander:14,8,33,25@keep'], [16, 'lib_mid'], [18, 'ch_chair'], [20.5, 'stairs']],
  smith: [[5, 'barracks2'], [7, 'smith'], [12, 'well'], [13, 'smith'], [19, 'barracks2']],
  stable: [[5, 'barracks2'], [6, 'stable'], [8, 'wander:2,22,9,25@yard'], [11, 'stable'], [13, 'wander:2,22,9,25@yard'], [17, 'stable'], [20, 'barracks2']],
  gardener: [[5, 'gate_out'], [6.5, 'herbs'], [9, 'wander:38,5,47,14@yard'], [12, 'herbs'], [14, 'wander:38,5,47,14@yard'], [18, 'gate_out']],
  master: [[5, 'barracks1'], [6.5, 'master'], [12, 'barracks1'], [13, 'master'], [19, 'barracks1']],
  soldier: [[5, 'barracks1'], [7, 'train39'], [11.5, 'barracks1'], [13, 'archer1'], [17, 'wander:20,26,30,33@yard'], [19, 'barracks1']],
  soldier2: [[5, 'barracks2'], [7, 'archer2'], [11.5, 'barracks2'], [13, 'train43'], [17, 'plaza_w'], [19, 'barracks2']],
  merchant: [[5, 'gate_out'], [7.5, 'stall'], [18.5, 'gate_out']],
  page: [[5, 'stairs'], [7, 'hall_door'], [10, 'gate_in'], [12, 'keep_door'], [15, 'hall_door'], [19, 'road'], [21, 'stairs']],
};
const SERVANTS = [['cook', 'cook', 0, 48, 'Марта-повариха', 'kitchen'], ['maid', 'servant', 1, 22, 'Служанка Агата', 'stairs'], ['smith', 'servant', 0, 41, 'Кузнец Гуннар', 'barracks2'], ['stable', 'peasant', 0, 15, 'Конюх Томас', 'barracks2'], ['gardener', 'peasant', 0, 57, 'Садовник Хью', 'gate_out'],
  ['master', 'knight', 0, 44, 'Мастер над оружием', 'barracks1'], ['soldier', 'guard', 0, 23, 'Солдат', 'barracks1'], ['soldier2', 'guard', 0, 27, 'Лучник', 'barracks2'], ['merchant', 'merchant', 0, 46, 'Торговец Ансельм', 'gate_out'], ['page', 'servant', 0, 13, 'Паж Робин', 'stairs']];
const GUARDS = [['guard_dl', 'guard_dl'], ['guard_dr', 'guard_dr'], ['guard_hl', 'guard_hl'], ['guard_hr', 'guard_hr'], ['gate_l', 'gate_l'], ['gate_r', 'gate_r']];
function pseudoChar(i, role, fem, age, name) { return { id: 7000 + i, name, role, cul: 'K', fem, age, realm: 0, pseed: ((G.seed * 31 + i * 7919) >>> 0) % 1e9 + 1, traits: [], alive: 1, prison: -1, pseudo: 1 }; }
function courtPopulate() { if (G.visit) return;
  COURT.old = new Map(COURT.npcs.map(n => [n.key, n])); const vis = COURT.npcs.filter(n => n.visitor); COURT.npcs = []; const C = G.court; const firstAni = !COURT.ani || !COURT.ani.length;
  // family
  const king = charOf(G.player.char);
  for (const c of (typeof royalFamily === 'function' ? royalFamily() : [])) { if (seatOf(c)) continue; if (c.id === king.spouse) { mkNpc('spouse', c, { sched: SCHED.consort, home: 'stairs', fam: 1 }); continue; }
    if (c.age < 3) continue; mkNpc('kid' + c.id, c, { sched: c.age >= 16 ? SCHED.consort : c.age >= 10 ? SCHED.heir : SCHED.child, home: 'stairs', fam: 1, spd: c.age >= 16 ? 44 : 40 }); }
  for (const w of (C.wards || [])) { const c = charOf(w); if (c && c.alive) mkNpc('ward' + w, c, { sched: SCHED.child, home: 'stairs', spd: 40 }); }
  // council
  for (const s of SEATS) { const id = C.seats[s.k]; if (id < 0) continue; const c = charOf(id); if (!c || !c.alive || c.away) continue; mkNpc('seat_' + s.k, c, { sched: SCHED[s.k], home: s.k === 'marshal' ? 'barracks1' : 'stairs', seat: s.k }); }
  // staff
  SERVANTS.forEach((d, i) => { const c = pseudoChar(i, d[1], d[2], d[3], d[4]); mkNpc('srv_' + d[0], c, { sched: SCHED[d[0]], home: d[5], staff: d[0] }); });
  GUARDS.forEach((d, i) => { const c = pseudoChar(40 + i, 'guard', 0, 22 + i * 3, 'Стражник'); const n = mkNpc('grd_' + d[0], c, { staff: 'guard', post: d[1] }); npcPlace(n, spotOf(d[1])); n.away = 0; });
  homeExtras(); assignBeds();
  COURT.npcs.push(...vis); COURT.old = null;
  // animals
  if (firstAni) { COURT.ani = []; } const A = (kind, loc, rect, col, n) => { for (let k = 0; k < (n || 1); k++) COURT.ani.push({ kind, loc, r: rect, x: (rect[0] + R.f() * (rect[2] - rect[0] + 1)) * CT, y: (rect[1] + R.f() * (rect[3] - rect[1] + 1)) * CT, tx: 0, ty: 0, t: R.f() * 3, flip: R.f() < 0.5, col, f: 0 }); };
  if (firstAni) { A('horse', 'yard', [2, 23, 9, 25], 'brown'); A('horse', 'yard', [2, 23, 9, 25], 'dwood'); A('horse', 'yard', [2, 23, 9, 25], 'white');
  A('hen', 'yard', [9, 34, 22, 35], null, 4); A('pigeon', 'yard', [19, 17, 30, 24], null, 4); A('pigeon', 'yard', [8, 8, 12, 12], null, 2);
  A('dog', 'yard', [20, 12, 30, 30], null); A('cat', 'keep', [14, 8, 33, 26], null); homeAnimals(A); }
  npcSnap(true);
}
function npcSnap(onlyFresh) { // jump NPCs straight to where their schedule says they should be (on entering court / after time skips)
  for (const n of COURT.npcs) { if (onlyFresh && !n.fresh) continue; n.fresh = 0; if (n.follow) continue; if (n.post) { npcPlace(n, spotOf(n.post)); n.away = 0; continue; } if (n.visitor) continue;
    n.curT = null; n.hold = 0; schedTick(n); const g = n.goal; if (!g || !g.sp) continue;
    if (g.sp.away) { n.away = 1; n.awaySp = g.sp; n.goal = null; n.path = null; }
    else { npcPlace(n, g.sp); n.away = 0; if (g.sp.sx !== undefined) n.x = g.sp.sx; if (g.sp.sy !== undefined) n.y = g.sp.sy; n.sit = g.sp.sit ? g.sp : null; n.lie = g.sp.lie ? 1 : 0; n.path = null; n.goal = null; n.state = 'idle'; if (g.then) g.then(n); } }
}
// ---------- player ----------
const MOVEK = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
function curLoc() { return LOCS[COURT.loc]; }
function canStand(L, x, y) { for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 1], [5, 1]]) if (solidAt(L, Math.floor((x + dx) / CT), Math.floor((y + dy) / CT))) return false; return true; }
function courtBlocked() { return UI.modalOpen() || !!UI.win || DLG.open() || COURT.fade > 0 || (G && G.over && !G.over.ack) || (typeof TUT !== 'undefined' && TUT.blocking()); }
function playerUpdate(dt) {
  const P = COURT.p, L = curLoc(); if (!P) return;
  let dx = 0, dy = 0; if (!courtBlocked()) for (const c of input.held) { const v = MOVEK[c]; if (v) { dx += v[0]; dy += v[1]; } }
  COURT.sneak = input.held.has('ShiftLeft') || input.held.has('ShiftRight');
  if (dx || dy) { COURT.path = null; COURT.onArrive = null; if (P.sit) standUp(); }
  else if (COURT.path && !courtBlocked()) { const pt = COURT.path[0]; if (!pt) { COURT.path = null; const f = COURT.onArrive; COURT.onArrive = null; if (f) f(); } else { const gx = pt[0] * CT + 8, gy = pt[1] * CT + 11, ex = gx - P.x, ey = gy - P.y, d = Math.hypot(ex, ey); if (d < 2) COURT.path.shift(); else { dx = ex / d; dy = ey / d; } } }
  if (P.sit) return;
  if (dx || dy) { const n = Math.hypot(dx, dy), sp = (COURT.sneak ? 34 : 80) * (P.c && P.c.wound > G.day ? 0.62 : 1) * dt; const vx = dx / n * sp, vy = dy / n * sp;
    if (canStand(L, P.x + vx, P.y)) P.x += vx;
    if (canStand(L, P.x, P.y + vy)) P.y += vy;
    P.f += sp; P.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); P.moving = 1;
    if (!COURT.sneak && R.f() < dt * 0.6 && L.out) COURT.parts.push({ k: 'dust', x: P.x + R.range(-3, 3), y: P.y, vx: 0, vy: -4, t: 0, life: 0.5 });
  } else P.moving = 0;
  // doors
  const tx = Math.floor(P.x / CT), ty = Math.floor((P.y - 2) / CT);
  for (const d of L.doors) if (tx >= d.x0 && tx <= d.x1 && ty >= d.y0 && ty <= d.y1) { goThrough(d); break; }
  // auto acts (gate)
  for (const a of L.acts) if (a.auto && Math.hypot(a.x - P.x, a.y - P.y) < 14 && !COURT.autoLock) { COURT.autoLock = 1; doAct(a); }
  if (COURT.autoLock && !L.acts.some(a => a.auto && Math.hypot(a.x - P.x, a.y - P.y) < 30)) COURT.autoLock = 0;
  const rn = roomName(L, tx, ty); if (rn !== COURT.room) { COURT.room = rn; COURT.roomT = NOW; if (typeof TUT !== 'undefined') TUT.ev('room', rn); }
}
function goThrough(d) { if (COURT.fade > 0) return; for (const f of DOOR_EXT) if (f(d)) return; COURT.path = null; fadeTo(() => { COURT.loc = d.to; const P = COURT.p; P.x = d.ax; P.y = d.ay; P.dir = d.dir; snapCam(); COURT.parts = []; Snd.sfx('door'); }); }
function fadeTo(fn) { COURT.fade = 0.001; COURT.fadeT = NOW; COURT.fadeFn = fn; }
function sitAt(sp, look) { const P = COURT.p; P.x = sp.sx !== undefined ? sp.sx : sp.x; P.y = sp.sy !== undefined ? sp.sy : sp.y; P.dir = sp.dir; P.sit = sp; P.lie = sp.lie ? 1 : 0; COURT.path = null; }
function standUp() { const P = COURT.p; if (!P.sit) return; const L = curLoc(); const sp = P.sit; P.sit = null; P.lie = 0; let [tx, ty] = nearFree(L, Math.floor(sp.x / CT), Math.floor(sp.y / CT) + (sp.dir === 'down' ? 1 : 0)); if (sp === L.spots.throne) { tx = 23; ty = 7; } if (sp === L.spots.seat_king) { tx = 38; ty = 9; } P.x = tx * CT + 8; P.y = ty * CT + 11; if (COURT.audience) endAudience(); }
// click-to-move / click-to-interact
function courtClick(c) {
  if (courtBlocked()) return; const P = COURT.p, L = curLoc(); const wx = COURT.cam.x + c.ux / COURT.Z, wy = COURT.cam.y + c.uy / COURT.Z;
  if (c.b === 2) { COURT.path = null; return; }
  const t = pickTarget(wx, wy); if (t && t.e) { t.go(); return; } if (t) { const tx0 = t.n ? t.n.x : t.a.x, ty0 = t.n ? t.n.y : t.a.y; if (Math.hypot(tx0 - P.x, ty0 - P.y) < (t.n ? (t.n.talkR || 24) + 2 : t.a.r + 4)) { interact(t); return; } walkTo(tx0, ty0, () => interact(t)); return; }
  walkTo(wx, wy, null);
}
function walkTo(wx, wy, then) { const L = curLoc(), P = COURT.p; if (P.sit) standUp(); const [tx, ty] = nearFree(L, Math.floor(wx / CT), Math.floor(wy / CT)); const p = castar(L, Math.floor(P.x / CT), Math.floor((P.y - 2) / CT), tx, ty); if (!p) { UI.toast('Туда не пройти.'); return; } COURT.path = p; COURT.onArrive = then; COURT.dest = [tx, ty, NOW]; }
function pickTarget(wx, wy) { // something under the cursor: npc first, then act
  for (const f of PICK_EXT) { const t = f(wx, wy); if (t) return t; }
  const L = curLoc(); let best = null, bd = 1e9;
  for (const n of COURT.npcs) { if (n.loc !== COURT.loc || n.away || !talkable(n)) continue; if (wx > n.x - 8 && wx < n.x + 8 && wy > n.y - 30 && wy < n.y + 2) { const d = Math.abs(wy - n.y + 14); if (d < bd) { bd = d; best = { n }; } } }
  if (best) return best; for (const a of L.acts) { if (a.auto || (a.show && !a.show())) continue; if (Math.hypot(a.x - wx, a.y - wy) < Math.max(14, a.r * 0.7)) return { a }; } return null; }
function talkable(n) { return n.staff !== undefined || n.seat || n.fam || n.c.role === 'envoy' || n.petition || n.c.role === 'child' || n.key.startsWith('ward') || n.key.startsWith('kid') || n.msgr || !!n.talk; }
function nearestTarget() { // for the E prompt
  const P = COURT.p, L = curLoc(); let best = null, bd = 1e9; const fx = P.x + ({ left: -8, right: 8 }[P.dir] || 0), fy = P.y - 6 + ({ up: -8, down: 6 }[P.dir] || 0);
  for (const n of COURT.npcs) { if (n.loc !== COURT.loc || n.away || !talkable(n)) continue; const d = Math.hypot(n.x - fx, n.y - 6 - fy); if (d < (n.talkR || 24) && d < bd) { bd = d; best = { n, d }; } }
  for (const a of L.acts) { if (a.auto || (a.show && !a.show())) continue; const d = Math.hypot(a.x - P.x, a.y - P.y + 4); if (d < a.r && d * 0.9 < bd) { bd = d * 0.9; best = { a, d }; } }
  for (const f of TARGET_EXT) { const t = f(P); if (t && t.d < bd) { bd = t.d; best = t; } }
  return best; }
function interact(t) { if (!t) return; if (t.e) t.go(); else if (t.n) talkTo(t.n); else doAct(t.a); }
// ---------- animals ----------
const ANISP = { horse: 12, dog: 44, cat: 20, hen: 11, pigeon: 9 };
function lineFree(L, x0, y0, x1, y1) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6)); for (let i = 1; i <= n; i++) if (solidAt(L, Math.floor((x0 + (x1 - x0) * i / n) / CT), Math.floor((y0 + (y1 - y0) * i / n) / CT))) return false; return true; }
function aniUpdate(dt) {
  const P = COURT.p, L = curLoc();
  for (const a of COURT.ani) {
    if (a.loc !== COURT.loc || a.game) continue;
    const pd = P ? Math.hypot(P.x - a.x, P.y - a.y) : 999;
    if (a.kind === 'pigeon') {
      if (a.fly > 0) { a.fly -= dt; a.x += a.vx * dt; a.y += a.vy * dt; a.h = Math.min(34, (a.h || 0) + 46 * dt); a.f += dt * 40; continue; }
      if (a.h > 0) { a.h = Math.max(0, a.h - 24 * dt); a.f += dt * 40; const r = a.r; a.x = clamp(a.x, r[0] * CT, (r[2] + 1) * CT); a.y = clamp(a.y, r[1] * CT, (r[3] + 1) * CT); if (a.h > 0) continue; }
      if (P && pd < 30 && P.moving && !COURT.sneak) { const an = Math.atan2(a.y - P.y, a.x - P.x) + R.range(-0.7, 0.7); a.fly = R.range(0.7, 1.3); a.vx = Math.cos(an) * 64; a.vy = Math.sin(an) * 40 - 12; a.h = 1; a.flip = a.vx > 0; a.moving = 0; continue; }
    }
    if (a.moving) { const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), sp = ANISP[a.kind] * (a.run ? 2.3 : 1) * dt;
      if (d <= sp) { a.x = a.tx; a.y = a.ty; a.moving = 0; a.run = 0; a.t = R.range(1.5, a.kind === 'horse' ? 9 : a.kind === 'cat' ? 12 : 5); } else { a.x += dx / d * sp; a.y += dy / d * sp; if (Math.abs(dx) > 0.5) a.flip = dx > 0; a.f += sp; } continue; }
    a.t -= dt; a.peck = (a.kind === 'hen' || a.kind === 'pigeon') && Math.sin(NOW * 6 + a.x * 0.7) > 0.7;
    if (a.kind === 'dog' && P && pd < 96 && pd > 30 && P.moving && R.chance(dt * 1.2)) { const tx = P.x + R.range(-18, 18), ty = P.y + R.range(-4, 12); if (!solidAt(L, Math.floor(tx / CT), Math.floor(ty / CT)) && lineFree(L, a.x, a.y, tx, ty)) { a.tx = tx; a.ty = ty; a.moving = 1; a.run = 1; continue; } }
    if (a.t < 0) { const r = a.r; for (let k = 0; k < 5; k++) { const tx = (r[0] + R.f() * (r[2] - r[0] + 1)) * CT, ty = (r[1] + R.f() * (r[3] - r[1] + 1)) * CT; if (!solidAt(L, Math.floor(tx / CT), Math.floor(ty / CT)) && lineFree(L, a.x, a.y, tx, ty)) { a.tx = tx; a.ty = ty; a.moving = 1; break; } } a.t = R.range(1, 4); }
  }
}
function drawAni(g, a) {
  if (FAUNA[a.kind]) { faDraw(g, a); return; }
  if (a.st === 'dead') { const s = animalSprite(a.kind, 0, a.flip, a.col || null), oy = Math.round(s.height * 0.55) - 3; if (!a.h) { g.fillStyle = 'rgba(90,16,16,0.55)'; g.fillRect(Math.round(a.x - 4), Math.round(a.y - 1), 8, 2); } g.save(); g.translate(Math.round(a.x), Math.round(a.y - (a.h || 0) + oy)); g.scale(1, -1); g.drawImage(s, -Math.round(s.width / 2), 0); g.restore(); return; }
  const fr = (a.moving || a.fly > 0 || a.h > 0) ? (Math.floor(a.f / (a.kind === 'pigeon' ? 3 : 5)) % 2) : (a.peck ? 1 : 0);
  const s = animalSprite(a.kind, fr, a.flip, a.col || null), x = Math.round(a.x - s.width / 2), y = Math.round(a.y - s.height - (a.h || 0));
  g.drawImage(shadowSpr(s.width > 20 ? 22 : 9), Math.round(a.x - (s.width > 20 ? 11 : 4.5)), Math.round(a.y - 2)); g.drawImage(s, x, y);
}
const SHSPR = {};
function shadowSpr(w) { if (SHSPR[w]) return SHSPR[w]; const h = Math.max(3, Math.round(w / 3.4)), [c, g] = mkCanvas(w, h); g.fillStyle = 'rgba(20,12,24,0.28)'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill(); SHSPR[w] = c; return c; }
// ---------- particles ----------
function windX() { const k = G && G.weather ? G.weather.k : 'clear'; return k === 'wind' || k === 'blizzard' ? 2.2 : k === 'storm' ? 1.6 : 0.6; }
function partsUpdate(dt) {
  const L = curLoc(), night = isNight(), sea = seasonOf(G.day), P = COURT.p; const ps = COURT.parts;
  if (L.out) {
    for (const s of L.smoke) if (R.chance(dt * 2.4)) ps.push({ k: 'smoke', x: s.x + R.range(-1, 1), y: s.y, vx: windX() * 5 + R.range(-1.5, 1.5), vy: -R.range(7, 11), t: 0, life: R.range(2.6, 4.2), r: R.range(1.2, 2.2) });
    if (!L.forgeXY) { const o = L.objs.find(o => o.k === 'bld' && o.o.kind === 'forge'); L.forgeXY = o ? [o.x + 26, o.sy - 12] : [0, 0]; }
    if (L.forgeXY[0] && R.chance(dt * 5)) ps.push({ k: 'spark', x: L.forgeXY[0] + R.range(-5, 5), y: L.forgeXY[1] + R.range(-3, 3), vx: R.range(-14, 14), vy: -R.range(16, 34), t: 0, life: R.range(0.3, 0.7) });
    if (night && sea < 3) { const nf = ps.reduce((n, p) => n + (p.k === 'fly'), 0); if (nf < 12 && R.chance(dt * 3)) ps.push({ k: 'fly', x: R.range(37, 47) * CT, y: R.range(4, 15) * CT, vx: 0, vy: 0, t: 0, life: R.range(6, 12), ph: R.f() * 6 }); }
    if (sea === 2 || sea === 0) { if (!L.treeXY) L.treeXY = L.objs.filter(o => o.k === 'oak' || o.k === 'fruit').map(o => [o.x + o.w / 2, o.y + o.h * 0.35, o.w * 0.4]); for (const t of L.treeXY) if (R.chance(dt * (sea === 2 ? 0.5 : 0.25))) ps.push({ k: sea === 2 ? 'leaf' : 'petal', x: t[0] + R.range(-t[2], t[2]), y: t[1] + R.range(-6, 6), vx: windX() * 4 + R.range(-3, 3), vy: R.range(5, 9), t: 0, life: R.range(3, 5), ph: R.f() * 6, gy: t[1] + R.range(20, 40), c: R.pick(sea === 2 ? ['#c86a28', '#e0a030', '#a8401c', '#d08a30'] : ['#f4d0e0', '#ffffff', '#f0b8d0']) }); }
  } else if (!night && L.beams) { for (const b of L.beams) if (R.chance(dt * 1.2)) ps.push({ k: 'mote', x: b[0] + R.range(-6, 16), y: b[1] + R.range(8, 50), vx: R.range(-1, 1), vy: R.range(-1.5, 0.5), t: 0, life: R.range(3, 6) }); }
  for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.t += dt; if (p.t > p.life) { ps.splice(i, 1); continue; }
    if (p.k === 'smoke') { p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 1.3; p.vx += windX() * dt * 1.5; }
    else if (p.k === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
    else if (p.k === 'fly') { p.ph += dt; p.vx += (Math.sin(p.ph * 1.7) * 8 - p.vx) * dt; p.vy += (Math.cos(p.ph * 1.3) * 6 - p.vy) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    else if (p.k === 'leaf' || p.k === 'petal') { if (p.y < p.gy) { p.ph += dt * 3; p.x += (p.vx + Math.sin(p.ph) * 6) * dt; p.y += p.vy * dt; } }
    else if (p.k === 'dust' || p.k === 'mote' || p.k === 'puff') { p.x += p.vx * dt; p.y += p.vy * dt; } }
  if (ps.length > 400) ps.splice(0, ps.length - 400);
}
function drawParts(g, layer) { // layer 0: world (before light), 1: glow (after light)
  for (const p of COURT.parts) { const a = 1 - p.t / p.life;
    if (layer === 0) {
      if (p.k === 'smoke') { g.globalAlpha = 0.35 * a; g.fillStyle = '#8a8490'; g.fillRect(Math.round(p.x - p.r), Math.round(p.y - p.r), Math.round(p.r * 2), Math.round(p.r * 2)); g.globalAlpha = 0.25 * a; g.fillStyle = '#c8c2cc'; g.fillRect(Math.round(p.x - p.r + 1), Math.round(p.y - p.r), Math.round(p.r), Math.round(p.r)); }
      else if (p.k === 'dust' || p.k === 'puff') { g.globalAlpha = 0.4 * a; g.fillStyle = '#c8b898'; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); }
      else if (p.k === 'leaf' || p.k === 'petal') { g.globalAlpha = Math.min(1, a * 3); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.k === 'leaf' && Math.sin(p.ph) > 0 ? 2 : 1, 1); }
    } else {
      if (p.k === 'spark') { g.globalAlpha = a; g.fillStyle = a > 0.5 ? '#ffe080' : '#ff8030'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      else if (p.k === 'fly') { const b = (0.5 + 0.5 * Math.sin(p.ph * 4)) * Math.min(1, p.t, p.life - p.t); g.globalAlpha = b * 0.5; g.drawImage(lightSpr('#d8ff70'), Math.round(p.x) - 4, Math.round(p.y) - 4, 8, 8); g.globalAlpha = b; g.fillStyle = '#f0ffa0'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      else if (p.k === 'mote') { g.globalAlpha = 0.5 * Math.min(1, p.t, a * 2); g.fillStyle = '#fff4d0'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    } }
  g.globalAlpha = 1;
}
// ---------- lights ----------
const LSPR = {};
function hexA(c, a) { const n = parseInt(c.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
function lightSpr(col) { if (LSPR[col]) return LSPR[col]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, hexA(col, 1)); gr.addColorStop(0.3, hexA(col, 0.6)); gr.addColorStop(0.65, hexA(col, 0.18)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); LSPR[col] = c; return c; }
function dayK() { const h = hourAbs(); return h < 6 || h > 20.5 ? 0 : h < 8 ? (h - 6) / 2 : h > 18.5 ? (20.5 - h) / 2 : 1; }
function weatherDim() { const k = G.weather ? G.weather.k : 'clear'; return { cloud: 0.9, rain: 0.78, storm: 0.62, fog: 0.86, snow: 0.9, blizzard: 0.72 }[k] || 1; }
// ---------- camera ----------
function camTarget() { const P = COURT.p, L = curLoc(), vw = W / COURT.Z, vh = (H - 19) / COURT.Z; let x = P.x - vw / 2, y = P.y - 16 - vh / 2 - 19 / COURT.Z; const mw = L.w * CT, mh = L.h * CT; x = mw < vw ? (mw - vw) / 2 : clamp(x, 0, mw - vw); y = mh < vh ? mh / 2 - (H + 19) / (2 * COURT.Z) : clamp(y, -19 / COURT.Z, Math.max(0, mh - H / COURT.Z)); return [x, y]; }
function snapCam() { if (!COURT.p) return; const [x, y] = camTarget(); COURT.cam.x = x; COURT.cam.y = y; }
function camUpdate(dt) { const [x, y] = camTarget(), k = 1 - Math.exp(-dt * 7); COURT.cam.x += (x - COURT.cam.x) * k; COURT.cam.y += (y - COURT.cam.y) * k; if (Math.abs(x - COURT.cam.x) < 0.05) COURT.cam.x = x; if (Math.abs(y - COURT.cam.y) < 0.05) COURT.cam.y = y; }
