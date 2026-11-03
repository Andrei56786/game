'use strict';
// ===== CASTLES (v3.3), part 3: talking to the household, the acts of the castle, the way in from the map =====
const K_RINS = ['Королевством', 'Кланами', 'Республикой', 'Теократией', 'Империей', 'Вольными землями'];
const kAdj = (s, f) => (f ? s.replace(/ый$/, 'ая').replace(/ий$/, 'ая') : s).toLowerCase();
const kAnd = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1] : a[0] || '');
const kDays = f => { f = Math.round(f || 0); return f + ' ' + plural(f, 'день', 'дня', 'дней'); };
function kTalk(n) { const p = n.kv; if (!p || !kV()) return; if (n.lie) { DLG.say(null, npcTitle(n) + ' спит. Будить не стоит.'); return; }
  switch (p.job) { case 'host': return kTalkHost(n); case 'lady': return kTalkLady(n); case 'heir': case 'child': return kTalkHeir(n); case 'steward': return kTalkSteward(n);
    case 'knight': return kTalkKnight(n); case 'guard': return kTalkGuard(n); case 'minstrel': return kTalkMinstrel(n); case 'priest': return kTalkPriest(n); }
  return kTalkServant(n); }
function kRumor(self) { for (let i = 0; i < 4; i++) { const r = folkRumor('out'); if (r && r.t && !(self && r.t.startsWith('Наш господин'))) return r.t; } return 'Тихо у нас, ваше величество. Слава богу.'; }
// ---------- the host ----------
function kGreetShort() { const h = KV.host, o = kOpinion(); if (!h) return 'Добро пожаловать!';
  if (h.t === 'ruler') return o >= 30 ? 'Брат мой! Добро пожаловать!' : o >= 0 ? 'Ваше величество! Какая честь.' : 'Ваше величество… Не ждали.';
  if (h.t === 'vassal') return o >= 30 ? 'Государь! Мой дом — ваш дом!' : 'Добро пожаловать, государь.';
  if (h.t === 'castellan') return h.own || h.occ ? 'Государь! Замок к вашим услугам!' : 'Добро пожаловать, ваше величество.';
  return o >= 0 ? 'Добро пожаловать в мой замок, ваше величество!' : 'Король? Что ж… добро пожаловать.'; }
function kHostLine(n) { const h = KV.host, o = kOpinion(), V = G.visit, again = V.hostDay === G.day; V.hostDay = G.day;
  if (again) return R.pick(['Чем ещё могу служить, ваше величество?', 'Слушаю вас, ваше величество.', 'Да, ваше величество?']);
  if (h.t === 'ruler') return o >= 40 ? 'Обнимает вас: «Брат мой! Мой двор — ваш двор. Говорите без церемоний.»' : o >= 0 ? 'Склоняет голову, как равный равному: «Ваше величество. Рад видеть вас при моём дворе.»' : 'Смотрит холодно: «Ваше величество. Признаться, не ждал. Что привело вас?»';
  if (h.t === 'vassal') return o >= 40 ? 'Опускается на колено: «Государь! Для моего дома нет чести выше. Всё, что есть в замке, — ваше.»' : o >= 0 ? 'Кланяется: «Государь. Замок к вашим услугам.»' : 'Кланяется — сдержанно, без улыбки: «Государь… Чем обязан?»';
  if (h.t === 'castellan') return h.own ? 'Кастелян вытягивается: «Государь! Замок цел, гарнизон на стенах, ворота на запоре.»' : h.occ ? 'Комендант отдаёт честь: «Ваше величество! Держим замок. Здешние косятся, но голову не поднимают.»'
    : h.away ? 'Управитель кланяется в пояс: «' + (h.away.fem ? 'Госпожа моя, ' : 'Господин мой, ') + h.away.name + ', в отъезде, но замок к услугам вашего величества.»'
    : kForeign(h) ? 'Управитель кланяется в пояс: «Мой государь — ' + charName(rulerOf(h.rl)) + '. ' + (rulerOf(h.rl).fem ? 'Её' : 'Его') + ' замок открыт для вашего величества.»' : 'Управитель кланяется в пояс: «Хозяина нет в замке, но замок к услугам вашего величества.»';
  if (h.t === 'baron') return o >= 20 ? 'Барон хлопает вас по плечу: «Король у меня в гостях! Эй, вина!»' : 'Барон щурится: «Король в моих стенах… Что ж, гость есть гость.»';
  return o >= 0 ? 'Кланяется учтиво: «Ваше величество — гость в моём замке. Мой государь будет польщён.»' : 'Кланяется сухо: «Ваше величество. Мой государь узнает о вашем визите.»'; }
function kTalkHost(n) { const h = KV.host, V = G.visit, ch = [], back = () => kTalkHost(n); if (!h) return;
  if (h.t === 'ruler') ch.push({ t: 'Поговорить о делах державы', tip: ['Переговоры с глазу на глаз: мир, союз, пакт, дань.', 'Личный визит и гостеприимство склоняют хозяина к согласию.'], fx: () => UI.open({ k: 'diplo', t: h.rl }) });
  if (h.t === 'vassal') { ch.push({ t: 'Как ваши земли?', fx: () => DLG.say(n, '«' + kLands() + '»', { onEnd: back }) }); ch.push({ t: 'Что говорят в знатных домах?', fx: () => kHouseMood(n) });
    if (h.H && !V.favor) ch.push({ t: 'Пожаловать дому милость (−50 зол.)', tip: ['Подарок, привилегия, место при дворе для младшего сына.', 'Верность дома ' + h.H.name + ' вырастет.'], ...payOk(50), fx: () => kFavor(n) }); }
  if (h.own || h.occ) { ch.push({ t: 'Доложите о замке', fx: () => DLG.say(n, '«' + kReport() + '»', { onEnd: back }) });
    if (!V.reward) ch.push({ t: 'Наградить гарнизон (−30 зол.)', tip: 'Двойное жалованье и бочка вина. Солдаты прославят короля, округа успокоится.', ...payOk(30), fx: () => kReward(n) }); }
  if (h.t !== 'vassal' && !h.own && !h.occ && !V.gift) { ch.push({ t: 'Преподнести дар (−40 зол.)', tip: 'Хозяин станет теплее к вам и вашей державе.', ...payOk(40), fx: () => kGift(n, 40) }); ch.push({ t: 'Щедрый дар (−80 зол.)', tip: 'Дар, о котором будут говорить. Жадным — особенно по душе.', ...payOk(80), fx: () => kGift(n, 80) }); }
  ch.push({ t: 'Какие вести?', fx: () => DLG.say(n, kNews(), { onEnd: back }) }); ch.push({ t: 'Откланяться', fx: () => { } });
  DLG.say(n, kHostLine(n), { choices: ch, esc: ch.length - 1 }); }
function kLands() { const sid = G.visit.sid, S = G.setts[sid], s = WD.setts[sid], u = G.provs[s.prov].unrest || 0;
  return 'Людей в округе — ' + fmt(S.pop) + ', живут ' + (S.prosp >= 75 ? 'богато' : S.prosp >= 55 ? 'крепко' : S.prosp >= 40 ? 'небогато' : 'бедно') + '. ' + (u > 50 ? 'Крестьяне ропщут — боюсь бунта.' : u > 25 ? 'Народ ворчит, но подати платит.' : 'Народ спокоен.') +
    ' В гарнизоне ' + voin(armyMenU(S.gar || {})) + (S.walls ? ', стены ' + ['', 'деревянные', 'каменные', 'могучие'][S.walls] : ', а стен, считай, нет') + '. Припасов — на ' + kDays(S.food) + ' осады.'; }
function kReport() { const h = KV.host, S = G.setts[G.visit.sid]; return kLands() + (h.occ && S.owner < 6 ? ' Земля-то здесь — ' + REALM_DEF[S.owner].name + ', и здешние этого не забыли.' : ''); }
function kNews() { const rl = KV.rl, pr = G.player.realm, o = [], wars = r => warsOf(r).filter(x => x < 5);
  if (rl < 5 && rl !== pr && G.realms[rl].ruler >= 0) { const w = wars(rl).filter(x => x !== pr), al = [0, 1, 2, 3, 4].filter(x => x !== rl && x !== pr && G.rel[rl][x].ally);
    o.push(w.length ? 'Мы воюем с ' + kAnd(w.map(x => K_RINS[x])) + '. Каждый меч на счету.' : 'Наши границы, хвала небу, спокойны.'); if (al.length) o.push('Союз с ' + kAnd(al.map(x => K_RINS[x])) + ' — наша опора.');
    const op = opinionOf(rl, pr); o.push('О вашем величестве у нас говорят ' + (op >= 40 ? 'с теплом' : op >= 10 ? 'с уважением' : op > -15 ? 'сдержанно' : 'с опаской') + '.'); }
  else { const w = wars(pr); o.push(w.length ? 'Все только и говорят, что о войне с ' + kAnd(w.map(x => K_RINS[x])) + '.' : 'Мир, государь, — и купцы снова ездят по дорогам.'); }
  o.push(kRumor(1)); return '«' + o.join(' ') + '»'; }
function kHouseMood(n) { const H = KV.host.H, back = () => kTalkHost(n);
  if (!H || H.loy < 55) { DLG.say(n, 'Уклончиво: «Каждый дом думает о себе, государь. Мой — не исключение.»', { onEnd: back }); return; }
  const bad = (G.houses || []).filter(x => x.alive && x !== H && x.loy < 40).sort((a, b) => a.loy - b.loy).slice(0, 2);
  DLG.say(n, bad.length ? 'Понижает голос: «Раз уж вы спросили, государь… ' + bad.map(x => 'Дом ' + x.name + (x.loy < 25 ? ' зол на корону' + ((x.amb || 0) > 60 ? ' и метит высоко' : '') : ' обижен и ворчит')).join('. ') + '. Я бы присмотрел за ними.»' : '«Все дома верны вам, государь. По крайней мере, на словах.»', { onEnd: back }); }
function kFavor(n) { const V = G.visit, H = KV.host.H; if (!H || !spend(50)) return; V.favor = 1; houseLoy(H, 6); kPts(2); Snd.sfx('coin');
  log('Король пожаловал милость дому ' + H.name + ' (замок ' + WD.setts[V.sid].name + ').', 'good');
  DLG.say(n, R.pick(['«Государь! Дом ' + H.name + ' не забудет вашей щедрости — ни я, ни мои дети.»', '«Это больше, чем я смел просить, государь. Мой меч — ваш.»'])); }
function kReward(n) { const V = G.visit; if (!spend(30)) return; V.reward = 1; provUnrest(V.sid, -3); prestige(1); Snd.sfx('cheer');
  DLG.say(n, 'Гарнизон строится во дворе. Весть о двойном жалованье встречают рёвом: «Слава королю!»'); }
function kGift(n, g) { const V = G.visit, h = KV.host, pr = G.player.realm; if (!spend(g)) return; V.gift = 1; Snd.sfx('coin');
  const c = h.c || h.away, greedy = !!c && (c.traits || []).includes('greedy'); let v = g >= 80 ? 12 : 6; if (greedy) v *= 1.5; if (h.t !== 'ruler') v *= 0.5; v = Math.round(v);
  if (kForeign(h)) addOpn(h.rl, pr, v); else if (h.rl === 5) { const m = kMem(V.sid); m.opn = clamp((m.opn || 0) + v * 2, -50, 60); } kPts(g >= 80 ? 3 : 2);
  DLG.say(n, greedy ? 'Глаза хозяина загораются: «Какая щедрость! Ваше величество умеет дружить.»' : h.t === 'castellan' ? '«Я передам ваш дар господину, ваше величество. Он будет тронут.»' : '«Благодарю, ваше величество. Ваш дар займёт почётное место в сокровищнице.»'); }
// ---------- the family ----------
function kTalkLady(n) { const V = G.visit, h = KV.host, ch = [], back = () => kTalkLady(n);
  if (h && h.c) ch.push({ t: 'Расскажите о ' + (h.c.fem ? 'вашей супруге' : 'вашем супруге'), fx: () => kGossip(n) });
  if (V.compl !== G.day) ch.push({ t: 'Сказать любезность', fx: () => { V.compl = G.day; kPts(1); DLG.say(n, n.c.fem ? R.pick(['Улыбается: «Ваше величество умеет польстить. У нас так не говорят.»', 'Смеётся: «Ах, государь! Теперь я понимаю, почему о вас столько говорят.»', 'Чуть краснеет: «Вы слишком добры, ваше величество.»']) : 'Кланяется: «Благодарю, ваше величество. Это честь для нашего дома.»', { onEnd: back }); } });
  ch.push({ t: 'Что нового в замке?', fx: () => DLG.say(n, '«' + kRumor(1) + '»', { onEnd: back }) }); ch.push({ t: 'Прощайте', fx: () => { } });
  DLG.say(n, n.c.fem ? R.pick(['Приседает в реверансе: «Ваше величество! Надеюсь, вам у нас по нраву.»', 'Изящно кланяется: «Ваше величество. Какая радость для нашего дома.»']) : 'Кланяется: «Ваше величество. Добро пожаловать.»', { choices: ch, esc: ch.length - 1 }); }
function kGossip(n) { const h = KV.host, c = h.c, pr = G.player.realm, he = c.fem ? 'она' : 'он', tr = (c.traits || []).filter(t => TRAITS[t]).map(t => kAdj(TRAITS[t].n, c.fem)), P = ['«' + (c.fem ? 'Моя супруга' : 'Мой супруг') + (tr.length ? ' — ' + kAnd(tr) + '.' : ' — человек непростой.')];
  if (kForeign(h) && h.t === 'ruler') { const L = opinionBreakdown(h.rl, pr).filter(l => l.t !== 'Отношения' && l.v), pos = L.filter(l => l.v > 0).sort((a, b) => b.v - a.v).slice(0, 2), neg = L.filter(l => l.v < 0).sort((a, b) => a.v - b.v).slice(0, 2), o = opinionOf(h.rl, pr), f = l => l.t.toLowerCase() + ' (' + (l.v > 0 ? '+' : '−') + Math.abs(l.v) + ')';
    P.push('О вас ' + he + ' думает так: ' + (o >= 40 ? 'вы друг.' : o >= 10 ? 'вы скорее друг.' : o > -15 ? 'ни друг, ни враг.' : 'вы опасный сосед.') + (pos.length ? ' В вашу пользу — ' + pos.map(f).join(', ') + '.' : '') + (neg.length ? ' Против — ' + neg.map(f).join(', ') + '.' : '') + '»'); }
  else if (h.t === 'vassal' && h.H) { const H = h.H; P.push((H.loy >= 70 ? 'Верен' : H.loy >= 45 ? 'Служит вам честно, хоть и ворчит порой о податях' : 'Боюсь, обижен' + (c.fem ? 'а' : '') + ' на корону: мало милостей видел наш дом') + (H.loy >= 70 ? (c.fem ? 'на' : '') + ' вам, государь, как скала.' : '.') + ((H.amb || 0) > 60 ? ' И честолюбив' + (c.fem ? 'а' : '') + ' без меры, скажу по секрету.' : '') + '»'); }
  else P.push((kOpinion() >= 0 ? 'Вас ' + he + ' уважает, ваше величество.' : 'Вас ' + he + ' побаивается, государь, — простите за прямоту.') + '»');
  DLG.say(n, 'Понижает голос. ' + P.join(' '), { onEnd: () => kTalkLady(n) }); }
function kTalkHeir(n) { const p = n.kv, V = G.visit, h = KV.host, par = h && h.c && h.c.fem ? 'Матушка' : 'Отец', ch = [];
  if (p.job === 'child') { DLG.say(n, R.pick(['Таращит глаза: «Вы правда король? А где корона?»', '«А у вас есть дракон? У настоящего короля должен быть дракон!»', 'Прячется за колонну, потом выглядывает: «Ваше величество… а можно потрогать меч?»']), { choices: [
    { t: 'Показать меч', fx: () => DLG.say(n, 'Восторженно ахает. Кажется, этот день запомнится на всю жизнь.') }, { t: 'Погладить по голове', fx: () => { if (V.kid !== G.day) kPts(1); V.kid = G.day; DLG.say(n, 'Сияет и убегает хвастаться.'); } }], esc: 1 }); return; }
  ch.push({ t: 'О чём мечтаете?', fx: () => DLG.say(n, n.c.fem ? R.pick(['«Увидеть столичный двор! Говорят, там пиры до утра.»', '«' + par + ' уже ищет мне жениха. А я бы читала книги — и чтобы никто не мешал.»', '«Завести своего сокола. Охотиться не хуже братьев!»']) : R.pick(['«Водить войска! Или хотя бы сразиться на турнире.»', '«' + par + ' говорит: сперва учёба, потом подвиги. А я бы — наоборот.»', '«Увидеть столицу. Говорят, там турниры чуть не каждый месяц.»']), { onEnd: () => kTalkHeir(n) }) });
  if (!n.c.fem && V.spar !== G.day) ch.push({ t: 'Сразиться на учебных мечах', tip: 'Юнец рвётся в бой. Победа — слава, поражение — конфуз.', fx: () => kSpar(n, 4 + Math.min(8, Math.max(0, n.c.age - 12))) });
  ch.push({ t: 'Прощайте', fx: () => { } });
  DLG.say(n, n.c.fem ? 'Делает реверанс: «Ваше величество! ' + par + ' столько о вас рассказывал' + (par === 'Матушка' ? 'а' : '') + '.»' : 'Кланяется — неловко, но гордо: «Ваше величество! Говорят, вы лучший боец королевства?»', { choices: ch, esc: ch.length - 1 }); }
// ---------- the household ----------
function kTalkSteward(n) { const V = G.visit, mine = KV.rl === G.player.realm, ch = [], back = () => kTalkSteward(n);
  ch.push({ t: 'Как припасы замка?', fx: () => (mine || V.bribe ? kStores(n) : DLG.say(n, 'Учтиво улыбается: «Хозяйство в порядке, ваше величество. Подробности, простите, — дело моего господина.»', { onEnd: back })) });
  if (!mine && !V.bribe) ch.push({ t: 'Сунуть кошель (−15 зол.)', tip: 'Ключник знает, сколько в замке солдат и хлеба. Если захочет сказать…', ...payOk(15), fx: () => kBribe(n) });
  ch.push({ t: 'Что на ужин?', fx: () => DLG.say(n, '«Сегодня — ' + kDish() + '. Обед — после полудня, ужин — на закате.»', { onEnd: back }) }); ch.push({ t: 'Ступайте', fx: () => { } });
  DLG.say(n, R.pick(['Кланяется, звякнув ключами: «Чем могу служить, ваше величество?»', '«Ваше величество! Покои для вас готовы, постель согрета.»']), { choices: ch, esc: ch.length - 1 }); }
function kStores(n) { const S = G.setts[G.visit.sid];
  DLG.say(n, '«В гарнизоне ' + voin(armyMenU(S.gar || {})) + '. ' + (S.walls ? 'Стены ' + ['', 'деревянные, давно не чинены', 'каменные, крепкие', 'могучие — таран зубы обломает'][S.walls] : 'Стен, считайте, нет') + '. Припасов — на ' + kDays(S.food) + ' осады.»', { onEnd: () => kTalkSteward(n) }); }
function kBribe(n) { const V = G.visit; if (!spend(15)) return; V.bribe = 1; Snd.sfx('coin'); DLG.say(n, 'Кошель исчезает в рукаве. Ключник оглядывается и понижает голос…', { onEnd: () => kStores(n) }); }
function kTalkKnight(n) { const p = n.kv, V = G.visit, ch = [];
  ch.push({ t: 'Как служба?', fx: () => kArmyTalk(n) });
  if (V.spar !== G.day) ch.push({ t: 'Учебный поединок', tip: 'Скрестить учебные мечи на глазах у всего замка. Победа — слава, поражение — конфуз.', fx: () => kSpar(n, p.sk || 8) });
  ch.push({ t: 'Вольно', fx: () => { } });
  DLG.say(n, p.j ? 'Рыцарь кладёт руку на сердце: «Ваше величество!»' : 'Начальник стражи кланяется: «Ваше величество! Замок под охраной — спите спокойно.»', { choices: ch, esc: ch.length - 1 }); }
function kArmyTalk(n) { const rl = KV.rl, pr = G.player.realm, S = G.setts[G.visit.sid], back = () => kTalkKnight(n);
  if (rl === pr) return DLG.say(n, '«Гарнизон — ' + voin(armyMenU(S.gar || {})) + '. Учим новобранцев, чиним стены. Дай бог, не пригодится.»', { onEnd: back });
  if (rl >= 5) return DLG.say(n, '«Барон держит ' + voin(armyMenU(S.gar || {})) + ' — и никому не кланяется.»', { onEnd: back });
  const m = G.armies.filter(a => a.alive && a.realm === rl && a.kind !== 'caravan' && a.kind !== 'bandit').reduce((s, a) => s + armyMen(a), 0), r = Math.max(100, Math.round(m / 500) * 500);
  DLG.say(n, m > 0 ? 'Хвастается: «Под знамёнами нашего государя — около ' + voin(r) + ', и все рвутся в бой!»' : '«Войско распущено по домам, ваше величество. Мирное время.»', { onEnd: back }); }
function kSpar(n, sk) { const V = G.visit, k = kingC(); if (V.spar === G.day) { DLG.say(n, '«На сегодня хватит, государь: руки уже не держат меч.»'); return; }
  if (k.wound > G.day) { DLG.say(n, '«Ваша рана ещё не зажила, государь. Лекарь мне голову снимет.»'); return; }
  if (sickNot(k)) { DLG.say(n, '«Вы нездоровы, государь. Сначала поправьтесь — тогда и скрестим мечи.»'); return; }
  V.spar = G.day; const win = (k.mar || 8) + R.i(0, 8) >= sk + R.i(0, 8); Snd.sfx('hit'); kPts(1); prestige(win ? 1 : -1); say(n, win ? 'Сдаюсь!' : 'Туше!', 2.5);
  DLG.say(n, ['Учебные мечи. Звон, пыль, крики зевак…', win ? R.pick(['Ваш клинок выбивает меч противника. «Сдаюсь, государь! Рука у вас тяжёлая.»', 'Обманный выпад — и ваш меч у его горла. «Вот это удар! Внукам расскажу.»'])
    : R.pick(['Противник ловко уходит и касается вашего плеча. «Простите, государь… Туше.»', 'Удар — и вы на земле. Зеваки замирают. Противник протягивает руку: «Ещё раз, государь?»'])], { name: 'Учебный поединок' }); }
function kTalkGuard(n) { DLG.say(n, R.pick(['Вытягивается в струнку: «Ваше величество!»', 'Стучит древком об пол: «Ваше величество! На посту без происшествий!»']), { choices: [{ t: 'Что слышно?', fx: () => DLG.say(n, '«' + kRumor() + '»') }, { t: 'Вольно', fx: () => { } }], esc: 1 }); }
function kTalkServant(n) { const p = n.kv, mem = kMem(G.visit.sid), ch = [];
  const hi = { cook: 'Вытирает руки о фартук: «Ваше величество! Сегодня у нас ' + kDish() + '!»', servant: R.pick(['Низко кланяется: «Ваше величество! Чего изволите?»', 'Чуть не роняет поднос: «Ваше величество! Простите…»']), groom: '«Ваших коней, государь, накормили и вычистили. Добрые кони!»', smith: 'Отрывается от наковальни: «Государь! Для вашего коня — лучшие подковы!»' }[p.job] || 'Кланяется: «Ваше величество!»';
  ch.push({ t: 'Что говорят в замке?', fx: () => DLG.say(n, '«' + kRumor() + '»') });
  if (mem.coin !== G.day) ch.push({ t: 'Дать монету (1 зол.)', ...payOk(1), fx: () => { if (!spend(1)) return; mem.coin = G.day; Snd.sfx('coin'); DLG.say(n, R.pick(['«Спасибо, ваше величество! Век буду помнить!»', 'Монета мигом исчезает в кулаке. «Храни вас бог, государь!»'])); } });
  ch.push({ t: 'Ступай', fx: () => { } }); DLG.say(n, hi, { choices: ch, esc: ch.length - 1 }); }
function kTalkMinstrel(n) { const V = G.visit, pr = (G.court && G.court.prestige) || 0, ch = [];
  if (V.song !== G.day) ch.push({ t: 'Спой для нас (−5 зол.)', ...payOk(5), fx: () => { if (!spend(5)) return; V.song = G.day; kPts(1); Snd.sfx('strum'); say(n, 'Ла-ла-ла…', 3);
    DLG.say(n, ['Менестрель ударяет по струнам…', pr >= 30 ? '«…И дрогнули стены, и пали враги, когда наш король обнажил свой клинок!» Зал подхватывает припев.' : R.pick(['«…Ах, лето короткое, долгая ночь…» Дамы утирают слёзы.', '«…Был рыцарь отважен, а конь его бел…» Кто-то в зале подпевает.'])]); } });
  ch.push({ t: 'Ступай', fx: () => { } }); DLG.say(n, '«Ваше величество! Песню? Балладу? Что-нибудь весёлое?»', { choices: ch, esc: ch.length - 1 }); }
function kTalkPriest(n) { const V = G.visit, T = KMAP.key === 'T', ch = [];
  if (V.bless !== G.day) ch.push({ t: 'Благословите, отче', fx: () => { V.bless = G.day; Snd.sfx('choir'); if (T) kPts(2); DLG.say(n, T ? 'Брат осеняет вас знамением: «Да хранит тебя Господь, король. Здесь помнят смиренных.»' : 'Капеллан осеняет вас знамением: «Да хранит вас Господь, сын мой, — и в бою, и в совете.»'); } });
  ch.push({ t: 'Какие вести?', fx: () => DLG.say(n, '«' + kRumor() + '»') }); ch.push({ t: 'Прощайте', fx: () => { } });
  DLG.say(n, T ? '«Мир тебе, король. Господь видит всех — и королей, и нищих.»' : '«Мир вам, ваше величество. Часовня всегда открыта.»', { choices: ch, esc: ch.length - 1 }); }
// ---------- the acts of the castle ----------
ACTS_EXT.k_exit = () => DLG.say(null, 'Свита ждёт у ворот, кони осёдланы.', { choices: [{ t: 'Уехать к войску', fx: () => visitLeave() }, { t: 'Остаться', fx: () => { } }], esc: 1 });
ACTS_EXT.k_dine = () => { const V = G.visit, h = hourAbs(), sp = LOCS.k_hall && LOCS.k_hall.spots.k_kseat, host = kHostNpc(), H = KV.host; if (!sp || !V) return;
  if (!kDinner()) { DLG.say(null, h < 12.5 ? 'Высокий стол пуст. Обед — после полудня, когда протрубят в рог.' : h < 18.5 ? 'Слуги перестилают скатерти. Ужин — на закате.' : 'Трапеза окончена; слуги убирают со стола.', { name: 'Высокий стол' }); return; }
  sitAt(sp); const here = host && !host.away && host.loc === 'k_hall';
  if (h >= 18.5 && V.dine !== G.day) { V.dine = G.day; kBonus(3, 3); kPts(3); Snd.sfx('clink'); UI.toast('Ужин за высоким столом: ' + kDish() + '.');
    if (here) say(host, H && H.t === 'ruler' ? R.pick(['За мир между нашими державами!', 'За здоровье моего царственного гостя!']) : H && (H.t === 'vassal' || H.own || H.occ) ? R.pick(['За короля!', 'Да здравствует король!']) : R.pick(['Выпьем за нашего гостя!', 'За здоровье короля!']), 4.5); }
  else if (h < 14 && V.lunch !== G.day) { V.lunch = G.day; kPts(1); UI.toast('Обед за высоким столом: ' + kDish() + '.'); if (here) say(host, 'Прошу, ваше величество, отведайте!', 3.5); } };
ACTS_EXT.k_bed = () => { const V = G.visit, h = hourAbs(), sp = LOCS.k_guest && LOCS.k_guest.spots.k_bed; if (!sp || !V) return; const ch = [];
  if (h >= 18.5 || h < 6) ch.push({ t: 'Лечь спать до утра', fx: () => { V.sleepFrom = h < 6 ? G.day - 1 : G.day; sleepUntil(6.5 + 24 * (h >= 6 ? 1 : 0), sp); } });
  ch.push({ t: 'Отдохнуть пару часов', fx: () => sleepUntil(h + 2, sp) }); ch.push({ t: 'Не сейчас', fx: () => { } });
  DLG.say(null, 'Гостевая постель: пуховые перины, полог, на столике — кувшин с вином.', { choices: ch, esc: ch.length - 1 }); };
ACTS_EXT.k_well = () => UI.toast(R.pick(['Вода в колодце студёная, с привкусом железа.', 'Глубокий колодец: далеко внизу блестит вода.']));
ACTS_EXT.k_stable = () => UI.toast('Королевские кони стоят в лучших стойлах. Конюх своё дело знает.');
ACTS_EXT.k_kitchen = () => UI.toast('Из кухни пахнет: ' + kDish() + '.');
ACTS_EXT.k_forge = () => UI.toast('Кузнец правит подковы и наконечники для копий.');
ACTS_EXT.k_granary = () => { const V = G.visit; UI.toast(KV.rl === G.player.realm || V.bribe ? 'Амбар: запасов на ' + kDays(G.setts[V.sid].food) + ' осады.' : 'Амбар заперт на тяжёлый замок.'); };
ACTS_EXT.k_barracks = () => { const V = G.visit; UI.toast(KV.rl === G.player.realm || V.bribe ? 'Казармы: в гарнизоне ' + voin(armyMenU(G.setts[V.sid].gar || {})) + '.' : 'Солдаты играют в кости и смолкают, завидев короля.'); };
ACTS_EXT.k_chapel = () => { const V = G.visit, T = KMAP.key === 'T'; if (V.pray === G.day) { UI.toast('Вы уже молились сегодня.'); return; } V.pray = G.day; Snd.sfx('choir'); if (T) kPts(1);
  DLG.say(null, T ? 'Король преклоняет колени в часовне. Братья замка видят это — и одобрительно переглядываются.' : 'Король преклоняет колени. Тишина, запах воска, цветные блики витража.', { name: 'Часовня' }); };
ACTS_EXT.k_dove = () => UI.toast('Голуби воркуют. Отсюда шлют вести в столицу и к соседям.');
ACTS_EXT.k_fount = () => DLG.say(null, 'Фонтан во дворе. На дне блестят монеты.', { choices: [{ t: 'Бросить монету (1 зол.)', ...payOk(1), fx: () => { if (!spend(1)) return; Snd.sfx('coin'); UI.toast('Монета звякнула о дно. Загадайте желание…'); } }, { t: 'Отойти', fx: () => { } }], esc: 1 });
ACTS_EXT.k_kennel = () => UI.toast('Гончие рвутся с цепей и лают. Хозяин знает толк в охоте.');
ACTS_EXT.k_dummy = () => { const P = COURT.p, d = m => Math.hypot(m.x - P.x, m.y - P.y), n = COURT.npcs.filter(m => m.kv && m.kv.job === 'knight' && !m.away && !m.lie && m.loc === COURT.loc).sort((a, b) => d(a) - d(b))[0];
  if (n && d(n) < 200) DLG.say(null, 'Учебный двор: чучела, мишени, затупленные мечи на стойке.', { choices: [{ t: 'Вызвать на поединок: ' + npcTitle(n), ok: () => G.visit.spar !== G.day, why: 'Сегодня вы уже сражались.', fx: () => kSpar(n, n.kv.sk || 8) }, { t: 'Отойти', fx: () => { } }], esc: 1 });
  else UI.toast('Учебные чучела изрублены в щепу. Без противника скучно.'); };
// ---------- the way in: a button in the settlement window ----------
function kEnterBtn(sid, X, Y, WW, near, host) { const S = G.setts[sid], pa = playerArmy(), rl = S.ctrl, pr = G.player.realm; if (!pa || rl === 6 || sid === G.realms[pr].capital) return;
  const capOf = rl < 5 && rl !== pr && G.realms[rl].capital === sid, mine = rl === pr;
  const why = !near ? 'Войско далеко — подойдите ближе.' : host ? 'Война: ворота для вас закрыты.' : S.siege ? 'Замок в осаде.' : G.atCourt ? 'Король при дворе.' : pa.siegeOf >= 0 ? 'Войско ведёт осаду.'
    : rl >= 1 && rl <= 4 && !mine && G.realms[rl].ruler >= 0 && opinionOf(rl, pr) < -40 ? 'Хозяин не желает вас видеть.' : '';
  sbtn('s_kvisit', X + WW - 20 - 120, Y + 8, 120, capOf ? 'Визит ко двору' : mine ? 'Погостить в замке' : 'Посетить замок', () => { UI.shut(); visitEnter('castle', sid, 'royal'); }, { style: 'parch', disabled: !!why,
    tip: why || (capOf ? ['Правитель примет вас при своём дворе: беседа, ужин за высоким столом, ночлег.', 'Личный визит облегчит переговоры.'] : mine ? ['Хозяин замка примет короля: вести о землях, настроения знати.', 'Время идёт, войско ждёт у ворот.'] : ['Король со свитой въезжает в замок.', 'Хозяин окажет гостеприимство. Время идёт, войско ждёт у ворот.']) }); }
// ---------- register ----------
SITE_KIND.castle = { build: kBuild, arrive: () => 'k_arrive', populate: kPopulate, update: kUpdate, enter: kEnter, leave: kLeave, title: kTitle };
