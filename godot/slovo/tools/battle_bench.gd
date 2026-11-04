extends SceneTree
## Замер скорости боёв: godot --headless --path godot/slovo --script tools/battle_bench.gd
## Берёт мир эталона (art/), сводит в поле пары войск разных держав и считает бои без экрана (SimCapt.runHeadless).

func _initialize() -> void:
	var W := WorldData.load_export("res://art")
	var raw := FileAccess.get_file_as_bytes("res://art/sim_ref.bin")
	if W == null or raw.size() < 12 or not Sim.load_tables():
		print("BENCH FAIL: нет art/")
		quit(1)
		return
	Sim.W = W
	var seed := raw.decode_u32(0)
	var opt := {"diff": 1.0, "tut": false, "mapOpen": false}
	Sim.newGame(seed, opt)
	SimDyn.newGame3(seed, opt)
	var L := []
	for a in Sim.G.armies:
		if JS.t(a.alive) and a.kind != "caravan":
			L.append(a)
	L.sort_custom(func(p, q): return Sim.menOf(p.u) > Sim.menOf(q.u))
	var pairs := []
	for i in L.size():
		for j in range(i + 1, L.size()):
			if L[i].realm != L[j].realm and pairs.size() < 6:
				pairs.append([L[i], L[j]])
	var tot := 0.0
	var steps := 0
	for pr in pairs:
		var a: Dictionary = pr[0]
		var b: Dictionary = pr[1]
		var B := SimBattle.setupBattle(SimCapt.sideFromArmy(a), SimCapt.sideFromArmy(b), Sim.armyTile(a), {})
		var t0 := Time.get_ticks_usec()
		SimCapt.runHeadless(B)
		var ms := (Time.get_ticks_usec() - t0) / 1000.0
		tot += ms
		steps += int(B.t * 10)
		print("%d против %d (%s): блоков %d, шагов %d, %.0f мс (%.2f мс на шаг), победа %d" % [Sim.menOf(a.u), Sim.menOf(b.u), B.F.size, B.units.size(), int(B.t * 10), ms, ms / maxf(1, B.t * 10), int(B.over.win)])
		SimBattle.freeBattle(B)
	print("всего %.0f мс, %.3f мс на шаг" % [tot, tot / maxf(1, steps)])
	quit(0)
