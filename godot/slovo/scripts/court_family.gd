extends RefCounted
## Семья короля и воспитанники при дворе (dynasty.js: talkFamily, talkSpouse, queenGossip, talkChild, talkWard):
## разговоры с выбором — вечер вместе, подарок, учёба и меч с детьми, письмо отцу воспитанника, отпустить домой.
## Дни — по часам двора (Game.day); случайные слова и удача — не из зерна королевства (как в court_council.gd).
var c: Node2D   # court.gd

func _init(court: Node2D) -> void:
	c = court

static func _pick(L: Array) -> String:
	return String(L[randi() % L.size()])

static func _day() -> float:
	return float(Game.day)

static func _aff(ch: Dictionary, d: float) -> void:
	ch.aff = JS.clp(JS.n(ch.get("aff")) + d, 0, 100)

## разговор с человеком семьи или воспитанником; false — не из семьи (говорит как все)
func talk(n: Dictionary) -> bool:
	if not n.has("cid") or not SimPlayer.ensure_sim():
		return false
	var ch: Variant = Sim.charOf(n.cid)
	if ch == null or not JS.t(ch.alive):
		return false
	if String(n.key).begins_with("ward"):
		talk_ward(n, ch)
		return true
	if not n.has("fam"):
		return false
	var king: Dictionary = SimPlayer.kingC()
	if ch.id == king.get("spouse"):
		talk_spouse(n, ch)
	elif JS.n(ch.get("age")) < 16:
		talk_child(n, ch)
	else:
		c.hud.say(n, _pick(["Ваш отец гордился бы вами.", "Береги себя, дитя моё. Двор — опасное место.", "Я молюсь за тебя каждый вечер."]) if JS.t(ch.get("dowager"))
			else _pick(["Государь! Рад видеть вас.", "Двор нынче шумный, не находите?", "Если понадоблюсь — я в библиотеке."]))
	return true

func talk_spouse(n: Dictionary, ch: Dictionary) -> void:
	var C: Dictionary = Sim.G.court
	var h := Game.hour_abs()
	if not ch.has("aff"):
		ch.aff = 60.0
	var aff := JS.n(ch.aff)
	var greet := _pick(["Мой король! Я скучала.", "Вот и ты. Присядь со мной хоть на минуту."]) if aff >= 70 else (_pick(["Государь.", "Ты сегодня рано."]) if aff >= 40 else _pick(["…Ваше величество.", "Вы что-то хотели?"]))
	var L: Array = [{"t": "Что говорят при дворе?", "fx": func(): c.hud.say(n, gossip(ch))}]
	if h >= 18.5 or h < 2:
		L.append({"t": "Провести вечер вместе", "ok": func(): return JS.n(C.get("together")) != _day() or not C.has("together"), "why": "Сегодня вы уже были вместе",
			"fx": func():
				C.together = _day()
				_aff(ch, 4)
				c.fade_to(func(): c.advance_hours(1.5))
				c.hud.toast("Вечер у камина…")})
	L.append({"t": "Подарить украшение (30 зол.)", "fx": func():
		if SimCourt.spend(30):
			_aff(ch, 10)
			var H: Variant = SimDyn.houseOf(ch)
			if H != null:
				SimPlayer.houseLoy(H, 2)
			c.hud.say(n, "Какая прелесть! Ты помнишь, что я люблю гранаты.")})
	L.append({"t": "Ничего, дорогая"})
	c.hud.say(n, greet + (" Малыш сегодня толкается." if JS.t(ch.get("preg")) and JS.t(ch.get("pregKnown")) else ""), {"choices": L, "esc": L.size() - 1})

## что говорят при дворе (queenGossip): тайны двора, если есть, иначе — дома, войны и пиры
static func gossip(ch: Dictionary) -> String:
	var G := Sim.G
	var C: Dictionary = G.court
	var sec: Array = (C.get("secrets", []) as Array).filter(func(s): return not JS.t(s.get("known")) and ["love", "plot", "theft"].has(String(s.k)))
	if not sec.is_empty() and randf() < 0.45:
		var s: Dictionary = sec[randi() % sec.size()]
		var a: Variant = Sim.charOf((s.get("who", [-1]) as Array)[0]) if not (s.get("who", []) as Array).is_empty() else null
		if s.k == "love":
			return "Говорят, " + (String(a.name) if a != null else "кто-то из придворных") + " по ночам гуляет в саду. И не один. Я бы на твоём месте прислушалась."
		if s.k == "theft":
			return "Мой брат Конрад жалуется: казначей купил себе новое поместье. На жалованье казначея? Странно, правда?"
		return "Дамы из дома " + SimDyn.houseName(s.get("house")) + " сторонятся меня в последнее время. Что-то затевают — чувствую."
	var H: Array = (G.houses as Array).filter(func(x): return JS.t(x.alive))
	H.sort_custom(func(a, b): return JS.n(a.loy) < JS.n(b.loy))
	var lo: Dictionary = H[0]
	var hi: Dictionary = H[H.size() - 1]
	return _pick(["Дом " + String(lo.name) + " тобой недоволен — это видно по тому, как они кланяются. А " + String(hi.name) + " тебя обожают.",
		"Мой отец пишет из Тремейна: море спокойно, купцы богатеют. Хоть где-то всё хорошо.",
		"Эдмунд снова сбежал с урока к оружейному мастеру. Весь в тебя.",
		"При дворе шепчутся о " + ("войне. Люди боятся." if not SimDay.warsOf(0).is_empty() else "пирах. Давно не было праздника.")])

func talk_child(n: Dictionary, ch: Dictionary) -> void:
	if not ch.has("aff"):
		ch.aff = 70.0
	var heir: Variant = SimDyn.heirOf()
	var best := "mar"
	for k in ["dip", "intr", "stew", "lrn"]:
		if JS.n(ch.get(k)) > JS.n(ch.get(best)):
			best = k
	var age := JS.n(ch.get("age"))
	var L: Array = [{"t": "Как учёба?", "fx": func(): c.hud.say(n, "Магистр говорит, лучше всего у меня — " + String(Sim.T.SKN.get(best, best)) + " (" + JS.s(JS.n(ch.get(best))) + "). "
		+ ("А ещё я умею считать до ста!" if age < 8 else "Но латынь — скука смертная."))}]
	if age >= 7:
		L.append({"t": "Поупражняться с мечом", "ok": func(): return not (JS.n(ch.get("drill", -99)) > _day() - 7), "why": "Хватит на этой неделе", "fx": func():
			ch.drill = _day()
			_aff(ch, 3)
			if randf() < 0.5:
				ch.mar = minf(20, JS.n(ch.get("mar")) + 1)
			Sim.sfx("thud")
			c.hud.say(n, _pick(["Ха! Я почти попал!", "Ещё раз! Ещё!", "Когда я вырасту, я поведу войско!"]))})
	L.append({"t": "Рассказать историю о битве", "ok": func(): return not (JS.n(ch.get("story", -99)) > _day() - 3), "why": "Вчера уже рассказывали", "fx": func():
		ch.story = _day()
		_aff(ch, 2)
		if randf() < 0.3:
			ch.dip = minf(20, JS.n(ch.get("dip")) + 1)
		c.hud.say(n, "…и тогда Сунь-цзы сказал: «Лучшая победа — та, что без боя». А как это — без боя?")})
	L.append({"t": "Иди играй"})
	c.hud.say(n, ("Отец! " if heir != null and heir.id == ch.id else "Папа! ") + _pick(["Ты сегодня не занят?", "Смотри, что я нашёл в саду!", "А правда, что у Блэкторнов на гербе шипы?", "Мама говорит, ты король всего-всего."]),
		{"choices": L, "esc": L.size() - 1})

func talk_ward(n: Dictionary, ch: Dictionary) -> void:
	var C: Dictionary = Sim.G.court
	var H0: Variant = SimDyn.houseOf(ch)
	var happy := JS.n(ch.get("happy"))
	ch.happy = happy
	var mood := "Мне здесь нравится, государь! Принц Эдмунд — мой лучший друг." if happy >= 3 else ("Я скучаю по дому, государь… Но здесь неплохо." if happy >= 0 else "Отпустите меня домой. Меня держат здесь как заложника!")
	var hn := SimDyn.houseName(ch.get("house"))
	var L: Array = [
		{"t": "Учиться вместе с принцем", "ok": func(): return not (JS.n(ch.get("study", -99)) > _day() - 7), "why": "На этой неделе уже было", "fx": func():
			ch.study = _day()
			ch.happy = JS.n(ch.happy) + 1
			ch.lrn = minf(20, JS.n(ch.get("lrn")) + 1)
			c.hud.say(n, "Спасибо, государь! Я буду стараться.")},
		{"t": "Написать его отцу добрые слова", "ok": func(): return not (JS.n(ch.get("wrote", -99)) > _day() - 21), "why": "Недавно уже писали", "fx": func():
			ch.wrote = _day()
			if H0 != null:
				SimPlayer.houseLoy(H0, 2)
			ch.happy = JS.n(ch.happy) + 1
			Sim.sfx("paper")
			c.hud.toast("Письмо отправлено в дом " + hn + ".")},
		{"t": "Отпустить домой", "fx": func(): c.hud.say(null, "Отпустить " + String(ch.name) + " домой? Дом " + hn + " будет благодарен, но вы лишитесь залога их верности.",
			{"choices": [{"t": "Отпустить", "fx": func(): release_ward(n, ch)}, {"t": "Нет"}], "esc": 1})},
		{"t": "Ступай"}]
	c.hud.say(n, mood, {"choices": L, "esc": L.size() - 1})

func release_ward(n: Dictionary, ch: Dictionary) -> void:
	var C: Dictionary = Sim.G.court
	var W: Array = C.get("wards", [])
	var i := W.find(ch.id)
	if i >= 0:
		W.remove_at(i)
	ch.ward = 0.0
	ch.atCourt = 0.0
	ch.away = 1.0
	var H0: Variant = SimDyn.houseOf(ch)
	if H0 != null:
		SimPlayer.houseLoy(H0, 8)
	c.aud.npc_leave(n)
	Sim.glog(String(ch.name) + " отпущен домой, в дом " + SimDyn.houseName(ch.get("house")) + ".", "info")
