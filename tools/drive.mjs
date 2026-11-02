// Автотесты в браузере без окна (Playwright).
// node tools/drive.mjs <url> <steps.json> [width height]
// Шаги: {waitFor: expr}, {eval: code}, {evalFile: path}, {print: expr}, {move:[x,y]}, {click:[x,y,btn?]},
//       {key: 'KeyE'}, {wait: ms}, {shot: 'name.png'}, {png: 'name.png', expr: 'код, возвращающий dataURL'}. Координаты — логические (640×360). Код выполняется через T.ev внутри игры.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const [url, stepsFile, w = '1280', h = '720'] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const exe = process.env.CHROME || '/vercel/sandbox/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); else if (m.type() === 'log' && process.env.LOG) console.log('[page]', m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.T && window.T.ev, null, { timeout: 15000 });
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const ev = code => page.evaluate(c => { const r = window.T.ev(c); return r === undefined ? null : JSON.parse(JSON.stringify(r)); }, code);
async function toPage(x, y) { const r = await page.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; }); return [r[0] + x * r[2] / 640, r[1] + y * r[3] / 360]; }
for (const s of steps) {
  try {
    if (s.waitFor) await page.waitForFunction(c => { try { return !!window.T.ev(c); } catch (_) { return false; } }, s.waitFor, { timeout: s.timeout || 20000, polling: 100 });
    else if (s.eval !== undefined) { const r = await ev(s.eval); if (s.out !== false && r !== null) console.log(typeof r === 'string' ? r : JSON.stringify(r)); }
    else if (s.evalFile) { const r = await ev(fs.readFileSync(path.resolve(ROOT, s.evalFile), 'utf8')); if (r !== null) console.log(typeof r === 'string' ? r : JSON.stringify(r)); }
    else if (s.print) console.log(s.label ? s.label + ': ' : '', JSON.stringify(await ev(s.print)));
    else if (s.move) { const [x, y] = await toPage(...s.move); await page.mouse.move(x, y); }
    else if (s.click) { const [x, y] = await toPage(s.click[0], s.click[1]); await page.mouse.click(x, y, { button: ['left', 'middle', 'right'][s.click[2] || 0] }); }
    else if (s.key) await page.keyboard.press(s.key);
    else if (s.wait) await page.waitForTimeout(s.wait);
    else if (s.shot) await page.screenshot({ path: path.resolve(ROOT, 'shots', s.shot) });
    else if (s.png) { const d = await ev(s.expr); if (typeof d === 'string' && d.startsWith('data:')) fs.writeFileSync(path.resolve(ROOT, 'shots', s.png), Buffer.from(d.split(',')[1], 'base64')); else console.log('png: no data for', s.png, String(d).slice(0, 200)); }
  } catch (e) { console.log('STEP FAILED', JSON.stringify(s).slice(0, 200), String(e.message || e).split('\n')[0]); if (s.must !== false) break; }
}
if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 10).join('\n')); else console.log('no page errors');
await browser.close();
