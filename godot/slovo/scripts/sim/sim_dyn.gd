class_name SimDyn
## Двор и знатные дома — перенос dynasty.js (newGame3: корона, шесть домов, королевская семья, малый совет, придворные,
## рыцари короны, свита короля), а также мест совета (council.js), писем (audience.js) и наук (research.js), что нужны ей.

static func houseName(id: Variant) -> String:
	var G := Sim.G
	if G.has("houses") and id != null and id >= 0 and id < G.houses.size():
		return G.houses[int(id)].name
	return "—"

static func mkHouseMember(h: Variant, fem: float, age: float, o: Dictionary = {}) -> Dictionary:
	var G := Sim.G
	var H0: Dictionary = G.houses[int(h)] if typeof(h) != TYPE_DICTIONARY else h
	var rng: JS.Rng = o.rng if o.get("rng") != null else Sim.R
	var given: Variant = o.given if JS.t(o.get("given")) else Sim.pickName("K", fem, rng)
	var name: Variant = o.full if JS.t(o.get("full")) else String(given) + " " + String(H0.name)
	var title: Variant
	if o.has("title") and o.title != null:
		title = o.title
	else:
		title = ("Леди" if fem != 0.0 else "Лорд") if age >= 16 else ""
	var role: String = o.role if JS.t(o.get("role")) else ("child" if age < 16 else "courtier")
	var oc := {"name": name, "fem": 1.0 if fem != 0.0 else 0.0, "age": age, "title": title}
	if o.get("st") != null:
		Sim.assign(oc, o.st)
	var c := Sim.mkChar(0, "K", role, rng, oc)
	c.house = H0.id
	c.atCourt = 1.0 if JS.t(o.get("atCourt")) else 0.0
	if age < 16:
		for k in ["mar", "dip", "intr", "stew", "lrn"]:
			c[k] = maxf(1.0, JS.rnd(c[k] * 0.6))
	return c

## newGame3(seed, opt): мир и державы (newGame), затем корона, дома, двор и совет
static func newGame3(seed: int, opt: Dictionary = {}) -> Dictionary:
	var t0 := Time.get_ticks_msec()
	Sim.newGame(seed, opt)
	var G := Sim.G
	var W := Sim.W
	var rng := JS.Rng.new((seed ^ 0x5eed3) & 0xFFFFFFFF)
	G.v = 3.0
	G.log = []
	G._resv = ["Освальд", "Рейнард", "Гарет", "Сибилла", "Конрад", "Освин", "Бертран", "Розамунда", "Хьюго", "Седрик", "Тибальт", "Изольда", "Эдмунд", "Беатрис", "Тристан"]
	var king: Dictionary = Sim.charOf(G.player.char)
	Sim.assign(king, {"lrn": 8.0, "loy": 100.0, "hon": 82.0, "amb": 50.0, "house": -1.0, "kids": [], "atCourt": 1.0, "spouse": -1.0})
	G.houses = []
	for i in Sim.HOUSES.size():
		var d: Dictionary = Sim.HOUSES[i]
		G.houses.append({"id": float(i), "name": d.name, "motto": d.motto, "her": (d.her as Dictionary).duplicate(), "d": d.d, "loy": d.loy, "amb": d.amb, "str": d.str, "alive": 1.0, "defiant": 0.0, "head": -1.0, "fief": -1.0})
	var cap: float = G.realms[0].capital
	var capW: Dictionary = W.setts[int(cap)]
	var seats: Array = JS.sort(G.setts.filter(func(S): return S.owner == 0.0 and S.id != cap and W.setts[int(S.id)].type != "village"), func(a, b): return b.pop - a.pop)
	var vill: Array = JS.sort(G.setts.filter(func(S): return S.owner == 0.0 and W.setts[int(S.id)].type == "village"), func(a, b): return b.pop - a.pop)
	var fiefs: Array = seats + vill
	for i in G.houses.size():
		var H0: Dictionary = G.houses[i]
		var S: Variant = fiefs[i] if i < fiefs.size() else null
		var age := rng.i(42, 63)
		var mar := rng.i(6, 14)
		var head := mkHouseMember(H0, 1.0 if i == 3 else 0.0, age, {"role": "lord", "rng": rng, "st": {"mar": mar, "loy": H0.loy, "amb": H0.amb}})
		H0.head = head.id
		if S != null:
			H0.fief = S.id
			S.house = H0.id
			S.lord = head.id
	# королевская семья
	var q := mkHouseMember(2, 1, 30, {"given": "Изольда", "full": "Изольда", "role": "consort", "title": "Королева", "atCourt": 1, "rng": rng,
		"st": {"dip": 12.0, "intr": 9.0, "stew": 8.0, "lrn": 10.0, "mar": 4.0, "loy": 80.0, "hon": 76.0, "amb": 34.0, "traits": ["generous", "patient"]}})
	q.aff = 70.0
	king.spouse = q.id
	q.spouse = king.id
	var heir := Sim.mkChar(0, "K", "heir", rng, {"name": "Эдмунд", "fem": 0.0, "age": 11.0, "title": "Принц", "mar": 6.0, "dip": 7.0, "intr": 4.0, "stew": 4.0, "lrn": 6.0, "loy": 90.0, "hon": 70.0, "amb": 55.0, "traits": ["brave", "proud"]})
	var prin := Sim.mkChar(0, "K", "child", rng, {"name": "Беатрис", "fem": 1.0, "age": 7.0, "title": "Принцесса", "mar": 2.0, "dip": 6.0, "intr": 7.0, "stew": 3.0, "lrn": 5.0, "loy": 95.0, "hon": 60.0, "amb": 40.0, "traits": ["cunning", "generous"]})
	for c in [heir, prin]:
		c.house = -1.0
		c.atCourt = 1.0
		c.blood = 1.0
		c.parents = [king.id, q.id]
		c.aff = 70.0
	king.kids = [heir.id, prin.id]
	q.kids = [heir.id, prin.id]
	var ward := mkHouseMember(1, 0, 12, {"given": "Тристан", "role": "child", "title": "", "atCourt": 1, "rng": rng, "st": {"traits": ["proud", "cautious"]}})
	ward.ward = 1.0
	ward.happy = 0.0
	# малый совет (кресло верховного судьи пустует: старый судья умер этой зимой)
	var S7 := func(h: int, fem: float, given: String, age: float, st: Dictionary) -> Dictionary:
		return mkHouseMember(h, fem, age, {"given": given, "role": "council", "atCourt": 1, "rng": rng, "st": st})
	var seat := {}
	seat.chancellor = S7.call(0, 0.0, "Освальд", 52.0, {"dip": 14.0, "intr": 9.0, "stew": 9.0, "mar": 6.0, "lrn": 10.0, "loy": 72.0, "hon": 70.0, "amb": 44.0, "traits": ["wise", "proud"]})
	seat.treasurer = S7.call(4, 0.0, "Рейнард", 47.0, {"stew": 13.0, "dip": 8.0, "intr": 11.0, "lrn": 9.0, "mar": 4.0, "loy": 56.0, "hon": 26.0, "amb": 66.0, "traits": ["greedy", "cunning"]})
	seat.marshal = S7.call(5, 0.0, "Гарет", 44.0, {"mar": 14.0, "dip": 6.0, "stew": 7.0, "lrn": 5.0, "intr": 6.0, "loy": 66.0, "hon": 66.0, "amb": 50.0, "traits": ["brave", "wrathful"]})
	seat.eye = S7.call(3, 1.0, "Сибилла", 38.0, {"intr": 14.0, "dip": 10.0, "stew": 7.0, "lrn": 9.0, "mar": 3.0, "loy": 62.0, "hon": 48.0, "amb": 58.0, "traits": ["cunning", "cautious"]})
	seat.seneschal = S7.call(2, 0.0, "Конрад", 50.0, {"stew": 11.0, "dip": 9.0, "mar": 5.0, "intr": 6.0, "lrn": 7.0, "loy": 72.0, "hon": 84.0, "amb": 30.0, "traits": ["honest", "patient"]})
	seat.magister = Sim.mkChar(0, "K", "council", rng, {"name": "Освин", "title": "Магистр", "fem": 0.0, "age": 63.0, "lrn": 15.0, "dip": 7.0, "intr": 7.0, "stew": 6.0, "mar": 2.0, "loy": 74.0, "hon": 80.0, "amb": 20.0, "traits": ["wise", "patient"]})
	seat.magister.house = -1.0
	seat.magister.atCourt = 1.0
	# придворные: кандидаты на должности
	mkHouseMember(0, 0, 33, {"given": "Бертран", "atCourt": 1, "rng": rng, "st": {"lrn": 13.0, "dip": 9.0, "stew": 8.0, "intr": 5.0, "mar": 6.0, "loy": 68.0, "hon": 80.0, "amb": 40.0, "traits": ["honest", "cautious"]}})
	mkHouseMember(1, 1, 26, {"given": "Розамунда", "atCourt": 1, "rng": rng, "st": {"intr": 12.0, "dip": 11.0, "lrn": 8.0, "stew": 6.0, "mar": 4.0, "loy": 38.0, "hon": 40.0, "amb": 82.0, "traits": ["cunning", "proud"]}})
	mkHouseMember(4, 0, 29, {"given": "Хьюго", "atCourt": 1, "rng": rng, "st": {"stew": 12.0, "lrn": 10.0, "dip": 7.0, "intr": 5.0, "mar": 5.0, "loy": 64.0, "hon": 84.0, "amb": 36.0, "traits": ["honest", "patient"]}})
	mkHouseMember(5, 0, 24, {"given": "Седрик", "role": "knight", "title": "Сэр", "atCourt": 1, "rng": rng, "st": {"mar": 11.0, "dip": 5.0, "stew": 4.0, "lrn": 4.0, "intr": 4.0, "loy": 70.0, "hon": 70.0, "amb": 60.0, "traits": ["brave", "reckless"]}})
	var sch := Sim.mkChar(0, "K", "scholar", rng, {"name": "Тибальт", "title": "Брат", "fem": 0.0, "age": 45.0, "lrn": 12.0, "dip": 6.0, "intr": 6.0, "stew": 9.0, "mar": 2.0, "loy": 66.0, "hon": 74.0, "amb": 22.0, "traits": ["patient", "honest"]})
	sch.house = -1.0
	sch.atCourt = 1.0
	# рыцари во главе войск короны (воеводы v2)
	var gens: Array = G.chars.filter(func(c): return c.realm == 0.0 and c.role == "general")
	var kh := [5.0, 1.0, 3.0]
	for i in gens.size():
		var c: Dictionary = gens[i]
		c.role = "knight"
		c.title = "Сэр"
		c.house = kh[i % 3]
		c.name = String(Sim.pickName("K", 0.0, rng)) + " " + houseName(c.house)
		c.fem = 0.0
		c.atCourt = 0.0
	if gens.size() > 0:
		gens[0].traits = ["cautious", "patient"]
		gens[0].mar = 13.0
	if gens.size() > 1:
		gens[1].traits = ["reckless", "brave"]
		gens[1].mar = 11.0
	var pa: Dictionary = Sim.playerArmy()
	pa.kind = "lord"
	pa.gen = gens[0].id if gens.size() > 0 else -1.0
	pa.ai = {"task": "idle", "t": 0.0}
	pa.cmd = {"o": "hold", "mode": "intent", "t": cap, "day": 0.0}
	for t in Sim.UT:
		pa.xp[t] = 15.0
	# пограничное войско: в своей крепости, ближайшей к северянам
	var fw: Dictionary = W.setts[int(G.realms[1].capital)]
	var dist := func(S: Dictionary) -> float:
		var w: Dictionary = W.setts[int(S.id)]
		return JSM.hypot(w.x - fw.x, w.y - fw.y)
	var bSl: Array = JS.sort(seats.duplicate(), func(a, b): return dist.call(a) - dist.call(b))
	var bS: Variant = bSl[0] if bSl.size() > 0 else null
	if bS != null and gens.size() > 1:
		var w: Dictionary = W.setts[int(bS.id)]
		var b := Sim.mkArmy(0, "lord", gens[1].id, w.x, w.y, {"levy": 50.0, "spear": 40.0, "sword": 10.0, "archer": 30.0, "horse": 15.0})
		Sim.assign(b, {"food": 1100.0, "fodder": 120.0, "water": 4.0, "arrows": 900.0, "weap": 20.0, "horses": 2.0, "wagons": 3.0})
		b.ai = {"task": "idle", "t": 0.0}
		b.cmd = {"o": "hold", "mode": "intent", "t": bS.id, "day": 0.0}
	# свита короля: живёт при дворе (не на карте), пока король не выедет
	var ret := Sim.mkArmy(0, "player", king.id, capW.x, capW.y, {"sword": 10.0, "knight": 6.0, "horse": 6.0, "archer": 8.0})
	Sim.assign(ret, {"food": 340.0, "fodder": 80.0, "water": 4.0, "arrows": 300.0, "weap": 10.0, "horses": 2.0, "wagons": 1.0, "morale": 70.0})
	G.armies = G.armies.filter(func(a): return not is_same(a, ret))
	G.player.army = ret.id
	G.court = {"seats": {}, "orders": {}, "hidden": 0.0, "susp": 0.0, "reports": [], "letters": [], "secrets": [], "grain": 6000.0, "wards": [ward.id], "regent": -1.0, "prestige": 0.0,
		"net": {"1": 0.0, "2": 1.0, "3": 0.0, "4": 0.0}, "known": {}, "guard": 0.0, "incK": 1.0, "taxK": 1.0, "retinue": ret, "meetDay": -1.0, "meetDone": -1.0, "musters": [], "royals": [], "view": 0.0}
	for s in Sim.SEATS:
		G.court.seats[s.k] = -1.0
	for k in seat:
		G.court.seats[k] = seat[k].id
		seat[k].seat = String(k)
	G.tech = {"done": {}, "cur": null, "prog": 0.0, "bank": 4.0}
	G.couriers = []
	G.atCourt = 1.0
	for c in G.chars:
		if c.realm == 0.0 and not c.has("loy"):
			c.loy = 60.0
	Sim.glog("Год 1. Король " + String(king.name) + " правит из замка в столице " + String(capW.name) + ". Королевством правят словом — через верных людей.", "title")
	letterFromSeat("chancellor", "Добро пожаловать домой, государь", welcomeText(), {"arr": 0.02, "dyn": "welcome"})
	G.erase("_resv")
	Sim.ms.ng3 = Time.get_ticks_msec() - t0
	return G

## приветствие канцлера читается, когда паж принесёт письмо: о том, как обстоят дела в этот час
static func welcomeText() -> String:
	var C: Variant = Sim.G.get("court")
	var j: Variant = seatChar("justice")
	var met: bool = C != null and C.meetDone >= 0
	return "Ваше величество, с возвращением! " + ("Все места в малом совете заняты: кресло верховного судьи, пустовавшее с зимы, занял " + String(j.name) + "." if j != null else "Все места в малом совете заняты, кроме одного: старый верховный судья скончался этой зимой, его кресло пустует — назначьте судью в окне совета (K).") \
		+ (" Совет при вас уже заседал; впредь он собирается раз в неделю — по четвергам в 9:30." if met else " Малый совет собирается раз в неделю — по четвергам в 9:30; при нужде его можно созвать и срочно.") \
		+ " Просители ждут у трона по утрам. Дом Блэкторн ропщет: их сын Тристан живёт у нас воспитанником, а сами они всё чаще поминают старые обиды."

# ---------- совет (council.js) ----------
static func seatName(k: String) -> String:
	for s in Sim.SEATS:
		if s.k == k:
			return s.n
	return k

static func seatChar(k: String) -> Variant:
	var G := Sim.G
	if not G.has("court"):
		return null
	var id: Variant = G.court.seats.get(k)
	var c: Variant = Sim.charOf(id) if id != null and id >= 0 else null
	return c if c != null and JS.t(c.alive) and c.prison < 0 else null

# ---------- письма (audience.js) ----------
static func kingPos() -> Array:
	var G := Sim.G
	var pa: Variant = Sim.playerArmy()
	if JS.t(G.get("atCourt")) or pa == null:
		var ws: Dictionary = Sim.W.setts[int(G.realms[0].capital)]
		return [ws.x + 0.5, ws.y + 0.5]
	return [pa.x, pa.y]

static func courierSpeed() -> float:
	return 22.0 * (1.6 if hasTech("posts") else 1.0)

static func addLetter(o: Dictionary) -> Dictionary:
	var G := Sim.G
	var C: Dictionary = G.court
	C.nextL = JS.n(C.get("nextL")) + 1
	o.id = C.nextL
	o.day = G.day
	if not o.has("arr"):
		var d := 0.0
		if o.has("x"):
			var kp := kingPos()
			d = JSM.hypot(kp[0] - o.x, kp[1] - o.y) / courierSpeed()
			if JS.t(o.get("pigeon")) and hasTech("pigeons"):
				d = minf(d, 0.5)
		o.arr = G.day + G.frac + d
	o.read = 0.0
	C.letters.push_front(o)
	if C.letters.size() > 60:
		C.letters.pop_back()
	return o

static func letterFromSeat(k: String, subj: String, text: String, o: Dictionary = {}) -> Dictionary:
	var c: Variant = seatChar(k)
	var ws: Dictionary = Sim.W.setts[int(Sim.G.realms[0].capital)]
	var l := {"from": seatName(k) + (" " + String(c.name) if c != null else ""), "fc": c.id if c != null else -1.0, "subj": subj, "text": text, "x": float(ws.x), "y": float(ws.y), "pigeon": 1.0}
	return addLetter(Sim.assign(l, o))

# ---------- науки (research.js) ----------
static func hasTech(k: String) -> bool:
	var G := Sim.G
	return G.has("tech") and JS.t(G.tech.get("done")) and JS.t(G.tech.done.get(k))

static func projDone(k: String) -> bool:
	var G := Sim.G
	if not G.has("court") or not JS.t(G.court.get("proj")):
		return false
	var P: Dictionary = G.court.proj
	var e: Variant = P.done.get(k) if JS.t(P.get("done")) else null
	if not JS.t(e):
		return false
	var PK: Dictionary = Sim.T.get("PROJK", {})
	return e.king == G.player.char if PK.has(k) and JS.t(PK[k].get("per")) else true

## techIncK с надбавкой reign.js (цехи и векселя)
static func techIncK() -> float:
	return 1.0 + (0.05 if projDone("mint") else 0.0) + (0.08 if hasTech("rotation") else 0.0) + (0.04 if hasTech("ledgers") else 0.0) + (0.06 if hasTech("mills") else 0.0) + (0.06 if hasTech("townhalls") else 0.0) \
		+ (0.06 if hasTech("guilds") else 0.0) + (0.08 if hasTech("banks") else 0.0)

# ---------- королевская семья (dynasty.js) ----------
## рождение при открытом экране: диалог «Как назовёте?» — (текст, имена, mk(имя)); без экрана (проверка без окна) дитя ждёт имени,
## как в HTML, пока на вопрос не ответили
static var birth_hook: Callable
## реплика над головой человека при дворе: (ключ npc, текст) — «У нас будет ребёнок!»; слово двора о смерти короля: (null, текст)
static var say_hook: Callable
## двор пересаживает людей (courtPopulate): смерть, рождение, новый год, воспитанник
static var pop_rev := 0
## окно эпилога правления (UI.alert('reign')): летопись ушедшего короля и наследник
static var reign_hook: Callable

static func ge0(v: Variant) -> bool:
	return v != null and (v is float or v is int) and v >= 0

static func houseOf(c: Variant) -> Variant:
	var G := Sim.G
	if not (c is Dictionary) or not ge0(c.get("house")) or not G.has("houses"):
		return null
	return G.houses[int(c.house)] if int(c.house) < G.houses.size() else null

static func houseMembers(id: float) -> Array:
	return Sim.G.chars.filter(func(c): return JS.t(c.alive) and c.get("house") == id and c.realm == 0.0)

static func royalFamily() -> Array:
	var G := Sim.G
	var k: Dictionary = SimPlayer.kingC()
	var ids: Array = []
	var src: Array = []
	if ge0(k.get("spouse")):
		src.append(k.spouse)
	src.append_array(k.get("kids", []))
	if G.has("court"):
		src.append_array(G.court.get("royals", []))
	for x in src:
		if not ids.has(x):
			ids.append(x)
	ids.erase(k.id)
	var out: Array = []
	for x in ids:
		var c: Variant = Sim.charOf(x)
		if c != null and JS.t(c.alive) and not JS.t(c.get("away")) and not JS.t(c.get("ward")):
			out.append(c)
	return out

static func heirOf(k: Variant = null) -> Variant:
	var G := Sim.G
	if k == null:
		k = SimPlayer.kingC()
	var L: Array = []
	for x in k.get("kids", []):
		var c: Variant = Sim.charOf(x)
		if c != null and JS.t(c.alive) and not JS.t(c.get("away")):
			L.append(c)
	if L.is_empty() and G.has("court"):
		for x in G.court.get("royals", []):
			var c: Variant = Sim.charOf(x)
			if c != null and JS.t(c.alive) and not JS.t(c.get("away")) and not JS.t(c.get("dowager")) and c.id != k.get("spouse") and JS.t(c.get("blood")):
				L.append(c)
	JS.sort(L, func(a, b):
		var df: float = JS.n(a.get("fem")) - JS.n(b.get("fem"))
		return df if df != 0.0 else b.age - a.age)
	return L[0] if not L.is_empty() else null

static func updateRoles() -> void:
	var k: Dictionary = SimPlayer.kingC()
	var h: Variant = heirOf(k)
	for c in royalFamily():
		if c.id == k.get("spouse") or JS.t(c.get("dowager")):
			continue
		var nr := "heir" if h != null and c.id == h.id else ("courtier" if c.age >= 16 else "child")
		if c.role != nr:
			c.role = nr

static func famRole(c: Variant) -> String:
	var k: Dictionary = SimPlayer.kingC()
	if c == null:
		return ""
	if c.id == k.get("spouse"):
		return "Супруг королевы" if JS.t(k.get("fem")) else "Королева"
	if JS.t(c.get("dowager")):
		return "Вдовствующая королева"
	var h: Variant = heirOf(k)
	var fem := JS.t(c.get("fem"))
	if h != null and h.id == c.id:
		return ("Наследница" if fem else "Наследник") + " престола · " + JS.s(c.age) + " " + Sim.plural(c.age, "год", "года", "лет")
	if c.age < 16:
		return ("Принцесса" if fem else "Принц") + " · " + JS.s(c.age) + " " + Sim.plural(c.age, "год", "года", "лет")
	return "Принцесса" if fem else "Принц"

# ---------- день династии: рождения, смерти, годы, дома ----------
static func dynastyDaily() -> void:
	var G := Sim.G
	if not JS.t(G.get("houses")) or JS.t(G.get("over")):
		return
	var C: Dictionary = G.court
	var king: Dictionary = SimPlayer.kingC()
	if Sim.dayOfYear(G.day) == 0.0 and G.day > 0:
		yearTick()
	pregnancyTick(king)
	if fmod(G.day, 7.0) == 5.0:
		housesWeekly()
	var M: Array = C.get("musters", [])
	for m in M.duplicate():
		if m.day <= G.day:
			for i in M.size():
				if is_same(M[i], m):
					M.remove_at(i)
					break
			spawnMuster(m)

## смерть за год: по возрасту; кровь короля бережётся (противоядия — вдвое), молитва о здравии — ещё на пятую часть; с лекарем
## при дворе (sick.js) — меньше
static func deathChance(c: Dictionary) -> float:
	var G := Sim.G
	var a: float = c.age
	var p := 0.02 if a < 5 else (0.004 if a < 40 else (0.012 if a < 55 else (0.045 if a < 65 else (0.12 if a < 75 else 0.26))))
	var royal: bool = JS.t(c.get("blood")) or c.role == "ruler" or c.role == "consort"
	if royal:
		p *= 0.5 if hasTech("antidotes") else 0.8
	if royal and G.has("court") and G.court.get("hpray") != null and G.court.hpray >= G.day - Sim.DAYS_SEASON:
		p *= 0.8
	return p * (0.45 if c.age < 55 else 0.7) if c.age >= 3 and SimSick.sickCircle(c) else p

static func yearTick() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var king: Dictionary = SimPlayer.kingC()
	for c in G.chars:
		if JS.t(c.alive) and not JS.t(c.get("pseudo")):
			c.age += 1
	Sim.glog("Новый год " + JS.s(Sim.yearOf(G.day)) + ". Королю " + String(king.name) + " — " + JS.s(king.age) + " " + Sim.plural(king.age, "год", "года", "лет") + ".", "season")
	for c in G.chars.duplicate():
		if not JS.t(c.alive) or c.realm != 0.0 or JS.t(c.get("pseudo")) or c.prison >= 0:
			continue
		if Sim.R.chance(deathChance(c)):
			charDies(c, "старость" if c.age >= 55 else "хворь")
		if JS.t(G.get("over")):
			return
	for c in G.chars:
		if JS.t(c.alive) and c.realm == 0.0 and c.age == 16 and not JS.t(c.get("adult")):
			comeOfAge(c)
	var k2: Dictionary = SimPlayer.kingC()
	if C.regent >= 0 and k2.age >= 16:
		var r: Variant = Sim.charOf(C.regent)
		C.regent = -1.0
		Sim.glog("Король " + String(k2.name) + " достиг совершеннолетия. Регентство " + (String(r.name) + " " if r != null else "") + "окончено — теперь король правит сам.", "title")
		SimCourt.prestige(4)
	updateRoles()
	pop_rev += 1

## charDies с обёрткой reign.js (смерть родных — в летопись)
static func charDies(c: Dictionary, why: String) -> void:
	if not JS.t(c.alive):
		return
	c.deathWhy = why
	var k0: Dictionary = SimPlayer.kingC()
	var fam0: bool = c.id != k0.id and (c.id == k0.get("spouse") or (k0.get("kids", []) as Array).has(c.id) or JS.t(c.get("dowager")))
	if fam0:
		SimArmy.chron("✝ " + Sim.charName(c) + " — " + why + ".", "cross", "death", 2)
	_charDies(c, why)

static func _charDies(c: Dictionary, why: String) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var king: Dictionary = SimPlayer.kingC()
	if not JS.t(c.alive):
		return
	c.alive = 0.0
	c.deathDay = G.day
	var k: Variant = SimCourt.seatOf(c)
	if k != null:
		C.seats[k] = -1.0
		C.orders[k] = null
		SimCourt.seats_rev += 1
	var a: Variant = SimPlayer.armyOfGen(c.id)
	if a != null:
		var nk: Variant = SimPlayer.spareKnight()
		a.gen = nk.id if nk != null else SimPlayer.mkKnight().id
	var H0: Variant = houseOf(c)
	if H0 != null and H0.head == c.id:
		newHead(H0)
	var wi: int = (C.wards as Array).find(c.id)
	if wi >= 0:
		C.wards.remove_at(wi)
		if H0 != null:
			SimPlayer.houseLoy(H0, -20)
	if c.id == C.regent:
		C.regent = -1.0
		if king.age < 16:
			pickRegent()
	var fam: bool = c.id == king.id or c.id == king.get("spouse") or (king.get("kids", []) as Array).has(c.id) or JS.t(c.get("dowager"))
	var nm := Sim.charName(c)
	Sim.glog(("✝ " if fam else "") + nm + " скончал" + ("ась" if JS.t(c.get("fem")) else "ся") + " (" + why + ")." + (" Место «" + seatName(k) + "» пустует." if k != null else ""), "bad" if fam else "info")
	if fam:
		Sim.sfx("bell")
	if c.id == king.id:
		kingDied(c)
		return
	if c.id == king.get("spouse"):
		king.spouse = -1.0
		king.widow = G.day
	for x in G.chars:
		if x.get("betrothed") == c.id:
			x.betrothed = -1.0
	updateRoles()
	pop_rev += 1

static func newHead(H0: Dictionary) -> void:
	var G := Sim.G
	var L: Array = houseMembers(H0.id).filter(func(c): return c.age >= 16 and c.id != H0.head and not JS.t(c.get("seat")) and c.role != "consort")
	JS.sort(L, func(a, b): return b.age - a.age)
	var h: Dictionary = L[0] if not L.is_empty() else mkHouseMember(H0, 0, Sim.R.i(26, 48), {"role": "lord"})
	h.role = "knight" if h.role == "knight" else "lord"
	H0.head = h.id
	H0.loy = JS.rnd((H0.loy + 50) / 2)
	if H0.fief >= 0:
		G.setts[int(H0.fief)].lord = h.id
	Sim.glog("Новый глава дома " + String(H0.name) + " — " + Sim.charName(h) + ".", "info")

static func pickRegent() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var king: Dictionary = SimPlayer.kingC()
	var r: Variant = null
	for x in king.get("parents", []):
		var c: Variant = Sim.charOf(x)
		if c != null and JS.t(c.alive) and JS.t(c.get("fem")):
			r = c
			break
	if r == null:
		r = seatChar("chancellor")
	if r == null:
		var L: Array = []
		for h in G.houses:
			if JS.t(h.alive):
				var c: Variant = Sim.charOf(h.head)
				if c != null:
					L.append(c)
		JS.sort(L, func(a, b): return b.loy - a.loy)
		r = L[0] if not L.is_empty() else null
	if r != null:
		C.regent = r.id
		Sim.glog("Регентом до совершеннолетия короля стал" + ("а " if JS.t(r.get("fem")) else " ") + Sim.charName(r) + ".", "title")

## kingDied с обёрткой reign.js: глава летописи закрывается, наследник начинает свою — с заветом отца
static func kingDied(k: Dictionary) -> void:
	var G := Sim.G
	var R0: Variant = SimArmy.reignInit()
	var A: Variant = reignArchive(R0, k) if R0 != null else null
	_kingDied(k)
	if A == null:
		return
	if JS.t(G.get("over")):
		G.over.reign = A
		return
	var R1: Variant = SimArmy.reignInit(true)
	R1.goal = reignGoal()
	if reign_hook.is_valid():
		reign_hook.call(A, SimPlayer.kingC().id)
	Sim.sfx("bell")

static func _kingDied(k: Dictionary) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var heir: Variant = heirOf(k)
	C.ancestors = (C.get("ancestors", []) as Array) + [k.id]
	if heir == null:
		G.over = {"win": false, "why": "Король " + String(k.name) + " умер, не оставив наследника. Династия пресеклась, и знатные дома делят корону между собой."}
		return
	var R: Array = []
	for id in (C.get("royals", []) as Array) + (k.get("kids", []) as Array) + ([k.spouse] if ge0(k.get("spouse")) else []):
		if not R.has(id) and id != heir.id:
			R.append(id)
	C.royals = R
	if ge0(k.get("spouse")):
		var w: Variant = Sim.charOf(k.spouse)
		if w != null and JS.t(w.alive):
			w.dowager = 1.0
			w.title = "Королева-мать" if JS.t(w.get("fem")) else "Принц"
			w.spouse = -1.0
	for id in k.get("kids", []):
		var c: Variant = Sim.charOf(id)
		if c != null:
			c.blood = 1.0
	G.player.char = heir.id
	G.realms[0].ruler = heir.id
	heir.role = "ruler"
	heir.title = "Королева" if JS.t(heir.get("fem")) else "Король"
	heir.loy = 100.0
	heir.atCourt = 1.0
	heir.away = 0.0
	if not heir.has("kids") or heir.kids == null:
		heir.kids = []
	heir.seat = null
	if not heir.has("spouse"):
		heir.spouse = -1.0
	for s in Sim.SEATS:
		if C.seats.get(s.k) == heir.id:
			C.seats[s.k] = -1.0
			C.orders[s.k] = null
			SimCourt.seats_rev += 1
	var ga: Variant = SimPlayer.armyOfGen(heir.id)
	if ga != null:
		var nk: Variant = SimPlayer.spareKnight()
		ga.gen = nk.id if nk != null else SimPlayer.mkKnight().id
	for H0 in G.houses:
		SimPlayer.houseLoy(H0, -8 if H0.amb > 60 else -3)
	SimCourt.prestige(-5)
	if heir.age < 16:
		pickRegent()
	Sim.glog("Король умер — да здравствует " + ("королева " if JS.t(heir.get("fem")) else "король ") + String(heir.name) + "!" + (" Ему всего " + JS.s(heir.age) + " " + Sim.plural(heir.age, "год", "года", "лет") + "." if heir.age < 16 else ""), "title")
	# новый государь — при дворе; войско старого короля переходит к рыцарю
	if not JS.t(G.get("atCourt")):
		var pa: Variant = Sim.playerArmy()
		if pa != null:
			SimPlayer.armyToKnight(pa, "return")
		var ws: Dictionary = Sim.W.setts[int(G.realms[0].capital)]
		var ret := Sim.mkArmy(0, "player", heir.id, ws.x, ws.y, {"sword": 8.0, "horse": 8.0, "archer": 6.0})
		Sim.assign(ret, {"food": 300.0, "water": 4.0, "morale": 60.0})
		G.armies = G.armies.filter(func(a): return not is_same(a, ret))
		C.retinue = ret
		G.player.army = ret.id
		G.atCourt = 1.0
		C.view = 0.0
		G.toCourt = 1.0
	elif JS.t(C.get("retinue")):
		C.retinue.gen = heir.id
	updateRoles()
	pop_rev += 1
	if say_hook.is_valid():
		say_hook.call(null, "Колокола звонят по королю " + String(k.name) + ". Двор склоняет головы перед новым государем — " + String(heir.name) + "." + (" До совершеннолетия страной правит регент: " + SimPlayer.regentName() + "." if C.regent >= 0 else ""))

## comeOfAge с обёрткой reign.js (совершеннолетие принца — в летопись)
static func comeOfAge(c: Dictionary) -> void:
	_comeOfAge(c)
	if JS.t(c.get("blood")) and JS.t(c.alive):
		var fem := JS.t(c.get("fem"))
		SimArmy.chron(("Принцесса " if fem else "Принц ") + String(c.name) + " достиг" + ("ла" if fem else "") + " совершеннолетия.", "crown", "age", 1)

static func _comeOfAge(c: Dictionary) -> void:
	var C: Dictionary = Sim.G.court
	c.adult = 1.0
	var H0: Variant = houseOf(c)
	var fem := JS.t(c.get("fem"))
	if JS.t(c.get("ward")):
		var i: int = (C.wards as Array).find(c.id)
		if i >= 0:
			C.wards.remove_at(i)
		c.ward = 0.0
		c.atCourt = 0.0
		c.role = "courtier"
		c.title = "Леди" if fem else "Лорд"
		if H0 != null:
			SimPlayer.houseLoy(H0, 6 + JS.clp(JS.n(c.get("happy")), -5, 8))
		Sim.glog(String(c.name) + " вырос" + ("ла" if fem else "") + " при дворе и вернул" + ("ась" if fem else "ся") + " в дом " + houseName(c.house) + (" — с тёплыми словами о короле." if JS.n(c.get("happy")) > 2 else "."), "info")
		return
	if JS.t(c.get("blood")):
		Sim.glog(("Принцесса " if fem else "Принц ") + String(c.name) + " достиг" + ("ла" if fem else "") + " совершеннолетия.", "good")
		var p: Variant = Sim.charOf(c.betrothed) if ge0(c.get("betrothed")) else null
		if p != null and JS.t(p.alive) and p.age >= 15:
			marry(c, p)

## marry с обёрткой reign.js (свадьба родных — в летопись)
static func marry(c: Dictionary, p: Dictionary) -> void:
	var k: Dictionary = SimPlayer.kingC()
	var fam := func(x: Variant) -> bool: return x != null and (x.id == k.id or JS.t(x.get("blood")))
	_marry(c, p)
	if fam.call(c) or fam.call(p):
		SimArmy.chron("Свадьба: " + String(c.name) + " и " + String(p.name) + ".", "ring", "wed", 2)

static func _marry(c: Dictionary, p: Dictionary) -> void:
	var C: Dictionary = Sim.G.court
	var H0: Variant = houseOf(p)
	c.spouse = p.id
	p.spouse = c.id
	c.betrothed = -1.0
	p.betrothed = -1.0
	var heir: Variant = heirOf()
	if not JS.t(c.get("fem")) or (heir != null and heir.id == c.id):
		p.atCourt = 1.0
		p.role = "courtier"
		C.royals.append(p.id)
		p.blood = 0.0
	else:
		c.away = 1.0
		c.atCourt = 0.0
	if H0 != null:
		SimPlayer.houseLoy(H0, 12)
	SimCourt.prestige(3)
	Sim.glog("Свадьба! " + String(c.name) + " и " + String(p.name) + " обвенчаны. Дом " + houseName(p.get("house")) + " породнился с короной.", "good")
	Sim.sfx("fanfare_small")
	pop_rev += 1

static func betroth(kidId: float, hid: int) -> Variant:
	var G := Sim.G
	var c: Variant = Sim.charOf(kidId)
	var H0: Variant = G.houses[hid] if hid >= 0 and hid < G.houses.size() else null
	if c == null or H0 == null or ge0(c.get("betrothed")):
		return null
	var p := mkHouseMember(H0, 0.0 if JS.t(c.get("fem")) else 1.0, JS.clp(c.age + Sim.R.i(-2, 2), 1, 30), {})
	p.atCourt = 0.0
	c.betrothed = p.id
	p.betrothed = c.id
	SimPlayer.houseLoy(H0, 15)
	for h in G.houses:
		if not is_same(h, H0) and h.amb > 60:
			SimPlayer.houseLoy(h, -3)
	SimCourt.prestige(1)
	Sim.glog("Помолвка: " + String(c.name) + " и " + String(p.name) + " (дом " + String(H0.name) + "). Свадьба — когда " + (("невесте" if JS.t(c.get("fem")) else "жениху") + " исполнится 16." if c.age < 16 else "настанет срок."), "good")
	if c.age >= 16 and p.age >= 15:
		marry(c, p)
	return p

static func takeWard(hid: int) -> Variant:
	var G := Sim.G
	var C: Dictionary = G.court
	var H0: Dictionary = G.houses[hid]
	for w in C.wards:
		var x: Variant = Sim.charOf(w)
		if x != null and x.get("house") == float(hid):
			return null
	var c := mkHouseMember(H0, 1.0 if Sim.R.chance(0.4) else 0.0, Sim.R.i(8, 13), {"role": "child", "title": "", "atCourt": 1})
	c.ward = 1.0
	c.happy = 0.0
	C.wards.append(c.id)
	SimPlayer.houseLoy(H0, 4)
	Sim.glog("Дом " + String(H0.name) + " прислал ко двору воспитанника: " + String(c.name) + ". Пока дитя при дворе, дом дважды подумает, прежде чем бунтовать.", "info")
	pop_rev += 1
	return c

## раз в неделю: верность домов тянется к своей цели (слава, места в совете, воспитанник, родство, честолюбие, земли, регентство,
## налоги, страх войны); дом с низкой верностью и большим честолюбием перестаёт платить подати
static func housesWeekly() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var king: Dictionary = SimPlayer.kingC()
	var fam := royalFamily()
	for H0 in G.houses:
		if not JS.t(H0.alive):
			continue
		var seats := 0
		for s in Sim.SEATS:
			var c: Variant = seatChar(s.k)
			if c != null and c.get("house") == H0.id:
				seats += 1
		var ward := false
		for w in C.wards:
			var x: Variant = Sim.charOf(w)
			if x != null and x.get("house") == H0.id:
				ward = true
				break
		var kin := false
		for c in fam:
			var b: Variant = Sim.charOf(c.betrothed) if ge0(c.get("betrothed")) else null
			var s2: Variant = Sim.charOf(c.spouse) if ge0(c.get("spouse")) else null
			if (b != null and b.get("house") == H0.id) or (s2 != null and s2.get("house") == H0.id):
				kin = true
				break
		if not kin and ge0(king.get("spouse")):
			var q: Variant = Sim.charOf(king.spouse)
			kin = q != null and q.get("house") == H0.id
		var tgt: float = 46 + JS.n(C.get("prestige")) * 0.3 + seats * 7 + (4 if ward else 0) + (12 if kin else 0) - (H0.amb - 50) * 0.4 + (-15 if H0.fief < 0 else 0) + (-6 if C.regent >= 0 else 0) + (4 if C.taxK < 1 else 0)
		if not SimDay.warsOf(0).is_empty() and JS.n(G.realms[0].get("fear")) < 0:
			tgt -= 4
		H0.loy = JS.clp(H0.loy + (JS.clp(tgt, 5, 95) - H0.loy) * 0.05 + Sim.R.range(-1, 1), 0, 100)
		if H0.fief >= 0 and G.setts[int(H0.fief)].owner != 0.0:
			H0.fief = -1.0
			SimPlayer.houseLoy(H0, -15)
			Sim.glog("Дом " + String(H0.name) + " лишился своих земель: их крепость в чужих руках. Лорды винят корону.", "bad")
		# мятеж заметен заранее (первая ступень — неповиновение): податей нет, злые письма
		if not (H0.defiant > G.day) and H0.loy < 18 and H0.amb > 55 and not ward and Sim.R.chance(0.3):
			H0.defiant = G.day + 30
			var h: Variant = Sim.charOf(H0.head)
			Sim.glog("Дом " + String(H0.name) + " перестал присылать подати короне. Говорят, " + (Sim.charName(h) if h != null else "их лорд") + " собирает людей…", "bad")
			letterFromSeat("eye", "Тревога: дом " + String(H0.name), "Государь, дом " + String(H0.name) + " не платит податей и точит мечи. Пока это лишь ропот — но ропот бывает началом мятежа. Подарки, место в совете, помолвка или пир могут вернуть их верность.")
		elif H0.defiant > G.day and H0.loy >= 30:
			H0.defiant = 0.0
			Sim.glog("Дом " + String(H0.name) + " снова платит подати короне.", "good")

static func pregnancyTick(king: Dictionary) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var sp: Variant = Sim.charOf(king.spouse) if ge0(king.get("spouse")) else null
	if sp == null or not JS.t(sp.alive):
		return
	var mom: Dictionary = king if JS.t(king.get("fem")) else sp
	if JS.t(mom.get("preg")):
		if not JS.t(mom.get("pregKnown")) and G.day >= mom.preg - 30:
			mom.pregKnown = 1.0
			Sim.glog(("Королева" if is_same(mom, king) else "Королева " + String(mom.name)) + " ждёт ребёнка! Двор ликует.", "good")
			SimCourt.prestige(2)
			if JS.t(G.get("atCourt")):
				if say_hook.is_valid():
					say_hook.call("spouse", "У нас будет ребёнок!")
			else:
				var ws: Dictionary = Sim.W.setts[int(G.realms[0].capital)]
				addLetter({"from": "Королева " + String(mom.name), "fc": mom.id, "subj": "Добрая весть", "text": "Мой король! Лекари говорят, что к концу сезона у нас будет дитя. Возвращайтесь скорее.", "x": float(ws.x), "y": float(ws.y)})
		if G.day >= mom.preg:
			birth(king, sp, mom)
		return
	var kids := 0
	for x in king.get("kids", []):
		var c: Variant = Sim.charOf(x)
		if c != null and JS.t(c.alive):
			kids += 1
	if mom.age < 44 and kids < 6 and G.day - float(JS.o(mom.get("lastBirth"), -999.0)) > 50:
		var bl: Variant = C.get("bless")
		var p: float = 0.006 + (0.002 if projDone("roses") else 0.0) + (0.05 if C.get("together") == G.day else 0.0) \
			+ (0.006 * float(JS.o(bl.get("m"), 1.0)) if JS.t(bl) and bl.k == "heir" and bl.until >= G.day else 0.0) - (0.0 if JS.t(G.get("atCourt")) else 0.005)
		if Sim.R.chance(maxf(0.0, p)):
			mom.preg = G.day + 40
			mom.pregKnown = 0.0

## birth с обёртками reign.js (рождение — в летопись, если имя дали сразу) и sick.js (родильная горячка)
static func birth(king: Dictionary, sp: Dictionary, mom: Dictionary) -> void:
	var n0: int = (king.get("kids", []) as Array).size()
	_birth(king, sp, mom)
	var L: Array = king.get("kids", [])
	if L.size() > n0:
		var c: Variant = Sim.charOf(L[L.size() - 1])
		if c != null:
			var st := SimArmy.RST()
			st.kids = JS.n(st.get("kids")) + 1
			SimArmy.chron(("Родилась принцесса " if JS.t(c.get("fem")) else "Родился принц ") + String(c.name) + ".", "family", "birth", 2)
	if JS.t(mom.alive) and Sim.R.chance(0.06 * SimSick.docM(mom)):
		mom.illQ = {"k": "childbed", "day": Sim.G.day + Sim.R.i(1, 3), "why": "после родов"}

static func _birth(king: Dictionary, sp: Dictionary, mom: Dictionary) -> void:
	var G := Sim.G
	mom.preg = 0.0
	mom.lastBirth = G.day
	var fem := 1.0 if Sim.R.chance(0.5) else 0.0
	var opts: Array = []
	var k := 0
	while k < 6 and opts.size() < 3:
		var n: Variant = Sim.pickName("K", fem)
		if not opts.has(n):
			opts.append(n)
		k += 1
	var mk := func(name: String) -> Dictionary:
		var c := Sim.mkChar(0, "K", "child", Sim.R, {"name": name, "fem": fem, "age": 0.0, "title": "Принцесса" if fem != 0.0 else "Принц"})
		c.house = -1.0
		c.atCourt = 1.0
		c.blood = 1.0
		c.parents = [king.id, sp.id]
		c.aff = 70.0
		for kk in ["mar", "dip", "intr", "stew", "lrn"]:
			c[kk] = Sim.R.i(2, 8)
		if king.get("kids") == null:
			king.kids = []
		king.kids.append(c.id)
		if sp.get("kids") == null:
			sp.kids = []
		sp.kids.append(c.id)
		updateRoles()
		SimCourt.prestige(3)
		for H0 in G.houses:
			SimPlayer.houseLoy(H0, 1)
		Sim.glog("Родил" + ("ась принцесса " if fem != 0.0 else "ся принц ") + name + "! Колокола звонят по всему королевству.", "good")
		Sim.sfx("fanfare_small")
		pop_rev += 1
		return c
	if birth_hook.is_valid():
		var f := fem != 0.0
		birth_hook.call("Повитуха выходит из покоев королевы: «" + ("Девочка" if f else "Мальчик") + ", государь! Здоров" + ("а" if f else "") + " и голосист" + ("а" if f else "") + "!» Как назовёте " + ("принцессу" if f else "принца") + "?", opts, mk)

# ---------- знамёна домов (command.js: spawnMuster) ----------
static func spawnMuster(m: Dictionary) -> void:
	var G := Sim.G
	var H0: Variant = G.houses[int(m.h)] if int(m.h) < G.houses.size() else null
	if H0 == null or H0.fief < 0:
		return
	var S: Dictionary = G.setts[int(H0.fief)]
	if S.ctrl != 0.0:
		return
	var ws: Dictionary = Sim.W.setts[int(S.id)]
	var kn: Variant = null
	for c in houseMembers(H0.id):
		if c.role == "knight" and c.prison < 0 and SimPlayer.armyOfGen(c.id) == null and not JS.t(c.get("seat")) and not JS.t(c.get("withKing")) and c.age >= 16:
			kn = c
			break
	if kn == null:
		var age := Sim.R.i(20, 40)
		kn = mkHouseMember(H0, 0, age, {"role": "knight", "title": "Сэр", "st": {"mar": Sim.R.i(6, 12)}})
	var a := Sim.mkArmy(0, "lord", kn.id, ws.x, ws.y, m.u)
	Sim.assign(a, {"food": Sim.menOf(m.u) * 8, "fodder": 40.0, "water": 4.0, "arrows": Sim.rangedN(m.u) * 25, "wagons": 2.0, "weap": 5.0})
	a.ai = {"task": "idle", "t": 0.0}
	a.house = H0.id
	var cap: Variant = SimPlayer.capitalArmy()
	a.cmd = {"o": "join", "t": cap.id, "mode": "intent", "day": G.day} if cap != null else {"o": "defend", "t": G.realms[0].capital, "mode": "intent", "day": G.day}
	Sim.glog("Знамёна дома " + String(H0.name) + " подняты: " + SimArmy.voin(Sim.menOf(a.u)) + " (" + Sim.charName(kn) + ") идут " + ("на соединение с войском в столице." if cap != null else "к столице."), "good")

# ---------- летопись правления (reign.js): прозвище, лучшие дела, завет наследнику ----------
static func epithet(R0: Dictionary, k: Variant) -> Dictionary:
	var G := Sim.G
	var s: Dictionary = R0.st
	var f: bool = k != null and JS.t(k.get("fem"))
	var yN := floorf((G.day - R0.from) / Sim.DAYS_YEAR)
	var F := func(m: String, w: String) -> String: return w if f else m
	var L: Array = [[s.took >= 3 and s.took > s.fell, F.call("Завоеватель", "Завоевательница"), "взято крепостей: " + JS.s(s.took)],
		[s.won >= 4 and s.won >= s.lost * 2, F.call("Победоносный", "Победоносная"), "побед: " + JS.s(s.won)],
		[s.fell >= 2 and s.fell > s.took, F.call("Потерявший земли", "Потерявшая земли"), "потеряно крепостей: " + JS.s(s.fell)],
		[s.lost >= 3 and s.lost > s.won, F.call("Несчастливый", "Несчастливая"), "поражений: " + JS.s(s.lost)],
		[s.techs >= 5, F.call("Просвещённый", "Просвещённая"), "изучено знаний: " + JS.s(s.techs)],
		[s.hunts >= 3, F.call("Ловчий", "Ловчая"), "охотничьих трофеев: " + JS.s(s.hunts)],
		[s.tours + s.feasts >= 5, F.call("Щедрый", "Щедрая"), "пиров и турниров: " + JS.s(s.tours + s.feasts)],
		[s.wars == 0 and yN >= 2, F.call("Миролюбивый", "Миролюбивая"), "ни одной войны за " + JS.s(yN) + " " + Sim.plural(yN, "год", "года", "лет")],
		[s.kids >= 3, F.call("Отец многих", "Мать многих"), "детей: " + JS.s(s.kids)]]
	for e in L:
		if e[0]:
			return {"n": e[1], "why": e[2]}
	var tr := ""
	if k != null:
		for t in k.traits:
			if Sim.TRAITS.has(t) and JS.t(Sim.TRAITS[t].get("n")):
				tr = Sim.TRAITS[t].n
				break
	if tr != "":
		if f:
			var rx := RegEx.create_from_string("(ый|ий)$")
			tr = rx.sub(tr, "ая")
		return {"n": tr, "why": "нрав, а не дела: летопись ещё ждёт подвигов"}
	return {"n": F.call("Тихий", "Тихая"), "why": "летопись ещё пуста"}

## пять главных дел: по важности (при равной — что раньше), затем по порядку
static func reignTop(R0: Dictionary, n: int) -> Array:
	var L: Array = []
	for i in R0.chron.size():
		L.append([R0.chron[i], i])
	JS.sort(L, func(a, b):
		var d: float = b[0].imp - a[0].imp
		return d if d != 0.0 else float(a[1] - b[1]))
	L = L.slice(0, n)
	JS.sort(L, func(a, b): return float(a[1] - b[1]))
	return L.map(func(x): return x[0])

static func reignArchive(R0: Dictionary, k: Dictionary) -> Dictionary:
	var G := Sim.G
	var ch: Array = R0.chron
	var A := {"n": R0.n, "name": k.name, "fem": k.get("fem"), "from": R0.from, "to": G.day, "age": k.age, "why": String(JS.o(k.get("deathWhy"), "")), "ep": epithet(R0, k), "st": R0.st.duplicate(),
		"top": reignTop(R0, 5), "chron": ch.slice(maxi(0, ch.size() - 80))}
	G.reigns = (G.get("reigns", []) as Array) + [A]
	return A

## завет наследнику: что отец оставил недоделанным
static func reignGoal() -> Dictionary:
	var G := Sim.G
	var p := int(G.player.realm)
	var k: Dictionary = SimPlayer.kingC()
	var C: Dictionary = G.court
	var wars: Array = [1, 2, 3, 4].filter(func(t): return SimDay.alive(t) and JS.t(G.rel[p][t].war))
	var fellAny := false
	for A in G.get("reigns", []):
		for e in A.chron:
			if e.k == "fell":
				fellAny = true
	var lost: Array = []
	if fellAny:
		for S in G.setts:
			if S.owner == float(p) and S.ctrl != float(p) and Sim.W.setts[int(S.id)].type != "village":
				lost.append(S.id)
	if not wars.is_empty():
		return {"k": "peace", "t": "Окончить войну отца: " + ", ".join(wars.map(func(t): return Sim.realmName(t))) + "."}
	if not lost.is_empty():
		var ids := lost.slice(0, 3)
		return {"k": "regain", "ids": ids, "t": "Вернуть утраченное: " + ", ".join(ids.map(func(i): return String(Sim.W.setts[int(i)].name))) + "."}
	if C.regent >= 0 and k.age < 16:
		return {"k": "age", "t": "Дорасти под опекой регента и взять власть в 16 лет."}
	var e := SimArmy.eraNow()
	if e > 0:
		var L: Array = SimTech.TECH().keys().filter(func(x): return JS.n(SimTech.TECH()[x].get("era")) == e)
		return {"k": "tech", "era": float(e), "t": "Новая эпоха: освоить одно из знаний — " + ", ".join(L.map(func(x): return "«" + String(SimTech.TECH()[x].n) + "»")) + "."}
	return {"k": "lands", "n0": float(SimArmy.landsN()), "t": "Оставить наследнику больше крепостей, чем досталось (" + JS.s(SimArmy.landsN()) + ")."}

static func goalDone(g: Variant) -> bool:
	var G := Sim.G
	var p := int(G.player.realm)
	if not JS.t(g):
		return false
	match g.k:
		"peace":
			return not [1, 2, 3, 4].any(func(t): return SimDay.alive(t) and JS.t(G.rel[p][t].war))
		"regain":
			return g.ids.all(func(i): return G.setts[int(i)].ctrl == float(p))
		"age":
			return G.court.regent < 0
		"tech":
			return SimTech.TECH().keys().any(func(x): return JS.n(SimTech.TECH()[x].get("era")) == g.era and hasTech(x))
		"lands":
			return SimArmy.landsN() > g.n0
	return false
