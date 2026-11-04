class_name SimEcon
## Экономика — перенос econ.js: богатства земли вокруг поселения, мастерские, цели и запасы рынков, цены, дневной круг
## (поля, мастерские, мелкая торговля соседей, потребление горожан, склады, сведения о чужих рынках), купцы, казна держав.

const MW := WorldData.MW
const MH := WorldData.MH
const FOREST := WorldData.FOREST
const DFOREST := WorldData.DFOREST
const STEPPE := WorldData.STEPPE
const GRASS := WorldData.GRASS
const HILLS := WorldData.HILLS
const MOUNT := WorldData.MOUNT
const FARM := WorldData.FARM
const DEEP := WorldData.DEEP
const SHALLOW := WorldData.SHALLOW
const BEACH := WorldData.BEACH
const SNOW := WorldData.SNOW

static var links: Array = []         # WD._links
static var links_w: WorldData = null

static func econReset() -> void:
	var E := Sim.ECON
	E.inc = null
	E.incDay = -1.0
	E.incoming = null
	E.rep = null
	E.c = null
	E.cG = null

static func stAdd(S: Dictionary, key: String, k: String, v: float) -> void:
	var o: Dictionary = S.st[key]
	o[k] = JS.n(o.get(k)) + v * Sim.GA

# ---------- богатства земли ----------
static func localMix(i: int, R: int) -> PackedFloat32Array:
	var m := PackedFloat32Array()
	m.resize(14)
	var x0 := i % MW
	var y0 := i / MW
	var n := 0
	var ter := Sim.W.ter
	for y in range(maxi(0, y0 - R), mini(MH - 1, y0 + R) + 1):
		for x in range(maxi(0, x0 - R), mini(MW - 1, x0 + R) + 1):
			if (x - x0) * (x - x0) + (y - y0) * (y - y0) > R * R:
				continue
			m[ter[y * MW + x]] += 1.0
			n += 1
	for t in 14:
		m[t] = m[t] / float(maxi(1, n))
	return m

static func settRiches(S: Dictionary) -> Dictionary:
	var W := Sim.W
	var ws: Dictionary = W.setts[int(S.id)]
	var m := localMix(ws.i, 5 if ws.type == "village" else 7)
	var P: PackedFloat32Array = W.provs[ws.prov].mix
	var mx := func(t: int) -> float: return m[t] * 0.7 + P[t] * 0.3
	var forest: float = mx.call(FOREST) + mx.call(DFOREST)
	var steppe: float = mx.call(STEPPE) + mx.call(GRASS) * 0.5
	var hills: float = mx.call(HILLS) + mx.call(MOUNT)
	var farm: float = mx.call(FARM)
	var sea: float = m[DEEP] + m[SHALLOW] + m[BEACH] * 0.5
	var h := JSM.hash2(ws.x, ws.y, 811)
	var temp: float = W.temp[ws.i]
	var salt := 0.0
	if sea > 0.04:
		salt = 0.8 + minf(0.8, sea * 2)
	elif mx.call(MOUNT) + mx.call(HILLS) * 0.4 > 0.12 and h < 0.45:
		salt = 0.9
	var wine := 0.0
	if temp > 0.55:
		wine = JS.clp((temp - 0.55) * 4.5, 0, 1.4) * (0.3 + farm * 2 + mx.call(HILLS) * 2.2 + mx.call(GRASS) * 0.5)
	return {"food": 0.6 + farm * 4 + mx.call(GRASS), "horse": 0.4 + steppe * 2.2, "wood": 0.4 + forest * 2.5, "iron": 0.3 + hills * 3,
		"wool": 0.3 + mx.call(GRASS) * 1.0 + mx.call(HILLS) * 1.6 + mx.call(STEPPE) * 0.8 + mx.call(SNOW) * 0.6, "salt": salt, "wine": wine}

static func settWorkshops(S: Dictionary) -> Dictionary:
	var ws: Dictionary = Sim.W.setts[int(S.id)]
	var r: Dictionary = S.res
	var h := func(k: int) -> float: return 0.75 + JSM.hash2(ws.x * 7 + k, ws.y, 823) * 0.5
	return {"iron": (0.45 + minf(1.2, r.iron * 0.55)) * h.call(1), "weap": h.call(2), "arrows": (0.6 + minf(0.8, r.wood * 0.3)) * h.call(3), "wagons": h.call(4),
		"pitch": minf(1.5, r.wood * 0.7) * h.call(5) if r.wood > 0.95 else 0.0, "cloth": (0.5 + minf(1.0, r.wool * 0.5)) * h.call(6)}

static func resOf(r: Dictionary, k: String) -> float:
	match k:
		"food": return r.food
		"fodder": return r.horse
		"horses": return maxf(0.0, r.horse - 0.6)
		"wood": return r.wood
		"ore": return maxf(0.0, r.iron - 0.45)
	return JS.n(r.get(k))

## дневной урожай полей (до разорения войной): за 100 душ деревни, у замков и городов — немного своих полей
static func landK(S: Dictionary) -> float:
	var v: float = S.pop if Sim.W.setts[int(S.id)].type == "village" else minf(S.pop, 1500.0) * 0.4
	return v / 100.0 * (0.5 + S.prosp / 100.0)

static func rawProd(S: Dictionary, sf: int, o: Dictionary = {}) -> Dictionary:
	var L := landK(S)
	for k in Sim.RAW_G:
		var f := 1.0
		if Sim.SEASON_F.has(k):
			f = Sim.FAVG[k] if sf < 0 else Sim.SEASON_F[k][sf]
		o[k] = L * Sim.RAW[k] * resOf(S.res, k) * f
	return o

static func yearWorth(S: Dictionary) -> float:
	var v := 0.0
	for k in Sim.RAW_G:
		v += Sim.RAW[k] * resOf(S.res, k) * Sim.FAVG[k] * Sim.GD[k].p
	return v

## производные числа (не сохраняются): выход сырья на единицу земли и годовая стоимость
static func econCache() -> Array:
	var E := Sim.ECON
	var G := Sim.G
	if is_same(E.get("cG"), G) and E.get("c") != null and E.c.size() == G.setts.size():
		return E.c
	var c := []
	for S in G.setts:
		var rp := PackedFloat64Array()
		rp.resize(Sim.RAW_G.size())
		for j in Sim.RAW_G.size():
			var k: String = Sim.RAW_G[j]
			rp[j] = Sim.RAW[k] * resOf(S.res, k)
		c.append({"rp": rp, "vY": yearWorth(S), "vil": Sim.W.setts[int(S.id)].type == "village"})
	E.c = c
	E.cG = G
	return c

## цели рынка: запас, при котором товар идёт по обычной цене; склады вмещают втрое больше
static func mkTargets(S: Dictionary) -> void:
	var ws: Dictionary = Sim.W.setts[int(S.id)]
	var t: String = ws.type
	var big: float = Sim.BIGK[t]
	var T := {}
	for k in Sim.GOODS:
		T[k] = 0.0
	if t == "village":
		var pr := rawProd(S, -1)
		for k in Sim.RAW_G:
			T[k] = pr[k] * 0.25 * 10
		T.food += 250.0
		T.fodder += 100.0
		T.horses += 2.0
		T.wagons = 1.0
	else:
		for k in Sim.NEED:
			T[k] += Sim.NEED[k] * S.pop * 20
		for r in Sim.RECIPE:
			var RC: Dictionary = Sim.RECIPE[r]
			var c: float = JS.n(RC.cap.get(t)) * JS.n(S.wk.get(r))
			if c == 0.0:
				continue
			T[r] += c * 12
			for i in RC.in:
				T[i] += c * RC.in[i] * 15
		for k in Sim.RESERVE:
			if k != "pitch" or t == "town" or t == "capital":
				T[k] += Sim.RESERVE[k] * big
	for k in Sim.GOODS:
		T[k] = maxf(T[k], 6.0 / Sim.GD[k].p * big)
	S.mkT = T
	var cap := {}
	for k in Sim.GOODS:
		cap[k] = T[k] * 3
	S.mkCap = cap

static func initEcon(S: Dictionary, first: bool) -> void:
	var vil: bool = Sim.W.setts[int(S.id)].type == "village"
	S.res = settRiches(S)
	S.wk = settWorkshops(S) if not vil else {}
	for k in Sim.GOODS:
		if not S.mk.has(k):
			S.mk[k] = 0.0
	mkTargets(S)
	if not vil:
		if not S.has("st"):
			S.st = {}
		for key in Sim.ST_KEYS:
			if not JS.t(S.st.get(key)):
				S.st[key] = {}
	else:
		S.erase("st")
	if Sim.ECON.get("c") != null:
		Sim.ECON.cG = null
	if first:
		var gi := 0
		for k in Sim.GOODS:
			S.mk[k] = S.mkT[k] * (0.8 + JSM.hash2(S.id, gi, 829) * 0.5)
			gi += 1

# ---------- цены ----------
static func pxAt(S: Dictionary, k: String, st: float) -> float:
	var T: float = S.mkT[k] if S.has("mkT") else 1.0
	return Sim.GD[k].p * JS.clp(pow(T / maxf(st, T * 0.06), 0.55), 0.4, 4.5)

static func priceOf(S: Dictionary, k: String, sell := false) -> float:
	if not Sim.GD.has(k):
		return 0.0
	var p := pxAt(S, k, JS.n(S.mk.get(k)))
	if JS.t(S.siege):
		p *= 1.5
	if sell:
		p *= 0.55
	return p

## взять с рынка (mkTake): что купили войска — в книги рынка
static func mkTake(S: Dictionary, k: String, n: float) -> void:
	if not (n > 0):
		return
	S.mk[k] = maxf(0.0, JS.n(S.mk.get(k)) - n)
	if S.has("st") and JS.t(S.st.get("arm")):
		stAdd(S, "arm", k, n)

static func ema(o: Dictionary, k: String, v: float, a: float) -> void:
	o[k] = JS.rnd((JS.n(o.get(k)) * (1 - a) + v * a) * 100) / 100.0

# ---------- дневной круг ----------
## день рынков (econDaily): корутина — при SimDay.budget_us > 0 растягивается на несколько кадров (между поселениями)
static func econDaily() -> void:
	var G := Sim.G
	var W := Sim.W
	var t0 := Time.get_ticks_usec()
	var ci := 0   # части дня по кадрам (SimDay.due): каждые 32 поселения — проверка времени
	var sf := Sim.seasonOf(G.day)
	var day: float = G.day
	var fairs: bool = G.has("court") and SimDyn.hasTech("fairs")
	var inc := []
	for r in 7:
		inc.append({"tax": 0.0, "craft": 0.0, "occ": 0.0, "mk": 0.0})
	for P in G.provs:
		P.ecTax = 0.0
		P.ecCraft = 0.0
	var GA: float = Sim.GA
	# 0. книги (только у замков и городов): вчерашнее блекнет; раз в неделю рынки мерят заново
	var EC := econCache()
	if fmod(day, 7.0) == 0.0:
		for S in G.setts:
			mkTargets(S)
	for S in G.setts:
		if not S.has("st"):
			continue
		for key in Sim.ST_KEYS:
			var o: Dictionary = S.st[key]
			for k in o:
				var v: float = o[k] * (1 - GA)
				o[k] = 0.0 if v < 0.004 else v
	# 1. поля: деревни везут излишки в главное место провинции, если война не отрезала
	var RAW_G: Array = Sim.RAW_G
	var NR := RAW_G.size()
	var SFd := []
	for k in RAW_G:
		SFd.append(Sim.SEASON_F[k][sf] if Sim.SEASON_F.has(k) else 1.0)
	if SimDay.due():
		await SimDay.pause()
	var ECONK: Dictionary = Sim.ECONK
	for S in G.setts:
		ci += 1
		if (ci & 31) == 0 and SimDay.due():
			await SimDay.pause()
		var ws: Dictionary = W.setts[int(S.id)]
		var P: Dictionary = G.provs[ws.prov]
		var seat: Dictionary = G.setts[W.provs[ws.prov].seat]
		var ec: Dictionary = EC[int(S.id)]
		var vil: bool = ec.vil
		var k0: float = (1 - P.dev * 0.8) * (0.15 if JS.t(S.siege) else 1.0) * (0.35 if day - JS.o(S.get("lootDay"), -99.0) < 20 else 1.0)
		if S.ctrl == 6.0:
			k0 = 0.0
		var cut: bool = vil and (JS.t(seat.siege) or seat.ctrl != S.ctrl or JS.t(S.siege))
		var dest: Dictionary = seat if vil and not cut else S
		var share := 0.75 if vil and not cut else 0.0
		var L := landK(S) * k0
		if L > 0:
			var mk: Dictionary = S.mk
			var dm: Dictionary = dest.mk
			var sp: Variant = dest.st.prod if dest.has("st") else null
			var rp: PackedFloat64Array = ec.rp
			for j in NR:
				var q: float = L * rp[j] * SFd[j]
				if q <= 0:
					continue
				var k: String = RAW_G[j]
				if share != 0.0:
					mk[k] += q * (1 - share)
					dm[k] += q * share
				else:
					mk[k] += q
				if sp != null:
					sp[k] = JS.n(sp.get(k)) + GA * (q * share if share != 0.0 else q)
		# подать с земли (с годовой стоимости полей) — тому, кто держит место; с занятого — половина
		if S.ctrl >= 5:
			continue
		var tx: float = (L * ec.vY * ECONK.tax + (0.0 if vil else S.pop * ECONK.poll)) * (0.5 if P.unrest > 50 else 1.0) * (1.0 if S.owner == S.ctrl else 0.5)
		if S.ctrl == seat.ctrl:
			P.ecTax += tx
		else:
			inc[int(S.ctrl)].occ += tx
	if SimDay.due():
		await SimDay.pause()
	# 2. мастерские: работают, пока товар окупает сырьё и склады не полны
	for S in G.setts:
		ci += 1
		if (ci & 31) == 0 and SimDay.due():
			await SimDay.pause()
		var ws: Dictionary = W.setts[int(S.id)]
		var t: String = ws.type
		if t == "village" or S.ctrl == 6.0:
			continue
		var P: Dictionary = G.provs[ws.prov]
		var wk: float = (0.5 + S.prosp / 100.0) * (1 - P.dev * 0.6) * (0.5 if JS.t(S.siege) else 1.0) * (1.1 if S.ctrl == 0.0 and fairs and t != "castle" else 1.0)
		var va := 0.0
		for r in Sim.RECIPE:
			var R0: Dictionary = Sim.RECIPE[r]
			var s0 := JS.n(S.mk.get(r))
			var T: float = S.mkT[r]
			var c: float = JS.n(R0.cap.get(t)) * JS.n(S.wk.get(r)) * wk
			if c <= 0:
				continue
			c *= JS.clp((1.8 - s0 / T) / 0.8, 0, 1)
			if c <= 0:
				continue
			var q := c
			for i in R0.in:
				q = minf(q, JS.n(S.mk.get(i)) / R0.in[i])
			if q <= c * 0.02:
				continue
			var cost := 0.0
			for i in R0.in:
				cost += R0.in[i] * pxAt(S, i, JS.n(S.mk.get(i)))
			if pxAt(S, r, s0) < cost * 1.02:
				continue
			for i in R0.in:
				S.mk[i] -= q * R0.in[i]
			S.mk[r] = s0 + q
			stAdd(S, "craft", r, q)
			var base := 0.0
			for i in R0.in:
				base += R0.in[i] * Sim.GD[i].p
			va += q * maxf(0.0, Sim.GD[r].p - base)
		if S.ctrl < 5:
			var cr: float = va * ECONK.craft * (1.0 if S.owner == S.ctrl else 0.5)
			if S.ctrl == G.setts[W.provs[ws.prov].seat].ctrl:
				P.ecCraft += cr
			else:
				inc[int(S.ctrl)].occ += cr
	if SimDay.due():
		await SimDay.pause()
	# 3. мелкая торговля: разносчики и возчики между соседними городами, где товар дороже провоза
	econTrade(inc, fairs)
	if SimDay.due():
		await SimDay.pause()
	# 4. горожане едят, топят и носят (меньше, когда дорого); нехватка вредит
	for S in G.setts:
		ci += 1
		if (ci & 31) == 0 and SimDay.due():
			await SimDay.pause()
		var ws: Dictionary = W.setts[int(S.id)]
		if ws.type == "village":
			continue
		var P: Dictionary = G.provs[ws.prov]
		for k in Sim.NEED:
			var rel: float = pxAt(S, k, JS.n(S.mk.get(k))) / Sim.GD[k].p
			var want: float = Sim.NEED[k] * S.pop * JS.clp(1.6 - 0.6 * rel, 0.35, 1.25)
			var take := minf(JS.n(S.mk.get(k)), want)
			S.mk[k] -= take
			stAdd(S, "cons", k, take)
			var sh := 1 - take / want if want > 0 else 0.0
			if sh > 0.05:
				stAdd(S, "short", k, sh)
			if sh > 0.3:
				if k == "food":
					S.prosp = maxf(5.0, S.prosp - 0.12 * sh)
					if S.ctrl == S.owner:
						P.unrest = minf(100.0, P.unrest + 0.3 * sh)
				elif k == "salt" or k == "cloth" or k == "wood":
					S.prosp = maxf(5.0, S.prosp - 0.03 * sh)
	# 5. склады (что не влезло — сгнило или ушло за бесценок)
	for S in G.setts:
		var mk: Dictionary = S.mk
		var cap: Dictionary = S.mkCap
		for k in (RAW_G if EC[int(S.id)].vil else Sim.GOODS):
			if mk[k] > cap[k]:
				mk[k] = cap[k]
	if SimDay.due():
		await SimDay.pause()
	# 6. что игрок знает о чужих рынках: что видят его глаза и что рассказывают купцы
	var me: float = G.player.realm
	var inw: Variant = null
	if fmod(day, 5.0) == 0.0:
		inw = []
		for r in 5:
			inw.append(float(r) != me and SimIntel.hasInward(r))
	var vis: PackedByteArray = G.vis
	for S in G.setts:
		var ws: Dictionary = W.setts[int(S.id)]
		if ws.type == "village":
			continue
		if S.ctrl == me or vis[ws.i] == 2 or (inw != null and S.ctrl < 5 and inw[int(S.ctrl)]):
			seeMarket(S)
	if fmod(day, 7.0) == 3.0:
		for l in tradeLinks():
			var A: Dictionary = G.setts[l[0]]
			var B: Dictionary = G.setts[l[1]]
			if (A.ctrl == me) == (B.ctrl == me) or JS.t(A.siege) or JS.t(B.siege) or A.ctrl >= 5 or B.ctrl >= 5 or Sim.hostile(A.ctrl, B.ctrl):
				continue
			seeMarket(B if A.ctrl == me else A)
	Sim.ECON.inc = inc
	Sim.ECON.incDay = day
	if SimDay.due():
		await SimDay.pause()
	econCaravans()
	Sim.ECON.ms = Sim.ECON.ms * 0.9 + (Time.get_ticks_usec() - t0) / 1000.0 * 0.1

## соседние места (по границам провинций) и лиги между ними
static func tradeLinks() -> Array:
	var W := Sim.W
	if links_w == W:
		return links
	var L := []
	for a in W.provs.size():
		var P: Dictionary = W.provs[a]
		for b in P.nb:
			if b > a:
				var A: Dictionary = W.setts[P.seat]
				var B: Dictionary = W.setts[W.provs[b].seat]
				var d := JSM.hypot(A.x - B.x, A.y - B.y)
				if d <= 75:
					L.append([P.seat, W.provs[b].seat, d])
	links = L
	links_w = W
	return L

static func econTrade(inc: Array, fairs: bool) -> void:
	var G := Sim.G
	var ECONK: Dictionary = Sim.ECONK
	for l in tradeLinks():
		var A: Dictionary = G.setts[l[0]]
		var B: Dictionary = G.setts[l[1]]
		var d: float = l[2]
		if JS.t(A.siege) or JS.t(B.siege) or A.ctrl >= 5 or B.ctrl >= 5:
			continue
		if A.ctrl != B.ctrl and Sim.hostile(A.ctrl, B.ctrl):
			continue
		var f0: float = ECONK.flow * JS.clp(25 / d, 0.35, 1) * (1.0 if A.ctrl == B.ctrl else 0.7)
		for k in Sim.GOODS:
			var sA := JS.n(A.mk.get(k))
			var sB := JS.n(B.mk.get(k))
			var TA: float = A.mkT[k]
			var TB: float = B.mkT[k]
			var pA := pxAt(A, k, sA)
			var pB := pxAt(B, k, sB)
			var gap := absf(pA - pB)
			var tc: float = Sim.GD[k].bulk * d * ECONK.carry + 0.04 * minf(pA, pB)
			if gap <= tc:
				continue
			var aSrc := pA < pB
			var src: Dictionary = A if aSrc else B
			var dst: Dictionary = B if aSrc else A
			var ss := sA if aSrc else sB
			var Ts := TA if aSrc else TB
			var x := ss - (sA + sB) / (TA + TB) * Ts
			if x <= 0:
				continue
			var q := x * f0 * (1 - tc / gap)
			src.mk[k] = ss - q
			dst.mk[k] = JS.n(dst.mk.get(k)) + q
			stAdd(dst, "imp", k, q)
			stAdd(src, "exp", k, q)
			inc[int(dst.ctrl)].mk += q * (pB if aSrc else pA) * ECONK.dutyMk * (1.25 if dst.ctrl == 0.0 and fairs else 1.0)
	for r in 5:
		dutyTo(r, inc[r].mk)

static func mkSnap(S: Dictionary) -> Dictionary:
	var px := {}
	for k in Sim.GOODS:
		px[k] = JS.rnd(priceOf(S, k) / Sim.GD[k].p * 100) / 100.0
	return {"d": Sim.G.day, "px": px}

static func seeMarket(S: Dictionary) -> void:
	S.seen = mkSnap(S)

# ---------- купцы ----------
static func caravanWant() -> float:
	var n := 0
	for S in Sim.G.setts:
		var t: String = Sim.W.setts[int(S.id)].type
		if (t == "town" or t == "capital") and S.ctrl < 5:
			n += 1
	return maxf(6.0, JS.rnd(n / 2.0))

static func econCaravans() -> void:
	var live: Array = Sim.G.armies.filter(func(a): return JS.t(a.alive) and a.kind == "caravan")
	# что уже везут на каждый рынок (чтобы купцы не бежали все к одной нехватке)
	var inc := {}
	for a in live:
		if JS.t(a.get("cargo")) and JS.t(a.get("ai")) and a.ai.to >= 0:
			var key := JS.s(a.ai.to)
			if not inc.has(key):
				JS.oset(inc, key, {})
			var o: Dictionary = inc[key]
			for k in a.cargo:
				o[k] = JS.n(o.get(k)) + a.cargo[k]
	Sim.ECON.incoming = inc
	if live.size() < caravanWant() and Sim.R.f() < 0.3:
		spawnCaravan()

static func spawnCaravan(rng: JS.Rng = null) -> Variant:
	if rng == null:
		rng = Sim.R
	var G := Sim.G
	var W := Sim.W
	var towns: Array = G.setts.filter(func(S):
		var t: String = W.setts[int(S.id)].type
		return (t == "town" or t == "capital") and S.ctrl < 5 and not JS.t(S.siege))
	if towns.is_empty():
		return null
	var tot := 0.0
	for S in towns:
		tot += S.prosp
	var x := rng.f() * tot
	var A: Dictionary = towns[0]
	for S in towns:
		x -= S.prosp
		if x <= 0:
			A = S
			break
	var ws: Dictionary = W.setts[int(A.id)]
	var r: float = A.ctrl
	var c := Sim.mkChar(r, Sim.REALM_DEF[int(r)].key, "merchant", rng, {"title": "Купец"})
	var sp := rng.i(8, 18)
	var ar := rng.i(4, 10)
	var a := Sim.mkArmy(r, "caravan", c.id, ws.x, ws.y, {"levy": 0.0, "spear": sp, "sword": 0.0, "archer": ar, "horse": rng.i(0, 4)})
	var wg := rng.i(2, 4)
	Sim.assign(a, {"food": 700.0, "fodder": 150.0, "water": 4.0, "wagons": wg, "arrows": 100.0, "cash": rng.i(220, 420), "cargo": null, "home": A.id, "trips": 0.0, "profit": 0.0})
	a.ai = {"task": "idle", "to": -1.0, "from": A.id, "t": 0.0}
	return a

static func dutyTo(r: float, v: float) -> void:
	if r < 0 or r >= 5 or v <= 0:
		return
	var R0: Dictionary = Sim.G.realms[int(r)]
	R0.dutyAcc = JS.n(R0.get("dutyAcc")) + v

## цена закупки n единиц с рынка (по Симпсону: цена растёт по мере того, как пустеет рынок)
static func buyCost(S: Dictionary, k: String, n: float) -> float:
	if n <= 0:
		return 0.0
	var s := JS.n(S.mk.get(k))
	return n * (pxAt(S, k, s) + 4 * pxAt(S, k, maxf(0.0, s - n / 2)) + pxAt(S, k, maxf(0.0, s - n))) / 6 * (1.5 if JS.t(S.siege) else 1.0)

## выручка за n единиц на рынке (цена падает, пока товар прибывает)
static func sellGain(S: Dictionary, k: String, n: float) -> float:
	if n <= 0:
		return 0.0
	var s := JS.n(S.mk.get(k))
	return n * (pxAt(S, k, s) + 4 * pxAt(S, k, s + n / 2) + pxAt(S, k, s + n)) / 6

static func caravanCap(a: Dictionary) -> float:
	return float(JS.o(a.get("wagons"), 2.0)) * 400

## купцы несут вести о последних рынках; писцы короля слышат их на его собственных рынках
static func caravanNews(a: Dictionary, S: Dictionary) -> void:
	var G := Sim.G
	if S.ctrl == G.player.realm and JS.t(a.get("news")):
		for nw in a.news:
			var ti := int(nw.id)
			var T: Variant = G.setts[ti] if ti >= 0 and ti < G.setts.size() else null
			if T == null or nw.id == S.id or G.day - nw.d > 60 or (JS.t(T.get("seen")) and T.seen.d >= nw.d):
				continue
			T.seen = {"d": nw.d, "px": nw.px}
	if not JS.t(a.get("news")):
		a.news = []
	var L: Array = a.news
	var i := -1
	for j in L.size():
		if L[j].id == S.id:
			i = j
			break
	var sn := mkSnap(S)
	sn.id = S.id
	if i >= 0:
		L.remove_at(i)
	L.append(sn)
	if L.size() > 3:
		L.pop_front()

## лучшая поездка с рынка M: один товар, одно место, наибольшая прибыль за день пути
static func planTrip(a: Dictionary, M: Dictionary) -> Variant:
	var G := Sim.G
	var W := Sim.W
	var ws: Dictionary = W.setts[int(M.id)]
	var inc: Dictionary = JS.o(Sim.ECON.get("incoming"), {})
	var cand := []
	var best: Variant = null
	if a.cash < 90:
		return null
	for k in Sim.GOODS:
		var avail: float = JS.n(M.mk.get(k)) - M.mkT[k] * 0.6
		if avail > 0:
			cand.append_array([k, avail, pxAt(M, k, JS.n(M.mk.get(k)))])
	if cand.is_empty():
		return null
	var seatK := Sim.SEAT_K
	var bs := float(Sim.T.BASE_SPEED)
	var ECONK: Dictionary = Sim.ECONK
	var bad: Array = a.bad if JS.t(a.get("bad")) else []
	for D in G.setts:
		if is_same(D, M) or JS.t(D.siege) or D.ctrl == 6.0 or bad.has(D.id):
			continue
		var wd: Dictionary = W.setts[int(D.id)]
		if wd.type == "village":
			continue
		if D.ctrl < 5 and a.realm < 5 and Sim.hostile(a.realm, D.ctrl):
			continue
		var d := JS.hypot(wd.x - ws.x, wd.y - ws.y)
		if d > 80 * seatK:
			continue
		var days := d * 1.3 / (bs * 0.8) + 1.5
		var incD: Dictionary = inc.get(JS.s(D.id), {})
		for c in range(0, cand.size(), 3):
			var k: String = cand[c]
			var pb: float = cand[c + 2]
			if pxAt(D, k, JS.n(D.mk.get(k))) * 0.91 < pb * 1.12:
				continue # цена там не окупит пошлин и дороги
			var want: float = D.mkT[k] * 1.2 - JS.n(D.mk.get(k)) - JS.n(incD.get(k))
			if want <= 0:
				continue
			var b: float = Sim.GD[k].bulk
			var q := minf(minf(cand[c + 1], want), caravanCap(a) / b if b > 0 else 25.0)
			if q * Sim.GD[k].p < 15:
				continue
			q = minf(q, (a.cash - 60) / (pb * 1.15))
			if q * Sim.GD[k].p < 15:
				continue
			var cost: float = buyCost(M, k, q) * (1 + ECONK.dutyBuy)
			var gain: float = sellGain(D, k, q) * (1 - ECONK.dutySell) * 0.97
			var prof: float = gain - cost
			var sc: float = prof / days
			if prof > 12 and (best == null or sc > best.sc):
				best = {"D": D, "k": k, "q": q, "cost": cost, "gain": gain, "prof": prof, "sc": sc, "days": days}
	return best

## ближайший укреплённый рынок, где купцу рады (своей державы или дружественной)
static func safeSeat(a: Dictionary) -> int:
	var G := Sim.G
	var W := Sim.W
	var best := -1
	var bd := 1e9
	for S in G.setts:
		var w: Dictionary = W.setts[int(S.id)]
		if w.type == "village" or JS.t(S.siege) or S.ctrl >= 5 or (S.ctrl != a.realm and Sim.hostile(a.realm, S.ctrl)):
			continue
		var d := JS.hypot(w.x - a.x, w.y - a.y) * (0.8 if S.ctrl == a.realm else 1.0)
		if d < bd:
			bd = d
			best = int(S.id)
	return best

## день купца (aiCaravan): бегство от угроз, продажа по прибытии, новая поездка, поиски рынка
static func aiCaravan(a: Dictionary) -> void:
	var G := Sim.G
	var W := Sim.W
	var ECONK: Dictionary = Sim.ECONK
	var th := SimAI.threatsNear(a, 4)
	if th.size() > 0 and a.ai.task != "flee":
		var s0 := safeSeat(a)
		if s0 >= 0:
			SimAI.goTo(a, int(W.setts[s0].i), "flee")
		a.ai.t = 3.0
		return
	if JS.t(a.get("path")):
		return
	if a.ai.task == "flee":
		a.ai.task = "trade" if JS.t(a.get("cargo")) else "idle"
	var here := SimDay.settNear(a.x, a.y, 1.5)
	var H0: Variant = G.setts[here] if here >= 0 else null
	var hereSeat: bool = H0 != null and W.setts[here].type != "village"
	# прибыли: продать товар
	if JS.t(a.get("cargo")) and a.ai.to >= 0 and float(here) == a.ai.to:
		var D: Dictionary = G.setts[here]
		var gain := 0.0
		for k in a.cargo:
			var q: float = a.cargo[k]
			var g := sellGain(D, k, q)
			D.mk[k] = JS.n(D.mk.get(k)) + q
			gain += g
			stAdd(D, "imp", k, q)
		var duty: float = gain * ECONK.dutySell * (1.25 if D.ctrl == 0.0 and JS.t(G.get("court")) and SimDyn.hasTech("fairs") else 1.0)
		dutyTo(D.ctrl, duty)
		var net := gain * 0.97 - duty
		a.cash += net
		a.profit = JS.n(a.get("profit")) + net - JS.n(a.ai.get("cost"))
		a.trips = JS.n(a.get("trips")) + 1
		if D.ctrl == G.player.realm or a.realm == G.player.realm:
			var R1: Dictionary = G.realms[int(G.player.realm)]
			R1.tradeN = JS.n(R1.get("tradeN")) + 1
		if a.realm == G.player.realm:
			seeMarket(D)
		caravanNews(a, D)
		a.cargo = null
		a.ai.task = "idle"
		a.ai.from = float(here)
		a.ai.to = -1.0
		a.ai.t = 0.0
		if a.cash > 900: # богатая гильдия платит взносы дома
			var x: float = a.cash - 700
			a.cash = 700.0
			dutyTo(a.realm, x * 0.2)
	if not JS.t(a.get("cargo")) and a.cash < 50 and hereSeat:
		SimDay.destroyArmy(a, "разорились") # разорившийся купец: люди расходятся по домам
		return
	if a.ai.t > 0:
		a.ai.t -= 1
		return
	# на рынке: задумать следующую поездку
	if hereSeat and not JS.t(a.get("cargo")):
		var tr: Variant = planTrip(a, H0)
		if tr != null:
			var M: Dictionary = H0
			var k: String = tr.k
			var purse: float = a.cash - 60
			var q: float = tr.q
			var cost := buyCost(M, k, q)
			if cost * (1 + ECONK.dutyBuy) > purse:
				q *= purse / (cost * (1 + ECONK.dutyBuy)) * 0.95
				cost = buyCost(M, k, q)
			var wd: Dictionary = W.setts[int(tr.D.id)]
			var p: Variant = SimArmy.planPath(a, int(wd.i))
			if p == null or p.size() < 2 or p.size() > 40 + 2.2 * JS.hypot(wd.x - a.x, wd.y - a.y):
				# не дойти (другой остров): больше туда не ходить
				if not JS.t(a.get("bad")):
					a.bad = []
				a.bad.append(tr.D.id)
				if a.bad.size() > 12:
					a.bad.pop_front()
				a.ai.t = 1.0
				return
			var duty: float = cost * ECONK.dutyBuy
			M.mk[k] -= q
			a.cash -= cost + duty
			dutyTo(M.ctrl, duty)
			stAdd(M, "exp", k, q)
			a.cargo = {k: q}
			a.ai = {"task": "trade", "to": tr.D.id, "from": M.id, "t": 0.0, "k": k, "cost": cost + duty, "goal": float(wd.i)}
			SimArmy.setPath(a, p)
			SimDay.caravanSupply(a, M, p.size() / (float(Sim.T.BASE_SPEED) * 0.6) + 6) # хлеб в дорогу
			if a.realm == G.player.realm:
				seeMarket(M)
			caravanNews(a, M)
			return
		a.ai.idle = JS.n(a.ai.get("idle")) + 1
		a.ai.t = Sim.R.i(2, 4)
		if a.ai.idle < 3:
			return
	# здесь нечего везти (или не на рынке): искать в другом месте
	if JS.t(a.get("cargo")) and a.ai.to >= 0:
		if not SimAI.goTo(a, int(W.setts[int(a.ai.to)].i), "trade"):
			a.ai.lost = JS.n(a.ai.get("lost")) + 1
			if a.ai.lost > 3:
				a.cargo = null
				a.ai.to = -1.0
				a.ai.lost = 0.0
			a.ai.t = 2.0
		return
	var seatK := Sim.SEAT_K
	var L: Array = G.setts.filter(func(S):
		var t: String = W.setts[int(S.id)].type
		if t == "village" or JS.t(S.siege) or S.ctrl == 6.0 or S.id == float(here):
			return false
		if S.ctrl < 5 and a.realm < 5 and Sim.hostile(a.realm, S.ctrl):
			return false
		var w: Dictionary = W.setts[int(S.id)]
		return JS.hypot(w.x - a.x, w.y - a.y) < 55 * seatK)
	if L.size() > 0:
		var S2: Dictionary = Sim.R.pick(L)
		a.ai.idle = 0.0
		a.ai.task = "seek"
		SimAI.goTo(a, int(W.setts[int(S2.id)].i), "trade")
	else:
		a.ai.t = 5.0

## что достаётся победителю от разбитого обоза (золото за товар и кошель)
static func caravanLoot(la: Dictionary) -> float:
	var G := Sim.G
	var v := JS.n(la.get("cash")) * 0.6
	if JS.t(la.get("cargo")):
		for k in la.cargo:
			v += la.cargo[k] * Sim.GD[k].p * 0.5
	la.cash = 0.0
	la.cargo = null
	if not JS.t(G.get("robbed")):
		G.robbed = []
	var L: Array = G.robbed
	L.append({"d": G.day, "r": la.realm, "v": JS.rnd(v / 0.55), "x": JS.rnd(la.x), "y": JS.rnd(la.y)})
	if L.size() > 40:
		L.pop_front()
	return JS.rnd(v)

# ---------- казна ----------
static func provIncome(p: int) -> float:
	var P: Dictionary = Sim.G.provs[p]
	return JS.n(P.get("ecTax")) + JS.n(P.get("ecCraft"))

## что книги короны прибавляют к сборам (учёные, указы двора); ИИ — по сложности
static func crownK(r: float) -> float:
	var G := Sim.G
	var k := 1.0
	if r == 0.0 and G.has("court") and G.has("houses"):
		k = SimDyn.techIncK() * JS.o(G.court.get("incK"), 1.0) * JS.o(G.court.get("taxK"), 1.0)
	if r != G.player.realm:
		k *= 0.85 + 0.15 * G.diff
	return k

static func realmEconomy(r: int) -> void:
	var G := Sim.G
	var W := Sim.W
	var E := Sim.ECON
	if r >= 5:
		return
	var R0: Dictionary = G.realms[r]
	if E.incDay != G.day or E.inc == null:
		econDaily()
	var tax := 0.0
	var craft := 0.0
	var crown: bool = r == 0 and G.has("court") and G.has("houses")
	for p in W.provs.size():
		var seat: Dictionary = G.setts[W.provs[p].seat]
		if seat.ctrl != float(r):
			continue
		var Q: Dictionary = G.provs[p]
		if crown:
			var H0: Variant = G.houses[int(seat.house)] if JS.n(seat.get("house", -1.0)) >= 0 and seat.has("house") else null
			if H0 != null and H0.defiant > G.day:
				continue   # непокорный дом не платит
		tax += JS.n(Q.get("ecTax"))
		craft += JS.n(Q.get("ecCraft"))
	if E.inc != null and E.inc.size() > r:
		tax += E.inc[r].occ
	var duty := JS.n(R0.get("dutyAcc"))
	R0.dutyAcc = 0.0
	var k := crownK(r)
	tax *= k
	craft *= k
	duty *= SimDyn.techIncK() if crown else 1.0
	var inc := tax + craft + duty
	var exp := 0.0
	var trib := 0.0
	var tribOut := 0.0
	var ai: bool = float(r) != G.player.realm
	var ex := {"army": 0.0, "gar": 0.0, "spies": 0.0}
	for a in G.armies:
		if JS.t(a.alive) and a.realm == float(r) and (a.kind == "lord" or a.kind == "player"):
			ex.army += Sim.upkeepU(a.u) * (0.7 if ai else 1.0)
	for S in G.setts:
		if S.ctrl == float(r):
			ex.gar += Sim.upkeepU(S.gar) * 0.25
	for sp in G.spies:
		if float(r) == G.player.realm and sp.until >= G.day:
			ex.spies += 0.3
	exp = ex.army + ex.gar + ex.spies
	if JS.t(R0.get("tribute")):
		for tr in R0.tribute:
			if tr.until >= G.day:
				if tr.to == float(r):
					trib += tr.amt
				else:
					tribOut += tr.amt
	inc += trib
	exp += tribOut
	R0.inc = inc
	R0.exp = exp
	R0.gold += inc - exp
	R0.ec = {"tax": tax, "craft": craft, "duty": duty, "trib": trib, "army": ex.army, "gar": ex.gar, "spies": ex.spies, "tribOut": tribOut}
	if not R0.has("ec30"):
		R0.ec30 = {}
	for key in R0.ec:
		ema(R0.ec30, key, R0.ec[key], 1 / 30.0)
