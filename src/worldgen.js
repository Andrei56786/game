'use strict';
// ===== WORLDGEN: deterministic world from seed =====
const MW = 720, MH = 450, TS = 8, WPW = MW * TS, WPH = MH * TS, NT = MW * MH;
const WSCALE = Math.sqrt(NT / 64000); // linear size against the first world (320×200)
const SEAT_K = Math.pow(WSCALE, 0.62); // castles, towns and the big shapes of the land grow slower than the map: more room between fortresses
const KM_PER_TILE = 3, WORLD_V = 2; // a tile is about 3 km: ~20 km a day off the roads, ~35 km on them
const TR = { DEEP: 0, SHALLOW: 1, LAKE: 2, BEACH: 3, GRASS: 4, FARM: 5, FOREST: 6, DFOREST: 7, HILLS: 8, MOUNT: 9, PEAK: 10, MARSH: 11, STEPPE: 12, SNOW: 13 };
const TINFO = [
  { n: 'Море', cost: 0, water: 1, mc: '#22467a' },
  { n: 'Мелководье', cost: 0, water: 1, mc: '#3270a2' },
  { n: 'Озеро', cost: 0, water: 1, fresh: 1, mc: '#3a7eaa' },
  { n: 'Побережье', cost: 1.2, mc: '#d9c48a' },
  { n: 'Луга', cost: 1.0, mc: '#62a044' },
  { n: 'Пашни', cost: 1.0, mc: '#b8a850' },
  { n: 'Лес', cost: 1.7, mc: '#3d7232' },
  { n: 'Чаща', cost: 2.4, mc: '#2a5426' },
  { n: 'Холмы', cost: 1.9, mc: '#86a052' },
  { n: 'Горы', cost: 3.2, mc: '#8a8070' },
  { n: 'Пики', cost: 0, mc: '#e8ecf2' },
  { n: 'Болото', cost: 2.6, mc: '#56704a' },
  { n: 'Степь', cost: 1.1, mc: '#b4ae62' },
  { n: 'Тундра', cost: 1.8, mc: '#d0d8d4' },
];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DX8 = [1, -1, 0, 0, 1, 1, -1, -1], DY8 = [0, 0, 1, -1, 1, -1, 1, -1];
const passable = t => TINFO[t].cost > 0;
const inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v; const top = v[0]; const lk = k.pop(), lv = v.pop(); const n = k.length; if (n) { let i = 0; for (; ;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; } return top; }
  get size() { return this.k.length; }
}
function mkNoise(rng) {
  const p = new Uint8Array(512); const perm = [...Array(256).keys()]; rng.shuffle(perm);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const a = rng.f() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const h00 = p[p[X] + Y], h10 = p[p[X + 1] + Y], h01 = p[p[X] + Y + 1], h11 = p[p[X + 1] + Y + 1];
    const d00 = gx[h00] * xf + gy[h00] * yf, d10 = gx[h10] * (xf - 1) + gy[h10] * yf, d01 = gx[h01] * xf + gy[h01] * (yf - 1), d11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
    const a = d00 + (d10 - d00) * u, b = d01 + (d11 - d01) * u; return (a + (b - a) * v) * 1.41;
  }
  function fbm(x, y, oct) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * f + i * 31.7, y * f - i * 17.3); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  function ridge(x, y, oct) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { let r = 1 - Math.abs(n2(x * f + i * 17.3, y * f - i * 9.1)); r *= r; s += a * r; n += a; a *= 0.5; f *= 2.1; } return s / n; }
  return { n2, fbm, ridge };
}
// cheap hash noise for rendering
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

// ---------- culture names ----------
const CULT = {
  K: { a: 'Эш,Брай,Вест,Олд,Кальд,Мор,Стон,Тарн,Ред,Грин,Уин,Холл,Бель,Хайт,Нор,Лин,Фэр,Рэйв,Даун,Кинг,Брам,Уэл,Сэнд,Блэк,Уайт,Оук,Элм,Торн,Хаз,Мэйп,Ферн,Кросс,Ли,Дарт,Мил,Роз'.split(','), b: 'форд,мор,холл,вик,бург,стон,уэлл,дейл,хейвен,брук,филд,вуд,тон,хэм,бери,гейт,бридж,лей,мут,уотер'.split(',') },
  C: { a: 'Скаль,Хьёр,Ульф,Бьяр,Тор,Рагн,Сигг,Хальв,Гунн,Эйр,Орм,Фрос,Вальк,Гримс,Сван,Йорм,Тюр,Храфн,Кнут,Ас,Ве,Ид,Бранд,Стейн'.split(','), b: 'вик,гард,хейм,фьорд,борг,стад,нес,даль,хольм,вёр,сунд,ланд,бю,торп'.split(',') },
  R: { a: 'Сальм,Вер,Порт,Ливор,Кас,Мар,Тиз,Арм,Флор,Вент,Сиен,Кор,Лаг,Остр,Пад,Рав,Ман,Тер,Альб,Сан-Мар,Бар,Кьяв,Лукк'.split(','), b: 'ира,она,ано,етто,ия,елла,еццо,оза,ини,ата,ента,ара,уччо,ино'.split(',') },
  T: { a: 'Люм,Кал,Вигил,Пиет,Альб,Сол,Аргир,Кандид,Луц,Агн,Бенед,Клар,Фид,Сераф,Целест,Мир,Сион,Ор,Тавр,Эмма'.split(','), b: 'ея,ион,иум,оса,анна,ерия,ит,алис,ина,ора,ания,ет,ат'.split(',') },
  E: { a: 'Аврел,Корвин,Валент,Нике,Маркиан,Феод,Лукан,Сирм,Каппад,Галат,Мезен,Трапез,Хрис,Пале,Иракл,Анатол,Кесар,Фессал,Эпир,Дидим,Сард,Миз'.split(','), b: 'ия,ополь,иум,ея,акия,он,ира,ана,ида,ос,ополис'.split(',') },
};
const LAKEN = 'Светлое,Глубокое,Чёрное,Лебяжье,Тихое,Серебряное,Ясное,Долгое,Ледяное,Туманное,Зеркальное,Русалочье,Белое,Щучье,Каменное,Синее,Утиное,Святое,Журавлиное,Кривое,Гусиное,Дальнее,Тёплое,Мглистое,Ветреное,Медвежье,Лунное,Рыбное'.split(',');
const MOUNTN = 'Седые горы,Волчий хребет,Каменный пояс,Драконьи зубы,Железные горы,Орлиные кручи,Хмурые вершины,Ледяной хребет,Медные горы,Сизый кряж,Гремящие скалы,Зубья Великана,Туманные горы,Красный хребет,Пустые вершины,Соколиный кряж,Синие горы,Старый хребет'.split(',');
function mkName(rng, cul, used) {
  const C = CULT[cul] || CULT.K;
  for (let k = 0; k < 60; k++) {
    let n = rng.pick(C.a) + rng.pick(C.b);
    if (cul === 'T' && rng.chance(0.25)) n = 'Сан-' + n;
    if (n.length > 11 && k < 40) continue;
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = rng.pick(C.a) + rng.pick(C.b) + '-' + rng.i(2, 9); used.add(n); return n;
}

// ---------- pathfinding on tiles (shared with gameplay) ----------
// costFn(j, fromI) -> cost (Infinity = blocked). Returns array of tile indices or null.
const AST = { g: null, from: null, st: null, cl: null, gen: 0, last: 0 };
function astar(start, goal, costFn, opt) {
  opt = opt || {}; const hw = opt.hw || 1, maxN = opt.maxN || 120000;
  if (start === goal) return [start];
  if (!AST.g || AST.g.length !== NT) { AST.g = new Float64Array(NT); AST.from = new Int32Array(NT); AST.st = new Int32Array(NT); AST.cl = new Int32Array(NT); AST.gen = 0; }
  const g = AST.g, from = AST.from, st = AST.st, cl = AST.cl; if (++AST.gen > 2e9) { st.fill(0); cl.fill(0); AST.gen = 1; } const gen = AST.gen; // stamps: no clearing of the big arrays
  const gx = goal % MW, gy = (goal / MW) | 0; const hp = new Heap(); const riv = opt.river;
  g[start] = 0; st[start] = gen; from[start] = -1; hp.push(0, start); let n = 0;
  while (hp.size) {
    const i = hp.pop(); if (cl[i] === gen) continue; cl[i] = gen;
    if (i === goal) break; if (++n > maxN) { AST.last = n; return null; }
    const x = i % MW, y = (i / MW) | 0, gi = g[i];
    for (let d = 0; d < 8; d++) {
      const nx = x + DX8[d], ny = y + DY8[d]; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const j = ny * MW + nx; if (cl[j] === gen) continue;
      let c = costFn(j, i); if (!(c < Infinity)) continue;
      if (d >= 4) { // diagonal: no corner cutting through blocked tiles or across river corners
        const a = y * MW + nx, b = ny * MW + x;
        if (!(costFn(a, i) < Infinity) || !(costFn(b, i) < Infinity)) continue;
        if (riv && (riv[a] || riv[b]) && !riv[j]) continue;
        c *= 1.4142;
      }
      const ng = gi + c;
      if (st[j] !== gen || ng < g[j]) { g[j] = ng; st[j] = gen; from[j] = i; const ddx = nx - gx, ddy = ny - gy; hp.push(ng + Math.sqrt(ddx * ddx + ddy * ddy) * hw, j); }
    }
  }
  AST.last = n;
  if (cl[goal] !== gen) return null;
  const path = []; for (let c = goal; c !== -1; c = from[c]) path.push(c); path.reverse(); return path;
}

// ---------- main generator ----------
// neighbour index helpers (−1 = off the map); d: 0..3 → E, W, S, N
const nb4 = (i, x, d) => d === 0 ? (x < MW - 1 ? i + 1 : -1) : d === 1 ? (x > 0 ? i - 1 : -1) : d === 2 ? (i < NT - MW ? i + MW : -1) : (i >= MW ? i - MW : -1);
const nb8 = (x, y, d) => { const nx = x + DX8[d], ny = y + DY8[d]; return nx >= 0 && ny >= 0 && nx < MW && ny < MH ? ny * MW + nx : -1; };
function genWorld(seed) {
  const t0 = performance.now();
  const rng = mkRng((seed * 7919 + 13) >>> 0); const NZ = mkNoise(rng); const FK = SEAT_K;
  const elev = new Float32Array(NT), moist = new Float32Array(NT), temp = new Float32Array(NT), ter = new Uint8Array(NT);
  const ox = rng.range(0, 500), oy = rng.range(0, 500), mx = rng.range(0, 500), my = rng.range(0, 500), qx = rng.range(0, 500), qy = rng.range(0, 500);
  const TT = {}; let tl = performance.now(); const tick = n => { const t = performance.now(); TT[n] = Math.round(t - tl); tl = t; };
  // 1. elevation (continents, mountain belts and seas grow with the map, small bumps keep their size)
  const ED = 34 * Math.pow(WSCALE, 0.8);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x, sx = x / (72 * FK) + ox, sy = y / (72 * FK) + oy;
    const wx = NZ.fbm(sx * 0.6 + 5.2, sy * 0.6 + 1.3, 3) * 1.1, wy = NZ.fbm(sx * 0.6 - 3.1, sy * 0.6 + 7.7, 3) * 1.1;
    let e = 0.5 + NZ.fbm(sx + wx, sy + wy, 6) * 0.9;
    const d = Math.min(x, MW - 1 - x, y * 1.2, (MH - 1 - y) * 1.2) + NZ.fbm(x / (30 * FK) + 9.1, y / (30 * FK) - 4.7, 3) * 20 * FK;
    if (d < ED) e -= Math.pow(clamp((ED - d) / ED, 0, 1.4), 1.7) * 0.75;
    e += NZ.fbm(x / (190 * FK) + ox * 0.7 + 3.3, y / (190 * FK) + oy * 0.7 - 8.1, 3) * 0.3; // great gulfs and inner seas
    const mask = ease(clamp((NZ.fbm(x / (95 * FK) + mx, y / (95 * FK) + my, 3) + 0.02) * 3.0, 0, 1));
    const rdg = NZ.ridge(x / (40 * FK) + mx * 2, y / (40 * FK) + my * 2, 4);
    e += mask * Math.pow(rdg, 2.3) * 0.48 + NZ.fbm(x / 9 + qx, y / 9 + qy, 2) * 0.025;
    elev[i] = e;
  }
  const sorted = Float32Array.from(elev).sort();
  const sea = sorted[Math.floor(NT * 0.37)];
  tick("elev");
  // 2. ocean (connected to edge)
  const ocean = new Uint8Array(NT), q = new Int32Array(NT); let qh = 0, qt = 0;
  const seedO = i => { if (!ocean[i] && elev[i] < sea) { ocean[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < MW; x++) { seedO(x); seedO((MH - 1) * MW + x); }
  for (let y = 0; y < MH; y++) { seedO(y * MW); seedO(y * MW + MW - 1); }
  while (qh < qt) { const i = q[qh++], x = i % MW; for (let d = 0; d < 4; d++) { const j = nb4(i, x, d); if (j >= 0) seedO(j); } }
  let maxE = sea; for (let i = 0; i < NT; i++) if (!ocean[i] && elev[i] > maxE) maxE = elev[i];
  const rel = i => (elev[i] - sea) / (maxE - sea);
  // 3. priority flood (D4) -> drainage tree
  const filled = new Float32Array(NT), down = new Int32Array(NT).fill(-1), vis = new Uint8Array(NT), order = new Int32Array(NT); let on = 0;
  const hp = new Heap();
  for (let i = 0; i < NT; i++) if (ocean[i]) { vis[i] = 1; filled[i] = sea; const x = i % MW; for (let d = 0; d < 4; d++) { const j = nb4(i, x, d); if (j >= 0 && !ocean[j]) { hp.push(sea, i); break; } } }
  while (hp.size) {
    const i = hp.pop(), fi = filled[i], x = i % MW;
    for (let d = 0; d < 4; d++) { const j = nb4(i, x, d); if (j < 0 || vis[j]) continue; vis[j] = 1; filled[j] = Math.max(elev[j], fi + 1e-6); down[j] = i; order[on++] = j; hp.push(filled[j], j); }
  }
  // 4. distance to ocean
  const dOcean = new Uint8Array(NT).fill(255); qh = qt = 0;
  for (let i = 0; i < NT; i++) if (ocean[i]) { dOcean[i] = 0; q[qt++] = i; }
  while (qh < qt) { const i = q[qh++], x = i % MW; for (let d = 0; d < 4; d++) { const j = nb4(i, x, d); if (j >= 0 && dOcean[j] === 255) { dOcean[j] = Math.min(254, dOcean[i] + 1); q[qt++] = j; } } }
  // 5. moisture & temperature
  const m1 = rng.range(0, 500), m2 = rng.range(0, 500);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x;
    let m = 0.5 + NZ.fbm(x / (48 * FK) + m1, y / (48 * FK) + m2, 4) * 0.62;
    m += (1 - Math.min(dOcean[i], 24) / 24) * 0.12 + (0.5 - x / MW) * 0.34 - Math.max(0, rel(i) - 0.5) * 0.3;
    moist[i] = m;
    temp[i] = 0.08 + (y / MH) * 0.95 + NZ.fbm(x / (60 * FK) + m2, y / (60 * FK) + m1, 3) * 0.14 - Math.max(0, rel(i)) * 0.45;
  }
  tick("flood+moist");
  // 6. lakes from depressions (+ stamped if too few)
  const lake = new Uint8Array(NT), lakeList = [];
  {
    const cand = new Uint8Array(NT); for (let i = 0; i < NT; i++) if (!ocean[i] && filled[i] - elev[i] > 0.010) cand[i] = 1;
    const seen = new Uint8Array(NT), comps = [];
    for (let i = 0; i < NT; i++) if (cand[i] && !seen[i]) {
      const c = []; qh = qt = 0; q[qt++] = i; seen[i] = 1;
      while (qh < qt) { const a = q[qh++]; c.push(a); const x = a % MW; for (let d = 0; d < 4; d++) { const j = nb4(a, x, d); if (j >= 0 && cand[j] && !seen[j]) { seen[j] = 1; q[qt++] = j; } } }
      comps.push(c);
    }
    comps.sort((a, b) => b.length - a.length);
    const maxL = Math.round(900 * FK * FK);
    for (const c of comps.slice(0, Math.round(12 * Math.pow(WSCALE, 1.3)))) { if (c.length < 7 || c.length > maxL) continue; for (const a of c) lake[a] = 1; lakeList.push(c); }
    let tries = 0; const wantL = Math.round(5 * WSCALE), gap = 30 * FK;
    while (lakeList.length < wantL && tries++ < 400 * WSCALE) {
      const x = rng.i(20, MW - 21), y = rng.i(20, MH - 21), i = y * MW + x; const r = rel(i);
      if (ocean[i] || r < 0.04 || r > 0.35 || dOcean[i] < 8) continue;
      let ok = true; for (const L of lakeList) { const c = L[0]; if (Math.hypot(c % MW - x, ((c / MW) | 0) - y) < gap) { ok = false; break; } } if (!ok) continue;
      const rr = rng.range(2.2, 4.5) * Math.sqrt(FK), c = [], ex = rng.range(0.7, 1.4), RX = Math.ceil(8 * Math.sqrt(FK)), RY = Math.ceil(6 * Math.sqrt(FK));
      for (let yy = -RY; yy <= RY; yy++) for (let xx = -RX; xx <= RX; xx++) { if (!inMap(x + xx, y + yy)) continue; const j = (y + yy) * MW + x + xx; const dd = Math.hypot(xx / ex, yy * ex) + NZ.n2((x + xx) / 3, (y + yy) / 3) * 1.4; if (dd < rr && !ocean[j]) { lake[j] = 1; c.push(j); } }
      if (c.length >= 7) lakeList.push(c);
    }
  }
  // 7. flow accumulation & rivers
  const acc = new Float32Array(NT);
  for (let k = on - 1; k >= 0; k--) { const j = order[k]; acc[j] += 0.3 + clamp(moist[j], 0, 1.2); const d = down[j]; if (d >= 0 && !ocean[d]) acc[d] += acc[j]; }
  const river = new Uint8Array(NT);
  {
    let n = 0; const vals = new Float32Array(NT); for (let i = 0; i < NT; i++) if (!ocean[i] && !lake[i]) vals[n++] = acc[i];
    const vs = vals.subarray(0, n).sort(); const T = vs[Math.floor(n * 0.968)];
    for (let i = 0; i < NT; i++) if (!ocean[i] && !lake[i] && acc[i] >= T) river[i] = acc[i] >= T * 16 ? 3 : acc[i] >= T * 4.5 ? 2 : 1;
  }
  const rivers = [];
  {
    const upR = new Uint8Array(NT); for (let i = 0; i < NT; i++) if (river[i] && down[i] >= 0) upR[down[i]]++;
    const used = new Uint8Array(NT);
    const srcs = []; for (let i = 0; i < NT; i++) if (river[i] && !upR[i]) srcs.push(i);
    for (const s of srcs) {
      const pts = []; let cur = s;
      { const x = s % MW; for (let d = 0; d < 4; d++) { const j = nb4(s, x, d); if (j >= 0 && lake[j] && down[j] === s) { pts.push(j); break; } } }
      for (let g = 0; g < 6000; g++) {
        pts.push(cur); if (used[cur]) break; used[cur] = 1;
        const d = down[cur]; if (d < 0) break;
        if (ocean[d] || lake[d]) { pts.push(d); break; }
        cur = d;
      }
      if (pts.length >= 3) rivers.push(pts);
    }
  }
  tick("lakes+rivers");
  // 8. biomes
  let nl = 0; const landRel = new Float32Array(NT), mv = new Float32Array(NT);
  for (let i = 0; i < NT; i++) if (!ocean[i] && !lake[i]) { landRel[nl] = rel(i); mv[nl++] = moist[i]; }
  const lr = landRel.subarray(0, nl).sort(), ms = mv.subarray(0, nl).sort();
  const qv = p => lr[Math.floor(nl * p)], mq = p => ms[Math.floor(nl * p)];
  const peakT = qv(0.988), mountT = qv(0.94), hillT = qv(0.83), lowT = qv(0.45);
  const marshM = mq(0.93), dforM = mq(0.80), forM = mq(0.56), stepM = mq(0.17), lmM = mq(0.6);
  for (let i = 0; i < NT; i++) {
    if (ocean[i]) { ter[i] = TR.DEEP; continue; }
    if (lake[i]) { ter[i] = TR.LAKE; continue; }
    const r = rel(i), m = moist[i], t = temp[i];
    let b;
    if (r > peakT) b = TR.PEAK; else if (r > mountT) b = TR.MOUNT; else if (r > hillT) b = TR.HILLS;
    else if (t < 0.2) b = m > forM ? TR.FOREST : TR.SNOW;
    else if (m > marshM && r < lowT) b = TR.MARSH;
    else if (m > dforM) b = TR.DFOREST; else if (m > forM) b = TR.FOREST;
    else if (m < stepM && t > 0.42) b = TR.STEPPE; else b = TR.GRASS;
    ter[i] = b;
  }
  {
    const dl = new Uint8Array(NT).fill(255); qh = qt = 0;
    for (let i = 0; i < NT; i++) if (!ocean[i]) { dl[i] = 0; q[qt++] = i; }
    while (qh < qt) { const i = q[qh++], x = i % MW; if (dl[i] >= 4) continue; for (let d = 0; d < 4; d++) { const j = nb4(i, x, d); if (j >= 0 && dl[j] === 255) { dl[j] = dl[i] + 1; q[qt++] = j; } } }
    for (let i = 0; i < NT; i++) if (ocean[i] && dl[i] <= 2) ter[i] = TR.SHALLOW;
  }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x; const b = ter[i]; if (TINFO[b].water || b === TR.MOUNT || b === TR.PEAK) continue;
    let nOc = 0, nLake = 0, nRiv = 0;
    for (let d = 0; d < 8; d++) { const j = nb8(x, y, d); if (j < 0) continue; if (ocean[j]) nOc++; if (lake[j]) nLake++; if (river[j]) nRiv++; }
    if (nOc && rel(i) < 0.07 && b !== TR.HILLS && NZ.n2(x / 7 + 40, y / 7) > -0.35 && temp[i] > 0.2) ter[i] = TR.BEACH;
    else if (nLake && moist[i] > lmM && rel(i) < 0.2 && b !== TR.HILLS && hash2(x, y, 3) < 0.5) ter[i] = TR.MARSH;
    else if (nRiv && b === TR.STEPPE) ter[i] = TR.GRASS;
  }
  // 9. drinking water distance (rivers, lakes)
  const fwd = new Uint8Array(NT).fill(30); qh = qt = 0;
  for (let i = 0; i < NT; i++) if (river[i] || lake[i]) { fwd[i] = 0; q[qt++] = i; }
  while (qh < qt) { const i = q[qh++], x = i % MW, y = (i / MW) | 0; if (fwd[i] >= 29) continue; for (let d = 0; d < 8; d++) { const j = nb8(x, y, d); if (j >= 0 && fwd[j] > fwd[i] + 1) { fwd[j] = fwd[i] + 1; q[qt++] = j; } } }
  const isLand = i => !TINFO[ter[i]].water;
  const coastAdj = i => { const x = i % MW, y = (i / MW) | 0; for (let d = 0; d < 8; d++) { const j = nb8(x, y, d); if (j >= 0 && ocean[j]) return true; } return false; };
  tick("biomes");
  // main landmass (walkable, 4-connected)
  const main = new Uint8Array(NT); let landMain = 0;
  {
    const seen = new Uint8Array(NT); let best = null;
    for (let i = 0; i < NT; i++) if (passable(ter[i]) && !seen[i]) {
      const c = []; qh = qt = 0; q[qt++] = i; seen[i] = 1;
      while (qh < qt) { const a = q[qh++]; c.push(a); const x = a % MW; for (let d = 0; d < 4; d++) { const j = nb4(a, x, d); if (j >= 0 && passable(ter[j]) && !seen[j]) { seen[j] = 1; q[qt++] = j; } } }
      if (!best || c.length > best.length) best = c;
    }
    for (const a of best) main[a] = 1; landMain = best.length;
  }
  // 10. seats (Poisson-like, best sites first): castles and towns stand ~50 tiles (≈150 km) apart
  const siteScore = new Float32Array(NT), BSC = new Float32Array(14); BSC[TR.GRASS] = 0.7; BSC[TR.STEPPE] = 0.35; BSC[TR.FOREST] = 0.05; BSC[TR.DFOREST] = -0.4; BSC[TR.HILLS] = 0.45; BSC[TR.BEACH] = 0.25; BSC[TR.SNOW] = -0.3;
  for (let i = 0; i < NT; i++) {
    const b = ter[i]; const x = i % MW, y = (i / MW) | 0;
    if (!main[i] || !isLand(i) || river[i] || b === TR.MOUNT || b === TR.PEAK || b === TR.MARSH) { siteScore[i] = -9; continue; }
    if (x < 5 || y < 5 || x > MW - 6 || y > MH - 6) { siteScore[i] = -9; continue; }
    let s = 1 + (fwd[i] <= 1 ? 1.3 : fwd[i] <= 3 ? 0.5 : -0.6) + (coastAdj(i) ? 0.6 : 0);
    s += BSC[b];
    siteScore[i] = s + hash2(x, y, seed) * 0.8;
  }
  const cands = []; for (let i = 0; i < NT; i++) if (siteScore[i] > 0.8) cands.push(i);
  { const keys = new Float64Array(cands.length); for (let k = 0; k < cands.length; k++) keys[k] = Math.round((10 - siteScore[cands[k]]) * 1e5) * 524288 + cands[k]; keys.sort(); for (let k = 0; k < cands.length; k++) cands[k] = keys[k] % 524288; }
  const blk = new Uint8Array(NT);
  const disc = (x, y, r) => { const r2 = r * r, ri = Math.ceil(r); for (let dy = -ri; dy <= ri; dy++) { const yy = y + dy; if (yy < 0 || yy >= MH) continue; const w = Math.sqrt(Math.max(0, r2 - dy * dy)), x0 = Math.max(0, Math.ceil(x - w)), x1 = Math.min(MW - 1, Math.floor(x + w)); if (x1 >= x0) blk.fill(1, yy * MW + x0, yy * MW + x1 + 1); } };
  let seats = []; const R0 = 29 * SEAT_K, wantS = landMain / (R0 * R0) * 0.9;
  for (let r = R0, it = 0; it < 12; it++) {
    seats = []; blk.fill(0);
    for (const i of cands) { if (blk[i]) continue; const x = i % MW, y = (i / MW) | 0; seats.push({ i, x, y }); disc(x, y, r - 0.01); }
    if (seats.length > wantS * 1.18) r *= 1.03; else if (seats.length < wantS * 0.82) r *= 0.97; else break;
  }
  tick("seats");
  // 11. provinces: multi-source Dijkstra by terrain cost
  const prov = new Int16Array(NT).fill(-1);
  {
    const PC = { [TR.GRASS]: 1, [TR.FARM]: 1, [TR.STEPPE]: 1.1, [TR.BEACH]: 1.2, [TR.FOREST]: 1.8, [TR.DFOREST]: 2.6, [TR.HILLS]: 2.6, [TR.MOUNT]: 8, [TR.PEAK]: 24, [TR.MARSH]: 3, [TR.SNOW]: 1.8 };
    const pcost = new Float32Array(14); for (let t = 0; t < 14; t++) pcost[t] = PC[t] || 1;
    const dd = new Float64Array(NT).fill(Infinity); const h = new Heap();
    seats.forEach((s, k) => { dd[s.i] = 0; prov[s.i] = k; h.push(0, s.i); });
    while (h.size) {
      const key = h.k[0], i = h.pop(), x = i % MW; if (key > dd[i]) continue;
      for (let d = 0; d < 4; d++) { const j = nb4(i, x, d); if (j < 0 || !main[j]) continue; const c = dd[i] + pcost[ter[j]] + (river[j] ? 4 + river[j] * 2 : 0); if (c < dd[j]) { dd[j] = c; prov[j] = prov[i]; h.push(c, j); } }
    }
  }
  const provs = seats.map((s, k) => ({ id: k, seat: -1, x: s.x, y: s.y, area: 0, cx: 0, cy: 0, nb: new Set(), mix: new Float32Array(14), coast: 0, river: 0, villages: [] }));
  for (let i = 0; i < NT; i++) { const p = prov[i]; if (p < 0) continue; const P = provs[p]; const x = i % MW; P.area++; P.cx += x; P.cy += (i / MW) | 0; P.mix[ter[i]]++; if (river[i]) P.river++; for (let d = 0; d < 4; d++) { const j = nb4(i, x, d); if (j < 0) continue; const pj = prov[j]; if (pj >= 0 && pj !== p) P.nb.add(pj); if (ocean[j]) P.coast++; } }
  for (const P of provs) { P.cx /= Math.max(1, P.area); P.cy /= Math.max(1, P.area); for (let t = 0; t < 14; t++) P.mix[t] /= Math.max(1, P.area); P.nb = [...P.nb]; }
  // 12. realms by anchors + growth (realms grow with the number of provinces)
  const RK = Math.max(1, provs.length / 45 * 0.86);
  const RA = [{ k: 'K', ax: 0.36, ay: 0.5, n: 7 }, { k: 'C', ax: 0.5, ay: 0.1, n: 7 }, { k: 'R', ax: 0.16, ay: 0.84, n: 6 }, { k: 'T', ax: 0.64, ay: 0.82, n: 6 }, { k: 'E', ax: 0.86, ay: 0.36, n: 10 }];
  for (const ra of RA) ra.n = Math.round(ra.n * RK);
  const owner = new Int8Array(provs.length).fill(-1), caps = [], minA = 250 * SEAT_K * SEAT_K;
  RA.forEach((ra, r) => {
    let best = -1, bd = Infinity;
    for (const minD of [62, 50, 38, 0]) {
      provs.forEach((P, k) => { if (owner[k] >= 0 || P.area < minA) return; for (const c of caps) if (Math.hypot(P.x - provs[c].x, P.y - provs[c].y) < minD * WSCALE) return; const d = Math.hypot(P.x - ra.ax * MW, (P.y - ra.ay * MH) * 1.3); if (d < bd) { bd = d; best = k; } });
      if (best >= 0) break;
    }
    if (best < 0) provs.forEach((P, k) => { if (owner[k] < 0 && best < 0) best = k; });
    owner[best] = r; caps.push(best);
  });
  {
    const cnt = RA.map(() => 1); let grew = true;
    while (grew) {
      grew = false;
      for (let r = 0; r < RA.length; r++) {
        if (cnt[r] >= RA[r].n) continue;
        const cp = provs[caps[r]]; let best = -1, bd = Infinity;
        provs.forEach((P, k) => { if (owner[k] !== r) return; for (const nb of P.nb) if (owner[nb] < 0) { const d = Math.hypot(provs[nb].x - cp.x, provs[nb].y - cp.y) * (0.85 + hash2(nb, r, seed) * 0.3); if (d < bd) { bd = d; best = nb; } } });
        if (best >= 0) { owner[best] = r; cnt[r]++; grew = true; }
      }
    }
  }
  tick("provs+realms");
  const minR = Math.round(4 * RK);
  for (let r = 0; r < RA.length; r++) for (let g = 0; g < minR; g++) {
    const mine = provs.filter((P, k) => owner[k] === r); if (mine.length >= minR) break;
    let best = -1, bs = -1;
    for (const P of mine) for (const nb of P.nb) { const o = owner[nb]; if (o < 0) { best = nb; bs = 99; } else if (o !== r && !caps.includes(nb)) { const sz = owner.filter(x => x === o).length; if (sz > minR + 1 && sz > bs) { bs = sz; best = nb; } } }
    if (best < 0) break; owner[best] = r;
  }
  // 13. settlements
  const setts = []; const usedN = new Set();
  const realmCult = ['K', 'C', 'R', 'T', 'E'];
  const cultOf = k => owner[k] >= 0 ? realmCult[owner[k]] : (hash2(k, 7, seed) < 0.5 ? 'K' : realmCult[1 + Math.floor(hash2(k, 9, seed) * 4)]);
  blk.fill(0); const VGAP = 9.5;
  provs.forEach((P, k) => {
    const s = seats[k]; const cul = cultOf(k); P.cul = cul;
    const nearW = fwd[s.i] <= 1 || coastAdj(s.i);
    const isCap = caps.includes(k);
    const type = isCap ? 'capital' : ter[s.i] === TR.HILLS ? 'castle' : (coastAdj(s.i) && hash2(k, 3, seed) < 0.8) || (nearW && hash2(k, 4, seed) < 0.45) ? 'town' : 'castle';
    let name = mkName(rng, cul, usedN); if (type === 'town' && cul === 'R' && coastAdj(s.i) && rng.chance(0.5)) name = 'Порто-' + name;
    P.name = name; P.seat = setts.length;
    setts.push({ id: setts.length, name, type, x: s.x, y: s.y, i: s.i, prov: k, coast: coastAdj(s.i) ? 1 : 0 });
    disc(s.x, s.y, VGAP + 1.5);
  });
  {
    const vc = provs.map(() => []); for (let i = 0; i < NT; i++) { const k = prov[i]; if (k >= 0 && siteScore[i] > 0.6 && ter[i] !== TR.SNOW) vc[k].push(i); }
    provs.forEach((P, k) => {
      const want = clamp(Math.round(P.area / 400 + (hash2(k, 11, seed) < 0.35 ? 1 : 0)), 2, 8);
      const pc = vc[k]; pc.sort((a, b) => siteScore[b] - siteScore[a]);
      for (const i of pc) {
        if (P.villages.length >= want) break; if (blk[i]) continue; const x = i % MW, y = (i / MW) | 0;
        P.villages.push(setts.length); setts.push({ id: setts.length, name: mkName(rng, P.cul, usedN), type: 'village', x, y, i, prov: k, coast: coastAdj(i) ? 1 : 0 });
        disc(x, y, VGAP);
      }
    });
  }
  // 14. farmland around settlements
  for (const s of setts) {
    const R0 = s.type === 'village' ? 3.2 : s.type === 'castle' ? 3.6 : 5.2;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = s.x + dx, y = s.y + dy; if (!inMap(x, y)) continue; const i = y * MW + x;
      const b = ter[i]; if (b !== TR.GRASS && b !== TR.STEPPE && b !== TR.FOREST && b !== TR.BEACH && b !== TR.SNOW) continue;
      const d = Math.hypot(dx, dy) + NZ.n2(x / 3 + 11, y / 3) * 1.6;
      if (d < R0 && (b !== TR.FOREST || d < R0 - 1.2) && (b !== TR.SNOW || d < 2)) ter[i] = TR.FARM;
      else if (d < R0 + 1.5 && b === TR.FOREST && hash2(x, y, 5) < 0.6) ter[i] = TR.GRASS;
    }
    ter[s.i] = TR.FARM;
  }
  tick("setts");
  // 15. roads (MST + extra edges, villages to seats)
  const road = new Uint8Array(NT), bridge = new Uint8Array(NT);
  const RC = { [TR.GRASS]: 1, [TR.FARM]: 1, [TR.STEPPE]: 1.05, [TR.BEACH]: 1.3, [TR.FOREST]: 2, [TR.DFOREST]: 3.2, [TR.HILLS]: 2.4, [TR.MOUNT]: 7, [TR.MARSH]: 5, [TR.SNOW]: 1.8 };
  const rcost = new Float32Array(14).fill(Infinity); for (const t in RC) rcost[t] = RC[t];
  const roadCost = j => { let k = rcost[ter[j]]; if (k === Infinity) return k; if (river[j]) k += 9 + river[j] * 4; if (road[j]) k = k * 0.22; return k; };
  const roadList = [];
  const build = (a, b, lvl) => { const p = astar(a, b, roadCost, { hw: 0.9, river, maxN: 400000 }); if (!p) return false; for (const t of p) { road[t] = Math.max(road[t], lvl); if (river[t]) bridge[t] = 1; } roadList.push({ p, lvl }); return true; };
  {
    const edges = []; provs.forEach((P, k) => { for (const nb of P.nb) if (nb > k) edges.push([Math.hypot(P.x - provs[nb].x, P.y - provs[nb].y), k, nb]); });
    edges.sort((a, b) => a[0] - b[0]);
    const par = provs.map((_, k) => k); const fnd = k => par[k] === k ? k : (par[k] = fnd(par[k]));
    const extra = [];
    for (const [d, a, b] of edges) { const ra = fnd(a), rb = fnd(b); if (ra !== rb) { par[ra] = rb; build(setts[provs[a].seat].i, setts[provs[b].seat].i, 2); } else extra.push([d, a, b]); }
    for (const [d, a, b] of extra) if (hash2(a, b, seed) < 0.38 && d < 45 * SEAT_K) build(setts[provs[a].seat].i, setts[provs[b].seat].i, 2);
    for (const P of provs) for (const v of P.villages) build(setts[v].i, setts[P.seat].i, 1);
  }
  tick("roads");
  // 16. fords along rivers
  const ford = new Uint8Array(NT);
  for (const pts of rivers) {
    let since = rng.i(3, 8);
    for (let k = 1; k < pts.length - 1; k++) {
      const t = pts[k]; if (!river[t]) continue; since++;
      const gap = river[t] === 3 ? 26 : river[t] === 2 ? 14 : 10;
      if (since >= gap && !bridge[t] && [TR.GRASS, TR.FARM, TR.STEPPE, TR.FOREST, TR.SNOW].includes(ter[t]) && rng.chance(0.5)) { ford[t] = 1; since = 0; }
    }
  }
  // 17. bandit lairs (about one per five provinces)
  const lairs = [], wantLairs = Math.round(9 * provs.length / 45), lg2 = (30 * SEAT_K) ** 2;
  for (let tries = 0; tries < 3000 * WSCALE * WSCALE && lairs.length < wantLairs; tries++) {
    const x = rng.i(8, MW - 9), y = rng.i(8, MH - 9), i = y * MW + x;
    if (![TR.FOREST, TR.DFOREST, TR.HILLS, TR.MARSH].includes(ter[i]) || river[i] || road[i] || !main[i]) continue;
    let ok = true; for (const s of setts) if ((s.x - x) ** 2 + (s.y - y) ** 2 < 144) { ok = false; break; }
    for (const l of lairs) if ((l.x - x) ** 2 + (l.y - y) ** 2 < lg2) { ok = false; break; }
    if (ok) lairs.push({ x, y, i, prov: prov[i] });
  }
  // 18. labels: lakes & mountain ranges
  const labels = [];
  lakeList.forEach((L, k) => { if (L.length < 20) return; let sx = 0, sy = 0; for (const a of L) { sx += a % MW; sy += (a / MW) | 0; } labels.push({ t: 'озеро ' + LAKEN[k % LAKEN.length], x: sx / L.length, y: sy / L.length, kind: 'lake' }); });
  {
    const seen = new Uint8Array(NT); let k = 0; const minM = Math.round(60 * SEAT_K * SEAT_K);
    for (let i = 0; i < NT; i++) if ((ter[i] === TR.MOUNT || ter[i] === TR.PEAK) && !seen[i]) {
      const c = []; qh = qt = 0; q[qt++] = i; seen[i] = 1;
      while (qh < qt) { const a = q[qh++]; c.push(a); const x = a % MW, y = (a / MW) | 0; for (let d = 0; d < 8; d++) { const j = nb8(x, y, d); if (j >= 0 && (ter[j] === TR.MOUNT || ter[j] === TR.PEAK) && !seen[j]) { seen[j] = 1; q[qt++] = j; } } }
      if (c.length > minM) { let sx = 0, sy = 0; for (const a of c) { sx += a % MW; sy += (a / MW) | 0; } labels.push({ t: MOUNTN[(k++ + seed) % MOUNTN.length], x: sx / c.length, y: sy / c.length, kind: 'mount', n: c.length }); }
    }
  }
  const relA = new Float32Array(NT); for (let i = 0; i < NT; i++) relA[i] = rel(i);
  const world = { wv: WORLD_V, seed, sea, ter, elev, rel: relA, moist, temp, river, rivers, down, acc, road, roadList, bridge, ford, prov, provs, setts, lairs, owner: Array.from(owner), caps, ocean, lake, fwd, dOcean, labels, main };
  tick("rest"); world.tt = TT; world.ms = Math.round(performance.now() - t0);
  return world;
}
// movement cost of entering tile j (gameplay); season: 0 spring,1 summer,2 autumn,3 winter
function moveCost(WD, j, season, o) {
  const b = WD.ter[j]; let c = TINFO[b].cost; if (!c) return Infinity;
  if (WD.road[j]) { c = b === TR.MOUNT ? 1.5 : 0.55; }
  else { if (season === 3) c *= 1.4; else if (season === 0 || season === 2) c *= 1.15; }
  if (WD.river[j]) c += WD.bridge[j] ? 0 : WD.ford[j] ? 1.0 : 2.5 + (WD.river[j] - 1) * 1.5;
  if (o && o.cav && (b === TR.DFOREST || b === TR.MARSH)) c *= 1.25;
  return c;
}