// трассировка: window.TR(uA, uB, filter(u)→bool, from, to, step, seed)
window.TRC = (ua, ub, flt, t0, t1, st, seed) => { const L = []; R.seed(seed || 777);
  const A = HL.side(ua, {}, 1), Bs = HL.side(ub, {}, 2);
  const B = setupBattle(A, Bs, HL.tile, {}); B.headless = true; B.ai = [true, true]; for (const s of [0, 1]) initOrders(B, s); B.phase = 'fight'; updateVis(B); B.routLog = [];
  const hs = B.units.filter(flt); L.push('tpl ' + B.tpl.join(',') + ' · ' + B.units.map(u => u.side + u.type[0] + u.reg + '@' + Math.round(u.x) + ',' + Math.round(u.y)).join(' '));
  let n = 0; while (!B.over && n++ < (t1 || 60) * 10) { bStep(B, 0.1); if (n % ((st || 1.5) * 10) === 0 && B.t >= (t0 || 0)) { L.push('t' + Math.round(B.t) + ' ' + hs.map(u => { const o = u.order; const t = o && o.k === 'attack' ? B.units[o.t] : null; return u.type[0] + u.reg + ' ' + Math.round(u.men) + ' m' + Math.round(u.morale) + ' ' + u.state[0] + ' ' + u.form[0] + ' ' + (o ? o.k[0] + (t ? '>' + t.type + t.reg : '@' + Math.round(o.x) + ',' + Math.round(o.y)) : '-') + ' @' + Math.round(u.x) + ',' + Math.round(u.y) + (u.contact.length ? ' C:' + u.contact.map(e => e.type).join(',') : '') + (B.t - u.lastArr < 1.5 ? ' A' : ''); }).join(' | ') + ' [' + REGK.map(k => B.regs[0][k].cur).join(',') + ']'); } }
  L.push('win ' + (B.over && B.over.win) + ' stat ' + JSON.stringify(B.stat, (k, v) => typeof v === 'number' ? Math.round(v) : v)); L.push('rout ' + B.routLog.slice(0, 12).join(' | '));
  return L.join('\n'); };
'TRC ok'
