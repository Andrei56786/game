extends "res://scripts/ui_kit.gd"
## Основа окон карты (map_ui.gd): что открыто, состояние окон, приборы рисования (подписи, рамки, вкладки, портреты, гербы,
## всплывающая строка, «Идёт бой…») и окно «Войска короны» (drawCmdWin из screens3.js: войска, приказы с гонцами, смена
## командира, роспуск). Остальные окна и ввод — в map_ui.gd (наследует эту основу).
signal battle(A, Bs, tile, o)
signal to_court(spot)
signal mode_changed

const People = preload("res://scripts/people.gd")
const UICON := {"levy": "i_men", "spear": "i_shield", "sword": "i_sword", "archer": "i_bow", "xbow": "i_xbow", "horse": "i_horse", "harch": "i_harch", "knight": "i_knight"}
# девять местностей (Сунь-цзы, гл. 11; army.js: GROUNDS)
const GROUNDS := {"dispersive": {"n": "Рассеивающая", "q": "На рассеивающей земле не сражайся.", "e": "Своя земля: воины думают о доме. Дезертирство ×2, боевой дух в бою −5."},
	"facile": {"n": "Лёгкая", "q": "На лёгкой земле не останавливайся.", "e": "Неглубоко в чужой земле: стоянка здесь −1 к духу в день."},
	"contentious": {"n": "Спорная", "q": "На спорной земле не нападай.", "e": "Выгодная позиция (холм, брод, мост, перевал): обороняющийся +20% в бою."},
	"open": {"n": "Открытая", "q": "На открытой земле не преграждай пути.", "e": "Равнина: конница +10% в бою."},
	"intersecting": {"n": "Перекрёсточная", "q": "На перекрёсточной земле заключай союзы.", "e": "Стык трёх держав: предложения союза и мира +15."},
	"serious": {"n": "Тяжёлая", "q": "На тяжёлой земле грабь.", "e": "Глубоко в земле врага: войско сплочено (дезертирства нет, дух +5), фуражировка +50%."},
	"difficult": {"n": "Труднопроходимая", "q": "На труднопроходимой земле иди без остановки.", "e": "Лес, болото, горы: стоянка утомляет, болезни ×1.5."},
	"hemmed": {"n": "Окружённая", "q": "На окружённой земле прибегай к хитрости.", "e": "Теснина: засада здесь страшна. Атакующий из укрытия +30%."},
	"death": {"n": "Смертельная", "q": "На смертельной земле сражайся.", "e": "Враги вокруг: в бою боевой дух +25, бегство позже."}}
const SETT_T := {"village": "Деревня", "castle": "Замок", "town": "Город", "capital": "Столица"}
const SETT_ACC := {"village": "деревню", "castle": "замок", "town": "город", "capital": "столицу"}
const WALLS := ["нет", "частокол", "камень", "мощные"]
const TYPE_P := {"village": "Деревня кормит округу: здесь можно купить провиант и фураж и набрать ополченцев.",
	"castle": "Замок — опора власти в провинции: копейщики, латники, всадники. Стены задержат любого врага.",
	"town": "Город — торговля: стрелы, оружие, повозки, смола. Много ополчения.",
	"capital": "Столица державы. Падение столицы потрясает всю державу. Две чужие столицы и своя — победа мечом."}
const P3 := {"lab": "#c8b898", "sel": "#5a4030", "row": "rgba(255,255,255,0.045)", "row2": "rgba(0,0,0,0.14)", "hi": "#fff2c8"}
const GOOD := "#9fe07a"
const BAD := "#ee7a6a"
const WARN := "#f7d35c"
const DIM := "#9a8a70"
const CARD_MODES := [["march", "i_flag"], ["camp", "i_tent"], ["fort", "i_shield"], ["hide", "i_eye"], ["forage", "i_fodder"], ["drill", "i_sword"]]

var mv                      # MapView (в проверках без экрана — null)
var modals: Array = []      # UI.modals: [{k, d}] — на экране первое
var win = null              # UI.win: {k: "cmd", sel, mode, pick, app, sc} или {k: "sett", id, tab}
var target = null           # UI.target: {kind: "cmd", army, o, mode} — цель приказа указывают на карте
var busy := ""              # идёт бой без экрана (автобой): окна ждут
var wheel := 0              # колесо мыши в этом кадре (списки окон)
var n_draw := 0             # для проверок: кадров нарисовано


# ---------- что открыто ----------
func is_open() -> bool:
	return not modals.is_empty() or win != null or dlg != null or busy != ""

## окно-весть, разговор или бой без экрана: встречи не проверяются, клавиши карты не работают (UI.modalOpen)
func modal_open() -> bool:
	return not modals.is_empty() or dlg != null or busy != ""

## точка под окном или карточкой войска: щелчок — сюда, а не карте
func capture(p: Vector2) -> bool:
	return is_open() or top_hit(last_hits, p) != null

func toast(s: String) -> void:
	toast_s = s
	toast_t = now() + 2.6


# ---------- приборы рисования ----------
func tx(s: String, x: float, y: float, c: Variant, f := "m", al := "l", sh = null) -> float:
	return txt(s, x, y, col(c), f, al, sh)

func kv(x: float, y: float, k: String, v: String, parch: bool, vc: Variant = null) -> void:
	tx(k, x, y, INK2 if parch else "#c8b898")
	tx(v, x + tw(k) + 4, y, vc if vc != null else (INK if parch else Art.pal("w")))

func sbtn(id: String, x: float, y: float, w: float, label: String, on: Callable, o: Dictionary = {}) -> bool:
	var q := o.duplicate()
	q.label = label
	q.on = on
	if not q.has("style"):
		q.style = "wood"
	return btn(id, x, y, w, 12, q)

## рамка окна (winFrame): затемнение, дерево или пергамент, заголовок, крестик
func win_frame(x: float, y: float, w: float, h: float, title: String, parch: bool, no_close := false) -> void:
	blocker()
	dim(0.45)
	if parch:
		panel_parch(x, y, w, h)
	else:
		panel_wood(x, y, w, h)
	if title != "":
		if parch:
			tx(title, x + w / 2.0, y + 7, INK, "m", "c")
			hline(x + 10, y + 17, w - 20, "#b89a68")
		else:
			tx(title, x + w / 2.0, y + 8, Art.pal("y"), "m", "c", PO)
	if not no_close:
		btn("w_close", x + w - 17, y + 4, 13, 12, {"ic": "i_close", "style": "dark", "tip": "Закрыть (Esc)", "on": func(_c): win = null})

func tabs(x: float, y: float, list: Array, w: float) -> void:
	for i in list.size():
		btn("tab" + str(i), x + i * (w + 2), y, w, 13, {"label": list[i], "style": "parch", "active": int(win.get("tab", 0)) == i, "on": func(_c): win.tab = i})

## лицо 48×48 (drawPortrait): короля — его, прочих — по народу и зерну (как лица на карточках полков)
func port_i(c: Variant) -> int:
	if not (c is Dictionary):
		return -1
	if not Sim.G.is_empty() and c.get("id") == Sim.G.player.char:
		return int(Art.D.get("king", {}).get("port", -1))
	# лицо из выгрузки по id (как portrait в HTML), пока облик не сменился с возрастом; иначе — по державе
	var e: Variant = (Art.D.get("cspr", {}) as Dictionary).get(JS.s(c.get("id")))
	if e is Array and int(e[1]) >= 0 and String(e[2]) == People.age_key(JS.n(c.get("age"))):
		return int(e[1])
	var cul := String(c.get("cul", ""))
	var r := 6
	for i in Sim.REALM_DEF.size():
		if String(Sim.REALM_DEF[i].key) == cul:
			r = i
			break
	var L: Array = Art.D.get("capts48f" if JS.t(c.get("fem")) and Art.D.has("capts48f") else "capts48", [])
	if r >= L.size() or (L[r] as Array).is_empty():
		return -1
	return int(L[r][posmod(int(JS.n(c.get("id"))) * 7 + 3, (L[r] as Array).size())])

func port48(c: Variant, x: float, y: float, sc := 1.0) -> void:
	var p := port_i(c)
	if p >= 0:
		spr(p, x, y, sc)
	else:
		rect(x, y, 48 * sc, 48 * sc, "#22170f")

func shield(r: Variant, x: float, y: float, sc := 1.0) -> void:
	spr_k("shield" + str(int(JS.n(r))), x, y, sc)

func _wheel_scroll(w: Dictionary, mx: int) -> int:
	if wheel != 0 and hover != null and (String(hover.get("id", "")) == "blocker" or String(hover.get("id", "")).begins_with("row")):
		w.sc = clampi(int(w.get("sc", 0)) + (1 if wheel > 0 else -1), 0, maxi(0, mx))
	w.sc = clampi(int(w.get("sc", 0)), 0, maxi(0, mx))
	return w.sc

func _toast() -> void:
	if toast_t <= now():
		return
	var a := clampf((toast_t - now()) * 3.0, 0.0, 1.0)
	var ls := wrap_text(toast_s, 380)
	var w := 0.0
	for l in ls:
		w = maxf(w, tw(l))
	w += 16.0
	var h := ls.size() * 10.0 + 5.0
	var y := H - 46.0 - h if is_open() else 40.0
	box(W / 2.0 - w / 2.0 - 1, y - 1, w + 2, h + 2, Color(PO, a))
	box(W / 2.0 - w / 2.0, y, w, h, Color(0.125, 0.086, 0.063, 0.96 * a))
	stroke(W / 2.0 - w / 2.0, y, w, h, Color(0.79, 0.63, 0.38, a))
	for i in ls.size():
		txt(ls[i], W / 2.0, y + 3 + i * 10, Color(0.97, 0.83, 0.36, a), "m", "c")

func _busy() -> void:
	blocker()
	dim(0.3)
	var w := tw(busy) + 30.0
	var x := roundf(W / 2.0 - w / 2.0)
	var y := roundf(H / 2.0 - 10)
	panel_wood(x, y, w, 20)
	var dots := ".".repeat(1 + int(now() * 3) % 3)
	tx(busy.trim_suffix("…") + dots, x + 15, y + 7, Art.pal("y"), "m", "l", PO)



const RICH_N := [["food", "хлеб"], ["horse", "кони"], ["wood", "лес"], ["iron", "руда"], ["wool", "шерсть"], ["salt", "соль"], ["wine", "вино"]]
const SETT_N := {"village": "деревня", "castle": "замок", "town": "город", "capital": "столица"}

# ---------- войска короны (drawCmdWin) ----------
static func mode_tip(m: String) -> Array:
	if m == "order":
		return ["Приказ — исполнить в точности, как сказано.", "Надёжно с неумелыми. Умелых (навык 13+) мелочная опека злит.", {"t": "Канцелярия: обида втрое меньше." if SimDyn.hasTech("chancery") else "Изучите «Канцелярию», чтобы смягчить обиды.", "c": DIM}]
	return ["Замысел — объяснить цель, а средства оставить исполнителю.", "Умелые справятся лучше, неумелые — хуже.", {"t": "«Побеждает тот, у кого полководец способен, а государь не вмешивается» (гл. 3).", "c": "#e8d8b0"}]

static func trait_tip(c: Dictionary) -> Array:
	return (c.traits as Array).map(func(t): return String(Sim.TRAITS[t].n) + ": " + String(Sim.TRAITS[t].d) if Sim.TRAITS.has(t) else String(t))

static func traits_s(c: Dictionary) -> String:
	return ", ".join((c.traits as Array).map(func(t): return String(Sim.TRAITS[t].n) if Sim.TRAITS.has(t) else String(t)))

func _cmd_win(w: Dictionary) -> void:
	var X := 14.0
	var Y := 21.0
	var WW := 612.0
	var HH := 326.0
	win_frame(X, Y, WW, HH, "Войска короны", false)
	var L := SimPlayer.crownArmies()
	var pa: Variant = Sim.playerArmy()
	if JS.n(w.get("sel", -1)) < 0 or Sim.armyById(w.sel) == null:
		w.sel = L[0].id if not L.is_empty() else (pa.id if pa != null else -1.0)
	var y := Y + 24
	var rows: Array = ([pa] if pa != null else []) + L
	var sc := _wheel_scroll(w, rows.size() - 7)
	var ps: Variant = w.get("preset")
	if ps is Dictionary:
		rect(X + 10, y, 204, 12, "#22408a")
		tx("Кому: «" + String(SimCmd.CMD[ps.o].n) + " · " + String(Sim.W.setts[int(ps.t)].name) + "»?", X + 14, y + 2, P3.hi, "s")
		y += 14
	for i in range(sc, mini(rows.size(), sc + 7)):
		var a: Dictionary = rows[i]
		var yy := y + (i - sc) * 41
		var g: Variant = Sim.charOf(a.gen)
		var sel: bool = w.sel == a.id
		var isP: bool = a.kind == "player"
		rect(X + 10, yy, 204, 39, P3.sel if sel else (P3.row if (i - sc) % 2 else P3.row2))
		if sel:
			stroke_r(X + 10, yy, 204, 39, "#c9a060")
		if g != null:
			port48(g, X + 13, yy + 3, 0.5)
		tx("Войско короля" if isP else (Sim.charName(g) if g != null else "—"), X + 42, yy + 3, Art.pal("y") if isP else Art.pal("w"), "s")
		tx(SimArmy.fmt(Sim.armyMen(a)), X + 210, yy + 3, Art.pal("y"), "s", "r")
		var nr := SimDay.settNear(a.x, a.y, 3)
		spr_k("i_pin", X + 42, yy + 12)
		tx((String(Sim.W.setts[nr].name) if nr >= 0 else "в поле") + (" · осада" if a.mode == "siege" else (" · в пути" if a.path != null else "")), X + 51, yy + 13, P3.lab, "s")
		tx("под вашей рукой" if isP else SimCmd.ordLabel(a.get("cmd")), X + 42, yy + 23, WARN if JS.t(a.get("pend")) else "#e8dcc0", "s")
		if JS.t(a.get("pend")):
			tx("гонец в пути", X + 210, yy + 23, WARN, "s", "r")
		hit(X + 10, yy, 204, 39, {"id": "row_ar" + JS.s(a.id), "tip": "Войско, которое ведёт сам король" if isP else null, "on": func(_c): _cmd_row(a, isP)})
	if rows.is_empty():
		para("У короны нет войск в поле. Маршал может набрать рекрутов или созвать знамёна знатных домов.", X + 14, y, 196, DIM, "s", 9)
	if SimDyn.seatChar("marshal") != null:
		sbtn("cm_mus", X + 10, Y + HH - 20, 204, "Созвать знамёна (маршал)…", func(_c): pass, {"disabled": true, "tip": ["Созвать знамёна", "Малый совет и его поручения — в следующих версиях."]})
	var a0: Variant = Sim.armyById(w.sel)
	if a0 == null:
		return
	var a: Dictionary = a0
	var x0 := X + 224
	var wR := WW - 236
	y = Y + 24
	var g: Variant = Sim.charOf(a.gen)
	if g != null:
		port48(g, x0, y)
		stroke_r(x0 - 1, y - 1, 50, 50, "#c9a060")
	tx("Войско короля" if a.kind == "player" else (Sim.charName(g) if g != null else "Без командира"), x0 + 56, y, Art.pal("y"))
	if g != null:
		tx(traits_s(g) + " · Меч " + JS.s(JS.n(g.get("mar"))), x0 + 56, y + 11, "#e8c890", "s")
		hit(x0 + 56, y + 10, 200, 9, {"id": "cm_tr", "tip": trait_tip(g)})
		var F := SimPlayer.faultsOf(g)
		if not F.is_empty():
			var f: Dictionary = SimPlayer.FAULTS[F[0]]
			tx("Опасно: " + String(f.n).to_lower() + " — " + String(f.d), x0 + 56, y + 21, WARN, "s")
			hit(x0 + 56, y + 20, 250, 9, {"id": "cm_f", "tip": ["Пять опасных качеств полководца (гл. 8)", f.q, "Такой командир " + String(f.d) + ". Учитывайте это, отдавая приказ."]})
		else:
			tx("Опасных качеств не замечено.", x0 + 56, y + 21, GOOD, "s")
		if a.kind != "player":
			var ls := SimPlayer.loySeen(g)
			tx("Верность: " + String(ls.s), x0 + 56, y + 31, BAD if ls.v < 35 else Art.pal("w"), "s")
	y += 52
	var xx := x0
	var ul: Array = Sim.UT.filter(func(t): return JS.n(a.u.get(t)) > 0)
	var usp := maxf(26, minf(40, floorf((wR - 130) / maxf(1, ul.size()))))
	for t in ul:
		spr_k(UICON[t], xx, y + 1)
		tx(JS.s(JS.rnd(a.u[t])), xx + 9, y, Art.pal("w"), "s")
		hit(xx, y, usp - 2, 9, {"id": "cmu" + t, "tip": String(Sim.UNIT[t].n)})
		xx += usp
	var eat := Sim.armyMen(a) + JS.n(a.get("wounded")) + JS.n(a.get("sick"))
	tx("Дух " + JS.s(JS.rnd(a.morale)) + " · провиант на " + JS.s(floorf(a.food / maxf(1, eat))) + " дн.", x0 + wR, y, P3.lab, "s", "r")
	y += 13
	if a.kind == "player":
		para("Этим войском вы командуете сами — прямо на карте. Чтобы отдать его рыцарю, вернитесь в замок: войско останется у стен под началом рыцаря.", x0, y, wR, "#e8dcc0", "s", 9)
		return
	tx("Приказ: " + SimCmd.ordLabel(a.get("cmd")), x0, y, Art.pal("w"), "s")
	if JS.t(a.get("pend")):
		var cr: Variant = null
		for c in Sim.G.get("couriers", []):
			if c.to == a.id:
				cr = c
				break
		tx("Гонец с новым приказом ещё ≈" + ("%.1f" % (JSM.hypot(a.x - cr.x, a.y - cr.y) / SimDyn.courierSpeed()) if cr != null else "?") + " дн. в пути", x0 + wR, y, WARN, "s", "r")
	y += 12
	var kp := SimDyn.kingPos()
	var dk := JSM.hypot(a.x - kp[0], a.y - kp[1])
	var cd := dk / SimDyn.courierSpeed()
	tx("До войска " + SimPlayer.kmTxt(dk * SimPlayer.KM_PER_TILE) + " · гонец ≈" + (str(maxi(1, roundi(cd * 24))) + " ч." if cd < 1 else "%.1f дн." % cd) + (" (почтовые станции)" if SimDyn.hasTech("posts") else ""), x0, y, P3.lab, "s")
	y += 12
	tx("Как приказать:", x0, y + 3, P3.lab, "s")
	var hw := floorf(140 / 2.0) - 1
	btn("md_o", x0 + 70, y, hw, 13, {"label": "Приказ", "active": w.mode == "order", "tip": mode_tip("order"), "on": func(_c): w.mode = "order"})
	btn("md_i", x0 + 70 + hw + 2, y, hw, 13, {"label": "Замысел", "active": w.mode == "intent", "tip": mode_tip("intent"), "on": func(_c): w.mode = "intent"})
	y += 18
	if String(w.get("pick", "")) != "":
		var pk: String = w.pick
		var d: Dictionary = SimCmd.CMD[pk]
		var T := SimPlayer.cmdTargets(d.tgt, a)
		tx("Цель: «" + String(d.n) + "»", x0, y, Art.pal("y"))
		sbtn("cm_map", x0 + wR - 150, y - 2, 86, "Указать на карте", func(_c): _cmd_map(a, pk, d))
		sbtn("cm_back", x0 + wR - 60, y - 2, 60, "Назад", func(_c): w.pick = "")
		y += 14
		if T.is_empty():
			tx("Подходящих целей нет" + (" (нужна война или вольные земли)" if d.tgt == "foe" else "") + ".", x0, y, DIM, "s")
		for i in T.size():
			var t: Dictionary = T[i]
			var cx := x0 + (i % 2) * (wR / 2 + 2)
			var cy := y + (i / 2) * 15
			if cy > Y + HH - 18:
				continue
			var days: float = t.d / (SimPlayer.BASE_SPEED * 0.8)
			btn("cm_t" + str(i), cx, cy, wR / 2 - 2, 13, {"label": String(t.n) + " · " + SimPlayer.kmTxt(t.d * SimPlayer.KM_PER_TILE) + ", " + str(maxi(1, roundi(days))) + " дн.",
				"on": func(_c): _cmd_send(a, {"o": pk, "t": t.id, "mode": w.mode})})
		return
	if int(w.get("app", 0)):
		_cmd_app(w, a, x0, y, wR)
		return
	for i in SimPlayer.OB.size():
		var k: String = SimPlayer.OB[i][0]
		var tg: String = SimPlayer.OB[i][1]
		var d: Dictionary = SimCmd.CMD[k]
		btn("cm_o" + k, x0 + (i % 3) * (wR / 3 + 1), y + (i / 3) * 16, wR / 3 - 2, 14, {"label": String(d.n) + ("…" if tg != "" else ""), "tip": [d.n, SimPlayer.CMD_D[k]],
			"on": func(_c): _cmd_ob(w, a, k, tg)})
	y += ceili(SimPlayer.OB.size() / 3.0) * 16 + 4
	para("«Кто знает, когда сражаться, а когда нет, — побеждает» (гл. 3). Приказ идёт с гонцом: пока он скачет, обстановка может измениться.", x0, y, wR, "#a89878", "s", 9)
	sbtn("cm_app", x0, Y + HH - 20, 120, "Сменить командира…", func(_c): w.app = 1)
	sbtn("cm_dis", x0 + 126, Y + HH - 20, 110, "Распустить войско", func(_c): _cmd_disband(a))

## строка войска: с приказом из сведений о поселении (preset) — гонец сразу везёт его
func _cmd_row(a: Dictionary, isP: bool) -> void:
	var ps: Variant = win.get("preset")
	if ps is Dictionary and not isP:
		var o: Dictionary = ps.duplicate()
		o.mode = win.mode
		SimPlayer.sendOrder(a, o)
		win.preset = null
	_cmd_sel(a.id)

func _cmd_sel(id: float) -> void:
	win.sel = id
	win.pick = ""
	win.app = 0

func _cmd_ob(w: Dictionary, a: Dictionary, k: String, tg: String) -> void:
	if tg != "":
		w.pick = k
		return
	_cmd_send(a, {"o": k, "t": Sim.G.realms[0].capital if k == "ret" else -1.0, "mode": w.mode})

func _cmd_send(a: Dictionary, ord: Dictionary) -> void:
	SimPlayer.sendOrder(a, ord)
	if win != null:
		win.pick = ""
	tick_toasts()

func tick_toasts() -> void:
	for s in SimPlayer.toasts:
		toast(s)
	SimPlayer.toasts.clear()

func _cmd_map(a: Dictionary, pk: String, d: Dictionary) -> void:
	target = {"kind": "cmd", "army": a.id, "o": pk, "mode": win.mode}
	win = null
	toast("Щёлкните по " + ("войску" if d.tgt == "army" else "крепости") + " на карте.")

func _cmd_app(w: Dictionary, a: Dictionary, x0: float, y: float, wR: float) -> void:
	var G := Sim.G
	var K: Array = G.chars.filter(func(c): return JS.t(c.alive) and c.realm == 0.0 and c.prison < 0 and c.age >= 16 and not JS.t(c.get("seat")) and SimPlayer.armyOfGen(c.id) == null and not JS.t(c.get("withKing")) and c.id != G.player.char and (c.role == "knight" or c.role == "lord" or c.role == "courtier"))
	K.sort_custom(func(p, q): return JS.n(p.get("mar")) > JS.n(q.get("mar")))
	K = K.slice(0, 8)
	tx("Новый командир (по Мечу):", x0, y, Art.pal("y"))
	sbtn("cm_back3", x0 + wR - 60, y - 2, 60, "Назад", func(_c): w.app = 0)
	y += 14
	for i in K.size():
		var c: Dictionary = K[i]
		btn("cm_k" + JS.s(c.id), x0, y + i * 15, wR, 13, {"label": Sim.charName(c) + " · Меч " + JS.s(JS.n(c.get("mar"))) + " · " + traits_s(c), "tip": trait_tip(c), "on": func(_c): _cmd_newgen(w, a, c)})

func _cmd_newgen(w: Dictionary, a: Dictionary, c: Dictionary) -> void:
	var old: Variant = Sim.charOf(a.gen)
	if old != null:
		old.atCourt = 1.0
		old.loy = clampf(JS.n(old.get("loy", 60)) - 8, 0, 100)
	a.gen = c.id
	c.atCourt = 0.0
	w.app = 0
	Sim.glog(Sim.charName(c) + " принял командование войском.", "info")

func _cmd_disband(a: Dictionary) -> void:
	var g: Variant = Sim.charOf(a.gen)
	win = null
	say(null, "Распустить войско " + (Sim.charName(g) if g != null else "") + " (" + SimArmy.voin(Sim.armyMen(a)) + ") по домам? Жалованье платить не придётся, но собрать их снова будет непросто.",
		{"choices": [{"t": "Распустить", "fx": func(): SimPlayer.disbandArmy(a)}, {"t": "Нет", "fx": func(): pass}], "esc": 1})

## цель приказа указали на карте (cmdPickSett, cmdPickArmy)
func cmd_pick_sett(sid: int) -> void:
	var tg: Dictionary = target
	target = null
	var a: Variant = Sim.armyById(tg.army)
	if a == null:
		return
	var S: Dictionary = Sim.G.setts[sid]
	if (tg.o == "attack" or tg.o == "feint") and (S.ctrl == 0.0 or not (Sim.hostile(0, S.ctrl) or S.ctrl == 5.0)):
		toast("С хозяевами этой крепости нет войны.")
		return
	if (tg.o == "defend" or tg.o == "patrol") and S.ctrl != 0.0:
		toast("Это не наша крепость.")
		return
	if tg.o == "join":
		toast("Нужно выбрать войско, а не крепость.")
		return
	_cmd_send(a, {"o": tg.o, "t": float(sid), "mode": tg.mode})

func cmd_pick_army(b: Dictionary) -> void:
	var tg: Dictionary = target
	target = null
	var a: Variant = Sim.armyById(tg.army)
	if a == null:
		return
	if tg.o != "join" or b.realm != 0.0 or b == a:
		toast("Не подходит.")
		return
	_cmd_send(a, {"o": "join", "t": b.id, "mode": tg.mode})
