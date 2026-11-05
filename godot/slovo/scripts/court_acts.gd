extends RefCounted
## Простые дела двора (courtui.js: doAct, bedDialog, sleepUntil, drawSleep; dynasty.js: cribDialog; granary.js: granTalk;
## audience.js: stallAct): постель и сон — часы бегут, пока король спит, весть будит; колыбель; амбар (счёт сенешаля);
## лавка купца; кухня, колодец, кузня; чучело — упражнение с мечом (раз в день, каждое шестое — Меч короля +1); фонтан.
## Вид двора (courtSyncVisual): кучки золота в казне, мешки в амбаре, колыбель и игрушки — при входе во двор, каждый
## новый день и при рождении. Дни — по часам двора (Game.day); случайные слова — не из зерна королевства.
const Hurt = preload("res://scripts/court_hurt.gd")

const KITCHEN := ["Из кухни тянет луком, дымом и свежим хлебом. Повариха гремит котлами.", "На кухне ощипывают кур. Кто-то напевает старую песню о походе на север.", "Поварята при виде короля роняют половник."]
const WELL := ["Глубокий колодец. Ведро скрипит на вороте.", "Вода в колодце сладкая — замок выдержит долгую осаду."]
const COIN := ["Монета булькнула. Говорят, к удаче.", "Монета легла рядом с чужими желаниями.", "Кто-то из служанок хихикнул за кустами."]

var c: Node2D   # court.gd
var sleep_t := 0.0          # король спит (COURT.sleepT): с какой секунды двора; 0 — не спит
var sleep_to := 0.0         # до какого дня с долей суток (COURT.sleepTo)
var practice_t := 0.0       # последнее упражнение у чучела (P.practiceT)
var vis := {"gold": 4, "sack": 3, "baby": false, "kids": false}   # COURT.goldPiles, sacks, hasBaby, hasKids
var vis_day := -1
var vis_rev := -1

func _init(court: Node2D) -> void:
	c = court

static func ok() -> bool:
	return not Sim.G.is_empty() and Sim.G.has("court")

static func _pick(L: Array) -> String:
	return String(L[randi() % L.size()])

# ---------- вид двора (courtSyncVisual) ----------
func sync_visual() -> void:
	if not ok():
		return
	var G := Sim.G
	vis.gold = clampi(int(JS.rnd(JS.n(G.realms[0].gold) / 90.0)), 0, 10)
	var cap: float = SimCourt.granCap()
	vis.sack = clampi(int(JS.rnd(JS.n(G.court.get("grain")) / (cap / 6.0))), 0, 6) if cap > 0.0 else 0
	var kids := _kids()
	vis.baby = kids.any(func(x): return JS.n(x.age) < 3)
	vis.kids = kids.any(func(x): return JS.n(x.age) >= 3 and JS.n(x.age) < 12)
	vis_day = Game.day
	vis_rev = SimDyn.birth_rev

## живые дети короля
static func _kids() -> Array:
	var L: Array = []
	var k: Variant = SimPlayer.kingC()
	if k == null:
		return L
	for i in (k.get("kids", []) as Array):
		var ch: Variant = Sim.charOf(i)
		if ch != null and JS.t(ch.alive):
			L.append(ch)
	return L

## предмет по условию: baby, kids, gold:i, sack:i — «больше i»
func cond_ok(w: String) -> bool:
	if w == "baby":
		return vis.baby
	if w == "kids":
		return vis.kids
	if w.begins_with("gold:"):
		return int(vis.gold) > int(w.substr(5))
	if w.begins_with("sack:"):
		return int(vis.sack) > int(w.substr(5))
	return true

## каждый кадр двора: королевство досчитало новый день (dailyTick) или родилось дитя — вид двора заново; король спит —
## часы бегут
func update() -> void:
	if ok() and not SimDay.busy and int(Sim.G.day) >= Game.day and (vis_day != Game.day or vis_rev != SimDyn.birth_rev):
		sync_visual()
	if sleep_t > 0.0:
		_sleep_step()

# ---------- дела (doAct) ----------
## дело места: true — сделано здесь
func act(a: Dictionary) -> bool:
	match String(a.id):
		"bed":
			bed_dialog()
		"crib":
			if SimPlayer.ensure_sim():
				crib_dialog()
		"granary":
			if SimPlayer.ensure_sim():
				c.hud.say(null, gran_talk())
		"stall":
			if SimPlayer.ensure_sim():
				stall()
		"kitchen":
			c.hud.say(null, _pick(KITCHEN))
		"well":
			c.hud.say(null, _pick(WELL))
		"smithy":
			c.hud.say(null, "Кузнец бьёт молотом по раскалённой полосе. " + ("Вдоль стены висят новые кольчуги — по новому способу, частым плетением."
				if ok() and SimDyn.hasTech("mail") else "Наконечники копий, подковы, гвозди — кузня работает на войско."))
		"dummy":
			dummy(a)
		"fountain":
			if SimPlayer.ensure_sim():
				fountain()
		_:
			return false
	return true

## постель короля (bedDialog): ночью — спать до утра, днём — отдохнуть пару часов
func bed_dialog(sp: Variant = null) -> void:
	var h := Game.hour_abs()
	var night := h >= 18.5 or h < 6.0
	var ch: Array = []
	if night:
		ch.append({"t": "Лечь спать до утра", "fx": func(): sleep_until(6.5 + (24.0 if h >= 6.0 else 0.0), sp)})
	ch.append({"t": "Отдохнуть пару часов", "fx": func(): sleep_until(h + 2.0, sp)})
	ch.append({"t": "Не сейчас"})
	c.hud.say(null, "Королевская постель застелена. В камине догорают угли." if night else "Ещё светло. Спать днём — дурная примета для короля, но отдохнуть можно.",
		{"choices": ch, "esc": ch.size() - 1})
	print("BED ", ch.size())

## сон (sleepUntil): ha — час в счёте 5..29+ от нынешних суток; sp — постель (своя — по умолчанию)
func sleep_until(ha: float, sp: Variant = null) -> void:
	var b: Variant = sp if sp != null else c.spots.get("bed_king")
	if b != null:
		c.sit_at(b)
	sleep_t = c.t
	sleep_to = Game.day + (ha - 5.0) / 24.0
	if Game.speed == 0:
		Game.set_speed(1)
	Snd.sfx("paper")
	print("SLEEP ", snappedf(sleep_to, 0.001))

## весть королевства (UI.modalOpen): окно-весть или бой без экрана — будят короля
func _modal() -> bool:
	return not c.hud.modals.is_empty() or c.hud.busy != ""

## пока король спит (drawSleep): часы вперёд кусками по 0.004 суток, до трёх за кадр (королевство догоняет само);
## срок настал или весть — проснуться
func _sleep_step() -> void:
	var tgt := sleep_to
	var cur := Game.day + Game.frac
	if cur < tgt and not _modal() and not c.hud.dlg_open():
		var step := minf(0.004, tgt - cur)
		for i in 3:
			if Game.day + Game.frac >= tgt or _modal():
				break
			Game.advance_days(step)
	if Game.day + Game.frac >= tgt - 1e-6 or _modal():
		var woke := _modal()
		sleep_t = 0.0
		c.people.snap(false)
		c.stand_up()
		c.last_ha = Game.day * 24.0 + Game.hour_abs()
		c.hud.toast("Вас разбудили!" if woke else "Доброе утро, государь.")
		print("WOKE ", woke, " ", Game.day, " ", Game.clock_text())

## тьма сна, часы и «Z z z» (drawSleep) — над двором, под строкой двора и разговором
func draw_hud(u: Variant) -> void:
	if sleep_t <= 0.0:
		return
	var W := 640.0
	var H := 360.0
	var now: float = c.t
	u.box(0, 0, W, H, Color(6 / 255.0, 6 / 255.0, 16 / 255.0, clampf((now - sleep_t) * 2.0, 0.0, 0.85)))
	u.txt("Король спит…  " + Game.clock_text(), W / 2.0, H / 2.0 - 4.0, Color8(0xa8, 0xc8, 0xff), "m", "c")
	u.txt("Z z z", W / 2.0 + sin(now * 2.0) * 6.0, H / 2.0 - 18.0 - fmod(now * 8.0, 8.0), Color8(0x6a, 0x7a, 0xb0), "m", "c")

## колыбель (cribDialog): младший из малышей короля — покачать (привязанность +2)
func crib_dialog() -> void:
	var king: Dictionary = SimPlayer.kingC()
	var babies: Array = _kids().filter(func(x): return JS.n(x.age) < 3)
	if babies.is_empty():
		var sp: Variant = Sim.charOf(king.spouse) if JS.n(king.get("spouse", -1.0)) >= 0 else null
		c.hud.say(null, "Резная колыбель пуста. " + ("Скоро в ней снова будет кто-то спать." if sp != null and JS.t(sp.get("preg")) else "Её берегут для будущих принцев."))
		return
	var b: Dictionary = babies[babies.size() - 1]
	c.hud.say(null, "В колыбели посапывает " + ("принцесса " if JS.t(b.get("fem")) else "принц ") + String(b.name) + ". Крошечный кулачок сжимает край одеяла.", {"choices": [
		{"t": "Покачать колыбель", "fx": func():
			b.aff = clampf(JS.n(JS.o(b.get("aff"), 70.0)) + 2, 0, 100)
			Snd.sfx("chime")
			c.hud.toast(String(b.name) + " улыбается во сне.")},
		{"t": "Отойти на цыпочках"}], "esc": 1})

## амбар (granTalk): счёт сенешаля — глазами сенешаля (noisy), подвоз, обоз
func gran_talk() -> Variant:
	var C: Dictionary = Sim.G.court
	var o: Dictionary = SimArmy.granS()
	if not (JS.n(C.seats.get("seneschal", -1.0)) >= 0):
		return "Амбар пахнет пылью и хлебом. Сенешаля нет — никто толком не знает, сколько здесь зерна."
	var sc: Variant = SimDyn.seatChar("seneschal")
	var gr := JS.n(C.get("grain"))
	var g := _noisy(gr, sc, "stew") if sc != null else JS.rnd(gr)
	return ["Амбар пахнет пылью и хлебом. Сенешаль ведёт счёт мерам: в закромах около " + JS.s(g) + " мер из " + JS.s(SimCourt.granCap()) + ", неприкосновенный запас — " + JS.s(SimCourt.granRes()) + ".",
		"Деревни везут оброк дважды в год: в конце лета, после жатвы, и осенью, после обмолота. Зимой и весной ничего не растёт — двор живёт тем, что засыпали. "
			+ ("Нынче год голодный: старосты ждут хлеба." if SimCourt.granFamine() else "Следующий подвоз — " + SimGran.granNext() + "."),
		"На обозном дворе " + SimGran.podv(JS.n(o.get("carts"))) + " — деревни дают их для королевского обоза. Снабженец берёт их первыми."]

## число глазами человека (noisy, council.js): чем ниже умение, тем больше ошибка; случай — не из зерна королевства
static func _noisy(v: float, ch: Variant, sk: String) -> float:
	var s := SimCourt.skillOf(ch, sk)
	var err := JS.clp((20 - s) / 45, 0.04, 0.4)
	var x := v * (1 + randf_range(-err, err))
	var q := 10.0 if v > 200 else 1.0
	return maxf(0.0, JS.rnd(x / q) * q)

## лавка купца (stallAct): платок королеве, трактат в библиотеку
func stall() -> void:
	var m: Dictionary = c.npc_by("srv_merchant")
	var spouse := func() -> Variant:
		var k: Dictionary = SimPlayer.kingC()
		return Sim.charOf(k.spouse) if JS.n(k.get("spouse", -1.0)) >= 0 else null
	c.hud.say(m if not m.is_empty() else null, "Шелка, пряности, книги! Для вашего величества — лучшее.", {"choices": [
		{"t": "Шёлковый платок для королевы (15 зол.)", "ok": func(): return spouse.call() != null, "why": "некому дарить", "fx": func():
			if SimCourt.spend(15):
				var q: Dictionary = spouse.call()
				q.happy = clampf(JS.n(JS.o(q.get("happy"), 60.0)) + 12, 0, 100)
				c.hud.toast("Королева будет рада.")},
		{"t": "Редкий трактат для библиотеки (35 зол.)", "fx": func():
			if SimCourt.spend(35):
				SimTech.techProgress(10)
				c.hud.toast("Магистр в восторге от трактата.")},
		{"t": "Ничего, спасибо"}], "esc": 2})

## фонтан: монета на счастье (казна −1, без проверки — как в HTML)
func fountain() -> void:
	c.hud.say(null, "Вода в фонтане холодная и прозрачная. На дне блестят монеты — придворные бросают их на счастье.", {"choices": [
		{"t": "Бросить монету (1 зол.)", "fx": func():
			Sim.G.realms[0].gold = JS.n(Sim.G.realms[0].gold) - 1
			Snd.sfx("coin")
			c.hud.toast(_pick(COIN))},
		{"t": "Уйти"}], "esc": 1})

## чучело: упражнение с мечом — больному и раненому нельзя; раз в день — шаг к Мечу короля (каждый шестой — +1)
func dummy(a: Dictionary) -> void:
	var k: Variant = SimPlayer.kingC() if ok() else null
	if k != null and Hurt.sick_not(k) != "":
		c.hud.toast(Hurt.sick_not(k) + ": меч подождёт.")
		return
	if k != null and JS.n(k.get("wound")) > Game.day:
		var n := JS.n(k.wound) - Game.day
		c.hud.toast(Hurt.wound_not(k) + ": меч подождёт (ещё " + JS.s(n) + " " + Sim.plural(n, "день", "дня", "дней") + ").")
		return
	if practice_t > 0.0 and c.t - practice_t < 1.2:
		return
	practice_t = c.t
	c.king["dir"] = "up"
	Snd.sfx("swish")
	c.later(0.18, func(): Snd.sfx("thud"))
	c.parts.append({"k": "puff", "x": float(a.x), "y": float(a.y) - 10.0, "vx": 0.0, "vy": -6.0, "t": 0.0, "life": 0.6})
	if k == null:
		return
	var C: Dictionary = Sim.G.court
	if not JS.t(C.get("drillDay")) or JS.n(C.drillDay) != Game.day:
		C.drillDay = float(Game.day)
		k.mx = JS.n(k.get("mx")) + 1
		if k.mx >= 6:
			k.mx = 0.0
			k.mar = minf(20, JS.n(k.mar) + 1)
			c.hud.toast("Рука крепнет: Меч короля +1")
		else:
			c.hud.toast("Упражнение с мечом. Солдаты одобрительно гудят.")
	print("DUMMY ", JS.n(k.get("mx")), " ", JS.n(k.mar))

func state() -> Dictionary:
	return {"sleep": sleep_t > 0.0, "to": snappedf(sleep_to, 0.001), "gold": vis.gold, "sack": vis.sack, "baby": vis.baby, "kids": vis.kids}

# ---------- самопроверка без экрана (main.gd -- --acts) ----------
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

## дело места по имени — там, где оно есть (как E у предмета)
func _act(id: String) -> void:
	for lid in c.D.locs:
		for a in c.D.locs[lid].acts:
			if String(a.id) == id:
				if c.loc_id != lid:
					c.go_loc(lid)
				c.do_act(a)
				return

func _hour(h: float) -> void:
	Game.set_hour(h)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()

## видимые предметы по условию в этом месте
func _vis_n(pre: String) -> int:
	return c.conds.filter(func(p): return String(p[1]).begins_with(pre) and (p[0] as Sprite2D).visible).size()

func _dlg_text() -> String:
	if c.hud.dlg == null:
		return ""
	var t := ""
	for pg in c.hud.dlg.pages:
		t += " ".join(pg) + " "
	return t

func _n_ch() -> int:
	return (c.hud.dlg.choices as Array).size() if c.hud.dlg != null else 0

func selftest() -> bool:
	if not ok():
		print("selftest: дела двора — нет королевства")
		return false
	var G := Sim.G
	var C: Dictionary = G.court
	var k: Dictionary = SimPlayer.kingC()
	var r0: Dictionary = G.realms[0]
	var keep := {}
	for f in ["mx", "mar", "wound", "woundK", "ill", "sickConv"]:
		keep[f] = k.get(f)
	var gold0 := JS.n(r0.gold)
	var grain0: Variant = C.get("grain")
	var gran0: Variant = (C.gran as Dictionary).duplicate(true) if C.get("gran") is Dictionary else null
	var drill0: Variant = C.get("drillDay")
	var tech0: Variant = (G.tech as Dictionary).duplicate(true) if G.get("tech") is Dictionary else null
	var day0 := Game.day
	var frac0 := Game.frac
	var spd0 := Game.speed
	var res := true
	seed(20240918)
	Game.speed = 1
	if Game.day < 2:
		Game.day = 2          # drillDay 0 — «не было» (как в HTML), дальше — по дням
	for f in ["ill", "sickConv", "wound", "woundK"]:
		k.erase(f)
	# вид двора: кучки золота в казне — по 90 зол., мешки в амбаре — по шестой части амбара
	c.go_loc("keep")
	var gl: Array = []
	for g in [450.0, 5000.0, 20.0]:
		r0.gold = g
		sync_visual()
		c._tick(0.02)
		gl.append(_vis_n("gold:"))
	var cap: float = SimCourt.granCap()
	c.go_loc("yard")
	var sk: Array = []
	for q in [cap / 2.0, cap * 2.0, 0.0]:
		C.grain = q
		sync_visual()
		c._tick(0.02)
		sk.append(_vis_n("sack:"))
	var ok0 := gl == [5, 10, 0] and sk == [3, 6, 0]
	print("selftest: дела двора — золото в казне ", gl, ", мешки в амбаре ", sk, " ", ok0)
	res = res and ok0
	C.grain = cap / 2.0
	r0.gold = 500.0
	# колыбель: пустая — или младший из малышей (здесь — старший ребёнок, на время — младенец)
	var kids := _kids()
	var bb: Variant = kids[0] if not kids.is_empty() else null
	var age0 := JS.n(bb.age) if bb != null else 0.0
	var aff0: Variant = bb.get("aff") if bb != null else null
	c.go_loc("keep")
	sync_visual()
	c._tick(0.02)
	var crib0 := _vis_n("baby")
	_act("crib")
	var t_empty := _dlg_text()
	_close()
	var ok1: bool = t_empty.begins_with("Резная колыбель пуста.") == (not vis.baby) and crib0 == (1 if vis.baby else 0)
	var crib1 := -1
	var t_baby := ""
	var aff1 := 0.0
	if bb != null:
		bb.age = 1.0
		sync_visual()
		c._tick(0.02)
		crib1 = _vis_n("baby")
		_act("crib")
		t_baby = _dlg_text()
		var a0 := JS.n(JS.o(bb.get("aff"), 70.0))
		c.hud.choose(0)
		aff1 = JS.n(bb.aff) - a0
		ok1 = ok1 and crib1 == 1 and vis.baby and t_baby.begins_with("В колыбели посапывает") and t_baby.contains(String(bb.name)) \
			and (aff1 == 2.0 or a0 >= 99.0) and c.hud.toast_s == String(bb.name) + " улыбается во сне."
		bb.age = age0
		if aff0 == null:
			bb.erase("aff")
		else:
			bb.aff = aff0
		sync_visual()
	print("selftest: дела двора — детей ", kids.size(), ", колыбель видна ", crib0, "/", crib1, ", «", t_baby.left(40), "» +", aff1, " ", ok1)
	res = res and ok1
	# постель ночью: три выбора; сон до 6:30 следующего дня — часы бегут, король лежит; проснулся — встал
	_hour(22.0)
	_act("bed")
	var n_night := _n_ch()
	var t_night := _dlg_text()
	c.hud.choose(0)
	var lay: bool = sleep_t > 0.0 and c.king.sit != null and is_same(c.king.sit, c.spots.bed_king) and c.king.lie
	var d1 := Game.day
	var i1 := _until(func(): return sleep_t == 0.0, 400)
	var h1 := Game.hour_abs()
	var ok2: bool = n_night == 3 and t_night.begins_with("Королевская постель застелена.") and lay and i1 > 0 and Game.day == d1 + 1 and absf(h1 - 6.5) < 0.05 \
		and c.king.sit == null and c.hud.toast_s == "Доброе утро, государь."
	print("selftest: дела двора — ночью выборов ", n_night, ", лёг ", lay, ", проснулся через ", i1, " кадров: день +", Game.day - d1, " ", Game.clock_text(), " ", ok2)
	res = res and ok2
	# днём: отдохнуть пару часов — или «Не сейчас»
	_hour(12.0)
	_act("bed")
	var n_day := _n_ch()
	var t_day := _dlg_text()
	c.hud.choose(n_day - 1)
	var no_sleep := sleep_t == 0.0 and c.hud.dlg == null
	_act("bed")
	c.hud.choose(0)
	var d2 := Game.day
	var i2 := _until(func(): return sleep_t == 0.0, 400)
	var ok3: bool = n_day == 2 and t_day.begins_with("Ещё светло.") and no_sleep and i2 > 0 and Game.day == d2 and absf(Game.hour_abs() - 14.0) < 0.05
	print("selftest: дела двора — днём выборов ", n_day, ", «Не сейчас» ", no_sleep, ", отдохнул до ", Game.clock_text(), " за ", i2, " кадров ", ok3)
	res = res and ok3
	# весть будит
	_hour(23.0)
	_act("bed")
	c.hud.choose(0)
	_until(func(): return false, 3)
	var d3 := Game.day
	c.hud.alert("war", 1)
	var i3 := _until(func(): return sleep_t == 0.0, 10)
	var ok4: bool = i3 >= 0 and c.hud.toast_s == "Вас разбудили!" and Game.day == d3 and Game.hour_abs() < 24.5
	c.hud.close_modal()
	print("selftest: дела двора — весть разбудила в ", Game.clock_text(), " ", ok4)
	res = res and ok4
	# чучело: раз в день — шаг к Мечу короля (шестой — +1); тут же снова — ничего; больному и раненому — нельзя
	_hour(10.0)
	C.drillDay = float(Game.day - 1)
	k.mx = 5.0
	var mar0 := JS.n(k.mar)
	_act("dummy")
	var puff: bool = c.parts.any(func(p): return p.k == "puff")
	var ok5: bool = JS.n(k.mx) == 0.0 and JS.n(k.mar) == minf(20.0, mar0 + 1.0) and c.hud.toast_s == "Рука крепнет: Меч короля +1" and JS.n(C.drillDay) == Game.day and puff \
		and c.king.dir == "up"
	var pt := practice_t
	_act("dummy")
	var again := practice_t == pt
	_until(func(): return c.t - pt >= 1.25, 100)
	c.hud.toast_s = ""
	_act("dummy")
	ok5 = ok5 and again and practice_t != pt and JS.n(k.mx) == 0.0 and c.hud.toast_s == ""
	C.drillDay = float(Game.day - 1)
	_until(func(): return c.t - practice_t >= 1.25, 100)
	_act("dummy")
	ok5 = ok5 and JS.n(k.mx) == 1.0 and c.hud.toast_s == "Упражнение с мечом. Солдаты одобрительно гудят."
	k.wound = float(Game.day + 3)
	k.woundK = 2.0
	_until(func(): return c.t - practice_t >= 1.25, 100)
	_act("dummy")
	var t_w: String = c.hud.toast_s
	k.erase("wound")
	k.erase("woundK")
	k.sickConv = float(Game.day + 2)
	_act("dummy")
	var t_s: String = c.hud.toast_s
	k.erase("sickConv")
	ok5 = ok5 and t_w == "Рана ещё не зажила: меч подождёт (ещё 3 дня)." and t_s == "Вы ещё слабы после болезни, государь: меч подождёт." and JS.n(k.mx) == 1.0
	print("selftest: дела двора — чучело: Меч ", mar0, "→", JS.n(k.mar), ", рана «", t_w, "», болезнь «", t_s, "» ", ok5)
	res = res and ok5
	# фонтан: монета (−1 зол.) или уйти
	r0.gold = 100.0
	_act("fountain")
	var n_f := _n_ch()
	c.hud.choose(0)
	var g_f := JS.n(r0.gold)
	var t_f: String = c.hud.toast_s
	_act("fountain")
	c.hud.choose(1)
	var ok6: bool = n_f == 2 and g_f == 99.0 and COIN.has(t_f) and JS.n(r0.gold) == 99.0 and c.hud.dlg == null
	print("selftest: дела двора — фонтан: казна 100→", g_f, " «", t_f, "» ", ok6)
	res = res and ok6
	# лавка купца: платок королеве (15 зол.), трактат в библиотеку (35 зол.)
	r0.gold = 100.0
	var q: Variant = Sim.charOf(k.spouse) if JS.n(k.get("spouse", -1.0)) >= 0 else null
	var hap0: Variant = q.get("happy") if q != null else null
	_act("stall")
	var n_s := _n_ch()
	var who: String = String(c.hud.dlg.name) if c.hud.dlg != null else ""
	c.hud.choose(0)
	var g_s := JS.n(r0.gold)
	var t_s1: String = c.hud.toast_s
	var ok7: bool = n_s == 3 and who == String(c.npc_by("srv_merchant").get("name", ""))
	if q != null:
		ok7 = ok7 and g_s == 85.0 and t_s1 == "Королева будет рада." and JS.n(q.happy) == clampf(JS.n(JS.o(hap0, 60.0)) + 12.0, 0.0, 100.0)
		if hap0 == null:
			q.erase("happy")
		else:
			q.happy = hap0
	else:
		ok7 = ok7 and g_s == 100.0 and t_s1 == "некому дарить" and c.hud.dlg != null
	_close()
	r0.gold = 100.0
	_act("stall")
	c.hud.choose(1)
	ok7 = ok7 and JS.n(r0.gold) == 65.0 and c.hud.toast_s == "Магистр в восторге от трактата."
	print("selftest: дела двора — лавка «", who, "»: выборов ", n_s, ", королеве ", q != null, " (казна ", g_s, "), трактат — казна ", JS.n(r0.gold), " ", ok7)
	res = res and ok7
	# амбар: счёт сенешаля (около — глазами сенешаля), подвоз, обоз; кухня, колодец, кузня
	SimArmy.granS()           # амбары заводятся при первом обращении (в новой игре — с первым днём)
	C.grain = 3000.0
	_act("granary")
	var t_g := _dlg_text()
	var np: int = (c.hud.dlg.pages as Array).size() if c.hud.dlg != null else 0
	_close()
	var sen: bool = JS.n(C.seats.get("seneschal", -1.0)) >= 0
	var ok8: bool = (np >= 3 and t_g.contains("Сенешаль ведёт счёт мерам") and t_g.contains("На обозном дворе")) if sen else t_g.begins_with("Амбар пахнет пылью и хлебом. Сенешаля нет")
	if sen:
		var m := RegEx.create_from_string("около (\\d+) мер").search(t_g)
		ok8 = ok8 and m != null and absf(float(m.get_string(1)) - 3000.0) <= 3000.0 * 0.4 + 10.0
	var tk: Array = []
	for id in ["kitchen", "well", "smithy"]:
		_act(id)
		tk.append(_dlg_text().strip_edges())
		_close()
	ok8 = ok8 and KITCHEN.has(tk[0]) and WELL.has(tk[1]) and String(tk[2]).begins_with("Кузнец бьёт молотом по раскалённой полосе.")
	print("selftest: дела двора — амбар: сенешаль ", sen, ", страниц ", np, "; кухня, колодец, кузня ", ok8, "" if ok8 else " " + str(tk))
	res = res and ok8
	# как было
	for f in keep:
		if keep[f] == null:
			k.erase(f)
		else:
			k[f] = keep[f]
	r0.gold = gold0
	if grain0 == null:
		C.erase("grain")
	else:
		C.grain = grain0
	if gran0 == null:
		C.erase("gran")
	else:
		C.gran = gran0
	if drill0 == null:
		C.erase("drillDay")
	else:
		C.drillDay = drill0
	if tech0 != null:
		G.tech = tech0
	sleep_t = 0.0
	practice_t = 0.0
	Game.day = day0
	Game.frac = frac0
	Game.speed = spd0
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	sync_visual()
	c._tick(0.02)
	print("selftest: дела двора — ", "OK" if res else "FAIL")
	return res
