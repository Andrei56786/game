'use strict';
// ===== DECEIT UI (v3.7): the window «Разведка и обман» (I) — what we know of the enemy, what the enemy believes of us (with a man at
// his court or a strong net of the Eye), the tricks at hand, the journal; ghosts of foreign armies on the map where they were last seen =====
const ago = d => { const n = G.day - d; return n <= 0 ? 'сегодня' : n === 1 ? 'вчера' : n + ' ' + plural(n, 'день', 'дня', 'дней') + ' назад'; };
const dShort = d => (d % DAYS_SEASON + 1) + ' д. ' + SEASONS[seasonOf(d)].toLowerCase() + ', ' + yearOf(d) + ' г.';
function placeOf(x, y) { let best = -1, bd = 7; for (const s of WD.setts) { const d = Math.hypot(s.x + 0.5 - x, s.y + 0.5 - y); if (d < bd) { bd = d; best = s.id; } } return best < 0 ? 'в поле' : (bd < 1.4 ? 'в ' : 'у ') + WD.setts[best].name; }
// ---------- ghosts: the last sighting of a foreign army that has gone out of sight ----------
function ghostTip(k) { const g = charOf(k.gen), n = G.day - k.day;
  return [{ t: 'Последнее донесение', ic: 'shield' + k.realm }, (g ? charName(g) : 'Войско') + ' (' + realmName(k.realm) + ')', 'Воинов: около ' + fmt(k.men) + (k.fires ? ' (костров много)' : ''),
    { t: ago(k.day) + ' · ' + (BSRC[k.src] || k.src), c: UIC.dim }, k.tgt >= 0 && WD.setts[k.tgt] ? { t: 'Шло на ' + WD.setts[k.tgt].name, c: UIC.warn } : null, { t: n > 0 ? 'Где оно сейчас — неизвестно.' : 'Сейчас его не видно.', c: UIC.dim }].filter(Boolean); }
function drawGhosts() { const K = G.know; if (!K || cam.z <= 0.25) return; const sc = cam.z >= 2 ? 2 : 1;
  for (const id in K) { const k = K[id], b = armyById(+id); if (!b || armyVisible(b)) continue; const age = G.day - k.day; if (age > 20) continue;
    if (!G.explored[Math.floor(k.y) * MW + Math.floor(k.x)]) continue;
    const [wx, wy] = MAPR.warpPt(k.x * TS, k.y * TS), [sx, sy] = w2s(wx, wy); if (sx < -20 || sy < -30 || sx > W + 20 || sy > H + 20) continue;
    const d = REALM_DEF[k.realm]; ctx.globalAlpha = clamp(0.75 - age * 0.025, 0.28, 0.75);
    for (let i = 0; i < 10 * sc; i += 2) px(sx, sy - i, '#e8dcc0'); rect(sx + 1, sy - 10 * sc, 4 * sc, 3 * sc, d.col); rect(sx + 1, sy - 8 * sc, 4 * sc, sc, d.dark);
    rect(sx - 3 * sc, sy, 7 * sc, sc, '#e8dcc0'); ctx.globalAlpha = 1;
    if (cam.z >= 1) txt('?' + fmt(k.men) + ' · ' + (age ? age + ' дн.' : 'сег.'), sx + 2, sy + 2, '#d8c8a8', { al: 'c', f: 's', sh: '#1a1410' });
    hit(sx - 5 * sc, sy - 11 * sc, 11 * sc, 13 * sc, { id: 'ghost' + id, tip: () => ghostTip(k), onClick: c => mapClick(c) }); } }
{ const dsg = drawSigns; drawSigns = function () { dsg(); try { drawGhosts(); } catch (e) { console.error(e); } }; }
{ const at = armyTip; armyTip = function (a) { const L = at(a); try {
  if (a.realm === G.player.realm) { if (a.feign > G.day) L.splice(2, 0, { t: 'Притворное отступление · ещё ' + (a.feign - G.day) + ' дн.', c: UIC.warn }); if (a.feint) L.splice(2, 0, { t: 'Ложный марш' + (a.feint.drew ? ': враг стянул ' + nArm(a.feint.drew) : '') + (a.feint.until ? ' · ещё ' + Math.max(0, a.feint.until - G.day) + ' дн.' : ''), c: UIC.warn }); }
  else if (a.realm >= 1 && a.realm < 5 && a.kind === 'lord' && insight(a.realm)) { if (a.fires) L.splice(3, 0, { t: 'Око: костров вдвое больше, чем людей — на деле ≈' + fmt(Math.round(armyMen(a) / 10) * 10), c: UIC.good });
    if (a.ai && a.ai.feint && WD.setts[a.ai.feint.s]) L.splice(3, 0, { t: 'Око: это ложный марш на ' + WD.setts[a.ai.feint.s].name, c: UIC.good }); if (a.ai && a.ai.guard && WD.setts[a.ai.guard.s]) L.splice(3, 0, { t: 'Стережёт ' + WD.setts[a.ai.guard.s].name, c: UIC.blue }); }
  } catch (e) { console.error(e); } return L; }; }
// ---------- what we know ----------
function knownRows() { const K = G.know || {}, pa = playerArmy(), [kx, ky] = kingPos(), L = [];
  for (const b of G.armies) { if (!b.alive || b.realm < 1 || b.realm > 4 || b.kind !== 'lord') continue; const vis = armyVisible(b), k = K[b.id]; if (!vis && !k) continue;
    const ins = insight(b.realm), close = pa && Math.hypot(pa.x - b.x, pa.y - b.y) < 1.6, e = vis ? estimateMen(b) : null;
    const r = vis ? { b, vis, x: b.x, y: b.y, men: e.n, exact: e.exact, day: G.day, src: G.vis[armyTile(b)] === 2 ? 'eye' : 'inw', fires: !!b.fires } : { b, vis, x: k.x, y: k.y, men: k.men, exact: false, day: k.day, src: k.src, fires: k.fires };
    const m = []; if (r.fires) m.push(ins || close ? 'костров вдвое больше людей' : 'костров много');
    if (ins && b.ai && b.ai.feint && WD.setts[b.ai.feint.s]) m.push('ложный марш на ' + WD.setts[b.ai.feint.s].name);
    if (ins && b.ai && b.ai.guard && WD.setts[b.ai.guard.s]) m.push('стережёт ' + WD.setts[b.ai.guard.s].name);
    const tg = vis && ins && b.onArrive && b.onArrive.k === 'siege' ? b.onArrive.s : k && k.tgt >= 0 && G.day - k.day < 8 ? k.tgt : -1; if (tg >= 0 && WD.setts[tg]) m.push('идёт на ' + WD.setts[tg].name);
    if (vis && b.hidden) m.push('затаилось'); if (b.mode === 'siege' && b.siegeOf >= 0 && vis) m.push('осаждает ' + WD.setts[b.siegeOf].name);
    r.m = m; r.war = !!G.rel[0][b.realm].war; r.d = Math.hypot(r.x - kx, r.y - ky); L.push(r); }
  return L.sort((p, q) => (q.war - p.war) || (q.vis - p.vis) || p.d - q.d); }
function drawKnowTab(w, X, Y, WW, HH) { const L = knownRows(); let y = Y + 42;
  txt('Чужие войска: что видно сейчас и последние донесения. Щелчок по строке — показать на карте.', X + 16, y, P3.lab, { f: 's' }); y += 12;
  const hx = [X + 30, X + 196, X + 246, X + 352, X + 420, X + 506]; ['Войско', 'Воинов', 'Где', 'Когда', 'Откуда', ''].forEach((h, i) => txt(h, hx[i], y, UIC.dim, { f: 's' })); y += 10;
  if (!L.length) { para('Мы не знаем ни об одном чужом войске. Разведку ведут войска и крепости, лазутчики (окно дипломатии) и сеть Ока: она раз в несколько дней доносит, где стоят войска державы.', X + 16, y + 4, WW - 32, UIC.dim, { f: 's', lh: 9 }); return; }
  const NR = 14, sc = wheelScroll(w, L.length - NR);
  L.slice(sc, sc + NR).forEach((r, i) => { const yy = y + i * 14, b = r.b, g = charOf(b.gen); rect(X + 12, yy - 2, WW - 24, 13, i % 2 ? P3.row : P3.row2);
    spr('shield' + b.realm, X + 16, yy - 1); txt((g ? charName(g) : 'Войско') + (r.war ? '' : ' · мир'), X + 30, yy, r.war ? PAL.w : '#c8b898', { f: 's' });
    txt((r.exact ? '' : '≈') + fmt(r.men), X + 236, yy, r.fires ? UIC.warn : PAL.y, { al: 'r', f: 's' }); txt(placeOf(r.x, r.y), X + 246, yy, '#e8dcc0', { f: 's' });
    txt(r.vis ? 'видно сейчас' : ago(r.day), X + 352, yy, r.vis ? UIC.good : G.day - r.day > 6 ? UIC.dim : PAL.w, { f: 's' }); txt(BSRC[r.src] || r.src, X + 420, yy, P3.lab, { f: 's' });
    const ms = r.m.join(', '), mw = WW - 24 - (506 - 12); txt(ms.length > 30 ? ms.slice(0, 29) + '…' : ms, X + 506, yy, UIC.warn, { f: 's' });
    hit(X + 12, yy - 2, WW - 24, 13, { id: 'row_kn' + b.id, cursor: true, tip: [{ t: armyLabel(b), ic: 'shield' + b.realm }, g ? charName(g) + ' · ' + g.traits.map(t => TRAITS[t] ? TRAITS[t].n : t).join(', ') : '', r.m.length ? { t: r.m.join('; '), c: UIC.warn } : null, { t: 'Щелчок — показать на карте', c: UIC.dim }].filter(Boolean),
      onClick: () => { UI.shut(); if (SCREEN === 'court') openMapFromCourt(); const [wx, wy] = MAPR.warpPt(r.x * TS, r.y * TS); centerOn(wx, wy); } }); });
  if (L.length > NR) txt('Колесо мыши — листать (' + (sc + 1) + '–' + Math.min(L.length, sc + NR) + ' из ' + L.length + ')', X + WW - 16, Y + HH - 30, UIC.dim, { al: 'r', f: 's' }); }
// ---------- what the enemy believes ----------
function ourArmyName(a) { const g = charOf(a.gen); return a.kind === 'player' ? 'Войско короля' : g ? charName(g) : 'Войско короны'; }
function theirPlan(a) { const S = s => WD.setts[s] ? WD.setts[s].name : '…';
  if (a.mode === 'siege' && a.siegeOf >= 0) return ['осаждает ' + S(a.siegeOf), G.setts[a.siegeOf].ctrl === 0 ? UIC.bad : PAL.w];
  if (a.ai && a.ai.guard) { const b = armyById(a.ai.guard.by); return ['стережёт ' + S(a.ai.guard.s) + (b && b.feint ? ' — поверил нашему ложному маршу' : ''), b && b.feint ? UIC.good : UIC.blue]; }
  if (a.ai && a.ai.feint) return ['ложный марш на ' + S(a.ai.feint.s) + ' — приманка', UIC.warn];
  if (a.onArrive && a.onArrive.k === 'siege') return ['идёт на ' + S(a.onArrive.s) + (G.setts[a.onArrive.s].ctrl === 0 ? ' — нашу крепость!' : ''), G.setts[a.onArrive.s].ctrl === 0 ? UIC.bad : PAL.w];
  const t = a.ai ? a.ai.task : ''; if (t === 'flee') return ['отступает', PAL.w]; if (t === 'rest') return ['отдыхает и пополняется', PAL.w]; if (t === 'hunt') { const p = armyById(a.ai.prey); return ['гонится за: ' + (p ? armyLabel(p) : 'добычей'), p && p.realm === 0 ? UIC.warn : PAL.w]; }
  if (t === 'patrol') return ['обходит свои земли', PAL.w]; if (t === 'decoy') return ['спешит к ложной цели (обречённый лазутчик)', UIC.good]; return ['стоит', PAL.w]; }
function drawMindTab(w, X, Y, WW, HH) { const T = [1, 2, 3, 4].filter(alive); if (!T.length) return; if (!T.includes(w.r)) w.r = T.find(t => G.rel[0][t].war) || T[0];
  let y = Y + 42; T.forEach((t, i) => btn('in_r' + t, X + 16 + i * 112, y, 108, 13, { label: realmName(t) + (insight(t) ? '' : ' ?'), active: w.r === t, onClick: () => { w.r = t; w.sc = 0; }, tip: insight(t) ? 'Наши люди при её дворе' : 'Нет своих людей при её дворе' })); y += 20;
  const t = w.r, C = G.court, ru = rulerOf(t);
  if (!insight(t)) { const lv = C ? C.net[t] || 0 : 0;
    y += para('Что думают при дворе державы ' + realmName(t) + ', нам неведомо. Нужен внутренний лазутчик (окно дипломатии → лазутчики) или сеть осведомителей Ока уровня 2 и выше (сейчас ' + lv + ' из 3).', X + 16, y, WW - 32, '#e8dcc0', { f: 's', lh: 9 }) + 6;
    para('«Знание наперёд нельзя получить от духов и богов… его получают от людей, знающих положение врага» (гл. 13).', X + 16, y, WW - 32, '#a89878', { f: 's', lh: 9 });
    if (C && seatChar('eye')) sbtn('in_net', X + 16, y + 26, 170, 'Поручить Оку сеть…', () => UI.open({ k: 'council', seat: 'eye' })); return; }
  const B = belOf(t), s = skept(t);
  if (ru) { drawPortrait(ru, X + 16, y, 0.5); txt(charName(ru) + ' · ' + ru.traits.map(k => TRAITS[k] ? TRAITS[k].n : k).join(', ') + ' · Интриги ' + ru.intr, X + 44, y, PAL.y, { f: 's' }); }
  txt('Скепсис: ' + skeptWord(s) + ' (' + Math.round(s * 100) + '%) · раскрыл наших уловок: ' + (B.fooled || 0) + (courtSpyOf(t) ? ' · у него есть человек при нашем дворе!' : ''), X + 44, y + 10, courtSpyOf(t) ? UIC.bad : '#e8c890', { f: 's' });
  hit(X + 44, y + 9, 400, 9, { id: 'in_sk', tip: ['Скепсис — как трудно его обмануть', 'Хитрый, мудрый, осторожный, сведущий в интригах верит меньше; безрассудный и гневливый — больше.', 'Каждая раскрытая уловка учит его осторожности (+12%). Шпион при нашем дворе выдаёт наши замыслы (+30%).'] });
  const bp = belPower(t), tp = realmPower(0); txt('Нашу силу считают ≈' + fmt(bp) + ' (на деле ≈' + fmt(tp) + ')' + (B.rum ? ' · верят слуху о нашей ' + (B.rum.k === 'str' ? 'силе' : 'слабости') + ' (×' + B.rum.f + ') до ' + dShort(B.rum.until) : ''), X + 44, y + 20, bp > tp * 1.15 ? UIC.good : bp < tp * 0.85 ? UIC.warn : PAL.w, { f: 's' }); y += 32;
  const pl = Object.keys(B.plot || {}).map(Number).filter(alive); if (pl.length) { txt('Подозревает в тайных замыслах: ' + pl.map(realmName).join(', ') + ' (подложное письмо)', X + 16, y, UIC.good, { f: 's' }); y += 11; }
  txt('Что там знают о наших войсках', X + 16, y, PAL.y); y += 11;
  const mine = G.armies.filter(a => a.alive && a.realm === 0 && (a.kind === 'lord' || a.kind === 'player'));
  mine.slice(0, 6).forEach((a, i) => { const e = B.a[a.id], yy = y + i * 10; txt(ourArmyName(a) + ':', X + 20, yy, PAL.w, { f: 's' });
    const s2 = e ? 'видели ' + ago(e.day) + ' ' + placeOf(e.x, e.y) + ', считают ≈' + voin(e.men) + ' (на деле ' + armyMen(a) + ')' + (e.fires ? ' — поверили кострам' : '') + (e.feint ? ', ждут удара' : '') + ' · ' + (BSRC[e.src] || e.src) : 'не знают, где оно и сколько в нём людей';
    txt(s2, X + 150, yy, e ? (e.men > armyMen(a) * 1.2 ? UIC.good : e.men < armyMen(a) * 0.8 ? UIC.warn : '#e8dcc0') : UIC.dim, { f: 's' }); }); y += Math.min(6, mine.length) * 10 + 6;
  txt('Их замыслы', X + 16, y, PAL.y); y += 11; const L = lordsOf(t);
  if (!L.length) txt('Войск в поле нет.', X + 20, y, UIC.dim, { f: 's' });
  L.slice(0, 8).forEach((a, i) => { const g = charOf(a.gen), [s3, c] = theirPlan(a), yy = y + i * 10; txt((g ? charName(g) : 'Войско') + ' (≈' + fmt(Math.round(armyMen(a) / 10) * 10) + '):', X + 20, yy, PAL.w, { f: 's' }); txt(s3, X + 190, yy, c, { f: 's' }); }); }
// ---------- the tricks at hand ----------
function frontSetts() { const F = G.setts.filter(S => S.ctrl !== 0 && S.ctrl < 5 && G.rel[0][S.ctrl].war && WD.setts[S.id].type !== 'village');
  return G.setts.filter(S => S.ctrl === 0 && WD.setts[S.id].type !== 'village').map(S => { const ws = WD.setts[S.id]; let d = 1e9; for (const T of F) d = Math.min(d, Math.hypot(WD.setts[T.id].x - ws.x, WD.setts[T.id].y - ws.y)); return { S, d }; }).sort((p, q) => p.d - q.d).slice(0, 6); }
function drawTrickTab(w, X, Y, WW, HH) { let y = Y + 42; const pa = playerArmy(), x2 = X + 196, wd = WW - 212;
  txt('Войско короля', X + 16, y, PAL.y); y += 12;
  if (!pa) { txt('Войско короля сейчас не в поле.', X + 16, y, UIC.dim, { f: 's' }); y += 14; }
  else { const R3 = [['in_fi', 'Ложные костры: ' + (pa.fires ? 'да' : 'нет'), !!pa.fires, () => setMode('fires'), 'Издали войско кажется почти вдвое больше. Вблизи пустые палатки видны.'],
      ['in_fe', 'Ложный марш: ' + (pa.feint ? 'да' : 'нет'), !!pa.feint, () => kingFeint(), pa.feint ? 'Знамёна и барабаны ещё ' + Math.max(0, pa.feint.until - G.day) + ' дн.' + (pa.feint.drew ? ' Враг стянул ' + nArm(pa.feint.drew) + '!' : ' Встаньте в дне пути от вражеской крепости и не нападайте.') : 'Знамёна, барабаны и костры на 8 дней: встаньте в дне пути от вражеской крепости. Поверив, враг стянет к ней войска.'],
      ['in_fg', 'Притворное отступление: ' + (pa.feign > G.day ? 'да' : 'нет'), pa.feign > G.day, () => kingFeign(), pa.feign > G.day ? 'Ещё ' + (pa.feign - G.day) + ' дн. Враг считает нас вдвое слабее и гонится; догнавший растянет строй (дух −15, усталость +25). Дух нашего войска −1 в день.' : 'На 5 дней: враг сочтёт войско разбитым и погонится. Мудрые и хитрые полководцы не преследуют притворно бегущих.']];
    for (const [id, lab, act, f, d] of R3) { btn(id, X + 16, y, 174, 13, { label: lab, active: act, onClick: f }); y += Math.max(15, para(d, x2, y + 2, wd, '#e8dcc0', { f: 's', lh: 9 }) + 5); } }
  y += 2; txt('Войска лордов', X + 16, y, PAL.y); const F2 = crownArmies().filter(a => a.cmd && a.cmd.o === 'feint');
  sbtn('in_cmd', X + 16, y + 11, 174, 'Войска короны…', () => UI.open({ k: 'cmd' }));
  para(F2.length ? F2.map(a => ourArmyName(a) + ' → ' + (WD.setts[a.cmd.t] ? WD.setts[a.cmd.t].name : '…') + (a.feint && a.feint.drew ? ' (враг стянул ' + nArm(a.feint.drew) + ')' : '')).join('; ') : 'Приказ «Ложный марш…»: лорд идёт к вражеской крепости с кострами, встаёт в дне пути и стоит шесть дней.', x2, y + 13, wd, '#e8dcc0', { f: 's', lh: 9 }); y += 34;
  txt('Чучела на стенах · 12 зол., 40 дней', X + 16, y, PAL.y); txt('Гарнизон издали кажется почти вдвое больше. Осада или разъезд у самых стен их раскроют.', x2, y, '#a89878', { f: 's' }); y += 12;
  const FS = frontSetts(); if (!FS.length) { txt('У короны нет крепостей.', X + 16, y, UIC.dim, { f: 's' }); y += 12; }
  FS.forEach(({ S, d }, i) => { const cx = X + 16 + (i % 2) * 292, cy = y + Math.floor(i / 2) * 15, ws = WD.setts[S.id], on = S.dummy > G.day, kn = on && S.dumK ? Object.keys(S.dumK).map(Number) : [];
    txt(ws.name + (d < 1e8 ? ' · до врага ' + kmTxt(d * KM_PER_TILE) : ''), cx, cy + 3, PAL.w, { f: 's' });
    if (on) txt('стоят ещё ' + (S.dummy - G.day) + ' дн.' + (kn.length ? ', раскрыты: ' + kn.map(realmName).join(', ') : ''), cx + 286, cy + 3, kn.length ? UIC.warn : UIC.good, { al: 'r', f: 's' });
    else btn('in_dm' + S.id, cx + 206, cy, 80, 13, { label: 'Поставить', onClick: () => placeDummy(S.id) }); }); y += Math.ceil(FS.length / 2) * 15 + 6;
  txt('Тайная служба', X + 16, y, PAL.y);
  const eo = G.court && G.court.orders.eye, ed = eo && ordDef('eye', eo.k);
  para('Подложное письмо, слухи о нашей силе или слабости, перехват гонцов — поручения Ока короля.' + (ed ? ' Сейчас: «' + ed.n + '»' + (eo.t !== undefined && eo.t !== null && ed.tgt === 'realm' ? ' · ' + realmName(eo.t) : '') + '.' : ''), x2, y + 2, wd, '#e8dcc0', { f: 's', lh: 9 });
  if (G.court && seatChar('eye')) sbtn('in_eye', X + 16, y + 11, 174, 'Поручить Оку…', () => UI.open({ k: 'council', seat: 'eye' })); else txt('Ока короля нет.', X + 16, y + 13, UIC.dim, { f: 's' }); }
// ---------- the journal ----------
function drawLogTab(w, X, Y, WW, HH) { const L = (G.dlog || []).slice().reverse(); let y = Y + 42;
  if (!L.length) { para('Журнал пуст. Здесь появятся наши уловки и ответы врага, раскрытые обманы и вести от Ока.', X + 16, y, WW - 32, UIC.dim, { f: 's', lh: 9 }); return; }
  const sc = wheelScroll(w, L.length - 8); for (const e of L.slice(sc)) { if (y > Y + HH - 40) break; const c = e.c === 'good' ? UIC.good : e.c === 'bad' ? UIC.bad : e.c === 'warn' ? UIC.warn : '#e8dcc0';
    txt(dShort(e.d), X + 16, y, UIC.dim, { f: 's' }); const h = para(e.t, X + 116, y, WW - 132, c, { f: 's', lh: 9 }); hit(X + 12, y - 1, WW - 24, h, { id: 'row_dl' + y }); y += h + 3; } }
function drawIntelWin(w) { const X = 14, Y = 21, WW = 612, HH = 326; winFrame(X, Y, WW, HH, 'Разведка и обман', false);
  tabs(X + 12, Y + 22, ['Что мы знаем', 'Что думает враг', 'Уловки', 'Журнал'], 120);
  [drawKnowTab, drawMindTab, drawTrickTab, drawLogTab][UI.tab || 0](w, X, Y, WW, HH);
  para('«Война — это путь обмана. Если ты и можешь что-нибудь, показывай противнику, будто не можешь; когда ты близко — показывай, будто далеко» (гл. 1).', X + 16, Y + HH - 22, WW - 32, '#a89878', { f: 's', lh: 9 }); }
WIN_EXT.intel = drawIntelWin;
// entry points: the army window, the Eye's window
{ const daw = drawArmyWin; drawArmyWin = function () { daw(); const pa = playerArmy(); if (!pa || !UI.win || UI.win.k !== 'army') return;
  btn('awm_dec', 70 + 360, 26 + 312 - 15, 126, 12, { label: 'Уловки… (I)', active: !!(pa.feint || pa.feign > G.day), onClick: () => { UI.open({ k: 'intel' }); UI.tab = 2; }, tip: ['Ложный марш, притворное отступление, чучела на стенах', { t: 'Окно «Разведка и обман» (I)', c: UIC.dim }] }); }; }
{ const dew = drawEyeWin; drawEyeWin = function (w) { dew(w); sbtn('ey_intel', 14 + 612 - 176, 21 + 326 - 20, 160, 'Разведка и обман (I)…', () => UI.open({ k: 'intel' })); }; }
