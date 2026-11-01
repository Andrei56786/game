// economy calibration: run N days (armies move as in the game), print aggregates
(function () {
  const out = [];
  const t0 = performance.now(); let tE = 0, tC = 0, tM = 0;
  const oE = econDaily, oC = aiCaravan;
  econDaily = function () { const t = performance.now(); oE(); tE += performance.now() - t; };
  aiCaravan = function (a) { const t = performance.now(); oC(a); tC += performance.now() - t; };
  G.atCourt = 0; const errs = [], deaths = {}; let spawned = 0;
  const oD = destroyArmy, oS = spawnCaravan; destroyArmy = function (a, why) { if (a.kind === 'caravan' && a.alive) { deaths[why] = (deaths[why] || 0) + 1; if (!deaths.ex) deaths.ex = []; if (deaths.ex.length < 8) deaths.ex.push(['d' + G.day, 'h' + a.hunger, 'th' + a.thirst, 'f' + Math.round(a.food), 'w' + Math.round(a.water * 10) / 10, 'sk' + Math.round(a.sick), 'wd' + Math.round(a.wounded), 'cash' + Math.round(a.cash), a.ai.task, 'p' + (a.path ? a.path.length : 0)].join(' ')); } return oD(a, why); }; spawnCaravan = function (r) { const a = oS(r); if (a) spawned++; return a; };
  const snap = () => {
    const seats = G.setts.filter(S => WD.setts[S.id].type !== 'village'), rows = {};
    for (const k of GOODS) { let pr = 0, cr = 0, co = 0, rel = 0, rel2 = 0, n = 0, hi = 0, lo = 0, stT = 0, im = 0, sh = 0; for (const S of seats) { pr += S.st.prod[k] || 0; cr += S.st.craft[k] || 0; co += S.st.cons[k] || 0; im += S.st.imp[k] || 0; sh += (S.st.short[k] || 0) > 0.2 ? 1 : 0; const r = pxRel(S, k); rel += r; rel2 += r * r; n++; if (r > 2) hi++; if (r < 0.6) lo++; stT += (S.mk[k] || 0) / S.mkT[k]; } const m = rel / n; rows[k] = [Math.round(pr), Math.round(cr), Math.round(co), Math.round(im), +m.toFixed(2), +(Math.sqrt(Math.max(0, rel2 / n - m * m)) / m).toFixed(2), hi, lo, sh, +(stT / n).toFixed(2)].join(' '); }
    const cv = G.armies.filter(a => a.alive && a.kind === 'caravan');
    const R0 = G.realms[0], ec = R0.ec30 || {};
    return { day: G.day, goods: rows, car: [cv.length, Math.round(cv.reduce((s, a) => s + a.cash, 0) / Math.max(1, cv.length)), cv.reduce((s, a) => s + (a.trips || 0), 0), Math.round(cv.reduce((s, a) => s + (a.profit || 0), 0)), cv.filter(a => a.cargo).length, cv.filter(a => a.path).length, (G.robbed || []).length].join(' '),
      inc: Object.entries(ec).map(([k, v]) => k + ':' + v.toFixed(1)).join(' '), gold: G.realms.slice(0, 5).map(x => Math.round(x.gold)).join('/'), incs: G.realms.slice(0, 5).map(x => Math.round(x.inc) + '-' + Math.round(x.exp) + (x.ec30 ? '(d' + x.ec30.duty.toFixed(1) + ')' : '')).join(' '),
      alive: G.realms.slice(0, 5).map(x => x.alive === false ? 0 : 1).join(''), armies: G.armies.filter(a => a.alive).length };
  };
  out.push(snap());
  const N = +(window.ECON_DAYS || 180), STEP = 4;
  for (let i = 0; i < N; i++) {
    try {
      const tm = performance.now();
      for (let s = 0; s < STEP; s++) { for (const a of G.armies) if (a.alive) advanceArmy(a, 1 / STEP); checkEncounters(); aiContacts(); if (typeof couriersAdvance === 'function') couriersAdvance(1 / STEP); }
      tM += performance.now() - tm;
      dailyTick(); UI.modals.length = 0; if (typeof DLG !== 'undefined' && DLG.q) DLG.q.length = 0; if (SCREEN === 'battle') { errs.push(G.day + ': battle screen'); SCREEN = 'court'; }
    } catch (e) { errs.push(G.day + ': ' + String(e.stack || e).slice(0, 300)); if (errs.length > 3) break; }
    if (G.day % 60 === 0) out.push(snap());
  }
  econDaily = oE; aiCaravan = oC; destroyArmy = oD; spawnCaravan = oS;
  return JSON.stringify({ deaths, spawned, ms: Math.round(performance.now() - t0), econ_ms_day: +(tE / N).toFixed(2), car_ms_day: +(tC / N).toFixed(2), move_ms_day: +(tM / N).toFixed(2), errs, out }, null, 0);
})()
