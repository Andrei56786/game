extends RefCounted
## Часовня, книги и темница (chapel.js): молитва у алтаря (раз в день; с витражами — сильнее), воскресная обедня
## (семья, совет и слуги на скамьях, проповедь отца Ансгара), чтение в библиотеке (навыки растут понемногу), узники
## короны (допрос, выкуп, служба, воля, казнь) и тюремщик со списком.
## G.court.prayDay / readDay / massDay / almsDay — дни последней молитвы, чтения, обедни, милостыни; hpray — молитва
## о здравии; ancS — сезон поминовения предков; bless = {k: "heir", until, m}; rx = {mar, dip, intr, stew, lrn} —
## прочитано вечеров (6 → навык +1); rxq — следующая страница книги; pris = {[id]: {told, ask, srv, ref, rans}}.
## Дни — по часам двора (Game.day), как G.day в HTML; случайные слова и удача — не из зерна королевства.
const People = preload("res://scripts/people.gd")
const CT := 16
const MASS_H0 := 9.0
const MASS_H1 := 10.5
const SERMON := ["Возлюбленные чада, смирение — первая из добродетелей.", "Блаженны милостивые, ибо они помилованы будут.", "Гордыня идёт впереди падения — помните об этом, сильные мира сего.",
	"Подайте нищему у ворот: Господь видит и малую лепту.", "Не хлебом единым жив человек, но и праведным судом.", "Помолимся о государе нашем и о мире в королевстве.", "Кто сеет ветер, пожнёт бурю."]
const BOOKS := {
	"mar": ["«Наставления Суна о войне»", ["Сун пишет (гл. 1): война — путь обмана. Сильный кажется слабым, близкий — далёким, готовый к бою — беспечным.",
		"Сун пишет (гл. 3): лучшая победа — та, что взята без битвы. Сломить замысел врага выше, чем разбить его войско.", "Сун пишет (гл. 3): худшее для полководца — осаждать крепости. За стены берутся, когда иных путей уже нет.",
		"Сун пишет (гл. 3): знай врага и знай себя — и в сотне битв не будет беды. Знаешь лишь себя — победа и поражение пополам.", "Сун пишет (гл. 2): ни одной державе не пошла впрок долгая война. Быстрая победа лучше искусной медлительности.",
		"Сун пишет (гл. 7): не нападай в гору на того, кто стоит наверху, и не гонись за войском, что отходит в порядке.", "Сун пишет (гл. 9): если солдаты, черпая воду, пьют первыми — войско томится жаждой. Смотри на мелочи."]],
	"dip": ["«Посольские письма»", ["Старый посол пишет: дар открывает ворота быстрее тарана, но и закрываются они так же быстро.", "Союз держится на выгоде, а не на клятвах. Узнай, чего хочет сосед, — и он сам придёт к столу.",
		"Кто дольше слушает, тот говорит последним, а последнее слово запоминают.", "Обида правителя живёт дольше его благодарности. Не задевай чужую гордость без нужды.", "Хорошее письмо — короткое письмо. Длинные пишут те, кому нечего предложить."]],
	"intr": ["«Тайная хроника двора»", ["Хронист пишет: тайна, которую знают двое, — уже наполовину слух.", "Сун пишет (гл. 13): не жалей серебра на лазутчиков — оно сбережёт тысячи жизней.",
		"Лучший соглядатай тот, кого не замечают: прачка, конюх, нищий у ворот.", "Заговорщик улыбается за столом шире всех. Смотри не на улыбки, а на руки.", "Ложное донесение, поданное вовремя, стоит целого полка."]],
	"stew": ["«Книга счёта и мер»", ["Казначей прежних времён пишет: амбар — первая крепость королевства.", "Подать с голодного — это заём у будущего, и отдавать его придётся с лихвой.",
		"Дорога, проложенная в мирный год, окупается в год войны.", "Считай не то, что пришло в казну, а то, что из неё утекло.", "Купцы любят тихие дороги и честные весы. Дай им это — и они сами принесут золото."]],
	"lrn": ["«Свод учёного монаха»", ["Монах пишет: звёзды не лгут — лгут те, кто их толкует.", "Перечерти старую карту — и найдёшь дорогу, которой нет у врага.",
		"Лекарь, что моет руки, теряет меньше раненых. Отчего — пока не знает никто.", "Кто записывает, тот помнит. Кто помнит — тот правит дольше."]]}
const PRIS_ROLE := {"general": "воевода", "knight": "рыцарь", "lord": "лорд", "ruler": "правитель", "courtier": "придворный", "council": "советник", "scholar": "учёный"}
const PEWS := 24                 # скамьи часовни pew0…pew23 (L.pews в HTML)
static var bell := -1            # CHP.bell: в этот день колокол уже звал к обедне
var c: Node2D                    # court.gd
var on := false                  # CHP.on: обедня собрана (люди на скамьях)
var ser := 0.0                   # до следующей строки проповеди, с
var si := 0
var amen := 0.0
var seen_h := 0.0                # сколько часов обедни король видел сам
var last_h := -1.0
var motes: Array = []            # свечение после молитвы (реальное время — пока открыт текст молитвы)
var q: Array = []                # [человек, скамья]: кто войдёт в дверь часовни (или просто окажется на месте)
var qt := 0.0

func _init(court: Node2D) -> void:
	c = court

static func _day() -> float:
	return float(Game.day)

static func _today(v: Variant) -> bool:
	return v != null and (v is float or v is int) and float(v) == _day()

static func _pick(L: Array) -> String:
	return String(L[randi() % L.size()])

static func ok() -> bool:
	return not Sim.G.is_empty() and Sim.G.has("court")

static func glass_k() -> float:
	return 1.5 if SimDyn.projDone("stainglass") else 1.0

static func _pct(p: float) -> String:
	return JS.s(JS.rnd(p * 100.0)) + "%"

static func _f1(v: float) -> String:
	return JS.s(JS.rnd(v * 10.0) / 10.0).replace(".", ",")

## обедня идёт (massOn): воскресенье, 9:00–10:30
static func mass_on() -> bool:
	if not ok() or JS.t(Sim.G.get("visit")) or Game.day % 7 != 6:
		return false
	var h := Game.hour_abs()
	return h >= MASS_H0 and h < MASS_H1

## подписи мест (как свойства label в HTML): алтарь, скамья, книги
static func label(a: Dictionary) -> String:
	if ok():
		var C: Dictionary = Sim.G.court
		match String(a.id):
			"pray":
				return "Алтарь (сегодня вы уже молились)" if _today(C.get("prayDay")) else "Помолиться у алтаря"
			"kpew":
				return "Обедня: сесть на королевскую скамью" if mass_on() else "Королевская скамья"
			"read":
				return "Книги (на сегодня довольно)" if _today(C.get("readDay")) else "Почитать книгу"
	return String(a.label)

# ---------- молитва ----------
## свечение у алтаря (chapelGlow): искры поднимаются, пока открыт текст молитвы
func glow() -> void:
	var cols := [Color8(0xf7, 0xd3, 0x5c), Color8(0xff, 0xf4, 0xc0), Color8(0xf0, 0xb8, 0x60)]
	for i in 18:
		motes.append({"x": 13.0 * CT + randf_range(-22, 22), "y": 5.0 * CT + randf_range(-2, 12), "t0": c.t + randf_range(0, 1.2), "c": cols[randi() % 3]})

func pray_done(t: String) -> void:
	Sim.G.court.prayDay = _day()
	Snd.sfx("choir")
	if c.loc_id == "chapel":
		glow()
	c.hud.say(null, t, {"name": "Молитва"})
	print("PRAYED")

## у алтаря (ACTS_EXT.pray): о здравии, о победе или о мире, о мудрости, о наследнике, за упокой предков
func pray() -> void:
	if not SimPlayer.ensure_sim():
		return
	var G := Sim.G
	var C: Dictionary = G.court
	var k: Dictionary = SimPlayer.kingC()
	var m := glass_k()
	if _today(C.get("prayDay")):
		c.hud.say(null, "Вы уже молились сегодня. Свечи у алтаря догорают; отец Ансгар советует прийти завтра.", {"name": "Алтарь"})
		return
	var war := not SimDay.warsOf(0).is_empty()
	var hurt := JS.n(k.get("wound")) > _day()
	var A: Array = (G.armies as Array).filter(func(a): return JS.t(a.alive) and a.realm == 0.0 and (a.kind == "lord" or a.kind == "player"))
	var sp: Variant = k.get("spouse")
	var q0: Variant = Sim.charOf(sp) if sp != null and float(sp) >= 0.0 else null
	var mom: Variant = (k if JS.t(k.get("fem")) else q0) if q0 != null and JS.t(q0.alive) else null
	var sk := float(Sim.yearOf(_day()) * 4 + Sim.seasonOf(_day()))
	var w := JS.rnd(2.0 * m)
	var ch: Array = []
	ch.append({"t": "О здравии", "tip": "Рана заживёт быстрее: −" + JS.s(w) + " дн." if hurt else "Семья короля под покровом: меньше риск хвори (сезон).", "fx": func():
		if hurt:
			k.wound = JS.n(k.wound) - w
			pray_done("Боль в ране утихает. Лекарь потом скажет: заживает на диво быстро." if JS.n(k.wound) > _day() else "Боль уходит совсем — рана затянулась.")
		else:
			C.hpray = _day()
			pray_done("Вы просите здравия себе и близким. На душе становится спокойнее.")})
	if war:
		ch.append({"t": "О победе нашего оружия", "tip": "Боевой дух войск короны +" + JS.s(JS.rnd(4.0 * m)) + ".", "ok": func(): return A.size() > 0, "why": "Войска короны не в поле", "fx": func():
			for a in A:
				a.morale = JS.clp(JS.n(a.morale) + 4.0 * m, 0, 100)
			pray_done("Вы молитесь за воинов короны. Говорят, в лагерях в тот вечер пели громче обычного.")})
	else:
		ch.append({"t": "О мире в королевстве", "tip": "Смута в столичной провинции −" + JS.s(JS.rnd(3.0 * m)) + ".", "fx": func():
			SimCourt.provUnrest(G.realms[0].capital, -3.0 * m)
			pray_done("Вы молитесь о тишине на дорогах и хлебе в амбарах. Весть о королевской молитве обходит столицу.")})
	ch.append({"t": "О мудрости", "tip": "Исследование магистра: +" + JS.fixed(1.5 * m, 1).replace(".", ",") + ".", "fx": func():
		SimTech.techProgress(1.5 * m)
		pray_done("Вы просите ясности ума. Мысли, что путались с утра, вдруг встают по порядку.")})
	if mom != null:
		ch.append({"t": "О наследнике", "tip": "Неделю шанс зачатия выше.", "ok": func(): return not JS.t(mom.get("preg")), "why": ("Вы" if is_same(mom, k) else "Королева") + " уже ждёт ребёнка", "fx": func():
			C.bless = {"k": "heir", "until": _day() + 7, "m": m}
			pray_done("Вы просите Господа о наследнике. Отец Ансгар обещает молиться о том же каждый вечер.")})
	ch.append({"t": "За упокой предков", "tip": "Раз в сезон. Слава +1.", "ok": func(): return C.get("ancS") != sk, "why": "В этом сезоне уже поминали", "fx": func():
		C.ancS = sk
		SimCourt.prestige(1)
		pray_done("Вы ставите свечи за королей, что правили до вас. Летописец запишет: государь чтит предков.")})
	ch.append({"t": "Встать"})
	c.hud.say(null, "Вы преклоняете колени у алтаря" + ("; цветные блики витражей ложатся на камень" if m > 1.0 else "") + ". О чём просить?", {"name": "Алтарь", "choices": ch, "esc": ch.size() - 1})
	print("ALTAR ", ch.size())

## свечение (CRENDER2): поверх людей, в часовне
func draw(n: Node2D) -> void:
	if motes.is_empty() or c.loc_id != "chapel":
		return
	motes = motes.filter(func(p): return c.t - float(p.t0) < 2.4)
	for p in motes:
		var t: float = c.t - float(p.t0)
		if t < 0.0:
			continue
		var x := roundf(float(p.x) + sin(t * 3.0 + float(p.x)) * 3.0)
		var y := roundf(float(p.y) - t * 14.0)
		var col: Color = p.c
		col.a = clampf(minf(t * 3.0, 2.4 - t), 0, 1) * 0.9
		n.draw_rect(Rect2(x, y, 1, 1), col)
		if t > 0.4 and t < 1.6:
			col.a *= 0.5
			n.draw_rect(Rect2(x - 1, y, 3, 1), col)
			n.draw_rect(Rect2(x, y - 1, 1, 3), col)

# ---------- воскресная обедня ----------
func sermon_line() -> String:
	var L: Array = SERMON.duplicate()
	var s := Game.season()
	var hr: Variant = SimDyn.heirOf()
	if not SimDay.warsOf(0).is_empty():
		L.append("Помолимся о воинах на рубежах — да вернутся они к своим очагам.")
	if s == 2:
		L.append("Возблагодарим Господа за собранный урожай.")
	if s == 3:
		L.append("Зима сурова: делитесь хлебом с ближним.")
	if s == 0:
		L.append("Весна — время сеять. И добрые дела тоже.")
	if hr != null and String(hr.get("name", "")) != "":
		L.append("Помолимся о наследнике престола, " + String(hr.name) + ".")
	si = (si + 1 + randi_range(0, 2)) % L.size()
	return L[si]

static func _char_of(n: Dictionary) -> Variant:
	return Sim.charOf(n.cid) if n.has("cid") else null

## кто идёт к обедне (massPeople): королева, дети и воспитанники с 4 лет, совет, слуги
func mass_people() -> Array:
	var out: Array = []
	var sp: Dictionary = c.npc_by("spouse")
	if not sp.is_empty():
		out.append(sp)
	for n in c.npcs:
		var k := String(n.key)
		if k.begins_with("kid") or k.begins_with("ward"):
			var ch: Variant = _char_of(n)
			if ch != null and JS.n(ch.get("age")) >= 4:
				out.append(n)
	for s: Dictionary in Sim.SEATS:
		var n: Dictionary = c.npc_by("seat_" + String(s.k))
		if not n.is_empty():
			out.append(n)
	for k in ["srv_maid", "srv_page", "srv_gardener", "srv_stable", "srv_cook"]:
		var n: Dictionary = c.npc_by(k)
		if not n.is_empty():
			out.append(n)
	return out.filter(func(n):
		if JS.t(n.get("follow")) or JS.t(n.get("guest")) or JS.t(n.get("tguest")):
			return false
		var ch: Variant = _char_of(n)
		var pr: Variant = ch.get("prison") if ch != null else null
		return not (pr != null and float(pr) >= 0.0))

## сразу на место (snapTo): тот, кого король не видит, просто оказывается на скамье
func snap_to(n: Dictionary, spn: String) -> void:
	var sp: Dictionary = c.spots.get(spn, {})
	if sp.is_empty():
		return
	c.people.place(n, sp)
	n.away = false
	n.x = float(sp.get("sx", sp.x))
	n.y = float(sp.get("sy", sp.y))
	n.sit = sp if JS.t(sp.get("sit")) else null
	n.lie = false
	n.path = null
	n.goal = null
	n.wander = null
	n.cur = spn

func _ov(n: Dictionary, sp: String) -> void:
	n.override = {"spot": sp, "until": MASS_H1, "day": Game.day, "mass": 1}
	n.cur = ""
	n.wander = null
	if n.loc != c.loc_id or n.away:
		q.append([n, sp])

func begin() -> void:
	on = true
	ser = 2.5
	amen = 0.0
	seen_h = 0.0
	last_h = -1.0
	q = []
	qt = 0.0
	var P := mass_people()
	for i in mini(P.size(), PEWS):
		_ov(P[i], "pew" + str(i))
	var pr: Dictionary = c.npc_by("srv_chaplain")
	if not pr.is_empty():
		_ov(pr, "mass_priest")
	print("MASS BEGIN ", mini(P.size(), PEWS))

func end() -> void:
	on = false
	q = []
	for n in c.npcs:
		var ov: Variant = n.get("override")
		if ov is Dictionary and JS.t(ov.get("mass")):
			n.override = null
			n.cur = ""
	var pr: Dictionary = c.npc_by("srv_chaplain")
	if not pr.is_empty() and c.loc_id == "chapel" and pr.loc == "chapel":
		c.people.say(pr, "Ступайте с миром.", 3.0)
	print("MASS END")

## король отстоял обедню (massAttend): знать довольна, люди на скамьях — верность +1
func attend() -> void:
	var G := Sim.G
	G.court.massDay = _day()
	for H0 in G.houses:
		if JS.t(H0.alive):
			SimPlayer.houseLoy(H0, 1)
	SimCourt.prestige(0.5)
	for n in c.npcs:
		var ov: Variant = n.get("override")
		if ov is Dictionary and JS.t(ov.get("mass")) and n.loc == "chapel":
			var ch: Variant = _char_of(n)
			if ch != null and not JS.t(ch.get("pseudo")):
				ch.loy = JS.clp(float(JS.o(ch.get("loy"), 60.0)) + 1.0, 0, 100)
	c.hud.toast("Король на воскресной обедне: знать довольна (дома +1), слава +0,5.")
	Sim.glog("Король отстоял воскресную обедню в часовне.", "good")
	print("MASS ATTENDED")

## каждый кадр двора (UPD_EXT): колокол в 8:45, люди сходятся, проповедь, «Аминь», конец в 10:30
func update(dt: float) -> void:
	if not ok() or JS.t(Sim.G.get("visit")):
		return
	var G := Sim.G
	var C: Dictionary = G.court
	var h := Game.hour_abs()
	var here: bool = c.loc_id == "chapel"
	var gather: bool = Game.day % 7 == 6 and h >= 8.75 and h < MASS_H1
	if gather and bell != Game.day:
		bell = Game.day
		if JS.t(G.get("atCourt")):
			Snd.sfx("bell")
			c.hud.toast("Воскресенье: колокол зовёт к обедне — в 9:00, в часовне.")
	if gather and not on:
		begin()
	elif not gather and on:
		end()
	if not q.is_empty():
		if not here:
			while not q.is_empty():
				var e: Array = q.pop_front()
				var n: Dictionary = e[0]
				if n.loc != c.loc_id or n.away:
					snap_to(n, e[1])
		else:
			qt -= dt
			if qt < 0.0:
				qt = 0.7
				var n: Dictionary = q.pop_front()[0]
				if n.loc != "chapel" or n.away:
					c.people.place(n, {"loc": "chapel", "x": 13.0 * CT, "y": 19.0 * CT + 6.0, "dir": "up"})
					n.away = false
					n.cur = ""
	if on and here and mass_on():
		if last_h >= 0.0 and h > last_h:
			seen_h += minf(0.25, h - last_h)
		last_h = h
		if seen_h >= 0.5 and not _today(C.get("massDay")):
			attend()
		var pr: Dictionary = c.npc_by("srv_chaplain")
		if not pr.is_empty() and pr.loc == "chapel" and pr.path == null and pr.goal == null:
			ser -= dt
			if ser < 0.0:
				ser = randf_range(4.5, 6.5)
				c.people.say(pr, sermon_line(), 4.2)
				if randf() < 0.45:
					amen = 4.4
		if amen > 0.0:
			amen -= dt
			if amen <= 0.0:
				var L: Array = c.npcs.filter(func(n): return n.loc == "chapel" and n.sit != null and n.bub == "" and n.get("override") is Dictionary and JS.t(n.override.get("mass")))
				for i in 2:
					if L.is_empty():
						break
					var j := randi() % L.size()
					c.people.say(L[j], "Аминь.", 1.6)
					L.remove_at(j)
	else:
		last_h = -1.0

## королевская скамья (ACTS_EXT.kpew)
func kpew() -> void:
	c.sit_at(c.spots.pew_k)
	if not mass_on():
		c.hud.toast("Обедня начнётся в 9:00." if Game.day % 7 == 6 and Game.hour_abs() < MASS_H0 else "Тихо. Только свечи потрескивают у алтаря.")

## отец Ансгар (chaplainTalk): когда обедня, помолиться, раздать милостыню
func chaplain_talk(n: Dictionary) -> void:
	var C: Dictionary = Sim.G.court
	var h := Game.hour_abs()
	var d := (6 - Game.day % 7 + 7) % 7
	if d == 0 and h >= MASS_H1:
		d = 7
	var when := "Обедня идёт — садитесь на королевскую скамью." if mass_on() else ("Обедня сегодня в 9:00." if d == 0 else "Обедня — " + SimText.inDays(d) + ", в воскресенье, в 9:00.")
	c.hud.say(n, "Благослови вас Господь, государь. " + when, {"choices": [
		{"t": "Помолиться у алтаря", "ok": func(): return not _today(C.get("prayDay")), "why": "Вы уже молились сегодня", "fx": func(): pray()},
		{"t": "Раздать милостыню (10 зол.)", "tip": "Раз в неделю. Смута в столице −2, слава +0,5.", "ok": func(): return not (C.get("almsDay") != null and float(C.almsDay) > _day() - 7), "why": "На этой неделе уже подавали", "fx": func():
			if not SimCourt.spend(10):
				c.hud.toast("В казне нет и десяти монет.")
				return
			C.almsDay = _day()
			SimCourt.provUnrest(Sim.G.realms[0].capital, -2)
			SimCourt.prestige(0.5)
			Snd.sfx("coin")
			c.hud.say(n, "Нищие у ворот будут молиться за вас, государь.")},
		{"t": "Ступайте с миром, отче"}], "esc": 2})

# ---------- книги в библиотеке ----------
## полки (ACTS_EXT.read): раз в день — одна книга; 6 вечеров → навык +1 (с крылом библиотеки — по 1,5 за вечер)
func read() -> void:
	if not SimPlayer.ensure_sim():
		return
	var C: Dictionary = Sim.G.court
	var k: Dictionary = SimPlayer.kingC()
	var lib := SimDyn.projDone("libwing")
	var gain := 1.5 if lib else 1.0
	if not (C.get("rx") is Dictionary):
		C.rx = {}
	if _today(C.get("readDay")):
		c.hud.say(null, "Глаза устали, свеча оплыла. На сегодня довольно — книги подождут до завтра.", {"name": "Библиотека"})
		return
	var ks: Array = ["mar", "dip", "intr", "stew"] + (["lrn"] if lib else [])
	var ch: Array = []
	for sk: String in ks:
		var v := JS.n(k.get(sk))
		ch.append({"t": String(BOOKS[sk][0]) + " — " + String(Sim.T.SKN[sk]),
			"tip": [String(Sim.T.SKN[sk]) + " (" + String(Sim.T.SKD[sk]) + "): " + JS.s(v) + (" — предел" if v >= 20 else ""),
				"Прочитано " + _f1(JS.n(C.rx.get(sk))) + " из 6 вечеров" + (" (крыло библиотеки: ×1,5)" if lib else "") + " → +1"],
			"ok": func(): return JS.n(k.get(sk)) < 20, "why": "Здесь вы знаете всё, что написано", "fx": func(): read_book(sk, gain)})
	ch.append({"t": "Поставить книгу на место"})
	c.hud.say(null, "Полки ломятся от переплётов" + (" — новое крыло пахнет свежим деревом и пергаментом" if lib else "") + ". Что почитать сегодня?", {"name": "Библиотека", "choices": ch, "esc": ch.size() - 1})
	print("BOOKS ", ch.size())

func read_book(sk: String, gain: float) -> void:
	var C: Dictionary = Sim.G.court
	var k: Dictionary = SimPlayer.kingC()
	var B: Array = BOOKS[sk]
	C.readDay = _day()
	C.rx[sk] = JS.n(C.rx.get(sk)) + gain
	if not (C.get("rxq") is Dictionary):
		C.rxq = {}
	Snd.sfx("paper")
	var q1: float = float(C.rxq[sk]) if C.rxq.get(sk) != null else -1.0
	var qi := int(q1 + 1.0) % (B[1] as Array).size()
	C.rxq[sk] = float(qi)
	var up := ""
	if JS.n(C.rx[sk]) >= 6 and JS.n(k.get(sk)) < 20:
		C.rx[sk] = JS.n(C.rx[sk]) - 6
		k[sk] = minf(20, JS.n(k.get(sk)) + 1)
		up = "Знание крепнет: " + String(Sim.T.SKN[sk]) + " +1"
		Sim.glog("Король прилежно читает: " + String(Sim.T.SKD[sk]) + " — " + String(Sim.T.SKN[sk]) + " " + JS.s(k[sk]) + ".", "good")
	var oe: Variant = null
	if up != "":
		oe = func():
			c.hud.toast(up)
			Snd.sfx("chime")
	c.hud.say(null, String(B[1][qi]), {"name": String(B[0]), "on_end": oe})
	print("READ ", sk, " ", JS.s(C.rx[sk]))

# ---------- узники короны ----------
static func pris_st(ch: Dictionary) -> Dictionary:
	var C: Dictionary = Sim.G.court
	if not (C.get("pris") is Dictionary):
		C.pris = {}
	var id := JS.s(ch.id)
	if not (C.pris.get(id) is Dictionary):
		JS.oset(C.pris, id, {})
	return C.pris[id]

static func pris_who(ch: Dictionary) -> String:
	var r := float(ch.get("realm", 0))
	return String(PRIS_ROLE.get(String(ch.get("role", "")), "пленник")) + (", подданный короны" if r == 0.0 else (" державы " + Sim.realmName(r) if r < 5 else " из Вольных земель"))

static func pris_price(ch: Dictionary) -> float:
	return 250.0 if ch.get("role") == "ruler" else 40.0 + float(JS.o(ch.get("mar"), 5.0)) * 6.0

static func _tr(ch: Dictionary) -> Array:
	return ch.get("traits", []) if ch.get("traits") is Array else []

static func pris_ask_p(ch: Dictionary) -> float:
	var k: Dictionary = SimPlayer.kingC()
	var tr := _tr(ch)
	return JS.clp(0.4 + (JS.n(k.get("intr")) - 10) * 0.03 + (0.1 if SimDyn.seatChar("eye") != null else 0.0) + (0.25 if tr.has("craven") else 0.0) - (0.15 if tr.has("proud") else 0.0)
		- (0.1 if tr.has("brave") else 0.0) - (0.05 if tr.has("honest") else 0.0), 0.1, 0.9)

static func pris_srv_p(ch: Dictionary) -> float:
	var k: Dictionary = SimPlayer.kingC()
	var tr := _tr(ch)
	return JS.clp(0.18 + (JS.n(k.get("dip")) - 10) * 0.025 + (JS.n(Sim.G.court.get("prestige")) / 400) + (0.2 if float(ch.get("realm", 0)) >= 5 else 0.0) - (0.15 if tr.has("honest") else 0.0)
		- (0.1 if tr.has("proud") else 0.0) + (0.12 if tr.has("greedy") else 0.0) + (0.1 if tr.has("craven") else 0.0), 0.05, 0.85)

## кто говорит: человек в темнице — или, если его там нет (тюремщик назвал), сам узник с портретом
func _who(n: Dictionary, ch: Dictionary) -> Dictionary:
	if n.has("key"):
		return n
	var nm := (String(ch.title) + " " if String(ch.get("title", "")) != "" and not JS.t(ch.get("pseudo")) else "") + String(ch.name)
	return {"name": nm, "port": int(People.look(c.D, ch)[1]), "sub": ""}

func pris_say(n: Dictionary, ch: Dictionary, t: Variant, o := {}) -> void:
	var oo := {"sub": "Узник короны · " + pris_who(ch)}
	oo.merge(o, true)
	c.hud.say(_who(n, ch), t, oo)

## разговор с узником (prisonerTalk): свой — допросить, помиловать, казнить; чужой — ещё выкуп, служба, воля
func prisoner_talk(n: Dictionary, ch: Dictionary) -> void:
	if not JS.t(ch.alive) or float(ch.get("prison", -1)) != 0.0:
		pris_say(n, ch, "Я больше не ваш узник, государь.")
		return
	var G := Sim.G
	var P := pris_st(ch)
	var own: bool = float(ch.get("realm", 0)) == 0.0
	var r := int(ch.get("realm", 0))
	var H0: Variant = SimDyn.houseOf(ch)
	var line := People.prisoner_line(ch)
	var ch_l: Array = [{"t": "Допросить", "tip": "Шанс ~" + _pct(pris_ask_p(ch)) + (". Может открыть тайну двора." if own else ". Казна, войска и войны его державы."),
		"ok": func(): return not JS.t(P.get("told")) and not (P.get("ask") != null and float(P.ask) > _day() - 3), "why": "Он рассказал всё, что знал" if JS.t(P.get("told")) else "Он молчит — попробуйте через пару дней",
		"fx": func(): pris_ask(n, ch)}]
	if own:
		ch_l.append({"t": "Помиловать", "tip": "Дом " + String(H0.name) + " +8." if H0 != null else "Слава милостивого короля.", "fx": func(): pris_pardon(n, ch)})
		ch_l.append({"t": "Казнить", "tip": ("Дом " + String(H0.name) + " −20, прочие дома −2. " if H0 != null else "") + "Страх перед короной растёт.", "fx": func(): pris_exec_ask(n, ch)})
	else:
		var rn := Sim.realmName(r) if r < 5 else ""
		ch_l.append({"t": "Предложить выкуп (" + JS.s(pris_price(ch)) + " зол.)", "tip": "Письмо его господину; ответ через 2–5 дней.",
			"ok": func(): return r < 5 and SimDay.alive(r) and not JS.t(P.get("rans")) and not (P.get("ref") != null and float(P.ref) > _day() - 7),
			"why": "За вольного барона платить некому" if r >= 5 else ("Его держава пала — платить некому" if not SimDay.alive(r) else ("Письмо уже в пути" if JS.t(P.get("rans")) else "Недавно отказали — подождите")),
			"fx": func(): pris_ransom(n, ch)})
		ch_l.append({"t": "Предложить службу", "tip": "Шанс ~" + _pct(pris_srv_p(ch)) + ". Его держава обидится.",
			"ok": func(): return not JS.t(P.get("srv")) and ch.get("role") != "ruler" and not (G.armies as Array).any(func(a): return JS.t(a.alive) and a.get("gen") == ch.id),
			"why": "Он уже ответил отказом" if JS.t(P.get("srv")) else ("Правитель не пойдёт в слуги" if ch.get("role") == "ruler" else "Его войско ещё в поле: он связан присягой"),
			"fx": func(): pris_serve(n, ch)})
		ch_l.append({"t": "Отпустить с миром", "tip": ("Мнение державы " + rn + " +8, " if r < 5 else "") + "слава +1.", "fx": func(): pris_release(n, ch)})
		ch_l.append({"t": "Казнить", "tip": ("Держава " + rn + ": мнение −25, прочие −5. " if r < 5 else "") + "Страх перед короной растёт.", "ok": func(): return ch.get("role") != "ruler",
			"why": "Казнить правителя — значит навеки войну", "fx": func(): pris_exec_ask(n, ch)})
	ch_l.append({"t": "Оставить в темнице" if own else "Уйти"})
	pris_say(n, ch, line + (" Письмо о выкупе в пути." if JS.t(P.get("rans")) else ""), {"choices": ch_l, "esc": ch_l.size() - 1})
	print("PRISONER ", ch.id, " ", ch_l.size())

## что знает пленник о своей державе (prisIntel)
static func pris_intel(ch: Dictionary) -> String:
	var r := int(ch.get("realm", 0))
	if r >= 5 or not SimDay.alive(r):
		return "«Мой господин? Сидит в своей башне и считает овец». Ничего важного он не знает."
	var G := Sim.G
	var Rr: Dictionary = G.realms[r]
	var A: Array = (G.armies as Array).filter(func(a): return JS.t(a.alive) and a.realm == float(r) and (a.kind == "lord" or a.kind == "player"))
	var men := 0.0
	for a in A:
		men += Sim.menOf(a.u)
	var wars: Array = SimDay.warsOf(r).map(func(x): return Sim.realmName(x))
	return "Под нажимом он рассказывает: в казне державы " + Sim.realmName(r) + " около " + JS.s(maxf(0, JS.rnd(JS.n(Rr.gold) / 10) * 10)) + " зол.; в поле " + str(A.size()) + " " \
		+ SimText.plural(A.size(), "войско", "войска", "войск") + " (" + SimText.voin(men) + "); " + ("воюют с: " + ", ".join(wars) if not wars.is_empty() else "ни с кем не воюют") + "."

func pris_ask(n: Dictionary, ch: Dictionary) -> void:
	var P := pris_st(ch)
	var C: Dictionary = Sim.G.court
	if not (randf() < pris_ask_p(ch)):
		P.ask = _day()
		Snd.sfx("thud")
		pris_say(n, ch, _pick(["Он смотрит сквозь вас и молчит.", "Он сплёвывает на солому: «Ничего ты от меня не услышишь».", "Он лишь усмехается разбитыми губами."]))
		print("ASKED 0")
		return
	P.told = 1.0
	Snd.sfx("chime")
	print("ASKED 1")
	if float(ch.get("realm", 0)) == 0.0:
		var S: Array = (C.get("secrets", []) as Array).filter(func(x): return not JS.t(x.get("known")) and x.k != "love")
		var s: Variant = null
		for x in S:
			if x.get("who") is Array and (x.who as Array).has(ch.id):
				s = x
				break
		if s == null and not S.is_empty():
			s = S[0]
		if s != null:
			c.meet.reveal_secret(s, "допрос в темнице")
			Sim.glog("На допросе открылась тайна: " + SimCourt.secretText(s), "info")
			return
		pris_say(n, ch, "Он клянётся, что ничего не скрывает. Похоже, так и есть: тайн за ним нет.")
		return
	var t := pris_intel(ch)
	pris_say(n, ch, t)
	Sim.glog("Допрос в темнице (" + String(ch.name) + "): " + t.trim_prefix("Под нажимом он рассказывает: "), "info")

## выйти из темницы (prisOut): к воротам — и со двора
func pris_out(n: Dictionary, ch: Dictionary, line: String) -> void:
	var C: Dictionary = Sim.G.court
	if C.get("pris") is Dictionary:
		C.pris.erase(JS.s(ch.id))
	if not n.has("key"):
		return
	n.erase("pris")
	n.erase("post")
	n.sub = "Выпущен на волю"
	n.talk_line = line
	if n.loc == "dungeon":
		c.people.place(n, {"loc": "dungeon", "x": float(n.x), "y": 8.0 * CT + 12.0, "dir": "down"})
		Snd.sfx("door")
	c.aud.npc_leave(n)

func pris_ransom(_n: Dictionary, ch: Dictionary) -> void:
	var P := pris_st(ch)
	P.rans = {"day": _day() + randi_range(2, 5), "gold": pris_price(ch)}
	Snd.sfx("paper")
	c.hud.say(null, "Писарь скрепляет письмо королевской печатью: выкуп — " + JS.s(P.rans.gold) + " зол., пленник — " + Sim.charName(ch) + ". Гонец уже в седле.", {"name": "Выкуп"})
	print("RANSOM ", ch.id, " ", JS.s(P.rans.day))

func pris_serve(n: Dictionary, ch: Dictionary) -> void:
	var P := pris_st(ch)
	var r := int(ch.get("realm", 0))
	P.srv = 1.0
	if not (randf() < pris_srv_p(ch)):
		Snd.sfx("thud")
		pris_say(n, ch, _pick(["«Я присягал один раз, и другой присяги не будет».", "«Служить тому, кто держит меня в цепях? Никогда».", "«Предателей не любят даже те, кому они служат»."]))
		print("SERVE 0")
		return
	var sub := "Узник короны · " + pris_who(ch)
	ch.realm = 0.0
	ch.prison = -1.0
	ch.role = "knight"
	ch.title = "Леди" if JS.t(ch.get("fem")) else "Сэр"
	ch.atCourt = 1.0
	ch.loy = 45.0
	if r < 5:
		SimDay.addOpn(r, 0, -6)
	pris_out(n, ch, "Я принесу присягу у ваших знамён, государь.")
	Snd.sfx("fanfare_small")
	c.hud.say(_who(n, ch), "«Пусть так. Отныне мой меч — ваш, государь». Кузнец сбивает с него оковы.", {"sub": sub})
	Sim.glog(String(ch.name) + " перешёл на службу короны.", "good")
	SimDyn.pop_rev += 1
	print("SERVE 1")

func pris_release(n: Dictionary, ch: Dictionary) -> void:
	var r := int(ch.get("realm", 0))
	ch.prison = -1.0
	if r < 5:
		SimDay.addOpn(r, 0, 8)
	SimCourt.prestige(1)
	var sub := "Узник короны · " + pris_who(ch)
	pris_out(n, ch, "Я не забуду вашей милости, король.")
	c.hud.say(_who(n, ch), "«Вы благородны, король. Я этого не забуду».", {"sub": sub})
	Sim.glog(Sim.charName(ch) + " отпущен из темницы без выкупа.", "info")
	SimDyn.pop_rev += 1
	print("RELEASED ", ch.id)

func pris_pardon(n: Dictionary, ch: Dictionary) -> void:
	var H0: Variant = SimDyn.houseOf(ch)
	ch.prison = -1.0
	ch.loy = JS.clp(float(JS.o(ch.get("loy"), 50.0)) + 10, 0, 100)
	if H0 != null:
		SimPlayer.houseLoy(H0, 8)
	SimCourt.prestige(0.5)
	var sub := "Узник короны · " + pris_who(ch)
	pris_out(n, ch, "Я не забуду вашей милости, государь.")
	c.hud.say(_who(n, ch), "«Благодарю, государь! Я искуплю…» Тюремщик гремит ключами.", {"sub": sub})
	Sim.glog(Sim.charName(ch) + " помилован и выпущен из темницы." + (" Дом " + String(H0.name) + " благодарен." if H0 != null else ""), "good")
	SimDyn.pop_rev += 1
	print("PARDONED ", ch.id)

func pris_exec_ask(n: Dictionary, ch: Dictionary) -> void:
	var H0: Variant = SimDyn.houseOf(ch)
	var r := int(ch.get("realm", 0))
	c.hud.say(null, "Приговор: " + Sim.charName(ch) + " — казнить? Этого уже не исправить." + ((" Дом " + String(H0.name) + " не простит." if H0 != null else "") if r == 0 else (" Держава " + Sim.realmName(r) + " возненавидит нас." if r < 5 else "")),
		{"name": "Приговор", "choices": [{"t": "На плаху", "fx": func(): pris_exec(n, ch)}, {"t": "Нет, не сейчас"}], "esc": 1})

func pris_exec(_n: Dictionary, ch: Dictionary) -> void:
	var G := Sim.G
	var r := int(ch.get("realm", 0))
	var H0: Variant = SimDyn.houseOf(ch)
	if G.court.get("pris") is Dictionary:
		G.court.pris.erase(JS.s(ch.id))
	if r == 0:
		if H0 != null:
			SimPlayer.houseLoy(H0, -20)
		for h in G.houses:
			if JS.t(h.alive) and not is_same(h, H0):
				SimPlayer.houseLoy(h, -2)
	elif r < 5:
		SimDay.addOpn(r, 0, -25)
		for t in range(1, 5):
			if t != r and SimDay.alive(t):
				SimDay.addOpn(t, 0, -5)
	G.realms[0].fear = JS.n(G.realms[0].get("fear")) + 4
	c.fade_to(func():
		var key := "pris" + JS.s(ch.id)
		for m in c.npcs.filter(func(x): return x.key == key):
			c.npcs.erase(m)
			if m.get("node") != null:
				(m.node as Node).queue_free()
				m.node = null
		SimDyn.charDies(ch, "казнён по приказу короля")
		Snd.sfx("thud")
		c.hud.say(null, "На рассвете у темничной стены всё кончено. " + ("Двор притих: о приговоре шепчутся во всех коридорах." if r == 0 else "Весть летит к границе быстрее гонца."), {"name": "Казнь"})
		print("EXECUTED ", ch.id))

## тюремщик Гуго (jailerTalk): список узников — с кем говорить
func jailer_talk(n: Dictionary) -> void:
	var G := Sim.G
	var P: Array = (G.chars as Array).filter(func(x): return JS.t(x.alive) and float(x.get("prison", -1)) == 0.0 and x.id != G.player.char)
	if P.is_empty():
		c.hud.say(n, "Камеры пусты, государь. Солома да крысы — вот и все мои узники.")
		return
	var ch: Array = []
	for x in P.slice(0, 5):
		ch.append({"t": Sim.charName(x) + " — " + pris_who(x), "fx": func(): prisoner_talk(c.npc_by("pris" + JS.s(x.id)), x)})
	ch.append({"t": "Ступай"})
	c.hud.say(n, "В темнице " + str(P.size()) + " " + SimText.plural(P.size(), "узник", "узника", "узников") + ". С кем желаете говорить, государь?", {"choices": ch, "esc": ch.size() - 1})
	print("JAILER ", P.size())

# ---------- самопроверка (main.gd -- --chapel и --selftest) ----------
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

func _close() -> void:
	while c.hud.dlg != null:
		c.hud.close_dlg()

func _ticks(n: int) -> void:
	for i in n:
		c._tick(0.05)

## чужой воевода не в темнице — кого посадить для проверки (других чужих, кроме правителей, в новой игре нет)
static func _foe_ok(x: Dictionary) -> bool:
	return JS.t(x.alive) and x.realm >= 1.0 and x.realm < 5.0 and x.get("role") == "general" and float(x.get("prison", -1)) != 0.0

func selftest() -> bool:
	if not ok():
		print("selftest: часовня — нет королевства")
		return false
	var G := Sim.G
	var C: Dictionary = G.court
	var k: Dictionary = SimPlayer.kingC()
	var res := true
	# молитва о мудрости: раз в день, свечение у алтаря; второй раз — «уже молились»
	C.erase("prayDay")
	c.cmd(PackedStringArray(["spot", "altar_front"]))
	var tg: Dictionary = c.nearest_target()
	var at_altar: bool = tg.has("a") and tg.a.id == "pray"
	var tp0 := JS.n(C.get("techP", 0))
	c.do_act({"id": "pray", "label": ""})
	var nch: int = (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	var wi := _choice("О мудрости")
	c.hud.choose(wi)
	var prayed := _today(C.get("prayDay")) and _dlg_name() == "Молитва" and motes.size() == 18
	_close()
	c.do_act({"id": "pray", "label": ""})
	var again := _dlg_name() == "Алтарь" and (c.hud.dlg.choices as Array).is_empty()
	_close()
	print("selftest: молитва — у алтаря ", at_altar, ", выборов ", nch, ", «О мудрости» ", wi, ", помолился ", prayed, ", искр ", motes.size(), ", снова — «", _dlg_name() if again else "-", "», подпись «", label({"id": "pray", "label": ""}), "»")
	res = res and at_altar and nch >= 5 and wi >= 0 and prayed and again and label({"id": "pray", "label": ""}).begins_with("Алтарь (")
	# книги: вечер чтения → rx +1, страница 0; шестой вечер — навык +1
	C.erase("readDay")
	C.erase("rx")
	C.erase("rxq")
	c.do_act({"id": "read", "label": ""})
	var nb: int = (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	c.hud.choose(0)
	var nm1 := _dlg_name()
	var r1: bool = JS.n(C.rx.get("mar")) >= 1.0 and float(C.rxq.mar) == 0.0 and _today(C.get("readDay")) and nm1 == "«Наставления Суна о войне»"
	_close()
	var mar0 := JS.n(k.get("mar"))
	C.rx.mar = 5.5
	C.erase("readDay")
	c.do_act({"id": "read", "label": ""})
	c.hud.choose(0)
	var page2: bool = float(C.rxq.mar) == 1.0
	_close()
	var grew: bool = JS.n(k.get("mar")) == minf(20, mar0 + 1) and JS.n(C.rx.mar) < 6
	print("selftest: книги — выборов ", nb, ", «", nm1, "», прочитано ", JS.s(JS.n(C.rx.get("mar"))), ", страница ", JS.s(float(C.rxq.mar)), ", меч короля ", JS.s(mar0), " → ", JS.s(JS.n(k.get("mar"))))
	res = res and nb >= 5 and r1 and page2 and grew
	# воскресная обедня: колокол в 8:45, совет, семья и слуги — на скамьях, король в часовне — знать довольна; в 10:30 — конец
	var d0 := Game.day
	Game.day = d0 + (6 - d0 % 7 + 7) % 7
	if Game.day == d0 and Game.hour_abs() >= 8.7:
		Game.day += 7
	Game.speed = 1
	Game.set_hour(8.6)
	c.last_hh = floori(Game.hour_abs() * 2.0)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	c.people.snap(false)
	c.cmd(PackedStringArray(["spot", "pew_k"]))
	c.do_act({"id": "kpew", "label": ""})
	var loy0 := 0.0
	for H0 in G.houses:
		if JS.t(H0.alive):
			loy0 += JS.n(H0.loy)
	var fr := 0
	while fr < 4000 and not on:
		c._tick(0.05)
		fr += 1
	var began := on
	var people_n := (mass_people() as Array).size()
	while fr < 8000 and not _today(C.get("massDay")):
		c._tick(0.05)
		fr += 1
	var seated: int = c.npcs.filter(func(n): return n.loc == "chapel" and n.sit != null and n.get("override") is Dictionary and JS.t(n.override.get("mass"))).size()
	var loy1 := 0.0
	for H0 in G.houses:
		if JS.t(H0.alive):
			loy1 += JS.n(H0.loy)
	var att := _today(C.get("massDay"))
	var at_h := Game.clock_text()
	var lab := label({"id": "kpew", "label": ""})
	Game.set_hour(10.4)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	while fr < 12000 and on:
		c._tick(0.05)
		fr += 1
	var left: int = c.npcs.filter(func(n): return n.get("override") is Dictionary and JS.t(n.override.get("mass"))).size()
	print("selftest: обедня — началась ", began, ", идут ", people_n, ", на скамьях ", seated, ", король отстоял ", att, " (", at_h, "), верность домов ", snappedf(loy0, 0.1), " → ", snappedf(loy1, 0.1),
		", подпись «", lab, "», конец ", not on, " (", Game.clock_text(), "), осталось на обедне ", left, ", кадров ", fr)
	res = res and began and people_n >= 8 and seated >= 6 and att and loy1 > loy0 and lab.begins_with("Обедня") and not on and left == 0
	c.stand_up()
	# капеллан: милостыня — раз в неделю, −10 зол.
	C.erase("almsDay")
	var g0 := JS.n(G.realms[0].gold)
	chaplain_talk(c.npc_by("srv_chaplain"))
	c.hud.choose(_choice("Раздать милостыню"))
	var alms: bool = _today(C.get("almsDay")) and absf(JS.n(G.realms[0].gold) - (g0 - 10)) < 1e-6
	_close()
	print("selftest: капеллан — милостыня ", alms)
	res = res and alms
	# узники: чужой лорд в темнице — тюремщик, выкуп (ответ — письмом), допрос; свой — тайна на допросе; казнь
	var foes: Array = (G.chars as Array).filter(func(x): return _foe_ok(x))
	var mine: Array = (G.chars as Array).filter(func(x): return JS.t(x.alive) and x.realm == 0.0 and x.get("role") == "knight" and x.id != G.player.char and float(x.get("prison", -1)) != 0.0)
	if foes.size() < 2 or mine.is_empty():
		print("selftest: узники — некого посадить (чужих ", foes.size(), ", своих ", mine.size(), ")")
		return false
	var f1: Dictionary = foes[0]
	var f2: Dictionary = foes[1]
	var m1: Dictionary = mine[0]
	for x in [f1, f2, m1]:
		x.prison = 0.0
	SimDyn.pop_rev += 1
	c.people.pop_check()
	var pn: Dictionary = c.npc_by("pris" + JS.s(f1.id))
	var in_cell: bool = not pn.is_empty() and pn.loc == "dungeon" and float(pn.get("talkR", 0)) == 52.0
	jailer_talk(c.npc_by("srv_jailer"))
	var nj: int = (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0
	var fi := _choice(Sim.charName(f1))
	c.hud.choose(fi)
	var ri := _choice("Предложить выкуп")
	c.hud.choose(ri)
	var P: Dictionary = C.pris[JS.s(f1.id)]
	var rans: bool = P.get("rans") is Dictionary and _dlg_name() == "Выкуп"
	_close()
	var nl := JS.n(C.get("nextL"))
	P.rans.day = G.day
	G.realms[int(f1.realm)].gold = maxf(JS.n(G.realms[int(f1.realm)].gold), 1000.0)
	SimExt.ransomDaily()
	# письмо — в начало списка (addLetter: unshift)
	var letter: bool = JS.n(C.get("nextL")) == nl + 1 and String(C.letters[0].subj) == "Выкуп: " + String(f1.name)
	var paid: bool = float(f1.prison) == -1.0
	# допрос: удача — не из зерна; спрашиваем, пока не скажет (молчит — через три дня снова)
	var tries := 0
	var P2 := pris_st(f2)
	while not JS.t(P2.get("told")) and tries < 60:
		P2.erase("ask")
		_close()
		pris_ask(c.npc_by("pris" + JS.s(f2.id)), f2)
		tries += 1
	var intel: bool = JS.t(P2.get("told")) and c.hud.dlg != null and String((c.hud.dlg.pages[0] as Array)[0]).begins_with("Под нажимом")
	_close()
	# свой рыцарь: заговор его дома — открывается на допросе
	var s0: Variant = SimCourt.addSecret("plot", [m1.id], {"house": float(m1.get("house", 0)), "realm": float(f1.realm)})
	var P3 := pris_st(m1)
	tries = 0
	while not JS.t(P3.get("told")) and tries < 60:
		P3.erase("ask")
		_close()
		pris_ask(c.npc_by("pris" + JS.s(m1.id)), m1)
		tries += 1
	var sec: bool = s0 != null and JS.t(s0.get("known")) and _dlg_name() == "Тайна раскрыта"
	_close()
	# казнь чужого: мнение его державы −25, страх +4; человек — из темницы
	var opn0 := JS.n(G.rel[int(f2.realm)][0].opn)
	var fear0 := JS.n(G.realms[0].get("fear"))
	pris_exec_ask(c.npc_by("pris" + JS.s(f2.id)), f2)
	c.hud.choose(0)
	_ticks(12)
	var dead: bool = not JS.t(f2.alive) and c.npc_by("pris" + JS.s(f2.id)).is_empty() and _dlg_name() == "Казнь" and JS.n(G.realms[0].fear) == fear0 + 4 and JS.n(G.rel[int(f2.realm)][0].opn) < opn0
	_close()
	# помилование своего: из камеры — к воротам
	var mn: Dictionary = c.npc_by("pris" + JS.s(m1.id))
	pris_pardon(mn, m1)
	var freed: bool = float(m1.prison) == -1.0 and not mn.has("pris") and mn.has("talk_line") and JS.t(mn.get("visitor"))
	_close()
	print("selftest: узники — в камере ", in_cell, ", у тюремщика выборов ", nj, ", выкуп ", rans, ", письмо ", letter, " (заплатили ", paid, "), допрос ", intel, ", тайна ", sec, ", казнь ", dead, ", помилован ", freed)
	res = res and in_cell and nj >= 3 and fi >= 0 and ri >= 0 and rans and letter and intel and sec and dead and freed
	return res
