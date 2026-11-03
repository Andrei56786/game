'use strict';
// ===== SCREENS v3: council, command, dynasty, knowledge, letters, secret service, settlement info, court help =====
const P3 = { lab: '#c8b898', sel: '#5a4030', row: 'rgba(255,255,255,0.045)', row2: 'rgba(0,0,0,0.14)', hi: '#fff2c8' };
const skCol = v => v >= 14 ? '#9fe07a' : v >= 10 ? PAL.w : v >= 6 ? '#e8c890' : '#e08a6a';
const yrs = n => n + ' ' + plural(n, 'год', 'года', 'лет');
function loySeen(c) { if (!c) return { v: 50, s: '—' }; const k = knownStat(c, 'loy'); if (k !== null) return { v: k, s: loyWord(k) + ' (досье ≈' + k + ')', exact: 1 };
  const show = clamp((c.loy || 50) + ((c.hon || 50) < 40 ? 18 : 6) + (((c.pseed || 7) % 17) - 8), 0, 100); return { v: show, s: 'кажется, ' + loyWord(show) }; }
function traitTip(c) { return c.traits.map(t => TRAITS[t] ? TRAITS[t].n + ': ' + TRAITS[t].d : t); }
function skillsLine(c, x, y, main) { let xx = x; for (const k of ['mar', 'dip', 'intr', 'stew', 'lrn']) { const s = SKN[k] + ' ' + (c[k] || 0); txt(s, xx, y, k === main ? PAL.y : skCol(c[k] || 0), { f: 's' }); hit(xx, y - 1, tw(s, { f: 's' }), 9, { id: 'sk' + k + x + y, tip: SKN[k] + ' — ' + SKD[k] }); xx += tw(s, { f: 's' }) + 8; } }
function modeTip(m) { return m === 'order' ? ['Приказ — исполнить в точности, как сказано.', 'Надёжно с неумелыми. Умелых (навык 13+) мелочная опека злит.', { t: hasTech('chancery') ? 'Канцелярия: обида втрое меньше.' : 'Изучите «Канцелярию», чтобы смягчить обиды.', c: UIC.dim }]
  : ['Замысел — объяснить цель, а средства оставить исполнителю.', 'Умелые справятся лучше, неумелые — хуже.', { t: '«Побеждает тот, у кого полководец способен, а государь не вмешивается» (гл. 3).', c: '#e8d8b0' }]; }
function modeToggle(x, y, w, cur, set) { const hw = Math.floor(w / 2) - 1; btn('md_o', x, y, hw, 13, { label: 'Приказ', active: cur === 'order', tip: modeTip('order'), onClick: () => set('order') }); btn('md_i', x + hw + 2, y, hw, 13, { label: 'Замысел', active: cur === 'intent', tip: modeTip('intent'), onClick: () => set('intent') }); }
function wheelScroll(w, max) { if (input.wheel && HOVER && (HOVER.id === 'blocker' || String(HOVER.id).startsWith('row'))) w.sc = clamp((w.sc || 0) + (input.wheel > 0 ? 1 : -1), 0, Math.max(0, max)); w.sc = clamp(w.sc || 0, 0, Math.max(0, max)); return w.sc; }
// ---------- Малый совет ----------
function tgtList(type) { const C = G.court, king = kingC();
  if (type === 'realm') return [1, 2, 3, 4].filter(t => alive(t)).map(t => ({ id: t, n: realmName(t), sub: opinionWord(opinionOf(t, 0)) + (G.rel[0][t].war ? ' · война' : '') }));
  if (type === 'house') return G.houses.filter(h => h.alive).map(h => ({ id: h.id, n: 'Дом ' + h.name, sub: loyWord(houseSeen(h)) }));
  if (type === 'sett') return G.setts.filter(S => S.owner === 0 && S.ctrl === 0 && WD.setts[S.id].type !== 'village').map(S => ({ id: S.id, n: WD.setts[S.id].name, sub: 'стены ' + S.walls }));
  if (type === 'tech') return Object.keys(TECH).filter(k => techAvail(k) || techAhead(k)).map(k => ({ id: k, n: TECH[k].n, sub: BRANCHES[TECH[k].b].n + ' · ' + TECH[k].cost }));
  if (type === 'child') return royalFamily().filter(c => c.age >= 4 && c.age < 18).concat(C.wards.map(charOf).filter(c => c && c.alive)).map(c => ({ id: c.id, n: c.name, sub: yrs(c.age) }));
  if (type === 'char') return G.chars.filter(c => c.alive && c.realm === 0 && c.id !== king.id && (c.atCourt || c.seat || c.role === 'lord' || c.role === 'knight') && c.age >= 16 && c.prison < 0).slice(0, 40).map(c => ({ id: c.id, n: c.name, sub: c.seat ? seatName(c.seat) : houseName(c.house) }));
  return []; }
function drawCouncilWin3(w) {
  const X = 14, Y = 21, WW = 612, HH = 326, C = G.court; winFrame(X, Y, WW, HH, 'Малый совет', false);
  { let tx = X + 12; [['Места и поручения', 104, 0], ['Кандидаты', 66, 3], ['Доклады', 60, 1], ['Суд', 40, 2]].forEach(([t, tw0, i]) => { btn('tab' + i, tx, Y + 22, tw0, 13, { label: t, style: 'parch', active: UI.tab === i, onClick: () => { UI.tab = i; UI.scroll = 0; }, tip: i === 2 ? ['Судебная книга', 'Все прошения, решённые при дворе: вами, верховным судьёй, регентом или писцами — и насколько мудро.'] : i === 3 ? ['Кандидаты', 'Все, кого можно посадить за стол совета, — такими, какими вы их знаете. Пташки Ока узнают о них больше.'] : null }); tx += tw0 + 2; }); } w.mode = w.mode || 'intent'; if (!w.seat) w.seat = 'chancellor';
  { // schedule + emergency call (right side of the tab row)
    const nd = nextCouncilDay(), why = canCallCouncil(), open = meetingOpen(), bw = Math.max(tw('Созвать совет сейчас'), tw('Сесть во главе стола')) + 12, bx = X + WW - 12 - bw, ty = Y + 25;
    let s = 'Ближайший совет: ' + WDAY_S[weekdayOf(nd)] + ', ' + (nd % DAYS_SEASON + 1) + ' д. · ' + inDays(nd - G.day);
    if (open) { const pr = councilPresence(); s = 'Совет собирается: за столом ' + pr.come.filter(e => seatedNow(e.n)).length + ' из ' + pr.come.length; }
    else if (C.meetDone === G.day) s = 'Совет сегодня уже заседал · следующий ' + inDays(nd - G.day);
    const sw = tw(s, { f: 's' }); txt(s, bx - 6, ty, '#e8d8b0', { al: 'r', f: 's' }); hit(bx - 6 - sw, ty - 1, sw, 9, { id: 'c_next', tip: calendarTip() });
    if (open && G.atCourt && SCREEN === 'court') sbtn('c_go', bx, Y + 22, bw, 'Сесть во главе стола', () => { UI.shut(); goCouncilSeat(); }, { tip: ['Пройти в зал совета и занять место короля.', { t: 'Совет начнётся, когда все советники сядут.', c: UIC.dim }] });
    else sbtn('c_call', bx, Y + 22, bw, 'Созвать совет сейчас', () => callCouncil(), { disabled: !!why, tip: why ? ['Созвать совет нельзя', { t: why + '.', c: UIC.warn }] : ['Экстренный сбор: советники, что сейчас в замке, придут в зал совета в течение часа.', isNight() ? { t: 'Ночью советники будут недовольны (верность −2).', c: UIC.warn } : { t: 'Не чаще раза в день. Если король не придёт за два часа — разойдутся, обидевшись.', c: UIC.dim }] }); }
  if (UI.tab === 2) { drawCourtBook(w, X, Y, WW, HH); return; } if (UI.tab === 3) { drawCandTab(w, X, Y, WW, HH); return; }
  if (UI.tab === 1) { let y = Y + 42; const L = C.reports.slice().reverse(); const sc = wheelScroll(w, L.length - 6);
    if (!L.length) txt('Докладов пока нет. Дайте поручения — советники отчитаются, когда закончат.', X + 16, y, P3.lab);
    for (const r of L.slice(sc)) { if (y > Y + HH - 24) break; txt(seatName(r.seat) + ' · ' + dateStr(r.day), X + 16, y, PAL.y, { f: 's' }); y += 9; y += para(r.text, X + 16, y, WW - 32, PAL.w, { f: 's', lh: 9 }) + 5; } return; }
  // seats list
  const y0 = Y + 40;
  SEATS.forEach((s, i) => { const yy = y0 + i * 40, c = seatChar(s.k), sel = w.seat === s.k, o = C.orders[s.k];
    rect(X + 10, yy, 200, 38, sel ? P3.sel : i % 2 ? P3.row : P3.row2); if (sel) strokeR(X + 10, yy, 200, 38, '#c9a060');
    if (c) drawPortrait(c, X + 13, yy + 3, 0.5); else { rect(X + 13, yy + 3, 24, 24, '#1a120c'); txt('?', X + 25, yy + 11, UIC.dim, { al: 'c' }); }
    spr(s.ic, X + 42, yy + 4); txt(s.n, X + 52, yy + 3, PAL.y); if (c) { const z = skSeen(c, s.sk); txt(SKN[s.sk] + ' ' + z.s, X + 206, yy + 3, z.kn ? skCol(z.v) : '#c8b898', { al: 'r', f: 's' }); }
    txt(c ? c.name : '— место пустует —', X + 42, yy + 14, c ? PAL.w : UIC.warn, { f: 's' });
    if (o) { const d = ordDef(s.k, o.k); bar(X + 42, yy + 26, 60, 6, o.k === 'research' && G.tech.cur ? techFrac(G.tech.cur) : o.prog || 0, '#e0a630'); txt((o.self ? 'сам: ' : '') + (d ? d.n : o.k), X + 106, yy + 25, o.self ? '#b8a888' : '#e8dcc0', { f: 's' }); }
    else if (c) txt('ждёт поручения', X + 42, yy + 25, UIC.dim, { f: 's' });
    hit(X + 10, yy, 200, 38, { id: 'row_cs' + s.k, cursor: true, onClick: () => { w.seat = s.k; w.pick = null; w.app = 0; w.sc = 0; } }); });
  // details
  const x0 = X + 220, wR = WW - 232; let y = y0; const s = seatDef(w.seat), c = seatChar(w.seat);
  txt(s.n, x0, y, PAL.y, { sc: 1 }); y += 11; y += para(s.d, x0, y, wR, P3.lab, { f: 's', lh: 9 }) + 4; hline(x0, y, wR, '#6a4428'); y += 5;
  if (!c || w.app) { drawCandidates(w, x0, y, wR, s); return; }
  drawPortrait(c, x0, y, 1); strokeR(x0 - 1, y - 1, 50, 50, '#c9a060');
  txt(charName(c), x0 + 56, y, PAL.w); txt((c.house >= 0 ? 'Дом ' + houseName(c.house) + ' · ' : '') + yrs(c.age), x0 + 56, y + 10, P3.lab, { f: 's' });
  const ts = traitsSeen(c), tl = ts.s; txt(tl, x0 + 56, y + 20, '#e8c890', { f: 's' }); hit(x0 + 56, y + 19, tw(tl, { f: 's' }), 9, { id: 'c_tr', tip: ts.all ? traitTip(c) : ['Нрав виден лишь отчасти', 'Пташки Ока донесут о нём больше.'] });
  skillsLine(c, x0 + 56, y + 30, s.sk); const ls = loySeen(c); txt('Верность: ' + ls.s, x0 + 56, y + 40, ls.v < 35 ? UIC.bad : ls.v > 65 ? UIC.good : PAL.w, { f: 's' });
  hit(x0 + 56, y + 39, 200, 9, { id: 'c_loy', tip: ['Верность скрыта: вы видите лишь лицо, которое вам показывают.', 'Нечестные кажутся вернее, чем есть.', { t: 'Точнее узнать — досье от Ока короля или пташки.', c: UIC.dim }] }); y += 54;
  const o = C.orders[w.seat];
  if (o) { const d = ordDef(w.seat, o.k); const pr = o.k === 'research' && G.tech.cur ? techFrac(G.tech.cur) : o.prog || 0; txt('Поручение: ' + (d ? d.n : o.k) + (o.k === 'research' && G.tech.cur ? ' «' + TECH[G.tech.cur].n + '»' : '') + ' · ' + (o.self ? 'сам, без поручения (сила ×' + selfK(w.seat).toFixed(2) + ')' : o.mode === 'order' ? 'приказ' : 'замысел'), x0, y, PAL.w, { f: 's' }); if (o.self) hit(x0, y - 1, wR - 76, 9, { id: 'c_self', tip: ['Советник взялся за дело сам', 'Без ваших поручений советник берётся за дешёвые и безопасные дела, тратит вдвое меньше золота, но и работает вполсилы. Если в казне меньше 200 золотых — ждёт.', { t: 'Чем дольше вы молчите (больше двух недель), тем хуже он угадывает вашу волю: сила падает до ×0.4.', c: UIC.warn }, { t: 'Любое ваше поручение заменит это дело.', c: UIC.dim }] }); bar(x0, y + 10, 140, 6, pr, '#e0a630'); txt(Math.round(pr * 100) + '%', x0 + 146, y + 9, P3.lab, { f: 's' });
    sbtn('c_cancel', x0 + wR - 70, y + 2, 70, 'Отменить', () => { if (o.k === 'research') G.tech.cur = null; C.orders[w.seat] = null; UI.toast('Поручение отменено.'); }); y += 22; }
  else { txt('Поручений нет. Если промолчите — советник возьмётся за дело сам, но вполсилы.', x0, y, UIC.dim, { f: 's' }); y += 12; }
  // mode
  txt('Как поручить:', x0, y + 3, P3.lab, { f: 's' }); modeToggle(x0 + 64, y, 140, w.mode, m => { w.mode = m; });
  const eo = orderEff(c, w.seat, 'order'), ei = orderEff(c, w.seat, 'intent'); txt('приказ — ' + effWord(eo) + ', замысел — ' + effWord(ei), x0 + 212, y + 3, ei > eo ? UIC.good : '#e8c890', { f: 's' }); y += 18;
  if (w.pick) { const d = ordDef(w.seat, w.pick); const L = tgtList(d.tgt); txt('Цель для «' + d.n + '»:', x0, y, PAL.y); sbtn('c_back', x0 + wR - 60, y - 2, 60, 'Назад', () => { w.pick = null; }); y += 13;
    if (!L.length) txt('Подходящих целей нет.', x0, y, UIC.dim, { f: 's' });
    L.slice(0, 22).forEach((t, i) => { const cx = x0 + (i % 2) * (wR / 2 + 2), cy = y + Math.floor(i / 2) * 15; btn('c_t' + i, cx, cy, wR / 2 - 2, 13, { label: t.n + (t.sub ? ' · ' + t.sub : ''), onClick: () => { if (giveOrder(w.seat, w.pick, w.mode, t.id)) { w.pick = null; } } }); }); return; }
  const OL = ORD[w.seat] || [], rh = clamp(Math.floor((Y + HH - 24 - y) / Math.max(1, OL.length)), 13, 16);
  for (const d of OL) { if (y > Y + HH - 36) break; const busy = o && o.k === d.k && !o.self;
    btn('c_o' + d.k, x0, y, 170, 13, { label: d.n + (d.tgt ? '…' : ''), disabled: busy, tip: [d.n, d.d, { t: (d.cost ? 'Цена: ' + d.cost + ' зол. · ' : '') + (d.dur < 900 ? 'Срок: ' + d.dur + ' дн.' : 'До завершения'), c: UIC.dim }, o ? { t: 'Новое поручение заменит текущее.', c: UIC.warn } : null], onClick: () => { if (d.tgt) { w.pick = d.k; return; } giveOrder(w.seat, d.k, w.mode, null); } });
    const ct = (d.cost ? d.cost + ' зол. · ' : '') + (d.dur < 900 ? d.dur + ' дн.' : 'бессрочно'); txt(ct, x0 + 176, y + 3, P3.lab, { f: 's' }); const dx = Math.max(232, 176 + tw(ct, { f: 's' }) + 8); const ln = wrap(d.d, wR - dx - 4, { f: 's' }); txt(ln[0] + (ln.length > 1 ? '…' : ''), x0 + dx, y + 3, '#a89878', { f: 's' }); y += rh; }
  sbtn('c_app', x0, Y + HH - 20, 110, 'Назначить другого…', () => { w.app = 1; w.sc = 0; }); sbtn('c_dis', x0 + 116, Y + HH - 20, 110, 'Снять с поста', () => { DLG.say(null, 'Снять ' + c.name + ' с поста «' + s.n + '»? ' + (c.fem ? 'Она' : 'Он') + ' обидится, ' + (c.house >= 0 ? 'дом ' + houseName(c.house) + ' тоже.' : 'но это переживут.'), { choices: [{ t: 'Да, снять', fx: () => { dismissSeat(w.seat); log(c.name + ' снят с поста: ' + s.n + '.', 'info'); } }, { t: 'Нет', fx: () => { } }], esc: 1 }); UI.shut(); }); }
function drawCandidates(w, x0, y, wR, s) { const L = candidatesFor(s.k); const cur = seatChar(s.k);
  txt('Кандидаты (по навыку «' + SKN[s.sk] + '»):', x0, y, PAL.y); if (w.app && cur) sbtn('c_back2', x0 + wR - 60, y - 2, 60, 'Назад', () => { w.app = 0; }); y += 13;
  if (!L.length) { para('Подходящих людей при дворе нет. Новые придворные приезжают просить места на приёмах у трона.', x0, y, wR, UIC.dim, { f: 's', lh: 9 }); return; }
  const sc = wheelScroll(w, L.length - 7);
  L.slice(sc, sc + 7).forEach((c, i) => { const yy = y + i * 30; rect(x0, yy, wR, 28, i % 2 ? P3.row : P3.row2); drawPortrait(c, x0 + 2, yy + 2, 0.5);
    txt(charName(c), x0 + 30, yy + 3, PAL.w, { f: 's' }); txt((c.house >= 0 ? 'дом ' + houseName(c.house) : 'без дома') + ' · ' + yrs(c.age) + ' · ' + c.traits.map(t => TRAITS[t] ? TRAITS[t].n : t).join(', '), x0 + 30, yy + 13, P3.lab, { f: 's' });
    const v = skillOf(c, s.sk); txt(SKN[s.sk] + ' ' + v, x0 + wR - 96, yy + 9, skCol(v)); const other = c.seat ? 'сейчас: ' + seatName(c.seat) : c.role === 'lord' ? 'глава дома' : '';
    if (other) txt(other, x0 + wR - 96, yy + 19, UIC.dim, { f: 's' });
    btn('c_ap' + c.id, x0 + wR - 40, yy + 7, 38, 13, { label: 'Да', tip: ['Назначить ' + c.name + ' на место «' + s.n + '»', { t: 'Его дом будет польщён.', c: UIC.dim }], onClick: () => { appointSeat(s.k, c.id); w.app = 0; log(c.name + ' назначен' + (c.fem ? 'а' : '') + ': ' + s.n + '.', 'good'); } });
    hit(x0, yy, wR - 42, 28, { id: 'row_cand' + c.id, tip: traitTip(c) }); }); }
// ---------- Войска короны ----------
function cmdTargets(type, a) { const L = []; const from = a ? [a.x, a.y] : kingPos();
  const dist = ws => Math.hypot(ws.x + 0.5 - from[0], ws.y + 0.5 - from[1]);
  if (type === 'own') for (const S of G.setts) { if (S.ctrl !== 0 || WD.setts[S.id].type === 'village') continue; const ws = WD.setts[S.id]; L.push({ id: S.id, n: ws.name + (S.siege ? ' (осада!)' : ''), d: dist(ws) }); }
  if (type === 'foe') for (const S of G.setts) { if (S.ctrl === 0 || !(hostile(0, S.ctrl) || S.ctrl === 5) || S.ctrl === 6) continue; const ws = WD.setts[S.id]; if (ws.type === 'village' && dist(ws) > 25 * SEAT_K) continue; if (!G.explored[ws.i]) continue; L.push({ id: S.id, n: ws.name + ' · ' + (S.ctrl === 5 ? 'вольные' : REALM_DEF[S.ctrl].name), d: dist(ws) }); }
  if (type === 'army') for (const b of G.armies) { if (!b.alive || b.realm !== 0 || b === a || (b.kind !== 'lord' && b.kind !== 'player')) continue; L.push({ id: b.id, n: armyLabel(b) + ' · ' + armyMen(b), d: Math.hypot(b.x - from[0], b.y - from[1]) }); }
  return L.sort((p, q) => p.d - q.d).slice(0, 24); }
function drawCmdWin(w) {
  const X = 14, Y = 21, WW = 612, HH = 326; winFrame(X, Y, WW, HH, 'Войска короны', false); w.mode = w.mode || 'intent';
  const L = crownArmies(), pa = playerArmy(); if (w.sel === undefined || !armyById(w.sel)) w.sel = L.length ? L[0].id : pa ? pa.id : -1;
  let y = Y + 24; const rows = (pa ? [pa] : []).concat(L); const sc = wheelScroll(w, rows.length - 7);
  if (w.preset) { rect(X + 10, y, 204, 12, '#22408a'); txt('Кому: «' + CMD[w.preset.o].n + ' · ' + WD.setts[w.preset.t].name + '»?', X + 14, y + 2, PAL.hi || '#fff', { f: 's' }); y += 14; }
  rows.slice(sc, sc + 7).forEach((a, i) => { const yy = y + i * 41, g = charOf(a.gen), sel = w.sel === a.id, isP = a.kind === 'player'; rect(X + 10, yy, 204, 39, sel ? P3.sel : i % 2 ? P3.row : P3.row2); if (sel) strokeR(X + 10, yy, 204, 39, '#c9a060');
    if (g) drawPortrait(g, X + 13, yy + 3, 0.5); txt(isP ? 'Войско короля' : g ? charName(g) : '—', X + 42, yy + 3, isP ? PAL.y : PAL.w, { f: 's' }); txt(fmt(armyMen(a)), X + 210, yy + 3, PAL.y, { al: 'r', f: 's' });
    const nr = settNear(a.x, a.y, 3); spr('i_pin', X + 42, yy + 12); txt((nr >= 0 ? WD.setts[nr].name : 'в поле') + (a.mode === 'siege' ? ' · осада' : a.path ? ' · в пути' : ''), X + 51, yy + 13, P3.lab, { f: 's' });
    txt(isP ? 'под вашей рукой' : ordLabel(a.cmd), X + 42, yy + 23, a.pend ? UIC.warn : '#e8dcc0', { f: 's' }); if (a.pend) txt('гонец в пути', X + 210, yy + 23, UIC.warn, { al: 'r', f: 's' });
    hit(X + 10, yy, 204, 39, { id: 'row_ar' + a.id, cursor: true, onClick: () => { if (w.preset && !isP) { sendOrder(a, Object.assign({ mode: w.mode }, w.preset)); w.preset = null; } w.sel = a.id; w.pick = null; w.app = 0; }, tip: isP ? 'Войско, которое ведёт сам король' : null }); });
  if (!rows.length) para('У короны нет войск в поле. Маршал может набрать рекрутов или созвать знамёна знатных домов.', X + 14, y, 196, UIC.dim, { f: 's', lh: 9 });
  if (seatChar('marshal')) sbtn('cm_mus', X + 10, Y + HH - 20, 204, 'Созвать знамёна (маршал)…', () => UI.open({ k: 'council', seat: 'marshal' }));
  const a = armyById(w.sel); if (!a) return; const x0 = X + 224, wR = WW - 236; y = Y + 24; const g = charOf(a.gen);
  if (g) { drawPortrait(g, x0, y, 1); strokeR(x0 - 1, y - 1, 50, 50, '#c9a060'); }
  txt(a.kind === 'player' ? 'Войско короля' : g ? charName(g) : 'Без командира', x0 + 56, y, PAL.y);
  if (g) { txt(g.traits.map(t => TRAITS[t] ? TRAITS[t].n : t).join(', ') + ' · Меч ' + g.mar, x0 + 56, y + 11, '#e8c890', { f: 's' }); hit(x0 + 56, y + 10, 200, 9, { id: 'cm_tr', tip: traitTip(g) });
    const F = faultsOf(g); if (F.length) { const f = FAULTS[F[0]]; txt('Опасно: ' + f.n.toLowerCase() + ' — ' + f.d, x0 + 56, y + 21, UIC.warn, { f: 's' }); hit(x0 + 56, y + 20, 250, 9, { id: 'cm_f', tip: ['Пять опасных качеств полководца (гл. 8)', f.q, 'Такой командир ' + f.d + '. Учитывайте это, отдавая приказ.'] }); }
    else txt('Опасных качеств не замечено.', x0 + 56, y + 21, UIC.good, { f: 's' }); if (a.kind !== 'player') { const ls = loySeen(g); txt('Верность: ' + ls.s, x0 + 56, y + 31, ls.v < 35 ? UIC.bad : PAL.w, { f: 's' }); } }
  y += 52; let xx = x0; const ul = UT.filter(t => a.u[t] > 0), usp = Math.max(26, Math.min(40, Math.floor((wR - 130) / Math.max(1, ul.length)))); for (const t of ul) { spr(UICON[t], xx, y + 1); txt(String(Math.round(a.u[t])), xx + 9, y, PAL.w, { f: 's' }); hit(xx, y, usp - 2, 9, { id: 'cmu' + t, tip: UNIT[t].n }); xx += usp; }
  const eat = armyMen(a) + (a.wounded || 0) + (a.sick || 0); txt('Дух ' + Math.round(a.morale) + ' · провиант на ' + Math.floor(a.food / Math.max(1, eat)) + ' дн.', x0 + wR, y, P3.lab, { al: 'r', f: 's' }); y += 13;
  if (a.kind === 'player') { para('Этим войском вы командуете сами — прямо на карте. Чтобы отдать его рыцарю, вернитесь в замок: войско останется у стен под началом рыцаря.', x0, y, wR, '#e8dcc0', { f: 's', lh: 9 }); return; }
  txt('Приказ: ' + ordLabel(a.cmd), x0, y, PAL.w, { f: 's' }); if (a.pend) { const cr = (G.couriers || []).find(c => c.to === a.id); txt('Гонец с новым приказом ещё ≈' + (cr ? (Math.hypot(a.x - cr.x, a.y - cr.y) / courierSpeed()).toFixed(1) : '?') + ' дн. в пути', x0 + wR, y, UIC.warn, { al: 'r', f: 's' }); } y += 12;
  const [kx, ky] = kingPos(); const cd = Math.hypot(a.x - kx, a.y - ky) / courierSpeed(); txt('До войска ' + kmTxt(Math.hypot(a.x - kx, a.y - ky) * KM_PER_TILE) + ' · гонец ≈' + (cd < 1 ? Math.max(1, Math.round(cd * 24)) + ' ч.' : cd.toFixed(1) + ' дн.') + (hasTech('posts') ? ' (почтовые станции)' : ''), x0, y, P3.lab, { f: 's' }); y += 12;
  txt('Как приказать:', x0, y + 3, P3.lab, { f: 's' }); modeToggle(x0 + 70, y, 140, w.mode, m => { w.mode = m; }); y += 18;
  if (w.pick) { const d = CMD[w.pick]; const T = cmdTargets(d.tgt, a); txt('Цель: «' + d.n + '»', x0, y, PAL.y); sbtn('cm_map', x0 + wR - 150, y - 2, 86, 'Указать на карте', () => { UI.target = { kind: 'cmd', army: a.id, o: w.pick, mode: w.mode }; UI.shut(); if (SCREEN === 'court') openMapFromCourt(); UI.toast('Щёлкните по ' + (d.tgt === 'army' ? 'войску' : 'крепости') + ' на карте.'); }); sbtn('cm_back', x0 + wR - 60, y - 2, 60, 'Назад', () => { w.pick = null; }); y += 14;
    if (!T.length) txt('Подходящих целей нет' + (d.tgt === 'foe' ? ' (нужна война или вольные земли)' : '') + '.', x0, y, UIC.dim, { f: 's' });
    T.forEach((t, i) => { const cx = x0 + (i % 2) * (wR / 2 + 2), cy = y + Math.floor(i / 2) * 15; if (cy > Y + HH - 18) return; const days = t.d / (BASE_SPEED * 0.8); btn('cm_t' + i, cx, cy, wR / 2 - 2, 13, { label: t.n + ' · ' + kmTxt(t.d * KM_PER_TILE) + ', ' + Math.max(1, Math.round(days)) + ' дн.', onClick: () => { sendOrder(a, { o: w.pick, t: t.id, mode: w.mode }); w.pick = null; } }); }); return; }
  if (w.app) { const K = G.chars.filter(c => c.alive && c.realm === 0 && c.prison < 0 && c.age >= 16 && !c.seat && !armyOfGen(c.id) && !c.withKing && c.id !== G.player.char && (c.role === 'knight' || c.role === 'lord' || c.role === 'courtier')).sort((p, q) => q.mar - p.mar).slice(0, 8);
    txt('Новый командир (по Мечу):', x0, y, PAL.y); sbtn('cm_back3', x0 + wR - 60, y - 2, 60, 'Назад', () => { w.app = 0; }); y += 14;
    K.forEach((c, i) => { const yy = y + i * 15; btn('cm_k' + c.id, x0, yy, wR, 13, { label: charName(c) + ' · Меч ' + c.mar + ' · ' + c.traits.map(t => TRAITS[t] ? TRAITS[t].n : t).join(', '), tip: traitTip(c), onClick: () => { const old = charOf(a.gen); if (old) { old.atCourt = 1; old.loy = clamp((old.loy || 60) - 8, 0, 100); } a.gen = c.id; c.atCourt = 0; w.app = 0; log(charName(c) + ' принял командование войском.', 'info'); } }); }); return; }
  const OB = [['hold', null], ['defend', 'own'], ['attack', 'foe'], ['patrol', 'own'], ['join', 'army'], ['ret', null], ['feint', 'foe']];
  OB.forEach(([k, tg], i) => { const d = CMD[k]; btn('cm_o' + k, x0 + (i % 3) * (wR / 3 + 1), y + Math.floor(i / 3) * 16, wR / 3 - 2, 14, { label: d.n + (tg ? '…' : ''), tip: [d.n, d.d], onClick: () => { if (tg) { w.pick = k; return; } sendOrder(a, { o: k, t: k === 'ret' ? G.realms[0].capital : -1, mode: w.mode }); } }); }); y += Math.ceil(OB.length / 3) * 16 + 4;
  para('«Кто знает, когда сражаться, а когда нет, — побеждает» (гл. 3). Приказ идёт с гонцом: пока он скачет, обстановка может измениться.', x0, y, wR, '#a89878', { f: 's', lh: 9 });
  sbtn('cm_app', x0, Y + HH - 20, 120, 'Сменить командира…', () => { w.app = 1; }); sbtn('cm_dis', x0 + 126, Y + HH - 20, 110, 'Распустить войско', () => { UI.shut(); DLG.say(null, 'Распустить войско ' + (g ? charName(g) : '') + ' (' + voin(armyMen(a)) + ') по домам? Жалованье платить не придётся, но собрать их снова будет непросто.', { choices: [{ t: 'Распустить', fx: () => disbandArmy(a) }, { t: 'Нет', fx: () => { } }], esc: 1 }); }); }
// ---------- Династия и дома ----------
function houseSeen(H0) { if (!H0.seen || H0.seen.d !== G.day) { const ch = seatChar('chancellor'); const err = ch ? clamp((20 - ch.dip) * 1.3, 3, 20) : 25; H0.seen = { d: G.day, v: clamp(Math.round(H0.loy + R.range(-err, err) * 0.5), 0, 100) }; } return H0.seen.v; }
function drawDynWin(w) {
  const X = 14, Y = 21, WW = 612, HH = 326, C = G.court, king = kingC(); winFrame(X, Y, WW, HH, 'Династия и знатные дома', false);
  const T = ['Королевская семья', 'Знатные дома']; tabs(X + 12, Y + 22, T, 120); let y = Y + 42;
  if (UI.tab === 1) { const sc = wheelScroll(w, G.houses.length - 6);
    G.houses.slice(sc, sc + 6).forEach((H0, i) => { const yy = y + i * 46; rect(X + 10, yy, WW - 20, 44, i % 2 ? P3.row : P3.row2);
      const s = objSprite('housebanner', { house: H0.her, ck: 'hb' + H0.id }, 0); ctx.drawImage(s, X + 16, yy + 3, s.width * 1.5, s.height * 1.5);
      txt('Дом ' + H0.name, X + 44, yy + 4, PAL.y); txt(H0.motto, X + 44 + tw('Дом ' + H0.name) + 8, yy + 4, '#a89878', { f: 's' }); const h = charOf(H0.head);
      txt('Глава: ' + (h ? charName(h) + ', ' + yrs(h.age) : '—') + ' · земли: ' + (H0.fief >= 0 ? WD.setts[H0.fief].name : 'нет') + ' · войско ≈' + H0.str, X + 44, yy + 15, PAL.w, { f: 's' });
      const ward = C.wards.map(charOf).find(c => c && c.house === H0.id); const seats = SEATS.filter(s2 => { const c = seatChar(s2.k); return c && c.house === H0.id; }).map(s2 => s2.n);
      txt((seats.length ? 'В совете: ' + seats.join(', ') + ' · ' : '') + (ward ? 'воспитанник при дворе: ' + ward.name : 'воспитанника при дворе нет') + (H0.defiant > G.day ? ' · НЕ ПЛАТИТ ПОДАТЕЙ!' : ''), X + 44, yy + 25, H0.defiant > G.day ? UIC.bad : P3.lab, { f: 's' });
      const v = houseSeen(H0); txt('Верность: ' + loyWord(v), X + 400, yy + 4, v < 30 ? UIC.bad : v > 65 ? UIC.good : PAL.w, { f: 's' }); bar(X + 400, yy + 14, 90, 6, v / 100, v < 30 ? '#c0353f' : v > 65 ? '#7fb04c' : '#e0a630');
      hit(X + 400, yy + 3, 90, 18, { id: 'row_hl' + H0.id, tip: ['Верность дома — со слов канцлера' + (seatChar('chancellor') ? ' (Речь ' + seatChar('chancellor').dip + ')' : ' (канцлера нет — оценка грубая)') + '.', H0.d, { t: 'Честолюбие дома: ' + (H0.amb > 65 ? 'высокое' : H0.amb > 45 ? 'среднее' : 'низкое'), c: UIC.dim }] });
      btn('dh_g' + H0.id, X + 500, yy + 3, 98, 13, { label: 'Дар (40 зол.)', tip: 'Подарок главе дома: верность растёт.', onClick: () => { if (spend(40)) { houseLoy(H0, 6); prestige(1); UI.toast('Дом ' + H0.name + ' благодарит за щедрость.'); } } });
      btn('dh_w' + H0.id, X + 500, yy + 18, 98, 13, { label: 'Взять воспитанника', disabled: !!ward, tip: ['Ребёнок дома будет расти при дворе.', 'Дом польщён — и дважды подумает, прежде чем бунтовать.'], onClick: () => takeWard(H0.id) });
      hit(X + 10, yy, 380, 44, { id: 'row_h' + H0.id, tip: [H0.d] }); }); return; }
  // family
  const card = (c, x, yy, role) => { drawPortrait(c, x, yy, 1); strokeR(x - 1, yy - 1, 50, 50, '#c9a060'); txt(charName(c), x + 54, yy, PAL.y); txt(role + ' · ' + yrs(c.age) + sickTag(c), x + 54, yy + 11, c.ill ? UIC.warn : P3.lab, { f: 's' }); skillsLine(c, x + 54, yy + 22); const tl = c.traits.map(t => TRAITS[t] ? TRAITS[t].n : t).join(', '); txt(tl, x + 54, yy + 33, '#e8c890', { f: 's' }); hit(x + 54, yy + 32, tw(tl, { f: 's' }), 9, { id: 'row_ft' + c.id, tip: traitTip(c) }); };
  card(king, X + 16, y, king.fem ? 'Королева' : 'Король'); if (C.regent >= 0) txt('Регент: ' + regentName(), X + 16, y + 52, UIC.warn, { f: 's' });
  const sp = king.spouse >= 0 ? charOf(king.spouse) : null;
  if (sp && sp.alive) { card(sp, X + 310, y, famRole(sp) + (sp.house >= 0 ? ' из дома ' + houseName(sp.house) : '')); txt((sp.aff >= 70 ? 'любит вас' : sp.aff >= 40 ? 'ровна с вами' : 'холодна с вами') + (sp.preg && sp.pregKnown ? ' · ждёт ребёнка' : ''), X + 364, y + 44, sp.preg && sp.pregKnown ? UIC.good : P3.lab, { f: 's' }); }
  else txt(king.widow ? 'Король вдов. (Новый брак — в следующих версиях.)' : 'Король не женат.', X + 310, y + 10, UIC.dim);
  y += 64; hline(X + 12, y - 4, WW - 24, '#6a4428'); txt('Дети', X + 16, y, PAL.y); y += 12; const kids = (king.kids || []).map(charOf).filter(c => c && c.alive).concat(royalFamily().filter(c => !(king.kids || []).includes(c.id) && c.id !== king.spouse)); const heir = heirOf();
  if (!kids.length) txt('Детей нет — а без наследника династия оборвётся.', X + 16, y, UIC.bad, { f: 's' });
  kids.slice(0, 5).forEach((c, i) => { const yy = y + i * 30; rect(X + 12, yy, WW - 24, 28, i % 2 ? P3.row : P3.row2); drawPortrait(c, X + 14, yy + 2, 0.5);
    txt(charName(c) + (heir && heir.id === c.id ? ' — наследник' + (c.fem ? 'ца' : '') : ''), X + 42, yy + 3, heir && heir.id === c.id ? PAL.y : PAL.w, { f: 's' });
    const b = c.betrothed >= 0 ? charOf(c.betrothed) : null, m = c.spouse >= 0 ? charOf(c.spouse) : null; txt(yrs(c.age) + sickTag(c) + (c.dowager ? ' · вдовствующая королева' : '') + (m ? ' · в браке с ' + m.name : b ? ' · обручен' + (c.fem ? 'а' : '') + ' с ' + b.name + ' (дом ' + houseName(b.house) + ')' : '') + (c.away ? ' · живёт в доме мужа' : ''), X + 42, yy + 13, P3.lab, { f: 's' });
    skillsLine(c, X + 330, yy + 9);
    if (!b && !m && !c.dowager && c.age >= 4) btn('df_b' + c.id, X + WW - 100, yy + 7, 84, 13, { label: 'Обручить…', active: w.pick === c.id, tip: ['Помолвка с отпрыском знатного дома.', 'Дом станет куда вернее короне, остальные честолюбцы — ревнуют.', { t: 'Свадьба — в 16 лет.', c: UIC.dim }], onClick: () => { w.pick = w.pick === c.id ? null : c.id; } }); });
  y += Math.min(5, kids.length) * 30 + 4;
  if (w.pick !== null && w.pick !== undefined && charOf(w.pick)) { const c = charOf(w.pick); txt('С каким домом обручить ' + c.name + '?', X + 16, y + 2, PAL.y, { f: 's' }); G.houses.filter(h => h.alive).forEach((H0, i) => btn('df_h' + H0.id, X + 160 + i * 74, y, 72, 13, { label: H0.name, tip: 'Верность: ' + loyWord(houseSeen(H0)), onClick: () => { betroth(c.id, H0.id); w.pick = null; } })); y += 16; }
  const wards = C.wards.map(charOf).filter(c => c && c.alive); txt('Воспитанники: ' + (wards.length ? wards.map(c => c.name + ' (' + yrs(c.age) + ', ' + (c.happy >= 2 ? 'доволен' : c.happy >= 0 ? 'скучает' : 'несчастен') + ')').join(', ') : 'нет'), X + 16, Math.min(y + 2, Y + HH - 14), P3.lab, { f: 's' }); }
// ---------- Знания: the window lives in reignui.js (v3.5–3.6) ----------
function drawTechWin(w) { }
// ---------- Письма ----------
function drawLettersWin(w) { const X = 60, Y = 26, WW = 520, HH = 312, C = G.court; winFrame(X, Y, WW, HH, 'Письма и донесения', true);
  const now = G.day + G.frac, L = C.letters.filter(l => l.arr <= now), way = C.letters.length - L.length; let y = Y + 24; const sc = wheelScroll(w, L.length - 12);
  if (!L.length) txt('Писем нет.', X + 16, y, INK2);
  L.slice(sc, sc + 12).forEach((l, i) => { const yy = y + i * 22; rect(X + 10, yy, WW - 20, 20, l.read ? 'rgba(0,0,0,0.03)' : 'rgba(200,140,40,0.18)'); spr('i_scroll', X + 14, yy + 5);
    txt(l.subj, X + 26, yy + 2, l.read ? INK2 : INK); txt(l.from + ' · ' + dateStr(l.day), X + 26, yy + 12, INK2, { f: 's' }); if (l.ch && !l.answered) txt('ждёт ответа', X + WW - 16, yy + 7, '#a03020', { al: 'r', f: 's' });
    hit(X + 10, yy, WW - 20, 20, { id: 'row_l' + l.id, cursor: true, onClick: () => { UI.shut(); openLetter(l); } }); });
  if (way) txt('Ещё ' + way + ' ' + plural(way, 'письмо', 'письма', 'писем') + ' в пути (гонец проходит ≈' + Math.round(courierSpeed()) + ' ' + plural(Math.round(courierSpeed()), 'клетку', 'клетки', 'клеток') + ' карты в день).', X + 16, Y + HH - 14, INK2, { f: 's' }); }
// ---------- Око короля ----------
function drawEyeWin(w) { const X = 14, Y = 21, WW = 612, HH = 326, C = G.court; winFrame(X, Y, WW, HH, 'Тайная служба', false); const e = seatChar('eye'); let y = Y + 22;
  txt(e ? 'Око короля: ' + charName(e) + ' · Тень ' + e.intr : 'Ока короля нет — никто не следит за тайнами двора.', X + 16, y, e ? PAL.w : UIC.bad, { f: 's' }); y += 14;
  txt('Сети осведомителей', X + 16, y, PAL.y); y += 11;
  [1, 2, 3, 4].filter(t => alive(t)).forEach((t, i) => { const lv = C.net[t] || 0, yy = y + i * 12; spr('shield' + t, X + 16, yy - 1); txt(realmName(t), X + 30, yy, PAL.w, { f: 's' }); for (let k = 0; k < 3; k++) rect(X + 140 + k * 9, yy + 1, 7, 6, k < lv ? '#e0a630' : '#3a2a1e');
    const err = [50, 30, 15, 7][lv]; if (!C.pw || C.pw.d !== G.day) C.pw = { d: G.day, v: {} }; if (C.pw.v[t] === undefined) C.pw.v[t] = Math.round(realmPower(t, 0) * (1 + R.range(-err, err) / 100));
    txt('сила войск ≈' + fmt(C.pw.v[t]) + ' (±' + err + '%) · мы ≈' + fmt(Math.round(realmPower(0, t))), X + 176, yy, P3.lab, { f: 's' }); });
  y += 52; txt('Раскрытые тайны', X + 16, y, PAL.y); y += 11; const S = C.secrets.filter(s => s.known).slice(-6).reverse();
  if (!S.length) txt('Пока ничего. Тайны раскрывают досье, слежка Ока — или ночные разговоры в саду, если подкрасться поближе.', X + 16, y, UIC.dim, { f: 's' });
  for (const s of S) { y += para('• ' + secretText(s) + (s.how ? ' (' + s.how + ')' : ''), X + 16, y, WW - 32, '#e8dcc0', { f: 's', lh: 9 }) + 2; if (y > Y + 230) break; }
  y = Math.max(y + 6, Y + 200); txt('Досье', X + 16, y, PAL.y); y += 11; const K = Object.keys(C.known).map(Number).filter(id => charOf(id) && charOf(id).alive);
  if (!K.length) txt('Досье нет. Поручите Оку собрать досье на придворного (Совет → Око короля).', X + 16, y, UIC.dim, { f: 's' });
  K.slice(-8).forEach((id, i) => { const c = charOf(id), k = C.known[id]; txt(c.name + ': верность ≈' + k.loy + ', честолюбие ≈' + k.amb + ', честность ≈' + k.hon + ' (±' + k.err + ', ' + dateStr(k.day) + ')', X + 16 + (i % 2) * 296, y + Math.floor(i / 2) * 10, k.loy < 35 || k.hon < 35 ? UIC.warn : PAL.w, { f: 's' }); }); }
// ---------- settlement (seen from the court's map table) ----------
function drawSettInfoWin(w) { const sid = w.id, S = G.setts[sid], ws = WD.setts[sid]; const ride = G.court && G.atCourt && sid !== G.realms[0].capital; const X = W / 2 - 170, Y = 60, WW = 340, HH = ride ? 220 : 200; winFrame(X, Y, WW, HH, ws.name, true); let y = Y + 24;
  const own = S.ctrl === 0, seen = own || G.vis[ws.i] === 2; const tn = { village: 'деревня', castle: 'замок', town: 'город', capital: 'столица' }[ws.type];
  kv(X + 16, y, 'Тип:', tn + ' · ' + (S.ctrl === 5 ? 'вольные земли' : S.ctrl === 6 ? 'разбойники' : REALM_DEF[S.ctrl].name), true); y += 12;
  kv(X + 16, y, 'Гарнизон:', seen ? String(menOf(S.gar)) : 'неизвестно', true); kv(X + 190, y, 'Стены:', String(S.walls), true); y += 12;
  kv(X + 16, y, 'Процветание:', Math.round(S.prosp) + '%', true); kv(X + 190, y, 'Жителей:', fmt(S.pop), true); y += 12;
  if (S.house >= 0 && G.houses[S.house]) { kv(X + 16, y, 'Владетель:', 'дом ' + houseName(S.house) + (S.lord >= 0 && charOf(S.lord) ? ' (' + charName(charOf(S.lord)) + ')' : ''), true); y += 12; }
  if (S.siege) { const b = armyById(S.siege.by); txt('В осаде! ' + (b ? armyLabel(b) : ''), X + 16, y, '#a03020'); y += 12; }
  if (ws.type !== 'village' && own) { const P = G.provs[ws.prov], K = crownK(0); kv(X + 16, y, 'Доход провинции:', fq(provIncome(ws.prov) * K) + ' зол./день (подати ' + fq((P.ecTax || 0) * K) + ', цеха ' + fq((P.ecCraft || 0) * K) + ')', true); y += 12; }
  { const r = S.res || settRiches(S), rl = RICH_N.filter(([k]) => r[k] > 0.05).map(([k, n]) => n + ' ×' + r[k].toFixed(1).replace('.', ',')); y += para('Богатства: ' + (rl.join(' · ') || 'скудные'), X + 16, y, WW - 32, INK2, { f: 's', lh: 9 }); }
  { const ml = settMarketLine(S); if (ml) { y += para(ml.t, X + 16, y, WW - 32, INK, { f: 's', lh: 9 }); y += 2; } }
  y += 4; para(own ? 'Своя земля. Со стола карт король шлёт гонца с приказом войску — или едет сам.' : 'Чужая земля. Пошлите войско — или поезжайте сами.', X + 16, y, WW - 32, INK2, { f: 's', lh: 9 });
  if (ride) btn('si_ride', X + 16, Y + HH - 44, 200, 16, { label: 'Поехать туда самому…', tip: ['Король выедет из замка — со свитой или во главе войска у столицы.', { t: 'По прибытии — въезд' + (hostile(0, S.ctrl) ? ', осада или приступ.' : ' в поселение.'), c: UIC.dim }], onClick: () => { UI.shut(); rideTo(sid); } });
  if (ws.type !== 'village' || !own) btn('si_send', X + 16, Y + HH - 24, 200, 16, { label: own ? 'Послать войско защищать…' : 'Послать войско в наступление…', onClick: () => UI.open({ k: 'cmd', preset: { o: own ? 'defend' : 'attack', t: sid } }) });
  btn('si_goods', X + WW - 96, Y + HH - 44, 80, 16, { label: 'Рынок…', tip: ['Товары и цены', S.ctrl === 0 ? 'Запасы, цены, добыча, ремёсла, ввоз и вывоз — по книгам рынка.' : 'Что известно о здешних ценах — от купцов, лазутчиков и разведки.'], onClick: () => UI.open({ k: 'goods', id: sid }) });
  btn('si_ok', X + WW - 96, Y + HH - 24, 80, 16, { label: 'Закрыть', onClick: () => UI.shut() }); }
// map target picking for orders (UI.target.kind === 'cmd')
function cmdPickSett(sid) { const tg = UI.target; UI.target = null; const a = armyById(tg.army); if (!a) return; const S = G.setts[sid];
  if ((tg.o === 'attack' || tg.o === 'feint') && (S.ctrl === 0 || !(hostile(0, S.ctrl) || S.ctrl === 5))) { UI.toast('С хозяевами этой крепости нет войны.'); return; }
  if ((tg.o === 'defend' || tg.o === 'patrol') && S.ctrl !== 0) { UI.toast('Это не наша крепость.'); return; }
  if (tg.o === 'join') { UI.toast('Нужно выбрать войско, а не крепость.'); return; } sendOrder(a, { o: tg.o, t: sid, mode: tg.mode }); }
function cmdPickArmy(b) { const tg = UI.target; UI.target = null; const a = armyById(tg.army); if (!a) return; if (tg.o !== 'join' || b.realm !== 0 || b === a) { UI.toast('Не подходит.'); return; } sendOrder(a, { o: 'join', t: b.id, mode: tg.mode }); }
// ---------- court help ----------
function drawHelp3() { const [x, y] = dlg(460, 268, 'Управление при дворе');
  const L = [['WASD / стрелки', 'ходить по замку'], ['ЛКМ', 'идти туда; по человеку — подойти и заговорить'], ['E / Enter', 'говорить, действовать (трон, стол, кровать…)'], ['Пробел · 1–3', 'пауза · скорость времени'], ['Tab', 'стол карт: королевство (и обратно)'], ['K · V · F', 'совет · войска · династия'], ['J · L · B', 'знания · письма · трактат'], ['Z / колесо', 'приблизить / отдалить'], ['Ночью в саду', 'подкрадитесь (медленно) — услышите тайны'], ['Esc', 'меню']];
  L.forEach(([k, v], i) => { txt(k, x + 16, y + 26 + i * 15, '#6a3a1a'); txt(v, x + 150, y + 26 + i * 15, INK); }); txt('Малый совет — по четвергам в 9:30 (можно созвать и срочно) · приём у трона — с 9 до 12.', x + 16, y + 26 + L.length * 15 + 4, INK2, { f: 's' });
  btn('hp_ok', x + 150, y + 244, 160, 16, { label: 'Понятно', onClick: () => UI.close() }); }
// the court book: petitions decided by the king, the chief justice, a regent or the clerks
function drawCourtBook(w, X, Y, WW, HH) { const C = G.court, j = seatChar('justice'), V = C.verdicts || []; let y = Y + 42;
  const head = j ? 'Верховный судья ' + j.name + ' · Книга ' + j.lrn + ': мудрое решение — примерно в ' + Math.round(clamp(j.lrn / 18, 0.2, 0.95) * 100) + '% дел.' : C.regent >= 0 ? 'Верховного судьи нет: прошения разбирает регент.' : 'Место верховного судьи пустует: без вас прошения решают писцы — как придётся.';
  txt(head, X + 16, y, j ? PAL.y : UIC.warn, { f: 's' }); y += 10;
  const M = V.filter(v => G.day - v.d < 30 && v.by !== 'king'), wise = M.filter(v => v.q === 2).length;
  txt('За 30 дней без вас решено ' + M.length + ' ' + plural(M.length, 'дело', 'дела', 'дел') + ', мудро — ' + wise + '. ' + (j ? 'Судья' : C.regent >= 0 ? 'Регент' : 'Писцы') + ' разбира' + (j || C.regent >= 0 ? 'ет' : 'ют') + ' прошения, пока вы в отъезде, и то, что осталось после полудня.', X + 16, y, P3.lab, { f: 's' }); y += 14;
  if (!V.length) { txt('Книга пуста: прошений ещё не разбирали.', X + 16, y, UIC.dim, { f: 's' }); return; }
  const per = Math.floor((Y + HH - 10 - y) / 20), sc = wheelScroll(w, V.length - per), BY = { king: 'Король', judge: 'Судья', regent: 'Регент', clerk: 'Писцы' }, QW = ['неудачно', 'сносно', 'мудро'], QC = [UIC.warn, '#e8c890', UIC.good];
  for (const v of V.slice(sc, sc + per)) { rect(X + 12, y - 2, WW - 24, 19, V.indexOf(v) % 2 ? P3.row : P3.row2);
    txt(dateStr(v.d) + ' · ' + BY[v.by] + (v.bn && v.by !== 'king' ? ' ' + v.bn : ''), X + 16, y, PAL.y, { f: 's' }); txt(v.g, X + 190, y, PAL.w, { f: 's' });
    txt('→ ' + v.t, X + 190, y + 8, QC[v.q], { f: 's' }); txt(QW[v.q], X + WW - 16, y + 8, QC[v.q], { al: 'r', f: 's' }); y += 20; } }
