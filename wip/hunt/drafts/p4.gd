
# ---------- лук, сулицы, рогатина и сокол: прицел ловчего (E или щелчок по зверю — по шансу) ----------
func hit_chance(a: Dictionary, d: float) -> float:
	var g := game_of(a)
	var k := _k()
	var P := _P()
	var p: float = 0.85 - d / 300.0 + (float(k.get("mar", 10)) - 10.0) * 0.015 + float(g.sz)
	if a["st"] == "flee":
		p -= 0.2
	elif a["st"] == "bay":
		p += 0.25
	elif a["st"] == "charge":
		p += 0.05
	elif not a["moving"]:
		p += 0.1
	if P.moving:
		p -= 0.1
	if Hurt.hurt(k):
		p -= 0.1
	return clampf(p, 0.05, 0.95)

static func falcon_chance(a: Dictionary, d: float) -> float:
	return clampf(0.72 + (0.12 if a["st"] == "fly" else 0.0) - d / 1200.0 - (0.15 if a["kind"] == "hare" else 0.0), 0.3, 0.92)

func jav_chance(a: Dictionary, d: float) -> float:
	var g := game_of(a)
	var k := _k()
	var P := _P()
	var p: float = 0.95 - d / 110.0 + (float(k.get("mar", 10)) - 10.0) * 0.02 + float(g.sz) * 1.5
	if a["st"] == "flee":
		p -= 0.25
	elif a["st"] == "bay" or a["st"] == "lie":
		p += 0.2
	elif a["st"] == "charge":
		p += 0.1
	elif not a["moving"]:
		p += 0.08
	if P.moving:
		p -= 0.12
	if Hurt.hurt(k):
		p -= 0.15
	return clampf(p, 0.05, 0.95)

func pike_chance(a: Dictionary) -> float:
	var g := game_of(a)
	var k := _k()
	var P := _P()
	var p: float = {"lie": 0.85, "bay": 0.72, "charge": 0.5, "alert": 0.45, "graze": 0.55, "flee": 0.2}.get(a["st"], 0.4)
	p += (float(k.get("mar", 10)) - 10.0) * 0.03 - (0.12 if a["kind"] == "bear" else 0.0) + float(g.sz)
	if P.moving:
		p -= 0.15 if a["st"] == "charge" else 0.05
	if Hurt.hurt(k):
		p -= 0.15
	return clampf(p, 0.05, 0.95)

func wpn_chance(a: Dictionary, d: float, use_f: bool) -> float:
	if use_f:
		return falcon_chance(a, d)
	var w: String = HU.wpn
	return jav_chance(a, d) if w == "jav" else pike_chance(a) if w == "pike" else hit_chance(a, d)

## меткий выстрел валит сразу, иначе зверь уходит подранком (lethalP)
func lethal_p(a: Dictionary, d: float) -> float:
	var k := _k()
	return clampf(0.5 + (float(k.get("mar", 10)) - 10.0) * 0.025 + (-0.1 if a["moving"] else 0.12) + (0.15 if a["st"] == "bay" or a["st"] == "lie" else 0.0) - d / 500.0, 0.2, 0.85)

func can_shoot(a: Dictionary, d: float, use_f: bool, P: Dictionary) -> bool:
	var w: String = HU.get("wpn", "bow")
	if use_f:
		return d < 210.0
	if w == "bow":
		return int(HU.arrows) > 0 and a["st"] != "fly" and d < 150.0 and line_free(P.x, float(P.y) - 10.0, a.x, float(a.y) - 6.0)
	if a["st"] == "fly" or float(a.h) > 0.0:
		return false
	if w == "jav":
		return int(HU.jav) > 0 and d < HWPN.jav.rng and line_free(P.x, float(P.y) - 12.0, a.x, float(a.y) - 6.0)
	return d < HWPN.pike.rng

func why_not(a: Dictionary, d: float, use_f: bool) -> String:
	var w: String = "fal" if use_f else String(HU.get("wpn", "bow"))
	if w == "bow" and int(HU.arrows) <= 0:
		return "колчан пуст — возьмите сулицы или рогатину (Q)"
	if w == "jav" and int(HU.jav) <= 0:
		return "сулиц не осталось — подберите брошенные"
	if w != "fal" and (a["st"] == "fly" or float(a.h) > 0.0):
		return "в полёте — " + ("луком" if w == "bow" else "так") + " не достать"
	if d >= (210.0 if w == "fal" else float(HWPN[w].rng)):
		return "рогатиной бьют вплотную — подойдите" if w == "pike" else "далеко — подойдите ближе (Shift — красться)"
	return "мешают деревья"

func aim(P: Dictionary) -> Variant:
	var best: Variant = null
	var bs := 1e9
	var fx: float = {"left": -1.0, "right": 1.0}.get(P.dir, 0.0)
	var fy: float = {"up": -1.0, "down": 1.0}.get(P.dir, 0.0)
	for a in forest_ani():
		if a["st"] == "dead":
			continue
		var g := game_of(a)
		var d := dist(a, P)
		if d > 210.0:
			continue
		var use_f: bool = HU.kind == "falcon" and HU.get("fal") == null and (JS.t(g.get("bird")) or a["kind"] == "hare")
		if not can_shoot(a, d, use_f, P):
			continue
		var dot: float = ((float(a.x) - float(P.x)) * fx + (float(a.y) - float(P.y)) * fy) / maxf(1.0, d)
		var s := d * (1.0 if dot > 0.3 else 1.8) * (0.3 if a["st"] == "charge" else 1.0)
		if s < bs:
			bs = s
			best = {"a": a, "d": d, "useF": use_f}
	return best

static func st_word(a: Dictionary) -> String:
	var g := game_of(a)
	var f := JS.t(g.get("f"))
	if a["st"] == "lie":
		return "залегла" if f else "залёг"
	return {"graze": "не замечает вас" if JS.t(g.get("bird")) else "пасётся, не чует вас", "alert": "насторожилась" if f else "насторожился", "flee": "убегает", "bay": "гончие держат зверя", "charge": "бросается на вас!", "fly": "в полёте"}.get(a["st"], "")

## цель для «E» (huntTarget с оружием hunt2.js)
func target_of(t: Dictionary) -> Dictionary:
	var a: Dictionary = t.a
	var g := game_of(a)
	var w: String = HU.get("wpn", "bow")
	var act: String = "Пустить сокола" if t.useF else "Принять на рогатину" if w == "pike" and a["st"] == "charge" else String(HWPN[w].act)
	var sub := st_word(a) + ((", ранен" + ("а" if JS.t(g.get("f")) else "")) if JS.t(a.get("hurt")) else "")
	if JS.t(a.get("hart")):
		sub = "пощадить или взять? · " + sub
	return {"label": act + ": " + ("белый олень" if JS.t(a.get("hart")) else String(g.n)) + " · " + str(roundi(wpn_chance(a, t.d, t.useF) * 100.0)) + "%", "sub": sub, "x": a.x, "y": float(a.y) - 8.0 - float(a.h), "d": 0.5,
		"go": func() -> void: shoot(a, t.useF)}

func _face(P: Dictionary, a: Dictionary) -> void:
	face_to(P, float(a.x) - float(P.x), float(a.y) - float(P.y))
	c.path = []

## выстрел ловчего: лук (с меткостью — hunt2.js), сулица, рогатина, сокол
func shoot(a: Dictionary, use_f: bool) -> void:
	if not on() or now() < float(HU.get("cool", 0.0)) or a["st"] == "dead":
		return
	var P := _P()
	var w: String = HU.get("wpn", "bow")
	var d := dist(a, P)
	var g := game_of(a)
	var dx: float = float(a.x) - float(P.x)
	_face(P, a)
	var hn := _hn()
	if use_f:
		if HU.get("fal") != null:
			return
		HU["fal"] = {"x": P.x, "y": P.y, "h": 22.0, "st": "out", "q": a, "p": falcon_chance(a, d), "t": 0.0, "flip": dx > 0}
		HU["cool"] = now() + 0.5
		Snd.sfx("flap")
		if JS.t(g.get("bird")):
			if a["st"] != "fly":
				bird_up(a, P)
		elif a["st"] != "flee":
			game_flee(a, P)
		_say(hn, "Пошёл, пошёл!", 2)
		return
	if w == "jav":
		jav_throw(a, d)
		return
	if w == "pike":
		pike_strike(a, false)
		return
	if int(HU.arrows) <= 0:
		_toast("Колчан пуст — стрел больше нет.")
		return
	HU["arrows"] = int(HU.arrows) - 1
	HU["shots"] = int(HU.shots) + 1
	HU["cool"] = now() + 0.75
	HU["bowT"] = now()
	Snd.sfx("bow")
	var hit := randf() < hit_chance(a, d)
	var ox := 0.0 if hit else randf_range(9, 20) * (-1.0 if randf() < 0.5 else 1.0)
	var oy := 0.0 if hit else randf_range(-7, 7)
	var f := {"x0": float(P.x) + (5.0 if dx > 0 else -5.0), "y0": float(P.y) - 15.0, "tx": float(a.x) + ox, "ty": float(a.y) - 7.0 + oy, "t": 0.0, "dur": maxf(0.12, d / 380.0), "hit": hit, "a": a}
	if hit:
		f["dmg"] = 2.0 if randf() < lethal_p(a, d) else 1.0
	(HU.fl as Array).append(f)
	alarm_near(a, P)

## спугнуть пасущихся рядом (alarmNear)
func alarm_near(a: Dictionary, P: Dictionary) -> void:
	for b in forest_ani():
		if not is_same(b, a) and b["st"] == "graze" and dist(b, a) < 60.0:
			b["fx"] = P.x
			b["fy"] = P.y
			if JS.t(game_of(b).get("bird")):
				bird_up(b, P)
			else:
				b["st"] = "alert"
				b["at"] = randf_range(0.2, 0.6)

func jav_throw(a: Dictionary, d: float) -> void:
	var P := _P()
	if int(HU.jav) <= 0:
		_toast("Сулиц не осталось — подберите брошенные.")
		return
	HU["jav"] = int(HU.jav) - 1
	HU["jshots"] = int(HU.jshots) + 1
	HU["cool"] = now() + 1.1
	HU["thrT"] = now()
	Snd.sfx("swish")
	var hit := randf() < jav_chance(a, d)
	var ox := 0.0 if hit else randf_range(8, 16) * (-1.0 if randf() < 0.5 else 1.0)
	var oy := 0.0 if hit else randf_range(-6, 6)
	(HU.jf as Array).append({"x0": float(P.x) + (4.0 if float(a.x) > float(P.x) else -4.0), "y0": float(P.y) - 21.0, "tx": float(a.x) + ox, "ty": float(a.y) - 7.0 + oy, "t": 0.0, "dur": maxf(0.18, d / 240.0), "hit": hit, "a": a,
		"dmg": 3.0 if randf() < lethal_p(a, d) + 0.15 else 2.0})
	alarm_near(a, P)

func wound_beast(a: Dictionary, dmg: float, P: Dictionary) -> void:
	a["hp"] = float(a.hp) - dmg
	if float(a.hp) <= 0.0:
		kill(a, "king")
		return
	var g := game_of(a)
	a["hurt"] = 1
	if JS.t(g.get("fierce")) and dist(a, P) < 130.0 and randf() < 0.7:
		game_charge(a)
	else:
		game_flee(a, P)
	_toast("Попали! " + ("Раненая " if JS.t(g.get("f")) else "Раненый ") + String(g.n) + " ещё на ногах.")

func jav_upd(dt: float, P: Dictionary) -> void:
	var JF: Array = HU.jf
	for i in range(JF.size() - 1, -1, -1):
		var f: Dictionary = JF[i]
		var a: Dictionary = f.a
		f["t"] = float(f.t) + dt
		if f.hit and a["st"] != "dead":
			f["tx"] = a.x
			f["ty"] = float(a.y) - 7.0 - float(a.h)
		if float(f.t) < float(f.dur):
			continue
		JF.remove_at(i)
		if f.hit and a["st"] != "dead":
			HU["jhits"] = int(HU.jhits) + 1
			Snd.sfx("hit")
			wound_beast(a, f.dmg, P)
			continue
		(HU.sj as Array).append({"x": f.tx, "y": float(f.ty) + 7.0, "dx": float(f.tx) - float(f.x0), "dy": float(f.ty) - float(f.y0)})
		if a["st"] != "dead":
			if JS.t(game_of(a).get("bird")):
				if a["st"] != "fly":
					bird_up(a, P)
			elif a["st"] != "charge" and a["st"] != "bay":
				game_flee(a, P)
		if randf() < 0.6:
			_say(_hn(), _pick(["Мимо! Сулицу потом подберём.", "Эх, в землю ушла…", "Ближе, государь, ближе подпускайте!"]), 2.5)
	var SJ: Array = HU.sj
	for i in range(SJ.size() - 1, -1, -1):
		var s: Dictionary = SJ[i]
		if Vector2(float(s.x) - float(P.x), float(s.y) - float(P.y)).length() < 12.0:
			SJ.remove_at(i)
			HU["jav"] = int(HU.jav) + 1
			Snd.sfx("click")
			_toast("Сулица подобрана — их у вас " + str(HU.jav) + ".")

## рогатина: удар вплотную — или, когда зверь бросается, стоять и принять его на перекладину (pikeStrike)
func pike_strike(a: Dictionary, recv: bool) -> void:
	var P := _P()
	var g := game_of(a)
	var p := pike_chance(a) + (0.1 if recv and not P.moving else 0.0)
	var hn := _hn()
	HU["cool"] = now() + 0.9
	HU["thrT"] = now()
	HU["pk"] = int(HU.pk) + 1
	Snd.sfx("swish")
	if randf() < p:
		HU["pkh"] = int(HU.pkh) + 1
		Snd.sfx("hit")
		a["pike"] = 1
		a["hp"] = 0.0
		kill(a, "king")
		_say(hn, _pick(["На рогатину! Вот это по-королевски!", "Принял зверя, как деды принимали! Слава!"]) if JS.t(g.get("fierce")) else "Чисто взяли, государь!", 3.5)
		return
	if recv or a["st"] == "charge":
		gored(a)
		return
	if JS.t(g.get("fierce")) and randf() < 0.6:
		game_charge(a)
	else:
		game_flee(a, P)
	_say(hn, _pick(["Соскользнула! Берегитесь!", "Увернулся, зверюга!"]), 2.5)

func arrows_upd(dt: float, P: Dictionary) -> void:
	var FL: Array = HU.fl
	for i in range(FL.size() - 1, -1, -1):
		var f: Dictionary = FL[i]
		var a: Dictionary = f.a
		f["t"] = float(f.t) + dt
		if f.hit and a["st"] != "dead":
			f["tx"] = a.x
			f["ty"] = float(a.y) - 7.0 - float(a.h)
		if float(f.t) < float(f.dur):
			continue
		FL.remove_at(i)
		if f.hit and a["st"] != "dead":
			HU["hits"] = int(HU.hits) + 1
			Snd.sfx("hit")
			wound_beast(a, float(f.get("dmg", 1.0)), P)
			continue
		var ST: Array = HU.stuck
		ST.append({"x": f.tx, "y": float(f.ty) + 7.0, "dx": float(f.tx) - float(f.x0), "dy": float(f.ty) - float(f.y0), "t": now()})
		if ST.size() > 12:
			ST.pop_front()
		if a["st"] != "dead":
			if JS.t(game_of(a).get("bird")):
				if a["st"] != "fly":
					bird_up(a, P)
			elif a["st"] != "charge" and a["st"] != "bay":
				game_flee(a, P)
		if randf() < 0.6:
			_say(_hn(), _pick(["Эх, мимо!", "Чуть бы выше, государь…", "Ветер снёс, не иначе.", "Ушёл! Ничего, догоним."]), 2.5)

func falcon_upd(dt: float, P: Dictionary) -> void:
	var f: Variant = HU.get("fal")
	if f == null:
		return
	f["t"] = float(f.t) + dt
	var q: Variant = f.q
	if f.st == "out":
		if q == null or q.st == "dead" or float(f.t) > 9.0:
			f["st"] = "back"
		else:
			var dx: float = float(q.x) - float(f.x)
			var dy: float = float(q.y) - float(f.y)
			var d := Vector2(dx, dy).length()
			var st := 200.0 * dt
			f["h"] = float(f.h) + (float(q.h) + 4.0 + minf(30.0, d * 0.2) - float(f.h)) * minf(1.0, dt * 4.0)
			if d <= maxf(st, 6.0):
				if randf() < float(f.p):
					kill(q, "falcon")
					f["st"] = "kill"
					f["kt"] = 1.2
				else:
					f["st"] = "back"
					if JS.t(game_of(q).get("bird")) and q.st != "fly":
						bird_up(q, P)
					_say(_hn(), "Упустил… Ничего, вернётся на перчатку.", 2.5)
			else:
				f["x"] = float(f.x) + dx / d * st
				f["y"] = float(f.y) + dy / d * st
				f["flip"] = dx > 0
		return
	if f.st == "kill":
		f["kt"] = float(f.kt) - dt
		f["x"] = q.x
		f["y"] = q.y
		f["h"] = maxf(0.0, float(q.h) + 2.0)
		if float(f.kt) <= 0.0:
			f["st"] = "back"
		return
	var dx: float = float(P.x) - float(f.x)
	var dy: float = float(P.y) - float(f.y)
	var d := Vector2(dx, dy).length()
	var st := 170.0 * dt
	f["h"] = float(f.h) + (24.0 - float(f.h)) * minf(1.0, dt * 3.0)
	if d <= maxf(st, 8.0):
		HU["fal"] = null
		return
	f["x"] = float(f.x) + dx / d * st
	f["y"] = float(f.y) + dy / d * st
	f["flip"] = dx > 0

## зверь взят (huntKill): стрелы и сулицы из туши — назад (hunt3.js), трофей — рога, вес, белый олень (hunt2.js)
func kill(a: Dictionary, by: String) -> void:
	if HU != null and a["st"] != "dead":
		if int(a.get("arw", 0)) > 0 and HU.has("ar"):
			HU["arrows"] = int(HU.arrows) + int(a.arw)
		if int(a.get("jv", 0)) > 0 and HU.has("jf"):
			HU["jav"] = int(HU.jav) + int(a.jv)
	a["arw"] = 0
	a["jv"] = 0
	var g := game_of(a)
	a["st"] = "dead"
	a["moving"] = false
	a["fly"] = 0.0
	a["zig"] = false
	a["pth"] = null
	if HU == null:
		return
	var b := {"k": gk(a), "by": by}
	(HU.bag as Array).append(b)
	if HU.get("quarry") != null and is_same(HU.quarry, a):
		HU["quarry"] = null
	Snd.sfx("thud")
	var ts: String = ("Сражена " if JS.t(g.get("f")) else "Сражён ") + String(g.n) + String({"hounds": " — гончие взяли!", "falcon": " — сокол не промахнулся!", "hunter": " — ловчий не сплоховал!", "comp": " — меткая стрела спутника!"}.get(by, "!"))
	var hn := _hn()
	if by == "king":
		_say(hn, _pick(["Славный выстрел, государь!", "Вот это рука! Прямо под лопатку.", "Хорош! Будет что рассказать за столом."]), 3.5)
	if by == "hounds":
		_say(hn, "Ату его! Молодцы, собачки!", 3)
	var x: Array = []
	if JS.t(a.get("hart")):
		b["hart"] = 1
		x.append("белый олень")
	if a["kind"] == "deer" and a["col"] != "doe":
		b["pts"] = c.fa_pts(a)
		x.append("рога в " + tines(b.pts))
	if a["kind"] == "boar":
		if not a.has("wt"):
			a["wt"] = randi_range(4, 9)
		b["wt"] = a.wt
		x.append(("матёрый секач, " if int(b.wt) >= 7 else "") + poods(b.wt))
	if a["kind"] == "bear":
		if not a.has("wt"):
			a["wt"] = randi_range(10, 18)
		b["wt"] = a.wt
		x.append(poods(b.wt))
	if JS.t(a.get("pike")):
		b["pike"] = 1
		x.append("взят на рогатину")
	_toast(ts + ((" " + ucf(", ".join(x)) + ".") if not x.is_empty() else ""))

func wpn_next() -> void:
	if not on():
		return
	HU["draw"] = null
	HU["wpn"] = HWPN_ORD[(HWPN_ORD.find(HU.wpn) + 1) % 3]
	Sim.G.court["huntWpn"] = HU.wpn
	HU["aim"] = null
	Snd.sfx("click")
	_toast({"bow": "В руках лук: стрел — " + str(HU.arrows) + ". Бьёт далеко, шагов на 150.", "jav": "В руках сулицы: " + str(HU.jav) + " шт. Бросок ближе лука, зато бьёт сильнее; промах можно подобрать.", "pike": "В руках рогатина: бить вплотную. Бросится кабан — стойте на месте и примите его на рогатину."}[HU.wpn])
