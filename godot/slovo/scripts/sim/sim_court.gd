class_name SimCourt
## Малый совет — перенос council.js (места, поручения «Приказ» и «Замысел», самостоятельные дела советников, доклады,
## тайны двора, кражи казначея и проверки казны) и части audience.js (прошения и суд в отсутствие короля, письма, тайны).
## Таблицы поручений (ORD, с поручениями Ока из deceit.js) и прошений (PETS) — из HTML без кода: код здесь, по ключу.

## ответ советника на поручение: двор показывает его над головой советника (true — показал), иначе — всплывающая строка
static var say_hook: Callable
## места совета сменились — двор пересаживает людей (courtPopulate)
static var seats_rev := 0
## турнир на ристалище замка (feast.js: tourSetup) — его ставит двор
static var tour_hook: Callable

static func ORD() -> Dictionary:
	return Sim.T.ORD

static func seatDef(k: String) -> Variant:
	for s in Sim.SEATS:
		if s.k == k:
			return s
	return null

static func skillOf(c: Variant, sk: String) -> float:
	return JS.n(c.get(sk)) if c != null else 0.0

static func seatOf(c: Dictionary) -> Variant:
	var C: Variant = Sim.G.get("court")
	if C == null:
		return null
	for s in Sim.SEATS:
		if C.seats.get(s.k) == c.id:
			return s.k
	return null

## трата из казны: если по книгам золото есть, а в сундуках нет — казначей тянет время (подозрение растёт)
static func spend(amt: float) -> bool:
	var G := Sim.G
	var r: Dictionary = G.realms[0]
	if r.gold >= amt:
		r.gold -= amt
		return true
	if Sim.bookGold() >= amt:
		G.court.susp = JS.n(G.court.get("susp")) + 1
		var t: Variant = SimDyn.seatChar("treasurer")
		SimPlayer.toast((String(t.name) if t != null else "Казначей") + ": «Деньги… в обороте, государь. Дайте неделю»")
		return false
	SimPlayer.toast("Не хватает золота.")
	return false

static func prestige(v: float) -> void:
	var C: Dictionary = Sim.G.court
	C.prestige = JS.clp(JS.n(C.get("prestige")) + v, -100, 100)

static func opinionWord(v: float) -> String:
	return "дружба" if v >= 50 else ("тёплые" if v >= 20 else ("ровные" if v > -10 else ("холодные" if v > -40 else "вражда")))

## что король знает о скрытом свойстве человека: точно — по досье, иначе ничего
static func knownStat(c: Dictionary, k: String) -> Variant:
	var K: Variant = Sim.G.court.known.get(JS.s(c.id))
	if K != null and K.has(k):
		return K[k]
	return null

# ---------- Приказ и Замысел (Сунь-цзы, гл. 3: «Побеждает тот, у кого полководец способен, а государь не вмешивается») ----------
static func orderEff(c: Variant, seatK: String, mode: String) -> float:
	if c == null:
		return 0.45
	var sk := skillOf(c, seatDef(seatK).sk)
	var tr: Array = c.traits
	var e := 0.45 + sk / 16 if mode == "intent" else 0.75 + sk / 60
	if mode == "intent" and tr.has("wise"):
		e += 0.1
	if mode == "order" and tr.has("patient"):
		e += 0.04
	if mode == "order" and tr.has("proud"):
		e -= 0.06
	if tr.has("cunning") and seatK == "eye":
		e += 0.08
	var loy: float = c.loy if c.has("loy") else 60.0
	if loy < 30:
		e *= 0.75
	elif loy > 80:
		e *= 1.05
	var v := JS.clp(e, 0.3, 1.9)
	# тайный шпион в совете работает спустя рукава (birds.js)
	return v * 0.75 if SimBirds.isHiddenSpy(c) else v

static func effWord(e: float) -> String:
	return "блестяще" if e >= 1.35 else ("хорошо" if e >= 1.1 else ("сносно" if e >= 0.9 else ("слабо" if e >= 0.7 else "плохо")))

static func ordDef(seatK: String, k: String) -> Variant:
	for o in ORD().get(seatK, []):
		if o.k == k:
			return o
	return null

const LINES_ORDER := ["Как прикажете, государь… хотя я бы сделал это иначе.", "Будет исполнено в точности. Хоть я и знаю способ лучше.", "Государь, вы связываете мне руки. Но я исполню."]
const LINES_TRUST := ["Благодарю за доверие, государь. Я найду лучший путь.", "Понимаю замысел. Положитесь на меня.", "Отличная мысль. Позвольте мне самому выбрать средства."]
const LINES_LOST := ["Э-э… да, государь. Я… что-нибудь придумаю.", "Постараюсь понять, чего вы желаете…"]
const LINES_OK := ["Будет исполнено, государь.", "Слушаюсь.", "Сделаю, что смогу."]

## поручение месту совета: mode — «order» (Приказ) или «intent» (Замысел), t — цель (держава, дом, крепость, знание, человек)
static func giveOrder(seatK: String, k: String, mode: String, t: Variant = null) -> bool:
	var G := Sim.G
	var C: Dictionary = G.court
	var c: Variant = SimDyn.seatChar(seatK)
	var d: Variant = ordDef(seatK, k)
	if c == null or d == null:
		return false
	if JS.t(d.cost) and not spend(d.cost):
		return false
	var o := {"k": k, "mode": mode}
	if t != null:
		o.t = t
	Sim.assign(o, {"day0": G.day, "dur": d.dur, "prog": 0.0})
	var prev: Variant = C.orders.get(seatK)
	if JS.t(prev) and prev.k == "research":
		G.tech.cur = null
	C.orders[seatK] = o
	if JS.t(d.go):
		ordGo(seatK, o, c)
	if not JS.t(C.get("lastOrd")):
		C.lastOrd = {}
	C.lastOrd[seatK] = G.day
	var sk := skillOf(c, seatDef(seatK).sk)
	var line: String
	if mode == "order" and sk >= 13:
		c.loy = JS.clp(float(JS.o(c.get("loy"), 60.0)) - (3.0 if c.traits.has("proud") else 1.5) * (0.4 if SimDyn.hasTech("chancery") else 1.0), 0, 100)
		line = Sim.R.pick(LINES_ORDER)
	elif mode == "intent" and sk >= 11:
		c.loy = JS.clp(float(JS.o(c.get("loy"), 60.0)) + 1, 0, 100)
		line = Sim.R.pick(LINES_TRUST)
	elif mode == "intent" and sk <= 6:
		line = Sim.R.pick(LINES_LOST)
	else:
		line = Sim.R.pick(LINES_OK)
	if not (say_hook.is_valid() and say_hook.call(seatK, line)):
		SimPlayer.toast(SimDyn.seatName(seatK) + ": «" + line + "»")
	return true

## поручения идут день за днём: дневное действие, ход дела, итог — доклад
static func ordersDaily() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	for s in Sim.SEATS:
		var sk: String = s.k
		var o: Variant = C.orders.get(sk)
		if not JS.t(o):
			continue
		var c: Variant = SimDyn.seatChar(sk)
		if c == null:
			C.orders[sk] = null
			continue
		var d: Variant = ordDef(sk, o.k)
		if d == null:
			C.orders[sk] = null
			continue
		if not o.has("eff"):
			o.eff = orderEff(c, sk, o.mode)
		if JS.t(o.get("self")):
			o.eff = orderEff(c, sk, "intent") * (0.9 if o.k == "research" else selfK(sk))
		if JS.t(d.day):
			ordDay(sk, o, c, o.eff)
		o.prog = minf(1.0, (G.day - o.day0) / o.dur)
		if JS.t(o.get("fin")) or G.day - o.day0 >= o.dur:
			var rep := ordDone(sk, o, c, o.eff)
			C.orders[sk] = null
			if not JS.t(o.get("self")):
				if not JS.t(C.get("lastOrd")):
					C.lastOrd = {}
				C.lastOrd[sk] = G.day
			if rep != "":
				addReport(sk, ("Сам, без поручения: " if JS.t(o.get("self")) else "") + rep, JS.t(o.get("self")))
	selfOrders()

## советник без поручений берётся за дело сам: дёшево и безопасно, но тем слабее, чем дольше молчит король
static func selfK(k: String) -> float:
	var G := Sim.G
	var C: Dictionary = G.court
	if not JS.t(C.get("lastOrd")):
		C.lastOrd = {}
	var L: Dictionary = C.lastOrd
	if not L.has(k):
		L[k] = G.day
	var idle: float = G.day - L[k]
	return JS.clp(0.75 - maxf(0.0, idle - 14) * 0.012, 0.4, 0.75)

## провинции короны (их главное поселение — наше)
static func ownProvs(r := 0.0) -> Array:
	var G := Sim.G
	var W := Sim.W
	return (G.provs as Array).filter(func(P): return G.setts[W.provs[int(P.id)].seat].owner == r)

## что советник выберет сам (SELF): [поручение, цель] или null
static func selfPick(k: String) -> Variant:
	var G := Sim.G
	var C: Dictionary = G.court
	match k:
		"chancellor":
			var Hs: Array = JS.sort((G.houses as Array).filter(func(h): return JS.t(h.alive) and h.loy < 45), func(a, b): return a.loy - b.loy)
			if Hs.size() > 0:
				return ["calm_house", Hs[0].id]
			var T: Array = JS.sort([1.0, 2.0, 3.0, 4.0].filter(func(t): return SimDay.alive(int(t)) and not JS.t(G.rel[0][int(t)].war)), func(a, b): return SimDay.opinionOf(int(a), 0) - SimDay.opinionOf(int(b), 0))
			return ["improve_rel", T[0]] if T.size() > 0 else null
		"treasurer":
			return ["census"] if float(JS.o(C.get("incK"), 1.0)) < 1.12 else null
		"marshal":
			return ["train"] if SimPlayer.capitalArmy() != null else null
		"eye":
			return ["protect"]
		"seneschal":
			if JS.n(C.get("grain")) < minf(granCap() - 1500, granRes() + 1000):
				return ["stock"]
			return ["alms"] if G.provs[Sim.W.setts[int(G.realms[0].capital)].prov].unrest > 12 else null
		"magister":
			return null   # v3.6: свои темы магистр выбирает в study.js (studyDaily)
		"justice":
			var P := ownProvs()
			var u := 0.0
			if P.size() > 0:
				for p in P:
					u += p.unrest
				u /= P.size()
			if u > 15:
				return ["banditry"]
			return ["audit"] if G.day - float(JS.o(C.get("auditDay"), -99.0)) > 60 else ["laws"]
	return null

static func selfOrders() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	if not JS.t(C.get("lastOrd")):
		C.lastOrd = {}
	var L: Dictionary = C.lastOrd
	var SK: Array = Sim.T.SELF_K
	for s in Sim.SEATS:
		var sk: String = s.k
		var c: Variant = SimDyn.seatChar(sk)
		if c == null or JS.t(C.orders.get(sk)) or not SK.has(sk):
			continue
		if not L.has(sk):
			L[sk] = G.day
			continue
		if G.day - L[sk] < 2:
			continue   # день королю — сказать своё слово
		var pk: Variant = selfPick(sk)
		if pk == null:
			continue
		var d: Variant = ordDef(sk, pk[0])
		if d == null:
			continue
		if JS.t(d.cost):
			var pay := ceilf(d.cost / 2)   # сам советник тратит скупо: полцены
			if G.realms[0].gold < pay + 200:
				continue
			G.realms[0].gold -= pay
		var o := {"k": d.k, "mode": "intent"}
		if pk.size() > 1:
			o.t = pk[1]
		Sim.assign(o, {"day0": G.day, "dur": d.dur, "prog": 0.0, "self": 1.0})
		o.eff = orderEff(c, sk, "intent") * selfK(sk)
		C.orders[sk] = o
		if JS.t(d.go):
			ordGo(sk, o, c)
		if d.k == "audit":
			C.auditDay = G.day

static func addReport(seatK: String, text: String, quiet := false) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	C.reports.append({"seat": seatK, "text": text, "day": G.day})
	if C.reports.size() > 40:
		C.reports.pop_front()
	if not quiet:
		Sim.glog(SimDyn.seatName(seatK) + ": " + text, "info")

# ---------- доклады совета (их глазами) ----------
static func noisy(v: float, c: Variant, sk: String, honBias := 0.0) -> float:
	var s := skillOf(c, sk)
	var err := JS.clp((20 - s) / 45, 0.04, 0.4)
	var x := v * (1 + Sim.R.range(-err, err))
	if honBias != 0.0:
		x *= 1 + honBias
	var q := 10.0 if v > 200 else 1.0
	return maxf(0.0, JS.rnd(x / q) * q)

static func nearSettName(a: Dictionary) -> String:
	var s := SimDay.settNear(a.x, a.y, 30)
	return Sim.W.setts[s].name if s >= 0 else "дороги"

static func avgUnrest(P: Array) -> float:
	if P.is_empty():
		return 0.0
	var u := 0.0
	for p in P:
		u += p.unrest
	return u / P.size()

## доклад места совета (окно совета): что советник видит и как понимает — с его ошибкой
static func seatReport(k: String) -> Variant:
	var G := Sim.G
	var C: Dictionary = G.court
	var r: Dictionary = G.realms[0]
	var c: Variant = SimDyn.seatChar(k)
	if c == null:
		return null
	var o: Variant = C.orders.get(k)
	var ord: String
	if JS.t(o):
		ord = (" Без ваших поручений взялся сам: «" if JS.t(o.get("self")) else " Поручение «") + String(ordDef(k, o.k).n) + "» исполнено на " + JS.s(JS.rnd(o.prog * 100)) + "%." \
			+ (" Давно не слышу вашего слова, государь, — работаю наугад." if JS.t(o.get("self")) and selfK(k) < 0.7 else "")
	else:
		ord = " Поручений от вас нет — жду слова государя."
	match k:
		"chancellor":
			var L := []
			for t in range(1, 5):
				if SimDay.alive(t):
					var dd := maxf(0.0, 14 - c.dip)
					var v := SimDay.opinionOf(t, 0) + Sim.R.i(-dd, dd)
					L.append(Sim.realmName(t) + " — " + ("война" if JS.t(G.rel[0][t].war) else opinionWord(v)))
			var bad := []
			for H0 in G.houses:
				if JS.t(H0.alive) and H0.loy < 35:
					bad.append(H0.name)
			return "Отношения с державами: " + ", ".join(L) + "." + (" Недовольны дома: " + ", ".join(bad) + "." if bad.size() > 0 else " Знатные дома спокойны.") + ord
		"treasurer":
			var inc := JS.n(r.get("inc"))
			return "В казне " + Sim.zol(Sim.bookGold()) + ", доход " + JS.fixed(inc, 1) + " в день, расход " + JS.fixed(JS.n(r.get("exp")), 1) + "." + treasurerEconNote(c) \
				+ (" Казна скудеет, государь!" if Sim.bookGold() < 100 else "") + ord
		"marshal":
			var A: Array = (G.armies as Array).filter(func(a): return JS.t(a.alive) and a.realm == 0.0 and a.kind == "lord")
			var men := 0.0
			for a in A:
				men += Sim.armyMen(a)
			return "Под знамёнами " + SimArmy.voin(noisy(men, c, "mar")) + " в " + JS.s(A.size()) + " " + Sim.plural(A.size(), "войске", "войсках", "войсках") + "." \
				+ (" Сэр " + String(Sim.charOf(A[0].gen).name) + " стоит у " + nearSettName(A[0]) + "." if A.size() > 0 else "") + ord
		"eye":
			var L := []
			for t in range(1, 5):
				if not SimDay.alive(t):
					continue
				var men := 0.0
				for a in G.armies:
					if JS.t(a.alive) and a.realm == float(t) and a.kind == "lord":
						men += Sim.armyMen(a)
				var net := JS.n(C.net.get(JS.s(t)))
				var est := noisy(men, c, "intr") if net != 0.0 else JS.rnd(noisy(men, {"intr": c.intr * 0.6}, "intr") / 50) * 50
				L.append(Sim.realmName(t) + " ~" + JS.s(est))
			var sec := 0
			for s in C.secrets:
				if not JS.t(s.known) and s.k != "love":
					sec += 1
			return "Войска соседей (по моим людям): " + ", ".join(L) + "." + (" При дворе что-то затевается — по ночам в саду шепчутся." if sec > 0 and c.intr >= 10 else " При дворе всё спокойно.") + ord
		"seneschal":
			return "В амбарах " + JS.s(noisy(C.grain, c, "stew")) + " мер зерна. " + ("Это меньше неприкосновенного запаса — случись осада или голодный год, беда." if C.grain < granRes() \
				else ("Год голодный, деревни ждут хлеба." if granFamine() else "Голод нам не грозит.")) + " Двор " + ("восхищён государем" if C.prestige > 15 else ("ропщет" if C.prestige < -10 else "спокоен")) + "." + ord
		"magister":
			return SimTech.studyReport(c) + ("" if JS.t(o) and o.k == "research" else ord)
		"justice":
			var P := ownProvs()
			var u := avgUnrest(P)
			var worst: Variant = JS.sort(P.duplicate(), func(a, b): return b.unrest - a.unrest)[0] if P.size() > 0 else null
			return "Смута в провинциях " + ("велика" if u > 40 else ("заметна" if u > 20 else "невелика")) + ("; хуже всего в " + String(Sim.W.provs[int(worst.id)].name) if worst != null and worst.unrest > 25 else "") + "." + ord
	return ord

## заметка казначея о хозяйстве (econui.js: treasurerEconNote) — пока без рынков: только книги
static func treasurerEconNote(_c: Variant) -> String:
	return ""

# ---------- тайны, кражи, проверки ----------
static func addSecret(k: String, who: Array, o: Dictionary = {}) -> Variant:
	var G := Sim.G
	var C: Dictionary = G.court
	for s in C.secrets:
		if s.k == k and not JS.t(s.known) and s.who[0] == who[0]:
			return null
	var s := {"id": G.nextId, "k": k, "who": who, "day": G.day, "known": 0.0, "lastMeet": -9.0}
	G.nextId += 1
	Sim.assign(s, o)
	C.secrets.append(s)
	return s

static func secretText(s: Dictionary) -> String:
	var a: Variant = Sim.charOf(s.who[0])
	match s.k:
		"theft":
			return "Казначей " + (String(a.name) if a != null else "") + " ворует из казны: книги показывают больше, чем лежит в сундуках (≈" + JS.s(JS.rnd(Sim.G.court.hidden)) + " зол.)."
		"plot":
			return "Дом " + SimDyn.houseName(s.get("house")) + " тайно сносится с державой " + Sim.realmName(s.get("realm")) + "."
		"spy":
			return "При дворе шпион державы " + Sim.realmName(s.get("realm")) + " — " + (String(a.name) if a != null else "кто-то из слуг") + "."
		"love":
			return "Конюх и служанка встречаются по ночам. Ничего опасного."
	return "Тайна."

## нечестный или жадный казначей понемногу крадёт: книги показывают больше, чем лежит в сундуках
static func treasurerDaily() -> void:
	var G := Sim.G
	var c: Variant = SimDyn.seatChar("treasurer")
	var C: Dictionary = G.court
	var r: Dictionary = G.realms[0]
	if c == null:
		return
	# казначей, что служит ради золота, крадёт, как жадный (birds.js)
	var greedy: bool = c.traits.has("greedy") or (JS.t(c.get("motive")) and c.motive.k == "gold")
	var hon: float = c.hon if c.has("hon") else 60.0
	if (hon >= 45 and not greedy) or JS.n(C.get("thiefScared")) > G.day:
		return
	if not Sim.R.chance(JS.clp((50 - hon) / 400 + (0.04 if greedy else 0.0), 0, 0.15)):
		return
	var x := JS.rnd(JS.clp(float(JS.o(r.get("inc"), 5.0)) * Sim.R.range(0.4, 0.9), 2, 22))
	if r.gold < x + 25:
		return
	r.gold -= x
	C.hidden += x
	c.wealth = JS.n(c.get("wealth")) + x
	addSecret("theft", [c.id])

static func auditTreasury(judge: Variant, e: float) -> String:
	var G := Sim.G
	var C: Dictionary = G.court
	var t: Variant = SimDyn.seatChar("treasurer")
	if C.hidden < 6:
		return "Книги казначея сверены с сундуками: всё сходится."
	var bribed: bool = judge != null and float(JS.o(judge.get("hon"), 60.0)) < 35 and Sim.R.chance(0.6)
	if bribed:
		judge.wealth = JS.n(judge.get("wealth")) + 20
		return "Книги проверены. Судья уверяет: всё сходится до монеты."
	var p := JS.clp(0.35 + e * 0.35 + (judge.lrn / 50 if judge != null else 0.0) - (t.intr / 60 if t != null else 0.0), 0.15, 0.97)
	if not Sim.R.chance(p):
		return "Проверка окончена: нашлись мелкие ошибки в счёте, но ничего дурного."
	var s: Variant = null
	for x in C.secrets:
		if x.k == "theft" and not JS.t(x.known):
			s = x
			break
	if s == null:
		s = addSecret("theft", [t.id if t != null else -1.0])
	if s != null:
		s.known = 1.0
		s.how = "проверка"
	C.pendingConfront = 1.0
	return "Проверка нашла недостачу ≈" + Sim.zol(C.hidden) + "! Книги казначея лгут."

# ---------- места совета ----------
## снять с места; жаждущий власти обижается вдвойне (birds.js)
static func dismissSeat(k: String, why := "") -> void:
	var c: Variant = Sim.charOf(Sim.G.court.seats[k])
	_dismissSeat(k, why)
	if c != null and JS.t(c.get("motive")) and c.motive.k == "power":
		c.loy = JS.clp(float(JS.o(c.get("loy"), 50.0)) - 10, 0, 100)

static func _dismissSeat(k: String, why := "") -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var id: float = C.seats[k]
	if id < 0:
		return
	var c: Variant = Sim.charOf(id)
	C.seats[k] = -1.0
	if JS.t(C.orders.get(k)) and C.orders[k].k == "research":
		G.tech.cur = null
	C.orders[k] = null
	if c != null:
		c.loy = JS.clp(float(JS.o(c.get("loy"), 50.0)) - 25, 0, 100)
		c.seat = null
		if c.house >= 0 and c.house < G.houses.size() and why != "вор":
			SimPlayer.houseLoy(G.houses[int(c.house)], -8)
	seats_rev += 1

## назначить: пташки заводят дело, жаждущий власти рад месту (birds.js)
static func appointSeat(k: String, id: float) -> void:
	var c: Variant = Sim.charOf(id)
	if c != null:
		SimBirds.birdRec(c)
	var was: bool = c != null and JS.t(c.get("seat"))
	_appointSeat(k, id)
	if c != null and not was and SimBirds.motiveOf(c).k == "power":
		c.loy = JS.clp(float(JS.o(c.get("loy"), 50.0)) + 6, 0, 100)

static func _appointSeat(k: String, id: float) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var c: Dictionary = Sim.charOf(id)
	if not JS.t(C.get("lastOrd")):
		C.lastOrd = {}
	C.lastOrd[k] = G.day
	var cur: float = C.seats[k]
	if cur == id:
		return
	if cur >= 0:
		dismissSeat(k)
	for s in Sim.SEATS:
		if C.seats[s.k] == id:
			C.seats[s.k] = -1.0
			C.orders[s.k] = null
	C.seats[k] = id
	c.seat = k
	c.atCourt = 1.0
	c.loy = JS.clp(float(JS.o(c.get("loy"), 50.0)) + 12, 0, 100)
	if c.house >= 0 and c.house < G.houses.size():
		SimPlayer.houseLoy(G.houses[int(c.house)], 6)
	Sim.glog(String(c.name) + " назначен: " + SimDyn.seatName(k) + ".", "good")
	seats_rev += 1

static func candidatesFor(k: String) -> Array:
	var G := Sim.G
	var sk: String = seatDef(k).sk
	var L: Array = (G.chars as Array).filter(func(c): return JS.t(c.alive) and c.prison < 0 and c.realm == 0.0 \
		and (c.role == "courtier" or c.role == "council" or c.role == "knight" or c.role == "lord" or c.role == "scholar") and c.age >= 16 \
		and (JS.t(c.get("atCourt")) or c.role == "lord") and not JS.t(c.get("withKing")) and c.id != G.player.char and SimPlayer.armyOfGen(c.id) == null)
	return JS.sort(L, func(a, b): return SimBirds.skSeen(b, sk).v - SimBirds.skSeen(a, sk).v)

## день совета (councilDaily): поручения, казначей, тайны, письма, прошения
static func councilDaily() -> void:
	if not Sim.G.has("court"):
		return
	SimSick.ordersDaily()
	treasurerDaily()
	secretsDaily()
	lettersDaily()
	petitionsDaily()

# ---------- амбары (granary.js) ----------
static func granCap() -> float:
	return JS.rnd(10000.0 * (1.5 if SimDyn.projDone("granary") else 1.0))

static func granRes() -> float:
	return SimArmy.granS().res if Sim.G.has("court") else 0.0

static func granFree() -> float:
	return maxf(0.0, floorf(JS.n(Sim.G.court.get("grain")) - granRes())) if Sim.G.has("court") else 0.0

static func granFamine() -> bool:
	var G := Sim.G
	var o := SimArmy.granS()
	var y := floorf(G.day / Sim.DAYS_YEAR) + 1
	var d := fmod(G.day, Sim.DAYS_YEAR)
	return (o.famY == y and d >= Sim.DAYS_SEASON * 3) or (o.famY == y - 1 and d < Sim.DAYS_SEASON + 16)

# ---------- поручения (ORD): начало, дневное дело, итог ----------
static func honest(c: Dictionary) -> bool:
	return float(JS.o(c.get("hon"), 60.0)) >= 45 and not c.traits.has("greedy")

static func ordGo(_sk: String, o: Dictionary, _c: Dictionary) -> void:
	var G := Sim.G
	match o.k:
		"lower_tax":
			G.court.taxK = 0.75
		"guard":
			G.court.guard = 1.0
		"research":
			var T: Dictionary = SimTech.techInit()
			T.cur = o.t
			if not JS.t(o.get("self")):
				T.first = 1.0
				T.by = "king"
				T.why = ""

static func ordDay(_sk: String, o: Dictionary, c: Dictionary, e: float) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var cap: float = G.realms[0].capital
	match o.k:
		"improve_rel":
			SimDay.addOpn(o.t, 0, 0.55 * e)
		"goodwill":
			for t in range(1, 5):
				if SimDay.alive(t) and not JS.t(G.rel[0][t].war):
					SimDay.addOpn(t, 0, 0.2 * e)
		"lower_tax":
			for P in ownProvs():
				P.unrest = maxf(0.0, P.unrest - 0.4)
		"train":
			for a in G.armies:
				if JS.t(a.alive) and a.realm == 0.0 and a.kind == "lord" and SimDay.settNear(a.x, a.y, 2) == cap:
					for t in Sim.UT:
						a.xp[t] = minf(100.0, a.xp[t] + 0.5 * e * (2.0 if SimDyn.hasTech("drill") else 1.0))
		"protect":
			for s in C.secrets:
				if not JS.t(s.known) and s.k != "love" and Sim.R.chance(0.012 * e + c.intr / 1500):
					s.known = 1.0
					s.how = "слежка Ока"
					SimDyn.letterFromSeat("eye", "Тайное донесение", secretText(s))
		"incite":
			for P in ownProvs(o.t):
				P.unrest = minf(100.0, P.unrest + 0.5 * e)
		"icp":
			icpDay(o, c, e)
		"stock":
			if G.realms[0].gold > 30:
				G.realms[0].gold -= 2
				C.grain = minf(granCap(), JS.n(C.get("grain")) + JS.rnd(50 * e))
		"alms":
			if JS.n(C.get("grain")) >= 30:
				C.grain -= 30
				provUnrest(cap, -0.8 * e)
				prestige(0.06 * e)
		"research":
			var T: Dictionary = SimTech.techInit()
			if not JS.t(T.get("cur")):
				T.cur = o.t
			if SimTech.studyPay(T.cur):
				SimTech.techProgress(JS.clp(c.lrn / 9, 0.3, 2.4) * e)
			if not JS.t(T.get("cur")) or JS.t(T.done.get(o.t)):
				o.fin = 1.0
		"heal":
			for a in G.armies:
				if JS.t(a.alive) and a.realm == 0.0 and SimDay.settNear(a.x, a.y, 3) == cap:
					a.sick = maxf(0.0, a.sick * (1 - 0.08 * e))
		"chronicle":
			prestige(0.12 * e)
		"banditry":
			for P in ownProvs():
				P.unrest = maxf(0.0, P.unrest - 0.6 * e)
		"laws":
			for P in ownProvs():
				P.unrest = maxf(0.0, P.unrest - 0.25 * e)

static func nPl(n: float, a: String, b: String, c: String) -> String:
	return JS.s(n) + " " + Sim.plural(n, a, b, c)

## итог поручения — текст доклада
static func ordDone(_sk: String, o: Dictionary, c: Dictionary, e: float) -> String:
	var G := Sim.G
	var W := Sim.W
	var C: Dictionary = G.court
	var r0: Dictionary = G.realms[0]
	var cap: float = r0.capital
	match o.k:
		# --- канцлер ---
		"improve_rel":
			return "Отношения с державой " + Sim.realmName(o.t) + " стали теплее (" + effWord(e) + ")."
		"calm_house":
			var H0: Dictionary = G.houses[int(o.t)]
			SimPlayer.houseLoy(H0, JS.rnd(10 * e))
			return "Дом " + String(H0.name) + " успокоен (" + effWord(e) + "). Верность дома выросла."
		"embassy":
			var t: int = int(o.t)
			var war := JS.t(G.rel[0][t].war)
			var a := acceptance("peace" if war else "pact", t, {})
			var bonus := (e - 1) * 30
			if a.lines.size() > 0 and a.lines[0].v == -999.0:
				return "Двор державы " + Sim.realmName(t) + " не принял посольство: «недавно уже отвечали»."
			if a.sum + bonus > 0:
				G.realms[t].asked = 0.0
				if war:
					var ws := SimAI.warScore(0, t)
					SimCmd.makePeace(0.0 if ws >= 0 else float(t), float(t) if SimAI.warScore(0, t) >= 0 else 0.0, false)
				else:
					SimDay.setRel(0, t, "pact", G.day + Sim.DAYS_YEAR * 2)
				return "Посольство удалось! " + ("Заключён мир с державой " + Sim.realmName(t) + "." if war else "Пакт о ненападении с державой " + Sim.realmName(t) + " на 2 года.")
			SimDay.addOpn(t, 0, 2)
			G.realms[t].asked = G.day + 6
			return "Посольство вернулось ни с чем: " + Sim.realmName(t) + " не согласна (не хватило " + JS.s(JS.rnd(-(a.sum + bonus))) + " доводов). Но отношения чуть потеплели."
		"goodwill":
			return "Соседи благодарят за учтивые письма (" + effWord(e) + ")."
		"reconcile":
			var n := 0.0
			for H0 in G.houses:
				if JS.t(H0.alive):
					SimPlayer.houseLoy(H0, JS.rnd(3 * e))
					n += 1
			return "Главы " + nPl(n, "дома", "домов", "домов") + " помирились за чашей вина (" + effWord(e) + ")."
		# --- казначей ---
		"tax_extra":
			var own := 0.0
			for S in G.setts:
				if S.owner == 0.0:
					own += 1
			var g := JS.rnd(90 * e + own * 6)
			var hon := honest(c)
			var real := g if hon else JS.rnd(g * 0.7)
			r0.gold += real
			if not hon:
				C.hidden += g - real
				addSecret("theft", [c.id])
			for P in ownProvs():
				P.unrest = minf(100.0, P.unrest + 9)
			for H0 in G.houses:
				SimPlayer.houseLoy(H0, -3)
			return "Чрезвычайный сбор принёс " + Sim.zol(g) + " (по книгам). Народ ропщет."
		"lower_tax":
			C.taxK = 1.0
			for H0 in G.houses:
				SimPlayer.houseLoy(H0, 4)
			prestige(3)
			return "Сезон лёгких податей окончен. Народ благословляет короля."
		"buy_grain":
			var hon := honest(c)
			var q := JS.rnd(1500 * JS.clp(e, 0.6, 1.4) * (1.0 if hon else 0.72))
			C.grain = minf(granCap(), JS.n(C.get("grain")) + q)
			if not hon:
				C.hidden += 12
				r0.gold -= 0
				addSecret("theft", [c.id])
			return "В амбары завезено " + JS.s(q) + " мер зерна." + ("" if hon else " Цена, правда, вышла высоковата.")
		"census":
			C.incK = minf(1.35, float(JS.o(C.get("incK"), 1.0)) + 0.04 * e)
			return "Перепись окончена: доход казны вырос на " + JS.s(JS.rnd(4 * e)) + "%."
		"charters":
			var n := 0.0
			for S in G.setts:
				if S.owner == 0.0 and W.setts[int(S.id)].type != "village":
					S.prosp = minf(100.0, S.prosp + JS.rnd(5 * e))
					n += 1
			return "Купцы " + nPl(n, "города", "городов", "городов") + " получили грамоты: торговля оживилась (" + effWord(e) + ")." if n > 0 else "Городов у нас нет — грамоты некому выдать."
		"sell_grain":
			var q := floorf(granFree() / 3)
			if q < 50:
				return "Продавать нечего: сверх неприкосновенного запаса зерна почти нет."
			var hon := honest(c)
			var g := JS.rnd(q * 0.036 * JS.clp(e, 0.6, 1.4))
			var real := g if hon else JS.rnd(g * 0.75)
			C.grain -= q
			r0.gold += real
			if not hon:
				C.hidden += g - real
				addSecret("theft", [c.id])
			return "Продано " + JS.s(q) + " мер зерна за " + JS.s(real) + " зол."
		# --- маршал ---
		"recruit":
			var a: Variant = SimPlayer.capitalArmy()
			var n := JS.rnd(60 * e)
			var u := {"levy": JS.rnd(n * 0.3), "spear": JS.rnd(n * 0.35), "archer": JS.rnd(n * 0.25), "sword": JS.rnd(n * 0.1)}
			if a != null:
				SimPlayer.addU(a.u, u)
			else:
				SimPlayer.addU(G.setts[int(cap)].gar, u)
			return "Набрано " + JS.s(n) + " рекрутов" + (" — они влились в войско сэра " + String(Sim.charOf(a.gen).name) if a != null else " — они в гарнизоне столицы") + "."
		"train":
			return "Учения окончены (" + effWord(e) + "). Войска у столицы стали опытнее."
		"fortify":
			var S: Dictionary = G.setts[int(o.t)]
			if S.owner != 0.0:
				return "Крепость больше не наша — работы брошены."
			S.walls = minf(4.0, S.walls + 1)
			return "Стены " + String(W.setts[int(o.t)].name) + " укреплены (ступень " + JS.s(S.walls) + ")."
		"muster":
			return musterBanners(e)
		"supply":
			var A: Array = (G.armies as Array).filter(func(a): return JS.t(a.alive) and a.realm == 0.0 and (a.kind == "lord" or a.kind == "player") and SimDay.settNear(a.x, a.y, 2) == cap)
			if A.is_empty():
				return "У столицы нет войск — обоз некому отдать."
			var f := 0.0
			for a in A:
				var q := maxf(0.0, floorf(minf(minf(Sim.armyMen(a) * 14 - a.food, granFree()), Sim.armyCap(a) - SimDay.armyLoad(a))))
				a.food += q
				C.grain -= q
				f += q
				a.fodder += JS.rnd(Sim.mountedN(a.u) * 6 * e)
				a.arrows += JS.rnd(Sim.rangedN(a.u) * 15 * e)
				a.water = Sim.waterCap(a)
			return "Обоз снаряжён: " + JS.s(f) + " мер еды из амбаров, фураж, стрелы и вода для " + nPl(A.size(), "войска", "войск", "войск") + "."
		"patrol":
			var k := 0.0
			var m := 0.0
			for a in G.armies:
				if JS.t(a.alive) and a.kind == "bandit":
					var S := SimDay.settNear(a.x, a.y, 8)
					if S >= 0 and G.setts[S].owner == 0.0:
						m += SimDay.takeMen(a, ceilf(Sim.armyMen(a) * JS.clp(0.4 * e, 0.15, 0.8)))
						k += 1
						provUnrest(S, -3)
			return "Облава прошла по " + nPl(k, "шайке", "шайкам", "шайкам") + ": перебито и рассеяно " + JS.s(m) + " разбойников." if k > 0 else "Разъезды не нашли разбойников в наших землях."
		# --- Око ---
		"network":
			var key := JS.s(o.t)
			JS.oset(C.net, key, JS.clp(JS.n(C.net.get(key)) + (2.0 if e > 1.2 else 1.0), 0, 3))
			return "Сеть в державе " + Sim.realmName(o.t) + " окрепла: уровень " + JS.s(C.net[key]) + " из 3."
		"dossier":
			var t: Dictionary = Sim.charOf(o.t)
			var err := JS.rnd(JS.clp(22 - c.intr * 1.2 / maxf(0.6, e), 3, 25))
			var K := {}
			K.loy = JS.clp(float(JS.o(t.get("loy"), 50.0)) + Sim.R.i(-err, err), 0, 100)
			K.amb = JS.clp(float(JS.o(t.get("amb"), 50.0)) + Sim.R.i(-err, err), 0, 100)
			K.hon = JS.clp(float(JS.o(t.get("hon"), 50.0)) + Sim.R.i(-err, err), 0, 100)
			K.err = err
			K.day = G.day
			JS.oset(C.known, JS.s(t.id), K)
			var found := false
			for s in C.secrets:
				if not JS.t(s.known) and (s.who as Array).has(t.id) and Sim.R.chance(JS.clp(0.25 * e + c.intr / 40, 0, 0.9)):
					s.known = 1.0
					s.how = "досье"
			for s in C.secrets:
				if JS.t(s.known) and s.get("how") == "досье" and (s.who as Array).has(t.id):
					found = true
			return "Досье на " + String(t.name) + " готово (точность ±" + JS.s(err) + "): верность ≈" + JS.s(K.loy) + ", честолюбие ≈" + JS.s(K.amb) + ", честность ≈" + JS.s(K.hon) + "." + (" Найдено кое-что интересное!" if found else "")
		"protect":
			return "Охрана двора снята. За время слежки ничего не упущено."
		"rumor":
			for t in range(1, 5):
				if float(t) != o.t:
					SimDay.addOpn(t, o.t, -6 * e)
			if Sim.R.chance(0.25 - c.intr / 100):
				SimDay.addOpn(o.t, 0, -15)
				return "Слухи разошлись, но наших людей заметили — " + Sim.realmName(o.t) + " знает, чья это работа."
			return "Слухи о правителе державы " + Sim.realmName(o.t) + " гуляют по всем дворам (" + effWord(e) + ")."
		"sabotage":
			var t: float = o.t
			if not JS.t(G.rel[0][int(t)].war):
				return "Мы не воюем с державой " + Sim.realmName(t) + " — лазутчики вернулись ни с чем."
			var n := 0.0
			for a in G.armies:
				if JS.t(a.alive) and a.realm == t and a.kind == "lord":
					a.food = floorf(a.food * (1 - JS.clp(0.4 * e, 0.2, 0.7)))
					a.morale = maxf(0.0, a.morale - 8 * e)
					n += 1
			if Sim.R.chance(JS.clp(0.3 - c.intr / 80, 0.05, 0.3)):
				SimDay.addOpn(t, 0, -10)
				return "Обозы " + nPl(n, "войска", "войск", "войск") + " державы " + Sim.realmName(t) + " горят, но одного лазутчика схватили."
			return "Обозы " + nPl(n, "войска", "войск", "войск") + " державы " + Sim.realmName(t) + " сожжены (" + effWord(e) + ")."
		"incite":
			if Sim.R.chance(JS.clp(0.25 - c.intr / 100, 0.05, 0.25)):
				SimDay.addOpn(o.t, 0, -12)
				return "Смута в державе " + Sim.realmName(o.t) + " разгорелась, но там знают, чьих рук дело."
			return "Смута в державе " + Sim.realmName(o.t) + " разгорелась (" + effWord(e) + ")."
		"forge":
			return forgeDone(o.t, c, e)
		"rum_str":
			return rumorDone(o.t, 1.45, c, e)
		"rum_weak":
			return rumorDone(o.t, 0.6, c, e)
		"icp":
			if JS.t(o.get("n")):
				return "Перехвачено гонцов державы " + Sim.realmName(o.t) + ": " + JS.s(o.n) + (", подменено приказов: " + JS.s(o.sw) if JS.t(o.get("sw")) else "") + "."
			return "Гонцов державы " + Sim.realmName(o.t) + " перехватить не удалось: её войска стояли или вести шли другими дорогами."
		# --- сенешаль ---
		"feast":
			for H0 in G.houses:
				SimPlayer.houseLoy(H0, JS.rnd(5 * e * (1.35 if SimDyn.projDone("tapestries") else 1.0)))
			prestige(4)
			C.feastDay = G.day
			# feast.js: вечером в последний день — пир в пиршественном зале
			return "Пир готов (" + effWord(e) + "): сегодня с 17:00 столы в пиршественном зале ломятся от яств, знать съезжается в замок."
		"stock":
			return "Амбары пополнены."
		"guard":
			C.guard = 0.0
			return "Усиленные караулы сняты."
		"tourney":
			for H0 in G.houses:
				if JS.t(H0.alive):
					SimPlayer.houseLoy(H0, JS.rnd(3 * e))
			prestige(JS.rnd(3 * e))
			var a: Variant = SimPlayer.capitalArmy()
			if a != null:
				for t in ["horse", "harch", "knight"]:
					a.xp[t] = minf(100.0, a.xp[t] + 6 * e)
				a.morale = minf(100.0, a.morale + 5)
			var r := "Турнир удался (" + effWord(e) + ")! Знать рукоплещет, о короле говорят повсюду."
			# feast.js: с трибунами у ристалища — поединки в замке (tourSetup), иначе — в поле у стен
			if SimDyn.projDone("stands") and not JS.t(G.get("visit")) and tour_hook.is_valid():
				tour_hook.call()
				return r + " Сегодня с 10:00 — поединки на ристалище!"
			return r + " Бились в поле у стен замка: чтобы смотреть поединки с трибун и выйти на ристалище самому, постройте трибуны (стол зодчего)."
		"alms":
			return "Раздача хлеба окончена. Бедняки молятся за короля."
		# --- магистр ---
		"research":
			return "Изучено: «" + String(SimTech.TECH()[o.t].n) + "»."
		"heal":
			return "Лекари закончили обход."
		"teach":
			var k: Variant = Sim.charOf(o.get("t"))
			if k == null or not JS.t(k.alive):
				return "Ученика больше нет."
			k.lrn = minf(20.0, k.lrn + JS.rnd(2 * e))
			k.dip = minf(20.0, k.dip + (1.0 if e > 1 else 0.0))
			if e > 1.3 and not k.traits.has("wise") and Sim.R.chance(0.3):
				k.traits = (k.traits as Array).filter(func(t): return t != "reckless")
				if k.traits.size() < 3:
					k.traits.append("wise")
			return String(k.name) + " прилежно учится: Книга " + JS.s(k.lrn) + ", Речь " + JS.s(k.dip) + "."
		"chronicle":
			return "Новая глава летописи дописана."
		"herbs":
			var n := 0.0
			var kk := JS.clp(0.35 * e, 0.15, 0.6)
			for a in G.armies:
				if JS.t(a.alive) and a.realm == 0.0:
					var r1 := floorf(a.sick * kk)
					var r2 := floorf(a.wounded * kk * 0.6)
					if r1 + r2 <= 0:
						continue
					a.sick -= r1
					a.wounded -= r2
					SimDay.returnMen(a, r1 + r2)
					n += r1 + r2
			return "Снадобья помогли: в строй вернулись " + nPl(n, "воин", "воина", "воинов") + "." if n > 0 else "Снадобья разосланы, но больных в войсках почти нет."
		"school":
			C.incK = minf(1.35, float(JS.o(C.get("incK"), 1.0)) + 0.015 * e)
			return "Новые писцы разосланы по провинциям: доход вырос на " + JS.fixed(1.5 * e, 1) + "%."
		# --- судья ---
		"audit":
			return auditTreasury(c, e)
		"banditry":
			for a in G.armies:
				if JS.t(a.alive) and a.kind == "bandit":
					var S := SimDay.settNear(a.x, a.y, 10)
					if S >= 0 and G.setts[S].owner == 0.0 and Sim.R.chance(0.35 * e):
						SimArmy.takeU(a.u, ceilf(Sim.armyMen(a) * 0.5))
			return "Суды прошли по всем провинциям (" + effWord(e) + "). На дорогах спокойнее."
		"amnesty":
			for P in ownProvs():
				P.unrest = maxf(0.0, P.unrest - 15)
			prestige(3)
			C.amnestyDay = G.day
			return "Амнистия объявлена. Тюрьмы опустели."
		"laws":
			prestige(JS.rnd(2 * e))
			return "Свод законов обнародован (" + effWord(e) + ")."
		"inquiry":
			var s: Variant = null
			for x in C.secrets:
				if not JS.t(x.known) and x.k != "love":
					s = x
					break
			if s != null and Sim.R.chance(JS.clp(0.35 * e + c.lrn / 60, 0.1, 0.9)):
				s.known = 1.0
				s.how = "следствие судьи"
				return "Следствие открыло тайну: " + secretText(s)
			return "Следствие ничего не нашло" + (", но судья чует неладное." if s != null else ".")
	return ""

## созыв знамён: каждый дом обещает отряд по силе и верности; отряды соберутся через несколько дней (C.musters)
static func musterBanners(e: float) -> String:
	var G := Sim.G
	var C: Dictionary = G.court
	var tot := 0.0
	var refused := []
	var war := SimDay.warsOf(0).size() > 0
	for H0 in G.houses:
		if not JS.t(H0.alive):
			continue
		if H0.defiant > G.day or H0.loy < 25:
			refused.append(H0.name)
			SimPlayer.houseLoy(H0, -2)
			continue
		if H0.fief < 0 or G.setts[int(H0.fief)].ctrl != 0.0:
			continue
		var n := JS.rnd(H0.str * JS.clp(H0.loy / 60, 0.4, 1.4) * JS.clp(e, 0.6, 1.5))
		var u := Sim.roundU({"levy": n * 0.4, "spear": n * 0.3, "archer": n * 0.17, "sword": n * 0.07, "horse": n * 0.04, "knight": n * 0.02})
		C.musters.append({"h": H0.id, "day": G.day + Sim.R.i(2, 6), "u": u})
		tot += Sim.menOf(u)
		SimPlayer.houseLoy(H0, -1.0 if war else -5.0)
	return "Гонцы разосланы по домам. Обещано " + SimArmy.voin(tot) + ": отряды соберутся в своих землях и пойдут к столице." + (" Отказались прислать людей: " + ", ".join(refused) + "." if refused.size() > 0 else "") \
		+ ("" if war else " Лорды ворчат: созывать знамёна в мирное время — накладно.")

# ---------- согласие державы на предложение (diplo.js: acceptance, в духе CK3) ----------
static func powerRatio(a: float, b: float) -> float:
	return SimAI.realmPower(a, b) / maxf(1.0, SimAI.realmPower(b, a))

static func playerOnIntersecting() -> bool:
	var pa: Variant = Sim.playerArmy()
	return pa != null and pa.get("ground") == "intersecting"

static func acceptance(kind: String, t: int, o: Dictionary = {}) -> Dictionary:
	var G := Sim.G
	var p: float = G.player.realm
	var pi := int(p)
	var L := []
	var add := func(txt: String, v: float) -> void:
		v = JS.rnd(v)
		if v != 0.0:
			L.append({"t": txt, "v": v})
	var ru: Dictionary = SimDay.rulerOf(t)
	var tr: Array = ru.traits
	var op := SimDay.opinionOf(t, pi)
	var pw := powerRatio(p, t)
	if JS.n(G.realms[t].get("asked")) > G.day:
		return {"ok": false, "lines": [{"t": "Недавно уже отвечали нам", "v": -999.0}], "sum": -999.0}
	if kind == "peace":
		var ws := SimAI.warScore(pi, t)
		var dur: float = G.day - G.rel[pi][t].since
		add.call("Базовое нежелание", -10)
		add.call("Счёт войны", ws * 0.9)
		add.call("Мнение о нас", op * 0.25)
		add.call("Усталость от войны", minf(30.0, dur / 4))
		if JS.t(o.get("cede")):
			var n := 0.0
			for S in G.setts:
				if S.owner == float(t) and S.ctrl == p and Sim.W.setts[int(S.id)].type != "village":
					n += 1
			add.call("Уступить земли (" + JS.s(n) + ")", -12 - n * 10)
			if G.setts[int(G.realms[t].capital)].ctrl == p:
				add.call("Их столица в наших руках", 25)
		if JS.t(o.get("gold")):
			add.call("Наше золото: " + JS.s(o.gold), o.gold / (3.0 if tr.has("greedy") else 5.0))
		if JS.t(o.get("demand")):
			add.call("Требуем золото: " + JS.s(o.demand), -o.demand / 4)
		if tr.has("proud"):
			add.call("Гордый", -15.0 if JS.t(o.get("cede")) or JS.t(o.get("demand")) else -5.0)
		if tr.has("wrathful"):
			add.call("Гневливый", -8)
		if tr.has("craven"):
			add.call("Трусливый", 12)
		add.call("Соотношение сил", JS.clp((pw - 1) * 20, -25, 25))
		if SimDay.warsOf(t).size() > 1:
			add.call("Воюет на два фронта", 15)
		if playerOnIntersecting():
			add.call("Перекрёсточная земля (гл. 11)", 15)
	elif kind == "ally":
		add.call("Базовое нежелание", -30)
		add.call("Мнение о нас", op * 0.7)
		add.call("Соотношение сил", JS.clp((pw - 0.8) * 15, -15, 20))
		var ce := 0
		for x in SimDay.warsOf(t):
			if JS.t(G.rel[pi][int(x)].war):
				ce += 1
		if ce > 0:
			add.call("Общий враг", 30 * ce)
		var wp := SimDay.warsOf(p).size()
		if wp > 0 and ce == 0:
			add.call("Не хотят втягиваться в нашу войну", -15 * wp)
		if tr.has("honest") and SimDay.rulerOf(pi).traits.has("honest"):
			add.call("Честный с честным", 10)
		if JS.n(G.rel[pi][t].get("truce")) > G.day:
			add.call("Недавняя война", -20)
		if playerOnIntersecting():
			add.call("Перекрёсточная земля (гл. 11)", 15)
	elif kind == "pact":
		add.call("Базовое нежелание", -10)
		add.call("Мнение о нас", op * 0.5)
		add.call("Наша сила их пугает", JS.clp((pw - 1) * 20, -10, 20))
		if SimDay.warsOf(t).size() > 0:
			add.call("Им нужен спокойный тыл", 15)
		if tr.has("wrathful"):
			add.call("Гневливый", -10)
		if playerOnIntersecting():
			add.call("Перекрёсточная земля (гл. 11)", 15)
	elif kind == "tribute":
		add.call("Базовое нежелание", -45)
		add.call("Страх перед нами", JS.clp((pw - 1) * 35, -30, 45))
		add.call("Мнение о нас", op * 0.2)
		add.call("Наша грозная слава", minf(20.0, JS.n(G.realms[pi].get("fear")) / 2))
		if tr.has("proud"):
			add.call("Гордый", -30)
		if tr.has("craven"):
			add.call("Трусливый", 20)
		if JS.t(G.rel[pi][t].war):
			add.call("Мы воюем с ними", -100)
	if G.has("court") and p == 0.0:
		var ch: Variant = SimDyn.seatChar("chancellor")
		if ch != null:
			add.call("Канцлер " + String(ch.name) + " (Речь " + JS.s(ch.dip) + ")", (ch.dip - 10) * 1.5)
		else:
			add.call("Нет канцлера — говорить некому", -8)
		if JS.t(G.court.get("prestige")):
			add.call("Слава короля", JS.clp(G.court.prestige * 0.15, -10, 12))
	var sum := 0.0
	for l in L:
		sum += l.v
	return {"ok": sum > 0, "lines": L, "sum": sum}

# ---------- поручения Ока из deceit.js: подложное письмо, слухи о силе и слабости, перехват гонцов ----------
static func forgeDone(t0: float, c: Dictionary, e: float) -> String:
	var G := Sim.G
	var t := int(t0)
	if not SimDay.alive(t):
		return "Державы " + Sim.realmName(t) + " больше нет — письмо некому подбросить."
	var nb := SimDay.neighbours(t)
	var L: Array = [1.0, 2.0, 3.0, 4.0].filter(func(x): return int(x) != t and SimDay.alive(int(x)) and not JS.t(G.rel[t][int(x)].war) and not JS.t(G.rel[t][int(x)].ally))
	L = JS.sort(L, func(p, q):
		var d1 := (1 if nb.has(q) else 0) - (1 if nb.has(p) else 0)
		if d1 != 0:
			return d1
		var d2 := (1 if JS.t(G.rel[0][int(q)].war) else 0) - (1 if JS.t(G.rel[0][int(p)].war) else 0)
		if d2 != 0:
			return d2
		return G.rel[t][int(p)].opn - G.rel[t][int(q)].opn)
	if L.is_empty():
		return "Подходящего соседа для подлога не нашлось: " + Sim.realmName(t) + " уже со всеми воюет или в союзе."
	var B2: float = L[0]
	var ci := float(JS.o(c.get("intr"), 8.0))
	if Sim.R.f() < JS.clp(0.42 - (ci - 8) * 0.03 - (e - 1) * 0.3 + SimBel.skept(t) * 0.25, 0.06, 0.6):
		SimDay.addOpn(t, 0, -25)
		for x in range(1, 5):
			if x != t and SimDay.alive(x):
				SimDay.addOpn(x, 0, -5)
		var B := SimBel.belOf(t)
		B.fooled = JS.n(B.get("fooled")) + 1
		var s := "Подлог раскрыт! " + Sim.realmName(t) + " знает, что письмо от имени державы " + Sim.realmName(B2) + " сочинили у нас. Позор на всех дворах."
		SimBel.dlog(s, "bad")
		return s
	return _forgeOk(t, B2, e)

static func _forgeOk(t: int, B2: float, e: float) -> String:
	var G := Sim.G
	SimDay.addOpn(t, B2, -JS.rnd(25 * e))
	SimDay.addOpn(B2, t, -8)
	var B := SimBel.belOf(t)
	JS.oset(B.plot, JS.s(B2), G.day + 60)
	var war := false
	if G.rel[t][int(B2)].opn < -40 and SimDay.warsOf(t).is_empty() and Sim.R.f() < 0.3 * e:
		war = SimCmd.declareWar(t, B2)
	var s := "Письмо «от державы " + Sim.realmName(B2) + "» легло на стол правителя " + Sim.realmName(t) + " (" + effWord(e) + "): мнение о соседе упало до " + JS.s(JS.rnd(G.rel[t][int(B2)].opn)) + "." \
		+ (" " + Sim.realmName(t) + " " + SimDay.rV(t, "объявила", "объявило", "объявили") + " войну!" if war else "")
	SimBel.dlog(s, "good")
	return s

static func rumorDone(t0: float, f: float, _c: Dictionary, e: float) -> String:
	var G := Sim.G
	var t := int(t0)
	if not SimDay.alive(t):
		return "Державы " + Sim.realmName(t) + " больше нет."
	var B := SimBel.belOf(t)
	var s0 := SimBel.skept(t)
	if Sim.R.f() < s0 * 0.7 / maxf(0.6, e):
		var s := "В державе " + Sim.realmName(t) + " слухам " + ("о нашей силе" if f > 1 else "о нашей слабости") + " не поверили: правитель " + SimBel.skeptWord(s0) + "."
		SimBel.dlog(s, "bad")
		return s
	var k := 1 + (f - 1) * JS.clp(e, 0.6, 1.4) if f > 1 else 1 - (1 - f) * JS.clp(e, 0.6, 1.4)
	B.rum = {"f": JS.rnd(k * 100) / 100, "until": G.day + JS.rnd(45 * JS.clp(e, 0.7, 1.3)), "k": "str" if f > 1 else "weak"}
	var s := "В державе " + Sim.realmName(t) + " поверили слуху: " + ("у короны новые полки и полные арсеналы" if f > 1 else "войско короны распущено, казна пуста") + " (" + effWord(e) + ", до " \
		+ JS.s(fmod(B.rum.until, Sim.DAYS_SEASON) + 1) + " д. " + String(Sim.T.SEASONS[Sim.seasonOf(B.rum.until)]).to_lower() + ")."
	SimBel.dlog(s, "good")
	return s

static func icpDay(o: Dictionary, c: Dictionary, e: float) -> void:
	var G := Sim.G
	var W := Sim.W
	var t: float = o.t
	o.n = JS.n(o.get("n"))
	o.sw = JS.n(o.get("sw"))
	if not SimDay.alive(int(t)) or o.n >= 8:
		return
	var ci := float(JS.o(c.get("intr"), 8.0))
	for a in G.armies:
		if not JS.t(a.alive) or a.realm != t or a.kind != "lord" or not JS.t(a.get("ai")):
			continue
		var oa: Variant = a.get("onArrive")
		var s: float = oa.s if JS.t(oa) and oa.k == "siege" else -1.0
		if s < 0 or a.ai.get("icp") == s:
			continue
		a.ai.icp = s
		if not Sim.R.chance(JS.clp(0.35 * e + ci / 40, 0.15, 0.9)):
			continue
		o.n += 1
		SimBel.know(a, "icp")
		var g: Variant = Sim.charOf(a.gen)
		var ws: Dictionary = W.setts[int(s)]
		var ours: bool = G.setts[int(s)].ctrl == G.player.realm
		var who := (Sim.charName(g) if g != null else "Войско") + " (" + Sim.realmName(t) + ", ≈" + SimArmy.voin(JS.rnd(Sim.armyMen(a) / 10) * 10) + ")"
		if ours and e >= 1.05 and Sim.R.chance(JS.clp(0.2 * e + (ci - 10) * 0.03, 0.05, 0.45)):
			var alt: Variant = null
			var bd := -1.0
			for S in G.setts:
				if S.ctrl != t or W.setts[int(S.id)].type == "village":
					continue
				var w2: Dictionary = W.setts[int(S.id)]
				var d := JSM.hypot(w2.x - a.x, w2.y - a.y)
				var d2 := JSM.hypot(w2.x - ws.x, w2.y - ws.y)
				if d < 25 * Sim.SEAT_K and d2 > bd:
					bd = d2
					alt = S
			if alt != null and SimAI.goTo(a, int(W.setts[int(alt.id)].i), "patrol"):
				a.onArrive = null
				a.ai.t = 6.0
				o.sw += 1
				var s2 := "Перехватили гонца и подменили приказ: " + who + " вместо " + String(ws.name) + " повернул к " + String(W.setts[int(alt.id)].name) + "."
				SimDyn.letterFromSeat("eye", "Подменённый приказ", s2)
				SimBel.dlog(s2, "good")
				continue
		var s1 := "Перехвачен гонец: " + who + " получил приказ идти на " + String(ws.name) + (" — нашу крепость!" if ours else ".")
		SimDyn.letterFromSeat("eye", "Перехвачен гонец", s1)
		SimBel.dlog(s1, "warn" if ours else "info")

# ---------- прошения и суд (audience.js) ----------
static func rndOwn(type := "") -> Variant:
	var G := Sim.G
	var L: Array = (G.setts as Array).filter(func(S): return S.owner == 0.0 and S.ctrl == 0.0 and (type == "" or Sim.W.setts[int(S.id)].type == type))
	return Sim.R.pick(L) if L.size() > 0 else null

static func provUnrest(sid: float, v: float) -> void:
	var p: int = Sim.W.setts[int(sid)].prov
	var P: Dictionary = Sim.G.provs[p]
	P.unrest = JS.clp(P.unrest + v, 0, 100)

static func bestSkill(c: Dictionary) -> String:
	var b := "mar"
	for k in ["dip", "intr", "stew", "lrn"]:
		if JS.n(c.get(k)) > JS.n(c.get(b)):
			b = k
	return b

## прошение по образцу (PETS.mk): данные просителя или null
static func petMk(k: String) -> Variant:
	var G := Sim.G
	var W := Sim.W
	match k:
		"harvest":
			var S: Variant = rndOwn("village")
			return {"s": S.id, "text": "Государь! В деревне " + String(W.setts[int(S.id)].name) + " град побил рожь. Детям есть нечего. Смилуйтесь — простите подать в этом сезоне!"} if S != null else null
		"bandits":
			var S: Variant = rndOwn()
			return {"s": S.id, "text": "Ваше величество, на тракте у " + String(W.setts[int(S.id)].name) + " разбойники грабят обозы. Третий караван за месяц! Торговля встанет."} if S != null else null
		"dispute":
			var H: Array = (G.houses as Array).filter(func(h): return JS.t(h.alive))
			if H.size() < 2:
				return null
			var a: Dictionary = Sim.R.pick(H)
			var b: Dictionary = Sim.R.pick(H)
			if a == b:
				b = H[(H.find(a) + 1) % H.size()]
			return {"a": a.id, "b": b.id, "text": "Государь, рассудите! Дом " + String(b.name) + " захватил мельницу на реке, что испокон веку принадлежала дому " + String(a.name) + ". Мы требуем справедливости!"}
		"widow":
			return {"text": "Мой муж служил в вашем войске, государь, и пал в бою. Остались трое детей. Не дайте нам умереть с голоду…"}
		"guild":
			var S: Variant = rndOwn("town")
			if S == null:
				S = rndOwn("capital")
			return {"s": S.id, "text": "Ремесленники " + String(W.setts[int(S.id)].name) + " просят грамоту на гильдию. Мы будем платить в казну, государь, — и платить исправно!"} if S != null else null
		"scholar":
			return {"text": "Ваше величество, в монастыре гниют древние трактаты. Дайте денег на переписчиков — и знание не умрёт."}
		"young":
			var H: Array = (G.houses as Array).filter(func(h): return JS.t(h.alive))
			if H.is_empty():
				return null
			var h: Dictionary = Sim.R.pick(H)
			var foes: Array = JS.sort([1, 2, 3, 4].filter(func(t): return SimDay.alive(t)), func(a, b): return SimDay.opinionOf(a, 0) - SimDay.opinionOf(b, 0))
			var spy := 0.0
			if not foes.is_empty() and Sim.R.chance(0.14):
				spy = float(foes[int(Sim.R.i(0, mini(1, foes.size() - 1)))])
			var fem := 1.0 if Sim.R.chance(0.3) else 0.0
			var c := SimDyn.mkHouseMember(h, fem, Sim.R.i(17, 24))
			c.atCourt = 0.0
			if spy != 0.0:
				c.intr = maxf(JS.n(c.get("intr")), Sim.R.i(12, 17))
				c.claim = Sim.R.pick(["stew", "lrn", "dip"])
				c.motive = {"k": "foe", "realm": spy, "cover": Sim.R.pick(["gold", "power", "lore"])}
				c.hon = minf(float(JS.o(c.get("hon"), 50.0)), 40)
			else:
				c.claim = bestSkill(c)
			JS.oset(SimBirds.birdsOf(), JS.s(c.id), {"lv": 0.0, "p": 0.0, "err": 2.0, "d0": G.day})
			return {"h": h.id, "c": c.id, "spy": spy, "text": "Я " + String(c.name) + " из дома " + String(h.name) + ". Прошу места при вашем дворе, государь. " + String(SimBirds.SKC[c.claim])}
		"accuse":
			var S: Variant = rndOwn()
			return {"s": S.id, "text": "Сборщик податей в " + String(W.setts[int(S.id)].name) + " берёт втрое против положенного, а разницу кладёт в карман! Защитите, государь!"} if S != null else null
	return null

## решения по прошению (PETS.ch): {t, good, ok, why, i}; ok — можно ли выбрать сейчас
static func petChoices(p: Dictionary) -> Array:
	var G := Sim.G
	var C: Dictionary = G.court
	var L := []
	var ch := func(t: String, good: float, ok := true, why := "") -> void:
		L.append({"t": t, "good": good, "ok": ok, "why": why, "i": float(L.size())})
	match p.k:
		"harvest":
			ch.call("Простить подать (−20 зол.)", 2)
			ch.call("Выдать зерно из амбаров (−400 мер)", 3, JS.n(C.get("grain")) >= 400, "мало зерна")
			ch.call("Отказать: подать платят все", 0)
		"bandits":
			ch.call("Назначить награду за их головы (−30 зол.)", 2)
			ch.call("Велеть судье устроить выездной суд", 1)
			ch.call("Купцы сами наймут охрану", 0)
		"dispute":
			ch.call("Мельница — дому " + String(G.houses[int(p.a)].name), 1)
			ch.call("Мельница — дому " + String(G.houses[int(p.b)].name), 1)
			ch.call("Поделить доходы мельницы пополам", 2)
		"widow":
			ch.call("Назначить пенсию (−12 зол.)", 2)
			ch.call("Дать мешок зерна (−40 мер)", 1, JS.n(C.get("grain")) >= 40, "мало зерна")
			ch.call("Утешить словом", 0)
		"guild":
			ch.call("Даровать грамоту", 2)
			ch.call("Отказать: знать будет против", 1)
		"scholar":
			ch.call("Дать 25 золотых", 2)
			ch.call("Отказать", 0)
		"young":
			# подсказка «первое впечатление» (birds.js): Око хмурится или нет — решается раз на прошение
			var c: Variant = Sim.charOf(p.c)
			ch.call("Принять ко двору", 2)
			if c != null:
				L[0].tip = SimBirds.impTip(c, p)
			ch.call("Отказать", 0)
		"accuse":
			ch.call("Повесить сборщика", 1)
			ch.call("Поручить судье разобраться", 2)
			ch.call("Наветы! Прогнать", 0)
	return L

## исполнить решение i по прошению p
static func petFx(p: Dictionary, i: int) -> void:
	var G := Sim.G
	var W := Sim.W
	var C: Dictionary = G.court
	var r0: Dictionary = G.realms[0]
	match p.k + str(i):
		"harvest0":
			r0.gold -= 20
			provUnrest(p.s, -15)
			prestige(2)
		"harvest1":
			C.grain -= 400
			provUnrest(p.s, -22)
			prestige(3)
		"harvest2":
			provUnrest(p.s, 10)
			prestige(-1)
		"bandits0":
			r0.gold -= 30
			var ws: Dictionary = W.setts[int(p.s)]
			var B: Array = JS.sort((G.armies as Array).filter(func(a): return JS.t(a.alive) and a.kind == "bandit"), func(a, b): return JSM.hypot(a.x - ws.x, a.y - ws.y) - JSM.hypot(b.x - ws.x, b.y - ws.y))
			if B.size() > 0:
				SimArmy.takeU(B[0].u, ceilf(Sim.armyMen(B[0]) * 0.6))
			G.setts[int(p.s)].prosp = minf(100.0, G.setts[int(p.s)].prosp + 4)
		"bandits1":
			provUnrest(p.s, -6)
		"bandits2":
			G.setts[int(p.s)].prosp = maxf(5.0, G.setts[int(p.s)].prosp - 6)
		"dispute0":
			SimPlayer.houseLoy(G.houses[int(p.a)], 7)
			SimPlayer.houseLoy(G.houses[int(p.b)], -8)
		"dispute1":
			SimPlayer.houseLoy(G.houses[int(p.b)], 7)
			SimPlayer.houseLoy(G.houses[int(p.a)], -8)
		"dispute2":
			SimPlayer.houseLoy(G.houses[int(p.a)], -2)
			SimPlayer.houseLoy(G.houses[int(p.b)], -2)
			prestige(2)
		"widow0":
			r0.gold -= 12
			prestige(3)
			for a in G.armies:
				if JS.t(a.alive) and a.realm == 0.0:
					a.morale = minf(100.0, a.morale + 2)
		"widow1":
			C.grain -= 40
			prestige(1)
		"guild0":
			G.setts[int(p.s)].prosp = minf(100.0, G.setts[int(p.s)].prosp + 8)
			C.incK = minf(1.35, float(JS.o(C.get("incK"), 1.0)) + 0.01)
			for H0 in G.houses:
				SimPlayer.houseLoy(H0, -1)
		"guild1":
			G.setts[int(p.s)].prosp = maxf(5.0, G.setts[int(p.s)].prosp - 3)
		"scholar0":
			r0.gold -= 25
			SimTech.techProgress(8)
		"young0":
			var c: Variant = Sim.charOf(p.c)
			if c == null:
				return
			c.atCourt = 1.0
			SimPlayer.houseLoy(G.houses[int(p.h)], 4)
			Sim.glog(String(c.name) + (" принята" if JS.t(c.get("fem")) else " принят") + " ко двору.", "good")
			SimBirds.birdRec(c).nw = 1.0
			if JS.t(p.get("spy")):
				addSecret("spy", [c.id], {"realm": p.spy, "pet": 1.0})
		"young1":
			SimPlayer.houseLoy(G.houses[int(p.h)], -2)
		"accuse0":
			provUnrest(p.s, -12)
			prestige(1)
		"accuse1":
			provUnrest(p.s, -8)
			C.incK = minf(1.35, float(JS.o(C.get("incK"), 1.0)) + 0.005)
		"accuse2":
			provUnrest(p.s, 8)

## прошение без короля решает судья (или регент, или писцы): мудрый судья выбирает лучшее
static func judgeResolve(p: Dictionary) -> Variant:
	var j0: Variant = SimDyn.seatChar("justice")
	if p.k == "young" and JS.t(p.get("spy")) and j0 != null and Sim.R.chance(JS.clp(j0.lrn / 25, 0.2, 0.8)):
		SimPlayer.houseLoy(Sim.G.houses[int(p.h)], -2)
		p.done = 1.0
		noteVerdict(p, {"t": "Отказать", "good": 2.0}, [{"good": 2.0}], "judge", j0)
		return "Отказать"
	return _judgeResolve(p)

static func _judgeResolve(p: Dictionary) -> Variant:
	var G := Sim.G
	var j: Variant = SimDyn.seatChar("justice")
	if j == null and G.court.regent >= 0:
		j = Sim.charOf(G.court.regent)
	var chs: Array = petChoices(p).filter(func(x): return x.ok)
	if chs.is_empty():
		return null
	var pick: Dictionary
	if j != null and Sim.R.chance(JS.clp(j.lrn / 18, 0.2, 0.95)):
		pick = chs[0]
		for x in chs:
			if x.good > pick.good:
				pick = x
	else:
		pick = Sim.R.pick(chs)
	petFx(p, int(pick.i))
	p.done = 1.0
	noteVerdict(p, pick, chs, "judge" if SimDyn.seatChar("justice") != null else ("regent" if j != null else "clerk"), j)
	return pick.t

static func petGist(p: Dictionary) -> String:
	var G := Sim.G
	var s: String = Sim.T.PET_T.get(p.k, "Прошение")
	if p.has("s") and p.s >= 0 and p.s < Sim.W.setts.size():
		s += " · " + String(Sim.W.setts[int(p.s)].name)
	elif p.k == "dispute":
		s += " · " + String(G.houses[int(p.a)].name) + " и " + String(G.houses[int(p.b)].name)
	elif p.k == "young" and Sim.charOf(p.c) != null:
		s += " · " + String(Sim.charOf(p.c).name)
	return s

## книга суда: каждое решение по прошению — королём или от его имени
static func noteVerdict(p: Dictionary, pick: Dictionary, chs: Array, by: String, c: Variant) -> Dictionary:
	var G := Sim.G
	var C: Dictionary = G.court
	var best := -INF
	for x in chs:
		best = maxf(best, x.good)
	var g: float = pick.good
	var v := {"d": G.day, "g": petGist(p), "t": pick.t, "by": by, "bn": String(c.name) if c != null else "", "q": 2.0 if g >= best else (1.0 if g > 0 else 0.0)}
	if not JS.t(C.get("verdicts")):
		C.verdicts = []
	C.verdicts.push_front(v)
	if C.verdicts.size() > 60:
		C.verdicts.resize(60)
	return v

static func mkPetition() -> Variant:
	var G := Sim.G
	var PS: Array = Sim.T.PETS
	var tot := 0.0
	for d in PS:
		tot += d.w
	var r := Sim.R.f() * tot
	var def: Dictionary = PS[0]
	for d in PS:
		r -= d.w
		if r <= 0:
			def = d
			break
	var p: Variant = petMk(def.k)
	if p == null:
		return null
	p.k = def.k
	p.id = G.nextId
	G.nextId += 1
	p.role = def.role
	p.fem = def.fem if JS.t(def.fem) else (1.0 if Sim.R.chance(0.25) else 0.0)
	p.day = G.day
	return p

## без короля прошения решают от его имени; раз в неделю — запись в летопись
static func petitionsDaily() -> void:
	var G := Sim.G
	if JS.t(G.get("atCourt")):
		return
	var n := int(Sim.R.i(0, 2))
	var k := 0.0
	for i in n:
		var p: Variant = mkPetition()
		if p != null and JS.t(judgeResolve(p)):
			k += 1
	var C: Dictionary = G.court
	C.petAcc = JS.n(C.get("petAcc")) + k
	if C.petAcc > 0 and fmod(G.day, 7.0) == 0.0:
		var wise := 0
		for v in C.get("verdicts", []):
			if G.day - v.d < 7 and v.by != "king" and v.q == 2.0:
				wise += 1
		var reg: bool = C.regent >= 0
		var jud := SimDyn.seatChar("justice") != null
		Sim.glog("За неделю " + ("регент" if reg else ("судья" if jud else "писцы канцелярии")) + " " + ("рассмотрел " if reg or jud else "рассмотрели ") + nPl(C.petAcc, "прошение", "прошения", "прошений") \
			+ " (мудро — " + str(wise) + "). Решения — в «Малом совете», вкладка «Суд».", "info")
		C.petAcc = 0.0

## письма: дошедшие отмечаются; в походе о гонце говорит летопись
static func lettersDaily() -> void:
	var G := Sim.G
	for l in G.court.letters:
		if not JS.t(l.get("read")) and l.arr <= G.day and not JS.t(l.get("noted")):
			l.noted = 1.0
			if not JS.t(G.get("atCourt")):
				Sim.glog("Гонец: «" + String(l.subj) + "» — " + String(l.from), "info")
				Sim.sfx("gallop")

## тайны двора: заговоры недовольных домов, шпионы соседей, любовь в конюшне; созревший заговор — дом перестаёт платить
static func secretsDaily() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	for H0 in G.houses:
		if JS.t(H0.alive) and H0.loy < 30 and float(JS.o(H0.get("amb"), 50.0)) > 55 and Sim.R.chance(0.03):
			var F: Array = JS.sort([1.0, 2.0, 3.0, 4.0].filter(func(t): return SimDay.alive(int(t))), func(a, b): return SimDay.opinionOf(int(a), 0) - SimDay.opinionOf(int(b), 0))
			if F.size() > 0:
				addSecret("plot", [H0.head], {"house": H0.id, "realm": F[0]})
	var spy := false
	var love := false
	for s in C.secrets:
		spy = spy or s.k == "spy"
		love = love or s.k == "love"
	if not spy and Sim.R.chance(0.006 if SimDyn.seatChar("eye") != null else 0.015):
		var F: Array = [1.0, 2.0, 3.0, 4.0].filter(func(t): return SimDay.alive(int(t)))
		var i := int(Sim.R.i(0, 3))
		if i < F.size():
			addSecret("spy", [-1.0], {"realm": F[i]})
	love = false
	for s in C.secrets:
		love = love or s.k == "love"
	if not love and Sim.R.chance(0.01):
		addSecret("love", [-2.0])
	for s in C.secrets:
		if s.k == "plot" and not JS.t(s.known) and G.day - s.day > 35:
			var H0: Variant = G.houses[int(s.house)] if s.house >= 0 and s.house < G.houses.size() else null
			if H0 != null and not JS.t(s.get("ripe")):
				s.ripe = 1.0
				SimPlayer.houseLoy(H0, -8)
				H0.defiant = G.day + 40
				Sim.glog("Дом " + String(H0.name) + " перестал платить подати короне.", "bad")
