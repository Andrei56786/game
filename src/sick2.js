// ===== SICK2 (v3.6): the sick at court — in their beds, the physician's rounds and talk, the king's sickbed, his badge and what he may not do =====
// ---------- the physician walks the castle; the bedridden keep to their beds ----------
POP_EXT.push(() => { const C = G.court; if (!C || G.visit) return; docEnsure(); const d = C.doc; if (!d) return;
  mkNpc('srv_doc', docChar(), { sched: DOC_SCHED, home: 'stairs', staff: 'doc', talk: n => docTalk(n), sub: () => 'Лекарь двора · искусство ' + G.court.doc.med }); });
{ const st0 = schedTarget; schedTarget = function (n) { const c = n.c, I = c && !c.pseudo && c.ill; if (I && I.bed && !n.follow && !n.visitor && !n.post && !n.errand) return n.bed && spotOf(n.bed) ? n.bed : n.home || 'stairs'; return st0(n); }; }
const VISIT_SP = { bed_queen: 'q_rug', bed_guest: 'guest_mid', bed_maid: 'cor_e', bed_page: 'cor_e' };
function visitSpot(n) { const b = n && n.bed; if (!b) return null; if (VISIT_SP[b]) return VISIT_SP[b]; if (b.startsWith('bed_kid')) return 'nur_rug'; const k = b.slice(4); return ADV_ROOMS.includes(k) ? 'room_' + k : null; }
const DOC_LINES = ['Покажите язык… Так.', 'Пульс частый. Пейте отвар — по чаше.', 'Жар держится. Ещё компресс на лоб.', 'Дышите… глубже… ещё.', 'Окна закрыть, огонь не гасить.', 'Бульону — и спать.'];
function docRounds(dn) { const h = hourAbs(), win = h >= 8 && h < 11 ? 1 : h >= 17 && h < 19.5 ? 2 : 0, ov = dn.override;
  if (ov && ov.doc && ov.day === G.day && ov.until > h) { if (dn.visitPt && !dn.path && !dn.goal && dn.curT === ov.spot && !dn.away) { const pt = npcByKey(dn.visitPt); dn.visitPt = null;
      if (pt && pt.c.ill) { if (dn.loc === COURT.loc) say(dn, R.pick(DOC_LINES), 3); SICK.rep = { key: pt.key, t: NOW + 1.6 }; pt.c.ill.seen = G.day; } } return; }
  if (!win || dn.follow || dn.errand || dn.hidH) return; const tag = G.day * 3 + win; if (!SICK.rd || SICK.rd.tag !== tag) SICK.rd = { tag, done: [] };
  const pt = COURT.npcs.find(m => m.c && !m.c.pseudo && m.c.ill && m.c.ill.bed && !SICK.rd.done.includes(m.key) && visitSpot(m)); if (!pt) return; SICK.rd.done.push(pt.key);
  dn.override = { spot: visitSpot(pt), until: Math.min(h + 0.9, win === 1 ? 11 : 19.5), day: G.day, doc: 1 }; dn.curT = null; dn.hold = 0; dn.wander = null; dn.visitPt = pt.key; }
function kingIllFree() { return !HEAL.on && !G.visit && !COURT.hunt && !DLG.open() && !UI.modalOpen() && !UI.win && COURT.fade === 0 && !COURT.sleepT && G.atCourt && !(G.over && !G.over.ack) && !(typeof TRN !== 'undefined' && TRN.kj) && !(typeof TUT !== 'undefined' && TUT.blocking()); }
UPD_EXT.push(dt => { const C = G.court; if (!C || !COURT.p) return; const k = kingC(), I = k.ill, dn = npcByKey('srv_doc');
  if (dn) { const hide = HEAL.on && (HEAL.sh === 'bed' || HEAL.sh === 'days'); if (hide && !dn.hidH) { dn.hidH = 1; dn.hold = 1; dn.away = 1; dn.path = null; dn.goal = null; dn.state = 'idle'; } else if (!hide && dn.hidH) { dn.hidH = 0; dn.hold = 0; dn.curT = null; }
    if (!G.visit && !HEAL.on) docRounds(dn); }
  if (SICK.rep && NOW >= SICK.rep.t) { const pt = npcByKey(SICK.rep.key); SICK.rep = null; if (pt && pt.c.ill && pt.loc === COURT.loc && !pt.away) say(pt, R.pick(DIS[pt.c.ill.k].sym), 2.5); }
  if ((SICK.bt -= dt) <= 0) { SICK.bt = R.range(4, 8); const L = COURT.npcs.filter(n => n.loc === COURT.loc && !n.away && !n.bub && n.c && !n.c.pseudo && n.c.ill); if (L.length) { const n = R.pick(L); say(n, R.pick(DIS[n.c.ill.k].sym), 2.2); } }
  if (HEAL.on && HEAL.o && HEAL.o.from === 'ill' && HEAL.sh === 'days' && I) { HEAL.end = I.end + 3 / 24; HEAL.bed = Math.max(1, I.end - HEAL.d0); }
  if (I && I.bed && !I.up && !I.asked && whereOf(k) === 'court' && kingIllFree()) { I.asked = 1; kingIllPrompt(); } });
// ---------- the king: the prompt, the sickbed (hurt.js HEAL with o.from = 'ill'), getting up ----------
function kingIllPrompt() { const k = kingC(), I = k.ill; if (!I) return; const D = DIS[I.k], dn = npcByKey('srv_doc'), grave = GRAVE.includes(I.k) || sickRisk(k) >= 0.06;
  const t = (dn ? '' : 'Паж бегом приводит городского лекаря. ') + '«Государь, это ' + D.n + '. ' + (grave ? 'Болезнь тяжёлая — в постель, немедля.' : 'Лягте в постель: так болезнь пройдёт легче и скорее.') + '»';
  const ch = [{ t: 'Лечь в постель', tip: ['Дни болезни пройдут в покоях; совет справится сам.', 'В постели болезнь легче, чем на ногах.'], fx: () => sickBedStart() }];
  if (!grave) ch.push({ t: 'Перемогусь на ногах', tip: ['Болезнь продлится на 2 дня дольше, и она опаснее (×1,4).', 'Ни охоты, ни меча, ни турнира.'], fx: () => { I.up = 1; I.end += 2; UI.toast('Король остаётся на ногах. Лекарь качает головой.'); } });
  DLG.say(dn || null, t, { name: dn ? undefined : 'Король занемог', choices: ch, esc: ch.length - 1 }); }
function sickBedStart() { const k = kingC(), I = k.ill; if (!I || HEAL.on) return; const nd = Math.max(1, I.end - G.day); I.up = 0; I.asked = 1;
  Object.assign(HEAL, { on: 1, o: { from: 'ill' }, king: k.id, tot: nd, bed: nd, fast: 0, sh: '', t0: NOW, cap: '', vis: [], fever: null, men: null });
  UI.win = null; while (DLG.open()) DLG.close(); COURT.path = null; COURT.onArrive = null; if (G.speed > 0) UI.lastSpeed = G.speed; Snd.music('sick'); healBed(); }
function sickDocVis() { const c = docFor(kingC()) ? docChar() : null; return { c: c || pseudoChar(92, 'scholar', 0, 58, 'Городской лекарь'), x: 0, y: 0, dir: 'down', f: 0, moving: 0 }; }
function sickBedCap() { const k = kingC(), I = k.ill, D = I && DIS[I.k], nd = I ? Math.max(1, I.end - G.day) : 1, who = HEAL.vis[0] ? HEAL.vis[0].c.name : 'Лекарь';
  return who + ' щупает пульс: «' + (D ? sCap(D.n) : 'Хворь') + ', государь. Лежать дней ' + nd + '».'; }
function sickTitle() { const I = kingC().ill; return I ? sCap(DIS[I.k].n) : 'Выздоровление'; }
function sickUp() { const k = kingC(), I = k.ill; if (I) { I.up = 1; UI.toast('Король встаёт, хоть болезнь ещё не ушла.'); return; } UI.toast('Король встаёт с постели. Пару дней — слабость: без охоты и меча.'); log('Король поднялся с постели после болезни.', 'info'); }
function sickNot(k) { k = k || kingC(); if (k.ill) return 'Вы больны (' + DIS[k.ill.k].n + '), государь, лекарь велит беречься'; if (k.sickConv > G.day) return 'Вы ещё слабы после болезни, государь'; return null; }
function sickSpd(c) { if (!c || c.id !== G.player.char) return 1; const I = c.ill; return I ? (I.k === 'gout' ? 0.55 : I.bed ? 0.7 : 0.85) : c.sickConv > G.day ? 0.9 : 1; }
{ const hw0 = huntWhyNot; huntWhyNot = function () { const w = hw0(); if (w) return w; const s = sickNot(); return s ? s + '. Охота подождёт.' : null; }; }
function sickBadge() { const k = G && kingC(); if (!k || HEAL.on || COURT.hunt) return; const I = k.ill, cv = !I && k.sickConv > G.day; if (!I && !cv) return;
  const y = k.wound > G.day ? 36 : 22, D = I && DIS[I.k], n = I ? Math.max(1, I.end - G.day) : k.sickConv - G.day, s = (I ? sCap(D.n) : 'Слабость') + ' · ' + n + ' дн.', w = tw(s, { f: 's' }) + 16;
  rect(W - w - 6, y, w, 12, 'rgba(20,14,12,0.8)'); spr('i_sick', W - w - 3, y + 3); txt(s, W - w + 5, y + 3, I && (I.bed || I.cr) ? UIC.bad : UIC.warn, { f: 's' });
  const tip = I ? [sCap(D.n) + (I.bed ? ' — постельная болезнь' : ''), 'Пройдёт примерно через ' + dn(n) + (I.cr ? '; кризис ' + inDays(I.cr - G.day) + ' (' + riskWord(sickRisk(k)) + ')' : '') + '.', 'Ни охоты, ни меча, ни турнира; ходить медленнее.', I.up ? { t: 'Король на ногах: болезнь тяжелее. Нажмите, чтобы лечь.', c: UIC.warn } : { t: 'Лекарь — в библиотеке или у грядок с травами.', c: UIC.dim }] : ['Слабость после болезни', 'Ещё ' + dn(n) + ' без охоты и меча.'];
  hit(W - w - 6, y, w, 12, { id: 'ksick', tip, onClick: I && I.bed && I.up && kingIllFree() ? () => sickBedStart() : null }); }
{ const dh2 = drawCourtHUD; drawCourtHUD = function () { dh2(); if (!HEAL.on) sickBadge(); }; }
// ---------- the sick as people: what they are called, what they say, a visit to the bedside ----------
{ const ns0 = npcSub; npcSub = function (n) { const s = ns0(n), c = n.c; return c && !c.pseudo && c.ill ? (s ? s + ' · ' : '') + sickWord(c) : s; }; }
function catchFrom(c) { const I = c.ill, D = DIS[I.k], k = kingC(); if (!D.ct || k.ill || k.illQ || (D.imm && k.imm && k.imm[I.k]) || (D.kid && k.age >= 14)) return;
  if (R.chance(D.ct * (I.iso ? 0.5 : 2.5))) k.illQ = { k: I.k, day: G.day + R.i(1, 2), why: 'заразил' + (k.fem ? 'ась' : 'ся') + ' от: ' + whoName(c) }; }
{ const tt0 = talkTo; talkTo = function (n) { const c = n.c; if (c && !c.pseudo && c.ill && !n.petition && !n.envoy && !n.msgr && !n.visitor) { if (c.ill.bed && n.lie) return sickVisit(n, tt0); catchFrom(c); if (R.chance(0.6)) say(n, R.pick(DIS[c.ill.k].sym), 2.5); } return tt0(n); }; }
function sickVisit(n, t0) { const c = n.c, I = c.ill, D = DIS[I.k], f = c.fem;
  if (I.iso && !I.isoOk) { DLG.say(null, 'У постели — завеса из полотна. «' + sCap(D.n) + ' прилипчива, — велел лекарь. — Никого не пускать».', { name: sCap(whoName(c)), choices: [{ t: 'Всё равно подойти', tip: 'Король может заразиться.', fx: () => { I.isoOk = 1; sickVisit(n, t0); } }, { t: 'Уйти', fx: () => { } }], esc: 1 }); return; }
  catchFrom(c); const line = R.pick(D.sym); say(n, line, 3);
  const st = I.cr ? (sickRisk(c) >= 0.06 ? 'Жар не спадает; лекарь хмурится.' : 'Лекарь говорит: кризис ' + inDays(I.cr - G.day) + '.') : 'Худшее позади: идёт на поправку.';
  const ch = [{ t: 'Пожелать скорейшего выздоровления', ok: () => !I.wish, why: 'Вы уже навещали ' + (f ? 'её' : 'его'), fx: () => { I.wish = 1; if (isFam(c)) c.aff = clamp((c.aff || 50) + 3, 0, 100); else c.loy = clamp((c.loy || 50) + 2, 0, 100); say(n, R.pick(['Спасибо, государь…', 'Мне уже легче…', 'Храни вас Бог, государь.']), 3); } },
    { t: 'Прислать лекаря', ok: () => !!npcByKey('srv_doc'), why: 'Лекаря сейчас нет при дворе', fx: () => docCall(n) }, { t: 'Поговорить', fx: () => t0(n) }, { t: 'Уйти', fx: () => { } }];
  DLG.say(n, c.name + ' в постели (' + D.n + '). «' + line + '» ' + st, { choices: ch, esc: 3 }); }
function docCall(n) { const dn = npcByKey('srv_doc'), sp = visitSpot(n); if (!dn) return;
  if (sp && !dn.hidH) { dn.override = { spot: sp, until: hourAbs() + 1, day: G.day, doc: 1 }; dn.curT = null; dn.hold = 0; dn.wander = null; dn.visitPt = n.key; if (dn.loc === COURT.loc && !dn.away) say(dn, 'Иду, государь!', 2.5); }
  docPatient(dn, n.c); }
// ---------- talking to the physician ----------
function courtSick() { return sickPeople().filter(c => c.ill && whereOf(c) === 'court'); }
function seasonAdvice() { const s = seasonOf(G.day);
  return ['Весной у детей бывает корь: заболеет один — отделите его, пока не перекинулось.', 'Летом берегитесь дурной воды и пиров в жару: от них кровавый понос и лихорадка.', 'Осень сырая: лихорадка и простуда. Огонь в покоях не гасить.', 'Зима: простуда и грудная горячка ходят по замку. Держите детей в тепле.'][s]; }
function docReport() { const L = courtSick(), k = kingC(), C = G.court;
  const pl = C.plague ? 'В королевстве моровое поветрие! ' + (C.plague.shut ? 'Ворота замка затворены. ' : 'Затворите ворота, государь. ') : '';
  if (!L.length) return pl + R.pick(['Слава Богу, при дворе все здоровы, государь.', 'Больных нет, государь. Сушу травы и жду.']) + ' ' + seasonAdvice();
  return pl + 'Больны: ' + L.slice(0, 4).map(c => (c.id === k.id ? 'вы, государь' : whoName(c)) + ' — ' + DIS[c.ill.k].n + (c.ill.bed ? ', в постели' : '') + (c.ill.cr ? ' (' + riskWord(sickRisk(c)) + ')' : '')).join('; ') + (L.length > 4 ? '; и ещё ' + (L.length - 4) : '') + '.'; }
function docTalk(n) { const C = G.court, d = C.doc, k = kingC(), L = courtSick(); if (!d) { DLG.say(n, 'Лекаря при дворе нет.'); return; } const ch = [];
  if (L.length) ch.push({ t: 'Как лечишь больных?', fx: () => docPatients(n) });
  ch.push({ t: k.ill ? 'Что со мной?' : 'Осмотри меня', fx: () => docExam(n) }, { t: 'Лекари и жалованье', fx: () => docHire(n) });
  ch.push({ t: d.camp ? 'В походах оставайся при дворе' : 'Езжай со мной в походы', tip: d.camp ? ['Сейчас лекарь едет с королём в поход.', 'Двор тогда без лекаря: больные там рискуют больше (×1,3).'] : ['Лекарь будет при короле в лагере: раны и хвори лечатся лучше, войско выздоравливает быстрее.', 'Зато двор останется без лекаря.'],
    fx: () => { d.camp = d.camp ? 0 : 1; DLG.say(n, d.camp ? '«Соберу сумку с травами и ланцетами, государь.»' : '«Буду при дворе, государь. Здесь тоже есть кого лечить.»'); } });
  if (C.plague) ch.push({ t: C.plague.shut ? 'Открыть ворота замка' : 'Затворить ворота замка', tip: C.plague.shut ? 'Знать и купцы снова смогут приезжать.' : ['Мор реже проникнет в замок (втрое).', 'Знать обидится на закрытые ворота (верность −2).'], fx: () => { C.plague.shut = C.plague.shut ? 0 : 1; if (C.plague.shut) { for (const H0 of G.houses) if (H0.alive) houseLoy(H0, -2); log('Ворота замка затворены от мора.', 'info'); } else log('Ворота замка снова открыты.', 'info'); } });
  ch.push({ t: 'Ступай', fx: () => { } }); DLG.say(n, docReport(), { choices: ch, esc: ch.length - 1 }); }
function docPatients(n) { const L = courtSick().slice(0, 5); if (!L.length) { DLG.say(n, '«Больных больше нет, государь.»'); return; }
  const ch = L.map(c => ({ t: sCap(c.id === kingC().id ? 'вы, государь' : whoName(c)) + ' — ' + DIS[c.ill.k].n, fx: () => docPatient(n, c) })); ch.push({ t: 'Назад', fx: () => docTalk(n) });
  DLG.say(n, '«О ком хотите знать, государь?»', { choices: ch, esc: ch.length - 1 }); }
function docPatient(n, c) { const I = c.ill, me = c.id === kingC().id; if (!I) { DLG.say(n, '«' + sCap(whoName(c)) + ' уже на ногах, государь.»'); return; } const D = DIS[I.k], cls = ageCls(c), p = sickRisk(c);
  const st = I.cr ? 'Кризис ' + inDays(I.cr - G.day) + ', ' + riskWord(p) + '.' : D.m[cls] ? 'Кризис миновал — идёт на поправку.' : 'Не опасно, пройдёт само.';
  const t = (me ? 'У вас ' : sCap(whoName(c)) + ': ') + D.n + (I.bed ? ', в постели. ' : ', на ногах. ') + st + ' Лечу: ' + TRT[I.tr].n.toLowerCase() + (I.th ? ' и терияк' : '') + (I.iso ? '; больной отделён' : '') + '.';
  const ch = ['bleed', 'herbs', 'rest'].map(t2 => ({ t: TRT[t2].n + (I.tr === t2 ? ' ✓' : ''), tip: [TRT[t2].d, I.cr ? 'Опасность при этом: ' + riskWord(sickRisk(c, t2)) + '.' : ''], fx: () => { setTrt(c, t2); docPatient(n, c); } }));
  if (I.cr && !I.th) ch.push({ t: 'Дать терияк (12 зол.)', tip: ['Венецианское снадобье из полусотни трав, мёда и змеиного мяса.', 'При тяжёлой болезни риск ниже на пятую часть.'], ok: () => gold0() >= 12, why: 'Не хватает золота.', fx: () => { if (!spend(12)) return; I.th = 1; Snd.sfx('chime'); docPatient(n, c); } });
  if (D.ct && !me) ch.push({ t: I.iso ? 'Вернуть к людям' : 'Отделить от других', tip: I.iso ? 'Болезнь снова сможет перекинуться на других.' : 'Болезнь прилипчива: отделённый больной заражает других в 6 раз реже.', fx: () => { I.iso = I.iso ? 0 : 1; I.isoOk = 0; docPatient(n, c); } });
  ch.push({ t: 'Назад', fx: () => docTalk(n) }); DLG.say(n, t, { choices: ch, esc: ch.length - 1 }); }
function docExam(n) { const k = kingC(), I = k.ill, ch = []; let t;
  if (I) { const D = DIS[I.k]; t = 'У вас ' + D.n + ', государь. ' + (I.cr ? 'Кризис ' + inDays(I.cr - G.day) + ': ' + riskWord(sickRisk(k)) + '.' : 'Опасности нет — дело нескольких дней.') + (I.up ? ' Вам бы лечь: на ногах болезнь тяжелее.' : '');
    if (I.bed && !HEAL.on) ch.push({ t: 'Лечь в постель', fx: () => sickBedStart() }); ch.push({ t: 'Как лечить меня?', fx: () => docPatient(n, k) }); }
  else { t = R.pick(['Пульс ровный, язык чистый.', 'Сердце бьётся ровно, глаза ясные.']) + ' Вы здоровы, государь.' + (k.wound > G.day ? ' Рана заживает как должно.' : '') + (k.age >= 50 ? ' Но годы: поменьше вина и жирной дичи — подагра и удар любят пирующих.' : k.goutN ? ' Берегите ногу от пиров.' : '');
    ch.push({ t: 'Укрепляющий отвар (3 зол.)', tip: 'Три недели хвори пристают к королю на четверть реже.', ok: () => !(k.tonic > G.day) && gold0() >= 3, why: k.tonic > G.day ? 'Вы уже пьёте отвар' : 'Не хватает золота.', fx: () => { if (!spend(3)) return; k.tonic = G.day + DAYS_SEASON; Snd.sfx('chime'); DLG.say(n, '«Горький, государь, но верный. По чаше утром и вечером.»'); } }); }
  ch.push({ t: 'Назад', fx: () => docTalk(n) }); DLG.say(n, t, { choices: ch, esc: ch.length - 1 }); }
function docHire(n) { const C = G.court, d = C.doc, Q = C.docQ;
  const t = (d ? 'Ныне лечит ' + d.name + ', ' + DOCK[d.kind].sub + ': искусство ' + d.med + ' из 20, жалованье ' + DOCK[d.kind].wage + ' зол. в неделю.' : 'Лекаря при дворе нет.') + (Q ? ' Послано за новым: ' + DOCK[Q.kind].sub + ', будет ' + inDays(Q.day - G.day) + '.' : ' Можно послать за другим — прежний уйдёт.');
  const ch = Object.keys(DOCK).map(kd => { const K = DOCK[kd]; return { t: K.n + ' — ' + K.cost + ' зол.', tip: [K.d, 'Искусство ' + K.med[0] + '–' + K.med[1] + ', жалованье ' + K.wage + ' зол. в неделю; в пути ' + K.days[0] + '–' + K.days[1] + ' дн.'],
    ok: () => !C.docQ && gold0() >= K.cost, why: C.docQ ? 'За лекарем уже послали' : 'Не хватает золота.', fx: () => { if (!spend(K.cost)) return; C.docQ = { kind: kd, day: G.day + R.i(K.days[0], K.days[1]) }; log('За новым лекарем послано: ' + K.sub + ' (' + inDays(C.docQ.day - G.day) + ').', 'info'); Snd.sfx('coin');
      DLG.say(n, d ? '«Воля ваша, государь. Дождусь преемника и передам ему больных.»' : '«Гонец уже в пути, государь.»'); } }; });
  ch.push({ t: 'Назад', fx: () => docTalk(n) }); DLG.say(n, t, { choices: ch, esc: ch.length - 1 }); }
// ---------- the council: a sick advisor works at half strength — or not at all from his bed; he does not come to the table ----------
{ const od0 = ordersDaily; ordersDaily = function () { const C = G.court, mod = [];
    for (const s of SEATS) { const o = C.orders[s.k], c = seatChar(s.k); if (!o || !c || !c.ill || !c.alive) continue; const f = c.ill.bed ? 0 : 0.5; if (o.eff === undefined) o.eff = orderEff(c, s.k, o.mode); mod.push([o, o.eff]); o.eff *= f; o.day0 += 1 - f; }
    try { od0(); } finally { for (const [o, e] of mod) o.eff = e; } }; }
{ const cp0 = councilPresence; councilPresence = function () { const r = cp0(); r.sick = r.come.filter(e => e.c.ill && e.c.ill.bed); if (r.sick.length) r.come = r.come.filter(e => !r.sick.includes(e)); return r; }; }
function sickNote(pr) { return pr.sick && pr.sick.length ? ' Больны и лежат: ' + pr.sick.map(e => lowFirst(e.s.n) + ' (' + e.c.name + ')').join(', ') + '.' : ''; }
// ---------- the treatise ----------
REFS.push({ s: 'Болезни', t: 'Болезни и лекарь', b: () => 'Хвори ходят по замку по сезонам: зимой простуда и грудная горячка, летом кровавый понос (после пиров и в походе) и лихорадка, весной у детей корь. Изредка приходит оспа, раз в полвека — моровое поветрие. У старших — подагра (после пиров) и удар.\n' +
  '• Больной лежит в постели. Советник в постели не работает, на ногах — вполсилы, на совет не приходит.\n• Тяжёлая болезнь проходит через кризис: в этот день решается, выживет ли больной. Опасность зависит от болезни, возраста (дети и старики — в опасности), лекаря и лечения.\n' +
  '• Лекарь двора обходит больных утром и вечером, днём он в библиотеке или у грядок с травами. С ним — доклад о больных, лечение (кровь, травы, покой; терияк — 12 зол.), отделение заразных, осмотр короля, поход с королём и смена лекаря.\n' +
  '• Лекари: ' + Object.keys(DOCK).map(k => DOCK[k].n.toLowerCase() + ' (' + DOCK[k].cost + ' зол., искусство ' + DOCK[k].med[0] + '–' + DOCK[k].med[1] + ')').join(', ') + '. С каждым больным лекарь набирается опыта.\n' +
  '• Король болен — ни охоты, ни меча, ни турнира; при тяжёлой хвори его укладывают в покоях (можно перемогаться на ногах — опаснее). Навещать заразных — риск заразиться. Молитва «О здравии», знание «Противоядия» и поручение магистра «Лечить больных» снижают опасность.' });
