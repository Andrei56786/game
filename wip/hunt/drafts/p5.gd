
# ---------- свой лук (hunt3.js): зажать — натянуть, навести мышью, отпустить; стрела летит по шагам — дичь, люди, деревья ----------
func own() -> bool:
	return on() and not JS.t(Sim.G.court.get("huntAuto")) and (HU.wpn == "bow" or HU.wpn == "jav")

static func draw_k(D: Variant, t: float) -> float:
	return 0.0 if D == null else clampf((t - float(D.t0)) / float(HBOW[D.w].tf), 0.0, 1.0)

## разброс (радианы в обе стороны): рука короля, натяг, ходьба, рана, годы — и дрожь, если держать слишком долго
func aim_spread(D: Dictionary) -> float:
	var k := _k()
	var P := _P()
	var k1 := draw_k(D, now())
	var held: float = now() - float(D.t0) - float(HBOW[D.w].tf) - 1.6
	var s: float = (0.1 - (float(k.get("mar", 10)) - 10.0) * 0.004) * (1.7 - 0.7 * k1) * float(HBOW[D.w].sp)
	if P.moving:
		s += 0.04 if c.sneak else 0.08
	if Hurt.hurt(k):
		s += 0.04
	if float(k.get("age", 30)) > 55:
		s += 0.02
	if held > 0.0:
		s += minf(0.14, held * 0.06)
	return clampf(s, 0.03, 0.4)

func aim_pt() -> Vector2:
	var P := _P()
	var m: Vector2 = c.hud.get_local_mouse_position()
	if m.x < 0 or m.y < 0 or m.x > c.hud.size.x or m.y > c.hud.size.y:
		var v: Array = DIRV.get(P.dir, [1.0, 0.0])
		return Vector2(float(P.x) + v[0] * 120.0, float(P.y) - 14.0 + v[1] * 120.0)
	return c.cam_tl + m / c.Z

func draw_start() -> void:
	var w: String = HU.wpn
	if HU.get("draw") != null or now() < float(HU.get("cool", 0.0)) or float(_P().get("downT", 0.0)) > now():
		return
	if w == "bow" and int(HU.arrows) <= 0:
		_toast("Колчан пуст — подберите стрелы, что легли мимо, или возьмите сулицы (Q).")
		HU["cool"] = now() + 1.0
		return
	if w == "jav" and int(HU.jav) <= 0:
		_toast("Сулиц не осталось — подберите брошенные.")
		HU["cool"] = now() + 1.0
		return
	HU["draw"] = {"t0": now(), "w": w}
	c.path = []
	c.on_arrive = Callable()
	if w == "bow":
		Snd.sfx("draw")

func draw_loose(cancel: bool) -> void:
	var D: Variant = HU.get("draw")
	if D == null:
		return
	HU["draw"] = null
	HU["drawEnd"] = now()
	var k1 := draw_k(D, now())
	if cancel or k1 < 0.25:
		if not cancel:
			_toast("Тетива едва натянута — держите кнопку дольше." if D.w == "bow" else "Замах слишком слабый — держите кнопку дольше.")
		return
	var P := _P()
	var ap := aim_pt()
	var ox: float = P.x
	var oy: float = float(P.y) - 14.0
	var an := atan2(ap.y - oy, ap.x - ox) + (randf() + randf() - 1.0) * aim_spread(D)
	face_to(P, ap.x - ox, ap.y - oy)
	launch({"x": ox, "y": oy, "an": an, "k": k1, "w": D.w, "by": "king"})

func launch(o: Dictionary) -> void:
	var B: Dictionary = HBOW[o.w]
	(HU.ar as Array).append({"x": o.x, "y": o.y, "x0": o.x, "y0": o.y, "ux": cos(o.an), "uy": sin(o.an), "sp": float(B.v0) + float(B.v1) * float(o.k), "s": 0.0, "max": float(B.r0) + float(B.r1) * float(o.k),
		"w": o.w, "k": o.k, "by": o.by, "who": o.get("who", ""), "near": 0, "done": 0})
	if o.by != "king":
		Snd.sfx("bow")
		return
	HU["cool"] = now() + (0.4 if o.w == "bow" else 0.8)
	if o.w == "bow":
		HU["arrows"] = int(HU.arrows) - 1
		HU["shots"] = int(HU.shots) + 1
		HU["bowT"] = now()
		Snd.sfx("bow")
	else:
		HU["jav"] = int(HU.jav) - 1
		HU["jshots"] = int(HU.jshots) + 1
		HU["thrT"] = now()
		Snd.sfx("swish")

## рамка зверя в мире (aBox): по кадру 0
func a_box(a: Dictionary) -> Array:
	var s: Vector2 = c.fa_box(a)
	var hw := s.x * 0.42
	var h: float = a.h
	return [float(a.x) - hw, float(a.y) - h - s.y + 2.0, float(a.x) + hw, float(a.y) - h]

## чуть позади передней ноги и пониже: сердце и лёгкие
static func vital(a: Dictionary, b: Array, x: float, y: float) -> bool:
	if JS.t(game_of(a).get("bird")):
		return true
	var w: float = b[2] - b[0]
	var h: float = b[3] - b[1]
	var cx: float = (b[0] + b[2]) / 2.0 + (1.0 if a.flip else -1.0) * w * 0.12
	return absf(x - cx) < w * 0.2 and y > b[1] + h * 0.3 and y < b[1] + h * 0.85

static func vital_ray(a: Dictionary, b: Array, f: Dictionary) -> bool:
	var x: float = f.x
	var y: float = f.y
	var i := 0
	while i < 60 and x >= b[0] - 1 and x <= b[2] + 1 and y >= b[1] - 1 and y <= b[3] + 1:
		if vital(a, b, x, y):
			return true
		i += 1
		x += float(f.ux)
		y += float(f.uy)
	return false

func ar_upd(dt: float, P: Dictionary) -> void:
	var AR: Array = HU.ar
	for i in range(AR.size() - 1, -1, -1):
		var f: Dictionary = AR[i]
		var st: float = float(f.sp) * dt
		while st > 0.0 and not JS.t(f.done):
			var d := minf(3.0, st)
			st -= d
			f["x"] = float(f.x) + float(f.ux) * d
			f["y"] = float(f.y) + float(f.uy) * d
			f["s"] = float(f.s) + d
			ar_step(f, P)
		if JS.t(f.done):
			AR.erase(f)

func ar_step(f: Dictionary, P: Dictionary) -> void:
	var L := _L()
	for a in forest_ani():
		if a["st"] == "dead":
			continue
		var b := a_box(a)
		if f.x >= b[0] and f.x <= b[2] and f.y >= b[1] and f.y <= b[3]:
			f["done"] = 1
			ar_hit(f, a, b, P)
			return
		if (a["st"] == "graze" or a["st"] == "alert") and f.x > b[0] - 16 and f.x < b[2] + 16 and f.y > b[1] - 12 and f.y < b[3] + 10:   # свист стрелы рядом
			if JS.t(game_of(a).get("bird")):
				bird_up(a, {"x": f.x0, "y": f.y0})
			else:
				game_flee(a, {"x": f.x0, "y": f.y0})
	if float(f.s) > 12.0:
		if f.by != "king" and absf(float(f.x) - float(P.x)) < 5.0 and float(f.y) > float(P.y) - 27.0 and float(f.y) < float(P.y) - 3.0 and not (float(P.get("downT", 0.0)) > now()):
			f["done"] = 1
			stray_hit(f, P)
			return
		if f.by == "king" and not JS.t(f.near):
			for n in c.npcs:
				if JS.t(n.get("follow")) and n["loc"] == "forest" and absf(float(f.x) - float(n.x)) < 6.0 and float(f.y) > float(n.y) - 27.0 and float(f.y) < float(n.y) - 2.0:
					f["near"] = 1
					near_miss(n)
					break
	var h: float = 14.0 * (1.0 - float(f.s) / float(f.max))
	var tx := floori(float(f.x) / CT)
	var ty := floori((float(f.y) + h) / CT)
	if tx < 0 or ty < 0 or tx >= int(L.w) or ty >= int(L.h):
		f["done"] = 1
		return
	var wet: bool = c.ter_at("forest", tx, ty) == 7
	if _solid(tx, ty) and not wet and float(f.s) > 8.0:
		f["done"] = 1
		ar_stick(f, h, true)
		return
	if float(f.s) >= float(f.max):
		f["done"] = 1
		if wet:
			for i in 5:
				c.parts.append({"k": "dust", "x": float(f.x) + randf_range(-2, 2), "y": f.y, "vx": randf_range(-8, 8), "vy": -10.0, "t": 0.0, "life": 0.4})
			Snd.sfx("swish")
		else:
			ar_stick(f, 0.0, false)

func ar_hit(f: Dictionary, a: Dictionary, b: Array, P: Dictionary) -> void:
	var g := game_of(a)
	var vit := vital_ray(a, b, f)
	var base: float = 2.0 if f.w == "jav" else 1.0 if float(f.k) >= 0.85 else 0.75 if float(f.k) >= 0.55 else 0.5
	var dmg := base * (2.0 if vit else 1.0)
	Snd.sfx("hit")
	if f.w == "bow":
		a["arw"] = mini(4, int(a.get("arw", 0)) + 1)
	else:
		a["jv"] = int(a.get("jv", 0)) + 1
	if f.by != "king":
		a["hp"] = float(a.hp) - dmg
		var cn: Dictionary = c.npc_by(String(f.who)) if String(f.who) != "" else {}
		if float(a.hp) <= 0.0:
			kill(a, "comp")
			_say(cn, _pick(["Есть! Видели, государь?", "Попал! Попал!", "Вот это выстрел!"]), 3)
			return
		a["hurt"] = 1
		if JS.t(g.get("fierce")) and not cn.is_empty() and dist(a, cn) < 110.0 and randf() < 0.5:
			game_charge(a)
		else:
			game_flee(a, {"x": f.x0, "y": f.y0})
		return
	if f.w == "bow":
		HU["hits"] = int(HU.hits) + 1
	else:
		HU["jhits"] = int(HU.jhits) + 1
	wound_beast(a, dmg, P)
	if a["st"] == "dead":
		return
	if vit:
		_toast("Под лопатку! " + ("Раненая " if JS.t(g.get("f")) else "Раненый ") + String(g.n) + " ещё на ногах — но далеко не уйдёт.")
	elif base < 1.0 and f.w == "bow":
		_toast("Тетива была натянута вполсилы — стрела вошла неглубоко.")
	elif float(a.hp) > 0.0 and float(g.hp) >= 4.0 and not JS.t(HU.get("toughSaid")):
		HU["toughSaid"] = 1
		_say(_hn(), "Шкура толстая, государь: одной стрелой " + g_acc(gk(a)) + " не взять. Бейте под лопатку!", 4)

func ar_stick(f: Dictionary, h: float, tree: bool) -> void:
	var gx: float = f.x
	var gy: float = float(f.y) + h
	if f.w == "jav":
		(HU.sj as Array).append({"x": gx, "y": gy, "dx": f.ux, "dy": f.uy})
	else:
		var SA: Array = HU.sa
		SA.append({"x": gx, "y": gy, "h": h, "ux": f.ux, "uy": f.uy, "tree": tree, "t": now()})
		if SA.size() > 40:
			SA.pop_front()
	if tree:
		Snd.sfx("stick")
	for b in forest_ani():
		if b["st"] == "graze" and Vector2(float(b.x) - gx, float(b.y) - gy).length() < 50.0:
			b["fx"] = f.x0
			b["fy"] = f.y0
			if JS.t(game_of(b).get("bird")):
				bird_up(b, {"x": f.x0, "y": f.y0})
			else:
				b["st"] = "alert"
				b["at"] = randf_range(0.3, 0.8)
				b["flip"] = float(f.x0) > float(b.x)
	var hn := _hn()
	if f.by == "king" and not hn.is_empty() and not _bub(hn) and not JS.t(HU.get("split")) and randf() < 0.35:
		_say(hn, _pick(["Мимо, государь!", "Ушла стрела… Подберём потом.", "В дерево! Стреляйте, где чисто." if tree else "Ниже бери, государь, — стрела над спиной прошла.", "Ведите стрелу перед зверем, коли бежит."]), 2.4)

func near_miss(n: Dictionary) -> void:
	if n["key"] == "srv_hunter":
		_say(n, _pick(["Государь! Я же не олень!", "Эй! Своих не бейте!"]), 2.5)
	else:
		_say(n, _pick(["Ах! Осторожнее, государь!", "Стрела у самого уха!"]), 2.5)
	_toast("Стрела свистнула над головой спутника. Осторожнее!")

func pick_up(P: Dictionary) -> void:
	var SA: Array = HU.sa
	for i in range(SA.size() - 1, -1, -1):
		var s: Dictionary = SA[i]
		if Vector2(float(s.x) - float(P.x), float(s.y) - float(P.y)).length() > 12.0:
			continue
		SA.remove_at(i)
		if randf() < 0.78:
			HU["arrows"] = int(HU.arrows) + 1
			Snd.sfx("click")
			_toast("Стрела подобрана — в колчане " + str(HU.arrows) + ".")
		else:
			_toast("Наконечник засел в стволе — стрелу не вытащить." if s.tree else "Стрела сломалась.")

# ---------- лук спутника: помогает по бегущему, бросившемуся или у бая — и порой стреляет, когда не следует ----------
func comp_shoot(P: Dictionary) -> void:
	var cn: Dictionary = c.npc_by(String(HU.comp)) if HU.comp != null else {}
	var cc: Variant = c.people.real(cn) if not cn.is_empty() else null
	if cc == null or cn["loc"] != "forest" or float(cc.get("age", 30)) < 14 or now() < float(HU.get("cShot", 0.0)) or float(P.get("downT", 0.0)) > now():
		return
	HU["cShot"] = now() + randf_range(1.5, 3)
	var best: Variant = null
	var bd := 140.0
	for a in forest_ani():
		if a["st"] == "dead" or JS.t(game_of(a).get("bird")) or not (a["st"] in ["flee", "bay", "charge", "lie"]):
			continue
		var d := dist(a, cn)
		if d < bd and d > 24.0 and line_free(cn.x, float(cn.y) - 10.0, a.x, float(a.y) - 6.0):
			bd = d
			best = a
	if best == null or not randf() < 0.45:
		return
	var ox: float = cn.x
	var oy: float = float(cn.y) - 14.0
	var an := atan2(float(best.y) - 8.0 - oy, float(best.x) - ox)
	var ux := cos(an)
	var uy := sin(an)
	var kx: float = float(P.x) - ox
	var ky: float = float(P.y) - 14.0 - oy
	var along := kx * ux + ky * uy
	var perp := absf(-kx * uy + ky * ux)
	if along > 0 and along < bd + 30.0 and perp < 14.0:
		var eager := (0.16 if JS.t(HU.get("split")) else 0.08) * (2.0 if float(cc.get("loy", 50)) < 35 else 1.0)
		if not randf() < eager:
			if randf() < 0.3:
				_say(cn, "Отойдите, государь, — не выстрелить!", 2)
			return
	var sp := clampf(0.13 - (float(cc.get("mar", 8)) - 10.0) * 0.006, 0.05, 0.2)
	face_to(cn, ux, uy)
	launch({"x": ox, "y": oy, "an": an + (randf() + randf() - 1.0) * sp, "k": 0.9, "w": "bow", "by": "comp", "who": cn["key"]})
	HU["cShot"] = now() + randf_range(6, 11)
	HU["cs"] = int(HU.get("cs", 0)) + 1

# ---------- беды: шальная стрела, олень у бая, падение в погоне (бросок кабана — в charge_upd) ----------
func mishap(sev: int, part: String, by: String, t1: String, t2: String) -> void:
	if not on():
		return
	var P := _P()
	var days := Hurt.wound_king(sev, part, by)
	P["downT"] = now() + (1.4 if sev == 1 else 2.4)
	P["moving"] = false
	c.path = []
	c.on_arrive = Callable()
	flash = now()
	Snd.sfx("thud")
	HU["hurtN"] = int(HU.get("hurtN", 0)) + 1
	HU["draw"] = null
	if not JS.t(HU.get("split")):
		_say(_hn(), "Цел, государь? Вставайте!" if sev == 1 else "Государь ранен! Сюда, живо!", 3)
	if sev == 1:
		_toast(t1)
		return
	HU["wound"] = days
	var t := t2 + (" Рана тяжёлая: лекарь ничего не обещает." if sev == 3 else " Заживёт — дней за " + str(days) + ".")
	pend = {"t": now() + 2.2, "f": func() -> void: c.hud.say(null, t, {"name": "Беда на охоте", "choices": [{"t": "Домой, на носилках", "fx": func() -> void: end_hunt("wound")}], "esc": 0})}

func stray_hit(f: Dictionary, P: Dictionary) -> void:
	var k := _k()
	var cn: Dictionary = c.npc_by(String(f.who)) if String(f.who) != "" else {}
	var cc: Variant = c.people.real(cn) if not cn.is_empty() else null
	var nm: String = String(cn.get("name", "Кто-то из свиты")) if not cn.is_empty() else "Кто-то из свиты"
	var fe := "а" if cc != null and JS.t(cc.get("fem")) else ""
	var r := randf() + (0.05 if float(k.get("age", 30)) > 50 else 0.0)
	var sev := 1 if r < 0.45 else 2 if r < 0.88 else 3
	var part: String = _pick(["грудь", "бок"]) if sev == 3 else _pick(["плечо", "руку", "бедро"])
	if sev == 3:
		k["woundFv"] = 0.6
	Snd.sfx("hit")
	mishap(sev, part, "шальная стрела", "Стрела бьёт в рукав и застревает в сукне! " + nm + " бледнеет: «Простите, государь, я метил" + fe + " в зверя!»",
		"Шальная стрела! " + nm + " стрелял" + fe + " в зверя — и попал" + fe + " в вас: наконечник вошёл в " + part + ".")
	if cc != null:
		cc["loy"] = clampf(float(cc.get("loy", 50)) + (6.0 if sev > 1 else 2.0), 0.0, 100.0)
		_say(cn, "Государь! Нет, нет… Лекаря!" if sev > 1 else "Простите, государь! Сам" + ("а" if fe != "" else "") + " не знаю, как…", 3)

func stag_lunge(a: Dictionary, P: Dictionary) -> void:
	var k := _k()
	var r := randf() + (0.1 if float(k.get("age", 30)) > 50 else 0.0)
	var sev := 1 if r < 0.55 else 2 if r < 0.93 else 3
	var part: String = "живот" if sev == 3 else _pick(["бок", "бедро", "руку"])
	a["flip"] = float(P.x) > float(a.x)
	Snd.sfx("growl")
	mishap(sev, part, "олень", "Олень бьёт рогами — вы отлетаете в траву. Ушиб, не более.", "Прижатый гончими олень бросается на вас: рога поддевают за пояс и швыряют наземь — отросток вспарывает " + part + ".")

func chase_fall() -> void:
	var k := _k()
	var r := randf() + (0.05 if float(k.get("age", 30)) > 50 else 0.0)
	var sev := 1 if r < 0.8 else 2 if r < 0.97 else 3
	var part: String = "голову" if sev == 3 else _pick(["колено", "лоб", "локоть"])
	mishap(sev, part, "падение", "В погоне вы спотыкаетесь о корень и летите в папоротник. Ушиб.",
		"В погоне вы срываетесь в овраг и бьётесь головой о корень. Ловчие приводят вас в чувство не сразу." if sev == 3 else "В погоне вы срываетесь в овраг и рассекаете " + part + " о камни.")
