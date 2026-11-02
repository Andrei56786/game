// helpers for the castle tests (evaluated inside the game IIFE); needs tests/vhelp.js
window.__kjob = (j, i) => COURT.npcs.filter(n => n.kv && n.kv.job === j)[i || 0];
window.__ktalk = (j, i) => { const n = typeof j === 'string' ? __kjob(j, i) : j; if (!n) return 'no ' + j; n.talk(n); return n.key + ' ' + n.c.name + ' > ' + __dlg(); };
window.__kpick = re => { const d = DLG.cur; if (!d || !d.choices) return 'no choices: ' + __dlg(); const i = d.choices.findIndex(c => c.t.startsWith(re)); if (i < 0) return 'no choice ' + re + ': ' + __dlg(); return __pick(i); };
window.__next = () => { const d = DLG.cur; if (!d) return 'closed'; d.page = d.pages.length - 1; d.full = 1; DLG.key({ code: 'Space' }); return __dlg(); };
window.__kwhere = () => COURT.npcs.map(n => n.key + ':' + (n.kv ? n.kv.job : n.ret ? 'ret' : '') + '@' + n.loc + (n.away ? '(a)' : '') + (n.sit ? '(s)' : '') + (n.lie ? '(l)' : '') + (n.curT ? '>' + n.curT : '')).join(' ');
window.__khost = () => { const h = KV.host; return h ? h.t + ' ' + (h.c ? h.c.name : '-') + (h.away ? ' away ' + h.away.name : '') + (h.H ? ' house ' + h.H.name + ' loy ' + Math.round(h.H.loy) : '') + (h.own ? ' own' : '') + (h.occ ? ' occ' : '') : 'no host'; };
window.__kfree = c => c && c.alive && !(c.prison >= 0) && !c.atCourt && !c.away && !G.armies.some(a => a.alive && a.gen === c.id);
window.__kgo = sid => { if (G.visit) visitLeave(1); const s = WD.setts[sid], pa = playerArmy(); pa.x = s.x + 0.5; pa.y = s.y + 0.5; pa.path = null; window.__sid = sid; visitEnter('castle', sid, 'royal'); return 'sid ' + sid + ' ' + s.name + ' (' + s.type + ', ctrl ' + G.setts[sid].ctrl + ') loc ' + COURT.loc + ' | ' + visitTitle() + ' | host ' + __khost() + ' | npcs ' + COURT.npcs.length + ' | key ' + KMAP.key + ' kw ' + KMAP.kw + ' ne ' + KMAP.ne + ' nw ' + KMAP.nw; };
'khelp ready';
