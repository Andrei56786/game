extends "res://scripts/ui_kit.gd"
# Заставка как в HTML (drawTitle, drawNewGame, drawLoading): закат, замок на холме, горы и знамёна (фон — из HTML), плывущие
# облачка, пиксельное «СЛОВО КОРОЛЯ», деревянные кнопки: «Продолжить правление» (если есть сохранение), «Новая игра» (сложность,
# туман войны), управление, звук, шрифт; экран загрузки по шагам (runSteps: что делается, полоска, изречение). Мышь или ↑↓ +
# Enter; Esc — назад (на заставке в окне — выход).
signal act(k, opt)                        # "new" — новая игра (opt: diff, open), "load" — продолжить правление
const SH := Color8(42, 16, 32)            # тень заголовков, #2a1020
const QUOTES := ["«Война — великое дело для государства».", "«Знай врага и знай себя — и в ста битвах не будет опасности».",
	"«Война — это путь обмана».", "«Победоносное войско сначала побеждает, а потом ищет сражения»."]
var t := 0.0
var sel := 0
var scr := "title"                        # title, newgame, sound, loading
var newg := {"diff": 1, "open": false}    # NEWG: сложность и туман войны новой игры
var ld = null                             # экран загрузки: {steps: [что делается], i, err}
var keys: Array = []                      # кнопки по порядку (для ↑↓ и Enter): [id, Callable]

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	help = false

## экран загрузки (runSteps): шаги — подписи; main двигает ld.i и пишет ld.err
func begin_load(steps: Array) -> void:
	scr = "loading"
	help = false
	ld = {"steps": steps, "i": 0, "err": ""}

func _press(id: String) -> void:
	for k in keys:
		if k[0] == id:
			(k[1] as Callable).call({})
			return

func _key_list() -> Array:
	var L: Array = []
	if scr == "title":
		if Game.has_save() and Game.save_ok():
			L.append(["t_cont", func(_c): act.emit("load", {})])
		L.append(["t_new", func(_c): _open_new()])
		L.append(["t_help", func(_c): help = true])
		L.append(["t_snd", func(_c): scr = "sound"])
		L.append(["t_font", func(_c): Art.set_pixfont(not Art.pixfont)])
		if not OS.has_feature("web"):
			L.append(["t_quit", func(_c): get_tree().quit()])
	elif scr == "newgame":
		L.append(["ng_go", func(_c): act.emit("new", newg.duplicate())])
		L.append(["ng_back", func(_c): scr = "title"])
	return L

func _open_new() -> void:
	scr = "newgame"
	sel = 0

func cmd(p: PackedStringArray) -> void:
	match p[0]:
		"help":
			help = not help
		"font":
			Art.set_pixfont(not Art.pixfont)
		"newgame":
			_open_new()
			if p.size() > 2:
				newg.diff = clampi(int(p[2]), 0, 2)
			if p.size() > 3:
				newg.open = p[3] == "open"
			if p.size() > 1 and p[1] == "go":
				act.emit("new", newg.duplicate())
		"continue":
			if Game.has_save() and Game.save_ok():
				act.emit("load", {})
			else:
				print("NO SAVE")
		"snd":
			scr = "sound" if scr != "sound" else "title"
		"state":
			var h := SimSave.head(Game.save_path)
			print("STATE ", JSON.stringify({"screen": "title", "scr": scr, "has_save": Game.has_save(), "save_ok": Game.save_ok(), "save": h, "keys": keys.map(func(k): return k[0]),
				"load": ld if ld != null else {}}))

func _process(d: float) -> void:
	t += d
	queue_redraw()

func _gui_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and not e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
		if help:
			help = false
			return
		dispatch({"x": e.position.x, "y": e.position.y, "ux": e.position.x, "uy": e.position.y, "b": 0, "drag": false})

func _unhandled_input(e: InputEvent) -> void:
	if not (e is InputEventKey and e.pressed and not e.echo):
		return
	if help:
		help = false
		return
	if scr == "loading":
		if ld != null and ld.err != "" and e.keycode == KEY_ESCAPE:
			_back()
		return
	var n := keys.size()
	match e.keycode:
		KEY_UP, KEY_W:
			if n > 0:
				sel = (sel + n - 1) % n
		KEY_DOWN, KEY_S:
			if n > 0:
				sel = (sel + 1) % n
		KEY_ENTER, KEY_KP_ENTER, KEY_SPACE, KEY_E:
			if n > 0:
				_press(keys[clampi(sel, 0, n - 1)][0])
		KEY_ESCAPE:
			if scr != "title":
				scr = "title"
				sel = 0
			elif not OS.has_feature("web"):
				get_tree().quit()

func _back() -> void:
	ld = null
	scr = "title"
	sel = 0

func _draw() -> void:
	begin_hits()
	keys = _key_list()
	if Art.title_bg:
		draw_texture(Art.title_bg, Vector2.ZERO)
	else:
		draw_rect(Rect2(0, 0, W, H), Color8(60, 30, 50))
	if scr == "loading":
		_loading()
		end_hits()
		return
	for k in 6:   # облачка-полосы плывут по закатному небу
		var x := fmod(t * 6.0 + k * 120.0, W + 100.0) - 50.0
		draw_rect(Rect2(roundf(x), 60 + k * 14, 40 + k * 6, 2), Color(1.0, 0.878, 0.753, 0.25))
	Art.txt(self, "СЛОВО КОРОЛЯ", W / 2.0, 36, Art.pal("y"), "m", "c", SH, 4.0)
	Art.txt(self, "Двор и королевство", W / 2.0, 74, Color8(255, 242, 200), "m", "c", SH, 2.0)
	Art.txt(self, "пиксельная стратегия · правьте через людей: совет, лорды, рыцари · по трактату Сунь-цзы · Godot " + Game.VERSION, W / 2.0, 96, Color8(240, 216, 192), "m", "c", SH)
	if scr == "newgame":
		_newgame()
	else:
		_buttons()
	Art.txt(self, "Вся графика нарисована кодом HTML-версии и перенесена в Godot как есть — без чужих ассетов.", W / 2.0, H - 12, Color8(200, 168, 160), "s", "c")
	if help:
		_help()
	elif scr == "sound":
		snd_panel(func(): scr = "title")
	if not help:
		hover_tip()
	end_hits()

## кнопки заставки (drawTitle): «Продолжить правление» — если есть сохранение (нельзя — для другой карты мира)
func _buttons() -> void:
	var y := 150.0
	var L: Array = []
	if Game.has_save():
		var ok := Game.save_ok()
		L.append(["t_cont", "Продолжить правление", {} if ok else {"disabled": true, "tip": SimSave.OLDSAVE_TIP}])
	L.append(["t_new", "Новая игра", {}])
	L.append(["t_help", "Управление", {}])
	L.append(["t_snd", "Звук…", {}])
	L.append(["t_font", "Шрифт: " + ("пиксельный" if Art.pixfont else "книжный"), {"tip": ["Шрифт", "Книжный — гладкий и чёткий, легче читать. Пиксельный — как в старых играх."]}])
	if not OS.has_feature("web"):
		L.append(["t_quit", "Выход", {}])
	var ids: Array = keys.map(func(k): return k[0])
	for e: Array in L:
		var id: String = e[0]
		var o: Dictionary = (e[2] as Dictionary).duplicate()
		var ki := ids.find(id)
		o.label = e[1]
		o.style = "wood"
		o.active = ki >= 0 and ki == sel and scr == "title" and not help
		if ki >= 0:
			o.on = keys[ki][1]
		if btn(id, W / 2.0 + 70.0, y, 170, 18, o) and ki >= 0:
			sel = ki
		y += 23.0

## новая игра (drawNewGame): сложность, туман войны, мир; «Взойти на трон» и «Назад»
func _newgame() -> void:
	var X := W / 2.0 + 10.0
	var Y := 120.0
	var WW := 290.0
	var HH := 194.0
	panel_wood(X, Y, WW, HH)
	txt("Новая игра", X + WW / 2.0, Y + 8, Art.pal("y"), "m", "c", PO)
	var y := Y + 26.0
	var lab := cc("#c8b898")
	txt("Сложность:", X + 14, y + 3, lab)
	var DL := ["Лёгкая", "Обычная", "Тяжёлая"]
	for i in 3:
		btn("ng_d%d" % i, X + 90 + i * 64, y, 62, 14, {"label": DL[i], "active": int(newg.diff) == i, "on": func(_c): newg.diff = i})
	y += 20.0
	txt("Туман войны:", X + 14, y + 3, lab)
	btn("ng_o", X + 90, y, 190, 14, {"label": "Нет — карта открыта" if newg.open else "Да — мир надо разведать", "active": not newg.open, "on": func(_c): newg.open = not newg.open})
	y += 20.0
	txt("Мир №:", X + 14, y + 3, lab)
	txt(str(Game.seed), X + 90, y + 3, Art.pal("w"))
	txt("другие миры — в следующих сборках", X + 124, y + 4, cc("#9a8a70"), "s")
	y += 22.0
	para("Вы — король Марко. Вы правите не руками, а словом: через совет, знатные дома и рыцарей. Пять держав, шесть домов, вольные бароны и разбойники. Победа мечом (своя столица + две чужие) или словом (3 голоса на Совете короны).", X + 14, y, WW - 28, "#e8dcc0", "s", 9.0)
	var ids: Array = keys.map(func(k): return k[0])
	for e in [["ng_go", X + 14, 160.0, "Взойти на трон", "i_crown"], ["ng_back", X + 186, 90.0, "Назад", ""]]:
		var ki := ids.find(e[0])
		if btn(e[0], e[1], Y + HH - 30, e[2], 20, {"label": e[3], "ic": e[4], "active": ki == sel, "on": keys[ki][1]}):
			sel = ki

## экран загрузки (drawLoading): что делается, полоска, изречение; ошибка — текстом и «Назад»
func _loading() -> void:
	dim(0.55)
	Art.txt(self, "СЛОВО КОРОЛЯ", W / 2.0, 110, Art.pal("y"), "m", "c", SH, 3.0)
	if ld == null:
		return
	var n: int = maxi(1, (ld.steps as Array).size())
	var i: int = clampi(int(ld.i), 0, n - 1)
	txt(String(ld.steps[i]), W / 2.0, 170, Color8(255, 242, 200), "m", "c")
	bar(W / 2.0 - 100, 186, 200, 8, (float(ld.i) + 0.5) / n, "#e0a630")
	if String(ld.err) != "":
		para("Ошибка: " + String(ld.err).left(300), 40, 210, W - 80, "#ee7a6a", "s", 9.0)
		btn("ld_back", W / 2.0 - 45, 300, 90, 18, {"label": "Назад", "on": func(_c): _back()})
	else:
		txt(QUOTES[int(t / 4.0) % 4], W / 2.0, 230, cc("#e8d8b0"), "m", "c")

func _help() -> void:
	blocker()
	draw_rect(Rect2(0, 0, W, H), Color(0.04, 0.03, 0.05, 0.5))
	var w := 340.0
	var h := 158.0
	var x := floorf((W - w) / 2.0)
	var y := floorf((H - h) / 2.0)
	Art.panel_wood(self, x, y, w, h)
	Art.txt(self, "Управление", x + w / 2.0, y + 8, Art.pal("y"), "m", "c", Art.pal("o"))
	var rows := [["WASD, стрелки", "идти; Shift — тихим шагом"], ["Мышь", "щелчок — идти туда или к человеку"], ["E, Enter", "говорить, сесть, сделать"],
		["Z, колесо", "масштаб: крупно или весь двор"], ["Пробел", "пауза"], ["1, 2, 3", "скорость времени"], ["Tab", "карта королевства"], ["Esc", "меню: сохранить, загрузить, звук"]]
	var yy := y + 26.0
	for r in rows:
		Art.txt(self, r[0], x + 16, yy, Art.pal("y"))
		Art.txt(self, r[1], x + 112, yy, Color8(232, 220, 192))
		yy += 14.0
	Art.txt(self, "любая клавиша или щелчок — закрыть", x + w / 2.0, y + h - 13, Color8(154, 138, 112), "s", "c")
