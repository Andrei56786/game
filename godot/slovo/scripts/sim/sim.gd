class_name Sim
## Симуляция королевства — перенос state.js HTML-версии: новая игра (державы, люди, поселения, войска, разбойники,
## караваны, разведанные земли), войска и отряды, летопись, война и мир. Состояние G — словарь того же вида, что G в JS
## (те же ключи в том же порядке, все числа — float), чтобы сверять с HTML без перевода (tools/state_check.gd).
## Мир — Sim.W (WorldData, как WD), общий генератор — Sim.R (как R), таблицы — из HTML (art/sim_tables.bin).
## Экономика — SimEcon (econ.js), двор и дома — SimDyn (dynasty.js), обзор и знаки — SimIntel (intel.js).

const MW := WorldData.MW
const MH := WorldData.MH
const NT := WorldData.NT
const LAKE := WorldData.LAKE

static var T: Dictionary = {}
static var UT: Array = []
static var UNIT: Dictionary
static var CUL_UNIT: Array
static var TRAITS: Dictionary
static var TRAIT_K: Array
static var NAMES: Dictionary
static var RULERS: Array
static var REALM_DEF: Array
static var HOUSES: Array
static var SEATS: Array
static var WTAB: Array
static var WEATHER: Dictionary
static var GOODS: Array
static var GD: Dictionary
static var RAW_G: Array
static var RAW: Dictionary
static var SEASON_F: Dictionary
static var NEED: Dictionary
static var FAVG: Dictionary
static var RECIPE: Dictionary
static var BIGK: Dictionary
static var RESERVE: Dictionary
static var ECONK: Dictionary
static var GA := 0.1
static var ST_KEYS: Array
static var POOL_K: Dictionary
static var TINFO: Array
static var SEAT_K := 1.0
static var FEMRX: RegEx
static var MALERX: RegEx
const POOL_BASE := {"village": 30.0, "castle": 60.0, "town": 90.0, "capital": 140.0}
const DAYS_SEASON := 21.0
const DAYS_YEAR := 84.0

static var G: Dictionary = {}
static var W: WorldData
static var R := JS.Rng.new(0)
static var ECON: Dictionary = {"inc": null, "incDay": -1.0, "ms": 0.0}
static var SIGNS: Array = []
static var fog_dirty := 1
static var pol_dirty := 0            # MAPDIRTY.pol: владельцы провинций сменились — перекрасить карту
static var feed: Array = []          # UI.onLog: свежие записи летописи для экрана
static var wat := PackedByteArray()  # WD._wat: вода ли клетка
static var wat_w: WorldData = null
static var rw_ne := -1               # revealWater: сколько клеток было разведано при прошлом вызове
static var rw_g: Dictionary = {}
static var ms := {}                  # время частей новой игры, мс
static var s_at := PackedInt32Array() # WD._sAt: поселение в клетке (−1 — нет)
static var s_at_w: WorldData = null
static var pr_cache: Array = []      # poolRatesC: [владелец, народ, ставки] по номеру поселения
static var pr_g: Dictionary = {}


## Таблицы игры из HTML (tools/sim_export.mjs): войска, черты, имена, державы, дома, места совета, товары, погода…
static func load_tables(path := "res://art/sim_tables.bin") -> bool:
	if not T.is_empty():
		return true
	if not FileAccess.file_exists(path):
		push_error("SIM: нет таблиц " + path)
		return false
	var v: Variant = bytes_to_var(FileAccess.get_file_as_bytes(path))
	if typeof(v) != TYPE_DICTIONARY:
		return false
	T = v
	UT = T.UT
	UNIT = T.UNIT
	CUL_UNIT = T.CUL_UNIT
	TRAITS = T.TRAITS
	TRAIT_K = TRAITS.keys()
	NAMES = T.NAMES
	RULERS = T.RULERS
	REALM_DEF = T.REALM_DEF
	HOUSES = T.HOUSES
	SEATS = T.SEATS
	WTAB = T.WTAB
	WEATHER = T.WEATHER
	GOODS = T.GOODS
	GD = T.GD
	RAW_G = T.RAW_G
	RAW = T.RAW
	SEASON_F = T.SEASON_F
	NEED = T.NEED
	FAVG = T.FAVG
	RECIPE = T.RECIPE
	BIGK = T.BIGK
	RESERVE = T.RESERVE
	ECONK = T.ECONK
	GA = T.GA
	ST_KEYS = T.ST_KEYS
	POOL_K = T.POOL_K
	TINFO = T.TINFO
	SEAT_K = T.SEAT_K
	FEMRX = RegEx.create_from_string(T.FEMRX)
	MALERX = RegEx.create_from_string("^(Лука|Добрыня|Илья|Никита|Фома)$")
	return true


## Новая игра для экрана карты: мир уже загружен (WorldData); состояние — как newGame3 в HTML (двор и королевство),
## затем обзор и знаки, как при первом открытии карты.
static func start(w: WorldData, seed: int, opt: Dictionary = {"diff": 1.0, "tut": false, "mapOpen": false}) -> void:
	W = w
	SimDyn.newGame3(seed, opt)
	SimIntel.computeVision()
	SimIntel.updateSigns()


## казна по книгам казначея (bookGold): золото державы и спрятанное при дворе
static func bookGold() -> float:
	var C: Variant = G.get("court")
	return float(G.realms[0].gold) + (JS.n(C.get("hidden")) if C != null else 0.0)


## поселение в клетке (settAtTile), −1 — нет
static func settAtTile(t: int) -> int:
	if s_at_w != W:
		s_at_w = W
		s_at = PackedInt32Array()
		s_at.resize(NT)
		s_at.fill(-1)
		for s: Dictionary in W.setts:
			s_at[int(s.y) * MW + int(s.x)] = int(s.id)
	return s_at[t] if t >= 0 and t < NT else -1


# ---------- войско: состав ----------
static func emptyU() -> Dictionary:
	return {"levy": 0.0, "spear": 0.0, "sword": 0.0, "archer": 0.0, "xbow": 0.0, "horse": 0.0, "harch": 0.0, "knight": 0.0}

## Object.assign(a, b)
static func assign(a: Dictionary, b: Dictionary) -> Dictionary:
	for k in b:
		a[k] = b[k]
	return a

static func scaleU(u: Dictionary, k: float) -> Dictionary:
	var o := {}
	for t in UT:
		o[t] = JS.n(u.get(t)) * k
	return o

static func roundU(u: Dictionary) -> Dictionary:
	for t in UT:
		u[t] = maxf(0.0, JS.rnd(JS.n(u.get(t))))
	return u

static func upkeepU(u: Dictionary) -> float:
	var s := 0.0
	for t in UT:
		s += JS.n(u.get(t)) * float(UNIT[t].upk)
	return s

## Σ (u[t] || 0) по видам войск, с округлением; JS.n — на месте (вызовов тысячи за день)
static func menOf(u: Dictionary) -> float:
	var s := 0.0
	for t in UT:
		var v: Variant = u.get(t, 0.0)
		if v is float:
			s += v if v == v else 0.0
		else:
			s += JS.n(v)
	return JS.rnd(s)

static func mountedN(u: Dictionary) -> float:
	var a: Variant = u.get("horse", 0.0)
	var b: Variant = u.get("harch", 0.0)
	var c: Variant = u.get("knight", 0.0)
	if a is float and b is float and c is float:
		return (a if a == a else 0.0) + (b if b == b else 0.0) + (c if c == c else 0.0)
	return JS.n(a) + JS.n(b) + JS.n(c)

static func rangedN(u: Dictionary) -> float:
	return JS.n(u.get("archer")) + JS.n(u.get("xbow")) + JS.n(u.get("harch"))

static func seasonOf(d: float) -> int:
	return int(floorf(fmod(d, DAYS_YEAR) / DAYS_SEASON))

# ---------- люди ----------
static func charOf(id: Variant) -> Variant:
	if id == null:
		return null
	var k := int(id)
	return G.chars[k] if k >= 0 and k < G.chars.size() else null

static func ownerOfProv(p: int) -> float:
	return G.setts[W.provs[p].seat].owner

static func realmName(r: Variant) -> String:
	return String(REALM_DEF[clampi(int(r), 0, REALM_DEF.size() - 1)].name)

## plural (engine.js): форма слова по числу — 1 воин, 2 воина, 5 воинов
static func plural(n: float, a: String, b: String, c: String) -> String:
	n = fmod(absf(n), 100.0)
	var n1 := fmod(n, 10.0)
	if n > 10 and n < 20:
		return c
	if n1 > 1 and n1 < 5:
		return b
	if n1 == 1:
		return a
	return c

static func charName(c: Dictionary) -> String:
	return String(c.title) + " " + String(c.name) if JS.t(c.title) else String(c.name)

static func traitSum(c: Dictionary, k: String) -> float:
	var s := 0.0
	for t in c.traits:
		s += JS.n(TRAITS[t].get(k))
	return s

static func isFemName(n: Variant) -> float:
	var w: String = (String(n) if JS.t(n) else "").split(" ")[0]
	return 1.0 if FEMRX.search(w) != null and MALERX.search(w) == null else 0.0

## имя народа cul; fem: 1 / 0 / null (любое). Берёт имена, которых нет у живых (и у оставленных про запас — G._resv).
static func pickName(cul: String, fem: Variant, rng: JS.Rng = null) -> Variant:
	if rng == null:
		rng = R
	var pool0: Array = NAMES[cul] if NAMES.has(cul) else NAMES.K
	var pool: Array = pool0
	if fem != null:
		var want := 1.0 if JS.t(fem) else 0.0
		pool = pool0.filter(func(nm): return isFemName(nm) == want)
	if pool.is_empty():
		pool = pool0
	var used := {}
	if not G.is_empty() and G.has("_resv"):
		for x in G._resv:
			used[x] = 1
	if not G.is_empty() and G.has("chars"):
		for c in G.chars:
			if JS.t(c.alive):
				used[String(c.name).split(" ")[0]] = 1
	var fresh := pool.filter(func(nm): return not used.has(String(nm).split(" ")[0]))
	return rng.pick(fresh if not fresh.is_empty() else pool)

static func mkChar(realm: float, cul: String, role: String, rng: JS.Rng, o: Dictionary = {}) -> Dictionary:
	var id := float(G.chars.size())
	var name: Variant = o.get("name")
	if not JS.t(name):
		var fm: Variant = o.fem if o.has("fem") else (0.0 if role == "general" or role == "merchant" or role == "lord" else null)
		name = pickName(cul, fm, rng)
	var traits: Array = o.traits if JS.t(o.get("traits")) else []
	while traits.size() < 2:
		var t: String = rng.pick(TRAIT_K)
		if not traits.has(t) and not (t == "brave" and traits.has("craven")) and not (t == "craven" and traits.has("brave")) and not (t == "reckless" and traits.has("cautious")) and not (t == "cautious" and traits.has("reckless")):
			traits.append(t)
	var c := {"id": id, "name": name, "title": JS.o(o.get("title"), ""), "realm": realm, "cul": cul, "role": role, "traits": traits}
	c.age = o.age if o.has("age") else rng.i(22, 60)
	c.mar = o.mar if JS.t(o.get("mar")) else rng.i(4, 15)
	c.dip = o.dip if JS.t(o.get("dip")) else rng.i(3, 14)
	c.intr = o.intr if JS.t(o.get("intr")) else rng.i(3, 14)
	c.stew = o.stew if JS.t(o.get("stew")) else rng.i(3, 14)
	c.alive = 1.0
	c.pseed = rng.i(1, 1e9)
	c.fem = isFemName(name)
	c.prison = -1.0
	if o.has("fem"):
		c.fem = o.fem
	c.lrn = o.lrn if JS.t(o.get("lrn")) else rng.i(2, 12) + (3.0 if traits.has("wise") else 0.0)
	if o.has("loy"):
		c.loy = o.loy
	else:
		c.loy = JS.clp(rng.i(45, 80) + (8.0 if traits.has("honest") else 0.0) - (6.0 if traits.has("proud") else 0.0) - (5.0 if traits.has("cunning") else 0.0), 5, 100)
	if o.has("amb"):
		c.amb = o.amb
	else:
		c.amb = JS.clp(rng.i(20, 65) + (15.0 if traits.has("proud") else 0.0) + (6.0 if traits.has("wrathful") else 0.0) + (8.0 if traits.has("cunning") else 0.0) - (6.0 if traits.has("patient") else 0.0), 0, 100)
	if o.has("hon"):
		c.hon = o.hon
	else:
		var h: float
		if traits.has("honest"):
			h = rng.i(68, 92)
		elif traits.has("cunning"):
			h = rng.i(18, 50)
		elif traits.has("greedy"):
			h = rng.i(25, 55)
		else:
			h = rng.i(40, 78)
		c.hon = JS.clp(h, 0, 100)
	c.house = o.house if o.has("house") else -1.0
	G.chars.append(c)
	return c

# ---------- погода ----------
static func rollWeather() -> void:
	var t: Dictionary = WTAB[seasonOf(G.day)]
	var k: Variant = R.wpick(t.keys(), func(x): return t[x])
	G.weather = {"k": k, "days": R.i(2, 5)}

static func weatherOf() -> Dictionary:
	return WEATHER[G.weather.k]

# ---------- новая игра ----------
## newGame(seed, opt): мир — уже готовый W (тот же, что genWorld(seed)); состояние — в G
static func newGame(seed: int, opt: Dictionary = {}) -> Dictionary:
	var t0 := Time.get_ticks_msec()
	load_tables()
	R.reseed((seed ^ 0x2545f491) & 0xFFFFFFFF)
	var rng := JS.Rng.new((seed ^ 0x9e3779b9) & 0xFFFFFFFF)
	G = {"v": 2.0, "seed": float(seed), "day": 0.0, "frac": 0.0, "speed": 0.0, "mode": "ter", "realms": [], "chars": [], "setts": [], "provs": [], "armies": [], "log": [], "msgs": [], "spies": [], "rel": [],
		"weather": {"k": "clear", "days": 3.0}, "stats": {"battles": 0.0, "won": 0.0, "sieges": 0.0}, "flags": {}, "diff": JS.o(opt.get("diff"), 1.0),
		"tut": {"on": opt.get("tut") != false, "cur": 0.0, "done": [], "seen": {}}, "nextId": 1.0, "mapOpen": JS.t(opt.get("mapOpen"))}
	if typeof(G.diff) == TYPE_INT:
		G.diff = float(G.diff)
	# державы
	var gold0 := [300.0, 260.0, 420.0, 300.0, 520.0, 0.0, 0.0]
	for i in REALM_DEF.size():
		var d: Dictionary = REALM_DEF[i]
		G.realms.append({"id": float(i), "key": d.key, "name": d.name, "col": d.col, "gold": gold0[i], "ruler": -1.0, "capital": -1.0, "prestige": 0.0, "war": 0.0, "minor": i >= 5})
	for i in 5:
		var rd: Dictionary = RULERS[i]
		var o: Dictionary = rd.duplicate()
		o.traits = (rd.traits as Array).duplicate()
		var c := mkChar(i, REALM_DEF[i].key, "ruler", rng, o)
		G.realms[i].ruler = c.id
	G.realms[3].fem = 1.0
	G.chars[int(G.realms[3].ruler)].fem = 1.0
	# отношения
	for a in 7:
		var row := []
		for b in 7:
			row.append({"war": 0.0, "truce": 0.0, "ally": 0.0, "pact": 0.0, "opn": 0.0, "ws": 0.0, "since": 0.0})
		G.rel.append(row)
	for q in [[0, 1, -30], [0, 2, 15], [0, 3, 0], [0, 4, -10], [1, 2, -10], [1, 3, -20], [1, 4, -25], [2, 3, -5], [2, 4, 10], [3, 4, -15]]:
		G.rel[q[0]][q[1]].opn = float(q[2])
		G.rel[q[1]][q[0]].opn = float(q[2])
	# разбойники и вольные земли воюют со всеми
	for a in 7:
		var v := 1.0 if a != 6 else 0.0
		G.rel[6][a].war = v
		G.rel[a][6].war = v
	# поселения
	var BIG := {"village": 0, "castle": 1, "town": 2, "capital": 3}
	for k in W.setts.size():
		var s: Dictionary = W.setts[k]
		var own := float(W.owner[s.prov])
		if own < 0:
			own = 5.0
		var big: int = BIG[s.type]
		var pops := [rng.i(250, 700), rng.i(700, 1600), rng.i(1800, 4500), rng.i(5000, 9000)]
		var S := {"id": float(k), "owner": own, "ctrl": own, "pop": pops[big], "prosp": rng.i(45, 75), "walls": [0.0, 2.0, 1.0, 3.0][big], "gar": emptyU(), "food": 0.0, "pool": emptyU(),
			"mk": {"food": 0.0, "fodder": 0.0, "arrows": 0.0, "weap": 0.0, "horses": 0.0, "wagons": 0.0, "pitch": 0.0}, "siege": null, "lootDay": -99.0, "occDay": 0.0, "dev": 0.0, "lord": -1.0}
		if s.type == "capital":
			G.realms[int(own)].capital = float(k)
		G.setts.append(S)
	for k in W.provs.size():
		G.provs.append({"id": float(k), "dev": 0.0, "unrest": 0.0, "guides": 0.0})
	# вольные бароны
	for P in W.provs:
		var S: Dictionary = G.setts[P.seat]
		if S.owner == 5.0:
			var c := mkChar(5, "F", "lord", rng, {"title": "Вольный барон"})
			S.lord = c.id
	ms.setts = Time.get_ticks_msec() - t0
	# гарнизоны, наборы, рынки
	for S in G.setts:
		initSettlement(S, rng, true)
	ms.init = Time.get_ticks_msec() - t0
	# воеводы
	var GT := ["", "Хёвдинг", "Кондотьер", "Паладин", "Стратиг"]
	for r in 5:
		var n := 2.0
		if r != 0:
			var cnt := 0
			for S in G.setts:
				if S.owner == float(r) and W.setts[int(S.id)].type != "village":
					cnt += 1
			n = JS.clp(JS.rnd(cnt / 4.0), 2, 4)
		for k in int(n):
			if r == 0:
				var nm: Variant = pickName("K", 0.0, rng)
				mkChar(r, REALM_DEF[r].key, "general", rng, {"title": "Сэр", "name": nm, "fem": 0.0})
			else:
				mkChar(r, REALM_DEF[r].key, "general", rng, {"title": GT[r]})
	# игрок
	G.player = {"realm": 0.0, "char": G.realms[0].ruler}
	var cap0: Dictionary = W.setts[int(G.realms[0].capital)]
	var pa := mkArmy(0, "player", G.player.char, cap0.x, cap0.y, {"levy": 110.0, "spear": 60.0, "sword": 30.0, "archer": 50.0, "horse": 14.0, "knight": 6.0})
	assign(pa, {"food": 1900.0, "fodder": 200.0, "water": 4.0, "arrows": 1500.0, "weap": 40.0, "horses": 4.0, "wagons": 4.0})
	G.player.army = pa.id
	# войска лордов ИИ
	var SZ := [0.0, 1.0, 0.9, 1.0, 1.2]
	var COMP := [null, {"levy": 90.0, "spear": 60.0, "sword": 50.0, "archer": 50.0, "xbow": 10.0, "horse": 20.0}, {"levy": 50.0, "spear": 80.0, "sword": 35.0, "archer": 25.0, "xbow": 45.0, "horse": 25.0, "knight": 5.0},
		{"levy": 100.0, "spear": 70.0, "sword": 30.0, "archer": 45.0, "horse": 15.0, "knight": 12.0}, {"levy": 60.0, "spear": 80.0, "sword": 45.0, "archer": 30.0, "horse": 35.0, "harch": 30.0, "knight": 12.0}]
	for r in range(1, 5):
		var gens: Array = G.chars.filter(func(c): return c.realm == float(r) and c.role == "general")
		for k in gens.size():
			var c: Dictionary = gens[k]
			var caps: Array = G.setts.filter(func(S): return S.owner == float(r) and W.setts[int(S.id)].type != "village")
			var S: Dictionary = G.setts[int(G.realms[r].capital)] if k == 0 else caps[(k * 3 + 1) % caps.size()]
			var ws: Dictionary = W.setts[int(S.id)]
			var sz: float = SZ[r] * rng.range(0.8, 1.15)
			var a := mkArmy(r, "lord", c.id, ws.x, ws.y, roundU(scaleU(COMP[r], sz)))
			assign(a, {"food": menOf(a.u) * 8, "fodder": mountedN(a.u) * 6 + 40, "water": 4.0, "arrows": rangedN(a.u) * 30, "weap": 20.0, "horses": 2.0, "wagons": 3.0})
			a.ai = {"task": "idle", "t": 0.0}
	# разбойники
	for k in W.lairs.size():
		spawnBandits(k, rng)
	# караваны
	var nc := SimEcon.caravanWant()
	for k in int(nc):
		var c: Variant = SimEcon.spawnCaravan(rng)
		if c != null:
			c.ai.t = rng.i(0, 4)
	ms.armies = Time.get_ticks_msec() - t0
	# разведанные земли: свои провинции и соседние
	var ex := PackedByteArray()
	ex.resize(NT)
	if JS.t(G.mapOpen):
		ex.fill(1)
	else:
		var np := W.provs.size()
		var mine := PackedByteArray()
		mine.resize(np)
		for k in np:
			if ownerOfProv(k) == 0.0:
				mine[k] = 1
		var nb := mine.duplicate()
		for k in np:
			if mine[k]:
				for q in W.provs[k].nb:
					nb[int(q)] = 1
		var prov := W.prov
		for i in NT:
			var p := prov[i]
			if p >= 0 and nb[p]:
				ex[i] = 1
	G.explored = ex
	revealWater()
	var vis := PackedByteArray()
	vis.resize(NT)
	G.vis = vis
	ms.explored = Time.get_ticks_msec() - t0
	rollWeather()
	G.weather = {"k": "clear", "days": 3.0}
	SimEcon.econReset()
	for r in 5:
		var R0: Dictionary = G.realms[r]
		var g: float = R0.gold
		SimEcon.realmEconomy(r)
		R0.gold = g
	ms.econ = Time.get_ticks_msec() - t0
	glog("Год 1. " + charName(charOf(G.player.char)) + " выступает из столицы " + String(W.setts[int(G.realms[0].capital)].name) + ".", "title")
	return G

static func initSettlement(S: Dictionary, rng: JS.Rng, first: bool) -> void:
	var ws: Dictionary = W.setts[int(S.id)]
	SimEcon.initEcon(S, first)
	var t: String = ws.type
	var own: float = S.owner
	var gm := 0.7 if own == 5.0 else 1.0
	if not S.has("cul"):
		S.cul = own
	if t == "village":
		var lv := rng.i(8, 20)
		S.gar = assign(emptyU(), {"levy": lv, "archer": rng.i(0, 6)})
		S.food = 6.0
	elif t == "castle":
		S.gar = roundU(scaleU({"levy": 30.0, "spear": 30.0, "sword": 12.0, "archer": 20.0, "xbow": 4.0, "horse": 4.0}, gm * rng.range(0.8, 1.2)))
		S.food = 30.0
	elif t == "town":
		S.gar = roundU(scaleU({"levy": 50.0, "spear": 30.0, "sword": 10.0, "archer": 22.0, "xbow": 10.0, "horse": 4.0}, gm * rng.range(0.8, 1.2)))
		S.food = 24.0
	else:
		S.gar = roundU(scaleU({"levy": 60.0, "spear": 60.0, "sword": 40.0, "archer": 40.0, "xbow": 10.0, "horse": 12.0, "knight": 5.0}, rng.range(0.9, 1.1)))
		S.food = 45.0
	S.foodMax = S.food
	if not first:
		restockMarket(S, 0.2)
	refillPool(S, 10.0 if first else 1.0)

static func restockMarket(S: Dictionary, k: float) -> void:
	if not S.has("mkT"):
		SimEcon.mkTargets(S)
	for key in GOODS:
		S.mk[key] = minf(S.mkCap[key], JS.n(S.mk.get(key)) + S.mkT[key] * k)

## прирост набора в день по родам войск: род места × богатства × местный обычай
static func poolRates(S: Dictionary) -> Dictionary:
	var t: String = W.setts[int(S.id)].type
	var r: Dictionary = S.res
	if S.owner == 6.0:
		return {}
	var hA: float = 0.2 * r.horse if r.horse > 1.3 else 0.0
	var rate: Dictionary
	match t:
		"village":
			rate = {"levy": 1.5, "archer": 0.25 * r.wood}
		"castle":
			rate = {"levy": 0.8, "spear": 1.0, "sword": 0.35, "archer": 0.7 * r.wood, "horse": 0.35 * r.horse, "knight": 0.1 * r.horse, "harch": hA}
		"town":
			rate = {"levy": 2.0, "spear": 0.8, "sword": 0.3, "archer": 0.8, "xbow": 0.45 * minf(1.6, 0.5 + r.iron * 0.5), "horse": 0.25 * r.horse, "harch": hA * 0.6}
		_:
			rate = {"levy": 2.5, "spear": 1.4, "sword": 0.6, "archer": 1.0, "xbow": 0.5, "horse": 0.6 * r.horse, "knight": 0.15 * r.horse, "harch": hA}
	var cul: float = S.cul if S.has("cul") else S.owner
	var CK: Dictionary = CUL_UNIT[int(cul)] if cul >= 0 and cul < CUL_UNIT.size() else {}
	if cul == 4.0 and t != "village":
		rate.harch = maxf(JS.n(rate.get("harch")), 0.12)
	var o := {}
	for u in rate:
		var k: float = CK[u] if CK.has(u) else 1.0
		if rate[u] * k > 0.0:
			o[u] = rate[u] * k
	return o

static func poolCap(S: Dictionary, u: String) -> float:
	var t: String = W.setts[int(S.id)].type
	var cul: float = S.cul if S.has("cul") else S.owner
	var CK: Dictionary = CUL_UNIT[int(cul)] if cul >= 0 and cul < CUL_UNIT.size() else {}
	var base: float = POOL_BASE[t]
	return base * (0.5 + S.prosp / 100.0) * float(POOL_K[u]) * maxf(0.5, float(CK[u]) if CK.has(u) else 1.0)

## poolRates, запомненные по поселению: зависят только от типа, богатств (S.res — с начала игры), народа и владельца
static func poolRatesC(S: Dictionary) -> Dictionary:
	if not is_same(pr_g, G):
		pr_g = G
		pr_cache = []
	var id := int(S.id)
	if pr_cache.size() <= id:
		pr_cache.resize(G.setts.size())
	var e: Variant = pr_cache[id]
	if e == null or e[0] != S.owner or e[1] != S.get("cul"):
		e = [S.owner, S.get("cul"), poolRates(S)]
		pr_cache[id] = e
	return e[2]

static func refillPool(S: Dictionary, days: float) -> void:
	if S.owner == 6.0:
		return
	var rate := poolRatesC(S)
	if rate.is_empty():
		return
	# то же, что poolCap для каждого рода войск, но без лишних словарей: день королевства зовёт это ~1000 раз
	var ws: Dictionary = W.setts[int(S.id)]
	var dev: float = G.provs[ws.prov].dev
	var cul: float = S.cul if S.has("cul") else S.owner
	var CK: Dictionary = CUL_UNIT[int(cul)] if cul >= 0 and cul < CUL_UNIT.size() else {}
	var pk: float = 0.5 + S.prosp / 100.0
	var base: float = float(POOL_BASE[ws.type]) * pk
	var pool: Dictionary = S.pool
	for u in rate:
		var cap: float = base * float(POOL_K[u]) * maxf(0.5, float(CK[u]) if CK.has(u) else 1.0)
		pool[u] = minf(cap, JS.n(pool.get(u)) + rate[u] * days * pk * (1.0 - dev))

# ---------- войска ----------
static func mkArmy(realm: float, kind: String, gen: float, tx: float, ty: float, u: Dictionary) -> Dictionary:
	var id: float = G.nextId
	G.nextId += 1.0
	var a := {"id": id, "realm": realm, "kind": kind, "gen": gen, "x": tx + 0.5, "y": ty + 0.5, "path": null, "pi": 0.0, "prog": 0.0, "u": assign(emptyU(), u), "xp": emptyU(), "wounded": 0.0, "sick": 0.0,
		"morale": 65.0, "fat": 10.0, "food": 0.0, "fodder": 0.0, "water": 4.0, "arrows": 0.0, "weap": 0.0, "horses": 0.0, "wagons": 0.0, "pitch": 0.0, "mode": "march", "modeDay": 0.0, "forced": 0.0, "camp": 0.0,
		"fortDays": 0.0, "siegeOf": -1.0, "alive": 1.0, "hunger": 0.0, "thirst": 0.0, "lastFight": -99.0, "vict": 0.0, "stay": 0.0, "hidden": 0.0, "fires": 0.0}
	var xp := 5.0 if kind == "bandit" else (10.0 if kind == "player" else 15.0)
	for t in UT:
		a.xp[t] = xp
	G.armies.append(a)
	return a

## логово разбойников номер k (WD.lairs[k] — [x, y, клетка, провинция])
static func spawnBandits(k: int, rng: JS.Rng = null) -> Dictionary:
	var L: Array = W.lairs[k]
	return spawnBanditsAt(L[0], L[1], float(k), rng)

## разбойники в клетке (x, y): у логова (lair — его номер) или мятежники после бунта (lair −1, как WD.lairs.indexOf в HTML)
static func spawnBanditsAt(x: float, y: float, lair: float, rng: JS.Rng = null) -> Dictionary:
	if rng == null:
		rng = R
	var n := rng.i(25, 70)
	var c := mkChar(6, "B", "bandit", rng, {"title": "Атаман"})
	var a := mkArmy(6, "bandit", c.id, x, y, {"levy": JS.rnd(n * 0.6), "spear": JS.rnd(n * 0.1), "sword": 0.0, "archer": JS.rnd(n * 0.25), "horse": JS.rnd(n * 0.05)})
	assign(a, {"food": n * 6, "water": 4.0, "arrows": rangedN(a.u) * 20, "lair": lair})
	a.ai = {"task": "lurk", "t": 0.0}
	a.morale = 55.0
	return a

static func armyById(id: Variant) -> Variant:
	for a in G.armies:
		if a.id == id and JS.t(a.alive):
			return a
	return null

static func playerArmy() -> Variant:
	return armyById(G.player.army)

static func armyMen(a: Dictionary) -> float:
	return menOf(a.u)

static func armyTile(a: Dictionary) -> int:
	return int(floorf(a.y)) * MW + int(floorf(a.x))

static func armyCap(a: Dictionary) -> float:
	return armyMen(a) * float(T.MAN_CAP) + a.wagons * float(T.WAGON_CAP)

static func waterCap(a: Dictionary) -> float:
	return 4.0 + minf(6.0, floorf(JS.n(a.get("wagons")) / 2.0))

# ---------- вода у разведанных берегов ----------
## озёра — целиком, море — до 6 клеток от берега
static func revealWater() -> void:
	var ex: PackedByteArray = G.explored
	var ne := ex.count(1)
	if rw_ne == ne and is_same(rw_g, G):
		return
	rw_ne = ne
	rw_g = G
	var ter := W.ter
	if wat_w != W:
		wat_w = W
		wat.resize(NT)
		for i in NT:
			wat[i] = 1 if TINFO[ter[i]].get("water", 0) else 0
	var d := PackedInt32Array()
	d.resize(NT)
	d.fill(-1)
	var q := PackedInt32Array()
	q.resize(NT)
	var qh := 0
	var qt := 0
	var ch := 0
	for i in NT:
		if ex[i] and not wat[i]:
			var x := i % MW
			var c := false
			if x < MW - 1 and wat[i + 1]:
				c = true
			elif x > 0 and wat[i - 1]:
				c = true
			elif i < NT - MW and wat[i + MW]:
				c = true
			elif i >= MW and wat[i - MW]:
				c = true
			if c:
				d[i] = 0
				q[qt] = i
				qt += 1
	while qh < qt:
		var a := q[qh]
		qh += 1
		var x := a % MW
		var lake := ter[a] == LAKE
		if not lake and d[a] >= 6:
			continue
		for k in 4:
			var j: int
			match k:
				0: j = a + 1 if x < MW - 1 else -1
				1: j = a - 1 if x > 0 else -1
				2: j = a + MW if a < NT - MW else -1
				_: j = a - MW if a >= MW else -1
			if j < 0:
				continue
			if d[j] >= 0 or not wat[j]:
				continue
			d[j] = 0 if ter[j] == LAKE else d[a] + 1
			if not ex[j]:
				ex[j] = 1
				ch = 1
			q[qt] = j
			qt += 1
	G.explored = ex
	if ch:
		fog_dirty = 1

# ---------- летопись ----------
## звук игры (Snd.sfx): очередь для звукового движка экрана (без экрана — просто копится и обрезается)
static var sfxq: Array = []
static func sfx(k: String) -> void:
	sfxq.append(k)
	if sfxq.size() > 16:
		sfxq.pop_front()


static func zol(n: float) -> String:
	n = JS.rnd(n)
	return JS.s(n) + " " + plural(n, "золотой", "золотых", "золотых")


static func glog(t: String, c: String = "info") -> void:
	G.log.append({"d": G.day, "t": t, "c": c if c != "" else "info"})
	if G.log.size() > 200:
		G.log.pop_front()
	feed.append({"t": t, "c": c, "at": Time.get_ticks_msec() / 1000.0})
	if feed.size() > 7:
		feed.pop_front()

# ---------- война ----------
static func atWar(a: float, b: float) -> bool:
	if a == b:
		return false
	if a == 6.0 or b == 6.0:
		return true
	return JS.t(G.rel[int(a)][int(b)].war)

static func hostile(a: float, b: float) -> bool:
	return atWar(a, b)
