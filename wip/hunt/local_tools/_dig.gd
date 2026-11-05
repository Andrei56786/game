extends SceneTree
## временно: чем загруженное отличается от записанного (по ключам G и полям поселений)

func _initialize() -> void:
	_go.call_deferred()

func _d(v: Variant) -> String:
	return SimSave.digest({"v": v})

func _go() -> void:
	await process_frame
	var Game: Node = root.get_node("/root/Game")
	Game.sim_run = false
	if not SimPlayer.ensure_sim():
		print("нет королевства"); quit(1); return
	for S: Dictionary in Sim.G.setts:
		if S.get("mk") is Dictionary and not (S.mk as Dictionary).is_empty():
			S.mk[S.mk.keys()[0]] = 0.02
			break
	Game.save_path = "user://dig.sav"
	Game.save_game()
	var f: Dictionary = SimSave.read(Game.save_path)
	f.erase("gd")
	SimSave.fix_letters(f)
	var o: Variant = SimSave.read(Game.save_path)
	o.erase("gd")
	var e := SimSave.load_data(o)
	print("load: '", e, "'")
	var g := SimSave.save_data()
	for k in f:
		if not g.has(k):
			print("нет в загруженном: ", k)
		elif _d(f[k]) != _d(g[k]):
			print("иначе: ", k, " ", typeof(f[k]), "/", typeof(g[k]))
			if k == "setts":
				for i in mini(f[k].size(), 3000):
					var a: Dictionary = f[k][i]
					var b: Dictionary = g[k][i]
					if _d(a) != _d(b):
						for q in a:
							if not b.has(q) or _d(a[q]) != _d(b[q]):
								print("  sett ", i, " ", q, ": ", str(a.get(q)).left(200), " | ", str(b.get(q)).left(200))
						for q in b:
							if not a.has(q):
								print("  sett ", i, " +", q, ": ", str(b[q]).left(200))
						if i > 40: break
			elif f[k] is Dictionary:
				for q in f[k]:
					if not g[k].has(q) or _d(f[k][q]) != _d(g[k][q]):
						print("  ", k, ".", q, ": ", str(f[k][q]).left(300), " | ", str(g[k].get(q)).left(300))
				for q in g[k]:
					if not f[k].has(q):
						print("  ", k, " +", q)
			else:
				print("  ", str(f[k]).left(300), " | ", str(g[k]).left(300))
	for k in g:
		if not f.has(k):
			print("лишнее в загруженном: ", k)
	quit(0)
