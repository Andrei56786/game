extends RefCounted
## Приём прошений при дворе (audience.js): в 8:30 к воротам приходят просители (1–3, spawnPetitioners) и ждут в тронном
## зале; король на троне — подходят по одному (startAudience, audienceAuto, nextPetitioner) и излагают просьбу
## (petitionDialog): решает король или «передать верховному судье»; с 12:30 до 20:00 оставшихся рассматривает судья
## (или канцлер), и они уходят (courtHalfHour). Прошения, имена и возраст просителей — из зерна королевства, как в HTML.
var c: Node2D          # court.gd
var A = null           # идёт приём: {q: [кто ждёт очереди]} (COURT.audience)
var aud_t := 0.0       # audienceAuto — не чаще раза в 0,5 с (COURT.audT)
var next_t := -1.0     # следующий проситель — через 0,4 с после решения (setTimeout 400)
var gone: Array = []   # ушли за ворота — убрать со двора после обхода людей

func _init(court: Node2D) -> void:
	c = court

static func ok() -> bool:
	return not Sim.G.is_empty() and Sim.G.has("court")

func on_throne() -> bool:
	return c.king["sit"] != null and c.king["sit"] == c.spots.get("throne")

static func _pet(n: Dictionary) -> bool:
	return n.get("petition") is Dictionary and not JS.t(n.petition.get("done"))

## кто ждёт в тронном зале
func waiting() -> Array:
	return c.npcs.filter(func(n): return _pet(n) and n.loc == "keep" and not n.away)

## есть ещё нерешённые прошения (кто-то идёт через двор)
func pending() -> bool:
	return c.npcs.any(func(n): return _pet(n))

## человек без места в королевстве (pseudoChar): проситель
static func pseudo(i: int, role: String, fem: int, age: int, nm: String) -> Dictionary:
	return {"id": 7000.0 + i, "name": nm, "role": role, "cul": "K", "fem": float(fem), "age": float(age), "realm": 0.0, "traits": [],
		"alive": 1.0, "prison": -1.0, "pseudo": 1.0}

static func _fem_name(x: String) -> bool:
	return x.ends_with("а") or x.ends_with("я") or x.ends_with("ь")

## просители у ворот (spawnPetitioners): у каждого прошения — свой человек; идут в очередь у трона (q0…q5)
func spawn() -> int:
	var k := 0
	var cnt := int(Sim.R.i(1, 3))
	for i in cnt:
		var p: Variant = SimCourt.mkPetition()
		if p == null:
			continue
		var ch: Variant = Sim.charOf(p.c) if JS.n(p.get("c", -1)) >= 0 else null
		if ch == null:
			var fem := int(JS.n(p.fem))
			var age := int(Sim.R.i(20, 60))
			var pool: Array = (Sim.NAMES.K as Array).filter(func(x): return _fem_name(String(x)) == (fem == 1))
			pool.append("Том")
			ch = pseudo(200 + int(p.id) % 600, String(p.role), fem, age, String(Sim.T.PET_ROLE_N[p.role][fem]) + " " + String(Sim.R.pick(pool)))
		var n: Dictionary = c.people.mk(c.npcs, {}, "pet" + JS.s(p.id), ch, {"visitor": true, "petition": p, "spd": 40.0})
		n.fresh = false
		c.people.place(n, c.spots.gate_out)
		n.away = false
		var q: int = (c.npcs.filter(func(x): return x.get("petition") is Dictionary).size() - 1) % 6
		c.people.go_to(n, "q" + str(q))
		k += 1
	c.hud.toast("Просители у ворот: приём в тронном зале с 9 до 12.")
	print("PETITIONERS ", k)
	return k

## уйти со двора (npcLeave): к воротам — и с глаз долой
func npc_leave(n: Dictionary) -> void:
	n.erase("petition")
	n.erase("override")
	n.erase("sched")
	n.visitor = true
	n.cur = ""
	c.people.go_to(n, "gate_out", func(m): gone.append(m))

## каждый кадр двора: следующий проситель после решения, ушедшие — со двора
func tick() -> void:
	if next_t >= 0.0 and c.t >= next_t:
		next_t = -1.0
		if A != null and c.king["sit"] != null:
			next()
	if gone.is_empty():
		return
	for n in gone:
		c.npcs.erase(n)
		if n.get("node") != null:
			(n.node as Node).queue_free()
			n.node = null
	gone = []

## сесть на трон — начать приём (startAudience)
func start() -> void:
	if not ok():
		return
	var h := Game.hour_abs()
	var w := waiting()
	if w.is_empty():
		c.hud.say(null, "Просители ещё идут через двор. Оставайтесь на троне — подойдут, как только войдут." if pending()
			else ("Приёмные часы — с девяти до полудня. Сейчас просителей нет." if h < 9.0 or h > 12.5 else "Просителей больше нет."))
		return
	A = {"q": w}
	next()

## следующий — к трону (nextPetitioner); вошедшие во время приёма — тоже в очередь
func next() -> void:
	if A == null:
		return
	var q: Array = A.q
	var n: Variant = q.pop_front() if not q.is_empty() else null
	if n == null:
		var more := waiting()
		if not more.is_empty():
			A.q = more
			n = more.pop_front()
	if n == null:
		A = null
		c.hud.toast("Остальные просители ещё в пути — подойдут сами." if pending() else "Приём окончен.")
		return
	c.people.go_sp(n, c.spots.petition, null, func(m):
		m.dir = "up"
		if A != null and on_throne():
			dialog(m))

## король уже на троне: вошедшие в зал подходят сами (audienceAuto)
func auto() -> void:
	if not ok() or not on_throne() or c.loc_id != "keep" or A != null or c.blocked():
		return
	if aud_t > c.t:
		return
	aud_t = c.t + 0.5
	var w := waiting()
	if not w.is_empty():
		A = {"q": w}
		next()

## проситель у трона (petitionDialog): решения прошения (недоступные — с причиной) и «Передать верховному судье»
func dialog(n: Dictionary) -> void:
	var p: Variant = n.get("petition")
	if not (p is Dictionary):
		next()
		return
	var all: Array = SimCourt.petChoices(p)
	var avail: Array = all.filter(func(x): return x.ok)
	var chs: Array = []
	for x: Dictionary in all:
		var i := int(x.i)
		var e := {"t": x.t, "tip": x.get("tip"), "fx": func():
			SimCourt.petFx(p, i)
			SimCourt.noteVerdict(p, x, avail if not avail.is_empty() else all, "king", SimPlayer.kingC())
			print("VERDICT king ", p.k, ": ", x.t)
			fin(n, p)}
		if String(x.why) != "":
			e.ok = func(): return bool(SimCourt.petChoices(p)[i].ok)
			e.why = x.why
		chs.append(e)
	if SimDyn.seatChar("justice") != null:
		chs.append({"t": "Передать верховному судье", "fx": func():
			var t: Variant = SimCourt.judgeResolve(p)
			var j: Variant = SimDyn.seatChar("justice")
			if t != null and j != null:
				c.hud.toast("Судья " + String(j.name) + " решил: «" + String(t) + "»")
			print("VERDICT judge ", p.k, ": ", t)
			fin(n, p)})
	var text := String(p.text)
	var yc: Variant = Sim.charOf(p.c) if p.k == "young" and JS.n(p.get("c", -1)) >= 0 else null
	if yc != null:   # birds.js: первое впечатление — на глаз, нрав, Око хмурится
		text += "\n(Вы присматриваетесь. На глаз: " + SimBirds.impLine(yc) + ". Нрав: " + SimBirds.natureLine(yc) + "." \
			+ (" Око короля хмурится и качает головой." if JS.t(SimBirds.eyeSus(p)) else "") + ")"
	c.hud.say(n, text, {"choices": chs})
	print("PETITION ", p.k, " — ", n.name)

func fin(n: Dictionary, p: Dictionary) -> void:
	p.done = 1.0
	SimCourt.prestige(0.3)
	npc_leave(n)
	if A != null:
		next_t = c.t + 0.4

## разговор с просителем (talkPetitioner): на троне — приём, иначе — ждёт у трона
func talk(n: Dictionary) -> void:
	if on_throne():
		start()
		return
	c.hud.say(n, "Я жду приёма у трона, ваше величество. Сядьте на трон — и я изложу свою просьбу.")

## часы двора (courtHalfHour): в 8:30 — просители у ворот; с 12:30 до 20:00 оставшихся рассматривает судья (кто ждёт
## у трона, пока король слушает, — ждёт своей очереди)
func half_hour(h: float) -> void:
	if not ok() or JS.t(Sim.G.get("visit")):
		return
	if h == 8.5:
		spawn()
	if h >= 12.5 and h <= 20.0:
		var hearing: bool = A != null and on_throne()
		var left: Array = c.npcs.filter(func(n): return _pet(n) and not (hearing and n.loc == "keep"))
		var k := 0
		for n in left:
			if SimCourt.judgeResolve(n.petition) != null:
				k += 1
			npc_leave(n)
		if k > 0:
			var V: Array = (Sim.G.court.verdicts as Array).slice(0, k)
			Sim.glog(("Судья" if SimDyn.seatChar("justice") != null else "Канцлер") + " рассмотрел оставшиеся прошения: "
				+ "; ".join(PackedStringArray(V.map(func(v): return String(v.g) + " — «" + String(v.t) + "»"))) + ".", "info")
			print("JUDGED ", k)
		if not hearing:
			A = null
