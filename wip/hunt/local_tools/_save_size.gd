extends SceneTree
# временно: размер сохранения по ключам — новая игра после загруженной
func days(n: int) -> void:
	for d in n:
		for k in 24:
			SimDay.budget_us = 0
			SimDay.slice_t = Time.get_ticks_usec()
			await SimArmy.substep(1.0 / 24)
		await SimDay.dailyTick(0)

func sizes(tag: String) -> void:
	var o := SimSave.save_data()
	var tot := var_to_bytes(o).compress(FileAccess.COMPRESSION_ZSTD).size()
	var L := []
	for k in o:
		var b := var_to_bytes(o[k])
		L.append([b.compress(FileAccess.COMPRESSION_ZSTD).size(), k, b.size()])
	L.sort_custom(func(a, b): return a[0] > b[0])
	print(tag, " день ", Sim.G.day, " всего ", tot / 1024, " КБ; ", L.slice(0, 6))

func _initialize() -> void:
	var W := WorldData.load_export("res://art")
	Sim.load_tables()
	Sim.W = W
	SimSave.reset_runtime()
	Sim.G = {}
	Sim.start(W, 777, {"diff": 1.0, "tut": false, "mapOpen": false})
	await days(8)
	sizes("первая")
	SimSave.write("user://_t.sav", SimSave.save_data())
	var o: Dictionary = SimSave.read("user://_t.sav")
	print("load: '", SimSave.load_data(o), "'")
	await days(2)
	sizes("после загрузки")
	SimSave.reset_runtime()
	Sim.G = {}
	Sim.start(W, 777, {"diff": 2.0, "tut": false, "mapOpen": true})
	sizes("новая")
	await days(7)
	sizes("новая")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://_t.sav"))
	quit(0)
