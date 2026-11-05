extends RefCounted
## Раны короля и лечение (hurt.js): ушиб, рана, тяжёлая рана (k.woundK — 1…3, k.wound — день, когда заживёт, k.woundP — где,
## k.woundBy — чем); носилки через двор к донжону, лекарь у постели, дни в постели (часы бегут), жар при тяжёлой ране;
## значок раны в верхней строке. Раненый король ходит медленнее, без турнира. Случайности — не из зерна королевства.
## Беды охоты (бросок кабана, медведь) — с охотой. Болезнь короля (sick2.js): та же сцена с o.from = ill — сразу в покои, дни — по болезни.
const Aud = preload("res://scripts/court_audience.gd")
const CT := 16
const WOUNDS := {1: {"n": "ушиб", "d": [1, 2], "bed": 0.0}, 2: {"n": "рана", "d": [8, 12], "bed": 0.6}, 3: {"n": "тяжёлая рана", "d": [18, 26], "bed": 0.62}}
const HOW := {"турнир": "на турнире", "кабан": "кабаном", "медведь": "медведем", "олень": "оленем", "шальная стрела": "шальной стрелой", "падение": "при падении"}
var c: Node2D
var on := false              # HEAL.on: идёт сцена лечения
var sh := ""                 # litter — носилки, bed — у постели, days — дни в постели
var q: Variant = null        # healQueue: начать, когда закроются разговоры
var o := {}                  # {from: tourney | hunt | ill}
var king_id := -1.0
var tot := 0.0
var bed := 0
var fast := false
var t0 := 0.0
var cap := ""
var vis: Array = []          # у постели: [{c, sheet, x, y, dir}] — лекарь, супруг(а)
var fever: Variant = null    # {day, ext, st}
var path: Array = []
var men: Array = []          # носильщики: [{sheet, x, y, dir, f}]
var vx := 1.0
var vy := 0.0
var d0 := 0
var end_t := 0.0
var last_d := -1
var lines := {}
var pf := 0.0                # шаг носилок (P.f)

func _init(court: Node2D) -> void:
	c = court
	SimSick.heal_ill = false

static func _k() -> Dictionary:
	return SimPlayer.kingC()

static func _day() -> float:
	return float(Game.day)

static func wound_name(k: Variant = null) -> String:
	var kk: Dictionary = k if k is Dictionary else _k()
	return String(WOUNDS.get(int(JS.o(kk.get("woundK"), 2.0)), WOUNDS[2]).n)

static func wound_not(k: Variant = null) -> String:
	var kk: Dictionary = k if k is Dictionary else _k()
	var w := JS.n(kk.get("woundK"))
	return "Ушиб ещё не прошёл" if w == 1 else ("Тяжёлая рана ещё не зажила" if w == 3 else "Рана ещё не зажила")

static func wound_spd(k: Dictionary) -> float:
	var w := JS.n(k.get("woundK"))
	return 0.85 if w == 1 else (0.5 if w == 3 else 0.62)

static func hurt(k: Dictionary) -> bool:
	return JS.n(k.get("wound")) > _day()

## болен ли король (sickNot, sick2.js): почему нельзя на ристалище или на охоту
static func sick_not(k: Variant = null) -> String:
	var kk: Dictionary = k if k is Dictionary else _k()
	var I: Variant = kk.get("ill")
	if JS.t(I):
		return "Вы больны (" + String(SimSick.DIS[I.k].n) + "), государь, лекарь велит беречься"
	if JS.n(kk.get("sickConv")) > _day():
		return "Вы ещё слабы после болезни, государь"
	return ""

## больной или ослабевший король ходит медленнее (sickSpd)
static func sick_spd(ch: Variant) -> float:
	if not (ch is Dictionary) or ch.get("id") != Sim.G.player.char:
		return 1.0
	var I: Variant = ch.get("ill")
	if JS.t(I):
		return 0.55 if I.k == "gout" else (0.7 if JS.t(I.get("bed")) else 0.85)
	return 0.9 if JS.n(ch.get("sickConv")) > _day() else 1.0

## во сколько раз медленнее идёт король: рана и болезнь
static func walk_k() -> float:
	if Sim.G.is_empty() or not Sim.G.has("player"):
		return 1.0
	var k: Dictionary = _k()
	return (wound_spd(k) if hurt(k) else 1.0) * sick_spd(k)

## ранить короля (woundKing): срок — по тяжести (медведь и годы — дольше, старая рана — прибавит половину), в летопись;
## с хирургией (reign.js) — на треть короче. Возвращает дни.
static func wound_king(sev: int, part: String, by: String) -> int:
	var G := Sim.G
	var k: Dictionary = _k()
	var W0: Dictionary = WOUNDS[sev]
	var days := randi_range(int(W0.d[0]), int(W0.d[1])) + (3 if by == "медведь" and sev > 1 else 0) + (2 if JS.n(k.age) > 50 and sev > 1 else 0)
	var old := JS.n(k.get("wound")) - _day() if hurt(k) else 0.0
	if old > 0:
		days += ceili(old * 0.5)
	if not hurt(k) or sev >= JS.n(k.get("woundK")):
		k.woundK = float(sev)
		k.woundP = part
		k.woundBy = by
	k.wound = maxf(JS.n(k.get("wound")), _day() + days)
	k.woundDay = _day()
	var how: String = HOW.get(by, by)
	Sim.glog(("Ушиб " + ("на турнире" if by == "турнир" else "на охоте") if sev == 1 else ("Король тяжело ранен " if sev == 3 else "Король ранен ") + how) + ": " + part + ". "
		+ ("Пройдёт за " if sev == 1 else "Заживёт за ") + SimExt.dn(days) + ".", "info" if sev == 1 else "bad")
	# reign.js: в счёт царствования и в летопись; хирургия сокращает срок
	var st: Dictionary = SimArmy.RST()
	if not st.is_empty():
		st.hurt += 1
	if sev >= 2:
		SimArmy.chron("Король ранен" + (" на турнире" if by == "турнир" else (" кабаном" if by == "кабан" else (" медведем" if by == "медведь" else ""))) + ": " + part + ".", "wound", "hurt", 2.0)
	if not SimDyn.hasTech("surgery"):
		return days
	var cut := floori(days / 3.0)
	k.wound -= cut
	return days - cut

# ---------- сцена: носилки к донжону, лекарь у постели, дни в постели ----------
func queue(o_: Dictionary) -> void:
	q = o_

func start(o_: Dictionary) -> void:
	var k: Dictionary = _k()
	var W0: Dictionary = WOUNDS.get(int(JS.o(k.get("woundK"), 2.0)), WOUNDS[2])
	o = o_
	on = true
	king_id = k.id
	tot = maxf(1.0, JS.n(k.wound) - _day())
	bed = maxi(2, int(JS.rnd(tot * float(W0.bed))))
	fast = false
	sh = ""
	t0 = c.t
	cap = ""
	vis = []
	fever = null
	if JS.n(k.get("woundK")) == 3 and randf() < float(JS.o(k.get("woundFv"), 0.3)) * SimSick.docK():
		fever = {"day": randi_range(2, 3), "ext": randi_range(3, 5), "st": 0}
	k.woundFv = 0.0
	c.hud.win = null
	while c.hud.dlg_open():
		c.hud.close_dlg()
	c.path = []
	c.on_arrive = Callable()
	Snd.music("lament")
	print("HEAL START ", String(o.get("from", "")), " ", bed, " ", tot)
	litter()

## король ложится в постель с болезнью (sickBedStart, sick2.js): без носилок — сразу в покои; дней — сколько осталось болезни
func start_ill() -> void:
	var k: Dictionary = _k()
	var I: Variant = k.get("ill")
	if not JS.t(I) or on:
		return
	var nd := maxi(1, int(JS.n(I.end) - _day()))
	I.up = 0.0
	I.asked = 1.0
	o = {"from": "ill"}
	on = true
	SimSick.heal_ill = true
	king_id = k.id
	tot = nd
	bed = nd
	fast = false
	sh = ""
	t0 = c.t
	cap = ""
	vis = []
	fever = null
	men = []
	c.hud.win = null
	while c.hud.dlg_open():
		c.hud.close_dlg()
	c.path = []
	c.on_arrive = Callable()
	if Game.speed > 0:
		Game.last_speed = Game.speed
	Snd.music("sick")
	print("HEAL START ill ", bed, " ", tot)
	bed_()

## «Лежать дней N» (sickBedCap): что говорит лекарь у постели больного короля
func sick_bed_cap() -> String:
	var I: Variant = _k().get("ill")
	var nd := maxi(1, int(JS.n(I.end) - _day())) if JS.t(I) else 1
	var who := String(vis[0].c.name) if not vis.is_empty() else "Лекарь"
	return who + " щупает пульс: «" + (SimSick.sCap(String(SimSick.DIS[I.k].n)) if JS.t(I) else "Хворь") + ", государь. Лежать дней " + str(nd) + "»."

## заголовок дней в постели (sickTitle): болезнь — или «Выздоровление», когда она уже прошла
static func sick_title() -> String:
	var I: Variant = _k().get("ill")
	return SimSick.sCap(String(SimSick.DIS[I.k].n)) if JS.t(I) else "Выздоровление"

## король встаёт (sickUp): болезнь ещё не прошла — он на ногах (тяжелее), прошла — пара дней слабости
func sick_up() -> void:
	var I: Variant = _k().get("ill")
	if JS.t(I):
		I.up = 1.0
		c.hud.toast("Король встаёт, хоть болезнь ещё не ушла.")
		return
	c.hud.toast("Король встаёт с постели. Пару дней — слабость: без охоты и меча.")
	Sim.glog("Король поднялся с постели после болезни.", "info")

func _man(i: int, role: String, age: int, nm: String) -> Dictionary:
	var ch := Aud.pseudo(90 + i, role, 0, age, nm)
	return {"sheet": c.people.look(c.D, ch)[0], "x": 0.0, "y": 0.0, "dir": "down", "f": 0.0}

func litter() -> void:
	c.fade_to(func():
		var P: Dictionary = c.king
		var in_y: bool = c.loc_id == "yard"
		if c.loc_id != "yard":
			c.go_loc("yard")
		P.sit = null
		P.lie = false
		P.hide = true
		c.parts.clear()
		var Y: Dictionary = c.D.locs.yard
		var dk: Variant = null
		for d in Y.doors:
			if d.to == "keep":
				dk = d
				break
		var tx: int = int(JS.rnd((float(dk.x0) + float(dk.x1)) / 2.0)) if dk != null else 37
		var ty: int = int(dk.y1) + 2 if dk != null else 20
		var sp: Dictionary = c.spots.get("hunter", c.spots.get("gate_out", {}))
		var s := Vector2i(tx, ty + 10)
		if in_y:
			s = c.near_free("yard", floori(float(P.x) / CT), floori(float(P.y) / CT))
		elif not sp.is_empty():
			s = c.near_free("yard", floori(float(sp.x) / CT), floori(float(sp.y) / CT))
		var p: Variant = c.find_path("yard", s, Vector2i(tx, ty))
		path = p if p is Array and not (p as Array).is_empty() else [s, Vector2i(tx, ty)]
		if path[0] != s:
			path.insert(0, s)
		if path.size() > 15:
			path = path.slice(path.size() - 15)
		var s0: Vector2i = path[0]
		P.x = s0.x * CT + 8.0
		P.y = s0.y * CT + 11.0
		pf = 0.0
		sh = "litter"
		t0 = c.t
		cap = "Короля уносят с ристалища" if o.get("from") == "tourney" else "Ловчие несут раненого короля в замок"
		men = [_man(0, "peasant", 34, "Ловчий"), _man(1, "guard", 27, "Стражник")]
		c.snap_cam()
		Snd.sfx("horn_low"))

func bed_() -> void:
	c.fade_to(func():
		var P: Dictionary = c.king
		var sp: Dictionary = c.spots.get("bed_king", {})
		var k: Dictionary = _k()
		if c.loc_id != "keep":
			c.go_loc("keep")
		P.hide = false
		c.sit_at(sp)
		c.parts.clear()
		c.snap_cam()
		var dc: Variant = SimSick.docFor(k)
		var dch: Dictionary
		if dc != null:
			dch = Aud.pseudo(int(dc.i), "doc_" + String(dc.kind), int(JS.n(dc.fem)), int(JS.n(dc.age)), String(dc.name))
		else:
			dch = Aud.pseudo(92, "scholar", 0, 58, "Городской лекарь")
		vis = [{"c": dch, "sheet": c.people.look(c.D, dch)[0], "x": float(sp.get("sx", sp.x)) + 30.0, "y": float(sp.get("sy", sp.y)) + 8.0, "dir": "left"}]
		var s2: Variant = Sim.charOf(k.spouse) if JS.n(k.get("spouse", -1)) >= 0 else null
		if s2 != null and JS.t(s2.alive) and not JS.t(s2.get("away")) and not (JS.t(s2.get("ill")) and JS.t(s2.ill.get("bed"))):
			vis.append({"c": s2, "sheet": c.people.look(c.D, s2)[0], "x": float(sp.get("sx", sp.x)) + 2.0, "y": float(sp.get("sy", sp.y)) + 46.0, "dir": "up"})
		sh = "bed"
		t0 = c.t
		cap = sick_bed_cap() if o.get("from") == "ill" else String(dch.name) + " промывает рану вином и зашивает. «Лежать, государь, — дней " + str(bed) + "»."
		Snd.sfx("door"))

func days() -> void:
	sh = "days"
	d0 = Game.day
	end_t = Game.day + bed + 3.0 / 24.0
	last_d = -1
	t0 = c.t
	if Game.speed == 0:
		Game.set_speed(1)
	var k: Dictionary = _k()
	var s2: Variant = Sim.charOf(k.spouse) if JS.n(k.get("spouse", -1)) >= 0 else null
	lines = {1: (("Королева" if JS.t(s2.get("fem")) else "Супруг") + " не отходит от постели." if s2 != null and JS.t(s2.alive) and not (JS.t(s2.get("ill")) and JS.t(s2.ill.get("bed")))
		else "Паж приносит бульон и вести из столицы.")}
	lines[maxi(2, floori(bed / 2.0))] = "Канцлер читает у изголовья донесения: совет справляется сам."

func end_(dead: bool) -> void:
	var k: Dictionary = _k()
	var P: Dictionary = c.king
	on = false
	SimSick.heal_ill = false
	sh = ""
	vis = []
	men = []
	P.hide = false
	print("HEAL END ", dead)
	if dead:
		return
	c.stand_up()
	c.people.snap(false)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	Snd.music("auto")
	if o.get("from") == "ill":
		sick_up()
		return
	var rest := maxi(1, int(JS.rnd(tot * 0.4)))
	k.wound = _day() + rest
	c.hud.toast("Король встаёт на ноги. Ещё " + SimExt.dn(rest) + " беречься: ходить медленно, без меча и охоты.")
	Sim.glog("Король поднялся с постели после " + SimExt.dn(bed) + " в покоях.", "info")

func skip() -> void:
	if sh == "litter":
		bed_()
	elif sh == "bed":
		days()
	elif sh == "days":
		fast = not fast

## часы двора: на носилках и у постели почти стоят (TIMEK_EXT)
func time_k() -> float:
	return 0.02 if on and sh != "days" else 1.0

## каждый кадр двора (UPD_EXT): начать из очереди, носилки, у постели, дни в постели
func update(dt: float) -> void:
	if q != null and not on and not c.hud.is_open() and c.fade == 0.0:
		var o_: Dictionary = q
		q = null
		start(o_)
	if not on:
		return
	var P: Dictionary = c.king
	if sh == "litter" and c.fade == 0.0:
		if path.is_empty() or c.t - t0 > 10.0:
			bed_()
			return
		var pt: Vector2i = path[0]
		var gx := pt.x * CT + 8.0
		var gy := pt.y * CT + 11.0
		var dx: float = gx - float(P.x)
		var dy: float = gy - float(P.y)
		var d := sqrt(dx * dx + dy * dy)
		var st := 26.0 * dt
		if d <= st:
			P.x = gx
			P.y = gy
			path.pop_front()
		else:
			P.x = float(P.x) + dx / d * st
			P.y = float(P.y) + dy / d * st
			vx = dx / d
			vy = dy / d
		pf += st
	if sh == "bed" and c.fade == 0.0 and c.t - t0 > 4.5:
		days()
	if sh == "days" and c.fade == 0.0:
		var k: Dictionary = _k()
		if not JS.t(k.alive) or JS.t(Sim.G.get("over")) or k.id != king_id:
			end_(true)
			return
		var d := Game.day - d0
		if d != last_d:
			last_d = d
			if lines.has(d):
				cap = lines[d]
			if d == 0:
				vis = vis.slice(0, 1)
			elif d == 1:
				vis = []
			var F: Variant = fever
			if F != null and d == int(F.day):
				F.st = 1
				end_t += float(F.ext)
				k.wound = JS.n(k.wound) + float(F.ext)
				tot += float(F.ext)
				cap = "Ночью начался жар. Лекарь пускает кровь, капеллан молится у изголовья."
				Snd.sfx("bell")
			if F != null and int(F.st) == 1 and d == int(F.day) + 2:
				F.st = 2
				if randf() < (0.15 if JS.n(k.age) > 50 else 0.06) * SimSick.docK():
					cap = ""
					end_(true)
					SimDyn.charDies(k, "от раны: " + String(JS.o(k.get("woundBy"), "зверь")) + ", " + String(JS.o(k.get("woundP"), "рана")))
					return
				cap = "Жар спал. Лекарь крестится: «Обошлось, государь»."
			if Game.day + Game.frac >= end_t - 1.0:
				cap = "Жар отступил. Лекарь разрешает встать." if o.get("from") == "ill" else "Рана затянулась. Лекарь разрешает встать."
		if not c.hud.is_open():
			var n := 9 if fast else 3
			for i in n:
				if Game.day + Game.frac >= end_t:
					break
				Game.advance_days(minf(0.004, end_t - Game.day - Game.frac + 1e-6))
				if not on:            # король умер от болезни в постели (sickDie → конец сцены)
					return
		if Game.day + Game.frac >= end_t - 1e-6:
			end_(false)

# ---------- рисунок: носилки и носильщики, лекарь и супруг(а) у постели ----------
static func _walker(nd: Node2D, sheet: Array, x: float, y: float, dir: String, fi: int) -> void:
	var DIRS := ["down", "left", "right", "up"]
	var idx: int = sheet[maxi(0, DIRS.find(dir))][fi]
	var rx := roundf(x)
	var ry := roundf(y)
	var shi: int = Art.D["shadow"]
	nd.draw_texture_rect_region(Art.page(shi), Rect2(rx - 6.0, ry - 2.0, Art.rect(shi).size.x, Art.rect(shi).size.y), Art.rect(shi))
	nd.draw_texture_rect_region(Art.page(idx), Rect2(rx - 8.0, ry - 31.0, 16, 32), Art.rect(idx))

## лежащий (drawLying): кадр «вниз», повёрнутый на rot вокруг (x, y)
static func lying(nd: Node2D, sheet: Array, x: float, y: float, rot: float, yo: float) -> void:
	var idx: int = sheet[0][0]
	nd.draw_set_transform(Vector2(roundf(x), roundf(y) + yo), rot)
	nd.draw_texture_rect_region(Art.page(idx), Rect2(-8, -16, 16, 32), Art.rect(idx))
	nd.draw_set_transform(Vector2(0, yo))

## узлы рисунка в мире двора (по y среди людей): каждый кадр
func sync() -> void:
	if not on or c.loc_id != ("yard" if sh == "litter" else "keep") or (sh == "litter" and men.is_empty()):
		c.xnode_drop("heal_")
		return
	var P: Dictionary = c.king
	if sh == "litter":
		var hz := absf(vx) >= absf(vy)
		var f := int(pf / 7.0) % 4
		var sg := (1.0 if vx >= 0 else -1.0) if hz else (1.0 if vy >= 0 else -1.0)
		var dir := ("right" if sg > 0 else "left") if hz else ("down" if sg > 0 else "up")
		men[0].x = float(P.x) + (21.0 * sg if hz else 0.0)
		men[0].y = float(P.y) + (0.0 if hz else 19.0 * sg)
		men[1].x = float(P.x) - (21.0 * sg if hz else 0.0)
		men[1].y = float(P.y) - (0.0 if hz else 19.0 * sg)
		for i in 2:
			var m: Dictionary = men[i]
			m.dir = dir
			c.xnode("heal_m" + str(i), m.y, func(nd): _walker(nd, m.sheet, m.x, m.y, m.dir, f))
		var ks: Array = c.king.sheet
		c.xnode("heal_lit", float(P.y) + 1.0, func(nd: Node2D):
			var yo := -nd.position.y
			var x := roundf(float(P.x))
			var y := roundf(float(P.y))
			var shb: int = Art.D["shadowBig"]
			nd.draw_texture_rect_region(Art.page(shb), Rect2(x - 11, y - 3, Art.rect(shb).size.x, Art.rect(shb).size.y), Art.rect(shb))
			if hz:
				nd.draw_rect(Rect2(x - 22, y - 15, 44, 1), Color8(0x5a, 0x3a, 0x20))
				nd.draw_rect(Rect2(x - 22, y - 9, 44, 1), Color8(0x5a, 0x3a, 0x20))
				nd.draw_rect(Rect2(x - 15, y - 14, 30, 5), Color8(0xcd, 0xb9, 0x8e))
				lying(nd, ks, x + (-2.0 if sg > 0 else 2.0), y - 13, -PI / 2 if sg > 0 else PI / 2, yo)
				nd.draw_rect(Rect2(x - 14 if sg > 0 else x - 4, y - 15, 18, 6), Color8(0x7a, 0x1e, 0x2a))
				nd.draw_rect(Rect2(x - 14 if sg > 0 else x - 4, y - 10, 18, 1), Color8(0xe0, 0xa6, 0x30))
			else:
				nd.draw_rect(Rect2(x - 6, y - 34, 1, 40), Color8(0x5a, 0x3a, 0x20))
				nd.draw_rect(Rect2(x + 5, y - 34, 1, 40), Color8(0x5a, 0x3a, 0x20))
				nd.draw_rect(Rect2(x - 5, y - 28, 10, 28), Color8(0xcd, 0xb9, 0x8e))
				var idx: int = ks[0][0]
				var r := Art.rect(idx)
				nd.draw_texture_rect_region(Art.page(idx), Rect2(x - 8, y - 30, 16, 13), Rect2(r.position, Vector2(16, 13)))
				nd.draw_rect(Rect2(x - 5, y - 18, 10, 16), Color8(0x7a, 0x1e, 0x2a))
				nd.draw_rect(Rect2(x - 5, y - 18, 10, 1), Color8(0xe0, 0xa6, 0x30)))
		c.xnode_drop("heal_v")
	else:
		c.xnode_drop("heal_m")
		c.xnode_drop("heal_lit")
		for i in 2:
			if i < vis.size():
				var v: Dictionary = vis[i]
				c.xnode("heal_v" + str(i), v.y, func(nd): _walker(nd, v.sheet, v.x, v.y, v.dir, 0))
			else:
				c.xnode_drop("heal_v" + str(i))

# ---------- поверх двора: полосы кино, подпись, дни; значок раны ----------
func draw_hud(u: Variant) -> void:
	var W := 640.0
	var H := 360.0
	var bh := 24.0
	u.rect(0, 0, W, bh, "#07050a")
	u.rect(0, H - bh - 6, W, bh + 6, "#07050a")
	if sh == "days":
		var ext: int = int(fever.ext) if fever != null and int(fever.st) > 0 else 0
		var d := clampi(Game.day - d0 + 1, 1, bed + ext)
		var nT := int(JS.rnd(end_t - d0))
		var hn := sick_title() if o.get("from") == "ill" else wound_name()
		var hs := hn.substr(0, 1).to_upper() + hn.substr(1) + " · день " + str(d) + " из " + str(nT)
		var hw: float = u.tw(hs)
		var cs := Game.clock_text()
		var x0 := roundf(W / 2.0 - (96.0 + hw + u.tw(cs, "s")) / 2.0)
		u.spr_k("i_moon" if Game.is_night() else "i_sun", x0, 9)
		u.txt(hs, x0 + 8, 8, u.cc("#fff2c8"))
		u.bar(x0 + 16 + hw, 9, 70, 6, (Game.day + Game.frac - d0) / maxf(1.0, end_t - d0), "#c0353f")
		u.txt(cs, x0 + 92 + hw, 8, u.cc("#a8a0b8"), "s")
	if cap != "":
		u.txt(cap, W / 2.0, H - bh + 2, u.cc("#f0e4c8"), "m", "c")
	var lab := ("Обычно" if fast else "Быстрее") if sh == "days" else "Дальше"
	u.btn("heal_skip", W - 74, H - 24, 66, 14, {"label": lab + " ▸", "style": "dark", "tip": "Пробел", "on": func(_c): skip()})

## значок раны (healBadge): справа под верхней строкой, с подсказкой
func badge(u: Variant) -> void:
	if Sim.G.is_empty() or on:
		return
	var k: Dictionary = _k()
	if not hurt(k):
		return
	var n := int(JS.n(k.wound) - _day())
	var wn := wound_name(k)
	var s := wn + " · " + str(n) + " дн."
	var w: float = u.tw(s, "s") + 16.0
	var W := 640.0
	u.rect(W - w - 6, 22, w, 12, Color8(20, 14, 12, 204))
	u.spr_k("i_wound", W - w - 3, 25)
	u.txt(s, W - w + 5, 25, u.cc(String(Art.D.uic.bad if JS.n(k.get("woundK")) == 3 else Art.D.uic.warn)), "s")
	var wc := wn.substr(0, 1).to_upper() + wn.substr(1)
	u.hit(W - w - 6, 22, w, 12, {"id": "kwound", "tip": [wc + (": " + String(k.woundP) if JS.t(k.get("woundP")) else "") + (" (" + String(k.woundBy) + ")" if JS.t(k.get("woundBy")) else ""),
		"Заживёт через " + SimExt.dn(n) + ". До тех пор — ни охоты, ни меча, ни турнира; ходить медленнее.", "Травница в деревне и молитва в часовне ускоряют заживление."]})

func state() -> Dictionary:
	var k: Variant = SimPlayer.kingC() if not Sim.G.is_empty() else null
	return {"on": on, "sh": sh, "bed": bed, "wound": JS.n(k.get("wound")) - _day() if k != null else 0.0, "wk": JS.n(k.get("woundK")) if k != null else 0.0, "q": q != null, "cap": cap,
		"from": String(o.get("from", ""))}
