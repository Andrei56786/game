class_name SimAI
## НЕ ДОПИСАН (срез 0.6, WIP): готовы помощники, borderDist, сила держав и войск, угрозы, nearestOwnSett, lordCap,
## warScore, waterTileNear, goTo. Остальное — см. godot/slovo/WIP-0.6.md.
## Замыслы держав и походы войск ИИ — перенос ai.js (сила держав, aiRealm, aiArmy, разбойники), command.js (войска короны
## под рыцарями: cmdArmyTick, донесения), diplo.js (война и мир), belief.js («враг верит, а не знает»: что державы думают
## о войсках короны, призраки чужих войск), deceit.js (уловки и ответы на них) и купцов из econ.js. Обёртки HTML (belief,
## deceit, reign) — внутри тех же функций и в том же порядке: declareWar = deceit(reign(diplo)), aiArmy = deceit(ai)…

const MW := WorldData.MW
const MH := WorldData.MH
const NT := WorldData.NT
const BEL_AGE := 30.0
const KNOW_AGE := 24.0
const GEN_TITLE := ["Сэр", "Хёвдинг", "Кондотьер", "Паладин", "Стратиг"]
const MIX := [{}, {"levy": 0.3, "spear": 0.2, "sword": 0.22, "archer": 0.18, "xbow": 0.04, "horse": 0.06},
	{"levy": 0.2, "spear": 0.28, "sword": 0.12, "archer": 0.08, "xbow": 0.22, "horse": 0.08, "knight": 0.02},
	{"levy": 0.3, "spear": 0.28, "sword": 0.12, "archer": 0.16, "horse": 0.06, "knight": 0.08},
	{"levy": 0.18, "spear": 0.26, "sword": 0.12, "archer": 0.14, "horse": 0.1, "harch": 0.12, "knight": 0.08}]
const GAR_BASE := {"village": 12.0, "castle": 70.0, "town": 80.0, "capital": 160.0}
const DIFF_K := [0.5, 1.0, 1.4]
const NET_ERR := [0.35, 0.25, 0.15, 0.08]
# feintStage: углы 0, 0.5, −0.5, 1, −1 — значения Math.cos/Math.sin V8 (проверено в node)
const FCOS := [1.0, 0.8775825618903728, 0.8775825618903728, 0.5403023058681398, 0.5403023058681398]
const FSIN := [0.0, 0.479425538604203, -0.479425538604203, 0.8414709848078965, -0.8414709848078965]
const FRAD := [3.6, 3.0, 4.4]
const MERGE_K := ["food", "fodder", "arrows", "weap", "horses", "wagons", "pitch", "wounded", "sick"]

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
		return belPower(by)
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
		if nv(b, "feign") > G.day and genSkept(g) > 0.5:
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
