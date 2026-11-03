'use strict';
// ===== SCREENS 2 (from screens.js): realm, menu, treatise, modal dialogs, title & new game =====
// ---------- realm ----------
function drawRealmWin() {
  const X = 40, Y = 24, WW = 560, HH = 316, p = G.player.realm, R0 = G.realms[p]; winFrame(X, Y, WW, HH, 'Держава: ' + REALM_DEF[p].name, false);
  const T = ['Казна', 'Хозяйство', 'Земли', 'Лазутчики', 'Летопись', 'Победа']; tabs(X + 12, Y + 22, T, 84); const tab = T[UI.tab] || T[0]; let y = Y + 42;
  const wheel = input.wheel; if (wheel && HOVER && HOVER.id === 'blocker') UI.scroll = Math.max(0, UI.scroll + wheel * 3);
  if (tab === 'Казна') {
    kv(X + 16, y, 'Казна:', Math.round(R0.gold) + ' зол.', false, R0.gold < 0 ? UIC.bad : PAL.y); y += 12; kv(X + 16, y, 'Доход:', '+' + (R0.inc || 0).toFixed(1) + '/день', false, UIC.good); kv(X + 160, y, 'Расход:', '−' + (R0.exp || 0).toFixed(1) + '/день', false, UIC.bad); y += 12; kv(X + 16, y, 'Слава:', String(Math.round(R0.prestige || 0)), false); kv(X + 160, y, 'Страх перед нами:', String(Math.round(R0.fear || 0)), false); y += 16;
    y = drawTreasuryTab(X, y, WW);
    para('«Когда войско долго в походе — государству не хватает средств… Не бывало, чтобы война длилась долго и государству была от того польза» (гл. 2).', X + 16, y, WW - 32, '#e8d8b0', { f: 's', lh: 9 });
  } else if (tab === 'Хозяйство') { drawRealmGoodsTab(X, y, WW);
  } else if (tab === 'Земли') {
    const L = G.setts.filter(S => S.ctrl === p && WD.setts[S.id].type !== 'village'); txt('Крепость', X + 16, y, '#c8b898', { f: 's' }); txt('Тип', X + 130, y, '#c8b898', { f: 's' }); txt('Гарн.', X + 190, y, '#c8b898', { f: 's' }); txt('Процв.', X + 230, y, '#c8b898', { f: 's' }); txt('Разор.', X + 275, y, '#c8b898', { f: 's' }); txt('Смута', X + 320, y, '#c8b898', { f: 's' }); txt('Запасы', X + 365, y, '#c8b898', { f: 's' }); y += 11;
    UI.scroll = Math.min(UI.scroll, Math.max(0, L.length - 22));
    L.slice(UI.scroll, UI.scroll + 22).forEach((S, i) => { const ws = WD.setts[S.id], P = G.provs[ws.prov]; const yy = y + i * 11; if (i % 2) rect(X + 12, yy - 2, WW - 24, 11, 'rgba(255,255,255,0.04)'); txt(ws.name, X + 16, yy, S.siege ? UIC.bad : PAL.w, { f: 's' }); txt({ castle: 'замок', town: 'город', capital: 'столица' }[ws.type], X + 130, yy, PAL.w, { f: 's' }); txt(String(menOf(S.gar)), X + 190, yy, PAL.w, { f: 's' }); txt(Math.round(S.prosp) + '%', X + 230, yy, PAL.w, { f: 's' }); txt(Math.round(P.dev * 100) + '%', X + 275, yy, P.dev > 0.3 ? UIC.bad : PAL.w, { f: 's' }); txt(Math.round(P.unrest) + '%', X + 320, yy, P.unrest > 50 ? UIC.bad : PAL.w, { f: 's' }); txt(Math.round(S.food) + ' дн.', X + 365, yy, PAL.w, { f: 's' }); hit(X + 12, yy - 2, WW - 24, 11, { id: 'rl' + S.id, cursor: true, onClick: () => { UI.shut(); const [wx, wy] = settWorld(ws); centerOn(wx, wy); }, tip: 'Показать на карте' }); });
  } else if (tab === 'Лазутчики') {
    para('«Просвещённый государь и мудрый полководец побеждают потому, что знают наперёд. Знание наперёд нельзя получить от духов… его получают от людей» (гл. 13).', X + 16, y, WW - 32, '#e8d8b0', { f: 's', lh: 9 }); y += 24;
    const act = G.spies.filter(s => s.until >= G.day); txt('Действуют: ' + (act.length ? '' : 'нет'), X + 16, y, PAL.y); y += 11;
    act.slice(0, 8).forEach(s => { txt(SPYT[s.type].n + (s.realm !== undefined ? ' — ' + realmName(s.realm) : '') + (s.prov !== undefined ? ' — ' + WD.provs[s.prov].name : '') + ' · ещё ' + (s.until - G.day) + ' дн.', X + 22, y, PAL.w, { f: 's' }); y += 10; });
    y = Math.max(y, Y + 180); txt('Нанять:', X + 16, y, PAL.y); y += 12;
    btn('sp_local', X + 16, y, 250, 13, { label: 'Местный лазутчик — ' + SPYT.local.cost + ' зол.', ic: 'i_spy', disabled: R0.gold < SPYT.local.cost, tip: [SPYT.local.n, SPYT.local.d, { t: 'Затем щёлкните провинцию на карте.', c: UIC.dim }], onClick: () => { UI.target = { kind: 'local' }; UI.shut(); UI.toast('Щёлкните провинцию, где нужны проводники.'); } });
    btn('sp_surv', X + 276, y, 250, 13, { label: 'Живой лазутчик — ' + SPYT.surviving.cost + ' зол.', ic: 'i_spy', disabled: R0.gold < SPYT.surviving.cost, tip: [SPYT.surviving.n, SPYT.surviving.d, { t: 'Затем щёлкните место на карте.', c: UIC.dim }], onClick: () => { UI.target = { kind: 'surviving' }; UI.shut(); UI.toast('Щёлкните место, куда послать лазутчика.'); } }); y += 16;
    para('Внутренних, обращённых и обречённых лазутчиков засылают к чужим дворам — в окне «Дипломатия».', X + 16, y, WW - 32, '#c8b898', { f: 's', lh: 9 });
  } else if (tab === 'Летопись') {
    const L = G.log.slice().reverse(); UI.scroll = Math.min(UI.scroll, Math.max(0, L.length - 24)); let yy = y;
    for (const e of L.slice(UI.scroll)) { const lines = wrap(e.t, WW - 90, { f: 's' }); if (yy + lines.length * 9 > Y + HH - 8) break; txt(dateStr(e.d).replace(' · ', ' ').split(' · ')[0], X + 16, yy, '#9a8a70', { f: 's' }); lines.forEach((l, i) => txt(l, X + 74, yy + i * 9, { good: UIC.good, bad: UIC.bad, war: '#ff8a6a', title: PAL.y, season: '#bfe8f0' }[e.c] || PAL.w, { f: 's' })); yy += lines.length * 9 + 2; }
  } else {
    const caps = [0, 1, 2, 3, 4].map(r => G.realms[r].capital); const held = caps.filter((c, r) => r !== p && G.setts[c].ctrl === p).length;
    txt('Победа мечом', X + 16, y, PAL.y); y += 11; para('Удержать свою столицу и взять две чужие. Сейчас: ' + held + ' из 2.', X + 16, y, WW - 32, PAL.w); y += 12;
    caps.forEach((c, r) => { if (r === p) return; const S = G.setts[c]; spr('shield' + S.ctrl, X + 20 + (r - 1) * 130, y); txt(WD.setts[c].name, X + 34 + (r - 1) * 130, y + 2, S.ctrl === p ? UIC.good : PAL.w, { f: 's' }); }); y += 22;
    const v = councilVotes(), n = v.filter(e => e.c === p).length; txt('Победа словом', X + 16, y, PAL.y); y += 11; para('Совет короны собирается в начале каждой зимы. Если 3 из 5 правителей (вместе с нами) назовут короля Верховным — победа без войны. Сейчас за нас: ' + n + '.', X + 16, y, WW - 32, PAL.w); y += 24;
    para('«Сто раз сразиться и сто раз победить — это не лучшее из лучшего. Лучшее из лучшего — покорить чужое войско, не сражаясь» (гл. 3).', X + 16, y, WW - 32, '#e8d8b0'); y += 26;
    txt('Битв: ' + G.stats.battles + ' (побед ' + G.stats.won + ') · взято крепостей: ' + G.stats.sieges + ' · дней в походе: ' + G.day, X + 16, y, PAL.w);
    if (G.lastCouncil) { y += 14; txt('Последний совет: за нас ' + G.lastCouncil.n + ' ' + plural(G.lastCouncil.n, 'голос', 'голоса', 'голосов') + '.', X + 16, y, '#c8b898'); }
  }
}
// ---------- menu ----------
function drawMenuWin() {
  const X = W / 2 - 90, Y = 40, WW = 180, HH = 254; winFrame(X, Y, WW, HH, 'Меню', false);
  let y = Y + 26; const B = (id, label, f, o) => { btn(id, X + 20, y, WW - 40, 16, Object.assign({ label, onClick: f }, o || {})); y += 20; };
  B('m_cont', 'Продолжить', () => UI.shut());
  B('m_save', 'Сохранить', () => { UI.toast(saveGame() ? 'Сохранено.' : 'Не удалось сохранить.'); UI.shut(); });
  B('m_load', 'Загрузить', () => { UI.shut(); startLoad(); }, { disabled: !saveOk(), tip: hasSave() && !saveOk() ? OLDSAVE_TIP : undefined });
  B('m_snd', 'Звук…', () => sndOpen());
  B('m_tut', 'Обучение: ' + (G.tut.on ? 'вкл' : 'выкл'), () => { G.tut.on = !G.tut.on; });
  B('m_adv', 'Советы: ' + (advOn() ? 'вкл' : 'выкл'), () => { const A = advS(); A.on = A.on ? 0 : 1; if (A.on) { A.seen = {}; ADV.done = ''; } }, { tip: ['Советы при входе', 'Когда король впервые входит в комнату, здание, лес, на охоту или выезжает за ворота, советник подсказывает, что там можно сделать. Включив снова, вы услышите все советы заново.'] });
  B('m_font', 'Шрифт: ' + (VF.on ? 'книжный' : 'пиксельный'), () => { OPTS.pixfont = VF.on ? 1 : 0; saveOpts(); setBookFont(!OPTS.pixfont); }, { tip: ['Шрифт', 'Книжный — гладкий и чёткий, легче читать. Пиксельный — как в старых играх. Заголовки окон всегда пиксельные.'] });
  B('m_ap', 'Автопауза: ' + (OPTS.autoPause ? 'вкл' : 'выкл'), () => { OPTS.autoPause = !OPTS.autoPause; saveOpts(); }, { tip: ['Автопауза', 'Время само встаёт на паузу, когда войско короля дошло до цели или остановилось, когда вы выходите из города, выезжаете из замка и после битвы.', { t: 'Пробел — снять паузу.', c: UIC.dim }] });
  B('m_help', 'Управление', () => { UI.shut(); UI.alert('help'); });
  B('m_exit', 'Выйти в главное меню', () => { saveGame(); UI.shut(); UI.modals = []; SCREEN = 'title'; Snd.music('title'); });
}
// ---------- book (treatise) ----------
function drawBookWin(w) {
  const X = 20, Y = 18, WW = 600, HH = 326; winFrame(X, Y, WW, HH, 'Трактат «Искусство войны» · Сунь-цзы', true);
  const L = TUT.pages(); let ly = Y + 24;
  L.forEach((pg, i) => { const sel = w.ch === i; const done = pg.lesson !== undefined && G.tut.done.includes(pg.lesson); if (sel) rect(X + 8, ly - 2, 168, 11, 'rgba(160,110,50,0.35)'); txt(pg.short, X + 12, ly, pg.ref ? '#5a4a8a' : INK, { f: 's' }); if (done) spr('i_star', X + 166, ly - 1); hit(X + 8, ly - 2, 168, 11, { id: 'bk' + i, cursor: true, onClick: () => { w.ch = i; UI.scroll = 0; } }); ly += 11; });
  const pg = L[w.ch] || L[0]; const RX = X + 186, RW = WW - 200; let y = Y + 24;
  txt(pg.title, RX, y, INK); y += 13;
  if (pg.quote) { y += para('«' + pg.quote + '»', RX + 6, y, RW - 12, '#6a3a1a', { lh: 10 }) + 6; }
  const body = pg.body(); const lines = wrap(body, RW, {}); const maxL = Math.floor((Y + HH - 14 - y) / 10);
  if (input.wheel && HOVER && HOVER.id === 'blocker') UI.scroll = clamp(UI.scroll + input.wheel * 2, 0, Math.max(0, lines.length - maxL));
  lines.slice(UI.scroll, UI.scroll + maxL).forEach((l, i) => txt(l, RX, y + i * 10, l.startsWith('→') || l.startsWith('В игре') ? '#2a5a2a' : INK));
  if (lines.length > maxL) txt((UI.scroll + maxL < lines.length ? 'ниже ещё · ' : '') + 'колесо — листать', RX + RW - 4, Y + HH - 12, INK2, { al: 'r', f: 's' });
}
// ---------- modal dialogs ----------
function dlg(w, h, title, parch) { const x = Math.round(W / 2 - w / 2), y = Math.round(H / 2 - h / 2); blocker(); dim(0.5); if (parch !== false) panelParch(x, y, w, h); else panelWood(x, y, w, h); if (title) { txt(title, x + w / 2, y + 8, parch !== false ? INK : PAL.y, { al: 'c', sh: parch === false ? PAL.o : undefined, px: 1 }); if (parch !== false) hline(x + 12, y + 18, w - 24, '#b89a68'); } return [x, y]; }
function adviceByRatio(r) {
  if (r >= 8) return 'Сил вдесятеро больше — окружай.'; if (r >= 4) return 'Сил впятеро больше — нападай.'; if (r >= 1.8) return 'Сил вдвое больше — раздели врага и бей по частям.';
  if (r >= 0.85) return 'Силы равны — сражайся умело: местность и хитрость решат.'; if (r >= 0.5) return 'Сил меньше — умей оторваться от врага.'; return 'Враг много сильнее — уклоняйся. «Упорство слабого — добыча сильного».';
}
function sideCard(x, y, w, a, title, isP) {
  const g = charOf(a.gen), e = estimateMen(a); rect(x, y, w, 96, 'rgba(160,120,60,0.15)');
  if (g && a.kind !== 'caravan') drawPortrait(g, x + 4, y + 4, 1); else { spr('shield' + a.realm, x + 20, y + 20, { scale: 2 }); }
  txt(title, x + 56, y + 4, INK); txt(g ? charName(g) : '', x + 56, y + 14, INK2, { f: 's' });
  txt((e.exact ? '' : '~') + voin(e.n), x + 56, y + 24, INK);
  if (e.exact || isP) UT.filter(t => a.u[t] > 0).forEach((t, i) => { const gx = x + 56 + (i % 4) * 37, gy = y + 35 + Math.floor(i / 4) * 10; spr(UICON[t], gx, gy); txt(String(Math.round(a.u[t])), gx + 7, gy, INK, { f: 's' }); hit(gx, gy - 1, 34, 9, { id: 'sc' + (isP ? 'p' : 'e') + t, tip: UNIT[t].n }); });
  txt('Дух ' + Math.round(a.morale) + ' · устал. ' + Math.round(a.fat) + '%', x + 6, y + 58, INK2, { f: 's' });
  const gr = GROUNDS[(a.kind === 'lord' || a.kind === 'player') ? groundOf(a) : 'open']; txt('Земля: ' + gr.n, x + 6, y + 68, INK2, { f: 's' }); hit(x + 4, y + 66, w - 8, 10, { id: 'scg' + a.id, tip: [gr.n, '«' + gr.q + '»', gr.e] });
  if (a.mode === 'fort' && a.fortDays >= 2) txt('Укреплённый лагерь!', x + 6, y + 78, '#a0302a', { f: 's' }); else if (a.hidden) txt('Затаились в засаде', x + 6, y + 78, '#2a6a2a', { f: 's' });
}
function drawEncounter(m) {
  const b = armyById(m.d), pa = playerArmy(); if (!b || !pa) { UI.close(); return; }
  const hunting = b.ai && b.ai.task === 'hunt' && b.ai.prey === pa.id; const amb = pa.hidden && !hunting; const bAmb = b.hidden && !G.player.follow;
  const [x, y] = dlg(460, 262, amb ? 'Засада! Враг идёт прямо на нас' : hunting ? 'На нас напали!' : 'Встреча с врагом'); const T = WD.ter[armyTile(pa)], Wt = weatherOf();
  sideCard(x + 12, y + 24, 214, pa, 'Войско короля', true); sideCard(x + 234, y + 24, 214, b, armyLabel(b), false);
  const ratio = powerU(pa.u, pa.xp) / Math.max(1, perceivedPower(b, G.player.realm) * (b.fires ? 1 / 1.8 : 1) * (estimateMen(b).n / Math.max(1, armyMen(b)))); 
  txt('Местность: ' + TINFO[T].n + (WD.river[armyTile(pa)] ? ', река' : '') + ' · погода: ' + Wt.n, x + 14, y + 126, INK, { f: 's' });
  txt('Сунь-цзы: «' + adviceByRatio(ratio) + '»', x + 14, y + 137, '#6a3a1a');
  const sp = armySpeed(pa), sb = armySpeed(b); let rc = clamp(0.5 + (sp - sb) / Math.max(1, sb) * 0.9 + (hunting ? -0.15 : 0.2), 0.1, 0.95);
  const dem = clamp((ratio - 1.5) * 0.18 + (b.kind === 'caravan' ? 0.25 : 0) + (b.kind === 'bandit' ? 0.05 : -0.1) + (b.morale < 40 ? 0.15 : 0) + (G.realms[G.player.realm].fear || 0) * 0.003, 0, 0.9);
  let by = y + 154; const bw = 212;
  btn('e_fight', x + 14, by, bw, 15, { label: amb ? 'Ударить из засады — командовать' : 'В бой — командовать', ic: 'i_sword', onClick: () => { UI.close(); const o = { b: b.id, tplA: amb && mountedN(pa.u) > 0 ? 'amb' : 'std', amb }; startBattle(sideFromArmy(pa), sideFromArmy(b), armyTile(pa), o); } });
  btn('e_auto', x + 234, by, bw, 15, { label: 'Автобой', ic: 'i_hourglass', onClick: () => { UI.close(); if (amb) b.morale -= 20; const res = autoBattle(pa, b); res.auto = true; res.amb = amb; UI.alert('bres', res); if (typeof TUT !== 'undefined') TUT.ev('battle', res); } }); by += 19;
  btn('e_dem', x + 14, by, bw, 15, { label: 'Потребовать сдачи (' + Math.round(dem * 100) + '%)', ic: 'i_flag', disabled: dem <= 0.01, tip: ['«Лучшее — сохранить чужое войско целым» (гл. 3).', 'Шанс растёт с перевесом сил, нашей славой и упадком их духа.'], onClick: () => { UI.close(); G.encCool[b.id] = G.day + G.frac + 2; if (R.f() < dem) { const loot = { food: Math.round(b.food * 0.7), arrows: Math.round(b.arrows * 0.7), gold: Math.round((b.goods || 0) * 0.8 + (b.loot || 0) + (b.kind === 'bandit' ? 15 : 0)) }; pa.food += loot.food; pa.arrows += loot.arrows; G.realms[G.player.realm].gold += loot.gold; pa.prisoners = (pa.prisoners || 0) + Math.round(armyMen(b) * 0.5); destroyArmy(b, 'сдались'); G.realms[G.player.realm].prestige += 2; G.realms[G.player.realm].fear = (G.realms[G.player.realm].fear || 0) + 2; log(armyLabel(b) + ' сложили оружие! Добыча: ' + loot.gold + ' зол., провиант ' + loot.food + '.', 'good'); if (typeof TUT !== 'undefined') TUT.ev('surrender', b.id); } else { log(armyLabel(b) + ': «Не дождётесь!» — сдаться отказались.', 'bad'); b.morale += 5; UI.alert('enc', b.id); } } });
  btn('e_ret', x + 234, by, bw, 15, { label: 'Отступить (' + Math.round(rc * 100) + '%)', ic: 'i_play3', tip: 'Если не выйдет — арьергард прикроет отход ценой потерь.', onClick: () => { UI.close(); G.encCool[b.id] = G.day + G.frac + 1.5; if (R.f() < rc) { retreatArmy(pa, b); log('Войско отступило без потерь.', 'info'); } else { const k = takeMen(pa, Math.round(armyMen(pa) * 0.07)); pa.morale -= 8; retreatArmy(pa, b); log('Отход стоил ' + voin(k) + ' арьергарда.', 'bad'); } } }); by += 19;
  if (!hunting) btn('e_pass', x + 14, by, bw, 15, { label: 'Пропустить их', onClick: () => { UI.close(); G.encCool[b.id] = G.day + G.frac + 2; } });
  if (b.kind !== 'bandit' && b.kind !== 'caravan' && b.realm < 5) btn('e_dip', x + 234, by, bw, 15, { label: 'Переговоры (дипломатия)', ic: 'i_dip', onClick: () => { UI.close(); G.encCool[b.id] = G.day + G.frac + 1; UI.open({ k: 'diplo', t: b.realm }); } });
}
function drawMsgModal(m) {
  const o = m.d; if (o.done) { UI.close(); return; } const [x, y] = dlg(380, 170, 'Гонец с письмом');
  const ru = rulerOf(o.from); drawPortrait(ru, x + 14, y + 26, 1); spr('shield' + o.from, x + 26, y + 78);
  txt(ru.title + ' ' + ru.name + ' (' + realmName(o.from) + ')', x + 72, y + 26, INK); para(o.text, x + 72, y + 40, 294, INK, { lh: 10 });
  const yes = o.kind === 'peace' ? 'Принять мир' : o.kind === 'call' ? 'Выступить на помощь' : o.kind === 'ransom' ? 'Принять выкуп' : 'Согласиться', no = o.kind === 'call' ? 'Отказать (союз будет разорван)' : 'Отказать';
  btn('mg_y', x + 20, y + 140, 160, 16, { label: yes, onClick: () => { answerMsg(o, true); UI.close(); } }); btn('mg_n', x + 200, y + 140, 160, 16, { label: no, onClick: () => { answerMsg(o, false); UI.close(); } });
}
function drawEventModal(m) {
  const { e, text } = m.d; const lines = wrap(text, 330); const h = Math.max(150, 60 + lines.length * 10 + e.opts.length * 19); const [x, y] = dlg(420, h, e.title);
  spr('i_' + e.ic, x + 20, y + 30, { scale: 4 }); lines.forEach((l, i) => txt(l, x + 66, y + 26 + i * 10, INK));
  e.opts.forEach((o, i) => { const ok = !o.ok || o.ok(); btn('ev' + i, x + 20, y + h - 22 - (e.opts.length - 1 - i) * 19, 380, 15, { label: o.t, disabled: !ok, tip: o.tip, onClick: () => { o.fx(); UI.close(); if (typeof TUT !== 'undefined') TUT.ev('event', e.id); } }); });
}
function drawWarModal(m) {
  const r = m.d, ru = rulerOf(r); const [x, y] = dlg(380, 170, 'Война!'); drawPortrait(ru, x + 14, y + 26, 1); spr('shield' + r, x + 26, y + 78);
  txt(ru.title + ' ' + ru.name + ' объявляет войну!', x + 72, y + 26, '#a0302a'); para('Держава ' + realmName(r) + ' ' + rV(r, 'идёт', 'идёт', 'идут') + ' на нас. Их сила: ~' + fmt(realmPower(r, G.player.realm)) + ', наша: ' + fmt(realmPower(G.player.realm)) + '.\n«Не надейся, что враг не придёт, — надейся на то, что ты готов его встретить» (гл. 8).', x + 72, y + 40, 294, INK, { lh: 10 });
  btn('wm_ok', x + 20, y + 140, 160, 16, { label: 'К оружию!', onClick: () => UI.close() }); btn('wm_d', x + 200, y + 140, 160, 16, { label: 'Дипломатия', onClick: () => { UI.close(); UI.open({ k: 'diplo', t: r }); } });
}
function drawCouncilModal(m) {
  const v = m.d, p = G.player.realm, n = v.filter(e => e.c === p).length; const [x, y] = dlg(460, 200, 'Совет короны · зима ' + yearOf(G.day) + ' года');
  v.forEach((e, i) => { const xx = x + 14 + i * 88; drawPortrait(rulerOf(e.x), xx + 10, y + 26, 1); txt(REALM_DEF[e.x].name, xx + 34, y + 78, INK, { al: 'c', f: 's' }); txt('→', xx + 34, y + 89, INK2, { al: 'c' }); spr('shield' + e.c, xx + 29, y + 99); txt(REALM_DEF[e.c].name, xx + 34, y + 114, e.c === p ? '#2a6a2a' : INK, { al: 'c', f: 's' }); });
  para(n >= 3 ? 'Совет признал короля ' + rulerOf(p).name + ' Верховным королём!' : 'За короля ' + rulerOf(p).name + ' — ' + n + ' из ' + v.length + '. Нужно 3. Мнение правителей, слава и страх решают голоса. Совет соберётся снова следующей зимой.', x + 14, y + 132, 432, INK, { lh: 10 });
  btn('cm_ok', x + 150, y + 172, 160, 16, { label: 'Да будет так', onClick: () => UI.close() });
}
function drawCapturedModal(m) {
  const sid = m.d, ws = WD.setts[sid], S = G.setts[sid], pa = playerArmy(); const [x, y] = dlg(400, 160, 'Взят ' + ws.name + '!');
  const sp = settSprite(ws.type, WD.provs[ws.prov].cul || 'K', sid); ctx.drawImage(sp.c, x + 14, y + 30);
  para('Ворота открыты, стяг державы поднят над башнями. Что делать с городом? «На тяжёлой земле — грабь», учит Сунь-цзы, но разграбленные земли долго не дадут дохода и озлобят соседей.', x + 80, y + 26, 306, INK, { lh: 10 });
  if (!pa) { btn('cp_ok', x + 120, y + 132, 160, 16, { label: 'Далее', onClick: () => UI.close() }); return; }
  const est = Math.round(S.pop / 40 * (S.prosp / 60) * (1 - G.provs[ws.prov].dev));
  btn('cp_loot', x + 14, y + 130, 180, 16, { label: 'Разграбить (~' + est + ' зол.)', ic: 'i_gold', tip: 'Золото и провиант сейчас; процветание −25, смута +30, мнение соседей падает.', onClick: () => { const r = lootSett(pa, S); log('Разграблен ' + ws.name + ': +' + r.gold + ' зол., +' + r.food + ' провианта.', 'info'); UI.close(); } });
  btn('cp_spare', x + 206, y + 130, 180, 16, { label: 'Пощадить жителей', ic: 'i_dip', tip: 'Смута −20; честные правители оценят.', onClick: () => { G.provs[ws.prov].unrest = Math.max(0, G.provs[ws.prov].unrest - 20); for (let r = 1; r < 5; r++) if (rulerOf(r).traits.includes('honest') || rulerOf(r).traits.includes('generous')) addOpn(r, G.player.realm, 3); UI.close(); } });
}
function drawBattleResult(m) {
  const res = m.d; const pw = res.auto ? (res.winA !== undefined ? res.winA : res.win) : res.win === 0; const our = res.sides[0], their = res.sides[1];
  const [x, y] = dlg(380, 190, pw ? 'Победа!' : 'Поражение');
  spr(pw ? 'i_crown' : 'i_flag', x + 20, y + 30, { scale: 4 });
  let yy = y + 28; txt('Наши потери: ' + our.lost + ' (убито ' + our.killed + ', ранено ' + our.wounded + ')', x + 64, yy, INK); yy += 12;
  txt('Потери врага: ' + their.lost, x + 64, yy, INK); yy += 12;
  if (pw && res.loot) { const L = res.loot; const parts = []; if (L.gold) parts.push(L.gold + ' зол.'); if (L.food) parts.push('провиант ' + L.food); if (L.arrows) parts.push('стрелы ' + L.arrows); if (L.weap) parts.push('оружие ' + L.weap); if (L.horses) parts.push('кони ' + L.horses); if (L.prisoners) parts.push('пленные ' + L.prisoners); if (parts.length) { yy += para('Добыча: ' + parts.join(', ') + '.', x + 64, yy, 300, INK, { lh: 10 }); } }
  if (res.genFate) { yy += para(res.genFate, x + 64, yy, 300, res.genBad ? '#a0302a' : '#2a6a2a', { lh: 10 }) + 2; }
  yy += 4; para(pw ? '«Победоносное войско сначала побеждает, а потом ищет сражения» (гл. 4).' : '«Непобедимость — в себе самом, возможность победы — в противнике» (гл. 4). Отдохните, пополните ряды.', x + 64, yy, 300, '#6a3a1a', { lh: 10 });
  btn('br_ok', x + 110, y + 162, 160, 16, { label: 'Далее', onClick: () => { UI.close(); if (res.sett !== undefined && pw && G.setts[res.sett].ctrl !== G.player.realm) { const pa = playerArmy(); if (pa) captureSett(pa, G.setts[res.sett], 'штурм'); } } });
}
function drawReckon(m) {
  const t = m.d.t, rk = reckoning(t); const [x, y] = dlg(470, 270, 'Расчёт в храме предков: мы и ' + realmName(t));
  const qh = para('«Кто ещё до сражения побеждает предварительным расчётом — у того шансов много… По этим семи сопоставлениям я узнаю, кто победит и кто потерпит поражение» (гл. 1).', x + 14, y + 24, 442, '#6a3a1a', { lh: 10 });
  let yy = y + 30 + qh; rk.lines.forEach((l, i) => { if (!l.tie) spr(l.win ? 'i_star' : 'i_close', x + 16, yy + 1); txt(l.q, x + 28, yy, INK); txt(l.tie ? 'поровну' : l.win ? 'мы' : 'они', x + 300, yy, l.tie ? INK2 : l.win ? '#2a6a2a' : '#a0302a'); hit(x + 14, yy - 2, 440, 11, { id: 'rk' + i, tip: [l.q, l.d, 'Мы: ' + Math.round(l.a) + ' · они: ' + (rk.intel || i !== 4 ? Math.round(l.b) : '~' + Math.round(l.b))] }); yy += 13; });
  yy += 4; txt('В нашу пользу: ' + rk.wins + ' из 7', x + 14, yy, rk.wins >= 5 ? '#2a6a2a' : rk.wins <= 2 ? '#a0302a' : INK); yy += 12;
  para(rk.wins >= 5 ? 'Расчёты сулят победу.' : rk.wins >= 4 ? 'Перевес невелик. Победа возможна, но потребует искусства.' : 'Расчёты против нас. «Кто мало рассчитывает — не побеждает».', x + 14, yy, 442, INK, { lh: 10 }); if (!rk.intel) txt('Без внутреннего лазутчика их силы известны лишь примерно.', x + 14, yy + 12, INK2, { f: 's' });
  if (m.d.declare && typeof heraldTo === 'function' && heraldTo(t)) { const hh = heraldTo(t); txt('Герольд уже в пути: ещё ≈' + hdn(heraldLeft(hh)) + '.', x + 235, y + 232, INK2, { al: 'c', f: 's' }); btn('rk_recall', x + 30, y + 244, 190, 16, { label: 'Вернуть герольда', onClick: () => { UI.close(); heraldRecall(hh); } }); btn('rk_no', x + 250, y + 244, 190, 16, { label: 'Пусть скачет', onClick: () => UI.close() }); }
  else if (m.d.declare) { btn('rk_war', x + 30, y + 244, 190, 16, { label: 'Объявить войну', ic: 'i_sword', tip: 'Подписать грамоту — герольд отвезёт её', onClick: () => { UI.close(); heraldDeclare(t); } }); btn('rk_no', x + 250, y + 244, 190, 16, { label: 'Повременить', onClick: () => UI.close() }); }
  else btn('rk_ok', x + 155, y + 244, 160, 16, { label: 'Понятно', onClick: () => { UI.close(); if (typeof TUT !== 'undefined') TUT.ev('reckon', t); } });
}
function drawHelp() {
  const [x, y] = dlg(440, 268, 'Управление'); const L = [['ЛКМ по карте', 'идти туда (покажет путь и дни)'], ['ЛКМ по поселению', 'идти туда; на месте — рынок, набор, осада'], ['ЛКМ по врагу', 'преследовать; при встрече — бой'], ['ПКМ', 'остановиться / сведения о поселении'], ['Перетаскивание', 'двигать карту (или WASD, стрелки)'], ['Колесо / Q E', 'масштаб'], ['Пробел', 'пауза; 1, 2, 3 — скорость'], ['Tab', 'политическая карта / местность'], ['C', 'к войску'], ['V · N · R · B', 'войско · дипломатия · держава · трактат'], ['F · H', 'фуражировка / эта справка'], ['Esc', 'закрыть окно / меню'], ['В бою', 'ЛКМ — отряд, 2×ЛКМ или 1–5 — полк, ПКМ — приказ'], ['В бою', 'Tab — карта, Пробел — пауза, H — рог, G — сплотить']];
  L.forEach(([k, v], i) => { txt(k, x + 16, y + 26 + i * 15, '#6a3a1a'); txt(v, x + 140, y + 26 + i * 15, INK); });
  btn('hp_ok', x + 140, y + 244, 160, 16, { label: 'Понятно', onClick: () => UI.close() });
}
function drawOverModal() {
  const o = G.over; const [x, y] = dlg(420, 200, o.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', false);
  spr(o.win ? 'i_crown' : 'i_flag', x + 20, y + 30, { scale: 4 }); para(o.why, x + 64, y + 30, 340, PAL.w, { lh: 10 });
  txt('Дней: ' + G.day + ' · битв ' + G.stats.battles + ' (побед ' + G.stats.won + ') · крепостей взято: ' + G.stats.sieges, x + 64, y + 100, '#c8b898', { f: 's' });
  if (o.win) btn('ov_c', x + 20, y + 170, 180, 16, { label: 'Править дальше', onClick: () => { G.over.ack = 1; G.overDone = G.over; G.over = null; } });
  btn('ov_t', x + 220, y + 170, 180, 16, { label: 'Главное меню', onClick: () => { localStorage.removeItem('sk3_save'); G.over.ack = 1; SCREEN = 'title'; Snd.music('title'); } });
}
const MODALS = { enc: drawEncounter, approach: m => { UI.close(); UI.open({ k: 'sett', id: m.d }); }, msg: drawMsgModal, event: drawEventModal, war: drawWarModal, council: drawCouncilModal, captured: drawCapturedModal, bres: drawBattleResult, reckon: drawReckon, help: m => (SCREEN === 'court' ? drawHelp3(m) : drawHelp(m)) };
function drawModals() {
  if (G && G.over && !G.over.ack) { drawOverModal(); return; }
  if (!UI.modals.length) return; const m = UI.modals[0];
  const f = MODALS[m.k] || (typeof TUT !== 'undefined' && TUT.modal(m.k)); if (!f) { UI.modals.shift(); return; } f(m);
}
function drawWindow() {
  if (!UI.win) return; const w = UI.win; if (WIN_EXT[w.k]) { WIN_EXT[w.k](w); return; }
  const v3 = { council: drawCouncilWin3, cmd: drawCmdWin, dyn: drawDynWin, tech: drawTechWin, letters: drawLettersWin, eye: drawEyeWin, settinfo: drawSettInfoWin }[w.k];
  if (v3 && G.court) { v3(w); return; }
  if (G.court && !playerArmy() && (w.k === 'army' || w.k === 'sett')) { if (w.k === 'army') drawCmdWin(w); else drawSettInfoWin(w); return; }
  if (w.k === 'goods') { drawGoodsWin(w); return; }
  if (w.k === 'sett') drawSettWin(w); else if (w.k === 'army') drawArmyWin(); else if (w.k === 'diplo') drawDiploWin(w); else if (w.k === 'realm') drawRealmWin(); else if (w.k === 'menu') drawMenuWin(); else if (w.k === 'book') drawBookWin(w);
}
// ---------- tactical battle ----------
// ---------- title / new game / loading ----------
let SCREEN = 'title', LOAD = null; const NEWG = { diff: 1, tut: true, seed: (Date.now() % 99991) + 1, open: false };
let TITLE_BG = null;
function mkTitleBG() {
  const [c, g] = mkCanvas(W, H); const img = g.createImageData(W, H); const b = new Uint32Array(img.data.buffer);
  const sky = [[34, 22, 52], [92, 44, 78], [196, 96, 74], [240, 170, 96]];
  for (let y = 0; y < H; y++) { const t = y / (H * 0.62); const k = clamp(t, 0, 1) * 3; const i = Math.min(2, Math.floor(k)), f = k - i; const A = sky[i], B2 = sky[i + 1]; const d = ((hash2(0, y, 3) * 4) | 0) / 40; for (let x = 0; x < W; x++) { const dd = ((x + y) & 1) ? d : 0; b[y * W + x] = pack(A[0] + (B2[0] - A[0]) * (f + dd), A[1] + (B2[1] - A[1]) * (f + dd), A[2] + (B2[2] - A[2]) * (f + dd)); } }
  g.putImageData(img, 0, 0);
  { const SX = 318, SY = 172; // setting sun: glow rings + sunset stripes
    for (let r = 46; r > 22; r -= 6) { g.fillStyle = 'rgba(255,196,120,' + (0.06 + (46 - r) * 0.005).toFixed(3) + ')'; for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(SX - w, SY + y, w * 2, 1); } }
    for (let y = -21; y <= 21; y++) { if (y > 3 && ((y - 4) % 6 === 0 || (y > 13 && (y - 4) % 6 === 1))) continue; const w = Math.round(Math.sqrt(441 - y * y)); g.fillStyle = y < -8 ? '#fff0b8' : y < 6 ? '#ffe6a0' : '#ffd080'; g.fillRect(SX - w, SY + y, w * 2, 1); } }
  const ridge = (base, amp, col, s, fr) => { g.fillStyle = col; for (let x = 0; x < W; x++) { const h = base - (vnoise(x * fr, 0.5, s) * 0.7 + vnoise(x * fr * 3, 1.5, s + 1) * 0.3) * amp; g.fillRect(x, h, 1, H - h); } };
  ridge(230, 90, '#7a4a6a', 11, 0.012); ridge(250, 70, '#5a3452', 12, 0.016); ridge(276, 50, '#3a2238', 13, 0.02);
  // castle on hill
  g.fillStyle = '#24142a'; for (let x = 60; x < 300; x++) { const h = 300 - Math.sin((x - 60) / 240 * Math.PI) * 60; g.fillRect(x, h, 1, H - h); }
  const T = (x, y, w, h) => { g.fillRect(x, y, w, h); for (let k = 0; k < w; k += 4) g.fillRect(x + k, y - 3, 2, 3); };
  g.fillStyle = '#1b0f20'; T(140, 196, 80, 50); T(130, 176, 18, 70); T(212, 170, 20, 76); T(168, 160, 22, 40); g.fillRect(176, 140, 4, 22);
  g.fillStyle = '#3b6fd0'; g.fillRect(180, 140, 12, 7); g.fillStyle = '#22408a'; g.fillRect(180, 145, 12, 2); g.fillStyle = '#f7d35c'; g.fillRect(184, 142, 3, 2);
  g.fillStyle = '#ffcf70'; for (const [x, y] of [[150, 210], [190, 206], [218, 190], [136, 190], [176, 176]]) g.fillRect(x, y, 2, 3);
  ridge(H - 30, 22, '#140a16', 14, 0.03);
  for (let k = 0; k < 9; k++) { const x = 330 + k * 26, y = H - 46 + (k % 2) * 4; g.fillStyle = '#0c0610'; g.fillRect(x, y, 2, 14); g.fillRect(x - 3, y + 4, 8, 6); g.fillRect(x + 1, y - 12, 1, 12); if (k % 3 === 0) { g.fillStyle = '#c0353f'; g.fillRect(x + 2, y - 12, 6, 4); g.fillStyle = '#0c0610'; } }
  for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(255,240,200,' + (0.3 + hash2(k, 1, 2) * 0.6) + ')'; g.fillRect(hash2(k, 2, 2) * W, hash2(k, 3, 2) * 120, 1, 1); }
  return c;
}
function drawTitle() {
  if (!TITLE_BG) TITLE_BG = mkTitleBG(); ctx.drawImage(TITLE_BG, 0, 0);
  for (let k = 0; k < 6; k++) { const x = (NOW * 6 + k * 120) % (W + 100) - 50, y = 60 + k * 14; ctx.globalAlpha = 0.25; rect(x, y, 40 + k * 6, 2, '#ffe0c0'); ctx.globalAlpha = 1; }
  txt('СЛОВО КОРОЛЯ', W / 2, 36, PAL.y, { al: 'c', sc: 4, sh: '#2a1020' }); txt('Двор и королевство', W / 2, 74, '#fff2c8', { al: 'c', sc: 2, sh: '#2a1020' });
  txt('пиксельная стратегия · правьте через людей: совет, лорды, рыцари · по трактату Сунь-цзы', W / 2, 96, '#f0d8c0', { al: 'c', sh: '#2a1020' });
  if (SCREEN === 'newgame') { drawNewGame(); return; }
  let y = 150; const B = (id, label, f, o) => { btn(id, W / 2 + 70, y, 170, 18, Object.assign({ label, onClick: f }, o || {})); y += 23; };
  if (hasSave()) B('t_cont', 'Продолжить правление', () => startLoad(), saveOk() ? undefined : { disabled: true, tip: OLDSAVE_TIP });
  B('t_new', 'Новая игра', () => { SCREEN = 'newgame'; });
  B('t_help', 'Управление', () => UI.alert('help'));
  B('t_snd', 'Звук…', () => sndOpen());
  txt('Вся графика нарисована кодом, музыка и звуки синтезируются в браузере — без чужих ассетов.', W / 2, H - 12, '#c8a8a0', { al: 'c', f: 's' });
  if (UI.modals.length) drawModals();
}
function drawNewGame() {
  const X = W / 2 + 10, Y = 120, WW = 290, HH = 214; panelWood(X, Y, WW, HH); txt('Новая игра', X + WW / 2, Y + 8, PAL.y, { al: 'c', sh: PAL.o });
  let y = Y + 26; txt('Сложность:', X + 14, y + 3, '#c8b898'); ['Лёгкая', 'Обычная', 'Тяжёлая'].forEach((l, i) => btn('ng_d' + i, X + 90 + i * 64, y, 62, 14, { label: l, active: NEWG.diff === i, onClick: () => { NEWG.diff = i; } })); y += 20;
  txt('Обучение:', X + 14, y + 3, '#c8b898'); btn('ng_t', X + 90, y, 190, 14, { label: NEWG.tut ? 'Да — двор и 13 уроков' : 'Нет', active: NEWG.tut, onClick: () => { NEWG.tut = !NEWG.tut; } }); y += 20;
  txt('Туман войны:', X + 14, y + 3, '#c8b898'); btn('ng_o', X + 90, y, 190, 14, { label: NEWG.open ? 'Нет — карта открыта' : 'Да — мир надо разведать', active: !NEWG.open, onClick: () => { NEWG.open = !NEWG.open; } }); y += 20;
  txt('Мир №:', X + 14, y + 3, '#c8b898'); txt(String(NEWG.seed), X + 90, y + 3, PAL.w); btn('ng_s', X + 150, y, 130, 14, { label: 'Другой мир', onClick: () => { NEWG.seed = R.i(1, 99999); } }); y += 22;
  para('Вы — король Марко. Вы правите не руками, а словом: через совет, знатные дома и рыцарей. Пять держав, шесть домов, вольные бароны и разбойники. Победа мечом (своя столица + две чужие) или словом (3 голоса на Совете короны).', X + 14, y, WW - 28, '#e8dcc0', { f: 's', lh: 9 }); y += 40;
  btn('ng_go', X + 14, Y + HH - 30, 160, 20, { label: 'Взойти на трон', ic: 'i_crown', onClick: () => startNew() }); btn('ng_back', X + 186, Y + HH - 30, 90, 20, { label: 'Назад', onClick: () => { SCREEN = 'title'; } });
}
function runSteps(steps, done) {
  LOAD = { i: 0, steps, t0: performance.now() }; SCREEN = 'loading';
  const next = () => { if (LOAD.i >= steps.length) { LOAD = null; done(); return; } const s = steps[LOAD.i]; setTimeout(() => { try { s[1](); } catch (e) { console.error(e); LOAD.err = String(e && e.stack || e); return; } LOAD.i++; next(); }, 40); };
  next();
}
function worldSteps(first) {
  return [first, ['Рисуем карту: леса, горы, реки…', () => { if (!MSPR.oak) initMapSprites(); renderBase(WD); }], ['Проводим границы держав…', () => refreshPolitics()], ['Туман войны…', () => { if (!FOG.tex) initFog(); computeVision(); updateSigns(); rebuildFog(); MINI.dirty = 1; rebuildMini(); }]];
}
function afterLoad() { SCREEN = 'map'; cam.z = 1; centerArmy(); UI.win = null; UI.modals = []; UI.feed = [];
  if (G.court && G.atCourt) { G.visit = null; G.court.view = 0; courtEnter('throne_front'); } else if (G.visit) visitResume(); if (typeof TUT !== 'undefined') TUT.start(); if (typeof Snd !== 'undefined') Snd.music('auto'); }
function startNew() { runSteps(worldSteps(['Сотворение мира: горы, реки, озёра…', () => { newGame3(NEWG.seed, { diff: NEWG.diff, tut: NEWG.tut, mapOpen: NEWG.open }); }]).concat([['Возводим замок: зал, покои, двор…', () => buildCourt()]]), afterLoad); }
function startLoad() { runSteps(worldSteps(['Читаем летопись…', () => { if (!loadGame()) throw new Error('Нет сохранения'); }]).concat([['Возводим замок: зал, покои, двор…', () => buildCourt()]]), afterLoad); }
function drawLoading() {
  if (!TITLE_BG) TITLE_BG = mkTitleBG(); ctx.drawImage(TITLE_BG, 0, 0); dim(0.55);
  txt('СЛОВО КОРОЛЯ', W / 2, 110, PAL.y, { al: 'c', sc: 3, sh: '#2a1020' });
  if (!LOAD) return; const s = LOAD.steps[Math.min(LOAD.i, LOAD.steps.length - 1)];
  txt(s[0], W / 2, 170, '#fff2c8', { al: 'c' }); bar(W / 2 - 100, 186, 200, 8, (LOAD.i + 0.5) / LOAD.steps.length, '#e0a630');
  if (LOAD.err) para('Ошибка: ' + LOAD.err.slice(0, 300), 40, 210, W - 80, UIC.bad, { f: 's', lh: 9 });
  const q = ['«Война — великое дело для государства».', '«Знай врага и знай себя — и в ста битвах не будет опасности».', '«Война — это путь обмана».', '«Победоносное войско сначала побеждает, а потом ищет сражения».'][Math.floor(NOW / 4) % 4];
  txt(q, W / 2, 230, '#e8d8b0', { al: 'c' });
}
