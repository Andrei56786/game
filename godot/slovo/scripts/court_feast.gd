extends RefCounted
## Пир в пиршественном зале (feast.js): в день пира (G.court.feastDay — поручение сенешаля «Устроить пир») с 17:00 до 23:30 —
## семья и совет за высоким столом, гости из знатных домов (до трёх от дома, главы — ближе к королю), паж и служанка с блюдами,
## менестрель; гости входят по одному, пьют за короля и чокаются, над менестрелем — ноты, музыка пира. Король во главе стола —
## три дела за пир: поднять кубок за знать, почтить один из домов, песнь о деяниях, застольные разговоры (тайны), танец с
## королевой или состязание кубков; с гостем — выпить (дом +2, раз за пир), менестрель — песни. Знать пировала без короля —
## SimExt.feastDaily. G.court.feast = {day, done, n, sat, home, drank}. Случайные слова и удача — не из зерна королевства.
const Aud = preload("res://scripts/court_audience.gd")
const CT := 16
const FEAST_H0 := 17.0
const FEAST_H1 := 23.5
const FILL := ["Сэр Ивейн", "Леди Энида", "Сэр Бедивер", "Леди Линетта", "Сэр Гарет", "Леди Розамунда", "Сэр Персиваль", "Леди Матильда", "Сэр Тристрам", "Леди Изольда", "Сэр Ламорак", "Сэр Кай"]
const LINES := ["За короля!", "Ещё вина!", "Отменный эль!", "Кабанятины мне!", "Ваше здоровье, сэр!", "Ха-ха-ха!", "Тише, менестрель поёт!", "А помните ту зиму?..", "Пирог с голубями — чудо!", "Слава королю!", "Наливай!", "Передайте соль!"]
const HS := ["ht3", "ht2", "ht4", "ht1", "ht5", "ht0"]          # высокий стол: ближе к королю — первые
const SRV_WANDER := "wander:5,12,38,13@hall"                    # паж и служанка носят блюда между столами
const NOTE_C := [Color8(0xf7, 0xd3, 0x5c), Color8(0xf8, 0xf0, 0xd8), Color8(0xe8, 0x8a, 0x6a)]
var c: Node2D                    # court.gd
var on := false                  # FS.on: пир собран
var q: Array = []                # [человек, место]: кто войдёт в зал
var qt := 0.0
var chat := 0.0
var mus := ""
var notes: Array = []            # ноты над менестрелем
var seat := {}                   # ключ человека двора → место за столом
var chk := 0.0

func _init(court: Node2D) -> void:
	c = court

static func ok() -> bool:
	return not Sim.G.is_empty() and Sim.G.has("court")

static func _day() -> float:
	return float(Game.day)

static func _is(v: Variant, d: float) -> bool:
	return (v is float or v is int) and float(v) == d

static func _pick(L: Array) -> Variant:
	return L[randi() % L.size()]

static func _ch(p: float) -> bool:
	return randf() < p

## сортировка без перестановки равных (Array.sort в JS — устойчивая): f(a, b) < 0 — a раньше
static func ssort(L: Array, f: Callable) -> Array:
	var T: Array = []
	for i in L.size():
		T.append([L[i], i])
	T.sort_custom(func(x, y):
		var r: float = f.call(x[0], y[0])
		return r < 0.0 or (r == 0.0 and x[1] < y[1]))
	return T.map(func(x): return x[0])

## пир идёт (feastOn): день пира, 17:00–23:30
static func feast_on() -> bool:
	if not ok() or JS.t(Sim.G.get("visit")) or not _is(Sim.G.court.get("feastDay"), _day()):
		return false
	var h := Game.hour_abs()
	return h >= FEAST_H0 and h < FEAST_H1

static func label() -> String:
	if feast_on():
		return "Пир: занять место во главе стола"
	if ok() and _is(Sim.G.court.get("feastDay"), _day()) and Game.hour_abs() < FEAST_H0:
		return "Высокий стол: пир начнётся в 17:00"
	return "Высокий стол"

## что король сделал на этом пиру (feastSt)
static func st() -> Dictionary:
	var C: Dictionary = Sim.G.court
	var f: Variant = C.get("feast")
	if not (f is Dictionary) or f.get("day") != C.get("feastDay"):
		C.feast = {"day": C.get("feastDay"), "done": {}, "n": 0.0, "sat": 0.0, "home": 0.0, "drank": {}}
	return C.feast

static func tap_k() -> float:
	return 1.35 if SimDyn.projDone("tapestries") else 1.0

static func _char_of(n: Dictionary) -> Variant:
	if n.has("pch"):
		return n.pch
	return Sim.charOf(n.cid) if n.has("cid") else null

# ---------- кто приходит и где сидит ----------
## гости (feastGuests): от каждого живого дома — до трёх взрослых на свободе (главы — первыми), потом заполнители
func guests() -> Array:
	var G := Sim.G
	var fam := {}
	for x in SimDyn.royalFamily():
		fam[x.id] = true
	fam[G.player.char] = true
	var used := {}
	for n in c.npcs:
		var ch: Variant = _char_of(n)
		if ch != null:
			used[ch.id] = true
	var out: Array = []
	for H0 in G.houses:
		if not JS.t(H0.alive):
			continue
		var M: Array = SimDyn.houseMembers(H0.id).filter(func(x): return (JS.n(x.get("age")) >= 16 and x.get("prison") != null and float(x.prison) < 0.0
			and not JS.t(x.get("withKing")) and not JS.t(x.get("away")) and SimPlayer.armyOfGen(x.id) == null and not fam.has(x.id) and not used.has(x.id)))
		M = ssort(M, func(a, b):
			var d := (1.0 if b.id == H0.head else 0.0) - (1.0 if a.id == H0.head else 0.0)
			return d if d != 0.0 else JS.n(b.age) - JS.n(a.age))
		out.append_array(M.slice(0, 3))
	var head := func(x) -> float:
		var H0: Variant = SimDyn.houseOf(x)
		return 1.0 if H0 != null and H0.head == x.id else 0.0
	out = ssort(out, func(a, b): return head.call(b) - head.call(a))
	var i := 0
	while out.size() < 14 and i < FILL.size():
		var nm: String = FILL[i]
		out.append(Aud.pseudo(800 + i, "courtier", 1 if nm.begins_with("Леди") else 0, 22 + (i * 7) % 30, nm))
		i += 1
	return out.slice(0, 30)

## места за столами зала (feastSeats): ближе к высокому столу — первыми
func seats() -> Array:
	var Ld: Dictionary = c.D.locs.get("hall", {})
	var sp: Dictionary = Ld.get("spots", {})
	var k: Variant = sp.get("hall_king")
	if k == null:
		return []
	var re := RegEx.create_from_string("^s\\d+_\\d+[ns]$")
	var L: Array = (Ld.get("seats", []) as Array).duplicate() if Ld.has("seats") else sp.keys().filter(func(x): return re.search(String(x)) != null)
	var d := func(s) -> float:
		var A: Dictionary = sp[s]
		return JS.hypot(float(A.x) - float(k.x), (float(A.y) - float(k.y)) * 1.6)
	return ssort(L, func(a, b): return d.call(a) - d.call(b))

func clear() -> void:
	for n in c.npcs.filter(func(x): return JS.t(x.get("guest"))):
		c.drop_npc(n)
	for n in c.npcs:
		var ov: Variant = n.get("override")
		if ov is Dictionary and JS.t(ov.get("feast")):
			n.override = null
			n.cur = ""
	seat = {}

func begin() -> void:
	if not c.D.locs.has("hall"):
		return
	clear()
	on = true
	q = []
	qt = 0.0
	st()
	var S := seats()
	var court: Array = []
	var si := 0
	var sp: Dictionary = c.npc_by("spouse")
	if not sp.is_empty():
		court.append(sp)
	var kids: Array = c.npcs.filter(func(n):
		var k := String(n.key)
		var ch: Variant = _char_of(n)
		return (k.begins_with("kid") or k.begins_with("ward")) and ch != null and JS.n(ch.get("age")) >= 10)
	for n in ssort(kids, func(a, b): return JS.n(_char_of(b).age) - JS.n(_char_of(a).age)):
		court.append(n)
	for s: Dictionary in Sim.SEATS:
		var n: Dictionary = c.npc_by("seat_" + String(s.k))
		if not n.is_empty():
			court.append(n)
	for i in court.size():
		if i < HS.size():
			seat[court[i].key] = HS[i]
		elif si < S.size():
			seat[court[i].key] = S[si]
			si += 1
	seat["srv_page"] = SRV_WANDER
	seat["srv_maid"] = SRV_WANDER
	seat_all()
	for ch in guests():
		if si < S.size():
			q.append([ch, S[si]])
			si += 1
	q.insert(mini(3, q.size()), [Aud.pseudo(861, "minstrel", 0, 31, "Менестрель Ален"), "minstrel"])
	if c.loc_id != "hall":
		while not q.is_empty():
			spawn(q.pop_front(), false)
	else:
		c.hud.toast("Гости входят в зал: пир начинается!")
	if c.loc_id != "hall" and JS.t(Sim.G.get("atCourt")):
		c.hud.toast("Пир начинается! Знать собирается в пиршественном зале.")
		Snd.sfx("fanfare_small")
	print("FEAST BEGIN ", seat.size(), " ", q.size())

## семья, совет и слуги — к своим местам (feastSeatAll), раз в секунду: кто вернулся ко двору, тоже идёт
func seat_all() -> void:
	for k in seat:
		var n: Dictionary = c.npc_by(k)
		if n.is_empty() or JS.t(n.get("follow")):
			continue
		var ov: Variant = n.get("override")
		if ov is Dictionary and JS.t(ov.get("feast")):
			continue
		n.override = {"spot": seat[k], "until": FEAST_H1, "day": Game.day, "feast": 1}
		n.cur = ""
		n.wander = null

## гость за стол (feastSpawn): входит в дверь зала и идёт к месту — или, если король не видит, уже сидит
func spawn(e: Array, walk: bool) -> void:
	var ch: Dictionary = e[0]
	var s: String = e[1]
	var sp: Dictionary = c.spots.get(s, {})
	if sp.is_empty():
		return
	var mn := s == "minstrel"
	var key := "fs_min" if mn else "fg" + JS.s(ch.id)
	if not c.npc_by(key).is_empty():
		return
	var H0: Variant = null if JS.t(ch.get("pseudo")) else SimDyn.houseOf(ch)
	var n: Dictionary = c.people.mk(c.npcs, {}, key, ch, {"visitor": true, "guest": 1, "spd": 44.0,
		"sub0": "Менестрель" if mn else ("Гость · дом " + String(H0.name) if H0 != null else "Гость пира")})
	if JS.t(ch.get("pseudo")):
		n.pch = ch
	if walk:
		c.people.place(n, c.spots.hall_in)
		n.away = false
		c.people.go_sp(n, sp, null)
	else:
		c.people.place(n, sp)
		n.away = false
		n.x = float(sp.get("sx", sp.x))
		n.y = float(sp.get("sy", sp.y))
		n.sit = sp if JS.t(sp.get("sit")) else null

## пир окончен (feastFinish): гости уходят в дверь зала (если король видит) или сразу
func finish() -> void:
	on = false
	q = []
	var here: bool = c.loc_id == "hall"
	for n in c.npcs:
		var ov: Variant = n.get("override")
		if ov is Dictionary and JS.t(ov.get("feast")):
			n.override = null
			n.cur = ""
	for n in c.npcs.filter(func(m): return JS.t(m.get("guest"))):
		if here and n.loc == "hall":
			c.people.go_to(n, "hall_in", func(m): c.drop_npc(m))
		else:
			c.drop_npc(n)
	seat = {}
	# reign.js: пир — в счёт царствования, в летопись — не чаще раза в сезон
	var R0: Variant = SimArmy.reignInit()
	if R0 != null:
		R0.st.feasts += 1
		var last: Variant = null
		for i in range(R0.chron.size() - 1, -1, -1):
			if R0.chron[i].k == "feast":
				last = R0.chron[i]
				break
		if last == null or Sim.G.day - last.d > Sim.DAYS_SEASON:
			SimArmy.chron("Пир в большом зале.", "cup", "feast", 1.0)
	print("FEAST END")

func line(n: Dictionary) -> String:
	var ch: Variant = _char_of(n)
	var H0: Variant = SimDyn.houseOf(ch) if ch != null and not JS.t(ch.get("pseudo")) else null
	if H0 != null and _ch(0.25):
		return _pick(["Пьём королевское вино… и молчим.", "Пир щедрый. А земли — всё те же.", "Гм. За короля, конечно."]) if JS.n(H0.loy) < 35 else "За дом " + String(H0.name) + "!"
	if String(n.get("seat", "")) != "" and _ch(0.3):
		return _pick(["Государь, отменный пир!", "Сенешаль превзошёл себя.", "Такого пира не помнят и старики."])
	return _pick(LINES)

## каждый кадр двора (UPD_EXT): начало и конец, места, гости в дверях, застольные речи, ноты, музыка пира
func update(dt: float) -> void:
	if not ok() or JS.t(Sim.G.get("visit")):
		return
	var o := feast_on()
	var here: bool = c.loc_id == "hall"
	if o and not on:
		begin()
	elif not o and on:
		finish()
	if on:
		var S := st()
		if JS.t(Sim.G.get("atCourt")):
			S.home = 1.0
		chk -= dt
		if chk < 0.0:
			chk = 1.0
			seat_all()
		if not q.is_empty():
			if not here:
				while not q.is_empty():
					spawn(q.pop_front(), false)
			else:
				qt -= dt
				if qt < 0.0:
					qt = 0.55
					spawn(q.pop_front(), true)
		if here:
			chat -= dt
			if chat < 0.0:
				chat = randf_range(1.3, 2.8)
				var L: Array = c.npcs.filter(func(m): return m.loc == "hall" and m.sit != null and String(m.bub) == "" and not m.away)
				if not L.is_empty():
					var n: Dictionary = _pick(L)
					c.people.say(n, line(n), 3.0)
					if _ch(0.3):
						Snd.sfx("clink")
		var mn: Dictionary = c.npc_by("fs_min")
		if here and not mn.is_empty() and mn.loc == "hall" and mn.path == null and mn.goal == null and _ch(dt * 2.4):
			notes.append({"x": float(mn.x) + randf_range(-5, 6), "y": float(mn.y) - 24.0, "t": 0.0, "c": _pick(NOTE_C)})
	for p in notes:
		p.t += dt
	if not notes.is_empty():
		notes = notes.filter(func(p): return p.t < 1.6)
	var m := "feast" if on and here else ""
	if m != mus:
		mus = m
		Snd.music(m if m != "" else "auto")

## ноты над менестрелем (CRENDER2)
func draw(nd: Node2D) -> void:
	if c.loc_id != "hall" or notes.is_empty():
		return
	for p in notes:
		var t: float = p.t
		var x := roundf(float(p.x) + sin(t * 5.0 + float(p.x)) * 3.0)
		var y := roundf(float(p.y) - t * 16.0)
		var col: Color = p.c
		col.a = clampf(1.6 - t, 0, 1)
		nd.draw_rect(Rect2(x + 2, y - 5, 1, 5), col)
		nd.draw_rect(Rect2(x, y - 1, 3, 2), col)
		nd.draw_rect(Rect2(x + 3, y - 5, 2, 1), col)
		nd.draw_rect(Rect2(x + 4, y - 4, 1, 1), col)

## вошли ко двору (ENTER_EXT): гостей прошлого пира нет, музыка — по месту
func enter() -> void:
	clear()
	on = false
	q = []
	mus = ""

# ---------- король во главе стола ----------
func _sp_king() -> Dictionary:
	return c.spots.get("hall_king", {})

## высокий стол (ACTS_EXT.hall_king): вне пира — велеть сенешалю готовить пир или посидеть; на пиру — сесть и выбрать
func hall_king() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var sp := _sp_king()
	if not feast_on():
		var od: Variant = C.get("orders")
		var cur: Variant = od.get("seneschal") if od is Dictionary else null
		var sen: Variant = SimDyn.seatChar("seneschal")
		var d: Variant = SimCourt.ordDef("seneschal", "feast")
		var busy: bool = cur is Dictionary and cur.get("k") == "feast"
		var t: String = "Слуги расставляют блюда и кувшины: пир начнётся в 17:00." if _is(C.get("feastDay"), _day()) else \
			"Высокий стол пуст. " + ("Сенешаль уже готовит пир — " + SimText.inDays(int(JS.n(cur.day0) + JS.n(cur.dur) - JS.n(G.day))) + ", с 17:00." if busy else "Пиры устраивает сенешаль: поручение «Устроить пир».")
		var tip: Variant = ["Заменит текущее поручение сенешаля."] if cur is Dictionary and not busy else null
		c.hud.say(null, t, {"name": "Высокий стол", "choices": [
			{"t": "Велеть сенешалю готовить пир (" + JS.s(d.cost if d != null else 0) + " зол., " + JS.s(d.dur if d != null else 0) + " дн.)", "tip": tip,
				"ok": func(): return sen != null and not busy and not _is(C.get("feastDay"), _day()), "why": "Сенешаля нет — некому готовить пир" if sen == null else "Пир уже готовится",
				"fx": func(): SimCourt.giveOrder("seneschal", "feast", "intent")},
			{"t": "Посидеть во главе стола", "fx": func(): c.sit_at(sp)},
			{"t": "Уйти"}], "esc": 2})
		print("HIGH TABLE 0")
		return
	c.sit_at(sp)
	var S := st()
	if not JS.t(S.sat):
		S.sat = 1.0
		for H0 in G.houses:
			if JS.t(H0.alive):
				SimPlayer.houseLoy(H0, 1)
		Snd.sfx("cheer")
		for n in c.npcs:
			if JS.t(n.get("guest")) and n.loc == "hall" and n.sit != null and _ch(0.4):
				c.people.say(n, _pick(["Слава королю!", "Король с нами!", "За короля!"]), 2.5)
	menu()

## что сделает король на пиру (feastMenu): три дела за пир
func menu() -> void:
	var S := st()
	var k: Dictionary = SimPlayer.kingC()
	var qc: Variant = Sim.charOf(k.spouse) if JS.n(k.get("spouse", -1)) >= 0 else null
	var qn: Dictionary = c.npc_by("spouse") if qc != null and JS.t(qc.alive) else {}
	var tap := tap_k()
	var why := func(key: String) -> String:
		return "Уже было на этом пиру" if JS.t(S.done.get(key)) else "На сегодня довольно: гости и так уже под столами"
	var mv := func(key: String, t: String, tip: Variant, okf: Variant, why2: Variant, fx: Callable) -> Dictionary:
		return {"t": t, "tip": tip, "ok": func(): return not JS.t(S.done.get(key)) and S.n < 3 and (okf == null or (okf as Callable).call()),
			"why": why.call(key) if JS.t(S.done.get(key)) or S.n >= 3 else why2,
			"fx": func():
				S.done[key] = 1.0
				S.n += 1
				fx.call()}
	var fem: bool = JS.t(k.get("fem"))
	var ch: Array = [mv.call("toast", "Поднять кубок за верную знать", ["Все дома: верность +" + JS.s(JS.rnd(2 * tap)) + ", слава +1"], null, null, toast_),
		{"t": "Почтить один из домов…", "tip": ["Выбранный дом: верность +" + JS.s(JS.rnd(7 * tap)) + ".", "Самый верный дом может приревновать."],
			"ok": func(): return not JS.t(S.done.get("honor")) and S.n < 3, "why": why.call("honor"), "fx": honor},
		mv.call("song", "Велеть менестрелю петь о ваших деяниях", ["Слава +" + ("2" if SimDyn.projDone("chronicle") else "1")], func(): return not c.npc_by("fs_min").is_empty(), "Менестрель ещё не пришёл", song),
		mv.call("gossip", "Прислушаться к застольным разговорам", ["Хмельные гости болтают лишнее."], null, null, gossip)]
	if not qn.is_empty():
		ch.append(mv.call("dance", "Танцевать с супругом" if fem else "Танцевать с королевой", ["Супруг(а) будет счастлив(а); вечер вместе."], func(): return qn.loc == "hall",
			("Супруга" if fem else "Королевы") + " ещё нет за столом", dance))
	else:
		ch.append(mv.call("drink", "Состязание: кто кого перепьёт", ["Рыцари любят королей, которые не боятся кубка."], null, null, drink))
	ch.append({"t": "Сидеть и пировать дальше"})
	ch.append({"t": "Встать из-за стола", "fx": func(): c.stand_up()})
	c.hud.say(null, "Пир идёт своим чередом." if S.n >= 3 else "Пир в разгаре. Что сделает " + ("королева" if fem else "король") + "? (ещё " + JS.s(3 - S.n) + ")", {"name": "Пир", "choices": ch, "esc": 5})
	print("FEAST MENU ", ch.size(), " ", JS.s(S.n))

## через t секунд (setTimeout): таймер — в узле двора (идёт и при открытом окне); двор закрыли — не сработает
func later(t: float, f: Callable) -> void:
	var tm := Timer.new()
	tm.one_shot = true
	tm.wait_time = t
	tm.timeout.connect(func():
		f.call()
		tm.queue_free())
	c.add_child(tm)
	tm.start()

## все сидящие в зале — с вероятностью p — что-нибудь из L (hallSay)
func hall_say(p: float, L: Array, d := 3.0) -> void:
	for n in c.npcs:
		if n.loc == "hall" and n.sit != null and not n.away and _ch(p):
			c.people.say(n, _pick(L), d)

func toast_() -> void:
	var tap := tap_k()
	for H0 in Sim.G.houses:
		if JS.t(H0.alive):
			SimPlayer.houseLoy(H0, JS.rnd(2 * tap))
	SimCourt.prestige(1)
	Snd.sfx("clink")
	later(0.3, func(): Snd.sfx("cheer"))
	hall_say(0.6, ["За короля!", "Слава!", "За короля и королевство!"])
	c.hud.say(null, "Вы поднимаетесь с кубком: «За тех, кто стоит рядом со мной — за этим столом и в поле!» Зал встаёт и ревёт в ответ.", {"name": "Пир"})

func honor() -> void:
	var G := Sim.G
	var S := st()
	var tap := tap_k()
	var A: Array = G.houses.filter(func(H0): return JS.t(H0.alive))
	var L: Array = ssort(A, func(a, b): return JS.n(a.loy) - JS.n(b.loy)).slice(0, 5)
	var tops: Array = ssort(A, func(a, b): return JS.n(b.loy) - JS.n(a.loy))
	var top: Variant = tops[0] if not tops.is_empty() else null
	var ch: Array = []
	for H0 in L:
		ch.append({"t": "Дом " + String(H0.name) + " (верность " + JS.s(JS.rnd(JS.n(H0.loy))) + ")", "fx": func():
			S.done.honor = 1.0
			S.n += 1
			SimPlayer.houseLoy(H0, JS.rnd(7 * tap))
			var t := "Вы сажаете главу дома " + String(H0.name) + " по правую руку и сами наполняете кубок. Дом " + String(H0.name) + " этого не забудет."
			if top != null and not is_same(top, H0) and A.size() > 2:
				SimPlayer.houseLoy(top, -1)
				t += " Дом " + String(top.name) + " косится: отчего не их?"
			for n in c.npcs:
				var hc: Variant = _char_of(n)
				if JS.t(n.get("guest")) and hc != null and hc.id == H0.head:
					c.people.say(n, "Великая честь, государь!", 3.5)
					break
			Snd.sfx("clink")
			c.hud.say(null, t, {"name": "Пир"})})
	ch.append({"t": "Передумать", "fx": func(): menu()})
	c.hud.say(null, "Кого почтить при всех?", {"name": "Пир", "choices": ch, "esc": ch.size() - 1})

## о чём поёт менестрель (kingDeeds)
func deeds() -> Array:
	var G := Sim.G
	var k: Dictionary = SimPlayer.kingC()
	var C: Dictionary = G.court
	var T: Dictionary = C.get("trophies", {}) if C.get("trophies") is Dictionary else {}
	var S: Dictionary = G.get("stats", {}) if G.get("stats") is Dictionary else {}
	var pr: Variant = C.get("proj")
	var pd: int = (pr.done as Dictionary).size() if pr is Dictionary and pr.get("done") is Dictionary else 0
	var kids := 0
	for id in k.get("kids", []):
		var x: Variant = Sim.charOf(id)
		if x != null and JS.t(x.alive):
			kids += 1
	var D: Array = []
	if JS.t(S.get("won")):
		D.append("о " + JS.s(S.won) + " " + SimText.plural(S.won, "победе", "победах", "победах") + " в поле")
	if JS.t(S.get("sieges")):
		D.append("о взятых крепостях")
	if JS.t(T.get("bear")):
		D.append("о медведе, сражённом королевской рукой")
	if JS.t(T.get("boar")):
		D.append("о кабане, что не устоял перед королём")
	if JS.t(T.get("deer")):
		D.append("об оленях королевского леса")
	if C.get("tour") is Dictionary and C.tour.get("king") == "win":
		D.append("о победе на турнире")
	if pd > 0:
		D.append("о новых чудесах столицы")
	if kids > 0:
		D.append("о юных принцах" if kids > 1 else "о юном наследнике")
	if D.is_empty():
		D.append("о славных делах, что ещё впереди")
	D.shuffle()
	return D.slice(0, 3)

func song() -> void:
	var k: Dictionary = SimPlayer.kingC()
	var p := 2.0 if SimDyn.projDone("chronicle") else 1.0
	SimCourt.prestige(p)
	Snd.sfx("strum")
	var mn: Dictionary = c.npc_by("fs_min")
	if not mn.is_empty():
		c.people.say(mn, "«О, " + ("славная королева " if JS.t(k.get("fem")) else "славный король ") + String(k.name) + "…»", 4.5)
	later(1.5, func(): hall_say(0.35, ["Браво!", "Ещё!", "Слава!"]))
	c.hud.say(null, "Менестрель ударяет по струнам и поёт " + ", ".join(PackedStringArray(deeds())) + ". Зал подхватывает припев" + (", а летописец записывает каждое слово" if p > 1 else "") + ".", {"name": "Песнь"})

## застольные разговоры (feastGossip): хмельной гость может выдать тайну двора; иначе — слухи о домах и державах
func gossip() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var eye: bool = not c.npc_by("seat_eye").is_empty()
	var s: Variant = null
	for x in C.get("secrets", []):
		if not JS.t(x.get("known")) and x.k != "love":
			s = x
			break
	if s != null and _ch(0.3 + (0.2 if eye else 0.0)):
		s.known = 1.0
		s.how = "застольная болтовня"
		c.hud.say(null, "Захмелевший гость болтает лишнее, а вы слушаете. " + SimCourt.secretText(s), {"name": "Застольные разговоры"})
		Sim.glog("На пиру открылась тайна: " + SimCourt.secretText(s), "info")
		print("GOSSIP secret ", s.k)
		return
	var L: Array = []
	var bad: Array = ssort(G.houses.filter(func(H0): return JS.t(H0.alive) and JS.n(H0.loy) < 40), func(a, b): return JS.n(a.loy) - JS.n(b.loy))
	if not bad.is_empty():
		L.append("За дальним столом люди дома " + String(bad[0].name) + " шепчутся и смолкают, едва вы смотрите в их сторону.")
	var W2: Array = []
	for a in range(1, 5):
		for b in range(a + 1, 5):
			if SimDay.alive(a) and SimDay.alive(b) and JS.t(G.rel[a][b].get("war")):
				W2.append([a, b])
	if not W2.is_empty():
		var w: Array = _pick(W2)
		L.append("Рыцари спорят до хрипоты, кто возьмёт верх в войне: " + Sim.realmName(w[0]) + " или " + Sim.realmName(w[1]) + ".")
	var rich: Array = ssort([1, 2, 3, 4].filter(func(r): return SimDay.alive(r)), func(a, b): return JS.n(G.realms[b].gold) - JS.n(G.realms[a].gold))
	if not rich.is_empty():
		L.append("Купеческий сын клянётся, что казна державы " + Sim.realmName(rich[0]) + " ломится от золота.")
	L.append("Старый рыцарь в третий раз рассказывает, как в юности победил дракона. Дракон с каждым разом всё больше.")
	c.hud.say(null, _pick(L), {"name": "Застольные разговоры"})
	print("GOSSIP ", L.size())

func dance() -> void:
	var k: Dictionary = SimPlayer.kingC()
	var qc: Variant = Sim.charOf(k.spouse)
	if qc != null:
		qc.happy = JS.clp(float(JS.o(qc.get("happy"), 60.0)) + 6, 0, 100)
		qc.loy = JS.clp(float(JS.o(qc.get("loy"), 60.0)) + 2, 0, 100)
	Sim.G.court.together = Sim.G.day
	Snd.sfx("strum")
	var n: Dictionary = c.npc_by("spouse")
	if not n.is_empty():
		c.people.say(n, _pick(["Как в первый год, помните?", "Вы наступили мне на ногу, ваше величество.", "Ещё один круг!"]), 3.5)
	c.hud.say(null, "Вы ведёте " + ("супруга" if JS.t(k.get("fem")) else "королеву") + " в круг. Музыканты играют быстрее, гости хлопают в ладоши.", {"name": "Пир"})

func drink() -> void:
	var k: Dictionary = SimPlayer.kingC()
	var tr: Array = k.get("traits", [])
	var win := _ch(JS.clp(0.45 + (JS.n(k.mar) - 10) * 0.02 + (0.15 if tr.has("reckless") else 0.0) - (0.1 if tr.has("cautious") else 0.0), 0.15, 0.85))
	Snd.sfx("clink")
	if win:
		SimCourt.prestige(1)
		c.hud.say(null, "Кубок за кубком… Последним за столом остаётся король. Рыцари стучат кулаками по доскам: вот это государь!", {"name": "Пир"})
	else:
		for H0 in Sim.G.houses:
			if JS.t(H0.alive):
				SimPlayer.houseLoy(H0, 1)
		c.hud.say(null, "Старый барон перепивает вас и сам же уносит под руку. Зал хохочет — по-доброму: король, что умеет проигрывать, нравится всем.", {"name": "Пир"})

# ---------- гости и менестрель ----------
func talk(n: Dictionary) -> void:
	if n.key == "fs_min":
		minstrel_talk(n)
	else:
		guest_talk(n)

func guest_talk(n: Dictionary) -> void:
	var ch: Variant = _char_of(n)
	if ch == null:
		return
	var H0: Variant = null if JS.t(ch.get("pseudo")) else SimDyn.houseOf(ch)
	var S := st()
	var loy: float = JS.n(H0.loy) if H0 != null else 60.0
	var key: String = "h" + JS.s(H0.id) if H0 != null else "c" + JS.s(ch.id)
	if not feast_on():
		c.hud.say(n, "Доброй ночи, государь. Славный был пир.")
		return
	var ln: String = _pick(["Вино у вас доброе, государь. Жаль, что не всё в королевстве так же сладко.", "Пир щедрый. Наш дом запомнит щедрость… и всё остальное тоже."]) if loy < 30 else \
		(_pick(["Благодарю за приглашение, государь.", "Отличный эль. Говорят, сенешаль сам выбирал бочки."]) if loy < 55 else _pick(["Долгих лет вашему величеству!", "Наш дом всегда за вас, государь!", "Лучший пир за много лет!"]))
	c.hud.say(n, ln, {"choices": [{"t": "Выпить с " + ("ней" if JS.t(ch.get("fem")) else "ним"), "tip": ["Дом " + String(H0.name) + ": верность +2 (раз за пир)"] if H0 != null else null,
		"ok": func(): return not JS.t(S.drank.get(key)), "why": "С домом " + String(H0.name) + " сегодня уже пили" if H0 != null else "Уже пили вместе",
		"fx": func():
			S.drank[key] = 1.0
			if H0 != null:
				SimPlayer.houseLoy(H0, 2)
			c.people.say(n, _pick(["За ваше здоровье!", "До дна!", "Ваше величество!"]), 3.0)
			Snd.sfx("clink")},
		{"t": "Отойти"}], "esc": 1})

func minstrel_talk(n: Dictionary) -> void:
	var S := st()
	c.hud.say(n, _pick(["Какую песню желает государь?", "Для вашего величества — хоть до рассвета!"]), {"choices": [
		{"t": "Сыграй что-нибудь весёлое", "fx": func():
			Snd.sfx("strum")
			c.people.say(n, "«Тра-ля-ля, тра-ля-ля…»", 3.0)
			hall_say(0.3, ["Ха-ха!", "Браво!", "Ещё!"], 2.5)},
		{"t": "Спой о моих деяниях", "ok": func(): return feast_on() and not JS.t(S.done.get("song")) and S.n < 3, "why": "Песнь уже спета" if JS.t(S.done.get("song")) else "На сегодня довольно",
			"fx": func():
				S.done.song = 1.0
				S.n += 1
				song()},
		{"t": "Играй дальше"}], "esc": 2})

# ---------- самопроверка без экрана (main.gd: -- --feast) ----------
func _choice(text: String) -> int:
	var d: Variant = c.hud.dlg
	if d == null:
		return -1
	var L: Array = d.choices
	for i in L.size():
		if String(L[i].t).begins_with(text):
			return i
	return -1

func _dlg_name() -> String:
	return String(c.hud.dlg.name) if c.hud.dlg != null else ""

func _dlg_text() -> String:
	if c.hud.dlg == null:
		return ""
	var t := ""
	for pg in c.hud.dlg.pages:
		t += " ".join(pg) + " "
	return t

func _close() -> void:
	while c.hud.dlg != null:
		c.hud.close_dlg()

func _loy() -> float:
	var v := 0.0
	for H0 in Sim.G.houses:
		if JS.t(H0.alive):
			v += JS.n(H0.loy)
	return v

func _gl() -> Array:
	return c.npcs.filter(func(n): return JS.t(n.get("guest")))

func _hk() -> void:
	c.do_act({"id": "hall_king", "label": ""})

func selftest() -> bool:
	if not ok():
		print("selftest: пир — нет королевства")
		return false
	var G := Sim.G
	var C: Dictionary = G.court
	var res := true
	Game.speed = 1
	# не день пира: высокий стол пуст — поручение сенешалю или посидеть
	C.erase("feastDay")
	C.erase("feast")
	Game.set_hour(12.0)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	c.cmd(PackedStringArray(["spot", "throne_front"]))
	var lab0 := label()
	_hk()
	var t0 := _dlg_text()
	var n0: int = (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	var ok0 := _dlg_name() == "Высокий стол" and t0.begins_with("Высокий стол пуст.") and n0 == 3 and lab0 == "Высокий стол"
	_close()
	# день пира, до 17:00: слуги накрывают; поручение — «пир уже готовится»
	C.feastDay = float(Game.day)
	var lab1 := label()
	_hk()
	var t1 := _dlg_text()
	c.hud.choose(0)
	var ok1 := lab1 == "Высокий стол: пир начнётся в 17:00" and t1.begins_with("Слуги расставляют блюда") and _dlg_name() == "Высокий стол"
	_close()
	print("selftest: пир — вне пира «", lab0, "» (выборов ", n0, "), в день пира «", lab1, "», поручение не дано ", ok1)
	res = res and ok0 and ok1
	# 17:00, король в главной зале: гости уже за столами, семья и совет — к высокому столу, менестрель
	var exp_g: int = mini(guests().size(), seats().size()) + 1
	Game.set_hour(17.02)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	c._tick(0.05)
	var gl := _gl()
	var sat_n: int = gl.filter(func(n): return n.loc == "hall" and n.sit != null).size()
	var mn: Dictionary = c.npc_by("fs_min")
	var sp: Dictionary = c.npc_by("spouse")
	var ht_ok: bool = sp.is_empty() or String(seat.get(sp.key, "")) == "ht3"
	var lab2 := label()
	print("selftest: пир — начался ", on, ", гостей ", gl.size(), " (ждали ", exp_g, "), за столами ", sat_n, ", менестрель ", not mn.is_empty(), ", мест у своих ", seat.size(),
		", супруг(а) у высокого стола ", ht_ok, ", подпись «", lab2, "»")
	res = res and on and gl.size() == exp_g and sat_n >= gl.size() - 1 and not mn.is_empty() and String(mn.get("sub", "")) == "Менестрель" and ht_ok \
		and seat.get("srv_page") == SRV_WANDER and lab2 == "Пир: занять место во главе стола"
	# король входит в зал и садится во главе стола: знать довольна (раз за пир), три дела за пир
	c.go_loc("hall")
	c.king.x = 22.0 * CT
	c.king.y = 7.0 * CT + 8
	var loy0 := _loy()
	var pr0 := JS.n(C.get("prestige"))
	_hk()
	var S := st()
	var sat_ok: bool = c.king.sit != null and c.king.sit == c.spots.get("hall_king") and JS.t(S.sat) and _loy() > loy0
	var nm := (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	var t3 := _dlg_text()
	var loy1 := _loy()
	c.hud.choose(_choice("Поднять кубок"))
	var toast_ok: bool = _dlg_name() == "Пир" and _loy() > loy1 and JS.n(C.get("prestige")) == JS.clp(pr0 + 1, -100, 100) and JS.n(S.n) == 1.0
	_close()
	_hk()
	c.hud.choose(_choice("Почтить один из домов"))
	var hn: int = (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	var A: Array = G.houses.filter(func(H0): return JS.t(H0.alive))
	var low: Variant = ssort(A, func(a, b): return JS.n(a.loy) - JS.n(b.loy))[0]
	var hl0 := JS.n(low.loy)
	c.hud.choose(0)
	var honor_ok: bool = _dlg_name() == "Пир" and JS.n(low.loy) == minf(100, hl0 + JS.rnd(7 * tap_k())) and JS.n(S.n) == 2.0 and JS.t(S.done.get("honor"))
	_close()
	var pr1 := JS.n(C.get("prestige"))
	_hk()
	c.hud.choose(_choice("Велеть менестрелю петь"))
	var song_ok: bool = _dlg_name() == "Песнь" and JS.n(C.get("prestige")) == JS.clp(pr1 + (2 if SimDyn.projDone("chronicle") else 1), -100, 100) and JS.n(S.n) == 3.0
	_close()
	_hk()
	var t4 := _dlg_text()
	c.hud.choose(_choice("Прислушаться"))
	var enough: bool = t4.begins_with("Пир идёт своим чередом.") and _dlg_name() == "Пир" and JS.n(S.n) == 3.0
	_close()
	print("selftest: пир — во главе стола ", sat_ok, " (выборов ", nm, ", «", t3.left(40), "»), кубок ", toast_ok, ", почтить (домов ", hn - 1, ") ", honor_ok, ", песнь ", song_ok, ", на сегодня довольно ", enough)
	res = res and sat_ok and nm == 7 and t3.contains("(ещё 3)") and toast_ok and hn >= 2 and honor_ok and song_ok and enough
	# гость: выпить с ним (дом +2, раз за пир); менестрель: весёлое
	var hg: Array = _gl().filter(func(n): return n.has("cid") and not n.has("pch") and SimDyn.houseOf(Sim.charOf(n.cid)) != null)
	var drink_ok := false
	if not hg.is_empty():
		var H0: Variant = SimDyn.houseOf(Sim.charOf(hg[0].cid))
		var l0 := JS.n(H0.loy)
		talk(hg[0])
		c.hud.choose(0)
		var once: bool = JS.n(H0.loy) == minf(100, l0 + 2) and JS.t(S.drank.get("h" + JS.s(H0.id)))
		talk(hg[0])
		c.hud.choose(0)
		drink_ok = once and c.hud.dlg != null and JS.n(H0.loy) == minf(100, l0 + 2)
		_close()
	talk(mn)
	c.hud.choose(_choice("Сыграй что-нибудь весёлое"))
	var merry: bool = String(mn.bub).begins_with("«Тра-ля-ля")
	_close()
	# три секунды пира в зале: застольные речи, ноты над менестрелем, музыка пира, блюда на столах
	var said := 0
	var nmax := 0
	for i in 60:
		c._tick(0.05)
		nmax = maxi(nmax, notes.size())
	for n in c.npcs:
		if n.loc == "hall" and String(n.bub) != "":
			said += 1
	var plat: int = c.conds.filter(func(p): return (p[0] as Sprite2D).visible).size()
	print("selftest: пир — гостей с домом ", hg.size(), ", выпили ", drink_ok, ", менестрель ", merry, ", говорят ", said, ", нот ", nmax, ", музыка «", mus, "», блюд на столах ", plat)
	res = res and drink_ok and merry and said >= 1 and nmax >= 1 and mus == "feast" and plat >= 5
	# 23:30 — пир окончен: гости уходят в дверь зала, свои — по расписанию
	Game.set_hour(23.52)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	c.stand_up()
	var fr := 0
	c._tick(0.05)
	var ended := not on
	while fr < 3000 and not _gl().is_empty():
		c._tick(0.05)
		fr += 1
	var ov_left: int = c.npcs.filter(func(n): return n.get("override") is Dictionary and JS.t(n.override.get("feast"))).size()
	var plat2: int = c.conds.filter(func(p): return (p[0] as Sprite2D).visible).size()
	# знать пировала без короля — назавтра дома недовольны
	S.sat = 0.0
	S.home = 1.0
	var l2 := _loy()
	var d0: float = G.day
	G.day = float(C.feastDay) + 1
	SimExt.feastDaily()
	var sulk: bool = _loy() < l2
	G.day = d0
	S.sat = 1.0
	print("selftest: пир — окончен ", ended, ", гости ушли ", _gl().is_empty(), " (кадров ", fr, "), места свободны ", ov_left == 0, ", блюд ", plat2, ", знать без короля недовольна ", sulk)
	res = res and ended and _gl().is_empty() and ov_left == 0 and plat2 == 0 and sulk
	C.erase("feastDay")
	print("selftest: пир — ", "OK" if res else "FAIL")
	return res
