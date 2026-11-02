'use strict';
// ===== v3.4 supply: the quartermaster keeps the baggage train full for the length of the campaign; servants run the king's errands =====
// saved: G.court.sup = { on, days, route, wag, res, dest, last, lastDay, sid, sidDay, warnD }
//        G.court.errand = { by: npc key, k: 'prep'|'call', days, dest, st: 'go'|'prep'|'back'|'wait'|'come', t0, ts, t1, rep }
SERVANTS.push(['quart', 'quart', 0, 47, 'Снабженец Готфрид', 'barracks2'], ['runner', 'runner', 0, 15, 'Посыльный Мирко', 'stairs'], ['runner2', 'runner', 1, 17, 'Посыльная Ода', 'stairs']);
Object.assign(SCHED, {
  quart: [[5, 'barracks2'], [6.5, 'quart'], [9, 'quart_cart'], [10.5, 'quart'], [12, 'kitchen'], [13, 'quart'], [16, 'quart_cart'], [17.5, 'quart'], [19.5, 'barracks2']],
  runner: [[5, 'stairs'], [6.5, 'hall_door'], [8, 'council_wait'], [10, 'plaza_w'], [12, 'kitchen'], [13, 'hall_sw'], [16, 'gate_in'], [18, 'plaza_e'], [20.5, 'stairs']],
  runner2: [[5, 'stairs'], [7, 'kitchen'], [8.5, 'plaza_e'], [11, 'hall_se'], [13.5, 'well'], [15, 'council_wait'], [17.5, 'plaza_w'], [21, 'stairs']],
});
Object.assign(LOOK_EXT, {
  quart: () => ({ o: 'doublet', cl: 'brown', bg: 'brown', hat: 'cap', keys: 1 }),
  runner: (r, fem) => ({ o: fem ? 'dress' : 'tunic', cl: 'blue', bg: 'navy', hat: fem ? 'kerchief' : 'cap' }),
});
Object.assign(STAFF_LINES, {
  quart: ['Сухари считают мешками, а воду — бочками, государь.', 'Голодное войско — наполовину разбитое.', 'Повозок много не бывает. Разве что на узкой дороге.'],
  runner: ['Куда бежать, государь?', 'По двору я быстрее любого гонца!', 'Ноги у меня лёгкие, государь!'],
});
BUILD_EXT.push(() => { const Y = LOCS.yard; if (!Y) return; spot(Y, 'quart', 9, 34, 'up'); spot(Y, 'quart_talk', 11, 34, 'left'); spot(Y, 'quart_cart', 9, 30, 'up'); spot(Y, 'quart_cart2', 11, 30, 'left'); });
const SUP_DAYS = [7, 14, 21, 30], SUP_RES = [0, 50, 100, 200, 400], ERRAND_STAFF = ['page', 'maid', 'runner', 'runner2', 'cook', 'stable', 'gardener', 'smith'];
const VR = mkRng(0x5eed42);                       // cosmetic chatter only: keeps the gameplay rng untouched
const dn = d => d + ' ' + plural(d, 'день', 'дня', 'дней'), gv = (n, m, f) => (n && n.c && n.c.fem ? f : m);
function supS() { const H = G.court || G, o = H.sup || (H.sup = {});
  if (o.days === undefined) Object.assign(o, { on: 1, days: 14, route: 1, wag: 1, res: 100, dest: -1, last: '', lastDay: -9, sid: -1, sidDay: -9, warnD: -9 }); return o; }
// ---------- the sums ----------
const supMen = a => armyMen(a) + (a.wounded || 0) + (a.sick || 0);
const supHorses = a => mountedN(a.u) + (a.horses || 0) + (a.wagons || 0) * 2;
const supGraze = () => [0.55, 0.7, 0.4, 0][seasonOf(G.day)] * 0.8;       // what the grass gives on an average road, a little cautious
const supWagMax = a => Math.max(2, Math.floor(4 * (armyMen(a) / 100 + 1)));  // beyond that the train slows the march by a quarter
function supDaysOf(a) { const m = Math.max(1, supMen(a)), h = supHorses(a), r = rangedN(a.u);
  return { food: a.food / m, fodder: h ? a.fodder / Math.max(0.05, h * (1 - supGraze())) : 99, water: a.water, arrows: r ? a.arrows / r : -1 }; }
function supWant(a, D) { const r = rangedN(a.u);
  return { food: Math.max(0, Math.ceil(supMen(a) * D - a.food)), fodder: Math.max(0, Math.ceil(supHorses(a) * D * (1 - supGraze()) - a.fodder)), arrows: r ? Math.max(0, r * 30 - a.arrows) : 0 }; }
function supBuy(S, sid, k, want, budget) { let n = Math.floor(Math.min(want, S.mk[k] || 0)); if (n <= 0 || budget <= 0) return { n: 0, cost: 0 };
  const K = PRICE_K(sid); let cost = buyCost(S, k, n) * K;
  for (let i = 0; i < 14 && n > 0 && cost > budget; i++) { n = Math.floor(n * clamp(budget / cost * 0.98, 0.3, 0.98)); cost = buyCost(S, k, n) * K; }
  if (n <= 0) return { n: 0, cost: 0 }; mkTake(S, k, n); if (S.ctrl !== G.player.realm) dutyTo(S.ctrl, cost * 0.05); return { n, cost }; }
// what filling a force up to D days would take: wagons to buy, grain from the crown granary, gold for the market
const SUP_N = { food: 'еды', fodder: 'фуража', arrows: 'стрел', wagons: 'повозок' };
function supCost(a, D, S, sid, grain) { const o = supS(), w = supWant(a, D), room = Math.max(0, armyCap(a) - armyLoad(a)), extra = w.food + w.fodder + w.arrows / 10;
  const k = o.wag && extra > room ? clamp(Math.ceil((extra - room) / WAGON_CAP), 0, Math.max(0, Math.min(supWagMax(a) - (a.wagons || 0), S ? Math.floor(S.mk.wagons || 0) : 0))) : 0;
  const fod = w.fodder + Math.ceil(k * 2 * D * (1 - supGraze())), g = Math.min(w.food, grain), K = S ? PRICE_K(sid) : 1;
  return { k, g, cost: S ? (buyCost(S, 'wagons', k) + buyCost(S, 'food', w.food - g) + buyCost(S, 'fodder', fod) + buyCost(S, 'arrows', w.arrows)) * K : 0 }; }
// fill one force up to D days: the crown granary first (keeps 400 for a siege), then the market; wagons when the load will not fit.
// When the gold will not stretch to D days, the quartermaster plans for fewer days rather than buying wagons he cannot fill.
function supFill(a, D, src) { const o = supS(), r = G.realms[G.player.realm], S = src.S, C = G.court, lack = {};
  let budget = Math.max(0, r.gold - o.res), spent = 0; const got = { food: 0, grain: 0, fodder: 0, arrows: 0, wagons: 0 }, D0 = D;
  const grain = src.grain && C ? Math.max(0, Math.floor((C.grain || 0) - 400)) : 0;
  if (S && supCost(a, D, S, src.sid, grain).cost > budget) { let lo = Math.min(D, Math.max(0, Math.floor(supDaysOf(a).food))), hi = D;
    if (lo < hi) { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (supCost(a, m, S, src.sid, grain).cost <= budget) lo = m; else hi = m; } if (lo >= 1 && lo < D0) { D = lo; lack.gold = 'на ' + dn(D0) + ' золота не хватило — взял на ' + dn(D); } } }
  const room = () => Math.max(0, Math.floor(armyCap(a) - armyLoad(a)));
  const buy = (k, n) => { if (n <= 0) return 0; if (!S) { lack.mk = 'рынка нет'; return 0; } const q = supBuy(S, src.sid, k, n, budget); budget -= q.cost; spent += q.cost; r.gold -= q.cost; got[k] += q.n;
    if (q.n < n) { if ((S.mk[k] || 0) < 1) lack['e' + k] = 'на рынке нет ' + SUP_N[k]; else if (!lack.gold) lack.gold = 'не хватило золота'; } return q.n; };
  let w = supWant(a, D); const need = w.food + w.fodder + w.arrows / 10;
  if (need > room()) { const k = Math.min(Math.ceil((need - room()) / WAGON_CAP), supWagMax(a) - (a.wagons || 0));
    if (!o.wag) lack.room = 'обоз полон (покупка повозок выключена)'; else if (k <= 0) lack.room = 'обоз полон: больше повозок замедлят марш';
    else { const n = buy('wagons', k); a.wagons = (a.wagons || 0) + n; if (n < k && !lack.gold && !lack.ewagons) lack.room = 'обоз полон'; }
    w = supWant(a, D); }
  let f = Math.min(w.food, room()); if (f < w.food && !lack.room) lack.room = 'обоз полон';
  if (grain && f > 0) { const g = Math.min(f, grain); if (g > 0) { C.grain -= g; a.food += g; got.grain = g; f -= g; } }
  if (f > 0) a.food += buy('food', f);
  const fd = Math.min(w.fodder, room()); if (fd > 0) a.fodder += buy('fodder', fd);
  const ar = Math.min(w.arrows, room() * 10); if (ar > 0) a.arrows += buy('arrows', ar);
  a.water = waterCap(a); return { got, spent, lack }; }
function supLine(a, q) { const d = supDaysOf(a), r = rangedN(a.u);
  let s = 'еда на ' + dn(Math.floor(d.food)) + (supHorses(a) ? ', фураж на ' + dn(Math.min(99, Math.floor(d.fodder))) : '') + (r ? ', стрел ' + fmt(a.arrows) : '') + ', бочки полны, повозок ' + (a.wagons || 0) + (q && q.got.wagons ? ' (+' + q.got.wagons + ')' : '');
  const L = q ? [...new Set(Object.values(q.lack))] : []; return s + (L.length ? ' — ' + L.join('; ') : '') + '.'; }
function supBought(q) { const g = q.got, p = []; if (g.grain) p.push(g.grain + ' мер из амбара'); if (g.food) p.push('еды ' + fmt(g.food)); if (g.fodder) p.push('фуража ' + fmt(g.fodder)); if (g.arrows) p.push('стрел ' + fmt(g.arrows)); if (g.wagons) p.push(g.wagons + ' ' + plural(g.wagons, 'повозку', 'повозки', 'повозок')); return p.join(', '); }
// the forces the quartermaster looks after: the king's army in the field, or (at court) the army at the capital and the king's retinue
function supForces() { const pa = playerArmy(); if (pa) return [{ a: pa, n: 'Войско короля' }]; const C = G.court, out = [];
  if (C) out.push({ a: C.retinue || null, n: 'Свита короля', ret: 1 }); // the king always rides with it: supplied first
  const ca = typeof capitalArmy === 'function' ? capitalArmy() : null; if (ca) { const kn = charOf(ca.gen); out.push({ a: ca, n: 'Войско у столицы', who: kn ? kn.name : '' }); }
  return out; }
function supPrepare(D, frac) { const C = G.court, cap = G.realms[G.player.realm].capital, S = G.setts[cap], o = supS(); frac = frac === undefined ? 1 : clamp(frac, 0, 1);
  if (C && !C.retinue) C.retinue = mkRetinue(); const Dk = Math.max(1, Math.round(D * frac)); const parts = []; let spent = 0;
  let low = 99; for (const f of supForces()) { if (!f.a) continue; const q = supFill(f.a, Dk, { S, sid: cap, grain: 1 }); spent += q.spent; low = Math.min(low, Math.floor(supDaysOf(f.a).food + 0.01)); const b = supBought(q); parts.push(f.n + ': ' + supLine(f.a, q) + (b ? ' Взято: ' + b + '.' : '')); }
  const head = (frac < 1 ? 'Собрал, что успел, — обоз на ' + dn(Dk) + ' из ' + D + '.' : low < D ? 'Обоз собран, но не на все ' + dn(D) + ': еды хватит на ' + dn(low) + '.' : 'Обоз в поход на ' + dn(D) + ' собран.') + (spent >= 1 ? ' Из казны — ' + Math.round(spent) + ' зол.' : ' Казну не тронул.');
  const pages = [head].concat(parts), t = pages.join(' '); o.last = t; o.lastDay = G.day; o.pages = pages; return t; }
// how long the road is: by the army's path (+ a week under the walls of a hostile town), else the ordered number of days
function supTarget(a) { const o = supS();
  if (o.route && a.path && a.pi < a.path.length - 1) { const md = pathDays(a, a.path, a.pi); if (isFinite(md)) { const e = a.path[a.path.length - 1], sid = settNear(e % MW + 0.5, ((e / MW) | 0) + 0.5, 1.2), foe = sid >= 0 && hostile(G.player.realm, G.setts[sid].ctrl);
    return clamp(Math.ceil(md * 1.3) + 3 + (foe ? 7 : 0), 5, 40); } }
  return o.days; }
// in the field: top up in every friendly or neutral town on the way (once per visit, again every 3 days while staying)
function supTopUp(a, sid, manual) { const S = G.setts[sid], ws = WD.setts[sid], o = supS();
  if (!S || hostile(G.player.realm, S.ctrl)) return manual ? 'Здесь с нами не торгуют — это вражеский город.' : '';
  if (S.siege) return manual ? 'Город в осаде — рынок закрыт.' : '';
  const D = supTarget(a), w = supWant(a, D);
  if (!manual && w.food < supMen(a) * Math.max(1, D * 0.15) && w.fodder < supHorses(a) * Math.max(1, D * 0.2) && w.arrows < rangedN(a.u) * 8) return '';
  const q = supFill(a, D, { S, sid }); const b = supBought(q);
  if (!b) { const t = 'Снабженец: на рынке «' + ws.name + '» докупить не вышло — ' + ([...new Set(Object.values(q.lack))].join('; ') || 'обоз и так полон') + '.'; if (manual) { o.last = t; log(t, 'info'); } return manual ? t : ''; }
  const t = 'Снабженец, рынок «' + ws.name + '» (обоз на ' + dn(D) + '): куплено ' + b + ' за ' + Math.round(q.spent) + ' зол. Теперь ' + supLine(a, q);
  o.last = t; o.lastDay = G.day; log(t, 'good'); if (typeof Snd !== 'undefined') Snd.sfx('coin'); return t; }
function supTick() { if (!G || G.over) return; errandClock(); const o = supS(), pa = playerArmy(); if (!pa || !o.on) return;
  const sid = settNear(pa.x, pa.y, 1.2); if (sid < 0) { o.sid = -1; return; } if (sid === o.sid && G.day - o.sidDay < 3) return; o.sid = sid; o.sidDay = G.day; supTopUp(pa, sid, false); }
{ const wa = worldAdvance; worldAdvance = function (dd) { wa(dd); try { supTick(); } catch (e) { onErr(e); } }; }
// ---------- warnings on the march: what runs out, where the nearest water and market are ----------
const DIR8 = ['востоку', 'юго-востоку', 'югу', 'юго-западу', 'западу', 'северо-западу', 'северу', 'северо-востоку'];
function kmDir(a, x, y) { const dx = x - a.x, dy = y - a.y, km = Math.max(1, Math.round(Math.hypot(dx, dy) * KM_PER_TILE)); return 'в ' + km + ' км к ' + DIR8[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8]; }
function supMarketNear(a) { let best = null, bd = 1e9; for (const ws of WD.setts) { const S = G.setts[ws.id]; if (!S || hostile(G.player.realm, S.ctrl) || S.siege || (S.mk.food || 0) < 50) continue; const d = Math.hypot(ws.x + 0.5 - a.x, ws.y + 0.5 - a.y); if (d < bd) { bd = d; best = ws; } } return best; }
function supWaterTile(a) { const t = armyTile(a); return WD.fwd[t] <= 2 ? -1 : waterTileNear(t); }
function supWarn() { const pa = playerArmy(); if (!pa) return; const o = supS(); if (G.day - o.warnD < 2) return;
  const d = supDaysOf(pa), wd = waterDay(pa), wl = wd.full || wd.d >= 0 ? 99 : pa.water / -wd.d, bad = [];
  if (d.food < 3) bad.push('еды на ' + dn(Math.max(0, Math.floor(d.food)))); if (wl < 2) bad.push('воды на ' + dn(Math.max(0, Math.floor(wl)))); if (supHorses(pa) && d.fodder < 2) bad.push('фуража на ' + dn(Math.max(0, Math.floor(d.fodder))));
  if (!bad.length) return; o.warnD = G.day; let s = 'Снабженец: ' + bad.join(', ') + '.';
  if (wl < 2) { const wt = supWaterTile(pa); if (wt >= 0) s += ' Ближайшая вода — ' + kmDir(pa, wt % MW + 0.5, ((wt / MW) | 0) + 0.5) + ' (O → «Вести к воде»).'; }
  if (d.food < 3 || (supHorses(pa) && d.fodder < 2)) { const m = supMarketNear(pa); if (m) s += ' Ближайший рынок — ' + m.name + ', ' + kmDir(pa, m.x + 0.5, m.y + 0.5) + '.'; }
  log(s, 'bad'); }
DAILY_EXT.push(supWarn);
// ---------- where the campaign goes: the quartermaster's own reckoning of the road ----------
let SUP_DC = null;
function supDests() { const pa = playerArmy(), me = G.player.realm, cw = WD.setts[G.realms[me].capital], cap = pa ? { x: Math.floor(pa.x), y: Math.floor(pa.y) } : cw, key = G.day + ':' + cap.x + ',' + cap.y; if (SUP_DC && SUP_DC.key === key) return SUP_DC.l;
  const spd = Math.max(1, armySpeed(pa || capitalArmy() || G.court.retinue || { u: { sword: 8, knight: 4, horse: 4, archer: 6 }, wagons: 1, fat: 0, realm: me, x: cw.x, y: cw.y }));
  const c = [], near = {}; for (const ws of WD.setts) { const S = G.setts[ws.id]; if (!S || S.ctrl === me || !REALM_DEF[S.ctrl] || S.ctrl >= G.realms.length || ws.type === 'village') continue; const foe = hostile(me, S.ctrl), d = Math.hypot(ws.x - cap.x, ws.y - cap.y), e = { sid: ws.id, n: ws.name, r: S.ctrl, foe, d };
    if (foe) c.push(e); else if (!near[S.ctrl] || d < near[S.ctrl].d) near[S.ctrl] = e; }
  c.sort((p, q) => p.d - q.d); const l = c.slice(0, 3).concat(Object.values(near).sort((p, q) => p.d - q.d)).slice(0, 5).map(e => { const march = Math.max(1, Math.round(e.d * 1.3 / spd)); return Object.assign(e, { march, D: clamp(e.foe ? Math.ceil(march * 1.5) + 7 : march + 3, 5, 40) }); });
  SUP_DC = { key, l }; return l; }
// ---------- the dialog: how many days ----------
function campaignAsk(who, cb) { const L = supDests();
  DLG.say(who, 'На сколько дней снаряжать обоз, государь? Можно сказать и куда идём — тогда посчитаю дорогу сам.', { choices: [
    { t: 'На неделю (7 дней)', fx: () => cb(7) }, { t: 'На две недели (14 дней)', fx: () => cb(14) }, { t: 'На три недели (21 день)', fx: () => cb(21) }, { t: 'На месяц (30 дней)', fx: () => cb(30) },
    { t: 'Скажу, куда идём…', ok: () => L.length > 0, why: 'Ни войны, ни чужих столиц поблизости — назовите число дней.', fx: () => DLG.say(who, 'Куда поведёте войско, государь?', { choices: L.map(e => ({ t: e.n + ' (' + realmName(e.r) + (e.foe ? ', война' : '') + ') — ≈' + dn(e.march) + ' пути → обоз на ' + dn(e.D), tip: e.foe ? 'Дорога туда, неделя под стенами и запас на обратный путь по чужой земле.' : 'Дорога и три дня запаса.', fx: () => cb(e.D, e.sid) })).concat([{ t: 'Отмена', fx: () => { } }]), esc: L.length }) },
    { t: 'Отмена', fx: () => { } }], esc: 5 }); }
// ---------- errands: any servant carries the king's word to the quartermaster and comes back with the answer ----------
const errNow = () => G.day + G.frac;
function errandPrepH(D) { const ca = capitalArmy(), men = (ca ? armyMen(ca) : 0) + 22; return 1 + D / 10 + men / 400; }
const errProg = E => E && E.st === 'prep' ? clamp((errNow() - E.ts) / Math.max(1e-6, E.t1 - E.ts), 0, 1) : E && (E.st === 'back' || E.st === 'wait') ? 1 : 0;
function errRun(n) { n.errand = 1; if (!n.spd0) n.spd0 = n.spd; n.spd = Math.max(n.spd0, 70); n.sit = null; n.lie = 0; n.wander = null; n.hold = 0; }
function errStop(n) { n.errand = 0; if (n.spd0) { n.spd = n.spd0; n.spd0 = 0; } n.curT = null; n.path = null; n.goal = null; n.state = 'idle'; n.repT = 0; }
function errandEnd() { const C = G.court, E = C && C.errand; if (!C) return; C.errand = null; if (!E) return; for (const k of [E.by, 'srv_quart']) { const m = npcByKey(k); if (m && m.errand) errStop(m); } }
function errandStart(n, k, D, dest) { const C = G.court; if (!C || G.visit) return; const o = supS(); if (k === 'prep') { o.days = D; o.dest = dest >= 0 ? dest : -1; }
  C.errand = { by: n.key, k, days: D || 0, dest: dest >= 0 ? dest : -1, st: 'go', t0: errNow(), rt: 0 }; errRun(n);
  say(n, k === 'call' ? VR.pick(['Сейчас позову, государь!', 'Мигом приведу!']) : VR.pick(['Бегу к снабженцу, государь!', 'Мигом передам, государь!', 'Слушаюсь! Обоз на ' + dn(D) + '!']), 3.5);
  npcGoTo(n, 'quart_talk', m => errandAt(m)); UI.toast(n.c.name + ' ' + gv(n, 'побежал', 'побежала') + ' к снабженцу' + (k === 'call' ? '.' : ' с приказом.')); }
function errandAt(n) { const C = G.court, E = C && C.errand; if (!E || E.by !== n.key || E.st !== 'go') return; const q = npcByKey('srv_quart');
  if (E.k === 'call') { say(n, 'Готфрид! Государь зовёт!', 3); errStop(n); E.by = 'srv_quart'; E.st = 'come'; E.rt = 0; if (q) { errRun(q); q.spd = Math.max(q.spd0 || 46, 56); say(q, 'Иду, иду!', 3); } return; }
  say(n, 'Приказ государя: обоз на ' + dn(E.days) + '!', 3.5); quartBegin(E, 0); log(n.c.name + ' ' + gv(n, 'передал', 'передала') + ' приказ: снабженец Готфрид собирает обоз на ' + dn(E.days) + ' (≈' + Math.ceil(errandPrepH(E.days)) + ' ч).', 'info'); }
function quartBegin(E, delayH) { const q = npcByKey('srv_quart'); E.st = 'prep'; E.ts = errNow() + (delayH || 0) / 24; E.t1 = E.ts + errandPrepH(E.days) / 24; E.rt = 0;
  if (q) { errRun(q); q.spd = q.spd0 || 46; q.prepT = 1.5; say(q, VR.pick(['Будет сделано! К ' + clockStr(5 + (E.t1 % 1) * 24) + ' управимся.', 'Обоз на ' + dn(E.days) + '? Сделаем, государь!', 'Эй, мешки на телегу! Государь выступает!']), 4); } }
function quartOrder(q, D, dest) { const C = G.court, o = supS(); o.days = D; o.dest = dest >= 0 ? dest : -1; C.errand = { by: q ? q.key : 'srv_quart', k: 'prep', days: D, dest: o.dest, t0: errNow() }; quartBegin(C.errand, q ? 0 : 0.5); }
function errandClock() { const C = G.court, E = C && C.errand; if (!E || E.st !== 'prep' || errNow() < E.t1) return;
  const rep = supPrepare(E.days); E.rep = rep; E.st = 'back'; E.rt = 0; log('Снабженец Готфрид: ' + rep, 'good');
  const q = npcByKey('srv_quart'); if (q && E.by !== q.key) { say(q, 'Готово! Беги к государю!', 3.5); errStop(q); } }
function errFollow(n) { const P = COURT.p, L = LOCS[COURT.loc]; if (!L || !P) return; const [tx, ty] = nearFree(L, Math.floor(P.x / CT), Math.floor(P.y / CT) + 1); npcGoToSp(n, { loc: COURT.loc, x: tx * CT + 8, y: ty * CT + 12, dir: 'up' }); }
const LOAD_LINES = ['Мешок — на телегу!', 'Бочки полны?', 'Сухари считай!', 'Осторожней с дёгтем!', 'Ещё сено!', 'Пересчитай стрелы!'];
UPD_EXT.push(dt => { if (G.visit || !G.court) return; const C = G.court, E = C.errand; if (!E) return; const n = npcByKey(E.by), P = COURT.p; E.rt = (E.rt || 0) + dt;
  if (!n) { if (E.st !== 'prep') C.errand = null; return; }
  if (E.st === 'go') { if (!n.errand) errRun(n); if (!n.path && !n.goal) npcGoTo(n, 'quart_talk', m => errandAt(m)); if (E.rt > 90) { const sp = spotOf('quart_talk'); if (sp) npcPlace(n, sp); errandAt(n); } return; }
  if (E.st === 'prep') { if (errNow() < E.ts) return; // loading: the quartermaster and the servant walk between the sacks and the cart
    for (const m of [...new Set([npcByKey('srv_quart'), n])]) { if (!m || m.path || m.away) continue; if (!m.errand) errRun(m); m.spd = m.spd0 || 46; m.prepT = (m.prepT || 0) - dt; if (m.prepT > 0) continue; m.prepT = 3 + VR.f() * 4;
      const a = m.key === 'srv_quart' ? ['quart', 'quart_cart'] : ['quart_talk', 'quart_cart2']; m.side = 1 - (m.side || 0); npcGoTo(m, a[m.side]); if (VR.chance(0.4)) say(m, VR.pick(LOAD_LINES), 2.5); }
    return; }
  // back / come / wait: walk up to the king and wait for him to listen
  if (!n.errand) errRun(n); const d = n.loc === COURT.loc && P ? Math.hypot(P.x - n.x, P.y - n.y) : 1e9;
  if (E.st === 'wait') { if (d > 64) { E.st = E.st0 || 'back'; n.repT = 0; } else { E.wt = (E.wt || 0) + dt; if (E.wt > 45) { say(n, 'Доклад — в книге событий, государь.', 3); errandEnd(); } return; } }
  if (d < 26) { n.path = null; n.goal = null; n.state = 'idle'; E.st0 = E.st; E.st = 'wait'; E.wt = 0; const dx = P.x - n.x, dy = P.y - n.y; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    say(n, E.k === 'call' ? 'Звали, государь?' : 'Государь! Обоз готов!', 4); return; }
  n.repT = (n.repT || 0) - dt; if (n.repT <= 0 || (!n.path && !n.goal)) { n.repT = 0.8; errFollow(n); }
  if (E.rt > 150) errandEnd(); });
function errandStatusTalk(n, E) {
  if (E.st === 'go') return DLG.say(n, 'Бегу, государь, бегу! Снабженец — у амбара.');
  if (E.st === 'prep') return DLG.say(n, 'Грузим обоз, государь: готово ' + Math.round(errProg(E) * 100) + '%. Готфрид говорит — к ' + clockStr(5 + (E.t1 % 1) * 24) + ' управимся.');
  const o = supS(), pg = o.pages && o.pages.length ? o.pages : [E.rep || o.last]; errandEnd(); DLG.say(n, ['Государь! Снабженец Готфрид велел передать: ' + pg[0]].concat(pg.slice(1)), { name: n.c.name + ' — доклад снабженца' }); }
function errandBusyWhy() { const E = G.court.errand; return !E ? '' : E.st === 'prep' ? 'Снабженец уже собирает обоз (' + Math.round(errProg(E) * 100) + '%).' : 'Другое поручение ещё не исполнено.'; }
function errandTalk(n) { const C = G.court, E = C.errand; if (n.msgr) return talkMessenger(n); if (E && E.by === n.key) return errandStatusTalk(n, E);
  const line = (n.staff === 'runner' ? null : gossipLine(n)) || VR.pick(STAFF_LINES[n.staff] || STAFF_LINES.runner); say(n, line, 4);
  DLG.say(n, line, { sub: npcSub(n), choices: [
    { t: 'Поручение: к снабженцу — собрать обоз в поход…', tip: 'Слуга отнесёт приказ к амбару; снабженец соберёт обоз и пришлёт доклад.', ok: () => !G.court.errand, why: errandBusyWhy(), fx: () => campaignAsk(n, (D, dest) => errandStart(n, 'prep', D, dest)) },
    { t: 'Поручение: позвать снабженца ко мне', ok: () => !G.court.errand, why: errandBusyWhy(), fx: () => errandStart(n, 'call') },
    { t: 'Ступай.', fx: () => { } }], esc: 2 }); }
function supReport() { const D = supS().days, L = supForces().map(f => f.a ? f.n + ': ' + voin(armyMen(f.a)) + ', ' + supLine(f.a).replace(', бочки полны', ', воды на ' + dn(Math.round(f.a.water))) : f.n + ': соберётся при выезде (22 человека, еды на 2 недели).');
  return ['Обоз сейчас, государь. ' + L.join(' '), 'Приказано держать запас на ' + dn(D) + '. ' + (G.court.errand && G.court.errand.st === 'prep' ? 'Гружу: готово ' + Math.round(errProg(G.court.errand) * 100) + '%.' : 'Скажите — соберу.')]; }
function supHowText() { const o = supS();
  return ['В походе я еду с обозом. В каждом своём или нейтральном городе докупаю запас ' + (o.route ? 'на оставшуюся дорогу (а если идём на врага — ещё на неделю осады)' : 'на ' + dn(o.days)) + '. Зерно беру из амбара, но 400 мер оставляю на случай осады; казну ниже ' + o.res + ' зол. не трогаю.',
    'Если груз не влезает — покупаю повозки, но не больше, чем позволит скорость марша. Когда чего-то останется на день-два, предупрежу и скажу, где ближайшая вода и рынок.']; }
function quartTalk(q) { const C = G.court, E = C.errand;
  if (E && E.st === 'go' && E.by !== q.key) { const n = npcByKey(E.by); if (n) errStop(n); // the king got here before his runner
    if (E.k === 'prep') { E.by = q.key; quartBegin(E, 0); npcGoTo(q, 'quart'); DLG.say(q, 'Слышал, государь: обоз на ' + dn(E.days) + '. Начинаю — к ' + clockStr(5 + (E.t1 % 1) * 24) + ' управлюсь.'); return; }
    errandEnd(); }
  if (E && E.by === q.key && E.k === 'call') errandEnd();
  else if (E && E.by === q.key && (E.st === 'back' || E.st === 'wait')) { const o = supS(), pg = o.pages && o.pages.length ? o.pages : [E.rep || o.last]; errandEnd(); DLG.say(q, ['Обоз готов, государь. ' + pg[0]].concat(pg.slice(1))); return; }
  else if (E && E.st === 'prep') { DLG.say(q, 'Гружу обоз на ' + dn(E.days) + ', государь: готово ' + Math.round(errProg(E) * 100) + '%, к ' + clockStr(5 + (E.t1 % 1) * 24) + ' управлюсь.'); return; }
  const busy = () => !!G.court.errand;
  DLG.say(q, VR.pick(STAFF_LINES.quart), { sub: 'Снабженец: еда, фураж, вода, стрелы и повозки', choices: [
    { t: 'Собери обоз в поход…', tip: 'Зерно — из амбара, остальное — с рынка столицы.', ok: () => !busy(), why: errandBusyWhy(), fx: () => campaignAsk(q, (D, dest) => { quartOrder(q, D, dest); npcGoTo(q, 'quart'); }) },
    { t: 'Что у нас в обозе?', fx: () => DLG.say(q, supReport()) },
    { t: 'Как ты ведёшь дело в походе?', fx: () => DLG.say(q, supHowText()) },
    { t: 'Ведомость снабжения (O)', fx: () => UI.open({ k: 'supply' }) },
    { t: 'Ступай.', fx: () => { } }], esc: 4 }); }
POP_EXT.push(() => { for (const k of ERRAND_STAFF) { const n = npcByKey('srv_' + k); if (n) { n.talk = errandTalk; if (!n.sub) n.sub = k === 'runner' || k === 'runner2' ? 'Посыльный двора · даёт поручения' : 'Слуга · можно дать поручение'; } }
  const q = npcByKey('srv_quart'); if (q) { q.talk = quartTalk; q.sub = 'Снабженец: обоз, еда, вода, повозки'; }
  const E = G.court && G.court.errand; if (E) { const n = npcByKey(E.by); if (n && !n.errand) { errRun(n); if (E.st === 'go') npcGoTo(n, 'quart_talk', m => errandAt(m)); else if (E.st === 'prep') n.spd = n.spd0 || 46; } } });
// leaving the castle: the quartermaster hands over what is loaded so far; the errand ends
function supOnLeave() { const C = G.court, E = C && C.errand; if (!E) return;
  if (E.st === 'prep') { const fr = errProg(E); if (fr > 0.05) log('Король выехал раньше срока. Снабженец: ' + supPrepare(E.days, fr), 'info'); else log('Король выехал прежде, чем снабженец начал грузить обоз.', 'bad'); }
  else if (E.st === 'go') log('Посыльный не успел донести приказ снабженцу: король уже выехал.', 'bad');
  errandEnd(); }
{ const lc = leaveCourt; leaveCourt = function (a) { try { supOnLeave(); } catch (e) { onErr(e); } return lc(a); }; }
// the nearest free errand-runner hears the king's order (from the O window)
function errandNearest() { const P = COURT.p; let best = null, bd = 1e9; for (const k of ['runner', 'runner2', 'page', 'maid', 'stable', 'gardener', 'cook', 'smith']) { const n = npcByKey('srv_' + k); if (!n || n.away || n.msgr || n.errand) continue;
    const d = (n.loc === COURT.loc ? 0 : 4000) + Math.hypot(P.x - n.x, P.y - n.y) + (k.startsWith('runner') ? 0 : 200); if (d < bd) { bd = d; best = n; } } return best; }
function supOrderFromWin(D) { const C = G.court; if (!C || C.errand) return; const n = SCREEN === 'court' && !G.visit ? errandNearest() : null;
  if (n) { errandStart(n, 'prep', D, supS().dest); UI.shut(); } else { quartOrder(npcByKey('srv_quart'), D, supS().dest); C.errand.by = 'srv_quart'; UI.toast('Приказ ушёл к снабженцу: обоз на ' + dn(D) + '.'); } }
function supStatus() { const C = G.court, E = C && C.errand; if (!E) return '';
  return E.st === 'go' ? (E.k === 'call' ? 'посыльный зовёт снабженца' : 'посыльный несёт приказ: обоз на ' + dn(E.days)) : E.st === 'prep' ? (errNow() < E.ts ? 'приказ в пути' : 'грузят обоз на ' + dn(E.days) + ': ' + Math.round(errProg(E) * 100) + '%') : E.k === 'call' ? 'снабженец идёт к королю' : 'обоз готов — посыльный идёт с докладом'; }
// ---------- the window (O): the forces, the length of the campaign, the quartermaster's switches ----------
WIN_EXT.supply = function (w) { const X = 14, Y = 21, WW = 612, HH = 326, o = supS(), r = G.realms[G.player.realm], C = G.court, pa = playerArmy(), E = C && C.errand;
  winFrame(X, Y, WW, HH, 'Снабжение и обоз', false); let y = Y + 22; const st = supStatus();
  txt('Снабженец Готфрид' + (pa ? ' едет с обозом' : ' — у амбара во дворе') + (st ? ': ' + st : ''), X + 16, y, st ? PAL.y : PAL.w, { f: 's' });
  txt('Казна: ' + fmt(Math.floor(r.gold)) + ' зол.', X + WW - 22, y, P3.lab, { al: 'r', f: 's' }); y += 11;
  if (E && E.st === 'prep') bar(X + 16, y, 290, 6, errProg(E), '#e0a630'); y += 9;
  // left: the forces
  const LX = X + 10, LW = 300; let ly = y; txt('Силы и припасы', LX + 4, ly, P3.hi); ly += 12; const F = supForces();
  for (const f of F) { rect(LX, ly, LW, 58, 'rgba(0,0,0,0.22)'); strokeR(LX, ly, LW, 58, '#6a4a2a');
    if (!f.a) { txt(f.n, LX + 6, ly + 4, PAL.w); para('Соберётся при выезде: 22 человека и еда на две недели. Приказ снабженцу снарядит и свиту.', LX + 6, ly + 17, LW - 12, UIC.dim, { f: 's', lh: 9 }); ly += 62; continue; }
    const a = f.a, d = supDaysOf(a), D = pa ? supTarget(a) : o.days, wd = pa ? waterDay(a) : { full: 1, d: 0, s: 'у столицы вода рядом' }, lv = v => v >= D - 0.5 ? 2 : v >= Math.min(3, D) ? 1 : 0;
    const ttl = f.n + ' · ' + voin(armyMen(a)); let rt = 'цель ' + dn(D); if (f.who && tw(ttl) + tw(f.who + ' · ' + rt, { f: 's' }) + 18 <= LW) rt = f.who + ' · ' + rt;
    txt(ttl, LX + 6, ly + 4, PAL.w); txt(rt, LX + LW - 6, ly + 5, P3.lab, { al: 'r', f: 's' }); if (f.who) hit(LX, ly, LW, 14, { id: 'sw' + f.n, tip: 'Командует ' + f.who + '. Если король возглавит это войско, свита вольётся в него вместе с обозом.' });
    const cell = (i, lab, val, ok, tip) => { const cx = LX + 6 + (i % 3) * 98, cy = ly + 16 + Math.floor(i / 3) * 20; txt(lab, cx, cy, P3.lab, { f: 's' }); txt(val, cx, cy + 9, ok === 2 ? UIC.good : ok === 1 ? UIC.warn : ok === 0 ? UIC.bad : PAL.w, { f: 's' }); hit(cx, cy, 94, 19, { id: 'sc' + i + f.n, tip }); };
    cell(0, 'Еда', fmt(a.food) + ' · ' + dn(Math.floor(d.food)), lv(d.food), 'Каждый ест 1 в день — раненые и больные тоже. Человек несёт 3, повозка — 400.');
    const h = supHorses(a); cell(1, 'Фураж', h ? fmt(a.fodder) + ' · ' + dn(Math.min(99, Math.floor(d.fodder))) : 'коней нет', h ? lv(d.fodder) : 3, 'Коней, вьючных и упряжных: ' + h + '. Трава даёт часть корма, зимой — ничего.');
    const wl = wd.full || wd.d >= 0 ? null : a.water / -wd.d; cell(2, 'Вода', Math.round(a.water) + ' из ' + waterCap(a) + (wl !== null ? ' · ≈' + dn(Math.floor(wl)) : ''), wl === null || wl >= 3 ? 2 : wl >= 1.5 ? 1 : 0, 'Сегодня: ' + wd.s + '.');
    const rn = rangedN(a.u); cell(3, 'Стрелы', rn ? fmt(a.arrows) + ' · по ' + Math.floor(a.arrows / rn) : 'стрелков нет', rn ? (a.arrows >= rn * 25 ? 2 : a.arrows >= rn * 10 ? 1 : 0) : 3, 'Стрелку в поход — колчан с запасом: 30 стрел.');
    cell(4, 'Повозки', (a.wagons || 0) + ' (до ' + supWagMax(a) + ')', 3, 'Повозка везёт 400. Больше повозок — медленнее марш, поэтому снабженец берёт не больше ' + supWagMax(a) + '.');
    const ld = armyLoad(a) / Math.max(1, armyCap(a)); cell(5, 'Груз', Math.round(ld * 100) + '% вместимости', ld > 0.98 ? 1 : 3, 'Люди несут по 3, повозки — по 400.');
    ly += 62; }
  if (pa) { const wd = waterDay(pa), wt = supWaterTile(pa), m = supMarketNear(pa), men = Math.max(1, armyMen(pa)), wf = pa.wagons ? Math.min(0.35, pa.wagons / (men / 100 + 1) * 0.06) : 0, ln = [];
    ln.push('Вода сегодня: ' + (wd.full ? 'бочки полны' : wd.d >= 0 ? 'не убывает' : '−' + (-wd.d).toFixed(1) + ' в день') + ' — ' + wd.s + '.');
    if (!wd.full) ln.push('Ближайшая вода: ' + (wt >= 0 ? kmDir(pa, wt % MW + 0.5, ((wt / MW) | 0) + 0.5) : 'не видно') + '.');
    if (m) ln.push('Ближайший рынок: ' + m.name + ', ' + kmDir(pa, m.x + 0.5, m.y + 0.5) + '.');
    if (pa.path && pa.pi < pa.path.length - 1 && o.route) { const md = pathDays(pa, pa.path, pa.pi); if (isFinite(md)) ln.push('В пути: ≈' + dn(Math.max(1, Math.round(md))) + ' дороги — снабженец держит запас на ' + dn(supTarget(pa)) + '.'); }
    ln.push(wf > 0.005 ? 'Повозки замедляют марш на ' + Math.round(wf * 100) + '%.' : 'Обоз не замедляет марш.');
    let yy = ly + 2; for (const s of ln) yy += para(s, LX + 4, yy, LW - 8, '#e8dcc0', { f: 's', lh: 9 }) + 2; }
  if (!pa && C) { const S = G.setts[G.realms[G.player.realm].capital], cap = S.id; let fo = 0, fd = 0, ar = 0; for (const f of F) { const a = f.a || { u: { sword: 8, knight: 4, horse: 4, archer: 6 }, food: 300, fodder: 0, arrows: 0, wagons: 1, horses: 0 }; const q = supWant(a, o.days); fo += q.food; fd += q.fodder; ar += q.arrows; }
    const gr = Math.min(fo, Math.max(0, Math.floor((C.grain || 0) - 400))), cost = (buyCost(S, 'food', Math.max(0, fo - gr)) + buyCost(S, 'fodder', fd) + buyCost(S, 'arrows', ar)) * PRICE_K(cap);
    const ls = []; if (fo) ls.push('еды ' + fmt(fo) + (gr ? ' (' + fmt(gr) + ' даст амбар)' : '')); if (fd) ls.push('фуража ' + fmt(fd)); if (ar) ls.push('стрел ' + fmt(ar));
    para(ls.length ? 'На ' + dn(o.days) + ' не хватает: ' + ls.join(', ') + '. На рынке столицы это ≈' + Math.round(cost) + ' зол. (и повозки, если не влезет).' : 'Припасов на ' + dn(o.days) + ' хватает.', LX + 4, ly + 2, LW - 8, ls.length ? '#e8dcc0' : UIC.good, { f: 's', lh: 9 });
    if (!G.visit) para('Приказ можно отдать и голосом: любой слуга (паж, служанка, посыльные Мирко и Ода, повариха, конюх, садовник, кузнец) отнесёт его снабженцу к амбару и вернётся с докладом.', LX + 4, ly + 26, LW - 8, UIC.dim, { f: 's', lh: 9 }); }
  // right: the campaign
  const RX = X + 322, RW = WW - 334; let ry = y; txt('Поход', RX, ry, P3.hi); ry += 12;
  txt('Обоз на:', RX, ry + 3, PAL.w, { f: 's' }); SUP_DAYS.forEach((d, i) => btn('sd' + d, RX + 46 + i * 58, ry, 54, 13, { label: dn(d), style: o.days === d && o.dest < 0 ? 'wood' : 'dark', active: o.days === d && o.dest < 0, onClick: () => { o.days = d; o.dest = -1; } })); ry += 17;
  txt('…или скажите, куда идём, — снабженец посчитает сам:', RX, ry, P3.lab, { f: 's' }); ry += 10; const L = supDests();
  if (!L.length) { txt('Ни войны, ни чужих столиц — назовите число дней.', RX, ry, UIC.dim, { f: 's' }); ry += 14; }
  L.forEach((e, i) => { const sel = o.dest === e.sid; btn('sdst' + i, RX, ry, RW, 13, { label: e.n + ' (' + realmName(e.r) + (e.foe ? ', война' : '') + ') — ≈' + dn(e.march) + ' пути → ' + dn(e.D), style: sel ? 'wood' : 'dark', active: sel, tip: e.foe ? 'Дорога туда, неделя под стенами и запас на обратный путь по чужой земле.' : 'Дорога и три дня запаса.', onClick: () => { o.days = e.D; o.dest = e.sid; } }); ry += 14; });
  ry += 4; const sw = (id, on, label, tip, fx) => { btn(id, RX, ry, RW, 13, { label: label + ': ' + (on ? 'да' : 'нет'), style: on ? 'wood' : 'dark', tip, onClick: fx }); ry += 15; };
  sw('ss_on', o.on, 'Сам докупать в походе', 'В каждом своём или нейтральном городе — до цели. Во вражеских городах с нами не торгуют.', () => { o.on = o.on ? 0 : 1; });
  sw('ss_rt', o.route, 'Когда войско идёт — считать по дороге', 'Цель = оставшиеся дни пути ×1,3 + 3, а перед вражеским городом ещё +7 на осаду. Стоим — цель по числу дней.', () => { o.route = o.route ? 0 : 1; });
  sw('ss_wg', o.wag, 'Брать повозки, если груз не влезает', 'Не больше, чем позволяет скорость марша.', () => { o.wag = o.wag ? 0 : 1; });
  btn('ss_res', RX, ry, RW, 13, { label: 'Не тратить казну ниже ' + o.res + ' зол.', style: 'dark', tip: 'Щёлкните, чтобы сменить: ' + SUP_RES.join(' / ') + ' зол.', onClick: () => { o.res = SUP_RES[(SUP_RES.indexOf(o.res) + 1) % SUP_RES.length]; } }); ry += 19;
  if (pa) { const sid = settNear(pa.x, pa.y, 1.2), S = sid >= 0 ? G.setts[sid] : null, can = !!S && !hostile(G.player.realm, S.ctrl) && !S.siege;
    btn('ss_buy', RX, ry, RW / 2 - 2, 15, { label: 'Пополнить здесь', style: can ? 'wood' : 'dark', disabled: !can, tip: can ? 'Докупить на рынке «' + WD.setts[sid].name + '» — на ' + dn(supTarget(pa)) : 'Нужен свой или нейтральный город рядом.', onClick: () => { const t = supTopUp(pa, sid, true); if (t) UI.toast(t.length > 96 ? t.slice(0, 94) + '…' : t); } });
    const wt = supWaterTile(pa), wd = waterDay(pa), canW = wt >= 0 && !wd.full;
    btn('ss_wat', RX + RW / 2 + 2, ry, RW / 2 - 2, 15, { label: 'Вести к воде', style: canW ? 'wood' : 'dark', disabled: !canW, tip: canW ? 'Ближайшая вода — ' + kmDir(pa, wt % MW + 0.5, ((wt / MW) | 0) + 0.5) + '.' : wd.full ? 'Вода рядом — бочки полны.' : 'Поблизости воды не видно.', onClick: () => { if (orderMove(wt)) { UI.shut(); UI.toast('Войско идёт к воде.'); } } }); }
  else if (C) { const busy = !!E, home = !G.visit;
    btn('ss_go', RX, ry, RW, 15, { label: busy ? 'Идёт: ' + supStatus() : 'Отдать приказ: обоз на ' + dn(o.days), style: busy || !home ? 'dark' : 'wood', disabled: busy || !home, tip: home ? 'Ближайший слуга отнесёт приказ снабженцу, а когда обоз будет готов, придёт с докладом. Можно и самому подойти к любому слуге или к снабженцу у амбара.' : 'Вы в гостях — приказ можно отдать дома.', onClick: () => supOrderFromWin(o.days) }); }
  // the last report
  const by = Y + HH - 44; rect(X + 8, by, WW - 16, 36, 'rgba(0,0,0,0.22)'); strokeR(X + 8, by, WW - 16, 36, '#6a4a2a');
  txt('Последний доклад' + (o.last && o.lastDay >= 0 ? ' · ' + dateStr(o.lastDay) : ''), X + 16, by + 3, P3.lab, { f: 's' });
  wrap(o.last || 'Пока докладывать нечего. Подойдите к любому слуге или к снабженцу у амбара — или отдайте приказ здесь.', WW - 32, { f: 's' }).slice(0, 3).forEach((l, i) => txt(l, X + 16, by + 12 + i * 8, '#e8dcc0', { f: 's' })); };
REFS.push({ s: 'Снабжение', t: 'Снабженец, обоз и поручения', b: () => 'Снабженец Готфрид живёт при амбаре во дворе. Он считает еду, фураж, стрелы, воду и повозки и сам их докупает. Окно снабжения — клавиша O (и кнопка на верхней панели).\n' +
  '• Как приказать. Подойдите к любому слуге — пажу, служанке, посыльным Мирко и Оде, поварихе, конюху, садовнику, кузнецу — и дайте поручение «к снабженцу — собрать обоз в поход». Слуга побежит к амбару, снабженец соберёт обоз (час-другой, дольше для большого войска и долгого похода), и слуга вернётся с докладом. Можно поговорить со снабженцем самому или отдать приказ в окне O.\n' +
  '• Длина похода. Назовите число дней (7, 14, 21, 30) или скажите, куда идёте: снабженец посчитает дорогу, неделю на осаду и запас на обратный путь.\n' +
  '• Откуда берёт. Зерно — из амбара короны (400 мер остаются на случай осады), остальное — с рынка столицы. Казну ниже заданного остатка не тратит. Если груз не влезает, покупает повозки, но не больше, чем позволяет скорость марша. Если король выедет раньше — отдаст, что успел.\n' +
  '• В походе снабженец едет с обозом: в каждом своём или нейтральном городе докупает до цели (когда войско идёт — по оставшейся дороге). Когда еды, воды или фуража остаётся на день-два, он предупреждает и говорит, где ближайшая вода и рынок; в окне O есть «Пополнить здесь» и «Вести к воде».\n' +
  '• Вода. У рек, озёр и поселений бочки наполняются. В лесах, на болотах и в холмах ручьи и родники покрывают почти всю нужду, в полях — около половины, в степи — почти ничего; летом ручьи мелеют, а большому войску их не хватает.' });
