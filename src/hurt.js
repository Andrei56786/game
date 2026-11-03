// ===== HURT (v3.5): a beast's charge — the warning, the rush, a dodge; wounds by severity; the stretcher, the sickbed and the days of healing =====
// king.wound — the day the wound heals (as before); king.woundK — 1 a bruise, 2 a wound, 3 a grave wound; king.woundP — where; king.woundBy — what did it
const WOUNDS = { 1: { n: 'ушиб', d: [1, 2], bed: 0 }, 2: { n: 'рана', d: [8, 12], bed: 0.6 }, 3: { n: 'тяжёлая рана', d: [18, 26], bed: 0.62 } };
function woundName(k) { k = k || kingC(); return (WOUNDS[k.woundK || 2] || WOUNDS[2]).n; }
function woundNot(k) { k = k || kingC(); return k.woundK === 1 ? 'Ушиб ещё не прошёл' : k.woundK === 3 ? 'Тяжёлая рана ещё не зажила' : 'Рана ещё не зажила'; }
function woundSpd(k) { return k.woundK === 1 ? 0.85 : k.woundK === 3 ? 0.5 : 0.62; }
function woundKing(sev, part, by) { const k = kingC(), W0 = WOUNDS[sev]; let days = R.i(W0.d[0], W0.d[1]) + (by === 'медведь' && sev > 1 ? 3 : 0) + (k.age > 50 && sev > 1 ? 2 : 0);
  const old = k.wound > G.day ? k.wound - G.day : 0; if (old) days += Math.ceil(old * 0.5);
  if (!(k.wound > G.day) || sev >= (k.woundK || 0)) { k.woundK = sev; k.woundP = part; k.woundBy = by; }
  k.wound = Math.max(k.wound || 0, G.day + days); k.woundDay = G.day;
  const how = { 'турнир': 'на турнире', 'кабан': 'кабаном', 'медведь': 'медведем', 'олень': 'оленем', 'шальная стрела': 'шальной стрелой', 'падение': 'при падении' }[by] || by; log((sev === 1 ? 'Ушиб ' + (by === 'турнир' ? 'на турнире' : 'на охоте') : (sev === 3 ? 'Король тяжело ранен ' : 'Король ранен ') + how) + ': ' + part + '. ' + (sev === 1 ? 'Пройдёт за ' : 'Заживёт за ') + dn(days) + '.', sev === 1 ? 'info' : 'bad');
  return days; }
// ---------- the charge: the beast lowers its head and paws the ground — then rushes in a line; step aside, or take it on the spear ----------
const DIRV = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
gameCharge = function (a) { a.st = 'charge'; a.cp = 'wind'; a.ct = 0; a.cw = a.kind === 'bear' ? R.range(1.1, 1.5) : R.range(0.85, 1.25); a.tried = 0; a.recv = 0; a.moving = 0; a.tries = (a.tries || 0) + 1;
  Snd.sfx('growl'); if (typeof SND2 !== 'undefined') SND2.play('snort', 1, 0, 0); const hn = npcByKey('srv_hunter');
  if (hn) say(hn, R.pick(a.kind === 'bear' ? ['Медведь встал на дыбы! Берегитесь!', 'Сейчас кинется, государь!'] : ['Роет землю — сейчас кинется!', 'Берегитесь, государь! Вбок, вбок!']), 2.5); };
function chargeUpd(a, dt, L, P, HU) {
  const g = gameOf(a), kd = Math.hypot(a.x - P.x, a.y - P.y), bear = a.kind === 'bear';
  if (!HU || HU.ended || COURT.loc !== 'forest' || kd > 240 || P.downT > NOW) { a.cp = null; gameFlee(a, P); return; }
  a.ct += dt;
  if (a.cp === 'wind') { a.moving = 0; a.flip = P.x > a.x; if (R.chance(dt * 7)) COURT.parts.push({ k: 'dust', x: a.x + (a.flip ? -5 : 5), y: a.y, vx: (a.flip ? -1 : 1) * 12, vy: -5, t: 0, life: 0.5 });
    if (a.ct >= a.cw) { const dx = P.x - a.x, dy = P.y - 2 - a.y, d = Math.max(1, Math.hypot(dx, dy)); a.cp = 'rush'; a.ct = 0; a.rx = dx / d; a.ry = dy / d; a.rd = 0; a.rl = d + 46; a.best = 1e9; Snd.sfx('growl'); }
    return; }
  if (a.cp === 'rush') {
    if (a.rd < a.rl - 34) { const want = Math.atan2(P.y - 2 - a.y, P.x - a.x), cur = Math.atan2(a.ry, a.rx); let da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const an = cur + clamp(da, -0.8 * dt, 0.8 * dt); a.rx = Math.cos(an); a.ry = Math.sin(an); } // a boar hardly turns once it has started
    const sp = g.sp * (bear ? 1.25 : 1.55) * Math.min(1, 0.45 + a.ct * 2.4), st = sp * dt, nx = a.x + a.rx * st, ny = a.y + a.ry * st;
    if (!aniFree(L, nx, ny, a)) { a.cp = 'turn'; a.ct = 0; a.moving = 0; Snd.sfx('thud'); return; } // into a tree or a thicket
    a.x = nx; a.y = ny; a.f += st; a.rd += st; a.moving = 1; if (Math.abs(a.rx) > 0.2) a.flip = a.rx > 0; if (R.chance(dt * 12)) COURT.parts.push({ k: 'dust', x: a.x, y: a.y, vx: -a.rx * 10, vy: -4, t: 0, life: 0.45 });
    if (HU.wpn === 'pike' && !a.recv && kd < 22 && !P.moving) { a.recv = 1; a.cp = null; pikeStrike(a, true); return; } // stand firm: the crossbar takes it
    if (kd < 40 && !a.tried) { a.tried = 1; const hn = npcByKey('srv_hunter'), cn = HU.comp && npcByKey(HU.comp);
      if (hn && Math.hypot(hn.x - P.x, hn.y - P.y) < 70 && R.chance(0.4)) { a.cp = null; huntKill(a, 'hunter'); say(hn, 'Ага, попался! На рогатину его!', 3); return; }
      if (cn && cn.c && (cn.c.mar || 0) >= 12 && Math.hypot(cn.x - P.x, cn.y - P.y) < 70 && R.chance(0.3)) { a.cp = null; huntKill(a, 'hunter'); say(cn, 'Не тронешь короля, зверюга!', 3); return; } }
    if (kd < a.best) a.best = kd;
    if (kd < 10) { a.cp = 'turn'; a.ct = 0; boarContact(a, P, HU); return; }
    if (a.rd > a.rl || (a.best < 44 && kd > a.best + 16)) { a.cp = 'turn'; a.ct = 0; if (a.best < 26) { UI.toast(bear ? 'Медведь проносится мимо!' : 'Кабан проносится мимо — клыки в пяди от ноги!'); const hn = npcByKey('srv_hunter'); if (hn) say(hn, 'Ловко, государь!', 2); } }
    return; }
  // the turn: it slows, wheels round — and either comes again or makes off
  a.moving = a.ct < 0.35 ? 1 : 0; if (a.moving) { const st = g.sp * 0.6 * (1 - a.ct / 0.35) * dt; if (aniFree(L, a.x + a.rx * st, a.y + a.ry * st, a)) { a.x += a.rx * st; a.y += a.ry * st; a.f += st; } }
  else a.flip = P.x > a.x;
  if (a.ct > 0.8) { if (a.tries < 3 && kd < 150 && R.chance(bear ? 0.6 : 0.5)) { a.cp = 'wind'; a.ct = 0; a.cw = R.range(0.55, 0.9); a.tries++; a.tried = 0; Snd.sfx('growl'); } else { a.cp = null; gameFlee(a, P); } } }
{ const gu1 = gameUpd; gameUpd = function (a, dt, L, P, HU) { if (a.st === 'charge' && a.cp) { chargeUpd(a, dt, L, P, HU); return; } if (a.st === 'charge') { gameCharge(a); return; } gu1(a, dt, L, P, HU); }; }
// the moment of contact: a dodge across its line, or a blow — a bruise, a wound or a grave wound
function boarContact(a, P, HU) { const k = kingC(), v = DIRV[P.dir] || [0, 0], cross = P.moving ? Math.abs(v[0] * a.ry - v[1] * a.rx) : 0;
  const dodge = (P.moving ? 0.22 + 0.5 * cross : 0.08) + ((k.mar || 10) - 10) * 0.02 - (k.wound > G.day ? 0.15 : 0) - (COURT.sneak ? 0.1 : 0) - (k.age > 50 ? 0.08 : 0);
  if (R.f() < dodge) { UI.toast(R.pick(['Вы отскакиваете — клыки рвут только плащ!', 'Прыжок в сторону — зверь проносится мимо!'])); const hn = npcByKey('srv_hunter'); if (hn) say(hn, 'Ух! Цел, государь?', 2); return; }
  kingHit(a); }
huntGored = function (a) { if (a.st === 'charge' && a.cp && a.cp !== 'rush') { a.cp = 'wind'; a.ct = a.cw; return; } kingHit(a, 1); }; // the spear slipped: it comes at once (still a chance to leap aside); taking the rush on it and missing — no dodge
function kingHit(a, close) { const HU = COURT.hunt, P = COURT.p, k = kingC(); if (!HU || HU.ended) return; const bear = a.kind === 'bear';
  const r = R.f() + (bear ? 0.22 : 0) + (close ? 0.1 : 0) + (k.age > 50 ? 0.08 : 0) - ((k.mar || 10) - 10) * 0.015, sev = r < 0.52 ? 1 : r < 0.9 ? 2 : 3;
  const part = bear ? R.pick(['плечо', 'бок', 'руку']) : R.pick(['бедро', 'голень', 'бедро']), days = woundKing(sev, part, bear ? 'медведь' : 'кабан');
  P.downT = NOW + (sev === 1 ? 1.4 : 2.4); P.moving = 0; COURT.path = null; COURT.onArrive = null; COURT.flash = NOW; Snd.sfx('thud'); Snd.sfx('hit'); Snd.sfx('growl');
  a.cp = null; a.st = 'flee'; a.ft = 0; a.fx = P.x; a.fy = P.y; a.free = NOW + 6; a.moving = 1; HU.hurtN = (HU.hurtN || 0) + 1;
  const hn = npcByKey('srv_hunter'); if (hn) say(hn, sev === 1 ? 'Цел, государь? Вставайте!' : 'Государь ранен! Рогатину, живо!', 3);
  if (sev === 1) { UI.toast((bear ? 'Медведь' : 'Кабан') + ' сбил вас с ног. Ушиб — до свадьбы заживёт.'); return; }
  HU.wound = days; if (G.speed > 0) UI.lastSpeed = G.speed;
  const t = sev === 3 ? (bear ? 'Медведь подминает вас и рвёт когтями ' + part + ' до кости.' : 'Клык входит глубоко в ' + part + ' — кровь не унять.') + ' Ловчие перетягивают рану ремнём. Рана тяжёлая: лекарь ничего не обещает.'
    : (bear ? 'Медведь бьёт лапой — когти распарывают ' + part + '.' : 'Кабан сбивает вас с ног и распарывает клыком ' + part + '.') + ' Ловчий отгоняет зверя рогатиной. Рана глубокая, но заживёт — дней за ' + days + '.';
  HEAL.pend = { t: NOW + 2.2, f: () => DLG.say(null, t, { name: 'Беда на охоте', choices: [{ t: 'Домой, на носилках', fx: () => huntEnd('wound') }], esc: 0 }) }; }
// ---------- the cutscene: the stretcher to the keep, the physician at the bed, the days going by ----------
const HEAL = { on: 0, sh: '', pend: null, q: null };
function healStart(o) { // v3.6: k.woundFv — the fever chance of this grave wound (an arrow in the chest: 0.6)
  const k = kingC(), W0 = WOUNDS[k.woundK || 2], tot = Math.max(1, k.wound - G.day), bed = Math.max(2, Math.round(tot * W0.bed));
  Object.assign(HEAL, { on: 1, o, king: k.id, tot, bed, fast: 0, sh: '', t0: NOW, cap: '', vis: [], fever: k.woundK === 3 && R.chance((k.woundFv || 0.3) * docK()) ? { day: R.i(2, 3), ext: R.i(3, 5), st: 0 } : null }); k.woundFv = 0;
  UI.win = null; while (DLG.open()) DLG.close(); COURT.path = null; COURT.onArrive = null; Snd.music('lament'); healLitter(); }
function healQueue(o) { HEAL.q = o; }
const healMan = (i, role, age, name) => ({ c: pseudoChar(90 + i, role, 0, age, name), x: 0, y: 0, dir: 'down', f: 0, moving: 0 });
function healLitter() { fadeTo(() => { const Y = LOCS.yard, P = COURT.p, HU = HEAL.o.HU, inY = !HU && COURT.loc === 'yard'; COURT.loc = 'yard'; P.sit = null; P.lie = 0; P.hide = 1; P.downT = 0;
    if (HU) { huntRelease(); COURT.hunt = null; huntFauna(''); } COURT.parts = [];
    const dk = Y.doors.find(d => d.to === 'keep'), tx = dk ? Math.round((dk.x0 + dk.x1) / 2) : 37, ty = dk ? dk.y1 + 2 : 20, sp = spotOf('hunter') || spotOf('gate_out');
    const [sx, sy] = inY ? nearFree(Y, Math.floor(P.x / CT), Math.floor(P.y / CT)) : sp ? nearFree(Y, Math.floor(sp.x / CT), Math.floor(sp.y / CT)) : [tx, ty + 10]; let path = castar(Y, sx, sy, tx, ty) || [[sx, sy], [tx, ty]];
    if (path.length > 15) path = path.slice(path.length - 15); const s0 = path[0]; P.x = s0[0] * CT + 8; P.y = s0[1] * CT + 11; P.f = 0;
    HEAL.path = path; HEAL.sh = 'litter'; HEAL.t0 = NOW; HEAL.cap = HEAL.o.from === 'tourney' ? 'Короля уносят с ристалища' : 'Ловчие несут раненого короля в замок';
    HEAL.men = [healMan(0, 'peasant', 34, 'Ловчий'), healMan(1, 'guard', 27, 'Стражник')]; snapCam(); Snd.sfx('horn_low'); }); }
function healBed() { fadeTo(() => { const L = LOCS.keep, P = COURT.p, sp = L.spots.bed_king, k = kingC(); COURT.loc = 'keep'; P.hide = 0; sitAt(sp); COURT.parts = []; snapCam();
    const doc = sickDocVis(); doc.x = sp.sx + 30; doc.y = sp.sy + 8; doc.dir = 'left'; HEAL.vis = [doc];
    const sp2 = k.spouse >= 0 ? charOf(k.spouse) : null; if (sp2 && sp2.alive && !sp2.away && !(sp2.ill && sp2.ill.bed)) HEAL.vis.push({ c: sp2, x: sp.sx + 2, y: sp.sy + 46, dir: 'up', f: 0, moving: 0 });
    HEAL.sh = 'bed'; HEAL.t0 = NOW; HEAL.cap = HEAL.o.from === 'ill' ? sickBedCap() : doc.c.name + ' промывает рану вином и зашивает. «Лежать, государь, — дней ' + HEAL.bed + '».'; Snd.sfx('door'); }); }
function healDays() { HEAL.sh = 'days'; HEAL.d0 = G.day; HEAL.end = G.day + HEAL.bed + 3 / 24; HEAL.lastD = -1; HEAL.t0 = NOW; G.speed = G.speed || 1;
  const k = kingC(); HEAL.lines = { 1: k.spouse >= 0 && charOf(k.spouse) && charOf(k.spouse).alive && !(charOf(k.spouse).ill && charOf(k.spouse).ill.bed) ? (charOf(k.spouse).fem ? 'Королева' : 'Супруг') + ' не отходит от постели.' : 'Паж приносит бульон и вести из столицы.', [Math.max(2, Math.floor(HEAL.bed / 2))]: 'Канцлер читает у изголовья донесения: совет справляется сам.' }; }
function healEnd(dead) { const k = kingC(), P = COURT.p, o = HEAL.o || {}; HEAL.on = 0; HEAL.sh = ''; HEAL.vis = []; HEAL.men = null; if (P) { P.hide = 0; P.downT = 0; }
  if (dead) return; standUp(); npcSnap(false); COURT.lastHA = G.day * 24 + hourAbs(); Snd.music('auto'); if (o.from === 'ill') { sickUp(); return; }
  const rest = Math.max(1, Math.round(HEAL.tot * 0.4)); k.wound = Math.max(G.day + rest, Math.min(k.wound, G.day + rest)); UI.toast('Король встаёт на ноги. Ещё ' + dn(rest) + ' беречься: ходить медленно, без меча и охоты.');
  log('Король поднялся с постели после ' + dn(HEAL.bed) + ' в покоях.', 'info'); if (o.from === 'hunt' && o.HU) huntSummary(o.HU, 'wound'); }
function healSkip() { if (HEAL.sh === 'litter') healBed(); else if (HEAL.sh === 'bed') healDays(); else if (HEAL.sh === 'days') HEAL.fast = HEAL.fast ? 0 : 1; }
UPD_EXT.push(dt => { const P = COURT.p; if (!P) return;
  if (P.downT && P.downT <= NOW) { P.downT = 0; P.hide = HEAL.sh === 'litter' ? 1 : 0; }
  if (HEAL.pend && NOW >= HEAL.pend.t && !DLG.open()) { const f = HEAL.pend.f; HEAL.pend = null; f(); }
  if (HEAL.q && !HEAL.on && !DLG.open() && !UI.modalOpen() && COURT.fade === 0) { const o = HEAL.q; HEAL.q = null; healStart(o); }
  if (!HEAL.on) return;
  if (HEAL.sh === 'litter' && !COURT.fade) { const pt = HEAL.path[0]; if (!pt || NOW - HEAL.t0 > 10) { healBed(); return; } const gx = pt[0] * CT + 8, gy = pt[1] * CT + 11, dx = gx - P.x, dy = gy - P.y, d = Math.hypot(dx, dy), st = 26 * dt;
    if (d <= st) { P.x = gx; P.y = gy; HEAL.path.shift(); } else { P.x += dx / d * st; P.y += dy / d * st; HEAL.vx = dx / d; HEAL.vy = dy / d; } P.f += st; }
  if (HEAL.sh === 'bed' && !COURT.fade && NOW - HEAL.t0 > 4.5) healDays();
  if (HEAL.sh === 'days' && !COURT.fade) { const k = kingC(); if (!k.alive || G.over || k.id !== HEAL.king) { healEnd(true); return; }
    const d = G.day - HEAL.d0; if (d !== HEAL.lastD) { HEAL.lastD = d; if (HEAL.lines[d]) HEAL.cap = HEAL.lines[d]; if (d === 0) HEAL.vis = HEAL.vis.slice(0, 1); else if (d === 1) HEAL.vis = []; const F = HEAL.fever;
      if (F && d === F.day) { F.st = 1; HEAL.end += F.ext; k.wound += F.ext; HEAL.tot += F.ext; HEAL.cap = 'Ночью начался жар. Лекарь пускает кровь, капеллан молится у изголовья.'; Snd.sfx('bell'); }
      if (F && F.st === 1 && d === F.day + 2) { F.st = 2; if (R.chance((k.age > 50 ? 0.15 : 0.06) * docK())) { HEAL.cap = ''; healEnd(true); charDies(k, 'от раны: ' + (k.woundBy || 'зверь') + ', ' + (k.woundP || 'рана')); return; } HEAL.cap = 'Жар спал. Лекарь крестится: «Обошлось, государь».'; }
      if (G.day + G.frac >= HEAL.end - 1) HEAL.cap = HEAL.o.from === 'ill' ? 'Жар отступил. Лекарь разрешает встать.' : 'Рана затянулась. Лекарь разрешает встать.'; }
    if (!UI.modalOpen() && !DLG.open()) { const n = HEAL.fast ? 9 : 3; for (let i = 0; i < n && G.day + G.frac < HEAL.end; i++) worldAdvance(Math.min(0.004, HEAL.end - G.day - G.frac + 1e-6)); }
    if (G.day + G.frac >= HEAL.end - 1e-6) healEnd(false); } });
TIMEK_EXT.push(() => HEAL.on && HEAL.sh !== 'days' ? 0.02 : 1);
{ const cb = courtBlocked; courtBlocked = function () { return cb() || HEAL.on || !!(COURT.p && COURT.p.downT > NOW); }; }
{ const he = huntEnd; huntEnd = function (why, door) { const HU = COURT.hunt, k = kingC(); if (why === 'wound' && HU && !HU.ended && (k.woundK || 2) >= 2 && k.wound > G.day) { HU.ended = 1; healStart({ from: 'hunt', HU }); return; } he(why, door); }; }
CKEY_EXT.push(c => { if (!HEAL.on) return false; if (c === 'Space' || c === 'Enter' || c === 'Escape') { healSkip(); return true; } return true; });
// the knocked-down king, the stretcher with its bearers, the physician and the queen at the bed
function drawLying(g, c, x, y, rot) { const s = walkerSprite(c, 'down', 0); g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(rot); g.drawImage(s, -8, -16); g.restore(); }
SPR_EXT.push((L, list) => { const P = COURT.p; if (!P) return;
  if (P.downT > NOW && L.id === COURT.loc) { P.hide = 1; list.push([P.y, 4, g => { g.drawImage(shadowSpr(14), Math.round(P.x - 7), Math.round(P.y) - 3); drawLying(g, P.c, P.x, P.y - 5, P.dir === 'left' ? -Math.PI / 2 : Math.PI / 2); }]); }
  if (!HEAL.on) return; if (HEAL.sh === 'litter' && L.id === 'yard' && HEAL.men) { const vx = HEAL.vx === undefined ? 1 : HEAL.vx, vy = HEAL.vy || 0, hz = Math.abs(vx) >= Math.abs(vy), f = Math.floor(P.f / 7) % 4;
      const sg = hz ? (vx >= 0 ? 1 : -1) : (vy >= 0 ? 1 : -1), dir = hz ? (sg > 0 ? 'right' : 'left') : (sg > 0 ? 'down' : 'up'), M = HEAL.men;
      M[0].x = P.x + (hz ? 21 * sg : 0); M[0].y = P.y + (hz ? 0 : 19 * sg); M[1].x = P.x - (hz ? 21 * sg : 0); M[1].y = P.y - (hz ? 0 : 19 * sg); for (const m of M) { m.dir = dir; m.moving = 1; m.f = P.f; }
      const back = M[1], front = M[0]; list.push([back.y, 1, back]); list.push([front.y, 1, front]);
      list.push([P.y + 1, 4, g => { const x = Math.round(P.x), y = Math.round(P.y); g.drawImage(shadowSpr(22), x - 11, y - 3);
        if (hz) { g.fillStyle = '#5a3a20'; g.fillRect(x - 22, y - 15, 44, 1); g.fillRect(x - 22, y - 9, 44, 1); g.fillStyle = '#cdb98e'; g.fillRect(x - 15, y - 14, 30, 5); drawLying(g, P.c, x + (sg > 0 ? -2 : 2), y - 13, sg > 0 ? -Math.PI / 2 : Math.PI / 2);
          g.fillStyle = '#7a1e2a'; g.fillRect(sg > 0 ? x - 14 : x - 4, y - 15, 18, 6); g.fillStyle = '#e0a630'; g.fillRect(sg > 0 ? x - 14 : x - 4, y - 10, 18, 1); }
        else { g.fillStyle = '#5a3a20'; g.fillRect(x - 6, y - 34, 1, 40); g.fillRect(x + 5, y - 34, 1, 40); g.fillStyle = '#cdb98e'; g.fillRect(x - 5, y - 28, 10, 28); const s = walkerSprite(P.c, 'down', 0); g.drawImage(s, 0, 0, 16, 13, x - 8, y - 30, 16, 13);
          g.fillStyle = '#7a1e2a'; g.fillRect(x - 5, y - 18, 10, 16); g.fillStyle = '#e0a630'; g.fillRect(x - 5, y - 18, 10, 1); } }]); }
  if ((HEAL.sh === 'bed' || HEAL.sh === 'days') && L.id === 'keep') for (const v of HEAL.vis) list.push([v.y, 1, v]); });
// the letterbox, the caption, the day count; the court's own HUD is hidden meanwhile
{ const dh = drawCourtHUD; drawCourtHUD = function () { if (!HEAL.on) { dh(); healBadge(); return; } const bh = 24; ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh - 6, W, bh + 6);
    if (HEAL.sh === 'days') { const d = clamp(G.day - HEAL.d0 + 1, 1, HEAL.bed + (HEAL.fever && HEAL.fever.st ? HEAL.fever.ext : 0)), nT = Math.round(HEAL.end - HEAL.d0); const hn = HEAL.o && HEAL.o.from === 'ill' ? sickTitle() : woundName(), hs = hn[0].toUpperCase() + hn.slice(1) + ' · день ' + d + ' из ' + nT, hw = tw(hs), cs = clockStr(), x0 = Math.round(W / 2 - (96 + hw + tw(cs, { f: 's' })) / 2);
      spr(isNight() ? 'i_moon' : 'i_sun', x0, 9); txt(hs, x0 + 8, 8, '#fff2c8'); bar(x0 + 16 + hw, 9, 70, 6, (G.day + G.frac - HEAL.d0) / Math.max(1, HEAL.end - HEAL.d0), '#c0353f'); txt(cs, x0 + 92 + hw, 8, '#a8a0b8', { f: 's' }); }
    if (HEAL.cap) txt(HEAL.cap, W / 2, H - bh + 2, '#f0e4c8', { al: 'c' });
    const lab = HEAL.sh === 'days' ? (HEAL.fast ? 'Обычно' : 'Быстрее') : 'Дальше'; btn('heal_skip', W - 74, H - 24, 66, 14, { label: lab + ' ▸', style: 'dark', tip: 'Пробел', onClick: () => healSkip() });
    drawStatus(); }; }
function healBadge() { const k = G && kingC(); if (!k || !(k.wound > G.day) || HEAL.on || COURT.hunt) return; const n = k.wound - G.day, s = woundName(k) + ' · ' + n + ' дн.', w = tw(s, { f: 's' }) + 16;
  rect(W - w - 6, 22, w, 12, 'rgba(20,14,12,0.8)'); spr('i_wound', W - w - 3, 25); txt(s, W - w + 5, 25, k.woundK === 3 ? UIC.bad : UIC.warn, { f: 's' });
  hit(W - w - 6, 22, w, 12, { id: 'kwound', tip: [woundName(k)[0].toUpperCase() + woundName(k).slice(1) + (k.woundP ? ': ' + k.woundP : '') + (k.woundBy ? ' (' + k.woundBy + ')' : ''), 'Заживёт через ' + dn(n) + '. До тех пор — ни охоты, ни меча, ни турнира; ходить медленнее.', 'Травница в деревне и молитва в часовне ускоряют заживление.'] }); }
