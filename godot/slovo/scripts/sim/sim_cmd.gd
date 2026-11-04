class_name SimCmd
## Войска короны под рыцарями и дипломатия — перенос command.js (cmdArmyTick с обёрткой deceit.js, донесения cmdNote,
## погоня cmdHunt, слияние войск, донесения о битвах) и diplo.js (война с обёртками reign.js и deceit.js, мир, предложения
## мира, вести msg). Тексты — дословно из HTML: они сверяются (tools/state_check.gd).

const MW := WorldData.MW
const CMD := {"hold": {"n": "Стоять", "tgt": ""}, "defend": {"n": "Защищать", "tgt": "own"}, "attack": {"n": "Наступать", "tgt": "foe"},
	"patrol": {"n": "Охранять дороги", "tgt": "own"}, "join": {"n": "Соединиться", "tgt": "army"}, "ret": {"n": "В столицу", "tgt": ""},
	"feint": {"n": "Ложный марш", "tgt": "foe"}}
const MERGE_K := ["food", "fodder", "arrows", "weap", "horses", "wagons", "pitch", "wounded", "sick"]


static func _sett(v: Variant) -> Variant:
	if typeof(v) != TYPE_FLOAT and typeof(v) != TYPE_INT:
		return null
	var i := int(v)
	return Sim.G.setts[i] if i >= 0 and i < Sim.G.setts.size() and float(i) == float(v) else null


## «Наступать · Ригель (замысел)»
static func ordLabel(o: Variant) -> String:
	if o == null or typeof(o) != TYPE_DICTIONARY:
		return "—"
	var d: Variant = CMD.get(o.get("o"))
	if d == null:
		return "—"
	var t := ""
	if d.tgt == "own" or d.tgt == "foe":
		t = " · " + Sim.W.setts[int(o.t)].name if _sett(o.get("t")) != null else ""
	elif d.tgt == "army":
		var b: Variant = Sim.armyById(o.get("t"))
		t = " · к " + SimArmy.armyLabel(b) if b != null else ""
	return d.n + t + (" (приказ)" if o.get("mode") == "order" else " (замысел)")


## донесение из войска (не чаще раза в 4 дня на тему, если не force); текст считается до проверки — как в HTML
static func cmdNote(a: Dictionary, key: String, text: String, force := false) -> void:
	var G := Sim.G
	if not JS.t(a.get("notes")):
		a.notes = {}
	if not force and SimAI.nv(a.notes, key) > G.day - 4:
		return
	JS.oset(a.notes, key, G.day)
	var g: Variant = Sim.charOf(a.gen)
	SimDyn.addLetter({"from": Sim.charName(g) if g != null else "Войско короны", "fc": g.id if g != null else -1.0, "subj": "Донесение из войска", "text": text, "x": a.x, "y": a.y, "army": a.id})


## noisy (council.js): число глазами человека — чем ниже умение, тем больше ошибка
static func noisy(v: float, c: Variant, sk: String, honBias := 0.0) -> float:
	var s: float = JS.n(c.get(sk)) if c != null else 0.0
	var err := JS.clp((20 - s) / 45, 0.04, 0.4)
	var x := v * (1 + Sim.R.range(-err, err))
	if JS.t(honBias):
		x *= 1 + honBias
	var k := 10.0 if v > 200 else 1.0
	return maxf(0.0, JS.rnd(x / k) * k)


static func cmdHunt(a: Dictionary, radius: float, kMax: float) -> bool:
	var G := Sim.G
	var my := SimDay.powerU(a.u, a.xp)
	var skip: Variant = a.ai.get("skip")
	var L := []
	for x in SimAI.threatsNear(a, radius):
		if x.p < my * kMax and not (JS.t(skip) and SimAI.nv(skip, JS.s(x.b.id)) > G.day):
			L.append(x)
	var prey: Variant = SimAI._nearest(L)
	if prey == null:
		return false
	if not SimAI.same(a.ai.get("prey"), prey.b.id):
		a.ai.prey = prey.b.id
		a.ai.h0 = G.day
	if G.day - SimAI.nv(a.ai, "h0") > 5:
		if not JS.t(a.ai.get("skip")):
			a.ai.skip = {}
		JS.oset(a.ai.skip, JS.s(prey.b.id), G.day + 10)
		a.ai.prey = -1.0
		return false
	if not JS.t(a.get("path")) or SimAI.nv(a.ai, "t") <= 0:
		SimAI.goTo(a, Sim.armyTile(prey.b), "hunt")
		a.ai.t = 1.0
	return true


## cmdArmyTick с обёрткой deceit.js: ложный марш — свой ход; иначе уловка кончается
static func cmdArmyTick(a: Dictionary) -> void:
	var o: Variant = a.get("cmd")
	if JS.t(o) and o.o == "feint":
		await SimBel.feintTick(a)
		return
	if JS.t(a.get("feint")):
		SimBel.feintEnd(a)
	await _cmdTick(a)


## ядро cmdArmyTick (command.js): опасность, вода, отдых, гнев, затем приказ (стоять, защищать, охранять, наступать, соединиться, домой)
static func _cmdTick(a: Dictionary) -> void:
	var G := Sim.G
	var W := Sim.W
	if not JS.t(a.get("ai")):
		a.ai = {"task": "idle", "t": 0.0}
	if not JS.t(a.get("cmd")):
		a.cmd = {"o": "hold", "mode": "intent", "day": G.day, "x": a.x, "y": a.y}
	var o: Dictionary = a.cmd
	var gen: Variant = Sim.charOf(a.gen)
	var men := Sim.armyMen(a)
	var my := SimDay.powerU(a.u, a.xp)
	var trs: Array = gen.traits if gen != null else []
	var skill: float = gen.mar if gen != null else 5.0
	SimAI._dec(a.ai, "t")
	if men <= 0:
		return
	# 1) опасность: отход (пять пороков полководца меняют пороги)
	var fk := 1.3
	if trs.has("cautious"):
		fk = 1.15
	if trs.has("generous"):
		fk = 1.1
	if trs.has("proud"):
		fk = 2.0
	if trs.has("reckless"):
		fk = 2.4
	if trs.has("craven"):
		fk = 0.85
	var big := []
	for x in SimAI.threatsNear(a, 8):
		if x.p > my * fk and x.b.kind != "bandit":
			big.append(x)
	if big.size() > 0 and a.mode != "siege":
		var obey: bool = o.o == "hold" and o.get("mode") == "order" and skill < 13
		if not obey:
			if a.ai.task != "flee" or not JS.t(a.get("path")):
				var s := SimAI.nearestOwnSett(a, true)
				if s >= 0 and SimDay.settNear(a.x, a.y, 1.2) != s:
					SimAI.goTo(a, int(W.setts[s].i), "flee")
					var txt: String = "Враг сильнее нас: у него ≈" + SimArmy.voin(noisy(Sim.armyMen(big[0].b), gen, "mar")) + ". Отхожу к " + W.setts[s].name + ", чтобы сберечь войско." \
						+ (" Простите, государь: «есть приказы государя, которых не исполняют» (гл. 8)." if o.o == "hold" and o.get("mode") == "order" else "")
					cmdNote(a, "flee", txt)
			return
	# 2) вода, 3) отдых и припасы
	if a.water < 1 and a.mode != "siege" and not SimDay.nearWater(Sim.armyTile(a)):
		if a.ai.task != "water" or not JS.t(a.get("path")):
			var w := SimAI.waterTileNear(Sim.armyTile(a))
			if w >= 0 and SimAI.goTo(a, w, "water"):
				return
		else:
			return
	var soft := 1.35 if trs.has("generous") else 1.0
	if a.mode != "siege" and (a.food < men * 2.5 or a.morale < 30 * soft or a.fat > 85 / soft):
		if a.ai.task != "rest":
			var s := SimAI.nearestOwnSett(a, true, a.food < men * 2.5)
			if s >= 0 and SimDay.settNear(a.x, a.y, 1.2) != s:
				SimAI.goTo(a, int(W.setts[s].i), "rest")
				cmdNote(a, "rest", "Люди устали и голодны. Веду войско на отдых в " + W.setts[s].name + ".")
			else:
				a.ai.task = "rest"
				a.ai.t = 4.0
		elif not JS.t(a.get("path")) and SimAI.nv(a.ai, "t") <= 0:
			a.ai.task = "idle"
		return
	if a.mode == "siege":
		return
	# вспыльчивый полководец клюёт на приманку, где бы ни стоял
	if trs.has("wrathful") and o.o != "join" and o.o != "ret" and cmdHunt(a, 9, 1.15):
		if o.o == "hold" or o.o == "defend":
			cmdNote(a, "wrath", "Враг дразнит нас у самых стен! Я проучу наглецов, государь.")
		return
	var intent: bool = o.get("mode") == "intent"
	var reck := trs.has("reckless")
	match String(o.o):
		"hold":
			if cmdHunt(a, 4.0 if intent else 2.0, 1.4 if reck else 0.8):
				return
			if o.has("x") and JS.hypot(a.x - o.x, a.y - o.y) > 2.5 and not JS.t(a.get("path")):
				SimAI.goTo(a, int(floorf(o.y)) * MW + int(floorf(o.x)), "post")
			return
		"defend", "patrol":
			var S: Variant = _sett(o.get("t"))
			if S == null:
				a.cmd = {"o": "hold", "mode": o.get("mode"), "day": G.day, "x": a.x, "y": a.y}
				return
			var ws: Dictionary = W.setts[int(o.t)]
			if S.ctrl != 0.0:
				if o.o == "defend":
					cmdNote(a, "lost", "Мы опоздали: " + ws.name + " в руках врага. " + ("Встану рядом и буду ждать случая отбить." if intent else "Жду приказа."), true)
					a.cmd = {"o": "attack" if intent else "hold", "t": o.t, "mode": o.get("mode"), "day": G.day, "x": a.x, "y": a.y}
				return
			if JS.t(S.siege):
				var b: Variant = Sim.armyById(S.siege.by)
				if b != null and SimAI.perceivedPower(b, 0.0) < (my + SimDay.powerU(S.gar, null) * 0.5) * (1.6 if reck else 1.1):
					if not JS.t(a.get("path")) or not SimAI.same(a.ai.get("prey"), b.id):
						a.ai.prey = b.id
						SimAI.goTo(a, Sim.armyTile(b), "relieve")
						cmdNote(a, "relieve", ws.name + " в осаде! Иду снимать осаду.")
					return
			if cmdHunt(a, 6.0 if o.o == "patrol" else (6.0 if intent else 3.0), 1.4 if reck else 0.9):
				return
			var d := JS.hypot(ws.x + 0.5 - a.x, ws.y + 0.5 - a.y)
			if o.o == "defend":
				if d > 1.6 and not JS.t(a.get("path")):
					SimAI.goTo(a, int(ws.i), "defend")
				return
			if not JS.t(a.get("path")) and SimAI.nv(a.ai, "t") <= 0:
				var L := []
				for T in G.setts:
					var wt: Dictionary = W.setts[int(T.id)]
					if T.ctrl == 0.0 and JS.hypot(wt.x - ws.x, wt.y - ws.y) < 14 * Sim.SEAT_K:
						L.append(T)
				var T2: Dictionary = Sim.R.pick(L) if L.size() > 0 else S
				SimAI.goTo(a, int(W.setts[int(T2.id)].i), "patrol")
				a.ai.t = 4.0
			return
		"attack":
			var S: Variant = _sett(o.get("t"))
			if S == null:
				return
			var ws: Dictionary = W.setts[int(o.t)]
			if S.ctrl == 0.0:
				cmdNote(a, "won", ws.name + " наш! Стою здесь и жду новых приказов.", true)
				a.cmd = {"o": "defend", "t": o.t, "mode": o.get("mode"), "day": G.day}
				return
			if not Sim.hostile(0.0, S.ctrl) and S.ctrl != 5.0:
				cmdNote(a, "peace", "С хозяевами " + ws.name + " у нас нет войны — нападать нельзя. Возвращаюсь.", true)
				a.cmd = {"o": "ret", "mode": o.get("mode"), "day": G.day}
				return
			var tgt := int(o.t)
			var gp: float = SimDay.powerU(S.gar, null) * (1 + S.walls * 0.6)
			if intent and gp > my * 1.5 and not reck and not JS.t(o.get("swapped")):
				# умелый полководец выбирает крепость того же врага послабее
				var best: Variant = null
				var bd := 1e9
				for T in G.setts:
					if T.ctrl != S.ctrl or JS.t(T.siege):
						continue
					var wt: Dictionary = W.setts[int(T.id)]
					var g2: float = SimDay.powerU(T.gar, null) * (1 + T.walls * 0.6)
					if g2 > my * 1.2:
						continue
					var dd := JS.hypot(wt.x - ws.x, wt.y - ws.y)
					if dd < 16 and dd < bd:
						bd = dd
						best = T
				if best != null:
					o.t = best.id
					tgt = int(best.id)
					o.swapped = 1.0
					cmdNote(a, "swap", ws.name + " слишком крепок для нас. Ваш замысел я понял — бить врага там, где он слаб: иду на " + W.setts[int(best.id)].name + ".", true)
			var w2: Dictionary = W.setts[tgt]
			var d := JS.hypot(w2.x + 0.5 - a.x, w2.y + 0.5 - a.y)
			if d < 1.5:
				await SimAI.aiArriveSett(a, tgt)
				a.ai.t = 2.0
				return
			if not JS.t(a.get("path")) or a.ai.task != "siege":
				if SimAI.goTo(a, int(w2.i), "siege"):
					a.onArrive = {"k": "siege", "s": float(tgt), "r": 0.0}
					if not JS.t(o.get("told")):
						o.told = 1.0
						cmdNote(a, "march", "Выступаем на " + w2.name + ". " + ("Гарнизон силён — будет тяжело." if gp > my * 1.5 else "Думаю, крепость наша."), true)
			return
		"join":
			var b: Variant = Sim.armyById(o.get("t"))
			if b == null or b.realm != 0.0:
				a.cmd = {"o": "hold", "mode": o.get("mode"), "day": G.day, "x": a.x, "y": a.y}
				return
			if JS.hypot(b.x - a.x, b.y - a.y) < 1.3:
				mergeArmies(b, a)
				return
			if not JS.t(a.get("path")) or SimAI.nv(a.ai, "t") <= 0:
				SimAI.goTo(a, Sim.armyTile(b), "join")
				a.ai.t = 1.0
			return
		"ret":
			var ws: Dictionary = W.setts[int(G.realms[0].capital)]
			if JS.hypot(ws.x + 0.5 - a.x, ws.y + 0.5 - a.y) < 1.6:
				a.cmd = {"o": "hold", "mode": o.get("mode"), "day": G.day, "x": a.x, "y": a.y}
				cmdNote(a, "home", "Войско у стен столицы, государь.")
				return
			if not JS.t(a.get("path")):
				SimAI.goTo(a, int(ws.i), "ret")
			return


static func mergeArmies(into: Dictionary, from: Dictionary) -> void:
	var m1 := Sim.armyMen(into)
	var m2 := Sim.armyMen(from)
	for t in Sim.UT:
		var n1 := JS.n(into.u.get(t))
		var n2 := JS.n(from.u.get(t))
		into.xp[t] = (into.xp[t] * n1 + from.xp[t] * n2) / (n1 + n2) if n1 + n2 > 0 else into.xp[t]
	for t in Sim.UT:
		into.u[t] = JS.n(into.u.get(t)) + JS.n(from.u.get(t)) * 1.0
	for k in MERGE_K:
		into[k] = JS.n(into.get(k)) + JS.n(from.get(k))
	into.morale = (into.morale * m1 + from.morale * m2) / maxf(1.0, m1 + m2)
	from.alive = 0.0
	from.path = null
	var g: Variant = Sim.charOf(from.gen)
	if g != null:
		g.atCourt = 1.0
		g.army = -1.0
	if into.kind == "player":
		Sim.glog("К войску короля присоединились " + SimArmy.voin(m2) + (" (" + Sim.charName(g) + ")" if g != null else "") + ".", "good")
	else:
		cmdNote(into, "joined", "К нам присоединились " + SimArmy.voin(m2) + (" под началом " + Sim.charName(g) if g != null else "") + ". Теперь нас " + JS.s(Sim.armyMen(into)) + ".", true)


## донесения войск короны о битвах (cmdBattle): победа или поражение, потери — глазами полководца (хвастун приукрасит)
static func cmdBattle(a: Dictionary, b: Dictionary, res: Dictionary) -> void:
	var G := Sim.G
	for si in 2:
		var x: Dictionary = a if si == 0 else b
		var y: Dictionary = b if si == 0 else a
		var won: bool = JS.t(res.winA) if si == 0 else not JS.t(res.winA)
		if x.realm != 0.0 or x.kind != "lord":
			continue
		var g: Variant = Sim.charOf(x.gen)
		var sides: Variant = res.get("sides")
		var myL: float = sides[si].lost if JS.t(sides) and si < sides.size() and JS.t(sides[si]) else 0.0
		var foeL: float = sides[1 - si].lost if JS.t(sides) and 1 - si < sides.size() and JS.t(sides[1 - si]) else 0.0
		var brag := 0.35 if g != null and float(JS.o(g.get("hon"), 50.0)) < 40 else 0.0
		var near := SimDay.settNear(x.x, x.y, 6)
		var t1: String = ("Победа" if won else "Поражение") + (" у " + Sim.W.setts[near].name if near >= 0 else "") + " над " + SimArmy.armyLabel(y) + "! Наши потери ≈"
		var n1 := noisy(myL, g, "mar", -brag if won else 0.0)
		var t2 := ", враг потерял ≈"
		var n2 := noisy(foeL, g, "mar", brag)
		cmdNote(x, "battle" + JS.s(G.day), t1 + JS.s(n1) + t2 + JS.s(n2) + "." + ("" if won else " Отходим."), true)
		if g != null:
			g.loy = JS.clp(float(JS.o(g.get("loy"), 60.0)) + (2.0 if won else -1.0), 0, 100)


# ---------- дипломатия (diplo.js) ----------
static func msg(o: Dictionary) -> Dictionary:
	var G := Sim.G
	o.id = G.nextId
	G.nextId += 1.0
	o.day = G.day
	if not JS.t(o.get("until")):
		o.until = G.day + 12
	G.msgs.append(o)
	SimDay.alerts.append({"k": "msg", "m": o})
	return o


static func allyOf(r: float) -> Array:
	var o := []
	var rl: Array = Sim.G.rel[int(r)]
	for t in 5:
		if float(t) != r and JS.t(rl[t].get("ally")) and SimDay.alive(t):
			o.append(float(t))
	return o


## declareWar = deceit(reign(diplo)): летопись войны у короны и донесение Ока, почему напали
static func declareWar(r: float, t: float, o: Dictionary = {}) -> bool:
	var G := Sim.G
	var p: float = G.player.realm
	var was: bool = r != t and JS.t(G.rel[int(r)][int(t)].get("war"))
	var res := _declareWar(r, t, o)
	if not was and r != t and JS.t(G.rel[int(r)][int(t)].get("war")) and (r == p or t == p):
		var e := t if r == p else r
		var st := SimArmy.RST()
		st.wars = SimAI.nv(st, "wars") + 1
		SimArmy.chron("Война: " + Sim.realmName(e) + (" — объявили мы." if r == p else " — объявили нам."), "sword", "war", 2.0)
	if res and t == p and r >= 1 and r < 5:
		var bp := SimBel.belPower(r)
		var tp := SimAI.realmPower(t)
		if bp < tp * 0.8:
			var B := SimBel.belOf(r)
			SimBel.eyeNote(r, "Почему они напали", "Наши люди при дворе державы " + Sim.realmName(r) + " доносят: там сочли нас слабее, чем мы есть — по их счёту наша сила ≈" + SimArmy.fmt(bp) + ", на деле ≈" + SimArmy.fmt(tp) + "." + (" Слух о нашей слабости сделал своё дело." if JS.t(B.rum) and B.rum.k == "weak" else ""), "warn")
	return res


static func _declareWar(r: float, t: float, o: Dictionary) -> bool:
	var G := Sim.G
	var ri := int(r)
	var ti := int(t)
	if r == t or JS.t(G.rel[ri][ti].get("war")) or not SimDay.alive(ri) or (t < 5 and not SimDay.alive(ti)):
		return false
	var R0: Dictionary = G.realms[ri]
	var rl: Dictionary = G.rel[ri][ti]
	var broke: bool = SimAI.nv(rl, "truce") > G.day or SimAI.nv(rl, "pact") > G.day or JS.t(rl.get("ally"))
	SimDay.setRel(r, t, "war", 1.0)
	SimDay.setRel(r, t, "since", G.day)
	SimDay.setRel(r, t, "bs", 0.0)
	SimDay.setRel(r, t, "truce", 0.0)
	SimDay.setRel(r, t, "pact", 0.0)
	SimDay.setRel(r, t, "ally", 0.0)
	SimDay.addOpn(t, r, -40)
	if broke:
		R0.prestige = JS.n(R0.get("prestige")) - 25
		for x in 5:
			if x != ri and x != ti:
				SimDay.addOpn(x, r, -25.0 if SimDay.rulerOf(x).traits.has("honest") else -12.0)
	var p: float = G.player.realm
	if t < 5 and not JS.t(o.get("silent")):
		if r == p or t == p:
			Sim.glog(("Мы объявили войну: " + Sim.realmName(t) if r == p else Sim.realmName(r) + " " + SimDay.rV(ri, "объявила", "объявило", "объявили") + " нам войну!") + (" Договор нарушен." if broke else ""), "war")
			if t == p:
				SimDay.alerts.append({"k": "war", "r": r})
		elif JS.t(G.realms[int(p)]):
			Sim.glog(Sim.realmName(r) + " " + SimDay.rV(ri, "объявила", "объявило", "объявили") + " войну: " + Sim.realmName(t) + ".", "info")
	# союзников обороняющегося зовут к оружию
	if t < 5 and not JS.t(o.get("noCall")):
		for x in allyOf(t):
			if x == r or JS.t(G.rel[int(x)][ri].get("war")):
				continue
			if x == p:
				var ru: Dictionary = SimDay.rulerOf(ti)
				msg({"kind": "call", "from": t, "enemy": r, "text": String(ru.title) + " " + String(ru.name) + " призывает нас к оружию против: " + Sim.realmName(r) + ". Отказ разорвёт союз."})
			elif G.rel[int(x)][ri].opn < 30 and Sim.R.f() < 0.8:
				declareWar(x, r, {"noCall": true, "ally": t})
			else:
				SimDay.setRel(x, t, "ally", 0.0)
				SimDay.addOpn(t, x, -30)
	# союзники нападающего могут вступить
	if t < 5 and not JS.t(o.get("noCall")) and not JS.t(o.get("ally")):
		for x in allyOf(r):
			if x == t or JS.t(G.rel[int(x)][ti].get("war")) or x == p:
				continue
			if G.rel[int(x)][ti].opn < 0 and Sim.R.f() < 0.6:
				declareWar(x, t, {"noCall": true, "ally": r})
	if r == p and t < 5:
		for x in allyOf(r):
			if x == t or JS.t(G.rel[int(x)][ti].get("war")):
				continue
			if G.rel[int(x)][ri].opn > 5 or Sim.R.f() < 0.5:
				declareWar(x, t, {"noCall": true, "ally": r})
				Sim.glog(Sim.realmName(x) + " " + SimDay.rV(int(x), "вступает", "вступает", "вступают") + " в войну на нашей стороне.", "good")
	return true


## занятые между a и b земли возвращаются хозяевам
static func returnOccupied(a: float, b: float) -> void:
	var G := Sim.G
	for S in G.setts:
		if (S.owner == a and S.ctrl == b) or (S.owner == b and S.ctrl == a):
			S.ctrl = S.owner
			S.siege = null
			S.gar = Sim.roundU(Sim.scaleU(SimDay.baseGarrison(S), 0.35))
		if JS.t(S.siege):
			var sa: Variant = Sim.armyById(S.siege.by)
			if sa != null and ((sa.realm == a and S.ctrl == b) or (sa.realm == b and S.ctrl == a)):
				SimDay.endSiege(sa)
	Sim.pol_dirty = 1


## makePeace с обёрткой reign.js (летопись мира у короны)
static func makePeace(win: float, lose: float, cede: bool, gold := 0.0) -> void:
	var G := Sim.G
	var p: float = G.player.realm
	var was := JS.t(G.rel[int(win)][int(lose)].get("war"))
	var n0 := SimArmy.landsN()
	_makePeace(win, lose, cede, gold)
	if was and not JS.t(G.rel[int(win)][int(lose)].get("war")) and (win == p or lose == p):
		var e := lose if win == p else win
		var dn := SimArmy.landsN() - n0
		var st := SimArmy.RST()
		st.peace = SimAI.nv(st, "peace") + 1
		SimArmy.chron("Мир: " + Sim.realmName(e) + (" — на наших условиях" if win == p else " — на их условиях") + (", крепостей +" + str(dn) if dn > 0 else (", крепостей " + str(dn) if dn < 0 else "")) + ".", "seal", "peace", 2.0)


static func _makePeace(win: float, lose: float, cede: bool, gold: float) -> void:
	var G := Sim.G
	var W := Sim.W
	var wi := int(win)
	var li := int(lose)
	if not JS.t(G.rel[wi][li].get("war")):
		return
	var ceded := []
	if cede:
		for S in G.setts:
			if S.owner == lose and S.ctrl == win:
				S.owner = win
				ceded.append(S.id)
				if SimAI.nv(S, "lord") >= 0:
					S.lord = -1.0
	returnOccupied(win, lose)
	SimDay.setRel(win, lose, "war", 0.0)
	SimDay.setRel(win, lose, "truce", G.day + Sim.DAYS_YEAR)
	SimDay.setRel(win, lose, "bs", 0.0)
	if JS.t(gold):
		var g := minf(gold, maxf(0.0, G.realms[li].gold))
		G.realms[li].gold -= g
		G.realms[wi].gold += g
	SimDay.addOpn(lose, win, -20.0 if cede else -5.0)
	SimDay.addOpn(win, lose, 10)
	if win < 5:
		G.realms[wi].prestige = JS.n(G.realms[wi].get("prestige")) + (15.0 + ceded.size() * 5 if cede else 5.0)
	var names := []
	for id in ceded:
		if W.setts[int(id)].type != "village":
			names.append(W.setts[int(id)].name)
	var p: float = G.player.realm
	if win == p or lose == p:
		var other := lose if win == p else win
		var nm := ", ".join(names)
		Sim.glog("Мир с державой " + Sim.realmName(other) + ". " + (("Нам отошли: " if win == p else "Мы уступили: ") + (nm if nm != "" else str(ceded.size()) + " деревни") + "." if cede and ceded.size() > 0 else "Белый мир.") + (" Выплата: " + JS.s(gold) + " зол." if JS.t(gold) else ""), "good" if win == p else "info")
	else:
		Sim.glog("Мир: " + Sim.realmName(win) + " и " + Sim.realmName(lose) + (". Уступлено земель: " + str(ceded.size()) if cede and ceded.size() > 0 else "") + ".", "info")
	SimDay.checkRealms()
	Sim.pol_dirty = 1


## держава предлагает мир короне (с обёрткой deceit.js: Око доносит, если мир просят из-за наших уловок)
static func aiOfferPeace(r: float, t: float, ws: float) -> void:
	var G := Sim.G
	var terms: Dictionary
	if ws <= -30:
		terms = {"cede": true, "gold": 0.0, "win": t, "lose": r, "d": "уступить захваченные вами земли"}
	elif ws >= 30:
		terms = {"cede": true, "gold": 0.0, "win": r, "lose": t, "d": "уступить им захваченные земли"}
	else:
		terms = {"cede": false, "gold": 0.0, "win": r if ws >= 0 else t, "lose": t if ws >= 0 else r, "d": "белый мир — всё как было"}
	var ru: Dictionary = SimDay.rulerOf(int(r))
	msg({"kind": "peace", "from": r, "terms": terms, "text": String(ru.title) + " " + String(ru.name) + " предлагает мир: " + terms.d + "."})
	var p: float = G.player.realm
	if t == p and r >= 1 and r < 5:
		var bp := SimBel.belPower(r)
		var tp := SimAI.realmPower(t)
		if bp > tp * 1.25:
			var B := SimBel.belOf(r)
			SimBel.eyeNote(r, "Почему они просят мира", "Наши люди при дворе державы " + Sim.realmName(r) + " доносят: там уверены, что наша сила ≈" + SimArmy.fmt(bp) + " — больше, чем на деле (≈" + SimArmy.fmt(tp) + "). " + ("Слух о нашей силе сделал своё дело." if JS.t(B.rum) and B.rum.k == "str" else "Наши уловки сделали своё дело."), "good")
