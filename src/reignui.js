'use strict';
// ===== REIGN UI (v3.5): the chronicle window (T), the end of a chapter, and the learning of the ages on compact cards =====
function fitS(s, w, o) { o = o || { f: 's' }; if (tw(s, o) <= w) return s; while (s.length > 1 && tw(s + '…', o) > w) s = s.slice(0, -1); return s + '…'; }
// ---------- Знания: six tiers; the last two open with the ages ----------
drawTechWin = function (w) { const X = 14, Y = 21, WW = 612, HH = 326, T = G.tech, e = eraNow(); winFrame(X, Y, WW, HH, 'Знания королевства', false); w.mode = w.mode || 'intent';
  const m = seatChar('magister'); let y = Y + 22;
  if (m) { const sp = clamp(m.lrn / 9, 0.3, 2.4) * orderEff(m, 'magister', w.mode) * (hasTech('printing') ? 1.25 : 1); spr('i_flask', X + 16, y); txt(m.name + ' · ≈' + sp.toFixed(1) + ' в день', X + 26, y, PAL.w, { f: 's' });
    hit(X + 14, y - 2, 150, 11, { id: 'tc_mag', tip: ['Магистр ' + m.name + ' · Книга ' + m.lrn, 'Столько очков знаний в день он даёт по приказу или по просьбе.'].concat(T.bank >= 1 ? [{ t: 'Записи без темы: ' + Math.round(T.bank) + ' — уйдут на следующее знание.', c: UIC.dim }] : []) }); }
  else txt('Нет магистра — назначьте его в Совете.', X + 16, y, UIC.bad, { f: 's' });
  const E = ERAS[e], nx = ERAS[e + 1], ex = X + 200; spr('i_hourglass', ex, y); txt(E.n, ex + 10, y, PAL.y, { f: 's' });
  hit(ex - 2, y - 2, 20 + tw(E.n, { f: 's' }), 11, { id: 'tc_era', tip: [E.n, nx ? 'Следующая — ' + nx.n + ' (с ' + nx.y + '-го года): ' + inDays(eraDays(e + 1)) + '.' : 'Последняя эпоха.', { t: 'Новые знания приходят со временем: чем дольше правление, тем дальше эпоха.', c: UIC.dim }] });
  modeToggle(X + WW - 188, y - 3, 170, w.mode, md => { w.mode = md; }); y += 14;
  BRANCHES.forEach((B, b) => { const x = X + 12 + b * 148; spr(B.ic, x, y + 1); txt(B.n, x + 10, y, PAL.y);
    branchTechs(b).forEach((k, r) => { const t = TECH[k], er = t.era || 0, st = !hasTech(k) && er > e ? 'era' : techState(k), yy = y + 12 + r * 44, cw = 144, chh = 41, dim = st === 'locked' || st === 'era';
      rect(x, yy, cw, chh, st === 'done' ? '#2e4a24' : st === 'cur' ? '#5a4030' : st === 'avail' ? '#3a2a1e' : st === 'era' ? '#1c1622' : '#211812');
      strokeR(x, yy, cw, chh, st === 'cur' ? '#f7d35c' : st === 'avail' ? '#c9a060' : st === 'done' ? '#7fb04c' : st === 'era' ? '#3e3456' : '#4a3424');
      txt(t.n, x + 4, yy + 3, dim ? '#7a6a5a' : '#fff');
      if (st === 'era') { spr('i_hourglass', x + cw - 18, yy + 3); txt(ERAS[er].s, x + cw - 4, yy + 3, '#8a80b0', { al: 'r', f: 's' }); } else txt(st === 'done' ? '✓' : t.cost + '', x + cw - 4, yy + 3, st === 'done' ? UIC.good : P3.lab, { al: 'r', f: 's' });
      txt(TECH_SD[k] || '', x + 4, yy + 15, dim ? '#6a5a4a' : '#d8c8a8', { f: 's' });
      if (st === 'cur') bar(x + 4, yy + chh - 10, cw - 8, 6, (T.prog || 0) / t.cost, '#e0a630');
      else txt(st === 'era' ? 'с ' + ERAS[er].y + '-го года' : st === 'locked' ? 'после «' + TECH[t.req].n + '»' : st === 'avail' ? 'щелчок — изучать' : st === 'done' ? 'изучено' : '', x + 4, yy + 27, st === 'avail' ? '#c9a060' : st === 'era' ? '#8a80b0' : '#6a5a4a', { f: 's' });
      hit(x, yy, cw, chh, { id: 'tc_' + k, cursor: st === 'avail', tip: [t.n, t.d, st === 'era' ? { t: 'Эпоха ' + ERAS[er].s + ' — ' + ERAS[er].n + ': ' + inDays(eraDays(er)), c: '#b8b0e0' } : st === 'locked' ? { t: 'Сначала: «' + TECH[t.req].n + '»', c: UIC.warn } : st === 'done' ? { t: 'Изучено', c: UIC.good } : st === 'cur' ? { t: 'Изучается: ' + Math.round(T.prog || 0) + ' из ' + t.cost, c: UIC.dim } : { t: 'Щелчок — поручить магистру', c: UIC.dim }],
        onClick: () => { if (st !== 'avail') return; if (!m) { UI.toast('Нет магистра.'); return; } if (giveOrder('magister', 'research', w.mode, k)) { G.tech.cur = k; UI.toast('Магистр взялся за «' + t.n + '».'); } } }); }); }); };
// ---------- the chronicle window ----------
WIN_EXT.chron = function (w) { const X = 14, Y = 21, WW = 612, HH = 326, R0 = reignInit(), k = kingC(); winFrame(X, Y, WW, HH, 'Летопись правления', true); if (!R0) return;
  let y = Y + 24; const ep = epithet(R0, k);
  spr('i_crown', X + 16, y + 1); txt(rTitle(k) + ' ' + k.name + ' «' + ep.n + '»', X + 28, y, INK);
  hit(X + 14, y - 2, 280, 12, { id: 'ch_ep', tip: ['Так летопись назовёт ' + (k.fem ? 'королеву' : 'короля') + ' сейчас', ep.why + '.', { t: 'Прозвище меняют дела: войны, победы, крепости, знания, охота, пиры.', c: UIC.dim }] });
  txt('Глава ' + ROMAN[R0.n - 1] + ' · ' + yrs(k.age) + ' · на троне ' + reignLen(G.day - R0.from), X + 28, y + 11, INK2, { f: 's' });
  const e = eraNow(), E = ERAS[e], nx = ERAS[e + 1]; spr('i_hourglass', X + WW - 196, y + 1); txt(E.n, X + WW - 185, y, INK, { f: 's' }); txt(nx ? 'новая эпоха ' + inDays(eraDays(e + 1)) : 'последняя эпоха', X + WW - 185, y + 10, INK2, { f: 's' });
  hit(X + WW - 198, y - 2, 184, 22, { id: 'ch_era', tip: [E.n, nx ? 'Следующая — ' + nx.n + ': новые знания у магистра.' : 'Последняя эпоха.'] });
  y += 26; rect(X + 12, y - 4, WW - 24, 1, '#c9b07a');
  const L = R0.chron.slice().reverse(), rows = 21, sc = wheelScroll(w, L.length - rows), LW = 366;
  L.slice(sc, sc + rows).forEach((c, i) => { const yy = y + i * 12; txt(shortDate(c.d), X + 16, yy, INK2, { f: 's' }); spr('i_' + c.ic, X + 76, yy); const t = fitS(c.t, LW - 78);
    txt(t, X + 86, yy, c.imp >= 3 ? '#7a1a1a' : INK, { f: 's' }); hit(X + 12, yy - 2, LW, 12, { id: 'row_ch' + i, tip: t !== c.t ? [c.t, dateStr(c.d)] : [dateStr(c.d)] }); });
  if (!L.length) txt('Летопись пока пуста.', X + 16, y, INK2, { f: 's' });
  if (L.length > rows) txt((sc + 1) + '–' + Math.min(L.length, sc + rows) + ' из ' + L.length + ' · колесо мыши листает', X + 16, Y + HH - 14, INK2, { f: 's' });
  rect(X + 386, y - 2, 1, HH - 54, '#d8c49a');
  const RX = X + 396; let ry = y; const s = R0.st; txt('Деяния', RX, ry, INK); ry += 12;
  [['i_sword', 'Войны', s.wars], ['i_seal', 'Миры', s.peace], ['i_star', 'Победы', s.won], ['i_flag', 'Поражения', s.lost], ['i_castle', 'Взято крепостей', s.took], ['i_house', 'Потеряно', s.fell],
    ['i_flask', 'Знания', s.techs], ['i_antler', 'Трофеи охоты', s.hunts], ['i_family', 'Дети', s.kids], ['i_cup', 'Пиры, турниры', s.feasts + s.tours]].forEach(([ic, n, v], i) => {
    const cx = RX + (i % 2) * 104, cy = ry + Math.floor(i / 2) * 13; spr(ic, cx, cy); txt(n, cx + 10, cy, INK2, { f: 's' }); txt(String(v || 0), cx + 98, cy, INK, { al: 'r', f: 's' }); });
  ry += 5 * 13 + 8;
  if (R0.goal) { txt('Завет', RX, ry, INK); if (R0.goal.done) txt('✓ исполнен', RX + 202, ry, '#3a6a2a', { al: 'r', f: 's' }); ry += 11; ry += para(R0.goal.t, RX, ry, 202, R0.goal.done ? '#3a6a2a' : INK2, { f: 's', lh: 9 }) + 8; }
  const P = (G.reigns || []).slice(-5).reverse(); if (P.length) { txt('Прежние главы', RX, ry, INK); ry += 11;
    P.forEach((A, i) => { txt(fitS(ROMAN[A.n - 1] + '. ' + A.name + ' «' + A.ep.n + '»', 160), RX, ry, INK2, { f: 's' }); txt(yearOf(A.from) + '–' + yearOf(A.to) + ' г.', RX + 202, ry, INK2, { al: 'r', f: 's' });
      hit(RX - 2, ry - 2, 206, 11, { id: 'ch_p' + i, tip: [(A.fem ? 'Королева ' : 'Король ') + A.name + ' «' + A.ep.n + '»', 'На троне ' + reignLen(A.to - A.from) + (A.why ? ' · ' + A.why : '')].concat(A.top.map(c => ({ t: shortDate(c.d) + ' — ' + c.t, c: UIC.dim }))) }); ry += 10; }); } };
// ---------- the end of a chapter ----------
MODALS.reign = function (m) { const A = m.d.A, k = kingC(), H0 = 272; const [x, y] = dlg(440, H0, 'Конец главы ' + ROMAN[A.n - 1]);
  const cx = x + 14, cy = y + 22, cw = 412, ch = 176; charterBox(cx, cy, cw, ch);
  txt('Летопись правления', cx + cw / 2, cy + 8, '#7a1a1a', { al: 'c' });
  txt((A.fem ? 'Королева ' : 'Король ') + A.name + ' «' + A.ep.n + '»', cx + cw / 2, cy + 21, INK, { al: 'c' });
  txt(yearOf(A.from) + '–' + yearOf(A.to) + ' г. · на троне ' + reignLen(A.to - A.from) + (A.why ? ' · ' + (A.fem ? 'умерла' : 'умер') + ' в ' + yrs(A.age) + ': ' + A.why : ''), cx + cw / 2, cy + 33, INK2, { al: 'c', f: 's' });
  const s = A.st, cells = [['i_sword', s.wars, 'войны'], ['i_star', s.won, 'победы'], ['i_flag', s.lost, 'поражения'], ['i_castle', s.took, 'взято крепостей'], ['i_flask', s.techs, 'знания'], ['i_antler', s.hunts, 'трофеи'], ['i_family', s.kids, 'дети']], sx = Math.round(cx + cw / 2 - cells.length * 28 / 2);
  cells.forEach(([ic, v, n], i) => { spr(ic, sx + i * 28, cy + 46); txt(String(v || 0), sx + i * 28 + 10, cy + 46, INK, { f: 's' }); hit(sx + i * 28 - 2, cy + 44, 26, 11, { id: 'rg_s' + i, tip: n }); });
  A.top.forEach((c, i) => { const yy = cy + 62 + i * 12; txt(shortDate(c.d), cx + 16, yy, INK2, { f: 's' }); spr('i_' + c.ic, cx + 76, yy); txt(fitS(c.t, cw - 100), cx + 86, yy, INK, { f: 's' }); });
  txt('Летописец', cx + cw - 156, cy + ch - 22, INK2, { f: 's' }); drawSignature('брат Ансельм', cx + cw - 108, cy + ch - 24, 1); drawSeal(cx + 30, cy + ch - 26, 1, 0);
  const ny = cy + ch + 8, R1 = G.reign; spr('i_crown', x + 18, ny + 1); txt('Глава ' + ROMAN[A.n] + ': ' + rTitle(k).toLowerCase() + ' ' + k.name + ', ' + yrs(k.age) + (G.court.regent >= 0 ? ' · регент: ' + regentName() : ''), x + 30, ny, INK);
  if (R1 && R1.goal) txt(fitS('Завет: ' + R1.goal.t, 400), x + 30, ny + 12, INK2, { f: 's' });
  btn('rg_go', x + 20, y + H0 - 24, 200, 16, { label: 'Начать новую главу', ic: 'i_crown', onClick: () => UI.close() });
  btn('rg_ch', x + 230, y + H0 - 24, 190, 16, { label: 'Летопись целиком (T)', ic: 'i_chron', onClick: () => { UI.close(); UI.open({ k: 'chron' }); } }); };
// the dynasty ended: the last page of the chronicle on the final screen
{ const om = drawOverModal; drawOverModal = function () { om(); const A = G.over && G.over.reign; if (!A) return; const x = Math.round(W / 2 - 210), y = Math.round(H / 2 - 100), s = A.st;
  txt(fitS('Летопись: ' + (A.fem ? 'королева ' : 'король ') + A.name + ' «' + A.ep.n + '» · ' + yearOf(A.from) + '–' + yearOf(A.to) + ' г.', 340), x + 64, y + 116, '#e8d8b0', { f: 's' });
  txt('Войн ' + s.wars + ' · побед ' + s.won + ' · поражений ' + s.lost + ' · крепостей +' + s.took + ' / −' + s.fell + ' · знаний ' + s.techs, x + 64, y + 128, '#c8b898', { f: 's' });
  A.top.slice(-3).forEach((c, i) => txt(fitS(c.t, 340), x + 64, y + 142 + i * 9, '#a89878', { f: 's' })); }; }
// ---------- the treatise: new pages ----------
REFS.push(
  { s: 'Летопись', t: 'Летопись правления', b: () => 'Игра — это жизнь одного государя. Летопись (T) сама записывает главное: войны и миры, битвы, взятые и потерянные крепости, рождения и смерти, знания, трофеи охоты, турниры.\n' +
    'По делам летопись даёт прозвище: Завоеватель, Победоносный, Просвещённый, Ловчий, Щедрый, Миролюбивый… Оно меняется, пока король жив.\n' +
    'Когда король умирает, глава закрывается: итог правления, прозвище и главные дела. Если есть наследник, начинается новая глава — со своим заветом: окончить войну отца, вернуть утраченное, дорасти до трона или освоить знания новой эпохи.' },
  { s: 'Эпохи', t: 'Эпохи и знания', b: () => 'Время идёт и меняет мир. ' + ERAS.map(E => E.n + ' — с ' + E.y + '-го года').join('; ') + '.\n' +
    'С новой эпохой магистру открываются новые знания (окно «Знания», J): ' + Object.keys(TECH).filter(k => TECH[k].era).map(k => TECH[k].n + ' (' + ERAS[TECH[k].era].s + ')').join(', ') + '.' },
  { s: 'Тяготы похода', t: 'Тяготы похода', b: () => 'Дорога — сама по себе враг.\n• Распутица: весной, когда сходит снег, и после дождей земля раскисает — вне трактов войска идут медленнее, обозы вязнут. Солнце и ветер подсушат дороги, мороз скуёт.\n' +
    '• Мороз: зимой в поле и в горах воины обмораживаются. Под крышей своих крепостей мороз не страшен; укреплённый лагерь, костры и палатки в обозе спасают многих.\n' +
    '• Реки: брод мочит провиант и стрелы, переправа вплавь уносит людей, особенно в половодье и после дождей. Мосты безопасны. Зимой можно идти по льду — но лёд иногда проламывается.\n' +
    '• Ополчение служит сорок дней вне своих земель. За пять дней до срока его можно задержать за плату или распустить; иначе ополченцы начнут уходить сами. Дома срок понемногу восстанавливается.' });
