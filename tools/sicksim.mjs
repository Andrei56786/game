// Monte Carlo for sick.js: deaths per person-year by age class, with the court's contagion (no feasts/camps/prayer/techs)
import fs from 'fs';
const src = fs.readFileSync(new URL('../src/sick.js', import.meta.url), 'utf8');
const DIS = eval('(' + src.slice(src.indexOf('const DIS = {') + 12, src.indexOf('};', src.indexOf('const DIS = {')) + 1) + ')');
const ONSET = ['cold', 'fever', 'chest', 'flux', 'pox', 'measles', 'gout', 'stroke'];
const med = +(process.argv[2] || 7), tr = process.argv[3] || 'herbs', YEARS = +(process.argv[4] || 3000), DOC = med > 0;
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; const ch = p => rnd() < p, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const cls = a => a < 14 ? 0 : a < 55 ? 1 : 2, docM = DOC ? Math.min(1.2, Math.max(0.62, 1.3 - 0.04 * med)) : 1.5, durK = DOC ? Math.min(1.1, Math.max(0.88, 1.12 - 0.012 * med)) : 1.15;
const base = a => (a < 5 ? 0.02 : a < 40 ? 0.004 : a < 55 ? 0.012 : a < 65 ? 0.045 : a < 75 ? 0.12 : 0.26) * 0.8; // family ×0.8 (no antidotes)
const trtM = (c, I) => { const k = cls(c.age); return tr === 'bleed' ? (k === 1 ? 0.97 : 1.3) : tr === 'herbs' ? 0.92 : tr === 'rest' ? (I.bed ? 0.85 : 0.95) : 1; };
const mk = (age) => ({ age, ill: null, imm: {}, goutN: 0, fem: ch(0.4) });
const P = [3, 5, 7, 9, 12, 20, 28, 34, 40, 46, 52, 58, 66].map(mk); const slot = P.map(p => p.age);
const D = { all: [0, 0, 0], dis: [0, 0, 0], exp: [0, 0, 0], ep: [0, 0, 0] }, byAge = {}; const exp1 = {}, dth1 = {}, BY = {}, EP = {};
for (let y = 0; y < YEARS; y++) for (let day = 0; day < 84; day++) { const s = Math.floor(day / 21);
  if (day === 0) for (let i = 0; i < P.length; i++) { const c = P[i]; c.age++; const k = cls(c.age); D.exp[k]++; exp1[c.age] = (exp1[c.age] || 0) + 1;
    const f = c.age < 55 ? 0.45 : 0.7; if (ch(base(c.age) * f)) { D.all[k]++; dth1[c.age] = (dth1[c.age] || 0) + 1; P[i] = mk(slot[i]); continue; }
    if (c.age > slot[i] + 12 || c.age > 80) P[i] = mk(slot[i]); }
  // progress
  for (let i = 0; i < P.length; i++) { const c = P[i], I = c.ill; if (!I) continue; const Dd = DIS[I.k], k = cls(c.age);
    if (I.k === 'cold' && day === I.d0 + 2 && ch(Dd.cx[k] * docM)) { c.ill = null; start(c, 'chest', day); continue; }
    if (I.cr && day >= I.cr) { I.cr = 0; let m = Dd.m[k] * docM * trtM(c, I); if (c.age < 5) m *= 1.3; if (c.age >= 70) m *= 1.4; if (ch(m)) { (BY[I.k] = BY[I.k] || [0, 0, 0])[k]++; D.all[k]++; D.dis[k]++; dth1[c.age] = (dth1[c.age] || 0) + 1; P[i] = mk(slot[i]); continue; } }
    if (day >= I.end) { if (Dd.imm) c.imm[I.k] = 1; c.ill = null; } }
  // contagion
  const nw = []; for (const a of P) { const I = a.ill; if (!I || day <= I.d0) continue; const Dd = DIS[I.k]; if (!Dd.ct) continue; for (const b of P) { if (b === a || (b.ill && (b.ill.k !== 'cold' || I.k === 'cold')) || (Dd.kid && b.age >= 14) || (Dd.imm && b.imm[I.k])) continue; if (ch(Dd.ct * (a.age < 16 && b.age < 16 ? 1.6 : 1))) nw.push([b, I.k]); } }
  for (const [b, k] of nw) start(b, k, day);
  for (const c of P) { if (c.ill && c.ill.k !== 'cold') continue; for (const k of ONSET) { if (c.ill && k === 'cold') continue; const Dd = DIS[k]; if ((Dd.kid && c.age >= 14) || (Dd.min && c.age < Dd.min) || (Dd.imm && c.imm[k])) continue; const a = cls(c.age);
      let p = Dd.p * Dd.seas[s]; if (k === 'cold') p *= a === 0 ? 1.5 : a === 2 ? 1.1 : 1; else if (k === 'chest') p *= a === 0 ? 1.3 : a === 2 ? 1.8 : 1; else if (k === 'flux') p *= a === 0 ? 1.3 : 1; else if (k === 'gout') p *= (c.fem ? 0.25 : 1) * (c.goutN ? 3 : 1); else if (k === 'stroke') p *= c.age >= 75 ? 3 : c.age >= 65 ? 2 : 1;
      if (ch(p)) { start(c, k, day); break; } } } }
function start(c, k, day) { const Dd = DIS[k], a = cls(c.age); const dur = Math.max(2, Math.round(ri(Dd.dur[0], Dd.dur[1]) * durK)); c.ill = { k, d0: day, end: day + dur, cr: Dd.m[a] > 0 ? day + (Dd.cr0 ? 1 : Math.max(1, Math.round(dur * (0.35 + rnd() * 0.25)))) : 0, bed: ch(Dd.bed[a]) }; if (k === 'gout') c.goutN++; D.ep[a]++; (EP[k] = EP[k] || [0, 0, 0])[a]++; }
const r = k => (100 * D.all[k] / D.exp[k]).toFixed(2) + '%/год (болезни ' + (100 * D.dis[k] / D.exp[k]).toFixed(2) + '%), эпизодов ' + (D.ep[k] / D.exp[k]).toFixed(2) + '/год';
console.log('лекарь', DOC ? 'искусство ' + med : 'нет', 'лечение', tr); console.log('дети <14:', r(0)); console.log('взрослые 14–54:', r(1)); console.log('старики 55+:', r(2));
let surv = 1; for (let a = 4; a <= 16; a++) surv *= 1 - (dth1[a] || 0) / Math.max(1, exp1[a] || 1); console.log('умирает детей с 3 до 16 лет: ' + (100 * (1 - surv)).toFixed(1) + '%');
let s2 = 1; for (let a = 4; a <= 16; a++) s2 *= 1 - base(a); console.log('(раньше, без болезней: ' + (100 * (1 - s2)).toFixed(1) + '%)');
let s3 = 1; for (let a = 17; a <= 50; a++) s3 *= 1 - (dth1[a] || 0) / Math.max(1, exp1[a] || 1); let s4 = 1; for (let a = 17; a <= 50; a++) s4 *= 1 - base(a); console.log('умирает взрослых с 16 до 50: ' + (100 * (1 - s3)).toFixed(1) + '% (раньше ' + (100 * (1 - s4)).toFixed(1) + '%)');
let s5 = 1; for (let a = 56; a <= 70; a++) s5 *= 1 - (dth1[a] || 0) / Math.max(1, exp1[a] || 1); let s6 = 1; for (let a = 56; a <= 70; a++) s6 *= 1 - base(a); console.log('умирает с 55 до 70: ' + (100 * (1 - s5)).toFixed(1) + '% (раньше ' + (100 * (1 - s6)).toFixed(1) + '%)');
console.log('смерти на 1000 чел.-лет (дети/взрослые/старики):', Object.entries(BY).map(([k, v]) => k + ' ' + v.map((x, i) => (1000 * x / D.exp[i]).toFixed(2)).join('/')).join('; '));
console.log('случаев на 1000 чел.-лет:', Object.entries(EP).map(([k, v]) => k + ' ' + v.map((x, i) => (1000 * x / D.exp[i]).toFixed(0)).join('/')).join('; '));
