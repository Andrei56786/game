(() => { const P = [['levy','bal'],['levy','elite'],['levy','spearArch'],['levyArch','bal'],['spearArch','bal'],['spearArch','elite'],['bal','elite'],['cav','bal'],['cav','levy'],['elite','cav']]; const L = [];
  for (const D of [60]) { L.push('D' + D + ' ' + Object.keys(HL.MIX).map(k => k + ':' + menOf(HL.armyFor(HL.MIX[k], 3000, D))).join(' '));
    for (const [a, b] of P) { const r = HL.series(HL.armyFor(HL.MIX[a], 3000, D), HL.armyFor(HL.MIX[b], 3000, D), 10); L.push('  ' + a + '-' + b + ' ' + r.wa + ' t' + r.t + ' la' + r.la + ' lb' + r.lb); } }
  return L.join('\n'); })()
