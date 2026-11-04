extends "res://scripts/world/court_wins.gd"
## Окна карты королевства — перенос screens2.js (drawEncounter, drawBattleResult, drawCapturedModal), screens.js (drawSettWin: осада и сведения), ui.js (drawArmyCard — карточка войска короля),
## command.js (capitalGate); окно войск короны (drawCmdWin) и приборы рисования — в основе, map_ui_base.gd. Как в HTML: очередь окон-вестей
## UI.modals (на экране — первое), одно окно UI.win и разговор с выбором; пока что-то открыто, время на карте стоит.
## «В бой — командовать» и «Штурм — командовать» уходят наружу (battle: main откроет поле боя), въезд в замок — тоже
## (to_court). Всплывающие строки (toast) — здесь же, поверх окон. Окна двора (Малый совет, письма, вести с выбором,
## объявление войны, Совет короны) — общие с замком, в court_wins.gd.
func _process(d: float) -> void:
	super(d)
	queue_redraw()

## часы мигания в разговоре: время двора на карте стоит
func _clock() -> float:
	return now()


# ---------- окна ----------
func open_cmd(sel: Variant = -1, preset: Variant = null) -> void:
	win = {"k": "cmd", "sel": sel, "mode": "intent", "pick": "", "app": 0, "sc": 0, "preset": preset}

## сведения о поселении со стола карт (settinfo): король при дворе
func open_settinfo(sid: int) -> void:
	win = {"k": "settinfo", "id": sid}

func open_sett(sid: int) -> void:
	win = {"k": "sett", "id": sid, "tab": 0}

## каждый кадр карты: всплывающие строки и вести королевства (UI.alert) — в окна, пауза по прибытии
func tick() -> void:
	if Sim.G.is_empty():
		return
	for s in SimPlayer.toasts:
		toast(s)
	SimPlayer.toasts.clear()
	if not SimDay.alerts.is_empty():
		var L: Array = SimDay.alerts
		SimDay.alerts = []
		for e in L:
			_on_alert(e)
	SimPlayer.modal = modal_open()
	if JS.t(Sim.G.get("toCourt")) and not modal_open():
		Sim.G.toCourt = 0.0
		win = null
		target = null
		to_court.emit("throne_front")

func _on_alert(e: Dictionary) -> void:
	match String(e.k):
		"pause":
			auto_pause(String(e.get("t", "")))
		"sett":
			arrive_sett(int(e.s))
		"enc":
			alert("enc", e.b)
		"captured":
			alert("captured", int(e.s))
		"svc":
			var a: Variant = Sim.armyById(e.army)
			if a != null and a.kind == "player":
				alert("event", _svc_event(a))
		_:
			court_alert(e)

## пауза по событию (autoPause): часы стоят, строка «… · пауза»
func auto_pause(reason: String) -> void:
	if Game.speed > 0:
		Game.last_speed = Game.speed
	Game.set_speed(0)
	if reason != "":
		toast(reason + " · пауза")


# ---------- ввод ----------
## клавиша: true — окна её забрали
func key(k: int) -> bool:
	if dlg != null:
		dlg_key(k)
		return true
	if busy != "":
		return true
	if k == KEY_ESCAPE:
		if target != null:
			target = null
			toast("Отменено.")
			return true
		if win != null:
			win = null
			return true
		return not modals.is_empty()
	if not modals.is_empty():
		return true
	if k == KEY_V or k == KEY_G:
		if win != null and win.k == "cmd":
			win = null
		else:
			open_cmd()
		return true
	if k == KEY_K or k == KEY_L:
		toggle_win("council" if k == KEY_K else "letters")
		return true
	if win != null and k == KEY_SPACE:
		win = null
		return false
	var pa: Variant = Sim.playerArmy() if not Sim.G.is_empty() else null
	if k == KEY_C and pa != null and mv != null:
		mv.center_army()
		return true
	if k == KEY_F and pa != null:
		SimPlayer.setMode("march" if pa.mode == "forage" else "forage")
		return true
	return false



# ---------- рисование ----------
func _draw() -> void:
	begin_hits()
	n_draw += 1
	if not Sim.G.is_empty() and (mv == null or mv.on):
		_card()
		if win != null:
			if win.k == "cmd":
				_cmd_win(win)
			elif win.k == "sett":
				_sett_win(win)
			elif win.k == "settinfo":
				_settinfo_win(win)
			else:
				_court_win(win)
		if not modals.is_empty():
			_modal(modals[0])
		if dlg != null:
			blocker()
			_dialog()
		elif busy != "":
			_busy()
		if dlg == null:
			hover_tip()
	_toast()
	end_hits()
	wheel = 0

# ---------- карточка войска короля (drawArmyCard) ----------
func _card() -> void:
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	var x := 2.0
	var y := H - 80.0
	var w := 236.0
	panel_wood(x, y, w, 78)
	var g: Variant = Sim.charOf(pa.gen)
	port48(g, x + 5, y + 5)
	stroke_r(x + 4, y + 4, 50, 50, "#c9a060")
	var tl := [Sim.charName(g) if g != null else "Король", " ".join((g.traits as Array).map(func(t): return String(Sim.TRAITS[t].n) + ": " + String(Sim.TRAITS[t].d)) if g != null else []), {"t": "Щелчок — войска короны (V)", "c": DIM}]
	hit(x + 4, y + 4, 50, 50, {"id": "card_por", "tip": tl, "on": func(_c): open_cmd(pa.id)})
	tx(Sim.charName(g) if g != null else "Король", x + 58, y + 6, Art.pal("y"))
	var gr: Dictionary = GROUNDS.get(String(pa.get("ground", "open")), GROUNDS.open)
	tx("Земля: " + gr.n, x + 58, y + 16, "#c8d8a8", "s")
	hit(x + 58, y + 14, 120, 9, {"id": "card_gr", "tip": ["Девять местностей (гл. 11): " + gr.n, {"t": "«" + gr.q + "»", "c": "#e8d8b0"}, gr.e]})
	var md := ""
	if pa.siegeOf >= 0:
		md = "Осада: " + String(Sim.W.setts[int(pa.siegeOf)].name)
	elif pa.path != null:
		md = ("Форсированный марш" if JS.t(pa.get("forced")) else "Марш") + (" (погоня)" if Sim.G.player.follow >= 0 else "")
	else:
		md = String(SimPlayer.MODE_INFO[pa.mode].n) if SimPlayer.MODE_INFO.has(String(pa.get("mode", ""))) else "Стоит"
	tx(md, x + 58, y + 25, "#fff2c8", "s")
	var uts: Array = Sim.UT.filter(func(t): return JS.n(pa.u.get(t)) > 0)
	var ust := floorf(170.0 / uts.size()) if uts.size() > 5 else 34.0
	var ux := x + 58
	for t in uts:
		spr_k(UICON[t], ux, y + 34)
		tx(JS.s(JS.rnd(pa.u[t])), ux + 7, y + 34, Art.pal("w"), "s")
		var U: Dictionary = Sim.UNIT[t]
		hit(ux, y + 32, ust - 2, 9, {"id": "card_u" + t, "tip": [String(U.n) + ": " + JS.s(JS.rnd(pa.u[t])), "Атака " + JS.s(U.atk) + ", защита " + JS.s(U.def) + ", опыт " + JS.s(JS.rnd(JS.n(pa.xp.get(t))))]})
		ux += ust
	var men := Sim.armyMen(pa)
	var eat := men + JS.n(pa.get("wounded")) + JS.n(pa.get("sick"))
	var horsesN := Sim.mountedN(pa.u) + JS.n(pa.get("horses")) + JS.n(pa.get("wagons")) * 2
	var rn := Sim.rangedN(pa.u)
	var load := SimDay.armyLoad(pa)
	var capw := Sim.armyCap(pa)
	var sup := [["i_food", pa.food / maxf(1, eat), "Провиант на %.1f дн. (%s)" % [pa.food / maxf(1, eat), JS.s(JS.rnd(pa.food))]],
		["i_fodder", JS.n(pa.get("fodder")) / horsesN if horsesN > 0 else 99.0, "Фураж: " + JS.s(JS.rnd(JS.n(pa.get("fodder")))) + " (коней и волов " + JS.s(horsesN) + "; весной и летом пасутся)"],
		["i_arrows", JS.n(pa.get("arrows")) / rn if rn > 0 else 99.0, "Стрелы и болты: " + JS.s(JS.rnd(JS.n(pa.get("arrows")))) + (" (" + JS.s(JS.rnd(JS.n(pa.get("arrows")) / rn)) + " на стрелка)" if rn > 0 else "")],
		["i_wagon", 1.0 - load / maxf(1, capw), "Обоз: " + JS.s(JS.rnd(load)) + " / " + JS.s(capw) + " (повозок " + JS.s(JS.n(pa.get("wagons"))) + ")"]]
	for i in sup.size():
		var sx := x + 6 + i * 57
		var sy := y + 58
		spr_k(sup[i][0], sx, sy)
		var vv: float = sup[i][1] if sup[i][0] == "i_wagon" else clampf(sup[i][1] / 10.0, 0, 1)
		bar(sx + 7, sy, 46, 6, vv, "#c0353f" if vv < 0.2 else ("#e0a630" if vv < 0.45 else "#7fb04c"))
		hit(sx, sy - 1, 54, 8, {"id": "card_s" + str(i), "tip": sup[i][2]})
	var mx := x + 6
	var my := y + 67
	for e in CARD_MODES:
		var m: String = e[0]
		var act: bool = pa.path != null if m == "march" else (pa.path == null and pa.mode == m)
		var I: Dictionary = SimPlayer.MODE_INFO[m]
		btn("mode_" + m, mx, my, 15, 10, {"ic": e[1], "style": "dark", "active": act, "tip": [I.n, I.d], "on": func(_c): _card_mode(m)})
		mx += 16
	var fo := JS.t(pa.get("forced"))
	btn("mode_forced", mx, my, 15, 10, {"ic": "i_play3", "style": "dark", "active": fo, "tip": ["Форсированный марш: " + ("ВКЛ" if fo else "выкл"), "Скорость +35%, но усталость ×3. «Пройдёшь сто ли ради выгоды — потеряешь полководцев» (гл. 7)."],
		"on": func(_c): pa.forced = 0.0 if JS.t(pa.get("forced")) else 1.0})
	mx += 16
	var fi := JS.t(pa.get("fires"))
	btn("mode_fires", mx, my, 15, 10, {"ic": "i_fire", "style": "dark", "active": fi, "tip": ["Ложные костры: " + ("ВКЛ" if fi else "выкл"), "Жечь вдвое больше костров: враг сочтёт войско почти вдвое большим. «Война — путь обмана» (гл. 1)."],
		"on": func(_c): SimPlayer.setMode("fires")})
	mx += 16
	btn("mode_center", mx + 4, my, 15, 10, {"ic": "i_pin", "style": "dark", "tip": "Показать войско (C)", "on": func(_c): if mv: mv.center_army()})
	btn("card_open", x + w - 18, y + 5, 13, 11, {"ic": "i_scroll", "style": "dark", "tip": "Войска короны (V)", "on": func(_c): open_cmd(pa.id)})

func _card_mode(m: String) -> void:
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	if m == "march":
		pa.forced = 0.0
		toast("Обычный шаг")
		return
	SimPlayer.setMode(m)


# ---------- окна-вести ----------
func _modal(m: Dictionary) -> void:
	match String(m.k):
		"enc":
			_enc(m)
		"bres":
			_bres(m)
		"captured":
			_captured(m)
		_:
			if not _court_modal(m):
				close_modal()

static func advice(r: float) -> String:
	if r >= 8:
		return "Сил вдесятеро больше — окружай."
	if r >= 4:
		return "Сил впятеро больше — нападай."
	if r >= 1.8:
		return "Сил вдвое больше — раздели врага и бей по частям."
	if r >= 0.85:
		return "Силы равны — сражайся умело: местность и хитрость решат."
	if r >= 0.5:
		return "Сил меньше — умей оторваться от врага."
	return "Враг много сильнее — уклоняйся. «Упорство слабого — добыча сильного»."

func _side_card(x: float, y: float, w: float, a: Dictionary, title: String, isP: bool) -> void:
	var g: Variant = Sim.charOf(a.gen)
	var e := SimIntel.estimateMen(a)
	rect(x, y, w, 96, "rgba(160,120,60,0.15)")
	if g != null and a.kind != "caravan":
		port48(g, x + 4, y + 4)
	else:
		shield(a.realm, x + 20, y + 20, 2.0)
	tx(title, x + 56, y + 4, INK)
	tx(Sim.charName(g) if g != null else "", x + 56, y + 14, INK2, "s")
	tx(("" if JS.t(e.exact) else "~") + SimArmy.voin(e.n), x + 56, y + 24, INK)
	if JS.t(e.exact) or isP:
		var i := 0
		for t in Sim.UT:
			if JS.n(a.u.get(t)) <= 0:
				continue
			var gx := x + 56 + (i % 4) * 37
			var gy := y + 35 + (i / 4) * 10
			spr_k(UICON[t], gx, gy)
			tx(JS.s(JS.rnd(a.u[t])), gx + 7, gy, INK, "s")
			hit(gx, gy - 1, 34, 9, {"id": "sc" + ("p" if isP else "e") + t, "tip": String(Sim.UNIT[t].n)})
			i += 1
	tx("Дух " + JS.s(JS.rnd(a.morale)) + " · устал. " + JS.s(JS.rnd(JS.n(a.get("fat")))) + "%", x + 6, y + 58, INK2, "s")
	var gr: Dictionary = GROUNDS[SimDay.groundOf(a) if a.kind == "lord" or a.kind == "player" else "open"]
	tx("Земля: " + gr.n, x + 6, y + 68, INK2, "s")
	hit(x + 4, y + 66, w - 8, 10, {"id": "scg" + JS.s(a.id), "tip": [gr.n, "«" + gr.q + "»", gr.e]})
	if a.mode == "fort" and JS.n(a.get("fortDays")) >= 2:
		tx("Укреплённый лагерь!", x + 6, y + 78, "#a0302a", "s")
	elif JS.t(a.get("hidden")):
		tx("Затаились в засаде", x + 6, y + 78, "#2a6a2a", "s")

## встреча с врагом (drawEncounter): силы, земля, совет Сунь-цзы — бой на поле, автобой, сдача, отход, пропустить
func _enc(m: Dictionary) -> void:
	var b: Variant = Sim.armyById(m.d)
	var pa: Variant = Sim.playerArmy()
	if b == null or pa == null:
		close_modal()
		return
	var G := Sim.G
	var hunting: bool = b.get("ai") is Dictionary and b.ai.get("task") == "hunt" and b.ai.get("prey") == pa.id
	var amb: bool = JS.t(pa.get("hidden")) and not hunting
	var p := dlg_box(460, 262, "Засада! Враг идёт прямо на нас" if amb else ("На нас напали!" if hunting else "Встреча с врагом"))
	var x := p.x
	var y := p.y
	var t0 := Sim.armyTile(pa)
	var Wt: Dictionary = Sim.weatherOf()
	_side_card(x + 12, y + 24, 214, pa, "Войско короля", true)
	_side_card(x + 234, y + 24, 214, b, SimArmy.armyLabel(b), false)
	var ratio := enc_ratio(pa, b)
	tx("Местность: " + String(Sim.TINFO[Sim.W.ter[t0]].n) + (", река" if Sim.W.river[t0] else "") + " · погода: " + String(Wt.n), x + 14, y + 126, INK, "s")
	tx("Сунь-цзы: «" + advice(ratio) + "»", x + 14, y + 137, "#6a3a1a")
	var rc := enc_rc(pa, b, hunting)
	var dem := enc_dem_p(pa, b, ratio)
	var by := y + 154
	var bw := 212.0
	btn("e_fight", x + 14, by, bw, 15, {"label": "Ударить из засады — командовать" if amb else "В бой — командовать", "ic": "i_sword", "on": func(_c): enc_fight(b, amb)})
	btn("e_auto", x + 234, by, bw, 15, {"label": "Автобой", "ic": "i_hourglass", "on": func(_c): enc_auto(b, amb)})
	by += 19
	btn("e_dem", x + 14, by, bw, 15, {"label": "Потребовать сдачи (" + str(roundi(dem * 100)) + "%)", "ic": "i_flag", "disabled": dem <= 0.01,
		"tip": ["«Лучшее — сохранить чужое войско целым» (гл. 3).", "Шанс растёт с перевесом сил, нашей славой и упадком их духа."], "on": func(_c): enc_dem(b, dem)})
	btn("e_ret", x + 234, by, bw, 15, {"label": "Отступить (" + str(roundi(rc * 100)) + "%)", "ic": "i_play3", "tip": "Если не выйдет — арьергард прикроет отход ценой потерь.", "on": func(_c): enc_ret(b, rc)})
	by += 19
	if not hunting:
		btn("e_pass", x + 14, by, bw, 15, {"label": "Пропустить их", "on": func(_c): enc_pass(b)})
	if b.kind != "bandit" and b.kind != "caravan" and b.realm < 5:
		btn("e_dip", x + 234, by, bw, 15, {"label": "Переговоры (дипломатия)", "ic": "i_dip", "disabled": true, "tip": ["Переговоры с державой " + Sim.realmName(b.realm), {"t": "Окно дипломатии — в следующих версиях.", "c": DIM}]})

## перевес (как в drawEncounter): наша сила против той, что видится у врага (ложные костры, глазомер разведки)
static func enc_ratio(pa: Dictionary, b: Dictionary) -> float:
	var e := SimIntel.estimateMen(b)
	return SimDay.powerU(pa.u, pa.xp) / maxf(1, SimAI.perceivedPower(b, Sim.G.player.realm) * (1 / 1.8 if JS.t(b.get("fires")) else 1.0) * (e.n / maxf(1, Sim.armyMen(b))))

static func enc_rc(pa: Dictionary, b: Dictionary, hunting: bool) -> float:
	var sp := SimArmy.armySpeed(pa)
	var sb := SimArmy.armySpeed(b)
	return clampf(0.5 + (sp - sb) / maxf(1, sb) * 0.9 + (-0.15 if hunting else 0.2), 0.1, 0.95)

static func enc_dem_p(_pa: Dictionary, b: Dictionary, ratio: float) -> float:
	var G := Sim.G
	return clampf((ratio - 1.5) * 0.18 + (0.25 if b.kind == "caravan" else 0.0) + (0.05 if b.kind == "bandit" else -0.1) + (0.15 if b.morale < 40 else 0.0) + JS.n(G.realms[int(G.player.realm)].get("fear")) * 0.003, 0, 0.9)

func _cool(b: Dictionary, d: float) -> void:
	var G := Sim.G
	if not (G.get("encCool") is Dictionary):
		G.encCool = {}
	G.encCool[JS.s(b.id)] = SimPlayer.now_d() + d

func enc_fight(b: Dictionary, amb: bool) -> void:
	close_modal()
	var pa: Variant = Sim.playerArmy()
	if pa == null or not JS.t(b.alive):
		return
	var o := {"b": b.id, "tplA": "amb" if amb and Sim.mountedN(pa.u) > 0 else "std", "amb": amb}
	battle.emit(SimCapt.sideFromArmy(pa), SimCapt.sideFromArmy(b), Sim.armyTile(pa), o)

func enc_auto(b: Dictionary, amb: bool) -> void:
	close_modal()
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	await _auto_begin()
	if not JS.t(b.alive) or Sim.playerArmy() != pa:
		_auto_end()
		return
	if amb:
		b.morale -= 20
	var res: Dictionary = await SimCapt.autoBattle(pa, b)
	_auto_end()
	res.auto = true
	res.amb = amb
	alert("bres", res)

## бой без экрана из окна: королевство досчитывает шаг или день и ждёт; бой идёт кусками по 150 мс за кадр
## (окно всё равно ждёт — частые кадры не нужны, а в вебе каждый кадр карты дорог)
func _auto_begin() -> void:
	busy = "Идёт бой…"
	SimPlayer.modal = true
	while SimDay.busy or Game.stepping:
		await get_tree().process_frame
	Game.hold = true
	SimDay.budget_us = 150000
	SimDay.slice_t = Time.get_ticks_usec()

func _auto_end() -> void:
	Game.hold = false
	busy = ""

func enc_dem(b: Dictionary, dem: float) -> void:
	close_modal()
	var G := Sim.G
	var pa: Variant = Sim.playerArmy()
	if pa == null or not JS.t(b.alive):
		return
	_cool(b, 2)
	var R0: Dictionary = G.realms[int(G.player.realm)]
	if Sim.R.f() < dem:
		var loot := {"food": JS.rnd(b.food * 0.7), "arrows": JS.rnd(JS.n(b.get("arrows")) * 0.7), "gold": JS.rnd(JS.n(b.get("goods")) * 0.8 + JS.n(b.get("loot")) + (15.0 if b.kind == "bandit" else 0.0))}
		pa.food += loot.food
		pa.arrows = JS.n(pa.get("arrows")) + loot.arrows
		R0.gold += loot.gold
		pa.prisoners = JS.n(pa.get("prisoners")) + JS.rnd(Sim.armyMen(b) * 0.5)
		SimDay.destroyArmy(b, "сдались")
		R0.prestige = JS.n(R0.get("prestige")) + 2
		R0.fear = JS.n(R0.get("fear")) + 2
		Sim.glog(_cap(SimArmy.armyLabel(b)) + " сложили оружие! Добыча: " + JS.s(loot.gold) + " зол., провиант " + JS.s(loot.food) + ".", "good")
	else:
		Sim.glog(_cap(SimArmy.armyLabel(b)) + ": «Не дождётесь!» — сдаться отказались.", "bad")
		b.morale += 5
		alert("enc", b.id)

func enc_ret(b: Dictionary, rc: float) -> void:
	close_modal()
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	_cool(b, 1.5)
	if Sim.R.f() < rc:
		SimArmy.retreatArmy(pa, b)
		Sim.glog("Войско отступило без потерь.", "info")
	else:
		var k := SimDay.takeMen(pa, JS.rnd(Sim.armyMen(pa) * 0.07))
		pa.morale -= 8
		SimArmy.retreatArmy(pa, b)
		Sim.glog("Отход стоил " + SimArmy.voin(k) + " арьергарда.", "bad")

func enc_pass(b: Dictionary) -> void:
	close_modal()
	_cool(b, 2)

static func _cap(s: String) -> String:
	return s.substr(0, 1).to_upper() + s.substr(1) if s != "" else s

## итог боя без экрана (drawBattleResult): потери, добыча, судьба полководцев
func _bres(m: Dictionary) -> void:
	var res: Dictionary = m.d
	var pw := res_won(res)
	var our: Dictionary = res.sides[0]
	var their: Dictionary = res.sides[1]
	var p := dlg_box(380, 190, "Победа!" if pw else "Поражение")
	var x := p.x
	var y := p.y
	spr_k("i_crown" if pw else "i_flag", x + 20, y + 30, 4.0)
	var yy := y + 28
	tx("Наши потери: " + JS.s(our.lost) + " (убито " + JS.s(our.killed) + ", ранено " + JS.s(our.wounded) + ")", x + 64, yy, INK)
	yy += 12
	tx("Потери врага: " + JS.s(their.lost), x + 64, yy, INK)
	yy += 12
	if pw and res.get("loot") is Dictionary:
		var L: Dictionary = res.loot
		var parts := []
		for e in [["gold", " зол.", ""], ["food", "", "провиант "], ["arrows", "", "стрелы "], ["weap", "", "оружие "], ["horses", "", "кони "], ["prisoners", "", "пленные "]]:
			if JS.n(L.get(e[0])) > 0:
				parts.append(e[2] + JS.s(L[e[0]]) + e[1])
		if not parts.is_empty():
			yy += para("Добыча: " + ", ".join(parts) + ".", x + 64, yy, 300, INK)
	if String(res.get("genFate", "")) != "":
		yy += para(String(res.genFate), x + 64, yy, 300, "#a0302a" if JS.t(res.get("genBad")) else "#2a6a2a") + 2
	yy += 4
	para("«Победоносное войско сначала побеждает, а потом ищет сражения» (гл. 4)." if pw else "«Непобедимость — в себе самом, возможность победы — в противнике» (гл. 4). Отдохните, пополните ряды.", x + 64, yy, 300, "#6a3a1a")
	btn("br_ok", x + 110, y + 162, 160, 16, {"label": "Далее", "on": func(_c): bres_ok(res)})

static func res_won(res: Dictionary) -> bool:
	if JS.t(res.get("auto")):
		return bool(res.winA) if res.has("winA") else bool(res.win)
	return int(res.win) == 0

func bres_ok(res: Dictionary) -> void:
	close_modal()
	if res.get("sett") != null and res_won(res):
		var S: Dictionary = Sim.G.setts[int(res.sett)]
		var pa: Variant = Sim.playerArmy()
		if pa != null and S.ctrl != Sim.G.player.realm:
			SimArmy.captureSett(pa, S, "штурм")

## поселение взято (drawCapturedModal): разграбить или пощадить
func _captured(m: Dictionary) -> void:
	var sid: int = m.d
	var ws: Dictionary = Sim.W.setts[sid]
	var S: Dictionary = Sim.G.setts[sid]
	var pa: Variant = Sim.playerArmy()
	var p := dlg_box(400, 160, "Взят " + String(ws.name) + "!")
	var x := p.x
	var y := p.y
	_sett_spr(sid, x + 14, y + 30, 1)
	para("Ворота открыты, стяг державы поднят над башнями. Что делать с городом? «На тяжёлой земле — грабь», учит Сунь-цзы, но разграбленные земли долго не дадут дохода и озлобят соседей.", x + 80, y + 26, 306, INK)
	if pa == null:
		btn("cp_ok", x + 120, y + 132, 160, 16, {"label": "Далее", "on": func(_c): close_modal()})
		return
	var P: Dictionary = Sim.G.provs[int(ws.prov)]
	var est := JS.rnd(S.pop / 40.0 * (S.prosp / 60.0) * (1 - P.dev))
	btn("cp_loot", x + 14, y + 130, 180, 16, {"label": "Разграбить (~" + JS.s(est) + " зол.)", "ic": "i_gold", "tip": "Золото и провиант сейчас; процветание −25, смута +30, мнение соседей падает.",
		"on": func(_c): cap_loot(sid)})
	btn("cp_spare", x + 206, y + 130, 180, 16, {"label": "Пощадить жителей", "ic": "i_dip", "tip": "Смута −20; честные правители оценят.", "on": func(_c): cap_spare(sid)})

func cap_loot(sid: int) -> void:
	var pa: Variant = Sim.playerArmy()
	close_modal()
	if pa == null:
		return
	var r := SimPlayer.lootSett(pa, Sim.G.setts[sid])
	Sim.glog("Разграблен " + String(Sim.W.setts[sid].name) + ": +" + JS.s(r.gold) + " зол., +" + JS.s(r.food) + " провианта.", "info")

func cap_spare(sid: int) -> void:
	close_modal()
	var P: Dictionary = Sim.G.provs[int(Sim.W.setts[sid].prov)]
	P.unrest = maxf(0, P.unrest - 20)
	for r in range(1, 5):
		var tr: Array = SimDay.rulerOf(r).traits
		if tr.has("honest") or tr.has("generous"):
			SimDay.addOpn(r, Sim.G.player.realm, 3)




## ополчение ропщет (svcAsk): заплатить за 20 дней, отпустить, пусть ропщут
func _svc_event(a: Dictionary) -> Dictionary:
	var lv := JS.n(a.u.get("levy"))
	var cost := maxf(10, JS.rnd(lv * (0.25 if SimDyn.hasTech("standing") else 0.5)))
	var R0: Dictionary = Sim.G.realms[int(Sim.G.player.realm)]
	var e := {"title": "Ополчение ропщет", "ic": "flag", "opts": [
		{"t": "Заплатить: ещё 20 дней (−" + JS.s(cost) + " зол.)", "tip": "По пол-золотого на ополченца.", "ok": func(): return R0.gold >= cost,
			"fx": func():
				R0.gold -= cost
				a.svcPaid = JS.n(a.get("svcPaid")) + 20
				Sim.glog("Ополчению заплачено: служат ещё 20 дней.", "info")},
		{"t": "Отпустить по домам сейчас", "tip": "Уйдут с честью: смута не вырастет.",
			"fx": func():
				var n := JS.n(a.u.get("levy"))
				a.u.levy = 0.0
				Sim.glog("Ополчение распущено по домам: " + JS.s(n) + ".", "info")},
		{"t": "Пусть ропщут", "tip": "Через 5 дней начнут уходить сами.", "fx": func(): pass}]}
	return {"e": e, "text": ("Шестьдесят" if SimDay.svcDays() > SimDay.SVC_DAYS else "Сорок") + " дней службы на исходе: через 5 дней ополченцы (" + JS.s(lv) + ") пойдут по домам — пахать и сеять. Профессиональные воины остаются."}



# ---------- поселение (drawSettWin: осада, сведения) ----------
## войско короля пришло в поселение (arriveSett): у своей столицы — ворота замка, иначе — окно поселения
func arrive_sett(sid: int) -> void:
	var G := Sim.G
	var S: Dictionary = G.setts[sid]
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	if G.has("court") and sid == int(G.realms[0].capital) and S.ctrl == 0.0 and pa.kind == "player" and pa.siegeOf < 0:
		capital_gate(sid)
		return
	open_sett(sid)

## у ворот столицы (capitalGate): въехать ко двору, город, остаться в поле
func capital_gate(sid: int) -> void:
	var ws: Dictionary = Sim.W.setts[sid]
	say(null, "Столица " + String(ws.name) + ". Над воротами замка — ваш стяг; стража трубит в рог.", {"name": "У ворот столицы", "choices": [
		{"t": "Въехать в замок — ко двору", "fx": func(): enter_court()},
		{"t": "Город: осада, сведения", "fx": func(): open_sett(sid)},
		{"t": "Остаться в поле", "fx": func(): pass}], "esc": 2})
	print("GATE MAP ", sid)

## въезд в замок (enterCourt): войско у стен — рыцарю, король — ко двору
func enter_court() -> void:
	SimPlayer.enterCourt()
	win = null
	target = null
	modals = modals.filter(func(m): return m.k != "enc")
	to_court.emit("gate_in")

func _sett_spr(sid: int, x: float, y: float, sc: float) -> Vector2:
	if mv == null:
		return Vector2.ZERO
	var s: Dictionary = mv.G.W.setts[sid]
	var cul := String(mv.G.W.provs[s.prov].cul)
	if cul == "":
		cul = "K"
	var key := String(s.type) + cul + str(int(s.id) % 3)
	if not mv.G.M.sett.has(key):
		return Vector2.ZERO
	var si := int(mv.G.M.sett[key].s)
	spr(si, x, y, sc)
	return Art.size(si) * sc

func _sett_win(w: Dictionary) -> void:
	var sid: int = w.id
	var s: Dictionary = Sim.W.setts[sid]
	var S: Dictionary = Sim.G.setts[sid]
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		win = null
		return
	var X := 100.0
	var Y := 30.0
	var WW := 440.0
	win_frame(X, Y, WW, 300, "", true)
	var sz := Art.size(int(mv.G.M.sett.get(String(s.type) + (String(mv.G.W.provs[s.prov].cul) if String(mv.G.W.provs[s.prov].cul) != "" else "K") + str(sid % 3), {"s": -1}).s)) if mv != null else Vector2.ZERO
	_sett_spr(sid, X + 10, Y + 8, 1.0 if sz.x * 2 > 70 else 2.0)
	shield(S.ctrl, X + 76, Y + 10)
	tx(String(s.name), X + 92, Y + 10, INK)
	tx(String(SETT_T[s.type]) + " · " + Sim.realmName(S.ctrl) + (" (занято)" if S.owner != S.ctrl else ""), X + 92, Y + 21, INK2)
	tx("Провинция " + String(Sim.W.provs[int(s.prov)].name) + " · жителей " + SimArmy.fmt(S.pop) + (" · стены: " + WALLS[int(S.walls)] if JS.t(S.walls) else ""), X + 92, Y + 31, INK2, "s")
	var near := JSM.hypot(s.x + 0.5 - pa.x, s.y + 0.5 - pa.y) < 1.5
	var host := Sim.hostile(Sim.G.player.realm, S.ctrl)
	var T: Array = ["Осада", "Сведения"] if host or S.ctrl == 5.0 else ["Сведения"]
	if int(w.get("tab", 0)) >= T.size():
		w.tab = 0
	tabs(X + 12, Y + 44, T, 76)
	var tab: String = T[int(w.tab)]
	var y0 := Y + 64
	if not near and tab != "Сведения":
		para("Войско короля далеко отсюда. Подойдите к поселению, чтобы вести осаду.", X + 20, y0 + 20, WW - 40, INK)
		sbtn("s_go", X + WW / 2 - 50, y0 + 60, 100, "Идти сюда", func(_c): sett_go(sid))
		return
	if tab == "Осада":
		_siege_tab(sid, X, y0, WW)
	else:
		_sett_info(sid, X, y0, WW)

func sett_go(sid: int) -> void:
	win = null
	SimPlayer.orderMove(int(Sim.W.setts[sid].i), {"k": "sett", "s": sid})

## сведения о поселении со стола карт (drawSettInfoWin): король при дворе — послать войско или поехать самому
func _settinfo_win(w: Dictionary) -> void:
	var G := Sim.G
	var sid: int = w.id
	var S: Dictionary = G.setts[sid]
	var ws: Dictionary = Sim.W.setts[sid]
	var ride: bool = G.has("court") and JS.t(G.get("atCourt")) and sid != int(G.realms[0].capital)
	var X := W / 2.0 - 170.0
	var Y := 60.0
	var WW := 340.0
	var HH := 220.0 if ride else 200.0
	win_frame(X, Y, WW, HH, String(ws.name), true)
	var y := Y + 24
	var own: bool = S.ctrl == 0.0
	var seen: bool = own or int(G.vis[int(ws.i)]) == 2
	kv(X + 16, y, "Тип:", String(SETT_N[ws.type]) + " · " + ("вольные земли" if S.ctrl == 5.0 else ("разбойники" if S.ctrl == 6.0 else String(Sim.REALM_DEF[int(S.ctrl)].name))), true)
	y += 12
	kv(X + 16, y, "Гарнизон:", JS.s(Sim.menOf(S.gar)) if seen else "неизвестно", true)
	kv(X + 190, y, "Стены:", JS.s(S.walls), true)
	y += 12
	kv(X + 16, y, "Процветание:", JS.s(JS.rnd(S.prosp)) + "%", true)
	kv(X + 190, y, "Жителей:", SimArmy.fmt(S.pop), true)
	y += 12
	var hs: Variant = S.get("house", -1.0)
	if (hs is float or hs is int) and hs >= 0 and G.has("houses") and hs < G.houses.size():
		var lo: Variant = S.get("lord", -1.0)
		var l: Variant = Sim.charOf(lo) if (lo is float or lo is int) and lo >= 0 else null
		kv(X + 16, y, "Владетель:", "дом " + SimDyn.houseName(hs) + (" (" + Sim.charName(l) + ")" if l != null else ""), true)
		y += 12
	if JS.t(S.get("siege")):
		var b: Variant = Sim.armyById(S.siege.by)
		tx("В осаде! " + (SimArmy.armyLabel(b) if b != null else ""), X + 16, y, "#a03020")
		y += 12
	if ws.type != "village" and own:
		var P: Dictionary = G.provs[int(ws.prov)]
		var K := SimEcon.crownK(0.0)
		kv(X + 16, y, "Доход провинции:", SimText.fq(SimEcon.provIncome(int(ws.prov)) * K) + " зол./день (подати " + SimText.fq(JS.n(P.get("ecTax")) * K) + ", цеха " + SimText.fq(JS.n(P.get("ecCraft")) * K) + ")", true)
		y += 12
	var r: Dictionary = S.res if S.get("res") is Dictionary else SimEcon.settRiches(S)
	var rl: Array = []
	for e in RICH_N:
		if JS.n(r.get(e[0])) > 0.05:
			rl.append(String(e[1]) + " ×" + ("%.1f" % float(r[e[0]])).replace(".", ","))
	y += para("Богатства: " + (" · ".join(rl) if not rl.is_empty() else "скудные"), X + 16, y, WW - 32, INK2, "s", 9)
	var ml: Variant = SimText.settMarketLine(S)
	if ml is Dictionary:
		y += para(String(ml.t), X + 16, y, WW - 32, INK, "s", 9)
		y += 2
	y += 4
	para("Своя земля. Со стола карт король шлёт гонца с приказом войску — или едет сам." if own else "Чужая земля. Пошлите войско — или поезжайте сами.", X + 16, y, WW - 32, INK2, "s", 9)
	if ride:
		btn("si_ride", X + 16, Y + HH - 44, 200, 16, {"label": "Поехать туда самому…", "on": func(_c): _si_ride(sid),
			"tip": ["Король выедет из замка — со свитой или во главе войска у столицы.", {"t": "По прибытии — въезд" + (", осада или приступ." if Sim.hostile(0, S.ctrl) else " в поселение."), "c": DIM}]})
	if ws.type != "village" or not own:
		btn("si_send", X + 16, Y + HH - 24, 200, 16, {"label": "Послать войско защищать…" if own else "Послать войско в наступление…", "on": func(_c): open_cmd(-1, {"o": "defend" if own else "attack", "t": float(sid)})})
	btn("si_goods", X + WW - 96, Y + HH - 44, 80, 16, {"label": "Рынок…", "disabled": true, "tip": ["Товары и цены", "Окно рынка — в следующих версиях."]})
	btn("si_ok", X + WW - 96, Y + HH - 24, 80, 16, {"label": "Закрыть", "on": func(_c): close_win()})

func _si_ride(sid: int) -> void:
	win = null
	ride_to(sid)

func close_win() -> void:
	win = null

## поездка короля из замка (rideTo): со свитой или во главе войска у столицы; путь — сразу
func ride_to(sid: int) -> void:
	var G := Sim.G
	var C: Variant = G.get("court")
	if not (C is Dictionary) or not JS.t(G.get("atCourt")):
		return
	var ws: Dictionary = Sim.W.setts[sid]
	var cw: Dictionary = Sim.W.setts[int(G.realms[0].capital)]
	if C.get("regent") != null and float(C.regent) >= 0:
		say(null, "Регент " + SimPlayer.regentName() + " не велит юному государю покидать замок. Пошлите войско — или дождитесь совершеннолетия.")
		return
	var ca: Variant = SimPlayer.capitalArmy()
	var kn: Variant = Sim.charOf(ca.gen) if ca != null else null
	var ret: Variant = C.get("retinue")
	var foe := Sim.hostile(0, G.setts[sid].ctrl)
	var r0: Dictionary = (ret if ret is Dictionary else SimPlayer.mkRetinue()).duplicate()
	r0.x = cw.x + 0.5
	r0.y = cw.y + 0.5
	var days := SimArmy.pathDays(r0, SimArmy.planPath(r0, int(ws.i)))
	var eta := "пути нет" if is_inf(days) else ("меньше дня пути" if days < 1 else "около " + JS.s(roundf(days)) + " " + Sim.plural(roundf(days), "дня", "дней", "дней") + " пути")
	var ch: Array = [{"t": "Со свитой (" + JS.s(Sim.armyMen(ret) if ret is Dictionary else 22.0) + " чел.)", "tip": "Свита мала для войны: на чужой земле опасно." if foe else "Налегке и быстро. Двор будет жить без короля.", "fx": func(): _ride_go(null, sid, eta)}]
	if ca != null:
		ch.append({"t": "Во главе войска у столицы (" + JS.s(Sim.armyMen(ca)) + (", " + Sim.charName(kn) if kn != null else "") + ")", "tip": "Король ведёт войско сам: битвы — под вашей рукой.", "fx": func(): _ride_go(ca, sid, eta)})
	ch.append({"t": "Остаться в замке", "fx": func(): pass})
	say(null, "Ехать в " + String(ws.name) + " самому? Отсюда " + eta + ". Пока король в дороге, двор живёт без него: приёмы, советы и тайны — без государя." + (" Это вражеская земля." if foe else ""), {"name": "Поездка короля", "choices": ch, "esc": ch.size() - 1})

func _ride_go(a: Variant, sid: int, eta: String) -> void:
	var ws: Dictionary = Sim.W.setts[sid]
	SimPlayer.leaveCourt(a)
	rode_out()
	if SimPlayer.orderMove(int(ws.i), {"k": "sett", "s": float(sid)}):
		toast("Король выехал " + ("во главе войска" if a != null else "со свитой") + " · путь на " + String(ws.name) + " (" + eta + ").")

## король выехал (конец leaveCourt): окна закрыты, карта — к войску ×1, пауза «укажите путь»
func rode_out() -> void:
	win = null
	target = null
	if mv != null:
		mv.cam.z = 1.0
		mv.center_army()
	if Game.speed == 0:
		Game.speed = 1
	auto_pause("Король выехал в поле: укажите путь")

func _sett_info(sid: int, X: float, y0: float, WW: float) -> void:
	var s: Dictionary = Sim.W.setts[sid]
	var S: Dictionary = Sim.G.setts[sid]
	var P: Dictionary = Sim.G.provs[int(s.prov)]
	var own: bool = S.ctrl == Sim.G.player.realm
	var vis: bool = own or Sim.G.vis[int(s.i)] == 2 or SimIntel.hasInward(S.ctrl)
	var y := y0
	kv(X + 20, y, "Процветание:", JS.s(JS.rnd(S.prosp)) + "%", true)
	bar(X + 120, y, 80, 7, S.prosp / 100.0, "#7fb04c", "#d6be8c")
	y += 13
	kv(X + 20, y, "Разорение:", JS.s(JS.rnd(P.dev * 100)) + "%", true, "#a0302a" if P.dev > 0.3 else INK)
	y += 13
	kv(X + 20, y, "Смута:", JS.s(JS.rnd(P.unrest)) + "%", true, "#a0302a" if P.unrest > 50 else INK)
	y += 13
	var gl := ""
	if vis:
		gl = ", ".join(Sim.UT.filter(func(t): return JS.n(S.gar.get(t)) > 0).map(func(t): return String(Sim.UNIT[t].n).to_lower() + " " + JS.s(JS.rnd(S.gar[t]))))
	var gs := (JS.s(Sim.menOf(S.gar)) + (" (" + gl + ")" if gl != "" else "")) if vis else "неизвестно"
	if tw("Гарнизон: " + gs) < WW - 50:
		kv(X + 20, y, "Гарнизон:", gs, true)
		y += 13
	else:
		kv(X + 20, y, "Гарнизон:", JS.s(Sim.menOf(S.gar)), true)
		y += 11
		y += para(gl, X + 30, y, WW - 60, INK, "s", 9) + 3
	kv(X + 20, y, "Запасы крепости:", JS.s(JS.rnd(S.food)) + " дн." if vis else "?", true)
	y += 13
	if S.lord >= 0 and Sim.charOf(S.lord) != null:
		var l: Dictionary = Sim.charOf(S.lord)
		kv(X + 20, y, "Владетель:", Sim.charName(l) + " (" + ", ".join((l.traits as Array).map(func(t): return String(Sim.TRAITS[t].n))) + ")", true)
		y += 13
	y += 4
	para(TYPE_P[s.type], X + 20, y, WW - 40, INK2)

## осада (drawSiegeTab): гарнизон и стены, сдача, осада, огонь, штурм — на поле или без экрана
func _siege_tab(sid: int, X: float, y0: float, WW: float) -> void:
	var s: Dictionary = Sim.W.setts[sid]
	var S: Dictionary = Sim.G.setts[sid]
	var pa: Dictionary = Sim.playerArmy()
	var sg: Variant = S.siege if S.get("siege") is Dictionary and S.siege.by == pa.id else null
	var y := y0
	var ch := SimArmy.surrenderChance(pa, S)
	var ratio := SimDay.powerU(pa.u, pa.xp) / maxf(1, SimDay.powerU(S.gar, null) * (1 + S.walls * 0.5))
	kv(X + 20, y, "Гарнизон:", SimArmy.voin(Sim.menOf(S.gar)) + (" за стенами (" + WALLS[int(S.walls)] + ")" if JS.t(S.walls) else " (стен нет)"), true)
	y += 13
	kv(X + 20, y, "Соотношение сил:", ("%.1f" % ratio).replace(".", ",") + " : 1 (с учётом стен)", true, "#2a6a2a" if ratio > 2 else ("#a0302a" if ratio < 1 else INK))
	y += 13
	kv(X + 20, y, "Шанс сдачи:", str(roundi(ch * 100)) + "%", true)
	y += 13
	if sg != null:
		kv(X + 20, y, "Осада идёт:", JS.s(Sim.G.day - sg.d0) + " дн.", true)
		y += 13
		tx("Лестницы и тараны:", X + 20, y, INK2)
		bar(X + 130, y, 120, 8, sg.works / maxf(1, sg.need), "#a8743e", "#d6be8c")
		tx(str(roundi(sg.works / maxf(1, sg.need) * 100)) + "%", X + 256, y, INK)
		y += 13
		kv(X + 20, y, "Запасы осаждённых:", JS.s(JS.rnd(S.food)) + " дн." + (" — ГОЛОД!" if S.food <= 0 else ""), true, "#a0302a" if S.food <= 3 else INK)
		y += 13
		var eat := Sim.armyMen(pa) + JS.n(pa.get("wounded")) + JS.n(pa.get("sick"))
		kv(X + 20, y, "Наш провиант:", "%.1f дн." % (pa.food / maxf(1, eat)), true)
		y += 13
	y += 4
	para("«Худшее — осаждать крепости» (гл. 3). Каждый день осады — болезни и расход провианта. Дождитесь лестниц или голода — или возьмите хитростью." if sg != null else ("Крепость. Можно осадить (строить лестницы, морить голодом), потребовать сдачи или идти на штурм с ходу — через ворота, под стрелами." if JS.t(S.walls) else "Стен нет — защитников можно разбить сразу."), X + 20, y, WW - 40, INK2)
	var by := y0 + 196 - 24
	var asked: bool = (Sim.G.day - JS.n(sg.get("asked", -99)) < 5) if sg != null else (Sim.G.day - JS.n(S.get("askDay", -99)) < 5)
	sbtn("sg_dem", X + 20, by, 130, "Потребовать сдачи", func(_c): demand_surrender(sid), {"style": "parch", "disabled": asked,
		"tip": "Гонцов отправляют не чаще раза в 5 дней." if asked else "Шанс " + str(roundi(ch * 100)) + "%. Растёт с голодом, временем осады и нашей грозной славой."})
	if JS.t(S.walls) and sg == null:
		sbtn("sg_start", X + 156, by, 110, "Осадить", func(_c): siege_start(sid), {"style": "parch", "tip": "Встать лагерем, строить лестницы и тараны, отрезать подвоз."})
	if sg != null:
		sbtn("sg_lift", X + 156, by, 110, "Снять осаду", func(_c): siege_lift(), {"style": "parch"})
	var Wt: Dictionary = Sim.weatherOf()
	sbtn("sg_fire", X + 272, by, 140, "Огненная атака (смола: " + JS.s(JS.n(pa.get("pitch"))) + ")", func(_c): fire_attack(sid), {"style": "parch", "disabled": JS.n(pa.get("pitch")) < 3 or Sim.G.day - JS.n(S.get("fired", -99)) < 3,
		"tip": ["Огненная атака (гл. 12)", "3 бочки смолы. Жжёт запасы и защитников. «Для огня нужно подходящее время: сухая погода, дни ветра». Дождь и снег — бесполезно.", "Сейчас: " + String(Wt.n)]})
	var works: float = sg.works / maxf(1, sg.need) if sg != null else 0.0
	var warn := " (без лестниц — только ворота!)" if JS.t(S.walls) and works < 1 else ""
	sbtn("sg_ast", X + 20, by + 16, 190, "Штурм — командовать" if JS.t(S.walls) else "В бой — командовать", func(_c): assault(sid, true), {"style": "parch", "tip": "Тактический бой на стенах." + warn})
	sbtn("sg_aut", X + 216, by + 16, 196, ("Штурм — автобой" + (" (тяжело)" if works < 1 else "")) if JS.t(S.walls) else "В бой — автобой", func(_c): assault(sid, false), {"style": "parch", "tip": "Быстрый расчёт исхода." + warn})

func demand_surrender(sid: int) -> void:
	var S: Dictionary = Sim.G.setts[sid]
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	var ch := SimArmy.surrenderChance(pa, S)
	if S.get("siege") is Dictionary:
		S.siege.asked = Sim.G.day
	else:
		S.askDay = Sim.G.day
	if Sim.R.f() < ch:
		SimArmy.captureSett(pa, S, "сдались без боя")
		var R0: Dictionary = Sim.G.realms[int(Sim.G.player.realm)]
		R0.prestige = JS.n(R0.get("prestige")) + 3
		Sim.glog("«Покорить чужое войско, не сражаясь, — вот лучшее из лучшего» (гл. 3).", "title")
		win = null
	else:
		toast("Гарнизон отказался сдаться.")
		Sim.glog("Гарнизон " + String(Sim.W.setts[sid].name) + " отказался сдаться.", "info")

func siege_start(sid: int) -> void:
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	SimArmy.startSiege(pa, sid)
	Sim.glog("Мы осадили " + String(Sim.W.setts[sid].name) + ".", "info")

func siege_lift() -> void:
	var pa: Variant = Sim.playerArmy()
	if pa != null:
		SimDay.endSiege(pa)
	win = null

func fire_attack(sid: int) -> void:
	var S: Dictionary = Sim.G.setts[sid]
	var pa: Variant = Sim.playerArmy()
	var Wt: Dictionary = Sim.weatherOf()
	if pa == null:
		return
	if JS.n(pa.get("pitch")) < 3:
		toast("Нужно 3 бочки горючей смолы.")
		return
	if JS.t(Wt.get("wet")) or JS.t(Wt.get("cold")):
		toast("Сыро — огонь не возьмётся. Ждите сухой погоды.")
		return
	pa.pitch -= 3
	var eff := 1.0 if JS.t(Wt.get("dry")) else 0.5
	if JS.t(Wt.get("windy")):
		eff *= 1.35
	var burned := JS.rnd(S.food * 0.55 * eff)
	S.food -= burned
	var k := SimArmy.takeU(S.gar, JS.rnd(Sim.menOf(S.gar) * 0.07 * eff))
	if S.get("siege") is Dictionary:
		S.siege.works = minf(S.siege.need, S.siege.works + S.siege.need * 0.15 * eff)
	S.fired = Sim.G.day
	Sim.glog("Огненная атака на " + String(Sim.W.setts[sid].name) + "! Сгорело запасов на " + JS.s(burned) + " дн., погибло " + JS.s(k) + " защитников." + (" Без ветра и зноя огонь слаб." if eff < 0.7 else ""), "good")

## штурм (assault): на поле боя (стены, лестницы) или без экрана — итог в окне
func assault(sid: int, tactical: bool) -> void:
	var S: Dictionary = Sim.G.setts[sid]
	var pa: Variant = Sim.playerArmy()
	var ws: Dictionary = Sim.W.setts[sid]
	win = null
	if pa == null:
		return
	var works: float = S.siege.works / maxf(1, S.siege.need) if S.get("siege") is Dictionary else 0.0
	if tactical:
		battle.emit(SimCapt.sideFromArmy(pa, {"ground": "open"}), SimCapt.sideFromGarrison(S), int(ws.i), {"siege": S.walls > 0, "works": works, "sett": sid})
		return
	await _auto_begin()
	var res: Dictionary = await SimCapt.autoBattleGarrison(pa, S, true)
	_auto_end()
	res.sett = sid
	res.auto = true
	if res.win:
		SimArmy.captureSett(pa, S, "штурм")
	alert("bres", res)
