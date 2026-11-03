'use strict';
// ===== REIGN (v3.5): the life of one king. The chronicle writes down his deeds; at his death the chapter closes with the name
// the chronicle gives him, and the heir begins a story of his own — in a later age, with newer learning =====
Object.assign(ICONS, { chron: '.CC.CC.|CjjCjjC|CCCCCCC|CjjCjjC|CCCCCCC|BBBBBBB', cross: '..x..|xxxxx|..x..|..x..|..x..', antler: 'n...n|nn.nn|.nNn.|..N..|..N..',
  cup: 'yyyyy|.yYy.|..y..|..y..|.yyy.', ring: '..l..|.y.y.|y...y|y...y|.yyy.' });
// ---------- ages of learning: the longer the reign, the further the age ----------
const ERAS = [{ n: 'Раннее Средневековье', y: 1, s: 'I' }, { n: 'Высокое Средневековье', y: 4, s: 'II' }, { n: 'Позднее Средневековье', y: 8, s: 'III' }];
function eraOf(d) { let e = 0; for (let i = 0; i < ERAS.length; i++) if (yearOf(d) >= ERAS[i].y) e = i; return e; }
const eraNow = () => eraOf(G ? G.day : 0), eraDays = e => Math.max(0, (ERAS[e].y - 1) * DAYS_YEAR - G.day);
Object.assign(TECH, {
  guilds: { b: 0, n: 'Цехи', d: 'Ремесленники объединяются в цехи: товар лучше, города богаче. Доход +6%.', cost: 44, req: 'fairs', era: 1 },
  banks: { b: 0, n: 'Векселя', d: 'Купцы платят бумагой, а не мешками серебра. Доход +8%.', cost: 56, req: 'guilds', era: 2 },
  plate: { b: 1, n: 'Латы', d: 'Кованые латы: латники и рыцари короны стойче в рукопашной (≈+12%).', cost: 44, req: 'engines', era: 1 },
  bombards: { b: 1, n: 'Бомбарды', d: 'Первые пушки: каменные ядра рушат стены — осада идёт на 60% быстрее.', cost: 56, req: 'plate', era: 2 },
  surgery: { b: 2, n: 'Хирургия', d: 'Лекари шьют раны и вправляют кости: раны короля заживают на треть быстрее, больные в войске встают на ноги быстрее.', cost: 44, req: 'antidotes', era: 1 },
  printing: { b: 2, n: 'Книгопечатание', d: 'Печатный станок: книги дешевле — магистр учится на 25% быстрее.', cost: 56, req: 'surgery', era: 2 },
  estates: { b: 3, n: 'Сословный совет', d: 'Знать, духовенство и города заседают вместе: смута спадает, знатные дома раз в сезон вернее короне.', cost: 44, req: 'townhalls', era: 1 },
  standing: { b: 3, n: 'Жалованье войску', d: 'Ополчению платят: служит 60 дней вместо 40, продление вдвое дешевле.', cost: 56, req: 'estates', era: 2 } });
const TECH_SD = { rotation: 'Доход +8% · зерно +2', ledgers: 'Доход +4% · видна недостача', mills: 'Доход +6% · зерно +4', fairs: 'Доход городов +10% · слава',
  drill: 'Учения: опыт ×2', mail: 'Рукопашная ≈+8%', crossbow: 'Стрелки метче на 15%', engines: 'Осада на 40% быстрее', ciphers: 'Шпионам труднее', pigeons: 'Вести за полдня',
  informants: 'Сеть Ока растёт сама', antidotes: 'Семья болеет реже', posts: 'Гонцы ×1,6', laws: 'Смута тише · суд лучше', chancery: 'Советники не обижаются', townhalls: 'Доход +6% · смута ниже',
  guilds: 'Доход +6%', banks: 'Доход +8%', plate: 'Латники и рыцари ≈+12%', bombards: 'Осада на 60% быстрее', surgery: 'Раны заживают быстрее', printing: 'Знания +25%', estates: 'Смута ниже · дома вернее', standing: 'Ополчение служит 60 дней' };
{ const ti = techIncK; techIncK = function () { return ti() + (hasTech('guilds') ? 0.06 : 0) + (hasTech('banks') ? 0.08 : 0); }; }
{ const tx = techXp; techXp = function (realm, xp) { const o = tx(realm, xp); if (realm !== 0 || !G.tech || !hasTech('plate') || o === xp) return o; o.sword = (o.sword || 0) + 24; o.knight = (o.knight || 0) + 24; return o; }; }
{ const wk = woundKing; woundKing = function (sev, part, by) { const d = wk(sev, part, by); RST().hurt++; if (sev >= 2) chron('Король ранен' + (by === 'турнир' ? ' на турнире' : by === 'кабан' ? ' кабаном' : by === 'медведь' ? ' медведем' : '') + ': ' + part + '.', 'wound', 'hurt', 2);
  if (!hasTech('surgery')) return d; const cut = Math.floor(d / 3); kingC().wound -= cut; return d - cut; }; }
// ---------- the chronicle ----------
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const STYPE = { capital: ['столица', 'Взята столица', 'Пала столица'], castle: ['замок', 'Взят замок', 'Пал замок'], town: ['город', 'Взят город', 'Пал город'], village: ['деревня', 'Взята деревня', 'Пала деревня'] };
function reignInit(force) { if (!G || !G.court) return null; if (G.reign && !force) return G.reign; const k = kingC(), first = !(G.reigns && G.reigns.length);
  G.reigns = G.reigns || []; G.reign = { n: G.reigns.length + 1, king: k.id, from: first ? 0 : G.day, age0: k.age, era0: eraNow(), lands0: landsN(), chron: [], goal: null,
    st: { wars: 0, peace: 0, won: 0, lost: 0, took: 0, fell: 0, vil: 0, techs: 0, kids: 0, hunts: 0, tours: 0, feasts: 0, hurt: 0 } };
  const cap = WD.setts[G.realms[0].capital]; chron((first ? 'Год 1. ' : 'Глава ' + ROMAN[G.reign.n - 1] + '. ') + rTitle(k) + ' ' + k.name + ' (' + yrs(k.age) + ') ' + (first ? 'правит из столицы ' + (cap ? cap.name : '') : 'взошёл на трон') + '.', 'crown', 'start', 3);
  return G.reign; }
const RST = () => (reignInit() || { st: {} }).st, rTitle = k => k.fem ? 'Королева' : 'Король', landsN = () => G.setts.filter(S => S.owner === 0 && WD.setts[S.id].type !== 'village').length;
function chron(t, ic, k, imp) { const R0 = reignInit(); if (!R0) return; R0.chron.push({ d: G.day, t, ic: ic || 'scroll', k: k || '', imp: imp || 1 }); if (R0.chron.length > 240) R0.chron.splice(1, 1); }
function placeNear(tile) { const x = tile % MW, y = (tile / MW) | 0; let b = null, bd = 1e9; for (const s of WD.setts) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; b = s; } } return b; }
const placeName = s => s ? (s.type === 'village' ? 'деревни ' : s.type === 'town' ? 'города ' : 'замка ') + s.name : '';
const shortDate = d => SEASONS[seasonOf(d)].toLowerCase() + ' ' + yearOf(d) + ' г.';
// the deeds, written down where they happen
{ const dw = declareWar; declareWar = function (r, t, o) { const p = G.player.realm, was = r !== t && G.rel[r] && G.rel[r][t] && G.rel[r][t].war, res = dw(r, t, o);
  if (!was && r !== t && G.rel[r][t].war && (r === p || t === p)) { const e = r === p ? t : r; RST().wars++; chron('Война: ' + realmName(e) + (r === p ? ' — объявили мы.' : ' — объявили нам.'), 'sword', 'war', 2); } return res; }; }
{ const mp = makePeace; makePeace = function (win, lose, cede, gold) { const p = G.player.realm, was = G.rel[win] && G.rel[win][lose] && G.rel[win][lose].war, n0 = landsN(), res = mp(win, lose, cede, gold);
  if (was && !G.rel[win][lose].war && (win === p || lose === p)) { const e = win === p ? lose : win, dn = landsN() - n0; RST().peace++;
    chron('Мир: ' + realmName(e) + (win === p ? ' — на наших условиях' : ' — на их условиях') + (dn > 0 ? ', крепостей +' + dn : dn < 0 ? ', крепостей ' + dn : '') + '.', 'seal', 'peace', 2); } return res; }; }
{ const ab = applyBattle; applyBattle = function (B) { const res = ab(B); try { const p = G.player.realm, s0 = B.sides.findIndex(s => s.realm === p); if (s0 < 0 || B.sides[1 - s0].realm === p) return res;
    const S = B.sides[s0], E = B.sides[1 - s0], won = res.win === s0, m0 = menOf(S.u), m1 = menOf(E.u), foe = E.realm >= 0 && E.realm < 5 ? realmName(E.realm) : E.name, st = RST();
    if (won) st.won++; else st.lost++; if (m0 + m1 < 60 && !S.king) return res;
    const pl = B.o && B.o.sett !== undefined && WD.setts[B.o.sett] ? WD.setts[B.o.sett] : placeNear(B.tile);
    chron((won ? 'Победа' : 'Поражение') + ' близ ' + placeName(pl) + ': ' + foe + ' (' + fmt(m0) + ' против ' + fmt(m1) + ')' + (S.king ? ' — король сам вёл войско.' : '.'), won ? 'sword' : 'flag', won ? 'won' : 'lost', S.king || m0 + m1 >= 600 ? 3 : 2); } catch (e) { console.warn(e); } return res; }; }
{ const cs = captureSett; captureSett = function (a, S, how) { const prev = S.ctrl, own = S.owner, res = cs(a, S, how), p = G.player.realm, ws = WD.setts[S.id], T0 = STYPE[ws.type] || STYPE.castle, st = RST();
  if (a.realm === p && prev !== p) { if (ws.type === 'village') st.vil++; else { st.took++; chron(T0[1] + ' ' + ws.name + (own !== p && own >= 0 && own < 5 ? ' (' + realmName(own) + ')' : '') + '.', 'castle', 'took', ws.type === 'capital' ? 3 : 2); } }
  else if (prev === p && a.realm !== p && ws.type !== 'village') { st.fell++; chron(T0[2] + ' ' + ws.name + ' — взял' + (a.realm >= 0 && a.realm < 5 ? 'и: ' + realmName(a.realm) : 'и враги') + '.', 'flag', 'fell', ws.type === 'capital' ? 3 : 2); }
  return res; }; }
{ const ta2 = techApply; techApply = function (k) { ta2(k); RST().techs++; chron('Изучено: «' + TECH[k].n + '».', 'flask', 'tech', 1); }; }
{ const bi = birth; birth = function (king, sp, mom) { const n0 = (king.kids || []).length; bi(king, sp, mom); const L = king.kids || []; if (L.length > n0) { const c = charOf(L[L.length - 1]); if (c) { RST().kids++; chron((c.fem ? 'Родилась принцесса ' : 'Родился принц ') + c.name + '.', 'family', 'birth', 2); } } }; }
{ const ma = marry; marry = function (c, p) { const k = kingC(), fam = x => x && (x.id === k.id || x.blood); const r = ma(c, p); if (fam(c) || fam(p)) chron('Свадьба: ' + c.name + ' и ' + p.name + '.', 'ring', 'wed', 2); return r; }; }
{ const ca = comeOfAge; comeOfAge = function (c) { ca(c); if (c.blood && c.alive) chron((c.fem ? 'Принцесса ' : 'Принц ') + c.name + ' достиг' + (c.fem ? 'ла' : '') + ' совершеннолетия.', 'crown', 'age', 1); }; }
{ const cd = charDies; charDies = function (c, why) { if (!c.alive) return; c.deathWhy = why; const k = kingC(), fam = c.id !== k.id && (c.id === k.spouse || (k.kids || []).includes(c.id) || c.dowager);
  if (fam) chron('✝ ' + charName(c) + ' — ' + why + '.', 'cross', 'death', 2); return cd(c, why); }; }
{ const hs = huntSummary; huntSummary = function (HU, why) { const L = []; for (const b of HU.bag || []) { if (b.hart) L.push('белый олень'); else if (b.k === 'bear') L.push('медведь'); else if (b.k === 'boar' && b.wt >= 7) L.push('матёрый секач'); else if (b.pts >= 10) L.push('олень-рогач'); }
  if (L.length) { RST().hunts += L.length; chron('Охота: ' + [...new Set(L)].join(', ') + '.', 'antler', 'hunt', 1); } return hs(HU, why); }; }
{ const te = tourEnd; tourEnd = function () { const T = G.court && G.court.tour, was = T && !T.done; te(); if (!was || !T.done) return; RST().tours++; const e = T.ent[T.champ];
  chron('Турнир: ' + (T.king === 'win' ? 'король выиграл свой поединок' : T.king === 'fall' ? 'короля выбили из седла' : 'победил ' + (e ? e.n : '?')) + '.', 'shield', 'tour', 1); }; }
{ const ff = feastFinish; feastFinish = function () { const r = ff.apply(this, arguments), R0 = reignInit(); if (!R0) return r; R0.st.feasts++; const last = R0.chron.slice().reverse().find(x => x.k === 'feast'); if (!last || G.day - last.d > DAYS_SEASON) chron('Пир в большом зале.', 'cup', 'feast', 1); return r; }; }
// ---------- the name the chronicle gives ----------
function epithet(R0, k) { const s = R0.st, f = !!(k && k.fem), yN = Math.floor((G.day - R0.from) / DAYS_YEAR), F = (m, w) => f ? w : m;
  const L = [[s.took >= 3 && s.took > s.fell, F('Завоеватель', 'Завоевательница'), 'взято крепостей: ' + s.took], [s.won >= 4 && s.won >= s.lost * 2, F('Победоносный', 'Победоносная'), 'побед: ' + s.won],
    [s.fell >= 2 && s.fell > s.took, F('Потерявший земли', 'Потерявшая земли'), 'потеряно крепостей: ' + s.fell], [s.lost >= 3 && s.lost > s.won, F('Несчастливый', 'Несчастливая'), 'поражений: ' + s.lost],
    [s.techs >= 5, F('Просвещённый', 'Просвещённая'), 'изучено знаний: ' + s.techs], [s.hunts >= 3, F('Ловчий', 'Ловчая'), 'охотничьих трофеев: ' + s.hunts],
    [s.tours + s.feasts >= 5, F('Щедрый', 'Щедрая'), 'пиров и турниров: ' + (s.tours + s.feasts)], [s.wars === 0 && yN >= 2, F('Миролюбивый', 'Миролюбивая'), 'ни одной войны за ' + yrs(yN)],
    [s.kids >= 3, F('Отец многих', 'Мать многих'), 'детей: ' + s.kids]];
  for (const [ok, n, why] of L) if (ok) return { n, why };
  const tr = ((k && k.traits) || []).map(t => TRAITS[t] && TRAITS[t].n).filter(Boolean)[0]; return tr ? { n: f ? tr.replace(/(ый|ий)$/, 'ая') : tr, why: 'нрав, а не дела: летопись ещё ждёт подвигов' } : { n: F('Тихий', 'Тихая'), why: 'летопись ещё пуста' }; }
function reignLen(d) { const y = Math.floor(d / DAYS_YEAR), r = d % DAYS_YEAR; return (y ? yrs(y) + (r ? ' ' : '') : '') + (r || !y ? r + ' ' + plural(r, 'день', 'дня', 'дней') : ''); }
function reignTop(R0, n) { return R0.chron.map((e, i) => [e, i]).sort((a, b) => (b[0].imp - a[0].imp) || (a[1] - b[1])).slice(0, n).sort((a, b) => a[1] - b[1]).map(x => x[0]); }
function reignArchive(R0, k) { const A = { n: R0.n, name: k.name, fem: k.fem, from: R0.from, to: G.day, age: k.age, why: k.deathWhy || '', ep: epithet(R0, k), st: Object.assign({}, R0.st), top: reignTop(R0, 5), chron: R0.chron.slice(-80) };
  G.reigns = (G.reigns || []).concat([A]); return A; }
// ---------- the heir's own story: what the father left undone ----------
function reignGoal() { const p = G.player.realm, k = kingC(), C = G.court, wars = [1, 2, 3, 4].filter(t => alive(t) && G.rel[p][t].war), lost = (G.reigns || []).flatMap(A => A.chron.filter(e => e.k === 'fell')).length ? G.setts.filter(S => S.owner === p && S.ctrl !== p && WD.setts[S.id].type !== 'village').map(S => S.id) : [];
  if (wars.length) return { k: 'peace', t: 'Окончить войну отца: ' + wars.map(realmName).join(', ') + '.' };
  if (lost.length) return { k: 'regain', ids: lost.slice(0, 3), t: 'Вернуть утраченное: ' + lost.slice(0, 3).map(i => WD.setts[i].name).join(', ') + '.' };
  if (C.regent >= 0 && k.age < 16) return { k: 'age', t: 'Дорасти под опекой регента и взять власть в 16 лет.' };
  const e = eraNow(); if (e > 0) { const L = Object.keys(TECH).filter(x => TECH[x].era === e); return { k: 'tech', era: e, t: 'Новая эпоха: освоить одно из знаний — ' + L.map(x => '«' + TECH[x].n + '»').join(', ') + '.' }; }
  return { k: 'lands', n0: landsN(), t: 'Оставить наследнику больше крепостей, чем досталось (' + landsN() + ').' }; }
function goalDone(g) { const p = G.player.realm; if (!g) return false;
  if (g.k === 'peace') return ![1, 2, 3, 4].some(t => alive(t) && G.rel[p][t].war); if (g.k === 'regain') return g.ids.every(i => G.setts[i].ctrl === p);
  if (g.k === 'age') return G.court.regent < 0; if (g.k === 'tech') return Object.keys(TECH).some(x => TECH[x].era === g.era && hasTech(x)); if (g.k === 'lands') return landsN() > g.n0; return false; }
{ const kd = kingDied; kingDied = function (k) { const R0 = reignInit(), A = R0 ? reignArchive(R0, k) : null; kd(k); if (!A) return;
  if (G.over) { G.over.reign = A; return; }
  const R1 = reignInit(true); R1.goal = reignGoal(); while (typeof DLG !== 'undefined' && DLG.open()) DLG.close();
  UI.alert('reign', { A, heir: kingC().id }); if (typeof Snd !== 'undefined') Snd.sfx('bell'); }; }
// ---------- every day: the age turns; the heir's charge fulfilled; the estates calm the land ----------
DAILY_EXT.push(() => { const R0 = reignInit(); if (!R0) return; const e = eraNow(); if (G.eraSeen === undefined) G.eraSeen = e;
  if (e > G.eraSeen) { G.eraSeen = e; const E = ERAS[e], L = Object.keys(TECH).filter(x => TECH[x].era === e).map(x => TECH[x].n);
    log('Наступает новая эпоха — ' + E.n + '. Магистру открыты новые знания: ' + L.join(', ') + '.', 'title'); chron('Новая эпоха: ' + E.n + '.', 'hourglass', 'era', 2);
    UI.alert('event', { e: { id: 'era', title: E.n, ic: 'hourglass', opts: [{ t: 'Открыть «Знания»', fx: () => UI.open({ k: 'tech' }) }, { t: 'Позже', fx: () => { } }] }, text: 'Времена меняются. В мастерских и школах — новое: ' + L.join(', ') + '. Магистр может взяться за них.' }); }
  if (R0.goal && !R0.goal.done && goalDone(R0.goal)) { R0.goal.done = G.day; prestige(6); chron('Завет исполнен: ' + R0.goal.t.replace(/\.$/, '') + '.', 'star', 'goal', 3); log('Завет исполнен! Слава +6.', 'good'); if (typeof UI !== 'undefined') UI.toast('Завет исполнен'); }
  if (hasTech('estates')) { for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = Math.max(0, P.unrest - 0.1); if (G.day % DAYS_SEASON === 0) for (const H0 of G.houses) if (H0.alive) houseLoy(H0, 1); } });
