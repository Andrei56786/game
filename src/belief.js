'use strict';
// ===== BELIEF (v3.7): «враг верит, а не знает». Every foreign realm keeps its own picture of the crown's armies: where they were
// seen, how strong they looked and by whose eyes. Its armies flee from, hunt and weigh only what it believes; the crown's tricks
// (false fires, false marches, dummies on the walls, rumours, a feigned rout) change the belief, never the truth.
// G.bel[r] = { a: { [armyId]: { x, y, p, men, day, src, tgt, fires, feint } }, fooled, rum: { f, until, k } | null, react: { [armyId]: { day, s, ok } }, plot: { [realm]: until } }
// G.know[armyId] = { x, y, men, day, src, realm, gen, fires, tgt } — what the crown knows of foreign armies (the ghosts on the map)
// G.dlog = [{ d, t, c }] — the journal of deceit, both ways. Everything lives in G, so it is saved with the game =====
const BEL_AGE = 30, KNOW_AGE = 24;
const BSRC = { eye: 'свои глаза', spy: 'шпион при нашем дворе', rumor: 'слухи с дорог', net: 'сеть Ока', icp: 'перехваченный гонец', inw: 'внутренний лазутчик' };
function belOf(r) { const Bs = G.bel || (G.bel = {}); return Bs[r] || (Bs[r] = { a: {}, fooled: 0, rum: null, react: {}, plot: {} }); }
function dlog(t, c) { const L = G.dlog || (G.dlog = []); L.push({ d: G.day, t, c: c || 'info' }); if (L.length > 80) L.shift(); }
// an enemy informer at our court (a spy nobody has caught yet) tells his masters our orders
function courtSpyOf(r) { return !!(G.court && G.court.secrets.some(s => s.k === 'spy' && s.realm === r && !s.done)); }
// we can read the enemy's mind: a man inside his court, or a strong net of informers
function insight(r) { return r >= 1 && r < 5 && (hasInward(r) || !!(G.court && (G.court.net[r] || 0) >= 2)); }
// how hard the realm is to fool: the ruler's wits and nature, old lessons, a spy at our court
function skept(r) { const c = rulerOf(r); if (!c) return 0.3; const tr = t => c.traits.includes(t);
  let s = 0.25 + ((c.intr || 8) - 8) * 0.03 + (tr('cunning') ? 0.2 : 0) + (tr('cautious') ? 0.1 : 0) + (tr('wise') ? 0.1 : 0) - (tr('reckless') ? 0.15 : 0) - (tr('wrathful') ? 0.1 : 0) - (tr('honest') ? 0.05 : 0) - (tr('proud') ? 0.05 : 0);
  s += 0.12 * Math.min(4, belOf(r).fooled || 0); if (courtSpyOf(r)) s += 0.3; return clamp(s, 0.05, 0.9); }
function skeptWord(s) { return s < 0.2 ? 'доверчив' : s < 0.4 ? 'верит донесениям' : s < 0.6 ? 'осторожен' : s < 0.75 ? 'подозрителен' : 'его не проведёшь'; }
// a general's own nose for a trick (Сунь-цзы, гл. 7: «не преследуй притворно бегущего»)
function genSkept(g) { if (!g) return 0.2; const tr = t => g.traits.includes(t);
  return clamp(0.15 + ((g.intr || 8) - 8) * 0.03 + (tr('cunning') ? 0.25 : 0) + (tr('wise') ? 0.15 : 0) + (tr('cautious') ? 0.15 : 0) - (tr('reckless') ? 0.15 : 0) - (tr('wrathful') ? 0.1 : 0), 0.02, 0.85); }
// who looks out for the realm: its armies (caravans only hear rumours on the road), its castles, towns and villages
function belObservers(r) { const L = [];
  for (const a of G.armies) if (a.alive && a.realm === r) L.push({ x: a.x, y: a.y, v: a.kind === 'caravan' ? 3 : visionOf(a), src: a.kind === 'caravan' ? 'rumor' : 'eye' });
  for (const S of G.setts) if (S.ctrl === r) { const ws = WD.setts[S.id]; L.push({ x: ws.x + 0.5, y: ws.y + 0.5, v: ws.type === 'village' ? 3 : 5, src: 'eye' }); }
  return L; }
// where a marching army seems to be going: the place at the end of its road
function belGuessTgt(b) { if (b.path && b.path.length > 1) { const g = b.path[b.path.length - 1]; return settNear(g % MW + 0.5, Math.floor(g / MW) + 0.5, 1.6); } return -1; }
function belSee(r, b, d, src) {
  const B = belOf(r), close = d < 1.6, spy = src === 'spy';
  if (src === 'rumor') { const o = B.a[b.id]; if (o && o.src !== 'rumor' && G.day - o.day < 3) return { e: o, old: o, close: false }; }
  let p = perceivedPower(b, r), men = armyMen(b);
  if (spy) p = powerU(b.u, b.xp); // the spy reads the muster rolls: neither fires nor banners fool him
  else {
    if (close && b.fires) p /= 1.8; // up close the empty tents show
    const e = close ? 0.03 : clamp(0.06 + d * 0.02, 0, 0.3), nz = (hash2(b.id * 7 + r, Math.floor(G.day / 4), 91) - 0.5) * 2 * e;
    p *= 1 + nz; men *= (1 + nz) * (b.fires && !close ? 1.8 : 1);
    if (b.feint && !close) { p *= 1.2; men *= 1.2; } // banners and drums: the false march looks bigger still
    if (src === 'rumor') { const k = 0.8 + hash2(b.id, G.day, 5) * 0.5; p *= k; men *= k; } }
  const e = { x: b.x, y: b.y, p: Math.round(p), men: Math.max(10, Math.round(men / 10) * 10), day: G.day, src, tgt: belGuessTgt(b), fires: !!b.fires && !spy && !close, feint: !!b.feint && !spy && !close };
  const old = B.a[b.id]; B.a[b.id] = e; return { e, old, close }; }
// once a day, before the realms decide: every foreign realm looks at the crown's armies
function belDaily() {
  const pr = G.player.realm, mine = G.armies.filter(b => b.alive && b.realm === pr && (b.kind === 'lord' || b.kind === 'player'));
  for (let r = 1; r < 5; r++) { if (!alive(r)) continue; const B = belOf(r), obs = belObservers(r), cs = courtSpyOf(r);
    for (const b of mine) { let bd = 1e9, src = null;
      for (const o of obs) { const d = Math.hypot(o.x - b.x, o.y - b.y); if (d > o.v || d >= bd || (b.hidden && d > 2.5)) continue; bd = d; src = o.src; }
      if (src) { const res = belSee(r, b, bd, src); if (typeof deceitSeen === 'function') deceitSeen(r, b, res); }
      else if (cs && b.kind === 'lord' && (G.day + b.id + r) % 6 === 0) belSee(r, b, 0, 'spy'); }
    for (const id in B.a) { const e = B.a[id], b = armyById(+id); if (!b || b.realm !== pr || G.day - e.day > BEL_AGE) delete B.a[id]; }
    if (B.rum && B.rum.until < G.day) B.rum = null;
    for (const id in B.react) if (G.day - B.react[id].day > 20) delete B.react[id];
    for (const t in B.plot) if (B.plot[t] < G.day) delete B.plot[t]; } }
// what the realm thinks the crown can field: armies it has seen as it saw them, the rest by hearsay (rumours can bend it)
function belPower(by) {
  const pr = G.player.realm, B = belOf(by), rf = B.rum ? B.rum.f : 1, cs = G.spies.find(s => s.type === 'converted' && s.realm === by && s.until >= G.day), ck = cs ? cs.factor : 1;
  let p = 0;
  for (const a of G.armies) { if (!a.alive || a.realm !== pr || (a.kind !== 'lord' && a.kind !== 'player')) continue; const e = B.a[a.id]; p += e ? e.p : powerU(a.u, a.xp) * rf * ck; }
  for (const S of G.setts) if (S.ctrl === pr) p += garSeen(S, by) * 0.4;
  return p; }
// a garrison as the enemy sees it: straw soldiers on the walls pass for men until someone looks closely
function garSeen(S, by) { const g = powerU(S.gar); return S.dummy > G.day && S.ctrl === G.player.realm && by !== G.player.realm && !(S.dumK && S.dumK[by]) && !courtSpyOf(by) ? g * 1.8 : g; }
// ---------- what the crown knows of foreign armies: the last sighting stays on the map as a ghost ----------
function know(b, src, err) { const K = G.know || (G.know = {}); let men = estimateMen(b).n;
  if (err) men = Math.max(10, Math.round(armyMen(b) * (1 + (hash2(b.id, G.day, 31) - 0.5) * 2 * err) / 10) * 10);
  const o = K[b.id]; K[b.id] = { x: b.x, y: b.y, men, day: G.day, src, realm: b.realm, gen: b.gen, fires: !!b.fires && src === 'eye', tgt: b.onArrive && b.onArrive.k === 'siege' ? b.onArrive.s : o && o.tgt >= 0 && G.day - o.day < 6 ? o.tgt : -1 }; }
function knowDaily() { const K = G.know || (G.know = {});
  for (const b of G.armies) { if (!b.alive || b.realm === G.player.realm || b.realm > 4 || b.kind !== 'lord' || !armyVisible(b)) continue; if (G.vis[armyTile(b)] === 2) know(b, 'eye'); else know(b, 'inw', 0.05); }
  if (G.court) for (let t = 1; t < 5; t++) { const lv = G.court.net[t] || 0; if (!lv || !alive(t) || hasInward(t) || (G.day + t) % (5 - lv) !== 0) continue;
    for (const b of G.armies) if (b.alive && b.realm === t && b.kind === 'lord' && !armyVisible(b)) know(b, 'net', [0.35, 0.25, 0.15, 0.08][lv]); }
  for (const id in K) { const b = armyById(+id); if (!b || G.day - K[id].day > KNOW_AGE) delete K[id]; } }
// ---------- hooks into the realm and army minds (ai.js) ----------
{ const rp = realmPower; realmPower = function (r, by) { if (r === G.player.realm && by !== undefined && by > 0 && by < 5 && by !== r) return belPower(by); return rp(r, by); }; }
{ const pp = perceivedPower; perceivedPower = function (b, by) { const p = pp(b, by); return b.feign > G.day && b.realm === G.player.realm && by !== G.player.realm ? p * 0.6 : p; }; }
// a foreign general reacts only to crown armies seen since yesterday, where they were seen and as big as they looked
{ const tn = threatsNear; threatsNear = function (a, r) { const L = tn(a, r); if (!(a.realm >= 1 && a.realm <= 4) || !G.bel || !G.bel[a.realm]) return L; const B = G.bel[a.realm], pr = G.player.realm, g = charOf(a.gen), out = [];
  for (const x of L) { const b = x.b; if (b.realm !== pr || (b.kind !== 'lord' && b.kind !== 'player')) { out.push(x); continue; }
    const e = B.a[b.id]; if (!e || G.day - e.day > 1 || e.src === 'rumor') continue;
    let p = e.p; if (b.feign > G.day && genSkept(g) > 0.5) p /= 0.6;
    out.push({ b, d: Math.hypot(e.x - a.x, e.y - a.y), p }); }
  return out; }; }
{ const ar = aiRealm; aiRealm = function (r) { if (r === 0) { try { belDaily(); knowDaily(); if (typeof deceitDaily === 'function') deceitDaily(); } catch (e) { console.error(e); } } return ar(r); }; }
