// ===== SOUND UI (v3.5): music by place and moment, the sounds of places, footsteps, the mixer =====
// music: K.hooks.resolve picks a family (court, outdoor by season, village, tavern, night, chapel, hunt, tourney, dungeon, map, travel, campaign…)
// places: K.hooks.amb schedules birds, beasts, bells, the forge, crowds, fires and water around the king; the mixer is the window 'sound'
const SNDU = (() => {
  const K = Snd._k, P = K.P, rnd = Math.random, cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const NAME = { title: 'Слово короля', peace: 'Мирный день', tension: 'Тревога', feast: 'Пир', pavane: 'Павана', nocturne: 'Ноктюрн', estampie: 'Эстампи', chant: 'Песнопение', march: 'Марш', battle: 'Битва',
    basse: 'Бас-данс', rondeau: 'Рондо', saltarello: 'Сальтарелло', bransle: 'Бранль', tavern: 'Трактирная', winter: 'Зимняя', autumn: 'Осенняя', lullaby: 'Колыбельная', road: 'Дорожная', pilgrim: 'Паломники',
    warcouncil: 'Военный совет', campfire: 'У костра', battle2: 'Сеча', siege: 'Осада', chasse: 'Охотничья', joust: 'Турнирная', hymn: 'Гимн', lament: 'Плач', dungeon: 'Темница' };
  const SEASON = d => { const x = ((d % DAYS_YEAR) + DAYS_YEAR) % DAYS_YEAR; return x < 21 ? 0 : x < 42 ? 1 : x < 63 ? 2 : 3; };
  const svNow = L => { try { if (L && L.out) return seaVarOf(L); const s = SEASON(G.day); return ['sp', '', 'au2', 'w'][s]; } catch (_) { return ''; } };
  const wintry = sv => sv === 'w' || sv === 'wm', autumnal = sv => /^au/.test(sv);
  // ---------- music: the family for the place and the moment ----------
  K.hooks.resolve = want => {
    try {
      if (want === 'battle') return typeof FIELD !== 'undefined' && FIELD && FIELD.siege ? 'siege' : 'battle';
      if (want === 'feast') return SCREEN === 'court' && COURT.loc === 'v_tav' ? 'tavern' : 'feast';
      if (want !== 'auto' || !G) return null;
      const h = hourAbs(), night = h >= 21.5 || h < 4.5, war = warsOf(G.player.realm).length > 0;
      if (SCREEN === 'court' && COURT.loc) {
        const id = COURT.loc, L = LOCS[id], sv = svNow(L);
        if (COURT.hunt) return 'hunt';
        if (typeof TRN !== 'undefined' && TRN.on) return 'tourney';
        if (id === 'dungeon') return 'dungeon';
        if (/chap/.test(id)) return 'chapel';
        if (id === 'v_tav') return night ? 'night' : 'tavern';
        if (night) return 'night';
        if (G.visit && (G.visit.kind === 'village' || G.visit.kind === 'town')) return wintry(sv) ? 'village_w' : G.visit.kind === 'town' ? 'town' : 'village';
        if (L && !L.out) return war && !G.visit ? 'war' : 'court';
        if (war && !G.visit && id === 'yard') return 'war';
        return wintry(sv) ? 'outdoor_w' : autumnal(sv) ? 'outdoor_au' : 'outdoor';
      }
      if (SCREEN === 'map') {
        const pa = typeof playerArmy === 'function' ? playerArmy() : null;
        if (pa) return night ? 'camp' : war ? 'campaign' : 'travel';
        if (war) return 'war';
        if (night) return 'night';
        return SEASON(G.day) === 3 ? 'map_w' : 'map';
      }
    } catch (_) { }
    return null;
  };
  // ---------- the place: what sounds around the king (rescanned twice a second) ----------
  const SRC = { fireplace: 'fire', brazier: 'fire', campfire: 'fire', cauldron: 'fire', fountain: 'fount', beehive: 'hive', anvil: 'anvil', chains: 'chain', cage: 'chain', boat: 'boat', mill: 'mill', chapelb: 'bell' };
  function srcOf(L) { if (L._snd) return L._snd; const S = { fire: [], fount: [], hive: [], anvil: [], chain: [], boat: [], mill: [], bell: [], water: [] };
    for (const o of L.objs.concat(L.deco)) { const k = SRC[o.k]; if (k) S[k].push([o.x + o.w / 2, o.sy - 6]); }
    if (L.out && L.ter) { const st = L.w * L.h > 20000 ? 3 : 2; for (let y = 0; y < L.h; y += st) for (let x = 0; x < L.w; x += st) if (L.ter[y * L.w + x] === GT.WATER) S.water.push([x * CT + 8, y * CT + 8]); }
    return (L._snd = S); }
  const near = (A, x, y) => { let b = 1e9, bp = null; for (const p of A) { const d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); if (d < b) { b = d; bp = p; } } return bp ? { d: Math.sqrt(b), p: bp } : null; };
  const fall = (d, R) => d >= R ? 0 : Math.pow(1 - d / R, 1.6);
  const panOf = (sx, px) => cl((sx - px) / 230, -0.9, 0.9);
  let S = null, scT = -9, lastH = -1;
  function scan() {
    const s = { where: '', out: 0, id: '', L: null, sv: '', h: 12, kind: '' };
    if (!G) return s; s.h = hourAbs(); s.sv = svNow(null);
    if (SCREEN === 'court' && COURT.loc && COURT.p) {
      const L = LOCS[COURT.loc]; if (!L) return s; const p = COURT.p; s.where = 'court'; s.L = L; s.id = L.id; s.out = L.out ? 1 : 0; s.sv = svNow(L); s.px = p.x; s.py = p.y; s.src = srcOf(L);
      s.kind = G.visit ? (G.visit.kind === 'town' ? 'town' : G.visit.kind === 'village' ? 'village' : 'castle') : L.id === 'forest' ? 'forest' : 'home';
      s.coast = s.src.boat.length > 0; const w = near(s.src.water, p.x, p.y); s.wd = w ? w.d : 1e9; s.wp = w ? w.p : null;
      s.ani = COURT.ani.filter(a => a.loc === L.id && !a.dead).map(a => ({ k: a.kind, x: a.x, y: a.y, d: Math.hypot(a.x - p.x, a.y - p.y) })).filter(a => a.d < 340);
      const ppl = COURT.npcs.filter(n => n.loc === L.id && !n.away); s.ppl = ppl.filter(n => Math.hypot(n.x - p.x, n.y - p.y) < 150); s.crowd = ppl.length;
    } else if (SCREEN === 'map') { s.where = 'map'; s.out = 1; const pa = playerArmy && playerArmy(); s.march = !!(pa && pa.path); }
    return s;
  }
  const NX = {};
  function due(key, now, a, b) { const t = NX[key]; if (t === undefined || t > now + b + 1) { NX[key] = now + rnd() * b; return false; } if (now < t) return false; NX[key] = now + a + rnd() * (b - a); return true; }
  // birds by place, season, hour and weather: [name, weight]
  function birdPool(s, wk) {
    const h = s.h, sv = s.sv, wet = wk === 'rain' || wk === 'storm' || wk === 'blizzard', win = wintry(sv), aut = autumnal(sv), d = ((G.day % DAYS_YEAR) + DAYS_YEAR) % DAYS_YEAR;
    const night = h >= 21.5 || h < 4.3, dawn = h >= 4.3 && h < 8, dusk = h >= 19 && h < 21.5, f = s.kind === 'forest', vil = s.kind === 'village' || s.kind === 'town', P0 = [];
    const A = (n, w) => { if (w > 0) P0.push([n, w]); };
    if (wet) { if (!night && !win) A('crow', 1); return { pool: P0, gap: [14, 30] }; }
    if (night) { A('owl', f ? 3 : 1.5); A('owl2', f ? 2 : 1); if (!win && !aut && d >= 8 && d < 34) A('nightingale', f ? 4 : 2); return { pool: P0, gap: f ? [6, 16] : [12, 30] }; }
    if (win) { A('crow', 3); A('tit', 2); A('robin', 1.2); if (!f) A('sparrow', 1.2); if (f) A('woodpecker', 1); return { pool: P0, gap: f ? [6, 14] : [10, 24] }; }
    if (dawn) { A('robin', 3); A('blackbird', 3); A('wren', 2); A('chaffinch', 2); A('tit', 1); if (!aut && d < 40) A('cuckoo', f ? 1.2 : 0.5); if (vil && !aut) A('lark', 2); }
    else if (dusk) { A('blackbird', 3); A('robin', 2); A('crow', 1); if (!aut && d < 40) A('cuckoo', 0.4); }
    else { A('chaffinch', 2); A('tit', 2); A('robin', 1); A('blackbird', 1); A('wren', f ? 1.5 : 0.6); if (!f) A('sparrow', vil ? 3 : 2); if (vil && !aut) A('lark', 1.5); if (f) A('woodpecker', 1.2); if (!aut && d < 40) A('cuckoo', f ? 0.8 : 0.3); A('pigeon', f ? 0.8 : 0.5); A('crow', aut ? 2 : 0.5); if (s.coast) A('gull', 3); }
    const g = f ? (dawn ? [1.4, 4] : [3, 8]) : s.kind === 'town' ? [7, 16] : dawn ? [2.5, 7] : [5, 12];
    return { pool: P0, gap: aut ? [g[0] * 1.6, g[1] * 1.6] : g };
  }
  const BEASTK = { horse: [['snort', 3], ['horse', 1]], hen: [['hen', 1]], pigeon: [['coo', 1]], dog: [['dog', 1]], hound: [['dog', 1]], sheep: [['sheep', 1]], cow: [['cow', 1]], goat: [['goat', 1]], pig: [['pig', 1]], duck: [['duck', 1]], cat: [['cat', 1]] };
  const BEASTG = { horse: [9, 24], hen: [7, 18], pigeon: [9, 22], dog: [16, 45], hound: [10, 30], sheep: [10, 26], cow: [18, 45], goat: [16, 38], pig: [12, 30], duck: [10, 26], cat: [50, 120] };
  function at(name, x, y, vol, far) { if (vol > 0.02) SND2.play(name, vol, panOf(x, S.px), far || cl(Math.hypot(x - S.px, y - S.py) / 420, 0, 0.75)); }
  function around(name, vol, far) { SND2.play(name, vol, rnd() * 1.6 - 0.8, far); }
  K.hooks.amb = (now, k, ins) => {
    if (now - scT > 0.45) { S = scan(); scT = now; }
    if (!k || !S || !S.where) { SND2.bedsOff(now); return; }
    const s = S, wk = k, h = s.h, night = h >= 21.5 || h < 4.3, sv = s.sv, wv = wk === 'blizzard' ? 1 : wk === 'storm' ? 0.8 : wk === 'wind' ? 0.6 : wk === 'snow' ? 0.4 : 0.2;
    const live = !(G.speed === 0 && (UI.win || UI.modalOpen())) ? 1 : 0.5;
    // beds
    const B = { wind: 0, leaves: 0, water: 0, crowd: 0, fire: 0, room: 0, surf: 0 };
    if (s.where === 'map') { B.wind = 0.012 + wv * 0.02 + (SEASON(G.day) === 3 ? 0.012 : 0); }
    else if (!s.out) { B.room = s.id === 'dungeon' || /chap/.test(s.id) ? 0.022 : 0.012; }
    else { B.wind = 0.008 + wv * 0.018 + (s.kind === 'forest' ? 0.004 : 0); if (s.kind === 'forest' && !wintry(sv)) B.leaves = 0.006 + wv * 0.01; if (s.wd < 260) B.water = 0.03 * fall(s.wd, 260); if (s.coast && s.wd < 300) B.surf = 0.05 * fall(s.wd, 300); }
    if (s.where === 'court') {
      const f = near(s.src.fire, s.px, s.py); if (f) B.fire = 0.05 * fall(f.d, s.out ? 120 : 170);
      const fo = near(s.src.fount, s.px, s.py); if (fo) B.water = Math.max(B.water, 0.035 * fall(fo.d, 200));
      const town = s.kind === 'town' && s.out && h > 7.5 && h < 19.5, tav = s.id === 'v_tav' && h > 11 && h < 23.5, fst = (s.id === 'hall' && typeof FS !== 'undefined' && FS.on) || (s.id === 'k_hall' && typeof kDinner === 'function' && kDinner()), trn = typeof TRN !== 'undefined' && TRN.on && s.out;
      B.crowd = (town ? 0.02 : 0) + (tav ? 0.03 : 0) + (fst ? 0.035 : 0) + (trn ? 0.04 : 0) + Math.min(0.02, s.ppl.length * 0.002);
      // things
      if (f && f.d < 110 && due('crk', now, 0.6, 2.2)) at('crackle', f.p[0], f.p[1], 1.3 * fall(f.d, 110));
      if (s.id === 'dungeon') { if (due('drip', now, 1.2, 5)) around('drip', 0.7 + rnd() * 0.6, 0.2); if (due('chain', now, 9, 26)) around('chain', 0.8, 0.3); }
      if ((tav || fst) && due('laugh', now, 3, 9)) around('laugh', 0.8, 0.35); if ((tav || fst || town) && due('talk', now, 2, 6)) around('talk', 0.9, 0.4);
      if (fst && due('clink', now, 4, 11)) Snd.sfx('clink');
      if (trn && due('cheer', now, 12, 30)) Snd.sfx('cheer');
      if (s.ppl.length && !tav && !fst && due('pplk', now, 5, 14)) { const n = s.ppl[(rnd() * s.ppl.length) | 0]; if (!n.sit || rnd() < 0.5) at('talk', n.x, n.y, 0.7 * fall(Math.hypot(n.x - s.px, n.y - s.py), 150), 0.1); }
      const work = h > 7.5 && h < 18.5 && !night;
      const an = near(s.src.anvil, s.px, s.py); if (an && work && an.d < 320 && due('anvil', now, 3.5, 9)) at('anvil', an.p[0], an.p[1], fall(an.d, 320) * (s.out ? 1 : 0.4));
      const hv = near(s.src.hive, s.px, s.py); if (hv && hv.d < 90 && work && !wintry(sv) && wk !== 'rain' && due('bees', now, 1.8, 3.2)) at('bees', hv.p[0], hv.p[1], 1.4 * fall(hv.d, 90));
      if (s.out && work && (s.kind === 'village' || s.kind === 'town' || s.kind === 'home') && due('cart', now, 40, 110)) around('cart', 0.7, 0.55);
      if (s.out && work && (s.kind === 'village' || s.kind === 'forest') && !wintry(sv) && due('axe', now, 45, 120)) around('axe', 0.6, 0.7);
      if (s.kind === 'town' && s.out && work && due('crier', now, 60, 160)) around('crier', 0.7, 0.5);
      // bells at six, noon and six: the chapel, the village church
      const hh = Math.floor(h); if (lastH >= 0 && hh !== lastH && (hh === 6 || hh === 12 || hh === 18) && s.kind !== 'forest') { const b = s.src.bell[0]; if (b && s.out) at('bell', b[0], b[1], 0.9, 0.35); else around('bell', s.out ? 0.8 : 0.4, s.out ? 0.55 : 0.8); } lastH = hh;
      // beasts: the nearest of each kind speaks now and then
      const seen = {}; for (const a of s.ani) { const b = BEASTK[a.k]; if (!b || (seen[a.k] && seen[a.k].d <= a.d)) continue; seen[a.k] = a; }
      for (const kk in seen) { const a = seen[kk], g = BEASTG[kk]; if ((night && kk !== 'dog') || !due('b_' + kk, now, g[0] / live, g[1] / live)) continue; at(K.pickW(BEASTK[kk]), a.x, a.y, 0.95 * fall(a.d, 340)); }
      if (s.out && h >= 4.4 && h < 7.5 && (seen.hen || s.kind === 'village') && due('rooster', now, 22, 60)) { const a = seen.hen; if (a) at('rooster', a.x, a.y, 0.9 * fall(a.d, 400) + 0.2); else around('rooster', 0.6, 0.5); }
      if (night && s.out && (s.kind === 'village' || s.kind === 'home') && due('ndog', now, 40, 120)) around('dog', 0.4, 0.75);
    }
    // birds, insects, frogs, wolves — outdoors
    if (s.out) {
      const bp = birdPool(s, wk); if (bp.pool.length && G.speed > 0 && due('bird', now, s.where === 'map' ? bp.gap[0] * 2.5 : bp.gap[0], s.where === 'map' ? bp.gap[1] * 2.5 : bp.gap[1])) around(K.pickW(bp.pool), s.where === 'map' ? 0.45 : 0.6 + rnd() * 0.5, s.where === 'map' ? 0.5 : rnd() * 0.5);
      const d = ((G.day % DAYS_YEAR) + DAYS_YEAR) % DAYS_YEAR, warmN = d >= 18 && d < 56 && (h >= 19.5 || h < 4) && wk !== 'rain' && wk !== 'storm';
      if (warmN && s.where === 'court' && due('crick', now, 1.6, 4.5)) around('crickets', 0.8 + rnd() * 0.4, 0.2);
      if (warmN && s.where === 'court' && s.wd < 240 && due('frogs', now, 3, 9)) at('frogs', s.wp[0], s.wp[1], 1.1 * fall(s.wd, 240) + 0.2);
      if (wintry(sv) && night && (s.kind === 'forest' || s.where === 'map' || s.kind === 'village') && due('wolf', now, 45, 130)) around('wolf', 0.7, 0.8);
    }
    for (const kk in B) SND2.bed(kk, B[kk] * (ins && kk !== 'room' && kk !== 'fire' && kk !== 'crowd' ? 0.3 : 1), now);
  };
  // ---------- footsteps: the king's own (and the nearest walkers, softly) ----------
  function surfAt(L, x, y) {
    const tx = Math.floor(x / CT), ty = Math.floor((y - 2) / CT); if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return 'stone'; const t = L.ter[ty * L.w + tx];
    const sv = L.out ? svNow(L) : '', wk = G.weather ? G.weather.k : '', wet = L.out && (wk === 'rain' || wk === 'storm'), snow = L.out && (sv === 'w' || wk === 'blizzard');
    switch (t) {
      case GT.GRASS: return snow ? 'snow' : sv === 'th' ? 'mud' : L.id === 'forest' && (sv === 'au2' || sv === 'au3') ? 'leaves' : 'grass';
      case GT.DIRT: case GT.SOIL: case GT.SAND: return !L.out ? 'straw' : snow ? 'snow' : wet || sv === 'th' || sv === 'au3' ? 'mud' : 'dirt';
      case GT.COBBLE: case GT.FLAG: case GT.FLAGD: case GT.MARBLE: case GT.CWALL: case GT.WALL: return snow ? 'snow' : 'stone';
      case GT.WOOD: case GT.DAIS: return 'wood';
      case GT.WATER: return 'water';
    }
    return L.out ? (snow ? 'snow' : 'grass') : 'stone';
  }
  const STEPV = { stone: 0.05, wood: 0.055, grass: 0.06, leaves: 0.055, dirt: 0.08, snow: 0.09, mud: 0.085, water: 0.045, straw: 0.05 };
  const STEPN = { t: 0 }, _pu = playerUpdate;
  playerUpdate = function (dt) {
    const p = COURT.p, f0 = p ? p.f : 0; _pu(dt); if (!p || !p.moving || p.sit) return; const L = curLoc(); if (!L) return;
    if (Math.floor((p.f + 7) / 14) !== Math.floor((f0 + 7) / 14)) { const sf = surfAt(L, p.x, p.y); SND2.step(sf, STEPV[sf] * (COURT.sneak ? 0.35 : 1) * (0.85 + rnd() * 0.3), 0); }
    STEPN.t -= dt; if (STEPN.t > 0) return; STEPN.t = 0.1; // others: the three nearest walkers
    const W3 = COURT.npcs.filter(n => n.loc === L.id && !n.away && (n.path || n.moving) && Math.abs(n.x - p.x) < 110 && Math.abs(n.y - p.y) < 90).slice(0, 3);
    for (const n of W3) { const f = n.f || 0, k = Math.floor((f + 7) / 14); if (n._stk !== undefined && k !== n._stk) { const d = Math.hypot(n.x - p.x, n.y - p.y), sf = surfAt(L, n.x, n.y); if (d < 110) SND2.step(sf, STEPV[sf] * 0.45 * fall(d, 110), panOf(n.x, p.x)); } n._stk = k; }
  };
  // ---------- volume: all, music, effects, places, steps ----------
  const BUS = { gv: () => K.master, mv: () => K.musBus, sv: () => K.sfxBus, av: () => K.ambBus, fv: () => K.stepBus };
  function setVol(k, v) { v = cl(v, 0, 1); P[k] = v; if (k === 'mv') P.mus = v > 0 ? 1 : 0; if (k === 'sv') P.sfx = v > 0 ? 1 : 0; const b = BUS[k](); if (b && K.ac) K.setBus(b, k === 'gv' ? (P.on ? v : 0) : v); K.save(); }
  const _vol = Snd.vol; Snd.vol = (k, v) => { if (k === 'mus') k = 'mv'; else if (k === 'sfx') k = 'sv'; if (BUS[k]) setVol(k, v); else _vol(k, v); };
  const get = k => P[k] === undefined ? { gv: 1, mv: 0.55, sv: 0.8, av: 0.7, fv: 0.45 }[k] : (k === 'mv' && !P.mus) || (k === 'sv' && !P.sfx) ? 0 : P[k];
  return { surfAt, get, setVol, NAME, scan: () => S, birdPool };
})();
// the mixer: five sliders, mute, what is playing
Object.assign(ICONS, { note: '..ww.|..w.w|..w..|.ww..|.ww..', bird: '...ww|..wwy|wwww.|.ww..|..w..', foot: '.ww..|.ww..|.ww..|.wwww|.wwww', bell: '..w..|.www.|.www.|wwwww|..w..' });
function sndSlider(id, x, y, w, k) {
  const v = SNDU.get(k), d = input.down[0];
  if (d && d.x >= x - 3 && d.x <= x + w + 3 && d.y >= y - 4 && d.y <= y + 9 && UI.win && UI.win.k === 'sound') { const nv = Math.round(clamp((input.mx - x) / w, 0, 1) * 20) / 20; if (nv !== v) SNDU.setVol(k, nv); }
  rect(x, y + 2, w, 3, PAL.o); rect(x + 1, y + 3, w - 2, 1, '#3c2a20'); rect(x + 1, y + 3, Math.round((w - 2) * v), 1, '#f7d35c');
  const kx = x + Math.round(w * v); rect(kx - 2, y - 1, 5, 9, PAL.o); rect(kx - 1, y, 3, 7, hov(id) || (d && d.x >= x - 3 && d.x <= x + w + 3 && d.y >= y - 4 && d.y <= y + 9) ? '#fff2c8' : '#e0a630');
  hit(x - 3, y - 4, w + 6, 13, { id, cursor: true, onClick: c => SNDU.setVol(k, Math.round(clamp((c.ux - x) / w, 0, 1) * 20) / 20) });
}
WIN_EXT.sound = function (w) {
  const WW = 232, HH = 150, X = (W - WW) >> 1, Y = 64; winFrame(X, Y, WW, HH, 'Звук', false);
  const R = [['gv', 'i_snd', 'Общая', 'Громкость всего'], ['mv', 'i_note', 'Музыка', 'Пьесы меняются по месту, часу и событию'], ['sv', 'i_bell', 'Звуки', 'Двери, кнопки, оружие, рог'], ['av', 'i_bird', 'Окружение', 'Птицы, звери, ветер, вода, люди вокруг'], ['fv', 'i_foot', 'Шаги', 'Шаги короля и прохожих']];
  let y = Y + 26; R.forEach(([k, ic, lab, tip]) => { spr(ic, X + 14, y); txt(lab, X + 24, y - 1, PAL.w); hit(X + 10, y - 3, 74, 11, { id: 'sn_l' + k, tip }); sndSlider('sn_' + k, X + 88, y - 1, 100, k); txt(Math.round(SNDU.get(k) * 100) + '%', X + WW - 14, y - 1, '#c8b898', { al: 'r', f: 's' }); y += 16; });
  btn('sn_mute', X + 14, y + 2, 96, 14, { label: Snd.muted() ? 'Включить (M)' : 'Без звука (M)', ic: Snd.muted() ? 'i_snd' : 'i_mute', active: Snd.muted(), onClick: () => Snd.toggle() });
  btn('sn_ok', X + WW - 70, y + 2, 56, 14, { label: 'Готово', onClick: () => UI.shut() });
  const m = Snd.mood(); txt(Snd.muted() ? 'Звук выключен' : m && SNDU.get('mv') > 0 ? 'Сейчас: «' + (SNDU.NAME[m] || m) + '»' : 'Музыка выключена', X + WW / 2, y + 22, '#c8b898', { al: 'c', f: 's' });
};
function sndOpen() { if (UI.win && UI.win.k === 'sound') UI.shut(); else { Snd.unlock(); UI.open({ k: 'sound' }); } }
{ const _dt = drawTitle; drawTitle = function () { _dt(); if (UI.win && UI.win.k === 'sound') WIN_EXT.sound(UI.win); }; }
