extends Node
# Графика и данные двора, выгруженные из HTML-версии (tools/export.mjs → res://art/):
# атлас спрайтов, фоны мест по сезонам, пиксельные шрифты, места, двери, огни, люди, животные.
var D: Dictionary = {}
var ok := false
var pages: Array[Texture2D] = []
var font_m: Font
var font_s: Font
var parch: Texture2D
var light_tex: Texture2D     # как lightSpr в HTML: радиальный градиент 64×64 (1 → 0.6 → 0.18 → 0)
var white: Texture2D
var title_bg: Texture2D
# текст как txt/tw в HTML: по умолчанию книжный шрифт Slovo Serif (m 10, s 7.5 → 8: у Godot размер целый),
# знаки, которых в нём нет, — пиксельные; крупные надписи (sc ≥ 2) и выбор «Шрифт: пиксельный» — пиксельным шрифтом
const VFS := {"m": 10, "s": 8}
const VPIX := "→←↑↓▶▸▼■✓✗✝✉♥"
const CFG := "user://slovo.cfg"
var book: Font
var pixfont := false
var autopause := true          # OPTS.autoPause: время само встаёт на паузу (дошли до цели, выехали из замка, после битвы)
var fullscreen := false        # во весь экран (F11 или Alt+Enter, в меню — «Во весь экран»): выбор помнится до следующего запуска
var _win_mode := DisplayServer.WINDOW_MODE_WINDOWED   # каким было окно до полного экрана (развёрнутое вернётся развёрнутым)

func _ready() -> void:
	var p := "res://art/court.json"
	if not FileAccess.file_exists(p):
		push_error("нет res://art/court.json — запустите node godot/slovo/tools/export.mjs")
		return
	D = JSON.parse_string(FileAccess.get_file_as_string(p))
	for i in int(D["pages"]):
		pages.append(load("res://art/spr%d.png" % i))
	font_m = load("res://art/font_m.fnt")
	font_s = load("res://art/font_s.fnt")
	parch = load("res://art/ui_parch.png")
	title_bg = load("res://art/title_bg.png")
	book = Game.font
	var cf := ConfigFile.new()
	if cf.load(CFG) == OK:
		pixfont = bool(cf.get_value("ui", "pixfont", false))
		autopause = bool(cf.get_value("ui", "autopause", true))
		fullscreen = bool(cf.get_value("ui", "fullscreen", false))
	if fullscreen and not OS.has_feature("web"):
		_apply_fs.call_deferred(true)
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.3, 0.65, 1.0])
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.6), Color(1, 1, 1, 0.18), Color(1, 1, 1, 0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.width = 64
	gt.height = 64
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	light_tex = gt
	var im := Image.create(2, 2, false, Image.FORMAT_RGBA8)
	im.fill(Color(1, 1, 1))
	white = ImageTexture.create_from_image(im)
	ok = true

func page(i: int) -> Texture2D:
	return pages[int(D["spr"][i][0])]

func rect(i: int) -> Rect2:
	var r: Array = D["spr"][i]
	return Rect2(r[1], r[2], r[3], r[4])

func size(i: int) -> Vector2:
	var r: Array = D["spr"][i]
	return Vector2(r[3], r[4])

# спрайт из атласа: левый верхний угол в (0,0) относительно позиции
func sprite(i: int) -> Sprite2D:
	var s := Sprite2D.new()
	s.centered = false
	s.region_enabled = true
	set_frame(s, i)
	return s

func set_frame(s: Sprite2D, i: int, h: int = -1) -> void:
	s.texture = page(i)
	var r := rect(i)
	if h >= 0:
		r.size.y = h
	s.region_rect = r

func tex(i: int) -> AtlasTexture:
	var a := AtlasTexture.new()
	a.atlas = page(i)
	a.region = rect(i)
	return a

func loc(id: String) -> Dictionary:
	return D["locs"][id]

static func hexc(s: String, a: float = 1.0) -> Color:
	var c := Color.html(s)
	c.a = a
	return c

# ---------- текст ----------
func set_pixfont(on: bool) -> void:
	pixfont = on
	_opt("pixfont", on)

func set_autopause(on: bool) -> void:
	autopause = on
	_opt("autopause", on)

## во весь экран и обратно (как F11 в окне Electron); в вебе — только клавишами браузера
func is_fullscreen() -> bool:
	var m := DisplayServer.window_get_mode()
	return m == DisplayServer.WINDOW_MODE_FULLSCREEN or m == DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN

func set_fullscreen(on: bool) -> void:
	fullscreen = on
	_apply_fs(on)
	_opt("fullscreen", on)

func _apply_fs(on: bool) -> void:
	if DisplayServer.get_name() == "headless" or OS.has_feature("web") or on == is_fullscreen():
		return
	if on:
		_win_mode = DisplayServer.window_get_mode()
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED if _win_mode == DisplayServer.WINDOW_MODE_MAXIMIZED else DisplayServer.WINDOW_MODE_WINDOWED)

## F11 или Alt+Enter — во весь экран и обратно, на любом экране (до двора и карты клавиша не доходит)
func _input(e: InputEvent) -> void:
	var k := e as InputEventKey
	if k == null or not k.pressed or k.echo or OS.has_feature("web"):
		return
	if k.physical_keycode == KEY_F11 or (k.alt_pressed and (k.physical_keycode == KEY_ENTER or k.physical_keycode == KEY_KP_ENTER)):
		set_fullscreen(not is_fullscreen())
		get_viewport().set_input_as_handled()

func _opt(k: String, v: Variant) -> void:
	var cf := ConfigFile.new()
	cf.load(CFG)
	cf.set_value("ui", k, v)
	cf.save(CFG)

func pal(k: String) -> Color:
	return Color.html(String(D["pal"][k]))

func _pf(f: String) -> Font:
	return font_m if f == "m" else font_s

func _ph(f: String) -> int:
	return int(D["fonts"][f]["hgt"])

func _pcap(f: String) -> float:
	return float(D["fonts"][f]["cap"])

func _pw(s: String, f: String) -> float:
	return _pf(f).get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, _ph(f)).x

func _vw(s: String, f: String) -> float:
	return book.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, VFS[f]).x

func _runs(s: String) -> Array:
	var out: Array = []
	var cur := ""
	var pix := false
	for ch in s:
		var p := VPIX.contains(ch)
		if p != pix and cur != "":
			out.append([cur, pix])
			cur = ""
		pix = p
		cur += ch
	if cur != "":
		out.append([cur, pix])
	return out

func _vf(sc: float) -> bool:
	return not pixfont and sc < 2.0 and book != null

func tw(s: String, f: String = "m", sc: float = 1.0) -> float:
	if s == "":
		return 0.0
	if _vf(sc):
		var w := 0.0
		for r in _runs(s):
			w += _pw(r[0], f) if r[1] else _vw(r[0], f)
		return w
	return maxf(0.0, _pw(s, f) - 1.0) * sc

# y — верх заглавных букв, как в HTML; al: l | c | r; sh — цвет тени (на 1 точку ниже); возвращает x после текста
func txt(ci: CanvasItem, s: String, x: float, y: float, col: Color, f: String = "m", al: String = "l", sh = null, sc: float = 1.0) -> float:
	var w := tw(s, f, sc)
	if _vf(sc):
		if al == "c":
			x -= w / 2.0
		elif al == "r":
			x -= w
		x = roundf(x * 2.0) / 2.0
		y = roundf(y * 2.0) / 2.0
		var base: float = y + float(VFS[f]) * 0.7
		if sh != null:
			_vdraw(ci, s, x, base + 1.0, sh, f)
		_vdraw(ci, s, x, base, col, f)
		return x + w + 1.0
	if al == "c":
		x -= floorf(w / 2.0)
	elif al == "r":
		x -= w
	x = floorf(x)
	y = floorf(y)
	if sh != null:
		_pdraw(ci, s, x, y + sc, sh, f, sc)
	_pdraw(ci, s, x, y, col, f, sc)
	return x + w

func _vdraw(ci: CanvasItem, s: String, x: float, base: float, col: Color, f: String) -> void:
	for r in _runs(s):
		if r[1]:
			_pdraw(ci, r[0], x, base - _pcap(f), col, f, 1.0)
			x += _pw(r[0], f)
		else:
			ci.draw_string(book, Vector2(x, base), r[0], HORIZONTAL_ALIGNMENT_LEFT, -1, VFS[f], col)
			x += _vw(r[0], f)

func _pdraw(ci: CanvasItem, s: String, x: float, y: float, col: Color, f: String, sc: float) -> void:
	if sc == 1.0:
		ci.draw_string(_pf(f), Vector2(x, y + _pcap(f)), s, HORIZONTAL_ALIGNMENT_LEFT, -1, _ph(f), col)
		return
	ci.draw_set_transform(Vector2(x, y), 0.0, Vector2(sc, sc))
	ci.draw_string(_pf(f), Vector2(0, _pcap(f)), s, HORIZONTAL_ALIGNMENT_LEFT, -1, _ph(f), col)
	ci.draw_set_transform(Vector2.ZERO)

func wrap_text(s: String, maxw: float, f: String = "m") -> PackedStringArray:
	var out := PackedStringArray()
	for para in s.split("\n"):
		var cur := ""
		for wd in para.split(" "):
			var t2 := wd if cur == "" else cur + " " + wd
			if tw(t2, f) > maxw and cur != "":
				out.append(cur)
				cur = wd
			else:
				cur = t2
		out.append(cur)
	return out

# деревянная панель и кнопка, как panelWood и btn в HTML
func panel_wood(ci: CanvasItem, x: float, y: float, w: float, h: float) -> void:
	ci.draw_rect(Rect2(x, y, w, h), pal("o"))
	ci.draw_rect(Rect2(x + 1, y + 1, w - 2, h - 2), Color.html("#7a5030"))
	ci.draw_rect(Rect2(x + 2, y + 2, w - 4, h - 4), Color.html("#4a3020"))
	ci.draw_rect(Rect2(x + 3, y + 3, w - 6, h - 6), Color.html("#241610"))
	ci.draw_rect(Rect2(x + 3, y + 3, w - 6, 1), Color.html("#3a2618"))
	for c in [Vector2(x + 2, y + 2), Vector2(x + w - 4, y + 2), Vector2(x + 2, y + h - 4), Vector2(x + w - 4, y + h - 4)]:
		ci.draw_rect(Rect2(c, Vector2(2, 2)), Color.html("#c9a060"))
		ci.draw_rect(Rect2(c, Vector2(1, 1)), Color.html("#f0d890"))

func btn_wood(ci: CanvasItem, label: String, x: float, y: float, w: float, h: float, hv: bool) -> void:
	ci.draw_rect(Rect2(x, y, w, h), pal("o"))
	ci.draw_rect(Rect2(x + 1, y + 1, w - 2, h - 2), Color.html("#8a5a34") if hv else pal("T"))
	ci.draw_rect(Rect2(x + 1, y + 1, w - 2, 1), Color.html("#b07a4a") if hv else Color.html("#8a5a38"))
	ci.draw_rect(Rect2(x + 1, y + h - 2, w - 2, 1), Color.html("#3c2a20"))
	txt(ci, label, x + floorf(w / 2.0), y + floorf((h - 7.0) / 2.0), Color.html("#fff2c8") if hv else pal("w"), "m", "c", pal("o"))
