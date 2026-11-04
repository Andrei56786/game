extends "res://scripts/ui_kit.gd"
## Панели экрана боя (bdraw.js, bscreen.js): верхняя строка (силы, дух, время, погода, разведка), расстановка (построения,
## строи, карточки полков с воеводами), бой (полки, приказы полкам и отрядам, скорость, рог, «сплотить», натиск, бегство,
## мини-карта), итог боя (потери, добыча, полки и воеводы, как полегли, уроки). Здесь же выбор полков и отрядов, общие
## приказы и подсказки — поле, ввод и ход боя в bview.gd.
const REGD := {"C": "1", "R": "2", "L": "3", "V": "4", "S": "5"}
const REGC := {"C": "#f7d35c", "R": "#9fe07a", "L": "#8ac8ff", "V": "#ffb070", "S": "#e8a0ff"}
const ORD_TIP := {
	"hold": "Стоять: держать место. Отряды отбивают подошедших вплотную, стрелки бьют, кого достанут.",
	"adv": "Наступать: полк единым строем идёт на ближайшего врага и вступает в бой.",
	"flank": "Обход: полк обходит крайний отряд врага и бьёт во фланг и тыл. Коннице — с руки, пехоте — долго.",
	"skirm": "Перестрелка: стрелки выходят на выстрел и отходят за свою пехоту, когда к ним рвётся рукопашная.",
	"wait": "Ждать сигнала: полк стоит (в лесу — невидим) и ударит по сигналу рога — или когда враг подойдёт вплотную.",
	"pursue": "Преследовать: гнать бегущих. Больше всего жизней и пленных берут именно в погоне.",
	"back": "Отход: отойти шагов на сто и встать. Из рукопашной уходят под ударами в спину.",
	"auto": "На усмотрение: воевода решает сам — по обстановке и своему умению.",
}
const ORD_BTN := [["hold", "Стоять"], ["adv", "Вперёд"], ["flank", "Обход"], ["skirm", "Стрелять"], ["wait", "Ждать"], ["pursue", "Гнать"], ["back", "Назад"], ["auto", "Сами"]]
const FORM_TIP := {
	"line": "Строй: обычный порядок — ровно во всём.",
	"close": "Стена щитов: щит к щиту. Держат удар (+35%) и стрелы (−45%), но медленны. Арбалетчики стоят за павезами.",
	"loose": "Рассыпной: стрелы почти не берут (−55%), но рукопашная и конница рвут такой строй.",
	"wedge": "Клин: пробивает строй (атака +25%, натиск конницы сильнее), бока уязвимы.",
	"square": "Ёж: копья во все стороны — ни фланга, ни тыла, конница разбивается. Стоят на месте, а стрелы бьют больно.",
	"column": "Колонна: быстрый марш (+35%), но в бою беззащитна и не стреляет.",
}
const FORM_BTN := [["line", "Строй"], ["close", "Стена"], ["loose", "Россыпь"], ["wedge", "Клин"], ["square", "Ёж"], ["column", "Колонна"]]
const TPLS := [["std", "Обычный", "Обычный строй: Большой полк в центре, полки правой и левой руки по бокам с конницей на крыльях, Передовой полк стрелков впереди, рыцари Засадного полка в резерве."],
	["def", "Оборона", "Оборона: копья вперёд стеной щитов, крылья загнуты назад, стрелки за строем. «Сначала сделай себя непобедимым»."],
	["amb", "Засада", "Засада: вся конница Засадного полка скрыта в лесу и ждёт сигнала рога. «Нападай там, где враг не готов»."],
	["wedge", "Клин", "Клин: рыцари и латники клином впереди строя — пробить центр одним ударом."],
	["cres", "Полумесяц", "Полумесяц: слабый центр отведён назад, сильные крылья выдвинуты — враг втягивается в мешок."]]
const UICON := {"levy": "i_men", "spear": "i_shield", "sword": "i_sword", "archer": "i_bow", "xbow": "i_xbow", "horse": "i_horse", "harch": "i_harch", "knight": "i_knight"}
const TRN0 := {"brave": "храбрый", "cautious": "осторожный", "reckless": "горячий", "craven": "робкий", "cunning": "хитрый", "strategist": "стратег"}
const TPLN := {"std": "обычный строй", "def": "оборона", "amb": "засада?", "wedge": "клин", "cres": "полумесяц", "wall": "на стенах"}
const MNT := {"horse": true, "harch": true, "knight": true}
const RNG := {"archer": true, "xbow": true, "harch": true}
const Y0 := 22.0           # BF: поле — 640×272 под верхней строкой, панель снизу — 66
const VW := 640.0
const VH := 272.0
const DIM := "#9a8a70"
const WARN := "#f7d35c"
const BAD := "#ee7a6a"
const GOOD := "#9fe07a"
var B: SimBattle.Bat
var ov := false            # B.ov: карта полководца
var bf: BField             # картинка поля (bview)
var ret_arm := -10.0       # B.retArm: «Бежать» нажато (второе нажатие в 3 с — бегство)
var last_sp := 1.0         # B.lastSp

# ---------- общее ----------
func trN(t: String) -> String:
	if TRN0.has(t):
		return TRN0[t]
	return String(Sim.TRAITS[t].n).to_lower() if Sim.TRAITS.has(t) else ""

func tplName(k: String, known: bool) -> String:
	return String(TPLN.get(k, k)) if known else "неясен"

func scoutWord(s: float) -> String:
	return "видим всё, даже засады" if s >= 0.75 else ("враг виден целиком" if s >= 0.55 else ("видны лишь очертания войска" if s >= 0.25 else "о враге ничего не известно — нужна лёгкая конница"))

func dep_ord(k: String) -> Array:
	var L := ["hold", "adv", "wait", "auto"]
	if k == "V":
		L.append("skirm")
	if k == "R" or k == "L" or k == "S":
		L.append("flank")
	return L

func ordn(k: Variant) -> String:
	return String(SimBattle.ORDN.get(k, k if k != null else ""))

func n0(v: float) -> String:
	return str(int(roundf(v)))

func reg_types(us: Array) -> Array:
	var m := {}
	for u: SimBattle.BU in us:
		m[u.type] = float(m.get(u.type, 0.0)) + u.men
	var ks := m.keys()
	ks.sort_custom(func(a, b): return m[a] > m[b])
	return ks

## лицо воеводы 16×16 (drawPortrait(captChar(c), x, y, 1/3)): короля — его, прочих — по народу и зерну
func cport(c: Dictionary) -> int:
	var ch: Variant = c.get("ch")
	if ch is Dictionary and not Sim.G.is_empty() and ch.get("id") == Sim.G.player.char:
		return int(Art.D.get("kingS", -1))
	var cul := String(ch.get("cul", "")) if ch is Dictionary else String(c.get("cul", ""))
	var r := 6
	for i in Sim.REALM_DEF.size():
		if String(Sim.REALM_DEF[i].key) == cul:
			r = i
			break
	var L: Array = Art.D.get("capts", [])
	if r >= L.size():
		return -1
	var sd := int(ch.get("id", 0)) * 7 + 3 if ch is Dictionary else int(c.get("seed", 0))
	return int(L[r][posmod(sd, (L[r] as Array).size())])

func portrait16(c: Dictionary, x: float, y: float) -> void:
	var p := cport(c)
	if p >= 0:
		spr(p, x, y)
	else:
		rect(x, y, 16, 16, "#22170f")

# ---------- выбор (bscreen.js: selUnits … reassign) ----------
func sel_units() -> Array:
	var out := []
	for i in B.sel:
		var u: SimBattle.BU = B.units[i] if i >= 0 and i < B.units.size() else null
		if u != null and u.side == 0 and SimBattle.bAlive(u):
			out.append(u)
	return out

func sel_clear() -> void:
	B.sel = []
	B.selRegs = []

func sel_fix() -> void:
	var s := {}
	for i in B.sel:
		s[i] = true
	B.selRegs = []
	for k in SimBattle.REGK:
		var us := SimBattle.regUnits(B, 0, k, true)
		if us.is_empty():
			continue
		var all := true
		for u: SimBattle.BU in us:
			if not s.has(u.id):
				all = false
				break
		if all:
			B.selRegs.append(k)

func sel_reg(k: String, add: bool) -> void:
	var us := SimBattle.regUnits(B, 0, k, true)
	if us.is_empty():
		return
	if add and B.selRegs.has(k):
		B.sel = B.sel.filter(func(i): return B.units[i].reg != k)
		sel_fix()
		return
	if not add:
		B.sel = []
	for u: SimBattle.BU in us:
		if not B.sel.has(u.id):
			B.sel.append(u.id)
	sel_fix()

## {regs — выбранные полки целиком (через воевод), blocks — прочие выбранные отряды, us — все выбранные}
func sel_split() -> Dictionary:
	var us := sel_units()
	var regs := []
	for k in B.selRegs:
		if SimBattle.regUnits(B, 0, k).size():
			regs.append(k)
	var blocks := []
	for u: SimBattle.BU in us:
		if not regs.has(u.reg) and u.state != "rout":
			blocks.append(u)
	return {"regs": regs, "blocks": blocks, "us": us}

## передать выбранные отряды другому полку (Shift+1…5)
func reassign(k: String) -> void:
	var us := sel_units().filter(func(u): return u.reg != k and u.state != "rout")
	if us.is_empty():
		return
	var g: SimBattle.BReg = B.regs[0][k]
	var old := {}
	for u: SimBattle.BU in us:
		old[u.reg] = true
	if SimBattle.regUnits(B, 0, k).is_empty():
		var cx := 0.0
		var cy := 0.0
		for u: SimBattle.BU in us:
			cx += u.x
			cy += u.y
		g.ax = cx / us.size()
		g.ay = cy / us.size()
		g.af = us[0].face
		if B.phase == "fight":
			g.order = {"k": "hold"}
			g.cur = "hold"
	for u: SimBattle.BU in us:
		u.reg = k
		u.man = false
		SimBattle.setSlot(g, u)
	old[k] = true
	for q in old:
		var gq: SimBattle.BReg = B.regs[0][q]
		var L := SimBattle.leadOf(B, gq)
		if L == null or L.reg != q:
			var rest := SimBattle.regUnits(B, 0, q)
			gq.lead = SimBattle.pickLead(rest).id if rest.size() else -1
	if B.phase == "deploy":
		for u: SimBattle.BU in us:
			hide_check(u)
	sel_fix()
	bsay_ui(SimBattle.REGN[k] + ": +" + str(us.size()) + " " + Sim.plural(us.size(), "отряд", "отряда", "отрядов"), REGC[k])

## сообщения экрана: идут и в расстановке (время боя там стоит)
func bsay_ui(t: String, c := "#f7d35c") -> void:
	B.log.append({"t": B.t, "s": t, "c": c, "n0": now()})
	if B.log.size() > 40:
		B.log.pop_front()

func hide_check(u: SimBattle.BU) -> void:
	if u.side != 0:
		return
	var g: SimBattle.BReg = B.regs[0][u.reg]
	u.hidden = g.order.k == "wait" and B.F.g[SimBattle.cellAt(u.x, u.y)] == SimBattle.FOREST

func ranged_reg(k: String) -> bool:
	var us := SimBattle.regUnits(B, 0, k)
	if us.is_empty():
		return false
	for u: SimBattle.BU in us:
		if not (u.ranged and u.ammo > 0):
			return false
	return true

# ---------- кнопки боя ----------
func go_fight() -> void:
	if B.phase != "deploy":
		return
	B.phase = "fight"
	B.speed = 1
	for u: SimBattle.BU in B.units:
		if u.side == 0:
			hide_check(u)
	SimBattle.updateVis(B)
	B.visT = B.t + 0.5

func sig_btn() -> void:
	if not SimBattle.bSignal(B, 0):
		bsay_ui("Рог уже трубил." if B.t - B.sigT[0] < 2 else "Ни один полк не ждёт сигнала.", "#c8b898")

func rally_btn() -> void:
	var gu := SimBattle.genOf(B, 0)
	if gu == null:
		bsay_ui("Полководца нет на поле — некому сплотить войско.", BAD)
		return
	if gu.state == "rout":
		bsay_ui("Отряд полководца бежит!", BAD)
		return
	if not SimBattle.rally(B, 0):
		bsay_ui("Сплотить снова можно через " + str(ceili(30 - (B.t - B.rallyT[0]))) + " с.", "#c8b898")

func charge_all() -> void:
	var n := 0
	for k in SimBattle.REGK:
		var g: SimBattle.BReg = B.regs[0][k]
		if SimBattle.regUnits(B, 0, k).is_empty():
			continue
		SimBattle.issueReg(B, g, {"k": "skirm" if ranged_reg(k) else "adv"})
		n += 1
	for u: SimBattle.BU in B.units:
		if u.side == 0:
			u.man = false
	if n:
		bsay_ui("Общий натиск! Все полки — вперёд!", "#f7d35c")

func flee_field() -> void:
	if now() - ret_arm > 3:
		ret_arm = now()
		return
	for u: SimBattle.BU in B.units:
		if u.side == 0 and SimBattle.bAlive(u):
			u.state = "rout"
			u.routT = B.t
	B.over = {"win": 1, "retreat": true}

func cam_clamp() -> void:
	B.cam.x = clampf(B.cam.x, 0, maxf(0, B.F.W - VW))
	B.cam.y = clampf(B.cam.y, 0, maxf(0, B.F.H - VH))

func cam_to(x: float, y: float) -> void:
	B.cam.x = roundf(x - VW / 2)
	B.cam.y = roundf(y - VH / 2)
	cam_clamp()

## что игрок знает об отряде: full — видит; rough — очертания от разведки; null — ничего
func knowU(u: SimBattle.BU) -> Variant:
	if u.side == 0:
		return "full"
	if not SimBattle.bAlive(u):
		return null
	if B.phase == "deploy":
		if u.hidden:
			return "rough" if B.scout[0] >= 0.75 else null
		return "full" if B.scout[0] >= 0.55 else ("rough" if B.scout[0] >= 0.25 else null)
	return "full" if (B.vis[0] as PackedByteArray)[u.id] else null

# ---------- верхняя строка ----------
func _side_sum(s: int) -> Dictionary:
	var m := 0.0
	var m0 := 0.0
	var mor := 0.0
	var n := 0
	for u: SimBattle.BU in B.units:
		if u.side == s:
			m += maxf(0, u.men)
			m0 += u.men0
			if SimBattle.bAlive(u) and (s == 0 or B.phase == "fight" or knowU(u) != null):
				mor += u.morale
				n += 1
	return {"m": roundf(m), "m0": m0, "mor": mor / n if n else 0.0}

func _mm(s: int) -> String:
	return str(s / 60) + ":" + ("0" + str(s % 60)).right(2)

func draw_top() -> void:
	rect(0, 0, W, Y0, "#2a1d16")
	hline(0, Y0 - 1, W, "#6a4428")
	var a := _side_sum(0)
	var b := _side_sum(1)
	var seen: bool = B.phase == "fight" or B.scout[0] >= 0.55
	var s0: Dictionary = B.sides[0]
	var s1: Dictionary = B.sides[1]
	spr_k("shield" + str(int(JS.n(s0.get("realm")))), 4, 4)
	txt(String(s0.name) if JS.t(s0.get("name")) else "Мы", 18, 3, cc("#cfe2ff"))
	txt(n0(a.m) + " / " + n0(a.m0), 18, 12, Art.pal("w"), "s")
	bar(80, 13, 70, 5, a.mor / 100.0, "#7fb04c")
	var rr := 6 if s1.get("realm") == null else int(s1.realm)
	spr_k("shield" + str(rr), W - 16, 4)
	txt(String(s1.name) if JS.t(s1.get("name")) else "Враг", W - 20, 3, cc("#ffb4a8"), "m", "r")
	txt(n0(b.m) + " / " + n0(b.m0) if seen else "~" + str(int(JS.rnd(b.m0 / 100.0) * 100)) + "?", W - 20, 12, Art.pal("w"), "s", "r")
	if seen:
		bar(W - 150, 13, 70, 5, b.mor / 100.0, "#c0353f")
	var tt := int(floorf(B.t))
	var fs := String({"S": "малое", "M": "среднее", "L": "большое"}.get(B.F.size, "малое"))
	txt(("Расстановка" if B.phase == "deploy" else "Бой " + _mm(tt) + " из " + _mm(int(B.tl))) + " · " + String(B.weather.n) + " · поле " + fs, W / 2.0, 4, Art.pal("y"), "m", "c")
	if B.phase == "fight":
		var st: String = B.stance[1]
		txt("Штурм" if B.F.siege else "Враг " + ("наступает" if st == "attack" else "выжидает") + " · шаблон: " + tplName(B.tpl[1], B.t > 20), W / 2.0, 13, cc("#c8b898"), "s", "c")
	else:
		txt("Разведка: " + scoutWord(B.scout[0]), W / 2.0, 13, cc("#c8b898"), "s", "c")

# ---------- нижняя панель ----------
func draw_bottom() -> void:
	var y := Y0 + VH
	rect(0, y, W, H - y, "#2a1d16")
	hline(0, y, W, "#6a4428")
	if B.res != null:
		return
	if B.phase == "deploy":
		_deploy_panel(y)
	else:
		_fight_panel(y)

func _deploy_panel(y: float) -> void:
	txt("Построение:", 4, y + 6, cc("#c8b898"), "s")
	for i in TPLS.size():
		var k: String = TPLS[i][0]
		var dis: bool = k == "amb" and B.F.forest[0] == null
		btn("bd_" + k, 52 + i * 58, y + 3, 56, 13, {"label": TPLS[i][1], "active": B.tpl[0] == k, "disabled": dis or B.F.siege,
			"tip": "При штурме полки строятся у стен." if B.F.siege else ("Нет леса рядом — засада невозможна." if dis else TPLS[i][2]),
			"on": func(_c): SimBattle.deployRegs(B, 0, k); sel_clear(); SimBattle.updateVis(B)})
	_form_row(y + 3, 346, 46, 13, false)
	for i in SimBattle.REGK.size():
		_reg_card_big(SimBattle.REGK[i], 4 + i * 100, y + 19)
	btn("bd_go", 506, y + 19, 130, 24, {"label": "К бою!", "ic": "i_sword", "tip": "Начать сражение (Enter). Дальше приказы повезут гонцы.", "on": func(_c): go_fight()})
	para("Дальше полки ведут воеводы — каждый как умеет.", 506, y + 47, 130, DIM, "s", 7)

func _reg_card_big(k: String, x: float, y: float) -> void:
	var w := 98.0
	var h := 44.0
	var g: SimBattle.BReg = B.regs[0][k]
	var us := SimBattle.regUnits(B, 0, k, true)
	var sel: bool = B.selRegs.has(k)
	var c: Variant = g.cmd
	var empty := us.is_empty()
	var id := "rc" + k
	panel_dark(x, y, w, h, sel or hov(id))
	rect(x + 1, y + 1, 2, h - 2, "#4a3a30" if empty else REGC[k])
	if sel:
		stroke_r(x, y, w, h, REGC[k])
	hit(x, y, w, h, {"id": id, "tip": func(): return reg_tip(k), "on": func(c2): if not empty: sel_reg(k, c2.shift)})
	txt(REGD[k], x + 6, y + 3, cc(REGC[k]), "m", "l", PO)
	txt(SimBattle.REGS[k], x + 14, y + 3, cc("#7a6a5a") if empty else Art.pal("y"))
	if c != null:
		var cg := JS.t(c.get("gen"))
		portrait16(c, x + 5, y + 12)
		stroke_r(x + 4, y + 11, 18, 18, "#f7d35c" if cg else "#6a4a30")
		txt(fit_t(SimCapt.capName(c), w - 27, "s"), x + 25, y + 13, cc("#f7d35c") if cg else Art.pal("w"), "s")
		var tr: Array = c.get("tr", []) if c.get("tr") is Array else []
		var t1 := trN(String(tr[0])) if tr.size() else ""
		txt(fit_t("воин. " + JS.s(c.mar) + (" · " + t1 if t1 != "" else ""), w - 27, "s"), x + 25, y + 21, cc("#c8b898"), "s")
	else:
		txt("без воеводы", x + 6, y + 15, cc(BAD), "s")
	if empty:
		txt("нет отрядов", x + 25, y + 30, cc("#7a6a5a"), "s")
	else:
		var men := 0.0
		for u: SimBattle.BU in us:
			men += u.men
		txt(n0(men), x + 25, y + 30, Art.pal("w"), "s")
		var ts := reg_types(us)
		for i in mini(5, ts.size()):
			spr_k(UICON[ts[i]], x + 46 + i * 8, y + 29)
		var ords := dep_ord(k)
		var cur: String = g.order.k
		btn("ro" + k, x + 3, y + h - 7, w - 6, 6, {"label": "", "style": "dark", "tip": ["Приказ полку: " + ordn(cur) + " (щелчок — сменить)", {"t": ORD_TIP.get(cur, ""), "c": DIM}],
			"on": func(_c): SimBattle.setRegOrder(B, g, {"k": ords[(ords.find(cur) + 1) % ords.size()]}); for u2: SimBattle.BU in SimBattle.regUnits(B, 0, k): hide_check(u2)})
		txt(ordn(cur), x + w / 2, y + h - 6, cc("#fff2c8"), "s", "c")
	var mv: Array = (sel_split().blocks as Array).filter(func(u): return u.reg != k)
	if mv.size() and not B.selRegs.has(k):
		btn("ra" + k, x + w - 13, y + 2, 11, 9, {"label": "+", "style": "dark", "tip": "Перевести выбранные отряды (" + str(mv.size()) + ") в " + SimBattle.REGN[k] + " (Shift+" + REGD[k] + ").", "on": func(_c): reassign(k)})

func reg_tip(k: String) -> Array:
	var g: SimBattle.BReg = B.regs[0][k]
	var us := SimBattle.regUnits(B, 0, k, true)
	var c: Variant = g.cmd
	var L: Array = [REGD[k] + " · " + SimBattle.REGN[k]]
	if c != null:
		var tr: Array = c.get("tr", []) if c.get("tr") is Array else []
		var ts := []
		for t in tr:
			var s := trN(String(t))
			if s != "":
				ts.append(s)
		L.append({"t": ("Ведёт сам полководец: " if JS.t(c.get("gen")) else "Воевода: ") + SimCapt.capName(c) + ", воинское умение " + JS.s(c.mar) + (", " + ", ".join(ts) if tr.size() else ""), "c": Art.pal("y") if JS.t(c.get("gen")) else Art.pal("w")})
	else:
		L.append({"t": "Без воеводы: полк действует вяло и медленно.", "c": BAD})
	if us.size():
		var m := {}
		var order := []
		for u: SimBattle.BU in us:
			if not m.has(u.type):
				order.append(u.type)
			m[u.type] = float(m.get(u.type, 0.0)) + u.men
		L.append(", ".join(order.map(func(t): return String(Sim.UNIT[t].n) + " " + n0(m[t]))))
	var ok: String = g.pend.ord.k if g.pend != null else g.order.k
	L.append({"t": "Приказ: " + ordn(ok) + (" (гонец в пути)" if g.pend != null else "") + (" — сейчас: " + ordn(g.cur).to_lower() if B.phase == "fight" and g.cur != g.order.k else ""), "c": DIM})
	L.append({"t": "Щелчок или " + REGD[k] + " — выбрать полк; Shift — добавить.", "c": DIM})
	return L

func _reg_card_small(k: String, x: float, y: float) -> void:
	var w := 76.0
	var h := 30.0
	var g: SimBattle.BReg = B.regs[0][k]
	var us := SimBattle.regUnits(B, 0, k, true)
	var sel: bool = B.selRegs.has(k)
	var c: Variant = SimBattle.cmdOk(g)
	var empty := us.is_empty()
	var id := "rc" + k
	panel_dark(x, y, w, h, sel or hov(id))
	rect(x + 1, y + 1, 2, h - 2, "#4a3a30" if empty else REGC[k])
	if sel:
		stroke_r(x, y, w, h, REGC[k])
	hit(x, y, w, h, {"id": id, "tip": func(): return reg_tip(k), "on": func(c2): if not empty: sel_reg(k, c2.shift)})
	txt(REGD[k], x + 6, y + 3, cc(REGC[k]), "m", "l", PO)
	txt(fit_t(SimBattle.REGS[k], w - 17, "s"), x + 13, y + 4, cc("#7a6a5a") if empty else Art.pal("y"), "s")
	if empty:
		txt("разбит", x + 13, y + 14, cc("#7a6a5a"), "s")
		return
	var men := 0.0
	var mor := 0.0
	var na := 0
	for u: SimBattle.BU in us:
		men += u.men
		if u.state != "rout":
			mor += u.morale
			na += 1
	mor = mor / na if na else 0.0
	var ms := n0(men)
	var mw := tw(ms, "s")
	txt(ms, x + w - 4, y + 10, Art.pal("w"), "s", "r")
	bar(x + 5, y + 12, w - 12 - mw, 3, mor / 100.0, "#c0353f" if mor < 30 else ("#d8a040" if mor < 55 else "#7fb04c"))
	var rt := us.size() - na
	var s := ("→ " + ordn(g.pend.ord.k) if g.pend != null else ordn(g.cur)) + (" · бегут " + str(rt) if rt else "")
	txt(fit_t(s, w - (20 if g.pend != null else 10), "s"), x + 6, y + 17, cc(WARN) if g.pend != null else (cc(BAD) if rt else cc("#fff2c8")), "s")
	txt(fit_t(SimCapt.capName(c), w - 10, "s") if c != null else "без воеводы!", x + 6, y + 23, cc(DIM) if c != null else cc(BAD), "s")
	if g.pend != null and sin(now() * 8) > 0:
		spr_k("i_raven", x + w - 10, y + 15)

## строй для выбранных (formRow)
func _form_row(y: float, x0: float, bw: float, bh: float, unlock: bool) -> void:
	var us := sel_units().filter(func(u): return u.state != "rout")
	for i in FORM_BTN.size():
		var k: String = FORM_BTN[i][0]
		var ok := us.filter(func(u): return (SimBattle.FORM_OK[u.type] as Array).has(k))
		var cur := ok.size() > 0
		for u: SimBattle.BU in ok:
			if (u.formTo if u.formTo != "" else u.form) != k:
				cur = false
				break
		var sub := "Сначала выберите полк или отряды." if us.is_empty() else ("Встанут " + str(ok.size()) + " из " + str(us.size()) + " отрядов: не всем этот строй по силам." if ok.size() < us.size() else ("Перестроение займёт несколько секунд — и приказ ещё должен довезти гонец." if B.phase == "fight" else ""))
		btn("bf_" + k, x0 + i * (bw + 2), y, bw, bh, {"label": FORM_BTN[i][1], "active": cur, "disabled": ok.is_empty(), "tip": [FORM_TIP[k], {"t": sub, "c": DIM}],
			"on": func(_c): for u2: SimBattle.BU in ok: SimBattle.issueForm(B, u2, k, true)})
	if unlock:
		var lk := us.filter(func(u): return u.formLock)
		btn("bf_auto", x0 + 6 * (bw + 2), y, bw, bh, {"label": "Сами", "disabled": lk.is_empty(), "tip": "Пусть воеводы сами выбирают строй по обстановке: стена против стрел, ёж против конницы, колонна на марше.",
			"on": func(_c): for u2: SimBattle.BU in lk: SimBattle.issueForm(B, u2, null, false)})

func _fight_panel(y: float) -> void:
	for i in SimBattle.REGK.size():
		_reg_card_small(SimBattle.REGK[i], 4 + i * 79, y + 3)
	var sp := sel_split()
	var regs: Array = sp.regs
	var blocks: Array = sp.blocks
	if regs.size():
		var hasR := false
		for q in regs:
			for u: SimBattle.BU in SimBattle.regUnits(B, 0, q):
				if u.ranged and u.ammo > 0:
					hasR = true
		for i in ORD_BTN.size():
			var k: String = ORD_BTN[i][0]
			var act := true
			for q in regs:
				var g: SimBattle.BReg = B.regs[0][q]
				if (g.pend.ord.k if g.pend != null else g.order.k) != k:
					act = false
			btn("bo_" + k, 4 + i * 49, y + 36, 48, 14, {"label": ORD_BTN[i][1], "active": act, "disabled": k == "skirm" and not hasR,
				"tip": [ORD_TIP[k], {"t": "Приказ повезёт гонец от полководца к воеводе — чем дальше, тем дольше.", "c": DIM}], "on": func(_c): _order_regs(regs, k)})
	elif blocks.size():
		_blk_btn(0, "bb_hold", "Стоять", func(): for u: SimBattle.BU in blocks: SimBattle.issue(B, u, {"k": "move", "x": u.x, "y": u.y, "f": u.face}); u.man = true,
			"Отряды встанут, где стоят, — воевода ими больше не распоряжается.", y)
		_blk_btn(1, "bb_atk", "В атаку", func(): _blocks_attack(blocks), "Атаковать ближайшего видимого врага.", y)
		_blk_btn(2, "bb_back", "Отход", func(): for u: SimBattle.BU in blocks: SimBattle.issue(B, u, {"k": "move", "x": clampf(u.x - 70, 14, B.F.W - 14), "y": u.y, "f": u.face, "dis": 1.0}); u.man = true,
			["Отойти назад шагов на семьдесят.", {"t": "Выйти можно и из рукопашной — но враг будет рубить в спину.", "c": DIM}], y)
		_blk_btn(3, "bb_reg", "В полк", func(): for u: SimBattle.BU in blocks: u.man = false,
			"Вернуть отряды под начало воеводы их полка — пусть снова держат своё место в строю.", y)
	else:
		para("Выберите полк: карточка, цифра 1–5 или двойной щелчок по отряду. Отряд — щелчок или рамка. ПКМ — приказ, протянуть ПКМ — линия фронта.", 4, y + 36, 392, DIM, "s", 7)
	_form_row(y + 52, 4, 54, 12, true)
	# справа: время, рог, «сплотить», натиск, карта, бегство и мини-карта
	var rx := 400.0
	var SP := [0.0, 1.0, 2.0, 4.0]
	var STIP := ["Пауза (Пробел) — отдавать приказы", "Скорость 1", "Скорость 2 (+/−)", "Скорость 4"]
	for i in 4:
		var s: float = SP[i]
		btn("bs" + str(int(s)), rx + i * 15, y + 3, 14, 14, {"ic": SPD_IC[i], "style": "dark", "active": B.speed == s, "tip": STIP[i], "on": func(_c): B.speed = s})
	btn("bo_map", rx + 62, y + 3, 70, 14, {"label": "К войскам" if ov else "Карта", "ic": "i_map", "active": ov, "tip": "Карта полководца (Tab или колесо мыши): всё поле разом.", "on": func(_c): ov = not ov})
	var sig_ok := false
	for k in SimBattle.REGK:
		if B.regs[0][k].order.k == "wait" and SimBattle.regUnits(B, 0, k).size():
			sig_ok = true
	btn("bo_sig", rx, y + 19, 65, 14, {"label": "Сигнал", "active": sig_ok and sin(now() * 4) > 0.3, "disabled": not sig_ok,
		"tip": ["Трубить в рог (H): полки, ждущие сигнала, ударят разом.", {"t": "Сигнал слышат сразу — гонец не нужен.", "c": DIM}], "on": func(_c): sig_btn()})
	var rcd := maxf(0, 30 - (B.t - B.rallyT[0]))
	btn("bo_ral", rx + 67, y + 19, 65, 14, {"label": "Сплотить " + str(ceili(rcd)) if rcd > 0 else "Сплотить", "disabled": rcd > 0 or SimBattle.genOf(B, 0) == null,
		"tip": "Полководец скачет вдоль строя (G): дрогнувшие крепнут духом, часть бегущих поблизости возвращается. Раз в 30 с.", "on": func(_c): rally_btn()})
	btn("bo_all", rx, y + 35, 65, 14, {"label": "Натиск!", "tip": "Общий натиск: всем полкам наступать, стрелкам — стрелять с ходу.", "on": func(_c): charge_all()})
	var arm := now() - ret_arm < 3
	btn("bo_ret", rx + 67, y + 35, 65, 14, {"label": "Точно?" if arm else "Бежать", "active": arm, "tip": "Отступить с поля (нажать дважды): бой проигран, но уцелевшие спасутся.", "on": func(_c): flee_field()})
	txt("Пауза" if B.speed == 0 else "Скорость ×" + JS.s(B.speed), rx, y + 54, cc(DIM), "s")
	if (sp.us as Array).size():
		txt("Выбрано: " + str((sp.us as Array).size()), rx + 67, y + 54, cc(DIM), "s")
	_mini(W - 100, y + 3)

func _blk_btn(i: int, id: String, l: String, f: Callable, tip: Variant, y: float) -> void:
	btn(id, 4 + i * 98, y + 36, 96, 14, {"label": l, "tip": tip, "on": func(_c): f.call()})

func _blocks_attack(blocks: Array) -> void:
	for u: SimBattle.BU in blocks:
		var e := SimBattle.enemyOf(B, u)
		if e != null:
			SimBattle.issue(B, u, {"k": "attack", "t": e.id})
			u.man = true

func _order_regs(regs: Array, k: String) -> void:
	for q in regs:
		var g: SimBattle.BReg = B.regs[0][q]
		if k == "hold":
			var m := SimBattle.regUnits(B, 0, q)
			var sx := 0.0
			var sy := 0.0
			for u: SimBattle.BU in m:
				sx += u.x
				sy += u.y
			SimBattle.issueReg(B, g, {"k": "hold", "x": sx / m.size(), "y": sy / m.size(), "re": true})
		else:
			SimBattle.issueReg(B, g, {"k": k})

## мини-карта (drawBMini): поле 96 точек в ширину, отряды точками, рамка обзора; щелчок — туда
func _mini(x: float, y: float) -> void:
	var w := 96.0
	var h := maxf(20.0, roundf(B.F.H * 96.0 / B.F.W))
	var sc := w / B.F.W
	rect(x - 1, y - 1, w + 2, h + 2, PO)
	if bf != null:
		draw_texture_rect(bf.smooth, Rect2(x, y, w, h), false)
	for u: SimBattle.BU in B.units:
		if not SimBattle.bAlive(u) or knowU(u) != "full":
			continue
		rect(x + u.x * sc - 1, y + u.y * sc - 1, 2, 2, ("#fff2c8" if B.sel.has(u.id) else "#8ac8ff") if u.side == 0 else "#ee5a4a")
	if not ov:
		stroke_r(roundf(x + B.cam.x * sc), roundf(y + B.cam.y * sc), roundf(VW * sc), roundf(VH * sc), "#fff2c8")
	hit(x, y, w, h, {"id": "bmini", "tip": "Мини-карта: щёлкните, чтобы перейти.", "on": func(c): ov = false; cam_to((c.ux - x) / sc, (c.uy - y) / sc)})

# ---------- подсказки ----------
func unit_tip(u: SimBattle.BU) -> Array:
	var own := u.side == 0
	var g: SimBattle.BReg = B.regs[u.side][u.reg]
	var c: Variant = g.cmd
	var st := String({"idle": "стоят", "move": "идут", "melee": "в рукопашной", "rout": "БЕГУТ"}.get(u.state, u.state))
	var L: Array = [String(Sim.UNIT[u.type].n) + ("" if own else " (враг)") + " · " + SimBattle.formName(u.type, u.formTo if u.formTo != "" else u.form) + (" (перестраиваются)" if u.formTo != "" else ""),
		n0(u.men) + " из " + JS.s(u.men0) + " · дух " + n0(u.morale) + " · устал. " + n0(u.fat) + " · " + st]
	if RNG.has(u.type):
		L.append(("Болтов" if u.type == "xbow" else "Стрел") + " на " + n0(u.ammo) + " залп.")
	if own:
		L.append({"t": SimBattle.REGN[u.reg] + (" · " + SimCapt.capName(c) + " (воин. " + JS.s(c.mar) + ")" if c != null else " · без воеводы"), "c": REGC[u.reg]})
		L.append({"t": "Под вашим приказом. «В полк» — вернуть воеводе." if u.man else "Приказ полка: " + ordn(g.cur), "c": DIM})
		if u.formLock:
			L.append({"t": "Строй задан вами — воевода его не меняет.", "c": DIM})
	if u.gen:
		L.append({"t": "Здесь полководец: гонцы скачут от него." if own else "Здесь вражеский полководец.", "c": Art.pal("y")})
	if own and (u.pend != null or u.pendF != null):
		L.append({"t": "Гонец с приказом в пути…", "c": WARN})
	if u.hidden:
		L.append({"t": "Скрыты в лесу: враг их не видит." if own else "Засада!", "c": GOOD})
	return L

# ---------- итог боя ----------
func lessons() -> Array:
	if B.res.has("les"):
		return B.res.les
	var st := B.stat
	var L := []
	var sum := func(s: int) -> float: return st.mel[s] + st.sht[s] + st.pur[s]
	var ourL := maxf(1, sum.call(1))
	var theirL := maxf(1, sum.call(0))
	var won: bool = B.res.win == 0
	if st.sht[1] / ourL > 0.35:
		L.append(["Вражеские стрелы выкосили наших. От стрел — «стена» или натиск конницы на стрелков.", "#a0302a"])
	if st.chg[1] / ourL > 0.25:
		L.append(["Решил удар вражеской конницы. От всадников — копья, а лучше «ёж».", "#a0302a"])
	if st.flk[1] / ourL > 0.3:
		L.append(["Враг бил нам во фланг и тыл. Края строя прикрывают лес, река или резерв.", "#a0302a"])
	if st.pur[1] / ourL > 0.3:
		L.append(["Больше всего полегло бегущих. Дрогнувший полк гибнет — сплачивайте и держите резерв.", "#a0302a"])
	if st.flk[0] / theirL > 0.3:
		L.append(["Удары во фланг и тыл ломали врага — так и бейте.", "#2a6a2a"])
	if st.chg[0] / theirL > 0.25:
		L.append(["Натиск нашей конницы решил дело.", "#2a6a2a"])
	if st.sht[0] / theirL > 0.35:
		L.append(["Наши стрелки сделали своё дело.", "#2a6a2a"])
	if not won and theirL >= ourL * 0.9:
		L.push_front(["Врагов полегло не меньше, но наш дух сломался раньше: бегство одного полка увлекает соседей. Держите резерв и сплачивайте (G).", "#a0302a"])
	if won and ourL > theirL * 1.1:
		L.append(["Победа дорогой ценой: наших полегло больше, чем врагов.", "#8a5a2a"])
	if L.is_empty():
		var tm: bool = B.over != null and JS.t(B.over.get("time"))
		L.append([("Враг так и не сломил наш строй — поле осталось за нами." if tm else "Победа далась упорством строя: наши полки держались дольше врага.") if won else "Враг оказался крепче. Ищите выгодное поле, стрелков и удар во фланг.", "#2a6a2a" if won else "#3a2614"])
	if B.pursuit > 0:
		L.append(["Конница гнала бегущих: враг потерял ещё " + JS.s(B.pursuit) + ".", "#2a6a2a"] if won else ["Враг гнал наших: ещё " + JS.s(B.pursuit) + " не вернулись.", "#a0302a"])
	B.res.les = L.slice(0, 3)
	return B.res.les

func _report(x: float, yy: float) -> void:
	var st := B.stat
	if st.is_empty():
		return
	hline(x + 12, yy, 416, "#b89a68")
	yy += 4
	txt("Как полегли", x + 14, yy, INK2, "s")
	txt("врагов", x + 130, yy, INK2, "s")
	txt("наших", x + 168, yy, INK2, "s")
	txt("Уроки боя", x + 214, yy, INK2, "s")
	var y2 := yy + 9
	for r in [["от стрел и болтов", "sht"], ["в рукопашной", "mel"], ["· натиском конницы", "chg"], ["· ударом во фланг", "flk"], ["бегущими", "pur"]]:
		txt(r[0], x + 14, y2, INK, "s")
		txt(n0(st[r[1]][0]), x + 130, y2, INK, "s")
		txt(n0(st[r[1]][1]), x + 168, y2, INK, "s")
		y2 += 8
	if B.pursuit > 0:
		var w0: bool = B.res.win == 0
		txt("в погоне", x + 14, y2, INK, "s")
		txt(JS.s(B.pursuit) if w0 else "—", x + 130, y2, INK, "s")
		txt("—" if w0 else JS.s(B.pursuit), x + 168, y2, INK, "s")
	var y3 := yy + 9
	for l in lessons():
		y3 += para(l[0], x + 214, y3, 212, l[1], "s", 8) + 2

const FT := {"killed": ["пал", "#a0302a"], "captured": ["в плену", "#a0302a"], "fled": ["бежал", "#8a5a2a"], "freed": ["отбит из плена", "#2a6a2a"]}

func draw_end(on_ok: Callable) -> void:
	var res: Dictionary = B.res
	var pw: bool = res.win == 0
	var our: Dictionary = res.sides[0]
	var their: Dictionary = res.sides[1]
	var p := dlg_box(440, 246, "Победа!" if pw else ("Отступление" if JS.t(res.get("retreat")) or JS.t(B.over.get("retreat")) else "Поражение"))
	var x := p.x
	var y := p.y
	spr_k("i_crown" if pw else "i_flag", x + 18, y + 28, 3.0)
	var yy := y + 26
	txt("Наши потери: " + JS.s(our.lost) + " (убито " + JS.s(our.killed) + ", ранено " + JS.s(our.wounded) + ") · потери врага: " + JS.s(their.lost), x + 56, yy, INK, "s")
	yy += 10
	if pw and res.get("loot") is Dictionary:
		var Lt: Dictionary = res.loot
		var parts := []
		for q in [["gold", "", " зол."], ["food", "провиант ", ""], ["arrows", "стрелы ", ""], ["weap", "оружие ", ""], ["horses", "кони ", ""], ["prisoners", "пленные ", ""]]:
			if JS.n(Lt.get(q[0])) > 0:
				parts.append(q[1] + JS.s(Lt[q[0]]) + q[2])
		if parts.size():
			yy += para("Добыча: " + ", ".join(parts) + ".", x + 56, yy, 370, INK, "s", 8)
	if String(res.get("genFate", "")) != "":
		yy += para(res.genFate, x + 56, yy, 370, "#a0302a" if JS.t(res.get("genBad")) else "#2a6a2a", "s", 8) + 1
	if res.get("sett") != null and pw:
		txt("Крепость наша!", x + 56, yy, cc("#2a6a2a"), "s")
		yy += 9
	# как сражались полки и их воеводы
	yy = maxf(yy + 4, y + 62)
	hline(x + 12, yy, 416, "#b89a68")
	yy += 4
	for q in [["Полк", 14], ["Воевода", 110], ["Итог", 226], ["Было", 262], ["Осталось", 296], ["Сразили", 344]]:
		txt(q[0], x + q[1], yy, INK2, "s")
	yy += 9
	for r: Dictionary in res.regs[0]:
		txt(REGD[r.k] + " " + SimBattle.REGS[r.k], x + 14, yy, INK, "s")
		var ft: Variant = FT.get(r.fate) if r.get("fate") != null else null
		txt(fit_t(String(r.cmd), 120, "s") if r.get("cmd") != null else "—", x + 110, yy, cc("#7a5a10") if JS.t(r.get("gen")) else INK, "s")
		if ft != null:
			txt(ft[0], x + 226, yy, cc(ft[1]), "s")
		elif JS.n(r.get("up")) > 0:
			txt("+" + JS.s(r.up) + " умение", x + 222, yy, cc("#2a6a2a"), "s")
		elif JS.t(r.get("fled")):
			txt("бежали", x + 226, yy, cc("#8a5a2a"), "s")
		txt(JS.s(r.men0), x + 262, yy, INK, "s")
		txt(JS.s(r.men), x + 296, yy, cc("#a0302a") if r.men < r.men0 * 0.5 else INK, "s")
		txt(JS.s(r.kills), x + 344, yy, INK, "s")
		yy += 9
	var er: Array = res.regs[1]
	if er.size():
		yy += 3
		txt(fit_t("Враг: " + " · ".join(er.map(func(r): return String(SimBattle.REGS[r.k]) + " " + JS.s(r.men) + "/" + JS.s(r.men0))), 412, "s"), x + 14, yy, INK2, "s")
		yy += 9
	_report(x, maxf(yy + 4, y + 128))
	btn("be_ok", x + 140, y + 224, 160, 16, {"label": "На карту", "on": func(_c): on_ok.call()})
