(function () {
  G.atCourt = 0; const out = [], errs = [], N = +(window.ECON_DAYS || 360), STEP = 4;
  const snap = () => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const S of G.setts) if (WD.setts[S.id].type !== 'village') c[S.ctrl]++; return G.day + ': seats ' + c.join('/') + ' gold ' + G.realms.slice(0, 5).map(x => Math.round(x.gold)).join('/') + ' inc ' + G.realms.slice(0, 5).map(x => Math.round(x.inc)).join('/') + ' wars ' + G.realms.slice(0, 5).map((x, i) => G.realms.slice(0, 5).map((y, j) => j > i && hostile(i, j) ? i + '' + j : '').join('')).join('') + ' armies ' + G.armies.filter(a => a.alive && (a.kind === 'lord' || a.kind === 'player')).map(a => a.realm).join(''); };
  out.push(snap());
  for (let i = 0; i < N; i++) {
    try { for (let s = 0; s < STEP; s++) { for (const a of G.armies) if (a.alive) advanceArmy(a, 1 / STEP); checkEncounters(); aiContacts(); if (typeof couriersAdvance === 'function') couriersAdvance(1 / STEP); }
      dailyTick(); UI.modals.length = 0; if (SCREEN === 'battle') { errs.push(G.day + ': battle'); SCREEN = 'court'; } } catch (e) { errs.push(G.day + ': ' + String(e.stack || e).slice(0, 300)); if (errs.length > 3) break; }
    if (G.day % 30 === 0) out.push(snap());
  }
  return out.concat(errs).join('\n');
})()
