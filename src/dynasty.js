'use strict';
// ===== DYNASTY: noble houses, the royal family, births & deaths, succession, wards & betrothals =====
const HOUSES = [
  { name: 'Вальмор', motto: '«Стоим, где стояли»', her: { div: 'pale', ramp: 'navy', ramp2: 'white', ramp3: 'gold', charge: 'tower' }, d: 'Старейший дом королевства. Горды и упрямы, но верны короне — пока корона чтит их права.', loy: 64, amb: 42, str: 70 },
  { name: 'Блэкторн', motto: '«Шип прежде цветка»', her: { div: 'bend', ramp: 'black', ramp2: 'rred', ramp3: 'white', charge: 'rose' }, d: 'Пограничные бароны: суровые воины. Давно косятся на трон и помнят старые обиды.', loy: 40, amb: 74, str: 90 },
  { name: 'Тремейн', motto: '«И за морем — наши»', her: { div: 'chevron', ramp: 'teal', ramp2: 'white', ramp3: 'gold', charge: 'ship' }, d: 'Богатый дом приморья, купцы и мореходы. Из этого дома — королева.', loy: 72, amb: 38, str: 50 },
  { name: 'Линдхерст', motto: '«Лес помнит»', her: { div: 'fess', ramp: 'forest', ramp2: 'gold', ramp3: 'white', charge: 'stag' }, d: 'Лесные лорды, охотники и лучники. Живут далеко, при дворе бывают редко, но всё слышат.', loy: 56, amb: 36, str: 60 },
  { name: 'Морбрей', motto: '«Всё сочтено»', her: { div: 'quarter', ramp: 'purple', ramp2: 'gold', ramp3: 'white', charge: 'key' }, d: 'Дом счетоводов и ростовщиков. Половина знати должна им денег.', loy: 52, amb: 62, str: 40 },
  { name: 'Эвершам', motto: '«Ни шагу назад»', her: { div: 'chief', ramp: 'red', ramp2: 'white', ramp3: 'gold', charge: 'boar' }, d: 'Воинственный дом из холмов. Лучшие рыцари королевства — и самые вспыльчивые.', loy: 60, amb: 54, str: 85 },
];
function houseName(id) { const H0 = G.houses && G.houses[id]; return H0 ? H0.name : '—'; }
function houseLoy(H0, v) { if (!H0) return; H0.loy = clamp((H0.loy || 50) + v, 0, 100); }
function houseOf(c) { return c && c.house >= 0 && G.houses ? G.houses[c.house] : null; }
function houseMembers(id) { return G.chars.filter(c => c.alive && c.house === id && c.realm === 0); }
function mkHouseMember(h, fem, age, o) { o = o || {}; const H0 = typeof h === 'number' ? G.houses[h] : h; const rng = o.rng || R;
  const given = o.given || pickName('K', fem, rng); const name = o.full || (given + ' ' + H0.name);
  const title = o.title !== undefined ? o.title : age >= 16 ? (fem ? 'Леди' : 'Лорд') : '';
  const c = mkChar(0, 'K', o.role || (age < 16 ? 'child' : 'courtier'), rng, Object.assign({ name, fem: fem ? 1 : 0, age, title }, o.st || {}));
  c.house = H0.id; c.atCourt = o.atCourt ? 1 : 0; if (age < 16) { for (const k of ['mar', 'dip', 'intr', 'stew', 'lrn']) c[k] = Math.max(1, Math.round(c[k] * 0.6)); } return c; }
// ---------- royal family helpers ----------
const kingC = () => charOf(G.player.char);
function royalFamily() { const k = kingC(), ids = new Set(); if (k.spouse >= 0) ids.add(k.spouse); for (const x of (k.kids || [])) ids.add(x); for (const x of ((G.court && G.court.royals) || [])) ids.add(x); ids.delete(k.id);
  return [...ids].map(charOf).filter(c => c && c.alive && !c.away && !c.ward); }
function heirOf(k) { k = k || kingC(); let L = (k.kids || []).map(charOf).filter(c => c && c.alive && !c.away);
  if (!L.length) L = ((G.court && G.court.royals) || []).map(charOf).filter(c => c && c.alive && !c.away && !c.dowager && c.id !== k.spouse && c.blood);
  L.sort((a, b) => (a.fem - b.fem) || (b.age - a.age)); return L[0] || null; }
function updateRoles() { const k = kingC(), h = heirOf(k); for (const c of royalFamily()) { if (c.id === k.spouse || c.dowager) continue; const nr = h && c.id === h.id ? 'heir' : c.age >= 16 ? 'courtier' : 'child'; if (c.role !== nr) c.role = nr; } }
function famRole(c) { const k = kingC(); if (!c) return ''; if (c.id === k.spouse) return k.fem ? 'Супруг королевы' : 'Королева';
  if (c.dowager) return 'Вдовствующая королева'; const h = heirOf(k); if (h && h.id === c.id) return (c.fem ? 'Наследница' : 'Наследник') + ' престола · ' + c.age + ' ' + plural(c.age, 'год', 'года', 'лет');
  if (c.age < 16) return (c.fem ? 'Принцесса' : 'Принц') + ' · ' + c.age + ' ' + plural(c.age, 'год', 'года', 'лет'); return c.fem ? 'Принцесса' : 'Принц'; }
// ---------- new game: the crown, the houses, the court ----------
function newGame3(seed, opt) {
  newGame(seed, opt); const rng = mkRng((seed ^ 0x5eed3) >>> 0); G.v = 3; G.log = [];
  G._resv = ['Освальд', 'Рейнард', 'Гарет', 'Сибилла', 'Конрад', 'Освин', 'Бертран', 'Розамунда', 'Хьюго', 'Седрик', 'Тибальт', 'Изольда', 'Эдмунд', 'Беатрис', 'Тристан'];
  const king = charOf(G.player.char); Object.assign(king, { lrn: 8, loy: 100, hon: 82, amb: 50, house: -1, kids: [], atCourt: 1, spouse: -1 });
  G.houses = HOUSES.map((d, i) => ({ id: i, name: d.name, motto: d.motto, her: Object.assign({}, d.her), d: d.d, loy: d.loy, amb: d.amb, str: d.str, alive: 1, defiant: 0, head: -1, fief: -1 }));
  const cap = G.realms[0].capital, capW = WD.setts[cap];
  const seats = G.setts.filter(S => S.owner === 0 && S.id !== cap && WD.setts[S.id].type !== 'village').sort((a, b) => b.pop - a.pop);
  const vill = G.setts.filter(S => S.owner === 0 && WD.setts[S.id].type === 'village').sort((a, b) => b.pop - a.pop); const fiefs = seats.concat(vill);
  G.houses.forEach((H0, i) => { const S = fiefs[i]; const head = mkHouseMember(H0, i === 3 ? 1 : 0, rng.i(42, 63), { role: 'lord', rng, st: { mar: rng.i(6, 14), loy: H0.loy, amb: H0.amb } }); H0.head = head.id; if (S) { H0.fief = S.id; S.house = H0.id; S.lord = head.id; } });
  // the royal family
  const q = mkHouseMember(2, 1, 30, { given: 'Изольда', full: 'Изольда', role: 'consort', title: 'Королева', atCourt: 1, rng, st: { dip: 12, intr: 9, stew: 8, lrn: 10, mar: 4, loy: 80, hon: 76, amb: 34, traits: ['generous', 'patient'] } }); q.aff = 70;
  king.spouse = q.id; q.spouse = king.id;
  const heir = mkChar(0, 'K', 'heir', rng, { name: 'Эдмунд', fem: 0, age: 11, title: 'Принц', mar: 6, dip: 7, intr: 4, stew: 4, lrn: 6, loy: 90, hon: 70, amb: 55, traits: ['brave', 'proud'] });
  const prin = mkChar(0, 'K', 'child', rng, { name: 'Беатрис', fem: 1, age: 7, title: 'Принцесса', mar: 2, dip: 6, intr: 7, stew: 3, lrn: 5, loy: 95, hon: 60, amb: 40, traits: ['cunning', 'generous'] });
  for (const c of [heir, prin]) { c.house = -1; c.atCourt = 1; c.blood = 1; c.parents = [king.id, q.id]; c.aff = 70; } king.kids = [heir.id, prin.id]; q.kids = [heir.id, prin.id];
  const ward = mkHouseMember(1, 0, 12, { given: 'Тристан', role: 'child', title: '', atCourt: 1, rng, st: { traits: ['proud', 'cautious'] } }); ward.ward = 1; ward.happy = 0;
  // the council (the justice's chair is empty: the old judge died this winter)
  const S7 = (h, fem, given, age, st, title) => { const c = mkHouseMember(h, fem, age, { given, role: 'council', atCourt: 1, rng, st, title }); return c; };
  const seat = {
    chancellor: S7(0, 0, 'Освальд', 52, { dip: 14, intr: 9, stew: 9, mar: 6, lrn: 10, loy: 72, hon: 70, amb: 44, traits: ['wise', 'proud'] }),
    treasurer: S7(4, 0, 'Рейнард', 47, { stew: 13, dip: 8, intr: 11, lrn: 9, mar: 4, loy: 56, hon: 26, amb: 66, traits: ['greedy', 'cunning'] }),
    marshal: S7(5, 0, 'Гарет', 44, { mar: 14, dip: 6, stew: 7, lrn: 5, intr: 6, loy: 66, hon: 66, amb: 50, traits: ['brave', 'wrathful'] }),
    eye: S7(3, 1, 'Сибилла', 38, { intr: 14, dip: 10, stew: 7, lrn: 9, mar: 3, loy: 62, hon: 48, amb: 58, traits: ['cunning', 'cautious'] }),
    seneschal: S7(2, 0, 'Конрад', 50, { stew: 11, dip: 9, mar: 5, intr: 6, lrn: 7, loy: 72, hon: 84, amb: 30, traits: ['honest', 'patient'] }),
    magister: mkChar(0, 'K', 'council', rng, { name: 'Освин', title: 'Магистр', fem: 0, age: 63, lrn: 15, dip: 7, intr: 7, stew: 6, mar: 2, loy: 74, hon: 80, amb: 20, traits: ['wise', 'patient'] }),
  }; seat.magister.house = -1; seat.magister.atCourt = 1;
  // courtiers: candidates for appointments
  mkHouseMember(0, 0, 33, { given: 'Бертран', atCourt: 1, rng, st: { lrn: 13, dip: 9, stew: 8, intr: 5, mar: 6, loy: 68, hon: 80, amb: 40, traits: ['honest', 'cautious'] } });
  mkHouseMember(1, 1, 26, { given: 'Розамунда', atCourt: 1, rng, st: { intr: 12, dip: 11, lrn: 8, stew: 6, mar: 4, loy: 38, hon: 40, amb: 82, traits: ['cunning', 'proud'] } });
  mkHouseMember(4, 0, 29, { given: 'Хьюго', atCourt: 1, rng, st: { stew: 12, lrn: 10, dip: 7, intr: 5, mar: 5, loy: 64, hon: 84, amb: 36, traits: ['honest', 'patient'] } });
  mkHouseMember(5, 0, 24, { given: 'Седрик', role: 'knight', title: 'Сэр', atCourt: 1, rng, st: { mar: 11, dip: 5, stew: 4, lrn: 4, intr: 4, loy: 70, hon: 70, amb: 60, traits: ['brave', 'reckless'] } });
  { const c = mkChar(0, 'K', 'scholar', rng, { name: 'Тибальт', title: 'Брат', fem: 0, age: 45, lrn: 12, dip: 6, intr: 6, stew: 9, mar: 2, loy: 66, hon: 74, amb: 22, traits: ['patient', 'honest'] }); c.house = -1; c.atCourt = 1; }
  // knights in command of the crown's armies (the v2 «воеводы»)
  const gens = G.chars.filter(c => c.realm === 0 && c.role === 'general'); const kh = [5, 1, 3];
  gens.forEach((c, i) => { c.role = 'knight'; c.title = 'Сэр'; c.house = kh[i % 3]; c.name = pickName('K', 0, rng) + ' ' + houseName(c.house); c.fem = 0; c.atCourt = 0; });
  if (gens[0]) { gens[0].traits = ['cautious', 'patient']; gens[0].mar = 13; } if (gens[1]) { gens[1].traits = ['reckless', 'brave']; gens[1].mar = 11; }
  const pa = playerArmy(); pa.kind = 'lord'; pa.gen = gens[0] ? gens[0].id : -1; pa.ai = { task: 'idle', t: 0 }; pa.cmd = { o: 'hold', mode: 'intent', t: cap, day: 0 }; for (const t of UT) pa.xp[t] = 15;
  // border army: at the own fortress closest to the Northmen
  const foe = G.realms[1].capital, fw = WD.setts[foe]; const bS = seats.slice().sort((a, b) => Math.hypot(WD.setts[a.id].x - fw.x, WD.setts[a.id].y - fw.y) - Math.hypot(WD.setts[b.id].x - fw.x, WD.setts[b.id].y - fw.y))[0];
  if (bS && gens[1]) { const w = WD.setts[bS.id]; const b = mkArmy(0, 'lord', gens[1].id, w.x, w.y, { levy: 50, spear: 40, sword: 10, archer: 30, horse: 15 }); Object.assign(b, { food: 1100, fodder: 120, water: 4, arrows: 900, weap: 20, horses: 2, wagons: 3 }); b.ai = { task: 'idle', t: 0 }; b.cmd = { o: 'hold', mode: 'intent', t: bS.id, day: 0 }; }
  // the king's retinue: lives at court (not on the map) until the king rides out
  const ret = mkArmy(0, 'player', king.id, capW.x, capW.y, { sword: 10, knight: 6, horse: 6, archer: 8 }); Object.assign(ret, { food: 340, fodder: 80, water: 4, arrows: 300, weap: 10, horses: 2, wagons: 1, morale: 70 });
  G.armies = G.armies.filter(a => a !== ret); G.player.army = ret.id;
  G.court = { seats: {}, orders: {}, hidden: 0, susp: 0, reports: [], letters: [], secrets: [], grain: 6000, wards: [ward.id], regent: -1, prestige: 0, net: { 1: 0, 2: 1, 3: 0, 4: 0 }, known: {}, guard: 0, incK: 1, taxK: 1, retinue: ret, meetDay: -1, meetDone: -1, musters: [], royals: [], view: 0 };
  for (const s of SEATS) G.court.seats[s.k] = -1; for (const k in seat) { G.court.seats[k] = seat[k].id; seat[k].seat = k; }
  G.tech = { done: {}, cur: null, prog: 0, bank: 4 }; G.couriers = []; G.atCourt = 1;
  for (const c of G.chars) if (c.realm === 0 && c.loy === undefined) c.loy = 60;
  log('Год 1. Король ' + king.name + ' правит из замка в столице ' + capW.name + '. Королевством правят словом — через верных людей.', 'title');
  letterFromSeat('chancellor', 'Добро пожаловать домой, государь', welcomeText(), { arr: 0.02, dyn: 'welcome' });
  delete G._resv; return G;
}
// the chancellor's welcome is read whenever the page brings it: it tells how things stand at that moment, not at dawn of the first day
function welcomeText() { const C = G.court, j = seatChar('justice'), met = C && C.meetDone >= 0;
  return 'Ваше величество, с возвращением! ' + (j ? 'Все места в малом совете заняты: кресло верховного судьи, пустовавшее с зимы, занял ' + j.name + '.' : 'Все места в малом совете заняты, кроме одного: старый верховный судья скончался этой зимой, его кресло пустует — назначьте судью в окне совета (K).')
    + (met ? ' Совет при вас уже заседал; впредь он собирается раз в неделю — по четвергам в 9:30.' : ' Малый совет собирается раз в неделю — по четвергам в 9:30; при нужде его можно созвать и срочно.')
    + ' Просители ждут у трона по утрам. Дом Блэкторн ропщет: их сын Тристан живёт у нас воспитанником, а сами они всё чаще поминают старые обиды.'; }
// ---------- daily: births, deaths, ageing, houses ----------
function dynastyDaily() { if (!G.houses || G.over) return; const C = G.court, king = kingC();
  if (dayOfYear(G.day) === 0 && G.day > 0) yearTick();
  pregnancyTick(king);
  if (G.day % 7 === 5) housesWeekly();
  for (const m of (C.musters || []).slice()) if (m.day <= G.day) { C.musters.splice(C.musters.indexOf(m), 1); try { spawnMuster(m); } catch (e) { console.warn(e); } }
}
function deathChance(c) { const a = c.age; let p = a < 5 ? 0.02 : a < 40 ? 0.004 : a < 55 ? 0.012 : a < 65 ? 0.045 : a < 75 ? 0.12 : 0.26; if (c.blood || c.role === 'ruler' || c.role === 'consort') p *= hasTech('antidotes') ? 0.5 : 0.8; if ((c.blood || c.role === 'ruler' || c.role === 'consort') && G.court && G.court.hpray >= G.day - DAYS_SEASON) p *= 0.8; return p; }
function yearTick() { const C = G.court, king = kingC();
  for (const c of G.chars) if (c.alive && !c.pseudo) c.age++;
  log('Новый год ' + yearOf(G.day) + '. Королю ' + king.name + ' — ' + king.age + ' ' + plural(king.age, 'год', 'года', 'лет') + '.', 'season');
  for (const c of G.chars.slice()) { if (!c.alive || c.realm !== 0 || c.pseudo || c.prison >= 0) continue; if (R.chance(deathChance(c))) charDies(c, c.age >= 55 ? 'старость' : 'хворь'); if (G.over) return; }
  for (const c of G.chars) if (c.alive && c.realm === 0 && c.age === 16 && !c.adult) comeOfAge(c);
  const k2 = kingC(); if (C.regent >= 0 && k2.age >= 16) { const r = charOf(C.regent); C.regent = -1; log('Король ' + k2.name + ' достиг совершеннолетия. Регентство ' + (r ? r.name + ' ' : '') + 'окончено — теперь король правит сам.', 'title'); prestige(4); }
  updateRoles(); if (SCREEN === 'court') courtPopulate(); }
function charDies(c, why) { const C = G.court, king = kingC(); if (!c.alive) return; c.alive = 0; c.deathDay = G.day;
  const k = seatOf(c); if (k) { C.seats[k] = -1; C.orders[k] = null; if (k === 'magister' && G.tech) G.tech.cur = G.tech.cur; }
  const a = armyOfGen(c.id); if (a) { const nk = spareKnight(); a.gen = nk ? nk.id : mkKnight().id; }
  const H0 = houseOf(c); if (H0 && H0.head === c.id) newHead(H0);
  const wi = C.wards.indexOf(c.id); if (wi >= 0) { C.wards.splice(wi, 1); if (H0) houseLoy(H0, -20); }
  if (c.id === C.regent) { C.regent = -1; if (king.age < 16) pickRegent(); }
  const fam = c.id === king.id || c.id === king.spouse || (king.kids || []).includes(c.id) || c.dowager;
  const nm = charName(c); log((fam ? '✝ ' : '') + nm + ' скончал' + (c.fem ? 'ась' : 'ся') + ' (' + why + ').' + (k ? ' Место «' + seatName(k) + '» пустует.' : ''), fam ? 'bad' : 'info');
  if (fam && typeof Snd !== 'undefined') Snd.sfx('bell');
  if (c.id === king.id) { kingDied(c); return; }
  if (c.id === king.spouse) { king.spouse = -1; king.widow = G.day; }
  for (const x of G.chars) if (x.betrothed === c.id) x.betrothed = -1;
  updateRoles(); if (SCREEN === 'court') courtPopulate();
}
function spareKnight() { return G.chars.find(c => c.alive && c.realm === 0 && c.role === 'knight' && c.prison < 0 && !armyOfGen(c.id) && !c.withKing && c.age >= 16) || null; }
function mkKnight() { const H = G.houses.filter(h => h.alive); const c = mkHouseMember(R.pick(H), 0, R.i(24, 45), { role: 'knight', title: 'Сэр', st: { mar: R.i(7, 13) } }); return c; }
function newHead(H0) { const L = houseMembers(H0.id).filter(c => c.age >= 16 && c.id !== H0.head && !c.seat && c.role !== 'consort').sort((a, b) => b.age - a.age);
  const h = L[0] || mkHouseMember(H0, 0, R.i(26, 48), { role: 'lord' }); h.role = h.role === 'knight' ? 'knight' : 'lord'; H0.head = h.id; H0.loy = Math.round((H0.loy + 50) / 2); if (H0.fief >= 0) G.setts[H0.fief].lord = h.id;
  log('Новый глава дома ' + H0.name + ' — ' + charName(h) + '.', 'info'); }
function pickRegent() { const C = G.court, king = kingC(); const mom = (king.parents || []).map(charOf).find(c => c && c.alive && c.fem);
  const ch = seatChar('chancellor'); const r = mom || ch || G.houses.filter(h => h.alive).map(h => charOf(h.head)).filter(Boolean).sort((a, b) => b.loy - a.loy)[0];
  if (r) { C.regent = r.id; log('Регентом до совершеннолетия короля стал' + (r.fem ? 'а ' : ' ') + charName(r) + '.', 'title'); } }
function regentName() { const C = G.court; const r = C && C.regent >= 0 ? charOf(C.regent) : null; return r ? charName(r) : ''; }
function kingDied(k) { const C = G.court; const heir = heirOf(k); C.ancestors = (C.ancestors || []).concat([k.id]);
  if (!heir) { G.over = { win: false, why: 'Король ' + k.name + ' умер, не оставив наследника. Династия пресеклась, и знатные дома делят корону между собой.' }; return; }
  C.royals = [...new Set((C.royals || []).concat(k.kids || []).concat(k.spouse >= 0 ? [k.spouse] : []))].filter(id => id !== heir.id);
  if (k.spouse >= 0) { const w = charOf(k.spouse); if (w && w.alive) { w.dowager = 1; w.title = w.fem ? 'Королева-мать' : 'Принц'; w.spouse = -1; } }
  for (const id of (k.kids || [])) { const c = charOf(id); if (c) c.blood = 1; }
  G.player.char = heir.id; G.realms[0].ruler = heir.id; heir.role = 'ruler'; heir.title = heir.fem ? 'Королева' : 'Король'; heir.loy = 100; heir.atCourt = 1; heir.away = 0; heir.kids = heir.kids || []; heir.seat = null;
  if (heir.spouse === undefined) heir.spouse = -1;
  for (const s of SEATS) if (C.seats[s.k] === heir.id) { C.seats[s.k] = -1; C.orders[s.k] = null; }
  const ga = armyOfGen(heir.id); if (ga) { const nk = spareKnight(); ga.gen = nk ? nk.id : mkKnight().id; }
  for (const H0 of G.houses) houseLoy(H0, (H0.amb > 60 ? -8 : -3)); prestige(-5);
  if (heir.age < 16) pickRegent();
  log('Король умер — да здравствует ' + (heir.fem ? 'королева ' : 'король ') + heir.name + '!' + (heir.age < 16 ? ' Ему всего ' + heir.age + ' ' + plural(heir.age, 'год', 'года', 'лет') + '.' : ''), 'title');
  // the new ruler is at court; the old king's army is left to a knight
  if (!G.atCourt) { const pa = playerArmy(); if (pa) armyToKnight(pa, 'return'); const ws = WD.setts[G.realms[0].capital]; const ret = mkArmy(0, 'player', heir.id, ws.x, ws.y, { sword: 8, horse: 8, archer: 6 }); Object.assign(ret, { food: 300, water: 4, morale: 60 }); G.armies = G.armies.filter(a => a !== ret); C.retinue = ret; G.player.army = ret.id; G.atCourt = 1; C.view = 0; G.toCourt = 1; }
  else if (C.retinue) C.retinue.gen = heir.id;
  updateRoles(); if (SCREEN === 'court') { COURT.p.c = heir; courtPopulate(); DLG.say(null, 'Колокола звонят по королю ' + k.name + '. Двор склоняет головы перед новым государем — ' + heir.name + '.' + (C.regent >= 0 ? ' До совершеннолетия страной правит регент: ' + regentName() + '.' : ''), { name: 'Смерть короля' }); }
}
function comeOfAge(c) { const C = G.court; c.adult = 1; const H0 = houseOf(c);
  if (c.ward) { const i = C.wards.indexOf(c.id); if (i >= 0) C.wards.splice(i, 1); c.ward = 0; c.atCourt = 0; c.role = 'courtier'; c.title = c.fem ? 'Леди' : 'Лорд'; if (H0) houseLoy(H0, 6 + clamp(c.happy || 0, -5, 8)); log(c.name + ' вырос' + (c.fem ? 'ла' : '') + ' при дворе и вернул' + (c.fem ? 'ась' : 'ся') + ' в дом ' + houseName(c.house) + (c.happy > 2 ? ' — с тёплыми словами о короле.' : '.'), 'info'); return; }
  if (c.blood) { log((c.fem ? 'Принцесса ' : 'Принц ') + c.name + ' достиг' + (c.fem ? 'ла' : '') + ' совершеннолетия.', 'good');
    const p = c.betrothed >= 0 ? charOf(c.betrothed) : null; if (p && p.alive && p.age >= 15) marry(c, p); } }
function marry(c, p) { const C = G.court, H0 = houseOf(p); c.spouse = p.id; p.spouse = c.id; c.betrothed = p.betrothed = -1; const heir = heirOf();
  if (!c.fem || (heir && heir.id === c.id)) { p.atCourt = 1; p.role = 'courtier'; C.royals.push(p.id); p.blood = 0; }
  else { c.away = 1; c.atCourt = 0; }
  if (H0) houseLoy(H0, 12); prestige(3); log('Свадьба! ' + c.name + ' и ' + p.name + ' обвенчаны. Дом ' + houseName(p.house) + ' породнился с короной.', 'good'); if (typeof Snd !== 'undefined') Snd.sfx('fanfare_small'); }
function betroth(kidId, hid) { const c = charOf(kidId), H0 = G.houses[hid]; if (!c || !H0 || c.betrothed >= 0) return null;
  const p = mkHouseMember(H0, c.fem ? 0 : 1, clamp(c.age + R.i(-2, 2), 1, 30), {}); p.atCourt = 0; c.betrothed = p.id; p.betrothed = c.id;
  houseLoy(H0, 15); for (const h of G.houses) if (h !== H0 && h.amb > 60) houseLoy(h, -3); prestige(1);
  log('Помолвка: ' + c.name + ' и ' + p.name + ' (дом ' + H0.name + '). Свадьба — когда ' + (c.age < 16 ? (c.fem ? 'невесте' : 'жениху') + ' исполнится 16.' : 'настанет срок.'), 'good');
  if (c.age >= 16 && p.age >= 15) marry(c, p); return p; }
function takeWard(hid) { const C = G.court, H0 = G.houses[hid]; if (C.wards.some(w => charOf(w) && charOf(w).house === hid)) return null;
  const c = mkHouseMember(H0, R.chance(0.4) ? 1 : 0, R.i(8, 13), { role: 'child', title: '', atCourt: 1 }); c.ward = 1; c.happy = 0; C.wards.push(c.id); houseLoy(H0, 4);
  log('Дом ' + H0.name + ' прислал ко двору воспитанника: ' + c.name + '. Пока дитя при дворе, дом дважды подумает, прежде чем бунтовать.', 'info'); if (SCREEN === 'court') courtPopulate(); return c; }
function housesWeekly() { const C = G.court, king = kingC(); const fam = royalFamily();
  for (const H0 of G.houses) { if (!H0.alive) continue;
    const seats = SEATS.filter(s => { const c = seatChar(s.k); return c && c.house === H0.id; }).length;
    const ward = C.wards.some(w => charOf(w) && charOf(w).house === H0.id);
    const kin = fam.some(c => (c.betrothed >= 0 && charOf(c.betrothed) && charOf(c.betrothed).house === H0.id) || (c.spouse >= 0 && charOf(c.spouse) && charOf(c.spouse).house === H0.id)) || (king.spouse >= 0 && charOf(king.spouse) && charOf(king.spouse).house === H0.id);
    let tgt = 46 + (C.prestige || 0) * 0.3 + seats * 7 + (ward ? 4 : 0) + (kin ? 12 : 0) - (H0.amb - 50) * 0.4 + (H0.fief < 0 ? -15 : 0) + (C.regent >= 0 ? -6 : 0) + (C.taxK < 1 ? 4 : 0);
    if (warsOf(0).length && G.realms[0].fear < 0) tgt -= 4;
    H0.loy = clamp(H0.loy + (clamp(tgt, 5, 95) - H0.loy) * 0.05 + R.range(-1, 1), 0, 100);
    if (H0.fief >= 0 && G.setts[H0.fief].owner !== 0) { H0.fief = -1; houseLoy(H0, -15); log('Дом ' + H0.name + ' лишился своих земель: их крепость в чужих руках. Лорды винят корону.', 'bad'); }
    // telegraphed rebellion (Stage 1 stops at defiance): no taxes, ugly letters
    if (!(H0.defiant > G.day) && H0.loy < 18 && H0.amb > 55 && !ward && R.chance(0.3)) { H0.defiant = G.day + 30; const h = charOf(H0.head); log('Дом ' + H0.name + ' перестал присылать подати короне. Говорят, ' + (h ? charName(h) : 'их лорд') + ' собирает людей…', 'bad'); letterFromSeat('eye', 'Тревога: дом ' + H0.name, 'Государь, дом ' + H0.name + ' не платит податей и точит мечи. Пока это лишь ропот — но ропот бывает началом мятежа. Подарки, место в совете, помолвка или пир могут вернуть их верность.'); }
    else if (H0.defiant > G.day && H0.loy >= 30) { H0.defiant = 0; log('Дом ' + H0.name + ' снова платит подати короне.', 'good'); }
  } }
function pregnancyTick(king) { const C = G.court; const sp = king.spouse >= 0 ? charOf(king.spouse) : null; if (!sp || !sp.alive) return; const mom = king.fem ? king : sp;
  if (mom.preg) { if (!mom.pregKnown && G.day >= mom.preg - 30) { mom.pregKnown = 1; log((mom === king ? 'Королева' : 'Королева ' + mom.name) + ' ждёт ребёнка! Двор ликует.', 'good'); prestige(2); if (G.atCourt) { if (SCREEN === 'court') { const n = npcByKey('spouse'); if (n) say(n, 'У нас будет ребёнок!', 5); } } else addLetter({ from: 'Королева ' + mom.name, fc: mom.id, subj: 'Добрая весть', text: 'Мой король! Лекари говорят, что к концу сезона у нас будет дитя. Возвращайтесь скорее.', x: WD.setts[G.realms[0].capital].x, y: WD.setts[G.realms[0].capital].y }); }
    if (G.day >= mom.preg) birth(king, sp, mom); return; }
  const kids = (king.kids || []).filter(x => charOf(x) && charOf(x).alive).length;
  if (mom.age < 44 && kids < 6 && G.day - (mom.lastBirth || -999) > 50) { const p = 0.006 + (projDone('roses') ? 0.002 : 0) + (C.together === G.day ? 0.05 : 0) + (C.bless && C.bless.k === 'heir' && C.bless.until >= G.day ? 0.006 * (C.bless.m || 1) : 0) - (G.atCourt ? 0 : 0.005); if (R.chance(Math.max(0, p))) { mom.preg = G.day + 40; mom.pregKnown = 0; } } }
function birth(king, sp, mom) { mom.preg = 0; mom.lastBirth = G.day; const fem = R.chance(0.5) ? 1 : 0;
  const opts = []; for (let k = 0; k < 6 && opts.length < 3; k++) { const n = pickName('K', fem); if (!opts.includes(n)) opts.push(n); }
  const mk = name => { const c = mkChar(0, 'K', 'child', R, { name, fem, age: 0, title: fem ? 'Принцесса' : 'Принц' }); c.house = -1; c.atCourt = 1; c.blood = 1; c.parents = [king.id, sp.id]; c.aff = 70; for (const k of ['mar', 'dip', 'intr', 'stew', 'lrn']) c[k] = R.i(2, 8);
    king.kids = king.kids || []; king.kids.push(c.id); sp.kids = sp.kids || []; sp.kids.push(c.id); updateRoles(); prestige(3); for (const H0 of G.houses) houseLoy(H0, 1);
    log('Родил' + (fem ? 'ась принцесса ' : 'ся принц ') + name + '! Колокола звонят по всему королевству.', 'good'); if (typeof Snd !== 'undefined') Snd.sfx('fanfare_small'); if (SCREEN === 'court') { courtSyncVisual(); courtPopulate(); } return c; };
  if (SCREEN === 'battle' || typeof DLG === 'undefined') { mk(opts[0]); return; }
  DLG.say(null, 'Повитуха выходит из покоев королевы: «' + (fem ? 'Девочка' : 'Мальчик') + ', государь! Здоров' + (fem ? 'а' : '') + ' и голосист' + (fem ? 'а' : '') + '!» Как назовёте ' + (fem ? 'принцессу' : 'принца') + '?', { name: 'Рождение', choices: opts.map(n => ({ t: n, fx: () => mk(n) })), esc: 0 }); }
// ---------- conversations with the family ----------
function talkFamily(n) { const c = n.c, king = kingC(); if (c.id === king.spouse) return talkSpouse(n); if (c.age < 16) return talkChild(n);
  DLG.say(n, c.dowager ? R.pick(['Ваш отец гордился бы вами.', 'Береги себя, дитя моё. Двор — опасное место.', 'Я молюсь за тебя каждый вечер.']) : R.pick(['Государь! Рад видеть вас.', 'Двор нынче шумный, не находите?', 'Если понадоблюсь — я в библиотеке.'])); }
function talkSpouse(n) { const c = n.c, C = G.court, h = hourAbs(); c.aff = c.aff === undefined ? 60 : c.aff;
  const greet = c.aff >= 70 ? R.pick(['Мой король! Я скучала.', 'Вот и ты. Присядь со мной хоть на минуту.']) : c.aff >= 40 ? R.pick(['Государь.', 'Ты сегодня рано.']) : R.pick(['…Ваше величество.', 'Вы что-то хотели?']);
  const ch = [{ t: 'Что говорят при дворе?', fx: () => DLG.say(n, queenGossip(c)) }];
  if (h >= 18.5 || h < 2) ch.push({ t: 'Провести вечер вместе', ok: () => C.together !== G.day, why: 'Сегодня вы уже были вместе', fx: () => { C.together = G.day; c.aff = clamp(c.aff + 4, 0, 100); fadeTo(() => advanceHours(1.5)); UI.toast('Вечер у камина…'); } });
  ch.push({ t: 'Подарить украшение (30 зол.)', fx: () => { if (spend(30)) { c.aff = clamp(c.aff + 10, 0, 100); houseLoy(houseOf(c), 2); DLG.say(n, 'Какая прелесть! Ты помнишь, что я люблю гранаты.'); } } });
  ch.push({ t: 'Ничего, дорогая', fx: () => { } });
  DLG.say(n, greet + (c.preg && c.pregKnown ? ' Малыш сегодня толкается.' : ''), { choices: ch, esc: ch.length - 1 }); }
function queenGossip(c) { const C = G.court; const sec = C.secrets.filter(s => !s.known && (s.k === 'love' || s.k === 'plot' || s.k === 'theft'));
  if (sec.length && R.chance(0.45)) { const s = R.pick(sec), a = charOf(s.who[0]); if (s.k === 'love') return 'Говорят, ' + (a ? a.name : 'кто-то из придворных') + ' по ночам гуляет в саду. И не один. Я бы на твоём месте прислушалась.';
    if (s.k === 'theft') return 'Мой брат Конрад жалуется: казначей купил себе новое поместье. На жалованье казначея? Странно, правда?'; return 'Дамы из дома ' + houseName(s.house) + ' сторонятся меня в последнее время. Что-то затевают — чувствую.'; }
  const H = G.houses.filter(h => h.alive).sort((a, b) => a.loy - b.loy); const lo = H[0], hi = H[H.length - 1];
  return R.pick(['Дом ' + lo.name + ' тобой недоволен — это видно по тому, как они кланяются. А ' + hi.name + ' тебя обожают.', 'Мой отец пишет из Тремейна: море спокойно, купцы богатеют. Хоть где-то всё хорошо.', 'Эдмунд снова сбежал с урока к оружейному мастеру. Весь в тебя.', 'При дворе шепчутся о ' + (warsOf(0).length ? 'войне. Люди боятся.' : 'пирах. Давно не было праздника.')]); }
function talkChild(n) { const c = n.c, king = kingC(); c.aff = c.aff === undefined ? 70 : c.aff; const heir = heirOf();
  const best = ['mar', 'dip', 'intr', 'stew', 'lrn'].sort((a, b) => c[b] - c[a])[0];
  const ch = [{ t: 'Как учёба?', fx: () => DLG.say(n, 'Магистр говорит, лучше всего у меня — ' + SKN[best] + ' (' + c[best] + '). ' + (c.age < 8 ? 'А ещё я умею считать до ста!' : 'Но латынь — скука смертная.')) }];
  if (c.age >= 7) ch.push({ t: 'Поупражняться с мечом', ok: () => !(c.drill > G.day - 7), why: 'Хватит на этой неделе', fx: () => { c.drill = G.day; c.aff = clamp(c.aff + 3, 0, 100); if (R.chance(0.5)) c.mar = Math.min(20, c.mar + 1); Snd.sfx('thud'); DLG.say(n, R.pick(['Ха! Я почти попал!', 'Ещё раз! Ещё!', 'Когда я вырасту, я поведу войско!'])); } });
  ch.push({ t: 'Рассказать историю о битве', ok: () => !(c.story > G.day - 3), why: 'Вчера уже рассказывали', fx: () => { c.story = G.day; c.aff = clamp(c.aff + 2, 0, 100); if (R.chance(0.3)) c.dip = Math.min(20, c.dip + 1); DLG.say(n, '…и тогда Сунь-цзы сказал: «Лучшая победа — та, что без боя». А как это — без боя?'); } });
  ch.push({ t: 'Иди играй', fx: () => { } });
  DLG.say(n, (heir && heir.id === c.id ? 'Отец! ' : 'Папа! ') + R.pick(['Ты сегодня не занят?', 'Смотри, что я нашёл в саду!', 'А правда, что у Блэкторнов на гербе шипы?', 'Мама говорит, ты король всего-всего.']), { choices: ch, esc: ch.length - 1 }); }
function talkWard(n) { const c = n.c, C = G.court, H0 = houseOf(c); c.happy = c.happy || 0;
  const mood = c.happy >= 3 ? 'Мне здесь нравится, государь! Принц Эдмунд — мой лучший друг.' : c.happy >= 0 ? 'Я скучаю по дому, государь… Но здесь неплохо.' : 'Отпустите меня домой. Меня держат здесь как заложника!';
  const ch = [{ t: 'Учиться вместе с принцем', ok: () => !(c.study > G.day - 7), why: 'На этой неделе уже было', fx: () => { c.study = G.day; c.happy++; c.lrn = Math.min(20, c.lrn + 1); DLG.say(n, 'Спасибо, государь! Я буду стараться.'); } },
    { t: 'Написать его отцу добрые слова', ok: () => !(c.wrote > G.day - 21), why: 'Недавно уже писали', fx: () => { c.wrote = G.day; houseLoy(H0, 2); c.happy++; UI.toast('Письмо отправлено в дом ' + houseName(c.house) + '.'); } },
    { t: 'Отпустить домой', fx: () => DLG.say(null, 'Отпустить ' + c.name + ' домой? Дом ' + houseName(c.house) + ' будет благодарен, но вы лишитесь залога их верности.', { choices: [{ t: 'Отпустить', fx: () => { const i = C.wards.indexOf(c.id); if (i >= 0) C.wards.splice(i, 1); c.ward = 0; c.atCourt = 0; c.away = 1; houseLoy(H0, 8); npcLeave(n); log(c.name + ' отпущен домой, в дом ' + houseName(c.house) + '.', 'info'); } }, { t: 'Нет', fx: () => { } }], esc: 1 }) },
    { t: 'Ступай', fx: () => { } }];
  DLG.say(n, mood, { choices: ch, esc: ch.length - 1 }); }
function cribDialog() { const king = kingC(); const babies = (king.kids || []).map(charOf).filter(c => c && c.alive && c.age < 3);
  if (!babies.length) { DLG.say(null, 'Резная колыбель пуста. ' + ((king.spouse >= 0 && charOf(king.spouse) && charOf(king.spouse).preg) ? 'Скоро в ней снова будет кто-то спать.' : 'Её берегут для будущих принцев.')); return; }
  const b = babies[babies.length - 1]; DLG.say(null, 'В колыбели посапывает ' + (b.fem ? 'принцесса ' : 'принц ') + b.name + '. Крошечный кулачок сжимает край одеяла.', { choices: [{ t: 'Покачать колыбель', fx: () => { b.aff = clamp((b.aff || 70) + 2, 0, 100); Snd.sfx('chime'); UI.toast(b.name + ' улыбается во сне.'); } }, { t: 'Отойти на цыпочках', fx: () => { } }], esc: 1 }); }
