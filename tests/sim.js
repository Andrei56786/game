// advance the world N days the way the game does (armies move in small steps, then the daily tick)
(function () { const N = +(window.SIM_DAYS || 30), STEP = 4; G.atCourt = G.atCourt || 0; const errs = [];
  for (let i = 0; i < N; i++) { try { for (let s = 0; s < STEP; s++) { for (const a of G.armies) if (a.alive) advanceArmy(a, 1 / STEP); checkEncounters(); aiContacts(); } dailyTick(); UI.modals.length = 0; if (SCREEN === 'battle') SCREEN = 'court'; } catch (e) { errs.push(String(e.stack || e).slice(0, 300)); if (errs.length > 2) break; } }
  return 'day ' + G.day + (errs.length ? ' ERR ' + errs.join(' | ') : ''); })()
