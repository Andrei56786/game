'use strict';
// ===== STUDY (v3.6): the magister is never idle. After the king's first word he chooses the next subject himself — by the needs of the
// realm and by his own leanings; with nothing to study he gathers «вдохновение», which hastens the work and above all opens the learning
// of a later age before its time (dearer, and the experiments cost gold) =====
Object.assign(ICONS, { insp: '..a..|.aAa.|..A..|.wJw.|.wJw.|.JJJ.' });
// what the magister's own nature draws him to: [branch, why]
const LEAN = { greedy: [0, 'любит считать золото'], generous: [0, 'хочет, чтобы земля богатела'], patient: [0, 'терпеливо улучшает поля'], brave: [1, 'смолоду любит оружие'], wrathful: [1, 'горяч и думает о войне'],
  reckless: [1, 'увлечён машинами войны'], cunning: [2, 'любит тайны'], cautious: [2, 'осторожен и ищет защиты от ядов'], wise: [2, 'тянется к тайному знанию'], honest: [3, 'чтит закон'], proud: [3, 'хочет порядка в королевстве'] };
// inspiration a day: a free magister reads, writes to fellow scholars, copies old books; busy with another order — a little
function studyRate(m, busy) { if (!m) return 0; return clamp(m.lrn / 20, 0.2, 1) * (m.traits.includes('wise') ? 1.2 : 1) * (m.motive && m.motive.k === 'lore' ? 1.2 : 1) * (busy ? 0.3 : 1) * (projDone('libwing') ? 1.15 : 1) * (projDone('observatory') ? 1.1 : 1); }
function studyDaily() { const T = techInit(), C = G.court, m = seatChar('magister'); if (!T || !m) return; const o = C.orders.magister;
  if (o && o.k === 'research') return;
  T.insp = Math.min(INSP_MAX, (T.insp || 0) + studyRate(m, !!o));
  if (o || !T.auto || (!T.first && T.insp < INSP_MAX)) return; // until the king's first word he waits — unless inspiration overflows
  const pk = studyPick(m); if (pk) studyStart(pk.k, pk.why); }
// what the realm needs now: [weight per branch] and the reason in words
function studyNeeds() { const N = [0, 0, 0, 0], why = ['', '', '', ''], r = G.realms[0], C = G.court, k = kingC();
  if (r.gold < 150 || (r.inc || 0) < (r.exp || 0)) { N[0] += 1.2; why[0] = r.gold < 150 ? 'казна пустеет' : 'расходы выше доходов'; } else if ((C.grain || 0) < granRes() || granFamine()) { N[0] += 0.7; why[0] = 'амбары пустеют'; }
  if (warsOf(0).length) { N[1] += 1.2; why[1] = 'идёт война'; }
  if (k && (k.wound > G.day || k.ill)) { N[2] += 0.8; why[2] = 'государь нездоров'; } else if (C.secrets.some(s => s.known && (s.k === 'spy' || s.k === 'plot'))) { N[2] += 0.8; why[2] = 'при дворе завелись шпионы'; }
  const P = G.provs.filter(p => G.setts[WD.provs[p.id].seat].owner === 0), u = P.length ? P.reduce((s, p) => s + p.unrest, 0) / P.length : 0; if (u > 18) { N[3] += 1; why[3] = 'в провинциях смута'; }
  return { N, why }; }
function magLean(m) { const L = [0, 0, 0, 0], why = ['', '', '', '']; for (const t of m.traits) { const e = LEAN[t]; if (e) { L[e[0]] += 0.5; why[e[0]] = why[e[0]] || 'магистр ' + e[1]; } }
  if (m.motive && m.motive.k === 'lore') { const b = m.motive.b || 0; L[b] += 0.4; why[b] = why[b] || 'магистр давно мечтает об этом'; } return { L, why }; }
// the choice: what is needed and what he loves, the nearer to the end the better; a later age only with enough inspiration (and gold)
function studyPick(m) { const T = G.tech, nd = studyNeeds(), ln = magLean(m);
  const sc = k => { const b = TECH[k].b, left = Math.max(0, techCost(k) - techPP(k)); return (1 + nd.N[b] + ln.L[b] + (techPP(k) > 0 ? 0.6 : 0)) / Math.sqrt(left + 4); };
  let L = Object.keys(TECH).filter(techAvail), early = 0;
  if (!L.length) { early = 1; L = Object.keys(TECH).filter(techAhead).filter(k => G.realms[0].gold >= 200 && ((T.insp || 0) * 2 >= 0.6 * (techCost(k) - TECH[k].cost) || techEraK(k) <= 1.35)); }
  if (!L.length) return null; const k = L.sort((a, b) => sc(b) - sc(a))[0], b = TECH[k].b;
  const why = early ? 'вдохновения хватит, чтобы опередить время' : nd.why[b] || ln.why[b] || (techPP(k) > 0 ? 'начатое надо закончить' : 'это ближе всего к цели');
  return { k, why }; }
function studyStart(k, why) { const C = G.court, m = seatChar('magister'), T = techInit(); if (!m || !TECH[k]) return false;
  const o = { k: 'research', mode: 'intent', t: k, day0: G.day, dur: 999, prog: 0, self: 1 }; o.eff = orderEff(m, 'magister', 'intent') * 0.9; C.orders.magister = o;
  T.cur = k; T.by = 'self'; T.why = why || ''; T.since = G.day;
  addReport('magister', 'Сам взялся за «' + TECH[k].n + '»' + (why ? ': ' + why : '') + (techAhead(k) ? '. Раньше своего времени — опыты будут стоить ' + techGoldDay(k) + ' зол. в день' : '') + '.');
  return true; }
// experiments of a later age cost gold every day; with an empty treasury the work stands
function studyPay(k) { const g = k && TECH[k] ? techGoldDay(k) : 0; if (!g) return true; const r = G.realms[0], T = G.tech;
  if (r.gold < g) { if (T.stall !== G.day - 1) log('Магистр: на опыты нет золота — работа над «' + TECH[k].n + '» стоит.', 'warn'); T.stall = G.day; return false; }
  r.gold -= g; T.spent = (T.spent || 0) + g; return true; }
function studyReport(c) { const T = techInit(), k = T.cur;
  if (k && TECH[k]) return 'Изучаем «' + TECH[k].n + '»: ' + Math.round(techFrac(k) * 100) + '%' + (techAhead(k) ? ', раньше своего времени — опыты стоят ' + techGoldDay(k) + ' зол. в день' : '') + '.' + (T.by === 'self' && T.why ? ' Взялся сам: ' + T.why + '.' : '');
  return 'Сейчас без темы: читаю, пишу учёным собратьям. Вдохновения ' + Math.round(T.insp || 0) + ' из ' + INSP_MAX + '.' + (T.auto && T.first ? ' Как только найду дело по силам — возьмусь сам.' : ' Жду вашего слова, государь.'); }
// a rough estimate of days left for the current subject
function studyDays(k, m, mode) { if (!m || !k) return 0; const sp = clamp(m.lrn / 9, 0.3, 2.4) * orderEff(m, 'magister', mode) * (hasTech('printing') ? 1.25 : 1) * (projDone('libwing') ? 1.15 : 1) * (projDone('observatory') ? 1.05 : 1);
  let left = Math.max(0, techCost(k) - techPP(k)), d = 0, ins = G.tech.insp || 0; const ah = techAhead(k);
  while (left > 0 && d < 999) { const u = Math.min(ins, ah ? 1 : 0.75); ins -= u; left -= sp + u * (ah ? 2 : 1); d++; } return d; }
// ---------- Знания: six tiers, the last two open with the ages — or earlier, at a price ----------
drawTechWin = function (w) { const X = 14, Y = 21, WW = 612, HH = 326, T = techInit(), e = eraNow(); winFrame(X, Y, WW, HH, 'Знания королевства', false); w.mode = w.mode || 'intent';
  const m = seatChar('magister'), o = G.court.orders.magister; let y = Y + 22;
  if (m) { const sp = clamp(m.lrn / 9, 0.3, 2.4) * orderEff(m, 'magister', w.mode) * (hasTech('printing') ? 1.25 : 1) * (projDone('libwing') ? 1.15 : 1) * (projDone('observatory') ? 1.05 : 1);
    spr('i_flask', X + 16, y); txt(fitS(m.name, 110) + ' · ≈' + sp.toFixed(1).replace('.', ',') + ' в день', X + 26, y, PAL.w, { f: 's' });
    hit(X + 14, y - 2, 176, 11, { id: 'tc_mag', tip: ['Магистр ' + m.name + ' · Книга ' + m.lrn, 'Столько очков знаний в день он даёт по ' + (w.mode === 'order' ? 'приказу' : 'замыслу') + '. Сам, без вашего слова, — чуть меньше (×0,9).', { t: 'Ускоряют: библиотека, обсерватория, книгопечатание и вдохновение.', c: UIC.dim }] }); }
  else txt('Нет магистра — назначьте его в Совете.', X + 16, y, UIC.bad, { f: 's' });
  const E = ERAS[e], nx = ERAS[e + 1], ex = X + 200; spr('i_hourglass', ex, y); txt(E.n, ex + 10, y, PAL.y, { f: 's' });
  hit(ex - 2, y - 2, 20 + tw(E.n, { f: 's' }), 11, { id: 'tc_era', tip: [E.n, nx ? 'Следующая — ' + nx.n + ' (с ' + nx.y + '-го года): ' + inDays(eraDays(e + 1)) + '.' : 'Последняя эпоха.', { t: 'Знания будущей эпохи можно изучать и раньше: чем дальше до неё, тем дороже, и опыты стоят золота.', c: UIC.dim }] });
  modeToggle(X + WW - 188, y - 3, 170, w.mode, md => { w.mode = md; }); y += 13;
  // inspiration and what the magister is doing
  const ins = T.insp || 0, ir = studyRate(m, !!(o && o.k !== 'research')); spr('i_insp', X + 17, y - 1); txt('Вдохновение', X + 26, y, '#f0d890', { f: 's' }); bar(X + 86, y + 1, 70, 6, ins / INSP_MAX, '#f0c050'); txt(Math.floor(ins) + '/' + INSP_MAX, X + 160, y, P3.lab, { f: 's' });
  hit(X + 14, y - 2, 176, 11, { id: 'tc_insp', tip: ['Вдохновение: ' + Math.floor(ins) + ' из ' + INSP_MAX, 'Когда магистру нечего изучать или он занят другим поручением, он читает, пишет учёным собратьям и копит вдохновение' + (m && !(o && o.k === 'research') ? ' (+' + ir.toFixed(2).replace('.', ',') + ' в день)' : '') + '.',
    'Потом оно идёт в дело: до 0,75 очка в день сверх обычной работы. Знания будущих эпох оно ускоряет вдвое — 1 очко вдохновения даёт 2 очка знаний.', { t: 'Излишек законченного знания наполовину становится вдохновением.', c: UIC.dim }] });
  let st = '', sc = PAL.w, tip = null; const k0 = T.cur && TECH[T.cur] ? T.cur : null;
  if (!m) { st = 'Знания стоят.'; sc = UIC.bad; }
  else if (k0) { const d = studyDays(k0, m, o && o.self ? 'intent' : (o && o.mode) || w.mode); st = 'Изучает «' + TECH[k0].n + '» · ≈' + d + ' дн.' + (T.by === 'self' ? ' · выбрал сам' : ''); sc = T.stall >= G.day - 1 && techAhead(k0) ? UIC.bad : '#f4e4b8';
    tip = [TECH[k0].n, T.by === 'self' ? 'Магистр выбрал сам' + (T.why ? ': ' + T.why + '.' : '.') : 'По вашему слову.', techAhead(k0) ? { t: 'Раньше своего времени: опыты стоят ' + techGoldDay(k0) + ' зол. в день' + (T.stall >= G.day - 1 ? ' — в казне пусто, работа стоит!' : '.'), c: T.stall >= G.day - 1 ? UIC.bad : '#b8b0e0' } : { t: 'Щелчок по другому знанию — сменить тему; начатое не пропадёт.', c: UIC.dim }]; }
  else if (o) { st = 'Занят другим поручением — вдохновение копится медленно.'; sc = UIC.dim; }
  else { st = T.auto && T.first ? 'Без темы: ждёт, пока хватит вдохновения на новое.' : 'Ждёт вашего слова — пока копит вдохновение.'; sc = '#d8c8a8'; }
  txt(fitS(st, 214, { f: 's' }), ex, y, sc, { f: 's' }); if (tip) hit(ex - 2, y - 2, 218, 11, { id: 'tc_cur', tip });
  btn('tc_auto', X + WW - 188, y - 3, 170, 13, { label: (T.auto ? '✓ ' : '') + 'Сам выбирает следующее', style: T.auto ? 'wood' : 'dark', active: !!T.auto,
    tip: ['Сам выбирает следующее', 'Закончив знание, магистр сам берётся за следующее — по нуждам королевства (казна, война, смута, здоровье государя) и по своему нраву.', 'Выключите — и он будет ждать вашего слова, копя вдохновение.', { t: 'Знания будущей эпохи он берёт сам, только если хватает вдохновения и в казне есть 200 золотых.', c: UIC.dim }],
    onClick: () => { T.auto = T.auto ? 0 : 1; UI.toast(T.auto ? 'Магистр сам выберет следующее знание.' : 'Магистр будет ждать вашего слова.'); } }); y += 15;
  BRANCHES.forEach((B, b) => { const x = X + 12 + b * 148; spr(B.ic, x, y + 1); txt(B.n, x + 10, y, PAL.y);
    branchTechs(b).forEach((k, r) => { const t = TECH[k], er = t.era || 0, s = techState(k), yy = y + 12 + r * 40, cw = 144, chh = 37, pp = techPP(k), cost = techCost(k);
      const dim = s === 'locked', far = er > e;
      rect(x, yy, cw, chh, s === 'done' ? '#2e4a24' : s === 'cur' ? (far ? '#40305a' : '#5a4030') : s === 'avail' ? '#3a2a1e' : s === 'ahead' ? '#251c32' : far ? '#1c1622' : '#211812');
      strokeR(x, yy, cw, chh, s === 'cur' ? '#f7d35c' : s === 'avail' ? '#c9a060' : s === 'done' ? '#7fb04c' : s === 'ahead' ? '#7a68b0' : far ? '#3e3456' : '#4a3424');
      txt(fitS(t.n, cw - 34), x + 4, yy + 3, dim ? '#7a6a5a' : s === 'ahead' ? '#e0d8f8' : '#fff');
      if (s === 'done') txt('✓', x + cw - 4, yy + 3, UIC.good, { al: 'r', f: 's' });
      else if (far) { txt(String(cost), x + cw - 4, yy + 3, s === 'locked' ? '#6a6090' : '#b8a8e8', { al: 'r', f: 's' }); spr('i_hourglass', x + cw - 8 - tw(String(cost), { f: 's' }) - 8, yy + 3); }
      else txt(String(cost), x + cw - 4, yy + 3, P3.lab, { al: 'r', f: 's' });
      txt(fitS(TECH_SD[k] || '', cw - 8, { f: 's' }), x + 4, yy + 14, dim ? '#6a5a4a' : s === 'ahead' ? '#c8bce0' : '#d8c8a8', { f: 's' });
      if (s === 'cur') { bar(x + 4, yy + chh - 9, cw - 8, 6, techFrac(k), far ? '#a080e0' : '#e0a630'); }
      else { const L = s === 'locked' ? 'после «' + TECH[t.req].n + '»' : s === 'avail' ? (pp > 0 ? 'начато · щелчок — продолжить' : 'щелчок — изучать') : s === 'ahead' ? 'раньше срока ×' + techEraK(k).toFixed(1).replace('.', ',') + ' · ' + techGoldDay(k) + ' зол./день' : 'изучено';
        txt(fitS(L, cw - 8, { f: 's' }), x + 4, yy + 25, s === 'avail' ? '#c9a060' : s === 'ahead' ? '#a898d8' : '#6a5a4a', { f: 's' });
        if (pp > 0 && s !== 'done') rect(x + 2, yy + chh - 3, Math.round((cw - 4) * techFrac(k)), 1, s === 'ahead' ? '#a080e0' : '#c9a060'); }
      const tp = [t.n, t.d];
      if (s === 'locked') { tp.push({ t: 'Сначала: «' + TECH[t.req].n + '»', c: UIC.warn }); if (far) tp.push({ t: 'Эпоха ' + ERAS[er].s + ' — ' + ERAS[er].n + ' (с ' + ERAS[er].y + '-го года): ' + inDays(eraDays(er)), c: '#b8b0e0' }); }
      else if (s === 'done') tp.push({ t: 'Изучено', c: UIC.good });
      else { if (s === 'cur') tp.push({ t: 'Изучается: ' + Math.floor(pp) + ' из ' + cost, c: UIC.dim }); else if (pp > 0) tp.push({ t: 'Уже начато: ' + Math.floor(pp) + ' из ' + cost + ' — не пропадёт.', c: UIC.dim });
        if (far) tp.push({ t: 'Раньше своего времени: эпоха ' + ERAS[er].s + ' наступит ' + inDays(eraDays(er)) + '. Цена ×' + techEraK(k).toFixed(1).replace('.', ',') + ' (' + cost + ' вместо ' + t.cost + ') и ещё ' + techGoldDay(k) + ' зол. в день на опыты. Чем ближе эпоха, тем дешевле.', c: '#b8b0e0' }, { t: 'Вдохновение здесь идёт вдвое.', c: '#b8b0e0' });
        if (s !== 'cur') tp.push({ t: 'Щелчок — поручить магистру', c: UIC.dim }); }
      hit(x, yy, cw, chh, { id: 'tc_' + k, cursor: s === 'avail' || s === 'ahead', tip: tp,
        onClick: () => { if (s !== 'avail' && s !== 'ahead') return; if (!m) { UI.toast('Нет магистра.'); return; } if (giveOrder('magister', 'research', w.mode, k)) UI.toast('Магистр взялся за «' + t.n + '»' + (s === 'ahead' ? ' — раньше своего времени.' : '.')); } }); }); });
  txt('Щелчок по знанию — поручить магистру. Знания будущих эпох (фиолетовые) можно начать раньше срока — дороже и за золото.', X + 16, Y + HH - 14, UIC.dim, { f: 's' }); };
