
# ---------- разделиться (hunt3.js): ловчий с гончими уходит к дальней поляне, поднимает зверя и трубит ----------
func split_pick(P: Dictionary, skip: Array) -> int:
	var want: Array = ["boar", "bear"] if HU.kind == "boar" else ["deer", "doe"] if HU.kind == "deer" else ["hare", "fox", "pheasant"]
	var best := -1
	var bs := -1e9
	var CL: Array = _L()["clearings"]
	for i in CL.size():
		if i == 0 or i in skip:
			continue
		var cl: Array = CL[i]
		var cx := float(cl[0]) * CT + 8.0
		var cy := float(cl[1]) * CT + 8.0
		var d := Vector2(cx - float(P.x), cy - float(P.y)).length()
		if d < 220.0:
			continue
		var n := 0
		for a in forest_ani():
			if a["st"] != "dead" and gk(a) in want and Vector2(float(a.x) - cx, float(a.y) - cy).length() < 150.0:
				n += 1
		var s := n * 3.0 - d / 300.0 + randf()
		if s > bs:
			bs = s
			best = i
	return best

## имя места леса (roomName по лесу, где бы ни был король)
func _room_at(tx: int, ty: int) -> String:
	var L := _L()
	for r in L["rooms"]:
		if tx >= r[0] and tx <= r[2] and ty >= r[1] and ty <= r[3]:
			return r[4]
	return L["name"]

func cl_name(i: int) -> String:
	var cl: Array = _L()["clearings"][i]
	return _room_at(int(cl[0]), int(cl[1]))

func split_start() -> void:
	var hn := _hn()
	if not on() or HU.get("split") != null or hn.is_empty():
		return
	if not any_hound():
		_toast("Гончих нет — разделяться не с кем.")
		return
	var P := _P()
	var ci := split_pick(P, [])
	if ci < 0:
		_say(hn, "Тут и так всё рядом, государь.", 3)
		return
	HU["split"] = {"st": "go", "ci": ci, "t": now(), "tried": [ci], "hornT": 0.0, "hornAt": -9.0}
	hn["path"] = null
	var nm := cl_name(ci)
	var cl: Array = _L()["clearings"][ci]
	_say(hn, "Добро, государь. Я с гончими — к «" + nm + "». Подниму зверя — протрублю. Идите на рог!", 5)
	Snd.sfx("bark")
	_toast("Ловчий с гончими уходит " + dir_word(float(cl[0]) * CT - float(P.x), float(cl[1]) * CT - float(P.y)) + ", к «" + nm + "». G — протрубить, чтобы вернулся.")

func split_q() -> Variant:
	for a in c.ani:
		if int(a["game"]) == 2 and a["loc"] == "forest" and a["st"] == "chase" and a.get("q") != null and a.q.st != "dead" and a.q.st != "fly":
			return a.q
	return null

func split_end(hn: Dictionary, q: Variant) -> void:
	HU["split"] = null
	if not hn.is_empty():
		hn["path"] = null
		hn["moving"] = false      # в Godot «идёт» = moving или path: после splitMove сбросить
		_say(hn, ("Вот он, государь! Держат — бейте!" if q.st == "bay" else "Гоним, государь! За мной!") if q != null else "Вот и вы, государь. Дальше — вместе.", 3.5)

func split_call() -> void:
	var S: Variant = HU.get("split") if HU != null else null
	if S == null or S.st == "back":
		return
	S["st"] = "back"
	Snd.sfx("horn")
	_toast("Вы трубите в рог: ловчий с гончими возвращается.")
	var hn := _hn()
	if not hn.is_empty():
		hn["path"] = null

func split_key() -> void:
	if not on():
		return
	if HU.get("split") != null:
		split_call()
	else:
		split_start()

func split_word() -> String:
	var S: Variant = HU.get("split")
	var P := _P()
	var hn := _hn()
	if hn.is_empty():
		return "Без ловчего"
	if S == null:
		return "Ловчий рядом  ·  G — разделиться"
	var dw := dir_word(float(hn.x) - float(P.x), float(hn.y) - float(P.y))
	var q: Variant = split_q() if S.st == "drive" else null
	if S.st == "back":
		return "Ловчий возвращается — " + dw
	if q != null:
		return "Рог! Гончие " + ("держат " if q.st == "bay" else "гонят ") + g_acc(gk(q)) + " — " + dw
	return "Ловчий " + ("идёт к" if S.st == "go" else "ищет у") + " «" + cl_name(int(S.ci)) + "» — " + dw + "  ·  G — созвать"

func split_upd(P: Dictionary) -> void:
	var S: Variant = HU.get("split")
	if S == null:
		return
	var hn := _hn()
	if hn.is_empty():
		HU["split"] = null
		return
	var dk := dist(hn, P)
	var q: Variant = null if S.st == "back" else split_q()
	if dk < 100.0 and now() - float(S.t) > 4.0:
		split_end(hn, q)
		return
	if q != null:
		S["st"] = "drive"
		if now() > float(S.hornT):
			S["hornT"] = now() + (7.0 if q.st == "bay" else 10.0)
			S["hornAt"] = now()
			Snd.sfx("horn_short")
			_toast("Рог ловчего — " + dir_word(float(hn.x) - float(P.x), float(hn.y) - float(P.y)) + ": гончие " + ("держат " if q.st == "bay" else "гонят ") + g_acc(gk(q)) + "!")
		if q.st == "bay" and not JS.t(q.get("sB")):
			q["sB"] = 1
			q["bt"] = float(q.get("bt", 0.0)) + randf_range(7, 10)
		return
	if S.st == "drive":
		S["st"] = "search"
		S["t2"] = now()
	if S.st == "go":
		var cl: Array = _L()["clearings"][S.ci]
		if Vector2(float(hn.x) - float(cl[0]) * CT - 8.0, float(hn.y) - float(cl[1]) * CT - 12.0).length() < 56.0 or now() - float(S.t) > 90.0:
			S["st"] = "search"
			S["t2"] = now()
	if S.st == "search" and now() - float(S.t2) > 26.0:
		var ci := split_pick(P, S.tried) if (S.tried as Array).size() < 3 else -1
		hn["path"] = null
		Snd.sfx("horn_low")
		S["hornAt"] = now()
		if ci >= 0:
			S["ci"] = ci
			(S.tried as Array).append(ci)
			S["st"] = "go"
			S["t"] = now()
			_toast("Ловчий трубит коротко: здесь пусто, идёт дальше — к «" + cl_name(ci) + "».")
		else:
			S["st"] = "back"
			_toast("Ловчий трубит отбой поиску: зверя не нашёл, возвращается к вам.")

# ---------- выезд: почему нельзя (huntWhyNot + sick2.js), псарня (huntAct), спутник (huntComp), начало (huntStart) ----------
func why_hunt_not() -> Variant:
	var k := _k()
	var h := Game.hour_abs()
	var C: Dictionary = Sim.G.court
	var w := _wk()
	if Hurt.hurt(k):
		var n := int(JS.n(k.wound) - _day())
		return Hurt.wound_not(k) + ", государь. Лекарь велел беречься — ещё " + str(n) + " " + Sim.plural(n, "день", "дня", "дней") + "."
	if C.get("huntDay") != null and JS.n(C.huntDay) == _day():
		return "Собаки сегодня уже набегались, государь. Завтра на рассвете — хоть на медведя!"
	if h < 6.0:
		return "Ещё темно, государь. Выедем с рассветом, к шести."
	if h >= 16.0:
		return "Поздно, государь: до темноты зверя не поднять. Завтра с утра."
	if w == "storm" or w == "blizzard":
		return "В такую непогоду собаки след не возьмут, государь. Переждём."
	var s: String = Hurt.sick_not(k)
	if s != "":
		return s + ". Охота подождёт."
	return null

func act() -> void:
	if HU != null or JS.t(Sim.G.get("visit")):
		return
	var hn := _hn()
	var who: Variant = hn if not hn.is_empty() else null
	var o := {} if who != null else {"name": "Псарня"}
	var why: Variant = why_hunt_not()
	if why != null:
		c.hud.say(who, why, o)
		print("HUNT NOT ", why)
		return
	var ch: Array = [{"t": String(HUNTK.deer.n) + " — с гончими", "tip": HUNTK.deer.d, "fx": func() -> void: comp("deer")},
		{"t": String(HUNTK.boar.n) + " (опасно)", "tip": HUNTK.boar.d, "fx": func() -> void: comp("boar")}]
	if SimDyn.projDone("falconry"):
		ch.append({"t": HUNTK.falcon.n, "tip": HUNTK.falcon.d, "fx": func() -> void: comp("falcon")})
	else:
		ch.append({"t": HUNTK.falcon.n, "tip": "Нужна соколятня — её можно заложить у стола зодчего (P).", "ok": func() -> bool: return false,
			"why": "Сначала постройте соколятню (P — замыслы и стройки).", "fx": func() -> void: pass})
	ch.append({"t": "Не сегодня", "fx": func() -> void: pass})
	o["choices"] = ch
	o["esc"] = ch.size() - 1
	c.hud.say(who, _pick(["Гончие застоялись, государь! На кого пойдём?", "Кони осёдланы, собаки на сворах. Куда прикажете?", "Лес нынче полон зверя, государь. Выбирайте."]), o)
	print("HUNT MENU ", ch.size())

func comp_name(n: Dictionary) -> String:
	var ch: Variant = c.people.real(n)
	var nm: String = String(ch.name) if ch != null else String(n.get("name", ""))
	if String(n.get("seat", "")) != "":
		return String(n.name)            # npcTitle: «Маршал: …»
	if String(n.key).begins_with("ward"):
		return "Воспитанник: " + nm
	return SimDyn.famRole(ch) + ": " + nm

func comp(kind: String) -> void:
	var cand: Array = []
	var sp := c.npc_by("spouse")
	var spc: Variant = c.people.real(sp) if not sp.is_empty() else null
	if spc != null and JS.t(spc.alive) and JS.n(spc.get("prison", -1)) < 0:
		cand.append(sp)
	for n in c.npcs:
		var ch: Variant = c.people.real(n)
		if ch != null and (String(n.key).begins_with("kid") or String(n.key).begins_with("ward")) and JS.n(ch.age) >= 14 and JS.n(ch.get("prison", -1)) < 0:
			cand.append(n)
	for s in SEATS:
		var n := c.npc_by("seat_" + s)
		var ch: Variant = c.people.real(n) if not n.is_empty() else null
		if ch != null and JS.n(ch.get("prison", -1)) < 0:
			cand.append(n)
	var ch2: Array = []
	for n in cand.slice(0, 5):
		var nn: Dictionary = n
		ch2.append({"t": comp_name(nn), "tip": "Расположение +4…8" + (", и день вместе" if nn.key == "spouse" else "") + ".", "fx": func() -> void: start(kind, nn)})
	ch2.append({"t": "Без свиты — только ловчий и собаки", "fx": func() -> void: start(kind, {})})
	var hn := _hn()
	c.hud.say(hn if not hn.is_empty() else null, "Кого возьмёте с собой, государь?", {"choices": ch2, "esc": ch2.size() - 1})

func start(kind: String, comp_n: Dictionary) -> void:
	if HU != null:
		return
	var C: Dictionary = Sim.G.court
	C["huntDay"] = _day()
	HU = {"kind": kind, "day": Game.day, "arrows": 15, "bag": [], "comp": String(comp_n.key) if not comp_n.is_empty() else null, "shots": 0, "hits": 0,
		"fl": [], "stuck": [], "fal": null, "aim": null, "quarry": null, "cool": 0.0, "sayT": now() + 7.0, "ended": 0,
		"wpn": String(JS.o(C.get("huntWpn"), "bow")), "jav": 4, "jf": [], "sj": [], "blood": [], "jshots": 0, "jhits": 0, "pk": 0, "pkh": 0, "windT": now() + 9.0,
		"ar": [], "sa": [], "draw": null, "split": null, "t0": now(), "cShot": now() + 8.0}
	print("HUNT START ", kind, " ", HU.comp)
	c.fade_to(func() -> void: _start_fade(kind, comp_n))

func _start_fade(kind: String, comp_n: Dictionary) -> void:
	var sp: Dictionary = _L()["spots"]["f_gate"]
	var P := _P()
	c.go_loc("forest")
	P["x"] = float(sp.x)
	P["y"] = float(sp.y)
	P["dir"] = "right"
	P["sit"] = null
	P["lie"] = false
	c.path = []
	c.on_arrive = Callable()
	fauna(kind)
	var fol: Array = []
	var hn := _hn()
	if not hn.is_empty():
		fol.append(hn)
	if not comp_n.is_empty():
		fol.append(comp_n)
	for i in fol.size():
		var n: Dictionary = fol[i]
		n["follow"] = true
		n["hold"] = true
		n["away"] = false
		n["sit"] = null
		n["lie"] = false
		n["goal"] = null
		n["path"] = null
		n["loc"] = "forest"
		n["dir"] = "right"
		n["bub"] = ""
		n["x"] = float(sp.x) - 12.0 - i * 10.0
		n["y"] = float(sp.y) + (-16.0 if i else 16.0)
	var hs: Array = c.ani.filter(func(a): return a["kind"] == "hound")
	for i in mini(hs.size(), 2 if kind == "falcon" else 3):
		var a: Dictionary = hs[i]
		a["game"] = 2
		a["loc"] = "forest"
		a["st"] = "heel"
		a["q"] = null
		a["pth"] = null
		a["moving"] = false
		a["oa"] = i * 2.1
		a["x"] = float(sp.x) + 20.0 + i * 10.0
		a["y"] = float(sp.y) + (i - 1) * 10.0
	c.snap_cam()
	c.parts.clear()
	c.room = ""
	Snd.sfx("horn")
	_toast(String(HUNTK[kind].n) + ": в королевский лес!")

# ---------- ловчий: подсказки (huntHint + подранок hunt2.js), разговор (hunt3.js), болтовня ----------
func hint() -> String:
	if HU == null:
		return ""
	var P := _P()
	var w: Variant = null
	var wd := 1e9
	for a in forest_ani():
		if JS.t(a.get("hurt")) and a["st"] != "dead":
			var d := dist(a, P)
			if d < wd:
				wd = d
				w = a
	if w != null:
		var g := game_of(w)
		var f := JS.t(g.get("f"))
		return ((("Залегла раненая " if f else "Залёг раненый ") + String(g.n)) if w.st == "lie" else "Кровь на траве, государь: " + ("раненая " if f else "раненый ") + String(g.n) + " уходит") \
			+ " — " + dir_word(float(w.x) - float(P.x), float(w.y) - float(P.y)) + (", совсем рядом" if wd < 170.0 else "") + "." + (" Берите рогатину." if w.st == "lie" and JS.t(g.get("fierce")) else "")
	var s := _hint0(P)
	return s + " " + wind_tip() if randf() < 0.3 else s

func _hint0(P: Dictionary) -> String:
	var want: Array = ["deer", "doe"] if HU.kind == "deer" else ["boar"] if HU.kind == "boar" else ["pheasant", "duck", "hare"]
	var best: Variant = null
	var bd := 1e9
	for a in forest_ani():
		if a["st"] != "dead" and gk(a) in want:
			var d := dist(a, P)
			if d < bd:
				bd = d
				best = a
	if best == null:
		return _pick(["Пусто кругом, государь. Зверь ушёл в самую чащу.", "Тихо… Даже сойки молчат. Поищем у ручья?"])
	if bd < 170.0:
		return _pick(["Тише, государь… Зверь рядом.", "Чуете? Совсем близко. Ступайте мягче — с Shift."])
	var g := game_of(best)
	var rn := _room_at(floori(float(best.x) / CT), floori(float(best.y) / CT))
	return "Свежий след, государь: " + String(g.n) + " — " + dir_word(float(best.x) - float(P.x), float(best.y) - float(P.y)) + (", там «" + rn + "»" if rn != "" and rn != String(_L().name) else "") + "."

## разговор с ловчим (n.talk): без охоты — псарня; на охоте — дальше, разделиться, отбой
func hunter_talk(n: Dictionary) -> void:
	if HU == null:
		act()
		return
	var ch: Array = [{"t": "Охотимся дальше", "fx": func() -> void: pass}]
	if on() and HU.get("split") == null and any_hound():
		ch.append({"t": "Разделимся: ищи зверя с гончими (G)", "tip": "Ловчий с гончими уйдёт к дальней поляне, поднимет зверя и протрубит в рог — идите на рог. Гончие продержат зверя дольше. Но без ловчего рядом опаснее: кабан, шальная стрела.",
			"fx": func() -> void: split_start()})
	ch.append({"t": "Трубить отбой — домой", "fx": func() -> void: end_hunt("horn")})
	c.hud.say(n, hint() + " Стрел в колчане: " + str(HU.arrows) + ".", {"choices": ch, "esc": 0})

func chatter() -> void:
	if now() < float(HU.sayT):
		return
	HU["sayT"] = now() + randf_range(13, 22)
	var hn := _hn()
	var cn: Dictionary = c.npc_by(String(HU.comp)) if HU.comp != null else {}
	var k := _k()
	if not cn.is_empty() and randf() < 0.4 and not _bub(cn):
		var L0: Array
		if cn.key == "spouse":
			L0 = ["Как хорошо вырваться из душных покоев!", "Обещайте мне беречься кабанов.", "Смотрите, какие следы!"]
		elif String(cn.key).begins_with("kid"):
			L0 = [("Матушка" if JS.t(k.get("fem")) else "Отец") + ", а можно мне выстрелить?", "Я видел оленя! Вон там, за деревьями!", "Когда-нибудь я возьму медведя!"]
		else:
			L0 = ["Добрая охота, государь.", "Свежий воздух лучше любого совета.", "Говорят, ваш дед взял здесь медведя."]
		_say(cn, _pick(L0), 4)
		return
	if not hn.is_empty() and not _bub(hn):
		_say(hn, hint(), 4.5)

# ---------- конец: рог, ворота, сумерки — или рана (huntDusk, huntRelease, huntEnd + hurt.js + sick.js, huntAbort) ----------
func dusk() -> void:
	if not on() or c.hud.modal_open() or c.fade > 0.0:
		return
	if Game.day != int(HU.day):
		end_hunt("dusk")
		return
	HU["duskAsked"] = 1
	var hn := _hn()
	c.hud.say(hn if not hn.is_empty() else null, "Смеркается, государь. В темноте зверя не возьмёшь — пора домой.", {"choices": [{"t": "Трубить отбой", "fx": func() -> void: end_hunt("dusk")}], "esc": 0})

func release() -> void:
	var P := _P()
	var i := 0
	for n in c.npcs:
		if not JS.t(n.get("follow")):
			continue
		n["follow"] = false
		n["hold"] = false
		n["path"] = null
		n["goal"] = null
		n["cur"] = ""
		n["bub"] = ""
		n["moving"] = false
		var e: Vector2i = c.near_free("yard", floori(float(P.x) / CT) - 1 - i, floori(float(P.y) / CT) + 1)
		n["loc"] = "yard"
		n["x"] = e.x * CT + 8.0
		n["y"] = e.y * CT + 12.0
		i += 1
	for a in c.ani:
		if int(a["game"]) == 2:
			var r: Array = a["r"]
			a["game"] = 0
			a["loc"] = "yard"
			a["st"] = ""
			a["q"] = null
			a["pth"] = null
			a["moving"] = false
			a["run"] = false
			a["t"] = 1.0
			a["x"] = (r[0] + randf() * (r[2] - r[0] + 1)) * CT
			a["y"] = (r[1] + randf() * (r[3] - r[1] + 1)) * CT

func end_hunt(why: String, door_: Variant = null) -> void:
	if not on():
		return
	var k := _k()
	HU["ended"] = 1
	if why == "wound" and JS.n(JS.o(k.get("woundK"), 2.0)) >= 2 and Hurt.hurt(k):
		c.heal.start({"from": "hunt", "HU": HU})       # hurt.js: на носилках — домой (litter: release, HU = null, fauna(""))
	else:
		var hu: Dictionary = HU
		c.fade_to(func() -> void: _end_fade(hu, why, door_))
	# sick.js: старого короля в погоне может хватить удар (Филипп IV, 1314)
	if why != "wound" and JS.t(k.alive) and not JS.t(k.get("ill")) and JS.n(k.age) >= 55 and randf() < 0.012 + (JS.n(k.age) - 55.0) * 0.002:
		SimSick.sickStart(k, "stroke", "на охоте")
		_toast("На обратном пути у короля немеет рука, лицо перекашивает. Удар!")
	print("HUNT END ", why)

func _end_fade(hu: Dictionary, why: String, door_: Variant) -> void:
	var P := _P()
	c.go_loc("yard")
	P["sit"] = null
	P["lie"] = false
	c.path = []
	c.on_arrive = Callable()
	if door_ != null:
		P["x"] = float(door_.ax)
		P["y"] = float(door_.ay)
		P["dir"] = door_.dir
	else:
		var sp: Dictionary = c.spots["hunter"]
		var e: Vector2i = c.near_free("yard", floori(float(sp.x) / CT) + 1, floori(float(sp.y) / CT))
		P["x"] = e.x * CT + 8.0
		P["y"] = e.y * CT + 11.0
		P["dir"] = "up"
	release()
	HU = null
	fauna("")
	c.snap_cam()
	c.parts.clear()
	Snd.sfx("horn_short")
	summary(hu, why)

func abort() -> void:
	if HU == null:
		return
	HU = null
	release()
	fauna("")

static func unrest_all(v: float) -> void:
	var G := Sim.G
	for P in G.provs:
		if G.setts[Sim.W.provs[int(P.id)].seat].owner == 0.0:
			P.unrest = clampf(float(P.unrest) + v, 0.0, 100.0)

## итоги (huntSummary + huntSum2): мясо, шкуры, престиж, трофеи, спутник, Меч короля, рекорды, рогатина, белый олень
func summary(hu: Dictionary, why: String) -> void:
	var k := _k()
	var C: Dictionary = Sim.G.court
	var bag: Array = hu.bag
	var meat := 0
	var fur := 0
	var pr := 0
	for b in bag:
		var g: Dictionary = GAME[b.k]
		meat += int(g.meat)
		fur += int(g.fur)
		pr += int(g.pr) if b.by == "king" or b.by == "falcon" else floori(int(g.pr) / 2.0)
	if hu.kind == "falcon" and bag.size() >= 2:
		pr += 1
	pr = mini(pr, 6)
	C["grain"] = JS.n(C.get("grain", 0)) + meat
	Sim.G.realms[0].gold = float(Sim.G.realms[0].gold) + fur
	if pr != 0:
		SimCourt.prestige(pr)
	if not (C.get("trophies") is Dictionary):
		C["trophies"] = {}
	for b in bag:
		if b.by == "king" and (b.k == "deer" or b.k == "boar" or b.k == "bear"):
			C.trophies[b.k] = JS.n(C.trophies.get(b.k, 0)) + 1
	var T: Array = []
	if why == "wound":
		T.append("Охота кончилась бедой — но король жив, а это главное.")
	T.append("Добыча: " + bag_str(bag) + "." if not bag.is_empty() else _pick(["Зверь ушёл — сегодня лес оказался хитрее.", "Без добычи. Зато гончие размяли лапы."]))
	if meat:
		T.append("Мясо — на кухню и в погреба: +" + str(meat) + " мер.")
	if fur:
		T.append("Шкуры ловчий продаст: +" + str(fur) + " зол.")
	if pr:
		T.append("Слава охотника: престиж +" + str(pr) + ".")
	var cn: Dictionary = c.npc_by(String(hu.comp)) if hu.comp != null else {}
	var cc: Variant = c.people.real(cn) if not cn.is_empty() else null
	if cc != null:
		var v := 4 + mini(4, bag.size())
		cc["loy"] = clampf(JS.n(JS.o(cc.get("loy"), 50)) + v, 0.0, 100.0)
		if cn.key == "spouse":
			C["together"] = _day()
		T.append(comp_name(cn) + " — расположение +" + str(v) + ".")
	if bag.any(func(b): return b.by == "king" and (b.k == "boar" or b.k == "bear")):
		k["mx"] = JS.n(k.get("mx", 0)) + 1
		if JS.n(k.mx) >= 6:
			k["mx"] = 0.0
			k["mar"] = minf(20.0, JS.n(k.mar) + 1)
			T.append("Рука крепнет: Меч короля +1.")
	sum2(hu, T)
	if int(hu.shots) > 0:
		T.append("Стрел пущено: " + str(hu.shots) + ", в цель: " + str(hu.hits) + ".")
	Sim.glog("Королевская охота" + (": " + bag_str(bag) if not bag.is_empty() else " без добычи") + ".", "good" if not bag.is_empty() else "info")
	c.hud.say(null, " ".join(T), {"name": "Итоги охоты"})
	print("HUNT SUM ", bag.size(), " ", why)

func sum2(hu: Dictionary, T: Array) -> void:
	var C: Dictionary = Sim.G.court
	if not (C.get("huntRec") is Dictionary):
		C["huntRec"] = {}
	var rec: Dictionary = C.huntRec
	var best := {"deer": 0, "boar": 0, "bear": 0}
	var bag: Array = hu.bag
	var pr := 0
	for b in bag:
		if b.by == "king":
			if b.k == "deer" and int(b.get("pts", 0)) > int(best.deer):
				best.deer = int(b.pts)
			if (b.k == "boar" or b.k == "bear") and int(b.get("wt", 0)) > int(best[b.k]):
				best[b.k] = int(b.wt)
	for key in ["deer", "boar", "bear"]:
		var v: int = best[key]
		if v == 0:
			continue
		var s := "олень, рога в " + tines(v) if key == "deer" else ("секач в " if key == "boar" else "медведь в ") + poods(v)
		if not JS.t(rec.get(key)):
			rec[key] = v
			T.append("Трофей: " + s + " — ловчий записал его в книгу двора.")
		elif v > JS.n(rec[key]):
			T.append("Трофей: " + s + " — новый рекорд двора (было " + JS.s(rec[key]) + ")! Престиж +1.")
			rec[key] = v
			pr += 1
		else:
			T.append("Трофей: " + s + " (рекорд двора — " + JS.s(rec[key]) + ").")
	var pk := mini(2, bag.filter(func(b): return JS.t(b.get("pike")) and JS.t(GAME[b.k].get("fierce"))).size())
	if pk:
		pr += pk
		T.append(("Звери взяты" if pk > 1 else "Зверь взят") + " на рогатину — о такой охоте споют менестрели: престиж +" + str(pk) + ".")
	if hu.get("hart") != null:
		var hb: Variant = null
		for b in bag:
			if JS.t(b.get("hart")):
				hb = b
				break
		if hb != null and hb.by == "king":
			pr += 3
			unrest_all(2)
			T.append("Белый олень пал от вашей руки. Слава громкая — престиж +3, — но старики качают головами: не к добру.")
		elif hb != null:
			unrest_all(2)
			T.append("Гончие взяли белого оленя… Ловчий хмур: не к добру.")
		elif JS.t(hu.get("hartSeen")):
			pr += 1
			unrest_all(-4)
			T.append("Белого оленя вы пощадили — добрый знак. Молва о милостивом короле разойдётся по округе: престиж +1, в провинциях спокойнее.")
	if pr:
		SimCourt.prestige(pr)
	if int(hu.get("jshots", 0)) > 0:
		T.append("Сулиц метнуто: " + str(hu.jshots) + ", в цель: " + str(hu.jhits) + ".")

# ---------- хуки двора: ворота леса (DOOR_EXT), клавиши (CKEY_EXT), цель «E» (TARGET_EXT), щелчок (PICK_EXT), мышь ----------
func door(d: Dictionary) -> bool:
	if not on() or not in_forest() or d.to != "yard":
		return false
	var P := _P()
	P["x"] = float(P.x) + 14.0
	c.path = []
	c.on_arrive = Callable()
	var hn := _hn()
	c.hud.say(hn if not hn.is_empty() else null, "Уже домой, государь? " + ("Добыча славная!" if not (HU.bag as Array).is_empty() else "Зверь ещё не взят…"),
		{"choices": [{"t": "Трубить отбой — домой", "fx": func() -> void: end_hunt("gate", d)}, {"t": "Ещё поохотимся", "fx": func() -> void: pass}], "esc": 1})
	return true

## клавиша (CKEY_EXT hunt2 + hunt3): Q — оружие, G — ловчий, E/Enter при своём прицеле без цели — подсказка
func key(k: int) -> bool:
	if not on() or not in_forest():
		return false
	if k == KEY_Q:
		wpn_next()
		return true
	if k == KEY_G:
		split_key()
		return true
	if (k == KEY_E or k == KEY_ENTER) and own() and c.nearest_target().is_empty():
		if now() > float(HU.get("eTip", 0.0)):
			HU["eTip"] = now() + 6.0
			_toast("Свой прицел: зажмите левую кнопку мыши — натянуть, отпустите — выстрел. Прицел ловчего (E) — в панели охоты.")
		return true
	return false

func target() -> Dictionary:
	if on() and HU.get("aim") != null and in_forest():
		return target_of(HU.aim)
	return {}

## щелчок по зверю (PICK_EXT): свой прицел (hunt3.js, первым) — подсказка; иначе — прицел ловчего (hunt.js)
func pick(wx: float, wy: float) -> Dictionary:
	if not on() or not in_forest():
		return {}
	var P := _P()
	if own():
		var o := _pick3(wx, wy, P)
		if not o.is_empty():
			return o
	for a in forest_ani():
		if a["st"] == "dead":
			continue
		var s: Vector2 = c.fa_box(a)
		var hw := s.x / 2.0 + 2.0
		var top: float = float(a.y) - s.y - float(a.h) - 2.0
		if wx < float(a.x) - hw or wx > float(a.x) + hw or wy < top or wy > float(a.y) + 3.0:
			continue
		var g := game_of(a)
		var d := dist(a, P)
		var use_f: bool = HU.kind == "falcon" and HU.get("fal") == null and (JS.t(g.get("bird")) or a["kind"] == "hare")
		if can_shoot(a, d, use_f, P):
			return target_of({"a": a, "d": d, "useF": use_f})
		var why := why_not(a, d, use_f)
		return {"label": ucf(String(g.n)), "sub": why, "x": a.x, "y": float(a.y) - 8.0 - float(a.h), "d": 1e9, "go": func() -> void: _toast("Не выстрелить: " + why + ".")}
	return {}

func _pick3(wx: float, wy: float, P: Dictionary) -> Dictionary:
	for a in forest_ani():
		if a["st"] == "dead":
			continue
		var b := a_box(a)
		if wx < b[0] - 3 or wx > b[2] + 3 or wy < b[1] - 3 or wy > b[3] + 4:
			continue
		var g := game_of(a)
		if HU.kind == "falcon" and HU.get("fal") == null and (JS.t(g.get("bird")) or a["kind"] == "hare"):
			return {}         # добыча сокола — пусть щелчок решит hunt.js
		var top: float = b[1] + 14.0
		var nm := "Белый олень" if JS.t(a.get("hart")) else ucf(String(g.n))
		if HU.get("draw") != null:
			var d := roundi(dist(a, P))
			var B: Dictionary = HBOW[HU.draw.w]
			return {"label": nm + " · " + str(d) + " шагов", "sub": "не долетит — подойдите ближе" if d > float(B.r0) + float(B.r1) else "", "x": a.x, "y": top, "d": 1e9, "go": func() -> void: pass}
		var f := JS.t(g.get("f"))
		return {"label": nm, "sub": st_word(a) + ((", ранена" if f else ", ранен") if JS.t(a.get("hurt")) else "") + ((" · стрел в " + ("ней" if f else "нём") + ": " + str(a.arw)) if int(a.get("arw", 0)) > 0 else "")
			+ " · зажмите кнопку — " + ("натянуть лук" if HU.wpn == "bow" else "замах"), "x": a.x, "y": top, "d": 1e9, "go": func() -> void:
				if now() > float(HU.get("eTip", 0.0)):
					HU["eTip"] = now() + 4.0
					_toast("Зажмите левую кнопку мыши — " + ("натянуть тетиву" if HU.wpn == "bow" else "замахнуться") + ", наведите и отпустите.")}
	return {}

## мышь (input.down[0] в HTML): нажали левую — с этого времени; на дворе ли (не над окнами)
var hold_court := false
func press(on_court: bool) -> void:
	hold_t = now()
	hold_used = false
	hold_court = on_court

func up() -> void:
	hold_t = -1.0

## обёртка courtClick (hunt3.js): натянут — отпустить (ПКМ — ослабить); щелчок сразу после выстрела — съесть. b: 0 — ЛКМ, 2 — ПКМ
func click_hook(b: int) -> bool:
	if HU == null:
		return false
	if HU.get("draw") != null:
		if b != 0 and hold_t >= 0.0:
			HU["eatUp"] = 1
		draw_loose(b != 0)
		return true
	if (JS.t(HU.get("eatUp")) and b == 0) or (HU.get("drawEnd") != null and now() - float(HU.drawEnd) < 0.08):
		HU["eatUp"] = 0
		return true
	return false

func drawing() -> bool:
	return HU != null and HU.get("draw") != null

## при натяге король идёт медленно (dt × 0.45, в court._tick) и смотрит на прицел
func face_aim() -> void:
	if drawing():
		var P := _P()
		var ap := aim_pt()
		face_to(P, ap.x - float(P.x), ap.y - float(P.y) + 14.0)

# ---------- каждый кадр (UPD_EXT hunt → hunt2 → hurt → hunt3) ----------
func update(dt: float) -> void:
	if JS.t(Sim.G.get("visit")):
		return
	var P := _P()
	if on() and (Game.day != int(HU.day) or (Game.hour_abs() >= 19.5 and not JS.t(HU.get("duskAsked")))):
		dusk()
	if in_forest():
		for a in c.ani:
			if a["loc"] != "forest":
				continue
			if int(a["game"]) == 1:
				game_upd(a, dt, P)
			elif int(a["game"]) == 2 and HU != null:
				hound_upd(a, dt, P)
		if on():
			var i := 0
			for n in c.npcs:
				if JS.t(n.get("follow")):
					fol_upd(n, i, dt, P)
					i += 1
			arrows_upd(dt, P)
			falcon_upd(dt, P)
			HU["aim"] = aim(P)
			chatter()
			var ST: Array = HU.stuck
			if not ST.is_empty() and now() - float(ST[0].t) > 10.0:
				ST.pop_front()
			# hunt2.js
			jav_upd(dt, P)
			var hn := _hn()
			if float(HU.get("windT", 0.0)) > 0.0 and now() > float(HU.windT):
				HU["windT"] = 0.0
				_say(hn, wind_tip(), 4.5)
			var h: Variant = HU.get("hart")
			if h != null and not JS.t(HU.get("hartSeen")) and h.st != "dead" and dist(h, P) < 170.0 and line_free(P.x, float(P.y) - 10.0, h.x, float(h.y) - 10.0):
				HU["hartSeen"] = 1
				_toast("Белый олень! Пощадить — к удаче, взять — к славе.")
				_say(hn, "Государь… белый олень! Старики говорят: кто его пощадит — тому удача, а кто возьмёт — тому слава.", 6)
			var BL: Array = HU.blood
			if not BL.is_empty() and now() - float(BL[0].t) > 240.0:
				BL.pop_front()
	# hurt.js: король встаёт; «Беда на охоте» — через 2,2 с
	if float(P.get("downT", 0.0)) > 0.0 and float(P.downT) <= now():
		P["downT"] = 0.0
		P["hide"] = c.heal.on and c.heal.sh == "litter"
	if pend != null and now() >= float(pend.t) and not c.hud.dlg_open():
		var f: Callable = pend.f
		pend = null
		f.call()
	if on() and in_forest():
		_upd3(dt, P)

func _upd3(dt: float, P: Dictionary) -> void:
	var hn := _hn()
	var md := hold_t >= 0.0
	if own() and not (HU.get("aim") != null and JS.t(HU.aim.useF)):
		HU["aim"] = null           # свой прицел: без рамки ловчего (сокол — по-прежнему E)
	if JS.t(HU.get("eatUp")) and not md:
		HU["eatUp"] = 0
	if own() and not c.blocked() and not (float(P.get("downT", 0.0)) > now()):
		if HU.get("draw") == null and md and not hold_used and now() - hold_t > 0.14:
			hold_used = true
			if hold_court:
				draw_start()
		if HU.get("draw") != null and not md:
			draw_loose(false)
		elif HU.get("draw") != null:
			c.path = []
			c.on_arrive = Callable()
	elif HU.get("draw") != null:
		draw_loose(true)
	ar_upd(dt, P)
	pick_up(P)
	comp_shoot(P)
	split_upd(P)
	if P.moving and not c.sneak and not (float(P.get("downT", 0.0)) > now()) and pend == null:
		var k := _k()
		var near := false
		for h in c.ani:
			if int(h["game"]) == 2 and h["st"] == "chase" and dist(h, P) < 260.0:
				near = true
				break
		if near and randf() < dt * 0.0006 * (2.0 if Game.season() == 3 else 1.0) * (1.6 if JS.n(k.age) > 50 else 1.0) * (1.5 if Hurt.hurt(k) else 1.0):
			chase_fall()
	if not hn.is_empty() and HU.get("split") == null and not _bub(hn):
		if not JS.t(HU.get("boarSaid")):
			for a in forest_ani():
				if JS.t(game_of(a).get("fierce")) and a["st"] != "dead" and dist(a, P) < 150.0 and line_free(P.x, float(P.y) - 10.0, a.x, float(a.y) - 6.0):
					HU["boarSaid"] = 1
					_say(hn, "Медведь, государь! Близко не подходите. Семь стрел ему мало — берегитесь." if a.kind == "bear" else "Секач, государь! Подойдёте близко — кинется. Бейте издали, а кинется — вбок или на рогатину.", 5)
					break
		if not JS.t(HU.get("splitSaid")) and now() - float(HU.t0) > 55.0 and (HU.bag as Array).is_empty() and any_hound():
			HU["splitSaid"] = 1
			_say(hn, "Зверь затаился, государь. Разделимся? Я с гончими обойду дальние поляны и протрублю, как подниму. (G)", 6)

# ---------- TODO p7: рисование (см. HANDOFF.md, раздел «Рисование») ----------
# sync(): xnode-ы — кровь (под спрайтами, y=-1e5), «!» над alert/charge (и без охоты), HU.stuck, HU.fl, сокол, вспышка лука,
#   HU.sj, HU.jf, drawHeld, HU.ar, линия прицела и полоска натяга (z=1); HU.sa и стрелы в тушах (по y); лежащий король (downT);
#   белая вспышка flash (z=70). draw_hud(u): уголки прицела, huntPanel v3 с hit-зонами, нижняя строка, стрелка к ловчему.

func state() -> Dictionary:
	var o := {"on": on(), "fauna": forest_ani().size(), "hounds": hounds_in_forest().size()}
	if HU == null:
		return o
	o.merge({"kind": HU.kind, "wpn": HU.wpn, "arrows": HU.arrows, "jav": HU.jav, "bag": bag_str(HU.bag), "nbag": (HU.bag as Array).size(),
		"split": String(HU.split.st) if HU.get("split") != null else "", "draw": HU.get("draw") != null, "ar": (HU.ar as Array).size(), "sa": (HU.sa as Array).size(),
		"hart": HU.get("hart") != null, "aim": HU.get("aim") != null, "follow": c.npcs.filter(func(n): return JS.t(n.get("follow"))).size()})
	return o
