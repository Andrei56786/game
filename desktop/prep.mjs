// Берёт собранную игру (dist/index.html) и версию из корневого package.json.
import fs from 'fs';
const root = new URL('../', import.meta.url), here = new URL('./', import.meta.url);
const html = new URL('dist/index.html', root);
if (!fs.existsSync(html)) { console.error('Нет dist/index.html — сначала python3 tools/build.py'); process.exit(1); }
fs.copyFileSync(html, new URL('index.html', here));
const v = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8')).version, pf = new URL('package.json', here), p = JSON.parse(fs.readFileSync(pf, 'utf8'));
if (p.version !== v) { p.version = v; fs.writeFileSync(pf, JSON.stringify(p, null, 2) + '\n'); }
console.log('index.html скопирован, версия', v);
