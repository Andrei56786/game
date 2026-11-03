'use strict';
// ===== HUNT 3 (v3.6): one's own bow — hold the button to draw, aim with the mouse, let go to loose; arrows fly, miss, stick in trees and are picked up;
//   tougher game (a boar takes several arrows, a bear a quiverful); boars and bears charge when one comes near; the new clearings of the big forest;
//   splitting up — the huntsman takes the hounds, raises the beast and blows his horn; the companion's bow and its stray arrow; a stag at bay, a fall in the chase =====
// COURT.hunt adds: draw { t0, w } — the bow being drawn; ar — arrows and javelins in flight; sa — arrows in the ground or in a tree; split { st, ci, t, tried, hornT, hornAt };
//   t0 — when the hunt began; cShot — when the companion may shoot next
// G.court.huntAuto — 1: the huntsman's aim (E or a click, the chance shown, as before v3.6); otherwise one's own bow
GAME.deer.hp = 2; GAME.doe.hp = 1.5; GAME.boar.hp = 4; GAME.bear.hp = 7; GAME.wolf.hp = 2;
HUNTK.deer.d = 'Гончие поднимут оленя и погонят его. Стреляйте, когда собаки остановят зверя, — но вплотную к оленю у бая не подходите: бьёт рогами.';
HUNTK.boar.d = 'Кабан бросается, если подойти близко, а раненый — почти всегда. Нужно несколько стрел или рогатина. Опасно — зато какая слава!';
// draw time to full, range at no draw / added at full, speed, spread factor
const HBOW = { bow: { tf: 0.75, r0: 70, r1: 190, v0: 240, v1: 260, sp: 1 }, jav: { tf: 0.5, r0: 45, r1: 85, v0: 170, v1: 110, sp: 1.3 } };
const GACC = { doe: 'лань', fox: 'лису', duck: 'утку' }, gAcc = k => GACC[k] || GAME[k].n2;
function huntOwn(HU) { HU = HU || COURT.hunt; return !!HU && !HU.ended && !(G.court && G.court.huntAuto) && (HU.wpn === 'bow' || HU.wpn === 'jav'); }
function drawK(D) { return D ? clamp((NOW - D.t0) / HBOW[D.w].tf, 0, 1) : 0; }
// the spread (radians either side): the king's hand, how far the string is drawn, walking, a wound, age — and the arm tiring if he holds too long
function aimSpread(D) { const k = kingC(), P = COURT.p, k1 = drawK(D), held = NOW - D.t0 - HBOW[D.w].tf - 1.6;
  let s = (0.1 - ((k.mar || 10) - 10) * 0.004) * (1.7 - 0.7 * k1) * HBOW[D.w].sp;
  if (P.moving) s += COURT.sneak ? 0.04 : 0.08; if (k.wound > G.day) s += 0.04; if (k.age > 55) s += 0.02; if (held > 0) s += Math.min(0.14, held * 0.06);
  return clamp(s, 0.03, 0.4); }
function aimPt() { const P = COURT.p; if (input.mx < 0 || input.my < 0) { const v = DIRV[P.dir] || [1, 0]; return [P.x + v[0] * 120, P.y - 14 + v[1] * 120]; } return [COURT.cam.x + input.mx / COURT.Z, COURT.cam.y + input.my / COURT.Z]; }
function faceTo(o, dx, dy) { o.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
function drawStart(HU) { const w = HU.wpn; if (HU.draw || NOW < (HU.cool || 0) || COURT.p.downT > NOW) return;
  if (w === 'bow' && HU.arrows <= 0) { UI.toast('Колчан пуст — подберите стрелы, что легли мимо, или возьмите сулицы (Q).'); HU.cool = NOW + 1; return; }
  if (w === 'jav' && HU.jav <= 0) { UI.toast('Сулиц не осталось — подберите брошенные.'); HU.cool = NOW + 1; return; }
  HU.draw = { t0: NOW, w }; COURT.path = null; COURT.onArrive = null; if (w === 'bow') Snd.sfx('draw'); }
function drawLoose(HU, cancel) { const D = HU.draw; if (!D) return; HU.draw = null; HU.drawEnd = NOW; const k1 = drawK(D);
  if (cancel || k1 < 0.25) { if (!cancel) UI.toast(D.w === 'bow' ? 'Тетива едва натянута — держите кнопку дольше.' : 'Замах слишком слабый — держите кнопку дольше.'); return; }
  const P = COURT.p, [ax, ay] = aimPt(), ox = P.x, oy = P.y - 14, an = Math.atan2(ay - oy, ax - ox) + (R.f() + R.f() - 1) * aimSpread(D);
  faceTo(P, ax - ox, ay - oy); launch(HU, { x: ox, y: oy, an, k: k1, w: D.w, by: 'king' }); }
function launch(HU, o) { const B = HBOW[o.w];
  HU.ar.push({ x: o.x, y: o.y, x0: o.x, y0: o.y, ux: Math.cos(o.an), uy: Math.sin(o.an), sp: B.v0 + B.v1 * o.k, s: 0, max: B.r0 + B.r1 * o.k, w: o.w, k: o.k, by: o.by, who: o.who || null, near: 0, whz: 0 });
  if (o.by !== 'king') { Snd.sfx('bow'); return; }
  HU.cool = NOW + (o.w === 'bow' ? 0.4 : 0.8);
  if (o.w === 'bow') { HU.arrows--; HU.shots++; HU.bowT = NOW; Snd.sfx('bow'); } else { HU.jav--; HU.jshots++; HU.thrT = NOW; Snd.sfx('swish'); } }
// ---------- flight: step by step — game, people, trees; the arrow sinks from the shoulder to the ground over its range ----------
function aBox(a) { const s = animalSprite(a.kind, 0, a.flip, a.col || null), hw = s.width * 0.42, h = a.h || 0; return [a.x - hw, a.y - h - s.height + 2, a.x + hw, a.y - h]; }
// behind the foreleg, a little low: the heart and lungs
function vital(a, b, x, y) { if (gameOf(a).bird) return true; const w = b[2] - b[0], h = b[3] - b[1], cx = (b[0] + b[2]) / 2 + (a.flip ? 1 : -1) * w * 0.12; return Math.abs(x - cx) < w * 0.2 && y > b[1] + h * 0.3 && y < b[1] + h * 0.85; }
function arUpd(HU, dt, L, P) { for (let i = HU.ar.length - 1; i >= 0; i--) { const f = HU.ar[i]; let st = f.sp * dt;
    while (st > 0 && !f.done) { const d = Math.min(3, st); st -= d; f.x += f.ux * d; f.y += f.uy * d; f.s += d; arStep(f, HU, L, P); }
    if (f.done) HU.ar.splice(i, 1); } }
function arStep(f, HU, L, P) {
  for (const a of COURT.ani) { if (a.loc !== 'forest' || a.game !== 1 || a.st === 'dead') continue; const b = aBox(a);
    if (f.x >= b[0] && f.x <= b[2] && f.y >= b[1] && f.y <= b[3]) { f.done = 1; arHit(f, a, b, HU, P); return; }
    if ((a.st === 'graze' || a.st === 'alert') && f.x > b[0] - 16 && f.x < b[2] + 16 && f.y > b[1] - 12 && f.y < b[3] + 10) { if (gameOf(a).bird) birdUp(a, { x: f.x0, y: f.y0 }); else gameFlee(a, { x: f.x0, y: f.y0 }); } }   // the whistle of a near miss
  if (f.s > 12) {
    if (f.by !== 'king' && Math.abs(f.x - P.x) < 5 && f.y > P.y - 27 && f.y < P.y - 3 && !(P.downT > NOW)) { f.done = 1; strayHit(f, HU, P); return; }
    if (f.by === 'king' && !f.near) for (const n of COURT.npcs) if (n.follow && n.loc === 'forest' && Math.abs(f.x - n.x) < 6 && f.y > n.y - 27 && f.y < n.y - 2) { f.near = 1; nearMiss(n); break; } }
  const h = 14 * (1 - f.s / f.max), tx = Math.floor(f.x / CT), ty = Math.floor((f.y + h) / CT);
  if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) { f.done = 1; return; }
  const ti = ty * L.w + tx, wet = L.ter[ti] === GT.WATER;
  if (L.solid[ti] && !wet && f.s > 8) { f.done = 1; arStick(f, HU, h, 1); return; }
  if (f.s >= f.max) { f.done = 1; if (wet) { for (let i = 0; i < 5; i++) COURT.parts.push({ k: 'dust', x: f.x + R.range(-2, 2), y: f.y, vx: R.range(-8, 8), vy: -10, t: 0, life: 0.4 }); Snd.sfx('swish'); } else arStick(f, HU, 0, 0); } }
// vital if the arrow's line, carried on through the body, crosses the heart and lungs — not just where it first touched the box
function vitalRay(a, b, f) { for (let i = 0, x = f.x, y = f.y; i < 60 && x >= b[0] - 1 && x <= b[2] + 1 && y >= b[1] - 1 && y <= b[3] + 1; i++, x += f.ux, y += f.uy) if (vital(a, b, x, y)) return true; return false; }
function arHit(f, a, b, HU, P) { const g = gameOf(a), vit = f.ux === undefined ? vital(a, b, f.x, f.y) : vitalRay(a, b, f), base = f.w === 'jav' ? 2 : f.k >= 0.85 ? 1 : f.k >= 0.55 ? 0.75 : 0.5, dmg = base * (vit ? 2 : 1);
  Snd.sfx('hit'); if (f.w === 'bow') a.arw = Math.min(4, (a.arw || 0) + 1); else a.jv = (a.jv || 0) + 1;
  if (f.by !== 'king') { a.hp -= dmg; const cn = f.who && npcByKey(f.who);
    if (a.hp <= 0) { huntKill(a, 'comp'); if (cn) say(cn, R.pick(['Есть! Видели, государь?', 'Попал! Попал!', 'Вот это выстрел!']), 3); return; }
    a.hurt = 1; if (g.fierce && cn && Math.hypot(a.x - cn.x, a.y - cn.y) < 110 && R.chance(0.5)) gameCharge(a); else gameFlee(a, { x: f.x0, y: f.y0 }); return; }
  if (f.w === 'bow') HU.hits++; else HU.jhits++;
  huntWound(a, dmg, P);
  if (a.st === 'dead') return;
  if (vit) UI.toast('Под лопатку! ' + (g.f ? 'Раненая ' : 'Раненый ') + g.n + ' ещё на ногах — но далеко не уйдёт.');
  else if (base < 1 && f.w === 'bow') UI.toast('Тетива была натянута вполсилы — стрела вошла неглубоко.');
  else if (a.hp > 0 && g.hp >= 4 && !HU.toughSaid) { HU.toughSaid = 1; const hn = npcByKey('srv_hunter'); if (hn) say(hn, 'Шкура толстая, государь: одной стрелой ' + gAcc(gk(a)) + ' не взять. Бейте под лопатку!', 4); } }
function arStick(f, HU, h, tree) { const gx = f.x, gy = f.y + h;
  if (f.w === 'jav') HU.sj.push({ x: gx, y: gy, dx: f.ux, dy: f.uy }); else { HU.sa.push({ x: gx, y: gy, h, ux: f.ux, uy: f.uy, tree, t: NOW }); if (HU.sa.length > 40) HU.sa.shift(); }
  if (tree) Snd.sfx('stick');
  for (const b of COURT.ani) if (b.loc === 'forest' && b.game === 1 && b.st === 'graze' && Math.hypot(b.x - gx, b.y - gy) < 50) { b.fx = f.x0; b.fy = f.y0; if (gameOf(b).bird) birdUp(b, { x: f.x0, y: f.y0 }); else { b.st = 'alert'; b.at = R.range(0.3, 0.8); b.flip = f.x0 > b.x; } }
  const hn = npcByKey('srv_hunter'); if (f.by === 'king' && hn && !hn.bub && !HU.split && R.chance(0.35)) say(hn, R.pick(['Мимо, государь!', 'Ушла стрела… Подберём потом.', tree ? 'В дерево! Стреляйте, где чисто.' : 'Ниже бери, государь, — стрела над спиной прошла.', 'Ведите стрелу перед зверем, коли бежит.']), 2.4); }
function nearMiss(n) { if (n.key === 'srv_hunter') say(n, R.pick(['Государь! Я же не олень!', 'Эй! Своих не бейте!']), 2.5); else say(n, R.pick(['Ах! Осторожнее, государь!', 'Стрела у самого уха!']), 2.5); UI.toast('Стрела свистнула над головой спутника. Осторожнее!'); }
function pickUp(HU, P) { for (let i = HU.sa.length - 1; i >= 0; i--) { const s = HU.sa[i]; if (Math.hypot(s.x - P.x, s.y - P.y) > 12) continue; HU.sa.splice(i, 1);
    if (R.chance(0.78)) { HU.arrows++; Snd.sfx('click'); UI.toast('Стрела подобрана — в колчане ' + HU.arrows + '.'); } else UI.toast(s.tree ? 'Наконечник засел в стволе — стрелу не вытащить.' : 'Стрела сломалась.'); } }
// ---------- the companion's bow: helps against a fleeing, charging or bayed beast — and, now and then, shoots when he should not ----------
function compShoot(HU, L, P) { const cn = HU.comp && npcByKey(HU.comp); if (!cn || !cn.c || cn.loc !== 'forest' || (cn.c.age || 30) < 14 || NOW < (HU.cShot || 0) || P.downT > NOW) return;
  HU.cShot = NOW + R.range(1.5, 3); let best = null, bd = 140;
  for (const a of COURT.ani) { if (a.loc !== 'forest' || a.game !== 1 || a.st === 'dead' || gameOf(a).bird || !['flee', 'bay', 'charge', 'lie'].includes(a.st)) continue; const d = Math.hypot(a.x - cn.x, a.y - cn.y); if (d < bd && d > 24 && lineFree(L, cn.x, cn.y - 10, a.x, a.y - 6)) { bd = d; best = a; } }
  if (!best || !R.chance(0.45)) return;
  const ox = cn.x, oy = cn.y - 14, an = Math.atan2(best.y - 8 - oy, best.x - ox), ux = Math.cos(an), uy = Math.sin(an), kx = P.x - ox, ky = P.y - 14 - oy, along = kx * ux + ky * uy, perp = Math.abs(-kx * uy + ky * ux);
  if (along > 0 && along < bd + 30 && perp < 14) { const eager = (HU.split ? 0.16 : 0.08) * ((cn.c.loy || 50) < 35 ? 2 : 1); if (!R.chance(eager)) { if (R.chance(0.3)) say(cn, 'Отойдите, государь, — не выстрелить!', 2); return; } }
  const sp = clamp(0.13 - ((cn.c.mar || 8) - 10) * 0.006, 0.05, 0.2); faceTo(cn, ux, uy);
  launch(HU, { x: ox, y: oy, an: an + (R.f() + R.f() - 1) * sp, k: 0.9, w: 'bow', by: 'comp', who: cn.key }); HU.cShot = NOW + R.range(6, 11); HU.cs = (HU.cs || 0) + 1; }
// ---------- accidents: a stray arrow, a stag at bay, a fall in the chase (the beasts' charge lives in hurt.js) ----------
function huntMishap(sev, part, by, t1, t2) { const HU = COURT.hunt, P = COURT.p; if (!HU || HU.ended) return; const days = woundKing(sev, part, by);
  P.downT = NOW + (sev === 1 ? 1.4 : 2.4); P.moving = 0; COURT.path = null; COURT.onArrive = null; COURT.flash = NOW; Snd.sfx('thud'); HU.hurtN = (HU.hurtN || 0) + 1; HU.draw = null;
  const hn = npcByKey('srv_hunter'); if (hn && !HU.split) say(hn, sev === 1 ? 'Цел, государь? Вставайте!' : 'Государь ранен! Сюда, живо!', 3);
  if (sev === 1) { UI.toast(t1); return; }
  HU.wound = days; if (G.speed > 0) UI.lastSpeed = G.speed;
  HEAL.pend = { t: NOW + 2.2, f: () => DLG.say(null, t2 + (sev === 3 ? ' Рана тяжёлая: лекарь ничего не обещает.' : ' Заживёт — дней за ' + days + '.'), { name: 'Беда на охоте', choices: [{ t: 'Домой, на носилках', fx: () => huntEnd('wound') }], esc: 0 }) }; }
function strayHit(f, HU, P) { const k = kingC(), cn = f.who && npcByKey(f.who), nm = cn && cn.c ? cn.c.name : 'Кто-то из свиты', fe = cn && cn.c && cn.c.fem ? 'а' : '', r = R.f() + (k.age > 50 ? 0.05 : 0), sev = r < 0.45 ? 1 : r < 0.88 ? 2 : 3;
  const part = sev === 3 ? R.pick(['грудь', 'бок']) : R.pick(['плечо', 'руку', 'бедро']); if (sev === 3) k.woundFv = 0.6; Snd.sfx('hit');
  huntMishap(sev, part, 'шальная стрела', 'Стрела бьёт в рукав и застревает в сукне! ' + nm + ' бледнеет: «Простите, государь, я метил' + fe + ' в зверя!»',
    'Шальная стрела! ' + nm + ' стрелял' + fe + ' в зверя — и попал' + fe + ' в вас: наконечник вошёл в ' + part + '.');
  if (cn && cn.c && !cn.c.pseudo) { cn.c.loy = clamp((cn.c.loy || 50) + (sev > 1 ? 6 : 2), 0, 100); say(cn, sev > 1 ? 'Государь! Нет, нет… Лекаря!' : 'Простите, государь! Сам' + (fe ? 'а' : '') + ' не знаю, как…', 3); } }
function stagLunge(a, HU, P) { const k = kingC(), r = R.f() + (k.age > 50 ? 0.1 : 0), sev = r < 0.55 ? 1 : r < 0.93 ? 2 : 3, part = sev === 3 ? 'живот' : R.pick(['бок', 'бедро', 'руку']);
  a.flip = P.x > a.x; Snd.sfx('growl');
  huntMishap(sev, part, 'олень', 'Олень бьёт рогами — вы отлетаете в траву. Ушиб, не более.', 'Прижатый гончими олень бросается на вас: рога поддевают за пояс и швыряют наземь — отросток вспарывает ' + part + '.'); }
function chaseFall(HU, P) { const k = kingC(), r = R.f() + (k.age > 50 ? 0.05 : 0), sev = r < 0.8 ? 1 : r < 0.97 ? 2 : 3, part = sev === 3 ? 'голову' : R.pick(['колено', 'лоб', 'локоть']);
  huntMishap(sev, part, 'падение', 'В погоне вы спотыкаетесь о корень и летите в папоротник. Ушиб.', sev === 3 ? 'В погоне вы срываетесь в овраг и бьётесь головой о корень. Ловчие приводят вас в чувство не сразу.' : 'В погоне вы срываетесь в овраг и рассекаете ' + part + ' о камни.'); }
// ---------- splitting up: the huntsman goes ahead with the hounds, raises the beast and blows his horn ----------
function splitPick(HU, L, P, skip) { const want = HU.kind === 'boar' ? ['boar', 'bear'] : HU.kind === 'deer' ? ['deer', 'doe'] : ['hare', 'fox', 'pheasant']; let best = -1, bs = -1e9;
  L.clearings.forEach((c, i) => { if (i === 0 || skip.includes(i)) return; const cx = c[0] * CT + 8, cy = c[1] * CT + 8, d = Math.hypot(cx - P.x, cy - P.y); if (d < 220) return;
    let n = 0; for (const a of COURT.ani) if (a.loc === 'forest' && a.game === 1 && a.st !== 'dead' && want.includes(gk(a)) && Math.hypot(a.x - cx, a.y - cy) < 150) n++;
    const s = n * 3 - d / 300 + R.f(); if (s > bs) { bs = s; best = i; } });
  return best; }
const clName = (L, i) => { const c = L.clearings[i]; return roomName(L, c[0], c[1]); };
function splitStart() { const HU = COURT.hunt, L = LOCS.forest, P = COURT.p, hn = npcByKey('srv_hunter'); if (!HU || HU.ended || HU.split || !hn) return;
  if (!COURT.ani.some(a => a.game === 2)) { UI.toast('Гончих нет — разделяться не с кем.'); return; }
  const ci = splitPick(HU, L, P, []); if (ci < 0) { say(hn, 'Тут и так всё рядом, государь.', 3); return; }
  HU.split = { st: 'go', ci, t: NOW, tried: [ci], hornT: 0, hornAt: -9 }; hn.path = null; const nm = clName(L, ci), c = L.clearings[ci];
  say(hn, 'Добро, государь. Я с гончими — к «' + nm + '». Подниму зверя — протрублю. Идите на рог!', 5); Snd.sfx('bark');
  UI.toast('Ловчий с гончими уходит ' + dirWord(c[0] * CT - P.x, c[1] * CT - P.y) + ', к «' + nm + '». G — протрубить, чтобы вернулся.'); }
function splitQ(HU) { for (const a of COURT.ani) if (a.game === 2 && a.loc === 'forest' && a.st === 'chase' && a.q && a.q.st !== 'dead' && a.q.st !== 'fly') return a.q; return null; }
function splitEnd(HU, hn, q) { HU.split = null; if (hn) { hn.path = null; say(hn, q ? (q.st === 'bay' ? 'Вот он, государь! Держат — бейте!' : 'Гоним, государь! За мной!') : 'Вот и вы, государь. Дальше — вместе.', 3.5); } }
function splitCall() { const HU = COURT.hunt, S = HU && HU.split; if (!S || S.st === 'back') return; S.st = 'back'; Snd.sfx('horn'); UI.toast('Вы трубите в рог: ловчий с гончими возвращается.'); const hn = npcByKey('srv_hunter'); if (hn) hn.path = null; }
function splitKey() { const HU = COURT.hunt; if (!HU || HU.ended) return; if (HU.split) splitCall(); else splitStart(); }
function splitWord(HU) { const S = HU.split, L = LOCS.forest, P = COURT.p, hn = npcByKey('srv_hunter'); if (!hn) return 'Без ловчего';
  if (!S) return 'Ловчий рядом  ·  G — разделиться';
  const dw = dirWord(hn.x - P.x, hn.y - P.y), q = S.st === 'drive' && splitQ(HU);
  if (S.st === 'back') return 'Ловчий возвращается — ' + dw;
  if (q) return 'Рог! Гончие ' + (q.st === 'bay' ? 'держат ' : 'гонят ') + gAcc(gk(q)) + ' — ' + dw;
  return 'Ловчий ' + (S.st === 'go' ? 'идёт к' : 'ищет у') + ' «' + clName(L, S.ci) + '» — ' + dw + '  ·  G — созвать'; }
function splitUpd(HU, L, P) { const S = HU.split; if (!S) return; const hn = npcByKey('srv_hunter'); if (!hn) { HU.split = null; return; }
  const dk = Math.hypot(hn.x - P.x, hn.y - P.y), q = S.st === 'back' ? null : splitQ(HU);
  if (dk < 100 && NOW - S.t > 4) { splitEnd(HU, hn, q); return; }
  if (q) { S.st = 'drive'; if (NOW > S.hornT) { S.hornT = NOW + (q.st === 'bay' ? 7 : 10); S.hornAt = NOW; Snd.sfx('horn_short'); UI.toast('Рог ловчего — ' + dirWord(hn.x - P.x, hn.y - P.y) + ': гончие ' + (q.st === 'bay' ? 'держат ' : 'гонят ') + gAcc(gk(q)) + '!'); }
    if (q.st === 'bay' && !q.sB) { q.sB = 1; q.bt += R.range(7, 10); } return; }
  if (S.st === 'drive') { S.st = 'search'; S.t2 = NOW; }
  if (S.st === 'go') { const c = L.clearings[S.ci]; if (Math.hypot(hn.x - c[0] * CT - 8, hn.y - c[1] * CT - 12) < 56) { S.st = 'search'; S.t2 = NOW; } else if (NOW - S.t > 90) { S.st = 'search'; S.t2 = NOW; } }
  if (S.st === 'search' && NOW - S.t2 > 26) { const ci = S.tried.length < 3 ? splitPick(HU, L, P, S.tried) : -1; hn.path = null; Snd.sfx('horn_low'); S.hornAt = NOW;
    if (ci >= 0) { S.ci = ci; S.tried.push(ci); S.st = 'go'; S.t = NOW; UI.toast('Ловчий трубит коротко: здесь пусто, идёт дальше — к «' + clName(L, ci) + '».'); }
    else { S.st = 'back'; UI.toast('Ловчий трубит отбой поиску: зверя не нашёл, возвращается к вам.'); } } }
function splitMove(n, dt, L, P, HU) { const S = HU.split; if (n.bubT && n.bubT < NOW) n.bub = null; n.loc = 'forest'; n.away = 0; n.sit = null; n.lie = 0;
  const q = S.st === 'back' ? null : splitQ(HU); let tx, ty, sp = 78;
  if (S.st === 'back') { tx = P.x; ty = P.y; sp = 100; }
  else if (q) { const d = Math.hypot(q.x - n.x, q.y - n.y); if (d < 44) { n.path = null; n.moving = 0; faceTo(n, q.x - n.x, q.y - n.y); return; } tx = q.x; ty = q.y; sp = 96; }
  else if (S.st === 'search') { if (!S.wp || NOW > S.wpT || Math.hypot(S.wp[0] - n.x, S.wp[1] - n.y) < 8) { const c = L.clearings[S.ci], [ex, ey] = nearFree(L, c[0] + R.i(1 - c[2], c[2] - 1), c[1] + R.i(1 - c[3], c[3] - 1)); S.wp = [ex * CT + 8, ey * CT + 12]; S.wpT = NOW + 5; n.path = null; } [tx, ty] = S.wp; sp = 46; }
  else { const c = L.clearings[S.ci]; tx = c[0] * CT + 8; ty = c[1] * CT + 12; }
  if (!n.path || n.pi >= n.path.length || NOW > (n.rpT || 0)) { n.rpT = NOW + (q || S.st === 'back' ? 1.2 : 4); const [ex, ey] = nearFree(L, Math.floor(tx / CT), Math.floor(ty / CT)); n.path = castar(L, Math.floor(n.x / CT), Math.floor((n.y - 2) / CT), ex, ey, 9000); n.pi = 0; }
  if (n.path && n.pi < n.path.length) { const [px, py] = n.path[n.pi], gx = px * CT + 8, gy = py * CT + 12, dx = gx - n.x, dy = gy - n.y, dd = Math.hypot(dx, dy), st = sp * dt;
    if (dd <= st) { n.x = gx; n.y = gy; n.pi++; } else { n.x += dx / dd * st; n.y += dy / dd * st; n.f += st; faceTo(n, dx, dy); } n.moving = 1; }
  else n.moving = 0; }
{ const fo0 = folUpd; folUpd = function (n, i, dt, L, P) { const HU = COURT.hunt; if (HU && HU.split && n.key === 'srv_hunter') { splitMove(n, dt, L, P, HU); return; } fo0(n, i, dt, L, P); }; }
{ const ho0 = houndUpd; houndUpd = function (h, dt, L, P, HU) { const hn = HU && HU.split && npcByKey('srv_hunter'); if (!hn) { ho0(h, dt, L, P, HU); return; }
    const s0 = COURT.sneak; COURT.sneak = false; ho0(h, dt, L, { x: hn.x, y: hn.y, moving: 1, dir: hn.dir }, HU); COURT.sneak = s0; }; }
{ const hh1 = huntHunterTalk; huntHunterTalk = function (n) { const HU = COURT.hunt; if (!HU || HU.ended) { hh1(n); return; }
    const ch = [{ t: 'Охотимся дальше', fx: () => { } }];
    if (!HU.split && COURT.ani.some(a => a.game === 2)) ch.push({ t: 'Разделимся: ищи зверя с гончими (G)', tip: 'Ловчий с гончими уйдёт к дальней поляне, поднимет зверя и протрубит в рог — идите на рог. Гончие продержат зверя дольше. Но без ловчего рядом опаснее: кабан, шальная стрела.', fx: () => splitStart() });
    ch.push({ t: 'Трубить отбой — домой', fx: () => huntEnd('horn') });
    DLG.say(n, huntHint() + ' Стрел в колчане: ' + HU.arrows + '.', { choices: ch, esc: 0 }); }; }
// ---------- the beasts: boars and bears turn on the hunter who comes too near; a stag at bay strikes with its antlers ----------
{ const gu2 = gameUpd; gameUpd = function (a, dt, L, P, HU) { const g = gameOf(a), live = HU && !HU.ended && COURT.loc === 'forest' && !(P.downT > NOW);
    if (live && g.fierce && (a.st === 'graze' || a.st === 'alert')) { const kd = Math.hypot(a.x - P.x, a.y - P.y), bear = a.kind === 'bear', near = bear ? 100 : 80;
      if (kd < near && !a.dec && (a.st === 'alert' || huntThreat(a, L, P, g))) { a.dec = NOW + 3; const p = (bear ? 0.45 : 0.4) + (a.hurt ? 0.4 : 0) + (kd < near * 0.6 ? 0.25 : 0) + (seasonOf(G.day) === 3 ? 0.05 : 0);
        if (R.chance(p)) { a.flip = P.x > a.x; gameCharge(a); return; } }
      if (a.dec && NOW > a.dec) a.dec = 0; }
    if (live && a.st === 'bay' && a.kind === 'deer' && a.col !== 'doe' && !a.lunged && HU.wpn !== 'pike') { const kd = Math.hypot(a.x - P.x, a.y - P.y);
      if (kd < 70 && !HU.stagSaid) { HU.stagSaid = 1; const hn = npcByKey('srv_hunter'); if (hn && !HU.split) say(hn, 'Не подходите вплотную, государь, — олень у бая бьёт рогами!', 4); }
      if (kd < 34) { a.lunged = 1; if (R.chance(0.35 + (kingC().age > 50 ? 0.1 : 0))) { stagLunge(a, HU, P); gameFlee(a, P); a.ft = 4; a.free = NOW + 3; return; } } }
    gu2(a, dt, L, P, HU); }; }
// the new clearings of the big forest: the alder ravine, the bear's corner, the grouse wood, the old burn, the elk fen
{ const hf1 = huntFauna; huntFauna = function (kind) { hf1(kind); const L = LOCS.forest; if (!L || !L.clearings || L.clearings.length < 12 || !COURT.ani) return; const CL = L.clearings, snow = seasonOf(G.day) === 3, hunt = !!kind;
    const add = (k, ci, col, n) => { const [cx, cy, rx, ry] = CL[ci], g = GAME[k === 'deer' && col === 'doe' ? 'doe' : k], r = [cx - rx + 1, cy - ry + 1, cx + rx - 1, cy + ry - 1];
      for (let i = 0; i < (n || 1); i++) { const a = { kind: k, loc: 'forest', r, x: 0, y: 0, tx: 0, ty: 0, t: R.f() * 3, flip: R.f() < 0.5, col: col || null, f: 0, game: 1, st: 'graze', hp: g.hp, swim: false, h: 0 };
        for (let t = 0; t < 40; t++) { a.x = (r[0] + R.f() * (r[2] - r[0] + 1)) * CT; a.y = (r[1] + R.f() * (r[3] - r[1] + 1)) * CT; if (aniFree(L, a.x, a.y, a)) break; }
        if (aniFree(L, a.x, a.y, a)) COURT.ani.push(a); } };
    add('hare', 7, snow ? 'snow' : null, kind === 'falcon' ? 3 : 1); add('fox', 7, null, 1); add('pheasant', 7, null, kind === 'falcon' ? 3 : 1); if (hunt) add('deer', 7, 'doe', 1);
    if (R.chance(hunt ? 0.35 : 0.2)) add('bear', 8); else add('boar', 8, null, 2);
    add('deer', 9, null, 1); add('deer', 9, 'doe', hunt ? 2 : 1); add('pheasant', 9, null, kind === 'falcon' ? 3 : 1);
    add('boar', 10, null, kind === 'boar' ? 3 : 2); add('hare', 10, snow ? 'snow' : null, 1);
    if (R.chance(0.4)) add('wolf', 11, null, R.i(2, 3)); else add('deer', 11, 'doe', 2); add('deer', 11, null, 1); }; }
{ const hk1 = huntKill; huntKill = function (a, by) { const HU = COURT.hunt; if (HU && a.st !== 'dead') { if (a.arw && HU.ar) HU.arrows += a.arw; if (a.jv && HU.jf) HU.jav += a.jv; } a.arw = 0; a.jv = 0; hk1(a, by); }; }
{ const st1 = huntStart; huntStart = function (kind, comp) { st1(kind, comp); const HU = COURT.hunt; if (HU && !HU.ar) Object.assign(HU, { ar: [], sa: [], draw: null, split: null, t0: NOW, cShot: NOW + 8 }); }; }
{ const pu0 = playerUpdate; playerUpdate = function (dt) { const HU = COURT.hunt, D = HU && HU.draw; pu0(D ? dt * 0.45 : dt); if (D && COURT.p) { const P = COURT.p, [ax, ay] = aimPt(); faceTo(P, ax - P.x, ay - P.y + 14); } }; }
{ const cc0 = courtClick; courtClick = function (c) { const HU = COURT.hunt; if (HU && HU.draw) { if (c.b !== 0 && input.down[0]) HU.eatUp = 1; drawLoose(HU, c.b !== 0); return; }
    if (HU && ((HU.eatUp && c.b === 0) || (HU.drawEnd && NOW - HU.drawEnd < 0.08))) { HU.eatUp = 0; return; } cc0(c); }; }
// ---------- hooks: the mouse, G, the per-frame update; a click on a beast in one's own aim ----------
CKEY_EXT.push(c => { const HU = COURT.hunt; if (!HU || HU.ended || COURT.loc !== 'forest') return false;
  if (c === 'KeyG') { splitKey(); return true; }
  if (c === 'Escape' && HU.draw) { drawLoose(HU, true); return true; }
  if ((c === 'KeyE' || c === 'Enter') && huntOwn(HU) && !nearestTarget()) { if (NOW > (HU.eTip || 0)) { HU.eTip = NOW + 6; UI.toast('Свой прицел: зажмите левую кнопку мыши — натянуть, отпустите — выстрел. Прицел ловчего (E) — в панели охоты.'); } return true; }
  return false; });
{ const q0 = huntWpnNext; huntWpnNext = function () { const HU = COURT.hunt; if (HU) HU.draw = null; q0(); }; }
PICK_EXT.unshift((wx, wy) => { const HU = COURT.hunt; if (!huntOwn(HU) || COURT.loc !== 'forest') return null;
  for (const a of COURT.ani) { if (a.loc !== 'forest' || a.game !== 1 || a.st === 'dead') continue; const b = aBox(a); if (wx < b[0] - 3 || wx > b[2] + 3 || wy < b[1] - 3 || wy > b[3] + 4) continue; const g = gameOf(a);
    if (HU.kind === 'falcon' && !HU.fal && (g.bird || a.kind === 'hare')) return null;   // the falcon's quarry: hunt.js offers the falcon
    const P = COURT.p, top = b[1] + 14; if (HU.draw) { const d = Math.round(Math.hypot(a.x - P.x, a.y - P.y)), B = HBOW[HU.draw.w]; return { e: 1, d: 1e9, label: (a.hart ? 'Белый олень' : ucf(g.n)) + ' · ' + d + ' шагов', sub: d > B.r0 + B.r1 ? 'не долетит — подойдите ближе' : '', x: a.x, y: top, go: () => { } }; }
    return { e: 1, d: 1e9, label: a.hart ? 'Белый олень' : ucf(g.n), sub: stWord(a) + (a.hurt ? ', ' + (g.f ? 'ранена' : 'ранен') : '') + (a.arw ? ' · стрел в ' + (g.f ? 'ней' : 'нём') + ': ' + a.arw : '') + ' · зажмите кнопку — ' + (HU.wpn === 'bow' ? 'натянуть лук' : 'замах'), x: a.x, y: top,
      go: () => { if (NOW > (HU.eTip || 0)) { HU.eTip = NOW + 4; UI.toast('Зажмите левую кнопку мыши — ' + (HU.wpn === 'bow' ? 'натянуть тетиву' : 'замахнуться') + ', наведите и отпустите.'); } } }; }
  return null; });
UPD_EXT.push(dt => { const HU = COURT.hunt; if (G.visit || !HU || HU.ended || COURT.loc !== 'forest' || !HU.ar) return; const P = COURT.p, L = LOCS.forest, hn = npcByKey('srv_hunter');
  const md = input.down[0];
  if (huntOwn(HU) && !(HU.aim && HU.aim.useF)) HU.aim = null;   // one's own aim: no huntsman's reticle (the falcon still flies at E)
  if (HU.eatUp && !md) HU.eatUp = 0;
  if (huntOwn(HU) && !courtBlocked() && !(P.downT > NOW)) {
    if (!HU.draw && md && !md.hunt && performance.now() - md.t > 140) { md.hunt = 1; const h0 = topHit(LAST, md.x, md.y); if (h0 && h0.id === 'court') drawStart(HU); }
    if (HU.draw && !md) drawLoose(HU, false); else if (HU.draw) { COURT.path = null; COURT.onArrive = null; } }
  else if (HU.draw) drawLoose(HU, true);
  arUpd(HU, dt, L, P); pickUp(HU, P); compShoot(HU, L, P); splitUpd(HU, L, P);
  // a fall in the chase: running after the hounds through the roots and ravines
  if (P.moving && !COURT.sneak && !(P.downT > NOW) && !HEAL.pend) { const k = kingC(); if (COURT.ani.some(h => h.game === 2 && h.st === 'chase' && Math.hypot(h.x - P.x, h.y - P.y) < 260) && R.chance(dt * 0.0006 * (seasonOf(G.day) === 3 ? 2 : 1) * (k.age > 50 ? 1.6 : 1) * (k.wound > G.day ? 1.5 : 1))) chaseFall(HU, P); }
  // the huntsman's warnings and advice
  if (hn && !HU.split && !hn.bub) {
    if (!HU.boarSaid) for (const a of COURT.ani) if (a.loc === 'forest' && a.game === 1 && gameOf(a).fierce && a.st !== 'dead' && Math.hypot(a.x - P.x, a.y - P.y) < 150 && lineFree(L, P.x, P.y - 10, a.x, a.y - 6)) { HU.boarSaid = 1; say(hn, a.kind === 'bear' ? 'Медведь, государь! Близко не подходите. Семь стрел ему мало — берегитесь.' : 'Секач, государь! Подойдёте близко — кинется. Бейте издали, а кинется — вбок или на рогатину.', 5); break; }
    if (!HU.splitSaid && NOW - HU.t0 > 55 && !HU.bag.length && COURT.ani.some(a => a.game === 2)) { HU.splitSaid = 1; say(hn, 'Зверь затаился, государь. Разделимся? Я с гончими обойду дальние поляны и протрублю, как подниму. (G)', 6); } } });
// ---------- drawing: arrows in flight, the aim, the draw; arrows in the ground, in trees and in the beasts; the huntsman's marker; the panel ----------
CRENDER2.push((g, L) => { const HU = COURT.hunt, P = COURT.p; if (L.id !== 'forest' || !HU || !HU.ar || !P) return;
  for (const f of HU.ar) if (f.w === 'jav') drawJav(g, f.x, f.y, f.ux, f.uy, 10); else drawArrowPx(g, f.x, f.y, f.ux, f.uy, 7);
  const D = HU.draw; if (!D || COURT.loc !== 'forest') return; const k1 = drawK(D), [ax, ay] = aimPt(), ox = P.x, oy = P.y - 14, an = Math.atan2(ay - oy, ax - ox), sp = aimSpread(D), R0 = HBOW[D.w].r0 + HBOW[D.w].r1 * k1, full = k1 >= 1, col = full ? '#f7d35c' : '#d8c8a0';
  const dots = (a2, s0, ds, c, al) => { for (let s = s0; s < R0; s += ds) { const x = Math.round(ox + Math.cos(a2) * s), y = Math.round(oy + Math.sin(a2) * s); g.globalAlpha = al * 0.7; g.fillStyle = PAL.o; g.fillRect(x, y + 1, 1, 1); g.globalAlpha = al; g.fillStyle = c; g.fillRect(x, y, 1, 1); } };
  dots(an, 10, 3, col, 0.95); for (const e of [-1, 1]) dots(an + e * sp, 16, 5, '#fff0c8', 0.55);
  g.globalAlpha = 1; const ex = Math.round(ox + Math.cos(an) * R0), ey = Math.round(oy + Math.sin(an) * R0); g.fillStyle = col; g.fillRect(ex - 1, ey, 3, 1); g.fillRect(ex, ey - 1, 1, 3);
  if (D.w === 'bow') drawArrowPx(g, ox + Math.cos(an) * 8, oy + Math.sin(an) * 8, Math.cos(an), Math.sin(an), Math.round(6 - 3 * k1) + 3);
  const held = NOW - D.t0 - HBOW[D.w].tf - 1.6, mx = Math.round(P.x - 8), my = Math.round(P.y - 38), jit = held > 0 ? Math.round(Math.sin(NOW * 40) * Math.min(1, held)) : 0;
  g.fillStyle = PAL.o; g.fillRect(mx - 1, my - 1, 18, 4); g.fillStyle = '#3a2a1a'; g.fillRect(mx, my, 16, 2); g.fillStyle = held > 0 ? '#ff8040' : full ? '#f7d35c' : '#c8a868'; g.fillRect(mx + jit, my, Math.round(16 * k1), 2); });
SPR_EXT.push((L, list) => { const HU = COURT.hunt; if (L.id !== 'forest' || !HU || !HU.sa) return;
  for (const s of HU.sa) list.push([s.y + (s.tree ? 2 : 0.5), 4, g => { if (s.tree) drawArrowPx(g, s.x - s.ux * 2, s.y - s.h - 2, s.ux, s.uy * 0.3, 6); else drawArrowPx(g, s.x, s.y, s.ux * 0.7, s.uy * 0.4 - 0.55, 6); }]);
  for (const a of COURT.ani) if (a.loc === 'forest' && a.game === 1 && a.arw) list.push([a.y + 0.2, 4, g => { const s = animalSprite(a.kind, 0, a.flip, a.col || null), top = a.y - s.height - (a.h || 0), fx = a.flip ? -1 : 1;
      for (let i = 0; i < a.arw; i++) { const x = Math.round(a.x + (i - 1) * 3 - fx), y = Math.round(top + s.height * (a.st === 'dead' ? 0.6 : 0.42) + (i % 2)); g.fillStyle = '#d8c090'; g.fillRect(x, y - 3, 1, 3); g.fillRect(x + fx, y - 4, 1, 1); g.fillStyle = '#c83030'; g.fillRect(x + fx, y - 5, 1, 1); } }]); });
HUD_EXT.push(() => { const HU = COURT.hunt, S = HU && HU.split; if (!S || HU.ended || COURT.loc !== 'forest' || courtBlocked()) return; const hn = npcByKey('srv_hunter'); if (!hn) return;
  const [sx, sy] = cw2s(hn.x, hn.y - 16), m = 18; if (sx > m && sx < W - m && sy > 40 && sy < H - 26) return;
  const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy, k = Math.min((W / 2 - m) / Math.max(1, Math.abs(dx)), (H / 2 - 32) / Math.max(1, Math.abs(dy))), x = Math.round(cx + dx * k), y = Math.round(cy + dy * k), an = Math.atan2(dy, dx);
  const hot = NOW - (S.hornAt || -9) < 2.5, c = hot ? '#f7d35c' : '#c8b890'; ctx.globalAlpha = hot ? 0.8 + 0.2 * Math.sin(NOW * 12) : 0.85;
  const ca = Math.cos(an), sa = Math.sin(an), tip = [x + ca * 14, y + sa * 14]; for (let i = -4; i <= 4; i++) { const bx = x + ca * 7 - sa * i * 0.9, by = y + sa * 7 + ca * i * 0.9; line(Math.round(bx), Math.round(by), Math.round(tip[0]), Math.round(tip[1]), c); }
  disc(x, y, 8, PAL.o); disc(x, y, 7, '#3a2a1a'); rect(x - 4, y - 1, 3, 3, c); rect(x - 1, y - 2, 3, 5, c); rect(x + 2, y - 3, 2, 7, c);   // a little horn: mouthpiece, body, bell
  const t = hot ? 'рог!' : 'ловчий', tx = clamp(Math.round(x - tw(t, { f: 's' }) / 2), 4, W - tw(t, { f: 's' }) - 4), ty = y > H / 2 ? y - 16 : y + 8; txt(t, tx, ty, c, { f: 's' }); ctx.globalAlpha = 1; });
huntPanel = function (HU) { if (!HU.jf) return; const F = { f: 's' }, fal = HU.kind === 'falcon' ? '  ·  сокол: ' + (HU.fal ? 'в полёте' : 'на перчатке') : '', auto = !!G.court.huntAuto;
  const t1 = HUNTK[HU.kind].n + fal + '  ·  до 19:30', tA = auto ? 'Прицел: ловчего (E, клик)' : 'Прицел: свой (зажать ЛКМ)', tS = HU.ar ? splitWord(HU) : '', t3 = ucf(windWord()) + ' →', t4 = HU.bag.length ? 'Добыча: ' + bagStr(HU.bag) : 'Добычи пока нет';
  const ws = [['bow', 'лук: ' + HU.arrows], ['jav', 'сулицы: ' + HU.jav], ['pike', 'рогатина']], sep = '   ', ww = ws.reduce((s, [, t]) => s + tw(t, F), 0) + tw(sep, F) * 2 + tw('Q  ', F);
  const w = Math.max(tw(t1, F), tw(tA, F), tw(tS, F), tw(t3, F), tw(t4, F), ww) + 12, x = W - w - 6, y = 22, h = 57;
  rect(x, y, w, h, 'rgba(20,14,12,0.84)'); strokeR(x, y, w, h, '#8a6a3a'); txt(t1, x + 6, y + 3, '#e8d5a8', F);
  let cx = x + 6; txt('Q', cx, y + 12, '#8aa8c8', F); cx += tw('Q  ', F);
  for (const [k, t] of ws) { const on = HU.wpn === k; txt(t, cx, y + 12, on ? '#f7d35c' : '#8a7a62', F); if (on) rect(cx, y + 20, tw(t, F), 1, '#f7d35c'); cx += tw(t + sep, F); }
  txt(tA, x + 6, y + 21, hov('haim') ? '#fff0c0' : '#d8c8a0', F); txt(tS, x + 6, y + 30, HU.split ? '#f7d35c' : hov('hsplit') ? '#fff0c0' : '#a8b898', F);
  txt(t3, x + 6, y + 39, '#a8c8d8', F); txt(t4, x + 6, y + 48, HU.bag.length ? '#c8e8a0' : '#a89878', F);
  hit(x, y, w, 10, { id: 'hpanel', cursor: true, tip: ['Королевская охота', 'Свой прицел: зажмите левую кнопку мыши — король натягивает лук (полоска над головой), наведите и отпустите. Чем дольше натяг — тем дальше и точнее; держать слишком долго — рука дрожит. Правая кнопка — ослабить тетиву.', 'Под лопатку (чуть позади передней ноги) — вдвое сильнее. Кабану нужно 3–4 стрелы, медведю — 6–7.', 'Shift — красться: зверь подпустит ближе. Отбой — через ворота леса или у ловчего.'], onClick: () => { const n = npcByKey('srv_hunter'); if (n && !DLG.open() && !HU.split) huntHunterTalk(n); } });
  hit(x, y + 10, w, 10, { id: 'hwpn', cursor: true, tip: ['Оружие (Q — сменить)', 'Лук — шагов до 260 при полном натяге, стрел 15; промахнувшиеся стрелы можно подобрать.', 'Сулицы — 4 метательных копья: шагов до 130, бьют вдвое сильнее стрелы. Промахнулись — подберите.', 'Рогатина — вплотную. Бросится кабан или медведь — стойте и примите его на рогатину: слава, но и риск.'], onClick: () => huntWpnNext() });
  hit(x, y + 19, w, 9, { id: 'haim', cursor: true, tip: ['Прицел (щёлкните — сменить)', 'Свой: натягиваете и целитесь мышью сами — стрела летит, куда навели, с разбросом от руки короля.', 'Ловчего: E или щелчок по зверю — выстрел по шансу, как прежде. Проще, но слава та же.'], onClick: () => { G.court.huntAuto = auto ? 0 : 1; HU.draw = null; UI.toast(auto ? 'Свой прицел: зажмите левую кнопку мыши, наведите, отпустите.' : 'Прицел ловчего: E или щелчок по зверю.'); } });
  hit(x, y + 28, w, 9, { id: 'hsplit', cursor: true, tip: ['Разделиться (G)', 'Ловчий с гончими уходит к дальней поляне, поднимает зверя и трубит в рог; стрелка на краю экрана покажет, где он. Гончие продержат зверя у бая дольше.', 'G ещё раз — протрубить, чтобы вернулся. Без ловчего рядом опаснее: некому подстраховать с рогатиной, а спутник может выстрелить сгоряча.'], onClick: () => splitKey() });
  hit(x, y + 37, w, 20, { id: 'hwind', tip: ['Ветер', 'Ветер несёт ваш запах на восток: зверь с подветренной стороны учует издалека. Заходите с востока — подпустит ближе.', 'Подранок оставляет кровь на траве; устав, он залегает. Гончие найдут его по следу.'] });
  if (COURT.loc === 'forest' && !DLG.open()) { const s = (huntOwn(HU) ? 'Зажать ЛКМ — натянуть, отпустить — ' + (HU.wpn === 'bow' ? 'выстрел' : 'бросок') + '  ·  ПКМ — ослабить' : 'E / клик по зверю — ' + (HU.kind === 'falcon' ? 'сокол или ' + { bow: 'стрела', jav: 'сулица', pike: 'рогатина' }[HU.wpn] : HWPN[HU.wpn].act.toLowerCase())) + '  ·  Q — оружие  ·  G — ловчий  ·  Shift — красться', w2 = tw(s, F) + 10;
    rect(8, H - 14, w2, 11, 'rgba(20,14,12,0.8)'); txt(s, 13, H - 11, '#c8d8e8', F); } };
