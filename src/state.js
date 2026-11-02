'use strict';
// ===== STATE: game data, calendar, weather, economy, save =====
let WD = null, G = null;
const UT = ['levy', 'spear', 'sword', 'archer', 'xbow', 'horse', 'harch', 'knight'];
const UNIT = {
  levy: { n: 'Ополченцы', n1: 'ополченец', cost: 3, upk: 0.025, atk: 3, def: 2, hp: 10, spd: 1.0, mor: 40, ic: 'men' },
  spear: { n: 'Копейщики', n1: 'копейщик', cost: 6, upk: 0.04, atk: 4, def: 5, hp: 12, spd: 0.95, mor: 55, ic: 'men' },
  sword: { n: 'Латники', n1: 'латник', cost: 14, upk: 0.08, atk: 7, def: 7, hp: 14, spd: 0.85, mor: 65, ic: 'sword' },
  archer: { n: 'Лучники', n1: 'лучник', cost: 8, upk: 0.05, atk: 3, def: 2, hp: 10, spd: 1.0, mor: 45, ic: 'bow', rng: 150, cd: 2.6 },
  xbow: { n: 'Арбалетчики', n1: 'арбалетчик', cost: 11, upk: 0.06, atk: 4, def: 4, hp: 11, spd: 0.9, mor: 50, ic: 'xbow', rng: 125, cd: 4.2 },
  horse: { n: 'Всадники', n1: 'всадник', cost: 18, upk: 0.11, atk: 7, def: 7, hp: 15, spd: 1.9, mor: 60, ic: 'horse' },
  harch: { n: 'Конные лучники', n1: 'конный лучник', cost: 15, upk: 0.1, atk: 3, def: 4, hp: 12, spd: 2.0, mor: 50, ic: 'harch', rng: 115, cd: 3.0 },
  knight: { n: 'Рыцари', n1: 'рыцарь', cost: 30, upk: 0.18, atk: 10, def: 9, hp: 18, spd: 1.6, mor: 75, ic: 'knight' },
};
const UNIT_TIP = { levy: 'Дёшевы и многочисленны, но слабы и пугливы. Их берут от сохи: набор ополчения немного снижает достаток селения.', spear: 'Держат строй: конница разбивается о копья спереди. В «еже» не боятся обхода.', sword: 'Тяжёлая пехота: лучшая в рукопашной, стрелы им почти не страшны.', archer: 'Бьют издали и часто; нужны стрелы. Беззащитны в ближнем бою.', xbow: 'Арбалетный болт пробивает латы: страшны латникам и рыцарям. Бьют реже и ближе лучников, зато крепче в обороне.', horse: 'Быстры, страшны с фланга и тыла, догоняют бегущих. Воевода не бросает их под ливень стрел, пока строй врага цел: ждёт схватки и бьёт во фланг и по стрелкам. Едят фураж.', harch: 'Стреляют с коня и не даются в руки: заходят во фланг и тыл, жалят и уходят от погони, рукопашной избегают. Едят фураж.', knight: 'Тяжёлая конница: сокрушительный удар клином. Дороги, едят фураж и боятся копий в лоб.' };
const RANGED = { archer: 1, xbow: 1, harch: 1 }, MOUNTED = { horse: 1, harch: 1, knight: 1 }, FOOT = { levy: 1, spear: 1, sword: 1, archer: 1, xbow: 1 };
const mountedN = u => (u.horse || 0) + (u.harch || 0) + (u.knight || 0), rangedN = u => (u.archer || 0) + (u.xbow || 0) + (u.harch || 0);
// local recruiting traditions: realm (by the land's original owner) → multiplier per troop type
const CUL_UNIT = [{ knight: 1.3 }, { sword: 1.4, knight: 0, horse: 0.6, xbow: 0.5 }, { xbow: 2.5, knight: 0.4, harch: 0 }, { knight: 1.7, spear: 1.2, harch: 0 }, { harch: 3, knight: 1.2, xbow: 0.6 }, {}, {}];
const SEASONS = ['Весна', 'Лето', 'Осень', 'Зима'];
const DAYS_SEASON = 21, DAYS_YEAR = 84;
const SPD = [Infinity, 1.6, 0.8, 0.3];
const BASE_SPEED = 6.5; // tiles per day on cost-1 terrain
const WAGON_CAP = 400, MAN_CAP = 3;
const TRAITS = {
  brave: { n: 'Храбрый', d: 'Боевой дух войска +10. Рвётся в бой.', mor: 10, agg: 0.3 },
  craven: { n: 'Трусливый', d: 'Боевой дух −5. Избегает сражений.', mor: -5, agg: -0.4 },
  cautious: { n: 'Осторожный', d: 'Замечает засады. Предпочитает оборону.', agg: -0.2, scout: 2 },
  reckless: { n: 'Безрассудный', d: 'Атакует даже слабее врага.', agg: 0.5 },
  cunning: { n: 'Хитрый', d: 'Интриги +3. Мастер обмана.', intr: 3 },
  honest: { n: 'Честный', d: 'Держит слово. Ценит честных.', honor: 1 },
  greedy: { n: 'Жадный', d: 'Любит золото: дары и дань действуют сильнее.', greed: 1 },
  generous: { n: 'Щедрый', d: 'Дипломатия +2.', dip: 2 },
  proud: { n: 'Гордый', d: 'Не терпит требований и угроз.', pride: 1 },
  wise: { n: 'Мудрый', d: 'Дипломатия +2, Воинское +1.', dip: 2, mar: 1 },
  wrathful: { n: 'Гневливый', d: 'Легко объявляет войну.', agg: 0.25, war: 1 },
  patient: { n: 'Терпеливый', d: 'Умело ведёт осады.', siege: 1 },
};
const NAMES = {
  K: 'Альдрик,Бертран,Годрик,Эдмунд,Роланд,Тибальт,Освин,Леопольд,Конрад,Гарет,Лайонел,Тристан,Седрик,Рейнард,Освальд,Хьюго,Арчибальд,Болдуин,Ричард,Уильям,Генри,Джеффри,Филипп,Персиваль,Гилберт,Эдгар,Эдвин,Саймон,Хамфри,Ральф,Уолтер,Бернард,Малкольм,Дункан,Матильда,Изольда,Розамунда,Элеонора,Беатрис,Гвендолин,Аделина,Сибилла,Эдит,Женевьева,Агата,Ровена,Мод,Элис,Джоан,Сесилия,Летиция,Кларисса,Мирабель,Имоджен,Марджери,Алиенора'.split(','),
  C: 'Ульф,Хальвдан,Сигурд,Рагнар,Торвальд,Эйрик,Гуннар,Ивар,Кнут,Харальд,Асбьёрн,Астрид,Сигрид,Ингрид'.split(','),
  R: 'Лоренцо,Пьетро,Джакомо,Лука,Себастьяно,Франческо,Орсо,Доменико,Марино,Беатриче,Лючия,Изабелла'.split(','),
  T: 'брат Анселм,отец Бенедикт,сестра Агнесса,брат Кирилл,отец Илларион,брат Феофан,отец Евстафий,сестра Клара,брат Тимофей'.split(','),
  E: 'Флавий,Кассиан,Валентиниан,Луциан,Максимиан,Деметрий,Никифор,Феодор,Юстин,Ирина,Зоя,Феодора'.split(','),
  F: 'Гордей,Бранко,Мирко,Радко,Зденек,Остап,Бронислав,Ясько'.split(','),
  B: 'Чёрный Яков,Кривой Сыч,Рыжая Марта,Волчок,Безухий,Лихо'.split(','),
};
const RULERS = [
  { name: 'Марко', title: 'Король', traits: ['honest', 'wise'], age: 34, mar: 11, dip: 10, intr: 6, stew: 9 },
  { name: 'Бьорн', title: 'Ярл', traits: ['brave', 'wrathful'], age: 41, mar: 14, dip: 4, intr: 5, stew: 6 },
  { name: 'Альвизе', title: 'Дож', traits: ['greedy', 'cunning'], age: 58, mar: 6, dip: 13, intr: 14, stew: 15 },
  { name: 'Серафима', title: 'Мать', traits: ['proud', 'patient'], age: 49, mar: 8, dip: 11, intr: 10, stew: 11 },
  { name: 'Аврелий', title: 'Император', traits: ['proud', 'cautious'], age: 52, mar: 12, dip: 9, intr: 9, stew: 12 },
];
const dayOfYear = d => d % DAYS_YEAR, seasonOf = d => Math.floor((d % DAYS_YEAR) / DAYS_SEASON), yearOf = d => Math.floor(d / DAYS_YEAR) + 1;
// calendar: week = 7 days (a season starts on Monday), season = 3 weeks = 21 days, year = 4 seasons = 84 days
const DAYS_WEEK = 7, WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'], WDAY_S = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const weekdayOf = d => d % DAYS_WEEK;
const dateStr = d => WDAY_S[weekdayOf(d)] + ', ' + (d % DAYS_SEASON + 1) + ' д. · ' + SEASONS[seasonOf(d)] + ' · ' + yearOf(d) + ' г.';
const inDays = n => n <= 0 ? 'сегодня' : n === 1 ? 'завтра' : 'через ' + n + ' ' + plural(n, 'день', 'дня', 'дней');
const COUNCIL_WD = 3; // the small council meets on Thursdays at 9:30
function nextCouncilDay() { const C = G.court; let d = G.day; const h = typeof hourAbs === 'function' ? hourAbs() : 5; if (weekdayOf(d) === COUNCIL_WD && h < 12 && !(C && C.meetDone === d)) return d; d++; while (weekdayOf(d) !== COUNCIL_WD) d++; return d; }
function calendarTip() { const nd = nextCouncilDay(), dd = (DAYS_SEASON * 3 - dayOfYear(G.day) + DAYS_YEAR) % DAYS_YEAR || DAYS_YEAR;
  return ['Календарь: неделя — 7 дней, сезон — 3 недели (21 день), год — 4 сезона (84 дня).', 'Сегодня ' + WEEKDAYS[weekdayOf(G.day)] + ', ' + (dayOfYear(G.day) + 1) + '-й день года.', { t: 'Малый совет — по четвергам в 9:30. Ближайший: ' + WDAY_S[weekdayOf(nd)] + ', ' + (nd % DAYS_SEASON + 1) + ' д. · ' + SEASONS[seasonOf(nd)] + ' (' + inDays(nd - G.day) + ').', c: '#e8d8b0' }, { t: 'Совет короны (голоса держав) — раз в год, в первый день зимы: ' + inDays(dd) + '.', c: '#e8d8b0' }]; }
function menOf(u) { let s = 0; for (const t of UT) s += u[t] || 0; return Math.round(s); }
function voin(n) { n = Math.round(n); return n + ' ' + plural(n, 'воин', 'воина', 'воинов'); }
function zol(n) { n = Math.round(n); return n + ' ' + plural(n, 'золотой', 'золотых', 'золотых'); }
function emptyU() { return { levy: 0, spear: 0, sword: 0, archer: 0, xbow: 0, horse: 0, harch: 0, knight: 0 }; }
function addU(a, b, k) { k = k === undefined ? 1 : k; for (const t of UT) a[t] = (a[t] || 0) + (b[t] || 0) * k; return a; }
function scaleU(u, k) { const o = {}; for (const t of UT) o[t] = (u[t] || 0) * k; return o; }
function roundU(u) { for (const t of UT) u[t] = Math.max(0, Math.round(u[t] || 0)); return u; }
function upkeepU(u) { let s = 0; for (const t of UT) s += (u[t] || 0) * UNIT[t].upk; return s; }
function powerU(u, xp) { let s = 0; for (const t of UT) { const U = UNIT[t]; s += (u[t] || 0) * (U.atk + U.def) * (U.hp / 12) * (MOUNTED[t] ? 1.25 : 1) * (1 + ((xp && xp[t]) || 0) * 0.004); } return s / 10; }
const charOf = id => G.chars[id];
const realmOf = id => G.realms[id];
const settOf = id => G.setts[id];
const ownerOfProv = p => G.setts[WD.provs[p].seat].owner;
const ctrlOfSett = s => G.setts[s].ctrl;
function charName(c) { return c.title ? c.title + ' ' + c.name : c.name; }
function traitSum(c, k) { let s = 0; for (const t of c.traits) s += TRAITS[t][k] || 0; return s; }
const FEMRX = /а$|я$|сестра|Астрид|Сигрид|Ингрид|Беатриче|Лючия|Ирина|Зоя|Марта|Беатрис|Гвендолин|Эдит|^Мод$|^Элис$|^Джоан$|^Мирабель$|^Имоджен$|^Марджери$/;
function isFemName(n) { const w = String(n || '').split(' ')[0]; return FEMRX.test(w) && !/^(Лука|Добрыня|Илья|Никита|Фома)$/.test(w) ? 1 : 0; }
// pick a given name of the culture; fem: 1 / 0 / undefined (any). Prefers names not borne by living people.
function pickName(cul, fem, rng) { rng = rng || R; const pool0 = NAMES[cul] || NAMES.K; let pool = fem === undefined ? pool0 : pool0.filter(n => isFemName(n) === (fem ? 1 : 0)); if (!pool.length) pool = pool0;
  const used = new Set((G && G._resv) || []); if (G && G.chars) for (const c of G.chars) if (c.alive) used.add(String(c.name).split(' ')[0]);
  const fresh = pool.filter(n => !used.has(n.split(' ')[0])); return rng.pick(fresh.length ? fresh : pool); }
function mkChar(realm, cul, role, rng, o) {
  o = o || {}; const id = G.chars.length;
  let name = o.name;
  if (!name) name = pickName(cul, o.fem !== undefined ? o.fem : (role === 'general' || role === 'merchant' || role === 'lord') ? 0 : undefined, rng);
  const tk = Object.keys(TRAITS); const traits = o.traits || [];
  while (traits.length < 2) { const t = rng.pick(tk); if (!traits.includes(t) && !(t === 'brave' && traits.includes('craven')) && !(t === 'craven' && traits.includes('brave')) && !(t === 'reckless' && traits.includes('cautious')) && !(t === 'cautious' && traits.includes('reckless'))) traits.push(t); }
  const c = { id, name, title: o.title || '', realm, cul, role, traits, age: o.age !== undefined ? o.age : rng.i(22, 60), mar: o.mar || rng.i(4, 15), dip: o.dip || rng.i(3, 14), intr: o.intr || rng.i(3, 14), stew: o.stew || rng.i(3, 14), alive: 1, pseed: rng.i(1, 1e9), fem: isFemName(name), prison: -1 };
  if (o.fem !== undefined) c.fem = o.fem;
  // v3 inner qualities: learning, loyalty, ambition, honesty (trait-biased)
  const has = t => traits.includes(t);
  c.lrn = o.lrn || rng.i(2, 12) + (has('wise') ? 3 : 0);
  c.loy = o.loy !== undefined ? o.loy : clamp(rng.i(45, 80) + (has('honest') ? 8 : 0) - (has('proud') ? 6 : 0) - (has('cunning') ? 5 : 0), 5, 100);
  c.amb = o.amb !== undefined ? o.amb : clamp(rng.i(20, 65) + (has('proud') ? 15 : 0) + (has('wrathful') ? 6 : 0) + (has('cunning') ? 8 : 0) - (has('patient') ? 6 : 0), 0, 100);
  c.hon = o.hon !== undefined ? o.hon : clamp(has('honest') ? rng.i(68, 92) : has('cunning') ? rng.i(18, 50) : has('greedy') ? rng.i(25, 55) : rng.i(40, 78), 0, 100);
  c.house = o.house !== undefined ? o.house : -1;
  G.chars.push(c); return c;
}
// ---------- weather ----------
const WEATHER = {
  clear: { n: 'Ясно', ic: 'star', mv: 1, vis: 1 }, cloud: { n: 'Облачно', ic: 'smoke', mv: 1, vis: 0.95 },
  rain: { n: 'Дождь', ic: 'water', mv: 1.15, vis: 0.8, wet: 1 }, storm: { n: 'Ливень', ic: 'water', mv: 1.3, vis: 0.6, wet: 1, sick: 1.5 },
  fog: { n: 'Туман', ic: 'smoke', mv: 1.05, vis: 0.5 }, snow: { n: 'Снегопад', ic: 'water', mv: 1.25, vis: 0.7, cold: 1 },
  blizzard: { n: 'Метель', ic: 'water', mv: 1.6, vis: 0.45, cold: 1, sick: 2 }, heat: { n: 'Зной', ic: 'fire', mv: 1.05, vis: 1, heat: 1, dry: 1 },
  wind: { n: 'Сухой ветер', ic: 'fire', mv: 1, vis: 1, dry: 1, windy: 1 },
};
const WTAB = [
  { clear: 30, cloud: 25, rain: 25, storm: 6, fog: 14 },
  { clear: 40, cloud: 15, rain: 10, storm: 6, heat: 17, wind: 12 },
  { clear: 22, cloud: 25, rain: 25, storm: 8, fog: 16, wind: 4 },
  { clear: 22, cloud: 25, snow: 30, blizzard: 10, fog: 13 },
];
function rollWeather() {
  const t = WTAB[seasonOf(G.day)]; const ks = Object.keys(t); const k = R.wpick(ks, x => t[x]);
  G.weather = { k, days: R.i(2, 5) };
}
const weatherOf = () => WEATHER[G.weather.k];
// ---------- new game ----------
function newGame(seed, opt) {
  opt = opt || {};
  WD = genWorld(seed); R.seed((seed ^ 0x2545f491) >>> 0); // the same seed gives the same game, not only the same world
  const rng = mkRng(seed ^ 0x9e3779b9);
  G = { v: 2, seed, day: 0, frac: 0, speed: 0, mode: 'ter', realms: [], chars: [], setts: [], provs: [], armies: [], log: [], msgs: [], spies: [], rel: [], weather: { k: 'clear', days: 3 }, stats: { battles: 0, won: 0, sieges: 0 }, flags: {}, diff: opt.diff || 1, tut: { on: opt.tut !== false, cur: 0, done: [], seen: {} }, nextId: 1, mapOpen: !!opt.mapOpen };
  // realms
  REALM_DEF.forEach((d, i) => {
    const r = { id: i, key: d.key, name: d.name, col: d.col, gold: [300, 260, 420, 300, 520, 0, 0][i], ruler: -1, capital: -1, prestige: 0, war: 0, minor: i >= 5 };
    G.realms.push(r);
  });
  for (let i = 0; i < 5; i++) { const rd = RULERS[i]; const c = mkChar(i, REALM_DEF[i].key, 'ruler', rng, Object.assign({}, rd, { traits: rd.traits.slice() })); G.realms[i].ruler = c.id; }
  G.realms[3].fem = 1; G.chars[G.realms[3].ruler].fem = 1;
  // relations matrix
  for (let a = 0; a < 7; a++) { G.rel.push([]); for (let b = 0; b < 7; b++) G.rel[a].push({ war: 0, truce: 0, ally: 0, pact: 0, opn: 0, ws: 0, since: 0 }); }
  const setOpn = (a, b, v) => { G.rel[a][b].opn = v; G.rel[b][a].opn = v; };
  setOpn(0, 1, -30); setOpn(0, 2, 15); setOpn(0, 3, 0); setOpn(0, 4, -10); setOpn(1, 2, -10); setOpn(1, 3, -20); setOpn(1, 4, -25); setOpn(2, 3, -5); setOpn(2, 4, 10); setOpn(3, 4, -15);
  // bandits & free lands at war with everyone
  for (let a = 0; a < 7; a++) { G.rel[a][6].war = G.rel[6][a].war = a !== 6 ? 1 : 0; }
  // settlements
  WD.setts.forEach((s, k) => {
    const P = WD.provs[s.prov]; let own = WD.owner[s.prov]; if (own < 0) own = 5;
    const big = { village: 0, castle: 1, town: 2, capital: 3 }[s.type];
    const pop = [rng.i(250, 700), rng.i(700, 1600), rng.i(1800, 4500), rng.i(5000, 9000)][big];
    const S = { id: k, owner: own, ctrl: own, pop, prosp: rng.i(45, 75), walls: [0, 2, 1, 3][big], gar: emptyU(), food: 0, pool: emptyU(), mk: { food: 0, fodder: 0, arrows: 0, weap: 0, horses: 0, wagons: 0, pitch: 0 }, siege: null, lootDay: -99, occDay: 0, dev: 0, lord: -1 };
    if (s.type === 'capital') G.realms[own].capital = k;
    G.setts.push(S);
  });
  WD.provs.forEach((P, k) => G.provs.push({ id: k, dev: 0, unrest: 0, guides: 0 }));
  // free lords
  WD.provs.forEach((P, k) => { const S = G.setts[P.seat]; if (S.owner === 5) { const c = mkChar(5, 'F', 'lord', rng, { title: 'Вольный барон' }); S.lord = c.id; } });
  // garrisons, pools, markets
  for (const S of G.setts) initSettlement(S, rng, true);
  // chars: generals
  for (let r = 0; r < 5; r++) { const n = r === 0 ? 2 : clamp(Math.round(G.setts.filter(S => S.owner === r && WD.setts[S.id].type !== 'village').length / 4), 2, 4); for (let k = 0; k < n; k++) mkChar(r, REALM_DEF[r].key, 'general', rng, r === 0 ? { title: 'Сэр', name: pickName('K', 0, rng), fem: 0 } : { title: r === 1 ? 'Хёвдинг' : r === 2 ? 'Кондотьер' : r === 3 ? 'Паладин' : 'Стратиг' }); }
  // player
  G.player = { realm: 0, char: G.realms[0].ruler };
  const cap0 = WD.setts[G.realms[0].capital];
  const pa = mkArmy(0, 'player', G.player.char, cap0.x, cap0.y, { levy: 110, spear: 60, sword: 30, archer: 50, horse: 14, knight: 6 });
  Object.assign(pa, { food: 1900, fodder: 200, water: 4, arrows: 1500, weap: 40, horses: 4, wagons: 4 });
  G.player.army = pa.id;
  // AI lord armies
  for (let r = 1; r < 5; r++) {
    const gens = G.chars.filter(c => c.realm === r && c.role === 'general');
    gens.forEach((c, k) => {
      const caps = G.setts.filter(S => S.owner === r && WD.setts[S.id].type !== 'village');
      const S = k === 0 ? G.setts[G.realms[r].capital] : caps[(k * 3 + 1) % caps.length];
      const ws = WD.setts[S.id]; const sz = [0, 1, 0.9, 1, 1.2][r] * rng.range(0.8, 1.15);
      const comp = [null, { levy: 90, spear: 60, sword: 50, archer: 50, xbow: 10, horse: 20 }, { levy: 50, spear: 80, sword: 35, archer: 25, xbow: 45, horse: 25, knight: 5 }, { levy: 100, spear: 70, sword: 30, archer: 45, horse: 15, knight: 12 }, { levy: 60, spear: 80, sword: 45, archer: 30, horse: 35, harch: 30, knight: 12 }][r];
      const a = mkArmy(r, 'lord', c.id, ws.x, ws.y, roundU(scaleU(comp, sz)));
      Object.assign(a, { food: menOf(a.u) * 8, fodder: mountedN(a.u) * 6 + 40, water: 4, arrows: rangedN(a.u) * 30, weap: 20, horses: 2, wagons: 3 });
      a.ai = { task: 'idle', t: 0 };
    });
  }
  // bandits
  WD.lairs.forEach((L, k) => spawnBandits(L, rng));
  // caravans
  for (let k = 0, n = caravanWant(); k < n; k++) { const c = spawnCaravan(rng); if (c) c.ai.t = rng.i(0, 4); }
  // explored tiles
  G.explored = new Uint8Array(NT);
  if (G.mapOpen) G.explored.fill(1);
  else {
    for (let i = 0; i < NT; i++) { const p = WD.prov[i]; if (p >= 0 && ownerOfProv(p) === 0) G.explored[i] = 1; }
    // neighbours of own provinces partially
    const nb = new Set(); WD.provs.forEach((P, k) => { if (ownerOfProv(k) === 0) P.nb.forEach(n => nb.add(n)); });
    for (let i = 0; i < NT; i++) { const p = WD.prov[i]; if (p >= 0 && nb.has(p)) G.explored[i] = 1; }
  }
  revealWater();
  G.vis = new Uint8Array(NT);
  rollWeather(); G.weather = { k: 'clear', days: 3 };
  econReset(); for (let r = 0; r < 5; r++) { const R0 = G.realms[r], g = R0.gold; realmEconomy(r); R0.gold = g; } // show income/expenses from day one
  log('Год 1. ' + charName(charOf(G.player.char)) + ' выступает из столицы ' + WD.setts[G.realms[0].capital].name + '.', 'title');
  return G;
}
function initSettlement(S, rng, first) {
  const ws = WD.setts[S.id];
  initEcon(S, first); // riches of the land, workshops, market targets and the first stock (econ.js)
  const t = ws.type, own = S.owner;
  const gm = own === 5 ? 0.7 : 1;
  if (S.cul === undefined) S.cul = own;
  if (t === 'village') { S.gar = Object.assign(emptyU(), { levy: rng.i(8, 20), archer: rng.i(0, 6) }); S.food = 6; }
  else if (t === 'castle') { S.gar = roundU(scaleU({ levy: 30, spear: 30, sword: 12, archer: 20, xbow: 4, horse: 4 }, gm * rng.range(0.8, 1.2))); S.food = 30; }
  else if (t === 'town') { S.gar = roundU(scaleU({ levy: 50, spear: 30, sword: 10, archer: 22, xbow: 10, horse: 4 }, gm * rng.range(0.8, 1.2))); S.food = 24; }
  else { S.gar = roundU(scaleU({ levy: 60, spear: 60, sword: 40, archer: 40, xbow: 10, horse: 12, knight: 5 }, rng.range(0.9, 1.1))); S.food = 45; }
  S.foodMax = S.food;
  if (!first) restockMarket(S, 0.2);
  refillPool(S, first ? 10 : 1);
}
function restockMarket(S, k) { if (!S.mkT) mkTargets(S); for (const key of GOODS) S.mk[key] = Math.min(S.mkCap[key], (S.mk[key] || 0) + S.mkT[key] * k); }
// daily recruit growth per troop type in this settlement (type of place × riches × local tradition)
function poolRates(S) {
  const t = WD.setts[S.id].type, r = S.res; if (S.owner === 6) return {};
  const hA = r.horse > 1.3 ? 0.2 * r.horse : 0;
  const rate = { village: { levy: 1.5, archer: 0.25 * r.wood }, castle: { levy: 0.8, spear: 1.0, sword: 0.35, archer: 0.7 * r.wood, horse: 0.35 * r.horse, knight: 0.1 * r.horse, harch: hA }, town: { levy: 2, spear: 0.8, sword: 0.3, archer: 0.8, xbow: 0.45 * Math.min(1.6, 0.5 + r.iron * 0.5), horse: 0.25 * r.horse, harch: hA * 0.6 }, capital: { levy: 2.5, spear: 1.4, sword: 0.6, archer: 1.0, xbow: 0.5, horse: 0.6 * r.horse, knight: 0.15 * r.horse, harch: hA } }[t];
  const cul = S.cul === undefined ? S.owner : S.cul, CK = CUL_UNIT[cul] || {}; if (cul === 4 && t !== 'village') rate.harch = Math.max(rate.harch || 0, 0.12);
  const o = {}; for (const u in rate) { const k = CK[u] === undefined ? 1 : CK[u]; if (rate[u] * k > 0) o[u] = rate[u] * k; } return o;
}
const POOL_K = { levy: 1, spear: 0.6, archer: 0.6, xbow: 0.45, sword: 0.35, horse: 0.35, harch: 0.3, knight: 0.15 };
function poolCap(S, u) { const t = WD.setts[S.id].type, cul = S.cul === undefined ? S.owner : S.cul, k = (CUL_UNIT[cul] || {})[u]; return { village: 30, castle: 60, town: 90, capital: 140 }[t] * (0.5 + S.prosp / 100) * POOL_K[u] * Math.max(0.5, k === undefined ? 1 : k); }
function refillPool(S, days) {
  if (S.owner === 6) return; const rate = poolRates(S), dev = G.provs[WD.setts[S.id].prov].dev;
  for (const u in rate) S.pool[u] = Math.min(poolCap(S, u), (S.pool[u] || 0) + rate[u] * days * (0.5 + S.prosp / 100) * (1 - dev));
}

// ---------- armies ----------
function mkArmy(realm, kind, gen, tx, ty, u) {
  const a = { id: G.nextId++, realm, kind, gen, x: tx + 0.5, y: ty + 0.5, path: null, pi: 0, prog: 0, u: Object.assign(emptyU(), u), xp: emptyU(), wounded: 0, sick: 0, morale: 65, fat: 10, food: 0, fodder: 0, water: 4, arrows: 0, weap: 0, horses: 0, wagons: 0, pitch: 0, mode: 'march', modeDay: 0, forced: 0, camp: 0, fortDays: 0, siegeOf: -1, alive: 1, hunger: 0, thirst: 0, lastFight: -99, vict: 0, stay: 0, hidden: 0, fires: 0 };
  for (const t of UT) a.xp[t] = kind === 'bandit' ? 5 : kind === 'player' ? 10 : 15;
  G.armies.push(a); return a;
}
function spawnBandits(L, rng) {
  rng = rng || R; const n = rng.i(25, 70);
  const c = mkChar(6, 'B', 'bandit', rng, { title: 'Атаман' });
  const a = mkArmy(6, 'bandit', c.id, L.x, L.y, { levy: Math.round(n * 0.6), spear: Math.round(n * 0.1), sword: 0, archer: Math.round(n * 0.25), horse: Math.round(n * 0.05) });
  Object.assign(a, { food: n * 6, water: 4, arrows: rangedN(a.u) * 20, lair: WD.lairs.indexOf(L) });
  a.ai = { task: 'lurk', t: 0 }; a.morale = 55; return a;
}
const armyById = id => G.armies.find(a => a.id === id && a.alive);
const playerArmy = () => armyById(G.player.army);
const armyMen = a => menOf(a.u);
const armyTile = a => (Math.floor(a.y) * MW + Math.floor(a.x));
function armyCap(a) { return armyMen(a) * MAN_CAP + a.wagons * WAGON_CAP; }
function armyLoad(a) { return a.food + a.fodder + a.arrows / 10 + a.weap * 2 + a.pitch * 5; }
function waterCap(a) { return 4 + Math.min(6, Math.floor((a.wagons || 0) / 2)); } // bottles & skins for 4 days, barrels on the wagons: +1 per 2 wagons (up to +6)
// ---------- log ----------
// reveal water next to known land: whole lakes, sea up to 6 tiles off the coast
function revealWater() {
  // only land next to water matters, and only when something new was explored
  const ex = G.explored; let ne = 0; for (let i = 0; i < NT; i++) ne += ex[i]; if (revealWater.ne === ne && revealWater.g === G) return; revealWater.ne = ne; revealWater.g = G;
  const ter = WD.ter, wat = WD._wat || (WD._wat = Uint8Array.from(ter, t => TINFO[t].water ? 1 : 0)), d = new Int16Array(NT).fill(-1), q = new Int32Array(NT); let qh = 0, qt = 0, ch = 0;
  for (let i = 0; i < NT; i++) if (ex[i] && !wat[i]) { const x = i % MW; let c = false; for (let k = 0; k < 4; k++) { const j = nb4(i, x, k); if (j >= 0 && wat[j]) { c = true; break; } } if (c) { d[i] = 0; q[qt++] = i; } }
  while (qh < qt) { const a = q[qh++], x = a % MW, lake = ter[a] === TR.LAKE;
    if (!lake && d[a] >= 6) continue;
    for (let k = 0; k < 4; k++) { const j = nb4(a, x, k); if (j < 0) continue; if (d[j] >= 0 || !wat[j]) continue; d[j] = ter[j] === TR.LAKE ? 0 : d[a] + 1; if (!G.explored[j]) { G.explored[j] = 1; ch = 1; } q[qt++] = j; } }
  if (ch && typeof FOGDIRTY !== 'undefined') FOGDIRTY = 1;
}
function log(t, c) { G.log.push({ d: G.day, t, c: c || 'info' }); if (G.log.length > 200) G.log.shift(); if (typeof UI !== 'undefined' && UI.onLog) UI.onLog(t, c); }
// ---------- war state ----------
function atWar(a, b) { if (a === b) return false; if (a === 6 || b === 6) return true; if (a === 5 || b === 5) return !!G.rel[a][b].war; return !!G.rel[a][b].war; }
function hostile(a, b) { return atWar(a, b); }
// ---------- save / load ----------
function rle(arr) { let s = [], cur = arr[0], n = 0; for (let i = 0; i < arr.length; i++) { if (arr[i] === cur) n++; else { s.push(cur + ':' + n); cur = arr[i]; n = 1; } } s.push(cur + ':' + n); return s.join(','); }
function unrle(str, len) { const a = new Uint8Array(len); let i = 0; for (const p of str.split(',')) { const [v, n] = p.split(':').map(Number); a.fill(v, i, i + n); i += n; } return a; }
function saveGame(slot) {
  const o = Object.assign({ wv: WORLD_V }, G, { rngS: R.get() }); SAVEOK.t = -9; o.explored = rle(G.explored); delete o.vis;
  // markets: what can be worked out again from the land is not written down; stocks and books are rounded
  const r1 = v => Math.round(v * 10) / 10, rd = (src, f) => { const c = {}; for (const k in src) { const v = src[k]; if (v) c[k] = f(v); } return c; };
  o.setts = G.setts.map(S => { const c = Object.assign({}, S); delete c.res; delete c.wk; delete c.mkT; delete c.mkCap; c.mk = rd(S.mk, r1);
    if (S.st) { c.st = {}; for (const key in S.st) c.st[key] = rd(S.st[key], v => Math.round(v * 100) / 100); } return c; });
  const strip = (k, v) => (k === '_look' || k === '_lookK' || k === 'look') ? undefined : v;
  try { localStorage.setItem('sk3_save' + (slot || ''), JSON.stringify(o, strip)); return true; } catch (e) { return false; }
}
function hasSave(slot) { try { return !!localStorage.getItem('sk3_save' + (slot || '')); } catch (e) { return false; } }
// a save is usable only on the world it was made for (the map grew in v3.2: old saves cannot be placed on it)
const SAVEOK = { t: -9, v: false };
function saveOk(slot) { const now = performance.now() / 1000; if (now - SAVEOK.t < 2 && !slot) return SAVEOK.v; let v = false; try { const s = localStorage.getItem('sk3_save' + (slot || '')); v = !!s && s.startsWith('{"wv":' + WORLD_V + ','); } catch (e) { } if (!slot) { SAVEOK.t = now; SAVEOK.v = v; } return v; }
const OLDSAVE_TIP = 'Летопись велась на прежней, малой карте мира. С новой картой она несовместима — начните новое правление.';
// older saves knew five troop types: give every troop list the new keys
function migrateUnits(o, d) { if (!o || typeof o !== 'object' || (d || 0) > 6) return; if (Array.isArray(o)) { for (const v of o) migrateUnits(v, (d || 0) + 1); return; }
  if (typeof o.levy === 'number' && typeof o.spear === 'number' && typeof o.horse === 'number') { for (const t of UT) if (typeof o[t] !== 'number') o[t] = 0; return; }
  for (const k in o) { const v = o[k]; if (v && typeof v === 'object' && !(v instanceof Uint8Array)) migrateUnits(v, (d || 0) + 1); } }
function loadGame(slot) {
  const s = localStorage.getItem('sk3_save' + (slot || '')); if (!s) return false;
  const o = JSON.parse(s); if ((o.wv || 1) !== WORLD_V) throw new Error(OLDSAVE_TIP); WD = genWorld(o.seed); o.explored = unrle(o.explored, NT); o.vis = new Uint8Array(NT); if (typeof o.rngS === 'number') R.set(o.rngS); delete o.rngS; G = o;
  if (G.court && G.court.letters) for (const l of G.court.letters) if (l.ch && l.ch.some(c => typeof c.fx !== 'function')) { delete l.ch; l.answered = 1; }
  econReset(); migrateUnits(G); for (const S of G.setts) { if (S.cul === undefined) S.cul = S.owner; initEcon(S, false); }
  return true;
}
