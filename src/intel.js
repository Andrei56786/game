'use strict';
// ===== INTEL: vision, fog of war, signs, estimates, spies =====
const SIGNS = [];
function visionOf(a) {
  const t = armyTile(a), T = WD.ter[t]; let r = 5;
  if (T === TR.HILLS) r += 3; else if (T === TR.MOUNT) r += 5; else if (T === TR.FOREST || T === TR.DFOREST) r -= 2;
  r += Math.min(4, Math.floor(((a.u.horse || 0) + (a.u.harch || 0)) / 25));
  const g = charOf(a.gen); if (g) r += traitSum(g, 'scout');
  r *= weatherOf().vis; return Math.max(2, r);
}
function stampVis(cx, cy, r) {
  const r2 = r * r, x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(MW - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(MH - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) { const i = y * MW + x; G.vis[i] = 2; if (!G.explored[i]) { G.explored[i] = 1; FOGDIRTY = 1; } } }
}
let FOGDIRTY = 1;
function computeVision() {
  G.vis.fill(0); const pr = G.player.realm;
  for (const a of G.armies) if (a.alive && a.realm === pr) stampVis(a.x, a.y, visionOf(a));
  for (const S of G.setts) if (S.ctrl === pr) { const ws = WD.setts[S.id]; stampVis(ws.x + 0.5, ws.y + 0.5, ws.type === 'village' ? 3 : 5); }
  for (const sp of G.spies) {
    if (sp.until < G.day) continue;
    if (sp.type === 'local') { for (let i = 0; i < NT; i++) if (WD.prov[i] === sp.prov) { G.vis[i] = 2; if (!G.explored[i]) { G.explored[i] = 1; FOGDIRTY = 1; } } }
    else if (sp.type === 'surviving' && sp.arrive <= G.day) stampVis(sp.x + 0.5, sp.y + 0.5, 7);
  }
  FOGDIRTY = 1;
}
function hasInward(realm) { return G.spies.some(s => s.type === 'inward' && s.realm === realm && s.until >= G.day); }
function armyVisible(b) {
  if (!b.alive) return false; if (b.realm === G.player.realm) return true;
  if (hasInward(b.realm) && b.kind === 'lord') return true;
  const t = armyTile(b); if (G.vis[t] !== 2) return false;
  if (b.hidden) { const pa = playerArmy(); if (!pa || Math.hypot(pa.x - b.x, pa.y - b.y) > 2.5) return false; }
  return true;
}
function estimateMen(b) {
  const real = armyMen(b); if (b.realm === G.player.realm) return { n: real, exact: 1 };
  const pa = playerArmy(); const d = pa ? Math.hypot(pa.x - b.x, pa.y - b.y) : 20;
  let e = d < 1.6 ? 0 : clamp(0.08 + d * 0.025, 0, 0.35); if (hasInward(b.realm)) e = Math.min(e, 0.06);
  const noise = (hash2(b.id, Math.floor(G.day / 4), 77) - 0.5) * 2 * e;
  let n = real * (1 + noise) * (b.fires ? 1.8 : 1);
  if (e > 0 || b.fires) n = Math.max(10, Math.round(n / 10) * 10);
  return { n: Math.round(n), exact: e === 0 && !b.fires };
}
// AI perception of an army (deception: false fires, converted spy)
function perceivedPower(b, byRealm) {
  let p = powerU(b.u, b.xp);
  if (b.fires) p *= 1.8;
  if (b.realm === G.player.realm) { const cs = G.spies.find(s => s.type === 'converted' && s.realm === byRealm && s.until >= G.day); if (cs) p *= cs.factor; }
  if (b.mode === 'fort' && b.fortDays >= 2) p *= 1.3;
  return p;
}
function updateSigns() {
  SIGNS.length = 0; const pa = playerArmy(); if (!pa) return;
  const vr = visionOf(pa);
  for (const b of G.armies) {
    if (!b.alive || b.realm === G.player.realm || armyVisible(b)) continue;
    const d = Math.hypot(b.x - pa.x, b.y - pa.y); if (d > vr + 8) continue;
    const ox = (hash2(b.id, G.day, 3) - 0.5) * 3, oy = (hash2(b.id, G.day, 4) - 0.5) * 3; const T = WD.ter[armyTile(b)];
    const moving = b.path && b.path.length > 1;
    if (moving) { const cav = mountedN(b.u) > armyMen(b) * 0.4; SIGNS.push({ k: cav ? 'dust_hi' : 'dust_lo', x: b.x + ox, y: b.y + oy, b: b.id }); }
    else if ((T === TR.FOREST || T === TR.DFOREST) && (b.hidden || b.kind === 'bandit')) SIGNS.push({ k: 'birds', x: b.x + ox, y: b.y + oy, b: b.id });
    else if (!b.hidden) SIGNS.push({ k: b.fires ? 'smoke_many' : 'smoke', x: b.x + ox, y: b.y + oy, b: b.id });
  }
}
const SIGN_INFO = {
  dust_hi: { n: 'Пыль высоким узким столбом', q: '«Пыль поднимается высоко и остро — это идут колесницы»: где-то движется конница.', ic: 'dust' },
  dust_lo: { n: 'Пыль низкая и широкая', q: '«Пыль стелется низко и широко — идёт пехота»: движется пешее войско.', ic: 'dust' },
  birds: { n: 'Птицы взлетают над лесом', q: '«Птицы взлетают — там засада»: в лесу кто-то затаился.', ic: 'birds' },
  smoke: { n: 'Дым костров', q: 'Над лесом и полями — дым: там стоит лагерем войско.', ic: 'smoke' },
  smoke_many: { n: 'Множество костров', q: 'Костров очень много. Но помни: «война — путь обмана». Костры можно и зажечь нарочно.', ic: 'smoke' },
};
// ---------- spies ----------
const SPYT = {
  local: { n: 'Местный лазутчик', cost: 30, dur: 42, d: 'Местные проводники и осведомители: вся провинция видна, марш по бездорожью −20%.' },
  inward: { n: 'Внутренний лазутчик', cost: 90, dur: 84, d: 'Человек при чужом дворе: видны все армии державы и их численность, её казна и замыслы.' },
  converted: { n: 'Обращённый лазутчик', cost: 50, dur: 56, d: 'Перевербованный шпион врага. Через него враг поверит в ложь о ваших силах.' },
  doomed: { n: 'Обречённый лазутчик', cost: 40, dur: 14, d: 'Несёт врагу ложный замысел: войска державы бросятся защищать указанную провинцию. Сам он погибнет.' },
  surviving: { n: 'Живой лазутчик', cost: 25, dur: 12, d: 'Сходит в указанное место и вернётся: область видна 12 дней.' },
};
function hireSpy(type, o) {
  const T = SPYT[type]; const r = G.realms[G.player.realm]; if (r.gold < T.cost) return false;
  r.gold -= T.cost; const sp = Object.assign({ type, until: G.day + T.dur, d0: G.day }, o || {});
  if (type === 'surviving') { const pa = playerArmy(); const d = pa ? Math.hypot(pa.x - sp.x, pa.y - sp.y) : 10; sp.arrive = G.day + Math.ceil(d / 12); sp.until = sp.arrive + T.dur; }
  if (type === 'local') G.provs[sp.prov].guides = sp.until;
  if (type === 'doomed') { const ok = R.f() < 0.75 + (charOf(G.player.char).intr - 8) * 0.02; sp.ok = ok; if (ok) G.realms[sp.realm].decoy = { prov: sp.prov, until: G.day + 14 }; log(ok ? 'Обречённый лазутчик отдал себя в руки врага. ' + REALM_DEF[sp.realm].name + ' поверили и стягивают войска к ' + WD.provs[sp.prov].name + '.' : 'Обречённого лазутчика раскусили. Обман не удался.', ok ? 'good' : 'bad'); }
  G.spies.push(sp); computeVision(); if (typeof Snd !== 'undefined') Snd.sfx('paper');
  if (typeof TUT !== 'undefined') TUT.ev('spy', type);
  return true;
}
