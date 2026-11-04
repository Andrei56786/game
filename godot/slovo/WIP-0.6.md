# Срез 0.6 «Армии» — незавершённая работа (передача в новый чат)

Ветка `godot-0.6-armies` (WIP, без PR, CI не запускался). Основа — `main` = `ed9c7bd` (0.5 влит).
Тема среза: войска на карте — пути, походы, снабжение, ИИ держав, знаки и лазутчики. 0.7 — бои, 0.8 — двор и звук.

## Что сделано (в этой ветке)
- `tools/sim_export.mjs` — эталон HTML: `pageQuick` (бой «на счётах»), `pageStep(dd)` (advanceArmy всем живым + aiContacts),
  `pageDay` (день как SimDay.dailyTick, но с `for r<5 aiRealm(r)` и `aiArmy` для `G.armies.slice()` (alive, kind≠'player')),
  `pageRef` (24 шага на сутки, в сводке дня `pos` = Σ(a.x·7 + a.y·13) по G.armies после 24 шагов, до pageDay).
  Переменные: SIM_DAYS (84), SIM_STEPS (24), SIM_SNAPS=all, SIM_SEED (777). Прогон ~9 с.
- `scripts/sim/js.gd` — `JS.isIdx(k)`, `JS.oset(d, k, v)`: запись по правилам объекта JS (ключи-индексы по возрастанию впереди).
- `scripts/sim/sim_army.gd` (SimArmy, ~980 строк, **ещё ни разу не компилировался**): цены клеток, A*, planPath/setPath,
  advanceArmy (+переправы), осады (startSiege с чучелами, siegeDaily, granSiegeFeed + granS), surrenderChance, captureSett
  (+летопись, onCapture), retreatArmy, бой quickRun/autoBattle/autoBattleGarrison (≡ pageQuick), aiContacts, substep(dd),
  reignInit/RST/chron, слова fmt/voin/armyLabel. Ссылается на SimAI: aiArriveSett, banditLoot, dlog, aiSiegeDecision,
  caravanLoot, cmdBattle.
- `scripts/sim/sim_ai.gd` (SimAI) — **начат**: nv/_dec/_ge0, borderDist (bdPrep/pdist/bdist), realmPower (+belief),
  perceivedPower (+feign), threatsNear (+belief), _nearest, nearestOwnSett, lordCap, warScore, waterTileNear, goTo.

## Что осталось
1. **Дописать SimAI** (тексты сообщений — дословно из JS, они сверяются):
   - ai.js: `aiRealm(r)` (обёртка belief: r==0 → belDaily, knowDaily, deceitDaily; затем оригинал — набор, новый
     полководец, новое войско из столицы, экономия при долге, гарнизоны, война раз в 9 дней, мир раз в 7, wantFree — bool),
     `aiArmy` (обёртка deceit guard/feint → ядро; realm 0 lord при G.court → cmdArmyTick), aiArriveSett, aiSiegeDecision,
     aiBandit, banditLoot.
   - econ.js: aiCaravan, planTrip, safeSeat, caravanNews, caravanLoot, buyCost/sellGain (Симпсон: `n*(A+4B+C)/6*k`),
     caravanCap = (wagons||2)·400.
   - command.js: cmdArmyTick (обёртка deceit: cmd.o=='feint' → feintTick; иначе a.feint → feintEnd), cmdHunt, cmdNote,
     cmdBattle, noisy (council.js), mergeArmies, ordLabel.
   - diplo.js: declareWar = deceit(reign(diplo)), returnOccupied, makePeace (+reign), aiOfferPeace (+deceit), msg
     (id = G.nextId++), allyOf. UI.alert('war') → `SimDay.alerts.append({"k":"war","r":r})`, MAPDIRTY.pol → Sim.pol_dirty.
   - belief.js: belOf, dlog, courtSpyOf, insight, skept, skeptWord, genSkept, belObservers, belGuessTgt, belSee, belDaily,
     belPower, garSeen, know, knowDaily.
   - deceit.js: deceitSeen, feintEnd, feintStage, feintTick, eyeNote, belThreats, belReact, feintWatch, dummyDaily,
     lureDaily, aiTricks, lordsOf, nArm, armyWho, deceitDaily.
2. **Мелкие правки**: `SimArmy.RST()` без двора → `{}` (сейчас `{"st": {}}`), а `st.x += 1` в captureSett/declareWar/
   makePeace — через `nv` (на `{}` не падать); `SimEcon.econCaravans`: `inc[key] = {}` → `JS.oset(inc, key, {})`;
   `SimDay._dailyArmy` (~стр. 976): push_error про siegeDaily → `SimArmy.siegeDaily(a)`.
3. **SimDay.dailyTick**: после dailySett — `for r in 5: SimAI.aiRealm(r)`, затем `SimAI.aiArmy(a)` для копии G.armies
   (alive, kind ≠ 'player'), с паузами `due()`; до diploWeekly.
4. **tools/state_check.gd**: перед каждым днём 24× `SimArmy.substep(1.0/24)`, посчитать pos и сверить с dig, затем
   dailyTick. `--import` (новые class_name), прогон эталона, сверка, отладка расхождений; замер скорости (aiContacts —
   ~5000 пар × 24; если медленно — сетка).
5. **Game runner**: шаги по часам, плавное движение, на карте — походы, пути, осады, взятия (pol_dirty), призраки G.know.
6. (если успеть) приказы своим войскам через гонцов.
7. test_web.mjs, документация (godot/README, plan-v4, README, windows.yml), версия 0.6.0 (project.godot
   `config/version` и `Game.VERSION`), PR `godot-0.6-armies` → CI → squash-слияние.

## Тонкости (проверено при разборе JS)
- state_check сверяет ключи, их порядок и типы: порядок первых присваиваний (a.ai.goal/prey/h0/skip/target/guard/feint,
  a.notes, a.feint, a.hideD/fireD, G.bel → G.know → G.dlog → G.robbed) должен повторять JS. Числовые ключи (a.ai.skip,
  G.bel, B.a, B.react, B.plot, G.know, S.dumK, ECON.incoming) — только через `JS.oset`; удаление — `erase` (порядок цел).
- undefined в арифметике JS → NaN (`nv`), `x || 0` → `JS.n`. Например `S.pool.levy -= n` и `S.pool[t] -= u[t]` на
  отсутствующем ключе дают NaN; `G.day - a.ai.h0` без h0 → NaN (сравнения ложны).
- `!o.ally` при ally = 0 — истина (держава 0). `G.court.net` — ключи-строки "1"…"4".
- cmdNote: текст (с noisy → R.range) считается **до** проверки `a.notes[key] > G.day − 4`. Ключ 'battle' + день.
- Войска короны из newGame3: `cmd = {o:'hold', mode:'intent', t: столица, day:0}` — без x/y (в 'hold' нет похода к посту).
- `armyLabel(b).replace(/ \(.*\)$/, '')` — отрезать от первого « (», если строка кончается «)».
- Тождество словарей — `is_same`, не `==`. Путь — null или Array (пустой Array в JS истинен).
- borderDist в aiArmy: min манхэттенских расстояний до клеток провинций, где `G.setts[P.seat].ctrl == realm`, ≤254, иначе 255
  (уже в SimAI.bdist). groundOf по-прежнему — SimDay.borderDist (кольца).
- Скрипты `--script` не видят автозагрузку Game/Art: код симуляции не должен ссылаться на SimText/Game.

## Окружение (песочница Notion AI)
- Рабочая копия `/data/game`; `ln -sfn /vercel/sandbox/node_modules /data/game/node_modules`.
- Godot: `G=/data/tools/godot/Godot_v4.7.2-stable_linux.x86_64` (задавать в каждой команде). Шаблоны экспорта:
  `/data/tools/godot/tpl/4.7.2.stable` (при «No export template found» — `ln -sfn /data/tools/godot/tpl ~/.local/share/godot/export_templates`).
- Проверки: `GODOT=$G sh godot/slovo/build.sh test` (SELFTEST OK, WORLD CHECK OK, STATE CHECK OK);
  эталон `node godot/slovo/tools/sim_export.mjs`; веб — `--export-release "Web"` и `node godot/slovo/test_web.mjs` (~3,5 мин).
- GitHub: коммит → `python3 tools/ghpush.py -b <ветка>` → push_files из /tmp/ghpush/NN.json → PR → CI (test ~6 мин,
  Electron ~3,5, Godot ~7,5) → squash. CI идёт только на main и на PR.
