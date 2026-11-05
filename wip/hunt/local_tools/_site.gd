extends SceneTree
# временно: леса стройки (court_works.site_img) на картинках HTML — сравнить с OBJP.site
func _initialize() -> void:
	await process_frame
	var W = load("res://scripts/court_works.gd")
	var D: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://art/court.json"))
	var en := {}
	for v in D.locs.yard.var.values():
		for e in v.objs:
			if e.has("site"):
				en[String(e.site.en).length()] = String(e.site.en)
	for i in 7:
		var b := Image.load_from_file("/data/tmp/site/b%d.png" % i)
		b.convert(Image.FORMAT_RGBA8)
		for t in [0.0, 0.27, 0.5, 0.99]:
			var im: Image = W.site_img(b, en.get(b.get_width(), ""), t)
			im.save_png("/data/tmp/site/g%d_%s.png" % [i, str(t)])
	print("SITE DONE")
	quit(0)
