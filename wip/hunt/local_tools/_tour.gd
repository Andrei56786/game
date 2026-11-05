extends SceneTree
## временно: турнир в игре (как в веб-тесте) — почему после «time 15.6» турнир сразу окончен
var m: Node
var Game: Node

func _initialize() -> void:
	m = load("res://scenes/main.tscn").instantiate()
	root.add_child(m)
	_go.call_deferred()

func _until(f: Callable, n := 200000) -> bool:
	for i in n:
		if f.call():
			return true
		await process_frame
	return false

func _st() -> Dictionary:
	return m.court.state()

func _go() -> void:
	await process_frame
	Game = root.get_node("/root/Game")
	m._js_cmd(["newgame go 1"])
	await _until(func(): return not Sim.G.is_empty() and m.court != null and m.cur == m.court)
	for i in 60: await process_frame
	for c in ["speed 0", "close", "spot lists_s", "pos 990 404", "time 9.5", "tour", "time 9.97", "speed 1"]:
		m._js_cmd([c])
	await _until(func(): return m.court.trn.on, 3000)
	print("on ", m.court.trn.on, " day ", Game.day, " sim ", Sim.G.day, " T.day ", Sim.G.court.tour.day)
	m._js_cmd(["time 10.25"])
	await _until(func(): return int(_st().tour.res) >= 1, 6000)
	print("res ", _st().tour.res)
	m._js_cmd(["act lists"])
	for i in 10: await process_frame
	print("dlg ", _st().dlg, " ", _st().ch)
	m._js_cmd(["choose 1"])
	m._js_cmd(["close"])
	await _until(func(): return m.court.trn.kj != null, 600)
	print("kj ", m.court.trn.kj != null)
	await _until(func():
		var t: Variant = m.court.trn.kj
		if t != null and t.ph == "run" and t.lock == null:
			m._js_cmd(["kj lock 1"])
		return t == null and m.court.hud.dlg != null, 20000)
	print("after joust dlg ", _st().dlg, " tour ", _st().tour)
	m._js_cmd(["close"])
	for i in 20: await process_frame
	print("closed: tour ", _st().tour, " heal ", _st().heal)
	m._js_cmd(["time 15.6"])
	for i in 40:
		await process_frame
		var s: Dictionary = _st().tour
		if i % 5 == 0 or not s.on:
			print(i, " h ", snappedf(Game.hour_abs(), 0.01), " day ", Game.day, " sim ", Sim.G.day, " on ", s.on, " res ", s.res, " done ", s.done, " stands ", SimDyn.projDone("stands"), " T.day ", Sim.G.court.tour.day if Sim.G.court.get("tour") is Dictionary else -9)
		if not s.on:
			break
	quit(0)
