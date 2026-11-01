'use strict';
// ===== COUNCIL: seats & appointments, orders (Приказ / Замысел), reports through servants' eyes, treasury theft & audits =====
const SEATS = [
  { k: 'chancellor', n: 'Канцлер', sk: 'dip', ic: 'i_dip', d: 'Дипломатия: отношения с державами и знатными домами, посольства, браки.' },
  { k: 'treasurer', n: 'Казначей', sk: 'stew', ic: 'i_gold', d: 'Казна и подати: сборы, закупки, перепись. Он ведёт книги — и только он знает, сколько в них правды.' },
  { k: 'marshal', n: 'Маршал', sk: 'mar', ic: 'i_sword', d: 'Войско: набор, учения, крепости, созыв знамён.' },
  { k: 'eye', n: 'Око короля', sk: 'intr', ic: 'i_eye', d: 'Тайная служба: осведомители, донесения о врагах, охрана двора, досье на придворных.' },
  { k: 'seneschal', n: 'Сенешаль', sk: 'stew', ic: 'i_food', d: 'Двор и припасы: амбары, пиры, стража замка.' },
  { k: 'magister', n: 'Магистр', sk: 'lrn', ic: 'i_book', d: 'Знания: исследования, лекари, летопись, учитель наследника.' },
  { k: 'justice', n: 'Верховный судья', sk: 'lrn', ic: 'i_scroll', d: 'Закон: суды, разбойники, проверки казны, амнистии.' },
];
const SKN = { mar: 'Меч', dip: 'Речь', intr: 'Тень', stew: 'Счёт', lrn: 'Книга' }, SKD = { mar: 'военное дело', dip: 'дипломатия и обаяние', intr: 'интриги и тайны', stew: 'хозяйство и счёт', lrn: 'учёность и закон' };
const seatName = k => (SEATS.find(s => s.k === k) || { n: k }).n;
const seatDef = k => SEATS.find(s => s.k === k);
function seatChar(k) { const id = G.court && G.court.seats[k]; const c = id >= 0 ? charOf(id) : null; return c && c.alive && c.prison < 0 ? c : null; }
function seatOf(c) { if (!G.court) return null; for (const s of SEATS) if (G.court.seats[s.k] === c.id) return s.k; return null; }
const skillOf = (c, sk) => c ? (c[sk] || 0) : 0;
function bookGold() { return G.realms[0].gold + (G.court ? G.court.hidden || 0 : 0); }
function spend(amt, who) { const r = G.realms[0]; if (r.gold >= amt) { r.gold -= amt; return true; }
  if (bookGold() >= amt) { G.court.susp = (G.court.susp || 0) + 1; const t = seatChar('treasurer'); UI.toast((t ? t.name : 'Казначей') + ': «Деньги… в обороте, государь. Дайте неделю»'); return false; }
  UI.toast('Не хватает золота.'); return false; }
function prestige(v) { G.court.prestige = clamp((G.court.prestige || 0) + v, -100, 100); }
function opinionWord(v) { return v >= 50 ? 'дружба' : v >= 20 ? 'тёплые' : v > -10 ? 'ровные' : v > -40 ? 'холодные' : 'вражда'; }
function loyWord(v) { return v >= 75 ? 'предан' : v >= 55 ? 'верен' : v >= 35 ? 'колеблется' : v >= 18 ? 'недоволен' : 'враждебен'; }
// how well the king knows a hidden stat of someone: exact if dossier, else rough
function knownStat(c, k) { const K = G.court.known[c.id]; if (K && K[k] !== undefined) return K[k]; return null; }
// ---------- efficiency: Приказ vs Замысел (Сунь-цзы, гл. 3: «Побеждает тот, у кого полководец способен, а государь не вмешивается») ----------
function orderEff(c, seatK, mode) { if (!c) return 0.45; const sk = skillOf(c, seatDef(seatK).sk), tr = t => c.traits.includes(t);
  let e = mode === 'intent' ? 0.45 + sk / 16 : 0.75 + sk / 60;
  if (mode === 'intent' && tr('wise')) e += 0.1; if (mode === 'order' && tr('patient')) e += 0.04; if (mode === 'order' && tr('proud')) e -= 0.06; if (tr('cunning') && seatK === 'eye') e += 0.08;
  const loy = c.loy === undefined ? 60 : c.loy; if (loy < 30) e *= 0.75; else if (loy > 80) e *= 1.05;
  return clamp(e, 0.3, 1.9); }
function effWord(e) { return e >= 1.35 ? 'блестяще' : e >= 1.1 ? 'хорошо' : e >= 0.9 ? 'сносно' : e >= 0.7 ? 'слабо' : 'плохо'; }
// ---------- orders ----------
// each: k, n, d, cost, dur, tgt ('realm'|'house'|'sett'|'tech'|'child'|'char'|null), go(o,c) once on start (may refuse), day(o,c,eff), done(o,c,eff) -> report text
const ORD = {
  chancellor: [
    { k: 'improve_rel', n: 'Улучшить отношения', d: 'Подарки, письма, учтивость послов. Мнение державы о нас растёт всё время поручения.', cost: 20, dur: 14, tgt: 'realm',
      day: (o, c, e) => addOpn(o.t, 0, 0.55 * e), done: (o, c, e) => 'Отношения с державой ' + realmName(o.t) + ' стали теплее (' + effWord(e) + ').' },
    { k: 'calm_house', n: 'Умиротворить дом', d: 'Канцлер едет к знатному дому с почестями и обещаниями. Верность дома растёт.', cost: 15, dur: 8, tgt: 'house',
      done: (o, c, e) => { const H0 = G.houses[o.t]; houseLoy(H0, Math.round(10 * e)); return 'Дом ' + H0.name + ' успокоен (' + effWord(e) + '). Верность дома выросла.'; } },
    { k: 'embassy', n: 'Посольство: мир или договор', d: 'Посольство едет ко двору державы и добивается мира (если война) или пакта о ненападении. Успех зависит от Речи канцлера.', cost: 30, dur: 10, tgt: 'realm',
      done: (o, c, e) => { const t = o.t, war = G.rel[0][t].war; const a = acceptance(war ? 'peace' : 'pact', t, {}); const bonus = (e - 1) * 30; if (a.lines[0] && a.lines[0].v === -999) return 'Двор державы ' + realmName(t) + ' не принял посольство: «недавно уже отвечали».';
        if (a.sum + bonus > 0) { G.realms[t].asked = 0; if (war) makePeace(warScore(0, t) >= 0 ? 0 : t, warScore(0, t) >= 0 ? t : 0, false); else setRel(0, t, 'pact', G.day + DAYS_YEAR * 2); return 'Посольство удалось! ' + (war ? 'Заключён мир с державой ' + realmName(t) + '.' : 'Пакт о ненападении с державой ' + realmName(t) + ' на 2 года.'); }
        addOpn(t, 0, 2); G.realms[t].asked = G.day + 6; return 'Посольство вернулось ни с чем: ' + realmName(t) + ' не согласна (не хватило ' + Math.round(-(a.sum + bonus)) + ' доводов). Но отношения чуть потеплели.'; } },
    { k: 'goodwill', n: 'Добрососедство', d: 'Учтивые письма и скромные дары всем соседям, с кем нет войны: мнение каждого понемногу растёт.', cost: 25, dur: 14,
      day: (o, c, e) => { for (let t = 1; t < 5; t++) if (alive(t) && !G.rel[0][t].war) addOpn(t, 0, 0.2 * e); }, done: (o, c, e) => 'Соседи благодарят за учтивые письма (' + effWord(e) + ').' },
    { k: 'reconcile', n: 'Примирить знать', d: 'Канцлер собирает глав знатных домов за одним столом и гасит старые обиды: верность всех домов немного растёт.', cost: 30, dur: 10,
      done: (o, c, e) => { let n = 0; for (const H0 of G.houses) if (H0.alive) { houseLoy(H0, Math.round(3 * e)); n++; } return 'Главы ' + n + ' ' + plural(n, 'дома', 'домов', 'домов') + ' помирились за чашей вина (' + effWord(e) + ').'; } },
  ],
  treasurer: [
    { k: 'tax_extra', n: 'Чрезвычайный сбор', d: 'Разовый налог: золото сразу, но смута в провинциях растёт, а знать ропщет.', cost: 0, dur: 4,
      done: (o, c, e) => { const g = Math.round(90 * e + G.setts.filter(S => S.owner === 0).length * 6); const honest = (c.hon || 60) >= 45 && !c.traits.includes('greedy'); const real = honest ? g : Math.round(g * 0.7); G.realms[0].gold += real; if (!honest) { G.court.hidden += g - real; addSecret('theft', [c.id]); } for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = Math.min(100, P.unrest + 9); for (const H0 of G.houses) houseLoy(H0, -3); return 'Чрезвычайный сбор принёс ' + zol(g) + ' (по книгам). Народ ропщет.'; } },
    { k: 'lower_tax', n: 'Облегчить подати', d: 'На сезон доход меньше на четверть, зато смута спадает, а дома довольны.', cost: 0, dur: 21,
      go: o => { G.court.taxK = 0.75; }, day: (o) => { for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = Math.max(0, P.unrest - 0.4); }, done: (o, c, e) => { G.court.taxK = 1; for (const H0 of G.houses) houseLoy(H0, 4); prestige(3); return 'Сезон лёгких податей окончен. Народ благословляет короля.'; } },
    { k: 'buy_grain', n: 'Закупить зерно', d: 'Казначей покупает зерно у купцов для амбаров столицы (≈400 мер за 60 зол.).', cost: 60, dur: 5,
      done: (o, c, e) => { const honest = (c.hon || 60) >= 45 && !c.traits.includes('greedy'); const q = Math.round(400 * clamp(e, 0.6, 1.4) * (honest ? 1 : 0.72)); G.court.grain += q; if (!honest) { G.court.hidden += 12; G.realms[0].gold -= 0; addSecret('theft', [c.id]); } return 'В амбары завезено ' + q + ' мер зерна.' + (honest ? '' : ' Цена, правда, вышла высоковата.'); } },
    { k: 'census', n: 'Перепись и сверка', d: 'Перепись дворов: доход казны навсегда растёт на несколько процентов. Честный казначей заодно сверит книги.', cost: 15, dur: 12,
      done: (o, c, e) => { G.court.incK = Math.min(1.35, (G.court.incK || 1) + 0.04 * e); return 'Перепись окончена: доход казны вырос на ' + Math.round(4 * e) + '%.'; } },
    { k: 'charters', n: 'Торговые грамоты', d: 'Льготы купцам наших городов: достаток городов растёт, а с ним и подати.', cost: 25, dur: 14,
      done: (o, c, e) => { let n = 0; for (const S of G.setts) if (S.owner === 0 && WD.setts[S.id].type !== 'village') { S.prosp = Math.min(100, S.prosp + Math.round(5 * e)); n++; } return n ? 'Купцы ' + n + ' ' + plural(n, 'города', 'городов', 'городов') + ' получили грамоты: торговля оживилась (' + effWord(e) + ').' : 'Городов у нас нет — грамоты некому выдать.'; } },
    { k: 'sell_grain', n: 'Продать излишки зерна', d: 'Казначей продаёт купцам треть зерна из амбаров столицы: золото сразу, но запас на случай голода и осады тает.', cost: 0, dur: 3,
      done: (o, c, e) => { const C = G.court, q = Math.floor((C.grain || 0) / 3); if (q < 50) return 'Продавать нечего: амбары почти пусты.'; const honest = (c.hon || 60) >= 45 && !c.traits.includes('greedy'); const g = Math.round(q * 0.12 * clamp(e, 0.6, 1.4)), real = honest ? g : Math.round(g * 0.75); C.grain -= q; G.realms[0].gold += real; if (!honest) { C.hidden += g - real; addSecret('theft', [c.id]); } return 'Продано ' + q + ' мер зерна за ' + real + ' зол.'; } },
  ],
  marshal: [
    { k: 'recruit', n: 'Набрать рекрутов', d: 'Набор в войско у столицы: копейщики и лучники присоединятся к войску в столице.', cost: 70, dur: 7,
      done: (o, c, e) => { const a = capitalArmy(); const n = Math.round(60 * e); const u = { levy: Math.round(n * 0.3), spear: Math.round(n * 0.35), archer: Math.round(n * 0.25), sword: Math.round(n * 0.1) }; if (a) addU(a.u, u); else { const S = G.setts[G.realms[0].capital]; addU(S.gar, u); } return 'Набрано ' + n + ' рекрутов' + (a ? ' — они влились в войско сэра ' + charOf(a.gen).name : ' — они в гарнизоне столицы') + '.'; } },
    { k: 'train', n: 'Учения', d: 'Учения войск у столицы: опыт растёт, но воины устают.', cost: 20, dur: 10,
      day: (o, c, e) => { for (const a of G.armies) if (a.alive && a.realm === 0 && a.kind === 'lord' && settNear(a.x, a.y, 2) === G.realms[0].capital) for (const t of UT) a.xp[t] = Math.min(100, a.xp[t] + 0.5 * e * (hasTech('drill') ? 2 : 1)); }, done: (o, c, e) => 'Учения окончены (' + effWord(e) + '). Войска у столицы стали опытнее.' },
    { k: 'fortify', n: 'Укрепить крепость', d: 'Камень и рабочие: стены выбранного города или замка станут на ступень крепче.', cost: 90, dur: 18, tgt: 'sett',
      done: (o, c, e) => { const S = G.setts[o.t]; if (S.owner !== 0) return 'Крепость больше не наша — работы брошены.'; S.walls = Math.min(4, S.walls + 1); return 'Стены ' + WD.setts[o.t].name + ' укреплены (ступень ' + S.walls + ').'; } },
    { k: 'muster', n: 'Созвать знамёна', d: 'Гонцы скачут ко всем знатным домам: каждый пришлёт отряд — чем вернее дом, тем больше. Отряды придут через несколько дней.', cost: 0, dur: 3,
      done: (o, c, e) => musterBanners(e) },
    { k: 'supply', n: 'Снарядить обоз', d: 'Войска у столицы получают из амбаров еду на две недели, а также фураж, стрелы и полные бочки воды.', cost: 25, dur: 3,
      done: (o, c, e) => { const cap = G.realms[0].capital, C = G.court, A = G.armies.filter(a => a.alive && a.realm === 0 && (a.kind === 'lord' || a.kind === 'player') && settNear(a.x, a.y, 2) === cap); if (!A.length) return 'У столицы нет войск — обоз некому отдать.'; let f = 0;
        for (const a of A) { const q = Math.max(0, Math.floor(Math.min(armyMen(a) * 14 - a.food, C.grain || 0, armyCap(a) - armyLoad(a)))); a.food += q; C.grain -= q; f += q; a.fodder += Math.round(mountedN(a.u) * 6 * e); a.arrows += Math.round(rangedN(a.u) * 15 * e); a.water = waterCap(a); }
        return 'Обоз снаряжён: ' + f + ' мер еды из амбаров, фураж, стрелы и вода для ' + A.length + ' ' + plural(A.length, 'войска', 'войск', 'войск') + '.'; } },
    { k: 'patrol', n: 'Облава на разбойников', d: 'Конные разъезды прочёсывают наши земли: шайки разбойников редеют, на дорогах спокойнее.', cost: 30, dur: 8,
      done: (o, c, e) => { let k = 0, m = 0; for (const a of G.armies) if (a.alive && a.kind === 'bandit') { const S = settNear(a.x, a.y, 8); if (S >= 0 && G.setts[S].owner === 0) { m += takeMen(a, Math.ceil(armyMen(a) * clamp(0.4 * e, 0.15, 0.8))); k++; provUnrest(S, -3); } } return k ? 'Облава прошла по ' + k + ' ' + plural(k, 'шайке', 'шайкам', 'шайкам') + ': перебито и рассеяно ' + m + ' разбойников.' : 'Разъезды не нашли разбойников в наших землях.'; } },
  ],
  eye: [
    { k: 'network', n: 'Сплести сеть осведомителей', d: 'Подкуп слуг, трактирщиков и писарей в державе. Донесения о её войсках станут точнее, а Око будет видеть её армии на карте.', cost: 35, dur: 14, tgt: 'realm',
      done: (o, c, e) => { const C = G.court; C.net[o.t] = clamp((C.net[o.t] || 0) + (e > 1.2 ? 2 : 1), 0, 3); return 'Сеть в державе ' + realmName(o.t) + ' окрепла: уровень ' + C.net[o.t] + ' из 3.'; } },
    { k: 'dossier', n: 'Собрать досье', d: 'Тайно выяснить, насколько придворный верен, честолюбив и честен. Точность зависит от Тени.', cost: 10, dur: 6, tgt: 'char',
      done: (o, c, e) => { const t = charOf(o.t); const err = Math.round(clamp(22 - c.intr * 1.2 / Math.max(0.6, e), 3, 25)); const nz = () => R.i(-err, err); const K = G.court.known[t.id] = { loy: clamp((t.loy || 50) + nz(), 0, 100), amb: clamp((t.amb || 50) + nz(), 0, 100), hon: clamp((t.hon || 50) + nz(), 0, 100), err, day: G.day };
        for (const s of G.court.secrets) if (!s.known && s.who.includes(t.id) && R.chance(clamp(0.25 * e + c.intr / 40, 0, 0.9))) { s.known = 1; s.how = 'досье'; } return 'Досье на ' + t.name + ' готово (точность ±' + err + '): верность ≈' + K.loy + ', честолюбие ≈' + K.amb + ', честность ≈' + K.hon + '.' + (G.court.secrets.some(s => s.known && s.how === 'досье' && s.who.includes(t.id)) ? ' Найдено кое-что интересное!' : ''); } },
    { k: 'protect', n: 'Охранять двор', d: 'Слежка за чужаками и слугами: ночные заговоры раскрываются чаще, вражьи шпионы ловятся.', cost: 15, dur: 21,
      day: (o, c, e) => { for (const s of G.court.secrets) if (!s.known && s.k !== 'love' && R.chance(0.012 * e + c.intr / 1500)) { s.known = 1; s.how = 'слежка Ока'; letterFromSeat('eye', 'Тайное донесение', secretText(s)); } }, done: (o, c, e) => 'Охрана двора снята. За время слежки ничего не упущено.' },
    { k: 'rumor', n: 'Распустить слухи', d: 'Слухи о слабости и пороках правителя державы: его мнение среди соседей падает, а его знать ропщет.', cost: 25, dur: 10, tgt: 'realm',
      done: (o, c, e) => { for (let t = 1; t < 5; t++) if (t !== o.t) addOpn(t, o.t, -6 * e); if (R.chance(0.25 - c.intr / 100)) { addOpn(o.t, 0, -15); return 'Слухи разошлись, но наших людей заметили — ' + realmName(o.t) + ' знает, чья это работа.'; } return 'Слухи о правителе державы ' + realmName(o.t) + ' гуляют по всем дворам (' + effWord(e) + ').'; } },
    { k: 'sabotage', n: 'Поджечь обозы врага', d: 'Лазутчики жгут припасы войск державы, с которой мы воюем: её армии голодают и падают духом. Могут попасться.', cost: 30, dur: 6, tgt: 'realm',
      done: (o, c, e) => { const t = o.t; if (!G.rel[0][t].war) return 'Мы не воюем с державой ' + realmName(t) + ' — лазутчики вернулись ни с чем.'; let n = 0; for (const a of G.armies) if (a.alive && a.realm === t && a.kind === 'lord') { a.food = Math.floor(a.food * (1 - clamp(0.4 * e, 0.2, 0.7))); a.morale = Math.max(0, a.morale - 8 * e); n++; }
        if (R.chance(clamp(0.3 - c.intr / 80, 0.05, 0.3))) { addOpn(t, 0, -10); return 'Обозы ' + n + ' ' + plural(n, 'войска', 'войск', 'войск') + ' державы ' + realmName(t) + ' горят, но одного лазутчика схватили.'; } return 'Обозы ' + n + ' ' + plural(n, 'войска', 'войск', 'войск') + ' державы ' + realmName(t) + ' сожжены (' + effWord(e) + ').'; } },
    { k: 'incite', n: 'Поднять смуту у врага', d: 'Подстрекатели в провинциях державы: смута растёт, ей труднее собирать подати и войска.', cost: 30, dur: 12, tgt: 'realm',
      day: (o, c, e) => { for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === o.t) P.unrest = Math.min(100, P.unrest + 0.5 * e); }, done: (o, c, e) => { if (R.chance(clamp(0.25 - c.intr / 100, 0.05, 0.25))) { addOpn(o.t, 0, -12); return 'Смута в державе ' + realmName(o.t) + ' разгорелась, но там знают, чьих рук дело.'; } return 'Смута в державе ' + realmName(o.t) + ' разгорелась (' + effWord(e) + ').'; } },
  ],
  seneschal: [
    { k: 'feast', n: 'Устроить пир', d: 'Пир в тронном зале: знать довольна, слава короля растёт. Дорого.', cost: 60, dur: 2,
      done: (o, c, e) => { for (const H0 of G.houses) houseLoy(H0, Math.round(5 * e)); prestige(4); G.court.feastDay = G.day; return 'Пир удался на славу (' + effWord(e) + ')! Знать пьёт за здоровье короля.'; } },
    { k: 'stock', n: 'Пополнять амбары', d: 'Сенешаль скупает зерно понемногу всё поручение: амбары растут, казна тает медленно.', cost: 0, dur: 21,
      day: (o, c, e) => { if (G.realms[0].gold > 30) { G.realms[0].gold -= 2; G.court.grain += Math.round(18 * e); } }, done: () => 'Амбары пополнены.' },
    { k: 'guard', n: 'Усилить стражу', d: 'Больше караулов в замке и у ворот: заговорщикам труднее, шпионам тоже.', cost: 20, dur: 21, go: () => { G.court.guard = 1; }, done: () => { G.court.guard = 0; return 'Усиленные караулы сняты.'; } },
    { k: 'tourney', n: 'Турнир', d: 'Рыцарский турнир у стен замка: знать довольна, слава растёт, конные воины в столице набираются удали.', cost: 45, dur: 3,
      done: (o, c, e) => { for (const H0 of G.houses) if (H0.alive) houseLoy(H0, Math.round(3 * e)); prestige(Math.round(3 * e)); const a = capitalArmy(); if (a) { for (const t of ['horse', 'harch', 'knight']) a.xp[t] = Math.min(100, a.xp[t] + 6 * e); a.morale = Math.min(100, a.morale + 5); } return 'Турнир удался (' + effWord(e) + ')! Знать рукоплещет, о короле говорят повсюду.'; } },
    { k: 'alms', n: 'Раздавать хлеб', d: 'Хлеб беднякам столицы из амбаров (≈10 мер в день): смута в столичной провинции спадает, слава растёт.', cost: 0, dur: 14,
      day: (o, c, e) => { if ((G.court.grain || 0) >= 10) { G.court.grain -= 10; provUnrest(G.realms[0].capital, -0.8 * e); prestige(0.06 * e); } }, done: () => 'Раздача хлеба окончена. Бедняки молятся за короля.' },
  ],
  magister: [
    { k: 'research', n: 'Исследовать', d: 'Магистр и переписчики изучают выбранное знание. Скорость — от Книги магистра.', cost: 0, dur: 999, tgt: 'tech',
      go: o => { G.tech.cur = o.t; }, day: (o, c, e) => { if (!G.tech.cur) G.tech.cur = o.t; techProgress(clamp(c.lrn / 9, 0.3, 2.4) * e); if (!G.tech.cur || G.tech.done[o.t]) o.fin = 1; }, done: (o) => 'Изучено: «' + TECH[o.t].n + '».' },
    { k: 'heal', n: 'Лечить больных', d: 'Лекари обходят войска у столицы и город: болезни отступают.', cost: 15, dur: 10,
      day: (o, c, e) => { for (const a of G.armies) if (a.alive && a.realm === 0 && settNear(a.x, a.y, 3) === G.realms[0].capital) a.sick = Math.max(0, a.sick * (1 - 0.08 * e)); }, done: () => 'Лекари закончили обход.' },
    { k: 'teach', n: 'Учить наследника', d: 'Магистр учит выбранное дитя короля: растут Книга и Речь, а иногда и мудрость.', cost: 0, dur: 21, tgt: 'child',
      done: (o, c, e) => { const k = charOf(o.t); if (!k || !k.alive) return 'Ученика больше нет.'; k.lrn = Math.min(20, k.lrn + Math.round(2 * e)); k.dip = Math.min(20, k.dip + (e > 1 ? 1 : 0)); if (e > 1.3 && !k.traits.includes('wise') && R.chance(0.3)) { k.traits = k.traits.filter(t => t !== 'reckless'); if (k.traits.length < 3) k.traits.push('wise'); } return k.name + ' прилежно учится: Книга ' + k.lrn + ', Речь ' + k.dip + '.'; } },
    { k: 'chronicle', n: 'Вести летопись', d: 'Летопись славных дел короля: слава растёт понемногу.', cost: 5, dur: 21, day: (o, c, e) => prestige(0.12 * e), done: () => 'Новая глава летописи дописана.' },
    { k: 'herbs', n: 'Заготовить снадобья', d: 'Травы и снадобья рассылаются во все наши войска: больные и раненые встают в строй быстрее.', cost: 20, dur: 8,
      done: (o, c, e) => { let n = 0; const k = clamp(0.35 * e, 0.15, 0.6); for (const a of G.armies) if (a.alive && a.realm === 0) { const r1 = Math.floor(a.sick * k), r2 = Math.floor(a.wounded * k * 0.6); if (r1 + r2 <= 0) continue; a.sick -= r1; a.wounded -= r2; returnMen(a, r1 + r2); n += r1 + r2; } return n ? 'Снадобья помогли: в строй вернулись ' + n + ' ' + plural(n, 'воин', 'воина', 'воинов') + '.' : 'Снадобья разосланы, но больных в войсках почти нет.'; } },
    { k: 'school', n: 'Школа писцов', d: 'Магистр учит писцов счёту и письму: подати собираются точнее — доход казны растёт навсегда (+1–2%).', cost: 30, dur: 14,
      done: (o, c, e) => { G.court.incK = Math.min(1.35, (G.court.incK || 1) + 0.015 * e); return 'Новые писцы разосланы по провинциям: доход вырос на ' + (1.5 * e).toFixed(1) + '%.'; } },
  ],
  justice: [
    { k: 'audit', n: 'Проверить казну', d: 'Судья с писарями сверяет книги казначея с сундуками. Если кто-то ворует — найдётся (если судья не подкуплен).', cost: 10, dur: 6,
      done: (o, c, e) => auditTreasury(c, e) },
    { k: 'banditry', n: 'Суды над разбойниками', d: 'Выездные суды и виселицы на перекрёстках: смута в провинциях спадает, разбойников меньше.', cost: 15, dur: 12,
      day: (o, c, e) => { for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = Math.max(0, P.unrest - 0.6 * e); }, done: (o, c, e) => { for (const a of G.armies) if (a.alive && a.kind === 'bandit') { const S = settNear(a.x, a.y, 10); if (S >= 0 && G.setts[S].owner === 0 && R.chance(0.35 * e)) { takeU(a.u, Math.ceil(armyMen(a) * 0.5)); } } return 'Суды прошли по всем провинциям (' + effWord(e) + '). На дорогах спокойнее.'; } },
    { k: 'amnesty', n: 'Объявить амнистию', d: 'Милость короля: смута резко спадает, слава растёт, но на дорогах станет вольготнее лихим людям.', cost: 0, dur: 3,
      done: () => { for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = Math.max(0, P.unrest - 15); prestige(3); G.court.amnestyDay = G.day; return 'Амнистия объявлена. Тюрьмы опустели.'; } },
    { k: 'laws', n: 'Свод законов', d: 'Судья сводит обычаи в единый закон: смута во всех наших провинциях медленно спадает, слава короля растёт.', cost: 20, dur: 21,
      day: (o, c, e) => { for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = Math.max(0, P.unrest - 0.25 * e); }, done: (o, c, e) => { prestige(Math.round(2 * e)); return 'Свод законов обнародован (' + effWord(e) + ').'; } },
    { k: 'inquiry', n: 'Тайное следствие', d: 'Судья допрашивает слуг и сверяет показания: заговор или кража при дворе может открыться.', cost: 15, dur: 8,
      done: (o, c, e) => { const s = G.court.secrets.find(s => !s.known && s.k !== 'love'); if (s && R.chance(clamp(0.35 * e + c.lrn / 60, 0.1, 0.9))) { s.known = 1; s.how = 'следствие судьи'; return 'Следствие открыло тайну: ' + secretText(s); } return 'Следствие ничего не нашло' + (s ? ', но судья чует неладное.' : '.'); } },
  ],
};
function ordDef(seatK, k) { return (ORD[seatK] || []).find(o => o.k === k); }
function giveOrder(seatK, k, mode, t) {
  const C = G.court, c = seatChar(seatK), d = ordDef(seatK, k); if (!c || !d) return false;
  if (d.cost && !spend(d.cost)) return false;
  const o = { k, mode, t, day0: G.day, dur: d.dur, prog: 0 }; const prev = C.orders[seatK]; if (prev && prev.k === 'research') G.tech.cur = null;
  C.orders[seatK] = o; if (d.go) d.go(o, c); (C.lastOrd = C.lastOrd || {})[seatK] = G.day;
  const sk = skillOf(c, seatDef(seatK).sk); let line;
  if (mode === 'order' && sk >= 13) { c.loy = clamp((c.loy || 60) - (c.traits.includes('proud') ? 3 : 1.5) * (hasTech('chancery') ? 0.4 : 1), 0, 100); line = R.pick(['Как прикажете, государь… хотя я бы сделал это иначе.', 'Будет исполнено в точности. Хоть я и знаю способ лучше.', 'Государь, вы связываете мне руки. Но я исполню.']); }
  else if (mode === 'intent' && sk >= 11) { c.loy = clamp((c.loy || 60) + 1, 0, 100); line = R.pick(['Благодарю за доверие, государь. Я найду лучший путь.', 'Понимаю замысел. Положитесь на меня.', 'Отличная мысль. Позвольте мне самому выбрать средства.']); }
  else if (mode === 'intent' && sk <= 6) line = R.pick(['Э-э… да, государь. Я… что-нибудь придумаю.', 'Постараюсь понять, чего вы желаете…']);
  else line = R.pick(['Будет исполнено, государь.', 'Слушаюсь.', 'Сделаю, что смогу.']);
  const n = npcByKey('seat_' + seatK); if (n && SCREEN === 'court') say(n, line, 4); else UI.toast(seatName(seatK) + ': «' + line + '»');
  if (typeof TUT !== 'undefined') TUT.ev('order', mode); return true;
}
function ordersDaily() {
  const C = G.court;
  for (const s of SEATS) { const o = C.orders[s.k]; if (!o) continue; const c = seatChar(s.k); if (!c) { C.orders[s.k] = null; continue; } const d = ordDef(s.k, o.k); if (!d) { C.orders[s.k] = null; continue; }
    if (o.eff === undefined) o.eff = orderEff(c, s.k, o.mode); if (o.self) o.eff = orderEff(c, s.k, 'intent') * selfK(s.k);
    if (d.day) d.day(o, c, o.eff); o.prog = Math.min(1, (G.day - o.day0) / o.dur);
    if (o.fin || G.day - o.day0 >= o.dur) { let rep = ''; try { rep = d.done(o, c, o.eff) || ''; } catch (e) { console.warn(e); } C.orders[s.k] = null; if (!o.self) (C.lastOrd = C.lastOrd || {})[s.k] = G.day; if (rep) addReport(s.k, (o.self ? 'Сам, без поручения: ' : '') + rep, o.self); } }
  selfOrders();
}
// an advisor left without orders acts on his own: cheap, safe tasks, at reduced effect that keeps falling the longer the king is silent
function selfK(k) { const C = G.court, L = C.lastOrd || (C.lastOrd = {}); if (L[k] === undefined) L[k] = G.day; const idle = G.day - L[k]; return clamp(0.75 - Math.max(0, idle - 14) * 0.012, 0.4, 0.75); }
const SELF = {
  chancellor: () => { const H0 = G.houses.filter(h => h.alive && h.loy < 45).sort((a, b) => a.loy - b.loy)[0]; if (H0) return ['calm_house', H0.id]; const T = [1, 2, 3, 4].filter(t => alive(t) && !G.rel[0][t].war).sort((a, b) => opinionOf(a, 0) - opinionOf(b, 0)); return T.length ? ['improve_rel', T[0]] : null; },
  treasurer: () => (G.court.incK || 1) < 1.12 ? ['census'] : null,
  marshal: () => capitalArmy() ? ['train'] : null,
  eye: () => ['protect'],
  seneschal: () => (G.court.grain || 0) < 700 ? ['stock'] : G.provs[WD.setts[G.realms[0].capital].prov].unrest > 12 ? ['alms'] : null,
  magister: () => { const t = G.tech.cur && techAvail(G.tech.cur) ? G.tech.cur : Object.keys(TECH).filter(techAvail).sort((a, b) => TECH[a].cost - TECH[b].cost)[0]; return t ? ['research', t] : ['chronicle']; },
  justice: () => { const P = G.provs.filter(p => G.setts[WD.provs[p.id].seat].owner === 0), u = P.length ? P.reduce((s, p) => s + p.unrest, 0) / P.length : 0; return u > 15 ? ['banditry'] : G.day - (G.court.auditDay || -99) > 60 ? ['audit'] : ['laws']; },
};
function selfOrders() { const C = G.court, L = C.lastOrd || (C.lastOrd = {});
  for (const s of SEATS) { const c = seatChar(s.k); if (!c || C.orders[s.k] || !SELF[s.k]) continue; if (L[s.k] === undefined) { L[s.k] = G.day; continue; } if (G.day - L[s.k] < 2) continue; // a day's grace for the king to speak
    let pk = null; try { pk = SELF[s.k](); } catch (e) { console.warn(e); } if (!pk) continue; const d = ordDef(s.k, pk[0]); if (!d) continue;
    if (d.cost) { const pay = Math.ceil(d.cost / 2); if (G.realms[0].gold < pay + 200) continue; G.realms[0].gold -= pay; } // on his own an advisor spends sparingly: half the price
    const o = { k: d.k, mode: 'intent', t: pk[1], day0: G.day, dur: d.dur, prog: 0, self: 1 }; o.eff = orderEff(c, s.k, 'intent') * selfK(s.k); C.orders[s.k] = o; if (d.go) d.go(o, c);
    if (d.k === 'audit') C.auditDay = G.day; } }
function addReport(seatK, text, quiet) { const C = G.court; C.reports.push({ seat: seatK, text, day: G.day }); if (C.reports.length > 40) C.reports.shift(); if (!quiet) log(seatName(seatK) + ': ' + text, 'info'); }
// ---------- council reports (through their eyes) ----------
function noisy(v, c, sk, honBias) { const s = skillOf(c, sk), err = clamp((20 - s) / 45, 0.04, 0.4); let x = v * (1 + R.range(-err, err)); if (honBias) x *= 1 + honBias; return Math.max(0, Math.round(x / (v > 200 ? 10 : 1)) * (v > 200 ? 10 : 1)); }
function seatReport(k) { const c = seatChar(k), C = G.court, r = G.realms[0]; if (!c) return null; const o = C.orders[k]; const ord = o ? (o.self ? ' Без ваших поручений взялся сам: «' : ' Поручение «') + ordDef(k, o.k).n + '» исполнено на ' + Math.round(o.prog * 100) + '%.' + (o.self && selfK(k) < 0.7 ? ' Давно не слышу вашего слова, государь, — работаю наугад.' : '') : ' Поручений от вас нет — жду слова государя.';
  if (k === 'chancellor') { const L = []; for (let t = 1; t < 5; t++) if (alive(t)) { const v = opinionOf(t, 0) + R.i(-Math.max(0, 14 - c.dip), Math.max(0, 14 - c.dip)); L.push(realmName(t) + ' — ' + (G.rel[0][t].war ? 'война' : opinionWord(v))); } const bad = G.houses.filter(H0 => H0.alive && H0.loy < 35).map(H0 => H0.name); return 'Отношения с державами: ' + L.join(', ') + '.' + (bad.length ? ' Недовольны дома: ' + bad.join(', ') + '.' : ' Знатные дома спокойны.') + ord; }
  if (k === 'treasurer') { const inc = (r.inc || 0); return 'В казне ' + zol(bookGold()) + ', доход ' + inc.toFixed(1) + ' в день, расход ' + (r.exp || 0).toFixed(1) + '.' + treasurerEconNote(c) + (bookGold() < 100 ? ' Казна скудеет, государь!' : '') + ord; }
  if (k === 'marshal') { const A = G.armies.filter(a => a.alive && a.realm === 0 && a.kind === 'lord'); const men = A.reduce((s, a) => s + armyMen(a), 0); return 'Под знамёнами ' + voin(noisy(men, c, 'mar')) + ' в ' + A.length + ' ' + plural(A.length, 'войске', 'войсках', 'войсках') + '.' + (A[0] ? ' Сэр ' + charOf(A[0].gen).name + ' стоит у ' + nearSettName(A[0]) + '.' : '') + ord; }
  if (k === 'eye') { const L = []; for (let t = 1; t < 5; t++) { if (!alive(t)) continue; const men = G.armies.filter(a => a.alive && a.realm === t && a.kind === 'lord').reduce((s, a) => s + armyMen(a), 0); const net = C.net[t] || 0; const est = net ? noisy(men, c, 'intr') : Math.round(noisy(men, { intr: c.intr * 0.6 }, 'intr') / 50) * 50; L.push(realmName(t) + ' ~' + est); } const sec = C.secrets.filter(s => !s.known && s.k !== 'love').length; return 'Войска соседей (по моим людям): ' + L.join(', ') + '.' + (sec && c.intr >= 10 ? ' При дворе что-то затевается — по ночам в саду шепчутся.' : ' При дворе всё спокойно.') + ord; }
  if (k === 'seneschal') return 'В амбарах ' + noisy(C.grain, c, 'stew') + ' мер зерна. ' + (C.grain < 400 ? 'Маловато на случай осады.' : 'Голод нам не грозит.') + ' Двор ' + (C.prestige > 15 ? 'восхищён государем' : C.prestige < -10 ? 'ропщет' : 'спокоен') + '.' + ord;
  if (k === 'magister') { const t = G.tech.cur; return (t ? 'Изучаем «' + TECH[t].n + '»: ' + Math.round(G.tech.prog / TECH[t].cost * 100) + '%.' : 'Сейчас мы ничего не изучаем.') + ord; }
  if (k === 'justice') { const P = G.provs.filter(p => G.setts[WD.provs[p.id].seat].owner === 0); const u = P.length ? P.reduce((s, p) => s + p.unrest, 0) / P.length : 0; const worst = P.slice().sort((a, b) => b.unrest - a.unrest)[0]; return 'Смута в провинциях ' + (u > 40 ? 'велика' : u > 20 ? 'заметна' : 'невелика') + (worst && worst.unrest > 25 ? '; хуже всего в ' + WD.provs[worst.id].name : '') + '.' + ord; }
  return ord; }
function nearSettName(a) { const s = settNear(a.x, a.y, 30); return s >= 0 ? WD.setts[s].name : 'дороги'; }
function capitalArmy() { const cap = G.realms[0].capital; return G.armies.find(a => a.alive && a.realm === 0 && a.kind === 'lord' && settNear(a.x, a.y, 2) === cap) || null; }
// ---------- secrets, theft, audits ----------
function addSecret(k, who, o) { const C = G.court; if (C.secrets.some(s => s.k === k && !s.known && s.who[0] === who[0])) return null; const s = Object.assign({ id: G.nextId++, k, who, day: G.day, known: 0, lastMeet: -9 }, o || {}); C.secrets.push(s); return s; }
function secretText(s) { const a = charOf(s.who[0]);
  if (s.k === 'theft') return 'Казначей ' + (a ? a.name : '') + ' ворует из казны: книги показывают больше, чем лежит в сундуках (≈' + Math.round(G.court.hidden) + ' зол.).';
  if (s.k === 'plot') return 'Дом ' + houseName(s.house) + ' тайно сносится с державой ' + realmName(s.realm) + '.';
  if (s.k === 'spy') return 'При дворе шпион державы ' + realmName(s.realm) + ' — ' + (a ? a.name : 'кто-то из слуг') + '.';
  if (s.k === 'love') return 'Конюх и служанка встречаются по ночам. Ничего опасного.';
  return 'Тайна.'; }
function treasurerDaily() { const c = seatChar('treasurer'), C = G.court, r = G.realms[0]; if (!c) return;
  const greedy = c.traits.includes('greedy'), hon = c.hon === undefined ? 60 : c.hon; if ((hon >= 45 && !greedy) || C.thiefScared > G.day) return;
  if (!R.chance(clamp((50 - hon) / 400 + (greedy ? 0.04 : 0), 0, 0.15))) return;
  const x = Math.round(clamp((r.inc || 5) * R.range(0.4, 0.9), 2, 22)); if (r.gold < x + 25) return; r.gold -= x; C.hidden += x; c.wealth = (c.wealth || 0) + x; addSecret('theft', [c.id]); }
function auditTreasury(judge, e) { const C = G.court, t = seatChar('treasurer'); if (C.hidden < 6) { return 'Книги казначея сверены с сундуками: всё сходится.'; }
  const bribed = judge && (judge.hon || 60) < 35 && R.chance(0.6); if (bribed) { judge.wealth = (judge.wealth || 0) + 20; return 'Книги проверены. Судья уверяет: всё сходится до монеты.'; }
  const p = clamp(0.35 + e * 0.35 + (judge ? judge.lrn / 50 : 0) - (t ? t.intr / 60 : 0), 0.15, 0.97); if (!R.chance(p)) return 'Проверка окончена: нашлись мелкие ошибки в счёте, но ничего дурного.';
  const s = C.secrets.find(s => s.k === 'theft' && !s.known) || addSecret('theft', [t ? t.id : -1]); if (s) { s.known = 1; s.how = 'проверка'; } C.pendingConfront = 1;
  return 'Проверка нашла недостачу ≈' + zol(C.hidden) + '! Книги казначея лгут.'; }
function treasuryAct() { const r = G.realms[0], C = G.court, real = r.gold, book = bookGold(); const eyeball = Math.max(0, Math.round(real / 50) * 50);
  const diff = book - real; const sus = diff > Math.max(25, real * 0.15);
  const text = ['Сундуки окованы железом. В свете свечи блестит золото. На глаз здесь около ' + eyeball + ' золотых.' + (sus ? ' А по книгам казначея — ' + Math.round(book) + '. Странно…' : '')];
  DLG.say(null, text, { name: 'Казна', choices: [{ t: 'Пересчитать монеты самому (≈3 часа)', fx: () => { advanceHours(3); if (C.hidden >= 6) { const s = C.secrets.find(s => s.k === 'theft' && !s.known) || addSecret('theft', [C.seats.treasurer]); if (s) { s.known = 1; s.how = 'пересчёт'; } DLG.say(null, 'Вы считаете до рези в глазах. В сундуках ' + zol(real) + '. По книгам — ' + Math.round(book) + '. Недостача — ' + Math.round(C.hidden) + '!', { choices: confrontChoices() }); } else DLG.say(null, 'Вы пересчитали всё до монеты: ' + zol(real) + '. Книги не лгут.'); if (typeof TUT !== 'undefined') TUT.ev('count'); } }, { t: 'Уйти', fx: () => { } }], esc: 1 }); }
function confrontChoices() { const t = seatChar('treasurer'), C = G.court; if (!t) return [{ t: 'Записать недостачу', fx: () => { C.hidden = 0; } }];
  const H0 = G.houses[t.house]; const rec = k => { const g = Math.round(C.hidden * k); G.realms[0].gold += g; C.hidden = 0; return g; };
  return [{ t: 'Вызвать казначея: отставка и конфискация', tip: 'Вернётся ~60% украденного. Дом казначея обидится.', fx: () => { const g = rec(0.6); dismissSeat('treasurer', 'вор'); if (H0) houseLoy(H0, -8); C.secrets = C.secrets.filter(s => s.k !== 'theft'); log('Казначей ' + t.name + ' изгнан за воровство. Возвращено ' + g + ' зол.', 'good'); } },
    { t: 'В темницу его!', tip: 'Вернётся ~80% украденного. Дом казначея оскорблён.', fx: () => { const g = rec(0.8); dismissSeat('treasurer', 'вор'); t.prison = G.realms[0].capital; if (H0) houseLoy(H0, -18); C.secrets = C.secrets.filter(s => s.k !== 'theft'); log('Казначей ' + t.name + ' брошен в темницу. Возвращено ' + g + ' зол.', 'good'); } },
    { t: 'Простить, но пусть вернёт всё', tip: 'Вернётся ~50%. Казначей останется, станет честнее — на время.', fx: () => { const g = rec(0.5); t.hon = clamp((t.hon || 30) + 20, 0, 100); t.loy = clamp((t.loy || 50) + 8, 0, 100); C.thiefScared = G.day + 60; C.secrets = C.secrets.filter(s => s.k !== 'theft'); log('Казначей ' + t.name + ' прощён и вернул ' + g + ' зол.', 'info'); } },
    { t: 'Пока промолчать', tip: 'Казначей не знает, что раскрыт. Можно вывести его на чистую воду позже.', fx: () => { C.pendingConfront = 1; } }]; }
function dismissSeat(k, why) { const C = G.court, id = C.seats[k]; if (id < 0) return; const c = charOf(id); C.seats[k] = -1; if (C.orders[k] && C.orders[k].k === 'research') G.tech.cur = null; C.orders[k] = null;
  if (c) { c.loy = clamp((c.loy || 50) - 25, 0, 100); c.seat = null; if (c.house >= 0 && G.houses[c.house] && why !== 'вор') houseLoy(G.houses[c.house], -8); }
  if (SCREEN === 'court') courtPopulate(); }
function appointSeat(k, id) { const C = G.court, c = charOf(id); (C.lastOrd = C.lastOrd || {})[k] = G.day; const cur = C.seats[k]; if (cur === id) return; if (cur >= 0) dismissSeat(k); for (const s of SEATS) if (C.seats[s.k] === id) { C.seats[s.k] = -1; C.orders[s.k] = null; }
  C.seats[k] = id; c.seat = k; c.atCourt = 1; c.loy = clamp((c.loy || 50) + 12, 0, 100); if (c.house >= 0 && G.houses[c.house]) houseLoy(G.houses[c.house], 6);
  log(c.name + ' назначен: ' + seatName(k) + '.', 'good'); if (SCREEN === 'court') { courtPopulate(); const n = npcByKey('seat_' + k); if (n) say(n, 'Благодарю, государь! Служу короне.', 4); } if (typeof TUT !== 'undefined') TUT.ev('appoint', k); }
function candidatesFor(k) { const C = G.court; return G.chars.filter(c => c.alive && c.prison < 0 && c.realm === 0 && (c.role === 'courtier' || c.role === 'council' || c.role === 'knight' || c.role === 'lord' || c.role === 'scholar') && c.age >= 16 && (c.atCourt || c.role === 'lord') && !c.withKing && c.id !== G.player.char && !armyOfGen(c.id)).sort((a, b) => skillOf(b, seatDef(k).sk) - skillOf(a, seatDef(k).sk)); }
function armyOfGen(id) { return G.armies.find(a => a.alive && a.gen === id && a.kind === 'lord'); }
function advanceHours(h) { const tgt = G.day + G.frac + h / 24; let n = 0; while (G.day + G.frac < tgt - 1e-6 && n++ < 400 && !UI.modalOpen()) worldAdvance(Math.min(0.01, tgt - G.day - G.frac)); if (SCREEN === 'court') { npcSnap(false); COURT.lastHA = G.day * 24 + hourAbs(); } }
function councilDaily() { if (!G.court) return; ordersDaily(); treasurerDaily(); secretsDaily(); lettersDaily(); petitionsDaily(); }
