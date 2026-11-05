extends RefCounted
## Больные при дворе (sick2.js): лекарь двора — из королевства (G.court.doc: вид, имя, искусство); днём он в библиотеке и у грядок
## с травами (DOC_SCHED), утром (8–11) и вечером (17–19:30) обходит лежачих у их постелей. Лежачие — в своих постелях (sched),
## хворые охают на ходу. У постели — завеса у заразного, «Пожелать скорейшего выздоровления», «Прислать лекаря», «Поговорить»;
## навещать заразных — король может заразиться. Разговор с лекарем: доклад о больных, лечение (кровь, травы, покой), терияк,
## отделить заразного, осмотр короля и укрепляющий отвар, лекари и жалованье, поход с королём, ворота замка от мора.
## Король занемог постельной болезнью — лекарь велит лечь (сцена лечения court_hurt.gd с from = ill) или «Перемогусь на ногах»;
## значок болезни в верхней строке. Дни — по часам двора (Game.day); случайности — не из зерна королевства (кроме слов
## выздоровевшего — они в дне королевства, как в HTML).
const Aud = preload("res://scripts/court_audience.gd")
const People = preload("res://scripts/people.gd")
const DOC_SCHED := [[5.0, "stairs"], [6.5, "lib_shelf"], [9.0, "herbs"], [11.0, "lib_shelf"], [14.0, "herbs"], [16.0, "lib_shelf"], [20.5, "stairs"]]
const VISIT_SP := {"bed_queen": "q_rug", "bed_guest": "guest_mid", "bed_maid": "cor_e", "bed_page": "cor_e"}
const ADV_ROOMS := ["chancellor", "treasurer", "eye", "seneschal", "magister", "justice", "marshal"]
const DOC_LINES := ["Покажите язык… Так.", "Пульс частый. Пейте отвар — по чаше.", "Жар держится. Ещё компресс на лоб.", "Дышите… глубже… ещё.", "Окна закрыть, огонь не гасить.", "Бульону — и спать."]

var c: Node2D   # court.gd
var bt := 3.0                # SICK.bt: через сколько секунд охнет кто-то из хворых
var rd: Variant = null       # SICK.rd: обход лекаря {tag: день·3 + утро/вечер, done: [ключи]}
var rep: Variant = null      # SICK.rep: больной ответит лекарю {key, t}
var sub_t := 0.0             # подписи «болен: …» — дважды в секунду

func _init(court: Node2D) -> void:
	c = court
	SimSick.recover_hook = _recovered
	SimSick.start_hook = _fell_ill
	SimSick.cap_hook = _cap
	SimSick.die_hook = _king_died

static func ok() -> bool:
	return not Sim.G.is_empty() and Sim.G.has("court")

static func _pick(L: Array) -> String:
	return String(L[randi() % L.size()])

## хворый человек королевства за записью двора — или null
static func _ill(n: Dictionary) -> Variant:
	var ch: Variant = People.real(n)
	return ch if ch != null and ch.get("ill") is Dictionary else null

## запись двора человека королевства (sickNpc): не гость
func _npc_of(ch: Dictionary) -> Dictionary:
	for n in c.npcs:
		if not n.get("visitor", false) and not n.has("pseudo") and n.has("cid") and n.cid == ch.id:
			return n
	return {}

# ---------- лекарь среди людей двора ----------
## лекарь как человек (docChar): pseudoChar по номеру лекаря; облик — по виду (doc_monk…) и полу
static func doc_char() -> Variant:
	var d: Variant = Sim.G.court.get("doc")
	if not JS.t(d):
		return null
	var ch := Aud.pseudo(int(d.i), "doc_" + String(d.kind), int(JS.n(d.get("fem"))), int(JS.n(d.age)), String(d.name))
	var K: Dictionary = SimSick.DOCK[d.kind]
	if K.has("cul"):
		ch.cul = K.cul
	return ch

## лекарь двора среди людей (POP_EXT): есть лекарь — есть и человек в замке; ушёл, а нового ещё нет — никого
func pop(out: Array, old: Dictionary) -> void:
	SimSick.docEnsure()
	var d: Variant = Sim.G.court.get("doc")
	if not JS.t(d):
		return
	c.people.mk(out, old, "srv_doc", doc_char(), {"sched": DOC_SCHED, "home": "stairs", "staff": "doc", "sub0": "Лекарь двора · искусство " + JS.s(d.med)})

## к какому месту у постели идёт лекарь (visitSpot): у королевы — ковёр, у детей — ковёр детской, у советника — его покой
static func visit_spot(n: Dictionary) -> String:
	var b := String(n.get("bed", ""))
	if b == "":
		return ""
	if VISIT_SP.has(b):
		return VISIT_SP[b]
	if b.begins_with("bed_kid"):
		return "nur_rug"
	var k := b.substr(4)
	return "room_" + k if ADV_ROOMS.has(k) else ""

## обход (docRounds): утром и вечером — к каждому лежачему, «Покажите язык…», больной отвечает
func _rounds(dn: Dictionary) -> void:
	var h := Game.hour_abs()
	var win := 1 if h >= 8.0 and h < 11.0 else (2 if h >= 17.0 and h < 19.5 else 0)
	var ov: Variant = dn.get("override")
	if ov is Dictionary and JS.t(ov.get("doc")) and int(ov.day) == Game.day and float(ov.until) > h:
		if dn.has("visitPt") and dn.path == null and dn.goal == null and String(dn.cur) == String(ov.spot) and not dn.away:
			var pt: Dictionary = c.npc_by(String(dn.visitPt))
			dn.erase("visitPt")
			var pc: Variant = _ill(pt) if not pt.is_empty() else null
			if pc != null:
				if dn.loc == c.loc_id:
					c.people.say(dn, _pick(DOC_LINES), 3.0)
				rep = {"key": String(pt.key), "t": c.t + 1.6}
				pc.ill.seen = float(Game.day)
				print("DOC VISIT ", pt.key)
		return
	if win == 0 or JS.t(dn.get("hidH")) or JS.t(dn.get("follow")):
		return
	var tag := Game.day * 3 + win
	if rd == null or int(rd.tag) != tag:
		rd = {"tag": tag, "done": []}
	var pt: Dictionary = {}
	for m in c.npcs:
		var mc: Variant = _ill(m)
		if mc != null and JS.t(mc.ill.get("bed")) and not (rd.done as Array).has(m.key) and visit_spot(m) != "":
			pt = m
			break
	if pt.is_empty():
		return
	rd.done.append(pt.key)
	dn.override = {"spot": visit_spot(pt), "until": minf(h + 0.9, 11.0 if win == 1 else 19.5), "day": Game.day, "doc": 1}
	dn.cur = ""
	dn.erase("hold")
	dn.wander = null
	dn.visitPt = String(pt.key)

## каждый кадр двора (UPD_EXT): лекарь с глаз, пока король в постели; обход; ответ больного; «Кхе-кхе» хворых; дни в постели —
## по болезни; король занемог постельной болезнью — лекарь велит лечь; подписи «болен: …»
func update(dt: float) -> void:
	if not ok():
		return
	var k: Dictionary = SimPlayer.kingC()
	var I: Variant = k.get("ill")
	var dn: Dictionary = c.npc_by("srv_doc")
	if not dn.is_empty():
		var hide: bool = c.heal.on and (c.heal.sh == "bed" or c.heal.sh == "days")
		if hide and not JS.t(dn.get("hidH")):
			dn.hidH = 1
			dn.hold = 1
			dn.away = true
			dn.path = null
			dn.goal = null
		elif not hide and JS.t(dn.get("hidH")):
			dn.hidH = 0
			dn.erase("hold")
			dn.cur = ""
		if not c.heal.on:
			_rounds(dn)
	if rep != null and c.t >= float(rep.t):
		var pt: Dictionary = c.npc_by(String(rep.key))
		rep = null
		var pc: Variant = _ill(pt) if not pt.is_empty() else null
		if pc != null and pt.loc == c.loc_id and not pt.away:
			c.people.say(pt, _pick(SimSick.DIS[pc.ill.k].sym), 2.5)
	bt -= dt
	if bt <= 0.0:
		bt = randf_range(4.0, 8.0)
		var L: Array = c.npcs.filter(func(n): return n.loc == c.loc_id and not n.away and String(n.bub) == "" and _ill(n) != null)
		if not L.is_empty():
			var n: Dictionary = L[randi() % L.size()]
			c.people.say(n, _pick(SimSick.DIS[_ill(n).ill.k].sym), 2.2)
	if c.heal.on and c.heal.o.get("from") == "ill" and c.heal.sh == "days" and JS.t(I):
		c.heal.end_t = JS.n(I.end) + 3.0 / 24.0
		c.heal.bed = maxi(1, int(JS.n(I.end)) - c.heal.d0)
	if JS.t(I) and JS.t(I.get("bed")) and not JS.t(I.get("up")) and not JS.t(I.get("asked")) and SimSick.whereOf(k) == "court" and ill_free():
		I.asked = 1.0
		ill_prompt()
	if c.t >= sub_t:
		sub_t = c.t + 0.5
		_subs()

## подписи под именем (npcSub): у хворого — «болен: …», у лекаря — его искусство
func _subs() -> void:
	var d: Variant = Sim.G.court.get("doc")
	for n in c.npcs:
		if n.key == "srv_doc":
			if JS.t(d):
				n.sub0 = "Лекарь двора · искусство " + JS.s(d.med)
				n.sub = n.sub0
			continue
		var ch: Variant = _ill(n)
		var want := SimSick.sickWord(ch) if ch != null else ""
		var suf := String(n.get("sick_suf", ""))
		var s := String(n.get("sub", ""))
		if suf == want and (want == "" or s.ends_with(want)):
			continue
		if suf != "" and s.ends_with(suf):
			s = s.substr(0, s.length() - suf.length()).trim_suffix(" · ")
		if want == "":
			n.erase("sick_suf")
			n.sub = s
		else:
			n.sick_suf = want
			n.sub = (s + " · " if s != "" else "") + want

# ---------- вести королевства ----------
## придворный занемог при виде двора (sickStart) — к постели заново
func _fell_ill(ch: Dictionary) -> void:
	var n := _npc_of(ch)
	if n.is_empty():
		return
	n.cur = ""
	n.erase("hold")
	n.wander = null

## придворный поправился при виде двора (sickRecover) — встаёт; если он здесь — радуется (слово — из зерна королевства, как в HTML)
func _recovered(ch: Dictionary) -> void:
	var n := _npc_of(ch)
	if n.is_empty():
		return
	n.cur = ""
	if not n.away and n.loc == c.loc_id:
		c.people.say(n, String(Sim.R.pick(["Хвала небу, мне лучше!", "Наконец-то на ногах.", "Будто заново родил" + ("ась" if JS.t(ch.get("fem")) else "ся") + "."])), 3.0)

## подпись у постели короля (sickCap) — и на этот день сцены
func _cap(t: String) -> void:
	c.heal.cap = t
	if c.heal.sh == "days":
		c.heal.lines[int(Sim.G.day) - c.heal.d0] = t

## король умер от болезни в постели (sickDie): сцены лечения больше нет
func _king_died() -> void:
	c.heal.cap = ""
	c.heal.end_(true)

# ---------- король занемог ----------
## король свободен, чтобы лекарь заговорил о болезни (kingIllFree): не в постели, без разговоров и окон, не спит, при дворе,
## не у барьера ристалища, игра не кончена
func ill_free() -> bool:
	var G := Sim.G
	var ov: Variant = G.get("over")
	return not c.heal.on and not c.hud.is_open() and c.fade == 0.0 and c.acts.sleep_t <= 0.0 and JS.t(G.get("atCourt")) \
		and not (ov is Dictionary and not JS.t(ov.get("ack"))) and c.trn.kj == null and c.hnt.HU == null

## лекарь велит лечь (kingIllPrompt): тяжёлая болезнь — только в постель; лёгкая — можно перемогаться на ногах (дольше и опаснее)
func ill_prompt() -> void:
	var k: Dictionary = SimPlayer.kingC()
	var I: Variant = k.get("ill")
	if not JS.t(I):
		return
	var D: Dictionary = SimSick.DIS[I.k]
	var dn: Dictionary = c.npc_by("srv_doc")
	var grave: bool = SimSick.GRAVE.has(I.k) or SimSick.sickRisk(k) >= 0.06
	var t := ("" if not dn.is_empty() else "Паж бегом приводит городского лекаря. ") + "«Государь, это " + String(D.n) + ". " \
		+ ("Болезнь тяжёлая — в постель, немедля." if grave else "Лягте в постель: так болезнь пройдёт легче и скорее.") + "»"
	var ch: Array = [{"t": "Лечь в постель", "tip": ["Дни болезни пройдут в покоях; совет справится сам.", "В постели болезнь легче, чем на ногах."], "fx": func(): c.heal.start_ill()}]
	if not grave:
		ch.append({"t": "Перемогусь на ногах", "tip": ["Болезнь продлится на 2 дня дольше, и она опаснее (×1,4).", "Ни охоты, ни меча, ни турнира."], "fx": func():
			I.up = 1.0
			I.end = JS.n(I.end) + 2.0
			c.hud.toast("Король остаётся на ногах. Лекарь качает головой.")})
	c.hud.say(dn if not dn.is_empty() else null, t, {"name": "" if not dn.is_empty() else "Король занемог", "choices": ch, "esc": ch.size() - 1})
	print("ILL PROMPT ", I.k, " ", ch.size())

## строка значка болезни: болезнь (или слабость) и сколько дней
func _badge_s() -> String:
	if not ok():
		return ""
	var k: Dictionary = SimPlayer.kingC()
	var I: Variant = k.get("ill")
	if JS.t(I):
		return SimSick.sCap(String(SimSick.DIS[I.k].n)) + " · " + str(maxi(1, int(JS.n(I.end)) - Game.day)) + " дн."
	if JS.n(k.get("sickConv")) > Game.day:
		return "Слабость · " + str(int(JS.n(k.sickConv)) - Game.day) + " дн."
	return ""

## значок болезни (sickBadge): справа под верхней строкой (под значком раны), с подсказкой; король на ногах с постельной
## хворью — нажать, чтобы лечь
func badge(u: Variant) -> void:
	if c.heal.on or c.hnt.HU != null:
		return
	var s := _badge_s()
	if s == "":
		return
	var k: Dictionary = SimPlayer.kingC()
	var I: Variant = k.get("ill")
	var W := 640.0
	var y := 36.0 if JS.n(k.get("wound")) > Game.day else 22.0
	var w: float = u.tw(s, "s") + 16.0
	u.rect(W - w - 6, y, w, 12, Color8(20, 14, 12, 204))
	u.spr_k("i_sick", W - w - 3, y + 3)
	u.txt(s, W - w + 5, y + 3, u.cc(String(Art.D.uic.bad if JS.t(I) and (JS.t(I.get("bed")) or JS.t(I.get("cr"))) else Art.D.uic.warn)), "s")
	var tip: Array
	if JS.t(I):
		var nd := maxi(1, int(JS.n(I.end)) - Game.day)
		var dn := SimSick.sCap(String(SimSick.DIS[I.k].n))
		tip = [dn + (" — постельная болезнь" if JS.t(I.get("bed")) else ""),
			"Пройдёт примерно через " + SimExt.dn(nd) + ("; кризис " + SimText.inDays(int(JS.n(I.cr)) - Game.day) + " (" + SimSick.riskWord(SimSick.sickRisk(k)) + ")" if JS.t(I.get("cr")) else "") + ".",
			"Ни охоты, ни меча, ни турнира; ходить медленнее.",
			{"t": "Король на ногах: болезнь тяжелее. Нажмите, чтобы лечь.", "c": Art.D.uic.warn} if JS.t(I.get("up")) else {"t": "Лекарь — в библиотеке или у грядок с травами.", "c": Art.D.uic.dim}]
	else:
		tip = ["Слабость после болезни", "Ещё " + SimExt.dn(JS.n(k.sickConv) - Game.day) + " без охоты и меча."]
	var o := {"id": "ksick", "tip": tip}
	if JS.t(I) and JS.t(I.get("bed")) and JS.t(I.get("up")) and ill_free():
		o.on = func(_c): c.heal.start_ill()
	u.hit(W - w - 6, y, w, 12, o)

# ---------- больные как люди: разговор, у постели ----------
## навещать хворого — король может заразиться (catchFrom): прилипчивая хворь, у отделённого — реже
static func catch_from(ch: Dictionary) -> void:
	var I: Dictionary = ch.ill
	var D: Dictionary = SimSick.DIS[I.k]
	var k: Dictionary = SimPlayer.kingC()
	if not D.has("ct") or JS.t(k.get("ill")) or JS.t(k.get("illQ")) or (D.has("imm") and JS.t(k.get("imm")) and JS.t(k.imm.get(I.k))) or (D.has("kid") and JS.n(k.age) >= 14):
		return
	if randf() < float(D.ct) * (0.5 if JS.t(I.get("iso")) else 2.5):
		k.illQ = {"k": I.k, "day": float(Game.day + randi_range(1, 2)), "why": "заразил" + ("ась" if JS.t(k.get("fem")) else "ся") + " от: " + SimSick.whoName(ch)}
		print("CAUGHT ", I.k)

## разговор с хворым (talkTo, sick2.js): лежачий в постели — навестить; на ногах — охает (король может заразиться), дальше —
## обычный разговор. true — разговор взят
func talk(n: Dictionary, t0: Callable) -> bool:
	if not ok() or n.has("petition") or n.get("visitor", false):
		return false
	var ch: Variant = _ill(n)
	if ch == null:
		return false
	if JS.t(ch.ill.get("bed")) and JS.t(n.get("lie")):
		visit(n, t0)
		return true
	catch_from(ch)
	if randf() < 0.6:
		c.people.say(n, _pick(SimSick.DIS[ch.ill.k].sym), 2.5)
	return false

## у постели больного (sickVisit): заразного отделили — завеса (можно всё равно подойти); пожелать выздоровления (близким —
## расположение +3, прочим — верность +2; риск чуть ниже), прислать лекаря, поговорить
func visit(n: Dictionary, t0: Callable) -> void:
	var ch: Variant = _ill(n)
	if ch == null:
		return
	var I: Dictionary = ch.ill
	var D: Dictionary = SimSick.DIS[I.k]
	var f := JS.t(ch.get("fem"))
	if JS.t(I.get("iso")) and not JS.t(I.get("isoOk")):
		c.hud.say(null, "У постели — завеса из полотна. «" + SimSick.sCap(String(D.n)) + " прилипчива, — велел лекарь. — Никого не пускать».",
			{"name": SimSick.sCap(SimSick.whoName(ch)), "choices": [{"t": "Всё равно подойти", "tip": "Король может заразиться.", "fx": func():
				I.isoOk = 1.0
				visit(n, t0)}, {"t": "Уйти"}], "esc": 1})
		print("SICKVISIT iso ", n.key)
		return
	catch_from(ch)
	var line := _pick(D.sym)
	c.people.say(n, line, 3.0)
	var st := (("Жар не спадает; лекарь хмурится." if SimSick.sickRisk(ch) >= 0.06 else "Лекарь говорит: кризис " + SimText.inDays(int(JS.n(I.cr)) - Game.day) + ".")
		if JS.t(I.get("cr")) else "Худшее позади: идёт на поправку.")
	var chs: Array = [
		{"t": "Пожелать скорейшего выздоровления", "ok": func(): return not JS.t(I.get("wish")), "why": "Вы уже навещали " + ("её" if f else "его"), "fx": func():
			I.wish = 1.0
			if SimSick.isFam(ch):
				ch.aff = JS.clp(float(JS.o(ch.get("aff"), 50.0)) + 3.0, 0, 100)
			else:
				ch.loy = JS.clp(float(JS.o(ch.get("loy"), 50.0)) + 2.0, 0, 100)
			c.people.say(n, _pick(["Спасибо, государь…", "Мне уже легче…", "Храни вас Бог, государь."]), 3.0)},
		{"t": "Прислать лекаря", "ok": func(): return not c.npc_by("srv_doc").is_empty(), "why": "Лекаря сейчас нет при дворе", "fx": func(): doc_call(n)},
		{"t": "Поговорить", "fx": func(): t0.call(n)},
		{"t": "Уйти"}]
	c.hud.say(n, String(ch.name) + " в постели (" + String(D.n) + "). «" + line + "» " + st, {"choices": chs, "esc": 3})
	print("SICKVISIT ", n.key)

## прислать лекаря к постели (docCall): идёт к больному (на час) — и разговор о его лечении
func doc_call(n: Dictionary) -> void:
	var dn: Dictionary = c.npc_by("srv_doc")
	var sp := visit_spot(n)
	if dn.is_empty():
		return
	if sp != "" and not JS.t(dn.get("hidH")):
		dn.override = {"spot": sp, "until": Game.hour_abs() + 1.0, "day": Game.day, "doc": 1}
		dn.cur = ""
		dn.erase("hold")
		dn.wander = null
		dn.visitPt = String(n.key)
		if dn.loc == c.loc_id and not dn.away:
			c.people.say(dn, "Иду, государь!", 2.5)
	doc_patient(dn, People.real(n))

# ---------- разговор с лекарем ----------
static func season_advice() -> String:
	return ["Весной у детей бывает корь: заболеет один — отделите его, пока не перекинулось.", "Летом берегитесь дурной воды и пиров в жару: от них кровавый понос и лихорадка.",
		"Осень сырая: лихорадка и простуда. Огонь в покоях не гасить.", "Зима: простуда и грудная горячка ходят по замку. Держите детей в тепле."][Sim.seasonOf(Game.day)]

## доклад лекаря (docReport): мор, кто болен и насколько опасно — или совет по сезону
static func doc_report() -> String:
	var L: Array = SimSick.courtSick()
	var k: Dictionary = SimPlayer.kingC()
	var pl: Variant = Sim.G.court.get("plague")
	var pls := ("В королевстве моровое поветрие! " + ("Ворота замка затворены. " if JS.t(pl.get("shut")) else "Затворите ворота, государь. ")) if JS.t(pl) else ""
	if L.is_empty():
		return pls + _pick(["Слава Богу, при дворе все здоровы, государь.", "Больных нет, государь. Сушу травы и жду."]) + " " + season_advice()
	var parts := PackedStringArray()
	for ch in L.slice(0, 4):
		var I: Dictionary = ch.ill
		parts.append(("вы, государь" if ch.id == k.id else SimSick.whoName(ch)) + " — " + String(SimSick.DIS[I.k].n) + (", в постели" if JS.t(I.get("bed")) else "")
			+ (" (" + SimSick.riskWord(SimSick.sickRisk(ch)) + ")" if JS.t(I.get("cr")) else ""))
	return pls + "Больны: " + "; ".join(parts) + ("; и ещё " + str(L.size() - 4) if L.size() > 4 else "") + "."

## разговор с лекарем (docTalk): доклад — и что можно приказать
func doc_talk(n: Dictionary) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var d: Variant = C.get("doc")
	var k: Dictionary = SimPlayer.kingC()
	if not JS.t(d):
		c.hud.say(n, "Лекаря при дворе нет.")
		return
	var ch: Array = []
	if not SimSick.courtSick().is_empty():
		ch.append({"t": "Как лечишь больных?", "fx": func(): doc_patients(n)})
	ch.append({"t": "Что со мной?" if JS.t(k.get("ill")) else "Осмотри меня", "fx": func(): doc_exam(n)})
	ch.append({"t": "Лекари и жалованье", "fx": func(): doc_hire(n)})
	var camp := JS.t(d.get("camp"))
	ch.append({"t": "В походах оставайся при дворе" if camp else "Езжай со мной в походы",
		"tip": ["Сейчас лекарь едет с королём в поход.", "Двор тогда без лекаря: больные там рискуют больше (×1,3)."] if camp
			else ["Лекарь будет при короле в лагере: раны и хвори лечатся лучше, войско выздоравливает быстрее.", "Зато двор останется без лекаря."],
		"fx": func():
			d.camp = 0.0 if JS.t(d.get("camp")) else 1.0
			c.hud.say(n, "«Соберу сумку с травами и ланцетами, государь.»" if JS.t(d.camp) else "«Буду при дворе, государь. Здесь тоже есть кого лечить.»")})
	var pl: Variant = C.get("plague")
	if JS.t(pl):
		ch.append({"t": "Открыть ворота замка" if JS.t(pl.get("shut")) else "Затворить ворота замка",
			"tip": "Знать и купцы снова смогут приезжать." if JS.t(pl.get("shut")) else ["Мор реже проникнет в замок (втрое).", "Знать обидится на закрытые ворота (верность −2)."],
			"fx": func():
				pl.shut = 0.0 if JS.t(pl.get("shut")) else 1.0
				if JS.t(pl.shut):
					for H0 in G.houses:
						if JS.t(H0.alive):
							SimPlayer.houseLoy(H0, -2)
					Sim.glog("Ворота замка затворены от мора.", "info")
				else:
					Sim.glog("Ворота замка снова открыты.", "info")})
	ch.append({"t": "Ступай"})
	c.hud.say(n, doc_report(), {"choices": ch, "esc": ch.size() - 1})
	print("DOCTALK ", ch.size())

## больные при дворе (docPatients): о ком спросить
func doc_patients(n: Dictionary) -> void:
	var L: Array = SimSick.courtSick().slice(0, 5)
	if L.is_empty():
		c.hud.say(n, "«Больных больше нет, государь.»")
		return
	var k: Dictionary = SimPlayer.kingC()
	var ch: Array = []
	for p in L:
		ch.append({"t": SimSick.sCap("вы, государь" if p.id == k.id else SimSick.whoName(p)) + " — " + String(SimSick.DIS[p.ill.k].n), "fx": func(): doc_patient(n, p)})
	ch.append({"t": "Назад", "fx": func(): doc_talk(n)})
	c.hud.say(n, "«О ком хотите знать, государь?»", {"choices": ch, "esc": ch.size() - 1})

## о больном (docPatient): как он, чем лечат; другое лечение, терияк при тяжёлой хвори, отделить заразного
func doc_patient(n: Dictionary, p: Variant) -> void:
	if p == null:
		return
	var I: Variant = p.get("ill")
	var me: bool = p.id == SimPlayer.kingC().id
	if not JS.t(I):
		c.hud.say(n, "«" + SimSick.sCap(SimSick.whoName(p)) + " уже на ногах, государь.»")
		return
	var D: Dictionary = SimSick.DIS[I.k]
	var cls := SimSick.ageCls(p)
	var st := ("Кризис " + SimText.inDays(int(JS.n(I.cr)) - Game.day) + ", " + SimSick.riskWord(SimSick.sickRisk(p)) + ".") if JS.t(I.get("cr")) \
		else ("Кризис миновал — идёт на поправку." if float(D.m[cls]) != 0.0 else "Не опасно, пройдёт само.")
	var t := ("У вас " if me else SimSick.sCap(SimSick.whoName(p)) + ": ") + String(D.n) + (", в постели. " if JS.t(I.get("bed")) else ", на ногах. ") + st + " Лечу: " \
		+ String(SimSick.TRT[I.tr].n).to_lower() + (" и терияк" if JS.t(I.get("th")) else "") + ("; больной отделён" if JS.t(I.get("iso")) else "") + "."
	var ch: Array = []
	for t2 in ["bleed", "herbs", "rest"]:
		ch.append({"t": String(SimSick.TRT[t2].n) + (" ✓" if I.tr == t2 else ""), "tip": [String(SimSick.TRT[t2].d), "Опасность при этом: " + SimSick.riskWord(SimSick.sickRisk(p, t2)) + "." if JS.t(I.get("cr")) else ""],
			"fx": func():
				SimSick.setTrt(p, t2)
				doc_patient(n, p)})
	if JS.t(I.get("cr")) and not JS.t(I.get("th")):
		ch.append({"t": "Дать терияк (12 зол.)", "tip": ["Венецианское снадобье из полусотни трав, мёда и змеиного мяса.", "При тяжёлой болезни риск ниже на пятую часть."],
			"ok": func(): return JS.n(Sim.G.realms[0].gold) >= 12.0, "why": "Не хватает золота.", "fx": func():
				if not SimCourt.spend(12):
					return
				I.th = 1.0
				Snd.sfx("chime")
				doc_patient(n, p)})
	if D.has("ct") and not me:
		ch.append({"t": "Вернуть к людям" if JS.t(I.get("iso")) else "Отделить от других",
			"tip": "Болезнь снова сможет перекинуться на других." if JS.t(I.get("iso")) else "Болезнь прилипчива: отделённый больной заражает других в 6 раз реже.", "fx": func():
				I.iso = 0.0 if JS.t(I.get("iso")) else 1.0
				I.isoOk = 0.0
				doc_patient(n, p)})
	ch.append({"t": "Назад", "fx": func(): doc_talk(n)})
	c.hud.say(n, t, {"choices": ch, "esc": ch.size() - 1})
	print("DOCPATIENT ", I.k, " ", I.tr)

## осмотр короля (docExam): болен — что с ним и лечь ли; здоров — совет и укрепляющий отвар
func doc_exam(n: Dictionary) -> void:
	var k: Dictionary = SimPlayer.kingC()
	var I: Variant = k.get("ill")
	var ch: Array = []
	var t := ""
	if JS.t(I):
		var D: Dictionary = SimSick.DIS[I.k]
		t = "У вас " + String(D.n) + ", государь. " + ("Кризис " + SimText.inDays(int(JS.n(I.cr)) - Game.day) + ": " + SimSick.riskWord(SimSick.sickRisk(k)) + "." if JS.t(I.get("cr"))
			else "Опасности нет — дело нескольких дней.") + (" Вам бы лечь: на ногах болезнь тяжелее." if JS.t(I.get("up")) else "")
		if JS.t(I.get("bed")) and not c.heal.on:
			ch.append({"t": "Лечь в постель", "fx": func(): c.heal.start_ill()})
		ch.append({"t": "Как лечить меня?", "fx": func(): doc_patient(n, k)})
	else:
		t = _pick(["Пульс ровный, язык чистый.", "Сердце бьётся ровно, глаза ясные."]) + " Вы здоровы, государь." + (" Рана заживает как должно." if JS.n(k.get("wound")) > Game.day else "") \
			+ (" Но годы: поменьше вина и жирной дичи — подагра и удар любят пирующих." if JS.n(k.age) >= 50 else (" Берегите ногу от пиров." if JS.t(k.get("goutN")) else ""))
		var drinks := JS.n(k.get("tonic")) > Game.day
		ch.append({"t": "Укрепляющий отвар (3 зол.)", "tip": "Три недели хвори пристают к королю на четверть реже.",
			"ok": func(): return not (JS.n(k.get("tonic")) > Game.day) and JS.n(Sim.G.realms[0].gold) >= 3.0, "why": "Вы уже пьёте отвар" if drinks else "Не хватает золота.", "fx": func():
				if not SimCourt.spend(3):
					return
				k.tonic = float(Game.day + Sim.DAYS_SEASON)
				Snd.sfx("chime")
				c.hud.say(n, "«Горький, государь, но верный. По чаше утром и вечером.»")})
	ch.append({"t": "Назад", "fx": func(): doc_talk(n)})
	c.hud.say(n, t, {"choices": ch, "esc": ch.size() - 1})

## лекари и жалованье (docHire): кто лечит, за кем послано; послать за другим (прежний уйдёт, когда прибудет новый)
func doc_hire(n: Dictionary) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var d: Variant = C.get("doc")
	var Q: Variant = C.get("docQ")
	var t := ("Ныне лечит " + String(d.name) + ", " + String(SimSick.DOCK[d.kind].sub) + ": искусство " + JS.s(d.med) + " из 20, жалованье " + JS.s(SimSick.DOCK[d.kind].wage) + " зол. в неделю."
		if JS.t(d) else "Лекаря при дворе нет.") \
		+ (" Послано за новым: " + String(SimSick.DOCK[Q.kind].sub) + ", будет " + SimText.inDays(int(JS.n(Q.day)) - Game.day) + "." if JS.t(Q) else " Можно послать за другим — прежний уйдёт.")
	var ch: Array = []
	for kd in SimSick.DOCK:
		var K: Dictionary = SimSick.DOCK[kd]
		ch.append({"t": String(K.n) + " — " + JS.s(K.cost) + " зол.", "tip": [String(K.d), "Искусство " + JS.s(K.med[0]) + "–" + JS.s(K.med[1]) + ", жалованье " + JS.s(K.wage) + " зол. в неделю; в пути "
			+ JS.s(K.days[0]) + "–" + JS.s(K.days[1]) + " дн."],
			"ok": func(): return not JS.t(C.get("docQ")) and JS.n(G.realms[0].gold) >= float(K.cost), "why": "За лекарем уже послали" if JS.t(Q) else "Не хватает золота.", "fx": func():
				if not SimCourt.spend(float(K.cost)):
					return
				C.docQ = {"kind": kd, "day": float(Game.day + randi_range(int(K.days[0]), int(K.days[1])))}
				Sim.glog("За новым лекарем послано: " + String(K.sub) + " (" + SimText.inDays(int(C.docQ.day) - Game.day) + ").", "info")
				Snd.sfx("coin")
				c.hud.say(n, "«Воля ваша, государь. Дождусь преемника и передам ему больных.»" if JS.t(d) else "«Гонец уже в пути, государь.»")})
	ch.append({"t": "Назад", "fx": func(): doc_talk(n)})
	c.hud.say(n, t, {"choices": ch, "esc": ch.size() - 1})

func state() -> Dictionary:
	if not ok():
		return {}
	var k: Dictionary = SimPlayer.kingC()
	var I: Variant = k.get("ill")
	var dn: Dictionary = c.npc_by("srv_doc")
	var d: Variant = Sim.G.court.get("doc")
	var ov: Variant = dn.get("override") if not dn.is_empty() else null
	return {"ill": String(I.k) if JS.t(I) else "", "bed": JS.t(I.get("bed")) if JS.t(I) else false, "up": JS.t(I.get("up")) if JS.t(I) else false,
		"asked": JS.t(I.get("asked")) if JS.t(I) else false, "q": JS.t(k.get("illQ")), "badge": _badge_s(), "doc": String(d.name) if JS.t(d) else "",
		"dn": not dn.is_empty(), "dloc": String(dn.get("loc", "")), "dspot": String(ov.spot) if ov is Dictionary and JS.t(ov.get("doc")) else "",
		"dhid": JS.t(dn.get("hidH")), "sick": SimSick.courtSick().size(),
		"lie": c.npcs.filter(func(n): return JS.t(n.get("lie")) and _ill(n) != null).map(func(n): return String(n.key))}

# ---------- самопроверка без экрана (main.gd -- --sick) ----------
func _close() -> void:
	while c.hud.dlg != null:
		c.hud.close_dlg()

## кадры двора, пока cond не станет true (не больше n)
func _until(cond: Callable, n := 2000) -> int:
	for i in n:
		if cond.call():
			return i
		c._tick(0.05)
	return -1

func _hour(h: float) -> void:
	Game.set_hour(h)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()

func _dlg_text() -> String:
	if c.hud.dlg == null:
		return ""
	var t := ""
	for pg in c.hud.dlg.pages:
		t += " ".join(pg) + " "
	return t

func _chs() -> Array:
	return (c.hud.dlg.choices as Array).map(func(x): return String(x.get("t", ""))) if c.hud.dlg != null else []

## занемочь без зерна королевства: болезнь k на n дней (кризис через cr дней, 0 — без), постельная — по болезни
static func _sick(ch: Dictionary, k: String, n: int, cr: int) -> void:
	var d := float(Sim.G.day)
	ch.ill = {"k": k, "d0": d, "end": d + n, "cr": d + cr if cr > 0 else 0.0, "bed": float(SimSick.DIS[k].bed[1]), "tr": "rest", "trd": 0.0, "iso": 0.0, "why": ""}

## лекарь при дворе; больной советник — в постели, подпись «болен: …»; у постели — четыре дела, пожелание один раз; прислать
## лекаря — лечение, терияк, отделить; лекарь идёт к постели, больной отвечает; утренний обход; завеса у отделённого; разговор
## с лекарем — доклад, жалованье и новый лекарь, осмотр и отвар; король занемог — лекарь велит лечь, «перемогусь» — значок;
## в постели — лекарь с глаз, дни болезни, встаёт; выздоровевший встаёт с постели
func selftest() -> bool:
	if not ok():
		print("selftest: больные — нет королевства")
		return false
	var G := Sim.G
	var C: Dictionary = G.court
	var k: Dictionary = SimPlayer.kingC()
	var r0: Dictionary = G.realms[0]
	var keep := {}
	for f in ["ill", "illQ", "sickConv", "wound", "woundK", "tonic"]:
		keep[f] = k.get(f)
	var sick0: Array = []
	for ch in SimSick.courtSick():
		sick0.append([ch, ch.ill])
		ch.ill = null
	var doc0: Variant = (C.doc as Dictionary).duplicate(true) if C.get("doc") is Dictionary else C.get("doc")
	var docq0: Variant = C.get("docQ")
	var gold0 := JS.n(r0.gold)
	var rst0: int = Sim.R.st
	var nd0 := SimSick.no_death
	var day0 := Game.day
	var frac0 := Game.frac
	var spd0 := Game.speed
	var snd0 := [Snd.screen, Snd.court, Snd.want]
	var res := true
	seed(20240921)
	Game.speed = 1
	Game.day = int(G.day)
	SimSick.no_death = true
	r0.gold = 500.0
	_close()
	_hour(12.0)
	c._tick(0.05)
	# лекарь двора среди людей: имя, искусство, облик по виду; не человек королевства
	c.people.pop_check()
	var dn: Dictionary = c.npc_by("srv_doc")
	var d: Variant = C.get("doc")
	var stock_k := "doc_" + String(d.kind) + ("1" if JS.t(d.get("fem")) else "0") if JS.t(d) else ""
	var ok0: bool = JS.t(d) and not dn.is_empty() and String(dn.name).contains(String(d.name)) and String(dn.sub0) == "Лекарь двора · искусство " + JS.s(d.med) \
		and People.real(dn) == null and (c.D.get("pstock", {}) as Dictionary).has(stock_k) and String(dn.get("staff", "")) == "doc"
	print("selftest: больные — лекарь ", String(d.name) if JS.t(d) else "-", " (", stock_k, "), при дворе ", not dn.is_empty(), " ", ok0)
	res = res and ok0
	if not ok0:
		return false
	# больной советник: в постель, подпись под именем
	var adv: Dictionary = {}
	for n in c.npcs:
		var b := String(n.get("bed", ""))
		if b.begins_with("bed_") and ADV_ROOMS.has(b.substr(4)) and People.real(n) != null:
			adv = n
			break
	if adv.is_empty():
		print("selftest: больные — нет советника с постелью")
		return false
	var ach: Dictionary = People.real(adv)
	var loy0: Variant = ach.get("loy")
	var aff0: Variant = ach.get("aff")
	var fam := SimSick.isFam(ach)
	_sick(ach, "fever", 6, 3)
	_fell_ill(ach)
	c.people.snap(false)
	sub_t = 0.0
	c._tick(0.05)
	var ok1: bool = JS.t(adv.get("lie")) and String(adv.cur) == String(adv.bed) and String(adv.sub).ends_with(SimSick.sickWord(ach)) and visit_spot(adv) == "room_" + String(adv.bed).substr(4)
	print("selftest: больные — ", adv.key, " в постели ", adv.get("lie"), ", подпись «", adv.sub, "» ", ok1)
	res = res and ok1
	# у постели: четыре дела; пожелание — один раз
	c.talk_to(adv)
	var t_v := _dlg_text()
	var ch_v := _chs()
	var v0 := JS.n(JS.o(ach.get("aff" if fam else "loy"), 50.0))
	c.hud.choose(0)
	var dv := JS.n(ach.get("aff" if fam else "loy")) - v0
	c.talk_to(adv)
	c.hud.choose(0)
	var again: bool = c.hud.dlg != null and c.hud.toast_s == "Вы уже навещали " + ("её" if JS.t(ach.get("fem")) else "его")
	var ok2: bool = t_v.begins_with(String(ach.name) + " в постели (лихорадка).") and ch_v == ["Пожелать скорейшего выздоровления", "Прислать лекаря", "Поговорить", "Уйти"] \
		and JS.t(ach.ill.get("wish")) and (dv == (3.0 if fam else 2.0) or v0 >= 98.0) and again
	print("selftest: больные — у постели ", ch_v.size(), " дел, пожелание +", dv, ", второй раз — отказ ", again, " ", ok2)
	res = res and ok2
	# прислать лекаря: лекарь идёт к постели (здесь он — на том же этаже: из библиотеки донжона до покоев советников за час
	# не дойти, как и в HTML); лечение травами, терияк (−12), отделить заразного
	c.people.place(dn, c.spots.q_rug)
	dn.away = false
	c.hud.choose(1)
	var ov: Variant = dn.get("override")
	var t_p := _dlg_text()
	var ch_p := _chs()
	c.hud.choose(1)
	var herbs: bool = String(ach.ill.tr) == "herbs" and String(_chs()[1]).ends_with(" ✓")
	var g1 := JS.n(r0.gold)
	c.hud.choose(3)
	var th: bool = JS.t(ach.ill.get("th")) and JS.n(r0.gold) == g1 - 12.0 and not _chs().has("Дать терияк (12 зол.)")
	c.hud.choose(3)
	var iso: bool = JS.t(ach.ill.get("iso")) and _chs().has("Вернуть к людям")
	_close()
	var ok3: bool = ov is Dictionary and String(ov.spot) == visit_spot(adv) and String(dn.get("visitPt", "")) == String(adv.key) and t_p.contains("Лечу: покой, тепло и бульон") \
		and ch_p.size() == 6 and ch_p[3] == "Дать терияк (12 зол.)" and ch_p[4] == "Отделить от других" and herbs and th and iso
	print("selftest: больные — прислать лекаря: к ", String(ov.spot) if ov is Dictionary else "-", ", ", ch_p.size(), " дел; травы ", herbs, ", терияк ", th, ", отделён ", iso, " ", ok3)
	res = res and ok3
	# лекарь у постели: «Покажите язык…», больной отвечает
	var sp_v: Dictionary = c.spots[visit_spot(adv)]
	c.go_loc(String(sp_v.loc))
	var i4 := _until(func(): return JS.n(ach.ill.get("seen", -1.0)) == float(Game.day), 1500)
	var doc_line := String(dn.bub)
	var i5 := _until(func(): return rep == null, 100)
	var pt_line := String(adv.bub)
	var ok4: bool = i4 >= 0 and DOC_LINES.has(doc_line) and i5 >= 0 and (SimSick.DIS.fever.sym as Array).has(pt_line) and String(dn.loc) == String(sp_v.loc)
	print("selftest: больные — лекарь у постели за ", i4, " кадров: «", doc_line, "» — «", pt_line, "» ", ok4)
	res = res and ok4
	# утренний обход: на другой день в 8:00 лекарь сам идёт к лежачему
	Game.day += 1
	_hour(8.0)
	c._tick(0.05)
	var ov2: Variant = dn.get("override")
	var ok5: bool = ov2 is Dictionary and String(ov2.spot) == visit_spot(adv) and float(ov2.until) <= 8.9 + 0.01 and rd != null and (rd.done as Array).has(adv.key) \
		and String(dn.get("visitPt", "")) == String(adv.key)
	print("selftest: больные — обход в 8:00 к ", String(ov2.spot) if ov2 is Dictionary else "-", " ", ok5)
	res = res and ok5
	# завеса у отделённого: подойти всё равно — и снова у постели
	c.talk_to(adv)
	var t_i := _dlg_text()
	var ch_i := _chs()
	c.hud.choose(0)
	var ok6: bool = t_i.begins_with("У постели — завеса из полотна. «Лихорадка прилипчива") and ch_i == ["Всё равно подойти", "Уйти"] and JS.t(ach.ill.get("isoOk")) and _chs().size() == 4
	_close()
	print("selftest: больные — завеса ", ch_i.size(), " дел, подошёл ", JS.t(ach.ill.get("isoOk")), " ", ok6)
	res = res and ok6
	# разговор с лекарем: доклад и пять дел; послать за монахом (−15); осмотр здорового и отвар (−3)
	c.talk_to(dn)
	var t_d := _dlg_text()
	var ch_d := _chs()
	c.hud.choose(2)
	var ch_h := _chs()
	var g2 := JS.n(r0.gold)
	c.hud.choose(1)
	var q: Variant = C.get("docQ")
	var hire: bool = q is Dictionary and String(q.kind) == "monk" and JS.n(r0.gold) == g2 - 15.0 and int(q.day) - Game.day >= 2 and int(q.day) - Game.day <= 4
	_close()
	c.talk_to(dn)
	c.hud.choose(1)
	var t_e := _dlg_text()
	var g3 := JS.n(r0.gold)
	c.hud.choose(0)
	var tonic: bool = JS.n(k.get("tonic")) == float(Game.day + Sim.DAYS_SEASON) and JS.n(r0.gold) == g3 - 3.0 and _dlg_text().contains("Горький, государь")
	_close()
	var ok7: bool = t_d.begins_with("Больны: " + SimSick.whoName(ach) + " — лихорадка, в постели") and ch_d.size() == 5 and ch_d[0] == "Как лечишь больных?" and ch_d[4] == "Ступай" \
		and ch_h.size() == 5 and hire and t_e.contains("Вы здоровы, государь.") and tonic
	print("selftest: больные — лекарь: ", ch_d.size(), " дел, «", t_d.left(48), "…»; жалованье ", ch_h.size(), " дел, за монахом ", hire, "; отвар ", tonic, " ", ok7)
	res = res and ok7
	C.docQ = docq0
	# король занемог: лекарь велит лечь — «Перемогусь на ногах» (дольше на 2 дня); значок болезни
	k.erase("tonic")
	_sick(k, "fever", 6, 3)
	var end0 := JS.n(k.ill.end)
	var i8 := _until(func(): return c.hud.dlg != null, 20)
	var t_k := _dlg_text()
	var ch_k := _chs()
	c.hud.choose(1)
	var bs := _badge_s()
	var ok8: bool = i8 >= 0 and t_k.begins_with("«Государь, это лихорадка. Лягте в постель") and ch_k == ["Лечь в постель", "Перемогусь на ногах"] and JS.t(k.ill.get("up")) \
		and JS.n(k.ill.end) == end0 + 2.0 and c.hud.toast_s == "Король остаётся на ногах. Лекарь качает головой." and bs == "Лихорадка · " + str(maxi(1, int(JS.n(k.ill.end)) - Game.day)) + " дн." \
		and not c.heal.on
	print("selftest: больные — король занемог: ", ch_k.size(), " дела, на ногах ", JS.t(k.ill.get("up")), ", значок «", bs, "» ", ok8)
	res = res and ok8
	# осмотр: «Лечь в постель» — постель, лекарь щупает пульс и уходит с глаз; дни болезни; встаёт (болезнь ещё не ушла — без дней королевства)
	c.talk_to(dn)
	var ch_d2 := _chs()
	c.hud.choose(1)
	var ch_e := _chs()
	c.hud.choose(0)
	var i9 := _until(func(): return c.heal.sh == "bed" and c.fade == 0.0, 80)
	c._tick(0.05)
	var cap0: String = c.heal.cap
	var hid: bool = JS.t(dn.get("hidH")) and dn.away and SimSick.heal_ill and Snd.want == "sick"
	c.heal.skip()
	c._tick(0.05)
	SimSick.sickCap("Жар растёт.")
	var capd: bool = c.heal.cap == "Жар растёт." and c.heal.lines.get(int(Sim.G.day) - c.heal.d0) == "Жар растёт."
	var et: float = c.heal.end_t
	c.heal.skip()
	var d9 := Game.day
	var i10 := _until(func(): return not c.heal.on, 4000)
	c._tick(0.05)
	var ok9: bool = ch_d2[1] == "Что со мной?" and ch_e == ["Лечь в постель", "Как лечить меня?", "Назад"] and i9 >= 0 and cap0.begins_with(String(d.name) + " щупает пульс: «Лихорадка, государь. Лежать дней ") \
		and hid and capd and absf(et - (JS.n(k.ill.end) + 3.0 / 24.0)) < 1e-6 and i10 > 0 and Game.day > d9 and JS.t(k.ill.get("up")) and not SimSick.heal_ill \
		and c.hud.toast_s == "Король встаёт, хоть болезнь ещё не ушла." and not JS.t(dn.get("hidH"))
	print("selftest: больные — в постели: «", cap0.left(52), "…», лекарь с глаз ", hid, ", дней ", Game.day - d9, " за ", i10, " кадров, встал ", ok9)
	res = res and ok9
	# выздоровел советник при виде двора: встаёт с постели, подпись — прежняя
	k.ill = null
	SimSick.sickRecover(ach)
	c._tick(0.05)
	sub_t = 0.0
	_until(func(): return not JS.t(adv.get("lie")), 40)
	c._tick(0.05)
	var ok10: bool = not JS.t(ach.get("ill")) and not JS.t(adv.get("lie")) and not String(adv.sub).contains("болен") and not String(adv.sub).contains("больна")
	print("selftest: больные — ", adv.key, " поправился: встал ", not JS.t(adv.get("lie")), ", подпись «", adv.sub, "» ", ok10)
	res = res and ok10
	# как было
	for f in keep:
		if keep[f] == null:
			k.erase(f)
		else:
			k[f] = keep[f]
	for e in sick0:
		e[0].ill = e[1]
	if loy0 == null:
		ach.erase("loy")
	else:
		ach.loy = loy0
	if aff0 == null:
		ach.erase("aff")
	else:
		ach.aff = aff0
	C.doc = doc0
	C.docQ = docq0
	r0.gold = gold0
	Sim.R.st = rst0
	SimSick.no_death = nd0
	dn.erase("override")
	dn.erase("visitPt")
	rd = null
	rep = null
	Game.day = day0
	Game.frac = frac0
	Game.speed = spd0
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	c._tick(0.02)
	Snd.screen = snd0[0]
	Snd.court = snd0[1]
	Snd.want = snd0[2]
	print("selftest: больные — ", "OK" if res else "FAIL")
	return res
