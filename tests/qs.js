(() => { const u = { levy: 150, spear: 200, sword: 60, archer: 80, xbow: 30, horse: 50, harch: 20, knight: 15 }, L = [];
  const T = [['equal', {}, {}], ['gen 9 vs 2', { gm: 9, cm: 6 }, { gm: 2, cm: 6 }], ['capts 9 vs 2', { gm: 5, cm: 9 }, { gm: 5, cm: 2 }], ['xp 45 vs 5', { xp: 45 }, { xp: 5 }], ['mor 80 vs 50', { mor: 80 }, { mor: 50 }], ['no gen vs gen5', { nogen: 1 }, { gm: 5 }]];
  for (const [n, a, b] of T) { const r = HL.series(u, u, 20, a, b, 99); L.push(n + ': ' + r.wa + ' t' + r.t + ' la' + r.la + ' lb' + r.lb); }
  return L.join(' | '); })()
