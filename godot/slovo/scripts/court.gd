extends Node2D
# Срез «Двор»: двор столицы 48×34 клетки — донжон, казармы, конюшня, колодец, сад, ристалище; король ходит (WASD / стрелки),
# слуги и придворные живут по распорядку (пути — AStarGrid2D), день и ночь, факелы и окна, разговоры (E), часы и скорость (Пробел, 1–3).
signal leave
const Pix = preload("res://scripts/pix.gd")
const TS := 16
const W := 48
const H := 34
enum { GRASS, PATH, SAND, WALL, BUILD, WELL, TREE, FLOWER }
var kind := PackedByteArray()
var astar := AStarGrid2D.new()
var world := Node2D.new()
var king := Sprite2D.new()
var kframes: Array = []
var kdir := 0
var kstep := 0.0
var npcs: Array[Dictionary] = []
var cm := CanvasModulate.new()
var lights: Array[Dictionary] = []
var glows: Array[Sprite2D] = []
var halos: Array[Sprite2D] = []
var halo_tex: Texture2D = Pix.radial(36)
var light_tex: Texture2D = Pix.radial(176)
var cam := Camera2D.new()
var hud := Label.new()
var hint := Label.new()
var dlg := PanelContainer.new()
var dlg_name := Label.new()
var dlg_text := Label.new()
var talking := -1
var line := 0
var lines: PackedStringArray = []
var t := 0.0
var walked := 0.0

# люди двора: имя, наряд, распорядок (час → место), речи
const PEOPLE := [
	{"name": "Сенешаль Освальд", "p": {"body": Color8(60, 110, 70), "hair": Color8(200, 200, 196), "legs": Color8(50, 40, 34)}, "home": "keep",
	 "plan": [[7, "keep"], [9, "well"], [12, "barracks"], [15, "stables"], [18, "keep"]],
	 "say": ["Государь, амбары полны на две луны, а страже пора платить жалованье.", "Совет соберётся, когда прикажете. Казначей уже точит перья.", "«Тот, кто знает, когда сражаться, а когда нет, — побеждает»."]},
	{"name": "Стражник Бран", "p": {"body": Color8(120, 124, 136), "hair": Color8(70, 50, 30), "legs": Color8(70, 60, 50), "hat": "helm"}, "home": "gate", "night": true,
	 "plan": [[6, "gate"], [8, "door"], [10, "gate"], [13, "door"], [16, "gate"], [19, "door"], [21, "gate"]],
	 "say": ["У ворот всё тихо, государь.", "Купцы говорят, на дорогах снова шалят разбойники.", "Ночью смотрю в оба: факелы горят до рассвета."]},
	{"name": "Служанка Эльза", "p": {"body": Color8(70, 96, 170), "hair": Color8(150, 90, 40), "dress": true, "hat": "veil"}, "home": "keep",
	 "plan": [[6, "well"], [8, "keep"], [11, "garden"], [14, "well"], [17, "keep"]],
	 "say": ["Воды натаскала, государь, — к обеду всё будет.", "В саду яблони зацвели. Королева любит там гулять.", "Повар просит соли: на рынке она подорожала."]},
	{"name": "Конюх Тобиас", "p": {"body": Color8(130, 90, 50), "hair": Color8(60, 40, 24), "hat": "hood"}, "home": "stables",
	 "plan": [[5, "stables"], [9, "yard"], [11, "stables"], [15, "well"], [17, "stables"]],
	 "say": ["Гнедой захромал, государь, но к охоте поправится.", "Овса до весны хватит, если не созывать знамёна.", "Кони чуют грозу раньше людей."]},
	{"name": "Ловчий Мартин", "p": {"body": Color8(84, 100, 50), "hair": Color8(110, 70, 36), "legs": Color8(80, 60, 40)}, "home": "barracks",
	 "plan": [[6, "yard"], [10, "gate"], [13, "yard"], [16, "garden"], [19, "barracks"]],
	 "say": ["В королевском лесу видели белого оленя!", "Гончие застоялись. Прикажете — к утру будет охота.", "Лук натягивают спиной, а не руками, государь."]},
]
var spots := {}

func _ready() -> void:
	_build_map()
	add_child(_backdrop())
	add_child(_ground())
	world.y_sort_enabled = true
	add_child(world)
	_props()
	kframes = Pix.frames({"body": Color8(150, 30, 40), "body2": Color8(110, 20, 30), "hair": Color8(120, 80, 40), "legs": Color8(50, 36, 30), "hat": "crown", "cape": Color8(120, 20, 34)})
	king.texture = kframes[0][0]
	king.centered = false
	king.offset = Vector2(-6, -19)
	king.position = _px(Vector2i(23, 12))
	world.add_child(king)
	_shadow(king)
	for i in PEOPLE.size():
		var d: Dictionary = PEOPLE[i]
		var fr := Pix.frames(d["p"])
		var s := Sprite2D.new()
		s.texture = fr[0][0]
		s.centered = false
		s.offset = Vector2(-6, -19)
		var home: Vector2i = spots[d["home"]]
		s.position = _px(home + Vector2i(i % 3 - 1, 1))
		world.add_child(s)
		_shadow(s)
		npcs.append({"s": s, "fr": fr, "i": i, "path": PackedVector2Array(), "pi": 0, "dir": 0, "step": 0.0, "goal": "", "inside": false, "walked": 0.0})
	cam.position_smoothing_enabled = true
	cam.position_smoothing_speed = 6.0
	cam.limit_left = 0
	cam.limit_top = -36
	cam.limit_right = W * TS
	cam.limit_bottom = H * TS
	king.add_child(cam)
	cm.color = Color(1, 1, 1)
	add_child(cm)
	_ui()
	_tick(0.0)

var shadow_tex: Texture2D = Pix.tex(PackedStringArray([".xxxxxxxx.", "xxxxxxxxxx", "xxxxxxxxxx", ".xxxxxxxx."]), {"x": Color(0.08, 0.06, 0.04, 0.3)})
func _shadow(on: Sprite2D) -> void:
	var sh := Sprite2D.new()
	sh.texture = shadow_tex
	sh.position = Vector2(0, 0)
	sh.show_behind_parent = true
	on.add_child(sh)

func _px(c: Vector2i) -> Vector2:
	return Vector2(c.x * TS + 8, c.y * TS + 12)

func _cell(p: Vector2) -> Vector2i:
	return Vector2i(clampi(int(p.x / TS), 0, W - 1), clampi(int((p.y - 2) / TS), 0, H - 1))

func _fill(x0: int, y0: int, w: int, h: int, k: int) -> void:
	for y in range(y0, y0 + h):
		for x in range(x0, x0 + w):
			kind[y * W + x] = k

func _k(x: int, y: int) -> int:
	if x < 0 or y < 0 or x >= W or y >= H:
		return WALL
	return kind[y * W + x]

func _build_map() -> void:
	kind.resize(W * H)
	kind.fill(GRASS)
	_fill(0, 0, W, 2, WALL)
	_fill(0, 0, 2, H, WALL)
	_fill(W - 2, 0, 2, H, WALL)
	_fill(0, H - 2, W, 2, WALL)
	_fill(22, H - 2, 4, 2, PATH)
	_fill(16, 2, 16, 8, BUILD)      # донжон
	_fill(3, 22, 8, 5, BUILD)       # казармы
	_fill(36, 22, 9, 5, BUILD)      # конюшня
	_fill(22, 10, 4, H - 12, PATH)  # дорога от ворот к донжону
	_fill(4, 18, 40, 2, PATH)       # поперечная дорога
	_fill(6, 20, 2, 2, PATH)
	_fill(40, 20, 2, 2, PATH)
	_fill(3, 11, 10, 5, SAND)       # ристалище
	_fill(12, 17, 2, 2, WELL)
	for i in 70:
		var x := 2 + int(Game.hash2(i, 11, 3) * (W - 4))
		var y := 2 + int(Game.hash2(i, 12, 3) * (H - 4))
		if _k(x, y) == GRASS and Game.hash2(i, 13, 3) < 0.7:
			kind[y * W + x] = FLOWER
	var trees := [[35, 11], [38, 12], [41, 11], [44, 13], [36, 15], [40, 15], [43, 16], [3, 4], [6, 3], [10, 5], [13, 3], [35, 4], [39, 6], [43, 4], [3, 29], [8, 30], [14, 29], [32, 29], [38, 30], [44, 28], [17, 24], [30, 24]]
	for p in trees:
		if _k(p[0], p[1]) == GRASS or _k(p[0], p[1]) == FLOWER:
			kind[p[1] * W + p[0]] = TREE
	spots = {"keep": Vector2i(23, 11), "door": Vector2i(24, 11), "gate": Vector2i(23, H - 3), "well": Vector2i(14, 19), "barracks": Vector2i(7, 28), "stables": Vector2i(41, 28), "garden": Vector2i(39, 13), "yard": Vector2i(8, 16)}
	astar.region = Rect2i(0, 0, W, H)
	astar.cell_size = Vector2(TS, TS)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	astar.update()
	for y in H:
		for x in W:
			if _solid(_k(x, y)):
				astar.set_point_solid(Vector2i(x, y), true)
			elif _k(x, y) == PATH:
				astar.set_point_weight_scale(Vector2i(x, y), 0.6)

func _solid(k: int) -> bool:
	return k == WALL or k == BUILD or k == WELL or k == TREE

# земля кусками 8×8 клеток: в Godot на одну картинку действует не больше 16 огней, а факелов и окон больше
const G0 := Color8(70, 124, 50)
const G1 := Color8(84, 142, 58)
const G2 := Color8(98, 156, 64)
const G3 := Color8(118, 172, 74)
func _ground() -> Node2D:
	var root := Node2D.new()
	root.z_index = -10
	var gw := W / 3 + 2
	var lf := PackedFloat32Array()
	lf.resize(gw * (H / 3 + 2))
	for i in lf.size():
		lf[i] = Game.hash2(i % gw, i / gw, 21)
	for cy in range(0, H, 8):
		for cx in range(0, W, 8):
			var cw := mini(8, W - cx)
			var chh := mini(8, H - cy)
			var img := Image.create_empty(cw * TS, chh * TS, false, Image.FORMAT_RGBA8)
			for ty in range(cy, cy + chh):
				for tx in range(cx, cx + cw):
					var k := _k(tx, ty)
					for y in TS:
						for x in TS:
							img.set_pixel((tx - cx) * TS + x, (ty - cy) * TS + y, _gpx(k, tx, ty, x, y, lf, gw))
					_decor(img, k, tx, ty, (tx - cx) * TS, (ty - cy) * TS)
			var sp := Sprite2D.new()
			sp.texture = ImageTexture.create_from_image(img)
			sp.centered = false
			sp.position = Vector2(cx * TS, cy * TS)
			root.add_child(sp)
	return root

# вид земли под предметом: 0 — трава (с цветами, деревьями, колодцем), 1 — камень, 2 — песок
func _gk(x: int, y: int) -> int:
	var k := _k(x, y)
	return 1 if (k == PATH or k == WALL or k == BUILD) else 2 if k == SAND else 0

# лес за северной стеной: виден над стеной и крышей донжона
func _backdrop() -> Sprite2D:
	var img := Image.create_empty(W * TS, 48, false, Image.FORMAT_RGBA8)
	img.fill(Color8(26, 44, 32))
	for i in 70:
		var cx := i * 11 + int(Game.hash2(i, 1, 71) * 8.0)
		var cy := 14 + int(Game.hash2(i, 2, 71) * 16.0)
		var r := 8 + int(Game.hash2(i, 3, 71) * 6.0)
		for y in range(cy - r, cy + r + 1):
			for x in range(cx - r, cx + r + 1):
				var dx := x - cx
				var dy := y - cy
				if x >= 0 and y >= 0 and x < W * TS and y < 48 and dx * dx + dy * dy <= r * r:
					var lit := dx + dy < -r / 2
					var c := Color8(66, 108, 62) if lit else Color8(46, 82, 52)
					if dx * dx + dy * dy > (r - 1) * (r - 1):
						c = Color8(24, 46, 32)
					img.set_pixel(x, y, c)
	var sp := Sprite2D.new()
	sp.texture = ImageTexture.create_from_image(img)
	sp.centered = false
	sp.position = Vector2(0, -48)
	sp.z_index = -11
	return sp

func _gpx(k: int, tx: int, ty: int, x: int, y: int, lf: PackedFloat32Array, gw: int) -> Color:
	var gx := tx * TS + x
	var gy := ty * TS + y
	var n := Game.hash2(gx, gy, 5)
	var g := _gk(tx, ty)
	var edge := (x == 0 and _gk(tx - 1, ty) != g) or (x == TS - 1 and _gk(tx + 1, ty) != g) or (y == 0 and _gk(tx, ty - 1) != g) or (y == TS - 1 and _gk(tx, ty + 1) != g)
	if k == PATH or k == WALL or k == BUILD:
		var row := gy / 5
		var bx := (gx + (row % 3) * 4) % 7
		var c := Color8(164, 152, 130) if n > 0.5 else Color8(152, 140, 118)
		if Game.hash2(gx / 7, row, 8) > 0.8:
			c = Color8(140, 130, 112)
		if bx == 0 or gy % 5 == 0:
			c = Color8(116, 104, 90)
		if edge:
			c = Color8(118, 106, 92)
		return c
	if k == SAND:
		var c := Color8(206, 180, 128) if n > 0.35 else Color8(194, 166, 116)
		if n > 0.94:
			c = Color8(170, 142, 98)
		return c.darkened(0.12) if edge else c
	# трава: крупные пятна (плавный шум по сетке 48 px) + мелкая рябь
	var fx := gx / 48.0
	var fy := gy / 48.0
	var ix := int(fx)
	var iy := int(fy)
	var u := smoothstep(0.0, 1.0, fx - ix)
	var v := smoothstep(0.0, 1.0, fy - iy)
	var m := lerpf(lerpf(lf[iy * gw + ix], lf[iy * gw + ix + 1], u), lerpf(lf[(iy + 1) * gw + ix], lf[(iy + 1) * gw + ix + 1], u), v)
	var val := m * 0.72 + n * 0.28
	var c := G0 if val < 0.3 else G1 if val < 0.52 else G2 if val < 0.76 else G3
	if edge:
		c = G0.darkened(0.12)
	return c

# пучки травы и цветы поверх земли
func _decor(img: Image, k: int, tx: int, ty: int, ox: int, oy: int) -> void:
	if k != GRASS and k != FLOWER:
		return
	for j in 2:
		if Game.hash2(tx * 2 + j, ty, 31) < 0.4:
			var px := ox + 3 + int(Game.hash2(tx, ty * 2 + j, 32) * 10)
			var py := oy + 4 + int(Game.hash2(tx * 3 + j, ty, 33) * 9)
			img.set_pixel(px - 1, py - 1, G3)
			img.set_pixel(px + 1, py - 1, G3)
			img.set_pixel(px, py - 2, G3.lightened(0.1))
			img.set_pixel(px, py, G0)
			img.set_pixel(px - 1, py, G0)
			img.set_pixel(px + 1, py, G0)
	if k == FLOWER:
		var pal := [Color8(244, 226, 96), Color8(236, 126, 156), Color8(246, 244, 236), Color8(150, 140, 230)]
		for j in 3:
			var px := ox + 3 + int(Game.hash2(tx + j * 7, ty, 41) * 10)
			var py := oy + 3 + int(Game.hash2(tx, ty + j * 5, 42) * 10)
			var pc: Color = pal[(tx * 3 + ty + j) % pal.size()]
			img.set_pixel(px, py - 1, pc)
			img.set_pixel(px - 1, py, pc)
			img.set_pixel(px + 1, py, pc)
			img.set_pixel(px, py + 1, pc)
			img.set_pixel(px, py, Color8(250, 200, 70) if pc != pal[0] else Color8(200, 120, 40))
			img.set_pixel(px, py + 2, G0)

func _stone(img: Image, x0: int, y0: int, w: int, h: int, base: Color) -> void:
	for y in range(maxi(0, y0), mini(img.get_height(), y0 + h)):
		for x in range(maxi(0, x0), mini(img.get_width(), x0 + w)):
			var bx := (x + (6 if ((y - y0) / 5) % 2 else 0)) % 12
			var c := base if Game.hash2(x, y, 9) > 0.4 else base.darkened(0.08)
			if bx == 0 or (y - y0) % 5 == 0:
				c = base.darkened(0.32)
			img.set_pixel(x, y, c)

func _crenel(img: Image, x0: int, y0: int, w: int, base: Color) -> void:
	for x in range(x0, x0 + w, 8):
		_stone(img, x, y0, 5, 6, base)

# прямоугольник с полукруглым верхом (арка двери)
func _arch(img: Image, x0: int, y0: int, w: int, h: int, c: Color) -> void:
	var r := w / 2.0
	for y in h:
		var inset := 0
		if y < r:
			inset = int(r - sqrt(maxf(0.0, r * r - (r - y - 0.5) * (r - y - 0.5))))
		Pix.rect(img, x0 + inset, y0 + y, w - 2 * inset, 1, c)

func _roof(img: Image, x0: int, y0: int, w: int, h: int, base: Color) -> void:
	for y in range(y0, y0 + h):
		for x in range(x0, x0 + w):
			var c := base if ((x + (y / 4) * 3) % 6) != 0 else base.darkened(0.3)
			if y % 4 == 3:
				c = base.darkened(0.2)
			img.set_pixel(x, y, c)

func _sprite(img: Image, base: Vector2) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = ImageTexture.create_from_image(img)
	s.centered = false
	s.offset = Vector2(0, -img.get_height())
	s.position = base
	world.add_child(s)
	return s

func _unshaded(add: bool) -> CanvasItemMaterial:
	var m := CanvasItemMaterial.new()
	m.light_mode = CanvasItemMaterial.LIGHT_MODE_UNSHADED
	if add:
		m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	return m

# окно, светящееся ночью: стекло с переплётом и мягкий ореол (без PointLight2D — их бережём для факелов)
func _glow(p: Vector2, w: int, h: int) -> void:
	var img := Image.create_empty(w, h, false, Image.FORMAT_RGBA8)
	img.fill(Color8(255, 208, 112))
	Pix.rect(img, 0, h / 2, w, 1, Color8(190, 130, 60))
	Pix.rect(img, w / 2, 0, 1, h, Color8(190, 130, 60))
	var s := Sprite2D.new()
	s.texture = ImageTexture.create_from_image(img)
	s.centered = false
	s.position = p
	s.z_index = 5
	s.material = _unshaded(false)
	s.modulate.a = 0.0
	add_child(s)
	glows.append(s)
	var halo := Sprite2D.new()
	halo.texture = halo_tex
	halo.position = p + Vector2(w / 2.0, h / 2.0 + 2.0)
	halo.modulate = Color(1.0, 0.66, 0.3, 0.0)
	halo.material = _unshaded(true)
	halo.z_index = 5
	add_child(halo)
	halos.append(halo)

const FLAME := [["..c..", "..c..", ".cac.", ".cac.", "cabac", "cabac", "cabbc", ".ccc."],
	[".c...", "..c..", ".ca..", ".cac.", "cabac", "cabbc", "cabbc", ".ccc."],
	["...c.", "..c..", "..ac.", ".cac.", "cabac", "cabbc", "cabac", ".ccc."]]
var flames: Array = []

func _torch(c: Vector2i) -> void:
	if flames.is_empty():
		var pal := {"a": Color8(255, 168, 60), "b": Color8(255, 236, 150), "c": Color8(222, 86, 34)}
		for f in FLAME:
			flames.append(Pix.tex(PackedStringArray(f), pal))
	var img := Image.create_empty(8, 24, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	Pix.rect(img, 1, 22, 6, 2, Color(0, 0, 0, 0.25))
	Pix.rect(img, 3, 8, 2, 15, Color8(92, 62, 38))
	Pix.rect(img, 4, 8, 1, 15, Color8(64, 42, 26))
	Pix.rect(img, 0, 5, 8, 2, Color8(64, 60, 62))
	Pix.rect(img, 1, 7, 6, 1, Color8(44, 40, 42))
	Pix.rect(img, 2, 8, 4, 1, Color8(44, 40, 42))
	var base := Vector2(c.x * TS + 4, c.y * TS + 14)
	_sprite(img, base)
	var top := base + Vector2(4, -23)
	var fl := Sprite2D.new()
	fl.texture = flames[0]
	fl.position = top
	fl.material = _unshaded(false)
	fl.z_index = 6
	add_child(fl)
	var l := PointLight2D.new()
	l.texture = light_tex
	l.color = Color(1.0, 0.7, 0.4)
	l.energy = 0.0
	l.position = top
	add_child(l)
	var p := CPUParticles2D.new()
	p.position = top + Vector2(0, -3)
	p.amount = 6
	p.lifetime = 0.8
	p.direction = Vector2(0, -1)
	p.spread = 18
	p.initial_velocity_min = 6
	p.initial_velocity_max = 14
	p.gravity = Vector2(0, -4)
	p.color = Color(1.0, 0.66, 0.24)
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	mat.light_mode = CanvasItemMaterial.LIGHT_MODE_UNSHADED
	p.material = mat
	p.z_index = 6
	add_child(p)
	lights.append({"l": l, "e": 1.15, "ph": c.x * 1.7 + c.y, "f": fl, "p": p})

func _props() -> void:
	var stone := Color8(150, 146, 138)
	# стены по краю: верхняя (за донжоном), боковые и нижняя с воротами
	var top := Image.create_empty(W * TS, 40, false, Image.FORMAT_RGBA8)
	top.fill(Color(0, 0, 0, 0))
	_stone(top, 0, 8, W * TS, 32, stone.darkened(0.1))
	_crenel(top, 0, 2, W * TS, stone.darkened(0.1))
	_sprite(top, Vector2(0, 2 * TS))
	for side in [0, W - 2]:
		var img := Image.create_empty(2 * TS, (H - 2) * TS, false, Image.FORMAT_RGBA8)
		_stone(img, 0, 0, 2 * TS, (H - 2) * TS, stone.darkened(0.18))
		_sprite(img, Vector2(side * TS, (H - 2) * TS))
	for part in [[0, 22], [26, W - 26]]:
		var img := Image.create_empty(part[1] * TS, 44, false, Image.FORMAT_RGBA8)
		img.fill(Color(0, 0, 0, 0))
		_stone(img, 0, 8, part[1] * TS, 36, stone)
		_crenel(img, 0, 2, part[1] * TS, stone)
		_sprite(img, Vector2(part[0] * TS, H * TS))
	var gate := Image.create_empty(4 * TS, 60, false, Image.FORMAT_RGBA8)
	gate.fill(Color(0, 0, 0, 0))
	_stone(gate, 0, 0, 8, 60, stone.darkened(0.05))
	_stone(gate, 4 * TS - 8, 0, 8, 60, stone.darkened(0.05))
	_stone(gate, 0, 0, 4 * TS, 10, stone.darkened(0.05))
	_sprite(gate, Vector2(22 * TS, H * TS))
	# донжон: шиферная крыша зала, стена с дорожкой и зубцами, две башни, арка двери, знамёна; окна ночью светятся
	var kw := 16 * TS
	var kh := 8 * TS + 56
	var keep := Image.create_empty(kw, kh, false, Image.FORMAT_RGBA8)
	keep.fill(Color(0, 0, 0, 0))
	var slate := Color8(80, 76, 104)
	_roof(keep, 40, 6, kw - 80, 52, slate)
	Pix.rect(keep, 40, 4, kw - 80, 3, slate.lightened(0.25))
	var wt := 60
	_stone(keep, 0, wt, kw, kh - wt, stone)
	Pix.rect(keep, 0, wt, kw, 5, stone.lightened(0.14))
	_crenel(keep, 0, wt - 6, kw, stone.lightened(0.05))
	Pix.rect(keep, 0, wt + 5, kw, 2, stone.darkened(0.42))
	for tx in [0, kw - 44]:
		_stone(keep, tx, 30, 44, kh - 30, stone.lightened(0.04))
		Pix.rect(keep, tx, 30, 44, 5, stone.lightened(0.2))
		_crenel(keep, tx + 1, 24, 44, stone.lightened(0.08))
		Pix.rect(keep, tx, 35, 44, 2, stone.darkened(0.38))
		Pix.rect(keep, tx + (42 if tx == 0 else 0), 37, 2, kh - 37, stone.darkened(0.4))
		Pix.rect(keep, tx + 21, 104, 3, 12, Color8(34, 30, 36))
	Pix.rect(keep, 0, kh - 6, kw, 6, stone.darkened(0.2))
	Pix.rect(keep, 0, kh - 6, kw, 1, stone.darkened(0.35))
	var kbase := Vector2(16 * TS, 10 * TS)
	var ktop := kbase.y - kh
	var wins := [[18, 64], [kw - 26, 64], [56, 84], [80, 84], [kw - 88, 84], [kw - 64, 84], [56, 122], [80, 122], [kw - 88, 122], [kw - 64, 122]]
	for wv in wins:
		var wx: int = wv[0]
		var wy: int = wv[1]
		Pix.rect(keep, wx - 1, wy - 1, 10, 14, stone.lightened(0.18))
		Pix.rect(keep, wx, wy, 8, 12, Color8(34, 38, 58))
		keep.set_pixel(wx, wy, stone.lightened(0.18))
		keep.set_pixel(wx + 7, wy, stone.lightened(0.18))
		keep.set_pixel(wx + 2, wy + 2, Color8(92, 104, 136))
		Pix.rect(keep, wx - 2, wy + 12, 12, 2, stone.lightened(0.3))
		_glow(Vector2(16 * TS + wx + 1, ktop + wy + 1), 6, 10)
	var dx := kw / 2 - 16
	var dy := kh - 48
	_arch(keep, dx - 5, dy - 7, 42, 55, stone.lightened(0.22))
	_arch(keep, dx - 2, dy - 4, 36, 52, stone.darkened(0.3))
	_arch(keep, dx, dy - 2, 32, 50, Color8(104, 64, 34))
	for i in range(dx + 3, dx + 32, 5):
		Pix.rect(keep, i, dy + 8, 1, 40, Color8(78, 48, 26))
	Pix.rect(keep, dx + 15, dy - 2, 2, 50, Color8(62, 38, 20))
	Pix.rect(keep, dx, dy + 14, 32, 2, Color8(54, 50, 54))
	Pix.rect(keep, dx, dy + 34, 32, 2, Color8(54, 50, 54))
	Pix.rect(keep, dx + 11, dy + 24, 2, 3, Color8(210, 176, 84))
	Pix.rect(keep, dx + 19, dy + 24, 2, 3, Color8(210, 176, 84))
	for bx in [dx - 22, dx + 42]:
		var by := wt + 36
		var red := Color8(152, 30, 42)
		var gold := Color8(214, 172, 74)
		Pix.rect(keep, bx - 2, by - 2, 16, 2, Color8(96, 70, 40))
		Pix.rect(keep, bx, by, 12, 26, red)
		Pix.rect(keep, bx + 9, by, 3, 26, red.darkened(0.2))
		for i in 4:
			Pix.rect(keep, bx, by + 26 + i, 5 - i, 1, red)
			Pix.rect(keep, bx + 7 + i, by + 26 + i, 5 - i, 1, red.darkened(0.2))
		Pix.rect(keep, bx, by, 12, 1, gold)
		Pix.rect(keep, bx + 3, by + 11, 6, 3, gold)
		Pix.rect(keep, bx + 3, by + 8, 1, 3, gold)
		Pix.rect(keep, bx + 5, by + 7, 2, 4, gold)
		Pix.rect(keep, bx + 8, by + 8, 1, 3, gold)
	for y in kh:
		for x in range(kw - 72, kw):
			var pc := keep.get_pixel(x, y)
			if pc.a > 0.0:
				keep.set_pixel(x, y, pc.darkened(0.12 * float(x - (kw - 72)) / 72.0))
	_sprite(keep, kbase)
	# казармы и конюшня
	for b in [[3, 22, 8, 5, Color8(150, 70, 50), "barracks"], [36, 22, 9, 5, Color8(120, 90, 50), "stables"]]:
		var bw: int = b[2] * TS
		var bh: int = b[3] * TS + 30
		var img := Image.create_empty(bw, bh, false, Image.FORMAT_RGBA8)
		img.fill(Color(0, 0, 0, 0))
		_stone(img, 0, bh - 44, bw, 44, Color8(170, 150, 120))
		_roof(img, 0, 0, bw, bh - 40, b[4])
		Pix.rect(img, bw / 2 - 8, bh - 26, 16, 26, Color8(90, 56, 30))
		var base := Vector2(b[0] * TS, (b[1] + b[3]) * TS)
		var top_y := base.y - bh
		for wx in [10, bw - 18]:
			Pix.rect(img, wx, bh - 32, 8, 10, Color8(36, 40, 60))
			_glow(Vector2(b[0] * TS + wx + 1, top_y + bh - 31), 6, 8)
		_sprite(img, base)
	# колодец
	var well := Image.create_empty(32, 40, false, Image.FORMAT_RGBA8)
	well.fill(Color(0, 0, 0, 0))
	_stone(well, 2, 22, 28, 18, Color8(160, 156, 150))
	Pix.rect(well, 6, 22, 20, 4, Color8(40, 70, 110))
	Pix.rect(well, 3, 4, 3, 20, Color8(100, 70, 40))
	Pix.rect(well, 26, 4, 3, 20, Color8(100, 70, 40))
	_roof(well, 0, 0, 32, 8, Color8(140, 60, 40))
	_sprite(well, Vector2(12 * TS, 19 * TS))
	# деревья
	for y in H:
		for x in W:
			if _k(x, y) == TREE:
				_sprite(_tree(x * 7 + y), Vector2(x * TS - 8, (y + 1) * TS))
	# соломенное чучело на ристалище
	var dm := Image.create_empty(12, 24, false, Image.FORMAT_RGBA8)
	dm.fill(Color(0, 0, 0, 0))
	Pix.rect(dm, 5, 6, 2, 18, Color8(100, 70, 40))
	Pix.rect(dm, 1, 8, 10, 2, Color8(100, 70, 40))
	Pix.rect(dm, 3, 2, 6, 6, Color8(210, 180, 100))
	Pix.rect(dm, 3, 10, 6, 8, Color8(200, 170, 90))
	_sprite(dm, Vector2(7 * TS, 13 * TS))
	for c in [Vector2i(21, 13), Vector2i(26, 13), Vector2i(21, 22), Vector2i(26, 22), Vector2i(21, 30), Vector2i(26, 30), Vector2i(9, 27), Vector2i(39, 27), Vector2i(14, 16)]:
		_torch(c)

func _tree(seed: int) -> Image:
	var img := Image.create_empty(32, 44, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	Pix.rect(img, 6, 40, 20, 4, Color(0, 0, 0, 0.25))
	Pix.rect(img, 14, 26, 4, 16, Color8(96, 64, 38))
	var g1 := Color8(46, 104, 50)
	var g2 := Color8(70, 136, 60)
	for y in 30:
		for x in 32:
			var dx := x - 16
			var dy := y - 15
			var r := 13.0 + 2.0 * sin(float(x + seed) * 0.9) * cos(float(y) * 0.7)
			if dx * dx + dy * dy * 1.2 < r * r:
				var n := Game.hash2(x + seed * 31, y, 4)
				img.set_pixel(x, y, g2 if (dx + dy < -4 and n > 0.3) else g1 if n > 0.15 else g1.darkened(0.25))
	var out := Color8(30, 66, 38)
	var edge: Array[Vector2i] = []
	for y in 31:
		for x in 32:
			if img.get_pixel(x, y).a == 0.0:
				for o in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
					var q: Vector2i = Vector2i(x, y) + o
					if q.x >= 0 and q.y >= 0 and q.x < 32 and q.y < 30 and img.get_pixel(q.x, q.y).a > 0.0 and img.get_pixel(q.x, q.y) != Color8(96, 64, 38):
						edge.append(Vector2i(x, y))
						break
	for e in edge:
		img.set_pixel(e.x, e.y, out)
	for i in 5:
		var hx := 8 + int(Game.hash2(seed, i, 51) * 10)
		var hy := 6 + int(Game.hash2(i, seed, 52) * 8)
		if img.get_pixel(hx, hy).a > 0.0:
			img.set_pixel(hx, hy, Color8(132, 186, 90))
	return img

func _ui() -> void:
	var ui := CanvasLayer.new()
	add_child(ui)
	var f: Font = Game.font
	for l in [hud, hint]:
		l.add_theme_font_override("font", f)
		l.add_theme_font_size_override("font_size", 12)
		l.add_theme_color_override("font_color", Color8(244, 232, 200))
		l.add_theme_color_override("font_shadow_color", Color8(20, 14, 10))
		l.add_theme_constant_override("shadow_offset_x", 1)
		l.add_theme_constant_override("shadow_offset_y", 1)
	var bar := StyleBoxFlat.new()
	bar.bg_color = Color8(26, 19, 14, 178)
	bar.set_corner_radius_all(3)
	bar.content_margin_left = 6
	bar.content_margin_right = 6
	bar.content_margin_top = 1
	bar.content_margin_bottom = 2
	for pair in [[hud, Control.PRESET_TOP_LEFT], [hint, Control.PRESET_BOTTOM_LEFT]]:
		var pc := PanelContainer.new()
		pc.add_theme_stylebox_override("panel", bar)
		pc.add_child(pair[0])
		ui.add_child(pc)
		pc.set_anchors_and_offsets_preset(pair[1], Control.PRESET_MODE_MINSIZE, 4)
		if pair[1] == Control.PRESET_BOTTOM_LEFT:
			pc.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hint.text = "WASD — идти · E — говорить · Пробел — пауза · 1–3 — скорость · Esc — выйти"
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color8(34, 26, 20, 236)
	sb.border_color = Color8(201, 160, 96)
	sb.set_border_width_all(1)
	sb.set_content_margin_all(8)
	dlg.add_theme_stylebox_override("panel", sb)
	dlg.position = Vector2(60, 262)
	dlg.size = Vector2(520, 76)
	var v := VBoxContainer.new()
	dlg.add_child(v)
	for l in [dlg_name, dlg_text]:
		l.add_theme_font_override("font", f)
		v.add_child(l)
	dlg_name.add_theme_font_size_override("font_size", 13)
	dlg_name.add_theme_color_override("font_color", Color8(242, 210, 120))
	dlg_text.add_theme_font_size_override("font_size", 13)
	dlg_text.add_theme_color_override("font_color", Color8(244, 236, 214))
	dlg_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dlg_text.custom_minimum_size = Vector2(500, 36)
	dlg.visible = false
	ui.add_child(dlg)

func _process(d: float) -> void:
	_tick(d)

func _tick(d: float) -> void:
	t += d
	if talking < 0 and Game.speed > 0:   # пауза (Пробел) и разговор останавливают двор
		Game.advance(d)
		var dir := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
		if Input.is_physical_key_pressed(KEY_A):
			dir.x -= 1
		if Input.is_physical_key_pressed(KEY_D):
			dir.x += 1
		if Input.is_physical_key_pressed(KEY_W):
			dir.y -= 1
		if Input.is_physical_key_pressed(KEY_S):
			dir.y += 1
		move_king(dir, d)
		for n in npcs:
			_npc(n, d)
	_light()
	hud.text = Game.clock_text() + ("  · пауза" if Game.speed == 0 else "  · скорость " + str(Game.speed))

func move_king(dir: Vector2, d: float) -> void:
	if dir.length() < 0.1:
		kstep = 0.0
		king.texture = kframes[kdir][0]
		return
	dir = dir.normalized()
	kdir = (3 if dir.x > 0 else 2) if absf(dir.x) > absf(dir.y) else (0 if dir.y > 0 else 1)
	var sp := 64.0 * d
	for ax in [Vector2(dir.x, 0), Vector2(0, dir.y)]:
		var np: Vector2 = king.position + ax * sp
		if _free(np):
			king.position = np
	kstep += d * 8.0
	king.texture = kframes[kdir][int(kstep) % 4]

func _free(p: Vector2) -> bool:
	for o in [Vector2(-4, -2), Vector2(4, -2), Vector2(-4, 1), Vector2(4, 1)]:
		var q: Vector2 = p + o
		if q.x < 0 or q.y < 0 or q.x >= W * TS or q.y >= H * TS:
			return false
		var c := Vector2i(int(q.x / TS), int(q.y / TS))
		if _solid(_k(c.x, c.y)):
			return false
	return true

func _goal_now(i: int) -> String:
	var d: Dictionary = PEOPLE[i]
	var h := Game.hour()
	var g: String = d["home"]
	if (h < 5.0 or h >= 21.5) and not d.get("night", false):
		return "inside"
	for pl in d["plan"]:
		if h >= float(pl[0]):
			g = pl[1]
	return g

func _npc(n: Dictionary, d: float) -> void:
	var i: int = n["i"]
	var s: Sprite2D = n["s"]
	var g := _goal_now(i)
	if g != n["goal"]:
		n["goal"] = g
		var tgt: Vector2i = spots[PEOPLE[i]["home"] if g == "inside" else g]
		tgt += Vector2i(i % 3 - 1, i % 2)
		if astar.is_in_boundsv(tgt) and astar.is_point_solid(tgt):
			tgt = spots[PEOPLE[i]["home"] if g == "inside" else g]
		n["path"] = astar.get_point_path(_cell(s.position), tgt)
		n["pi"] = 1
		if n["inside"] and g != "inside":
			n["inside"] = false
			s.visible = true
	var path: PackedVector2Array = n["path"]
	var pi: int = n["pi"]
	if pi < path.size():
		var to := path[pi] + Vector2(8, 12)
		var v := to - s.position
		var stp := 30.0 * d * maxf(1.0, Game.SPEEDS[Game.speed])
		var mv := minf(v.length(), stp)
		if v.length() > 0.01:
			n["dir"] = (3 if v.x > 0 else 2) if absf(v.x) > absf(v.y) else (0 if v.y > 0 else 1)
		if v.length() <= stp:
			s.position = to
			n["pi"] = pi + 1
		else:
			s.position += v.normalized() * stp
		n["walked"] = float(n["walked"]) + mv
		walked += mv
		n["step"] = float(n["step"]) + d * 7.0
		s.texture = n["fr"][n["dir"]][int(n["step"]) % 4]
	else:
		s.texture = n["fr"][n["dir"]][0]
		if g == "inside" and not n["inside"]:
			n["inside"] = true
			s.visible = false

func _light() -> void:
	var nt := Game.night()
	var c := Color(1, 1, 1).lerp(Color(0.26, 0.29, 0.48), nt)
	if nt > 0.0 and nt < 1.0:
		c = c.lerp(Color(1.0, 0.7, 0.52), 0.4 * sin(nt * PI))
	cm.color = c
	for L in lights:
		var l: PointLight2D = L["l"]
		var ph: float = L["ph"]
		l.energy = float(L["e"]) * nt * (1.0 + 0.12 * sin(t * 10.0 + ph) + 0.06 * sin(t * 23.0 + ph * 2.0))
		l.visible = nt > 0.02
		if L.has("f"):
			var fl: Sprite2D = L["f"]
			fl.visible = nt > 0.05
			fl.texture = flames[int(t * 9.0 + ph) % flames.size()]
			(L["p"] as CPUParticles2D).emitting = nt > 0.05
	for gsp in glows:
		gsp.modulate.a = 0.95 * nt
	for hs in halos:
		hs.modulate.a = 0.4 * nt

func _unhandled_input(e: InputEvent) -> void:
	if not (e is InputEventKey and e.pressed and not e.echo):
		return
	var k: int = e.physical_keycode
	if talking >= 0:
		if k == KEY_E or k == KEY_ENTER or k == KEY_SPACE:
			next_line()
		elif k == KEY_ESCAPE:
			close_talk()
		return
	match k:
		KEY_E, KEY_ENTER:
			try_talk()
		KEY_SPACE:
			Game.speed = 0 if Game.speed > 0 else 1
		KEY_1, KEY_2, KEY_3:
			Game.speed = k - KEY_0
		KEY_ESCAPE:
			leave.emit()

func nearest(r: float) -> int:
	var best := -1
	var bd := r
	for n in npcs:
		var s: Sprite2D = n["s"]
		if not s.visible:
			continue
		var dd := s.position.distance_to(king.position)
		if dd < bd:
			bd = dd
			best = n["i"]
	return best

func try_talk() -> bool:
	var i := nearest(28.0)
	if i < 0:
		return false
	talking = i
	var d: Dictionary = PEOPLE[i]
	var say: Array = d["say"]
	var h := int(Game.hour())
	lines = PackedStringArray([say[h % say.size()], say[(h + 1) % say.size()]])
	line = 0
	dlg_name.text = d["name"]
	dlg_text.text = lines[0]
	dlg.visible = true
	var s: Sprite2D = npcs[i]["s"]
	var v := king.position - s.position
	npcs[i]["dir"] = (3 if v.x > 0 else 2) if absf(v.x) > absf(v.y) else (0 if v.y > 0 else 1)
	s.texture = npcs[i]["fr"][npcs[i]["dir"]][0]
	print("TALK ", d["name"])
	return true

func next_line() -> void:
	line += 1
	if line >= lines.size():
		close_talk()
	else:
		dlg_text.text = lines[line]

func close_talk() -> void:
	talking = -1
	dlg.visible = false

# команды для скриншот-тестов веб-сборки (window.slovo('…'))
func cmd(p: PackedStringArray) -> void:
	match p[0]:
		"goto":
			var s: Sprite2D = npcs[int(p[1])]["s"]
			for o in [Vector2(0, 14), Vector2(14, 0), Vector2(-14, 0), Vector2(0, -14)]:
				if _free(s.position + o):
					king.position = s.position + o
					break
			cam.reset_smoothing()
		"talk":
			try_talk()
		"next":
			next_line()
		"close":
			close_talk()
		"walk":
			for i in int(float(p[3]) * 60.0):
				move_king(Vector2(float(p[1]), float(p[2])), 1.0 / 60.0)
		"state":
			print("STATE ", JSON.stringify(state()))

func state() -> Dictionary:
	var vis := 0
	for n in npcs:
		if (n["s"] as Sprite2D).visible:
			vis += 1
	return {"day": Game.day, "min": int(Game.minutes), "king": [int(king.position.x), int(king.position.y)], "dir": kdir, "talk": talking, "npcs": vis, "walked": int(walked), "night": snappedf(Game.night(), 0.01)}

# самопроверка без экрана: двое суток двора, ходьба короля, стены держат, разговор открывается и закрывается
func selftest() -> bool:
	var ok := true
	Game.speed = 3
	var hid := 0
	for i in 2400:
		_tick(0.1)
		if i == 1200:
			for n in npcs:
				if not (n["s"] as Sprite2D).visible:
					hid += 1
	var movers := 0
	for n in npcs:
		if float(n["walked"]) > 200.0:
			movers += 1
	print("selftest: day ", Game.day, " walked ", int(walked), " movers ", movers, "/", npcs.size(), " ночью внутри ", hid)
	ok = ok and Game.day >= 2 and movers == npcs.size() and hid >= 3
	Game.speed = 1
	king.position = _px(Vector2i(23, 20))
	var x0 := king.position.x
	for i in 60:
		move_king(Vector2.RIGHT, 1.0 / 60.0)
	ok = ok and king.position.x > x0 + 40
	king.position = _px(Vector2i(23, 11))
	for i in 120:
		move_king(Vector2.UP, 1.0 / 60.0)
	ok = ok and king.position.y > 10 * TS
	print("selftest: king ", king.position, " (стена донжона держит: ", king.position.y > 10 * TS, ")")
	Game.minutes = 12.0 * 60.0
	for n in npcs:
		(n["s"] as Sprite2D).visible = true
	cmd(PackedStringArray(["goto", "0"]))
	ok = ok and try_talk() and dlg.visible
	next_line()
	next_line()
	ok = ok and not dlg.visible and talking == -1
	print("selftest: ", JSON.stringify(state()))
	return ok
