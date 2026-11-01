(() => { const g = HL.matrix('gold', 16), L = ['gold ' + JSON.stringify(g.S)];
  for (const [a, b] of [['horse', 'xbow'], ['xbow', 'horse']]) { const r = HL.series(HL.withX(a, 200), HL.withX(b, 200), 30, {}, {}, 4242); L.push(a + '-' + b + ' n30 ' + r.wa); }
  for (const D of [60, 120]) { const r = HL.mixRR(3000, D, 10); L.push('D' + D + ' ' + JSON.stringify(r.S)); }
  return L.join('\n'); })()
