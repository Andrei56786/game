// Таблицы и эталон симуляции из HTML-версии (dist/index.html) для Godot → godot/slovo/art/ (генерируется, в git не хранится).
// Запуск из корня репозитория после export.mjs: node godot/slovo/tools/sim_export.mjs
// sim_tables.bin — таблицы игры (войска, черты, имена, державы, дома, товары, погода…): Godot читает их bytes_to_var;
// sim_ref.bin — эталон для tools/state_check.gd: состояние G после newGame (ng) и после newGame3 + обзор (ng3) по зерну 777,
// с состоянием общего генератора R; затем SIM_DAYS (84) дней королевства без двора: каждый день — SIM_STEPS (24) шагов
// движения (pageStep — worldAdvance без короля: походы войск и встречи) и сам день (pageDay — как SimDay.dailyTick в Godot,
// с замыслами держав и походами ИИ). Бои — настоящие, на поле без экрана (autoBattle, runHeadless из captains.js; в Godot —
// SimCapt). Сводка каждого дня и полные снимки на днях 1, 2, 7, 21, 28, 84 (SIM_SNAPS=all — на каждом).
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
const ref = await page.evaluate(([src, lib, seed, days, snaps, steps]) => window.T.ev(lib + '\n;(' + src + ')(' + seed + ',' + days + ',' + JSON.stringify(snaps) + ',' + steps + ')'), [pageRef.toString(), [pageStep, pageDay].map(f => f.toString()).join('\n'), SEED, DAYS, SNAPS, STEPS]);
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
