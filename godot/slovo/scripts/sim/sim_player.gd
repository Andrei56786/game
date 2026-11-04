class_name SimPlayer
## Король в поле — перенос command.js и ui.js (orderMove, settHere, checkEncounters, updateFollow): выезд из замка со свитой
## или во главе войска у столицы (leaveCourt), путь по карте, встречи с врагом, возвращение ко двору (enterCourt: войско
## остаётся у стен под началом рыцаря). Приказы войскам короны идут с гонцами (sendOrder → G.couriers → applyOrder):
## гонец скачет от короля к войску со скоростью courierSpeed, пока он в пути — войско живёт старым приказом.
## Что в HTML — UI.toast, здесь — в toasts (экран карты показывает); окна (UI.alert) — в SimDay.alerts.

const OB := [["hold", ""], ["defend", "own"], ["attack", "foe"], ["patrol", "own"], ["join", "army"], ["ret", ""], ["feint", "foe"]]
const CMD_D := {"hold": "Стоять на месте и беречь людей. Бить только того, кто слабее и рядом.",
	"defend": "Идти к своей крепости и оборонять её округу. Снимет осаду, если сможет.",
	"attack": "Идти на вражескую крепость: осада или штурм.",
	"patrol": "Ходить между своими крепостями рядом с целью и гонять разбойников.",
	"join": "Идти к другому войску короны и влиться в него.",
	"ret": "Вернуться к столице и стать там лагерем.",
	"feint": "Идти к вражеской крепости с кострами, знамёнами и барабанами, но не нападать: встать в дне пути и простоять шесть дней. Если враг поверит, он стянет туда войска с других мест."}
# Сунь-цзы, гл. 8: пять опасных качеств полководца
const FAULTS := {"reckless": {"n": "Безрассудство", "q": "«Безрассудного можно убить».", "d": "лезет в бой и против сильнейшего"},
	"craven": {"n": "Трусость", "q": "«Трусливого можно взять в плен».", "d": "бежит при первой угрозе"},
	"wrathful": {"n": "Вспыльчивость", "q": "«Вспыльчивого можно вывести из себя».", "d": "гонится за врагом, бросая пост"},
	"proud": {"n": "Гордыня", "q": "«Щепетильного в чести можно опозорить».", "d": "не отступает, обижается на мелочную опеку"},
	"generous": {"n": "Мягкосердие", "q": "«Любящего своих людей можно извести заботами».", "d": "слишком рано уводит людей на отдых"}}
const KM_PER_TILE := 3.0
const BASE_SPEED := 6.5

static var toasts: Array = []        # UI.toast — экран карты забирает
static var modal := false            # открыто окно (UI.modalOpen): встречи не проверяются
static var fol_at := -10.0           # UI.folAt: когда последний раз перекладывали путь погони (секунды)


## часы игры (автозагрузка Game); в проверках без сцены (--script) их нет — тогда null
static func game() -> Node:
	var t := Engine.get_main_loop() as SceneTree
	return t.root.get_node_or_null("Game") if t != null else null


## королевство начинается при первом открытии карты; у ворот замка — сразу (тот же мир и зерно; карта потом его подхватит)
static func ensure_sim() -> bool:
	if not Sim.G.is_empty():
		return true
	var w := WorldData.load_export("res://art")
	if w == null:
		return false
	var g := game()
	Sim.start(w, int(g.seed) if g != null else 1)
	SimArmy.prep()
	return true


static func toast(s: String) -> void:
	toasts.append(s)


static func kingC() -> Variant:
	return Sim.charOf(Sim.G.player.char)


## время королевства: день и доля суток (G.day + G.frac)
static func now_d() -> float:
	return Sim.G.day + JS.n(Sim.G.get("frac"))


static func faultsOf(c: Variant) -> Array:
	if not (c is Dictionary):
		return []
	return (c.traits as Array).filter(func(t): return FAULTS.has(t))


static func kmTxt(km: float) -> String:
	var v := maxf(1, roundf(km)) if km < 20 else (roundf(km / 5) * 5 if km < 100 else roundf(km / 10) * 10)
	return JS.s(v) + " км"


static func crownArmies() -> Array:
	return Sim.G.armies.filter(func(a): return JS.t(a.alive) and a.realm == 0.0 and a.kind == "lord")


static func capitalArmy() -> Variant:
	var cap: float = Sim.G.realms[0].capital
	for a in Sim.G.armies:
		if JS.t(a.alive) and a.realm == 0.0 and a.kind == "lord" and SimDay.settNear(a.x, a.y, 2) == cap:
			return a
	return null


static func armyOfGen(id: Variant) -> Variant:
	for a in Sim.G.armies:
		if JS.t(a.alive) and a.gen == id and a.kind == "lord":
			return a
	return null


static func spareKnight() -> Variant:
	for c in Sim.G.chars:
		if JS.t(c.alive) and c.realm == 0.0 and c.role == "knight" and c.prison < 0 and armyOfGen(c.id) == null and not JS.t(c.get("withKing")) and c.age >= 16:
			return c
	return null


static func mkKnight() -> Dictionary:
	var H := (Sim.G.houses as Array).filter(func(h): return JS.t(h.alive))
	return SimDyn.mkHouseMember(Sim.R.pick(H), 0, Sim.R.i(24, 45), {"role": "knight", "title": "Сэр", "st": {"mar": Sim.R.i(7, 13)}})


static func regentName() -> String:
	var C: Variant = Sim.G.get("court")
	var r: Variant = Sim.charOf(C.regent) if C is Dictionary and JS.n(C.get("regent", -1)) >= 0 else null
	return Sim.charName(r) if r != null else ""


static func houseLoy(H0: Variant, v: float) -> void:
	if H0 is Dictionary:
		H0.loy = clampf(JS.n(H0.get("loy", 50)) + v, 0, 100)


static func addU(u: Dictionary, add: Dictionary) -> void:
	for t in Sim.UT:
		u[t] = JS.n(u.get(t)) + JS.n(add.get(t))


static func mkRetinue() -> Dictionary:
	var ws: Dictionary = Sim.W.setts[int(Sim.G.realms[0].capital)]
	var r := Sim.mkArmy(0, "player", Sim.G.player.char, ws.x, ws.y, {"sword": 8, "knight": 4, "horse": 4, "archer": 6})
	Sim.G.armies.erase(r)
	Sim.assign(r, {"food": 300.0, "water": 4.0, "morale": 60.0, "wagons": 1.0})
	return r


## выезд из замка: a — войско у столицы (король встаёт во главе, свита вливается в него) или null — со свитой
static func leaveCourt(a: Variant) -> Dictionary:
	var G := Sim.G
	var C: Dictionary = G.court
	var king: Dictionary = kingC()
	var ws: Dictionary = Sim.W.setts[int(G.realms[0].capital)]
	var pa: Dictionary
	var ret: Dictionary = C.retinue if C.get("retinue") is Dictionary else mkRetinue()
	C.retinue = null
	if a is Dictionary and JS.t(a.alive):
		var kn: Variant = Sim.charOf(a.gen)
		a.prevGen = a.gen
		if kn != null:
			kn.withKing = 1.0
		a.gen = king.id
		a.kind = "player"
		a.ai = null
		a.cmd = null
		a.pend = 0.0
		G.couriers = (G.get("couriers", []) as Array).filter(func(c): return c.to != a.id)
		if a.siegeOf >= 0:
			SimDay.endSiege(a)
		a.path = null
		a.onArrive = null
		var m0 := Sim.armyMen(a)
		var m1 := Sim.armyMen(ret)
		addU(a.u, ret.u)
		for k in ["food", "fodder", "arrows", "weap", "horses", "wagons", "pitch"]:
			a[k] = JS.n(a.get(k)) + JS.n(ret.get(k))
		a.water = minf(Sim.waterCap(a), (JS.n(a.get("water")) * m0 + JS.n(ret.get("water")) * m1) / maxf(1, m0 + m1))
		a.morale = maxf(a.morale, 55)
		pa = a
	else:
		pa = ret
		pa.x = ws.x + 0.5
		pa.y = ws.y + 0.5
		pa.path = null
		pa.alive = 1.0
		pa.gen = king.id
		if not G.armies.has(pa):
			G.armies.append(pa)
	G.player.army = pa.id
	G.atCourt = 0.0
	C.view = 0.0
	king.atCourt = 0.0
	G.player.follow = -1.0
	Sim.glog("Король выехал из замка" + (" во главе войска (" + SimArmy.voin(Sim.armyMen(pa)) + ")." if a is Dictionary else " со свитой."), "info")
	return pa


## въезд в замок (enterCourt): большое войско остаётся у стен под началом рыцаря, малое — снова свита
static func enterCourt() -> void:
	var G := Sim.G
	var C: Variant = G.get("court")
	if not (C is Dictionary):
		return
	var pa: Variant = Sim.playerArmy()
	var king: Dictionary = kingC()
	if pa != null:
		var men := Sim.armyMen(pa)
		if men > 45:
			var ret := splitRetinue(pa)
			var kn := armyToKnight(pa, "hold")
			C.retinue = ret
			Sim.glog("Войско осталось у стен под началом " + Sim.charName(kn) + ".", "info")
		else:
			G.armies.erase(pa)
			pa.path = null
			pa.onArrive = null
			if pa.siegeOf >= 0:
				SimDay.endSiege(pa)
			C.retinue = pa
	for c in G.chars:
		if JS.t(c.get("withKing")):
			c.withKing = 0.0
			if armyOfGen(c.id) == null:
				c.atCourt = 1.0
	G.player.army = C.retinue.id if C.get("retinue") is Dictionary else -1.0
	G.atCourt = 1.0
	king.atCourt = 1.0
	C.view = 0.0
	Sim.glog("Король вернулся в замок.", "info")


static func splitRetinue(pa: Dictionary) -> Dictionary:
	var u := Sim.emptyU()
	var want := {"sword": 10, "knight": 6, "horse": 6, "archer": 8}
	var got := 0.0
	for t in Sim.UT:
		var n := minf(JS.n(pa.u.get(t)), float(want.get(t, 0)))
		u[t] = n
		pa.u[t] = JS.n(pa.u.get(t)) - n
		got += n
	for t in ["spear", "levy"]:
		var n := minf(JS.n(pa.u.get(t)), maxf(0, 30 - got))
		u[t] = JS.n(u.get(t)) + n
		pa.u[t] = JS.n(pa.u.get(t)) - n
		got += n
	var ret := Sim.mkArmy(0, "player", Sim.G.player.char, pa.x, pa.y, u)
	Sim.G.armies.erase(ret)
	ret.x = pa.x
	ret.y = pa.y
	var f := minf(300, JS.n(pa.get("food")))
	Sim.assign(ret, {"food": f, "water": 4.0, "morale": pa.morale, "wagons": 1.0 if JS.n(pa.get("wagons")) > 1 else 0.0})
	pa.food = JS.n(pa.get("food")) - f
	if JS.t(ret.wagons):
		pa.wagons = JS.n(pa.get("wagons")) - 1
	return ret


static func armyToKnight(pa: Dictionary, o: String) -> Dictionary:
	var pg: Variant = Sim.charOf(pa.prevGen) if JS.n(pa.get("prevGen", -1)) >= 0 else null
	var kn: Dictionary
	if pg != null and JS.t(pg.alive) and pg.prison < 0:
		kn = pg
	else:
		var sk: Variant = spareKnight()
		kn = sk if sk != null else mkKnight()
	kn.withKing = 0.0
	kn.atCourt = 0.0
	pa.kind = "lord"
	pa.gen = kn.id
	pa.prevGen = -1.0
	pa.ai = {"task": "idle", "t": 0.0}
	pa.onArrive = null
	pa.path = null
	Sim.G.player.follow = -1.0
	pa.cmd = {"o": "ret", "mode": "intent", "day": Sim.G.day} if o == "return" else {"o": "hold", "mode": "intent", "day": Sim.G.day, "x": pa.x, "y": pa.y}
	return kn


## поселение, в котором стоит войско (или −1)
static func settHere(a: Dictionary) -> int:
	var best := -1
	var bd := 1.3
	for s in Sim.W.setts:
		var d := JSM.hypot(s.x + 0.5 - a.x, s.y + 0.5 - a.y)
		if d < bd:
			bd = d
			best = s.id
	return best


## идти войском короля в клетку t: false — пути нет (сообщение — в toasts)
static func orderMove(t: int, onArrive: Variant = null, follow: float = -1.0) -> bool:
	var pa: Variant = Sim.playerArmy()
	if pa == null or t < 0:
		return false
	if not SimDay.passable(Sim.W.ter[t]):
		toast("Туда не пройти.")
		return false
	var p: Variant = SimArmy.planPath(pa, t)
	if p == null:
		toast("Пути нет.")
		return false
	if (p as Array).size() <= 1:
		if onArrive != null:
			SimArmy.runArrive(pa, onArrive)
		return true
	SimArmy.setPath(pa, p)
	pa.onArrive = onArrive
	Sim.G.player.follow = follow if follow >= 0 else -1.0
	pa.hidden = 0.0
	pa.fires = 0.0
	var g := game()
	if g != null and int(g.speed) == 0:
		g.set_speed(g.last_speed)
	return true


## встречи: враг вплотную к войску короля — окно (UI.alert('enc')), путь обоих обрывается
static func checkEncounters() -> void:
	var pa: Variant = Sim.playerArmy()
	if pa == null or modal:
		return
	var G := Sim.G
	if not (G.get("encCool") is Dictionary):
		G.encCool = {}
	var now := now_d()
	for b in G.armies:
		if not JS.t(b.alive) or b == pa or not Sim.hostile(pa.realm, b.realm):
			continue
		if absf(b.x - pa.x) > 1 or absf(b.y - pa.y) > 1:
			continue
		if JSM.hypot(b.x - pa.x, b.y - pa.y) > 0.85:
			continue
		if JS.n(G.encCool.get(JS.s(b.id), -1)) > now:
			continue
		G.encCool[JS.s(b.id)] = now + 1.2
		pa.path = null
		b.path = null
		SimDay.alerts.append({"k": "enc", "b": b.id})
		modal = true                     # окно встречи: шаги стоят, пока игрок не решит (UI.modalOpen)
		return


## погоня: путь к преследуемому перекладывается не чаще раза в 0,6 с
static func updateFollow() -> void:
	var pa: Variant = Sim.playerArmy()
	var G := Sim.G
	if pa == null or JS.n(G.player.get("follow", -1)) < 0:
		return
	var b: Variant = Sim.armyById(G.player.follow)
	if b == null or not SimIntel.armyVisible(b):
		G.player.follow = -1.0
		return
	var nw := Time.get_ticks_msec() / 1000.0
	if pa.path == null or nw - fol_at > 0.6:
		fol_at = nw
		var p: Variant = SimArmy.planPath(pa, Sim.armyTile(b))
		if p != null and (p as Array).size() > 1:
			pa.path = p
			pa.pi = 0.0


# ---------- гонцы: слово короля едет со скоростью коня ----------
static func sendOrder(a: Dictionary, ord: Dictionary) -> float:
	var G := Sim.G
	var kp := SimDyn.kingPos()
	var d := JSM.hypot(a.x - kp[0], a.y - kp[1])
	G.couriers = (G.get("couriers", []) as Array).filter(func(c): return c.to != a.id)   # новый приказ обгоняет старый
	if d < 1.5:
		applyOrder(a, ord, null)
		toast("Приказ отдан лично: " + SimCmd.ordLabel(a.cmd))
		return 0.0
	G.couriers.append({"id": G.nextId, "to": a.id, "x": kp[0], "y": kp[1], "ord": ord, "day": now_d()})
	G.nextId += 1.0
	a.pend = 1.0
	var days := d / SimDyn.courierSpeed()
	toast("Гонец поскакал: ≈" + (str(maxi(1, roundi(days * 24))) + " ч." if days < 1 else "%.1f дн." % days) + " в пути.")
	return days


static func couriersAdvance(dd: float) -> void:
	var G := Sim.G
	var L: Variant = G.get("couriers")
	if not (L is Array) or (L as Array).is_empty():
		return
	var sp := SimDyn.courierSpeed() * dd
	for cr in L:
		var a: Variant = Sim.armyById(cr.to)
		if a == null:
			cr.done = 1.0
			Sim.glog("Гонец вернулся с приказом: войска, к которому он скакал, больше нет.", "bad")
			continue
		var dx: float = a.x - cr.x
		var dy: float = a.y - cr.y
		var d := JSM.hypot(dx, dy)
		if d <= sp + 0.35:
			cr.done = 1.0
			applyOrder(a, cr.ord, cr)
		else:
			cr.x += dx / d * sp
			cr.y += dy / d * sp
	G.couriers = (G.couriers as Array).filter(func(c): return not JS.t(c.get("done")))


static func applyOrder(a: Dictionary, ord: Dictionary, cr: Variant) -> void:
	var G := Sim.G
	a.cmd = Sim.assign({"day": G.day, "x": a.x, "y": a.y}, ord)
	a.pend = 0.0
	a.path = null
	a.onArrive = null
	if not (a.get("ai") is Dictionary):
		a.ai = {"task": "idle", "t": 0.0}
	a.ai.task = "idle"
	a.ai.t = 0.0
	a.ai.prey = -1.0
	if a.siegeOf >= 0 and ord.get("o") != "attack":
		SimDay.endSiege(a)
	var g: Variant = Sim.charOf(a.gen)   # Сунь-цзы, гл. 3: умелого полководца мелочная опека злит, доверие — окрыляет
	if g != null and ord.get("mode") == "order" and g.mar >= 13:
		g.loy = clampf(JS.n(g.get("loy", 60)) - (3.0 if (g.traits as Array).has("proud") else 1.5) * (0.4 if SimDyn.hasTech("chancery") else 1.0), 0, 100)
	if g != null and ord.get("mode") == "intent" and g.mar >= 11:
		g.loy = clampf(JS.n(g.get("loy", 60)) + 0.5, 0, 100)
	if cr != null:
		var rep: String
		if ord.get("mode") == "intent":
			rep = Sim.R.pick(["Понимаю ваш замысел, государь. Средства выберу сам.", "Благодарю за доверие. Не подведу."]) if g != null and g.mar >= 11 else Sim.R.pick(["Постараюсь понять, чего желает государь…", "Сделаю, что смогу."])
		else:
			rep = Sim.R.pick(["Исполню в точности, хоть и вижу путь лучше.", "Будет сделано, как велено."]) if g != null and g.mar >= 13 else Sim.R.pick(["Исполню в точности.", "Слушаюсь!"])
		SimCmd.cmdNote(a, "got", "Ваш приказ получен: «" + SimCmd.ordLabel(a.cmd) + "». " + rep, true)


static func disbandArmy(a: Dictionary) -> void:
	var G := Sim.G
	var g: Variant = Sim.charOf(a.gen)
	var H0: Variant = G.houses[int(a.house)] if JS.n(a.get("house", -1)) >= 0 else null
	a.alive = 0.0
	a.path = null
	if a.siegeOf >= 0:
		SimDay.endSiege(a)
	if g != null:
		g.atCourt = 1.0
		g.army = -1.0
	if H0 != null:
		houseLoy(H0, 3)
	Sim.glog("Войско " + (Sim.charName(g) if g != null else "") + " распущено по домам (" + SimArmy.voin(Sim.armyMen(a)) + ").", "info")
	G.couriers = (G.get("couriers", []) as Array).filter(func(c): return c.to != a.id)


## цели приказа (cmdTargets): свои крепости, вражеские (разведанные), войска короны — ближайшие 24
static func cmdTargets(type: String, a: Variant) -> Array:
	var G := Sim.G
	var L := []
	var from: Array = [a.x, a.y] if a is Dictionary else SimDyn.kingPos()
	if type == "own":
		for S in G.setts:
			if S.ctrl != 0.0 or Sim.W.setts[int(S.id)].type == "village":
				continue
			var ws: Dictionary = Sim.W.setts[int(S.id)]
			L.append({"id": S.id, "n": String(ws.name) + (" (осада!)" if JS.t(S.get("siege")) else ""), "d": JSM.hypot(ws.x + 0.5 - from[0], ws.y + 0.5 - from[1])})
	elif type == "foe":
		for S in G.setts:
			if S.ctrl == 0.0 or not (Sim.hostile(0, S.ctrl) or S.ctrl == 5.0) or S.ctrl == 6.0:
				continue
			var ws: Dictionary = Sim.W.setts[int(S.id)]
			var d := JSM.hypot(ws.x + 0.5 - from[0], ws.y + 0.5 - from[1])
			if ws.type == "village" and d > 25 * Sim.SEAT_K:
				continue
			if G.explored[int(ws.i)] == 0:
				continue
			L.append({"id": S.id, "n": String(ws.name) + " · " + ("вольные" if S.ctrl == 5.0 else String(Sim.REALM_DEF[int(S.ctrl)].name)), "d": d})
	elif type == "army":
		for b in G.armies:
			if not JS.t(b.alive) or b.realm != 0.0 or b == a or (b.kind != "lord" and b.kind != "player"):
				continue
			L.append({"id": b.id, "n": SimArmy.armyLabel(b) + " · " + JS.s(Sim.armyMen(b)), "d": JSM.hypot(b.x - from[0], b.y - from[1])})
	L.sort_custom(func(p, q): return p.d < q.d)
	return L.slice(0, 24)


# ---------- войско короля в поле: стоянки, грабёж ----------
const MODE_INFO := {"march": {"n": "Марш", "ic": "i_flag", "d": "Войско идёт обычным шагом."},
	"camp": {"n": "Лагерь", "ic": "i_tent", "d": "Отдых: усталость спадает, больные выздоравливают быстрее."},
	"fort": {"n": "Укреплённый лагерь", "ic": "i_shield", "d": "Рвы и частокол (2 дня): боевой дух +4, в бою на месте — оборона +30%. «Сначала сделай себя непобедимым» (гл. 4)."},
	"hide": {"n": "Скрытый лагерь", "ic": "i_eye", "d": "Без костров, в лесу или холмах: враг не видит войско дальше 2 клеток. Засада! (гл. 9)"},
	"forage": {"n": "Фуражировка", "ic": "i_fodder", "d": "Войско кормится с земли. Разоряет провинцию; на своей земле растёт смута. «Мудрый полководец кормится за счёт врага» (гл. 2)."},
	"drill": {"n": "Учения", "ic": "i_sword", "d": "Опыт воинов растёт, но они устают. (гл. 1: «чьи воины лучше обучены?»)"},
	"siege": {"n": "Осада", "ic": "i_fire", "d": "Войско ведёт осаду."}}
const HIDE_T := [WorldData.FOREST, WorldData.DFOREST, WorldData.HILLS, WorldData.MOUNT, WorldData.MARSH]


## стоянка войска короля (setMode): лагерь, укреплённый, скрытый (только в лесу, холмах, горах, болоте), фураж, учения;
## fires — ложные костры (вкл/выкл)
static func setMode(m: String) -> void:
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	if m == "fires":
		pa.fires = 0.0 if JS.t(pa.get("fires")) else 1.0
		if JS.t(pa.fires):
			pa.hidden = 0.0
		return
	if pa.siegeOf >= 0 and m != "siege":
		SimDay.endSiege(pa)
	pa.path = null
	pa.onArrive = null
	Sim.G.player.follow = -1.0
	pa.mode = m
	pa.modeDay = Sim.G.day
	pa.hidden = 1.0 if m == "hide" else 0.0
	if m == "hide":
		pa.fires = 0.0
	if m != "fort":
		pa.fortDays = 0.0
	if m == "hide" and not HIDE_T.has(Sim.W.ter[Sim.armyTile(pa)]):
		pa.hidden = 0.0
		pa.mode = "camp"
		toast("Спрятаться можно лишь в лесу, холмах, горах или болоте.")


## грабёж взятого поселения (lootSett): золото и провиант сейчас, процветание и мнение соседей — вниз
static func lootSett(a: Dictionary, S: Dictionary) -> Dictionary:
	var G := Sim.G
	var ws: Dictionary = Sim.W.setts[int(S.id)]
	var P: Dictionary = G.provs[int(ws.prov)]
	var big: float = {"village": 1.0, "castle": 2.0, "town": 3.0, "capital": 4.0}[ws.type]
	var gold := JS.rnd(S.pop / 40.0 * (S.prosp / 60.0) * (1 - P.dev))
	var food := JS.rnd(400 * big * (1 - P.dev))
	G.realms[int(a.realm)].gold += gold
	a.food += food
	S.prosp = maxf(5, S.prosp - 25)
	P.dev = minf(0.9, P.dev + 0.35)
	P.unrest = minf(100, P.unrest + 30)
	S.lootDay = G.day
	if S.owner < 5 and S.owner != a.realm:
		SimDay.addOpn(S.owner, a.realm, -10)
	for x in 5:
		if x != int(a.realm) and (SimDay.rulerOf(x).traits as Array).has("honest"):
			SimDay.addOpn(x, a.realm, -3)
	a.vict = JS.n(a.get("vict")) + 4
	return {"gold": gold, "food": food}


## что корона знает о верности (loySeen): из досье — точно, иначе — как кажется со стороны
static func loySeen(c: Variant) -> Dictionary:
	if not (c is Dictionary):
		return {"v": 50.0, "s": "—"}
	var K: Variant = Sim.G.court.get("known", {}).get(JS.s(c.id)) if Sim.G.get("court") is Dictionary else null
	if K is Dictionary and K.has("loy"):
		var k := float(K.loy)
		return {"v": k, "s": loyWord(k) + " (досье ≈" + JS.s(k) + ")", "exact": 1}
	var show := clampf(JS.n(c.get("loy", 50)) + (18.0 if JS.n(c.get("hon", 50)) < 40 else 6.0) + (posmod(int(JS.n(c.get("pseed", 7))), 17) - 8), 0, 100)
	return {"v": show, "s": "кажется, " + loyWord(show)}


static func loyWord(v: float) -> String:
	return "предан" if v >= 75 else ("верен" if v >= 55 else ("колеблется" if v >= 35 else ("недоволен" if v >= 18 else "враждебен")))


## войско короля разбито, столица своя: король с горсткой верных бежит в замок — снова ко двору (G.toCourt)
static func fleeHome() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var king: Dictionary = kingC()
	var ws0: Dictionary = Sim.W.setts[int(G.realms[int(G.player.realm)].capital)]
	var ret := mkRetinue()
	ret.u = Sim.assign(Sim.emptyU(), {"spear": 4.0, "sword": 3.0, "archer": 2.0, "horse": 5.0})
	ret.morale = 35.0
	ret.gen = king.id
	C.retinue = ret
	G.player.army = ret.id
	for c in G.chars:
		if JS.t(c.get("withKing")):
			c.withKing = 0.0
			if armyOfGen(c.id) == null:
				c.atCourt = 1.0
	G.atCourt = 1.0
	king.atCourt = 1.0
	C.view = 0.0
	G.toCourt = 1.0
	C.prestige = clampf(JS.n(C.get("prestige")) - 4, -100, 100)
	Sim.glog("Войско короля разбито! Король с горсткой верных бежал в замок " + String(ws0.name) + ".", "bad")
