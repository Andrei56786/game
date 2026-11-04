class_name SimBel
## «Враг верит, а не знает» — перенос belief.js и deceit.js. Каждая чужая держава помнит, где и какими видела войска короны
## (G.bel[r].a), по этой картине её полководцы бегут, гонятся и выбирают цели; корона знает о чужих войсках то, что видела
## (G.know — призраки на карте). Уловки (ложный марш, ложные костры, чучела на стенах, притворное бегство) меняют картину,
## а не правду. Журнал обмана — G.dlog. Числовые ключи (G.bel, B.a, B.react, B.plot, G.know, S.dumK) — через JS.oset.

const MW := WorldData.MW
const MH := WorldData.MH
const BEL_AGE := 30.0
const KNOW_AGE := 24.0
const NET_ERR := [0.35, 0.25, 0.15, 0.08]
# feintStage: углы 0, 0.5, −0.5, 1, −1 — значения Math.cos/Math.sin V8 (проверено в node)
const FCOS := [1.0, 0.8775825618903728, 0.8775825618903728, 0.5403023058681398, 0.5403023058681398]
const FSIN := [0.0, 0.479425538604203, -0.479425538604203, 0.8414709848078965, -0.8414709848078965]
const FRAD := [3.6, 3.0, 4.4]


# ---------- belief.js ----------
static func belOf(r: float) -> Dictionary:
	var G := Sim.G
	if not JS.t(G.get("bel")):
		G.bel = {}
	var Bs: Dictionary = G.bel
	var k := JS.s(r)
	var B: Variant = Bs.get(k)
	if not JS.t(B):
		B = {"a": {}, "fooled": 0.0, "rum": null, "react": {}, "plot": {}}
		JS.oset(Bs, k, B)
	return B


static func dlog(t: String, c: String = "") -> void:
	var G := Sim.G
	if not JS.t(G.get("dlog")):
		G.dlog = []
	var L: Array = G.dlog
	L.append({"d": G.day, "t": t, "c": c if c != "" else "info"})
	if L.size() > 80:
		L.pop_front()


## шпион чужой державы при нашем дворе (его ещё не поймали) пересказывает ей наши приказы
static func courtSpyOf(r: float) -> bool:
	var G := Sim.G
	if not JS.t(G.get("court")):
		return false
	for s in G.court.secrets:
		if s.k == "spy" and SimAI.same(s.get("realm"), r) and not JS.t(s.get("done")):
			return true
	return false


## мы читаем мысли врага: свой человек при его дворе или сильная сеть Ока
static func insight(r: float) -> bool:
	var G := Sim.G
	return r >= 1 and r < 5 and (SimIntel.hasInward(r) or (JS.t(G.get("court")) and JS.n(G.court.net.get(JS.s(r))) >= 2))


## как трудно обмануть державу: ум и нрав правителя, прежние уроки, шпион при нашем дворе
static func skept(r: float) -> float:
	var c: Variant = SimDay.rulerOf(int(r))
	if c == null:
		return 0.3
	var tr: Array = c.traits
	var s: float = 0.25 + (float(JS.o(c.get("intr"), 8.0)) - 8) * 0.03 + (0.2 if tr.has("cunning") else 0.0) + (0.1 if tr.has("cautious") else 0.0) + (0.1 if tr.has("wise") else 0.0) \
		- (0.15 if tr.has("reckless") else 0.0) - (0.1 if tr.has("wrathful") else 0.0) - (0.05 if tr.has("honest") else 0.0) - (0.05 if tr.has("proud") else 0.0)
	s += 0.12 * minf(4.0, JS.n(belOf(r).get("fooled")))
	if courtSpyOf(r):
		s += 0.3
	return JS.clp(s, 0.05, 0.9)


static func skeptWord(s: float) -> String:
	if s < 0.2:
		return "доверчив"
	if s < 0.4:
		return "верит донесениям"
	if s < 0.6:
		return "осторожен"
	if s < 0.75:
		return "подозрителен"
	return "его не проведёшь"


## чутьё полководца на уловку (Сунь-цзы, гл. 7: «не преследуй притворно бегущего»)
static func genSkept(g: Variant) -> float:
	if g == null:
		return 0.2
	var tr: Array = g.traits
	return JS.clp(0.15 + (float(JS.o(g.get("intr"), 8.0)) - 8) * 0.03 + (0.25 if tr.has("cunning") else 0.0) + (0.15 if tr.has("wise") else 0.0) + (0.15 if tr.has("cautious") else 0.0) \
		- (0.15 if tr.has("reckless") else 0.0) - (0.1 if tr.has("wrathful") else 0.0), 0.02, 0.85)


## кто смотрит за державу: её войска (караваны лишь слышат дорожные слухи), замки, города и деревни
static func belObservers(r: float) -> Array:
	var G := Sim.G
	var W := Sim.W
	var L := []
	for a in G.armies:
		if JS.t(a.alive) and a.realm == r:
			var car: bool = a.kind == "caravan"
			L.append({"x": a.x, "y": a.y, "v": 3.0 if car else SimIntel.visionOf(a), "src": "rumor" if car else "eye"})
	for S in G.setts:
		if S.ctrl == r:
			var ws: Dictionary = W.setts[int(S.id)]
			L.append({"x": ws.x + 0.5, "y": ws.y + 0.5, "v": 3.0 if ws.type == "village" else 5.0, "src": "eye"})
	return L


## куда, похоже, идёт войско: место в конце его пути
static func belGuessTgt(b: Dictionary) -> float:
	var p: Variant = b.get("path")
	if p != null and p.size() > 1:
		var g := int(p[p.size() - 1])
		return float(SimDay.settNear(g % MW + 0.5, float(g / MW) + 0.5, 1.6))
	return -1.0


static func belSee(r: float, b: Dictionary, d: float, src: String) -> Dictionary:
	var G := Sim.G
	var B := belOf(r)
	var close := d < 1.6
	var spy := src == "spy"
	var key := JS.s(b.id)
	if src == "rumor":
		var o: Variant = B.a.get(key)
		if JS.t(o) and o.src != "rumor" and G.day - o.day < 3:
			return {"e": o, "old": o, "close": false}
	var p := SimAI.perceivedPower(b, r)
	var men := Sim.armyMen(b)
	var fires := JS.t(b.get("fires"))
	var feint := JS.t(b.get("feint"))
	if spy:
		p = SimDay.powerU(b.u, b.xp)   # шпион читает списки полков: ни костры, ни знамёна его не обманут
	else:
		if close and fires:
			p /= 1.8   # вблизи видно пустые палатки
		var e := 0.03 if close else JS.clp(0.06 + d * 0.02, 0, 0.3)
		var nz := (JSM.hash2(b.id * 7 + r, floorf(G.day / 4), 91) - 0.5) * 2 * e
		p *= 1 + nz
		men *= (1 + nz) * (1.8 if fires and not close else 1.0)
		if feint and not close:
			p *= 1.2
			men *= 1.2
		if src == "rumor":
			var k := 0.8 + JSM.hash2(b.id, G.day, 5) * 0.5
			p *= k
			men *= k
	var e2 := {"x": b.x, "y": b.y, "p": JS.rnd(p), "men": maxf(10.0, JS.rnd(men / 10) * 10), "day": G.day, "src": src, "tgt": belGuessTgt(b),
		"fires": fires and not spy and not close, "feint": feint and not spy and not close}
	var old: Variant = B.a.get(key)
	JS.oset(B.a, key, e2)
	return {"e": e2, "old": old, "close": close}


## раз в день, до замыслов держав: каждая чужая держава смотрит на войска короны
static func belDaily() -> void:
	var G := Sim.G
	var pr: float = G.player.realm
	var mine := []
	for b in G.armies:
		if JS.t(b.alive) and b.realm == pr and (b.kind == "lord" or b.kind == "player"):
			mine.append(b)
	for r in range(1, 5):
		if not SimDay.alive(r):
			continue
		var B := belOf(r)
		var obs := belObservers(r)
		var cs := courtSpyOf(r)
		for b in mine:
			var bd := 1e9
			var src := ""
			var hid := JS.t(b.get("hidden"))
			for o in obs:
				var d := JS.hypot(o.x - b.x, o.y - b.y)
				if d > o.v or d >= bd or (hid and d > 2.5):
					continue
				bd = d
				src = o.src
			if src != "":
				var res := belSee(r, b, bd, src)
				deceitSeen(r, b, res)
			elif cs and b.kind == "lord" and fmod(G.day + b.id + r, 6.0) == 0.0:
				belSee(r, b, 0, "spy")
		var A: Dictionary = B.a
		for id in A.keys():
			var e: Dictionary = A[id]
			var b: Variant = Sim.armyById(String(id).to_float())
			if b == null or b.realm != pr or G.day - e.day > BEL_AGE:
				A.erase(id)
		if JS.t(B.rum) and B.rum.until < G.day:
			B.rum = null
		var Rc: Dictionary = B.react
		for id in Rc.keys():
			if G.day - Rc[id].day > 20:
				Rc.erase(id)
		var Pl: Dictionary = B.plot
		for t in Pl.keys():
			if Pl[t] < G.day:
				Pl.erase(t)


## какую силу, по мнению державы, выставит корона: виденные войска — какими их видели, прочие — по слухам
static func belPower(by: float) -> float:
	var G := Sim.G
	var pr: float = G.player.realm
	var B := belOf(by)
	var rf: float = B.rum.f if JS.t(B.rum) else 1.0
	var ck := 1.0
	for s in G.spies:
		if s.type == "converted" and s.realm == by and s.until >= G.day:
			ck = s.factor
			break
	var p := 0.0
	for a in G.armies:
		if not JS.t(a.alive) or a.realm != pr or (a.kind != "lord" and a.kind != "player"):
			continue
		var e: Variant = B.a.get(JS.s(a.id))
		p += e.p if JS.t(e) else SimDay.powerU(a.u, a.xp) * rf * ck
	for S in G.setts:
		if S.ctrl == pr:
			p += garSeen(S, by) * 0.4
	return p


## гарнизон глазами врага: соломенные воины на стенах сходят за людей, пока кто-нибудь не подойдёт близко
static func garSeen(S: Dictionary, by: float) -> float:
	var G := Sim.G
	var g := SimDay.powerU(S.gar, null)
	if SimAI.nv(S, "dummy") > G.day and S.ctrl == G.player.realm and by != G.player.realm and not (JS.t(S.get("dumK")) and JS.t(S.dumK.get(JS.s(by)))) and not courtSpyOf(by):
		return g * 1.8
	return g


## что корона знает о чужом войске: последняя встреча остаётся на карте призраком
static func know(b: Dictionary, src: String, err := 0.0) -> void:
	var G := Sim.G
	if not JS.t(G.get("know")):
		G.know = {}
	var K: Dictionary = G.know
	var men: float = SimIntel.estimateMen(b).n
	if err != 0.0:
		men = maxf(10.0, JS.rnd(Sim.armyMen(b) * (1 + (JSM.hash2(b.id, G.day, 31) - 0.5) * 2 * err) / 10) * 10)
	var key := JS.s(b.id)
	var o: Variant = K.get(key)
	var oa: Variant = b.get("onArrive")
	var tgt := -1.0
	if JS.t(oa) and oa.k == "siege":
		tgt = oa.s
	elif JS.t(o) and o.tgt >= 0 and G.day - o.day < 6:
		tgt = o.tgt
	JS.oset(K, key, {"x": b.x, "y": b.y, "men": men, "day": G.day, "src": src, "realm": b.realm, "gen": b.gen, "fires": JS.t(b.get("fires")) and src == "eye", "tgt": tgt})


static func knowDaily() -> void:
	var G := Sim.G
	if not JS.t(G.get("know")):
		G.know = {}
	var K: Dictionary = G.know
	var pr: float = G.player.realm
	for b in G.armies:
		if not JS.t(b.alive) or b.realm == pr or b.realm > 4 or b.kind != "lord" or not SimIntel.armyVisible(b):
			continue
		if G.vis[Sim.armyTile(b)] == 2:
			know(b, "eye")
		else:
			know(b, "inw", 0.05)
	if JS.t(G.get("court")):
		for t in range(1, 5):
			var lv := JS.n(G.court.net.get(str(t)))
			if lv == 0 or not SimDay.alive(t) or SimIntel.hasInward(t) or fmod(G.day + t, 5 - lv) != 0:
				continue
			var err: float = NET_ERR[int(lv)] if lv >= 0 and lv < 4 and lv == floorf(lv) else 0.0
			for b in G.armies:
				if JS.t(b.alive) and b.realm == t and b.kind == "lord" and not SimIntel.armyVisible(b):
					know(b, "net", err)
	for id in K.keys():
		var b: Variant = Sim.armyById(String(id).to_float())
		if b == null or G.day - K[id].day > KNOW_AGE:
			K.erase(id)


# ---------- deceit.js ----------
static func nArm(n: float) -> String:
	return JS.s(n) + " " + Sim.plural(n, "войско", "войска", "войск")


## «Лоренцо (Республика, ≈170 воинов)» — кто, чей и сколько в одной скобке
static func armyWho(a: Dictionary, n: float) -> String:
	var g: Variant = Sim.charOf(a.gen)
	if a.kind == "player":
		return "войско короля" + (" (≈" + SimArmy.voin(n) + ")" if JS.t(n) else "")
	return (String(g.name) if g != null else "войско") + " (" + Sim.realmName(a.realm) + (", ≈" + SimArmy.voin(n) if JS.t(n) else "") + ")"


## armyLabel(b).replace(/ \(.*\)$/, ''): отрезать от первой « (», если строка кончается «)»
static func cutParen(s: String) -> String:
	if not s.ends_with(")"):
		return s
	var i := s.find(" (")
	return s.substr(0, i) if i >= 0 else s


## где встаёт ложный марш: примерно в дне пути от стен, на сухой земле, куда войско может дойти
static func feintStage(a: Dictionary, sid: int) -> int:
	var W := Sim.W
	var ws: Dictionary = W.setts[sid]
	var cx: float = ws.x + 0.5
	var cy: float = ws.y + 0.5
	var dx: float = a.x - cx
	var dy: float = a.y - cy
	var n := JS.hypot(dx, dy)
	if not JS.t(n):
		n = 1.0
	dx /= n
	dy /= n
	var tries := 0
	var first := -1
	for R2 in FRAD:
		for ti in 5:
			var ca: float = FCOS[ti]
			var sa: float = FSIN[ti]
			var x := int(floorf(cx + (dx * ca - dy * sa) * R2))
			var y := int(floorf(cy + (dx * sa + dy * ca) * R2))
			if not SimDay.inMap(x, y):
				continue
			var j := y * MW + x
			if not (JS.n(Sim.TINFO[W.ter[j]].get("cost")) > 0) or Sim.settAtTile(j) >= 0:
				continue
			if JS.hypot(x + 0.5 - a.x, y + 0.5 - a.y) < 1.5:
				return j   # уже на месте
			if first < 0:
				first = j
			tries += 1
			if tries > 6:
				return first
			var p: Variant = SimArmy.planPath(a, j)
			if p != null and p.size() > 1:
				return j
	return first if first >= 0 else Sim.armyTile(a)


static func feintEnd(a: Dictionary) -> float:
	var f: Variant = a.get("feint")
	var n := JS.n(f.get("drew")) if JS.t(f) else 0.0
	a.feint = null
	a.fires = 0.0
	return n


## ложный марш войска короны под рыцарем (приказ «Ложный марш»); ядро cmdArmyTick — SimCmd._cmdTick
static func feintTick(a: Dictionary) -> void:
	var G := Sim.G
	var W := Sim.W
	var o: Dictionary = a.cmd
	var pr: float = G.player.realm
	var tv: Variant = o.get("t")
	var ot := int(tv) if (typeof(tv) == TYPE_FLOAT or typeof(tv) == TYPE_INT) else -1
	var S: Variant = G.setts[ot] if ot >= 0 and ot < G.setts.size() else null
	var ws: Variant = W.setts[ot] if ot >= 0 and ot < W.setts.size() else null
	if S == null or S.ctrl == pr or not (Sim.hostile(pr, S.ctrl) or S.ctrl == 5.0):
		feintEnd(a)
		a.cmd = {"o": "hold", "mode": o.get("mode"), "day": G.day, "x": a.x, "y": a.y}
		if ws != null:
			SimCmd.cmdNote(a, "feint0", "Ложный марш на " + ws.name + " потерял смысл: крепость не вражеская. Стою и жду приказа.", true)
		await SimCmd._cmdTick(a)
		return
	if not o.has("st"):
		o.st = float(feintStage(a, ot))
	if not JS.t(a.get("feint")) or a.feint.s != o.t:
		a.feint = {"s": o.t, "d0": G.day, "drew": 0.0}
	a.fires = 1.0
	a.hidden = 0.0
	var st := int(o.st)
	var sx := st % MW + 0.5
	var sy := float(st / MW) + 0.5
	var d := JS.hypot(a.x - sx, a.y - sy)
	if not JS.t(o.get("told")):
		o.told = 1.0
		SimCmd.cmdNote(a, "feint", "Идём к " + ws.name + " с кострами, знамёнами и барабанами, будто за нами вся армия короны. В бой не ввяжемся: встанем в дне пути от стен и простоим шесть дней.", true)
	if d < 2.5 and not JS.t(o.get("arr")):
		o.arr = G.day
		dlog("Ложный марш: " + SimArmy.armyLabel(a) + " встал у " + ws.name + ". Костров вдвое больше, чем людей.")
	if JS.t(o.get("arr")) and G.day - o.arr >= 6:
		var n := feintEnd(a)
		a.cmd = {"o": "hold", "mode": o.get("mode"), "day": G.day, "x": a.x, "y": a.y}
		SimCmd.cmdNote(a, "feint2", "Шесть дней мы пугали " + ws.name + ". " + ("Враг стянул сюда " + nArm(n) + "." if JS.t(n) else "Враг так и не тронулся с места.") + " Гасим лишние костры и ждём приказа.", true)
		dlog("Ложный марш у " + ws.name + " окончен: " + ("враг стянул туда " + nArm(n) + "." if JS.t(n) else "враг не поверил или не успел."), "good" if JS.t(n) else "info")
		await SimCmd._cmdTick(a)
		return
	var save: Dictionary = a.cmd
	a.cmd = {"o": "hold", "mode": save.get("mode"), "day": save.get("day"), "x": sx, "y": sy}
	await SimCmd._cmdTick(a)
	a.cmd = save
	if JS.t(a.get("ai")) and a.ai.task == "flee":
		feintEnd(a)
		a.cmd = {"o": "hold", "mode": o.get("mode"), "day": G.day, "x": a.x, "y": a.y}
		dlog("Ложный марш у " + ws.name + " сорван: враг пришёл с силой, и " + SimArmy.armyLabel(a) + " отступил.", "bad")


## враг подошёл вплотную к ложному маршу и разглядел, как нас мало
static func deceitSeen(r: float, b: Dictionary, res: Dictionary) -> void:
	if not JS.t(b.get("feint")) or not res.close:
		return
	var G := Sim.G
	var B := belOf(r)
	B.fooled = JS.n(B.get("fooled")) + 1
	for a in G.armies:
		if JS.t(a.alive) and a.realm == r and JS.t(a.get("ai")) and JS.t(a.ai.get("guard")) and a.ai.guard.by == b.id:
			a.ai.guard = null
	var t := "Ложный марш раскрыт: разъезд державы " + Sim.realmName(r) + " подобрался вплотную к нашему стану (" + ("войско короля" if b.kind == "player" else cutParen(SimArmy.armyLabel(b))) + ") и увидел, что костров много, а людей мало."
	dlog(t, "bad")
	if b.kind == "lord":
		SimCmd.cmdNote(b, "feintrev", "Их разъезд подошёл вплотную и разглядел, как нас мало. Уловка раскрыта, государь.", true)
		if JS.t(b.get("cmd")) and b.cmd.o == "feint":
			b.cmd = {"o": "hold", "mode": b.cmd.get("mode"), "day": G.day, "x": b.x, "y": b.y}
	else:
		Sim.glog(t, "bad")
	feintEnd(b)


static func eyeNote(r: float, subj: String, text: String, c: String = "") -> bool:
	if not insight(r):
		return false
	dlog(text, c)
	if JS.t(Sim.G.get("court")):
		SimDyn.letterFromSeat("eye", subj, text)
	else:
		Sim.glog(text, c if c != "" else "info")
	return true


## что держава считает угрозой: войска короны, виденные со вчерашнего дня, и крепость, к которой они идут или стоят ближе всего
static func belThreats(r: float) -> Array:
	var G := Sim.G
	var W := Sim.W
	var B := belOf(r)
	var L := []
	var A: Dictionary = B.a
	for id in A.keys():
		var e: Dictionary = A[id]
		if G.day - e.day > 1 or e.src == "rumor":
			continue
		var b: Variant = Sim.armyById(String(id).to_float())
		if b == null:
			continue
		var sid := -1
		var et := int(e.tgt)
		if e.tgt >= 0 and G.setts[et].ctrl == r and W.setts[et].type != "village":
			sid = et
		if sid < 0:
			var bd := 4.6
			for S in G.setts:
				if S.ctrl != r or W.setts[int(S.id)].type == "village":
					continue
				var ws: Dictionary = W.setts[int(S.id)]
				var d := JS.hypot(ws.x + 0.5 - e.x, ws.y + 0.5 - e.y)
				if d < bd:
					bd = d
					sid = int(S.id)
		if sid >= 0:
			L.append({"b": b, "e": e, "sid": sid})
	return L


## держава отвечает тому, во что верит: шлёт войска сторожить крепость, на которую, как ей кажется, идёт сила
static func belReact(r: float) -> void:
	var G := Sim.G
	var W := Sim.W
	var B := belOf(r)
	for th in belThreats(r):
		var b: Dictionary = th.b
		var e: Dictionary = th.e
		var sid: int = th.sid
		var S: Dictionary = G.setts[sid]
		var ws: Dictionary = W.setts[sid]
		if JS.t(S.siege):
			continue
		var bk := JS.s(b.id)
		var R1: Variant = B.react.get(bk)
		if JS.t(R1) and R1.s == sid and G.day - R1.day < 8:
			continue
		var gp: float = SimDay.powerU(S.gar, null) * (1 + S.walls * 0.6)
		if e.p < gp * 0.8:
			continue   # стены выдержат
		var feint := JS.t(b.get("feint"))
		var ok: bool
		if courtSpyOf(r):
			ok = not feint
		else:
			ok = Sim.R.f() >= skept(r)
		JS.oset(B.react, bk, {"day": G.day, "s": float(sid), "ok": 1.0 if ok else 0.0})
		if not ok:
			if feint:
				dlog(Sim.realmName(r) + " не поверили ложному маршу у " + ws.name + ": правитель " + skeptWord(skept(r)) + ".", "bad")
			if feint:
				eyeNote(r, "Ложный марш не обманул", "Наши люди при дворе державы " + Sim.realmName(r) + " доносят: правитель не поверил, что на " + ws.name + " идёт большое войско. Его полки не тронулись с места.")
			continue
		var cand := []
		for a in G.armies:
			if JS.t(a.alive) and a.realm == r and a.kind == "lord" and a.mode != "siege" and not (JS.t(a.get("ai")) and (JS.t(a.ai.get("guard")) or JS.t(a.ai.get("feint")) or a.ai.task == "flee")):
				var d := JS.hypot(a.x - ws.x - 0.5, a.y - ws.y - 0.5)
				if d < 18 * Sim.SEAT_K and d > 1.5:
					cand.append({"a": a, "d": d})
		JS.sort(cand, func(p, q): return p.d - q.d)
		var need: float = e.p * 1.1 - gp
		var sent := []
		for i in mini(2, cand.size()):
			if need <= 0:
				break
			var a: Dictionary = cand[i].a
			if not JS.t(a.get("ai")):
				a.ai = {"task": "idle", "t": 0.0}
			a.ai.guard = {"s": float(sid), "until": G.day + 12, "by": b.id}
			a.path = null
			a.onArrive = null
			a.ai.target = -1.0
			need -= SimDay.powerU(a.u, a.xp)
			sent.append(a)
		if sent.is_empty():
			continue
		if feint:
			b.feint.drew = JS.n(b.feint.get("drew")) + sent.size()
		var names := []
		for a in sent:
			names.append(SimArmy.armyLabel(a))
		eyeNote(r, "Враг поверил!" if feint else "Враг стягивает войска", "Наши люди при дворе державы " + Sim.realmName(r) + " доносят: там уверены, что на " + ws.name + " идёт " + ("сам король" if b.kind == "player" else "большое войско") + " (по их счёту ≈" + SimArmy.voin(e.men) + "). Туда спешат: " + " и ".join(names) + "." + (" Их прежние цели брошены — ложный марш удался." if feint else ""), "good" if feint else "info")


## наши ложные марши видят, как подходит враг: уловка сработала
static func feintWatch() -> void:
	var G := Sim.G
	for b in G.armies:
		if not JS.t(b.alive) or b.realm != G.player.realm or not JS.t(b.get("feint")):
			continue
		if b.kind == "player" and (b.siegeOf >= 0 or G.day > SimAI.nv(b.feint, "until")):
			var n := feintEnd(b)
			dlog("Ложный марш войска короля окончен" + (": враг стянул " + nArm(n) + "." if JS.t(n) else "."), "good" if JS.t(n) else "info")
			continue
		var vr := SimIntel.visionOf(b)
		if not JS.t(b.feint.get("seen")):
			b.feint.seen = []
		var seen: Array = b.feint.seen
		for a in G.armies:
			if not JS.t(a.alive) or not JS.t(a.get("ai")) or not JS.t(a.ai.get("guard")) or a.ai.guard.by != b.id or seen.has(a.id) or JS.hypot(a.x - b.x, a.y - b.y) > vr:
				continue
			seen.append(a.id)
			var t: String = "К " + Sim.W.setts[int(a.ai.guard.s)].name + " подходит " + armyWho(a, SimIntel.estimateMen(a).n) + ". Враг поверил ложному маршу!"
			dlog(t, "good")
			if b.kind == "lord":
				SimCmd.cmdNote(b, "feintok" + JS.s(a.id), t, true)
			else:
				Sim.glog(t, "good")


static func dummyDaily() -> void:
	var G := Sim.G
	var W := Sim.W
	var pr: float = G.player.realm
	for S in G.setts:
		if not JS.t(S.get("dummy")):
			continue
		var ws: Dictionary = W.setts[int(S.id)]
		if S.dummy <= G.day or S.ctrl != pr:
			var mine: bool = S.ctrl == pr
			S.dummy = 0.0
			S.dumK = null
			if mine:
				dlog("Чучела на стенах " + ws.name + " истрепались — их сняли.")
			continue
		for r in range(1, 5):
			if not SimDay.alive(r) or (JS.t(S.get("dumK")) and JS.t(S.dumK.get(str(r)))):
				continue
			if courtSpyOf(r):
				if not JS.t(S.get("dumK")):
					S.dumK = {}
				JS.oset(S.dumK, str(r), 1.0)
				continue
			var near := false
			for a in G.armies:
				if JS.t(a.alive) and a.realm == r and a.kind != "caravan" and JS.hypot(a.x - ws.x - 0.5, a.y - ws.y - 0.5) < 1.6:
					near = true
					break
			if near:
				if not JS.t(S.get("dumK")):
					S.dumK = {}
				JS.oset(S.dumK, str(r), 1.0)
				var B := belOf(r)
				B.fooled = JS.n(B.get("fooled")) + 1
				dlog("Разъезд державы " + Sim.realmName(r) + " подошёл к стенам " + ws.name + " вплотную и разглядел чучела.", "bad")


## притворное бегство: кто гнался за ним, растягивает строй
static func lureDaily() -> void:
	var G := Sim.G
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	if SimAI.nv(pa, "feign") > G.day:
		pa.morale = maxf(5.0, pa.morale - 1)
		for b in G.armies:
			if JS.t(b.alive) and b.realm != pa.realm and b.kind == "lord" and JS.t(b.get("ai")) and SimAI.same(b.ai.get("prey"), pa.id) and b.ai.task == "hunt":
				b.lure = JS.n(b.get("lure")) + 1
	elif JS.t(pa.get("feign")):
		pa.feign = 0.0
		for b in G.armies:
			if JS.t(b.get("lure")):
				b.lure = 0.0
		dlog("Притворное отступление окончено.")


static func lordsOf(r: float) -> Array:
	var L := []
	for a in Sim.G.armies:
		if JS.t(a.alive) and a.realm == r and a.kind == "lord":
			L.append(a)
	return L


## уловки врага: ложные костры, засада в лесу, ложный марш слабейшего войска на крепость короны
static func aiTricks(r: int) -> void:
	var G := Sim.G
	var W := Sim.W
	var pr: float = G.player.realm
	var war := JS.t(G.rel[r][int(pr)].war)
	var L := lordsOf(r)
	var mine := []
	for b in G.armies:
		if JS.t(b.alive) and b.realm == pr and (b.kind == "lord" or b.kind == "player"):
			mine.append(b)
	for a in L:
		if not JS.t(a.get("ai")):
			continue
		var g: Variant = Sim.charOf(a.gen)
		if JS.t(a.ai.get("feint")):
			if not war or a.ai.feint.until < G.day:
				a.ai.feint = null
				a.fires = 0.0
			else:
				a.fires = 1.0
				continue
		if JS.t(a.get("path")) and a.path.size() > 1 and JS.t(a.hidden):
			a.hidden = 0.0
		if not war or g == null:
			a.fires = 0.0
			a.hidden = 0.0
			continue
		var cun: bool = g.traits.has("cunning") or JS.n(g.get("intr")) >= 13
		var my := SimDay.powerU(a.u, a.xp)
		var strong := false
		for b in mine:
			if JS.hypot(b.x - a.x, b.y - a.y) < 9 and SimDay.powerU(b.u, b.xp) > my * 1.2:
				strong = true
				break
		var ter: int = W.ter[Sim.armyTile(a)]
		var cover := ter == WorldData.FOREST or ter == WorldData.DFOREST or ter == WorldData.HILLS or ter == WorldData.MARSH
		if strong and (cun or g.traits.has("cautious")) and cover and not JS.t(a.get("path")) and a.mode != "siege":
			if not JS.t(a.hidden):
				a.hidden = 1.0
				a.fires = 0.0
				a.hideD = G.day
		elif strong and cun and not JS.t(a.hidden):
			if not JS.t(a.fires):
				a.fires = 1.0
				a.fireD = G.day
				eyeNote(r, "Ложные костры", "У войска " + SimArmy.armyLabel(a) + " костров вдвое больше, чем людей: на деле там ≈" + SimArmy.voin(JS.rnd(Sim.armyMen(a) / 10) * 10) + ". Не верьте дыму, государь.", "warn")
		elif not strong:
			if JS.t(a.fires) and G.day - JS.n(a.get("fireD")) > 3:
				a.fires = 0.0
			if JS.t(a.hidden) and G.day - JS.n(a.get("hideD")) > 3:
				a.hidden = 0.0
	# ложный марш слабейшего войска на крепость короны, пока другие бьют в ином месте
	if not war or fmod(G.day + r * 2, 6.0) != 0.0 or Sim.R.f() > 0.22:
		return
	for a in L:
		if JS.t(a.get("ai")) and JS.t(a.ai.get("feint")):
			return
	var ru: Variant = SimDay.rulerOf(r)
	var free := []
	for a in L:
		if JS.t(a.get("ai")) and a.mode != "siege" and not JS.t(a.ai.get("guard")) and a.ai.task != "flee" and Sim.armyMen(a) >= 60:
			free.append(a)
	if free.size() < 2:
		return
	var smart: bool = ru != null and (ru.traits.has("cunning") or JS.n(ru.get("intr")) >= 12)
	if not smart:
		for a in free:
			var g: Variant = Sim.charOf(a.gen)
			if g != null and g.traits.has("cunning"):
				smart = true
				break
	if not smart:
		return
	var srt: Array = JS.sort(free.duplicate(), func(p, q): return SimDay.powerU(p.u, p.xp) - SimDay.powerU(q.u, q.xp))
	var W0: Dictionary = srt[0]
	var T: Variant = null
	var bd := 24 * Sim.SEAT_K
	for S in G.setts:
		if S.ctrl != pr or W.setts[int(S.id)].type == "village" or JS.t(S.siege):
			continue
		var ws: Dictionary = W.setts[int(S.id)]
		var d := JS.hypot(ws.x - W0.x, ws.y - W0.y)
		if d < bd:
			bd = d
			T = S
	if T == null:
		return
	var st := feintStage(W0, int(T.id))
	W0.ai.feint = {"s": T.id, "until": G.day + 12, "st": float(st)}
	W0.fires = 1.0
	W0.hidden = 0.0
	W0.path = null
	W0.onArrive = null
	SimAI.goTo(W0, st, "feint")
	var e: Variant = SimDyn.seatChar("eye") if JS.t(G.get("court")) else null
	if insight(r) and Sim.R.chance(JS.clp(0.45 + (float(e.intr) if e != null else 6.0) / 40, 0.3, 0.9)):
		eyeNote(r, "Ложный марш врага", "Наши люди при дворе державы " + Sim.realmName(r) + " доносят: " + armyWho(W0, JS.rnd(Sim.armyMen(W0) / 10) * 10) + " идёт к " + W.setts[int(T.id)].name + " с кострами на вдвое большее войско. Это приманка, государь: настоящий удар готовят в другом месте.", "warn")


static func deceitDaily() -> void:
	var G := Sim.G
	var pr := int(G.player.realm)
	for r in range(1, 5):
		if not SimDay.alive(r):
			continue
		if JS.t(G.rel[r][pr].war):
			belReact(r)
		aiTricks(r)
	feintWatch()
	dummyDaily()
	lureDaily()
