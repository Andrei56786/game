'use strict';
// ===== AI: economy helpers, realm strategy, army behaviour =====
// prices, incomes and caravans live in econ.js; the old names stay for the rest of the code
const BASEP = {}, ITEMN = {}; for (const k of GOODS) { BASEP[k] = GD[k].p; ITEMN[k] = GD[k].n; }
function realmPower(r, by) {
  let p = 0; for (const a of G.armies) if (a.alive && a.realm === r && (a.kind === 'lord' || a.kind === 'player')) p += by !== undefined ? perceivedPower(a, by) : powerU(a.u, a.xp);
  for (const S of G.setts) if (S.ctrl === r) p += powerU(S.gar) * 0.4;
  return p;
}
function neighbours(r) { const s = new Set(); WD.provs.forEach((P, p) => { if (G.setts[P.seat].ctrl !== r) return; for (const n of P.nb) { const o = G.setts[WD.provs[n].seat].ctrl; if (o !== r) s.add(o); } }); return [...s]; }
function nearestOwnSett(a, fortified, food) {
  let best = -1, bd = Infinity; const men = Math.max(1, armyMen(a));
  for (const S of G.setts) { if (S.ctrl !== a.realm || S.siege) continue; const ws = WD.setts[S.id]; if (fortified && ws.type === 'village') continue; let d = Math.hypot(ws.x + 0.5 - a.x, ws.y + 0.5 - a.y); if (food) d -= Math.min(10, (S.mk.food || 0) / men) * 2.5; if (d < bd) { bd = d; best = S.id; } }
  return best;
}
function aiResupply(a, S) {
  const men = armyMen(a), r = G.realms[a.realm]; if (!r || a.realm >= 5) { a.food = Math.max(a.food, men * 6); return; }
  const buy = (k, want) => { if (want <= 0 || r.gold < 15) return; const p = priceOf(S, k) * (k === 'food' || k === 'fodder' ? 0.6 : 1); const n = Math.max(0, Math.min(want, S.mk[k] || 0, (r.gold - 10) / p)); a[k] += n; mkTake(S, k, n); r.gold -= n * p; };
  buy('food', men * 12 - a.food); buy('fodder', (mountedN(a.u) + a.wagons * 2) * 8 - a.fodder); buy('arrows', rangedN(a.u) * 30 - a.arrows);
  // requisition from own granaries when the market is bare (costs prosperity & goodwill)
  if (a.food < men * 4 && (S.mk.food || 0) < men && S.ctrl === a.realm) { a.food += men * 1.5; S.prosp = Math.max(10, S.prosp - 0.3); const pv = WD.setts[S.id].prov; if (pv >= 0) G.provs[pv].unrest = Math.min(100, G.provs[pv].unrest + 0.6); }
  a.water = waterCap(a);
}
// ---------- realm strategy ----------
// field armies a realm keeps: one per ~4 castles and towns (2…5)
function lordCap(r) { let n = 0; for (const P of WD.provs) if (G.setts[P.seat].ctrl === r) n++; return clamp(Math.round(n / 4), 2, 5); }
function aiRealm(r) {
  const R0 = G.realms[r]; if (r >= 5 || r === G.player.realm || R0.dead) return;
  const ruler = charOf(R0.ruler); const agg = traitSum(ruler, 'agg') + (G.diff - 1) * 0.15;
  const lords = G.armies.filter(a => a.alive && a.realm === r && a.kind === 'lord');
  // recruit / reinforce
  const totMen = lords.reduce((s, a) => s + armyMen(a), 0), reserve = 150 + totMen * 0.8; // keep gold to feed the armies
  if (R0.gold > reserve + 40) {
    for (const a of lords) {
      const sid = settNear(a.x, a.y, 1.2); if (sid < 0 || G.setts[sid].ctrl !== r || armyMen(a) > 380 + G.day * 0.6 || a.food < armyMen(a) * 4) continue; const S = G.setts[sid];
      for (const u of UT) { const n = Math.floor(Math.min(S.pool[u] || 0, (R0.gold - reserve) / UNIT[u].cost)); if (n > 0) { a.u[u] += n; S.pool[u] -= n; R0.gold -= n * UNIT[u].cost; } }
    }
  }
  // raise new army if few
  let gens = G.chars.filter(c => c.realm === r && c.role === 'general' && c.alive && !(c.prison >= 0) && !lords.some(a => a.gen === c.id));
  const cap = lordCap(r);
  if (!gens.length && lords.length < cap && R0.gold > 400 && (G.day + r) % 10 === 0) { // promote a new commander
    mkChar(r, REALM_DEF[r].key, 'general', R, { title: ['Сэр', 'Хёвдинг', 'Кондотьер', 'Паладин', 'Стратиг'][r] }); R0.gold -= 60;
    gens = G.chars.filter(c => c.realm === r && c.role === 'general' && c.alive && !(c.prison >= 0) && !lords.some(a => a.gen === c.id));
  }
  if (gens.length && lords.length < cap && R0.gold > 250 + totMen * 1.0) {
    const S = G.setts[R0.capital]; if (S && S.ctrl === r) { const ws = WD.setts[S.id]; const u = emptyU(); let cost = 0; const bud = Math.min(R0.gold - 120 - totMen * 1.0, 900 + G.day * 2); const mix = [null, { levy: 0.3, spear: 0.2, sword: 0.22, archer: 0.18, xbow: 0.04, horse: 0.06 }, { levy: 0.2, spear: 0.28, sword: 0.12, archer: 0.08, xbow: 0.22, horse: 0.08, knight: 0.02 }, { levy: 0.3, spear: 0.28, sword: 0.12, archer: 0.16, horse: 0.06, knight: 0.08 }, { levy: 0.18, spear: 0.26, sword: 0.12, archer: 0.14, horse: 0.1, harch: 0.12, knight: 0.08 }][r];
      for (const t of UT) { const n = Math.floor(Math.min(S.pool[t] || 0, 120, bud * (mix[t] || 0) / UNIT[t].cost)); u[t] = n; cost += n * UNIT[t].cost; } if (menOf(u) > 80 && cost < R0.gold) { R0.gold -= cost; for (const t of UT) S.pool[t] -= u[t]; S.prosp = Math.max(5, S.prosp - u.levy * 0.04); const a = mkArmy(r, 'lord', gens[0].id, ws.x, ws.y, u); Object.assign(a, { food: menOf(u) * 8, water: 3, arrows: rangedN(u) * 30, wagons: 2, fodder: mountedN(u) * 5 }); a.ai = { task: 'idle', t: 0 }; } }
  }
  // austerity: in debt — send part of the levies home instead of letting armies starve
  if (R0.gold < 0) {
    for (const a of lords) { const cap = G.setts[R0.capital]; for (const t of ['levy', 'spear']) { const n = Math.ceil((a.u[t] || 0) * 0.08); if (n > 0 && armyMen(a) - n > 40) { a.u[t] -= n; if (cap) cap.pool[t] = (cap.pool[t] || 0) + n * 0.7; } } }
    if (R0.gold < -150) for (const S of G.setts) if (S.ctrl === r && !S.siege) { const n = Math.floor((S.gar.levy || 0) * 0.05); S.gar.levy -= n; }
  }
  // garrison top-up
  for (const S of G.setts) if (S.ctrl === r && R0.gold > 60 && !S.siege) { const base = { village: 12, castle: 70, town: 80, capital: 160 }[WD.setts[S.id].type]; if (menOf(S.gar) < base * 0.7) { const n = Math.min(4, Math.floor(S.pool.levy || 0)); S.gar.levy += n; S.pool.levy -= n; R0.gold -= n * 2; } }
  // war decisions (every 9 days, staggered)
  if ((G.day + r * 3) % 9 === 0 && G.day > 30) {
    const myWars = G.realms.filter((_, t) => t < 5 && t !== r && G.rel[r][t].war).length;
    for (const t of neighbours(r)) {
      if (t >= 5 || t === r || G.rel[r][t].war || G.rel[r][t].truce > G.day || G.rel[r][t].ally || G.rel[r][t].pact > G.day) continue;
      if (myWars >= 1 && R.f() > 0.15) continue;
      const opn = G.rel[r][t].opn, mp = realmPower(r), tp = realmPower(t, r);
      let ch = (opn < -40 ? 0.2 : opn < -15 ? 0.1 : opn < 5 ? 0.03 : 0) * (mp > tp * 1.4 ? 1.6 : mp > tp * 1.1 ? 0.9 : mp > tp * 0.9 ? 0.45 : 0.06) * (1 + agg);
      if (ruler.traits.includes('wrathful') && opn < -30) ch *= 1.5;
      if (t === G.player.realm) ch *= [0.5, 1, 1.4][G.diff] || 1;
      if (G.day < 84 && t === G.player.realm) ch *= 0.4;
      if (R.f() < ch) { declareWar(r, t); break; }
    }
  }
  // peace (every 7 days)
  if ((G.day + r) % 7 === 0) for (let t = 0; t < 5; t++) {
    if (t === r || !G.rel[r][t].war) continue; const rel = G.rel[r][t]; const dur = G.day - rel.since; if (dur < 30) continue;
    const ws = warScore(r, t); // positive = r winning
    if (t === G.player.realm) { if (!G.msgs.some(m => m.kind === 'peace' && m.from === r) && (ws < -30 || (dur > 70 && ws < 10 && R.f() < 0.3))) aiOfferPeace(r, t, ws); }
    else if (ws < -35 || ws > 45 || (dur > 90 && R.f() < 0.25)) makePeace(ws >= 0 ? r : t, ws >= 0 ? t : r, Math.abs(ws) > 35);
  }
  // expansion into free lands (when at peace)
  R0.wantFree = !G.realms.some((_, t) => t < 5 && t !== r && G.rel[r][t].war) && G.day > 20;
}
function warScore(a, b) {
  // occupation + battles. positive -> a winning
  let s = G.rel[a][b].bs || 0;
  WD.provs.forEach((P, p) => { const S = G.setts[P.seat]; const val = WD.setts[P.seat].type === 'capital' ? 30 : 12; if (S.owner === b && S.ctrl === a) s += val; if (S.owner === a && S.ctrl === b) s -= val; });
  return clamp(Math.round(s), -100, 100);
}
// ---------- army behaviour ----------
function threatsNear(a, r) {
  const out = []; for (const b of G.armies) { if (!b.alive || b === a || !hostile(a.realm, b.realm) || b.kind === 'caravan') continue; const d = Math.hypot(b.x - a.x, b.y - a.y); if (b.hidden && d > 2.5) continue; if (d <= r) out.push({ b, d, p: perceivedPower(b, a.realm) }); } return out;
}
function waterTileNear(t) { // follow the fresh-water distance field downhill
  let cur = t; for (let k = 0; k < 60 && WD.fwd[cur] > 2; k++) { const x = cur % MW, y = (cur / MW) | 0; let best = cur; for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const j = ny * MW + nx; if (!TINFO[WD.ter[j]].water && WD.fwd[j] < WD.fwd[best]) best = j; } if (best === cur) break; cur = best; }
  return WD.fwd[cur] <= 2 ? cur : -1;
}
function goTo(a, tile, task) { const p = planPath(a, tile); if (p && p.length > 1) { setPath(a, p); a.ai.task = task; a.ai.goal = tile; return true; } return false; }
function aiArmy(a) {
  if (a.realm === G.player.realm && a.kind === 'lord' && G.court) return cmdArmyTick(a);
  if (!a.ai) a.ai = { task: 'idle', t: 0 };
  if (a.kind === 'bandit') return aiBandit(a); if (a.kind === 'caravan') return aiCaravan(a); if (a.kind !== 'lord') return;
  const men = armyMen(a), my = powerU(a.u, a.xp), gen = charOf(a.gen), agg = (gen ? traitSum(gen, 'agg') : 0) + 0.1 * (G.diff - 1);
  a.ai.t--;
  const th = threatsNear(a, 12);
  // flee from much stronger
  const big = th.filter(x => x.p > my * (1.25 + agg) && x.b.kind !== 'bandit');
  if (big.length && a.mode !== 'siege') { if (a.ai.task !== 'flee') { const s = nearestOwnSett(a, true); if (s >= 0) goTo(a, WD.setts[s].i, 'flee'); } return; }
  // thirst first: walk down to the nearest water
  if (a.water < 1 && a.mode !== 'siege' && !nearWater(armyTile(a))) { if (a.ai.task !== 'water' || !a.path) { const w = waterTileNear(armyTile(a)); if (w >= 0 && goTo(a, w, 'water')) return; } else return; }
  // hunt weaker hostile armies (give up on unreachable or endless chases)
  const skip = a.ai.skip || (a.ai.skip = {});
  const prey = th.filter(x => x.p < my * (1.0 + agg * 0.5) && x.d < 11 * Math.sqrt(SEAT_K) && !(skip[x.b.id] > G.day)).sort((x, y) => x.d - y.d)[0];
  if (prey && a.food > men * 2 && a.morale > 40 && a.water >= 1) {
    if (a.ai.prey !== prey.b.id) { a.ai.prey = prey.b.id; a.ai.h0 = G.day; a.ai.t = 0; }
    if (G.day - a.ai.h0 > 6) { skip[prey.b.id] = G.day + 12; a.ai.prey = -1; }
    else if (!a.path || a.ai.t <= 0) { if (!(a.mode === 'siege' && prey.d > 3)) { if (!goTo(a, armyTile(prey.b), 'hunt') && prey.d > 1.5) { skip[prey.b.id] = G.day + 12; a.ai.prey = -1; } a.ai.t = 1; } }
    if (a.ai.prey >= 0) return;
  }
  if (a.mode === 'siege') return;
  // resupply / rest
  if (men < 70 || a.morale < 32 || a.food < men * 2.5 || a.fat > 85) { if (a.ai.task !== 'rest') { const s = nearestOwnSett(a, true, a.food < men * 2.5); if (s >= 0 && settNear(a.x, a.y, 1.2) !== s) goTo(a, WD.setts[s].i, 'rest'); else { a.ai.task = 'rest'; a.ai.t = 6; } } else if (!a.path && a.ai.t <= 0) a.ai.task = 'idle'; return; }
  // relieve own besieged towns: march on the besieger if we (with the garrison's help) can take him
  if (a.ai.task !== 'relieve' || !a.path) {
    let rel = null, rd = 1e9;
    for (const S of G.setts) { if (!S.siege || S.ctrl !== a.realm) continue; const b = armyById(S.siege.by); if (!b || !b.alive || !hostile(a.realm, b.realm)) continue; const ws = WD.setts[S.id], d = Math.hypot(ws.x - a.x, ws.y - a.y); if (d > 60 * SEAT_K) continue; if (perceivedPower(b, a.realm) > (my + powerU(S.gar) * 0.5) * (1.3 + agg)) continue; if (d < rd) { rd = d; rel = b; } }
    if (rel && a.food > men * 3 && goTo(a, armyTile(rel), 'relieve')) { a.ai.prey = rel.id; a.ai.t = 2; return; }
  }
  if (a.path) return;
  // decoy (doomed spy)
  const R0 = G.realms[a.realm];
  if (R0.decoy && R0.decoy.until > G.day) { const seat = WD.provs[R0.decoy.prov].seat; if (Math.hypot(WD.setts[seat].x - a.x, WD.setts[seat].y - a.y) > 2) { goTo(a, WD.setts[seat].i, 'decoy'); return; } }
  // war targets
  const enemies = []; for (let t = 0; t < 7; t++) if (t !== a.realm && t !== 6 && (G.rel[a.realm][t].war || (t === 5 && R0.wantFree))) enemies.push(t);
  if (enemies.length && a.ai.t <= 0) {
    let best = null, bs = -Infinity; const bd = borderDist(a.realm);
    for (const S of G.setts) {
      if (!enemies.includes(S.ctrl) || S.siege) continue; const ws = WD.setts[S.id]; if (ws.type === 'village') continue;
      const d = Math.hypot(ws.x - a.x, ws.y - a.y); const gp = garSeen(S, a.realm) * (1 + S.walls * 0.6); // the garrison as they see it (dummies on the walls)
      if (gp > my * 1.6) continue;
      let sc = -d * 0.8 - gp / Math.max(1, my) * 30 - bd[ws.i] * 1.5 + (ws.type === 'capital' ? 12 : 0) + (S.owner === a.realm ? 25 : 0) + R.f() * 8;
      if (S.ctrl === 5) sc -= 10;
      if (sc > bs) { bs = sc; best = S; }
    }
    if (best && Math.hypot(WD.setts[best.id].x + 0.5 - a.x, WD.setts[best.id].y + 0.5 - a.y) < 1.5) { a.ai.target = best.id; aiArriveSett(a, best.id); a.ai.t = 3; return; }
    if (best) { const ws = WD.setts[best.id]; const ok = goTo(a, ws.i, 'siege'); if (ok) { a.ai.target = best.id; a.onArrive = { k: 'siege', s: best.id }; a.ai.t = 3; return; } }
    a.ai.t = 3;
  }
  // patrol at peace
  if (a.ai.t <= 0 && R.f() < 0.25) { const own = G.setts.filter(S => S.ctrl === a.realm && WD.setts[S.id].type !== 'village'); if (own.length) { const S = R.pick(own); goTo(a, WD.setts[S.id].i, 'patrol'); a.ai.t = 6; } }
}
function aiArriveSett(a, sid) {
  const S = G.setts[sid]; if (S.siege) return;
  const ws = WD.setts[sid];
  if (ws.type === 'village' || menOf(S.gar) === 0) { const res = autoBattleGarrison(a, S); if (res.win) captureSett(a, S); return; }
  startSiege(a, sid);
  if (S.ctrl === G.player.realm) log(REALM_DEF[a.realm].name + ' ' + rV(a.realm, 'осадила', 'осадило', 'осадили') + ' ' + ws.name + '!', 'bad');
}
function aiSiegeDecision(a, S) {
  const sg = S.siege; if (G.day - sg.asked >= 5) { sg.asked = G.day; if (R.f() < surrenderChance(a, S)) { captureSett(a, S, 'сдались'); return; } }
  if (sg.works >= sg.need && powerU(a.u, a.xp) > powerU(S.gar) * (1.4 + S.walls * 0.25)) {
    const res = autoBattleGarrison(a, S, true);
    if (res.win) captureSett(a, S, 'штурм'); else if (armyMen(a) < 60) endSiege(a);
  }
  if (a.food < armyMen(a) * 1.5) endSiege(a);
}
function aiBandit(a) {
  const L = WD.lairs[a.lair] || { x: Math.floor(a.x), y: Math.floor(a.y) };
  const my = powerU(a.u, a.xp); const th = threatsNear(a, 6).filter(x => x.b.kind !== 'bandit');
  const big = th.filter(x => x.p > my * 1.1);
  if (big.length) { if (a.ai.task !== 'flee') goTo(a, L.y * MW + L.x, 'flee'); return; }
  const prey = th.filter(x => x.p < my * 0.75 && x.d < 4)[0];
  if (prey && (prey.b.kind === 'caravan' || prey.b.kind === 'lord')) { goTo(a, armyTile(prey.b), 'hunt'); return; }
  if (a.path) return;
  if (R.f() < 0.18) {
    const vs = G.setts.filter(S => WD.setts[S.id].type === 'village' && Math.hypot(WD.setts[S.id].x - L.x, WD.setts[S.id].y - L.y) < 16 * SEAT_K && G.day - S.lootDay > 25);
    if (vs.length) { const S = R.pick(vs); goTo(a, WD.setts[S.id].i, 'raid'); a.onArrive = { k: 'loot', s: S.id }; return; }
  }
  if (Math.hypot(a.x - L.x - 0.5, a.y - L.y - 0.5) > 3 && R.f() < 0.3) goTo(a, L.y * MW + L.x, 'home');
}
function banditLoot(a, S) {
  if (powerU(S.gar) > powerU(a.u, a.xp) * 0.8) return;
  S.lootDay = G.day; S.prosp = Math.max(10, S.prosp - 12); const p = WD.setts[S.id].prov; G.provs[p].dev = Math.min(0.9, G.provs[p].dev + 0.12); G.provs[p].unrest = Math.min(100, G.provs[p].unrest + 15);
  a.food += 300; a.loot = (a.loot || 0) + 30; takeU(S.gar, Math.ceil(menOf(S.gar) * 0.5));
  if (S.ctrl === G.player.realm) log('Разбойники разорили деревню ' + WD.setts[S.id].name + '.', 'bad');
}
// AI-vs-AI contact
function aiContacts() {
  const L = G.armies.filter(a => a.alive && a.kind !== 'player');
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; if (!a.alive || !b.alive || !hostile(a.realm, b.realm)) continue;
    if (Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1) continue;
    if (a.kind === 'caravan' && b.kind === 'caravan') continue;
    if (G.day - Math.max(a.lastFight, b.lastFight) < 2) continue;
    const res = autoBattle(a, b); a.lastFight = b.lastFight = G.day;
    if (G.court && (a.realm === 0 || b.realm === 0)) { try { cmdBattle(a, b, res); } catch (e) { console.error(e); } }
    if (a.realm === G.player.realm || b.realm === G.player.realm || G.vis[armyTile(a)] === 2) log('Битва: ' + armyLabel(a) + ' и ' + armyLabel(b) + ' — победа: ' + armyLabel(res.winA ? a : b) + '.', 'info');
  }
}
function armyLabel(a) { const g = charOf(a.gen); if (a.kind === 'bandit') return 'шайка ' + (g ? g.name : ''); if (a.kind === 'caravan') return 'караван'; if (a.kind === 'player') return 'войско короля'; return (g ? g.name : 'войско') + ' (' + REALM_DEF[a.realm].name + ')'; }
