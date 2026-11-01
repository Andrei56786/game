// Стенд массовых боёв без отрисовки (для баланса). Загружается в игру через T.ev (evalFile), создаёт window.HL.
// HL.fight(uA, uB, oA, oB) — один бой; HL.series(uA, uB, n, oA, oB) — n боёв со сменой сторон;
// HL.matrix(mode, n) — матрица родов войск: база {levy100, spear150, archer60} + испытуемый род.
// Опции стороны: {gm: навык полководца, cm: навык воевод, xp: опыт, mor: дух, nogen: без полководца, tr: черты полководца}.
(() => {
  const H = window.HL = {};
  H.tile = (() => { // открытое поле: луг/пашня/степь 7×7, вдали от воды
    for (let y = 15; y < MH - 15; y++) for (let x = 15; x < MW - 15; x++) { let ok = true;
      for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3; dx++) { const t = WD.ter[(y + dy) * MW + x + dx]; if (t !== TR.GRASS && t !== TR.FARM && t !== TR.STEPPE) { ok = false; break; } }
      if (ok && WD.fwd[y * MW + x] > 4) return y * MW + x; }
    return Math.floor(MH / 2) * MW + Math.floor(MW / 2); })();
  H.gen = (mar, tr) => ({ id: -77, name: 'Полководец', title: 'Воевода', mar, lrn: 5, dip: 5, intr: 5, stew: 5, traits: tr || [], alive: 1, prison: -1, cul: 'K', pseudo: 1, age: 40, pseed: 7 });
  H.capts = (mar, realm) => [0, 1, 2, 3].map(i => ({ n: 'Капитан ' + 'АБВГ'[i] + realm, t: 'Капитан', mar, tr: [], xp: 0, age: 30, seed: 1000 + i + realm * 10, cul: 'K' }));
  H.side = (u, o, realm) => { o = o || {}; const xp = {}; for (const t of UT) xp[t] = o.xp !== undefined ? o.xp : 15;
    return { u: Object.assign(emptyU(), u), xp, morale: o.mor || 65, fat: o.fat || 0, gen: o.nogen ? null : H.gen(o.gm !== undefined ? o.gm : 6, o.tr), ammo: 30, realm, name: 'сторона ' + realm, ground: 'open', capts: H.capts(o.cm !== undefined ? o.cm : 6, realm) }; };
  H.fight = (ua, ub, oa, ob, bo) => { const B = setupBattle(H.side(ua, oa, 1), H.side(ub, ob, 2), H.tile, Object.assign({ size: undefined }, bo || {})); runHeadless(B);
    return { win: B.over.win, t: Math.round(B.t), lossA: battleLosses(B, 0), lossB: battleLosses(B, 1), time: !!B.over.time, stat: B.stat }; };
  H.series = (ua, ub, n, oa, ob, seed) => { let wa = 0, T = 0, la = 0, lb = 0, to = 0; const ma = menOf(ua), mb = menOf(ub);
    for (let i = 0; i < n; i++) { R.seed((seed || 777) + i * 7919); const sw = i % 2 === 1; const r = sw ? H.fight(ub, ua, ob, oa) : H.fight(ua, ub, oa, ob);
      if (sw ? r.win === 1 : r.win === 0) wa++; T += r.t; la += (sw ? r.lossB : r.lossA) / ma; lb += (sw ? r.lossA : r.lossB) / mb; if (r.time) to++; }
    return { wa: +(wa / n).toFixed(2), t: Math.round(T / n), la: +(la / n).toFixed(2), lb: +(lb / n).toFixed(2), to }; };
  H.BASE = { levy: 100, spear: 150, archer: 60 };
  H.withX = (t, k) => { const u = Object.assign(emptyU(), H.BASE); u[t] += k; return u; };
  // count of type t for a mode: 'men' — 200 men; 'gold' — 1600 gold; 'camp' — 1600 gold for recruitment + 30 days of upkeep and food
  H.countFor = (t, mode) => { if (mode === 'men') return 200; const U = UNIT[t]; if (mode === 'gold') return Math.round(1600 / U.cost);
    const day = U.upk + 0.5 * 1 + (MOUNTED[t] ? 0.25 : 0); return Math.round(1600 / (U.cost + 30 * day)); };
  H.matrix = (mode, n) => { const S = {}; for (const t of UT) S[t] = 0; const pairs = {};
    for (let i = 0; i < UT.length; i++) for (let j = i + 1; j < UT.length; j++) { const a = UT[i], b = UT[j];
      const r = H.series(H.withX(a, H.countFor(a, mode)), H.withX(b, H.countFor(b, mode)), n || 10); S[a] += r.wa; S[b] += 1 - r.wa; pairs[a + '-' + b] = r.wa; }
    for (const t of UT) S[t] = +S[t].toFixed(1); return { S, pairs }; };
  return 'HL ready · tile ' + H.tile;
})();
// армии из долей (по числу людей) на бюджет: цена = найм + D дней (жалованье + еда 0,045 + фураж 0,015 для конных)
(() => { const H = window.HL;
  H.perMan = (t, D) => UNIT[t].cost + D * (UNIT[t].upk + 0.045 + (MOUNTED[t] ? 0.015 : 0));
  H.armyFor = (mix, budget, D) => { let c = 0; for (const t in mix) c += mix[t] * H.perMan(t, D || 0); const n = budget / c, u = {}; for (const t in mix) u[t] = Math.round(mix[t] * n); return u; };
  H.MIX = { levy: { levy: 1 }, levyArch: { levy: 0.75, archer: 0.25 }, spearArch: { spear: 0.75, archer: 0.25 }, bal: { levy: 0.2, spear: 0.3, sword: 0.1, archer: 0.15, xbow: 0.1, horse: 0.1, knight: 0.05 }, elite: { sword: 0.3, xbow: 0.25, horse: 0.25, knight: 0.2 }, cav: { horse: 0.5, harch: 0.3, knight: 0.2 } };
  H.mixRR = (budget, D, n) => { const K = Object.keys(H.MIX), S = {}, P = {}; for (const k of K) S[k] = 0;
    for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) { const r = H.series(H.armyFor(H.MIX[K[i]], budget, D), H.armyFor(H.MIX[K[j]], budget, D), n || 10); S[K[i]] += r.wa; S[K[j]] += 1 - r.wa; P[K[i] + '-' + K[j]] = r.wa; }
    for (const k of K) S[k] = +S[k].toFixed(1); return { S, P }; };
})();
