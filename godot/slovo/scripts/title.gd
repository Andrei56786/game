extends Control
# Заставка как в HTML (drawTitle): закат, замок на холме, горы и знамёна (фон — из HTML), плывущие облачка,
# пиксельное «СЛОВО КОРОЛЯ», деревянные кнопки. Мышь или ↑↓ + Enter; Esc — выход (в окне).
signal start
const W := 640.0
const H := 360.0
const SH := Color8(42, 16, 32)            # тень заголовков, #2a1020
var t := 0.0
var sel := 0
var help := false
var btns: Array = []                      # {id, label, r: Rect2}

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_layout()

func _layout() -> void:
	btns.clear()
	var y := 150.0
	var list := [["go", "Войти во двор"], ["help", "Управление"], ["font", "Шрифт: " + ("пиксельный" if Art.pixfont else "книжный")]]
	if not OS.has_feature("web"):
		list.append(["quit", "Выход"])
	for b in list:
		btns.append({"id": b[0], "label": b[1], "r": Rect2(W / 2.0 + 70.0, y, 170.0, 18.0)})
		y += 23.0

func _press(id: String) -> void:
	match id:
		"go":
			start.emit()
		"help":
			help = true
		"font":
			Art.set_pixfont(not Art.pixfont)
			_layout()
		"quit":
			get_tree().quit()

func cmd(p: PackedStringArray) -> void:
	if p[0] == "help":
		help = not help
	elif p[0] == "font":
		_press("font")

func _process(d: float) -> void:
	t += d
	queue_redraw()

func _hit(p: Vector2) -> int:
	for i in btns.size():
		if (btns[i]["r"] as Rect2).has_point(p):
			return i
	return -1

func _gui_input(e: InputEvent) -> void:
	if e is InputEventMouseMotion:
		var i := _hit(e.position)
		if i >= 0:
			sel = i
	elif e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
		if help:
			help = false
			return
		var i := _hit(e.position)
		if i >= 0:
			_press(btns[i]["id"])

func _unhandled_input(e: InputEvent) -> void:
	if not (e is InputEventKey and e.pressed and not e.echo):
		return
	if help:
		help = false
		return
	match e.keycode:
		KEY_UP, KEY_W:
			sel = (sel + btns.size() - 1) % btns.size()
		KEY_DOWN, KEY_S:
			sel = (sel + 1) % btns.size()
		KEY_ENTER, KEY_KP_ENTER, KEY_SPACE, KEY_E:
			_press(btns[sel]["id"])
		KEY_ESCAPE:
			if not OS.has_feature("web"):
				get_tree().quit()

func _draw() -> void:
	if Art.title_bg:
		draw_texture(Art.title_bg, Vector2.ZERO)
	else:
		draw_rect(Rect2(0, 0, W, H), Color8(60, 30, 50))
	for k in 6:   # облачка-полосы плывут по закатному небу
		var x := fmod(t * 6.0 + k * 120.0, W + 100.0) - 50.0
		draw_rect(Rect2(roundf(x), 60 + k * 14, 40 + k * 6, 2), Color(1.0, 0.878, 0.753, 0.25))
	Art.txt(self, "СЛОВО КОРОЛЯ", W / 2.0, 36, Art.pal("y"), "m", "c", SH, 4.0)
	Art.txt(self, "Двор и королевство", W / 2.0, 74, Color8(255, 242, 200), "m", "c", SH, 2.0)
	Art.txt(self, "срез «Двор» на Godot 4.7 · сборка " + Game.VERSION + " · замок, люди и свет — из HTML-версии", W / 2.0, 96, Color8(240, 216, 192), "m", "c", SH)
	for i in btns.size():
		var r: Rect2 = btns[i]["r"]
		Art.btn_wood(self, btns[i]["label"], r.position.x, r.position.y, r.size.x, r.size.y, i == sel and not help)
	Art.txt(self, "Вся графика нарисована кодом HTML-версии и перенесена в Godot как есть — без чужих ассетов.", W / 2.0, H - 12, Color8(200, 168, 160), "s", "c")
	if help:
		_help()

func _help() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.04, 0.03, 0.05, 0.5))
	var w := 340.0
	var h := 158.0
	var x := floorf((W - w) / 2.0)
	var y := floorf((H - h) / 2.0)
	Art.panel_wood(self, x, y, w, h)
	Art.txt(self, "Управление", x + w / 2.0, y + 8, Art.pal("y"), "m", "c", Art.pal("o"))
	var rows := [["WASD, стрелки", "идти; Shift — тихим шагом"], ["Мышь", "щелчок — идти туда или к человеку"], ["E, Enter", "говорить, сесть, сделать"],
		["Z, колесо", "масштаб: крупно или весь двор"], ["Пробел", "пауза"], ["1, 2, 3", "скорость времени"], ["H", "подсказка внизу экрана"], ["Esc", "на заставку"]]
	var yy := y + 26.0
	for r in rows:
		Art.txt(self, r[0], x + 16, yy, Art.pal("y"))
		Art.txt(self, r[1], x + 112, yy, Color8(232, 220, 192))
		yy += 14.0
	Art.txt(self, "любая клавиша или щелчок — закрыть", x + w / 2.0, y + h - 13, Color8(154, 138, 112), "s", "c")
