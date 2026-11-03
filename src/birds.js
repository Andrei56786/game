'use strict';
// ===== BIRDS (v3.6): «пташки» — the invisible agents of the King's Eye. They watch the council and everyone who seeks a place at court.
// What they learn comes in order: the main skill, all skills, the nature, loyalty and honour, the hidden motive, the secrets. Speed and
// accuracy come from the Eye's Тень; without an Eye nobody watches. Courtiers carry hidden motives; now and then a petitioner is a spy =====
Object.assign(ICONS, { bird: '...NN|..NkN|NNNN.|.NNN.|..n..' });
const SKL = ['mar', 'dip', 'intr', 'stew', 'lrn'];
const BIRD_LV = ['первое впечатление', 'главный навык', 'все навыки', 'нрав', 'верность и честь', 'тайный мотив', 'тайны'];
const BIRD_NEED = [0, 3, 4, 5, 6, 8, 10]; // watching needed for each next step (a target of an Eye with Тень ≈ 8 gains ≈1 a day)
const MOTIVES = {
  crown: { n: 'Верность короне', d: 'служит из верности — на такого можно положиться' },
  gold: { n: 'Золото', d: 'служит ради золота: щедрость его держит, бедность толкает к воровству' },
  power: { n: 'Власть', d: 'жаждет места в совете — без него озлобится' },
  glory: { n: 'Слава', d: 'ищет славы: в войну он счастлив, в долгий мир скучает' },
  lore: { n: 'Знание', d: 'живёт книгами — магистром работал бы с жаром' },
  house: { n: 'Свой дом', d: 'служит прежде всего своему дому: верен, пока верен его дом' },
  revenge: { n: 'Месть', d: 'затаил обиду на корону — опасен' },
  faith: { n: 'Вера', d: 'набожен: молитвы и милосердие короля ему по сердцу' },
  foe: { n: 'Чужой хозяин', d: 'тайно служит чужой державе' },
};
// deterministic noise (no draw from the game's dice): the same person always makes the same first impression
function h32(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return n >>> 0; }
const hf = (a, b) => h32((a * 92821 + b * 689 + ((G && G.seed) | 0)) | 0) / 4294967296;
const FAMC = { g: null, d: -1, n: -1, s: null };
function famIds() { if (FAMC.g !== G || FAMC.d !== G.day || FAMC.n !== G.chars.length) { const k = kingC(), s = new Set([k.id]); if (k.spouse >= 0) s.add(k.spouse); for (const x of (k.kids || [])) s.add(x); for (const x of ((G.court && G.court.royals) || [])) s.add(x);
  Object.assign(FAMC, { g: G, d: G.day, n: G.chars.length, s }); } return FAMC.s; }
function birdsOf() { const C = G.court; return C.birds || (C.birds = {}); }
function birdBase(c) { return c.role === 'council' || seatOf(c) ? 3 : c.role === 'lord' ? 2 : c.role === 'knight' || c.role === 'courtier' || c.role === 'scholar' ? 1 : 0; }
function birdRec(c) { const B = birdsOf(); let r = B[c.id]; if (!r) { const lv = birdBase(c); r = B[c.id] = { lv, p: 0, err: lv >= 3 ? 0 : lv === 2 ? 1 : 2, d0: G.day }; } return r; }
const birdFull = c => !G.court || famIds().has(c.id);
function motiveOf(c) { if (c.motive) return c.motive; const tr = t => c.traits.includes(t);
  const W = { crown: 1 + ((c.hon || 50) >= 70 ? 1.5 : 0) + (tr('honest') ? 1 : 0), gold: 0.6 + (tr('greedy') ? 3 : 0), power: 0.5 + (tr('proud') ? 1.5 : 0) + ((c.amb || 50) > 65 ? 2 : 0),
    glory: 0.4 + (tr('brave') ? 1.5 : 0) + (tr('reckless') ? 1 : 0) + ((c.mar || 0) >= 12 ? 0.6 : 0), lore: 0.3 + ((c.lrn || 0) >= 12 ? 2 : 0), house: c.house >= 0 ? 1.2 : 0,
    revenge: ((c.loy || 60) < 35 ? 1.2 : 0.15) + (tr('wrathful') ? 0.4 : 0), faith: 0.6 };
  let s = 0; for (const k in W) s += W[k]; let r = hf(c.id, 77) * s, m = 'crown'; for (const k in W) { r -= W[k]; if (r <= 0) { m = k; break; } }
  c.motive = { k: m }; if (m === 'lore') c.motive.b = Math.floor(hf(c.id, 78) * 4); return c.motive; }
// what the king sees: exact, an estimate (≈) or a first-glance range
function skSeen(c, k) { const v = skillOf(c, k); if (birdFull(c)) return { v, s: String(v), ex: 1, kn: 2 };
  const r = birdRec(c), i = SKL.indexOf(k);
  if (r.lv >= 2 || (r.lv >= 1 && k === bestSkill(c))) { const e = r.err || 0, x = clamp(v + Math.round((hf(c.id, 20 + i) - 0.5) * 2 * e), 1, 20); return { v: x, s: (e ? '≈' : '') + x, ex: !e, kn: 1 }; }
  const m = clamp(v + Math.round((hf(c.id, 10 + i) - 0.5) * 6) + (c.claim === k ? (c.motive && c.motive.k === 'foe' ? 5 : 2) : 0), 1, 20), lo = clamp(m - 3, 1, 20), hi = clamp(m + 3, 1, 20);
  return { v: m, lo, hi, s: lo + '–' + hi, kn: 0 }; }
function traitsSeen(c) { const n = c.traits.map(t => TRAITS[t] ? TRAITS[t].n : t); if (birdFull(c) || birdRec(c).lv >= 3) return { s: n.join(', '), all: 1 }; return { s: (n[0] || '') + (n.length > 1 ? ', …' : ''), all: 0 }; }
function motiveSeen(c) { if (birdFull(c) || birdRec(c).lv < 5) return null; const m = motiveOf(c); if (m.k === 'foe' && !spyKnown(c)) return MOTIVES[m.cover || 'gold']; return MOTIVES[m.k]; }
const spySecret = c => G.court.secrets.find(s => s.k === 'spy' && s.who[0] === c.id);
function spyKnown(c) { const s = spySecret(c); return !!(s && s.known); }
function isHiddenSpy(c) { const s = c && spySecret(c); return !!(s && !s.known); }
// ---------- who the birds watch: the newest faces first, then the council, then the heads of houses ----------
function birdTargets() { const e = seatChar('eye'), fam = famIds(), L = [];
  for (const c of G.chars) { if (!c.alive || c.realm !== 0 || c.prison >= 0 || c.age < 16 || fam.has(c.id) || (e && c.id === e.id)) continue;
    const on = !!seatOf(c), cand = c.atCourt && (c.role === 'courtier' || c.role === 'knight' || c.role === 'scholar' || c.role === 'council'), lord = c.role === 'lord';
    if (!on && !cand && !lord) continue; const r = birdRec(c); if (r.lv >= 6 && !on) continue;
    L.push({ c, r, pr: (r.lv >= 6 ? 9 : r.lv) - (on ? 0.5 : 0) + (lord && !on ? 1.5 : 0) - (r.nw && r.lv < 3 ? 3 : 0), k: lord && !on ? 0.5 : 1 }); }
  return L.sort((a, b) => a.pr - b.pr); }
function birdWidth(e) { return 3 + Math.floor(skillOf(e, 'intr') / 5); }
function birdRate(e, n) { const C = G.court; return (0.5 + skillOf(e, 'intr') / 10) * (C.orders.eye && C.orders.eye.k === 'protect' ? 1.4 : 1) * (hasTech('ciphers') ? 1.1 : 1) / Math.sqrt(Math.max(1, n)); }
function birdsDaily() { const C = G.court; if (!C) return; motivesDaily(); const e = seatChar('eye'); if (!e) { C.birdOn = []; return; }
  const T = birdTargets(), L = T.slice(0, birdWidth(e)); C.birdOn = L.map(t => t.c.id); C.birdAll = T.length; if (!L.length) return; const rt = birdRate(e, L.length); let loud = 0;
  for (const t of L) { const r = t.r; r.p = (r.p || 0) + rt * t.k; if (r.lv >= 6) { if (r.p >= 12) { r.p = 0; birdRecheck(t.c, r, e); } continue; }
    const need = BIRD_NEED[r.lv + 1]; if (r.p >= need) { r.p = 0; if (birdStep(t.c, r, e, loud)) loud++; } } }
function birdSay(t, loud) { addReport('eye', 'Пташки: ' + t, !loud); }
function birdStep(c, r, e, loudN) { const nx = r.lv + 1, intr = skillOf(e, 'intr'), nm = c.name, C = G.court; let loud = false;
  if (r.lv < 2) r.err = clamp(Math.round((21 - intr) / 5), 0, 4);
  if (nx === 6) { const S = C.secrets.filter(s => !s.known && s.who.includes(c.id));
    if (S.length) { if (!R.chance(clamp(0.45 + intr / 40, 0.45, 0.95))) { r.p = BIRD_NEED[6] * 0.5; birdSay(nm + ' — что-то тут нечисто, но пока не поймали за руку.', false); return false; }
      r.lv = 6; for (const s of S) { s.known = 1; s.how = 'пташки Ока'; letterFromSeat('eye', 'Тайное донесение', secretText(s) + (s.k === 'spy' ? ' Прикажете схватить? (Малый совет → «Кандидаты»)' : '')); } Snd.sfx('chime'); log('Око короля: пташки раскрыли тайну — ' + secretText(S[0]), 'warn'); return true; }
    r.lv = 6; birdSay(nm + ': ничего дурного пташки не нашли.', false); return false; }
  r.lv = nx;
  if (nx === 1) { const k = bestSkill(c); birdSay(nm + ' сильнее всего в «' + SKN[k] + '»: ' + skSeen(c, k).s + '.', false); }
  else if (nx === 2) { const cl = c.claim, boast = cl && skSeen(c, cl).v + 3 < clamp(skillOf(c, cl) + Math.round((hf(c.id, 10 + SKL.indexOf(cl)) - 0.5) * 6) + (c.motive && c.motive.k === 'foe' ? 5 : 2), 1, 20);
    birdSay(nm + ': ' + SKL.map(k => SKN[k] + ' ' + skSeen(c, k).s).join(', ') + '.' + (boast ? ' Хвалился он зря.' : ''), false); }
  else if (nx === 3) birdSay(nm + ' — ' + traitsSeen(c).s.toLowerCase() + '.', false);
  else if (nx === 4) { const e4 = r.err * 4 + 2, nz = (b, v) => clamp(Math.round((v || 50) + (hf(c.id, b + G.day % 97) - 0.5) * 2 * e4), 0, 100), K0 = C.known[c.id];
    if (!K0 || K0.err >= e4 || G.day - K0.day > 30) C.known[c.id] = { loy: nz(40, c.loy), amb: nz(41, c.amb), hon: nz(42, c.hon), err: e4, day: G.day, how: 'пташки' };
    const K = C.known[c.id]; loud = loudN < 1 && (K.loy < 35 || K.hon < 35); birdSay(nm + ': верность ≈' + K.loy + ', честолюбие ≈' + K.amb + ', честность ≈' + K.hon + ' (±' + K.err + ').', loud); }
  else if (nx === 5) { const m = motiveSeen(c), k = motiveOf(c).k; loud = loudN < 1 && (k === 'revenge' || k === 'power'); birdSay(nm + ' ' + m.d + '.', loud); }
  return loud; }
function birdRecheck(c, r, e) { const C = G.court, intr = skillOf(e, 'intr'), e4 = r.err * 4 + 2, nz = (b, v) => clamp(Math.round((v || 50) + (hf(c.id, b + G.day % 97) - 0.5) * 2 * e4), 0, 100);
  C.known[c.id] = { loy: nz(40, c.loy), amb: nz(41, c.amb), hon: nz(42, c.hon), err: e4, day: G.day, how: 'пташки' };
  const S = C.secrets.filter(s => !s.known && s.who.includes(c.id)); if (S.length && R.chance(clamp(0.35 + intr / 40, 0.35, 0.9))) { for (const s of S) { s.known = 1; s.how = 'пташки Ока'; letterFromSeat('eye', 'Тайное донесение', secretText(s)); } log('Око короля: пташки раскрыли тайну — ' + secretText(S[0]), 'warn'); } }
// ---------- hidden motives at work, day by day ----------
function motivesDaily() { const C = G.court, war = warsOf(0).length > 0, fam = famIds();
  for (const c of G.chars) { if (!c.alive || c.realm !== 0 || c.age < 16 || c.prison >= 0 || fam.has(c.id)) continue; const on = !!seatOf(c); if (!(c.atCourt || on || c.role === 'lord' || c.role === 'knight')) continue;
    const m = motiveOf(c); let d = 0;
    if (m.k === 'crown') d = (c.loy || 50) < 80 ? 0.02 : 0; else if (m.k === 'power') d = on ? 0.01 : c.atCourt ? -0.03 : 0; else if (m.k === 'glory') d = war ? 0.03 : -0.005;
    else if (m.k === 'house') { const H0 = G.houses[c.house]; if (H0) d = (H0.loy - (c.loy || 50)) * 0.01; } else if (m.k === 'revenge') d = -0.02; else if (m.k === 'faith') d = (C.prayDay || -99) > G.day - 7 ? 0.02 : 0; else if (m.k === 'gold') d = G.realms[0].gold < 100 ? -0.02 : 0;
    if (d) c.loy = clamp((c.loy || 50) + d, m.k === 'revenge' ? 5 : m.k === 'glory' ? 40 : 0, m.k === 'revenge' ? 60 : 100);
    if (m.k === 'revenge' && c.loy < 30 && c.house >= 0 && G.houses[c.house] && R.chance(0.003)) { const foe = [1, 2, 3, 4].filter(t => alive(t)).sort((a, b) => opinionOf(a, 0) - opinionOf(b, 0))[0]; if (foe) addSecret('plot', [c.id], { house: c.house, realm: foe }); } }
  // a spy at court betrays our informants abroad, season by season
  if (G.day % DAYS_SEASON === 11) for (const s of C.secrets) { if (s.k !== 'spy' || s.known || !(s.who[0] >= 0)) continue; const c = charOf(s.who[0]); if (!c || !c.alive || c.prison >= 0) continue; const t = s.realm;
    if ((C.net[t] || 0) > 0) { C.net[t]--; if (seatChar('eye')) addReport('eye', 'В державе ' + realmName(t) + ' схватили наших осведомителей: сеть теперь ' + C.net[t] + ' из 3. Кто-то их выдал — боюсь, этот кто-то при нашем дворе.'); } } }
DAILY_EXT.push(birdsDaily);
// a spy on the council does his work badly on purpose; the treasurer who serves for gold steals as if greedy
{ const oe = orderEff; orderEff = function (c, seatK, mode) { const e = oe(c, seatK, mode); return isHiddenSpy(c) ? e * 0.75 : e; }; }
{ const td = treasurerDaily; treasurerDaily = function () { const c = seatChar('treasurer'); if (c && c.motive && c.motive.k === 'gold' && !c.traits.includes('greedy')) { c.traits.push('greedy'); try { td(); } finally { c.traits.pop(); } } else td(); }; }
{ const ap = appointSeat; appointSeat = function (k, id) { const c = charOf(id); if (c) birdRec(c); const was = c && c.seat; ap(k, id); if (c && !was && motiveOf(c).k === 'power') c.loy = clamp((c.loy || 50) + 6, 0, 100); }; }
{ const ds = dismissSeat; dismissSeat = function (k, why) { const c = charOf(G.court.seats[k]); ds(k, why); if (c && c.motive && c.motive.k === 'power') c.loy = clamp((c.loy || 50) - 10, 0, 100); }; }
// ---------- the petitioner who asks for a place at court: a first impression, and now and then a spy ----------
const SKC = { mar: 'Я владею мечом и знаю, как водить людей в бой.', dip: 'Я умею говорить с людьми — и с послами тоже.', intr: 'Я умею слушать и примечать то, что другие прячут.', stew: 'Я умею считать деньги и вести хозяйство.', lrn: 'Я знаю грамоту, право и латынь.' };
{ const PY = PETS.find(d => d.k === 'young');
  PY.mk = () => { const H = G.houses.filter(h => h.alive); if (!H.length) return null; const h = R.pick(H), foes = [1, 2, 3, 4].filter(t => alive(t)).sort((a, b) => opinionOf(a, 0) - opinionOf(b, 0));
    const spy = foes.length && R.chance(0.14) ? foes[R.i(0, Math.min(1, foes.length - 1))] : 0, c = mkHouseMember(h, R.chance(0.3) ? 1 : 0, R.i(17, 24)); c.atCourt = 0;
    if (spy) { c.intr = Math.max(c.intr || 0, R.i(12, 17)); c.claim = R.pick(['stew', 'lrn', 'dip']); c.motive = { k: 'foe', realm: spy, cover: R.pick(['gold', 'power', 'lore']) }; c.hon = Math.min(c.hon || 50, 40); }
    else c.claim = bestSkill(c);
    birdsOf()[c.id] = { lv: 0, p: 0, err: 2, d0: G.day };
    return { h: h.id, c: c.id, spy, text: 'Я ' + c.name + ' из дома ' + h.name + '. Прошу места при вашем дворе, государь. ' + SKC[c.claim] }; };
  PY.ch = p => { const c = charOf(p.c); return [{ t: 'Принять ко двору', good: 2, tip: c ? impTip(c, p) : null, fx: () => { if (!c) return; c.atCourt = 1; houseLoy(G.houses[p.h], 4); log(c.name + ' ' + (c.fem ? 'принята' : 'принят') + ' ко двору.', 'good'); birdRec(c).nw = 1;
      if (p.spy) addSecret('spy', [c.id], { realm: p.spy, pet: 1 }); } }, { t: 'Отказать', good: 0, fx: () => { houseLoy(G.houses[p.h], -2); } }]; }; }
function impLine(c) { return SKL.map(k => SKN[k] + ' ' + skSeen(c, k).s).join(' · '); }
function natureLine(c) { const t = traitsSeen(c); return t.all ? t.s.toLowerCase() : (c.traits[0] && TRAITS[c.traits[0]] ? TRAITS[c.traits[0]].n.toLowerCase() + ', а дальше не разглядеть' : 'не разглядеть'); }
function eyeSus(p) { if (p.sus === undefined) { const e = seatChar('eye'); p.sus = e ? (p.spy ? (R.chance(clamp(skillOf(e, 'intr') / 22, 0.15, 0.8)) ? 1 : 0) : (R.chance(0.06) ? 1 : 0)) : 0; } return p.sus; }
function impTip(c, p) { return ['Первое впечатление', 'На глаз: ' + impLine(c) + '.', 'Нрав: ' + natureLine(c) + '.', eyeSus(p) ? { t: 'Око короля хмурится: «Не верю я ему, государь».', c: UIC.warn } : null, { t: seatChar('eye') ? 'Примете ко двору — пташки Ока присмотрятся к нему.' : 'Без Ока короля никто к нему не присмотрится.', c: UIC.dim }].filter(Boolean); }
{ const pd = petitionDialog; petitionDialog = function (n) { const p = n && n.petition, c = p && p.k === 'young' ? charOf(p.c) : null; if (!c) return pd(n); const t0 = p.text;
  p.text = [t0, '(Вы присматриваетесь. На глаз: ' + impLine(c) + '. Нрав: ' + natureLine(c) + '.' + (eyeSus(p) ? ' Око короля хмурится и качает головой.' : '') + ')']; try { pd(n); } finally { p.text = t0; } }; }
// a wise judge sees through a spy more often than not
{ const jr = judgeResolve; judgeResolve = function (p) { const j = seatChar('justice'); if (p && p.k === 'young' && p.spy && j && R.chance(clamp(j.lrn / 25, 0.2, 0.8))) { houseLoy(G.houses[p.h], -2); p.done = 1; noteVerdict(p, { t: 'Отказать', good: 2 }, [{ good: 2 }], 'judge', j); return 'Отказать'; } return jr(p); }; }
// ---------- the council window: what is seen, not what is true ----------
skillsLine = function (c, x, y, main) { let xx = x; for (const k of SKL) { const z = skSeen(c, k), s = SKN[k] + ' ' + z.s; txt(s, xx, y, k === main ? PAL.y : z.kn ? skCol(z.v) : '#c8b898', { f: 's' });
  hit(xx, y - 1, tw(s, { f: 's' }), 9, { id: 'sk' + k + x + y, tip: [SKN[k] + ' — ' + SKD[k], z.kn === 2 || z.ex ? 'Известно точно.' : z.kn ? 'Оценка пташек Ока: ±' + (birdRec(c).err || 0) + '.' : 'Первое впечатление — может обмануть. Пташки Ока уточнят.'] }); xx += tw(s, { f: 's' }) + 8; } };
candidatesFor = function (k) { const sk = seatDef(k).sk; return G.chars.filter(c => c.alive && c.prison < 0 && c.realm === 0 && (c.role === 'courtier' || c.role === 'council' || c.role === 'knight' || c.role === 'lord' || c.role === 'scholar') && c.age >= 16 && (c.atCourt || c.role === 'lord') && !c.withKing && c.id !== G.player.char && !armyOfGen(c.id))
  .sort((a, b) => skSeen(b, sk).v - skSeen(a, sk).v); };
drawCandidates = function (w, x0, y, wR, s) { const L = candidatesFor(s.k), cur = seatChar(s.k);
  txt('Кандидаты (по навыку «' + SKN[s.sk] + '», как он вам известен):', x0, y, PAL.y); if (w.app && cur) sbtn('c_back2', x0 + wR - 60, y - 2, 60, 'Назад', () => { w.app = 0; }); y += 13;
  if (!L.length) { para('Подходящих людей при дворе нет. Новые придворные приезжают просить места на приёмах у трона.', x0, y, wR, UIC.dim, { f: 's', lh: 9 }); return; }
  const sc = wheelScroll(w, L.length - 7);
  L.slice(sc, sc + 7).forEach((c, i) => { const yy = y + i * 30, z = skSeen(c, s.sk), r = birdFull(c) ? null : birdRec(c); rect(x0, yy, wR, 28, i % 2 ? P3.row : P3.row2); drawPortrait(c, x0 + 2, yy + 2, 0.5);
    txt(fitS(charName(c), wR - 140), x0 + 30, yy + 3, PAL.w, { f: 's' }); txt(fitS((c.house >= 0 ? 'дом ' + houseName(c.house) : 'без дома') + ' · ' + yrs(c.age) + ' · ' + traitsSeen(c).s, wR - 140), x0 + 30, yy + 13, P3.lab, { f: 's' });
    txt(SKN[s.sk] + ' ' + z.s, x0 + wR - 96, yy + 9, z.kn ? skCol(z.v) : '#c8b898'); const other = c.seat ? 'сейчас: ' + seatName(c.seat) : c.role === 'lord' ? 'глава дома' : r ? 'пташки: ' + r.lv + ' из 6' : '';
    if (other) txt(other, x0 + wR - 96, yy + 19, UIC.dim, { f: 's' });
    btn('c_ap' + c.id, x0 + wR - 40, yy + 7, 38, 13, { label: 'Да', tip: ['Назначить ' + c.name + ' на место «' + s.n + '»', { t: 'Его дом будет польщён.', c: UIC.dim }], onClick: () => { appointSeat(s.k, c.id); w.app = 0; } });
    hit(x0, yy, wR - 42, 28, { id: 'row_cand' + c.id, tip: [charName(c), 'Нрав: ' + traitsSeen(c).s, z.kn ? 'Навык известен' + (z.ex ? ' точно.' : ' примерно.') : 'Навык — на глаз: пташки Ока ещё не донесли.'] }); }); };
// ---------- Малый совет → «Кандидаты»: everyone who could sit at the table — as the king knows them ----------
function candAll(f) { const fam = famIds(); return G.chars.filter(c => c.alive && c.prison < 0 && c.realm === 0 && c.age >= 16 && !fam.has(c.id) && (c.role === 'courtier' || c.role === 'council' || c.role === 'knight' || c.role === 'lord' || c.role === 'scholar') && (c.atCourt || c.role === 'lord' || seatOf(c)))
  .filter(c => f === 'council' ? !!seatOf(c) : f === 'court' ? c.atCourt && !seatOf(c) : f === 'lords' ? c.role === 'lord' && !seatOf(c) : true); }
const candRank = c => seatOf(c) ? 0 : c.atCourt ? 1 : 2;
function birdErr(e) { return e ? clamp(Math.round((21 - skillOf(e, 'intr')) / 5), 0, 4) : 0; }
function birdTip(e) { return ['Пташки Ока', 'Невидимые агенты Ока короля сами следят за советниками и за всеми, кто ищет места при дворе.', 'Сведения приходят по порядку: главный навык → все навыки → нрав → верность и честь → тайный мотив → тайны.',
  e ? { t: 'Око ' + e.name + ' (Тень ' + skillOf(e, 'intr') + ') держит под присмотром до ' + birdWidth(e) + ' человек разом; точность оценок ±' + birdErr(e) + '. Чем выше Тень, тем быстрее и точнее.', c: '#a8c8ff' } : { t: 'Ока короля нет — никто не следит.', c: UIC.bad },
  { t: 'Поручение «Охранять двор» ускоряет пташек; досье даёт верность и честь сразу.', c: UIC.dim }]; }
function birdDots(c, r, x, y) { const on = (G.court.birdOn || []).includes(c.id); if (birdFull(c)) { txt('семья', x, y - 1, UIC.dim, { f: 's' }); return; }
  for (let i = 0; i < 6; i++) { const f = r.lv > i, nx = r.lv === i && on; rect(x + i * 5, y, 4, 4, f ? '#a8c8ff' : nx ? '#4a6a90' : '#2a2030'); if (nx) rect(x + i * 5, y + 3, Math.max(1, Math.round(4 * clamp((r.p || 0) / BIRD_NEED[i + 1], 0, 1))), 1, '#e8f0ff'); } }
function drawCandTab(w, X, Y, WW, HH) { const C = G.court, e = seatChar('eye'); w.cf = w.cf || 'all'; let y = Y + 41;
  [['all', 'Все', 'Все кандидаты'], ['court', 'Двор', 'При дворе, но не в совете'], ['council', 'Совет', 'Члены Малого совета'], ['lords', 'Дома', 'Главы знатных домов — живут в своих замках']].forEach(([k, n, tp], i) => btn('cf_' + k, X + 12 + i * 48, y, 46, 12, { label: n, tip: tp, style: w.cf === k ? 'wood' : 'dark', active: w.cf === k, onClick: () => { w.cf = k; w.sc = 0; } }));
  const LW = 392, lx = X + 10, cx0 = lx + 200, cw = 30;
  SKL.forEach((k, i) => btn('cs_' + k, cx0 + i * cw, y, cw - 2, 12, { label: SKN[k], style: w.cs === k ? 'wood' : 'dark', active: w.cs === k, tip: ['Упорядочить по навыку «' + SKN[k] + '» — ' + SKD[k], { t: 'Как он вам известен: точно, по оценке пташек (≈) или на глаз (диапазон).', c: UIC.dim }], onClick: () => { w.cs = w.cs === k ? null : k; } }));
  spr('i_bird', cx0 + 5 * cw + 4, y + 3); txt('Пташки', cx0 + 5 * cw + 12, y + 2, P3.lab, { f: 's' }); hit(cx0 + 5 * cw + 2, y, 46, 12, { id: 'cs_bird', tip: birdTip(e) });
  y += 16; const sk = w.cs, L = candAll(w.cf).sort((a, b) => sk ? skSeen(b, sk).v - skSeen(a, sk).v : candRank(a) - candRank(b) || a.name.localeCompare(b.name));
  const rows = Math.floor((Y + HH - 10 - y) / 26), sc = wheelScroll(w, L.length - rows); if (!L.some(c => c.id === w.sel)) { w.sel = L.length ? L[0].id : -1; w.as = 0; }
  if (!L.length) para('Никого. Новые люди приезжают просить места на приёмах у трона.', lx + 4, y + 4, LW - 8, UIC.dim, { f: 's', lh: 9 });
  L.slice(sc, sc + rows).forEach((c, i) => { const yy = y + i * 26, sel = w.sel === c.id, st = seatOf(c), r = birdRec(c); rect(lx, yy, LW, 25, sel ? P3.sel : i % 2 ? P3.row : P3.row2); if (sel) strokeR(lx, yy, LW, 25, '#c9a060');
    drawPortrait(c, lx + 1, yy + 1, 0.5); let nx = lx + 29; if (st) { spr(seatDef(st).ic, nx, yy + 3); nx += 10; } txt(fitS(charName(c), 196 - (nx - lx) - 4), nx, yy + 3, st ? PAL.y : PAL.w, { f: 's' });
    const sub = (st ? seatName(st) : c.role === 'lord' ? 'глава дома' : c.role === 'knight' ? 'рыцарь' : c.role === 'scholar' ? 'учёный' : 'при дворе') + ' · ' + (c.house >= 0 ? houseName(c.house) : 'без дома') + ' · ' + yrs(c.age);
    txt(fitS(sub, 166), lx + 29, yy + 13, P3.lab, { f: 's' }); if (isHiddenSpy(c) === false && spyKnown(c)) txt('шпион', lx + 196, yy + 13, UIC.bad, { al: 'r', f: 's' });
    SKL.forEach((k, j) => { const z = skSeen(c, k); txt(z.s, cx0 + j * cw + cw / 2 - 1, yy + 8, z.kn ? (k === sk ? PAL.y : skCol(z.v)) : '#a89878', { al: 'c', f: 's' }); });
    birdDots(c, r, cx0 + 5 * cw + 6, yy + 10);
    hit(lx, yy, LW, 25, { id: 'row_cd' + c.id, cursor: true, onClick: () => { w.sel = c.id; w.as = 0; } }); });
  if (L.length > rows) txt((sc + 1) + '–' + Math.min(L.length, sc + rows) + ' из ' + L.length + ' · колесо листает', lx + LW, Y + HH - 9, UIC.dim, { al: 'r', f: 's' });
  // details of the chosen one
  const c = charOf(w.sel); if (!c) return; const rx = X + 410, RW = WW - 422, r = birdRec(c), st = seatOf(c); let ry = Y + 41;
  drawPortrait(c, rx, ry, 1); strokeR(rx - 1, ry - 1, 50, 50, '#c9a060');
  txt(fitS(charName(c), RW - 54), rx + 54, ry, PAL.w, { f: 's' }); txt(fitS((c.house >= 0 ? 'дом ' + houseName(c.house) + ' · ' : '') + yrs(c.age), RW - 54), rx + 54, ry + 10, P3.lab, { f: 's' });
  txt(fitS(st ? seatName(st) : c.withKing ? 'в свите короля' : armyOfGen(c.id) ? 'командует войском' : c.atCourt ? 'при дворе' : 'в своём замке', RW - 54), rx + 54, ry + 20, st ? PAL.y : P3.lab, { f: 's' });
  const on = (C.birdOn || []).includes(c.id); spr('i_bird', rx + 54, ry + 32); txt(r.lv >= 6 ? 'пташки знают всё' : 'пташки: ' + r.lv + ' из 6' + (on ? '' : ' · ждёт'), rx + 64, ry + 31, on ? '#a8c8ff' : PAL.w, { f: 's' });
  if (r.lv < 6) bar(rx + 54, ry + 41, RW - 56, 5, (r.p || 0) / BIRD_NEED[r.lv + 1], on ? '#a8c8ff' : '#5a6a80');
  hit(rx + 52, ry + 29, RW - 52, 18, { id: 'cd_bird', tip: e && e.id === c.id ? ['Око короля', 'За самим Оком пташки не следят — это его люди.'] : ['Пташки: ' + (r.lv >= 6 ? 'всё, что можно, уже узнано' : 'узнано ' + r.lv + ' из 6 — ' + BIRD_LV[r.lv]), r.lv < 6 ? 'Дальше: ' + BIRD_LV[r.lv + 1] + '.' : 'Советников пташки проверяют и дальше.', on ? { t: 'Сейчас за ним следят.', c: '#a8c8ff' } : { t: e ? 'Сейчас пташки заняты другими — очередь дойдёт.' : 'Ока нет — никто не следит.', c: UIC.dim }] });
  ry += 54; const lab = (s, yy) => txt(s, rx, yy, PAL.y, { f: 's' });
  lab('Навыки', ry); SKL.forEach((k, i) => { const z = skSeen(c, k), s = SKN[k] + ' ' + z.s, xx = rx + (i % 3) * 64, yy = ry + 10 + Math.floor(i / 3) * 10; txt(s, xx, yy, z.kn ? skCol(z.v) : '#a89878', { f: 's' });
    hit(xx - 1, yy - 1, 62, 10, { id: 'cd_sk' + k, tip: [SKN[k] + ' — ' + SKD[k], z.kn === 2 || z.ex ? 'Известно точно.' : z.kn ? 'Оценка пташек: ±' + (r.err || 0) + '.' : 'На глаз — может обмануть: многие хвалятся.'] }); }); ry += 32;
  const ts = traitsSeen(c); lab('Нрав', ry); ry += 10; ry += para(ts.s + (ts.all ? '' : ' (пташки донесут больше)'), rx, ry, RW, '#e8c890', { f: 's', lh: 9 }) + 3;
  const ls = loySeen(c); lab('Верность', ry); txt(fitS(ls.s, RW - 52), rx + 52, ry, ls.v < 35 ? UIC.bad : ls.v > 65 ? UIC.good : PAL.w, { f: 's' }); ry += 12;
  const mo = motiveSeen(c); lab('Мотив', ry); if (mo) { txt(mo.n, rx + 52, ry, mo === MOTIVES.revenge || mo === MOTIVES.foe ? UIC.bad : '#e8dcc0', { f: 's' }); ry += 10; ry += para(mo.d, rx, ry, RW, P3.lab, { f: 's', lh: 9 }) + 3; } else { txt(birdFull(c) ? '—' : 'скрыт', rx + 52, ry, UIC.dim, { f: 's' }); ry += 12; }
  const S = C.secrets.filter(s => s.known && s.who.includes(c.id)); lab('Тайны', ry); if (S.length) { ry += 10; for (const s of S.slice(0, 2)) ry += para(secretText(s), rx, ry, RW, UIC.bad, { f: 's', lh: 9 }) + 2; } else { txt(r.lv >= 6 ? 'не найдено' : 'неизвестно', rx + 52, ry, UIC.dim, { f: 's' }); ry += 12; }
  // actions
  const by = Y + HH - 22, sp = spySecret(c);
  if (sp && sp.known && !sp.fed) { sbtn('cd_grab', rx, by - 16, RW, 'Схватить шпиона', () => { const k = seatOf(c); if (k) dismissSeat(k, 'шпион'); c.prison = 0; c.atCourt = 0; sp.done = 1; C_dropSecret(sp); prestige(2); if (c.house >= 0 && G.houses[c.house]) houseLoy(G.houses[c.house], -4); log('Шпион державы ' + realmName(sp.realm) + ' ' + c.name + ' схвачен' + (c.fem ? 'а' : '') + '.', 'good'); w.sel = -1; }, { tip: ['В темницу', 'Шпион больше не навредит; его дом смущён.'] });
    sbtn('cd_feed', rx, by, RW, 'Кормить его ложью', () => { sp.fed = 1; G.realms[sp.realm].misled = G.day + 90; log('Шпиону державы ' + realmName(sp.realm) + ' подсовывают ложные донесения.', 'good'); }, { tip: ['Двойная игра (гл. 13)', 'Враг будет считать нас сильнее, чем мы есть, а наших осведомителей шпион больше не выдаст.'] }); return; }
  if (w.as) { const free = !c.withKing && !armyOfGen(c.id); SEATS.forEach((s, i) => btn('cd_s' + s.k, rx + (i % 2) * (RW / 2 + 1), by - 48 + Math.floor(i / 2) * 14, RW / 2 - 1, 12, { label: s.n, style: C.seats[s.k] === c.id ? 'wood' : 'dark', disabled: !free || C.seats[s.k] === c.id,
      tip: [s.n + ': ' + SKN[s.sk] + ' ' + skSeen(c, s.sk).s, seatChar(s.k) ? 'Сейчас: ' + seatChar(s.k).name + ' (' + SKN[s.sk] + ' ' + skSeen(seatChar(s.k), s.sk).s + ') — будет снят и обидится.' : 'Место пустует.'], onClick: () => { appointSeat(s.k, c.id); w.as = 0; } }));
    sbtn('cd_back', rx + RW / 2 + 1, by - 48 + 3 * 14, RW / 2 - 1, 'Назад', () => { w.as = 0; }); return; }
  sbtn('cd_app', rx, by, RW / 2 - 1, 'Назначить…', () => { w.as = 1; }, { disabled: !!(c.withKing || armyOfGen(c.id)), tip: c.withKing || armyOfGen(c.id) ? 'Он сейчас в походе.' : 'Выбрать место в совете' });
  sbtn('cd_dos', rx + RW / 2 + 1, by, RW / 2 - 1, 'Досье (10 зол.)', () => { if (giveOrder('eye', 'dossier', 'intent', c.id)) UI.toast('Око собирает досье на ' + c.name + '.'); }, { disabled: !e, tip: e ? ['Поручить Оку досье', 'За 6 дней — верность, честолюбие и честность; иногда и тайны.'] : 'Ока нет' }); }
// the Eye's own window: how many are under the birds' watch
{ const de = drawEyeWin; drawEyeWin = function (w) { de(w); const C = G.court, e = seatChar('eye'), X = 14, Y = 21, WW = 612; if (!e) return; const n = (C.birdOn || []).length, s = 'Пташки следят за ' + n + ' из ' + (C.birdAll || n);
  spr('i_bird', X + WW - 24 - tw(s, { f: 's' }), Y + 23); txt(s, X + WW - 16, Y + 22, '#a8c8ff', { al: 'r', f: 's' }); hit(X + WW - 30 - tw(s, { f: 's' }), Y + 20, tw(s, { f: 's' }) + 16, 11, { id: 'ey_birds', tip: birdTip(e).concat([{ t: 'Подробно — Малый совет → «Кандидаты».', c: UIC.dim }]) }); }; }
REFS.push({ s: 'Пташки', t: 'Пташки Ока и кандидаты', b: () => 'Кого вы видите при дворе, вы знаете не до конца. Новичок, просящий места, показывает лишь первое впечатление: навыки — диапазоном «на глаз», нрав — отчасти. Многие хвалятся.\n' +
  'Пташки — невидимые агенты Ока короля. Они сами следят за советниками и кандидатами, по нескольку человек разом. Сведения приходят по порядку: главный навык, все навыки, нрав, верность и честь, тайный мотив и, наконец, тайны. Скорость и точность зависят от Тени Ока; без Ока никто не следит.\n' +
  'У каждого придворного есть скрытый мотив: верность короне, золото, власть, слава, знание, свой дом, вера — или месть. Мотив понемногу меняет верность: жаждущий власти злится без места в совете, ищущий славы скучает в мир, мститель опасен.\n' +
  'Изредка под видом просителя приходит шпион чужой державы. Принятый ко двору, он раз в сезон выдаёт наших осведомителей, а в совете работает спустя рукава. Пташки, досье, следствие судьи или ночной разговор в саду могут его раскрыть — и тогда его можно схватить или кормить ложью.\n' +
  'Все кандидаты собраны в Малом совете на вкладке «Кандидаты».' });
