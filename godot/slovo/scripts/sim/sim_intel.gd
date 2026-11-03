class_name SimIntel
## Обзор и разведка — перенос intel.js: что видят войска и поселения (G.vis), разведанные земли (G.explored),
## видимость чужих войск, оценка их числа, знаки (пыль, птицы, дым) и лазутчики.

const MW := WorldData.MW
const MH := WorldData.MH
const NT := WorldData.NT

static func visionOf(a: Dictionary) -> float:
	var t := Sim.armyTile(a)
	var T := Sim.W.ter[t]
	var r := 5.0
	if T == WorldData.HILLS:
		r += 3
	elif T == WorldData.MOUNT:
		r += 5
	elif T == WorldData.FOREST or T == WorldData.DFOREST:
		r -= 2
	r += minf(4.0, floorf((JS.n(a.u.get("horse")) + JS.n(a.u.get("harch"))) / 25.0))
	var g: Variant = Sim.charOf(a.gen)
	if g != null:
		r += Sim.traitSum(g, "scout")
	r *= float(Sim.weatherOf().vis)
	return maxf(2.0, r)

static func stampVis(cx: float, cy: float, r: float) -> void:
	var G := Sim.G
	var vis: PackedByteArray = G.vis
	var ex: PackedByteArray = G.explored
	G.vis = PackedByteArray()
	G.explored = PackedByteArray()
	var r2 := r * r
	var x0 := maxi(0, int(floorf(cx - r)))
	var x1 := mini(MW - 1, int(ceilf(cx + r)))
	var y0 := maxi(0, int(floorf(cy - r)))
	var y1 := mini(MH - 1, int(ceilf(cy + r)))
	for y in range(y0, y1 + 1):
		for x in range(x0, x1 + 1):
			var dx := x + 0.5 - cx
			var dy := y + 0.5 - cy
			if dx * dx + dy * dy <= r2:
				var i := y * MW + x
				vis[i] = 2
				if not ex[i]:
					ex[i] = 1
					Sim.fog_dirty = 1
	G.vis = vis
	G.explored = ex

static func computeVision() -> void:
	var G := Sim.G
	var W := Sim.W
	var vis: PackedByteArray = G.vis
	vis.fill(0)
	G.vis = vis
	var pr: float = G.player.realm
	for a in G.armies:
		if JS.t(a.alive) and a.realm == pr:
			stampVis(a.x, a.y, visionOf(a))
	for S in G.setts:
		if S.ctrl == pr:
			var ws: Dictionary = W.setts[int(S.id)]
			stampVis(ws.x + 0.5, ws.y + 0.5, 3.0 if ws.type == "village" else 5.0)
	for sp in G.spies:
		if sp.until < G.day:
			continue
		if sp.type == "local":
			var v2: PackedByteArray = G.vis
			var e2: PackedByteArray = G.explored
			G.vis = PackedByteArray()
			G.explored = PackedByteArray()
			var prov := W.prov
			var pv := int(sp.prov)
			for i in NT:
				if prov[i] == pv:
					v2[i] = 2
					if not e2[i]:
						e2[i] = 1
						Sim.fog_dirty = 1
			G.vis = v2
			G.explored = e2
		elif sp.type == "surviving" and sp.arrive <= G.day:
			stampVis(sp.x + 0.5, sp.y + 0.5, 7)
	Sim.fog_dirty = 1

static func hasInward(realm: float) -> bool:
	var G := Sim.G
	for s in G.spies:
		if s.type == "inward" and s.realm == realm and s.until >= G.day:
			return true
	return false

static func armyVisible(b: Dictionary) -> bool:
	var G := Sim.G
	if not JS.t(b.alive):
		return false
	if b.realm == G.player.realm:
		return true
	if hasInward(b.realm) and b.kind == "lord":
		return true
	var t := Sim.armyTile(b)
	if G.vis[t] != 2:
		return false
	if JS.t(b.hidden):
		var pa: Variant = Sim.playerArmy()
		if pa == null or JSM.hypot(pa.x - b.x, pa.y - b.y) > 2.5:
			return false
	return true

## {n, exact}: сколько воинов кажется в войске (своё — точно; чужое — с ошибкой по расстоянию, лазутчики её снижают)
static func estimateMen(b: Dictionary) -> Dictionary:
	var G := Sim.G
	var real := Sim.armyMen(b)
	if b.realm == G.player.realm:
		return {"n": real, "exact": 1}
	var pa: Variant = Sim.playerArmy()
	var d: float = JSM.hypot(pa.x - b.x, pa.y - b.y) if pa != null else 20.0
	var e: float = 0.0 if d < 1.6 else JS.clp(0.08 + d * 0.025, 0, 0.35)
	if hasInward(b.realm):
		e = minf(e, 0.06)
	var noise := (JSM.hash2(b.id, floorf(G.day / 4.0), 77) - 0.5) * 2 * e
	var n := real * (1 + noise) * (1.8 if JS.t(b.fires) else 1.0)
	if e > 0 or JS.t(b.fires):
		n = maxf(10.0, JS.rnd(n / 10) * 10)
	return {"n": JS.rnd(n), "exact": e == 0 and not JS.t(b.fires)}

static func updateSigns() -> void:
	var G := Sim.G
	var W := Sim.W
	Sim.SIGNS.clear()
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	var vr := visionOf(pa)
	for b in G.armies:
		if not JS.t(b.alive) or b.realm == G.player.realm or armyVisible(b):
			continue
		var d := JSM.hypot(b.x - pa.x, b.y - pa.y)
		if d > vr + 8:
			continue
		var ox := (JSM.hash2(b.id, G.day, 3) - 0.5) * 3
		var oy := (JSM.hash2(b.id, G.day, 4) - 0.5) * 3
		var T := W.ter[Sim.armyTile(b)]
		var moving: bool = b.path != null and b.path.size() > 1
		if moving:
			var cav := Sim.mountedN(b.u) > Sim.armyMen(b) * 0.4
			Sim.SIGNS.append({"k": "dust_hi" if cav else "dust_lo", "x": b.x + ox, "y": b.y + oy, "b": b.id})
		elif (T == WorldData.FOREST or T == WorldData.DFOREST) and (JS.t(b.hidden) or b.kind == "bandit"):
			Sim.SIGNS.append({"k": "birds", "x": b.x + ox, "y": b.y + oy, "b": b.id})
		elif not JS.t(b.hidden):
			Sim.SIGNS.append({"k": "smoke_many" if JS.t(b.fires) else "smoke", "x": b.x + ox, "y": b.y + oy, "b": b.id})
