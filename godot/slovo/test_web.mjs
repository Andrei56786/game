// Проверка веб-сборки Godot в Chromium без окна: заставка, тронный зал и двор днём, в сумерках и ночью, разговор, ходьба, масштаб;
// карта королевства: вся, державы, куски у столицы, лето, осень и зима; время на карте: королевство догоняет календарь,
// на скорости 3 дни идут, казна меняется, весна в летописи, пауза; 0.6: войска идут по часам, походы ИИ, чужое войско вблизи.
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
    // карта королевства (Tab во дворе): вся карта, державы, куски полной детализации, вид года
    await cmd('day 0', 'speed 0', 'map');
    const mr = await until(/^MAP READY /, 150000);
    check(!!mr, 'карта королевства готова: ' + (mr || 'нет MAP READY за 2,5 минуты'));
    if (mr) {
      const mst = async () => { const n = logs.length; await cmd('state'); await wait(150); const l = logs.slice(n).find(x => x.startsWith('MAPSTATE ')); return l ? JSON.parse(l.slice(9)) : null; };
      const lum = async () => { const n = logs.length; await cmd('lum'); await wait(400); const l = logs.slice(n).find(x => x.startsWith('MAPLUM ')); return l ? +l.slice(7) : NaN; };
      const settle = async (ms = 60000) => { const t = Date.now(); let m = null; while (Date.now() - t < ms) { m = await mst(); if (m && m.vis.miss === 0 && m.vis.stale === 0) break; await wait(500); } await wait(300); return m; };
      await cmd('cam 4320 2700 0.125'); await wait(1500); await shot('map_kingdom');
      let m = await mst();
      check(m && m.ok && m.cam[2] === 0.125, 'вся карта (' + (m && JSON.stringify(m.ms)) + ' мс)');
      // 0.4: королевство посчитано (newGame3 + первый день экономики), туман войны, видимые войска
      const R = m && m.realm;
      check(R && R.fog && R.explored > 100000 && R.chars >= 100 && R.armies >= 50 && R.seen >= 4 && R.gold > 0 && R.net > 0 && (R.kinds.lord || 0) >= 1,
        'королевство: люди, войска, туман, казна (' + JSON.stringify(R) + ')');
      await cmd('mode pol'); await wait(1000); await shot('map_realms'); await cmd('mode ter');
      await cmd('capital', 'zoom 1', 'zoom 1', 'zoom 1'); m = await settle(); await shot('map_capital');
      check(m && m.cam[2] === 1 && m.vis.n >= 4 && m.vis.miss === 0 && m.chunks >= m.vis.n, 'у столицы, масштаб 1: куски нарисованы (' + (m && JSON.stringify(m.vis)) + ', ' + (m && m.cms) + ' мс на кусок)');
      check(m && m.sea.join() === '1,1,2', '1-й день: оттепель на севере и в середине, цветение на юге (' + (m && m.sea) + ')');
      check(m && m.realm.drawn >= 1, 'у столицы видны свои войска (' + (m && m.realm.drawn) + ')');
      await cmd('hover 30 9'); await wait(600); await shot('map_gold_tip');
      await cmd('hover 320 180'); m = await settle(); await shot('map_capital_tip');
      check(m && m.hover !== '', 'подсказка у столицы: ' + (m && m.hover));
      await cmd('hover -1 -1', 'army lord', 'zoom 1'); m = await settle(); await shot('map_army');
      check(m && m.cam[2] === 2 && m.realm.drawn >= 1, 'войско вблизи (' + (m && JSON.stringify(m.cam)) + ', нарисовано ' + (m && m.realm.drawn) + ')');
      await cmd('cam 4380 3046 0.25'); await wait(1500); await shot('map_fog');
      // середина королевства (тепло 0,54): лето → осень → зима, куски перекрашиваются (королевство тем временем догоняет календарь)
      await cmd('cam 4224 2688 1', 'day 30'); m = await settle(); const l0 = await lum(); await shot('map_summer');
      await cmd('day 50'); m = await settle(); await shot('map_autumn');
      check(m && m.sea.join() === '4,4,3', 'осень: золотая на севере и в середине, ранняя на юге (' + (m && m.sea) + ')');
      await cmd('zoom -1', 'zoom -1'); await wait(2000); await shot('map_autumn_far');
      await cmd('zoom 1', 'zoom 1', 'day 70'); m = await settle(); const l1 = await lum(); await shot('map_winter');
      check(m && m.sea.join() === '6,6,7' && l1 > l0 + 0.08 && m.nsea > 0, 'зима: снег (яркость ' + l0 + ' → ' + l1 + ', перекрашено кусков ' + (m && m.nsea) + '), на юге мягкая зима (' + (m && m.sea) + ')');
      // 0.5: время на карте — королевство догоняет календарь день за днём, на скорости 3 дни идут сами, весна — в летописи
      const tm = async (pred, ms = 150000) => { const t = Date.now(); let q = null; while (Date.now() - t < ms) { q = await mst(); if (q && pred(q.time)) break; await wait(400); } return q; };
      await cmd('day 83'); m = await tm(t => t.sim === 83 && !t.busy);
      const T0 = m && m.time, P0 = m && m.realm && m.realm.pos;
      check(T0 && T0.sim === 83 && T0.n >= 83, 'королевство догнало календарь: день ' + (T0 && T0.sim) + ', посчитано дней ' + (T0 && T0.n) + ', в среднем ' + (T0 && T0.avg) + ' мс на день (худший ' + (T0 && T0.max) + '), кадров в секунду ' + (T0 && T0.fps) + ', кадр ' + (T0 && T0.dt) + ' мс, из них на королевство до ' + (T0 && T0.b) + ' мс');
      const g0 = m && m.realm.gold; let lag = 0;
      await cmd('speed 3');
      m = await tm(t => { lag = Math.max(lag, t.day - t.sim); return t.sim >= 85 && !t.busy; });
      await shot('map_time');
      const T1 = m && m.time;
      check(T1 && T1.sim >= 85 && lag <= 1 && m.realm.gold !== g0, 'скорость 3: дни идут (день ' + (T1 && T1.day) + ', ' + (T1 && T1.clock) + '), королевство отстаёт не больше чем на день (' + lag + '), казна ' + g0 + ' → ' + (m && m.realm.gold) + ', погода ' + (m && m.realm.weather) + (T1 && T1.mudOn ? ', распутица' : ''));
      check(T1 && T1.feed >= 1 && T1.last.some(x => /весна/.test(x)), 'летопись: ' + (T1 && T1.last.join(' | ')));
      // 0.6: шаги движения по часам (24 на сутки), походы ИИ — войска сдвинулись, пути проложены
      const R1 = m && m.realm;
      check(T1 && T1.steps >= 24 * 85 && R1 && R1.march >= 3 && R1.paths >= 50 && R1.pos !== P0,
        'походы: шагов ' + (T1 && T1.steps) + ' (последний ' + (T1 && T1.step_ms) + ' мс), в походе ' + (R1 && R1.march) + ', в осаде ' + (R1 && R1.sieges) + ', путей ' + (R1 && R1.paths) + ' (' + (R1 && R1.path_ms) + ' мс на путь), войн ' + (R1 && R1.wars) + ', вестей о чужих войсках ' + (R1 && R1.know));
      await cmd('speed 0'); await wait(1200); const T2 = (await mst()).time; await wait(2500); m = await mst(); await shot('map_pause');
      check(m && m.time.speed === 0 && m.time.day === T2.day && m.time.clock === T2.clock, 'пауза: часы стоят (' + (m && m.time.clock) + ')');
      await cmd('reveal', 'army ai', 'zoom 1'); m = await settle(); await shot('map_ai_army');
      check(m && m.realm.drawn >= 1 && m.realm.kinds.lord_ai >= 1, 'чужое войско вблизи (вся карта открыта): ' + (m && JSON.stringify(m.realm.kinds)) + ', нарисовано ' + (m && m.realm.drawn));
      await cmd('speed 1', 'court'); await wait(1500);
      s = await state();
      check(s && s.loc === 'yard', 'назад ко двору: ' + (s && s.loc));
    }
    await cmd('title'); await wait(800);
  }
} catch (e) { check(false, 'исключение: ' + e); }
check(errs.length === 0, 'ошибок в консоли нет' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
await browser.close(); srv.close();
console.log(fails.length ? `Godot-веб: ${fails.length} провал(ов)` : 'Godot-веб: всё в порядке');
process.exit(fails.length ? 1 : 0);
