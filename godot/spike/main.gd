extends Node2D
# Проверка 2: чёткий пиксель-арт и книжный шрифт вместе (canvas_items, целый масштаб), ночь, 2D-свет, частицы.
var t := 0.0
var king: Sprite2D
var light: PointLight2D
func px(rows: PackedStringArray, pal: Dictionary) -> ImageTexture:
	var img := Image.create(rows[0].length(), rows.size(), false, Image.FORMAT_RGBA8)
	for y in rows.size():
		for x in rows[y].length():
			img.set_pixel(x, y, pal.get(rows[y][x], Color(0, 0, 0, 0)))
	return ImageTexture.create_from_image(img)
func _ready() -> void:
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	for y in 16:
		for x in 16:
			img.set_pixel(x, y, Color8(92, 140, 60) if (x * 7 + y * 13) % 5 else Color8(70, 112, 46))
	var tex := ImageTexture.create_from_image(img)
	for ty in 23:
		for tx in 40:
			var s := Sprite2D.new(); s.texture = tex; s.centered = false; s.position = Vector2(tx * 16, ty * 16); add_child(s)
	var pal := {"k": Color8(30, 24, 20), "s": Color8(232, 190, 150), "r": Color8(150, 30, 40), "g": Color8(230, 190, 40), "b": Color8(60, 40, 30)}
	king = Sprite2D.new()
	king.texture = px(PackedStringArray(["...g.g.g..", "...ggggg..", "...sssss..", "...sksks..", "...sssss..", "..rrrrrrr.", ".rrrrgrrrr", ".srrrgrrrs", "..rrrgrrr.", "..rrrrrrr.", "..rrr.rrr.", "..bb...bb."]), pal)
	king.position = Vector2(320, 220); king.scale = Vector2(2, 2); add_child(king)
	var cm := CanvasModulate.new(); cm.color = Color(0.32, 0.36, 0.55); add_child(cm)
	var gt := GradientTexture2D.new(); gt.fill = GradientTexture2D.FILL_RADIAL; gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1, 0.5); gt.width = 128; gt.height = 128
	var gr := Gradient.new(); gr.set_color(0, Color(1, 1, 1, 1)); gr.set_color(1, Color(1, 1, 1, 0)); gt.gradient = gr
	light = PointLight2D.new(); light.texture = gt; light.texture_scale = 2.0; light.color = Color(1.0, 0.75, 0.45); light.energy = 1.4; light.position = Vector2(300, 230); add_child(light)
	var p := CPUParticles2D.new(); p.position = Vector2(300, 240); p.amount = 40; p.lifetime = 1.2; p.direction = Vector2(0, -1); p.spread = 18
	p.initial_velocity_min = 14; p.initial_velocity_max = 28; p.gravity = Vector2(0, -8); p.scale_amount_min = 1; p.scale_amount_max = 2; p.color = Color(1, 0.62, 0.2)
	var mat := CanvasItemMaterial.new(); mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; mat.light_mode = CanvasItemMaterial.LIGHT_MODE_UNSHADED; p.material = mat
	var fx := CanvasLayer.new(); fx.follow_viewport_enabled = true; add_child(fx); fx.add_child(p)
	var ui := CanvasLayer.new(); add_child(ui)
	var f: FontFile = load("res://slovo_serif.woff")
	var l := Label.new(); l.text = "Слово короля — книжный шрифт PT Serif\nповерх пиксельной графики: ночь, свет костра, искры"
	l.position = Vector2(150, 40); l.add_theme_font_override("font", f); l.add_theme_font_size_override("font_size", 13)
	l.add_theme_color_override("font_color", Color(0.97, 0.93, 0.82)); ui.add_child(l)
	print("ready: ", Engine.get_version_info().string, " ", RenderingServer.get_video_adapter_name(), " font=", f != null)
func _process(d: float) -> void:
	t += d
	light.energy = 1.3 + 0.15 * sin(t * 9.0) + 0.08 * sin(t * 23.0)
