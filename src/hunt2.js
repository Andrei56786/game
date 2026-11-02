'use strict';
// ===== HUNT 2 (v3.4): bow, javelins and the boar spear; the blood trail and wounded game lying up; the wind; trophies, records and the white hart =====
// COURT.hunt adds: wpn ('bow' | 'jav' | 'pike'), jav (javelins left), jf (javelins in flight), sj (javelins in the ground), blood [{ x, y, t, r, big }],
//   jshots / jhits, pk / pkh (spear strokes / kills), hart (the white hart, if one walks the forest today), hartSeen
// G.court.huntRec = { deer: points, boar: poods, bear: poods } — the records of the court; G.court.huntWpn — the weapon last carried
const HWPN = {
  bow: { n: 'лук', act: 'Выстрелить', rng: 150 },
  jav: { n: 'сулицы', act: 'Метнуть сулицу', rng: 85 },
  pike: { n: 'рогатина', act: 'Ударить рогатиной', rng: 30 },
};
const HWPN_ORD = ['bow', 'jav', 'pike'];
GAME.deer.hp = 2; GAME.doe.hp = 2;   // a deer may be only wounded now — and leave a blood trail
const ucf = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const poods = n => n + ' ' + plural(n, 'пуд', 'пуда', 'пудов'), tines = n => n + ' ' + plural(n, 'отросток', 'отростка', 'отростков');
// ---------- the wind: it always comes from the west here, carrying the king's scent east ----------
function windWord() { const w = windX(); return w >= 2 ? 'сильный ветер с запада' : w >= 1 ? 'ветер с запада' : 'ветерок с запада'; }
function windTip() { return ucf(windWord()) + ': заходите на зверя с востока — не учует.'; }
// game downwind (east of the king) smells him from afar; game upwind lets him come close
function windMul(a, P) { const dx = a.x - P.x, d = Math.hypot(dx, a.y - P.y) || 1; return 1 + clamp(0.12 + windX() * 0.18, 0.2, 0.5) * dx / d; }
{ const th0 = huntThreat; huntThreat = function (a, L, P, g) { const m = windMul(a, P) * (a.hart ? 1.25 : 1); return th0(a, L, P, Object.assign({}, g, { det: g.det * m })); }; }
// ---------- the weapons ----------
function javChance(a, d) { const g = gameOf(a), k = kingC(), P = COURT.p; let p = 0.95 - d / 110 + ((k.mar || 10) - 10) * 0.02 + g.sz * 1.5;
  if (a.st === 'flee') p -= 0.25; else if (a.st === 'bay' || a.st === 'lie') p += 0.2; else if (a.st === 'charge') p += 0.1; else if (!a.moving) p += 0.08;
  if (P.moving) p -= 0.12; if (k.wound > G.day) p -= 0.15; return clamp(p, 0.05, 0.95); }
function pikeChance(a) { const g = gameOf(a), k = kingC(), P = COURT.p; let p = { lie: 0.85, bay: 0.72, charge: 0.5, alert: 0.45, graze: 0.55, flee: 0.2 }[a.st] || 0.4;
  p += ((k.mar || 10) - 10) * 0.03 - (a.kind === 'bear' ? 0.12 : 0) + g.sz; if (P.moving) p -= a.st === 'charge' ? 0.15 : 0.05; if (k.wound > G.day) p -= 0.15; return clamp(p, 0.05, 0.95); }
function wpnChance(a, d, useF) { if (useF) return falconChance(a, d); const w = COURT.hunt.wpn; return w === 'jav' ? javChance(a, d) : w === 'pike' ? pikeChance(a) : hitChance(a, d); }
// a clean shot drops the beast; otherwise it runs on, wounded
function lethalP(a, d) { const k = kingC(); return clamp(0.5 + ((k.mar || 10) - 10) * 0.025 + (a.moving ? -0.1 : 0.12) + (a.st === 'bay' || a.st === 'lie' ? 0.15 : 0) - d / 500, 0.2, 0.85); }
function huntWpnNext() { const HU = COURT.hunt; if (!HU || HU.ended) return; HU.wpn = HWPN_ORD[(HWPN_ORD.indexOf(HU.wpn) + 1) % 3]; G.court.huntWpn = HU.wpn; HU.aim = null; Snd.sfx('click');
  UI.toast({ bow: 'В руках лук: стрел — ' + HU.arrows + '. Бьёт далеко, шагов на 150.', jav: 'В руках сулицы: ' + HU.jav + ' шт. Бросок ближе лука, зато бьёт сильнее; промах можно подобрать.', pike: 'В руках рогатина: бить вплотную. Бросится кабан — стойте на месте и примите его на рогатину.' }[HU.wpn]); }
{ const cs0 = huntCanShoot; huntCanShoot = function (a, d, useF, L, P) { const HU = COURT.hunt, w = HU.wpn; if (useF || w === 'bow' || !w) return cs0(a, d, useF, L, P);
    if (a.st === 'fly' || a.h > 0) return false; if (w === 'jav') return HU.jav > 0 && d < HWPN.jav.rng && lineFree(L, P.x, P.y - 12, a.x, a.y - 6); return d < HWPN.pike.rng; }; }
function huntWhy(a, d, useF) { const HU = COURT.hunt, w = useF ? 'fal' : HU.wpn || 'bow';
  if (w === 'bow' && HU.arrows <= 0) return 'колчан пуст — возьмите сулицы или рогатину (Q)';
  if (w === 'jav' && HU.jav <= 0) return 'сулиц не осталось — подберите брошенные';
  if (w !== 'fal' && (a.st === 'fly' || a.h > 0)) return 'в полёте — ' + (w === 'bow' ? 'луком' : 'так') + ' не достать';
  if (d >= (w === 'fal' ? 210 : HWPN[w].rng)) return w === 'pike' ? 'рогатиной бьют вплотную — подойдите' : 'далеко — подойдите ближе (Shift — красться)';
  return 'мешают деревья'; }
{ const sw0 = stWord; stWord = a => a.st === 'lie' ? (gameOf(a).f ? 'залегла' : 'залёг') : sw0(a); }
{ const ht0 = huntTarget; huntTarget = function (t) { const r = ht0(t), a = t.a, HU = COURT.hunt, w = HU.wpn || 'bow', g = gameOf(a);
    const act = t.useF ? 'Пустить сокола' : w === 'pike' && a.st === 'charge' ? 'Принять на рогатину' : HWPN[w].act;
    r.label = act + ': ' + (a.hart ? 'белый олень' : g.n) + ' · ' + Math.round(wpnChance(a, t.d, t.useF) * 100) + '%'; if (a.hart) r.sub = 'пощадить или взять? · ' + r.sub; return r; }; }
function alarmNear(a, P) { for (const b of COURT.ani) if (b !== a && b.loc === 'forest' && b.game === 1 && b.st === 'graze' && Math.hypot(b.x - a.x, b.y - a.y) < 60) { b.fx = P.x; b.fy = P.y; if (gameOf(b).bird) birdUp(b, P); else { b.st = 'alert'; b.at = R.range(0.2, 0.6); } } }
{ const sh0 = huntShoot; huntShoot = function (a, useF) { const HU = COURT.hunt, P = COURT.p, w = HU && HU.wpn || 'bow';
    if (!HU || HU.ended || useF || w === 'bow') { const n = HU ? HU.fl.length : 0; sh0(a, useF); if (HU && HU.fl.length > n) { const f = HU.fl[HU.fl.length - 1]; if (f.hit) f.dmg = R.f() < lethalP(a, Math.hypot(a.x - P.x, a.y - P.y)) ? 2 : 1; } return; }
    if (NOW < (HU.cool || 0) || a.st === 'dead') return; const d = Math.hypot(a.x - P.x, a.y - P.y), dx = a.x - P.x, dy = a.y - P.y;
    P.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); COURT.path = null;
    if (w === 'jav') javThrow(a, d); else pikeStrike(a, false); }; }
function javThrow(a, d) { const HU = COURT.hunt, P = COURT.p; if (HU.jav <= 0) { UI.toast('Сулиц не осталось — подберите брошенные.'); return; }
  HU.jav--; HU.jshots++; HU.cool = NOW + 1.1; HU.thrT = NOW; Snd.sfx('swish');
  const hit = R.f() < javChance(a, d), ox = hit ? 0 : R.range(8, 16) * (R.f() < 0.5 ? -1 : 1), oy = hit ? 0 : R.range(-6, 6);
  HU.jf.push({ x0: P.x + (a.x > P.x ? 4 : -4), y0: P.y - 21, tx: a.x + ox, ty: a.y - 7 + oy, t: 0, dur: Math.max(0.18, d / 240), hit, a, dmg: R.f() < lethalP(a, d) + 0.15 ? 3 : 2 }); alarmNear(a, P); }
function huntWound(a, dmg, P) { a.hp -= dmg; if (a.hp <= 0) { huntKill(a, 'king'); return; } const g = gameOf(a); a.hurt = 1;
  if (g.fierce && Math.hypot(a.x - P.x, a.y - P.y) < 130 && R.chance(0.7)) gameCharge(a); else gameFlee(a, P); UI.toast('Попали! ' + (g.f ? 'Раненая ' : 'Раненый ') + g.n + ' ещё на ногах.'); }
function javUpd(HU, dt, P) { for (let i = HU.jf.length - 1; i >= 0; i--) { const f = HU.jf[i], a = f.a; f.t += dt; if (f.hit && a.st !== 'dead') { f.tx = a.x; f.ty = a.y - 7 - (a.h || 0); } if (f.t < f.dur) continue; HU.jf.splice(i, 1);
    if (f.hit && a.st !== 'dead') { HU.jhits++; Snd.sfx('hit'); huntWound(a, f.dmg, P); continue; }
    HU.sj.push({ x: f.tx, y: f.ty + 7, dx: f.tx - f.x0, dy: f.ty - f.y0 });
    if (a.st !== 'dead') { if (gameOf(a).bird) { if (a.st !== 'fly') birdUp(a, P); } else if (a.st !== 'charge' && a.st !== 'bay') gameFlee(a, P); }
    const hn = npcByKey('srv_hunter'); if (hn && R.chance(0.6)) say(hn, R.pick(['Мимо! Сулицу потом подберём.', 'Эх, в землю ушла…', 'Ближе, государь, ближе подпускайте!']), 2.5); }
  for (let i = HU.sj.length - 1; i >= 0; i--) { const s = HU.sj[i]; if (Math.hypot(s.x - P.x, s.y - P.y) < 12) { HU.sj.splice(i, 1); HU.jav++; Snd.sfx('click'); UI.toast('Сулица подобрана — их у вас ' + HU.jav + '.'); } } }
// the boar spear: a close stroke — or, against a charging beast, standing firm and taking it on the crossbar
function pikeStrike(a, recv) { const HU = COURT.hunt, P = COURT.p, g = gameOf(a), p = pikeChance(a) + (recv && !P.moving ? 0.1 : 0), hn = npcByKey('srv_hunter');
  HU.cool = NOW + 0.9; HU.thrT = NOW; HU.pk++; Snd.sfx('swish');
  if (R.f() < p) { HU.pkh++; Snd.sfx('hit'); a.pike = 1; a.hp = 0; huntKill(a, 'king'); if (hn) say(hn, g.fierce ? R.pick(['На рогатину! Вот это по-королевски!', 'Принял зверя, как деды принимали! Слава!']) : 'Чисто взяли, государь!', 3.5); return; }
  if (recv || a.st === 'charge') { huntGored(a); return; }
  if (g.fierce && R.chance(0.6)) gameCharge(a); else gameFlee(a, P); if (hn) say(hn, R.pick(['Соскользнула! Берегитесь!', 'Увернулся, зверюга!']), 2.5); }
// ---------- wounded game: it bleeds, tires and lies up in cover; the hounds follow the blood ----------
function bleed(a, HU, big) { if (big || a._bx === undefined || Math.hypot(a.x - a._bx, a.y - a._by) > 7) { a._bx = a.x; a._by = a.y; HU.blood.push({ x: a.x + R.range(-2, 2), y: a.y + R.range(-1, 1), t: NOW, r: R.f(), big: big ? 1 : 0 }); if (HU.blood.length > 260) HU.blood.shift(); } }
function lieDown(a, HU) { a.st = 'lie'; a.moving = 0; a.zig = 0; a.pth = null; const hn = npcByKey('srv_hunter'), g = gameOf(a);
  if (hn && !HU.lieSaid) { HU.lieSaid = 1; say(hn, g.fierce ? 'Подранок залёг, государь. Раненый ' + g.n + ' — самый опасный зверь: берите рогатину (Q).' : (g.f ? 'Залегла раненая ' : 'Залёг раненый ') + g.n + '! Пойдём по крови — тихо, с Shift.', 4.5); } }
function lieUpd(a, L, P, HU, kd, g) { let hd = 1e9; for (const h of COURT.ani) if (h.game === 2 && h.loc === 'forest') hd = Math.min(hd, Math.hypot(h.x - a.x, h.y - a.y));
  if (hd < 18) { a.st = 'bay'; a.bt = R.range(6.5, 9); houndBark(HU); const hn = npcByKey('srv_hunter'); if (hn) say(hn, 'Подняли подранка! Держат — ' + dirWord(a.x - P.x, a.y - P.y) + '!', 3.5); return; }
  if (COURT.loc === 'forest' && kd < g.det * (COURT.sneak ? 0.3 : 0.45) * windMul(a, P)) { a.flip = P.x > a.x; if (g.fierce && kd < 60) gameCharge(a); else gameFlee(a, P); } }
{ const gu0 = gameUpd; gameUpd = function (a, dt, L, P, HU) {
    if (!HU || HU.ended || a.st === 'dead' || a.st === 'fly') { gu0(a, dt, L, P, HU); return; }
    const kd = Math.hypot(a.x - P.x, a.y - P.y), g = gameOf(a);
    if (a.st === 'charge' && HU.wpn === 'pike' && !a.recv && kd < 20 && COURT.loc === 'forest') { a.recv = 1; pikeStrike(a, true); return; }
    if (a.st === 'lie') { a.moving = 0; lieUpd(a, L, P, HU, kd, g); return; }
    const st0 = a.st; gu0(a, dt, L, P, HU); if (!a.hurt || a.st === 'dead') return;
    if (!a.hs) { a.hs = 1; bleed(a, HU, 1); const hn = npcByKey('srv_hunter'); if (hn && !HU.bloodSaid) { HU.bloodSaid = 1; say(hn, 'Есть кровь! Подранок далеко не уйдёт — гончие найдут по следу.', 4); } }
    if (a.moving) bleed(a, HU, 0);
    if ((a.st === 'graze' && st0 !== 'graze') || (a.st === 'flee' && a.ft > 10)) lieDown(a, HU); }; }
{ const hs0 = huntScent; huntScent = function (h, L, HU) { let best = null, bd = 520;
    for (const a of COURT.ani) if (a.loc === 'forest' && a.game === 1 && a.hurt && a.st !== 'dead' && NOW >= (a.free || 0)) { const d = Math.hypot(a.x - h.x, a.y - h.y); if (d < bd) { bd = d; best = a; } }
    return best || hs0(h, L, HU); }; }
{ const hh0 = huntHint; huntHint = function () { const HU = COURT.hunt, P = COURT.p; if (!HU) return hh0(); let w = null, wd = 1e9;
    for (const a of COURT.ani) if (a.loc === 'forest' && a.game === 1 && a.hurt && a.st !== 'dead') { const d = Math.hypot(a.x - P.x, a.y - P.y); if (d < wd) { wd = d; w = a; } }
    if (w) { const g = gameOf(w); return (w.st === 'lie' ? (g.f ? 'Залегла раненая ' : 'Залёг раненый ') + g.n : 'Кровь на траве, государь: ' + (g.f ? 'раненая ' : 'раненый ') + g.n + ' уходит') + ' — ' + dirWord(w.x - P.x, w.y - P.y) + (wd < 170 ? ', совсем рядом' : '') + '.' + (w.st === 'lie' && g.fierce ? ' Берите рогатину.' : ''); }
    const s = hh0(); return R.chance(0.3) ? s + ' ' + windTip() : s; }; }
// ---------- trophies: the points of a stag's head, the weight of a boar or a bear; the white hart ----------
{ const hk0 = huntKill; huntKill = function (a, by) { const HU = COURT.hunt, n = HU ? HU.bag.length : 0; hk0(a, by); if (!HU || HU.bag.length <= n) return; const b = HU.bag[HU.bag.length - 1], x = [];
    if (a.hart) { b.hart = 1; x.push('белый олень'); }
    if (a.kind === 'deer' && a.col !== 'doe') { b.pts = faPts(a); x.push('рога в ' + tines(b.pts)); }
    if (a.kind === 'boar') { b.wt = a.wt || (a.wt = R.i(4, 9)); x.push((b.wt >= 7 ? 'матёрый секач, ' : '') + poods(b.wt)); }
    if (a.kind === 'bear') { b.wt = a.wt || (a.wt = R.i(10, 18)); x.push(poods(b.wt)); }
    if (a.pike) { b.pike = 1; x.push('взят на рогатину'); }
    if (x.length) UI.toast(UI.toastS + ' ' + ucf(x.join(', ')) + '.'); }; }
{ const hf0 = huntFauna; huntFauna = function (kind) { hf0(kind); const HU = COURT.hunt; if (kind !== 'deer' || !HU || !(COURT.hartF || R.chance(0.1))) return; const sp = LOCS.forest.spots.f_gate; let best = null, bd = 0;
    for (const a of COURT.ani) if (a.loc === 'forest' && a.game === 1 && a.kind === 'deer' && !a.col) { const d = Math.hypot(a.x - sp.x, a.y - sp.y); if (d > bd) { bd = d; best = a; } }
    if (best) { best.col = 'hart'; best.hart = 1; best.pts = R.pick([12, 14, 16]); HU.hart = best; } }; }
{ const st0 = huntStart; huntStart = function (kind, comp) { st0(kind, comp); const HU = COURT.hunt; if (HU && HU.wpn === undefined) Object.assign(HU, { wpn: G.court.huntWpn || 'bow', jav: 4, jf: [], sj: [], blood: [], jshots: 0, jhits: 0, pk: 0, pkh: 0, windT: NOW + 9 }); }; }
function unrestAll(v) { for (const P of G.provs) if (G.setts[WD.provs[P.id].seat].owner === 0) P.unrest = clamp(P.unrest + v, 0, 100); }
// called by huntSummary: trophies and records, spear glory, the white hart
function huntSum2(HU, T) { const C = G.court, bag = HU.bag, rec = C.huntRec = C.huntRec || {}, best = { deer: 0, boar: 0, bear: 0 }; let pr = 0;
  for (const b of bag) if (b.by === 'king') { if (b.k === 'deer' && b.pts > best.deer) best.deer = b.pts; if ((b.k === 'boar' || b.k === 'bear') && b.wt > best[b.k]) best[b.k] = b.wt; }
  for (const key of ['deer', 'boar', 'bear']) { const v = best[key]; if (!v) continue; const s = key === 'deer' ? 'олень, рога в ' + tines(v) : (key === 'boar' ? 'секач в ' : 'медведь в ') + poods(v);
    if (!rec[key]) { rec[key] = v; T.push('Трофей: ' + s + ' — ловчий записал его в книгу двора.'); }
    else if (v > rec[key]) { T.push('Трофей: ' + s + ' — новый рекорд двора (было ' + rec[key] + ')! Престиж +1.'); rec[key] = v; pr++; }
    else T.push('Трофей: ' + s + ' (рекорд двора — ' + rec[key] + ').'); }
  const pk = Math.min(2, bag.filter(b => b.pike && GAME[b.k].fierce).length); if (pk) { pr += pk; T.push((pk > 1 ? 'Звери взяты' : 'Зверь взят') + ' на рогатину — о такой охоте споют менестрели: престиж +' + pk + '.'); }
  if (HU.hart) { const hb = bag.find(b => b.hart);
    if (hb && hb.by === 'king') { pr += 3; unrestAll(2); T.push('Белый олень пал от вашей руки. Слава громкая — престиж +3, — но старики качают головами: не к добру.'); }
    else if (hb) { unrestAll(2); T.push('Гончие взяли белого оленя… Ловчий хмур: не к добру.'); }
    else if (HU.hartSeen) { pr += 1; unrestAll(-4); T.push('Белого оленя вы пощадили — добрый знак. Молва о милостивом короле разойдётся по округе: престиж +1, в провинциях спокойнее.'); } }
  if (pr) prestige(pr);
  if (HU.jshots) T.push('Сулиц метнуто: ' + HU.jshots + ', в цель: ' + HU.jhits + '.'); }
// ---------- hooks: Q, the per-frame update ----------
CKEY_EXT.push(c => { if (c !== 'KeyQ' || !COURT.hunt || COURT.hunt.ended || COURT.loc !== 'forest') return false; huntWpnNext(); return true; });
UPD_EXT.push(dt => { const HU = COURT.hunt; if (G.visit || !HU || HU.ended || COURT.loc !== 'forest' || !HU.jf) return; const P = COURT.p, L = LOCS.forest, hn = npcByKey('srv_hunter');
  javUpd(HU, dt, P);
  if (HU.windT && NOW > HU.windT) { HU.windT = 0; if (hn) say(hn, windTip(), 4.5); }
  const h = HU.hart; if (h && !HU.hartSeen && h.st !== 'dead' && Math.hypot(h.x - P.x, h.y - P.y) < 170 && lineFree(L, P.x, P.y - 10, h.x, h.y - 10)) { HU.hartSeen = 1; UI.toast('Белый олень! Пощадить — к удаче, взять — к славе.');
    if (hn) say(hn, 'Государь… белый олень! Старики говорят: кто его пощадит — тому удача, а кто возьмёт — тому слава.', 6); }
  if (HU.blood.length && NOW - HU.blood[0].t > 240) HU.blood.shift(); });
// ---------- drawing: blood, javelins, the weapon in the king's hands; the HUD panel ----------
function pxLine(g, c, x0, y0, x1, y1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); g.fillStyle = c; for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1); }
function drawJav(g, x, y, ux, uy, n) { pxLine(g, '#8a6638', x - ux * n, y - uy * n, x - ux * 2, y - uy * 2); pxLine(g, '#d8dee6', x - ux * 2, y - uy * 2, x, y); }
CRENDER.push((g, L) => { const HU = COURT.hunt; if (L.id !== 'forest' || !HU || !HU.blood) return;
  for (const b of HU.blood) { g.globalAlpha = clamp(1 - (NOW - b.t) / 300, 0.45, 0.95); g.fillStyle = b.r < 0.5 ? '#7a1010' : '#9a1c1c'; const x = Math.round(b.x), y = Math.round(b.y);
    if (b.big) { g.fillRect(x - 2, y, 4, 1); g.fillRect(x - 1, y - 1, 2, 1); g.fillRect(x + 3, y - 1, 1, 1); g.fillRect(x - 4, y + 1, 1, 1); } else { g.fillRect(x, y, 1, 1); if (b.r > 0.6) g.fillRect(x + 1, y + (b.r > 0.8 ? 1 : 0), 1, 1); } }
  g.globalAlpha = 1; });
CRENDER2.push((g, L) => { const HU = COURT.hunt, P = COURT.p; if (L.id !== 'forest' || !HU || !HU.jf || !P) return;
  for (const s of HU.sj) { const d = Math.hypot(s.dx, s.dy) || 1, ux = s.dx / d * 0.6, x = Math.round(s.x), y = Math.round(s.y); drawJav(g, x + ux * 2, y + 1, ux, -0.8, 10); if (Math.sin(NOW * 4 + s.x) > 0.85) { g.fillStyle = '#fff6c0'; g.fillRect(x - Math.round(ux * 8), y - 8, 1, 1); } }
  for (const f of HU.jf) { const k = Math.min(1, f.t / f.dur), dd = Math.hypot(f.tx - f.x0, f.ty - f.y0) || 1, arc = Math.sin(Math.PI * k) * Math.min(18, dd * 0.12), x = f.x0 + (f.tx - f.x0) * k, y = f.y0 + (f.ty - f.y0) * k - arc;
    const vy = (f.ty - f.y0) / dd - Math.cos(Math.PI * k) * 0.45, vx = (f.tx - f.x0) / dd, vn = Math.hypot(vx, vy) || 1; drawJav(g, x, y, vx / vn, vy / vn, 10); }
  if (COURT.loc === 'forest' && !P.sit && !P.lie) drawHeld(g, P, HU); });
// the weapon in the king's hands (his sprite is 16×31: a big head down to y−17, the hands at the sides near y−11)
function drawHeld(g, P, HU) { const w = HU.wpn, x = Math.round(P.x), y = Math.round(P.y), d = P.dir, side = d === 'left' || d === 'right', s = d === 'left' ? -1 : 1, th = HU.thrT && NOW - HU.thrT < 0.35 ? 1 - (NOW - HU.thrT) / 0.35 : 0;
  const bx = d === 'up' ? x - 9 : x + s * 8, R1 = (c, x0, y0, w0, h0) => { g.fillStyle = c; g.fillRect(x0, y0, w0, h0); };
  if (w === 'bow') { if (HU.bowT && NOW - HU.bowT < 0.3) return;
    if (d === 'up') { pxLine(g, '#5a3818', x - 5, y - 21, x + 5, y - 7); pxLine(g, '#b8b098', x - 4, y - 21, x + 6, y - 8); return; }   // slung across the back
    for (let i = -6; i <= 6; i++) R1(i * i > 25 ? '#5a3818' : '#6e4422', bx + s * Math.round(2 * (1 - i * i / 36)), y - 12 + i, 1, 1); pxLine(g, '#c8c0a8', bx, y - 17, bx, y - 7); return; }
  if (w === 'jav') { if (th > 0.3 || HU.jav <= 0) return; pxLine(g, '#8a6638', bx, y - 2, bx, y - 25); R1('#d8dee6', bx, y - 29, 1, 4); R1('#b8c0c8', bx - 1, y - 27, 3, 1); return; }
  if (side) { const push = Math.round(th * 5), X = dx => x + s * (dx + push); pxLine(g, '#6e4a26', X(-5), y - 15, X(12), y - 9); pxLine(g, '#3a2a1a', X(12), y - 12, X(12), y - 6);
    R1('#c0c8d0', Math.min(X(13), X(15)), y - 10, 3, 3); R1('#eef2f6', Math.min(X(16), X(17)), y - 9, 2, 1); return; }
  pxLine(g, '#6e4a26', bx, y - 1, bx, y - 27); pxLine(g, '#3a2a1a', bx - 2, y - 27, bx + 2, y - 27); R1('#c0c8d0', bx - 1, y - 32, 3, 5); R1('#eef2f6', bx, y - 34, 1, 2); }
function huntPanel(HU) { if (!HU.jf) return; const fal = HU.kind === 'falcon' ? '  ·  сокол: ' + (HU.fal ? 'в полёте' : 'на перчатке') : '';
  const t1 = HUNTK[HU.kind].n + fal + '  ·  до 19:30', t3 = ucf(windWord()) + ' →', t4 = HU.bag.length ? 'Добыча: ' + bagStr(HU.bag) : 'Добычи пока нет';
  const ws = [['bow', 'лук: ' + HU.arrows], ['jav', 'сулицы: ' + HU.jav], ['pike', 'рогатина']], sep = '   ', ww = ws.reduce((s, [, t]) => s + tw(t, { f: 's' }), 0) + tw(sep, { f: 's' }) * 2 + tw('Q  ', { f: 's' });
  const w = Math.max(tw(t1, { f: 's' }), tw(t3, { f: 's' }), tw(t4, { f: 's' }), ww) + 12, x = W - w - 6, y = 22, h = 39;
  rect(x, y, w, h, 'rgba(20,14,12,0.84)'); strokeR(x, y, w, h, '#8a6a3a'); txt(t1, x + 6, y + 3, '#e8d5a8', { f: 's' });
  let cx = x + 6; txt('Q', cx, y + 12, '#8aa8c8', { f: 's' }); cx += tw('Q  ', { f: 's' });
  for (const [k, t] of ws) { const on = HU.wpn === k; txt(t, cx, y + 12, on ? '#f7d35c' : '#8a7a62', { f: 's' }); if (on) rect(cx, y + 20, tw(t, { f: 's' }), 1, '#f7d35c'); cx += tw(t + sep, { f: 's' }); }
  txt(t3, x + 6, y + 21, '#a8c8d8', { f: 's' }); txt(t4, x + 6, y + 30, HU.bag.length ? '#c8e8a0' : '#a89878', { f: 's' });
  hit(x, y, w, 10, { id: 'hpanel', cursor: true, tip: ['Королевская охота', 'E или клик по зверю — выстрел, бросок или удар. Стоящего зверя бить легче, бегущего — труднее; лучше всего — когда гончие его держат.', 'Shift — красться: зверь подпустит ближе, а гончие пойдут у ноги.', 'Отбой — через ворота леса или у ловчего.'], onClick: () => { const n = npcByKey('srv_hunter'); if (n && !DLG.open()) huntHunterTalk(n); } });
  hit(x, y + 10, w, 10, { id: 'hwpn', cursor: true, tip: ['Оружие (Q — сменить)', 'Лук — шагов на 150, стрел 15. Меткий выстрел валит сразу, иначе зверь уходит подранком.', 'Сулицы — 4 метательных копья: шагов на 85, бьют сильнее. Промахнулись — подберите.', 'Рогатина — вплотную. Бросится кабан или медведь — стойте и примите его на рогатину: слава, но и риск.'], onClick: () => huntWpnNext() });
  hit(x, y + 20, w, 19, { id: 'hwind', tip: ['Ветер', 'Ветер несёт ваш запах на восток: зверь с подветренной стороны учует издалека. Заходите с востока — подпустит ближе.', 'Подранок оставляет кровь на траве; устав, он залегает. Гончие найдут его по следу.'] });
  if (COURT.loc === 'forest' && !DLG.open()) { const s = 'E / клик по зверю — ' + (HU.kind === 'falcon' ? 'сокол или ' : '') + HWPN[HU.wpn].act.toLowerCase() + '  ·  Q — оружие  ·  Shift — красться  ·  ворота леса — домой', w2 = tw(s, { f: 's' }) + 10; rect(8, H - 14, w2, 11, 'rgba(20,14,12,0.8)'); txt(s, 13, H - 11, '#c8d8e8', { f: 's' }); } }
