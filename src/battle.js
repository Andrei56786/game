'use strict';
// ===== BATTLE v3: regiments under captains, formations, eight troop types, sight & scouting; real time with pause (also headless) =====
const BF = { W: 640, H: 272, Y0: 22, CELL: 4, BOT: 66, VW: 640, VH: 272 };
let BCW = BF.W / BF.CELL, BCH = BF.H / BF.CELL;
const FSZ = { S: [640, 272], M: [800, 384], L: [960, 480] };
const GC = { OPEN: 0, FOREST: 1, WATER: 2, FORD: 3, MARSH: 4, WALL: 5, GATE: 6, BRIDGE: 7, ROAD: 8 };
let BT = null; // current interactive battle
function useField(F) { if (F && F.W) { BF.W = F.W; BF.H = F.H; BCW = F.W / BF.CELL; BCH = F.H / BF.CELL; } }
function fieldSizeFor(men) { return men > 1900 ? 'L' : men > 760 ? 'M' : 'S'; }
function bField(tile, o) {
  o = o || {}; const sz = FSZ[o.size] ? o.size : 'S'; useField({ W: FSZ[sz][0], H: FSZ[sz][1] });
  const rng = mkRng(tile * 31 + G.day * 7 + 5);
  const g = new Uint8Array(BCW * BCH), hgt = new Uint8Array(BCW * BCH);
  const x0 = tile % MW, y0 = (tile / MW) | 0; const cnt = {}; let river = 0, bridge = 0, ford = 0, road = 0; const RX = sz === 'S' ? 3 : 4, RY = sz === 'S' ? 2 : 3;
  for (let dy = -RY; dy <= RY; dy++) for (let dx = -RX; dx <= RX; dx++) { const x = x0 + dx, y = y0 + dy; if (!inMap(x, y)) continue; const i = y * MW + x; const T = WD.ter[i]; cnt[T] = (cnt[T] || 0) + 1; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) { if (WD.river[i]) river = Math.max(river, WD.river[i]); if (WD.bridge[i]) bridge = 1; if (WD.ford[i]) ford = 1; } if (WD.road[i]) road = 1; }
  const c = k => cnt[k] || 0, ar = BF.W * BF.H / (640 * 272);
  let nF = Math.min(Math.round(5 * ar), Math.round((c(TR.FOREST) + c(TR.DFOREST) * 1.4) / 5)), nH = Math.min(Math.round(3 * ar), Math.round((c(TR.HILLS) + c(TR.MOUNT) * 1.5) / 6)), nM = Math.min(Math.round(3 * ar), Math.round(c(TR.MARSH) / 5));
  if (!o.siege) { if (!nH && rng.f() < 0.45) nH = 1; if (!nF && (c(TR.FOREST) + c(TR.DFOREST) + c(TR.GRASS) + c(TR.FARM)) > 0 && rng.f() < 0.4) nF = 1; if (o.ambush && !nF) nF = 1; }
  const blob = (cx, cy, rx, ry, fn) => { for (let y = Math.max(0, cy - ry - 3); y < Math.min(BCH, cy + ry + 3); y++) for (let x = Math.max(0, cx - rx - 3); x < Math.min(BCW, cx + rx + 3); x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (hash2(x, y, tile) - 0.5) * 0.35; if (d < 1) fn(y * BCW + x, d); } };
  for (let k = 0; k < nH; k++) { const cx = rng.i(25, BCW - 25), cy = rng.i(12, BCH - 12), rx = rng.i(14, 26), ry = rng.i(9, 16); blob(cx, cy, rx, ry, (i, d) => { hgt[i] = Math.max(hgt[i], d < 0.3 ? 3 : d < 0.62 ? 2 : 1); }); }
  for (let k = 0; k < nF; k++) { const cx = k === 0 && o.ambush ? rng.i(BCW * 0.3 | 0, BCW * 0.42 | 0) : rng.i(10, BCW - 10), cy = rng.i(6, BCH - 6), rx = rng.i(7, 16), ry = rng.i(5, 11); blob(cx, cy, rx, ry, i => { g[i] = GC.FOREST; }); }
  for (let k = 0; k < nM; k++) { const cx = rng.i(30, BCW - 30), cy = rng.i(8, BCH - 8); blob(cx, cy, rng.i(8, 14), rng.i(5, 9), i => { if (!g[i]) g[i] = GC.MARSH; }); }
  if (road) { let y = rng.i(BCH * 0.3, BCH * 0.7); for (let x = 0; x < BCW; x++) { y += (hash2(x, 3, tile) - 0.5) * 1.2; y = clamp(y, 4, BCH - 5); for (let k = -1; k <= 0; k++) { const i = (Math.round(y) + k) * BCW + x; if (g[i] !== GC.WATER) g[i] = GC.ROAD; } } }
  let rv = null;
  if (river && !o.siege) {
    rv = { x: BCW / 2 + rng.i(-8, 8) }; const wid = 2 + river;
    const fy = [rng.i(8, BCH * 0.45 | 0), rng.i(BCH * 0.55 | 0, BCH - 8)]; if (!ford && !bridge && rng.f() < 0.5) fy.pop();
    for (let y = 0; y < BCH; y++) { const cx = rv.x + Math.sin(y * 0.12 + tile) * 5; for (let x = Math.floor(cx - wid); x <= Math.ceil(cx + wid); x++) { if (x < 0 || x >= BCW) continue; const i = y * BCW + x; const isF = fy.some(f => Math.abs(y - f) <= 3); g[i] = isF ? (bridge && fy.indexOf(fy.find(f => Math.abs(y - f) <= 3)) === 0 ? GC.BRIDGE : GC.FORD) : GC.WATER; hgt[i] = 0; } }
  }
  if (o.siege) { // wall line on the right side
    const wx = BCW - 40; for (let y = 0; y < BCH; y++) for (let x = wx; x < wx + 3; x++) { const i = y * BCW + x; g[i] = Math.abs(y - BCH / 2) < 4 ? GC.GATE : GC.WALL; hgt[i] = 2; }
    for (let y = 0; y < BCH; y++) for (let x = wx + 3; x < BCW; x++) { const i = y * BCW + x; if (g[i] === GC.FOREST || g[i] === GC.MARSH) g[i] = 0; hgt[i] = 1; }
    rv = { wall: wx };
  }
  const T0 = Object.keys(cnt).map(Number).filter(t => !TINFO[t].water).sort((a, b) => c(b) - c(a))[0];
  return { g, hgt, base: T0 === undefined ? TR.GRASS : T0, rv, tile, siege: !!o.siege, temp: WD.temp[tile], W: BF.W, H: BF.H, size: sz };
}
const cellAt = (F, x, y) => { const cx = clamp(Math.floor(x / BF.CELL), 0, BCW - 1), cy = clamp(Math.floor(y / BF.CELL), 0, BCH - 1); return cy * BCW + cx; };
function passCell(F, i, u) { const k = F.g[i]; if (k === GC.WATER) return false; if (k === GC.WALL) return u.side === F.defSide || (u.ladders && !MOUNTED[u.type]); return true; }
// ---------- pathfinding: BFS distance fields toward a target cell (cached), used when the straight line is blocked ----------
const BN8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function distField(F, tc, cls) {
  if (!F.dfc) F.dfc = new Map(); const key = tc * 2 + cls; let d = F.dfc.get(key); if (d) return d;
  d = new Int16Array(BCW * BCH).fill(-1); const q = new Int32Array(BCW * BCH); let h = 0, t = 0; d[tc] = 0; q[t++] = tc;
  const ok = i => { const k = F.g[i]; return k !== GC.WATER && (k !== GC.WALL || cls === 1); };
  while (h < t) { const i = q[h++], x = i % BCW, y = (i / BCW) | 0, nd = d[i] + 1; for (const [dx, dy] of BN8) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= BCW || Y >= BCH) continue; const j = Y * BCW + X; if (d[j] >= 0 || !ok(j)) continue; d[j] = nd; q[t++] = j; } }
  if (F.dfc.size > 48) F.dfc.delete(F.dfc.keys().next().value); F.dfc.set(key, d); return d;
}
function lineClear(F, u, x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3); for (let k = 1; k <= n; k++) { if (!passCell(F, cellAt(F, x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n), u)) return false; } return true; }
function steerPoint(F, u, tx, ty) {
  if (lineClear(F, u, u.x, u.y, tx, ty)) return null;
  const cls = (u.side === F.defSide || (u.ladders && !MOUNTED[u.type])) ? 1 : 0, df = distField(F, cellAt(F, tx, ty), cls);
  let c = cellAt(F, u.x, u.y), best = null;
  for (let k = 0; k < 14; k++) { const x = c % BCW, y = (c / BCW) | 0; let nb = -1, bd = df[c] >= 0 ? df[c] : 1e9; for (const [dx, dy] of BN8) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= BCW || Y >= BCH) continue; const j = Y * BCW + X; if (df[j] >= 0 && df[j] < bd) { bd = df[j]; nb = j; } } if (nb < 0) break; c = nb; const px = (c % BCW) * BF.CELL + 2, py = ((c / BCW) | 0) * BF.CELL + 2; if (k < 2 || lineClear(F, u, u.x, u.y, px, py)) best = [px, py]; else break; }
  return best;
}
// a forest big enough to hide a regiment inside a side's deployment zone
function findForest(F, side) {
  const z = deployZoneF(F, side); let best = null, bs = -1e9;
  for (let cy = 6; cy < BCH - 6; cy += 2) for (let cx = 4; cx < BCW - 4; cx += 2) { const x = cx * BF.CELL + 2, y = cy * BF.CELL + 2; if (x < z[0] + 20 || x > z[1] + 24) continue; if (F.g[cy * BCW + cx] !== GC.FOREST) continue;
    let n = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (F.g[(cy + dy) * BCW + cx + dx] === GC.FOREST) n++; if (n < 26) continue;
    const s = n * 2 - Math.abs(y - BF.H / 2) * 0.35 - Math.abs(x - (side === 0 ? z[1] : z[0])) * 0.25; if (s > bs) { bs = s; best = [x, y]; } }
  return best; }
function deployZoneF(F, side) { const z = F.siege ? F.rv.wall * BF.CELL - 30 : Math.round(F.W * 0.38); return side === 0 ? [14, z] : [F.W - z, F.W - 14]; }
// ---------- formations ----------
const FORMS = {
  line: { n: 'Строй', sp: 1, atk: 1, def: 1, arr: 1, fr: 1, r: 1 },
  close: { n: 'Стена щитов', sp: 0.6, atk: 0.9, def: 1.35, arr: 0.55, fr: 0.9, r: 0.85 },
  loose: { n: 'Рассыпной', sp: 1.1, atk: 0.75, def: 0.7, arr: 0.45, fr: 0.8, r: 1.3 },
  wedge: { n: 'Клин', sp: 1.05, atk: 1.25, def: 0.85, arr: 1.1, fr: 0.85, r: 0.95 },
  square: { n: 'Ёж', sp: 0, atk: 0.85, def: 1.2, arr: 1.3, fr: 0.6, r: 0.9 },
  column: { n: 'Колонна', sp: 1.35, atk: 0.7, def: 0.7, arr: 1.2, fr: 0.55, r: 0.9 },
};
const FORMK = ['line', 'close', 'loose', 'wedge', 'square', 'column'];
const FORM_OK = { levy: ['line', 'loose', 'square', 'column'], spear: ['line', 'close', 'square', 'column'], sword: ['line', 'close', 'wedge', 'column'], archer: ['line', 'loose', 'column'], xbow: ['line', 'close', 'loose', 'column'], horse: ['line', 'wedge', 'loose', 'column'], harch: ['loose', 'line', 'column'], knight: ['wedge', 'line', 'column'] };
const formName = (t, k) => t === 'xbow' && k === 'close' ? 'Павезы' : FORMS[k].n;
function setForm(B, u, k, lock) {
  if (!FORM_OK[u.type].includes(k)) return false; if (lock !== undefined) u.formLock = lock;
  if (B.phase === 'deploy') { u.form = k; u.formTo = null; return true; }
  if ((u.formTo || u.form) === k) return true; if (u.form === k) { u.formTo = null; return true; }
  u.formTo = k; u.formT = B.t + (k === 'square' ? 3 : 2.2) * (1.25 - u.xp / 250) * (u.type === 'levy' ? 1.35 : 1) * (u.contact.length ? 1.6 : 1); return true; }
// ---------- regiments & captains ----------
const REGK = ['C', 'R', 'L', 'V', 'S'];
const REGN = { C: 'Большой полк', R: 'Полк правой руки', L: 'Полк левой руки', V: 'Передовой полк', S: 'Засадный полк' };
const REGS = { C: 'Большой', R: 'Правой руки', L: 'Левой руки', V: 'Передовой', S: 'Засадный' };
const ORDN = { hold: 'Стоять', adv: 'Наступать', flank: 'Обход', skirm: 'Перестрелка', wait: 'Ждать сигнала', pursue: 'Преследовать', back: 'Отход', auto: 'На усмотрение', move: 'Идут', attack: 'Атакуют', reserve: 'В резерве' };
const CAPT_T = ['Воевода', 'Хирдман', 'Капитан', 'Брат', 'Кентарх', 'Сотник', 'Атаман'];
function mkCaptain(realm, rng) { rng = rng || R; const r = realm === undefined || realm < 0 || realm > 6 ? 6 : realm; const cul = REALM_DEF[r].key; const pool = ['brave', 'brave', 'cautious', 'cautious', 'reckless', 'craven'];
  return { n: pickName(cul, 0, rng), t: CAPT_T[r], mar: r === 6 ? rng.i(2, 8) : rng.i(3, 11), tr: rng.f() < 0.55 ? [rng.pick(pool)] : [], xp: 0, age: rng.i(22, 50), seed: rng.i(1, 1e9), cul }; }
// two captains of one army never share a name (renaming is safe: they are referenced by object)
function uniqCapts(L, taken, rng) { const used = new Set(taken || []); for (const c of L) { let k = 0; while (used.has(c.n) && k++ < 10) c.n = pickName(c.cul || 'K', 0, rng || R); used.add(c.n); } return L; }
function ensureCapts(a) { a.capts = (a.capts || []).filter(c => c && !c.dead); while (a.capts.length < 4) a.capts.push(mkCaptain(a.realm)); const g = a.gen !== undefined && a.gen >= 0 && typeof charOf === 'function' ? charOf(a.gen) : null; return uniqCapts(a.capts, g ? [g.name] : []); }
const CAPC = new Map();
function captChar(c) { if (!c) return null; if (c.ch) return c.ch; let p = CAPC.get(c.seed); if (!p) { p = { id: 'cp' + c.seed, name: c.n, role: 'general', cul: c.cul || 'K', fem: 0, age: c.age || 30, realm: 0, pseed: c.seed, traits: c.tr || [], alive: 1, prison: -1, pseudo: 1 }; CAPC.set(c.seed, p); } return p; }
const hasTr = (c, t) => !!(c && c.tr && c.tr.includes(t));
function mkReg(side, k) { return { side, k, cmd: null, order: { k: 'hold' }, pend: null, then: k === 'S' ? 'auto' : 'adv', ax: 0, ay: 0, af: side ? Math.PI : 0, thinkT: R.f() * 1.2, lead: -1, engT: 0, cur: 'hold', fl: 0, vmin: 12 }; }
const latS = side => side === 0 ? 1 : -1; // lateral sign: +1 means "right hand" is +y
function slotOf(g, u) { const c = Math.cos(g.af), s = Math.sin(g.af); return [g.ax + c * u.sx - s * u.sy, g.ay + s * u.sx + c * u.sy]; }
function setSlot(g, u) { const dx = u.x - g.ax, dy = u.y - g.ay, c = Math.cos(g.af), s = Math.sin(g.af); u.sx = dx * c + dy * s; u.sy = -dx * s + dy * c; }
function regUnits(B, side, k, all) { return B.units.filter(u => u.side === side && u.reg === k && bAlive(u) && (all || u.state !== 'rout')); }
function leadOf(B, g) { if (!g || g.lead < 0) return null; const u = B.units[g.lead]; return u && bAlive(u) && u.state !== 'rout' ? u : null; }
function cmdOk(g) { return g && g.cmd && g.cmd.alive && !g.cmd.away ? g.cmd : null; }
const LEADP = { knight: 0, sword: 1, horse: 2, spear: 3, levy: 4, xbow: 5, archer: 6, harch: 7 };
function pickLead(us) { return us.slice().sort((a, b) => LEADP[a.type] - LEADP[b.type] || b.men - a.men)[0]; }
function genOf(B, side) { return B.units.find(x => x.side === side && x.gen && bAlive(x)) || null; }
// ---------- setup ----------
const BORD = ['sword', 'spear', 'levy', 'knight', 'horse', 'harch', 'archer', 'xbow'];
function mkBlocks(B, side, S, bmax) {
  const mor = (S.ground === 'death' ? 25 : 0) + (S.ground === 'dispersive' ? -5 : 0) + (S.gen ? traitSum(S.gen, 'mor') : 0);
  for (const t of BORD) { const n = Math.round(S.u[t] || 0); if (n <= 0) continue; const parts = Math.max(1, Math.ceil(n / bmax));
    for (let k = 0; k < parts; k++) { const m = Math.round(n * (k + 1) / parts) - Math.round(n * k / parts); if (m <= 0) continue;
      B.units.push({ id: B.units.length, side, type: t, men: m, men0: m, mor0: 0, morale: clamp(S.morale + mor + (UNIT[t].mor - 55) * 0.5 + ((S.xp && S.xp[t]) || 0) * 0.15, 10, 100), fat: S.fat || 0, xp: (S.xp && S.xp[t]) || 0, x: 0, y: 0, face: side === 0 ? 0 : Math.PI, order: null, state: 'idle', ammo: RANGED[t] ? (S.ammo || 30) : 0, cd: R.f() * 2, contact: [], ch: 0, gen: false, routT: 0, hidden: false, kills: 0, lastHit: -9, lastArr: -9, lastShot: -9, shots: 0, reg: 'C', form: t === 'harch' ? 'loose' : 'line', formTo: null, formT: 0, formLock: false, man: false, sx: 0, sy: 0 }); } }
}
// distribute blocks among the five regiments and lay them out by a template
function deployRegs(B, side, tpl) {
  useField(B.F); const F = B.F, us = B.units.filter(u => u.side === side && bAlive(u)); if (!us.length) return;
  const regs = B.regs[side]; for (const u of us) { u.hidden = false; u.man = false; u.order = null; u.pend = null; u.state = 'idle'; u.formLock = false; u.form = u.type === 'harch' ? 'loose' : 'line'; u.formTo = null; }
  if (F.siege && side === F.defSide) { B.tpl[side] = 'wall'; siegeDeploy(B, side); assignLeads(B, side); initOrders(B, side); return; }
  if (tpl === 'amb' && !F.forest[side]) tpl = 'std'; if (!tpl) tpl = 'std';
  B.tpl[side] = tpl; const dir = side === 0 ? 1 : -1, a0 = side === 0 ? 0 : Math.PI, lat = latS(side), midY = BF.H / 2;
  const by = t => us.filter(u => u.type === t), qual = { sword: 3, spear: 2, levy: 1 };
  const inf = us.filter(u => qual[u.type]).sort((a, b) => (tpl === 'def' ? (a.type === 'spear' ? -1 : 0) - (b.type === 'spear' ? -1 : 0) : 0) || qual[b.type] - qual[a.type] || b.men - a.men);
  const L = { C: [], R: [], L: [], V: [], S: [] }, share = tpl === 'cres' ? { C: 0.3, R: 0.35, L: 0.35 } : { C: 0.5, R: 0.25, L: 0.25 };
  if (inf.length <= 2) L.C = inf.slice(); else for (const u of inf) { let best = 'C', bd = -1e9; const n = L.C.length + L.R.length + L.L.length + 1; for (const k of tpl === 'cres' ? ['R', 'L', 'C'] : ['C', 'R', 'L']) { const d = share[k] * n - L[k].length; if (d > bd + 1e-6) { bd = d; best = k; } } L[best].push(u); }
  L.V = by('archer').concat(by('xbow'));
  const hs = by('horse'), kn = by('knight'), ha = by('harch');
  if (tpl === 'amb') L.S = kn.concat(hs);
  else { L.S = kn.slice(); const wing = hs.slice(); if (!kn.length && wing.length >= 3) L.S.push(wing.pop()); wing.forEach((u, i) => L[i % 2 ? 'L' : 'R'].push(u)); }
  ha.forEach((u, i) => L[i % 2 ? 'L' : 'R'].push(u)); // horse archers ride at the outer ends of the wings
  for (const k of REGK) for (const u of L[k]) u.reg = k;
  L.L.reverse(); // the outer (left) end first so wing horse stands outermost
  const sp = 2 * bRadN(B.bmax) + 5, avail = BF.H - 40;
  const per = { C: Math.max(1, L.C.length), R: Math.max(1, L.R.length), L: Math.max(1, L.L.length) };
  const wid = k => L[k].length ? Math.min(per[k], L[k].length) * sp : 0;
  for (let g = 0; g < 40 && wid('C') + wid('R') + wid('L') + 16 > avail && Math.max(per.C, per.R, per.L) > 1; g++) { const k = ['C', 'R', 'L'].sort((a, b) => wid(b) - wid(a))[0]; per[k]--; }
  const z = deployZoneF(F, side), bx = side === 0 ? Math.round(z[1] * 0.62) : BF.W - Math.round((BF.W - z[0]) * 0.62);
  const T = { std: { C: 0, R: 0, L: 0, V: 50, S: -64 }, def: { C: 0, R: -22, L: -22, V: -38, S: -70 }, amb: { C: 0, R: 0, L: 0, V: 50, S: 0 }, wedge: { C: -12, R: -14, L: -14, V: -48, S: 40 }, cres: { C: -28, R: 28, L: 28, V: 46, S: -68 } }[tpl];
  const wC = wid('C'), wR = wid('R'), wL = wid('L'), anch = { C: [T.C, 0], R: [T.R, wC / 2 + (wR ? 8 + wR / 2 : 0)], L: [T.L, -(wC / 2 + (wL ? 8 + wL / 2 : 0))], V: [T.V, 0], S: [T.S, 0] };
  for (const k of REGK) {
    const g = regs[k], A = anch[k]; g.af = a0; g.ax = bx + dir * A[0]; g.ay = midY + lat * A[1]; const list = L[k]; if (!list.length) continue;
    if (k === 'S' && tpl === 'amb') { const fp = F.forest[side]; g.ax = fp[0]; g.ay = fp[1]; list.forEach((u, i) => { const r = Math.floor(i / 2), c = i % 2; u.x = fp[0] - dir * r * sp * 0.8; u.y = fp[1] + (c - 0.5) * sp * 0.8 * (list.length > 1 ? 1 : 0); u.hidden = true; }); continue; }
    const pr = k === 'V' ? Math.max(1, Math.floor(avail / (sp * 1.15))) : k === 'S' ? Math.max(2, Math.ceil(list.length / 2)) : per[k], gap = k === 'V' ? sp * 1.15 : sp;
    list.forEach((u, i) => { const r = Math.floor(i / pr), n = Math.min(pr, list.length - r * pr), c = i - r * pr; const sx = -r * sp * 0.95, sy = (c - (n - 1) / 2) * gap; u.x = g.ax + dir * sx - 0 * sy; u.y = g.ay + lat * sy; });
  }
  for (const u of us) { u.x = clamp(u.x, 16, BF.W - 16); u.y = clamp(u.y, 16, BF.H - 16); u.face = a0; let n = 0; while (!passCell(F, cellAt(F, u.x, u.y), u) && n++ < 40) u.x -= dir * 4; }
  if (tpl === 'def') for (const u of us) if (u.reg === 'C' && (u.type === 'spear' || u.type === 'sword')) u.form = 'close';
  if (tpl === 'wedge') for (const u of us) if (u.reg === 'S' && FORM_OK[u.type].includes('wedge')) u.form = 'wedge';
  for (const k of REGK) for (const u of us) if (u.reg === k) setSlot(regs[k], u);
  assignLeads(B, side); initOrders(B, side);
}
function siegeDeploy(B, side) {
  const us = B.units.filter(u => u.side === side && bAlive(u)), wx = B.F.rv.wall * BF.CELL, regs = B.regs[side];
  const shoot = us.filter(u => RANGED[u.type] && u.type !== 'harch'), inf = us.filter(u => !MOUNTED[u.type] && !shoot.includes(u)), cav = us.filter(u => MOUNTED[u.type]);
  shoot.forEach((u, k) => { u.reg = 'V'; u.x = wx + 6; u.y = 40 + (k + 0.5) * (BF.H - 80) / Math.max(1, shoot.length); });
  inf.forEach((u, k) => { u.reg = 'C'; u.x = wx + 40 + (k % 2) * 30; u.y = 40 + (k + 0.5) * (BF.H - 80) / Math.max(1, inf.length); });
  cav.forEach((u, k) => { u.reg = 'S'; u.x = Math.min(BF.W - 16, wx + 100); u.y = BF.H / 2 + (k - (cav.length - 1) / 2) * 30; });
  for (const k of REGK) { const g = regs[k]; g.af = Math.PI; g.ax = k === 'V' ? wx + 6 : k === 'S' ? Math.min(BF.W - 16, wx + 100) : wx + 50; g.ay = BF.H / 2; }
  for (const u of us) { u.face = Math.PI; setSlot(regs[u.reg], u); }
}
// the general rides with the best block of the Large regiment; each captain with the best block of his own
function assignLeads(B, side) {
  const s = B.sides[side]; for (const u of B.units) if (u.side === side) u.gen = false;
  for (const k of REGK) { const g = B.regs[side][k], us = regUnits(B, side, k); g.lead = us.length ? pickLead(us).id : -1; }
  if (s.gen && !s.genFate) { const C = B.regs[side].C; let gu = C.lead >= 0 ? B.units[C.lead] : null; if (!gu) { const any = B.units.filter(u => u.side === side && bAlive(u)); gu = any.length ? pickLead(any) : null; if (gu) C.lead = gu.id; } if (gu) gu.gen = true; }
}
function initOrders(B, side) {
  const tpl = B.tpl[side], ai = B.ai ? B.ai[side] : true, F = B.F;
  for (const k of REGK) { const g = B.regs[side][k]; let o;
    if (F.siege) o = side === F.defSide ? 'hold' : ai ? 'adv' : 'hold';
    else if (ai) o = k === 'S' && tpl === 'amb' ? 'wait' : 'auto';
    else o = k === 'V' ? (tpl === 'def' || tpl === 'wedge' ? 'hold' : 'skirm') : k === 'S' ? (tpl === 'wedge' ? 'hold' : 'wait') : 'hold';
    g.order = { k: o }; g.cur = o; g.then = k === 'S' ? 'auto' : 'adv'; g.pend = null; g.fl = 0; g.backTo = null; }
}
function aiTemplate(B, side) {
  const F = B.F, s = B.sides[side], o = B.sides[1 - side]; if (F.siege) return 'std';
  const ratio = powerU(s.u, s.xp) / Math.max(1, powerU(o.u, o.xp)), g = s.gen, mar = g ? g.mar : 4, tr = t => !!(g && g.traits.includes(t));
  const men = Math.max(1, menOf(s.u)), kn = (s.u.knight || 0) / men, cav = mountedN(s.u) / men, rng = mkRng(B.tile * 7 + side * 13 + G.day);
  if (F.forest[side] && cav > 0.1 && (tr('cunning') || tr('cautious') || rng.f() < 0.2 + mar * 0.02)) return 'amb';
  if (ratio < 0.8 || (tr('cautious') && ratio < 1.1)) return 'def';
  if (kn > 0.08 && (tr('reckless') || tr('brave') || rng.f() < 0.4)) return 'wedge';
  if (ratio > 1.35 && mar >= 8 && rng.f() < 0.6) return 'cres';
  return 'std';
}
function scoutQ(s) { const men = Math.max(1, menOf(s.u)); const lc = ((s.u.horse || 0) + (s.u.harch || 0) * 1.4) / men; return Math.min(0.55, lc * 3) + 0.08 + (s.gen ? s.gen.mar * 0.02 + traitSum(s.gen, 'scout') * 0.1 : 0); }
// a, b: {u, xp, morale, fat, gen(char), ammo, realm, name, capts}
function setupBattle(A, Bs, tile, o) {
  o = o || {}; const menA = menOf(A.u), menB = menOf(Bs.u), size = FSZ[o.size] ? o.size : fieldSizeFor(menA + menB);
  const F = bField(tile, Object.assign({}, o, { size })); F.defSide = o.siege ? 1 : -1; F.forest = [findForest(F, 0), findForest(F, 1)]; F.forestPos = F.forest[0];
  const B = { F, units: [], t: 0, phase: 'deploy', sides: [A, Bs], fx: [], arrows: [], couriers: [], dead: [], over: null, sel: [], selRegs: [], speed: 1, log: [], aiT: [0.5, 0.5], o, tile, bmax: clamp(Math.round(Math.max(menA, menB) / 9), 40, 150), regs: [{}, {}], tpl: ['std', 'std'], ghost: [{}, {}], visT: 0, sigT: [-99, -99], rallyT: [-99, -99], stance: ['hold', 'hold'], tl: { S: 360, M: 480, L: 600 }[size], ai: o.ai || [true, true], cam: { x: 0, y: 0 } };
  B.stat = { mel: [0, 0], pur: [0, 0], sht: [0, 0], chg: [0, 0], flk: [0, 0], ff: [0, 0] };
  for (const side of [0, 1]) { for (const k of REGK) B.regs[side][k] = mkReg(side, k); mkBlocks(B, side, B.sides[side], B.bmax); }
  B.vis = [new Uint8Array(B.units.length), new Uint8Array(B.units.length)];
  for (const side of [0, 1]) { const s = B.sides[side], caps = (s.capts || []).slice(); let ci = 0;
    for (const k of REGK) { const g = B.regs[side][k]; if (k === 'C' && s.gen) g.cmd = { n: s.gen.name, t: s.gen.title || '', mar: s.gen.mar, tr: s.gen.traits, gen: 1, ch: s.gen, alive: 1 }; else { const c = caps[ci++]; g.cmd = c ? { n: c.n, t: c.t, mar: c.mar, tr: c.tr, ref: c, alive: 1, cul: c.cul, age: c.age, seed: c.seed } : null; } } }
  deployRegs(B, 0, o.tplA || (B.ai[0] ? aiTemplate(B, 0) : 'std')); deployRegs(B, 1, o.tplB || aiTemplate(B, 1));
  // captains' temper colours their men's spirit
  for (const u of B.units) { const c = B.regs[u.side][u.reg].cmd; if (hasTr(c, 'brave')) u.morale = Math.min(100, u.morale + 4); if (hasTr(c, 'craven')) u.morale -= 4; }
  if (o.siege) for (const u of B.units) if (u.side === 0) u.ladders = o.works >= 1;
  B.scout = [scoutQ(A) + (o.amb ? 0.6 : 0), scoutQ(Bs) - (o.amb ? 0.5 : 0)];
  return B;
}
