extends "res://scripts/hud.gd"
## Надписи экрана карты (ui.js: drawLabels, drawSetts, drawArmies, drawRealmNames, drawTopBar, drawMinimap, drawStatus,
## drawTipBox). Два слоя: part = "objs" — подписи озёр и гор, поселения, войска (под бумагой тумана, как в HTML);
## part = "top" — названия держав, верхняя строка с казной, датой, погодой и скоростью, мини-карта с войсками, лента летописи
## (drawFeed), строка состояния, подсказки, «ПАУЗА».
## Состояние королевства — Sim.G: видно только разведанное (G.explored), чужие войска — в поле обзора (G.vis).
const SETT_T := {"village": "Деревня", "castle": "Замок", "town": "Город", "capital": "Столица"}
const CAMP := ["camp", "fort", "hide", "forage", "drill", "siege"]
const MX := 509.0           # мини-карта 128×80 (W − 131, H − 83)
const MY := 277.0
const SPD_TIP := ["Пауза (Пробел)", "Скорость 1", "Скорость 2", "Скорость 3"]
const FEED_C := {"good": "#9fe07a", "bad": "#ee7a6a", "war": "#ff8a6a", "season": "#bfe8f0", "info": "#e8dcc0"}
var mv                      # MapView
var part := "top"
var hover_at := Vector2(-1, -1)   # для проверок: «мышь» в этой точке
var sett_hits: Array = []   # [Rect2, номер поселения] — что нарисовано последним, то и сверху
var army_hits: Array = []   # [Rect2, номер войска]
var ghost_hits: Array = []  # [Rect2, номер войска] — призраки: где корона последний раз знала чужое войско (G.know)
var cour_hits: Array = []   # [Rect2, номер гонца]
var hov_cour := -1
var btns: Array = []        # [Rect2, действие]
var tips: Array = []        # [Rect2, Callable → строки] — подсказки верхней строки
var hov_sett := -1
var hov_army := -1
var hov_ghost := -1
var hov_tile := -1
var n_armies := 0           # войск нарисовано (для проверок)
var n_ghosts := 0           # призраков нарисовано
var t0 := Time.get_ticks_msec()
var prev = null             # UI.prev: путь под мышью {path, days, km, t}
var prev_goal := -1
var prev_at := -10.0
var prev_ms := 0.0
var hover_t := -1           # UI.hoverTile: клетка под мышью (или поселения под ней)

func _ready() -> void:
	super()

func _process(_d: float) -> void:
	pass

func now() -> float:
	return (Time.get_ticks_msec() - t0) / 1000.0

## всплывающая строка — окнам карты (map_ui.gd рисует её поверх окон)
func toast(s: String) -> void:
	if mv != null and mv.ui != null:
		mv.ui.toast(s)

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
	_field(p, 0)

## правая кнопка по карте: отмена цели приказа, «Стой!», окно поселения
func rclick(p: Vector2) -> void:
	if over_ui(p):
		return
	_field(p, 2)

## что под точкой экрана: войско, призрак, поселение (сверху — нарисованное последним) или клетка
func hit_at(p: Vector2) -> Dictionary:
	var ob = mv.objs
	var r := {"army": -1, "ghost": -1, "sett": -1, "tile": -1}
	for k in range(ob.army_hits.size() - 1, -1, -1):
		if (ob.army_hits[k][0] as Rect2).has_point(p):
			r.army = ob.army_hits[k][1]
			return r
	for k in range(ob.ghost_hits.size() - 1, -1, -1):
		if (ob.ghost_hits[k][0] as Rect2).has_point(p):
			r.ghost = ob.ghost_hits[k][1]
			return r
	for k in range(ob.sett_hits.size() - 1, -1, -1):
		if (ob.sett_hits[k][0] as Rect2).has_point(p):
			r.sett = ob.sett_hits[k][1]
			return r
	if p.x >= 0 and p.y >= 0 and p.x < W and p.y < H:
		r.tile = mv.tile_at(p)
	return r

## щелчок по полю карты (clickArmy, clickSett, mapClick): b — 0 левая, 2 правая
func _field(p: Vector2, b: int) -> void:
	var h := hit_at(p)
	if not sim_on():
		if h.sett >= 0 and b == 0:
			var s: Dictionary = mv.G.W.setts[h.sett]
			toast(String(s.name) + " — " + String(SETT_T[s.type]).to_lower())
		return
	if h.army >= 0:
		var a: Variant = Sim.armyById(float(h.army))
		if a != null:
			click_army(a, b)
	elif h.sett >= 0:
		click_sett(h.sett, b)
	elif h.ghost < 0 and h.tile >= 0:
		map_click(h.tile, b)

func click_sett(sid: int, b: int) -> void:
	var ui = mv.ui
	var pa: Variant = Sim.playerArmy()
	var ws: Dictionary = Sim.W.setts[sid]
	if ui.target != null and ui.target.kind == "cmd":
		if b == 2:
			ui.target = null
			toast("Отменено.")
			return
		ui.cmd_pick_sett(sid)
		return
	if pa == null:
		ui.open_settinfo(sid)
		return
	if b == 2:
		ui.open_sett(sid)
		return
	if SimPlayer.settHere(pa) == sid:
		ui.arrive_sett(sid)
		return
	if SimPlayer.orderMove(int(ws.i), {"k": "sett", "s": float(sid)}):
		if Sim.hostile(pa.realm, Sim.G.setts[sid].ctrl):
			toast("Идём на " + String(ws.name) + ": по прибытии — осада или приступ.")
		else:
			toast("Идём в " + String(ws.name) + ": по прибытии войдём в " + String(ui.SETT_ACC[ws.type]) + ".")

func click_army(a: Dictionary, b: int) -> void:
	var ui = mv.ui
	var pa: Variant = Sim.playerArmy()
	if ui.target != null and ui.target.kind == "cmd":
		if b == 2:
			ui.target = null
			toast("Отменено.")
			return
		ui.cmd_pick_army(a)
		return
	if pa == null:
		if a.realm == 0.0 and a.kind == "lord":
			ui.open_cmd(a.id)
		else:
			toast(SimText.armyLabel(a))
		return
	if a.id == pa.id:
		var sh := SimPlayer.settHere(pa)
		if sh >= 0 and b != 2 and pa.path == null:
			ui.arrive_sett(sh)
			return
		ui.open_cmd(pa.id)
		return
	if Sim.G.has("court") and a.realm == 0.0 and a.kind == "lord" and b != 2:
		ui.open_cmd(a.id)
		return
	if Sim.hostile(pa.realm, a.realm):
		if SimPlayer.orderMove(Sim.armyTile(a), null, a.id):
			toast("Преследуем: " + SimText.armyLabel(a))
	else:
		SimPlayer.orderMove(Sim.armyTile(a))

func map_click(t: int, b: int) -> void:
	var ui = mv.ui
	if ui.target != null and ui.target.kind == "cmd":
		if b == 2:
			ui.target = null
			toast("Отменено.")
			return
		var sid := SimDay.settNear(t % WorldData.MW + 0.5, floorf(float(t) / WorldData.MW) + 0.5, 1.6)
		if sid >= 0 and ui.target.o != "join":
			ui.cmd_pick_sett(sid)
			return
		toast("Щёлкните по войску короны." if ui.target.o == "join" else "Щёлкните по крепости или деревне.")
		return
	var pa: Variant = Sim.playerArmy()
	if b == 2:
		if pa != null and pa.path != null:
			pa.path = null
			pa.onArrive = null
			Sim.G.player.follow = -1.0
			toast("Стой!")
		return
	if pa == null:
		return
	SimPlayer.orderMove(t)

func _cap(s: String) -> String:
	return s.substr(0, 1).to_upper() + s.substr(1) if s != "" else s

func hover_s() -> String:
	if hov_army >= 0:
		var a: Variant = Sim.armyById(float(hov_army))
		return SimText.armyLabel(a) if a != null else ""
	if hov_ghost >= 0:
		return "призрак " + str(hov_ghost)
	if hov_sett >= 0:
		return String(mv.G.W.setts[hov_sett].name)
	if hov_tile >= 0:
		return tile_tip(hov_tile)
	return ""

func rc(i: int) -> Dictionary:
	return mv.G.M.realms[clampi(i, 0, 6)]

## королевство есть (Sim.G) — карта показывает его: туман, владельцы по поселениям, войска
func sim_on() -> bool:
	return not Sim.G.is_empty()

func fog_on() -> bool:
	return sim_on() and not JS.t(Sim.G.mapOpen)

func explored(t: int) -> bool:
	return not fog_on() or Sim.G.explored[t] != 0

func ctrl_of(sid: int) -> int:
	return int(Sim.G.setts[sid].ctrl) if sim_on() else mv.G.own[mv.G.W.setts[sid].prov]

func _draw() -> void:
	btns = []
	tips = []
	if part == "objs":
		sett_hits = []
		army_hits = []
		ghost_hits = []
		cour_hits = []
		n_armies = 0
		n_ghosts = 0
		if mv.on:
			_labels()
			var pa: Variant = Sim.playerArmy() if sim_on() else null
			if pa != null and pa.path != null:
				draw_path(pa, pa.path, int(JS.n(pa.get("pi"))), Color.html("#fff2c8"), true)
			_setts()
			if sim_on():
				_ghosts()
				_armies()
				_couriers()
		return
	if not mv.on:
		_loading()
		return
	var G: MapGPU = mv.G
	var m := mouse()
	if mv.mode == "pol" and mv.cam.z < 0.5:
		_realm_names()
	# что под мышью: войско или поселение (сверху — нарисованное последним) или клетка
	hov_sett = -1
	hov_army = -1
	hov_ghost = -1
	hov_tile = -1
	hov_cour = -1
	var ob = mv.objs
	var ui = mv.ui
	var held: bool = ui.is_open()
	if not mv.dragging and not over_ui(m) and not ui.capture(m):
		for k in range(ob.army_hits.size() - 1, -1, -1):
			if (ob.army_hits[k][0] as Rect2).has_point(m):
				hov_army = ob.army_hits[k][1]
				break
		for k in range(ob.cour_hits.size() - 1, -1, -1):
			if (ob.cour_hits[k][0] as Rect2).has_point(m):
				hov_cour = ob.cour_hits[k][1]
				break
		if hov_army < 0 and hov_cour < 0:
			for k in range(ob.ghost_hits.size() - 1, -1, -1):
				if (ob.ghost_hits[k][0] as Rect2).has_point(m):
					hov_ghost = ob.ghost_hits[k][1]
					break
		if hov_army < 0 and hov_ghost < 0 and hov_cour < 0:
			for k in range(ob.sett_hits.size() - 1, -1, -1):
				if (ob.sett_hits[k][0] as Rect2).has_point(m):
					hov_sett = ob.sett_hits[k][1]
					break
		if hov_army < 0 and hov_ghost < 0 and hov_cour < 0 and hov_sett < 0 and m.x >= 0 and m.y >= 0 and m.x < W and m.y < H:
			hov_tile = mv.tile_at(m)
	_hover_preview(m)
	_top()
	_mini()
	_feed()
	_status()
	if Game.speed == 0 and not held:
		pause_mark(now())
	if held:
		pass
	elif hov_cour >= 0:
		_tip(_rows(cour_tip(hov_cour)), m)
	elif hov_army >= 0:
		var a: Variant = Sim.armyById(float(hov_army))
		if a != null:
			_tip(_rows(SimText.armyTip(a)), m)
	elif hov_ghost >= 0:
		var K: Variant = Sim.G.get("know")
		if typeof(K) == TYPE_DICTIONARY and K.has(str(hov_ghost)):
			_tip(_rows(SimText.ghostTip(K[str(hov_ghost)])), m)
	elif hov_sett >= 0:
		_tip(sett_tip(hov_sett), m)
	else:
		for tp in tips:
			if (tp[0] as Rect2).has_point(m):
				_tip(_rows((tp[1] as Callable).call()), m)
				break
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
		if not explored(int(floorf(L.y)) * WorldData.MW + int(floorf(L.x))):
			continue
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
		if not explored(s.i):
			continue
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
		var ctrl := ctrl_of(s.id)
		var d := rc(ctrl)
		var col := Color.html(String(d.col))
		var big: bool = s.type != "village"
		var cap: bool = s.type == "capital"
		var lc := Color.html(SimText.settLabelCol(Sim.G.setts[s.id])) if sim_on() else (Color.html("#cfe2ff") if ctrl == 0 else Color.html("#fff2c8"))
		var sg: bool = sim_on() and JS.t(Sim.G.setts[s.id].siege)
		if z <= 0.25 or (z == 0.5 and not big):
			if not big and z <= 0.25:
				continue
			var r := (2 if cap else 1) if z < 0.25 else (3 if cap else (2 if big else 1))
			box(sx - r - 1, sy - r - 1, r * 2 + 3, r * 2 + 3, PO)
			box(sx - r, sy - r, r * 2 + 1, r * 2 + 1, col if big else Color.html("#e8d8a8"))
			if cap and crown >= 0 and not _hi("i_crown", "one", floorf(sx - 2), floorf(sy - 9)):
				spr(crown, floorf(sx - 2), floorf(sy - 9))
			if z == 0.5 or cap:
				txt(s.name, sx, sy + 5, lc, "m" if cap else "s", "c", PO)
			sett_hits.append([Rect2(sx - 5, sy - 5, 11, 11), s.id])
			if sg:
				_siege_fx(sx, sy, 1, t)
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
		if sg:
			_siege_fx(sx, sy - 4 * sc, sc, t)
		if big or z >= 2.0:
			var fn := "m" if (cap or s.type == "town") else "s"
			txt(s.name, sx, sy + 5 * sc, lc, fn, "c", PO)
			var cx := floorf(sx - tw(s.name, fn) / 2.0 - 8)
			if cap and crown >= 0 and not _hi("i_crown", "one", cx, floorf(sy + 5 * sc)):
				spr(crown, cx, floorf(sy + 5 * sc))
		sett_hits.append([Rect2(x0, y0, sz.x * sc, sz.y * sc + 6), s.id])

func ms(k: String) -> int:
	return int(Art.D.get("mapspr", {}).get(k, -1))

func sp(k: String, x: float, y: float, sc: float = 1.0, a: float = 1.0, flip := false) -> void:
	var i := ms(k)
	if i >= 0:
		spr(i, x, y, sc, a, flip)

func disc(x: float, y: float, r: float, c: Color) -> void:
	draw_circle(Vector2(x, y), r, c)

## осада (drawSiegeFx): дым над поселением, огоньки, два шатра осаждающих
func _siege_fx(sx: float, sy: float, sc: int, t: float) -> void:
	for k in 3:
		var ph := fmod(t * 0.7 + k * 0.33, 1.0)
		disc(sx + sin(k * 2 + t) * 3, sy - 6 - ph * 16 * sc, 1 + ph * 3 * sc, Color(Color.html("#4a4440"), 0.5 * (1 - ph)))
	if sin(t * 9) > -0.3:
		box(sx - 1, sy - 3, 1, 1, Color.html("#ff9a3c"))
		box(sx + 1, sy - 4, 1, 1, Color.html("#ffe07a"))
	sp("a_tent", sx - 16 * sc, sy + 2, sc)
	sp("a_tent", sx + 8 * sc, sy + 4, sc)

func _ring(cx: float, cy: float, r: int, c: Color) -> void:
	var x := r
	var y := 0
	var e := 0
	cx = floorf(cx)
	cy = floorf(cy)
	while x >= y:
		for q in [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]:
			draw_rect(Rect2(cx + q[0], cy + q[1], 1, 1), c)
		y += 1
		e += 1 + 2 * y
		if 2 * (e - x) + 1 > 0:
			x -= 1
			e += 1 - 2 * x

## путь войска (drawPath): пунктир с тенью от войска по клеткам пути; у своего — кружок на конце каждого дня пути
## (с 1:1 — номер дня), в конце — кольцо
func draw_path(a: Dictionary, path: Array, from: int, col: Color, own: bool) -> void:
	if path.size() < 2:
		return
	var G: MapGPU = mv.G
	var MW := WorldData.MW
	var vp := Game.view_pos(a)
	var p0: Vector2 = mv.w2s(G.warp_pt(vp.x * WorldData.TS, vp.y * WorldData.TS))
	SimArmy.prep()
	var men := Sim.armyMen(a)
	var mounted := Sim.mountedN(a.u)
	var sea2 := Sim.seasonOf(Sim.G.day) * 2
	var mud := JS.n(Sim.G.get("mud"))
	var spd := SimArmy.armySpeed(a)
	var cost := 0.0
	var day := 1
	var dash := 0
	var sh := Color(20 / 255.0, 12 / 255.0, 10 / 255.0, 0.7)
	for k in range(from + 1, path.size()):
		var t := int(path[k])
		var q: Vector2 = mv.w2s(G.tile_center(t))
		var f := int(path[k - 1])
		var diag := f % MW != t % MW and f / MW != t / MW
		cost += SimArmy._stepCost(a, t, men, mounted, sea2, mud) * (1.414 if diag else 1.0)
		var n := maxi(1, int(p0.distance_to(q) / 2.0))
		if not (maxf(p0.x, q.x) < -4 or minf(p0.x, q.x) > W + 4 or maxf(p0.y, q.y) < -4 or minf(p0.y, q.y) > H + 4):
			for i in n:
				dash += 1
				if (dash >> 1) & 1:
					continue
				var x := floorf(p0.x + (q.x - p0.x) * i / n)
				var y := floorf(p0.y + (q.y - p0.y) * i / n)
				box(x, y + 1, 2, 1, sh)
				box(x, y, 2, 1, col)
		else:
			dash += n
		if own and cost / spd >= day:
			disc(q.x, q.y, 3, PO)
			disc(q.x, q.y, 2, Color.html("#f7d35c") if day <= 9 else Color.html("#e0a630"))
			if mv.cam.z >= 1.0:
				txt(str(day), q.x + 4, q.y - 3, Color.html("#fff2c8"), "s", "l", PO)
			day += 1
		p0 = q
	var e: Vector2 = mv.w2s(G.tile_center(int(path[path.size() - 1])))
	_ring(e.x, e.y, 3, col)
	_ring(e.x, e.y, 4, PO)

## путь под мышью (updateHoverPreview, drawHoverPreview): куда пойдёт войско короля, сколько вёрст и дней, хватит ли
## провианта; долгий поиск пути — реже
func _hover_preview(m: Vector2) -> void:
	hover_t = -1
	if mv.ui.is_open() or not sim_on():
		return
	var t: int = int(Sim.W.setts[hov_sett].i) if hov_sett >= 0 else hov_tile
	hover_t = t
	var pa: Variant = Sim.playerArmy()
	if pa == null or t < 0:
		prev = null
		return
	var nw := now()
	if t != prev_goal and nw - prev_at > maxf(0.1, prev_ms * 0.005):
		prev_goal = t
		prev_at = nw
		if not SimDay.passable(Sim.W.ter[t]):
			prev = null
			return
		var t0 := Time.get_ticks_usec()
		var p: Variant = SimArmy.planPath(pa, t)
		prev_ms = (Time.get_ticks_usec() - t0) / 1000.0
		prev = {"path": p, "days": SimArmy.pathDays(pa, p), "km": SimArmy.pathKm(p), "t": t} if p != null and (p as Array).size() > 1 else null
	if prev == null or hover_t != int(prev.t):
		return
	draw_path(pa, prev.path, 0, Color(1.0, 0.949, 0.784, 0.75), false)
	var d: float = prev.days
	var eat: float = Sim.armyMen(pa) + JS.n(pa.get("wounded")) + JS.n(pa.get("sick"))
	var food_d: float = JS.n(pa.get("food")) / maxf(1.0, eat)
	var lab := SimPlayer.kmTxt(prev.km) + " · ~" + (("%.1f" % d).replace(".", ",") if d < 10 else JS.s(JS.rnd(d))) + " " + Sim.plural(ceilf(d), "день", "дня", "дней")
	var warn := " · провианта на " + JS.s(floorf(food_d)) + " дн.!" if food_d < d else ""
	var s := lab + warn
	var w := tw(s) + 8.0
	var x := m.x + 12.0
	var y := m.y - 16.0
	if x + w > W:
		x = m.x - w - 6.0
	box(floorf(x), floorf(y), w, 11, Color(20 / 255.0, 14 / 255.0, 12 / 255.0, 0.85))
	txt(s, floorf(x) + 4, floorf(y) + 2, Color.html("#f7d35c") if warn != "" else Color.html("#fff2c8"))

## гонцы с приказами (drawCouriers): всадник с письмом и вымпелом; к войску — точки пути
func _couriers() -> void:
	var L: Variant = Sim.G.get("couriers")
	if not (L is Array) or (L as Array).is_empty():
		return
	var G: MapGPU = mv.G
	var s := 2 if mv.cam.z >= 1.6 else 1
	var t := now()
	var dot := Color(Color.html("#f7d35c"), 0.6)
	for cr: Dictionary in L:
		var c: Vector2 = mv.w2s(G.warp_pt(cr.x * WorldData.TS, cr.y * WorldData.TS))
		var a: Variant = Sim.armyById(cr.to)
		if a != null:
			var vp := Game.view_pos(a)
			var ap: Vector2 = mv.w2s(G.warp_pt(vp.x * WorldData.TS, vp.y * WorldData.TS))
			var d := c.distance_to(ap)
			if d > 8:
				var n := int(d / 4.0)
				for i in range(1, n):
					if i % 2 == 0:
						var k := float(i) / n
						box(roundf(c.x + (ap.x - c.x) * k), roundf(c.y - 3 + (ap.y - c.y) * k), s, s, dot)
		if c.x < -12 * s or c.y < -12 * s or c.x > W + 12 * s or c.y > H + 12 * s:
			continue
		var b := roundf(absf(sin(t * 10 + cr.id))) * s
		var fl := -1 if a != null and a.x < cr.x else 1
		var R2 := func(x: float, y: float, w: float, h: float, col: String) -> void:
			box(c.x + (x if fl > 0 else -x - w + 1) * s, c.y + y * s - b, w * s, h * s, Color.html(col))
		box(c.x - 4 * s, c.y + s, 9 * s, 2 * s, Color(Color.html("#0c0a10"), 0.35))
		R2.call(-3, -4, 6, 3, "#6a4428")
		R2.call(3, -6, 2, 3, "#6a4428")
		R2.call(4, -6, 1, 1, "#3a2614")
		R2.call(-4, -4, 1, 2, "#3a2614")
		R2.call(-3, -1, 1, 2, "#3a2614")
		R2.call(2, -1, 1, 2, "#3a2614")
		R2.call(-1, -8, 2, 4, "#22408a")
		R2.call(-1, -10, 2, 2, "#f0c8a0")
		R2.call(1, -7, 1, 2, "#f7d35c")
		R2.call(-2, -13, 1, 6, "#3a2614")
		R2.call(-1, -13, 2, 2, "#c03028")
		cour_hits.append([Rect2(c.x - 6 * s, c.y - 14 * s, 13 * s, 16 * s), int(cr.id)])

## подсказка гонца: к кому, что везёт, сколько ещё ехать
func cour_tip(id: int) -> Array:
	for cr: Dictionary in Sim.G.get("couriers", []):
		if int(cr.id) == id:
			var a: Variant = Sim.armyById(cr.to)
			return [SimText.row("Гонец с приказом"), SimText.row("К: " + SimText.armyLabel(a) if a != null else ""), SimText.row("«" + SimCmd.ordLabel(cr.ord) + "»"),
				SimText.row("Ещё ≈" + (("%.1f" % (JSM.hypot(a.x - cr.x, a.y - cr.y) / SimDyn.courierSpeed())) if a != null else "?") + " дн. пути", SimText.UIC.dim)]
	return []

## войска на карте (drawArmies): чужие — только в поле обзора; вдали — квадратик цвета державы, ближе — всадник,
## пехота (больше 150 и 400 воинов), шайка, караван с волом, лагерь с шатром и костром, флаг, число воинов (с 1:1)
func _armies() -> void:
	var G: MapGPU = mv.G
	var z: float = mv.cam.z
	var sc := 2 if z >= 2.0 else 1
	var list: Array = []
	var AA: Array = Sim.G.armies
	for k in AA.size():
		var a: Dictionary = AA[k]
		if not JS.t(a.alive) or not SimIntel.armyVisible(a):
			continue
		var vp := Game.view_pos(a)
		var p: Vector2 = mv.w2s(G.warp_pt(vp.x * WorldData.TS, vp.y * WorldData.TS))
		if p.x < -30 or p.y < -30 or p.x > W + 30 or p.y > H + 30:
			continue
		list.append([p.y, k, p.x])
	list.sort_custom(func(a, b): return a[0] < b[0] or (a[0] == b[0] and a[1] < b[1]))
	var t := now()
	var pid: float = Sim.G.player.army
	var pr: float = Sim.G.player.realm
	for e: Array in list:
		var a: Dictionary = AA[e[1]]
		var sx: float = e[2]
		var sy: float = e[0]
		var d := rc(int(a.realm))
		var col := Color.html(String(d.col))
		var isP: bool = a.id == pid
		var pth: Variant = a.get("path")
		var moving: bool = pth != null and (pth as Array).size() > 1 and JS.n(a.get("pi")) < (pth as Array).size() - 1
		# идёт на запад — лицом влево (в HTML — только в масштабе ×1)
		var flip: bool = moving and sc == 1 and fmod(float(pth[int(a.pi) + 1]), WorldData.MW) + 0.5 < a.x
		n_armies += 1
		if z <= 0.25:
			box(sx - 2, sy - 2, 5, 5, PO)
			box(sx - 1, sy - 1, 3, 3, Color.WHITE if isP else col)
			army_hits.append([Rect2(sx - 4, sy - 4, 9, 9), int(a.id)])
			continue
		if isP:
			var r := 7 + roundf(sin(t * 4))
			draw_arc(Vector2(sx, sy - 1), r * sc, 0, TAU, 24, Color(Color.html("#fff2c8"), 0.5), 1.0)
		box(sx - 5 * sc, sy, 10 * sc, 2 * sc, Color(Color.html("#0c0a10"), 0.35))
		var bob := roundf(absf(sin(t * 9 + a.id))) if moving else 0.0
		var camp: bool = not moving and String(a.get("mode", "")) in CAMP
		var key := "a_bandit" if a.kind == "bandit" else ("a_wagon" if a.kind == "caravan" else "a_knight")
		if camp and a.kind != "caravan":
			sp("a_tent", sx - 10 * sc, sy - 6 * sc, sc)
			if a.mode != "hide":
				sp("a_camp", sx + 3 * sc, sy - 3 * sc, sc)
				if sin(t * 12 + a.id) > 0:
					box(sx + 5 * sc, sy - 4 * sc, 1, 1, Color.html("#ffe07a"))
			if a.mode == "fort" and JS.n(a.get("fortDays")) >= 1:
				for k in range(-2, 3):
					box(sx + k * 4 * sc, sy + 2 * sc, 1, 3 * sc, Color.html("#6a4224"))
				box(sx - 9 * sc, sy + 3 * sc, 18 * sc, 1, Color.html("#8a5a34"))
		var men := Sim.armyMen(a)
		if a.kind == "bandit":
			sp(key, sx - 6 * sc, sy - 7 * sc - bob, sc, 1.0, flip)
			sp(key, sx - 1 * sc, sy - 6 * sc - bob, sc, 1.0, flip)
		elif a.kind == "caravan":
			sp("a_ox", sx - 11 * sc, sy - 4 * sc - bob, sc, 1.0, flip)
			sp(key, sx - 6 * sc, sy - 7 * sc, sc, 1.0, flip)
		else:
			if not camp or isP:
				sp(key, sx - 6 * sc, sy - 11 * sc - bob, sc, 1.0, flip)
			if men > 150:
				sp("a_foot", sx + 3 * sc, sy - 7 * sc - bob, sc, 1.0, flip)
			if men > 400:
				sp("a_foot", sx - 9 * sc, sy - 6 * sc - bob, sc, 1.0, flip)
		if a.kind != "bandit":
			_flag(sx + (-4 if flip else 3) * sc, sy - 19 * sc - bob, col, Color.html(String(d.dark)), t)
		if JS.t(a.get("hidden")):
			if not _hi("i_eye", "one", floorf(sx - 2), floorf(sy - 24 * sc), 0.5):
				sp("i_eye", floorf(sx - 2), floorf(sy - 24 * sc), 1, 0.5)
		if JS.t(a.get("fires")):
			for k in 3:
				if sin(t * 10 + k * 2) > -0.2:
					box(sx - 8 + k * 7, sy + 4, 1, 1, Color.html("#ff9a3c"))
		if z >= 1.0:
			var est := SimIntel.estimateMen(a)
			var lab := ("" if JS.t(est.exact) else "~") + SimText.fmt(est.n)
			var lw := tw(lab, "s") + 4
			var ly := sy - 30 * sc - bob if Sim.settAtTile(Sim.armyTile(a)) >= 0 else sy + 3 * sc
			box(floorf(sx - lw / 2.0), ly, lw, 7, Color.html("#22408a") if isP else (Color.html("#7a1e2a") if Sim.hostile(pr, a.realm) else Color.html("#3a2a1e")))
			txt(lab, sx, ly + 1, Color.html("#fff2c8"), "s", "c")
		army_hits.append([Rect2(sx - 8 * sc, sy - 16 * sc, 16 * sc, 22 * sc), int(a.id)])

## призраки (drawGhosts, deceitui.js): чужое войско вне обзора — там, где его видели последний раз (G.know), до 20 дней;
## чем старше весть, тем бледнее; с 1:1 — «?число · дни»
func _ghosts() -> void:
	var K: Variant = Sim.G.get("know")
	var z: float = mv.cam.z
	if typeof(K) != TYPE_DICTIONARY or z <= 0.25:
		return
	var G: MapGPU = mv.G
	var sc := 2 if z >= 2.0 else 1
	var paper := Color.html("#e8dcc0")
	for id: String in K:
		var k: Dictionary = K[id]
		var b: Variant = Sim.armyById(float(id))
		if b == null or SimIntel.armyVisible(b):
			continue
		var age: float = Sim.G.day - k.day
		if age > 20:
			continue
		if not Sim.G.explored[int(floorf(k.y)) * WorldData.MW + int(floorf(k.x))]:
			continue
		var p: Vector2 = mv.w2s(G.warp_pt(k.x * WorldData.TS, k.y * WorldData.TS))
		var sx := p.x
		var sy := p.y
		if sx < -20 or sy < -30 or sx > W + 20 or sy > H + 20:
			continue
		var d := rc(int(k.realm))
		var al := clampf(0.75 - age * 0.025, 0.28, 0.75)
		for i in range(0, 10 * sc, 2):
			box(floorf(sx), floorf(sy - i), 1, 1, Color(paper, al))
		box(sx + 1, sy - 10 * sc, 4 * sc, 3 * sc, Color(Color.html(String(d.col)), al))
		box(sx + 1, sy - 8 * sc, 4 * sc, sc, Color(Color.html(String(d.dark)), al))
		box(sx - 3 * sc, sy, 7 * sc, sc, Color(paper, al))
		if z >= 1.0:
			txt("?" + SimText.fmt(k.men) + " · " + (JS.s(age) + " дн." if age > 0 else "сег."), sx + 2, sy + 2, Color.html("#d8c8a8"), "s", "c", Color.html("#1a1410"))
		ghost_hits.append([Rect2(sx - 5 * sc, sy - 11 * sc, 11 * sc, 13 * sc), int(id)])
		n_ghosts += 1

func _realm_names() -> void:
	var G: MapGPU = mv.G
	var acc := {}
	for P: Dictionary in G.W.provs:
		var o: int = int(Sim.ownerOfProv(P.id)) if sim_on() else G.own[P.id]
		if o < 0 or o > 5:
			continue
		if not explored(G.W.setts[P.seat].i):
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
	if sim_on():
		return SimText.tileTip(t)
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

## строки подсказки {t, c, ic} или строки → [текст, цвет ("" — по умолчанию), значок (−1 — нет)]
func _rows(L: Array) -> Array:
	var out := []
	for r in L:
		if typeof(r) == TYPE_STRING:
			out.append([r, "", -1])
		elif r != null:
			var ic := String(r.get("ic", ""))
			out.append([String(r.t), String(r.get("c", "")), ms(ic) if ic != "" else -1])
	return out

func sett_tip(sid: int) -> Array:
	if sim_on():
		return _rows(SimText.settTip(sid))
	var G: MapGPU = mv.G
	var s: Dictionary = G.W.setts[sid]
	var o: int = G.own[s.prov]
	return [[String(s.name) + " — " + String(SETT_T[s.type]), Art.pal("y")], [String(rc(o).name), Color.html("#cfe2ff") if o == 0 else Color.html("#fff2c8")],
		["Провинция " + String(G.W.provs[s.prov].name), Art.pal("w")]]

## подсказка (drawTipBox): строки переносятся по 220 точек, значок — у первой строки, цвет по умолчанию — жёлтый у первой
func _tip(rows0: Array, m: Vector2) -> void:
	var rows: Array = []
	for r in rows0:
		var ls := wrap_text(String(r[0]), 220)
		for k in ls.size():
			var ic: int = int(r[2]) if r.size() > 2 and k == 0 else -1
			var c: Variant = r[1]
			if typeof(c) == TYPE_STRING:
				c = Color.html(c) if c != "" else null
			rows.append([ls[k], c, ic])
	if rows.is_empty():
		return
	var w := 0.0
	for r in rows:
		w = maxf(w, tw(r[0]) + (Art.size(r[2]).x + 3 if r[2] >= 0 else 0.0))
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
		var tx := x + 5
		if rows[i][2] >= 0:
			spr(rows[i][2], tx, y + 4 + i * 10)
			tx += Art.size(rows[i][2]).x + 3
		var c: Variant = rows[i][1]
		txt(rows[i][0], tx, y + 5 + i * 10, c if c != null else (Art.pal("y") if i == 0 else Art.pal("w")))

func _status() -> void:
	var s := ""
	var tg = mv.ui.target
	if tg != null:
		var t := hover_t if hover_t >= 0 else hov_tile
		s = "Приказ «" + String(SimCmd.CMD.get(tg.o, {}).get("n", "")) + "»: укажите " + ("войско" if tg.o == "join" else "крепость") + " на карте · ПКМ — отмена"
		if t >= 0 and Sim.W.prov[t] >= 0:
			s += " · " + String(Sim.W.provs[Sim.W.prov[t]].name)
	elif hov_tile >= 0:
		s = tile_tip(hov_tile)
	elif help:
		if sim_on() and Sim.playerArmy() != null:
			s = "ЛКМ — идти, по врагу — погоня · ПКМ — стой · C — к войску · F — фураж · V — войска · H"
		else:
			s = "Мышь или WASD — двигать · колесо, Q и E — масштаб · Пробел — пауза · 1–3 — скорость · V — войска · Tab — ко двору · H"
	if s == "":
		return
	var w := tw(s, "s") + 10.0
	var x := floorf(clampf(W / 2.0 - w / 2.0 - 20.0, 242.0, W - 140.0 - w)) if hov_tile >= 0 or tg != null or (sim_on() and Sim.playerArmy() != null) else 8.0
	box(x, H - 12, w, 11, Color(20 / 255.0, 14 / 255.0, 12 / 255.0, 0.8))
	txt(s, x + 5, H - 9, Color.html("#e8dcc0"), "s")

# ---------- верхняя строка и мини-карта ----------
func _btn(label: String, x: float, y: float, w: float, h: float, act: Callable, active := false, ic := "") -> void:
	var r := Rect2(x, y, w, h)
	var hv: bool = r.has_point(mouse()) and not mv.ui.is_open()
	box(x, y, w, h, PO)
	box(x + 1, y + 1, w - 2, h - 2, Color8(90, 64, 48) if (active or hv) else Color8(44, 32, 24))
	box(x + 1, y + 1, w - 2, 1, Color8(120, 88, 60) if (active or hv) else Color8(64, 46, 34))
	var lx := x + w / 2.0
	if ic != "":
		var iw := icon(ic, x + 4, y + 4)
		lx += (iw + 2) / 2.0
	txt(label, lx, y + 4, Color8(255, 242, 200) if (active or hv) else Color8(232, 220, 192), "m", "c")
	btns.append([r, act])

## кнопка-значок 12×14 в верхней строке (btn style dark); dot — красная точка (непрочитанные письма)
func _ibtn(ik: String, x: float, act: Callable, active: bool, tip: Callable, dot := false) -> void:
	var r := Rect2(x, 2, 12, 14)
	var lit: bool = active or (r.has_point(mouse()) and not mv.ui.is_open())
	box(x, 2, 12, 14, PO)
	box(x + 1, 3, 10, 12, Color8(90, 64, 48) if lit else Color8(44, 32, 24))
	var ic: Array = Art.D["icons"].get(ik, [])
	if not ic.is_empty():
		var sz := Art.size(ic[0])
		var X := roundf(x + 6 - sz.x / 2.0)
		var Y := roundf(2 + (14 - sz.y) / 2.0)
		if not _hi(ik, "one", X, Y):
			spr(ic[0], X, Y)
	if dot:
		box(x + 7, 1, 6, 6, PO)
		box(x + 8, 2, 4, 4, Color.html("#e04030"))
	btns.append([r, act])
	tips.append([r, tip])

func _bar(x: float, y: float, w: float, h: float, v: float, c: String) -> void:
	box(x, y, w, h, PO)
	box(x + 1, y + 1, w - 2, h - 2, Color.html("#2a1d16"))
	box(x + 1, y + 1, roundf((w - 2) * clampf(v, 0.0, 1.0)), h - 2, Color.html(c))

## припасы войска короля в верхней строке (drawTopBar): люди, провиант, вода, дух, усталость
func _army_stats(pa: Dictionary, x: float) -> float:
	var U: Dictionary = SimText.UIC
	var men := Sim.armyMen(pa)
	var eat: float = men + JS.n(pa.get("wounded")) + JS.n(pa.get("sick"))
	var fd: float = JS.n(pa.get("food")) / maxf(1.0, eat)
	icon("i_men", x, 7)
	txt(SimText.fmt(men), x + 8, 6, Art.pal("w"))
	tips.append([Rect2(x, 2, 36, 14), func(): return [SimText.row("Войско короля: " + SimArmy.voin(men)), SimText.row("Раненых " + JS.s(JS.rnd(JS.n(pa.get("wounded")))) + ", больных " + JS.s(JS.rnd(JS.n(pa.get("sick"))))), SimText.row("V — окно войска", U.dim)]])
	x += 40.0
	icon("i_food", x, 7)
	txt(JS.s(floorf(fd)) + " дн.", x + 8, 6, Color.html(U.bad) if fd < 3 else (Color.html(U.warn) if fd < 7 else Art.pal("w")))
	tips.append([Rect2(x, 2, 44, 14), func(): return [SimText.row("Провиант: " + JS.s(JS.rnd(JS.n(pa.get("food")))) + " (на " + ("%.1f" % fd) + " дн.)"), SimText.row("Каждый воин съедает 1 в день. Каждый несёт 3, повозка — 400."),
		SimText.row("В своих городах войско стоит на постое: город кормит его за золото казны."), SimText.row("O — снабжение: снабженец сам докупает в своих и нейтральных городах.", U.good),
		SimText.row("«Войско без обоза погибает; без провианта — погибает» (гл. 7).", "#e8d8b0")]])
	x += 48.0
	var wa: float = JS.n(pa.get("water"))
	icon("i_water", x, 7)
	txt(JS.s(JS.rnd(wa)), x + 8, 6, Color.html(U.bad) if JS.t(pa.get("thirst")) else (Color.html(U.warn) if wa < 1.5 else Art.pal("w")))
	tips.append([Rect2(x, 2, 22, 14), func(): return _water_tip(pa)])
	x += 24.0
	var mo: float = JS.n(pa.get("morale"))
	icon("i_morale", x, 7)
	_bar(x + 8, 7, 34, 6, mo / 100.0, "#c0353f" if mo < 35 else ("#e0a630" if mo < 55 else "#7fb04c"))
	tips.append([Rect2(x, 2, 44, 14), func(): return SimText.moraleTip(pa)])
	x += 48.0
	var ft: float = JS.n(pa.get("fat"))
	icon("i_fat", x, 7)
	_bar(x + 8, 7, 24, 6, ft / 100.0, "#c0353f" if ft > 70 else "#c9a060")
	tips.append([Rect2(x, 2, 34, 14), func(): return [SimText.row("Усталость: " + JS.s(JS.rnd(ft)) + "%"), SimText.row("Растёт на марше (форсированный ×3), спадает на отдыхе. Усталые медленнее и слабее в бою.")]])
	return x + 36.0

func _water_tip(pa: Dictionary) -> Array:
	var wd := SimDay.waterDay(pa)
	var wa: float = JS.n(pa.get("water"))
	var full := JS.t(wd.get("full"))
	var d: float = JS.n(wd.get("d"))
	var left := "" if full or d >= 0 else " · хватит на ≈" + JS.s(maxf(0.0, floorf(wa / -d))) + " дн."
	return [SimText.row("Вода: " + JS.s(JS.rnd(wa)) + " дн. нормы" + left),
		SimText.row("Сегодня: " + ("бочки полны" if full else ("не убывает" if d >= 0 else "−" + ("%.1f" % -d) + " в день")) + " — " + String(wd.s) + "."),
		SimText.row("Полно воды у рек, озёр и поселений (не у моря); в лесу, на болоте и в холмах выручают ручьи и родники; в степи и в жару — только бочки."),
		SimText.row("Полный запас: " + JS.s(Sim.waterCap(pa)) + " дн. (4 + повозки) · O — снабжение", SimText.UIC.dim)]

func _top() -> void:
	box(0, 0, W, 19, PO)
	box(0, 0, W, 18, Color8(42, 29, 22))
	box(0, 0, W, 1, Color8(74, 48, 32))
	box(0, 17, W, 1, Color8(106, 68, 40))
	var x := 4.0
	icon("shield0", x, 3)
	x += 16.0
	var bv := SimText.bar_vals()
	var net: float = bv.net
	var gs := SimText.fmt(bv.gold)
	icon("i_gold", x, 7)
	txt(gs, x + 8, 6, Color.html("#ee7a6a") if bv.gold < 0 else Art.pal("y"))
	var x2 := x + 10.0 + tw(gs)
	txt(("+" if net >= 0.0 else "−") + "%.1f" % absf(net), x2, 6, Color.html("#9fe07a") if net >= 0.0 else Color.html("#ee7a6a"), "s")
	if sim_on():
		tips.append([Rect2(x, 2, x2 + 26 - x, 14), func(): return SimText.goldTip()])
	x = x2 + 30.0
	var pa: Variant = Sim.playerArmy() if sim_on() else null
	if pa != null:
		x = _army_stats(pa, x)
	else:
		# со стола карт (mapCourtBar): ко двору и войска короны
		_btn("« Ко двору (Tab)", x, 2, 92, 14, func(): mv.leave.emit())
		tips.append([Rect2(x, 2, 92, 14), func(): return [SimText.row("Вернуться в замок"), SimText.row("Вы смотрите на карту королевства со стола в зале совета. Всё, что вы видите, — со слов гонцов и разведчиков.", SimText.UIC.dim)]])
		if sim_on():
			var ui = mv.ui
			_btn("Войска", x + 96, 2, 60, 14, func(): ui.open_cmd(), ui.win != null and ui.win.k == "cmd", "i_sword")
			tips.append([Rect2(x + 96, 2, 60, 14), func(): return [SimText.row("Войска короны и приказы (V)")]])
			x += 160.0
		else:
			x += 92.0
	var pol: bool = mv.mode == "pol"
	_btn("Державы" if pol else "Местность", W - 70, 2, 66, 14, func(): mv.set_mode("ter" if mv.mode == "pol" else "pol"), pol)
	# скорость: пауза и 1–3 (speedBtns)
	var bx := W - 133.0
	var held: bool = mv.ui.is_open() and Game.speed > 0
	speed_btns(bx, mouse(), held)
	for i in 4:
		var r := Rect2(bx + i * 15, 2, 14, 14)
		btns.append([r, func(): Game.set_speed(i)])
		if i == 0 and held:
			tips.append([r, func(): return [SimText.row("Время стоит"), SimText.row("Пока открыто окно, письмо или идёт разговор, время не идёт. Закройте окно — и оно пойдёт со скоростью " + str(Game.speed) + ".", "#e8dcc0")]])
		else:
			tips.append([r, func(): return [SimText.row(SPD_TIP[i])]])
	if held:
		var a := 0.55 + sin(now() * 3.0) * 0.3
		box(bx + Game.speed * 15 + 3, 13, 8, 1, Color(Art.pal("y"), a))
	# окна двора (B3 в drawTopBar): Малый совет и письма — с красной точкой, пока есть непрочитанные
	if sim_on() and Sim.G.has("court"):
		bx -= 6.0 + 2 * 13.0
		var ui = mv.ui
		var un: int = ui.unread()
		_ibtn("i_seal", bx, func(): ui.toggle_win("council"), ui.win != null and ui.win.k == "council", func(): return [SimText.row("Малый совет (K)")])
		_ibtn("i_raven", bx + 13, func(): ui.toggle_win("letters"), ui.win != null and ui.win.k == "letters", func(): return [SimText.row("Письма (L)" + (" — непрочитанных: " + str(un) if un > 0 else ""))], un > 0)
	# дата и погода королевства (weatherOf), с распутицей; не влезает — сначала короче, потом без названия погоды
	var end_x := bx - 6.0
	var ds := Game.date_text()
	var tot := tw(ds)
	var wn := ""
	var ic := ""
	if sim_on():
		var Wt := Sim.weatherOf()
		var mud := JS.t(Sim.G.get("mudOn"))
		ic = "i_" + String(Wt.ic)
		wn = String(Wt.n) + (" · распутица" if mud else "")
		tot = tw(ds) + 14.0 + tw(wn, "s")
		if x + 6.0 + tot > end_x:
			wn = "распутица" if mud else ""
			tot = tw(ds) + 14.0 + tw(wn, "s")
			if x + 6.0 + tot > end_x:
				wn = ""
				tot = tw(ds) + 12.0
	var dx0 := maxf(x + 6.0, end_x - tot)
	txt(ds, dx0, 6, Color8(255, 242, 200))
	if ic != "":
		icon(ic, dx0 + tw(ds) + 4, 7)
		if wn != "":
			txt(wn, dx0 + tw(ds) + 13, 6, Color.html("#c8d8e8"), "s")
		tips.append([Rect2(dx0, 2, tot, 14), func(): return SimText.dateTip()])
	var zs := "масштаб " + ("1/%d" % roundi(1.0 / mv.cam.z) if mv.cam.z < 1.0 else "×%d" % roundi(mv.cam.z))
	var zx := dx0 - 12.0 - tw(zs, "s")
	if zx > x + 6.0:
		txt(zs, zx, 7, Color8(200, 184, 152), "s")

## лента летописи (drawFeed): до пяти записей за последние 14 с, свежие внизу, над мини-картой; гаснут за 3 с
func _feed() -> void:
	if not sim_on():
		return
	var t := Time.get_ticks_msec() / 1000.0
	var list: Array = []
	for f: Dictionary in Sim.feed:
		if t - float(f.at) < 14.0:
			list.append(f)
	list = list.slice(-5)
	list.reverse()
	var x := W - 236.0
	var y := H - 96.0
	for f: Dictionary in list:
		var a := clampf(1.0 - (t - float(f.at) - 11.0) / 3.0, 0.0, 1.0)
		var ls := wrap_text(String(f.t), 226)
		var h := ls.size() * 9.0 + 3.0
		y -= h + 1.0
		box(x, y, 234, h, Color(0.086, 0.059, 0.047, a * 0.85))
		var c: Color = Art.pal("y") if f.c == "title" else Color.html(FEED_C.get(String(f.c), "#e8dcc0"))
		c.a = a
		for i in ls.size():
			txt(ls[i], x + 4, y + 2 + i * 9, c)

func _mini() -> void:
	var G: MapGPU = mv.G
	if not G.T.has("mini"):
		return
	box(MX - 3, MY - 3, 134, 86, PO)
	box(MX - 2, MY - 2, 132, 84, Color.html("#7a5030"))
	box(MX - 1, MY - 1, 130, 82, PO)
	draw_texture(G.T.mini, Vector2(MX, MY))
	var k := 128.0 / WorldData.WPW
	if sim_on():
		# войска на мини-карте: свои и видимые чужие — точки цвета державы, разбойники — тёмные
		var pid: float = Sim.G.player.army
		for a: Dictionary in Sim.G.armies:
			if not JS.t(a.alive) or not SimIntel.armyVisible(a):
				continue
			var ax: float = MX + a.x * WorldData.TS * k
			var ay: float = MY + a.y * WorldData.TS * k
			var isP: bool = a.id == pid
			var c := (Color.WHITE if sin(now() * 6) > 0 else Art.pal("y")) if isP else (Color.html("#1b1420") if a.kind == "bandit" else Color.html(String(rc(int(a.realm)).dark)))
			box(floorf(ax) - (1 if isP else 0), floorf(ay) - (1 if isP else 0), 3 if isP else 2, 3 if isP else 2, c)
	var vw: float = W / mv.cam.z * k
	var vh: float = H / mv.cam.z * k
	stroke(roundf(MX + mv.cam.x * k - vw / 2.0), roundf(MY + mv.cam.y * k - vh / 2.0), roundf(vw), roundf(vh), Color.html("#fff2c8"))
