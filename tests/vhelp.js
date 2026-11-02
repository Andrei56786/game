// helpers for the village / town tests (evaluated inside the game IIFE)
window.__errs = window.__errs || [];
window.__dlg = () => { if (!DLG.open()) return 'closed'; const d = DLG.cur; return (d.name ? d.name + ': ' : '') + JSON.stringify(d.pages).slice(0, 420) + (d.choices ? ' ch: ' + d.choices.map((c, i) => (i + 1) + '.' + c.t + (c.ok && !c.ok() ? '(x)' : '')).join(' | ') : ''); };
window.__pick = i => { const d = DLG.cur; if (!d) return 'no dlg'; d.page = d.pages.length - 1; d.full = 1; DLG.key({ code: 'Digit' + (i + 1) }); return __dlg(); };
window.__end = () => { let k = 0; while (DLG.open() && k++ < 20) { const d = DLG.cur; d.page = d.pages.length - 1; d.full = 1; if (d.choices && d.choices.length) DLG.key({ code: 'Digit' + d.choices.length }); else DLG.key({ code: 'Space' }); } while (DLG.open()) DLG.close(); return 'closed'; };
window.__job = j => COURT.npcs.find(n => n.folk && n.folk.job === j);
window.__talk = j => { const n = typeof j === 'string' ? __job(j) : j; if (!n) return 'no ' + j; folkTalk(n); return n.key + ' ' + n.c.name + ' > ' + __dlg(); };
window.__go = (loc, tx, ty) => { COURT.loc = loc; const L = LOCS[loc]; const [x, y] = nearFree(L, tx, ty); COURT.p.x = x * CT + 8; COURT.p.y = y * CT + 12; COURT.path = null; snapCam(); return loc + ' ' + x + ',' + y; };
window.__goSp = (sp, dx, dy) => { const s = spotOf(sp); if (!s) return 'no spot ' + sp; COURT.loc = s.loc; COURT.p.x = s.x + (dx || 0) * CT; COURT.p.y = s.y + (dy || 0) * CT; COURT.path = null; snapCam(); return 'at ' + sp; };
window.__setH = h => { const f = (h - 5) / 24; G.frac = f; COURT.lastHA = G.day * 24 + hourAbs(); COURT.lastHH = Math.floor(hourAbs() * 2); npcSnap(); return 'h ' + hourAbs().toFixed(2); };
window.__where = () => COURT.npcs.map(n => n.key + ':' + (n.folk ? n.folk.job : '') + '@' + n.loc + (n.away ? '(a)' : '') + (n.sit ? '(s)' : '') + (n.lie ? '(l)' : '')).join(' ');
'vhelp ready';
