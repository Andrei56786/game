// Проверка веб-сборки Godot в Chromium без окна: заставка, тронный зал и двор днём, в сумерках и ночью, разговор, ходьба, масштаб;
// карта королевства: вся, державы, куски у столицы, лето, осень и зима; время на карте: королевство догоняет календарь,
// на скорости 3 дни идут, казна меняется, весна в летописи, пауза; 0.6: войска идут по часам, походы ИИ, чужое войско вблизи;
// 0.7: король выезжает в поле, встреча с врагом, автобой и итог, бой на поле (расстановка, бой, итог) и снова карта.
// 0.8: двор на данных королевства — окна совета (K) и писем (L), срочный сбор: советники сходятся, король во главе стола, доклады;
// люди двора из королевства, приём прошений у трона. 0.9: жизнь замка — молитва и обедня в часовне, темница, пир в зале, стол
// зодчего и стройка, чучело и фонтан, сон в королевской постели (часы бегут до утра), турнир на ристалище (поединок короля),
// рана и лечение; меню (Esc) и окно «Звук»; сохранение из меню и по команде, страница
// заново — «Продолжить правление»: то же королевство до знака (отпечаток), тот же день и казна; выход в главное меню; новая игра
// (тяжёлая, без тумана войны) — двор у трона; автосохранение на седьмой день.
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
const lines = []; // строки проверок — и в build/shots/test_web.txt (вместе с консолью игры), чтобы провал в CI был виден в снимках
const check = (ok, what) => { const l = (ok ? 'ok   ' : 'FAIL ') + what; console.log(l); lines.push(l); if (!ok) { fails.push(what); if (process.env.GITHUB_ACTIONS) console.log('::error::' + what.replace(/%/g, '%25').replace(/\r?\n/g, '%0A').slice(0, 2000)); } };
const wait = ms => page.waitForTimeout(ms);
const until = async (re, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { const l = logs.find(x => re.test(x)); if (l) return l; await wait(200); } return null; };
const cmd = (...c) => page.evaluate(c => c.forEach(x => window.slovo(x)), c);
const state = async () => { const n = logs.length; await cmd('state'); await wait(100); const l = logs.slice(n).find(x => x.startsWith('STATE ')); return l ? JSON.parse(l.slice(6)) : null; };
const shot = n => page.screenshot({ path: path.join(out, n + '.png') });
const ks = async () => { const n = logs.length; await cmd('kstate'); await wait(150); const l = logs.slice(n).find(x => x.startsWith('KSTATE ')); return l ? JSON.parse(l.slice(7)) : null; };
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
    // 0.8: звук — записи синтеза HTML (snd/), пьеса по месту и часу, звуки окон и шумы места
    const sj = q => q && q.snd && JSON.stringify({ ok: q.snd.ok, enc: q.snd.enc, pieces: q.snd.pieces, fam: q.snd.fam, mood: q.snd.mood, started: q.snd.started, playing: q.snd.playing, sfx: q.snd.sfx, last: q.snd.last, beds: q.snd.beds });
    check(s && s.snd && s.snd.ok && s.snd.pieces >= 40 && s.snd.fam !== '' && s.snd.mood !== '' && s.snd.started >= 1, 'звук при дворе: ' + sj(s));
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
    check(s && s.snd && s.snd.fam === 'night' && s.snd.beds.wind > 0, 'ночью во дворе — ночная музыка и ветер: ' + sj(s));
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
      const ust = async () => { const n = logs.length; await cmd('ui state'); await wait(250); const l = logs.slice(n).find(x => x.startsWith('UISTATE ')); return l ? JSON.parse(l.slice(8)) : null; };
      // ховер, видимые куски и нарисованные войска считаются в кадре: после команды ждём пару новых кадров (в CI кадр бывает и по 0,5 с)
      const frames = async (k = 2, ms = 20000) => { const u0 = await ust(); const t = Date.now(); while (u0 && Date.now() - t < ms) { const u = await ust(); if (u && u.frame >= u0.frame + k) return; await wait(100); } };
      const settle = async (ms = 60000) => { await frames(); const t = Date.now(); let m = null; while (Date.now() - t < ms) { m = await mst(); if (m && m.vis.miss === 0 && m.vis.stale === 0) break; await wait(500); } await wait(300); return m; };
      await cmd('cam 4320 2700 0.125'); await wait(1500); await shot('map_kingdom');
      let m = await mst();
      check(m && m.ok && m.cam[2] === 0.125, 'вся карта (' + (m && JSON.stringify(m.ms)) + ' мс)');
      check(m && m.snd && ['map', 'map_w', 'war', 'night', 'camp', 'campaign', 'travel'].includes(m.snd.fam) && m.snd.screen === 'map' && m.snd.sfx >= 1, 'звук на карте: ' + sj(m));
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
      // открытая весть (зимой — Совет короны на 63-й день, войны, события) держит королевство, как UI.paused в HTML, — закрыть её
      const tm = async (pred, ms = 150000) => { const t = Date.now(); let q = null; while (Date.now() - t < ms) { q = await mst(); if (q && pred(q.time)) break; if (q && q.time.modal) await cmd('ui close'); await wait(400); } return q; };
      await cmd('day 83'); m = await tm(t => t.sim === 83 && !t.busy);
      const T0 = m && m.time, P0 = m && m.realm && m.realm.pos;
      check(T0 && T0.sim === 83 && T0.n >= 83, 'королевство догнало календарь: день ' + (T0 && T0.sim) + ', посчитано дней ' + (T0 && T0.n) + ', в среднем ' + (T0 && T0.avg) + ' мс на день (худший ' + (T0 && T0.max) + '), кадров в секунду ' + (T0 && T0.fps) + ', кадр ' + (T0 && T0.dt) + ' мс, из них на королевство до ' + (T0 && T0.b) + ' мс');
      const g0 = m && m.realm.gold; let lag = 0;
      await cmd('speed 3');
      m = await tm(t => { lag = Math.max(lag, t.day - t.sim); return t.sim >= 85 && !t.busy; });
      await shot('map_time');
      const T1 = m && m.time;
      check(T1 && T1.sim >= 85 && lag <= 1 && m.realm.gold !== g0, 'скорость 3: дни идут (день ' + (T1 && T1.day) + ', ' + (T1 && T1.clock) + '), королевство отстаёт не больше чем на день (' + lag + '), казна ' + g0 + ' → ' + (m && m.realm.gold) + ', погода ' + (m && m.realm.weather) + (T1 && T1.mudOn ? ', распутица' : ''));
      check(T1 && T1.feed >= 1 && (T1.spring >= 84 || T1.last.some(x => /весна/.test(x))), 'летопись: весна — день ' + (T1 && T1.spring) + '; ' + (T1 && T1.last.join(' | ')));
      // 0.6: шаги движения по часам (24 на сутки), походы ИИ — войска сдвинулись, пути проложены
      const R1 = m && m.realm;
      check(T1 && T1.steps >= 24 * 85 && R1 && R1.march >= 3 && R1.paths >= 50 && R1.pos !== P0,
        'походы: шагов ' + (T1 && T1.steps) + ' (последний ' + (T1 && T1.step_ms) + ' мс), в походе ' + (R1 && R1.march) + ', в осаде ' + (R1 && R1.sieges) + ', путей ' + (R1 && R1.paths) + ' (' + (R1 && R1.path_ms) + ' мс на путь), войн ' + (R1 && R1.wars) + ', вестей о чужих войсках ' + (R1 && R1.know));
      await cmd('speed 0'); await wait(1200); const T2 = (await mst()).time; await wait(2500); m = await mst(); await shot('map_pause');
      check(m && m.time.speed === 0 && m.time.day === T2.day && m.time.clock === T2.clock, 'пауза: часы стоят (' + (m && m.time.clock) + ')');
      // начатый день королевство досчитывает и на паузе (бои без экрана идут кусками по кадрам), а в конце дня обзор (computeVision)
      // снова закрывает карту туманом — поэтому «reveal» только когда королевство догнало календарь и ничего не считает
      await tm(t => !t.busy && t.sim >= t.day, 60000);
      await cmd('reveal', 'army ai', 'zoom 1'); m = await settle(); await shot('map_ai_army');
      check(m && m.realm.drawn >= 1 && m.realm.kinds.lord_ai >= 1, 'чужое войско вблизи (вся карта открыта): ' + (m && JSON.stringify(m.realm.kinds)) + ', нарисовано ' + (m && m.realm.drawn));
      // 0.7: король в поле — выезд со свитой; встреча с врагом — окно, автобой (бой без экрана) и итог; бой на поле — расстановка,
      // бой, итог, снова карта на паузе
      const uiw = async (pred, ms = 90000) => { const t = Date.now(); let q = null; while (Date.now() - t < ms) { q = await ust(); if (q && pred(q)) break; await wait(500); } return q; };
      const bst = async () => { const n = logs.length; await cmd('state'); await wait(250); const l = logs.slice(n).find(x => x.startsWith('BSTATE ')); return l ? JSON.parse(l.slice(7)) : null; };
      await cmd('rideout'); await wait(2500); let u = await ust(); await shot('map_rideout');
      check(u && u.pa && !u.atCourt && u.speed === 0, 'король выехал в поле со свитой: ' + JSON.stringify(u && u.pa));
      // вести королевства (зимой — Совет короны, войны, события) ждут в очереди UI.modals раньше встречи — как в HTML (UI.alert — в конец),
      // разговоры королевства (рождение — «Как назовёте?», вести династии) забирают щелчок; закрыть их, чтобы окно встречи было первым;
      // щёлкать — когда окно уже нарисовано (области щелчка — из прошлого кадра, а кадр в CI бывает и по секунде)
      const uis = q => q && (q.modals.join() + (q.dlg ? ' [разговор: ' + q.dlg_name + ']' : '') + (q.busy ? ' [' + q.busy + ']' : ''));
      const clear = async () => { let q = await ust(); for (let i = 0; i < 12 && q && (q.modals.length || q.dlg); i++) { await cmd(q.dlg && q.choices && q.choices.length ? 'choose 1' : 'ui close'); await wait(400); q = await ust(); } return q; };
      const encOpen = async () => { await clear(); await cmd('ui enc'); await wait(1500); await frames(2); return ust(); };
      u = await encOpen(); await shot('map_enc');
      check(u && u.modals[0] === 'enc' && !u.dlg, 'встреча с врагом — окно: ' + uis(u));
      const men0 = u && u.pa && u.pa.men;
      await cmd('click 430 210'); u = await uiw(q => q.busy === '' && q.modals[0] === 'bres'); await shot('map_bres');
      check(u && u.modals[0] === 'bres', 'автобой — итог боя: ' + uis(u) + ', войско ' + men0 + ' → ' + (u && u.pa && u.pa.men));
      await frames(2); await cmd('click 320 254'); await wait(800); u = await ust();
      check(u && u.modals.length === 0, '«Далее» — окно итога закрыто: ' + uis(u));
      await encOpen(); await cmd('click 210 210');
      const bt = await until(/^BATTLE \d/, 60000); await wait(2500); await shot('battle_setup');
      let b = await bst();
      check(!!bt && b && b.phase === 'deploy' && b.units > 2, 'бой на поле — расстановка: ' + (b && JSON.stringify({ phase: b.phase, units: b.units, men: b.men })));
      await cmd('fight', 'speed 4'); await wait(8000); b = await bst(); await shot('battle_fight');
      check(b && b.phase === 'fight' && b.t > 1, 'бой идёт: ' + (b && JSON.stringify({ phase: b.phase, t: b.t, men: b.men })));
      await cmd('win'); await wait(3000); b = await bst(); await shot('battle_result');
      check(b && b.res, 'итог боя: ' + (b && JSON.stringify(b.over)));
      await cmd('end'); const bd = await until(/^BATTLE DONE/, 30000); await wait(1500); u = await ust(); await shot('map_after_battle');
      check(!!bd && u && u.speed === 0 && u.pa, 'после боя — снова карта, пауза: ' + bd);
      // у ворот столицы: «Въехать в замок — ко двору» — король снова при дворе, у ворот
      await clear(); await cmd('ui gate'); await wait(1200); u = await ust(); await shot('map_gate');
      check(u && u.dlg && u.choices.length === 3, 'у ворот столицы — разговор: ' + (u && u.choices && u.choices.join(' | ')));
      await cmd('choose 1'); const tc = await until(/^TO COURT /, 20000); await wait(1500);
      await cmd('speed 1'); s = await state(); for (let i = 0; i < 20 && !(s && s.loc === 'yard'); i++) { await wait(500); s = await state(); } await shot('court_gate');
      check(!!tc && s && s.loc === 'yard', 'въехал в замок — ко двору: ' + tc + ', ' + (s && s.loc));
      // двор на данных королевства: окна совета и писем (K, L), срочный сбор — советники сходятся, король во главе стола
      await cmd('time 14', 'speed 0', 'win council'); await wait(1500); s = await state(); await shot('court_council');
      check(s && s.win === 'council', 'окно совета (K): ' + (s && s.win));
      await cmd('tab 3'); await wait(800); await shot('court_cand');
      await cmd('win letters'); await wait(800); s = await state(); await shot('court_letters');
      check(s && s.win === 'letters', 'окно писем (L): ' + (s && s.win));
      await cmd('close', 'council'); const ccall = await until(/^COUNCIL CALL [1-9]/, 10000); await wait(800); await shot('court_call');
      await cmd('choose 1', 'speed 3'); const cmeet = await until(/^COUNCIL MEETING /, 90000); await wait(1500); s = await state(); await shot('court_meeting');
      check(!!ccall && !!cmeet && s && s.talk && s.sit && s.loc === 'keep', 'срочный совет: ' + ccall + ' → ' + cmeet + ', ' + (s && JSON.stringify({ hour: s.hour, loc: s.loc, sit: s.sit, talk: s.talk })));
      for (let i = 0; i < 60 && s && s.talk && !s.choosing; i++) { await cmd('next'); await wait(60); s = await state(); }
      await shot('court_meeting_end'); check(s && s.choosing, 'доклады выслушаны — что прикажет государь: ' + (s && JSON.stringify({ talk: s.talk, choosing: s.choosing })));
      await cmd('choose 2'); await wait(600); s = await state();
      check(s && !s.talk && !s.win, 'совет распущен: ' + (s && JSON.stringify({ talk: s.talk, win: s.win })));
      // люди двора из королевства (семья, совет, слуги, узники); приём прошений: в 8:30 просители у ворот, король на троне —
      // подходят по одному, решение короля — в книге суда
      check(s && s.fam >= 1 && s.seats >= 5 && s.npcs >= 30, 'двор из королевства: ' + JSON.stringify(s && { npcs: s.npcs, fam: s.fam, seats: s.seats, pris: s.pris }));
      const after = async (n0, re, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const l = logs.slice(n0).find(x => re.test(x)); if (l) return l; await wait(200); } return null; };
      let n1 = logs.length;
      await cmd('time 8.4', 'speed 2'); const pet = await after(n1, /^PETITIONERS [1-9]/, 30000);
      await cmd('throne'); await wait(600); await shot('court_throne'); await cmd('close');
      const pd = await after(n1, /^PETITION /, 180000); await wait(800); s = await state();
      for (let i = 0; i < 10 && s && s.talk && !s.choosing; i++) { await cmd('next'); await wait(100); s = await state(); }
      await shot('court_petition');
      check(!!pet && !!pd && s && s.choosing && s.sit, 'приём у трона: ' + pet + ' → ' + pd + ', ' + (s && JSON.stringify({ hour: s.hour, pets: s.pets, choosing: s.choosing })));
      const v0 = s && s.verd; n1 = logs.length;
      await cmd('choose 1'); const vd = await after(n1, /^VERDICT king/, 5000); await wait(400); s = await state();
      check(!!vd && s && s.verd === v0 + 1 && s.by === 'king', 'решение короля — в книге суда: ' + vd + ' (решений ' + v0 + ' → ' + (s && s.verd) + ')');
      // 0.9: часовня — молитва у алтаря (выборы, искры), воскресная обедня (люди на скамьях), темница (тюремщик и узник)
      await cmd('speed 0', 'close', 'close'); await wait(300);
      await cmd('time 14', 'spot altar_front'); await wait(800); s = await state(); const al = s && s.label;
      n1 = logs.length; await cmd('act'); const alt = await after(n1, /^ALTAR \d/, 5000); await wait(300); s = await state();
      for (let i = 0; i < 10 && s && s.talk && !s.choosing; i++) { await cmd('next'); await wait(100); s = await state(); }
      const wi = s && s.ch ? s.ch.findIndex(t => t.startsWith('О мудрости')) : -1;
      n1 = logs.length; await cmd('choose ' + (wi + 1)); const pr = await after(n1, /^PRAYED/, 5000); await wait(600); s = await state(); await shot('chapel_pray');
      check(!!alt && wi >= 0 && !!pr && s && s.loc === 'chapel' && s.dlg === 'Молитва' && s.motes > 0, 'молитва у алтаря: «' + al + '», ' + alt + ', выборы ' + (wi >= 0) + ', ' + pr + ', искр ' + (s && s.motes));
      await cmd('close', 'close'); await wait(200); s = await state();
      const sun = s.day + (6 - s.day % 7 + 7) % 7 + (s.day % 7 === 6 && s.hour >= 8.5 ? 7 : 0);
      n1 = logs.length; await cmd('day ' + sun, 'time 8.6'); await wait(2500); await cmd('spot pew_k', 'act', 'speed 1');
      const mb = await after(n1, /^MASS BEGIN \d/, 60000); const ma = await after(n1, /^MASS ATTENDED/, 90000); await wait(800); s = await state(); await shot('chapel_mass');
      check(!!mb && !!ma && s && s.mass && s.loc === 'chapel' && s.pews >= 4, 'воскресная обедня (день ' + sun + '): ' + mb + ' → ' + ma + ', на скамьях ' + (s && s.pews) + ', «' + (s && s.label) + '»');
      await cmd('speed 1', 'close'); await wait(300); const pn = s ? s.pris : 0;
      // в полдень тюремщик сидит за своим столом (в 14 — бродит по темнице и может отойти от короля)
      // сначала время, потом подойти: после перевода часов тюремщик садится за стол не сразу
      await cmd('time 12'); await wait(1500); n1 = logs.length; await cmd('goto srv_jailer'); await wait(1200); await cmd('talk'); await wait(600); s = await state();
      const jl = logs.slice(n1).find(x => x.startsWith('JAILER ')); await shot('dungeon_jailer');
      if (pn > 0) {
        await cmd('choose 1'); const pz = await after(n1, /^PRISONER /, 5000); await wait(600); await shot('dungeon_prisoner');
        check(!!jl && !!pz, 'темница: тюремщик — ' + jl + ', узник — ' + pz);
      } else check(s && s.loc === 'dungeon' && s.talk && !jl, 'темница: тюремщик, камеры пусты (' + (s && s.dlg) + ')');
      await cmd('close', 'close'); await wait(200);
      // 0.9: пир (поручение сенешаля исполнено — сегодня пир): с 17:00 гости за столами, менестрель и ноты, блюда, музыка пира;
      // король во главе стола — три дела за пир; в 23:30 гости расходятся
      n1 = logs.length; await cmd('feast', 'time 16.97', 'spot throne_front', 'speed 1');
      const fb = await after(n1, /^FEAST BEGIN \d+/, 60000); await wait(300);   // часы идут: на паузе двор замирает — семья и совет не дошли бы до мест
      await cmd('spot hall_mid', 'pos 352 118'); await wait(1500); s = await state(); await shot('hall_feast');
      check(!!fb && s && s.feast && s.loc === 'hall' && s.guests >= 10 && s.minstrel && s.at_table >= 12 && s.conds >= 5 && String(s.label).startsWith('Пир:'),
        'пир начался: ' + fb + ', гостей ' + (s && s.guests) + ', за столами ' + (s && s.at_table) + ', блюд ' + (s && s.conds) + ', «' + (s && s.label) + '»');
      n1 = logs.length; await cmd('act'); const fm = await after(n1, /^FEAST MENU \d+/, 5000); await wait(300); await cmd('dlgall'); await wait(300); s = await state();
      await shot('hall_feast_menu');
      const ti = s && s.ch ? s.ch.findIndex(t => t.startsWith('Поднять кубок')) : -1;
      check(!!fm && s && s.sit && s.dlg === 'Пир' && ti >= 0 && s.ch.length === 7, 'король во главе стола: ' + fm + ', ' + JSON.stringify(s && s.ch));
      n1 = logs.length; await cmd('choose ' + (ti + 1)); await wait(500); s = await state();
      check(s && s.dlg === 'Пир' && s.talk, 'кубок за верную знать: ' + (s && s.dlg));
      await cmd('close', 'speed 1'); await wait(2500); s = await state(); await shot('hall_feast_notes');
      check(s && s.feast && s.notes > 0 && s.snd && s.snd.want === 'feast', 'пир идёт: ноты над менестрелем ' + (s && s.notes) + ', музыка «' + (s && s.snd && s.snd.want) + '»');
      n1 = logs.length; await cmd('time 23.48'); const fe = await after(n1, /^FEAST END/, 60000);
      // гости идут к двери зала (у дальних столов — с десяток секунд игры; при малом числе кадров в Chromium — дольше)
      for (let i = 0; i < 150 && s && s.guests > 0; i++) { await wait(500); s = await state(); }
      await cmd('speed 0'); await wait(200);
      check(!!fe && s && !s.feast && s.guests === 0 && s.conds === 0, 'пир окончен, гости ушли: ' + fe + ', гостей ' + (s && s.guests) + ', блюд ' + (s && s.conds));
      // 0.9: стол зодчего — окно «Замыслы и стройки»; заложить трибуны: мастера у стройки, леса и вывеска, клетки под трибунами
      // заняты; леса растут по ходу работ; мастер — дать на пиво; свернуть — всё как было
      await cmd('speed 0', 'close', 'time 9.5', 'gold 1500', 'spot architect'); await wait(800); s = await state(); const wl = s && s.label;
      n1 = logs.length; await cmd('act'); const wo = await after(n1, /^WORKS OPEN/, 5000); await wait(500); s = await state(); await shot('yard_works');
      check(!!wo && s && s.win === 'proj' && wl === 'Стол зодчего: замыслы и стройки', 'стол зодчего: «' + wl + '», окно «' + (s && s.win) + '»');
      await cmd('close', 'proj stands'); await wait(1000); s = await state(); const p1 = s && s.proj;
      check(p1 && p1.cur === 'stands' && p1.solid === true && p1.sites === 1 && s.crew === 2, 'заложены трибуны: ' + JSON.stringify(p1) + ', мастеров ' + (s && s.crew));
      await cmd('proj prog 0.5', 'pos 952 300'); await wait(1000); s = await state(); await shot('yard_site'); const p2 = s && s.proj;
      check(p2 && p2.prog === 0.5 && p1 && p2.drawn > p1.drawn, 'леса по ходу работ: ' + JSON.stringify(p2));
      await cmd('goto pjw0', 'talk'); await wait(600); await cmd('dlgall'); await wait(300); s = await state(); const cw = s && s.ch; await shot('yard_crew');
      await cmd('choose 1'); await wait(400); s = await state(); const p3 = s && s.proj;
      check(cw && cw.length === 2 && String(cw[0]).startsWith('Дать мастерам на пиво') && p2 && p3 && p3.prog > p2.prog, 'мастер стройки: ' + JSON.stringify(cw) + ', ход ' + (p2 && p2.prog) + ' → ' + (p3 && p3.prog));
      await cmd('close', 'close', 'proj stop'); await wait(1000); s = await state(); const p4 = s && s.proj;
      check(p4 && p4.cur === '' && p4.sites === 0 && p4.solid === undefined && s.crew === 0, 'стройка свёрнута: ' + JSON.stringify(p4) + ', мастеров ' + (s && s.crew));
      // 0.9: простые дела — чучело (раз в день шаг к Мечу короля), фонтан (монета — казна −1); постель: ночью три выбора,
      // «Лечь спать до утра» — король лежит, тьма, часы бегут (королевство догоняет); утром — «Доброе утро, государь.», встал
      n1 = logs.length; await cmd('close', 'pos 664 352', 'act dummy'); const dm = await after(n1, /^DUMMY /, 5000); await wait(400); s = await state(); await shot('yard_dummy');
      check(!!dm && s && ['Упражнение с мечом. Солдаты одобрительно гудят.', 'Рука крепнет: Меч короля +1'].includes(s.toast) && s.dir === 'up', 'чучело: ' + dm + ', «' + (s && s.toast) + '»');
      const fg0 = await ks(); await cmd('pos 696 212', 'act fountain'); await wait(400); s = await state(); const fch = s && s.ch;
      await cmd('choose 1'); await wait(400); const fg1 = await ks(); s = await state(); await shot('yard_fountain');
      check(fch && fch.length === 2 && fch[0] === 'Бросить монету (1 зол.)' && fg0 && fg1 && fg1.gold === fg0.gold - 1 && s && /^(Монета|Кто-то из служанок)/.test(s.toast),
        'фонтан: ' + JSON.stringify(fch) + ', казна ' + (fg0 && fg0.gold) + ' → ' + (fg1 && fg1.gold) + ', «' + (s && s.toast) + '»');
      await cmd('spot bed_king', 'time 22', 'speed 1'); await wait(800);
      n1 = logs.length; await cmd('act bed'); const bed1 = await after(n1, /^BED \d/, 5000); await wait(300); s = await state(); const bch = s && s.ch;
      n1 = logs.length; await cmd('choose 1'); const sl = await after(n1, /^SLEEP /, 5000); await wait(1500); s = await state(); await shot('keep_sleep');
      const sa = s && s.acts, ssit = s && s.sit;
      const wk = await after(n1, /^WOKE /, 120000); await wait(600); s = await state(); await shot('keep_morning');
      check(bed1 === 'BED 3' && bch && bch[0] === 'Лечь спать до утра' && !!sl && sa && sa.sleep && ssit && !!wk && (/^WOKE false \d+ 06:[234]0$/.test(wk) || /^WOKE true /.test(wk))
        && s && s.acts && !s.acts.sleep && !s.sit, 'сон до утра: ' + bed1 + ' ' + JSON.stringify(bch) + ', ' + sl + ', спит ' + (sa && sa.sleep) + ' → ' + wk + ', «' + (s && s.toast) + '»');
      // 0.9: турнир (трибуны готовы, сенешаль созвал рыцарей): с 10:00 — зрители на трибунах, герольд, музыка турнира, поединок
      // на виду; король выходит к барьеру сам — прицел, удар копьём; к 15:30 досчитаны все круги — награда победителю; в 16:00 —
      // конец, гости уходят. Рана короля: носилки, постель (лекарь), дни в постели, «рана затянулась» — король ходит медленнее
      const healFlow = async (n0, what) => {
        const hs = await after(n0, /^HEAL START tourney/, 30000); await wait(1500); let q = await state(); await shot('yard_litter');
        const h1 = q && q.heal;
        check(!!hs && h1 && h1.on && h1.sh === 'litter' && q.loc === 'yard' && q.hide && q.snd && q.snd.want === 'lament',
          what + ': носилки — ' + hs + ', ' + JSON.stringify(h1) + ', ' + (q && q.loc) + ', музыка «' + (q && q.snd && q.snd.want) + '»');
        await cmd('heal skip'); await wait(1500); q = await state(); await shot('keep_bed'); const h2 = q && q.heal, l2 = q && q.loc;
        await cmd('heal skip'); await wait(2500); q = await state(); await shot('keep_days'); const h3 = q && q.heal;
        const n2 = logs.length; await cmd('heal skip'); const he = await after(n2, /^HEAL END/, 120000); await wait(1000); q = await state(); await shot('keep_wound');
        const h4 = q && q.heal;
        check(h2 && h2.sh === 'bed' && l2 === 'keep' && h3 && h3.sh === 'days' && !!he && h4 && !h4.on && h4.wound >= 1 && q.loc === 'keep' && !q.hide,
          what + ': постель (' + (h2 && h2.sh) + ', ' + l2 + ') — дни (' + (h3 && h3.sh) + ') — ' + he + ', ' + JSON.stringify(h4) + ', скрыт ' + (q && q.hide));
      };
      await cmd('speed 0', 'close', 'spot lists_s', 'pos 990 404', 'time 9.5', 'tour'); await wait(800); s = await state(); const tl = s && s.label;
      n1 = logs.length; await cmd('time 9.97', 'speed 1'); const tb = await after(n1, /^TOUR BEGIN \d+/, 60000);
      await cmd('time 10.25'); await wait(2500); s = await state(); await shot('yard_tour'); const t1 = s && s.tour;
      check(tl === 'Ристалище: турнир начнётся в 10:00' && !!tb && t1 && t1.on && t1.b && t1.guests >= 2 && t1.stands >= 3 && s.xn >= 2 && s.mus === 'tourney',
        'турнир: «' + tl + '», ' + tb + ', ' + JSON.stringify(t1 && { b: t1.b, guests: t1.guests, stands: t1.stands }) + ', щитов ' + (s && s.xn) + ', музыка «' + (s && s.mus) + '»');
      const tb1 = await after(n1, /^BOUT 1 /, 120000); await wait(300);
      await cmd('act lists'); await wait(600); await cmd('dlgall'); await wait(300); s = await state(); await shot('yard_lists');
      check(!!tb1 && s && s.dlg === 'Турнир' && s.ch && s.ch.length === 4 && String(s.ch[0]).startsWith('Выйти на ристалище'), 'поединок на виду: ' + tb1 + ', ристалище — ' + (s && s.dlg) + ' ' + JSON.stringify(s && s.ch));
      n1 = logs.length; const nk = n1; await cmd('choose 1', 'close'); const kjs = await after(n1, /^JOUST /, 120000); await wait(1200); s = await state(); await shot('yard_joust');
      const kh = s && s.tour && s.tour.kj && s.hide;
      let aimed = false;
      for (let i = 0; i < 600; i++) { s = await state(); if (!s || !s.tour || !s.tour.kj) break;
        if (s.tour.ph === 'run' && !s.tour.lock) { if (!aimed) { await shot('yard_joust_aim'); aimed = true; } await cmd('kj lock 1'); }
        await wait(150); }
      const kje = await after(n1, /^JOUST END/, 60000); await wait(1500); s = await state(); await shot('yard_joust_end');
      check(!!kjs && kh && aimed && !!kje && s && s.dlg === 'Поединок' && !s.hide && ['win', 'lose', 'fall'].includes(s.tour.king),
        'король у барьера: ' + kjs + ', прицел ' + aimed + ', ' + kje + ' — «' + (s && s.dlg) + '», ' + (s && s.tour.king));
      await cmd('close'); await wait(1500); s = await state(); let healed = false;
      if (s && s.heal && (s.heal.on || s.heal.q)) {
        // выбит из седла и ранен — сразу носилки; турнир тем временем окончен — новый, только награда
        await healFlow(nk, 'рана на ристалище'); healed = true;
        await cmd('speed 0', 'spot lists_s', 'pos 990 404', 'time 9.5', 'tour', 'speed 1'); await wait(800);
      }
      // к 15:30 — вне двора: поединок на виду (если начался) не досматривают, все круги досчитаны сразу; в 16:00 — конец
      n1 = logs.length; await cmd('spot throne_front', 'time 15.6'); const b7 = await after(n1, /^BOUT 7 /, 60000);
      await cmd('speed 0', 'spot lists_s', 'pos 990 404'); await wait(1000); s = await state(); const t7 = s && s.tour;
      n1 = logs.length; await cmd('act lists'); const pa = await after(n1, /^PRIZE ASK/, 5000); await wait(400); await shot('yard_prize');
      await cmd('choose 2'); const pz = await after(n1, /^PRIZE 0/, 5000); await wait(500); await shot('yard_prize_done');
      check(!!b7 && t7 && t7.on && t7.champ >= 0 && t7.label === 'Турнир: вручить награду победителю' && !!pa && !!pz,
        'к 15:30 все круги досчитаны: ' + b7 + ', «' + (t7 && t7.label) + '», ' + pa + ' → ' + pz);
      await cmd('close'); await wait(300);
      n1 = logs.length; await cmd('time 16.02', 'speed 1'); const te0 = await after(n1, /^TOUR END/, 60000); await wait(800); s = await state(); const t8 = s && s.tour;
      check(te0 === 'TOUR END true' && t8 && !t8.on && t8.done && t8.prize && t8.guests === 0 && t8.stands === 0 && s.mus !== 'tourney',
        'турнир окончен: ' + te0 + ', ' + JSON.stringify(t8 && { done: t8.done, prize: t8.prize, guests: t8.guests, stands: t8.stands }) + ', музыка «' + (s && s.mus) + '»');
      if (!healed) { n1 = logs.length; await cmd('wound 2'); await healFlow(n1, 'рана (wound 2)'); }
      await cmd('speed 0', 'close'); await wait(300);
      // 0.9: больные при дворе (sick2.js): советник занемог лихорадкой — в постели, «болен: лихорадка»; у постели — четыре дела,
      // «Прислать лекаря» — лечение; лекарь — доклад и дела; король занемог — лекарь велит лечь, постель (щупает пульс), дни болезни,
      // встаёт — значок болезни или слабости. Без смертей от болезней (ill nodeath) — исход не зависит от случая
      await cmd('ill nodeath', 'time 12'); await wait(300);
      n1 = logs.length; await cmd('ill adv fever'); const il = await after(n1, /^ILL seat_\w+ fever bed=true/, 5000);
      const ak = il ? il.split(' ')[1] : '';
      await cmd('time 13.5', 'speed 1'); await wait(1500); await cmd('speed 0'); s = await state(); const lie0 = s && s.sick && s.sick.lie;
      n1 = logs.length; await cmd('goto ' + ak, 'talk'); const sv0 = await after(n1, /^SICKVISIT /, 5000); await wait(600); await cmd('dlgall'); await wait(300); s = await state();
      await shot('upper_sick_visit'); const vch = s && s.ch;
      n1 = logs.length; await cmd('choose 2'); const dp = await after(n1, /^DOCPATIENT fever /, 5000); await wait(500); s = await state(); await shot('upper_doc_patient');
      check(!!il && lie0 && lie0.includes(ak) && sv0 === 'SICKVISIT ' + ak && vch && vch.length === 4 && vch[0] === 'Пожелать скорейшего выздоровления' && !!dp && s && s.ch && s.ch.length >= 5
        && s.sick && s.sick.dspot === 'room_' + ak.slice(5), 'больной советник: ' + il + ', в постели ' + JSON.stringify(lie0) + ', ' + sv0 + ' ' + JSON.stringify(vch) + ' → ' + dp + ', лекарь к ' + (s && s.sick && s.sick.dspot));
      await cmd('close'); await wait(300);
      n1 = logs.length; await cmd('goto srv_doc', 'talk'); const dt0 = await after(n1, /^DOCTALK \d/, 5000); await wait(600); await cmd('dlgall'); await wait(300); s = await state(); await shot('court_doctor');
      check(!!dt0 && s && s.ch && s.ch[0] === 'Как лечишь больных?' && s.ch[s.ch.length - 1] === 'Ступай' && s.sick && s.sick.dn && s.sick.doc !== '',
        'лекарь двора ' + (s && s.sick && s.sick.doc) + ': ' + dt0 + ' ' + JSON.stringify(s && s.ch));
      await cmd('close'); await wait(300);
      n1 = logs.length; await cmd('ill k fever', 'speed 1'); const ip = await after(n1, /^ILL PROMPT fever [12]/, 15000); await wait(800); await cmd('dlgall'); await wait(300); s = await state(); await shot('court_ill_prompt');
      check(!!ip && s && s.ch && s.ch[0] === 'Лечь в постель' && s.sick && s.sick.ill === 'fever' && s.sick.bed && s.sick.asked,
        'король занемог: ' + ip + ' ' + JSON.stringify(s && s.ch) + ', ' + JSON.stringify(s && s.sick && { ill: s.sick.ill, bed: s.sick.bed, badge: s.sick.badge }));
      n1 = logs.length; await cmd('choose 1'); const hs2 = await after(n1, /^HEAL START ill /, 5000); await wait(2500); s = await state(); await shot('keep_sickbed');
      const hb = s && s.heal;
      check(!!hs2 && hb && hb.on && hb.sh === 'bed' && hb.from === 'ill' && /щупает пульс: «Лихорадка, государь\. Лежать дней \d+»\.$/.test(hb.cap) && s.sick.dhid && s.mus === 'sick',
        'король в постели: ' + hs2 + ', ' + JSON.stringify(hb) + ', лекарь с глаз ' + (s && s.sick && s.sick.dhid) + ', музыка «' + (s && s.mus) + '»');
      n1 = logs.length; await cmd('heal skip'); await wait(2500); s = await state(); await shot('keep_sickdays'); const hd = s && s.heal;
      await cmd('heal skip'); const he2 = await after(n1, /^HEAL END false/, 180000); await wait(1500); s = await state(); await shot('keep_sick_up');
      check(hd && hd.sh === 'days' && !!he2 && s && s.heal && !s.heal.on && s.sick && !s.sick.dhid && /^(Слабость|Лихорадка) · \d+ дн\.$/.test(s.sick.badge)
        && /^Король встаёт/.test(s.toast), 'дни болезни (' + (hd && hd.sh) + ') — ' + he2 + ', «' + (s && s.toast) + '», значок «' + (s && s.sick && s.sick.badge) + '»');
      await cmd('speed 0', 'close', 'ill nodeath 0'); await wait(300);
      // 0.9: меню и звук; сохранение — страница заново — «Продолжить правление»
      await cmd('speed 0', 'close'); await wait(400); await cmd('menu'); await wait(700); s = await state(); await shot('court_menu');
      check(s && s.win === 'menu', 'меню (Esc): ' + (s && s.win));
      await cmd('win sound'); await wait(700); s = await state(); await shot('court_sound');
      check(s && s.win === 'sound', 'окно «Звук»: ' + (s && s.win));
      await cmd('win sound'); await wait(300);
      n1 = logs.length; await cmd('menu save'); const sv = await after(n1, /^SAVED /, 30000);
      n1 = logs.length; await cmd('save'); const sdig = await after(n1, /^SAVE DIG [0-9a-f]{16} /, 30000);
      const k0 = await ks();
      check(!!sv && !!sdig && k0 && k0.save && k0.save.day === k0.day, 'сохранено: ' + sv + ' · ' + sdig + ' · ' + JSON.stringify(k0 && k0.save));
      await wait(2500);   // IndexedDB
      n1 = logs.length; await page.reload(); const rd = await after(n1, /^READY /, 90000); await wait(2000); await shot('title_continue');
      let ts = await state();
      check(!!rd && ts && ts.screen === 'title' && ts.has_save && ts.save_ok && ts.keys[0] === 't_cont', 'страница заново — «Продолжить правление»: ' + JSON.stringify(ts && { has: ts.has_save, ok: ts.save_ok, keys: ts.keys, save: ts.save }));
      n1 = logs.length; await cmd('continue'); const ld = await after(n1, /^LOADED /, 90000);
      const ldig = logs.slice(n1).find(x => x.startsWith('LOAD DIG ')); await wait(2000); const k1 = await ks(); await shot('court_loaded');
      const dg = l => l ? l.split(' ')[2] : '?';
      check(!!ld && dg(ldig) === dg(sdig) && k1 && k1.day === k0.day && k1.gold === k0.gold && k1.screen === 'court', 'загрузка — то же королевство: ' + ld + ', отпечаток ' + dg(ldig) + ' / ' + dg(sdig) + ', день ' + (k1 && k1.day) + ' / ' + k0.day + ', казна ' + (k1 && k1.gold) + ' / ' + k0.gold);
      n1 = logs.length; await cmd('menu exit'); const te = await after(n1, /^TITLE/, 30000); await wait(800);
      await cmd('newgame'); await wait(700); await shot('title_newgame');
      ts = await state();
      check(!!te && ts && ts.scr === 'newgame', 'выход в главное меню, новая игра — выбор: ' + (ts && ts.scr));
      n1 = logs.length; await cmd('newgame go 2 open'); const ng = await after(n1, /^NEW GAME 2 true/, 90000); await wait(2000);
      const k2 = await ks(); await shot('court_newgame');
      check(!!ng && k2 && k2.day === 0 && k2.diff === 2 && k2.mapOpen && k2.screen === 'court', 'новая игра (тяжёлая, без тумана): ' + JSON.stringify(k2 && { day: k2.day, diff: k2.diff, open: k2.mapOpen, screen: k2.screen }));
      n1 = logs.length; await cmd('speed 1', 'days 7'); const as = await after(n1, /^SAVED 7 /, 180000); await wait(500);
      const k3 = await ks();
      check(!!as && k3 && k3.save && k3.save.day === 7 && k3.save_kb < 400, 'автосохранение на седьмой день: ' + as + ' · ' + JSON.stringify(k3 && k3.save));
    }
    await cmd('title'); await wait(800);
  }
} catch (e) { check(false, 'исключение: ' + e); }
check(errs.length === 0, 'ошибок в консоли нет' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
try { fs.writeFileSync(path.join(out, 'test_web.txt'), lines.join('\n') + '\n\n--- ошибки консоли ---\n' + errs.join('\n') + '\n\n--- консоль игры ---\n' + logs.map(x => x.length > 2000 ? x.slice(0, 2000) + '…' : x).join('\n') + '\n'); } catch (e) { console.log('не записан test_web.txt: ' + e); }
await browser.close(); srv.close();
console.log(fails.length ? `Godot-веб: ${fails.length} провал(ов)` : 'Godot-веб: всё в порядке');
process.exit(fails.length ? 1 : 0);
