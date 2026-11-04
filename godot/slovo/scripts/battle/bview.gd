extends "res://scripts/battle/bpanel.gd"
## Экран боя (bscreen.js и bdraw.js): поле с камерой и картой полководца, фигурки по строям с плавным перестроением,
## знамёна отрядов, гонцы, стрелы, следы павших; выбор (щелчок, рамка, двойной щелчок — полк, цифры) и приказы (ПКМ,
## протяжка ПКМ — линия фронта, атака по врагу), расстановка перетаскиванием в своей зоне, клавиши, итог боя. Время боя
## идёт кусками по кадрам (bStep не дольше 40 мс за кадр), часы королевства в это время стоят.
signal finished(res)
const FSPC := {"levy": [5.4, 5.4, 1.8], "spear": [4.6, 4.8, 0.4], "sword": [5.0, 5.2, 0.6], "archer": [6.0, 6.4, 1.4], "xbow": [5.6, 6.0, 1.0],
	"horse": [10.0, 12.0, 1.5], "harch": [10.0, 12.0, 2.0], "knight": [10.5, 12.0, 1.0]}
const BTN := {MOUSE_BUTTON_LEFT: 0, MOUSE_BUTTON_MIDDLE: 1, MOUSE_BUTTON_RIGHT: 2}
var NOW := 0.0
var figc := {}             # u._fig: номер отряда → {n, form, cur, tgt, ph, so, t}
var bn: Array = []         # B._bn: знамёна и значки, нарисованные в этом кадре, — {u, x, y, w, h}
var dn := {}               # input.down: кнопка → {x, y, moved}
var drag = null            # B.drag: {box, x0, y0} или {grp: [{id, ox, oy, x0, y0}]}
var pan = null
var edge_t := 0.0
var vis_rt := 0.0
var last_clk := {"id": -1, "t": -10.0}
var mouse_in := true
var done := false
var scol: Array = []       # sideCol: [цвет, тёмный] по сторонам
var figd: Array = []       # кадры фигурок по сторонам: род → кадр → [спрайт, fy, cx]
var sdark: Array = []      # тёмные цвета сторон — для следов павших

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_ALL

## startBattle: o — {size, siege, works, sett, amb, tplA, tplB}
func setup(A: Dictionary, Bs: Dictionary, tile: int, o: Dictionary = {}) -> void:
	o = o.duplicate()
	o.ambush = JS.t(o.get("amb"))
	o.ai = [false, true]
	B = SimBattle.setupBattle(A, Bs, tile, o)
	B.speed = 1
	B.weather = Sim.weatherOf()
	B.sel = []
	B.selRegs = []
	if JS.t(o.get("amb")):
		for u: SimBattle.BU in B.units:
			if u.side == 1:
				u.morale = maxf(10, u.morale - 20)
	SimBattle.updateVis(B)
	scol = []
	figd = []
	sdark = []
	var FG: Array = Art.D.get("figs", [])
	for s in 2:
		var r: Variant = B.sides[s].get("realm")
		var ri := 6 if r == null else int(r)
		var d: Dictionary = Sim.REALM_DEF[ri]
		scol.append([col(d.col), col(d.dark)])
		sdark.append(col(d.dark))
		figd.append(FG[ri] if ri < FG.size() else {})
	bf = BField.new()
	add_child(bf)
	bf.setup(B.F, Sim.G.day)
	var z := SimBattle.deployZoneF(B.F, 0)
	cam_to((z[0] + z[1]) / 2.0 + 90, B.F.H / 2.0)
	Game.hold = true

# ---------- камера и точки ----------
func ov_geo() -> Vector3:
	var sc := minf(VW / B.F.W, VH / B.F.H)
	return Vector3(sc, roundf((VW - B.F.W * sc) / 2), roundf((VH - B.F.H * sc) / 2))

func b2s(x: float, y: float) -> Vector2:
	if ov:
		var o := ov_geo()
		return Vector2(o.y + x * o.x, Y0 + o.z + y * o.x)
	return Vector2(x - B.cam.x, y - B.cam.y + Y0)

func s2b(sx: float, sy: float) -> Vector2:
	if ov:
		var o := ov_geo()
		return Vector2((sx - o.y) / o.x, (sy - Y0 - o.z) / o.x)
	return Vector2(sx + B.cam.x, sy - Y0 + B.cam.y)

func in_view(x: float, y: float, m := 30.0) -> bool:
	var s := b2s(x, y)
	return s.x > -m and s.x < VW + m and s.y > Y0 - m and s.y < Y0 + VH + m

func unit(i: Variant) -> SimBattle.BU:
	var k := int(i) if i != null else -1
	return B.units[k] if k >= 0 and k < B.units.size() else null

# ---------- рисование ----------
func _draw() -> void:
	if B == null:
		return
	NOW = now()
	SimBattle.useField(B.F)
	begin_hits()
	rect(0, 0, W, H, "#1b1420")
	if ov:
		var o := ov_geo()
		var w := roundf(B.F.W * o.x)
		var h := roundf(B.F.H * o.x)
		rect(0, Y0, VW, VH, "#3a2e22")
		if bf != null:
			draw_texture_rect(bf.smooth, Rect2(o.y, Y0 + o.z, w, h), false, Color8(236, 212, 160))
		rect(o.y, Y0 + o.z, w, h, "rgba(238,222,180,0.28)")
		for x in range(0, int(w), 32):
			rect(o.y + x, Y0 + o.z, 1, h, "rgba(90,60,30,0.10)")
		for y in range(0, int(h), 32):
			rect(o.y, Y0 + o.z + y, w, 1, "rgba(90,60,30,0.10)")
	elif bf != null:
		draw_texture_rect_region(bf.get_texture(), Rect2(0, Y0, VW, VH), Rect2(roundf(B.cam.x), roundf(B.cam.y), VW, VH))
	hit(0, Y0, VW, VH, {"id": "bfield", "field": true, "on": field_click, "tip": field_tip})
	if B.phase == "deploy":
		var z := SimBattle.deployZoneF(B.F, 0)
		var p0 := b2s(z[0], 0)
		var p1 := b2s(z[1], B.F.H)
		rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, "rgba(168,200,255,0.12)")
		vline(roundf(p1.x), p0.y, p1.y - p0.y, "rgba(216,232,255,0.5)")
	bn = []
	var known := []
	var rough := []
	for u: SimBattle.BU in B.units:
		if not SimBattle.bAlive(u):
			continue
		var kn: Variant = knowU(u)
		if kn == "full":
			known.append(u)
		elif kn == "rough":
			rough.append(u)
	_ghosts()
	for u: SimBattle.BU in rough:
		var s := b2s(u.x + (JSM.hash2(u.id, 9, 1) - 0.5) * 30, u.y + (JSM.hash2(u.id, 9, 2) - 0.5) * 24)
		var r := 5.0 if ov else SimBattle.bRad(u)
		ga = 0.28
		rect(s.x - r, s.y - r * 0.6, r * 2, r * 1.2, "#6a5a4a")
		ga = 0.85
		rect(s.x - 10, s.y - r - 10, 20, 8, PO)
		rect(s.x - 9, s.y - r - 9, 18, 6, "#5a4a44")
		txt("~" + str(maxi(50, roundi(u.men / 50) * 50)), s.x - 8, s.y - r - 8, cc("#e8dcc0"), "s")
		ga = 1.0
	if ov:
		_tokens(known)
	else:
		_figures(known)
	_selection()
	if not ov:
		for u: SimBattle.BU in known:
			_banner(u)
	else:
		_reg_labels()
	var m := mouse()
	var d2: Variant = dn.get(2)
	if d2 != null and d2.moved and B.sel.size() and B.res == null:
		pline(d2.x, d2.y, m.x, m.y, "#fff2c8", 2)
		var a := s2b(d2.x, d2.y)
		var b := s2b(m.x, m.y)
		var L := a.distance_to(b)
		if L > 6:
			var E := enemy_centre()
			var nx := -(b.y - a.y) / L
			var ny := (b.x - a.x) / L
			if (E.x - (a.x + b.x) / 2) * nx + (E.y - (a.y + b.y) / 2) * ny < 0:
				nx = -nx
				ny = -ny
			for t in [0.0, 0.5, 1.0]:
				var q := Vector2(d2.x, d2.y).lerp(m, t)
				pline(q.x, q.y, q.x + nx * 7, q.y + ny * 7, "#fff2c8")
	for c: Dictionary in B.couriers:
		if c.side != 0:
			continue
		var u := unit(c.u)
		if u == null:
			continue
		var t := clampf((B.t - c.t0) / maxf(0.01, c.t1 - c.t0), 0, 1)
		var s := b2s(c.x0 + (u.x - c.x0) * t, c.y0 + (u.y - c.y0) * t)
		rect(s.x - 1, s.y - 2, 3, 3, PO)
		px(s.x, s.y - 1, "#f7d35c")
	if not ov:
		_arrows()
	_fx()
	if drag != null and drag.has("box") and dn.has(0) and dn[0].moved:
		stroke_r(minf(drag.x0, m.x), minf(drag.y0, m.y), absf(m.x - drag.x0), absf(m.y - drag.y0), "#fff2c8")
	_herald()
	if B.phase == "deploy":
		txt("Расстановка: тащите отряды в своей зоне · ПКМ — поставить выбранных · протяните ПКМ — линия фронта · 2×ЛКМ — весь полк", 6, Y0 + VH - (19 if ov else 9),
			INK if ov else cc("#fff2c8"), "s", "l", null if ov else PO)
	if ov:
		txt("Карта полководца · колесо вверх или Tab — назад к войскам", VW / 2, Y0 + VH - 9, INK, "s", "c")
	if B.speed == 0 and B.phase == "fight" and B.res == null:
		txt("ПАУЗА — отдавайте приказы", VW / 2, Y0 + 5, cc("#fff2c8"), "m", "c", PO)
	draw_top()
	draw_bottom()
	if B.res != null:
		draw_end(end_screen)
	hover_tip()
	end_hits()

## где врага видели последним (B.ghost[0])
func _ghosts() -> void:
	var G0: Array = B.ghost[0]
	for gh in G0:
		if gh == null:
			continue
		var age: float = B.t - gh.t
		if age > 40:
			continue
		var s := b2s(gh.x, gh.y)
		ga = 0.5 if age < 12 else 0.28
		if ov:
			stroke_r(roundf(s.x - 4), roundf(s.y - 3), 8, 6, "#8a3a2a")
		else:
			rect(s.x - 8, s.y - 14, 16, 8, PO)
			rect(s.x - 7, s.y - 13, 14, 6, "#5a4a44")
			spr_k(UICON.get(gh.type, "i_men"), s.x - 6, s.y - 13)
			txt("?", s.x + 1, s.y - 12, Color.WHITE, "s")
		ga = 1.0

# ---------- фигурки (formSlots, unitFigs, figFrameFor) ----------
func fig_count(u: SimBattle.BU) -> int:
	var M := u.mounted
	var mpf := maxf(4.0 if M else 5.0, B.bmax / (14.0 if M else 24.0))
	return clampi(ceili(u.men / mpf), 1, 14 if M else 26)

func _grid(out: PackedVector2Array, u: SimBattle.BU, n: int, files: int, sx: float, sy: float, j: float) -> void:
	var ranks := ceili(float(n) / files)
	for k in n:
		var f := k % files
		var r := k / files
		var in_row := n - r * files if r == ranks - 1 else files
		out.append(Vector2((f - (in_row - 1) / 2.0) * sx + (JSM.hash2(u.id, k, 1) - 0.5) * j * 2, ((ranks - 1) / 2.0 - r) * sy + (JSM.hash2(u.id, k, 2) - 0.5) * j * 2))

func form_slots(u: SimBattle.BU, n: int, form: String) -> PackedVector2Array:
	var sp: Array = FSPC.get(u.type, FSPC.levy)
	var sx0: float = sp[0]
	var sy0: float = sp[1]
	var j0: float = sp[2]
	var M := u.mounted
	var out := PackedVector2Array()
	match form:
		"close":
			_grid(out, u, n, clampi(ceili(n / 4.0), 1, 10), sx0 * 0.78, sy0 * 0.8, j0 * 0.3)
		"loose":
			_grid(out, u, n, clampi(ceili(n / 2.0), 1, 14), sx0 * 1.5, sy0 * 1.5, j0 * 2 + 1)
		"column":
			_grid(out, u, n, 2 if M or n <= 8 else 3, sx0 * 0.9, sy0 * 0.85, j0 * 0.5)
		"wedge":
			var k := 0
			var r := 0
			while k < n:
				var w := 2 * r + 1
				var i := 0
				while i < w and k < n:
					out.append(Vector2((i - (w - 1) / 2.0) * sx0 * 0.85, -r * sy0 * 0.75 + (JSM.hash2(u.id, k, 2) - 0.5) * j0))
					i += 1
					k += 1
				r += 1
			var my := 0.0
			for p in out:
				my += p.y
			my /= out.size()
			for q in out.size():
				out[q] = Vector2(out[q].x, out[q].y - my)
		"square":
			var s := maxi(2, ceili(n / 4.0))
			var L := s * minf(sx0, sy0) * 0.95
			var per := PackedVector2Array()
			for i in s:
				var a := float(i) / s * 2
				per.append(Vector2(a - 1, -1))
				per.append(Vector2(1, a - 1))
				per.append(Vector2(1 - a, 1))
				per.append(Vector2(-1, 1 - a))
			for k in n:
				out.append(per[(k * per.size()) / n] * (L / 2))
		_:
			_grid(out, u, n, clampi(ceili(n / (2.0 if M else 3.0)), 1, 12), sx0, sy0, j0)
	return out

func _figures(known: Array) -> void:
	var keys: Array = []
	var fpx := PackedFloat32Array()
	var fu: Array = []
	var fk := PackedInt32Array()
	var ff := PackedInt32Array()
	for u: SimBattle.BU in known:
		if not in_view(u.x, u.y, 40):
			continue
		var n := fig_count(u)
		var form := "loose" if u.state == "rout" else (u.formTo if u.formTo != "" else u.form)
		var Fc: Variant = figc.get(u.id)
		if Fc == null or Fc.n != n or Fc.form != form:
			var tgt := form_slots(u, n, form)
			if Fc == null:
				Fc = {"cur": tgt.duplicate(), "t": 0.0}
				figc[u.id] = Fc
			Fc.n = n
			Fc.form = form
			Fc.tgt = tgt
			var cur0: PackedVector2Array = Fc.cur
			if cur0.size() > n:
				cur0.resize(n)
			while cur0.size() < n:
				cur0.append(tgt[cur0.size()])
			Fc.cur = cur0
			var ph := PackedFloat32Array()
			var so := PackedFloat32Array()
			for k in n:
				ph.append(JSM.hash2(u.id, k, 7) * 6.283)
				so.append((JSM.hash2(u.id, k, 8) - 0.5) * 0.3)
			Fc.ph = ph
			Fc.so = so
		var cur: PackedVector2Array = Fc.cur
		var tg: PackedVector2Array = Fc.tgt
		if Fc.t != NOW:
			var a := minf(1.0, (NOW - Fc.t if Fc.t > 0.0 else 1.0) * 2.5)
			Fc.t = NOW
			for k in n:
				cur[k] = cur[k] + (tg[k] - cur[k]) * a
			Fc.cur = cur
		var fx := cos(u.face)
		var fy := sin(u.face)
		var rout := u.state == "rout"
		var sq := form == "square" and u.formTo == ""
		var fb := n / 2 if n >= 4 and not sq else -1
		for k in n:
			var o := cur[k]
			var px0 := u.x - fy * o.x + fx * o.y
			var py0 := u.y + fx * o.x + fy * o.y
			if rout:
				px0 += (JSM.hash2(u.id, k, 3) - 0.5) * 16
				py0 += (JSM.hash2(u.id, k, 4) - 0.5) * 12
			keys.append(Vector2(py0, fu.size()))
			fpx.append(px0)
			fu.append(u)
			fk.append(k)
			ff.append((1 if k == fb and not rout else 0) | (2 if ((px0 < u.x) if sq else (fx < 0)) else 0))
	keys.sort()
	var cx: float = B.cam.x
	var cy: float = B.cam.y - Y0
	for kv: Vector2 in keys:
		var i := int(kv.y)
		var u: SimBattle.BU = fu[i]
		var k := fk[i]
		var FR: Dictionary = figd[u.side].get(u.type, {})
		if FR.is_empty():
			continue
		var Fc: Dictionary = figc[u.id]
		var fr := _frame(u, k, Fc.ph[k], Fc.so[k])
		if ff[i] & 1 and not (u.charger and u.ch > 0.25):
			fr = "flag1" if sin(NOW * 3.2 + u.id) > 0 else "flag2"
		var s: Array = FR.get(fr, FR.stand)
		var mv := u.state == "move" or u.state == "rout"
		var bob := roundf(absf(sin(NOW * 9 + k * 1.7)) * 0.8) if mv and not u.mounted else 0.0
		var flip := (ff[i] & 2) != 0
		var si := int(s[0])
		var w := Art.size(si).x
		var a := (0.5 if u.hidden else 0.8) if u.hidden or u.state == "rout" else 1.0
		spr(si, roundf(fpx[i] - cx - ((w - 1 - s[2]) if flip else s[2])), roundf(kv.x - cy - s[1] - bob), 1.0, a, flip)

func _frame(u: SimBattle.BU, k: int, ph: float, so: float) -> String:
	var mv := u.state == "move" or u.state == "rout"
	var shot := B.t - u.lastShot < (0.5 if u.type == "xbow" else 0.75) + so
	if u.mounted:
		if u.charger and u.ch > 0.25 and u.state != "rout":
			return ("chg1" if sin(NOW * 16 + ph) > 0 else "chg2") if mv else "atk"
		if u.type == "harch" and shot and u.state != "rout":
			return ("chg1" if sin(NOW * 13 + ph) > 0 else "chg2") if mv else "atk"
		if mv:
			return "walk1" if sin(NOW * 10 + ph) > 0 else "walk2"
		if u.state == "melee":
			return "atk" if sin(NOW * 4 + ph) > -0.2 else "stand"
		return "stand"
	if mv:
		return "walk1" if sin(NOW * 9 + ph) > 0 else "walk2"
	if u.ranged:
		if u.state == "melee":
			return "atk" if sin(NOW * 5 + ph) > 0.3 else "stand"
		return "atk" if shot else "stand"
	if u.state == "melee":
		if u.type == "spear":
			return "atk" if sin(NOW * 6 + ph) > -0.6 else "stand"
		return "atk" if sin(NOW * 5 + ph) > 0.1 else "stand"
	return "stand"

## карта полководца: отряды — плашки по направлению, значок рода, корона полководца
func _tokens(known: Array) -> void:
	var sc := ov_geo().x
	for u: SimBattle.BU in known:
		var s := b2s(u.x, u.y)
		var c0: Color = scol[u.side][0]
		var c1: Color = scol[u.side][1]
		var r := maxf(4.0, SimBattle.bRad(u) * sc)
		var fx := cos(u.face)
		var fy := sin(u.face)
		var a := 0.5 if u.state == "rout" else (0.6 if u.hidden else 1.0)
		var dw := r * 1.1 if u.mounted else r * 0.8
		draw_set_transform(Vector2(roundf(s.x), roundf(s.y)), u.face)
		draw_rect(Rect2(-dw / 2 - 1, -r - 1, dw + 2, 2 * r + 2), Color(PO, a))
		draw_rect(Rect2(-dw / 2, -r, dw, 2 * r), Color(c1, a))
		draw_rect(Rect2(dw / 2 - 2, -r, 2, 2 * r), Color(c0, a))
		draw_set_transform(Vector2.ZERO)
		spr_k(UICON.get(u.type, "i_men"), roundf(s.x - 2 - fx), roundf(s.y - 2 - fy))
		if u.gen:
			spr_k("i_crown", roundf(s.x - 3), roundf(s.y - r - 7))
		bn.append({"u": u, "x": s.x - r, "y": s.y - r, "w": 2 * r, "h": 2 * r})

func _reg_labels() -> void:
	for k in SimBattle.REGK:
		var us := SimBattle.regUnits(B, 0, k)
		if us.is_empty():
			continue
		var cx := 0.0
		var cy := 1e9
		for u: SimBattle.BU in us:
			cx += u.x
			cy = minf(cy, u.y - SimBattle.bRad(u))
		var s := b2s(cx / us.size(), cy)
		txt(REGD[k] + " " + SimBattle.REGS[k], s.x, s.y - 9, cc(REGC[k]), "s", "c", PO)

## знамя отряда: номер полка, род, число, дух; корона, флажок воеводы, перестроение, ворон гонца, «под вашим приказом»
func _banner(u: SimBattle.BU) -> void:
	if not in_view(u.x, u.y, 30):
		return
	var own := u.side == 0
	var s := b2s(u.x, u.y)
	var bw := 28.0
	var bx := roundf(s.x - bw / 2)
	var by := roundf(s.y - SimBattle.bRad(u) - 15)
	var g: SimBattle.BReg = B.regs[u.side][u.reg]
	if u.hidden:
		ga = 0.6
	rect(bx, by, bw, 9, PO)
	rect(bx + 1, by + 1, bw - 2, 7, scol[u.side][1])
	rect(bx + 1, by + 1, 6, 7, REGC[u.reg] if own else "#3a1a1a")
	txt(REGD[u.reg] if own else "·", bx + 3, by + 2, PO if own else cc("#ffb4a8"), "s")
	spr_k(UICON.get(u.type, "i_men"), bx + 8, by + 2)
	txt(str(roundi(u.men)), bx + 15, by + 2, Color.WHITE, "s")
	bar(bx, by + 9, bw, 3, u.morale / 100.0, "#c0353f" if u.morale < 30 else ("#d8a040" if u.morale < 55 else "#7fb04c"))
	if u.gen:
		spr_k("i_crown", bx + bw / 2 - 3, by - 7)
	elif own and g.lead == u.id and JS.t(SimBattle.cmdOk(g)):
		vline(bx + bw - 3, by - 6, 6, "#3a2a1a")
		rect(bx + bw - 2, by - 6, 4, 3, REGC[u.reg])
	if u.formTo != "":
		var ph := int(floorf(NOW * 4)) % 3
		for i in 3:
			px(bx + 2 + i * 3, by - 2, "#fff2c8" if i == ph else "#8a7a60")
	if own and (u.pend != null or u.pendF != null or (g.pend != null and g.lead == u.id)) and sin(NOW * 8) > 0:
		spr_k("i_raven", bx + bw + 1, by)
	if u.man and own:
		px(bx + bw - 2, by + 1, "#fff2c8")
	ga = 1.0
	bn.append({"u": u, "x": bx, "y": by, "w": bw, "h": 12.0})

## выбранное: якоря и направление полков, куда идут; кольца у выбранных отрядов и их собственные приказы
func _selection() -> void:
	for k in B.selRegs:
		var g: SimBattle.BReg = B.regs[0][k]
		var us := SimBattle.regUnits(B, 0, k)
		if us.is_empty():
			continue
		var a := b2s(g.ax, g.ay)
		var cx := 0.0
		var cy := 0.0
		for u: SimBattle.BU in us:
			cx += u.x
			cy += u.y
		var cs := b2s(cx / us.size(), cy / us.size())
		var o: Dictionary = g.pend.ord if g.pend != null else g.order
		var t := unit(o.get("t")) if o.k == "attack" else null
		if t != null:
			var ts := b2s(t.x, t.y)
			pline(cs.x, cs.y, ts.x, ts.y, "rgba(238,122,106,0.65)", 3)
		elif a.distance_to(cs) > 10:
			pline(cs.x, cs.y, a.x, a.y, "rgba(255,242,200,0.45)", 3)
		rect(a.x - 2, a.y - 2, 5, 5, PO)
		rect(a.x - 1, a.y - 1, 3, 3, REGC[k])
		pline(a.x, a.y, a.x + cos(g.af) * 9, a.y + sin(g.af) * 9, REGC[k])
	var sc := ov_geo().x if ov else 1.0
	var seen := {}
	for id in B.sel:
		if seen.has(id):
			continue
		seen[id] = true
		var u := unit(id)
		if u == null or not SimBattle.bAlive(u):
			continue
		var s := b2s(u.x, u.y)
		var r := maxi(4, roundi(SimBattle.bRad(u) * sc))
		ga = 0.65
		ring(roundi(s.x), roundi(s.y), r + 2, REGC[u.reg] if B.selRegs.has(u.reg) else "#fff2c8")
		ga = 1.0
		if u.man and u.order != null:
			if u.order.k == "move":
				var t := b2s(u.order.x, u.order.y)
				pline(s.x, s.y, t.x, t.y, "rgba(255,242,200,0.5)", 3)
			elif u.order.k == "attack" and unit(u.order.get("t")) != null:
				var tu := unit(u.order.t)
				var t2 := b2s(tu.x, tu.y)
				pline(s.x, s.y, t2.x, t2.y, "rgba(238,122,106,0.6)", 3)

func _arrows() -> void:
	for a: Dictionary in B.arrows:
		if B.t < a.t0:
			continue
		var t: float = (B.t - a.t0) / a.d
		var arc: float = a.arc if JS.t(a.get("arc")) else 26.0
		var x: float = a.x0 + (a.x1 - a.x0) * t
		var y: float = a.y0 + (a.y1 - a.y0) * t - sin(t * PI) * arc
		if not in_view(x, y, 6):
			continue
		var vx: float = a.x1 - a.x0
		var vy: float = (a.y1 - a.y0) - cos(t * PI) * arc * PI
		var L := Vector2(vx, vy).length()
		if L == 0.0:
			L = 1.0
		var s := b2s(x, y)
		var k := 3.0 if a.xb else 4.0
		pline(s.x, s.y, s.x - vx / L * k, s.y - vy / L * k, "#22160e" if a.xb else "#3a2a1a")

func _fx() -> void:
	for f: Dictionary in B.fx:
		var ui := f.has("n0")
		var age: float = NOW - f.n0 if ui else B.t - f.t0
		var a := 1.0 - age / (1.6 if ui else 2.0)
		if not in_view(f.x, f.y, 20):
			continue
		ga = clampf(a, 0, 1)
		var s := b2s(f.x, f.y)
		match String(f.k):
			"txt":
				txt(String(f.t), s.x, s.y - age * 8, col(f.c), "s" if ov else "m", "c", PO)
			"mark":
				ring(roundi(s.x), roundi(s.y), 3 + roundi(age * 4), f.c)
			"line":
				var e := b2s(f.x1, f.y1)
				pline(s.x, s.y, e.x, e.y, f.c, 2)
		ga = 1.0

## глашатай: что случилось за краем видимого (последние три вести)
func _herald() -> void:
	var L := []
	for l: Dictionary in B.log:
		var age: float = NOW - l.n0 if l.has("n0") else B.t - l.t
		if age < 6 and (l.get("x") == null or not in_view(l.x, l.y, -20) or ov):
			L.append([l, age])
	L = L.slice(-3)
	for i in L.size():
		ga = clampf(6 - L[i][1], 0, 1)
		txt(String(L[i][0].s), 6, Y0 + 4 + i * 10, col(L[i][0].c), "m", "l", PO)
		ga = 1.0

# ---------- поиск под мышью и приказы с поля ----------
func unit_at(x: float, y: float, side := -1) -> SimBattle.BU:
	var best: SimBattle.BU = null
	var bd := 1e9
	var pad := 4.0 / ov_geo().x if ov else 4.0
	for u: SimBattle.BU in B.units:
		if not SimBattle.bAlive(u) or (side >= 0 and u.side != side):
			continue
		if u.side == 1 and knowU(u) != "full":
			continue
		var d := Vector2(u.x - x, u.y - y).length()
		if d < SimBattle.bRad(u) + pad and d < bd:
			bd = d
			best = u
	return best

## отряд или знамя под точкой экрана
func pick_at(sx: float, sy: float, side := -1) -> SimBattle.BU:
	for i in range(bn.size() - 1, -1, -1):
		var r: Dictionary = bn[i]
		var u: SimBattle.BU = r.u
		if sx >= r.x and sx < r.x + r.w and sy >= r.y and sy < r.y + r.h and (side < 0 or u.side == side) and SimBattle.bAlive(u):
			return u
	var p := s2b(sx, sy)
	return unit_at(p.x, p.y, side)

func enemy_centre() -> Vector2:
	var x := 0.0
	var y := 0.0
	var n := 0
	var v: PackedByteArray = B.vis[0]
	for u: SimBattle.BU in B.units:
		if u.side == 1 and SimBattle.bAlive(u) and (v[u.id] or (B.phase == "deploy" and knowU(u) != null)):
			x += u.x
			y += u.y
			n += 1
	return Vector2(x / n, y / n) if n else Vector2(B.F.W, B.F.H / 2)

## разложить выбранное вдоль протянутой линии (или сохранить его облик вокруг точки); лицом — к врагу
func place_along(regs: Array, blocks: Array, x: float, y: float, ln: Variant) -> Array:
	var items := []
	for k in regs:
		var g: SimBattle.BReg = B.regs[0][k]
		var us := SimBattle.regUnits(B, 0, k)
		if us.is_empty():
			continue
		var lo := 1e9
		var hi := -1e9
		var ms := 0.0
		var md := 0.0
		for u: SimBattle.BU in us:
			lo = minf(lo, u.sy - SimBattle.bRad(u))
			hi = maxf(hi, u.sy + SimBattle.bRad(u))
			ms += u.sy
			md += u.sx
		items.append({"g": g, "u": null, "x": g.ax, "y": g.ay, "f": g.af, "w": hi - lo, "ms": ms / us.size(), "md": md / us.size()})
	for u: SimBattle.BU in blocks:
		items.append({"g": null, "u": u, "x": u.x, "y": u.y, "f": u.face, "w": 2 * SimBattle.bRad(u), "ms": 0.0, "md": 0.0})
	if items.is_empty():
		return []
	var FW := B.F.W
	var FH := B.F.H
	var out := []
	if ln == null or Vector2(ln[2] - ln[0], ln[3] - ln[1]).length() < 12:
		var cx := 0.0
		var cy := 0.0
		for p in items:
			cx += p.x
			cy += p.y
		cx /= items.size()
		cy /= items.size()
		for p in items:
			out.append({"g": p.g, "u": p.u, "x": clampf(x + p.x - cx, 12, FW - 12), "y": clampf(y + p.y - cy, 12, FH - 12), "f": p.f})
		return out
	var L := Vector2(ln[2] - ln[0], ln[3] - ln[1]).length()
	var dx: float = (ln[2] - ln[0]) / L
	var dy: float = (ln[3] - ln[1]) / L
	var E := enemy_centre()
	var mx: float = (ln[0] + ln[2]) / 2
	var my: float = (ln[1] + ln[3]) / 2
	var nx := -dy
	var ny := dx
	if (E.x - mx) * nx + (E.y - my) * ny < 0:
		nx = -nx
		ny = -ny
	var f := atan2(ny, nx)
	items.sort_custom(func(p, q): return p.x * dx + p.y * dy < q.x * dx + q.y * dy)
	var gap := 6.0
	var tot := gap * (items.size() - 1)
	for p in items:
		tot += p.w
	var spare := maxf(0, L - tot) / maxf(1, items.size() - 1)
	var at := (L - tot) / 2 if tot > L else 0.0
	if items.size() == 1:
		at = (L - items[0].w) / 2
	for p in items:
		var c: float = at + p.w / 2
		at += p.w + gap + (0.0 if tot > L else spare)
		var px1: float = ln[0] + dx * c
		var py1: float = ln[1] + dy * c
		if p.g != null:
			var cs := cos(f)
			var sn := sin(f)
			px1 -= cs * p.md - sn * p.ms
			py1 -= sn * p.md + cs * p.ms
		out.append({"g": p.g, "u": p.u, "x": clampf(px1, 12, FW - 12), "y": clampf(py1, 12, FH - 12), "f": f})
	return out

func order_at(x: float, y: float, ln: Variant = null) -> bool:
	var sp := sel_split()
	var regs: Array = sp.regs
	var blocks: Array = sp.blocks
	if regs.is_empty() and blocks.is_empty():
		return false
	if B.phase == "deploy":
		deploy_move(regs, blocks, x, y, ln)
		return true
	var tgt: SimBattle.BU = null
	if ln == null:
		var s := b2s(x, y)
		tgt = pick_at(s.x, s.y, 1)
	if tgt != null:
		for k in regs:
			SimBattle.issueReg(B, B.regs[0][k], {"k": "attack", "t": tgt.id})
		for u: SimBattle.BU in blocks:
			SimBattle.issue(B, u, {"k": "attack", "t": tgt.id})
			u.man = true
		B.fx.append({"k": "mark", "x": tgt.x, "y": tgt.y, "c": "#ee7a6a", "n0": NOW})
	else:
		for p in place_along(regs, blocks, x, y, ln):
			if p.g != null:
				SimBattle.issueReg(B, p.g, {"k": "move", "x": p.x, "y": p.y, "f": p.f})
			else:
				SimBattle.issue(B, p.u, {"k": "move", "x": p.x, "y": p.y, "f": p.f})
				p.u.man = true
		B.fx.append({"k": "mark", "x": x, "y": y, "c": "#fff2c8", "n0": NOW})
		if ln != null:
			B.fx.append({"k": "line", "x": ln[0], "y": ln[1], "x1": ln[2], "y1": ln[3], "c": "#fff2c8", "n0": NOW})
	return true

## до боя приказы мгновенны: полки и отряды просто встают, куда поставили
func deploy_move(regs: Array, blocks: Array, x: float, y: float, ln: Variant) -> void:
	var z := SimBattle.deployZoneF(B.F, 0)
	for p in place_along(regs, blocks, x, y, ln):
		if p.g != null:
			var g: SimBattle.BReg = p.g
			g.ax = clampf(p.x, z[0], z[1])
			g.ay = p.y
			g.af = p.f
			for u: SimBattle.BU in SimBattle.regUnits(B, 0, g.k):
				var s := SimBattle.slotOf(g, u)
				if not place_u(u, s[0], s[1]):
					place_u(u, g.ax, g.ay)
				u.face = g.af
				SimBattle.setSlot(g, u)
				hide_check(u)
		else:
			var u: SimBattle.BU = p.u
			if place_u(u, p.x, p.y):
				u.face = p.f
				SimBattle.setSlot(B.regs[0][u.reg], u)
				hide_check(u)

func place_u(u: SimBattle.BU, x: float, y: float) -> bool:
	var z := SimBattle.deployZoneF(B.F, 0)
	x = clampf(x, z[0], z[1])
	y = clampf(y, 12, B.F.H - 12)
	if not SimBattle.passCell(B.F, SimBattle.cellAt(x, y), u):
		return false
	u.x = x
	u.y = y
	return true

func field_click(c: Dictionary) -> void:
	if B.res != null:
		return
	NOW = now()
	if c.b == 2:
		if c.drag:
			var a := s2b(c.x, c.y)
			var b := s2b(c.ux, c.uy)
			order_at(b.x, b.y, [a.x, a.y, b.x, b.y])
		else:
			var p := s2b(c.ux, c.uy)
			if not order_at(p.x, p.y):
				sel_clear()
		return
	if c.drag:
		return
	var own := pick_at(c.ux, c.uy, 0)
	if own != null:
		var dbl: bool = last_clk.id == own.id and NOW - last_clk.t < 0.4
		last_clk = {"id": own.id, "t": NOW}
		if dbl:
			sel_reg(own.reg, c.shift)
		elif c.shift:
			var i := B.sel.find(own.id)
			if i >= 0:
				B.sel.remove_at(i)
			else:
				B.sel.append(own.id)
			sel_fix()
		else:
			B.sel = [own.id]
			sel_fix()
		return
	var q := s2b(c.ux, c.uy)
	if B.sel.size() and B.phase == "fight":
		order_at(q.x, q.y)
	else:
		sel_clear()

func field_tip() -> Variant:
	if drag != null or dn.has(2):
		return null
	var m := mouse()
	var u := pick_at(m.x, m.y)
	if u != null:
		return unit_tip(u)
	var p := s2b(m.x, m.y)
	for gh in B.ghost[0]:
		if gh != null and Vector2(gh.x - p.x, gh.y - p.y).length() < 12:
			return [String(Sim.UNIT[gh.type].n) + " (враг) — видели " + str(roundi(B.t - gh.t)) + " с назад", {"t": "Около " + str(roundi(gh.men)) + " воинов. Где они сейчас — неизвестно.", "c": DIM}]
	return null

# ---------- ввод ----------
func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_ENTER:
		mouse_in = true
	elif what == NOTIFICATION_MOUSE_EXIT or what == NOTIFICATION_WM_MOUSE_EXIT:
		mouse_in = false

func _gui_input(e: InputEvent) -> void:
	if B == null:
		return
	if e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.pressed and (mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			wheel(1 if mb.button_index == MOUSE_BUTTON_WHEEL_DOWN else -1, mb.position)
			return
		var b: int = BTN.get(mb.button_index, -1)
		if b < 0:
			return
		if mb.pressed:
			dn[b] = {"x": mb.position.x, "y": mb.position.y, "moved": false}
		elif dn.has(b):
			var d: Dictionary = dn[b]
			dn.erase(b)
			dispatch({"x": d.x, "y": d.y, "ux": mb.position.x, "uy": mb.position.y, "b": b, "drag": d.moved, "shift": mb.shift_pressed})
		queue_redraw()
	elif e is InputEventMouseMotion:
		var p: Vector2 = (e as InputEventMouseMotion).position
		for b in dn:
			if not dn[b].moved and Vector2(dn[b].x, dn[b].y).distance_to(p) > 4:
				dn[b].moved = true

## колесо: вниз — карта полководца, вверх — назад к войскам, туда, где мышь
func wheel(d: int, p: Vector2) -> void:
	if B.res != null or p.y < Y0 or p.y >= Y0 + VH:
		return
	if d > 0 and not ov:
		ov = true
	elif d < 0 and ov:
		var q := s2b(p.x, p.y)
		ov = false
		cam_to(q.x, q.y)

func _unhandled_input(e: InputEvent) -> void:
	if B == null or not (e is InputEventKey):
		return
	var k := e as InputEventKey
	if not k.pressed or k.echo:
		return
	key(k.physical_keycode if k.physical_keycode != KEY_NONE else k.keycode, k.shift_pressed, k.ctrl_pressed or k.meta_pressed)
	get_viewport().set_input_as_handled()

## battleKeys
func key(c: int, shift := false, ctrl := false) -> void:
	if B.res != null:
		return
	NOW = now()
	if c == KEY_SPACE and B.phase == "fight":
		if B.speed > 0:
			last_sp = B.speed
			B.speed = 0
		else:
			B.speed = last_sp if last_sp > 0 else 1.0
	elif (c == KEY_EQUAL or c == KEY_KP_ADD) and B.phase == "fight":
		B.speed = 1.0 if B.speed == 0 else minf(4, B.speed * 2)
	elif (c == KEY_MINUS or c == KEY_KP_SUBTRACT) and B.phase == "fight":
		B.speed = 0.0 if B.speed <= 1 else B.speed / 2
	elif c >= KEY_1 and c <= KEY_5:
		var q: String = SimBattle.REGK[c - KEY_1]
		if shift and B.sel.size():
			reassign(q)
		else:
			sel_reg(q, ctrl)
	elif c == KEY_TAB:
		ov = not ov
	elif c == KEY_A and ctrl:
		B.sel = []
		for u: SimBattle.BU in B.units:
			if u.side == 0 and SimBattle.bAlive(u):
				B.sel.append(u.id)
		sel_fix()
	elif c == KEY_ESCAPE:
		sel_clear()
	elif c == KEY_H and B.phase == "fight":
		sig_btn()
	elif c == KEY_G and B.phase == "fight":
		rally_btn()
	elif (c == KEY_ENTER or c == KEY_KP_ENTER) and B.phase == "deploy":
		go_fight()
	queue_redraw()

func held(k: int) -> bool:
	return Input.is_physical_key_pressed(k)

## battleInput: перетаскивание при расстановке, рамка выбора, камера (средняя кнопка, клавиши, края экрана)
func battle_input(dt: float) -> void:
	var d0: Variant = dn.get(0)
	var fh: bool = hover != null and String(hover.get("id", "")) == "bfield"
	var m := mouse()
	if d0 != null and drag == null and fh and d0.y >= Y0 and d0.y < Y0 + VH and B.res == null:
		var u := pick_at(d0.x, d0.y, 0) if B.phase == "deploy" else null
		var bp := s2b(d0.x, d0.y)
		if u != null:
			var grp: Array = sel_units() if B.sel.has(u.id) else [u]
			if not B.sel.has(u.id):
				B.sel = [u.id]
				sel_fix()
			var L := []
			for v: SimBattle.BU in grp:
				L.append({"id": v.id, "ox": v.x - bp.x, "oy": v.y - bp.y, "x0": v.x, "y0": v.y})
			drag = {"grp": L}
		else:
			drag = {"box": true, "x0": d0.x, "y0": d0.y}
	if drag != null and d0 != null and d0.moved and drag.has("grp"):
		var mp := s2b(m.x, m.y)
		for q: Dictionary in drag.grp:
			place_u(B.units[q.id], mp.x + q.ox, mp.y + q.oy)
	if d0 == null and drag != null:
		var dr: Dictionary = drag
		drag = null
		if dr.has("box"):
			var x0 := minf(dr.x0, m.x)
			var x1 := maxf(dr.x0, m.x)
			var y0 := minf(dr.y0, m.y)
			var y1 := maxf(dr.y0, m.y)
			if x1 - x0 > 4 or y1 - y0 > 4:
				var a := s2b(x0, y0)
				var b := s2b(x1, y1)
				var inb := []
				for u: SimBattle.BU in B.units:
					if u.side == 0 and SimBattle.bAlive(u) and u.x >= a.x and u.x <= b.x and u.y >= a.y and u.y <= b.y:
						inb.append(u.id)
				if held(KEY_SHIFT):
					for i in inb:
						if not B.sel.has(i):
							B.sel.append(i)
				else:
					B.sel = inb
				sel_fix()
		elif dr.has("grp"):
			var by := {}
			for q: Dictionary in dr.grp:
				var v: SimBattle.BU = B.units[q.id]
				if not by.has(v.reg):
					by[v.reg] = []
				by[v.reg].append([v, v.x - q.x0, v.y - q.y0])
			for k in by:
				var g: SimBattle.BReg = B.regs[0][k]
				var L: Array = by[k]
				if SimBattle.regUnits(B, 0, k, true).size() == L.size():
					var sx := 0.0
					var sy := 0.0
					for p in L:
						sx += p[1]
						sy += p[2]
					g.ax += sx / L.size()
					g.ay += sy / L.size()
				for p in L:
					SimBattle.setSlot(g, p[0])
					hide_check(p[0])
	var d1: Variant = dn.get(1)
	if d1 != null and not ov:
		if pan == null:
			pan = {"mx": d1.x, "my": d1.y, "cx": B.cam.x, "cy": B.cam.y}
		B.cam.x = pan.cx - (m.x - pan.mx)
		B.cam.y = pan.cy - (m.y - pan.my)
		cam_clamp()
	else:
		pan = null
	if not ov and B.res == null:
		var sp := 260.0 * dt
		var vx := 0
		var vy := 0
		if held(KEY_A) or held(KEY_LEFT):
			vx -= 1
		if held(KEY_D) or held(KEY_RIGHT):
			vx += 1
		if held(KEY_W) or held(KEY_UP):
			vy -= 1
		if held(KEY_S) or held(KEY_DOWN):
			vy += 1
		var inF := mouse_in and m.y >= Y0 and m.y < Y0 + VH and m.x >= 0 and m.x < W
		var ex := 0
		var ey := 0
		if inF and d0 == null:
			if m.x <= 3:
				ex = -1
			elif m.x >= W - 4:
				ex = 1
			if m.y <= Y0 + 3:
				ey = -1
			elif m.y >= Y0 + VH - 4:
				ey = 1
		if ex or ey:
			edge_t += dt
			if edge_t > 0.3:
				vx += ex
				vy += ey
		else:
			edge_t = 0.0
		if vx or vy:
			B.cam.x += vx * sp
			B.cam.y += vy * sp
			cam_clamp()

# ---------- ход боя ----------
func _process(dt: float) -> void:
	if B == null:
		return
	NOW = now()
	SimBattle.useField(B.F)
	battle_input(dt)
	if B.phase == "fight" and B.over == null and B.speed > 0:
		var t := minf(0.25, dt) * B.speed
		var t0 := Time.get_ticks_msec()
		while t > 1e-4:
			var s := minf(0.1, t)
			SimBStep.bStep(B, s)
			t -= s
			if B.over != null or Time.get_ticks_msec() - t0 > 40:
				break
	if B.phase == "deploy":
		vis_rt -= dt
		if vis_rt <= 0:
			vis_rt = 0.5
			SimBattle.updateVis(B)
	if B.over != null and B.res == null:
		finish_battle()
	B.arrows = B.arrows.filter(func(a): return B.t < a.t0 + a.d)
	B.fx = B.fx.filter(func(f): return NOW - f.n0 < 1.6 if f.has("n0") else B.t - f.t0 < 2)
	B.couriers = B.couriers.filter(func(c): return B.t < c.t1)
	B.snd.clear()
	if bf != null:
		bf.add_dead(B.dead, sdark)
	queue_redraw()

func finish_battle() -> void:
	var res := SimCapt.applyBattle(B)
	B.res = res
	res.sett = B.o.get("sett")
	var s0: Dictionary = B.sides[0]
	var s1: Dictionary = B.sides[1]
	var gf := String(s0.get("genFate", "")) if s0.get("genFate") is String else ""
	var ef := String(s1.get("genFate", "")) if s1.get("genFate") is String else ""
	var KG := {"captured": "Король попал в плен!", "freed": "Короля едва не схватили — свои отбили!", "killed": "Король тяжело ранен и вынесен с поля.",
		"escaped": "Король ушёл с поля боя." if JS.t(s0.get("genFlee")) else ""}
	var EG := {"captured": "Вражеский полководец взят в плен!", "freed": "Вражеского полководца почти взяли — его отбили.", "killed": "Вражеский полководец пал.",
		"escaped": "Вражеский полководец бежал с поля." if JS.t(s1.get("genFlee")) else ""}
	var parts := []
	if gf != "" and String(KG.get(gf, "")) != "":
		parts.append(KG[gf])
	if ef != "" and String(EG.get(ef, "")) != "":
		parts.append(EG[ef])
	res.genFate = " ".join(parts)
	res.genBad = gf == "captured" or gf == "killed"
	if ef == "captured":
		var g: Variant = s1.get("gen")
		if g is Dictionary and int(JS.n(g.get("realm"))) < 5 and g.get("realm") != null:
			var R: Variant = SimDay.rulerOf(int(g.realm))
			var gold := 40 + int(JS.n(g.get("mar"))) * 5
			var who := (String(R.get("title", "")) + " " + String(R.get("name", ""))).strip_edges() if R is Dictionary else "Враг"
			SimCmd.msg({"kind": "ransom", "from": g.realm, "char": g.id, "gold": gold, "text": who + " предлагает " + str(gold) + " зол. выкупа за полководца " + String(g.get("name", "")) + ". Отказ — он останется у нас, и войско врага лишится вождя.", "until": Sim.G.day + 20})
	ov = false
	sel_clear()

## «На карту»: итог — наружу (main вернёт карту, поставит паузу, возьмёт крепость после штурма)
func end_screen() -> void:
	if done:
		return
	done = true
	Game.hold = false
	var res: Dictionary = B.res
	if res.get("sett") != null and res.win == 0:
		var pa: Variant = Sim.playerArmy()
		var S: Dictionary = Sim.G.setts[int(res.sett)]
		if pa != null and int(S.ctrl) != int(Sim.G.player.realm):
			SimArmy.captureSett(pa, S, "штурм")
	SimBattle.freeBattle(B)
	finished.emit(res)

func _exit_tree() -> void:
	if not done:
		Game.hold = false

# ---------- для проверок и веб-команд ----------
func cmd(p: PackedStringArray) -> void:
	match p[0]:
		"fight":
			go_fight()
		"speed":
			B.speed = float(p[1]) if p.size() > 1 else 4.0
		"ov":
			ov = not ov
		"sel":
			sel_reg(p[1] if p.size() > 1 else "C", false)
		"order":
			_order_regs(B.selRegs, p[1] if p.size() > 1 else "adv")
		"win":
			B.over = {"win": 0, "time": true}
		"flee":
			ret_arm = now()
			flee_field()
		"end":
			if B.res != null:
				end_screen()
		"cam":
			cam_to(float(p[1]), float(p[2]))
		"state":
			print("BSTATE ", JSON.stringify(state()))

func state() -> Dictionary:
	var a := _side_sum(0)
	var b := _side_sum(1)
	return {"screen": "battle", "phase": B.phase, "t": B.t, "units": B.units.size(), "men": [a.m, b.m], "over": B.over, "res": B.res != null, "ov": ov, "sel": B.sel.size(), "regs": B.selRegs}
