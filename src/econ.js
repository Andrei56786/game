'use strict';
// ===== ECONOMY (v3.2): goods and production chains, markets and prices, merchant caravans, the treasury =====
// Villages grow grain and fodder, breed horses, fell timber, dig ore, shear wool, boil salt and press wine, and cart it all
// to the market of their castle or town. Workshops there turn it into iron, weapons, arrows, wagons, pitch and cloth.
// Townsfolk eat, burn and wear; armies buy. Merchants carry the surplus to where it is dear. The treasury lives on the land
// tax, the dues of the craft guilds and the duties on that trade — so war, sieges and robbers cost a realm far more than gold.
const GOODS = ['food', 'fodder', 'horses', 'wood', 'ore', 'wool', 'salt', 'wine', 'iron', 'weap', 'arrows', 'wagons', 'pitch', 'cloth'];
const GD = {
  food: { n: 'Провиант', ic: 'i_food', p: 0.045, bulk: 1, tip: 'Хлеб, крупа, солонина. Горожане едят каждый день; воин съедает 1 в день.' },
  fodder: { n: 'Фураж', ic: 'i_fodder', p: 0.03, bulk: 1, tip: 'Овёс и сено для коней и волов. Зимой его мало и он дорог.' },
  horses: { n: 'Кони', ic: 'i_horse', p: 12, bulk: 0, tip: 'Конские заводы степей и лугов. Идут своим ходом — повозок не нужно.' },
  wood: { n: 'Лес', ic: 'i_wood', p: 0.5, bulk: 4, tip: 'Брёвна и дрова: топливо горожанам, сырьё для кузниц, стрел, повозок и смолы.' },
  ore: { n: 'Руда', ic: 'i_ore', p: 0.8, bulk: 4, tip: 'Железная руда холмов и гор. Кузни плавят железо: 2 руды и 1 лес.' },
  wool: { n: 'Шерсть', ic: 'i_wool', p: 1.0, bulk: 2, tip: 'Овец стригут весной. Ткачи делают сукно: 2 шерсти → 1 сукно.' },
  salt: { n: 'Соль', ic: 'i_salt', p: 1.5, bulk: 2, tip: 'Выпаривают у моря, ломают в горах. Без соли не сберечь мясо — горожане ропщут.' },
  wine: { n: 'Вино', ic: 'i_wine', p: 3, bulk: 3, tip: 'Виноградники тёплого юга, сбор осенью. Дорогой товар для городов.' },
  iron: { n: 'Железо', ic: 'i_iron', p: 3.5, bulk: 3, tip: 'Крицы из кузниц: на оружие, наконечники стрел, оковку повозок.' },
  weap: { n: 'Оружие', ic: 'i_weap', p: 3, bulk: 2, tip: 'Копья и топоры оружейников (½ железа и ½ леса). Вооружить ополченцев копьями — в окне войска.' },
  arrows: { n: 'Стрелы', ic: 'i_arrows', p: 0.02, bulk: 0.02, tip: 'Лучные мастера: лес и немного железа. Лучник тратит до 40 стрел за бой.' },
  wagons: { n: 'Повозки', ic: 'i_wagon', p: 25, bulk: 0, tip: 'Тележники: 4 леса и 1,5 железа. Повозка везёт 400; тянут её 2 вола (корм!).' },
  pitch: { n: 'Горючая смола', ic: 'i_fire', p: 8, bulk: 5, tip: 'Смолокурни лесных городов. Для огненной атаки (гл. 12); нужна сухая погода.' },
  cloth: { n: 'Сукно', ic: 'i_cloth', p: 3, bulk: 2, tip: 'Ткачи городов. Без сукна горожане беднеют.' },
};
const RAW_G = ['food', 'fodder', 'horses', 'wood', 'ore', 'wool', 'salt', 'wine'];
// net surplus a village of 100 souls sends to market each day (× local riches × season); seats farm a little too
const RAW = { food: 16, fodder: 3.0, horses: 0.012, wood: 1.15, ore: 1.0, wool: 0.45, salt: 0.6, wine: 1.0 };
const SEASON_F = { food: [0.55, 0.9, 1.85, 0.7], fodder: [1.0, 1.35, 1.05, 0.35], wool: [1.7, 1.0, 0.75, 0.55], wine: [0.15, 0.35, 2.9, 0.6] };
// what a soul in a castle or town uses up each day
const NEED = { food: 0.26, fodder: 0.02, horses: 0.00002, wood: 0.009, iron: 0.0007, salt: 0.0034, wine: 0.0008, cloth: 0.0022 };
const FAVG = {}; for (const k of RAW_G) { const F = SEASON_F[k]; FAVG[k] = F ? (F[0] + F[1] + F[2] + F[3]) / 4 : 1; }
// workshops: inputs per unit of output, output per day at full strength by kind of place
const RECIPE = {
  iron: { in: { ore: 2, wood: 1 }, cap: { castle: 4, town: 7, capital: 10 }, n: 'Кузни' },
  weap: { in: { iron: 0.5, wood: 0.5 }, cap: { castle: 2.5, town: 5, capital: 9 }, n: 'Оружейники' },
  arrows: { in: { wood: 0.01, iron: 0.001 }, cap: { castle: 300, town: 650, capital: 1000 }, n: 'Лучные мастера' },
  wagons: { in: { wood: 4, iron: 1.5 }, cap: { town: 0.3, capital: 0.5 }, n: 'Тележники' },
  pitch: { in: { wood: 3 }, cap: { town: 0.5, capital: 0.6 }, n: 'Смолокурни' },
  cloth: { in: { wool: 2 }, cap: { castle: 2, town: 10, capital: 16 }, n: 'Ткачи' },
};
const BIGK = { village: 0.3, castle: 0.6, town: 1, capital: 1.6 };
const RESERVE = { food: 1500, fodder: 400, arrows: 1500, weap: 30, horses: 8, wagons: 2, pitch: 3 }; // stock kept for armies (× size of the place)
// tax: share of the yearly worth of the fields; poll: per townsman a day; craft: share of the worth the guilds add;
// duties on caravans (bought / sold) and the market toll on the small trade between neighbouring towns; carry: cost of carting a load one league
const ECONK = { tax: 0.019, poll: 0.0003, craft: 0.11, dutyBuy: 0.03, dutySell: 0.06, dutyMk: 0.02, carry: 0.0004, flow: 0.12 };
const ECON = { inc: null, incDay: -1, ms: 0 };
function econReset() { ECON.inc = null; ECON.incDay = -1; ECON.incoming = null; ECON.rep = null; ECON.c = null; ECON.cG = null; }
const GA = 0.1, ST_KEYS = ['prod', 'craft', 'cons', 'imp', 'exp', 'short', 'arm']; // the books: each day weighs a tenth (≈ the last ten days)
const stAdd = (S, key, k, v) => { const o = S.st[key]; o[k] = (o[k] || 0) + v * GA; };
// an army buys (or takes) n of a ware at a market: it leaves the stalls and goes into the books
function mkTake(S, k, n) { if (!(n > 0)) return; S.mk[k] = Math.max(0, (S.mk[k] || 0) - n); if (S.st && S.st.arm) stAdd(S, 'arm', k, n); }
const isSeatT = t => t !== 'village';
// ---------- riches of the land around a place ----------
function localMix(i, R) {
  const m = new Float32Array(14), x0 = i % MW, y0 = (i / MW) | 0; let n = 0;
  for (let y = Math.max(0, y0 - R); y <= Math.min(MH - 1, y0 + R); y++) for (let x = Math.max(0, x0 - R); x <= Math.min(MW - 1, x0 + R); x++) { if ((x - x0) * (x - x0) + (y - y0) * (y - y0) > R * R) continue; m[WD.ter[y * MW + x]]++; n++; }
  for (let t = 0; t < 14; t++) m[t] /= Math.max(1, n); return m;
}
function settRiches(S) {
  const ws = WD.setts[S.id], m = localMix(ws.i, ws.type === 'village' ? 5 : 7), P = WD.provs[ws.prov].mix;
  const mx = t => m[t] * 0.7 + P[t] * 0.3; // mostly the fields around, a little of the province
  const forest = mx(TR.FOREST) + mx(TR.DFOREST), steppe = mx(TR.STEPPE) + mx(TR.GRASS) * 0.5, hills = mx(TR.HILLS) + mx(TR.MOUNT), farm = mx(TR.FARM);
  const sea = m[TR.DEEP] + m[TR.SHALLOW] + m[TR.BEACH] * 0.5, h = hash2(ws.x, ws.y, 811), temp = WD.temp[ws.i];
  return { food: 0.6 + farm * 4 + mx(TR.GRASS), horse: 0.4 + steppe * 2.2, wood: 0.4 + forest * 2.5, iron: 0.3 + hills * 3,
    wool: 0.3 + mx(TR.GRASS) * 1.0 + mx(TR.HILLS) * 1.6 + mx(TR.STEPPE) * 0.8 + mx(TR.SNOW) * 0.6,
    salt: sea > 0.04 ? 0.8 + Math.min(0.8, sea * 2) : (mx(TR.MOUNT) + mx(TR.HILLS) * 0.4 > 0.12 && h < 0.45 ? 0.9 : 0),
    wine: temp > 0.55 ? clamp((temp - 0.55) * 4.5, 0, 1.4) * (0.3 + farm * 2 + mx(TR.HILLS) * 2.2 + mx(TR.GRASS) * 0.5) : 0 };
}
// how strong each workshop is in a seat (deterministic: kind of land and a little chance)
function settWorkshops(S) {
  const ws = WD.setts[S.id], r = S.res, h = k => 0.75 + hash2(ws.x * 7 + k, ws.y, 823) * 0.5;
  return { iron: (0.45 + Math.min(1.2, r.iron * 0.55)) * h(1), weap: h(2), arrows: (0.6 + Math.min(0.8, r.wood * 0.3)) * h(3), wagons: h(4), pitch: r.wood > 0.95 ? Math.min(1.5, r.wood * 0.7) * h(5) : 0, cloth: (0.5 + Math.min(1, r.wool * 0.5)) * h(6) };
}
const resOf = (r, k) => k === 'food' ? r.food : k === 'fodder' ? r.horse : k === 'horses' ? Math.max(0, r.horse - 0.6) : k === 'wood' ? r.wood : k === 'ore' ? Math.max(0, r.iron - 0.45) : r[k] || 0;
// daily output of the fields (before war damage); sf = season index or -1 for the yearly average
const landK = S => (WD.setts[S.id].type === 'village' ? S.pop : Math.min(S.pop, 1500) * 0.4) / 100 * (0.5 + S.prosp / 100);
function rawProd(S, sf, o) {
  const L = landK(S); o = o || {};
  for (const k of RAW_G) { const F = SEASON_F[k]; o[k] = L * RAW[k] * resOf(S.res, k) * (F ? (sf < 0 ? FAVG[k] : F[sf]) : 1); }
  return o;
}
// the yearly worth of the fields per unit of land (the tax is assessed on it, not on the harvest of the day)
function yearWorth(S) { let v = 0; for (const k of RAW_G) v += RAW[k] * resOf(S.res, k) * FAVG[k] * GD[k].p; return v; }
// derived numbers kept beside the game (not saved): output per unit of land of each raw ware, and the yearly worth
function econCache() {
  if (ECON.cG === G && ECON.c && ECON.c.length === G.setts.length) return ECON.c;
  ECON.c = G.setts.map(S => { const rp = new Float64Array(RAW_G.length); RAW_G.forEach((k, j) => { rp[j] = RAW[k] * resOf(S.res, k); }); return { rp, vY: yearWorth(S), vil: WD.setts[S.id].type === 'village' }; });
  ECON.cG = G; return ECON.c;
}
// market targets: the stock at which goods sell at their usual price; storage holds three times as much
function mkTargets(S) {
  const ws = WD.setts[S.id], t = ws.type, big = BIGK[t], T = {};
  for (const k of GOODS) T[k] = 0;
  if (t === 'village') { const pr = rawProd(S, -1); for (const k of RAW_G) T[k] = pr[k] * 0.25 * 10; T.food += 250; T.fodder += 100; T.horses += 2; T.wagons = 1; }
  else {
    for (const k in NEED) T[k] += NEED[k] * S.pop * 20;
    for (const r in RECIPE) { const c = (RECIPE[r].cap[t] || 0) * (S.wk[r] || 0); if (!c) continue; T[r] += c * 12; for (const i in RECIPE[r].in) T[i] += c * RECIPE[r].in[i] * 15; }
    for (const k in RESERVE) if (k !== 'pitch' || t === 'town' || t === 'capital') T[k] += RESERVE[k] * big;
  }
  for (const k of GOODS) T[k] = Math.max(T[k], 6 / GD[k].p * big); // a little of everything is always expected
  S.mkT = T; S.mkCap = {}; for (const k of GOODS) S.mkCap[k] = T[k] * 3;
}
function initEcon(S, first) {
  S.res = settRiches(S); if (WD.setts[S.id].type !== 'village') S.wk = settWorkshops(S); else S.wk = {};
  for (const k of GOODS) if (S.mk[k] === undefined) S.mk[k] = 0;
  mkTargets(S); if (WD.setts[S.id].type !== 'village') { const st = S.st || (S.st = {}); for (const key of ST_KEYS) if (!st[key]) st[key] = {}; } else delete S.st;
  if (ECON.c) ECON.cG = null;
  if (first) for (const k of GOODS) S.mk[k] = S.mkT[k] * (0.8 + hash2(S.id, GOODS.indexOf(k), 829) * 0.5);
}
// ---------- prices ----------
// price at a given stock: the usual price at the target stock, dearer as the stalls empty, cheap when they overflow
function pxAt(S, k, st) { const T = S.mkT ? S.mkT[k] : 1; return GD[k].p * clamp(Math.pow(T / Math.max(st, T * 0.06), 0.55), 0.4, 4.5); }
function priceOf(S, k, sell) { if (!GD[k]) return 0; let p = pxAt(S, k, S.mk[k] || 0); if (S.siege) p *= 1.5; if (sell) p *= 0.55; return p; }
// what n units cost (buying lifts the price as the stock runs down); Simpson's rule over the stock
function buyCost(S, k, n) { if (n <= 0) return 0; const s = S.mk[k] || 0; return n * (pxAt(S, k, s) + 4 * pxAt(S, k, Math.max(0, s - n / 2)) + pxAt(S, k, Math.max(0, s - n))) / 6 * (S.siege ? 1.5 : 1); }
function sellGain(S, k, n) { if (n <= 0) return 0; const s = S.mk[k] || 0; return n * (pxAt(S, k, s) + 4 * pxAt(S, k, s + n / 2) + pxAt(S, k, s + n)) / 6; }
const pxRel = (S, k) => priceOf(S, k) / GD[k].p;
const ema = (o, k, v, a) => { o[k] = Math.round(((o[k] || 0) * (1 - a) + v * a) * 100) / 100; };
// ---------- the daily round of the economy ----------
function econDaily() {
  const t0 = performance.now(), sf = seasonOf(G.day), day = G.day, inc = [], fairs = G.court && hasTech('fairs');
  for (let r = 0; r < 7; r++) inc.push({ tax: 0, craft: 0, occ: 0, mk: 0 });
  for (const P of G.provs) { P.ecTax = 0; P.ecCraft = 0; }
  // 0. the books (kept for seats only): yesterday fades; once a week the stalls are measured anew to the people they serve
  const EC = econCache(); if (day % 7 === 0) for (const S of G.setts) mkTargets(S);
  for (const S of G.setts) { const st = S.st; if (!st) continue; for (let j = 0; j < ST_KEYS.length; j++) { const o = st[ST_KEYS[j]]; for (const k in o) { const v = o[k] * (1 - GA); o[k] = v < 0.004 ? 0 : v; } } }
  // 1. the fields: villages cart most of their surplus to the seat of the province, unless cut off by war
  const SFd = RAW_G.map(k => SEASON_F[k] ? SEASON_F[k][sf] : 1), NR = RAW_G.length;
  for (const S of G.setts) {
    const ws = WD.setts[S.id], P = G.provs[ws.prov], seat = G.setts[WD.provs[ws.prov].seat], ec = EC[S.id], vil = ec.vil;
    let k0 = (1 - P.dev * 0.8) * (S.siege ? 0.15 : 1) * (day - (S.lootDay || -99) < 20 ? 0.35 : 1);
    if (S.ctrl === 6) k0 = 0;
    const cut = vil && (seat.siege || seat.ctrl !== S.ctrl || S.siege), dest = vil && !cut ? seat : S, share = vil && !cut ? 0.75 : 0, L = landK(S) * k0;
    if (L > 0) { const mk = S.mk, dm = dest.mk, sp = dest.st ? dest.st.prod : null, rp = ec.rp;
      for (let j = 0; j < NR; j++) { const q = L * rp[j] * SFd[j]; if (q <= 0) continue; const k = RAW_G[j]; if (share) { mk[k] += q * (1 - share); dm[k] += q * share; } else mk[k] += q; if (sp) sp[k] = (sp[k] || 0) + GA * (share ? q * share : q); } }
    // the land tax (on the yearly worth, so it does not leap with the harvest) goes to whoever holds the place: half when it is only occupied
    if (S.ctrl >= 5) continue;
    const tx = (L * ec.vY * ECONK.tax + (vil ? 0 : S.pop * ECONK.poll)) * (P.unrest > 50 ? 0.5 : 1) * (S.owner === S.ctrl ? 1 : 0.5);
    if (S.ctrl === seat.ctrl) P.ecTax += tx; else inc[S.ctrl].occ += tx;
  }
  // 2. workshops: they work while the ware pays for its materials and the stores are not overfull
  for (const S of G.setts) {
    const ws = WD.setts[S.id], t = ws.type; if (t === 'village' || S.ctrl === 6) continue;
    const P = G.provs[ws.prov], wk = (0.5 + S.prosp / 100) * (1 - P.dev * 0.6) * (S.siege ? 0.5 : 1) * (S.ctrl === 0 && fairs && t !== 'castle' ? 1.1 : 1);
    let va = 0;
    for (const r in RECIPE) {
      const R0 = RECIPE[r], s0 = S.mk[r] || 0, T = S.mkT[r]; let c = (R0.cap[t] || 0) * (S.wk[r] || 0) * wk; if (c <= 0) continue;
      c *= clamp((1.8 - s0 / T) / 0.8, 0, 1); if (c <= 0) continue;
      let q = c; for (const i in R0.in) q = Math.min(q, (S.mk[i] || 0) / R0.in[i]); if (q <= c * 0.02) continue;
      let cost = 0; for (const i in R0.in) cost += R0.in[i] * pxAt(S, i, S.mk[i] || 0); if (pxAt(S, r, s0) < cost * 1.02) continue;
      for (const i in R0.in) S.mk[i] -= q * R0.in[i]; S.mk[r] = s0 + q; stAdd(S, 'craft', r, q);
      let base = 0; for (const i in R0.in) base += R0.in[i] * GD[i].p; va += q * Math.max(0, GD[r].p - base);
    }
    if (S.ctrl < 5) { const cr = va * ECONK.craft * (S.owner === S.ctrl ? 1 : 0.5); if (S.ctrl === G.setts[WD.provs[ws.prov].seat].ctrl) P.ecCraft += cr; else inc[S.ctrl].occ += cr; }
  }
  // 3. the small trade: pedlars and carters between neighbouring towns, wherever a ware is dearer than the cost of carting it
  econTrade(inc, fairs);
  // 4. townsfolk eat, burn and wear (less when it is dear); shortages hurt
  for (const S of G.setts) {
    const ws = WD.setts[S.id]; if (ws.type === 'village') continue; const P = G.provs[ws.prov];
    for (const k in NEED) {
      const rel = pxAt(S, k, S.mk[k] || 0) / GD[k].p, want = NEED[k] * S.pop * clamp(1.6 - 0.6 * rel, 0.35, 1.25), take = Math.min(S.mk[k] || 0, want);
      S.mk[k] -= take; stAdd(S, 'cons', k, take); const sh = want > 0 ? 1 - take / want : 0; if (sh > 0.05) stAdd(S, 'short', k, sh);
      if (sh > 0.3) { if (k === 'food') { S.prosp = Math.max(5, S.prosp - 0.12 * sh); if (S.ctrl === S.owner) P.unrest = Math.min(100, P.unrest + 0.3 * sh); } else if (k === 'salt' || k === 'cloth' || k === 'wood') S.prosp = Math.max(5, S.prosp - 0.03 * sh); }
    }
  }
  // 5. storage limits (what does not fit rots or is sold off for nothing)
  for (const S of G.setts) { const mk = S.mk, cap = S.mkCap, L = EC[S.id].vil ? RAW_G : GOODS; for (let j = 0; j < L.length; j++) { const k = L[j]; if (mk[k] > cap[k]) mk[k] = cap[k]; } }
  // 6. what the player knows about foreign markets: what his eyes see and what merchants tell
  const me = G.player.realm;
  const inw = day % 5 === 0 && typeof hasInward === 'function' ? [0, 1, 2, 3, 4].map(r => r !== me && hasInward(r)) : null; // a spy at their court reads their market books
  for (const S of G.setts) { const ws = WD.setts[S.id]; if (ws.type === 'village') continue; if (S.ctrl === me || G.vis[ws.i] === 2 || (inw && S.ctrl < 5 && inw[S.ctrl])) seeMarket(S); }
  if (day % 7 === 3) for (const l of tradeLinks()) { const A = G.setts[l[0]], B = G.setts[l[1]]; if ((A.ctrl === me) === (B.ctrl === me) || A.siege || B.siege || A.ctrl >= 5 || B.ctrl >= 5 || hostile(A.ctrl, B.ctrl)) continue; seeMarket(A.ctrl === me ? B : A); } // pedlars from over the border
  ECON.inc = inc; ECON.incDay = day;
  econCaravans();
  ECON.ms = ECON.ms * 0.9 + (performance.now() - t0) * 0.1;
}
// neighbouring seats (by the borders of their provinces) and the leagues between them
function tradeLinks() {
  if (WD._links) return WD._links; const L = [];
  WD.provs.forEach((P, a) => { for (const b of P.nb) if (b > a) { const A = WD.setts[P.seat], B = WD.setts[WD.provs[b].seat], d = Math.hypot(A.x - B.x, A.y - B.y); if (d <= 75) L.push([P.seat, WD.provs[b].seat, d]); } });
  return (WD._links = L);
}
function econTrade(inc, fairs) {
  const links = tradeLinks();
  for (let li = 0; li < links.length; li++) {
    const l = links[li], A = G.setts[l[0]], B = G.setts[l[1]], d = l[2];
    if (A.siege || B.siege || A.ctrl >= 5 || B.ctrl >= 5) continue;
    if (A.ctrl !== B.ctrl && hostile(A.ctrl, B.ctrl)) continue;
    const f0 = ECONK.flow * clamp(25 / d, 0.35, 1) * (A.ctrl === B.ctrl ? 1 : 0.7);
    for (const k of GOODS) {
      const sA = A.mk[k] || 0, sB = B.mk[k] || 0, TA = A.mkT[k], TB = B.mkT[k], pA = pxAt(A, k, sA), pB = pxAt(B, k, sB), gap = Math.abs(pA - pB);
      const tc = GD[k].bulk * d * ECONK.carry + 0.04 * Math.min(pA, pB); if (gap <= tc) continue;
      const aSrc = pA < pB, src = aSrc ? A : B, dst = aSrc ? B : A, ss = aSrc ? sA : sB, Ts = aSrc ? TA : TB;
      const x = ss - (sA + sB) / (TA + TB) * Ts; if (x <= 0) continue;
      const q = x * f0 * (1 - tc / gap);
      src.mk[k] = ss - q; dst.mk[k] = (dst.mk[k] || 0) + q; stAdd(dst, 'imp', k, q); stAdd(src, 'exp', k, q);
      inc[dst.ctrl].mk += q * (aSrc ? pB : pA) * ECONK.dutyMk * (dst.ctrl === 0 && fairs ? 1.25 : 1);
    }
  }
  for (let r = 0; r < 5; r++) dutyTo(r, inc[r].mk);
}
function mkSnap(S) { const px = {}; for (const k of GOODS) px[k] = Math.round(priceOf(S, k) / GD[k].p * 100) / 100; return { d: G.day, px }; }
function seeMarket(S) { S.seen = mkSnap(S); }
// merchants carry the news of the last markets they have seen; the king's clerks hear it at his own markets
function caravanNews(a, S) {
  if (S.ctrl === G.player.realm && a.news) for (const n of a.news) { const T = G.setts[n.id]; if (!T || n.id === S.id || G.day - n.d > 60 || (T.seen && T.seen.d >= n.d)) continue; T.seen = { d: n.d, px: n.px }; }
  const L = a.news || (a.news = []), i = L.findIndex(n => n.id === S.id), sn = mkSnap(S); sn.id = S.id; if (i >= 0) L.splice(i, 1); L.push(sn); if (L.length > 3) L.shift();
}
// ---------- merchants ----------
function caravanWant() { let n = 0; for (const S of G.setts) { const t = WD.setts[S.id].type; if ((t === 'town' || t === 'capital') && S.ctrl < 5) n++; } return Math.max(6, Math.round(n / 2)); }
function econCaravans() {
  const live = G.armies.filter(a => a.alive && a.kind === 'caravan');
  // what is already on the way to each market (so merchants do not all rush to the same shortage)
  const inc = {}; for (const a of live) if (a.cargo && a.ai && a.ai.to >= 0) { const o = inc[a.ai.to] || (inc[a.ai.to] = {}); for (const k in a.cargo) o[k] = (o[k] || 0) + a.cargo[k]; }
  ECON.incoming = inc;
  if (live.length < caravanWant() && R.f() < 0.3) spawnCaravan();
}
function spawnCaravan(rng) {
  rng = rng || R;
  const towns = G.setts.filter(S => { const t = WD.setts[S.id].type; return (t === 'town' || t === 'capital') && S.ctrl < 5 && !S.siege; });
  if (!towns.length) return null;
  let tot = 0; for (const S of towns) tot += S.prosp; let x = rng.f() * tot, A = towns[0]; for (const S of towns) { x -= S.prosp; if (x <= 0) { A = S; break; } }
  const ws = WD.setts[A.id], r = A.ctrl;
  const c = mkChar(r, REALM_DEF[r].key, 'merchant', rng, { title: 'Купец' });
  const a = mkArmy(r, 'caravan', c.id, ws.x, ws.y, { levy: 0, spear: rng.i(8, 18), sword: 0, archer: rng.i(4, 10), horse: rng.i(0, 4) });
  Object.assign(a, { food: 700, fodder: 150, water: 4, wagons: rng.i(2, 4), arrows: 100, cash: rng.i(220, 420), cargo: null, home: A.id, trips: 0, profit: 0 });
  a.ai = { task: 'idle', to: -1, from: A.id, t: 0 }; return a;
}
const caravanCap = a => (a.wagons || 2) * 400;
// merchants buy bread and oats out of their own purse at whatever friendly market they stop in
function caravanSupply(a, S, days) {
  if (S.ctrl < 5 && a.realm < 5 && S.ctrl !== a.realm && hostile(a.realm, S.ctrl)) return;
  const men = armyMen(a), horsesN = mountedN(a.u) + (a.wagons || 0) * 2, dd = Math.max(days || 0, a.path ? 12 : 20);
  const buy = (k, want) => { if (want <= 0 || a.cash < 5) return; const p = priceOf(S, k); const n = Math.max(0, Math.min(want, (S.mk[k] || 0) * 0.5, (a.cash - 2) / p)); if (n <= 0) return; a[k] = (a[k] || 0) + n; mkTake(S, k, n); a.cash -= n * p; };
  buy('food', men * dd - a.food); buy('fodder', horsesN * dd * 0.7 - (a.fodder || 0)); a.water = waterCap(a);
}
// the best trip from market M: one ware, one destination, the most profit per day on the road
function planTrip(a, M) {
  const ws = WD.setts[M.id], inc = ECON.incoming || {}, cand = []; let best = null;
  if (a.cash < 90) return null;
  for (const k of GOODS) { const avail = (M.mk[k] || 0) - M.mkT[k] * 0.6; if (avail > 0) cand.push(k, avail, pxAt(M, k, M.mk[k])); }
  if (!cand.length) return null;
  for (const D of G.setts) {
    if (D === M || D.siege || D.ctrl === 6 || (a.bad && a.bad.includes(D.id))) continue; const wd = WD.setts[D.id]; if (wd.type === 'village') continue;
    if (D.ctrl < 5 && a.realm < 5 && hostile(a.realm, D.ctrl)) continue;
    const d = Math.hypot(wd.x - ws.x, wd.y - ws.y); if (d > 80 * SEAT_K) continue;
    const days = d * 1.3 / (BASE_SPEED * 0.8) + 1.5;
    for (let c = 0; c < cand.length; c += 3) {
      const k = cand[c], pb = cand[c + 2];
      if (pxAt(D, k, D.mk[k] || 0) * 0.91 < pb * 1.12) continue; // the price there does not cover the duties and the road
      const want = D.mkT[k] * 1.2 - (D.mk[k] || 0) - ((inc[D.id] && inc[D.id][k]) || 0); if (want <= 0) continue;
      const b = GD[k].bulk; let q = Math.min(cand[c + 1], want, b > 0 ? caravanCap(a) / b : 25); if (q * GD[k].p < 15) continue;
      q = Math.min(q, (a.cash - 60) / (pb * 1.15)); if (q * GD[k].p < 15) continue;
      const cost = buyCost(M, k, q) * (1 + ECONK.dutyBuy), gain = sellGain(D, k, q) * (1 - ECONK.dutySell) * 0.97, prof = gain - cost;
      const sc = prof / days; if (prof > 12 && (!best || sc > best.sc)) best = { D, k, q, cost, gain, prof, sc, days };
    }
  }
  return best;
}
// the nearest walled market where the merchant is welcome (his own realm's or a friendly one)
function safeSeat(a) { let best = -1, bd = 1e9; for (const S of G.setts) { const w = WD.setts[S.id]; if (w.type === 'village' || S.siege || S.ctrl >= 5 || (S.ctrl !== a.realm && hostile(a.realm, S.ctrl))) continue; const d = Math.hypot(w.x - a.x, w.y - a.y) * (S.ctrl === a.realm ? 0.8 : 1); if (d < bd) { bd = d; best = S.id; } } return best; }
function dutyTo(r, v) { if (r < 0 || r >= 5 || v <= 0) return; const R0 = G.realms[r]; R0.dutyAcc = (R0.dutyAcc || 0) + v; }
function aiCaravan(a) {
  const th = threatsNear(a, 4); if (th.length && a.ai.task !== 'flee') { const s = safeSeat(a); if (s >= 0) goTo(a, WD.setts[s].i, 'flee'); a.ai.t = 3; return; }
  if (a.path) return;
  if (a.ai.task === 'flee') a.ai.task = a.cargo ? 'trade' : 'idle';
  const here = settNear(a.x, a.y, 1.5), H0 = here >= 0 ? G.setts[here] : null, hereSeat = H0 && WD.setts[here].type !== 'village';
  // arrived: sell the cargo
  if (a.cargo && a.ai.to >= 0 && here === a.ai.to) {
    const D = G.setts[here]; let gain = 0;
    for (const k in a.cargo) { const q = a.cargo[k]; const g = sellGain(D, k, q); D.mk[k] = (D.mk[k] || 0) + q; gain += g; stAdd(D, 'imp', k, q); }
    const duty = gain * ECONK.dutySell * (D.ctrl === 0 && G.court && hasTech('fairs') ? 1.25 : 1); dutyTo(D.ctrl, duty);
    const net = gain * 0.97 - duty; a.cash += net; a.profit = (a.profit || 0) + net - (a.ai.cost || 0); a.trips = (a.trips || 0) + 1;
    if (D.ctrl === G.player.realm || a.realm === G.player.realm) { const R1 = G.realms[G.player.realm]; R1.tradeN = (R1.tradeN || 0) + 1; }
    if (a.realm === G.player.realm) seeMarket(D);
    caravanNews(a, D);
    a.cargo = null; a.ai.task = 'idle'; a.ai.from = here; a.ai.to = -1; a.ai.t = 0;
    if (a.cash > 900) { const x = a.cash - 700; a.cash = 700; dutyTo(a.realm, x * 0.2); } // a rich guild pays its dues at home
  }
  if (!a.cargo && a.cash < 50 && hereSeat) { destroyArmy(a, 'разорились'); return; } // a ruined merchant: his men go home
  if (a.ai.t > 0) { a.ai.t--; return; }
  // at a market: plan the next trip
  if (hereSeat && !a.cargo) {
    const tr = planTrip(a, H0);
    if (tr) {
      const M = H0, k = tr.k, purse = a.cash - 60; let q = tr.q, cost = buyCost(M, k, q); if (cost * (1 + ECONK.dutyBuy) > purse) { q *= purse / (cost * (1 + ECONK.dutyBuy)) * 0.95; cost = buyCost(M, k, q); }
      const p = planPath(a, WD.setts[tr.D.id].i), wd = WD.setts[tr.D.id]; if (!p || p.length < 2 || p.length > 40 + 2.2 * Math.hypot(wd.x - a.x, wd.y - a.y)) { (a.bad || (a.bad = [])).push(tr.D.id); if (a.bad.length > 12) a.bad.shift(); a.ai.t = 1; return; } // out of reach (another island): never again
      const duty = cost * ECONK.dutyBuy; M.mk[k] -= q; a.cash -= cost + duty; dutyTo(M.ctrl, duty); stAdd(M, 'exp', k, q);
      a.cargo = { [k]: q }; a.ai = { task: 'trade', to: tr.D.id, from: M.id, t: 0, k, cost: cost + duty, goal: WD.setts[tr.D.id].i }; setPath(a, p);
      caravanSupply(a, M, p.length / (BASE_SPEED * 0.6) + 6); // bread for the road
      if (a.realm === G.player.realm) seeMarket(M);
      caravanNews(a, M);
      return;
    }
    a.ai.idle = (a.ai.idle || 0) + 1; a.ai.t = R.i(2, 4);
    if (a.ai.idle < 3) return;
  }
  // nothing worth carrying here (or not at a market): go and look elsewhere
  if (a.cargo && a.ai.to >= 0) { if (!goTo(a, WD.setts[a.ai.to].i, 'trade')) { a.ai.lost = (a.ai.lost || 0) + 1; if (a.ai.lost > 3) { a.cargo = null; a.ai.to = -1; a.ai.lost = 0; } a.ai.t = 2; } return; }
  const L = G.setts.filter(S => { const t = WD.setts[S.id].type; if (t === 'village' || S.siege || S.ctrl === 6 || S.id === here) return false; if (S.ctrl < 5 && a.realm < 5 && hostile(a.realm, S.ctrl)) return false; const w = WD.setts[S.id]; return Math.hypot(w.x - a.x, w.y - a.y) < 55 * SEAT_K; });
  if (L.length) { const S = R.pick(L); a.ai.idle = 0; a.ai.task = 'seek'; goTo(a, WD.setts[S.id].i, 'trade'); } else a.ai.t = 5;
}
// what a beaten caravan leaves to the victor (gold for the wares and the purse)
function caravanLoot(la) { let v = (la.cash || 0) * 0.6; if (la.cargo) for (const k in la.cargo) v += la.cargo[k] * GD[k].p * 0.5; la.cash = 0; la.cargo = null;
  const L = G.robbed || (G.robbed = []); L.push({ d: G.day, r: la.realm, v: Math.round(v / 0.55), x: Math.round(la.x), y: Math.round(la.y) }); if (L.length > 40) L.shift(); return Math.round(v); }
// ---------- the treasury ----------
function provIncome(p) { const P = G.provs[p]; return (P.ecTax || 0) + (P.ecCraft || 0); }
// what the crown's books add to (or take from) the dues of the land: studies, the court's decrees; the AI by difficulty
function crownK(r) { let k = 1; if (r === 0 && G.court && G.houses) k = techIncK() * (G.court.incK || 1) * (G.court.taxK || 1); if (r !== G.player.realm) k *= 0.85 + 0.15 * G.diff; return k; }
function realmEconomy(r) {
  const R0 = G.realms[r]; if (r >= 5) return;
  if (ECON.incDay !== G.day || !ECON.inc) econDaily();
  let tax = 0, craft = 0; const crown = r === 0 && G.court && G.houses;
  WD.provs.forEach((P, p) => { const seat = G.setts[P.seat]; if (seat.ctrl !== r) return; const Q = G.provs[p];
    if (crown) { const H0 = seat.house >= 0 ? G.houses[seat.house] : null; if (H0 && H0.defiant > G.day) return; } // a defiant house withholds its dues
    tax += Q.ecTax || 0; craft += Q.ecCraft || 0; });
  if (ECON.inc && ECON.inc[r]) tax += ECON.inc[r].occ; // villages and towns held in provinces whose seat is another's
  let duty = R0.dutyAcc || 0; R0.dutyAcc = 0;
  const k = crownK(r);
  tax *= k; craft *= k; duty *= crown ? techIncK() : 1;
  let inc = tax + craft + duty, exp = 0, trib = 0, tribOut = 0;
  const ai = r !== G.player.realm, ex = { army: 0, gar: 0, spies: 0 };
  for (const a of G.armies) if (a.alive && a.realm === r && (a.kind === 'lord' || a.kind === 'player')) ex.army += upkeepU(a.u) * (ai ? 0.7 : 1);
  for (const S of G.setts) if (S.ctrl === r) ex.gar += upkeepU(S.gar) * 0.25;
  for (const sp of G.spies) if (r === G.player.realm && sp.until >= G.day) ex.spies += 0.3;
  exp = ex.army + ex.gar + ex.spies;
  if (R0.tribute) for (const tr of R0.tribute) { if (tr.until >= G.day) { if (tr.to === r) trib += tr.amt; else tribOut += tr.amt; } }
  inc += trib; exp += tribOut;
  R0.inc = inc; R0.exp = exp; R0.gold += inc - exp;
  R0.ec = { tax, craft, duty, trib, army: ex.army, gar: ex.gar, spies: ex.spies, tribOut };
  const E = R0.ec30 || (R0.ec30 = {}); for (const key in R0.ec) ema(E, key, R0.ec[key], 1 / 30);
}
