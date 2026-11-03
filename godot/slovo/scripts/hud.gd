extends Control
# Надписи двора, нарисованные как в HTML (drawCourtTop, drawCourtHUD, drawBubble, drawDialog): пиксельные шрифты,
# верхняя строка с казной и часами, название комнаты, подсказка «E», облачка над головами, окно разговора с портретом.
const W := 640
const H := 360
const PO := Color8(27, 20, 32)          # PAL.o
var court: Node2D
var dark := 0.0
var help := true
var dlg = null                          # {c, name, sub, port, pages, page, shown, full}
var toast_s := ""
var toast_t := -10.0
var help_auto := true                  # строка помощи прячется сама через 40 с, пока не нажали H

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func dlg_open() -> bool:
	return dlg != null

# ---------- текст: как в HTML (книжный шрифт или пиксельный — см. Art.txt) ----------
func tw(s: String, f: String = "m") -> float:
	return Art.tw(s, f)

# y — верх заглавных букв (как txt в HTML)
func txt(s: String, x: float, y: float, col: Color, f: String = "m", al: String = "l", sh = null) -> float:
	return Art.txt(self, s, x, y, col, f, al, sh)

func wrap_text(s: String, maxw: float, f: String = "m") -> PackedStringArray:
	return Art.wrap_text(s, maxw, f)

func box(x: float, y: float, w: float, h: float, c: Color) -> void:
	draw_rect(Rect2(x, y, w, h), c)

func stroke(x: float, y: float, w: float, h: float, c: Color) -> void:
	draw_rect(Rect2(x, y, w, 1), c)
	draw_rect(Rect2(x, y + h - 1, w, 1), c)
	draw_rect(Rect2(x, y, 1, h), c)
	draw_rect(Rect2(x + w - 1, y, 1, h), c)

func spr(i: int, x: float, y: float, sc: float = 1.0, a: float = 1.0) -> void:
	var r := Art.rect(i)
	draw_texture_rect_region(Art.page(i), Rect2(roundf(x), roundf(y), r.size.x * sc, r.size.y * sc), r, Color(1, 1, 1, a))

# значок у чисел верхней строки, как sprBar в HTML: в книжном шрифте — чёткий рисунок ×1.4 под масштаб окна
func icon(k: String, x: float, y: float) -> float:
	var ic: Array = Art.D["icons"].get(k, [])
	if ic.is_empty():
		return 0.0
	var sz := Art.size(ic[0])
	if not _hi(k, "bar", roundf(x - sz.x * 0.2), roundf(y - sz.y * 0.2)):
		if int(ic[1]):
			spr(ic[0], x - sz.x * 0.2, y - sz.y * 0.2, 1.4)
		else:
			spr(ic[0], x, y)
	return sz.x

# чёткий значок (icons2.js в HTML): растр ровно под точки экрана; false — нет такого, пиксельный шрифт или окно ×1
func _hi(k: String, use: String, X: float, Y: float) -> bool:
	if Art.pixfont:
		return false
	var q: Dictionary = Art.D.get("hi", {}).get(k, {}).get(use, {})
	var V := roundi(get_viewport().get_stretch_transform().get_scale().x)
	if q.is_empty() or V < 2:
		return false
	var e: Array = q.get(str(clampi(V, 2, 4)), [])
	if e.is_empty():
		return false
	var i: int = int(e[0])
	var p: float = float(e[1]) / V
	var r := Art.rect(i)
	draw_texture_rect_region(Art.page(i), Rect2(X - p, Y - p, r.size.x / V, r.size.y / V), r)
	return true

# ---------- разговор ----------
func say(who, text: String) -> void:
	var has_p: bool = who != null and int(who.get("port", -1)) >= 0
	var tw0 := W - 32 - 124 if has_p else W - 32 - 24
	var pages: Array = []
	var lines := wrap_text(text, tw0)
	for i in range(0, lines.size(), 6):
		pages.append(lines.slice(i, i + 6))
	dlg = {"c": who, "name": "" if who == null else String(who["name"]), "sub": "" if who == null else String(who.get("sub", "")), "port": int(who.get("port", -1)) if who != null else -1, "pages": pages, "page": 0, "shown": 0.0, "full": false}

func advance() -> void:
	if dlg == null:
		return
	if not dlg["full"]:
		dlg["full"] = true
		dlg["shown"] = 1e9
		return
	if dlg["page"] < (dlg["pages"] as Array).size() - 1:
		dlg["page"] += 1
		dlg["shown"] = 0.0
		dlg["full"] = false
		return
	close_dlg()

func close_dlg() -> void:
	dlg = null

func toast(s: String) -> void:
	toast_s = s
	toast_t = court.t + 2.6

# ---------- рисование ----------
func _process(d: float) -> void:
	if dlg != null and not dlg["full"]:
		var cnt := " ".join(dlg["pages"][dlg["page"]]).length()
		dlg["shown"] += d * 75.0
		if dlg["shown"] >= cnt:
			dlg["shown"] = float(cnt)
			dlg["full"] = true

func _draw() -> void:
	if court == null:
		return
	var C := court
	var now: float = C.t
	_bubbles()
	if C.fade > 0.0:
		var a: float = C.fade if C.fade < 1.0 else 2.0 - C.fade
		box(0, 0, W, H, Color8(8, 6, 10, int(255 * clampf(a, 0.0, 1.0))))
	_top()
	if C.room != "" and now - C.room_t < 3.2:
		var a := clampf(minf((now - C.room_t) * 3.0, (3.2 - (now - C.room_t)) * 2.0), 0.0, 1.0)
		var w := tw(C.room) + 24.0
		box(8, 24, w, 15, Color8(20, 14, 12, int(209 * a)))
		stroke(8, 24, w, 15, Color8(138, 106, 58, int(255 * a)))
		txt(C.room, 8 + w / 2.0, 28, Color8(247, 211, 92, int(255 * a)), "m", "c")
	if dlg == null and not C.blocked():
		var tg: Dictionary = C.nearest_target()
		var s := ""
		if tg.has("n"):
			s = "Поговорить: " + String(tg["n"]["name"])
		elif tg.has("a"):
			s = tg["a"]["label"]
		elif C.king["sit"] != null:
			s = "Встать с трона" if C.king["sit"] == C.spots.get("throne") else "Встать"
		if s != "":
			var w := tw(s) + 30.0
			var x := floorf(W / 2.0 - w / 2.0)
			var y := H - 30.0
			box(x, y, w, 16, Color8(20, 14, 12, 217))
			stroke(x, y, w, 16, Color8(138, 106, 58))
			box(x + 4, y + 3, 11, 10, Color8(232, 213, 168))
			txt("E", x + 7, y + 5, Color8(58, 38, 20))
			txt(s, x + 20, y + 5, Color8(244, 236, 216))
	if Game.speed == 0 and dlg == null:
		var a := 0.6 + sin(now * 3.0) * 0.3
		var w := tw("ПАУЗА") + 12.0
		box(W / 2.0 - w / 2.0, 22, w, 12, Color(0.165, 0.114, 0.086, a))
		txt("ПАУЗА", W / 2.0, 25, Color(0.97, 0.83, 0.36, a), "m", "c")
	if help_auto and now > 40.0:
		help = false
		help_auto = false
	if help and dlg == null:
		var hs := "WASD или мышь — идти · E — говорить · Z — масштаб · Пробел — пауза · 1–3 — скорость · H — подсказка · Esc — выход"
		var w := tw(hs, "s") + 10.0
		box(8, H - 14, w, 11, Color8(20, 14, 12, 204))
		txt(hs, 13, H - 11, Color8(200, 216, 232), "s")
	_dialog()
	if toast_t > now:
		var a := clampf((toast_t - now) * 3.0, 0.0, 1.0)
		var ls := wrap_text(toast_s, 380)
		var w := 0.0
		for l in ls:
			w = maxf(w, tw(l))
		w += 16.0
		var h := ls.size() * 10.0 + 5.0
		var y := 40.0
		box(W / 2.0 - w / 2.0 - 1, y - 1, w + 2, h + 2, Color(PO, a))
		box(W / 2.0 - w / 2.0, y, w, h, Color(0.125, 0.086, 0.063, 0.96 * a))
		stroke(W / 2.0 - w / 2.0, y, w, h, Color(0.79, 0.63, 0.38, a))
		for i in ls.size():
			txt(ls[i], W / 2.0, y + 3 + i * 10, Color(0.97, 0.83, 0.36, a), "m", "c")

func _top() -> void:
	box(0, 0, W, 19, PO)
	box(0, 0, W, 18, Color8(42, 29, 22))
	box(0, 0, W, 1, Color8(74, 48, 32))
	box(0, 17, W, 1, Color8(106, 68, 40))
	var x := 4.0
	icon("shield0", x, 3)
	x += 16.0
	var D: Dictionary = Art.D
	var net: float = float(D.get("net", 0.0))
	var gs := str(int(float(D.get("gold", 0)) + net * maxi(0, Game.day - int(D.get("day", 0)))))   # казна растёт раз в день
	icon("i_gold", x, 7)
	txt(gs, x + 8, 6, Art.pal("y"))
	var x2 := x + 10.0 + tw(gs)
	txt(("+" if net >= 0.0 else "−") + "%.1f" % absf(net), x2, 6, Color.html("#9fe07a") if net >= 0.0 else Color.html("#ee7a6a"), "s")
	x = x2 + 30.0
	icon("i_men", x, 7)
	txt(str(int(D.get("men", 0))), x + 8, 6, Color8(244, 236, 216))
	x += 42.0
	icon("i_food", x, 7)
	txt(str(int(D.get("grain", 0))), x + 8, 6, Color8(244, 236, 216))
	x += 48.0
	var night := Game.is_night()
	var ds := Game.date_text()
	var clk := Game.clock_text()
	var wt: Dictionary = D.get("weather", {})
	var wn: String = wt.get("n", "")
	var end_x := W - 266.0
	var tot := tw(ds) + 6 + 8 + tw(clk) + 12 + 9 + tw(wn, "s")
	if x + 6 + tot > end_x:
		wn = ""
		tot -= tw(String(wt.get("n", "")), "s")
	var cx0 := maxf(x + 6, end_x - tot)
	txt(ds, cx0, 6, Color8(255, 242, 200))
	var x3 := cx0 + tw(ds) + 6
	icon("i_moon" if night else "i_sun", x3, 7)
	txt(clk, x3 + 8, 6, Color8(168, 200, 255) if night else Color8(255, 232, 160))
	x3 += 12 + tw(clk)
	icon("i_" + String(wt.get("ic", "sun")), x3, 7)
	if wn != "":
		txt(wn, x3 + 9, 6, Color8(200, 216, 232), "s")
	var bx := W - 262.0
	for i in 4:
		var bxx := bx + i * 15
		box(bxx, 2, 14, 14, PO)
		box(bxx + 1, 3, 12, 12, Color8(90, 64, 48) if Game.speed == i else Color8(44, 32, 24))
		var ik: String = ["i_pause", "i_play1", "i_play2", "i_play3"][i]
		var ic: Array = Art.D["icons"].get(ik, [])
		if not ic.is_empty():
			var sz := Art.size(ic[0])
			var sc := clampf((14.0 - 5.0) / maxf(sz.x, sz.y), 1.0, 1.6) if int(ic[1]) else 1.0
			var X := roundf(bxx + 7 - sz.x * sc / 2.0)
			var Y := roundf(2 + (14 - sz.y * sc) / 2.0)
			if not _hi(ik, "btn", X, Y):
				spr(ic[0], X, Y, sc)
	var loc_s: String = court.L["name"]
	txt(loc_s, W - 6, 6, Color8(200, 184, 152), "m", "r")

func _bubbles() -> void:
	var C := court
	var occ: Array = []
	var list: Array = []
	for n in C.npcs:
		if n["loc"] == C.loc_id and not n["away"] and n["bub"] != "":
			list.append(n)
	list.sort_custom(func(a, b): return a["bub_t"] > b["bub_t"])
	for n in list:
		var p: Vector2 = C.w2s(Vector2(n["x"], float(n["y"]) - (30.0 if n["sit"] != null else 34.0)))
		if p.x < -40 or p.x > W + 40 or p.y < 0 or p.y > H + 40:
			continue
		_bubble(n["bub"], roundf(p.x), roundf(p.y), Color8(244, 236, 216), occ)

func _bubble(s: String, sx: float, sy: float, col: Color, occ: Array) -> void:
	var ls := wrap_text(s, 150, "s")
	var w := 0.0
	for l in ls:
		w = maxf(w, tw(l, "s"))
	w += 8.0
	var h := ls.size() * 8.0 + 5.0
	var x := clampf(sx - w / 2.0, 2.0, W - w - 2.0)
	var y := sy - h - 6.0
	for r in occ:
		if x < r.x + r.size.x + 2 and r.x < x + w + 2 and y < r.y + r.size.y + 2 and r.y < y + h + 2:
			return
	occ.append(Rect2(x, y, w, h))
	box(x, y, w, h, PO)
	box(x + 1, y + 1, w - 2, h - 2, col)
	box(sx - 2, y + h - 1, 5, 2, col)
	box(sx - 3, y + h, 1, 1, PO)
	box(sx + 3, y + h, 1, 1, PO)
	box(sx - 1, y + h + 1, 3, 2, col)
	box(sx, y + h + 3, 1, 1, PO)
	for i in ls.size():
		txt(ls[i], x + 4, y + 3 + i * 8, Color8(42, 26, 18), "s")

func _dialog() -> void:
	if dlg == null:
		return
	var d: Dictionary = dlg
	var bx := 16.0
	var bh := 122.0
	var by := H - bh - 6.0
	var bw := W - 32.0
	var has_p: bool = d["port"] >= 0
	box(bx - 1, by - 1, bw + 2, bh + 2, PO)
	draw_texture(Art.parch, Vector2(bx, by))
	box(bx + 3, by + 3, bw - 6, 1, Color8(248, 236, 200))
	var tx := bx + 12.0
	if has_p:
		var px0 := bx + bw - 108.0
		var py0 := by + 4.0
		box(px0 - 2, py0 - 2, 100, 100, PO)
		box(px0 - 1, py0 - 1, 98, 98, Color8(106, 68, 40))
		box(px0, py0, 96, 96, Color8(58, 42, 34))
		spr(d["port"], px0, py0, 2.0)
		box(px0 - 2, by + bh - 20, 100, 16, PO)
		box(px0 - 1, by + bh - 19, 98, 14, Color8(106, 68, 40))
		box(px0, by + bh - 18, 96, 12, Color8(138, 90, 50))
		var nm: String = d["name"]
		var nf := "m"
		if tw(nm) > 94:
			nf = "s"
		while nm.length() > 4 and tw(nm, nf) > 94:
			nm = nm.substr(0, nm.length() - 2) + "…"
		txt(nm, px0 + 48, by + bh - (15.0 if nf == "s" else 16.0), Color8(255, 242, 200), nf, "c", PO)
		var sub: String = _sub_s(d["sub"])
		if sub != "":
			txt(sub, bx + bw - 112, by + bh - 9, Color8(122, 90, 58), "s", "r")
	elif d["name"] != "":
		txt(d["name"], bx + 12, by + 6, Color8(122, 74, 42))
	var n := int(d["shown"])
	var y := by + (10.0 if has_p or d["name"] == "" else 18.0)
	for l in d["pages"][d["page"]]:
		var s: String = l if n >= l.length() else l.substr(0, maxi(0, n))
		n -= l.length() + 1
		txt(s, tx, y, Color8(58, 38, 20))
		y += 11.0
		if n < 0:
			break
	if d["full"]:
		var last: bool = d["page"] == (d["pages"] as Array).size() - 1
		var b := 1.0 if sin(court.t * 6.0) > 0.0 else 0.0
		var mx := bx + (bw - 122.0 if has_p else bw - 14.0)
		if has_p and d["sub"] != "":
			mx = minf(mx, bx + bw - 112.0 - tw(_sub_s(d["sub"]), "s") - 10.0)
		var my := by + bh - 13.0 + b
		if last:
			box(mx, my, 5, 5, Color8(138, 90, 50))
		else:
			draw_colored_polygon(PackedVector2Array([Vector2(mx, my), Vector2(mx + 7, my), Vector2(mx + 3.5, my + 5)]), Color8(138, 90, 50))

func _sub_s(sub: String) -> String:
	return sub.substr(0, 33) + "…" if sub.length() > 34 else sub
