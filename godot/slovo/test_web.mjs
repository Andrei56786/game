// Проверка веб-сборки Godot в Chromium без окна: заставка, тронный зал и двор днём, в сумерках и ночью, разговор, ходьба, масштаб.
// Любая ошибка в консоли — провал. Снимки — в build/shots. Запуск: node godot/slovo/test_web.mjs (после sh godot/slovo/build.sh)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, 'build/web'), out = path.join(here, 'build/shots');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.pck': 'application/octet-stream', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, path.normalize(decodeURIComponent(q.url.split('?')[0])).replace(/^[/\\]+$/, 'index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const port = srv.address().port;
const local = process.env.CI ? undefined : ['/usr/local/bin/chromium', '/usr/bin/chromium'].find(p => fs.existsSync(p)); // в CI — chromium от Playwright
const browser = await chromium.launch({ executablePath: process.env.CHROME || local, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [], errs = [];
page.on('console', m => { logs.push(m.text()); if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(String(e)));
const fails = [];
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const wait = ms => page.waitForTimeout(ms);
const until = async (re, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { const l = logs.find(x => re.test(x)); if (l) return l; await wait(200); } return null; };
const cmd = (...c) => page.evaluate(c => c.forEach(x => window.slovo(x)), c);
const state = async () => { const n = logs.length; await cmd('state'); await wait(100); const l = logs.slice(n).find(x => x.startsWith('STATE ')); return l ? JSON.parse(l.slice(6)) : null; };
const shot = n => page.screenshot({ path: path.join(out, n + '.png') });
try {
  await page.goto(`http://localhost:${port}/index.html`);
  const ready = await until(/^READY /);
  check(!!ready, 'игра загрузилась: ' + (ready || 'нет строки READY за минуту'));
  if (ready) {
    await wait(1500); await shot('title');
    await cmd('help'); await wait(400); await shot('title_help'); await cmd('help');
    await cmd('court'); await wait(2500); await cmd('time 12', 'speed 1', 'spot throne_front'); await wait(1500); await shot('keep_day');
    let s = await state();
    check(s && s.loc === 'keep' && s.npcs >= 30 && s.here >= 4, 'тронный зал днём: ' + JSON.stringify(s));
    await cmd('spot plaza_n'); await wait(1500); await shot('yard_day');
    s = await state();
    check(s && s.loc === 'yard' && s.dark < 0.1 && s.here >= 8 && s.sea === 'th', 'двор днём: светло, люди на виду (' + (s && s.here) + '), оттепель 1-го дня, как в HTML (' + (s && s.sea) + ')');
    const seas = [];
    for (const [d, sv, n] of [[30, '', 'yard_summer'], [52, 'au2', 'yard_autumn'], [72, 'w', 'yard_winter']]) {
      await cmd('day ' + d, 'time 12'); await wait(1500); await shot(n);
      s = await state(); seas.push(s && s.sea === sv);
    }
    check(seas.every(Boolean), 'вид двора меняется по дню года: лето, золотая осень, снег');
    await cmd('day 0', 'time 12'); await wait(1200);
    await cmd('time 19.8'); await wait(1200); await shot('yard_dusk');
    await cmd('time 23.5'); await wait(1500); await shot('yard_night');
    s = await state();
    check(s && s.dark > 0.5 && s.asleep >= 12, 'ночь: темно, люди спят или у себя (' + (s && s.asleep) + ')');
    await cmd('spot throne_front'); await wait(1500); await shot('keep_night');
    await cmd('time 12', 'spot plaza_n'); await wait(1500);
    const n0 = logs.length;
    await cmd('goto grd_gate_l', 'talk'); await wait(1200); await shot('talk');
    s = await state();
    check(s && s.talk && logs.slice(n0).some(x => x.startsWith('TALK ')), 'разговор со стражником открылся');
    await cmd('next', 'next', 'next', 'next'); await wait(300);
    s = await state();
    check(s && !s.talk, 'разговор закрылся');
    const x0 = s.king[0];
    await cmd('walk -1 0 0.5'); await wait(300);
    s = await state();
    check(s && s.king[0] < x0 - 10, 'король идёт влево');
    await cmd('zoom 1'); await wait(800); await shot('yard_zoom1'); await cmd('zoom 2');
    await cmd('title'); await wait(800);
  }
} catch (e) { check(false, 'исключение: ' + e); }
check(errs.length === 0, 'ошибок в консоли нет' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
await browser.close(); srv.close();
console.log(fails.length ? `Godot-веб: ${fails.length} провал(ов)` : 'Godot-веб: всё в порядке');
process.exit(fails.length ? 1 : 0);
