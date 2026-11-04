extends CanvasLayer
## Экран карты королевства — перенос main.js/render.js (drawMapBase, drawChunks, камера): обзорная карта и куски полной
## детализации от MapGPU, границы и державы цветом, масштабы 1/8…2 (колесо, Q/E), перетаскивание мышью, WASD и стрелки.
## Поверх — поселения, войска, подписи, мини-карта и верхняя строка (map_hud.gd). Вид года — по дню (MapGPU.set_day): обзор
## перекрашивается сразу, видимые куски — по два за кадр. Королевство — Sim.G (новая игра при первом открытии карты):
## туман войны (map_show_fog: тень над невидимым, бумага над неразведанным), владельцы — по поселениям. Время идёт
## (скорость 1–3, пауза — Пробел): сутки за 1,6 / 0,8 / 0,3 с, дни королевства считает Game (SimDay), карта следит
## за туманом и владельцами провинций, верхняя строка — дата, погода, распутица, лента летописи — справа внизу.
signal leave
const MapHud = preload("res://scripts/world/map_hud.gd")
const MapUI = preload("res://scripts/world/map_ui.gd")
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
var fogv: ColorRect        # тень над разведанным, но невидимым сейчас
var fogp: ColorRect        # бумага над неразведанным (над поселениями и войсками, как в HTML)
var objs: Control          # подписи, поселения, войска (map_hud.gd, part = "objs")
var exp_img: Image
var vis_img: Image
var exp_tex: ImageTexture
var vis_tex: ImageTexture
var fog_t := -1.0
var chn: Node2D
var pool: Array[Sprite2D] = []
var ch_mat: ShaderMaterial
var hud: Control
var ui: Control            # окна карты (map_ui.gd): вести, встречи, поселения, войска короны; поверх hud
var on := false            # материалы готовы (MapGPU.ok)
var pre_t := 0.0
var down := {}             # кнопка мыши → {at, moved}
var dragging := false
var centered := false
var sw := PackedVector2Array()   # поселения: точка на картинке (settWorld)
var vis := {"n": 0, "miss": 0, "made": 0}
var pol_t := -1.0          # когда последний раз перекрашивали державы (не чаще 2,5 раза в секунду, как в HTML)

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
	fogv = _fog_rect(0)
	objs = MapHud.new()
	objs.mv = self
	objs.part = "objs"
	add_child(objs)
	fogp = _fog_rect(1)
	hud = MapHud.new()
	hud.mv = self
	add_child(hud)
	ui = MapUI.new()
	ui.mv = self
	add_child(ui)

func _fog_rect(layer: int) -> ColorRect:
	var r := ColorRect.new()
	r.size = Vector2(SW, SH)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	r.visible = false
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/map_show_fog.gdshader")
	m.set_shader_parameter("layer", layer)
	r.material = m
	add_child(r)
	return r

## маски тумана из G.explored и G.vis (по точке на клетку) → текстуры слоёв и мини-карты (rebuildFog)
func _fog_update() -> void:
	var g := Sim.G
	exp_img = Image.create_from_data(WorldData.MW, WorldData.MH, false, Image.FORMAT_R8, g.explored)
	vis_img = Image.create_from_data(WorldData.MW, WorldData.MH, false, Image.FORMAT_R8, g.vis)
	if exp_tex == null:
		exp_tex = ImageTexture.create_from_image(exp_img)
		vis_tex = ImageTexture.create_from_image(vis_img)
		for r in [fogv, fogp]:
			(r.material as ShaderMaterial).set_shader_parameter("exp_tex", exp_tex)
			(r.material as ShaderMaterial).set_shader_parameter("vis_tex", vis_tex)
		G.set_fog(exp_tex)
	else:
		exp_tex.update(exp_img)
		vis_tex.update(vis_img)
		G.fog_changed()
	Sim.fog_dirty = 0
	fog_t = Time.get_ticks_msec() / 1000.0

## державы на карте — по поселениям-столицам провинций (refreshPolitics: G.setts[seat].ctrl)
func _politics() -> void:
	for P: Dictionary in G.W.provs:
		G.set_prov_owner(P.id, int(Sim.G.setts[P.seat].ctrl))
	Sim.pol_dirty = 0
	pol_t = Time.get_ticks_msec() / 1000.0

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
	if not Sim.G.is_empty():
		_fog_update()
		_politics()
	if not centered:
		if pa_now() != null:
			center_army()
		else:
			center_capital()

## к столице державы игрока (openMapFromCourt)
func center_capital() -> void:
	centered = true
	for s: Dictionary in G.W.setts:
		if s.type == "capital" and G.own[s.prov] == 0:
			cam.x = sw[s.id].x
			cam.y = sw[s.id].y
	clamp_cam()

## к войску короля (centerArmy): C, кнопка карточки, выезд из замка
func center_army() -> void:
	var pa: Variant = pa_now()
	if pa == null or G == null or not G.ok:
		return
	centered = true
	var vp := Game.view_pos(pa)
	var q := G.warp_pt(vp.x * WorldData.TS, vp.y * WorldData.TS)
	cam.x = q.x
	cam.y = q.y
	clamp_cam()

## войско короля в поле (playerArmy) или null
func pa_now() -> Variant:
	return null if Sim.G.is_empty() else Sim.playerArmy()

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

## всплывающая строка над картой (UI.toast)
func note(s: String) -> void:
	if ui:
		ui.toast(s)

func set_mode(m: String) -> void:
	mode = "pol" if m == "pol" else "ter"

# ---------- кадр ----------
func _process(dt: float) -> void:
	if G == null or not G.ok:
		hud.queue_redraw()
		return
	if not on:
		_setup()
	ui.tick()
	# пока открыто окно, весть или разговор — время на карте стоит (timeHeld)
	Game.advance(0.0 if ui.is_open() else dt, true)
	G.set_day(Game.day)
	if Sim.pol_dirty and Time.get_ticks_msec() / 1000.0 - pol_t > 0.4:
		_politics()
	var d := Vector2.ZERO
	for k in PANK:
		if Input.is_physical_key_pressed(k) and not ui.is_open():
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
	var fog := exp_tex != null and not Sim.G.is_empty() and not JS.t(Sim.G.mapOpen)
	if fog and Sim.fog_dirty and Time.get_ticks_msec() / 1000.0 - fog_t > 0.15:
		_fog_update()
	for r in [fogv, fogp]:
		r.visible = fog
		if fog:
			(r.material as ShaderMaterial).set_shader_parameter("cam", cam)
	objs.queue_redraw()
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
		get_viewport().set_input_as_handled()
		key(e.physical_keycode)
		return
	if not on:
		return
	_mouse(e)

## клавиша карты (mapKeys): сначала окна (разговор, вести, окна), потом карта
func key(k: int) -> void:
	if ui.key(k):
		return
	var pa: Variant = pa_now()
	match k:
		KEY_TAB:
			# король при дворе — назад к столу; в поле — политическая карта или местность
			if pa == null:
				leave.emit()
			else:
				set_mode("ter" if mode == "pol" else "pol")
		KEY_ESCAPE:
			if pa == null:
				leave.emit()
		KEY_Q, KEY_MINUS, KEY_KP_SUBTRACT:
			zoom_at(-1, Vector2(SW / 2.0, SH / 2.0))
		KEY_E, KEY_EQUAL, KEY_KP_ADD:
			zoom_at(1, Vector2(SW / 2.0, SH / 2.0))
		KEY_H, KEY_F1:
			hud.help = not hud.help
		KEY_SPACE:
			Game.toggle_pause()
		KEY_0, KEY_1, KEY_2, KEY_3:
			Game.ui_speed(k - KEY_0)
		KEY_KP_0, KEY_KP_1, KEY_KP_2, KEY_KP_3:
			Game.ui_speed(k - KEY_KP_0)

## щелчок, как мышью (для проверок): окна, верхняя строка, поле карты
func click_at(p: Vector2, b := 0) -> void:
	if ui.is_open() or ui.capture(p):
		ui.click({"x": p.x, "y": p.y, "ux": p.x, "uy": p.y, "b": b, "drag": false})
	elif b == 0:
		hud.click(p)
	else:
		hud.rclick(p)

func _mouse(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		var b: int = e.button_index
		var p: Vector2 = e.position
		if e.pressed:
			if b == MOUSE_BUTTON_WHEEL_UP or b == MOUSE_BUTTON_WHEEL_DOWN:
				if ui.is_open():
					ui.wheel = -1 if b == MOUSE_BUTTON_WHEEL_UP else 1
				elif not hud.over_ui(p) and not ui.capture(p):
					zoom_at(1 if b == MOUSE_BUTTON_WHEEL_UP else -1, p)
			elif b == MOUSE_BUTTON_LEFT or b == MOUSE_BUTTON_MIDDLE or b == MOUSE_BUTTON_RIGHT:
				down[b] = {"at": p, "moved": false, "ui": hud.over_ui(p) or ui.capture(p), "w": ui.capture(p)}
		elif down.has(b):
			var d: Dictionary = down[b]
			down.erase(b)
			if b != MOUSE_BUTTON_MIDDLE:
				var bi := 0 if b == MOUSE_BUTTON_LEFT else 2
				if d.w or ui.is_open():
					ui.click({"x": d.at.x, "y": d.at.y, "ux": p.x, "uy": p.y, "b": bi, "drag": d.moved})
				elif not d.moved:
					if bi == 0:
						hud.click(p)
					else:
						hud.rclick(p)
			dragging = false
			for q in down:
				dragging = dragging or down[q].moved
	elif e is InputEventMouseMotion:
		var p: Vector2 = e.position
		for b in down:
			var d: Dictionary = down[b]
			if not d.moved and p.distance_to(d.at) > 3.0 and (not d.ui or (b == MOUSE_BUTTON_MIDDLE and not ui.is_open())):
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
			var cz := float(p[3]) if p.size() > 3 else cam.z
			cam = Vector3(float(p[1]), float(p[2]), cz if ZOOMS.has(cz) else cam.z)
			clamp_cam()
		"zoom":
			zoom_at(int(p[1]), Vector2(SW / 2.0, SH / 2.0))
		"mode":
			set_mode(p[1] if p.size() > 1 else ("ter" if mode == "pol" else "pol"))
		"capital":
			center_capital()
		"army":
			# к войску: номер или вид (lord, ai, bandit, caravan) — первое видимое
			for a: Dictionary in Sim.G.get("armies", []):
				if not JS.t(a.alive) or not SimIntel.armyVisible(a):
					continue
				var k := String(a.kind)
				if p[1] == JS.s(a.id) or (p[1] == k and (k != "lord" or a.realm == 0.0)) or (p[1] == "ai" and k == "lord" and a.realm != 0.0):
					var q := G.warp_pt(a.x * WorldData.TS, a.y * WorldData.TS)
					cam.x = q.x
					cam.y = q.y
					clamp_cam()
					break
		"reveal":
			# для проверок: вся карта разведана и видна (как G.explored.fill(1); G.vis.fill(2) в HTML)
			if not Sim.G.is_empty():
				var ex: PackedByteArray = Sim.G.explored
				var vs: PackedByteArray = Sim.G.vis
				ex.fill(1)
				vs.fill(2)
				Sim.G.explored = ex
				Sim.G.vis = vs
				Sim.fog_dirty = 1
		"sett":
			for s: Dictionary in G.W.setts:
				if String(s.name) == " ".join(p.slice(1)) or str(s.id) == p[1]:
					cam.x = sw[s.id].x
					cam.y = sw[s.id].y
					clamp_cam()
		"hover":
			hud.hover_at = Vector2(float(p[1]), float(p[2]))
			ui.hover_at = hud.hover_at
		"click":
			# щелчок, как мышью: click x y [r — правой]
			click_at(Vector2(float(p[1]), float(p[2])), 2 if p.size() > 3 and p[3] == "r" else 0)
		"key":
			# клавиша по имени: key V, key Escape, key Space
			key(OS.find_keycode_from_string(p[1]))
		"choose":
			if ui.dlg != null:
				ui.choose(int(p[1]) - 1)
		"goto":
			# войско короля идёт: goto x y — в клетку (x, y), goto Имя — к поселению (как щелчок по нему)
			if p.size() > 2 and p[1].is_valid_int():
				SimPlayer.orderMove(int(p[2]) * WorldData.MW + int(p[1]))
			else:
				for s: Dictionary in G.W.setts:
					if String(s.name) == " ".join(p.slice(1)):
						hud.click_sett(s.id, 0)
		"rideout":
			# для проверок: король выезжает со свитой (rideout) или во главе войска у столицы (rideout army)
			if not Sim.G.is_empty() and JS.t(Sim.G.get("atCourt")):
				SimPlayer.leaveCourt(SimPlayer.capitalArmy() if p.size() > 1 and p[1] == "army" else null)
				ui.rode_out()
		"ui":
			_ui_cmd(p)
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

## окна карты для проверок: ui enc — встреча с ближайшим врагом, ui cmd, ui sett N, ui settinfo N, ui close, ui state
func _ui_cmd(p: PackedStringArray) -> void:
	match p[1] if p.size() > 1 else "state":
		"enc":
			var pa: Variant = pa_now()
			var best: Variant = null
			var bd := INF
			for b: Dictionary in Sim.G.get("armies", []):
				if pa == null or not JS.t(b.alive) or b == pa or not Sim.hostile(pa.realm, b.realm):
					continue
				var d := Vector2(b.x - pa.x, b.y - pa.y).length()
				if d < bd:
					bd = d
					best = b
			if best != null:
				ui.alert("enc", best.id)
				print("UI ENC ", best.id, " ", snappedf(bd, 0.1))
		"cmd":
			ui.open_cmd(float(p[2]) if p.size() > 2 else -1.0)
		"sett":
			ui.open_sett(int(p[2]))
		"settinfo":
			ui.open_settinfo(int(p[2]))
		"gate":
			ui.capital_gate(int(Sim.G.realms[0].capital))
		"close":
			ui.win = null
			ui.close_modal()
			ui.close_dlg()
		_:
			print("UISTATE ", JSON.stringify(ui_state()))

func ui_state() -> Dictionary:
	var pa: Variant = pa_now()
	var o := {"modals": ui.modals.map(func(m): return String(m.k)), "win": String(ui.win.k) if ui.win != null else "", "dlg": ui.dlg != null,
		"target": ui.target != null, "busy": ui.busy, "toast": ui.toast_s if ui.toast_t > ui.now() else "", "speed": Game.speed, "atCourt": JS.t(Sim.G.get("atCourt")),
		"draws": ui.n_draw, "fps": Engine.get_frames_per_second(), "frame": Engine.get_process_frames()}
	if ui.dlg != null:
		o.dlg_name = String(ui.dlg.get("name", ""))
		o.choices = (ui.dlg.get("choices", []) as Array).map(func(c): return String(c.t))
	if pa != null:
		o.pa = {"id": pa.id, "x": snappedf(pa.x, 0.01), "y": snappedf(pa.y, 0.01), "men": Sim.armyMen(pa), "mode": String(pa.mode), "path": (pa.path as Array).size() if pa.path != null else 0,
			"pi": JS.n(pa.get("pi")), "siege": pa.siegeOf, "follow": Sim.G.player.follow, "here": SimPlayer.settHere(pa)}
	o.couriers = (Sim.G.get("couriers", []) as Array).size()
	return o

func state() -> Dictionary:
	return {"ok": G != null and G.ok, "stage": G.stage if G else "", "ms": G.ms if G else {}, "cam": [snappedf(cam.x, 0.1), snappedf(cam.y, 0.1), cam.z], "mode": mode,
		"chunks": G.chunks.size() if G else 0, "built": G.nbuilt if G else 0, "cms": snappedf(G.cms, 0.01) if G else 0.0, "prof": G.prof if G else {}, "vis": vis,
		"sea": [G.sea_k.x, G.sea_k.y, G.sea_k.z] if G else [], "nsea": G.nsea if G else 0, "hover": hud.hover_s(), "realm": _realm_state(), "time": _time_state(), "snd": Snd.state()}

## часы и дни королевства: день календаря и симуляции, скорость, сколько счёта уходит на день
func _time_state() -> Dictionary:
	var o := {"day": Game.day, "clock": Game.clock_text(), "speed": Game.speed, "lag_max": Game.lag_max, "fps": Engine.get_frames_per_second(), "steps": Game.steps_n,
		"step_ms": snappedf(Game.step_ms, 0.1), "dt": snappedf(Game.dt_avg * 1000.0, 1.0), "b": snappedf(Game.b_ms, 1.0), "work": snappedf(Game.work_ms, 1.0),
		"modal": SimPlayer.modal}
	if not Sim.G.is_empty():
		o.merge({"sim": int(Sim.G.day), "busy": SimDay.busy, "ms": snappedf(SimDay.ms_day, 0.1), "frames": SimDay.frames, "n": SimDay.n_days,
			"avg": snappedf(SimDay.sum_ms / maxf(1.0, SimDay.n_days), 0.1), "max": snappedf(SimDay.max_ms, 0.1), "log": Sim.G.log.size(),
			"feed": Sim.feed.size(), "mud": snappedf(JS.n(Sim.G.get("mud")), 0.01), "mudOn": JS.t(Sim.G.get("mudOn")),
			"last": (Sim.G.log as Array).slice(-3).map(func(e): return "%d: %s" % [int(e.d), String(e.t).left(48)])})
	return o

func _realm_state() -> Dictionary:
	if Sim.G.is_empty():
		return {}
	var bv := SimText.bar_vals()
	var vis := 0
	var kinds := {}
	var march := 0
	var sieges := 0
	var pos := 0.0
	for a: Dictionary in Sim.G.armies:
		pos = pos + a.x * 7 + a.y * 13
		if JS.t(a.alive) and a.path != null:
			march += 1
		if JS.t(a.alive) and a.siegeOf >= 0:
			sieges += 1
		if JS.t(a.alive) and SimIntel.armyVisible(a):
			vis += 1
			var k := String(a.kind) + ("" if String(a.kind) != "lord" or a.realm == 0.0 else "_ai")
			kinds[k] = int(kinds.get(k, 0)) + 1
	var wars := 0
	for r in range(1, 5):
		if JS.t(Sim.G.rel[0][r].war):
			wars += 1
	return {"gold": roundi(bv.gold), "net": snappedf(bv.net, 0.01), "chars": Sim.G.chars.size(), "armies": Sim.G.armies.size(), "seen": vis, "kinds": kinds, "drawn": objs.n_armies,
		"explored": (Sim.G.explored as PackedByteArray).count(1), "fog": fogp.visible, "weather": String(Sim.G.weather.k), "march": march, "sieges": sieges,
		"pos": snappedf(pos, 0.01), "ghosts": objs.n_ghosts, "know": (Sim.G.get("know", {}) as Dictionary).size(), "wars": wars, "paths": SimArmy.path_n,
		"path_ms": snappedf(SimArmy.path_us / 1000.0 / maxf(1.0, SimArmy.path_n), 0.1)}
