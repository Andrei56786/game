// Экспорт графики и данных двора из HTML-версии (dist/index.html) для Godot → godot/slovo/art/ (генерируется, в git не хранится).
// Запуск из корня репозитория: python3 tools/build.py && node godot/slovo/tools/export.mjs
// Берёт то, что рисует сама игра: фоны локаций (по сезонам), спрайты предметов, людей 16×32 и животных, портреты,
// пиксельные шрифты (BMFont), а также карту проходимости, двери, места, огни, окна, расписания и реплики.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..'), out = path.resolve(here, '../art');
const html = path.join(root, 'dist/index.html');
if (!fs.existsSync(html)) { console.error('нет dist/index.html — сначала python3 tools/build.py'); process.exit(1); }
const exe = process.env.CHROMIUM || ['/usr/local/bin/chromium'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('file://' + html + '#court777');
await page.waitForFunction(() => window.T && window.T.ev("typeof SCREEN !== 'undefined' && SCREEN === 'court' && !!G && !!COURT.p"), null, { timeout: 120000, polling: 500 });

// всё ниже выполняется внутри игры (window.T.ev видит её переменные)
function pageExport() {
  const spr = [], idx = new Map(), files = {};
  const add = c => { if (!c) return -1; let i = idx.get(c); if (i === undefined) { i = spr.length; spr.push(c); idx.set(c, i); } return i; };
  const png = c => c.toDataURL('image/png').slice(22);
  const r1 = v => Math.round(v * 1000) / 1000;
  const day0 = G.day, frac0 = G.frac;
  // сезоны: вид наружного места по дню года (seaVarOf: оттепель, цветение, лето, три осени, снег) — как в HTML
  const objOut = (o, deco) => {
    if (o.show && !o.show()) return null;
    const e = { f: [], x: o.x, y: o.y, sy: o.sy !== undefined ? o.sy : o.y + (o.h || 0) };
    if (o.fr) { e.gate = 1; for (let f = 0; f < 2; f++) e.f.push(add(objSprite(o.k, o.o, f))); }
    else for (let f = 0; f < Math.max(1, o.anim || 0); f++) e.f.push(add(objSprite(o.k, o.o, f)));
    if (o.anim > 1) { e.fps = o.fps || 6; e.ph = r1(o.x * (deco ? 0.13 : 0.11)); }
    if (deco && o.k === 'window') e.night = add(objSprite('window', WIN_NIGHT, 0));
    if (o.k === 'oak' || o.k === 'fruit') e.tree = 1;
    return e;
  };
  const res = { ver: 2, CT, year: DAYS_YEAR, day: day0, hour: r1(hourAbs()), locs: {}, order: Object.keys(LOCS) };
  for (const id in LOCS) {
    const L = LOCS[id];
    const o = { name: L.name, w: L.w, h: L.h, out: L.out ? 1 : 0, dark: L.dark || 0, solid: Array.from(L.solid).join(''), var: {}, days: [] };
    const vars = L.out ? Array.from({ length: DAYS_YEAR }, (_, d) => d) : [day0];
    for (const d of vars) {
      if (L.out) { G.day = d; G.frac = 0.3; if (L.sk !== seaKeyOf(L)) bakeLoc(L); }
      const sv = L.out ? (L.sv || '') : '';
      if (L.out) o.days.push(sv);
      if (o.var[sv]) continue;
      SEAV = sv;
      try {
        const bg = 'bg_' + id + (sv ? '_' + sv : '') + '.png'; files[bg] = png(L.cv);
        const v = { bg, objs: [], deco: [] };
        for (const e of L.objs) { const x = objOut(e, 0); if (x) v.objs.push(x); }
        for (const e of L.deco) { const x = objOut(e, 1); if (x) v.deco.push(x); }
        if (L.hbSlots && G.houses) { let i = 0; for (const H0 of G.houses) { if (!H0.alive || i >= L.hbSlots.length) continue; const [tx, ty] = L.hbSlots[i++]; const s = objSprite('housebanner', { house: H0.her, ck: 'hb' + H0.id }, 0); v.deco.push({ f: [add(s)], x: tx * CT + 8 - (s.width >> 1), y: (ty + 1) * CT - s.height - 2, sy: (ty + 1) * CT, bob: 1, ph: tx }); } }
        o.var[sv] = v;
      } finally { SEAV = ''; }
    }
    if (L.out) { G.day = day0; G.frac = frac0; bakeLoc(L); }
    o.lights = L.lights.map(l => { const q = { x: l.x + (l.dx || 0), y: l.y + (l.dy || 0), r: l.r, col: l.col, a: l.a }; if (l.fl) q.fl = l.fl; if (l.night) q.night = 1; return q; });
    o.wins = L.wins.map(w => [w.x, w.y, w.big ? 1 : 0]);
    o.beams = L.beams || [];
    o.smoke = L.smoke.map(s => [s.x, s.y]);
    const fo = L.objs.find(q => q.k === 'bld' && q.o && q.o.kind === 'forge'); if (fo) o.forge = [fo.x + 26, fo.sy - 12];
    o.doors = L.doors.map(d => ({ x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, to: d.to, ax: d.ax, ay: d.ay, dir: d.dir, label: d.label || '' }));
    o.spots = {}; for (const k in L.spots) { const s = L.spots[k], q = { x: s.x, y: s.y, dir: s.dir }; for (const f of ['sit', 'lie', 'away', 'sx', 'sy']) if (s[f] !== undefined && s[f] !== null && typeof s[f] !== 'object' && typeof s[f] !== 'function') q[f] = s[f]; o.spots[k] = q; }
    o.acts = L.acts.filter(a => !a.show || a.show()).map(a => ({ id: a.id, x: a.x, y: a.y, r: a.r, label: a.label || '', auto: a.auto ? 1 : 0 }));
    o.rooms = L.rooms;
    res.locs[id] = o;
  }
  // люди: лист 4 стороны × 4 шага (16×32), портрет 48×48, расписание, реплики
  const sheet = c => DIRS.map(d => [0, 1, 2, 3].map(f => add(walkerSprite(c, d, f))));
  const port = c => { try { const p = portrait(c); return p ? add(p) : -1; } catch (e) { return -1; } };
  const talkLines = n => { const got = []; for (let k = 0; k < 4; k++) { try { DLG.q = []; DLG.cur = null; UI.win = null; talkTo(n); const d = DLG.cur; if (d) { const t = d.pages.map(p => p.join(' ')).join(' ').trim(); if (t && !got.includes(t)) got.push(t); } } catch (e) { } } DLG.q = []; DLG.cur = null; UI.win = null; return got; };
  res.people = COURT.npcs.filter(n => !n.visitor).map(n => {
    const q = { key: n.key, name: npcTitle(n), sub: npcSub(n) || '', role: n.c.role || '', spd: n.spd, home: n.home || '', sheet: sheet(n.c), port: port(n.c), loc: n.loc, x: Math.round(n.x), y: Math.round(n.y), dir: n.dir, away: n.away ? 1 : 0 };
    if (n.sched) q.sched = n.sched; if (n.bed) q.bed = n.bed; if (n.staff) q.staff = n.staff; if (n.post) q.post = n.post; if (n.seat) q.seat = n.seat; if (n.fam) q.fam = 1; if (n.c.fem) q.fem = 1; if (n.c.age < 12) q.kid = 1;
    q.lines = n.staff ? (STAFF_LINES[n.staff] || STAFF_LINES.guard).slice() : talkLines(n);
    return q;
  });
  const P = COURT.p, kc = P.c;
  res.king = { name: (kc.title ? kc.title + ' ' : '') + kc.name, short: kc.name, sheet: sheet(kc), port: port(kc), loc: COURT.loc, x: P.x, y: P.y, dir: P.dir };
  // животные двора
  const AK = { horse: 1, dog: 1, cat: 1, hen: 1, pigeon: 1 };
  res.animals = COURT.ani.filter(a => AK[a.kind]).map(a => ({ kind: a.kind, loc: a.loc, r: a.r, x: Math.round(a.x), y: Math.round(a.y), f: [add(animalSprite(a.kind, 0, false, a.col || null)), add(animalSprite(a.kind, 1, false, a.col || null))] }));
  res.anisp = ANISP;
  res.shadow = add(shadowSpr(12));
  res.shadowBig = add(shadowSpr(22)); res.shadowSmall = add(shadowSpr(9));
  // значки верхней строки
  const WIC = ['i_star', 'i_sun', 'i_moon', 'i_cloud', 'i_fog', 'i_rain', 'i_snow', 'i_storm', 'i_wind'];
  res.icons = {}; for (const k of ['shield0', 'i_gold', 'i_men', 'i_food', ...WIC, 'i_seal', 'i_scroll', 'i_book', 'i_pause', 'i_play1', 'i_play2', 'i_play3', 'i_crown', 'i_eye', ...Object.keys(ICONS).map(k => 'i_' + k)]) if (SPR[k]) res.icons[k] = [add(SPR[k]), typeof hiIc === 'function' && hiIc(k) ? 1 : 0];
  // поле боя (bfig.js): фигурки воинов по родам войск в цветах держав — кадры [спрайт, ноги (fy), середина (cx)]
  res.figs = REALM_DEF.map(d => { const o = {}; for (const t of UT) { const F = figFrames(t, d.col, d.dark), q = {}; for (const fr in F) q[fr] = [add(F[fr]), F[fr].fy, F[fr].cx]; o[t] = q; } return o; });
  // лица воевод на карточках полков (drawPortrait(captChar(c), x, y, 1/3) — 16×16): по 8 на народ державы, и король
  const small = p => { if (!p) return -1; const [c, g] = mkCanvas(16, 16); g.imageSmoothingEnabled = false; g.drawImage(p, 0, 0, 16, 16); return add(c); };
  const CAGE = [24, 28, 33, 38, 43, 48, 30, 36];
  res.capts = REALM_DEF.map((d, r) => CAGE.map((age, k) => { try { return small(portrait({ id: 'cpx' + r + '_' + k, name: '', role: 'general', cul: d.key, fem: 0, age, realm: 0, pseed: 1000 + r * 37 + k * 7919, traits: [], alive: 1, prison: -1, pseudo: 1 })); } catch (e) { return -1; } }));
  try { res.kingS = small(portrait(kc)); } catch (e) { res.kingS = -1; }
  // лица 48×48 тех же воевод (drawPortrait(g, x, y, 1) — карточки встречи, войска короля, окно «Войска короны»)
  res.capts48 = REALM_DEF.map((d, r) => CAGE.map((age, k) => { try { const p = portrait({ id: 'cpx' + r + '_' + k, name: '', role: 'general', cul: d.key, fem: 0, age, realm: 0, pseed: 1000 + r * 37 + k * 7919, traits: [], alive: 1, prison: -1, pseudo: 1 }); return p ? add(p) : -1; } catch (e) { return -1; } }));
  // и женские лица (атаманши, владетельницы): по 8 на культуру
  res.capts48f = REALM_DEF.map((d, r) => CAGE.map((age, k) => { try { const p = portrait({ id: 'cpf' + r + '_' + k, name: '', role: 'general', cul: d.key, fem: 1, age, realm: 0, pseed: 2000 + r * 41 + k * 7907, traits: [], alive: 1, prison: -1, pseudo: 1 }); return p ? add(p) : -1; } catch (e) { return -1; } }));
  // карта королевства: войска (mkArmySprites), гербы держав для подсказок, глаз скрытого войска
  res.mapspr = {}; for (const k of ['a_knight', 'a_foot', 'a_bandit', 'a_wagon', 'a_ox', 'a_tent', 'a_camp', 'i_eye', ...REALM_DEF.map((d, i) => 'shield' + i)]) if (SPR[k]) res.mapspr[k] = add(SPR[k]);
  // чёткие значки книжного шрифта (icons2.js, hiCanvas): растр под масштаб окна V = 2, 3, 4 точки экрана на точку игры;
  // bar — значок у чисел верхней строки (sprBar, ×1.4), btn — на кнопке скорости (btn с ic: до ×1.6), one — как есть (spr: корона столицы, глаз; значок до 7×7 — ×1.2 вокруг середины),
  // x3 и x4 — корона и флаг итога боя (×3 на поле, ×4 в окне итога на карте)
  res.hi = {};
  if (typeof hiCanvas === 'function') for (const k in res.icons) { const base = k.slice(2), s = SPR[k]; if (k.slice(0, 2) !== 'i_' || !HI[base]) continue;
    const q = {}, uses = { bar: 1.4, btn: Math.min(1.6, Math.max(1, (14 - 5) / Math.max(s.width, s.height))), one: s.width <= 7 && s.height <= 7 ? 1.2 : 1 };
    if (k === 'i_crown' || k === 'i_flag') { uses.x3 = 3; uses.x4 = 4; }
    for (const u in uses) { const sc = uses[u]; q[u] = { sc }; for (const V of [2, 3, 4]) { const e = hiCanvas(base, Math.round(V * sc * 100) / 100, ''); q[u][V] = [add(e.c), e.pad]; } }
    res.hi[k] = q; }
  try { res.weather = weatherOf(); } catch (e) { res.weather = { n: '', ic: 'sun' }; }
  res.dateStr = dateStr(G.day); res.realm = G.realms[0].name || '';
  res.gold = Math.round(bookGold ? bookGold() : G.realms[0].gold); res.grain = Math.round(G.court.grain || 0);
  res.net = r1((G.realms[0].inc || 0) - (G.realms[0].exp || 0));
  try { res.men = G.armies.filter(a => a.alive && a.realm === 0 && a.kind === 'lord').reduce((s, a) => s + armyMen(a), 0); } catch (e) { res.men = 0; }
  // пиксельные шрифты (как в HTML): атлас и метрики глифов
  res.fonts = {};
  for (const fk of ['m', 's']) { const F = FONTS[fk], at = fontAtlas(F, '#ffffff'), m = {}; for (const ch in F.map) m[ch] = [F.map[ch].x, F.map[ch].w];
    files['font_' + fk + '.png'] = png(at); res.fonts[fk] = { hgt: F.hgt, cap: F.cap, sp: fk === 'm' ? 4 : 3, w: at.width, map: m, upper: fk === 's' ? 1 : 0, lat: LAT }; }
  // заставка: закат, замок на холме, горы (mkTitleBG в HTML), 640×360
  files['title_bg.png'] = png(mkTitleBG());
  res.pal = {}; for (const k of ['o', 'k', 'w', 'y', 'Y', 'T', 'B', 'C', 'P', 'M', 'L']) res.pal[k] = PAL[k];
  res.uic = Object.assign({}, UIC);
  // пергамент окна разговора (как DLG в HTML): 608×122
  { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 640, 130); panelParch(0, 0, 608, 122); const c = document.createElement('canvas'); c.width = 608; c.height = 122; c.getContext('2d').drawImage(cv, 0, 0, 608, 122, 0, 0, 608, 122); files['ui_parch.png'] = png(c); }
  // ===== мир: данные генератора (тот же WD, что у HTML-игры с этим зерном) и спрайты карты =====
  {
    const b64 = ta => { const u8 = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
    const f64 = v => Array.from(new Uint32Array(new Float64Array([v]).buffer)); // точное число: два слова по 32 бита
    const AR = { ter: 'u8', elev: 'f32', rel: 'f32', moist: 'f32', temp: 'f32', river: 'u8', down: 'i32', acc: 'f32', road: 'u8', bridge: 'u8', ford: 'u8', prov: 'i32', ocean: 'u8', lake: 'u8', fwd: 'u8', dOcean: 'u8', main: 'u8' };
    const w = { wv: WD.wv, seed: WD.seed, sea: f64(WD.sea), MW, MH, TS, arrays: AR };
    for (const k in AR) files['wd_' + k] = b64(k === 'prov' ? Int32Array.from(WD.prov) : WD[k]);
    w.provs = WD.provs.map(P => ({ id: P.id, seat: P.seat, x: P.x, y: P.y, area: P.area, cx: f64(P.cx), cy: f64(P.cy), nb: Array.from(P.nb), mix: b64(P.mix), coast: P.coast, river: P.river, villages: P.villages.slice(), name: P.name, cul: P.cul }));
    w.setts = WD.setts.map(s => ({ id: s.id, name: s.name, type: s.type, x: s.x, y: s.y, i: s.i, prov: s.prov, coast: s.coast }));
    w.lairs = WD.lairs.map(l => [l.x, l.y, l.i, l.prov]); w.owner = Array.from(WD.owner); w.caps = WD.caps.slice();
    w.labels = WD.labels.map(L => ({ t: L.t, x: f64(L.x), y: f64(L.y), kind: L.kind, n: L.n || 0 }));
    w.rivers = WD.rivers.map(p => Array.from(p)); w.roads = WD.roadList.map(r => [r.lvl, ...r.p]);
    // для генератора в Godot: таблицы имён и числа, которые HTML считает через Math.pow (берём точные)
    w.gen = { CULT, LAKEN, MOUNTN, SEAT_K: f64(SEAT_K), ED: f64(34 * Math.pow(WSCALE, 0.8)), WSCALE: f64(WSCALE), ms: WD.ms, tt: WD.tt };
    // для отрисовки: палитры местности, цвета рек и дорог, державы
    const u32 = a => Array.from(a);
    w.tpal = {}; for (const k in TPAL) w.tpal[k] = k === 'crops' ? TPAL[k].map(p => p.map(u32)) : TPAL[k].map(u32);
    w.cols = { FOAM: C_FOAM, FOAM2: C_FOAM2, WET: C_WET, HEDGE: C_HEDGE, WAVE: C_WAVE, RIV: C_RIV, RIVL: C_RIVL, BANK: C_BANK, RD: C_RD, RDE: C_RDE, TR: C_TR };
    w.rwid = RWID.slice(); w.realms = REALM_DEF.map(d => ({ key: d.key, name: d.name, adj: d.adj, col: d.col, dark: d.dark, light: d.light }));
    w.tinfo = TINFO.map(t => ({ n: t.n, cost: t.cost, water: t.water || 0, mc: t.mc }));
    // спрайты карты (деревья, горы, холмы, камыш…) и их уменьшенные копии для обзора; поселения 4 вида × 5 народов × 3
    if (!MSPR.oak) initMapSprites();
    w.mspr = {}; for (const k of ['oak', 'pine', 'spine', 'birch', 'mount', 'mountS', 'peak', 'hill', 'hillW', 'hillC', 'reed', 'pud', 'tuft', 'rock', 'bush']) w.mspr[k] = MSPR[k].map(add);
    w.msprq = {}; if (MSPR.q) for (const k in MSPR.q) w.msprq[k] = MSPR.q[k].map(add);
    w.sett = {}; for (const ty of ['village', 'castle', 'town', 'capital']) for (const cu of ['K', 'C', 'R', 'T', 'E']) for (let v = 0; v < 3; v++) { const s = settSprite(ty, cu, v); w.sett[ty + cu + v] = { s: add(s.c), flags: s.flags }; }
    w.crown = SPR.i_crown ? add(SPR.i_crown) : -1;
    // обзорная карта HTML (1 точка = 4 точки мира) — только для сверки на глаз, в игру не идёт
    if (MAPR.quarter) files['ref_overview.png'] = png(MAPR.quarter);
    res.world = w;
  }
  // атлас спрайтов: полки по высоте, страницы 2048×2048
  const order = spr.map((c, i) => i).sort((a, b) => spr[b].height - spr[a].height || spr[b].width - spr[a].width);
  const PW = 2048, PH = 2048, rects = new Array(spr.length), pages = [];
  let pg = null, x = 0, y = 0, sh = 0;
  const newPage = () => { pg = document.createElement('canvas'); pg.width = PW; pg.height = PH; pages.push(pg); x = 0; y = 0; sh = 0; };
  newPage();
  for (const i of order) { const c = spr[i], w = c.width, h = c.height;
    if (x + w > PW) { x = 0; y += sh + 1; sh = 0; }
    if (y + h > PH) newPage();
    pg.getContext('2d').drawImage(c, x, y); rects[i] = [pages.length - 1, x, y, w, h]; x += w + 1; sh = Math.max(sh, h); }
  pages.forEach((p, i) => { // обрезать пустой низ последней страницы
    let hh = PH; if (i === pages.length - 1) hh = Math.min(PH, y + sh + 1); const c = document.createElement('canvas'); c.width = PW; c.height = hh; c.getContext('2d').drawImage(p, 0, 0); files['spr' + i + '.png'] = png(c); });
  res.spr = rects; res.pages = pages.length;
  return { res, files };
}
const t0 = Date.now();
const { res, files } = await page.evaluate(src => window.T.ev('(' + src + ')()'), pageExport.toString());
await browser.close();
if (errs.length) { console.error('ошибки страницы:\n' + errs.join('\n')); process.exit(1); }
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, '.gitignore'), '*\n');
let bytes = 0;
// мир: массивы клеток — одним файлом world.bin (каждый сжат gzip), оглавление и списки — world.json
const world = res.world; delete res.world; const parts = []; let off = 0;
// игре нужны не все: высоты, влага, стоки и сток воды (elev, moist, acc, down) — только для сверки генератора (world_ref.bin, в сборку не идёт)
const REF = { elev: 1, moist: 1, acc: 1, down: 1 }, refParts = []; let refOff = 0;
for (const k of Object.keys(world.arrays)) { const raw = Buffer.from(files['wd_' + k], 'base64'), gz = zlib.gzipSync(raw, { level: 9 }); delete files['wd_' + k];
  if (REF[k]) { world.arrays[k] = [world.arrays[k], raw.length, refOff, gz.length, 'ref']; refParts.push(gz); refOff += gz.length; continue; }
  world.arrays[k] = [world.arrays[k], raw.length, off, gz.length]; parts.push(gz); off += gz.length; }
fs.writeFileSync(path.join(out, 'world.bin'), Buffer.concat(parts)); bytes += off;
fs.writeFileSync(path.join(out, 'world_ref.bin'), Buffer.concat(refParts));
for (const [n, b64] of Object.entries(files)) { const b = Buffer.from(b64, 'base64'); if (n.startsWith('ref_')) { fs.mkdirSync(path.join(here, '../build'), { recursive: true }); fs.writeFileSync(path.join(here, '../build', n), b); continue; } bytes += b.length; fs.writeFileSync(path.join(out, n), b); }
// BMFont (.fnt, текст) для пиксельных шрифтов — Godot импортирует их как FontFile
for (const [fk, F] of Object.entries(res.fonts)) {
  const chars = [], seen = new Set();
  const put = (ch, g) => { const id = ch.codePointAt(0); if (seen.has(id)) return; seen.add(id); chars.push(`char id=${id} x=${g[0]} y=0 width=${g[1]} height=${F.hgt} xoffset=0 yoffset=0 xadvance=${g[1] + 1} page=0 chnl=15`); };
  for (const [ch, g] of Object.entries(F.map)) { put(ch, g); if (F.upper) put(ch.toLowerCase(), g); }
  for (const [a, b] of Object.entries(F.lat || {})) { const g = F.map[b] || F.map[String(b).toUpperCase()]; if (g) { put(a, g); if (F.upper) put(a.toLowerCase(), g); } }
  chars.push(`char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=${F.sp} page=0 chnl=15`);
  const fnt = [`info face="slovo_${fk}" size=${F.hgt} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=1,1`,
    `common lineHeight=${fk === 'm' ? 11 : 8} base=${F.cap + 2} scaleW=${F.w} scaleH=${F.hgt} pages=1 packed=0`,
    `page id=0 file="font_${fk}.png"`, `chars count=${chars.length}`, ...chars].join('\n') + '\n';
  fs.writeFileSync(path.join(out, 'font_' + fk + '.fnt'), fnt);
  delete F.map; delete F.lat;
}
fs.writeFileSync(path.join(out, 'court.json'), JSON.stringify(res));
fs.writeFileSync(path.join(out, 'world.json'), JSON.stringify(world));
const nl = Object.keys(res.locs).length, np = res.people.length;
console.log(`EXPORT OK: мест ${nl}, людей ${np}, животных ${res.animals.length}, мир ${world.seed}: провинций ${world.provs.length}, поселений ${world.setts.length}, спрайтов ${res.spr.length} на ${res.pages} стр., файлов ${Object.keys(files).length + 3}, ${(bytes / 1048576).toFixed(1)} МБ, ${((Date.now() - t0) / 1000).toFixed(1)} с`);
process.exit(0);
