extends SceneTree
## Сверка симуляции Godot с HTML-версией: godot --headless --path godot/slovo --script tools/state_check.gd
## Эталон — art/sim_ref.bin (tools/sim_export.mjs): состояние HTML после newGame и после newGame3 + обзора по зерну мира.
## Сравнивается всё: ключи и их порядок, типы (в G только float, как числа JS), числа — точно, генератор R, доход, знаки.

const MAXP := 40
var nd := 0


func _init() -> void:
	var W := WorldData.load_export("res://art")
	var raw := FileAccess.get_file_as_bytes("res://art/sim_ref.bin")
	if W == null or raw.size() < 12 or not Sim.load_tables():
		print("STATE CHECK FAIL: нет art/world.json, sim_tables.bin или sim_ref.bin (node godot/slovo/tools/sim_export.mjs)")
		quit(1)
		return
	Sim.W = W
	var seed := raw.decode_u32(0)
	var l1 := raw.decode_u32(4)
	var l2 := raw.decode_u32(8)
	var ref1: Dictionary = bytes_to_var(raw.slice(12, 12 + l1))
	var ref2: Dictionary = bytes_to_var(raw.slice(12 + l1, 12 + l1 + l2))
	var opt := {"diff": 1.0, "tut": false, "mapOpen": false}
	var t0 := Time.get_ticks_usec()
	Sim.newGame(seed, opt)
	var ms1 := (Time.get_ticks_usec() - t0) / 1000.0
	var n1 := check("newGame", ref1)
	t0 = Time.get_ticks_usec()
	SimDyn.newGame3(seed, opt)
	var ms2 := (Time.get_ticks_usec() - t0) / 1000.0
	t0 = Time.get_ticks_usec()
	SimIntel.computeVision()
	SimIntel.updateSigns()
	var ms3 := (Time.get_ticks_usec() - t0) / 1000.0
	var n2 := check("newGame3", ref2)
	print("зерно %d: людей %d, войск %d, поселений %d; newGame %.0f мс, newGame3 %.0f мс (%s), обзор %.1f мс" % [seed, Sim.G.chars.size(), Sim.G.armies.size(), Sim.G.setts.size(), ms1, ms2, str(Sim.ms), ms3])
	print("STATE CHECK ", "OK" if n1 + n2 == 0 else "FAIL (newGame %d, newGame3 %d)" % [n1, n2])
	quit(0 if n1 + n2 == 0 else 1)


func check(name: String, ref: Dictionary) -> int:
	nd = 0
	var inc: Variant = Sim.ECON.get("incoming")
	var me := {"G": Sim.G, "R": float(Sim.R.st), "ECON": {"inc": Sim.ECON.get("inc"), "incDay": Sim.ECON.get("incDay"), "incoming": inc if JS.t(inc) else null}, "SIGNS": Sim.SIGNS}
	cmp(me, ref, name)
	print(name, ": ", "совпадает" if nd == 0 else "расхождений %d" % nd)
	return nd


func diff(p: String, s: String) -> void:
	nd += 1
	if nd <= MAXP:
		print("  ", p, ": ", s)


func short(v: Variant) -> String:
	var s := str(v)
	return s if s.length() < 120 else s.substr(0, 117) + "…"


func cmp(a: Variant, b: Variant, p: String) -> void:
	var ta := typeof(a)
	var tb := typeof(b)
	if ta != tb:
		diff(p, "%s %s, в HTML %s %s" % [type_string(ta), short(a), type_string(tb), short(b)])
		return
	match tb:
		TYPE_DICTIONARY:
			# ключи сравниваются как строки: d.k = … в GDScript даёт ключ StringName, в словаре он равен строке
			var ka: Array = a.keys().map(func(k): return str(k))
			var kb: Array = b.keys().map(func(k): return str(k))
			if ka != kb:
				var miss := kb.filter(func(k): return not a.has(k))
				var extra := ka.filter(func(k): return not b.has(k))
				if miss.size() or extra.size():
					diff(p, "нет ключей %s, лишние %s" % [str(miss), str(extra)])
				else:
					diff(p, "порядок ключей %s, в HTML %s" % [short(ka), short(kb)])
			for k in kb:
				if a.has(k):
					cmp(a[k], b[k], "%s.%s" % [p, str(k)])
		TYPE_ARRAY:
			if a.size() != b.size():
				diff(p, "длина %d, в HTML %d" % [a.size(), b.size()])
			for i in mini(a.size(), b.size()):
				cmp(a[i], b[i], "%s[%d]" % [p, i])
		TYPE_FLOAT:
			if a != b and not (is_nan(a) and is_nan(b)):
				diff(p, "%s, в HTML %s (разница %s)" % [str(a), str(b), str(a - b)])
		TYPE_PACKED_BYTE_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_FLOAT64_ARRAY:
			if a.size() != b.size():
				diff(p, "длина %d, в HTML %d" % [a.size(), b.size()])
				return
			if a == b:
				return
			var n := 0
			var first := -1
			for i in b.size():
				if a[i] != b[i]:
					n += 1
					if first < 0:
						first = i
			diff(p, "различий %d, первое [%d]: %s, в HTML %s" % [n, first, str(a[first]), str(b[first])])
		_:
			if a != b:
				diff(p, "%s, в HTML %s" % [short(a), short(b)])
