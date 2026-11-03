// Проверка веб-сборки Godot в Chromium без окна: заставка, двор днём, в сумерках и ночью, разговор, ходьба.
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
    await cmd('court', 'time 12', 'speed 1'); await wait(1500); await shot('court_day');
    let s = await state();
    check(s && s.npcs === 5 && s.night === 0, 'двор днём: пять человек на виду, светло');
    await cmd('time 19.8'); await wait(1200); await shot('court_dusk');
    await cmd('time 23.5', 'speed 3'); await wait(4000); await shot('court_night');
    s = await state();
    check(s && s.night === 1 && s.npcs < 5, 'ночь: темно, люди ушли в дома (на виду ' + (s && s.npcs) + ')');
    await cmd('time 12', 'speed 1'); await wait(3000);
    const n0 = logs.length;
    await cmd('goto 1', 'talk'); await wait(600); await shot('court_talk');
    s = await state();
    check(s && s.talk === 1 && logs.slice(n0).some(x => x.startsWith('TALK ')), 'разговор со стражником открылся');
    await cmd('next', 'next', 'next'); await wait(300);
    s = await state();
    check(s && s.talk === -1, 'разговор закрылся');
    const x0 = s.king[0];
    await cmd('walk -1 0 0.5'); await wait(300);
    s = await state();
    check(s && s.king[0] < x0 - 10, 'король идёт влево');
    await cmd('title'); await wait(800);
  }
} catch (e) { check(false, 'исключение: ' + e); }
check(errs.length === 0, 'ошибок в консоли нет' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
await browser.close(); srv.close();
console.log(fails.length ? `Godot-веб: ${fails.length} провал(ов)` : 'Godot-веб: всё в порядке');
process.exit(fails.length ? 1 : 0);
