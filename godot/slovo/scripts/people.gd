extends RefCounted
# Распорядок двора (как schedTick/npcGoToSp/npcUpdate в HTML): каждый идёт к месту по расписанию,
# через двери в другие помещения; «stairs» — уйти к себе (с глаз долой) или в свою постель; «wander:…» — бродить.
const CT := 16
var c: Node2D   # court.gd

func _init(court: Node2D) -> void:
	c = court

func make(p: Dictionary) -> Dictionary:
	var n := p.duplicate()
	n["x"] = float(p["x"])
	n["y"] = float(p["y"])
	n["away"] = int(p.get("away", 0)) == 1
	n["path"] = null
	n["pi"] = 0
	n["goal"] = null
	n["f"] = 0.0
	n["sit"] = null
	n["lie"] = false
	n["wander"] = null
	n["idle"] = 0.0
	n["cur"] = ""
	n["away_sp"] = null
	n["bub"] = ""
	n["bub_t"] = 0.0
	n["fresh"] = true
	n["node"] = null
	return n

static func _f(sp: Dictionary, k: String) -> bool:
	return sp.has(k) and bool(sp[k])

func spot_of(nm: String) -> Dictionary:
	return c.spots.get(nm, {})

func place(n: Dictionary, sp: Dictionary) -> void:
	n["loc"] = sp["loc"]
	n["x"] = float(sp["x"])
	n["y"] = float(sp["y"])
	n["dir"] = sp["dir"]
	n["path"] = null

func sched_target(n: Dictionary) -> String:
	# лежачий больной (sick2.js) — в своей постели, а нет её — у себя (кроме гостей и стоящих на посту)
	var ch: Variant = real(n)
	if ch != null and ch.get("ill") is Dictionary and JS.t(ch.ill.get("bed")) and not JS.t(n.get("follow")) and not n.get("visitor", false) and not n.has("post"):
		return String(n.bed) if n.has("bed") and not spot_of(n.bed).is_empty() else (String(n.home) if String(n.get("home", "")) != "" else "stairs")
	if not n.has("sched"):
		return ""
	var S: Array = n["sched"]
	var h := Game.hour_abs()
	var cur: Array = S[0]
	for e in S:
		if float(e[0]) <= h:
			cur = e
	# на время — другое место (совет, пир, месса): {spot, until, day}
	var ov: Variant = n.get("override")
	if ov is Dictionary and float(ov.until) > h and int(ov.day) == Game.day:
		return String(ov.spot)
	if cur[1] == "stairs" and n.has("bed") and not spot_of(n["bed"]).is_empty():
		return n["bed"]
	return cur[1]

func sched_tick(n: Dictionary) -> void:
	if JS.t(n.get("hold")):
		return
	var tg := sched_target(n)
	if tg == "" or tg == n["cur"]:
		return
	n["cur"] = tg
	n["wander"] = null
	if tg.begins_with("wander:"):
		var a := tg.substr(7).split("@")
		var r: Array = []
		for v in a[0].split(","):
			r.append(int(v))
		var sp := {"loc": a[1], "x": roundf((r[0] + r[2]) / 2.0) * CT + 8, "y": roundf((r[1] + r[3]) / 2.0) * CT + 12, "dir": "down"}
		go_sp(n, sp, r)
		return
	var sp := spot_of(tg)
	if not sp.is_empty():
		go_sp(n, sp, null)

## идти к месту (npcGoToSp); then(n) — когда дошёл (проситель у трона, ушедший за ворота)
func go_sp(n: Dictionary, sp: Dictionary, wander, then := Callable()) -> void:
	n["goal"] = {"sp": sp, "wander": wander, "door": null, "then": then}
	n["sit"] = null
	n["lie"] = false
	if n["away"]:
		var from = n["away_sp"]
		if from == null:
			from = spot_of(n.get("home", "stairs"))
			if from.is_empty():
				from = sp
		place(n, from)
		n["away"] = false
	repath(n)

## идти к месту по имени (npcGoTo)
func go_to(n: Dictionary, nm: String, then := Callable()) -> void:
	var sp := spot_of(nm)
	if not sp.is_empty():
		go_sp(n, sp, null, then)

static func _then(g: Dictionary, n: Dictionary) -> void:
	var th: Variant = g.get("then")
	if th is Callable and (th as Callable).is_valid():
		(th as Callable).call(n)

func door_toward(from: String, to: String) -> Variant:
	if from == to:
		return null
	var prev := {from: null}
	var q: Array = [from]
	while not q.is_empty():
		var id: String = q.pop_front()
		for d in c.D["locs"][id]["doors"]:
			var t2: String = d["to"]
			if not c.D["locs"].has(t2) or prev.has(t2):
				continue
			prev[t2] = [id, d]
			if t2 == to:
				var s: Array = prev[to]
				while s[0] != from:
					s = prev[s[0]]
				return s[1]
			q.append(t2)
	return null

func repath(n: Dictionary) -> void:
	var g = n["goal"]
	if g == null:
		return
	var sp: Dictionary = g["sp"]
	var tgt: Vector2i
	if sp["loc"] != n["loc"]:
		var d = null
		for dd in c.D["locs"][n["loc"]]["doors"]:
			if dd["to"] == sp["loc"]:
				d = dd
				break
		if d == null:
			d = door_toward(n["loc"], sp["loc"])
		if d == null:
			place(n, sp)
			n["path"] = []
			n["pi"] = 0
			return
		tgt = Vector2i(int(d["x0"]), int(d["y1"]))
		g["door"] = d
	else:
		tgt = c.near_free(n["loc"], floori(float(sp["x"]) / CT), floori(float(sp["y"]) / CT))
		g["door"] = null
	var st: Vector2i = c.near_free(n["loc"], floori(float(n["x"]) / CT), floori(float(n["y"]) / CT))
	var p = c.find_path(n["loc"], st, tgt)
	n["path"] = p if p != null else []
	n["pi"] = 0

func arrive(n: Dictionary) -> void:
	var g = n["goal"]
	if g == null:
		n["path"] = null
		return
	if g["door"] != null:
		var d: Dictionary = g["door"]
		n["loc"] = d["to"]
		n["x"] = float(d["ax"])
		n["y"] = float(d["ay"])
		n["dir"] = d["dir"]
		repath(n)
		return
	var sp: Dictionary = g["sp"]
	n["x"] = float(sp.get("sx", sp["x"]))
	n["y"] = float(sp.get("sy", sp["y"]))
	n["dir"] = sp["dir"]
	n["path"] = null
	n["goal"] = null
	n["sit"] = sp if _f(sp, "sit") else null
	n["lie"] = _f(sp, "lie")
	if _f(sp, "away"):
		n["away"] = true
		n["away_sp"] = sp
	if g["wander"] != null:
		n["wander"] = g["wander"]
		n["idle"] = 0.3
	_then(g, n)

func update(n: Dictionary, dt: float) -> void:
	if n["away"] or JS.t(n.get("hold")):
		return
	if n["bub"] != "" and n["bub_t"] < c.t:
		n["bub"] = ""
	if n["path"] != null:
		var p: Array = n["path"]
		if n["pi"] >= p.size():
			arrive(n)
			return
		var cell: Vector2i = p[n["pi"]]
		var gx := cell.x * CT + 8.0
		var gy := cell.y * CT + 12.0
		var dx: float = gx - n["x"]
		var dy: float = gy - n["y"]
		var d := sqrt(dx * dx + dy * dy)
		var step: float = float(n["spd"]) * dt
		if d <= step:
			n["x"] = gx
			n["y"] = gy
			n["pi"] += 1
		else:
			n["x"] += dx / d * step
			n["y"] += dy / d * step
			n["f"] += step
			n["dir"] = ("right" if dx > 0 else "left") if absf(dx) > absf(dy) else ("down" if dy > 0 else "up")
		return
	if n["wander"] != null:
		n["idle"] -= dt
		if n["idle"] < 0.0:
			var r: Array = n["wander"]
			var tx := randi_range(r[0], r[2])
			var ty := randi_range(r[1], r[3])
			if not c.solid_at(n["loc"], tx, ty):
				var p = c.find_path(n["loc"], Vector2i(floori(float(n["x"]) / CT), floori(float(n["y"]) / CT)), Vector2i(tx, ty))
				if p != null:
					n["path"] = p
					n["pi"] = 0
					n["goal"] = {"sp": {"loc": n["loc"], "x": tx * CT + 8, "y": ty * CT + 12, "dir": ["down", "left", "right", "up"][randi() % 4]}, "wander": r, "door": null}
			n["idle"] = randf_range(2.0, 7.0)

# сразу поставить всех туда, где им положено быть сейчас (вход во двор, сон, перевод часов)
func snap(only_fresh: bool) -> void:
	for n in c.npcs:
		if only_fresh and not n["fresh"]:
			continue
		n["fresh"] = false
		if JS.t(n.get("follow")):      # на охоте — за королём (folUpd)
			continue
		if n.has("post"):
			var ps := spot_of(n["post"])
			if not ps.is_empty():
				place(n, ps)
			n["away"] = false
			continue
		if n.get("visitor", false):    # гости (просители) идут своим путём
			continue
		n["cur"] = ""
		n.erase("hold")
		sched_tick(n)
		var g = n["goal"]
		if g == null:
			continue
		var sp: Dictionary = g["sp"]
		if _f(sp, "away"):
			n["away"] = true
			n["away_sp"] = sp
			n["goal"] = null
			n["path"] = null
		else:
			place(n, sp)
			n["away"] = false
			n["x"] = float(sp.get("sx", sp["x"]))
			n["y"] = float(sp.get("sy", sp["y"]))
			n["sit"] = sp if _f(sp, "sit") else null
			n["lie"] = _f(sp, "lie")
			n["path"] = null
			n["goal"] = null
			if g["wander"] != null:
				n["wander"] = g["wander"]
				n["idle"] = 0.3
			_then(g, n)

## человек королевства за записью двора (n.c в HTML; не pseudoChar — не проситель, не мастер, не лекарь) или null
static func real(n: Dictionary) -> Variant:
	if not n.has("cid") or n.has("pseudo"):
		return null
	return Sim.charOf(n.cid)

func say(n: Dictionary, s: String, dur: float) -> void:
	n["bub"] = s
	n["bub_t"] = c.t + dur

# ---------- кто живёт при дворе (courtPopulate, src/court.js) ----------
# Семья, воспитанники и Малый совет — из королевства (G), слуги и стража — из выгрузки, узники короны — в темнице.
# Прежние записи людей сохраняются по ключу (где стоят, куда идут); заселение заново — когда сменились места совета
# (SimCourt.seats_rev) или люди (SimDyn.pop_rev: рождения, смерти, годы, браки, воспитанники), стройка (SimExt.proj_rev) или лекарь
# (SimSick.doc_rev).
var pop_g = null           # Sim.G при последнем заселении
var revs := [-1, -1, -1, -1]

## заселить заново, если королевство есть и места или люди сменились
func pop_check() -> bool:
	if Sim.G.is_empty() or not Sim.G.has("court"):
		return false
	if pop_g != null and is_same(pop_g, Sim.G) and revs[0] == SimCourt.seats_rev and revs[1] == SimDyn.pop_rev and revs[2] == SimExt.proj_rev and revs[3] == SimSick.doc_rev:
		return false
	populate()
	return true

## возраст облика (как lookKey в HTML): ребёнок, взрослый, пожилой, старик
static func age_key(age: float) -> String:
	return "c" if age < 14 else ("a" if age < 52 else ("o" if age < 64 else "v"))

## облик (лист 4×4 и лицо) человека королевства: по id из выгрузки (res.cspr), а если облик с тех пор сменился
## по возрасту или человек родился позже — из запаса по полу и возрасту (res.cstock); проситель (pseudoChar) — из запаса
## по роли и полу (res.pstock)
static func look(D: Dictionary, ch: Dictionary) -> Array:
	var fk := "1" if JS.t(ch.get("fem")) else "0"
	if JS.t(ch.get("pseudo")):
		var P: Array = (D.get("pstock", {}) as Dictionary).get(String(ch.get("role", "")) + fk, [])
		if not P.is_empty():
			var s0: Array = P[posmod(int(JS.n(ch.get("id"))), P.size())]
			return [s0[0], int(s0[1])]
	var ak := age_key(JS.n(ch.get("age")))
	var e: Variant = (D.get("cspr", {}) as Dictionary).get(JS.s(ch.get("id")))
	if e is Array and String(e[2]) == ak:
		return [e[0], int(e[1])]
	var L: Array = (D.get("cstock", {}) as Dictionary).get(ak + fk, [])
	if L.is_empty():
		return [D.king.sheet, -1]
	var s: Array = L[posmod(int(JS.n(ch.get("id"))), L.size())]
	return [s[0], int(s[1])]

## имя над головой и строка под ним (npcTitle / npcSub, src/courtui.js)
static func npc_title(n: Dictionary, ch: Dictionary) -> String:
	if String(n.get("seat", "")) != "":
		return SimDyn.seatName(n.seat) + ": " + String(ch.name)
	if JS.t(ch.get("pseudo")):
		return String(ch.name)
	var t := String(ch.get("title", ""))
	return (t + " " if t != "" else "") + String(ch.name)

static func npc_sub(n: Dictionary, ch: Dictionary) -> String:
	if n.has("sub0"):
		return String(n.sub0)
	if n.has("petition"):
		return "Проситель"
	if n.has("fam"):
		return SimDyn.famRole(ch)
	if String(n.key).begins_with("ward"):
		return "Воспитанник двора · дом " + SimDyn.houseName(ch.get("house"))
	if String(n.get("seat", "")) != "":
		var H: Variant = SimDyn.houseOf(ch)
		return "дом " + String(H.name) if H != null else ""
	return ""

## человек двора из G (mkNpc): прежняя запись по ключу — с новыми данными, иначе новая (fresh — встанет по расписанию)
func mk(out: Array, old: Dictionary, key: String, ch: Dictionary, o: Dictionary) -> Dictionary:
	var n: Dictionary
	if old.has(key):
		n = old[key]
	else:
		n = make({"key": key, "loc": "keep", "x": 0, "y": 0, "dir": "down", "away": 1, "home": "stairs", "lines": ["…"],
			"spd": 46.0 - (10.0 if JS.n(ch.get("age")) > 60 else 0.0)})
	for k in o:
		n[k] = o[k]
	var lk := look(c.D, ch)
	n.cid = ch.id
	if JS.t(ch.get("pseudo")):
		n.pseudo = 1
	else:
		n.erase("pseudo")
	n.sheet = lk[0]
	n.port = lk[1]
	n.role = String(ch.get("role", ""))
	if JS.t(ch.get("fem")):
		n.fem = 1
	else:
		n.erase("fem")
	if JS.n(ch.get("age")) < 12:
		n.kid = 1
	else:
		n.erase("kid")
	n.name = npc_title(n, ch)
	n.sub = npc_sub(n, ch)
	out.append(n)
	return n

func populate() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var S: Dictionary = c.D.get("sched", {})
	var old := {}
	for n in c.npcs:
		old[String(n.key)] = n
	var out: Array = []
	var king: Dictionary = SimPlayer.kingC()
	# семья: супруга, дети с трёх лет (расписание — по возрасту)
	for ch: Dictionary in SimDyn.royalFamily():
		if SimCourt.seatOf(ch) != null:
			continue
		if ch.id == king.get("spouse"):
			mk(out, old, "spouse", ch, {"sched": S.consort, "home": "stairs", "fam": 1})
			continue
		var age := JS.n(ch.get("age"))
		if age < 3:
			continue
		mk(out, old, "kid" + JS.s(ch.id), ch, {"sched": S.consort if age >= 16 else (S.heir if age >= 10 else S.child), "home": "stairs", "fam": 1,
			"spd": 44.0 if age >= 16 else 40.0})
	# воспитанники двора
	for w in C.get("wards", []):
		var ch: Variant = Sim.charOf(w)
		if ch != null and JS.t(ch.alive):
			mk(out, old, "ward" + JS.s(w), ch, {"sched": S.child, "home": "stairs", "spd": 40.0})
	# Малый совет — без отъехавших и умерших; маршал живёт в казармах
	for s: Dictionary in Sim.SEATS:
		var id: Variant = C.seats.get(s.k)
		if id == null or float(id) < 0:
			continue
		var ch: Variant = Sim.charOf(id)
		if ch == null or not JS.t(ch.alive) or JS.t(ch.get("away")):
			continue
		mk(out, old, "seat_" + String(s.k), ch, {"sched": S[s.k], "home": "barracks1" if s.k == "marshal" else "stairs", "seat": String(s.k)})
	# слуги и стража — из выгрузки (лекарь — из королевства, ниже)
	for p: Dictionary in c.D.people:
		var k := String(p.key)
		if (k.begins_with("srv_") or k.begins_with("grd_")) and k != "srv_doc":
			out.append(old[k] if old.has(k) else make(p))
	# узники короны — по камерам (homeExtras)
	var P: Array = G.chars.filter(func(x): return JS.t(x.alive) and float(x.get("prison", -1)) == 0.0 and x.id != G.player.char).slice(0, 12)
	for i in P.size():
		var sp := "cell" + str(i % 6) + ("b" if i >= 6 else "")
		var n := mk(out, old, "pris" + JS.s(P[i].id), P[i], {"pris": 1, "post": sp, "sub0": "Узник короны", "talkR": 52.0})
		n.lines = [prisoner_line(P[i])]
	c.wrk.crew(out, old)      # мастера стройки (projNpcs)
	c.sck.pop(out, old)       # лекарь двора (POP_EXT, sick2.js)
	assign_beds(out)
	# гости (просители) — как были; ушедших — с экрана
	for n in c.npcs:
		if n.get("visitor", false):
			out.append(n)
	for n in c.npcs:
		if not out.has(n) and n.get("node") != null:
			(n.node as Node).queue_free()
			n.node = null
	c.npcs = out
	pop_g = G
	revs = [SimCourt.seats_rev, SimDyn.pop_rev, SimExt.proj_rev, SimSick.doc_rev]
	snap(true)

## постели (assignBeds, src/castle2.js): советникам — свои, королеве — своя, детям и воспитанникам — детские (старшему — гостевая)
func assign_beds(L: Array) -> void:
	var kid := 0
	var guest := false
	for n in L:
		n.erase("bed")
		var k := String(n.key)
		if String(n.get("seat", "")) != "":
			n.bed = "bed_" + String(n.seat)
		elif k == "spouse":
			n.bed = "bed_queen"
		elif k.begins_with("kid") or k.begins_with("ward"):
			var ch: Variant = Sim.charOf(n.get("cid"))
			if ch != null and JS.n(ch.get("age")) >= 16 and not guest:
				n.bed = "bed_guest"
				guest = true
			elif kid < 4:
				n.bed = "bed_kid" + str(kid)
				kid += 1
		elif String(n.get("staff", "")) == "maid":
			n.bed = "bed_maid"
		elif String(n.get("staff", "")) == "page":
			n.bed = "bed_page"

## первая реплика узника (prisonerTalk, src/chapel.js): свой — просит милости, чужой — по нраву
static func prisoner_line(ch: Dictionary) -> String:
	var tr: Array = ch.get("traits", [])
	if ch.realm == 0.0:
		return "«Я служил короне верно, государь. Меня оговорили!»" if tr.has("proud") else "«Смилуйтесь, государь! Я искуплю вину.»"
	if tr.has("craven"):
		return "«Пощадите! Я скажу всё, что знаю!»"
	if tr.has("proud"):
		return "«Мой господин заплатит за меня золотом — а за эту солому спросит железом.»"
	if tr.has("brave"):
		return "«Я бился честно — и в цепях остаюсь воином.»"
	return "«Солома сырая, похлёбка жидкая. Чего вы хотите, король?»"
