extends SceneTree
## временно: темница в полдень дня 90 — где тюремщик
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
	m._js_cmd(["newgame go 1 open"])
	await _until(func(): return not Sim.G.is_empty() and m.court != null and m.cur == m.court)
	print("двор, день ", Sim.G.day)
	for i in 30: await process_frame
	m._js_cmd(["speed 4"])
	m._js_cmd(["day 90"])
	for k in 4000:
		if int(Sim.G.day) >= 90 and not SimDay.busy and not Game.stepping:
			break
		if k % 30 == 0:
			if Game.speed == 0 or (m.court.hud.dlg != null) or m.court.hud.win != null or m.court.hud.modals.size() > 0:
				print("  стоп на дне ", Sim.G.day, " dlg ", String(m.court.hud.dlg.name) if m.court.hud.dlg != null else "-", " win ", m.court.hud.win != null, " modals ", m.court.hud.modals.size())
				m._js_cmd(["close"]); m._js_cmd(["close"])
				m._js_cmd(["speed 4"])
		for f in 10: await process_frame
	print("день ", Sim.G.day, " ", Game.day)
	m._js_cmd(["speed 0"])
	for h in [11.0, 12.0, 12.5, 14.0]:
		m._js_cmd(["time " + str(h)])
		for i in 20: await process_frame
		var c: Node = m.court
		var j: Dictionary = c.npc_by("srv_jailer")
		print("час ", h, " jailer: ", {"loc": j.get("loc"), "x": j.get("x"), "y": j.get("y"), "away": j.get("away"), "sit": j.get("sit"), "ov": j.get("override"), "lines": (j.get("lines", []) as Array).size()})
		m._js_cmd(["goto srv_jailer"])
		for i in 30: await process_frame
		m._js_cmd(["talk"])
		for i in 20: await process_frame
		print("  king ", c.king.x, ",", c.king.y, " dlg ", String(c.hud.dlg.name) if c.hud.dlg != null else "-")
		m._js_cmd(["close"]); m._js_cmd(["close"])
		for i in 10: await process_frame
	quit(0)
