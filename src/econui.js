'use strict';
// ===== ECONOMY UI (v3.2): the wares of a market, the treasury, the household books of the realm =====
const fq = v => { v = +v || 0; const a = Math.abs(v); if (a < 0.005) return '—'; if (a < 1) return v.toFixed(2).replace('.', ','); if (a < 10) return v.toFixed(1).replace('.', ','); return fmt(v); };
const fpx = p => (p < 0.1 ? p.toFixed(3) : p < 1 ? p.toFixed(2) : p < 10 ? p.toFixed(1) : String(Math.round(p))).replace('.', ',');
const relTxt = r => '×' + (r >= 10 ? String(Math.round(r)) : r.toFixed(1).replace('.', ','));
function relCol(r, parch) { if (r < 0.8) return parch ? '#2a6a2a' : UIC.good; if (r > 1.6) return parch ? '#a0302a' : UIC.bad; if (r > 1.2) return parch ? '#8a5a10' : UIC.warn; return parch ? INK : PAL.w; }
const supplyWord = r => r < 0.75 ? 'избыток' : r < 1.3 ? 'вдоволь' : r < 2.2 ? 'мало' : 'нехватка';
const agoTxt = d => d <= 0 ? 'сегодня' : d === 1 ? 'вчера' : d + ' ' + plural(d, 'день', 'дня', 'дней') + ' назад';
const SHORT_FX = { food: 'голод: процветание падает, растёт смута', salt: 'горожане беднеют', cloth: 'горожане беднеют', wood: 'нечем топить: горожане беднеют' };
// what is known of prices elsewhere: own markets every day, the rest when seen or told by merchants and couriers
function knownMarkets(k, n, skip) {
  const L = [];
  for (const S of G.setts) { if (!S.seen || S.id === skip || WD.setts[S.id].type === 'village') continue; const age = G.day - S.seen.d; if (age > 90) continue; L.push({ S, r: S.seen.px[k] || 0, age }); }
  L.sort((a, b) => a.r - b.r); return { lo: L.slice(0, n), hi: L.slice(Math.max(n, L.length - n)).reverse(), n: L.length };
}
function marketTipLines(k, skip) {
  const K = knownMarkets(k, 3, skip); if (!K.n) return [{ t: 'О ценах на других рынках ничего не известно: вести приносят купцы, заходящие на ваши рынки, лазутчики и разведка.', c: UIC.dim }];
  const f = e => WD.setts[e.S.id].name + ' ' + relTxt(e.r) + (e.age > 0 ? ' (' + agoTxt(e.age) + ')' : '');
  const L = [{ t: 'Дешевле всего: ' + K.lo.map(f).join(', '), c: UIC.good }]; if (K.hi.length) L.push({ t: 'Дороже всего: ' + K.hi.map(f).join(', '), c: UIC.bad }); return L;
}
const RICH_N = [['food', 'хлеб'], ['horse', 'кони'], ['wood', 'лес'], ['iron', 'руда'], ['wool', 'шерсть'], ['salt', 'соль'], ['wine', 'вино']];
function recipeTxt(k, t, S) { const R0 = RECIPE[k], per = k === 'arrows' ? 100 : 1; return R0.n + ': ' + Object.keys(R0.in).map(i => fq(R0.in[i] * per) + ' ' + GD[i].n.toLowerCase()).join(' + ') + ' → ' + per + ' ' + GD[k].n.toLowerCase() + ', до ' + fq((R0.cap[t] || 0) * (S.wk[k] || 0)) + ' в день'; }
// ---------- the wares of one market (a tab of the settlement window, or a window of its own at court) ----------
function drawGoodsTab(sid, X, y0, WW) {
  const S = G.setts[sid], ws = WD.setts[sid], me = G.player.realm, own = S.ctrl === me, vil = ws.type === 'village', now = own || G.vis[ws.i] === 2;
  if (!S.mkT || !S.res) initEcon(S, false);
  let y = y0; const sm = { f: 's' };
  const rl = RICH_N.filter(([k]) => S.res[k] > 0.05).map(([k, n]) => n + ' ×' + S.res[k].toFixed(1).replace('.', ','));
  txt('Округа: ' + (rl.join(' · ') || 'скудная'), X + 18, y, INK2, sm);
  hit(X + 16, y - 2, WW - 32, 9, { id: 'gd_land', tip: ['Богатства округи (против обычного)', 'Пашни дают хлеб, степи и луга — коней и фураж, леса — лес, холмы и горы — руду, луга и холмы — шерсть, морской берег и горы — соль, тёплый юг — вино.', 'Деревни везут три четверти урожая на рынок своей крепости — если дорогу не перерезала война.'] }); y += 10;
  if (!vil) {
    const WK = Object.keys(RECIPE).filter(k => (RECIPE[k].cap[ws.type] || 0) * (S.wk[k] || 0) > 0);
    txt('Ремёсла: ' + (WK.map(k => RECIPE[k].n.toLowerCase() + ' ×' + S.wk[k].toFixed(1).replace('.', ',')).join(' · ') || 'нет'), X + 18, y, INK2, sm);
    hit(X + 16, y - 2, WW - 32, 9, { id: 'gd_wk', tip: ['Мастерские'].concat(WK.map(k => recipeTxt(k, ws.type, S)), [{ t: 'Мастера работают, пока товар окупает сырьё и склады не ломятся. Разорение, осада и бедность их останавливают.', c: UIC.dim }]) }); y += 10;
  }
  const seen = S.seen, age = seen ? G.day - seen.d : -1, full = own && !vil, GL = vil ? RAW_G : GOODS;
  if (!now) { txt(seen ? 'Цены — по последним вестям (купцы, лазутчики, разведка), ' + agoTxt(age) + '.' : vil ? 'Деревня не на виду: о здешних ценах сведений нет.' : 'О здешнем рынке сведений нет: вести приносят купцы, лазутчики и разведка.', X + 18, y, seen && age < 30 ? INK2 : '#a0302a', sm); y += 10; if (!seen && !vil) return; }
  y += 2;
  const C = full ? [['Запас', 152], ['Цена', 190], ['к обычн.', 228], [vil ? 'Даёт' : 'Даёт', 268], ['Ввоз', 306], ['Вывоз', 344], ['Расход', 386], ['Нехв.', 424]]
    : vil ? [['Запас', 172], ['Цена', 222], ['к обычной', 274], ['Даёт', 330]] : [['Цена', 172], ['к обычной', 230], ['Предложение', 320]];
  for (const [h, x] of C) txt(h, X + x, y, INK2, { f: 's', al: 'r' }); txt('Товар', X + 30, y, INK2, sm); y += 10;
  const sf = seasonOf(G.day), pr = vil || !full ? rawProd(S, sf) : null, st = S.st;
  GL.forEach((k, i) => {
    const yy = y + i * 12; if (i % 2 === 0) rect(X + 14, yy - 2, WW - 28, 12, 'rgba(160,120,60,0.12)');
    spr(GD[k].ic, X + 18, yy); txt(GD[k].n, X + 30, yy + 1, INK, sm);
    const rel = now ? pxRel(S, k) : seen ? (seen.px[k] || 1) : 1, p = GD[k].p * rel;
    const tip = [{ t: GD[k].n, ic: GD[k].ic }, GD[k].tip, 'Обычная цена ' + fpx(GD[k].p) + ' зол.; здесь ' + fpx(p) + ' (' + relTxt(rel) + ').'];
    if (full) {
      const g = key => (st && st[key] && st[key][k]) || 0, made = (vil ? pr[k] || 0 : g('prod') + g('craft')), sh = vil ? 0 : g('short');
      const cells = [fq(S.mk[k] || 0), fpx(p), relTxt(rel), fq(made), fq(g('imp')), fq(g('exp')), fq(g('cons') + g('arm')), sh > 0.05 ? Math.round(sh * 100) + '%' : ''];
      cells.forEach((v, j) => txt(v, X + C[j][1], yy + 1, j === 2 ? relCol(rel, true) : j === 7 ? '#a0302a' : INK, { f: 's', al: 'r' }));
      tip.push('В день, в среднем за 10 дн.: ' + (RECIPE[k] ? 'сделано мастерами ' + fq(g('craft')) : 'добыто ' + fq(g('prod'))) + ', ввезено ' + fq(g('imp')) + ', вывезено ' + fq(g('exp')) + ', съели и сносили горожане ' + fq(g('cons')) + ', закупили войска и купцы ' + fq(g('arm')) + '.');
      if (sh > 0.05) tip.push({ t: 'Горожанам не хватает ' + Math.round(sh * 100) + '% нужды' + (SHORT_FX[k] ? ' — ' + SHORT_FX[k] : '') + '.', c: UIC.bad });
      tip.push('На складах ' + fq(S.mk[k] || 0) + '; обычный запас ' + fq(S.mkT[k]) + ', места — на ' + fq(S.mkCap[k]) + '.');
    } else if (vil) {
      [now ? fq(S.mk[k] || 0) : '?', seen || now ? fpx(p) : '?', seen || now ? relTxt(rel) : '', fq(pr[k] || 0)].forEach((v, j) => txt(v, X + C[j][1], yy + 1, j === 2 ? relCol(rel, true) : INK, { f: 's', al: 'r' }));
      tip.push('Деревня даёт ' + fq(pr[k] || 0) + ' в день (в эту пору года); три четверти уходит на рынок своей крепости.');
    } else {
      [fpx(p), relTxt(rel), supplyWord(rel)].forEach((v, j) => txt(v, X + C[j][1], yy + 1, j > 0 ? relCol(rel, true) : INK, { f: 's', al: 'r' }));
    }
    hit(X + 14, yy - 2, WW - 28, 12, { id: 'gd_' + k, tip: tip.concat(marketTipLines(k, sid)) });
  });
  y += GL.length * 12 + 3;
  if (full && !vil) {
    const P = G.provs[ws.prov], K = crownK(me), inc = ECON.incoming && ECON.incoming[sid], nIn = inc ? Object.keys(inc).length : 0;
    const shL = GOODS.filter(k => (st.short[k] || 0) > 0.1);
    txt('Провинция платит: подати ' + fq((P.ecTax || 0) * K) + ', цеха ' + fq((P.ecCraft || 0) * K) + ' зол./день' + (nIn ? ' · караваны везут сюда: ' + Object.keys(inc).map(k => GD[k].n.toLowerCase()).join(', ') : ''), X + 18, y, INK2, sm); y += 10;
    if (shL.length) txt('Нехватка: ' + shL.map(k => GD[k].n.toLowerCase()).join(', ') + '. Ввоз идёт сам, если дороги свободны; война и осады его режут.', X + 18, y, '#a0302a', sm);
  } else if (vil) { const seat = WD.provs[ws.prov].seat; para((own ? 'Своя деревня' : 'Чужая деревня') + ': три четверти урожая везут на рынок крепости ' + WD.setts[seat].name + ', остальное продают проходящим войскам. Ремёсел в деревне нет.', X + 18, y, WW - 36, INK2, { f: 's', lh: 9 }); }
  else txt('Чужой рынок: войску короля здесь всё на четверть дороже.', X + 18, y, INK2, sm);
}
function drawGoodsWin(w) {
  const sid = w.id, X = 100, Y = 30, WW = 440, HH = 300;
  winFrame(X, Y, WW, HH, 'Рынок: ' + WD.setts[sid].name, true);
  drawGoodsTab(sid, X, Y + 26, WW);
  btn('gw_back', X + WW - 96, Y + HH - 18, 80, 13, { label: 'Назад', style: 'parch', onClick: () => UI.open({ k: 'sett', id: sid }) });
}
// ---------- the treasury (a tab of the realm window) ----------
const INC_ROWS = [['tax', 'Подати с земель', 'Деревни и пашни платят с годового урожая, горожане — подушную. Разорение, осада, грабёж и смута уменьшают подать; занятая чужая земля платит вполовину.'],
  ['craft', 'Цеха и ремёсла', 'Взносы мастерских: часть цены, что мастера прибавляют к сырью. Без руды и леса кузни стоят, без шерсти — ткачи.'],
  ['duty', 'Пошлины и мыт', 'Пошлины с купцов на наших рынках (покупка 3%, продажа 6%) и мыт с мелкой торговли между соседними городами (2%). Война и осады торговлю режут.'],
  ['trib', 'Дань', 'Дань по мирным договорам.']];
const EXP_ROWS = [['army', 'Жалованье войску', 'Полевые войска короны.'], ['gar', 'Гарнизоны', 'Гарнизоны получают четверть жалованья.'], ['spies', 'Лазутчики', 'Действующие лазутчики.'], ['tribOut', 'Дань', 'Дань, что платим мы.']];
function drawTreasuryTab(X, y, WW) {
  const p = G.player.realm, R0 = G.realms[p], E = R0.ec || {}, E30 = R0.ec30 || {}, lab = { f: 's', al: 'r' };
  txt('Доходы', X + 16, y, PAL.y); txt('сегодня', X + 210, y, '#c8b898', lab); txt('за 30 дн.', X + 260, y, '#c8b898', lab);
  txt('Расходы', X + 290, y, PAL.y); txt('сегодня', X + 484, y, '#c8b898', lab); txt('за 30 дн.', X + 534, y, '#c8b898', lab); y += 11;
  const rows = (L, x0, col) => L.forEach(([k, n, tip], i) => { const yy = y + i * 10; txt(n, x0 + 6, yy, PAL.w, { f: 's' }); txt(fq(E[k] || 0), x0 + 194, yy, col, lab); txt(fq(E30[k] || 0), x0 + 244, yy, '#c8b898', lab); hit(x0, yy - 2, 250, 10, { id: 'tr_' + k + x0, tip: [n, tip] }); });
  rows(INC_ROWS, X + 16, UIC.good); rows(EXP_ROWS, X + 290, UIC.bad); y += 44;
  const K = crownK(p); if (Math.abs(K - 1) > 0.005) { txt('Подати и цеха с учётом наук и указов двора: ×' + K.toFixed(2).replace('.', ','), X + 22, y, '#c8b898', { f: 's' }); y += 10; }
  y += 3; txt('Доходы провинций', X + 16, y, PAL.y); y += 11;
  const provs = WD.provs.map((P, k) => k).filter(k => G.setts[WD.provs[k].seat].ctrl === p).sort((a, b) => provIncome(b) - provIncome(a));
  provs.slice(0, 10).forEach((k, i) => { const xx = X + 16 + (i % 2) * 260, yy = y + Math.floor(i / 2) * 10, P = G.provs[k]; txt(WD.provs[k].name, xx, yy, PAL.w, { f: 's' }); txt('+' + fq(provIncome(k) * K), xx + 200, yy, UIC.good, lab);
    hit(xx - 2, yy - 2, 206, 10, { id: 'tp' + k, tip: [WD.provs[k].name, 'Подати ' + fq((P.ecTax || 0) * K) + ' · цеха ' + fq((P.ecCraft || 0) * K) + ' зол./день', P.dev > 0.1 ? { t: 'Разорение ' + Math.round(P.dev * 100) + '%: земля даёт меньше.', c: UIC.warn } : null, P.unrest > 50 ? { t: 'Смута: подать вполовину.', c: UIC.bad } : null] }); });
  if (provs.length > 10) txt('…и ещё ' + (provs.length - 10) + ' ' + plural(provs.length - 10, 'провинция', 'провинции', 'провинций'), X + 16, y + 50, '#c8b898', { f: 's' });
  return y + 62;
}
// ---------- the household books of the realm (from the treasurer: as exact as he is able) ----------
function realmGoodsReport() {
  const me = G.player.realm, C = ECON.rep; if (C && C.r === me && G.day - C.day < 7 && C.G === G) return C;
  const t = G.court ? seatChar('treasurer') : null; let err = 0;
  if (G.court) { err = t ? clamp((20 - skillOf(t, 'stew')) / 45, 0.04, 0.4) : 0.4; if (hasTech('ledgers')) err *= 0.5; }
  const wk = Math.floor(G.day / 7), nz = (v, j) => v * (1 + err * (hash2(wk, j, 977) * 2 - 1));
  const rows = {}; let nS = 0;
  for (const k of GOODS) rows[k] = { stock: 0, prod: 0, craft: 0, imp: 0, exp: 0, use: 0, rel: 0, short: [] };
  for (const S of G.setts) { if (S.ctrl !== me || !S.st) continue; nS++; const st = S.st;
    for (const k of GOODS) { const o = rows[k]; o.stock += S.mk[k] || 0; o.prod += st.prod[k] || 0; o.craft += st.craft[k] || 0; o.imp += st.imp[k] || 0; o.exp += st.exp[k] || 0; o.use += (st.cons[k] || 0) + (st.arm[k] || 0); o.rel += pxRel(S, k); if ((st.short[k] || 0) > 0.15) o.short.push(S.id); } }
  GOODS.forEach((k, i) => { const o = rows[k]; o.rel /= Math.max(1, nS); ['stock', 'prod', 'craft', 'imp', 'exp', 'use'].forEach((f, j) => { o[f] = nz(o[f], i * 8 + j); }); });
  return (ECON.rep = { r: me, day: G.day, G, err, who: t ? t.name : null, rows, nS });
}
function drawRealmGoodsTab(X, y, WW) {
  const me = G.player.realm, Rp = realmGoodsReport(), lab = { f: 's', al: 'r' };
  const src = !G.court ? 'Книги рынков держав.' : Rp.who ? 'По книгам казначея ' + Rp.who + ': точность ±' + Math.round(Rp.err * 100) + '%' + (hasTech('ledgers') ? ' (учётные книги)' : '') + '.' : 'Казначея нет — сведения писцов, точность ±' + Math.round(Rp.err * 100) + '%.';
  txt(src + ' Сведено ' + agoTxt(G.day - Rp.day) + '; в день, в среднем за 10 дн.', X + 16, y, '#c8b898', { f: 's' }); y += 12;
  const C = [['Запасы', 176], ['Добыто', 222], ['Сделано', 268], ['Ввоз', 310], ['Вывоз', 352], ['Расход', 398], ['Цены', 440], ['Нехватка', 540]];
  txt('Товар', X + 30, y, '#c8b898', { f: 's' }); for (const [h, x] of C) txt(h, X + x, y, '#c8b898', lab); y += 10;
  GOODS.forEach((k, i) => {
    const o = Rp.rows[k], yy = y + i * 11; if (i % 2) rect(X + 12, yy - 2, WW - 24, 11, 'rgba(255,255,255,0.04)');
    spr(GD[k].ic, X + 16, yy - 1); txt(GD[k].n, X + 30, yy, PAL.w, { f: 's' });
    [fq(o.stock), fq(o.prod), fq(o.craft), fq(o.imp), fq(o.exp), fq(o.use), relTxt(o.rel), o.short.length ? o.short.length + ' ' + plural(o.short.length, 'крепость', 'крепости', 'крепостей') : ''].forEach((v, j) => txt(v, X + C[j][1], yy, j === 6 ? relCol(o.rel) : j === 7 ? UIC.bad : PAL.w, lab));
    const tip = [{ t: GD[k].n, ic: GD[k].ic }, GD[k].tip, 'Средняя цена на наших рынках ' + relTxt(o.rel) + ' к обычной (' + fpx(GD[k].p * o.rel) + ' зол.).'];
    if (o.short.length) tip.push({ t: 'Нехватка: ' + o.short.slice(0, 6).map(s => WD.setts[s].name).join(', ') + (o.short.length > 6 ? '…' : ''), c: UIC.bad });
    hit(X + 12, yy - 2, WW - 24, 11, { id: 'rg_' + k, tip: tip.concat(marketTipLines(k, -1)) });
  });
  y += GOODS.length * 11 + 4;
  // merchants: our caravans, the duties, the robbers
  const cv = G.armies.filter(a => a.alive && a.kind === 'caravan' && a.realm === me), road = cv.filter(a => a.path).length, E30 = G.realms[me].ec30 || {};
  const rob = (G.robbed || []).filter(e => G.day - e.d <= 60 && (e.r === me || (() => { const pv = WD.prov[clamp(Math.round(e.y), 0, MH - 1) * MW + clamp(Math.round(e.x), 0, MW - 1)]; return pv >= 0 && G.setts[WD.provs[pv].seat].ctrl === me; })()));
  txt('Караваны: наших ' + cv.length + ' (в пути ' + road + ') · рейсов ' + cv.reduce((s, a) => s + (a.trips || 0), 0) + ' · пошлины и мыт ≈' + fq(E30.duty || 0) + ' зол./день', X + 16, y, PAL.w, { f: 's' });
  hit(X + 12, y - 2, 340, 10, { id: 'rg_car', tip: ['Купцы', 'Караваны сами ищут, где купить дешевле и продать дороже. На каждом рынке они платят пошлину его хозяину — нам или чужим.', 'Мелкая торговля между соседними городами идёт и без караванов, но война, осады и смута её режут.', { t: 'Купцы гибнут от разбойников и вражеских войск; разорившись, уходят по домам — на их место приходят новые.', c: UIC.dim }] }); y += 10;
  txt(rob.length ? 'Грабежи на дорогах за 60 дн.: ' + rob.length + ' ' + plural(rob.length, 'караван', 'каравана', 'караванов') + ' на ≈' + fq(rob.reduce((s, e) => s + e.v, 0)) + ' зол.' : 'Грабежей на наших дорогах за 60 дней не было.', X + 16, y, rob.length ? UIC.warn : '#c8b898', { f: 's' });
  return y + 10;
}
// one line for the treasurer's report at the council
function treasurerEconNote(c) {
  const R0 = G.realms[0], E = R0.ec30 || {}, Rp = realmGoodsReport(), sh = GOODS.filter(k => Rp.rows[k].short.length >= 2).sort((a, b) => Rp.rows[b].short.length - Rp.rows[a].short.length).slice(0, 3);
  return ' Подати дают ' + noisy(E.tax || 0, c, 'stew') + ', цеха ' + noisy(E.craft || 0, c, 'stew') + ', пошлины и мыт ' + noisy(E.duty || 0, c, 'stew') + ' в день.' + (sh.length ? ' Нехватка: ' + sh.map(k => GD[k].n.toLowerCase() + ' (' + Rp.rows[k].short.length + ' ' + plural(Rp.rows[k].short.length, 'крепость', 'крепости', 'крепостей') + ')').join(', ') + '.' : ' Товаров на рынках вдоволь.');
}
// a caravan on the map
function caravanTipLines(a, exact) {
  const L = [], k = a.cargo ? Object.keys(a.cargo)[0] : null;
  L.push(k ? { t: 'Везёт: ' + GD[k].n.toLowerCase() + ' ' + fq(a.cargo[k]) + (a.ai && a.ai.to >= 0 ? ' → ' + WD.setts[a.ai.to].name : ''), ic: GD[k].ic } : 'Идёт порожняком — ищет выгодный товар.');
  if (exact || a.realm === G.player.realm) L.push('Кошель ≈ ' + Math.round(a.cash) + ' зол. · рейсов: ' + (a.trips || 0));
  L.push({ t: 'Купцы платят пошлину тому, чей рынок. Разбитый караван — добыча победителя.', c: UIC.dim });
  return L;
}
// a market line for the settlement tooltip on the map: the dearest and cheapest wares, if known
function settMarketLine(S) {
  const sn = S.seen; if (!sn || WD.setts[S.id].type === 'village' || G.day - sn.d > 60) return null;
  const hi = GOODS.filter(k => sn.px[k] > 1.6).sort((a, b) => sn.px[b] - sn.px[a]).slice(0, 3), lo = GOODS.filter(k => sn.px[k] < 0.7).sort((a, b) => sn.px[a] - sn.px[b]).slice(0, 3);
  if (!hi.length && !lo.length) return { t: 'Рынок: цены обычные' + (G.day - sn.d > 0 ? ' (' + agoTxt(G.day - sn.d) + ')' : '') + '.', c: UIC.dim };
  return { t: 'Рынок' + (G.day - sn.d > 0 ? ' (' + agoTxt(G.day - sn.d) + ')' : '') + ': ' + (hi.length ? 'дорого — ' + hi.map(k => GD[k].n.toLowerCase()).join(', ') : '') + (hi.length && lo.length ? '; ' : '') + (lo.length ? 'дёшево — ' + lo.map(k => GD[k].n.toLowerCase()).join(', ') : '') + '.', c: '#e8d8b0' };
}
