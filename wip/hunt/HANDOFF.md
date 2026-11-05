# «Слово короля» — передача работы (срез 0.9, королевская охота)

Отвечать по-русски, коротко. Агент Morning brief не трогать.

## Проект и правила
- Репозиторий: github.com/Andrei56786/game. HTML-эталон — `src/*.js`, сборка `dist/index.html`
  (порядок модулей: …FAUNA, FAUNA 2, …CASTLE 2, HUNT, HUNT 2, HURT, HUNT 3, … SICK, SICK2).
- Порт на Godot 4.7.2 — `godot/slovo`.
- Главный принцип: симуляция совпадает с HTML до знака. Каждый раз: самопроверка, state_check, веб-тест.
- Случайности двора (поведение людей и зверей, внешний вид) — `randf/randi`; в коде симуляции — `Sim.R`.
- Дни при дворе — `Game.day`.
- Работа идёт в ветке `godot-0.9-castle`, PR #17 (черновик) в `main`. Влить (squash) только после зелёного CI.
- WIP-черновики охоты лежат в ветке `godot-0.9-hunt-wip`, папка `wip/hunt/` (вне godot-проекта, CI не трогает).

## Окружение (песочница)
- Godot: `G=/data/tools/godot/Godot_v4.7.2-stable_linux.x86_64`. Клон: `/data/game`, git user «Slovo bot».
- Проверка синтаксиса (из `godot/slovo`):
  `$G --headless --path . -s tools/_chk.gd -- res://scripts/X.gd 2>&1 | grep -v "Could not resolve class\|Failed to compile depended" | grep -E "^CHK|Parse Error|at: GDScript"`
- Самопроверки: `$G --headless --path . -- --tour` (также `--feast --works --chapel --save --council --snd --acts --sick`).
  В main.gd: `if "--sick" in OS.get_cmdline_user_args(): _sick_only.call_deferred()` — добавить `--hunt` → `_hunt_only`.
- Полный тест: `sh build.sh test` (~6 мин).
- Выгрузка данных: `cd /data/game && node godot/slovo/tools/export.mjs && node godot/slovo/tools/sim_export.mjs`, затем `$G --headless --import --path .` (из godot/slovo).
- Веб-экспорт: `$G --headless --path . --export-release "Web" build/web/index.html`.
- Веб-тест: `cd /data/game && node godot/slovo/test_web.mjs > /data/logs/webN.log` (~22 мин, ждать «WEBTEST EXIT 0»).
- Пуш (MCP GitHub push_files): `python3 /data/push/mk.py "сообщение"` → push_files с `arguments_file_path=/data/push/01.json` (…02.json) →
  `git tag -f gh-synced HEAD` → сверить деревья. `watch.sh <run_id…>` — ждёт итогов CI.
  mk.py берёт файлы из коммита HEAD (не рабочую копию), ветка зашита `godot-0.9-castle`.

## Состояние GitHub
- `godot-0.9-castle` = 0c2a7de (= локальный ba96e77 «0.9: пауза двора и больные при дворе как в HTML»).
- PR #17 — черновик. Проверить CI по 0c2a7de (get_check_runs): Electron был success, test и Godot-срез — in_progress.
- Тело PR (`pr_body.md`) дополнить: дела двора, сон, пауза, болезни, затем охота.

## Охота — что сделано (НЕ закоммичено, см. wip.patch)
### tools/export.mjs
- Животные — все `COURT.ani` кроме дичи леса; FAUNA-виды: `o.c = faCol(a)`, листы `res.fauna["kind|coat"]` (11 кадров),
  `res.faBox["kind|col"]`, `o.clearings` (12 полян). **Выгрузку ещё НЕ запускали.**
### scripts/court.gd
- Удалён ANISP; `const HuntM = preload("res://scripts/court_hunt.gd")`, `var hnt: RefCounted`, `hnt = HuntM.new(self)` после sck (до загрузки зверей).
- `mk_ani`, `fa_pts` — обычные func (вызов `c.mk_ani` / `c.fa_pts`); FA_*, ter_at, fa_col, fa_frame, fa_sheet, fa_box,
  новые _animal/_update_animal; _sync_nodes освобождает узлы зверей не этого места; _ani_update пропускает game != 0;
  после загрузки `hnt.fauna("")`.
- ВНИМАНИЕ: court.gd ссылается на `court_hunt.gd`, которого в проекте ещё нет → не коммитить без него.
### scripts/court_hunt.gd (черновик = `court_hunt_draft.gd` = p1+…+p6, 2693 строки)
- p1–p5: константы, помощники, fauna, steer/move_to, повадки, бросок, гончие, спутники, split_move, шансы, выстрелы,
  сулицы, рогатина, сокол, kill, wpn_next, свой лук, стрелы, беды.
- p6: split_* (+_room_at, cl_name), why_hunt_not, act, comp_name, comp, start/_start_fade, hint/_hint0, hunter_talk,
  chatter, dusk, release, end_hunt (hurt.js → `c.heal.start({from:"hunt",HU})`; sick.js удар randf), _end_fade, abort,
  unrest_all, summary, sum2, door, key (Q/G/E), target, pick/_pick3, var hold_court, press(on_court), up(), click_hook(b),
  drawing(), face_aim(), update(dt) (hunt→hunt2→hurt downT/pend→hunt3 _upd3), state().
- Черновик ещё ни разу не проверялся парсером — первым делом склеить в `scripts/court_hunt.gd` и прогнать _chk.gd.

## Что осталось
### p7 — рисование (дописать в court_hunt.gd)
- `sync()` через `c.xnode`:
  - кровь HU.blood (под спрайтами, y=-1e5; цвета #7a1010/#9a1c1c, big-узор);
  - «!» над alert/charge (и без охоты; рамка PAL.o 3×7, #ff4030/#ffe060, y = a.y − h_box − h − 7);
  - HU.stuck (drawArrowPx dx/d*0.7, dy/d*0.4−0.5, 6); HU.fl (дуга min(14, dd*0.06));
  - сокол (fauna "falcon|", кадр 5 при kill, иначе 6+floor(t*12)%4, тень small); вспышка лука bowT<0.3;
  - HU.sj (drawJav + блик); HU.jf (дуга min(18, dd*0.12)); drawHeld (лук/сулица/рогатина — hunt2.js стр.139–147);
  - HU.ar (jav — drawJav 10, иначе стрела 7);
  - линия прицела/разброс/крест/стрела на тетиве/полоска натяга (hunt3.js CRENDER2) — z=1 (под светом lm_view z=50);
  - HU.sa (y = s.y + 2|0.5) и стрелы в тушах a.arw (y = a.y+0.2) — отдельные xnode по y;
  - лежащий король при downT (shadow + `Hurt.lying(nd, king.sheet, P.x, P.y−5, ±PI/2, yo)`, king.hide=true);
  - белая вспышка flash < 0.18 с (z=70, rgba(235,240,255,0.5*(1−t/0.18))).
- Освещение: в court._light amb × 1.8 при `t − hnt.flash < 0.25`.
- `draw_hud(u)`: уголки прицела вокруг HU.aim.a (цвет useF #a8d8ff / pike #ff9a6a / #f7d35c); huntPanel v3
  (hunt3.js стр.229–242: t1, Q и оружие, прицел haim (щелчок — C.huntAuto), splitWord hsplit, ветер, добыча;
  hit-зоны hpanel/hwpn/haim/hsplit/hwind с подсказками); нижняя строка (8, H−14); стрелка к ловчему при разделении
  (hunt3.js HUD_EXT; disc из engine.js: w=floor(sqrt(r²−y²+0.8r))).
- Примитивы: drawArrowPx, pxLine, drawJav (hunt.js 267, hunt2.js 127–128); округление floor(v+0.5).

### Интеграция в court.gd и др.
- do_act "kennel" → `if SimPlayer.ensure_sim(): hnt.act()`.
- talk_to0 после поворота: srv_hunter → `hnt.hunter_talk(n)`.
- go_through: `if hnt.door(d): return`.
- blocked(): + `float(king.get("downT",0)) > t`.
- _tick внутри run: `hnt.update(dt)` до _player_update; при downT — king.moving=false без _player_update;
  `_player_update(dt * (0.45 if hnt.drawing() else 1.0))`, затем `hnt.face_aim()`.
- nearest_target: `var he := hnt.target(); if not he.is_empty() and float(he.d) < bd: best = {"e": he}`.
- click(): в начале (до blocked) `if hnt.click_hook(0): return`; после trn.kj:
  `var pe := hnt.pick(w.x, w.y); if not pe.is_empty(): pe.go.call(); return`.
- _unhandled_input: ЛКМ нажатие → `hnt.press(not down_at.ui)`; отпускание → `hnt.up()`, затем как было;
  ПКМ (не hud.is_open) → `if not hnt.click_hook(2): path = []`.
- key(): после heal.on → `if hnt.key(k): return`.
- sync: `hnt.sync()` рядом с heal.sync().
- cmd "hunt" (start kind [comp], kill, end, hart, near kind, shoot, split, draw/loose, auto 0/1); state(): `"hunt": hnt.state()`.
- people.gd snap: `if JS.t(n.get("follow")): continue`; sched_target: не для follow.
- court_sick.gd _rounds: `or JS.t(dn.get("follow"))`.
- court_hurt.gd litter(): in_y = not o.HU and loc yard; если o.HU → `c.hnt.release(); c.hnt.HU = null; c.hnt.fauna(""); P.downT = 0`;
  end_(): P.downT = 0; после лога `if o.get("from") == "hunt" and o.get("HU") != null: c.hnt.summary(o.HU, "wound")`;
  heal.badge и sck.badge — не рисовать при `c.hnt.HU != null`.
- hud.gd court_layer: `C.hnt.draw_hud(self)` после trn.draw_hud; строку помощи не рисовать при охоте в лесу.
- main.gd: `--hunt`; test_web.mjs — раздел охоты; README и notes/plan-v4.md.
### Затем
- Выгрузка, импорт, синтаксис, все самопроверки, build.sh test, веб-тест.
- Коммит «0.9: звери как в HTML и королевская охота», пуш (mk.py), CI.

## План 0.9 после охоты
Трофеи/галерея (castle2.js galleryAct), герольд, снабженец, подслушивание, погода во дворе (drawCourtWeather),
следы на снегу и пар, советы (tips.js), обучение, экран конца игры, трактат «Болезни», подписи при наведении.
В конце: версия 0.9.0 (project.godot, Game.VERSION, README), снять черновик и влить PR #17 после зелёного CI.

## Справка по API порта
- c.npc_by(key)→{}; c.people.say(n,s,dur); c.people.real(n)→char|null; n.name = npc_title.
- c.hud.say(who|null, text, {name, choices:[{t,tip,fx,ok,why}], esc}); c.hud.toast; c.hud.is_open()/modal_open()/dlg_open().
- u.hit(x,y,w,h,{id,tip,on:func(c)}), u.hov(id), u.rect/stroke_r/txt(s,x,y,Color,"s")/tw(s,"s")/cc("#hex"|"rgba()")/pline.
- c.w2s(Vector2); c.xnode(k,y,f(nd),z), c.xnode_drop(prefix), c.xn.
- Art.page(i)/rect(i)/size(i), Art.D shadow/shadowBig/shadowSmall.
- Sim.glog; Sim.plural; SimCourt.prestige; SimDyn.projDone/famRole/seatName; SimSick.sickStart(c,k,why); SimPlayer.kingC()/ensure_sim().
- Hurt static: wound_king, hurt, wound_not, sick_not, walk_k, lying; c.heal.start/on/sh.
- c.go_loc, fade_to, snap_cam, near_free, find_path, room_name (текущее место), spots, parts, room, path (Array),
  on_arrive (Callable), fade, sneak, cam_tl, Z, t, king.
- Snd.sfx: bark, bow, draw, flap, growl, hit, horn, horn_low, horn_short, stick, swish, thud, click.

## Как продолжить в новом чате
1. Клонировать репо, `git checkout godot-0.9-castle`, применить `wip.patch` (`git apply wip.patch`).
2. Скопировать `court_hunt_draft.gd` → `godot/slovo/scripts/court_hunt.gd`.
3. Дописать p7 (рисование) и интеграцию по списку выше, затем все проверки и пуш.

## Файлы в этом архиве
- HANDOFF.md — эти заметки.
- court_hunt_draft.gd — склейка p1..p6 (будущий scripts/court_hunt.gd).
- drafts/p1..p6.gd — части по отдельности.
- wip.patch — незакоммиченные правки court.gd и tools/export.mjs (от ba96e77 / 0c2a7de).
- mk.py, watch.sh — скрипты пуша и ожидания CI; pr_body.md — тело PR #17.
- local_tools/ — локальные (в .gitignore) помощники из godot/slovo/tools: _chk.gd (проверка синтаксиса) и др.;
  положить обратно в godot/slovo/tools/.
