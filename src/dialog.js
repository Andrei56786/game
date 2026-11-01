'use strict';
// ===== DIALOG: Stardew-like talk box — portrait, name plate, typewriter text, choices (keyboard & mouse) =====
const DLG = {
  cur: null, q: [],
  open() { return !!this.cur; },
  // who: char | npc | null (narrator). text: string | string[] (pages). o: { choices:[{t,fx,tip,ok,why}], name, sub, onEnd, esc }
  say(who, text, o) { const d = mkDlg(who, text, o); if (this.cur) this.q.push(d); else { this.cur = d; Snd.sfx('paper'); } return d; },
  now(who, text, o) { this.q = []; this.cur = mkDlg(who, text, o); return this.cur; },
  seq(list) { for (const e of list) this.say(e.who, e.text, e); },
  close() { const d = this.cur; this.cur = this.q.shift() || null; if (d && d.onEnd) d.onEnd(); },
  key(k) { const d = this.cur; if (!d) return; const c = k.code;
    if (c === 'KeyE' || c === 'Space' || c === 'Enter' || c === 'NumpadEnter') { advance(d); return; }
    if (d.page === d.pages.length - 1 && d.full && d.choices) {
      if (c === 'ArrowUp' || c === 'KeyW') { d.sel = (d.sel + d.choices.length - 1) % d.choices.length; Snd.sfx('click'); }
      else if (c === 'ArrowDown' || c === 'KeyS') { d.sel = (d.sel + 1) % d.choices.length; Snd.sfx('click'); }
      else if (/^Digit[1-9]$/.test(c)) { const i = +c.slice(5) - 1; if (i < d.choices.length) choose(d, i); }
      else if (c === 'Escape' && d.esc !== undefined) choose(d, d.esc);
      return; }
    if (c === 'Escape') { if (!d.choices) { this.q = []; this.close(); } else { d.page = d.pages.length - 1; d.shown = 1e9; d.full = 1; } }
  },
};
function mkDlg(who, text, o) { o = o || {}; let c = who && who.c ? who.c : who; const pages = []; const textW = c ? W - 32 - 124 : W - 32 - 24;
  for (const t of [].concat(text)) { const lines = wrap(t, textW); for (let i = 0; i < lines.length; i += 6) pages.push(lines.slice(i, i + 6)); }
  const choices = o.choices && o.choices.length ? o.choices : null;
  if (choices && pages.length) { const last = pages[pages.length - 1]; const room = 8 - choices.length; if (last.length > room && room > 0) { pages.push(last.splice(room)); } }
  return { c, npc: who && who.c ? who : null, name: o.name || (c ? (c.title && !c.pseudo ? c.title + ' ' : '') + c.name : ''), sub: o.sub || (who && who.c ? npcSub(who) : ''), pages: pages.length ? pages : [['']], page: 0, shown: 0, full: 0, t0: NOW, choices, sel: 0, onEnd: o.onEnd, esc: o.esc, tone: o.tone }; }
function advance(d) { const cnt = d.pages[d.page].join(' ').length; if (!d.full) { d.shown = cnt; d.full = 1; return; }
  if (d.page < d.pages.length - 1) { d.page++; d.shown = 0; d.full = 0; Snd.sfx('click'); return; }
  if (d.choices) { const ch = d.choices[d.sel]; if (ch) choose(d, d.sel); return; }
  DLG.close(); Snd.sfx('click'); }
function choose(d, i) { const ch = d.choices[i]; if (!ch) return; if (ch.ok && !ch.ok()) { UI.toast(ch.why || 'Недоступно.'); Snd.sfx('click'); return; } DLG.cur = null; const nx = DLG.q.shift() || null; Snd.sfx('click'); try { if (ch.fx) ch.fx(); } catch (e) { onErr(e); } if (!DLG.cur && nx) DLG.cur = nx; else if (nx) DLG.q.unshift(nx); if (d.onEnd && !ch.keep) d.onEnd(); }
function drawDialog() {
  const d = DLG.cur; if (!d) return; blocker();
  const bx = 16, bh = 122, by = H - bh - 6, bw = W - 32, hasP = !!d.c;
  const cnt = d.pages[d.page].join(' ').length; if (!d.full) { d.shown += DT * 75; if (d.shown >= cnt) { d.shown = cnt; d.full = 1; } }
  // frame
  rect(bx - 1, by - 1, bw + 2, bh + 2, PAL.o); panelParch(bx, by, bw, bh); rect(bx + 3, by + 3, bw - 6, 1, '#f8ecc8');
  hit(bx, by, bw, bh, { id: 'dlg', onClick: () => { if (!(d.full && d.page === d.pages.length - 1 && d.choices)) advance(d); } });
  // portrait + name plate
  let tx = bx + 12; const tw0 = hasP ? bw - 124 - 12 : bw - 24;
  if (hasP) { const px0 = bx + bw - 108, py0 = by + 4; rect(px0 - 2, py0 - 2, 100, 100, PAL.o); rect(px0 - 1, py0 - 1, 98, 98, '#6a4428'); rect(px0, py0, 96, 96, '#3a2a22'); drawPortrait(d.c, px0, py0, 2);
    rect(px0 - 2, by + bh - 20, 100, 16, PAL.o); rect(px0 - 1, by + bh - 19, 98, 14, '#6a4428'); rect(px0, by + bh - 18, 96, 12, '#8a5a32'); let nm = d.name, nf = 'm'; if (tw(nm) > 94) nm = d.c.name || nm; if (tw(nm) > 94) nf = 's'; while (nm.length > 4 && tw(nm, { f: nf }) > 94) nm = nm.slice(0, -2) + '…'; txt(nm, px0 + 48, by + bh - (nf === 's' ? 15 : 16), '#fff2c8', { al: 'c', sh: PAL.o, f: nf });
    if (d.sub) { const s = d.sub.length > 34 ? d.sub.slice(0, 33) + '…' : d.sub; txt(s, bx + bw - 112, by + bh - 9, '#7a5a3a', { al: 'r', f: 's' }); } }
  else if (d.name) txt(d.name, bx + 12, by + 6, '#7a4a2a');
  // text
  let n = Math.floor(d.shown), y = by + (hasP || !d.name ? 10 : 18);
  for (const l of d.pages[d.page]) { const s = n >= l.length ? l : l.slice(0, Math.max(0, n)); n -= l.length + 1; txt(s, tx, y, '#3a2614'); y += 11; if (n < 0) break; }
  // choices or continue marker
  const last = d.page === d.pages.length - 1;
  if (last && d.full && d.choices) { y += 3; d.choices.forEach((ch, i) => { const ok = !ch.ok || ch.ok(), hv = HOVER && HOVER.id === 'dch' + i; if (hv && d.sel !== i) d.sel = i; const sel = d.sel === i;
      if (sel) { rect(tx - 4, y - 2, tw0 + 4, 11, ok ? 'rgba(160,110,40,0.28)' : 'rgba(120,80,60,0.18)'); txt('▶', tx - 2, y, '#8a3a1a'); }
      txt((i + 1) + '. ' + ch.t, tx + 7, y, ok ? (sel ? '#5a1a0a' : '#3a2614') : '#9a8a70'); if (!ok && ch.why) txt(ch.why, tx + 7 + tw((i + 1) + '. ' + ch.t) + 6, y + 1, '#9a6a50', { f: 's' });
      hit(tx - 4, y - 2, tw0 + 4, 11, { id: 'dch' + i, cursor: true, tip: ch.tip, onClick: () => choose(d, i) }); y += 11; }); }
  else if (d.full) { const b = Math.sin(NOW * 6) > 0 ? 1 : 0; txt(last ? '■' : '▼', bx + (hasP ? bw - 122 : bw - 14), by + bh - 14 + b, '#8a5a32'); }
}
