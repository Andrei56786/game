// Прогон сценариев из tests/ на dist/index.html#court777 с итогом «прошёл / не прошёл».
//   node tools/runtests.mjs            — все сценарии, кроме долгих стендов баланса
//   node tools/runtests.mjs --all      — все сценарии
//   node tools/runtests.mjs smoke save — только названные
// Не прошёл: код выхода drive.mjs ≠ 0 (упал шаг, ложная проверка {expect}, ошибки на странице)
// или в выводе есть непустой список ошибок "errs":[…]. JOBS=3 — сколько браузеров сразу.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SLOW = new Set(['hl_m', 'hl_m2', 'hl_pairs', 'qm', 'qs', 'qt', 'qx', 'qx2', 'qy', 'perf']); // стенды баланса: долгие, печатают цифры
const args = process.argv.slice(2), all = args.includes('--all'), names = args.filter(a => !a.startsWith('--'));
const list = names.length ? names : fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).filter(n => all || !SLOW.has(n)).sort();
const html = path.join(ROOT, 'dist', 'index.html');
if (!fs.existsSync(html)) { console.error('Нет dist/index.html — сначала python3 tools/build.py'); process.exit(2); }
fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
const url = 'file://' + html + '#court777', JOBS = +(process.env.JOBS || 3), LIMIT = +(process.env.TEST_TIMEOUT || 300) * 1000;
const bad = /"errs":\[(?!\])|\\"errs\\":\[(?!\])/;
const res = [];
function run(n) {
  return new Promise(done => {
    const t0 = Date.now(); let out = '';
    const p = spawn(process.execPath, [path.join(ROOT, 'tools/drive.mjs'), url, path.join(ROOT, 'tests', n + '.json')], { cwd: ROOT });
    const kill = setTimeout(() => { out += '\nTIMEOUT'; p.kill('SIGKILL'); }, LIMIT);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', code => { clearTimeout(kill); const ok = code === 0 && !bad.test(out) && !/TIMEOUT$/.test(out); res.push({ n, ok, s: Math.round((Date.now() - t0) / 1000), out }); console.log((ok ? 'ok   ' : 'FAIL ') + n + ' (' + Math.round((Date.now() - t0) / 1000) + ' с)'); done(); });
  });
}
const queue = list.slice();
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));
const failed = res.filter(r => !r.ok);
for (const r of failed) console.log('\n===== ' + r.n + ' =====\n' + r.out.split('\n').filter(l => /FAILED|ERRORS|errs|TIMEOUT|Error/.test(l)).slice(0, 12).map(l => l.slice(0, 400)).join('\n'));
console.log('\nИтого: ' + (res.length - failed.length) + ' из ' + res.length + ' прошли' + (failed.length ? '; не прошли: ' + failed.map(r => r.n).join(', ') : ''));
process.exit(failed.length ? 1 : 0);
