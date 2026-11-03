'use strict';
// ===== AUDIENCE (from council.js): petitions & audiences, envoys & letters, council meetings, night whispers, the court's clock =====
// ---------- petitions & audiences ----------
function rndOwn(type) { const L = G.setts.filter(S => S.owner === 0 && S.ctrl === 0 && (!type || WD.setts[S.id].type === type)); return L.length ? R.pick(L) : null; }
function provUnrest(sid, v) { const p = WD.setts[sid].prov; G.provs[p].unrest = clamp(G.provs[p].unrest + v, 0, 100); }
const PETS = [
  { k: 'harvest', w: 3, role: 'peasant', mk: () => { const S = rndOwn('village'); return S && { s: S.id, text: 'Государь! В деревне ' + WD.setts[S.id].name + ' град побил рожь. Детям есть нечего. Смилуйтесь — простите подать в этом сезоне!' }; },
    ch: p => [{ t: 'Простить подать (−20 зол.)', good: 2, fx: () => { G.realms[0].gold -= 20; provUnrest(p.s, -15); prestige(2); } },
      { t: 'Выдать зерно из амбаров (−150 мер)', good: 3, ok: () => G.court.grain >= 150, why: 'мало зерна', fx: () => { G.court.grain -= 150; provUnrest(p.s, -22); prestige(3); } },
      { t: 'Отказать: подать платят все', good: 0, fx: () => { provUnrest(p.s, 10); prestige(-1); } }] },
  { k: 'bandits', w: 2, role: 'merchant', mk: () => { const S = rndOwn(); return S && { s: S.id, text: 'Ваше величество, на тракте у ' + WD.setts[S.id].name + ' разбойники грабят обозы. Третий караван за месяц! Торговля встанет.' }; },
    ch: p => [{ t: 'Назначить награду за их головы (−30 зол.)', good: 2, fx: () => { G.realms[0].gold -= 30; const b = G.armies.filter(a => a.alive && a.kind === 'bandit').sort((a, b) => Math.hypot(a.x - WD.setts[p.s].x, a.y - WD.setts[p.s].y) - Math.hypot(b.x - WD.setts[p.s].x, b.y - WD.setts[p.s].y))[0]; if (b) takeU(b.u, Math.ceil(armyMen(b) * 0.6)); G.setts[p.s].prosp = Math.min(100, G.setts[p.s].prosp + 4); } },
      { t: 'Велеть судье устроить выездной суд', good: 1, fx: () => { provUnrest(p.s, -6); } }, { t: 'Купцы сами наймут охрану', good: 0, fx: () => { G.setts[p.s].prosp = Math.max(5, G.setts[p.s].prosp - 6); } }] },
  { k: 'dispute', w: 3, role: 'courtier', mk: () => { const H = G.houses.filter(h => h.alive); if (H.length < 2) return null; const a = R.pick(H); let b = R.pick(H); if (a === b) b = H[(H.indexOf(a) + 1) % H.length]; return { a: a.id, b: b.id, text: 'Государь, рассудите! Дом ' + b.name + ' захватил мельницу на реке, что испокон веку принадлежала дому ' + a.name + '. Мы требуем справедливости!' }; },
    ch: p => [{ t: 'Мельница — дому ' + G.houses[p.a].name, good: 1, fx: () => { houseLoy(G.houses[p.a], 7); houseLoy(G.houses[p.b], -8); } },
      { t: 'Мельница — дому ' + G.houses[p.b].name, good: 1, fx: () => { houseLoy(G.houses[p.b], 7); houseLoy(G.houses[p.a], -8); } },
      { t: 'Поделить доходы мельницы пополам', good: 2, fx: () => { houseLoy(G.houses[p.a], -2); houseLoy(G.houses[p.b], -2); prestige(2); } }] },
  { k: 'widow', w: 2, role: 'peasant', fem: 1, mk: () => ({ text: 'Мой муж служил в вашем войске, государь, и пал в бою. Остались трое детей. Не дайте нам умереть с голоду…' }),
    ch: p => [{ t: 'Назначить пенсию (−12 зол.)', good: 2, fx: () => { G.realms[0].gold -= 12; prestige(3); for (const a of G.armies) if (a.alive && a.realm === 0) a.morale = Math.min(100, a.morale + 2); } },
      { t: 'Дать мешок зерна (−40 мер)', good: 1, ok: () => G.court.grain >= 40, why: 'мало зерна', fx: () => { G.court.grain -= 40; prestige(1); } }, { t: 'Утешить словом', good: 0, fx: () => { } }] },
  { k: 'guild', w: 2, role: 'merchant', mk: () => { const S = rndOwn('town') || rndOwn('capital'); return S && { s: S.id, text: 'Ремесленники ' + WD.setts[S.id].name + ' просят грамоту на гильдию. Мы будем платить в казну, государь, — и платить исправно!' }; },
    ch: p => [{ t: 'Даровать грамоту', good: 2, fx: () => { G.setts[p.s].prosp = Math.min(100, G.setts[p.s].prosp + 8); G.court.incK = Math.min(1.35, (G.court.incK || 1) + 0.01); for (const H0 of G.houses) houseLoy(H0, -1); } }, { t: 'Отказать: знать будет против', good: 1, fx: () => { G.setts[p.s].prosp = Math.max(5, G.setts[p.s].prosp - 3); } }] },
  { k: 'scholar', w: 2, role: 'scholar', mk: () => ({ text: 'Ваше величество, в монастыре гниют древние трактаты. Дайте денег на переписчиков — и знание не умрёт.' }),
    ch: p => [{ t: 'Дать 25 золотых', good: 2, fx: () => { G.realms[0].gold -= 25; techProgress(8); } }, { t: 'Отказать', good: 0, fx: () => { } }] },
  { k: 'young', w: 2, role: 'courtier', mk: () => { const H = G.houses.filter(h => h.alive); if (!H.length) return null; const h = R.pick(H); const c = mkHouseMember(h, R.chance(0.3) ? 1 : 0, R.i(17, 24)); c.atCourt = 0; return { h: h.id, c: c.id, text: 'Я ' + c.name + ' из дома ' + h.name + '. Прошу места при вашем дворе, государь. Я умею ' + SKD[bestSkill(c)] + '.' }; },
    ch: p => [{ t: 'Принять ко двору', good: 2, fx: () => { const c = charOf(p.c); c.atCourt = 1; houseLoy(G.houses[p.h], 4); log(c.name + ' принят ко двору.', 'good'); } }, { t: 'Отказать', good: 0, fx: () => { houseLoy(G.houses[p.h], -2); } }] },
  { k: 'accuse', w: 2, role: 'peasant', mk: () => { const S = rndOwn(); return S && { s: S.id, text: 'Сборщик податей в ' + WD.setts[S.id].name + ' берёт втрое против положенного, а разницу кладёт в карман! Защитите, государь!' }; },
    ch: p => [{ t: 'Повесить сборщика', good: 1, fx: () => { provUnrest(p.s, -12); prestige(1); } }, { t: 'Поручить судье разобраться', good: 2, fx: () => { provUnrest(p.s, -8); G.court.incK = Math.min(1.35, (G.court.incK || 1) + 0.005); } }, { t: 'Наветы! Прогнать', good: 0, fx: () => { provUnrest(p.s, 8); } }] },
];
function bestSkill(c) { let b = 'mar'; for (const k of ['dip', 'intr', 'stew', 'lrn']) if ((c[k] || 0) > (c[b] || 0)) b = k; return b; }
function judgeResolve(p) { const def = PETS.find(d => d.k === p.k); if (!def) return; const j = seatChar('justice') || (G.court.regent >= 0 ? charOf(G.court.regent) : null); const chs = def.ch(p).filter(ch => !ch.ok || ch.ok());
  if (!chs.length) return; const pick = j && R.chance(clamp(j.lrn / 18, 0.2, 0.95)) ? chs.slice().sort((a, b) => (b.good || 0) - (a.good || 0))[0] : R.pick(chs); try { pick.fx(); } catch (e) { console.warn(e); } p.done = 1;
  noteVerdict(p, pick, chs, seatChar('justice') ? 'judge' : j ? 'regent' : 'clerk', j); return pick.t; }
// the court book: every petition decided at court, by the king or in his name
const PET_T = { harvest: 'Недород: просят помощи', bandits: 'Разбойники на тракте', dispute: 'Спор знатных домов', widow: 'Вдова павшего воина', guild: 'Грамота для гильдии', scholar: 'Деньги на переписчиков', young: 'Просьба о месте при дворе', accuse: 'Жалоба на сборщика податей' };
function petGist(p) { let s = PET_T[p.k] || 'Прошение'; try { if (p.s !== undefined && WD.setts[p.s]) s += ' · ' + WD.setts[p.s].name; else if (p.k === 'dispute') s += ' · ' + G.houses[p.a].name + ' и ' + G.houses[p.b].name; else if (p.k === 'young' && charOf(p.c)) s += ' · ' + charOf(p.c).name; } catch (e) { } return s; }
function noteVerdict(p, pick, chs, by, c) { const C = G.court, best = Math.max(...chs.map(x => x.good || 0)), g = pick.good || 0;
  const v = { d: G.day, g: petGist(p), t: pick.t, by, bn: c ? c.name : '', q: g >= best ? 2 : g > 0 ? 1 : 0 }; (C.verdicts = C.verdicts || []).unshift(v); if (C.verdicts.length > 60) C.verdicts.length = 60; return v; }
function mkPetition() { const tot = PETS.reduce((s, d) => s + d.w, 0); let r = R.f() * tot; let def = PETS[0]; for (const d of PETS) { r -= d.w; if (r <= 0) { def = d; break; } } const p = def.mk(); if (!p) return null; p.k = def.k; p.id = G.nextId++; p.role = def.role; p.fem = def.fem || (R.chance(0.25) ? 1 : 0); p.day = G.day; return p; }
function petitionsDaily() { if (G.atCourt) return; const n = R.i(0, 2); let k = 0; for (let i = 0; i < n; i++) { const p = mkPetition(); if (p && judgeResolve(p)) k++; } const C = G.court; C.petAcc = (C.petAcc || 0) + k; if (C.petAcc > 0 && G.day % 7 === 0) { const V = (C.verdicts || []).filter(v => G.day - v.d < 7 && v.by !== 'king'), wise = V.filter(v => v.q === 2).length; log('За неделю ' + (C.regent >= 0 ? 'регент' : seatChar('justice') ? 'судья' : 'писцы канцелярии') + ' ' + (C.regent >= 0 || seatChar('justice') ? 'рассмотрел ' : 'рассмотрели ') + C.petAcc + ' ' + plural(C.petAcc, 'прошение', 'прошения', 'прошений') + ' (мудро — ' + wise + '). Решения — в «Малом совете», вкладка «Суд».', 'info'); C.petAcc = 0; } }
const PET_ROLE_N = { peasant: ['Крестьянин', 'Крестьянка'], merchant: ['Купец', 'Купчиха'], courtier: ['Благородный', 'Благородная'], scholar: ['Учёный брат', 'Сестра'] };
function spawnPetitioners() { const C = G.court; const n = R.i(1, 3); for (let i = 0; i < n; i++) { const p = mkPetition(); if (!p) continue; const nm = p.c >= 0 && charOf(p.c) ? charOf(p.c) : null;
    const c = nm ? nm : pseudoChar(200 + (p.id % 600), p.role, p.fem, R.i(20, 60), PET_ROLE_N[p.role][p.fem] + ' ' + R.pick(NAMES.K.filter(x => (p.fem ? /а$|я$|ь$/ : /[^аяь]$/).test(x)).concat(['Том'])));
    const n0 = mkNpc('pet' + p.id, c, { visitor: 1, petition: p, spd: 40 }); npcPlace(n0, LOCS.yard.spots.gate_out); n0.away = 0; npcGoTo(n0, 'q' + (COURT.npcs.filter(x => x.petition).length - 1) % 6); }
  UI.toast('Просители у ворот: приём в тронном зале с 9 до 12.'); }
function npcLeave(n) { n.petition = null; n.envoy = null; n.override = null; n.sched = null; npcGoTo(n, 'gate_out', m => { COURT.npcs = COURT.npcs.filter(x => x !== m); }); }
function startAudience() { const h = hourAbs(); const waiting = COURT.npcs.filter(n => n.petition && !n.petition.done && n.loc === 'keep' && !n.away);
  const env = COURT.npcs.find(n => n.envoy && !n.envoy.done && n.loc === 'keep' && !n.path);
  if (env) { talkEnvoy(env); return; }
  if (!waiting.length) { const out = COURT.npcs.some(n => n.petition && !n.petition.done); DLG.say(null, out ? 'Просители ещё идут через двор. Оставайтесь на троне — подойдут, как только войдут.' : h < 9 || h > 12.5 ? 'Приёмные часы — с девяти до полудня. Сейчас просителей нет.' : 'Просителей больше нет.'); return; }
  COURT.audience = { q: waiting.slice() }; if (typeof TUT !== 'undefined') TUT.ev('audience'); nextPetitioner(); }
function nextPetitioner() { const A = COURT.audience; if (!A) return; let n = A.q.shift();
  if (!n) { const more = COURT.npcs.filter(m => m.petition && !m.petition.done && m.loc === 'keep' && !m.away); if (more.length) { A.q = more; n = A.q.shift(); } } // newcomers who entered during the audience
  if (!n) { COURT.audience = null; UI.toast(COURT.npcs.some(m => m.petition && !m.petition.done) ? 'Остальные просители ещё в пути — подойдут сами.' : 'Приём окончен.'); return; }
  npcGoToSp(n, LOCS.keep.spots.petition, m => { m.dir = 'up'; if (COURT.audience && COURT.p.sit === LOCS.keep.spots.throne) petitionDialog(m); }); }
function audienceAuto() { // the king is already on the throne: petitioners (and an envoy) who come in walk up by themselves
  const P = COURT.p; if (!P || P.sit !== LOCS.keep.spots.throne || COURT.loc !== 'keep' || COURT.audience || courtBlocked()) return;
  if ((COURT.audT || 0) > NOW) return; COURT.audT = NOW + 0.5;
  const env = COURT.npcs.find(n => n.envoy && !n.envoy.done && !n.autoMet && n.loc === 'keep' && !n.away);
  if (env) { env.autoMet = 1; npcGoToSp(env, LOCS.keep.spots.petition, m => { m.dir = 'up'; if (COURT.p.sit === LOCS.keep.spots.throne) talkEnvoy(m); }); return; }
  const w = COURT.npcs.filter(n => n.petition && !n.petition.done && n.loc === 'keep' && !n.away);
  if (w.length) { COURT.audience = { q: w }; if (typeof TUT !== 'undefined') TUT.ev('audience'); nextPetitioner(); } }
function petitionDialog(n) { const p = n.petition; if (!p) return nextPetitioner(); const def = PETS.find(d => d.k === p.k);
  const fin = () => { p.done = 1; prestige(0.3); npcLeave(n); if (COURT.audience) setTimeout(() => { if (COURT.audience && COURT.p.sit) nextPetitioner(); }, 400); };
  const all = def.ch(p), avail = all.filter(ch => !ch.ok || ch.ok());
  const chs = all.map(ch => Object.assign({}, ch, { fx: () => { ch.fx(); noteVerdict(p, ch, avail.length ? avail : all, 'king', charOf(G.player.char)); fin(); } }));
  if (seatChar('justice')) chs.push({ t: 'Передать верховному судье', fx: () => { const t = judgeResolve(p); if (t) UI.toast('Судья ' + seatChar('justice').name + ' решил: «' + t + '»'); fin(); } });
  DLG.say(n, p.text, { choices: chs }); }
function endAudience() { COURT.audience = null; }
function talkPetitioner(n) { if (COURT.p.sit === LOCS.keep.spots.throne) { startAudience(); return; } DLG.say(n, 'Я жду приёма у трона, ваше величество. Сядьте на трон — и я изложу свою просьбу.'); }
// ---------- envoys, letters, messengers ----------
function envoyCheck() { if (SCREEN !== 'court') return;
  for (const m of G.msgs) { if (m.done || m.envoyN || !['peace', 'call', 'ransom', 'offer'].includes(m.kind) || m.from === undefined || m.from > 4) continue; m.envoyN = 1;
    const ru = rulerOf(m.from); const c = pseudoChar(900 + (m.id % 90), 'envoy', 0, R.i(30, 55), 'Посол ' + R.pick(NAMES[REALM_DEF[m.from].key] || NAMES.K)); c.realm = m.from; c.cul = REALM_DEF[m.from].key;
    const n = mkNpc('env' + m.id, c, { visitor: 1, envoy: m, spd: 42 }); npcPlace(n, LOCS.yard.spots.gate_out); n.away = 0; npcGoTo(n, 'envoy', x => { x.dir = 'up'; say(x, 'Послание от ' + (ru ? ru.title + ' ' + ru.name : realmName(m.from)) + '!', 5); }); UI.toast('Посол державы ' + realmName(m.from) + ' въехал в ворота.'); Snd.sfx('horn_short'); }
  for (const n of COURT.npcs) if (n.envoy && (n.envoy.done || n.envoy.until < G.day)) npcLeave(n); }
function talkEnvoy(n) { const m = n.envoy; if (!m || m.done) { DLG.say(n, 'Мой государь ждёт ответа. Я уезжаю.'); return; } UI.alert('msg', m); }
function kingPos() { if (G.atCourt || !playerArmy()) { const ws = WD.setts[G.realms[0].capital]; return [ws.x + 0.5, ws.y + 0.5]; } const a = playerArmy(); return [a.x, a.y]; }
function courierSpeed() { return 22 * (hasTech('posts') ? 1.6 : 1); }
function addLetter(o) { const C = G.court; o.id = C.nextL = (C.nextL || 0) + 1; o.day = G.day; if (o.arr === undefined) { let d = 0; if (o.x !== undefined) { const [kx, ky] = kingPos(); d = Math.hypot(kx - o.x, ky - o.y) / courierSpeed(); if (o.pigeon && hasTech('pigeons')) d = Math.min(d, 0.5); } o.arr = G.day + G.frac + d; } o.read = 0; C.letters.unshift(o); if (C.letters.length > 60) C.letters.pop(); return o; }
function letterFromSeat(k, subj, text, o) { const c = seatChar(k); const ws = WD.setts[G.realms[0].capital]; return addLetter(Object.assign({ from: seatName(k) + (c ? ' ' + c.name : ''), fc: c ? c.id : -1, subj, text, x: ws.x, y: ws.y, pigeon: 1 }, o || {})); }
function lettersDaily() { const C = G.court; for (const l of C.letters) if (!l.read && l.arr <= G.day && !l.noted) { l.noted = 1; if (!G.atCourt) { log('Гонец: «' + l.subj + '» — ' + l.from, 'info'); Snd.sfx('gallop'); } } }
function openLetter(l) { if (l.dyn === 'welcome' && typeof welcomeText === 'function') l.text = welcomeText(); l.read = 1; Snd.sfx('paper'); DLG.say(null, [l.text], { name: '✉ ' + l.subj + ' — ' + l.from, choices: l.ch && !l.answered ? l.ch.map(ch => Object.assign({}, ch, { fx: () => { l.answered = 1; ch.fx(); } })) : null }); }
function pageUpdate(dt) { const C = G.court; const pg = npcByKey('srv_page'); if (!pg || pg.errand) return; const P = COURT.p;
  if (!pg.msgr) { const l = C.letters.find(l => !l.read && !l.paged && l.arr <= G.day + G.frac); if (l && !pg.away) { l.paged = 1; pg.msgr = l; pg.hold = 1; pg.msgT = NOW; pg.path = null; say(pg, 'Государь! Письмо!', 3); } return; }
  if (NOW - pg.msgT > 60 || pg.msgr.read) { pg.msgr = null; pg.hold = 0; pg.curT = null; return; }
  if (pg.loc !== COURT.loc || pg.away) { pg.msgr = null; pg.hold = 0; pg.curT = null; return; }
  const d = Math.hypot(P.x - pg.x, P.y - pg.y); if (d < 22) { pg.path = null; return; }
  pg.repT = (pg.repT || 0) - dt; if (pg.repT <= 0 || !pg.path) { pg.repT = 0.8; const L = LOCS[pg.loc]; const [sx, sy] = nearFree(L, Math.floor(pg.x / CT), Math.floor(pg.y / CT)); const [tx, ty] = nearFree(L, Math.floor(P.x / CT), Math.floor(P.y / CT) + 1); pg.path = castar(L, sx, sy, tx, ty, 2500); pg.pi = 0; pg.goal = { sp: { loc: pg.loc, x: tx * CT + 8, y: ty * CT + 12, dir: 'up' } }; }
  if (pg.path) { const sv = pg.hold; pg.hold = 0; npcUpdate(pg, dt * 1.6); pg.hold = sv; if (!pg.path || pg.pi >= (pg.path ? pg.path.length : 0)) pg.path = null; } }
function talkMessenger(n) { const l = n.msgr; n.msgr = null; n.hold = 0; n.curT = null; if (l) openLetter(l); else DLG.say(n, 'Писем больше нет, государь!'); }
// ---------- council meetings: weekly (Thursday 9:30) or called urgently by the king ----------
const isCouncilDay = () => weekdayOf(G.day) === COUNCIL_WD;
const seatSpotName = k => 'seat' + SEATS.findIndex(s => s.k === k);
function meetingOpen() { const C = G.court, h = hourAbs(); if (!C || C.meetDay !== G.day || C.meetDone === G.day) return false; return C.meetCall ? h <= C.meetCall.until : h >= 9.4 && h < 12; }
function councilPresence() { const come = [], away = [], vac = []; for (const s of SEATS) { const c = seatChar(s.k); if (!c) { vac.push(s); continue; } const n = typeof npcByKey === 'function' ? npcByKey('seat_' + s.k) : null; if (n && G.atCourt) come.push({ s, c, n }); else away.push({ s, c }); } return { come, away, vac }; }
function seatedNow(n) { return !!(n.sit && n.sit === spotOf(seatSpotName(n.seat))); }
const lowFirst = t => t.charAt(0).toLowerCase() + t.slice(1);
function canCallCouncil() { const C = G.court; if (!C) return 'Совета нет';
  if (!G.atCourt) return 'Король в отъезде — без него совет не собрать'; if (SCREEN !== 'court') return 'Вернитесь ко двору (Tab), чтобы созвать совет';
  if (C.meetDone === G.day) return 'Совет сегодня уже заседал'; if (meetingOpen()) return 'Совет уже собирается'; if (C.callDay === G.day) return 'Сегодня совет уже созывали';
  return null; }
function callCouncil() { const why = canCallCouncil(); if (why) { UI.toast(why + '.'); return false; }
  const C = G.court, h = hourAbs(), night = isNight(), until = Math.min(28.95, h + 3); const pr = councilPresence();
  C.callDay = G.day; C.waitKing = 0;
  if (pr.come.length) { C.meetDay = G.day; C.meetCall = { at: h, until }; }
  for (const e of pr.come) { const n = e.n; if (n.away || n.loc !== 'keep') { npcPlace(n, spotOf('council_door')); n.away = 0; }
    n.override = { spot: seatSpotName(e.s.k), until, day: G.day }; n.curT = null; n.hold = 0; n.wander = null;
    if (night) { e.c.loy = clamp((e.c.loy || 50) - 2, 0, 100); say(n, R.pick(['В такой час, государь?..', 'Что стряслось среди ночи?', '*зевает* Иду, иду…']), 4); } else say(n, R.pick(['Иду, государь!', 'Срочный совет? Уже иду.', 'Что случилось?']), 3); }
  if (typeof Snd !== 'undefined') Snd.sfx('bell'); UI.shut();
  const P = COURT.p, seated = P && P.sit === LOCS.keep.spots.seat_king; if (seated && pr.come.length) C.waitKing = 1;
  const t = (pr.come.length ? 'Паж побежал по замку: «Срочный совет!» Придут: ' + pr.come.map(e => lowFirst(e.s.n)).join(', ') + '.' : 'Звать некого: никого из советников нет в замке.')
    + (pr.away.length ? ' В отъезде: ' + pr.away.map(e => lowFirst(e.s.n) + ' (' + e.c.name + ')').join(', ') + '.' : '') + (pr.vac.length ? ' Пустуют места: ' + pr.vac.map(s => lowFirst(s.n)).join(', ') + '.' : '')
    + (pr.come.length ? (seated ? ' Король ждёт во главе стола — совет начнётся, как только все сядут.' : ' Они сойдутся в зал совета в течение часа. Если король не придёт за два часа — разойдутся.') : '') + (night && pr.come.length ? ' Ночной сбор: советники недовольны (верность −2).' : '');
  const ch = !seated && pr.come.length ? [{ t: 'Идти в зал совета и сесть во главе стола', fx: () => goCouncilSeat() }, { t: 'Позже', fx: () => { } }] : null;
  DLG.say(null, t, { name: 'Экстренный сбор совета', choices: ch, esc: ch ? 1 : undefined }); if (typeof TUT !== 'undefined') TUT.ev('callcouncil'); return true; }
function goCouncilSeat() { const C = G.court; COURT.fade = 0.001; COURT.fadeT = NOW; COURT.fadeFn = () => { COURT.loc = 'keep'; sitAt(LOCS.keep.spots.seat_king); snapCam(); C.waitKing = 1; Snd.sfx('door'); }; }
function councilUpdate() { const C = G.court; if (!C) return; const P = COURT.p, h = hourAbs();
  if (C.meetHold !== undefined && C.meetHold >= 0 && (C.meetHold !== G.day || !P || P.sit !== LOCS.keep.spots.seat_king)) { C.meetHold = -1; let first = 1; // the king has risen: now the council may rise too
    for (const n of COURT.npcs) if (n.seat && n.override && n.override.hold) { const sat = seatedNow(n); n.override = null; n.curT = null; if (first && sat) { first = 0; say(n, R.pick(['С вашего позволения, государь.', 'За дела, господа.', 'Да хранит вас Господь, государь.']), 3); } } }
  if (C.meetDay !== G.day || C.meetDone === G.day) return;
  if (C.waitKing && P && P.sit === LOCS.keep.spots.seat_king && !DLG.open() && !UI.win && !UI.modalOpen()) { const pr = councilPresence(); if (pr.come.every(e => seatedNow(e.n))) { runMeeting(); return; } }
  if (C.meetCall && h > C.meetCall.until) { C.meetDone = G.day; C.meetCall = null; C.waitKing = 0; for (const e of councilPresence().come) { e.c.loy = clamp((e.c.loy || 50) - 1, 0, 100); e.n.override = null; e.n.curT = null; } log('Советники прождали короля два часа и разошлись. Обижены.', 'bad'); } }
function councilSit() { const C = G.court;
  if (meetingOpen()) { const pr = councilPresence(), sat = pr.come.filter(e => seatedNow(e.n)).length;
    if (sat >= pr.come.length) { runMeeting(); return; }
    DLG.say(null, 'Советники ещё сходятся: за столом ' + sat + ' из ' + pr.come.length + '.', { name: 'Зал совета', choices: [{ t: 'Подождать остальных', fx: () => { C.waitKing = 1; UI.toast('Король ждёт во главе стола: совет начнётся, когда все сядут.'); } }, { t: 'Начать без опоздавших', fx: () => runMeeting() }, { t: 'Встать', fx: () => standUp() }], esc: 2 }); return; }
  const nd = nextCouncilDay(), why = canCallCouncil(); const ch = [];
  if (!why) ch.push({ t: 'Созвать совет сейчас', tip: isNight() ? 'Ночью советники будут недовольны (верность −2).' : 'Советники в замке придут в течение часа.', fx: () => callCouncil() });
  ch.push({ t: 'Открыть дела совета', fx: () => UI.open({ k: 'council' }) }, { t: 'Встать', fx: () => standUp() });
  DLG.say(null, 'Зал совета пуст. Малый совет собирается раз в неделю — по четвергам в 9:30. Ближайший: ' + dateStr(nd) + ' (' + inDays(nd - G.day) + ').' + (why ? ' ' + why + '.' : ' Можно созвать советников срочно — или просто раздать поручения.'), { choices: ch, esc: ch.length - 1 }); }
function runMeeting() { const C = G.court; C.meetDone = G.day; C.waitKing = 0; const L = [], pr = councilPresence();
  for (const e of pr.come) { const rep = seatReport(e.s.k); if (rep) L.push({ who: e.n, text: rep }); e.c.loy = clamp((e.c.loy || 50) + 0.5, 0, 100); }
  const notes = []; if (pr.away.length) notes.push('В отъезде: ' + pr.away.map(e => lowFirst(e.s.n)).join(', ') + '.'); if (pr.vac.length) notes.push('Пустуют места: ' + pr.vac.map(s => s.n).join(', ') + '.');
  L.push({ who: null, text: 'Доклады выслушаны. ' + (notes.length ? notes.join(' ') + ' ' : '') + 'Что прикажет государь?', choices: [{ t: 'Раздать поручения', fx: () => UI.open({ k: 'council' }) }, { t: 'Распустить совет', fx: () => { } }], esc: 1, onEnd: () => { for (const n of COURT.npcs) if (n.seat && n.override) { n.override.until = 28.95; n.override.hold = 1; } C.meetCall = null; C.meetHold = G.day; } }); // nobody rises before the king
  DLG.seq(L); if (typeof TUT !== 'undefined') TUT.ev('meeting'); }
function talkSeat(n) { const c = n.c, k = n.seat, C = G.court; const loy = c.loy || 50;
  const greet = loy >= 70 ? R.pick(['Государь! Чем могу служить?', 'Всегда к вашим услугам, ваше величество.']) : loy >= 40 ? R.pick(['Ваше величество.', 'Слушаю, государь.']) : R.pick(['…Да, государь?', 'Вы что-то хотели, ваше величество?']);
  const ch = [{ t: 'Доклад', fx: () => DLG.say(n, seatReport(k) || '…') }, { t: 'Дать поручение…', fx: () => UI.open({ k: 'council', seat: k }) }];
  if (k === 'treasurer' && C.secrets.some(s => s.k === 'theft' && s.known)) ch.push({ t: 'Обвинить в воровстве!', fx: () => DLG.say(n, R.pick(['Г-государь… это ошибка писцов! Клянусь!', 'Кто вам наплёл?! Я… я всё объясню!']), { choices: confrontChoices() }) });
  ch.push({ t: 'Поговорить по душам', fx: () => { if (c.talkDay && G.day - c.talkDay < 7) { DLG.say(n, 'Мы ведь уже беседовали на днях, государь. Дела ждут.'); return; } c.talkDay = G.day; c.loy = clamp(loy + 2, 0, 100); DLG.say(n, soulLine(c)); } });
  ch.push({ t: 'Освободить от должности', fx: () => DLG.say(null, 'Снять ' + c.name + ' с поста «' + seatName(k) + '»? Он обидится, его дом тоже.', { choices: [{ t: 'Да, снять', fx: () => { dismissSeat(k); log(c.name + ' снят с поста: ' + seatName(k) + '.', 'info'); } }, { t: 'Нет', fx: () => { } }], esc: 1 }) });
  ch.push({ t: 'Ничего, ступайте', fx: () => { } });
  DLG.say(n, greet, { choices: ch, esc: ch.length - 1 }); }
function soulLine(c) { const t = c.traits, L = [];
  if (t.includes('greedy')) L.push('Деньги, государь, — кровь державы. И, признаться, я люблю, когда они текут рядом.');
  if (t.includes('honest')) L.push('Я не умею лгать, государь. Да и не хочу учиться.');
  if (t.includes('proud')) L.push('Мой дом служил трону, когда ваш прадед ещё учился держать меч.');
  if (t.includes('cunning')) L.push('Всякий человек — замок. Надо лишь знать, где у него потайная дверь.');
  if (t.includes('wise')) L.push('Мудрость — знать, чего не знаешь. Остальное приложится.');
  if (t.includes('brave')) L.push('Дайте мне дело потруднее, государь. Скучно!');
  if (t.includes('craven')) L.push('Я молюсь, чтобы война обошла нас стороной.');
  if (t.includes('wrathful')) L.push('Иной раз так и хочется взять плеть… Простите, государь.');
  if ((c.amb || 50) > 70) L.push('Признаюсь, я мечтаю о большем. Но только на службе вам, конечно.');
  if ((c.loy || 50) < 30) L.push('Служба… да. Служба.');
  return L.length ? R.pick(L) : 'Служу, как умею, государь.'; }
// ---------- secrets & night whispers ----------
function secretsDaily() { const C = G.court;
  for (const H0 of G.houses) if (H0.alive && H0.loy < 30 && (H0.amb || 50) > 55 && R.chance(0.03)) { const foe = [1, 2, 3, 4].filter(t => alive(t)).sort((a, b) => opinionOf(a, 0) - opinionOf(b, 0))[0]; if (foe) addSecret('plot', [H0.head], { house: H0.id, realm: foe }); }
  if (!C.secrets.some(s => s.k === 'spy') && R.chance(seatChar('eye') ? 0.006 : 0.015)) { const foe = [1, 2, 3, 4].filter(t => alive(t))[R.i(0, 3)]; if (foe) addSecret('spy', [-1], { realm: foe }); }
  if (!C.secrets.some(s => s.k === 'love') && R.chance(0.01)) addSecret('love', [-2]);
  for (const s of C.secrets) if (s.k === 'plot' && !s.known && G.day - s.day > 35) { const H0 = G.houses[s.house]; if (H0 && !s.ripe) { s.ripe = 1; houseLoy(H0, -8); H0.defiant = G.day + 40; log('Дом ' + H0.name + ' перестал платить подати короне.', 'bad'); } }
  C.secrets = C.secrets.filter(s => !(s.known && s.k === 'love') && !(s.k === 'spy' && s.known && s.done)); }
const WHISPER = {
  theft: ['— Ещё сорок монет к весне…', '— А книги? — Книги сойдутся. Король верит тому, что я пишу.', '— А если судья…? — Судья тоже любит золото.'],
  plot: ['— Наш дом ждёт только знака.', '— Ваш король щедр к друзьям? — Щедрее этого.', '— Когда войско уйдёт в поход — тогда.'],
  spy: ['— Ключ от кабинета Ока?', '— Завтра. Письма скопирую к рассвету.', '— Хозяева заплатят вдвое.'],
  love: ['— Ты придёшь завтра?', '— Тише! Вдруг кто услышит…', '— Пусть слышат. Я тебя люблю.'],
};
function stageWhisper() { const C = G.court; if (COURT.whisper && !COURT.whisper.done) return;
  const list = C.secrets.filter(s => !s.known && !(s.scare > G.day) && G.day - s.lastMeet >= 2); if (!list.length || !R.chance(0.65)) return; const s = R.pick(list); let a = null, b = null;
  const stranger = () => { const c = pseudoChar(990, 'envoy', 0, 40, 'Незнакомец в плаще'); c.cloak = 1; const n = mkNpc('vis_stranger', c, { visitor: 1, vis: 1, spd: 38 }); npcPlace(n, LOCS.yard.spots.gate_out); n.away = 0; return n; };
  if (s.k === 'theft') { a = npcByKey('seat_treasurer'); b = npcByKey('srv_merchant'); }
  else if (s.k === 'plot') { a = COURT.npcs.find(n => n.seat && n.c.house === s.house) || null; if (a) b = stranger(); }
  else if (s.k === 'spy') { a = npcByKey('srv_maid'); if (a) b = stranger(); }
  else if (s.k === 'love') { a = npcByKey('srv_stable'); b = npcByKey('srv_maid'); }
  if (!a || !b) return; s.lastMeet = G.day;
  const ov = (n, sp) => { n.override = { spot: sp, until: 24.6, day: G.day }; n.curT = null; n.hold = 0; };
  ov(a, 'whisper_a'); if (b.key === 'vis_stranger') npcGoTo(b, 'whisper_b'); else ov(b, 'whisper_b');
  COURT.whisper = { s, a, b, from: 22.5, to: 24.5, prog: 0, done: 0, li: -1 }; }
function endWhisper(w) { w.done = 1; for (const n of [w.a, w.b]) { n.override = null; n.curT = null; if (n.key === 'vis_stranger') npcLeave(n); } COURT.ear = null; }
function eavesdropUpdate(dt) { pageUpdate(dt); COURT.ear = null; const w = COURT.whisper; if (!w || w.done) return; const h = hourAbs(); if (h > w.to || G.day !== w.s.lastMeet) { endWhisper(w); return; }
  const a = w.a, b = w.b; if (a.loc !== 'yard' || b.loc !== 'yard' || a.path || b.path || a.away || b.away) return;
  if (R.chance(dt * 0.5)) say(R.chance(0.5) ? a : b, R.pick(['…', 'шшш…', '…тише…']), 1.5);
  if (COURT.loc !== 'yard') return; const P = COURT.p, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(P.x - cx, P.y - cy);
  if ((P.moving && !COURT.sneak && d < 76) || d < 20) { say(a, R.pick(['Государь?! Мы… любуемся звёздами.', 'Ох! Ваше величество… Доброй ночи.']), 4); say(b, '…', 3); w.s.scare = G.day + 4; for (const n of [a, b]) if (n.c && !n.c.pseudo) n.c.loy = clamp((n.c.loy || 50) - 2, 0, 100); endWhisper(w); UI.toast('Вас заметили. Заговорщики разошлись.'); return; }
  if (d < 58 && COURT.sneak) { COURT.ear = w; w.prog = Math.min(1, w.prog + dt / 8); const lines = WHISPER[w.s.k], li = Math.min(lines.length - 1, Math.floor(w.prog * lines.length)); if (li !== w.li) { w.li = li; say(li % 2 ? b : a, lines[li], 3.2); a.bubCol = b.bubCol = '#c8d8f0'; }
    if (w.prog >= 1) { endWhisper(w); revealSecret(w.s, 'подслушано'); } } else COURT.ear = null; }
function revealSecret(s, how) { s.known = 1; s.how = how; Snd.sfx('chime'); const t = secretText(s);
  if (s.k === 'theft') DLG.say(null, ['Вы узнали тайну: ' + t, 'Теперь у вас есть доказательство.'], { name: 'Тайна раскрыта', choices: confrontChoices() });
  else if (s.k === 'plot') { const H0 = G.houses[s.house]; DLG.say(null, 'Вы узнали тайну: ' + t, { name: 'Тайна раскрыта', choices: [{ t: 'Вызвать главу дома и пристыдить', tip: 'Дом напуган: заговор сорван, но верность падает.', fx: () => { houseLoy(H0, -4); H0.defiant = 0; H0.amb = Math.max(0, (H0.amb || 50) - 25); C_dropSecret(s); log('Заговор дома ' + H0.name + ' сорван.', 'good'); } },
      { t: 'Задобрить дом: место при дворе, подарки (−40 зол.)', tip: 'Верность дома заметно вырастет.', fx: () => { if (spend(40)) { houseLoy(H0, 15); H0.defiant = 0; C_dropSecret(s); } } }, { t: 'Промолчать и следить', fx: () => { } }] }); }
  else if (s.k === 'spy') DLG.say(null, 'Вы узнали тайну: ' + t, { name: 'Тайна раскрыта', choices: [{ t: 'Схватить шпиона', fx: () => { s.done = 1; C_dropSecret(s); log('Шпион державы ' + realmName(s.realm) + ' схвачен.', 'good'); prestige(2); } },
      { t: 'Скармливать ему ложь (гл. 13: двойной агент)', tip: 'Враг будет считать нас сильнее, чем мы есть.', fx: () => { s.done = 1; G.realms[s.realm].misled = G.day + 60; C_dropSecret(s); log('Шпиону державы ' + realmName(s.realm) + ' подсовывают ложные донесения.', 'good'); } }] });
  else DLG.say(null, 'Вы узнали тайну: ' + t, { name: 'Ночной сад', choices: [{ t: 'Улыбнуться и уйти', fx: () => C_dropSecret(s) }, { t: 'Благословить их союз', fx: () => { prestige(1); C_dropSecret(s); } }] });
  if (typeof TUT !== 'undefined') TUT.ev('secret', s.k); }
function C_dropSecret(s) { G.court.secrets = G.court.secrets.filter(x => x !== s); }
function talkVisitor(n) { DLG.say(n, R.pick(['Я просто путник, ваше величество. Уже ухожу.', 'Дела, государь, дела…'])); }
function gossipLine(n) { const C = G.court, k = n.staff; if (!R.chance(0.65)) return null;
  const theft = C.secrets.find(s => s.k === 'theft' && !s.known); if (theft && seatChar('treasurer') && (k === 'cook' || k === 'maid') && R.chance(0.6)) return R.pick(['Казначей опять заказал фазанов и южного вина. На какие такие деньги, хотела бы я знать…', 'Видела вечером, как казначей пересчитывал монеты у себя. Много монет, государь…']);
  const plot = C.secrets.find(s => s.k === 'plot' && !s.known); if (plot && (k === 'gardener' || k === 'stable') && R.chance(0.6)) return 'Ночью у фонтана опять шептались. Один — в плаще, лица не видно…';
  if (C.secrets.some(s => s.k === 'spy' && !s.known) && k === 'guard' && R.chance(0.5)) return 'Кто-то ночью ходил у кабинета Ока. Не наш — шаги лёгкие.';
  if (C.secrets.some(s => s.k === 'love' && !s.known) && k === 'cook' && R.chance(0.5)) return 'Конюх наш что-то по ночам не спит… Влюбился, не иначе!';
  if ((C.grain || 0) < 300 && k === 'cook') return 'Зерна в амбаре — кот наплакал, государь. Случись осада — беда.';
  const war = warsOf(0); if (war.length && (k === 'soldier' || k === 'soldier2' || k === 'master')) return 'Говорят, ' + REALM_DEF[war[0]].name + ' собирает войско. Мы готовы, государь!';
  const badH = G.houses.find(H0 => H0.alive && H0.loy < 30); if (badH && (k === 'master' || k === 'merchant')) return 'Люди дома ' + badH.name + ' косо смотрят на ваших стражников. Не к добру это.';
  const q = charOf(charOf(G.player.char).spouse); if (q && q.preg && k === 'maid') return 'Королева нынче бледна по утрам… Ой, простите, я ничего не говорила!';
  if (C.hidden > 40 && k === 'merchant' && R.chance(0.4)) return 'Ваш казначей — щедрый покупатель, государь. Для человека на жалованье — очень щедрый.';
  return null; }
// ---------- the court's clock ----------
function courtHalfHour(h) { const C = G.court;
  envoyCheck();
  if (h === 8.5) spawnPetitioners();
  if (h >= 12.5 && h <= 20) { const A = COURT.audience, hearing = A && COURT.p.sit === LOCS.keep.spots.throne; // the king still hears petitions on the throne: those inside wait their turn
    const left = COURT.npcs.filter(n => n.petition && !n.petition.done && !(hearing && n.loc === 'keep')); let k = 0; for (const n of left) { if (judgeResolve(n.petition)) k++; npcLeave(n); } if (k) log((seatChar('justice') ? 'Судья' : 'Канцлер') + ' рассмотрел оставшиеся прошения: ' + G.court.verdicts.slice(0, k).map(v => v.g + ' — «' + v.t + '»').join('; ') + '.', 'info'); if (!hearing) COURT.audience = null; }
  if (h === 9.5 && isCouncilDay() && C.meetDone !== G.day && !C.meetCall && G.atCourt) { C.meetDay = G.day; SEATS.forEach((s, i) => { const n = npcByKey('seat_' + s.k); if (n) { n.override = { spot: 'seat' + i, until: 12, day: G.day }; n.curT = null; } }); UI.toast('Четверг, 9:30: малый совет собирается в зале совета.'); Snd.sfx('bell'); }
  if (h === 12 && C.meetDay === G.day && C.meetDone !== G.day && !C.meetCall) { C.meetDone = G.day; if (G.atCourt) { for (const e of councilPresence().come) e.c.loy = clamp((e.c.loy || 50) - 1, 0, 100); log('Король был в замке, но на совет не пришёл. Советники недовольны.', 'bad'); } }
  if (h === 22) stageWhisper();
  if (h === 20 && C.feastDay === G.day) UI.toast('В пиршественном зале шумит пир!');
}
function eyeBoardAct() { UI.open({ k: 'eye' }); }
function barracksAct() { const S = G.setts[G.realms[0].capital]; DLG.say(null, 'В казармах пахнет кожей и потом. Гарнизон столицы: ' + voin(menOf(S.gar)) + '. Королевская стража — ' + menOf(G.court.retinue ? G.court.retinue.u : { levy: 30 }) + '.' + (seatChar('marshal') ? ' Набор рекрутов ведёт маршал.' : ' Маршала нет — набирать войска некому.')); }
function stallAct() { const C = G.court; DLG.say(npcByKey('srv_merchant') || null, 'Шелка, пряности, книги! Для вашего величества — лучшее.', { choices: [
  { t: 'Шёлковый платок для королевы (15 зол.)', ok: () => charOf(charOf(G.player.char).spouse), why: 'некому дарить', fx: () => { if (spend(15)) { const q = charOf(charOf(G.player.char).spouse); q.happy = clamp((q.happy || 60) + 12, 0, 100); UI.toast('Королева будет рада.'); } } },
  { t: 'Редкий трактат для библиотеки (35 зол.)', fx: () => { if (spend(35)) { techProgress(10); UI.toast('Магистр в восторге от трактата.'); } } },
  { t: 'Ничего, спасибо', fx: () => { } }], esc: 2 }); }
