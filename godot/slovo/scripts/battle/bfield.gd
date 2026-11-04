class_name BField
extends SubViewport
## Картинка поля боя (bscreen.js: buildField) — F.W×F.H точек, рисуется один раз: местность на GPU (shaders/bfield.gdshader),
## сверху — деревья, камыш, камни и кочки (спрайты карты из выгрузки; тот же генератор mkRng(tile·13 + 7) и тот же порядок,
## что в HTML), при штурме — дома за стеной и зубцы стены. Обзор и мини-карта — та же картинка, уменьшенная с сглаживанием
## (CanvasTexture с линейным фильтром). Павшие ложатся на поле навсегда (B.deadN): новые следы дорисовываются в ту же
## картинку, не чаще четырёх раз в секунду.
const SH := preload("res://shaders/bfield.gdshader")
const PALS := {"winter": ["#c8d2d8", "#d8e0e4", "#e8eef2", "#f2f6f8"], "steppe": ["#9a9450", "#a8a25a", "#b4ae62", "#c0ba70"],
	"beach": ["#c8b07a", "#d9c48a", "#e2d098", "#ecdcaa"], "farm": ["#8a9a44", "#9aa84c", "#a8b456", "#b8a850"],
	"marsh": ["#4a6440", "#56704a", "#607a52", "#6a845a"], "grass": ["#4f8a3a", "#5a9a40", "#62a044", "#6aaa4a"]}
static var meta: Dictionary = {}   # спрайты карты (world.json: mspr) — один раз
var F: SimBattle.BFld
var winter := false
var items: Array = []    # [x, y, номер спрайта] — по порядку рисования
var houses: Array = []   # [x, y]
var smooth: CanvasTexture
var dead: Array = []     # B.dead: {x, y, side, t}
var dead_n := 0          # сколько следов уже на картинке
var dead_t := -1.0
var dcol: Array = []     # тёмный цвет стороны (sideCol)
var dm: Node2D

static func mspr(k: String) -> Array:
	if meta.is_empty():
		meta = WorldData.load_meta()
	return meta.get("mspr", {}).get(k, [])

## палитра земли (bscreen.js: pal) — 4 цвета 0..255
static func pal_of(base: int, win: bool) -> Array:
	var k := "winter" if win or base == 13 else ("steppe" if base == 12 else ("beach" if base == 3 else ("farm" if base == 5 else ("marsh" if base == 11 else "grass"))))
	var out := []
	for h: String in PALS[k]:
		var c := Color.html(h)
		out.append(Vector3(c.r8, c.g8, c.b8))
	return out

func setup(f: SimBattle.BFld, day: float) -> void:
	F = f
	var w := int(F.W)
	var h := int(F.H)
	var bcw := w / 4
	var bch := h / 4
	size = Vector2i(w, h)
	transparent_bg = false
	disable_3d = true
	render_target_update_mode = SubViewport.UPDATE_ONCE
	winter = Sim.seasonOf(day) == 3 and F.temp < 0.55
	var data := PackedByteArray()
	data.resize(bcw * bch * 2)
	for i in bcw * bch:
		data[i * 2] = F.g[i]
		data[i * 2 + 1] = F.hgt[i]
	var img := Image.create_from_data(bcw, bch, false, Image.FORMAT_RG8, data)
	var m := ShaderMaterial.new()
	m.shader = SH
	m.set_shader_parameter("cells", ImageTexture.create_from_image(img))
	for k in ["BCW", "BCH", "FW", "FH"]:
		m.set_shader_parameter(k, [bcw, bch, w, h][["BCW", "BCH", "FW", "FH"].find(k)])
	m.set_shader_parameter("seed", F.tile)
	var P := pal_of(F.base, winter)
	for i in 4:
		m.set_shader_parameter("pal" + str(i), P[i])
	m.set_shader_parameter("winter", winter)
	var wall := 100000
	if F.siege and F.rv != null and (F.rv as Dictionary).has("wall"):
		wall = int(F.rv.wall)
	m.set_shader_parameter("wall", wall)
	var cr := ColorRect.new()
	cr.size = Vector2(w, h)
	cr.material = m
	add_child(cr)
	_items(bcw, bch, w, h)
	var deco := Node2D.new()
	deco.draw.connect(_deco.bind(deco))
	add_child(deco)
	dm = Node2D.new()
	dm.draw.connect(_dead.bind(dm))
	add_child(dm)
	smooth = CanvasTexture.new()
	smooth.diffuse_texture = get_texture()
	smooth.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR

## деревья, камыш, камни и кочки — как в buildField: точки по клеткам, по высоте снизу вверх (сортировка JS устойчива),
## затем выбор рисунка тем же генератором; при штурме — 7 домов за стеной
func _items(bcw: int, bch: int, w: int, h: int) -> void:
	var rng := JSM.Rng.new(F.tile * 13 + 7)
	var trees := mspr("spine") if winter else (mspr("pine") if F.temp < 0.4 else mspr("oak"))
	var pts: Array = []
	for cy in bch:
		for cx in bcw:
			var k: int = F.g[cy * bcw + cx]
			if k == SimBattle.FOREST and rng.f() < 0.55:
				pts.append([cx * 4 + rng.i(0, 3), cy * 4 + rng.i(0, 3), "t", pts.size()])
			elif k == SimBattle.MARSH and rng.f() < 0.2:
				pts.append([cx * 4, cy * 4, "r", pts.size()])
			elif k == SimBattle.OPEN and rng.f() < 0.012:
				pts.append([cx * 4, cy * 4, "k" if rng.f() < 0.5 else "b", pts.size()])
	pts.sort_custom(func(p, q): return p[1] < q[1] or (p[1] == q[1] and p[3] < q[3]))
	for p in pts:
		var x: int = p[0]
		var y: int = p[1]
		match p[2]:
			"t":
				if trees.is_empty():
					continue
				var s := int(trees[rng.i(0, trees.size() - 1)])
				var sz := Art.size(s)
				items.append([x - (int(sz.x) >> 1), y - int(sz.y) + 2, s])
			"r":
				items.append([x, y, int(rng.pick(mspr("reed")))])
			"k":
				items.append([x, y, int(rng.pick(mspr("rock")))])
			_:
				items.append([x, y, int(rng.pick(mspr("rock") if winter else mspr("tuft")))])
	if F.siege and F.rv != null and (F.rv as Dictionary).has("wall"):
		var wx := int(F.rv.wall) * 4
		for k in 7:
			var hx := wx + 30 + (k % 3) * 40 + rng.i(0, 10)
			var hy := 30 + (k / 3) * roundi(h / 3.0) + rng.i(0, 20)
			houses.append([hx, hy])

func _deco(ci: Node2D) -> void:
	for it in items:
		var i: int = it[2]
		if i < 0:
			continue
		var r := Art.rect(i)
		ci.draw_texture_rect_region(Art.page(i), Rect2(it[0], it[1], r.size.x, r.size.y), r)
	if houses.is_empty():
		return
	for hp in houses:
		ci.draw_rect(Rect2(hp[0], hp[1], 18, 10), Color.html("#c8b090"))
		ci.draw_rect(Rect2(hp[0] - 2, hp[1] - 6, 22, 6), Color.html("#8a3a2a"))
		ci.draw_rect(Rect2(hp[0] + 7, hp[1] + 4, 4, 6), Color.html("#3a2a20"))
	var wx := int(F.rv.wall) * 4
	for y in range(0, int(F.H), 8):
		ci.draw_rect(Rect2(wx - 1, y, 3, 4), Color.html("#6a6458"))
		ci.draw_rect(Rect2(wx + 8, y + 4, 4, 3), Color.html("#a8a294"))

## новые павшие (B.dead) — на картинку поля
func add_dead(L: Array, dark: Array) -> void:
	if L.size() <= dead_n:
		return
	var t := Time.get_ticks_msec() / 1000.0
	if t - dead_t < 0.25:
		return
	dead_t = t
	dead = L
	dead_n = L.size()
	dcol = dark
	dm.queue_redraw()
	render_target_update_mode = SubViewport.UPDATE_ONCE

func _dead(ci: Node2D) -> void:
	var red := Color8(90, 20, 20, 128)
	var hc := Color.html("#5c3420")
	var fc := Color.html("#d8b090")
	for i in mini(dead_n, dead.size()):
		var d: Dictionary = dead[i]
		var x := floorf(d.x)
		var y := floorf(d.y)
		var m := JS.t(Sim.T.MOUNTED.get(d.t))
		ci.draw_rect(Rect2(x - 1, y, 3, 1), red)
		ci.draw_rect(Rect2(x, y - 1, 2, 1), dcol[int(d.side)])
		ci.draw_rect(Rect2(x + 2, y - 1, 2 if m else 1, 1), hc if m else fc)
