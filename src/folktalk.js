'use strict';
// ===== FOLK TALK (v3.3): talking to the people — the headman and his worries, the tavern, honest words about the king, rumours, the festival =====
const gold0 = () => G.realms[0].gold;
const payOk = g => ({ ok: () => gold0() >= g, why: 'Не хватает золота.' });
const folkS = () => G.setts[G.visit.sid], folkW = () => WD.setts[G.visit.sid];
const folkPlace = () => (folkW().type === 'village' ? 'деревня' : 'город');
const folkDir = (dx, dy) => (Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'к северу' : 'к югу') : (dx < 0 ? 'к западу' : 'к востоку'));
const folkSir = () => (folkIncog() ? R.pick(['путник', 'мил человек', 'добрый человек']) : 'государь');
// ---------- what the folk think of the king (−100…100) and why ----------
function folkOpinion(sid) { const S = G.setts[sid], P = G.provs[WD.setts[sid].prov], C = G.court || {}, own = S.ctrl === G.player.realm, k = kingC(), tr = k.traits || [], mem = folkMem(sid);
  let v = (C.prestige || 0) * 0.45 + (S.prosp - 55) * 0.5 - (P.unrest || 0) * 0.55 - ((C.taxK || 1) - 1) * 70 - warsOf(G.player.realm).filter(r => r < 5).length * 6 + (mem.mood || 0);
  if (!own) v -= 25; if (G.day - (S.lootDay || -99) < 120) v -= 30;
  for (const [t, d] of [['honest', 6], ['generous', 8], ['wise', 4], ['brave', 4], ['greedy', -8], ['wrathful', -5], ['craven', -6], ['proud', -2]]) if (tr.includes(t)) v += d;
  return clamp(Math.round(v), -100, 100); }
function folkWhy(sid) { const S = G.setts[sid], P = G.provs[WD.setts[sid].prov], C = G.court || {}, own = S.ctrl === G.player.realm, k = kingC(), tr = k.traits || [], o = [], wars = warsOf(G.player.realm).filter(r => r < 5);
  if (!own) o.push([30, 'Чужой он нам король. Своего бы прокормить.']);
  if (G.day - (S.lootDay || -99) < 120) o.push([40, 'Его солдаты тут прошлись — ни кур, ни зерна не осталось. Такое не забывают.']);
  if ((C.taxK || 1) > 1.05) o.push([28, 'Подати душат: последнее зерно со двора выгребают.']); else if ((C.taxK || 1) < 0.95) o.push([22, 'Подати он снизил — дай ему бог здоровья.']);
  if (wars.length) o.push([18 + wars.length * 4, 'Война эта… с ' + wars.map(r => REALM_DEF[r].name).join(' и ') + '. Сыновей забирают, а за что — никто толком не знает.']);
  if ((P.unrest || 0) > 45) o.push([P.unrest * 0.6, 'Народ ропщет. Того и гляди, за вилы возьмутся.']);
  if (S.prosp >= 72) o.push([16, 'Грех жаловаться: урожай собрали, на торгу шумно.']); else if (S.prosp < 40) o.push([20, 'Бедно живём. Детей кормить нечем.']);
  if ((C.prestige || 0) >= 30) o.push([18, 'Говорят, король наш крепок — соседи его побаиваются.']); else if ((C.prestige || 0) <= -25) o.push([18, 'Про двор такое рассказывают — срам один. Над нашим королём, говорят, соседи смеются.']);
  const T = { honest: 'Слово, говорят, держит. Это редкость.', generous: 'Щедрый, говорят. Нищим подаёт.', wise: 'Умён, говорят, — с ним и мудрецы советуются.', brave: 'Сам в бой ходит, за спинами не прячется.', greedy: 'Жаден, говорят: казна ему дороже людей.', wrathful: 'Крут нравом — лучше ему на глаза не попадаться.', craven: 'Трусоват, говорят. Войны боится как огня.', proud: 'Гордый очень. С простым народом и словом не перемолвится.', cunning: 'Хитёр. Не поймёшь, что у него на уме.' };
  for (const t of tr) if (T[t]) o.push([12, T[t]]);
  if (!o.length) o.push([5, 'Король как король. Нас не трогает — и ладно.']);
  return o.sort((a, b) => b[0] - a[0]).map(x => x[1]); }
function folkOpinionLine(n) { const sid = G.visit.sid, v = folkOpinion(sid), why = folkWhy(sid), k = kingC();
  const head = v >= 40 ? R.pick(['Король у нас добрый, дай ему бог здоровья.', 'Хороший король. Дед мой таких не помнил.']) : v >= 10 ? R.pick(['Да что король… Жить можно.', 'Король как король. Бывали и хуже.']) : v > -25 ? R.pick(['Король? Хм… Всякое говорят.', 'Не знаю, что и сказать, ' + folkSir() + '.']) : R.pick(['Король?! Тьфу. Простите, но так думают многие.', 'Чтоб ему пусто было, королю этому. Ой… вы ведь не донесёте?']);
  return head + ' ' + why.slice(0, 2).join(' ') + (n && n.c.age > 60 && k.age > 40 ? ' А помню его ещё мальчишкой — вот время-то летит.' : ''); }
// ---------- rumours ----------
function folkRumor(ctx) { const V = G.visit, sid = V.sid, s = WD.setts[sid], S = G.setts[sid], o = [], told = (V.told = V.told || []);
  for (const a of G.armies) { if (!a.alive) continue; const d = Math.hypot(a.x - s.x, a.y - s.y);
    if (a.kind === 'bandit' && d < 10) o.push(['b' + a.id, 'В лесах ' + folkDir(a.x - s.x, a.y - s.y) + ' отсюда объявилась шайка — ' + voin(armyMen(a)) + '. ' + (charOf(a.gen) ? 'Атаман у них — ' + charOf(a.gen).name + '.' : '') + ' Поодиночке туда не ходите.']);
    else if (a.realm < 5 && a.realm !== G.player.realm && a.kind !== 'caravan' && d < 12 && !(typeof kV === 'function' && kV() && a.realm === KV.rl)) o.push(['a' + a.id, 'Видели войско — ' + REALM_DEF[a.realm].name + ', ' + folkDir(a.x - s.x, a.y - s.y) + ', дня два пути. Говорят, ' + (armyMen(a) > 1500 ? 'тьма-тьмущая' : 'тысячи под две') + '.' + (hostile(G.player.realm, a.realm) ? ' Не к добру это.' : '')]); }
  const near = WD.setts.filter(t => t.id !== sid && Math.hypot(t.x - s.x, t.y - s.y) < 16 && G.setts[t.id].ctrl < 6);
  for (const k of ['food', 'weap', 'horses']) { const here = priceOf(S, k); let best = null; for (const t of near) { const p = priceOf(G.setts[t.id], k); if (p < here * 0.7 && (!best || p < best[1])) best = [t, p]; }
    if (best) o.push(['p' + k + best[0].id, { food: 'Хлеб', weap: 'Оружие', horses: 'Кони' }[k] + ' в ' + best[0].name + ' дешёвые — вдвое против здешнего. Туда бы обоз снарядить.']); }
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) if (a !== G.player.realm && b !== G.player.realm && G.rel[a][b].war) o.push(['w' + a + b, 'Купцы сказывают: ' + REALM_DEF[a].name + ' и ' + REALM_DEF[b].name + ' воюют. Пусть их, лишь бы к нам не пришли.']);
  const lord = S.lord >= 0 && charOf(S.lord); if (lord && lord.alive) o.push(['l', 'Наш господин, ' + lord.name + ', ' + ((lord.traits || []).includes('greedy') ? 'три шкуры дерёт.' : (lord.traits || []).includes('generous') ? 'человек незлой — в голод амбары открыл.' : 'бывает у нас редко. Оно и к лучшему.')]);
  const sea = seasonOf(G.day); o.push(['s' + sea, ['Весна поздняя — сеять бы, а земля холодная.', 'Лето жаркое. Если дождя не будет — хлеба погорят.', 'Урожай нынче так себе. Зимой туго придётся.', 'Зима лютая. Волки к самым дворам подходят.'][sea]]);
  // the court's secrets travel far: a merchant from the capital, a drunk soldier…
  const C = G.court; if (ctx === 'tav' && folkIncog() && C && C.secrets) { const sc = C.secrets.filter(x => !x.known && x.k !== 'love'); if (sc.length && R.f() < 0.35 && !V.secretDay) { V.secretDay = G.day; return { secret: R.pick(sc) }; } }
  const fresh = o.filter(x => !told.includes(x[0])), pick = fresh.length ? R.pick(fresh) : R.pick(o); if (!told.includes(pick[0])) told.push(pick[0]); return { t: pick[1] }; }
function folkSayRumor(n, ctx, pre) { const r = folkRumor(ctx); if (r.secret) { DLG.say(n, (pre || '') + 'Наклоняется ближе: «Слыхал я от одного купца из столицы… только — тсс!»', { onEnd: () => revealSecret(r.secret, 'подслушано в ' + (folkW().type === 'village' ? 'корчме' : 'таверне')) }); return; } DLG.say(n, (pre || '') + r.t); }
function folkNews() { const o = [], C = G.court || {}, pr = G.player.realm, wars = warsOf(pr).filter(r => r < 5);
  if (wars.length) o.push('Королевство воюет с ' + wars.map(r => REALM_DEF[r].name).join(' и ') + '! Мужики, точите косы!'); else o.push('Мир с соседями! Торгуйте спокойно!');
  if ((C.taxK || 1) < 0.95) o.push('Указ короля: подати снижены!'); else if ((C.taxK || 1) > 1.05) o.push('Указ короля: подати повышены!');
  const h = typeof heirOf === 'function' && heirOf(); if (h) o.push('Наследник престола — ' + h.name + '! Многая лета!');
  if (C.feastDay > G.day) o.push('В столице готовят королевский пир!'); if (typeof tourT === 'function' && tourT()) o.push('На королевском ристалище — турнир! Рыцари, к барьеру!');
  o.push('Ярмарка — в последний день недели! Привозите товары!'); return R.pick(o); }
// ---------- recognised! ----------
function folkRecog(n) { const V = G.visit, mem = folkMem(V.sid), S = folkS(); if (!folkIncog() || n.c.age < 14) return false;
  V.talks = (V.talks || 0) + 1; const sharp = ['gate', 'hallg', 'burg', 'priest', 'keeper', 'headman', 'clerk'].includes(n.folk.job);
  let ch = 0.015 + 0.02 * Math.max(0, V.talks - 2); if (sharp) ch *= 2.2; if (S.ctrl !== G.player.realm) ch *= 0.5; if ((kingC().traits || []).includes('cunning')) ch *= 0.7;
  if (R.f() >= ch) return false;
  const host = hostile(G.player.realm, S.ctrl);
  if (host) { DLG.say(n, 'Вглядывается вам в лицо — и бледнеет: «Да ведь это… вражий король! Стража! Стра-ажа!»', { name: n.c.name, choices: [{ t: 'Бежать к коням!', fx: () => { const nm = folkW().name; visitLeave(1); UI.toast('Едва унесли ноги! Погоня отстала только у леса.'); log('Короля узнали в ' + nm + ' — пришлось спасаться бегством.', 'bad'); } }] }); return true; }
  DLG.say(n, 'Вдруг замирает и вглядывается вам в лицо: «Постой-ка… Лицо-то знакомое… Батюшки! Да ведь это сам король!»', { name: n.c.name, choices: [
    { t: 'Признаться', tip: 'Конец тайного визита. Народ будет рад, что король ходит среди простых людей.', fx: () => folkReveal(n, 1) },
    { t: 'Отшутиться: «Похож, говорят. Мне часто это говорят»', tip: 'Может, поверят… а может, и нет.', fx: () => { if (R.f() < 0.55 + ((kingC().traits || []).includes('cunning') ? 0.2 : 0)) { DLG.say(n, 'Смеётся: «И правда, куда королю в таком плаще! Ну, бывай, путник».'); V.talks = 0; } else { DLG.say(n, '«Не морочь голову — я короля на ярмарке видел, как тебя сейчас!»', { onEnd: () => folkReveal(n, 0) }); } } }], esc: 1 });
  return true; }
function folkReveal(n, honest) { const V = G.visit, mem = folkMem(V.sid); V.how = 'royal'; folkDisguise(false); mem.mood = clamp((mem.mood || 0) + (honest ? 5 : 2), -50, 50); prestige(1);
  UI.toast('Весть разнеслась мигом: король здесь!'); log('В ' + folkW().name + ' узнали короля, гулявшего неузнанным. Народ дивится: король ходит среди простых людей!', 'good');
  for (const m of COURT.npcs) if (m.folk && !m.away && m.loc === COURT.loc && Math.hypot(m.x - COURT.p.x, m.y - COURT.p.y) < 120) say(m, R.pick(FOLK_CHAT.royal), 3.5); }
// ---------- who says what ----------
function folkTalk(n) { const p = n.folk; if (!p) return; if (n.lie) { DLG.say(null, n.c.name + ' крепко спит. Будить не стоит.'); return; }
  if (folkRecog(n)) return; const mem = folkMem(G.visit.sid); mem.met[p.k] = G.day;
  switch (p.job) { case 'headman': case 'burg': return folkIncog() ? folkTalkCommon(n) : folkTalkBoss(n); case 'keeper': return folkTalkKeeper(n); case 'maid': return folkTalkMaid(n);
    case 'priest': return folkTalkPriest(n); case 'herb': return folkTalkHerb(n); case 'bard': return folkTalkBard(n); case 'crier': return DLG.say(n, '«Слушайте! Слушайте! ' + folkNews() + '»');
    case 'stall': case 'shop': case 'baker': return folkTalkTrader(n); case 'gate': case 'hallg': return folkTalkGuard(n); case 'guest': return folkTalkGuest(n); case 'kid': return folkTalkKid(n);
    case 'elder': return folkTalkElder(n); case 'smith': return folkTalkSmith(n); }
  return folkTalkCommon(n); }
function folkTalkCommon(n) { const incog = folkIncog(), p = n.folk, mem = folkMem(G.visit.sid), v = folkOpinion(G.visit.sid);
  const hi = incog ? R.pick(['Здравствуй, путник. Издалека?', 'Чего тебе, мил человек?', 'Доброго дня, добрый человек.']) : (v < -30 ? 'Кланяется — без особой радости. «Ваше величество…»' : R.pick(['Низко кланяется: «Ваше величество! Вот уж не чаяли…»', 'Срывает шапку: «Государь! Храни вас Бог!»']));
  const ch = [];
  if (incog) { ch.push({ t: 'Что говорят о короле?', fx: () => DLG.say(n, folkOpinionLine(n)) }); ch.push({ t: 'Какие новости?', fx: () => folkSayRumor(n, 'out') }); }
  else { ch.push({ t: 'Как живётся?', fx: () => DLG.say(n, v >= 10 ? R.pick(['Слава богу, государь, живём!', 'Хорошо живём, государь. Ваша милость да наш труд.']) : v > -25 ? 'Не гневайтесь, государь… ' + folkWhy(G.visit.sid)[0] : 'Мнётся, глядит в землю. «Всё хорошо, государь… всё хорошо». Видно, что боится сказать правду.') }); }
  ch.push({ t: 'Как дела в хозяйстве?', fx: () => DLG.say(n, folkWorkLine(n)) });
  if (!incog && mem.coin !== G.day) ch.push({ t: 'Дать серебряную монету (1 зол.)', ...payOk(1), fx: () => { if (!spend(1)) return; mem.coin = G.day; mem.mood = clamp((mem.mood || 0) + 1, -50, 50); Snd.sfx('coin'); DLG.say(n, R.pick(['Ох, государь… Детям на хлеб! Век буду бога молить!', 'Спасибо, ваше величество! Внукам расскажу!'])); } });
  ch.push({ t: 'Ступай с богом', fx: () => { } }); DLG.say(n, hi, { choices: ch, esc: ch.length - 1 }); }
function folkWorkLine(n) { const p = n.folk, sea = seasonOf(G.day), S = folkS();
  const L = { farmer: [['Пашем да сеем. Земля нынче тяжёлая.', 'Колосится рожь — лишь бы град не побил.', 'Жнём, спины не разгибаем. Хлеб — всему голова.', 'Зимой что? Сбрую чиним, дрова возим.'][sea]],
    wife: ['Огород, скотина, детвора — к вечеру ног не чуешь.', 'Холсты тку на продажу. Глядишь, на соль хватит.', 'Курей бы ещё прикупить…'],
    miller: ['Мелю всем по очереди. Кто без очереди — тому за двойную меру.', 'Жернов новый нужен, старый стёрся.'], shepherd: ['Стадо пасу. Волков бы поменьше.', 'Овечки у нас — шерсть что облако!'],
    fisher: ['Рыба нынче ' + (S.prosp > 60 ? 'идёт хорошо.' : 'ушла куда-то.'), 'Сети чиню, лодку смолю. Рыбацкое дело.'], citizen: ['Торговля то густо, то пусто.', 'Цены на рынке кусаются.', 'Работы в городе хватает, было бы здоровье.'],
    herb: ['Травки собираю. Зверобой, ромашка, а вот эта — от сглаза.'], clerk: ['Пишу, считаю, переписываю. Чернила кончаются быстрее жалованья.'] };
  return R.pick(L[p.job] || ['Живём помаленьку.', 'Тружусь, как все.']); }
function folkTalkSmith(n) { const incog = folkIncog(); DLG.say(n, incog ? R.pick(['Подкову сменить? Меч наточить? Говори быстрее — горн стынет.', 'Железо нынче дорогое: всё на войну уходит.']) : 'Отрывается от наковальни: «Государь! Для вашего коня — лучшие подковы, даром!»', { choices: [
  { t: 'Что слышно? Кто заказывает оружие?', fx: () => DLG.say(n, warsOf(G.player.realm).filter(r => r < 5).length ? 'Наконечники для копий, сотнями. Война — кузнецу хлеб, да только сыновей жалко.' : 'Серпы да подковы. Мирное время — оно и для кузнеца мирное.') },
  { t: 'Как живётся?', fx: () => DLG.say(n, incog ? folkOpinionLine(n) : folkWorkLine(n)) }, { t: 'Прощай', fx: () => { } }], esc: 2 }); }
// ---------- the headman / the burgomaster ----------
function folkTalkBoss(n) { const sid = G.visit.sid, mem = folkMem(sid), S = folkS(), own = S.ctrl === G.player.realm, town = VMAP.town, h = hourAbs();
  const ch = [{ t: 'Как живёт ' + (town ? 'город' : 'деревня') + '?', fx: () => DLG.say(n, folkReport(sid), { onEnd: () => folkTalkBoss(n) }) }];
  if (own) { const nd = folkNeed(sid); ch.push(nd ? { t: 'Что нужно ' + (town ? 'городу' : 'деревне') + '?', fx: () => folkOfferNeed(n, nd) } : { t: 'Что нужно ' + (town ? 'городу' : 'деревне') + '?', fx: () => DLG.say(n, 'Пока всё ладно, государь. Вашими молитвами.', { onEnd: () => folkTalkBoss(n) }) }); }
  const fc = town ? 90 : 40; if (mem.fest !== G.day && h < 21.5) ch.push({ t: 'Устроить праздник (−' + fc + ' зол.)', tip: 'Вечером на ' + (town ? 'площади' : 'лугу') + ' — костёр, музыка и пляски. Народ полюбит короля.', ...payOk(fc), fx: () => { if (!spend(fc)) return; folkFestival(sid); DLG.say(n, 'Всплёскивает руками: «Праздник! Ох, государь! Сейчас же созову народ — к вечеру всё будет!»'); } });
  if (own && !town) { const L0 = Math.floor((S.pool && S.pool.levy) || 0), ok = L0 >= 3 && !(mem.levyDay > G.day - 30);
    ch.push({ t: 'Призвать добровольцев в войско', tip: ok ? 'Парни сами пойдут за королём — без платы. В деревне станет меньше рабочих рук.' : 'Некого звать или звали недавно.', ok: () => ok, why: L0 < 3 ? 'Молодых мужчин не осталось.' : 'Недавно уже звали.', fx: () => folkVolunteers(n) }); }
  if (mem.judge !== G.day) ch.push({ t: 'Рассудить спор', tip: 'Король вершит суд прямо на улице.', fx: () => folkDispute(n) });
  ch.push({ t: 'Ступай', fx: () => { } });
  const v = folkOpinion(sid); DLG.say(n, (n.greeted === G.day ? '' : (town ? 'Бургомистр снимает шляпу и кланяется: «Ваше величество, город к вашим услугам!» ' : 'Староста кланяется в пояс: «Ваше величество! Чем богаты — тем и рады!» ')) + (v >= 20 ? 'Народ вас любит, государь.' : v > -20 ? 'Чего изволите?' : 'Не гневайтесь, государь, — народ нынче хмурый.'), { choices: ch, esc: ch.length - 1 });
  n.greeted = G.day; }
function folkReport(sid) { const S = G.setts[sid], s = WD.setts[sid], P = G.provs[s.prov], w = v => (v >= 75 ? 'богато' : v >= 55 ? 'крепко' : v >= 40 ? 'небогато' : 'бедно'), lord = S.lord >= 0 && charOf(S.lord);
  return 'Душ у нас ' + fmt(S.pop) + '. Живём ' + w(S.prosp) + '. ' + ((P.unrest || 0) > 50 ? 'В округе неспокойно: народ ропщет, того и гляди бунт.' : (P.unrest || 0) > 25 ? 'Народ ворчит, но терпит.' : 'Народ спокоен.') + ' ' +
    (S.gar && armyMenU(S.gar) > 0 ? 'Стражи — ' + voin(armyMenU(S.gar)) + '.' : 'Стражи никакой — одни вилы да топоры.') + (lord && lord.alive ? ' Господин наш — ' + lord.name + '.' : '') + ' ' + ['Весной сеем, молимся о дожде.', 'Летом в поле от зари до зари.', 'Осенью — жатва, а там и подати.', 'Зимой дотянуть бы до весны.'][seasonOf(G.day)]; }
const armyMenU = u => { let s = 0; for (const k in u) s += u[k] || 0; return s; };
// ---------- the village's needs ----------
const FOLK_NEEDS = [
  { k: 'well', v: 1, t: 'Колодец обмелел — вода мутная, бабы к ручью за версту ходят.', n: 'Углубить колодец', g: 25, ok: 'Мужики углубят колодец к воскресенью!', fx: (S, sid) => { S.prosp = Math.min(100, S.prosp + 3); provUnrest(sid, -3); } },
  { k: 'bridge', v: 1, t: 'Мост через ручей сгнил — телеги ездят в объезд, полдня теряем.', n: 'Поставить новый мост', g: 45, ok: 'Новый мост — вот радость-то!', fx: S => { S.prosp = Math.min(100, S.prosp + 5); } },
  { k: 'barn', v: 1, t: 'Амбар протекает — зерно преет.', n: 'Перекрыть амбар', g: 35, ok: 'Зерно спасём, государь!', fx: S => { S.mk.food = (S.mk.food || 0) + 300; S.prosp = Math.min(100, S.prosp + 2); } },
  { k: 'wolves', v: 1, t: 'Волки повадились к выгону: трёх овец за неделю зарезали.', n: 'Нанять охотников', g: 20, ok: 'Охотники уже точат рогатины!', fx: (S, sid) => { provUnrest(sid, -2); } },
  { k: 'seed', v: 1, sea: [3, 0], t: 'Семенного зерна не хватает — весной сеять нечего.', n: 'Купить семенное зерно', g: 40, ok: 'Будет чем засеять поле — будет и хлеб!', fx: S => { S.prosp = Math.min(100, S.prosp + 4); } },
  { k: 'chap', v: 1, cond: M => !M.chap, t: 'Церкви у нас нет: детей крестить носим в соседнее село.', n: 'Построить часовню', g: 120, ok: 'К вашему следующему приезду часовня будет стоять!', fx: (S, sid, mem) => { mem.chap = 1; provUnrest(sid, -5); prestige(1); } },
  { k: 'arrears', v: 1, t: 'Недоимки за прошлый год висят. Не простите ли, государь?', n: 'Простить недоимки', g: 30, ok: 'Ох, государь! Век будем помнить!', fx: (S, sid, mem) => { provUnrest(sid, -8); mem.mood = clamp((mem.mood || 0) + 4, -50, 50); } },
  { k: 'bandits', v: 1, cond: () => folkBanditsNear(), t: 'Разбойники грабят на дорогах — мужики боятся ехать на торг.', n: 'Дать денег на ополчение', g: 50, ok: 'Соберём мужиков, вооружим — пусть только сунутся!', fx: S => { S.gar.levy = (S.gar.levy || 0) + 12; } },
  { k: 'pave', v: 0, t: 'Мостовая разбита — после дождя на площади грязь по колено.', n: 'Замостить площадь', g: 80, ok: 'Купцы будут довольны, государь!', fx: S => { S.prosp = Math.min(100, S.prosp + 5); } },
  { k: 'fire', v: 0, t: 'Был пожар в нижнем конце — дюжина семей без крова.', n: 'Помочь погорельцам', g: 60, ok: 'Отстроимся, государь! Спасибо!', fx: (S, sid) => { provUnrest(sid, -6); prestige(1); } },
  { k: 'guild', v: 0, t: 'Цехи просят грамоту на ярмарку — торговля бы ожила.', n: 'Даровать ярмарочную грамоту', g: 0, ok: 'Ярмарка! В казну пойдёт пошлина!', fx: S => { S.prosp = Math.min(100, S.prosp + 6); G.court.incK = Math.min(1.35, (G.court.incK || 1) + 0.005); } },
  { k: 'walls', v: 0, cond: (M, S) => S.walls < 3, t: 'Стена у реки осыпается — того и гляди, рухнет.', n: 'Подновить стену', g: 100, ok: 'Каменщики возьмутся с утра!', fx: (S, sid) => { provUnrest(sid, -3); S.prosp = Math.min(100, S.prosp + 2); } },
  { k: 'bandits', v: 0, cond: () => folkBanditsNear(), t: 'Разбойники грабят обозы у самых ворот.', n: 'Нанять стражу', g: 70, ok: 'Наймём крепких парней!', fx: S => { S.gar.spear = (S.gar.spear || 0) + 10; } } ];
function folkBanditsNear() { const s = folkW(); return G.armies.some(a => a.alive && a.kind === 'bandit' && Math.hypot(a.x - s.x, a.y - s.y) < 10); }
function folkNeed(sid) { const mem = folkMem(sid), S = G.setts[sid], town = VMAP.town, sea = seasonOf(G.day), yr = Math.floor(G.day / DAYS_YEAR);
  const L = FOLK_NEEDS.filter(d => d.v === (town ? 0 : 1) && (!d.sea || d.sea.includes(sea)) && (!d.cond || d.cond(VMAP, S)) && !(mem.done[d.k] > G.day - DAYS_SEASON * 2));
  if (!L.length || mem.needSea === yr * 4 + sea) return null; return L[vRng(sid, 200 + yr * 4 + sea).i(0, L.length - 1)]; }
function folkOfferNeed(n, d) { const sid = G.visit.sid, mem = folkMem(sid), S = G.setts[sid];
  DLG.say(n, d.t, { choices: [{ t: d.n + (d.g ? ' (−' + d.g + ' зол.)' : ''), ...payOk(d.g), fx: () => { if (d.g && !spend(d.g)) return; d.fx(S, sid, mem); mem.done[d.k] = G.day; mem.needSea = Math.floor(G.day / DAYS_YEAR) * 4 + seasonOf(G.day); mem.mood = clamp((mem.mood || 0) + 3, -50, 50); Snd.sfx('coin'); log(WD.setts[sid].name + ': ' + d.n.toLowerCase() + ' — на средства короля.', 'good'); DLG.say(n, d.ok, { onEnd: () => folkTalkBoss(n) }); } },
    { t: 'Не сейчас', fx: () => folkTalkBoss(n) }], esc: 1 }); }
// ---------- volunteers, the dispute, the festival ----------
function folkVolunteers(n) { const sid = G.visit.sid, S = G.setts[sid], mem = folkMem(sid), pa = playerArmy(), v = folkOpinion(sid);
  const k = Math.max(0, Math.round(Math.min(S.pool.levy || 0, 6 + Math.max(0, v) * 0.35 + (mem.mood || 0) * 0.3)));
  if (v < -30 || !k) { DLG.say(n, 'Мнётся: «Не пойдут, государь. Боятся. Да и обижены…»', { onEnd: () => folkTalkBoss(n) }); mem.levyDay = G.day; return; }
  S.pool.levy -= k; pa.u.levy = (pa.u.levy || 0) + k; pa.xp.levy = ((pa.xp.levy || 0) * (pa.u.levy - k) + 8 * k) / Math.max(1, pa.u.levy); S.prosp = Math.max(5, S.prosp - k * 0.04); mem.levyDay = G.day; mem.mood = clamp((mem.mood || 0) - 1, -50, 50);
  Snd.sfx('horn'); log(WD.setts[sid].name + ': ' + voin(k) + ' добровольно пошли за королём.', 'good');
  DLG.say(n, 'Выходят ' + k + ' парней — кто с топором, кто с вилами: «Пойдём за тобой, государь!» Матери утирают слёзы.', { onEnd: () => folkTalkBoss(n) }); }
const FOLK_DISP = [
  { t: '%1 и %2 не поделили межу: каждый говорит, что сосед запахал его землю.', c: [['Разделить спорную полосу поровну', 3, 0], ['Межевой камень поставить заново — за счёт казны (−5 зол.)', 5, 5], ['Отдать землю тому, кто старше', -1, 0]] },
  { t: 'Мельник, говорят, берёт лишнюю меру зерна за помол. Мужики злы.', c: [['Установить твёрдую цену помола', 4, 0], ['Мельника — к ответу: вернуть лишнее', 2, 0], ['Мельнику тоже жить надо', -3, 0]] },
  { t: 'Корова %1 потравила посевы %2. Тот требует корову себе.', c: [['Возместить потраву зерном', 3, 0], ['Отдать корову — закон есть закон', -1, 0], ['Заплатить пострадавшему из казны (−3 зол.)', 5, 3]] },
  { t: 'Вдова %1 просит освободить её от подати: кормильца нет, а детей пятеро.', c: [['Освободить от подати (−4 зол.)', 6, 4], ['Пусть община поможет', 2, 0], ['Подать платят все', -4, 0]] },
  { t: '%1 обвиняет %2 в краже гуся. Свидетелей нет, гуся тоже.', c: [['Пусть поклянётся на святом писании', 3, 0], ['Обоим по гусю из королевских средств (−2 зол.)', 4, 2], ['Нет гуся — нет дела', 0, 0]] } ];
function folkDispute(n) { const sid = G.visit.sid, mem = folkMem(sid), P = COURT.npcs.filter(m => m.folk && m.c.age >= 18 && m.c.age < 70 && m !== n), d = R.pick(FOLK_DISP);
  const a = P.length ? R.pick(P).c.name : 'Хоб', b = P.length > 1 ? R.pick(P.filter(m => m.c.name !== a)).c.name : 'Уот';
  mem.judge = G.day; DLG.say(n, d.t.replace('%1', a).replace('%2', b), { name: 'Королевский суд', choices: d.c.map(([t, mood, g]) => ({ t, ...payOk(g), fx: () => { if (g && !spend(g)) return; mem.mood = clamp((mem.mood || 0) + mood, -50, 50); if (mood > 0) provUnrest(sid, -1); if (mood >= 4) prestige(1);
    DLG.say(n, mood >= 3 ? 'Народ одобрительно гудит: «Мудро! По-божески!»' : mood >= 0 ? 'Люди переглядываются: «Ну… пусть так».' : 'Кто-то в толпе сплёвывает. Решение не понравилось.', { onEnd: () => folkTalkBoss(n) }); } })) }); }
function folkFestival(sid) { const mem = folkMem(sid), S = G.setts[sid]; mem.fest = G.day; mem.mood = clamp((mem.mood || 0) + 8, -50, 50); provUnrest(sid, -6); if (S.ctrl === G.player.realm) prestige(1);
  log('Король устроил праздник для жителей ' + WD.setts[sid].name + '.', 'good'); UI.toast(hourAbs() >= 19 ? 'Праздник начинается!' : 'Вечером, с 19:00, — праздник на ' + (VMAP.town ? 'площади' : 'лугу') + '!'); FOLK.festSet = 0; }
function folkFestTick(dt) { const M = VMAP, fx = M.fest.x, fy = M.fest.y, rc = [fx - 4, fy - 2, fx + 4, fy + 2];
  if (!FOLK.festSet) { FOLK.festSet = 1; for (const n of COURT.npcs) { if (!n.folk || n.post || ['keeper', 'maid', 'guest'].includes(n.folk.job) || n.folk.job === 'headwife') continue; n.override = { spot: n.folk.job === 'bard' ? 'v_festb' : WS(rc), until: 24.5, day: G.day }; n.curT = null; n.hold = 0; } }
  for (const n of COURT.npcs) if (n.wander && n.override && n.override.spot === WS(rc) && n.idleT > 50) n.idleT = R.i(15, 50);
  if (COURT.loc === 'v_out' && R.chance(dt * 1.6)) { const ds = COURT.npcs.filter(n => n.wander && !n.bub && n.override && n.override.spot === WS(rc)); if (ds.length) say(R.pick(ds), R.pick(['Эх, раз!', 'Хей-хей!', 'Ой-ля-ля!', 'Шире круг!', 'Пляши, кума!', 'За короля!']), 2); }
  if (COURT.loc === 'v_out' && R.chance(dt * 6)) COURT.parts.push({ k: 'spark', x: fx * CT + 9 + R.range(-4, 4), y: fy * CT + 6, vx: R.range(-6, 6), vy: R.range(-34, -18), t: 0, life: R.range(0.6, 1.2) }); }
