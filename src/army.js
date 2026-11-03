'use strict';
// ===== ARMY: movement, logistics, grounds, sieges =====
// arrival orders are plain data ({ k, s }) so that they survive a save; an in-session closure still works
const ARRIVE = {
  sett: (a, o) => arriveSett(o.s),
  siege: (a, o) => { const r = o.r !== undefined ? o.r : a.realm, c = G.setts[o.s].ctrl; if (c !== r && (hostile(r, c) || c === 5)) aiArriveSett(a, o.s); },
  loot: (a, o) => banditLoot(a, G.setts[o.s]),
};
function runArrive(a, f) { if (typeof f === 'function') f(a); else if (f && ARRIVE[f.k]) ARRIVE[f.k](a, f); }
// movement cost tables by season and cavalry (terrain, roads, rivers): built once per world, so a long A* costs little
const MCT = { wd: null, t: [] };
function costTable(season, cav) {
  if (MCT.wd !== WD) { MCT.wd = WD; MCT.t = []; } const k = season * 2 + (cav ? 1 : 0); let T = MCT.t[k]; if (T) return T;
  T = MCT.t[k] = new Float32Array(NT); const o = { cav }; for (let j = 0; j < NT; j++) T[j] = moveCost(WD, j, season, o); return T;
}
function settAtTile(t) { let m = WD._sAt; if (!m) { m = WD._sAt = new Int16Array(NT).fill(-1); for (const s of WD.setts) m[s.y * MW + s.x] = s.id; } return t >= 0 && t < NT ? m[t] : -1; }
function settNear(x, y, r) { let best = -1, bd = r * r; for (const s of WD.setts) { const d = (s.x + 0.5 - x) ** 2 + (s.y + 0.5 - y) ** 2; if (d <= bd) { bd = d; best = s.id; } } return best; }
// v3.4: the share of a day's water an army finds on the spot (brooks, springs, farm wells) — big hosts drain small streams, summer dries them
function springCover(a, t) { const k = { [TR.GRASS]: 0.6, [TR.FARM]: 0.8, [TR.FOREST]: 0.8, [TR.DFOREST]: 0.9, [TR.HILLS]: 0.6, [TR.MOUNT]: 0.5, [TR.PEAK]: 0.3, [TR.MARSH]: 1, [TR.STEPPE]: 0.15, [TR.SNOW]: 1, [TR.BEACH]: 0.2 }[WD.ter[t]] || 0;
  const men = armyMen(a) + (a.wounded || 0) + (a.sick || 0), big = clamp(700 / Math.max(1, men), 0.35, 1); return k * big * [1, 0.75, 0.9, 1][seasonOf(G.day)] + (WD.road[t] ? 0.15 : 0); }
// expected change of the water stock today: { full: barrels filled to the brim, d: days of water gained (+) or lost (−), s: why }
function waterDay(a, t, Wt) { if (t === undefined) t = armyTile(a); Wt = Wt || weatherOf(); if (nearWater(t)) return { full: 1, d: 0, s: 'река, озеро или колодцы поселения рядом — бочки полны' };
  if (Wt.wet || Wt.cold) return { d: (Wt.wet ? 1 : 0) + (Wt.sick ? 1 : 0), s: Wt.wet ? 'дождь: воду ловят в плащи и бочки' : 'топят снег' };
  const need = Wt.heat ? 1.5 : 1, cov = Math.min(need, springCover(a, t)); return { d: -(need - cov), s: cov >= need - 0.01 ? 'ручьи и родники дают всю воду' : cov > 0.05 ? 'ручьи и родники дают ' + Math.round(cov / need * 100) + '% нужды' + (Wt.heat ? ' (жара)' : '') : 'вокруг сухо' + (Wt.heat ? ', жара' : '') }; }
function nearWater(t) { if (WD.fwd[t] <= 2) return true; const x = t % MW, y = (t / MW) | 0; return settNear(x + 0.5, y + 0.5, 2.2) >= 0; }
function isCav(a) { const m = armyMen(a); return m > 0 && mountedN(a.u) >= m * 0.9 && a.wagons === 0; }
function armySpeed(a) {
  let s = BASE_SPEED; const men = armyMen(a);
  if (isCav(a)) s *= 1.45;
  if (men > 1200) s *= 0.82; else if (men > 600) s *= 0.9;
  if (a.forced) s *= 1.35;
  if (a.fat > 75) s *= 0.78; else if (a.fat > 50) s *= 0.9;
  if (a.hunger > 0) s *= 0.85; if (a.thirst > 0) s *= 0.8;
  if (a.kind === 'caravan') s *= 0.8;
  s /= weatherOf().mv;
  return s;
}
function stepCost(a, j) {
  let c = moveCost(WD, j, seasonOf(G.day), { cav: mountedN(a.u) > armyMen(a) * 0.5 }); if (!(c < Infinity)) return c;
  if (!WD.road[j]) {
    const men = Math.max(1, armyMen(a)); if (a.wagons) c *= 1 + Math.min(0.35, a.wagons / (men / 100 + 1) * 0.06);
    const p = WD.prov[j]; if (p >= 0 && G.provs[p].guides > G.day && (a.realm === G.player.realm)) c *= 0.8;
  }
  return c;
}
function planPath(a, goal) {
  const start = armyTile(a); if (start === goal) return [start];
  const men = Math.max(1, armyMen(a)), T = costTable(seasonOf(G.day), mountedN(a.u) > men * 0.5), road = WD.road, prov = WD.prov;
  const wf = a.wagons ? 1 + Math.min(0.35, a.wagons / (men / 100 + 1) * 0.06) : 1, gp = a.realm === G.player.realm ? G.provs : null, day = G.day;
  const cf = j => { const c = T[j]; if (road[j] || c === Infinity) return c; let k = c * wf; if (gp) { const p = prov[j]; if (p >= 0 && gp[p].guides > day) k *= 0.8; } return k; }; // = stepCost(a, j)
  const t0 = performance.now(), p = astar(start, goal, cf, { river: WD.river, maxN: 600000 });
  PATHST.n++; PATHST.ms += performance.now() - t0; PATHST.nodes = AST.last; return p;
}
function pathDays(a, path, from) {
  if (!path) return Infinity; let c = 0;
  for (let k = (from || 0); k < path.length - 1; k++) { const f = path[k], t = path[k + 1]; const diag = f % MW !== t % MW && ((f / MW) | 0) !== ((t / MW) | 0); c += stepCost(a, t) * (diag ? 1.414 : 1); }
  return c / armySpeed(a);
}
// path length in kilometres (a tile is KM_PER_TILE km across; diagonals ×√2)
function pathKm(path, from) { if (!path) return 0; let c = 0; for (let k = (from || 0); k < path.length - 1; k++) { const f = path[k], t = path[k + 1]; c += (f % MW !== t % MW && ((f / MW) | 0) !== ((t / MW) | 0)) ? 1.414 : 1; } return c * KM_PER_TILE; }
const kmTxt = km => (km < 20 ? Math.max(1, Math.round(km)) : km < 100 ? Math.round(km / 5) * 5 : Math.round(km / 10) * 10) + ' км';
function setPath(a, path) { a.path = path; a.pi = 0; if (path && path.length > 1) { if (a.mode !== 'march') { a.mode = 'march'; } a.camp = 0; a.fortDays = 0; if (a.siegeOf >= 0) endSiege(a); } }
function advanceArmy(a, dd) {
  if (!a.path || a.pi >= a.path.length - 1) return;
  let budget = dd * armySpeed(a); let moved = 0;
  while (budget > 1e-6 && a.pi < a.path.length - 1) {
    const to = a.path[a.pi + 1]; const tx = to % MW + 0.5, ty = ((to / MW) | 0) + 0.5;
    const c = stepCost(a, to); if (!(c < Infinity)) { a.path = null; if (isKingArmy(a)) autoPause('Путь прегражден — войско остановилось'); return; }
    const d = Math.hypot(tx - a.x, ty - a.y);
    const can = budget / c;
    if (can >= d) { a.x = tx; a.y = ty; budget -= d * c; a.pi++; moved += d; }
    else { a.x += (tx - a.x) / d * can; a.y += (ty - a.y) / d * can; moved += can; budget = 0; }
  }
  a.moved = (a.moved || 0) + moved;
  if (a.pi >= a.path.length - 1) { a.path = null; const f = a.onArrive; a.onArrive = null; if (isKingArmy(a) && G.player.follow < 0) autoPause(f ? '' : 'Войско прибыло'); if (f) runArrive(a, f); }
}
const isKingArmy = a => !!G && a.id === G.player.army && a.kind === 'player' && typeof autoPause === 'function';
// ---------- grounds (Sun Tzu ch.11) ----------
const GROUNDS = {
  dispersive: { n: 'Рассеивающая', q: 'На рассеивающей земле не сражайся.', e: 'Своя земля: воины думают о доме. Дезертирство ×2, боевой дух в бою −5.' },
  facile: { n: 'Лёгкая', q: 'На лёгкой земле не останавливайся.', e: 'Неглубоко в чужой земле: стоянка здесь −1 к духу в день.' },
  contentious: { n: 'Спорная', q: 'На спорной земле не нападай.', e: 'Выгодная позиция (холм, брод, мост, перевал): обороняющийся +20% в бою.' },
  open: { n: 'Открытая', q: 'На открытой земле не преграждай пути.', e: 'Равнина: конница +10% в бою.' },
  intersecting: { n: 'Перекрёсточная', q: 'На перекрёсточной земле заключай союзы.', e: 'Стык трёх держав: предложения союза и мира +15.' },
  serious: { n: 'Тяжёлая', q: 'На тяжёлой земле грабь.', e: 'Глубоко в земле врага: войско сплочено (дезертирства нет, дух +5), фуражировка +50%.' },
  difficult: { n: 'Труднопроходимая', q: 'На труднопроходимой земле иди без остановки.', e: 'Лес, болото, горы: стоянка утомляет, болезни ×1.5.' },
  hemmed: { n: 'Окружённая', q: 'На окружённой земле прибегай к хитрости.', e: 'Теснина: засада здесь страшна. Атакующий из укрытия +30%.' },
  death: { n: 'Смертельная', q: 'На смертельной земле сражайся.', e: 'Враги вокруг: в бою боевой дух +25, бегство позже.' },
};
// distance (tiles, up to 254) to the realm's lands; kept until the map of ownership changes
let BORDER_D = null, BORDER_DAY = -1, BORDER_SIG = '';
const PATHST = { n: 0, ms: 0, nodes: 0 };
function borderDist(realm) {
  if (BORDER_DAY !== G.day || !BORDER_D) { BORDER_DAY = G.day; const sig = WD.provs.map(P => G.setts[P.seat].ctrl).join(','); if (sig !== BORDER_SIG || !BORDER_D || BORDER_D.wd !== WD) { BORDER_D = { wd: WD }; BORDER_SIG = sig; } }
  if (BORDER_D[realm]) return BORDER_D[realm];
  const d = new Uint8Array(NT).fill(255); const q = new Int32Array(NT); let qh = 0, qt = 0; const pr = WD.prov, own = WD.provs.map(P => G.setts[P.seat].ctrl);
  for (let i = 0; i < NT; i++) { const p = pr[i]; if (p >= 0 && own[p] === realm) { d[i] = 0; q[qt++] = i; } }
  while (qh < qt) { const i = q[qh++], x = i % MW, di = d[i]; if (di >= 254) continue; for (let k = 0; k < 4; k++) { const j = nb4(i, x, k); if (j >= 0 && d[j] === 255) { d[j] = di + 1; q[qt++] = j; } } }
  BORDER_D[realm] = d; return d;
}
function provRealmsAround(p) { const s = new Set([ownerOfProv(p)]); for (const n of WD.provs[p].nb) s.add(ownerOfProv(n)); s.delete(6); return s.size; }
function groundOf(a) {
  const t = armyTile(a), p = WD.prov[t], T = WD.ter[t];
  // death: hostile power around in 2+ directions exceeding ours
  let dirs = 0, hp = 0; const mine = powerU(a.u, a.xp);
  const qd = [0, 0, 0, 0];
  for (const b of G.armies) { if (!b.alive || b === a || !hostile(a.realm, b.realm) || b.kind === 'caravan') continue; const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < 7) { hp += powerU(b.u, b.xp); qd[(b.x > a.x ? 1 : 0) + (b.y > a.y ? 2 : 0)] = 1; } }
  dirs = qd.reduce((s, v) => s + v, 0);
  if (dirs >= 2 && hp > mine * 1.2) return 'death';
  if (T === TR.MOUNT || T === TR.HILLS || T === TR.DFOREST) { let pass = 0; const x = t % MW, y = (t / MW) | 0; for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && TINFO[WD.ter[ny * MW + nx]].cost > 0 && TINFO[WD.ter[ny * MW + nx]].cost < 3) pass++; } if (pass <= 3) return 'hemmed'; }
  if (WD.bridge[t] || WD.ford[t] || (WD.road[t] && T === TR.MOUNT) || (T === TR.HILLS && WD.road[t])) return 'contentious';
  if (T === TR.FOREST || T === TR.DFOREST || T === TR.MARSH || T === TR.MOUNT) return 'difficult';
  if (p < 0) return 'open';
  const ctrl = G.setts[WD.provs[p].seat].ctrl;
  if (ctrl === a.realm) return 'dispersive';
  if (provRealmsAround(p) >= 3) return 'intersecting';
  const bd = borderDist(a.realm)[t];
  if (bd > 14 * SEAT_K && ctrl !== 5) return 'serious';
  if (T === TR.GRASS || T === TR.STEPPE || T === TR.FARM) return bd <= 8 ? 'facile' : 'open';
  return 'facile';
}
// ---------- foraging ----------
function forageYield(a) {
  const t = armyTile(a), p = WD.prov[t]; if (p < 0) return 0;
  const P = WD.provs[p], season = seasonOf(G.day);
  const base = (120 + P.mix[TR.FARM] * 2600 + P.villages.length * 60) * [0.55, 1.0, 1.4, 0.25][season] * (1 - G.provs[p].dev);
  let y = Math.min(armyMen(a) * 1.6, base);
  if (a.realm === G.player.realm && groundOf(a) === 'serious') y *= 1.5;
  return Math.max(0, y);
}
// ---------- daily logistics ----------
function dailyArmy(a) {
  for (const u of UT) if (a.u[u] % 1) a.u[u] = Math.round(a.u[u]); // repair fractional men left by older saves
  let men = armyMen(a); if (men <= 0) { destroyArmy(a, 'разбежалось'); return; }
  const t = armyTile(a), season = seasonOf(G.day), Wt = weatherOf(), p = WD.prov[t];
  const sid = settNear(a.x, a.y, 1.2); const inOwn = sid >= 0 && G.setts[sid].ctrl === a.realm;
  const isP = a.kind === 'player', moved = (a.moved || 0) > 0.3; a.moved = 0;
  const gr = (isP || a.kind === 'lord') ? groundOf(a) : 'open'; a.ground = gr;
  // water: rivers, lakes and settlements fill the barrels; brooks, springs and farm wells cover part of the day's need elsewhere
  const wd = waterDay(a, t, Wt);
  if (wd.full || a.kind === 'caravan') { a.water = waterCap(a); a.thirst = 0; } // merchants know every well on their roads
  else { a.water = Math.min(waterCap(a), a.water + wd.d); if (a.water < 0) { a.water = 0; a.thirst++; } else a.thirst = 0; }
  // AI resupply in own settlements
  if (a.kind === 'caravan') { if (sid >= 0) caravanSupply(a, G.setts[sid]); }
  else if (!isP && inOwn && a.kind !== 'bandit') aiResupply(a, G.setts[sid]);
  // food
  const aiLive = a.kind === 'lord' && p >= 0 && ownerOfProv(p) !== a.realm && a.food < men * 4; // AI lords live off foreign land on the march
  if (a.mode === 'forage' || ((a.kind === 'bandit') && !moved) || (a.kind === 'lord' && a.mode === 'siege') || aiLive) {
    const y = forageYield(a) * (a.mode === 'forage' ? 1 : a.mode === 'siege' ? 0.6 : 0.5); a.food += y; if (p >= 0) { G.provs[p].dev = Math.min(0.9, G.provs[p].dev + y / 9000); if (isP && ownerOfProv(p) === a.realm) G.provs[p].unrest = Math.min(100, G.provs[p].unrest + 3); }
    a.foraged = y;
  }
  let eat = (men + a.wounded + a.sick) * eatK(); a.townFed = 0; // winter: a fifth more (granary.js)
  if (isP && inOwn) { // quartered in our own town: it feeds the army at market price while the treasury can pay
    const S = G.setts[sid], R0 = G.realms[a.realm], pr = priceOf(S, 'food'); const n = Math.max(0, Math.floor(Math.min(eat, S.mk.food || 0, (R0.gold - 20) / pr)));
    if (n > 0) { mkTake(S, 'food', n); R0.gold -= n * pr; eat -= n; a.townFed = n; }
  }
  if (a.kind === 'caravan' && a.food < eat) { a.cash -= (eat - a.food) * 0.07; a.food = eat; if (a.cash < 0) { a.cash = 0; destroyArmy(a, 'разорились'); return; } } // merchants buy their bread at the inns
  a.food -= eat; if (a.food < 0) { a.food = 0; a.hunger++; } else a.hunger = 0;
  // fodder
  const horsesN = mountedN(a.u) + a.horses + a.wagons * 2; const grassy = [TR.GRASS, TR.STEPPE, TR.FARM, TR.HILLS, TR.BEACH].includes(WD.ter[t]);
  const graze = grassy ? [0.7, 0.9, 0.5, 0][season] : [0.3, 0.4, 0.2, 0][season];
  a.fodder -= horsesN * (1 - graze); if (a.fodder < 0) { a.fodder = 0; starveHorses(a, isP); a.starveH = (a.starveH || 0) + 1; } else a.starveH = 0;
  // fatigue
  if (moved) a.fat += a.forced ? 11 : 3.5 + ([TR.MOUNT, TR.MARSH, TR.DFOREST].includes(WD.ter[t]) ? 2 : 0) + (Wt.heat ? 1.5 : 0);
  else if (inOwn) a.fat -= 20; else if (a.mode === 'fort') a.fat -= 10; else if (a.mode === 'drill') a.fat += 2; else a.fat -= gr === 'difficult' ? 6 : 12;
  if (a.hunger) a.fat += 4; if (a.thirst) a.fat += 6;
  a.fat = clamp(a.fat, 0, 100);
  // sickness
  let sr = 0.0012; if (WD.ter[t] === TR.MARSH) sr *= 5; if (season === 3 && !inOwn) sr *= 2.5; if (a.hunger) sr *= 3; if (a.thirst) sr *= 4; if (Wt.sick) sr *= Wt.sick; if (gr === 'difficult') sr *= 1.5; if (a.stay > 12 && !inOwn) sr *= 2; if (a.mode === 'siege' && a.stay > 15) sr *= 1.6;
  const ns = men * sr * R.range(0.5, 1.5); if (ns >= 1) { const k = takeMen(a, Math.round(ns)); a.sick += k; }
  // sick & wounded: recover / die
  if (a.sick > 0) { const rec = a.sick * (inOwn ? 0.14 : 0.06) * (a.realm === 0 && hasTech('surgery') ? 1.4 : 1) * (a.kind === 'player' && docInCamp() ? 1.25 : 1), die = a.sick * (WD.ter[t] === TR.MARSH ? 0.03 : 0.012) * (a.hunger ? 2 : 1); a.sick = Math.max(0, a.sick - rec - die); a.u.levy += 0; returnMen(a, rec); a.deaths = (a.deaths || 0) + die; }
  if (a.wounded > 0) { const rec = a.wounded * (inOwn ? 0.09 : 0.035), die = a.wounded * 0.006; a.wounded = Math.max(0, a.wounded - rec - die); returnMen(a, rec); }
  // starvation / thirst deaths
  if (a.hunger > 3) { const k = takeMen(a, Math.ceil(men * 0.01 * (a.hunger - 3))); if (isP && k) log('Голод: ' + (k % 10 === 1 && k % 100 !== 11 ? 'умер ' : 'умерли ') + k + ' ' + plural(k, 'воин', 'воина', 'воинов') + '.', 'bad'); }
  if (a.thirst > 1) { const k = takeMen(a, Math.ceil(men * 0.02 * a.thirst)); if (isP && k) log('Жажда: ' + (k % 10 === 1 && k % 100 !== 11 ? 'погиб ' : 'погибли ') + k + ' ' + plural(k, 'воин', 'воина', 'воинов') + '.', 'bad'); }
  // drill
  if (a.mode === 'drill') { for (const u of UT) a.xp[u] = Math.min(100, a.xp[u] + 0.6 * (1 - a.xp[u] / 120)); }
  // fortified camp construction
  if (a.mode === 'fort') a.fortDays = Math.min(3, a.fortDays + 1);
  if (!moved) a.stay++; else a.stay = 0;
  // morale
  const gen = charOf(a.gen); let tgt = 62 + (gen ? traitSum(gen, 'mor') : 0);
  if (a.hunger) tgt -= 18 + a.hunger * 3; if (a.thirst) tgt -= 25; tgt -= a.fat / 5; tgt -= (a.sick / Math.max(1, men)) * 60;
  if (a.realm < 5 && G.realms[a.realm].gold < 0) tgt -= 25;
  if (a.vict) { tgt += a.vict; a.vict *= 0.93; if (Math.abs(a.vict) < 0.5) a.vict = 0; }
  if (gr === 'serious') tgt += 5; if (gr === 'dispersive') tgt -= 3; if (gr === 'facile' && !moved) tgt -= 4;
  if (inOwn) tgt += 6; if (a.mode === 'fort' && a.fortDays >= 2) tgt += 4; if (a.mode === 'drill') tgt += 2;
  if (season === 3 && !inOwn) tgt -= 6;
  a.morale += (clamp(tgt, 5, 100) - a.morale) * 0.15; a.morale = clamp(a.morale, 0, 100);
  // desertion
  if (a.morale < 35 && a.kind !== 'caravan' && gr !== 'serious' && gr !== 'death') {
    const k = (35 - a.morale) / 35 * 0.03 * (gr === 'dispersive' ? 2 : 1) * (a.disc > G.day ? 0.4 : 1);
    let lost = 0; for (const u of UT) { const pro = { sword: 0.3, horse: 0.3, knight: 0.2, harch: 0.35, xbow: 0.6 }[u] || 1; const n = Math.floor(a.u[u] * k * pro * R.range(0.6, 1.4)); a.u[u] -= n; lost += n; }
    if (isP && lost > 0) log('Дезертирство: ' + (lost % 10 === 1 && lost % 100 !== 11 ? 'ушёл ' : 'ушли ') + lost + ' ' + plural(lost, 'воин', 'воина', 'воинов') + '. Боевой дух слишком низок.', 'bad');
  }
  if (a.mode === 'siege') siegeDaily(a);
  if (armyMen(a) <= 0 && a.alive) destroyArmy(a, 'погибло');
}
function takeMen(a, n) { // remove n men proportionally (sickness, starvation)
  const men = armyMen(a); if (men <= 0 || n <= 0) return 0; n = Math.min(n, men); let left = n;
  for (const u of UT) { const k = Math.min(a.u[u], Math.round(n * a.u[u] / men)); a.u[u] -= k; left -= k; }
  for (const u of UT) { if (left <= 0) break; const k = Math.min(a.u[u], left); a.u[u] -= k; left -= k; }
  return n - left;
}
function returnMen(a, n) { // recovered men go back proportionally (levy & spear first)
  if (n <= 0) return; n += a.retAcc || 0; const k = Math.floor(n); a.retAcc = n - k; if (k <= 0) return; // whole men only: the fraction waits for tomorrow
  const men = armyMen(a); if (men <= 0) { a.u.levy += k; return; }
  let left = k; const sh = UT.map(u => [u, k * a.u[u] / men]); for (const [u, v] of sh) { const f = Math.floor(v); a.u[u] += f; left -= f; }
  sh.sort((x, y) => (y[1] % 1) - (x[1] % 1)); for (const [u] of sh) { if (left <= 0) break; a.u[u]++; left--; }
}
function destroyArmy(a, why) {
  if (!a.alive) return; a.alive = 0; a.path = null;
  if (a.siegeOf >= 0) endSiege(a);
  if (a.kind === 'player') onPlayerArmyLost(a, why);
  if (a.realm === 0 && a.kind === 'lord' && G.court) { try { cmdLost(a, why); } catch (e) { console.error(e); } }
  else if (a.kind === 'lord') { const g = charOf(a.gen); if (g) g.army = -1; }
}
function onPlayerArmyLost(a, why) {
  const r = G.realms[G.player.realm]; const cap = r.capital;
  if (G.court && cap >= 0 && G.setts[cap].ctrl === G.player.realm && !G.atCourt) { // v3: the king flees home to his castle
    const C = G.court, ws0 = WD.setts[cap], king = charOf(G.player.char); const ret = mkRetinue(); ret.u = Object.assign(emptyU(), { spear: 4, sword: 3, archer: 2, horse: 5 }); ret.morale = 35; ret.gen = king.id;
    C.retinue = ret; G.player.army = ret.id; for (const c of G.chars) if (c.withKing) { c.withKing = 0; if (!armyOfGen(c.id)) c.atCourt = 1; }
    G.atCourt = 1; king.atCourt = 1; C.view = 0; G.toCourt = 1; prestige(-4);
    log('Войско короля разбито! Король с горсткой верных бежал в замок ' + ws0.name + '.', 'bad'); return; }
  const S = G.setts.find(S => S.ctrl === G.player.realm && (S.id === cap)) || G.setts.find(S => S.ctrl === G.player.realm && WD.setts[S.id].type !== 'village');
  if (!S) { G.over = { win: false, why: 'Держава пала: у короля не осталось ни одной крепости.' }; return; }
  const ws = WD.setts[S.id];
  const na = mkArmy(G.player.realm, 'player', G.player.char, ws.x, ws.y, { levy: 20, spear: 10, sword: 0, archer: 0, horse: 10 });
  Object.assign(na, { food: 200, water: 4, morale: 40 });
  G.player.army = na.id; log('Войско короля разбито! Король бежал в ' + ws.name + ' с горсткой верных.', 'bad');
}
// ---------- sieges ----------
function startSiege(a, sid) {
  const S = G.setts[sid]; if (S.siege) return false;
  S.siege = { by: a.id, realm: a.realm, d0: G.day, works: 0, need: S.walls * 30 + 10, asked: -99 };
  a.mode = 'siege'; a.siegeOf = sid; a.path = null; a.stay = 0;
  return true;
}
function endSiege(a) { const S = G.setts[a.siegeOf]; if (S && S.siege && S.siege.by === a.id) S.siege = null; a.siegeOf = -1; if (a.mode === 'siege') a.mode = 'march'; }
function woodNear(t) { const x = t % MW, y = (t / MW) | 0; let n = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { if (!inMap(x + dx, y + dy)) continue; const T = WD.ter[(y + dy) * MW + x + dx]; if (T === TR.FOREST || T === TR.DFOREST) n++; } return n; }
function siegeDaily(a) {
  const S = G.setts[a.siegeOf]; if (!S || !S.siege || S.siege.by !== a.id) { a.mode = 'march'; a.siegeOf = -1; return; }
  const sg = S.siege; const ws = WD.setts[S.id];
  if (S.ctrl === a.realm || !(hostile(a.realm, S.ctrl) || S.ctrl === 5)) { endSiege(a); return; }
  const gen = charOf(a.gen);
  const wood = woodNear(ws.i); const rate = (wood > 6 ? 12 : wood > 0 ? 8 : 4) * Math.min(1.2, armyMen(a) / 150) * (gen && gen.traits.includes('patient') ? 1.3 : 1) * (a.realm === 0 && hasTech('engines') ? 1.4 : 1) * (a.realm === 0 && hasTech('bombards') ? 1.6 : 1);
  sg.works = Math.min(sg.need, sg.works + rate);
  if (!granSiegeFeed(S)) S.food -= 1; if (S.food <= 0) { S.food = 0; sg.starve = (sg.starve || 0) + 1; const k = takeU(S.gar, Math.ceil(menOf(S.gar) * 0.04)); }
  // AI attacker decisions (player decides via UI)
  if (a.kind !== 'player') aiSiegeDecision(a, S);
  if (menOf(S.gar) <= 0) captureSett(a, S, 'гарнизон истаял');
}
function takeU(u, n) { const men = menOf(u); if (men <= 0) return 0; n = Math.min(n, men); for (const t of UT) u[t] = Math.max(0, u[t] - Math.round(n * u[t] / men)); return n; }
function surrenderChance(a, S) {
  const ratio = powerU(a.u, a.xp) / Math.max(1, powerU(S.gar) * (1 + S.walls * 0.5));
  let c = 0.03 + clamp((ratio - 1) * 0.07, -0.05, 0.35);
  if (S.food <= 0) c += 0.4; else if (S.food < 5) c += 0.15;
  if (S.siege) c += Math.min(0.15, (G.day - S.siege.d0) * 0.006);
  const lord = S.lord >= 0 ? charOf(S.lord) : charOf(G.realms[S.owner] ? G.realms[S.owner].ruler : -1);
  if (lord && lord.traits.includes('proud')) c -= 0.12; if (lord && lord.traits.includes('craven')) c += 0.1;
  if (a.realm === G.player.realm) c += (G.realms[a.realm].fear || 0) * 0.002;
  if (WD.setts[S.id].type === 'capital') c -= 0.15;
  return clamp(c, 0.01, 0.95);
}
function captureSett(a, S, how) {
  const prev = S.ctrl; const ws = WD.setts[S.id];
  if (S.siege) S.siege = null; if (a.siegeOf === S.id) { a.siegeOf = -1; a.mode = 'march'; }
  S.ctrl = a.realm; S.gar = emptyU(); S.occDay = G.day; S.food = Math.max(S.food, 5);
  // leave a small detachment
  const det = Math.min(Math.round(armyMen(a) * 0.06), 30); const k = Math.min(det, a.u.levy + a.u.spear);
  const fromL = Math.min(a.u.levy, k); a.u.levy -= fromL; S.gar.levy += fromL; const fromS = Math.min(a.u.spear, k - fromL); a.u.spear -= fromS; S.gar.spear += fromS;
  BORDER_DAY = -1;
  if (a.realm === G.player.realm) { log('Взят ' + ws.name + (how ? ' (' + how + ')' : '') + '!', 'good'); G.stats.sieges++; }
  else if (prev === G.player.realm) log(REALM_DEF[a.realm].name + ' ' + rV(a.realm, 'захватила', 'захватило', 'захватили') + ' ' + ws.name + '!', 'bad');
  if (typeof onCapture === 'function') onCapture(a, S, prev);
  if (typeof MAPDIRTY !== 'undefined') MAPDIRTY.pol = 1;
}
// no fodder: horses die (≈3% of all beasts a day, worse the longer it lasts) — spare horses first, then draught teams and warhorses alike.
// A dismounted rider fights on foot: horseman → spearman, horse archer → archer, knight → man-at-arms. A wagon that loses its team is abandoned.
function starveHorses(a, isP) { const rid = mountedN(a.u), teams = (a.wagons || 0) * 2; let lost = Math.ceil((a.horses + rid + teams) * 0.03 * Math.min(2, 1 + (a.starveH || 0) * 0.15)); if (lost <= 0) return;
  const sp = Math.min(a.horses, lost); a.horses -= sp; lost -= sp; if (lost <= 0) return;
  const tot = rid + teams; if (tot <= 0) return; let wl = Math.min(a.wagons || 0, Math.round(lost * teams / tot / 2)), rl = lost - wl * 2;
  const DM = { horse: 'spear', harch: 'archer', knight: 'sword' }, out = [];
  for (const t of ['horse', 'harch', 'knight']) { if (rl <= 0) break; const k = Math.min(a.u[t], Math.max(0, Math.round(rl * a.u[t] / Math.max(1, rid))) || (rl > 0 && a.u[t] ? 1 : 0)); if (!k) continue; a.u[t] -= k; a.u[DM[t]] += k; a.xp[DM[t]] = Math.max(a.xp[DM[t]] || 0, Math.min(a.xp[t] || 0, 60)); rl -= k; out.push(k + ' ' + plural(k, UNIT[t].n1, ['всадника', 'конных лучника', 'рыцаря'][['horse', 'harch', 'knight'].indexOf(t)], ['всадников', 'конных лучников', 'рыцарей'][['horse', 'harch', 'knight'].indexOf(t)])); }
  if (wl > 0) { a.wagons -= wl; const ld = armyLoad(a) - armyCap(a); if (ld > 0) a.food = Math.max(0, a.food - ld); }
  if (isP && (out.length || wl)) log('Кони падают от бескормицы: ' + (out.length ? out.join(', ') + ' — спешились' : '') + (out.length && wl ? '; ' : '') + (wl ? 'брошено ' + wl + ' ' + plural(wl, 'повозка', 'повозки', 'повозок') + ' без упряжки' : '') + '.', 'bad'); }
