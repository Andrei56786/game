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

static func techIncK() -> float:
	return 1.0 + (0.05 if projDone("mint") else 0.0) + (0.08 if hasTech("rotation") else 0.0) + (0.04 if hasTech("ledgers") else 0.0) + (0.06 if hasTech("mills") else 0.0) + (0.06 if hasTech("townhalls") else 0.0)
