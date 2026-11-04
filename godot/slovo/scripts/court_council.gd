extends RefCounted
## Малый совет в замке (audience.js): заседание по четвергам в 9:30 и экстренный сбор (callCouncil), кто придёт
## (councilPresence: в отъезде, больны, места пустуют), доклады за столом (runMeeting) — советники встают только после
## короля; часы двора (courtHalfHour); разговор с советником (talkSeat: доклад, поручение, «по душам», обвинить казначея,
## снять с поста), казна (treasuryAct: пересчитать самому и уличить вора — confrontChoices), казармы (barracksAct).
## Дни — по часам двора (Game.day), как G.day в HTML; случайные слова людей — не из зерна королевства.
const NIGHT_L := ["В такой час, государь?..", "Что стряслось среди ночи?", "*зевает* Иду, иду…"]
const DAY_L := ["Иду, государь!", "Срочный совет? Уже иду.", "Что случилось?"]
const RISE_L := ["С вашего позволения, государь.", "За дела, господа.", "Да хранит вас Господь, государь."]
var c: Node2D   # court.gd

func _init(court: Node2D) -> void:
	c = court

static func _pick(L: Array) -> String:
	return String(L[randi() % L.size()])

static func ok() -> bool:
	return not Sim.G.is_empty() and Sim.G.has("court")

static func low_first(t: String) -> String:
	return t.left(1).to_lower() + t.substr(1)

## место за столом совета (seatSpotName): seat0…seat6 — по порядку мест
static func seat_spot(k: String) -> String:
	for i in Sim.SEATS.size():
		if String(Sim.SEATS[i].k) == k:
			return "seat" + str(i)
	return ""

static func _day() -> float:
	return float(Game.day)

static func _loy(ch: Dictionary, d: float) -> void:
	ch.loy = JS.clp(float(JS.o(ch.get("loy"), 50.0)) + d, 0, 100)

static func _join(L: Array, f: Callable) -> String:
	var a := PackedStringArray()
	for e in L:
		a.append(String(f.call(e)))
	return ", ".join(a)

func king_at_table() -> bool:
	return c.king["sit"] != null and c.king["sit"] == c.spots.get("seat_king")

# ---------- заседание ----------
func meeting_open() -> bool:
	if not ok():
		return false
	var C: Dictionary = Sim.G.court
	if float(C.get("meetDay", -1.0)) != _day() or float(C.get("meetDone", -1.0)) == _day():
		return false
	var mc: Variant = C.get("meetCall")
	var h := Game.hour_abs()
	return h <= float(mc.until) if mc is Dictionary else (h >= 9.4 and h < 12.0)

## кто придёт (councilPresence): come — в замке ({s, c, n}), away — в отъезде, vac — места пустуют, sick — лежат больные
func presence() -> Dictionary:
	var come: Array = []
	var away: Array = []
	var vac: Array = []
	var sick: Array = []
	var home: bool = JS.t(Sim.G.get("atCourt"))
	for s in Sim.SEATS:
		var ch: Variant = SimDyn.seatChar(s.k)
		if ch == null:
			vac.append(s)
			continue
		var n: Dictionary = c.npc_by("seat_" + String(s.k))
		if n.is_empty() or not home:
			away.append({"s": s, "c": ch})
		elif ch.get("ill") is Dictionary and JS.t(ch.ill.get("bed")):
			sick.append({"s": s, "c": ch, "n": n})
		else:
			come.append({"s": s, "c": ch, "n": n})
	return {"come": come, "away": away, "vac": vac, "sick": sick}

func seated_now(n: Dictionary) -> bool:
	return n["sit"] != null and n["sit"] == c.spots.get(seat_spot(String(n.get("seat", ""))))

static func sick_note(pr: Dictionary) -> String:
	if (pr.sick as Array).is_empty():
		return ""
	return " Больны и лежат: " + _join(pr.sick, func(e): return low_first(String(e.s.n)) + " (" + String(e.c.name) + ")") + "."

## почему нельзя созвать (canCallCouncil): "" — можно
func can_call() -> String:
	if not ok():
		return "Совета нет"
	var C: Dictionary = Sim.G.court
	if not JS.t(Sim.G.get("atCourt")):
		return "Король в отъезде — без него совет не собрать"
	if not c.is_inside_tree():
		return "Вернитесь ко двору (Tab), чтобы созвать совет"
	if float(C.get("meetDone", -1.0)) == _day():
		return "Совет сегодня уже заседал"
	if meeting_open():
		return "Совет уже собирается"
	if float(C.get("callDay", -1.0)) == _day():
		return "Сегодня совет уже созывали"
	return ""

## экстренный сбор (callCouncil): паж бежит по замку, советники идут к своим местам; ночью — недовольны
func call_council() -> bool:
	var why := can_call()
	if why != "":
		c.hud.toast(why + ".")
		return false
	var C: Dictionary = Sim.G.court
	var h := Game.hour_abs()
	var night := Game.is_night()
	var until := minf(28.95, h + 3.0)
	var pr := presence()
	var come: Array = pr.come
	C.callDay = _day()
	C.waitKing = 0.0
	if not come.is_empty():
		C.meetDay = _day()
		C.meetCall = {"at": h, "until": until}
	for e in come:
		var n: Dictionary = e.n
		if n["away"] or n["loc"] != "keep":
			c.people.place(n, c.spots["council_door"])
			n["away"] = false
		n["override"] = {"spot": seat_spot(String(e.s.k)), "until": until, "day": Game.day}
		n["cur"] = ""
		n["wander"] = null
		if night:
			_loy(e.c, -2)
			c.people.say(n, _pick(NIGHT_L), 4.0)
		else:
			c.people.say(n, _pick(DAY_L), 3.0)
	Sim.sfx("bell")
	c.hud.win = null
	var seated := king_at_table()
	if seated and not come.is_empty():
		C.waitKing = 1.0
	var t := ("Паж побежал по замку: «Срочный совет!» Придут: " + _join(come, func(e): return low_first(String(e.s.n))) + "." if not come.is_empty() else "Звать некого: никого из советников нет в замке.") \
		+ (" В отъезде: " + _join(pr.away, func(e): return low_first(String(e.s.n)) + " (" + String(e.c.name) + ")") + "." if not (pr.away as Array).is_empty() else "") \
		+ sick_note(pr) + (" Пустуют места: " + _join(pr.vac, func(s): return low_first(String(s.n))) + "." if not (pr.vac as Array).is_empty() else "") \
		+ ((" Король ждёт во главе стола — совет начнётся, как только все сядут." if seated else " Они сойдутся в зал совета в течение часа. Если король не придёт за два часа — разойдутся.") if not come.is_empty() else "") \
		+ (" Ночной сбор: советники недовольны (верность −2)." if night and not come.is_empty() else "")
	var o := {"name": "Экстренный сбор совета"}
	if not seated and not come.is_empty():
		o.choices = [{"t": "Идти в зал совета и сесть во главе стола", "fx": func(): go_seat()}, {"t": "Позже"}]
		o.esc = 1
	c.hud.say(null, t, o)
	print("COUNCIL CALL ", come.size())
	return true

## в зал совета и во главе стола (goCouncilSeat): совет начнётся, когда все сядут
func go_seat() -> void:
	c.fade_to(func() -> void:
		if c.loc_id != "keep":
			c.go_loc("keep")
		c.sit_at(c.spots["seat_king"])
		c.snap_cam()
		if ok():
			Sim.G.court.waitKing = 1.0
		Sim.sfx("door"))

## король сел во главе стола (councilSit): совет собирается — ждать или начать; нет — созвать или раздать дела
func sit() -> void:
	if not ok():
		return
	if meeting_open():
		var pr := presence()
		var come: Array = pr.come
		var sat := come.filter(func(e): return seated_now(e.n)).size()
		if sat >= come.size():
			run_meeting()
			return
		c.hud.say(null, "Советники ещё сходятся: за столом " + str(sat) + " из " + str(come.size()) + ".", {"name": "Зал совета", "choices": [
			{"t": "Подождать остальных", "fx": func(): _wait_king()},
			{"t": "Начать без опоздавших", "fx": func(): run_meeting()},
			{"t": "Встать", "fx": func(): c.stand_up()}], "esc": 2})
		return
	var nd := SimText.nextCouncilDay()
	var why := can_call()
	var ch: Array = []
	if why == "":
		ch.append({"t": "Созвать совет сейчас", "tip": "Ночью советники будут недовольны (верность −2)." if Game.is_night() else "Советники в замке придут в течение часа.", "fx": func(): call_council()})
	ch.append({"t": "Открыть дела совета", "fx": func(): c.hud.open_council()})
	ch.append({"t": "Встать", "fx": func(): c.stand_up()})
	c.hud.say(null, "Зал совета пуст. Малый совет собирается раз в неделю — по четвергам в 9:30. Ближайший: " + SimText.dateStr(nd) + " (" + SimText.inDays(nd - Game.day) + ")." + (" " + why + "." if why != "" else " Можно созвать советников срочно — или просто раздать поручения."), {"choices": ch, "esc": ch.size() - 1})

func _wait_king() -> void:
	Sim.G.court.waitKing = 1.0
	c.hud.toast("Король ждёт во главе стола: совет начнётся, когда все сядут.")

## заседание (runMeeting): доклады по очереди, потом — что прикажет государь
func run_meeting() -> void:
	var C: Dictionary = Sim.G.court
	C.meetDone = _day()
	C.waitKing = 0.0
	var L: Array = []
	var pr := presence()
	for e in pr.come:
		var rep: Variant = SimCourt.seatReport(String(e.s.k))
		if rep != null:
			L.append({"who": e.n, "text": String(rep)})
		_loy(e.c, 0.5)
	var notes := PackedStringArray()
	if not (pr.away as Array).is_empty():
		notes.append("В отъезде: " + _join(pr.away, func(e): return low_first(String(e.s.n))) + ".")
	if sick_note(pr) != "":
		notes.append(sick_note(pr).strip_edges())
	if not (pr.vac as Array).is_empty():
		notes.append("Пустуют места: " + _join(pr.vac, func(s): return String(s.n)) + ".")
	L.append({"who": null, "text": "Доклады выслушаны. " + (" ".join(notes) + " " if not notes.is_empty() else "") + "Что прикажет государь?", "o": {
		"choices": [{"t": "Раздать поручения", "fx": func(): c.hud.open_council()}, {"t": "Распустить совет"}], "esc": 1, "on_end": func(): _hold()}})
	c.hud.say_seq(L)
	print("COUNCIL MEETING ", pr.come.size())

## никто не встаёт раньше короля
func _hold() -> void:
	for n in c.npcs:
		var ov: Variant = n.get("override")
		if String(n.get("seat", "")) != "" and ov is Dictionary:
			ov.until = 28.95
			ov.hold = 1
	Sim.G.court.meetCall = null
	Sim.G.court.meetHold = _day()

## король ждёт во главе стола, пока сходится совет: часы двора идут не быстрее первой скорости — на третьей советники
## (люди ходят там лишь вдвое быстрее) иначе не успевали дойти через весь замок за отпущенные три часа (так было и в HTML)
func time_k() -> float:
	if Game.speed <= 1 or not ok() or not JS.t(Sim.G.court.get("waitKing")) or not king_at_table() or not meeting_open():
		return 1.0
	return Game.DAY_SEC[Game.speed] / Game.DAY_SEC[1]

## каждый кадр двора (councilUpdate): король встал — встают и советники; все сели — заседание; не пришёл — разошлись
func update() -> void:
	if not ok():
		return
	var C: Dictionary = Sim.G.court
	var mh := float(C.get("meetHold", -1.0))
	if mh >= 0.0 and (mh != _day() or not king_at_table()):
		C.meetHold = -1.0
		var first := true
		for n in c.npcs:
			var ov: Variant = n.get("override")
			if String(n.get("seat", "")) != "" and ov is Dictionary and JS.t(ov.get("hold")):
				var sat := seated_now(n)
				n["override"] = null
				n["cur"] = ""
				if first and sat:
					first = false
					c.people.say(n, _pick(RISE_L), 3.0)
	if float(C.get("meetDay", -1.0)) != _day() or float(C.get("meetDone", -1.0)) == _day():
		return
	if JS.t(C.get("waitKing")) and king_at_table() and not c.hud.is_open():
		var pr := presence()
		if (pr.come as Array).all(func(e): return seated_now(e.n)):
			run_meeting()
			return
	var mc: Variant = C.get("meetCall")
	if mc is Dictionary and Game.hour_abs() > float(mc.until):
		C.meetDone = _day()
		C.meetCall = null
		C.waitKing = 0.0
		for e in presence().come:
			_loy(e.c, -1)
			e.n["override"] = null
			e.n["cur"] = ""
		Sim.glog("Советники прождали короля два часа и разошлись. Обижены.", "bad")

## часы двора (courtHalfHour): четверг 9:30 — совет собирается; полдень — король не пришёл; 20:00 — пир
func half_hour(h: float) -> void:
	if not ok() or JS.t(Sim.G.get("visit")):
		return
	var C: Dictionary = Sim.G.court
	var home: bool = JS.t(Sim.G.get("atCourt"))
	if h == 9.5 and Game.day % 7 == 3 and float(C.get("meetDone", -1.0)) != _day() and not (C.get("meetCall") is Dictionary) and home:
		C.meetDay = _day()
		for i in Sim.SEATS.size():
			var k := String(Sim.SEATS[i].k)
			var n: Dictionary = c.npc_by("seat_" + k)
			if not n.is_empty() and SimDyn.seatChar(k) != null:
				n["override"] = {"spot": "seat" + str(i), "until": 12.0, "day": Game.day}
				n["cur"] = ""
		c.hud.toast("Четверг, 9:30: малый совет собирается в зале совета.")
		Sim.sfx("bell")
		print("COUNCIL DAY")
	if h == 12.0 and float(C.get("meetDay", -1.0)) == _day() and float(C.get("meetDone", -1.0)) != _day() and not (C.get("meetCall") is Dictionary):
		C.meetDone = _day()
		if home:
			for e in presence().come:
				_loy(e.c, -1)
			Sim.glog("Король был в замке, но на совет не пришёл. Советники недовольны.", "bad")
	if h == 20.0 and float(C.get("feastDay", -99.0)) == _day():
		c.hud.toast("В пиршественном зале шумит пир!")

# ---------- разговор с советником (talkSeat) ----------
func talk_seat(n: Dictionary) -> void:
	var k := String(n.seat)
	var ch: Dictionary = SimDyn.seatChar(k)
	var C: Dictionary = Sim.G.court
	var loy := float(JS.o(ch.get("loy"), 50.0))
	var greet := _pick(["Государь! Чем могу служить?", "Всегда к вашим услугам, ваше величество."]) if loy >= 70 else (_pick(["Ваше величество.", "Слушаю, государь."]) if loy >= 40 else _pick(["…Да, государь?", "Вы что-то хотели, ваше величество?"]))
	var L: Array = [{"t": "Доклад", "fx": func(): _report(n, k)}, {"t": "Дать поручение…", "fx": func(): c.hud.open_council(k)}]
	if k == "treasurer" and (C.secrets as Array).any(func(s): return s.k == "theft" and JS.t(s.get("known"))):
		L.append({"t": "Обвинить в воровстве!", "fx": func(): c.hud.say(n, _pick(["Г-государь… это ошибка писцов! Клянусь!", "Кто вам наплёл?! Я… я всё объясню!"]), {"choices": confront_choices()})})
	L.append({"t": "Поговорить по душам", "fx": func(): _soul(n, ch, loy)})
	L.append({"t": "Освободить от должности", "fx": func(): c.hud.dismiss_ask(k, ch)})
	L.append({"t": "Ничего, ступайте"})
	c.hud.say(n, greet, {"choices": L, "esc": L.size() - 1})

func _report(n: Dictionary, k: String) -> void:
	var rep: Variant = SimCourt.seatReport(k)
	c.hud.say(n, String(rep) if rep != null else "…")

func _soul(n: Dictionary, ch: Dictionary, loy: float) -> void:
	if JS.t(ch.get("talkDay")) and _day() - float(ch.talkDay) < 7:
		c.hud.say(n, "Мы ведь уже беседовали на днях, государь. Дела ждут.")
		return
	ch.talkDay = _day()
	ch.loy = JS.clp(loy + 2, 0, 100)
	c.hud.say(n, soul_line(ch))

static func soul_line(ch: Dictionary) -> String:
	var t: Array = ch.get("traits", [])
	var L: Array = []
	if t.has("greedy"):
		L.append("Деньги, государь, — кровь державы. И, признаться, я люблю, когда они текут рядом.")
	if t.has("honest"):
		L.append("Я не умею лгать, государь. Да и не хочу учиться.")
	if t.has("proud"):
		L.append("Мой дом служил трону, когда ваш прадед ещё учился держать меч.")
	if t.has("cunning"):
		L.append("Всякий человек — замок. Надо лишь знать, где у него потайная дверь.")
	if t.has("wise"):
		L.append("Мудрость — знать, чего не знаешь. Остальное приложится.")
	if t.has("brave"):
		L.append("Дайте мне дело потруднее, государь. Скучно!")
	if t.has("craven"):
		L.append("Я молюсь, чтобы война обошла нас стороной.")
	if t.has("wrathful"):
		L.append("Иной раз так и хочется взять плеть… Простите, государь.")
	if float(JS.o(ch.get("amb"), 50.0)) > 70:
		L.append("Признаюсь, я мечтаю о большем. Но только на службе вам, конечно.")
	if float(JS.o(ch.get("loy"), 50.0)) < 30:
		L.append("Служба… да. Служба.")
	return _pick(L) if not L.is_empty() else "Служу, как умею, государь."

# ---------- казна (treasuryAct, confrontChoices) ----------
func treasury() -> void:
	var r: Dictionary = Sim.G.realms[0]
	var real: float = r.gold
	var book := Sim.bookGold()
	var eyeball := maxf(0.0, roundf(real / 50.0) * 50.0)
	var sus := book - real > maxf(25.0, real * 0.15)
	var text := "Сундуки окованы железом. В свете свечи блестит золото. На глаз здесь около " + JS.s(eyeball) + " золотых." + (" А по книгам казначея — " + JS.s(roundf(book)) + ". Странно…" if sus else "")
	c.hud.say(null, text, {"name": "Казна", "choices": [{"t": "Пересчитать монеты самому (≈3 часа)", "fx": func(): _count(real, book)}, {"t": "Уйти"}], "esc": 1})

func _count(real: float, book: float) -> void:
	c.advance_hours(3.0)
	var C: Dictionary = Sim.G.court
	if JS.n(C.get("hidden")) >= 6:
		var s: Variant = null
		for x in C.secrets:
			if x.k == "theft" and not JS.t(x.get("known")):
				s = x
				break
		if s == null:
			s = SimCourt.addSecret("theft", [C.seats.treasurer])
		if s != null:
			s.known = 1.0
			s.how = "пересчёт"
		c.hud.say(null, "Вы считаете до рези в глазах. В сундуках " + Sim.zol(real) + ". По книгам — " + JS.s(roundf(book)) + ". Недостача — " + JS.s(roundf(JS.n(C.hidden))) + "!", {"choices": confront_choices()})
	else:
		c.hud.say(null, "Вы пересчитали всё до монеты: " + Sim.zol(real) + ". Книги не лгут.")

## казначей уличён (confrontChoices): изгнать, в темницу, простить — или пока промолчать
func confront_choices() -> Array:
	var t0: Variant = SimDyn.seatChar("treasurer")
	var C: Dictionary = Sim.G.court
	if t0 == null:
		return [{"t": "Записать недостачу", "fx": func(): C.hidden = 0.0}]
	var t: Dictionary = t0
	var H0: Variant = Sim.G.houses[int(t.house)] if JS.n(t.get("house", -1)) >= 0 and int(t.house) < Sim.G.houses.size() else null
	return [{"t": "Вызвать казначея: отставка и конфискация", "tip": "Вернётся ~60% украденного. Дом казначея обидится.", "fx": func(): _confront(t, H0, 0)},
		{"t": "В темницу его!", "tip": "Вернётся ~80% украденного. Дом казначея оскорблён.", "fx": func(): _confront(t, H0, 1)},
		{"t": "Простить, но пусть вернёт всё", "tip": "Вернётся ~50%. Казначей останется, станет честнее — на время.", "fx": func(): _confront(t, H0, 2)},
		{"t": "Пока промолчать", "tip": "Казначей не знает, что раскрыт. Можно вывести его на чистую воду позже.", "fx": func(): C.pendingConfront = 1.0}]

func _confront(t: Dictionary, H0: Variant, m: int) -> void:
	var C: Dictionary = Sim.G.court
	var g := roundf(JS.n(C.get("hidden")) * [0.6, 0.8, 0.5][m])
	Sim.G.realms[0].gold += g
	C.hidden = 0.0
	match m:
		0:
			SimCourt.dismissSeat("treasurer", "вор")
			if H0 != null:
				SimPlayer.houseLoy(H0, -8)
			Sim.glog("Казначей " + String(t.name) + " изгнан за воровство. Возвращено " + JS.s(g) + " зол.", "good")
		1:
			SimCourt.dismissSeat("treasurer", "вор")
			t.prison = 0.0
			if H0 != null:
				SimPlayer.houseLoy(H0, -18)
			Sim.glog("Казначей " + String(t.name) + " брошен в темницу. Возвращено " + JS.s(g) + " зол.", "good")
		_:
			t.hon = JS.clp(float(JS.o(t.get("hon"), 30.0)) + 20, 0, 100)
			t.loy = JS.clp(float(JS.o(t.get("loy"), 50.0)) + 8, 0, 100)
			C.thiefScared = Sim.G.day + 60.0
			Sim.glog("Казначей " + String(t.name) + " прощён и вернул " + JS.s(g) + " зол.", "info")
	C.secrets = (C.secrets as Array).filter(func(s): return s.k != "theft")

## тайна раскрыта (revealSecret, audience.js): казначей — уличить; заговор дома — пристыдить или задобрить; шпион —
## схватить или кормить ложью; ночной сад — улыбнуться или благословить
func reveal_secret(s: Dictionary, how: String) -> void:
	var G := Sim.G
	s.known = 1.0
	s.how = how
	Snd.sfx("chime")
	var t := SimCourt.secretText(s)
	var drop := func(): G.court.secrets = (G.court.secrets as Array).filter(func(x): return not is_same(x, s))
	match String(s.k):
		"theft":
			c.hud.say(null, ["Вы узнали тайну: " + t, "Теперь у вас есть доказательство."], {"name": "Тайна раскрыта", "choices": confront_choices()})
		"plot":
			var H0: Dictionary = G.houses[int(s.house)]
			c.hud.say(null, "Вы узнали тайну: " + t, {"name": "Тайна раскрыта", "choices": [
				{"t": "Вызвать главу дома и пристыдить", "tip": "Дом напуган: заговор сорван, но верность падает.", "fx": func():
					SimPlayer.houseLoy(H0, -4)
					H0.defiant = 0.0
					H0.amb = maxf(0, float(JS.o(H0.get("amb"), 50.0)) - 25)
					drop.call()
					Sim.glog("Заговор дома " + String(H0.name) + " сорван.", "good")},
				{"t": "Задобрить дом: место при дворе, подарки (−40 зол.)", "tip": "Верность дома заметно вырастет.", "fx": func():
					if SimCourt.spend(40):
						SimPlayer.houseLoy(H0, 15)
						H0.defiant = 0.0
						drop.call()},
				{"t": "Промолчать и следить"}]})
		"spy":
			c.hud.say(null, "Вы узнали тайну: " + t, {"name": "Тайна раскрыта", "choices": [
				{"t": "Схватить шпиона", "fx": func():
					s.done = 1.0
					drop.call()
					Sim.glog("Шпион державы " + Sim.realmName(s.realm) + " схвачен.", "good")
					SimCourt.prestige(2)},
				{"t": "Скармливать ему ложь (гл. 13: двойной агент)", "tip": "Враг будет считать нас сильнее, чем мы есть.", "fx": func():
					s.done = 1.0
					G.realms[int(s.realm)].misled = _day() + 60
					drop.call()
					Sim.glog("Шпиону державы " + Sim.realmName(s.realm) + " подсовывают ложные донесения.", "good")}]})
		_:
			c.hud.say(null, "Вы узнали тайну: " + t, {"name": "Ночной сад", "choices": [{"t": "Улыбнуться и уйти", "fx": func(): drop.call()},
				{"t": "Благословить их союз", "fx": func():
					SimCourt.prestige(1)
					drop.call()}]})
	print("SECRET ", s.k, " ", how)

## казармы (barracksAct): гарнизон столицы и стража
func barracks() -> void:
	var S: Dictionary = Sim.G.setts[int(Sim.G.realms[0].capital)]
	var ret: Variant = Sim.G.court.get("retinue")
	c.hud.say(null, "В казармах пахнет кожей и потом. Гарнизон столицы: " + SimArmy.voin(Sim.menOf(S.gar)) + ". Королевская стража — " + JS.s(Sim.menOf(ret.u if ret is Dictionary else {"levy": 30.0})) + "." + (" Набор рекрутов ведёт маршал." if SimDyn.seatChar("marshal") != null else " Маршала нет — набирать войска некому."))
