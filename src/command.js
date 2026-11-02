'use strict';
// ===== COMMAND: the crown's armies under knights; orders travel by courier; the king rides out and returns =====
const CMD = {
  hold: { n: 'Стоять', d: 'Стоять на месте и беречь людей. Бить только того, кто слабее и рядом.', tgt: null },
  defend: { n: 'Защищать', d: 'Идти к своей крепости и оборонять её округу. Снимет осаду, если сможет.', tgt: 'own' },
  attack: { n: 'Наступать', d: 'Идти на вражескую крепость: осада или штурм.', tgt: 'foe' },
  patrol: { n: 'Охранять дороги', d: 'Ходить между своими крепостями рядом с целью и гонять разбойников.', tgt: 'own' },
  join: { n: 'Соединиться', d: 'Идти к другому войску короны и влиться в него.', tgt: 'army' },
  ret: { n: 'В столицу', d: 'Вернуться к столице и стать там лагерем.', tgt: null },
};
// Сунь-цзы, гл. 8: пять опасных качеств полководца
const FAULTS = {
  reckless: { n: 'Безрассудство', q: '«Безрассудного можно убить».', d: 'лезет в бой и против сильнейшего' },
  craven: { n: 'Трусость', q: '«Трусливого можно взять в плен».', d: 'бежит при первой угрозе' },
  wrathful: { n: 'Вспыльчивость', q: '«Вспыльчивого можно вывести из себя».', d: 'гонится за врагом, бросая пост' },
  proud: { n: 'Гордыня', q: '«Щепетильного в чести можно опозорить».', d: 'не отступает, обижается на мелочную опеку' },
  generous: { n: 'Мягкосердие', q: '«Любящего своих людей можно извести заботами».', d: 'слишком рано уводит людей на отдых' },
};
const faultsOf = c => c ? c.traits.filter(t => FAULTS[t]) : [];
function crownArmies() { return G.armies.filter(a => a.alive && a.realm === 0 && a.kind === 'lord'); }
function ordLabel(o) { if (!o) return '—'; const d = CMD[o.o]; if (!d) return '—'; let t = '';
  if (d.tgt === 'own' || d.tgt === 'foe') t = o.t >= 0 && WD.setts[o.t] ? ' · ' + WD.setts[o.t].name : ''; else if (d.tgt === 'army') { const b = armyById(o.t); t = b ? ' · к ' + armyLabel(b) : ''; }
  return d.n + t + (o.mode === 'order' ? ' (приказ)' : ' (замысел)'); }
function cmdNote(a, key, text, force) { a.notes = a.notes || {}; if (!force && a.notes[key] > G.day - 4) return; a.notes[key] = G.day; const g = charOf(a.gen);
  addLetter({ from: g ? charName(g) : 'Войско короны', fc: g ? g.id : -1, subj: 'Донесение из войска', text, x: a.x, y: a.y, army: a.id }); }
function cmdHunt(a, radius, kMax) { const my = powerU(a.u, a.xp); const prey = threatsNear(a, radius).filter(x => x.p < my * kMax && !(a.ai.skip && a.ai.skip[x.b.id] > G.day)).sort((x, y) => x.d - y.d)[0]; if (!prey) return false;
  if (a.ai.prey !== prey.b.id) { a.ai.prey = prey.b.id; a.ai.h0 = G.day; } if (G.day - a.ai.h0 > 5) { (a.ai.skip = a.ai.skip || {})[prey.b.id] = G.day + 10; a.ai.prey = -1; return false; }
  if (!a.path || a.ai.t <= 0) { goTo(a, armyTile(prey.b), 'hunt'); a.ai.t = 1; } return true; }
function cmdArmyTick(a) {
  if (!a.ai) a.ai = { task: 'idle', t: 0 }; const o = a.cmd || (a.cmd = { o: 'hold', mode: 'intent', day: G.day, x: a.x, y: a.y });
  const gen = charOf(a.gen), men = armyMen(a), my = powerU(a.u, a.xp), tr = t => !!gen && gen.traits.includes(t), skill = gen ? gen.mar : 5; a.ai.t--;
  if (men <= 0) return;
  // 1) danger: retreat (the five faults change the thresholds)
  let fk = 1.3; if (tr('cautious')) fk = 1.15; if (tr('generous')) fk = 1.1; if (tr('proud')) fk = 2.0; if (tr('reckless')) fk = 2.4; if (tr('craven')) fk = 0.85;
  const big = threatsNear(a, 8).filter(x => x.p > my * fk && x.b.kind !== 'bandit');
  if (big.length && a.mode !== 'siege') { const obey = o.o === 'hold' && o.mode === 'order' && skill < 13;
    if (!obey) { if (a.ai.task !== 'flee' || !a.path) { const s = nearestOwnSett(a, true); if (s >= 0 && settNear(a.x, a.y, 1.2) !== s) { goTo(a, WD.setts[s].i, 'flee'); cmdNote(a, 'flee', 'Враг сильнее нас: у него ≈' + voin(noisy(armyMen(big[0].b), gen, 'mar')) + '. Отхожу к ' + WD.setts[s].name + ', чтобы сберечь войско.' + (o.o === 'hold' && o.mode === 'order' ? ' Простите, государь: «есть приказы государя, которых не исполняют» (гл. 8).' : '')); } } return; } }
  // 2) water, 3) rest and resupply
  if (a.water < 1 && a.mode !== 'siege' && !nearWater(armyTile(a))) { if (a.ai.task !== 'water' || !a.path) { const w = waterTileNear(armyTile(a)); if (w >= 0 && goTo(a, w, 'water')) return; } else return; }
  const soft = tr('generous') ? 1.35 : 1;
  if (a.mode !== 'siege' && (a.food < men * 2.5 || a.morale < 30 * soft || a.fat > 85 / soft)) { if (a.ai.task !== 'rest') { const s = nearestOwnSett(a, true, a.food < men * 2.5); if (s >= 0 && settNear(a.x, a.y, 1.2) !== s) { goTo(a, WD.setts[s].i, 'rest'); cmdNote(a, 'rest', 'Люди устали и голодны. Веду войско на отдых в ' + WD.setts[s].name + '.'); } else { a.ai.task = 'rest'; a.ai.t = 4; } } else if (!a.path && a.ai.t <= 0) a.ai.task = 'idle'; return; }
  if (a.mode === 'siege') return;
  // the wrathful commander takes the bait wherever he stands
  if (tr('wrathful') && o.o !== 'join' && o.o !== 'ret' && cmdHunt(a, 9, 1.15)) { if (o.o === 'hold' || o.o === 'defend') cmdNote(a, 'wrath', 'Враг дразнит нас у самых стен! Я проучу наглецов, государь.'); return; }
  const intent = o.mode === 'intent';
  switch (o.o) {
    case 'hold': { if (cmdHunt(a, intent ? 4 : 2, tr('reckless') ? 1.4 : 0.8)) return; if (o.x !== undefined && Math.hypot(a.x - o.x, a.y - o.y) > 2.5 && !a.path) goTo(a, Math.floor(o.y) * MW + Math.floor(o.x), 'post'); return; }
    case 'defend': case 'patrol': { const S = G.setts[o.t]; if (!S) { a.cmd = { o: 'hold', mode: o.mode, day: G.day, x: a.x, y: a.y }; return; } const ws = WD.setts[o.t];
      if (S.ctrl !== 0) { if (o.o === 'defend') { cmdNote(a, 'lost', 'Мы опоздали: ' + ws.name + ' в руках врага. ' + (intent ? 'Встану рядом и буду ждать случая отбить.' : 'Жду приказа.'), true); a.cmd = { o: intent ? 'attack' : 'hold', t: o.t, mode: o.mode, day: G.day, x: a.x, y: a.y }; } return; }
      if (S.siege) { const b = armyById(S.siege.by); if (b && perceivedPower(b, 0) < (my + powerU(S.gar) * 0.5) * (tr('reckless') ? 1.6 : 1.1)) { if (!a.path || a.ai.prey !== b.id) { a.ai.prey = b.id; goTo(a, armyTile(b), 'relieve'); cmdNote(a, 'relieve', ws.name + ' в осаде! Иду снимать осаду.'); } return; } }
      if (cmdHunt(a, o.o === 'patrol' ? 6 : intent ? 6 : 3, tr('reckless') ? 1.4 : 0.9)) return;
      const d = Math.hypot(ws.x + 0.5 - a.x, ws.y + 0.5 - a.y);
      if (o.o === 'defend') { if (d > 1.6 && !a.path) goTo(a, ws.i, 'defend'); return; }
      if (!a.path && a.ai.t <= 0) { const L = G.setts.filter(T => T.ctrl === 0 && Math.hypot(WD.setts[T.id].x - ws.x, WD.setts[T.id].y - ws.y) < 14 * SEAT_K); const T = L.length ? R.pick(L) : S; goTo(a, WD.setts[T.id].i, 'patrol'); a.ai.t = 4; } return; }
    case 'attack': { const S = G.setts[o.t]; if (!S) return; const ws = WD.setts[o.t];
      if (S.ctrl === 0) { cmdNote(a, 'won', ws.name + ' наш! Стою здесь и жду новых приказов.', true); a.cmd = { o: 'defend', t: o.t, mode: o.mode, day: G.day }; return; }
      if (!hostile(0, S.ctrl) && S.ctrl !== 5) { cmdNote(a, 'peace', 'С хозяевами ' + ws.name + ' у нас нет войны — нападать нельзя. Возвращаюсь.', true); a.cmd = { o: 'ret', mode: o.mode, day: G.day }; return; }
      let tgt = o.t; const gp = powerU(S.gar) * (1 + S.walls * 0.6);
      if (intent && gp > my * 1.5 && !tr('reckless') && !o.swapped) { // a capable commander picks a softer target of the same foe
        let best = null, bd = 1e9; for (const T of G.setts) { if (T.ctrl !== S.ctrl || T.siege) continue; const w2 = WD.setts[T.id], g2 = powerU(T.gar) * (1 + T.walls * 0.6); if (g2 > my * 1.2) continue; const dd = Math.hypot(w2.x - ws.x, w2.y - ws.y); if (dd < 16 && dd < bd) { bd = dd; best = T; } }
        if (best) { o.t = tgt = best.id; o.swapped = 1; cmdNote(a, 'swap', ws.name + ' слишком крепок для нас. Ваш замысел я понял — бить врага там, где он слаб: иду на ' + WD.setts[best.id].name + '.', true); } }
      const w2 = WD.setts[tgt]; const d = Math.hypot(w2.x + 0.5 - a.x, w2.y + 0.5 - a.y);
      if (d < 1.5) { aiArriveSett(a, tgt); a.ai.t = 2; return; }
      if (!a.path || a.ai.task !== 'siege') { if (goTo(a, w2.i, 'siege')) { a.onArrive = { k: 'siege', s: tgt, r: 0 }; if (!o.told) { o.told = 1; cmdNote(a, 'march', 'Выступаем на ' + w2.name + '. ' + (gp > my * 1.5 ? 'Гарнизон силён — будет тяжело.' : 'Думаю, крепость наша.'), true); } } } return; }
    case 'join': { const b = armyById(o.t); if (!b || b.realm !== 0) { a.cmd = { o: 'hold', mode: o.mode, day: G.day, x: a.x, y: a.y }; return; }
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1.3) { mergeArmies(b, a); return; } if (!a.path || a.ai.t <= 0) { goTo(a, armyTile(b), 'join'); a.ai.t = 1; } return; }
    case 'ret': { const ws = WD.setts[G.realms[0].capital]; if (Math.hypot(ws.x + 0.5 - a.x, ws.y + 0.5 - a.y) < 1.6) { a.cmd = { o: 'hold', mode: o.mode, day: G.day, x: a.x, y: a.y }; cmdNote(a, 'home', 'Войско у стен столицы, государь.'); return; } if (!a.path) goTo(a, ws.i, 'ret'); return; }
  }
}
function mergeArmies(into, from) { const m1 = armyMen(into), m2 = armyMen(from); for (const t of UT) { const n1 = into.u[t] || 0, n2 = from.u[t] || 0; into.xp[t] = n1 + n2 > 0 ? (into.xp[t] * n1 + from.xp[t] * n2) / (n1 + n2) : into.xp[t]; } addU(into.u, from.u);
  for (const k of ['food', 'fodder', 'arrows', 'weap', 'horses', 'wagons', 'pitch', 'wounded', 'sick']) into[k] = (into[k] || 0) + (from[k] || 0); into.morale = (into.morale * m1 + from.morale * m2) / Math.max(1, m1 + m2);
  from.alive = 0; from.path = null; const g = charOf(from.gen); if (g) { g.atCourt = 1; g.army = -1; }
  if (into.kind === 'player') log('К войску короля присоединились ' + voin(m2) + (g ? ' (' + charName(g) + ')' : '') + '.', 'good'); else cmdNote(into, 'joined', 'К нам присоединились ' + voin(m2) + (g ? ' под началом ' + charName(g) : '') + '. Теперь нас ' + armyMen(into) + '.', true); }
function disbandArmy(a) { const g = charOf(a.gen), H0 = a.house >= 0 ? G.houses[a.house] : null; a.alive = 0; a.path = null; if (a.siegeOf >= 0) endSiege(a); if (g) { g.atCourt = 1; g.army = -1; } if (H0) houseLoy(H0, 3);
  log('Войско ' + (g ? charName(g) : '') + ' распущено по домам (' + voin(armyMen(a)) + ').', 'info'); G.couriers = (G.couriers || []).filter(c => c.to !== a.id); }
// ---------- couriers: the king's word travels at the speed of a horse ----------
function sendOrder(a, ord) { const [kx, ky] = kingPos(); const d = Math.hypot(a.x - kx, a.y - ky);
  G.couriers = (G.couriers || []).filter(c => c.to !== a.id); // a newer order overtakes the old one
  if (d < 1.5) { applyOrder(a, ord, null); UI.toast('Приказ отдан лично: ' + ordLabel(a.cmd)); return 0; }
  G.couriers.push({ id: G.nextId++, to: a.id, x: kx, y: ky, ord, day: G.day + G.frac }); a.pend = 1; if (typeof Snd !== 'undefined') Snd.sfx('horn_short');
  const days = d / courierSpeed(); UI.toast('Гонец поскакал: ≈' + (days < 1 ? Math.max(1, Math.round(days * 24)) + ' ч.' : days.toFixed(1) + ' дн.') + ' в пути.'); return days; }
function couriersAdvance(dd) { if (!G.couriers || !G.couriers.length) return; const sp = courierSpeed() * dd;
  for (const cr of G.couriers) { const a = armyById(cr.to); if (!a) { cr.done = 1; log('Гонец вернулся с приказом: войска, к которому он скакал, больше нет.', 'bad'); continue; }
    const dx = a.x - cr.x, dy = a.y - cr.y, d = Math.hypot(dx, dy); if (d <= sp + 0.35) { cr.done = 1; applyOrder(a, cr.ord, cr); } else { cr.x += dx / d * sp; cr.y += dy / d * sp; } }
  G.couriers = G.couriers.filter(c => !c.done); }
function applyOrder(a, ord, cr) { a.cmd = Object.assign({ day: G.day, x: a.x, y: a.y }, ord); a.pend = 0; a.path = null; a.onArrive = null; if (!a.ai) a.ai = { task: 'idle', t: 0 }; a.ai.task = 'idle'; a.ai.t = 0; a.ai.prey = -1; if (a.siegeOf >= 0 && ord.o !== 'attack') endSiege(a);
  const g = charOf(a.gen); // Сунь-цзы, гл. 3: умелого полководца мелочная опека злит, доверие — окрыляет
  if (g && ord.mode === 'order' && g.mar >= 13) g.loy = clamp((g.loy || 60) - (g.traits.includes('proud') ? 3 : 1.5) * (hasTech('chancery') ? 0.4 : 1), 0, 100);
  if (g && ord.mode === 'intent' && g.mar >= 11) g.loy = clamp((g.loy || 60) + 0.5, 0, 100);
  if (cr) cmdNote(a, 'got', 'Ваш приказ получен: «' + ordLabel(a.cmd) + '». ' + (ord.mode === 'intent' ? (g && g.mar >= 11 ? R.pick(['Понимаю ваш замысел, государь. Средства выберу сам.', 'Благодарю за доверие. Не подведу.']) : R.pick(['Постараюсь понять, чего желает государь…', 'Сделаю, что смогу.'])) : (g && g.mar >= 13 ? R.pick(['Исполню в точности, хоть и вижу путь лучше.', 'Будет сделано, как велено.']) : R.pick(['Исполню в точности.', 'Слушаюсь!']))), true);
  if (typeof TUT !== 'undefined') TUT.ev('cmd'); }
function drawCouriers() { if (!G.couriers || !G.couriers.length) return; const s = cam.z >= 1.6 ? 2 : 1;
  for (const cr of G.couriers) { const [wx, wy] = MAPR.warpPt(cr.x * TS, cr.y * TS); const [sx, sy] = w2s(wx, wy); const a = armyById(cr.to);
    if (a) { const [awx, awy] = MAPR.warpPt(a.x * TS, a.y * TS); const [ax, ay] = w2s(awx, awy); const d = Math.hypot(ax - sx, ay - sy); // dotted trail: where the order is going
      if (d > 8) { ctx.globalAlpha = 0.6; const n = Math.floor(d / 4); for (let i = 1; i < n; i++) if (i % 2 === 0) { const t = i / n; rect(Math.round(sx + (ax - sx) * t), Math.round(sy - 3 + (ay - sy) * t), s, s, '#f7d35c'); } ctx.globalAlpha = 1; } }
    if (sx < -12 * s || sy < -12 * s || sx > W + 12 * s || sy > H + 12 * s) continue; const b = Math.round(Math.abs(Math.sin(NOW * 10 + cr.id))) * s; const fl = a && a.x < cr.x ? -1 : 1;
    const R2 = (x, y, w, h, c) => rect(sx + (fl > 0 ? x : -x - w + 1) * s, sy + y * s - b, w * s, h * s, c);
    ctx.globalAlpha = 0.35; rect(sx - 4 * s, sy + s, 9 * s, 2 * s, '#0c0a10'); ctx.globalAlpha = 1;
    R2(-3, -4, 6, 3, '#6a4428'); R2(3, -6, 2, 3, '#6a4428'); R2(4, -6, 1, 1, '#3a2614'); R2(-4, -4, 1, 2, '#3a2614'); R2(-3, -1, 1, 2, '#3a2614'); R2(2, -1, 1, 2, '#3a2614'); // horse
    R2(-1, -8, 2, 4, '#22408a'); R2(-1, -10, 2, 2, '#f0c8a0'); R2(1, -7, 1, 2, '#f7d35c'); R2(-2, -13, 1, 6, '#3a2614'); R2(-1, -13, 2, 2, '#c03028'); // rider, letter, pennant
    hit(sx - 6 * s, sy - 14 * s, 13 * s, 16 * s, { id: 'cour' + cr.id, tip: () => { const a = armyById(cr.to); return ['Гонец с приказом', a ? 'К: ' + armyLabel(a) : '', '«' + ordLabel(cr.ord) + '»', { t: 'Ещё ≈' + (a ? (Math.hypot(a.x - cr.x, a.y - cr.y) / courierSpeed()).toFixed(1) : '?') + ' дн. пути', c: UIC.dim }]; } }); } }
// battle & loss reports from the crown's armies
function cmdBattle(a, b, res) { for (const [x, y, won] of [[a, b, res.winA], [b, a, !res.winA]]) { if (x.realm !== 0 || x.kind !== 'lord') continue; const g = charOf(x.gen); const si = x === a ? 0 : 1;
    const myL = res.sides && res.sides[si] ? res.sides[si].lost : 0, foeL = res.sides && res.sides[1 - si] ? res.sides[1 - si].lost : 0; const brag = g && (g.hon || 50) < 40 ? 0.35 : 0;
    const near = settNear(x.x, x.y, 6); cmdNote(x, 'battle' + G.day, (won ? 'Победа' : 'Поражение') + (near >= 0 ? ' у ' + WD.setts[near].name : '') + ' над ' + armyLabel(y) + '! Наши потери ≈' + noisy(myL, g, 'mar', won ? -brag : 0) + ', враг потерял ≈' + noisy(foeL, g, 'mar', brag) + '.' + (won ? '' : ' Отходим.'), true);
    if (g) g.loy = clamp((g.loy || 60) + (won ? 2 : -1), 0, 100); } }
function cmdLost(a, why) { const g = charOf(a.gen); G.couriers = (G.couriers || []).filter(c => c.to !== a.id); if (!G.court) return;
  if (g && R.chance(0.35)) { g.prison = 1; log(charName(g) + ' попал в плен.', 'bad'); }
  const ws = WD.setts[G.realms[0].capital]; addLetter({ from: 'Уцелевший сотник', fc: -1, subj: 'Войско разбито', text: 'Государь, беда: войско ' + (g ? charName(g) : 'короны') + ' ' + (why || 'разбито') + '. Немногие спаслись.' + (g && g.prison > 0 ? ' Командир в плену.' : ''), x: a.x, y: a.y }); if (g) { g.army = -1; if (g.prison < 0) g.atCourt = 1; } }
// ---------- muster: the houses raise their banners ----------
function musterBanners(e) { const C = G.court; let tot = 0; const refused = []; const war = warsOf(0).length > 0;
  for (const H0 of G.houses) { if (!H0.alive) continue; if (H0.defiant > G.day || H0.loy < 25) { refused.push(H0.name); houseLoy(H0, -2); continue; } if (H0.fief < 0 || G.setts[H0.fief].ctrl !== 0) continue;
    const n = Math.round(H0.str * clamp(H0.loy / 60, 0.4, 1.4) * clamp(e, 0.6, 1.5)); const u = roundU({ levy: n * 0.4, spear: n * 0.3, archer: n * 0.17, sword: n * 0.07, horse: n * 0.04, knight: n * 0.02 });
    C.musters.push({ h: H0.id, day: G.day + R.i(2, 6), u }); tot += menOf(u); houseLoy(H0, war ? -1 : -5); }
  return 'Гонцы разосланы по домам. Обещано ' + voin(tot) + ': отряды соберутся в своих землях и пойдут к столице.' + (refused.length ? ' Отказались прислать людей: ' + refused.join(', ') + '.' : '') + (war ? '' : ' Лорды ворчат: созывать знамёна в мирное время — накладно.'); }
function spawnMuster(m) { const H0 = G.houses[m.h]; if (!H0 || H0.fief < 0) return; const S = G.setts[H0.fief]; if (S.ctrl !== 0) return; const ws = WD.setts[S.id];
  const kn = houseMembers(H0.id).find(c => c.role === 'knight' && c.prison < 0 && !armyOfGen(c.id) && !c.seat && !c.withKing && c.age >= 16) || mkHouseMember(H0, 0, R.i(20, 40), { role: 'knight', title: 'Сэр', st: { mar: R.i(6, 12) } });
  const a = mkArmy(0, 'lord', kn.id, ws.x, ws.y, m.u); Object.assign(a, { food: menOf(m.u) * 8, fodder: 40, water: 4, arrows: rangedN(m.u) * 25, wagons: 2, weap: 5 }); a.ai = { task: 'idle', t: 0 }; a.house = H0.id;
  const cap = capitalArmy(); a.cmd = cap ? { o: 'join', t: cap.id, mode: 'intent', day: G.day } : { o: 'defend', t: G.realms[0].capital, mode: 'intent', day: G.day };
  log('Знамёна дома ' + H0.name + ' подняты: ' + voin(menOf(a.u)) + ' (' + charName(kn) + ') идут ' + (cap ? 'на соединение с войском в столице.' : 'к столице.'), 'good'); }
// ---------- leaving and entering the court ----------
function mkRetinue() { const ws = WD.setts[G.realms[0].capital]; const r = mkArmy(0, 'player', G.player.char, ws.x, ws.y, { sword: 8, knight: 4, horse: 4, archer: 6 }); G.armies = G.armies.filter(a => a !== r); Object.assign(r, { food: 300, water: 4, morale: 60, wagons: 1 }); return r; }
function gateAct(intro) { const C = G.court; if (!C) return;
  if (C.regent >= 0) { DLG.say(null, 'Стража скрещивает копья: «Регент ' + regentName() + ' не велел выпускать юного государя за ворота. Подождите совершеннолетия, ваше величество».'); return; }
  const ca = capitalArmy(), kn = ca && charOf(ca.gen), ret = C.retinue; const ch = [];
  ch.push({ t: 'Выехать со свитой (' + (ret ? armyMen(ret) : 22) + ' чел.)', tip: 'Король сам поедет по королевству. Двор будет жить без него.', fx: () => leaveCourt(null) });
  if (ca) ch.push({ t: 'Возглавить войско у столицы (' + armyMen(ca) + (kn ? ', ' + charName(kn) : '') + ')', tip: 'Король ведёт войско сам: битвы — под вашей рукой.', fx: () => leaveCourt(ca) });
  ch.push({ t: 'Остаться в замке', fx: () => { } });
  DLG.say(null, intro || 'Ворота замка. За ними — дороги, деревни, граница и война. Кто правит из седла, видит всё своими глазами — но и двор живёт без него.', { name: 'Выезд из замка', choices: ch, esc: ch.length - 1 }); }
// from the map table: the king rides out himself (with the retinue or at the head of the capital army) to a settlement
function rideTo(sid) { const C = G.court; if (!C || !G.atCourt) return; const ws = WD.setts[sid], cw = WD.setts[G.realms[0].capital];
  if (C.regent >= 0) { DLG.say(null, 'Регент ' + regentName() + ' не велит юному государю покидать замок. Пошлите войско — или дождитесь совершеннолетия.'); return; }
  const ca = capitalArmy(), kn = ca && charOf(ca.gen), ret = C.retinue, foe = hostile(0, G.setts[sid].ctrl);
  const r0 = Object.assign({}, ret || mkRetinue(), { x: cw.x + 0.5, y: cw.y + 0.5 }); const days = pathDays(r0, planPath(r0, ws.i));
  const eta = !isFinite(days) ? 'пути нет' : days < 1 ? 'меньше дня пути' : 'около ' + Math.round(days) + ' ' + plural(Math.round(days), 'дня', 'дней', 'дней') + ' пути';
  const go = a => { leaveCourt(a); if (orderMove(ws.i, { k: 'sett', s: sid })) UI.toast('Король выехал ' + (a ? 'во главе войска' : 'со свитой') + ' · путь на ' + ws.name + ' (' + eta + ').'); };
  const ch = [{ t: 'Со свитой (' + (ret ? armyMen(ret) : 22) + ' чел.)', tip: foe ? 'Свита мала для войны: на чужой земле опасно.' : 'Налегке и быстро. Двор будет жить без короля.', fx: () => go(null) }];
  if (ca) ch.push({ t: 'Во главе войска у столицы (' + armyMen(ca) + (kn ? ', ' + charName(kn) : '') + ')', tip: 'Король ведёт войско сам: битвы — под вашей рукой.', fx: () => go(ca) });
  ch.push({ t: 'Остаться в замке', fx: () => { } });
  DLG.say(null, 'Ехать в ' + ws.name + ' самому? Отсюда ' + eta + '. Пока король в дороге, двор живёт без него: приёмы, советы и тайны — без государя.' + (foe ? ' Это вражеская земля.' : ''), { name: 'Поездка короля', choices: ch, esc: ch.length - 1 }); }
function stableAct() { gateAct('Конюх выводит осёдланного гнедого. «Куда поедем, государь?» В стойлах фыркают кони свиты.'); }
function leaveCourt(a) { const C = G.court, king = kingC(), ws = WD.setts[G.realms[0].capital]; let pa;
  const ret = C.retinue || mkRetinue(); C.retinue = null;
  if (a && a.alive) { const kn = charOf(a.gen); a.prevGen = a.gen; if (kn) kn.withKing = 1; a.gen = king.id; a.kind = 'player'; a.ai = null; a.cmd = null; a.pend = 0; G.couriers = (G.couriers || []).filter(c => c.to !== a.id); if (a.siegeOf >= 0) endSiege(a); a.path = null; a.onArrive = null;
    addU(a.u, ret.u); a.food += ret.food; a.morale = Math.max(a.morale, 55); pa = a; }
  else { pa = ret; pa.x = ws.x + 0.5; pa.y = ws.y + 0.5; pa.path = null; pa.alive = 1; pa.gen = king.id; if (!G.armies.includes(pa)) G.armies.push(pa); }
  G.player.army = pa.id; G.atCourt = 0; C.view = 0; king.atCourt = 0; G.player.follow = -1;
  COURT.sleepT = 0; UI.win = null; UI.target = null; SCREEN = 'map'; cam.z = 1; centerArmy(); if (!G.speed) G.speed = 1; autoPause('Король выехал в поле: укажите путь');
  if (typeof Snd !== 'undefined') { Snd.sfx('horn'); Snd.music('auto'); } log('Король выехал из замка' + (a ? ' во главе войска (' + voin(armyMen(pa)) + ').' : ' со свитой.'), 'info'); if (typeof TUT !== 'undefined') TUT.ev('leave'); }
function capitalGate(sid) { const ws = WD.setts[sid];
  DLG.say(null, 'Столица ' + ws.name + '. Над воротами замка — ваш стяг; стража трубит в рог.', { name: 'У ворот столицы', choices: [{ t: 'Въехать в замок — ко двору', fx: () => enterCourt() }, { t: 'Город: рынок, набор, гарнизон', fx: () => UI.open({ k: 'sett', id: sid }) }, { t: 'Остаться в поле', fx: () => { } }], esc: 2 }); }
function enterCourt() { const C = G.court, pa = playerArmy(), king = kingC(); if (!C) return;
  if (pa) { const men = armyMen(pa);
    if (men > 45) { const ret = splitRetinue(pa); const kn = armyToKnight(pa, 'hold'); C.retinue = ret; log('Войско осталось у стен под началом ' + charName(kn) + '.', 'info'); }
    else { G.armies = G.armies.filter(x => x !== pa); pa.path = null; pa.onArrive = null; if (pa.siegeOf >= 0) endSiege(pa); C.retinue = pa; } }
  for (const c of G.chars) if (c.withKing) { c.withKing = 0; if (!armyOfGen(c.id)) c.atCourt = 1; }
  G.player.army = C.retinue ? C.retinue.id : -1; G.atCourt = 1; king.atCourt = 1; C.view = 0; UI.win = null; UI.target = null; UI.modals = UI.modals.filter(m => m.k !== 'approach');
  courtEnter('gate_in'); log('Король вернулся в замок.', 'info'); if (typeof TUT !== 'undefined') TUT.ev('enter'); }
function splitRetinue(pa) { const u = emptyU(), want = { sword: 10, knight: 6, horse: 6, archer: 8 }; let got = 0; for (const t of UT) { const n = Math.min(pa.u[t] || 0, want[t] || 0); u[t] = n; pa.u[t] -= n; got += n; }
  for (const t of ['spear', 'levy']) { const n = Math.min(pa.u[t] || 0, Math.max(0, 30 - got)); u[t] += n; pa.u[t] -= n; got += n; }
  const ret = mkArmy(0, 'player', G.player.char, pa.x, pa.y, u); G.armies = G.armies.filter(x => x !== ret); const f = Math.min(300, pa.food); Object.assign(ret, { food: f, water: 4, morale: pa.morale, wagons: pa.wagons > 1 ? 1 : 0 }); pa.food -= f; if (ret.wagons) pa.wagons--; return ret; }
function armyToKnight(pa, o) { const pg = pa.prevGen >= 0 ? charOf(pa.prevGen) : null; const kn = pg && pg.alive && pg.prison < 0 ? pg : spareKnight() || mkKnight(); kn.withKing = 0; kn.atCourt = 0;
  pa.kind = 'lord'; pa.gen = kn.id; pa.prevGen = -1; pa.ai = { task: 'idle', t: 0 }; pa.onArrive = null; pa.path = null; G.player.follow = -1;
  pa.cmd = o === 'return' ? { o: 'ret', mode: 'intent', day: G.day } : { o: 'hold', mode: 'intent', day: G.day, x: pa.x, y: pa.y }; return kn; }
// the capital fell while the king sat at court: he flees with his retinue to the nearest fortress
function courtExileCheck() { if (!G.court || !G.atCourt) return; const cap = G.realms[0].capital; if (cap < 0 || G.setts[cap].ctrl === 0) return;
  const king = kingC(), cw = WD.setts[cap]; let S = null, bd = 1e9; for (const T of G.setts) { if (T.ctrl !== 0 || WD.setts[T.id].type === 'village') continue; const d = Math.hypot(WD.setts[T.id].x - cw.x, WD.setts[T.id].y - cw.y); if (d < bd) { bd = d; S = T; } }
  if (!S) { G.over = { win: false, why: 'Держава пала: у короля не осталось ни одной крепости.' }; return; }
  const ws = WD.setts[S.id], C = G.court; const ret = C.retinue || mkRetinue(); C.retinue = null; ret.x = ws.x + 0.5; ret.y = ws.y + 0.5; ret.alive = 1; ret.gen = king.id; ret.path = null; ret.onArrive = null; if (!G.armies.includes(ret)) G.armies.push(ret);
  G.player.army = ret.id; G.atCourt = 0; C.view = 0; king.atCourt = 0; G.player.follow = -1; if (typeof COURT !== 'undefined') COURT.sleepT = 0; UI.win = null; UI.target = null; while (DLG.open()) DLG.close();
  SCREEN = 'map'; centerArmy(); prestige(-8); log('Столица ' + cw.name + ' пала! Король со свитой бежал в ' + ws.name + '. Двор рассеян — верните замок, чтобы вернуться к трону.', 'bad'); UI.toast('Столица пала! Король бежал в ' + ws.name + '.'); }
// ---------- the map table: looking at the realm from the court ----------
function openMapFromCourt() { if (!G.court) return; G.court.view = 1; UI.win = null; SCREEN = 'map'; const [x, y] = settWorld(WD.setts[G.realms[0].capital]); centerOn(x, y); if (typeof Snd !== 'undefined') Snd.sfx('paper'); if (typeof TUT !== 'undefined') TUT.ev('maptable'); }
function backToCourt() { if (!G.court || !G.atCourt) return; G.court.view = 0; UI.win = null; UI.target = null; SCREEN = 'court'; if (!G.speed) G.speed = UI.lastSpeed || 1; courtPopulate(); courtSyncVisual(); snapCam(); if (typeof Snd !== 'undefined') Snd.sfx('door'); }
function mapCourtBar(x) { btn('tb_court', x, 2, 92, 14, { label: '« Ко двору (Tab)', style: 'dark', tip: ['Вернуться в замок', { t: 'Вы смотрите на карту королевства со стола в зале совета. Всё, что вы видите, — со слов гонцов и разведчиков.', c: UIC.dim }], onClick: () => backToCourt() });
  btn('tb_cmd', x + 96, 2, 60, 14, { label: 'Войска', ic: 'i_sword', style: 'dark', tip: 'Войска короны и приказы (V)', onClick: () => UI.open({ k: 'cmd' }) }); return x + 160; }
function worldAdvance(dd) {
  for (const a of G.armies) if (a.alive) advanceArmy(a, dd);
  updateFollow(); checkEncounters(); aiContacts(); couriersAdvance(dd);
  G.frac += dd; let n = 0;
  while (G.frac >= 1 && n++ < 3) { G.frac -= 1; dailyTick(); if (UI.paused() || (SCREEN !== 'map' && SCREEN !== 'court')) break; }
}
