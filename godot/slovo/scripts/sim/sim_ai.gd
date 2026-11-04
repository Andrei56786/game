class_name SimAI
## Замыслы держав и походы войск ИИ — перенос ai.js: сила держав (с обёртками belief.js), aiRealm (набор, новые войска,
## гарнизоны, война и мир), aiArmy (бегство, вода, погоня, отдых, снятие осад, цели войны, дозоры), разбойники, осады ИИ.
## Войска короны под рыцарями и дипломатия — SimCmd (command.js, diplo.js), вера и обман — SimBel (belief.js, deceit.js),
## купцы — SimEcon (econ.js). Обёртки HTML — внутри тех же функций и в том же порядке: aiRealm = belief(ai),
## aiArmy = deceit(ai), declareWar = deceit(reign(diplo)).

const MW := WorldData.MW
const MH := WorldData.MH
const NT := WorldData.NT
const GEN_TITLE := ["Сэр", "Хёвдинг", "Кондотьер", "Паладин", "Стратиг"]
const MIX := [{}, {"levy": 0.3, "spear": 0.2, "sword": 0.22, "archer": 0.18, "xbow": 0.04, "horse": 0.06},
	{"levy": 0.2, "spear": 0.28, "sword": 0.12, "archer": 0.08, "xbow": 0.22, "horse": 0.08, "knight": 0.02},
	{"levy": 0.3, "spear": 0.28, "sword": 0.12, "archer": 0.16, "horse": 0.06, "knight": 0.08},
	{"levy": 0.18, "spear": 0.26, "sword": 0.12, "archer": 0.14, "horse": 0.1, "harch": 0.12, "knight": 0.08}]
const GAR_BASE := {"village": 12.0, "castle": 70.0, "town": 80.0, "capital": 160.0}
const DIFF_K := [0.5, 1.0, 1.4]

# borderDist (army.js): расстояние по 4 соседям до земель державы = наименьшее манхэттенское до клеток её провинций
# (0…254, дальше и без земель — 255). Провинции — отрезками строк; провинция → клетка не меняется, держава → клетка —
# до смены владельцев столиц провинций (подпись bd_sig сверяется при каждом вызове).
static var bd_w: WorldData = null
static var prow: Array = []
static var pdc: Array = []
static var bd_sig := PackedFloat64Array()
static var bd_c := {}
static var ms_realm := 0.0               # замеры: мс на замыслы держав и походы ИИ за последний день
static var ms_army := 0.0


## число из d[k] по правилам арифметики JS: нет ключа (undefined) → NaN, null → 0
static func nv(d: Dictionary, k: String) -> float:
	var v: Variant = d.get(k, NAN)
	match typeof(v):
		TYPE_FLOAT:
			return v
		TYPE_INT:
			return float(v)
		TYPE_BOOL:
			return 1.0 if v else 0.0
		TYPE_NIL:
			return 0.0
	return NAN


## a.ai.t-- (нет ключа — NaN, как в JS)
static func _dec(d: Dictionary, k: String) -> void:
	d[k] = nv(d, k) - 1.0


## v === x для чисел (undefined и null — не равны ничему)
static func same(v: Variant, x: float) -> bool:
	return (typeof(v) == TYPE_FLOAT or typeof(v) == TYPE_INT) and v == x


static func _ge0(v: Variant) -> bool:
	return (typeof(v) == TYPE_FLOAT or typeof(v) == TYPE_INT) and v >= 0


static func bdPrep() -> void:
	var W := Sim.W
	if bd_w == W:
		return
	bd_w = W
	var np := W.provs.size()
	var segs := []
	for p in np:
		segs.append(PackedInt32Array())
	var pr := W.prov
	for y in MH:
		var x := 0
		var i0 := y * MW
		while x < MW:
			var p: int = pr[i0 + x]
			var x1 := x
			while x1 + 1 < MW and pr[i0 + x1 + 1] == p:
				x1 += 1
			if p >= 0:
				var s: PackedInt32Array = segs[p]
				s.append(y)
				s.append(x)
				s.append(x1)
				segs[p] = s
			x = x1 + 1
	prow = segs
	pdc = []
	for p in np:
		pdc.append({})
	bd_sig = PackedFloat64Array()
	bd_c = {}


static func pdist(p: int, t: int) -> int:
	var c: Dictionary = pdc[p]
	var v: Variant = c.get(t)
	if v != null:
		return v
	var segs: PackedInt32Array = prow[p]
	var x0 := t % MW
	var y0 := t / MW
	var best := 1 << 30
	var i := 0
	var n := segs.size()
	while i < n:
		var dy := absi(segs[i] - y0)
		if dy < best:
			var xa := segs[i + 1]
			var xb := segs[i + 2]
			var dx := (xa - x0) if x0 < xa else ((x0 - xb) if x0 > xb else 0)
			if dx + dy < best:
				best = dx + dy
		i += 3
	c[t] = best
	return best


static func bdist(realm: float, t: int) -> int:
	bdPrep()
	var G := Sim.G
	var W := Sim.W
	var np := W.provs.size()
	var same := bd_sig.size() == np
	if same:
		for p in np:
			if bd_sig[p] != G.setts[W.provs[p].seat].ctrl:
				same = false
				break
	if not same:
		bd_sig.resize(np)
		for p in np:
			bd_sig[p] = G.setts[W.provs[p].seat].ctrl
		bd_c = {}
	var c: Dictionary
	if bd_c.has(realm):
		c = bd_c[realm]
	else:
		c = {}
		bd_c[realm] = c
	var v: Variant = c.get(t)
	if v != null:
		return v
	var best := 255
	for p in np:
		if bd_sig[p] == realm:
			var d := pdist(p, t)
			if d < best:
				best = d
	if best > 254:
		best = 255
	c[t] = best
	return best


# ---------- сила держав и войск (ai.js, intel.js, belief.js) ----------
## realmPower с обёрткой belief.js: силу короны чужая держава знает лишь по своим донесениям
static func realmPower(r: float, by: Variant = null) -> float:
	var G := Sim.G
	if r == G.player.realm and by != null and by > 0 and by < 5 and by != r:
		return SimBel.belPower(by)
	var p := 0.0
	for a in G.armies:
		if JS.t(a.alive) and a.realm == r and (a.kind == "lord" or a.kind == "player"):
			p += perceivedPower(a, by) if by != null else SimDay.powerU(a.u, a.xp)
	for S in G.setts:
		if S.ctrl == r:
			p += SimDay.powerU(S.gar, null) * 0.4
	return p


## perceivedPower (intel.js) с обёрткой belief.js (притворное бегство короля)
static func perceivedPower(b: Dictionary, by: Variant) -> float:
	var G := Sim.G
	var p := SimDay.powerU(b.u, b.xp)
	if JS.t(b.get("fires")):
		p *= 1.8
	if b.realm == G.player.realm and by != null:
		for s in G.spies:
			if s.type == "converted" and s.realm == by and s.until >= G.day:
				p *= s.factor
				break
	if b.mode == "fort" and b.fortDays >= 2:
		p *= 1.3
	if nv(b, "feign") > G.day and b.realm == G.player.realm and (by == null or by != G.player.realm):
		return p * 0.6
	return p


## threatsNear с обёрткой belief.js: полководец чужой державы видит войска короны такими, какими их видели вчера
static func threatsNear(a: Dictionary, r: float) -> Array:
	var G := Sim.G
	var L := []
	for b in G.armies:
		if not JS.t(b.alive) or is_same(b, a) or not Sim.hostile(a.realm, b.realm) or b.kind == "caravan":
			continue
		var d := JS.hypot(b.x - a.x, b.y - a.y)
		if JS.t(b.hidden) and d > 2.5:
			continue
		if d <= r:
			L.append({"b": b, "d": d, "p": perceivedPower(b, a.realm)})
	if not (a.realm >= 1 and a.realm <= 4) or not JS.t(G.get("bel")) or not JS.t(G.bel.get(JS.s(a.realm))):
		return L
	var B: Dictionary = G.bel[JS.s(a.realm)]
	var pr: float = G.player.realm
	var g: Variant = Sim.charOf(a.gen)
	var out := []
	for x in L:
		var b: Dictionary = x.b
		if b.realm != pr or (b.kind != "lord" and b.kind != "player"):
			out.append(x)
			continue
		var e: Variant = B.a.get(JS.s(b.id))
		if e == null or G.day - e.day > 1 or e.src == "rumor":
			continue
		var p: float = e.p
		if nv(b, "feign") > G.day and SimBel.genSkept(g) > 0.5:
			p /= 0.6
		out.append({"b": b, "d": JS.hypot(e.x - a.x, e.y - a.y), "p": p})
	return out


## ближайшая из угроз (sort по d и [0]: при равенстве — первая)
static func _nearest(L: Array) -> Variant:
	var best: Variant = null
	for x in L:
		if best == null or x.d < best.d:
			best = x
	return best


static func nearestOwnSett(a: Dictionary, fortified: bool, food := false) -> int:
	var G := Sim.G
	var W := Sim.W
	var best := -1
	var bd := INF
	var men := maxf(1.0, Sim.armyMen(a))
	for S in G.setts:
		if S.ctrl != a.realm or JS.t(S.siege):
			continue
		var ws: Dictionary = W.setts[int(S.id)]
		if fortified and ws.type == "village":
			continue
		var d := JS.hypot(ws.x + 0.5 - a.x, ws.y + 0.5 - a.y)
		if food:
			d -= minf(10.0, JS.n(S.mk.get("food")) / men) * 2.5
		if d < bd:
			bd = d
			best = int(S.id)
	return best


## сколько полевых войск держит держава: по одному на ~4 провинции (2…5)
static func lordCap(r: int) -> float:
	var G := Sim.G
	var n := 0
	for P in Sim.W.provs:
		if G.setts[P.seat].ctrl == r:
			n += 1
	return JS.clp(JS.rnd(n / 4.0), 2, 5)


static func warScore(a: int, b: int) -> float:
	var G := Sim.G
	var W := Sim.W
	var s := JS.n(G.rel[a][b].get("bs"))
	for P in W.provs:
		var S: Dictionary = G.setts[P.seat]
		var val := 30.0 if W.setts[P.seat].type == "capital" else 12.0
		if S.owner == b and S.ctrl == a:
			s += val
		if S.owner == a and S.ctrl == b:
			s -= val
	return JS.clp(JS.rnd(s), -100, 100)


static func waterTileNear(t: int) -> int:
	var W := Sim.W
	var cur := t
	var k := 0
	while k < 60 and W.fwd[cur] > 2:
		var x := cur % MW
		var y := cur / MW
		var best := cur
		for v in SimDay.N8:
			var nx: int = x + v[0]
			var ny: int = y + v[1]
			if nx < 0 or ny < 0 or nx >= MW or ny >= MH:
				continue
			var j := ny * MW + nx
			if not JS.t(Sim.TINFO[W.ter[j]].get("water")) and W.fwd[j] < W.fwd[best]:
				best = j
		if best == cur:
			break
		cur = best
		k += 1
	return cur if W.fwd[cur] <= 2 else -1


static func goTo(a: Dictionary, tile: int, task: String) -> bool:
	var p: Variant = SimArmy.planPath(a, tile)
	if p != null and p.size() > 1:
		SimArmy.setPath(a, p)
		a.ai.task = task
		a.ai.goal = float(tile)
		return true
	return false


# ---------- замыслы держав (ai.js: aiRealm с обёрткой belief.js) ----------
## aiRealm(0) прежде всего — день веры и обмана: что державы видят, что знает корона, уловки
static func aiRealm(r: int) -> void:
	if r == 0:
		SimBel.belDaily()
		SimBel.knowDaily()
		SimBel.deceitDaily()
	_aiRealm(r)


## полководцы державы без войска (не в плену)
static func _freeGens(r: int, lords: Array) -> Array:
	var gens := []
	for c in Sim.G.chars:
		if c.realm == r and c.role == "general" and JS.t(c.alive) and not (nv(c, "prison") >= 0):
			var used := false
			for a in lords:
				if a.gen == c.id:
					used = true
					break
			if not used:
				gens.append(c)
	return gens


static func _aiRealm(r: int) -> void:
	var G := Sim.G
	var W := Sim.W
	var R0: Dictionary = G.realms[r]
	if r >= 5 or float(r) == G.player.realm or JS.t(R0.get("dead")):
		return
	var ruler: Dictionary = Sim.charOf(R0.ruler)
	var agg: float = Sim.traitSum(ruler, "agg") + (G.diff - 1) * 0.15
	var lords := []
	for a in G.armies:
		if JS.t(a.alive) and a.realm == r and a.kind == "lord":
			lords.append(a)
	# набор и пополнение (золото — с запасом на прокорм войск)
	var totMen := 0.0
	for a in lords:
		totMen += Sim.armyMen(a)
	var reserve := 150 + totMen * 0.8
	if R0.gold > reserve + 40:
		for a in lords:
			var sid := SimDay.settNear(a.x, a.y, 1.2)
			if sid < 0 or G.setts[sid].ctrl != r or Sim.armyMen(a) > 380 + G.day * 0.6 or a.food < Sim.armyMen(a) * 4:
				continue
			var S: Dictionary = G.setts[sid]
			for u in Sim.UT:
				var cu: float = Sim.UNIT[u].cost
				var n := floorf(minf(JS.n(S.pool.get(u)), (R0.gold - reserve) / cu))
				if n > 0:
					a.u[u] += n
					S.pool[u] -= n
					R0.gold -= n * cu
	# новое войско, если их мало
	var gens := _freeGens(r, lords)
	var cap := lordCap(r)
	if gens.is_empty() and lords.size() < cap and R0.gold > 400 and fmod(G.day + r, 10.0) == 0.0:
		Sim.mkChar(r, Sim.REALM_DEF[r].key, "general", Sim.R, {"title": GEN_TITLE[r]})
		R0.gold -= 60
		gens = _freeGens(r, lords)
	if not gens.is_empty() and lords.size() < cap and R0.gold > 250 + totMen * 1.0:
		var ci := int(R0.capital)
		var S: Variant = G.setts[ci] if ci >= 0 and ci < G.setts.size() else null
		if S != null and S.ctrl == r:
			var ws: Dictionary = W.setts[int(S.id)]
			var u := Sim.emptyU()
			var cost := 0.0
			var bud := minf(R0.gold - 120 - totMen * 1.0, 900 + G.day * 2)
			var mix: Dictionary = MIX[r]
			for t in Sim.UT:
				var cu: float = Sim.UNIT[t].cost
				var n := floorf(minf(minf(JS.n(S.pool.get(t)), 120.0), bud * JS.n(mix.get(t)) / cu))
				u[t] = n
				cost += n * cu
			if Sim.menOf(u) > 80 and cost < R0.gold:
				R0.gold -= cost
				for t in Sim.UT:
					S.pool[t] = nv(S.pool, t) - u[t]
				S.prosp = maxf(5.0, S.prosp - u.levy * 0.04)
				var a := Sim.mkArmy(r, "lord", gens[0].id, ws.x, ws.y, u)
				Sim.assign(a, {"food": Sim.menOf(u) * 8, "water": 3.0, "arrows": Sim.rangedN(u) * 30, "wagons": 2.0, "fodder": Sim.mountedN(u) * 5})
				a.ai = {"task": "idle", "t": 0.0}
	# экономия: в долгу часть ополчения уходит по домам, чтобы войска не голодали
	if R0.gold < 0:
		for a in lords:
			var cs := int(R0.capital)
			var capS: Variant = G.setts[cs] if cs >= 0 and cs < G.setts.size() else null
			for t in ["levy", "spear"]:
				var n := ceilf(JS.n(a.u.get(t)) * 0.08)
				if n > 0 and Sim.armyMen(a) - n > 40:
					a.u[t] -= n
					if capS != null:
						capS.pool[t] = JS.n(capS.pool.get(t)) + n * 0.7
		if R0.gold < -150:
			for S in G.setts:
				if S.ctrl == r and not JS.t(S.siege):
					var n := floorf(JS.n(S.gar.get("levy")) * 0.05)
					S.gar.levy -= n
	# гарнизоны
	for S in G.setts:
		if S.ctrl == r and R0.gold > 60 and not JS.t(S.siege):
			var base: float = GAR_BASE[W.setts[int(S.id)].type]
			if Sim.menOf(S.gar) < base * 0.7:
				var n := minf(4.0, floorf(JS.n(S.pool.get("levy"))))
				S.gar.levy += n
				S.pool.levy = nv(S.pool, "levy") - n
				R0.gold -= n * 2
	# война (раз в 9 дней, вразнобой)
	var rel: Array = G.rel[r]
	if fmod(G.day + r * 3, 9.0) == 0.0 and G.day > 30:
		var myWars := 0
		for t in G.realms.size():
			if t < 5 and t != r and JS.t(rel[t].get("war")):
				myWars += 1
		for tk in SimDay.neighbours(r).keys():
			var tf: float = tk
			if tf >= 5 or tf == r:
				continue
			var t := int(tf)
			var rl: Dictionary = rel[t]
			if JS.t(rl.get("war")) or nv(rl, "truce") > G.day or JS.t(rl.get("ally")) or nv(rl, "pact") > G.day:
				continue
			if myWars >= 1 and Sim.R.f() > 0.15:
				continue
			var opn: float = rl.opn
			var mp := realmPower(r)
			var tp := realmPower(tf, float(r))
			var ch: float = (0.2 if opn < -40 else (0.1 if opn < -15 else (0.03 if opn < 5 else 0.0))) * (1.6 if mp > tp * 1.4 else (0.9 if mp > tp * 1.1 else (0.45 if mp > tp * 0.9 else 0.06))) * (1 + agg)
			if ruler.traits.has("wrathful") and opn < -30:
				ch *= 1.5
			if tf == G.player.realm:
				var di := int(G.diff)
				ch *= DIFF_K[di] if di >= 0 and di < 3 and float(di) == G.diff else 1.0
			if G.day < 84 and tf == G.player.realm:
				ch *= 0.4
			if Sim.R.f() < ch:
				SimCmd.declareWar(r, tf)
				break
	# мир (раз в 7 дней)
	if fmod(G.day + r, 7.0) == 0.0:
		for t in 5:
			if t == r or not JS.t(rel[t].get("war")):
				continue
			var rl: Dictionary = rel[t]
			var dur: float = G.day - nv(rl, "since")
			if dur < 30:
				continue
			var ws := warScore(r, t)   # больше нуля — r побеждает
			if float(t) == G.player.realm:
				var asked := false
				for m in G.msgs:
					if m.kind == "peace" and same(m.get("from"), r):
						asked = true
						break
				if not asked and (ws < -30 or (dur > 70 and ws < 10 and Sim.R.f() < 0.3)):
					SimCmd.aiOfferPeace(r, t, ws)
			elif ws < -35 or ws > 45 or (dur > 90 and Sim.R.f() < 0.25):
				SimCmd.makePeace(r if ws >= 0 else t, t if ws >= 0 else r, absf(ws) > 35)
	# в мирное время — вольные земли
	var anyWar := false
	for t in G.realms.size():
		if t < 5 and t != r and JS.t(rel[t].get("war")):
			anyWar = true
			break
	R0.wantFree = not anyWar and G.day > 20


# ---------- походы войск (ai.js: aiArmy с обёрткой deceit.js) ----------
## посланные сторожить крепость (или в ложный марш) держат пост, а не ищут новых целей
static func aiArmy(a: Dictionary) -> void:
	var G := Sim.G
	var W := Sim.W
	var pr: float = G.player.realm
	if a.kind == "lord" and a.realm >= 1 and a.realm <= 4 and JS.t(a.get("ai")) and (JS.t(a.ai.get("guard")) or JS.t(a.ai.get("feint"))):
		var isG := JS.t(a.ai.get("guard"))
		var gd: Dictionary = a.ai.guard if isG else a.ai.feint
		var gs := int(gd.s)
		var S: Variant = G.setts[gs] if gs >= 0 and gs < G.setts.size() else null
		var ok: bool = gd.until >= G.day and S != null and (S.ctrl == a.realm if isG else (S.ctrl == pr and JS.t(G.rel[int(a.realm)][int(pr)].get("war"))))
		if ok and isG:
			var e: Variant = SimBel.belOf(a.realm).a.get(JS.s(gd.by))
			if not JS.t(e) or G.day - e.day > 4:
				ok = false
		if not ok:
			if JS.t(a.ai.get("feint")):
				a.fires = 0.0
			a.ai.guard = null
			a.ai.feint = null
		else:
			var isF := JS.t(a.ai.get("feint"))
			var task := "feint" if isF else "guard"
			var tv: Variant = gd.get("st") if isF else W.setts[gs].i
			var tile := -1
			var d := NAN
			if tv != null:
				tile = int(tv)
				d = JS.hypot(tile % MW + 0.5 - a.x, float(tile / MW) + 0.5 - a.y)
			if d > 2.2:
				# по пути к посту свернуть заставят лишь сильный враг рядом, жажда или голод
				var my := SimDay.powerU(a.u, a.xp)
				var danger := false
				for x in threatsNear(a, 4):
					if x.p > my * 1.25 and x.b.kind != "bandit":
						danger = true
						break
				if not danger and a.mode != "siege" and a.water >= 1 and a.food > Sim.armyMen(a) * 2:
					if (JS.t(a.get("path")) and a.ai.task == task) or goTo(a, tile, task):
						return
					a.ai.guard = null
					a.ai.feint = null
			else:
				a.ai.t = maxf(JS.n(a.ai.get("t")), 3.0)
	_aiArmy(a)


static func _aiArmy(a: Dictionary) -> void:
	var G := Sim.G
	var W := Sim.W
	if a.realm == G.player.realm and a.kind == "lord" and JS.t(G.get("court")):
		SimCmd.cmdArmyTick(a)
		return
	if not JS.t(a.get("ai")):
		a.ai = {"task": "idle", "t": 0.0}
	if a.kind == "bandit":
		aiBandit(a)
		return
	if a.kind == "caravan":
		SimEcon.aiCaravan(a)
		return
	if a.kind != "lord":
		return
	var men := Sim.armyMen(a)
	var my := SimDay.powerU(a.u, a.xp)
	var gen: Variant = Sim.charOf(a.gen)
	var agg: float = (Sim.traitSum(gen, "agg") if gen != null else 0.0) + 0.1 * (G.diff - 1)
	_dec(a.ai, "t")
	var th := threatsNear(a, 12)
	# бежать от много сильнейшего
	var big := false
	for x in th:
		if x.p > my * (1.25 + agg) and x.b.kind != "bandit":
			big = true
			break
	if big and a.mode != "siege":
		if a.ai.task != "flee":
			var s := nearestOwnSett(a, true)
			if s >= 0:
				goTo(a, int(W.setts[s].i), "flee")
		return
	# сначала жажда: к ближайшей воде
	if a.water < 1 and a.mode != "siege" and not SimDay.nearWater(Sim.armyTile(a)):
		if a.ai.task != "water" or not JS.t(a.get("path")):
			var w := waterTileNear(Sim.armyTile(a))
			if w >= 0 and goTo(a, w, "water"):
				return
		else:
			return
	# охота на слабейших (недостижимых и бесконечных погонь — бросить)
	if not JS.t(a.ai.get("skip")):
		a.ai.skip = {}
	var skip: Dictionary = a.ai.skip
	var lim := 11 * sqrt(Sim.SEAT_K)
	var cand := []
	for x in th:
		if x.p < my * (1.0 + agg * 0.5) and x.d < lim and not (nv(skip, JS.s(x.b.id)) > G.day):
			cand.append(x)
	var prey: Variant = _nearest(cand)
	if prey != null and a.food > men * 2 and a.morale > 40 and a.water >= 1:
		if not same(a.ai.get("prey"), prey.b.id):
			a.ai.prey = prey.b.id
			a.ai.h0 = G.day
			a.ai.t = 0.0
		if G.day - nv(a.ai, "h0") > 6:
			JS.oset(skip, JS.s(prey.b.id), G.day + 12)
			a.ai.prey = -1.0
		elif not JS.t(a.get("path")) or nv(a.ai, "t") <= 0:
			if not (a.mode == "siege" and prey.d > 3):
				if not goTo(a, Sim.armyTile(prey.b), "hunt") and prey.d > 1.5:
					JS.oset(skip, JS.s(prey.b.id), G.day + 12)
					a.ai.prey = -1.0
				a.ai.t = 1.0
		if _ge0(a.ai.get("prey")):
			return
	if a.mode == "siege":
		return
	# припасы и отдых
	if men < 70 or a.morale < 32 or a.food < men * 2.5 or a.fat > 85:
		if a.ai.task != "rest":
			var s := nearestOwnSett(a, true, a.food < men * 2.5)
			if s >= 0 and SimDay.settNear(a.x, a.y, 1.2) != s:
				goTo(a, int(W.setts[s].i), "rest")
			else:
				a.ai.task = "rest"
				a.ai.t = 6.0
		elif not JS.t(a.get("path")) and nv(a.ai, "t") <= 0:
			a.ai.task = "idle"
		return
	# снять осаду со своих: идти на осаждающего, если (с помощью гарнизона) его можно взять
	if a.ai.task != "relieve" or not JS.t(a.get("path")):
		var rel: Variant = null
		var rd := 1e9
		for S in G.setts:
			if not JS.t(S.siege) or S.ctrl != a.realm:
				continue
			var b: Variant = Sim.armyById(S.siege.by)
			if b == null or not JS.t(b.alive) or not Sim.hostile(a.realm, b.realm):
				continue
			var ws: Dictionary = W.setts[int(S.id)]
			var d := JS.hypot(ws.x - a.x, ws.y - a.y)
			if d > 60 * Sim.SEAT_K:
				continue
			if perceivedPower(b, a.realm) > (my + SimDay.powerU(S.gar, null) * 0.5) * (1.3 + agg):
				continue
			if d < rd:
				rd = d
				rel = b
		if rel != null and a.food > men * 3 and goTo(a, Sim.armyTile(rel), "relieve"):
			a.ai.prey = rel.id
			a.ai.t = 2.0
			return
	if JS.t(a.get("path")):
		return
	# приманка (обречённый лазутчик)
	var R0: Dictionary = G.realms[int(a.realm)]
	var dc: Variant = R0.get("decoy")
	if JS.t(dc) and dc.until > G.day:
		var seat := int(W.provs[int(dc.prov)].seat)
		if JS.hypot(W.setts[seat].x - a.x, W.setts[seat].y - a.y) > 2:
			goTo(a, int(W.setts[seat].i), "decoy")
			return
	# цели войны
	var enemies := []
	var rl: Array = G.rel[int(a.realm)]
	for t in 7:
		if float(t) != a.realm and t != 6 and (JS.t(rl[t].get("war")) or (t == 5 and JS.t(R0.get("wantFree")))):
			enemies.append(float(t))
	if enemies.size() > 0 and nv(a.ai, "t") <= 0:
		var best: Variant = null
		var bs := -INF
		for S in G.setts:
			if not enemies.has(S.ctrl) or JS.t(S.siege):
				continue
			var ws: Dictionary = W.setts[int(S.id)]
			if ws.type == "village":
				continue
			var d := JS.hypot(ws.x - a.x, ws.y - a.y)
			var gp: float = SimBel.garSeen(S, a.realm) * (1 + S.walls * 0.6)   # гарнизон, каким его видят (чучела на стенах)
			if gp > my * 1.6:
				continue
			var sc: float = -d * 0.8 - gp / maxf(1.0, my) * 30 - bdist(a.realm, int(ws.i)) * 1.5 + (12.0 if ws.type == "capital" else 0.0) + (25.0 if S.owner == a.realm else 0.0) + Sim.R.f() * 8
			if S.ctrl == 5.0:
				sc -= 10
			if sc > bs:
				bs = sc
				best = S
		if best != null and JS.hypot(W.setts[int(best.id)].x + 0.5 - a.x, W.setts[int(best.id)].y + 0.5 - a.y) < 1.5:
			a.ai.target = best.id
			aiArriveSett(a, int(best.id))
			a.ai.t = 3.0
			return
		if best != null:
			var ws: Dictionary = W.setts[int(best.id)]
			if goTo(a, int(ws.i), "siege"):
				a.ai.target = best.id
				a.onArrive = {"k": "siege", "s": best.id}
				a.ai.t = 3.0
				return
		a.ai.t = 3.0
	# дозоры в мирное время
	if nv(a.ai, "t") <= 0 and Sim.R.f() < 0.25:
		var own := []
		for S in G.setts:
			if S.ctrl == a.realm and W.setts[int(S.id)].type != "village":
				own.append(S)
		if own.size() > 0:
			var S: Dictionary = Sim.R.pick(own)
			goTo(a, int(W.setts[int(S.id)].i), "patrol")
			a.ai.t = 6.0


## войско ИИ дошло до вражеского поселения: деревню или пустую крепость берёт с ходу, иначе — осада
static func aiArriveSett(a: Dictionary, sid: int) -> void:
	var G := Sim.G
	var S: Dictionary = G.setts[sid]
	if JS.t(S.siege):
		return
	var ws: Dictionary = Sim.W.setts[sid]
	if ws.type == "village" or Sim.menOf(S.gar) == 0:
		var res := SimArmy.autoBattleGarrison(a, S)
		if JS.t(res.win):
			SimArmy.captureSett(a, S)
		return
	SimArmy.startSiege(a, sid)
	if S.ctrl == G.player.realm:
		Sim.glog(Sim.REALM_DEF[int(a.realm)].name + " " + SimDay.rV(int(a.realm), "осадила", "осадило", "осадили") + " " + ws.name + "!", "bad")


## осаждающий ИИ раз в 5 дней предлагает сдаться, при готовых работах и перевесе — штурм; без еды осаду снимает
static func aiSiegeDecision(a: Dictionary, S: Dictionary) -> void:
	var G := Sim.G
	var sg: Dictionary = S.siege
	if G.day - sg.asked >= 5:
		sg.asked = G.day
		if Sim.R.f() < SimArmy.surrenderChance(a, S):
			SimArmy.captureSett(a, S, "сдались")
			return
	if sg.works >= sg.need and SimDay.powerU(a.u, a.xp) > SimDay.powerU(S.gar, null) * (1.4 + S.walls * 0.25):
		var res := SimArmy.autoBattleGarrison(a, S, true)
		if JS.t(res.win):
			SimArmy.captureSett(a, S, "штурм")
		elif Sim.armyMen(a) < 60:
			SimDay.endSiege(a)
	if a.food < Sim.armyMen(a) * 1.5:
		SimDay.endSiege(a)


## разбойники: бегут от сильных, бьют слабых купцов и войска, грабят деревни у логова, возвращаются домой
static func aiBandit(a: Dictionary) -> void:
	var G := Sim.G
	var W := Sim.W
	var lx: float
	var ly: float
	var li := int(JS.n(a.get("lair", -1.0)))
	if a.has("lair") and li >= 0 and li < W.lairs.size() and float(li) == float(a.lair):
		var Lr: Array = W.lairs[li]
		lx = float(Lr[0])
		ly = float(Lr[1])
	else:
		lx = floorf(a.x)
		ly = floorf(a.y)
	var home := int(ly) * MW + int(lx)
	var my := SimDay.powerU(a.u, a.xp)
	var th := []
	for x in threatsNear(a, 6):
		if x.b.kind != "bandit":
			th.append(x)
	var big := false
	for x in th:
		if x.p > my * 1.1:
			big = true
			break
	if big:
		if a.ai.task != "flee":
			goTo(a, home, "flee")
		return
	var prey: Variant = null
	for x in th:
		if x.p < my * 0.75 and x.d < 4:
			prey = x
			break
	if prey != null and (prey.b.kind == "caravan" or prey.b.kind == "lord"):
		goTo(a, Sim.armyTile(prey.b), "hunt")
		return
	if JS.t(a.get("path")):
		return
	if Sim.R.f() < 0.18:
		var vs := []
		for S in G.setts:
			var ws: Dictionary = W.setts[int(S.id)]
			if ws.type == "village" and JS.hypot(ws.x - lx, ws.y - ly) < 16 * Sim.SEAT_K and G.day - nv(S, "lootDay") > 25:
				vs.append(S)
		if vs.size() > 0:
			var S: Dictionary = Sim.R.pick(vs)
			goTo(a, int(W.setts[int(S.id)].i), "raid")
			a.onArrive = {"k": "loot", "s": S.id}
			return
	if JS.hypot(a.x - lx - 0.5, a.y - ly - 0.5) > 3 and Sim.R.f() < 0.3:
		goTo(a, home, "home")


static func banditLoot(a: Dictionary, S: Dictionary) -> void:
	var G := Sim.G
	if SimDay.powerU(S.gar, null) > SimDay.powerU(a.u, a.xp) * 0.8:
		return
	S.lootDay = G.day
	S.prosp = maxf(10.0, S.prosp - 12)
	var p := int(Sim.W.setts[int(S.id)].prov)
	G.provs[p].dev = minf(0.9, G.provs[p].dev + 0.12)
	G.provs[p].unrest = minf(100.0, G.provs[p].unrest + 15)
	a.food += 300
	a.loot = JS.n(a.get("loot")) + 30
	SimArmy.takeU(S.gar, ceilf(Sim.menOf(S.gar) * 0.5))
	if S.ctrl == G.player.realm:
		Sim.glog("Разбойники разорили деревню " + Sim.W.setts[int(S.id)].name + ".", "bad")
