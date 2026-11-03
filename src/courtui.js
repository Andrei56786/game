'use strict';
// ===== COURT 2 (from court.js): render, HUD, keys & update, simple acts & small talk =====
// ---------- render ----------
const CR = {}; const WIN_NIGHT = { night: 1, ck: 'night' };
function sortKey(n) { if (n.lie) return n.y + 40; if (n.sit) return n.y + (n.sit.dir === 'up' ? -2 : 12); return n.y; }
function drawWalker(g, n) {
  const moving = n.path || n.moving, f = moving ? Math.floor(n.f / 7) % 4 : 0, s = walkerSprite(n.c, n.lie ? 'down' : n.dir, n.sit || n.lie ? 0 : f);
  const x = Math.round(n.x - 8), y = Math.round(n.y - 31);
  if (n.lie) { g.drawImage(s, 0, 0, 16, 13, x, Math.round(n.y) - 20, 16, 13); return; }
  if (!n.sit) g.drawImage(shadowSpr(12), x + 2, Math.round(n.y) - 2);
  if (n.sit) { if (n.sit.dir === 'up') g.drawImage(s, x, y + 3); else g.drawImage(s, 0, 0, 16, 26, x, y + 4, 16, 26); }
  else g.drawImage(s, x, y);
  if (n === COURT.p && COURT.sneak && n.moving) { g.globalAlpha = 0.25; g.fillStyle = '#101020'; g.fillRect(x + 2, y + 2, 12, 28); g.globalAlpha = 1; }
}
function courtRender() {
  const L = curLoc(), Z = COURT.Z, vw = Math.ceil(W / Z) + 1, vh = Math.ceil(H / Z) + 1;
  if (!CR.sc || CR.w !== vw || CR.h !== vh) { [CR.sc, CR.sg] = mkCanvas(vw, vh); const c = document.createElement('canvas'); c.width = vw; c.height = vh; CR.lc = c; CR.lg = c.getContext('2d'); CR.w = vw; CR.h = vh; }
  const g = CR.sg, cx = Math.floor(COURT.cam.x), cy = Math.floor(COURT.cam.y), night = isNight(), h = hourAbs();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = L.out ? '#1a2418' : '#0c0a10'; g.fillRect(0, 0, vw, vh);
  g.drawImage(L.cv, cx, cy, vw, vh, 0, 0, vw, vh);
  g.save(); g.translate(-cx, -cy);
  const vis = (x, y, w, hh) => x < cx + vw && x + w > cx && y < cy + vh && y + hh > cy;
  for (const d of L.deco) { if (d.show && !d.show()) continue; if (!vis(d.x, d.y, d.w || 32, d.h || 48)) continue; const f = d.anim ? Math.floor(NOW * d.fps + d.x * 0.13) % d.anim : 0; g.drawImage(objSprite(d.k, d.k === 'window' && night ? WIN_NIGHT : d.o, f), d.x, d.y); }
  if (L.hbSlots && G.houses) { let i = 0; for (const H0 of G.houses) { if (!H0.alive || i >= L.hbSlots.length) continue; const [tx, ty] = L.hbSlots[i++]; const f = Math.floor(NOW * 3 + tx) % 4; const s = objSprite('housebanner', { house: H0.her, ck: 'hb' + H0.id }, 0); g.drawImage(s, tx * CT + 8 - (s.width >> 1), (ty + 1) * CT - s.height - 2 + (f === 2 ? 1 : 0)); } }
  for (const f of CRENDER) f(g, L, cx, cy, vw, vh);
  drawParts(g, 0);
  const list = [];
  for (const o of L.objs) { if (o.show && !o.show()) continue; if (!vis(o.x, o.y, o.w, o.h)) continue; list.push([o.sy, 0, o]); }
  for (const n of COURT.npcs) if (n.loc === L.id && !n.away && vis(n.x - 10, n.y - 34, 20, 40)) list.push([sortKey(n), 1, n]);
  if (COURT.p && !COURT.p.hide) list.push([sortKey(COURT.p), 2, COURT.p]);
  for (const a of COURT.ani) if (a.loc === L.id && vis(a.x - 18, a.y - 60, 36, 64)) list.push([a.y, 3, a]);
  for (const f of SPR_EXT) f(L, list);
  list.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  for (const [, t, e] of list) { if (t === 0) { const f = e.fr ? e.fr(e) : e.anim ? Math.floor(NOW * e.fps + e.x * 0.11) % e.anim : 0; g.drawImage(objSprite(e.k, e.o, f), e.x, e.y); } else if (t === 3) drawAni(g, e); else if (t === 4) e(g); else drawWalker(g, e); }
  for (const f of CRENDER2) f(g, L, cx, cy, vw, vh);
  if (COURT.dest && NOW - COURT.dest[2] < 0.6 && COURT.path) { const a = 1 - (NOW - COURT.dest[2]) / 0.6; g.globalAlpha = a; g.strokeStyle = '#f7d35c'; g.lineWidth = 1; g.strokeRect(COURT.dest[0] * CT + 3.5, COURT.dest[1] * CT + 7.5, 9, 5); g.globalAlpha = 1; }
  g.restore();
  // ---- lighting ----
  const lg = CR.lg, amb0 = L.out ? ambientOut(h) : ambientIn(h), amb = L.dark ? amb0.map(v => v * L.dark) : amb0, wd = L.out ? weatherDim() : 1 - (1 - weatherDim()) * 0.5;
  let fl = COURT.flash && NOW - COURT.flash < 0.25 ? 1.8 : 1;
  lg.globalCompositeOperation = 'source-over'; lg.fillStyle = 'rgb(' + amb.map(v => Math.min(255, Math.round(v * wd * fl))).join(',') + ')'; lg.fillRect(0, 0, vw, vh);
  const dark = clamp(1 - Math.min(amb[0], amb[1], amb[2]) * wd / 255, 0, 1);
  lg.globalCompositeOperation = 'lighter';
  const dk = dayK();
  if (!L.out && L.beams) { const sdx = (12.5 - h) * 3; for (const [bx, by] of L.beams) { const col = dk > 0.05 ? 'rgba(255,236,190,' + (0.32 * dk * wd) + ')' : night ? 'rgba(120,140,220,0.18)' : null; if (!col) continue; lg.fillStyle = col; lg.beginPath(); lg.moveTo(bx - 7 - cx, by - cy); lg.lineTo(bx + 7 - cx, by - cy); lg.lineTo(bx + 9 + sdx - cx, by + 62 - cy); lg.lineTo(bx - 9 + sdx - cx, by + 62 - cy); lg.closePath(); lg.fill(); } }
  for (const l of L.lights) { if (l.night && dark < 0.3) continue; const x = l.x + (l.dx || 0) - cx, y = l.y + (l.dy || 0) - cy, fk = l.fl ? 1 - l.fl * 0.5 + l.fl * 0.5 * Math.sin(NOW * 11 + l.x * 0.37) * Math.sin(NOW * 4.3 + l.y) : 1, r = l.r * fk; if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
    lg.globalAlpha = clamp(l.a * (L.out ? clamp(dark * 1.5, 0, 1) : 0.45 + dark * 0.8) * fk, 0, 1); lg.drawImage(lightSpr(l.col), x - r, y - r, r * 2, r * 2); }
  if (dark > 0.35) for (const w0 of L.wins) { const x = w0.x - cx, y = w0.y - cy, r = w0.big ? 16 : 11; if (x < -r || y < -r || x > vw + r || y > vh + r) continue; lg.globalAlpha = clamp((dark - 0.35) * 2, 0, 0.9) * (0.85 + 0.15 * Math.sin(NOW * 2 + w0.x)); lg.drawImage(lightSpr('#ffb050'), x - r, y - r, r * 2, r * 2); }
  if (!L.out && COURT.p) { lg.globalAlpha = 0.15 + dark * 0.2; lg.drawImage(lightSpr('#fff0d8'), COURT.p.x - cx - 30, COURT.p.y - 16 - cy - 30, 60, 60); }
  lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
  g.globalCompositeOperation = 'multiply'; g.drawImage(CR.lc, 0, 0); g.globalCompositeOperation = 'lighter';
  // glow pass (flames, lit windows) + additive particles
  g.save(); g.translate(-cx, -cy);
  for (const l of L.lights) { if (!l.fl || (l.night && dark < 0.3)) continue; const x = l.x + (l.dx || 0), y = l.y + (l.dy || 0); if (!vis(x - 12, y - 12, 24, 24)) continue; g.globalAlpha = (0.16 + dark * 0.22) * (0.85 + 0.15 * Math.sin(NOW * 13 + l.x)); g.drawImage(lightSpr(l.col), x - 9, y - 9, 18, 18); }
  if (dark > 0.35) for (const w0 of L.wins) { if (!vis(w0.x - 6, w0.y - 6, 12, 12)) continue; g.globalAlpha = clamp((dark - 0.35) * 1.5, 0, 0.55); g.drawImage(lightSpr('#ffc060'), w0.x - 5, w0.y - 5, 10, 10); }
  if (!L.out && L.beams && dk > 0.05) { const sdx = (12.5 - h) * 3; g.globalAlpha = 0.07 * dk * wd; g.fillStyle = '#fff0c8'; for (const [bx, by] of L.beams) { g.beginPath(); g.moveTo(bx - 7, by); g.lineTo(bx + 7, by); g.lineTo(bx + 9 + sdx, by + 62); g.lineTo(bx - 9 + sdx, by + 62); g.closePath(); g.fill(); } }
  g.globalAlpha = 1; drawParts(g, 1); g.restore();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // ---- to screen ----
  const ox = -Math.round((COURT.cam.x - cx) * Z), oy = -Math.round((COURT.cam.y - cy) * Z);
  ctx.drawImage(CR.sc, 0, 0, vw, vh, ox, oy, vw * Z, vh * Z);
  if (L.out) drawCourtWeather(dark);
  if (L.out && dark > 0.2) { if (!CR.vig) { const c = document.createElement('canvas'); c.width = W; c.height = H; const vg = c.getContext('2d'); const gr = vg.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); gr.addColorStop(0, 'rgba(8,6,20,0)'); gr.addColorStop(1, 'rgba(8,6,20,1)'); vg.fillStyle = gr; vg.fillRect(0, 0, W, H); CR.vig = c; } ctx.globalAlpha = (dark - 0.2) * 0.6; ctx.drawImage(CR.vig, 0, 0); ctx.globalAlpha = 1; }
  drawCourtOverlays(cx, cy);
}
// screen-space rain / snow / fog
const WFX = { drops: [], t: 0, fog: null };
function drawCourtWeather(dark) {
  const k = G.weather ? G.weather.k : 'clear', Z = COURT.Z;
  const rain = k === 'rain' || k === 'storm', snow = k === 'snow' || k === 'blizzard', n = rain ? (k === 'storm' ? 150 : 80) : snow ? (k === 'blizzard' ? 160 : 70) : 0;
  const D = WFX.drops; while (D.length < n) D.push({ x: R.f() * W, y: R.f() * H, s: R.range(0.7, 1.3), ph: R.f() * 6 }); if (D.length > n) D.length = n;
  const dt = UI.paused() ? 0 : Math.min(DT, 0.05), wx = windX();
  if (rain) { ctx.fillStyle = dark > 0.4 ? 'rgba(150,170,220,0.45)' : 'rgba(200,215,240,0.55)'; for (const d of D) { d.y += 330 * d.s * dt; d.x += wx * 40 * dt; if (d.y > H) { d.y -= H + 10; d.x = R.f() * W; } if (d.x > W) d.x -= W; ctx.fillRect(d.x | 0, d.y | 0, 1, 5 * Z / 2 + 2); ctx.fillRect((d.x + 1) | 0, (d.y + 3) | 0, 1, 2); } if (k === 'storm' && R.chance(dt * 0.08)) COURT.flash = NOW; }
  if (snow) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const d of D) { d.ph += dt; d.y += 28 * d.s * dt * (k === 'blizzard' ? 2.2 : 1); d.x += (Math.sin(d.ph) * 10 + wx * (k === 'blizzard' ? 60 : 10)) * dt; if (d.y > H) { d.y -= H + 4; d.x = R.f() * W; } if (d.x > W) d.x -= W; if (d.x < 0) d.x += W; const s = d.s > 1.1 ? 2 : 1; ctx.fillRect(d.x | 0, d.y | 0, s, s); } }
  if (k === 'fog') { if (!WFX.fog) { const [c, g] = mkCanvas(160, 90); const img = g.createImageData(160, 90); for (let i = 0; i < 160 * 90; i++) { const x = i % 160, y = (i / 160) | 0, v = fbm(x * 0.05, y * 0.08, 3, 77); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 220; img.data[i * 4 + 3] = clamp(v * 255 - 60, 0, 200); } g.putImageData(img, 0, 0); WFX.fog = c; } const ox = (NOW * 6) % W; ctx.globalAlpha = 0.5; ctx.imageSmoothingEnabled = true; ctx.drawImage(WFX.fog, -ox, 0, W, H); ctx.drawImage(WFX.fog, W - ox, 0, W, H); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; }
  if (COURT.flash && NOW - COURT.flash < 0.18) { ctx.fillStyle = 'rgba(235,240,255,' + (0.5 * (1 - (NOW - COURT.flash) / 0.18)) + ')'; ctx.fillRect(0, 0, W, H); }
  if (seasonOf(G.day) === 3 && !rain) { ctx.fillStyle = 'rgba(200,220,255,0.06)'; ctx.fillRect(0, 0, W, H); }
}
// bubbles, names, hover, eavesdrop meter (screen space)
function cw2s(x, y) { return [Math.round((x - COURT.cam.x) * COURT.Z), Math.round((y - COURT.cam.y) * COURT.Z)]; }
function drawBubble(s, sx, sy, col, occ) { const lines = wrap(s, 150, { f: 's' }); const w = Math.max(...lines.map(l => tw(l, { f: 's' }))) + 8, h = lines.length * 8 + 5; const x = clamp(sx - w / 2, 2, W - w - 2), y = sy - h - 6;
  if (occ) { if (occ.some(r => x < r[0] + r[2] + 2 && r[0] < x + w + 2 && y < r[1] + r[3] + 2 && r[1] < y + h + 2)) return; occ.push([x, y, w, h]); } // crowded rooms: a bubble that would cover another waits its turn
  rect(x, y, w, h, PAL.o); rect(x + 1, y + 1, w - 2, h - 2, col || '#f4ecd8'); rect(sx - 2, y + h - 1, 5, 2, col || '#f4ecd8'); px(sx - 3, y + h, PAL.o); px(sx + 3, y + h, PAL.o); rect(sx - 1, y + h + 1, 3, 2, col || '#f4ecd8'); px(sx, y + h + 3, PAL.o);
  lines.forEach((l, i) => txt(l, x + 4, y + 3 + i * 8, '#2a1a12', { f: 's' })); }
function drawCourtOverlays(cx, cy) {
  const L = curLoc(), Z = COURT.Z;
  const occ = []; if (COURT.p && COURT.p.bub && COURT.p.bubT > NOW) { const [sx, sy] = cw2s(COURT.p.x, COURT.p.y - 34); drawBubble(COURT.p.bub, sx, sy, '#fff2c8', occ); }
  for (const n of COURT.npcs.filter(n => n.loc === L.id && !n.away && n.bub).sort((a, b) => (b.bubT || 0) - (a.bubT || 0))) { const [sx, sy] = cw2s(n.x, n.y - (n.sit ? 30 : 34)); if (sx < -40 || sx > W + 40 || sy < 0 || sy > H + 40) continue; drawBubble(n.bub, sx, sy, n.bubCol, occ); }
  // hover name
  if (!courtBlocked() && HOVER && HOVER.id === 'court') { const wx = COURT.cam.x + input.mx / Z, wy = COURT.cam.y + input.my / Z, t = pickTarget(wx, wy);
    if (t) { let s, s2 = ''; if (t.n) { s = npcTitle(t.n); s2 = npcSub(t.n); } else if (t.e) { s = t.label; s2 = t.sub || ''; } else s = t.a.label; const [sx, sy] = t.n ? cw2s(t.n.x, t.n.y - 32) : t.e ? cw2s(t.x, t.y - 16) : cw2s(t.a.x, t.a.y - 14); const w = Math.max(tw(s), tw(s2, { f: 's' })) + 10, hh = s2 ? 20 : 12;
      rect(sx - w / 2, sy - hh - 2, w, hh, 'rgba(20,14,12,0.88)'); strokeR(sx - w / 2, sy - hh - 2, w, hh, '#8a6a3a'); txt(s, sx, sy - hh + 1, PAL.y, { al: 'c' }); if (s2) txt(s2, sx, sy - hh + 11, '#c8b898', { al: 'c', f: 's' }); cv.style.cursor = 'pointer'; } }
  if (COURT.ear && COURT.ear.prog > 0 && !COURT.ear.done) { const e = COURT.ear; const [sx, sy] = cw2s((e.a.x + e.b.x) / 2, Math.max(e.a.y, e.b.y) + 5); rect(sx - 26, sy, 52, 7, PAL.o); rect(sx - 25, sy + 1, Math.round(50 * e.prog), 5, '#a8c8ff'); txt('подслушиваете', sx, sy + 9, '#a8c8ff', { al: 'c', f: 's', sh: PAL.o }); }
}
function npcTitle(n) { if (n.seat) return seatName(n.seat) + ': ' + n.c.name; if (n.c.pseudo) return n.c.name; return (n.c.title ? n.c.title + ' ' : '') + n.c.name; }
function npcSub(n) { if (n.sub) return typeof n.sub === 'function' ? n.sub(n) : n.sub; if (n.petition) return 'Проситель'; if (n.envoy) return 'Посол: ' + REALM_DEF[n.envoy.from].name; if (n.msgr) return 'Несёт письмо'; if (n.fam) return famRole(n.c); if (n.key.startsWith('ward')) return 'Воспитанник двора · дом ' + houseName(n.c.house); if (n.seat) { const c = n.c; return c.house >= 0 && G.houses[c.house] ? 'дом ' + G.houses[c.house].name : ''; } if (n.staff === 'guard') return 'Королевская стража'; return ''; }
// ---------- HUD ----------
function drawCourtTop() {
  const r = G.realms[0];
  rect(0, 0, W, 19, PAL.o); rect(0, 0, W, 18, '#2a1d16'); hline(0, 0, W, '#4a3020'); hline(0, 17, W, '#6a4428');
  let x = 4; spr('shield0', x, 3); hit(x, 2, 12, 14, { id: 'tb_realm', cursor: true, tip: 'Держава (R)', onClick: () => UI.open({ k: 'realm' }) }); x += 16;
  const bg = bookGold(), net = (r.inc || 0) - (r.exp || 0);
  sprBar('i_gold', x, 7); txt(fmt(bg), x + 8, 6, bg < 0 ? UIC.bad : PAL.y); let x2 = x + 10 + tw(fmt(bg)); txt((net >= 0 ? '+' : '−') + Math.abs(net).toFixed(1), x2, 6, net >= 0 ? UIC.good : UIC.bad, { f: 's' });
  hit(x, 2, x2 + 26 - x, 14, { id: 'tb_gold', tip: () => goldTip3() }); x = x2 + 30;
  const men = G.armies.filter(a => a.alive && a.realm === 0 && a.kind === 'lord').reduce((s, a) => s + armyMen(a), 0);
  sprBar('i_men', x, 7); txt(fmt(men), x + 8, 6, PAL.w); hit(x, 2, 36, 14, { id: 'tb_men', tip: ['Войска державы в поле: ' + voin(men), 'Ими командуют ваши рыцари — приказы идут гонцами.', { t: 'V — войска и командиры', c: UIC.dim }], onClick: () => UI.open({ k: 'cmd' }) }); x += 42;
  const gr = Math.round(G.court.grain || 0); sprBar('i_food', x, 7); txt(fmt(gr), x + 8, 6, gr < granRes() || granFamine() ? UIC.warn : PAL.w); hit(x, 2, 44, 14, { id: 'tb_grain', tip: granTip(), onClick: () => UI.open({ k: 'supply' }) }); x += 48;
  // date, clock, weather
  const Wt = weatherOf(), ds = dateStr(G.day), clk = clockStr(), night = isNight();
  const endX = W - 266; let wn = Wt.n; let totW = tw(ds) + 6 + 8 + tw(clk) + 12 + 9 + tw(wn, { f: 's' }); if (x + 6 + totW > endX) { wn = ''; totW -= tw(Wt.n, { f: 's' }); }
  const cx0 = Math.max(x + 6, endX - totW); txt(ds, cx0, 6, '#fff2c8'); let x3 = cx0 + tw(ds) + 6; sprBar(night ? 'i_moon' : 'i_sun', x3, 7); txt(clk, x3 + 8, 6, night ? '#a8c8ff' : '#ffe8a0'); x3 += 12 + tw(clk); sprBar('i_' + Wt.ic, x3, 7); if (wn) txt(wn, x3 + 9, 6, '#c8d8e8', { f: 's' });
  hit(cx0, 2, x3 + 30 - cx0, 14, { id: 'tb_date', tip: () => [ds + ', ' + clk, 'Погода: ' + Wt.n, 'При дворе день длится ' + Math.round(COURT_SPD[Math.max(1, G.speed)] / 60 * 10) / 10 + ' мин. Ночью можно лечь спать в покоях.'].concat(calendarTip()) });
  let bx = W - 262;
  speedBtns(bx);
  bx += 62; const unread = (G.court.letters || []).filter(l => !l.read && l.arr <= G.day + G.frac).length;
  const B = [['i_seal', 'Малый совет (K)', () => UI.open({ k: 'council' }), 'council'], ['i_flag', 'Войска и командиры (V)', () => UI.open({ k: 'cmd' }), 'cmd'], ['i_family', 'Семья и знатные дома (F)', () => UI.open({ k: 'dyn' }), 'dyn'], ['i_flask', 'Знания (J)', () => UI.open({ k: 'tech' }), 'tech'], ['i_chron', 'Летопись правления (T)', () => UI.open({ k: 'chron' }), 'chron'], ['i_build', 'Замыслы и стройки (P)' + (projCur() ? ' — идёт: «' + PROJK[projCur().k].n + '»' : ''), () => UI.open({ k: 'proj' }), 'proj'], ['i_food', 'Снабжение и обоз (O)' + (typeof supStatus === 'function' && supStatus() ? ' — ' + supStatus() : ''), () => UI.open({ k: 'supply' }), 'supply'],
    ['i_raven', 'Письма (L)' + (unread ? ' — непрочитанных: ' + unread : ''), () => UI.open({ k: 'letters' }), 'letters'], G.visit ? ['i_map', 'Уехать отсюда (Tab)', () => visitLeave(), ''] : ['i_map', 'Карта королевства (Tab)', () => openMapFromCourt(), ''], ['i_book', 'Трактат «Искусство войны» (B)', () => UI.open({ k: 'book', ch: TUT.lastCh() }), 'book'], [Snd.muted() ? 'i_mute' : 'i_snd', 'Звук (M — без звука)', () => sndOpen(), 'sound'], ['i_scroll', 'Меню (Esc)', () => UI.open({ k: 'menu' }), 'menu']];
  B.forEach(([ic, tip, f, k], i) => { btn('ctb' + i, bx + i * 16, 2, 15, 14, { ic, style: 'dark', tip, onClick: f, active: !!(k && UI.win && UI.win.k === k) }); if (k === 'letters' && unread) { rect(bx + i * 16 + 10, 1, 6, 6, PAL.o); rect(bx + i * 16 + 11, 2, 4, 4, '#e04030'); } });
}
function goldTip3() { const r = G.realms[0], C = G.court, t = C.seats.treasurer >= 0 ? charOf(C.seats.treasurer) : null;
  const L = ['Казна по книгам казначея: ' + Math.round(bookGold()) + ' зол.', { t: 'Доход: +' + (r.inc || 0).toFixed(1) + ' в день', c: UIC.good }, { t: 'Расход: −' + (r.exp || 0).toFixed(1) + ' в день', c: UIC.bad }];
  L.push({ t: t ? 'Книги ведёт ' + t.name + '. Настоящие монеты лежат в Казне (восточное крыло замка).' : 'Казначея нет — счёт ведётся кое-как.', c: UIC.dim });
  L.push({ t: 'Войска сверх того покупают провиант на рынках — в походе это ощутимо.', c: UIC.dim });
  if (hasTech('ledgers')) L.push({ t: 'Учётные книги: сверка показывает расхождение ' + (C.hidden > 5 ? '≈' + Math.round(C.hidden) + ' зол.' : 'не больше пары монет'), c: C.hidden > 5 ? UIC.warn : UIC.good });
  return L; }
function drawCourtHUD() {
  drawCourtTop();
  const P = COURT.p;
  // room label
  if (COURT.room && NOW - COURT.roomT < 3.2) { const a = clamp(Math.min((NOW - COURT.roomT) * 3, (3.2 - (NOW - COURT.roomT)) * 2), 0, 1); ctx.globalAlpha = a; const w = tw(COURT.room) + 24; rect(8, 24, w, 15, 'rgba(20,14,12,0.82)'); strokeR(8, 24, w, 15, '#8a6a3a'); txt(COURT.room, 8 + w / 2, 28, PAL.y, { al: 'c' }); ctx.globalAlpha = 1; }
  // prompt
  if (!courtBlocked() && P) { const t = nearestTarget(); let s = null; if (t) s = t.e ? t.label : t.n ? 'Поговорить: ' + npcTitle(t.n) : t.a.id === 'council' && P.sit === LOCS.keep.spots.seat_king ? (meetingOpen() ? 'Совет: ждать или начать' : 'Совет: созвать или раздать дела') : t.a.label; else if (P.sit) s = P.sit === LOCS.keep.spots.throne ? 'Встать с трона' : 'Встать';
    if (s) { const w = tw(s) + 30; const x = W / 2 - w / 2, y = H - 30; rect(x, y, w, 16, 'rgba(20,14,12,0.85)'); strokeR(x, y, w, 16, '#8a6a3a'); rect(x + 4, y + 3, 11, 10, '#e8d5a8'); txt('E', x + 7, y + 5, '#3a2614'); txt(s, x + 20, y + 5, '#f4ecd8'); hit(x, y, w, 16, { id: 'cprompt', cursor: true, onClick: () => { if (t) interact(t); else standUp(); } }); } }
  // hint line
  const L = curLoc(); let hint = '';
  if (L.out && isNight() && COURT.room === 'Сад') hint = 'Shift — красться: так можно подслушать ночной разговор.';
  if (COURT.ear && COURT.ear.prog > 0 && !COURT.ear.done) hint = 'Не выходите из тени… Ещё немного.';
  if (hint) { const w = tw(hint, { f: 's' }) + 10; rect(8, H - 14, w, 11, 'rgba(20,14,12,0.8)'); txt(hint, 13, H - 11, '#c8d8e8', { f: 's' }); }
  if (G.visit) drawVisitPanel();
  for (const f of HUD_EXT) f();
  if (!DLG.open()) drawFeed(); drawStatus(); drawPausedBadge();
}
// ---------- keys / update ----------
function courtKeys() {
  const blocked = UI.modalOpen() || (G.over && !G.over.ack) || (typeof TUT !== 'undefined' && TUT.blocking());
  for (const k of input.keys) {
    const c = k.code;
    if (c === 'KeyM') { Snd.toggle(); continue; } if (c === 'F3') { FPS.show = !FPS.show; continue; }
    if (DLG.open() && !UI.modalOpen()) { DLG.key(k); continue; }
    if (c === 'Escape') { if (UI.win) UI.shut(); else if (!blocked) UI.open({ k: 'menu' }); continue; }
    if (blocked) continue;
    const winK = { KeyK: 'council', KeyV: 'cmd', KeyF: 'dyn', KeyJ: 'tech', KeyL: 'letters', KeyR: 'realm', KeyN: 'diplo', KeyP: 'proj', KeyO: 'supply', KeyT: 'chron' }[c];
    if (winK) { if (UI.win && UI.win.k === winK) UI.shut(); else if (winK === 'diplo') UI.open({ k: 'diplo', t: firstForeign() }); else UI.open({ k: winK }); continue; }
    if (c === 'KeyB') { if (UI.win && UI.win.k === 'book') UI.shut(); else UI.open({ k: 'book', ch: TUT.lastCh() }); continue; }
    if (UI.win) continue;
    if (CKEY_EXT.some(f => f(c))) continue;
    if (c === 'KeyE' || c === 'Enter' || c === 'NumpadEnter') { const t = nearestTarget(); if (t) interact(t); else if (COURT.p.sit) standUp(); }
    else if (c === 'Space') setSpeed(G.speed > 0 ? 0 : (UI.lastSpeed || 1));
    else if (c === 'Digit1' || c === 'Numpad1') setSpeed(1); else if (c === 'Digit2' || c === 'Numpad2') setSpeed(2); else if (c === 'Digit3' || c === 'Numpad3') setSpeed(3); else if (c === 'Digit0' || c === 'Numpad0') setSpeed(0);
    else if (c === 'Tab') { if (G.visit) visitLeave(); else openMapFromCourt(); }
    else if (c === 'KeyZ') { COURT.Z = COURT.Z === 2 ? 1 : 2; snapCam(); }
    else if (c === 'KeyH' || c === 'F1') UI.alert('help');
  }
  input.keys.length = 0;
  if (input.wheel && !UI.win && !DLG.open()) { const z = input.wheel > 0 ? 1 : 2; if (z !== COURT.Z) { COURT.Z = z; snapCam(); } }
}
const NPC_SPDK = [1, 1, 1.4, 2.2];
function courtUpdate() {
  const dt = Math.min(DT, 0.05), run = !UI.paused() && !DLG.open() && !COURT.fade;
  if (run) { let tk = 1; for (const f of TIMEK_EXT) tk = Math.min(tk, f() || 1); worldAdvance(dt * tk / COURT_SPD[G.speed]); if (SCREEN !== 'court') return; }
  const ha = G.day * 24 + hourAbs(); if (COURT.lastHA !== undefined && ha - COURT.lastHA > 0.75) npcSnap(false); COURT.lastHA = ha;
  const hh = Math.floor(hourAbs() * 2), home = !G.visit; if (hh !== COURT.lastHH) { COURT.lastHH = hh; if (home) try { courtHalfHour(hh / 2); } catch (e) { onErr(e); } }
  if (run) { const k = NPC_SPDK[G.speed] || 1; for (const n of COURT.npcs) { schedTick(n); npcUpdate(n, dt * k); } aniUpdate(dt); partsUpdate(dt); for (const f of UPD_EXT) f(dt); if (home) eavesdropUpdate(dt); else siteUpdate(dt); playerUpdate(dt); }
  if (!COURT.fade && home) { councilUpdate(); audienceAuto(); }
  else if (COURT.p) COURT.p.moving = 0;
  camUpdate(dt);
  if (COURT.fade) { const ph = (NOW - COURT.fadeT) / 0.22; if (ph >= 1 && COURT.fadeFn) { const f = COURT.fadeFn; COURT.fadeFn = null; try { f(); } catch (e) { onErr(e); } } COURT.fade = ph >= 2 ? 0 : Math.max(0.001, ph); }
}
function drawCourt() {
  hit(0, 0, W, H, { id: 'court', onClick: c => courtClick(c) });
  courtRender();
  if (COURT.fade) { const a = COURT.fade < 1 ? COURT.fade : 2 - COURT.fade; ctx.fillStyle = 'rgba(8,6,10,' + clamp(a, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); }
  if (COURT.sleepT) drawSleep();
  drawCourtHUD(); drawDialog();
  if (typeof TUT !== 'undefined') TUT.drawPanel();
  drawWindow(); drawModals(); drawToast();
}
function courtSyncVisual() { const r = G.realms[0], C = G.court; COURT.goldPiles = clamp(Math.round(r.gold / 90), 0, 10); COURT.sacks = clamp(Math.round((C.grain || 0) / (granCap() / 6)), 0, 6);
  const king = charOf(G.player.char), kids = (king.kids || []).map(charOf).filter(c => c && c.alive); COURT.hasBaby = kids.some(c => c.age < 3) ? 1 : 0; COURT.hasKids = kids.some(c => c.age >= 3 && c.age < 12) ? 1 : 0; }
function courtEnter(spName) {
  if (G.visit) visitCleanup(); buildCourt(); projApply(); const king = charOf(G.player.char);
  COURT.p = COURT.p || { x: 0, y: 0, dir: 'down', f: 0, moving: 0, sit: null, lie: 0, key: 'king' }; COURT.p.c = king; COURT.p.sit = null; COURT.p.lie = 0;
  courtPopulate(); const sp = spotOf(spName || 'throne_front') || LOCS.keep.spots.throne_front; COURT.loc = sp.loc; COURT.p.x = sp.x; COURT.p.y = sp.y; COURT.p.dir = sp.dir;
  COURT.parts = []; COURT.path = null; COURT.onArrive = null; COURT.room = ''; COURT.fade = 0; COURT.sleepT = 0; SCREEN = 'court'; snapCam(); courtSyncVisual();
  COURT.lastHA = G.day * 24 + hourAbs(); COURT.lastHH = Math.floor(hourAbs() * 2); Snd.music('auto'); UI.win = null; G.atCourt = 1; if (!G.speed) G.speed = UI.lastSpeed || 1; // life at court goes on by itself
  for (const f of ENTER_EXT) try { f(); } catch (e) { onErr(e); }
}
// ---------- simple acts & small talk ----------
function doAct(a) {
  const P = COURT.p, L = curLoc();
  switch (a.id) {
    case 'throne': sitAt(LOCS.keep.spots.throne); startAudience(); break;
    case 'council': sitAt(LOCS.keep.spots.seat_king); councilSit(); break;
    case 'maptable': openMapFromCourt(); break;
    case 'research': UI.open({ k: 'tech' }); break;
    case 'bed': bedDialog(); break;
    case 'crib': cribDialog(); break;
    case 'treasury': treasuryAct(); break;
    case 'eyeboard': eyeBoardAct(); break;
    case 'gate': gateAct(); break;
    case 'stable': stableAct(); break;
    case 'dovecote': UI.open({ k: 'letters' }); break;
    case 'granary': DLG.say(null, granTalk()); break;
    case 'kitchen': DLG.say(null, R.pick(['Из кухни тянет луком, дымом и свежим хлебом. Повариха гремит котлами.', 'На кухне ощипывают кур. Кто-то напевает старую песню о походе на север.', 'Поварята при виде короля роняют половник.'])); break;
    case 'smithy': DLG.say(null, 'Кузнец бьёт молотом по раскалённой полосе. ' + (hasTech('mail') ? 'Вдоль стены висят новые кольчуги — по новому способу, частым плетением.' : 'Наконечники копий, подковы, гвозди — кузня работает на войско.')); break;
    case 'barracks': barracksAct(); break;
    case 'dummy': if (P.c && sickNot(P.c)) { UI.toast(sickNot(P.c) + ': меч подождёт.'); break; } if (P.c && P.c.wound > G.day) { { const n = P.c.wound - G.day; UI.toast(woundNot(P.c) + ': меч подождёт (ещё ' + n + ' ' + plural(n, 'день', 'дня', 'дней') + ').'); } break; } if (P.practiceT && NOW - P.practiceT < 1.2) break; P.practiceT = NOW; P.dir = 'up'; Snd.sfx('swish'); setTimeout(() => Snd.sfx('thud'), 180); COURT.parts.push({ k: 'puff', x: a.x, y: a.y - 10, vx: 0, vy: -6, t: 0, life: 0.6 });
      if (!G.court.drillDay || G.court.drillDay !== G.day) { G.court.drillDay = G.day; const k = charOf(G.player.char); k.mx = (k.mx || 0) + 1; if (k.mx >= 6) { k.mx = 0; k.mar = Math.min(20, k.mar + 1); UI.toast('Рука крепнет: Меч короля +1'); } else UI.toast('Упражнение с мечом. Солдаты одобрительно гудят.'); } break;
    case 'fountain': DLG.say(null, 'Вода в фонтане холодная и прозрачная. На дне блестят монеты — придворные бросают их на счастье.', { choices: [{ t: 'Бросить монету (1 зол.)', fx: () => { G.realms[0].gold -= 1; Snd.sfx('coin'); UI.toast(R.pick(['Монета булькнула. Говорят, к удаче.', 'Монета легла рядом с чужими желаниями.', 'Кто-то из служанок хихикнул за кустами.'])); } }, { t: 'Уйти', fx: () => { } }], esc: 1 }); break;
    case 'well': DLG.say(null, R.pick(['Глубокий колодец. Ведро скрипит на вороте.', 'Вода в колодце сладкая — замок выдержит долгую осаду.'])); break;
    case 'stall': stallAct(); break;
    default: if (ACTS_EXT[a.id]) ACTS_EXT[a.id](a); else UI.toast(a.label);
  }
}
function talkTo(n) {
  const P = COURT.p; if (P.sit && n.seat === undefined && !n.petition && !n.envoy) standUp();
  if (!n.sit && !n.path) { const dx = P.x - n.x, dy = P.y - n.y; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  if (n.talk) return n.talk(n);
  if (n.msgr) return talkMessenger(n); if (n.envoy) return talkEnvoy(n); if (n.petition) return talkPetitioner(n);
  if (n.seat) return talkSeat(n); if (n.fam) return talkFamily(n); if (n.key.startsWith('ward')) return talkWard(n);
  if (n.vis) return talkVisitor(n);
  return talkStaff(n);
}
const STAFF_LINES = {
  guard: ['Ваше величество!', 'Всё спокойно, государь.', 'Стоим на страже, государь.', 'Ночью у ворот кто-то бродил. Прогнали.'],
  cook: ['Похлёбка с ячменём, государь! Отведаете?', 'Мука нынче дорогая. Купцы жадничают.', 'Ваш сын опять таскал пирожки. Весь в отца!'],
  maid: ['Простите, государь, я тут подмету…', 'Ой! Ваше величество… Я не заметила.', 'В библиотеке опять кто-то жёг свечи до утра.'],
  smith: ['Сталь — что характер, государь: закалишь — не сломается.', 'Подков на всю конницу не напасёшься!'],
  stable: ['Гнедой ваш застоялся, государь. Прокатитесь?', 'Кони чуют погоду лучше звездочётов.'],
  gardener: ['Розы нынче хороши, государь.', 'Ночами в саду бывает шумно. Не моё дело, конечно…'],
  master: ['Желаете размяться, государь? Чучело всегда ждёт.', 'Солдаты в казармах ворчат, но служат.'],
  soldier: ['Служу короне!', 'Говорят, на границе неспокойно.'], soldier2: ['С сорока шагов — в яблоко, государь!', 'Стрел бы побольше…'],
  merchant: ['Шелка с юга, пряности, книги! Для вас — особая цена.', 'Дороги нынче опасны, государь. Разбойники.'],
  page: ['Бегу, государь! Письма, письма…', 'Я быстрее любого гонца по замку!'],
};
function talkStaff(n) { const k = n.staff || 'guard'; let line = n.post === 'dun_guard' ? dunGuardLine() : gossipLine(n) || R.pick(STAFF_LINES[k] || STAFF_LINES.guard); say(n, line, 4); DLG.say(n, line); }
function bedDialog() { const h = hourAbs();
  const ch = [];
  if (h >= 18.5 || h < 6) ch.push({ t: 'Лечь спать до утра', fx: () => sleepUntil(6.5 + 24 * (h >= 6 ? 1 : 0)) });
  ch.push({ t: 'Отдохнуть пару часов', fx: () => sleepUntil(h + 2) }); ch.push({ t: 'Не сейчас', fx: () => { } });
  DLG.say(null, h >= 18.5 || h < 6 ? 'Королевская постель застелена. В камине догорают угли.' : 'Ещё светло. Спать днём — дурная примета для короля, но отдохнуть можно.', { choices: ch, esc: ch.length - 1 }); }
function sleepUntil(tgtAbs, sp) { // tgtAbs: hour in 5..29+ space relative to today; sp: the bed (the king's own by default)
  sitAt(sp || LOCS.keep.spots.bed_king); COURT.sleepT = NOW; COURT.sleepTo = G.day + (tgtAbs - 5) / 24; G.speed = G.speed || 1; Snd.sfx('paper'); }
function drawSleep() { // advance the world quickly while the king sleeps; stops for events
  const tgt = COURT.sleepTo, cur = G.day + G.frac; let a = clamp((NOW - COURT.sleepT) * 2, 0, 0.85);
  if (cur < tgt && !UI.modalOpen() && !DLG.open()) { const step = Math.min(0.004, tgt - cur); for (let i = 0; i < 3 && G.day + G.frac < tgt && !UI.modalOpen(); i++) worldAdvance(step); }
  if (G.day + G.frac >= tgt - 1e-6 || UI.modalOpen()) { COURT.sleepT = 0; npcSnap(false); standUp(); COURT.lastHA = G.day * 24 + hourAbs(); UI.toast(UI.modalOpen() ? 'Вас разбудили!' : 'Доброе утро, государь.'); if (typeof TUT !== 'undefined') TUT.ev('slept'); }
  ctx.fillStyle = 'rgba(6,6,16,' + a + ')'; ctx.fillRect(0, 0, W, H); txt('Король спит…  ' + clockStr(), W / 2, H / 2 - 4, '#a8c8ff', { al: 'c' }); txt('Z z z', W / 2 + Math.sin(NOW * 2) * 6, H / 2 - 18 - (NOW * 8) % 8, '#6a7ab0', { al: 'c' }); }
