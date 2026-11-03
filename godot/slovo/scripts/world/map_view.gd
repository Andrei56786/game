extends CanvasLayer
## Экран карты королевства — перенос main.js/render.js (drawMapBase, drawChunks, камера): обзорная карта и куски полной
## детализации от MapGPU, границы и державы цветом, масштабы 1/8…2 (колесо, Q/E), перетаскивание мышью, WASD и стрелки.
## Поверх — поселения, подписи, мини-карта и верхняя строка (map_hud.gd). Вид года — по дню (MapGPU.set_day): обзор
## перекрашивается сразу, видимые куски — по два за кадр. Время на карте пока не идёт.
signal leave
const MapHud = preload("res://scripts/world/map_hud.gd")
const ZOOMS := [0.125, 0.25, 0.5, 1.0, 2.0]
const SW := 640.0
const SH := 360.0
const CH := MapGPU.CH
const WPW := WorldData.WPW
const WPH := WorldData.WPH
const PANK := {KEY_W: Vector2(0, -1), KEY_UP: Vector2(0, -1), KEY_S: Vector2(0, 1), KEY_DOWN: Vector2(0, 1), KEY_A: Vector2(-1, 0), KEY_LEFT: Vector2(-1, 0), KEY_D: Vector2(1, 0), KEY_RIGHT: Vector2(1, 0)}

var G: MapGPU
var cam := Vector3(WPW / 2.0, WPH / 2.0, 1.0)
var mode := "ter"
var base: ColorRect
var wash: ColorRect
var chn: Node2D
var pool: Array[Sprite2D] = []
var ch_mat: ShaderMaterial
var hud: Control
var on := false            # материалы готовы (MapGPU.ok)
var pre_t := 0.0
var down := {}             # кнопка мыши → {at, moved}
var dragging := false
var centered := false
var sw := PackedVector2Array()   # поселения: точка на картинке (settWorld)
var vis := {"n": 0, "miss": 0, "made": 0}

func _ready() -> void:
	layer = 1
	base = ColorRect.new()
	base.size = Vector2(SW, SH)
	base.color = Color8(26, 56, 102)
	base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(base)
	chn = Node2D.new()
	add_child(chn)
	wash = ColorRect.new()
	wash.size = Vector2(SW, SH)
	wash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	wash.visible = false
	add_child(wash)
	hud = MapHud.new()
	hud.mv = self
	add_child(hud)

func _setup() -> void:
	on = true
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/map_show_over.gdshader")
	for k in ["over", "qp", "own"]:
		m.set_shader_parameter(k + "_tex", G.T[k])
	base.material = m
	var mw := ShaderMaterial.new()
	mw.shader = load("res://shaders/map_show_wash.gdshader")
	mw.set_shader_parameter("qp_tex", G.T.qp)
	mw.set_shader_parameter("own_tex", G.T.own)
	wash.material = mw
	ch_mat = ShaderMaterial.new()
	ch_mat.shader = load("res://shaders/map_show_chunk.gdshader")
	ch_mat.set_shader_parameter("own_tex", G.T.own)
	sw.resize(G.W.setts.size())
	for s: Dictionary in G.W.setts:
		sw[s.id] = G.tile_center(s.i)
	if not centered:
		center_capital()

## к столице державы игрока (openMapFromCourt)
func center_capital() -> void:
	centered = true
	for s: Dictionary in G.W.setts:
		if s.type == "capital" and G.own[s.prov] == 0:
			cam.x = sw[s.id].x
			cam.y = sw[s.id].y
	clamp_cam()

# ---------- камера (render.js: cam, camClamp, w2s, s2w; main.js: zoomAt) ----------
func clamp_cam() -> void:
	var vw := SW / cam.z
	var vh := SH / cam.z
	cam.x = clampf(cam.x, minf(vw / 2.0, WPW / 2.0), maxf(WPW - vw / 2.0, WPW / 2.0))
	cam.y = clampf(cam.y, minf(vh / 2.0 - 20.0 / cam.z, WPH / 2.0), maxf(WPH - vh / 2.0 + 40.0 / cam.z, WPH / 2.0))

func w2s(p: Vector2) -> Vector2:
	return Vector2(floorf((p.x - cam.x) * cam.z + SW / 2.0 + 0.5), floorf((p.y - cam.y) * cam.z + SH / 2.0 + 0.5))

func s2w(s: Vector2) -> Vector2:
	return Vector2((s.x - SW / 2.0) / cam.z + cam.x, (s.y - SH / 2.0) / cam.z + cam.y)

func zoom_at(dir: int, s: Vector2) -> void:
	var i := ZOOMS.find(cam.z)
	var j := clampi((3 if i < 0 else i) + dir, 0, ZOOMS.size() - 1)
	if ZOOMS[j] == cam.z:
		return
	var w := s2w(s)
	cam.z = ZOOMS[j]
	cam.x = w.x - (s.x - SW / 2.0) / cam.z
	cam.y = w.y - (s.y - SH / 2.0) / cam.z
	clamp_cam()

## клетка под точкой экрана (tileAtScreen), −1 — вне мира
func tile_at(s: Vector2) -> int:
	var w := s2w(s)
	if w.x < 0 or w.y < 0 or w.x >= WPW or w.y >= WPH:
		return -1
	return G.px_tile(int(w.x), int(w.y))

func set_mode(m: String) -> void:
	mode = "pol" if m == "pol" else "ter"

# ---------- кадр ----------
func _process(dt: float) -> void:
	if G == null or not G.ok:
		hud.queue_redraw()
		return
	if not on:
		_setup()
	G.set_day(Game.day)
	var d := Vector2.ZERO
	for k in PANK:
		if Input.is_physical_key_pressed(k):
			d += PANK[k]
	if d != Vector2.ZERO:
		var sp := 320.0 / cam.z * minf(dt, 0.05) * (2.2 if Input.is_physical_key_pressed(KEY_SHIFT) else 1.0)
		cam.x += d.x * sp
		cam.y += d.y * sp
	clamp_cam()
	var z := cam.z
	var bm := base.material as ShaderMaterial
	bm.set_shader_parameter("cam", cam)
	bm.set_shader_parameter("borders", z < 0.5)
	bm.set_shader_parameter("wash_on", mode == "pol" and z < 0.5)
	wash.visible = mode == "pol" and z >= 0.5
	if wash.visible:
		(wash.material as ShaderMaterial).set_shader_parameter("cam", cam)
	if z >= 0.5:
		_chunks()
	else:
		for s in pool:
			s.visible = false
	hud.queue_redraw()

func _sprite(k: int) -> Sprite2D:
	while pool.size() <= k:
		var s := Sprite2D.new()
		s.centered = false
		s.region_enabled = true
		s.region_rect = Rect2(MapGPU.VM, MapGPU.VM, CH, CH)
		s.material = ch_mat
		chn.add_child(s)
		pool.append(s)
	return pool[k]

## куски в окне (drawChunks): готовые — на экран, недостающие — ближайшие к середине, хотя бы один за кадр;
## если всё на месте — заранее рисуется соседний (не чаще 8 раз в секунду, пока кэш не полон)
func _chunks() -> void:
	var z := cam.z
	var vw := SW / z
	var vh := SH / z
	var x0 := cam.x - vw / 2.0
	var y0 := cam.y - vh / 2.0
	var c0 := maxi(0, floori(x0 / CH))
	var c1 := mini(MapGPU.NCX - 1, floori((x0 + vw) / CH))
	var r0 := maxi(0, floori(y0 / CH))
	var r1 := mini(MapGPU.NCY - 1, floori((y0 + vh) / CH))
	var half := z < 1.0
	ch_mat.set_shader_parameter("half", half)
	ch_mat.set_shader_parameter("lay_a", 0.95 if half else (1.0 if mode == "pol" else 0.85))
	var seen := {}
	var miss: Array = []
	var old: Array = []
	var n := 0
	var t0 := Time.get_ticks_usec()
	for r in range(r0, r1 + 1):
		for c in range(c0, c1 + 1):
			var ci := r * MapGPU.NCX + c
			seen[ci] = true
			var tex := G.chunk_tex(ci)
			if tex == null:
				if not G.has_chunk(ci):
					miss.append([c, r, Vector2(c * CH + CH / 2.0 - cam.x, r * CH + CH / 2.0 - cam.y).length()])
				continue
			G.touch(ci)
			if G.stale(ci):
				old.append(ci)
			var s := _sprite(n)
			n += 1
			s.texture = tex
			s.position = Vector2(floorf((c * CH - cam.x) * z + SW / 2.0 + 0.5), floorf((r * CH - cam.y) * z + SH / 2.0 + 0.5))
			s.scale = Vector2(z, z)
			s.visible = true
	for k in range(n, pool.size()):
		pool[k].visible = false
	# сменился вид года: видимые куски перерисовываются по два за кадр, до того видна старая картинка
	for k in mini(2, old.size()):
		G.reseason(old[k])
	miss.sort_custom(func(a, b): return a[2] < b[2])
	var made := 0
	for k in miss.size():
		if k > 0 and Time.get_ticks_usec() - t0 > 10000:
			break
		G.render_chunk(miss[k][0], miss[k][1], seen)
		made += 1
	var now := Time.get_ticks_msec() / 1000.0
	if miss.is_empty() and Time.get_ticks_usec() - t0 < 6000 and now - pre_t > 0.12 and G.chunks.size() < MapGPU.KEEP - 2:
		pre_t = now
		var best := Vector2i(-1, -1)
		var bd := 1e9
		for r in range(maxi(0, r0 - 1), mini(MapGPU.NCY - 1, r1 + 1) + 1):
			for c in range(maxi(0, c0 - 1), mini(MapGPU.NCX - 1, c1 + 1) + 1):
				if G.has_chunk(r * MapGPU.NCX + c):
					continue
				var dd := Vector2(c * CH + CH / 2.0 - cam.x, r * CH + CH / 2.0 - cam.y).length()
				if dd < bd:
					bd = dd
					best = Vector2i(c, r)
		if best.x >= 0:
			G.render_chunk(best.x, best.y, seen)
			made += 1
	vis = {"n": n, "miss": miss.size(), "made": made, "stale": old.size()}

# ---------- ввод ----------
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		var k: int = e.physical_keycode
		match k:
			KEY_TAB, KEY_ESCAPE:
				leave.emit()
			KEY_Q, KEY_MINUS, KEY_KP_SUBTRACT:
				zoom_at(-1, Vector2(SW / 2.0, SH / 2.0))
			KEY_E, KEY_EQUAL, KEY_KP_ADD:
				zoom_at(1, Vector2(SW / 2.0, SH / 2.0))
			KEY_H, KEY_F1:
				hud.help = not hud.help
		get_viewport().set_input_as_handled()
		return
	if not on:
		return
	if e is InputEventMouseButton:
		var b: int = e.button_index
		var p: Vector2 = e.position
		if e.pressed:
			if b == MOUSE_BUTTON_WHEEL_UP or b == MOUSE_BUTTON_WHEEL_DOWN:
				if not hud.over_ui(p):
					zoom_at(1 if b == MOUSE_BUTTON_WHEEL_UP else -1, p)
			elif b == MOUSE_BUTTON_LEFT or b == MOUSE_BUTTON_MIDDLE or b == MOUSE_BUTTON_RIGHT:
				down[b] = {"at": p, "moved": false, "ui": hud.over_ui(p)}
		elif down.has(b):
			var d: Dictionary = down[b]
			down.erase(b)
			if not d.moved and b == MOUSE_BUTTON_LEFT:
				hud.click(p)
			dragging = false
			for q in down:
				dragging = dragging or down[q].moved
	elif e is InputEventMouseMotion:
		var p: Vector2 = e.position
		for b in down:
			var d: Dictionary = down[b]
			if not d.moved and p.distance_to(d.at) > 3.0 and (not d.ui or b == MOUSE_BUTTON_MIDDLE):
				d.moved = true
			if d.moved:
				dragging = true
		if dragging:
			cam.x -= e.relative.x / cam.z
			cam.y -= e.relative.y / cam.z
			clamp_cam()

# ---------- команды для тестов веб-сборки ----------
func cmd(p: PackedStringArray) -> void:
	match p[0]:
		"cam":
			cam = Vector3(float(p[1]), float(p[2]), float(p[3]) if p.size() > 3 else cam.z)
			clamp_cam()
		"zoom":
			zoom_at(int(p[1]), Vector2(SW / 2.0, SH / 2.0))
		"mode":
			set_mode(p[1] if p.size() > 1 else ("ter" if mode == "pol" else "pol"))
		"capital":
			center_capital()
		"sett":
			for s: Dictionary in G.W.setts:
				if String(s.name) == " ".join(p.slice(1)) or str(s.id) == p[1]:
					cam.x = sw[s.id].x
					cam.y = sw[s.id].y
					clamp_cam()
		"hover":
			hud.hover_at = Vector2(float(p[1]), float(p[2]))
		"lum":
			# средняя яркость экрана (0..1) — тест сравнивает зиму с летом
			var img := get_viewport().get_texture().get_image()
			if img.get_format() != Image.FORMAT_RGBA8:
				img.convert(Image.FORMAT_RGBA8)
			var d := img.get_data()
			var sum := 0.0
			var n := 0
			for i in range(0, d.size(), 4 * 7):
				sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
				n += 1
			print("MAPLUM ", snappedf(sum / maxf(1.0, n) / 255.0, 0.001))
		"state":
			print("MAPSTATE ", JSON.stringify(state()))
		"dump":
			var b := G.dump(p[1])
			if OS.has_feature("web") and not b.is_empty():
				JavaScriptBridge.download_buffer(b, p[1].replace(":", "_") + ".png", "image/png")
			print("DUMP ", p[1], " ", b.size())

func state() -> Dictionary:
	return {"ok": G != null and G.ok, "stage": G.stage if G else "", "ms": G.ms if G else {}, "cam": [snappedf(cam.x, 0.1), snappedf(cam.y, 0.1), cam.z], "mode": mode,
		"chunks": G.chunks.size() if G else 0, "built": G.nbuilt if G else 0, "cms": snappedf(G.cms, 0.01) if G else 0.0, "prof": G.prof if G else {}, "vis": vis,
		"sea": [G.sea_k.x, G.sea_k.y, G.sea_k.z] if G else [], "nsea": G.nsea if G else 0, "hover": hud.hover_s()}
