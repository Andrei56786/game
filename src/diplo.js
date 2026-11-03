'use strict';
// ===== DIPLOMACY: wars, peace, opinions, treaties, council of the crown, victory =====
const MAPDIRTY = { pol: 0, t: 0 };
const rel = (a, b) => G.rel[a][b];
function setRel(a, b, k, v) { G.rel[a][b][k] = v; G.rel[b][a][k] = v; }
function addOpn(a, b, v) { const r = G.rel[a][b]; r.opn = clamp(r.opn + v, -100, 100); }
function realmName(r) { return REALM_DEF[r].name; }
const RG = ['n', 'p', 'f', 'f', 'f', 'p', 'p']; // grammatical gender/number of realm names
function rV(r, f, n, p) { const g = RG[r]; return g === 'f' ? f : g === 'n' ? n : p; }
function rulerOf(r) { return charOf(G.realms[r].ruler); }
function alive(r) { return r < 5 && !G.realms[r].dead; }
function msg(o) { o.id = G.nextId++; o.day = G.day; if (!o.until) o.until = G.day + 12; G.msgs.push(o); if (typeof UI !== 'undefined' && UI.onMsg) UI.onMsg(o); return o; }
function warsOf(r) { const o = []; for (let t = 0; t < 5; t++) if (t !== r && G.rel[r][t].war) o.push(t); return o; }
function allyOf(r) { const o = []; for (let t = 0; t < 5; t++) if (t !== r && G.rel[r][t].ally && alive(t)) o.push(t); return o; }
// ---------- war ----------
function declareWar(r, t, o) {
  o = o || {}; if (r === t || G.rel[r][t].war || !alive(r) || (t < 5 && !alive(t))) return false;
  const R0 = G.realms[r], broke = G.rel[r][t].truce > G.day || G.rel[r][t].pact > G.day || G.rel[r][t].ally;
  setRel(r, t, 'war', 1); setRel(r, t, 'since', G.day); setRel(r, t, 'bs', 0); setRel(r, t, 'truce', 0); setRel(r, t, 'pact', 0); setRel(r, t, 'ally', 0);
  addOpn(t, r, -40);
  if (broke) { R0.prestige = (R0.prestige || 0) - 25; for (let x = 0; x < 5; x++) if (x !== r && x !== t) addOpn(x, r, rulerOf(x).traits.includes('honest') ? -25 : -12); }
  if (t < 5 && !o.silent) {
    if (r === G.player.realm || t === G.player.realm) { log((r === G.player.realm ? 'Мы объявили войну: ' + realmName(t) : realmName(r) + ' ' + rV(r, 'объявила', 'объявило', 'объявили') + ' нам войну!') + (broke ? ' Договор нарушен.' : ''), 'war'); if (typeof Snd !== 'undefined') Snd.sfx('horn'); if (t === G.player.realm && typeof UI !== 'undefined') UI.alert('war', r); }
    else if (G.realms[G.player.realm]) log(realmName(r) + ' ' + rV(r, 'объявила', 'объявило', 'объявили') + ' войну: ' + realmName(t) + '.', 'info');
  }
  // allies of the defender are called to arms
  if (t < 5 && !o.noCall) for (const x of allyOf(t)) {
    if (x === r || G.rel[x][r].war) continue;
    if (x === G.player.realm) msg({ kind: 'call', from: t, enemy: r, text: rulerOf(t).title + ' ' + rulerOf(t).name + ' призывает нас к оружию против: ' + realmName(r) + '. Отказ разорвёт союз.' });
    else if (G.rel[x][r].opn < 30 && R.f() < 0.8) declareWar(x, r, { noCall: true, ally: t });
    else { setRel(x, t, 'ally', 0); addOpn(t, x, -30); }
  }
  // allies of the attacker may join
  if (t < 5 && !o.noCall && !o.ally) for (const x of allyOf(r)) { if (x === t || G.rel[x][t].war || x === G.player.realm) continue; if (G.rel[x][t].opn < 0 && R.f() < 0.6) declareWar(x, t, { noCall: true, ally: r }); }
  if (r === G.player.realm && t < 5) for (const x of allyOf(r)) { if (x === t || G.rel[x][t].war) continue; if (G.rel[x][r].opn > 5 || R.f() < 0.5) { declareWar(x, t, { noCall: true, ally: r }); log(realmName(x) + ' ' + rV(x, 'вступает', 'вступает', 'вступают') + ' в войну на нашей стороне.', 'good'); } }
  if (typeof TUT !== 'undefined') TUT.ev('war', { r, t });
  return true;
}
function returnOccupied(a, b) { // lands occupied between a and b go back to owners
  for (const S of G.setts) {
    if ((S.owner === a && S.ctrl === b) || (S.owner === b && S.ctrl === a)) { S.ctrl = S.owner; S.siege = null; S.gar = roundU(scaleU(baseGarrison(S), 0.35)); }
    if (S.siege) { const sa = armyById(S.siege.by); if (sa && ((sa.realm === a && S.ctrl === b) || (sa.realm === b && S.ctrl === a))) endSiege(sa); }
  }
  MAPDIRTY.pol = 1; BORDER_DAY = -1;
}
function baseGarrison(S) { const t = WD.setts[S.id].type; return Object.assign(emptyU(), t === 'village' ? { levy: 12, archer: 3 } : t === 'castle' ? { levy: 30, spear: 30, sword: 12, archer: 20, xbow: 4, horse: 4 } : t === 'town' ? { levy: 50, spear: 30, sword: 10, archer: 22, xbow: 8, horse: 4 } : { levy: 60, spear: 60, sword: 40, archer: 40, xbow: 10, horse: 12, knight: 4 }); }
// winner keeps occupied lands of loser if cede; gold reparations
function makePeace(win, lose, cede, gold) {
  if (!G.rel[win][lose].war) return;
  let ceded = [];
  if (cede) for (const S of G.setts) if (S.owner === lose && S.ctrl === win) { S.owner = win; ceded.push(S.id); if (S.lord >= 0) S.lord = -1; }
  returnOccupied(win, lose);
  setRel(win, lose, 'war', 0); setRel(win, lose, 'truce', G.day + DAYS_YEAR); setRel(win, lose, 'bs', 0);
  if (gold) { const g = Math.min(gold, Math.max(0, G.realms[lose].gold)); G.realms[lose].gold -= g; G.realms[win].gold += g; }
  addOpn(lose, win, cede ? -20 : -5); addOpn(win, lose, 10);
  if (win < 5) G.realms[win].prestige = (G.realms[win].prestige || 0) + (cede ? 15 + ceded.length * 5 : 5);
  const names = ceded.filter(id => WD.setts[id].type !== 'village').map(id => WD.setts[id].name);
  if (win === G.player.realm || lose === G.player.realm) {
    const other = win === G.player.realm ? lose : win;
    log('Мир с державой ' + realmName(other) + '. ' + (cede && ceded.length ? (win === G.player.realm ? 'Нам отошли: ' : 'Мы уступили: ') + (names.join(', ') || ceded.length + ' деревни') + '.' : 'Белый мир.') + (gold ? ' Выплата: ' + gold + ' зол.' : ''), win === G.player.realm ? 'good' : 'info');
    if (typeof Snd !== 'undefined') Snd.sfx('bell');
  } else log('Мир: ' + realmName(win) + ' и ' + realmName(lose) + (cede && ceded.length ? '. Уступлено земель: ' + ceded.length : '') + '.', 'info');
  checkRealms(); MAPDIRTY.pol = 1;
  if (typeof TUT !== 'undefined') TUT.ev('peace', { win, lose });
}
function aiOfferPeace(r, t, ws) {
  // ws: positive = r winning
  let terms;
  if (ws <= -30) terms = { cede: true, gold: 0, win: t, lose: r, d: 'уступить захваченные вами земли' };
  else if (ws >= 30) terms = { cede: true, gold: 0, win: r, lose: t, d: 'уступить им захваченные земли' };
  else terms = { cede: false, gold: 0, win: ws >= 0 ? r : t, lose: ws >= 0 ? t : r, d: 'белый мир — всё как было' };
  msg({ kind: 'peace', from: r, terms, text: rulerOf(r).title + ' ' + rulerOf(r).name + ' предлагает мир: ' + terms.d + '.' });
  if (typeof Snd !== 'undefined') Snd.sfx('gallop');
}
function checkRealms() {
  for (let r = 0; r < 5; r++) {
    const R0 = G.realms[r]; if (R0.dead) continue;
    const forts = G.setts.filter(S => S.ctrl === r && WD.setts[S.id].type !== 'village').length;
    const owned = G.setts.filter(S => S.owner === r).length;
    if (forts === 0 && owned === 0 || (forts === 0 && !G.armies.some(a => a.alive && a.realm === r && (a.kind === 'lord' || a.kind === 'player')))) {
      if (r === G.player.realm) { G.over = G.over || { win: false, why: 'Держава пала: у короля не осталось ни одной крепости.' }; continue; }
      R0.dead = 1; for (let t = 0; t < 7; t++) if (t !== r && t !== 6) { setRel(r, t, 'war', 0); setRel(r, t, 'ally', 0); }
      for (const a of G.armies) if (a.alive && a.realm === r && a.kind !== 'caravan') destroyArmy(a, 'держава пала');
      for (const S of G.setts) if (S.owner === r) S.owner = S.ctrl === r ? 5 : S.ctrl;
      log('Держава ' + realmName(r) + ' ' + rV(r, 'пала', 'пало', 'пали') + '!', r === G.player.realm ? 'bad' : 'title'); MAPDIRTY.pol = 1;
    }
  }
}
// ---------- opinions ----------
function opinionBreakdown(x, y) { // what x thinks of y, explained
  const r = G.rel[x][y], o = [];
  const base = r.opn; o.push({ t: 'Отношения', v: Math.round(base) });
  if (r.ally) o.push({ t: 'Союз', v: 25 }); if (r.pact > G.day) o.push({ t: 'Пакт о ненападении', v: 10 });
  if (r.war) o.push({ t: 'Война', v: -40 }); if (r.truce > G.day) o.push({ t: 'Недавняя война', v: -10 });
  const ce = warsOf(x).filter(t => G.rel[y][t].war).length; if (ce) o.push({ t: 'Общий враг', v: 15 * ce });
  const ry = rulerOf(y), rx = rulerOf(x);
  if (rx.traits.includes('honest') && ry.traits.includes('honest')) o.push({ t: 'Оба честны', v: 10 });
  if (rx.traits.includes('cunning') && ry.traits.includes('honest')) o.push({ t: 'Хитрец не доверяет честному', v: -5 });
  if (rx.traits.includes('proud') && (G.realms[y].prestige || 0) > (G.realms[x].prestige || 0) + 30) o.push({ t: 'Зависть гордеца', v: -10 });
  const pr = Math.round((G.realms[y].prestige || 0) / 10); if (pr) o.push({ t: 'Слава державы', v: clamp(pr, -15, 15) });
  return o;
}
const opinionOf = (x, y) => clamp(opinionBreakdown(x, y).reduce((s, l) => s + l.v, 0), -100, 100);
function diploWeekly() {
  for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
    if (a === b) continue; const r = G.rel[a][b];
    let tgt = 0; if (neighboursSet(a).has(b)) tgt -= 12; if (r.war) tgt -= 30;
    r.opn += (tgt - r.opn) * 0.03;
  }
  // AI-AI alliances & pacts
  for (let a = 1; a < 5; a++) for (let b = a + 1; b < 5; b++) {
    if (!alive(a) || !alive(b) || a === G.player.realm || b === G.player.realm) continue; const r = G.rel[a][b];
    if (r.war || r.ally) continue;
    const common = warsOf(a).some(t => G.rel[b][t].war);
    if (common && opinionOf(a, b) > 0 && opinionOf(b, a) > 0 && R.f() < 0.3) { setRel(a, b, 'ally', 1); log(realmName(a) + ' и ' + realmName(b) + ' заключили союз.', 'info'); }
    else if (r.pact < G.day && opinionOf(a, b) > 15 && R.f() < 0.08) setRel(a, b, 'pact', G.day + DAYS_YEAR * 2);
  }
}
let NB_CACHE = { d: -1, m: {} };
function neighboursSet(r) { if (NB_CACHE.d !== G.day) NB_CACHE = { d: G.day, m: {} }; if (!NB_CACHE.m[r]) NB_CACHE.m[r] = new Set(neighbours(r)); return NB_CACHE.m[r]; }
// ---------- player proposals (CK3-style acceptance) ----------
function powerRatio(a, b) { return realmPower(a, b) / Math.max(1, realmPower(b, a)); }
function playerOnIntersecting() { const pa = playerArmy(); return pa && pa.ground === 'intersecting'; }
function acceptance(kind, t, o) {
  o = o || {}; const p = G.player.realm, L = [], add = (txt, v) => { v = Math.round(v); if (v) L.push({ t: txt, v }); };
  const ru = rulerOf(t), tr = k => ru.traits.includes(k), op = opinionOf(t, p), pw = powerRatio(p, t);
  if (G.realms[t].asked > G.day) return { ok: false, lines: [{ t: 'Недавно уже отвечали нам', v: -999 }], sum: -999 };
  if (kind === 'peace') {
    const ws = warScore(p, t), dur = G.day - G.rel[p][t].since;
    add('Базовое нежелание', -10); add('Счёт войны', ws * 0.9); add('Мнение о нас', op * 0.25); add('Усталость от войны', Math.min(30, dur / 4));
    if (o.cede) { const n = G.setts.filter(S => S.owner === t && S.ctrl === p && WD.setts[S.id].type !== 'village').length; add('Уступить земли (' + n + ')', -12 - n * 10); if (G.setts[G.realms[t].capital].ctrl === p) add('Их столица в наших руках', 25); }
    if (o.gold) add('Наше золото: ' + o.gold, o.gold / (tr('greedy') ? 3 : 5));
    if (o.demand) add('Требуем золото: ' + o.demand, -o.demand / 4);
    if (tr('proud')) add('Гордый', o.cede || o.demand ? -15 : -5); if (tr('wrathful')) add('Гневливый', -8); if (tr('craven')) add('Трусливый', 12);
    add('Соотношение сил', clamp((pw - 1) * 20, -25, 25));
    if (warsOf(t).length > 1) add('Воюет на два фронта', 15);
    if (playerOnIntersecting()) add('Перекрёсточная земля (гл. 11)', 15);
  } else if (kind === 'ally') {
    add('Базовое нежелание', -30); add('Мнение о нас', op * 0.7); add('Соотношение сил', clamp((pw - 0.8) * 15, -15, 20));
    const ce = warsOf(t).filter(x => G.rel[p][x].war).length; if (ce) add('Общий враг', 30 * ce);
    if (warsOf(p).length && !ce) add('Не хотят втягиваться в нашу войну', -15 * warsOf(p).length);
    if (tr('honest') && rulerOf(p).traits.includes('honest')) add('Честный с честным', 10);
    if (G.rel[p][t].truce > G.day) add('Недавняя война', -20);
    if (playerOnIntersecting()) add('Перекрёсточная земля (гл. 11)', 15);
  } else if (kind === 'pact') {
    add('Базовое нежелание', -10); add('Мнение о нас', op * 0.5); add('Наша сила их пугает', clamp((pw - 1) * 20, -10, 20));
    if (warsOf(t).length) add('Им нужен спокойный тыл', 15); if (tr('wrathful')) add('Гневливый', -10);
    if (playerOnIntersecting()) add('Перекрёсточная земля (гл. 11)', 15);
  } else if (kind === 'tribute') {
    add('Базовое нежелание', -45); add('Страх перед нами', clamp((pw - 1) * 35, -30, 45)); add('Мнение о нас', op * 0.2);
    add('Наша грозная слава', Math.min(20, (G.realms[p].fear || 0) / 2));
    if (tr('proud')) add('Гордый', -30); if (tr('craven')) add('Трусливый', 20); if (G.rel[p][t].war) add('Мы воюем с ними', -100);
  }
  if (G.court && p === 0) { const ch = seatChar('chancellor'); if (ch) add('Канцлер ' + ch.name + ' (Речь ' + ch.dip + ')', (ch.dip - 10) * 1.5); else add('Нет канцлера — говорить некому', -8); if (G.court.prestige) add('Слава короля', clamp(G.court.prestige * 0.15, -10, 12)); }
  if (typeof visitBonus === 'function') for (const l of visitBonus(t) || []) add(l[0], l[1]);
  const sum = L.reduce((s, l) => s + l.v, 0);
  return { ok: sum > 0, lines: L, sum };
}
// ---------- the ruler's answer (shown in the diplomacy window) ----------
const DREPLY = {
  no: { peace: { proud: 'Белый мир? Мои знамёна не опустятся по вашей просьбе.', wrathful: 'Мир?! После всего, что было? Пусть решит сталь.', greedy: 'Мир стоит дороже, чем вы предлагаете.', cunning: 'Любопытно… но время работает на нас. Нет.', _: 'Война ещё не сказала последнего слова. Мы отказываем.' },
    ally: { proud: 'Мы не встанем под чужое знамя.', cautious: 'Слишком рискованно. Быть может, позже.', greedy: 'А что мы с этого получим? Пока — ничего.', _: 'Союз с вами? Нам не нужны чужие войны.' },
    pact: { wrathful: 'Я не даю обещаний, которые захочу нарушить.', cunning: 'Связать себе руки? Нет уж.', _: 'Нам незачем связывать себе руки.' },
    tribute: { proud: 'Дань? Приходите за ней с мечом — если посмеете!', brave: 'Мы вас не боимся. Ни гроша.', _: 'Мы не платим дань тем, кого не боимся.' } },
  yes: { peace: { _: 'Довольно крови. Пусть будет мир.', cede: 'Земли ваши… Мир — но не дружба.', gold: 'Золото залечит раны. Мир.', demand: 'Мы заплатим. Мир.' },
    ally: { honest: 'Моё слово крепче печати. Мы с вами.', _: 'Да будет союз: ваши враги — наши враги.' },
    pact: { _: 'Наши границы будут спокойны два года. Слово дано.' },
    tribute: { craven: 'Хорошо, хорошо! Только не войну…', _: '…Мы будем платить. Но не думайте, что мы это забудем.' } } };
function replyLine(kind, t, ok, o) { const tb = DREPLY[ok ? 'yes' : 'no'][kind] || {}; o = o || {};
  if (ok && kind === 'peace') { if (o.cede) return tb.cede; if (o.gold) return tb.gold; if (o.demand) return tb.demand; }
  for (const k of rulerOf(t).traits) if (tb[k]) return tb[k]; return tb._ || (ok ? 'Согласны.' : 'Нет.'); }
function verdictOf(a) { const L = a.lines.filter(l => a.ok ? l.v > 0 : l.v < 0).sort((p, q) => Math.abs(q.v) - Math.abs(p.v)).slice(0, 3);
  return (a.ok ? 'Согласие' : 'Отказ') + ' (итого ' + (a.sum > 0 ? '+' : '−') + Math.abs(a.sum) + ')' + (L.length ? ' · ' + (a.ok ? 'помогло' : 'главное') + ': ' + L.map(l => l.t + ' ' + (l.v > 0 ? '+' : '−') + Math.abs(l.v)).join(', ') : '') + '.'; }
function diploAnswer(t, ok, quote, verdict, toast) { UI.dres = { t, ok, quote, verdict, day: G.day, at: NOW }; if (toast && !(UI.win && UI.win.k === 'diplo')) UI.toast(toast); }
const rulerTN = t => rulerOf(t).title + ' ' + rulerOf(t).name;
function propose(kind, t, o) {
  const a = acceptance(kind, t, o), p = G.player.realm; o = o || {};
  if (a.lines[0] && a.lines[0].v === -999) { const n = Math.max(1, G.realms[t].asked - G.day); diploAnswer(t, 'wait', 'Мы уже дали вам ответ. Ваших гонцов примем не раньше, чем ' + inDays(n) + '.', 'Повторить предложение можно ' + inDays(n) + '. Пока что — подарки и время.', rulerTN(t) + ': «Мы уже ответили».'); return a; }
  G.realms[t].asked = G.day + (a.ok ? 0 : 5);
  if (!a.ok) { log(rulerTN(t) + ' отклоняет наше предложение.', 'bad'); addOpn(t, p, kind === 'tribute' ? -12 : -2); let q = replyLine(kind, t, false, o), war = 0; if (kind === 'tribute' && rulerOf(t).traits.includes('proud') && R.f() < 0.25) { declareWar(t, p); war = 1; q += ' Это — война!'; }
    diploAnswer(t, 'no', q, verdictOf(a) + ' Отказ задел их: мнение о нас ' + (kind === 'tribute' ? '−12' : '−2') + '. Новое предложение — через 5 дн.' + (war ? ' Они объявили нам войну!' : ''), rulerTN(t) + ' отказывает' + (war ? ' — и объявляет войну!' : '.')); return a; }
  diploAnswer(t, 'ok', replyLine(kind, t, true, o), verdictOf(a), rulerTN(t) + ' ' + (rulerOf(t).fem ? 'согласна' : 'согласен') + '!');
  if (kind === 'peace') { if (o.cede || o.demand) makePeace(p, t, !!o.cede, o.demand || 0); else { if (o.gold) { G.realms[p].gold -= o.gold; G.realms[t].gold += o.gold; } makePeace(warScore(p, t) >= 0 ? p : t, warScore(p, t) >= 0 ? t : p, false); } }
  else if (kind === 'ally') { setRel(p, t, 'ally', 1); setRel(p, t, 'pact', 0); log('Заключён союз с державой ' + realmName(t) + '.', 'good'); addOpn(t, p, 10); }
  else if (kind === 'pact') { setRel(p, t, 'pact', G.day + DAYS_YEAR * 2); log('Пакт о ненападении с державой ' + realmName(t) + ' на 2 года.', 'good'); }
  else if (kind === 'tribute') { const amt = Math.max(1, Math.round(G.realms[t].inc * 0.2 * 10) / 10); (G.realms[t].tribute = G.realms[t].tribute || []).push({ to: p, amt, until: G.day + DAYS_YEAR }); (G.realms[p].tribute = G.realms[p].tribute || []).push({ to: p, amt, until: G.day + DAYS_YEAR, from: t }); addOpn(t, p, -20); log(realmName(t) + ' ' + rV(t, 'согласна', 'согласно', 'согласны') + ' платить дань: ' + amt + ' зол./день целый год.', 'good'); G.realms[p].prestige += 10; }
  if (typeof Snd !== 'undefined') Snd.sfx('coin'); if (typeof TUT !== 'undefined') TUT.ev('diplo', kind);
  return a;
}
function sendGift(t, amt) {
  const p = G.player.realm; if (G.realms[p].gold < amt) return false;
  G.realms[p].gold -= amt; G.realms[t].gold += amt; const k = rulerOf(t).traits.includes('greedy') ? 1.6 : 1;
  const gained = Math.round(amt / 4 * k * (G.rel[t][p].opn > 40 ? 0.5 : 1)); addOpn(t, p, gained);
  log('Дар (' + amt + ' зол.) отправлен: ' + realmName(t) + '. Мнение +' + gained + '.', 'good'); if (typeof Snd !== 'undefined') Snd.sfx('coin');
  diploAnswer(t, 'ok', k > 1 ? 'Золото всегда кстати. Мы этого не забудем.' : amt >= 100 ? 'Щедрый дар! Ваше имя здесь вспомнят добрым словом.' : 'Благодарим за дар.', 'Дар ' + amt + ' зол. · мнение о нас +' + gained + (G.rel[t][p].opn - gained > 40 ? ' (дары уже приелись — вполовину меньше).' : '.'), 'Дар принят: мнение +' + gained + '.'); return true;
}
// ---------- the seven comparisons (ch.1) ----------
function reckoning(t) {
  const p = G.player.realm, rp = rulerOf(p), rt = rulerOf(t);
  const avg = (r, f) => { const L = G.setts.filter(S => S.ctrl === r); return L.length ? L.reduce((s, S) => s + f(S), 0) / L.length : 0; };
  const armies = r => G.armies.filter(a => a.alive && a.realm === r && (a.kind === 'lord' || a.kind === 'player'));
  const xpOf = r => { const A = armies(r); let n = 0, s = 0; for (const a of A) for (const u of UT) { s += a.xp[u] * a.u[u]; n += a.u[u]; } return n ? s / n : 0; };
  const morOf = r => { const A = armies(r); return A.length ? A.reduce((s, a) => s + a.morale, 0) / A.length : 50; };
  const intelOK = hasInward(t);
  const L = [
    { q: 'Чей государь следует Пути?', d: 'Довольство подданных: процветание минус смута.', a: avg(p, S => S.prosp - G.provs[WD.setts[S.id].prov].unrest), b: avg(t, S => S.prosp - G.provs[WD.setts[S.id].prov].unrest) },
    { q: 'Чей полководец способнее?', d: 'Воинское искусство правителей.', a: rp.mar + traitSum(rp, 'mar'), b: rt.mar + traitSum(rt, 'mar') },
    { q: 'На чьей стороне Небо и Земля?', d: 'Время года и расстояние: зимой и издалека наступать трудно.', a: [0, 3, 1, -5][seasonOf(G.day)] - (() => { const pa = playerArmy(); if (!pa) return 0; let d = 1e9; for (const S of G.setts) if (S.ctrl === t) { const w = WD.setts[S.id]; d = Math.min(d, Math.hypot(w.x - pa.x, w.y - pa.y)); } return d > 45 ? 2 : 0; })(), b: 0 },
    { q: 'Где строже исполняются законы?', d: 'Боевой дух войск.', a: morOf(p), b: morOf(t) },
    { q: 'Чьё войско сильнее?', d: 'Совокупная мощь армий и гарнизонов.', a: realmPower(p), b: realmPower(t, p) },
    { q: 'Чьи воины лучше обучены?', d: 'Средний опыт воинов.', a: xpOf(p), b: xpOf(t) },
    { q: 'Где справедливее награды и наказания?', d: 'Казна и доход: платят ли войскам вовремя.', a: G.realms[p].gold / 10 + ((G.realms[p].inc || 0) - (G.realms[p].exp || 0)) * 5, b: G.realms[t].gold / 10 + ((G.realms[t].inc || 0) - (G.realms[t].exp || 0)) * 5 },
  ];
  let wins = 0; for (const l of L) { l.a = l.a || 0; l.b = l.b || 0; l.tie = Math.abs(l.a - l.b) < 1e-6 * Math.max(1, Math.abs(l.a)); l.win = !l.tie && l.a > l.b; l.known = intelOK || l.q.indexOf('сильнее') < 0 || true; if (l.win) wins++; }
  return { lines: L, wins, intel: intelOK };
}
// ---------- council of the crown (diplomatic victory) ----------
function councilScore(x, c) {
  const rx = rulerOf(x); const share = r => realmPower(r) / Math.max(1, [0, 1, 2, 3, 4].filter(alive).reduce((s, k) => s + realmPower(k), 0));
  if (c === x) return 18 + (rx.traits.includes('proud') ? 22 : 0) + (G.realms[x].prestige || 0) * 0.15 + share(x) * 60;
  const r = G.rel[x][c]; let s = opinionOf(x, c) * 0.8 + (r.ally ? 20 : 0) - (r.war ? 200 : 0) + (G.realms[c].prestige || 0) * 0.12 + share(c) * 40;
  if (c === G.player.realm) s += Math.min(30, (G.realms[c].fear || 0) * 0.5);
  return s;
}
function councilVotes() {
  const v = [];
  for (let x = 0; x < 5; x++) {
    if (!alive(x)) continue; if (x === G.player.realm) { v.push({ x, c: x }); continue; }
    let best = x, bs = -1e9; for (let c = 0; c < 5; c++) { if (!alive(c)) continue; const s = councilScore(x, c); if (s > bs) { bs = s; best = c; } }
    v.push({ x, c: best, s: bs });
  }
  return v;
}
function holdCouncil() {
  const v = councilVotes(); const n = v.filter(e => e.c === G.player.realm).length;
  G.lastCouncil = { day: G.day, votes: v, n };
  log('Совет короны собрался. За короля ' + rulerOf(G.player.realm).name + ' — ' + n + ' ' + plural(n, 'голос', 'голоса', 'голосов') + ' из ' + v.length + '.', n >= 3 ? 'good' : 'title');
  if (typeof UI !== 'undefined') UI.alert('council', v);
  if (n >= 3) G.over = { win: true, kind: 'word', why: 'Совет короны признал короля ' + rulerOf(G.player.realm).name + ' Верховным королём. «Лучшая победа — победа без сражения».' };
}
function checkVictory() {
  const p = G.player.realm; if (G.over) return;
  const caps = [0, 1, 2, 3, 4].map(r => G.realms[r].capital);
  const own = G.setts[caps[p]].ctrl === p; const others = caps.filter((c, r) => r !== p && G.setts[c].ctrl === p).length;
  G.capsHeld = others;
  if (own && others >= 2) G.over = { win: true, kind: 'sword', why: 'Король держит свою столицу и две чужие. Земли склонились перед мечом.' };
}
