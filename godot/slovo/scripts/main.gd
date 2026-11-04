extends Node
# Корень: заставка → двор ↔ карта королевства (Tab). Без экрана: -- --selftest (двор живёт сутки, королевство — восемь дней
# с походами ИИ, проверки, выход с кодом). В веб-сборке — window.slovo('команда') для скриншот-тестов: court, title, map, help, time 21,
# day 30 (вперёд; королевство догонит), days 3, speed 2, goto 0, talk, next, close, walk 1 0 0.5, state; на карте — cam x y z,
# zoom 1, mode pol, sett Имя, army lord, hover x y, reveal, dump over, lum, state; battle — бой на экране: войско короны против
# ближайшего врага (на поле — fight, speed 4, ov, sel C, order adv, win, flee, end, cam x y, state).
const Title = preload("res://scripts/title.gd")
const Court = preload("res://scripts/court.gd")
const MapView = preload("res://scripts/world/map_view.gd")
const BView = preload("res://scripts/battle/bview.gd")
const MapUI = preload("res://scripts/world/map_ui.gd")
var cur: Node
var court: Node            # двор живёт, пока смотрят карту
var mapv: Node             # экран карты (камера и режим сохраняются)
var gpu: MapGPU            # карта на GPU: готовится один раз при первом открытии
var bview: Node            # экран боя, пока идёт бой
var js_cb

func _ready() -> void:
	if "--selftest" in OS.get_cmdline_user_args():
		_selftest.call_deferred()
		return
	if "--council" in OS.get_cmdline_user_args():   # только совет (быстро): -- --council
		_council_only.call_deferred()
		return
	_hooks()
	show_title()
	if OS.has_feature("web"):
		js_cb = JavaScriptBridge.create_callback(_js_cmd)
		JavaScriptBridge.get_interface("window").slovo = js_cb
	print("READY ", Game.VERSION, " · ", Engine.get_version_info().string)

## окна текущего экрана (двор или карта): разговоры королевства — туда
func cur_ui() -> Variant:
	if court != null and cur == court:
		return court.hud
	if mapv != null and cur == mapv:
		return mapv.ui
	return null

## слова королевства на экране (DLG.say и say в HTML): ответ советника на поручение — над его головой (если он здесь;
## иначе — строкой), весть о смерти короля — разговором, «Как назовёте?» при рождении — разговором с выбором имени
func _hooks() -> void:
	SimCourt.say_hook = func(k: String, line: String) -> bool:
		if court == null or cur != court:
			return false
		var n: Dictionary = court.npc_by("seat_" + k)
		if n.is_empty():
			return false
		if n["loc"] == court.loc_id and not n["away"]:
			court.people.say(n, line, 4.0)
		else:
			court.hud.toast(SimDyn.seatName(k) + ": «" + line + "»")
		return true
	SimDyn.say_hook = func(k: Variant, text: String) -> void:
		if k == null:
			var u: Variant = cur_ui()
			if u != null:
				u.say(null, text)
		elif court != null and cur == court:
			var n: Dictionary = court.npc_by(String(k))
			if not n.is_empty() and n["loc"] == court.loc_id and not n["away"]:
				court.people.say(n, text, 4.0)
	SimDyn.birth_hook = func(text: String, opts: Array, mk: Callable) -> void:
		var u: Variant = cur_ui()
		if u == null:
			mk.call(String(opts[0]))
			return
		var ch: Array = []
		for nm in opts:
			ch.append({"t": String(nm), "fx": func(): mk.call(String(nm))})
		u.say(null, text, {"name": "Рождение", "choices": ch, "esc": 0})

func _set_cur(n: Node) -> void:
	if cur == n:
		return
	if cur:
		if cur == court or cur == mapv:
			remove_child(cur)
		else:
			cur.queue_free()
	cur = n
	add_child(n)

func _drop_court() -> void:
	if court:
		if court.get_parent():
			court.get_parent().remove_child(court)
		court.queue_free()
		court = null

func show_title() -> void:
	var t: Node = Title.new()
	t.start.connect(show_court)
	_set_cur(t)
	_drop_court()

func show_court() -> void:
	var c: Node = Court.new()
	c.leave.connect(show_title)
	c.to_map.connect(show_map)
	c.ride_out.connect(_ride_out)
	_set_cur(c)
	_drop_court()
	court = c
	print("COURT")

## к столу карт (Tab во дворе): двор не закрывается, время при дворе стоит, пока открыта карта
func show_map() -> void:
	if gpu == null:
		gpu = MapGPU.new()
		gpu.name = "MapGPU"
		add_child(gpu)
		gpu.prepare()
	var first := mapv == null
	var pa: Variant = null if Sim.G.is_empty() else Sim.playerArmy()
	if pa == null:
		# вести, пока король сидел при дворе, — не окна карты (при дворе — свои)
		SimDay.alerts = []
		SimPlayer.toasts.clear()
	if first:
		mapv = MapView.new()
		mapv.G = gpu
		mapv.leave.connect(back_to_court)
	elif gpu.ok:
		if pa != null:
			mapv.center_army()
		else:
			mapv.center_capital()
	_set_cur(mapv)
	mapv.ui.court = court       # окна двора на карте (Малый совет, письма) знают о дворе
	if first:
		mapv.ui.battle.connect(show_battle)
		mapv.ui.to_court.connect(_to_court)
	print("MAP")

## король выезжает из замка (ворота или конюшня): войско короля — на карте, пауза «укажите путь»
func _ride_out(a: Variant) -> void:
	if Sim.G.is_empty():
		return
	SimPlayer.leaveCourt(a)
	show_map()
	mapv.ui.rode_out()
	print("RIDE OUT ", Sim.G.player.army, " ", Sim.armyMen(Sim.playerArmy()))

## король въехал в замок (enterCourt) или бежал ко двору (G.toCourt): двор — у ворот или у трона
func _to_court(spot: String) -> void:
	mapv.ui.modals.clear()
	mapv.ui.win = null
	mapv.ui.target = null
	SimPlayer.modal = false
	back_to_court()
	court.cmd(PackedStringArray(["spot", spot]))
	print("TO COURT ", spot)

## бой на экране (startBattle): A и Bs — стороны (SimCapt.sideFromArmy / sideFromGarrison), tile — клетка карты,
## o — {b, siege, works, sett, amb, tplA}. Шаг движения или день королевства, если считаются, сперва досчитываются.
func show_battle(A: Dictionary, Bs: Dictionary, tile: int, o: Dictionary = {}) -> void:
	while SimDay.busy or Game.stepping:
		await get_tree().process_frame
	var v: Control = BView.new()
	v.name = "Battle"
	_set_cur(v)
	v.setup(A, Bs, tile, o)
	v.finished.connect(_battle_done)
	bview = v
	print("BATTLE ", v.B.units.size())

## «На карту» после боя (endBattleScreen): карта и пауза (autoPause('Битва окончена'))
func _battle_done(res: Dictionary) -> void:
	bview = null
	show_map()
	mapv.ui.auto_pause("Битва окончена")
	print("BATTLE DONE ", res.get("win"))

## для проверок: войско игрока (или первое войско лорда его державы) и ближайший к нему враг (иначе — любое чужое войско)
func test_pair() -> Array:
	var G := Sim.G
	if G.is_empty():
		return []
	var A: Variant = Sim.playerArmy()
	if A == null:
		for a: Dictionary in G.armies:
			if JS.t(a.alive) and a.realm == G.player.realm and String(a.kind) == "lord" and Sim.armyMen(a) > 50:
				A = a
				break
	if A == null:
		return []
	var Bn: Variant = null
	var bd := INF
	for b: Dictionary in G.armies:
		if not JS.t(b.alive) or b == A or b.realm == A.realm or Sim.armyMen(b) < 20 or String(b.kind) == "caravan":
			continue
		var d := Vector2(b.x - A.x, b.y - A.y).length() + (0.0 if Sim.hostile(A.realm, b.realm) else 1000.0)
		if d < bd:
			bd = d
			Bn = b
	return [] if Bn == null else [A, Bn]

func test_battle() -> bool:
	var ab := test_pair()
	if ab.is_empty():
		print("BATTLE: нет войск")
		return false
	show_battle(SimCapt.sideFromArmy(ab[0]), SimCapt.sideFromArmy(ab[1]), Sim.armyTile(ab[0]), {"b": ab[1].id, "tplA": "std"})
	return true

func back_to_court() -> void:
	if court == null:
		show_court()
		return
	_set_cur(court)
	court.cam.make_current()
	print("COURT")

func _js_cmd(a: Array) -> void:
	var p: PackedStringArray = String(a[0]).split(" ") if a.size() > 0 else PackedStringArray([""])
	match p[0]:
		"court":
			if cur == mapv and court:
				back_to_court()
			else:
				show_court()
		"title":
			show_title()
		"map":
			if court == null:
				show_court()
			show_map()
		"time":
			Game.set_hour(float(p[1]))
		"speed":
			if bview and cur == bview:
				bview.cmd(p)
			else:
				Game.set_speed(int(p[1]))
		"day":
			# календарь не уходит назад от дня королевства: вперёд — королевство догонит, день за днём
			Game.day = maxi(maxi(0, int(p[1])), -1 if Sim.G.is_empty() else int(Sim.G.day))
		"days":
			Game.day += maxi(0, int(p[1]))
		"battle":
			if bview == null:
				test_battle()
		_:
			if cur and cur.has_method("cmd"):
				cur.cmd(p)

func _selftest() -> void:
	Game.sim_run = false      # дни королевства здесь считаются явно
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.selftest()
	remove_child(c)           # дальше — королевство без двора (окна двора не берут вести карты)
	c.queue_free()
	var sok: bool = await _sim_selftest()
	ok = sok and ok
	var pok: bool = await _player_selftest()
	ok = pok and ok
	var bok: bool = await _battle_selftest()
	ok = bok and ok
	var cok: bool = await _council_selftest()
	ok = cok and ok
	print("SELFTEST OK" if ok else "SELFTEST FAIL")
	get_tree().quit(0 if ok else 1)

func _council_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _council_selftest()
	print("COUNCIL OK" if ok else "COUNCIL FAIL")
	get_tree().quit(0 if ok else 1)

## совет при дворе на данных королевства (court.council_test)
func _council_selftest() -> bool:
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.council_test()
	remove_child(c)
	c.queue_free()
	return ok

## королевство без экрана: новая игра в мире из выгрузки, подсказки всех поселений и войск, обзор, казна
func _sim_selftest() -> bool:
	var w := WorldData.load_export("res://art")
	if w == null:
		print("SIM: нет мира")
		return false
	var t0 := Time.get_ticks_msec()
	Sim.start(w, Game.seed)
	var ms := Time.get_ticks_msec() - t0
	var G := Sim.G
	var n := 0
	for s: Dictionary in w.setts:
		n += SimText.settTip(s.id).size()
	for a: Dictionary in G.armies:
		n += SimText.armyTip(a).size()
	for t in range(0, WorldData.NT, 997):
		n += SimText.tileTip(t).length()
	var ex := (G.explored as PackedByteArray).count(1)
	var vis := (G.vis as PackedByteArray).count(2)
	var seen := 0
	for a: Dictionary in G.armies:
		if JS.t(a.alive) and SimIntel.armyVisible(a):
			seen += 1
	var bv := SimText.bar_vals()
	print("SIM: новая игра %d мс, людей %d, войск %d (видно %d), разведано %d клеток, видно %d, казна %.1f, доход %.2f (в выгрузке двора: %s и %s), строк подсказок %d" % [ms,
		G.chars.size(), G.armies.size(), seen, ex, vis, bv.gold, bv.net, str(Art.D.get("gold")), str(Art.D.get("net")), n])
	var ok: bool = G.chars.size() > 100 and G.armies.size() > 40 and G.setts.size() == w.setts.size() and ex > 1000 and ex < WorldData.NT and vis > 100 and seen > 0 and seen < G.armies.size()
	# казна та же, что в выгрузке двора (HTML, то же зерно): с доходом за прожитые при дворе дни
	var D: Dictionary = Art.D
	var dg := float(D.get("gold", 0)) + float(D.get("net", 0.0)) * maxi(0, Game.day - int(D.get("day", 0)))
	ok = ok and absf(bv.gold - dg) < 1.0 and absf(bv.net - float(D.get("net", 0.0))) < 0.01
	if not ok:
		print("SIM: проверка королевства не прошла")
	# время: неделя королевства сразу (как догонялка: 24 шага движения и день), восьмой день — как при игре: часы Game
	# ушли в новые сутки, шаги и день — по кадрам с малым бюджетом
	var g0: float = G.realms[0].gold
	var log0: int = G.log.size()
	var p0 := _pos_sum()
	var wk := {}
	var tu := Time.get_ticks_usec()
	for i in 7:
		SimDay.budget_us = 0
		for k in Game.STEPS:
			await SimArmy.substep(1.0 / Game.STEPS)
		await SimDay.dailyTick(0)
		wk[String(G.weather.k)] = true
	var ms7 := (Time.get_ticks_usec() - tu) / 7000.0
	var st0 := Game.steps_n
	Game.day = int(G.day) + 1
	Game.frac = 0.0
	Game.sim_run = true
	var fr := 0
	while (G.day < Game.day or SimDay.busy) and fr < 3000:
		await get_tree().process_frame
		fr += 1
	Game.sim_run = false
	var g1: float = G.realms[0].gold
	var march := 0
	var sieges := 0
	var kinds := {}
	for a: Dictionary in G.armies:
		if JS.t(a.alive) and a.path != null:
			march += 1
		if JS.t(a.alive) and a.siegeOf >= 0:
			sieges += 1
		kinds[String(a.kind)] = int(kinds.get(String(a.kind), 0)) + 1
	var moved := absf(_pos_sum() - p0)
	print("SIM: 8 дней — %.1f мс на день, восьмой день за %d кадров (шагов %d, день %d кадров, %.1f мс счёта), казна %.1f → %.1f, погода %s, записей летописи +%d" % [ms7,
		fr, Game.steps_n - st0, SimDay.frames, SimDay.ms_day, g0, g1, ",".join(wk.keys()), G.log.size() - log0])
	print("SIM: войска %s, в походе %d, в осаде %d, сдвиг Σ(7x+13y) %.0f, путей %d, призраков %d" % [str(kinds), march, sieges, moved, SimArmy.path_n, (G.get("know", {}) as Dictionary).size()])
	var tok: bool = G.day == 8.0 and not SimDay.busy and SimDay.frames > 1 and absf(g1 - g0) > 0.01 and G.weather.has("k") and Game.steps_n - st0 == Game.STEPS
	tok = tok and march > 3 and moved > 50 and SimArmy.path_n > 10 and kinds.get("caravan", 0) > 0
	if not tok:
		print("SIM: дни королевства не идут как надо")
	return ok and tok

## король в поле (leaveCourt … enterCourt) без экрана карты: выезд с войском столицы, путь и шаги движения, гонец к войску
## лорда короны и приказ по прибытии, встреча с врагом — окно и автобой (итог — окно bres), штурм без экрана, въезд в замок
func _player_selftest() -> bool:
	var G := Sim.G
	var ui: Control = MapUI.new()
	add_child(ui)
	SimDay.alerts = []
	SimPlayer.modal = false
	var a0: Variant = SimPlayer.capitalArmy()
	var m0 := Sim.armyMen(a0) if a0 != null else 0.0
	var pa: Dictionary = SimPlayer.leaveCourt(a0)
	var ok: bool = a0 != null and Sim.playerArmy() == pa and not JS.t(G.atCourt) and pa.kind == "player" and Sim.armyMen(pa) > m0
	# путь: проходимая клетка в 5–8 клетках от войска
	var tgt := -1
	var t0 := Sim.armyTile(pa)
	for r in range(5, 9):
		for k in 16:
			var t: int = t0 + roundi(cos(k * TAU / 16) * r) + roundi(sin(k * TAU / 16) * r) * WorldData.MW
			if tgt < 0 and t >= 0 and t < WorldData.NT and SimDay.passable(Sim.W.ter[t]) and SimArmy.planPath(pa, t) != null:
				tgt = t
	var mv_ok := tgt >= 0 and SimPlayer.orderMove(tgt)
	var x0: float = pa.x
	var y0: float = pa.y
	for k in 12:
		await SimArmy.substep(1.0 / Game.STEPS)
	var moved := Vector2(pa.x - x0, pa.y - y0).length()
	# гонец: приказ «Стоять» войску лорда короны вдали — едет, пока не доскачет
	var lord: Variant = null
	for a: Dictionary in SimPlayer.crownArmies():
		if Vector2(a.x - pa.x, a.y - pa.y).length() > 4.0:
			lord = a
			break
	var days := -1.0
	var nc := 0
	var steps := 0
	var got := false
	if lord != null:
		days = SimPlayer.sendOrder(lord, {"o": "hold", "t": -1.0, "mode": "order"})
		nc = (G.couriers as Array).size()
		while (G.couriers as Array).size() > 0 and steps < Game.STEPS * 20:
			await SimArmy.substep(1.0 / Game.STEPS)
			steps += 1
		got = lord.cmd is Dictionary and String(lord.cmd.o) == "hold" and not JS.t(lord.get("pend"))
	# встреча: шайка вплотную — окно «Встреча с врагом», автобой — окно итога
	var b: Variant = null
	for a: Dictionary in G.armies:
		if JS.t(a.alive) and a != pa and Sim.hostile(pa.realm, a.realm) and String(a.kind) != "caravan" and (b == null or Sim.armyMen(a) < Sim.armyMen(b)):
			b = a
	var enc_ok := false
	var bres: Variant = null
	if b != null:
		b.x = pa.x + 0.4
		b.y = pa.y
		G.encCool = {}
		SimPlayer.modal = false
		SimDay.alerts = []
		SimPlayer.checkEncounters()
		ui.tick()
		enc_ok = not ui.modals.is_empty() and String(ui.modals[0].k) == "enc" and SimPlayer.modal
		var mb := Sim.armyMen(b)
		var t1 := Time.get_ticks_msec()
		await ui.enc_auto(b, false)
		bres = ui.modals[0].d if not ui.modals.is_empty() and String(ui.modals[0].k) == "bres" else null
		print("PLAYER: встреча с %s (%d) — автобой %d мс, итог %s" % [SimArmy.armyLabel(b), roundi(mb), Time.get_ticks_msec() - t1, JSON.stringify(bres.sides) if bres != null else "нет"])
		if bres != null:
			ui.bres_ok(bres)
	# штурм без экрана: ближайшее чужое поселение; войны нет — объявлена для проверки
	var S: Variant = null
	for s: Dictionary in G.setts:
		if int(s.ctrl) != 0 and int(s.ctrl) < 5 and (S == null or Vector2(Sim.W.setts[int(s.id)].x - pa.x, Sim.W.setts[int(s.id)].y - pa.y).length() < Vector2(Sim.W.setts[int(S.id)].x - pa.x, Sim.W.setts[int(S.id)].y - pa.y).length()):
			S = s
	var as_ok := false
	if S != null:
		var r := int(S.ctrl)
		G.rel[0][r].war = 1.0
		G.rel[r][0].war = 1.0
		var ws: Dictionary = Sim.W.setts[int(S.id)]
		pa.x = ws.x + 0.5
		pa.y = ws.y + 0.5
		pa.path = null
		ui.siege_start(int(S.id))
		var sg: bool = pa.siegeOf == float(S.id)
		await ui.assault(int(S.id), false)
		var ar: Variant = ui.modals[0].d if not ui.modals.is_empty() and String(ui.modals[0].k) == "bres" else null
		as_ok = sg and ar is Dictionary and int(ar.get("sett", -1)) == int(S.id) and (not ar.win or int(S.ctrl) == 0)
		print("PLAYER: осада %s (%s), штурм — %s, поселение за %d" % [String(ws.name), str(sg), "взято" if ar != null and ar.win else "отбились", int(S.ctrl)])
		ui.modals.clear()
	SimPlayer.modal = false
	# въезд в замок: войско у стен под началом рыцаря, король — при дворе
	SimPlayer.enterCourt()
	var in_ok: bool = JS.t(G.atCourt) and Sim.playerArmy() == null or (Sim.playerArmy() != null and Sim.playerArmy().kind != "player")
	print("PLAYER: выезд с войском столицы (%d → %d чел.), путь %s, за 12 шагов %.2f кл., гонец (%d в пути, %.2f дн.) доскакал за %d шагов: %s, встреча — окно %s, итог %s, штурм %s, въезд %s" % [roundi(m0),
		roundi(Sim.armyMen(pa)), str(mv_ok), moved, nc, days, steps, str(got), str(enc_ok), str(bres != null), str(as_ok), str(in_ok)])
	ok = ok and mv_ok and moved > 0.3 and lord != null and nc == 1 and got and enc_ok and bres != null and as_ok and in_ok
	ui.queue_free()
	if not ok:
		print("PLAYER: король в поле — что-то не так")
	return ok

## бой на экране без экрана: войско короны против ближайшего врага — расстановка, бой на скорости 4 (кадры по 0,1 с),
## итог (applyBattle), «На карту»: потери в войсках, королевство снова идёт
func _battle_selftest() -> bool:
	var ab := test_pair()
	if ab.is_empty():
		print("BATTLE: нет войск для проверки")
		return false
	var A: Dictionary = ab[0]
	var Bn: Dictionary = ab[1]
	var m0 := [Sim.armyMen(A), Sim.armyMen(Bn)]
	var v: Control = BView.new()
	add_child(v)
	var t0 := Time.get_ticks_msec()
	v.setup(SimCapt.sideFromArmy(A), SimCapt.sideFromArmy(Bn), Sim.armyTile(A), {"b": Bn.id, "tplA": "std"})
	var res_box := []
	v.finished.connect(func(r): res_box.append(r))
	var ms_setup := Time.get_ticks_msec() - t0
	var n0: int = v.B.units.size()
	for i in 5:
		await get_tree().process_frame
	var hold0 := Game.hold
	v.cmd(PackedStringArray(["sel", "C"]))
	var sel0: int = v.B.sel.size()
	v.cmd(PackedStringArray(["fight"]))
	v.cmd(PackedStringArray(["speed", "4"]))
	var fr := 0
	t0 = Time.get_ticks_msec()
	while v.B.res == null and fr < 2400:
		await get_tree().process_frame
		fr += 1
		if fr == 1200 and v.B.over == null:
			v.cmd(PackedStringArray(["win"]))
	var st: Dictionary = v.state()
	print("BATTLE: %s (%d) против %s (%d): отрядов %d, расстановка %d мс, выбран полк %d отр., бой %.0f с за %d кадров (%d мс), итог %s, люди %s" % [String(A.get("name", A.kind)),
		roundi(m0[0]), String(Bn.get("name", Bn.kind)), roundi(m0[1]), n0, ms_setup, sel0, v.B.t, fr, Time.get_ticks_msec() - t0, JSON.stringify(v.B.over), str(st.men)])
	var ok: bool = n0 > 4 and hold0 and v.B.res != null and sel0 > 0
	if v.B.res != null:
		v.cmd(PackedStringArray(["end"]))
		await get_tree().process_frame
	var m1 := [Sim.armyMen(A), Sim.armyMen(Bn)]
	print("BATTLE: после боя люди %s → %s, королевство ждёт: %s, итог наружу: %s" % [str(m0.map(roundi)), str(m1.map(roundi)), str(Game.hold), str(res_box.size())])
	ok = ok and not Game.hold and res_box.size() == 1 and (m1[0] < m0[0] or m1[1] < m0[1])
	v.queue_free()
	if not ok:
		print("BATTLE: бой на экране не прошёл")
	return ok

func _pos_sum() -> float:
	var s := 0.0
	for a: Dictionary in Sim.G.armies:
		s = s + a.x * 7 + a.y * 13
	return s
