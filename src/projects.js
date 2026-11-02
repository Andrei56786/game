// ---------- royal works: buildings and other undertakings at the capital ----------
// G.court.proj = { done: { k: { day, king } }, cur: { k, prog, need }, tips: day }
const PROJ = [
  { k: 'stands', n: 'Трибуны у ристалища', cost: 220, days: 18, loc: 'yard', out: 1, sol: [['yard', 55, 14, 66, 15]], scf: [55, 15, 12, 50], lot: [54, 16],
    d: 'Деревянные трибуны с навесом вдоль турнирного поля. Без них знать не съедется на турнир.', fx: 'Можно устраивать турниры на ристалище.', crew: [['villager', 0, 40, 'Плотник Свен', 'Плотник'], ['villager', 0, 24, 'Подмастерье Ян', 'Подмастерье']], w: [['yard', 58, 16, 'up'], ['yard', 63, 16, 'up']] },
  { k: 'falconry', n: 'Соколятня', cost: 150, days: 12, loc: 'yard', out: 1, sol: [['yard', 64, 28, 67, 30], ['yard', 64, 31, 64, 31], ['yard', 67, 31, 67, 31]], scf: [64, 30, 4, 44], lot: [66, 31],
    d: 'Клетки и присады для ловчих птиц, сокольничий из южных земель.', fx: 'Соколиная охота: больше дичи и славы с каждой охоты.', crew: [['villager', 0, 46, 'Плотник Свен', 'Плотник']], w: [['yard', 65, 32, 'up']] },
  { k: 'libwing', n: 'Крыло библиотеки', cost: 260, days: 24, loc: 'keep', sol: [['keep', 1, 6, 4, 6]], box: [[1, 6], [3, 6], [4, 6]], lot: [2, 7],
    d: 'Шкафы для свитков и переписанных книг, свечи на всю зиму, два писца.', fx: 'Знания добываются на 15% быстрее.', crew: [['villager', 0, 36, 'Столяр Ганс', 'Столяр']], w: [['keep', 2, 7, 'up']] },
  { k: 'observatory', n: 'Звездочётная', cost: 180, days: 14, loc: 'upper', sol: [['upper', 45, 6, 45, 6], ['upper', 47, 6, 47, 6]], un: [['upper', 43, 4, 44, 4], ['upper', 48, 4, 48, 4], ['upper', 47, 8, 47, 8]], lot: [46, 7],
    d: 'Медная зрительная труба и звёздные карты в комнате под самой крышей.', fx: 'Знания +5%. Ночью у трубы видно, долго ли продержится погода.', crew: [['scholar', 0, 58, 'Мастер Тиль', 'Оптик']], w: [['upper', 46, 6, 'left']] },
  { k: 'stainglass', n: 'Витражи часовни', cost: 200, days: 16, loc: 'chapel', box: [[3, 4], [22, 4]], lot: [11, 18],
    d: 'Цветное стекло из-за моря: святые и короли в окнах часовни.', fx: 'Молитва в часовне сильнее, престиж +2.', crew: [['villager', 0, 50, 'Стекольщик Бруно', 'Стекольщик']], w: [['chapel', 5, 5, 'up']] },
  { k: 'roses', n: 'Розарий', cost: 80, days: 8, loc: 'yard', out: 1, sol: [['yard', 38, 8, 38, 8], ['yard', 38, 11, 38, 11], ['yard', 47, 8, 47, 8], ['yard', 47, 11, 47, 11], ['yard', 44, 4, 44, 4]], lot: [41, 8],
    d: 'Розовые кусты вокруг фонтана: алые, белые, чайные.', fx: 'Супруг(а) +10 к расположению, наследники чаще.', crew: [['peasant', 1, 40, 'Садовница Марта', 'Садовница']], w: [['yard', 40, 11, 'left']] },
  { k: 'tapestries', n: 'Гобелены зала', cost: 170, days: 14, loc: 'hall', box: [[3, 4], [40, 4]], lot: [5, 22],
    d: 'Тканые сцены охот и побед на стенах пиршественного зала.', fx: 'Пиры радуют знать на треть сильнее.', crew: [['villager', 1, 44, 'Ткачиха Ута', 'Ткачиха']], w: [['hall', 6, 4, 'up']] },
  { k: 'mint', n: 'Монетный двор', cost: 320, days: 22, loc: 'yard', out: 1, sol: [['yard', 68, 28, 71, 30]], scf: [68, 30, 4, 46], lot: [69, 31],
    d: 'Своя чеканка: мастер, штемпели, весы и крепкая дверь.', fx: 'Доходы казны +5%.', crew: [['villager', 0, 42, 'Каменщик Ульф', 'Каменщик'], ['villager', 0, 22, 'Подмастерье Лука', 'Подмастерье']], w: [['yard', 68, 31, 'up'], ['yard', 71, 31, 'up']] },
  { k: 'granary', n: 'Большой амбар', cost: 200, days: 15, loc: 'yard', out: 1, sol: [['yard', 2, 4, 6, 6]], scf: [2, 6, 5, 46], lot: [7, 6],
    d: 'Второй амбар на сухом месте у северной стены.', fx: 'Урожай в амбарах столицы +20%.', crew: [['villager', 0, 42, 'Плотник Свен', 'Плотник']], w: [['yard', 4, 7, 'up']] },
  { k: 'statue', n: 'Статуя основателя', cost: 280, days: 20, loc: 'yard', out: 1, sol: [['yard', 28, 25, 29, 25]], scf: [28, 25, 2, 56], lot: [30, 26],
    d: 'Бронзовый основатель династии на гранитном постаменте посреди двора.', fx: 'Престиж +6 сразу и +1 каждый сезон.', crew: [['villager', 0, 55, 'Литейщик Гуннар', 'Литейщик']], w: [['yard', 27, 26, 'up']] },
  { k: 'portrait', n: 'Парадный портрет', cost: 90, days: 10, loc: 'upper', per: 1, lot: null, easel: [22, 8],
    d: 'Придворный художник напишет вас в полный рост для галереи предков.', fx: 'Престиж +3, портрет висит в галерее.', crew: [['scholar', 0, 34, 'Художник Ремигий', 'Художник']], w: [['upper', 23, 9, 'left']] },
  { k: 'chronicle', n: 'Летопись царствования', cost: 120, days: 30, loc: 'keep', per: 1, lot: null,
    d: 'Монах-летописец запишет ваши деяния для потомков.', fx: 'Престиж +1 каждый сезон, наследнику легче удержать дома.', crew: [['priest', 0, 61, 'Брат Беда', 'Летописец']], w: [['keep', 8, 5, 'up']] },
];
const PROJK = {}; PROJ.forEach(d => { PROJK[d.k] = d; });
function projState() { const C = G && G.court; if (!C) return null; if (!C.proj) C.proj = { done: {}, cur: null }; return C.proj; }
function projDone(k) { const P = G && G.court && G.court.proj; const e = P && P.done && P.done[k]; if (!e) return false; return PROJK[k] && PROJK[k].per ? e.king === G.player.char : true; }
function projBuiltFor(k) { return projDone(k); }
function projCur(k) { const P = G && G.court && G.court.proj; return P && P.cur && (!k || P.cur.k === k) ? P.cur : null; }
function projRate() { const s = seatChar('seneschal'); return s ? clamp(0.8 + (s.stew || 8) / 25, 0.9, 1.7) : 0.75; }
// objects: what stands at each site — built, under scaffolding, or not at all
function projSetup() { const Y = LOCS.yard, K = LOCS.keep, U = LOCS.upper; if (!Y || !K || !U) return;
  const on = k => () => projDone(k), mk = k => () => !!projCur(k);
  place(Y, 'stands', { n: 12, ramp: 'red', ck: 'st12' }, 55, 15, { show: on('stands') }); spot(Y, 'stand0', 57, 14, 'down', { sit: 1, sy: 14 * CT + 4 }); spot(Y, 'stand1', 61, 14, 'down', { sit: 1, sy: 14 * CT + 4 }); spot(Y, 'stand2', 64, 14, 'down', { sit: 1, sy: 14 * CT + 4 });
  place(Y, 'bld', { w: 4, fh: 34, rh: 30, wall: 'plank', roof: 'shake', doors: [[22, 12, 18, 1]], wins: [[5, 9]], seed: 21, ck: 'mews' }, 64, 30, { dx: -2, show: on('falconry') });
  for (const px of [64, 67]) place(Y, 'perch', {}, px, 31, { dx: 1, show: on('falconry') });
  place(K, 'bookshelf', { seed: 61, fill: 0.95, ck: 'bw1' }, 1, 6, { show: on('libwing') }); place(K, 'bookshelf', { seed: 67, fill: 0.9, ck: 'bw3' }, 3, 6, { show: on('libwing') });
  place(U, 'scope', {}, 45, 6, { dx: -3, show: on('observatory') }); place(U, 'globe', { ck: 'obsg' }, 47, 6, { show: on('observatory') }); place(U, 'mapboard', { ck: 'obsm' }, 44, 2, { wall: 1, dy: -2, show: on('observatory') }); act(U, 'stars', 45, 7, 'Звёздная труба', { r: 26, show: on('observatory') });
  for (const [x, y, col] of [[38, 8, 'red'], [38, 11, 'pink'], [47, 8, 'ivory'], [47, 11, 'red'], [44, 4, 'pink']]) place(Y, 'rosebush', { col, ck: 'rb' + col }, x, y, { dx: -3, show: on('roses') });
  place(Y, 'bld', { w: 4, fh: 40, rh: 34, wall: 'stone', roof: 'slate', doors: [[22, 14, 22, 1]], wins: [[5, 12]], seed: 23, sign: [44, 'coin'], ck: 'mint' }, 68, 30, { dx: -2, show: on('mint') });
  place(Y, 'bld', { w: 5, fh: 38, rh: 40, wall: 'plank', roof: 'thatch', doors: [[30, 16, 24, 0]], wins: [[8, 10]], seed: 27, sign: [58, 'grain'], ck: 'gran2' }, 2, 6, { dx: -2, show: on('granary') });
  place(Y, 'kstatue', {}, 28, 25, { cx: 29 * CT, show: on('statue') });
  for (const d of PROJ) { const L = LOCS[d.loc]; if (!L) continue;
    if (d.scf) { const o = { w: d.scf[2], h: d.scf[3], p: 0, ck: 'scf' + d.k + '0' }; place(L, 'scaffold', o, d.scf[0], d.scf[1], { dx: -2, show: () => { const c = projCur(d.k); if (c) { const st = Math.min(9, Math.floor(c.prog / c.need * 10)); o.p = st / 10; o.ck = 'scf' + d.k + st; } return !!c; } }); }
    for (const [x, y] of d.box || []) place(L, 'crate', {}, x, y, { show: mk(d.k) });
    if (d.lot) place(L, 'lotsign', {}, d.lot[0], d.lot[1], { show: mk(d.k) });
    if (d.easel) place(L, 'easel', {}, d.easel[0], d.easel[1], { show: mk(d.k) });
    (d.w || []).forEach((w, i) => { if (LOCS[w[0]]) spot(LOCS[w[0]], 'pjw_' + d.k + i, w[1], w[2], w[3]); }); }
  // the architect's drafting table by the keep
  place(Y, 'desk', { ck: 'dk0' }, 31, 12, { solid: [31, 12, 32, 12] }); act(Y, 'works', 32, 13, 'Стол зодчего: замыслы и стройки', { r: 26 }); spot(Y, 'architect', 31, 13, 'up');
  COURT.projWarn = []; for (const d of PROJ) for (const [loc, x0, y0, x1, y1] of d.sol || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (solidAt(LOCS[loc], x, y)) COURT.projWarn.push(d.k + '@' + x + ',' + y);
  projApply(); }
// solid tiles follow the state of the works; the king is nudged off a site that has just been fenced
function projApply() { if (!LOCS.yard || !G || !G.court) return;
  for (const d of PROJ) { const on = projDone(d.k) || !!projCur(d.k); for (const [loc, x0, y0, x1, y1] of d.sol || []) if (LOCS[loc]) sfill(LOCS[loc], x0, y0, x1, y1, on ? 1 : 0); for (const [loc, x0, y0, x1, y1] of d.un || []) if (LOCS[loc]) sfill(LOCS[loc], x0, y0, x1, y1, projDone(d.k) ? 0 : 1); }
  const P = COURT.p, L = COURT.loc && LOCS[COURT.loc]; if (P && L && !G.visit && !canStand(L, P.x, P.y)) { const [tx, ty] = nearFree(L, Math.floor(P.x / CT), Math.floor((P.y - 2) / CT)); P.x = tx * CT + 8; P.y = ty * CT + 11; } }
// the crew at work (added to the court by homeExtras)
function projNpcs() { const c = projCur(); if (!c) return; const d = PROJK[c.k]; if (!d) return;
  (d.crew || []).forEach((w, i) => { const sp = 'pjw_' + d.k + i; if (!spotOf(sp)) return; const ch = pseudoChar(70 + i + PROJ.indexOf(d) * 2, w[0], w[1], w[2], w[3]);
    mkNpc('pjw' + i, ch, { sched: [[5, 'gate_out'], [7, sp], [12, 'well'], [13, sp], [18.5, 'gate_out']], home: 'gate_out', staff: 'builder', sub: w[4] + ': ' + d.n.toLowerCase(), talk: m => projCrewTalk(m, d) }); }); }
function projCrewTalk(n, d) { const c = projCur(d.k); if (!c) { talkStaff(n); return; } const left = Math.max(1, Math.ceil((c.need - c.prog) / projRate())), P = projState();
  const ch = [{ t: 'Дать мастерам на пиво (10 зол.)', tip: 'Работа пойдёт веселее: день-другой выиграете.', fx: () => { if (G.realms[0].gold < 10) { UI.toast('В казне пусто.'); return; } G.realms[0].gold -= 10; c.prog += 1.5; P.beer = G.day; Snd.sfx('coin'); say(n, 'Спасибо, государь! Мигом управимся!', 3); } }, { t: 'Не мешать', fx: () => { } }];
  if (P.beer === G.day) ch.shift();
  DLG.say(n, R.pick(['Работаем, государь! ', 'Камень к камню, доска к доске. ', 'Не извольте беспокоиться, государь. ']) + 'Осталось дней ' + left + ', если погода не подведёт.', { choices: ch, esc: ch.length - 1 }); }
// daily progress and completion
function projDaily() { const P = projState(); if (!P) return; const c = P.cur;
  if (c) { const bad = G.weather && (G.weather.k === 'storm' || G.weather.k === 'blizzard') && PROJK[c.k].out; c.prog += projRate() * (bad ? 0.3 : 1); if (c.prog >= c.need) projFinish(c.k); }
  if (seasonOf(G.day) !== seasonOf(G.day - 1)) { let p = 0; if (projDone('statue')) p++; if (projDone('chronicle')) p++; if (p) prestige(p); }
  if (P.lastKing !== undefined && P.lastKing !== G.player.char) { const old = P.done.chronicle; if (old && old.king === P.lastKing) { for (const H0 of G.houses) houseLoy(H0, 4); log('Летопись прежнего царствования читают вслух: знатные дома помнят, кому присягали их отцы.', 'good'); } }
  P.lastKing = G.player.char; }
function projFinish(k) { const P = projState(), d = PROJK[k]; P.cur = null; P.done[k] = { day: G.day, king: G.player.char };
  const sp = charOf(kingC().spouse);
  if (k === 'statue') prestige(6); else if (k === 'portrait') prestige(3); else if (k === 'stainglass') prestige(2); else if (k === 'stands') prestige(1);
  if (k === 'roses' && sp && sp.alive) sp.loy = clamp((sp.loy || 50) + 10, 0, 100);
  log('Достроено: «' + d.n + '». ' + d.fx, 'good'); if (SCREEN === 'court' && !G.visit) { UI.toast('Готово: «' + d.n + '»!'); Snd.sfx('bell'); }
  projApply(); if (SCREEN === 'court' && !G.visit) courtPopulate(); }
function projStart(k) { const P = projState(), d = PROJK[k], r = G.realms[0]; if (!d || P.cur || projDone(k)) return false; if (r.gold < d.cost) { UI.toast('Не хватает золота.'); return false; }
  r.gold -= d.cost; P.cur = { k, prog: 0, need: d.days, day: G.day }; log('Заложено: «' + d.n + '» (' + d.cost + ' зол.).', 'info'); Snd.sfx('coin');
  projApply(); if (SCREEN === 'court' && !G.visit) courtPopulate(); return true; }
function projStop() { const P = projState(), c = P.cur; if (!c) return; const d = PROJK[c.k], back = Math.round(d.cost * 0.5 * (1 - c.prog / c.need)); G.realms[0].gold += back; P.cur = null;
  log('Стройка «' + d.n + '» свёрнута. В казну вернулось ' + back + ' зол.', 'info'); projApply(); if (SCREEN === 'court' && !G.visit) courtPopulate(); }
DAILY_EXT.push(projDaily);
ACTS_EXT.works = () => UI.open({ k: 'proj' });
ACTS_EXT.stars = () => { const Wt = G.weather || { k: 'clear', days: 1 }; if (!isNight()) { DLG.say(null, 'Днём в трубу видно только облака да крыши города. Звездочёт просит прийти ночью.', { name: 'Звёздная труба' }); return; }
  const d = Math.max(1, Math.round(Wt.days || 1)); DLG.say(null, 'Вы смотрите в медную трубу. ' + R.pick(['Млечный путь льётся над башнями.', 'Луна в прожилках, как старый сыр.', 'Над северной стеной горит красная звезда.']) + ' Звездочёт шепчет: «' + (weatherOf().n || 'Погода') + ' продержится ещё ' + d + ' ' + plural(d, 'день', 'дня', 'дней') + ', государь».', { name: 'Звёздная труба' }); Snd.sfx('paper'); };
Object.assign(STAFF_LINES, { builder: ['Камень нынче хороший, государь.', 'Не стойте под лесами, государь, — не ровён час…', 'Работаем от света до света!'] });
// ---------- the window ----------
WIN_EXT.proj = function (w) { const X = 14, Y = 21, WW = 612, HH = 326, P = projState(); winFrame(X, Y, WW, HH, 'Замыслы и стройки', false); if (!P) return;
  const s = seatChar('seneschal'), rate = projRate(), r = G.realms[0]; let y = Y + 22;
  txt(s ? 'Сенешаль ' + s.name + ' ведёт работы: скорость ×' + rate.toFixed(2) : 'Сенешаля нет — стройки идут медленно (×' + rate.toFixed(2) + ').', X + 16, y, s ? PAL.w : UIC.warn, { f: 's' });
  txt('Казна: ' + fmt(Math.floor(r.gold)) + ' зол.', X + WW - 22, y, P3.lab, { al: 'r', f: 's' }); y += 13;
  if (!w.sel) w.sel = (P.cur && P.cur.k) || PROJ[0].k;
  PROJ.forEach((d, i) => { const x = X + 8 + (i % 4) * 150, yy = y + Math.floor(i / 4) * 68, cw = 146, chh = 64, done = projDone(d.k), cur = projCur(d.k), sel = w.sel === d.k;
    rect(x, yy, cw, chh, done ? '#2e4a24' : cur ? '#5a4030' : sel ? '#4a3626' : '#3a2a1e'); strokeR(x, yy, cw, chh, sel ? '#f7d35c' : cur ? '#e0a630' : done ? '#7fb04c' : '#6a4a2a');
    txt(d.n, x + 4, yy + 3, P3.hi); txt(done ? '✓' : d.cost + '', x + cw - 4, yy + 3, done ? UIC.good : r.gold >= d.cost ? PAL.y : UIC.bad, { al: 'r', f: 's' });
    wrap(d.fx, cw - 8, { f: 's' }).slice(0, 3).forEach((l, j) => txt(l, x + 4, yy + 14 + j * 9, done ? '#bfe0a0' : '#d8c8a8', { f: 's' }));
    if (cur) { bar(x + 4, yy + chh - 10, cw - 8, 6, cur.prog / cur.need, '#e0a630'); } else txt(done ? (d.per ? 'Для нынешнего государя' : 'Построено') : '≈' + Math.ceil(d.days / rate) + ' дн.', x + 4, yy + chh - 11, done ? UIC.good : UIC.dim, { f: 's' });
    hit(x, yy, cw, chh, { id: 'pj_' + d.k, cursor: true, onClick: () => { w.sel = d.k; } }); });
  // details of the chosen work
  const d = PROJK[w.sel], cur = projCur(d.k), done = projDone(d.k), by = Y + HH - 70; rect(X + 8, by, WW - 16, 62, 'rgba(0,0,0,0.22)'); strokeR(X + 8, by, WW - 16, 62, '#6a4a2a');
  txt(d.n, X + 16, by + 5, PAL.y); para(d.d, X + 16, by + 17, 380, '#e8dcc0', { f: 's', lh: 9 }); para('Даст: ' + d.fx, X + 16, by + 37, 380, UIC.good, { f: 's', lh: 9 });
  const bx = X + WW - 196;
  if (done) txt(d.per ? 'Сделано для нынешнего государя.' : 'Уже построено.', bx, by + 26, UIC.good, { f: 's' });
  else if (cur) { const left = Math.max(1, Math.ceil((cur.need - cur.prog) / rate)); txt('Идёт работа: осталось ≈' + left + ' ' + plural(left, 'день', 'дня', 'дней'), bx, by + 8, PAL.w, { f: 's' }); bar(bx, by + 19, 180, 7, cur.prog / cur.need, '#e0a630');
    btn('pj_stop', bx, by + 34, 180, 15, { label: 'Свернуть (вернуть часть золота)', style: 'dark', tip: 'Вернётся половина от неизрасходованного.', onClick: () => projStop() }); }
  else { const busy = P.cur && PROJK[P.cur.k], can = !busy && r.gold >= d.cost;
    txt('Стоимость ' + d.cost + ' зол. · ≈' + Math.ceil(d.days / rate) + ' ' + plural(Math.ceil(d.days / rate), 'день', 'дня', 'дней'), bx, by + 8, PAL.w, { f: 's' });
    if (busy) txt('Сначала закончите «' + busy.n + '».', bx, by + 20, UIC.warn, { f: 's' }); else if (r.gold < d.cost) txt('В казне не хватает золота.', bx, by + 20, UIC.bad, { f: 's' });
    btn('pj_go', bx, by + 34, 180, 15, { label: 'Заложить', style: can ? 'wood' : 'dark', disabled: !can, tip: 'Золото уходит сразу, работы идут сами, по дням.', onClick: () => { if (projStart(d.k)) UI.toast('Заложено: «' + d.n + '».'); } }); } };
