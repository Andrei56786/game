extends "res://scripts/hud.gd"
## Надписи экрана карты (ui.js: drawSetts, drawLabels, drawRealmNames, drawTopBar, drawMinimap, drawStatus, drawTipBox):
## поселения с флагами и названиями, подписи озёр и гор, названия держав, верхняя строка, мини-карта, подсказки.
const SETT_T := {"village": "Деревня", "castle": "Замок", "town": "Город", "capital": "Столица"}
const MX := 509.0           # мини-карта 128×80 (W − 131, H − 83)
const MY := 277.0
var mv                      # MapView
var hover_at := Vector2(-1, -1)   # для проверок: «мышь» в этой точке
var sett_hits: Array = []   # [Rect2, номер поселения] — что нарисовано последним, то и сверху
var btns: Array = []        # [Rect2, действие]
var hov_sett := -1
var hov_tile := -1
var t0 := Time.get_ticks_msec()

func _ready() -> void:
	super()

func _process(_d: float) -> void:
	pass

func now() -> float:
	return (Time.get_ticks_msec() - t0) / 1000.0

func toast(s: String) -> void:
	toast_s = s
	toast_t = now() + 2.6

func mouse() -> Vector2:
	return hover_at if hover_at.x >= 0.0 else get_local_mouse_position()

func over_ui(p: Vector2) -> bool:
	if p.y < 19.0 or Rect2(MX - 3, MY - 3, 134, 86).has_point(p):
		return true
	for b in btns:
		if (b[0] as Rect2).has_point(p):
			return true
	return false

func click(p: Vector2) -> void:
	for b in btns:
		if (b[0] as Rect2).has_point(p):
			(b[1] as Callable).call()
			return
	if Rect2(MX, MY, 128, 80).has_point(p):
		var k := 128.0 / WorldData.WPW
		mv.cam.x = (p.x - MX) / k
		mv.cam.y = (p.y - MY) / k
		mv.clamp_cam()
		return
	if hov_sett >= 0:
		var s: Dictionary = mv.G.W.setts[hov_sett]
		toast(String(s.name) + " — " + String(SETT_T[s.type]).to_lower() + ". Походы и рынки — в следующих срезах.")

func hover_s() -> String:
	if hov_sett >= 0:
		return String(mv.G.W.setts[hov_sett].name)
	if hov_tile >= 0:
		return tile_tip(hov_tile)
	return ""

func rc(i: int) -> Dictionary:
	return mv.G.M.realms[clampi(i, 0, 6)]

func _draw() -> void:
	btns = []
	if not mv.on:
		_loading()
		return
	var G: MapGPU = mv.G
	var m := mouse()
	_labels()
	sett_hits = []
	_setts()
	if mv.mode == "pol" and mv.cam.z < 0.5:
		_realm_names()
	# что под мышью: поселение (сверху — нарисованное последним) или клетка
	hov_sett = -1
	hov_tile = -1
	if not mv.dragging and not over_ui(m):
		for k in range(sett_hits.size() - 1, -1, -1):
			if (sett_hits[k][0] as Rect2).has_point(m):
				hov_sett = sett_hits[k][1]
				break
		if hov_sett < 0 and m.x >= 0 and m.y >= 0 and m.x < W and m.y < H:
			hov_tile = mv.tile_at(m)
	_top()
	_mini()
	_status()
	if hov_sett >= 0:
		_tip(sett_tip(hov_sett), m)
	if toast_t > now():
		var a := clampf((toast_t - now()) * 3.0, 0.0, 1.0)
		var ls := wrap_text(toast_s, 380)
		var w := 0.0
		for l in ls:
			w = maxf(w, tw(l))
		w += 16.0
		var h := ls.size() * 10.0 + 5.0
		var y := 40.0
		box(W / 2.0 - w / 2.0 - 1, y - 1, w + 2, h + 2, Color(PO, a))
		box(W / 2.0 - w / 2.0, y, w, h, Color(0.125, 0.086, 0.063, 0.96 * a))
		stroke(W / 2.0 - w / 2.0, y, w, h, Color(0.79, 0.63, 0.38, a))
		for i in ls.size():
			txt(ls[i], W / 2.0, y + 3 + i * 10, Color(0.97, 0.83, 0.36, a), "m", "c")
	if G.stage != "":
		txt(G.stage, 6, H - 22, Color8(200, 216, 232), "s")

func _loading() -> void:
	box(0, 0, W, H, Color8(26, 20, 16))
	var st: String = mv.G.stage if mv.G else ""
	txt("Карта королевства готовится…", W / 2.0, H / 2.0 - 10, Art.pal("y"), "m", "c", PO)
	if st != "":
		txt(st, W / 2.0, H / 2.0 + 6, Color8(200, 184, 152), "s", "c")

# ---------- мир ----------
func _labels() -> void:
	if mv.cam.z < 0.5:
		return
	for L: Dictionary in mv.G.W.labels:
		var p: Vector2 = mv.w2s(Vector2(L.x * WorldData.TS + WorldData.TS / 2.0, L.y * WorldData.TS + WorldData.TS / 2.0))
		if p.x < -80 or p.x > W + 80 or p.y < -10 or p.y > H + 10:
			continue
		var lake: bool = L.kind == "lake"
		txt(L.t, p.x, p.y, Color.html("#cfe6f5") if lake else Color.html("#efe6d0"), "s", "c", Color.html("#24507a") if lake else Color.html("#3a3026"))

func _flag(x: float, y: float, col: Color, dark: Color, t: float) -> void:
	x = floorf(x)
	y = floorf(y)
	box(x, y, 1, 6, PO)
	var wave := 1.0 if sin(t * 4.0 + x) > 0.0 else 0.0
	box(x + 1, y, 4, 3, col)
	box(x + 1, y + 2, 4, 1, dark)
	box(x + 5, y + wave, 1, 1, col)
	box(x + 5, y + 1 + wave, 1, 1, dark)

func _setts() -> void:
	var G: MapGPU = mv.G
	var z: float = mv.cam.z
	var sc := 2 if z >= 2.0 else 1
	var list: Array = []
	for s: Dictionary in G.W.setts:
		var p: Vector2 = mv.w2s(mv.sw[s.id])
		if p.x < -40 or p.y < -40 or p.x > W + 40 or p.y > H + 50:
			continue
		list.append([p.y, s.id, p.x])
	list.sort_custom(func(a, b): return a[0] < b[0] or (a[0] == b[0] and a[1] < b[1]))
	var t := now()
	var crown: int = int(G.M.get("crown", -1))
	for e: Array in list:
		var s: Dictionary = G.W.setts[e[1]]
		var sx: float = e[2]
		var sy: float = e[0]
		var ctrl: int = G.own[s.prov]
		var d := rc(ctrl)
		var col := Color.html(String(d.col))
		var big: bool = s.type != "village"
		var cap: bool = s.type == "capital"
		var lc := Color.html("#cfe2ff") if ctrl == 0 else Color.html("#fff2c8")
		if z <= 0.25 or (z == 0.5 and not big):
			if not big and z <= 0.25:
				continue
			var r := (2 if cap else 1) if z < 0.25 else (3 if cap else (2 if big else 1))
			box(sx - r - 1, sy - r - 1, r * 2 + 3, r * 2 + 3, PO)
			box(sx - r, sy - r, r * 2 + 1, r * 2 + 1, col if big else Color.html("#e8d8a8"))
			if cap and crown >= 0:
				spr(crown, sx - 2, sy - 9)
			if z == 0.5 or cap:
				txt(s.name, sx, sy + 5, lc, "m" if cap else "s", "c", PO)
			sett_hits.append([Rect2(sx - 5, sy - 5, 11, 11), s.id])
			continue
		var cul: String = String(G.W.provs[s.prov].cul)
		if cul == "":
			cul = "K"
		var key := String(s.type) + cul + str(int(s.id) % 3)
		if not G.M.sett.has(key):
			continue
		var sp: Dictionary = G.M.sett[key]
		var si := int(sp.s)
		var sz := Art.size(si)
		var x0 := floorf(sx - sz.x * sc / 2.0 + 0.5)
		var y0 := floorf(sy - sz.y * sc + 3 * sc + 0.5)
		box(x0 + 2 * sc, sy + sc, sz.x * sc - 4 * sc, 2 * sc, Color(16 / 255.0, 20 / 255.0, 12 / 255.0, 0.35))
		spr(si, x0, y0, sc)
		var dk := Color.html(String(d.dark))
		for f: Array in sp.flags:
			if sc == 2:
				_flag(x0 + f[0] * 2, y0 + f[1] * 2 - 4, col, dk, t)
			else:
				_flag(x0 + f[0], y0 + f[1] - 5, col, dk, t)
		if big or z >= 2.0:
			var fn := "m" if (cap or s.type == "town") else "s"
			txt(s.name, sx, sy + 5 * sc, lc, fn, "c", PO)
			if cap and crown >= 0:
				spr(crown, sx - tw(s.name, fn) / 2.0 - 8, sy + 5 * sc)
		sett_hits.append([Rect2(x0, y0, sz.x * sc, sz.y * sc + 6), s.id])

func _realm_names() -> void:
	var G: MapGPU = mv.G
	var acc := {}
	for P: Dictionary in G.W.provs:
		var o: int = G.own[P.id]
		if o < 0 or o > 5:
			continue
		if not acc.has(o):
			acc[o] = Vector3.ZERO
		acc[o] += Vector3(P.cx * P.area, P.cy * P.area, P.area)
	for o in acc:
		var a: Vector3 = acc[o]
		var p: Vector2 = mv.w2s(Vector2(a.x / a.z * WorldData.TS, a.y / a.z * WorldData.TS + 10))
		if p.x < -60 or p.x > W + 60 or p.y < 14 or p.y > H - 10:
			continue
		var s := String(rc(o).name).to_upper()
		var sh := Color.html("#1a1410")
		for q in [Vector2(0, 1), Vector2(1, 0), Vector2(-1, 0), Vector2(0, -1)]:
			txt(s, p.x + q.x, p.y + q.y, sh, "m", "c")
		txt(s, p.x, p.y, Color.html(String(rc(o).light)), "m", "c")

# ---------- подсказки ----------
func tile_tip(t: int) -> String:
	var Wd: WorldData = mv.G.W
	var T := Wd.ter[t]
	var s := String(mv.G.M.tinfo[T].n)
	if Wd.river[t]:
		s += " · мост" if Wd.bridge[t] else (" · брод" if Wd.ford[t] else " · река")
	if Wd.road[t]:
		s += " · тракт" if Wd.road[t] == 2 else " · дорога"
	var p := Wd.prov[t]
	if p >= 0:
		s += " · пров. " + String(Wd.provs[p].name) + " (" + String(rc(mv.G.own[p]).name) + ")"
	return s

func sett_tip(sid: int) -> Array:
	var G: MapGPU = mv.G
	var s: Dictionary = G.W.setts[sid]
	var o: int = G.own[s.prov]
	return [[String(s.name) + " — " + String(SETT_T[s.type]), Art.pal("y")], [String(rc(o).name), Color.html("#cfe2ff") if o == 0 else Color.html("#fff2c8")],
		["Провинция " + String(G.W.provs[s.prov].name), Art.pal("w")]]

func _tip(rows: Array, m: Vector2) -> void:
	var w := 0.0
	for r in rows:
		w = maxf(w, tw(r[0]))
	w += 10.0
	var h := rows.size() * 10.0 + 6.0
	var x := m.x + 10.0
	var y := m.y + 12.0
	if x + w > W - 2:
		x = m.x - w - 6
	if y + h > H - 2:
		y = m.y - h - 6
	x = floorf(maxf(2.0, x))
	y = floorf(maxf(2.0, y))
	box(x, y, w, h, PO)
	box(x + 1, y + 1, w - 2, h - 2, Color.html("#20160f"))
	box(x + 1, y + 1, w - 2, 1, Color.html("#3a2a1c"))
	for i in rows.size():
		txt(rows[i][0], x + 5, y + 5 + i * 10, rows[i][1])

func _status() -> void:
	var s := ""
	if hov_tile >= 0:
		s = tile_tip(hov_tile)
	elif help:
		s = "Перетаскивание или WASD — двигать · колесо, Q и E — масштаб · Tab — ко двору · H — подсказка"
	if s == "":
		return
	var w := tw(s, "s") + 10.0
	var x := floorf(clampf(W / 2.0 - w / 2.0 - 20.0, 242.0, W - 140.0 - w)) if hov_tile >= 0 else 8.0
	box(x, H - 12, w, 11, Color(20 / 255.0, 14 / 255.0, 12 / 255.0, 0.8))
	txt(s, x + 5, H - 9, Color.html("#e8dcc0"), "s")

# ---------- верхняя строка и мини-карта ----------
func _btn(label: String, x: float, y: float, w: float, h: float, act: Callable, active := false) -> void:
	var r := Rect2(x, y, w, h)
	var hv := r.has_point(mouse())
	box(x, y, w, h, PO)
	box(x + 1, y + 1, w - 2, h - 2, Color8(90, 64, 48) if (active or hv) else Color8(44, 32, 24))
	box(x + 1, y + 1, w - 2, 1, Color8(120, 88, 60) if (active or hv) else Color8(64, 46, 34))
	txt(label, x + w / 2.0, y + 4, Color8(255, 242, 200) if (active or hv) else Color8(232, 220, 192), "m", "c")
	btns.append([r, act])

func _top() -> void:
	box(0, 0, W, 19, PO)
	box(0, 0, W, 18, Color8(42, 29, 22))
	box(0, 0, W, 1, Color8(74, 48, 32))
	box(0, 17, W, 1, Color8(106, 68, 40))
	var x := 4.0
	icon("shield0", x, 3)
	x += 16.0
	var D: Dictionary = Art.D
	var net: float = float(D.get("net", 0.0))
	var gs := str(int(float(D.get("gold", 0)) + net * maxi(0, Game.day - int(D.get("day", 0)))))
	icon("i_gold", x, 7)
	txt(gs, x + 8, 6, Art.pal("y"))
	var x2 := x + 10.0 + tw(gs)
	txt(("+" if net >= 0.0 else "−") + "%.1f" % absf(net), x2, 6, Color.html("#9fe07a") if net >= 0.0 else Color.html("#ee7a6a"), "s")
	x = x2 + 30.0
	_btn("« Ко двору (Tab)", x, 2, 92, 14, func(): mv.leave.emit())
	var pol: bool = mv.mode == "pol"
	_btn("Державы" if pol else "Местность", W - 70, 2, 66, 14, func(): mv.set_mode("ter" if mv.mode == "pol" else "pol"), pol)
	var ds := Game.date_text()
	txt(ds, W - 78 - tw(ds), 6, Color8(255, 242, 200))
	var zs := "масштаб " + ("1/%d" % roundi(1.0 / mv.cam.z) if mv.cam.z < 1.0 else "×%d" % roundi(mv.cam.z))
	txt(zs, W - 90 - tw(ds) - tw(zs, "s"), 7, Color8(200, 184, 152), "s")

func _mini() -> void:
	var G: MapGPU = mv.G
	if not G.T.has("mini"):
		return
	box(MX - 3, MY - 3, 134, 86, PO)
	box(MX - 2, MY - 2, 132, 84, Color.html("#7a5030"))
	box(MX - 1, MY - 1, 130, 82, PO)
	draw_texture(G.T.mini, Vector2(MX, MY))
	var k := 128.0 / WorldData.WPW
	var vw: float = W / mv.cam.z * k
	var vh: float = H / mv.cam.z * k
	stroke(roundf(MX + mv.cam.x * k - vw / 2.0), roundf(MY + mv.cam.y * k - vh / 2.0), roundf(vw), roundf(vh), Color.html("#fff2c8"))
