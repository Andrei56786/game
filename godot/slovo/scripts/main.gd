extends Node
# Корень: заставка → двор ↔ карта королевства (Tab). Без экрана: -- --selftest (двор живёт двое суток, проверки, выход с кодом).
# В веб-сборке — window.slovo('команда') для скриншот-тестов: court, title, map, help, time 21, day 30, speed 2, goto 0, talk, next,
# close, walk 1 0 0.5, state; на карте — cam x y z, zoom 1, mode pol, sett Имя, hover x y, dump over, lum, state.
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
			Game.speed = clampi(int(p[1]), 0, 3)
		"day":
			Game.day = maxi(0, int(p[1]))
		_:
			if cur and cur.has_method("cmd"):
				cur.cmd(p)

func _selftest() -> void:
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.selftest()
	print("SELFTEST OK" if ok else "SELFTEST FAIL")
	get_tree().quit(0 if ok else 1)
