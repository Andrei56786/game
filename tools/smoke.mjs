// Быстрая проверка: заставка и старт при дворе открываются без ошибок. node tools/smoke.mjs [файл.html]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = path.resolve(process.argv[2] || path.join(ROOT, 'dist/index.html'));
const exe = process.env.CHROME || '/vercel/sandbox/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--no-sandbox'] });
fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
for (const h of ['', '#court']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + file + h);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: path.join(ROOT, 'shots', `smoke${h ? '-court' : ''}.png`) });
  console.log(h || '(start)', errs.length ? errs.slice(0, 5).join('\n') : 'no errors');
  await p.close();
}
await b.close();
