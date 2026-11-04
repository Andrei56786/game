extends SceneTree
## Сверка симуляции Godot с HTML-версией: godot --headless --path godot/slovo --script tools/state_check.gd
## Эталон — art/sim_ref.bin (tools/sim_export.mjs): состояние HTML после newGame и после newGame3 + обзора по зерну мира,
## затем дни королевства (pageDay в HTML, SimDay.dailyTick здесь): сводка каждого дня и полные снимки на нескольких днях.
## Сравнивается всё: ключи и их порядок, типы (в G только float, как числа JS), числа — точно, генератор R, доход, знаки.

const MAXP := 40
var nd := 0


func _initialize() -> void:
	var W := WorldData.load_export("res://art")
	var raw := FileAccess.get_file_as_bytes("res://art/sim_ref.bin")
	if W == null or raw.size() < 12 or not Sim.load_tables():
		print("STATE CHECK FAIL: нет art/world.json, sim_tables.bin или sim_ref.bin (node godot/slovo/tools/sim_export.mjs)")
		quit(1)
		return
	Sim.W = W
	# куски эталона: newGame, newGame3, сводка дней, снимки дней
	var seed := raw.decode_u32(0)
	var np := raw.decode_u32(4)
	var parts := []
	var off := 8 + 4 * np
	for i in np:
		var l := raw.decode_u32(8 + 4 * i)
		parts.append(raw.slice(off, off + l))
		off += l
	var ref1: Dictionary = bytes_to_var(parts[0])
	var ref2: Dictionary = bytes_to_var(parts[1])
	var meta: Dictionary = bytes_to_var(parts[2]) if np > 2 else {"days": 0, "snaps": [], "dig": []}
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
	# дни королевства (SimDay.dailyTick, без пауз): сводка — каждый день, всё состояние — на днях снимков
	var n3 := 0
	var days := int(meta.days)
	var snaps: Array = meta.snaps
	var dig: Array = meta.dig
	var ms_days := 0.0
	var ms_max := 0.0
	var bad_day := -1
	for d in range(1, days + 1):
		t0 = Time.get_ticks_usec()
		await SimDay.dailyTick(0)
		var ms := (Time.get_ticks_usec() - t0) / 1000.0
		ms_days += ms
		ms_max = maxf(ms_max, ms)
		var G := Sim.G
		var golds := []
		for r in G.realms:
			golds.append(r.gold)
		var me := {"day": G.day, "R": float(Sim.R.st), "gold": golds, "armies": float(G.armies.size()), "log": float(G.log.size()), "w": G.weather.k, "mud": JS.n(G.get("mud")), "chars": float(G.chars.size())}
		nd = 0
		var rd: Dictionary = dig[d - 1]
		for k in rd:
			cmp(me[k], rd[k], "день %d: %s" % [d, k])
		var nds := nd
		n3 += nds
		if nds > 0 and bad_day < 0:
			bad_day = d
		var si := snaps.find(float(d))
		if si >= 0:
			n3 += check("день %d" % d, bytes_to_var(parts[3 + si]))
			if bad_day > 0:
				break
	if days > 0:
		print("дней %d: %.1f мс на день в среднем, самый долгий %.1f мс (в HTML %.1f мс на день)" % [days, ms_days / maxf(1, days), ms_max, float(meta.get("ms", 0.0)) / maxf(1, days)])
	var ok := n1 + n2 + n3 == 0
	print("STATE CHECK ", "OK" if ok else "FAIL (newGame %d, newGame3 %d, дни %d%s)" % [n1, n2, n3, ", первый день расхождения %d" % bad_day if bad_day > 0 else ""])
	quit(0 if ok else 1)


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
