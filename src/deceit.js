'use strict';
// ===== DECEIT (v3.7): «Война — это путь обмана» (гл. 1) =====
// The crown's tricks: a false march (a lord by the order «Ложный марш», or the king's own army with banners and drums), a feigned rout
// of the king's army, straw soldiers on the walls, and the Eye's quiet work — a forged letter, rumours of strength or of weakness,
// intercepted couriers. The enemy answers by what he believes (belief.js): sends armies to guard a fortress nobody meant to take, chases
// a rout into a trap, picks a softer target. And he plays the same game: cunning generals burn false fires, lie low in the woods and
// send the weakest host on a false march at a crown fortress while the others strike elsewhere.
// a.feint = { s, d0, drew, until?, seen } on a crown army · a.feign = the day the feigned rout lasts to · b.lure = days an enemy chased it
// S.dummy = the day the dummies last to · S.dumK[r] = 1 once realm r has seen through them
// a.ai.guard = { s, until, by } · a.ai.feint = { s, until, st } on foreign armies =====
CMD.feint = { n: 'Ложный марш', d: 'Идти к вражеской крепости с кострами, знамёнами и барабанами, но не нападать: встать в дне пути и простоять шесть дней. Если враг поверит, он стянет туда войска с других мест.', tgt: 'foe' };
const nArm = n => n + ' ' + plural(n, 'войско', 'войска', 'войск');
// «Лоренцо (Республика, ≈170 воинов)» — who, whose and how many in one bracket
const armyWho = (a, n) => { const g = charOf(a.gen); return a.kind === 'player' ? 'войско короля' + (n ? ' (≈' + voin(n) + ')' : '') : (g ? g.name : 'войско') + ' (' + REALM_DEF[a.realm].name + (n ? ', ≈' + voin(n) : '') + ')'; };
// where a false march halts: about a day's ride short of the walls, on dry land the army can reach
function feintStage(a, sid) { const ws = WD.setts[sid], cx = ws.x + 0.5, cy = ws.y + 0.5; let dx = a.x - cx, dy = a.y - cy; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n; let tries = 0, first = -1;
  for (const R2 of [3.6, 3, 4.4]) for (const t of [0, 0.5, -0.5, 1, -1]) { const ca = Math.cos(t), sa = Math.sin(t), x = Math.floor(cx + (dx * ca - dy * sa) * R2), y = Math.floor(cy + (dx * sa + dy * ca) * R2);
    if (!inMap(x, y)) continue; const j = y * MW + x; if (!(TINFO[WD.ter[j]].cost > 0) || settAtTile(j) >= 0) continue;
    if (Math.hypot(x + 0.5 - a.x, y + 0.5 - a.y) < 1.5) return j; // already there
    if (first < 0) first = j; if (++tries > 6) return first; const p = planPath(a, j); if (p && p.length > 1) return j; }
  return first >= 0 ? first : armyTile(a); }
function feintEnd(a) { const n = a.feint ? a.feint.drew || 0 : 0; a.feint = null; a.fires = 0; return n; }
function feintTick(a, ct) { const o = a.cmd, S = G.setts[o.t], ws = WD.setts[o.t];
  if (!S || S.ctrl === G.player.realm || !(hostile(G.player.realm, S.ctrl) || S.ctrl === 5)) { feintEnd(a); a.cmd = { o: 'hold', mode: o.mode, day: G.day, x: a.x, y: a.y }; if (ws) cmdNote(a, 'feint0', 'Ложный марш на ' + ws.name + ' потерял смысл: крепость не вражеская. Стою и жду приказа.', true); return ct(a); }
  if (o.st === undefined) o.st = feintStage(a, o.t);
  if (!a.feint || a.feint.s !== o.t) a.feint = { s: o.t, d0: G.day, drew: 0 };
  a.fires = 1; a.hidden = 0;
  const sx = o.st % MW + 0.5, sy = Math.floor(o.st / MW) + 0.5, d = Math.hypot(a.x - sx, a.y - sy);
  if (!o.told) { o.told = 1; cmdNote(a, 'feint', 'Идём к ' + ws.name + ' с кострами, знамёнами и барабанами, будто за нами вся армия короны. В бой не ввяжемся: встанем в дне пути от стен и простоим шесть дней.', true); }
  if (d < 2.5 && !o.arr) { o.arr = G.day; dlog('Ложный марш: ' + armyLabel(a) + ' встал у ' + ws.name + '. Костров вдвое больше, чем людей.'); }
  if (o.arr && G.day - o.arr >= 6) { const n = feintEnd(a); a.cmd = { o: 'hold', mode: o.mode, day: G.day, x: a.x, y: a.y };
    cmdNote(a, 'feint2', 'Шесть дней мы пугали ' + ws.name + '. ' + (n ? 'Враг стянул сюда ' + nArm(n) + '.' : 'Враг так и не тронулся с места.') + ' Гасим лишние костры и ждём приказа.', true);
    dlog('Ложный марш у ' + ws.name + ' окончен: ' + (n ? 'враг стянул туда ' + nArm(n) + '.' : 'враг не поверил или не успел.'), n ? 'good' : 'info'); return ct(a); }
  const save = a.cmd; a.cmd = { o: 'hold', mode: save.mode, day: save.day, x: sx, y: sy }; try { ct(a); } finally { a.cmd = save; }
  if (a.ai && a.ai.task === 'flee') { feintEnd(a); a.cmd = { o: 'hold', mode: o.mode, day: G.day, x: a.x, y: a.y }; dlog('Ложный марш у ' + ws.name + ' сорван: враг пришёл с силой, и ' + armyLabel(a) + ' отступил.', 'bad'); } }
{ const ct = cmdArmyTick; cmdArmyTick = function (a) { const o = a.cmd; if (o && o.o === 'feint') return feintTick(a, ct); if (a.feint) feintEnd(a); return ct(a); }; }
// ---------- the king's own tricks ----------
function kingFeint(on) { const pa = playerArmy(); if (!pa) return; if (on === undefined) on = !pa.feint;
  if (on) { if (pa.siegeOf >= 0) { UI.toast('Войско в осаде — это уже не ложный марш.'); return; } pa.feint = { s: -1, d0: G.day, until: G.day + 8, drew: 0 }; pa.fires = 1; pa.hidden = 0; if (pa.mode === 'hide') pa.mode = 'camp';
    UI.toast('Знамёна развёрнуты, бьют барабаны, костров вдвое больше, чем людей. Встаньте в дне пути от вражеской крепости — и ждите.'); dlog('Войско короля начало ложный марш.'); }
  else { const n = feintEnd(pa); UI.toast('Ложный марш окончен' + (n ? ': враг стянул ' + nArm(n) + '.' : '.')); }
  if (typeof Snd !== 'undefined') Snd.sfx('click'); }
function kingFeign(on) { const pa = playerArmy(); if (!pa) return; if (on === undefined) on = !(pa.feign > G.day);
  if (on) { if (pa.siegeOf >= 0) { UI.toast('Из осады притворно не побежишь — сначала снимите её.'); return; } pa.feign = G.day + 5; pa.hidden = 0;
    UI.toast('Войско «бежит»: строй нарочно рваный, телеги брошены. Уводите врага за собой — и разворачивайтесь, когда он растянется.'); dlog('Войско короля притворно отступает.'); }
  else { pa.feign = 0; UI.toast('Притворное бегство прекращено.'); }
  if (typeof Snd !== 'undefined') Snd.sfx('click'); }
function placeDummy(sid) { const S = G.setts[sid]; if (!S || S.ctrl !== G.player.realm || WD.setts[sid].type === 'village') return false; if (S.dummy > G.day) { UI.toast('Чучела там уже стоят.'); return false; }
  const r0 = G.realms[G.player.realm], ok = G.court ? spend(12) : r0.gold >= 12 && (r0.gold -= 12) >= 0; if (!ok) { UI.toast('Не хватает золота: нужно 12.'); return false; }
  S.dummy = G.day + 40; S.dumK = {}; dlog('На стенах ' + WD.setts[sid].name + ' выставлены чучела в старых шлемах: издали гарнизон кажется почти вдвое больше.'); UI.toast('Чучела на стенах ' + WD.setts[sid].name + ' — на 40 дней.'); return true; }
// ---------- the enemy looks closer ----------
function deceitSeen(r, b, res) { if (!b.feint || !res.close) return;
  const B = belOf(r); B.fooled = (B.fooled || 0) + 1;
  for (const a of G.armies) if (a.alive && a.realm === r && a.ai && a.ai.guard && a.ai.guard.by === b.id) a.ai.guard = null;
  const t = 'Ложный марш раскрыт: разъезд державы ' + realmName(r) + ' подобрался вплотную к нашему стану (' + (b.kind === 'player' ? 'войско короля' : armyLabel(b).replace(/ \(.*\)$/, '')) + ') и увидел, что костров много, а людей мало.';
  dlog(t, 'bad'); if (b.kind === 'lord') { cmdNote(b, 'feintrev', 'Их разъезд подошёл вплотную и разглядел, как нас мало. Уловка раскрыта, государь.', true); if (b.cmd && b.cmd.o === 'feint') b.cmd = { o: 'hold', mode: b.cmd.mode, day: G.day, x: b.x, y: b.y }; } else log(t, 'bad');
  feintEnd(b); }
function eyeNote(r, subj, text, c) { if (!insight(r)) return false; dlog(text, c); if (G.court) letterFromSeat('eye', subj, text); else log(text, c || 'info'); return true; }
// ---------- the enemy answers what he believes ----------
function belThreats(r) { const B = belOf(r), L = [];
  for (const id in B.a) { const e = B.a[id]; if (G.day - e.day > 1 || e.src === 'rumor') continue; const b = armyById(+id); if (!b) continue;
    let sid = e.tgt >= 0 && G.setts[e.tgt].ctrl === r && WD.setts[e.tgt].type !== 'village' ? e.tgt : -1;
    if (sid < 0) { let bd = 4.6; for (const S of G.setts) { if (S.ctrl !== r || WD.setts[S.id].type === 'village') continue; const ws = WD.setts[S.id], d = Math.hypot(ws.x + 0.5 - e.x, ws.y + 0.5 - e.y); if (d < bd) { bd = d; sid = S.id; } } }
    if (sid >= 0) L.push({ b, e, sid }); }
  return L; }
function belReact(r) { const B = belOf(r);
  for (const { b, e, sid } of belThreats(r)) { const S = G.setts[sid], ws = WD.setts[sid]; if (S.siege) continue;
    const R1 = B.react[b.id]; if (R1 && R1.s === sid && G.day - R1.day < 8) continue;
    const gp = powerU(S.gar) * (1 + S.walls * 0.6); if (e.p < gp * 0.8) continue; // the walls will hold against that
    // the ruler does not know a real march from a false one: he believes the report — unless he smells a trick (a spy at our court tells him the truth)
    const ok = courtSpyOf(r) ? !b.feint : R.f() >= skept(r);
    B.react[b.id] = { day: G.day, s: sid, ok: ok ? 1 : 0 };
    if (!ok) { if (b.feint) dlog(realmName(r) + ' не поверили ложному маршу у ' + ws.name + ': правитель ' + skeptWord(skept(r)) + '.', 'bad'); if (b.feint) eyeNote(r, 'Ложный марш не обманул', 'Наши люди при дворе державы ' + realmName(r) + ' доносят: правитель не поверил, что на ' + ws.name + ' идёт большое войско. Его полки не тронулись с места.'); continue; }
    const L = G.armies.filter(a => a.alive && a.realm === r && a.kind === 'lord' && a.mode !== 'siege' && !(a.ai && (a.ai.guard || a.ai.feint || a.ai.task === 'flee'))).map(a => ({ a, d: Math.hypot(a.x - ws.x - 0.5, a.y - ws.y - 0.5) })).filter(x => x.d < 18 * SEAT_K && x.d > 1.5).sort((p, q) => p.d - q.d).slice(0, 2);
    let need = e.p * 1.1 - gp; const sent = [];
    for (const x of L) { if (need <= 0) break; const a = x.a; a.ai = a.ai || { task: 'idle', t: 0 }; a.ai.guard = { s: sid, until: G.day + 12, by: b.id }; a.path = null; a.onArrive = null; a.ai.target = -1; need -= powerU(a.u, a.xp); sent.push(a); }
    if (!sent.length) continue; if (b.feint) b.feint.drew = (b.feint.drew || 0) + sent.length;
    eyeNote(r, b.feint ? 'Враг поверил!' : 'Враг стягивает войска', 'Наши люди при дворе державы ' + realmName(r) + ' доносят: там уверены, что на ' + ws.name + ' идёт ' + (b.kind === 'player' ? 'сам король' : 'большое войско') + ' (по их счёту ≈' + voin(e.men) + '). Туда спешат: ' + sent.map(armyLabel).join(' и ') + '.' + (b.feint ? ' Их прежние цели брошены — ложный марш удался.' : ''), b.feint ? 'good' : 'info'); } }
// our false marches see the enemy coming: the trick worked
function feintWatch() { for (const b of G.armies) { if (!b.alive || b.realm !== G.player.realm || !b.feint) continue;
    if (b.kind === 'player' && (b.siegeOf >= 0 || G.day > b.feint.until)) { const n = feintEnd(b); dlog('Ложный марш войска короля окончен' + (n ? ': враг стянул ' + nArm(n) + '.' : '.'), n ? 'good' : 'info'); continue; }
    const vr = visionOf(b), seen = b.feint.seen || (b.feint.seen = []);
    for (const a of G.armies) { if (!a.alive || !a.ai || !a.ai.guard || a.ai.guard.by !== b.id || seen.includes(a.id) || Math.hypot(a.x - b.x, a.y - b.y) > vr) continue; seen.push(a.id);
      const t = 'К ' + WD.setts[a.ai.guard.s].name + ' подходит ' + armyWho(a, estimateMen(a).n) + '. Враг поверил ложному маршу!';
      dlog(t, 'good'); if (b.kind === 'lord') cmdNote(b, 'feintok' + a.id, t, true); else log(t, 'good'); } } }
function dummyDaily() { for (const S of G.setts) { if (!S.dummy) continue; const ws = WD.setts[S.id];
    if (S.dummy <= G.day || S.ctrl !== G.player.realm) { const mine = S.ctrl === G.player.realm; S.dummy = 0; S.dumK = null; if (mine) dlog('Чучела на стенах ' + ws.name + ' истрепались — их сняли.'); continue; }
    for (let r = 1; r < 5; r++) { if (!alive(r) || (S.dumK && S.dumK[r])) continue; if (courtSpyOf(r)) { (S.dumK = S.dumK || {})[r] = 1; continue; }
      if (G.armies.some(a => a.alive && a.realm === r && a.kind !== 'caravan' && Math.hypot(a.x - ws.x - 0.5, a.y - ws.y - 0.5) < 1.6)) { (S.dumK = S.dumK || {})[r] = 1; belOf(r).fooled = (belOf(r).fooled || 0) + 1; dlog('Разъезд державы ' + realmName(r) + ' подошёл к стенам ' + ws.name + ' вплотную и разглядел чучела.', 'bad'); } } } }
{ const ss = startSiege; startSiege = function (a, sid) { const S = G.setts[sid]; if (S && S.dummy > G.day && a.realm >= 1 && a.realm < 5 && !(S.dumK && S.dumK[a.realm])) { (S.dumK = S.dumK || {})[a.realm] = 1; dlog(armyLabel(a) + ' осадил ' + WD.setts[sid].name + ' и разглядел чучела на стенах.', 'bad'); } return ss(a, sid); }; }
// the feigned rout: whoever chased it for a day and caught up has strung out his ranks
function lureDaily() { const pa = playerArmy(); if (!pa) return;
  if (pa.feign > G.day) { pa.morale = Math.max(5, pa.morale - 1); for (const b of G.armies) if (b.alive && b.realm !== pa.realm && b.kind === 'lord' && b.ai && b.ai.prey === pa.id && b.ai.task === 'hunt') b.lure = (b.lure || 0) + 1; }
  else if (pa.feign) { pa.feign = 0; for (const b of G.armies) if (b.lure) b.lure = 0; dlog('Притворное отступление окончено.'); } }
function lureSprung(pa, b) { const n = b.lure; b.morale = Math.max(5, b.morale - 15); b.fat = Math.min(100, (b.fat || 0) + 25); b.lure = 0; pa.feign = 0; if (b.realm >= 1 && b.realm < 5) belOf(b.realm).fooled = (belOf(b.realm).fooled || 0) + 1;
  const t = 'Притворное бегство удалось: ' + armyLabel(b) + ' гнался за нами ' + n + ' ' + plural(n, 'день', 'дня', 'дней') + ' и растянул строй — дух −15, усталость +25. Разворачиваемся!'; log(t, 'good'); dlog(t, 'good'); if (typeof Snd !== 'undefined') Snd.sfx('horn'); }
{ const ce = checkEncounters; checkEncounters = function () { const pa = playerArmy(); if (pa && pa.feign > G.day && !UI.modalOpen()) for (const b of G.armies) { if (!b.alive || b === pa || !(b.lure >= 1) || !hostile(pa.realm, b.realm) || Math.hypot(b.x - pa.x, b.y - pa.y) > 1.2) continue; lureSprung(pa, b); break; } return ce(); }; }
// ---------- the enemy's own tricks ----------
function lordsOf(r) { return G.armies.filter(a => a.alive && a.realm === r && a.kind === 'lord'); }
function aiTricks(r) { const pr = G.player.realm, war = !!G.rel[r][pr].war, L = lordsOf(r);
  const mine = G.armies.filter(b => b.alive && b.realm === pr && (b.kind === 'lord' || b.kind === 'player'));
  for (const a of L) { if (!a.ai) continue; const g = charOf(a.gen);
    if (a.ai.feint) { if (!war || a.ai.feint.until < G.day) { a.ai.feint = null; a.fires = 0; } else { a.fires = 1; continue; } }
    if (a.path && a.path.length > 1 && a.hidden) a.hidden = 0;
    if (!war || !g) { a.fires = 0; a.hidden = 0; continue; }
    const cun = g.traits.includes('cunning') || (g.intr || 0) >= 13, my = powerU(a.u, a.xp);
    const strong = mine.some(b => Math.hypot(b.x - a.x, b.y - a.y) < 9 && powerU(b.u, b.xp) > my * 1.2);
    const T = WD.ter[armyTile(a)], cover = T === TR.FOREST || T === TR.DFOREST || T === TR.HILLS || T === TR.MARSH;
    if (strong && (cun || g.traits.includes('cautious')) && cover && !a.path && a.mode !== 'siege') { if (!a.hidden) { a.hidden = 1; a.fires = 0; a.hideD = G.day; } }
    else if (strong && cun && !a.hidden) { if (!a.fires) { a.fires = 1; a.fireD = G.day; eyeNote(r, 'Ложные костры', 'У войска ' + armyLabel(a) + ' костров вдвое больше, чем людей: на деле там ≈' + voin(Math.round(armyMen(a) / 10) * 10) + '. Не верьте дыму, государь.', 'warn'); } }
    else if (!strong) { if (a.fires && G.day - (a.fireD || 0) > 3) a.fires = 0; if (a.hidden && G.day - (a.hideD || 0) > 3) a.hidden = 0; } }
  // a false march of the weakest host at a crown fortress, while the others strike elsewhere
  if (!war || (G.day + r * 2) % 6 !== 0 || R.f() > 0.22 || L.some(a => a.ai && a.ai.feint)) return; const ru = rulerOf(r);
  const free = L.filter(a => a.ai && a.mode !== 'siege' && !a.ai.guard && a.ai.task !== 'flee' && armyMen(a) >= 60);
  if (free.length < 2 || !(ru && (ru.traits.includes('cunning') || (ru.intr || 0) >= 12) || free.some(a => { const g = charOf(a.gen); return g && g.traits.includes('cunning'); }))) return;
  const W0 = free.slice().sort((p, q) => powerU(p.u, p.xp) - powerU(q.u, q.xp))[0];
  let T = null, bd = 24 * SEAT_K; for (const S of G.setts) { if (S.ctrl !== pr || WD.setts[S.id].type === 'village' || S.siege) continue; const ws = WD.setts[S.id], d = Math.hypot(ws.x - W0.x, ws.y - W0.y); if (d < bd) { bd = d; T = S; } }
  if (!T) return; const st = feintStage(W0, T.id); W0.ai.feint = { s: T.id, until: G.day + 12, st }; W0.fires = 1; W0.hidden = 0; W0.path = null; W0.onArrive = null; goTo(W0, st, 'feint');
  const e = G.court ? seatChar('eye') : null;
  if (insight(r) && R.chance(clamp(0.45 + (e ? e.intr : 6) / 40, 0.3, 0.9))) eyeNote(r, 'Ложный марш врага', 'Наши люди при дворе державы ' + realmName(r) + ' доносят: ' + armyWho(W0, Math.round(armyMen(W0) / 10) * 10) + ' идёт к ' + WD.setts[T.id].name + ' с кострами на вдвое большее войско. Это приманка, государь: настоящий удар готовят в другом месте.', 'warn'); }
// foreign armies sent to guard (or on a false march) hold their post instead of choosing new war targets
{ const aa = aiArmy; aiArmy = function (a) {
  if (a.kind === 'lord' && a.realm >= 1 && a.realm <= 4 && a.ai && (a.ai.guard || a.ai.feint)) { const gd = a.ai.guard || a.ai.feint, S = G.setts[gd.s];
    let ok = gd.until >= G.day && !!S && (a.ai.guard ? S.ctrl === a.realm : S.ctrl === G.player.realm && !!G.rel[a.realm][G.player.realm].war);
    if (ok && a.ai.guard) { const e = belOf(a.realm).a[gd.by]; if (!e || G.day - e.day > 4) ok = false; }
    if (!ok) { if (a.ai.feint) a.fires = 0; a.ai.guard = null; a.ai.feint = null; }
    else { const tile = a.ai.feint ? gd.st : WD.setts[gd.s].i, d = Math.hypot(tile % MW + 0.5 - a.x, Math.floor(tile / MW) + 0.5 - a.y), task = a.ai.feint ? 'feint' : 'guard';
      if (d > 2.2) { // on the way to the post only a stronger enemy close at hand, thirst or hunger turn them aside
        const my = powerU(a.u, a.xp), danger = threatsNear(a, 4).some(x => x.p > my * 1.25 && x.b.kind !== 'bandit');
        if (!danger && a.mode !== 'siege' && a.water >= 1 && a.food > armyMen(a) * 2) { if ((a.path && a.ai.task === task) || goTo(a, tile, task)) return; a.ai.guard = null; a.ai.feint = null; } }
      else a.ai.t = Math.max(a.ai.t || 0, 3); } }
  return aa(a); }; }
// ---------- why the enemy did what he did (when we have someone at his court) ----------
{ const dw = declareWar; declareWar = function (r, t, o) { const ok = dw(r, t, o);
  if (ok && t === G.player.realm && r >= 1 && r < 5) { const bp = belPower(r), tp = realmPower(t); if (bp < tp * 0.8) eyeNote(r, 'Почему они напали', 'Наши люди при дворе державы ' + realmName(r) + ' доносят: там сочли нас слабее, чем мы есть — по их счёту наша сила ≈' + fmt(bp) + ', на деле ≈' + fmt(tp) + '.' + (belOf(r).rum && belOf(r).rum.k === 'weak' ? ' Слух о нашей слабости сделал своё дело.' : ''), 'warn'); }
  return ok; }; }
{ const op = aiOfferPeace; aiOfferPeace = function (r, t, ws) { const res = op(r, t, ws);
  if (t === G.player.realm && r >= 1 && r < 5) { const bp = belPower(r), tp = realmPower(t); if (bp > tp * 1.25) eyeNote(r, 'Почему они просят мира', 'Наши люди при дворе державы ' + realmName(r) + ' доносят: там уверены, что наша сила ≈' + fmt(bp) + ' — больше, чем на деле (≈' + fmt(tp) + '). ' + (belOf(r).rum && belOf(r).rum.k === 'str' ? 'Слух о нашей силе сделал своё дело.' : 'Наши уловки сделали своё дело.'), 'good'); }
  return res; }; }
function deceitDaily() { const pr = G.player.realm;
  for (let r = 1; r < 5; r++) { if (!alive(r)) continue; if (G.rel[r][pr].war) belReact(r); aiTricks(r); }
  feintWatch(); dummyDaily(); lureDaily(); }
// ---------- the Eye's quiet work ----------
function forgeDone(t, c, e) { if (!alive(t)) return 'Державы ' + realmName(t) + ' больше нет — письмо некому подбросить.';
  const nb = neighbours(t), L = [1, 2, 3, 4].filter(x => x !== t && alive(x) && !G.rel[t][x].war && !G.rel[t][x].ally);
  const B2 = L.sort((p, q) => (nb.includes(q) - nb.includes(p)) || (!!G.rel[0][q].war - !!G.rel[0][p].war) || G.rel[t][p].opn - G.rel[t][q].opn)[0];
  if (B2 === undefined) return 'Подходящего соседа для подлога не нашлось: ' + realmName(t) + ' уже со всеми воюет или в союзе.';
  if (R.f() < clamp(0.42 - ((c.intr || 8) - 8) * 0.03 - (e - 1) * 0.3 + skept(t) * 0.25, 0.06, 0.6)) { addOpn(t, 0, -25); for (let x = 1; x < 5; x++) if (x !== t && alive(x)) addOpn(x, 0, -5); belOf(t).fooled = (belOf(t).fooled || 0) + 1;
    const s = 'Подлог раскрыт! ' + realmName(t) + ' знает, что письмо от имени державы ' + realmName(B2) + ' сочинили у нас. Позор на всех дворах.'; dlog(s, 'bad'); return s; }
  addOpn(t, B2, -Math.round(25 * e)); addOpn(B2, t, -8); belOf(t).plot[B2] = G.day + 60;
  let war = false; if (G.rel[t][B2].opn < -40 && !warsOf(t).length && R.f() < 0.3 * e) war = declareWar(t, B2);
  const s = 'Письмо «от державы ' + realmName(B2) + '» легло на стол правителя ' + realmName(t) + ' (' + effWord(e) + '): мнение о соседе упало до ' + Math.round(G.rel[t][B2].opn) + '.' + (war ? ' ' + realmName(t) + ' ' + rV(t, 'объявила', 'объявило', 'объявили') + ' войну!' : '');
  dlog(s, 'good'); return s; }
function rumorDone(t, f, c, e) { if (!alive(t)) return 'Державы ' + realmName(t) + ' больше нет.'; const B = belOf(t), s0 = skept(t);
  if (R.f() < s0 * 0.7 / Math.max(0.6, e)) { const s = 'В державе ' + realmName(t) + ' слухам ' + (f > 1 ? 'о нашей силе' : 'о нашей слабости') + ' не поверили: правитель ' + skeptWord(s0) + '.'; dlog(s, 'bad'); return s; }
  const k = f > 1 ? 1 + (f - 1) * clamp(e, 0.6, 1.4) : 1 - (1 - f) * clamp(e, 0.6, 1.4);
  B.rum = { f: Math.round(k * 100) / 100, until: G.day + Math.round(45 * clamp(e, 0.7, 1.3)), k: f > 1 ? 'str' : 'weak' };
  const s = 'В державе ' + realmName(t) + ' поверили слуху: ' + (f > 1 ? 'у короны новые полки и полные арсеналы' : 'войско короны распущено, казна пуста') + ' (' + effWord(e) + ', до ' + (B.rum.until % DAYS_SEASON + 1) + ' д. ' + SEASONS[seasonOf(B.rum.until)].toLowerCase() + ').'; dlog(s, 'good'); return s; }
function icpDay(o, c, e) { const t = o.t; o.n = o.n || 0; o.sw = o.sw || 0; if (!alive(t) || o.n >= 8) return;
  for (const a of G.armies) { if (!a.alive || a.realm !== t || a.kind !== 'lord' || !a.ai) continue; const s = a.onArrive && a.onArrive.k === 'siege' ? a.onArrive.s : -1; if (s < 0 || a.ai.icp === s) continue; a.ai.icp = s;
    if (!R.chance(clamp(0.35 * e + (c.intr || 8) / 40, 0.15, 0.9))) continue; o.n++; know(a, 'icp');
    const g = charOf(a.gen), ws = WD.setts[s], ours = G.setts[s].ctrl === G.player.realm, who = (g ? charName(g) : 'Войско') + ' (' + realmName(t) + ', ≈' + voin(Math.round(armyMen(a) / 10) * 10) + ')';
    if (ours && e >= 1.05 && R.chance(clamp(0.2 * e + ((c.intr || 8) - 10) * 0.03, 0.05, 0.45))) {
      let alt = null, bd = -1; for (const S of G.setts) { if (S.ctrl !== t || WD.setts[S.id].type === 'village') continue; const w2 = WD.setts[S.id], d = Math.hypot(w2.x - a.x, w2.y - a.y), d2 = Math.hypot(w2.x - ws.x, w2.y - ws.y); if (d < 25 * SEAT_K && d2 > bd) { bd = d2; alt = S; } }
      if (alt && goTo(a, WD.setts[alt.id].i, 'patrol')) { a.onArrive = null; a.ai.t = 6; o.sw++; const s2 = 'Перехватили гонца и подменили приказ: ' + who + ' вместо ' + ws.name + ' повернул к ' + WD.setts[alt.id].name + '.'; letterFromSeat('eye', 'Подменённый приказ', s2); dlog(s2, 'good'); continue; } }
    const s1 = 'Перехвачен гонец: ' + who + ' получил приказ идти на ' + ws.name + (ours ? ' — нашу крепость!' : '.'); letterFromSeat('eye', 'Перехвачен гонец', s1); dlog(s1, ours ? 'warn' : 'info'); } }
ORD.eye.push(
  { k: 'forge', n: 'Подложное письмо', d: 'Подбросить правителю письмо будто бы от соседа — с оскорблениями и тайными замыслами. Правитель озлобится на соседа, может дойти и до войны. Раскроют подлог — позор падёт на нас.', cost: 25, dur: 8, tgt: 'realm', done: (o, c, e) => forgeDone(o.t, c, e) },
  { k: 'rum_str', n: 'Слух о нашей силе', d: 'Купцы и певцы разнесут по державе: у короны новые полки и полные арсеналы. Враг сочтёт нас сильнее — реже нападёт, легче пойдёт на мир.', cost: 20, dur: 7, tgt: 'realm', done: (o, c, e) => rumorDone(o.t, 1.45, c, e) },
  { k: 'rum_weak', n: 'Слух о нашей слабости', d: '«Будучи способным, показывай неспособность» (гл. 1): пусть враг думает, что войско короны распущено. Осмелеет, нападёт — и попадёт в ловушку.', cost: 20, dur: 7, tgt: 'realm', done: (o, c, e) => rumorDone(o.t, 0.6, c, e) },
  { k: 'icp', n: 'Перехватывать гонцов', d: 'Засады на дорогах державы: перехваченные приказы скажут, куда идут её войска. Умелое Око подменит приказ — и войско повернёт не туда.', cost: 30, dur: 24, tgt: 'realm', day: (o, c, e) => icpDay(o, c, e),
    done: o => o.n ? 'Перехвачено гонцов державы ' + realmName(o.t) + ': ' + o.n + (o.sw ? ', подменено приказов: ' + o.sw : '') + '.' : 'Гонцов державы ' + realmName(o.t) + ' перехватить не удалось: её войска стояли или вести шли другими дорогами.' });
REFS.push({ s: 'Обман', t: 'Война — путь обмана', b: () => 'Враг не знает, а верит. Каждая держава помнит, где и какими видела ваши войска: её разъезды, крепости и деревни, слухи от купцов, шпион при вашем дворе. По этой картине её полководцы бегут, преследуют и выбирают цели — а картину можно подменить.\n' +
  '• Ложные костры (окно войска): издали войско кажется почти вдвое больше. Вблизи пустые палатки видны.\n' +
  '• Ложный марш: приказ лорду («Войска короны» → «Ложный марш…») или знамёна и барабаны войска короля (I → «Уловки»). Встаньте в дне пути от вражеской крепости и не нападайте. Если правитель поверит, он снимет с других мест одно-два войска и пришлёт их сторожить крепость. Разъезд, подошедший вплотную, раскроет уловку.\n' +
  '• Притворное отступление (войско короля, 5 дней): враг видит бегущих и гонится. Кто гнался хотя бы день и догнал — растянул строй: дух −15, усталость +25. Мудрые, хитрые и осторожные полководцы за притворно бегущим не гонятся.\n' +
  '• Чучела на стенах (12 зол., 40 дней): гарнизон кажется почти вдвое больше — враг выберет цель полегче. Осада или разъезд у самых стен их раскроют.\n' +
  '• Око короля: «Подложное письмо» ссорит державу с соседом; «Слух о нашей силе» отпугивает, «Слух о нашей слабости» заманивает; «Перехватывать гонцов» — узнать, куда идут её войска, а умелому Оку — и подменить приказ.\n' +
  '• Правитель хитрый, мудрый, осторожный, сведущий в интригах верит меньше; безрассудный и гневливый — больше. Каждая раскрытая уловка учит его осторожности. Шпион при вашем дворе выдаёт ваши замыслы.\n' +
  '• Что думает враг, видно лишь с внутренним лазутчиком или сетью Ока 2+ (окно «Разведка и обман», клавиша I).\n' +
  'Враг играет так же: хитрые полководцы жгут ложные костры, затаиваются в лесу (над деревьями взлетают птицы) и шлют слабейшее войско в ложный марш. Призраки на карте — где войско видели в последний раз и сколько дней назад.' });
