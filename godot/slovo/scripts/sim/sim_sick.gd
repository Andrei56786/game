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
