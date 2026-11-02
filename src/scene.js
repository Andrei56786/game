// ---------- scenes: where the king is — at home in the capital castle, or visiting (a village, a town, a foreign castle) ----------
// extension points for the v3.3 modules
const CRENDER = [], CRENDER2 = [];   // extra world-space draw passes in courtRender: before / after the sorted sprites (g is already translated)
const DAILY_EXT = [];                // extra daily ticks, called by dailyTick next to the court's own
const ACTS_EXT = {};                 // extra acts by id: a => …
const WIN_EXT = {};                  // extra windows by UI.win.k: w => draw
const UPD_EXT = [];                  // per-frame updates while the court scene runs: dt => …
const TIMEK_EXT = [];                // court-clock slow-downs for spectacles: () => k in (0, 1], the smallest wins
const TARGET_EXT = [];               // extra E-targets: P => { e: 1, d, label, sub, x, y, go } | null (smaller d wins)
const PICK_EXT = [];                 // extra click targets under the cursor: (wx, wy) => target | null (checked first)
const DOOR_EXT = [];                 // door interceptors: d => true stops the king at the door
const HUD_EXT = [];                  // extra HUD painters (screen space)
const POP_EXT = [];                  // after the court at home has been populated
const ENTER_EXT = [];                // when the king (re)enters the court at home
const SPR_EXT = [];                  // extra depth-sorted sprites: (L, list) => list.push([sortY, 4, g => draw])
const BUILD_EXT = [];                // after the home locations have been built (add acts, spots, objects)
const SITE_KIND = {};                // visit kinds: { build(sid) -> [L…], arrive(sid) -> spot name, populate(sid), update(dt), enter(sid), leave(sid), title(sid) }
const siteOf = L => (L && L.site) || 'home';
const curSite = () => (G && G.visit ? 'v' : 'home');
// the first door to take on the shortest way between two locations of one place
function doorToward(from, to) { if (from === to || !LOCS[from]) return null; const site = siteOf(LOCS[from]), prev = { [from]: 0 }, q = [from];
  while (q.length) { const id = q.shift(); for (const d of LOCS[id].doors) { const L2 = LOCS[d.to]; if (!L2 || prev[d.to] !== undefined || siteOf(L2) !== site) continue; prev[d.to] = { id, d };
      if (d.to === to) { let s = prev[to]; while (s.id !== from) s = prev[s.id]; return s.d; } q.push(d.to); } }
  return null; }
// ---------- visits ----------
function visitDrop() { for (const id in LOCS) if (LOCS[id].site === 'v') delete LOCS[id]; }
function visitBuild() { const V = G.visit, K = SITE_KIND[V.kind]; visitDrop(); for (const L of K.build(V.sid)) { L.site = 'v'; bakeLoc(L); } }
function visitEnter(kind, sid, how) { const K = SITE_KIND[kind]; if (!K || !G || !playerArmy()) return; buildCourt();
  G.visit = { kind, sid, day: G.day, how: how || '' }; UI.win = null; UI.target = null; visitBuild(); visitStart(); if (K.enter) try { K.enter(sid); } catch (e) { onErr(e); } }
function visitStart(pos) { const V = G.visit, K = SITE_KIND[V.kind], king = kingC();
  COURT.p = COURT.p || { x: 0, y: 0, dir: 'down', f: 0, moving: 0, sit: null, lie: 0, key: 'king' }; Object.assign(COURT.p, { c: king, sit: null, lie: 0, moving: 0 });
  COURT.npcs = []; COURT.ani = []; COURT.audience = null; K.populate(V.sid); npcSnap(true);
  const sp = spotOf(K.arrive(V.sid)), L0 = pos && LOCS[pos.loc] ? LOCS[pos.loc] : null;
  if (L0 && canStand(L0, pos.x, pos.y)) { COURT.loc = pos.loc; COURT.p.x = pos.x; COURT.p.y = pos.y; COURT.p.dir = 'down'; } else { COURT.loc = sp.loc; COURT.p.x = sp.x; COURT.p.y = sp.y; COURT.p.dir = sp.dir; }
  COURT.parts = []; COURT.path = null; COURT.onArrive = null; COURT.room = ''; COURT.fade = 0; COURT.sleepT = 0; SCREEN = 'court'; snapCam();
  COURT.lastHA = G.day * 24 + hourAbs(); COURT.lastHH = Math.floor(hourAbs() * 2); if (typeof Snd !== 'undefined') Snd.music('auto'); if (!G.speed) G.speed = UI.lastSpeed || 1; }
function visitTitle() { const V = G && G.visit, K = V && SITE_KIND[V.kind]; return K && K.title ? K.title(V.sid) : ''; }
function visitLeave(quiet) { const V = G.visit; if (!V) return; const K = SITE_KIND[V.kind]; if (K && K.leave) try { K.leave(V.sid); } catch (e) { onErr(e); }
  while (DLG.open()) DLG.close(); visitCleanup(); SCREEN = 'map'; UI.win = null; cam.z = Math.max(cam.z, 1); centerArmy(); if (!G.speed) G.speed = UI.lastSpeed || 1;
  if (typeof Snd !== 'undefined') { Snd.sfx('door'); Snd.music('auto'); } if (!quiet) UI.toast('Король снова в седле.'); }
function visitCleanup() { if (G) G.visit = null; visitDrop(); COURT.npcs = []; COURT.ani = []; COURT.sleepT = 0; COURT.loc = 'keep'; COURT.audience = null; }
function visitResume() { const V = G.visit, K = V && SITE_KIND[V.kind]; if (!K || !playerArmy() || G.atCourt) { visitCleanup(); return; }
  try { visitBuild(); visitStart(V.loc ? { loc: V.loc, x: V.x, y: V.y } : null); } catch (e) { onErr(e); visitCleanup(); SCREEN = 'map'; } }
function siteUpdate(dt) { const V = G.visit, K = SITE_KIND[V.kind]; if (COURT.p) { V.loc = COURT.loc; V.x = Math.round(COURT.p.x); V.y = Math.round(COURT.p.y); }
  if (K && K.update) K.update(dt);
  V.chk = (V.chk || 0) - dt; if (V.chk <= 0) { V.chk = 0.5; visitAlarm(); } }
// an enemy closing in on the place the king is visiting: the squire runs in
function visitAlarm() { const pa = playerArmy(), V = G.visit; if (!pa) { visitLeave(1); return; } if (DLG.open() || UI.modalOpen()) return;
  for (const a of G.armies) { if (!a.alive || a === pa || !hostile(G.player.realm, a.realm) || a.kind === 'caravan') continue; const d = Math.hypot(a.x - pa.x, a.y - pa.y); if (d > 4.5) continue;
    V.warned = V.warned || []; if (V.warned.includes(a.id)) continue; V.warned.push(a.id); if (G.speed > 0) UI.lastSpeed = G.speed; G.speed = 0; if (typeof Snd !== 'undefined') Snd.sfx('horn');
    DLG.say(null, 'Вбегает запыхавшийся оруженосец: «Государь! Сюда идёт ' + armyLabel(a) + (a.realm < 5 && !armyLabel(a).includes(realmName(a.realm)) ? ' (' + realmName(a.realm) + ')' : '') + ' — ' + voin(armyMen(a)) + '. Они будут здесь ' + (d < 2 ? 'с минуты на минуту' : 'ещё до вечера') + '!»', { name: 'Тревога!', choices: [{ t: 'К коням! Выйти к войску', fx: () => visitLeave() }, { t: 'Остаться (рискованно)', fx: () => { G.speed = UI.lastSpeed || 1; } }], esc: 1 });
    return; } }
function drawVisitPanel() { const s = visitTitle(); if (!s) return; const t = s + '  ·  Tab — уехать', w = tw(t, { f: 's' }) + 12, x = W - w - 6, y = 22;
  rect(x, y, w, 12, 'rgba(20,14,12,0.82)'); strokeR(x, y, w, 12, '#8a6a3a'); txt(t, x + 6, y + 3, '#e8d5a8', { f: 's' }); hit(x, y, w, 12, { id: 'vpanel', cursor: true, tip: ['Вы в гостях: время идёт, войско ждёт у околицы.', 'Tab или ворота — вернуться на карту.'], onClick: () => visitLeave() }); }
