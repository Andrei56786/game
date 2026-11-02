'use strict';
// ===== CHAPEL, BOOKS & DUNGEON (v3.3): prayer at the altar (once a day; the stained glass makes it stronger), the Sunday mass
// (family, council and servants on the pews, the chaplain's sermon), reading in the library (skills grow slowly), the prisoners
// of the crown (questioning, ransom, service, release, execution) and the jailer who keeps the list. =====
// G.court.prayDay / readDay / massDay / almsDay — the days of the king's last prayer, reading, mass, alms; G.court.hpray — the last
// prayer for health; G.court.ancS — the season of the last prayer for the ancestors; G.court.bless = { k: 'heir', until, m };
// G.court.rx = { mar, dip, intr, stew, lrn } — evenings read (6 → skill +1); G.court.rxq — the next page of every book;
// G.court.pris = { [charId]: { told, ask, srv, ref, rans: { day, gold } } } — what the king did with each prisoner
const MASS_H0 = 9, MASS_H1 = 10.5;
const CHP = { on: 0, bell: -1, ser: 0, si: 0, amen: 0, seenH: 0, lastH: -1, motes: [], q: [], qt: 0 };
const glassK = () => projDone('stainglass') ? 1.5 : 1;
function massOn() { const C = G && G.court; if (!C || G.visit || weekdayOf(G.day) !== 6) return false; const h = hourAbs(); return h >= MASS_H0 && h < MASS_H1; }
// ---------- prayer ----------
function chapelGlow() { for (let i = 0; i < 18; i++) CHP.motes.push({ x: 13 * CT + R.range(-22, 22), y: 5 * CT + R.range(-2, 12), t0: NOW + R.range(0, 1.2), c: R.pick(['#f7d35c', '#fff4c0', '#f0b860']) }); } // real time: the glow plays while the prayer's text is open
function prayDone(t) { G.court.prayDay = G.day; Snd.sfx('choir'); if (COURT.loc === 'chapel') chapelGlow(); DLG.say(null, t, { name: 'Молитва' }); }
ACTS_EXT.pray = () => { const C = G.court, k = kingC(), m = glassK();
  if (C.prayDay === G.day) { DLG.say(null, 'Вы уже молились сегодня. Свечи у алтаря догорают; отец Ансгар советует прийти завтра.', { name: 'Алтарь' }); return; }
  const war = warsOf(0).length > 0, hurt = k.wound > G.day, A = G.armies.filter(a => a.alive && a.realm === 0 && (a.kind === 'lord' || a.kind === 'player'));
  const q = k.spouse >= 0 ? charOf(k.spouse) : null, mom = q && q.alive ? (k.fem ? k : q) : null, sk = yearOf(G.day) * 4 + seasonOf(G.day), w = Math.round(2 * m), ch = [];
  ch.push({ t: 'О здравии', tip: hurt ? 'Рана заживёт быстрее: −' + w + ' дн.' : 'Семья короля под покровом: меньше риск хвори (сезон).', fx: () => { if (hurt) { k.wound -= w; prayDone(k.wound > G.day ? 'Боль в ране утихает. Лекарь потом скажет: заживает на диво быстро.' : 'Боль уходит совсем — рана затянулась.'); } else { C.hpray = G.day; prayDone('Вы просите здравия себе и близким. На душе становится спокойнее.'); } } });
  if (war) ch.push({ t: 'О победе нашего оружия', tip: 'Боевой дух войск короны +' + Math.round(4 * m) + '.', ok: () => A.length > 0, why: 'Войска короны не в поле', fx: () => { for (const a of A) a.morale = clamp(a.morale + 4 * m, 0, 100); prayDone('Вы молитесь за воинов короны. Говорят, в лагерях в тот вечер пели громче обычного.'); } });
  else ch.push({ t: 'О мире в королевстве', tip: 'Смута в столичной провинции −' + Math.round(3 * m) + '.', fx: () => { provUnrest(G.realms[0].capital, -3 * m); prayDone('Вы молитесь о тишине на дорогах и хлебе в амбарах. Весть о королевской молитве обходит столицу.'); } });
  ch.push({ t: 'О мудрости', tip: 'Исследование магистра: +' + (1.5 * m).toFixed(1).replace('.', ',') + '.', fx: () => { techProgress(1.5 * m); prayDone('Вы просите ясности ума. Мысли, что путались с утра, вдруг встают по порядку.'); } });
  if (mom) ch.push({ t: 'О наследнике', tip: 'Неделю шанс зачатия выше.', ok: () => !mom.preg, why: (mom === k ? 'Вы' : 'Королева') + ' уже ждёт ребёнка', fx: () => { C.bless = { k: 'heir', until: G.day + 7, m }; prayDone('Вы просите Господа о наследнике. Отец Ансгар обещает молиться о том же каждый вечер.'); } });
  ch.push({ t: 'За упокой предков', tip: 'Раз в сезон. Слава +1.', ok: () => C.ancS !== sk, why: 'В этом сезоне уже поминали', fx: () => { C.ancS = sk; prestige(1); prayDone('Вы ставите свечи за королей, что правили до вас. Летописец запишет: государь чтит предков.'); } });
  ch.push({ t: 'Встать', fx: () => { } });
  DLG.say(null, 'Вы преклоняете колени у алтаря' + (m > 1 ? '; цветные блики витражей ложатся на камень' : '') + '. О чём просить?', { name: 'Алтарь', choices: ch, esc: ch.length - 1 }); };
// ---------- the Sunday mass ----------
const SERMON = ['Возлюбленные чада, смирение — первая из добродетелей.', 'Блаженны милостивые, ибо они помилованы будут.', 'Гордыня идёт впереди падения — помните об этом, сильные мира сего.',
  'Подайте нищему у ворот: Господь видит и малую лепту.', 'Не хлебом единым жив человек, но и праведным судом.', 'Помолимся о государе нашем и о мире в королевстве.', 'Кто сеет ветер, пожнёт бурю.'];
function sermonLine() { const L = SERMON.slice(), s = seasonOf(G.day), hr = heirOf();
  if (warsOf(0).length) L.push('Помолимся о воинах на рубежах — да вернутся они к своим очагам.');
  if (s === 2) L.push('Возблагодарим Господа за собранный урожай.'); if (s === 3) L.push('Зима сурова: делитесь хлебом с ближним.'); if (s === 0) L.push('Весна — время сеять. И добрые дела тоже.');
  if (hr && hr.name) L.push('Помолимся о наследнике престола, ' + hr.name + '.');
  CHP.si = (CHP.si + 1 + R.i(0, 2)) % L.length; return L[CHP.si]; }
function massPeople() { const out = [], sp = npcByKey('spouse'); if (sp) out.push(sp);
  for (const n of COURT.npcs) if ((n.key.startsWith('kid') || n.key.startsWith('ward')) && n.c.age >= 4) out.push(n);
  for (const s of SEATS) { const n = npcByKey('seat_' + s.k); if (n) out.push(n); }
  for (const k of ['srv_maid', 'srv_page', 'srv_gardener', 'srv_stable', 'srv_cook']) { const n = npcByKey(k); if (n) out.push(n); }
  return out.filter(n => !n.follow && !n.guest && !n.tguest && n.c && !(n.c.prison >= 0)); }
function snapTo(n, spn) { const sp = spotOf(spn); if (!sp) return; npcPlace(n, sp); n.away = 0; if (sp.sx !== undefined) n.x = sp.sx; if (sp.sy !== undefined) n.y = sp.sy; n.sit = sp.sit ? sp : null; n.lie = 0; n.path = null; n.goal = null; n.state = 'idle'; n.curT = spn; }
function massBegin() { const L = LOCS.chapel; CHP.on = 1; CHP.ser = 2.5; CHP.amen = 0; CHP.seenH = 0; CHP.lastH = -1; CHP.q = []; CHP.qt = 0; if (!L || !L.pews) return;
  const ov = (n, sp) => { n.override = { spot: sp, until: MASS_H1, day: G.day, mass: 1 }; n.curT = null; n.hold = 0; n.wander = null; if (n.loc !== COURT.loc || n.away) CHP.q.push([n, sp]); }; // unseen people come in by the door (or are simply there)
  massPeople().slice(0, L.pews.length).forEach((n, i) => ov(n, L.pews[i])); const pr = npcByKey('srv_chaplain'); if (pr) ov(pr, 'mass_priest'); }
function massEnd() { CHP.on = 0; CHP.q = []; for (const n of COURT.npcs) if (n.override && n.override.mass) { n.override = null; n.curT = null; }
  const pr = npcByKey('srv_chaplain'); if (pr && COURT.loc === 'chapel' && pr.loc === 'chapel') say(pr, 'Ступайте с миром.', 3); }
function massAttend() { const C = G.court; C.massDay = G.day; for (const H0 of G.houses) if (H0.alive) houseLoy(H0, 1); prestige(0.5);
  for (const n of COURT.npcs) if (n.override && n.override.mass && n.loc === 'chapel' && n.c && !n.c.pseudo) n.c.loy = clamp((n.c.loy || 60) + 1, 0, 100);
  UI.toast('Король на воскресной обедне: знать довольна (дома +1), слава +0,5.'); log('Король отстоял воскресную обедню в часовне.', 'good'); }
UPD_EXT.push(dt => { if (G.visit || !G.court) return; const C = G.court, h = hourAbs(), here = COURT.loc === 'chapel';
  const gather = weekdayOf(G.day) === 6 && h >= 8.75 && h < MASS_H1; // the bell at 8:45 gathers the court, the mass itself is 9:00–10:30
  if (gather && CHP.bell !== G.day) { CHP.bell = G.day; if (G.atCourt) { Snd.sfx('bell'); UI.toast('Воскресенье: колокол зовёт к обедне — в 9:00, в часовне.'); } }
  if (gather && !CHP.on) massBegin(); else if (!gather && CHP.on) massEnd();
  if (CHP.q.length) { if (!here) { while (CHP.q.length) { const [n, sp] = CHP.q.shift(); if (n.loc !== COURT.loc || n.away) snapTo(n, sp); } }
    else if ((CHP.qt -= dt) < 0) { CHP.qt = 0.7; const [n] = CHP.q.shift(); if (n.loc !== 'chapel' || n.away) { npcPlace(n, { loc: 'chapel', x: 13 * CT, y: 19 * CT + 6, dir: 'up' }); n.away = 0; n.curT = null; } } }
  if (CHP.on && here && massOn()) { if (CHP.lastH >= 0 && h > CHP.lastH) CHP.seenH += Math.min(0.25, h - CHP.lastH); CHP.lastH = h;
    if (CHP.seenH >= 0.5 && C.massDay !== G.day) massAttend();
    const pr = npcByKey('srv_chaplain');
    if (pr && pr.loc === 'chapel' && !pr.path && !pr.goal && (CHP.ser -= dt) < 0) { CHP.ser = R.range(4.5, 6.5); say(pr, sermonLine(), 4.2); if (R.chance(0.45)) CHP.amen = 4.4; }
    if (CHP.amen > 0 && (CHP.amen -= dt) <= 0) { const L = COURT.npcs.filter(n => n.loc === 'chapel' && n.sit && !n.bub && n.override && n.override.mass); for (let i = 0; i < 2 && L.length; i++) say(L.splice(R.i(0, L.length - 1), 1)[0], 'Аминь.', 1.6); } }
  else CHP.lastH = -1; });
ENTER_EXT.push(() => { CHP.on = 0; CHP.motes = []; CHP.q = []; CHP.lastH = -1; });
CRENDER2.push((g, L) => { if (L.id !== 'chapel' || !CHP.motes.length) return; CHP.motes = CHP.motes.filter(p => NOW - p.t0 < 2.4);
  for (const p of CHP.motes) { const t = NOW - p.t0; if (t < 0) continue; const x = Math.round(p.x + Math.sin(t * 3 + p.x) * 3), y = Math.round(p.y - t * 14);
    g.globalAlpha = clamp(Math.min(t * 3, 2.4 - t), 0, 1) * 0.9; g.fillStyle = p.c; g.fillRect(x, y, 1, 1); if (t > 0.4 && t < 1.6) { g.globalAlpha *= 0.5; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } } g.globalAlpha = 1; });
ACTS_EXT.kpew = () => { sitAt(LOCS.chapel.spots.pew_k); if (!massOn()) UI.toast(weekdayOf(G.day) === 6 && hourAbs() < MASS_H0 ? 'Обедня начнётся в 9:00.' : 'Тихо. Только свечи потрескивают у алтаря.'); };
function chaplainTalk(n) { const C = G.court, h = hourAbs(); let d = (6 - weekdayOf(G.day) + 7) % 7; if (d === 0 && h >= MASS_H1) d = 7;
  const when = massOn() ? 'Обедня идёт — садитесь на королевскую скамью.' : d === 0 ? 'Обедня сегодня в 9:00.' : 'Обедня — ' + inDays(d) + ', в воскресенье, в 9:00.';
  DLG.say(n, 'Благослови вас Господь, государь. ' + when, { choices: [
    { t: 'Помолиться у алтаря', ok: () => C.prayDay !== G.day, why: 'Вы уже молились сегодня', fx: () => ACTS_EXT.pray() },
    { t: 'Раздать милостыню (10 зол.)', tip: 'Раз в неделю. Смута в столице −2, слава +0,5.', ok: () => !(C.almsDay > G.day - 7), why: 'На этой неделе уже подавали', fx: () => { if (!spend(10)) { UI.toast('В казне нет и десяти монет.'); return; } C.almsDay = G.day; provUnrest(G.realms[0].capital, -2); prestige(0.5); Snd.sfx('coin'); DLG.say(n, 'Нищие у ворот будут молиться за вас, государь.'); } },
    { t: 'Ступайте с миром, отче', fx: () => { } }], esc: 2 }); }
// ---------- books in the library ----------
const BOOKS = {
  mar: ['«Наставления Суна о войне»', ['Сун пишет (гл. 1): война — путь обмана. Сильный кажется слабым, близкий — далёким, готовый к бою — беспечным.',
    'Сун пишет (гл. 3): лучшая победа — та, что взята без битвы. Сломить замысел врага выше, чем разбить его войско.', 'Сун пишет (гл. 3): худшее для полководца — осаждать крепости. За стены берутся, когда иных путей уже нет.',
    'Сун пишет (гл. 3): знай врага и знай себя — и в сотне битв не будет беды. Знаешь лишь себя — победа и поражение пополам.', 'Сун пишет (гл. 2): ни одной державе не пошла впрок долгая война. Быстрая победа лучше искусной медлительности.',
    'Сун пишет (гл. 7): не нападай в гору на того, кто стоит наверху, и не гонись за войском, что отходит в порядке.', 'Сун пишет (гл. 9): если солдаты, черпая воду, пьют первыми — войско томится жаждой. Смотри на мелочи.']],
  dip: ['«Посольские письма»', ['Старый посол пишет: дар открывает ворота быстрее тарана, но и закрываются они так же быстро.', 'Союз держится на выгоде, а не на клятвах. Узнай, чего хочет сосед, — и он сам придёт к столу.',
    'Кто дольше слушает, тот говорит последним, а последнее слово запоминают.', 'Обида правителя живёт дольше его благодарности. Не задевай чужую гордость без нужды.', 'Хорошее письмо — короткое письмо. Длинные пишут те, кому нечего предложить.']],
  intr: ['«Тайная хроника двора»', ['Хронист пишет: тайна, которую знают двое, — уже наполовину слух.', 'Сун пишет (гл. 13): не жалей серебра на лазутчиков — оно сбережёт тысячи жизней.',
    'Лучший соглядатай тот, кого не замечают: прачка, конюх, нищий у ворот.', 'Заговорщик улыбается за столом шире всех. Смотри не на улыбки, а на руки.', 'Ложное донесение, поданное вовремя, стоит целого полка.']],
  stew: ['«Книга счёта и мер»', ['Казначей прежних времён пишет: амбар — первая крепость королевства.', 'Подать с голодного — это заём у будущего, и отдавать его придётся с лихвой.',
    'Дорога, проложенная в мирный год, окупается в год войны.', 'Считай не то, что пришло в казну, а то, что из неё утекло.', 'Купцы любят тихие дороги и честные весы. Дай им это — и они сами принесут золото.']],
  lrn: ['«Свод учёного монаха»', ['Монах пишет: звёзды не лгут — лгут те, кто их толкует.', 'Перечерти старую карту — и найдёшь дорогу, которой нет у врага.',
    'Лекарь, что моет руки, теряет меньше раненых. Отчего — пока не знает никто.', 'Кто записывает, тот помнит. Кто помнит — тот правит дольше.']] };
ACTS_EXT.read = () => { const C = G.court, k = kingC(), lib = projDone('libwing'), gain = lib ? 1.5 : 1; C.rx = C.rx || {};
  if (C.readDay === G.day) { DLG.say(null, 'Глаза устали, свеча оплыла. На сегодня довольно — книги подождут до завтра.', { name: 'Библиотека' }); return; }
  const ks = ['mar', 'dip', 'intr', 'stew'].concat(lib ? ['lrn'] : []), f1 = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const ch = ks.map(sk => ({ t: BOOKS[sk][0] + ' — ' + SKN[sk], tip: [SKN[sk] + ' (' + SKD[sk] + '): ' + k[sk] + (k[sk] >= 20 ? ' — предел' : ''), 'Прочитано ' + f1(C.rx[sk] || 0) + ' из 6 вечеров' + (lib ? ' (крыло библиотеки: ×1,5)' : '') + ' → +1'],
    ok: () => k[sk] < 20, why: 'Здесь вы знаете всё, что написано', fx: () => readBook(sk, gain) }));
  ch.push({ t: 'Поставить книгу на место', fx: () => { } });
  DLG.say(null, 'Полки ломятся от переплётов' + (lib ? ' — новое крыло пахнет свежим деревом и пергаментом' : '') + '. Что почитать сегодня?', { name: 'Библиотека', choices: ch, esc: ch.length - 1 }); };
function readBook(sk, gain) { const C = G.court, k = kingC(), B = BOOKS[sk]; C.readDay = G.day; C.rx[sk] = (C.rx[sk] || 0) + gain; C.rxq = C.rxq || {}; Snd.sfx('paper');
  const qi = C.rxq[sk] = ((C.rxq[sk] === undefined ? -1 : C.rxq[sk]) + 1) % B[1].length; let up = '';
  if (C.rx[sk] >= 6 && k[sk] < 20) { C.rx[sk] -= 6; k[sk] = Math.min(20, k[sk] + 1); up = 'Знание крепнет: ' + SKN[sk] + ' +1'; log('Король прилежно читает: ' + SKD[sk] + ' — ' + SKN[sk] + ' ' + k[sk] + '.', 'good'); }
  DLG.say(null, B[1][qi], { name: B[0], onEnd: up ? () => { UI.toast(up); Snd.sfx('chime'); } : null }); }
// ---------- the prisoners of the crown ----------
const PRIS_ROLE = { general: 'воевода', knight: 'рыцарь', lord: 'лорд', ruler: 'правитель', courtier: 'придворный', council: 'советник', scholar: 'учёный' };
function prisSt(c) { const C = G.court; C.pris = C.pris || {}; return C.pris[c.id] || (C.pris[c.id] = {}); }
function prisWho(c) { return (PRIS_ROLE[c.role] || 'пленник') + (c.realm === 0 ? ', подданный короны' : c.realm < 5 ? ' державы ' + realmName(c.realm) : ' из Вольных земель'); }
const prisPrice = c => c.role === 'ruler' ? 250 : 40 + (c.mar || 5) * 6;
const prisSay = (n, t, o) => DLG.say(n.key ? n : n.c, t, Object.assign({ sub: 'Узник короны · ' + prisWho(n.c) }, o || {}));
function prisAskP(c) { const k = kingC(), tr = c.traits || [];
  return clamp(0.4 + (k.intr - 10) * 0.03 + (seatChar('eye') ? 0.1 : 0) + (tr.includes('craven') ? 0.25 : 0) - (tr.includes('proud') ? 0.15 : 0) - (tr.includes('brave') ? 0.1 : 0) - (tr.includes('honest') ? 0.05 : 0), 0.1, 0.9); }
function prisSrvP(c) { const k = kingC(), tr = c.traits || [];
  return clamp(0.18 + (k.dip - 10) * 0.025 + ((G.court.prestige || 0) / 400) + (c.realm >= 5 ? 0.2 : 0) - (tr.includes('honest') ? 0.15 : 0) - (tr.includes('proud') ? 0.1 : 0) + (tr.includes('greedy') ? 0.12 : 0) + (tr.includes('craven') ? 0.1 : 0), 0.05, 0.85); }
function prisonerTalk(n) { const c = n.c, P = prisSt(c), tr = c.traits || [], own = c.realm === 0, r = c.realm, H0 = houseOf(c), pct = p => Math.round(p * 100) + '%';
  if (!c.alive || c.prison !== 0) { prisSay(n, 'Я больше не ваш узник, государь.'); return; }
  const line = own ? (tr.includes('proud') ? '«Я служил короне верно, государь. Меня оговорили!»' : '«Смилуйтесь, государь! Я искуплю вину.»')
    : tr.includes('craven') ? '«Пощадите! Я скажу всё, что знаю!»' : tr.includes('proud') ? '«Мой господин заплатит за меня золотом — а за эту солому спросит железом.»'
    : tr.includes('brave') ? '«Я бился честно — и в цепях остаюсь воином.»' : '«Солома сырая, похлёбка жидкая. Чего вы хотите, король?»';
  const ch = [{ t: 'Допросить', tip: 'Шанс ~' + pct(prisAskP(c)) + (own ? '. Может открыть тайну двора.' : '. Казна, войска и войны его державы.'), ok: () => !P.told && !(P.ask > G.day - 3), why: P.told ? 'Он рассказал всё, что знал' : 'Он молчит — попробуйте через пару дней', fx: () => prisAsk(n) }];
  if (own) ch.push({ t: 'Помиловать', tip: H0 ? 'Дом ' + H0.name + ' +8.' : 'Слава милостивого короля.', fx: () => prisPardon(n) }, { t: 'Казнить', tip: (H0 ? 'Дом ' + H0.name + ' −20, прочие дома −2. ' : '') + 'Страх перед короной растёт.', fx: () => prisExecAsk(n) });
  else ch.push({ t: 'Предложить выкуп (' + prisPrice(c) + ' зол.)', tip: 'Письмо его господину; ответ через 2–5 дней.', ok: () => r < 5 && alive(r) && !P.rans && !(P.ref > G.day - 7), why: r >= 5 ? 'За вольного барона платить некому' : !alive(r) ? 'Его держава пала — платить некому' : P.rans ? 'Письмо уже в пути' : 'Недавно отказали — подождите', fx: () => prisRansom(n) },
    { t: 'Предложить службу', tip: 'Шанс ~' + pct(prisSrvP(c)) + '. Его держава обидится.', ok: () => !P.srv && c.role !== 'ruler' && !G.armies.some(a => a.alive && a.gen === c.id), why: P.srv ? 'Он уже ответил отказом' : c.role === 'ruler' ? 'Правитель не пойдёт в слуги' : 'Его войско ещё в поле: он связан присягой', fx: () => prisServe(n) },
    { t: 'Отпустить с миром', tip: (r < 5 ? 'Мнение державы ' + realmName(r) + ' +8, ' : '') + 'слава +1.', fx: () => prisRelease(n) },
    { t: 'Казнить', tip: (r < 5 ? 'Держава ' + realmName(r) + ': мнение −25, прочие −5. ' : '') + 'Страх перед короной растёт.', ok: () => c.role !== 'ruler', why: 'Казнить правителя — значит навеки войну', fx: () => prisExecAsk(n) });
  ch.push({ t: own ? 'Оставить в темнице' : 'Уйти', fx: () => { } });
  prisSay(n, line + (P.rans ? ' Письмо о выкупе в пути.' : ''), { choices: ch, esc: ch.length - 1 }); }
function prisIntel(c) { const r = c.realm; if (r >= 5 || !alive(r)) return '«Мой господин? Сидит в своей башне и считает овец». Ничего важного он не знает.';
  const Rr = G.realms[r], A = G.armies.filter(a => a.alive && a.realm === r && (a.kind === 'lord' || a.kind === 'player')), men = A.reduce((s, a) => s + menOf(a.u), 0), wars = warsOf(r).map(realmName);
  return 'Под нажимом он рассказывает: в казне державы ' + realmName(r) + ' около ' + Math.max(0, Math.round(Rr.gold / 10) * 10) + ' зол.; в поле ' + A.length + ' ' + plural(A.length, 'войско', 'войска', 'войск') + ' (' + voin(men) + '); ' + (wars.length ? 'воюют с: ' + wars.join(', ') : 'ни с кем не воюют') + '.'; }
function prisAsk(n) { const c = n.c, P = prisSt(c), C = G.court;
  if (!R.chance(prisAskP(c))) { P.ask = G.day; Snd.sfx('thud'); prisSay(n, R.pick(['Он смотрит сквозь вас и молчит.', 'Он сплёвывает на солому: «Ничего ты от меня не услышишь».', 'Он лишь усмехается разбитыми губами.'])); return; }
  P.told = 1; Snd.sfx('chime');
  if (c.realm === 0) { const S = (C.secrets || []).filter(x => !x.known && x.k !== 'love'), s = S.find(x => x.who && x.who.includes(c.id)) || S[0];
    if (s) { revealSecret(s, 'допрос в темнице'); log('На допросе открылась тайна: ' + secretText(s), 'info'); return; }
    prisSay(n, 'Он клянётся, что ничего не скрывает. Похоже, так и есть: тайн за ним нет.'); return; }
  const t = prisIntel(c); prisSay(n, t); log('Допрос в темнице (' + c.name + '): ' + t.replace(/^Под нажимом он рассказывает: /, ''), 'info'); }
function prisOut(n, line) { const C = G.court; delete (C.pris || {})[n.c.id]; if (!n.key) return; n.pris = 0; n.post = null; n.sub = 'Выпущен на волю'; n.talk = m => DLG.say(m, line);
  if (n.loc === 'dungeon') { npcPlace(n, { loc: 'dungeon', x: n.x, y: 8 * CT + 12, dir: 'down' }); Snd.sfx('door'); } npcLeave(n); }
function prisRansom(n) { const c = n.c, P = prisSt(c); P.rans = { day: G.day + R.i(2, 5), gold: prisPrice(c) }; Snd.sfx('paper');
  DLG.say(null, 'Писарь скрепляет письмо королевской печатью: выкуп — ' + P.rans.gold + ' зол., пленник — ' + charName(c) + '. Гонец уже в седле.', { name: 'Выкуп' }); }
function prisServe(n) { const c = n.c, P = prisSt(c), r = c.realm; P.srv = 1;
  if (!R.chance(prisSrvP(c))) { Snd.sfx('thud'); prisSay(n, R.pick(['«Я присягал один раз, и другой присяги не будет».', '«Служить тому, кто держит меня в цепях? Никогда».', '«Предателей не любят даже те, кому они служат».'])); return; }
  const sub = 'Узник короны · ' + prisWho(c); c.realm = 0; c.prison = -1; c.role = 'knight'; c.title = c.fem ? 'Леди' : 'Сэр'; c.atCourt = 1; c.loy = 45; if (r < 5) addOpn(r, 0, -6);
  prisOut(n, 'Я принесу присягу у ваших знамён, государь.'); Snd.sfx('fanfare_small');
  DLG.say(n.key ? n : c, '«Пусть так. Отныне мой меч — ваш, государь». Кузнец сбивает с него оковы.', { sub }); log(c.name + ' перешёл на службу короны.', 'good'); }
function prisRelease(n) { const c = n.c, r = c.realm; c.prison = -1; if (r < 5) addOpn(r, 0, 8); prestige(1); const sub = 'Узник короны · ' + prisWho(c);
  prisOut(n, 'Я не забуду вашей милости, король.'); DLG.say(n.key ? n : c, '«Вы благородны, король. Я этого не забуду».', { sub }); log(charName(c) + ' отпущен из темницы без выкупа.', 'info'); }
function prisPardon(n) { const c = n.c, H0 = houseOf(c); c.prison = -1; c.loy = clamp((c.loy || 50) + 10, 0, 100); if (H0) houseLoy(H0, 8); prestige(0.5); const sub = 'Узник короны · ' + prisWho(c);
  prisOut(n, 'Я не забуду вашей милости, государь.'); DLG.say(n.key ? n : c, '«Благодарю, государь! Я искуплю…» Тюремщик гремит ключами.', { sub }); log(charName(c) + ' помилован и выпущен из темницы.' + (H0 ? ' Дом ' + H0.name + ' благодарен.' : ''), 'good'); }
function prisExecAsk(n) { const c = n.c, H0 = houseOf(c), r = c.realm;
  DLG.say(null, 'Приговор: ' + charName(c) + ' — казнить? Этого уже не исправить.' + (r === 0 ? (H0 ? ' Дом ' + H0.name + ' не простит.' : '') : r < 5 ? ' Держава ' + realmName(r) + ' возненавидит нас.' : ''),
    { name: 'Приговор', choices: [{ t: 'На плаху', fx: () => prisExec(n) }, { t: 'Нет, не сейчас', fx: () => { } }], esc: 1 }); }
function prisExec(n) { const c = n.c, r = c.realm, H0 = houseOf(c); delete (G.court.pris || {})[c.id];
  if (r === 0) { if (H0) houseLoy(H0, -20); for (const h of G.houses) if (h.alive && h !== H0) houseLoy(h, -2); }
  else if (r < 5) { addOpn(r, 0, -25); for (let t = 1; t < 5; t++) if (t !== r && alive(t)) addOpn(t, 0, -5); }
  G.realms[0].fear = (G.realms[0].fear || 0) + 4;
  fadeTo(() => { COURT.npcs = COURT.npcs.filter(m => m.key !== 'pris' + c.id); charDies(c, 'казнён по приказу короля'); Snd.sfx('thud');
    DLG.say(null, 'На рассвете у темничной стены всё кончено. ' + (r === 0 ? 'Двор притих: о приговоре шепчутся во всех коридорах.' : 'Весть летит к границе быстрее гонца.'), { name: 'Казнь' }); }); }
DAILY_EXT.push(() => { const C = G.court; if (!C.pris) return;
  for (const id in C.pris) { const P = C.pris[id], c = charOf(+id); if (!c || !c.alive || c.prison !== 0) { delete C.pris[id]; continue; }
    const RS = P.rans; if (!RS || RS.day > G.day) continue; P.rans = null; const r = c.realm; if (r <= 0 || r >= 5 || !alive(r)) continue;
    const Rr = G.realms[r], ru = rulerOf(r), ws = Rr.capital >= 0 ? WD.setts[Rr.capital] : null, tr = (ru && ru.traits) || [];
    const pay = Rr.gold >= RS.gold && R.chance(clamp(0.55 + G.rel[r][0].opn / 200 + (c.role === 'ruler' ? 0.4 : 0) + ((c.mar || 10) - 10) * 0.02 - (tr.includes('greedy') ? 0.15 : 0), 0.15, 0.95));
    const L = { from: ru ? ru.title + ' ' + ru.name : realmName(r), fc: ru ? ru.id : -1, subj: 'Выкуп: ' + c.name }; if (ws) { L.x = ws.x; L.y = ws.y; }
    if (pay) { Rr.gold -= RS.gold; G.realms[0].gold += RS.gold; c.prison = -1; delete C.pris[id]; addOpn(r, 0, 4); COURT.npcs = COURT.npcs.filter(m => m.key !== 'pris' + c.id);
      L.text = '«Золото отправлено с моим гонцом: ' + RS.gold + ' зол. Пусть мой человек, ' + c.name + ', вернётся домой — и больше не попадается вам в руки».'; log('Получен выкуп: +' + RS.gold + ' зол. ' + c.name + ' отпущен домой.', 'good'); Snd.sfx('coin'); }
    else { P.ref = G.day; L.text = Rr.gold < RS.gold ? '«Казна моя пуста, и последнего я за него не отдам. Держите его у себя».' : '«Я не торгуюсь с теми, кто держит моих людей в цепях».'; log('Держава ' + realmName(r) + ' отказалась платить выкуп (' + c.name + ').', 'info'); }
    addLetter(L); } });
function jailerTalk(n) { const P = G.chars.filter(c => c.alive && c.prison === 0 && c.id !== G.player.char);
  if (!P.length) { DLG.say(n, 'Камеры пусты, государь. Солома да крысы — вот и все мои узники.'); return; }
  const ch = P.slice(0, 5).map(c => ({ t: charName(c) + ' — ' + prisWho(c), fx: () => prisonerTalk(npcByKey('pris' + c.id) || { c }) })); ch.push({ t: 'Ступай', fx: () => { } });
  DLG.say(n, 'В темнице ' + P.length + ' ' + plural(P.length, 'узник', 'узника', 'узников') + '. С кем желаете говорить, государь?', { choices: ch, esc: ch.length - 1 }); }
POP_EXT.push(() => { const j = npcByKey('srv_jailer'); if (j) j.talk = jailerTalk; const p = npcByKey('srv_chaplain'); if (p) p.talk = chaplainTalk; });
// ---------- places: pews, the royal pew, the priest at mass, the bookshelf ----------
BUILD_EXT.push(() => { const L = LOCS.chapel, K = LOCS.keep;
  if (L) { L.pews = []; for (const ty of [9, 11, 13, 15]) for (const tx of [7, 5, 3, 18, 20, 22]) { const nm = 'pew' + L.pews.length; spot(L, nm, tx, ty, 'up', { sit: 1, sy: ty * CT + 6 }); L.pews.push(nm); }
    spot(L, 'pew_k', 9, 9, 'up', { sit: 1, sy: 9 * CT + 6 }); spot(L, 'mass_priest', 12, 6, 'down');
    act(L, 'kpew', 9, 10, 'Королевская скамья', { r: 18 }); Object.defineProperty(L.acts[L.acts.length - 1], 'label', { get: () => massOn() ? 'Обедня: сесть на королевскую скамью' : 'Королевская скамья' });
    const a = L.acts.find(a => a.id === 'pray'); if (a) Object.defineProperty(a, 'label', { get: () => G.court && G.court.prayDay === G.day ? 'Алтарь (сегодня вы уже молились)' : 'Помолиться у алтаря' }); }
  if (K) { act(K, 'read', 2, 4, 'Почитать книгу', { r: 22 }); Object.defineProperty(K.acts[K.acts.length - 1], 'label', { get: () => G.court && G.court.readDay === G.day ? 'Книги (на сегодня довольно)' : 'Почитать книгу' }); } });
