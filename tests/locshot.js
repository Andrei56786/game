// draws a whole court location (ground, objects, NPCs, animals) with markers: doors (red), acts (yellow), spots (cyan)
window.__locShot = function (id, sc, marks) { const L = LOCS[id]; sc = sc || 1; const c = document.createElement('canvas'); c.width = L.w * CT * sc; c.height = L.h * CT * sc; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.scale(sc, sc);
  g.drawImage(L.cv, 0, 0);
  for (const d of L.deco) { if (d.show && !d.show()) continue; g.drawImage(objSprite(d.k, d.o, 0), d.x, d.y); }
  for (const f of CRENDER) f(g, L, 0, 0, L.w * CT, L.h * CT);
  const list = []; for (const o of L.objs) { if (o.show && !o.show()) continue; list.push([o.sy, 0, o]); }
  for (const n of COURT.npcs) if (n.loc === id && !n.away) list.push([sortKey(n), 1, n]);
  for (const a of COURT.ani) if (a.loc === id) list.push([a.y, 3, a]);
  list.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  for (const [, t, e] of list) { if (t === 0) g.drawImage(objSprite(e.k, e.o, e.fr ? e.fr(e) : 0), e.x, e.y); else if (t === 3) drawAni(g, e); else drawWalker(g, e); }
  if (marks) { g.globalAlpha = 0.35; g.fillStyle = '#f00'; for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.solid[y * L.w + x]) { g.fillStyle = '#ff2020'; g.fillRect(x * CT + 6, y * CT + 6, 4, 4); }
    g.globalAlpha = 0.6; for (const d of L.doors) { g.fillStyle = '#ff00ff'; g.fillRect(d.x0 * CT, d.y0 * CT, (d.x1 - d.x0 + 1) * CT, (d.y1 - d.y0 + 1) * CT); }
    g.globalAlpha = 1; g.font = '7px monospace'; for (const a of L.acts) { g.strokeStyle = '#ff0'; g.beginPath(); g.arc(a.x, a.y, a.r, 0, 7); g.stroke(); g.fillStyle = '#ff0'; g.fillText(a.id, a.x - 10, a.y); }
    for (const k in L.spots) { const s = L.spots[k]; g.fillStyle = '#0ff'; g.fillRect(s.x - 1, s.y - 1, 3, 3); g.fillStyle = '#bff'; g.fillText(k, s.x + 2, s.y + 2); } }
  return c.toDataURL(); };
'locshot ready'
