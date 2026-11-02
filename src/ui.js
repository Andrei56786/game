'use strict';
// ===== UI: map view, fog, HUD, map interaction =====
const UICON = { levy: 'i_men', spear: 'i_shield', sword: 'i_sword', archer: 'i_bow', xbow: 'i_xbow', horse: 'i_horse', harch: 'i_harch', knight: 'i_knight' };
const MODE_INFO = {
  march: { n: 'Марш', ic: 'i_flag', d: 'Войско идёт обычным шагом.' },
  camp: { n: 'Лагерь', ic: 'i_tent', d: 'Отдых: усталость спадает, больные выздоравливают быстрее.' },
  fort: { n: 'Укреплённый лагерь', ic: 'i_shield', d: 'Рвы и частокол (2 дня): боевой дух +4, в бою на месте — оборона +30%. «Сначала сделай себя непобедимым» (гл. 4).' },
  hide: { n: 'Скрытый лагерь', ic: 'i_eye', d: 'Без костров, в лесу или холмах: враг не видит войско дальше 2 клеток. Засада! (гл. 9)' },
  forage: { n: 'Фуражировка', ic: 'i_fodder', d: 'Войско кормится с земли. Разоряет провинцию; на своей земле растёт смута. «Мудрый полководец кормится за счёт врага» (гл. 2).' },
  drill: { n: 'Учения', ic: 'i_sword', d: 'Опыт воинов растёт, но они устают. (гл. 1: «чьи воины лучше обучены?»)' },
  siege: { n: 'Осада', ic: 'i_fire', d: 'Войско ведёт осаду.' },
};
const UI = {
  win: null, modals: [], feed: [], tab: 0, scroll: 0, prev: null, prevGoal: -1, prevAt: 0, lastSpeed: 1, toastT: 0, toastS: '', hoverTile: -1, sel: 0,
  onLog(t, c) { this.feed.push({ t, c, at: NOW }); if (this.feed.length > 7) this.feed.shift(); },
  onMsg(m) { },
  alert(k, d) { if (this.modals.some(m => m.k === k && m.d === d)) return; this.modals.push({ k, d, at: NOW }); },
  modalOpen() { return this.modals.length > 0; },
  close() { this.modals.shift(); if (typeof Snd !== 'undefined') Snd.sfx('click'); },
  open(w) { this.win = w; this.tab = 0; this.scroll = 0; if (typeof Snd !== 'undefined') Snd.sfx('paper'); },
  shut() { const w = this.win; this.win = null; if (w && w.k === 'sett' && SCREEN === 'map' && typeof autoPause === 'function' && playerArmy()) autoPause('Вы покинули ' + WD.setts[w.id].name); },
  paused() { return !G || G.speed === 0 || this.modals.length > 0 || !!this.win || !!G.over || (typeof TUT !== 'undefined' && TUT.blocking()); },
  toast(s) { this.toastS = s; this.toastT = NOW + 2.2 + Math.min(3, s.length / 40); },
};
// ---------- fog of war ----------
const FOG = { dirtyAt: 0 };
function initFog() {
  [FOG.mc, FOG.mg] = mkCanvas(MW, MH); [FOG.vc, FOG.vg] = mkCanvas(MW, MH);
  // a seamless sheet of old paper (500 texels, repeated); the fog is composed per frame on a screen-sized scratch
  const TW = 500, TH = 500; const [tc, tg] = mkCanvas(TW, TH); const img = tg.createImageData(TW, TH); const b = new Uint32Array(img.data.buffer);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const n = vnoise(x * 0.012, y * 0.012, 71, 6) * 0.55 + vnoise(x * 0.05, y * 0.05, 72, 25) * 0.3 + vnoise(x * 0.3, y * 0.3, 73, 150) * 0.15;
    let f = 0.8 + n * 0.22; if (hash2(x >> 1, y, 74) < 0.004) f -= 0.08;
    b[y * TW + x] = pack(clamp(222 * f, 0, 255) | 0, clamp(200 * f, 0, 255) | 0, clamp(150 * f, 0, 255) | 0, 255);
  }
  // faint grid lines like an old chart
  for (let y = 0; y < TH; y += 50) for (let x = 0; x < TW; x++) if ((x >> 2) & 1) b[y * TW + x] = pack(176, 150, 108, 255);
  for (let x = 0; x < TW; x += 50) for (let y = 0; y < TH; y++) if ((y >> 2) & 1) b[y * TW + x] = pack(176, 150, 108, 255);
  tg.putImageData(img, 0, 0); FOG.tex = tc; [FOG.sc, FOG.sg] = mkCanvas(W, H); FOG.pat = FOG.sg.createPattern(tc, 'repeat');
}
// unexplored land under paper: the mask (1 px per tile) is stretched over the view, then filled with the paper pattern locked to the world
function drawFogPaper() {
  const g = FOG.sg, z = cam.z; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  drawLayer(FOG.mc, 1 / TS, true, undefined, g);
  const s = z >= 0.5 ? 2 * z : 1; try { FOG.pat.setTransform(new DOMMatrix([s, 0, 0, s, W / 2 - cam.x * z, H / 2 - cam.y * z])); } catch (e) { }
  g.globalCompositeOperation = 'source-in'; g.fillStyle = FOG.pat; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  ctx.drawImage(FOG.sc, 0, 0);
}
function rebuildFog() {
  const mi = FOG.mg.createImageData(MW, MH), vi = FOG.vg.createImageData(MW, MH); const mb = new Uint32Array(mi.data.buffer), vb = new Uint32Array(vi.data.buffer);
  const ex = G.explored, vs = G.vis; const night = 0;
  for (let i = 0; i < NT; i++) { if (!ex[i]) mb[i] = 0xff000000; else if (vs[i] !== 2) vb[i] = pack(16, 12, 24, 80 + night); }
  FOG.mg.putImageData(mi, 0, 0); FOG.vg.putImageData(vi, 0, 0);
  FOGDIRTY = 0; MINI.dirty = 1;
}
function refreshPolitics() { const t0 = performance.now(); renderPolitics(WD, p => G.setts[WD.provs[p].seat].ctrl, REALM_DEF.map(d => d.col)); MAPDIRTY.pol = 0; MAPDIRTY.t = NOW; MINI.dirty = 1; MAPDIRTY.ms = performance.now() - t0; }
// ---------- minimap ----------
const MINI = { w: 128, h: 80, dirty: 1, c: null, at: 0 };
function rebuildMini() {
  if (!MINI.c) { [MINI.c, MINI.g] = mkCanvas(MINI.w, MINI.h); [MINI.fc, MINI.fg] = mkCanvas(MINI.w, MINI.h); }
  const hq = (g2) => { g2.imageSmoothingEnabled = true; g2.imageSmoothingQuality = 'high'; };
  if (MINI.bq !== MAPR.quarter) { MINI.bq = MAPR.quarter; [MINI.b, MINI.bg] = mkCanvas(MINI.w, MINI.h); hq(MINI.bg); MINI.bg.drawImage(MAPR.quarter, 0, 0, MINI.w, MINI.h); }
  if (MAPR.polq && MINI.pv !== MAPR.polV) { MINI.pv = MAPR.polV; if (!MINI.p) [MINI.p, MINI.pg] = mkCanvas(MINI.w, MINI.h); MINI.pg.clearRect(0, 0, MINI.w, MINI.h); hq(MINI.pg); MINI.pg.drawImage(MAPR.polq, 0, 0, MINI.w, MINI.h); }
  const g = MINI.g; g.globalAlpha = 1; g.drawImage(MINI.b, 0, 0);
  if (MINI.p) { g.globalAlpha = 0.55; g.drawImage(MINI.p, 0, 0); g.globalAlpha = 1; }
  if (FOG.mc) { const f = MINI.fg; f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, MINI.w, MINI.h); hq(f); f.drawImage(FOG.mc, 0, 0, MINI.w, MINI.h); f.globalCompositeOperation = 'source-in'; f.fillStyle = '#d4bf92'; f.fillRect(0, 0, MINI.w, MINI.h); f.globalCompositeOperation = 'source-over'; g.drawImage(MINI.fc, 0, 0); }
  MINI.dirty = 0; MINI.at = NOW;
}
function drawMinimap(x, y) {
  if (MINI.dirty && NOW - MINI.at > 0.5) rebuildMini();
  rect(x - 3, y - 3, MINI.w + 6, MINI.h + 6, PAL.o); rect(x - 2, y - 2, MINI.w + 4, MINI.h + 4, '#7a5030'); rect(x - 1, y - 1, MINI.w + 2, MINI.h + 2, PAL.o);
  ctx.drawImage(MINI.c, x, y);
  const k = MINI.w / WPW;
  for (const a of G.armies) { if (!a.alive || !armyVisible(a)) continue; const ax = x + a.x * TS * k, ay = y + a.y * TS * k; const isP = a.id === G.player.army; rect(ax - (isP ? 1 : 0), ay - (isP ? 1 : 0), isP ? 3 : 2, isP ? 3 : 2, isP ? (Math.sin(NOW * 6) > 0 ? '#fff' : PAL.y) : a.kind === 'bandit' ? '#1b1420' : REALM_DEF[a.realm].dark); }
  const vw = W / cam.z * k, vh = H / cam.z * k; strokeR(Math.round(x + cam.x * k - vw / 2), Math.round(y + cam.y * k - vh / 2), Math.round(vw), Math.round(vh), '#fff2c8');
  hit(x, y, MINI.w, MINI.h, { id: 'mini', cursor: true, onClick: c => { cam.x = (c.ux - x) / k; cam.y = (c.uy - y) / k; camClamp(); }, tip: 'Карта мира. Щелчок — перейти.' });
}
// ---------- coordinates ----------
const armyWorld = a => MAPR.warpPt(a.x * TS, a.y * TS);
const settWorld = s => MAPR.tileCenter(s.i);
function tileAtScreen(sx, sy) { const [wx, wy] = s2w(sx, sy); const x = Math.floor(wx), y = Math.floor(wy); if (x < 0 || y < 0 || x >= WPW || y >= WPH) return -1; return MAPR.pxTile(x, y); }
function centerOn(wx, wy) { cam.x = wx; cam.y = wy; camClamp(); }
function centerArmy() { const pa = playerArmy(); if (pa) { const [x, y] = armyWorld(pa); centerOn(x, y); } }
// ---------- orders ----------
function orderMove(t, onArrive, follow) {
  const pa = playerArmy(); if (!pa || t < 0) return false;
  if (!passable(WD.ter[t])) { UI.toast('Туда не пройти.'); return false; }
  const p = planPath(pa, t); if (!p) { UI.toast('Пути нет.'); return false; }
  if (p.length <= 1) { if (onArrive) runArrive(pa, onArrive); return true; }
  setPath(pa, p); pa.onArrive = onArrive || null; G.player.follow = follow || -1; pa.hidden = 0; pa.fires = 0;
  if (G.speed === 0) G.speed = UI.lastSpeed || 1;
  if (typeof Snd !== 'undefined') Snd.sfx('march'); if (typeof TUT !== 'undefined') TUT.ev('move', t);
  return true;
}
function clickSett(sid, c) {
  if (c && c.drag) return;
  const pa = playerArmy(); const ws = WD.setts[sid];
  if (UI.target && UI.target.kind === 'cmd') { if (c && c.b === 2) { UI.target = null; UI.toast('Отменено.'); return; } cmdPickSett(sid); return; }
  if (UI.target) { mapClick(c); return; }
  if (!pa) { UI.open({ k: 'settinfo', id: sid }); return; }
  if (c && c.b === 2) { UI.open({ k: 'sett', id: sid }); return; }
  if (settHere(pa) === sid) { arriveSett(sid); return; }
  const acc = { village: 'деревню', castle: 'замок', town: 'город', capital: 'столицу' }[ws.type];
  if (orderMove(ws.i, { k: 'sett', s: sid })) UI.toast(hostile(pa.realm, G.setts[sid].ctrl) ? 'Идём на ' + ws.name + ': по прибытии — осада или приступ.' : 'Идём в ' + ws.name + ': по прибытии войдём в ' + acc + '.');
}
// the settlement the army is standing in (or -1)
function settHere(a) { let best = -1, bd = 1.3; for (const s of WD.setts) { const d = Math.hypot(s.x + 0.5 - a.x, s.y + 0.5 - a.y); if (d < bd) { bd = d; best = s.id; } } return best; }
function arriveSett(sid) {
  const S = G.setts[sid], pa = playerArmy(); if (!pa) return;
  if (G.court && sid === G.realms[0].capital && S.ctrl === 0 && pa.kind === 'player' && pa.siegeOf < 0) { capitalGate(sid); return; }
  if (pa.siegeOf === sid || !hostile(pa.realm, S.ctrl)) { UI.open({ k: 'sett', id: sid }); if (typeof TUT !== 'undefined') TUT.ev('visit', sid); return; }
  UI.alert('approach', sid);
}
function clickArmy(a, c) {
  if (c && c.drag) return;
  const pa = playerArmy();
  if (UI.target && UI.target.kind === 'cmd') { if (c && c.b === 2) { UI.target = null; UI.toast('Отменено.'); return; } cmdPickArmy(a); return; }
  if (!pa) { if (a.realm === 0 && a.kind === 'lord') UI.open({ k: 'cmd', sel: a.id }); else UI.toast(armyLabel(a)); return; }
  if (a.id === pa.id) { const sh = settHere(pa); if (sh >= 0 && !(c && c.b === 2) && !pa.path) { arriveSett(sh); return; } UI.open({ k: 'army' }); return; }
  if (G.court && a.realm === 0 && a.kind === 'lord' && !(c && c.b === 2)) { UI.open({ k: 'cmd', sel: a.id }); return; }
  if (hostile(pa.realm, a.realm)) { if (orderMove(armyTile(a), null, a.id)) UI.toast('Преследуем: ' + armyLabel(a)); }
  else orderMove(armyTile(a));
}
function setMode(m) {
  const pa = playerArmy(); if (!pa) return;
  if (m === 'fires') { pa.fires = pa.fires ? 0 : 1; if (pa.fires) pa.hidden = 0; if (typeof TUT !== 'undefined') TUT.ev('mode', 'fires'); return; }
  if (pa.siegeOf >= 0 && m !== 'siege') endSiege(pa);
  pa.path = null; pa.onArrive = null; G.player.follow = -1; pa.mode = m; pa.modeDay = G.day; pa.hidden = m === 'hide' ? 1 : 0; if (m === 'hide') pa.fires = 0; if (m !== 'fort') pa.fortDays = 0;
  if (m === 'hide') { const T = WD.ter[armyTile(pa)]; if (![TR.FOREST, TR.DFOREST, TR.HILLS, TR.MOUNT, TR.MARSH].includes(T)) { pa.hidden = 0; pa.mode = 'camp'; UI.toast('Спрятаться можно лишь в лесу, холмах, горах или болоте.'); } }
  if (typeof TUT !== 'undefined') TUT.ev('mode', m); if (typeof Snd !== 'undefined') Snd.sfx('click');
}
// ---------- encounters ----------
function checkEncounters() {
  const pa = playerArmy(); if (!pa || UI.modalOpen()) return;
  G.encCool = G.encCool || {}; const now = G.day + G.frac;
  for (const b of G.armies) {
    if (!b.alive || b === pa || !hostile(pa.realm, b.realm)) continue;
    if (Math.abs(b.x - pa.x) > 1 || Math.abs(b.y - pa.y) > 1) continue;
    if (Math.hypot(b.x - pa.x, b.y - pa.y) > 0.85) continue;
    if ((G.encCool[b.id] || -1) > now) continue;
    G.encCool[b.id] = now + 1.2; pa.path = null; b.path = null;
    UI.alert('enc', b.id); if (typeof Snd !== 'undefined') Snd.sfx('horn'); return;
  }
}
// follow target
function updateFollow() {
  const pa = playerArmy(); if (!pa || G.player.follow < 0) return;
  const b = armyById(G.player.follow); if (!b || !armyVisible(b)) { G.player.follow = -1; return; }
  if (!pa.path || (NOW - (UI.folAt || 0) > 0.6)) { UI.folAt = NOW; const t = armyTile(b); const p = planPath(pa, t); if (p && p.length > 1) { pa.path = p; pa.pi = 0; } }
}
// ---------- map drawing ----------
function drawWorld() {
  camClamp(); drawMapBase(G.mode);
  if (FOGDIRTY && NOW - FOG.dirtyAt > 0.15) { rebuildFog(); FOG.dirtyAt = NOW; }
  if (!G.mapOpen) { drawLayer(FOG.vc, 1 / TS, true); }
  drawLabels();
  hit(0, 0, W, H, { id: 'map', onClick: mapClick }); // first: settlements, armies and signs drawn later sit on top of it
  const pa = playerArmy();
  if (pa && pa.path) drawPath(pa, pa.path, pa.pi, '#fff2c8', true);
  drawSetts();
  drawSigns();
  drawArmies();
  if (G.court) drawCouriers();
  if (!G.mapOpen) drawFogPaper();
  drawRealmNames();
  drawWeather();
}
function drawRealmNames() { // political mode, far zoom: realm names across their lands
  if (G.mode !== 'pol' || cam.z >= 0.5) return;
  const acc = {}; WD.provs.forEach((P, k) => { const o = ownerOfProv(k); if (o == null || o < 0 || o > 5 || !G.explored[WD.setts[P.seat].i]) return; const a = acc[o] || (acc[o] = { x: 0, y: 0, n: 0 }); a.x += P.cx * P.area; a.y += P.cy * P.area; a.n += P.area; });
  for (const o in acc) { const a = acc[o]; const [sx, sy] = w2s(a.x / a.n * TS, a.y / a.n * TS + 10); if (sx < -60 || sx > W + 60 || sy < 14 || sy > H - 10) continue; txt(REALM_DEF[o].name.toUpperCase(), sx, sy, REALM_DEF[o].light, { al: 'c', sh: '#1a1410', ol: 1 }); }
}
function drawLabels() {
  if (cam.z < 0.5) return;
  for (const L of WD.labels) { if (!G.explored[Math.floor(L.y) * MW + Math.floor(L.x)]) continue; const [sx, sy] = w2s(L.x * TS + TS / 2, L.y * TS + TS / 2); if (sx < -80 || sx > W + 80 || sy < -10 || sy > H + 10) continue; txt(L.t, sx, sy, L.kind === 'lake' ? '#cfe6f5' : '#efe6d0', { al: 'c', sh: L.kind === 'lake' ? '#24507a' : '#3a3026', f: 's' }); }

}
function drawPath(a, path, from, col, own) {
  if (!path || path.length < 2) return;
  let [px0, py0] = w2s(...armyWorld(a)); let acc = 0, day = 1, cost = 0; const spd = armySpeed(a); let dash = 0;
  for (let k = from + 1; k < path.length; k++) {
    const t = path[k]; const [wx, wy] = MAPR.tileCenter(t); const [sx, sy] = w2s(wx, wy);
    const f = path[k - 1]; const diag = f % MW !== t % MW && ((f / MW) | 0) !== ((t / MW) | 0); cost += stepCost(a, t) * (diag ? 1.414 : 1);
    const L = Math.hypot(sx - px0, sy - py0), n = Math.max(1, Math.floor(L / 2));
    for (let i = 0; i < n; i++) { dash++; if ((dash >> 1) & 1) continue; const x = px0 + (sx - px0) * i / n, y = py0 + (sy - py0) * i / n; rect(x, y + 1, 2, 1, 'rgba(20,12,10,0.7)'); rect(x, y, 2, 1, col); }
    if (cost / spd >= day && own) { disc(sx, sy, 3, PAL.o); disc(sx, sy, 2, day <= 9 ? '#f7d35c' : '#e0a630'); if (cam.z >= 1) txt(String(day), sx + 4, sy - 3, '#fff2c8', { f: 's', sh: PAL.o }); day++; }
    px0 = sx; py0 = sy;
  }
  const [ex, ey] = w2s(...MAPR.tileCenter(path[path.length - 1])); ring(ex, ey, 3, col); ring(ex, ey, 4, PAL.o);
}
function settLabelCol(S) { return S.ctrl === G.player.realm ? '#cfe2ff' : hostile(G.player.realm, S.ctrl) ? '#ffb4a8' : '#fff2c8'; }
function drawSetts() {
  const z = cam.z, sc = z >= 2 ? 2 : 1, list = [];
  for (const s of WD.setts) { if (!G.explored[s.i]) continue; const [wx, wy] = settWorld(s); const [sx, sy] = w2s(wx, wy); if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 50) continue; list.push([sy, s, sx]); }
  list.sort((a, b) => a[0] - b[0]);
  for (const [sy, s, sx] of list) {
    const S = G.setts[s.id], d = REALM_DEF[S.ctrl], big = s.type !== 'village';
    if (z <= 0.25 || (z === 0.5 && !big)) {
      if (!big && z <= 0.25) continue;
      const r = z < 0.25 ? (s.type === 'capital' ? 2 : 1) : s.type === 'capital' ? 3 : big ? 2 : 1; rect(sx - r - 1, sy - r - 1, r * 2 + 3, r * 2 + 3, PAL.o); rect(sx - r, sy - r, r * 2 + 1, r * 2 + 1, big ? d.col : '#e8d8a8');
      if (s.type === 'capital') spr('i_crown', sx - 2, sy - 9);
      if (z === 0.5 || s.type === 'capital' || (z <= 0.25 && s.type === 'town')) { if (z <= 0.25 && s.type !== 'capital') { } else txt(s.name, sx, sy + 5, settLabelCol(S), { al: 'c', sh: PAL.o, f: s.type === 'capital' ? 'm' : 's' }); }
      hit(sx - 5, sy - 5, 11, 11, { id: 'sett' + s.id, cursor: true, tip: () => settTip(s.id), onClick: c => clickSett(s.id, c) });
      if (S.siege) drawSiegeFx(sx, sy, 1);
      continue;
    }
    const sp = settSprite(s.type, WD.provs[s.prov].cul || 'K', s.id);
    const x0 = Math.round(sx - sp.w * sc / 2), y0 = Math.round(sy - sp.h * sc + 3 * sc);
    ctx.globalAlpha = 0.35; rect(x0 + 2 * sc, sy + 1 * sc, sp.w * sc - 4 * sc, 2 * sc, '#10140c'); ctx.globalAlpha = 1;
    if (sc === 2) ctx.drawImage(sp.c, x0, y0, sp.w * 2, sp.h * 2); else ctx.drawImage(sp.c, x0, y0);
    for (const [fx, fy] of sp.flags) { if (sc === 2) { drawFlag(x0 + fx * 2, y0 + fy * 2 - 4, d.col, d.dark, NOW); } else drawFlag(x0 + fx, y0 + fy - 5, d.col, d.dark, NOW); }
    if (S.siege) drawSiegeFx(sx, sy - 4 * sc, sc);
    const showName = big || z >= 2; if (showName) { const f = s.type === 'capital' || s.type === 'town' ? 'm' : 's'; txt(s.name, sx, sy + 5 * sc, settLabelCol(S), { al: 'c', sh: PAL.o, f }); if (s.type === 'capital') spr('i_crown', sx - tw(s.name) / 2 - 8, sy + 5 * sc); }
    hit(x0, y0, sp.w * sc, sp.h * sc + 6, { id: 'sett' + s.id, cursor: true, tip: () => settTip(s.id), onClick: c => clickSett(s.id, c) });
  }
}
function drawSiegeFx(sx, sy, sc) {
  for (let k = 0; k < 3; k++) { const ph = (NOW * 0.7 + k * 0.33) % 1; ctx.globalAlpha = 0.5 * (1 - ph); disc(sx + Math.sin(k * 2 + NOW) * 3, sy - 6 - ph * 16 * sc, 1 + ph * 3 * sc, '#4a4440'); }
  ctx.globalAlpha = 1; if (Math.sin(NOW * 9) > -0.3) { px(sx - 1, sy - 3, '#ff9a3c'); px(sx + 1, sy - 4, '#ffe07a'); }
  spr('a_tent', sx - 16 * sc, sy + 2, sc > 1 ? { scale: 2 } : undefined); spr('a_tent', sx + 8 * sc, sy + 4, sc > 1 ? { scale: 2 } : undefined);
}
function drawSigns() {
  if (cam.z < 0.5) return;
  for (const s of SIGNS) {
    const [wx, wy] = MAPR.warpPt(s.x * TS, s.y * TS); const [sx, sy] = w2s(wx, wy); if (sx < -10 || sy < -10 || sx > W + 10 || sy > H + 10) continue;
    const I = SIGN_INFO[s.k]; const bob = Math.round(Math.sin(NOW * 3 + s.b) * 1.5);
    if (s.k.startsWith('dust')) { for (let k = 0; k < 4; k++) { const ph = (NOW * 0.5 + k / 4) % 1; ctx.globalAlpha = 0.45 * (1 - ph); disc(sx + (k - 1.5) * (s.k === 'dust_lo' ? 4 : 1.5), sy - ph * (s.k === 'dust_hi' ? 18 : 7), 2 + ph * 3, '#cbb48a'); } ctx.globalAlpha = 1; }
    else if (s.k.startsWith('smoke')) { const n = s.k === 'smoke_many' ? 5 : 2; for (let k = 0; k < n; k++) { const ph = (NOW * 0.4 + k / n) % 1; ctx.globalAlpha = 0.4 * (1 - ph); disc(sx + (k - n / 2) * 4 + Math.sin(NOW + k) * 2, sy - ph * 14, 1 + ph * 2.5, '#8a8480'); } ctx.globalAlpha = 1; }
    else { for (let k = 0; k < 4; k++) { const a = NOW * 2 + k * 1.6; px(sx + Math.cos(a) * (4 + k), sy - 6 + Math.sin(a * 1.3) * 3 + bob, '#1b1420'); px(sx + Math.cos(a) * (4 + k) + 1, sy - 7 + Math.sin(a * 1.3) * 3 + bob, '#1b1420'); } }
    spr('i_' + I.ic, sx - 2, sy + bob, { alpha: 0.9 });
    hit(sx - 7, sy - 12, 14, 18, { id: 'sign' + s.b, tip: [{ t: I.n, ic: 'i_' + I.ic }, { t: I.q, c: '#e8d8b0' }, { t: 'Подробнее о знаках — «Трактат», гл. 9.', c: UIC.dim }] });
  }
}
function drawArmies() {
  const z = cam.z, sc = z >= 2 ? 2 : 1, list = [];
  for (const a of G.armies) { if (!a.alive || !armyVisible(a)) continue; const [wx, wy] = armyWorld(a); const [sx, sy] = w2s(wx, wy); if (sx < -30 || sy < -30 || sx > W + 30 || sy > H + 30) continue; list.push([sy, a, sx]); }
  list.sort((p, q) => p[0] - q[0]);
  const pid = G.player.army;
  for (const [sy, a, sx] of list) {
    const d = REALM_DEF[a.realm], isP = a.id === pid, moving = a.path && a.path.length > 1 && a.pi < a.path.length - 1;
    if (z <= 0.25) { rect(sx - 2, sy - 2, 5, 5, PAL.o); rect(sx - 1, sy - 1, 3, 3, isP ? '#fff' : d.col); hit(sx - 4, sy - 4, 9, 9, { id: 'army' + a.id, cursor: true, tip: () => armyTip(a), onClick: c => clickArmy(a, c) }); continue; }
    if (isP) { const r = 7 + Math.round(Math.sin(NOW * 4)); ctx.globalAlpha = 0.5; ring(sx, sy - 1, r * sc, '#fff2c8'); ctx.globalAlpha = 1; }
    ctx.globalAlpha = 0.35; rect(sx - 5 * sc, sy, 10 * sc, 2 * sc, '#0c0a10'); ctx.globalAlpha = 1;
    const bob = moving ? Math.round(Math.abs(Math.sin(NOW * 9 + a.id))) : 0;
    const camp = !moving && ['camp', 'fort', 'hide', 'forage', 'drill', 'siege'].includes(a.mode);
    let key = a.kind === 'bandit' ? 'a_bandit' : a.kind === 'caravan' ? 'a_wagon' : 'a_knight';
    const flip = moving && a.path[a.pi + 1] !== undefined && (a.path[a.pi + 1] % MW) + 0.5 < a.x;
    const o = sc > 1 ? { scale: 2 } : {}; if (flip && sc === 1) o.flip = true;
    if (camp && a.kind !== 'caravan') { spr('a_tent', sx - 10 * sc, sy - 6 * sc, o.scale ? { scale: 2 } : undefined); if (a.mode !== 'hide') { spr('a_camp', sx + 3 * sc, sy - 3 * sc, o.scale ? { scale: 2 } : undefined); if (Math.sin(NOW * 12 + a.id) > 0) px(sx + 5 * sc, sy - 4 * sc, '#ffe07a'); } if (a.mode === 'fort' && a.fortDays >= 1) { for (let k = -2; k <= 2; k++) vline(sx + k * 4 * sc, sy + 2 * sc, 3 * sc, '#6a4224'); hline(sx - 9 * sc, sy + 3 * sc, 18 * sc, '#8a5a34'); } }
    if (a.kind === 'bandit') { spr(key, sx - 6 * sc, sy - 7 * sc - bob, o); spr(key, sx - 1 * sc, sy - 6 * sc - bob, o); }
    else if (a.kind === 'caravan') { spr('a_ox', sx - 11 * sc, sy - 4 * sc - bob, o); spr(key, sx - 6 * sc, sy - 7 * sc, o); }
    else { if (!camp || isP) spr(key, sx - 6 * sc, sy - 11 * sc - bob, o); if (armyMen(a) > 150) spr('a_foot', sx + 3 * sc, sy - 7 * sc - bob, o); if (armyMen(a) > 400) spr('a_foot', sx - 9 * sc, sy - 6 * sc - bob, o); }
    if (a.kind !== 'bandit') drawFlag(sx + (flip ? -4 : 3) * sc, sy - 19 * sc - bob, d.col, d.dark, NOW);
    if (a.hidden) { ctx.globalAlpha = 0.5; spr('i_eye', sx - 2, sy - 24 * sc); ctx.globalAlpha = 1; }
    if (a.fires) { for (let k = 0; k < 3; k++) if (Math.sin(NOW * 10 + k * 2) > -0.2) px(sx - 8 + k * 7, sy + 4, '#ff9a3c'); }
    if (z >= 1) { const e = estimateMen(a); const lab = (e.exact ? '' : '~') + fmt(e.n); const lw = tw(lab, { f: 's' }) + 4; const ly = settAtTile(armyTile(a)) >= 0 ? sy - 30 * sc - bob : sy + 3 * sc; // in a town the label goes above the flag, off the town's name
      rect(sx - lw / 2, ly, lw, 7, isP ? '#22408a' : hostile(G.player.realm, a.realm) ? '#7a1e2a' : '#3a2a1e'); txt(lab, sx, ly + 1, '#fff2c8', { al: 'c', f: 's' }); }
    hit(sx - 8 * sc, sy - 16 * sc, 16 * sc, 22 * sc, { id: 'army' + a.id, cursor: true, tip: () => armyTip(a), onClick: c => clickArmy(a, c) });
  }
}
// ---------- weather particles ----------
const WX = { p: [] };
function drawWeather() {
  const k = G.weather.k; const Wt = WEATHER[k];
  if (k === 'fog') { ctx.globalAlpha = 0.18 + Math.sin(NOW * 0.3) * 0.04; rect(0, 0, W, H, '#d8dce0'); ctx.globalAlpha = 1; }
  if (Wt.cold) { ctx.globalAlpha = 0.08; rect(0, 0, W, H, '#dfe8f4'); ctx.globalAlpha = 1; }
  if (k === 'heat') { ctx.globalAlpha = 0.06; rect(0, 0, W, H, '#ffb040'); ctx.globalAlpha = 1; }
  const n = k === 'rain' ? 90 : k === 'storm' ? 200 : k === 'snow' ? 110 : k === 'blizzard' ? 260 : 0; if (!n) return;
  const snow = !!Wt.cold, t = NOW;
  for (let i = 0; i < n; i++) {
    const sp = snow ? 18 + (i % 7) * 3 : 220 + (i % 5) * 30, wind = k === 'blizzard' ? 80 : k === 'storm' ? 60 : snow ? 12 : 30;
    const x = ((hash2(i, 1, 9) * W * 1.3 + t * wind) % (W * 1.3)) - W * 0.15, y = ((hash2(i, 2, 9) * H + t * sp) % (H + 20)) - 10;
    if (snow) { const wob = Math.sin(t * 2 + i) * 2; rect(x + wob, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2, 'rgba(255,255,255,0.8)'); }
    else { ctx.fillStyle = 'rgba(190,210,235,0.45)'; ctx.fillRect(x | 0, y | 0, 1, 4); ctx.fillRect((x | 0) - 1, (y | 0) + 4, 1, 2); }
  }
  if (k === 'storm' && Math.sin(t * 0.7) > 0.995) { ctx.globalAlpha = 0.25; rect(0, 0, W, H, '#fff'); ctx.globalAlpha = 1; }
}
// ---------- tooltips ----------
function settTip(sid) {
  const s = WD.setts[sid], S = G.setts[sid], own = S.ctrl === G.player.realm, vis = own || G.vis[s.i] === 2 || hasInward(S.ctrl);
  const typ = { village: 'Деревня', castle: 'Замок', town: 'Город', capital: 'Столица' }[s.type];
  const L = [{ t: s.name + ' — ' + typ, ic: 'shield' + S.ctrl }, { t: REALM_DEF[S.ctrl].name + (S.owner !== S.ctrl ? ' (занято; владелец: ' + REALM_DEF[S.owner].name + ')' : ''), c: settLabelCol(S) }, 'Провинция ' + WD.provs[s.prov].name + ' · жителей ' + fmt(S.pop)];
  { const pa = playerArmy(), o = pa ? [pa.x, pa.y] : (() => { const c = WD.setts[G.realms[G.player.realm].capital]; return c ? [c.x + 0.5, c.y + 0.5] : null; })(); if (o) { const dk = Math.hypot(o[0] - s.x - 0.5, o[1] - s.y - 0.5) * KM_PER_TILE; if (dk > 4) L.push({ t: kmTxt(dk) + ' по прямой от ' + (pa ? 'войска' : 'столицы') + ' (≈' + Math.max(1, Math.round(dk / KM_PER_TILE / BASE_SPEED)) + ' дн. пути)', c: UIC.dim }); } }
  if (S.walls) L.push('Стены: ' + ['нет', 'частокол', 'каменные', 'мощные'][S.walls]);
  L.push(vis ? 'Гарнизон: ' + menOf(S.gar) : 'Гарнизон: неизвестно (нет обзора)');
  if (S.siege) { const by = armyById(S.siege.by); L.push({ t: 'В осаде' + (by ? ': ' + armyLabel(by) : '') + ' · запасы ' + Math.round(S.food) + ' дн.', c: UIC.bad }); }
  if (G.provs[s.prov].dev > 0.15) L.push({ t: 'Разорение ' + Math.round(G.provs[s.prov].dev * 100) + '%', c: UIC.warn });
  { const ml = settMarketLine(S); if (ml) L.push(ml); }
  const pa = playerArmy();
  if (!pa) L.push({ t: 'Король в замке. Щелчок — сведения: послать войско или поехать самому.', c: UIC.dim });
  else if (settHere(pa) === sid) L.push({ t: 'Войско здесь. Щелчок — войти.', c: UIC.good });
  else if (hostile(G.player.realm, S.ctrl)) L.push({ t: 'Враждебно. Щелчок — идти на приступ (осада по прибытии).', c: UIC.dim }); else L.push({ t: 'Щелчок — идти и войти по прибытии · ПКМ — сведения.', c: UIC.dim });
  return L;
}
function armyTip(a) {
  const e = estimateMen(a), g = charOf(a.gen), isP = a.id === G.player.army;
  const L = [{ t: armyLabel(a), ic: 'shield' + a.realm }];
  if (g && a.kind !== 'caravan') L.push(charName(g) + ' · ' + g.traits.map(t => TRAITS[t].n).join(', '));
  L.push((e.exact ? 'Воинов: ' : 'Воинов: около ') + fmt(e.n) + (a.fires ? ' (костров много!)' : ''));
  if (e.exact || isP) L.push(UT.filter(t => a.u[t] > 0).map(t => UNIT[t].n + ' ' + Math.round(a.u[t])).join(', '));
  else L.push({ t: 'Подойдите ближе или пошлите лазутчика, чтобы узнать точнее.', c: UIC.dim });
  if (a.kind === 'caravan') for (const l of caravanTipLines(a, e.exact)) L.push(l);
  if (!isP) { const pa = playerArmy(); if (pa && a.kind !== 'caravan') { const r = perceivedPower(a, G.player.realm) / Math.max(1, powerU(pa.u, pa.xp)); L.push({ t: 'Сила против нас: ' + (r < 0.5 ? 'намного слабее' : r < 0.85 ? 'слабее' : r < 1.2 ? 'равны' : r < 2 ? 'сильнее' : 'намного сильнее'), c: r < 0.85 ? UIC.good : r < 1.2 ? UIC.warn : UIC.bad }); }
    if (hostile(G.player.realm, a.realm)) L.push({ t: 'Враг. Щелчок — преследовать.', c: UIC.dim }); }
  else { const sh = settHere(a); L.push({ t: sh >= 0 && !a.path ? 'Щелчок — войти в ' + WD.setts[sh].name + ' · ПКМ или V — окно войска.' : 'Щелчок — подробности о войске.', c: UIC.dim }); }
  return L;
}
function tileTip(t) {
  const T = WD.ter[t], p = WD.prov[t]; const L = [TINFO[T].n];
  if (WD.river[t]) L[0] += WD.bridge[t] ? ' · мост' : WD.ford[t] ? ' · брод' : ' · река';
  if (WD.road[t]) L[0] += WD.road[t] === 2 ? ' · тракт' : ' · дорога';
  if (p >= 0) L.push('пров. ' + WD.provs[p].name + ' (' + REALM_DEF[G.setts[WD.provs[p].seat].ctrl].name + ')');
  const pa = playerArmy(); if (pa && passable(T)) L.push('ход ×' + stepCost(pa, t).toFixed(1));
  return L.join(' · ');
}
// ---------- path preview on hover ----------
function updateHoverPreview() {
  UI.hoverTile = -1; const hs = HOVER && /^sett\d+$/.test(HOVER.id) ? +HOVER.id.slice(4) : -1; if (!HOVER || (HOVER.id !== 'map' && hs < 0) || UI.paused() && UI.win) return;
  const t = hs >= 0 ? WD.setts[hs].i : tileAtScreen(input.mx, input.my); UI.hoverTile = t; const pa = playerArmy(); if (!pa || t < 0) { UI.prev = null; return; }
  // long searches on the big map: wait a little longer after an expensive one
  if (t !== UI.prevGoal && NOW - UI.prevAt > Math.max(0.1, (UI.prevMs || 0) * 0.005)) { UI.prevGoal = t; UI.prevAt = NOW; if (!passable(WD.ter[t])) { UI.prev = null; return; } const t0 = performance.now(), p = planPath(pa, t); UI.prevMs = performance.now() - t0; UI.prev = p && p.length > 1 ? { path: p, days: pathDays(pa, p), km: pathKm(p), t } : null; }
}
function drawHoverPreview() {
  const pa = playerArmy(); if (!pa || !UI.prev || UI.hoverTile !== UI.prev.t || UI.win || UI.modalOpen()) return;
  drawPath(pa, UI.prev.path, 0, 'rgba(255,242,200,0.75)', false);
  const d = UI.prev.days; const eat = armyMen(pa) + pa.wounded + pa.sick, foodD = pa.food / Math.max(1, eat);
  const lab = kmTxt(UI.prev.km || 0) + ' · ~' + (d < 10 ? d.toFixed(1).replace('.', ',') : Math.round(d)) + ' ' + plural(Math.ceil(d), 'день', 'дня', 'дней');
  const warn = foodD < d ? ' · провианта на ' + Math.floor(foodD) + ' дн.!' : '';
  const s = lab + warn; const w = tw(s) + 8; let x = input.mx + 12, y = input.my - 16; if (x + w > W) x = input.mx - w - 6;
  rect(x, y, w, 11, 'rgba(20,14,12,0.85)'); txt(s, x + 4, y + 2, warn ? UIC.warn : '#fff2c8');
}
// ---------- HUD ----------
function drawTopBar() {
  const r = G.realms[G.player.realm], pa = playerArmy();
  rect(0, 0, W, 19, PAL.o); rect(0, 0, W, 18, '#2a1d16'); hline(0, 0, W, '#4a3020'); hline(0, 17, W, '#6a4428');
  let x = 4; spr('shield' + G.player.realm, x, 3); hit(x, 2, 12, 14, { id: 'tb_realm', cursor: true, tip: 'Держава (R)', onClick: () => UI.open({ k: 'realm' }) }); x += 16;
  const net = (r.inc || 0) - (r.exp || 0), gb = G.court ? bookGold() : r.gold;
  spr('i_gold', x, 7); txt(fmt(gb), x + 8, 6, gb < 0 ? UIC.bad : PAL.y); let x2 = x + 10 + tw(fmt(gb)); txt((net >= 0 ? '+' : '−') + Math.abs(net).toFixed(1), x2, 6, net >= 0 ? UIC.good : UIC.bad, { f: 's' });
  hit(x, 2, x2 + 26 - x, 14, { id: 'tb_gold', tip: () => goldTip() }); x = x2 + 30;
  if (!pa && G.court && G.atCourt) x = mapCourtBar(x);
  if (pa) {
    const men = armyMen(pa), eat = men + pa.wounded + pa.sick, fd = pa.food / Math.max(1, eat);
    spr('i_men', x, 7); txt(fmt(men), x + 8, 6, PAL.w); hit(x, 2, 36, 14, { id: 'tb_men', tip: () => ['Войско короля: ' + voin(men), 'Раненых ' + Math.round(pa.wounded) + ', больных ' + Math.round(pa.sick), { t: 'V — окно войска', c: UIC.dim }] }); x += 40;
    spr('i_food', x, 7); txt(Math.floor(fd) + ' дн.', x + 8, 6, fd < 3 ? UIC.bad : fd < 7 ? UIC.warn : PAL.w); hit(x, 2, 44, 14, { id: 'tb_food', tip: ['Провиант: ' + Math.round(pa.food) + ' (на ' + fd.toFixed(1) + ' дн.)', 'Каждый воин съедает 1 в день. Каждый несёт 3, повозка — 400.', 'В своих городах войско стоит на постое: город кормит его за золото казны.', { t: '«Войско без обоза погибает; без провианта — погибает» (гл. 7).', c: '#e8d8b0' }] }); x += 48;
    spr('i_water', x, 7); txt(Math.round(pa.water) + '', x + 8, 6, pa.thirst ? UIC.bad : pa.water < 1.5 ? UIC.warn : PAL.w); hit(x, 2, 22, 14, { id: 'tb_water', tip: ['Вода: запас на ' + Math.round(pa.water) + ' дн.', 'Пополняется у рек, озёр и поселений (не у моря); в дождь и снегопад не убывает.', { t: 'Полный запас: ' + waterCap(pa) + ' дн. (4 + повозки)', c: UIC.dim }] }); x += 24;
    spr('i_morale', x, 7); bar(x + 8, 7, 34, 6, pa.morale / 100, pa.morale < 35 ? '#c0353f' : pa.morale < 55 ? '#e0a630' : '#7fb04c'); hit(x, 2, 44, 14, { id: 'tb_mor', tip: () => moraleTip(pa) }); x += 48;
    spr('i_fat', x, 7); bar(x + 8, 7, 24, 6, pa.fat / 100, pa.fat > 70 ? '#c0353f' : '#c9a060'); hit(x, 2, 34, 14, { id: 'tb_fat', tip: ['Усталость: ' + Math.round(pa.fat) + '%', 'Растёт на марше (форсированный ×3), спадает на отдыхе. Усталые медленнее и слабее в бою.'] }); x += 36;
  }
  // date & weather (center-right)
  const Wt = weatherOf(); const ds = dateStr(G.day); const endX = G.court ? W - 186 - 4 * 13 - 4 : W - 186; let wn = Wt.n, totW = tw(ds) + 14 + tw(wn, { f: 's' }); if (x + 6 + totW > endX) { wn = ''; totW = tw(ds) + 12; } const dx0 = Math.max(x + 6, endX - totW);
  txt(ds, dx0, 6, '#fff2c8'); spr('i_' + Wt.ic, dx0 + tw(ds) + 4, 7); if (wn) txt(wn, dx0 + tw(ds) + 13, 6, '#c8d8e8', { f: 's' });
  hit(dx0, 2, totW, 14, { id: 'tb_date', tip: () => [ds, 'Погода: ' + Wt.n + (Wt.mv > 1 ? ' — марш медленнее ×' + Wt.mv : '') + (Wt.vis < 1 ? ', обзор ×' + Wt.vis : '') + (Wt.wet ? ', стрелы бьют хуже' : '') + (Wt.dry ? ', сухо — огонь силён' : '')].concat(calendarTip()) });
  // speed
  let bx = W - 182;
  speedBtns(bx);
  bx += 64;
  const B = [['i_book', 'Трактат «Искусство войны» (B)', () => UI.open({ k: 'book', ch: TUT.lastCh() })], ['i_dip', 'Дипломатия (N)', () => UI.open({ k: 'diplo', t: firstForeign() })], ['i_crown', 'Держава (R)', () => UI.open({ k: 'realm' })], ['i_map', 'Режим карты: ' + (G.mode === 'pol' ? 'политическая' : 'местность') + ' (Tab)', () => { G.mode = G.mode === 'pol' ? 'ter' : 'pol'; }], [typeof Snd !== 'undefined' && Snd.muted() ? 'i_mute' : 'i_snd', 'Звук и музыка (M)', () => Snd.toggle()], ['i_scroll', 'Меню (Esc)', () => UI.open({ k: 'menu' })]];
  B.forEach(([ic, tip, f], i) => btn('tb' + i, bx + i * 16, 2, 15, 14, { ic, style: 'dark', tip, onClick: f, active: (i === 0 && UI.win && UI.win.k === 'book') || (i === 1 && UI.win && UI.win.k === 'diplo') || (i === 2 && UI.win && UI.win.k === 'realm') || (i === 3 && G.mode === 'pol') }));
  if (G.court) { const B3 = [['i_seal', 'Малый совет (K)', 'council'], ['i_family', 'Династия и дома (Y)', 'dyn'], ['i_flask', 'Знания (J)', 'tech'], ['i_scroll', 'Письма (L)', 'letters']]; let x3 = W - 182 - 4 * 13 - 3;
    B3.forEach(([ic, tip, k], i) => btn('tb3' + i, x3 + i * 13, 2, 12, 14, { ic, style: 'dark', tip, active: !!(UI.win && UI.win.k === k), onClick: () => { if (UI.win && UI.win.k === k) UI.shut(); else UI.open({ k }); } })); }
}
function firstForeign() { for (const t of [1, 2, 3, 4]) if (alive(t) && G.rel[G.player.realm][t].war) return t; return 1; }
// time stands still while a window, a letter or a conversation is open: the speed bar shows it, and which speed will resume
function timeHeld() { return !!G && G.speed > 0 && (!!UI.win || UI.modalOpen() || (typeof DLG !== 'undefined' && DLG.open()) || (typeof TUT !== 'undefined' && TUT.blocking())); }
function speedBtns(bx) { const held = timeHeld();
  ['pause', 'play1', 'play2', 'play3'].forEach((ic, i) => { btn('spd' + i, bx + i * 15, 2, 14, 14, { ic: 'i_' + ic, style: 'dark', active: held ? i === 0 : G.speed === i, tip: i === 0 && held ? ['Время стоит', { t: 'Пока открыто окно, письмо или идёт разговор, время не идёт. Закройте окно — и оно пойдёт со скоростью ' + G.speed + '.', c: PAL.w }] : ['Пауза (Пробел)', 'Скорость 1', 'Скорость 2', 'Скорость 3'][i], onClick: () => setSpeed(i) }); });
  if (held) { const a = 0.55 + Math.sin(NOW * 3) * 0.3; ctx.globalAlpha = a; rect(bx + G.speed * 15 + 3, 13, 8, 1, PAL.y); ctx.globalAlpha = 1; } }
function setSpeed(i) { G.speed = i; if (i > 0) UI.lastSpeed = i; if (typeof Snd !== 'undefined') Snd.sfx('click'); }
function goldTip() {
  const r = G.realms[G.player.realm]; const L = [G.court ? 'Казна: ' + Math.round(bookGold()) + ' зол. — по книгам казначея' : 'Казна: ' + Math.round(r.gold) + ' зол.', { t: 'Доход: +' + (r.inc || 0).toFixed(1) + ' в день (налоги провинций)', c: UIC.good }, { t: 'Расход: −' + (r.exp || 0).toFixed(1) + ' в день (жалованье войску и гарнизонам)', c: UIC.bad }];
  L.push({ t: '«Если война длится долго — истощаются средства государства» (гл. 2).', c: '#e8d8b0' }); return L;
}
function moraleTarget(a) {
  const men = Math.max(1, armyMen(a)), gen = charOf(a.gen), L = []; const add = (t, v) => { v = Math.round(v); if (v) L.push({ t, v }); };
  add('Основа', 62); if (gen) add('Полководец', traitSum(gen, 'mor'));
  if (a.hunger) add('Голод', -(18 + a.hunger * 3)); if (a.thirst) add('Жажда', -25); add('Усталость', -a.fat / 5); add('Больные', -(a.sick / men) * 60);
  if (a.realm < 5 && G.realms[a.realm].gold < 0) add('Нет жалованья', -25); if (a.vict) add(a.vict > 0 ? 'Недавняя победа' : 'Недавнее поражение', a.vict);
  const gr = a.ground; if (gr === 'serious') add('Тяжёлая земля: сплочённость', 5); if (gr === 'dispersive') add('Рассеивающая земля: тоска по дому', -3);
  const sid = settNear(a.x, a.y, 1.2); if (sid >= 0 && G.setts[sid].ctrl === a.realm) add('В своём поселении', 6);
  if (a.mode === 'fort' && a.fortDays >= 2) add('Укреплённый лагерь', 4); if (a.mode === 'drill') add('Учения', 2); if (seasonOf(G.day) === 3 && !(sid >= 0 && G.setts[sid].ctrl === a.realm)) add('Зима в поле', -6);
  return L;
}
function moraleTip(a) { const L = moraleTarget(a); const s = L.reduce((x, l) => x + l.v, 0); return ['Боевой дух: ' + Math.round(a.morale) + ' → ' + clamp(s, 5, 100)].concat(L.map(l => ({ t: (l.v > 0 ? '+' : '−') + Math.abs(l.v) + ' ' + l.t, c: l.v > 0 ? UIC.good : UIC.bad }))).concat([{ t: 'Ниже 35 — дезертирство.', c: UIC.dim }]); }
function drawArmyCard() {
  const pa = playerArmy(); if (!pa) return; const x = 2, y = H - 80, w = 236, h = 78;
  panelWood(x, y, w, h); const g = charOf(pa.gen);
  drawPortrait(g, x + 5, y + 5, 1); strokeR(x + 4, y + 4, 50, 50, '#c9a060');
  hit(x + 4, y + 4, 50, 50, { id: 'card_por', cursor: true, tip: [charName(g), g.traits.map(t => TRAITS[t].n + ': ' + TRAITS[t].d).join(' '), { t: 'Щелчок — окно войска (V)', c: UIC.dim }], onClick: () => UI.open({ k: 'army' }) });
  txt(charName(g), x + 58, y + 6, PAL.y);
  const gr = GROUNDS[pa.ground || 'open'];
  txt('Земля: ' + gr.n, x + 58, y + 16, '#c8d8a8', { f: 's' }); hit(x + 58, y + 14, 120, 9, { id: 'card_gr', tip: () => { const G0 = GROUNDS[pa.ground || 'open']; return ['Девять местностей (гл. 11): ' + G0.n, { t: '«' + G0.q + '»', c: '#e8d8b0' }, G0.e]; } });
  const md = pa.siegeOf >= 0 ? 'Осада: ' + WD.setts[pa.siegeOf].name : pa.path ? (pa.forced ? 'Форсированный марш' : 'Марш') + (G.player.follow >= 0 ? ' (погоня)' : '') : MODE_INFO[pa.mode] ? MODE_INFO[pa.mode].n : 'Стоит';
  txt(md, x + 58, y + 25, '#fff2c8', { f: 's' });
  // units
  const UTs = UT.filter(t => pa.u[t] > 0), ust = UTs.length > 5 ? Math.floor(170 / UTs.length) : 34; let ux = x + 58; for (const t of UTs) { spr(UICON[t], ux, y + 34); txt(String(Math.round(pa.u[t])), ux + 7, y + 34, PAL.w, { f: 's' }); hit(ux, y + 32, ust - 2, 9, { id: 'card_u' + t, tip: [UNIT[t].n + ': ' + Math.round(pa.u[t]), 'Атака ' + UNIT[t].atk + ', защита ' + UNIT[t].def + ', опыт ' + Math.round(pa.xp[t] || 0)] }); ux += ust; }
  // supplies
  const men = armyMen(pa), eat = men + pa.wounded + pa.sick; const horsesN = mountedN(pa.u) + pa.horses + pa.wagons * 2;
  const sup = [['i_food', pa.food / Math.max(1, eat), 'Провиант на ' + (pa.food / Math.max(1, eat)).toFixed(1) + ' дн. (' + Math.round(pa.food) + ')'], ['i_fodder', horsesN ? pa.fodder / horsesN : 99, 'Фураж: ' + Math.round(pa.fodder) + ' (коней и волов ' + horsesN + '; весной и летом пасутся)'], ['i_arrows', rangedN(pa.u) ? pa.arrows / rangedN(pa.u) : 99, 'Стрелы и болты: ' + Math.round(pa.arrows) + (rangedN(pa.u) ? ' (' + Math.round(pa.arrows / rangedN(pa.u)) + ' на стрелка)' : '')], ['i_wagon', 1 - armyLoad(pa) / Math.max(1, armyCap(pa)), 'Обоз: ' + Math.round(armyLoad(pa)) + ' / ' + armyCap(pa) + ' (повозок ' + pa.wagons + ')']];
  sup.forEach(([ic, v, tip], i) => { const sx = x + 6 + i * 57, sy = y + 58; spr(ic, sx, sy); const vv = ic === 'i_wagon' ? v : clamp(v / 10, 0, 1); bar(sx + 7, sy, 46, 6, vv, vv < 0.2 ? '#c0353f' : vv < 0.45 ? '#e0a630' : '#7fb04c'); hit(sx, sy - 1, 54, 8, { id: 'card_s' + i, tip }); });
  // modes
  const modes = [['march', 'i_flag'], ['camp', 'i_tent'], ['fort', 'i_shield'], ['hide', 'i_eye'], ['forage', 'i_fodder'], ['drill', 'i_sword']];
  let mx = x + 6; const my = y + 67;
  modes.forEach(([m, ic]) => { const act = m === 'march' ? !!pa.path : (!pa.path && pa.mode === m); btn('mode_' + m, mx, my, 15, 10, { ic, style: 'dark', active: act, tip: [MODE_INFO[m].n, MODE_INFO[m].d], onClick: () => m === 'march' ? (pa.forced = 0, UI.toast('Обычный шаг')) : setMode(m) }); mx += 16; });
  btn('mode_forced', mx, my, 15, 10, { ic: 'i_play3', style: 'dark', active: !!pa.forced, tip: ['Форсированный марш: ' + (pa.forced ? 'ВКЛ' : 'выкл'), 'Скорость +35%, но усталость ×3. «Пройдёшь сто ли ради выгоды — потеряешь полководцев» (гл. 7).'], onClick: () => { pa.forced = pa.forced ? 0 : 1; if (typeof TUT !== 'undefined') TUT.ev('forced', pa.forced); } }); mx += 16;
  btn('mode_fires', mx, my, 15, 10, { ic: 'i_fire', style: 'dark', active: !!pa.fires, tip: ['Ложные костры: ' + (pa.fires ? 'ВКЛ' : 'выкл'), 'Жечь вдвое больше костров: враг сочтёт войско почти вдвое большим. «Война — путь обмана» (гл. 1).'], onClick: () => setMode('fires') }); mx += 16;
  btn('mode_center', mx + 4, my, 15, 10, { ic: 'i_pin', style: 'dark', tip: 'Показать войско (C)', onClick: centerArmy });
  btn('card_open', x + w - 18, y + 5, 13, 11, { ic: 'i_scroll', style: 'dark', tip: 'Окно войска (V)', onClick: () => UI.open({ k: 'army' }) });
}
function drawFeed() {
  const x = W - 236, y0 = H - 96; let y = y0; const now = NOW;
  const list = UI.feed.filter(f => now - f.at < 14).slice(-5).reverse();
  for (const f of list) {
    const a = clamp(1 - (now - f.at - 11) / 3, 0, 1); const lines = wrap(f.t, 226); const h = lines.length * 9 + 3; y -= h + 1;
    ctx.globalAlpha = a * 0.85; rect(x, y, 234, h, '#160f0c'); ctx.globalAlpha = a;
    const c = { good: UIC.good, bad: UIC.bad, war: '#ff8a6a', title: PAL.y, season: '#bfe8f0', info: '#e8dcc0' }[f.c] || '#e8dcc0';
    lines.forEach((l, i) => txt(l, x + 4, y + 2 + i * 9, c)); ctx.globalAlpha = 1;
  }
}
function drawMsgs() {
  const L = G.msgs.filter(m => !m.done && (m.kind === 'peace' || m.kind === 'call' || m.kind === 'ransom' || m.kind === 'offer'));
  let x = W / 2 - L.length * 9; const y = 21;
  for (const m of L) { const bob = Math.round(Math.sin(NOW * 4 + m.id) * 1); btn('msg' + m.id, x, y + bob, 17, 15, { ic: 'i_raven', style: 'parch', tip: [{ t: 'Ворон: ' + realmName(m.from), ic: 'shield' + m.from }, m.text, { t: 'Щелчок — ответить', c: UIC.dim }], onClick: () => UI.alert('msg', m) }); x += 19; }
}
function drawStatus() {
  const t = UI.hoverTile; let s = '';
  if (t >= 0 && HOVER && HOVER.id === 'map') s = tileTip(t);
  if (UI.target) s = (UI.target.kind === 'cmd' ? 'Приказ «' + ((CMD[UI.target.o] || {}).n || '') + '»: укажите ' + (UI.target.o === 'join' ? 'войско' : 'крепость') + ' на карте' : 'Лазутчик: выберите цель на карте') + ' · ПКМ — отмена' + (t >= 0 && WD.prov[t] >= 0 ? ' · ' + WD.provs[WD.prov[t]].name : '');
  if (!s) return; const w = tw(s, { f: 's' }) + 10; const x = clamp(W / 2 - w / 2 - 20, 242, W - 140 - w);
  rect(x, H - 12, w, 11, 'rgba(20,14,12,0.8)'); txt(s, x + 5, H - 9, '#e8dcc0', { f: 's' });
}
function drawToast() { // top layer: above windows and dialogs, so answers are never hidden
  if (!(UI.toastT > NOW)) return; const a = clamp((UI.toastT - NOW) * 3, 0, 1); const L = wrap(UI.toastS, 380); const w = Math.max(...L.map(l => tw(l))) + 16, h = L.length * 10 + 5, y = UI.win || UI.modalOpen() ? H - 46 - h : 40;
  ctx.globalAlpha = a; rect(W / 2 - w / 2 - 1, y - 1, w + 2, h + 2, PAL.o); rect(W / 2 - w / 2, y, w, h, 'rgba(32,22,16,0.96)'); strokeR(W / 2 - w / 2, y, w, h, '#c9a060'); L.forEach((l, i) => txt(l, W / 2, y + 3 + i * 10, PAL.y, { al: 'c' })); ctx.globalAlpha = 1; }
// ---------- auto-pause: stop the clock when something ends, so the player decides what next ----------
const OPTS = (() => { try { return Object.assign({ autoPause: true }, JSON.parse(localStorage.getItem('sk3_opts') || '{}')); } catch (_) { return { autoPause: true }; } })();
function saveOpts() { try { localStorage.setItem('sk3_opts', JSON.stringify(OPTS)); } catch (_) { } }
function autoPause(reason) { if (!G || !OPTS.autoPause || G.over) return; if (G.speed > 0) UI.lastSpeed = G.speed; G.speed = 0; if (reason) UI.toast(reason + ' · пауза'); }
function drawPausedBadge() {
  if (G.speed === 0 && !UI.win && !UI.modalOpen()) { const s = 'ПАУЗА'; const w = tw(s) + 12; const a = 0.6 + Math.sin(NOW * 3) * 0.3; ctx.globalAlpha = a; rect(W / 2 - w / 2, 22, w, 12, '#2a1d16'); txt(s, W / 2, 25, PAL.y, { al: 'c' }); ctx.globalAlpha = 1; }
}
function mapClick(c) {
  if (c.drag) return; const t = tileAtScreen(c.ux, c.uy); if (t < 0) return;
  if (UI.target && UI.target.kind === 'cmd') {
    if (c.b === 2) { UI.target = null; UI.toast('Отменено.'); return; }
    const sid = settNear(t % MW + 0.5, Math.floor(t / MW) + 0.5, 1.6); if (sid >= 0 && UI.target.o !== 'join') { cmdPickSett(sid); return; }
    UI.toast(UI.target.o === 'join' ? 'Щёлкните по войску короны.' : 'Щёлкните по крепости или деревне.'); return;
  }
  if (UI.target) {
    const tg = UI.target; UI.target = null; if (c.b === 2) { UI.toast('Отменено.'); return; }
    const pv = WD.prov[t];
    if (tg.kind === 'surviving') { if (hireSpy('surviving', { x: t % MW, y: Math.floor(t / MW) })) UI.toast('Лазутчик в пути.'); else UI.toast('Не хватает золота.'); return; }
    if (pv < 0) { UI.toast('Здесь нет провинции.'); return; }
    if (tg.kind === 'local') { if (hireSpy('local', { prov: pv })) UI.toast('Проводники наняты: ' + WD.provs[pv].name + '.'); else UI.toast('Не хватает золота.'); return; }
    if (tg.kind === 'doomed') { if (G.setts[WD.provs[pv].seat].ctrl !== tg.realm) { UI.toast('Нужна провинция державы ' + realmName(tg.realm) + '.'); return; } hireSpy('doomed', { realm: tg.realm, prov: pv }); return; }
    return;
  }
  if (c.b === 2) { const pa = playerArmy(); if (pa && pa.path) { pa.path = null; pa.onArrive = null; G.player.follow = -1; UI.toast('Стой!'); } return; }
  if (!playerArmy()) return;
  orderMove(t);
}
function drawHUD() {
  drawHoverPreview();
  drawTopBar(); drawArmyCard(); drawMinimap(W - 131, H - 83); drawFeed(); drawMsgs(); drawStatus(); drawPausedBadge();
}
