extends "res://scripts/world/court_wins.gd"
## Слой двора поверх замка (courtui.js: drawCourtUI): верхняя строка с казной, датой и скоростью, кнопки окон (Малый
## совет, письма, карта королевства), облачка над людьми, «E — …», разговоры с выбором и окна двора (court_wins.gd:
## совет, письма, вести королевства). Щелчки — по областям прошлого кадра (как dispatchClicks); пока открыто окно,
## весть или разговор, время при дворе стоит (court._tick), у кнопок скорости светится пауза (timeHeld).

const CSPD_TIP := ["Пауза (Пробел)", "Скорость 1", "Скорость 2", "Скорость 3"]
## кнопки верхней строки (B в drawCourtUI): значок, подсказка, окно ("" — карта королевства)
const TB := [["i_seal", "Малый совет (K)", "council"], ["i_raven", "Письма (L)", "letters"], ["i_map", "Карта королевства (Tab)", ""]]

func _held() -> bool:
	return Game.speed > 0 and is_open()

## каждый кадр двора: всплывающие строки и вести королевства (UI.alert) — в окна; пока весть или разговор — королевство ждёт
func tick() -> void:
	if Sim.G.is_empty():
		return
	tick_toasts()
	if not SimDay.alerts.is_empty():
		var L: Array = SimDay.alerts
		SimDay.alerts = []
		for e in L:
			court_alert(e)
	SimPlayer.modal = modal_open()

func _draw() -> void:
	if court == null:
		return
	begin_hits()
	n_draw += 1
	court_layer()
	_top_hits()
	if win != null and not _court_win(win):
		win = null
	if not modals.is_empty() and not _court_modal(modals[0]):
		close_modal()
	if dlg != null:
		blocker()
		_dialog()
	else:
		hover_tip()
	_toast()
	end_hits()
	wheel = 0

## области верхней строки: скорость, кнопки окон (письма — с красной точкой, если есть непрочитанные), «E — …»
func _top_hits() -> void:
	var held := _held()
	for i in 4:
		var si := i
		var tp: Variant = CSPD_TIP[i]
		if i == 0 and held:
			tp = ["Время стоит", {"t": "Пока открыто окно, письмо или идёт разговор, время не идёт. Закройте окно — и оно пойдёт со скоростью " + str(Game.speed) + ".", "c": Art.pal("w")}]
		hit(SPD_X + i * 15, 2, 14, 14, {"id": "spd" + str(i), "tip": tp, "on": func(_c): Game.set_speed(si)})
	if held:
		box(SPD_X + Game.speed * 15 + 3, 13, 8, 1, Color(Art.pal("y"), 0.55 + sin(now() * 3.0) * 0.3))
	var bx := SPD_X + 62.0
	var un := unread()
	for i in TB.size():
		var e: Array = TB[i]
		var k: String = e[2]
		var tip: String = e[1]
		if k == "letters" and un > 0:
			tip += " — непрочитанных: " + str(un)
		btn("ctb" + str(i), bx + i * 16, 2, 15, 14, {"ic": e[0], "style": "dark", "tip": tip, "active": k != "" and win != null and String(win.k) == k, "on": func(_c): _tb(k)})
		if k == "letters" and un > 0:
			rect(bx + i * 16 + 10, 1, 6, 6, PO)
			rect(bx + i * 16 + 11, 2, 4, 4, "#e04030")
	if prompt_r.has_area() and dlg == null:
		var tg: Dictionary = prompt_tg
		hit(prompt_r.position.x, prompt_r.position.y, prompt_r.size.x, prompt_r.size.y, {"id": "prompt", "on": func(_c): _prompt(tg)})

func _tb(k: String) -> void:
	if k == "":
		win = null
		court.to_map.emit()
	else:
		toggle_win(k)

## щелчок по «E — …» внизу: то же, что клавиша E
func _prompt(tg: Dictionary) -> void:
	if tg.is_empty():
		court.stand_up()
	else:
		court.interact(tg)
