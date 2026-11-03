// ===== SICK (v3.6): illness at court — the season's colds and fevers, the flux after feasts, pox and measles in the nursery, gout, the stroke; the court physician =====
// c.ill = { k, d0, end, cr (the crisis day; 0 when passed or there is none), bed, tr (treatment), th (theriac given), iso (kept apart), up (the king stays on his feet), asked, why }
// c.imm = { pox: 1, measles: 1 } — survived once; c.goutN — bouts so far; c.illQ = { k, day, why } — caught, shows on that day; c.sickConv — the king is weak until then; c.tonic — the king drinks a tonic until then
// G.court.doc = { i, kind, name, fem, age, med, xp, d0, camp, unpaid } — the physician; G.court.docQ = { kind, day } — one sent for; G.court.plague = { d0, end, shut }
const SICK = { q: 0, bt: 3, rd: null, dc: null, noDeath: 0 };
const DIS = {
  cold: { n: 'простуда', g: 'простуды', p: 0.012, seas: [0.7, 0.25, 1.2, 1.85], ct: 0.011, dur: [3, 6], bed: [0.25, 0, 0.2], m: [0, 0, 0], cx: [0.011, 0.004, 0.025], sym: ['Кхе-кхе…', 'Апчхи!', '*шмыгает носом*', 'Кхе! Простите…'] },
  fever: { n: 'лихорадка', g: 'лихорадки', p: 0.0011, seas: [0.7, 1.7, 1.3, 0.3], ct: 0.004, dur: [5, 9], bed: [1, 1, 1], m: [0.013, 0.01, 0.05], sym: ['Ох… знобит…', 'Пить…', 'Голова горит…'] },
  chest: { n: 'грудная горячка', g: 'грудной горячки', p: 0.0003, seas: [0.7, 0.1, 0.9, 2.3], ct: 0.003, dur: [8, 14], bed: [1, 1, 1], m: [0.045, 0.038, 0.16], sym: ['Кха! Кха-кха…', '*хрипло дышит*', 'Грудь давит…'] },
  flux: { n: 'кровавый понос', g: 'кровавого поноса', p: 0.0004, seas: [0.5, 1.9, 1.3, 0.3], ct: 0.006, dur: [5, 10], bed: [1, 1, 1], m: [0.028, 0.021, 0.09], sym: ['Ох, живот…', 'Воды… чистой воды…', '*стонет*'] },
  pox: { n: 'оспа', g: 'оспы', p: 0.00005, seas: [1.3, 0.8, 1, 0.9], ct: 0.03, imm: 1, dur: [12, 18], bed: [1, 1, 1], m: [0.075, 0.07, 0.2], sym: ['Всё горит…', 'Не смотрите на меня…', 'Пить…'] },
  measles: { n: 'корь', g: 'кори', p: 0.0005, kid: 1, seas: [1.6, 0.6, 0.8, 1], ct: 0.05, imm: 1, dur: [7, 10], bed: [1, 1, 1], m: [0.015, 0.04, 0.06], sym: ['Чешется…', 'Глаза болят от света…', 'Кхе…'] },
  gout: { n: 'подагра', g: 'подагры', p: 0.0003, min: 38, seas: [1, 0.8, 1.1, 1.1], dur: [4, 9], bed: [0, 0, 0], m: [0, 0, 0], sym: ['Ох, нога!', 'Проклятая подагра…', '*хромает и охает*'] },
  stroke: { n: 'удар', g: 'удара', p: 0.00016, min: 52, seas: [1, 1.1, 1, 0.9], dur: [10, 20], bed: [1, 1, 1], m: [0.3, 0.3, 0.3], cr0: 1, sym: ['…', '*мычит*', '*смотрит в одну точку*'] },
  childbed: { n: 'родильная горячка', g: 'родильной горячки', p: 0, dur: [6, 10], bed: [1, 1, 1], m: [0.15, 0.15, 0.15], sym: ['Где дитя?..', 'Жарко…', 'Пить…'] },
  plague: { n: 'моровое поветрие', g: 'морового поветрия', p: 0, ct: 0.02, dur: [5, 8], bed: [1, 1, 1], m: [0.5, 0.45, 0.6], sym: ['Пить…', '*стонет*', 'Не подходите…'] },
};
const ONSET = ['cold', 'fever', 'chest', 'flux', 'pox', 'measles', 'gout', 'stroke'], GRAVE = ['chest', 'pox', 'stroke', 'childbed', 'plague'];
const DOCK = {
  barber: { n: 'Цирюльник из города', sub: 'цирюльник', cost: 4, wage: 1, med: [3, 5], cap: 9, days: [1, 2], tr: 'bleed', age: [28, 50], names: [['Цирюльник Ульрих', 0], ['Цирюльник Йост', 0], ['Цирюльник Мартин', 0]],
    d: 'Бреет, рвёт зубы и пускает кровь — от всего. Дёшев; детям и старикам его ланцет опасен.' },
  monk: { n: 'Брат-лекарь из монастыря', sub: 'монастырский лекарь', cost: 15, wage: 1, med: [6, 9], cap: 12, days: [2, 4], tr: 'herbs', age: [38, 62], names: [['Брат Илларион', 0], ['Брат Савва', 0], ['Брат Лука', 0], ['Сестра Хильдегарда', 1]],
    d: 'Травы монастырского сада, отвары и молитва. Надёжен, но не учён. Вклад монастырю — 15 зол.' },
  salerno: { n: 'Магистр из Салерно', sub: 'магистр медицины из Салерно', cost: 120, wage: 4, med: [12, 15], cap: 17, days: [10, 14], tr: 'best', cul: 'R', age: [32, 56], names: [['Магистр Маттео Платеарий', 0], ['Магистр Роджер Салернский', 0], ['Магистра Трота из Салерно', 1]],
    d: 'Школа Салерно — лучшая выучка христианского мира: пульс, диета, покой, травы к месту.' },
  cordoba: { n: 'Учёный лекарь из Кордовы', sub: 'учёный лекарь из Кордовы', cost: 160, wage: 5, med: [15, 18], cap: 20, days: [16, 22], tr: 'best', iso: 1, cul: 'R', age: [36, 60], names: [['Лекарь Исаак из Кордовы', 0], ['Учёный Юсуф из Кордовы', 0]],
    d: 'Читал «Канон» Авиценны: знает, что хворь прилипчива, и сам отделяет заразных. Лучший — и самый дорогой.' },
};
const TRT = {
  bleed: { n: 'Пустить кровь', d: 'С кровью, верят лекари, уходят дурные соки. Взрослым жар спадает на день раньше; детям и старикам — опасно.' },
  herbs: { n: 'Травы и отвары', d: 'Ромашка, шалфей, ивовая кора от жара: болезнь проходит на день быстрее, риск чуть ниже.' },
  rest: { n: 'Покой, тепло и бульон', d: 'Лежать в тепле и не вставать: болезнь тянется на день дольше, зато риск заметно ниже.' },
};
const ageCls = c => (c.age < 14 ? 0 : c.age < 55 ? 1 : 2), sCap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const DOC_SCHED = [[5, 'stairs'], [6.5, 'lib_shelf'], [9, 'herbs'], [11, 'lib_shelf'], [14, 'herbs'], [16, 'lib_shelf'], [20.5, 'stairs']];
Object.assign(LOOK_EXT, {
  doc_barber: () => ({ o: 'tunic', cl: 'wine', bg: 'brown', hat: 'cap', apron: 1 }),
  doc_monk: (r, fem) => ({ o: 'monk', cl: 'brown', bg: 'teal', hat: fem ? 'veil' : 'none' }),
  doc_salerno: (r, fem) => ({ o: 'robe', cl: 'red', bg: 'teal', hat: fem ? 'veil' : 'cap', chain: 1 }),
  doc_cordoba: () => ({ o: 'robe', cl: 'navy', bg: 'teal', hat: 'skull' }),
});
// ---------- who falls ill: the king, his family, the wards, the council ----------
function sickPeople() { const C = G.court, k = kingC(), S = new Set(), out = [];
  const add = c => { if (c && c.alive && !c.pseudo && c.realm === 0 && !(c.prison >= 0) && !c.away && c.age >= 3 && !S.has(c.id)) { S.add(c.id); out.push(c); } };
  add(k); for (const c of royalFamily()) add(c); for (const w of (C.wards || [])) add(charOf(w)); for (const s of SEATS) { const id = C.seats[s.k]; if (id >= 0) add(charOf(id)); } return out; }
function sickCircle(c) { return !!(G.court && c && sickPeople().includes(c)); }
function isFam(c) { const k = kingC(); return !!(c && (c.id === k.id || c.blood || c.id === k.spouse || c.dowager)); }
function whereOf(c) { return (c.id === G.player.char && !G.atCourt) || c.withKing ? 'camp' : 'court'; }
function kin(a, b) { const k = kingC(), kids = k.kids || []; return a.spouse === b.id || b.spouse === a.id || (a.kids || []).includes(b.id) || (b.kids || []).includes(a.id) || (kids.includes(a.id) && kids.includes(b.id)); }
function whoName(c) { const k = kingC(), s = seatOf(c); if (c.id === k.id) return (c.fem ? 'королева ' : 'король ') + c.name; if (s) return lowFirst(seatName(s)) + ' ' + c.name;
  if (c.id === k.spouse) return (k.fem ? 'супруг королевы ' : 'королева ') + c.name; if (c.dowager) return 'вдовствующая королева ' + c.name; if (c.blood || (k.kids || []).includes(c.id)) return (c.fem ? 'принцесса ' : 'принц ') + c.name;
  if ((G.court.wards || []).includes(c.id)) return (c.fem ? 'воспитанница ' : 'воспитанник ') + c.name; return c.name; }
function sickWord(c) { const I = c.ill; return I ? (c.fem ? 'больна: ' : 'болен: ') + DIS[I.k].n : ''; }
function sickTag(c) { return c && c.alive && c.ill ? ' · ' + sickWord(c) : ''; }
function healOrd() { const o = G.court.orders && G.court.orders.magister; return !!(o && o.k === 'heal'); }
// ---------- the physician ----------
function docMk(kind) { const C = G.court, K = DOCK[kind], nm = R.pick(K.names); C.docN = (C.docN || 0) + 1;
  return { i: 600 + C.docN, kind, name: nm[0], fem: nm[1], age: R.i(K.age[0], K.age[1]), med: R.i(K.med[0], K.med[1]), xp: 0, d0: G.day, camp: C.doc ? C.doc.camp || 0 : 0, unpaid: 0 }; }
function docEnsure() { const C = G.court; if (C && !C.doc && !C.docQ && !C.docInit) { C.docInit = 1; C.doc = docMk('monk'); C.doc.name = 'Брат Илларион'; C.doc.fem = 0; C.doc.med = 7; C.doc.age = 52; } }
function docChar() { const d = G.court && G.court.doc; if (!d) return null; const S = SICK.dc;
  if (!S || S.id !== 7000 + d.i || S.name !== d.name) { SICK.dc = pseudoChar(d.i, 'doc_' + d.kind, d.fem, d.age, d.name); if (DOCK[d.kind].cul) SICK.dc.cul = DOCK[d.kind].cul; } SICK.dc.age = d.age; return SICK.dc; }
function docInCamp() { const d = G.court && G.court.doc; return !!(d && d.camp && !G.atCourt); }
function docFor(c) { const d = G.court && G.court.doc; if (!d) return null; return (whereOf(c) === 'camp') === docInCamp() ? d : null; }
function docM(c) { const d = docFor(c); return d ? clamp(1.3 - 0.04 * d.med, 0.62, 1.2) : 1.5; } // the death risk: no physician ×1.5, a barber ×1.15, the monk ×1, the best ×0.65
function docK() { return clamp(docM(kingC()), 0.75, 1.3); } // for the king's wounds (hurt.js)
function durK(c) { const d = docFor(c); return d ? clamp(1.12 - 0.012 * d.med, 0.88, 1.1) : 1.15; }
function docMethod(c, I) { const d = docFor(c); if (!d) return 'rest'; const t = DOCK[d.kind].tr; if (t !== 'best') return t; return I.bed && DIS[I.k].m[ageCls(c)] ? 'rest' : 'herbs'; }
function trtDur(k, t) { return t === 'bleed' ? (k === 'fever' || k === 'chest' ? -1 : 0) : t === 'herbs' ? (k === 'cold' || k === 'fever' || k === 'flux' ? -1 : 0) : t === 'rest' ? 1 : 0; }
function trtM(c, I, t) { t = t || I.tr; const cls = ageCls(c); let m = t === 'bleed' ? (cls === 1 ? 0.97 : 1.3) : t === 'herbs' ? 0.92 : t === 'rest' ? (I.bed ? 0.85 : 0.95) : 1; if (I.th) m *= GRAVE.includes(I.k) || I.k === 'flux' ? 0.8 : 0.95; return m; }
function mortK(c, I, t) { const C = G.court; let m = docM(c) * trtM(c, I, t); if (c.age < 5) m *= 1.3; if (c.age >= 70) m *= 1.4;
  if (isFam(c)) { if (hasTech('antidotes')) m *= 0.8; if (C.hpray >= G.day - DAYS_SEASON) m *= 0.85; } if (I.up) m *= 1.4; if (whereOf(c) === 'camp') m *= 1.25; if (healOrd() && whereOf(c) === 'court') m *= 0.9; if (I.wish) m *= 0.95; return m; }
function sickRisk(c, t) { const I = c.ill; return I && I.cr ? DIS[I.k].m[ageCls(c)] * mortK(c, I, t) : 0; }
function riskWord(p) { return p <= 0 ? 'не опасно' : p < 0.02 ? 'почти не опасно' : p < 0.06 ? 'опасно' : p < 0.15 ? 'очень опасно' : 'смертельно опасно'; }
function setTrt(c, t) { const I = c.ill; if (!I) return; const nd = trtDur(I.k, t); I.end = Math.max(G.day + 1, I.end - (I.trd || 0) + nd); I.trd = nd; I.tr = t; if (I.cr && I.cr >= I.end) I.cr = I.end - 1; }
function docXp(c) { const d = docFor(c); if (!d) return; d.xp = (d.xp || 0) + 1; if (d.xp % 8 === 0 && d.med < DOCK[d.kind].cap) { d.med++; log('Лекарь ' + d.name + ' набирается опыта: искусство ' + d.med + '.', 'info'); } }
// ---------- falling ill, the crisis, getting well ----------
function sickStart(c, k, why) { if (!c || !c.alive || !DIS[k] || (c.ill && !(c.ill.k === 'cold' && k !== 'cold'))) return null; c.ill = null; const D = DIS[k], cls = ageCls(c), d = docFor(c), king = kingC(); // a graver illness takes the place of a cold
  const dur = Math.max(2, Math.round(R.i(D.dur[0], D.dur[1]) * durK(c))), I = { k, d0: G.day, end: G.day + dur, cr: 0, bed: R.chance(D.bed[cls]) ? 1 : 0, tr: 'rest', trd: 0, iso: 0, why: why || '' };
  if (D.m[cls] > 0) I.cr = G.day + (D.cr0 ? 1 : Math.max(1, Math.round(dur * R.range(0.35, 0.6))));
  if (k === 'gout') c.goutN = (c.goutN || 0) + 1; c.ill = I; setTrt(c, docMethod(c, I)); if (d && DOCK[d.kind].iso && D.ct) I.iso = 1;
  const nm = sCap(whoName(c)), vis = SCREEN === 'court' && !G.visit, C = G.court, f = c.fem;
  if (c.id === king.id) { const t = whereOf(c) === 'camp' ? 'Король занемог в походе: ' + D.n + '. ' + (d ? 'Лекарь ' + d.name + ' при нём.' : 'Лекаря в лагере нет.') : (k === 'gout' ? 'Подагра! Нога распухла — ходить больно.' : k === 'cold' ? 'Король простудился. Пару дней — без охоты и меча.' : 'Король занемог: ' + D.n + '.');
    log(t, I.bed ? 'bad' : 'info'); UI.toast(t); if (I.bed && whereOf(c) === 'court') SICK.q = 1; }
  else { const t = nm + (k === 'stroke' ? ': удар! ' + (f ? 'Её' : 'Его') + ' уложили в постель.' : (f ? ' занемогла: ' : ' занемог: ') + D.n + (why ? ' (' + why + ')' : '') + '.' + (I.bed ? ' Лежит в постели.' : ''));
    log(t, isFam(c) && I.bed ? 'bad' : 'info'); if (vis && (isFam(c) || I.bed)) UI.toast(t);
    if (!C.sickHint && vis) { C.sickHint = 1; setTimeout(() => UI.toast('Лекарь двора обходит больных; днём он в библиотеке или у грядок с травами. С ним можно выбрать лечение.'), 2600); } }
  if (vis) { const n = sickNpc(c); if (n) { n.curT = null; n.hold = 0; n.wander = null; } } return I; }
function sickNpc(c) { return COURT.npcs.find(n => n.c === c && !n.visitor) || null; }
function sickProgress(c) { const I = c.ill, D = DIS[I.k], cls = ageCls(c), k = kingC(), inBed = c.id === k.id && HEAL.on && HEAL.o && HEAL.o.from === 'ill';
  if (I.k === 'cold' && G.day === I.d0 + 2 && R.chance(D.cx[cls] * docM(c) * (I.up ? 1.5 : 1))) { c.ill = null; sickStart(c, 'chest', 'простуда спустилась в грудь'); return; }
  if (inBed && I.cr && I.cr === G.day + 1) sickCap('Жар растёт. ' + docName() + ' не отходит от постели, капеллан молится у изголовья.');
  if (I.cr && G.day >= I.cr) { I.cr = 0; const p = D.m[cls] * mortK(c, I); if (!SICK.noDeath && R.chance(p)) { sickDie(c); return; }
    if (I.k === 'stroke') strokeMark(c); if (inBed) sickCap('Кризис миновал. ' + docName() + ': «Теперь — на поправку, государь».');
    else if (c.id !== k.id && I.bed && D.m[cls] >= 0.03) log(sCap(whoName(c)) + ': кризис миновал.', 'info'); }
  if (G.day >= I.end) sickRecover(c); }
function sickCap(t) { HEAL.cap = t; if (HEAL.lines && HEAL.d0 !== undefined) HEAL.lines[G.day - HEAL.d0] = t; }
function docName() { const d = G.court.doc; return d && docFor(kingC()) ? d.name : 'Лекарь'; }
function strokeMark(c) { const st = R.pick(['mar', 'dip', 'lrn']), v = R.i(1, 3); c[st] = Math.max(1, (c[st] || 5) - v);
  log(sCap(whoName(c)) + ' пережил' + (c.fem ? 'а' : '') + ' удар, но ' + (st === 'mar' ? 'рука ослабела' : st === 'dip' ? 'речь стала невнятной' : 'память подводит') + ' (' + SKN[st] + ' −' + v + ').', 'bad'); }
function sickDie(c) { const I = c.ill, D = DIS[I.k], k = kingC(), fam = isFam(c) || seatOf(c); docXp(c);
  if (c.id === k.id && HEAL.on && HEAL.o && HEAL.o.from === 'ill') { HEAL.cap = ''; healEnd(true); }
  c.ill = null; if (fam && SCREEN === 'court' && c.id !== k.id) UI.toast('✝ ' + sCap(whoName(c)) + ' скончал' + (c.fem ? 'ась' : 'ся') + ' от ' + D.g + '.'); charDies(c, 'от ' + D.g); }
function sickRecover(c) { const I = c.ill, D = DIS[I.k], k = kingC(); docXp(c); c.ill = null; if (D.imm) (c.imm = c.imm || {})[I.k] = 1;
  if (c.id === k.id) { c.sickConv = G.day + (I.bed ? 2 : 1); if (!(HEAL.on && HEAL.o && HEAL.o.from === 'ill')) UI.toast('Король поправился: ' + D.n + ' позади.'); log('Король поправился: ' + D.n + ' позади.', 'info'); }
  else { if (I.bed || isFam(c)) log(sCap(whoName(c)) + ' поправил' + (c.fem ? 'ась' : 'ся') + ': ' + D.n + ' позади.', 'info');
    const n = SCREEN === 'court' && sickNpc(c); if (n) { n.curT = null; if (!n.away && n.loc === COURT.loc) say(n, R.pick(['Хвала небу, мне лучше!', 'Наконец-то на ногах.', 'Будто заново родил' + (c.fem ? 'ась' : 'ся') + '.']), 3); } } }
function onsetP(c, k, s) { const D = DIS[k], C = G.court, cls = ageCls(c), camp = whereOf(c) === 'camp', fd = G.day - (C.feastDay === undefined ? -99 : C.feastDay);
  if ((D.kid && c.age >= 14) || (D.min && c.age < D.min) || (D.imm && c.imm && c.imm[k])) return 0;
  let p = D.p * D.seas[s];
  if (k === 'cold') p *= (cls === 0 ? 1.5 : cls === 2 ? 1.1 : 1) * (camp && s === 3 ? 1.5 : 1);
  else if (k === 'chest') p *= cls === 0 ? 1.3 : cls === 2 ? 1.8 : 1;
  else if (k === 'flux') p *= (cls === 0 ? 1.3 : 1) * (camp ? 4 : fd >= 0 && fd <= 2 ? 3 : 1);
  else if (k === 'fever') p *= camp ? 2.2 : 1;
  else if (k === 'gout') p *= (c.fem ? 0.25 : 1) * (c.goutN ? 3 : 1) * (fd >= 0 && fd <= 7 ? 2.5 : 1);
  else if (k === 'stroke') p *= c.age >= 75 ? 3 : c.age >= 65 ? 2 : 1;
  if (isFam(c)) { if (hasTech('antidotes')) p *= 0.75; if (C.hpray >= G.day - DAYS_SEASON) p *= 0.8; }
  if (c.id === G.player.char && c.tonic > G.day) p *= 0.75; if (healOrd() && !camp) p *= 0.85; return p; }
// ---------- the daily tick ----------
function sickDaily() { const C = G.court; if (!C || !G.chars) return; docEnsure(); docDaily(); const s = seasonOf(G.day), P = sickPeople();
  if (C.plague && G.day >= C.plague.end) { C.plague = null; log('Моровое поветрие отступило.', 'good'); }
  else if (!C.plague && G.day > 120 && R.chance(1 / (DAYS_YEAR * 45))) { C.plague = { d0: G.day, end: G.day + R.i(28, 48), shut: 0 }; log('В королевстве моровое поветрие! Лекарь советует затворить ворота замка.', 'bad'); UI.toast('Моровое поветрие в королевстве!'); if (typeof Snd !== 'undefined') Snd.sfx('bell'); }
  for (const c of P) if (c.illQ && G.day >= c.illQ.day) { const q = c.illQ; c.illQ = null; if (!c.ill) sickStart(c, q.k, q.why); }
  for (const c of P) if (c.alive && c.ill) { sickProgress(c); if (G.over) return; }
  const nw = [];
  for (const a of P) { const I = a.ill; if (!I || !a.alive || G.day <= I.d0) continue; const D = DIS[I.k]; if (!D.ct) continue; const wa = whereOf(a);
    for (const b of P) { if (b === a || (b.ill && (b.ill.k !== 'cold' || I.k === 'cold')) || b.illQ || !b.alive || whereOf(b) !== wa) continue; if ((D.kid && b.age >= 14) || (D.imm && b.imm && b.imm[I.k])) continue;
      const p = D.ct * (I.iso ? 0.15 : 1) * (kin(a, b) ? 1.6 : 1) * (healOrd() && wa === 'court' ? 0.7 : 1) * (C.plague && C.plague.shut ? 0.6 : 1); if (R.chance(p)) nw.push([b, I.k, a]); } }
  for (const [b, k, a] of nw) sickStart(b, k, 'заразил' + (b.fem ? 'ась' : 'ся') + ' от: ' + whoName(a));
  for (const c of P) { if ((c.ill && c.ill.k !== 'cold') || !c.alive) continue; if (C.plague && R.chance(0.004 * (C.plague.shut && whereOf(c) === 'court' ? 0.35 : 1))) { sickStart(c, 'plague', ''); continue; }
    for (const k of ONSET) { if (c.ill && k === 'cold') continue; const p = onsetP(c, k, s); if (p && R.chance(p)) { sickStart(c, k, c.ill ? 'после простуды' : ''); break; } } }
  if (G.day % 7 === 3) for (const c of G.chars) if (c.ill && (!c.alive || G.day > c.ill.end + 1) && !P.includes(c)) c.ill = null; }
function docDaily() { const C = G.court, d = C.doc, r = G.realms[0];
  if (C.docQ && G.day >= C.docQ.day) { const old = C.doc, nd = docMk(C.docQ.kind); C.docQ = null; if (old) log(old.name + ' покидает двор. На смену прибыл' + (nd.fem ? 'а ' : ' ') + nd.name + ' (' + DOCK[nd.kind].sub + ').', 'info'); else log('Ко двору прибыл' + (nd.fem ? 'а ' : ' ') + nd.name + ' (' + DOCK[nd.kind].sub + ').', 'good');
    C.doc = nd; if (SCREEN === 'court' && !G.visit) { UI.toast('Прибыл' + (nd.fem ? 'а ' : ' ') + 'новый лекарь: ' + nd.name + '.'); courtPopulate(); } return; }
  if (!d) return;
  if (dayOfYear(G.day) === 0 && G.day > 0) { d.age++; if (d.age >= 68 && R.chance(0.25)) { log(d.name + ': «Стар я стал, государь». Лекарь уходит на покой; монастырь пришлёт брата.', 'info'); C.doc = null; C.docQ = { kind: 'monk', day: G.day + R.i(3, 6) }; if (SCREEN === 'court' && !G.visit) courtPopulate(); return; } }
  if (G.day % 7 === 1) { const w = DOCK[d.kind].wage; if (r.gold >= w) { r.gold -= w; d.unpaid = 0; } else if (++d.unpaid >= 3) { log(d.name + ' ушёл: три недели без жалованья. Монастырь пришлёт брата из милости.', 'bad'); C.doc = null; C.docQ = { kind: 'monk', day: G.day + 7 }; if (SCREEN === 'court' && !G.visit) courtPopulate(); } } }
DAILY_EXT.push(sickDaily);
// fewer of the old sudden deaths for those who now fall ill and die of a named disease (calibrated: about the same deaths overall with a monastery physician)
{ const dc0 = deathChance; deathChance = function (c) { const p = dc0(c); return c.age >= 3 && sickCircle(c) ? p * (c.age < 55 ? 0.45 : 0.7) : p; }; }
// a birth can bring on the childbed fever
{ const b0 = birth; birth = function (king, sp, mom) { const r = b0(king, sp, mom); if (mom && mom.alive && R.chance(0.06 * docM(mom))) mom.illQ = { k: 'childbed', day: G.day + R.i(1, 3), why: 'после родов' }; return r; }; }
// an old king galloping after the hounds may be struck down (Philip IV of France, 1314)
{ const he2 = huntEnd; huntEnd = function (why, door) { const HU = COURT.hunt, k = kingC(), was = HU && !HU.ended; he2(why, door);
    if (was && why !== 'wound' && k.alive && !k.ill && k.age >= 55 && R.chance(0.012 + (k.age - 55) * 0.002)) { sickStart(k, 'stroke', 'на охоте'); UI.toast('На обратном пути у короля немеет рука, лицо перекашивает. Удар!'); } }; }
