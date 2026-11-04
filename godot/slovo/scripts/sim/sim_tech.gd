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
