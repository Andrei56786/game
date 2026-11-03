'use strict';
// ===== HUNT (v3.3): the royal hunt in the forest beyond the east gate — the huntsman, hounds, a companion, bow and falcon, the bag =====
// G.court.huntDay — the day of the last hunt (one a day); king.wound — the day a hunting wound heals; G.court.trophies — heads for the hall
// COURT.hunt (runtime only): { kind, day, arrows, bag: [{ k, by }], comp, shots, hits, fl (arrows in flight), stuck, fal (falcon), aim, quarry }
const HUNTK = {
  deer: { n: 'Гон оленя', d: 'Гончие поднимут оленя и погонят его. Стреляйте, когда собаки остановят зверя.' },
  boar: { n: 'Охота на кабана', d: 'Раненый кабан бросается на охотника. Опасно — зато какая слава!' },
  falcon: { n: 'Соколиная охота', d: 'Сокол бьёт фазанов, уток и зайцев. Спокойная забава — и любимая при дворе.' },
};
// hp, flee speed, detection radius, target size (to hit), meat (measures to the stores), fur (gold), prestige; names for 1 / 2–4 / 5+
const GAME = {
  deer: { hp: 1, sp: 112, det: 120, sz: 0, meat: 30, fur: 0, pr: 2, n: 'олень', n2: 'оленя', n5: 'оленей' },
  doe: { hp: 1, sp: 108, det: 125, sz: 0, meat: 22, fur: 0, pr: 0, n: 'лань', n2: 'лани', n5: 'ланей', f: 1 },
  boar: { hp: 2, sp: 92, det: 85, sz: 0.02, meat: 35, fur: 0, pr: 2, n: 'кабан', n2: 'кабана', n5: 'кабанов', fierce: 1 },
  bear: { hp: 3, sp: 78, det: 95, sz: 0.08, meat: 50, fur: 10, pr: 4, n: 'медведь', n2: 'медведя', n5: 'медведей', fierce: 1 },
  wolf: { hp: 1, sp: 108, det: 135, sz: -0.04, meat: 0, fur: 5, pr: 1, n: 'волк', n2: 'волка', n5: 'волков' },
  fox: { hp: 1, sp: 104, det: 100, sz: -0.12, meat: 0, fur: 6, pr: 0, n: 'лиса', n2: 'лисы', n5: 'лис', f: 1 },
  hare: { hp: 1, sp: 122, det: 70, sz: -0.15, meat: 3, fur: 0, pr: 0, n: 'заяц', n2: 'зайца', n5: 'зайцев', zig: 1 },
  pheasant: { hp: 1, sp: 30, det: 58, sz: -0.15, meat: 2, fur: 0, pr: 0, n: 'фазан', n2: 'фазана', n5: 'фазанов', bird: 1 },
  duck: { hp: 1, sp: 20, det: 80, sz: -0.15, meat: 2, fur: 0, pr: 0, n: 'утка', n2: 'утки', n5: 'уток', f: 1, bird: 1, swim: 1 },
};
const gk = a => (a.kind === 'deer' && a.col === 'doe' ? 'doe' : a.kind);
const gameOf = a => GAME[gk(a)] || GAME.hare;
function bagStr(bag) { const c = {}; for (const b of bag) c[b.k] = (c[b.k] || 0) + 1; return Object.keys(c).map(k => { const g = GAME[k], n = c[k]; return n === 1 ? g.n : n + ' ' + plural(n, g.n, g.n2, g.n5); }).join(', '); }
function dirWord(dx, dy) { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); return ['на восток', 'на юго-восток', 'на юг', 'на юго-запад', 'на запад', 'на северо-запад', 'на север', 'на северо-восток'][(a + 8) % 8]; }
function aniFree(L, x, y, a) { const tx = Math.floor(x / CT), ty = Math.floor(y / CT); if (tx < 1 || ty < 1 || tx >= L.w - 1 || ty >= L.h - 1) return false; const i = ty * L.w + tx; return a && a.swim ? L.ter[i] === GT.WATER : !L.solid[i]; }
// ---------- the game in the forest: a fresh set for every hunt, a quieter one otherwise ----------
function huntFauna(kind) { const L = LOCS.forest; if (!L || !L.clearings || !COURT.ani) return;
  COURT.ani = COURT.ani.filter(a => !(a.loc === 'forest' && a.game === 1));
  const CL = L.clearings, snow = seasonOf(G.day) === 3, hunt = !!kind;
  const add = (k, ci, col, n) => { const [cx, cy, rx, ry] = CL[ci], g = GAME[k === 'deer' && col === 'doe' ? 'doe' : k], swim = !!g.swim;
    const r = swim ? [cx - 3, cy - 2, cx + 3, cy + 2] : [cx - rx + 1, cy - ry + 1, cx + rx - 1, cy + ry - 1];
    for (let i = 0; i < (n || 1); i++) { const a = { kind: k, loc: 'forest', r, x: 0, y: 0, tx: 0, ty: 0, t: R.f() * 3, flip: R.f() < 0.5, col: col || null, f: 0, game: 1, st: 'graze', hp: g.hp, swim, h: 0 };
      for (let t = 0; t < 40; t++) { a.x = (r[0] + R.f() * (r[2] - r[0] + 1)) * CT; a.y = (r[1] + R.f() * (r[3] - r[1] + 1)) * CT; if (aniFree(L, a.x, a.y, a)) break; }
      if (aniFree(L, a.x, a.y, a)) COURT.ani.push(a); } };
  add('pheasant', 0, null, kind === 'falcon' ? 4 : hunt ? 2 : 1); add('hare', 0, snow ? 'snow' : null, kind === 'falcon' ? 2 : 1);
  add('deer', 1, null, 1); add('deer', 1, 'doe', hunt ? 2 : 1);
  add('duck', 2, null, kind === 'falcon' ? 5 : 3); if (hunt) add('deer', 2, null, 1);
  add('boar', 3, null, kind === 'boar' ? 3 : 2);
  if (R.chance(0.3)) add('wolf', 4, null, R.i(2, 3)); else add('deer', 4, 'doe', 2); if (kind === 'boar') add('boar', 4, null, 1);
  add('hare', 5, snow ? 'snow' : null, kind === 'falcon' ? 3 : 2); add('fox', 5, null, 1); if (kind === 'falcon') add('pheasant', 5, null, 2);
  if (R.chance(0.12)) add('bear', 6); else { add('deer', 6, null, 1); add('deer', 6, 'doe', 1); } }
// ---------- movement: steer around trees; when stuck, take a path ----------
function steer(a, tx, ty, sp, dt, L, away) { let ang = away ? Math.atan2(a.y - ty, a.x - tx) : Math.atan2(ty - a.y, tx - a.x); if (a.zig) ang += Math.sin(NOW * 6 + a.x * 0.1) * 0.7;
  const st = sp * dt, sd = a.side || 1;
  for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3]) { const an = ang + da * sd, cx = Math.cos(an), cy = Math.sin(an), nx = a.x + cx * st, ny = a.y + cy * st;
    if (aniFree(L, nx, ny, a) && aniFree(L, nx + cx * 6, ny + cy * 4, a)) { a.x = nx; a.y = ny; a.f += st; if (Math.abs(cx) > 0.2) a.flip = cx > 0; a.moving = 1; return true; } }
  a.side = -sd; a.moving = 0; return false; }
function moveTo(o, tx, ty, sp, dt, L) { if (o.pth && o.pth.length) { const [px, py] = o.pth[0], gx = px * CT + 8, gy = py * CT + 10, dx = gx - o.x, dy = gy - o.y, d = Math.hypot(dx, dy), st = sp * dt;
    if (d <= st) { o.x = gx; o.y = gy; o.pth.shift(); } else { o.x += dx / d * st; o.y += dy / d * st; if (Math.abs(dx) > 0.5) o.flip = dx > 0; } o.f += st; o.moving = 1; if (NOW > o.pthT) o.pth = null; return; }
  if (Math.hypot(tx - o.x, ty - o.y) < 3) { o.moving = 0; return; }
  if (steer(o, tx, ty, sp, dt, L, false)) { o.stk = 0; return; }
  o.stk = (o.stk || 0) + dt; if (o.stk > 0.5) { o.stk = 0; const [ex, ey] = nearFree(L, Math.floor(tx / CT), Math.floor(ty / CT)), p = castar(L, Math.floor(o.x / CT), Math.floor(o.y / CT), ex, ey, 500); if (p && p.length) { o.pth = p; o.pthT = NOW + 2.5; } } }
// ---------- game behaviour: graze → alert → flee (or fly) → settle; at bay before the hounds; the fierce ones charge ----------
function huntThreat(a, L, P, g) { let thr = null, td = 1e9; const det = g.det * (COURT.sneak ? 0.5 : 1) * (P.moving ? 1 : 0.7), dk = Math.hypot(a.x - P.x, a.y - P.y);
  if (COURT.loc === 'forest' && dk < det && (dk < det * 0.4 || lineFree(L, P.x, P.y - 8, a.x, a.y - 4))) { thr = P; td = dk; }
  for (const h of COURT.ani) if (h.game === 2 && h.loc === 'forest') { const d = Math.hypot(h.x - a.x, h.y - a.y); if (d < (g.bird ? 50 : 80) && d < td) { thr = h; td = d; } }
  return thr ? { o: thr, d: td } : null; }
function gameFlee(a, from) { if (gameOf(a).bird) { birdUp(a, from || COURT.p); return; } if (from) { a.fx = from.x; a.fy = from.y; } a.st = 'flee'; a.ft = 0; a.stk = 0; a.moving = 1; a.zig = !!gameOf(a).zig; }
function gameSettle(a, L) { a.st = 'graze'; a.moving = 0; a.zig = 0; a.t = R.range(1, 3); const tx = Math.floor(a.x / CT), ty = Math.floor(a.y / CT);
  const c = (L.clearings || []).find(([cx, cy, rx, ry]) => ((tx - cx) / rx) ** 2 + ((ty - cy) / ry) ** 2 <= 1);
  a.r = c && !a.swim ? [c[0] - c[2] + 1, c[1] - c[3] + 1, c[0] + c[2] - 1, c[1] + c[3] - 1] : a.swim ? a.r : [clamp(tx - 3, 1, L.w - 2), clamp(ty - 2, 1, L.h - 2), clamp(tx + 3, 1, L.w - 2), clamp(ty + 2, 1, L.h - 2)]; }
function gameCharge(a) { a.st = 'charge'; a.ct = 0; a.tried = 0; a.moving = 1; Snd.sfx('growl'); const hn = npcByKey('srv_hunter'); if (hn) say(hn, R.pick(['Берегитесь, государь!', 'Зверь пошёл на вас! Стреляйте!']), 2.5); }
function birdUp(a, from) { if (a.st === 'dead') return; a.st = 'fly'; a.fly = 1; a.moving = 0; const an = Math.atan2(a.y - from.y, a.x - from.x) + R.range(-0.6, 0.6);
  a.vx = Math.cos(an) * 92; a.vy = Math.sin(an) * 66; a.flip = a.vx > 0; a.ft = R.range(1.6, 2.6); if (a.swim) { const L = LOCS.forest, c = L.clearings[2]; a.pcx = c[0] * CT + 8; a.pcy = c[1] * CT + 8; a.ca = Math.atan2(a.y - a.pcy, a.x - a.pcx); a.ft = R.range(2.6, 3.6); } Snd.sfx('flap'); }
function birdFly(a, dt, L) { a.ft -= dt; a.f += dt * 40;
  if (a.swim) { if (a.ft > 0) { a.ca += dt * 1.5; a.x = a.pcx + Math.cos(a.ca) * 64; a.y = a.pcy + Math.sin(a.ca) * 40; a.flip = -Math.sin(a.ca) > 0; a.h = Math.min(36, (a.h || 0) + 50 * dt); return; }
    if (!a.lx) { const r = a.r; for (let k = 0; k < 20; k++) { const x = (r[0] + R.f() * (r[2] - r[0] + 1)) * CT, y = (r[1] + R.f() * (r[3] - r[1] + 1)) * CT; if (aniFree(L, x, y, a)) { a.lx = x; a.ly = y; break; } } if (!a.lx) { a.lx = a.pcx; a.ly = a.pcy; } }
    const dx = a.lx - a.x, dy = a.ly - a.y, d = Math.hypot(dx, dy), st = 70 * dt; a.h = Math.max(0, a.h - 26 * dt); if (d > st) { a.x += dx / d * st; a.y += dy / d * st; a.flip = dx > 0; } else { a.x = a.lx; a.y = a.ly; }
    if (d <= st && a.h <= 0) { a.lx = 0; a.fly = 0; a.st = 'graze'; a.t = R.range(1, 3); } return; }
  a.x += a.vx * dt; a.y += a.vy * dt; if (a.x < 2 * CT || a.x > (L.w - 2) * CT) { a.vx = -a.vx; a.flip = a.vx > 0; } if (a.y < 2 * CT || a.y > (L.h - 2) * CT) a.vy = -a.vy;
  if (a.ft > 0) { a.h = Math.min(32, (a.h || 0) + 60 * dt); return; }
  a.h = Math.max(0, a.h - 40 * dt); if (a.h > 0) return;
  if (aniFree(L, a.x, a.y, a)) { a.fly = 0; gameSettle(a, L); } else { a.ft = 0.4; a.h = 6; } }
function grazeMove(a, dt, L) { if (a.moving) { const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), sp = (ANISP[a.kind] || 20) * dt;
    if (d <= sp || !aniFree(L, a.x + dx / d * sp, a.y + dy / d * sp, a)) { a.moving = 0; a.t = R.range(1.5, 6); } else { a.x += dx / d * sp; a.y += dy / d * sp; if (Math.abs(dx) > 0.5) a.flip = dx > 0; a.f += sp; } return; }
  a.t -= dt; a.peck = (a.kind === 'pheasant' || a.kind === 'duck') && Math.sin(NOW * 5 + a.x * 0.7) > 0.75;
  if (a.t < 0) { const r = a.r; for (let k = 0; k < 5; k++) { const tx = (r[0] + R.f() * (r[2] - r[0] + 1)) * CT, ty = (r[1] + R.f() * (r[3] - r[1] + 1)) * CT; if (aniFree(L, tx, ty, a) && (a.swim || lineFree(L, a.x, a.y, tx, ty))) { a.tx = tx; a.ty = ty; a.moving = 1; break; } } a.t = R.range(1, 4); } }
function gameUpd(a, dt, L, P, HU) { const g = gameOf(a);
  if (a.st === 'dead') { if (a.h > 0) a.h = Math.max(0, a.h - 70 * dt); return; }
  if (a.st === 'fly') { birdFly(a, dt, L); return; }
  const th = huntThreat(a, L, P, g), kd = Math.hypot(a.x - P.x, a.y - P.y); if (th) { a.fx = th.o.x; a.fy = th.o.y; a.calm = 0; } else a.calm = (a.calm || 0) + dt;
  const fierce = HU && !HU.ended && g.fierce && COURT.loc === 'forest';
  switch (a.st) {
    case 'graze': if (!th) { grazeMove(a, dt, L); return; }
      if (g.bird) { birdUp(a, th.o); return; } if (fierce && th.o === P && kd < 56 && R.chance(0.4)) { gameCharge(a); return; }
      if (th.o === P && th.d > g.det * (COURT.sneak ? 0.5 : 1) * 0.45) { a.st = 'alert'; a.at = R.range(0.5, 1.1); a.moving = 0; a.flip = P.x > a.x; return; }
      gameFlee(a); return;
    case 'alert': a.at -= dt; a.moving = 0; if (th) a.flip = th.o.x > a.x;
      if (th && (th.o !== P || th.d < g.det * (COURT.sneak ? 0.5 : 1) * 0.4)) gameFlee(a); else if (a.at <= 0) { if (th) gameFlee(a); else a.st = 'graze'; } return;
    case 'flee': { a.ft += dt; const sp = g.sp * (a.hurt ? 0.82 : 1) * (a.ft < 0.4 ? 0.7 : 1) * clamp(1 - (a.ft - 2) / 10, g.zig || a.kind === 'fox' ? 0.75 : 0.55, 1);
      if (!steer(a, a.fx, a.fy, sp, dt, L, true)) { a.stk = (a.stk || 0) + dt; if (a.stk > 0.5) { a.st = 'bay'; a.bt = R.range(2.5, 4); a.stk = 0; } } else a.stk = 0;
      if (a.calm > 2.5 && a.ft > 2) gameSettle(a, L); return; }
    case 'bay': { a.bt -= dt; a.moving = 0; let hd = 1e9; for (const h of COURT.ani) if (h.game === 2 && h.loc === 'forest') { const d = Math.hypot(h.x - a.x, h.y - a.y); if (d < hd) { hd = d; a.flip = h.x > a.x; } }
      if (fierce && kd < 70 && R.chance(dt * 0.8)) { gameCharge(a); return; }
      if (kd < (HU && HU.wpn === 'pike' ? 15 : 34) || a.bt <= 0) { gameFlee(a, kd < 80 ? P : null); a.ft = 4; a.free = NOW + 2.5; } return; }
    case 'charge': { a.ct += dt; if (!fierce || a.ct > 4 || kd > 220) { gameFlee(a, P); return; } steer(a, P.x, P.y, g.sp * 1.3, dt, L, false);
      if (kd < 34 && !a.tried) { a.tried = 1; const hn = npcByKey('srv_hunter'), cn = HU.comp && npcByKey(HU.comp);
        if (hn && Math.hypot(hn.x - P.x, hn.y - P.y) < 70 && R.chance(0.45)) { huntKill(a, 'hunter'); say(hn, 'Ага, попался! На рогатину его!', 3); return; }
        if (cn && cn.c && (cn.c.mar || 0) >= 12 && Math.hypot(cn.x - P.x, cn.y - P.y) < 70 && R.chance(0.3)) { huntKill(a, 'hunter'); say(cn, 'Не тронешь короля, зверюга!', 3); return; } }
      if (kd < 14) huntGored(a); return; }
  } }
// ---------- hounds: at heel, on the scent, holding the quarry at bay ----------
function houndBark(HU) { if (NOW > (HU.barkT || 0)) { Snd.sfx('bark'); HU.barkT = NOW + R.range(0.9, 1.7); } }
function huntScent(h, L, HU) { let best = null, bs = 1e9; const want = HU.kind === 'boar' ? ['boar'] : HU.kind === 'deer' ? ['deer', 'doe'] : ['hare', 'fox'];
  for (const a of COURT.ani) { if (a.loc !== 'forest' || a.game !== 1 || a.st === 'dead' || a.st === 'fly' || gameOf(a).bird || NOW < (a.free || 0)) continue; const d = Math.hypot(a.x - h.x, a.y - h.y); if (d > 160) continue;
    const s = d * (want.includes(gk(a)) ? 0.6 : 1); if (s < bs && lineFree(L, h.x, h.y - 4, a.x, a.y - 4)) { bs = s; best = a; } }
  return best; }
function houndUpd(h, dt, L, P, HU) { const kd = Math.hypot(h.x - P.x, h.y - P.y);
  if (h.st !== 'heel') { const q = h.q; if (!q || q.st === 'dead' || q.st === 'fly' || Math.hypot(q.x - P.x, q.y - P.y) > 640 || NOW - h.qT > 35) { h.st = 'heel'; h.q = null; h.rest = NOW + 2; if (HU.quarry === q) HU.quarry = null; } }
  if (h.st === 'heel') {
    if (!COURT.sneak && NOW > (h.rest || 0)) { const q = HU.quarry && HU.quarry.st !== 'dead' && HU.quarry.st !== 'fly' ? HU.quarry : huntScent(h, L, HU); if (q) { HU.quarry = q; h.st = 'chase'; h.q = q; h.qT = NOW; houndBark(HU); } }
    if (h.st === 'heel') { if (kd > 400) { const [tx, ty] = nearFree(L, Math.floor(P.x / CT) + 1, Math.floor(P.y / CT)); h.x = tx * CT + 8; h.y = ty * CT + 10; h.pth = null; return; }
      const an = (h.oa || 0) + NOW * 0.25, tx = P.x + Math.cos(an) * 26, ty = P.y + Math.sin(an) * 12 + 4;
      if (Math.hypot(tx - h.x, ty - h.y) > 16) moveTo(h, tx, ty, kd > 90 ? 125 : COURT.sneak ? 36 : 78, dt, L); else { h.moving = 0; h.pth = null; if (Math.abs(P.x - h.x) > 3) h.flip = P.x > h.x; } return; } }
  const q = h.q, qd = Math.hypot(q.x - h.x, q.y - h.y);
  if (q.st === 'bay') { const an = (h.oa || 0) + NOW * 1.2; moveTo(h, q.x + Math.cos(an) * 20, q.y + Math.sin(an) * 9, 95, dt, L); if (qd < 40) h.flip = q.x > h.x; if (R.chance(dt * 0.9)) houndBark(HU); return; }
  moveTo(h, q.x, q.y, 128, dt, L); if (R.chance(dt * 0.6)) houndBark(HU);
  if (qd < 16) { if (q.kind === 'hare' || q.kind === 'fox') { if (NOW > (h.bite || 0)) { h.bite = NOW + 0.8; if (R.chance(0.45)) huntKill(q, 'hounds'); } }
    else if (q.st === 'flee' && NOW > (q.free || 0)) { q.st = 'bay'; q.bt = R.range(6.5, 9); q.moving = 0; const hn = npcByKey('srv_hunter'); if (hn) say(hn, (R.chance(0.5) ? 'Держат! Гончие держат зверя — ' : 'Встал! Скорее, государь, — ') + dirWord(q.x - COURT.p.x, q.y - COURT.p.y) + '!', 3.5); } } }
// ---------- the people on the hunt: the huntsman and a companion keep near the king ----------
function folUpd(n, i, dt, L, P) { if (n.bubT && n.bubT < NOW) n.bub = null; n.loc = 'forest'; n.away = 0; n.sit = null; n.lie = 0;
  const d = Math.hypot(P.x - n.x, P.y - n.y), sp = COURT.sneak ? 34 : d > 80 ? 92 : 74;
  if (d > 420) { const [tx, ty] = nearFree(L, Math.floor(P.x / CT) - 1, Math.floor(P.y / CT) + (i ? -1 : 1)); n.x = tx * CT + 8; n.y = ty * CT + 12; n.path = null; return; }
  n.rp = (n.rp || 0) - dt;
  if (d > 40 && n.rp <= 0) { n.rp = 0.5; const fx = { left: -1, right: 1 }[P.dir] || 0, fy = { up: -1, down: 1 }[P.dir] || 0, bx = P.x - fx * 22 + (fy ? (i ? -14 : 14) : 0), by = P.y - fy * 18 + (fx ? (i ? -12 : 12) : 0);
    const [tx, ty] = nearFree(L, Math.floor(bx / CT), Math.floor(by / CT)); n.path = castar(L, Math.floor(n.x / CT), Math.floor((n.y - 2) / CT), tx, ty, 600); n.pi = 0; }
  if (d < 24) n.path = null;
  if (n.path && n.pi < n.path.length) { const [tx, ty] = n.path[n.pi], gx = tx * CT + 8, gy = ty * CT + 12, dx = gx - n.x, dy = gy - n.y, dd = Math.hypot(dx, dy), st = sp * dt;
    if (dd <= st) { n.x = gx; n.y = gy; n.pi++; } else { n.x += dx / dd * st; n.y += dy / dd * st; n.f += st; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); } }
  else { n.path = null; if (d < 70) { const dx = P.x - n.x, dy = P.y - n.y; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); } } }
// ---------- the bow and the falcon ----------
function hitChance(a, d) { const g = gameOf(a), k = kingC(), P = COURT.p; let p = 0.85 - d / 300 + ((k.mar || 10) - 10) * 0.015 + g.sz;
  if (a.st === 'flee') p -= 0.2; else if (a.st === 'bay') p += 0.25; else if (a.st === 'charge') p += 0.05; else if (!a.moving) p += 0.1;
  if (P.moving) p -= 0.1; if (k.wound > G.day) p -= 0.1; return clamp(p, 0.05, 0.95); }
function falconChance(a, d) { return clamp(0.72 + (a.st === 'fly' ? 0.12 : 0) - d / 1200 - (a.kind === 'hare' ? 0.15 : 0), 0.3, 0.92); }
function huntCanShoot(a, d, useF, L, P) { const HU = COURT.hunt; if (useF) return d < 210; return HU.arrows > 0 && a.st !== 'fly' && d < 150 && lineFree(L, P.x, P.y - 10, a.x, a.y - 6); }
function huntAim(P) { const HU = COURT.hunt, L = LOCS.forest; let best = null, bs = 1e9; const fx = { left: -1, right: 1 }[P.dir] || 0, fy = { up: -1, down: 1 }[P.dir] || 0;
  for (const a of COURT.ani) { if (a.loc !== 'forest' || a.game !== 1 || a.st === 'dead') continue; const g = gameOf(a), d = Math.hypot(a.x - P.x, a.y - P.y); if (d > 210) continue;
    const useF = HU.kind === 'falcon' && !HU.fal && (g.bird || a.kind === 'hare'); if (!huntCanShoot(a, d, useF, L, P)) continue;
    const dot = ((a.x - P.x) * fx + (a.y - P.y) * fy) / Math.max(1, d), s = d * (dot > 0.3 ? 1 : 1.8) * (a.st === 'charge' ? 0.3 : 1); if (s < bs) { bs = s; best = { a, d, useF }; } }
  return best; }
function stWord(a) { const g = gameOf(a), f = g.f; return { graze: g.bird ? 'не замечает вас' : 'пасётся, не чует вас', alert: f ? 'насторожилась' : 'насторожился', flee: f ? 'убегает' : 'убегает', bay: 'гончие держат зверя', charge: 'бросается на вас!', fly: 'в полёте' }[a.st] || ''; }
function huntTarget(t) { const a = t.a, g = gameOf(a), p = t.useF ? falconChance(a, t.d) : hitChance(a, t.d);
  return { e: 1, d: 0.5, label: (t.useF ? 'Пустить сокола: ' : 'Выстрелить: ') + g.n + ' · ' + Math.round(p * 100) + '%', sub: stWord(a) + (a.hurt ? ', ранен' + (g.f ? 'а' : '') : ''), x: a.x, y: a.y - 8 - (a.h || 0), go: () => huntShoot(a, t.useF) }; }
function huntShoot(a, useF) { const HU = COURT.hunt, P = COURT.p; if (!HU || HU.ended || NOW < (HU.cool || 0) || a.st === 'dead') return; const d = Math.hypot(a.x - P.x, a.y - P.y), g = gameOf(a), dx = a.x - P.x, dy = a.y - P.y;
  P.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); COURT.path = null; const hn = npcByKey('srv_hunter');
  if (useF) { if (HU.fal) return; HU.fal = { x: P.x, y: P.y, h: 22, st: 'out', q: a, p: falconChance(a, d), t: 0, flip: dx > 0 }; HU.cool = NOW + 0.5; Snd.sfx('flap'); if (g.bird) { if (a.st !== 'fly') birdUp(a, P); } else if (a.st !== 'flee') gameFlee(a, P); if (hn) say(hn, 'Пошёл, пошёл!', 2); return; }
  if (HU.arrows <= 0) { UI.toast('Колчан пуст — стрел больше нет.'); return; }
  HU.arrows--; HU.shots++; HU.cool = NOW + 0.75; HU.bowT = NOW; Snd.sfx('bow');
  const hit = R.f() < hitChance(a, d), ox = hit ? 0 : R.range(9, 20) * (R.f() < 0.5 ? -1 : 1), oy = hit ? 0 : R.range(-7, 7);
  HU.fl.push({ x0: P.x + (dx > 0 ? 5 : -5), y0: P.y - 15, tx: a.x + ox, ty: a.y - 7 + oy, t: 0, dur: Math.max(0.12, d / 380), hit, a });
  for (const b of COURT.ani) if (b !== a && b.loc === 'forest' && b.game === 1 && b.st === 'graze' && Math.hypot(b.x - a.x, b.y - a.y) < 60) { b.fx = P.x; b.fy = P.y; if (gameOf(b).bird) birdUp(b, P); else { b.st = 'alert'; b.at = R.range(0.2, 0.6); } } }
function arrowsUpd(HU, dt, P) { for (let i = HU.fl.length - 1; i >= 0; i--) { const f = HU.fl[i], a = f.a; f.t += dt; if (f.hit && a.st !== 'dead') { f.tx = a.x; f.ty = a.y - 7 - (a.h || 0); } if (f.t < f.dur) continue; HU.fl.splice(i, 1);
    if (f.hit && a.st !== 'dead') { HU.hits++; Snd.sfx('hit'); a.hp -= f.dmg || 1; if (a.hp <= 0) { huntKill(a, 'king'); continue; } const g = gameOf(a); a.hurt = 1;
      if (g.fierce && Math.hypot(a.x - P.x, a.y - P.y) < 130 && R.chance(0.7)) gameCharge(a); else gameFlee(a, P); UI.toast('Попали! ' + (g.f ? 'Раненая ' : 'Раненый ') + g.n + ' ещё на ногах.'); continue; }
    HU.stuck.push({ x: f.tx, y: f.ty + 7, dx: f.tx - f.x0, dy: f.ty - f.y0, t: NOW }); if (HU.stuck.length > 12) HU.stuck.shift();
    if (a.st !== 'dead') { if (gameOf(a).bird) { if (a.st !== 'fly') birdUp(a, P); } else if (a.st !== 'charge' && a.st !== 'bay') gameFlee(a, P); }
    const hn = npcByKey('srv_hunter'); if (hn && R.chance(0.6)) say(hn, R.pick(['Эх, мимо!', 'Чуть бы выше, государь…', 'Ветер снёс, не иначе.', 'Ушёл! Ничего, догоним.']), 2.5); } }
function falconUpd(HU, dt, P) { const f = HU.fal; if (!f) return; f.t += dt; const q = f.q;
  if (f.st === 'out') { if (!q || q.st === 'dead' || f.t > 9) f.st = 'back'; else { const dx = q.x - f.x, dy = q.y - f.y, d = Math.hypot(dx, dy), st = 200 * dt; f.h += ((q.h || 0) + 4 + Math.min(30, d * 0.2) - f.h) * Math.min(1, dt * 4);
      if (d <= Math.max(st, 6)) { if (R.f() < f.p) { huntKill(q, 'falcon'); f.st = 'kill'; f.kt = 1.2; } else { f.st = 'back'; if (gameOf(q).bird && q.st !== 'fly') birdUp(q, P); const hn = npcByKey('srv_hunter'); if (hn) say(hn, 'Упустил… Ничего, вернётся на перчатку.', 2.5); } }
      else { f.x += dx / d * st; f.y += dy / d * st; f.flip = dx > 0; } } return; }
  if (f.st === 'kill') { f.kt -= dt; f.x = q.x; f.y = q.y; f.h = Math.max(0, (q.h || 0) + 2); if (f.kt <= 0) f.st = 'back'; return; }
  const dx = P.x - f.x, dy = P.y - f.y, d = Math.hypot(dx, dy), st = 170 * dt; f.h += (24 - f.h) * Math.min(1, dt * 3); if (d <= Math.max(st, 8)) { HU.fal = null; return; } f.x += dx / d * st; f.y += dy / d * st; f.flip = dx > 0; }
function huntKill(a, by) { const HU = COURT.hunt, g = gameOf(a); a.st = 'dead'; a.moving = 0; a.fly = 0; a.zig = 0; a.pth = null; if (!HU) return; HU.bag.push({ k: gk(a), by }); if (HU.quarry === a) HU.quarry = null; Snd.sfx('thud');
  UI.toast((g.f ? 'Сражена ' : 'Сражён ') + g.n + ({ hounds: ' — гончие взяли!', falcon: ' — сокол не промахнулся!', hunter: ' — ловчий не сплоховал!', comp: ' — меткая стрела спутника!' }[by] || '!'));
  const hn = npcByKey('srv_hunter'); if (hn && by === 'king') say(hn, R.pick(['Славный выстрел, государь!', 'Вот это рука! Прямо под лопатку.', 'Хорош! Будет что рассказать за столом.']), 3.5);
  if (hn && by === 'hounds') say(hn, 'Ату его! Молодцы, собачки!', 3); }
function huntGored(a) { const HU = COURT.hunt, k = kingC(); if (!HU || HU.ended) return; const bear = a.kind === 'bear', days = bear ? R.i(14, 24) : R.i(8, 16);
  k.wound = G.day + days; HU.wound = days; a.st = 'flee'; a.ft = 0; a.fx = COURT.p.x; a.fy = COURT.p.y; a.free = NOW + 5; COURT.flash = NOW; Snd.sfx('thud'); Snd.sfx('growl'); if (G.speed > 0) UI.lastSpeed = G.speed;
  log('На охоте ' + (bear ? 'медведь' : 'кабан') + ' ранил короля. Рана заживёт через ' + days + ' ' + plural(days, 'день', 'дня', 'дней') + '.', 'bad');
  DLG.say(null, (bear ? 'Медведь подминает вас и рвёт когтями плечо' : 'Кабан сбивает вас с ног и распарывает клыком бедро') + '. Ловчий с криком отгоняет зверя рогатиной. Рана глубокая, но лекарь обещает: заживёт дней за ' + days + '. До тех пор — ни охоты, ни меча, и ходить придётся медленно.',
    { name: 'Беда на охоте', choices: [{ t: 'Домой, на носилках', fx: () => huntEnd('wound') }], esc: 0 }); }
// ---------- start: at the kennels or with the huntsman ----------
function huntWhyNot() { const k = kingC(), h = hourAbs(), C = G.court, w = G.weather && G.weather.k;
  if (k.wound > G.day) { const n = k.wound - G.day; return woundNot(k) + ', государь. Лекарь велел беречься — ещё ' + n + ' ' + plural(n, 'день', 'дня', 'дней') + '.'; }
  if (C.huntDay === G.day) return 'Собаки сегодня уже набегались, государь. Завтра на рассвете — хоть на медведя!';
  if (h < 6) return 'Ещё темно, государь. Выедем с рассветом, к шести.';
  if (h >= 16) return 'Поздно, государь: до темноты зверя не поднять. Завтра с утра.';
  if (w === 'storm' || w === 'blizzard') return 'В такую непогоду собаки след не возьмут, государь. Переждём.';
  return null; }
function huntAct() { if (COURT.hunt || G.visit) return; const hn = npcByKey('srv_hunter'), why = huntWhyNot(), o = hn ? {} : { name: 'Псарня' };
  if (why) { DLG.say(hn || null, why, o); return; }
  const ch = [{ t: HUNTK.deer.n + ' — с гончими', tip: HUNTK.deer.d, fx: () => huntComp('deer') }, { t: HUNTK.boar.n + ' (опасно)', tip: HUNTK.boar.d, fx: () => huntComp('boar') }];
  ch.push(projDone('falconry') ? { t: HUNTK.falcon.n, tip: HUNTK.falcon.d, fx: () => huntComp('falcon') } : { t: HUNTK.falcon.n, tip: 'Нужна соколятня — её можно заложить у стола зодчего (P).', ok: () => false, why: 'Сначала постройте соколятню (P — замыслы и стройки).', fx: () => { } });
  ch.push({ t: 'Не сегодня', fx: () => { } });
  DLG.say(hn || null, R.pick(['Гончие застоялись, государь! На кого пойдём?', 'Кони осёдланы, собаки на сворах. Куда прикажете?', 'Лес нынче полон зверя, государь. Выбирайте.']), Object.assign(o, { choices: ch, esc: ch.length - 1 })); }
function huntCompName(n) { if (n.seat) return npcTitle(n); if (n.key.startsWith('ward')) return 'Воспитанник: ' + n.c.name; return famRole(n.c) + ': ' + n.c.name; }
function huntComp(kind) { const cand = [], sp = npcByKey('spouse'); if (sp && sp.c.alive && sp.c.prison < 0) cand.push(sp);
  for (const n of COURT.npcs) if ((n.key.startsWith('kid') || n.key.startsWith('ward')) && n.c.age >= 14 && n.c.prison < 0) cand.push(n);
  for (const s of ['marshal', 'chancellor', 'eye', 'treasurer', 'seneschal', 'magister', 'justice']) { const n = npcByKey('seat_' + s); if (n && n.c.prison < 0) cand.push(n); }
  const ch = cand.slice(0, 5).map(n => ({ t: huntCompName(n), tip: 'Расположение +4…8' + (n.key === 'spouse' ? ', и день вместе' : '') + '.', fx: () => huntStart(kind, n) }));
  ch.push({ t: 'Без свиты — только ловчий и собаки', fx: () => huntStart(kind, null) });
  DLG.say(npcByKey('srv_hunter') || null, 'Кого возьмёте с собой, государь?', { choices: ch, esc: ch.length - 1 }); }
function huntStart(kind, comp) { const C = G.court, P = COURT.p; if (COURT.hunt) return; C.huntDay = G.day;
  const HU = COURT.hunt = { kind, day: G.day, arrows: 15, bag: [], comp: comp ? comp.key : null, shots: 0, hits: 0, fl: [], stuck: [], fal: null, aim: null, quarry: null, cool: 0, sayT: NOW + 7, ended: 0 };
  fadeTo(() => { const L = LOCS.forest, sp = L.spots.f_gate; COURT.loc = 'forest'; P.x = sp.x; P.y = sp.y; P.dir = 'right'; P.sit = null; P.lie = 0; COURT.path = null; COURT.onArrive = null;
    huntFauna(kind);
    [npcByKey('srv_hunter'), comp].filter(Boolean).forEach((n, i) => { Object.assign(n, { follow: 1, hold: 1, away: 0, sit: null, lie: 0, goal: null, path: null, loc: 'forest', dir: 'right', bub: null }); n.x = sp.x - 12 - i * 10; n.y = sp.y + (i ? -16 : 16); });
    const hn = npcByKey('srv_hunter'); if (hn) n2talk(hn);
    COURT.ani.filter(a => a.kind === 'hound').slice(0, kind === 'falcon' ? 2 : 3).forEach((a, i) => { Object.assign(a, { game: 2, loc: 'forest', st: 'heel', q: null, pth: null, moving: 0, oa: i * 2.1 }); a.x = sp.x + 20 + i * 10; a.y = sp.y + (i - 1) * 10; });
    snapCam(); COURT.parts = []; COURT.room = ''; Snd.sfx('horn'); UI.toast(HUNTK[kind].n + ': в королевский лес!'); }); }
function n2talk(n) { n.talk = COURT.hunt ? huntHunterTalk : huntHomeTalk; }
function huntHomeTalk(n) { huntAct(); }
function huntHint() { const HU = COURT.hunt, P = COURT.p, L = LOCS.forest; if (!HU) return '';
  const want = HU.kind === 'deer' ? ['deer', 'doe'] : HU.kind === 'boar' ? ['boar'] : ['pheasant', 'duck', 'hare']; let best = null, bd = 1e9;
  for (const a of COURT.ani) if (a.loc === 'forest' && a.game === 1 && a.st !== 'dead' && want.includes(gk(a))) { const d = Math.hypot(a.x - P.x, a.y - P.y); if (d < bd) { bd = d; best = a; } }
  if (!best) return R.pick(['Пусто кругом, государь. Зверь ушёл в самую чащу.', 'Тихо… Даже сойки молчат. Поищем у ручья?']);
  if (bd < 170) return R.pick(['Тише, государь… Зверь рядом.', 'Чуете? Совсем близко. Ступайте мягче — с Shift.']);
  const g = gameOf(best), rn = roomName(L, Math.floor(best.x / CT), Math.floor(best.y / CT));
  return 'Свежий след, государь: ' + g.n + ' — ' + dirWord(best.x - P.x, best.y - P.y) + (rn && rn !== L.name ? ', там «' + rn + '»' : '') + '.'; }
function huntHunterTalk(n) { const HU = COURT.hunt; if (!HU) { huntAct(); return; }
  DLG.say(n, huntHint() + ' Стрел в колчане: ' + HU.arrows + '.', { choices: [{ t: 'Охотимся дальше', fx: () => { } }, { t: 'Трубить отбой — домой', fx: () => huntEnd('horn') }], esc: 0 }); }
function huntChatter(HU) { if (NOW < HU.sayT) return; HU.sayT = NOW + R.range(13, 22); const hn = npcByKey('srv_hunter'), cn = HU.comp && npcByKey(HU.comp), k = kingC();
  if (cn && R.chance(0.4) && !cn.bub) { const L0 = cn.key === 'spouse' ? ['Как хорошо вырваться из душных покоев!', 'Обещайте мне беречься кабанов.', 'Смотрите, какие следы!'] : cn.key.startsWith('kid') ? [(k.fem ? 'Матушка' : 'Отец') + ', а можно мне выстрелить?', 'Я видел оленя! Вон там, за деревьями!', 'Когда-нибудь я возьму медведя!'] : ['Добрая охота, государь.', 'Свежий воздух лучше любого совета.', 'Говорят, ваш дед взял здесь медведя.']; say(cn, R.pick(L0), 4); return; }
  if (hn && !hn.bub) say(hn, huntHint(), 4.5); }
// ---------- the end: the horn, the gate, dusk — or a wound ----------
function huntDusk() { const HU = COURT.hunt; if (!HU || HU.ended || DLG.open() || UI.modalOpen() || COURT.fade) return; if (G.day !== HU.day) { huntEnd('dusk'); return; } HU.duskAsked = 1;
  DLG.say(npcByKey('srv_hunter') || null, 'Смеркается, государь. В темноте зверя не возьмёшь — пора домой.', { choices: [{ t: 'Трубить отбой', fx: () => huntEnd('dusk') }], esc: 0 }); }
function huntRelease() { const Y = LOCS.yard, P = COURT.p; let i = 0;
  for (const n of COURT.npcs) if (n.follow) { n.follow = 0; n.hold = 0; n.path = null; n.goal = null; n.curT = null; n.bub = null; if (n.key === 'srv_hunter') n.talk = huntHomeTalk;
    if (Y && P) { const [tx, ty] = nearFree(Y, Math.floor(P.x / CT) - 1 - i, Math.floor(P.y / CT) + 1); n.loc = 'yard'; n.x = tx * CT + 8; n.y = ty * CT + 12; } i++; }
  for (const a of COURT.ani) if (a.game === 2) { const r = a.r; Object.assign(a, { game: 0, loc: 'yard', st: null, q: null, pth: null, moving: 0, run: 0, t: 1 }); a.x = (r[0] + R.f() * (r[2] - r[0] + 1)) * CT; a.y = (r[1] + R.f() * (r[3] - r[1] + 1)) * CT; } }
function huntEnd(why, door) { const HU = COURT.hunt; if (!HU || HU.ended) return; HU.ended = 1;
  fadeTo(() => { const P = COURT.p, Y = LOCS.yard; COURT.loc = 'yard'; P.sit = null; P.lie = 0; COURT.path = null; COURT.onArrive = null;
    if (door) { P.x = door.ax; P.y = door.ay; P.dir = door.dir; } else { const sp = spotOf('hunter'), [tx, ty] = nearFree(Y, Math.floor(sp.x / CT) + 1, Math.floor(sp.y / CT)); P.x = tx * CT + 8; P.y = ty * CT + 11; P.dir = 'up'; }
    huntRelease(); COURT.hunt = null; huntFauna(''); snapCam(); COURT.parts = []; Snd.sfx('horn_short'); huntSummary(HU, why); }); }
function huntAbort() { if (!COURT.hunt) return; COURT.hunt = null; huntRelease(); huntFauna(''); }
function huntSummary(HU, why) { const k = kingC(), C = G.court, bag = HU.bag; let meat = 0, fur = 0, pr = 0;
  for (const b of bag) { const g = GAME[b.k]; meat += g.meat; fur += g.fur; pr += b.by === 'king' || b.by === 'falcon' ? g.pr : Math.floor(g.pr / 2); }
  if (HU.kind === 'falcon' && bag.length >= 2) pr += 1; pr = Math.min(pr, 6);
  C.grain = (C.grain || 0) + meat; G.realms[0].gold += fur; if (pr) prestige(pr);
  C.trophies = C.trophies || {}; for (const b of bag) if (b.by === 'king' && (b.k === 'deer' || b.k === 'boar' || b.k === 'bear')) C.trophies[b.k] = (C.trophies[b.k] || 0) + 1;
  const T = []; if (why === 'wound') T.push('Охота кончилась бедой — но король жив, а это главное.');
  T.push(bag.length ? 'Добыча: ' + bagStr(bag) + '.' : R.pick(['Зверь ушёл — сегодня лес оказался хитрее.', 'Без добычи. Зато гончие размяли лапы.']));
  if (meat) T.push('Мясо — на кухню и в погреба: +' + meat + ' мер.'); if (fur) T.push('Шкуры ловчий продаст: +' + fur + ' зол.'); if (pr) T.push('Слава охотника: престиж +' + pr + '.');
  const cn = HU.comp && npcByKey(HU.comp); if (cn && cn.c && !cn.c.pseudo) { const v = 4 + Math.min(4, bag.length); cn.c.loy = clamp((cn.c.loy || 50) + v, 0, 100); if (cn.key === 'spouse') C.together = G.day; T.push(huntCompName(cn) + ' — расположение +' + v + '.'); }
  if (bag.some(b => b.by === 'king' && (b.k === 'boar' || b.k === 'bear'))) { k.mx = (k.mx || 0) + 1; if (k.mx >= 6) { k.mx = 0; k.mar = Math.min(20, k.mar + 1); T.push('Рука крепнет: Меч короля +1.'); } }
  huntSum2(HU, T, why);
  if (HU.shots) T.push('Стрел пущено: ' + HU.shots + ', в цель: ' + HU.hits + '.');
  log('Королевская охота' + (bag.length ? ': ' + bagStr(bag) : ' без добычи') + '.', bag.length ? 'good' : 'info');
  DLG.say(null, T.join(' '), { name: 'Итоги охоты' }); }
// ---------- hooks ----------
ACTS_EXT.kennel = () => huntAct();
POP_EXT.push(() => { const n = npcByKey('srv_hunter'); if (n) n2talk(n); });
ENTER_EXT.push(() => huntAbort());
DOOR_EXT.push(d => { const HU = COURT.hunt; if (!HU || HU.ended || COURT.loc !== 'forest' || d.to !== 'yard') return false; const P = COURT.p; P.x += 14; COURT.path = null; COURT.onArrive = null;
  DLG.say(npcByKey('srv_hunter') || null, 'Уже домой, государь? ' + (HU.bag.length ? 'Добыча славная!' : 'Зверь ещё не взят…'), { choices: [{ t: 'Трубить отбой — домой', fx: () => huntEnd('gate', d) }, { t: 'Ещё поохотимся', fx: () => { } }], esc: 1 }); return true; });
UPD_EXT.push(dt => { if (G.visit) return; const HU = COURT.hunt;
  if (HU && !HU.ended && (G.day !== HU.day || (hourAbs() >= 19.5 && !HU.duskAsked))) huntDusk();
  if (COURT.loc !== 'forest') return; const L = LOCS.forest, P = COURT.p; if (!L || !P) return;
  for (const a of COURT.ani) { if (a.loc !== 'forest') continue; if (a.game === 1) gameUpd(a, dt, L, P, HU); else if (a.game === 2 && HU) houndUpd(a, dt, L, P, HU); }
  if (!HU || HU.ended) return;
  COURT.npcs.filter(n => n.follow).forEach((n, i) => folUpd(n, i, dt, L, P));
  arrowsUpd(HU, dt, P); falconUpd(HU, dt, P); HU.aim = huntAim(P); huntChatter(HU);
  if (HU.stuck.length && NOW - HU.stuck[0].t > 10) HU.stuck.shift(); });
TARGET_EXT.push(() => { const HU = COURT.hunt; return HU && !HU.ended && HU.aim && COURT.loc === 'forest' ? huntTarget(HU.aim) : null; });
PICK_EXT.push((wx, wy) => { const HU = COURT.hunt; if (!HU || HU.ended || COURT.loc !== 'forest') return null; const P = COURT.p, L = LOCS.forest;
  for (const a of COURT.ani) { if (a.loc !== 'forest' || a.game !== 1 || a.st === 'dead') continue; const s = animalSprite(a.kind, 0, a.flip, a.col || null), hw = s.width / 2 + 2, top = a.y - s.height - (a.h || 0) - 2;
    if (wx < a.x - hw || wx > a.x + hw || wy < top || wy > a.y + 3) continue; const g = gameOf(a), d = Math.hypot(a.x - P.x, a.y - P.y), useF = HU.kind === 'falcon' && !HU.fal && (g.bird || a.kind === 'hare');
    if (huntCanShoot(a, d, useF, L, P)) return huntTarget({ a, d, useF });
    const why = huntWhy(a, d, useF);
    return { e: 1, d: 1e9, label: g.n[0].toUpperCase() + g.n.slice(1), sub: why, x: a.x, y: a.y - 8 - (a.h || 0), go: () => UI.toast('Не выстрелить: ' + why + '.') }; }
  return null; });
// ---------- drawing: arrows, the falcon, the aim, alarms; the HUD panel ----------
function drawArrowPx(g, x, y, ux, uy, n) { g.fillStyle = '#d8c090'; for (let i = 1; i < n; i++) g.fillRect(Math.round(x - ux * i), Math.round(y - uy * i), 1, 1); g.fillStyle = '#e8eef4'; g.fillRect(Math.round(x), Math.round(y), 1, 1); g.fillStyle = '#c83030'; g.fillRect(Math.round(x - ux * (n - 1)), Math.round(y - uy * (n - 1)), 1, 1); }
CRENDER2.push((g, L) => { if (L.id !== 'forest') return; const HU = COURT.hunt, P = COURT.p;
  for (const a of COURT.ani) if (a.loc === 'forest' && a.game === 1 && (a.st === 'alert' || a.st === 'charge')) { const s = animalSprite(a.kind, 0, a.flip, a.col || null), x = Math.round(a.x), y = Math.round(a.y - s.height - (a.h || 0) - 7);
    g.fillStyle = PAL.o; g.fillRect(x - 1, y - 1, 3, 7); g.fillStyle = a.st === 'charge' ? '#ff4030' : '#ffe060'; g.fillRect(x, y, 1, 3); g.fillRect(x, y + 4, 1, 1); }
  if (!HU) return;
  for (const s of HU.stuck) { const d = Math.hypot(s.dx, s.dy) || 1; drawArrowPx(g, s.x, s.y, s.dx / d * 0.7, s.dy / d * 0.4 - 0.5, 6); }
  for (const f of HU.fl) { const k = Math.min(1, f.t / f.dur), dd = Math.hypot(f.tx - f.x0, f.ty - f.y0) || 1, arc = Math.sin(Math.PI * k) * Math.min(14, dd * 0.06), x = f.x0 + (f.tx - f.x0) * k, y = f.y0 + (f.ty - f.y0) * k - arc;
    const vy = (f.ty - f.y0) / dd - Math.cos(Math.PI * k) * 0.25, vx = (f.tx - f.x0) / dd, vn = Math.hypot(vx, vy) || 1; drawArrowPx(g, x, y, vx / vn, vy / vn, 7); }
  if (HU.fal) { const f = HU.fal, s = animalSprite('falcon', f.st === 'kill' ? 5 : 6 + Math.floor(NOW * 12) % 4, f.flip, null); g.drawImage(shadowSpr(9), Math.round(f.x - 4.5), Math.round(f.y - 2)); g.drawImage(s, Math.round(f.x - s.width / 2), Math.round(f.y - s.height - f.h)); }
  if (P && HU.bowT && NOW - HU.bowT < 0.3) { const sx = { left: -1, right: 1 }[P.dir] || 0, x = Math.round(P.x + sx * 7), y = Math.round(P.y - 22); g.fillStyle = '#6a4020'; if (sx) for (let i = -5; i <= 5; i++) g.fillRect(x + Math.round(sx * (2 - i * i / 12)), y + i, 1, 1); else for (let i = -5; i <= 5; i++) g.fillRect(x + i, y + Math.round((P.dir === 'up' ? -1 : 1) * (2 - i * i / 12)) + 6, 1, 1); }
 });
HUD_EXT.push(() => { const HU = COURT.hunt; if (!HU) return;
  const t = HU.aim && HU.aim.a; if (t && t.st !== 'dead' && COURT.loc === 'forest' && !courtBlocked()) { const s = animalSprite(t.kind, 0, t.flip, t.col || null), Z = COURT.Z, [x0, y0] = cw2s(t.x - s.width / 2 - 2, t.y - s.height - (t.h || 0) - 2), w = (s.width + 4) * Z, h = (s.height + 4) * Z, c = HU.aim.useF ? '#a8d8ff' : HU.wpn === 'pike' ? '#ff9a6a' : '#f7d35c', k = 3 + Z * 2;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(NOW * 6); for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + w, y0 + h, -1, -1]]) { const xa = dx > 0 ? cx : cx - k, ya = dy > 0 ? cy : cy - 2, xb = dx > 0 ? cx : cx - 2, yb = dy > 0 ? cy : cy - k; rect(xa - 1, ya - 1, k + 2, 4, PAL.o); rect(xb - 1, yb - 1, 4, k + 2, PAL.o); rect(xa, ya, k, 2, c); rect(xb, yb, 2, k, c); } ctx.globalAlpha = 1; }
  huntPanel(HU); });
