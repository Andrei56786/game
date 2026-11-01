'use strict';
// ===== SCREENS: windows, dialogs, battle screen, title =====
const INK = '#3a2614', INK2 = '#7a5a3a';
function winFrame(x, y, w, h, title, parch, noClose) {
  blocker(); dim(0.45);
  if (parch) panelParch(x, y, w, h); else panelWood(x, y, w, h);
  if (title) { if (parch) { txt(title, x + w / 2, y + 7, INK, { al: 'c' }); hline(x + 10, y + 17, w - 20, '#b89a68'); } else { txt(title, x + w / 2, y + 8, PAL.y, { al: 'c', sh: PAL.o }); } }
  if (!noClose) btn('w_close', x + w - 17, y + 4, 13, 12, { ic: 'i_close', style: 'dark', tip: 'Закрыть (Esc)', onClick: () => UI.shut() });
}
function tabs(x, y, list, w) { list.forEach((t, i) => btn('tab' + i, x + i * (w + 2), y, w, 13, { label: t, style: 'parch', active: UI.tab === i, onClick: () => { UI.tab = i; UI.scroll = 0; } })); }
function tcol(parch) { return parch ? INK : PAL.w; }
function kv(x, y, k, v, parch, vc) { txt(k, x, y, parch ? INK2 : '#c8b898'); txt(v, x + tw(k) + 4, y, vc || (parch ? INK : PAL.w)); }
function sbtn(id, x, y, w, label, onClick, o) { o = o || {}; return btn(id, x, y, w, 12, Object.assign({ label, onClick, style: o.style || 'wood' }, o)); }
const PRICE_K = s => (G.setts[s].ctrl === G.player.realm ? 1 : 1.25);
const ITEM_LOAD = { food: 1, fodder: 1, arrows: 0.1, weap: 2, horses: 0, wagons: 0, pitch: 5 };
function canCarry(pa, k, n) { return ITEM_LOAD[k] === 0 || armyLoad(pa) + ITEM_LOAD[k] * n <= armyCap(pa) + 0.01; }
// the price rises as the stalls empty (and falls as we sell): the cost of n is summed over the stock, not the price of one × n
const playerBuyCost = (sid, k, n) => buyCost(G.setts[sid], k, n) * PRICE_K(sid);
const playerSellGain = (sid, k, n) => sellGain(G.setts[sid], k, n) * 0.55 * (G.setts[sid].siege ? 1.5 : 1);
function buyItem(sid, k, n) {
  const S = G.setts[sid], pa = playerArmy(), r = G.realms[G.player.realm], p = priceOf(S, k) * PRICE_K(sid);
  n = Math.floor(Math.min(n, S.mk[k] || 0)); if (ITEM_LOAD[k]) n = Math.min(n, Math.floor((armyCap(pa) - armyLoad(pa)) / ITEM_LOAD[k]));
  let cost = playerBuyCost(sid, k, n); for (let i = 0; i < 12 && n > 0 && cost > r.gold; i++) { n = Math.floor(n * clamp(r.gold / cost * 0.98, 0.3, 0.98)); cost = playerBuyCost(sid, k, n); }
  if (n <= 0) { UI.toast(r.gold < p ? 'Не хватает золота.' : (S.mk[k] || 0) < 1 ? 'На рынке пусто.' : 'Обоз полон: купите повозки.'); return; }
  mkTake(S, k, n); pa[k] += n; r.gold -= cost; if (S.ctrl !== G.player.realm) dutyTo(S.ctrl, cost * 0.05);
  if (typeof Snd !== 'undefined') Snd.sfx('coin'); if (typeof TUT !== 'undefined') TUT.ev('buy', k);
}
function sellItem(sid, k, n) {
  const S = G.setts[sid], pa = playerArmy(), r = G.realms[G.player.realm]; n = Math.floor(Math.min(n, pa[k])); if (n <= 0) return;
  const g = playerSellGain(sid, k, n); pa[k] -= n; S.mk[k] = (S.mk[k] || 0) + n; r.gold += g; if (typeof Snd !== 'undefined') Snd.sfx('coin');
}
function recruit(sid, t, n) {
  const S = G.setts[sid], pa = playerArmy(), r = G.realms[G.player.realm]; n = Math.floor(Math.min(n, S.pool[t] || 0, r.gold / UNIT[t].cost));
  if (n <= 0) { UI.toast((S.pool[t] || 0) < 1 ? 'Некого набирать.' : 'Не хватает золота.'); return; }
  S.pool[t] -= n; pa.u[t] += n; r.gold -= n * UNIT[t].cost; if (t === 'levy') S.prosp = Math.max(5, S.prosp - n * 0.04); pa.xp[t] = (pa.xp[t] * (pa.u[t] - n) + 5 * n) / Math.max(1, pa.u[t]); if (typeof Snd !== 'undefined') Snd.sfx('coin'); if (typeof TUT !== 'undefined') TUT.ev('recruit', t);
}
function moveGar(sid, t, n) { const S = G.setts[sid], pa = playerArmy(); if (n > 0) { n = Math.min(n, pa.u[t]); pa.u[t] -= n; S.gar[t] += n; } else { n = Math.min(-n, S.gar[t]); S.gar[t] -= n; pa.u[t] += n; } }
function demandSurrender(sid) {
  const S = G.setts[sid], pa = playerArmy(); const ch = surrenderChance(pa, S);
  if (S.siege) S.siege.asked = G.day; else S.askDay = G.day;
  if (R.f() < ch) { captureSett(pa, S, 'сдались без боя'); G.realms[G.player.realm].prestige += 3; log('«Покорить чужое войско, не сражаясь, — вот лучшее из лучшего» (гл. 3).', 'title'); if (typeof TUT !== 'undefined') TUT.ev('surrender', sid); UI.shut(); }
  else { UI.toast('Гарнизон отказался сдаться.'); log('Гарнизон ' + WD.setts[sid].name + ' отказался сдаться.', 'info'); }
}
function fireAttack(sid) {
  const S = G.setts[sid], pa = playerArmy(), Wt = weatherOf();
  if (pa.pitch < 3) { UI.toast('Нужно 3 бочки горючей смолы.'); return; }
  if (Wt.wet || Wt.cold) { UI.toast('Сыро — огонь не возьмётся. Ждите сухой погоды.'); return; }
  pa.pitch -= 3; let eff = Wt.dry ? 1 : 0.5; if (Wt.windy) eff *= 1.35;
  const burned = Math.round(S.food * 0.55 * eff); S.food -= burned; const k = takeU(S.gar, Math.round(menOf(S.gar) * 0.07 * eff));
  if (S.siege) S.siege.works = Math.min(S.siege.need, S.siege.works + S.siege.need * 0.15 * eff); S.fired = G.day;
  log('Огненная атака на ' + WD.setts[sid].name + '! Сгорело запасов на ' + burned + ' дн., погибло ' + k + ' защитников.' + (eff < 0.7 ? ' Без ветра и зноя огонь слаб.' : ''), 'good');
  if (typeof Snd !== 'undefined') Snd.sfx('fire'); if (typeof TUT !== 'undefined') TUT.ev('fire', sid);
}
function assault(sid, tactical) {
  const S = G.setts[sid], pa = playerArmy(), ws = WD.setts[sid]; const works = S.siege ? S.siege.works / Math.max(1, S.siege.need) : 0; UI.shut();
  if (tactical) startBattle(sideFromArmy(pa, { ground: 'open' }), sideFromGarrison(S), ws.i, { siege: S.walls > 0, works, sett: sid });
  else { const res = autoBattleGarrison(pa, S, true); res.sett = sid; res.auto = true; if (res.win) captureSett(pa, S, 'штурм'); UI.alert('bres', res); }
}
// ---------- settlement window ----------
function drawSettWin(w) {
  const sid = w.id, s = WD.setts[sid], S = G.setts[sid], pa = playerArmy(); if (!pa) { UI.shut(); return; }
  const X = 100, Y = 30, WW = 440, HH = 300; const typ = { village: 'Деревня', castle: 'Замок', town: 'Город', capital: 'Столица' }[s.type];
  winFrame(X, Y, WW, HH, null, true);
  const sp = settSprite(s.type, WD.provs[s.prov].cul || 'K', sid); ctx.drawImage(sp.c, X + 10, Y + 8, sp.w * 2 > 70 ? sp.w : sp.w * 2, sp.w * 2 > 70 ? sp.h : sp.h * 2);
  spr('shield' + S.ctrl, X + 76, Y + 10); txt(s.name, X + 92, Y + 10, INK); txt(typ + ' · ' + REALM_DEF[S.ctrl].name + (S.owner !== S.ctrl ? ' (занято)' : ''), X + 92, Y + 21, INK2);
  txt('Провинция ' + WD.provs[s.prov].name + ' · жителей ' + fmt(S.pop) + (S.walls ? ' · стены: ' + ['нет', 'частокол', 'камень', 'мощные'][S.walls] : ''), X + 92, Y + 31, INK2, { f: 's' });
  const near = Math.hypot(s.x + 0.5 - pa.x, s.y + 0.5 - pa.y) < 1.5, own = S.ctrl === G.player.realm, host = hostile(G.player.realm, S.ctrl);
  const T = own ? ['Рынок', 'Набор', 'Гарнизон', 'Товары', 'Сведения'] : host ? ['Осада', 'Товары', 'Сведения'] : S.ctrl === 5 ? ['Рынок', 'Осада', 'Товары', 'Сведения'] : ['Рынок', 'Товары', 'Сведения']; if (UI.tab >= T.length) UI.tab = 0;
  tabs(X + 12, Y + 44, T, T.length > 4 ? 80 : 76); const tab = T[UI.tab]; const y0 = Y + 64;
  if (!near && tab !== 'Сведения' && tab !== 'Товары') { para('Войско короля далеко отсюда. Подойдите к поселению, чтобы торговать, набирать воинов или вести осаду.', X + 20, y0 + 20, WW - 40, INK); sbtn('s_go', X + WW / 2 - 50, y0 + 60, 100, 'Идти сюда', () => { UI.shut(); orderMove(s.i, () => arriveSett(sid)); }); return; }
  if (tab === 'Рынок') drawMarket(sid, X, y0, WW);
  else if (tab === 'Набор') drawRecruit(sid, X, y0, WW);
  else if (tab === 'Гарнизон') drawGarrison(sid, X, y0, WW);
  else if (tab === 'Осада') drawSiegeTab(sid, X, y0, WW);
  else if (tab === 'Товары') drawGoodsTab(sid, X, y0, WW);
  else drawSettInfo(sid, X, y0, WW);
}
function drawMarket(sid, X, y0, WW) {
  const S = G.setts[sid], pa = playerArmy(), r = G.realms[G.player.realm];
  txt('Товар', X + 30, y0, INK2, { f: 's' }); txt('На рынке', X + 120, y0, INK2, { f: 's' }); txt('Цена', X + 172, y0, INK2, { f: 's' }); txt('В обозе', X + 210, y0, INK2, { f: 's' }); txt('Купить', X + 268, y0, INK2, { f: 's' }); txt('Продать', X + 372, y0, INK2, { f: 's' });
  const items = [['food', 'i_food', [100, 500, 2000]], ['fodder', 'i_fodder', [50, 200, 800]], ['arrows', 'i_arrows', [100, 500, 2000]], ['weap', 'i_weap', [5, 20, 60]], ['horses', 'i_horse', [1, 5, 20]], ['wagons', 'i_wagon', [1, 2, 5]], ['pitch', 'i_fire', [1, 3, 6]]];
  items.forEach(([k, ic, qs], i) => {
    const y = y0 + 12 + i * 22; if (i % 2 === 0) rect(X + 14, y - 3, WW - 28, 20, 'rgba(160,120,60,0.12)');
    spr(ic, X + 18, y + 2); txt(ITEMN[k], X + 30, y + 2, INK);
    const tipItem = { food: 'Еда: 1 в день на воина (и на раненых, больных).', fodder: 'Корм коням: всадник 1, повозка 2 в день. Весной и летом кони пасутся.', arrows: 'Лучник тратит до 40 стрел за бой.', weap: 'Запасное оружие: вооружить ополченцев копьями (окно войска).', horses: 'Кони: посадить воинов на коней или заменить павших.', wagons: 'Повозка везёт 400. Тянут её 2 вола (корм!). Замедляет на бездорожье.', pitch: 'Горючая смола для огненной атаки (гл. 12). Нужна сухая погода.' }[k];
    hit(X + 16, y - 2, 96, 14, { id: 'mk' + k, tip: [ITEMN[k], tipItem] });
    const p = priceOf(S, k) * PRICE_K(sid), rel = pxRel(S, k), stock = S.mk[k] || 0;
    txt(fmt(stock), X + 120, y + 2, INK); txt(fpx(p), X + 172, y + 2, relCol(rel, true)); txt(fmt(pa[k] || 0), X + 210, y + 2, INK);
    hit(X + 170, y - 2, 36, 14, { id: 'mkp' + k, tip: [GD[k].n + ': ' + fpx(p) + ' зол. за штуку', 'Обычная цена ' + fpx(GD[k].p * PRICE_K(sid)) + '; здесь ' + relTxt(rel) + ' — ' + supplyWord(rel) + '.', { t: 'Чем больше берёте, тем дороже каждая следующая штука: прилавки пустеют.', c: UIC.dim }].concat(marketTipLines(k, sid)) });
    qs.forEach((q, j) => { const n = Math.min(q, Math.floor(stock)); sbtn('mb' + k + j, X + 250 + j * 38, y, 36, '+' + q, () => buyItem(sid, k, q), { style: 'parch', tip: n > 0 ? 'Купить ' + n + ' за ' + Math.ceil(playerBuyCost(sid, k, n)) + ' зол.' + (n < q ? ' (больше нет)' : '') : 'На рынке пусто.' }); });
    sbtn('ms' + k, X + 368, y, 26, '−' + qs[0], () => sellItem(sid, k, qs[0]), { style: 'parch', tip: 'Продать ' + qs[0] + ' за ' + Math.floor(playerSellGain(sid, k, qs[0])) + ' зол.' });
    sbtn('ms2' + k, X + 396, y, 30, '−' + qs[1], () => sellItem(sid, k, qs[1]), { style: 'parch', tip: 'Продать ' + qs[1] + ' за ' + Math.floor(playerSellGain(sid, k, qs[1])) + ' зол.' });
  });
  const yb = y0 + 12 + 7 * 22 + 2; const load = armyLoad(pa), cap = armyCap(pa);
  txt('Обоз: ' + Math.round(load) + ' / ' + cap, X + 20, yb, load > cap * 0.9 ? '#a0302a' : INK); bar(X + 120, yb, 120, 7, load / cap, '#a8743e', '#d6be8c');
  txt('Казна: ' + Math.round(r.gold) + ' зол.', X + 260, yb, INK);
  const pa2 = playerArmy(), eat = armyMen(pa2) + pa2.wounded + pa2.sick; txt('Провианта на ' + (pa2.food / Math.max(1, eat)).toFixed(1) + ' дн.' + (S.ctrl !== G.player.realm ? ' · чужой рынок: цены +25% (пошлина хозяевам)' : '') + ' · все товары — вкладка «Товары»', X + 20, yb + 11, INK2, { f: 's' });
}
function drawRecruit(sid, X, y0, WW) {
  const S = G.setts[sid], pa = playerArmy();
  txt('Отряд', X + 30, y0, INK2, { f: 's' }); txt('Готовы', X + 130, y0, INK2, { f: 's' }); txt('Цена', X + 180, y0, INK2, { f: 's' }); txt('Жалов./день', X + 218, y0, INK2, { f: 's' }); txt('В войске', X + 280, y0, INK2, { f: 's' });
  const PR = poolRates(S), L = UT.filter(t => PR[t] > 0 || (S.pool[t] || 0) >= 1), rh = L.length > 5 ? 17 : 24;
  L.forEach((t, i) => {
    const y = y0 + 12 + i * rh; if (i % 2 === 0) rect(X + 14, y - 4, WW - 28, rh - 2, 'rgba(160,120,60,0.12)');
    const U = UNIT[t]; spr(UICON[t], X + 18, y + 1); txt(U.n, X + 30, y + 1, INK);
    hit(X + 16, y - 3, 100, 14, { id: 'rc' + t, tip: [U.n, 'Атака ' + U.atk + ' · защита ' + U.def + ' · стойкость ' + U.hp + ' · дух ' + U.mor, UNIT_TIP[t]] });
    txt(String(Math.floor(S.pool[t] || 0)), X + 130, y + 1, INK); txt(U.cost + '', X + 180, y + 1, INK); txt(U.upk.toFixed(2).replace('.', ','), X + 222, y + 1, INK); txt(String(Math.round(pa.u[t])), X + 280, y + 1, INK);
    sbtn('rb1' + t, X + 320, y - 1, 30, '+1', () => recruit(sid, t, 1), { style: 'parch' }); sbtn('rb10' + t, X + 352, y - 1, 30, '+10', () => recruit(sid, t, 10), { style: 'parch' }); sbtn('rbA' + t, X + 384, y - 1, 40, 'Все', () => recruit(sid, t, 9999), { style: 'parch' });
  });
  para('Набор пополняется каждый день; разорение провинции и смута его уменьшают. Здешние земли дают: ' + (L.length ? L.map(t => UNIT[t].n.toLowerCase()).join(', ') : 'никого') + '. Жалованье платится из казны ежедневно — «тысяча колесниц стоит тысячу золотых в день» (гл. 2).', X + 20, y0 + 16 + L.length * rh, WW - 40, INK2, { f: 's', lh: 9 });
}
function drawGarrison(sid, X, y0, WW) {
  const S = G.setts[sid], pa = playerArmy();
  txt('Отряд', X + 30, y0, INK2, { f: 's' }); txt('В войске', X + 140, y0, INK2, { f: 's' }); txt('В гарнизоне', X + 322, y0, INK2, { f: 's' });
  const GL = UT.filter(t => (pa.u[t] || 0) > 0 || (S.gar[t] || 0) > 0), gh = GL.length > 5 ? 16 : 22;
  GL.forEach((t, i) => {
    const y = y0 + 12 + i * gh; spr(UICON[t], X + 18, y + 1); txt(UNIT[t].n, X + 30, y + 1, INK);
    txt(String(Math.round(pa.u[t])), X + 140, y + 1, INK); txt(String(Math.round(S.gar[t])), X + 322, y + 1, INK);
    sbtn('g1' + t, X + 172, y - 1, 70, 'Оставить 10', () => moveGar(sid, t, 10), { style: 'parch' }); sbtn('g2' + t, X + 246, y - 1, 66, 'Забрать 10', () => moveGar(sid, t, -10), { style: 'parch' });
  });
  const b = baseGarrison(S); para('Обычный гарнизон: ' + menOf(b) + '. Гарнизон получает четверть жалованья. Пустая крепость падёт от первой же шайки. «Не надейся, что враг не придёт, — надейся на то, что ты готов его встретить» (гл. 8).', X + 20, y0 + 16 + GL.length * gh, WW - 40, INK2, { f: 's', lh: 9 });
}
function drawSettInfo(sid, X, y0, WW) {
  const s = WD.setts[sid], S = G.setts[sid], P = G.provs[s.prov], own = S.ctrl === G.player.realm, vis = own || G.vis[s.i] === 2 || hasInward(S.ctrl);
  let y = y0;
  kv(X + 20, y, 'Процветание:', Math.round(S.prosp) + '%', true); bar(X + 120, y, 80, 7, S.prosp / 100, '#7fb04c', '#d6be8c'); y += 13;
  kv(X + 20, y, 'Разорение:', Math.round(P.dev * 100) + '%', true, P.dev > 0.3 ? '#a0302a' : INK); y += 13;
  kv(X + 20, y, 'Смута:', Math.round(P.unrest) + '%', true, P.unrest > 50 ? '#a0302a' : INK); y += 13;
  { const gl = vis ? UT.filter(t => S.gar[t] > 0).map(t => UNIT[t].n.toLowerCase() + '\u00a0' + Math.round(S.gar[t])).join(', ') : '', gs = vis ? menOf(S.gar) + (gl ? ' (' + gl + ')' : '') : 'неизвестно';
    if (tw('Гарнизон: ' + gs) < WW - 50) { kv(X + 20, y, 'Гарнизон:', gs, true); y += 13; }
    else { kv(X + 20, y, 'Гарнизон:', String(menOf(S.gar)), true); y += 11; y += para(gl, X + 30, y, WW - 60, INK, { f: 's', lh: 9 }) + 3; } }
  kv(X + 20, y, 'Запасы крепости:', vis ? Math.round(S.food) + ' дн.' : '?', true); y += 13;
  { const own2 = G.setts[WD.provs[s.prov].seat].ctrl === G.player.realm, K = crownK(G.player.realm); kv(X + 20, y, 'Доход провинции:', own2 ? fq(provIncome(s.prov) * K) + ' зол./день (подати ' + fq((P.ecTax || 0) * K) + ', цеха ' + fq((P.ecCraft || 0) * K) + ')' : 'платит не нам', true); y += 13; }
  { const r = S.res || settRiches(S), rl = RICH_N.filter(([k]) => r[k] > 0.05).map(([k, n]) => n + ' ×' + r[k].toFixed(1).replace('.', ',')); kv(X + 20, y, 'Богатства:', rl.join(' · ') || 'скудные', true); y += 13; }
  if (S.lord >= 0) { const l = charOf(S.lord); kv(X + 20, y, 'Владетель:', charName(l) + ' (' + l.traits.map(t => TRAITS[t].n).join(', ') + ')', true); y += 13; }
  y += 4; para({ village: 'Деревня кормит округу: здесь можно купить провиант и фураж и набрать ополченцев.', castle: 'Замок — опора власти в провинции: копейщики, латники, всадники. Стены задержат любого врага.', town: 'Город — торговля: стрелы, оружие, повозки, смола. Много ополчения.', capital: 'Столица державы. Падение столицы потрясает всю державу. Две чужие столицы и своя — победа мечом.' }[s.type], X + 20, y, WW - 40, INK2, { lh: 10 });
  const pa = playerArmy(); const near = pa && Math.hypot(s.x + 0.5 - pa.x, s.y + 0.5 - pa.y) < 1.5;
  if (near && pa.prisoners > 0 && !hostile(G.player.realm, S.ctrl) && s.type !== 'village') { const g = Math.round(pa.prisoners * 1.5); sbtn('s_pris', X + 20, Y_BOTTOM(y0), 180, 'Продать пленных (' + pa.prisoners + ') за ' + g + ' зол.', () => { G.realms[G.player.realm].gold += g; pa.prisoners = 0; Snd.sfx('coin'); }, { style: 'parch' }); }
  if (near && own && pa.u.levy > 0) sbtn('s_disb', X + 210, Y_BOTTOM(y0), 200, 'Распустить ополченцев по домам (' + Math.round(pa.u.levy) + ')', () => { const n = Math.round(pa.u.levy); pa.u.levy = 0; S.pool.levy = (S.pool.levy || 0) + n * 0.8; log('Ополченцы (' + n + ') распущены по домам.', 'info'); }, { style: 'parch', tip: 'Меньше ртов и жалованья. Они вернутся в набор.' });
}
const Y_BOTTOM = y0 => y0 + 196;
function drawSiegeTab(sid, X, y0, WW) {
  const s = WD.setts[sid], S = G.setts[sid], pa = playerArmy(); const sg = S.siege && S.siege.by === pa.id ? S.siege : null; let y = y0;
  const ch = surrenderChance(pa, S); const ratio = powerU(pa.u, pa.xp) / Math.max(1, powerU(S.gar) * (1 + S.walls * 0.5));
  kv(X + 20, y, 'Гарнизон:', voin(menOf(S.gar)) + (S.walls ? ' за стенами (' + ['', 'частокол', 'камень', 'мощные'][S.walls] + ')' : ' (стен нет)'), true); y += 13;
  kv(X + 20, y, 'Соотношение сил:', ratio.toFixed(1).replace('.', ',') + ' : 1 (с учётом стен)', true, ratio > 2 ? '#2a6a2a' : ratio < 1 ? '#a0302a' : INK); y += 13;
  kv(X + 20, y, 'Шанс сдачи:', Math.round(ch * 100) + '%', true); y += 13;
  if (sg) {
    kv(X + 20, y, 'Осада идёт:', (G.day - sg.d0) + ' дн.', true); y += 13;
    txt('Лестницы и тараны:', X + 20, y, INK2); bar(X + 130, y, 120, 8, sg.works / sg.need, '#a8743e', '#d6be8c'); txt(Math.round(sg.works / sg.need * 100) + '%', X + 256, y, INK); y += 13;
    kv(X + 20, y, 'Запасы осаждённых:', Math.round(S.food) + ' дн.' + (S.food <= 0 ? ' — ГОЛОД!' : ''), true, S.food <= 3 ? '#a0302a' : INK); y += 13;
    const eat = armyMen(pa) + pa.wounded + pa.sick; kv(X + 20, y, 'Наш провиант:', (pa.food / Math.max(1, eat)).toFixed(1) + ' дн.', true); y += 13;
  }
  y += 4; para(sg ? '«Худшее — осаждать крепости» (гл. 3). Каждый день осады — болезни и расход провианта. Дождитесь лестниц или голода — или возьмите хитростью.' : S.walls ? 'Крепость. Можно осадить (строить лестницы, морить голодом), потребовать сдачи или идти на штурм с ходу — через ворота, под стрелами.' : 'Стен нет — защитников можно разбить сразу.', X + 20, y, WW - 40, INK2, { lh: 10 }); y += 26;
  const by = Y_BOTTOM(y0) - 24; const asked = sg ? G.day - sg.asked < 5 : G.day - (S.askDay || -99) < 5;
  sbtn('sg_dem', X + 20, by, 130, 'Потребовать сдачи', () => demandSurrender(sid), { style: 'parch', disabled: asked, tip: asked ? 'Гонцов отправляют не чаще раза в 5 дней.' : 'Шанс ' + Math.round(ch * 100) + '%. Растёт с голодом, временем осады и нашей грозной славой.' });
  if (S.walls && !sg) sbtn('sg_start', X + 156, by, 110, 'Осадить', () => { startSiege(pa, sid); log('Мы осадили ' + s.name + '.', 'info'); if (typeof TUT !== 'undefined') TUT.ev('siege', sid); }, { style: 'parch', tip: 'Встать лагерем, строить лестницы и тараны, отрезать подвоз.' });
  if (sg) sbtn('sg_lift', X + 156, by, 110, 'Снять осаду', () => { endSiege(pa); UI.shut(); }, { style: 'parch' });
  sbtn('sg_fire', X + 272, by, 140, 'Огненная атака (смола: ' + pa.pitch + ')', () => fireAttack(sid), { style: 'parch', disabled: pa.pitch < 3 || G.day - (S.fired || -99) < 3, tip: ['Огненная атака (гл. 12)', '3 бочки смолы. Жжёт запасы и защитников. «Для огня нужно подходящее время: сухая погода, дни ветра». Дождь и снег — бесполезно.', 'Сейчас: ' + weatherOf().n] });
  const works = sg ? sg.works / sg.need : 0; const warn = S.walls && works < 1 ? ' (без лестниц — только ворота!)' : '';
  sbtn('sg_ast', X + 20, by + 16, 190, (S.walls ? 'Штурм — командовать' : 'В бой — командовать') + warn.slice(0, 0), () => assault(sid, true), { style: 'parch', tip: 'Тактический бой на стенах.' + warn });
  sbtn('sg_aut', X + 216, by + 16, 196, S.walls ? 'Штурм — автобой' + (works < 1 ? ' (тяжело)' : '') : 'В бой — автобой', () => assault(sid, false), { style: 'parch', tip: 'Быстрый расчёт исхода.' + warn });
}
// ---------- army window ----------
function convertUnits(from, to, n, need) {
  const pa = playerArmy(); n = Math.floor(Math.min(n, pa.u[from], need === 'weap' ? pa.weap : pa.horses));
  if (n <= 0) { UI.toast(need === 'weap' ? 'Нужно запасное оружие (рынок города).' : 'Нужны запасные кони.'); return; }
  pa.u[from] -= n; pa.u[to] += n; pa[need === 'weap' ? 'weap' : 'horses'] -= n; pa.xp[to] = (pa.xp[to] * (pa.u[to] - n) + pa.xp[from] * n * 0.7) / Math.max(1, pa.u[to]);
  UI.toast((to === 'spear' ? 'Вооружено копьями: ' : 'Посажено на коней: ') + n); if (typeof TUT !== 'undefined') TUT.ev('convert', to);
}
function drawArmyWin() {
  const pa = playerArmy(); if (!pa) { UI.shut(); return; } const X = 70, Y = 26, WW = 500, HH = 312, g = charOf(pa.gen);
  winFrame(X, Y, WW, HH, 'Войско короля', false);
  drawPortrait(g, X + 12, Y + 22, 1); strokeR(X + 11, Y + 21, 50, 50, '#c9a060');
  txt(charName(g), X + 68, Y + 24, PAL.y); txt('Войн. ' + g.mar + ' · Дипл. ' + g.dip + ' · Интр. ' + g.intr, X + 68, Y + 35, '#c8b898', { f: 's' });
  g.traits.forEach((t, i) => { const tx = X + 68 + i * 70; btn('tr' + t, tx, Y + 45, 66, 11, { label: TRAITS[t].n, style: 'dark', tip: [TRAITS[t].n, TRAITS[t].d] }); });
  let y = Y + 80; txt('Отряд', X + 14, y, '#c8b898', { f: 's' }); txt('Числ.', X + 104, y, '#c8b898', { f: 's' }); txt('Опыт', X + 140, y, '#c8b898', { f: 's' }); y += 10;
  for (const t of UT) { spr(UICON[t], X + 14, y + 1); txt(UNIT[t].n, X + 24, y + 1, PAL.w); txt(String(Math.round(pa.u[t])), X + 104, y + 1, PAL.w); bar(X + 140, y + 1, 50, 6, pa.xp[t] / 100, '#7ab0ee'); hit(X + 12, y - 1, 186, 11, { id: 'aw' + t, tip: [UNIT[t].n, 'Атака ' + UNIT[t].atk + ', защита ' + UNIT[t].def + ', опыт ' + Math.round(pa.xp[t]) + '/100'] }); y += 12; }
  txt('Всего: ' + armyMen(pa) + ' · раненых ' + Math.round(pa.wounded) + ' · больных ' + Math.round(pa.sick), X + 14, y + 2, PAL.w, { f: 's' }); y += 12;
  if (pa.prisoners) { txt('Пленных: ' + pa.prisoners + ' (продать в городе)', X + 14, y + 2, '#c8b898', { f: 's' }); y += 11; }
  y += 4;
  sbtn('aw_arm', X + 12, y, 186, 'Вооружить 10 ополченцев', () => convertUnits('levy', 'spear', 10, 'weap'), { tip: 'Ополченец + запасное оружие = копейщик. Оружие: ' + pa.weap }); y += 14;
  sbtn('aw_horse', X + 12, y, 186, 'Посадить 10 копейщиков на коней', () => convertUnits('spear', 'horse', 10, 'horses'), { tip: 'Копейщик + запасной конь = всадник. Коней: ' + pa.horses }); y += 14;
  sbtn('aw_wag', X + 12, y, 186, 'Бросить повозку', () => { if (pa.wagons > 0) { pa.wagons--; const over = armyLoad(pa) - armyCap(pa); if (over > 0) pa.food = Math.max(0, pa.food - over); } }, { disabled: !pa.wagons, tip: 'Повозки замедляют по бездорожью и едят фураж. Лишний груз будет брошен.' }); y += 14;
  if (pa.prisoners) { sbtn('aw_free', X + 12, y, 186, 'Отпустить пленных (честь)', () => { pa.prisoners = 0; for (let x = 1; x < 5; x++) if (rulerOf(x).traits.includes('honest')) addOpn(x, G.player.realm, 3); log('Пленные отпущены по домам. Об этом узнают при дворах.', 'good'); }, {}); y += 14; }
  // right column: supplies
  const RX = X + 214; let ry = Y + 24; const men = armyMen(pa), eat = men + pa.wounded + pa.sick, horsesN = mountedN(pa.u) + pa.horses + pa.wagons * 2;
  txt('Припасы', RX, ry, PAL.y); ry += 11;
  const season = seasonOf(G.day), grassy = [TR.GRASS, TR.STEPPE, TR.FARM, TR.HILLS, TR.BEACH].includes(WD.ter[armyTile(pa)]), graze = grassy ? [0.7, 0.9, 0.5, 0][season] : [0.3, 0.4, 0.2, 0][season];
  const rows = [['i_food', 'Провиант', pa.food, pa.townFed > 0 ? Math.max(0, eat - pa.townFed) : eat, pa.townFed > 0 ? 'постой: кормит город' : ''], ['i_fodder', 'Фураж', pa.fodder, horsesN * (1 - graze), graze ? 'выпас ' + Math.round(graze * 100) + '%' : 'выпаса нет'], ['i_water', 'Вода', pa.water, nearWater(armyTile(pa)) ? 0 : 1, nearWater(armyTile(pa)) ? 'вода рядом' : 'нет воды рядом'], ['i_arrows', 'Стрелы', pa.arrows, 0, rangedN(pa.u) ? Math.round(pa.arrows / Math.max(1, rangedN(pa.u))) + ' на стрелка' : ''], ['i_weap', 'Оружие', pa.weap, 0, 'запас'], ['i_horse', 'Кони', pa.horses, 0, 'запасные'], ['i_wagon', 'Повозки', pa.wagons, 0, 'по 400'], ['i_fire', 'Смола', pa.pitch, 0, 'для огня']];
  for (const [ic, n, have, per, note] of rows) { spr(ic, RX, ry + 1); txt(n, RX + 11, ry + 1, PAL.w); txt(fmt(have), RX + 72, ry + 1, PAL.w); if (per > 0) { const d = have / per; txt('−' + (per < 10 ? per.toFixed(1) : Math.round(per)) + '/д · ' + (d > 99 ? '99+' : d.toFixed(1)) + ' дн.', RX + 108, ry + 1, d < 3 ? UIC.bad : d < 7 ? UIC.warn : UIC.good, { f: 's' }); } else txt(note, RX + 108, ry + 1, '#9a8a70', { f: 's' }); if (per > 0 && note) txt(note, RX + 200, ry + 1, '#9a8a70', { f: 's' }); ry += 10; }
  const load = armyLoad(pa), cap = armyCap(pa); txt('Обоз ' + Math.round(load) + '/' + cap, RX, ry + 2, PAL.w, { f: 's' }); bar(RX + 70, ry + 2, 100, 6, load / cap, '#a8743e'); ry += 14;
  // morale breakdown
  const L = moraleTarget(pa), tg = clamp(L.reduce((s, l) => s + l.v, 0), 5, 100);
  txt('Боевой дух ' + Math.round(pa.morale) + ' → ' + tg, RX, ry, PAL.y); bar(RX + 110, ry + 1, 80, 6, pa.morale / 100, pa.morale < 35 ? '#c0353f' : '#7fb04c'); ry += 11;
  L.slice(0, 7).forEach((l, i) => { txt((l.v > 0 ? '+' : '−') + Math.abs(l.v) + ' ' + l.t, RX + (i % 2) * 140, ry + Math.floor(i / 2) * 9, l.v > 0 ? UIC.good : UIC.bad, { f: 's' }); }); ry += Math.ceil(Math.min(7, L.length) / 2) * 9 + 4;
  txt('Усталость ' + Math.round(pa.fat) + '%', RX, ry, PAL.w, { f: 's' }); bar(RX + 70, ry, 60, 6, pa.fat / 100, '#c9a060'); txt('Скорость ' + armySpeed(pa).toFixed(1) + ' кл./день', RX + 140, ry, PAL.w, { f: 's' }); ry += 12;
  const G0 = GROUNDS[pa.ground || 'open']; txt('Земля: ' + G0.n, RX, ry, '#c8d8a8'); ry += 10; ry += para('«' + G0.q + '» ' + G0.e, RX, ry, 270, '#e8d8b0', { f: 's', lh: 9 }) + 2;
  // modes
  const my = Y + HH - 30; txt('Режим:', X + 14, my + 3, '#c8b898');
  const modes = ['camp', 'fort', 'hide', 'forage', 'drill']; modes.forEach((m, i) => btn('awm' + m, X + 52 + i * 78, my, 76, 13, { label: MODE_INFO[m].n.replace('Укреплённый лагерь', 'Укрепиться').replace('Скрытый лагерь', 'Затаиться'), ic: MODE_INFO[m].ic, active: !pa.path && pa.mode === m, tip: [MODE_INFO[m].n, MODE_INFO[m].d], onClick: () => setMode(m) }));
  btn('awm_forced', X + 52, my + 15, 150, 12, { label: 'Форсированный марш: ' + (pa.forced ? 'да' : 'нет'), active: !!pa.forced, onClick: () => { pa.forced = pa.forced ? 0 : 1; if (typeof TUT !== 'undefined') TUT.ev('forced', pa.forced); }, tip: 'Скорость +35%, усталость ×3.' });
  btn('awm_fires', X + 206, my + 15, 150, 12, { label: 'Ложные костры: ' + (pa.fires ? 'да' : 'нет'), active: !!pa.fires, onClick: () => setMode('fires'), tip: 'Враг сочтёт войско почти вдвое большим.' });
}
// ---------- diplomacy ----------
function accTip(title, a) {
  const L = [title]; for (const l of a.lines) { if (l.v === -999) return [title, { t: l.t, c: UIC.bad }]; L.push({ t: (l.v > 0 ? '+' : '−') + Math.abs(l.v) + ' ' + l.t, c: l.v > 0 ? UIC.good : UIC.bad }); }
  L.push({ t: 'Итого ' + (a.sum > 0 ? '+' : '') + a.sum + ': ' + (a.ok ? 'согласятся' : 'откажут'), c: a.ok ? PAL.y : '#ff9a8a' }); return L;
}
function relStatus(p, t) {
  const r = G.rel[p][t]; if (r.war) return { s: 'Война', c: '#a0302a', ic: 'i_sword' }; if (r.ally) return { s: 'Союз', c: '#2a6a2a', ic: 'i_dip' };
  if (r.pact > G.day) return { s: 'Пакт (' + (r.pact - G.day) + ' дн.)', c: '#2a5a8a', ic: 'i_scroll' }; if (r.truce > G.day) return { s: 'Перемирие (' + (r.truce - G.day) + ' дн.)', c: '#7a5a2a', ic: 'i_hourglass' };
  return { s: 'Мир', c: INK, ic: null };
}
function drawDiploWin(w) {
  const X = 24, Y = 24, WW = 592, HH = 316, p = G.player.realm; winFrame(X, Y, WW, HH, 'Дипломатия · Совет держав', true);
  let ly = Y + 24;
  for (let i = 0; i < 5; i++) {
    if (i === p) continue; const sel = w.t === i, R0 = G.realms[i], ru = rulerOf(i), st = relStatus(p, i), dead = R0.dead;
    rect(X + 10, ly, 150, 44, sel ? 'rgba(160,110,50,0.35)' : 'rgba(160,120,60,0.12)'); if (sel) strokeR(X + 10, ly, 150, 44, '#8a5a34');
    spr('shield' + i, X + 14, ly + 4); txt(REALM_DEF[i].name, X + 30, ly + 4, dead ? '#9a8a70' : INK); txt(dead ? 'пала' : ru.title + ' ' + ru.name, X + 30, ly + 14, INK2, { f: 's' });
    if (!dead) { if (st.ic) spr(st.ic, X + 30, ly + 25); txt(st.s, X + 30 + (st.ic ? 8 : 0), ly + 25, st.c, { f: 's' }); const op = opinionOf(i, p); txt((op >= 0 ? '+' : '−') + Math.abs(Math.round(op)), X + 150, ly + 4, op >= 10 ? '#2a6a2a' : op <= -10 ? '#a0302a' : INK, { al: 'r' }); }
    hit(X + 10, ly, 150, 44, { id: 'dl' + i, cursor: true, onClick: () => { w.t = i; }, tip: dead ? null : 'Мнение о нас: ' + Math.round(opinionOf(i, p)) });
    ly += 48;
  }
  // free lands note
  para('Вольные земли: бароны без короля. Их можно брать силой, не объявляя войны.', X + 12, ly + 2, 150, INK2, { f: 's', lh: 9 });
  const t = w.t; if (t === p || t === undefined) return; const R0 = G.realms[t], ru = rulerOf(t), rr = G.rel[p][t];
  const RX = X + 172, RY = Y + 24; drawPortrait(ru, RX, RY, 1); strokeR(RX - 1, RY - 1, 50, 50, '#8a5a34');
  txt(ru.title + ' ' + ru.name + ', ' + yrs(ru.age), RX + 56, RY + 2, INK); txt(REALM_DEF[t].name + ' · ' + (R0.dead ? 'держава пала' : relStatus(p, t).s), RX + 56, RY + 13, relStatus(p, t).c);
  ru.traits.forEach((tr, i) => btn('dtr' + tr, RX + 56 + i * 70, RY + 24, 66, 11, { label: TRAITS[tr].n, style: 'parch', tip: [TRAITS[tr].n, TRAITS[tr].d] }));
  txt('Воин. ' + ru.mar + ' · Дипл. ' + ru.dip + ' · Интр. ' + ru.intr + ' · Упр. ' + ru.stew, RX + 56, RY + 39, INK2, { f: 's' });
  if (R0.dead) return;
  let y = RY + 56; const op = opinionOf(t, p), ob = opinionBreakdown(t, p);
  kv(RX, y, 'Мнение о нас:', (op >= 0 ? '+' : '−') + Math.abs(Math.round(op)), true, op >= 10 ? '#2a6a2a' : op <= -10 ? '#a0302a' : INK); hit(RX, y - 2, 120, 11, { id: 'd_op', tip: ['Почему так:'].concat(ob.map(l => ({ t: (l.v >= 0 ? '+' : '−') + Math.abs(l.v) + ' ' + l.t, c: l.v >= 0 ? UIC.good : UIC.bad }))) });
  const inw = hasInward(t); kv(RX + 130, y, 'Казна:', inw ? Math.round(R0.gold) + ' зол.' : '? (нужен лазутчик)', true); y += 12;
  const mp = realmPower(p), tp = realmPower(t, p); kv(RX, y, 'Сила (наша / их):', fmt(mp) + ' / ' + (inw ? '' : '~') + fmt(tp), true); bar(RX + 170, y, 100, 7, mp / Math.max(1, mp + tp), '#3b6fd0', '#c0353f'); y += 12;
  const forts = G.setts.filter(S => S.ctrl === t && WD.setts[S.id].type !== 'village').length; kv(RX, y, 'Крепостей:', String(forts), true); kv(RX + 130, y, 'Войн ведут:', String(warsOf(t).length), true); y += 12;
  if (rr.war) { const ws = warScore(p, t); kv(RX, y, 'Счёт войны:', (ws >= 0 ? '+' : '−') + Math.abs(ws), true, ws > 0 ? '#2a6a2a' : ws < 0 ? '#a0302a' : INK); bar(RX + 120, y, 150, 7, (ws + 100) / 200, '#3b6fd0', '#c0353f'); y += 12; }
  y += 4; const bx = RX, bw = 196; let by = y;
  const B = (id, label, f, o) => { sbtn(id, bx + (o && o.col ? bw + 6 : 0), by, bw, label, f, Object.assign({ style: 'parch' }, o)); if (o && o.col) by += 15; };
  btn('d_reck', bx, by, bw, 12, { label: 'Расчёт перед войной (гл. 1)', style: 'parch', onClick: () => UI.alert('reckon', { t, declare: false }), tip: 'Семь сопоставлений Сунь-цзы: кто победит?' });
  if (!rr.war) { const broke = rr.truce > G.day || rr.pact > G.day || rr.ally; btn('d_war', bx + bw + 6, by, bw, 12, { label: 'Объявить войну', style: 'parch', onClick: () => UI.alert('reckon', { t, declare: true }), tip: broke ? ['Нарушение договора!', { t: 'Слава −25, мнение всех держав −12 (честных −25).', c: UIC.bad }] : ['Объявить войну', 'Сначала — Расчёт. Союзники врага вступятся.'] }); }
  else { const a = acceptance('peace', t, {}); btn('d_peace', bx + bw + 6, by, bw, 12, { label: 'Предложить белый мир', style: 'parch', onClick: () => propose('peace', t, {}), tip: accTip('Белый мир: всё возвращается как было', a) }); }
  by += 15;
  if (rr.war) {
    const n = G.setts.filter(S => S.owner === t && S.ctrl === p).length; const a1 = acceptance('peace', t, { cede: true }), a2 = acceptance('peace', t, { gold: 60 });
    btn('d_cede', bx, by, bw, 12, { label: 'Мир: отдать нам занятое (' + n + ')', style: 'parch', disabled: !n, onClick: () => propose('peace', t, { cede: true }), tip: accTip('Они уступят занятые нами земли', a1) });
    btn('d_pay', bx + bw + 6, by, bw, 12, { label: 'Мир: заплатить им 60 зол.', style: 'parch', disabled: G.realms[p].gold < 60, onClick: () => propose('peace', t, { gold: 60 }), tip: accTip('Откупиться', a2) }); by += 15;
  } else {
    const a1 = acceptance('ally', t), a2 = acceptance('pact', t);
    btn('d_ally', bx, by, bw, 12, { label: rr.ally ? 'Союз заключён' : 'Предложить союз', style: 'parch', disabled: !!rr.ally, onClick: () => propose('ally', t), tip: accTip('Союз: воюют вместе с нами', a1) });
    btn('d_pact', bx + bw + 6, by, bw, 12, { label: rr.pact > G.day ? 'Пакт действует' : 'Пакт о ненападении', style: 'parch', disabled: rr.pact > G.day || !!rr.ally, onClick: () => propose('pact', t), tip: accTip('Пакт на 2 года', a2) }); by += 15;
    const a3 = acceptance('tribute', t); btn('d_trib', bx, by, bw, 12, { label: 'Потребовать дань', style: 'parch', onClick: () => propose('tribute', t), tip: accTip('Дань: 20% их дохода на год. Отказ злит; гордец может и войну объявить.', a3) });
  }
  btn('d_gift', bx + bw + 6, by, 96, 12, { label: 'Дар 25', ic: 'i_gold', style: 'parch', disabled: G.realms[p].gold < 25, onClick: () => sendGift(t, 25), tip: 'Мнение +' + Math.round(25 / 4 * (ru.traits.includes('greedy') ? 1.6 : 1)) });
  btn('d_gift2', bx + bw + 106, by, 96, 12, { label: 'Дар 100', ic: 'i_gold', style: 'parch', disabled: G.realms[p].gold < 100, onClick: () => sendGift(t, 100), tip: 'Мнение +' + Math.round(100 / 4 * (ru.traits.includes('greedy') ? 1.6 : 1)) }); by += 18;
  txt('Лазутчики (гл. 13):', bx, by + 2, INK2); by += 12;
  const sp = (type, label, o) => { const T = SPYT[type]; return { label: label + ' ' + T.cost, ic: 'i_spy', style: 'parch', disabled: G.realms[p].gold < T.cost || (type === 'inward' && hasInward(t)), tip: [T.n + ' — ' + T.cost + ' зол., ' + T.dur + ' дн.', T.d] }; };
  btn('d_sp1', bx, by, 128, 12, Object.assign(sp('inward', 'Внутренний'), { onClick: () => hireSpy('inward', { realm: t }) && UI.toast('Наш человек при дворе: ' + realmName(t)) }));
  btn('d_sp2', bx + 132, by, 128, 12, Object.assign(sp('converted', 'Обращённый'), { onClick: () => { if (hireSpy('converted', { realm: t, factor: 0.55 })) UI.toast(realmName(t) + ' ' + rV(t, 'будет', 'будет', 'будут') + ' считать нас слабее.'); } }));
  const sp3 = sp('doomed', 'Обречённый'); sp3.tip = sp3.tip.concat([{ t: 'Затем щёлкните на их провинцию — туда они и бросят войска.', c: UIC.dim }]);
  btn('d_sp3', bx + 264, by, 128, 12, Object.assign(sp3, { onClick: () => { UI.target = { kind: 'doomed', realm: t }; UI.shut(); UI.toast('Щёлкните провинцию державы ' + realmName(t) + ' — ложная цель.'); } }));
  // the ruler's last answer
  const dr = UI.dres; if (dr && dr.t === t && G.day - dr.day <= 7) { const bY = by + 18, bX = RX, bW = X + WW - 12 - RX, nq = wrap('«' + dr.quote + '»', bW - 48).length, nv = wrap(dr.verdict, bW - 48, { f: 's' }).length, bH = clamp(17 + nq * 10 + 2 + nv * 9 + 5, 36, Y + HH - 22 - bY);
    const col = dr.ok === 'ok' ? '#3a7a3a' : dr.ok === 'no' ? '#a0302a' : '#8a6a3a', fl = NOW - dr.at < 0.9 && Math.floor((NOW - dr.at) * 6) % 2 === 0;
    rect(bX, bY, bW, bH, 'rgba(255,248,225,0.5)'); strokeR(bX, bY, bW, bH, fl ? '#e0a630' : col); rect(bX + 1, bY + 1, 3, bH - 2, col);
    drawPortrait(ru, bX + 9, bY + 6, 0.5); strokeR(bX + 8, bY + 5, 26, 26, col);
    txt((dr.ok === 'ok' ? 'Ответ: согласие' : dr.ok === 'no' ? 'Ответ: отказ' : 'Ответ') + ' · ' + ru.title + ' ' + ru.name, bX + 40, bY + 5, col); txt(dateStr(dr.day), bX + bW - 6, bY + 6, INK2, { al: 'r', f: 's' });
    let yy = bY + 17; yy += para('«' + dr.quote + '»', bX + 40, yy, bW - 48, INK, { lh: 10 }); para(dr.verdict, bX + 40, yy + 2, bW - 48, INK2, { f: 's', lh: 9 }); }
  // council forecast
  const v = councilVotes(), n = v.filter(e => e.c === p).length; const dd = (DAYS_SEASON * 3 - dayOfYear(G.day) + DAYS_YEAR) % DAYS_YEAR || DAYS_YEAR;
  txt('Совет короны через ' + dd + ' дн. Голоса за нас сейчас: ' + n + ' из ' + v.length + ' (нужно 3).', X + 12, Y + HH - 16, n >= 3 ? '#2a6a2a' : INK); hit(X + 10, Y + HH - 18, 380, 11, { id: 'd_council', tip: ['Совет короны (каждую зиму)'].concat(v.map(e => ({ t: REALM_DEF[e.x].name + ' → ' + REALM_DEF[e.c].name, c: e.c === p ? UIC.good : '#e8dcc0' }))).concat([{ t: 'Голоса дают мнение о нас, слава, страх перед нами и союзы. 3 голоса — победа словом.', c: UIC.dim }]) });
}
