// ===== MAIN: boot, frame loop, input dispatch, hotkeys =====
let lastTS = 0, ERR = null, FPS = { n: 0, t: 0, v: 0, ms: 0, show: false }, PREV = { x: -100, y: -100 }, PANH = null;
const PANK = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
function zoomAt(dir, sx, sy) {
  const i = ZOOMS.indexOf(cam.z), j = clamp((i < 0 ? ZOOMS.indexOf(1) : i) + dir, 0, ZOOMS.length - 1); if (ZOOMS[j] === cam.z) return;
  const [wx, wy] = s2w(sx, sy); cam.z = ZOOMS[j]; cam.x = wx - (sx - W / 2) / cam.z; cam.y = wy - (sy - H / 2) / cam.z; camClamp();
}
const mapish = id => !!id && (id === 'map' || id.startsWith('sett') || id.startsWith('army') || id.startsWith('sign'));
function dispatchClicks() {
  for (const c of input.clicks) {
    const h = topHit(LAST, c.ux, c.uy); if (!h || !h.onClick) continue;
    const field = mapish(h.id) || h.id === 'bfield' || h.id === 'court';
    if (c.b === 1) continue; if (c.b === 2 && !field) continue;
    if (c.drag && !field) { const h0 = topHit(LAST, c.x, c.y); if (!h0 || h0.id !== h.id) continue; }
    if (!field && h.cursor !== false) Snd.sfx(h.sfx || 'click');
    try { h.onClick(c); } catch (e) { onErr(e); }
  }
  input.clicks.length = 0;
}
function onErr(e) { console.error(e); ERR = { s: String(e && e.stack || e).split('\n').slice(0, 3).join(' | '), t: NOW + 8 }; }
// ---------- map screen ----------
function mapKeys() {
  const blocked = UI.modalOpen() || (G.over && !G.over.ack);
  for (const k of input.keys) {
    const c = k.code;
    if (typeof DLG !== 'undefined' && DLG.open() && !UI.modalOpen()) { if (c === 'KeyM') Snd.toggle(); else DLG.key(k); continue; }
    if (c === 'Escape') { if (UI.target) { UI.target = null; UI.toast('Отменено.'); } else if (UI.win) UI.shut(); else if (!blocked) UI.open({ k: 'menu' }); continue; }
    if (blocked) continue;
    if (G.court) { // v3: the court's windows are reachable from the map too
      if (c === 'Tab' && G.atCourt && !playerArmy()) { backToCourt(); continue; }
      const pa0 = playerArmy(); const wk = { KeyK: 'council', KeyJ: 'tech', KeyL: 'letters', KeyG: 'cmd', KeyP: 'proj', KeyO: 'supply', KeyT: 'chron', KeyI: 'intel' }[c] || (c === 'KeyV' && !pa0 ? 'cmd' : null) || (c === 'KeyF' && !pa0 ? 'dyn' : null) || (c === 'KeyY' ? 'dyn' : null);
      if (wk) { if (UI.win && UI.win.k === wk) UI.shut(); else UI.open({ k: wk }); continue; }
    }
    if (c === 'Space') { if (UI.win) UI.shut(); setSpeed(G.speed > 0 ? 0 : (UI.lastSpeed || 1)); }
    else if (c === 'Digit1' || c === 'Numpad1') setSpeed(1); else if (c === 'Digit2' || c === 'Numpad2') setSpeed(2); else if (c === 'Digit3' || c === 'Numpad3') setSpeed(3);
    else if (c === 'Digit0' || c === 'Numpad0') setSpeed(0);
    else if (UI.win && !['KeyM', 'F3'].includes(c)) { const map = { KeyV: 'army', KeyN: 'diplo', KeyR: 'realm', KeyB: 'book' }; if (map[c] && UI.win.k === map[c]) UI.shut(); else if (map[c]) openWin(map[c]); }
    else if (c === 'Tab') { G.mode = G.mode === 'pol' ? 'ter' : 'pol'; Snd.sfx('click'); if (typeof TUT !== 'undefined') TUT.ev('mapmode', G.mode); }
    else if (c === 'KeyC') centerArmy();
    else if (c === 'KeyV') openWin('army'); else if (c === 'KeyN') openWin('diplo'); else if (c === 'KeyR') openWin('realm'); else if (c === 'KeyB') openWin('book');
    else if (c === 'KeyH' || c === 'F1') UI.alert('help');
    else if (c === 'KeyQ' || c === 'Minus' || c === 'NumpadSubtract') zoomAt(-1, W / 2, H / 2);
    else if (c === 'KeyE' || c === 'Equal' || c === 'NumpadAdd') zoomAt(1, W / 2, H / 2);
    else if (c === 'KeyF') { const pa = playerArmy(); if (pa) setMode(pa.mode === 'forage' ? 'march' : 'forage'); }
    if (c === 'KeyM') Snd.toggle();
    if (c === 'F3') FPS.show = !FPS.show;
  }
  input.keys.length = 0;
}
function openWin(k) {
  if (k === 'army') UI.open({ k: 'army' }); else if (k === 'diplo') UI.open({ k: 'diplo', t: firstForeign() }); else if (k === 'realm') UI.open({ k: 'realm' });
  else if (k === 'book') UI.open({ k: 'book', ch: typeof TUT !== 'undefined' ? TUT.lastCh() : 0 });
}
function mapCamera() {
  const free = !UI.win && !UI.modalOpen();
  // keyboard pan
  if (free) { let dx = 0, dy = 0; for (const c of input.held) { const v = PANK[c]; if (v) { dx += v[0]; dy += v[1]; } } if (dx || dy) { const sp = 320 / cam.z * Math.min(DT, 0.05) * (input.held.has('ShiftLeft') ? 2.2 : 1); cam.x += dx * sp; cam.y += dy * sp; camClamp(); G.player.follow = G.player.follow; } }
  // drag pan (left/middle/right button pressed on the map)
  let dragging = false;
  for (const b of [0, 1, 2]) { const d = input.down[b]; if (!d) continue; if (d.h === undefined) { const h = topHit(LAST, d.x, d.y); d.h = h ? h.id : null; } if (d.moved && (mapish(d.h) || (b === 1 && free))) { dragging = true; if (PREV.x > -50) { cam.x -= (input.mx - PREV.x) / cam.z; cam.y -= (input.my - PREV.y) / cam.z; camClamp(); } } }
  // wheel zoom over the map
  if (input.wheel && free && HOVER && mapish(HOVER.id)) zoomAt(input.wheel < 0 ? 1 : -1, input.mx, input.my);
  // edge scroll disabled (annoying in a browser window)
  return dragging;
}
function mapUpdate() {
  if (!G) return;
  if (G.court && !UI.paused() && !DLG.open()) worldAdvance(Math.min(DT, 0.1) / SPD[G.speed]);
  else if (!G.court && !UI.paused()) {
    const dd = Math.min(DT, 0.1) / SPD[G.speed];
    for (const a of G.armies) if (a.alive) advanceArmy(a, dd);
    updateFollow(); checkEncounters(); aiContacts();
    G.frac += dd; let n = 0;
    while (G.frac >= 1 && n++ < 3) { G.frac -= 1; dailyTick(); if (UI.paused() || SCREEN !== 'map') break; }
  }
  if (MAPDIRTY.pol && NOW - (MAPDIRTY.t || 0) > 0.4) refreshPolitics();
  updateHoverPreview();
}
function drawMapScreen() {
  drawWorld(); drawHUD();
  if (typeof DLG !== 'undefined') drawDialog();
  if (typeof TUT !== 'undefined') TUT.drawPanel();
  drawWindow(); drawModals(); drawToast();
}
// ---------- frame ----------
function frame(ts) {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  DT = lastTS ? Math.min(0.1, (ts - lastTS) / 1000) : 1 / 60; lastTS = ts; NOW = ts / 1000;
  LAST = HITS; HITS = []; HOVER = topHit(LAST, input.mx, input.my);
  try {
    if (G && G.visit && SCREEN !== 'court' && SCREEN !== 'loading') visitCleanup();
    if (SCREEN === 'map' && G && G.toCourt && !UI.modalOpen() && !(G.over && !G.over.ack)) { G.toCourt = 0; courtEnter('throne_front'); }
    if (SCREEN === 'map' && G) { mapKeys(); dispatchClicks(); const dr = mapCamera(); mapUpdate(); cv.style.cursor = dr ? 'grabbing' : HOVER && HOVER.cursor ? 'pointer' : 'default'; if (SCREEN === 'court') drawCourt(); else drawMapScreen(); }
    else if (SCREEN === 'court' && G) { courtKeys(); dispatchClicks(); courtUpdate(); if (SCREEN === 'court') drawCourt(); else if (SCREEN === 'map') drawMapScreen(); else if (SCREEN === 'battle' && BT) drawBattle(); cv.style.cursor = HOVER && HOVER.cursor ? 'pointer' : 'default'; }
    else if (SCREEN === 'battle') { battleKeys(); dispatchClicks(); battleUpdate(DT); if (SCREEN === 'battle') { drawBattle(); drawModals(); drawToast(); } else if (G) drawMapScreen(); else drawModals(); cv.style.cursor = HOVER && HOVER.cursor ? 'pointer' : 'default'; }
    else if (SCREEN === 'art') { for (const k of input.keys) { if (k.code === 'ArrowRight') DEVP++; if (k.code === 'ArrowLeft') DEVP = Math.max(0, DEVP - 1); } input.keys.length = 0; drawArtSheet(); }
    else if (SCREEN === 'loading') { input.keys.length = 0; input.clicks.length = 0; drawLoading(); }
    else { for (const k of input.keys) { if (k.code === 'Escape') { if (UI.win) UI.shut(); else if (UI.modals.length) UI.modals.shift(); else if (SCREEN === 'newgame') SCREEN = 'title'; } if (k.code === 'KeyM') Snd.toggle(); } input.keys.length = 0; dispatchClicks(); drawTitle(); cv.style.cursor = HOVER && HOVER.cursor ? 'pointer' : 'default'; }
    // tooltip
    if (HOVER && HOVER.tip && !input.down[0]) { const tp = typeof HOVER.tip === 'function' ? HOVER.tip() : HOVER.tip; if (tp) drawTipBox(tp, input.mx, input.my); }
  } catch (e) { onErr(e); input.clicks.length = 0; input.keys.length = 0; }
  if (ERR && ERR.t > NOW) { rect(0, H - 22, W, 22, 'rgba(60,0,0,0.85)'); para('Ошибка: ' + ERR.s.slice(0, 220), 4, H - 20, W - 8, '#ffd0c0', { f: 's', lh: 8 }); }
  PREV.x = input.mx; PREV.y = input.my; input.wheel = 0;
  // fps
  FPS.n++; FPS.ms = FPS.ms * 0.95 + (performance.now() - t0) * 0.05; if (NOW - FPS.t > 1) { FPS.v = FPS.n; FPS.n = 0; FPS.t = NOW; }
  if (FPS.show) txt(FPS.v + ' fps · ' + FPS.ms.toFixed(1) + ' мс' + (typeof MAPDIRTY !== 'undefined' && MAPDIRTY.ms ? ' · границы ' + MAPDIRTY.ms.toFixed(0) + ' мс' : ''), W - 4, H - 40, PAL.y, { al: 'r', sh: PAL.o, f: 's' });
}
function boot() {
  vfLoad(); initArt(); SCREEN = 'title'; Snd.music('title');
  { const m = /#art(\d*)/.exec(location.hash); if (m) { SCREEN = 'art'; DEVP = +(m[1] || 0); } }
  { const m = /#court(tut)?(\d*)/.exec(location.hash); if (m) { NEWG.tut = !!m[1]; if (m[2]) NEWG.seed = +m[2]; startNew(); } }
  addEventListener('beforeunload', () => { try { if (G && !G.over && (SCREEN === 'map' || SCREEN === 'court')) saveGame(); } catch (_) { } });
  requestAnimationFrame(frame);
}
window.T = { ev: s => eval(s) }; window.Snd = Snd;
boot();
