'use strict';
// ===== FEASTS & TOURNEYS (v3.3): the feast hall comes alive on the evening of a feast — guests from the great houses, servants, a minstrel,
// the king's moments at the high table; the tourney on the lists (needs the stands) — eight knights in a knockout, the court on the stands,
// the king may ride a joust himself (aim the lance with E). Hunting trophies hang on the walls of the hall. =====
// G.court.feastDay — the day of a feast (17:00–23:30); G.court.feast = { day, done, n, sat, home, drank } — what the king did at it
// G.court.tour = { day, ent: [{ id, n, mar, h, ps }], res: [{ a, b, w, sa, sb, un }], champ, prize, king, done } — the tourney of the day
const FEAST_H0 = 17, FEAST_H1 = 23.5, TOUR_H0 = 10, TOUR_H1 = 16;
function feastOn() { const C = G && G.court; if (!C || C.feastDay !== G.day || G.visit) return false; const h = hourAbs(); return h >= FEAST_H0 && h < FEAST_H1; }
function feastLabel() { const C = G && G.court; return feastOn() ? 'Пир: занять место во главе стола' : C && C.feastDay === G.day && hourAbs() < FEAST_H0 ? 'Высокий стол: пир начнётся в 17:00' : 'Высокий стол'; }
function feastSt() { const C = G.court; if (!C.feast || C.feast.day !== C.feastDay) C.feast = { day: C.feastDay, done: {}, n: 0, sat: 0, home: 0, drank: {} }; return C.feast; }
const tapK = () => projDone('tapestries') ? 1.35 : 1;
const FS = { on: 0, q: [], qt: 0, chat: 0, mus: null, notes: [], seat: {}, chk: 0 };
// ---------- the seneschal's orders now lead to real events ----------
(() => { const f = ordDef('seneschal', 'feast'), t = ordDef('seneschal', 'tourney'); if (f) { const d0 = f.done; f.d = 'Пир в пиршественном зале: знать довольна, слава короля растёт. Вечером в последний день король сам может сесть во главе стола.';
    f.done = (o, c, e) => { d0(o, c, e); return 'Пир готов (' + effWord(e) + '): сегодня с 17:00 столы в пиршественном зале ломятся от яств, знать съезжается в замок.'; }; }
  if (t) { const d0 = t.done; Object.defineProperty(t, 'd', { configurable: true, get: () => projDone('stands') ? 'Рыцарский турнир на ристалище замка: в последний день с 10:00 — поединки на глазах у знати, король может сразиться сам. Знать довольна, слава растёт, конные воины набираются удали.'
      : 'Рыцарский турнир в поле у стен замка: знать довольна, слава растёт, конные воины набираются удали. Поединков в замке не будет — для них нужны трибуны у ристалища (стол зодчего).' });
    t.done = (o, c, e) => { const r = d0(o, c, e); if (projDone('stands') && !G.visit) { tourSetup(); return r + ' Сегодня с 10:00 — поединки на ристалище!'; } return r + ' Бились в поле у стен замка: чтобы смотреть поединки с трибун и выйти на ристалище самому, постройте трибуны (стол зодчего).'; }; } })();
// ---------- feast: who comes and where they sit ----------
const FEAST_FILL = ['Сэр Ивейн', 'Леди Энида', 'Сэр Бедивер', 'Леди Линетта', 'Сэр Гарет', 'Леди Розамунда', 'Сэр Персиваль', 'Леди Матильда', 'Сэр Тристрам', 'Леди Изольда', 'Сэр Ламорак', 'Сэр Кай'];
function feastGuests() { const fam = new Set(royalFamily().map(c => c.id)), used = new Set(COURT.npcs.map(n => n.c && n.c.id)), out = []; fam.add(G.player.char);
  for (const H0 of G.houses) { if (!H0.alive) continue; const M = houseMembers(H0.id).filter(c => c.age >= 16 && c.prison < 0 && !c.withKing && !c.away && !armyOfGen(c.id) && !fam.has(c.id) && !used.has(c.id));
    M.sort((a, b) => (b.id === H0.head) - (a.id === H0.head) || b.age - a.age); out.push(...M.slice(0, 3)); }
  const head = c => { const H0 = houseOf(c); return H0 && H0.head === c.id ? 1 : 0; }; out.sort((a, b) => head(b) - head(a));
  for (let i = 0; out.length < 14 && i < FEAST_FILL.length; i++) { const nm = FEAST_FILL[i], fem = nm.startsWith('Леди') ? 1 : 0; out.push(pseudoChar(800 + i, 'courtier', fem, 22 + (i * 7) % 30, nm)); }
  return out.slice(0, 30); }
function feastSeats() { const L = LOCS.hall, k = L.spots.hall_king, d = s => { const A = L.spots[s]; return Math.hypot(A.x - k.x, (A.y - k.y) * 1.6); }; return L.seats.slice().sort((a, b) => d(a) - d(b)); }
function feastClear() { COURT.npcs = COURT.npcs.filter(n => !n.guest); for (const n of COURT.npcs) if (n.override && n.override.feast) { n.override = null; n.curT = null; } FS.seat = {}; }
function feastBegin() { const L = LOCS.hall; if (!L) return; feastClear(); FS.on = 1; FS.q = []; FS.qt = 0; feastSt();
  const seats = feastSeats(), hs = ['ht3', 'ht2', 'ht4', 'ht1', 'ht5', 'ht0'], court = []; let si = 0;
  const sp = npcByKey('spouse'); if (sp) court.push(sp);
  COURT.npcs.filter(n => (n.key.startsWith('kid') || n.key.startsWith('ward')) && n.c.age >= 10).sort((a, b) => b.c.age - a.c.age).forEach(n => court.push(n));
  for (const s of SEATS) { const n = npcByKey('seat_' + s.k); if (n) court.push(n); }
  court.forEach((n, i) => { FS.seat[n.key] = i < hs.length ? hs[i] : seats[si++]; });
  FS.seat.srv_page = FS.seat.srv_maid = 'wander:5,12,38,13@hall'; feastSeatAll();
  feastGuests().forEach(c => { const s = seats[si++]; if (s) FS.q.push([c, s]); });
  FS.q.splice(Math.min(3, FS.q.length), 0, [pseudoChar(861, 'minstrel', 0, 31, 'Менестрель Ален'), 'minstrel']);
  if (COURT.loc !== 'hall') while (FS.q.length) feastSpawn(FS.q.shift(), 0);
  else UI.toast('Гости входят в зал: пир начинается!');
  if (COURT.loc !== 'hall' && G.atCourt && SCREEN === 'court') { UI.toast('Пир начинается! Знать собирается в пиршественном зале.'); Snd.sfx('fanfare_small'); } }
function feastSeatAll() { for (const k in FS.seat) { const n = npcByKey(k); if (!n || n.follow || (n.override && n.override.feast)) continue; n.override = { spot: FS.seat[k], until: FEAST_H1, day: G.day, feast: 1 }; n.curT = null; n.hold = 0; n.wander = null; } }
function feastSpawn(e, walk) { const [c, s] = e, L = LOCS.hall, sp = L.spots[s]; if (!sp) return; const min = s === 'minstrel', key = min ? 'fs_min' : 'fg' + c.id; if (npcByKey(key)) return;
  const H0 = c.pseudo ? null : houseOf(c);
  const n = mkNpc(key, c, { visitor: 1, guest: 1, spd: 44, sub: min ? 'Менестрель' : H0 ? 'Гость · дом ' + H0.name : 'Гость пира', talk: min ? minstrelTalk : feastGuestTalk });
  if (walk) { npcPlace(n, L.spots.hall_in); n.away = 0; npcGoToSp(n, sp); }
  else { npcPlace(n, sp); n.away = 0; if (sp.sx !== undefined) { n.x = sp.sx; n.y = sp.sy; } n.sit = sp.sit ? sp : null; n.state = 'idle'; } }
function feastFinish() { FS.on = 0; FS.q = []; const here = COURT.loc === 'hall';
  for (const n of COURT.npcs) if (n.override && n.override.feast) { n.override = null; n.curT = null; }
  for (const n of COURT.npcs.filter(m => m.guest)) { if (here && n.loc === 'hall') npcGoTo(n, 'hall_in', m => { COURT.npcs = COURT.npcs.filter(x => x !== m); }); else COURT.npcs = COURT.npcs.filter(x => x !== n); }
  FS.seat = {}; }
const FEAST_LINES = ['За короля!', 'Ещё вина!', 'Отменный эль!', 'Кабанятины мне!', 'Ваше здоровье, сэр!', 'Ха-ха-ха!', 'Тише, менестрель поёт!', 'А помните ту зиму?..', 'Пирог с голубями — чудо!', 'Слава королю!', 'Наливай!', 'Передайте соль!'];
function feastLine(n) { const H0 = n.c && !n.c.pseudo ? houseOf(n.c) : null;
  if (H0 && R.chance(0.25)) return H0.loy < 35 ? R.pick(['Пьём королевское вино… и молчим.', 'Пир щедрый. А земли — всё те же.', 'Гм. За короля, конечно.']) : 'За дом ' + H0.name + '!';
  if (n.seat && R.chance(0.3)) return R.pick(['Государь, отменный пир!', 'Сенешаль превзошёл себя.', 'Такого пира не помнят и старики.']); return R.pick(FEAST_LINES); }
UPD_EXT.push(dt => { if (G.visit) return; const on = feastOn(), here = COURT.loc === 'hall';
  if (on && !FS.on) feastBegin(); else if (!on && FS.on) feastFinish();
  if (FS.on) { const st = feastSt(); if (G.atCourt) st.home = 1;
    if ((FS.chk -= dt) < 0) { FS.chk = 1; feastSeatAll(); }
    if (FS.q.length) { if (!here) while (FS.q.length) feastSpawn(FS.q.shift(), 0); else if ((FS.qt -= dt) < 0) { FS.qt = 0.55; feastSpawn(FS.q.shift(), 1); } }
    if (here && (FS.chat -= dt) < 0) { FS.chat = R.range(1.3, 2.8); const n = R.pick(COURT.npcs.filter(m => m.loc === 'hall' && m.sit && !m.bub && !m.away)); if (n) { say(n, feastLine(n), 3); if (R.chance(0.3)) Snd.sfx('clink'); } }
    const mn = npcByKey('fs_min'); if (here && mn && mn.loc === 'hall' && !mn.path && !mn.goal && R.chance(dt * 2.4)) FS.notes.push({ x: mn.x + R.range(-5, 6), y: mn.y - 24, t: 0, c: R.pick(['#f7d35c', '#f8f0d8', '#e88a6a']) }); }
  for (const p of FS.notes) p.t += dt; if (FS.notes.length) FS.notes = FS.notes.filter(p => p.t < 1.6);
  const mus = FS.on && here ? 'feast' : null; if (mus !== FS.mus) { FS.mus = mus; Snd.music(mus || 'auto'); } });
ENTER_EXT.push(() => { feastClear(); FS.on = 0; FS.q = []; FS.mus = null; TRN.b = null; TRN.kj = null; TRN.kq = 0; TRN.on = 0; if (COURT.p) COURT.p.hide = 0; tourClear(); });
DAILY_EXT.push(() => { const C = G.court, st = C.feast; if (st && st.day === G.day - 1 && C.feastDay === st.day && st.home && !st.sat) { for (const H0 of G.houses) if (H0.alive) houseLoy(H0, -1); log('Знать пировала без короля: в зале шептались, что государь пренебрегает гостями.', 'bad'); } });
// ---------- the king at the high table ----------
ACTS_EXT.hall_king = () => { const C = G.court, sp = LOCS.hall.spots.hall_king;
  if (!feastOn()) { const cur = C.orders && C.orders.seneschal, sen = seatChar('seneschal'), d = ordDef('seneschal', 'feast'), busy = cur && cur.k === 'feast';
    const t = C.feastDay === G.day ? 'Слуги расставляют блюда и кувшины: пир начнётся в 17:00.' : 'Высокий стол пуст. ' + (busy ? 'Сенешаль уже готовит пир — ' + inDays(cur.day0 + cur.dur - G.day) + ', с 17:00.' : 'Пиры устраивает сенешаль: поручение «Устроить пир».');
    DLG.say(null, t, { name: 'Высокий стол', choices: [
      { t: 'Велеть сенешалю готовить пир (' + d.cost + ' зол., ' + d.dur + ' дн.)', tip: cur && !busy ? ['Заменит текущее поручение сенешаля.'] : null, ok: () => !!sen && !busy && C.feastDay !== G.day, why: !sen ? 'Сенешаля нет — некому готовить пир' : 'Пир уже готовится', fx: () => giveOrder('seneschal', 'feast', 'intent') },
      { t: 'Посидеть во главе стола', fx: () => sitAt(sp) }, { t: 'Уйти', fx: () => { } }], esc: 2 }); return; }
  sitAt(sp); const st = feastSt();
  if (!st.sat) { st.sat = 1; for (const H0 of G.houses) if (H0.alive) houseLoy(H0, 1); Snd.sfx('cheer'); for (const n of COURT.npcs) if (n.guest && n.loc === 'hall' && n.sit && R.chance(0.4)) say(n, R.pick(['Слава королю!', 'Король с нами!', 'За короля!']), 2.5); }
  feastMenu(); };
function feastMenu() { const st = feastSt(), k = kingC(), q = k.spouse >= 0 ? charOf(k.spouse) : null, qn = q && q.alive ? npcByKey('spouse') : null, tap = tapK();
  const why = key => st.done[key] ? 'Уже было на этом пиру' : 'На сегодня довольно: гости и так уже под столами';
  const mv = (key, t, tip, okf, why2, fx) => ({ t, tip, ok: () => !st.done[key] && st.n < 3 && (!okf || okf()), why: st.done[key] || st.n >= 3 ? why(key) : why2, fx: () => { st.done[key] = 1; st.n++; fx(); } });
  const ch = [mv('toast', 'Поднять кубок за верную знать', ['Все дома: верность +' + Math.round(2 * tap) + ', слава +1'], null, null, feastToast),
    { t: 'Почтить один из домов…', tip: ['Выбранный дом: верность +' + Math.round(7 * tap) + '.', 'Самый верный дом может приревновать.'], ok: () => !st.done.honor && st.n < 3, why: why('honor'), fx: feastHonor },
    mv('song', 'Велеть менестрелю петь о ваших деяниях', ['Слава +' + (projDone('chronicle') ? 2 : 1)], () => !!npcByKey('fs_min'), 'Менестрель ещё не пришёл', feastSong),
    mv('gossip', 'Прислушаться к застольным разговорам', ['Хмельные гости болтают лишнее.'], null, null, feastGossip),
    qn ? mv('dance', k.fem ? 'Танцевать с супругом' : 'Танцевать с королевой', ['Супруг(а) будет счастлив(а); вечер вместе.'], () => qn.loc === 'hall', (k.fem ? 'Супруга' : 'Королевы') + ' ещё нет за столом', feastDance)
      : mv('drink', 'Состязание: кто кого перепьёт', ['Рыцари любят королей, которые не боятся кубка.'], null, null, feastDrink),
    { t: 'Сидеть и пировать дальше', fx: () => { } }, { t: 'Встать из-за стола', fx: () => standUp() }];
  DLG.say(null, (st.n >= 3 ? 'Пир идёт своим чередом.' : 'Пир в разгаре. Что сделает ' + (k.fem ? 'королева' : 'король') + '? (ещё ' + (3 - st.n) + ')'), { name: 'Пир', choices: ch, esc: 5 }); }
function hallSay(p, L, d) { for (const n of COURT.npcs) if (n.loc === 'hall' && n.sit && !n.away && R.chance(p)) say(n, R.pick(L), d || 3); }
function feastToast() { const tap = tapK(); for (const H0 of G.houses) if (H0.alive) houseLoy(H0, Math.round(2 * tap)); prestige(1); Snd.sfx('clink'); setTimeout(() => Snd.sfx('cheer'), 300);
  hallSay(0.6, ['За короля!', 'Слава!', 'За короля и королевство!']);
  DLG.say(null, 'Вы поднимаетесь с кубком: «За тех, кто стоит рядом со мной — за этим столом и в поле!» Зал встаёт и ревёт в ответ.', { name: 'Пир' }); }
function feastHonor() { const st = feastSt(), tap = tapK(), A = G.houses.filter(H0 => H0.alive), L = A.slice().sort((a, b) => a.loy - b.loy).slice(0, 5), top = A.slice().sort((a, b) => b.loy - a.loy)[0];
  const ch = L.map(H0 => ({ t: 'Дом ' + H0.name + ' (верность ' + Math.round(H0.loy) + ')', fx: () => { st.done.honor = 1; st.n++; houseLoy(H0, Math.round(7 * tap)); let t = 'Вы сажаете главу дома ' + H0.name + ' по правую руку и сами наполняете кубок. Дом ' + H0.name + ' этого не забудет.';
    if (top && top !== H0 && A.length > 2) { houseLoy(top, -1); t += ' Дом ' + top.name + ' косится: отчего не их?'; }
    const hn = COURT.npcs.find(n => n.guest && n.c && n.c.id === H0.head); if (hn) say(hn, 'Великая честь, государь!', 3.5); Snd.sfx('clink'); DLG.say(null, t, { name: 'Пир' }); } }));
  ch.push({ t: 'Передумать', fx: () => feastMenu() }); DLG.say(null, 'Кого почтить при всех?', { name: 'Пир', choices: ch, esc: ch.length - 1 }); }
function kingDeeds() { const k = kingC(), C = G.court, T = C.trophies || {}, S = G.stats || {}, pd = Object.keys((C.proj && C.proj.done) || {}).length, kids = (k.kids || []).map(charOf).filter(c => c && c.alive).length, D = [];
  if (S.won) D.push('о ' + S.won + ' ' + plural(S.won, 'победе', 'победах', 'победах') + ' в поле'); if (S.sieges) D.push('о взятых крепостях');
  if (T.bear) D.push('о медведе, сражённом королевской рукой'); if (T.boar) D.push('о кабане, что не устоял перед королём'); if (T.deer) D.push('об оленях королевского леса');
  if (C.tour && C.tour.king === 'win') D.push('о победе на турнире'); if (pd) D.push('о новых чудесах столицы'); if (kids) D.push(kids > 1 ? 'о юных принцах' : 'о юном наследнике');
  if (!D.length) D.push('о славных делах, что ещё впереди'); return R.shuffle(D).slice(0, 3); }
function feastSong() { const k = kingC(), p = projDone('chronicle') ? 2 : 1; prestige(p); Snd.sfx('strum'); const mn = npcByKey('fs_min'); if (mn) say(mn, '«О, ' + (k.fem ? 'славная королева ' : 'славный король ') + k.name + '…»', 4.5);
  setTimeout(() => hallSay(0.35, ['Браво!', 'Ещё!', 'Слава!']), 1500);
  DLG.say(null, 'Менестрель ударяет по струнам и поёт ' + kingDeeds().join(', ') + '. Зал подхватывает припев' + (p > 1 ? ', а летописец записывает каждое слово' : '') + '.', { name: 'Песнь' }); }
function feastGossip() { const C = G.court, eye = !!npcByKey('seat_eye'), s = (C.secrets || []).find(x => !x.known && x.k !== 'love');
  if (s && R.chance(0.3 + (eye ? 0.2 : 0))) { s.known = 1; s.how = 'застольная болтовня'; DLG.say(null, 'Захмелевший гость болтает лишнее, а вы слушаете. ' + secretText(s), { name: 'Застольные разговоры' }); log('На пиру открылась тайна: ' + secretText(s), 'info'); return; }
  const L = [], bad = G.houses.filter(H0 => H0.alive && H0.loy < 40).sort((a, b) => a.loy - b.loy)[0];
  if (bad) L.push('За дальним столом люди дома ' + bad.name + ' шепчутся и смолкают, едва вы смотрите в их сторону.');
  const W2 = []; for (let a = 1; a < 5; a++) for (let b = a + 1; b < 5; b++) if (alive(a) && alive(b) && G.rel[a] && G.rel[a][b] && G.rel[a][b].war) W2.push([a, b]);
  if (W2.length) { const [a, b] = R.pick(W2); L.push('Рыцари спорят до хрипоты, кто возьмёт верх в войне: ' + realmName(a) + ' или ' + realmName(b) + '.'); }
  const rich = [1, 2, 3, 4].filter(alive).sort((a, b) => G.realms[b].gold - G.realms[a].gold)[0]; if (rich) L.push('Купеческий сын клянётся, что казна державы ' + realmName(rich) + ' ломится от золота.');
  L.push('Старый рыцарь в третий раз рассказывает, как в юности победил дракона. Дракон с каждым разом всё больше.');
  DLG.say(null, R.pick(L), { name: 'Застольные разговоры' }); }
function feastDance() { const k = kingC(), q = charOf(k.spouse); q.happy = clamp((q.happy || 60) + 6, 0, 100); q.loy = clamp((q.loy || 60) + 2, 0, 100); G.court.together = G.day; Snd.sfx('strum');
  const n = npcByKey('spouse'); if (n) say(n, R.pick(['Как в первый год, помните?', 'Вы наступили мне на ногу, ваше величество.', 'Ещё один круг!']), 3.5);
  DLG.say(null, 'Вы ведёте ' + (k.fem ? 'супруга' : 'королеву') + ' в круг. Музыканты играют быстрее, гости хлопают в ладоши.', { name: 'Пир' }); }
function feastDrink() { const k = kingC(), tr = k.traits || [], win = R.chance(clamp(0.45 + (k.mar - 10) * 0.02 + (tr.includes('reckless') ? 0.15 : 0) - (tr.includes('cautious') ? 0.1 : 0), 0.15, 0.85)); Snd.sfx('clink');
  if (win) { prestige(1); DLG.say(null, 'Кубок за кубком… Последним за столом остаётся король. Рыцари стучат кулаками по доскам: вот это государь!', { name: 'Пир' }); }
  else { for (const H0 of G.houses) if (H0.alive) houseLoy(H0, 1); DLG.say(null, 'Старый барон перепивает вас и сам же уносит под руку. Зал хохочет — по-доброму: король, что умеет проигрывать, нравится всем.', { name: 'Пир' }); } }
function feastGuestTalk(n) { const c = n.c, H0 = c.pseudo ? null : houseOf(c), st = feastSt(), loy = H0 ? H0.loy : 60, key = H0 ? 'h' + H0.id : 'c' + c.id;
  if (!feastOn()) { DLG.say(n, 'Доброй ночи, государь. Славный был пир.'); return; }
  const line = loy < 30 ? R.pick(['Вино у вас доброе, государь. Жаль, что не всё в королевстве так же сладко.', 'Пир щедрый. Наш дом запомнит щедрость… и всё остальное тоже.']) : loy < 55 ? R.pick(['Благодарю за приглашение, государь.', 'Отличный эль. Говорят, сенешаль сам выбирал бочки.']) : R.pick(['Долгих лет вашему величеству!', 'Наш дом всегда за вас, государь!', 'Лучший пир за много лет!']);
  DLG.say(n, line, { choices: [{ t: 'Выпить с ' + (c.fem ? 'ней' : 'ним'), tip: H0 ? ['Дом ' + H0.name + ': верность +2 (раз за пир)'] : null, ok: () => !st.drank[key], why: H0 ? 'С домом ' + H0.name + ' сегодня уже пили' : 'Уже пили вместе',
    fx: () => { st.drank[key] = 1; if (H0) houseLoy(H0, 2); say(n, R.pick(['За ваше здоровье!', 'До дна!', 'Ваше величество!']), 3); Snd.sfx('clink'); } }, { t: 'Отойти', fx: () => { } }], esc: 1 }); }
function minstrelTalk(n) { const st = feastSt();
  DLG.say(n, R.pick(['Какую песню желает государь?', 'Для вашего величества — хоть до рассвета!']), { choices: [
    { t: 'Сыграй что-нибудь весёлое', fx: () => { Snd.sfx('strum'); say(n, '«Тра-ля-ля, тра-ля-ля…»', 3); hallSay(0.3, ['Ха-ха!', 'Браво!', 'Ещё!'], 2.5); } },
    { t: 'Спой о моих деяниях', ok: () => feastOn() && !st.done.song && st.n < 3, why: st.done.song ? 'Песнь уже спета' : 'На сегодня довольно', fx: () => { st.done.song = 1; st.n++; feastSong(); } },
    { t: 'Играй дальше', fx: () => { } }], esc: 2 }); }
// musical notes over the minstrel, trophies on the walls of the hall
CRENDER2.push((g, L) => { if (L.id !== 'hall' || !FS.notes.length) return; for (const p of FS.notes) { const x = Math.round(p.x + Math.sin(p.t * 5 + p.x) * 3), y = Math.round(p.y - p.t * 16); g.globalAlpha = clamp(1.6 - p.t, 0, 1); g.fillStyle = p.c; g.fillRect(x + 2, y - 5, 1, 5); g.fillRect(x, y - 1, 3, 2); g.fillRect(x + 3, y - 5, 2, 1); g.fillRect(x + 4, y - 4, 1, 1); } g.globalAlpha = 1; });
const TROPHY_X = [14.5, 28.5, 17.5, 25.5, 8, 35.5];
CRENDER.push((g, L) => { if (L.id !== 'hall' || !G.court) return; const T = G.court.trophies || {}, list = []; for (const k of ['bear', 'boar', 'deer']) for (let i = 0; i < Math.min(2, T[k] || 0); i++) list.push(k);
  list.slice(0, TROPHY_X.length).forEach((k, i) => { const s = objSprite('trophy', { k, ck: k }, 0); g.drawImage(s, Math.round(TROPHY_X[i] * CT - s.width / 2 + 8), 3 * CT - s.height - 6); }); });
OBJP.trophy = function (o) { const b = new PB(26, 22), W0 = RPK.wood, k = o.k;
  b.ell(13, 15, 5.5, 6, 0, (x, y) => W0[y < 12 ? 4 : 3]); b.ell(13, 15, 3.5, 4, 0, (x, y) => W0[y < 13 ? 3 : 2]);
  if (k === 'deer') { const C0 = RPK.brown, I = RPK.ivory; b.ell(13, 13, 3, 4, 0, (x, y) => C0[y < 12 ? 4 : 3]); b.rect(12, 16, 3, 3, C0[2]); b.set(12, 18, DK); b.set(14, 18, DK); b.set(11, 12, DK); b.set(15, 12, DK);
    for (const s of [-1, 1]) { let x = 13 + s * 2, y = 9; for (let i = 0; i < 7; i++) { b.set(x, y, I[3]); if (i % 2) { b.set(x + s, y - 1, I[4]); } x += s; y -= i < 3 ? 1 : 0; } b.set(13 + s * 6, 6, I[4]); b.set(13 + s * 8, 7, I[3]); b.set(13 + s * 4, 4, I[4]); b.set(13 + s * 4, 5, I[3]); b.set(13 + s * 9, 8, I[3]); } }
  else if (k === 'boar') { const C0 = RPK.dwood, I = RPK.ivory; b.ell(13, 13, 4.5, 4.5, 0, (x, y) => C0[y < 11 ? 4 : 3]); b.rect(11, 15, 5, 4, C0[3]); b.rect(12, 18, 3, 2, C0[2]); b.set(12, 19, DK); b.set(14, 19, DK);
    b.set(10, 17, I[4]); b.set(9, 16, I[4]); b.set(16, 17, I[4]); b.set(17, 16, I[4]); b.set(11, 12, hx('#d02838')); b.set(15, 12, hx('#d02838')); b.set(8, 10, C0[2]); b.set(18, 10, C0[2]); for (let x = 10; x < 17; x += 2) b.set(x, 8, C0[1]); }
  else { const C0 = RPK.brown; b.ell(13, 12, 6, 5.5, 0, (x, y) => C0[y < 10 ? 3 : 2]); b.ell(8, 7, 1.8, 1.8, 0, () => C0[2]); b.ell(18, 7, 1.8, 1.8, 0, () => C0[2]); b.ell(13, 15, 3, 2.5, 0, () => C0[1]);
    b.set(12, 14, DK); b.set(13, 14, DK); b.set(14, 14, DK); b.set(10, 11, DK); b.set(16, 11, DK); b.set(11, 17, RPK.ivory[4]); b.set(15, 17, RPK.ivory[4]); }
  b.outline(OUTL); return b; };
// ---------- the tourney ----------
const TRN = { on: 0, b: null, kj: null, parts: [], pc: {}, chat: 0, cd: 0 };
const LANE_N = 20 * CT + 4, LANE_S = 22 * CT + 14, LX0 = 54 * CT, LX1 = 69 * CT + 8, BOUT_H = [10.2, 10.9, 11.6, 12.3, 13.0, 13.7, 14.4];
const TOUR_FOREIGN = ['Сэр Годфри Заморский', 'Чёрный рыцарь', 'Сэр Бран из Холмов', 'Сэр Ульрих Странник', 'Рыцарь Белой Розы', 'Сэр Лионель Южный', 'Сэр Мордред Хромой', 'Рыцарь Зелёного Щита'];
const TOUR_COL = [['black', 'gold'], ['forest', 'white'], ['gray', 'red'], ['purple', 'gold'], ['teal', 'white'], ['orange', 'black'], ['wine', 'white'], ['navy', 'gold']];
function tourEntrants() { const k = kingC(), fam = new Set(royalFamily().map(c => c.id)); fam.add(k.id);
  const E = G.chars.filter(c => c.alive && c.realm === 0 && c.prison < 0 && !c.pseudo && !c.fem && ['knight', 'lord', 'general'].includes(c.role) && c.age >= 17 && c.age <= 52 && !c.withKing && !c.away && !armyOfGen(c.id) && !fam.has(c.id))
    .sort((a, b) => b.mar - a.mar).slice(0, 6).map(c => ({ id: c.id, n: charName(c), mar: c.mar, h: c.house >= 0 ? c.house : -1 }));
  const F = R.shuffle(TOUR_FOREIGN.slice()); for (let i = 0; E.length < 8; i++) E.push({ id: -1 - i, n: F[i], mar: R.i(8, 16), h: -1, ps: 840 + i, col: i });
  return R.shuffle(E); }
function tourSetup() { G.court.tour = { day: G.day, ent: tourEntrants(), res: [], champ: -1, prize: 0, king: null, done: 0 }; }
function tourT() { const C = G && G.court, T = C && C.tour; return T && T.day === G.day && !T.done ? T : null; }
function tourOn() { const T = tourT(); if (!T || G.visit || !projDone('stands')) return false; const h = hourAbs(); return h >= TOUR_H0 && h < TOUR_H1; }
function tourLabel() { const T = tourT(); if (!projDone('stands')) return 'Турнирное поле'; if (!T) return 'Ристалище: устроить турнир';
  if (!tourOn()) return hourAbs() < TOUR_H0 ? 'Ристалище: турнир начнётся в 10:00' : 'Ристалище'; return T.champ >= 0 && !T.prize ? 'Турнир: вручить награду победителю' : 'Турнир: выйти на ристалище'; }
function tourChar(e) { if (e.id >= 0) { const c = charOf(e.id); if (c) return c; } return TRN.pc[e.n] || (TRN.pc[e.n] = pseudoChar(e.ps || 850, 'knight', 0, 30, e.n)); }
function tourCol(e) { const H0 = e.h >= 0 ? G.houses[e.h] : null; return H0 ? [H0.her.ramp, H0.her.ramp2] : TOUR_COL[(e.col || 0) % TOUR_COL.length]; }
const tourName = e => e === 'king' ? (kingC().fem ? 'Королева' : 'Король') : e.n;
function tourPair(T) { const r = T.res, n = r.length; if (n < 4) return [2 * n, 2 * n + 1]; if (n < 6) { const i = n - 4; return [r[2 * i].w, r[2 * i + 1].w]; } return n === 6 ? [r[4].w, r[5].w] : null; }
function passRoll(ma, mb, qa) { const K = qa !== undefined;
  const ha = R.chance(K ? clamp(qa * 0.9 + (ma - 10) * 0.02, 0.03, 0.95) : clamp(0.5 + (ma - 10) * 0.03, 0.2, 0.85)), hb = R.chance(clamp(0.5 + (mb - 10) * 0.03, 0.2, 0.85));
  const ba = ha && R.chance(K ? clamp(qa - 0.25, 0.1, 0.8) : 0.45), bb = hb && R.chance(0.45);
  let ub = ha && R.chance(clamp((K ? qa * 0.35 - 0.05 : 0.12) + (ma - mb) * 0.025, 0.02, 0.4)), ua = hb && R.chance(clamp(0.12 + (mb - ma) * 0.025 - (K && qa > 0.7 ? 0.06 : 0), 0.02, 0.35));
  if (ua && ub) { if (R.chance(0.5)) ua = false; else ub = false; }
  return { ha, hb, ba, bb, ua, ub, pa: ha ? (ba ? 2 : 1) : 0, pb: hb ? (bb ? 2 : 1) : 0 }; }
function boutWin(T, a, b, sa, sb, un) { return un === a ? b : un === b ? a : sa > sb ? a : sb > sa ? b : (T.ent[a].mar >= T.ent[b].mar ? a : b); }
function boutSim(T) { const p = tourPair(T); if (!p) return; const [a, b] = p, A = T.ent[a], B = T.ent[b]; let sa = 0, sb = 0, un = -1;
  for (let i = 0; i < 3 && un < 0; i++) { const r = passRoll(A.mar, B.mar); sa += r.pa; sb += r.pb; if (r.ua) un = a; else if (r.ub) un = b; }
  boutDone(T, { a, b, sa, sb, un, w: boutWin(T, a, b, sa, sb, un) }); }
function boutDone(T, r) { T.res.push(r); if (T.res.length === 7) { T.champ = r.w; if (COURT.loc === 'yard' && SCREEN === 'court') { const e = T.ent[r.w]; heraldSay('Победитель турнира — ' + e.n + '!', 5); Snd.sfx('fanfare'); UI.toast('Победитель турнира — ' + e.n + '. Вручите награду у ристалища.'); } } }
function heraldSay(t, d) { const n = npcByKey('tr_her'); if (n) say(n, t, d || 3.5); }
function tourClear() { COURT.npcs = COURT.npcs.filter(n => !n.tguest); for (const n of COURT.npcs) if (n.override && n.override.tour) { n.override = null; n.curT = null; } }
function tourBegin() { const T = tourT(); TRN.on = 1; tourClear(); TRN.parts = [];
  const st = ['stand0', 'stand2', 'stand3', 'stand4', 'stand5', 'stand6', 'stand7', 'stand8', 'stand9', 'stand10'], court = []; const sp = npcByKey('spouse'); if (sp) court.push(sp);
  COURT.npcs.filter(n => (n.key.startsWith('kid') || n.key.startsWith('ward')) && n.c.age >= 6).forEach(n => court.push(n)); for (const s of SEATS) { const n = npcByKey('seat_' + s.k); if (n) court.push(n); }
  court.slice(0, st.length).forEach((n, i) => { if (n.follow) return; n.override = { spot: st[i], until: TOUR_H1, day: G.day, tour: 1 }; n.curT = null; n.hold = 0; n.wander = null; });
  const busy = new Set(COURT.npcs.map(n => n.c && n.c.id)), ids = new Set(T.ent.map(e => e.id)); let si = 0; const fam = new Set(royalFamily().map(c => c.id));
  for (const H0 of G.houses) { if (!H0.alive) continue; for (const c of houseMembers(H0.id).filter(c => c.age >= 12 && c.prison < 0 && !c.withKing && !c.away && !armyOfGen(c.id) && !busy.has(c.id) && !ids.has(c.id) && !fam.has(c.id)).slice(0, 2)) {
    if (si >= 14) break; const s = LOCS.yard.spots['tsp' + si++]; const n = mkNpc('tg' + c.id, c, { visitor: 1, tguest: 1, spd: 44, sub: 'Зритель · дом ' + H0.name, talk: m => DLG.say(m, R.pick(['Славный турнир, государь!', 'Мой фаворит — ' + R.pick(T.ent).n + '!', 'Копья так и летят в щепки!'])) }); npcPlace(n, s); n.away = 0; } }
  const her = mkNpc('tr_her', pseudoChar(860, 'steward', 0, 40, 'Герольд'), { visitor: 1, tguest: 1, sub: 'Герольд турнира', talk: m => tourInfo(m) }); npcPlace(her, LOCS.yard.spots.herald); her.away = 0;
  if (G.atCourt && SCREEN === 'court') { UI.toast('Турнир начинается! Рыцари съезжаются к ристалищу.'); Snd.sfx('fanfare'); } }
function tourEnd() { const T = G.court.tour; TRN.on = 0; TRN.b = null; TRN.kq = 0; if (T && !T.done) { while (T.res.length < 7) boutSim(T); T.done = 1; const e = T.ent[T.champ], H0 = e && e.h >= 0 ? G.houses[e.h] : null;
    if (H0) houseLoy(H0, 3); const c = e && e.id >= 0 ? charOf(e.id) : null; if (c) c.loy = clamp((c.loy || 50) + 3, 0, 100);
    log('Турнир: победитель — ' + (e ? e.n : '?') + (H0 ? ' (дом ' + H0.name + ')' : '') + '.' + (T.king === 'win' ? ' Сам король выиграл свой поединок!' : T.king === 'fall' ? ' Короля выбили из седла.' : ''), 'info'); }
  tourClear(); }
function tourInfo(n) { const T = tourT(); if (!T) { DLG.say(n, 'Турнир окончен, государь.'); return; } const r = T.res.length, rd = r < 4 ? '1-й круг' : r < 6 ? 'полуфинал' : r < 7 ? 'финал' : 'турнир окончен';
  const L = T.ent.map((e, i) => e.n + ' (' + e.mar + ')' + (T.res.some(x => (x.a === i || x.b === i) && x.w !== i) ? ' — выбыл' : '')).join(', ');
  DLG.say(n, 'Сейчас — ' + rd + '. Рыцари (в скобках — удаль): ' + L + '.', { name: 'Герольд' }); }
ACTS_EXT.lists = () => { const C = G.court, T = tourT(), k = kingC();
  if (!projDone('stands')) { DLG.say(null, 'Пустое ристалище с барьером посередине. Без трибун турнир (поручение сенешалю) пройдёт в поле у стен замка, и поединков здесь не будет. Трибуны строят через стол зодчего — «Трибуны у ристалища».', { name: 'Ристалище' }); return; }
  if (!T) { const cur = C.orders && C.orders.seneschal, sen = seatChar('seneschal'), d = ordDef('seneschal', 'tourney'), busy = cur && cur.k === 'tourney';
    DLG.say(null, busy ? 'Сенешаль уже созывает рыцарей: турнир — ' + inDays(cur.day0 + cur.dur - G.day) + ', с 10:00.' : 'Трибуны пусты. Турниры устраивает сенешаль: поручение «Турнир».', { name: 'Ристалище', choices: [
      { t: 'Велеть сенешалю устроить турнир (' + d.cost + ' зол., ' + d.dur + ' дн.)', ok: () => !!sen && !busy, why: !sen ? 'Сенешаля нет — некому созвать рыцарей' : 'Турнир уже готовится', fx: () => giveOrder('seneschal', 'tourney', 'intent') }, { t: 'Уйти', fx: () => { } }], esc: 1 }); return; }
  if (!tourOn()) { DLG.say(null, hourAbs() < TOUR_H0 ? 'Оруженосцы чистят доспехи, конюхи седлают коней: турнир начнётся в 10:00.' : 'Турнир окончен. Слуги собирают обломки копий.', { name: 'Ристалище' }); return; }
  if (T.champ >= 0 && !T.prize) { tourPrize(T); return; }
  const why = k.wound > G.day ? woundNot(k) : k.age < 16 ? 'Король слишком юн для копья' : k.age > 58 ? 'Годы уже не те, государь' : T.king ? 'Сегодня вы уже бились' : TRN.kq ? 'Вы выходите следующим — ждите знака герольда' : null;
  DLG.say(null, 'На ристалище ' + (TRN.b ? 'идёт поединок: ' + T.ent[TRN.b.a].n + ' и ' + T.ent[TRN.b.b].n + '.' : 'готовят следующую пару.') + ' Что угодно ' + (k.fem ? 'королеве' : 'королю') + '?', { name: 'Турнир', choices: [
    { t: TRN.b ? 'Выйти к барьеру следующим' : 'Выйти на ристалище самому', tip: ['Три сшибки. Жмите E, когда острие копья на середине щита.', 'Победа — слава и любовь знати; падение может стоить раны.'], ok: () => !why, why, fx: () => { if (TRN.b) { TRN.kq = 1; heraldSay('Следующим к барьеру выйдет ' + tourName('king') + '!', 3.5); UI.toast('Вы выйдете на ристалище после этого поединка.'); Snd.sfx('horn_short'); } else kjStart(); } },
    { t: 'Смотреть из королевской ложи', fx: () => walkTo(LOCS.yard.spots.stand1.x, LOCS.yard.spots.stand1.y + 30, () => sitAt(LOCS.yard.spots.stand1)) },
    { t: 'Спросить герольда о рыцарях', fx: () => tourInfo(npcByKey('tr_her')) }, { t: 'Уйти', fx: () => { } }], esc: 3 }); };
function tourPrize(T) { const e = T.ent[T.champ], H0 = e.h >= 0 ? G.houses[e.h] : null, c = e.id >= 0 ? charOf(e.id) : null;
  const give = (gold, v, t) => { if (gold && !spend(gold)) return; T.prize = 1; if (H0) houseLoy(H0, v); if (c) c.loy = clamp((c.loy || 50) + v, 0, 100); prestige(1); Snd.sfx('cheer'); heraldSay('Слава победителю!', 3); DLG.say(c || null, t, { name: e.n }); };
  DLG.say(null, 'Победитель турнира — ' + e.n + (H0 ? ' из дома ' + H0.name : '') + '. Он преклоняет колено у королевской ложи.', { name: 'Награда', choices: [
    { t: 'Венок и кошель золота (20 зол.)', tip: [H0 ? 'Дом ' + H0.name + ': верность +6' : 'Слава +1'], fx: () => give(20, 6, 'Благодарю, государь! Это золото — и этот венок — я положу к ногам моей дамы.') },
    { t: 'Лавровый венок победителя', tip: [H0 ? 'Дом ' + H0.name + ': верность +3' : 'Слава +1'], fx: () => give(0, 3, 'Для меня честь получить венок из ваших рук, государь.') }, { t: 'Позже', fx: () => { } }], esc: 2 }); }
// a bout in motion: two riders charge along the tilt three times (or until one falls)
function boutStart(T, a, b, king) { const B = { a, b, king, pass: 0, ph: 'intro', t: 0, dir: 1, sa: 0, sb: 0, un: -1, xa: LX0, xb: LX1, va: 0, vb: 0, roll: null, brkA: 0, brkB: 0, fall: null, fa: 0, fb: 0 };
  if (king) { B.aim = { x: 0, y: 0, ph: R.range(0, 6) }; B.lock = null; }
  heraldSay((king ? tourName('king') : T.ent[a].n) + ' и ' + (king ? king.n : T.ent[b].n) + ' — к барьеру!', 3); return B; }
function boutStep(B, dt, T) { B.t += dt; const A = B.king ? null : T.ent[B.a], Bk = B.king || T.ent[B.b];
  if (B.ph === 'intro' || B.ph === 'turn') { if (B.t > (B.ph === 'intro' ? 1.4 : 0.9)) { if (B.ph === 'turn') { B.pass++; B.dir = -B.dir; if (B.pass >= 3 || B.un !== -1) { B.ph = 'done'; B.t = 0; boutEndMsg(B, T); return; } }
      B.ph = 'run'; B.t = 0; B.va = B.vb = 0; B.roll = null; B.brkA = B.brkB = 0; if (B.king) { B.lock = null; B.q = 0; } Snd.sfx('gallop'); } return; }
  if (B.ph === 'done') { if (B.t > 2.2) B.fin = 1; return; }
  // run
  const acc = 120, vmax = 128; B.va = Math.min(vmax, B.va + acc * dt); B.vb = Math.min(vmax, B.vb + acc * dt);
  B.xa += B.dir * B.va * dt; B.xb -= B.dir * B.vb * dt; B.fa += B.va * dt; B.fb += B.vb * dt;
  if (B.king && !B.lock) { const s = 1 + 0.3 * B.pass; B.aim.x = Math.sin(B.t * 2.6 * s + B.aim.ph) * 0.95; B.aim.y = Math.sin(B.t * 3.9 * s + B.aim.ph * 0.7) * 0.8; }
  if (!B.roll && (B.xa - B.xb) * B.dir >= -2) { const ma = B.king ? kingC().mar : A.mar, mb = Bk.mar; B.roll = passRoll(ma, mb, B.king ? (B.lock ? B.q : 0) : undefined); const r = B.roll, x = (B.xa + B.xb) / 2, y = (LANE_N + LANE_S) / 2 - 14;
    B.sa += r.pa; B.sb += r.pb; if (r.ba) B.brkA = 1; if (r.bb) B.brkB = 1;
    if (r.ba || r.bb) { Snd.sfx('crack'); for (let i = 0; i < 16; i++) TRN.parts.push({ x, y: y + R.range(-4, 4), vx: R.range(-70, 70), vy: R.range(-60, 5), t: 0, c: R.pick(['#e8d0a0', '#c8a060', '#8a6a40']) }); } else if (r.ha || r.hb) Snd.sfx('hit');
    if (r.ua || r.ub) { B.un = B.king ? (r.ua ? 'k' : 'o') : (r.ua ? B.a : B.b); B.fall = { w: r.ua ? 'a' : 'b', x: r.ua ? B.xa : B.xb, y: r.ua ? LANE_N : LANE_S, t: 0 }; Snd.sfx('thud'); setTimeout(() => Snd.sfx('cheer'), 200); }
    const nA = B.king ? tourName('king') : A.n, nB = Bk.n, msg = r.ua || r.ub ? (r.ua ? nA : nB) + ' вылетает из седла!' : r.ba && r.bb ? 'Оба копья в щепки!' : r.ba ? nA + ' ломает копьё в щепки!' : r.bb ? nB + ' ломает копьё в щепки!' : r.ha && r.hb ? 'Оба попали в щит!' : r.ha ? nA + ' бьёт точно в щит!' : r.hb ? nB + ' бьёт точно в щит!' : 'Мимо! Оба промахнулись.';
    heraldSay(msg, 2.6); tourCrowd(0.25); }
  if (B.fall) B.fall.t += dt;
  const endA = B.dir > 0 ? B.xa >= LX1 : B.xa <= LX0, endB = B.dir > 0 ? B.xb <= LX0 : B.xb >= LX1;
  if (endA) B.xa = B.dir > 0 ? LX1 : LX0; if (endB) B.xb = B.dir > 0 ? LX0 : LX1; if (endA && endB) { B.ph = 'turn'; B.t = 0; } }
function boutEndMsg(B, T) { const w = B.king ? (B.un === 'k' ? 'opp' : B.un === 'o' ? 'king' : B.sa > B.sb ? 'king' : B.sb > B.sa ? 'opp' : kingC().mar >= B.king.mar ? 'king' : 'opp') : boutWin(T, B.a, B.b, B.sa, B.sb, B.un);
  B.w = w; const nm = B.king ? (w === 'king' ? tourName('king') : B.king.n) : T.ent[w].n; heraldSay('Побеждает ' + nm + '! Счёт ' + B.sa + ':' + B.sb + '.', 3.5); Snd.sfx('cheer'); tourCrowd(0.4); }
function tourCrowd(p) { for (const n of COURT.npcs) if ((n.tguest || (n.override && n.override.tour)) && n.loc === 'yard' && R.chance(p)) say(n, R.pick(['Ах!', 'Вперёд!', 'Браво!', 'Ещё!', 'Держись в седле!', 'Ура!']), 2); }
UPD_EXT.push(dt => { if (G.visit) return; const on = tourOn(), T = tourT(), h = hourAbs();
  if (on && !TRN.on) tourBegin(); else if (!on && TRN.on) { if (TRN.kj) kjFinish(); tourEnd(); }
  for (const p of TRN.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; } if (TRN.parts.length) TRN.parts = TRN.parts.filter(p => p.t < 0.9);
  if (!TRN.on || !T) return; const watch = COURT.loc === 'yard' && SCREEN === 'court';
  if (TRN.kj) { kjStep(dt); return; }
  const late = h >= TOUR_H1 - 0.5; let due = 0; for (const t of BOUT_H) if (h >= t) due++; if (late) due = 7;
  if (!watch || T.king || T.champ >= 0) TRN.kq = 0;
  if (TRN.b) { boutStep(TRN.b, dt, T); if (TRN.b.fin) { const B = TRN.b; TRN.b = null; boutDone(T, { a: B.a, b: B.b, sa: B.sa, sb: B.sb, un: B.un, w: B.w }); if (TRN.kq && T.champ < 0) { TRN.kq = 0; kjStart(); } } else if (!watch) { TRN.b = null; } return; }
  if (TRN.kq) { TRN.kq = 0; kjStart(); return; }
  while (T.res.length < due - (watch && !late ? 1 : 0)) boutSim(T);
  if (watch && !late && T.res.length < due && T.res.length < 7) { const p = tourPair(T); TRN.b = boutStart(T, p[0], p[1]); }
  if (watch && (TRN.chat -= dt) < 0) { TRN.chat = R.range(2, 4); const n = R.pick(COURT.npcs.filter(m => m.loc === 'yard' && (m.tguest || (m.override && m.override.tour)) && !m.bub && m.key !== 'tr_her')); if (n) say(n, R.pick(['Вот это удар!', 'Смотрите, ' + R.pick(T.ent).n + '!', 'Ставлю серебро!', 'Какой конь!', 'Слава королю!']), 2.5); } });
TIMEK_EXT.push(() => TRN.on && !G.visit && COURT.loc === 'yard' && SCREEN === 'court' ? Math.min(1, COURT_SPD[G.speed] / 720) : 1);
// the king's own joust: E (or a click) when the lance tip is on the middle of the shield
function kjStart() { const T = tourT(); if (!T) return; const alive = T.ent.filter((e, i) => !T.res.some(r => (r.a === i || r.b === i) && r.w !== i)); const opp = (T.champ >= 0 ? T.ent[T.champ] : alive.sort((a, b) => b.mar - a.mar)[0]) || T.ent[0];
  standUp(); fadeTo(() => { const P = COURT.p; TRN.b = null; COURT.loc = 'yard'; P.hide = 1; P.sit = null; P.x = LX0; P.y = LANE_N; P.dir = 'right'; COURT.path = null; TRN.kj = boutStart(T, -1, -1, opp); snapCam(); Snd.sfx('horn'); }); }
function kjStep(dt) { const B = TRN.kj, T = tourT(), P = COURT.p; if (!T) { kjFinish(); return; } boutStep(B, dt, T); P.x = B.xa; P.y = LANE_N; P.dir = B.dir > 0 ? 'right' : 'left';
  if (B.fin) kjFinish(); }
function kjPress() { const B = TRN.kj; if (!B || B.ph !== 'run' || B.lock || B.roll) return; B.lock = { x: B.aim.x, y: B.aim.y }; B.q = clamp(1 - Math.hypot(B.aim.x, B.aim.y) / 0.95, 0, 1); Snd.sfx('swish'); }
function kjFinish() { const B = TRN.kj, T = G.court.tour, k = kingC(); TRN.kj = null; if (!B) return; let res = 'lose', t;
  if (B.w === undefined) B.w = B.sa >= B.sb ? 'king' : 'opp';
  if (B.fall && B.fall.w === 'a') { res = 'fall'; prestige(-2); const hurt = R.chance(0.45); if (hurt) { woundKing(R.chance(0.6) ? 1 : 2, R.pick(['плечо', 'рёбра']), 'турнир'); if (k.woundK >= 2) healQueue({ from: 'tourney' }); } t = B.king.n + ' бьёт точно — и вы вылетаете из седла. ' + (hurt ? 'Лекари уносят ' + (k.fem ? 'королеву' : 'короля') + ' с поля: рана заживёт за ' + (k.wound - G.day) + ' ' + plural(k.wound - G.day, 'день', 'дня', 'дней') + '.' : 'Песок мягкий: вы встаёте сами, под рёв трибун.'); }
  else if (B.w === 'king') { res = 'win'; prestige(4); for (const H0 of G.houses) if (H0.alive) houseLoy(H0, 2); t = (B.fall ? B.king.n + ' лежит на песке, а вы поднимаете копьё к трибунам.' : 'Вы берёте верх по очкам — ' + B.sa + ':' + B.sb + '.') + ' Знать рукоплещет: ' + (k.fem ? 'королева' : 'король') + ' — истинный рыцарь!'; }
  else { for (const H0 of G.houses) if (H0.alive) houseLoy(H0, 1); t = 'Победа по очкам: ' + B.king.n + ', ' + B.sb + ':' + B.sa + '. Но знать видела: ' + (k.fem ? 'королева' : 'король') + ' не боится копья.'; }
  if (T) T.king = res; Snd.sfx(res === 'win' ? 'fanfare' : 'thud');
  fadeTo(() => { const P = COURT.p, sp = LOCS.yard.spots.lists_s; P.hide = 0; COURT.loc = 'yard'; P.x = sp.x; P.y = sp.y; P.dir = 'up'; snapCam(); DLG.say(null, t, { name: 'Поединок' }); }); }
TARGET_EXT.push(P => TRN.kj && TRN.kj.ph === 'run' && !TRN.kj.lock ? { e: 1, d: -1, label: 'Удар копьём!', x: P.x, y: P.y - 20, go: kjPress } : null);
PICK_EXT.push(() => TRN.kj ? { e: 1, d: -1, label: 'Удар копьём!', x: COURT.p.x, y: COURT.p.y - 20, go: kjPress } : null);
DOOR_EXT.push(() => !!TRN.kj);
// drawing: riders on horseback (depth-sorted), splinters, the joust HUD
function drawRider(g, x, y, right, c, col, f, brk, fallen) { const hs = animalSprite('horse', f, right, 'dwood'), hx0 = Math.round(x - 16), hy = Math.round(y - 24);
  g.drawImage(shadowSpr(22), Math.round(x - 11), Math.round(y - 2)); g.drawImage(hs, hx0, hy); const C1 = RAMP[col[0]] || RAMP.navy, C2 = RAMP[col[1]] || RAMP.gold, cx = hx0 + (right ? 6 : 8);
  g.fillStyle = C1[3]; g.fillRect(cx, hy + 9, 18, 8); g.fillStyle = C1[2]; g.fillRect(cx, hy + 15, 18, 2); g.fillStyle = C2[4]; for (let i = 1; i < 18; i += 4) g.fillRect(cx + i, hy + 16, 2, 2); g.fillRect(cx, hy + 9, 18, 1);
  if (fallen) return; const s = walkerSprite(c, right ? 'right' : 'left', 0), rx = Math.round(x - 8 + (right ? -1 : 1)), ry = hy + 9 - 24;
  g.drawImage(s, 0, 0, 16, 24, rx, ry, 16, 24); g.fillStyle = '#3a2a20'; g.fillRect(Math.round(x) - 1, hy + 9, 3, 6);
  const d = right ? 1 : -1, L0 = brk ? 9 : 26, lx = Math.round(x + d * 4), ly = hy + 2; for (let i = 0; i < L0; i++) { g.fillStyle = i % 6 < 3 ? C2[4] : C1[3]; g.fillRect(lx + d * i, ly + Math.floor(i / 9), 1, 1); }
  if (!brk) { g.fillStyle = '#c8d0d8'; g.fillRect(lx + d * L0, ly + 2, 1, 1); g.fillRect(lx + d * (L0 + 1), ly + 2, 1, 1); }
  g.fillStyle = C1[3]; g.fillRect(Math.round(x - d * 2) - 2, hy + 3, 5, 6); g.fillStyle = C2[4]; g.fillRect(Math.round(x - d * 2), hy + 4, 1, 4); }
function drawFallen(g, F, c) { const s = walkerSprite(c, 'down', 0); g.save(); g.translate(Math.round(F.x), Math.round(F.y + 2)); g.rotate(-Math.PI / 2); g.drawImage(s, -30, -8); g.restore(); }
SPR_EXT.push((L, list) => { if (L.id !== 'yard') return; const T = G.court && G.court.tour, B = TRN.kj || TRN.b; if (!B || !T) return; const k = !!B.king;
  const A = k ? { c: kingC(), col: ['red', 'gold'] } : { c: tourChar(T.ent[B.a]), col: tourCol(T.ent[B.a]) }, Bo = k ? { c: tourChar(B.king), col: tourCol(B.king) } : { c: tourChar(T.ent[B.b]), col: tourCol(T.ent[B.b]) };
  const fa = B.fall && B.fall.w === 'a', fb = B.fall && B.fall.w === 'b';
  list.push([LANE_N, 4, g => drawRider(g, B.xa, LANE_N, B.dir > 0, A.c, A.col, Math.floor(B.fa / 7) % 2, B.brkA, fa)]);
  list.push([LANE_S, 4, g => drawRider(g, B.xb, LANE_S, B.dir < 0, Bo.c, Bo.col, Math.floor(B.fb / 7) % 2, B.brkB, fb)]);
  if (B.fall) list.push([B.fall.y + 3, 4, g => drawFallen(g, B.fall, fa ? A.c : Bo.c)]); });
CRENDER2.push((g, L) => { if (L.id !== 'yard' || !TRN.parts.length) return; for (const p of TRN.parts) { g.globalAlpha = clamp(1.2 - p.t * 1.3, 0, 1); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); } g.globalAlpha = 1; });
HUD_EXT.push(() => { const T = tourT(); if (!T || !TRN.on || COURT.loc !== 'yard' || DLG.open()) return; const B = TRN.kj || TRN.b, X = W - 196, Y = 22;
  const hh = (B ? 38 : 20) + (TRN.kq ? 8 : 0); rect(X, Y, 190, hh, 'rgba(20,14,10,0.82)'); strokeR(X, Y, 190, hh, '#8a6a3a'); const r = T.res.length;
  if (TRN.kq) txt('Следующим выходите вы!', X + 6, Y + hh - 9, '#f7d35c', { f: 's' });
  txt('ТУРНИР · ' + (r < 4 ? '1-Й КРУГ' : r < 6 ? 'ПОЛУФИНАЛ' : r < 7 ? 'ФИНАЛ' : 'ПОБЕДИТЕЛЬ: ' + T.ent[T.champ].n.toUpperCase()), X + 6, Y + 5, '#f7d35c', { f: 's' });
  if (B) { const nA = B.king ? tourName('king') : T.ent[B.a].n, nB = B.king ? B.king.n : T.ent[B.b].n;
    txt('' + B.sa, X + 6, Y + 13, '#f7d35c', { f: 's' }); txt(nA, X + 16, Y + 13, '#f8ecd0', { f: 's' }); txt('' + B.sb, X + 6, Y + 21, '#f7d35c', { f: 's' }); txt(nB, X + 16, Y + 21, '#f8ecd0', { f: 's' });
    txt('СШИБКА ' + Math.min(3, B.pass + 1) + ' ИЗ 3', X + 6, Y + 29, '#c8b898', { f: 's' }); }
  else txt(r < 7 ? 'Следующая пара готовится…' : 'Вручите награду у ристалища', X + 6, Y + 13, '#c8b898', { f: 's' });
  if (!TRN.kj || TRN.kj.ph !== 'run') return; const K = TRN.kj, bx = Math.round(W / 2 - 34), by = 52, col = tourCol(K.king), C1 = RAMP[col[0]] || RAMP.navy, C2 = RAMP[col[1]] || RAMP.gold;
  rect(bx - 6, by - 6, 80, 86, 'rgba(20,14,10,0.7)'); strokeR(bx - 6, by - 6, 80, 86, '#8a6a3a');
  rect(bx + 10, by, 48, 40, C1[3]); rect(bx + 14, by + 40, 40, 8, C1[3]); rect(bx + 22, by + 48, 24, 6, C1[3]); rect(bx + 30, by + 4, 8, 46, C2[4]); rect(bx + 26, by + 16, 16, 12, C2[3]);
  const ax = bx + 34 + (K.lock || K.aim).x * 30, ay = by + 22 + (K.lock || K.aim).y * 26; strokeR(Math.round(ax) - 4, Math.round(ay) - 4, 9, 9, K.lock ? '#f7d35c' : '#f8f0e0'); rect(Math.round(ax), Math.round(ay), 1, 1, '#ffffff');
  txt(K.lock ? 'Удар нацелен: ' + Math.round(K.q * 100) + '%' : 'E / клик — удар!', bx + 34, by + 64, K.lock ? '#f7d35c' : '#f8ecd0', { f: 's', al: 'c' }); });
// spots for spectators, the herald; the label of the lists
BUILD_EXT.push(() => { const Y = LOCS.yard; if (!Y) return;
  [56, 58, 59, 60, 62, 63, 65, 66].forEach((x, i) => spot(Y, 'stand' + (3 + i), x, 14, 'down', { sit: 1, sy: 14 * CT + 4 }));
  [54, 55, 56, 57, 58, 59, 63, 64, 65, 66, 67, 68, 69, 62].forEach((x, i) => spot(Y, 'tsp' + i, x, 25, 'up')); spot(Y, 'herald', 60, 24, 'up');
  const a = Y.acts.find(x => x.id === 'lists'); if (a) Object.defineProperty(a, 'label', { get: () => tourLabel(), configurable: true }); });
