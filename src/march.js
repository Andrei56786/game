// ===== MARCH (v3.5): the road is its own enemy — mud in the thaw and the autumn rains, frost and frostbite in winter, rivers to ford,
// and levies who owe forty days in the field and then want to go home =====
Object.assign(ICONS, { frost: '..l..|l.l.l|.lll.|l.l.l|..l..', mud: '.....|.....|.N.N.|NnNnN|nnnnn' });
const SVC_DAYS = 40; // a levy owes forty days in the field (sixty, once the crown pays wages)
const svcDays = () => SVC_DAYS + (typeof hasTech === 'function' && hasTech('standing') ? 20 : 0);
const MUDT = { [TR.GRASS]: 1, [TR.FARM]: 1.2, [TR.MARSH]: 1.3, [TR.STEPPE]: 0.8, [TR.FOREST]: 0.7, [TR.DFOREST]: 0.7, [TR.HILLS]: 0.5, [TR.MOUNT]: 0.3, [TR.PEAK]: 0, [TR.BEACH]: 0.4, [TR.SNOW]: 0.5 };
// ---------- mud: rain soaks the ground, the thaw turns it to porridge; sun, wind and hard frost dry or freeze it ----------
DAILY_EXT.push(() => { const s = seasonOf(G.day), k = G.weather.k, din = dayOfYear(G.day) % DAYS_SEASON; let m = G.mud || 0;
  if (s === 3) m -= k === 'snow' || k === 'blizzard' ? 0.3 : 0.08; // the ground freezes hard
  else { m += { rain: 0.22, storm: 0.38, snow: 0.08, fog: -0.04, cloud: -0.07, clear: -0.16, wind: -0.28, heat: -0.34 }[k] || 0; if (s === 0 && din < 7) m += 0.2; } // the spring thaw
  G.mud = clamp(m, 0, 1);
  if (G.mud >= 0.5 && !G.mudOn) { G.mudOn = 1; log(s === 0 && din < 8 ? 'Распутица: снег сошёл, дороги раскисли — обозы вязнут по ступицу.' : 'Распутица: дожди размыли дороги — вне трактов войска вязнут в грязи.', 'info'); }
  else if (G.mud < 0.25 && G.mudOn) { G.mudOn = 0; log('Земля подсохла: дороги снова проезжи.', 'info'); } });
{ const sc = stepCost; stepCost = function (a, j) { const c = sc(a, j); const m = G.mud || 0; if (!(c < Infinity) || m < 0.05) return c;
  if (WD.road[j]) return c * (1 + 0.12 * m); const men = Math.max(1, armyMen(a)), wf = a.wagons ? Math.min(0.5, a.wagons / (men / 100 + 1) * 0.15) : 0;
  return c * (1 + (0.55 + wf) * m * (MUDT[WD.ter[j]] === undefined ? 1 : MUDT[WD.ter[j]])); }; }
// ---------- frost: winter in the open, the mountains, the tundra ----------
function coldRisk(a, moved) { const s = seasonOf(G.day), k = G.weather.k, T = WD.ter[armyTile(a)], high = T === TR.MOUNT || T === TR.PEAK || T === TR.SNOW;
  if (s !== 3 && !(high && (T === TR.PEAK || T === TR.SNOW))) return 0; const sid = settNear(a.x, a.y, 1.2); if (sid >= 0 && G.setts[sid].ctrl === a.realm) return 0; // quartered under a roof
  let r = s === 3 ? (k === 'blizzard' ? 0.011 : k === 'snow' ? 0.0045 : 0.0016) : 0.0012; if (high) r *= 1.6;
  if (a.mode === 'fort' && a.fortDays >= 2) r *= 0.5; else if (!moved) r *= 0.75; // dug-in huts and fires; the camp at least has fires
  const men = Math.max(1, armyMen(a)); r *= 1 - 0.45 * Math.min(1, (a.wagons || 0) * 150 / men); if (a.hunger) r *= 1.6; return r; } // tents and firewood ride in the wagons
// ---------- rivers: a ford is wet, a swim is deadly; in the spring flood and after rain — worse; in winter — across the ice ----------
function riverCross(a, j) { const s = seasonOf(G.day), k = G.weather.k, ford = !!WD.ford[j], big = WD.river[j] || 1, isP = a.realm === G.player.realm && a.kind === 'player', men = armyMen(a);
  if (s === 3 && dayOfYear(G.day) % DAYS_SEASON > 4) { if (R.chance(0.04 * big)) { const n = takeMen(a, Math.max(1, Math.round(men * 0.004 * R.range(0.5, 1.5)))); if (isP && n) log('Лёд проломился на переправе: ' + n + ' ' + plural(n, 'воин ушёл', 'воина ушли', 'воинов ушли') + ' под воду.', 'bad'); } return; }
  const risk = (ford ? 0.25 : 0.6 + 0.3 * (big - 1)) * (s === 0 ? 1.6 : 1) * (1 + (G.mud || 0) * 0.8) * (k === 'rain' || k === 'storm' ? 1.3 : 1);
  const drown = Math.round(men * 0.004 * risk * R.range(0.2, 1.6)), food = Math.round((a.food || 0) * 0.022 * risk), arr = Math.round((a.arrows || 0) * 0.04 * risk), hr = Math.round((a.horses || 0) * 0.02 * risk);
  const n = drown >= 1 ? takeMen(a, drown) : 0; a.food = Math.max(0, (a.food || 0) - food); a.arrows = Math.max(0, (a.arrows || 0) - arr); a.horses = Math.max(0, (a.horses || 0) - hr);
  if (!isP || !(n || food >= 20 || arr >= 20)) return; const P = []; if (n) P.push('утонули ' + n); if (food >= 20) P.push('подмочен провиант −' + food); if (arr >= 20) P.push('стрелы −' + arr); if (hr) P.push('кони −' + hr);
  log((ford ? 'Переправа вброд' : 'Переправа вплавь') + (s === 0 ? ' в половодье' : '') + ': ' + P.join(', ') + '.', n ? 'bad' : 'info'); }
{ const aa = advanceArmy; advanceArmy = function (a, dd) { const p0 = a.pi, path = a.path; aa(a, dd); if (!path || !a.alive || a.pi <= p0) return;
  for (let q = p0 + 1; q <= Math.min(a.pi, path.length - 1); q++) { const j = path[q], pj = path[q - 1]; if (WD.river[j] && !WD.bridge[j] && !(WD.river[pj] && !WD.bridge[pj])) riverCross(a, j); } }; }
// ---------- the day's hardships; and the levy's forty days ----------
{ const da = dailyArmy; dailyArmy = function (a) { const moved = (a.moved || 0) > 0.3; da(a); if (!a.alive || a.kind === 'caravan' || a.kind === 'bandit') return; const isP = a.realm === G.player.realm && a.kind === 'player';
  const cr = coldRisk(a, moved); if (cr > 0) { const men = armyMen(a), n = Math.round(men * cr * R.range(0.6, 1.4)); if (n >= 1) { const k = takeMen(a, n), sick = Math.round(k * 0.7); a.sick += sick; a.deaths = (a.deaths || 0) + (k - sick); a.fat = clamp(a.fat + 3, 0, 100);
      if (isP) { a.frostAcc = (a.frostAcc || 0) + k; if (a.frostAcc >= 8 || !a.frostLog || G.day - a.frostLog >= 5) { log('Мороз: обморожения — ' + a.frostAcc + ' ' + plural(a.frostAcc, 'воин слёг', 'воина слегли', 'воинов слегли') + (a.wagons ? '' : ' (палатки и дрова везут в обозе)') + '.', 'bad'); a.frostAcc = 0; a.frostLog = G.day; } } } }
  if (!isP) return; const p = WD.prov[armyTile(a)], home = p >= 0 && ownerOfProv(p) === a.realm;
  a.svc = home ? Math.max(0, (a.svc || 0) - 3) : (a.svc || 0) + 1; if (home && a.svc === 0) a.svcPaid = 0; const lim = svcDays() + (a.svcPaid || 0), lv = a.u.levy || 0; if (lv <= 0) return;
  if (a.svc === lim - 5) svcAsk(a);
  if (a.svc > lim) { const k = Math.min(lv, Math.max(1, Math.round(lv * Math.min(0.15, 0.025 + 0.01 * (a.svc - lim)) * R.range(0.7, 1.3)))); a.u.levy -= k; log('Ополченцы уходят по домам: ' + k + '. Сорок дней службы вышли' + (a.svcPaid ? ' — и оплаченные тоже' : '') + '.', 'bad'); } }; }
function svcAsk(a) { const lv = a.u.levy || 0, cost = Math.max(10, Math.round(lv * (hasTech('standing') ? 0.25 : 0.5))), R0 = G.realms[G.player.realm];
  const e = { id: 'svc', title: 'Ополчение ропщет', ic: 'flag', opts: [
    { t: 'Заплатить: ещё 20 дней (−' + cost + ' зол.)', tip: 'По пол-золотого на ополченца.', ok: () => R0.gold >= cost, fx: () => { R0.gold -= cost; a.svcPaid = (a.svcPaid || 0) + 20; log('Ополчению заплачено: служат ещё 20 дней.', 'info'); } },
    { t: 'Отпустить по домам сейчас', tip: 'Уйдут с честью: смута не вырастет.', fx: () => { const n = a.u.levy; a.u.levy = 0; log('Ополчение распущено по домам: ' + n + '.', 'info'); } },
    { t: 'Пусть ропщут', tip: 'Через 5 дней начнут уходить сами.', fx: () => {} }] };
  UI.alert('event', { e, text: (svcDays() > SVC_DAYS ? 'Шестьдесят' : 'Сорок') + ' дней службы на исходе: через 5 дней ополченцы (' + lv + ') пойдут по домам — пахать и сеять. Профессиональные воины остаются.' }); }
// ---------- in the army window: what the road is doing to us ----------
function marchHardLines(a, x, y) { const L = [], m = G.mud || 0, cr = coldRisk(a, (a.moved || 0) > 0.3);
  if (m >= 0.3) L.push(['i_mud', 'Распутица: вне дорог медленнее на ' + Math.round(55 * m) + '%', UIC.warn]);
  if (cr > 0) L.push(['i_frost', 'Мороз: обморожения ≈' + Math.max(1, Math.round(armyMen(a) * cr)) + ' в день', UIC.bad]);
  if ((a.u.levy || 0) > 0 && a.kind === 'player' && (a.svc || 0) > 0) { const lim = svcDays() + (a.svcPaid || 0); L.push(['i_flag', 'Ополчение в походе ' + a.svc + ' из ' + lim + ' дн.', a.svc > lim - 6 ? UIC.bad : '#c8b898']); }
  for (const [ic, t, c] of L) { spr(ic, x, y + 1); txt(t, x + 11, y, c, { f: 's' }); y += 10; } return y + (L.length ? 2 : 0); }
