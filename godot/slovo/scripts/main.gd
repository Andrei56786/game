extends Node
# Корень: заставка → двор ↔ карта королевства (Tab). Без экрана: -- --selftest (двор живёт сутки, королевство — восемь дней
# с походами ИИ, проверки, выход с кодом). В веб-сборке — window.slovo('команда') для скриншот-тестов: court, title, map, help, time 21,
# day 30 (вперёд; королевство догонит), days 3, speed 2, goto 0, talk, next, close, walk 1 0 0.5, state; на карте — cam x y z,
# zoom 1, mode pol, sett Имя, army lord, hover x y, reveal, dump over, lum, state.
const Title = preload("res://scripts/title.gd")
const Court = preload("res://scripts/court.gd")
const MapView = preload("res://scripts/world/map_view.gd")
var cur: Node
var court: Node            # двор живёт, пока смотрят карту
var mapv: Node             # экран карты (камера и режим сохраняются)
var gpu: MapGPU            # карта на GPU: готовится один раз при первом открытии
var js_cb

func _ready() -> void:
	if "--selftest" in OS.get_cmdline_user_args():
		_selftest.call_deferred()
		return
	show_title()
	if OS.has_feature("web"):
		js_cb = JavaScriptBridge.create_callback(_js_cmd)
		JavaScriptBridge.get_interface("window").slovo = js_cb
	print("READY ", Game.VERSION, " · ", Engine.get_version_info().string)

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
	if mapv == null:
		mapv = MapView.new()
		mapv.G = gpu
		mapv.leave.connect(back_to_court)
	elif gpu.ok:
		mapv.center_capital()
	_set_cur(mapv)
	print("MAP")

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
			Game.set_speed(int(p[1]))
		"day":
			# календарь не уходит назад от дня королевства: вперёд — королевство догонит, день за днём
			Game.day = maxi(maxi(0, int(p[1])), -1 if Sim.G.is_empty() else int(Sim.G.day))
		"days":
			Game.day += maxi(0, int(p[1]))
		_:
			if cur and cur.has_method("cmd"):
				cur.cmd(p)

func _selftest() -> void:
	Game.sim_run = false      # дни королевства здесь считаются явно
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.selftest()
	var sok: bool = await _sim_selftest()
	ok = sok and ok
	print("SELFTEST OK" if ok else "SELFTEST FAIL")
	get_tree().quit(0 if ok else 1)

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
		for k in Game.STEPS:
			SimArmy.substep(1.0 / Game.STEPS)
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

func _pos_sum() -> float:
	var s := 0.0
	for a: Dictionary in Sim.G.armies:
		s = s + a.x * 7 + a.y * 13
	return s
