// Звук для Godot из HTML-версии (src/audio.js, audio2.js, music3.js, sndui.js): пьесы, звуки, голоса мест, шумы и шаги.
// Синтез WebAudio не переносится — его записывают без окна, как Snd._test: OfflineAudioContext в Chromium, 44,1 кГц стерео →
// моно, фильтр и 22,05 кГц → godot/slovo/snd/ (генерируется, в git не хранится): пьесы — OGG Vorbis (oggenc или ffmpeg; если
// их нет — WAV), звуки, голоса мест, шумы и шаги — WAV (при импорте Godot сжимает их в QOA). Случайность — с зерном: каждая
// пьеса — одна запись её сочинения (как в HTML — от вступления до паузы в конце), шумы — ровно период петли (2 с).
// Запуск из корня репозитория: python3 tools/build.py && node godot/slovo/tools/snd_export.mjs (пропускает, если звук не менялся)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
const me = fileURLToPath(import.meta.url), here = path.dirname(me), root = path.resolve(here, '../../..'), out = path.resolve(here, '../snd');
const html = path.join(root, 'dist/index.html');
if (!fs.existsSync(html)) { console.error('нет dist/index.html — сначала python3 tools/build.py'); process.exit(1); }
const SRC = ['audio.js', 'audio2.js', 'music3.js', 'sndui.js'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8'));
const key = crypto.createHash('sha1').update(SRC.join('\n') + fs.readFileSync(me, 'utf8')).digest('hex').slice(0, 12);
const idxF = path.join(out, 'index.json');
try {
  const o = JSON.parse(fs.readFileSync(idxF, 'utf8'));
  if (o.key === key && o.files.every(f => fs.existsSync(path.join(out, f)))) { console.log('звук: без изменений (' + key + '), файлов ' + o.files.length); process.exit(0); }
} catch (_) { }
const t0 = Date.now();
fs.rmSync(out, { recursive: true, force: true });
for (const d of ['music', 'sfx', 'amb', 'bed', 'step']) fs.mkdirSync(path.join(out, d), { recursive: true });
fs.writeFileSync(path.join(out, '.gitignore'), '*\n');
// кодек для пьес: oggenc (vorbis-tools) или ffmpeg с libvorbis; SND_WAV=1 — без сжатия
const run = (c, a) => { try { return execFileSync(c, a, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) { return null; } };
const ENC = process.env.SND_WAV ? '' : run('oggenc', ['--version']) !== null ? 'oggenc' : /libvorbis/.test(run('ffmpeg', ['-hide_banner', '-encoders']) || '') ? 'ffmpeg' : '';
const ogg = (src, dst) => ENC === 'oggenc' ? execFileSync('oggenc', ['-Q', '-q', '1', '-o', dst, src]) : execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-c:a', 'libvorbis', '-q:a', '1', dst]);
const exe = process.env.CHROMIUM || ['/usr/local/bin/chromium'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext();
const errs = [];
// до игры: Math.random с зерном (rnd звука берёт его при загрузке) и перехват записанного буфера
await ctx.addInitScript(() => {
  let s = 1;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__seed = n => { s = n | 0; };
  const sr0 = OfflineAudioContext.prototype.startRendering;
  OfflineAudioContext.prototype.startRendering = function () { return sr0.call(this).then(b => { window.__buf = b; return b; }); };
});
// внутри игры: запись (Snd._test) → моно, полуполосный фильтр (31 отвод, Блэкман), каждый второй отсчёт → 16 бит, base64
const REC = `window.__rec = async (what, secs, seed) => {
  const K = Snd._k;
  if (!K.hooks._t0) { const t0 = K.hooks.test; K.hooks._t0 = 1;
    K.hooks.test = (n, t) => { // шумы погоды из audio.js (дождь, ветер) и гром — их нет среди имён SND2
      if (n.startsWith('w:')) { const [k, v] = n.slice(2).split('=');
        if (k === 'rain') { K.loopNoise('highpass', 1100, 0.5, K.ambBus || K.sfxBus).g.gain.value = +v; return; }
        if (k === 'wind') { K.loopNoise('bandpass', 420, 1.2, K.ambBus || K.sfxBus).g.gain.value = +v; return; }
        if (k === 'thunder') { K.nz(t, 2.8, 'lowpass', 260, 0.8, 0.22, K.sfxBus, { a: 0.15, f1: 70 }); K.nz(t + 0.05, 0.5, 'lowpass', 900, 0.6, 0.12, K.sfxBus, { a: 0.01, f1: 200 }); return; }
        if (k === 'roar') { K.loopNoise('bandpass', 520, 0.6, K.sfxBus).g.gain.value = +v; return; }
        if (k === 'clash') { const p = K.sfxBus, r = +v, ac = K.ac, rnd = Math.random; // clash() из audio.js: звон клинков, удар, крик
          if (r === 0) { const f = 1700 + rnd() * 1600, vv = 0.035 + rnd() * 0.05; [[1, 1, 0.22], [1.52, 0.6, 0.16], [2.33, 0.45, 0.1], [3.1, 0.25, 0.07]].forEach(([q, a, d]) => K.tone('sine', f * q, 0, t, d, vv * a, p, 0.001)); K.nz(t, 0.025, 'highpass', 3500, 0.7, vv * 0.9, p); }
          else if (r === 1) { K.nz(t, 0.09, 'lowpass', 700, 0.8, 0.09, p); K.tone('sine', 150, 80, t, 0.1, 0.06, p); }
          else { const f = 160 + rnd() * 110, o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.4);
            const b1 = K.filt('bandpass', 750 + rnd() * 200, 3), b2 = K.filt('bandpass', 1250, 4), g = K.G_(0, p); o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g); K.envAD(g, t, 0.04, 0.05, 0.38); o.start(t); o.stop(t + 0.5); }
          return; } }
      return t0(n, t); }; }
  __seed(seed); window.__buf = null;
  const st = await Snd._test(what, secs);
  const b = window.__buf, n = b.length, L = b.getChannelData(0), R = b.getChannelData(1), KK = 15, H = [];
  let hs = 0; for (let k = -KK; k <= KK; k++) { const x = k / 2, s = k === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x), w = 0.42 + 0.5 * Math.cos(Math.PI * k / (KK + 1)) + 0.08 * Math.cos(2 * Math.PI * k / (KK + 1)); H.push(s * w); hs += s * w; }
  for (let k = 0; k < H.length; k++) H[k] /= hs;
  const N = n >> 1, o = new Int16Array(N); let pk = 0, ss = 0;
  for (let i = 0; i < N; i++) { const c = 2 * i; let a = 0; for (let k = -KK; k <= KK; k++) { const h = H[k + KK]; if (h === 0) continue; const j = c + k; if (j >= 0 && j < n) a += h * (L[j] + R[j]); }
    a *= 0.5; const v = Math.abs(a); if (v > pk) pk = v; ss += a * a; o[i] = Math.max(-32767, Math.min(32767, Math.round(a * 32767))); }
  const u8 = new Uint8Array(o.buffer); let bin = ''; for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return { pcm: btoa(bin), n: N, peak: +pk.toFixed(3), rms: +Math.sqrt(ss / Math.max(1, N)).toFixed(4), nan: st.nan };
};
window.__len = async (mood, seed) => { // длина одной записи пьесы: такты всех частей её сочинения (с паузой в конце)
  const K = Snd._k, hb = K.hooks.bar; let cap = null;
  K.hooks.bar = (S, sec, bi, t, st, barD) => { if (!cap) cap = { F: S.pc.F, barD, t }; if (hb) hb(S, sec, bi, t, st, barD); };
  try { __seed(seed); await Snd._test(mood, 1); } finally { K.hooks.bar = hb; }
  return cap ? cap.t + cap.F.reduce((a, s) => a + (s.rest || 4), 0) * cap.barD : 0;
};
window.__info = () => ({ moods: Object.keys(Snd._k.MOODS), fam: Snd._k.FAM, names: SNDU.NAME, sfx: Object.keys(Snd._k.SFX),
  amb: Object.keys(SND2.BIRD).concat(Object.keys(SND2.BEAST), Object.keys(SND2.THING)), g: Object.fromEntries(Object.entries(Snd._k.MOODS).map(([k, M]) => [k, M.g || 1])) });`;
// записи идут в нескольких вкладках сразу (каждая запись — одно ядро): SND_JOBS или ядер − 1, не больше 4
const JOBS = Math.max(1, +process.env.SND_JOBS || Math.min(4, os.cpus().length - 1));
const mkPage = async () => {
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + html);
  await page.waitForFunction(() => window.T && window.T.ev("typeof Snd !== 'undefined' && !!Snd._k && typeof SND2 !== 'undefined' && typeof SNDU !== 'undefined'"), null, { timeout: 120000, polling: 300 });
  await page.evaluate(src => window.T.ev(src), REC);
  return page;
};
const pages = await Promise.all(Array.from({ length: JOBS }, mkPage));
const info = await pages[0].evaluate(() => window.__info());
const RATE = 22050;
const wav = (pcm, a = 0, b = pcm.length >> 1) => {
  const d = pcm.subarray(a * 2, b * 2), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
};
// короткие звуки: без 40 мс тишины в начале (запись звука начинается с 0,05 с), хвост — до тишины (−66 дБ) и затухание 15 мс
const trim = (pcm, lead = Math.round(0.04 * RATE)) => {
  const s = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1); let e = s.length;
  while (e > lead + 1 && Math.abs(s[e - 1]) < 16) e--;
  e = Math.min(s.length, e + Math.round(0.02 * RATE)); const f = Math.round(0.015 * RATE);
  for (let i = Math.max(lead, e - f); i < e; i++) s[i] = Math.round(s[i] * (e - i) / f);
  return [lead, e];
};
const rec = async (page, what, secs, seed) => { const r = await page.evaluate(([w, s, z]) => window.__rec(w, s, z), [what, secs, seed]); if (r.nan) throw new Error('NaN в записи ' + what); return { ...r, pcm: Buffer.from(r.pcm, 'base64') }; };
const idx = { key, rate: RATE, enc: ENC || 'wav', music: {}, sfx: {}, amb: {}, bed: {}, step: {}, clash: [], fam: info.fam, names: info.names, files: [] };
// задания: у каждого своё зерно (по порядку, как бы ни делились по вкладкам); итог — в index.json в том же порядке
const jobs = [];
let seed = 1000;
const job = (fn) => { const z = ++seed; jobs.push(fn.bind(null, z)); };
const BEDV = 0.05;
// пьесы: одна запись сочинения каждой
for (const m of info.moods) job(async (z, page, put, set) => {
  const len = await page.evaluate(([mm, s]) => window.__len(mm, s), [m, z]);
  if (!(len > 5)) throw new Error('длина пьесы ' + m + ': ' + len);
  const r = await rec(page, m, Math.ceil(len * 10) / 10, z);
  let f = 'music/' + m + '.wav'; fs.writeFileSync(path.join(out, f), wav(r.pcm));
  if (ENC) { const o = f.replace('.wav', '.ogg'); ogg(path.join(out, f), path.join(out, o)); fs.rmSync(path.join(out, f)); f = o; }
  put(f); set('music', m, { f, len: +len.toFixed(2), peak: r.peak, rms: r.rms, g: info.g[m] });
  if (process.env.SND_LOG) console.log('  ' + m + ' ' + len.toFixed(1) + ' с, пик ' + r.peak + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
});
for (const s of info.sfx) job(async (z, page, put, set) => {
  const r = await rec(page, s, s === 'bell' || s === 'defeat' || s === 'choir' ? 9 : 5, z), [a, b] = trim(r.pcm);
  put('sfx/' + s + '.wav', wav(r.pcm, a, b)); set('sfx', s, { len: +((b - a) / RATE).toFixed(3), peak: r.peak });
});
for (const s of info.amb) job(async (z, page, put, set) => {
  const r = await rec(page, s, s === 'bell' ? 13 : 7, z), [a, b] = trim(r.pcm);
  put('amb/' + s + '.wav', wav(r.pcm, a, b)); set('amb', s, { len: +((b - a) / RATE).toFixed(3), peak: r.peak });
});
// шумы-петли (громкость записи v; в игре — доля от неё): шум HTML — буфер 2 с по кругу, поэтому после 4 с (эхо 2,8 с) запись
// периодична — берётся ровно один период
for (const k of ['wind', 'leaves', 'water', 'crowd', 'fire', 'room', 'surf', 'w:rain', 'w:wind']) job(async (z, page, put, set) => {
  const r = await rec(page, (k.startsWith('w:') ? k : 'bed:' + k) + '=' + BEDV, 6.2, z), nm = k.replace('w:', 'w_');
  put('bed/' + nm + '.wav', wav(r.pcm, 4 * RATE, 6 * RATE)); set('bed', nm, { v: BEDV, peak: r.peak, rms: r.rms });
});
job(async (z, page, put, set) => { const r = await rec(page, 'w:thunder', 7, z), [a, b] = trim(r.pcm); put('amb/thunder.wav', wav(r.pcm, a, b)); set('amb', 'thunder', { len: +((b - a) / RATE).toFixed(3), peak: r.peak }); });
job(async (z, page, put, set) => { const r = await rec(page, 'w:roar=' + BEDV, 6.2, z); put('bed/roar.wav', wav(r.pcm, 4 * RATE, 6 * RATE)); set('bed', 'roar', { v: BEDV, peak: r.peak, rms: r.rms }); });
// звуки боя (Snd.battleNoise): звон, удар, крик — по четыре записи каждого
for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) job(async (z, page, put, set) => { const r = await rec(page, 'w:clash=' + k, 1.5, z), [a, b] = trim(r.pcm), f = 'sfx/clash' + k + i + '.wav'; put(f, wav(r.pcm, a, b)); });
// шаги: шесть шагов по 0,18 с (stepAt, громкость 0,06) — четыре первых, каждый отдельно
for (const sf of ['stone', 'wood', 'grass', 'leaves', 'dirt', 'snow', 'mud', 'water', 'straw']) job(async (z, page, put, set) => {
  const r = await rec(page, 'step:' + sf, 1.4, z), st = Math.round(0.18 * RATE);
  for (let i = 0; i < 4; i++) { const a = Math.round((0.05 + i * 0.18) * RATE) - 40; put('step/' + sf + i + '.wav', wav(r.pcm, a, a + st)); }
  set('step', sf, { n: 4, v: 0.06, peak: r.peak });
});
const done = jobs.map(() => []), ent = jobs.map(() => []);
let next = 0;
await Promise.all(pages.map(async page => {
  while (next < jobs.length) {
    const i = next++;
    await jobs[i](page, (rel, buf) => { if (buf) fs.writeFileSync(path.join(out, rel), buf); done[i].push(rel); }, (k, n, v) => ent[i].push([k, n, v]));
  }
}));
// index.json — в порядке заданий (вкладки кончают в разном порядке)
idx.files = done.flat();
idx.clash = idx.files.filter(f => f.startsWith('sfx/clash'));
for (const [k, n, v] of ent.flat()) idx[k][n] = v;
fs.writeFileSync(idxF, JSON.stringify(idx));
await browser.close();
const mus = Object.values(idx.music), tot = mus.reduce((a, m) => a + m.len, 0);
console.log(`звук: пьес ${mus.length} (${(tot / 60).toFixed(1)} мин, громче всех ${Math.max(...mus.map(m => m.peak))}), звуков ${Object.keys(idx.sfx).length}, голосов мест ${Object.keys(idx.amb).length}, шумов ${Object.keys(idx.bed).length}, шагов ${Object.keys(idx.step).length}×4 — ${idx.files.length} файлов, ${(idx.files.reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0) / 1048576).toFixed(1)} МБ, ${((Date.now() - t0) / 1000).toFixed(0)} с, вкладок ${JOBS}` + (errs.length ? '; ошибки страницы: ' + errs.slice(0, 3).join(' | ') : ''));
