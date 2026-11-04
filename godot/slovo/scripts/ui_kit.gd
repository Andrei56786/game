extends "res://scripts/hud.gd"
## Приборы экранов в духе HTML (engine.js, screens2.js): области щелчка (hit — сверху та, что нарисована позже; наведение —
## по прошлому кадру, как LAST и HOVER), кнопки btn (дерево, тёмная, пергамент; значок, «нажата», «нельзя», подсказка),
## тёмная, деревянная и пергаментная панели, окно dlg с затемнением, полоски, абзацы, круги и линии по точкам, подсказки
## drawTipBox. Щелчки — как dispatchClicks: по месту отпускания; правая кнопка — только полю; протяжка — только полю или
## если нажали там же.
const INK := Color8(58, 38, 20)       # #3a2614
const INK2 := Color8(122, 90, 58)     # #7a5a3a
var hits: Array = []                  # этот кадр: {x, y, w, h, id, on (Callable(c) или null), tip, field, block}
var last_hits: Array = []             # прошлый кадр
var hover = null                      # верхняя область под мышью (по прошлому кадру)
var hover_at := Vector2(-1, -1)       # для проверок: «мышь» в этой точке
var _cc := {}                         # кэш цветов по строке
var ga := 1.0                         # общая прозрачность рисунка (ctx.globalAlpha)

func now() -> float:
	return Time.get_ticks_msec() / 1000.0

func mouse() -> Vector2:
	return hover_at if hover_at.x >= 0.0 else get_local_mouse_position()

func cc(h: String) -> Color:
	var c: Variant = _cc.get(h)
	if c == null:
		if h.begins_with("rgba("):
			var p := h.substr(5, h.length() - 6).split(",")
			c = Color8(int(p[0]), int(p[1]), int(p[2]), int(roundf(float(p[3]) * 255.0)))
		else:
			c = Color.html(h)
		_cc[h] = c
	return c

func col(v: Variant) -> Color:
	return v if v is Color else cc(String(v))

# ---------- области щелчка и наведение ----------
func begin_hits() -> void:
	hits = []
	hover = top_hit(last_hits, mouse())

## кадр нарисован: щелчки и наведение — по нему
func end_hits() -> void:
	last_hits = hits

func top_hit(list: Array, p: Vector2) -> Variant:
	for i in range(list.size() - 1, -1, -1):
		var r: Dictionary = list[i]
		if p.x >= r.x and p.y >= r.y and p.x < r.x + r.w and p.y < r.y + r.h:
			return r
	return null

func hit(x: float, y: float, w: float, h: float, o: Dictionary = {}) -> Dictionary:
	var r := o.duplicate()
	r.x = x
	r.y = y
	r.w = w
	r.h = h
	hits.append(r)
	return r

func hov(id: String) -> bool:
	return hover != null and String(hover.get("id", "")) == id

## щелчок (dispatchClicks): c = {x, y — где нажали; ux, uy — где отпустили; b — кнопка 0/1/2; drag; shift}
func dispatch(c: Dictionary) -> void:
	var h: Variant = top_hit(last_hits, Vector2(c.ux, c.uy))
	if h == null or not (h.get("on") is Callable):
		return
	var field: bool = h.get("field", false)
	if c.b == 1 or (c.b == 2 and not field):
		return
	if c.drag and not field:
		var h0: Variant = top_hit(last_hits, Vector2(c.x, c.y))
		if h0 == null or String(h0.get("id", "")) != String(h.get("id", "")):
			return
	(h.on as Callable).call(c)

func blocker(tip: Variant = null) -> void:
	hit(0, 0, W, H, {"id": "blocker", "block": true, "tip": tip})

func dim(a: float) -> void:
	box(0, 0, W, H, Color(10 / 255.0, 8 / 255.0, 14 / 255.0, a))

# ---------- рисование (с общей прозрачностью ga) ----------
func _ga(c: Color) -> Color:
	if ga < 1.0:
		c.a *= ga
	return c

func box(x: float, y: float, w: float, h: float, c: Color) -> void:
	draw_rect(Rect2(x, y, w, h), _ga(c))

func stroke(x: float, y: float, w: float, h: float, c: Color) -> void:
	c = _ga(c)
	draw_rect(Rect2(x, y, w, 1), c)
	draw_rect(Rect2(x, y + h - 1, w, 1), c)
	draw_rect(Rect2(x, y, 1, h), c)
	draw_rect(Rect2(x + w - 1, y, 1, h), c)

func spr(i: int, x: float, y: float, sc: float = 1.0, a: float = 1.0, flip := false) -> void:
	super.spr(i, x, y, sc, a * ga, flip)

func txt(s: String, x: float, y: float, col: Color, f: String = "m", al: String = "l", sh = null) -> float:
	if ga < 1.0:
		col.a *= ga
		if sh is Color:
			sh = Color(sh.r, sh.g, sh.b, sh.a * ga)
	return super.txt(s, x, y, col, f, al, sh)

func px(x: float, y: float, c: Variant) -> void:
	box(floorf(x), floorf(y), 1, 1, col(c))

func hline(x: float, y: float, w: float, c: Variant) -> void:
	box(floorf(x), floorf(y), w, 1, col(c))

func vline(x: float, y: float, h: float, c: Variant) -> void:
	box(floorf(x), floorf(y), 1, h, col(c))

func rect(x: float, y: float, w: float, h: float, c: Variant) -> void:
	box(floorf(x), floorf(y), roundf(w), roundf(h), col(c))

func stroke_r(x: float, y: float, w: float, h: float, c: Variant) -> void:
	stroke(floorf(x), floorf(y), roundf(w), roundf(h), col(c))

## линия по точкам (Брезенхем, как line в engine.js); dash > 0 — пунктир: dash точек есть, dash нет
func pline(x0: float, y0: float, x1: float, y1: float, c: Variant, dash := 0) -> void:
	var a := int(x0)
	var b := int(y0)
	var e := int(x1)
	var f := int(y1)
	var dx := absi(e - a)
	var dy := -absi(f - b)
	var sx := 1 if a < e else -1
	var sy := 1 if b < f else -1
	var err := dx + dy
	var cl := _ga(col(c))
	var n := 0
	for g in 4000:
		if dash <= 0 or n % (dash * 2) < dash:
			draw_rect(Rect2(a, b, 1, 1), cl)
		n += 1
		if a == e and b == f:
			break
		var e2 := 2 * err
		if e2 >= dy:
			err += dy
			a += sx
		if e2 <= dx:
			err += dx
			b += sy

func ring(cx: int, cy: int, r: int, c: Variant) -> void:
	var x := r
	var y := 0
	var e := 0
	var cl := _ga(col(c))
	while x >= y:
		for q in [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]:
			draw_rect(Rect2(cx + q[0], cy + q[1], 1, 1), cl)
		y += 1
		e += 1 + 2 * y
		if 2 * (e - x) + 1 > 0:
			x -= 1
			e += 1 - 2 * x

func bar(x: float, y: float, w: float, h: float, v: float, c: Variant, bg: Variant = null) -> void:
	rect(x, y, w, h, PO)
	rect(x + 1, y + 1, w - 2, h - 2, bg if bg != null else "#2a1d16")
	rect(x + 1, y + 1, roundf((w - 2) * clampf(v, 0.0, 1.0)), h - 2, c)

func panel_dark(x: float, y: float, w: float, h: float, hl := false) -> void:
	rect(x, y, w, h, PO)
	rect(x + 1, y + 1, w - 2, h - 2, "#3a2a22" if hl else "#22170f")

func panel_wood(x: float, y: float, w: float, h: float) -> void:
	Art.panel_wood(self, x, y, w, h)

func panel_parch(x: float, y: float, w: float, h: float) -> void:
	rect(x + 1, y, w - 2, h, "#0c0a10")
	rect(x, y + 1, w, h - 2, "#0c0a10")
	rect(x + 1, y + 1, w - 2, h - 2, "#b89a68")
	rect(x + 2, y + 2, w - 4, h - 4, "#e8d5a8")
	hline(x + 2, y + h - 3, w - 4, "#d6be8c")
	vline(x + w - 3, y + 2, h - 4, "#d6be8c")
	for i in int(w * h / 900.0):
		hline(x + 4 + (i * 73) % maxi(1, int(w) - 10), y + 4 + (i * 131) % maxi(1, int(h) - 10), 3, "#dcc596")

## окно посреди экрана (dlg): затемнение, пергамент (или дерево), заголовок; возвращает левый верхний угол
func dlg_box(w: float, h: float, title: String, parch := true) -> Vector2:
	var x := roundf(W / 2.0 - w / 2.0)
	var y := roundf(H / 2.0 - h / 2.0)
	blocker()
	dim(0.5)
	if parch:
		panel_parch(x, y, w, h)
	else:
		panel_wood(x, y, w, h)
	if title != "":
		txt(title, x + w / 2.0, y + 8, INK if parch else Art.pal("y"), "m", "c", null if parch else PO)
		if parch:
			hline(x + 12, y + 18, w - 24, "#b89a68")
	return Vector2(x, y)

func para(s: String, x: float, y: float, maxw: float, c: Variant, f := "m", lh := 10.0, sh = null) -> float:
	var ls := wrap_text(s, maxw, f)
	for i in ls.size():
		txt(ls[i], x, y + i * lh, col(c), f, "l", sh)
	return ls.size() * lh

func fit_t(s: String, w: float, f := "m") -> String:
	if tw(s, f) <= w:
		return s
	while s.length() > 1 and tw(s + "…", f) > w:
		s = s.substr(0, s.length() - 1)
	return s + "…"

## номер значка в атласе (i_sword, shield3…)
func ic(k: String) -> int:
	var v: Variant = Art.D.get("icons", {}).get(k)
	if v != null:
		return int(v[0])
	return int(Art.D.get("mapspr", {}).get(k, -1))

## значок по имени; i_* в книжном шрифте — чёткий рисунок под точки экрана (spr из icons2.js: как есть — ×1,2 вокруг
## середины клетки, ×1,4 — как у чисел верхней строки)
func spr_k(k: String, x: float, y: float, sc := 1.0, a := 1.0, flip := false) -> void:
	var i := ic(k)
	if i < 0:
		return
	if not flip and k.begins_with("i_") and (sc == 1.0 or sc == 1.4 or sc == 3.0 or sc == 4.0) and _hi(k, "one" if sc == 1.0 else ("bar" if sc == 1.4 else ("x3" if sc == 3.0 else "x4")), x, y, a * ga):
		return
	spr(i, x, y, sc, a, flip)

func spr_w(k: String) -> float:
	var i := ic(k)
	return Art.size(i).x if i >= 0 else 0.0

func spr_h(k: String) -> float:
	var i := ic(k)
	return Art.size(i).y if i >= 0 else 0.0

## кнопка (btn): o = {label, ic, style: wood | dark | parch, active, disabled, tip, on: Callable(c)}; true — под мышью
func btn(id: String, x: float, y: float, w: float, h: float, o: Dictionary = {}) -> bool:
	var dis: bool = o.get("disabled", false)
	var hv := hov(id) and not dis
	var st: String = o.get("style", "wood")
	var act: bool = o.get("active", false)
	if st == "wood":
		rect(x, y, w, h, PO)
		rect(x + 1, y + 1, w - 2, h - 2, "#3a2e28" if dis else ("#b07a3c" if act else ("#8a5a34" if hv else "#6a4428")))
		hline(x + 1, y + 1, w - 2, "#4a3c34" if dis else ("#b07a4a" if hv else "#8a5a38"))
		hline(x + 1, y + h - 2, w - 2, "#2a201c" if dis else "#3c2a20")
	elif st == "parch":
		rect(x, y, w, h, "#b89a68")
		rect(x + 1, y + 1, w - 2, h - 2, "#cdbb94" if dis else ("#f7e3a0" if act else ("#f8eccc" if hv else "#f4ecd8")))
		hline(x + 1, y + h - 2, w - 2, "#d6be8c")
	else:
		rect(x, y, w, h, PO)
		rect(x + 1, y + 1, w - 2, h - 2, "#1d1612" if dis else ("#5a4030" if act else ("#4a3428" if hv else "#2c2018")))
	var tc: Color = (cc("#9a8a70") if dis else cc("#2a1a12")) if st == "parch" else (cc("#7a6a5a") if dis else (cc("#fff2c8") if hv or act else Art.pal("w")))
	var cx := x + floorf(w / 2.0)
	var label: String = o.get("label", "")
	var k: String = o.get("ic", "")
	var sh = null if st == "parch" else PO
	if k != "" and label != "":
		var iw := spr_w(k)
		var tot := iw + 3 + tw(label)
		spr_k(k, cx - floorf(tot / 2.0), y + floorf((h - spr_h(k)) / 2.0), 1.0, 0.45 if dis else 1.0)
		txt(label, cx - floorf(tot / 2.0) + iw + 3, y + floorf((h - 7) / 2.0), tc, "m", "l", sh)
	elif k != "":
		var iw2 := spr_w(k)
		var ih := spr_h(k)
		spr_k(k, roundf(cx - iw2 / 2.0), roundf(y + (h - ih) / 2.0) - (1.0 if hv else 0.0), 1.0, 0.45 if dis else 1.0)
	elif label != "":
		txt(label, cx, y + floorf((h - 7) / 2.0), tc, "m", "c", sh)
	hit(x, y, w, h, {"id": id, "on": null if dis else o.get("on"), "tip": o.get("tip")})
	return hv

## подсказка (drawTipBox): строки — String или {t, c, ic}; переносы по 220 точек
func tip_box(lines: Variant, m: Vector2) -> void:
	if lines == null:
		return
	if lines is String:
		lines = [lines]
	var rows: Array = []
	for l in lines:
		if l == null or (l is String and l == ""):
			continue
		var o: Dictionary = {"t": l} if l is String else l
		var first := true
		for w in wrap_text(String(o.t), 220):
			var c0: Variant = o.get("c")
			rows.append({"t": w, "c": null if c0 is String and c0 == "" else c0, "ic": String(o.get("ic", "")) if first else ""})
			first = false
	if rows.is_empty():
		return
	var w := 0.0
	for r in rows:
		w = maxf(w, tw(r.t) + (spr_w(r.ic) + 3 if r.ic != "" else 0.0))
	w += 10
	var h := rows.size() * 10.0 + 6
	var x := m.x + 10
	var y := m.y + 12
	if x + w > W - 2:
		x = m.x - w - 6
	if y + h > H - 2:
		y = m.y - h - 6
	x = floorf(maxf(2.0, x))
	y = floorf(maxf(2.0, y))
	rect(x, y, w, h, PO)
	rect(x + 1, y + 1, w - 2, h - 2, "#20160f")
	hline(x + 1, y + 1, w - 2, "#3a2a1c")
	for i in rows.size():
		var r: Dictionary = rows[i]
		var tx := x + 5
		if r.ic != "":
			spr_k(r.ic, tx, y + 4 + i * 10)
			tx += spr_w(r.ic) + 3
		txt(r.t, tx, y + 5 + i * 10, col(r.c) if r.c != null else (Art.pal("y") if i == 0 else Art.pal("w")))

## подсказка области под мышью (tip — строки или Callable → строки)
func hover_tip() -> void:
	if hover == null:
		return
	var t: Variant = hover.get("tip")
	if t is Callable:
		t = (t as Callable).call()
	if t != null:
		tip_box(t, mouse())
