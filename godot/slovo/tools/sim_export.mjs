// Таблицы и эталон симуляции из HTML-версии (dist/index.html) для Godot → godot/slovo/art/ (генерируется, в git не хранится).
// Запуск из корня репозитория после export.mjs: node godot/slovo/tools/sim_export.mjs
// sim_tables.bin — таблицы игры (войска, черты, имена, державы, дома, товары, погода…): Godot читает их bytes_to_var;
// sim_ref.bin — эталон для tools/state_check.gd: состояние G после newGame (ng) и после newGame3 + обзор (ng3) по зерну 777,
// с состоянием общего генератора R; затем SIM_DAYS (84) дней королевства без двора: каждый день — SIM_STEPS (24) шагов
// движения (pageStep — worldAdvance без короля: походы войск и встречи) и сам день (pageDay — как SimDay.dailyTick в Godot,
// с замыслами держав и походами ИИ). Бой до среза 0.7 — «на счётах» (pageQuick, как SimArmy.quick* в Godot): по силе, духу,
// стенам и удаче, без поля боя. Сводка каждого дня и полные снимки на днях 1, 2, 7, 21, 28, 84 (SIM_SNAPS=all — на каждом).
// Числа — float64 без потерь.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..'), out = path.resolve(here, '../art');
const html = path.join(root, 'dist/index.html');
if (!fs.existsSync(html)) { console.error('нет dist/index.html — сначала python3 tools/build.py'); process.exit(1); }
const SEED = +(process.env.SIM_SEED || 777);
const exe = process.env.CHROMIUM || ['/usr/local/bin/chromium'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('file://' + html);
await page.waitForFunction(() => window.T && window.T.ev, null, { timeout: 120000, polling: 300 });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); // экран не нужен: только расчёты
// кодировщик Variant (gdvar.mjs) — внутрь страницы
const enc = fs.readFileSync(path.join(here, 'gdvar.mjs'), 'utf8').replace(/^export\s+/m, '');
await page.evaluate(src => { window.__gdv = new Function(src + '\nreturn encodeVariant;')(); }, enc);

function pageTables() {
  const T = { UT, UNIT, UNIT_TIP, RANGED, MOUNTED, FOOT, CUL_UNIT, SEASONS, DAYS_SEASON, DAYS_YEAR, DAYS_WEEK, SPD, BASE_SPEED, WAGON_CAP, MAN_CAP, TRAITS, NAMES, RULERS,
    WEEKDAYS, WDAY_S, COUNCIL_WD, WEATHER, WTAB, REALM_DEF, HOUSES, SEATS, GOODS, GD, RAW_G, RAW, SEASON_F, NEED, FAVG, RECIPE, BIGK, RESERVE, ECONK, GA, ST_KEYS, POOL_K,
    TINFO, TR, SEAT_K, MW, MH, TS, NT, SIGN_INFO, SPYT, MODE_INFO, PROJK, FEMRX: FEMRX.source, KM_PER_TILE: typeof KM_PER_TILE !== 'undefined' ? KM_PER_TILE : 0 };
  const u8 = window.__gdv(T); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s);
}
// бой «на счётах» (до среза 0.7, где будет настоящий): исход — по силе войск, духу, усталости, стенам и удаче; потери,
// добыча, отход и разгром, счёт войны, летопись — как в applyBattle (captains.js) и его обёртке из reign.js
function pageQuick() {
  const GXP = { levy: 10, spear: 15, sword: 20, archer: 15, xbow: 15, horse: 15, harch: 15, knight: 25 };
  const pow = s => powerU(s.u, s.xp) * (0.55 + s.morale / 200) * (1 - Math.min(60, s.fat) / 300) * s.wall;
  const side = a => ({ army: a.id, u: Object.assign(emptyU(), a.u), xp: a.xp, morale: a.morale, fat: a.fat, wall: 1, realm: a.realm, name: armyLabel(a), king: a.kind === 'player' && a.gen === G.player.char });
  const gar = (S, assault) => ({ sett: S.id, u: Object.assign(emptyU(), S.gar), xp: GXP, morale: S.food > 0 ? 65 : 35, fat: 0, realm: S.ctrl, name: 'гарнизон ' + WD.setts[S.id].name, king: false,
    wall: assault && S.walls > 0 ? 1 + S.walls * 0.5 * (1 - 0.6 * (S.siege ? Math.min(1, S.siege.works / Math.max(1, S.siege.need)) : 1)) : 1 });
  function run(sides, tile) {
    const pa = pow(sides[0]) * (0.85 + R.f() * 0.3), pb = pow(sides[1]) * (0.85 + R.f() * 0.3), win = pa >= pb ? 0 : 1;
    const r = Math.min(pa, pb) / Math.max(1e-9, pa, pb), kw = 0.26 * r, kl = 0.3 + 0.5 * (1 - r) * (1 - r), res = { win, sides: [] };
    for (const si of [0, 1]) {
      const s = sides[si], winner = si === win, a = s.army !== undefined ? armyById(s.army) : null, u = a ? a.u : G.setts[s.sett].gar, m0 = menOf(u);
      takeU(u, Math.round(m0 * (winner ? kw : kl))); const lost = m0 - menOf(u), o = { lost, killed: 0, wounded: Math.round(lost * (winner ? 0.42 : 0.25)), prisoners: 0 }; o.killed = lost - o.wounded;
      if (a) { a.wounded += o.wounded; a.arrows = Math.max(0, a.arrows - rangedN(s.u) * 6); a.morale = clamp(a.morale + (winner ? 8 : -18), 0, 100); a.vict = winner ? 12 : -15; a.fat = clamp(a.fat + 15, 0, 100);
        for (const t of UT) a.xp[t] = Math.min(100, (a.xp[t] || 0) + (winner ? 6 : 3)); a.lastFight = G.day; }
      res.sides.push(o);
    }
    const W0 = sides[win], L0 = sides[1 - win], wa = W0.army !== undefined ? armyById(W0.army) : null, la = L0.army !== undefined ? armyById(L0.army) : null, lostL = res.sides[1 - win].lost;
    if (wa) { const loot = { food: 0, arrows: 0, weap: Math.round(lostL * 0.3), horses: 0, gold: 0, prisoners: Math.round(lostL * 0.18) };
      if (la) { loot.food = Math.round(la.food * 0.4); loot.arrows = Math.round(la.arrows * 0.3); loot.horses = Math.round(la.horses * 0.5 + lostL * (mountedN(la.u) / Math.max(1, armyMen(la) + lostL)) * 0.3);
        loot.gold = Math.round((la.goods || 0) * 0.8 + (la.loot || 0) + (la.kind === 'lord' ? 10 : 0) + (la.kind === 'caravan' ? caravanLoot(la) : 0)); la.food -= loot.food; la.arrows -= loot.arrows; la.horses = Math.max(0, la.horses - Math.round(la.horses * 0.5)); la.goods = 0; la.loot = 0; }
      loot.food = Math.min(loot.food, Math.max(0, armyCap(wa) - armyLoad(wa)));
      wa.food += loot.food; wa.arrows += loot.arrows; wa.weap += loot.weap; wa.horses += loot.horses; wa.prisoners = (wa.prisoners || 0) + loot.prisoners; if (wa.realm < 5) G.realms[wa.realm].gold += loot.gold; res.loot = loot; }
    if (la) { const m = armyMen(la); if (m < 15 || (lostL > m * 2.5 && la.kind !== 'player')) destroyArmy(la, 'разбито'); else retreatArmy(la, wa); }
    if (wa && armyMen(wa) <= 0) destroyArmy(wa, 'погибло');
    const ra = W0.realm, rb = L0.realm, p = G.player.realm;
    if (ra < 5 && rb < 5 && ra !== rb) { const v = clamp(lostL / 25, 2, 20); G.rel[ra][rb].bs = (G.rel[ra][rb].bs || 0) + v; G.rel[rb][ra].bs = (G.rel[rb][ra].bs || 0) - v; }
    if (ra === p || rb === p) { G.stats.battles++; if (ra === p) G.stats.won++; G.realms[p].fear = (G.realms[p].fear || 0) + (ra === p ? 3 : -2);
      const pw = ra === p, mine = pw ? W0 : L0, foe = pw ? L0 : W0;
      if (W0.sett !== undefined || L0.sett !== undefined) log(mine.name + (pw ? ' отбился от: ' : ' не устоял: ') + foe.name, pw ? 'good' : 'bad');
      else log((pw ? 'Победа над: ' : 'Поражение от: ') + foe.name + ' · наши потери ' + res.sides[pw ? win : 1 - win].lost + ', вражеские ' + res.sides[pw ? 1 - win : win].lost, pw ? 'good' : 'bad');
      const s0 = sides[0].realm === p ? 0 : 1;
      if (sides[1 - s0].realm !== p) { const S = sides[s0], E = sides[1 - s0], won = win === s0, m0 = menOf(S.u), m1 = menOf(E.u), st = RST(); if (won) st.won++; else st.lost++;
        if (m0 + m1 >= 60 || S.king) chron((won ? 'Победа' : 'Поражение') + ' близ ' + placeName(placeNear(tile)) + ': ' + (E.realm < 5 ? realmName(E.realm) : E.name) + ' (' + fmt(m0) + ' против ' + fmt(m1) + ')' + (S.king ? ' — король сам вёл войско.' : '.'), won ? 'sword' : 'flag', won ? 'won' : 'lost', S.king || m0 + m1 >= 600 ? 3 : 2); } }
    return res;
  }
  autoBattle = function (a, b) { const res = run([side(a), side(b)], armyTile(a)); res.winA = res.win === 0; return res; };
  autoBattleGarrison = function (a, S, assault) { const res = run([side(a), gar(S, assault)], WD.setts[S.id].i); res.win = res.win === 0; return res; };
}
// шаг движения (worldAdvance из command.js без короля в поле: его войско, погоня, встречи с ним, гонцы и снабженец — когда он в походе)
function pageStep(dd) {
  for (const a of G.armies) if (a.alive) advanceArmy(a, dd);
  aiContacts();
}
// день королевства без двора (срез 0.6): то, что Godot уже считает сам, — тот же порядок, что в dailyTick (events.js)
function pageDay() {
  if (G.day % 2 === 0) revealWater();
  G.day++;
  if (--G.weather.days <= 0) rollWeather();
  if (G.day % DAYS_SEASON === 0) onSeason();
  for (const a of G.armies.slice()) if (a.alive) dailyArmy(a);
  econDaily();
  for (let r = 0; r < 5; r++) if (alive(r)) realmEconomy(r);
  for (const S of G.setts) dailySett(S);
  for (let r = 0; r < 5; r++) aiRealm(r);
  for (const a of G.armies.slice()) if (a.alive && a.kind !== 'player') aiArmy(a);
  if (G.day % 7 === 0) diploWeekly();
  if (G.day % 5 === 0) { WD.lairs.forEach((L, k) => { if (!G.armies.some(a => a.alive && a.kind === 'bandit' && a.lair === k) && R.f() < 0.12) spawnBandits(L); }); }
  for (const c of G.chars) if (c.prison >= 0 && c.prison !== G.player.realm && R.f() < 0.03) c.prison = -1;
  const king = charOf(G.player.char); if (king.prison >= 0) kingCaptured(king);
  const pr = G.realms[G.player.realm]; if (pr.gold < 0 && G.day % 3 === 0) log('Казна пуста! Войску не платят — боевой дух падает.', 'bad');
  for (const m of G.msgs) if (!m.done && m.until < G.day) { m.done = 1; if (m.kind === 'call') declineCall(m); }
  G.msgs = G.msgs.filter(m => !m.done || G.day - m.day < 2);
  G.armies = G.armies.filter(a => a.alive);
  if (G.court) { const mud = DAILY_EXT.find(f => String(f).includes('G.mudOn')); mud(); }
  checkRealms(); checkVictory();
  computeVision(); updateSigns();
}
function pageRef(seed, days, snaps, steps) {
  pageQuick();
  const opt = { diff: 1, tut: false, mapOpen: false };
  const snap = () => ({ G, R: R.get() >>> 0, ECON: { inc: ECON.inc, incDay: ECON.incDay, incoming: ECON.incoming || null }, SIGNS: SIGNS.map(s => Object.assign({}, s)) });
  const b64 = a => { let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  newGame(seed, opt); const parts = [b64(window.__gdv(snap()))];
  newGame3(seed, opt); computeVision(); updateSigns(); parts.push(b64(window.__gdv(snap())));
  // дни: сводка каждого дня (генератор, казна держав, войска, летопись, погода, распутица) и полные снимки в days
  const dig = [], shot = [], t0 = performance.now();
  for (let d = 1; d <= days; d++) {
    for (let k = 0; k < steps; k++) pageStep(1 / steps);
    const pos = G.armies.reduce((s, a) => s + a.x * 7 + a.y * 13, 0);
    pageDay();
    dig.push({ day: G.day, R: R.get() >>> 0, gold: G.realms.map(r => r.gold), armies: G.armies.length, log: G.log.length, w: G.weather.k, mud: G.mud || 0, chars: G.chars.length, pos });
    if (snaps.includes(d)) { shot.push(d); parts.push(b64(window.__gdv(snap()))); }
  }
  const ms = performance.now() - t0;
  parts.splice(2, 0, b64(window.__gdv({ seed, days, steps, snaps: shot, dig, ms })));
  return { parts, chars: G.chars.length, armies: G.armies.length, ms };
}
const t0 = Date.now();
const tab = await page.evaluate(src => window.T.ev('(' + src + ')()'), pageTables.toString());
const DAYS = +(process.env.SIM_DAYS || 84), STEPS = +(process.env.SIM_STEPS || 24), SNAPS = process.env.SIM_SNAPS === 'all' ? [...Array(DAYS)].map((_, i) => i + 1) : [1, 2, 7, 21, 28, 84].filter(d => d <= DAYS);
const ref = await page.evaluate(([src, lib, seed, days, snaps, steps]) => window.T.ev(lib + '\n;(' + src + ')(' + seed + ',' + days + ',' + JSON.stringify(snaps) + ',' + steps + ')'), [pageRef.toString(), [pageQuick, pageStep, pageDay].map(f => f.toString()).join('\n'), SEED, DAYS, SNAPS, STEPS]);
await browser.close();
if (errs.length) { console.error('ошибки страницы:\n' + errs.join('\n')); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'sim_tables.bin'), Buffer.from(tab, 'base64'));
// эталон: зерно, число кусков, длины, затем куски — newGame, newGame3, сводка дней, снимки дней (каждый — отдельный Variant)
const parts = ref.parts.map(b => Buffer.from(b, 'base64')), hd = Buffer.alloc(8 + 4 * parts.length);
hd.writeUInt32LE(SEED, 0); hd.writeUInt32LE(parts.length, 4); parts.forEach((p, i) => hd.writeUInt32LE(p.length, 8 + 4 * i));
fs.writeFileSync(path.join(out, 'sim_ref.bin'), Buffer.concat([hd, ...parts]));
const tot = parts.reduce((s, p) => s + p.length, 0);
console.log(`SIM EXPORT OK: таблицы ${Buffer.from(tab, 'base64').length} Б, эталон зерна ${SEED}: людей ${ref.chars}, войск ${ref.armies}, дней ${DAYS} по ${STEPS} шагов (${Math.round(ref.ms)} мс в HTML), снимков ${parts.length - 3}, ${(tot / 1048576).toFixed(1)} МБ, ${Date.now() - t0} мс`);
process.exit(0);
