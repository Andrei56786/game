extends Node
# Корень: заставка ↔ двор. Без экрана: -- --selftest (двор живёт двое суток, проверки, выход с кодом).
# В веб-сборке — window.slovo('команда') для скриншот-тестов (court, title, time 21, speed 2, goto 0, talk, next, close, walk 1 0 0.5, state).
const Title = preload("res://scripts/title.gd")
const Court = preload("res://scripts/court.gd")
var cur: Node
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

func _swap(n: Node) -> void:
	if cur:
		cur.queue_free()
	cur = n
	add_child(n)

func show_title() -> void:
	var t: Node = Title.new()
	t.start.connect(show_court)
	_swap(t)

func show_court() -> void:
	var c: Node = Court.new()
	c.leave.connect(show_title)
	_swap(c)
	print("COURT")

func _js_cmd(a: Array) -> void:
	var p: PackedStringArray = String(a[0]).split(" ") if a.size() > 0 else PackedStringArray([""])
	match p[0]:
		"court":
			show_court()
		"title":
			show_title()
		"time":
			Game.minutes = float(p[1]) * 60.0
		"speed":
			Game.speed = clampi(int(p[1]), 0, 3)
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
