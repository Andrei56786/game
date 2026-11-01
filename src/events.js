'use strict';
// ===== EVENTS: daily tick, settlements, seasons, random events, captures =====
function dailyTick() {
  if (G.day % 2 === 0) revealWater();
  G.day++;
  if (--G.weather.days <= 0) rollWeather();
  if (G.day % DAYS_SEASON === 0) onSeason();
  for (const a of G.armies.slice()) if (a.alive) dailyArmy(a);
  econDaily(); // fields, workshops, townsfolk, merchants (econ.js)
  for (let r = 0; r < 5; r++) if (alive(r)) realmEconomy(r);
  for (const S of G.setts) dailySett(S);
  for (let r = 0; r < 5; r++) aiRealm(r);
  for (const a of G.armies.slice()) if (a.alive && a.kind !== 'player') aiArmy(a);
  if (G.day % 7 === 0) diploWeekly();
  // bandits respawn at empty lairs, caravans
  if (G.day % 5 === 0) { WD.lairs.forEach((L, k) => { if (!G.armies.some(a => a.alive && a.kind === 'bandit' && a.lair === k) && R.f() < 0.12) spawnBandits(L); }); }
  // prisoners: AI generals freed after a while
  for (const c of G.chars) if (c.prison >= 0 && c.prison !== G.player.realm && R.f() < 0.03) c.prison = -1;
  const king = charOf(G.player.char); if (king.prison >= 0) kingCaptured(king);
  // player gold debt
  const pr = G.realms[G.player.realm]; if (pr.gold < 0 && G.day % 3 === 0) log('Казна пуста! Войску не платят — боевой дух падает.', 'bad');
  // messages expire
  for (const m of G.msgs) if (!m.done && m.until < G.day) { m.done = 1; if (m.kind === 'call') declineCall(m); }
  G.msgs = G.msgs.filter(m => !m.done || G.day - m.day < 2);
  G.armies = G.armies.filter(a => a.alive);
  // v3: the court, the dynasty and the magister's studies live on day by day
  if (G.court) { for (const f of [councilDaily, dynastyDaily, researchDaily, courtExileCheck]) { try { f(); } catch (e) { console.error(e); } } }
  checkRealms(); checkVictory();
  if (dayOfYear(G.day) === DAYS_SEASON * 3 && G.day > 0) holdCouncil();
  if (G.day > 6 && R.f() < 0.055 && !G.over) randomEvent();
  computeVision(); updateSigns();
  if (typeof TUT !== 'undefined') TUT.daily();
  if (G.court && SCREEN === 'court') { try { courtSyncVisual(); } catch (e) { console.error(e); } }
  if (G.day % 7 === 0 && !G.over) saveGame();
}
function dailySett(S) {
  const ws = WD.setts[S.id], P = G.provs[ws.prov];
  if (!S.siege) { S.food = Math.min(S.foodMax, S.food + 0.4); refillPool(S, 1); }
  P.dev = Math.max(0, P.dev - 0.004); if (S.ctrl === S.owner) P.unrest = Math.max(0, P.unrest - 0.4); else P.unrest = Math.min(100, P.unrest + 0.15);
  const peace = !warsOf(S.ctrl < 5 ? S.ctrl : 0).length; S.prosp = clamp(S.prosp + (S.siege ? -0.3 : peace ? 0.04 : 0.01) - P.dev * 0.05, 5, 100);
  // garrisons slowly recover from pool when not besieged
  if (!S.siege && S.ctrl < 5 && G.day % 3 === 0) { const base = baseGarrison(S); for (const u of UT) { if ((S.gar[u] || 0) < base[u] && (S.pool[u] || 0) >= 1) { S.gar[u]++; S.pool[u]--; } } }
  // unrest revolt -> bandits
  if (P.unrest > 80 && ws.type !== 'village' && R.f() < 0.02) { P.unrest = 50; const L = { x: ws.x + R.i(-2, 2), y: ws.y + R.i(-2, 2) }; if (inMap(L.x, L.y) && passable(WD.ter[L.y * MW + L.x])) { const b = spawnBandits(L); b.u.levy += 40; if (S.ctrl === G.player.realm) log('Бунт в провинции ' + WD.provs[ws.prov].name + '! Мятежники ушли в леса.', 'bad'); } }
}
function onSeason() {
  const s = seasonOf(G.day);
  const T = ['Пришла весна. Дороги развезло, но травы поднимаются — кони снова пасутся.', 'Лето. Сухие дороги, много корма — лучшее время для походов.', 'Осень. Урожай собран: фуражировка богаче всего. Скоро холода.', 'Зима. Корма нет, болезни косят войска в поле, походы медленны. Мудрый стоит на зимних квартирах.'][s];
  log(T, 'season'); if (typeof TUT !== 'undefined') TUT.ev('season', s);
}
function kingCaptured(king) {
  const r = G.realms[G.player.realm]; const ransom = 120 + Math.round(G.day / 2);
  r.gold -= ransom; king.prison = -1; r.prestige = (r.prestige || 0) - 20;
  log('Король был пленён и выкуплен за ' + ransom + ' зол. Позор ляжет на летописи.', 'bad');
}
function declineCall(m) { const t = m.from; setRel(G.player.realm, t, 'ally', 0); addOpn(t, G.player.realm, -35); log('Мы не пришли на помощь союзнику (' + realmName(t) + '). Союз расторгнут.', 'bad'); }
function answerMsg(m, yes) {
  m.done = 1; const p = G.player.realm;
  if (m.kind === 'peace') { if (yes) makePeace(m.terms.win, m.terms.lose, m.terms.cede, m.terms.gold); else addOpn(m.from, p, -3); }
  else if (m.kind === 'call') { if (yes) { declareWar(p, m.enemy, { noCall: true, ally: m.from }); addOpn(m.from, p, 15); } else declineCall(m); }
  else if (m.kind === 'ransom') { const c = charOf(m.char); if (yes) { G.realms[p].gold += m.gold; G.realms[m.from].gold -= m.gold; c.prison = -1; addOpn(m.from, p, 10); log('Пленник ' + c.name + ' выкуплен: +' + m.gold + ' зол.', 'good'); } else { addOpn(m.from, p, -10); } }
  else if (m.kind === 'offer') { if (yes && m.fx) m.fx(); }
}
// ---------- captures ----------
function onCapture(a, S, prev) {
  const ws = WD.setts[S.id];
  // villages of a captured seat follow it
  if (ws.type !== 'village') for (const v of WD.provs[ws.prov].villages) { const V = G.setts[v]; if (V.ctrl === prev && !V.siege) { V.ctrl = a.realm; if (V.owner >= 5 && a.realm < 5) V.owner = a.realm; } }
  // free baronies have no king to sign a peace: the conqueror owns them outright
  if (S.owner >= 5 && a.realm < 5) { S.owner = a.realm; if (S.lord >= 0 && charOf(S.lord) && charOf(S.lord).realm === 5) S.lord = -1; }
  if (a.realm === G.player.realm) {
    G.realms[a.realm].prestige = (G.realms[a.realm].prestige || 0) + (ws.type === 'capital' ? 25 : ws.type === 'village' ? 1 : 6);
    if (ws.type !== 'village' && typeof UI !== 'undefined') UI.alert('captured', S.id);
    if (typeof TUT !== 'undefined') TUT.ev('capture', S.id);
  }
  if (a.realm < 5 && prev < 5 && prev !== a.realm) G.rel[a.realm][prev].bs = (G.rel[a.realm][prev].bs || 0) + (ws.type === 'village' ? 1 : 3);
  MAPDIRTY.pol = 1;
}
function lootSett(a, S) {
  const ws = WD.setts[S.id], P = G.provs[ws.prov]; const big = { village: 1, castle: 2, town: 3, capital: 4 }[ws.type];
  const gold = Math.round(S.pop / 40 * (S.prosp / 60) * (1 - P.dev)), food = Math.round(400 * big * (1 - P.dev));
  G.realms[a.realm].gold += gold; a.food += food; S.prosp = Math.max(5, S.prosp - 25); P.dev = Math.min(0.9, P.dev + 0.35); P.unrest = Math.min(100, P.unrest + 30); S.lootDay = G.day;
  if (S.owner < 5 && S.owner !== a.realm) addOpn(S.owner, a.realm, -10);
  for (let x = 0; x < 5; x++) if (x !== a.realm && rulerOf(x).traits.includes('honest')) addOpn(x, a.realm, -3);
  a.vict = (a.vict || 0) + 4;
  return { gold, food };
}
// ---------- random events (CK3-flavoured, Sun Tzu commentary) ----------
const EVENTS = [
  { id: 'merchant', w: 3, cond: () => playerArmy().food < armyMen(playerArmy()) * 10,
    title: 'Купец у лагеря', ic: 'wagon', text: () => 'Седой купец с тремя возами пригнал к лагерю зерно. «Слышал, войску короля нужен хлеб. Продам дешевле, чем в городе — но за золото сразу».\n\nСунь-цзы: «Перевозить припасы издалека — разорять народ». Купленное на месте дешевле привезённого.',
    opts: [{ t: 'Купить 800 провианта за 30 зол.', ok: () => G.realms[G.player.realm].gold >= 30, fx: () => { G.realms[G.player.realm].gold -= 30; playerArmy().food += 800; } }, { t: 'Отказать', fx: () => { } }] },
  { id: 'fever', w: 3, cond: () => playerArmy().sick > armyMen(playerArmy()) * 0.04,
    title: 'Лихорадка в лагере', ic: 'sick', text: () => 'Лекарь докладывает: лихорадка ползёт по шатрам. Больных уже ' + Math.round(playerArmy().sick) + '.\n\nСунь-цзы: «Войско предпочитает высокое и сухое, избегает низкого и сырого. Где войско бережёт себя от болезней — там победа».',
    opts: [{ t: 'Отделить больных и оставить в ближайшей деревне', tip: 'Больные уходят из войска (часть вернётся домой).', fx: () => { const a = playerArmy(); a.sick = 0; a.morale -= 3; } }, { t: 'Выхаживать всех (−40 провианта в день не изменится)', tip: 'Боевой дух +5: король не бросает своих.', fx: () => { playerArmy().morale += 5; } }] },
  { id: 'deserter', w: 2, cond: () => warsOf(G.player.realm).length > 0,
    title: 'Перебежчик', ic: 'spy', text: () => { const t = R.pick(warsOf(G.player.realm)); EVENTS._t = t; return 'Ночью к дозорным вышел человек в плаще войска державы ' + realmName(t) + '. Говорит, что знает, где стоят их отряды, и просит золота.\n\nСунь-цзы: «Сведения нельзя получить от духов… их получают от людей». Но перебежчик может быть и подосланным.'; },
    opts: [{ t: 'Заплатить 25 зол. и выслушать', ok: () => G.realms[G.player.realm].gold >= 25, fx: () => { G.realms[G.player.realm].gold -= 25; if (R.f() < 0.75) { G.spies.push({ type: 'inward', realm: EVENTS._t, until: G.day + 14, d0: G.day }); log('Перебежчик не солгал: 14 дней мы видим все войска державы ' + realmName(EVENTS._t) + '.', 'good'); computeVision(); } else log('Перебежчик исчез ночью вместе с золотом. Обман.', 'bad'); } }, { t: 'Прогнать', fx: () => { } }] },
  { id: 'quarrel', w: 2, cond: () => armyMen(playerArmy()) > 150,
    title: 'Ссора в войске', ic: 'sword', text: () => 'Латники и ополченцы подрались из-за места у костров. Двое ранены. Воеводы ждут королевского слова.\n\nСунь-цзы: «Если с воинами обращаться ласково, но не уметь приказывать, — они как избалованные дети, ни на что не годны».',
    opts: [{ t: 'Наказать зачинщиков плетьми', tip: 'Дух −4, опыт +3: порядок прежде всего.', fx: () => { const a = playerArmy(); a.morale -= 4; for (const u of UT) a.xp[u] = Math.min(100, a.xp[u] + 3); } }, { t: 'Выкатить бочку вина и помирить', tip: '−15 зол., дух +6.', ok: () => G.realms[G.player.realm].gold >= 15, fx: () => { G.realms[G.player.realm].gold -= 15; playerArmy().morale += 6; } }] },
  { id: 'omen', w: 1, cond: () => true,
    title: 'Знамение', ic: 'star', text: () => 'В ночном небе прошла хвостатая звезда. Воины шепчутся: к беде или к победе?\n\nСунь-цзы: «Запрещай гадания и пресекай сомнения — и до самой смерти воины не дрогнут».',
    opts: [{ t: 'Объявить звезду добрым знаком', tip: 'Дух +8.', fx: () => { playerArmy().morale += 8; } }, { t: 'Запретить толки о знамениях', tip: 'Дух +3, опыт +2.', fx: () => { const a = playerArmy(); a.morale += 3; for (const u of UT) a.xp[u] = Math.min(100, a.xp[u] + 2); } }] },
  { id: 'guide', w: 2, cond: () => { const t = armyTile(playerArmy()), p = WD.prov[t]; return p >= 0 && G.provs[p].guides <= G.day; },
    title: 'Охотник-проводник', ic: 'eye', text: () => { const p = WD.prov[armyTile(playerArmy())]; EVENTS._p = p; return 'Местный охотник предлагает провести войско тропами провинции ' + WD.provs[p].name + ' — через леса и топи, где не пройдёт чужак.\n\nСунь-цзы: «Кто не пользуется местными проводниками, тот не извлечёт выгод из местности».'; },
    opts: [{ t: 'Нанять за 10 зол. (марш −20% на 30 дней)', ok: () => G.realms[G.player.realm].gold >= 10, fx: () => { G.realms[G.player.realm].gold -= 10; G.provs[EVENTS._p].guides = G.day + 30; if (typeof TUT !== 'undefined') TUT.ev('guide'); } }, { t: 'Обойдёмся', fx: () => { } }] },
  { id: 'mercs', w: 2, cond: () => G.realms[G.player.realm].gold > 100,
    title: 'Вольный отряд', ic: 'flag', text: () => 'Кондотьер вольного отряда предлагает мечи: 25 копейщиков и 15 лучников. «Плата вперёд, ваше величество, мы люди простые».\n\nСунь-цзы: «Где войско стоит долго — истощаются силы государства». Наёмники обходятся дорого.',
    opts: [{ t: 'Нанять за 110 зол.', ok: () => G.realms[G.player.realm].gold >= 110, fx: () => { G.realms[G.player.realm].gold -= 110; const a = playerArmy(); a.u.spear += 25; a.u.archer += 15; a.arrows += 300; } }, { t: 'Отказать', fx: () => { } }] },
  { id: 'harvest', w: 2, cond: () => seasonOf(G.day) === 2,
    title: 'Богатый урожай', ic: 'food', text: () => 'Крестьяне собрали небывалый урожай. Старосты спрашивают, можно ли продать излишки в чужие земли.\n\nСунь-цзы: «Искусный в войне не набирает ополчение дважды и не возит провиант трижды».',
    opts: [{ t: 'Разрешить торговлю', tip: 'Казна +40.', fx: () => { G.realms[G.player.realm].gold += 40; } }, { t: 'Засыпать в королевские житницы', tip: 'Запас крепостей ×1.5, провиант на рынках +.', fx: () => { for (const S of G.setts) if (S.ctrl === G.player.realm) { S.food = Math.min(S.foodMax * 1.5, S.food * 1.5); S.mk.food = (S.mk.food || 0) * 1.3; } } }] },
  { id: 'envoy', w: 2, cond: () => [1, 2, 3, 4].some(t => alive(t) && !G.rel[0][t].war && opinionOf(t, 0) > 10 && G.rel[0][t].pact < G.day && !G.rel[0][t].ally),
    title: 'Посол', ic: 'scroll', text: () => { const t = [1, 2, 3, 4].find(t => alive(t) && !G.rel[0][t].war && opinionOf(t, 0) > 10 && G.rel[0][t].pact < G.day && !G.rel[0][t].ally); EVENTS._t = t; return 'Прибыл посол державы ' + realmName(t) + ' с предложением пакта о ненападении на два года.\n\nСунь-цзы: «Не зная замыслов соседей, нельзя заключать с ними союзы».'; },
    opts: [{ t: 'Принять пакт', fx: () => { setRel(0, EVENTS._t, 'pact', G.day + DAYS_YEAR * 2); addOpn(EVENTS._t, 0, 5); log('Пакт о ненападении: ' + realmName(EVENTS._t) + '.', 'good'); } }, { t: 'Вежливо отказать', fx: () => { addOpn(EVENTS._t, 0, -5); } }] },
  { id: 'deserters', w: 2, cond: () => playerArmy().morale < 45,
    title: 'Пойманы беглецы', ic: 'men', text: () => 'Дозор поймал шестерых, бежавших ночью из лагеря. Войско смотрит, что сделает король.\n\nСунь-цзы: «Если наказывать воинов прежде, чем они привязались к тебе, — они не будут покорны. Если привязались, а наказаний нет — они бесполезны».',
    opts: [{ t: 'Казнить для острастки', tip: 'Дезертирство меньше, но дух −5.', fx: () => { const a = playerArmy(); a.morale -= 5; a.disc = G.day + 20; } }, { t: 'Помиловать и накормить', tip: 'Дух +4.', fx: () => { playerArmy().morale += 4; } }] },
];
function randomEvent() {
  const pa = playerArmy(); if (!pa || (typeof UI !== 'undefined' && UI.modalOpen())) return;
  const L = EVENTS.filter(e => (!G.evSeen || (G.evSeen[e.id] || -99) < G.day - 60) && e.cond());
  if (!L.length) return; const e = R.wpick(L, x => x.w);
  G.evSeen = G.evSeen || {}; G.evSeen[e.id] = G.day;
  const text = e.text();
  if (typeof UI !== 'undefined') UI.alert('event', { e, text });
}
