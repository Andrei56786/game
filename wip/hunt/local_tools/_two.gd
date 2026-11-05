extends SceneTree
## временно: воспроизвести «загрузка → главное меню → новая игра → 7 дней» без экрана
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

func _go() -> void:
	await process_frame
	Game = root.get_node("/root/Game")
	var mode: String = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 0 else "a"
	if mode == "a":
		m._js_cmd(["newgame go 2 open"])
		await _until(func(): return not Sim.G.is_empty() and m.court != null and m.cur == m.court)
		print("A: новая игра, день ", Sim.G.day)
		Game.set_speed(1)
		Game.day += 3
		await _until(func(): return int(Sim.G.day) >= 3 and not SimDay.busy and not Game.stepping)
		await Game.save_safe()
		print("A: сохранено, день ", Sim.G.day)
	else:
		m._js_cmd(["continue"])
		await _until(func(): return not Sim.G.is_empty() and m.cur != null and m.cur == m.court)
		print("B: загружено, день ", Sim.G.day)
		for i in 30:
			await process_frame
		m._js_cmd(["menu exit"])
		await _until(func(): return m.court == null)
		for i in 30:
			await process_frame
		m._js_cmd(["newgame go 2 open"])
		await _until(func(): return not Sim.G.is_empty() and m.court != null and m.cur == m.court and int(Sim.G.day) == 0)
		print("B: новая игра, день ", Sim.G.day)
		Game.set_speed(1)
		Game.day += 7
		await _until(func(): return int(Sim.G.day) >= 7 and not SimDay.busy and not Game.stepping)
		print("B: день ", Sim.G.day)
	quit(0)
