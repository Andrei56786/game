class_name SimCapt
## Воеводы (captains.js): каждый полк ведёт свой воевода — приказ полководца он превращает в приказы отрядам;
## ИИ полководца, бой без экрана, итоги боя для войск, гарнизонов и летописи. Поле, отряды и ход боя — в SimBattle.

const REGK := ["C", "R", "L", "V", "S"]


static func hyp(a: float, b: float) -> float:
	return SimBattle.hyp(a, b)


static func thinkInt(g: SimBattle.BReg) -> float:
	var c: Variant = SimBattle.cmdOk(g)
	var mar: float = c.mar if c != null else 2.0
	return (2.4 - mar * 0.1) * (1.0 if c != null else 1.6) * (0.85 + Sim.R.f() * 0.3)


static func capName(c: Dictionary) -> String:
	return (String(c.t) + " " if JS.t(c.get("t")) else "") + String(c.n)


static func calcStance(B: SimBattle.Bat, side: int) -> String:
	var F := B.F
	if F.siege:
		return "hold" if side == F.defSide else "attack"
	var V: PackedByteArray = B.vis[side]
	var gh: Array = B.ghost[side]
	var a := 0.0
	var b := 0.0
	for u: SimBattle.BU in B.units:
		if not (u.men > 0.5 and u.state != "gone"):
			continue
		var pw := u.men * (u.uatk + u.udef) * (0.1 if u.state == "rout" else 1.0)
		if u.side == side:
			a += pw
		elif V[u.id] or gh[u.id] != null:
			b += pw
	var st: Dictionary = B.sides[side]
	var agg := Sim.traitSum(st.gen, "agg") if st.get("gen") != null else 0.0
	return "attack" if (a / maxf(1, b)) * (1 + agg) > 0.95 or B.t > 70 else "hold"


static func _near(A: Array, Bs: Array, r: float) -> bool:
	for f: SimBattle.BU in A:
		for u: SimBattle.BU in Bs:
			if hyp(f.x - u.x, f.y - u.y) < r:
				return true
	return false


static func _avgX(L: Array) -> float:
	var s := 0.0
	for u: SimBattle.BU in L:
		s += u.x
	return s / L.size()


static func _avgY(L: Array) -> float:
	var s := 0.0
	for u: SimBattle.BU in L:
		s += u.y
	return s / L.size()


static func regThink(B: SimBattle.Bat, g: SimBattle.BReg) -> void:
	var side := g.side
	var us := B.units
	var mine := SimBattle.regUnits(B, side, g.k)
	if mine.is_empty():
		g.cur = g.order.k
		return
	var V: PackedByteArray = B.vis[side]
	var foes := []
	var routers := []
	for v: SimBattle.BU in us:
		if v.side != side and v.men > 0.5 and v.state != "gone" and V[v.id]:
			if v.state != "rout":
				foes.append(v)
			else:
				routers.append(v)
	var c: Variant = SimBattle.cmdOk(g)
	var mar: float = c.mar if c != null else 2.0
	var it := JS.clp(B.t - (B.t - 1.5 if g.lastT == null else float(g.lastT)), 0.2, 4)
	g.lastT = B.t
	for u: SimBattle.BU in mine:
		if u.contact.size():
			g.engT += it
			break
	var L0 := SimBattle.leadOf(B, g)
	if L0 == null:
		L0 = mine[0]
	var warn := "#ffb4a8" if side == 0 else "#f7d35c"
	var k: String = g.order.k
	# нрав: безрассудный может не удержать полк, трус — увести его из боя
	if c != null and not JS.t(c.get("gen")) and not B.F.siege and k == "hold" and SimBattle.hasTr(c, "reckless") and _near(foes, mine, 130) and Sim.R.f() < 0.12:
		g.order = {"k": "adv"}
		k = "adv"
		SimBattle.bsay(B, L0.x, L0.y - 30, capName(c) + " не удержал полк — в атаку!", warn)
	if c != null and not JS.t(c.get("gen")) and SimBattle.hasTr(c, "craven") and k != "back" and g.engT > 4:
		var sm := 0.0
		for u: SimBattle.BU in mine:
			sm += u.morale
		if sm / mine.size() < 38 and Sim.R.f() < 0.12:
			g.order = {"k": "back"}
			k = "back"
			SimBattle.bsay(B, L0.x, L0.y - 30, capName(c) + " дрогнул и отводит полк!", warn)
	if k == "wait":
		var hit := false
		for f: SimBattle.BU in foes:
			for u: SimBattle.BU in mine:
				if hyp(f.x - u.x, f.y - u.y) < (50.0 if u.hidden else 75.0):
					hit = true
					break
			if hit:
				break
		if hit:
			g.order = {"k": g.then if g.then != "" else "auto"}
			k = g.order.k
			SimBattle.bsay(B, L0.x, L0.y - 30, SimBattle.REGN[g.k] + " вступает в бой!", "#f7d35c" if side == 0 else "#ffb4a8")
	if k == "auto":
		k = autoK(B, g, mine, foes, routers)
	if k == "attack":
		var t := SimBattle._ui(B, g.order.get("t"))
		if t == null or not SimBattle.bAlive(t) or t.state == "rout" or (not V[t.id] and B.ghost[side][t.id] == null):
			g.order = {"k": "hold"}
			k = "hold"
			g.ax = _avgX(mine)
			g.ay = _avgY(mine)
	g.cur = k
	regAnchor(B, g, k, mine, foes, it)
	for u: SimBattle.BU in mine:
		if u.man or u.pend != null:
			continue
		autoForm(B, u, g, k, foes, mar)
		blockTac(B, u, g, k, foes, routers, mine, c)


static func autoK(B: SimBattle.Bat, g: SimBattle.BReg, mine: Array, foes: Array, routers: Array) -> String:
	var side := g.side
	var F := B.F
	var st: String = B.stance[side]
	var tpl: String = B.tpl[side]
	if F.siege:
		return "hold" if side == F.defSide else "adv"
	if g.k == "V":
		for u: SimBattle.BU in mine:
			if u.ranged and u.ammo > 0:
				return "skirm"
		return "reserve"
	if g.k == "S" and tpl != "wedge":
		# запас: бьёт того, кто обходит наш фланг, затыкает прорыв, гонит бегущих
		var threat: SimBattle.BU = null
		for f: SimBattle.BU in foes:
			for cc: SimBattle.BU in f.contact:
				if cc.side == side and absf(SimBattle.angDiff(atan2(f.y - cc.y, f.x - cc.x), cc.face)) > 1.05:
					threat = f
					break
			if threat != null:
				break
		if threat == null:
			for f: SimBattle.BU in foes:
				for u: SimBattle.BU in mine:
					if hyp(f.x - u.x, f.y - u.y) < 70:
						threat = f
						break
				if threat != null:
					break
		if threat == null:
			for f: SimBattle.BU in foes:
				for cc: SimBattle.BU in f.contact:
					if cc.side == side and (cc.morale < 32 or cc.men < cc.men0 * 0.35):
						threat = f
						break
				if threat != null:
					break
		if threat != null:
			g.tgt = threat.id
			return "strike"
		if routers.size() and routers.size() >= foes.size():
			return "pursue"
		return "adv" if st == "attack" and B.t > 110 else "reserve"
	if g.k == "R" or g.k == "L":
		var all := 0.0
		var ha := 0.0
		var mo := 0.0
		for u: SimBattle.BU in mine:
			all += u.men
		for u: SimBattle.BU in mine:
			if u.type == "harch":
				ha += u.men
		if ha > all * 0.5:
			return "flank"
		if st == "attack":
			if tpl == "cres":
				return "flank"
			for u: SimBattle.BU in mine:
				if u.mounted:
					mo += u.men
			if mo > all * 0.5:
				return "flank"
	if routers.size() and foes.is_empty():
		return "pursue"
	return "adv" if st == "attack" else "hold"


## «toward» из regAnchor: якорь полка идёт к точке (не дальше шага и не пока отряды отстали)
static func _toward(g: SimBattle.BReg, tx: float, ty: float, stop: float, turn: bool, lag: float, step: float) -> float:
	var a := atan2(ty - g.ay, tx - g.ax)
	var d := hyp(tx - g.ax, ty - g.ay)
	if turn:
		g.af += JS.clp(SimBattle.angDiff(a, g.af), -0.35, 0.35)
	var mv := 0.0 if lag > 28 else minf(maxf(0, d - stop), step * 1.05)
	g.ax += cos(a) * mv
	g.ay += sin(a) * mv
	return d


## якорь полка (середина его строя) идёт по приказу; отряды держат свои места относительно него
static func regAnchor(B: SimBattle.Bat, g: SimBattle.BReg, k: String, mine: Array, foes: Array, it: float) -> void:
	var side := g.side
	var dir := 1.0 if side == 0 else -1.0
	var BW := SimBattle.BW
	var BH := SimBattle.BH
	var vm := INF
	for u: SimBattle.BU in mine:
		vm = minf(vm, u.ust)
	g.vmin = vm * 0.9
	var step := g.vmin * it
	var lag := 99.0
	var nf := 0
	var ls := 0.0
	for u: SimBattle.BU in mine:
		if u.contact.is_empty() and not u.man and not u.ranged:
			var p := SimBattle.slotOf(g, u)
			ls += hyp(p[0] - u.x, p[1] - u.y)
			nf += 1
	if nf:
		lag = ls / nf
	var cx := _avgX(mine)
	var cy := _avgY(mine)
	if k == "move":
		var o: Dictionary = g.order
		g.ax = o.x
		g.ay = o.y
		if o.get("f") != null:
			g.af = o.f
		var every := true
		for u: SimBattle.BU in mine:
			var p := SimBattle.slotOf(g, u)
			if not (hyp(p[0] - u.x, p[1] - u.y) < 14 or u.contact.size()):
				every = false
				break
		if every:
			g.order = {"k": "hold"}
	elif k == "adv" or k == "pursue" or k == "attack" or k == "strike":
		var t: SimBattle.BU = SimBattle._ui(B, g.order.get("t")) if k == "attack" else (SimBattle._ui(B, g.tgt) if k == "strike" else null)
		if t == null or not SimBattle.bAlive(t):
			t = null
			var bd := 1e9
			for f: SimBattle.BU in foes:
				var d := hyp(f.x - g.ax, f.y - g.ay) + absf(SimBattle.angDiff(atan2(f.y - g.ay, f.x - g.ax), g.af)) * 40
				if d < bd:
					bd = d
					t = f
		if t != null:
			_toward(g, t.x, t.y, 24, true, lag, step)
		else:
			var gh: Variant = null
			var gd := 0.0
			for q: Variant in B.ghost[side]:
				if q == null:
					continue
				var d := hyp(q.x - g.ax, q.y - g.ay)
				if gh == null or d < gd:
					gh = q
					gd = d
			if gh != null:
				_toward(g, gh.x, gh.y, 20, true, lag, step)
			else:
				_toward(g, g.ax + dir * 200, g.ay, 0, true, lag, step)
	elif k == "flank":
		var s := -1.0 if g.k == "L" else (1.0 if g.k == "R" else signf((cy - BH / 2) * SimBattle.latS(side)))
		if s == 0.0 or is_nan(s):
			s = 1.0
		var ny := SimBattle.latS(side) * s
		var f: SimBattle.BU = null
		var bs := -1e9
		for v: SimBattle.BU in foes:
			var sc := (v.y - BH / 2) * ny - absf(v.x - cx) * 0.2
			if sc > bs:
				bs = sc
				f = v
		if f == null:
			_toward(g, g.ax + dir * 200, g.ay, 0, false, lag, step)
		else:
			if not g.fl:
				g.fl = 1
			if g.fl == 1:
				var Px := f.x - dir * 30
				var Py := JS.clp(f.y + ny * 85, 16, BH - 16)
				if absf(Py - f.y) < 40 or hyp(cx - Px, cy - Py) < 45:
					g.fl = 2
				else:
					_toward(g, Px, Py, 0, false, lag, step)
			if g.fl == 2:
				_toward(g, f.x, f.y, 24, true, lag, step)
	elif k == "back":
		if g.backTo == null:
			g.backTo = {"x": JS.clp(g.ax - dir * 90, 20, BW - 20), "y": g.ay}
		var a := atan2(g.backTo.y - g.ay, g.backTo.x - g.ax)
		var d := hyp(g.backTo.x - g.ax, g.backTo.y - g.ay)
		var mv := minf(d, step * 1.1)
		g.ax += cos(a) * mv
		g.ay += sin(a) * mv
		if d < 6:
			var quiet := true
			for u: SimBattle.BU in mine:
				if u.contact.size():
					quiet = false
					break
			if quiet:
				g.order = {"k": "hold"}
				g.backTo = null
	elif k == "reserve":
		var cu := SimBattle.regUnits(B, side, "C")
		if cu.size():
			var ccx := _avgX(cu)
			var ccy := _avgY(cu)
			g.ax += JS.clp(ccx - dir * (42.0 if g.k == "V" else 62.0) - g.ax, -step, step)
			g.ay += JS.clp(ccy - g.ay, -step, step)
			g.af = (B.regs[side].C as SimBattle.BReg).af
	g.ax = JS.clp(g.ax, 16, BW - 16)
	g.ay = JS.clp(g.ay, 16, BH - 16)


static func nearestOf(u: SimBattle.BU, L: Array, maxD := 0.0) -> SimBattle.BU:
	var best: SimBattle.BU = null
	var bd := maxD if maxD != 0.0 else 1e9
	for v: SimBattle.BU in L:
		var d := hyp(v.x - u.x, v.y - u.y)
		if d < bd:
			bd = d
			best = v
	return best


static func toSlot(B: SimBattle.Bat, u: SimBattle.BU, g: SimBattle.BReg, slot: Array, dis := false, coh := false) -> void:
	var x: float = slot[0]
	var y: float = slot[1]
	var d := hyp(x - u.x, y - u.y)
	if d > 5:
		SimBattle.cmd(B, u, {"k": "move", "x": JS.clp(x, 10, SimBattle.BW - 10), "y": JS.clp(y, 10, SimBattle.BH - 10), "f": g.af, "dis": 1 if dis else 0, "vmax": g.vmin if coh and d < 40 else 0.0})
	elif u.order == null:
		u.wantF = g.af


static func engageT(B: SimBattle.Bat, u: SimBattle.BU, g: SimBattle.BReg, foes: Array, er: float) -> SimBattle.BU:
	var best: SimBattle.BU = null
	var bd := 1e9
	for f: SimBattle.BU in foes:
		var d := hyp(f.x - u.x, f.y - u.y)
		if d > er:
			continue
		var a := absf(SimBattle.angDiff(atan2(f.y - u.y, f.x - u.x), g.af))
		if a > 1.25 and d > 36:
			continue
		var sc := d + (40.0 if a > 1.25 else 0.0) - (18.0 if u.type == "spear" and f.charger else 0.0) - (10.0 if f.contact.size() else 0.0)
		if sc < bd:
			bd = sc
			best = f
	return best


static func _fightOf(u: SimBattle.BU) -> SimBattle.BU:
	for e: SimBattle.BU in u.contact:
		if e.state != "rout":
			return e
	return null


static func blockTac(B: SimBattle.Bat, u: SimBattle.BU, g: SimBattle.BReg, k: String, foes: Array, routers: Array, mine: Array, c: Variant) -> void:
	var slot := SimBattle.slotOf(g, u)
	var fe := _fightOf(u)
	if fe != null:
		if u.charger:
			cavMelee(B, u)
		elif u.type == "harch" and k != "hold":
			harchFlee(B, u, fe)
		return
	if u.recover:
		if u.morale > 52 or u.contact.size():
			u.recover = false
		else:
			return
	if not u.ranged and k != "pursue" and k != "wait" and u.morale < 28 and u.men > u.men0 * 0.25:
		u.recover = true
		var dir := 1.0 if u.side == 0 else -1.0
		SimBattle.cmd(B, u, {"k": "move", "x": JS.clp(u.x - dir * 60, 15, SimBattle.BW - 15), "y": u.y, "dis": 1})
		return
	if u.type == "harch":
		harchTac(B, u, g, k, foes, routers, slot)
		return
	if u.ranged:
		shootTac(B, u, g, k, foes, slot)
		return
	if u.charger:
		cavTac(B, u, g, k, foes, routers, mine, slot, c)
		return
	footTac(B, u, g, k, foes, routers, slot, c)


static func footTac(B: SimBattle.Bat, u: SimBattle.BU, g: SimBattle.BReg, k: String, foes: Array, routers: Array, slot: Array, c: Variant) -> void:
	var mar: float = c.mar if c != null else 2.0
	if u.form == "square":
		for f: SimBattle.BU in foes:
			if f.charger and hyp(f.x - u.x, f.y - u.y) < 150:
				return
	if k == "back":
		toSlot(B, u, g, slot, true)
		return
	if k == "move" or k == "reserve":
		var e: SimBattle.BU = null
		for f: SimBattle.BU in foes:
			if hyp(f.x - u.x, f.y - u.y) < 30:
				e = f
				break
		if e != null:
			SimBattle.cmd(B, u, {"k": "attack", "t": e.id})
		else:
			toSlot(B, u, g, slot, false, k == "move")
		return
	if k == "pursue":
		var r := nearestOf(u, routers, 200)
		if r != null:
			SimBattle.cmd(B, u, {"k": "attack", "t": r.id, "pur": 1})
			return
	if k == "attack" or k == "strike":
		var T := SimBattle._ui(B, g.order.get("t") if k == "attack" else g.tgt)
		if T != null and SimBattle.bAlive(T) and T.state != "rout":
			var near := []
			for f: SimBattle.BU in foes:
				if hyp(f.x - T.x, f.y - T.y) < 60:
					near.append(f)
			var alt := nearestOf(u, near)
			var t := alt if alt != null and hyp(alt.x - u.x, alt.y - u.y) < hyp(T.x - u.x, T.y - u.y) - 15 else T
			SimBattle.cmd(B, u, {"k": "attack", "t": t.id})
			return
	if k == "wait":
		toSlot(B, u, g, slot)
		return
	var er := (60.0 if B.F.siege else 44.0) if k == "hold" or k == "skirm" else ((150.0 if g.fl == 2 else 30.0) if k == "flank" else (120.0 if k == "pursue" else 80.0))
	var leash := (70.0 if k == "hold" or k == "skirm" else 230.0) * (1.4 if SimBattle.hasTr(c, "reckless") else 1.0) * (1.3 if mar < 5 else 1.0)
	var t := engageT(B, u, g, foes, er)
	if t != null and hyp(slot[0] - t.x, slot[1] - t.y) < leash + er * 0.5:
		SimBattle.cmd(B, u, {"k": "attack", "t": t.id})
		return
	toSlot(B, u, g, slot, false, k == "adv" or k == "flank")


static func shootTac(B: SimBattle.Bat, u: SimBattle.BU, g: SimBattle.BReg, k: String, foes: Array, slot: Array) -> void:
	var side := u.side
	var dir := 1.0 if side == 0 else -1.0
	var BW := SimBattle.BW
	var BH := SimBattle.BH
	var rng := SimBattle.bRange(B, u)
	var H := u.type == "harch"
	if k == "wait" and u.hidden:
		return
	var threat: SimBattle.BU = null
	if k != "wait":
		var L := []
		for f: SimBattle.BU in foes:
			if not f.ranged and f.contact.is_empty():
				L.append(f)
		threat = nearestOf(u, L, 80.0 if H else 60.0)
	if threat != null:
		if H:
			var vx := u.x - threat.x
			var vy := u.y - threat.y
			var l := hyp(vx, vy)
			if not JS.t(l):
				l = 1.0
			vx = vx / l - dir * 0.5
			vy /= l
			var l2 := hyp(vx, vy)
			if not JS.t(l2):
				l2 = 1.0
			SimBattle.cmd(B, u, {"k": "move", "x": JS.clp(u.x + vx / l2 * 80, 12, BW - 12), "y": JS.clp(u.y + vy / l2 * 80, 12, BH - 12), "dis": 1})
			return
		var cl := []
		for v: SimBattle.BU in B.units:
			if v.side == side and SimBattle.bAlive(v) and v.state != "rout" and not v.ranged and v.morale > 30 and v.contact.is_empty():
				cl.append(v)
		var cover := nearestOf(u, cl)
		var bx := cover.x - dir * 34 if cover != null else u.x - dir * 60
		var by := cover.y + (10.0 if u.y > cover.y else -10.0) if cover != null else u.y
		SimBattle.cmd(B, u, {"k": "move", "x": JS.clp(bx, 12, BW - 12), "y": JS.clp(by, 12, BH - 12), "dis": 1})
		return
	if u.ammo <= 0:
		if k == "adv" or k == "pursue":
			var t: SimBattle.BU = null
			for f: SimBattle.BU in foes:
				if SimBattle._anySide(f.contact, side) and hyp(f.x - u.x, f.y - u.y) < 90:
					t = f
					break
			if t != null and u.morale > 40:
				SimBattle.cmd(B, u, {"k": "attack", "t": t.id})
				return
		var C: SimBattle.BReg = B.regs[side].C
		toSlot(B, u, g, [C.ax - dir * 44, JS.clp(u.y, 16, BH - 16)])
		return
	var inR := []
	for f: SimBattle.BU in foes:
		if hyp(f.x - u.x, f.y - u.y) < rng * 0.95:
			inR.append(f)
	if inR.size():
		var best: SimBattle.BU = null
		var bp := 0.0
		for f: SimBattle.BU in inR:
			var p := hyp(f.x - u.x, f.y - u.y) + (40.0 if f.contact.size() else 0.0) - (30.0 if u.type == "xbow" and (f.type == "knight" or f.type == "sword") else 0.0) - (15.0 if f.charger else 0.0)
			if best == null or p - bp < 0:
				best = f
				bp = p
		SimBattle.cmd(B, u, {"k": "attack", "t": best.id})
		return
	if k == "skirm" or k == "adv" or k == "flank" or k == "pursue" or k == "attack" or k == "strike":
		var T: SimBattle.BU = SimBattle._ui(B, g.order.get("t")) if k == "attack" else (SimBattle._ui(B, g.tgt) if k == "strike" else null)
		var tg := T if T != null and SimBattle.bAlive(T) else nearestOf(u, foes)
		if tg != null:
			var Cu := SimBattle.regUnits(B, side, "C")
			var front := u.x
			if Cu.size():
				front = -INF if dir > 0 else INF
				for v: SimBattle.BU in Cu:
					front = maxf(front, v.x) if dir > 0 else minf(front, v.x)
			var lim := front + dir * (90.0 if k == "skirm" else 400.0)
			var a := atan2(tg.y - u.y, tg.x - u.x)
			var dd := minf(hyp(tg.x - u.x, tg.y - u.y) - rng * 0.85, 60)
			var nx := u.x + cos(a) * dd
			var ny := u.y + sin(a) * dd
			if not H and dir * (nx - lim) > 0:
				nx = lim
			if absf(nx - u.x) + absf(ny - u.y) > 4:
				SimBattle.cmd(B, u, {"k": "move", "x": JS.clp(nx, 12, BW - 12), "y": JS.clp(ny, 12, BH - 12)})
				return
	toSlot(B, u, g, slot, false, k == "adv")


static func _cl(x: float, y: float) -> Array:
	return [JS.clp(x, 14, SimBattle.BW - 14), JS.clp(y, 14, SimBattle.BH - 14)]


## точка стрельбы конного лучника по цели f: сбоку-сзади, на трёх четвертях выстрела
static func _fire(u: SimBattle.BU, f: SimBattle.BU, rng: float) -> Array:
	var s := signf(SimBattle.angDiff(atan2(u.y - f.y, u.x - f.x), f.face))
	if s == 0.0 or is_nan(s):
		s = 1.0 if u.y > f.y else -1.0
	var a := f.face + s * (PI / 2 + 0.72)
	var r := rng * 0.78
	return _cl(f.x + cos(a) * r, f.y + sin(a) * r)


static func _hscore(u: SimBattle.BU, f: SimBattle.BU, rng: float, cav: Array) -> float:
	if f.charger:
		return 1e9
	var s := hyp(f.x - u.x, f.y - u.y) * 0.6
	if SimBattle._anySide(f.contact, u.side):
		s -= 130
	if f.ranged:
		s += 40.0 if f.type == "harch" else 95.0
	var p := _fire(u, f, rng)
	for c: SimBattle.BU in cav:
		if hyp(c.x - p[0], c.y - p[1]) < 115:
			s += 140
			break
	return s


## конные лучники не рубятся: обходят фланг, бьют в бок и тыл строя и отскакивают от всякого, кто к ним идёт
static func harchTac(B: SimBattle.Bat, u: SimBattle.BU, g: SimBattle.BReg, k: String, foes: Array, routers: Array, slot: Array) -> void:
	var side := u.side
	var dir := 1.0 if side == 0 else -1.0
	var rng := SimBattle.bRange(B, u)
	if k == "wait":
		if not u.hidden:
			toSlot(B, u, g, slot)
		return
	if k == "back" or k == "move":
		toSlot(B, u, g, slot, k == "back")
		return
	# 1. опасность: всадники или свободная пехота близко — отскок, чуть к своим, вдоль края поля
	var L := []
	for f: SimBattle.BU in foes:
		if f.contact.is_empty() and not f.ranged and hyp(f.x - u.x, f.y - u.y) < (125.0 if f.charger else 88.0):
			L.append(f)
	var thr := nearestOf(u, L)
	if thr != null:
		harchFlee(B, u, thr)
		return
	# 2. колчаны пусты: рубить бегущих или уйти за строй
	if u.ammo <= 0:
		var r: SimBattle.BU = nearestOf(u, routers, 220) if k == "pursue" or k == "adv" else null
		if r != null:
			SimBattle.cmd(B, u, {"k": "attack", "t": r.id, "pur": 1})
			return
		var C: SimBattle.BReg = B.regs[side].C
		toSlot(B, u, g, [C.ax - dir * 50, JS.clp(slot[1], 16, SimBattle.BH - 16)])
		return
	var inR := []
	for f: SimBattle.BU in foes:
		if hyp(f.x - u.x, f.y - u.y) < rng * 0.95:
			inR.append(f)
	# 3. стоят: бьют всё, что подойдёт на выстрел
	if k == "hold" or k == "reserve":
		if inR.size():
			var t: SimBattle.BU = inR[0]
			for i in range(1, inR.size()):
				var a: SimBattle.BU = inR[i]
				if hyp(a.x - u.x, a.y - u.y) + (30.0 if a.ranged else 0.0) - hyp(t.x - u.x, t.y - u.y) - (30.0 if t.ranged else 0.0) < 0:
					t = a
			SimBattle.cmd(B, u, {"k": "attack", "t": t.id})
		else:
			toSlot(B, u, g, slot)
		return
	if foes.is_empty():
		if k == "pursue":
			var r := nearestOf(u, routers, 300)
			if r != null:
				SimBattle.cmd(B, u, {"k": "attack", "t": r.id, "pur": 1})
				return
		toSlot(B, u, g, slot)
		return
	# 4. цель: сперва связанная боем пехота (не догонит), никогда — копья; держаться подальше от вражеской конницы
	var minY := INF
	var maxY := -INF
	var cav := []
	for f: SimBattle.BU in foes:
		minY = minf(minY, f.y)
		maxY = maxf(maxY, f.y)
		if f.charger and f.contact.is_empty():
			cav.append(f)
	var T0: SimBattle.BU = SimBattle._ui(B, g.order.get("t")) if k == "attack" else (SimBattle._ui(B, g.tgt) if k == "strike" else null)
	var t: SimBattle.BU = null
	if T0 != null and SimBattle.bAlive(T0) and T0.state != "rout" and not T0.charger:
		t = T0
	else:
		var bs := 0.0
		for f: SimBattle.BU in foes:
			var sc := _hscore(u, f, rng, cav)
			if t == null or sc - bs < 0:
				t = f
				bs = sc
	if t == null or _hscore(u, t, rng, cav) >= 1e9:
		if inR.size():
			SimBattle.cmd(B, u, {"k": "attack", "t": (inR[0] as SimBattle.BU).id})
		else:
			toSlot(B, u, g, slot)
		return
	var P := _fire(u, t, rng)
	var relU := absf(SimBattle.angDiff(atan2(u.y - t.y, u.x - t.x), t.face))
	# у фланга или тыла и на выстреле: стоять и стрелять
	if hyp(t.x - u.x, t.y - u.y) < rng * 0.92 and (relU > 1.15 or hyp(P[0] - u.x, P[1] - u.y) < 22):
		SimBattle.cmd(B, u, {"k": "attack", "t": t.id})
		return
	# путь к месту стрельбы загорожен врагом: объехать край его строя
	var sx: float = P[0] - u.x
	var sy: float = P[1] - u.y
	var sl := hyp(sx, sy)
	if not JS.t(sl):
		sl = 1.0
	var barred := false
	for f: SimBattle.BU in foes:
		var q := JS.clp(((f.x - u.x) * sx + (f.y - u.y) * sy) / (sl * sl), 0, 1)
		if hyp(u.x + sx * q - f.x, u.y + sy * q - f.y) < 52 and f != t:
			barred = true
			break
	if barred:
		var lat := 1.0 if P[1] >= t.y else -1.0
		var wy := maxY + 78 if lat > 0 else minY - 78
		if wy > 14 and wy < SimBattle.BH - 14:
			var p := _cl(t.x - dir * 15, wy)
			SimBattle.cmd(B, u, {"k": "move", "x": p[0], "y": p[1], "dis": 0})
			return
	var p2 := _cl(P[0], P[1])
	SimBattle.cmd(B, u, {"k": "move", "x": p2[0], "y": p2[1], "dis": 0})


static func harchFlee(B: SimBattle.Bat, u: SimBattle.BU, thr: SimBattle.BU) -> void:
	var dir := 1.0 if u.side == 0 else -1.0
	var dd := hyp(u.x - thr.x, u.y - thr.y)
	if not JS.t(dd):
		dd = 1.0
	var vx := (u.x - thr.x) / dd - dir * 0.45
	var vy := (u.y - thr.y) / dd
	var l := hyp(vx, vy)
	if not JS.t(l):
		l = 1.0
	vx /= l
	vy /= l
	var p := _cl(u.x + vx * 85, u.y + vy * 85)
	if hyp(p[0] - u.x, p[1] - u.y) < 35:
		var up := u.y < SimBattle.BH / 2
		p = _cl(u.x - vy * 85 * (-1.0 if up else 1.0), u.y + absf(vx) * 85 * (1.0 if up else -1.0))
	SimBattle.cmd(B, u, {"k": "move", "x": p[0], "y": p[1], "dis": 1})
	u.harT = B.t


## круговой удар: после нескольких секунд вязкой рубки всадники выходят и бьют снова
static func cavMelee(B: SimBattle.Bat, u: SimBattle.BU) -> void:
	var dir := 1.0 if u.side == 0 else -1.0
	var e := _fightOf(u)
	if e == null:
		return
	u.meleeT = u.meleeT + 1.5
	if u.meleeT > (7.0 if u.type == "knight" else 4.5) and e.morale > 25 and u.morale > 25:
		u.meleeT = 0
		u.recoil = B.t + 2.5
		var a := atan2(u.y - e.y, u.x - e.x)
		SimBattle.cmd(B, u, {"k": "move", "x": JS.clp(u.x + cos(a) * 55 - dir * 15, 12, SimBattle.BW - 12), "y": JS.clp(u.y + sin(a) * 55, 12, SimBattle.BH - 12), "dis": 1})


## вес стрельбы, что достанет до точки (кроме самой цели), на человека отряда — воевода не поведёт конницу под ливень болтов, пока строи не сошлись
static func fireOn(B: SimBattle.Bat, u: SimBattle.BU, x: float, y: float, foes: Array, skip: SimBattle.BU = null) -> float:
	var s := 0.0
	var arm: Array = SimBattle.ARM[u.type]
	for f: SimBattle.BU in foes:
		if f == skip or not f.ranged or f.ammo <= 0 or f.contact.size() or f.form == "column":
			continue
		if hyp(f.x - x, f.y - y) < SimBattle.bRange(B, f) + 20:
			var S: Dictionary = SimBattle.SHOT[f.type]
			s += f.men * S.hit * S.vol / f.ucd * arm[1 if f.type == "xbow" else 0]
	return s / maxf(10, u.men)


## прямой путь к (tx,ty) загорожен другими отрядами врага: точка в обход края его строя; null — путь свободен, false — обхода нет
static func detourPt(B: SimBattle.Bat, u: SimBattle.BU, tx: float, ty: float, foes: Array, t: SimBattle.BU) -> Variant:
	var sx := tx - u.x
	var sy := ty - u.y
	var sl2 := sx * sx + sy * sy
	if not JS.t(sl2):
		sl2 = 1.0
	var dir := 1.0 if u.side == 0 else -1.0
	var barred := false
	for f: SimBattle.BU in foes:
		if f == t or (t != null and t.contact.has(f)):
			continue
		var q := ((f.x - u.x) * sx + (f.y - u.y) * sy) / sl2
		if q <= 0.05 or q >= 0.97:
			continue
		if hyp(u.x + sx * q - f.x, u.y + sy * q - f.y) < SimBattle.bRad(f) + SimBattle.bRad(u) + 6:
			barred = true
			break
	if not barred:
		return null
	var lo := INF
	var hi := -INF
	for f: SimBattle.BU in foes:
		lo = minf(lo, f.y)
		hi = maxf(hi, f.y)
	lo -= 70
	hi += 70
	var BH := SimBattle.BH
	var cand := []
	for y: float in [lo, hi]:
		if y > 14 and y < BH - 14:
			cand.append(y)
	if cand.is_empty():
		return false
	var c0: float = cand[0]
	if cand.size() == 2:
		var a: float = cand[1]
		var b: float = cand[0]
		if absf(a - u.y) + absf(a - ty) * 0.5 - absf(b - u.y) - absf(b - ty) * 0.5 < 0:
			c0 = a
	return [JS.clp(tx - dir * 20, 12, SimBattle.BW - 12), c0]


static func _byD(u: SimBattle.BU, L: Array) -> SimBattle.BU:
	var best: SimBattle.BU = null
	var bd := 0.0
	for v: SimBattle.BU in L:
		var d := hyp(v.x - u.x, v.y - u.y)
		if best == null or d - bd < 0:
			best = v
			bd = d
	return best


static func _prot(f: SimBattle.BU, foes: Array) -> bool:
	for h: SimBattle.BU in foes:
		if h != f and (h.type == "spear" or h.type == "sword" or h.type == "knight") and hyp(f.x - h.x, f.y - h.y) < 42:
			return true
	return false


static func _frontal(u: SimBattle.BU, t: SimBattle.BU) -> bool:
	return t.form == "square" or absf(SimBattle.angDiff(atan2(u.y - t.y, u.x - t.x), t.face)) < 1.0


static func cavTac(B: SimBattle.Bat, u: SimBattle.BU, g: SimBattle.BReg, k: String, foes: Array, routers: Array, mine: Array, slot: Array, c: Variant) -> void:
	var side := u.side
	var dir := 1.0 if side == 0 else -1.0
	var BW := SimBattle.BW
	var BH := SimBattle.BH
	if k == "wait":
		toSlot(B, u, g, slot)
		return
	u.meleeT = 0
	if u.recoil != 0.0 and B.t < u.recoil:
		return
	if k == "back" or k == "move" or (k == "flank" and g.fl != 2):
		toSlot(B, u, g, slot, k == "back", k != "back")
		return
	# отряд уже на скаку держится своей цели
	if u.order != null and u.order.k == "attack" and u.ch > 0.2:
		var T := SimBattle._ui(B, u.order.get("t"))
		if T != null and SimBattle.bAlive(T) and T.state != "rout" and hyp(T.x - u.x, T.y - u.y) < 80:
			return
	var rk := SimBattle.hasTr(c, "reckless")
	var leash := (100.0 if k == "hold" or k == "reserve" else 300.0) * (1.3 if rk else 1.0)
	# сколько огня стерпит воевода: больше, когда строи сошлись, больше — безрассудный; ничего этого, когда цель назвал сам король
	var engF := 0.0
	if foes.size():
		var ne := 0
		for f: SimBattle.BU in foes:
			if SimBattle._anySide(f.contact, side):
				ne += 1
		engF = float(ne) / foes.size()
	var Z := (1.2 if engF > 0.3 else 0.3) * (1.5 if rk else 1.0) * (0.8 if SimBattle.hasTr(c, "cautious") else 1.0)
	var hold := k == "hold" or k == "reserve"
	var t: SimBattle.BU = null
	if k == "attack":
		var T := SimBattle._ui(B, g.order.get("t"))
		if T != null and SimBattle.bAlive(T) and B.vis[side][T.id]:
			t = T
	if k == "strike":
		var T := SimBattle._ui(B, g.tgt)
		if T != null and SimBattle.bAlive(T) and B.vis[side][T.id] and T.form != "square" and not (T.type == "spear" and _frontal(u, T) and T.contact.is_empty()):
			t = T
	if t == null and k == "pursue" and routers.size():
		var r := _byD(u, routers)
		if hyp(r.x - u.x, r.y - u.y) < 300:
			t = r
	if t == null:
		var L := []
		for f: SimBattle.BU in foes:
			if f.ranged and not _prot(f, foes) and hyp(f.x - slot[0], f.y - slot[1]) < leash and fireOn(B, u, f.x, f.y, foes, f) < Z:
				L.append(f)
		var a0 := _byD(u, L)
		if a0 != null and (not hold or hyp(a0.x - u.x, a0.y - u.y) < 90):
			t = a0
	if t == null and not hold:
		var L := []
		for f: SimBattle.BU in foes:
			if SimBattle._anySide(f.contact, side) and not (f.type == "spear" and _frontal(u, f)) and f.form != "square" and hyp(f.x - slot[0], f.y - slot[1]) < leash and fireOn(B, u, f.x, f.y, foes, f) < Z * 1.4:
				L.append(f)
		var e0 := _byD(u, L)
		if e0 != null and hyp(e0.x - u.x, e0.y - u.y) < 240:
			t = e0
	if t == null:
		var shooters := mine.duplicate()
		for v: SimBattle.BU in B.units:
			if v.side == side and v.ranged and SimBattle.bAlive(v):
				shooters.append(v)
		var L := []
		for f: SimBattle.BU in foes:
			if not f.mounted:
				continue
			var raid := false
			for m: SimBattle.BU in shooters:
				if m.ranged and hyp(m.x - f.x, m.y - f.y) < 90:
					raid = true
					break
			if raid and hyp(f.x - slot[0], f.y - slot[1]) < leash:
				L.append(f)
		var r0 := _byD(u, L)
		if r0 != null:
			t = r0
	if t == null and routers.size() and not hold:
		var r := _byD(u, routers)
		if hyp(r.x - u.x, r.y - u.y) < 150:
			t = r
	if t == null and (k == "adv" or k == "flank"):
		var L := []
		for f: SimBattle.BU in foes:
			if f.type != "spear" and f.form != "square" and hyp(f.x - slot[0], f.y - slot[1]) < leash and fireOn(B, u, f.x, f.y, foes, f) < Z:
				L.append(f)
		t = _byD(u, L)
	if t == null and hold:
		var L := []
		for f: SimBattle.BU in foes:
			if hyp(f.x - u.x, f.y - u.y) < 70 and f.type != "spear" and f.form != "square":
				L.append(f)
		t = _byD(u, L)
	# под стрелами: рубить стрелков, если их никто не прикрывает, иначе отойти на время за выстрел
	if t == null and JS.t(u.lastArr) and B.t - u.lastArr < 2.5:
		var L := []
		for f: SimBattle.BU in foes:
			if f.ranged and hyp(f.x - u.x, f.y - u.y) < SimBattle.bRange(B, f) + 25:
				L.append(f)
		var s0 := _byD(u, L)
		if s0 != null and not _prot(s0, foes) and hyp(s0.x - u.x, s0.y - u.y) < 230 and fireOn(B, u, s0.x, s0.y, foes, s0) < Z * 1.3:
			t = s0
		else:
			u.shy = B.t + (9.0 if hold else 6.0)
	if t == null:
		var sv: Array = [slot[0] - dir * 75, slot[1]] if u.shy != 0.0 and B.t < u.shy else slot
		# место в строю под вражескими луками: ждать чуть дальше их выстрела
		if not hold and fireOn(B, u, sv[0], sv[1], foes) > Z:
			var px := u.x
			var py := u.y
			var i := 0
			while i < 6 and fireOn(B, u, px, py, foes) > Z * 0.8:
				px = px - dir * 30
				i += 1
			sv = [JS.clp(px, 14, BW - 14), py]
		toSlot(B, u, g, sv, false, k == "adv")
		return
	var d := hyp(t.x - u.x, t.y - u.y)
	var rx := t.x - cos(t.face) * 42
	var ry := t.y - sin(t.face) * 42
	# объехать край вражеского строя, а не ломиться сквозь него
	if t.state != "rout" and d > 60 and k != "attack":
		var w: Variant = detourPt(B, u, t.x, t.y, foes, t)
		if w is Array:
			SimBattle.cmd(B, u, {"k": "move", "x": w[0], "y": w[1]})
			return
		if w is bool and w == false and t.ranged:
			toSlot(B, u, g, slot)
			return
	if t.state != "rout" and d > 70 and _frontal(u, t) and (t.contact.size() or t.type == "spear") and hyp(u.x - rx, u.y - ry) > 30:
		SimBattle.cmd(B, u, {"k": "move", "x": JS.clp(rx, 12, BW - 12), "y": JS.clp(ry, 12, BH - 12)})
	else:
		SimBattle.cmd(B, u, {"k": "attack", "t": t.id, "pur": 1 if t.state == "rout" else 0})


## строй для отрядов, которым игрок его не задал; умелый воевода откликается раньше
static func autoForm(B: SimBattle.Bat, u: SimBattle.BU, g: SimBattle.BReg, k: String, foes: Array, mar: float) -> void:
	if u.formLock or u.formTo != "" or u.state == "rout":
		return
	if Sim.R.f() > 0.35 + mar * 0.045:
		return
	var T := u.type
	var cav := false
	var melee := false
	var nearF := false
	var farR := 220.0 if u.mounted else 170.0
	for f: SimBattle.BU in foes:
		var d := hyp(f.x - u.x, f.y - u.y)
		if f.charger and d < 110 and f.contact.is_empty():
			cav = true
		if not f.ranged and d < 70:
			melee = true
		if d < farR:
			nearF = true
	var arrows := B.t - u.lastArr < 4
	var far := u.contact.is_empty() and not nearF
	var holdish := k == "hold" or k == "wait" or k == "skirm" or k == "reserve"
	var march: bool = far and not holdish and u.order != null and u.order.k == "move" and hyp(u.order.x - u.x, u.order.y - u.y) > 60
	var want := "line"
	if march:
		want = "column"
	elif T == "spear":
		want = "square" if cav and u.contact.is_empty() else ("close" if holdish and not far else "line")
	elif T == "levy":
		want = "square" if cav and u.contact.is_empty() and holdish else ("loose" if arrows and not melee else "line")
	elif T == "sword":
		want = "close" if (holdish and not far) or (arrows and not melee) else "line"
	elif T == "archer":
		want = "loose" if arrows else "line"
	elif T == "xbow":
		want = "close" if arrows and not melee else "line"
	elif T == "harch":
		want = "loose"
	elif T == "knight":
		want = "wedge" if u.order != null and u.order.k == "attack" else "line"
	elif T == "horse":
		var t: SimBattle.BU = SimBattle._ui(B, u.order.get("t")) if u.order != null and u.order.k == "attack" else null
		want = "wedge" if t != null and not t.mounted else "line"
	if u.form == "square" and want != "square":
		for f: SimBattle.BU in foes:
			if f.charger and hyp(f.x - u.x, f.y - u.y) < 150:
				return
	if want != u.form and SimBattle.FORM_OK[T].has(want):
		SimBattle.setForm(B, u, want)


## ИИ полководца: трубит засаде, скачет ободрить дрогнувших; остальное делают воеводы
static func aiGeneral(B: SimBattle.Bat, side: int) -> void:
	var regs: Dictionary = B.regs[side]
	var us := B.units
	var V: PackedByteArray = B.vis[side]
	var foes := []
	for v: SimBattle.BU in us:
		if v.side != side and SimBattle.bAlive(v) and v.state != "rout" and V[v.id]:
			foes.append(v)
	var waiting := []
	for k in REGK:
		if regs[k].order.k == "wait" and SimBattle.regUnits(B, side, k).size():
			waiting.append(k)
	if waiting.size():
		var engaged := false
		for k in ["C", "R", "L"]:
			if regs[k].engT > 5:
				engaged = true
				break
		var close := false
		for f: SimBattle.BU in foes:
			for k in waiting:
				for u: SimBattle.BU in SimBattle.regUnits(B, side, k):
					if hyp(f.x - u.x, f.y - u.y) < 150:
						close = true
						break
				if close:
					break
			if close:
				break
		if engaged or close or B.t > 160:
			SimBattle.bSignal(B, side)
	var gu := SimBattle.genOf(B, side)
	if gu != null and B.t - B.rallyT[side] >= 30:
		var n := 0
		for u: SimBattle.BU in us:
			if u.side == side and SimBattle.bAlive(u) and hyp(u.x - gu.x, u.y - gu.y) < 110 and (u.state == "rout" or u.morale < 30):
				n += 1
		if n >= 2:
			SimBattle.rally(B, side)


# ---------- бой без экрана ----------
static func runHeadless(B: SimBattle.Bat) -> SimBattle.Bat:
	B.headless = true
	B.ai = [true, true]
	for s in 2:
		SimBattle.initOrders(B, s)
	B.phase = "fight"
	SimBattle.updateVis(B)
	var n := 0
	var lim := B.tl * 10 + 100
	while B.over == null and n < lim:
		n += 1
		SimBStep.bStep(B, 0.1)
		if SimDay.due():                       # бой идёт кусками по кадрам, как день (часы ждут)
			if SimDay.busy:
				await SimDay.pause()
			else:
				await Engine.get_main_loop().process_frame
				SimDay.slice_t = Time.get_ticks_usec()
	if B.over == null:
		B.over = {"win": 1}
	return B


## techXp (research.js, с надбавкой reign.js за латы): выучка войска с учётом изобретений короны
static func techXp(realm: float, xp: Variant) -> Variant:
	var G := Sim.G
	if realm != 0.0 or not JS.t(G.get("tech")):
		return xp
	var o: Dictionary = (xp as Dictionary).duplicate()
	if SimDyn.hasTech("mail"):
		for t in Sim.UT:
			o[t] = JS.n(o.get(t)) + 18
	if SimDyn.hasTech("crossbow"):
		o.archer = JS.n(o.get("archer")) + 36
		o.xbow = JS.n(o.get("xbow")) + 36
	if SimDyn.hasTech("plate"):
		o.sword = JS.n(o.get("sword")) + 24
		o.knight = JS.n(o.get("knight")) + 24
	return o


static func sideFromArmy(a: Dictionary, o: Dictionary = {}) -> Dictionary:
	var G := Sim.G
	var rn := Sim.rangedN(a.u)
	var s := {"u": Sim.assign(Sim.emptyU(), a.u), "xp": techXp(a.realm, a.xp), "morale": a.morale, "fat": a.fat, "gen": Sim.charOf(a.get("gen")),
		"ammo": maxf(0, minf(40, a.arrows / maxf(1, rn))) if rn > 0 else 0.0, "realm": a.realm, "army": a.id,
		"king": a.kind == "player" and a.get("gen") == G.player.char}
	s.ground = o.ground if JS.t(o.get("ground")) else (SimDay.groundOf(a) if a.kind == "lord" or a.kind == "player" else "open")
	s.name = SimArmy.armyLabel(a)
	s.capts = SimBattle.ensureCapts(a)
	return s


const GAR_XP := {"levy": 10.0, "spear": 15.0, "sword": 20.0, "archer": 15.0, "xbow": 15.0, "horse": 15.0, "harch": 15.0, "knight": 25.0}


static func sideFromGarrison(S: Dictionary) -> Dictionary:
	var lord: Variant = Sim.charOf(S.lord) if S.get("lord") != null and S.lord >= 0 else null
	var rng := JS.Rng.new(int(S.id) * 131 + 7)
	var L := []
	for i in 4:
		L.append(SimBattle.mkCaptain(S.ctrl, rng))
	var capts := SimBattle.uniqCapts(L, [lord.name] if lord != null else [], rng)
	var gen: Variant = lord if lord != null and JS.t(lord.get("alive")) and not (lord.get("prison") != null and float(lord.prison) >= 0) else null
	return {"u": Sim.assign(Sim.emptyU(), S.gar), "xp": techXp(S.ctrl, GAR_XP.duplicate()), "morale": 65.0 if S.food > 0 else 35.0, "fat": 0.0, "gen": gen, "ammo": 35.0,
		"realm": S.ctrl, "sett": S.id, "ground": "contentious", "name": "гарнизон " + Sim.W.setts[int(S.id)].name, "capts": capts}


# ---------- итоги ----------
static func survivors(B: SimBattle.Bat, side: int) -> Dictionary:
	var u := Sim.emptyU()
	for b: SimBattle.BU in B.units:
		if b.side == side:
			u[b.type] += maxf(0, b.men)
	return Sim.roundU(u)


static func battleLosses(B: SimBattle.Bat, side: int) -> float:
	var l := 0.0
	for b: SimBattle.BU in B.units:
		if b.side == side:
			l += b.men0 - maxf(0, b.men)
	return JS.rnd(l)


static func arrowsUsed(B: SimBattle.Bat, side: int) -> float:
	var s := 0.0
	for b: SimBattle.BU in B.units:
		if b.side == side and b.ranged:
			s += b.shots
	return JS.rnd(s)


static func regSummary(B: SimBattle.Bat, side: int) -> Array:
	var out := []
	for k in REGK:
		var us := []
		for u: SimBattle.BU in B.units:
			if u.side == side and u.reg == k:
				us.append(u)
		if us.is_empty():
			continue
		var g: SimBattle.BReg = B.regs[side][k]
		var c: Variant = g.cmd
		var m0 := 0.0
		var m := 0.0
		var kl := 0.0
		var fled := false
		for u: SimBattle.BU in us:
			m0 += u.men0
		for u: SimBattle.BU in us:
			m += maxf(0, u.men)
		for u: SimBattle.BU in us:
			kl += u.kills
		for u: SimBattle.BU in us:
			if u.fled or u.state == "rout":
				fled = true
				break
		out.append({"k": k, "n": SimBattle.REGN[k], "cmd": capName(c) if c != null else null, "mar": c.mar if c != null else 0.0, "gen": c != null and JS.t(c.get("gen")),
			"fate": (c.get("fate") if JS.t(c.get("fate")) else null) if c != null else null, "up": JS.n(c.get("up")) if c != null else 0.0,
			"men0": m0, "men": JS.rnd(m), "kills": JS.rnd(kl), "fled": fled})
	return out


## воеводы учатся в бою (ступень умения за 10 опыта); павших заменят перед следующим боем
static func settleCaptains(B: SimBattle.Bat) -> void:
	var win: int = B.over.win
	for side in 2:
		for k in REGK:
			var g: SimBattle.BReg = B.regs[side][k]
			var c: Variant = g.cmd
			if c == null or JS.t(c.get("gen")):
				continue
			var any := false
			for u: SimBattle.BU in B.units:
				if u.side == side and u.reg == k:
					any = true
					break
			if not any:
				continue
			var won := side == win
			if c.get("fate") == "captured" and won:
				c.fate = "freed"
			elif c.get("fate") == "fled" and not won and not JS.t(B.over.get("retreat")) and Sim.R.f() < 0.15:
				c.fate = "captured"
			if not JS.t(c.get("ref")):
				continue
			var ref: Dictionary = c.ref
			if c.get("fate") == "killed" or c.get("fate") == "captured":
				ref.dead = 1.0
				continue
			ref.xp = JS.n(ref.get("xp")) + (4.0 if won else 2.0) + (2.0 if g.engT > 5 else 0.0)
			c.up = 0.0
			while ref.xp >= 10:
				ref.xp -= 10
				if ref.mar < 15:
					ref.mar += 1
					c.up += 1


## погоня за бегущими, когда поле взято: конные рубят и берут бегущих
static func pursuitLoss(B: SimBattle.Bat) -> float:
	var win: int = B.over.win
	var lo := 1 - win
	var cav := 0.0
	var rest := 0.0
	for u: SimBattle.BU in B.units:
		if not SimBattle.bAlive(u):
			continue
		if u.side == win and u.state != "rout" and u.mounted:
			cav += u.men * (0.7 if u.type == "harch" else 1.0)
		if u.side == lo:
			rest += u.men
	if rest < 1:
		return 0.0
	var p := JS.clp(0.06 + 0.45 * minf(1, cav / rest), 0.06, 0.4) * (0.6 if JS.t(B.over.get("retreat")) else 1.0) * (1.3 if B.F.siege and lo == B.F.defSide else 1.0)
	var k := 0.0
	for u: SimBattle.BU in B.units:
		if u.side == lo and SimBattle.bAlive(u):
			var m := u.men * p * (0.4 if u.mounted else 1.0)
			u.men -= m
			k += m
	B.pursuit = JS.rnd(k)
	return k


static func _kingArmy(s: Dictionary) -> bool:
	if not JS.t(s.get("army")):
		return false
	var a: Variant = Sim.armyById(s.army)
	return a != null and a.kind == "player"


## итоги боя войскам и гарнизону (applyBattle с летописью из reign.js)
static func applyBattle(B: SimBattle.Bat) -> Dictionary:
	var G := Sim.G
	pursuitLoss(B)
	SimBStep.settleGenFates(B)
	settleCaptains(B)
	var win: int = B.over.win
	var res := {"win": win, "sides": [], "regs": [regSummary(B, 0), regSummary(B, 1)]}
	for side in 2:
		var s: Dictionary = B.sides[side]
		var surv := survivors(B, side)
		var lost := battleLosses(B, side)
		var winner := side == win
		var r := {"lost": lost, "killed": 0.0, "wounded": 0.0, "prisoners": 0.0}
		r.wounded = JS.rnd(lost * (0.42 if winner else 0.25))
		r.killed = lost - r.wounded
		if JS.t(s.get("army")):
			var a: Variant = Sim.armyById(s.army)
			if a == null:
				res.sides.append(r)
				continue
			a.u = surv
			a.wounded += r.wounded
			a.arrows = maxf(0, a.arrows - arrowsUsed(B, side))
			a.morale = JS.clp(a.morale + (8.0 if winner else -18.0), 0, 100)
			a.vict = 12.0 if winner else -15.0
			a.fat = JS.clp(a.fat + 15, 0, 100)
			for t in Sim.UT:
				a.xp[t] = minf(100, JS.n(a.xp.get(t)) + (6.0 if winner else 3.0))
			a.lastFight = G.day
			if JS.t(a.get("capts")):
				var cl := []
				for c in a.capts:
					if not JS.t(c.get("dead")):
						cl.append(c)
				a.capts = cl
			var gf: Variant = s.get("genFate")
			if gf == "killed" or (gf == "captured" and not winner):
				var g: Variant = Sim.charOf(a.get("gen"))
				if g != null:
					if gf == "killed" and a.kind != "player":
						g.alive = 0.0
					elif gf == "captured":
						g.prison = B.sides[win].realm
		elif s.get("sett") != null:
			G.setts[int(s.sett)].gar = surv
		res.sides.append(r)
	# добыча и пленные
	var W0: Dictionary = B.sides[win]
	var L0: Dictionary = B.sides[1 - win]
	var wa: Variant = Sim.armyById(W0.army) if JS.t(W0.get("army")) else null
	var la: Variant = Sim.armyById(L0.army) if JS.t(L0.get("army")) else null
	var lostL: float = res.sides[1 - win].lost
	var loot := {"food": 0.0, "arrows": 0.0, "weap": 0.0, "horses": 0.0, "gold": 0.0, "prisoners": 0.0}
	if wa != null:
		loot.prisoners = JS.rnd(lostL * 0.18)
		loot.weap = JS.rnd(lostL * 0.3)
		if la != null:
			loot.food = JS.rnd(la.food * 0.4)
			loot.arrows = JS.rnd(la.arrows * 0.3)
			loot.horses = JS.rnd(la.horses * 0.5 + lostL * (Sim.mountedN(la.u) / maxf(1, Sim.armyMen(la) + lostL)) * 0.3)
			loot.gold = JS.rnd(JS.n(la.get("goods")) * 0.8 + JS.n(la.get("loot")) + (10.0 if la.kind == "lord" else 0.0) + (SimEcon.caravanLoot(la) if la.kind == "caravan" else 0.0))
			la.food -= loot.food
			la.arrows -= loot.arrows
			la.horses = maxf(0, la.horses - JS.rnd(la.horses * 0.5))
			la.goods = 0.0
			la.loot = 0.0
		var cap := Sim.armyCap(wa) - SimDay.armyLoad(wa)
		loot.food = minf(loot.food, maxf(0, cap))
		wa.food += loot.food
		wa.arrows += loot.arrows
		wa.weap += loot.weap
		wa.horses += loot.horses
		wa.prisoners = JS.n(wa.get("prisoners")) + loot.prisoners
		if wa.realm < 5:
			G.realms[int(wa.realm)].gold += loot.gold
	res.loot = loot
	# побеждённый отходит или гибнет
	if la != null:
		var m := Sim.armyMen(la)
		if m < 15 or (lostL > m * 2.5 and la.kind != "player"):
			SimDay.destroyArmy(la, "разбито")
		else:
			SimArmy.retreatArmy(la, wa)
	if wa != null and Sim.armyMen(wa) <= 0:
		SimDay.destroyArmy(wa, "погибло")
	# счёт войны
	var ra: float = W0.realm
	var rb: float = L0.realm
	var P: float = G.player.realm
	if ra < 5 and rb < 5 and ra != rb:
		var v := JS.clp(lostL / 25, 2, 20)
		var r1: Dictionary = G.rel[int(ra)][int(rb)]
		var r2: Dictionary = G.rel[int(rb)][int(ra)]
		r1.bs = JS.n(r1.get("bs")) + v
		r2.bs = JS.n(r2.get("bs")) - v
	if ra == P or rb == P:
		G.stats.battles += 1
		if ra == P:
			G.stats.won += 1
		if rb < 7:
			var PR: Dictionary = G.realms[int(P)]
			PR.fear = JS.n(PR.get("fear")) + (3.0 if ra == P else -2.0)
	var retreat := JS.t(B.over.get("retreat"))
	if (ra == P or rb == P) and (W0.get("sett") != null or L0.get("sett") != null) and not _kingArmy(W0) and not _kingArmy(L0):
		var pw := ra == P
		var mine: Dictionary = W0 if pw else L0
		var foe: Dictionary = L0 if pw else W0
		Sim.glog((String(mine.name) if JS.t(mine.get("name")) else "гарнизон") + (" отбился от: " if pw else " не устоял: ") + (String(foe.name) if JS.t(foe.get("name")) else "враг"), "good" if pw else "bad")
	elif ra == P or rb == P:
		var pw := ra == P
		var foe: Dictionary = L0 if pw else W0
		Sim.glog((("Враг отступил: " if retreat else "Победа над: ") if pw else ("Отступили от: " if retreat else "Поражение от: ")) + (String(foe.name) if JS.t(foe.get("name")) else "врага") + " · наши потери " + JS.s(res.sides[win if pw else 1 - win].lost) + ", вражеские " + JS.s(res.sides[1 - win if pw else win].lost), "good" if pw else "bad")
	# летопись (reign.js)
	var s0 := -1
	for i in 2:
		if B.sides[i].realm == P:
			s0 = i
			break
	if s0 >= 0 and B.sides[1 - s0].realm != P:
		var S: Dictionary = B.sides[s0]
		var E: Dictionary = B.sides[1 - s0]
		var won: bool = win == s0
		var m0 := Sim.menOf(S.u)
		var m1 := Sim.menOf(E.u)
		var foeN: String = Sim.realmName(E.realm) if E.realm >= 0 and E.realm < 5 else String(E.name)
		var st := SimArmy.RST()
		if won:
			st.won = SimAI.nv(st, "won") + 1.0
		else:
			st.lost = SimAI.nv(st, "lost") + 1.0
		if m0 + m1 >= 60 or JS.t(S.get("king")):
			var sid: Variant = B.o.get("sett")
			var pl: Variant = Sim.W.setts[int(sid)] if sid != null and int(sid) >= 0 and int(sid) < Sim.W.setts.size() else SimArmy.placeNear(B.tile)
			SimArmy.chron(("Победа" if won else "Поражение") + " близ " + SimArmy.placeName(pl) + ": " + foeN + " (" + SimArmy.fmt(m0) + " против " + SimArmy.fmt(m1) + ")" + (" — король сам вёл войско." if JS.t(S.get("king")) else "."),
				"sword" if won else "flag", "won" if won else "lost", 3.0 if JS.t(S.get("king")) or m0 + m1 >= 600 else 2.0)
	return res


## бой ИИ против ИИ или «автобой» двух полевых войск
static func autoBattle(a: Dictionary, b: Dictionary, o: Dictionary = {}) -> Dictionary:
	var B := SimBattle.setupBattle(sideFromArmy(a), sideFromArmy(b), Sim.armyTile(a), o)
	await runHeadless(B)
	var res := applyBattle(B)
	res.winA = res.win == 0
	SimBattle.freeBattle(B)
	return res


static func autoBattleGarrison(a: Dictionary, S: Dictionary, assault := false) -> Dictionary:
	var wsT := int(Sim.W.setts[int(S.id)].i)
	var siege: bool = assault and S.walls > 0
	var works: float = S.siege.works / maxf(1, S.siege.need) if JS.t(S.get("siege")) else 1.0
	var B := SimBattle.setupBattle(sideFromArmy(a, {"ground": "open"}), sideFromGarrison(S), wsT, {"siege": siege, "works": works})
	await runHeadless(B)
	var res := applyBattle(B)
	res.win = res.win == 0
	SimBattle.freeBattle(B)
	return res
