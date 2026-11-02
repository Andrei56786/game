'use strict';
// ===== PORTRAIT v3: procedural 48x48 pixel-art portraits (hue-shifted ramps, dithered light, selective outline) =====
const PORT = {};
const SKIN_BY_CUL = { K: [0, 1, 1, 2, 0], C: [0, 0, 1], R: [1, 2, 2, 3], T: [0, 1, 2], E: [1, 2, 3, 4], F: [0, 1, 2, 3], B: [1, 2, 3, 2] };
const HAIR_BY_CUL = { K: ['h_brown', 'h_dkbrown', 'h_blond', 'h_auburn', 'h_black', 'h_brown'], C: ['h_blond', 'h_ginger', 'h_brown', 'h_auburn', 'h_blond'], R: ['h_black', 'h_dkbrown', 'h_brown', 'h_black'], T: ['h_brown', 'h_dkbrown', 'h_blond', 'h_black'], E: ['h_black', 'h_black', 'h_dkbrown'], F: ['h_brown', 'h_dkbrown', 'h_auburn', 'h_blond'], B: ['h_dkbrown', 'h_black', 'h_brown', 'h_ginger'] };
const EYEC = { brown: ['#2a1608', '#5a3418', '#8a5a30'], blue: ['#10203a', '#2c5c9c', '#6a9ad0'], green: ['#10241a', '#2e6a40', '#6aa868'], gray: ['#20242a', '#5a6470', '#9aa4ae'], dark: ['#0e0a0c', '#2a1c1a', '#4a3428'] };
const REALM_RAMP = ['blue', 'red', 'gold', 'purple', 'white', 'brown', 'black'];
// role/seat -> outfit, hat, cloth ramp, background ramp
const SEAT_LOOK = {
  chancellor: { o: 'robe', cl: 'wine', bg: 'wine', chain: 1, hat: 'none' }, treasurer: { o: 'doublet', cl: 'green', bg: 'forest', chain: 1, hat: 'cap' },
  marshal: { o: 'armor', cl: 'realm', bg: 'red', hat: 'none' }, eye: { o: 'cloak', cl: 'black', bg: 'navy', hat: 'hood' },
  seneschal: { o: 'doublet', cl: 'brown', bg: 'brown', hat: 'none', keys: 1 }, magister: { o: 'robe', cl: 'gray', bg: 'teal', stole: 'purple', hat: 'skull' },
  justice: { o: 'judge', cl: 'black', bg: 'wine', hat: 'none' },
};
function lookKey(c) { return (c.seat || c.role || '') + '|' + (c.age < 14 ? 'c' : c.age < 52 ? 'a' : c.age < 64 ? 'o' : 'v') + '|' + (c.fem ? 1 : 0) + '|' + (c.realm | 0) + '|' + (c.house === undefined ? '' : c.house); }
function lookOf(c) {
  const k = lookKey(c); if (c._look && c._lookK === k) return c._look;
  const r = mkRng(((c.pseed || (c.id * 7919 + 13)) ^ 0x51ed) >>> 0); const cul = c.cul || 'K', fem = !!c.fem, age = c.age || 30, role = c.role || 'courtier';
  const L = { key: k, fem, age, cul, role, child: age < 14 };
  L.skin = 'skin' + r.pick(SKIN_BY_CUL[cul] || SKIN_BY_CUL.K);
  let hair = r.pick(HAIR_BY_CUL[cul] || HAIR_BY_CUL.K); const gr = r.f();
  if (age > 66 || (age > 56 && gr < 0.55)) hair = 'h_white'; else if (age > 50 && gr < 0.7) hair = 'h_gray';
  L.hair = hair; L.eye = r.pick(cul === 'C' ? ['blue', 'blue', 'gray', 'green'] : cul === 'E' || cul === 'R' ? ['brown', 'dark', 'brown', 'green'] : ['brown', 'blue', 'green', 'gray', 'brown']);
  L.jaw = fem ? r.pick(['narrow', 'mid', 'narrow']) : r.pick(['square', 'mid', 'mid', 'narrow']); L.wide = !fem && r.f() < 0.35;
  const tr = c.traits || [];
  L.brow = tr.includes('wrathful') || tr.includes('proud') ? 'angry' : tr.includes('craven') ? 'worried' : tr.includes('cunning') ? 'arched' : r.pick(['flat', 'flat', 'stern', 'arched']);
  L.thick = !fem && (tr.includes('brave') || tr.includes('wrathful') || r.f() < 0.3);
  L.mouth = tr.includes('generous') || tr.includes('honest') ? 'smile' : tr.includes('wrathful') || tr.includes('proud') ? 'frown' : tr.includes('cunning') || tr.includes('greedy') ? 'smirk' : r.pick(['flat', 'flat', 'smile']);
  L.scar = !fem && (tr.includes('brave') || tr.includes('reckless')) && r.f() < 0.5 && age > 22;
  if (fem) L.hs = r.pick(['longf', 'longf', 'braid', 'bun', 'curlyf', 'tiedf']); else L.hs = age > 58 && r.f() < 0.45 ? 'bald' : age > 44 && r.f() < 0.3 ? 'receding' : r.pick(['short', 'short', 'crop', 'long', 'curly', 'tied', 'part']);
  if (L.child) L.hs = fem ? r.pick(['longf', 'braid', 'tiedf']) : r.pick(['short', 'curly', 'part']);
  L.beard = 'none';
  if (!fem && !L.child && age > 18) L.beard = r.pick(cul === 'C' ? ['full', 'long', 'full', 'short', 'mustache'] : cul === 'R' ? ['goatee', 'mustache', 'none', 'short', 'stubble'] : cul === 'E' ? ['short', 'none', 'short', 'full'] : cul === 'T' ? ['none', 'short', 'full'] : ['none', 'stubble', 'short', 'full', 'mustache', 'goatee', 'none']);
  if (!fem && age > 60 && L.beard !== 'none' && r.f() < 0.5) L.beard = 'long';
  // outfit by role / seat
  let o = 'tunic', cl = REALM_RAMP[c.realm | 0] || 'brown', bg = cl, hat = 'none', chain = 0, stole = null, keys = 0;
  const seat = c.seat && SEAT_LOOK[c.seat];
  if (role === 'ruler') { o = cul === 'C' ? 'fur' : cul === 'T' ? 'monk' : 'royal'; hat = fem ? (cul === 'T' ? 'veil' : 'tiara') : ({ K: 'crown', C: 'furhat', R: 'doge', T: 'mitre', E: 'laurel' }[cul] || 'crown'); if (cul === 'E') cl = 'purple'; if (cul === 'R') { cl = 'gold'; } bg = REALM_RAMP[c.realm | 0]; chain = cul === 'R' ? 1 : 0; }
  else if (seat) { o = seat.o; cl = seat.cl === 'realm' ? REALM_RAMP[c.realm | 0] : seat.cl; bg = seat.bg; hat = seat.hat; chain = seat.chain || 0; stole = seat.stole || null; keys = seat.keys || 0; if (c.seat === 'marshal' && r.f() < 0.3) hat = 'none'; if (c.seat === 'eye' && fem) hat = 'hood'; if (c.seat === 'treasurer' && fem) hat = 'none'; }
  else if (role === 'consort') { o = fem ? 'dress' : 'doublet'; cl = fem ? r.pick(['wine', 'teal', 'blue', 'purple']) : 'navy'; hat = fem ? 'tiara' : 'circlet'; bg = 'wine'; }
  else if (role === 'heir' || role === 'child') { o = fem ? 'dress' : 'doublet'; cl = r.pick(['blue', 'teal', 'green', 'wine']); hat = role === 'heir' ? 'circlet' : 'none'; bg = 'navy'; }
  else if (role === 'general' || role === 'knight') { o = r.f() < 0.55 ? 'armor' : 'mail'; hat = r.f() < 0.4 ? 'helm' : 'none'; bg = 'red'; if (cul === 'C') { o = 'fur'; hat = r.f() < 0.5 ? 'helm' : 'none'; } if (cul === 'T') { o = 'mail'; hat = fem ? 'veil' : 'hoodcl'; cl = 'purple'; } }
  else if (role === 'lord') { o = r.pick(['doublet', 'armor', 'doublet']); hat = r.pick(['circlet', 'none', 'cap']); bg = 'brown'; }
  else if (role === 'merchant') { o = 'merchant'; cl = r.pick(['wine', 'teal', 'orange', 'navy']); hat = 'cap'; bg = 'orange'; chain = 1; }
  else if (role === 'bandit') { o = 'tunic'; cl = r.pick(['brown', 'forest', 'gray']); hat = r.f() < 0.6 ? 'hoodcl' : 'none'; bg = 'black'; }
  else if (role === 'mentor') { o = 'robe'; cl = 'teal'; bg = 'teal'; hat = 'none'; L.hs = 'bald'; L.beard = 'long'; L.hair = 'h_white'; L.brow = 'flat'; L.mouth = 'smile'; }
  else if (role === 'guard') { o = 'mail'; hat = 'helm'; bg = 'gray'; }
  else if (role === 'servant' || role === 'cook') { o = 'tunic'; cl = r.pick(['brown', 'green', 'gray']); hat = role === 'cook' ? 'chef' : fem ? 'kerchief' : 'none'; bg = 'brown'; L.apron = 1; }
  else if (role === 'peasant') { o = 'tunic'; cl = r.pick(['brown', 'forest', 'orange', 'gray']); hat = r.pick(['none', 'straw', fem ? 'kerchief' : 'none']); bg = 'forest'; }
  else if (role === 'envoy') { o = 'doublet'; hat = 'cap'; bg = REALM_RAMP[c.realm | 0]; chain = 1; }
  else if (role === 'scholar') { o = 'robe'; cl = 'gray'; bg = 'teal'; hat = 'skull'; }
  else if (LOOK_EXT[role]) { const e = LOOK_EXT[role](r, fem); o = e.o; cl = e.cl; bg = e.bg; hat = e.hat; chain = e.chain || 0; keys = e.keys || 0; if (e.apron) L.apron = 1; }
  else if (role === 'courtier' || role === 'noble') { o = fem ? 'dress' : 'doublet'; cl = c.hcol || r.pick(['wine', 'blue', 'green', 'teal', 'purple']); bg = 'brown'; hat = fem ? r.pick(['none', 'circlet']) : r.pick(['none', 'cap']); }
  if (c.hcol && (role === 'knight' || role === 'courtier' || role === 'lord' || role === 'general')) cl = c.hcol;
  if (fem && o === 'armor' && r.f() < 0.5) hat = 'none';
  if (hat === 'hood' || hat === 'hoodcl' || hat === 'veil' || hat === 'helm' || hat === 'mitre') { if (L.hs === 'longf' || L.hs === 'braid' || L.hs === 'tiedf' || L.hs === 'curlyf') L.hs = 'short'; }
  Object.assign(L, { o, cl, bg, hat, chain, stole, keys });
  c._look = L; c._lookK = k; return L;
}
function portrait(c) {
  if (!c) return null; const L = lookOf(c);
  const key = c.id + ':' + L.key + ':' + (c.alive ? 1 : 0) + (c.prison >= 0 ? 'p' : ''); if (PORT[key]) return PORT[key];
  const N = 48, bg = new PB(N, N), fg = new PB(N, N), back = new PB(N, N), r = mkRng(((c.pseed || 7) ^ 0x2b2b) >>> 0);
  const SK = RPK[L.skin], HR = RPK[L.hair], CL = RPK[L.cl] || RPK.brown, EY = EYEC[L.eye].map(hx), GM = RPK.gmetal, ST = RPK.steel;
  // ---- background: dithered radial light + vignette
  const BG = RPK[L.bg] || RPK.brown;
  const BT = [cmix(BG[0], hx('#0c0a10'), 0.35), BG[0], cmix(BG[0], BG[1], 0.5), BG[1], cmix(BG[1], BG[2], 0.45)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot((x - 24) / 30, (y - 16) / 32); let v = clamp(1.2 - d, 0, 1) * 4.2; v += (bay(x, y) - 0.5) * 0.55; bg.put(x, y, BT[clamp(Math.floor(v), 0, 4)]); }
  const cx = 24, ch = L.child, fem = L.fem, ht = ch ? 9 : 7, chin = ch ? 33 : fem ? 33 : 34, ey = ht + 14, my = ch ? ey + 8 : ey + 9;
  const Rw = (ch ? 10.2 : fem ? 9.3 : L.wide ? 10.5 : 9.8), Jw = ch ? 5.2 : L.jaw === 'square' ? 5.6 : L.jaw === 'narrow' ? 3.6 : 4.6, pj = L.jaw === 'square' ? 2.3 : L.jaw === 'narrow' ? 1.15 : 1.6;
  const hw = y => { const yc = y + 0.5, dome = ht + 9; if (yc < dome) { const t = (dome - yc) / 10; return Rw * Math.sqrt(Math.max(0, 1 - t * t)); } const ce = ht + 19; if (yc < ce) return Rw + (yc > ht + 13 && yc < ht + 17 ? 0.3 : 0); const s = (yc - ce) / (chin + 1 - ce); return Rw - (Rw - Jw) * Math.pow(clamp(s, 0, 1), pj); };
  const inFace = (x, y) => y >= ht && y <= chin && Math.abs(x + 0.5 - cx) <= hw(y);
  const HRc = i => HR[clamp(i, 0, 3)];
  // ---- back hair (behind body): long styles
  const longBack = { longf: 46, long: 40, braid: 44, curlyf: 45, tiedf: 0 }[L.hs] || 0;
  if (longBack) { for (let y = ht + 4; y <= longBack; y++) { const t = (y - ht - 4) / (longBack - ht - 4); const half = (Rw + 2.6 + (L.hs === 'curlyf' ? 1.5 : 0)) * (y < ht + 14 ? 1 : 1 - 0.25 * t); for (let x = 0; x < N; x++) { const dx = x + 0.5 - cx; if (Math.abs(dx) > half) continue; let col = dx > half * 0.35 ? HRc(1) : HRc(2); if (((x * 7 + y * 3) % 5 === 0) && dx < 0) col = HRc(3); if (y > longBack - 2) col = HRc(1); back.set(x, y, col); } } }
  // ---- neck
  for (let y = chin - 2; y <= 41; y++) for (let x = cx - 4; x < cx + 4; x++) { let t = x < cx - 2 ? 2 : 1; if (y <= chin + 2 && x > cx - 4) t = y <= chin + 1 ? 0 : 1; fg.set(x, y, SK[t]); }
  // ---- body / clothing
  const shoulder = ch ? 15 : fem ? 17.5 : 20;
  const sw = y => { const t = y - 36; if (t < 0) return 0; if (t <= 2) return 6 + t * 4; if (t <= 5) return 14 + (t - 2) * ((shoulder - 14) / 3); return shoulder + Math.min(2, (t - 5) * 0.5); };
  const bodyCol = (x, y, ramp, base) => { const R0 = ramp, u = (x + 0.5 - cx) / Math.max(1, sw(y)); let i = base; if (u > 0.45) i--; if (u > 0.8) i--; if (u < -0.55 && y < 41) i++; if ((Math.abs(x + 0.5 - cx) | 0) === 9 && y > 41 && ((y + x) & 1)) i--; return R0[clamp(i, 0, R0.length - 1)]; };
  for (let y = 36; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - cx; if (Math.abs(dx) > sw(y)) continue; let col;
    const o = L.o;
    if (o === 'armor') { const pa = Math.abs(Math.abs(dx) - 14) < 7 && y < 43 && ((Math.abs(dx) - 14) ** 2 / 49 + (y - 40) ** 2 / 16) < 1; col = bodyCol(x, y, ST, pa ? 4 : 3); if (pa && y === 38 && dx < 0) col = ST[5]; if (!pa && Math.abs(dx) < 7 && y >= 41) col = bodyCol(x, y, CL, 3); if (y <= 38 && Math.abs(dx) < 6) col = y === 37 ? ST[2] : ST[4]; if (pa && (y === 42 || y === 43)) col = ST[1]; }
    else if (o === 'mail') { col = ((x + y) & 1) ? bodyCol(x, y, ST, 3) : bodyCol(x, y, ST, 2); if (Math.abs(dx) < 8 && y >= 41) col = bodyCol(x, y, CL, 3); }
    else if (o === 'fur') { col = bodyCol(x, y, CL, 3); if (y < 41 || Math.abs(dx) > sw(y) - 4) { const v = hsh(x, y, 3); col = v < 0.3 ? hx('#8a6a4a') : v < 0.6 ? hx('#6a4e34') : v < 0.85 ? hx('#a8845a') : hx('#4a3424'); } }
    else if (o === 'royal') { col = bodyCol(x, y, CL, 3); if (y <= 40 && Math.abs(dx) > 3) { col = (x % 4 === 1 && y % 3 === 0) || (x % 4 === 3 && y % 3 === 2) ? hx('#1a1418') : dx > sw(y) * 0.5 ? hx('#c8c2cc') : hx('#f4f0f2'); } if (Math.abs(dx) < 3 && y > 37) col = GM[y % 2 ? 3 : 2]; }
    else if (o === 'robe' || o === 'monk') { col = bodyCol(x, y, CL, 3); if (Math.abs(dx) < (y - 35) * 0.55 && y < 42) col = o === 'monk' ? CL[1] : RPK.ivory[3]; }
    else if (o === 'doublet' || o === 'envoy') { col = bodyCol(x, y, CL, 3); if (y < 38 && Math.abs(dx) < 5) col = RPK.ivory[y === 36 ? 4 : 3]; if (Math.abs(dx) < 1 && y > 39 && y % 2 === 0) col = GM[4]; if (Math.abs(dx) > sw(y) - 5 && y < 41) col = bodyCol(x, y, CL, 4); }
    else if (o === 'dress') { col = bodyCol(x, y, CL, 3); if (Math.abs(dx) < 6 && y < 40) col = SK[dx > 2 ? 1 : 2]; if (y === 40 && Math.abs(dx) < 7) col = GM[3]; if (Math.abs(dx) > sw(y) - 3 && y < 42) col = bodyCol(x, y, CL, 4); }
    else if (o === 'judge') { col = bodyCol(x, y, CL, 3); if (y < 41 && Math.abs(dx) < 2.6 && Math.abs(dx) > 0.4) col = RPK.white[4]; if (y < 38 && Math.abs(dx) < 6 && Math.abs(dx) >= 2.6) col = CL[2]; }
    else if (o === 'cloak') { col = bodyCol(x, y, CL, 3); if (y < 39 && Math.abs(dx) < 7) col = CL[2]; if (Math.abs(dx) < 1.5 && y >= 39 && y <= 40) col = RPK.steel[4]; }
    else if (o === 'merchant') { col = bodyCol(x, y, CL, 3); if (y < 41 || Math.abs(dx) > sw(y) - 3) { const v = hsh(x, y, 5); col = v < 0.4 ? hx('#7a5636') : v < 0.75 ? hx('#9a7048') : hx('#5a3c24'); } }
    else { col = bodyCol(x, y, CL, 3); if (y < 38 && Math.abs(dx) < 3.5) col = SK[1]; if (y === 38 && Math.abs(dx) < 1) col = CL[1]; }
    if (L.apron && Math.abs(dx) < 6 && y >= 41) col = RPK.ivory[dx > 2 ? 2 : 3];
    if (L.stole && Math.abs(dx) > 4 && Math.abs(dx) < 7.5) col = bodyCol(x, y, RPK[L.stole], 3);
    fg.set(x, y, col);
  }
  if (L.chain) for (let dx = -12; dx <= 12; dx++) { const y = Math.round(39.5 + dx * dx / 34); if (y < N) fg.set(cx + dx, y, (dx & 1) ? GM[2] : GM[4]); }
  if (L.chain) { fg.rect(cx - 1, 44, 2, 2, GM[3]); fg.set(cx - 1, 44, GM[5]); }
  if (L.o === 'armor' && (c.realm | 0) < 7) { const d = REALM_DEF[c.realm | 0]; const chg = CHARGES[d.charge].split('|'); chg.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { const q = row[xx]; if (q === '.') continue; const cc = q === 'y' ? GM[4] : q === 'k' ? hx('#1a1418') : q === 'G' ? ST[4] : q === 'r' ? CL[1] : hx('#f4ecd8'); if (41 + yy < N) fg.set(cx - 3 + xx, 41 + yy, cc); } }); }
  // ---- head
  for (let y = ht; y <= chin; y++) for (let x = 0; x < N; x++) { if (!inFace(x, y)) continue; const u = (x + 0.5 - cx) / hw(y), v = (y - ht) / (chin - ht); let t = 2;
    if (u > 0.5) t = 1; if (v > 0.86 && u > -0.4) t = 1; if (u < -0.25 && u > -0.72 && v < 0.3 && v > 0.06) t = 3; if (u < -0.42 && u > -0.82 && v > 0.48 && v < 0.64) t = 3; if (u > 0.8 && v > 0.55) t = 0;
    fg.set(x, y, SK[t]); }
  // ears
  for (let y = ht + 11; y <= ht + 17; y++) { const e = y === ht + 11 || y === ht + 17 ? 1 : 2; const xl = Math.floor(cx - Rw - 0.2) - 1, xr = Math.ceil(cx + Rw + 0.2); for (let k = 0; k < e; k++) { fg.set(xl + 1 - k, y, k === 0 ? SK[1] : SK[2]); fg.set(xr - 1 + k, y, k === 0 ? SK[0] : SK[1]); } }
  // eyes
  const eye = (x0, right) => { const lid = HR[0];
    for (let i = 0; i < 4; i++) fg.set(x0 + i, ey - 1, i === (right ? 3 : 0) && !fem ? cmix(lid, SK[1], 0.5) : lid);
    fg.set(x0, ey, hx('#e8e2de')); fg.set(x0 + 3, ey, hx('#e8e2de')); fg.set(x0 + 1, ey, ch ? EY[1] : hx('#fbf8f4')); fg.set(x0 + 2, ey, EY[0]);
    fg.set(x0, ey + 1, hx('#d4cac6')); fg.set(x0 + 3, ey + 1, hx(right ? '#c4bab6' : '#d4cac6')); fg.set(x0 + 1, ey + 1, EY[1]); fg.set(x0 + 2, ey + 1, EY[2]);
    fg.set(x0 + 1, ey + 2, SK[right ? 1 : 2]); fg.set(x0 + 2, ey + 2, SK[1]);
    if (ch) { fg.set(x0 + 1, ey, hx('#fbf8f4')); fg.set(x0, ey + 1, hx('#e0dad6')); fg.set(x0 + 3, ey + 1, hx('#e0dad6')); }
    if (fem || ch) fg.set(right ? x0 + 4 : x0 - 1, ey - 1, lid);
    if (L.age > 50) { fg.set(x0 + 1, ey + 2, SK[1]); fg.set(x0 + 2, ey + 2, SK[1]); } };
  eye(cx - 6, false); eye(cx + 2, true);
  // brows
  const BRW = { flat: [0, 0, 0, 0, 0], angry: [-1, -1, 0, 0, 1], worried: [1, 0, 0, -1, -1], arched: [1, 0, -1, -1, 0], stern: [0, 0, 0, 0, 1] }[L.brow] || [0, 0, 0, 0, 0];
  const bc = (L.hair === 'h_white' || L.hair === 'h_blond') ? HR[1] : HR[1], by = ey - 3;
  for (let i = 0; i < 5; i++) { const off = BRW[i]; fg.set(cx - 7 + i, by + off, bc); fg.set(cx + 6 - i, by + off, bc); if (L.thick && i > 0 && i < 4) { fg.set(cx - 7 + i, by + off + 1, cmix(bc, SK[1], 0.4)); fg.set(cx + 6 - i, by + off + 1, cmix(bc, SK[1], 0.4)); } }
  // nose
  for (let y = ey + 1; y <= ey + 4; y++) fg.set(cx + 1, y, SK[1]);
  fg.set(cx - 1, ey + 4, SK[3]); fg.set(cx - 2, ey + 5, SK[1]); fg.set(cx - 1, ey + 5, SK[2]); fg.set(cx, ey + 5, SK[2]); fg.set(cx + 1, ey + 5, SK[1]); fg.set(cx + 2, ey + 5, SK[0]);
  fg.set(cx - 1, ey + 6, SK[1]); fg.set(cx, ey + 6, SK[1]); fg.set(cx + 1, ey + 6, SK[1]);
  // mouth
  const lipD = cmix(SK[0], hx('#7a2a2a'), fem ? 0.5 : 0.25), lipL = fem ? cmix(SK[2], hx('#c0504a'), 0.55) : SK[3];
  for (let x = cx - 3; x <= cx + 2; x++) fg.set(x, my, lipD);
  for (let x = cx - 2; x <= cx + 1; x++) fg.set(x, my + 1, lipL);
  if (fem) for (let x = cx - 1; x <= cx; x++) fg.set(x, my - 1, cmix(SK[1], hx('#b04a48'), 0.4));
  if (L.mouth === 'smile') { fg.set(cx - 3, my, SK[2]); fg.set(cx + 2, my, SK[1]); fg.set(cx - 4, my - 1, lipD); fg.set(cx + 3, my - 1, lipD); fg.set(cx - 3, my - 1, SK[2]); }
  else if (L.mouth === 'frown') { fg.set(cx - 4, my + 1, lipD); fg.set(cx + 3, my + 1, lipD); }
  else if (L.mouth === 'smirk') { fg.set(cx + 3, my - 1, lipD); fg.set(cx + 2, my, SK[1]); }
  if (fem || ch) { const bl = cmix(SK[3], hx('#e86a6a'), 0.35); fg.set(cx - 8, ey + 4, bl); fg.set(cx - 7, ey + 4, bl); fg.set(cx + 6, ey + 4, cmix(SK[2], hx('#e86a6a'), 0.3)); fg.set(cx + 7, ey + 4, cmix(SK[2], hx('#e86a6a'), 0.3)); }
  if (L.age > 44) { const wc = cmix(SK[2], SK[1], 0.7); for (let x = cx - 3; x <= cx + 2; x++) if (x !== cx) fg.set(x, ht + 5, wc); }
  if (L.age > 54) { const wc = SK[1]; fg.set(cx - 4, ey + 6, wc); fg.set(cx - 5, ey + 7, wc); fg.set(cx + 3, ey + 6, wc); fg.set(cx + 4, ey + 7, wc); fg.set(cx - 8, ey, wc); fg.set(cx + 7, ey, wc); }
  if (L.scar) { const sc = cmix(SK[1], hx('#d88a8a'), 0.5); for (let k = 0; k < 5; k++) fg.set(cx - 7 + (k >> 1), ey + 2 + k, sc); }
  // beard
  const bcol = (x, y) => { const dx = x + 0.5 - cx; let i = dx > hw(Math.min(y, chin)) * 0.3 ? 1 : 2; if (((x * 5 + y * 3) % 4 === 0) && dx < 0) i = 3; return HR[i]; };
  if (L.beard === 'stubble') { for (let y = ey + 6; y <= chin; y++) for (let x = 0; x < N; x++) if (inFace(x, y) && ((x + y) & 1) && !(y === my || y === my + 1) && (y > my || Math.abs(x + 0.5 - cx) > 3 || y > ey + 6)) fg.set(x, y, cmix(fg.get(x, y), HR[1], 0.45)); }
  else if (L.beard !== 'none') {
    const bottom = L.beard === 'long' ? chin + 9 : L.beard === 'full' ? chin + 3 : L.beard === 'short' ? chin + 1 : L.beard === 'goatee' ? chin + 2 : 0;
    if (L.beard === 'full' || L.beard === 'long' || L.beard === 'short') { for (let y = ey + 5; y <= bottom; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - cx; let half; if (y <= chin) half = hw(y) + 0.4; else { const t = (y - chin) / (bottom - chin + 1); half = Math.max(1, (hw(chin) + 1) * (1 - t * t) + (L.beard === 'long' ? 2 * (1 - t) : 0)); }
      if (Math.abs(dx) > half) continue; if (y <= ey + 7 && Math.abs(dx) < hw(y) - 2.2) continue; if (L.beard === 'short' && y < my - 1 && Math.abs(dx) < hw(y) - 1.6) continue;
      if ((y === my) && Math.abs(dx) < 2.5) { fg.set(x, y, HR[0]); continue; } if (y === my + 1 && Math.abs(dx) < 1.5) { fg.set(x, y, cmix(lipL, HR[2], 0.4)); continue; } fg.set(x, y, y >= bottom - 1 ? HR[1] : bcol(x, y)); } }
    if (L.beard === 'goatee') { for (let y = my + 1; y <= bottom; y++) for (let x = cx - 2; x < cx + 2; x++) fg.set(x, y, bcol(x, y)); }
    // moustache
    for (let x = cx - 4; x <= cx + 3; x++) { fg.set(x, my - 1, bcol(x, my - 1)); if (Math.abs(x + 0.5 - cx) < 3) fg.set(x, my - 2, bcol(x, my - 2)); }
    if (L.beard === 'mustache' || L.beard === 'goatee') { fg.set(cx - 5, my, HR[1]); fg.set(cx + 4, my, HR[1]); }
  }
  // ---- hair cap / front hair
  const vol = L.hs === 'curly' || L.hs === 'curlyf' ? 1.6 : L.hs === 'crop' ? 0.5 : 1.1;
  const hlBase = ht + (L.hs === 'receding' ? 2 : L.hs === 'crop' ? 4 : fem ? 5 : 4);
  const sideTo = L.hs === 'crop' ? ht + 10 : fem || L.hs === 'long' || L.hs === 'curlyf' ? ht + 20 : ht + 12;
  const hairline = x => { const dx = x + 0.5 - cx, a = Math.abs(dx); if (a > Rw - 2.2) return sideTo; if (L.hs === 'part') return hlBase + (dx < -1 ? 2 : dx < 3 ? 1 : 0); if (L.hs === 'receding') return a > 4.5 && a < Rw - 2.2 ? hlBase - 1 : hlBase + 1; if (fem) return hlBase + (a < 2 ? -1 : a < 6 ? 1 : 2); return hlBase + (a < 6 ? 1 : 0) + ((x & 1) ? 0 : 1) * (L.hs === 'short' ? 1 : 0); };
  if (L.hs !== 'bald') {
    for (let y = ht - 4; y <= sideTo; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - (ht + 9); const rx = Rw + vol + 0.2, ry = 11 + vol;
      let inside = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
      if (L.hs === 'curly' || L.hs === 'curlyf') { const bump = hsh(Math.floor((Math.atan2(dy, dx) + 4) * 4), 1, 9) * 1.2; inside = (dx * dx) / ((rx + bump) ** 2) + (dy * dy) / ((ry + bump) ** 2) <= 1; }
      if (y > ht + 9 && Math.abs(dx) <= Rw + vol + 0.6) inside = Math.abs(dx) > Rw - 2.2 && y <= sideTo;
      if (!inside) continue; if (y >= hairline(x) && inFace(x, y)) continue;
      if (y > ht + 9 && inFace(x, y) && Math.abs(dx) < Rw - 2.2) continue;
      let i = 2; if (dx > rx * 0.35) i = 1; if (dx < -2 && y < ht + 3 && ((x + y) % 3 !== 0)) i = 3; if (y >= hairline(x) - 1 && y > ht + 2 && Math.abs(dx) < Rw - 2) i = 1; if (L.hs === 'curly' || L.hs === 'curlyf') { if ((x * 3 + y * 5) % 7 < 2) i = 3; else if ((x * 3 + y * 5) % 7 === 4) i = 1; }
      fg.set(x, y, HR[i]);
    }
    // shadow cast by fringe on forehead
    for (let x = 0; x < N; x++) { const y = hairline(x); if (inFace(x, y) && Math.abs(x + 0.5 - cx) < Rw - 2.2 && fg.get(x, y) !== 0) fg.set(x, y, cmix(fg.get(x, y), SK[1], 0.6)); }
    if (L.hs === 'bun') { fg.ell(cx, ht - 3, 4.2, 3.4, 0, (x, y) => (x + 0.5 - cx) > 1.3 ? HR[1] : ((x + y) % 3 === 0 ? HR[3] : HR[2])); }
    if (L.hs === 'tied' || L.hs === 'tiedf') { for (let y = ht + 12; y <= ht + 24; y++) { const w0 = y < ht + 20 ? 2 : 1; for (let k = 0; k < w0; k++) fg.set(Math.ceil(cx + Rw) + 1 + k, y, k ? HR[1] : HR[2]); } }
    if (L.hs === 'braid') { for (let y = 34; y < N; y++) { const xx = cx - 11 + ((y >> 1) & 1); fg.set(xx, y, HR[(y & 1) ? 3 : 2]); fg.set(xx + 1, y, HR[(y & 1) ? 2 : 1]); fg.set(xx + 2, y, HR[1]); } }
    if (fem && (L.hs === 'longf' || L.hs === 'curlyf')) { for (let y = ht + 14; y <= 44; y++) for (const s of [-1, 1]) { const x0 = Math.round(cx + s * (Rw + 0.5)); for (let k = 0; k < 3; k++) { const x = x0 + s * (k - 1); fg.set(x, y, HR[k === 1 ? 2 : s > 0 ? 1 : (k === 0 ? 3 : 2)]); } } }
  } else {
    for (let y = ht + 9; y <= ht + 14; y++) for (const s of [-1, 1]) for (let k = 0; k < 2; k++) fg.set(Math.round(cx + s * (Rw - 0.5 + k)) - (s < 0 ? 1 : 0), y, HR[k ? 1 : 2]);
    fg.set(cx - 5, ht + 2, SK[4]); fg.set(cx - 4, ht + 2, SK[4]); fg.set(cx - 4, ht + 1, SK[3]);
  }
  // ---- headwear
  const hat = L.hat;
  if (hat === 'crown' || hat === 'tiara' || hat === 'circlet') {
    const yb = hat === 'crown' ? ht - 1 : ht + 3, rows = hat === 'crown' ? 3 : hat === 'tiara' ? 2 : 1, half = Rw + (hat === 'crown' ? 1.2 : 0.6);
    for (let y = yb; y < yb + rows; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - cx; if (Math.abs(dx) > half) continue; fg.set(x, y, dx > half * 0.5 ? GM[2] : y === yb ? GM[4] : GM[3]); }
    if (hat === 'crown') { for (const px0 of [-8, -4, 0, 4, 8]) for (let k = 1; k <= (px0 === 0 ? 4 : 3); k++) { const w0 = k < 2 ? 1 : 0; for (let q = -w0; q <= w0; q++) fg.set(cx + px0 + q - (px0 > 0 ? 1 : 0), yb - k, k === (px0 === 0 ? 4 : 3) ? GM[5] : px0 > 2 ? GM[2] : GM[4]); } fg.set(cx - 1, yb + 1, hx('#d02838')); fg.set(cx, yb + 1, hx('#ff6a6a')); fg.set(cx - 6, yb + 1, hx('#2850c8')); fg.set(cx + 5, yb + 1, hx('#2850c8')); }
    if (hat === 'tiara') { fg.set(cx - 1, yb - 1, GM[4]); fg.set(cx, yb - 1, GM[3]); fg.set(cx - 1, yb - 2, GM[5]); fg.set(cx - 1, yb, hx('#38a0e8')); }
    if (hat === 'circlet') fg.set(cx - 1, yb, hx('#d02838'));
  } else if (hat === 'helm') {
    for (let y = ht - 3; y <= ht + 8; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - (ht + 8); if ((dx * dx) / ((Rw + 1.6) ** 2) + (dy * dy) / 121 > 1) continue; let i = dx < -3 ? 4 : dx < 3 ? 3 : 2; if (dx < -5 && y < ht + 2) i = 5; if (y >= ht + 7) i = 2; fg.set(x, y, ST[i]); }
    for (let y = ht + 8; y <= ey + 3; y++) { fg.set(cx - 1, y, ST[4]); fg.set(cx, y, ST[2]); }
    for (const rx of [-7, -3, 3, 7]) fg.set(cx + rx, ht + 7, ST[5]);
  } else if (hat === 'cap' || hat === 'doge' || hat === 'skull' || hat === 'chef') {
    const capR = hat === 'doge' ? RPK.gold : hat === 'skull' ? RPK.black : hat === 'chef' ? RPK.white : CL;
    const cyy = hat === 'skull' ? ht + 1 : ht, rx = hat === 'skull' ? Rw - 2 : Rw + 2.5, ry = hat === 'chef' ? 6 : hat === 'skull' ? 3 : 4, ox = hat === 'cap' ? -1.5 : 0;
    fg.ell(cx + ox, cyy - (hat === 'chef' ? 3 : 0), rx, ry, 0, (x, y) => { const dx = x + 0.5 - cx - ox; return capR[dx > rx * 0.4 ? 2 : (dx < -rx * 0.3 && y < cyy) ? 4 : 3]; });
    if (hat === 'cap' || hat === 'doge') for (let x = 0; x < N; x++) { const dx = x + 0.5 - cx - ox; if (Math.abs(dx) <= Rw + 1.5) fg.set(x, cyy + 3, capR[1]); }
    if (hat === 'doge') { fg.ell(cx + 3, cyy - 4, 4, 3, 0, (x, y) => RPK.gold[(x + 0.5 - cx - 3) > 1 ? 2 : 4]); }
    if (hat === 'cap' && r.f() < 0.5) { for (let k = 0; k < 7; k++) fg.set(cx + 7 + (k >> 1), cyy - 1 - k, k < 2 ? RPK.white[3] : RPK.white[4]); }
  } else if (hat === 'hood' || hat === 'hoodcl' || hat === 'veil' || hat === 'kerchief') {
    const HC = hat === 'veil' ? RPK.ivory : hat === 'kerchief' ? RPK[r.pick(['wine', 'teal', 'ivory'])] : hat === 'hoodcl' ? CL : RPK.black; const bottom = hat === 'kerchief' ? ht + 9 : 41;
    for (let y = ht - 4; y <= bottom; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - (ht + 11); const rx = Rw + 3.4, ry = 15.5; if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1 && y < 38) continue; if (y >= 38 && Math.abs(dx) > sw(y) - 1) continue;
      const open = inFace(x, y) && y >= ht + (hat === 'veil' || hat === 'kerchief' ? 4 : 3) && Math.abs(dx) < hw(y) - 0.4; if (open) continue; if (y > chin + 1 && Math.abs(dx) < 4.5 && hat !== 'veil') continue;
      let i = dx > rx * 0.3 ? 1 : 2; if (dx < -rx * 0.45 && y < ht + 8) i = 3; const nearFace = inFace(x + (dx < 0 ? 1 : -1), y) && y >= ht + 3; if (nearFace) i = 0; fg.set(x, y, HC[clamp(i + (hat === 'veil' ? 1 : 0), 0, 4)]); }
    if (hat === 'hood' || hat === 'hoodcl') { for (let y = ht + 3; y <= chin; y++) for (let x = 0; x < N; x++) if (inFace(x, y) && Math.abs(x + 0.5 - cx) > hw(y) - 2.4 && y < ey + 2) fg.set(x, y, cmix(fg.get(x, y), SK[0], 0.45)); }
  } else if (hat === 'furhat') {
    for (let y = ht - 4; y <= ht + 4; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - cx; if (Math.abs(dx) > Rw + 2) continue; if (y < ht && (dx * dx) / ((Rw + 1) ** 2) + ((y - ht) ** 2) / 16 > 1) continue; const v = hsh(x, y, 11); fg.set(x, y, y >= ht + 1 ? (v < 0.4 ? hx('#8a6a4a') : v < 0.75 ? hx('#a8845a') : hx('#5a4430')) : CL[dx > 2 ? 2 : 3]); }
  } else if (hat === 'laurel') {
    for (let x = 0; x < N; x++) { const dx = x + 0.5 - cx; if (Math.abs(dx) > Rw + 1 || Math.abs(dx) < 2) continue; const y = ht + 3 + Math.round(Math.abs(dx) * 0.12); fg.set(x, y, (x & 1) ? hx('#4a8a3a') : hx('#7ab84e')); if ((x & 1) === 0) fg.set(x, y - 1, hx('#2e5e2a')); }
  } else if (hat === 'mitre') {
    fg.poly([[cx - 7, ht + 2], [cx + 7, ht + 2], [cx + 4, ht - 9], [cx, ht - 12], [cx - 4, ht - 9]], 0, (x, y) => { const dx = x + 0.5 - cx; return Math.abs(dx) < 1 || y === ht + 1 ? RPK.gold[4] : RPK.white[dx > 2 ? 2 : 4]; });
  } else if (hat === 'straw') {
    fg.ell(cx, ht + 3, Rw + 6, 3, 0, (x, y) => RPK.thatch[(x + 0.5 - cx) > 4 ? 2 : (x + y) % 3 ? 3 : 4]); fg.ell(cx, ht - 1, Rw - 1, 5, 0, (x, y) => RPK.thatch[(x + 0.5 - cx) > 2 ? 2 : 3]); fg.hl(cx - 8, ht + 1, 17, RPK.wine[2]);
  }
  // ---- compose: back hair, figure, outline
  const fig = new PB(N, N); fig.blit(back, 0, 0); fig.blit(fg, 0, 0); fig.outline(OUTL, { skipBottom: true });
  const out = bg.copy(); out.blit(fig, 0, 0);
  if (!c.alive) out.map((x, y, col) => { const l = (cR(col) * 0.3 + cG(col) * 0.59 + cB(col) * 0.11) | 0; return pk(l * 0.9, l * 0.88, l * 0.95); });
  if (c.prison >= 0) for (let x = 3; x < N; x += 8) for (let y = 0; y < N; y++) { out.put(x, y, ST[1]); out.put(x + 1, y, ST[3]); }
  const cnv = out.canvas(); PORT[key] = cnv; return cnv;
}
function mixHex(a, b, t) { const A = rgbOf(a), B = rgbOf(b); const h = v => ('0' + Math.round(v).toString(16)).slice(-2); return '#' + h(A[0] + (B[0] - A[0]) * t) + h(A[1] + (B[1] - A[1]) * t) + h(A[2] + (B[2] - A[2]) * t); }
function drawPortrait(c, x, y, sc) { const p = portrait(c); if (!p) { rect(x, y, 48 * (sc || 1), 48 * (sc || 1), '#22170f'); return; } if (sc && sc !== 1) ctx.drawImage(p, x, y, 48 * sc, 48 * sc); else ctx.drawImage(p, x, y); }
// mentor (old strategist) portrait, generated once
const MENTOR = { id: -7, name: 'Наставник Сун', role: 'mentor', realm: 5, cul: 'E', age: 70, pseed: 4242, traits: ['wise', 'patient'], alive: 1, prison: -1, fem: 0 };
