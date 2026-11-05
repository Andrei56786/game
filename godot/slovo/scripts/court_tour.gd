extends RefCounted
## Турнир на ристалище замка (feast.js: TRN): в день турнира (G.court.tour — поручение сенешаля «Турнир» при готовых
## трибунах) с 10:00 до 16:00 восемь рыцарей бьются на копьях — семь поединков (первый круг, полуфиналы, финал) к часам
## BOUT_H. Король у ристалища — сшибки видны (всадники, щепки, глашатай, крики трибун), часы двора идут медленнее; без
## него поединки досчитываются. Семья и совет — на трибунах, по двое от каждого дома — у барьера, герольд. Король может
## выйти на ристалище сам (E или щелчок, когда острие копья на середине щита), вручить награду победителю. Падение может
## стоить раны (court_hurt.gd). Участники — в G.court.tour (SimCourt.tourSetup); удача в поединках — не из зерна королевства.
const Aud = preload("res://scripts/court_audience.gd")
const Feast = preload("res://scripts/court_feast.gd")
const Hurt = preload("res://scripts/court_hurt.gd")
const CT := 16
const DIRS := ["down", "left", "right", "up"]
const TOUR_H0 := 10.0
const TOUR_H1 := 16.0
const LANE_N := 20 * CT + 4
const LANE_S := 22 * CT + 14
const LX0 := 54 * CT
const LX1 := 69 * CT + 8
const BOUT_H := [10.2, 10.9, 11.6, 12.3, 13.0, 13.7, 14.4]
const TOUR_COL := [["black", "gold"], ["forest", "white"], ["gray", "red"], ["purple", "gold"], ["teal", "white"], ["orange", "black"], ["wine", "white"], ["navy", "gold"]]
const STANDS := ["stand0", "stand2", "stand3", "stand4", "stand5", "stand6", "stand7", "stand8", "stand9", "stand10"]
const CROWD := ["Ах!", "Вперёд!", "Браво!", "Ещё!", "Держись в седле!", "Ура!"]
const CHAT := ["Вот это удар!", "Ставлю серебро!", "Какой конь!", "Слава королю!"]
const SPLINTER := ["#e8d0a0", "#c8a060", "#8a6a40"]
var c: Node2D                    # court.gd
var on := false                  # TRN.on: турнир собран (зрители, герольд)
var b: Variant = null            # поединок на виду: {a, b, king, pn, ph, t, dir, sa, sb, un, ku, xa, xb, va, vb, roll, brkA, brkB, fall, fa, fb, fin, w, aim, lock, q}
var kj: Variant = null           # поединок самого короля (то же; king — его противник)
var kq := false                  # король выходит к барьеру следующим
var parts: Array = []            # щепки копий
var pc := {}                     # заезжие рыцари: имя → pseudoChar
var chat := 0.0
var cols := {}                   # цвета палитр (RAMP): имя → [Color × 5]

func _init(court: Node2D) -> void:
	c = court

static func ok() -> bool:
	return not Sim.G.is_empty() and Sim.G.has("court")

static func _day() -> float:
	return float(Game.day)

static func _pick(L: Array) -> Variant:
	return L[randi() % L.size()]

static func _ch(p: float) -> bool:
	return randf() < p

## турнир сегодня и ещё не окончен (tourT)
static func tour_t() -> Variant:
	if not ok():
		return null
	var T: Variant = Sim.G.court.get("tour")
	return T if T is Dictionary and JS.n(T.get("day")) == _day() and not JS.t(T.get("done")) else null

## турнир идёт (tourOn): трибуны построены, 10:00–16:00
static func tour_on() -> bool:
	if tour_t() == null or JS.t(Sim.G.get("visit")) or not SimDyn.projDone("stands"):
		return false
	var h := Game.hour_abs()
	return h >= TOUR_H0 and h < TOUR_H1

## подпись ристалища (tourLabel)
static func label() -> String:
	if not ok() or not SimDyn.projDone("stands"):
		return "Турнирное поле"
	var T: Variant = tour_t()
	if T == null:
		return "Ристалище: устроить турнир"
	if not tour_on():
		return "Ристалище: турнир начнётся в 10:00" if Game.hour_abs() < TOUR_H0 else "Ристалище"
	return "Турнир: вручить награду победителю" if JS.n(T.champ) >= 0 and not JS.t(T.prize) else "Турнир: выйти на ристалище"

static func tour_name(e: Variant) -> String:
	if e is String and e == "king":
		return "Королева" if JS.t(SimPlayer.kingC().get("fem")) else "Король"
	return String(e.n)

## дом участника (e.h — номер дома; нет или null — заезжий рыцарь)
static func _house(e: Variant) -> Variant:
	if not (e is Dictionary) or e.get("h") == null or JS.n(e.h) < 0:
		return null
	var i := int(JS.n(e.h))
	return Sim.G.houses[i] if i < Sim.G.houses.size() else null

## человек на коне (tourChar): рыцарь королевства — он сам, заезжий — pseudoChar по имени
func tour_char(e: Dictionary) -> Dictionary:
	if JS.n(e.id) >= 0:
		var ch: Variant = Sim.charOf(e.id)
		if ch != null:
			return ch
	var nm := String(e.n)
	if not pc.has(nm):
		pc[nm] = Aud.pseudo(int(JS.o(e.get("ps"), 850.0)), "knight", 0, 30, nm)
	return pc[nm]

## цвета попоны и щита (tourCol): по гербу дома, у заезжих — свои
static func tour_col(e: Dictionary) -> Array:
	var H0: Variant = _house(e)
	if H0 != null:
		return [String(H0.her.ramp), String(H0.her.ramp2)]
	return TOUR_COL[int(JS.n(e.get("col", 0))) % TOUR_COL.size()]

## пара следующего поединка (tourPair): четыре пары первого круга, два полуфинала, финал
static func pair(T: Dictionary) -> Variant:
	var r: Array = T.res
	var n := r.size()
	if n < 4:
		return [2 * n, 2 * n + 1]
	if n < 6:
		var i := n - 4
		return [int(r[2 * i].w), int(r[2 * i + 1].w)]
	return [int(r[4].w), int(r[5].w)] if n == 6 else null

## одна сшибка (passRoll): попал ли каждый в щит, сломал ли копьё, выбил ли из седла; qa — меткость короля (0…1) или null
static func pass_roll(ma: float, mb: float, qa: Variant = null) -> Dictionary:
	var K := qa != null
	var q: float = float(qa) if K else 0.0
	var ha := _ch(clampf(q * 0.9 + (ma - 10) * 0.02, 0.03, 0.95) if K else clampf(0.5 + (ma - 10) * 0.03, 0.2, 0.85))
	var hb := _ch(clampf(0.5 + (mb - 10) * 0.03, 0.2, 0.85))
	var ba := ha and _ch(clampf(q - 0.25, 0.1, 0.8) if K else 0.45)
	var bb := hb and _ch(0.45)
	var ub := ha and _ch(clampf((q * 0.35 - 0.05 if K else 0.12) + (ma - mb) * 0.025, 0.02, 0.4))
	var ua := hb and _ch(clampf(0.12 + (mb - ma) * 0.025 - (0.06 if K and q > 0.7 else 0.0), 0.02, 0.35))
	if ua and ub:
		if _ch(0.5):
			ua = false
		else:
			ub = false
	return {"ha": ha, "hb": hb, "ba": ba, "bb": bb, "ua": ua, "ub": ub, "pa": (2 if ba else 1) if ha else 0, "pb": (2 if bb else 1) if hb else 0}

## кто победил (boutWin): выбитый из седла проиграл, иначе — по очкам, при равенстве — у кого больше удали
static func bout_win(T: Dictionary, a: int, b_: int, sa: int, sb: int, un: int) -> int:
	if un == a:
		return b_
	if un == b_:
		return a
	if sa != sb:
		return a if sa > sb else b_
	return a if JS.n(T.ent[a].mar) >= JS.n(T.ent[b_].mar) else b_

## поединок без зрителей (boutSim): до трёх сшибок
func bout_sim(T: Dictionary) -> void:
	var p: Variant = pair(T)
	if p == null:
		return
	var a: int = p[0]
	var b_: int = p[1]
	var A: Dictionary = T.ent[a]
	var B: Dictionary = T.ent[b_]
	var sa := 0
	var sb := 0
	var un := -1
	for i in 3:
		if un >= 0:
			break
		var r := pass_roll(JS.n(A.mar), JS.n(B.mar))
		sa += int(r.pa)
		sb += int(r.pb)
		if r.ua:
			un = a
		elif r.ub:
			un = b_
	bout_done(T, {"a": float(a), "b": float(b_), "sa": float(sa), "sb": float(sb), "un": float(un), "w": float(bout_win(T, a, b_, sa, sb, un))})

## поединок окончен (boutDone): седьмой — финал, победитель турнира
func bout_done(T: Dictionary, r: Dictionary) -> void:
	T.res.append(r)
	if T.res.size() == 7:
		T.champ = r.w
		if c.loc_id == "yard":
			var e: Dictionary = T.ent[int(r.w)]
			herald_say("Победитель турнира — " + String(e.n) + "!", 5.0)
			Snd.sfx("fanfare")
			c.hud.toast("Победитель турнира — " + String(e.n) + ". Вручите награду у ристалища.")
	print("BOUT ", T.res.size(), " ", int(r.w))

func herald_say(t: String, d := 3.5) -> void:
	var n: Dictionary = c.npc_by("tr_her")
	if not n.is_empty():
		c.people.say(n, t, d)

## через t секунд (setTimeout): таймер — в узле двора; двор закрыли — не сработает
func later(t: float, f: Callable) -> void:
	var tm := Timer.new()
	tm.one_shot = true
	tm.wait_time = t
	tm.timeout.connect(func():
		f.call()
		tm.queue_free())
	c.add_child(tm)
	tm.start()

static func _tour_npc(n: Dictionary) -> bool:
	var ov: Variant = n.get("override")
	return JS.t(n.get("tguest")) or (ov is Dictionary and JS.t(ov.get("tour")))

## зрители и герольд — со двора, свои — по расписанию (tourClear)
func clear() -> void:
	for n in c.npcs.filter(func(x): return JS.t(x.get("tguest"))):
		c.drop_npc(n)
	for n in c.npcs:
		var ov: Variant = n.get("override")
		if ov is Dictionary and JS.t(ov.get("tour")):
			n.override = null
			n.cur = ""

## турнир собрался (tourBegin): семья и совет — на трибуны, по двое от каждого дома — к барьеру, герольд
func begin() -> void:
	var G := Sim.G
	var T: Dictionary = tour_t()
	on = true
	clear()
	parts = []
	var court: Array = []
	var sp: Dictionary = c.npc_by("spouse")
	if not sp.is_empty():
		court.append(sp)
	for n in c.npcs:
		var k := String(n.key)
		var ch: Variant = Feast._char_of(n)
		if (k.begins_with("kid") or k.begins_with("ward")) and ch != null and JS.n(ch.get("age")) >= 6:
			court.append(n)
	for s: Dictionary in Sim.SEATS:
		var n: Dictionary = c.npc_by("seat_" + String(s.k))
		if not n.is_empty():
			court.append(n)
	for i in mini(court.size(), STANDS.size()):
		var n: Dictionary = court[i]
		if JS.t(n.get("follow")):
			continue
		n.override = {"spot": STANDS[i], "until": TOUR_H1, "day": Game.day, "tour": 1}
		n.cur = ""
		n.wander = null
	var busy := {}
	for n in c.npcs:
		var ch: Variant = Feast._char_of(n)
		if ch != null:
			busy[ch.id] = true
	var ids := {}
	for e in T.ent:
		ids[e.id] = true
	var fam := {}
	for x in SimDyn.royalFamily():
		fam[x.id] = true
	var Y: Dictionary = c.D.locs.yard.spots
	var si := 0
	for H0 in G.houses:
		if not JS.t(H0.alive):
			continue
		var M: Array = SimDyn.houseMembers(H0.id).filter(func(x): return (JS.n(x.get("age")) >= 12 and float(x.get("prison", -1)) < 0.0
			and not JS.t(x.get("withKing")) and not JS.t(x.get("away")) and SimPlayer.armyOfGen(x.id) == null and not busy.has(x.id)
			and not ids.has(x.id) and not fam.has(x.id)))
		for ch in M.slice(0, 2):
			if si >= 14 or not Y.has("tsp" + str(si)):
				break
			var s: Dictionary = Y["tsp" + str(si)]
			si += 1
			var n: Dictionary = c.people.mk(c.npcs, {}, "tg" + JS.s(ch.id), ch, {"visitor": true, "tguest": 1, "spd": 44.0, "sub0": "Зритель · дом " + String(H0.name)})
			c.people.place(n, s)
			n.away = false
	var hc := Aud.pseudo(860, "steward", 0, 40, "Герольд")
	var her: Dictionary = c.people.mk(c.npcs, {}, "tr_her", hc, {"visitor": true, "tguest": 1, "sub0": "Герольд турнира"})
	her.pch = hc
	if Y.has("herald"):
		c.people.place(her, Y.herald)
	her.away = false
	if JS.t(G.get("atCourt")):
		c.hud.toast("Турнир начинается! Рыцари съезжаются к ристалищу.")
		Snd.sfx("fanfare")
	print("TOUR BEGIN ", T.ent.size(), " ", si, " ", court.size())

## турнир окончен (tourEnd): поединки досчитаны, победителю и его дому — почёт; в летопись (reign.js)
func end() -> void:
	var G := Sim.G
	var T: Variant = G.court.get("tour")
	on = false
	b = null
	kq = false
	var was: bool = T is Dictionary and not JS.t(T.get("done"))
	var e: Variant = null
	var kr := ""
	if was:
		while T.res.size() < 7:
			bout_sim(T)
		T.done = 1.0
		e = T.ent[int(T.champ)] if JS.n(T.champ) >= 0 and int(T.champ) < T.ent.size() else null
		var H0: Variant = _house(e)
		if H0 != null:
			SimPlayer.houseLoy(H0, 3)
		var ch: Variant = Sim.charOf(e.id) if e != null and JS.n(e.id) >= 0 else null
		if ch != null:
			ch.loy = clampf(JS.n(JS.o(ch.get("loy"), 50.0)) + 3, 0, 100)
		kr = String(JS.o(T.get("king"), ""))
		Sim.glog("Турнир: победитель — " + (String(e.n) if e != null else "?") + (" (дом " + String(H0.name) + ")" if H0 != null else "") + "."
			+ (" Сам король выиграл свой поединок!" if kr == "win" else (" Короля выбили из седла." if kr == "fall" else "")), "info")
	clear()
	if was:
		var st: Dictionary = SimArmy.RST()
		if not st.is_empty():
			st.tours += 1
		SimArmy.chron("Турнир: " + ("король выиграл свой поединок" if kr == "win" else ("короля выбили из седла" if kr == "fall" else "победил " + (String(e.n) if e != null else "?"))) + ".", "shield", "tour", 1.0)
	print("TOUR END ", was)

## что скажет герольд (tourInfo): круг и кто ещё в седле
func info(n: Variant) -> void:
	var T: Variant = tour_t()
	var who: Variant = n if n is Dictionary and not (n as Dictionary).is_empty() else null
	if T == null:
		c.hud.say(who, "Турнир окончен, государь.")
		return
	var r: int = T.res.size()
	var rd := "1-й круг" if r < 4 else ("полуфинал" if r < 6 else ("финал" if r < 7 else "турнир окончен"))
	var L: Array = []
	for i in T.ent.size():
		var e: Dictionary = T.ent[i]
		var out := false
		for x in T.res:
			if (int(x.a) == i or int(x.b) == i) and int(x.w) != i:
				out = true
		L.append(String(e.n) + " (" + JS.s(e.mar) + ")" + (" — выбыл" if out else ""))
	c.hud.say(who, "Сейчас — " + rd + ". Рыцари (в скобках — удаль): " + ", ".join(L) + ".", {"name": "Герольд"})
	print("HERALD ", r)

## разговор со зрителем или герольдом (n.talk)
func talk(n: Dictionary) -> void:
	if String(n.key) == "tr_her":
		info(n)
		return
	var T: Variant = Sim.G.court.get("tour")
	var fav: String = String(_pick(T.ent).n) if T is Dictionary and not (T.ent as Array).is_empty() else "сэр Кай"
	c.hud.say(n, _pick(["Славный турнир, государь!", "Мой фаворит — " + fav + "!", "Копья так и летят в щепки!"]))

## у ристалища (ACTS_EXT.lists): без трибун — пустое поле; без турнира — поручение сенешалю; на турнире — выйти самому,
## смотреть из ложи, спросить герольда, вручить награду
func lists() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var T: Variant = tour_t()
	var k: Dictionary = SimPlayer.kingC()
	var fem: bool = JS.t(k.get("fem"))
	if not SimDyn.projDone("stands"):
		c.hud.say(null, "Пустое ристалище с барьером посередине. Без трибун турнир (поручение сенешалю) пройдёт в поле у стен замка, и поединков здесь не будет. Трибуны строят через стол зодчего — «Трибуны у ристалища».", {"name": "Ристалище"})
		print("LISTS empty")
		return
	if T == null:
		var od: Variant = C.get("orders")
		var cur: Variant = od.get("seneschal") if od is Dictionary else null
		var sen: Variant = SimDyn.seatChar("seneschal")
		var d: Variant = SimCourt.ordDef("seneschal", "tourney")
		var busy: bool = cur is Dictionary and cur.get("k") == "tourney"
		var t: String = ("Сенешаль уже созывает рыцарей: турнир — " + SimText.inDays(int(JS.n(cur.day0) + JS.n(cur.dur) - JS.n(G.day))) + ", с 10:00.") if busy else "Трибуны пусты. Турниры устраивает сенешаль: поручение «Турнир»."
		c.hud.say(null, t, {"name": "Ристалище", "choices": [
			{"t": "Велеть сенешалю устроить турнир (" + JS.s(d.cost if d != null else 0) + " зол., " + JS.s(d.dur if d != null else 0) + " дн.)",
				"ok": func(): return sen != null and not busy, "why": "Сенешаля нет — некому созвать рыцарей" if sen == null else "Турнир уже готовится",
				"fx": func(): SimCourt.giveOrder("seneschal", "tourney", "intent")},
			{"t": "Уйти"}], "esc": 1})
		print("LISTS order")
		return
	if not tour_on():
		c.hud.say(null, "Оруженосцы чистят доспехи, конюхи седлают коней: турнир начнётся в 10:00." if Game.hour_abs() < TOUR_H0 else "Турнир окончен. Слуги собирают обломки копий.", {"name": "Ристалище"})
		print("LISTS wait")
		return
	if JS.n(T.champ) >= 0 and not JS.t(T.prize):
		prize(T)
		return
	var why := ""
	if Hurt.hurt(k):
		why = Hurt.wound_not(k)
	elif Hurt.sick_not(k) != "":
		why = Hurt.sick_not(k)
	elif JS.n(k.age) < 16:
		why = "Король слишком юн для копья"
	elif JS.n(k.age) > 58:
		why = "Годы уже не те, государь"
	elif JS.t(T.get("king")):
		why = "Сегодня вы уже бились"
	elif kq:
		why = "Вы выходите следующим — ждите знака герольда"
	var s1: Dictionary = c.spots.get("stand1", {})
	var t2: String = "На ристалище " + ("идёт поединок: " + String(T.ent[int(b.a)].n) + " и " + String(T.ent[int(b.b)].n) + "." if b != null else "готовят следующую пару.") \
		+ " Что угодно " + ("королеве" if fem else "королю") + "?"
	c.hud.say(null, t2, {"name": "Турнир", "choices": [
		{"t": "Выйти к барьеру следующим" if b != null else "Выйти на ристалище самому", "tip": ["Три сшибки. Жмите E, когда острие копья на середине щита.", "Победа — слава и любовь знати; падение может стоить раны."],
			"ok": func(): return why == "", "why": why, "fx": func():
				if b != null:
					kq = true
					herald_say("Следующим к барьеру выйдет " + tour_name("king") + "!", 3.5)
					c.hud.toast("Вы выйдете на ристалище после этого поединка.")
					Snd.sfx("horn_short")
				else:
					kj_start()},
		{"t": "Смотреть из королевской ложи", "fx": func():
			if not s1.is_empty():
				c._walk_to(Vector2(float(s1.x), float(s1.y) + 30.0), func(): c.sit_at(s1), 0.0)},
		{"t": "Спросить герольда о рыцарях", "fx": func(): info(c.npc_by("tr_her"))},
		{"t": "Уйти"}], "esc": 3})
	print("LISTS ", T.res.size(), " ", why)

## награда победителю (tourPrize): венок и кошель — дом +6, венок — дом +3; слава +1
func prize(T: Dictionary) -> void:
	var e: Dictionary = T.ent[int(T.champ)]
	var H0: Variant = _house(e)
	var ch: Variant = Sim.charOf(e.id) if JS.n(e.id) >= 0 else null
	var who: Variant = {"name": String(e.n), "port": c.people.look(c.D, ch)[1], "sub": ""} if ch != null else null
	var give := func(gold: float, v: float, t: String) -> void:
		if gold > 0 and not SimCourt.spend(gold):
			return
		T.prize = 1.0
		if H0 != null:
			SimPlayer.houseLoy(H0, v)
		if ch != null:
			ch.loy = clampf(JS.n(JS.o(ch.get("loy"), 50.0)) + v, 0, 100)
		SimCourt.prestige(1)
		Snd.sfx("cheer")
		herald_say("Слава победителю!", 3.0)
		c.hud.say(who, t, {"name": String(e.n)})
		print("PRIZE ", gold)
	c.hud.say(null, "Победитель турнира — " + String(e.n) + (" из дома " + String(H0.name) if H0 != null else "") + ". Он преклоняет колено у королевской ложи.", {"name": "Награда", "choices": [
		{"t": "Венок и кошель золота (20 зол.)", "tip": ["Дом " + String(H0.name) + ": верность +6" if H0 != null else "Слава +1"],
			"fx": func(): give.call(20.0, 6.0, "Благодарю, государь! Это золото — и этот венок — я положу к ногам моей дамы.")},
		{"t": "Лавровый венок победителя", "tip": ["Дом " + String(H0.name) + ": верность +3" if H0 != null else "Слава +1"],
			"fx": func(): give.call(0.0, 3.0, "Для меня честь получить венок из ваших рук, государь.")},
		{"t": "Позже"}], "esc": 2})
	print("PRIZE ASK")

# ---------- поединок на виду: два всадника несутся вдоль барьера трижды (или пока один не упадёт) ----------
func bout_start(T: Dictionary, a: int, b_: int, king: Variant) -> Dictionary:
	var B := {"a": a, "b": b_, "king": king, "pn": 0, "ph": "intro", "t": 0.0, "dir": 1, "sa": 0, "sb": 0, "un": -1, "ku": "",
		"xa": float(LX0), "xb": float(LX1), "va": 0.0, "vb": 0.0, "roll": null, "brkA": false, "brkB": false, "fall": null, "fa": 0.0, "fb": 0.0,
		"fin": false, "w": null, "aim": null, "lock": null, "q": 0.0}
	if king != null:
		B.aim = {"x": 0.0, "y": 0.0, "ph": randf_range(0, 6)}
	herald_say((tour_name("king") if king != null else String(T.ent[a].n)) + " и " + (String(king.n) if king != null else String(T.ent[b_].n)) + " — к барьеру!", 3.0)
	return B

static func _unhorsed(B: Dictionary) -> bool:
	return int(B.un) != -1 or String(B.ku) != ""

func bout_step(B: Dictionary, dt: float, T: Dictionary) -> void:
	B.t += dt
	var kb: bool = B.king != null
	var A: Variant = null if kb else T.ent[int(B.a)]
	var Bk: Dictionary = B.king if kb else T.ent[int(B.b)]
	if B.ph == "intro" or B.ph == "turn":
		if B.t > (1.4 if B.ph == "intro" else 0.9):
			if B.ph == "turn":
				B.pn += 1
				B.dir = -int(B.dir)
				if B.pn >= 3 or _unhorsed(B):
					B.ph = "done"
					B.t = 0.0
					bout_end_msg(B, T)
					return
			B.ph = "run"
			B.t = 0.0
			B.va = 0.0
			B.vb = 0.0
			B.roll = null
			B.brkA = false
			B.brkB = false
			if kb:
				B.lock = null
				B.q = 0.0
			Snd.sfx("gallop")
		return
	if B.ph == "done":
		if B.t > 2.2:
			B.fin = true
		return
	# сшибка: разгон, удар у середины барьера, до конца поля
	var acc := 120.0
	var vmax := 128.0
	B.va = minf(vmax, B.va + acc * dt)
	B.vb = minf(vmax, B.vb + acc * dt)
	B.xa += B.dir * B.va * dt
	B.xb -= B.dir * B.vb * dt
	B.fa += B.va * dt
	B.fb += B.vb * dt
	if kb and B.lock == null:
		var s: float = 1.0 + 0.3 * float(B.pn)
		B.aim.x = sin(B.t * 2.6 * s + B.aim.ph) * 0.95
		B.aim.y = sin(B.t * 3.9 * s + B.aim.ph * 0.7) * 0.8
	if B.roll == null and (B.xa - B.xb) * B.dir >= -2.0:
		var ma: float = JS.n(SimPlayer.kingC().get("mar")) if kb else JS.n(A.mar)
		var mb: float = JS.n(Bk.mar)
		B.roll = pass_roll(ma, mb, (B.q if B.lock != null else 0.0) if kb else null)
		var r: Dictionary = B.roll
		var x: float = (B.xa + B.xb) / 2.0
		var y := (LANE_N + LANE_S) / 2.0 - 14.0
		B.sa += int(r.pa)
		B.sb += int(r.pb)
		if r.ba:
			B.brkA = true
		if r.bb:
			B.brkB = true
		if r.ba or r.bb:
			Snd.sfx("crack")
			for i in 16:
				parts.append({"x": x, "y": y + randf_range(-4, 4), "vx": randf_range(-70, 70), "vy": randf_range(-60, 5), "t": 0.0, "c": _pick(SPLINTER)})
		elif r.ha or r.hb:
			Snd.sfx("hit")
		if r.ua or r.ub:
			if kb:
				B.ku = "k" if r.ua else "o"
			else:
				B.un = int(B.a) if r.ua else int(B.b)
			B.fall = {"w": "a" if r.ua else "b", "x": B.xa if r.ua else B.xb, "y": float(LANE_N if r.ua else LANE_S), "t": 0.0}
			Snd.sfx("thud")
			later(0.2, func(): Snd.sfx("cheer"))
		var nA: String = tour_name("king") if kb else String(A.n)
		var nB: String = String(Bk.n)
		var msg := ""
		if r.ua or r.ub:
			msg = (nA if r.ua else nB) + " вылетает из седла!"
		elif r.ba and r.bb:
			msg = "Оба копья в щепки!"
		elif r.ba:
			msg = nA + " ломает копьё в щепки!"
		elif r.bb:
			msg = nB + " ломает копьё в щепки!"
		elif r.ha and r.hb:
			msg = "Оба попали в щит!"
		elif r.ha:
			msg = nA + " бьёт точно в щит!"
		elif r.hb:
			msg = nB + " бьёт точно в щит!"
		else:
			msg = "Мимо! Оба промахнулись."
		herald_say(msg, 2.6)
		crowd(0.25)
	if B.fall != null:
		B.fall.t += dt
	var endA: bool = B.xa >= LX1 if B.dir > 0 else B.xa <= LX0
	var endB: bool = B.xb <= LX0 if B.dir > 0 else B.xb >= LX1
	if endA:
		B.xa = float(LX1 if B.dir > 0 else LX0)
	if endB:
		B.xb = float(LX0 if B.dir > 0 else LX1)
	if endA and endB:
		B.ph = "turn"
		B.t = 0.0

## итог поединка (boutEndMsg): герольд объявляет победителя и счёт
func bout_end_msg(B: Dictionary, T: Dictionary) -> void:
	var nm := ""
	if B.king != null:
		var w := ""
		if B.ku == "k":
			w = "opp"
		elif B.ku == "o":
			w = "king"
		elif B.sa != B.sb:
			w = "king" if B.sa > B.sb else "opp"
		else:
			w = "king" if JS.n(SimPlayer.kingC().get("mar")) >= JS.n(B.king.mar) else "opp"
		B.w = w
		nm = tour_name("king") if w == "king" else String(B.king.n)
	else:
		B.w = bout_win(T, int(B.a), int(B.b), int(B.sa), int(B.sb), int(B.un))
		nm = String(T.ent[int(B.w)].n)
	herald_say("Побеждает " + nm + "! Счёт " + str(B.sa) + ":" + str(B.sb) + ".", 3.5)
	Snd.sfx("cheer")
	crowd(0.4)

## крики трибун (tourCrowd)
func crowd(p: float) -> void:
	for n in c.npcs:
		if _tour_npc(n) and n.loc == "yard" and _ch(p):
			c.people.say(n, _pick(CROWD), 2.0)

## каждый кадр двора (UPD_EXT): начало и конец, щепки, поединки по часам — на виду или досчитанные, болтовня трибун
func update(dt: float) -> void:
	if not ok() or JS.t(Sim.G.get("visit")):
		return
	var o := tour_on()
	var T: Variant = tour_t()
	var h := Game.hour_abs()
	if o and not on:
		begin()
	elif not o and on:
		print("TOUR OFF ", snappedf(h, 0.01), " ", T != null, " ", SimDyn.projDone("stands"))   # в журнал: час, турнир дня, трибуны
		if kj != null:
			kj_finish()
		end()
	for p in parts:
		p.t += dt
		p.x += p.vx * dt
		p.y += p.vy * dt
		p.vy += 160.0 * dt
	if not parts.is_empty():
		parts = parts.filter(func(p): return p.t < 0.9)
	if not on or T == null:
		return
	var watch: bool = c.loc_id == "yard"
	if kj != null:
		kj_step(dt)
		return
	var late := h >= TOUR_H1 - 0.5
	var due := 0
	for t in BOUT_H:
		if h >= t:
			due += 1
	if late:
		due = 7
	if not watch or JS.t(T.get("king")) or JS.n(T.champ) >= 0:
		kq = false
	if b != null:
		bout_step(b, dt, T)
		if b.fin:
			var B: Dictionary = b
			b = null
			bout_done(T, {"a": float(B.a), "b": float(B.b), "sa": float(B.sa), "sb": float(B.sb), "un": float(B.un), "w": float(B.w)})
			if kq and JS.n(T.champ) < 0:
				kq = false
				kj_start()
		elif not watch:
			b = null
		return
	if kq:
		kq = false
		kj_start()
		return
	while T.res.size() < due - (1 if watch and not late else 0):
		bout_sim(T)
	if watch and not late and T.res.size() < due and T.res.size() < 7:
		var p: Array = pair(T)
		b = bout_start(T, p[0], p[1], null)
	if watch:
		chat -= dt
		if chat < 0.0:
			chat = randf_range(2, 4)
			var L: Array = c.npcs.filter(func(m): return m.loc == "yard" and _tour_npc(m) and String(m.bub) == "" and String(m.key) != "tr_her")
			if not L.is_empty():
				var line: String = _pick(CHAT)
				if _ch(0.2):
					line = "Смотрите, " + String(_pick(T.ent).n) + "!"
				c.people.say(_pick(L), line, 2.5)

## часы двора на турнире у ристалища: сутки — не быстрее 12 минут (TIMEK_EXT)
func time_k() -> float:
	if on and not JS.t(Sim.G.get("visit")) and c.loc_id == "yard" and Game.speed > 0:
		return minf(1.0, Game.DAY_SEC[Game.speed] / 720.0)
	return 1.0

# ---------- поединок короля: E (или щелчок), когда острие копья на середине щита ----------
func kj_start() -> void:
	var T: Variant = tour_t()
	if T == null:
		return
	var alive: Array = []
	for i in T.ent.size():
		var out := false
		for r in T.res:
			if (int(r.a) == i or int(r.b) == i) and int(r.w) != i:
				out = true
		if not out:
			alive.append(T.ent[i])
	var opp: Variant = null
	if JS.n(T.champ) >= 0:
		opp = T.ent[int(T.champ)]
	elif not alive.is_empty():
		opp = Feast.ssort(alive, func(x, y): return JS.n(y.mar) - JS.n(x.mar))[0]
	if opp == null:
		opp = T.ent[0]
	c.stand_up()
	c.fade_to(func():
		var P: Dictionary = c.king
		b = null
		if c.loc_id != "yard":
			c.go_loc("yard")
		P.hide = true
		P.sit = null
		P.lie = false
		P.x = float(LX0)
		P.y = float(LANE_N)
		P.dir = "right"
		c.path = []
		c.on_arrive = Callable()
		kj = bout_start(T, -1, -1, opp)
		c.snap_cam()
		Snd.sfx("horn")
		print("JOUST ", String(opp.n)))

func kj_step(dt: float) -> void:
	var B: Dictionary = kj
	var T: Variant = tour_t()
	var P: Dictionary = c.king
	if T == null:
		kj_finish()
		return
	bout_step(B, dt, T)
	P.x = B.xa
	P.y = float(LANE_N)
	P.dir = "right" if B.dir > 0 else "left"
	if B.fin:
		kj_finish()

## удар (kjPress): чем ближе к середине щита, тем вернее
func kj_press() -> void:
	var B: Variant = kj
	if B == null or B.ph != "run" or B.lock != null or B.roll != null:
		return
	B.lock = {"x": B.aim.x, "y": B.aim.y}
	B.q = clampf(1.0 - Vector2(B.aim.x, B.aim.y).length() / 0.95, 0, 1)
	Snd.sfx("swish")
	print("LANCE ", snappedf(B.q, 0.01))

## поединок короля окончен (kjFinish): победа — слава +4, дома +2; поражение — дома +1; падение — слава −2 и, может быть, рана
func kj_finish() -> void:
	var G := Sim.G
	var B: Variant = kj
	var T: Variant = G.court.get("tour")
	var k: Dictionary = SimPlayer.kingC()
	kj = null
	if B == null:
		return
	var fem: bool = JS.t(k.get("fem"))
	var res := "lose"
	var t := ""
	if B.w == null:
		B.w = "king" if B.sa >= B.sb else "opp"
	if B.fall != null and B.fall.w == "a":
		res = "fall"
		SimCourt.prestige(-2)
		var hurt := _ch(0.45)
		if hurt:
			Hurt.wound_king(1 if _ch(0.6) else 2, _pick(["плечо", "рёбра"]), "турнир")
			if JS.n(k.get("woundK")) >= 2:
				c.heal.queue({"from": "tourney"})
		var wd := int(JS.n(k.get("wound")) - _day())
		t = String(B.king.n) + " бьёт точно — и вы вылетаете из седла. " + ("Лекари уносят " + ("королеву" if fem else "короля") + " с поля: рана заживёт за " + str(wd) + " "
			+ SimText.plural(wd, "день", "дня", "дней") + "." if hurt else "Песок мягкий: вы встаёте сами, под рёв трибун.")
	elif B.w == "king":
		res = "win"
		SimCourt.prestige(4)
		for H0 in G.houses:
			if JS.t(H0.alive):
				SimPlayer.houseLoy(H0, 2)
		t = (String(B.king.n) + " лежит на песке, а вы поднимаете копьё к трибунам." if B.fall != null else "Вы берёте верх по очкам — " + str(B.sa) + ":" + str(B.sb) + ".") \
			+ " Знать рукоплещет: " + ("королева" if fem else "король") + " — истинный рыцарь!"
	else:
		for H0 in G.houses:
			if JS.t(H0.alive):
				SimPlayer.houseLoy(H0, 1)
		t = "Победа по очкам: " + String(B.king.n) + ", " + str(B.sb) + ":" + str(B.sa) + ". Но знать видела: " + ("королева" if fem else "король") + " не боится копья."
	if T is Dictionary:
		T.king = res
	Snd.sfx("fanfare" if res == "win" else "thud")
	print("JOUST END ", res, " ", B.sa, ":", B.sb)
	c.fade_to(func():
		var P: Dictionary = c.king
		var sp: Dictionary = c.spots.get("lists_s", {})
		P.hide = false
		if c.loc_id != "yard":
			c.go_loc("yard")
		if not sp.is_empty():
			P.x = float(sp.x)
			P.y = float(sp.y)
		P.dir = "up"
		c.snap_cam()
		c.hud.say(null, t, {"name": "Поединок"}))

## цель «Удар копьём!» (TARGET_EXT / PICK_EXT): пока копьё не нацелено
func target() -> Dictionary:
	if kj != null and kj.ph == "run" and kj.lock == null:
		return {"label": "Удар копьём!", "go": kj_press}
	return {}

# ---------- рисунок: всадники (по y среди людей), упавший, щепки; панель турнира и прицел ----------
func _ramp(nm: String, fb: String) -> Array:
	var key := nm + "|" + fb
	if not cols.has(key):
		var R: Dictionary = Art.D.get("ramp", {})
		var a: Array = R.get(nm, R.get(fb, ["#000000", "#202020", "#404040", "#606060", "#808080"]))
		cols[key] = a.map(func(h): return Art.hexc(String(h)))
	return cols[key]

## всадник (drawRider): конь под попоной, рыцарь (верх фигуры), копьё (сломанное — короче), щит
func _rider(nd: Node2D, x: float, y: float, right: bool, sheet: Array, col: Array, f: int, brk: bool, fallen: bool) -> void:
	var yo := -nd.position.y
	var hf: int = int(Art.D.tourHorse[f])
	var hs := Art.size(hf)
	var hx0 := roundf(x - 16)
	var hy := roundf(y - 24)
	var shb: int = Art.D["shadowBig"]
	nd.draw_texture_rect_region(Art.page(shb), Rect2(roundf(x - 11), roundf(y - 2), Art.rect(shb).size.x, Art.rect(shb).size.y), Art.rect(shb))
	if right:
		nd.draw_set_transform(Vector2(hx0 + hs.x, yo), 0.0, Vector2(-1, 1))
		nd.draw_texture_rect_region(Art.page(hf), Rect2(0, hy, hs.x, hs.y), Art.rect(hf))
		nd.draw_set_transform(Vector2(0, yo))
	else:
		nd.draw_texture_rect_region(Art.page(hf), Rect2(hx0, hy, hs.x, hs.y), Art.rect(hf))
	var C1 := _ramp(String(col[0]), "navy")
	var C2 := _ramp(String(col[1]), "gold")
	var cx := hx0 + (6.0 if right else 8.0)
	nd.draw_rect(Rect2(cx, hy + 9, 18, 8), C1[3])
	nd.draw_rect(Rect2(cx, hy + 15, 18, 2), C1[2])
	for i in range(1, 18, 4):
		nd.draw_rect(Rect2(cx + i, hy + 16, 2, 2), C2[4])
	nd.draw_rect(Rect2(cx, hy + 9, 18, 1), C2[4])
	if fallen:
		return
	var idx: int = sheet[DIRS.find("right" if right else "left")][0]
	var r := Art.rect(idx)
	var rx := roundf(x - 8 + (-1.0 if right else 1.0))
	var ry := hy + 9 - 24
	nd.draw_texture_rect_region(Art.page(idx), Rect2(rx, ry, 16, 24), Rect2(r.position, Vector2(16, 24)))
	nd.draw_rect(Rect2(roundf(x) - 1, hy + 9, 3, 6), Color8(0x3a, 0x2a, 0x20))
	var d := 1.0 if right else -1.0
	var L0 := 9 if brk else 26
	var lx := roundf(x + d * 4)
	var ly := hy + 2
	for i in L0:
		nd.draw_rect(Rect2(lx + d * i, ly + floorf(i / 9.0), 1, 1), C2[4] if i % 6 < 3 else C1[3])
	if not brk:
		nd.draw_rect(Rect2(lx + d * L0, ly + 2, 1, 1), Color8(0xc8, 0xd0, 0xd8))
		nd.draw_rect(Rect2(lx + d * (L0 + 1), ly + 2, 1, 1), Color8(0xc8, 0xd0, 0xd8))
	nd.draw_rect(Rect2(roundf(x - d * 2) - 2, hy + 3, 5, 6), C1[3])
	nd.draw_rect(Rect2(roundf(x - d * 2), hy + 4, 1, 4), C2[4])

## выбитый из седла (drawFallen): лежит на песке
static func _fallen(nd: Node2D, F: Dictionary, sheet: Array) -> void:
	var yo := -nd.position.y
	var idx: int = sheet[0][0]
	nd.draw_set_transform(Vector2(roundf(F.x), roundf(F.y + 2) + yo), -PI / 2)
	nd.draw_texture_rect_region(Art.page(idx), Rect2(-30, -8, 16, 32), Art.rect(idx))
	nd.draw_set_transform(Vector2(0, yo))

## узлы рисунка в мире двора: каждый кадр (SPR_EXT, CRENDER2)
func sync() -> void:
	var T: Variant = Sim.G.court.get("tour") if ok() else null
	var B: Variant = kj if kj != null else b
	if c.loc_id != "yard" or B == null or not (T is Dictionary):
		c.xnode_drop("trn_")
	else:
		var kb: bool = B.king != null
		var sa: Array = c.king.sheet if kb else c.people.look(c.D, tour_char(T.ent[int(B.a)]))[0]
		var ca: Array = ["red", "gold"] if kb else tour_col(T.ent[int(B.a)])
		var eb: Dictionary = B.king if kb else T.ent[int(B.b)]
		var sb: Array = c.people.look(c.D, tour_char(eb))[0]
		var cb: Array = tour_col(eb)
		var fa: bool = B.fall != null and B.fall.w == "a"
		var fb: bool = B.fall != null and B.fall.w == "b"
		c.xnode("trn_a", LANE_N, func(nd): _rider(nd, B.xa, LANE_N, B.dir > 0, sa, ca, int(floorf(B.fa / 7.0)) % 2, B.brkA, fa))
		c.xnode("trn_b", LANE_S, func(nd): _rider(nd, B.xb, LANE_S, B.dir < 0, sb, cb, int(floorf(B.fb / 7.0)) % 2, B.brkB, fb))
		if B.fall != null:
			var F: Dictionary = B.fall
			var fs: Array = sa if fa else sb
			c.xnode("trn_f", F.y + 3, func(nd): _fallen(nd, F, fs))
		else:
			c.xnode_drop("trn_f")
	if c.loc_id != "yard" or parts.is_empty():
		c.xnode_drop("trnp")
	else:
		c.xnode("trnp", 0.0, func(nd: Node2D):
			for p in parts:
				var col: Color = Art.hexc(String(p.c))
				col.a = clampf(1.2 - p.t * 1.3, 0, 1)
				nd.draw_rect(Rect2(roundf(p.x), roundf(p.y), 2, 1), col), 1)

## панель турнира справа вверху и прицел на щите противника (HUD_EXT)
func draw_hud(u: Variant) -> void:
	var T: Variant = tour_t()
	if T == null or not on or c.loc_id != "yard" or c.hud.dlg != null:
		return
	var B: Variant = kj if kj != null else b
	var W := 640.0
	var X := W - 196.0
	var Y := 22.0
	var hh := (38.0 if B != null else 20.0) + (8.0 if kq else 0.0)
	u.rect(X, Y, 190, hh, "rgba(20,14,10,0.82)")
	u.stroke_r(X, Y, 190, hh, "#8a6a3a")
	var r: int = T.res.size()
	var gold: Color = u.cc("#f7d35c")
	if kq:
		u.txt("Следующим выходите вы!", X + 6, Y + hh - 9, gold, "s")
	u.txt("ТУРНИР · " + ("1-Й КРУГ" if r < 4 else ("ПОЛУФИНАЛ" if r < 6 else ("ФИНАЛ" if r < 7 else "ПОБЕДИТЕЛЬ: " + String(T.ent[int(T.champ)].n).to_upper()))), X + 6, Y + 5, gold, "s")
	if B != null:
		var nA: String = tour_name("king") if B.king != null else String(T.ent[int(B.a)].n)
		var nB: String = String(B.king.n) if B.king != null else String(T.ent[int(B.b)].n)
		u.txt(str(B.sa), X + 6, Y + 13, gold, "s")
		u.txt(nA, X + 16, Y + 13, u.cc("#f8ecd0"), "s")
		u.txt(str(B.sb), X + 6, Y + 21, gold, "s")
		u.txt(nB, X + 16, Y + 21, u.cc("#f8ecd0"), "s")
		u.txt("СШИБКА " + str(mini(3, int(B.pn) + 1)) + " ИЗ 3", X + 6, Y + 29, u.cc("#c8b898"), "s")
	else:
		u.txt("Следующая пара готовится…" if r < 7 else "Вручите награду у ристалища", X + 6, Y + 13, u.cc("#c8b898"), "s")
	if kj == null or kj.ph != "run":
		return
	var K: Dictionary = kj
	var bx := roundf(W / 2.0 - 34)
	var by := 52.0
	var col := tour_col(K.king)
	var C1 := _ramp(String(col[0]), "navy")
	var C2 := _ramp(String(col[1]), "gold")
	u.rect(bx - 6, by - 6, 80, 86, "rgba(20,14,10,0.7)")
	u.stroke_r(bx - 6, by - 6, 80, 86, "#8a6a3a")
	u.rect(bx + 10, by, 48, 40, C1[3])
	u.rect(bx + 14, by + 40, 40, 8, C1[3])
	u.rect(bx + 22, by + 48, 24, 6, C1[3])
	u.rect(bx + 30, by + 4, 8, 46, C2[4])
	u.rect(bx + 26, by + 16, 16, 12, C2[3])
	var A: Dictionary = K.lock if K.lock != null else K.aim
	var ax: float = bx + 34 + float(A.x) * 30
	var ay: float = by + 22 + float(A.y) * 26
	u.stroke_r(roundf(ax) - 4, roundf(ay) - 4, 9, 9, "#f7d35c" if K.lock != null else "#f8f0e0")
	u.rect(roundf(ax), roundf(ay), 1, 1, "#ffffff")
	u.txt("Удар нацелен: " + str(int(roundf(float(K.q) * 100))) + "%" if K.lock != null else "E / клик — удар!", bx + 34, by + 64, gold if K.lock != null else u.cc("#f8ecd0"), "s", "c")

func state() -> Dictionary:
	var T: Variant = Sim.G.court.get("tour") if ok() else null
	var B: Variant = kj if kj != null else b
	return {"on": on, "res": (T.res as Array).size() if T is Dictionary else -1, "champ": JS.n(T.champ) if T is Dictionary else -1.0,
		"king": String(JS.o(T.get("king"), "")) if T is Dictionary else "", "done": JS.t(T.get("done")) if T is Dictionary else false,
		"prize": JS.t(T.get("prize")) if T is Dictionary else false, "b": b != null, "kj": kj != null, "kq": kq,
		"ph": String(B.ph) if B != null else "", "pass": int(B.pn) if B != null else 0, "sa": int(B.sa) if B != null else 0, "sb": int(B.sb) if B != null else 0,
		"lock": kj != null and kj.lock != null, "parts": parts.size(), "guests": c.npcs.filter(func(n): return JS.t(n.get("tguest"))).size(),
		"stands": c.npcs.filter(func(n): return n.get("override") is Dictionary and JS.t(n.override.get("tour"))).size(), "label": label()}

# ---------- самопроверка без экрана (-- --tour) ----------
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

func _lists() -> void:
	c.do_act({"id": "lists", "label": ""})

func _hour(h: float) -> void:
	Game.set_hour(h)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()

## кадры двора, пока cond не станет true (не больше n)
func _until(cond: Callable, n := 2000) -> int:
	for i in n:
		if cond.call():
			return i
		c._tick(0.05)
	return -1

func _ng() -> int:
	return c.npcs.filter(func(n): return JS.t(n.get("tguest"))).size()

func _ns() -> int:
	return c.npcs.filter(func(n): return n.get("override") is Dictionary and JS.t(n.override.get("tour"))).size()

## ристалище без трибун и с ними; турнир дня: зрители и герольд, поединок на виду, выход короля к барьеру, досчёт,
## награда победителю, конец турнира; рана — носилки, постель, дни в постели
func selftest() -> bool:
	if not ok():
		print("selftest: турнир — нет королевства")
		return false
	var G := Sim.G
	var C: Dictionary = G.court
	var k: Dictionary = SimPlayer.kingC()
	var P: Dictionary = SimExt.projState()
	var done0: Dictionary = (P.done as Dictionary).duplicate()
	var keep := {}
	for f in ["wound", "woundK", "woundP", "woundBy", "woundDay", "age", "loy"]:
		keep[f] = k.get(f)
	var day0 := Game.day
	var frac0 := Game.frac
	var pr00 := JS.n(C.get("prestige"))
	var res := true
	seed(20240917)
	Game.speed = 1
	var snd0: Array = [Snd.screen, Snd.court, Snd.want]
	Snd.screen = "court"
	Snd.court = c
	Snd.want = "auto"
	if JS.n(k.age) < 16 or JS.n(k.age) > 58:
		k.age = 30.0
	k.erase("wound")
	C.erase("tour")
	c.go_loc("yard")
	c.king.x = 984.0
	c.king.y = 404.0
	c.king.dir = "up"
	_hour(12.0)
	# без трибун: пустое поле
	P.done.erase("stands")
	SimExt.proj_rev += 1
	var lab0 := label()
	var tg0: Dictionary = c.nearest_target()
	_lists()
	var ok0 := lab0 == "Турнирное поле" and tg0.has("a") and String(tg0.a.id) == "lists" and _dlg_name() == "Ристалище" and _dlg_text().begins_with("Пустое ристалище")
	_close()
	# трибуны есть, турнира нет: поручение сенешалю
	P.done["stands"] = {"day": G.day, "king": G.player.char}
	SimExt.proj_rev += 1
	var lab1 := label()
	_lists()
	var n1: int = (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	var ok1 := lab1 == "Ристалище: устроить турнир" and _dlg_name() == "Ристалище" and n1 == 2 and (_dlg_text().begins_with("Трибуны пусты.") or _dlg_text().begins_with("Сенешаль уже созывает"))
	_close()
	print("selftest: турнир — без трибун «", lab0, "» ", ok0, ", с трибунами «", lab1, "» (выборов ", n1, ") ", ok1)
	res = res and ok0 and ok1
	# турнир сегодня: восемь участников; до 10:00 — готовятся
	SimCourt.tourSetup()
	var T: Dictionary = C.tour
	T.day = float(Game.day)
	_hour(9.0)
	var lab2 := label()
	_lists()
	var ok2: bool = (T.ent as Array).size() == 8 and lab2 == "Ристалище: турнир начнётся в 10:00" and _dlg_text().begins_with("Оруженосцы чистят доспехи") and not on
	_close()
	var own: int = (T.ent as Array).filter(func(e): return JS.n(e.id) >= 0).size()
	print("selftest: турнир — участников ", (T.ent as Array).size(), " (своих ", own, "), в 9:00 «", lab2, "» ", ok2)
	res = res and ok2
	# 10:05, король во дворе: зрители от домов, герольд, семья и совет — на трибунах
	_hour(10.05)
	c._tick(0.05)
	var her: Dictionary = c.npc_by("tr_her")
	var ng := _ng()
	var ns := _ns()
	var lab3 := label()
	var ok3: bool = on and not her.is_empty() and her.loc == "yard" and ng >= 1 and lab3 == "Турнир: выйти на ристалище" and Snd.resolve() == "tourney"
	print("selftest: турнир — начался ", on, ", герольд ", not her.is_empty(), ", зрителей ", ng - 1, ", на трибунах ", ns, ", «", lab3, "», музыка ", Snd.resolve(), " ", ok3)
	res = res and ok3
	# поединок на виду: три сшибки или пока кто-то не вылетит из седла; всадники — среди людей
	_hour(10.25)
	c._tick(0.05)
	var vis0: bool = b != null
	var seen := {"nodes": 0, "e": false}     # лямбда меняет словарь (свои переменные она копирует)
	var i1 := _until(func():
		if c.xn.has("trn_a") and c.xn.has("trn_b"):
			seen.nodes = 2
		return b == null)
	var nodes: int = seen.nodes
	var r0: Dictionary = T.res[0] if not (T.res as Array).is_empty() else {}
	var ok4: bool = vis0 and i1 > 0 and (T.res as Array).size() == 1 and nodes == 2 and (int(r0.w) == 0 or int(r0.w) == 1)
	print("selftest: турнир — поединок на виду ", vis0, " за ", i1, " кадров, всадники ", nodes, ", итог ", r0, " ", ok4)
	res = res and ok4
	# второй поединок: король просится к барьеру следующим — после него выходит сам (E, когда копьё на середине щита)
	_hour(10.95)
	_until(func(): return b != null, 20)
	_lists()
	var n5: int = (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	var t5 := _dlg_text()
	c.hud.choose(0)
	var kq0 := kq
	_close()
	var i2 := _until(func():
		if kj != null and kj.ph == "run" and kj.lock == null:
			if not seen.e:
				seen.e = c.nearest_target().has("e") and JS.t(c.king.get("hide"))
			kj.lock = {"x": 0.0, "y": 0.0}
			kj.q = 1.0
		return String(JS.o(T.get("king"), "")) != "" and c.hud.dlg != null, 4000)
	var see: bool = seen.e
	var kr := String(JS.o(T.get("king"), ""))
	var t6 := _dlg_text()
	var ok5: bool = n5 == 4 and t5.begins_with("На ристалище идёт поединок") and kq0 and see and i2 > 0 and ["win", "lose", "fall"].has(kr) and _dlg_name() == "Поединок" \
		and not JS.t(c.king.get("hide")) and kj == null and (T.res as Array).size() == 2
	print("selftest: турнир — король следующим ", kq0, ", у барьера (E) ", see, ", поединок короля за ", i2, " кадров: ", kr, " — «", t6.substr(0, 48), "…» ", ok5)
	res = res and ok5
	_close()
	c.heal.q = null
	k.erase("wound")
	_lists()
	var ch0: Dictionary = (c.hud.dlg.choices as Array)[0] if c.hud.dlg != null else {}
	var ok6: bool = not ch0.is_empty() and not bool((ch0.ok as Callable).call()) and String(ch0.why) == "Сегодня вы уже бились"
	_close()
	print("selftest: турнир — второй раз к барьеру нельзя: «", ch0.get("why", ""), "» ", ok6)
	res = res and ok6
	# досчёт к 15:30: семь поединков, победитель; награда у ристалища — венок (дом +3, слава +1)
	_hour(15.6)
	var i3 := _until(func(): return (T.res as Array).size() == 7 and b == null, 3000)
	var e: Dictionary = T.ent[int(JS.n(T.champ))] if JS.n(T.champ) >= 0 else {}
	var H0: Variant = _house(e) if not e.is_empty() else null
	var l0: float = JS.n(H0.loy) if H0 != null else 0.0
	var pr0 := JS.n(C.get("prestige"))
	var lab7 := label()
	_lists()
	var t7 := _dlg_text()
	var n7: int = (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	c.hud.choose(1)
	var ok7: bool = i3 >= 0 and not e.is_empty() and lab7 == "Турнир: вручить награду победителю" and t7.begins_with("Победитель турнира — " + String(e.n)) and n7 == 3 \
		and JS.t(T.get("prize")) and JS.n(C.get("prestige")) == JS.clp(pr0 + 1, -100, 100) and (H0 == null or JS.n(H0.loy) == clampf(l0 + 3, 0, 100)) and _dlg_name() == String(e.n)
	_close()
	print("selftest: турнир — досчёт за ", i3, " кадров, победитель ", e.get("n", "?"), ", «", lab7, "», награда ", JS.t(T.get("prize")), " ", ok7)
	res = res and ok7
	# 16:00: турнир окончен — зрители и герольд уходят, свои — по расписанию; в счёт царствования и летопись
	var st: Dictionary = SimArmy.RST()
	var tours0 := JS.n(st.get("tours")) if not st.is_empty() else 0.0
	_hour(16.02)
	c._tick(0.05)
	var ok8: bool = not on and JS.t(T.get("done")) and _ng() == 0 and _ns() == 0 and tour_t() == null and (st.is_empty() or JS.n(st.get("tours")) == tours0 + 1) and label() == "Ристалище: устроить турнир"
	print("selftest: турнир — окончен ", not on, ", гостей ", _ng(), ", на трибунах ", _ns(), ", турниров в царствование ", JS.n(st.get("tours")) if not st.is_empty() else -1.0, " ", ok8)
	res = res and ok8
	# рана: носилки к донжону, лекарь и супруг(а) у постели, дни в постели; встаёт — ещё беречься
	_hour(12.0)
	Hurt.wound_king(2, "плечо", "турнир")
	var wd := JS.n(k.wound) - float(Game.day)
	c.heal.queue({"from": "tourney"})
	var i9 := _until(func(): return c.heal.on and c.heal.sh == "litter" and c.fade == 0.0, 60)
	var lit: bool = c.loc_id == "yard" and JS.t(c.king.get("hide")) and (c.heal.men as Array).size() == 2 and c.xn.has("heal_lit") and c.blocked() and Snd.want == "lament"
	c.heal.skip()
	var i10 := _until(func(): return c.heal.sh == "bed" and c.fade == 0.0, 60)
	var bed_ok: bool = c.loc_id == "keep" and not JS.t(c.king.get("hide")) and c.king.sit != null and (c.heal.vis as Array).size() >= 1 and c.heal.cap.contains("дней " + str(c.heal.bed))
	var bd: int = c.heal.bed
	c.heal.skip()
	c.heal.skip()
	var d0 := Game.day
	var i11 := _until(func(): return not c.heal.on, 4000)
	var rest := JS.n(k.wound) - float(Game.day)
	var ok9: bool = wd >= 8 and i9 >= 0 and lit and i10 >= 0 and bed_ok and i11 > 0 and Game.day - d0 >= bd and rest >= 1 and rest <= ceilf(wd * 0.4) + 1 and Hurt.hurt(k) \
		and Hurt.walk_k() < 1.0 and not c.blocked()
	print("selftest: турнир — рана на ", wd, " дн.: носилки ", lit, ", постель ", bed_ok, " (", bd, " дн.), встал через ", Game.day - d0, " дн. за ", i11, " кадров, беречься ещё ", rest, " ", ok9)
	res = res and ok9
	# как было
	for f in keep:
		if keep[f] == null:
			k.erase(f)
		else:
			k[f] = keep[f]
	C.erase("tour")
	C.prestige = pr00
	P.done = done0
	SimExt.proj_rev += 1
	Game.day = day0
	Game.frac = frac0
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	c._tick(0.02)
	Snd.screen = snd0[0]
	Snd.court = snd0[1]
	Snd.want = snd0[2]
	print("selftest: турнир — ", "OK" if res else "FAIL")
	return res
