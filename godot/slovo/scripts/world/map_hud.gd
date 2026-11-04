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
var btns: Array = []        # [Rect2, действие]
var tips: Array = []        # [Rect2, Callable → строки] — подсказки верхней строки
var hov_sett := -1
var hov_army := -1
var hov_ghost := -1
var hov_tile := -1
var n_armies := 0           # войск нарисовано (для проверок)
var n_ghosts := 0           # призраков нарисовано
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
	if hov_army >= 0:
		var a: Variant = Sim.armyById(float(hov_army))
		if a != null:
			toast(_cap(SimText.armyLabel(a)) + ". Приказы войскам — в следующих версиях.")
		return
	if hov_sett >= 0:
		var s: Dictionary = mv.G.W.setts[hov_sett]
		var t := String(s.name) + " — " + String(SETT_T[s.type]).to_lower()
		if sim_on():
			var S: Dictionary = Sim.G.setts[hov_sett]
			t += ", " + SimText.realmName(S.ctrl) + ", жителей " + SimText.fmt(S.pop)
		toast(t + ". Походы и рынки — в следующих версиях.")

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
		n_armies = 0
		n_ghosts = 0
		if mv.on:
			_labels()
			_setts()
			if sim_on():
				_ghosts()
				_armies()
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
	var ob = mv.objs
	if not mv.dragging and not over_ui(m):
		for k in range(ob.army_hits.size() - 1, -1, -1):
			if (ob.army_hits[k][0] as Rect2).has_point(m):
				hov_army = ob.army_hits[k][1]
				break
		if hov_army < 0:
			for k in range(ob.ghost_hits.size() - 1, -1, -1):
				if (ob.ghost_hits[k][0] as Rect2).has_point(m):
					hov_ghost = ob.ghost_hits[k][1]
					break
		if hov_army < 0 and hov_ghost < 0:
			for k in range(ob.sett_hits.size() - 1, -1, -1):
				if (ob.sett_hits[k][0] as Rect2).has_point(m):
					hov_sett = ob.sett_hits[k][1]
					break
		if hov_army < 0 and hov_ghost < 0 and hov_sett < 0 and m.x >= 0 and m.y >= 0 and m.x < W and m.y < H:
			hov_tile = mv.tile_at(m)
	_top()
	_mini()
	_feed()
	_status()
	if Game.speed == 0:
		pause_mark(now())
	if hov_army >= 0:
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
	if hov_tile >= 0:
		s = tile_tip(hov_tile)
	elif help:
		s = "Мышь или WASD — двигать · колесо, Q и E — масштаб · Пробел — пауза · 1–3 — скорость · Tab — ко двору · H"
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
	_btn("« Ко двору (Tab)", x, 2, 92, 14, func(): mv.leave.emit())
	x += 92.0
	var pol: bool = mv.mode == "pol"
	_btn("Державы" if pol else "Местность", W - 70, 2, 66, 14, func(): mv.set_mode("ter" if mv.mode == "pol" else "pol"), pol)
	# скорость: пауза и 1–3 (speedBtns)
	var bx := W - 133.0
	speed_btns(bx, mouse())
	for i in 4:
		var r := Rect2(bx + i * 15, 2, 14, 14)
		btns.append([r, func(): Game.set_speed(i)])
		tips.append([r, func(): return [SimText.row(SPD_TIP[i])]])
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
