// A sheet of every icon (i_*), at 1× on dark and parchment, and 4×: node tools/iconsheet.mjs out.png
import { chromium } from 'playwright';
import fs from 'fs';
const out = process.argv[2] || 'shots/icons.png';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/vercel/sandbox/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.goto('file:///data/game/dist/index.html#court'); await page.waitForFunction(() => window.T && window.T.ev);
const url = await page.evaluate(() => window.T.ev(`(() => { const ks = Object.keys(SPR).filter(k => /^i_/.test(k) && !k.includes('@')).sort(); const cols = 8, cw = 150, ch = 46, c = document.createElement('canvas'); c.width = cols * cw; c.height = Math.ceil(ks.length / cols) * ch; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#1b1420'; g.fillRect(0, 0, c.width, c.height);
  ks.forEach((k, i) => { const x = (i % cols) * cw, y = Math.floor(i / cols) * ch, s = SPR[k]; g.fillStyle = '#2a2232'; g.fillRect(x + 2, y + 2, 44, 42); g.fillStyle = '#e8d5a8'; g.fillRect(x + 48, y + 2, 44, 42);
    g.drawImage(s, x + 4, y + 4, s.width * 4, s.height * 4); g.drawImage(s, x + 50, y + 4, s.width * 4, s.height * 4); g.drawImage(s, x + 4, y + 34, s.width * 2, s.height * 2); g.drawImage(s, x + 50, y + 34, s.width * 2, s.height * 2);
    g.fillStyle = '#f4ecd8'; g.font = '12px sans-serif'; g.fillText(k.slice(2), x + 96, y + 26); });
  return c.toDataURL(); })()`));
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('ok', out); await browser.close(); process.exit(0);
