class_name SimBirds
## Пташки Ока (birds.js): невидимые агенты Ока короля сами следят за советом и за всеми, кто ищет места при дворе.
## Что они узнают — по порядку: главный навык, все навыки, нрав, верность и честь, тайный мотив, тайны; скорость и точность —
## от Тени Ока, без Ока никто не следит. У придворных — скрытые мотивы (понемногу двигают верность); изредка проситель — шпион.
## Обёртки birds.js (orderEff, treasurerDaily, appointSeat, dismissSeat, прошение «young», judgeResolve, candidatesFor) — в SimCourt.

const SKL := ["mar", "dip", "intr", "stew", "lrn"]
const BIRD_LV := ["первое впечатление", "главный навык", "все навыки", "нрав", "верность и честь", "тайный мотив", "тайны"]
## сколько наблюдения нужно на каждую следующую ступень (Око с Тенью ≈ 8 даёт ≈1 в день)
const BIRD_NEED := [0.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0]
const MOTIVES := {
	"crown": {"n": "Верность короне", "d": "служит из верности — на такого можно положиться"},
	"gold": {"n": "Золото", "d": "служит ради золота: щедрость его держит, бедность толкает к воровству"},
	"power": {"n": "Власть", "d": "жаждет места в совете — без него озлобится"},
	"glory": {"n": "Слава", "d": "ищет славы: в войну он счастлив, в долгий мир скучает"},
	"lore": {"n": "Знание", "d": "живёт книгами — магистром работал бы с жаром"},
	"house": {"n": "Свой дом", "d": "служит прежде всего своему дому: верен, пока верен его дом"},
	"revenge": {"n": "Месть", "d": "затаил обиду на корону — опасен"},
	"faith": {"n": "Вера", "d": "набожен: молитвы и милосердие короля ему по сердцу"},
	"foe": {"n": "Чужой хозяин", "d": "тайно служит чужой державе"},
}
## что проситель места говорит о себе (по заявленному навыку)
const SKC := {"mar": "Я владею мечом и знаю, как водить людей в бой.", "dip": "Я умею говорить с людьми — и с послами тоже.",
	"intr": "Я умею слушать и примечать то, что другие прячут.", "stew": "Я умею считать деньги и вести хозяйство.", "lrn": "Я знаю грамоту, право и латынь."}

# семья короля (famIds) — как в JS, запоминается на день и число людей
static var _fg: Variant = null
static var _fd := -1.0
static var _fn := -1
static var _fs := {}

static func famIds() -> Dictionary:
	var G := Sim.G
	if not is_same(_fg, G) or _fd != G.day or _fn != G.chars.size():
		var k: Dictionary = SimPlayer.kingC()
		var s := {float(k.id): true}
		if SimDyn.ge0(k.get("spouse")):
			s[float(k.spouse)] = true
		for x in k.get("kids", []):
			s[float(x)] = true
		if G.has("court"):
			for x in G.court.get("royals", []):
				s[float(x)] = true
		_fg = G
		_fd = G.day
		_fn = G.chars.size()
		_fs = s
	return _fs

static func birdsOf() -> Dictionary:
	var C: Dictionary = Sim.G.court
	if not JS.t(C.get("birds")):
		C.birds = {}
	return C.birds

static func birdBase(c: Dictionary) -> float:
	if c.role == "council" or SimCourt.seatOf(c) != null:
		return 3.0
	if c.role == "lord":
		return 2.0
	return 1.0 if c.role == "knight" or c.role == "courtier" or c.role == "scholar" else 0.0

static func birdRec(c: Dictionary) -> Dictionary:
	var B := birdsOf()
	var key := JS.s(c.id)
	var r: Variant = B.get(key)
	if not JS.t(r):
		var lv := birdBase(c)
		r = {"lv": lv, "p": 0.0, "err": 0.0 if lv >= 3 else (1.0 if lv == 2 else 2.0), "d0": Sim.G.day}
		JS.oset(B, key, r)
	return r

## своих (семью короля) знают и так
static func birdFull(c: Dictionary) -> bool:
	return not Sim.G.has("court") or famIds().has(float(c.id))

## скрытый мотив: постоянный для человека (шум без генератора игры)
static func motiveOf(c: Dictionary) -> Dictionary:
	if JS.t(c.get("motive")):
		return c.motive
	var tr: Array = c.traits
	var W := {
		"crown": 1.0 + (1.5 if float(JS.o(c.get("hon"), 50.0)) >= 70 else 0.0) + (1.0 if tr.has("honest") else 0.0),
		"gold": 0.6 + (3.0 if tr.has("greedy") else 0.0),
		"power": 0.5 + (1.5 if tr.has("proud") else 0.0) + (2.0 if float(JS.o(c.get("amb"), 50.0)) > 65 else 0.0),
		"glory": 0.4 + (1.5 if tr.has("brave") else 0.0) + (1.0 if tr.has("reckless") else 0.0) + (0.6 if JS.n(c.get("mar")) >= 12 else 0.0),
		"lore": 0.3 + (2.0 if JS.n(c.get("lrn")) >= 12 else 0.0),
		"house": 1.2 if SimDyn.ge0(c.get("house")) else 0.0,
		"revenge": (1.2 if float(JS.o(c.get("loy"), 60.0)) < 35 else 0.15) + (0.4 if tr.has("wrathful") else 0.0),
		"faith": 0.6}
	var s := 0.0
	for k in W:
		s += W[k]
	var r := Sim.hf(c.id, 77) * s
	var m := "crown"
	for k in W:
		r -= W[k]
		if r <= 0:
			m = k
			break
	c.motive = {"k": m}
	if m == "lore":
		c.motive.b = floorf(Sim.hf(c.id, 78) * 4)
	return c.motive

## что видит король: точно (своих), оценка пташек (≈) или на глаз (диапазон); {v, s, ex, kn, lo, hi}
static func skSeen(c: Dictionary, k: String) -> Dictionary:
	var v := SimCourt.skillOf(c, k)
	if birdFull(c):
		return {"v": v, "s": JS.s(v), "ex": 1.0, "kn": 2.0}
	var r := birdRec(c)
	var i := SKL.find(k)
	if r.lv >= 2 or (r.lv >= 1 and k == SimCourt.bestSkill(c)):
		var e := JS.n(r.get("err"))
		var x := JS.clp(v + JS.rnd((Sim.hf(c.id, 20 + i) - 0.5) * 2 * e), 1, 20)
		return {"v": x, "s": ("≈" if e != 0.0 else "") + JS.s(x), "ex": 1.0 if e == 0.0 else 0.0, "kn": 1.0}
	var foe: bool = JS.t(c.get("motive")) and c.motive.k == "foe"
	var m := JS.clp(v + JS.rnd((Sim.hf(c.id, 10 + i) - 0.5) * 6) + ((5.0 if foe else 2.0) if c.get("claim") == k else 0.0), 1, 20)
	var lo := JS.clp(m - 3, 1, 20)
	var hi := JS.clp(m + 3, 1, 20)
	return {"v": m, "lo": lo, "hi": hi, "s": JS.s(lo) + "–" + JS.s(hi), "kn": 0.0}

static func traitsSeen(c: Dictionary) -> Dictionary:
	var n: Array = (c.traits as Array).map(func(t): return String(Sim.T.TRAITS[t].n) if Sim.T.TRAITS.has(t) else String(t))
	if birdFull(c) or birdRec(c).lv >= 3:
		return {"s": ", ".join(n), "all": 1}
	return {"s": (String(n[0]) if not n.is_empty() else "") + (", …" if n.size() > 1 else ""), "all": 0}

static func motiveSeen(c: Dictionary) -> Variant:
	if birdFull(c) or birdRec(c).lv < 5:
		return null
	var m := motiveOf(c)
	if m.k == "foe" and not spyKnown(c):
		return MOTIVES[String(JS.o(m.get("cover"), "gold"))]
	return MOTIVES[m.k]

static func spySecret(c: Dictionary) -> Variant:
	for s in Sim.G.court.secrets:
		if s.k == "spy" and s.who[0] == c.id:
			return s
	return null

static func spyKnown(c: Dictionary) -> bool:
	var s: Variant = spySecret(c)
	return s != null and JS.t(s.known)

static func isHiddenSpy(c: Variant) -> bool:
	if c == null or not Sim.G.has("court"):
		return false
	var s: Variant = spySecret(c)
	return s != null and not JS.t(s.known)

# ---------- за кем следят: сначала новые лица, потом совет, потом главы домов ----------
static func birdTargets() -> Array:
	var G := Sim.G
	var e: Variant = SimDyn.seatChar("eye")
	var fam := famIds()
	var L: Array = []
	for c in G.chars:
		if not JS.t(c.alive) or c.realm != 0.0 or JS.n(c.get("prison", -1.0)) >= 0 or c.age < 16 or fam.has(float(c.id)) or (e != null and c.id == e.id):
			continue
		var on := SimCourt.seatOf(c) != null
		var cand: bool = JS.t(c.get("atCourt")) and (c.role == "courtier" or c.role == "knight" or c.role == "scholar" or c.role == "council")
		var lord: bool = c.role == "lord"
		if not on and not cand and not lord:
			continue
		var r := birdRec(c)
		if r.lv >= 6 and not on:
			continue
		L.append({"c": c, "r": r, "pr": (9.0 if r.lv >= 6 else float(r.lv)) - (0.5 if on else 0.0) + (1.5 if lord and not on else 0.0) - (3.0 if JS.t(r.get("nw")) and r.lv < 3 else 0.0),
			"k": 0.5 if lord and not on else 1.0})
	return JS.sort(L, func(a, b): return a.pr - b.pr)

static func birdWidth(e: Dictionary) -> int:
	return 3 + int(floorf(SimCourt.skillOf(e, "intr") / 5))

static func birdRate(e: Dictionary, n: float) -> float:
	var C: Dictionary = Sim.G.court
	var oe: Variant = C.orders.get("eye")
	return (0.5 + SimCourt.skillOf(e, "intr") / 10) * (1.4 if JS.t(oe) and oe.k == "protect" else 1.0) * (1.1 if SimDyn.hasTech("ciphers") else 1.0) / sqrt(maxf(1, n))

## день пташек (DAILY_EXT): мотивы, затем — кто под присмотром и что о нём узнали
static func birdsDaily() -> void:
	var G := Sim.G
	if not G.has("court"):
		return
	var C: Dictionary = G.court
	motivesDaily()
	var e: Variant = SimDyn.seatChar("eye")
	if e == null:
		C.birdOn = []
		return
	var T := birdTargets()
	var L := T.slice(0, birdWidth(e))
	C.birdOn = L.map(func(t): return t.c.id)
	C.birdAll = float(T.size())
	if L.is_empty():
		return
	var rt := birdRate(e, L.size())
	var loud := 0
	for t in L:
		var r: Dictionary = t.r
		r.p = JS.n(r.get("p")) + rt * t.k
		if r.lv >= 6:
			if r.p >= 12:
				r.p = 0.0
				birdRecheck(t.c, r, e)
			continue
		var need: float = BIRD_NEED[int(r.lv) + 1]
		if r.p >= need:
			r.p = 0.0
			if birdStep(t.c, r, e, loud):
				loud += 1

static func birdSay(t: String, loud: bool) -> void:
	SimCourt.addReport("eye", "Пташки: " + t, not loud)

static func _nz(c: Dictionary, b: float, v: Variant, e4: float) -> float:
	return JS.clp(JS.rnd(float(JS.o(v, 50.0)) + (Sim.hf(c.id, b + fmod(Sim.G.day, 97.0)) - 0.5) * 2 * e4), 0, 100)

static func birdStep(c: Dictionary, r: Dictionary, e: Dictionary, loudN: int) -> bool:
	var G := Sim.G
	var nx: float = r.lv + 1
	var intr := SimCourt.skillOf(e, "intr")
	var nm := String(c.name)
	var C: Dictionary = G.court
	var loud := false
	if r.lv < 2:
		r.err = JS.clp(JS.rnd((21 - intr) / 5), 0, 4)
	if nx == 6:
		var S: Array = (C.secrets as Array).filter(func(s): return not JS.t(s.known) and (s.who as Array).has(c.id))
		if not S.is_empty():
			if not Sim.R.chance(JS.clp(0.45 + intr / 40, 0.45, 0.95)):
				r.p = BIRD_NEED[6] * 0.5
				birdSay(nm + " — что-то тут нечисто, но пока не поймали за руку.", false)
				return false
			r.lv = 6.0
			for s in S:
				s.known = 1.0
				s.how = "пташки Ока"
				SimDyn.letterFromSeat("eye", "Тайное донесение", SimCourt.secretText(s) + (" Прикажете схватить? (Малый совет → «Кандидаты»)" if s.k == "spy" else ""))
			Sim.sfx("chime")
			Sim.glog("Око короля: пташки раскрыли тайну — " + SimCourt.secretText(S[0]), "warn")
			return true
		r.lv = 6.0
		birdSay(nm + ": ничего дурного пташки не нашли.", false)
		return false
	r.lv = nx
	if nx == 1:
		var k := SimCourt.bestSkill(c)
		birdSay(nm + " сильнее всего в «" + String(Sim.T.SKN[k]) + "»: " + String(skSeen(c, k).s) + ".", false)
	elif nx == 2:
		var cl: Variant = c.get("claim")
		var boast := false
		if JS.t(cl):
			var foe: bool = JS.t(c.get("motive")) and c.motive.k == "foe"
			boast = skSeen(c, cl).v + 3 < JS.clp(SimCourt.skillOf(c, cl) + JS.rnd((Sim.hf(c.id, 10 + SKL.find(cl)) - 0.5) * 6) + (5.0 if foe else 2.0), 1, 20)
		var parts: Array = SKL.map(func(k): return String(Sim.T.SKN[k]) + " " + String(skSeen(c, k).s))
		birdSay(nm + ": " + ", ".join(parts) + "." + (" Хвалился он зря." if boast else ""), false)
	elif nx == 3:
		birdSay(nm + " — " + String(traitsSeen(c).s).to_lower() + ".", false)
	elif nx == 4:
		var e4: float = r.err * 4 + 2
		var key := JS.s(c.id)
		var K0: Variant = C.known.get(key)
		if not JS.t(K0) or K0.err >= e4 or G.day - K0.day > 30:
			JS.oset(C.known, key, {"loy": _nz(c, 40, c.get("loy"), e4), "amb": _nz(c, 41, c.get("amb"), e4), "hon": _nz(c, 42, c.get("hon"), e4), "err": e4, "day": G.day, "how": "пташки"})
		var K: Dictionary = C.known[key]
		loud = loudN < 1 and (K.loy < 35 or K.hon < 35)
		birdSay(nm + ": верность ≈" + JS.s(K.loy) + ", честолюбие ≈" + JS.s(K.amb) + ", честность ≈" + JS.s(K.hon) + " (±" + JS.s(K.err) + ").", loud)
	elif nx == 5:
		var m: Variant = motiveSeen(c)
		var k: String = motiveOf(c).k
		loud = loudN < 1 and (k == "revenge" or k == "power")
		birdSay(nm + " " + String(m.d) + ".", loud)
	return loud

## советников пташки проверяют и дальше: свежие верность и честь, иногда — тайна
static func birdRecheck(c: Dictionary, r: Dictionary, e: Dictionary) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var intr := SimCourt.skillOf(e, "intr")
	var e4: float = r.err * 4 + 2
	JS.oset(C.known, JS.s(c.id), {"loy": _nz(c, 40, c.get("loy"), e4), "amb": _nz(c, 41, c.get("amb"), e4), "hon": _nz(c, 42, c.get("hon"), e4), "err": e4, "day": G.day, "how": "пташки"})
	var S: Array = (C.secrets as Array).filter(func(s): return not JS.t(s.known) and (s.who as Array).has(c.id))
	if not S.is_empty() and Sim.R.chance(JS.clp(0.35 + intr / 40, 0.35, 0.9)):
		for s in S:
			s.known = 1.0
			s.how = "пташки Ока"
			SimDyn.letterFromSeat("eye", "Тайное донесение", SimCourt.secretText(s))
		Sim.glog("Око короля: пташки раскрыли тайну — " + SimCourt.secretText(S[0]), "warn")

# ---------- скрытые мотивы день за днём ----------
static func motivesDaily() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var war := not SimDay.warsOf(0).is_empty()
	var fam := famIds()
	for c in G.chars:
		if not JS.t(c.alive) or c.realm != 0.0 or c.age < 16 or JS.n(c.get("prison", -1.0)) >= 0 or fam.has(float(c.id)):
			continue
		var on := SimCourt.seatOf(c) != null
		if not (JS.t(c.get("atCourt")) or on or c.role == "lord" or c.role == "knight"):
			continue
		var m := motiveOf(c)
		var d := 0.0
		var loy := float(JS.o(c.get("loy"), 50.0))
		match String(m.k):
			"crown":
				d = 0.02 if loy < 80 else 0.0
			"power":
				d = 0.01 if on else (-0.03 if JS.t(c.get("atCourt")) else 0.0)
			"glory":
				d = 0.03 if war else -0.005
			"house":
				if SimDyn.ge0(c.get("house")) and int(c.house) < G.houses.size():
					d = (G.houses[int(c.house)].loy - loy) * 0.01
			"revenge":
				d = -0.02
			"faith":
				d = 0.02 if float(JS.o(C.get("prayDay"), -99.0)) > G.day - 7 else 0.0
			"gold":
				d = -0.02 if G.realms[0].gold < 100 else 0.0
		if d != 0.0:
			c.loy = JS.clp(loy + d, 5.0 if m.k == "revenge" else (40.0 if m.k == "glory" else 0.0), 60.0 if m.k == "revenge" else 100.0)
		if m.k == "revenge" and c.has("loy") and c.loy < 30 and SimDyn.ge0(c.get("house")) and int(c.house) < G.houses.size() and Sim.R.chance(0.003):
			var foes: Array = JS.sort([1, 2, 3, 4].filter(func(t): return SimDay.alive(t)), func(a, b): return SimDay.opinionOf(a, 0) - SimDay.opinionOf(b, 0))
			if not foes.is_empty():
				SimCourt.addSecret("plot", [c.id], {"house": c.house, "realm": float(foes[0])})
	# шпион при дворе раз в сезон выдаёт наших осведомителей за границей
	if fmod(G.day, Sim.DAYS_SEASON) == 11.0:
		for s in C.secrets:
			if s.k != "spy" or JS.t(s.known) or not SimDyn.ge0(s.who[0]):
				continue
			var c: Variant = Sim.charOf(s.who[0])
			if c == null or not JS.t(c.alive) or JS.n(c.get("prison", -1.0)) >= 0:
				continue
			var key := JS.s(s.realm)
			if JS.n(C.net.get(key)) > 0:
				C.net[key] = C.net[key] - 1
				if SimDyn.seatChar("eye") != null:
					SimCourt.addReport("eye", "В державе " + Sim.realmName(s.realm) + " схватили наших осведомителей: сеть теперь " + JS.s(C.net[key]) + " из 3. Кто-то их выдал — боюсь, этот кто-то при нашем дворе.")

# ---------- проситель места: первое впечатление, а изредка — шпион ----------
static func impLine(c: Dictionary) -> String:
	return " · ".join(SKL.map(func(k): return String(Sim.T.SKN[k]) + " " + String(skSeen(c, k).s)))

static func natureLine(c: Dictionary) -> String:
	var t := traitsSeen(c)
	if JS.t(t.all):
		return String(t.s).to_lower()
	var tr: Array = c.traits
	if not tr.is_empty() and Sim.T.TRAITS.has(tr[0]):
		return String(Sim.T.TRAITS[tr[0]].n).to_lower() + ", а дальше не разглядеть"
	return "не разглядеть"

## Око хмурится? (раз на прошение — тратит генератор игры)
static func eyeSus(p: Dictionary) -> float:
	if not p.has("sus"):
		var e: Variant = SimDyn.seatChar("eye")
		if e == null:
			p.sus = 0.0
		elif JS.t(p.get("spy")):
			p.sus = 1.0 if Sim.R.chance(JS.clp(SimCourt.skillOf(e, "intr") / 22, 0.15, 0.8)) else 0.0
		else:
			p.sus = 1.0 if Sim.R.chance(0.06) else 0.0
	return p.sus

## подсказка к «Принять ко двору»: строки (строка или {t, c})
static func impTip(c: Dictionary, p: Dictionary) -> Array:
	var L: Array = ["Первое впечатление", "На глаз: " + impLine(c) + ".", "Нрав: " + natureLine(c) + "."]
	if JS.t(eyeSus(p)):
		L.append({"t": "Око короля хмурится: «Не верю я ему, государь».", "c": "warn"})
	L.append({"t": "Примете ко двору — пташки Ока присмотрятся к нему." if SimDyn.seatChar("eye") != null else "Без Ока короля никто к нему не присмотрится.", "c": "dim"})
	return L

# ---------- Малый совет → «Кандидаты»: все, кто мог бы сесть за стол, — как их знает король ----------
static func candAll(f: String) -> Array:
	var G := Sim.G
	var fam := famIds()
	return (G.chars as Array).filter(func(c):
		if not (JS.t(c.alive) and JS.n(c.get("prison", -1.0)) < 0 and c.realm == 0.0 and c.age >= 16 and not fam.has(float(c.id)) \
			and (c.role == "courtier" or c.role == "council" or c.role == "knight" or c.role == "lord" or c.role == "scholar") \
			and (JS.t(c.get("atCourt")) or c.role == "lord" or SimCourt.seatOf(c) != null)):
			return false
		var st := SimCourt.seatOf(c) != null
		match f:
			"council":
				return st
			"court":
				return JS.t(c.get("atCourt")) and not st
			"lords":
				return c.role == "lord" and not st
		return true)

static func candRank(c: Dictionary) -> int:
	return 0 if SimCourt.seatOf(c) != null else (1 if JS.t(c.get("atCourt")) else 2)

static func birdErr(e: Variant) -> float:
	return JS.clp(JS.rnd((21 - SimCourt.skillOf(e, "intr")) / 5), 0, 4) if e != null else 0.0

static func birdTip(e: Variant) -> Array:
	var L: Array = ["Пташки Ока", "Невидимые агенты Ока короля сами следят за советниками и за всеми, кто ищет места при дворе.",
		"Сведения приходят по порядку: главный навык → все навыки → нрав → верность и честь → тайный мотив → тайны."]
	if e != null:
		L.append({"t": "Око " + String(e.name) + " (Тень " + JS.s(SimCourt.skillOf(e, "intr")) + ") держит под присмотром до " + str(birdWidth(e)) + " человек разом; точность оценок ±" + JS.s(birdErr(e)) + ". Чем выше Тень, тем быстрее и точнее.", "c": "info"})
	else:
		L.append({"t": "Ока короля нет — никто не следит.", "c": "bad"})
	L.append({"t": "Поручение «Охранять двор» ускоряет пташек; досье даёт верность и честь сразу.", "c": "dim"})
	return L
