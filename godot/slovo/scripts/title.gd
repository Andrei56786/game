extends Control
# Заставка: ночной замок, звёзды, факелы у ворот; «Войти во двор», «Выход».
signal start
const Pix = preload("res://scripts/pix.gd")
var t := 0.0
var fires: Array[Sprite2D] = []

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := TextureRect.new()
	bg.texture = ImageTexture.create_from_image(_backdrop())
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	for x in [301, 337]:
		var f := Sprite2D.new()
		f.texture = Pix.radial(32)
		f.position = Vector2(x, 262)
		f.modulate = Color(1.0, 0.6, 0.2, 0.55)
		add_child(f)
		fires.append(f)
		var sp := CPUParticles2D.new()
		sp.position = Vector2(x, 262)
		sp.amount = 10
		sp.lifetime = 0.9
		sp.direction = Vector2(0, -1)
		sp.spread = 20
		sp.initial_velocity_min = 8
		sp.initial_velocity_max = 18
		sp.gravity = Vector2(0, -6)
		sp.color = Color(1.0, 0.7, 0.25)
		add_child(sp)
	var f: Font = Game.font
	var title := Label.new()
	title.text = "Слово короля"
	title.add_theme_font_override("font", f)
	title.add_theme_font_size_override("font_size", 44)
	title.add_theme_color_override("font_color", Color8(242, 214, 140))
	title.add_theme_color_override("font_shadow_color", Color8(20, 14, 10))
	title.add_theme_constant_override("shadow_offset_x", 2)
	title.add_theme_constant_override("shadow_offset_y", 2)
	title.position = Vector2(0, 34)
	title.size = Vector2(640, 60)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(title)
	var sub := Label.new()
	sub.text = "Godot 4.7 · срез «Двор» · сборка " + Game.VERSION
	sub.add_theme_font_override("font", f)
	sub.add_theme_font_size_override("font_size", 12)
	sub.add_theme_color_override("font_color", Color8(200, 186, 150))
	sub.position = Vector2(0, 92)
	sub.size = Vector2(640, 20)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(sub)
	var box := VBoxContainer.new()
	box.position = Vector2(250, 128)
	box.size = Vector2(140, 60)
	box.add_theme_constant_override("separation", 6)
	add_child(box)
	var b1 := _button("Войти во двор")
	b1.pressed.connect(func(): start.emit())
	box.add_child(b1)
	if not OS.has_feature("web"):
		var b2 := _button("Выход")
		b2.pressed.connect(func(): get_tree().quit())
		box.add_child(b2)
	b1.grab_focus.call_deferred()
	var q := Label.new()
	q.text = "«Война — это путь обмана» (Сунь-цзы, гл. 1)"
	q.add_theme_font_override("font", f)
	q.add_theme_font_size_override("font_size", 11)
	q.add_theme_color_override("font_color", Color8(168, 152, 120))
	q.position = Vector2(0, 336)
	q.size = Vector2(640, 16)
	q.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(q)

func _button(s: String) -> Button:
	var b := Button.new()
	b.text = s
	b.add_theme_font_override("font", Game.font)
	b.add_theme_font_size_override("font_size", 14)
	for st in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color8(110, 74, 46) if st == "normal" else Color8(150, 104, 60) if st != "focus" else Color(0, 0, 0, 0)
		sb.border_color = Color8(201, 160, 96) if st != "focus" else Color8(255, 226, 150)
		sb.set_border_width_all(1)
		sb.set_content_margin_all(3)
		b.add_theme_stylebox_override(st, sb)
	b.add_theme_color_override("font_color", Color8(250, 238, 210))
	b.add_theme_color_override("font_hover_color", Color8(255, 246, 220))
	b.add_theme_color_override("font_focus_color", Color8(255, 246, 220))
	return b

func _process(d: float) -> void:
	t += d
	for i in fires.size():
		fires[i].modulate.a = 0.45 + 0.12 * sin(t * 11.0 + i * 2.0) + 0.06 * sin(t * 27.0 + i)

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		if e.keycode == KEY_ESCAPE and not OS.has_feature("web"):
			get_tree().quit()

# ночное небо, луна, холмы и силуэт замка с окнами (640×360)
func _backdrop() -> Image:
	var img := Image.create_empty(640, 360, false, Image.FORMAT_RGBA8)
	for y in 360:
		var k := float(y) / 300.0
		var c := Color8(14, 16, 36).lerp(Color8(58, 46, 72), clampf(k, 0.0, 1.0))
		for x in 640:
			img.set_pixel(x, y, c)
	for i in 260:
		var x := int(Game.hash2(i, 1, 7) * 640.0)
		var y := int(Game.hash2(i, 2, 7) * 200.0)
		var b := 0.4 + Game.hash2(i, 3, 7) * 0.6
		img.set_pixel(x, y, Color(1.0, 0.97, 0.88) * b)
	for y in range(-14, 15):
		for x in range(-14, 15):
			if x * x + y * y <= 196:
				var moon := Color8(236, 226, 190)
				if (x + 4) * (x + 4) + (y - 3) * (y - 3) < 10 or (x - 5) * (x - 5) + (y + 5) * (y + 5) < 6:
					moon = Color8(210, 198, 160)
				img.set_pixel(520 + x, 64 + y, moon)
	for x in 640:
		var h1 := int(232.0 + 14.0 * sin(x * 0.013) + 8.0 * sin(x * 0.041 + 1.0))
		for y in range(h1, 360):
			img.set_pixel(x, y, Color8(34, 34, 56))
		var h2 := int(262.0 + 8.0 * sin(x * 0.021 + 2.0) + 4.0 * sin(x * 0.07))
		for y in range(h2, 360):
			img.set_pixel(x, y, Color8(26, 24, 36))
	var s := Color8(16, 14, 22)
	Pix.rect(img, 190, 214, 260, 64, s)
	for x in range(190, 450, 10):
		Pix.rect(img, x, 208, 6, 6, s)
	Pix.rect(img, 270, 150, 100, 70, s)
	for x in range(270, 370, 12):
		Pix.rect(img, x, 143, 7, 7, s)
	for tx in [176, 434]:
		Pix.rect(img, tx, 170, 30, 108, s)
		for x in range(tx, tx + 30, 8):
			Pix.rect(img, x, 164, 5, 6, s)
	Pix.rect(img, 304, 128, 32, 24, s)
	for y in range(108, 128):
		var w := int((y - 108) * 0.9)
		Pix.rect(img, 320 - w, y, w * 2, 1, s)
	var win := Color8(255, 196, 96)
	for p in [[286, 170], [306, 170], [330, 170], [350, 170], [186, 196], [444, 196], [316, 136], [230, 236], [400, 236]]:
		Pix.rect(img, p[0], p[1], 4, 6, win)
	Pix.rect(img, 308, 246, 24, 32, Color8(60, 36, 20))
	Pix.rect(img, 310, 248, 20, 30, Color8(90, 56, 30))
	for y in range(278, 360):
		var w := 12 + (y - 278) * 2
		Pix.rect(img, 320 - w, y, w * 2, 1, Color8(48, 40, 40))
	return img
