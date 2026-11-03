// ===== HERALD (v3.5): war is declared by a herald — a charter signed and sealed, a rider to the enemy's seat; the war begins when he hands it over.
// Theirs ride up to our king with their charter; letters come by mounted messengers, not ravens =====
const HRD = { ua: null, c: null };
Object.assign(ICONS, { raven: 'nnnnn|nwwwn|nwrwn|nwwwn|nnnnn', quill: '......w|....www|...www.|..www..|.ww....|.k.....|k......' });
const heraldSpeed = () => courierSpeed() * 0.7; // cost units a day: ≈28 tiles on a road, ≈15 across fields
const hdn = d => d < 1 ? 'меньше дня' : dn(Math.round(d));
function realmSeat(t) { const S = G.setts[G.realms[t].capital]; if (S && S.ctrl === t) return WD.setts[S.id]; const o = G.setts.find(s => s.ctrl === t); return o ? WD.setts[o.id] : null; }
function heraldTo(t) { return (G.heralds || []).find(h => h.t === t && h.st === 'go'); }
function heraldLeft(h) { return Math.max(0, h.arr - G.day - G.frac); }
function heraldPlan(t) { const ws = realmSeat(t); if (!ws) return null; const [kx, ky] = kingPos(), a = Math.floor(ky) * MW + Math.floor(kx), b = ws.y * MW + ws.x, T = costTable(seasonOf(G.day), true);
  let p = a === b ? [a] : astar(a, b, j => T[j], { river: WD.river, maxN: 600000 }); if (!p || !p.length) p = [a, b];
  const cum = [0]; for (let k = 1; k < p.length; k++) { const f = p[k - 1], q = p[k], dg = f % MW !== q % MW && ((f / MW) | 0) !== ((q / MW) | 0); cum.push(cum[k - 1] + Math.min(isFinite(T[q]) ? T[q] : 3, 9) * (dg ? 1.414 : 1)); }
  return { ws, p, cum, days: Math.max(0.5, cum[cum.length - 1] / heraldSpeed()) }; } // along the land and the roads, fords and bridges — not across the sea
function heraldEta(t) { const pl = heraldPlan(t); return pl ? pl.days : 0; }
function heraldChar(r) { const H = HRD.c || (HRD.c = {}); if (H[r] && H[r].seed === G.seed) return H[r]; const c = pseudoChar(880 + r, 'envoy', 0, 30 + r * 4, 'Герольд'); c.realm = r; c.cul = REALM_DEF[r].key; c.seed = G.seed;
  const L = lookOf(c); L.hs = ['short', 'crop', 'part'][r % 3]; L.beard = r % 2 ? 'mustache' : 'short'; L.fem = false; return H[r] = c; }
function heraldDeclare(t) { if (!alive(t) || G.rel[G.player.realm][t].war) return; if (heraldTo(t)) { UI.alert('reckon', { t, declare: true }); return; } UI.alert('decl', { t }); }
function heraldSend(t, pl) { const p = G.player.realm; pl = pl || heraldPlan(t); if (!pl) { declareWar(p, t); return; }
  const ws = pl.ws, d = pl.days, now = G.day + G.frac;
  const h = { id: G.nextH = (G.nextH || 0) + 1, t, p: pl.p, cum: pl.cum, dep: now, arr: now + d, to: ws.name, st: 'go' };
  (G.heralds = G.heralds || []).push(h); log('Герольд поскакал с грамотой в ' + ws.name + ': ≈' + hdn(d) + ' пути. Война начнётся, когда он её вручит.', 'war');
  UI.toast('Герольд поскакал в ' + ws.name + ' · ≈' + hdn(d)); Snd.sfx('horn_short'); Snd.sfx('gallop');
  if (SCREEN === 'court' && !G.visit && COURT.p && LOCS[COURT.loc]) { const P = COURT.p, n = mkNpc('herald_out' + h.id, heraldChar(p), { visitor: 1, spd: 58, sub: 'Герольд короля' }); npcPlace(n, { loc: COURT.loc, x: P.x + 14, y: P.y + 4, dir: 'down' }); n.away = 0; say(n, 'Будет исполнено, государь!', 3); npcLeave(n); }
  if (typeof TUT !== 'undefined') TUT.ev('declare', t); }
function heraldFrac(h) { const now = G.day + G.frac; if (h.st === 'go') return clamp((now - h.dep) / Math.max(0.01, h.arr - h.dep), 0, 1); return h.fb * (1 - clamp((now - h.dep2) / Math.max(0.01, h.arr2 - h.dep2), 0, 1)); }
function heraldBack(h, now) { h.fb = heraldFrac(h); h.st = 'back'; h.dep2 = now; h.arr2 = now + Math.max(0.2, (h.arr - h.dep) * h.fb); }
function heraldRecall(h) { heraldBack(h, G.day + G.frac); h.reply = null; h.recalled = 1;
  log('Герольда вернули с дороги: войны с ' + realmName(h.t) + ' не будет — пока.', 'info'); UI.toast('Герольд поворачивает коня назад.'); }
function heraldArrive(h, now) { const p = G.player.realm, t = h.t; heraldBack(h, now);
  if (!alive(t)) { log('Герольд не застал адресата: держава ' + realmName(t) + ' пала.', 'info'); return; }
  if (G.rel[p][t].war) { log('Герольд вручил грамоту в ' + h.to + ' — но война уже идёт.', 'info'); return; }
  log('Герольд вручил грамоту в ' + h.to + '.', 'info'); declareWar(p, t); const ru = rulerOf(t), tr = ru.traits || []; h.rn = ru.title + ' ' + ru.name;
  h.reply = tr.includes('proud') || tr.includes('wrathful') ? R.pick(['Пусть приходит — встретим у стен.', 'Передай своему королю: он пожалеет.']) : tr.includes('craven') ? R.pick(['Неужели нельзя было решить миром?', 'Мы… мы готовы говорить о мире.']) : tr.includes('cunning') ? 'Посмотрим, чья возьмёт.' : R.pick(['Да будет так.', 'Война так война.', 'Бог рассудит.']);
  UI.toast('Грамота вручена: война с ' + realmName(t) + '!'); }
function heraldsAdvance() { const L = G.heralds; if (!L || !L.length) return; const now = G.day + G.frac;
  for (let i = L.length - 1; i >= 0; i--) { const h = L[i]; if (h.st === 'go' && now >= h.arr) heraldArrive(h, now);
    else if (h.st === 'back' && now >= h.arr2) { L.splice(i, 1); if (h.reply) log('Герольд вернулся. ' + h.rn + ' ответил: «' + h.reply + '»', 'info'); } } }
{ const ca = couriersAdvance; couriersAdvance = function (dd) { ca(dd); heraldsAdvance(); }; }
function heraldPos(h) { const f = heraldFrac(h), P = h.p, C = h.cum, tot = C[C.length - 1] || 1, c = f * tot; let k = 1; while (k < C.length - 1 && C[k] < c) k++;
  const a = P[k - 1], b = P[Math.min(k, P.length - 1)], u = C[k] > C[k - 1] ? clamp((c - C[k - 1]) / (C[k] - C[k - 1]), 0, 1) : 1, ax = a % MW, ay = (a / MW) | 0, bx = b % MW, by = (b / MW) | 0;
  const dirx = h.st === 'go' ? bx - ax : ax - bx; return [ax + (bx - ax) * u + 0.5, ay + (by - ay) * u + 0.5, dirx < 0 || (dirx === 0 && h.lastL)]; }
// on the map: a rider on a white horse under the king's banner, a dotted line to where he is going
function drawHeralds() { const L = G.heralds; if (!L || !L.length) return; const s = cam.z >= 1.6 ? 2 : 1, D = REALM_DEF[G.player.realm];
  for (const h of L) { const [x, y, left] = heraldPos(h), [wx, wy] = MAPR.warpPt(x * TS, y * TS), [sx, sy] = w2s(wx, wy);
    if (h.st === 'go') { const P = h.p, C = h.cum, tot = C[C.length - 1] || 1, f = heraldFrac(h); ctx.globalAlpha = 0.65; let last = -1e9;
      for (let k = 1; k < P.length; k++) { if (C[k] / tot <= f || C[k] - last < 3) continue; last = C[k]; const [qx, qy] = MAPR.warpPt((P[k] % MW + 0.5) * TS, (((P[k] / MW) | 0) + 0.5) * TS), [px, py] = w2s(qx, qy); rect(Math.round(px), Math.round(py - 3), s, s, D.light); } ctx.globalAlpha = 1; }
    if (sx < -14 * s || sy < -16 * s || sx > W + 14 * s || sy > H + 16 * s) continue; const b = Math.round(Math.abs(Math.sin(NOW * 10 + h.id))) * s, fl = left ? -1 : 1;
    const R2 = (x, y, w, hh, c) => rect(sx + (fl > 0 ? x : -x - w + 1) * s, sy + y * s - b, w * s, hh * s, c);
    ctx.globalAlpha = 0.35; rect(sx - 4 * s, sy + s, 9 * s, 2 * s, '#0c0a10'); ctx.globalAlpha = 1;
    R2(-3, -4, 6, 3, '#e4dccb'); R2(3, -6, 2, 3, '#e4dccb'); R2(4, -6, 1, 1, '#8a8070'); R2(-4, -4, 1, 2, '#8a8070'); R2(-3, -1, 1, 2, '#8a8070'); R2(2, -1, 1, 2, '#8a8070'); // a white horse
    R2(-1, -8, 2, 4, D.col); R2(-1, -10, 2, 2, '#f0c8a0'); R2(-2, -16, 1, 9, '#3a2614'); R2(-1, -16, 4, 3, D.col); R2(-1, -13, 3, 1, D.dark); R2(1, -7, 2, 1, '#f7d35c'); // rider in the tabard, banner, trumpet
    hit(sx - 6 * s, sy - 17 * s, 13 * s, 19 * s, { id: 'hrd' + h.id, cursor: true, tip: () => h.st === 'go' ? [{ t: 'Герольд с грамотой', ic: 'shield' + h.t }, 'В ' + h.to + ' (' + realmName(h.t) + ')', { t: 'Ещё ≈' + hdn(heraldLeft(h)) + ' — тогда война', c: UIC.dim }] : ['Герольд возвращается', h.reply ? '«' + h.reply + '»' : h.recalled ? 'Отозван с дороги' : ''] }); } }
{ const dc = drawCouriers; drawCouriers = function () { dc(); drawHeralds(); }; }
// ---------- the charter: three lines, the king's hand, the seal ----------
function drawSignature(name, x, y, p) { if (p <= 0) return; const w = tw(name) + 12; ctx.save(); ctx.beginPath(); ctx.rect(x - 6, y - 8, (w + 6) * p + 2, 26); ctx.clip();
  ctx.translate(x, y); ctx.transform(1, 0, -0.32, 1, 0, 0); txt(name, 0, 0, '#2a2466'); for (let i = 0; i < w; i++) rect(i - 2, 11 + Math.round(Math.sin(i / w * Math.PI * 2.4) * 2), 1, 1, '#2a2466'); ctx.restore();
  if (p < 1) spr('i_quill', Math.round(x - 2 + w * p), y - 6); }
function drawSeal(x, y, s, r) { if (s <= 0) return; const sc = 1 + (1 - s) * 0.9; ctx.save(); ctx.globalAlpha = Math.min(1, s * 1.5); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(sc, sc);
  rect(-6, 6, 4, 11, '#7a141c'); rect(2, 6, 4, 11, '#8a1a22'); rect(-6, 16, 1, 1, '#f3e6c4'); rect(5, 16, 1, 1, '#f3e6c4');
  ctx.fillStyle = '#5a0c12'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a1c24'; ctx.beginPath(); ctx.arc(-0.5, -0.5, 8, 0, Math.PI * 2); ctx.fill();
  spr(tinted('i_crown', '#4a0810'), -2, -3); ctx.restore(); }
function charterBox(x, y, w, h) { rect(x, y, w, h, '#f6ebcf'); rect(x, y, w, 1, '#c9b07a'); rect(x, y + h - 1, w, 1, '#c9b07a'); rect(x, y, 1, h, '#c9b07a'); rect(x + w - 1, y, 1, h, '#c9b07a');
  rect(x + 3, y + 3, w - 6, 1, '#e6d4a8'); rect(x + 3, y + h - 4, w - 6, 1, '#e6d4a8'); }
function drawDeclModal(m) { const o = m.d, t = o.t, p = G.player.realm, k = charOf(G.player.char), ru = rulerOf(t), rr = G.rel[p][t];
  if (!alive(t) || (rr.war && !o.at)) { UI.close(); return; } const [x, y] = dlg(400, 190, 'Грамота');
  const cx = x + 16, cy = y + 24, cw = 368, ch = 104; o.pl = o.pl || heraldPlan(t); charterBox(cx, cy, cw, ch); spr('shield' + p, cx + 10, cy + 8); spr('shield' + t, cx + cw - 24, cy + 8);
  txt('Объявление войны', cx + cw / 2, cy + 10, '#7a1a1a', { al: 'c' });
  para('Мы, ' + k.title.toLowerCase() + ' ' + k.name + ', объявляем: ' + ru.title.toLowerCase() + ' ' + ru.name + ' и держава ' + realmName(t) + ' отныне нам враги. Да рассудит меч.', cx + 40, cy + 32, cw - 80, INK, { lh: 11 });
  const at = o.at, sg = at ? clamp((NOW - at) / 1.1, 0, 1) : 0, se = at ? clamp((NOW - at - 1.25) / 0.25, 0, 1) : 0;
  txt('Подпись:', cx + cw - 168, cy + ch - 24, INK2, { f: 's' }); drawSignature(k.name, cx + cw - 128, cy + ch - 26, sg); drawSeal(cx + 44, cy + ch - 30, se, p);
  const ws = o.pl && o.pl.ws, eta = o.pl ? o.pl.days : 0, broke = rr.truce > G.day || rr.pact > G.day || rr.ally;
  txt('Герольд доскачет до ' + (ws ? ws.name : '?') + ' за ≈' + hdn(eta) + ' — тогда и начнётся война.', x + 200, y + 134, INK2, { al: 'c', f: 's' });
  if (broke) txt('Это нарушит договор: слава −25, соседи осудят.', x + 200, y + 145, '#a0302a', { al: 'c', f: 's' });
  if (!at) { btn('dc_sign', x + 40, y + 164, 190, 16, { label: 'Подписать и отправить', ic: 'i_quill', onClick: () => { o.at = NOW; Snd.sfx('paper'); } }); btn('dc_no', x + 244, y + 164, 116, 16, { label: 'Повременить', onClick: () => UI.close() }); return; }
  if (se >= 1 && !o.thud) { o.thud = 1; Snd.sfx('thud'); }
  txt(se < 1 ? 'Король подписывает…' : 'Печать приложена. Герольд седлает коня.', x + 200, y + 168, INK, { al: 'c' }); if (NOW - at > 2.4 && !o.sent) { o.sent = 1; UI.close(); heraldSend(t, o.pl); } }
// ---------- theirs: the herald rides up to our king; the charter he brings ----------
function drawWarCharter(m) { const r = m.d, ru = rulerOf(r), p = G.player.realm; const [x, y] = dlg(400, 190, 'Герольд с грамотой');
  const s = walkerSprite(heraldChar(r), 'down', 0); ctx.drawImage(s, x + 18, y + 26, 48, 96); spr('shield' + r, x + 35, y + 128);
  const cx = x + 80, cy = y + 24, cw = 304, ch = 104; charterBox(cx, cy, cw, ch); txt('Объявление войны', cx + cw / 2, cy + 10, '#7a1a1a', { al: 'c' });
  para(ru.title + ' ' + ru.name + ' объявляет нам войну. ' + realmName(r) + ' ' + rV(r, 'идёт', 'идёт', 'идут') + ' на нас войной.', cx + 16, cy + 30, cw - 32, INK, { lh: 11 });
  drawSignature(ru.name, cx + cw - 120, cy + ch - 26, 1); drawSeal(cx + 36, cy + ch - 30, 1, r);
  txt('Их сила ≈' + fmt(realmPower(r, p)) + ' · наша ' + fmt(realmPower(p)), x + 232, y + 136, INK2, { al: 'c', f: 's' });
  btn('wm_ok', x + 80, y + 164, 150, 16, { label: 'К оружию!', ic: 'i_sword', onClick: () => UI.close() }); btn('wm_d', x + 240, y + 164, 150, 16, { label: 'Дипломатия', ic: 'i_dip', onClick: () => { UI.close(); UI.open({ k: 'diplo', t: r }); } }); }
Object.assign(MODALS, { decl: drawDeclModal, war: drawWarCharter });
// at court the herald walks up to the king first; the charter opens when he reaches him (or he is spoken to)
HRD.ua = UI.alert; UI.alert = function (k, d) { if (k === 'war' && heraldCourt(d)) return; return HRD.ua.call(this, k, d); };
function heraldCourt(r) { if (SCREEN !== 'court' || G.visit || !COURT.p || COURT.hunt || (typeof HEAL !== 'undefined' && HEAL.on) || !LOCS[COURT.loc] || COURT.npcs.some(n => n.herald === r)) return false;
  const L = LOCS[COURT.loc]; let sp = null; if (COURT.loc === 'yard') sp = LOCS.yard.spots.gate_out; else { const dr = (L.doors || []).find(d => d.to === 'yard') || (L.doors || [])[0]; if (dr) sp = { loc: COURT.loc, x: dr.ax, y: dr.ay, dir: 'down' }; }
  if (!sp) return false; const n = mkNpc('herald' + r, heraldChar(r), { visitor: 1, spd: 52, herald: r, hT: NOW, sub: 'Герольд · ' + realmName(r), talk: x => heraldMeet(x) }); npcPlace(n, sp); n.away = 0; n.loc = COURT.loc;
  heraldChase(n); UI.toast('Герольд державы ' + realmName(r) + ' спешит к королю с грамотой!'); Snd.sfx('fanfare_small'); return true; }
function heraldChase(n) { const P = COURT.p, L = LOCS[COURT.loc], [tx, ty] = nearFree(L, Math.floor(P.x / CT), Math.floor(P.y / CT) + 1); n.cx = P.x; n.cy = P.y; npcGoToSp(n, { loc: COURT.loc, x: tx * CT + 8, y: ty * CT + 12, dir: 'up' }, x => heraldMeet(x)); }
function heraldMeet(n) { if (n.herald === undefined || n.herald === null) return; const r = n.herald; n.herald = null; n.dir = 'up'; n.talk = x => DLG.say(x, 'Ответ мой государь получит на поле брани.'); say(n, 'Грамота от ' + rulerTN(r) + '!', 4); Snd.sfx('horn_short'); HRD.ua.call(UI, 'war', r); n.leaveT = NOW + 2; }
UPD_EXT.push(dt => { if (!COURT.npcs) return; const P = COURT.p; for (const n of COURT.npcs) { if (n.herald !== undefined && n.herald !== null) { if (!P || n.loc !== COURT.loc || NOW - n.hT > 25) { heraldMeet(n); continue; } if (Math.hypot(P.x - n.cx, P.y - n.cy) > 40) heraldChase(n); if (Math.hypot(P.x - n.x, P.y - n.y) < 26) heraldMeet(n); }
  else if (n.leaveT && NOW > n.leaveT && !UI.modalOpen()) { n.leaveT = 0; npcLeave(n); } } });
