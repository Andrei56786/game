extends Node2D
# Двор «Слова короля»: места, графика, люди и распорядок — из HTML-версии (res://art, tools/export.mjs).
# Свет как в HTML: карта света (небо + огни + окна + лучи) умножается на сцену, сверху — свечение пламени и окон.
# Люди живут по расписанию во всех местах сразу и ходят через двери; король — 16×32, вид 320×180 точек (×4).
signal leave
signal to_map
signal ride_out(a)        # король выезжает из замка: a — войско у столицы (во главе) или null — со свитой
const CT := 16
const DIRS := ["down", "left", "right", "up"]
const NPC_SPDK := [1.0, 1.0, 1.4, 2.2]
const ANISP := {"horse": 12.0, "dog": 44.0, "cat": 20.0, "hen": 11.0, "pigeon": 9.0}
const Hud = preload("res://scripts/court_ui.gd")
const People = preload("res://scripts/people.gd")
const Council = preload("res://scripts/court_council.gd")
const Family = preload("res://scripts/court_family.gd")
const Audience = preload("res://scripts/court_audience.gd")

var D: Dictionary
var Z := 2
var loc_id := ""
var L: Dictionary
var V: Dictionary
var sea_key := ""
var spots := {}
var grids := {}
var king := {}
var npcs: Array = []
var ani: Array = []
var parts: Array = []
var t := 0.0
var walked := 0.0
var room := ""
var room_t := -10.0
var fade := 0.0
var fade_t := 0.0
var fade_fn: Callable
var last_ha := -1.0
var cam_tl := Vector2.ZERO
var sneak := false
var path: Array = []            # путь короля по щелчку мыши
var on_arrive: Callable
var practice_t := -10.0
var trees: Array = []
var forge := Vector2.ZERO
var people: RefCounted
var meet: RefCounted          # Малый совет: заседания, сбор, разговор с советником (court_council.gd)
var fam: RefCounted           # семья короля и воспитанники: разговоры с выбором (court_family.gd)
var aud: RefCounted           # приём прошений у трона (court_audience.gd)
var last_hh := -1             # половина часа (courtHalfHour): с прошлого кадра

var layer: Node2D
var world: Node2D
var fx0: Node2D
var fx1: Node2D
var deco: Array = []
var objs: Array = []
var lights: Array = []
var wins: Array = []
var glows: Array = []
var wglows: Array = []
var beams: Array = []
var cam := Camera2D.new()
var lm := SubViewport.new()
var lm_root := Node2D.new()
var lm_amb := ColorRect.new()
var lm_view := Sprite2D.new()
var king_light: Sprite2D
var hud: Control
var vig: TextureRect
var add_mat := CanvasItemMaterial.new()
var mul_mat := CanvasItemMaterial.new()
var bg_tex := {}

func _ready() -> void:
	D = Art.D
	add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	mul_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_MUL
	for id in D["order"]:
		var Ld: Dictionary = D["locs"][id]
		Ld["id"] = id
		for nm in Ld["spots"]:
			var sp: Dictionary = Ld["spots"][nm]
			sp["loc"] = id
			sp["name"] = nm
			if not spots.has(nm):
				spots[nm] = sp
		grids[id] = _grid(Ld)
	people = People.new(self)
	meet = Council.new(self)
	fam = Family.new(self)
	aud = Audience.new(self)
	var K: Dictionary = D["king"]
	king = {"key": "king", "name": K["name"], "sub": "", "sheet": K["sheet"], "port": K["port"], "loc": "keep", "x": 0.0, "y": 0.0, "dir": "up", "f": 0.0, "moving": false, "sit": null, "lie": false, "node": null}
	var sp0: Dictionary = spots["throne_front"]
	king["loc"] = sp0["loc"]
	king["x"] = float(sp0["x"])
	king["y"] = float(sp0["y"])
	king["dir"] = sp0["dir"]
	for p in D["people"]:
		npcs.append(people.make(p))
	for a in D["animals"]:
		var r: Array = a["r"]
		ani.append({"kind": a["kind"], "loc": a["loc"], "r": r, "x": float(a["x"]), "y": float(a["y"]), "f": a["f"], "tx": 0.0, "ty": 0.0, "t": randf() * 3.0, "flip": randf() < 0.5, "moving": false, "run": false, "fly": 0.0, "h": 0.0, "vx": 0.0, "vy": 0.0, "fc": 0.0, "peck": false, "node": null})
	cam.anchor_mode = Camera2D.ANCHOR_MODE_FIXED_TOP_LEFT
	add_child(cam)
	cam.make_current()
	lm.disable_3d = true
	lm.transparent_bg = false
	lm.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	lm.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR
	add_child(lm)
	lm.add_child(lm_amb)
	lm.add_child(lm_root)
	lm_view.centered = false
	lm_view.texture = lm.get_texture()
	lm_view.material = mul_mat
	lm_view.z_index = 50
	var ui := CanvasLayer.new()
	ui.layer = 5
	add_child(ui)
	vig = TextureRect.new()
	vig.texture = _vignette()
	vig.set_anchors_preset(Control.PRESET_FULL_RECT)
	vig.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vig.modulate.a = 0.0
	ui.add_child(vig)
	var ui2 := CanvasLayer.new()
	ui2.layer = 10
	add_child(ui2)
	hud = Hud.new()
	hud.court = self
	ui2.add_child(hud)
	if Game.frac == 0.0:
		Game.set_hour(7.5)
	people.pop_check()        # королевство уже есть — семья, совет и узники из него (courtPopulate)
	people.snap(true)
	last_ha = Game.day * 24.0 + Game.hour_abs()
	go_loc(king["loc"])
	snap_cam()

func _grid(Ld: Dictionary) -> AStarGrid2D:
	var g := AStarGrid2D.new()
	var w: int = Ld["w"]
	var h: int = Ld["h"]
	g.region = Rect2i(0, 0, w, h)
	g.cell_size = Vector2(CT, CT)
	g.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	g.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	g.default_estimate_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	g.update()
	var s: String = Ld["solid"]
	for y in h:
		for x in w:
			if s.unicode_at(y * w + x) == 49:
				g.set_point_solid(Vector2i(x, y), true)
	return g

func solid_at(id: String, tx: int, ty: int) -> bool:
	var Ld: Dictionary = D["locs"][id]
	var w: int = Ld["w"]
	if tx < 0 or ty < 0 or tx >= w or ty >= int(Ld["h"]):
		return true
	return (Ld["solid"] as String).unicode_at(ty * w + tx) == 49

func can_stand(x: float, y: float) -> bool:
	for o in [Vector2(-5, -4), Vector2(5, -4), Vector2(-5, 1), Vector2(5, 1)]:
		if solid_at(loc_id, floori((x + o.x) / CT), floori((y + o.y) / CT)):
			return false
	return true

func near_free(id: String, tx: int, ty: int) -> Vector2i:
	if not solid_at(id, tx, ty):
		return Vector2i(tx, ty)
	for r in range(1, 4):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if not solid_at(id, tx + dx, ty + dy):
					return Vector2i(tx + dx, ty + dy)
	return Vector2i(tx, ty)

# путь A* по клеткам (8 сторон, без срезания углов); цель может быть занятой, как в HTML
func find_path(id: String, a: Vector2i, b: Vector2i) -> Variant:
	if a == b:
		return []
	var g: AStarGrid2D = grids[id]
	if not g.is_in_boundsv(a) or not g.is_in_boundsv(b):
		return null
	var sa := g.is_point_solid(a)
	var sb := g.is_point_solid(b)
	g.set_point_solid(a, false)
	g.set_point_solid(b, false)
	var p := g.get_id_path(a, b)
	g.set_point_solid(a, sa)
	g.set_point_solid(b, sb)
	if p.is_empty():
		return null
	var out: Array = []
	for i in range(1, p.size()):
		out.append(p[i])
	return out

# вид наружного места по дню года, как seaVarOf в HTML: th оттепель · sp цветение · '' лето · au1–au3 осень · w снег
func season_key() -> String:
	var days: Array = L.get("days", [])
	if days.is_empty():
		return ""
	var y: int = days.size()
	return String(days[((Game.day % y) + y) % y])

func room_name(tx: int, ty: int) -> String:
	for r in L["rooms"]:
		if tx >= r[0] and tx <= r[2] and ty >= r[1] and ty <= r[3]:
			return r[4]
	return L["name"]

# ---------- постройка места ----------
func _bg(path_: String) -> Texture2D:
	if not bg_tex.has(path_):
		bg_tex[path_] = load("res://art/" + path_)
	return bg_tex[path_]

func go_loc(id: String) -> void:
	if lm_view.get_parent():
		lm_view.get_parent().remove_child(lm_view)
	if layer:
		layer.queue_free()
	for c in lm_root.get_children():
		c.queue_free()
	for n in npcs:
		n["node"] = null
	for a in ani:
		a["node"] = null
	king["node"] = null
	deco.clear()
	objs.clear()
	lights.clear()
	wins.clear()
	glows.clear()
	wglows.clear()
	beams.clear()
	parts.clear()
	trees.clear()
	loc_id = id
	L = D["locs"][id]
	sea_key = season_key()
	V = L["var"].get(sea_key, L["var"].values()[0])
	forge = Vector2(L["forge"][0], L["forge"][1]) if L.has("forge") else Vector2.ZERO
	layer = Node2D.new()
	add_child(layer)
	move_child(layer, 0)
	var back := ColorRect.new()
	back.color = Color8(26, 36, 24) if L["out"] else Color8(12, 10, 16)
	back.position = Vector2(-1000, -1000)
	back.size = Vector2(int(L["w"]) * CT + 2000, int(L["h"]) * CT + 2000)
	layer.add_child(back)
	var bg := Sprite2D.new()
	bg.centered = false
	bg.texture = _bg(V["bg"])
	layer.add_child(bg)
	for e in V["deco"]:
		var s := Art.sprite(e["f"][0])
		s.position = Vector2(e["x"], e["y"])
		layer.add_child(s)
		deco.append([s, e])
	fx0 = Node2D.new()
	fx0.draw.connect(_draw_parts.bind(0))
	layer.add_child(fx0)
	world = Node2D.new()
	world.y_sort_enabled = true
	layer.add_child(world)
	for e in V["objs"]:
		var s := Art.sprite(e["f"][0])
		s.position = Vector2(e["x"], e["sy"])
		s.offset = Vector2(0, float(e["y"]) - float(e["sy"]))
		world.add_child(s)
		if (e["f"] as Array).size() > 1:
			objs.append([s, e])
		if e.has("tree"):
			var sz := Art.size(e["f"][0])
			trees.append(Vector3(float(e["x"]) + sz.x / 2.0, float(e["y"]) + sz.y * 0.35, sz.x * 0.4))
	layer.add_child(lm_view)
	var glow := Node2D.new()
	glow.z_index = 60
	layer.add_child(glow)
	for l in L["lights"]:
		var s := _light_spr(Art.hexc(l["col"]))
		lm_root.add_child(s)
		lights.append([s, l])
		if l.has("fl"):
			var g := _light_spr(Art.hexc(l["col"]))
			g.position = Vector2(l["x"], l["y"])
			g.scale = Vector2.ONE * (18.0 / 64.0)
			glow.add_child(g)
			glows.append([g, l])
	for w in L["wins"]:
		var s := _light_spr(Color8(255, 176, 80))
		s.position = Vector2(w[0], w[1])
		s.scale = Vector2.ONE * ((32.0 if int(w[2]) else 22.0) / 64.0)
		lm_root.add_child(s)
		wins.append([s, w])
		var g := _light_spr(Color8(255, 192, 96))
		g.position = Vector2(w[0], w[1])
		g.scale = Vector2.ONE * (10.0 / 64.0)
		glow.add_child(g)
		wglows.append([g, w])
	if not L["out"]:
		for b in L["beams"]:
			var p1 := Polygon2D.new()
			p1.material = add_mat
			lm_root.add_child(p1)
			var p2 := Polygon2D.new()
			p2.material = add_mat
			glow.add_child(p2)
			beams.append([p1, p2, float(b[0]), float(b[1])])
		king_light = _light_spr(Color8(255, 240, 216))
		king_light.scale = Vector2.ONE * (60.0 / 64.0)
		lm_root.add_child(king_light)
	else:
		king_light = null
	fx1 = Node2D.new()
	fx1.material = add_mat
	fx1.draw.connect(_draw_parts.bind(1))
	glow.add_child(fx1)
	_sync_nodes()
	room = ""
	_room_check()

func _light_spr(c: Color) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = Art.light_tex
	s.material = add_mat
	s.modulate = c
	return s

func _vignette() -> Texture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.56, 1.0])
	g.colors = PackedColorArray([Color8(8, 6, 20, 0), Color8(8, 6, 20, 0), Color8(8, 6, 20, 255)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.width = 320
	gt.height = 180
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.08, 0.5)
	return gt

# ---------- люди и звери на экране ----------
func _walker(n: Dictionary) -> void:
	var nd := Node2D.new()
	var sh := Art.sprite(D["shadow"])
	nd.add_child(sh)
	var body := Art.sprite(n["sheet"][0][0])
	nd.add_child(body)
	world.add_child(nd)
	n["node"] = nd
	n["sh"] = sh
	n["body"] = body

func sort_key(n: Dictionary) -> float:
	if n.get("lie", false):
		return float(n["y"]) + 40.0
	if n.get("sit") != null:
		return float(n["y"]) + (-2.0 if n["sit"]["dir"] == "up" else 12.0)
	return float(n["y"])

func _update_walker(n: Dictionary) -> void:
	var nd: Node2D = n["node"]
	var body: Sprite2D = n["body"]
	var sh: Sprite2D = n["sh"]
	var rx := roundf(n["x"])
	var ry := roundf(n["y"])
	var np := Vector2(rx, roundf(sort_key(n)))
	nd.position = np
	var lie: bool = n.get("lie", false)
	var sit = n.get("sit")
	var moving: bool = n.get("moving", false) or n.get("path") != null
	var fi := 0
	if sit == null and not lie and moving:
		fi = int(float(n["f"]) / 7.0) % 4
	var dir: String = "down" if lie else n["dir"]
	var idx: int = n["sheet"][maxi(0, DIRS.find(dir))][fi]
	var x := rx - 8.0
	var y := ry - 31.0
	if lie:
		Art.set_frame(body, idx, 13)
		body.position = Vector2(x, ry - 20.0) - np
		sh.visible = false
	elif sit != null:
		if sit["dir"] == "up":
			Art.set_frame(body, idx)
			body.position = Vector2(x, y + 3.0) - np
		else:
			Art.set_frame(body, idx, 26)
			body.position = Vector2(x, y + 4.0) - np
		sh.visible = false
	else:
		Art.set_frame(body, idx)
		body.position = Vector2(x, y) - np
		sh.visible = true
		sh.position = Vector2(x + 2.0, ry - 2.0) - np
	body.modulate.a = 0.75 if (n == king and sneak and moving) else 1.0

func _animal(a: Dictionary) -> void:
	var nd := Node2D.new()
	var big := Art.size(a["f"][0]).x > 20.0
	var sh := Art.sprite(D["shadowBig"] if big else D["shadowSmall"])
	sh.position = Vector2(-11.0 if big else -4.5, -2.0)
	nd.add_child(sh)
	var body := Art.sprite(a["f"][0])
	nd.add_child(body)
	world.add_child(nd)
	a["node"] = nd
	a["body"] = body

func _update_animal(a: Dictionary) -> void:
	var nd: Node2D = a["node"]
	var body: Sprite2D = a["body"]
	var moving: bool = a["moving"] or a["fly"] > 0.0 or a["h"] > 0.0
	var fr := 0
	if moving:
		fr = int(a["fc"] / (3.0 if a["kind"] == "pigeon" else 5.0)) % 2
	elif a["peck"]:
		fr = 1
	var i: int = a["f"][fr]
	Art.set_frame(body, i)
	var sz := Art.size(i)
	body.flip_h = a["flip"]
	nd.position = Vector2(roundf(a["x"]), roundf(a["y"]))
	body.position = Vector2(-floorf(sz.x / 2.0), -sz.y - roundf(a["h"]))

func _sync_nodes() -> void:
	for n in npcs:
		var show: bool = n["loc"] == loc_id and not n["away"]
		if show and n["node"] == null:
			_walker(n)
		elif not show and n["node"] != null:
			(n["node"] as Node).queue_free()
			n["node"] = null
		if n["node"] != null:
			_update_walker(n)
	if king["node"] == null:
		_walker(king)
	_update_walker(king)
	for a in ani:
		if a["loc"] == loc_id:
			if a["node"] == null:
				_animal(a)
			_update_animal(a)

# ---------- ход времени ----------
func blocked() -> bool:
	return hud.is_open() or fade > 0.0

func _process(d: float) -> void:
	_tick(minf(d, 0.05))

func _tick(dt: float) -> void:
	t += dt
	people.pop_check()
	hud.tick()
	var run: bool = not hud.is_open() and fade == 0.0
	if run:
		var s0 := sea_key
		Game.advance(dt * meet.time_k())
		if L["out"] and season_key() != s0:
			go_loc(loc_id)
	var ha := Game.day * 24.0 + Game.hour_abs()
	if last_ha >= 0.0 and ha - last_ha > 0.75:
		people.snap(false)
	last_ha = ha
	var hh := floori(Game.hour_abs() * 2.0)
	if hh != last_hh:
		last_hh = hh
		aud.half_hour(hh / 2.0)
		meet.half_hour(hh / 2.0)
	if run:
		var k: float = NPC_SPDK[Game.speed]
		for n in npcs:
			people.sched_tick(n)
			people.update(n, dt * k)
		_ani_update(dt)
		_parts_update(dt)
		_player_update(dt)
	else:
		king["moving"] = false
	if fade == 0.0:
		meet.update()
		aud.auto()
	aud.tick()
	_cam_update(dt)
	if fade > 0.0:
		var ph := (t - fade_t) / 0.22
		if ph >= 1.0 and fade_fn.is_valid():
			var f := fade_fn
			fade_fn = Callable()
			f.call()
		fade = 0.0 if ph >= 2.0 else maxf(0.001, ph)
	_sync_nodes()
	for p in objs:
		var s: Sprite2D = p[0]
		var e: Dictionary = p[1]
		var fr: Array = e["f"]
		var i := 0
		if e.has("gate"):
			i = _gate_open(e)
		else:
			i = int(floorf(t * float(e["fps"]) + float(e["ph"]))) % fr.size()
		Art.set_frame(s, fr[i])
	var night := Game.is_night()
	for p in deco:
		var s: Sprite2D = p[0]
		var e: Dictionary = p[1]
		var fr: Array = e["f"]
		if e.has("night"):
			Art.set_frame(s, e["night"] if night else fr[0])
		elif fr.size() > 1:
			Art.set_frame(s, fr[int(floorf(t * float(e["fps"]) + float(e["ph"]))) % fr.size()])
		elif e.has("bob"):
			s.position.y = float(e["y"]) + (1.0 if int(floorf(t * 3.0 + float(e["ph"]))) % 4 == 2 else 0.0)
	_light()
	fx0.queue_redraw()
	fx1.queue_redraw()
	hud.queue_redraw()

func _gate_open(e: Dictionary) -> int:
	var w := Art.size(e["f"][0]).x
	var cx := float(e["x"]) + w / 2.0
	var cy := float(e["sy"]) - 4.0
	var r := w / 2.0 + 12.0
	var near := func(n: Dictionary) -> bool: return absf(float(n["x"]) - cx) < r and absf(float(n["y"]) - cy) < 20.0
	if near.call(king):
		return 1
	for n in npcs:
		if n["loc"] == loc_id and not n["away"] and near.call(n):
			return 1
	return 0

# ---------- свет (как courtRender в HTML) ----------
func _light() -> void:
	var h := Game.hour_abs()
	var amb: Vector3 = Game.ambient_out(h) if L["out"] else Game.ambient_in(h)
	if float(L["dark"]) > 0.0:
		amb *= float(L["dark"])
	var vw := 640.0 / Z + 2.0
	var vh := 360.0 / Z + 2.0
	var org := cam_tl.floor()
	if lm.size != Vector2i(int(vw), int(vh)):
		lm.size = Vector2i(int(vw), int(vh))
	lm.canvas_transform = Transform2D(0.0, -org)
	lm_amb.position = org
	lm_amb.size = Vector2(vw, vh)
	lm_amb.color = Color(minf(255.0, amb.x) / 255.0, minf(255.0, amb.y) / 255.0, minf(255.0, amb.z) / 255.0)
	lm_view.position = org
	var dark := clampf(1.0 - minf(amb.x, minf(amb.y, amb.z)) / 255.0, 0.0, 1.0)
	var dk := Game.day_k()
	var night := Game.is_night()
	var out: bool = L["out"]
	for p in lights:
		var s: Sprite2D = p[0]
		var l: Dictionary = p[1]
		if l.has("night") and dark < 0.3:
			s.visible = false
			continue
		s.visible = true
		var fl: float = l.get("fl", 0.0)
		var lx: float = l["x"]
		var ly: float = l["y"]
		var fk := 1.0 - fl * 0.5 + fl * 0.5 * sin(t * 11.0 + lx * 0.37) * sin(t * 4.3 + ly) if fl > 0.0 else 1.0
		s.position = Vector2(lx, ly)
		s.scale = Vector2.ONE * (float(l["r"]) * fk * 2.0 / 64.0)
		s.modulate.a = clampf(float(l["a"]) * (clampf(dark * 1.5, 0.0, 1.0) if out else 0.45 + dark * 0.8) * fk, 0.0, 1.0)
	for p in wins:
		var s: Sprite2D = p[0]
		var w: Array = p[1]
		s.visible = dark > 0.35
		s.modulate.a = clampf((dark - 0.35) * 2.0, 0.0, 0.9) * (0.85 + 0.15 * sin(t * 2.0 + float(w[0])))
	for p in wglows:
		var s: Sprite2D = p[0]
		s.visible = dark > 0.35
		s.modulate.a = clampf((dark - 0.35) * 1.5, 0.0, 0.55)
	for p in glows:
		var s: Sprite2D = p[0]
		var l: Dictionary = p[1]
		s.visible = not (l.has("night") and dark < 0.3)
		s.modulate.a = (0.16 + dark * 0.22) * (0.85 + 0.15 * sin(t * 13.0 + float(l["x"])))
	var sdx := (12.5 - h) * 3.0
	for b in beams:
		var p1: Polygon2D = b[0]
		var p2: Polygon2D = b[1]
		var bx: float = b[2]
		var by: float = b[3]
		var pts := PackedVector2Array([Vector2(bx - 7, by), Vector2(bx + 7, by), Vector2(bx + 9 + sdx, by + 62), Vector2(bx - 9 + sdx, by + 62)])
		p1.polygon = pts
		p2.polygon = pts
		if dk > 0.05:
			p1.visible = true
			p1.color = Color8(255, 236, 190, int(255 * 0.32 * dk))
			p2.visible = true
			p2.color = Color8(255, 240, 200, int(255 * 0.07 * dk))
		elif night:
			p1.visible = true
			p1.color = Color8(120, 140, 220, int(255 * 0.18))
			p2.visible = false
		else:
			p1.visible = false
			p2.visible = false
	if king_light:
		king_light.position = Vector2(king["x"], float(king["y"]) - 16.0)
		king_light.modulate.a = 0.15 + dark * 0.2
	vig.modulate.a = (dark - 0.2) * 0.6 if out and dark > 0.2 else 0.0
	hud.dark = dark

# ---------- король ----------
func _player_update(dt: float) -> void:
	var P := king
	var dx := 0.0
	var dy := 0.0
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):
		dx -= 1
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):
		dx += 1
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):
		dy -= 1
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):
		dy += 1
	sneak = Input.is_physical_key_pressed(KEY_SHIFT)
	if dx != 0.0 or dy != 0.0:
		path = []
		on_arrive = Callable()
		if P["sit"] != null:
			stand_up()
	elif not path.is_empty():
		var c: Vector2i = path[0]
		var gx := c.x * CT + 8.0
		var gy := c.y * CT + 11.0
		var e := Vector2(gx - P["x"], gy - P["y"])
		if e.length() < 2.0:
			path.pop_front()
			if path.is_empty() and on_arrive.is_valid():
				var f := on_arrive
				on_arrive = Callable()
				f.call()
		else:
			dx = e.x / e.length()
			dy = e.y / e.length()
	move_king(dx, dy, dt)

func move_king(dx: float, dy: float, dt: float) -> void:
	var P := king
	if P["sit"] != null:
		P["moving"] = false
		return
	if dx != 0.0 or dy != 0.0:
		var n := Vector2(dx, dy).length()
		var sp := (34.0 if sneak else 80.0) * dt
		var vx := dx / n * sp
		var vy := dy / n * sp
		var x0: float = P["x"]
		var y0: float = P["y"]
		if can_stand(x0 + vx, y0):
			P["x"] = x0 + vx
		if can_stand(P["x"], y0 + vy):
			P["y"] = y0 + vy
		walked += Vector2(float(P["x"]) - x0, float(P["y"]) - y0).length()
		P["f"] = float(P["f"]) + sp
		P["dir"] = ("right" if dx > 0 else "left") if absf(dx) > absf(dy) else ("down" if dy > 0 else "up")
		P["moving"] = true
		if not sneak and L["out"] and randf() < dt * 0.6:
			parts.append({"k": "dust", "x": float(P["x"]) + randf_range(-3, 3), "y": P["y"], "vx": 0.0, "vy": -4.0, "t": 0.0, "life": 0.5})
	else:
		P["moving"] = false
	var tx := floori(float(P["x"]) / CT)
	var ty := floori((float(P["y"]) - 2.0) / CT)
	for d in L["doors"]:
		if tx >= int(d["x0"]) and tx <= int(d["x1"]) and ty >= int(d["y0"]) and ty <= int(d["y1"]):
			go_through(d)
			break
	_room_check()

func _room_check() -> void:
	var rn := room_name(floori(float(king["x"]) / CT), floori((float(king["y"]) - 2.0) / CT))
	if rn != room:
		room = rn
		room_t = t

func go_through(d: Dictionary) -> void:
	if fade > 0.0:
		return
	path = []
	fade_to(func() -> void:
		king["x"] = float(d["ax"])
		king["y"] = float(d["ay"])
		king["dir"] = d["dir"]
		go_loc(d["to"])
		snap_cam()
		Sim.sfx("door")
		print("LOC ", d["to"]))

func fade_to(f: Callable) -> void:
	fade = 0.001
	fade_t = t
	fade_fn = f

func sit_at(sp: Dictionary) -> void:
	king["x"] = float(sp.get("sx", sp["x"]))
	king["y"] = float(sp.get("sy", sp["y"]))
	king["dir"] = sp["dir"]
	king["sit"] = sp
	king["lie"] = bool(sp.get("lie", false))
	path = []

func stand_up() -> void:
	var sp = king["sit"]
	if sp == null:
		return
	king["sit"] = null
	king["lie"] = false
	var c := near_free(loc_id, floori(float(sp["x"]) / CT), floori(float(sp["y"]) / CT) + (1 if sp["dir"] == "down" else 0))
	if sp == spots.get("throne"):
		c = Vector2i(23, 7)
	if sp == spots.get("seat_king"):
		c = Vector2i(38, 9)
	king["x"] = c.x * CT + 8.0
	king["y"] = c.y * CT + 11.0

# ---------- камера (camTarget/camUpdate в HTML) ----------
func _cam_target() -> Vector2:
	var vw := 640.0 / Z
	var vh := (360.0 - 19.0) / Z
	var x: float = float(king["x"]) - vw / 2.0
	var y: float = float(king["y"]) - 16.0 - vh / 2.0 - 19.0 / Z
	var mw := float(L["w"]) * CT
	var mh := float(L["h"]) * CT
	x = (mw - vw) / 2.0 if mw < vw else clampf(x, 0.0, mw - vw)
	y = mh / 2.0 - (360.0 + 19.0) / (2.0 * Z) if mh < vh else clampf(y, -19.0 / Z, maxf(0.0, mh - 360.0 / Z))
	return Vector2(x, y)

func snap_cam() -> void:
	cam_tl = _cam_target()
	cam.zoom = Vector2(Z, Z)
	cam.position = cam_tl

func _cam_update(dt: float) -> void:
	var tg := _cam_target()
	cam_tl += (tg - cam_tl) * (1.0 - exp(-dt * 7.0))
	if absf(tg.x - cam_tl.x) < 0.05:
		cam_tl.x = tg.x
	if absf(tg.y - cam_tl.y) < 0.05:
		cam_tl.y = tg.y
	cam.zoom = Vector2(Z, Z)
	cam.position = cam_tl

func w2s(p: Vector2) -> Vector2:
	return (p - cam_tl) * Z

# ---------- животные (aniUpdate в HTML) ----------
func _line_free(x0: float, y0: float, x1: float, y1: float) -> bool:
	var n := maxi(1, ceili(Vector2(x1 - x0, y1 - y0).length() / 6.0))
	for i in range(1, n + 1):
		if solid_at(loc_id, floori((x0 + (x1 - x0) * i / n) / CT), floori((y0 + (y1 - y0) * i / n) / CT)):
			return false
	return true

func _ani_update(dt: float) -> void:
	var P := king
	for a in ani:
		if a["loc"] != loc_id:
			continue
		var pd := Vector2(float(P["x"]) - a["x"], float(P["y"]) - a["y"]).length()
		var r: Array = a["r"]
		if a["kind"] == "pigeon":
			if a["fly"] > 0.0:
				a["fly"] -= dt
				a["x"] += a["vx"] * dt
				a["y"] += a["vy"] * dt
				a["h"] = minf(34.0, a["h"] + 46.0 * dt)
				a["fc"] += dt * 40.0
				continue
			if a["h"] > 0.0:
				a["h"] = maxf(0.0, a["h"] - 24.0 * dt)
				a["fc"] += dt * 40.0
				a["x"] = clampf(a["x"], r[0] * CT, (r[2] + 1) * CT)
				a["y"] = clampf(a["y"], r[1] * CT, (r[3] + 1) * CT)
				if a["h"] > 0.0:
					continue
			if pd < 30.0 and P["moving"] and not sneak:
				var an := atan2(a["y"] - float(P["y"]), a["x"] - float(P["x"])) + randf_range(-0.7, 0.7)
				a["fly"] = randf_range(0.7, 1.3)
				a["vx"] = cos(an) * 64.0
				a["vy"] = sin(an) * 40.0 - 12.0
				a["h"] = 1.0
				a["flip"] = a["vx"] > 0.0
				a["moving"] = false
				continue
		if a["moving"]:
			var dxy := Vector2(a["tx"] - a["x"], a["ty"] - a["y"])
			var sp: float = ANISP[a["kind"]] * (2.3 if a["run"] else 1.0) * dt
			if dxy.length() <= sp:
				a["x"] = a["tx"]
				a["y"] = a["ty"]
				a["moving"] = false
				a["run"] = false
				a["t"] = randf_range(1.5, 9.0 if a["kind"] == "horse" else 12.0 if a["kind"] == "cat" else 5.0)
			else:
				a["x"] += dxy.x / dxy.length() * sp
				a["y"] += dxy.y / dxy.length() * sp
				if absf(dxy.x) > 0.5:
					a["flip"] = dxy.x > 0.0
				a["fc"] += sp
			continue
		a["t"] -= dt
		a["peck"] = (a["kind"] == "hen" or a["kind"] == "pigeon") and sin(t * 6.0 + a["x"] * 0.7) > 0.7
		if a["kind"] == "dog" and pd < 96.0 and pd > 30.0 and P["moving"] and randf() < dt * 1.2:
			var tx: float = float(P["x"]) + randf_range(-18, 18)
			var ty: float = float(P["y"]) + randf_range(-4, 12)
			if not solid_at(loc_id, floori(tx / CT), floori(ty / CT)) and _line_free(a["x"], a["y"], tx, ty):
				a["tx"] = tx
				a["ty"] = ty
				a["moving"] = true
				a["run"] = true
				continue
		if a["t"] < 0.0:
			for k in 5:
				var tx: float = (r[0] + randf() * (r[2] - r[0] + 1)) * CT
				var ty: float = (r[1] + randf() * (r[3] - r[1] + 1)) * CT
				if not solid_at(loc_id, floori(tx / CT), floori(ty / CT)) and _line_free(a["x"], a["y"], tx, ty):
					a["tx"] = tx
					a["ty"] = ty
					a["moving"] = true
					break
			a["t"] = randf_range(1.0, 4.0)

# ---------- частицы (partsUpdate/drawParts в HTML) ----------
func _parts_update(dt: float) -> void:
	var night := Game.is_night()
	var sea := Game.season()
	var wx := 0.6
	if L["out"]:
		for s in L["smoke"]:
			if randf() < dt * 2.4:
				parts.append({"k": "smoke", "x": float(s[0]) + randf_range(-1, 1), "y": float(s[1]), "vx": wx * 5.0 + randf_range(-1.5, 1.5), "vy": -randf_range(7, 11), "t": 0.0, "life": randf_range(2.6, 4.2), "r": randf_range(1.2, 2.2)})
		if forge != Vector2.ZERO and randf() < dt * 5.0:
			parts.append({"k": "spark", "x": forge.x + randf_range(-5, 5), "y": forge.y + randf_range(-3, 3), "vx": randf_range(-14, 14), "vy": -randf_range(16, 34), "t": 0.0, "life": randf_range(0.3, 0.7)})
		if night and sea < 3:
			var nf := 0
			for p in parts:
				if p["k"] == "fly":
					nf += 1
			if nf < 12 and randf() < dt * 3.0:
				parts.append({"k": "fly", "x": randf_range(37, 47) * CT, "y": randf_range(4, 15) * CT, "vx": 0.0, "vy": 0.0, "t": 0.0, "life": randf_range(6, 12), "ph": randf() * 6.0})
		if sea == 2 or sea == 0:
			for tr in trees:
				if randf() < dt * (0.5 if sea == 2 else 0.25):
					var cols := ["#c86a28", "#e0a030", "#a8401c", "#d08a30"] if sea == 2 else ["#f4d0e0", "#ffffff", "#f0b8d0"]
					parts.append({"k": "leaf" if sea == 2 else "petal", "x": tr.x + randf_range(-tr.z, tr.z), "y": tr.y + randf_range(-6, 6), "vx": wx * 4.0 + randf_range(-3, 3), "vy": randf_range(5, 9), "t": 0.0, "life": randf_range(3, 5), "ph": randf() * 6.0, "gy": tr.y + randf_range(20, 40), "c": Color.html(cols[randi() % cols.size()])})
	elif not night and not L["beams"].is_empty():
		for b in L["beams"]:
			if randf() < dt * 1.2:
				parts.append({"k": "mote", "x": float(b[0]) + randf_range(-6, 16), "y": float(b[1]) + randf_range(8, 50), "vx": randf_range(-1, 1), "vy": randf_range(-1.5, 0.5), "t": 0.0, "life": randf_range(3, 6)})
	var i := parts.size() - 1
	while i >= 0:
		var p: Dictionary = parts[i]
		p["t"] += dt
		if p["t"] > p["life"]:
			parts.remove_at(i)
			i -= 1
			continue
		match p["k"]:
			"smoke":
				p["x"] += p["vx"] * dt
				p["y"] += p["vy"] * dt
				p["r"] += dt * 1.3
				p["vx"] += wx * dt * 1.5
			"spark":
				p["x"] += p["vx"] * dt
				p["y"] += p["vy"] * dt
				p["vy"] += 60.0 * dt
			"fly":
				p["ph"] += dt
				p["vx"] += (sin(p["ph"] * 1.7) * 8.0 - p["vx"]) * dt
				p["vy"] += (cos(p["ph"] * 1.3) * 6.0 - p["vy"]) * dt
				p["x"] += p["vx"] * dt
				p["y"] += p["vy"] * dt
			"leaf", "petal":
				if p["y"] < p["gy"]:
					p["ph"] += dt * 3.0
					p["x"] += (p["vx"] + sin(p["ph"]) * 6.0) * dt
					p["y"] += p["vy"] * dt
			_:
				p["x"] += p["vx"] * dt
				p["y"] += p["vy"] * dt
		i -= 1
	if parts.size() > 400:
		parts = parts.slice(parts.size() - 400)

func _draw_parts(layer_i: int) -> void:
	var n: Node2D = fx0 if layer_i == 0 else fx1
	for p in parts:
		var a: float = 1.0 - p["t"] / p["life"]
		var x := roundf(p["x"])
		var y := roundf(p["y"])
		var k: String = p["k"]
		if layer_i == 0:
			if k == "smoke":
				var r: float = p["r"]
				n.draw_rect(Rect2(roundf(p["x"] - r), roundf(p["y"] - r), roundf(r * 2.0), roundf(r * 2.0)), Color8(138, 132, 144, int(255 * 0.35 * a)))
				n.draw_rect(Rect2(roundf(p["x"] - r + 1.0), roundf(p["y"] - r), roundf(r), roundf(r)), Color8(200, 194, 204, int(255 * 0.25 * a)))
			elif k == "dust" or k == "puff":
				n.draw_rect(Rect2(x, y, 2, 1), Color8(200, 184, 152, int(255 * 0.4 * a)))
			elif k == "leaf" or k == "petal":
				var c: Color = p["c"]
				c.a = minf(1.0, a * 3.0)
				n.draw_rect(Rect2(x, y, 2 if (k == "leaf" and sin(p["ph"]) > 0.0) else 1, 1), c)
		else:
			if k == "spark":
				n.draw_rect(Rect2(x, y, 1, 1), Color8(255, 224, 128, int(255 * a)) if a > 0.5 else Color8(255, 128, 48, int(255 * a)))
			elif k == "fly":
				var b: float = (0.5 + 0.5 * sin(p["ph"] * 4.0)) * minf(1.0, minf(p["t"], p["life"] - p["t"]))
				n.draw_texture_rect(Art.light_tex, Rect2(x - 4, y - 4, 8, 8), false, Color(0.85, 1.0, 0.44, b * 0.5))
				n.draw_rect(Rect2(x, y, 1, 1), Color(0.94, 1.0, 0.63, b))
			elif k == "mote":
				n.draw_rect(Rect2(x, y, 1, 1), Color(1.0, 0.96, 0.82, 0.5 * minf(1.0, minf(p["t"], a * 2.0))))

# ---------- кто рядом: люди и действия (nearestTarget в HTML) ----------
func nearest_target() -> Dictionary:
	var P := king
	var fx: float = float(P["x"]) + {"left": -8.0, "right": 8.0}.get(P["dir"], 0.0)
	var fy: float = float(P["y"]) - 6.0 + {"up": -8.0, "down": 6.0}.get(P["dir"], 0.0)
	var best := {}
	var bd := 1e9
	for n in npcs:
		if n["loc"] != loc_id or n["away"] or (n["lines"] as Array).is_empty():
			continue
		var d := Vector2(float(n["x"]) - fx, float(n["y"]) - 6.0 - fy).length()
		if d < 24.0 and d < bd:
			bd = d
			best = {"n": n}
	for a in L["acts"]:
		if a["auto"]:
			continue
		var d := Vector2(float(a["x"]) - float(P["x"]), float(a["y"]) - float(P["y"]) + 4.0).length()
		if d < float(a["r"]) and d * 0.9 < bd:
			bd = d * 0.9
			best = {"a": a}
	return best

func interact(tg: Dictionary) -> void:
	if tg.has("n"):
		talk_to(tg["n"])
	elif tg.has("a"):
		do_act(tg["a"])

## разговор (talkTo): проситель — приём у трона, советник — его доклад и поручения, семья и воспитанники — свои
## разговоры с выбором, остальные — своими словами
func talk_to(n: Dictionary) -> void:
	if king["sit"] != null and n.get("seat", "") == "" and not n.has("petition"):
		stand_up()
	if n.get("sit") == null and n.get("path") == null:
		var v := Vector2(float(king["x"]) - n["x"], float(king["y"]) - n["y"])
		n["dir"] = ("right" if v.x > 0 else "left") if absf(v.x) > absf(v.y) else ("down" if v.y > 0 else "up")
	if n.has("petition"):
		aud.talk(n)
		print("TALK ", n["name"])
		return
	if String(n.get("seat", "")) != "" and SimPlayer.ensure_sim() and SimDyn.seatChar(n["seat"]) != null:
		meet.talk_seat(n)
		print("TALK ", n["name"])
		return
	if (n.has("fam") or String(n["key"]).begins_with("ward")) and SimPlayer.ensure_sim():
		people.pop_check()    # из выгрузки — в людей королевства (та же запись по ключу)
		if fam.talk(n):
			print("TALK ", n["name"])
			return
	var ls: Array = n["lines"]
	var line: String = ls[randi() % ls.size()]
	if n.has("staff"):
		people.say(n, line, 4.0)
	hud.say(n, line)
	print("TALK ", n["name"])

const KITCHEN := ["Из кухни тянет луком, дымом и свежим хлебом. Повариха гремит котлами.", "На кухне ощипывают кур. Кто-то напевает старую песню о походе на север.", "Поварята при виде короля роняют половник."]
const WELL := ["Глубокий колодец. Ведро скрипит на вороте.", "Вода в колодце сладкая — замок выдержит долгую осаду."]
func do_act(a: Dictionary) -> void:
	match a["id"]:
		"throne":
			sit_at(spots["throne"])
			if SimPlayer.ensure_sim():
				people.pop_check()
				aud.start()
		"council":
			sit_at(spots["seat_king"])
			if SimPlayer.ensure_sim():
				meet.sit()
		"maptable":
			to_map.emit()
		"research":
			hud.open_council("magister", "research")
		"eyeboard":
			hud.open_council("eye")
		"dovecote":
			hud.open_letters()
		"treasury":
			if SimPlayer.ensure_sim():
				meet.treasury()
		"barracks":
			if SimPlayer.ensure_sim():
				meet.barracks()
		"bed":
			var h := Game.hour_abs()
			if h >= 18.5 or h < 6.0:
				hud.toast("Король ложится спать…")
				sleep_until(6.5 + (24.0 if h >= 6.0 else 0.0))
			else:
				sleep_until(h + 2.0)
				hud.toast("Король отдыхает пару часов.")
		"kitchen":
			hud.say(null, KITCHEN[randi() % KITCHEN.size()])
		"well":
			hud.say(null, WELL[randi() % WELL.size()])
		"smithy":
			hud.say(null, "Кузнец бьёт молотом по раскалённой полосе. Наконечники копий, подковы, гвозди — кузня работает на войско.")
		"fountain":
			hud.say(null, "Вода в фонтане холодная и прозрачная. На дне блестят монеты — придворные бросают их на счастье.")
		"dummy":
			if t - practice_t > 1.2:
				practice_t = t
				king["dir"] = "up"
				parts.append({"k": "puff", "x": float(a["x"]), "y": float(a["y"]) - 10.0, "vx": 0.0, "vy": -6.0, "t": 0.0, "life": 0.6})
				hud.toast("Упражнение с мечом. Солдаты одобрительно гудят.")
		"gate":
			gate_act()
		"stable":
			gate_act("Конюх выводит осёдланного гнедого. «Куда поедем, государь?» В стойлах фыркают кони свиты.")
		_:
			hud.toast(String(a["label"]) + " — пока только в полной игре (HTML).")

## ворота замка (gateAct): выехать со свитой, во главе войска у столицы — или остаться. Королевство (Sim.G), если карту
## ещё не открывали, начинается здесь.
func gate_act(intro := "") -> void:
	if not SimPlayer.ensure_sim():
		hud.toast("Королевство не готово: нет данных мира.")
		return
	var C: Dictionary = Sim.G.court
	if JS.n(C.get("regent", -1)) >= 0:
		hud.say(null, "Стража скрещивает копья: «Регент " + SimPlayer.regentName() + " не велел выпускать юного государя за ворота. Подождите совершеннолетия, ваше величество».")
		return
	var ca: Variant = SimPlayer.capitalArmy()
	var kn: Variant = Sim.charOf(ca.gen) if ca != null else null
	var ret: Variant = C.get("retinue")
	var ch: Array = [{"t": "Выехать со свитой (" + JS.s(Sim.armyMen(ret) if ret is Dictionary else 22.0) + " чел.)", "tip": "Король сам поедет по королевству. Двор будет жить без него.", "fx": func(): ride_out.emit(null)}]
	if ca != null:
		ch.append({"t": "Возглавить войско у столицы (" + JS.s(Sim.armyMen(ca)) + (", " + Sim.charName(kn) if kn != null else "") + ")", "tip": "Король ведёт войско сам: битвы — под вашей рукой.", "fx": func(): ride_out.emit(ca)})
	ch.append({"t": "Остаться в замке", "fx": func(): pass})
	hud.say(null, intro if intro != "" else "Ворота замка. За ними — дороги, деревни, граница и война. Кто правит из седла, видит всё своими глазами — но и двор живёт без него.",
		{"name": "Выезд из замка", "choices": ch, "esc": ch.size() - 1})
	print("GATE ", ch.size())

## часы вперёд наяву (advanceHours): пересчитать казну и т. п.; королевство догонит само
func advance_hours(h: float) -> void:
	var ha := Game.hour_abs() + h
	if ha >= 29.0:
		Game.day += 1
		ha -= 24.0
	Game.frac = clampf((ha - 5.0) / 24.0, 0.0, 0.9999)
	people.snap(false)
	last_ha = Game.day * 24.0 + Game.hour_abs()

func sleep_until(ha: float) -> void:
	fade_to(func() -> void:
		if ha >= 29.0:
			Game.day += 1
			ha -= 24.0
		Game.frac = clampf((ha - 5.0) / 24.0, 0.0, 0.9999)
		people.snap(false)
		last_ha = Game.day * 24.0 + Game.hour_abs())

# щелчок мышью: идти туда; по человеку или предмету — подойти и заговорить/сделать
func click(sp: Vector2) -> void:
	if blocked():
		return
	var w := cam_tl + sp / Z
	for n in npcs:
		if n["loc"] != loc_id or n["away"] or (n["lines"] as Array).is_empty():
			continue
		if w.x > float(n["x"]) - 8.0 and w.x < float(n["x"]) + 8.0 and w.y > float(n["y"]) - 30.0 and w.y < float(n["y"]) + 2.0:
			_walk_to(Vector2(n["x"], n["y"]), func() -> void: talk_to(n), 26.0)
			return
	for a in L["acts"]:
		if not a["auto"] and Vector2(float(a["x"]) - w.x, float(a["y"]) - w.y).length() < maxf(14.0, float(a["r"]) * 0.7):
			_walk_to(Vector2(a["x"], a["y"]), func() -> void: do_act(a), float(a["r"]) + 4.0)
			return
	_walk_to(w, Callable(), 0.0)

func _walk_to(w: Vector2, then: Callable, near: float) -> void:
	if near > 0.0 and w.distance_to(Vector2(king["x"], king["y"])) < near:
		then.call()
		return
	if king["sit"] != null:
		stand_up()
	var b := near_free(loc_id, floori(w.x / CT), floori(w.y / CT))
	var p = find_path(loc_id, Vector2i(floori(float(king["x"]) / CT), floori((float(king["y"]) - 2.0) / CT)), b)
	if p == null:
		hud.toast("Туда не пройти.")
		return
	path = p
	on_arrive = then

# ---------- мышь и клавиши ----------
## щелчок — по месту отпускания (dispatchClicks): над окнами, кнопками верхней строки и «E — …» — окнам, иначе — идти
var down_at = null            # {at, ui}: где нажали левую кнопку и было ли это над окнами

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		var mp: Vector2 = hud.get_local_mouse_position()
		var b: int = e.button_index
		if e.pressed:
			if b == MOUSE_BUTTON_LEFT:
				down_at = {"at": mp, "ui": hud.capture(mp)}
			elif b == MOUSE_BUTTON_RIGHT:
				if hud.is_open():
					hud.click({"x": mp.x, "y": mp.y, "ux": mp.x, "uy": mp.y, "b": 2, "drag": false})
				else:
					path = []
			elif b == MOUSE_BUTTON_WHEEL_UP or b == MOUSE_BUTTON_WHEEL_DOWN:
				if hud.is_open():
					hud.wheel = -1 if b == MOUSE_BUTTON_WHEEL_UP else 1
				else:
					Z = 2 if b == MOUSE_BUTTON_WHEEL_UP else 1
		elif b == MOUSE_BUTTON_LEFT and down_at != null:
			var d: Dictionary = down_at
			down_at = null
			if d.ui or hud.is_open():
				hud.click({"x": d.at.x, "y": d.at.y, "ux": mp.x, "uy": mp.y, "b": 0, "drag": (d.at as Vector2).distance_to(mp) > 3.0})
			else:
				click(mp)
		return
	if not (e is InputEventKey and e.pressed and not e.echo):
		return
	key(e.physical_keycode)

## клавиша двора (courtKeys): разговор, окна (K — совет, L — письма; Esc закрывает), весть ждёт ответа; потом — двор
func key(k: int) -> void:
	if hud.dlg_open():
		hud.dlg_key(k)
		return
	if k == KEY_ESCAPE:
		if hud.win != null:
			hud.win = null
		elif hud.modals.is_empty():
			leave.emit()
		return
	if not hud.modals.is_empty():
		return
	if k == KEY_K or k == KEY_L:
		hud.toggle_win("council" if k == KEY_K else "letters")
		return
	if hud.win != null:
		return
	match k:
		KEY_E, KEY_ENTER, KEY_KP_ENTER:
			var tg := nearest_target()
			if not tg.is_empty():
				interact(tg)
			elif king["sit"] != null:
				stand_up()
		KEY_SPACE:
			Game.toggle_pause()
		KEY_0, KEY_1, KEY_2, KEY_3:
			Game.ui_speed(k - KEY_0)
		KEY_KP_0, KEY_KP_1, KEY_KP_2, KEY_KP_3:
			Game.ui_speed(k - KEY_KP_0)
		KEY_Z:
			Z = 1 if Z == 2 else 2
			snap_cam()
		KEY_H, KEY_F1:
			hud.help = not hud.help
			hud.help_auto = false
		KEY_TAB:
			to_map.emit()

# ---------- команды для тестов веб-сборки (window.slovo('…')) ----------
func npc_by(s: String) -> Dictionary:
	if s.is_valid_int():
		return npcs[int(s)]
	for n in npcs:
		if n["key"] == s:
			return n
	return {}

func cmd(p: PackedStringArray) -> void:
	match p[0]:
		"goto":
			var n := npc_by(p[1])
			if n.is_empty():
				return
			if n["loc"] != loc_id:
				go_loc(n["loc"])
			if n["away"]:
				n["away"] = false
			stand_up()
			for o in [Vector2(0, 14), Vector2(14, 0), Vector2(-14, 0), Vector2(0, -14)]:
				var q: Vector2 = Vector2(n["x"], n["y"]) + o
				if can_stand(q.x, q.y):
					king["x"] = q.x
					king["y"] = q.y
					break
			var v := Vector2(n["x"], n["y"]) - Vector2(king["x"], king["y"])
			king["dir"] = ("right" if v.x > 0 else "left") if absf(v.x) > absf(v.y) else ("down" if v.y > 0 else "up")
			snap_cam()
		"spot":
			var sp: Dictionary = spots.get(p[1], {})
			if sp.is_empty():
				return
			stand_up()
			if sp["loc"] != loc_id:
				go_loc(sp["loc"])
			king["x"] = float(sp["x"])
			king["y"] = float(sp["y"])
			king["dir"] = sp["dir"]
			snap_cam()
		"talk":
			var tg := nearest_target()
			if tg.has("n"):
				interact(tg)
		"act":
			var tg := nearest_target()
			if tg.has("a"):
				interact(tg)
		"next":
			hud.advance()
		"choose":
			hud.choose(int(p[1]) - 1)
		"gate":
			gate_act()
		"close":
			if hud.dlg_open():
				hud.close_dlg()
			elif not hud.modals.is_empty():
				hud.close_modal()
			else:
				hud.win = null
		"win":
			hud.toggle_win(p[1])
		"click":
			# щелчок, как мышью (окна, кнопки верхней строки, «E — …»; мимо — идти туда)
			var mp := Vector2(float(p[1]), float(p[2]))
			if hud.capture(mp) or hud.is_open():
				hud.click({"x": mp.x, "y": mp.y, "ux": mp.x, "uy": mp.y, "b": 0, "drag": false})
			else:
				click(mp)
		"hover":
			hud.hover_at = Vector2(float(p[1]), float(p[2]))
		"tab":
			if hud.win != null:
				hud.win.tab = int(p[1])
				hud.win.sc = 0
		"key":
			key(OS.find_keycode_from_string(p[1]))
		"throne":
			# сесть на трон — приём прошений
			cmd(PackedStringArray(["spot", "throne_front"]))
			do_act({"id": "throne", "label": ""})
		"council":
			# созвать совет (как кнопка в окне) или сесть во главе стола
			if p.size() > 1 and p[1] == "sit":
				cmd(PackedStringArray(["spot", "seat_king"]))
				do_act({"id": "council", "label": ""})
			elif SimPlayer.ensure_sim():
				meet.call_council()
		"walk":
			for i in int(float(p[3]) * 60.0):
				move_king(float(p[1]), float(p[2]), 1.0 / 60.0)
			king["moving"] = false
		"zoom":
			Z = clampi(int(p[1]), 1, 2)
			snap_cam()
		"state":
			print("STATE ", JSON.stringify(state()))

func state() -> Dictionary:
	var here := 0
	var away := 0
	for n in npcs:
		if n["loc"] == loc_id and not n["away"]:
			here += 1
		if n["away"] or n.get("lie", false):
			away += 1
	var cnt := {"fam": 0, "seats": 0, "pris": 0, "pets": 0}
	for n in npcs:
		if n.has("fam"):
			cnt.fam += 1
		if String(n.get("seat", "")) != "":
			cnt.seats += 1
		if n.has("pris"):
			cnt.pris += 1
		if n.get("petition") is Dictionary:
			cnt.pets += 1
	var verd: Array = Sim.G.court.get("verdicts", []) if aud.ok() else []
	return {"day": Game.day, "hour": snappedf(Game.hour(), 0.01), "loc": loc_id, "room": room, "king": [int(king["x"]), int(king["y"])], "dir": king["dir"], "sit": king["sit"] != null, "talk": hud.dlg_open(), "choosing": hud.dlg_choosing(), "here": here, "asleep": away, "npcs": npcs.size(), "walked": int(walked), "dark": snappedf(hud.dark, 0.01), "zoom": Z, "fade": fade > 0.0, "sea": sea_key,
		"win": String(hud.win.k) if hud.win != null else "", "modals": hud.modals.size(), "meet": meet.meeting_open(),
		"fam": cnt.fam, "seats": cnt.seats, "pris": cnt.pris, "pets": cnt.pets, "verd": verd.size(), "by": String(verd[0].by) if not verd.is_empty() else "", "snd": Snd.state()}

# самопроверка без экрана: сутки двора, люди ходят между местами, король ходит, стены держат, двери ведут, разговор открывается
func selftest() -> bool:
	var ok: bool = Art.ok and D["locs"].size() >= 7 and npcs.size() >= 30
	print("selftest: мест ", D["locs"].size(), ", людей ", npcs.size(), ", животных ", ani.size(), ", спрайтов ", (D["spr"] as Array).size())
	Game.speed = 3
	var locs0 := {}
	for n in npcs:
		locs0[n["key"]] = n["loc"]
	var moved := {}
	var asleep := 0
	var w0 := {}
	for n in npcs:
		w0[n["key"]] = 0.0
	for i in 1300:
		var before := {}
		for n in npcs:
			before[n["key"]] = [n["loc"], Vector2(n["x"], n["y"])]
		_tick(0.05)
		for n in npcs:
			if n["loc"] != locs0[n["key"]]:
				moved[n["key"]] = true
			var b: Array = before[n["key"]]
			if n["loc"] == b[0]:
				w0[n["key"]] += Vector2(n["x"], n["y"]).distance_to(b[1])
		if absf(Game.hour_abs() - 26.0) < 0.02:
			asleep = 0
			for n in npcs:
				if n["away"] or n.get("lie", false):
					asleep += 1
	var walkers := 0
	for k in w0:
		if w0[k] > 150.0:
			walkers += 1
	print("selftest: день ", Game.day, " ", Game.clock_text(), ", сменили место ", moved.size(), ", ходили ", walkers, ", ночью спят ", asleep)
	ok = ok and Game.day >= 1 and moved.size() >= 10 and walkers >= 12 and asleep >= 12
	Game.speed = 1
	Game.set_hour(12.0)
	people.snap(false)
	cmd(PackedStringArray(["spot", "throne_front"]))
	var x0: float = king["x"]
	for i in 60:
		move_king(1, 0, 1.0 / 60.0)
	ok = ok and float(king["x"]) > x0 + 40.0
	cmd(PackedStringArray(["spot", "throne_front"]))
	for i in 180:
		move_king(0, -1, 1.0 / 60.0)
	var wall: bool = float(king["y"]) > 60.0
	print("selftest: король ", Vector2(king["x"], king["y"]), " (стены держат: ", wall, ")")
	ok = ok and wall
	cmd(PackedStringArray(["spot", "keep_door"]))
	for i in 200:
		_tick(1.0 / 60.0)
		if loc_id == "keep" and fade == 0.0:
			break
	print("selftest: дверь в замок → ", loc_id)
	ok = ok and loc_id == "keep"
	var g := npc_by("grd_gate_l")
	cmd(PackedStringArray(["goto", "grd_gate_l"]))
	cmd(PackedStringArray(["talk"]))
	var talked: bool = hud.dlg_open()
	for i in 4:
		hud.advance()
	ok = ok and talked and not hud.dlg_open() and loc_id == g["loc"]
	print("selftest: разговор ", talked, " → ", JSON.stringify(state()))
	return ok

## совет на данных королевства (без экрана): срочный сбор днём, король идёт во главе стола — советники сходятся
## и садятся, заседание (доклады, «что прикажет государь»), никто не встаёт раньше короля
func council_test() -> bool:
	if not meet.ok():
		print("selftest: совет — нет королевства")
		return false
	Game.speed = 3
	Game.set_hour(14.0)
	people.snap(false)
	last_ha = -1.0     # без «перевода часов»: советники идут к столу сами
	var why: String = meet.can_call()
	var called: bool = meet.call_council()
	var pr: Dictionary = meet.presence()
	print("selftest: совет — созыв ", called, " (", why, "): придут ", pr.come.size(), ", в отъезде ", pr.away.size(), ", больны ", pr.sick.size(), ", пустуют ", pr.vac.size())
	for i in 10:
		if hud.dlg_choosing() or not hud.dlg_open():
			break
		hud.advance()
	var asked: bool = hud.dlg_choosing()
	hud.choose(0)
	var ran := false
	var fr := 0
	var trace := PackedStringArray()   # кто где, пока сходятся (печать — если совет не собрался)
	while fr < 4000 and not ran:
		_tick(0.05)
		fr += 1
		ran = hud.dlg_open()
		if fr % 40 == 0 and fr <= 400:
			var a := PackedStringArray()
			for e in pr.come:
				var n: Dictionary = e.n
				a.append("%s %s (%d,%d) %s%s п%d" % [String(n["key"]).substr(5, 4), n["loc"], n["x"], n["y"], n["cur"], "✓" if meet.seated_now(n) else "", (n["path"] as Array).size() if n["path"] is Array else -1])
			trace.append("  " + Game.clock_text() + " " + " | ".join(a))
	var C: Dictionary = Sim.G.court
	print("selftest: совет — выбор ", asked, ", кадров ", fr, ", ", Game.clock_text(), ", король за столом ", meet.king_at_table(), ", заседание ", ran, " (meetDone ", C.get("meetDone"), ")")
	if not ran:
		print("\n".join(trace))
		for e in pr.come:
			var n: Dictionary = e.n
			print("  ", n["key"], " ", n["loc"], " ", Vector2(n["x"], n["y"]), " sit ", n["sit"] != null, " сел ", meet.seated_now(n), " cur ", n["cur"], " путь ", (n["path"] as Array).size() if n["path"] is Array else -1, " ov ", n.get("override"))
	var reps := 0
	for i in 40:
		if not hud.dlg_open():
			break
		if hud.dlg_choosing():
			hud.choose(1)
		else:
			reps += 1
			hud.advance()
	for i in 20:
		_tick(0.05)
	var held: bool = pr.come.all(func(e): return meet.seated_now(e.n))
	stand_up()
	for i in 20:
		_tick(0.05)
	var rose: bool = pr.come.all(func(e): return e.n.get("override") == null)
	print("selftest: совет — докладов ", reps, ", сидят до короля ", held, ", встали после ", rose)
	Game.speed = 1
	return called and asked and ran and reps >= 1 and held and rose and float(C.get("meetDone", -1.0)) == float(Game.day)

## двор из королевства (без экрана): кто живёт при дворе (семья, воспитанники, совет, слуги, стража, узники), облик
## и постели; новый советник — сразу при дворе; приём прошений: в 8:30 просители у ворот, король на троне — подходят
## по одному, решение короля и судьи — в книге суда, решённые уходят за ворота; оставшихся после полудня рассматривает судья
func people_test() -> bool:
	if not aud.ok():
		print("selftest: двор — нет королевства")
		return false
	var G := Sim.G
	people.pop_check()
	var cnt := {"fam": 0, "seat": 0, "srv": 0, "bed": 0, "look": 0, "g": 0}
	for n in npcs:
		var k := String(n["key"])
		if n.has("fam"):
			cnt.fam += 1
		if String(n.get("seat", "")) != "":
			cnt.seat += 1
		if k.begins_with("srv_") or k.begins_with("grd_"):
			cnt.srv += 1
		if n.has("bed") and not spots.get(n["bed"], {}).is_empty():
			cnt.bed += 1
		if n.has("cid"):
			cnt.g += 1
			if int(n["port"]) >= 0 and n["sheet"] is Array and (n["sheet"] as Array).size() == 4:
				cnt.look += 1
	var nseat := 0
	for s: Dictionary in Sim.SEATS:
		var ch: Variant = SimDyn.seatChar(s.k)
		if ch != null and not JS.t(ch.get("away")):
			nseat += 1
	var q := npc_by("spouse")
	print("selftest: двор из королевства — людей ", npcs.size(), ", семья ", cnt.fam, ", совет ", cnt.seat, " из ", nseat, ", слуги и стража ", cnt.srv,
		", с постелью ", cnt.bed, ", облик из королевства ", cnt.look, " из ", cnt.g, "; ", q.get("name", "—"), " — ", q.get("sub", ""))
	var ok: bool = cnt.fam >= 1 and cnt.seat == nseat and cnt.srv >= 20 and cnt.bed >= cnt.seat + 1 and cnt.look == cnt.g and npcs.size() >= 30
	# новый советник (пустое место) — при дворе сразу, с благодарностью
	var vac := ""
	for s: Dictionary in Sim.SEATS:
		if SimDyn.seatChar(s.k) == null and not SimCourt.candidatesFor(s.k).is_empty():
			vac = String(s.k)
			break
	if vac != "":
		var cand: Dictionary = SimCourt.candidatesFor(vac)[0]
		SimCourt.appointSeat(vac, cand.id)
		hud.appointed(vac)
		var sn := npc_by("seat_" + vac)
		print("selftest: назначен ", sn.get("name", "—"), " (", sn.get("sub", ""), "): «", sn.get("bub", ""), "», постель ", sn.get("bed", "—"))
		ok = ok and not sn.is_empty() and String(sn.get("bub", "")).begins_with("Благодарю") and sn.get("bed", "") == "bed_" + vac
	# приём прошений
	Game.speed = 1
	Game.set_hour(8.4)
	last_hh = floori(Game.hour_abs() * 2.0)
	people.snap(false)
	last_ha = Game.day * 24.0 + Game.hour_abs()
	var v0: int = (G.court.get("verdicts", []) as Array).size()
	var fr := 0
	while fr < 400 and not aud.pending():
		_tick(0.05)
		fr += 1
	var npet: int = npcs.filter(func(n): return n.get("petition") is Dictionary).size()
	print("selftest: прошения — ", Game.clock_text(), ", просителей у ворот ", npet)
	cmd(PackedStringArray(["throne"]))
	var wait_s: String = String(hud.dlg["pages"][0][0]) if hud.dlg_open() else ""
	hud.close_dlg()
	var r1 := _hear(false)
	# ещё просители, пока король на троне (снова утро): первого — верховному судье
	Game.set_hour(9.0)
	last_hh = floori(Game.hour_abs() * 2.0)
	last_ha = Game.day * 24.0 + Game.hour_abs()
	var n1: int = aud.spawn()
	var r2 := _hear(true)
	var heard: int = r1[0] + r2[0]
	var by_judge: int = r1[1] + r2[1]
	var V: Array = G.court.get("verdicts", [])
	var nk := 0
	for i in V.size() - v0:
		if V[i].by == "king":
			nk += 1
	var fr2 := 0
	while fr2 < 3000 and npcs.any(func(n): return String(n["key"]).begins_with("pet")):
		_tick(0.05)
		fr2 += 1
	var left: int = npcs.filter(func(n): return String(n["key"]).begins_with("pet")).size()
	print("selftest: прошения — «", wait_s, "»; выслушано ", heard, " из ", npet + n1, " (судье ", by_judge, "), в книге суда +", V.size() - v0, " (король ", nk, "), ",
		Game.clock_text(), ", кадров ", r1[2], " и ", r2[2], ", ушли за ворота за ", fr2, " кадров (осталось ", left, ")")
	ok = ok and npet >= 1 and n1 >= 1 and heard == npet + n1 and V.size() - v0 == heard and nk == heard - by_judge and left == 0 \
		and (by_judge == 1 or SimDyn.seatChar("justice") == null)
	# без короля на троне: после полудня оставшихся рассматривает судья
	stand_up()
	var n2: int = aud.spawn()
	Game.set_hour(12.4)
	last_hh = floori(Game.hour_abs() * 2.0)
	last_ha = Game.day * 24.0 + Game.hour_abs()
	var v1: int = (G.court.verdicts as Array).size()
	fr = 0
	while fr < 400 and aud.pending():
		_tick(0.05)
		fr += 1
	var dj: int = (G.court.verdicts as Array).size() - v1
	print("selftest: прошения после полудня — пришло ", n2, ", решено без короля ", dj, " (", (G.court.verdicts[0].by if dj > 0 else "—"), "), ", Game.clock_text())
	ok = ok and n2 >= 1 and dj >= 1 and not aud.pending()
	hud.close_dlg()
	return ok

## приём у трона, пока все прошения не решены: каждого выслушать — решает король (первое решение) или, если judge,
## первого — верховному судье; [выслушано, судье, кадров]
func _hear(judge: bool) -> Array:
	var heard := 0
	var by_judge := 0
	var fr := 0
	while fr < 6000 and (aud.pending() or hud.dlg_open()):
		_tick(0.05)
		fr += 1
		if not hud.dlg_open():
			continue
		for i in 10:
			if hud.dlg_choosing():
				break
			hud.advance()
		if not hud.dlg_choosing():
			hud.close_dlg()
			continue
		var chs: Array = hud.dlg["choices"]
		var pick := chs.size() - 1 if judge and heard == 0 and String(chs[-1].t) == "Передать верховному судье" else 0
		if pick > 0:
			by_judge += 1
		heard += 1
		hud.choose(pick)
		if hud.dlg_open() and not hud.dlg_choosing():
			hud.close_dlg()
	return [heard, by_judge, fr]
