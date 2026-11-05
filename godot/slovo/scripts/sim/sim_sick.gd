class_name SimSick
## Болезни при дворе — перенос sick.js (пока то, что нужно династии): кто болеет (король, семья, воспитанники, совет),
## где человек (при дворе или в лагере короля) и лекарь двора: без лекаря риск смерти ×1,5, лучший лекарь — ×0,65.

## кто болеет при дворе: король, его семья, воспитанники и малый совет
static func sickPeople() -> Array:
	var G := Sim.G
	var C: Dictionary = G.court
	var k: Variant = SimPlayer.kingC()
	var S := {}
	var out: Array = []
	var add := func(c: Variant) -> void:
		if c != null and JS.t(c.alive) and not JS.t(c.get("pseudo")) and c.realm == 0.0 and not (c.get("prison") != null and c.prison >= 0) and not JS.t(c.get("away")) and c.age >= 3 and not S.has(c.id):
			S[c.id] = 1
			out.append(c)
	add.call(k)
	for c in SimDyn.royalFamily():
		add.call(c)
	for w in C.get("wards", []):
		add.call(Sim.charOf(w))
	for s in Sim.SEATS:
		var id: Variant = C.seats.get(s.k)
		if id != null and id >= 0:
			add.call(Sim.charOf(id))
	return out

static func sickCircle(c: Variant) -> bool:
	return Sim.G.has("court") and c != null and sickPeople().any(func(x): return is_same(x, c))

static func isFam(c: Variant) -> bool:
	var k: Dictionary = SimPlayer.kingC()
	return c != null and (c.id == k.id or JS.t(c.get("blood")) or c.id == k.get("spouse") or JS.t(c.get("dowager")))

static func whereOf(c: Dictionary) -> String:
	var G := Sim.G
	return "camp" if (c.id == G.player.char and not JS.t(G.get("atCourt"))) or JS.t(c.get("withKing")) else "court"

static func kin(a: Dictionary, b: Dictionary) -> bool:
	var k: Dictionary = SimPlayer.kingC()
	var kids: Array = k.get("kids", [])
	return a.get("spouse") == b.id or b.get("spouse") == a.id or (a.get("kids", []) as Array).has(b.id) or (b.get("kids", []) as Array).has(a.id) or (kids.has(a.id) and kids.has(b.id))

## лекарь рядом с человеком: при дворе — если лекарь не уехал в лагерь, в лагере — если уехал
static func docFor(c: Dictionary) -> Variant:
	var C: Variant = Sim.G.get("court")
	var d: Variant = C.get("doc") if C != null else null
	if not JS.t(d):
		return null
	return d if (whereOf(c) == "camp") == SimDay.docInCamp() else null

## риск смерти: без лекаря ×1,5, цирюльник ×1,15, монах ×1, лучший ×0,65
static func docM(c: Dictionary) -> float:
	var d: Variant = docFor(c)
	return JS.clp(1.3 - 0.04 * d.med, 0.62, 1.2) if d != null else 1.5


# ---------- болезни (sick.js): простуды и лихорадки по сезонам, понос после пиров, оспа и корь в детской, подагра, удар; лекарь двора ----------
## c.ill = {k, d0, end, cr (день кризиса; 0 — миновал или нет), bed, tr (лечение), trd, iso (отделён), why; up — король на ногах, th — терияк}
## c.imm — переболел (оспа, корь); c.goutN — приступов подагры; c.illQ = {k, day, why} — заразился, покажется в тот день;
## c.sickConv — король слаб до этого дня; c.tonic — пьёт отвар до этого дня. C.doc — лекарь, C.docQ — за кем послано, C.plague — мор.
const DIS := {
	"cold": {"n": "простуда", "g": "простуды", "p": 0.012, "seas": [0.7, 0.25, 1.2, 1.85], "ct": 0.011, "dur": [3, 6], "bed": [0.25, 0, 0.2], "m": [0, 0, 0], "cx": [0.011, 0.004, 0.025], "sym": ["Кхе-кхе…", "Апчхи!", "*шмыгает носом*", "Кхе! Простите…"]},
	"fever": {"n": "лихорадка", "g": "лихорадки", "p": 0.0011, "seas": [0.7, 1.7, 1.3, 0.3], "ct": 0.004, "dur": [5, 9], "bed": [1, 1, 1], "m": [0.013, 0.01, 0.05], "sym": ["Ох… знобит…", "Пить…", "Голова горит…"]},
	"chest": {"n": "грудная горячка", "g": "грудной горячки", "p": 0.0003, "seas": [0.7, 0.1, 0.9, 2.3], "ct": 0.003, "dur": [8, 14], "bed": [1, 1, 1], "m": [0.045, 0.038, 0.16], "sym": ["Кха! Кха-кха…", "*хрипло дышит*", "Грудь давит…"]},
	"flux": {"n": "кровавый понос", "g": "кровавого поноса", "p": 0.0004, "seas": [0.5, 1.9, 1.3, 0.3], "ct": 0.006, "dur": [5, 10], "bed": [1, 1, 1], "m": [0.028, 0.021, 0.09], "sym": ["Ох, живот…", "Воды… чистой воды…", "*стонет*"]},
	"pox": {"n": "оспа", "g": "оспы", "p": 0.00005, "seas": [1.3, 0.8, 1, 0.9], "ct": 0.03, "imm": 1, "dur": [12, 18], "bed": [1, 1, 1], "m": [0.075, 0.07, 0.2], "sym": ["Всё горит…", "Не смотрите на меня…", "Пить…"]},
	"measles": {"n": "корь", "g": "кори", "p": 0.0005, "kid": 1, "seas": [1.6, 0.6, 0.8, 1], "ct": 0.05, "imm": 1, "dur": [7, 10], "bed": [1, 1, 1], "m": [0.015, 0.04, 0.06], "sym": ["Чешется…", "Глаза болят от света…", "Кхе…"]},
	"gout": {"n": "подагра", "g": "подагры", "p": 0.0003, "min": 38, "seas": [1, 0.8, 1.1, 1.1], "dur": [4, 9], "bed": [0, 0, 0], "m": [0, 0, 0], "sym": ["Ох, нога!", "Проклятая подагра…", "*хромает и охает*"]},
	"stroke": {"n": "удар", "g": "удара", "p": 0.00016, "min": 52, "seas": [1, 1.1, 1, 0.9], "dur": [10, 20], "bed": [1, 1, 1], "m": [0.3, 0.3, 0.3], "cr0": 1, "sym": ["…", "*мычит*", "*смотрит в одну точку*"]},
	"childbed": {"n": "родильная горячка", "g": "родильной горячки", "p": 0, "dur": [6, 10], "bed": [1, 1, 1], "m": [0.15, 0.15, 0.15], "sym": ["Где дитя?..", "Жарко…", "Пить…"]},
	"plague": {"n": "моровое поветрие", "g": "морового поветрия", "p": 0, "ct": 0.02, "dur": [5, 8], "bed": [1, 1, 1], "m": [0.5, 0.45, 0.6], "sym": ["Пить…", "*стонет*", "Не подходите…"]},
}
const ONSET := ["cold", "fever", "chest", "flux", "pox", "measles", "gout", "stroke"]
const GRAVE := ["chest", "pox", "stroke", "childbed", "plague"]
const DOCK := {
	"barber": {"n": "Цирюльник из города", "sub": "цирюльник", "cost": 4, "wage": 1, "med": [3, 5], "cap": 9, "days": [1, 2], "tr": "bleed", "age": [28, 50],
		"names": [["Цирюльник Ульрих", 0], ["Цирюльник Йост", 0], ["Цирюльник Мартин", 0]], "d": "Бреет, рвёт зубы и пускает кровь — от всего. Дёшев; детям и старикам его ланцет опасен."},
	"monk": {"n": "Брат-лекарь из монастыря", "sub": "монастырский лекарь", "cost": 15, "wage": 1, "med": [6, 9], "cap": 12, "days": [2, 4], "tr": "herbs", "age": [38, 62],
		"names": [["Брат Илларион", 0], ["Брат Савва", 0], ["Брат Лука", 0], ["Сестра Хильдегарда", 1]], "d": "Травы монастырского сада, отвары и молитва. Надёжен, но не учён. Вклад монастырю — 15 зол."},
	"salerno": {"n": "Магистр из Салерно", "sub": "магистр медицины из Салерно", "cost": 120, "wage": 4, "med": [12, 15], "cap": 17, "days": [10, 14], "tr": "best", "cul": "R", "age": [32, 56],
		"names": [["Магистр Маттео Платеарий", 0], ["Магистр Роджер Салернский", 0], ["Магистра Трота из Салерно", 1]], "d": "Школа Салерно — лучшая выучка христианского мира: пульс, диета, покой, травы к месту."},
	"cordoba": {"n": "Учёный лекарь из Кордовы", "sub": "учёный лекарь из Кордовы", "cost": 160, "wage": 5, "med": [15, 18], "cap": 20, "days": [16, 22], "tr": "best", "iso": 1, "cul": "R", "age": [36, 60],
		"names": [["Лекарь Исаак из Кордовы", 0], ["Учёный Юсуф из Кордовы", 0]], "d": "Читал «Канон» Авиценны: знает, что хворь прилипчива, и сам отделяет заразных. Лучший — и самый дорогой."},
}
const TRT := {
	"bleed": {"n": "Пустить кровь", "d": "С кровью, верят лекари, уходят дурные соки. Взрослым жар спадает на день раньше; детям и старикам — опасно."},
	"herbs": {"n": "Травы и отвары", "d": "Ромашка, шалфей, ивовая кора от жара: болезнь проходит на день быстрее, риск чуть ниже."},
	"rest": {"n": "Покой, тепло и бульон", "d": "Лежать в тепле и не вставать: болезнь тянется на день дольше, зато риск заметно ниже."},
}
## экран двора виден (SCREEN === 'court' && !G.visit): только тогда всплывают строки и придворные отзываются
static var court_vis := false
## король лежит в покоях (HEAL.on с o.from === 'ill', hurt.js): двор ставит, пока идёт сцена лечения болезни
static var heal_ill := false
## без смертей от болезней (SICK.noDeath — для проверок)
static var no_death := false
## придворный поправился при виде короля (sickRecover): двор скажет реплику (тратит генератор, как в HTML)
static var recover_hook: Callable
## придворный занемог при виде короля (sickStart): двор отправит его к постели (curT, hold, wander — заново)
static var start_hook: Callable
## король в постели: подпись сцены лечения (sickCap) и её конец, если король умер (sickDie → healEnd(true))
static var cap_hook: Callable
static var die_hook: Callable
## при дворе меняется лекарь (courtPopulate) — двору пересобрать людей
static var doc_rev := 0

static func ageCls(c: Dictionary) -> int:
	return 0 if c.age < 14 else (1 if c.age < 55 else 2)

static func sCap(s: String) -> String:
	return s.left(1).to_upper() + s.substr(1) if s != "" else s

static func lowFirst(t: String) -> String:
	return t.left(1).to_lower() + t.substr(1)

static func whoName(c: Dictionary) -> String:
	var G := Sim.G
	var k: Dictionary = SimPlayer.kingC()
	var s: Variant = SimCourt.seatOf(c)
	var fem := JS.t(c.get("fem"))
	if c.id == k.id:
		return ("королева " if fem else "король ") + String(c.name)
	if s != null:
		return lowFirst(SimDyn.seatName(s)) + " " + String(c.name)
	if c.id == k.get("spouse"):
		return ("супруг королевы " if JS.t(k.get("fem")) else "королева ") + String(c.name)
	if JS.t(c.get("dowager")):
		return "вдовствующая королева " + String(c.name)
	if JS.t(c.get("blood")) or (k.get("kids", []) as Array).has(c.id):
		return ("принцесса " if fem else "принц ") + String(c.name)
	if (G.court.get("wards", []) as Array).has(c.id):
		return ("воспитанница " if fem else "воспитанник ") + String(c.name)
	return String(c.name)

static func sickWord(c: Dictionary) -> String:
	var I: Variant = c.get("ill")
	return ("больна: " if JS.t(c.get("fem")) else "болен: ") + String(DIS[I.k].n) if JS.t(I) else ""

static func sickTag(c: Variant) -> String:
	return " · " + sickWord(c) if c != null and JS.t(c.alive) and JS.t(c.get("ill")) else ""

static func healOrd() -> bool:
	var o: Variant = Sim.G.court.get("orders", {}).get("magister")
	return JS.t(o) and o.k == "heal"

# ---------- лекарь ----------
static func docMk(kind: String) -> Dictionary:
	var G := Sim.G
	var C: Dictionary = G.court
	var K: Dictionary = DOCK[kind]
	var nm: Array = Sim.R.pick(K.names)
	C.docN = JS.n(C.get("docN")) + 1
	var age := Sim.R.i(K.age[0], K.age[1])
	var med := Sim.R.i(K.med[0], K.med[1])
	return {"i": 600 + C.docN, "kind": kind, "name": nm[0], "fem": float(nm[1]), "age": age, "med": med, "xp": 0.0, "d0": G.day,
		"camp": float(JS.o(C.doc.get("camp"), 0.0)) if JS.t(C.get("doc")) else 0.0, "unpaid": 0.0}

static func docEnsure() -> void:
	var C: Variant = Sim.G.get("court")
	if C != null and not JS.t(C.get("doc")) and not JS.t(C.get("docQ")) and not JS.t(C.get("docInit")):
		C.docInit = 1.0
		C.doc = docMk("monk")
		C.doc.name = "Брат Илларион"
		C.doc.fem = 0.0
		C.doc.med = 7.0
		C.doc.age = 52.0

## для ран короля (hurt.js)
static func docK() -> float:
	return JS.clp(docM(SimPlayer.kingC()), 0.75, 1.3)

static func durK(c: Dictionary) -> float:
	var d: Variant = docFor(c)
	return JS.clp(1.12 - 0.012 * d.med, 0.88, 1.1) if d != null else 1.15

static func docMethod(c: Dictionary, I: Dictionary) -> String:
	var d: Variant = docFor(c)
	if d == null:
		return "rest"
	var t: String = DOCK[d.kind].tr
	if t != "best":
		return t
	return "rest" if JS.t(I.bed) and float(DIS[I.k].m[ageCls(c)]) != 0.0 else "herbs"

static func trtDur(k: String, t: String) -> float:
	match t:
		"bleed":
			return -1.0 if k == "fever" or k == "chest" else 0.0
		"herbs":
			return -1.0 if k == "cold" or k == "fever" or k == "flux" else 0.0
		"rest":
			return 1.0
	return 0.0

static func trtM(c: Dictionary, I: Dictionary, t := "") -> float:
	if t == "":
		t = I.tr
	var cls := ageCls(c)
	var m := 1.0
	match t:
		"bleed":
			m = 0.97 if cls == 1 else 1.3
		"herbs":
			m = 0.92
		"rest":
			m = 0.85 if JS.t(I.bed) else 0.95
	if JS.t(I.get("th")):
		m *= 0.8 if GRAVE.has(I.k) or I.k == "flux" else 0.95
	return m

static func mortK(c: Dictionary, I: Dictionary, t := "") -> float:
	var G := Sim.G
	var C: Dictionary = G.court
	var m := docM(c) * trtM(c, I, t)
	if c.age < 5:
		m *= 1.3
	if c.age >= 70:
		m *= 1.4
	if isFam(c):
		if SimDyn.hasTech("antidotes"):
			m *= 0.8
		if C.has("hpray") and C.hpray != null and C.hpray >= G.day - Sim.DAYS_SEASON:
			m *= 0.85
	if JS.t(I.get("up")):
		m *= 1.4
	if whereOf(c) == "camp":
		m *= 1.25
	if healOrd() and whereOf(c) == "court":
		m *= 0.9
	if JS.t(I.get("wish")):
		m *= 0.95
	return m

static func sickRisk(c: Dictionary, t := "") -> float:
	var I: Variant = c.get("ill")
	return float(DIS[I.k].m[ageCls(c)]) * mortK(c, I, t) if JS.t(I) and JS.t(I.cr) else 0.0

static func riskWord(p: float) -> String:
	return "не опасно" if p <= 0 else ("почти не опасно" if p < 0.02 else ("опасно" if p < 0.06 else ("очень опасно" if p < 0.15 else "смертельно опасно")))

static func setTrt(c: Dictionary, t: String) -> void:
	var I: Variant = c.get("ill")
	if not JS.t(I):
		return
	var nd := trtDur(I.k, t)
	I.end = maxf(Sim.G.day + 1, I.end - JS.n(I.get("trd")) + nd)
	I.trd = nd
	I.tr = t
	if JS.t(I.cr) and I.cr >= I.end:
		I.cr = I.end - 1

static func docXp(c: Dictionary) -> void:
	var d: Variant = docFor(c)
	if d == null:
		return
	d.xp = JS.n(d.get("xp")) + 1
	if fmod(d.xp, 8.0) == 0.0 and d.med < float(DOCK[d.kind].cap):
		d.med += 1
		Sim.glog("Лекарь " + String(d.name) + " набирается опыта: искусство " + JS.s(d.med) + ".", "info")

# ---------- заболеть, кризис, поправиться ----------
static func sickStart(c: Variant, k: String, why := "") -> Variant:
	var G := Sim.G
	if c == null or not JS.t(c.alive) or not DIS.has(k):
		return null
	var I0: Variant = c.get("ill")
	if JS.t(I0) and not (I0.k == "cold" and k != "cold"):
		return null
	c.ill = null
	var D: Dictionary = DIS[k]
	var cls := ageCls(c)
	var d: Variant = docFor(c)
	var king: Dictionary = SimPlayer.kingC()
	var dur := maxf(2, JS.rnd(Sim.R.i(D.dur[0], D.dur[1]) * durK(c)))
	var bed := 1.0 if Sim.R.chance(D.bed[cls]) else 0.0
	var I := {"k": k, "d0": G.day, "end": G.day + dur, "cr": 0.0, "bed": bed, "tr": "rest", "trd": 0.0, "iso": 0.0, "why": why}
	if float(D.m[cls]) > 0:
		I.cr = G.day + (1.0 if D.has("cr0") else maxf(1, JS.rnd(dur * Sim.R.range(0.35, 0.6))))
	if k == "gout":
		c.goutN = JS.n(c.get("goutN")) + 1
	c.ill = I
	setTrt(c, docMethod(c, I))
	if d != null and DOCK[d.kind].has("iso") and D.has("ct"):
		I.iso = 1.0
	var nm := sCap(whoName(c))
	var vis := court_vis
	var C: Dictionary = G.court
	var f := JS.t(c.get("fem"))
	if c.id == king.id:
		var t := ("Король занемог в походе: " + String(D.n) + ". " + ("Лекарь " + String(d.name) + " при нём." if d != null else "Лекаря в лагере нет.")) if whereOf(c) == "camp" \
			else ("Подагра! Нога распухла — ходить больно." if k == "gout" else ("Король простудился. Пару дней — без охоты и меча." if k == "cold" else "Король занемог: " + String(D.n) + "."))
		Sim.glog(t, "bad" if JS.t(I.bed) else "info")
		SimPlayer.toast(t)
	else:
		var t := nm + ((": удар! " + ("Её" if f else "Его") + " уложили в постель.") if k == "stroke" else ((" занемогла: " if f else " занемог: ") + String(D.n) + (" (" + why + ")" if why != "" else "") + "." + (" Лежит в постели." if JS.t(I.bed) else "")))
		Sim.glog(t, "bad" if isFam(c) and JS.t(I.bed) else "info")
		if vis and (isFam(c) or JS.t(I.bed)):
			SimPlayer.toast(t)
		if not JS.t(C.get("sickHint")) and vis:
			C.sickHint = 1.0
			SimPlayer.toast("Лекарь двора обходит больных; днём он в библиотеке или у грядок с травами. С ним можно выбрать лечение.")
	if vis and start_hook.is_valid():
		start_hook.call(c)
	return I

static func sickProgress(c: Dictionary) -> void:
	var G := Sim.G
	var I: Dictionary = c.ill
	var D: Dictionary = DIS[I.k]
	var cls := ageCls(c)
	var k: Dictionary = SimPlayer.kingC()
	var inBed: bool = c.id == k.id and heal_ill
	if I.k == "cold" and G.day == I.d0 + 2 and Sim.R.chance(float(D.cx[cls]) * docM(c) * (1.5 if JS.t(I.get("up")) else 1.0)):
		c.ill = null
		sickStart(c, "chest", "простуда спустилась в грудь")
		return
	if inBed and JS.t(I.cr) and I.cr == G.day + 1:
		sickCap("Жар растёт. " + docName() + " не отходит от постели, капеллан молится у изголовья.")
	if JS.t(I.cr) and G.day >= I.cr:
		I.cr = 0.0
		var p := float(D.m[cls]) * mortK(c, I)
		if not no_death and Sim.R.chance(p):
			sickDie(c)
			return
		if I.k == "stroke":
			strokeMark(c)
		if inBed:
			sickCap("Кризис миновал. " + docName() + ": «Теперь — на поправку, государь».")
		elif c.id != k.id and JS.t(I.bed) and float(D.m[cls]) >= 0.03:
			Sim.glog(sCap(whoName(c)) + ": кризис миновал.", "info")
	if G.day >= I.end:
		sickRecover(c)

## подпись у постели короля (sickCap): двор покажет её и запомнит на этот день сцены
static func sickCap(t: String) -> void:
	if cap_hook.is_valid():
		cap_hook.call(t)

## кто лечит короля (docName): лекарь двора, если он рядом, иначе — просто «Лекарь»
static func docName() -> String:
	var d: Variant = Sim.G.court.get("doc")
	return String(d.name) if JS.t(d) and docFor(SimPlayer.kingC()) != null else "Лекарь"

static func strokeMark(c: Dictionary) -> void:
	var st: String = Sim.R.pick(["mar", "dip", "lrn"])
	var v := Sim.R.i(1, 3)
	c[st] = maxf(1, float(JS.o(c.get(st), 5.0)) - v)
	Sim.glog(sCap(whoName(c)) + " пережил" + ("а" if JS.t(c.get("fem")) else "") + " удар, но " + ("рука ослабела" if st == "mar" else ("речь стала невнятной" if st == "dip" else "память подводит")) \
		+ " (" + String(Sim.T.SKN[st]) + " −" + JS.s(v) + ").", "bad")

static func sickDie(c: Dictionary) -> void:
	var I: Dictionary = c.ill
	var D: Dictionary = DIS[I.k]
	var k: Dictionary = SimPlayer.kingC()
	var fam := isFam(c) or SimCourt.seatOf(c) != null
	docXp(c)
	if c.id == k.id and heal_ill and die_hook.is_valid():
		die_hook.call()
	c.ill = null
	if fam and court_vis and c.id != k.id:
		SimPlayer.toast("✝ " + sCap(whoName(c)) + " скончал" + ("ась" if JS.t(c.get("fem")) else "ся") + " от " + String(D.g) + ".")
	SimDyn.charDies(c, "от " + String(D.g))

static func sickRecover(c: Dictionary) -> void:
	var G := Sim.G
	var I: Dictionary = c.ill
	var D: Dictionary = DIS[I.k]
	var k: Dictionary = SimPlayer.kingC()
	docXp(c)
	c.ill = null
	if D.has("imm"):
		if not JS.t(c.get("imm")):
			c.imm = {}
		c.imm[I.k] = 1.0
	if c.id == k.id:
		c.sickConv = G.day + (2.0 if JS.t(I.bed) else 1.0)
		if not heal_ill:
			SimPlayer.toast("Король поправился: " + String(D.n) + " позади.")
		Sim.glog("Король поправился: " + String(D.n) + " позади.", "info")
	else:
		if JS.t(I.bed) or isFam(c):
			Sim.glog(sCap(whoName(c)) + " поправил" + ("ась" if JS.t(c.get("fem")) else "ся") + ": " + String(D.n) + " позади.", "info")
		if court_vis and recover_hook.is_valid():
			recover_hook.call(c)

## вероятность заболеть сегодня (k — болезнь, s — сезон)
static func onsetP(c: Dictionary, k: String, s: int) -> float:
	var G := Sim.G
	var D: Dictionary = DIS[k]
	var C: Dictionary = G.court
	var cls := ageCls(c)
	var camp := whereOf(c) == "camp"
	var fd: float = G.day - (C.feastDay if C.has("feastDay") else -99.0)
	if (D.has("kid") and c.age >= 14) or (D.has("min") and c.age < D.min) or (D.has("imm") and JS.t(c.get("imm")) and JS.t(c.imm.get(k))):
		return 0.0
	var p: float = D.p * D.seas[s]
	match k:
		"cold":
			p *= (1.5 if cls == 0 else (1.1 if cls == 2 else 1.0)) * (1.5 if camp and s == 3 else 1.0)
		"chest":
			p *= 1.3 if cls == 0 else (1.8 if cls == 2 else 1.0)
		"flux":
			p *= (1.3 if cls == 0 else 1.0) * (4.0 if camp else (3.0 if fd >= 0 and fd <= 2 else 1.0))
		"fever":
			p *= 2.2 if camp else 1.0
		"gout":
			p *= (0.25 if JS.t(c.get("fem")) else 1.0) * (3.0 if JS.t(c.get("goutN")) else 1.0) * (2.5 if fd >= 0 and fd <= 7 else 1.0)
		"stroke":
			p *= 3.0 if c.age >= 75 else (2.0 if c.age >= 65 else 1.0)
	if isFam(c):
		if SimDyn.hasTech("antidotes"):
			p *= 0.75
		if C.has("hpray") and C.hpray != null and C.hpray >= G.day - Sim.DAYS_SEASON:
			p *= 0.8
	if c.id == G.player.char and c.has("tonic") and c.tonic > G.day:
		p *= 0.75
	if healOrd() and not camp:
		p *= 0.85
	return p

## день болезней (DAILY_EXT): лекарь, мор, заражение, новые хвори
static func sickDaily() -> void:
	var G := Sim.G
	if not G.has("court") or not G.has("chars"):
		return
	var C: Dictionary = G.court
	docEnsure()
	docDaily()
	var s := Sim.seasonOf(G.day)
	var P := sickPeople()
	var pl: Variant = C.get("plague")
	if JS.t(pl) and G.day >= pl.end:
		C.plague = null
		Sim.glog("Моровое поветрие отступило.", "good")
	elif not JS.t(pl) and G.day > 120 and Sim.R.chance(1.0 / (Sim.DAYS_YEAR * 45)):
		C.plague = {"d0": G.day, "end": G.day + Sim.R.i(28, 48), "shut": 0.0}
		Sim.glog("В королевстве моровое поветрие! Лекарь советует затворить ворота замка.", "bad")
		SimPlayer.toast("Моровое поветрие в королевстве!")
		Sim.sfx("bell")
	for c in P:
		var q: Variant = c.get("illQ")
		if JS.t(q) and G.day >= q.day:
			c.illQ = null
			if not JS.t(c.get("ill")):
				sickStart(c, q.k, q.why)
	for c in P:
		if JS.t(c.alive) and JS.t(c.get("ill")):
			sickProgress(c)
			if JS.t(G.get("over")):
				return
	var nw: Array = []
	for a in P:
		var I: Variant = a.get("ill")
		if not JS.t(I) or not JS.t(a.alive) or G.day <= I.d0:
			continue
		var D: Dictionary = DIS[I.k]
		if not D.has("ct"):
			continue
		var wa := whereOf(a)
		for b in P:
			var bi: Variant = b.get("ill")
			if is_same(b, a) or (JS.t(bi) and (bi.k != "cold" or I.k == "cold")) or JS.t(b.get("illQ")) or not JS.t(b.alive) or whereOf(b) != wa:
				continue
			if (D.has("kid") and b.age >= 14) or (D.has("imm") and JS.t(b.get("imm")) and JS.t(b.imm.get(I.k))):
				continue
			var p: float = D.ct * (0.15 if JS.t(I.iso) else 1.0) * (1.6 if kin(a, b) else 1.0) * (0.7 if healOrd() and wa == "court" else 1.0) * (0.6 if JS.t(C.get("plague")) and JS.t(C.plague.shut) else 1.0)
			if Sim.R.chance(p):
				nw.append([b, I.k, a])
	for e in nw:
		var b: Dictionary = e[0]
		sickStart(b, e[1], "заразил" + ("ась" if JS.t(b.get("fem")) else "ся") + " от: " + whoName(e[2]))
	for c in P:
		var ci: Variant = c.get("ill")
		if (JS.t(ci) and ci.k != "cold") or not JS.t(c.alive):
			continue
		if JS.t(C.get("plague")) and Sim.R.chance(0.004 * (0.35 if JS.t(C.plague.shut) and whereOf(c) == "court" else 1.0)):
			sickStart(c, "plague", "")
			continue
		for k in ONSET:
			if JS.t(c.get("ill")) and k == "cold":
				continue
			var p := onsetP(c, k, s)
			if p != 0.0 and Sim.R.chance(p):
				sickStart(c, k, "после простуды" if JS.t(c.get("ill")) else "")
				break
	if fmod(G.day, 7.0) == 3.0:
		for c in G.chars:
			var ci: Variant = c.get("ill")
			if JS.t(ci) and (not JS.t(c.alive) or G.day > ci.end + 1) and not P.any(func(x): return is_same(x, c)):
				c.ill = null

## лекарь: прибытие нового, старость, жалованье по неделям
static func docDaily() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var d: Variant = C.get("doc")
	var r: Dictionary = G.realms[0]
	var Q: Variant = C.get("docQ")
	if JS.t(Q) and G.day >= Q.day:
		var old: Variant = C.get("doc")
		var nd := docMk(Q.kind)
		C.docQ = null
		var who := ("а " if JS.t(nd.fem) else " ") + String(nd.name) + " (" + String(DOCK[nd.kind].sub) + ")."
		if JS.t(old):
			Sim.glog(String(old.name) + " покидает двор. На смену прибыл" + who, "info")
		else:
			Sim.glog("Ко двору прибыл" + who, "good")
		C.doc = nd
		if court_vis:
			SimPlayer.toast("Прибыл" + ("а " if JS.t(nd.fem) else " ") + "новый лекарь: " + String(nd.name) + ".")
		doc_rev += 1
		return
	if not JS.t(d):
		return
	if Sim.dayOfYear(G.day) == 0 and G.day > 0:
		d.age += 1
		if d.age >= 68 and Sim.R.chance(0.25):
			Sim.glog(String(d.name) + ": «Стар я стал, государь». Лекарь уходит на покой; монастырь пришлёт брата.", "info")
			C.doc = null
			C.docQ = {"kind": "monk", "day": G.day + Sim.R.i(3, 6)}
			doc_rev += 1
			return
	if fmod(G.day, 7.0) == 1.0:
		var w: float = DOCK[d.kind].wage
		if r.gold >= w:
			r.gold -= w
			d.unpaid = 0.0
		else:
			d.unpaid = JS.n(d.get("unpaid")) + 1
			if d.unpaid >= 3:
				Sim.glog(String(d.name) + " ушёл: три недели без жалованья. Монастырь пришлёт брата из милости.", "bad")
				C.doc = null
				C.docQ = {"kind": "monk", "day": G.day + 7}
				doc_rev += 1

# ---------- совет (sick2.js): больной советник работает вполсилы, из постели — никак ----------
static func ordersDaily() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var mod: Array = []
	for s in Sim.SEATS:
		var o: Variant = C.orders.get(s.k)
		var c: Variant = SimDyn.seatChar(s.k)
		if not JS.t(o) or c == null or not JS.t(c.get("ill")) or not JS.t(c.alive):
			continue
		var f := 0.0 if JS.t(c.ill.bed) else 0.5
		if not o.has("eff"):
			o.eff = SimCourt.orderEff(c, s.k, o.mode)
		mod.append([o, o.eff])
		o.eff *= f
		o.day0 += 1 - f
	SimCourt.ordersDaily()
	for e in mod:
		e[0].eff = e[1]

static func courtSick() -> Array:
	return sickPeople().filter(func(c): return JS.t(c.get("ill")) and whereOf(c) == "court")
