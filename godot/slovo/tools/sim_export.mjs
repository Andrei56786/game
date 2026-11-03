// Таблицы и эталон симуляции из HTML-версии (dist/index.html) для Godot → godot/slovo/art/ (генерируется, в git не хранится).
// Запуск из корня репозитория после export.mjs: node godot/slovo/tools/sim_export.mjs
// sim_tables.bin — таблицы игры (войска, черты, имена, державы, дома, товары, погода…): Godot читает их bytes_to_var;
// sim_ref.bin — эталон для tools/state_check.gd: состояние G после newGame (ng) и после newGame3 + обзор (ng3) по зерну 777,
// с состоянием общего генератора R. Числа — float64 без потерь (gdvar.mjs).
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
function pageRef(seed) {
  const opt = { diff: 1, tut: false, mapOpen: false };
  const snap = () => ({ G, R: R.get() >>> 0, ECON: { inc: ECON.inc, incDay: ECON.incDay, incoming: ECON.incoming || null }, SIGNS: SIGNS.map(s => Object.assign({}, s)) });
  newGame(seed, opt); const ng = snap(); const ngB = window.__gdv(ng);
  newGame3(seed, opt); computeVision(); updateSigns(); const ng3 = snap(); const ng3B = window.__gdv(ng3);
  const u8 = window.__gdv({ seed, ng: 0, ng3: 0 }); // заголовок; сами снимки — отдельными кусками (иначе G второй раз уже другой)
  const b64 = a => { let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  return { head: b64(u8), ng: b64(ngB), ng3: b64(ng3B), chars: G.chars.length, armies: G.armies.length };
}
const t0 = Date.now();
const tab = await page.evaluate(src => window.T.ev('(' + src + ')()'), pageTables.toString());
const ref = await page.evaluate(([src, seed]) => window.T.ev('(' + src + ')(' + seed + ')'), [pageRef.toString(), SEED]);
await browser.close();
if (errs.length) { console.error('ошибки страницы:\n' + errs.join('\n')); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'sim_tables.bin'), Buffer.from(tab, 'base64'));
// эталон: [длина, байты] ×2 — newGame и newGame3 (каждый — отдельный Variant)
const parts = [Buffer.from(ref.ng, 'base64'), Buffer.from(ref.ng3, 'base64')], hd = Buffer.alloc(12);
hd.writeUInt32LE(SEED, 0); hd.writeUInt32LE(parts[0].length, 4); hd.writeUInt32LE(parts[1].length, 8);
fs.writeFileSync(path.join(out, 'sim_ref.bin'), Buffer.concat([hd, ...parts]));
console.log(`SIM EXPORT OK: таблицы ${Buffer.from(tab, 'base64').length} Б, эталон зерна ${SEED}: людей ${ref.chars}, войск ${ref.armies}, ${parts[0].length + parts[1].length} Б, ${Date.now() - t0} мс`);
process.exit(0);
