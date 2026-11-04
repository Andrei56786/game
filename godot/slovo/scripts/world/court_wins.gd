extends "res://scripts/world/map_ui_base.gd"
## Окна двора — общие для карты и замка (screens3.js): «Малый совет» (drawCouncilWin3: места и поручения, кандидаты —
## drawCandTab из birds.js, доклады, судебная книга drawCourtBook), «Письма и донесения» (drawLettersWin, openLetter),
## вести с выбором (drawEventModal), объявление войны (drawWarModal), Совет короны (drawCouncilModal). Созвать совет
## и сесть во главе стола можно только в замке — это делает двор (court.gd: сбор совета из audience.js); на карте окно
## знает о дворе через court (main ставит, пока двор жив).

const SKL := ["mar", "dip", "intr", "stew", "lrn"]
const CTABS := [["Места и поручения", 104, 0], ["Кандидаты", 66, 3], ["Доклады", 60, 1], ["Суд", 40, 2]]
const CFILT := [["all", "Все", "Все кандидаты"], ["court", "Двор", "При дворе, но не в совете"], ["council", "Совет", "Члены Малого совета"], ["lords", "Дома", "Главы знатных домов — живут в своих замках"]]
const BY := {"king": "Король", "judge": "Судья", "regent": "Регент", "clerk": "Писцы"}
const QW := ["неудачно", "сносно", "мудро"]
const QC := [WARN, "#e8c890", GOOD]


# ---------- что открыто ----------
## Малый совет: seat — место, pick — сразу выбор цели поручения (из «Знаний» эпохи — исследование магистра)
func open_council(seat := "", pick := "") -> void:
	if not SimPlayer.ensure_sim():
		toast("Королевство не готово: нет данных мира.")
		return
	win = {"k": "council", "tab": 0, "mode": "intent", "seat": seat if seat != "" else "chancellor", "pick": pick, "app": 0, "sc": 0}
	Snd.sfx("paper")

func open_letters() -> void:
	if not SimPlayer.ensure_sim():
		toast("Королевство не готово: нет данных мира.")
		return
	win = {"k": "letters", "sc": 0}
	Snd.sfx("paper")

## клавиша окна (K, L): то же окно — закрыть
func toggle_win(k: String) -> void:
	if win != null and String(win.k) == k:
		win = null
	elif k == "council":
		open_council()
	elif k == "letters":
		open_letters()

func unread() -> int:
	if Sim.G.is_empty() or not Sim.G.has("court"):
		return 0
	var now_d: float = Sim.G.day + JS.n(Sim.G.get("frac"))
	return (Sim.G.court.letters as Array).filter(func(l): return not JS.t(l.get("read")) and float(l.arr) <= now_d).size()

## щелчок (c = {x, y, ux, uy, b, drag}): в разговоре — выбор, иначе — по областям прошлого кадра
func click(c: Dictionary) -> void:
	if dlg != null:
		if c.b == 0:
			dlg_click(Vector2(c.ux, c.uy))
		return
	if busy != "":
		return
	dispatch(c)

func _court_ok() -> bool:
	return court != null and is_instance_valid(court)

## окна и вести двора: true — нарисовано
func _court_win(w: Dictionary) -> bool:
	if Sim.G.is_empty() or not Sim.G.has("court"):
		return false
	match String(w.k):
		"council":
			_council_win(w)
		"letters":
			_letters_win(w)
		_:
			return false
	return true

func _court_modal(m: Dictionary) -> bool:
	match String(m.k):
		"event":
			_event(m)
		"war":
			_war(m)
		"council":
			_crown(m)
		_:
			return false
	return true


# ---------- приборы ----------
static func sk_col(v: float) -> Variant:
	return GOOD if v >= 14 else (Art.pal("w") if v >= 10 else ("#e8c890" if v >= 6 else "#e08a6a"))

static func skn(k: String) -> String:
	return String(Sim.T.SKN[k])

func skills_line(c: Dictionary, x: float, y: float, main: String) -> void:
	var xx := x
	for k in SKL:
		var s := skn(k) + " " + JS.s(JS.n(c.get(k)))
		tx(s, xx, y, Art.pal("y") if k == main else sk_col(JS.n(c.get(k))), "s")
		hit(xx, y - 1, tw(s, "s"), 9, {"id": "sk" + k + str(x) + str(y), "tip": skn(k) + " — " + String(Sim.T.SKD[k])})
		xx += tw(s, "s") + 8

func mode_toggle(x: float, y: float, w0: float, w: Dictionary) -> void:
	var hw := floorf(w0 / 2.0) - 1
	btn("md_o", x, y, hw, 13, {"label": "Приказ", "active": w.mode == "order", "tip": mode_tip("order"), "on": func(_c): w.mode = "order"})
	btn("md_i", x + hw + 2, y, hw, 13, {"label": "Замысел", "active": w.mode == "intent", "tip": mode_tip("intent"), "on": func(_c): w.mode = "intent"})

static func house_s(c: Dictionary, cap := false) -> String:
	return ("Дом " if cap else "дом ") + SimDyn.houseName(c.house) if JS.n(c.get("house", -1)) >= 0 else ""

## как дом виден короне (houseSeen): канцлер ошибается тем больше, чем хуже его Речь; раз в день заново
static func house_seen(H0: Dictionary) -> float:
	var G := Sim.G
	var sn: Variant = H0.get("seen")
	if not (sn is Dictionary) or float(sn.d) != G.day:
		var ch: Variant = SimDyn.seatChar("chancellor")
		var err := clampf((20 - JS.n(ch.get("dip"))) * 1.3, 3, 20) if ch != null else 25.0
		H0.seen = {"d": G.day, "v": clampf(roundf(JS.n(H0.get("loy")) + Sim.R.range(-err, err) * 0.5), 0, 100)}
	return float(H0.seen.v)

## цели поручений (tgtList): держава, дом, крепость, знание, ребёнок, человек
func tgt_list(type: String) -> Array:
	var G := Sim.G
	var C: Dictionary = G.court
	var king: Variant = SimPlayer.kingC()
	var L: Array = []
	match type:
		"realm":
			for t in [1, 2, 3, 4]:
				if SimDay.alive(t):
					L.append({"id": float(t), "n": Sim.realmName(t), "sub": SimCourt.opinionWord(SimDay.opinionOf(t, 0)) + (" · война" if JS.t(G.rel[0][t].get("war")) else "")})
		"house":
			for h in G.houses:
				if JS.t(h.alive):
					L.append({"id": h.id, "n": "Дом " + String(h.name), "sub": SimPlayer.loyWord(house_seen(h))})
		"sett":
			for S in G.setts:
				if S.owner == 0.0 and S.ctrl == 0.0 and String(Sim.W.setts[int(S.id)].type) != "village":
					L.append({"id": S.id, "n": String(Sim.W.setts[int(S.id)].name), "sub": "стены " + JS.s(S.walls)})
		"tech":
			var TT: Dictionary = SimTech.TECH()
			for k in TT:
				if SimTech.techAvail(k) or SimTech.techAhead(k):
					L.append({"id": k, "n": String(TT[k].n), "sub": String(Sim.T.BRANCHES[TT[k].b].n) + " · " + JS.s(JS.n(TT[k].cost))})
		"child":
			var K: Array = SimDyn.royalFamily().filter(func(c): return c.age >= 4 and c.age < 18)
			for id in C.get("wards", []):
				var c: Variant = Sim.charOf(id)
				if c != null and JS.t(c.alive):
					K.append(c)
			for c in K:
				L.append({"id": c.id, "n": String(c.name), "sub": SimText.yrs(c.age)})
		"char":
			for c in G.chars:
				if L.size() >= 40:
					break
				if JS.t(c.alive) and c.realm == 0.0 and (king == null or c.id != king.id) and (JS.t(c.get("atCourt")) or JS.t(c.get("seat")) or c.role == "lord" or c.role == "knight") and c.age >= 16 and c.prison < 0:
					L.append({"id": c.id, "n": String(c.name), "sub": SimDyn.seatName(c.seat) if JS.t(c.get("seat")) else SimDyn.houseName(c.house)})
	return L


# ---------- Малый совет (drawCouncilWin3) ----------
func _council_win(w: Dictionary) -> void:
	var X := 14.0
	var Y := 21.0
	var WW := 612.0
	var HH := 326.0
	var C: Dictionary = Sim.G.court
	win_frame(X, Y, WW, HH, "Малый совет", false)
	var tx0 := X + 12
	for e in CTABS:
		var i: int = e[2]
		var tp: Variant = null
		if i == 2:
			tp = ["Судебная книга", "Все прошения, решённые при дворе: вами, верховным судьёй, регентом или писцами — и насколько мудро."]
		elif i == 3:
			tp = ["Кандидаты", "Все, кого можно посадить за стол совета, — такими, какими вы их знаете. Пташки Ока узнают о них больше."]
		btn("tab" + str(i), tx0, Y + 22, e[1], 13, {"label": e[0], "style": "parch", "active": int(w.tab) == i, "tip": tp, "on": func(_c): _set_tab(w, i)})
		tx0 += float(e[1]) + 2
	_council_sched(w, X, Y, WW)
	match int(w.tab):
		2:
			_court_book(w, X, Y, WW, HH)
			return
		3:
			_cand_tab(w, X, Y, WW, HH)
			return
		1:
			_reports(w, X, Y, WW, HH)
			return
	var y0 := Y + 40
	for i in Sim.SEATS.size():
		var s: Dictionary = Sim.SEATS[i]
		var yy := y0 + i * 40
		var c: Variant = SimDyn.seatChar(s.k)
		var sel: bool = w.seat == s.k
		var o: Variant = C.orders.get(s.k)
		rect(X + 10, yy, 200, 38, P3.sel if sel else (P3.row if i % 2 else P3.row2))
		if sel:
			stroke_r(X + 10, yy, 200, 38, "#c9a060")
		if c != null:
			port48(c, X + 13, yy + 3, 0.5)
		else:
			rect(X + 13, yy + 3, 24, 24, "#1a120c")
			tx("?", X + 25, yy + 11, DIM, "m", "c")
		spr_k(String(s.ic), X + 42, yy + 4)
		tx(String(s.n), X + 52, yy + 3, Art.pal("y"))
		if c != null:
			var z: Dictionary = SimBirds.skSeen(c, s.sk)
			tx(skn(s.sk) + " " + String(z.s), X + 206, yy + 3, sk_col(z.v) if JS.t(z.kn) else "#c8b898", "s", "r")
		tx(String(c.name) if c != null else "— место пустует —", X + 42, yy + 14, Art.pal("w") if c != null else WARN, "s")
		if JS.t(o):
			var d: Variant = SimCourt.ordDef(s.k, o.k)
			var me: bool = JS.t(o.get("self"))
			bar(X + 42, yy + 26, 60, 6, _ord_prog(o), "#e0a630")
			tx(("сам: " if me else "") + (String(d.n) if d != null else String(o.k)), X + 106, yy + 25, "#b8a888" if me else "#e8dcc0", "s")
		elif c != null:
			tx("ждёт поручения", X + 42, yy + 25, DIM, "s")
		var sk0: String = s.k
		hit(X + 10, yy, 200, 38, {"id": "row_cs" + sk0, "on": func(_c): _cs_pick(w, sk0)})
	_seat_details(w, X, Y, WW, HH, y0)

func _set_tab(w: Dictionary, i: int) -> void:
	w.tab = i
	w.sc = 0

func _cs_pick(w: Dictionary, k: String) -> void:
	w.seat = k
	w.pick = ""
	w.app = 0
	w.sc = 0

func _ord_prog(o: Dictionary) -> float:
	var cur: Variant = Sim.G.tech.get("cur")
	return SimTech.techFrac(cur) if o.k == "research" and JS.t(cur) else JS.n(o.get("prog"))

## расписание и экстренный сбор (справа от вкладок)
func _council_sched(_w: Dictionary, X: float, Y: float, WW: float) -> void:
	var C: Dictionary = Sim.G.court
	var nd := SimText.nextCouncilDay()
	var why := can_call()
	var open := meeting_open()
	var bw := maxf(tw("Созвать совет сейчас"), tw("Сесть во главе стола")) + 12
	var bx := X + WW - 12 - bw
	var ty := Y + 25
	var s := "Ближайший совет: " + String(Game.WDAY[nd % 7]) + ", " + str(nd % Game.DAYS_SEASON + 1) + " д. · " + SimText.inDays(nd - Game.day)
	if open:
		var pr: Dictionary = court.meet.presence() if _court_ok() else {"come": []}
		var sat: int = (pr.come as Array).filter(func(e): return court.meet.seated_now(e.n)).size() if _court_ok() else 0
		s = "Совет собирается: за столом " + str(sat) + " из " + str((pr.come as Array).size())
	elif float(C.get("meetDone", -1.0)) == float(Game.day):
		s = "Совет сегодня уже заседал · следующий " + SimText.inDays(nd - Game.day)
	var sw := tw(s, "s")
	tx(s, bx - 6, ty, "#e8d8b0", "s", "r")
	hit(bx - 6 - sw, ty - 1, sw, 9, {"id": "c_next", "tip": SimText.calendarTip()})
	if open and JS.t(Sim.G.get("atCourt")) and _court_ok() and court.is_inside_tree():
		sbtn("c_go", bx, Y + 22, bw, "Сесть во главе стола", func(_c): _go_seat(), {"tip": ["Пройти в зал совета и занять место короля.", {"t": "Совет начнётся, когда все советники сядут.", "c": DIM}]})
	else:
		var tp: Array = ["Созвать совет нельзя", {"t": why + ".", "c": WARN}] if why != "" else ["Экстренный сбор: советники, что сейчас в замке, придут в зал совета в течение часа.", {"t": "Ночью советники будут недовольны (верность −2).", "c": WARN} if Game.is_night() else {"t": "Не чаще раза в день. Если король не придёт за два часа — разойдутся, обидевшись.", "c": DIM}]
		sbtn("c_call", bx, Y + 22, bw, "Созвать совет сейчас", func(_c): _call(), {"disabled": why != "", "tip": tp})

func meeting_open() -> bool:
	return court.meet.meeting_open() if _court_ok() else false

func can_call() -> String:
	if not JS.t(Sim.G.get("atCourt")):
		return "Король в отъезде — без него совет не собрать"
	if not _court_ok() or not court.is_inside_tree():
		return "Вернитесь ко двору (Tab), чтобы созвать совет"
	return court.meet.can_call()

func _call() -> void:
	if _court_ok():
		court.meet.call_council()

func _go_seat() -> void:
	win = null
	if _court_ok():
		court.meet.go_seat()

## подробности места: кто сидит, поручение, как поручить, список поручений или выбор цели
func _seat_details(w: Dictionary, X: float, Y: float, WW: float, HH: float, y0: float) -> void:
	var C: Dictionary = Sim.G.court
	var x0 := X + 220
	var wR := WW - 232
	var y := y0
	var s: Dictionary = SimCourt.seatDef(w.seat)
	var c0: Variant = SimDyn.seatChar(w.seat)
	tx(String(s.n), x0, y, Art.pal("y"))
	y += 11
	y += para(String(s.d), x0, y, wR, P3.lab, "s", 9) + 4
	hline(x0, y, wR, "#6a4428")
	y += 5
	if c0 == null or int(w.app):
		_candidates(w, x0, y, wR, s)
		return
	var c: Dictionary = c0
	port48(c, x0, y)
	stroke_r(x0 - 1, y - 1, 50, 50, "#c9a060")
	tx(Sim.charName(c), x0 + 56, y, Art.pal("w"))
	tx((house_s(c, true) + " · " if JS.n(c.get("house", -1)) >= 0 else "") + SimText.yrs(c.age), x0 + 56, y + 10, P3.lab, "s")
	var ts: Dictionary = SimBirds.traitsSeen(c)
	tx(String(ts.s), x0 + 56, y + 20, "#e8c890", "s")
	hit(x0 + 56, y + 19, tw(String(ts.s), "s"), 9, {"id": "c_tr", "tip": trait_tip(c) if JS.t(ts.all) else ["Нрав виден лишь отчасти", "Пташки Ока донесут о нём больше."]})
	skills_line(c, x0 + 56, y + 30, s.sk)
	var ls: Dictionary = SimPlayer.loySeen(c)
	tx("Верность: " + String(ls.s), x0 + 56, y + 40, BAD if ls.v < 35 else (GOOD if ls.v > 65 else Art.pal("w")), "s")
	hit(x0 + 56, y + 39, 200, 9, {"id": "c_loy", "tip": ["Верность скрыта: вы видите лишь лицо, которое вам показывают.", "Нечестные кажутся вернее, чем есть.", {"t": "Точнее узнать — досье от Ока короля или пташки.", "c": DIM}]})
	y += 54
	var o: Variant = C.orders.get(w.seat)
	if JS.t(o):
		var d: Variant = SimCourt.ordDef(w.seat, o.k)
		var cur: Variant = Sim.G.tech.get("cur")
		var rs: bool = o.k == "research" and JS.t(cur)
		var pr := _ord_prog(o)
		var me: bool = JS.t(o.get("self"))
		tx("Поручение: " + (String(d.n) if d != null else String(o.k)) + (" «" + String(SimTech.TECH()[cur].n) + "»" if rs else "") + " · " + (("сам, без поручения (сила ×" + "%.2f" % SimCourt.selfK(w.seat) + ")") if me else ("приказ" if o.mode == "order" else "замысел")), x0, y, Art.pal("w"), "s")
		if me:
			hit(x0, y - 1, wR - 76, 9, {"id": "c_self", "tip": ["Советник взялся за дело сам", "Без ваших поручений советник берётся за дешёвые и безопасные дела, тратит вдвое меньше золота, но и работает вполсилы. Если в казне меньше 200 золотых — ждёт.", {"t": "Чем дольше вы молчите (больше двух недель), тем хуже он угадывает вашу волю: сила падает до ×0.4.", "c": WARN}, {"t": "Любое ваше поручение заменит это дело.", "c": DIM}]})
		bar(x0, y + 10, 140, 6, pr, "#e0a630")
		tx(str(roundi(pr * 100)) + "%", x0 + 146, y + 9, P3.lab, "s")
		var sk0: String = w.seat
		sbtn("c_cancel", x0 + wR - 70, y + 2, 70, "Отменить", func(_c): _ord_cancel(sk0))
		y += 22
	else:
		tx("Поручений нет. Если промолчите — советник возьмётся за дело сам, но вполсилы.", x0, y, DIM, "s")
		y += 12
	tx("Как поручить:", x0, y + 3, P3.lab, "s")
	mode_toggle(x0 + 64, y, 140, w)
	var eo := SimCourt.orderEff(c, w.seat, "order")
	var ei := SimCourt.orderEff(c, w.seat, "intent")
	tx("приказ — " + SimCourt.effWord(eo) + ", замысел — " + SimCourt.effWord(ei), x0 + 212, y + 3, GOOD if ei > eo else "#e8c890", "s")
	y += 18
	if String(w.get("pick", "")) != "":
		var d: Variant = SimCourt.ordDef(w.seat, w.pick)
		if d == null:
			w.pick = ""
			return
		var L := tgt_list(String(d.tgt))
		tx("Цель для «" + String(d.n) + "»:", x0, y, Art.pal("y"))
		sbtn("c_back", x0 + wR - 60, y - 2, 60, "Назад", func(_c): w.pick = "")
		y += 13
		if L.is_empty():
			tx("Подходящих целей нет.", x0, y, DIM, "s")
		for i in mini(L.size(), 22):
			var t: Dictionary = L[i]
			var cx := x0 + (i % 2) * (wR / 2 + 2)
			var cy := y + (i / 2) * 15
			var lb := String(t.n) + (" · " + String(t.sub) if String(t.get("sub", "")) != "" else "")
			btn("c_t" + str(i), cx, cy, wR / 2 - 2, 13, {"label": fit_t(lb, wR / 2 - 10), "tip": lb if fit_t(lb, wR / 2 - 10) != lb else null, "on": func(_c): _give(w, String(d.k), t.id)})
		return
	var OL: Array = SimCourt.ORD().get(w.seat, [])
	var rh := clampf(floorf((Y + HH - 24 - y) / maxf(1, OL.size())), 13, 16)
	for d in OL:
		if y > Y + HH - 36:
			break
		var busy0: bool = JS.t(o) and o.k == d.k and not JS.t(o.get("self"))
		var cost := JS.n(d.get("cost"))
		var dur := JS.n(d.get("dur"))
		var tgt: bool = JS.t(d.get("tgt"))
		var tp: Array = [d.n, d.d, {"t": ("Цена: " + JS.s(cost) + " зол. · " if cost > 0 else "") + ("Срок: " + JS.s(dur) + " дн." if dur < 900 else "До завершения"), "c": DIM}, {"t": "Новое поручение заменит текущее.", "c": WARN} if JS.t(o) else null]
		var dd: Dictionary = d
		btn("c_o" + String(d.k), x0, y, 170, 13, {"label": String(d.n) + ("…" if tgt else ""), "disabled": busy0, "tip": tp, "on": func(_c): _ord_click(w, dd)})
		var ct := (JS.s(cost) + " зол. · " if cost > 0 else "") + (JS.s(dur) + " дн." if dur < 900 else "бессрочно")
		tx(ct, x0 + 176, y + 3, P3.lab, "s")
		var dx := maxf(232, 176 + tw(ct, "s") + 8)
		var ln := wrap_text(String(d.d), wR - dx - 4, "s")
		tx(ln[0] + ("…" if ln.size() > 1 else ""), x0 + dx, y + 3, "#a89878", "s")
		y += rh
	sbtn("c_app", x0, Y + HH - 20, 110, "Назначить другого…", func(_c): _app_on(w))
	var sk1: String = w.seat
	sbtn("c_dis", x0 + 116, Y + HH - 20, 110, "Снять с поста", func(_c): dismiss_ask(sk1, c))

func _ord_click(w: Dictionary, d: Dictionary) -> void:
	if JS.t(d.get("tgt")):
		w.pick = d.k
		return
	SimCourt.giveOrder(w.seat, d.k, w.mode, null)
	tick_toasts()

func _give(w: Dictionary, k: String, t: Variant) -> void:
	if SimCourt.giveOrder(w.seat, k, w.mode, t):
		w.pick = ""
	tick_toasts()

func _ord_cancel(k: String) -> void:
	var C: Dictionary = Sim.G.court
	var o: Variant = C.orders.get(k)
	if JS.t(o) and o.k == "research":
		Sim.G.tech.cur = null
	C.orders[k] = null
	toast("Поручение отменено.")

func _app_on(w: Dictionary) -> void:
	w.app = 1
	w.sc = 0

## снять с поста (из окна совета и из разговора с советником)
func dismiss_ask(k: String, c: Dictionary) -> void:
	var s: Dictionary = SimCourt.seatDef(k)
	win = null
	say(null, "Снять " + String(c.name) + " с поста «" + String(s.n) + "»? " + ("Она" if JS.t(c.get("fem")) else "Он") + " обидится, " + ("дом " + SimDyn.houseName(c.house) + " тоже." if JS.n(c.get("house", -1)) >= 0 else "но это переживут."),
		{"choices": [{"t": "Да, снять", "fx": func(): _dismiss(k, c, s)}, {"t": "Нет", "fx": func(): pass}], "esc": 1})

func _dismiss(k: String, c: Dictionary, s: Dictionary) -> void:
	SimCourt.dismissSeat(k)
	Sim.glog(String(c.name) + " снят с поста: " + String(s.n) + ".", "info")

## кандидаты на место (drawCandidates): по навыку места
func _candidates(w: Dictionary, x0: float, y: float, wR: float, s: Dictionary) -> void:
	var L: Array = SimCourt.candidatesFor(s.k)
	var cur: Variant = SimDyn.seatChar(s.k)
	tx("Кандидаты (по навыку «" + skn(s.sk) + "»):", x0, y, Art.pal("y"))
	if int(w.app) and cur != null:
		sbtn("c_back2", x0 + wR - 60, y - 2, 60, "Назад", func(_c): w.app = 0)
	y += 13
	if L.is_empty():
		para("Подходящих людей при дворе нет. Новые придворные приезжают просить места на приёмах у трона.", x0, y, wR, DIM, "s", 9)
		return
	var sc := _wheel_scroll(w, L.size() - 7)
	for i in range(sc, mini(L.size(), sc + 7)):
		var c: Dictionary = L[i]
		var yy := y + (i - sc) * 30
		rect(x0, yy, wR, 28, P3.row if (i - sc) % 2 else P3.row2)
		port48(c, x0 + 2, yy + 2, 0.5)
		tx(Sim.charName(c), x0 + 30, yy + 3, Art.pal("w"), "s")
		tx(fit_t((house_s(c) if JS.n(c.get("house", -1)) >= 0 else "без дома") + " · " + SimText.yrs(c.age) + " · " + traits_s(c), wR - 130, "s"), x0 + 30, yy + 13, P3.lab, "s")
		var v := SimCourt.skillOf(c, s.sk)
		tx(skn(s.sk) + " " + JS.s(v), x0 + wR - 96, yy + 9, sk_col(v))
		var other := ("сейчас: " + SimDyn.seatName(c.seat)) if JS.t(c.get("seat")) else ("глава дома" if c.role == "lord" else "")
		if other != "":
			tx(other, x0 + wR - 96, yy + 19, DIM, "s")
		btn("c_ap" + JS.s(c.id), x0 + wR - 40, yy + 7, 38, 13, {"label": "Да", "tip": ["Назначить " + String(c.name) + " на место «" + String(s.n) + "»", {"t": "Его дом будет польщён.", "c": DIM}], "on": func(_c): _appoint(w, s, c)})
		hit(x0, yy, wR - 42, 28, {"id": "row_cand" + JS.s(c.id), "tip": trait_tip(c)})

## назначить из кандидатов (birds.js: запись в летопись — в appointSeat)
func _appoint(w: Dictionary, s: Dictionary, c: Dictionary) -> void:
	SimCourt.appointSeat(s.k, c.id)
	w.app = 0
	appointed(String(s.k))

## новый советник назначен: при дворе — заселить и поблагодарить (court_ui.gd), на карте — ничего
func appointed(_k: String) -> void:
	pass

## доклады советников (новые сверху)
func _reports(w: Dictionary, X: float, Y: float, WW: float, HH: float) -> void:
	var y := Y + 42
	var L: Array = (Sim.G.court.reports as Array).duplicate()
	L.reverse()
	var sc := _wheel_scroll(w, L.size() - 6)
	if L.is_empty():
		tx("Докладов пока нет. Дайте поручения — советники отчитаются, когда закончат.", X + 16, y, P3.lab)
	for r in L.slice(sc):
		if y > Y + HH - 24:
			break
		tx(SimDyn.seatName(r.seat) + " · " + SimText.dateStr(r.day), X + 16, y, Art.pal("y"), "s")
		y += 9
		y += para(String(r.text), X + 16, y, WW - 32, Art.pal("w"), "s", 9) + 5

## судебная книга (drawCourtBook): прошения, решённые королём, судьёй, регентом или писцами
func _court_book(w: Dictionary, X: float, Y: float, WW: float, HH: float) -> void:
	var C: Dictionary = Sim.G.court
	var j: Variant = SimDyn.seatChar("justice")
	var V: Array = C.get("verdicts", []) if C.get("verdicts") is Array else []
	var rg: bool = JS.n(C.get("regent", -1)) >= 0
	var y := Y + 42
	var head := ("Верховный судья " + String(j.name) + " · Книга " + JS.s(JS.n(j.lrn)) + ": мудрое решение — примерно в " + str(roundi(clampf(JS.n(j.lrn) / 18.0, 0.2, 0.95) * 100)) + "% дел.") if j != null else ("Верховного судьи нет: прошения разбирает регент." if rg else "Место верховного судьи пустует: без вас прошения решают писцы — как придётся.")
	tx(head, X + 16, y, Art.pal("y") if j != null else WARN, "s")
	y += 10
	var M: Array = V.filter(func(v): return Sim.G.day - float(v.d) < 30 and v.by != "king")
	var wise: int = M.filter(func(v): return int(v.q) == 2).size()
	tx("За 30 дней без вас решено " + str(M.size()) + " " + Sim.plural(M.size(), "дело", "дела", "дел") + ", мудро — " + str(wise) + ". " + ("Судья" if j != null else ("Регент" if rg else "Писцы")) + " разбира" + ("ет" if j != null or rg else "ют") + " прошения, пока вы в отъезде, и то, что осталось после полудня.", X + 16, y, P3.lab, "s")
	y += 14
	if V.is_empty():
		tx("Книга пуста: прошений ещё не разбирали.", X + 16, y, DIM, "s")
		return
	var per := floori((Y + HH - 10 - y) / 20.0)
	var sc := _wheel_scroll(w, V.size() - per)
	for i in range(sc, mini(V.size(), sc + per)):
		var v: Dictionary = V[i]
		var q := int(v.q)
		rect(X + 12, y - 2, WW - 24, 19, P3.row if i % 2 else P3.row2)
		tx(SimText.dateStr(v.d) + " · " + String(BY.get(v.by, v.by)) + (" " + String(v.bn) if JS.t(v.get("bn")) and v.by != "king" else ""), X + 16, y, Art.pal("y"), "s")
		tx(String(v.g), X + 190, y, Art.pal("w"), "s")
		tx("→ " + String(v.t), X + 190, y + 8, QC[q], "s")
		tx(QW[q], X + WW - 16, y + 8, QC[q], "s", "r")
		y += 20

## кандидаты (drawCandTab): все, кого можно посадить за стол, — как они известны; пташки Ока, досье, шпионы
func _cand_tab(w: Dictionary, X: float, Y: float, WW: float, HH: float) -> void:
	var C: Dictionary = Sim.G.court
	var e: Variant = SimDyn.seatChar("eye")
	if not w.has("cf"):
		w.cf = "all"
	var y := Y + 41
	for i in CFILT.size():
		var f: Array = CFILT[i]
		var fk: String = f[0]
		btn("cf_" + fk, X + 12 + i * 48, y, 46, 12, {"label": f[1], "tip": f[2], "style": "wood" if w.cf == fk else "dark", "active": w.cf == fk, "on": func(_c): _cf_set(w, fk)})
	var LW := 392.0
	var lx := X + 10
	var cx0 := lx + 200
	var cw := 30.0
	var sk: String = w.get("cs", "")
	for i in SKL.size():
		var k: String = SKL[i]
		btn("cs_" + k, cx0 + i * cw, y, cw - 2, 12, {"label": skn(k), "style": "wood" if sk == k else "dark", "active": sk == k, "tip": ["Упорядочить по навыку «" + skn(k) + "» — " + String(Sim.T.SKD[k]), {"t": "Как он вам известен: точно, по оценке пташек (≈) или на глаз (диапазон).", "c": DIM}], "on": func(_c): w.cs = "" if String(w.get("cs", "")) == k else k})
	spr_k("i_bird", cx0 + 5 * cw + 4, y + 3)
	tx("Пташки", cx0 + 5 * cw + 12, y + 2, P3.lab, "s")
	hit(cx0 + 5 * cw + 2, y, 46, 12, {"id": "cs_bird", "tip": SimBirds.birdTip(e)})
	y += 16
	var L: Array = SimBirds.candAll(w.cf)
	var ix := {}
	for i in L.size():
		ix[L[i].id] = i
	var key := {}
	for c in L:
		key[c.id] = float(SimBirds.skSeen(c, sk).v) if sk != "" else float(SimBirds.candRank(c))
	if sk != "":
		L.sort_custom(func(a, b): return key[a.id] > key[b.id] or (key[a.id] == key[b.id] and ix[a.id] < ix[b.id]))
	else:
		L.sort_custom(func(a, b): return key[a.id] < key[b.id] or (key[a.id] == key[b.id] and (String(a.name) < String(b.name) or (String(a.name) == String(b.name) and ix[a.id] < ix[b.id]))))
	var rows := floori((Y + HH - 10 - y) / 26.0)
	var sc := _wheel_scroll(w, L.size() - rows)
	if not L.any(func(c): return c.id == w.get("sel")):
		w.sel = L[0].id if not L.is_empty() else -1.0
		w.as = 0
	if L.is_empty():
		para("Никого. Новые люди приезжают просить места на приёмах у трона.", lx + 4, y + 4, LW - 8, DIM, "s", 9)
	for i in range(sc, mini(L.size(), sc + rows)):
		var c: Dictionary = L[i]
		var yy := y + (i - sc) * 26
		var sel: bool = w.sel == c.id
		var st: Variant = SimCourt.seatOf(c)
		var r: Dictionary = SimBirds.birdRec(c)
		rect(lx, yy, LW, 25, P3.sel if sel else (P3.row if (i - sc) % 2 else P3.row2))
		if sel:
			stroke_r(lx, yy, LW, 25, "#c9a060")
		port48(c, lx + 1, yy + 1, 0.5)
		var nx := lx + 29
		if st != null:
			spr_k(String(SimCourt.seatDef(st).ic), nx, yy + 3)
			nx += 10
		tx(fit_t(Sim.charName(c), 196 - (nx - lx) - 4, "s"), nx, yy + 3, Art.pal("y") if st != null else Art.pal("w"), "s")
		var role := SimDyn.seatName(st) if st != null else ("глава дома" if c.role == "lord" else ("рыцарь" if c.role == "knight" else ("учёный" if c.role == "scholar" else "при дворе")))
		var sub := role + " · " + (SimDyn.houseName(c.house) if JS.n(c.get("house", -1)) >= 0 else "без дома") + " · " + SimText.yrs(c.age)
		tx(fit_t(sub, 166, "s"), lx + 29, yy + 13, P3.lab, "s")
		if not SimBirds.isHiddenSpy(c) and SimBirds.spyKnown(c):
			tx("шпион", lx + 196, yy + 13, BAD, "s", "r")
		for j in SKL.size():
			var k: String = SKL[j]
			var z: Dictionary = SimBirds.skSeen(c, k)
			tx(String(z.s), cx0 + j * cw + cw / 2 - 1, yy + 8, (Art.pal("y") if k == sk else sk_col(z.v)) if JS.t(z.kn) else "#a89878", "s", "c")
		_bird_dots(c, r, cx0 + 5 * cw + 6, yy + 10)
		var cid: float = c.id
		hit(lx, yy, LW, 25, {"id": "row_cd" + JS.s(cid), "on": func(_c): _cd_sel(w, cid)})
	if L.size() > rows:
		tx(str(sc + 1) + "–" + str(mini(L.size(), sc + rows)) + " из " + str(L.size()) + " · колесо листает", lx + LW, Y + HH - 9, DIM, "s", "r")
	var c1: Variant = Sim.charOf(w.sel)
	if c1 == null:
		return
	_cand_details(w, c1, e, X, Y, WW, HH)

func _cf_set(w: Dictionary, k: String) -> void:
	w.cf = k
	w.sc = 0

func _cd_sel(w: Dictionary, id: float) -> void:
	w.sel = id
	w.as = 0

## точки пташек (birdDots): узнано из шести, следят ли сейчас
func _bird_dots(c: Dictionary, r: Dictionary, x: float, y: float) -> void:
	var on: bool = (Sim.G.court.get("birdOn", []) as Array).has(c.id)
	if SimBirds.birdFull(c):
		tx("семья", x, y - 1, DIM, "s")
		return
	var lv := int(r.lv)
	for i in 6:
		var f := lv > i
		var nx := lv == i and on
		rect(x + i * 5, y, 4, 4, "#a8c8ff" if f else ("#4a6a90" if nx else "#2a2030"))
		if nx:
			rect(x + i * 5, y + 3, maxf(1, roundf(4 * clampf(JS.n(r.get("p")) / SimBirds.BIRD_NEED[i + 1], 0, 1))), 1, "#e8f0ff")

func _cand_details(w: Dictionary, c: Dictionary, e: Variant, X: float, Y: float, WW: float, HH: float) -> void:
	var C: Dictionary = Sim.G.court
	var rx := X + 410
	var RW := WW - 422
	var r: Dictionary = SimBirds.birdRec(c)
	var lv := int(r.lv)
	var st: Variant = SimCourt.seatOf(c)
	var ry := Y + 41
	port48(c, rx, ry)
	stroke_r(rx - 1, ry - 1, 50, 50, "#c9a060")
	tx(fit_t(Sim.charName(c), RW - 54, "s"), rx + 54, ry, Art.pal("w"), "s")
	tx(fit_t((house_s(c) + " · " if JS.n(c.get("house", -1)) >= 0 else "") + SimText.yrs(c.age), RW - 54, "s"), rx + 54, ry + 10, P3.lab, "s")
	var where := SimDyn.seatName(st) if st != null else ("в свите короля" if JS.t(c.get("withKing")) else ("командует войском" if SimPlayer.armyOfGen(c.id) != null else ("при дворе" if JS.t(c.get("atCourt")) else "в своём замке")))
	tx(fit_t(where, RW - 54, "s"), rx + 54, ry + 20, Art.pal("y") if st != null else P3.lab, "s")
	var on: bool = (C.get("birdOn", []) as Array).has(c.id)
	spr_k("i_bird", rx + 54, ry + 32)
	tx("пташки знают всё" if lv >= 6 else "пташки: " + str(lv) + " из 6" + ("" if on else " · ждёт"), rx + 64, ry + 31, "#a8c8ff" if on else Art.pal("w"), "s")
	if lv < 6:
		bar(rx + 54, ry + 41, RW - 56, 5, JS.n(r.get("p")) / SimBirds.BIRD_NEED[lv + 1], "#a8c8ff" if on else "#5a6a80")
	var btip: Array
	if e != null and e.id == c.id:
		btip = ["Око короля", "За самим Оком пташки не следят — это его люди."]
	else:
		btip = ["Пташки: " + ("всё, что можно, уже узнано" if lv >= 6 else "узнано " + str(lv) + " из 6 — " + String(SimBirds.BIRD_LV[lv])), ("Дальше: " + String(SimBirds.BIRD_LV[lv + 1]) + ".") if lv < 6 else "Советников пташки проверяют и дальше.",
			{"t": "Сейчас за ним следят.", "c": "#a8c8ff"} if on else {"t": "Сейчас пташки заняты другими — очередь дойдёт." if e != null else "Ока нет — никто не следит.", "c": DIM}]
	hit(rx + 52, ry + 29, RW - 52, 18, {"id": "cd_bird", "tip": btip})
	ry += 54
	tx("Навыки", rx, ry, Art.pal("y"), "s")
	for i in SKL.size():
		var k: String = SKL[i]
		var z: Dictionary = SimBirds.skSeen(c, k)
		var s := skn(k) + " " + String(z.s)
		var xx := rx + (i % 3) * 64
		var yy := ry + 10 + (i / 3) * 10
		tx(s, xx, yy, sk_col(z.v) if JS.t(z.kn) else "#a89878", "s")
		hit(xx - 1, yy - 1, 62, 10, {"id": "cd_sk" + k, "tip": [skn(k) + " — " + String(Sim.T.SKD[k]), "Известно точно." if float(z.kn) == 2.0 or JS.t(z.get("ex")) else ("Оценка пташек: ±" + JS.s(JS.n(r.get("err"))) + "." if JS.t(z.kn) else "На глаз — может обмануть: многие хвалятся.")]})
	ry += 32
	var ts: Dictionary = SimBirds.traitsSeen(c)
	tx("Нрав", rx, ry, Art.pal("y"), "s")
	ry += 10
	ry += para(String(ts.s) + ("" if JS.t(ts.all) else " (пташки донесут больше)"), rx, ry, RW, "#e8c890", "s", 9) + 3
	var ls: Dictionary = SimPlayer.loySeen(c)
	tx("Верность", rx, ry, Art.pal("y"), "s")
	tx(fit_t(String(ls.s), RW - 52, "s"), rx + 52, ry, BAD if ls.v < 35 else (GOOD if ls.v > 65 else Art.pal("w")), "s")
	ry += 12
	var mo: Variant = SimBirds.motiveSeen(c)
	tx("Мотив", rx, ry, Art.pal("y"), "s")
	if mo != null:
		tx(String(mo.n), rx + 52, ry, BAD if mo == SimBirds.MOTIVES.revenge or mo == SimBirds.MOTIVES.foe else "#e8dcc0", "s")
		ry += 10
		ry += para(String(mo.d), rx, ry, RW, P3.lab, "s", 9) + 3
	else:
		tx("—" if SimBirds.birdFull(c) else "скрыт", rx + 52, ry, DIM, "s")
		ry += 12
	var S: Array = (C.secrets as Array).filter(func(s): return JS.t(s.get("known")) and (s.who as Array).has(c.id))
	tx("Тайны", rx, ry, Art.pal("y"), "s")
	if not S.is_empty():
		ry += 10
		for s in S.slice(0, 2):
			ry += para(SimCourt.secretText(s), rx, ry, RW, BAD, "s", 9) + 2
	else:
		tx("не найдено" if lv >= 6 else "неизвестно", rx + 52, ry, DIM, "s")
		ry += 12
	var by := Y + HH - 22
	var sp: Variant = SimBirds.spySecret(c)
	if sp != null and JS.t(sp.get("known")) and not JS.t(sp.get("fed")):
		sbtn("cd_grab", rx, by - 16, RW, "Схватить шпиона", func(_c): _grab_spy(w, c, sp), {"tip": ["В темницу", "Шпион больше не навредит; его дом смущён."]})
		sbtn("cd_feed", rx, by, RW, "Кормить его ложью", func(_c): _feed_spy(sp), {"tip": ["Двойная игра (гл. 13)", "Враг будет считать нас сильнее, чем мы есть, а наших осведомителей шпион больше не выдаст."]})
		return
	var away: bool = JS.t(c.get("withKing")) or SimPlayer.armyOfGen(c.id) != null
	if int(w.get("as", 0)):
		for i in Sim.SEATS.size():
			var s: Dictionary = Sim.SEATS[i]
			var occ: bool = C.seats.get(s.k) == c.id
			var oc: Variant = SimDyn.seatChar(s.k)
			var tp: Array = [String(s.n) + ": " + skn(s.sk) + " " + String(SimBirds.skSeen(c, s.sk).s), ("Сейчас: " + String(oc.name) + " (" + skn(s.sk) + " " + String(SimBirds.skSeen(oc, s.sk).s) + ") — будет снят и обидится.") if oc != null else "Место пустует."]
			var sk0: String = s.k
			btn("cd_s" + sk0, rx + (i % 2) * (RW / 2 + 1), by - 48 + (i / 2) * 14, RW / 2 - 1, 12, {"label": s.n, "style": "wood" if occ else "dark", "disabled": away or occ, "tip": tp, "on": func(_c): _cd_appoint(w, sk0, c)})
		sbtn("cd_back", rx + RW / 2 + 1, by - 48 + 3 * 14, RW / 2 - 1, "Назад", func(_c): w.as = 0)
		return
	sbtn("cd_app", rx, by, RW / 2 - 1, "Назначить…", func(_c): w.as = 1, {"disabled": away, "tip": "Он сейчас в походе." if away else "Выбрать место в совете"})
	sbtn("cd_dos", rx + RW / 2 + 1, by, RW / 2 - 1, "Досье (10 зол.)", func(_c): _dossier(c), {"disabled": e == null, "tip": ["Поручить Оку досье", "За 6 дней — верность, честолюбие и честность; иногда и тайны."] if e != null else "Ока нет"})

func _cd_appoint(w: Dictionary, k: String, c: Dictionary) -> void:
	SimCourt.appointSeat(k, c.id)
	w.as = 0
	appointed(k)

func _grab_spy(w: Dictionary, c: Dictionary, sp: Dictionary) -> void:
	var G := Sim.G
	var k: Variant = SimCourt.seatOf(c)
	if k != null:
		SimCourt.dismissSeat(k, "шпион")
	c.prison = 0.0
	c.atCourt = 0.0
	sp.done = 1.0
	G.court.secrets = (G.court.secrets as Array).filter(func(x): return x != sp)
	SimCourt.prestige(2)
	if JS.n(c.get("house", -1)) >= 0 and int(c.house) < G.houses.size():
		SimPlayer.houseLoy(G.houses[int(c.house)], -4)
	Sim.glog("Шпион державы " + Sim.realmName(sp.realm) + " " + String(c.name) + " схвачен" + ("а" if JS.t(c.get("fem")) else "") + ".", "good")
	w.sel = -1.0

func _feed_spy(sp: Dictionary) -> void:
	var G := Sim.G
	sp.fed = 1.0
	G.realms[int(sp.realm)].misled = G.day + 90
	Sim.glog("Шпиону державы " + Sim.realmName(sp.realm) + " подсовывают ложные донесения.", "good")

func _dossier(c: Dictionary) -> void:
	if SimCourt.giveOrder("eye", "dossier", "intent", c.id):
		toast("Око собирает досье на " + String(c.name) + ".")
	tick_toasts()


# ---------- письма (drawLettersWin, openLetter) ----------
func _letters_win(w: Dictionary) -> void:
	var X := 60.0
	var Y := 26.0
	var WW := 520.0
	var HH := 312.0
	var C: Dictionary = Sim.G.court
	win_frame(X, Y, WW, HH, "Письма и донесения", true)
	var now_d: float = Sim.G.day + JS.n(Sim.G.get("frac"))
	var L: Array = (C.letters as Array).filter(func(l): return float(l.arr) <= now_d)
	var way: int = (C.letters as Array).size() - L.size()
	var y := Y + 24
	var sc := _wheel_scroll(w, L.size() - 12)
	if L.is_empty():
		tx("Писем нет.", X + 16, y, INK2)
	for i in range(sc, mini(L.size(), sc + 12)):
		var l: Dictionary = L[i]
		var yy := y + (i - sc) * 22
		var rd: bool = JS.t(l.get("read"))
		rect(X + 10, yy, WW - 20, 20, "rgba(0,0,0,0.03)" if rd else "rgba(200,140,40,0.18)")
		spr_k("i_scroll", X + 14, yy + 5)
		tx(fit_t(String(l.subj), WW - 120), X + 26, yy + 2, INK2 if rd else INK)
		tx(fit_t(String(l.from) + " · " + SimText.dateStr(l.day), WW - 120, "s"), X + 26, yy + 12, INK2, "s")
		if JS.t(l.get("ch")) and not JS.t(l.get("answered")):
			tx("ждёт ответа", X + WW - 16, yy + 7, "#a03020", "s", "r")
		hit(X + 10, yy, WW - 20, 20, {"id": "row_l" + JS.s(JS.n(l.get("id"))), "on": func(_c): _letter_click(l)})
	if way > 0:
		var cs := roundi(SimDyn.courierSpeed())
		tx("Ещё " + str(way) + " " + Sim.plural(way, "письмо", "письма", "писем") + " в пути (гонец проходит ≈" + str(cs) + " " + Sim.plural(cs, "клетку", "клетки", "клеток") + " карты в день).", X + 16, Y + HH - 14, INK2, "s")

func _letter_click(l: Dictionary) -> void:
	win = null
	open_letter(l)

func open_letter(l: Dictionary) -> void:
	if String(l.get("dyn", "")) == "welcome":
		l.text = SimDyn.welcomeText()
	l.read = 1.0
	var ch: Array = []
	if l.get("ch") is Array and not JS.t(l.get("answered")):
		for c0 in l.ch:
			var c1: Dictionary = c0.duplicate()
			var f0: Variant = c0.get("fx")
			c1.fx = func():
				l.answered = 1.0
				if f0 is Callable:
					(f0 as Callable).call()
			ch.append(c1)
	say(null, String(l.get("text", "")), {"name": "✉ " + String(l.subj) + " — " + String(l.from), "choices": ch})
	print("LETTER ", l.subj)


# ---------- вести (UI.modals) ----------
## война объявлена (drawWarModal)
func _war(m: Dictionary) -> void:
	var r: int = m.d
	var ru: Variant = SimDay.rulerOf(r)
	var pr: float = Sim.G.player.realm
	var p := dlg_box(380, 170, "Война!")
	var x := p.x
	var y := p.y
	port48(ru, x + 14, y + 26)
	shield(r, x + 26, y + 78)
	tx((String(ru.get("title", "")) + " " + String(ru.name)).strip_edges() + " объявляет войну!", x + 72, y + 26, "#a0302a")
	para("Держава " + Sim.realmName(r) + " " + SimDay.rV(r, "идёт", "идёт", "идут") + " на нас. Их сила: ~" + SimArmy.fmt(SimAI.realmPower(r, pr)) + ", наша: " + SimArmy.fmt(SimAI.realmPower(pr)) + ".\n«Не надейся, что враг не придёт, — надейся на то, что ты готов его встретить» (гл. 8).", x + 72, y + 40, 294, INK)
	btn("wm_ok", x + 20, y + 140, 160, 16, {"label": "К оружию!", "on": func(_c): close_modal()})
	btn("wm_d", x + 200, y + 140, 160, 16, {"label": "Дипломатия", "disabled": true, "tip": ["Дипломатия", {"t": "Окно дипломатии — в следующих версиях.", "c": DIM}]})

## событие с выбором (drawEventModal): d = {e: {title, ic, opts: [{t, tip, ok: Callable, fx: Callable, win}]}, text}
func _event(m: Dictionary) -> void:
	var e: Dictionary = m.d.e
	var lines := wrap_text(String(m.d.text), 330)
	var opts: Array = e.opts
	var h := maxf(150, 60 + lines.size() * 10 + opts.size() * 19)
	var p := dlg_box(420, h, String(e.title))
	var x := p.x
	var y := p.y
	spr_k("i_" + String(e.ic), x + 20, y + 30, 4.0)
	for i in lines.size():
		tx(lines[i], x + 66, y + 26 + i * 10, INK)
	for i in opts.size():
		var o: Dictionary = opts[i]
		var ok: bool = not (o.get("ok") is Callable) or bool((o.ok as Callable).call())
		btn("ev" + str(i), x + 20, y + h - 22 - (opts.size() - 1 - i) * 19, 380, 15, {"label": o.t, "disabled": not ok, "tip": o.get("tip"), "on": func(_c): ev_pick(o)})

func ev_pick(o: Dictionary) -> void:
	close_modal()
	if o.get("fx") is Callable:
		(o.fx as Callable).call()
	if String(o.get("win", "")) == "tech":
		# окна «Знаний» ещё нет: исследования — у магистра в Малом совете
		open_council("magister", "research" if SimDyn.seatChar("magister") != null else "")

## Совет короны (drawCouncilModal): кто за кого голосовал
func _crown(m: Dictionary) -> void:
	var v: Array = m.d
	var pr: float = Sim.G.player.realm
	var n := v.filter(func(e): return e.c == pr).size()
	var p := dlg_box(460, 200, "Совет короны · зима " + JS.s(Sim.yearOf(Sim.G.day)) + " года")
	var x := p.x
	var y := p.y
	for i in v.size():
		var e: Dictionary = v[i]
		var xx := x + 14 + i * 88
		port48(SimDay.rulerOf(int(e.x)), xx + 10, y + 26)
		tx(String(Sim.REALM_DEF[int(e.x)].name), xx + 34, y + 78, INK, "s", "c")
		tx("→", xx + 34, y + 89, INK2, "m", "c")
		shield(e.c, xx + 29, y + 99)
		tx(String(Sim.REALM_DEF[int(e.c)].name), xx + 34, y + 114, "#2a6a2a" if e.c == pr else INK, "s", "c")
	var ru: Dictionary = SimDay.rulerOf(int(pr))
	para("Совет признал короля " + String(ru.name) + " Верховным королём!" if n >= 3 else "За короля " + String(ru.name) + " — " + str(n) + " из " + str(v.size()) + ". Нужно 3. Мнение правителей, слава и страх решают голоса. Совет соберётся снова следующей зимой.", x + 14, y + 132, 432, INK, "m", 10)
	btn("cm_ok", x + 150, y + 172, 160, 16, {"label": "Да будет так", "on": func(_c): close_modal()})

func close_modal() -> void:
	if not modals.is_empty():
		modals.pop_front()
		Snd.sfx("click")

func alert(k: String, d: Variant) -> void:
	for m in modals:
		if m.k == k and typeof(m.d) == typeof(d) and m.d == d:
			return
	modals.append({"k": k, "d": d})

## весть королевства, что касается двора (UI.alert): событие, война, Совет короны; true — взята
func court_alert(e: Dictionary) -> bool:
	match String(e.k):
		"ev":
			alert("event", {"e": e.e, "text": e.get("text", "")})
		"council":
			alert("council", e.v)
		"war":
			alert("war", int(e.r))
		"msg":
			var o: Dictionary = e.m
			toast("Гонец с письмом: " + String(o.get("text", "")).left(120))
		_:
			return false
	return true
