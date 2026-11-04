class_name SimArmy
## Походы войск — army.js с обёртками march.js (распутица, переправы), deceit.js (чучела на стенах), reign.js (летопись),
## astar и moveCost из worldgen.js, onCapture из events.js: пути, движение по шагам, осады и взятие поселений, отход после
## боя; встречи войск ИИ (aiContacts из ai.js). Бой до среза 0.7 — «на счётах» (quickRun): по силе, духу, усталости, стенам
## и удаче, без поля боя; в HTML-эталоне (pageQuick в tools/sim_export.mjs) — тот же. Шаг движения substep — worldAdvance из
## command.js без короля в поле; сутки — STEPS шагов, затем день королевства (SimDay.dailyTick).

const MW := WorldData.MW
const MH := WorldData.MH
const NT := WorldData.NT
const STEPS := 24
const DX8: Array[int] = [1, -1, 0, 0, 1, 1, -1, -1]
const DY8: Array[int] = [0, 0, 1, -1, 1, -1, 1, -1]
const MUDT := {WorldData.GRASS: 1.0, WorldData.FARM: 1.2, WorldData.MARSH: 1.3, WorldData.STEPPE: 0.8, WorldData.FOREST: 0.7, WorldData.DFOREST: 0.7,
	WorldData.HILLS: 0.5, WorldData.MOUNT: 0.3, WorldData.PEAK: 0.0, WorldData.BEACH: 0.4, WorldData.SNOW: 0.5}
const GXP := {"levy": 10.0, "spear": 15.0, "sword": 20.0, "archer": 15.0, "xbow": 15.0, "horse": 15.0, "harch": 15.0, "knight": 25.0}
const STYPE := {"capital": ["столица", "Взята столица", "Пала столица"], "castle": ["замок", "Взят замок", "Пал замок"], "town": ["город", "Взят город", "Пал город"], "village": ["деревня", "Взята деревня", "Пала деревня"]}
const ROMAN := ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
const ERA_Y := [1, 4, 8]

# цены клеток: класс клетки (местность, дорога, река, мост, брод) → цена по сезону и коннице
static var cls_w: WorldData = null
static var cls := PackedInt32Array()
static var cls_key: Array = []            # класс → [местность, дорога, река, мост, брод]
static var ctab32: Array = []             # [сезон·2 + конница] → PackedFloat32Array цен классов (costTable в HTML — Float32Array)
static var ctab64: Array = []             # то же без округления (moveCost для stepCost)
static var comp := PackedInt32Array()     # связность суши по 4 соседям (−1 — непроходимо): пути между частями нет
# A*
static var ag := PackedFloat64Array()
static var afrom := PackedInt32Array()
static var ast := PackedInt32Array()
static var acl := PackedInt32Array()
static var agen := 0
static var alast := 0
static var path_n := 0                    # для замеров: сколько путей, мкс и узлов
static var path_us := 0
static var path_nodes := 0
static var path_max_us := 0
static var step_us := 0                   # время последнего шага движения, мкс


# ---------- клетки и цены (moveCost, costTable) ----------
static func prep() -> void:
	var W := Sim.W
	if cls_w == W:
		return
	cls_w = W
	cls = PackedInt32Array()
	cls.resize(NT)
	cls_key = []
	var idx := {}
	var ter := W.ter
	var road := W.road
	var river := W.river
	var bridge := W.bridge
	var ford := W.ford
	for j in NT:
		var key: int = ter[j] | (road[j] << 4) | (river[j] << 5) | (bridge[j] << 13) | (ford[j] << 14)
		var c: Variant = idx.get(key)
		if c == null:
			c = cls_key.size()
			idx[key] = c
			cls_key.append([ter[j], road[j], river[j], bridge[j], ford[j]])
		cls[j] = c
	ctab32 = []
	ctab64 = []
	for k in 8:
		var t32 := PackedFloat32Array()
		var t64 := PackedFloat64Array()
		t32.resize(cls_key.size())
		t64.resize(cls_key.size())
		for c in cls_key.size():
			var v := _cost(cls_key[c], k >> 1, (k & 1) == 1)
			t32[c] = v
			t64[c] = v
		ctab32.append(t32)
		ctab64.append(t64)
	# связность: волна по 4 соседям по проходимым клеткам
	comp = PackedInt32Array()
	comp.resize(NT)
	comp.fill(-2)
	var pas := PackedByteArray()
	pas.resize(cls_key.size())
	for c in cls_key.size():
		pas[c] = 1 if float(Sim.TINFO[cls_key[c][0]].cost) > 0 else 0
	for j in NT:
		if pas[cls[j]] == 0:
			comp[j] = -1
	var q := PackedInt32Array()
	q.resize(NT)
	var nc := 0
	for s in NT:
		if comp[s] != -2:
			continue
		var qh := 0
		var qt := 1
		q[0] = s
		comp[s] = nc
		while qh < qt:
			var i := q[qh]
			qh += 1
			var x := i % MW
			if x < MW - 1 and comp[i + 1] == -2:
				comp[i + 1] = nc
				q[qt] = i + 1
				qt += 1
			if x > 0 and comp[i - 1] == -2:
				comp[i - 1] = nc
				q[qt] = i - 1
				qt += 1
			if i < NT - MW and comp[i + MW] == -2:
				comp[i + MW] = nc
				q[qt] = i + MW
				qt += 1
			if i >= MW and comp[i - MW] == -2:
				comp[i - MW] = nc
				q[qt] = i - MW
				qt += 1
		nc += 1


## moveCost (worldgen.js) для класса клетки
static func _cost(key: Array, season: int, cav: bool) -> float:
	var b: int = key[0]
	var c := float(Sim.TINFO[b].cost)
	if c == 0.0:
		return INF
	if key[1]:
		c = 1.5 if b == WorldData.MOUNT else 0.55
	else:
		if season == 3:
			c *= 1.4
		elif season == 0 or season == 2:
			c *= 1.15
	var rv: int = key[2]
	if rv:
		c += 0.0 if key[3] else (1.0 if key[4] else 2.5 + (rv - 1) * 1.5)
	if cav and (b == WorldData.DFOREST or b == WorldData.MARSH):
		c *= 1.25
	return c


static func moveCost(j: int, season: int, cav: bool) -> float:
	prep()
	return ctab64[season * 2 + (1 if cav else 0)][cls[j]]


# ---------- скорость и цена шага ----------
static func isCav(a: Dictionary) -> bool:
	var m := Sim.armyMen(a)
	return m > 0 and Sim.mountedN(a.u) >= m * 0.9 and a.wagons == 0.0


static func armySpeed(a: Dictionary) -> float:
	var s := float(Sim.T.BASE_SPEED)
	var men := Sim.armyMen(a)
	if isCav(a):
		s *= 1.45
	if men > 1200:
		s *= 0.82
	elif men > 600:
		s *= 0.9
	if JS.t(a.forced):
		s *= 1.35
	if a.fat > 75:
		s *= 0.78
	elif a.fat > 50:
		s *= 0.9
	if a.hunger > 0:
		s *= 0.85
	if a.thirst > 0:
		s *= 0.8
	if a.kind == "caravan":
		s *= 0.8
	s /= float(Sim.weatherOf().mv)
	return s


## stepCost с обёрткой march.js (распутица)
static func stepCost(a: Dictionary, j: int) -> float:
	var W := Sim.W
	var G := Sim.G
	var c := moveCost(j, Sim.seasonOf(G.day), Sim.mountedN(a.u) > Sim.armyMen(a) * 0.5)
	if not (c < INF):
		return c
	if not W.road[j]:
		var men := maxf(1.0, Sim.armyMen(a))
		if JS.t(a.wagons):
			c *= 1 + minf(0.35, a.wagons / (men / 100.0 + 1) * 0.06)
		var p := W.prov[j]
		if p >= 0 and JS.n(G.provs[p].guides) > G.day and a.realm == G.player.realm:
			c *= 0.8
	var m := JS.n(G.get("mud"))
	if m < 0.05:
		return c
	if W.road[j]:
		return c * (1 + 0.12 * m)
	var men2 := maxf(1.0, Sim.armyMen(a))
	var wf := minf(0.5, a.wagons / (men2 / 100.0 + 1) * 0.15) if JS.t(a.wagons) else 0.0
	return c * (1 + (0.55 + wf) * m * float(MUDT.get(int(W.ter[j]), 1.0)))


# ---------- пути ----------
## planPath: A* по ценам costTable (Float32), обоз дороже вне дорог, проводники в своих провинциях. null — пути нет.
static func planPath(a: Dictionary, goal: int) -> Variant:
	var G := Sim.G
	var start := Sim.armyTile(a)
	if start == goal:
		return [float(start)]
	prep()
	var men := maxf(1.0, Sim.armyMen(a))
	var tab: PackedFloat32Array = ctab32[Sim.seasonOf(G.day) * 2 + (1 if Sim.mountedN(a.u) > men * 0.5 else 0)]
	var wf := 1 + minf(0.35, a.wagons / (men / 100.0 + 1) * 0.06) if JS.t(a.wagons) else 1.0
	var guide := PackedByteArray()
	if a.realm == G.player.realm:
		guide.resize(Sim.W.provs.size())
		for p in guide.size():
			guide[p] = 1 if JS.n(G.provs[p].guides) > G.day else 0
	var t0 := Time.get_ticks_usec()
	var p: Variant = astar(start, goal, tab, wf, guide, 600000)
	var us := Time.get_ticks_usec() - t0
	path_n += 1
	path_us += us
	path_max_us = maxi(path_max_us, us)
	path_nodes += alast
	return p


## astar (worldgen.js) с ценой cf из planPath; клетки разных частей суши не связаны — сразу null, как после обхода в HTML
static func astar(start: int, goal: int, tab: PackedFloat32Array, wf: float, guide: PackedByteArray, maxN: int) -> Variant:
	if start == goal:
		return [float(start)]
	var W := Sim.W
	alast = 0
	if comp[goal] < 0 or (comp[start] >= 0 and comp[start] != comp[goal]):
		return null
	if ag.size() != NT:
		ag.resize(NT)
		afrom.resize(NT)
		ast.resize(NT)
		acl.resize(NT)
		ast.fill(0)
		acl.fill(0)
		agen = 0
	agen += 1
	if agen > 2000000000:
		ast.fill(0)
		acl.fill(0)
		agen = 1
	var gen := agen
	var g := ag
	var from := afrom
	var st := ast
	var cl := acl
	var cc := cls
	var road := W.road
	var riv := W.river
	var prov := W.prov
	var gd := guide.size() > 0
	var gx := goal % MW
	var gy := goal / MW
	var hp := WorldGen.Heap.new()
	g[start] = 0.0
	st[start] = gen
	from[start] = -1
	hp.push(0.0, start)
	var n := 0
	while hp.size > 0:
		var i := hp.pop()
		if cl[i] == gen:
			continue
		cl[i] = gen
		if i == goal:
			break
		n += 1
		if n > maxN:
			alast = n
			return null
		var x := i % MW
		var y := i / MW
		var gi := g[i]
		for d in 8:
			var nx := x + DX8[d]
			var ny := y + DY8[d]
			if nx < 0 or ny < 0 or nx >= MW or ny >= MH:
				continue
			var j := ny * MW + nx
			if cl[j] == gen:
				continue
			var c: float = tab[cc[j]]
			if not (c < INF):
				continue
			if not road[j]:
				c = c * wf
				if gd:
					var p := prov[j]
					if p >= 0 and guide[p]:
						c *= 0.8
			if d >= 4:
				var ca := y * MW + nx
				var cb := ny * MW + x
				if not (tab[cc[ca]] < INF) or not (tab[cc[cb]] < INF):
					continue
				if (riv[ca] or riv[cb]) and not riv[j]:
					continue
				c *= 1.4142
			var ng := gi + c
			if st[j] != gen or ng < g[j]:
				g[j] = ng
				st[j] = gen
				from[j] = i
				var ddx := nx - gx
				var ddy := ny - gy
				hp.push(ng + sqrt(float(ddx * ddx + ddy * ddy)), j)
	alast = n
	if cl[goal] != gen:
		return null
	var rev := PackedInt32Array()
	var c2 := goal
	while c2 != -1:
		rev.append(c2)
		c2 = from[c2]
	var path := []
	path.resize(rev.size())
	for k in rev.size():
		path[k] = float(rev[rev.size() - 1 - k])
	return path


static func pathDays(a: Dictionary, path: Variant, from := 0) -> float:
	if path == null:
		return INF
	var c := 0.0
	for k in range(from, path.size() - 1):
		var f := int(path[k])
		var t := int(path[k + 1])
		var diag := f % MW != t % MW and f / MW != t / MW
		c += stepCost(a, t) * (1.414 if diag else 1.0)
	return c / armySpeed(a)


static func pathKm(path: Variant, from := 0) -> float:
	if path == null:
		return 0.0
	var c := 0.0
	for k in range(from, path.size() - 1):
		var f := int(path[k])
		var t := int(path[k + 1])
		c += 1.414 if (f % MW != t % MW and f / MW != t / MW) else 1.0
	return c * float(Sim.T.KM_PER_TILE)


static func setPath(a: Dictionary, path: Variant) -> void:
	a.path = path
	a.pi = 0.0
	if path != null and path.size() > 1:
		if a.mode != "march":
			a.mode = "march"
		a.camp = 0.0
		a.fortDays = 0.0
		if a.siegeOf >= 0:
			SimDay.endSiege(a)


# ---------- движение ----------
## advanceArmy с обёрткой march.js: переправы через реки без моста на пройденных клетках
static func advanceArmy(a: Dictionary, dd: float) -> void:
	var path: Variant = a.path
	if path == null or a.pi >= path.size() - 1:
		return
	var p0 := int(a.pi)
	_advance(a, dd)
	if not JS.t(a.alive) or int(a.pi) <= p0:
		return
	var W := Sim.W
	for q in range(p0 + 1, mini(int(a.pi), path.size() - 1) + 1):
		var j := int(path[q])
		var pj := int(path[q - 1])
		if W.river[j] and not W.bridge[j] and not (W.river[pj] and not W.bridge[pj]):
			riverCross(a, j)


static func _advance(a: Dictionary, dd: float) -> void:
	var path: Array = a.path
	var budget := dd * armySpeed(a)
	var moved := 0.0
	var n := path.size()
	while budget > 1e-6 and a.pi < n - 1:
		var to := int(path[int(a.pi) + 1])
		var tx := to % MW + 0.5
		var ty := to / MW + 0.5
		var c := stepCost(a, to)
		if not (c < INF):
			a.path = null
			if isKingArmy(a):
				SimDay.alerts.append({"k": "pause", "t": "Путь прегражден — войско остановилось"})
			return
		var d := JS.hypot(tx - a.x, ty - a.y)
		var can := budget / c
		if can >= d:
			a.x = tx
			a.y = ty
			budget -= d * c
			a.pi += 1.0
			moved += d
		else:
			a.x += (tx - a.x) / d * can
			a.y += (ty - a.y) / d * can
			moved += can
			budget = 0.0
	a.moved = JS.n(a.get("moved")) + moved
	if a.pi >= n - 1:
		a.path = null
		var f: Variant = a.get("onArrive")
		a.onArrive = null
		if isKingArmy(a) and Sim.G.player.follow < 0:
			SimDay.alerts.append({"k": "pause", "t": "" if JS.t(f) else "Войско прибыло"})
		if JS.t(f):
			runArrive(a, f)


static func isKingArmy(a: Dictionary) -> bool:
	return a.id == Sim.G.player.army and a.kind == "player"


## приказы по прибытии ({k, s}): осада (ИИ), набег разбойников; к поселению — у войска короля (экран поселения — позже)
static func runArrive(a: Dictionary, f: Dictionary) -> void:
	match String(f.k):
		"siege":
			var r: float = f.r if f.has("r") else a.realm
			var c: float = Sim.G.setts[int(f.s)].ctrl
			if c != r and (Sim.hostile(r, c) or c == 5.0):
				SimAI.aiArriveSett(a, int(f.s))
		"loot":
			SimAI.banditLoot(a, Sim.G.setts[int(f.s)])
		"sett":
			SimDay.alerts.append({"k": "sett", "s": f.s})


static func riverCross(a: Dictionary, j: int) -> void:
	var G := Sim.G
	var W := Sim.W
	var s := Sim.seasonOf(G.day)
	var k: String = G.weather.k
	var ford := W.ford[j] != 0
	var big := float(W.river[j]) if W.river[j] else 1.0
	var isP: bool = a.realm == G.player.realm and a.kind == "player"
	var men := Sim.armyMen(a)
	if s == 3 and fmod(fmod(G.day, Sim.DAYS_YEAR), Sim.DAYS_SEASON) > 4:
		if Sim.R.chance(0.04 * big):
			var n0 := SimDay.takeMen(a, maxf(1.0, JS.rnd(men * 0.004 * Sim.R.range(0.5, 1.5))))
			if isP and n0 > 0:
				Sim.glog("Лёд проломился на переправе: " + JS.s(n0) + " " + Sim.plural(n0, "воин ушёл", "воина ушли", "воинов ушли") + " под воду.", "bad")
		return
	var risk := (0.25 if ford else 0.6 + 0.3 * (big - 1)) * (1.6 if s == 0 else 1.0) * (1 + JS.n(G.get("mud")) * 0.8) * (1.3 if k == "rain" or k == "storm" else 1.0)
	var drown := JS.rnd(men * 0.004 * risk * Sim.R.range(0.2, 1.6))
	var food := JS.rnd(JS.n(a.food) * 0.022 * risk)
	var arr := JS.rnd(JS.n(a.arrows) * 0.04 * risk)
	var hr := JS.rnd(JS.n(a.horses) * 0.02 * risk)
	var n := SimDay.takeMen(a, drown) if drown >= 1 else 0.0
	a.food = maxf(0.0, JS.n(a.food) - food)
	a.arrows = maxf(0.0, JS.n(a.arrows) - arr)
	a.horses = maxf(0.0, JS.n(a.horses) - hr)
	if not isP or not (n > 0 or food >= 20 or arr >= 20):
		return
	var P := []
	if n > 0:
		P.append("утонули " + JS.s(n))
	if food >= 20:
		P.append("подмочен провиант −" + JS.s(food))
	if arr >= 20:
		P.append("стрелы −" + JS.s(arr))
	if hr > 0:
		P.append("кони −" + JS.s(hr))
	Sim.glog(("Переправа вброд" if ford else "Переправа вплавь") + (" в половодье" if s == 0 else "") + ": " + ", ".join(P) + ".", "bad" if n > 0 else "info")


# ---------- осады ----------
## startSiege с обёрткой deceit.js: осаждающий разглядел чучела на стенах
static func startSiege(a: Dictionary, sid: int) -> bool:
	var G := Sim.G
	var S: Dictionary = G.setts[sid]
	if JS.n(S.get("dummy")) > G.day and a.realm >= 1 and a.realm < 5 and not (JS.t(S.get("dumK")) and JS.t(S.dumK.get(JS.s(a.realm)))):
		if not JS.t(S.get("dumK")):
			S.dumK = {}
		JS.oset(S.dumK, JS.s(a.realm), 1.0)
		SimAI.dlog(armyLabel(a) + " осадил " + Sim.W.setts[sid].name + " и разглядел чучела на стенах.", "bad")
	if JS.t(S.siege):
		return false
	S.siege = {"by": a.id, "realm": a.realm, "d0": G.day, "works": 0.0, "need": S.walls * 30 + 10, "asked": -99.0}
	a.mode = "siege"
	a.siegeOf = float(sid)
	a.path = null
	a.stay = 0.0
	return true


static func woodNear(t: int) -> int:
	var W := Sim.W
	var x := t % MW
	var y := t / MW
	var n := 0
	for dy in range(-4, 5):
		for dx in range(-4, 5):
			if not SimDay.inMap(x + dx, y + dy):
				continue
			var T: int = W.ter[(y + dy) * MW + x + dx]
			if T == WorldData.FOREST or T == WorldData.DFOREST:
				n += 1
	return n


static func siegeDaily(a: Dictionary) -> void:
	var G := Sim.G
	var si := int(a.siegeOf)
	var S: Variant = G.setts[si] if si >= 0 and si < G.setts.size() else null
	if S == null or not JS.t(S.siege) or S.siege.by != a.id:
		a.mode = "march"
		a.siegeOf = -1.0
		return
	var sg: Dictionary = S.siege
	var ws: Dictionary = Sim.W.setts[si]
	if S.ctrl == a.realm or not (Sim.hostile(a.realm, S.ctrl) or S.ctrl == 5.0):
		SimDay.endSiege(a)
		return
	var gen: Variant = Sim.charOf(a.gen)
	var wood := woodNear(int(ws.i))
	var rate := (12.0 if wood > 6 else (8.0 if wood > 0 else 4.0)) * minf(1.2, Sim.armyMen(a) / 150.0) * (1.3 if gen != null and gen.traits.has("patient") else 1.0) \
		* (1.4 if a.realm == 0.0 and SimDyn.hasTech("engines") else 1.0) * (1.6 if a.realm == 0.0 and SimDyn.hasTech("bombards") else 1.0)
	sg.works = minf(sg.need, sg.works + rate)
	if not granSiegeFeed(S):
		S.food -= 1.0
	if S.food <= 0:
		S.food = 0.0
		sg.starve = JS.n(sg.get("starve")) + 1
		takeU(S.gar, ceilf(Sim.menOf(S.gar) * 0.04))
	if a.kind != "player":
		SimAI.aiSiegeDecision(a, S)
	if Sim.menOf(S.gar) <= 0:
		captureSett(a, S, "гарнизон истаял")


## granSiegeFeed (granary.js): осаждённая столица короля ест из королевских амбаров
static func granSiegeFeed(S: Dictionary) -> bool:
	var G := Sim.G
	var C: Variant = G.get("court")
	if not JS.t(C) or S.id != G.realms[0].capital or S.ctrl != 0.0:
		return false
	var n := ceilf(Sim.menOf(S.gar) * SimDay.eatK())
	if n == 0.0 or JS.n(C.get("grain")) < n:
		return false
	C.grain -= n
	var o := granS()
	if G.day - o.sieD > 10:
		o.sieD = G.day
		var dd := floorf(C.grain / n)
		Sim.glog("Столица в осаде: гарнизон ест из королевских амбаров — " + JS.s(n) + " " + Sim.plural(n, "мера", "меры", "мер") + " в день, зерна хватит на " \
			+ JS.s(dd) + " " + Sim.plural(dd, "день", "дня", "дней") + ".", "info")
	return true


## granS (granary.js): амбары двора; в старых сохранениях их нет — заводятся при первом обращении
static func granS() -> Dictionary:
	var C: Dictionary = Sim.G.court
	if not JS.t(C.get("gran")):
		C.gran = {"res": 2000.0, "carts": 8.0, "q": 1.0, "qy": -1.0, "seen": 0.0, "famY": -9.0, "relY": -9.0, "buyD": -9.0, "sieD": -9.0, "reap": 0.0, "thr": 0.0}
		C.grain = maxf(JS.n(C.get("grain")), 6000.0)
	return C.gran


static func takeU(u: Dictionary, n: float) -> float:
	var men := Sim.menOf(u)
	if men <= 0:
		return 0.0
	n = minf(n, men)
	for t in Sim.UT:
		u[t] = maxf(0.0, u[t] - JS.rnd(n * u[t] / men))
	return n


static func surrenderChance(a: Dictionary, S: Dictionary) -> float:
	var G := Sim.G
	var ratio := SimDay.powerU(a.u, a.xp) / maxf(1.0, SimDay.powerU(S.gar, null) * (1 + S.walls * 0.5))
	var c := 0.03 + JS.clp((ratio - 1) * 0.07, -0.05, 0.35)
	if S.food <= 0:
		c += 0.4
	elif S.food < 5:
		c += 0.15
	if JS.t(S.siege):
		c += minf(0.15, (G.day - S.siege.d0) * 0.006)
	var lord: Variant = Sim.charOf(S.lord) if S.lord >= 0 else Sim.charOf(G.realms[int(S.owner)].ruler if int(S.owner) < G.realms.size() else -1.0)
	if lord != null and lord.traits.has("proud"):
		c -= 0.12
	if lord != null and lord.traits.has("craven"):
		c += 0.1
	if a.realm == G.player.realm:
		c += JS.n(G.realms[int(a.realm)].get("fear")) * 0.002
	if Sim.W.setts[int(S.id)].type == "capital":
		c -= 0.15
	return JS.clp(c, 0.01, 0.95)


## captureSett с обёрткой reign.js (летопись) и onCapture (events.js)
static func captureSett(a: Dictionary, S: Dictionary, how := "") -> void:
	var G := Sim.G
	var W := Sim.W
	var prev: float = S.ctrl
	var own: float = S.owner
	var ws: Dictionary = W.setts[int(S.id)]
	if JS.t(S.siege):
		S.siege = null
	if a.siegeOf == S.id:
		a.siegeOf = -1.0
		a.mode = "march"
	S.ctrl = a.realm
	S.gar = Sim.emptyU()
	S.occDay = G.day
	S.food = maxf(S.food, 5.0)
	var det := minf(JS.rnd(Sim.armyMen(a) * 0.06), 30.0)
	var k := minf(det, a.u.levy + a.u.spear)
	var fromL := minf(a.u.levy, k)
	a.u.levy -= fromL
	S.gar.levy += fromL
	var fromS := minf(a.u.spear, k - fromL)
	a.u.spear -= fromS
	S.gar.spear += fromS
	if a.realm == G.player.realm:
		Sim.glog("Взят " + ws.name + (" (" + how + ")" if how != "" else "") + "!", "good")
		G.stats.sieges += 1.0
	elif prev == G.player.realm:
		Sim.glog(Sim.REALM_DEF[int(a.realm)].name + " " + SimDay.rV(int(a.realm), "захватила", "захватило", "захватили") + " " + ws.name + "!", "bad")
	onCapture(a, S, prev)
	Sim.pol_dirty = 1
	# летопись (reign.js)
	var p: float = G.player.realm
	var T0: Array = STYPE.get(ws.type, STYPE.castle)
	var st: Dictionary = RST()
	if a.realm == p and prev != p:
		if ws.type == "village":
			st.vil += 1.0
		else:
			st.took += 1.0
			chron(T0[1] + " " + ws.name + (" (" + Sim.realmName(own) + ")" if own != p and own >= 0 and own < 5 else "") + ".", "castle", "took", 3.0 if ws.type == "capital" else 2.0)
	elif prev == p and a.realm != p and ws.type != "village":
		st.fell += 1.0
		chron(T0[2] + " " + ws.name + " — взял" + ("и: " + Sim.realmName(a.realm) if a.realm >= 0 and a.realm < 5 else "и враги") + ".", "flag", "fell", 3.0 if ws.type == "capital" else 2.0)


static func onCapture(a: Dictionary, S: Dictionary, prev: float) -> void:
	var G := Sim.G
	var W := Sim.W
	var ws: Dictionary = W.setts[int(S.id)]
	if ws.type != "village":
		for v in W.provs[int(ws.prov)].villages:
			var V: Dictionary = G.setts[int(v)]
			if V.ctrl == prev and not JS.t(V.siege):
				V.ctrl = a.realm
				if V.owner >= 5 and a.realm < 5:
					V.owner = a.realm
	if S.owner >= 5 and a.realm < 5:
		S.owner = a.realm
		if S.lord >= 0 and Sim.charOf(S.lord) != null and Sim.charOf(S.lord).realm == 5.0:
			S.lord = -1.0
	if a.realm == G.player.realm:
		var R0: Dictionary = G.realms[int(a.realm)]
		R0.prestige = JS.n(R0.get("prestige")) + (25.0 if ws.type == "capital" else (1.0 if ws.type == "village" else 6.0))
		if ws.type != "village":
			SimDay.alerts.append({"k": "captured", "s": S.id})
	if a.realm < 5 and prev < 5 and prev != a.realm:
		var rl: Dictionary = G.rel[int(a.realm)][int(prev)]
		rl.bs = JS.n(rl.get("bs")) + (1.0 if ws.type == "village" else 3.0)
	Sim.pol_dirty = 1


static func retreatArmy(a: Dictionary, from: Variant) -> void:
	if a.siegeOf >= 0:
		SimDay.endSiege(a)
	var dx: float = a.x - from.x if from != null else 1.0
	var dy: float = a.y - from.y if from != null else 0.0
	var d := JS.hypot(dx, dy)
	if not JS.t(d):
		d = 1.0
	dx /= d
	dy /= d
	for k in range(4, 0, -1):
		var x := int(floorf(a.x + dx * k * 1.5))
		var y := int(floorf(a.y + dy * k * 1.5))
		if SimDay.inMap(x, y) and float(Sim.TINFO[Sim.W.ter[y * MW + x]].cost) > 0:
			a.x = x + 0.5
			a.y = y + 0.5
			break
	a.path = null
	if JS.t(a.get("ai")):
		a.ai.task = "idle"
		a.ai.t = 2.0


# ---------- бой «на счётах» (до среза 0.7; в HTML-эталоне — pageQuick) ----------
static func _qpow(s: Dictionary) -> float:
	return SimDay.powerU(s.u, s.xp) * (0.55 + s.morale / 200.0) * (1 - minf(60.0, s.fat) / 300.0) * s.wall


static func _qside(a: Dictionary) -> Dictionary:
	var G := Sim.G
	return {"army": a.id, "u": Sim.assign(Sim.emptyU(), a.u), "xp": a.xp, "morale": a.morale, "fat": a.fat, "wall": 1.0, "realm": a.realm, "name": armyLabel(a), "king": a.kind == "player" and a.gen == G.player.char}


static func _qgar(S: Dictionary, assault: bool) -> Dictionary:
	var wall := 1.0
	if assault and S.walls > 0:
		wall = 1 + S.walls * 0.5 * (1 - 0.6 * (minf(1.0, S.siege.works / maxf(1.0, S.siege.need)) if JS.t(S.siege) else 1.0))
	return {"sett": S.id, "u": Sim.assign(Sim.emptyU(), S.gar), "xp": GXP, "morale": 65.0 if S.food > 0 else 35.0, "fat": 0.0, "realm": S.ctrl, "name": "гарнизон " + Sim.W.setts[int(S.id)].name, "king": false, "wall": wall}


static func autoBattle(a: Dictionary, b: Dictionary) -> Dictionary:
	var res := quickRun([_qside(a), _qside(b)], Sim.armyTile(a))
	res.winA = res.win == 0
	return res


static func autoBattleGarrison(a: Dictionary, S: Dictionary, assault := false) -> Dictionary:
	var res := quickRun([_qside(a), _qgar(S, assault)], int(Sim.W.setts[int(S.id)].i))
	res.win = res.win == 0
	return res


static func quickRun(sides: Array, tile: int) -> Dictionary:
	var G := Sim.G
	var pa := _qpow(sides[0]) * (0.85 + Sim.R.f() * 0.3)
	var pb := _qpow(sides[1]) * (0.85 + Sim.R.f() * 0.3)
	var win := 0 if pa >= pb else 1
	var r := minf(pa, pb) / maxf(1e-9, maxf(pa, pb))
	var kw := 0.26 * r
	var kl := 0.3 + 0.5 * (1 - r) * (1 - r)
	var res := {"win": win, "sides": []}
	for si in 2:
		var s: Dictionary = sides[si]
		var winner := si == win
		var a: Variant = Sim.armyById(s.army) if s.has("army") else null
		var u: Dictionary = a.u if a != null else G.setts[int(s.sett)].gar
		var m0 := Sim.menOf(u)
		takeU(u, JS.rnd(m0 * (kw if winner else kl)))
		var lost := m0 - Sim.menOf(u)
		var o := {"lost": lost, "killed": 0.0, "wounded": JS.rnd(lost * (0.42 if winner else 0.25)), "prisoners": 0.0}
		o.killed = lost - o.wounded
		if a != null:
			a.wounded += o.wounded
			a.arrows = maxf(0.0, a.arrows - Sim.rangedN(s.u) * 6)
			a.morale = JS.clp(a.morale + (8.0 if winner else -18.0), 0, 100)
			a.vict = 12.0 if winner else -15.0
			a.fat = JS.clp(a.fat + 15, 0, 100)
			for t in Sim.UT:
				a.xp[t] = minf(100.0, JS.n(a.xp.get(t)) + (6.0 if winner else 3.0))
			a.lastFight = G.day
		res.sides.append(o)
	var W0: Dictionary = sides[win]
	var L0: Dictionary = sides[1 - win]
	var wa: Variant = Sim.armyById(W0.army) if W0.has("army") else null
	var la: Variant = Sim.armyById(L0.army) if L0.has("army") else null
	var lostL: float = res.sides[1 - win].lost
	if wa != null:
		var loot := {"food": 0.0, "arrows": 0.0, "weap": JS.rnd(lostL * 0.3), "horses": 0.0, "gold": 0.0, "prisoners": JS.rnd(lostL * 0.18)}
		if la != null:
			loot.food = JS.rnd(la.food * 0.4)
			loot.arrows = JS.rnd(la.arrows * 0.3)
			loot.horses = JS.rnd(la.horses * 0.5 + lostL * (Sim.mountedN(la.u) / maxf(1.0, Sim.armyMen(la) + lostL)) * 0.3)
			loot.gold = JS.rnd(JS.n(la.get("goods")) * 0.8 + JS.n(la.get("loot")) + (10.0 if la.kind == "lord" else 0.0) + (SimAI.caravanLoot(la) if la.kind == "caravan" else 0.0))
			la.food -= loot.food
			la.arrows -= loot.arrows
			la.horses = maxf(0.0, la.horses - JS.rnd(la.horses * 0.5))
			la.goods = 0.0
			la.loot = 0.0
		loot.food = minf(loot.food, maxf(0.0, Sim.armyCap(wa) - SimDay.armyLoad(wa)))
		wa.food += loot.food
		wa.arrows += loot.arrows
		wa.weap += loot.weap
		wa.horses += loot.horses
		wa.prisoners = JS.n(wa.get("prisoners")) + loot.prisoners
		if wa.realm < 5:
			G.realms[int(wa.realm)].gold += loot.gold
		res.loot = loot
	if la != null:
		var m := Sim.armyMen(la)
		if m < 15 or (lostL > m * 2.5 and la.kind != "player"):
			SimDay.destroyArmy(la, "разбито")
		else:
			retreatArmy(la, wa)
	if wa != null and Sim.armyMen(wa) <= 0:
		SimDay.destroyArmy(wa, "погибло")
	var ra: float = W0.realm
	var rb: float = L0.realm
	var p: float = G.player.realm
	if ra < 5 and rb < 5 and ra != rb:
		var v := JS.clp(lostL / 25.0, 2, 20)
		var r1: Dictionary = G.rel[int(ra)][int(rb)]
		var r2: Dictionary = G.rel[int(rb)][int(ra)]
		r1.bs = JS.n(r1.get("bs")) + v
		r2.bs = JS.n(r2.get("bs")) - v
	if ra == p or rb == p:
		G.stats.battles += 1.0
		if ra == p:
			G.stats.won += 1.0
		var PR: Dictionary = G.realms[int(p)]
		PR.fear = JS.n(PR.get("fear")) + (3.0 if ra == p else -2.0)
		var pw := ra == p
		var mine: Dictionary = W0 if pw else L0
		var foe: Dictionary = L0 if pw else W0
		if W0.has("sett") or L0.has("sett"):
			Sim.glog(mine.name + (" отбился от: " if pw else " не устоял: ") + foe.name, "good" if pw else "bad")
		else:
			Sim.glog(("Победа над: " if pw else "Поражение от: ") + foe.name + " · наши потери " + JS.s(res.sides[win if pw else 1 - win].lost) + ", вражеские " + JS.s(res.sides[1 - win if pw else win].lost), "good" if pw else "bad")
		var s0 := 0 if sides[0].realm == p else 1
		if sides[1 - s0].realm != p:
			var S: Dictionary = sides[s0]
			var E: Dictionary = sides[1 - s0]
			var won := win == s0
			var m0 := Sim.menOf(S.u)
			var m1 := Sim.menOf(E.u)
			var st := RST()
			if won:
				st.won += 1.0
			else:
				st.lost += 1.0
			if m0 + m1 >= 60 or S.king:
				chron(("Победа" if won else "Поражение") + " близ " + placeName(placeNear(tile)) + ": " + (Sim.realmName(E.realm) if E.realm < 5 else String(E.name)) + " (" + fmt(m0) + " против " + fmt(m1) + ")" + (" — король сам вёл войско." if S.king else "."),
					"sword" if won else "flag", "won" if won else "lost", 3.0 if S.king or m0 + m1 >= 600 else 2.0)
	return res


# ---------- встречи войск ИИ и шаг движения ----------
## aiContacts (ai.js): враждебные войска ИИ в пределах клетки бьются (не чаще раза в два дня)
static func aiContacts() -> void:
	var G := Sim.G
	var L := []
	for a in G.armies:
		if JS.t(a.alive) and a.kind != "player":
			L.append(a)
	var n := L.size()
	var xs := PackedFloat64Array()
	var ys := PackedFloat64Array()
	xs.resize(n)
	ys.resize(n)
	for i in n:
		xs[i] = L[i].x
		ys[i] = L[i].y
	for i in n:
		for j in range(i + 1, n):
			# сначала дешёвое: далеко ли (координаты меняются только после боя — тогда берутся заново)
			if absf(xs[i] - xs[j]) > 1 or absf(ys[i] - ys[j]) > 1:
				continue
			var a: Dictionary = L[i]
			var b: Dictionary = L[j]
			if not JS.t(a.alive) or not JS.t(b.alive) or not Sim.hostile(a.realm, b.realm):
				continue
			if absf(a.x - b.x) > 1 or absf(a.y - b.y) > 1:
				continue
			if a.kind == "caravan" and b.kind == "caravan":
				continue
			if G.day - maxf(a.lastFight, b.lastFight) < 2:
				continue
			var res := autoBattle(a, b)
			a.lastFight = G.day
			b.lastFight = G.day
			if G.has("court") and (a.realm == 0.0 or b.realm == 0.0):
				SimAI.cmdBattle(a, b, res)
			if a.realm == G.player.realm or b.realm == G.player.realm or G.vis[Sim.armyTile(a)] == 2:
				Sim.glog("Битва: " + armyLabel(a) + " и " + armyLabel(b) + " — победа: " + armyLabel(a if res.winA else b) + ".", "info")
			for q in n:
				xs[q] = L[q].x
				ys[q] = L[q].y


## шаг движения: worldAdvance без короля в поле (его погоня, встречи, гонцы и снабженец — когда он сам поведёт войско)
static func substep(dd: float) -> void:
	var t0 := Time.get_ticks_usec()
	for a in Sim.G.armies:
		if JS.t(a.alive):
			advanceArmy(a, dd)
	aiContacts()
	step_us = Time.get_ticks_usec() - t0


# ---------- летопись царствования (reign.js) ----------
static func reignInit() -> Variant:
	var G := Sim.G
	if not G.has("court") or not JS.t(G.court):
		return null
	if JS.t(G.get("reign")):
		return G.reign
	var k: Dictionary = Sim.charOf(G.player.char)
	var first := not (JS.t(G.get("reigns")) and G.reigns.size() > 0)
	if not JS.t(G.get("reigns")):
		G.reigns = []
	G.reign = {"n": float(G.reigns.size() + 1), "king": k.id, "from": 0.0 if first else G.day, "age0": k.age, "era0": float(eraNow()), "lands0": float(landsN()), "chron": [], "goal": null,
		"st": {"wars": 0.0, "peace": 0.0, "won": 0.0, "lost": 0.0, "took": 0.0, "fell": 0.0, "vil": 0.0, "techs": 0.0, "kids": 0.0, "hunts": 0.0, "tours": 0.0, "feasts": 0.0, "hurt": 0.0}}
	var cap: Variant = Sim.W.setts[int(G.realms[0].capital)] if G.realms[0].capital >= 0 else null
	var title := "Королева" if JS.t(k.get("fem")) else "Король"
	chron(("Год 1. " if first else "Глава " + ROMAN[int(G.reign.n) - 1] + ". ") + title + " " + k.name + " (" + JS.s(k.age) + " " + Sim.plural(k.age, "год", "года", "лет") + ") " + ("правит из столицы " + (String(cap.name) if cap != null else "") if first else "взошёл на трон") + ".", "crown", "start", 3.0)
	return G.reign


static func RST() -> Dictionary:
	var r: Variant = reignInit()
	return r.st if r != null else {"st": {}}


static func chron(t: String, ic: String, k: String, imp: float) -> void:
	var R0: Variant = reignInit()
	if R0 == null:
		return
	R0.chron.append({"d": Sim.G.day, "t": t, "ic": ic if ic != "" else "scroll", "k": k, "imp": imp if imp != 0 else 1.0})
	if R0.chron.size() > 240:
		R0.chron.remove_at(1)


static func eraNow() -> int:
	var y := floori(Sim.G.day / Sim.DAYS_YEAR) + 1
	var e := 0
	for i in ERA_Y.size():
		if y >= ERA_Y[i]:
			e = i
	return e


static func landsN() -> int:
	var n := 0
	for S in Sim.G.setts:
		if S.owner == 0.0 and Sim.W.setts[int(S.id)].type != "village":
			n += 1
	return n


static func placeNear(tile: int) -> Variant:
	var x := tile % MW
	var y := tile / MW
	var b: Variant = null
	var bd := 1e9
	for s in Sim.W.setts:
		var dx: float = s.x - x
		var dy: float = s.y - y
		var d := dx * dx + dy * dy
		if d < bd:
			bd = d
			b = s
	return b


static func placeName(s: Variant) -> String:
	if s == null:
		return ""
	return ("деревни " if s.type == "village" else ("города " if s.type == "town" else "замка ")) + s.name


# ---------- слова (engine.js, state.js, ai.js — для летописи и донесений; SimText — для экрана) ----------
static func fmt(n: float) -> String:
	n = JS.rnd(n)
	if absf(n) >= 10000.0:
		var k := n / 1000.0
		return JS.s(signf(k) * floorf(absf(k) + 0.5)) + "к"
	return JS.s(n)


static func voin(n: float) -> String:
	n = JS.rnd(n)
	return JS.s(n) + " " + Sim.plural(n, "воин", "воина", "воинов")


static func armyLabel(a: Dictionary) -> String:
	var g: Variant = Sim.charOf(a.gen)
	if a.kind == "bandit":
		return "шайка " + (String(g.name) if g != null else "")
	if a.kind == "caravan":
		return "караван"
	if a.kind == "player":
		return "войско короля"
	return (String(g.name) if g != null else "войско") + " (" + Sim.realmName(a.realm) + ")"
