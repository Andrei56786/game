class_name SimBStep extends SimBattle
## Ход боя (bStep из battlesim.js): приказы и строи в пути, сшибки, обзор, движение, давка своих, рукопашная, стрельба,
## дух и бегство, гибель полководцев и воевод, думы воевод и полководца (SimCapt), конец боя. Поле, отряды, полки и
## приказы — в SimBattle (отсюда всё видно без приставки: класс наследует её). Горячие места — на массивах шага и без
## вызовов (быстрее втрое), но с теми же действиями в том же порядке: числа совпадают с HTML до знака.


## enemyOf в движении: живые и небегущие — по массивам шага (PS — сторона, -1 — нет), положения — PX, PY
static func _enemyNear(B: Bat, u: BU, maxD: float, PX: PackedFloat64Array, PY: PackedFloat64Array, PS: PackedInt32Array) -> BU:
	var best := -1
	var bd := maxD
	var V: PackedByteArray = B.vis[u.side]
	var os := 1 - u.side
	var ux := u.x
	var uy := u.y
	for i in PS.size():
		if PS[i] != os or not V[i]:
			continue
		var dx := PX[i] - ux
		var dy := PY[i] - uy
		if absf(dx) >= bd or absf(dy) >= bd:
			continue
		var d := hyp(dx, dy)
		if d < bd:
			bd = d
			best = i
	return B.units[best] if best >= 0 else null


static func bStep(B: Bat, dt: float) -> void:
	useField(B.F)
	B.t += dt
	var us := B.units
	var F := B.F
	var Wt: Dictionary = B.weather if B.weather != null else Sim.weatherOf()
	var n := us.size()
	B.genU = [genOf(B, 0), genOf(B, 1)]
	for u: BU in us:
		if u.pend != null and B.t >= u.pend.at:
			var o: Dictionary = u.pend.ord
			u.pend = null
			bApply(B, u, o)
		if u.pendF != null and B.t >= u.pendF.at:
			var p: Dictionary = u.pendF
			u.pendF = null
			if JS.t(p.f):
				setForm(B, u, p.f, p.lock)
			else:
				u.formLock = false
		if u.formTo != "" and B.t >= u.formT:
			u.form = u.formTo
			u.formTo = ""
	for side in 2:
		for k in REGK:
			var g: BReg = B.regs[side][k]
			if g.pend != null and B.t >= g.pend.at:
				var o: Dictionary = g.pend.ord
				g.pend = null
				setRegOrder(B, g, o)
	# сшибки (бегущие не отвечают); положения, радиусы и стороны — в массивах: пар много, отрядов мало
	var PX := PackedFloat64Array()
	var PY := PackedFloat64Array()
	var PR := PackedFloat64Array()
	var PS := PackedInt32Array()             # сторона (+2 — бежит); -1 — нет на поле
	PX.resize(n)
	PY.resize(n)
	PR.resize(n)
	PS.resize(n)
	# стороны — порознь (I0, I1 по порядку номеров): у каждого отряда сшибки — по номерам, как в парах i < j в JS
	var I0 := PackedInt32Array()
	var I1 := PackedInt32Array()
	for i in n:
		var u: BU = us[i]
		u.contact.clear()
		if u.men > 0.5 and u.state != "gone":
			PX[i] = u.x
			PY[i] = u.y
			PR[i] = (6 + sqrt(u.men) * 0.9) * u.fR
			PS[i] = 1 if u.state == "rout" else 0
			if u.side == 0:
				I0.append(i)
			else:
				I1.append(i)
	for i in I0:
		var ar := PS[i] == 1
		var xa := PX[i]
		var ya := PY[i]
		var ra := PR[i]
		for j in I1:
			var br := PS[j] == 1
			if ar and br:
				continue
			var dx := xa - PX[j]
			var dy := ya - PY[j]
			var m := ra + PR[j]
			if dx * dx + dy * dy >= m * m:
				continue
			var a: BU = us[i]
			var b: BU = us[j]
			if not ar:
				a.contact.append(b)
			if not br:
				b.contact.append(a)
			if a.hidden or b.hidden:
				a.hidden = false
				b.hidden = false
	for u: BU in us:
		if u.contact.size() > 1:
			var c1: Array[BU] = []
			var c2: Array[BU] = []
			for c: BU in u.contact:
				if c.state == "rout":
					c2.append(c)
				else:
					c1.append(c)
			if c1.size() and c2.size():
				c1.append_array(c2)
				u.contact = c1
	if B.t >= B.visT:
		B.visT = B.t + 0.5
		updateVis(B)
	# конные лучники отскакивают сами, не дожидаясь слова воеводы
	for u: BU in us:
		if u.type != "harch" or not (u.men > 0.5 and u.state != "gone") or u.state == "rout" or u.man or u.ammo <= 0 or B.t < u.hrT:
			continue
		u.hrT = B.t + 0.4
		var k: String = B.regs[u.side][u.reg].cur
		if k == "hold" or k == "wait" or (u.order != null and JS.t(u.order.get("dis")) and B.t - (u.harT if u.harT != 0.0 else -9.0) < 1.5):
			continue
		var e: BU = null
		var bd := 1e9
		for v: BU in us:
			if v.side == u.side or not (v.men > 0.5 and v.state != "gone") or v.state == "rout" or v.ranged or (v.contact.size() and not v.contact.has(u)):
				continue
			var d := hyp(v.x - u.x, v.y - u.y) - bRad(v) - bRad(u)
			if d < (45.0 if v.charger else 22.0) and d < bd:
				bd = d
				e = v
		if e != null:
			SimCapt.harchFlee(B, u, e)
	# движение и поворот (скорость, местность, повороты и клетки — здесь же, без вызовов: так втрое быстрее)
	var cold := JS.t(Wt.get("cold"))
	var Fg := F.g
	for i in n:                                 # для enemyOf: кто на поле и не бежит (сторона), где стоит
		var u: BU = us[i]
		PX[i] = u.x
		PY[i] = u.y
		PS[i] = u.side if u.men > 0.5 and u.state != "gone" and u.state != "rout" else -1
	for u: BU in us:
		if not (u.men > 0.5 and u.state != "gone"):
			continue
		var tk := Fg[clampi(int(floorf(u.y / CELL)), 0, BCH - 1) * BCW + clampi(int(floorf(u.x / CELL)), 0, BCW - 1)]
		var tm := 1.0
		if tk == FOREST:
			tm = (0.4 if u.type == "knight" else 0.45) if u.mounted else 0.65
		elif tk == MARSH:
			tm = 0.4 if u.mounted else 0.5
		elif tk == FORD:
			tm = 0.45
		elif tk == WALL:
			tm = 0.4
		elif tk == ROAD:
			tm = 1.1
		var sp := u.ust * (minf(u.fSp, u.ftSp) * 0.5 if u.formTo != "" else u.fSp) * tm * (1 - u.fat / 250) * (0.85 if cold else 1.0)
		if u.state == "rout":
			var ex := -20.0 if u.side == 0 else BW + 20
			var dx := ex - u.x
			u.face = PI if dx < 0 else 0.0
			var rs := u.ust * tm * 1.25
			u.x += signf(dx) * rs * dt
			u.y += (u.h11 - 0.5) * 6 * dt
			u.y = JS.clp(u.y, 8, BH - 8)
			u.morale = minf(100, u.morale + dt * 2)
			var pursued := false
			for v: BU in us:
				if v.side != u.side and v.men > 0.5 and v.state != "gone" and v.state != "rout" and absf(v.x - u.x) < 60 and hyp(v.x - u.x, v.y - u.y) < 60:
					pursued = true
					break
			PX[u.id] = u.x
			PY[u.id] = u.y
			if u.x < -10 or u.x > BW + 10:
				u.state = "gone"
				u.fled = true
			elif not pursued and u.morale > 45 and B.t - u.routT > 8 and not u.rallied and B.lostF[u.side] < 0.5:
				u.state = "idle"
				u.order = null
				u.man = false
				u.rallied = true
				PS[u.id] = u.side
				bsay(B, u.x, u.y - 20, "Собрались!", "#9fe07a")
			continue
		var fight: BU = null
		for e: BU in u.contact:
			if e.state != "rout":
				fight = e
				break
		var o: Variant = u.order
		var dis: bool = o != null and o.k == "move" and JS.t(o.get("dis"))
		if fight != null and not dis:
			var want := atan2(fight.y - u.y, fight.x - u.x)
			var ad := want - u.face
			while ad > PI:
				ad -= TAU
			while ad < -PI:
				ad += TAU
			var lim := 1.6 * dt
			u.face += -lim if ad < -lim else (lim if ad > lim else ad)
			u.state = "melee"
			u.ch = maxf(0, u.ch - dt * 0.6)
			u.fat = minf(100, u.fat + dt * 0.3)
			continue
		if u.state == "melee":
			u.state = "move" if o != null else "idle"
		if u.hidden and tk != FOREST:
			u.hidden = false
		var hasT := false
		var tx := 0.0
		var ty := 0.0
		var aimT: BU = null
		if o != null and o.k == "attack":
			var t := _ui(B, o.get("t"))
			if t == null or not (t.men > 0.5 and t.state != "gone") or (t.state == "rout" and not u.charger and not JS.t(o.get("pur"))):
				u.order = null
				o = null
			elif not B.vis[u.side][t.id]:
				var gh: Variant = B.ghost[u.side][t.id]
				if gh != null and B.t - gh.t < 12 and hyp(gh.x - u.x, gh.y - u.y) > 10:
					hasT = true
					tx = gh.x
					ty = gh.y
				else:
					u.order = null
					o = null
			else:
				hasT = true
				tx = t.x
				ty = t.y
				if u.ranged and u.ammo > 0 and u.form != "column":
					var d := hyp(t.x - u.x, t.y - u.y)
					if d < bRange(B, u) * (0.85 if u.type == "harch" else 0.9):
						hasT = false
						aimT = t
		elif o != null and o.k == "move":
			hasT = true
			tx = o.x
			ty = o.y
			if hyp(tx - u.x, ty - u.y) < 3:
				if o.get("f") != null:
					u.wantF = o.f
				u.order = null
				o = null
				u.state = "idle"
				hasT = false
		elif o == null and u.state == "idle" and not u.ranged and not u.hidden and u.form != "square" and B.regs[u.side][u.reg].cur != "wait":
			var e := _enemyNear(B, u, 40.0, PX, PY, PS)
			if e != null:
				hasT = true
				tx = e.x
				ty = e.y
		if hasT:
			var dx := tx - u.x
			var dy := ty - u.y
			var d := hyp(dx, dy)
			if d < 0.5:
				continue
			var s := sp
			if o != null and JS.t(o.get("vmax")):
				s = minf(s, o.vmax)
			if u.charger and o != null and o.k == "attack" and d < 70 and u.form != "column":
				s = sp * (1.4 if u.type == "knight" else 1.5) * (1.08 if u.form == "wedge" else 1.0)
				u.ch = minf(1, u.ch + dt * 0.8)
			else:
				u.ch = maxf(0, u.ch - dt)
			if not u.wpOn or B.t - u.wpT > 0.4 or absf(u.wpTx - tx) + absf(u.wpTy - ty) > 8:
				u.wpOn = true
				u.wpT = B.t
				u.wpTx = tx
				u.wpTy = ty
				u.wpP = steerPoint(F, u, tx, ty)
			var want := atan2(u.wpP[1] - u.y, u.wpP[0] - u.x) if u.wpP != null else atan2(dy, dx)
			var ad := want - u.face
			while ad > PI:
				ad -= TAU
			while ad < -PI:
				ad += TAU
			var lim := 2.5 * dt
			u.face += -lim if ad < -lim else (lim if ad > lim else ad)
			var st := minf(s * dt, d)
			var nx := u.x + cos(want) * st
			var ny := u.y + sin(want) * st
			if passCell(F, clampi(int(floorf(ny / CELL)), 0, BCH - 1) * BCW + clampi(int(floorf(nx / CELL)), 0, BCW - 1), u):
				u.x = nx
				u.y = ny
			else:
				for w: float in [want + 0.8, want - 0.8, want + 1.6, want - 1.6]:
					var ax := u.x + cos(w) * st
					var ay := u.y + sin(w) * st
					if passCell(F, cellAt(ax, ay), u):
						u.x = ax
						u.y = ay
						break
			u.fat = minf(100, u.fat + dt * (1.2 if u.ch > 0 else (0.15 if u.form == "column" else 0.25)) * (1.3 if u.type == "knight" else 1.0))
			u.state = "move"
		else:
			u.fat = maxf(0, u.fat - dt * 0.4)
			if u.state == "move":
				u.state = "idle"
			u.ch = maxf(0, u.ch - dt)
			var wf: Variant = atan2(aimT.y - u.y, aimT.x - u.x) if aimT != null else u.wantF
			if wf != null and u.contact.is_empty():
				var d: float = wf - u.face
				while d > PI:
					d -= TAU
				while d < -PI:
					d += TAU
				if absf(d) > 0.02:
					var lim := 1.5 * dt
					u.face += -lim if d < -lim else (lim if d > lim else d)
				elif aimT == null:
					u.wantF = null
		u.x = -30.0 if u.x < -30 else (BW + 30 if u.x > BW + 30 else u.x)
		u.y = 8.0 if u.y < 8 else (BH - 8 if u.y > BH - 8 else u.y)
		PX[u.id] = u.x
		PY[u.id] = u.y
	# свои не толпятся (положения — в массивах PX, PY заодно с отрядами)
	# пары своих — по сторонам порознь: толкаются лишь двое из пары одной стороны, порядок внутри стороны — как в JS
	I0.clear()
	I1.clear()
	for i in n:
		var u: BU = us[i]
		if u.men > 0.5 and u.state != "gone":
			PX[i] = u.x
			PY[i] = u.y
			PR[i] = (6 + sqrt(u.men) * 0.9) * u.fR
			if u.side == 0:
				I0.append(i)
			else:
				I1.append(i)
	for I: PackedInt32Array in [I0, I1]:
		var nI := I.size()
		for ii in nI:
			var i := I[ii]
			var ra := PR[i]
			for jj in range(ii + 1, nI):
				var j := I[jj]
				var dx0 := PX[i] - PX[j]
				var dy0 := PY[i] - PY[j]
				var m := (ra + PR[j]) * 0.8
				if absf(dx0) > m or absf(dy0) > m:
					continue
				var d := hyp(dx0, dy0)
				if d < m and d > 0.01:
					var a: BU = us[i]
					var b: BU = us[j]
					var k := (m - d) / d * 0.25
					var wa := 0.2 if a.form == "square" else 1.0
					var wb := 0.2 if b.form == "square" else 1.0
					var dx := dx0 * k
					var dy := dy0 * k
					if passCell(F, cellAt(a.x + dx * wa, a.y + dy * wa), a):
						a.x += dx * wa
						a.y += dy * wa
						PX[i] = a.x
						PY[i] = a.y
					if passCell(F, cellAt(b.x - dx * wb, b.y - dy * wb), b):
						b.x -= dx * wb
						b.y -= dy * wb
						PX[j] = b.x
						PY[j] = b.y
	# рукопашная: по отряду разом бьёт лишь столько, сколько подступится — толпа вокруг даёт удары с боков, а не бесконечные мечи
	for u: BU in us:
		u.atkN = 0
	for u: BU in us:
		if u.men > 0.5 and u.state != "gone" and u.state != "rout" and u.contact.size():
			var c0: BU = u.contact[0]
			c0.atkN += 1
	var stat := B.stat
	var sPur: Array = stat.pur
	var sMel: Array = stat.mel
	var sChg: Array = stat.chg
	var sFlk: Array = stat.flk
	var Fh := F.hgt
	# рука воеводы (capQ) — по полкам: воевода и его отряд не меняются за рукопашную (отряд может лишь пасть)
	var QC := []
	var QL := []
	for side in 2:
		for k in REGK:
			var g: BReg = B.regs[side][k]
			QC.append(cmdOk(g))
			QL.append(leadOf(B, g))
	for u: BU in us:
		if not (u.men > 0.5 and u.state != "gone") or u.state == "rout" or u.contact.is_empty():
			continue
		var e: BU = u.contact[0]
		var er := e.state == "rout"
		var fight: float = minf(u.men, 25 + u.men * 0.45) * u.fFr
		var m: float = u.fAtk * (0.85 if u.formTo != "" else 1.0)
		var flank := 0
		if er:
			m *= 2
			flank = 2
		elif e.form != "square":
			var rel := atan2(u.y - e.y, u.x - e.x) - e.face
			while rel > PI:
				rel -= TAU
			while rel < -PI:
				rel += TAU
			rel = absf(rel)
			if rel > 2.2:
				m *= 2
				flank = 2
			elif rel > 1.05:
				m *= 1.5
				flank = 1
			if flank and e.form == "column":
				m *= 1.2
		if u.charger and u.ch > 0.3 and not er:
			var c := 3.0 if u.type == "knight" else 2.4
			if u.form == "wedge":
				c *= 1.15
			var sq := e.form == "square"
			var brace := 0.17 if sq else (0.23 if (e.type == "spear" and flank == 0 and e.form != "loose" and e.form != "column") else (0.4 if (e.form == "close" and flank == 0) else 1.0))
			if brace < 1:
				c *= brace * (1.25 if u.type == "knight" else 1.0)
				u.men -= dt * fight * 0.05 * (1.3 if sq else 1.0) * (0.6 if u.type == "knight" else 1.0)
			elif e.form == "loose":
				c *= 1.25
			m *= c
		if u.type == "spear" and e.mounted:
			m *= 1.6
		if u.type == "levy" and u.form == "square" and e.mounted:
			m *= 1.25
		if e.type == "spear" and u.charger and flank == 0 and not er:
			m *= 0.65
		var cu := clampi(int(floorf(u.y / CELL)), 0, BCH - 1) * BCW + clampi(int(floorf(u.x / CELL)), 0, BCW - 1)
		var ce := clampi(int(floorf(e.y / CELL)), 0, BCH - 1) * BCW + clampi(int(floorf(e.x / CELL)), 0, BCW - 1)
		var hu := Fh[cu]
		var he := Fh[ce]
		if hu > he:
			m *= 1.25
		elif hu < he:
			m *= 0.85
		var ku := Fg[cu]
		var ke := Fg[ce]
		if ku == FORD or ku == MARSH:
			m *= 0.7
		if ke == FORD or ke == MARSH:
			m *= 1.15
		if ke == WALL or (F.siege and e.side == F.defSide and e.x > F.rv.wall * CELL - 4 and e.x < F.rv.wall * CELL + 16):
			m *= 0.45
		if u.mounted and ku == FOREST:
			m *= 0.5 if u.type == "knight" else 0.6
		if ke == FOREST:
			m *= 0.85
		m *= (1 - u.fat / 220) * (0.75 if u.morale < 30 else 1.0) * (1 + u.xp / 220)
		var gA: BU = B.genU[u.side]
		if gA != null and absf(gA.x - u.x) < 80 and hyp(gA.x - u.x, gA.y - u.y) < 80:
			m *= 1.1
		var qi := u.side * 5 + u.regI
		var qc: Variant = QC[qi]
		var qu := 0.88
		if qc != null:
			var L: BU = QL[qi]
			var near := L != null and L.men > 0.5 and absf(L.x - u.x) < 120 and hyp(L.x - u.x, L.y - u.y) < 120
			qu = 1 + (qc.mar - 5) * (0.03 if near else 0.015)
		m *= qu
		if B.gOpen[u.side] and u.mounted:
			m *= 1.1
		if B.gCont[e.side] and e.side == 1:
			m *= 0.83
		var df: float = e.udef * e.fDef * (0.85 if e.formTo != "" else 1.0) * (0.5 if er else 1.0)
		var A2 := u.uatk * u.uatk
		var d13 := df * 1.3
		var D2 := d13 * d13
		var dmg := fight * A2 / (A2 + D2) * 0.016 * m * dt * minf(1, 1.6 / maxf(1, e.atkN))
		var kills := minf(e.men, dmg * 12 / e.uhp)
		e.men -= kills
		u.kills += kills
		e.lastHit = B.t
		if er:
			sPur[u.side] += kills
		else:
			sMel[u.side] += kills
		if u.charger and u.ch > 0.3 and not er:
			sChg[u.side] += kills
		if flank and not er:
			sFlk[u.side] += kills
		# удар во фланг пугает не меньше, чем сами удары: мужики на фланге латников страшат меньше, чем рыцари в тылу
		if not er:
			var thr := 0.0
			if flank:
				var t0 := fight * A2 / (A2 + D2) / maxf(10, e.men) / 0.26
				thr = (0.25 if t0 < 0.25 else (1.5 if t0 > 1.5 else t0)) * minf(1, 1.6 / maxf(1, e.atkN))
			var qj := e.side * 5 + e.regI
			var qe := 0.88
			var qce: Variant = QC[qj]
			if qce != null:
				var L: BU = QL[qj]
				var near := L != null and L.men > 0.5 and absf(L.x - e.x) < 120 and hyp(L.x - e.x, L.y - e.y) < 120
				qe = 1 + (qce.mar - 5) * (0.03 if near else 0.015)
			e.morale -= (kills / maxf(10, e.men0) * 150 + (3.2 if flank == 2 else (1.6 if flank == 1 else 0.0)) * thr * dt) * (e.disc0 * (1 - e.xp / 300) / (qe if qe != 0.0 else 1.0))
		if not B.headless and kills > 0 and Sim.R.f() < kills * 0.6:
			var r2 := bRad(e) * 1.4
			var ddx := (Sim.R.f() - 0.5) * r2
			var ddy := (Sim.R.f() - 0.5) * r2
			B.dead.append({"x": e.x + ddx, "y": e.y + ddy, "side": e.side, "t": e.type})
	# стрельба: луки бьют навесом, арбалеты пробивают кольчугу, конные лучники стреляют на ходу
	for u: BU in us:
		if not u.ranged or not (u.men > 0.5 and u.state != "gone") or u.state == "rout" or u.ammo <= 0 or u.form == "column":
			continue
		var busy := false
		for e: BU in u.contact:
			if e.state != "rout":
				busy = true
				break
		if busy:
			continue
		u.cd -= dt * (0.5 if u.formTo != "" else 1.0)
		if u.cd > 0:
			continue
		if u.state == "move" and u.type != "harch":
			continue
		var rng := bRange(B, u)
		var tgt: BU = _ui(B, u.order.get("t")) if u.order != null and u.order.k == "attack" else null
		if tgt == null or not bAlive(tgt) or tgt.state == "rout" or not B.vis[u.side][tgt.id] or hyp(tgt.x - u.x, tgt.y - u.y) > rng:
			tgt = enemyOf(B, u, rng)
		if tgt == null:
			continue
		var S: Dictionary = SHOT[u.type]
		u.cd = u.ucd * (0.9 + Sim.R.f() * 0.2)
		u.ammo -= 1
		u.shots += u.men
		u.lastShot = B.t
		var hit: float = S.hit * (S.wet if JS.t(Wt.get("wet")) else 1.0) * (1 + u.xp / 250) * (0.9 if u.form == "loose" else 1.0) * ARM[tgt.type][1 if u.type == "xbow" else 0] * tgt.fArr
		# щиты смотрят вперёд: стрелы с фланга и с тыла находят тела (у ежа фланга нет); скачущих всадников трудно задеть
		var relS := 0.0 if tgt.form == "square" else absf(angDiff(atan2(u.y - tgt.y, u.x - tgt.x), tgt.face))
		var fs := 1.6 if relS > 2.2 else (1.3 if relS > 1.05 else 1.0)
		hit *= fs
		if tgt.mounted and tgt.state == "move":
			hit *= 0.8
		# стрельба в свалку: целят с недолётом до своих, и всё равно часть стрел находит своих
		var pal: BU = null
		for x: BU in tgt.contact:
			if x.side == u.side and x.state != "rout":
				pal = x
				break
		var palNear := pal != null and (pal.x - tgt.x) * (u.x - tgt.x) + (pal.y - tgt.y) * (u.y - tgt.y) > 0
		if pal != null:
			hit *= 0.5 if palNear else 0.85
		var kt := F.g[cellAt(tgt.x, tgt.y)]
		if kt == FOREST:
			hit *= 0.4
		if F.siege and tgt.side == F.defSide and tgt.x > F.rv.wall * CELL - 4:
			hit *= 0.5
		if F.hgt[cellAt(u.x, u.y)] > F.hgt[cellAt(tgt.x, tgt.y)]:
			hit *= 1.1
		var kills: float = minf(tgt.men, u.men * hit * 0.085 * 12 / tgt.uhp * S.vol)
		tgt.men -= kills
		u.kills += kills
		if palNear:
			var fk := minf(pal.men, kills * 0.2 * tgt.uhp / pal.uhp)
			pal.men -= fk
			pal.morale -= fk / maxf(10, pal.men0) * 60
			stat.ff[u.side] += fk
		stat.sht[u.side] += kills
		if fs > 1:
			stat.flk[u.side] += kills
		tgt.morale -= (kills / maxf(10, tgt.men0) * 90 + 0.8 + (fs - 1) * 2.5) * DISC(tgt, capQ(B, tgt))
		tgt.lastHit = B.t
		tgt.lastArr = B.t
		if not B.headless:
			var na := mini(14, 3 + int(floorf(u.men / 10)))
			var xb := u.type == "xbow"
			for kk in na:
				var x0 := u.x + (Sim.R.f() - 0.5) * 14
				var y0 := u.y + (Sim.R.f() - 0.5) * 14
				var x1 := tgt.x + (Sim.R.f() - 0.5) * 18
				var y1 := tgt.y + (Sim.R.f() - 0.5) * 18
				var t0 := B.t + Sim.R.f() * (0.4 if xb else 0.25)
				B.arrows.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "t0": t0, "d": 0.55 if xb else 0.9, "arc": 8.0 if xb else 26.0, "xb": xb})
			sfx(B, "arrows")
	# дух войска: сколько его пало или бежало
	if B.lostF == null or B.t >= B.lfT:
		B.lfT = B.t + 0.5
		var lf := [1.0, 1.0]
		for s in 2:
			var m0 := 0.0
			var m := 0.0
			for u: BU in us:
				if u.side == s:
					m0 += u.men0
					if u.men > 0.5 and u.state != "gone" and u.state != "rout":
						m += u.men
			lf[s] = 1 - m / m0 if m0 != 0.0 else 1.0
		B.lostF = lf
	# дух: бегство и возвращение
	for u: BU in us:
		if not (u.men > 0.5 and u.state != "gone"):
			continue
		var rg: BReg = B.regs[u.side][u.reg]
		if u.men < 1:
			u.men = 0
			u.state = "gone"
			if u.gen:
				onGenFall(B, u, false)
			if rg.lead == u.id:
				onCaptFall(B, rg, u, true)
			continue
		if u.state == "rout":
			continue
		if u.mor0 == 0.0:
			u.mor0 = u.morale
		var engaged := false
		for e: BU in u.contact:
			if e.state != "rout":
				engaged = true
				break
		var gA: BU = B.genU[u.side]
		if not engaged and B.t - u.lastHit > 3:
			var r := 0.5
			if gA != null and hyp(gA.x - u.x, gA.y - u.y) < 90:
				r = 1.4
			else:
				var cc: Variant = cmdOk(rg)
				var L: BU = leadOf(B, rg) if cc != null else null
				if L != null and hyp(L.x - u.x, L.y - u.y) < 70:
					r = 0.9 + cc.mar * 0.03 + (0.2 if hasTr(cc, "brave") else 0.0)
			if u.morale < u.mor0:
				u.morale = minf(u.mor0, u.morale + dt * r)
		var lf: float = B.lostF[u.side]
		var lo: float = B.lostF[1 - u.side]
		if lf > 0.4:
			u.morale -= (lf - 0.4) * 7 * dt
		elif lo > 0.4 and lf < 0.25 and u.morale < u.mor0 + 10:
			u.morale += dt * 0.4
		var floor := 4.0 if B.gDeath[u.side] else 14.0
		if u.morale < floor or u.men < u.men0 * 0.12:
			u.state = "rout"
			u.routT = B.t
			u.order = null
			u.pend = null
			u.pendF = null
			u.recover = false
			if u.formTo != "":
				u.formTo = ""
			if u.form == "square" or u.form == "close":
				u.form = "loose"
			if not B.headless:
				bsay(B, u.x, u.y - 20, "Бегут!", "#ee7a6a")
				sfx(B, "horn_low")
			for v: BU in us:
				if v.side == u.side and v != u and v.men > 0.5 and v.state != "gone" and v.state != "rout" and hyp(v.x - u.x, v.y - u.y) < 60:
					v.morale -= (6.0 if v.reg == u.reg else 4.0) * JS.clp(u.men0 / maxf(1, v.men0), 0.4, 1.2)
			if u.gen:
				onGenFall(B, u, true)
			if rg.lead == u.id:
				onCaptFall(B, rg, u, false)
	# воеводы думают; полководцы сторон под ИИ командуют
	if B.t >= B.stT:
		B.stT = B.t + 2
		B.stance = [SimCapt.calcStance(B, 0), SimCapt.calcStance(B, 1)]
	for side in 2:
		for k in REGK:
			var g: BReg = B.regs[side][k]
			g.thinkT -= dt
			if g.thinkT <= 0:
				g.thinkT = SimCapt.thinkInt(g)
				SimCapt.regThink(B, g)
		if B.ai[side]:
			B.aiT[side] -= dt
			if B.aiT[side] <= 0:
				var sg: Variant = B.sides[side].get("gen")
				var gm: float = sg.mar if sg != null else 4.0
				B.aiT[side] = 2.4 - gm * 0.08
				SimCapt.aiGeneral(B, side)
	# конец
	for s in 2:
		if B.lostF[s] > 0.82 and B.lostF[1 - s] < 0.6 and _aliveSide(us, s) and not (F.siege and s == F.defSide):
			for u: BU in us:
				if u.side == s and u.men > 0.5 and u.state != "gone" and u.state != "rout":
					u.state = "rout"
					u.routT = B.t
					u.order = null
					u.pend = null
					u.pendF = null
			var gu := genOf(B, s)
			if gu == null:
				for u: BU in us:
					if u.side == s and bAlive(u):
						gu = u
						break
			if gu != null:
				bsay(B, gu.x, gu.y - 30, "Войско дрогнуло и бежит с поля!" if s == 0 else "Враг бежит с поля!", "#ee7a6a" if s == 0 else "#9fe07a")
	var a0 := _aliveSide(us, 0)
	var a1 := _aliveSide(us, 1)
	if not a0 or not a1 or B.t > B.tl:
		var win := 0
		if not a0 and a1:
			win = 1
		elif not a1 and a0:
			win = 0
		else:
			var p0 := _pwSide(us, 0)
			var p1 := _pwSide(us, 1)
			win = (0 if p0 > p1 * 1.5 else 1) if F.siege else (0 if p0 >= p1 else 1)
		B.over = {"win": win, "time": B.t > B.tl}


## отряд полководца разбит или бежал: он переходит к другому отряду; лишь когда никого нет — покидает поле
static func onGenFall(B: Bat, u: BU, routed := false) -> void:
	var s: Dictionary = B.sides[u.side]
	u.gen = false
	var C: BReg = B.regs[u.side].C
	if s.get("gen") == null or JS.t(s.get("genFate")):
		return
	var mine := []
	for v: BU in B.units:
		if v.side == u.side and v != u and bAlive(v) and v.state != "rout":
			mine.append(v)
	var r := Sim.R.f()
	var lead := "Король" if u.side == 0 and JS.t(B.sides[0].get("king")) else "Полководец"
	if not routed and r < 0.03:
		s.genFate = "killed"
	elif r < (0.02 if routed else 0.08):
		s.genFate = "captured"
	if JS.t(s.get("genFate")):
		if C.cmd != null and JS.t(C.cmd.get("gen")):
			if s.genFate == "killed":
				C.cmd.alive = 0.0
			else:
				C.cmd.away = 1.0
		C.lead = -1
		for v: BU in B.units:
			if v.side == u.side and bAlive(v):
				v.morale -= 15
		bsay(B, u.x, u.y - 28, lead + (" пал!" if s.genFate == "killed" else " в плену!"))
		return
	if mine.size():
		var g: BU = null
		var bk := 0.0
		for a: BU in mine:
			var pref := 0 if a.type == "knight" else (1 if a.type == "horse" else (2 if a.type == "sword" else (3 if a.type == "spear" else 4)))
			var key := hyp(a.x - u.x, a.y - u.y) + pref * 25 + (0 if a.reg == "C" else 30)
			if g == null or key < bk:
				g = a
				bk = key
		g.gen = true
		if C.cmd != null and JS.t(C.cmd.get("gen")):
			C.lead = g.id
		for v: BU in mine:
			v.morale -= 4
		bsay(B, u.x, u.y - 28, lead + " перешёл к другому отряду")
		return
	s.genFlee = 1.0
	if C.cmd != null and JS.t(C.cmd.get("gen")):
		C.cmd.away = 1.0
	C.lead = -1
	bsay(B, u.x, u.y - 28, lead + " покидает поле боя", "#ffb4a8")


## отряд воеводы разбит или бежал: воевода может пасть, попасть в плен или перейти к другому отряду полка
static func onCaptFall(B: Bat, g: BReg, u: BU, destroyed: bool) -> void:
	var c: Variant = g.cmd
	if c == null or not JS.t(c.get("alive")) or JS.t(c.get("away")) or JS.t(c.get("gen")):
		return
	var r := Sim.R.f()
	var nm: String = (String(c.t) + " " if JS.t(c.get("t")) else "") + String(c.n)
	var us := []
	for v: BU in regUnits(B, g.side, g.k):
		if v != u:
			us.append(v)
	if r < (0.3 if destroyed else 0.04):
		c.alive = 0.0
		c.fate = "killed"
		g.lead = -1
		for v: BU in us:
			v.morale -= 10
		bsay(B, u.x, u.y - 28, nm + " пал!", "#ffb4a8" if g.side == 0 else "#f7d35c")
		return
	if r < (0.45 if destroyed else 0.1):
		c.away = 1.0
		c.fate = "captured"
		g.lead = -1
		for v: BU in us:
			v.morale -= 8
		bsay(B, u.x, u.y - 28, nm + " в плену!", "#ffb4a8" if g.side == 0 else "#f7d35c")
		return
	if us.size():
		g.lead = pickLead(us).id
		for v: BU in us:
			v.morale -= 3
		return
	c.away = 1.0
	c.fate = "fled"
	g.lead = -1


## в конце боя: пленного полководца могут отбить победители, бежавшего — настичь преследователи
static func settleGenFates(B: Bat) -> void:
	var win: int = B.over.win
	for side in 2:
		var s: Dictionary = B.sides[side]
		if s.get("gen") == null:
			continue
		var won := side == win
		if s.get("genFate") == "captured" and won:
			s.genFate = "freed"
		elif not JS.t(s.get("genFate")) and JS.t(s.get("genFlee")):
			s.genFate = "escaped" if won else ("captured" if Sim.R.f() < 0.2 and not JS.t(B.over.get("retreat")) else "escaped")
