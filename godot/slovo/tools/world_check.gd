extends SceneTree
## Сверка генератора мира Godot с HTML-версией: godot --headless --path godot/slovo --script tools/world_check.gd
## Строит мир по зерну из art/world.json и сравнивает все части; при расхождении — первая отличающаяся клетка.

func _init() -> void:
	var js: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://art/world.json"))
	var ref := WorldData.load_export("res://art", true)
	var wg := WorldGen.new(js.gen)
	print("SEAT_K ", wg.SEAT_K, " ED ", wg.ED, "  HTML: ", js.gen.ms, " мс ", js.gen.tt)
	var W := wg.gen(ref.seed)
	print("Godot: ", W.ms, " мс ", W.tt, "  провинций ", W.provs.size(), "/", ref.provs.size(), " поселений ", W.setts.size(), "/", ref.setts.size())
	var a := W.digest()
	var b := ref.digest()
	var bad := 0
	for k: String in b:
		if a.get(k, "") == b[k]:
			continue
		bad += 1
		var va: Variant = W.get(k)
		var vb: Variant = ref.get(k)
		var info := ""
		if typeof(vb) in [TYPE_PACKED_BYTE_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_FLOAT32_ARRAY]:
			var nd := 0
			var first := -1
			for i in vb.size():
				if va[i] != vb[i]:
					nd += 1
					if first < 0:
						first = i
			if first >= 0:
				info = "различий %d, первое в клетке %d (x %d, y %d): Godot %s, HTML %s" % [nd, first, first % 1080, first / 1080, str(va[first]), str(vb[first])]
		print("РАЗНИЦА ", k, ": ", info)
	print("WORLD CHECK ", "OK" if bad == 0 else "FAIL (%d)" % bad)
	quit(0 if bad == 0 else 1)
