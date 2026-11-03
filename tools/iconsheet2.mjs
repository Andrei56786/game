// Sheet of the drawn icons (src/icons2.js) next to the pixel ones: node tools/iconsheet2.mjs [out-prefix] [name,name…]
// Each cell: pixel icon ×3 · drawn at 3 device px per game px on the dark bar and on parchment · at 2 · at 12 (big).
import { chromium } from 'playwright';
import fs from 'fs';
const pre = process.argv[2] || 'shots/ic2', only = process.argv[3] ? process.argv[3].split(',') : null;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/vercel/sandbox/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.goto('file:///data/game/dist/index.html#court'); await page.waitForFunction(() => window.T && window.T.ev);
const urls = await page.evaluate(o => window.T.ev(`(() => {
  const ks = ${o ? JSON.stringify(o) : 'Object.keys(HI).sort()'}, per = 20, cols = 4, cw = 250, ch = 100, out = [];
  for (let p0 = 0; p0 < ks.length; p0 += per) {
    const part = ks.slice(p0, p0 + per), c = document.createElement('canvas'); c.width = cols * cw; c.height = Math.ceil(part.length / cols) * ch;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#141018'; g.fillRect(0, 0, c.width, c.height);
    part.forEach((k, i) => { const x = (i % cols) * cw + 4, y = Math.floor(i / cols) * ch + 4, s = SPR['i_' + k];
      const box = (bx, bw, bh, col) => { g.fillStyle = col; g.fillRect(x + bx, y, bw, bh); };
      const put = (bx, kk) => { const e = hiCanvas(k, kk); g.drawImage(e.c, x + bx + 4 - e.pad, y + 4 - e.pad); };
      box(0, 30, 30, '#2a1d16'); g.drawImage(s, x + 4, y + 4, s.width * 3, s.height * 3);
      box(34, 30, 30, '#2a1d16'); put(34, 3); box(68, 30, 30, '#e8d5a8'); put(68, 3); box(102, 24, 30, '#2a1d16'); put(102, 2);
      box(130, 100, 92, '#e8d5a8'); put(130, 12);
      g.fillStyle = '#f4ecd8'; g.font = '13px sans-serif'; g.fillText(k, x, y + 50); });
    out.push(c.toDataURL()); }
  return out; })()`), only);
urls.forEach((u, i) => fs.writeFileSync(pre + '_' + (i + 1) + '.png', Buffer.from(u.split(',')[1], 'base64')));
console.log('ok', urls.length, 'pages'); await browser.close(); process.exit(0);
