'use strict';
// ===== FOLK (v3.3): the people of villages and towns — who lives there and how they spend the day; the king's visit, openly or unrecognised =====
// Everyone is worked out again from the place and the world seed on each visit; only what the folk remember is kept in G.folk[sid].
const FOLK_NM = {
  K: ['Том,Уилл,Хоб,Джек,Питер,Робин,Нед,Дик,Уот,Тоби,Сэм,Бен,Гарри,Колин,Мартин,Уолтер', 'Мэг,Энн,Бесс,Джоан,Мод,Элис,Кейт,Молли,Эдит,Агнес,Роза,Нелл'],
  C: ['Бьярни,Свен,Торд,Ульв,Кетиль,Асгейр,Халли,Оддр,Гриме,Стейн,Ари,Эйвинд', 'Хельга,Ингрид,Гудрун,Сигню,Турид,Рагна,Фрейдис,Тора,Ольва,Сольвейг'],
  R: ['Беппе,Нино,Томмазо,Джино,Санте,Ренцо,Тито,Карло,Бруно,Альдо,Маттео,Гвидо', 'Нина,Пия,Кьяра,Бьянка,Тереза,Агата,Марта,Джованна,Сильвия,Роза'],
  T: ['Фома,Мирон,Савва,Ефим,Илья,Антип,Демьян,Кузьма,Пахом,Семён,Яков,Прохор', 'Марфа,Агафья,Устинья,Феня,Аксинья,Пелагея,Ульяна,Анисья,Дарья,Варвара'],
  E: ['Марк,Тит,Луций,Гай,Квинт,Секст,Деций,Павел,Никон,Фока,Стефан,Лев', 'Юлия,Клавдия,Ливия,Ирина,Анна,Феврония,Елена,Агния,Марина,Домна'],
  F: ['Микула,Ждан,Богдан,Любош,Вацлав,Милош,Радек,Ян,Томаш,Гостята,Бранислав,Вит', 'Любава,Злата,Милена,Дана,Яна,Вера,Божена,Ружена,Мила,Ганна'] };
for (const k in FOLK_NM) FOLK_NM[k] = FOLK_NM[k].map(s => s.split(','));
Object.assign(LOOK_EXT, {
  smith: (r) => ({ o: 'tunic', cl: r.pick(['brown', 'gray', 'dwood']), bg: 'gray', hat: 'none', apron: 1 }),
  miller: (r) => ({ o: 'tunic', cl: r.pick(['ivory', 'gray']), bg: 'brown', hat: 'cap', apron: 1 }),
  fisher: (r) => ({ o: 'tunic', cl: r.pick(['navy', 'teal', 'gray']), bg: 'teal', hat: r.pick(['hoodcl', 'cap', 'none']) }),
  shepherd: (r) => ({ o: 'cloak', cl: r.pick(['brown', 'gray']), bg: 'forest', hat: r.pick(['straw', 'hoodcl']) }),
  herbwife: (r) => ({ o: 'dress', cl: r.pick(['forest', 'brown', 'purple']), bg: 'forest', hat: 'kerchief' }),
  crier: (r) => ({ o: 'doublet', cl: r.pick(['red', 'blue', 'gold']), bg: 'wine', hat: 'cap' }),
  burgher: (r, fem) => ({ o: fem ? 'dress' : 'doublet', cl: r.pick(['wine', 'navy', 'teal', 'brown', 'green']), bg: 'brown', hat: fem ? r.pick(['kerchief', 'none']) : r.pick(['cap', 'none']) }),
  baker: (r, fem) => ({ o: 'tunic', cl: 'ivory', bg: 'brown', hat: fem ? 'kerchief' : 'chef', apron: 1 }),
});
const FOLK = { mus: '', chatT: 3, crierT: 6, greet: 0, mood: 0 };   // per-visit runtime state (not saved)
const folkV = () => (G && G.visit && (G.visit.kind === 'village' || G.visit.kind === 'town') ? G.visit : null);
const folkIncog = () => { const V = folkV(); return !!(V && V.how === 'incog'); };
function folkMem(sid) { G.folk = G.folk || {}; return G.folk[sid] || (G.folk[sid] = { v: 0, last: -1, mood: 0, done: {}, met: {} }); }
function folkFestOn() { const V = folkV(); if (!V) return false; const m = G.folk && G.folk[V.sid], h = hourAbs(); return !!m && m.fest === G.day && h >= 19 && h < 24.5; }
function folkTavBusy() { const h = hourAbs(); return !!folkV() && ((h >= 18 && h < 24.5) || (h >= 12 && h < 13.5)); }
// ---------- who lives here ----------
function folkPeople(sid) { const M = VMAP, town = M.town, r = vRng(sid, 9), NM = FOLK_NM[M.env.cul] || FOLK_NM.K, used = {}, P = [];
  const nm = fem => { const L0 = NM[fem ? 1 : 0]; for (let k = 0; k < 8; k++) { const v = r.pick(L0); if (!used[v]) { used[v] = 1; return v; } } return r.pick(L0); };
  const add = (role, fem, age, title, sub, o) => { if (P.length >= 40) return null; const name = nm(fem); const p = Object.assign({ k: P.length, role, fem: fem ? 1 : 0, age, name, title: title.replace('%', name), sub }, o || {}); P.push(p); return p; };
  const dw = M.houses.filter(h => h.kind === 'house' || h.kind === 'house2'), byKind = k => M.houses.find(h => h.kind === k);
  let hi = 0; const home = () => (dw.length ? dw[(hi++) % dw.length].i : M.tav.i);
  if (!town) { const hd = add('headman', 0, r.i(46, 64), 'Староста %', 'Староста деревни', { job: 'headman', boss: 1 }); add('villager', 1, hd.age - r.i(2, 6), '%', 'Жена старосты', { job: 'headwife' }); }
  else { add('steward', 0, r.i(45, 66), 'Бургомистр %', 'Глава города', { job: 'burg', boss: 1, home: home() }); for (let j = 0; j < 2; j++) add('scholar', 0, r.i(19, 52), 'Писарь %', 'Городской писарь', { job: 'clerk', j, home: home() }); }
  const kf = r.f() < 0.3; add('innkeeper', kf, r.i(32, 60), (kf ? (town ? 'Хозяйка %' : 'Корчмарка %') : (town ? 'Хозяин %' : 'Корчмарь %')), town ? 'Держит таверну' : 'Держит корчму', { job: 'keeper' });
  for (let j = 0; j < (town ? 2 : 1); j++) add('servant', 1, r.i(15, 24), 'Служанка %', 'Разносит эль', { job: 'maid', j });
  const ch = M.chap || M.church; if (ch) add('priest', 0, r.i(36, 72), 'Отец %', town ? 'Настоятель церкви' : 'Сельский священник', { job: 'priest', home: ch.i });
  if (M.smith) add('smith', 0, r.i(26, 52), 'Кузнец %', 'Кузнец', { job: 'smith', home: M.smith.i });
  if (!town) { if (M.mill) add('miller', 0, r.i(34, 62), 'Мельник %', 'Мельник', { job: 'miller', home: home() });
    if (M.pasture) { const a = r.i(11, 50); add('shepherd', 0, a, a < 16 ? 'Пастушок %' : 'Пастух %', 'Пасёт деревенское стадо', { job: 'shepherd', home: home() }); } }
  else { const bk = byKind('bake'); if (bk) { const f = r.f() < 0.4; add('baker', f, r.i(25, 55), f ? 'Булочница %' : 'Пекарь %', 'Печёт хлеб', { job: 'baker', home: bk.i }); }
    M.houses.filter(h => h.kind === 'shop').forEach((h, j) => add('merchant', 0, r.i(28, 60), 'Лавочник %', 'Держит лавку', { job: 'shop', home: h.i, j }));
    const st = M.stalls.map(s => s.i); for (let j = 0; j < 6 && st.length; j++) { const i = st.splice(r.i(0, st.length - 1), 1)[0], f = r.f() < 0.45; add(f ? 'burgher' : 'merchant', f, r.i(20, 62), f ? 'Торговка %' : 'Торговец %', 'Торгует на площади', { job: 'stall', st: i, home: home() }); }
    for (let j = 0; j < 2; j++) add('guard', 0, r.i(20, 46), 'Стражник %', 'Городская стража: ворота', { job: 'gate', j, home: home() });
    for (let j = 0; j < 2; j++) add('guard', 0, r.i(20, 46), 'Стражник %', 'Городская стража: ратуша', { job: 'hallg', j, home: home() });
    add('crier', 0, r.i(24, 50), 'Глашатай %', 'Выкрикивает новости', { job: 'crier', home: home() }); }
  if (M.pond || M.shore) for (let j = 0; j < (M.shore ? 2 : 1); j++) add('fisher', 0, r.i(18, 62), 'Рыбак %', 'Рыбак', { job: 'fisher', j, home: home() });
  if (!town) add('herbwife', 1, r.i(55, 80), 'Знахарка %', 'Травница: лечит и гадает', { job: 'herb', home: dw.length ? dw[dw.length - 1].i : home() });
  const nMen = town ? 2 : 4, nWom = town ? 3 : 4;
  for (let j = 0; j < nMen; j++) add(town ? 'burgher' : 'peasant', 0, r.i(18, 56), '%', town ? 'Горожанин' : 'Крестьянин', { job: town ? 'citizen' : 'farmer', j, home: home() });
  for (let j = 0; j < nWom; j++) add(town ? 'burgher' : 'villager', 1, r.i(17, 52), '%', town ? 'Горожанка' : 'Крестьянка', { job: town ? 'citizen' : 'wife', j: j + 2, home: home() });
  for (let j = 0; j < 3; j++) { const f = r.f() < 0.5; add('villager', f, r.i(5, 12), '%', f ? 'Девочка' : 'Мальчишка', { job: 'kid', j, home: home() }); }
  for (let j = 0; j < 2; j++) { const f = j === 1; add('elder', f, r.i(64, 82), f ? 'Бабка %' : 'Дед %', f ? 'Старуха' : 'Старик', { job: 'elder', j, home: home() }); }
  add('minstrel', 0, r.i(19, 42), 'Музыкант %', 'Бродячий музыкант', { job: 'bard' });
  const tf = r.f() < 0.35; add('traveler', tf, r.i(24, 62), tf ? 'Паломница %' : 'Путник %', tf ? 'Идёт к святым местам' : 'Остановился на ночлег', { job: 'guest' });
  if (town) add('merchant', 0, r.i(30, 60), 'Заезжий купец %', 'Купец с обозом', { job: 'guest', j: 1 });
  return P; }
// ---------- how they spend the day (hours run 5..29: 24.5 is half past midnight) ----------
const WS = (rc, loc) => 'wander:' + rc.slice(0, 4).join(',') + '@' + (loc || 'v_out');
function folkSched(p, M, seats) { const h = p.home !== undefined ? 'vh' + p.home : 'vt_back', fr = 'vf' + p.home, j = p.j || 0, town = M.town, g = M.g, W0 = g.w;
  const street = [5, g.st[0], W0 - 6, g.st[1]], green = M.green, F = M.fields, field = F.length ? F[j % F.length] : green;
  const gard = (M.gardens.find(q => q[4] === p.home) || M.gardens[j % Math.max(1, M.gardens.length)] || green), seat = () => seats.shift() || h;
  const tv = [town ? 7 : 6, 6, M.tavW - 4, 11], bench = k => M.benches.length ? M.benches[k % M.benches.length] : fr, well = k => 'v_well' + (k % 4);
  const sq = town ? [4, g.gr[0], W0 - 5, g.gr[1]] : green, shore = M.shore || (M.pond ? [M.pond[0], M.pond[1], M.pond[2], M.pond[3]] : green);
  const t = (x) => x + (p.k % 5) * 0.1; // a little spread, so the whole village does not move at once
  switch (p.job) {
    case 'headman': return [[5, 'vhd_bed'], [t(6.8), 'vhd_seat'], [9, WS(street)], [t(11), 'v_well3'], [12.5, 'vhd_seat'], [15, WS(field)], [18, 'vt_a0n'], [21, 'vhd_seat'], [22.5, 'vhd_bed']];
    case 'headwife': return [[5, 'vhd_bed2'], [6.5, 'vhd_cook'], [9, 'vhd_wife'], [11, 'v_well1'], [12, 'vhd_cook'], [14, 'vhd_wife'], [16.5, WS(gard)], [19, 'vhd_cook'], [22, 'vhd_bed2']];
    case 'burg': return [[5, h], [8, 'vtl_burg'], [12, 'vt_a0n'], [13.5, 'vtl_burg'], [17.5, WS(sq)], [19, h]];
    case 'clerk': return [[5, h], [t(7.8), 'vtl_clerk' + j], [12, fr], [13, 'vtl_clerk' + j], [17.5, h]];
    case 'keeper': return [[5, 'vt_back'], [7.5, 'vt_keep'], [24.5, 'vt_back']];
    case 'maid': return [[5, 'vt_back'], [t(8), WS(tv, 'v_tav')], [t(12), 'vt_stand1'], [13, WS(tv, 'v_tav')], [23.5, 'vt_back']];
    case 'priest': return [[5, h], [8, 'v_priest'], [11, WS(sq)], [12.5, h], [15, 'v_priest'], [17, WS(street)], [19, h]];
    case 'smith': return [[5, h], [7, 'v_smith'], [12.5, fr], [13.5, 'v_smith'], [19, seat()], [21.5, h]];
    case 'miller': return [[5, h], [6.8, 'v_miller'], [12, WS(field)], [13, 'v_miller'], [18.5, seat()], [21, h]];
    case 'shepherd': return [[5, h], [6, 'v_shep'], [9, WS(M.pasture)], [12, 'v_shep'], [13, WS(M.pasture)], [19, h]];
    case 'fisher': return [[5, h], [5.5, 'v_fish' + j], [11, WS(shore)], [12.5, 'v_fish' + ((j + 1) % 2)], [17.5, seat()], [21, h]];
    case 'herb': return [[5, h], [8, WS(gard)], [12, fr], [15, WS(green)], [18, h]];
    case 'farmer': return [[5, h], [t(6.4), WS(field)], [12, fr], [t(13), WS(field)], [18.5, j % 2 ? h : seat()], [21.5, h]];
    case 'wife': return [[5, h], [t(6.5), well(j)], [7.5, WS(gard)], [11.5, fr], [12.5, h], [14, WS(j % 2 ? green : gard)], [t(17), well(j + 1)], [18, h]];
    case 'kid': return [[5, h], [t(8), WS(green)], [12, fr], [13, WS(green)], [t(16.5), WS(street)], [19.5, h]];
    case 'elder': return [[5, h], [t(9), bench(j)], [12, h], [14, bench(j + 1)], [17.5, j === 0 ? seat() : h], [20, h]];
    case 'baker': return [[4.5, h], [6, fr], [11, WS(sq)], [12, fr], [16, h]];
    case 'shop': return [[5, h], [8, fr], [12, h], [13, fr], [19, seat()], [21, h]];
    case 'stall': return [[5, h], [t(7.4), 'v_st' + p.st], [t(18.4), h]];
    case 'hallg': return [[5, h], [7.8, 'vtl_grd' + j], [18, WS(sq)], [21, h]];
    case 'crier': return [[5, h], [9, 'v_crier'], [10.5, WS(sq)], [12, 'v_crier'], [13, WS(street)], [16, 'v_crier'], [17.5, h]];
    case 'citizen': return [[5, h], [t(8), WS(sq)], [11, well(j)], [12, h], [14, WS(street)], [16, WS(sq)], [19, j % 2 ? h : seat()], [21, h]];
    case 'bard': return folkBardDay() ? [[5, 'vt_back'], [t(17.5), WS(street)], [18.5, 'vt_bard'], [23.5, 'vt_back']] : [[5, 'vt_back']];
    case 'guest': { const s0 = seat(); return [[5, 'vt_back'], [8, s0], [t(10.5), WS(j ? sq : street)], [13, s0], [15, WS(green)], [18, s0], [23, 'vt_back']]; }
  }
  return [[5, h]]; }
function folkBardDay() { const V = folkV(); return !!V && vRng(V.sid, 100 + G.day).f() < 0.6; }
// ---------- filling the place ----------
function folkPopulate(sid) { const M = VMAP, S = G.setts[sid], V = G.visit, P = folkPeople(sid), r = vRng(sid, 11), mem = folkMem(sid);
  const seats = M.seats.filter(s => s !== 'vt_a0n'); for (let i = seats.length - 1; i > 0; i--) { const j = r.i(0, i); [seats[i], seats[j]] = [seats[j], seats[i]]; }
  for (const p of P) { const c = pseudoChar(1000 + (sid % 150) * 40 + p.k, p.role, p.fem, p.age, p.title); c.cul = M.env.cul; c.realm = S.ctrl < 5 ? S.ctrl : 5; c.folk = p;
    const o = { talk: folkTalk, sub: p.sub, spd: p.age < 14 ? 50 : p.age > 62 ? 34 : 44, home: p.home !== undefined ? 'vh' + p.home : 'vt_back' };
    if (p.job === 'gate') o.post = 'v_gate' + p.j; else o.sched = folkSched(p, M, seats);
    if (p.job === 'keeper') o.talkR = 56; const n = mkNpc('f' + p.k, c, o); n.folk = p; }
  // the king's escort waits at the end of the street with the horses
  const royal = V.how !== 'incog', A = (kind, loc, rc, col, n) => { for (let k = 0; k < (n || 1); k++) COURT.ani.push({ kind, loc, r: rc, x: (rc[0] + R.f() * (rc[2] - rc[0] + 1)) * CT, y: (rc[1] + R.f() * (rc[3] - rc[1] + 1)) * CT, tx: 0, ty: 0, t: R.f() * 3, flip: R.f() < 0.5, col, f: 0 }); };
  if (royal) for (let k = 0; k < 2; k++) { const c = pseudoChar(40 + k, 'guard', 0, 24 + k * 5, 'Королевский стражник'); const n = mkNpc('ret' + k, c, { post: 'v_grd' + k, sub: 'Ваша стража', talk: folkRetinue }); n.ret = 1; }
  A('horse', 'v_out', M.horses, 'white'); if (royal) { A('horse', 'v_out', M.horses, 'brown'); A('horse', 'v_out', M.horses, 'dwood'); }
  // livestock and small beasts
  if (M.pasture) { A('sheep', 'v_out', M.pasture, null, 5); A('goat', 'v_out', M.pasture, null, 1); A('cow', 'v_out', M.pasture, null, 2); }
  const by = M.barn || M.houses.find(h => h.row === 'B'); if (by) { A('pig', 'v_out', [by.tx, by.y + 2, by.tx + by.w, by.y + 3], null, 2); A('hen', 'v_out', [by.tx - 2, by.y + 2, by.tx + by.w + 1, by.y + 3], null, 4); }
  if (M.yard) { A('horse', 'v_out', M.yard, 'brown'); A('hen', 'v_out', M.yard, null, 3); }
  if (M.pond) A('duck', 'v_out', [M.pond[0] + 1, M.pond[3] - 1, M.pond[2] - 1, M.pond[3]], null, 3);
  A('pigeon', 'v_out', M.green, null, M.town ? 6 : 3); A('dog', 'v_out', [4, M.g.st[0], M.g.w - 5, M.g.st[1]], null, M.town ? 1 : 2);
  A('cat', 'v_tav', [M.town ? 7 : 6, 7, M.tavW - 4, 11], null); if (M.town) A('cat', 'v_out', M.green, null);
  if (V.how === 'incog') folkDisguise(true); else folkDisguise(false);
  FOLK.chatT = 3; FOLK.crierT = 6; FOLK.mus = ''; FOLK.greet = 0; FOLK.notes = []; }
function folkDisguise(on) { const k = kingC(); if (!COURT.p) return; if (!on) { COURT.p.c = k; return; } const d = Object.create(k); d.role = 'traveler'; d._look = null; d._lookK = null; d.look = null; COURT.p.c = d; }
const folkBoss = () => COURT.npcs.find(n => n.folk && n.folk.boss);
// ---------- arriving and leaving ----------
function folkEnter(sid) { const V = G.visit, mem = folkMem(sid), s = WD.setts[sid], S = G.setts[sid], pa = playerArmy(), town = s.type !== 'village';
  if (pa) { pa.path = null; pa.onArrive = null; } G.player.follow = -1; const first = mem.v === 0; mem.v++; const longAgo = mem.last < 0 || G.day - mem.last > 30; mem.last = G.day;
  if (V.how === 'incog') { UI.toast('Вы въезжаете ' + (town ? 'в город' : 'в деревню') + ' неузнанным — в простом дорожном плаще.'); return; }
  const own = S.ctrl === G.player.realm, h = hourAbs(), night = h >= 22 || h < 6;
  if (own && longAgo) { mem.mood = clamp((mem.mood || 0) + 6, -50, 50); provUnrest(sid, -2); prestige(1); log('Король посетил ' + (town ? 'город ' : 'деревню ') + s.name + '. Народ будет помнить это годами.', 'good'); }
  UI.toast(night ? (town ? 'Ночь, город спит. Но бургомистра уже разбудили — он спешит навстречу.' : 'Ночь, деревня спит. Но староста уже спешит навстречу с фонарём.') : (town ? 'Горожане' : 'Селяне') + ' высыпали на улицу поглядеть на короля!');
  // the crowd gathers at the end of the street; the headman (burgomaster) hurries to meet the king
  const g = VMAP.g, rc = [4, g.st[0], 14, g.st[1]], until = h + 0.8, boss = folkBoss();
  if (!night) for (const n of COURT.npcs) { if (!n.folk || n.post || n.folk.job === 'keeper' || n.folk.job === 'bard' || n.folk.job === 'guest' || R.f() < 0.45) continue; n.override = { spot: WS(rc), until, day: G.day }; n.curT = null; }
  if (boss) { boss.override = { spot: 'v_meet', until: h + 1.5, day: G.day }; boss.curT = null; boss.greet = 1; }
  FOLK.greet = 1; if (first && typeof TUT !== 'undefined' && TUT.ev) TUT.ev('village'); }
function folkLeave(sid) { folkDisguise(false); FOLK.mus = ''; }
function folkTitle(sid) { const s = WD.setts[sid]; return (s.type === 'village' ? 'Деревня ' : 'Город ') + s.name + (folkIncog() ? ' · неузнанным' : ''); }
// ---------- life goes on ----------
const FOLK_CHAT = { day: ['Дождя бы…', 'Почём нынче соль?', 'Корова отелилась!', 'Опять сосед межу перепахал.', 'К ярмарке бы поспеть.', 'Ох, спина…', 'Хлеб нынче кусается.', 'Слыхала? У мельника опять гости.', 'Гуси со двора ушли — ищи теперь.', 'Сено бы убрать до дождей.'],
  eve: ['Пойдём, пропустим по кружке?', 'Ну и денёк…', 'Завтра рано вставать.', 'Слышь, музыкант приехал!'],
  kid: ['Догони!', 'Чур, я рыцарь!', 'Мам, я скоро!', 'А у меня жук!', 'Ты водишь!'],
  royal: ['Король! Сам король!', 'Храни вас Бог, государь!', 'Слава королю!', 'Ох, батюшки, король…', 'Ваше величество!', 'Глянь, какой плащ!'],
  royalKid: ['А корона где?', 'Дяденька король, а меч покажете?', 'Король! Король!'] };
function folkUpdate(dt) { const V = G.visit, M = VMAP; if (!M || !COURT.p) return; const P = COURT.p, h = hourAbs(), royal = V.how !== 'incog';
  // the headman meets the king on arrival
  const boss = folkBoss(); if (boss && boss.greet && boss.loc === COURT.loc && !boss.path && Math.hypot(boss.x - P.x, boss.y - P.y) < 70 && !DLG.open()) { boss.greet = 0; say(boss, M.town ? 'Добро пожаловать в наш город, государь!' : 'Ваше величество! Какая честь!', 4); }
  // chatter and greetings near the king
  FOLK.chatT -= dt; if (FOLK.chatT <= 0) { FOLK.chatT = 2.5 + R.f() * 3.5;
    const near = COURT.npcs.filter(n => n.folk && n.loc === COURT.loc && !n.away && !n.bub && Math.hypot(n.x - P.x, n.y - P.y) < 110 && !n.lie);
    if (near.length) { const n = R.pick(near), kid = n.c.age < 14, d = Math.hypot(n.x - P.x, n.y - P.y);
      const L0 = royal && d < 70 && R.f() < 0.7 ? (kid ? FOLK_CHAT.royalKid : FOLK_CHAT.royal) : kid ? FOLK_CHAT.kid : h >= 17.5 ? FOLK_CHAT.eve : FOLK_CHAT.day; say(n, R.pick(L0), 3); } }
  // the town crier cries the news
  FOLK.crierT -= dt; if (FOLK.crierT <= 0) { FOLK.crierT = 9 + R.f() * 6; const cr = COURT.npcs.find(n => n.folk && n.folk.job === 'crier' && !n.path && !n.away && n.loc === COURT.loc);
    if (cr && Math.hypot(cr.x - P.x, cr.y - P.y) < 200) say(cr, 'Слушайте! Слушайте! ' + folkNews(), 6); }
  // music: the bard in the tavern, the festival on the green
  const bard = COURT.npcs.find(n => n.folk && n.folk.job === 'bard' && !n.away && !n.path && n.loc === 'v_tav'), fest = folkFestOn();
  const nearFire = fest && COURT.loc === 'v_out' && Math.hypot(M.fest.x * CT - P.x, M.fest.y * CT - P.y) < 220;
  const want = (COURT.loc === 'v_tav' && bard) || nearFire ? 'feast' : 'auto'; if (want !== FOLK.mus) { FOLK.mus = want; if (typeof Snd !== 'undefined') Snd.music(want); }
  // notes over the musician while he plays; the crowd that ran out to see the king turns to him
  const pl = COURT.npcs.find(n => n.folk && n.folk.job === 'bard' && !n.away && !n.path && n.loc === COURT.loc && (n.loc === 'v_tav' || fest));
  const NT = FOLK.notes || (FOLK.notes = []); if (pl && NT.length < 10 && R.chance(dt * 2.4)) NT.push({ loc: pl.loc, x: pl.x + R.range(-5, 6), y: pl.y - 24, t: 0, c: R.pick(['#f7d35c', '#f8f0d8', '#e88a6a']) });
  for (let i = NT.length - 1; i >= 0; i--) { NT[i].t += dt; if (NT[i].t > 1.6 || NT[i].loc !== COURT.loc) NT.splice(i, 1); }
  FOLK.faceT = (FOLK.faceT || 0) - dt; if (royal && FOLK.faceT <= 0) { FOLK.faceT = 0.4;
    for (const n of COURT.npcs) { if (!n.folk || !n.override || n.override.day !== G.day || n.override.until <= h || n.path || n.sit || n.loc !== COURT.loc || n.override.spot === 'v_festb') continue; if (fest && n.override.until >= 24) continue;
      const dx = P.x - n.x, dy = P.y - n.y; if (Math.hypot(dx, dy) < 140) n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); } }
  if (fest) folkFestTick(dt); }
CRENDER2.push((g, L) => { if (!L || L.site !== 'v' || !FOLK.notes || !FOLK.notes.length) return; for (const p of FOLK.notes) { if (p.loc !== L.id) continue; const x = Math.round(p.x + Math.sin(p.t * 5 + p.x) * 3), y = Math.round(p.y - p.t * 16);
  g.globalAlpha = clamp(1.6 - p.t, 0, 1); g.fillStyle = p.c; g.fillRect(x + 2, y - 5, 1, 5); g.fillRect(x, y - 1, 3, 2); g.fillRect(x + 3, y - 5, 2, 1); g.fillRect(x + 4, y - 4, 1, 1); } g.globalAlpha = 1; });
