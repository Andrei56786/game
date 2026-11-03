extends RefCounted
# Пиксель-арт из кода: строки с буквами палитры → текстура; фигуры людей в 4 стороны с шагом.

static func tex(rows: PackedStringArray, pal: Dictionary) -> ImageTexture:
	var w := 0
	for r in rows:
		w = maxi(w, r.length())
	var img := Image.create_empty(w, rows.size(), false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for y in rows.size():
		var r: String = rows[y]
		for x in r.length():
			if pal.has(r[x]):
				img.set_pixel(x, y, pal[r[x]])
	return ImageTexture.create_from_image(img)

static func rect(img: Image, x: int, y: int, w: int, h: int, c: Color) -> void:
	for yy in range(maxi(0, y), mini(img.get_height(), y + h)):
		for xx in range(maxi(0, x), mini(img.get_width(), x + w)):
			img.set_pixel(xx, yy, c)

# человечек 12×20: d — 0 вниз, 1 вверх, 2 влево, 3 вправо; f — кадр шага 0..3; p — палитра
# p: skin, hair, body, body2 (тень), legs, hat ("crown", "helm", "hood", "veil", ""), cape
static func figure(d: int, f: int, p: Dictionary) -> Image:
	var img := Image.create_empty(12, 20, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var k := Color8(26, 20, 16)
	var skin: Color = p.get("skin", Color8(232, 190, 150))
	var hair: Color = p.get("hair", Color8(90, 60, 40))
	var body: Color = p.get("body", Color8(120, 90, 60))
	var body2: Color = p.get("body2", body.darkened(0.25))
	var legs: Color = p.get("legs", Color8(60, 48, 40))
	var cape = p.get("cape", null)
	var dress: bool = p.get("dress", false)
	var step: int = [0, 1, 0, -1][f % 4]
	# тень на земле
	rect(img, 2, 18, 8, 2, Color(0, 0, 0, 0.28))
	# ноги
	if dress:
		rect(img, 2, 12, 8, 6, body2)
		rect(img, 3 + (1 if step > 0 else 0), 17, 2, 1, k)
		rect(img, 7 - (1 if step < 0 else 0), 17, 2, 1, k)
	else:
		var l1 := 0
		var l2 := 0
		if d < 2:
			l1 = step
			l2 = -step
		rect(img, 3, 13, 2, 4 + mini(l1, 0), legs)
		rect(img, 7, 13, 2, 4 + mini(l2, 0), legs)
		if d >= 2:
			rect(img, 5 + step, 13, 2, 4, legs.darkened(0.2))
		rect(img, 3, 17 + mini(l1, 0), 2, 1, k)
		rect(img, 7, 17 + mini(l2, 0), 2, 1, k)
	# плащ за спиной
	if cape != null and d != 0:
		rect(img, 2, 7, 8, 9, cape)
	# тело и руки
	rect(img, 3, 7, 6, 6, body)
	rect(img, 3, 11, 6, 1, body2)
	var arm := step if d < 2 else 0
	if d == 2:
		rect(img, 5 - step, 8, 2, 4, body2)
		rect(img, 5 - step, 12, 2, 1, skin)
	elif d == 3:
		rect(img, 5 + step, 8, 2, 4, body2)
		rect(img, 5 + step, 12, 2, 1, skin)
	else:
		rect(img, 2, 8 + arm, 1, 4, body2)
		rect(img, 9, 8 - arm, 1, 4, body2)
		rect(img, 2, 12 + arm, 1, 1, skin)
		rect(img, 9, 12 - arm, 1, 1, skin)
	if cape != null and d == 0:
		rect(img, 2, 7, 1, 7, cape)
		rect(img, 9, 7, 1, 7, cape)
	# голова
	rect(img, 3, 1, 6, 6, skin)
	match d:
		0:
			rect(img, 3, 1, 6, 2, hair)
			rect(img, 4, 4, 1, 1, k)
			rect(img, 7, 4, 1, 1, k)
		1:
			rect(img, 3, 1, 6, 5, hair)
		2:
			rect(img, 3, 1, 6, 2, hair)
			rect(img, 6, 1, 3, 5, hair)
			rect(img, 4, 4, 1, 1, k)
		3:
			rect(img, 3, 1, 6, 2, hair)
			rect(img, 3, 1, 3, 5, hair)
			rect(img, 7, 4, 1, 1, k)
	match String(p.get("hat", "")):
		"crown":
			var g := Color8(240, 196, 64)
			rect(img, 3, 1, 6, 1, g)
			for x in [3, 5, 6, 8]:
				img.set_pixel(x, 0, g)
			img.set_pixel(5, 1, Color8(200, 40, 50))
		"helm":
			var s := Color8(150, 156, 166)
			rect(img, 3, 0, 6, 3, s)
			rect(img, 3, 2, 6, 1, s.darkened(0.3))
			if d == 0:
				rect(img, 5, 3, 2, 2, s.darkened(0.2))
		"hood":
			rect(img, 2, 0, 8, 3, body)
			if d == 1:
				rect(img, 3, 3, 6, 3, body)
		"veil":
			rect(img, 3, 0, 6, 2, Color8(240, 236, 224))
			if d != 0:
				rect(img, 3 if d != 3 else 6, 2, 3 if d != 1 else 6, 5, Color8(240, 236, 224))
	return img

static func frames(p: Dictionary) -> Array:
	var out := []
	for d in 4:
		var row := []
		for f in 4:
			row.append(ImageTexture.create_from_image(figure(d, f, p)))
		out.append(row)
	return out

static func radial(size: int) -> GradientTexture2D:
	var gt := GradientTexture2D.new()
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = size
	gt.height = size
	var gr := Gradient.new()
	gr.set_color(0, Color(1, 1, 1, 1))
	gr.set_color(1, Color(1, 1, 1, 0))
	gt.gradient = gr
	return gt
