class_name SimTech
## Знания королевства — перенос research.js (ветви, эпохи, очки знаний) и study.js (магистр сам выбирает тему, вдохновение,
## опыты раньше своего времени за золото). Таблица TECH (с надбавками reign.js) — из HTML (sim_tables.bin).

static func TECH() -> Dictionary:
	return Sim.T.TECH

static func INSP_MAX() -> float:
	return Sim.T.INSP_MAX

## techInit: старые сохранения без своего прогресса у каждой темы заводят его при первом обращении
static func techInit(T: Variant = null) -> Variant:
	if T == null:
		T = Sim.G.get("tech")
	if T == null:
		return T
	if not JS.t(T.get("pp")):
		T.pp = {}
		if JS.t(T.get("cur")) and JS.t(T.get("prog")):
			T.pp[T.cur] = T.prog
		T.insp = minf(INSP_MAX(), JS.n(T.get("bank")))
		T.auto = 1.0
		T.first = 1.0 if JS.t(T.get("cur")) or (T.get("done", {}) as Dictionary).size() > 0 else 0.0
	return T

static func techEraOf(k: String) -> float:
	return JS.n(TECH()[k].get("era"))

static func techNowEra() -> float:
	return float(SimArmy.eraNow())

static func techOpen(k: String) -> bool:
	var t: Variant = TECH().get(k)
	return t != null and not SimDyn.hasTech(k) and (not JS.t(t.get("req")) or SimDyn.hasTech(t.req))

static func techAvail(k: String) -> bool:
	return techOpen(k) and techEraOf(k) <= techNowEra()

static func techAhead(k: String) -> bool:
	return techOpen(k) and techEraOf(k) > techNowEra()

static func eraDays(e: float) -> float:
	return maxf(0.0, (Sim.T.ERAS[int(e)].y - 1) * Sim.DAYS_YEAR - Sim.G.day)

## раньше своего времени: ×(1 + 0,6 за каждый год до эпохи), не больше ×4
static func techEraK(k: String) -> float:
	var e := techEraOf(k)
	if e <= techNowEra():
		return 1.0
	return minf(4.0, 1 + eraDays(e) / Sim.DAYS_YEAR * 0.6)

static func techCost(k: String) -> float:
	return JS.rnd(TECH()[k].cost * techEraK(k))

static func techGoldDay(k: String) -> float:
	return techEraOf(k) - techNowEra() if techAhead(k) else 0.0

static func techPP(k: String) -> float:
	var T: Variant = techInit()
	return JS.n(T.pp.get(k)) if T != null and JS.t(T.get("pp")) else 0.0

static func techFrac(k: Variant) -> float:
	return JS.clp(techPP(k) / techCost(k), 0, 1) if JS.t(k) and TECH().has(k) else 0.0

static func techState(k: String) -> String:
	if SimDyn.hasTech(k):
		return "done"
	if Sim.G.tech.get("cur") == k:
		return "cur"
	if techAvail(k):
		return "avail"
	return "ahead" if techAhead(k) else "locked"

## очки знаний; ext — разовый дар (трактат, прошение учёного, молитва), а не дневная работа магистра
static func techProgress(p: float, ext := false) -> void:
	var G := Sim.G
	var T: Variant = techInit()
	if T == null:
		return
	if SimDyn.hasTech("printing"):
		p *= 1.25
	var cur: Variant = T.get("cur")
	if not JS.t(cur) or JS.t(T.done.get(cur)) or not TECH().has(cur):
		T.cur = null
		T.insp = minf(INSP_MAX(), JS.n(T.get("insp")) + p * (1.0 if ext else 0.5))
		return
	if SimDyn.projDone("libwing"):
		p *= 1.15
	if SimDyn.projDone("observatory"):
		p *= 1.05
	var k: String = cur
	var ahead := techAhead(k)
	if not ext and T.insp > 0:
		var use := minf(T.insp, 1.0 if ahead else 0.75)
		T.insp -= use
		p += use * (2.0 if ahead else 1.0)
	T.pp[k] = JS.n(T.pp.get(k)) + p
	T.prog = T.pp[k]
	var t: Dictionary = TECH()[k]
	var cost := techCost(k)
	if T.pp[k] >= cost:
		T.done[k] = G.day + 1
		var over: float = T.pp[k] - cost
		T.pp.erase(k)
		T.prog = 0.0
		T.cur = null
		T.insp = minf(INSP_MAX(), JS.n(T.get("insp")) + over * 0.5)
		T.last = k
		if ahead:
			T.early = JS.n(T.get("early")) + 1
		techApply(k)
		Sim.glog("Магистр: изучено знание «" + String(t.n) + "»" + (" — раньше своего времени" if ahead else "") + ". " + String(t.d), "good")
		Sim.sfx("chime")
		var C: Variant = G.get("court")
		if C != null and JS.t(C.orders.get("magister")) and C.orders.magister.k == "research":
			C.orders.magister.fin = 1.0

## techApply с обёрткой reign.js (знание — в летопись правления)
static func techApply(k: String) -> void:
	_techApply(k)
	var st := SimArmy.RST()
	st.techs = JS.n(st.get("techs")) + 1
	SimArmy.chron("Изучено: «" + String(TECH()[k].n) + "».", "flask", "tech", 1)

static func _techApply(k: String) -> void:
	var G := Sim.G
	if k == "fairs":
		SimCourt.prestige(5)
	if k == "laws":
		for P in G.provs:
			if G.setts[Sim.W.provs[int(P.id)].seat].owner == 0.0:
				P.unrest = maxf(0.0, P.unrest - 8)

# ---------- study.js: магистр не сидит без дела ----------
## опыты знаний поздней эпохи стоят золота каждый день; с пустой казной работа стоит
static func studyPay(k: Variant) -> bool:
	var G := Sim.G
	var g := techGoldDay(k) if JS.t(k) and TECH().has(k) else 0.0
	if g == 0.0:
		return true
	var r: Dictionary = G.realms[0]
	var T: Dictionary = G.tech
	if r.gold < g:
		if T.get("stall") != G.day - 1:
			Sim.glog("Магистр: на опыты нет золота — работа над «" + String(TECH()[k].n) + "» стоит.", "warn")
		T.stall = G.day
		return false
	r.gold -= g
	T.spent = JS.n(T.get("spent")) + g
	return true

static func studyReport(c: Variant) -> String:
	var T: Variant = techInit()
	var k: Variant = T.get("cur")
	if JS.t(k) and TECH().has(k):
		return "Изучаем «" + String(TECH()[k].n) + "»: " + JS.s(JS.rnd(techFrac(k) * 100)) + "%" + (", раньше своего времени — опыты стоят " + JS.s(techGoldDay(k)) + " зол. в день" if techAhead(k) else "") + "." \
			+ (" Взялся сам: " + String(T.why) + "." if T.get("by") == "self" and JS.t(T.get("why")) else "")
	return "Сейчас без темы: читаю, пишу учёным собратьям. Вдохновения " + JS.s(JS.rnd(JS.n(T.get("insp")))) + " из " + JS.s(INSP_MAX()) + "." \
		+ (" Как только найду дело по силам — возьмусь сам." if JS.t(T.get("auto")) and JS.t(T.get("first")) else " Жду вашего слова, государь.")

## вдохновение за день: свободный магистр читает, пишет учёным собратьям, переписывает старые книги; занятый другим поручением — понемногу
static func studyRate(m: Variant, busy: bool) -> float:
	if m == null:
		return 0.0
	return JS.clp(m.lrn / 20, 0.2, 1) * (1.2 if m.traits.has("wise") else 1.0) * (1.2 if JS.t(m.get("motive")) and m.motive.k == "lore" else 1.0) * (0.3 if busy else 1.0) \
		* (1.15 if SimDyn.projDone("libwing") else 1.0) * (1.1 if SimDyn.projDone("observatory") else 1.0)

static func studyDaily() -> void:
	var T: Variant = techInit()
	var C: Dictionary = Sim.G.court
	var m: Variant = SimDyn.seatChar("magister")
	if T == null or m == null:
		return
	var o: Variant = C.orders.get("magister")
	if JS.t(o) and o.k == "research":
		return
	T.insp = minf(INSP_MAX(), JS.n(T.get("insp")) + studyRate(m, JS.t(o)))
	if JS.t(o) or not JS.t(T.get("auto")) or (not JS.t(T.get("first")) and T.insp < INSP_MAX()):
		return    # до первого слова короля он ждёт — разве что вдохновение переполнится
	var pk: Variant = studyPick(m)
	if pk != null:
		studyStart(pk.k, pk.why)

## что нужно королевству сейчас: вес каждой ветви и причина словами
static func studyNeeds() -> Dictionary:
	var G := Sim.G
	var N := [0.0, 0.0, 0.0, 0.0]
	var why := ["", "", "", ""]
	var r: Dictionary = G.realms[0]
	var C: Dictionary = G.court
	var k: Variant = SimPlayer.kingC()
	if r.gold < 150 or JS.n(r.get("inc")) < JS.n(r.get("exp")):
		N[0] += 1.2
		why[0] = "казна пустеет" if r.gold < 150 else "расходы выше доходов"
	elif JS.n(C.get("grain")) < SimCourt.granRes() or SimCourt.granFamine():
		N[0] += 0.7
		why[0] = "амбары пустеют"
	if not SimDay.warsOf(0).is_empty():
		N[1] += 1.2
		why[1] = "идёт война"
	if k != null and ((k.get("wound") != null and k.wound > G.day) or JS.t(k.get("ill"))):
		N[2] += 0.8
		why[2] = "государь нездоров"
	elif C.secrets.any(func(s): return JS.t(s.get("known")) and (s.k == "spy" or s.k == "plot")):
		N[2] += 0.8
		why[2] = "при дворе завелись шпионы"
	var P: Array = G.provs.filter(func(p): return G.setts[int(Sim.W.provs[int(p.id)].seat)].owner == 0.0)
	var u := 0.0
	if not P.is_empty():
		for p in P:
			u += p.unrest
		u /= P.size()
	if u > 18:
		N[3] += 1
		why[3] = "в провинциях смута"
	return {"N": N, "why": why}

## к чему тянет самого магистра: его нрав и давняя мечта
static func magLean(m: Dictionary) -> Dictionary:
	var L := [0.0, 0.0, 0.0, 0.0]
	var why := ["", "", "", ""]
	var LEAN: Dictionary = Sim.T.LEAN
	for t in m.traits:
		var e: Variant = LEAN.get(t)
		if e != null:
			var b := int(e[0])
			L[b] += 0.5
			if why[b] == "":
				why[b] = "магистр " + String(e[1])
	if JS.t(m.get("motive")) and m.motive.k == "lore":
		var b := int(JS.n(m.motive.get("b")))
		L[b] += 0.4
		if why[b] == "":
			why[b] = "магистр давно мечтает об этом"
	return {"L": L, "why": why}

## выбор: что нужно и что он любит, и чем ближе к концу, тем лучше; поздняя эпоха — только если хватит вдохновения (и золота)
static func studyPick(m: Dictionary) -> Variant:
	var G := Sim.G
	var T: Dictionary = G.tech
	var nd := studyNeeds()
	var ln := magLean(m)
	var sc := func(k: String) -> float:
		var b := int(TECH()[k].b)
		var left := maxf(0.0, techCost(k) - techPP(k))
		return (1 + nd.N[b] + ln.L[b] + (0.6 if techPP(k) > 0 else 0.0)) / sqrt(left + 4)
	var L: Array = TECH().keys().filter(func(k): return techAvail(k))
	var early := false
	if L.is_empty():
		early = true
		L = TECH().keys().filter(func(k): return techAhead(k) and G.realms[0].gold >= 200 and (JS.n(T.get("insp")) * 2 >= 0.6 * (techCost(k) - TECH()[k].cost) or techEraK(k) <= 1.35))
	if L.is_empty():
		return null
	var k: String = JS.sort(L, func(a, b): return sc.call(b) - sc.call(a))[0]
	var b := int(TECH()[k].b)
	var why: String
	if early:
		why = "вдохновения хватит, чтобы опередить время"
	elif nd.why[b] != "":
		why = nd.why[b]
	elif ln.why[b] != "":
		why = ln.why[b]
	else:
		why = "начатое надо закончить" if techPP(k) > 0 else "это ближе всего к цели"
	return {"k": k, "why": why}

static func studyStart(k: String, why: String) -> bool:
	var G := Sim.G
	var C: Dictionary = G.court
	var m: Variant = SimDyn.seatChar("magister")
	var T: Variant = techInit()
	if m == null or not TECH().has(k):
		return false
	var o := {"k": "research", "mode": "intent", "t": k, "day0": G.day, "dur": 999.0, "prog": 0.0, "self": 1.0}
	o.eff = SimCourt.orderEff(m, "magister", "intent") * 0.9
	C.orders.magister = o
	T.cur = k
	T.by = "self"
	T.why = why
	T.since = G.day
	SimCourt.addReport("magister", "Сам взялся за «" + String(TECH()[k].n) + "»" + (": " + why if why != "" else "") + (". Раньше своего времени — опыты будут стоить " + JS.s(techGoldDay(k)) + " зол. в день" if techAhead(k) else "") + ".")
	return true

## сколько примерно дней до конца темы
static func studyDays(k: Variant, m: Variant, mode: String) -> float:
	if m == null or not JS.t(k):
		return 0.0
	var sp: float = JS.clp(m.lrn / 9, 0.3, 2.4) * SimCourt.orderEff(m, "magister", mode) * (1.25 if SimDyn.hasTech("printing") else 1.0) * (1.15 if SimDyn.projDone("libwing") else 1.0) * (1.05 if SimDyn.projDone("observatory") else 1.0)
	var left := maxf(0.0, techCost(k) - techPP(k))
	var d := 0.0
	var ins := JS.n(Sim.G.tech.get("insp"))
	var ah := techAhead(k)
	while left > 0 and d < 999:
		var u := minf(ins, 1.0 if ah else 0.75)
		ins -= u
		left -= sp + u * (2.0 if ah else 1.0)
		d += 1
	return d

# ---------- день знаний (research.js: researchDaily) ----------
static func researchDaily() -> void:
	var G := Sim.G
	if not G.has("court"):
		return
	var C: Dictionary = G.court
	studyDaily()           # магистр без темы не сидит без дела
	SimGran.granDaily()    # амбары: двор ест, деревни везут оброк, слово перед зимой
	# свод законов и ратуши успокаивают землю; ярмарки раз в сезон прибавляют славы
	var calm := (0.15 if SimDyn.hasTech("laws") else 0.0) + (0.15 if SimDyn.hasTech("townhalls") else 0.0)
	if calm != 0.0:
		for P in G.provs:
			if G.setts[int(Sim.W.provs[int(P.id)].seat)].owner == 0.0:
				P.unrest = maxf(0.0, P.unrest - calm)
	if fmod(G.day, Sim.DAYS_SEASON) == 0.0:
		if SimDyn.hasTech("fairs"):
			SimCourt.prestige(1)
		if SimDyn.hasTech("informants"):
			var L: Array = [1.0, 2.0, 3.0, 4.0].filter(func(t): return SimDay.alive(int(t)) and JS.n(C.net.get(JS.s(t))) < 3)
			if not L.is_empty():
				var t: float = Sim.R.pick(L)
				JS.oset(C.net, JS.s(t), JS.n(C.net.get(JS.s(t))) + 1)
				SimCourt.addReport("eye", "Осведомители окрепли: сеть в державе " + Sim.realmName(t) + " теперь " + JS.s(C.net[JS.s(t)]) + " из 3.")
