// reachability inside every home location: from every arrival point to every door, act and spot
(() => { const out = [], site = curSite();
  for (const id in LOCS) { const L = LOCS[id]; if (siteOf(L) !== site) continue;
    const starts = []; for (const k in LOCS) for (const d of LOCS[k].doors) if (d.to === id) starts.push([Math.floor(d.ax / CT), Math.floor(d.ay / CT), k + '>' + id]);
    if (!starts.length) starts.push([Math.floor(L.spots[Object.keys(L.spots)[0]].x / CT), Math.floor(L.spots[Object.keys(L.spots)[0]].y / CT), 'spot0']);
    for (const [sx, sy, nm] of starts) { if (solidAt(L, sx, sy)) out.push(id + ': arrival ' + nm + ' on solid ' + sx + ',' + sy);
      const [fx, fy] = nearFree(L, sx, sy);
      for (const d of L.doors) { const p = castar(L, fx, fy, d.x0, d.y1, 20000); if (!p) out.push(id + ': from ' + nm + ' no path to door ' + d.to + ' @' + d.x0 + ',' + d.y1 + (solidAt(L, d.x0, d.y1) ? ' (solid)' : '')); }
      for (const a of L.acts) { const [tx, ty] = nearFree(L, Math.floor(a.x / CT), Math.floor(a.y / CT)); const p = castar(L, fx, fy, tx, ty, 20000); if (!p) out.push(id + ': from ' + nm + ' no path to act ' + a.id); }
      for (const k in L.spots) { const s = L.spots[k]; if (s.away || k.startsWith('cell')) continue; const [tx, ty] = nearFree(L, Math.floor(s.x / CT), Math.floor(s.y / CT)); const p = castar(L, fx, fy, tx, ty, 20000); if (!p) out.push(id + ': from ' + nm + ' no path to spot ' + k); }
      break; } }
  return out.length ? out.slice(0, 40) : 'all reachable'; })()
