// Loudness of music pieces, rendered offline: node tools/mustat.mjs [secs] [mood,mood,…] [wavdir]
import { chromium } from 'playwright';
import fs from 'fs';
const secs = +(process.argv[2] || 30), only = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null, wavdir = process.argv[4];
const exe = process.env.CHROME || '/vercel/sandbox/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto('file:///data/game/dist/index.html');
await page.waitForFunction(() => window.Snd && Snd._k && Snd._k.MOODS);
const moods = only || await page.evaluate(() => Object.keys(Snd._k.MOODS));
for (const m of moods) {
  const r = await page.evaluate(async ([m, secs, w]) => { try { const t0 = performance.now(); const r = await Snd._test(m, secs, w); return w ? { wav: r, ms: performance.now() - t0 } : Object.assign(r, { ms: Math.round(performance.now() - t0), g: Snd._k.MOODS[m].g }); } catch (e) { return { err: String(e && e.stack || e) }; } }, [m, secs, !!wavdir]);
  if (wavdir && r.wav) { fs.writeFileSync(`${wavdir}/${m}.wav`, Buffer.from(r.wav, 'base64')); console.log(m, 'wav', Math.round(r.ms) + 'ms'); }
  else console.log(m.padEnd(12), JSON.stringify(r));
}
await browser.close(); process.exit(0);
