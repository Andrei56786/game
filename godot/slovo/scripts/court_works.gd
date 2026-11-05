extends RefCounted
## Стол зодчего (projects.js): окно «Замыслы и стройки» у донжона (WIN_EXT.proj: двенадцать работ — заложить, свернуть),
## леса стройки (siteTwin, OBJP.site: готовая постройка поднимается из земли под лесами — шаг картинки в рабочий день),
## ящики, вывеска и мольберт, пока работа идёт (выгрузка: when «cur:k»), клетки под постройкой (projApply: sol — заняты, пока
## строится и когда готово; un — свободны, когда готово; короля — с только что огороженной стройки), мастера стройки (projNpcs:
## с утра у своей работы, в полдень у колодца; projCrewTalk — дать на пиво), звёздная труба (stars). Стройка по дням,
## заложить и свернуть — SimExt (projDaily, projStart, projStop: SimExt.proj_rev — двору пересобрать клетки и людей).
const Aud = preload("res://scripts/court_audience.gd")
const CT := 16
## RPK.wood и OUTL (pix.js): цвета лесов
const W0 := [[0x22, 0x12, 0x0a], [0x3c, 0x22, 0x12], [0x5c, 0x36, 0x1e], [0x7e, 0x4e, 0x2a], [0xa2, 0x6a, 0x3a], [0xc6, 0x8a, 0x52]]
const OUTL := [0x1a, 0x10, 0x18]
const HELLO := ["Работаем, государь! ", "Камень к камню, доска к доске. ", "Не извольте беспокоиться, государь. "]
const STARS := ["Млечный путь льётся над башнями.", "Луна в прожилках, как старый сыр.", "Над северной стеной горит красная звезда."]
## цвета окна (P3, UIC в HTML)
const LAB := "#c8b898"
const HI := "#fff2c8"
const GOOD := "#9fe07a"
const BAD := "#ee7a6a"
const WARN := "#f7d35c"
const DIM := "#9a8a70"

var c: Node2D
var g_ref = null              # G, по которому разложены клетки
var rev := -1                 # SimExt.proj_rev, по которому разложены
var sites: Array = []         # леса в этом месте: [Sprite2D, e, k, t]
var imgs := {}                # готовая постройка (site_N.png) → Image
var drawn := 0                # сколько раз перерисованы леса (для проверок)

func _init(court: Node2D) -> void:
	c = court

static func ok() -> bool:
	return not Sim.G.is_empty() and Sim.G.has("court")

static func cur(k := "") -> Variant:
	return SimExt.projCur(k) if ok() else null

## что делают мастера сейчас (projPhase): пять ступеней на работу
func phase(cc: Dictionary) -> String:
	var PH: Dictionary = c.D.get("pjph", {})
	var ph: Array = PH.get(String(cc.k), PH.get("_", ["работают"]))
	return String(ph[mini(ph.size() - 1, floori(float(cc.prog) / float(cc.need) * ph.size()))])

static func day_n(cc: Dictionary) -> int:
	return maxi(1, int(Sim.G.day - float(cc.day) + 1))

# ---------- клетки (projApply) ----------
func stale() -> bool:
	return ok() and (rev != SimExt.proj_rev or not is_same(g_ref, Sim.G))

func apply() -> void:
	if not ok():
		return
	g_ref = Sim.G
	rev = SimExt.proj_rev
	for k in c.D.get("proj", []):
		var d: Variant = SimExt.projK(k)
		if d == null:
			continue
		var done := SimDyn.projDone(k)
		var on: bool = done or SimExt.projCur(k) != null
		for r in d.get("sol", []):
			_fill(r, on)
		for r in d.get("un", []):
			_fill(r, not done)
	var P: Dictionary = c.king
	if not JS.t(Sim.G.get("visit")) and String(P.loc) == c.loc_id and not c.can_stand(float(P.x), float(P.y)):
		var v: Vector2i = c.near_free(c.loc_id, floori(float(P.x) / CT), floori((float(P.y) - 2.0) / CT))
		P.x = v.x * CT + 8.0
		P.y = v.y * CT + 11.0

## sfill: клетки [место, x0, y0, x1, y1] (включительно) — заняты или свободны; и в сетке путей
func _fill(r: Array, v: bool) -> void:
	var id := String(r[0])
	if not c.D.locs.has(id) or not c.grids.has(id):
		return
	var Ld: Dictionary = c.D.locs[id]
	var w: int = int(Ld.w)
	var h: int = int(Ld.h)
	var b: PackedByteArray = String(Ld.solid).to_ascii_buffer()
	var g: AStarGrid2D = c.grids[id]
	for y in range(int(r[2]), int(r[4]) + 1):
		for x in range(int(r[1]), int(r[3]) + 1):
			if x >= 0 and y >= 0 and x < w and y < h:
				b[y * w + x] = 49 if v else 48
				g.set_point_solid(Vector2i(x, y), v)
	Ld.solid = b.get_string_from_ascii()

# ---------- леса стройки (siteTwin, OBJP.site) ----------
func add_site(s: Sprite2D, e: Dictionary) -> void:
	var w := String(e.get("when", ""))
	sites.append([s, e, w.substr(4) if w.begins_with("cur:") else "", -1.0])

## каждый кадр (видимость — conds двора): шаг работ сменился — новая картинка
func update_sites() -> void:
	for p in sites:
		var s: Sprite2D = p[0]
		if not s.visible:
			continue
		var cc: Variant = cur(p[2])
		if cc == null:
			continue
		var t: float = JS.rnd(JS.clp(float(cc.prog) / float(cc.need), 0.0, 0.99) * 100.0) / 100.0
		if t == float(p[3]):
			continue
		p[3] = t
		var e: Dictionary = p[1]
		var im := _img(String(e.site.png))
		if im == null:
			continue
		s.region_enabled = false
		s.texture = ImageTexture.create_from_image(site_img(im, String(e.site.en), t))
		drawn += 1

func _img(fn: String) -> Image:
	if not imgs.has(fn):
		var tex: Texture2D = load("res://art/" + fn) if ResourceLoader.exists("res://art/" + fn) else null
		var im: Image = tex.get_image() if tex != null else null
		if im != null and im.get_format() != Image.FORMAT_RGBA8:
			im.convert(Image.FORMAT_RGBA8)
		imgs[fn] = im
	return imgs[fn]

## OBJP.site: готовое — от земли до кромки (кромка неровная: шум en по столбцам), у кромки — светлее (cmix с деревом 0.35)
## и тёмная черта над ней; поверх — леса: стойки через 20 точек, настилы через 12, раскосы, лестница справа, обводка
static func site_img(base: Image, en: String, t0: float) -> Image:
	var w := base.get_width()
	var h := base.get_height()
	var src := base.get_data()
	var b := PackedByteArray()
	b.resize(w * h * 4)
	b.fill(0)
	var t := clampf(t0, 0.0, 1.0)
	var top := h
	var bot := 0
	for y in h:
		for x in w:
			if src[(y * w + x) * 4 + 3] > 100:
				if y < top:
					top = y
				if y > bot:
					bot = y
	var ln := int(JS.rnd(bot + 1 - (bot + 1 - top) * maxf(0.06, t)))
	var E := PackedInt32Array()
	E.resize(w)
	for x in w:
		E[x] = ln + (en.unicode_at(x) - 48 if x < en.length() else 0)
	var W5: Array = W0[5]
	for y in h:
		for x in w:
			var i := (y * w + x) * 4
			if src[i + 3] == 0 or y < E[x]:
				continue
			if y < E[x] + 2:
				for q in 3:
					b[i + q] = int(src[i + q] + (int(W5[q]) - src[i + q]) * 0.35)
				b[i + 3] = int(src[i + 3] + (255 - src[i + 3]) * 0.35)
			else:
				for q in 4:
					b[i + q] = src[i + q]
	for x in w:
		var e := E[x]
		if e >= 1 and e < h and b[(e * w + x) * 4 + 3] != 0 and b[((e - 1) * w + x) * 4 + 3] == 0:
			_put(b, w, h, x, e - 1, OUTL)
	var s := PackedByteArray()
	s.resize(w * h * 4)
	s.fill(0)
	var st := maxi(0, ln - 9)
	var x1 := 1
	while x1 < w - 2:
		_rect(s, w, h, x1, st, 2, bot - st + 1, W0[2])
		_rect(s, w, h, x1, st, 1, bot - st + 1, W0[3])
		x1 += 20
	var y1 := st
	while y1 < bot - 2:
		_rect(s, w, h, 0, y1, w, 2, W0[4] if y1 == st else W0[3])
		_rect(s, w, h, 0, y1, w, 1, W0[5])
		y1 += 12
	x1 = 1
	while x1 + 20 < w:
		_line(s, w, h, x1 + 2, bot - 2, x1 + 20, maxi(st + 2, bot - 18), W0[2])
		x1 += 40
	var lx := w - 10
	for y in range(st, bot + 1):
		_put(s, w, h, lx, y, W0[3])
		_put(s, w, h, lx + 4, y, W0[3])
		if (y - st) % 3 == 1:
			_rect(s, w, h, lx + 1, y, 3, 1, W0[4])
	# обводка (outline: 4 соседа, «непрозрачный» — альфа > 100) и наложение лесов (blit: всё непрозрачно — поверх)
	var s0 := s.duplicate()
	for y in h:
		for x in w:
			var i := (y * w + x) * 4
			if s0[i + 3] > 100:
				continue
			if (x > 0 and s0[i - 4 + 3] > 100) or (x < w - 1 and s0[i + 4 + 3] > 100) or (y > 0 and s0[i - w * 4 + 3] > 100) or (y < h - 1 and s0[i + w * 4 + 3] > 100):
				s[i] = OUTL[0]
				s[i + 1] = OUTL[1]
				s[i + 2] = OUTL[2]
				s[i + 3] = 255
	for i in range(0, w * h * 4, 4):
		if s[i + 3] != 0:
			b[i] = s[i]
			b[i + 1] = s[i + 1]
			b[i + 2] = s[i + 2]
			b[i + 3] = s[i + 3]
	return Image.create_from_data(w, h, false, Image.FORMAT_RGBA8, b)

static func _put(d: PackedByteArray, w: int, h: int, x: int, y: int, c0: Array) -> void:
	if x < 0 or y < 0 or x >= w or y >= h:
		return
	var i := (y * w + x) * 4
	d[i] = c0[0]
	d[i + 1] = c0[1]
	d[i + 2] = c0[2]
	d[i + 3] = 255

static func _rect(d: PackedByteArray, w: int, h: int, x: int, y: int, rw: int, rh: int, c0: Array) -> void:
	for j in range(y, y + rh):
		for i in range(x, x + rw):
			_put(d, w, h, i, j, c0)

## PB.line (Брезенхэм, не больше 999 точек)
static func _line(d: PackedByteArray, w: int, h: int, x0: int, y0: int, x1: int, y1: int, c0: Array) -> void:
	var dx := absi(x1 - x0)
	var dy := -absi(y1 - y0)
	var sx := 1 if x0 < x1 else -1
	var sy := 1 if y0 < y1 else -1
	var e := dx + dy
	for k in 999:
		_put(d, w, h, x0, y0, c0)
		if x0 == x1 and y0 == y1:
			break
		var e2 := 2 * e
		if e2 >= dy:
			e += dy
			x0 += sx
		if e2 <= dx:
			e += dx
			y0 += sy

# ---------- мастера стройки (projNpcs, projCrewTalk) ----------
## в populate, после узников (как homeExtras): у каждой работы — свои мастера, ключи pjw0, pjw1
func crew(out: Array, old: Dictionary) -> void:
	var cc: Variant = cur()
	if cc == null:
		return
	var k := String(cc.k)
	var d: Variant = SimExt.projK(k)
	if d == null:
		return
	var j: int = (c.D.get("proj", []) as Array).find(k)
	var cr: Array = d.get("crew", [])
	for i in cr.size():
		var w: Array = cr[i]
		var sp := "pjw_" + k + str(i)
		if not c.spots.has(sp):
			continue
		var ch := Aud.pseudo(70 + i + j * 2, String(w[0]), int(w[1]), int(w[2]), String(w[3]))
		var n: Dictionary = c.people.mk(out, old, "pjw" + str(i), ch, {"sched": [[5.0, "gate_out"], [7.0, sp], [12.0, "well"], [13.0, sp], [18.5, "gate_out"]],
			"home": "gate_out", "staff": "builder", "sub0": String(w[4]) + ": " + String(d.n).to_lower(), "pjk": k, "spd": 46.0})
		var lk: Variant = (c.D.get("pcrew", {}) as Dictionary).get(sp)
		if lk is Array:
			n.sheet = lk[0]
			n.port = int(lk[1])
		n.lines = (c.D.get("pjlines", ["Работаем от света до света!"]) as Array).duplicate()

func crew_talk(n: Dictionary) -> bool:
	var cc: Variant = cur(String(n.get("pjk", "")))
	if cc == null:
		return false
	var G := Sim.G
	var P: Dictionary = SimExt.projState()
	var left := maxi(1, ceili((float(cc.need) - float(cc.prog)) / SimExt.projRate()))
	var ch: Array = [{"t": "Дать мастерам на пиво (10 зол.)", "tip": "Работа пойдёт веселее: день-другой выиграете.", "fx": func():
			if float(G.realms[0].gold) < 10:
				c.hud.toast("В казне пусто.")
				return
			G.realms[0].gold -= 10
			cc.prog += 1.5
			P.beer = G.day
			Snd.sfx("coin")
			c.people.say(n, "Спасибо, государь! Мигом управимся!", 3.0)},
		{"t": "Не мешать"}]
	if P.get("beer") == G.day:
		ch.pop_front()
	c.hud.say(n, HELLO[randi() % HELLO.size()] + "Сейчас " + phase(cc) + ". Осталось дней " + str(left) + ", если погода не подведёт.",
		{"choices": ch, "esc": ch.size() - 1})
	return true

# ---------- стол зодчего и звёздная труба (ACTS_EXT.works, ACTS_EXT.stars) ----------
func open() -> void:
	if not SimPlayer.ensure_sim():
		return
	c.hud.win = {"k": "proj", "sel": ""}
	Snd.sfx("paper")
	print("WORKS OPEN")

func stars() -> void:
	var Wt: Dictionary = Sim.G.get("weather", {"k": "clear", "days": 1}) if ok() else {"k": "clear", "days": 1}
	if not Game.is_night():
		c.hud.say(null, "Днём в трубу видно только облака да крыши города. Звездочёт просит прийти ночью.", {"name": "Звёздная труба"})
		return
	var d := maxi(1, int(JS.rnd(float(JS.o(Wt.get("days"), 1.0)))))
	var wn := String(Sim.weatherOf().get("n", "")) if ok() and JS.t(Sim.G.get("weather")) else ""
	c.hud.say(null, "Вы смотрите в медную трубу. " + STARS[randi() % STARS.size()] + " Звездочёт шепчет: «" + (wn if wn != "" else "Погода") + " продержится ещё "
		+ str(d) + " " + Sim.plural(d, "день", "дня", "дней") + ", государь».", {"name": "Звёздная труба"})
	Snd.sfx("paper")

## заложить (кнопка «Заложить»): SimExt.projStart — золото сразу; клетки и мастера — по proj_rev
func start(k: String) -> bool:
	if SimExt.projStart(k):
		c.hud.toast("Заложено: «" + String(SimExt.projK(k).n) + "».")
		return true
	return false

## окно «Замыслы и стройки» (WIN_EXT.proj): u — слой двора (рисует), w — окно
func draw_win(u: Variant, w: Dictionary) -> void:
	var X := 14.0
	var Y := 21.0
	var WW := 612.0
	var HH := 326.0
	var P: Variant = SimExt.projState()
	u.win_frame(X, Y, WW, HH, "Замыслы и стройки", false)
	if P == null:
		return
	var s: Variant = SimDyn.seatChar("seneschal")
	var rate := SimExt.projRate()
	var r: Dictionary = Sim.G.realms[0]
	var y := Y + 22
	u.tx("Сенешаль " + String(s.name) + " ведёт работы: скорость ×" + JS.fixed(rate, 2) if s != null else "Сенешаля нет — стройки идут медленно (×" + JS.fixed(rate, 2) + ").",
		X + 16, y, Art.pal("w") if s != null else WARN, "s")
	u.tx("Казна: " + SimText.fmt(floorf(float(r.gold))) + " зол.", X + WW - 22, y, LAB, "s", "r")
	y += 13
	var L: Array = c.D.get("proj", [])
	if String(w.get("sel", "")) == "":
		w.sel = String(P.cur.k) if JS.t(P.get("cur")) else String(L[0])
	for i in L.size():
		var k := String(L[i])
		var d: Dictionary = SimExt.projK(k)
		var x := X + 8 + (i % 4) * 150
		var yy := y + floorf(i / 4.0) * 68
		var cw := 146.0
		var chh := 64.0
		var done := SimDyn.projDone(k)
		var cc: Variant = SimExt.projCur(k)
		var sel: bool = String(w.sel) == k
		u.rect(x, yy, cw, chh, "#2e4a24" if done else ("#5a4030" if cc != null else ("#4a3626" if sel else "#3a2a1e")))
		u.stroke_r(x, yy, cw, chh, "#f7d35c" if sel else ("#e0a630" if cc != null else ("#7fb04c" if done else "#6a4a2a")))
		u.tx(String(d.n), x + 4, yy + 3, HI)
		u.tx("✓" if done else JS.s(d.cost), x + cw - 4, yy + 3, GOOD if done else (Art.pal("y") if float(r.gold) >= float(d.cost) else BAD), "s", "r")
		var ls: PackedStringArray = u.wrap_text(String(d.fx), cw - 8, "s")
		for j in mini(3, ls.size()):
			u.tx(ls[j], x + 4, yy + 14 + j * 9, "#bfe0a0" if done else "#d8c8a8", "s")
		if cc != null:
			u.bar(x + 4, yy + chh - 10, cw - 8, 6, float(cc.prog) / float(cc.need), "#e0a630")
		else:
			u.tx(("Для нынешнего государя" if JS.t(d.get("per")) else "Построено") if done else "≈" + str(ceili(float(d.days) / rate)) + " дн.", x + 4, yy + chh - 11,
				GOOD if done else DIM, "s")
		u.hit(x, yy, cw, chh, {"id": "pj_" + k, "on": func(_c): w.sel = k})
	# выбранная работа
	var dk := String(w.sel)
	var d: Dictionary = SimExt.projK(dk)
	var cc: Variant = SimExt.projCur(dk)
	var done := SimDyn.projDone(dk)
	var by := Y + HH - 70
	u.rect(X + 8, by, WW - 16, 62, "rgba(0,0,0,0.22)")
	u.stroke_r(X + 8, by, WW - 16, 62, "#6a4a2a")
	u.tx(String(d.n), X + 16, by + 5, Art.pal("y"))
	u.para(String(d.d), X + 16, by + 17, 380, "#e8dcc0", "s", 9)
	u.para("Даст: " + String(d.fx), X + 16, by + 37, 380, GOOD, "s", 9)
	var bx := X + WW - 196
	if done:
		u.tx("Сделано для нынешнего государя." if JS.t(d.get("per")) else "Уже построено.", bx, by + 26, GOOD, "s")
	elif cc != null:
		var left := maxi(1, ceili((float(cc.need) - float(cc.prog)) / rate))
		u.tx("День " + str(day_n(cc)) + " · осталось ≈" + str(left) + " " + Sim.plural(left, "день", "дня", "дней"), bx, by + 2, Art.pal("w"), "s")
		u.tx("Сейчас " + phase(cc), bx, by + 11, LAB, "s")
		u.bar(bx, by + 21, 180, 7, float(cc.prog) / float(cc.need), "#e0a630")
		u.btn("pj_stop", bx, by + 34, 180, 15, {"label": "Свернуть (вернуть часть золота)", "style": "dark", "tip": "Вернётся половина от неизрасходованного.",
			"on": func(_c): SimExt.projStop()})
	else:
		var busy: Variant = SimExt.projK(String(P.cur.k)) if JS.t(P.get("cur")) else null
		var can: bool = busy == null and float(r.gold) >= float(d.cost)
		var nd := ceili(float(d.days) / rate)
		u.tx("Стоимость " + JS.s(d.cost) + " зол. · ≈" + str(nd) + " " + Sim.plural(nd, "день", "дня", "дней"), bx, by + 8, Art.pal("w"), "s")
		if busy != null:
			u.tx("Сначала закончите «" + String(busy.n) + "».", bx, by + 20, WARN, "s")
		elif float(r.gold) < float(d.cost):
			u.tx("В казне не хватает золота.", bx, by + 20, BAD, "s")
		u.btn("pj_go", bx, by + 34, 180, 15, {"label": "Заложить", "style": "wood" if can else "dark", "disabled": not can, "tip": "Золото уходит сразу, работы идут сами, по дням.",
			"on": func(_c): start(dk)})

## для проверок: что строится, сколько лесов видно и сколько раз их перерисовали, занята ли клетка под стройкой
func state() -> Dictionary:
	var cc: Variant = cur()
	var o := {"cur": String(cc.k) if cc != null else "", "prog": snappedf(float(cc.prog) / float(cc.need), 0.001) if cc != null else 0.0,
		"sites": sites.filter(func(p): return (p[0] as Sprite2D).visible).size(), "drawn": drawn, "done": [] as Array}
	if ok() and JS.t(Sim.G.court.get("proj")):
		o.done = (Sim.G.court.proj.done as Dictionary).keys()
	if cc != null:
		var d: Variant = SimExt.projK(String(cc.k))
		var sol: Array = d.get("sol", []) if d != null else []
		if not sol.is_empty():
			o.solid = c.solid_at(String(sol[0][0]), int(sol[0][1]), int(sol[0][2]))
	return o

# ---------- самопроверка (-- --works) ----------
func _act(id: String) -> Dictionary:
	for a in c.L.acts:
		if String(a.id) == id:
			return a
	return {}

func _crew() -> Array:
	return c.npcs.filter(func(n): return n.has("pjk"))

func _vis(w: String) -> int:
	return c.conds.filter(func(p): return String(p[1]) == w and (p[0] as Sprite2D).visible).size()

func _opaque(im: Image, y1: int) -> int:
	var n := 0
	var d := im.get_data()
	for y in y1:
		for x in im.get_width():
			if d[(y * im.get_width() + x) * 4 + 3] != 0:
				n += 1
	return n

func selftest() -> bool:
	if not ok():
		print("selftest: стол зодчего — нет королевства")
		return false
	var G := Sim.G
	var P: Dictionary = SimExt.projState()
	var res := true
	var gold0: float = G.realms[0].gold
	var done0: Dictionary = (P.done as Dictionary).duplicate(true)
	P.cur = null
	P.done = {}
	SimExt.proj_rev += 1
	Game.speed = 1
	Game.set_hour(9.0)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	# стол зодчего у донжона: подпись «E», окно «Замыслы и стройки»
	c.go_loc("yard")
	c._tick(0.02)
	var a := _act("works")
	c.king.x = float(a.get("x", 0))
	c.king.y = float(a.get("y", 0)) + 6.0
	c.king.dir = "up"
	var tg: Dictionary = c.nearest_target()
	var lab: String = c.act_label(tg.a) if tg.has("a") else ""
	if tg.has("a"):
		c.interact(tg)
	var ok0: bool = c.hud.win != null and String(c.hud.win.k) == "proj" and lab == "Стол зодчего: замыслы и стройки"
	c.hud.win = null
	var stars_hidden: bool = c.D.locs.upper.acts.filter(func(q): return String(q.id) == "stars" and String(q.get("when", "")) == "proj:observatory").size() == 1
	print("selftest: стол зодчего — подпись «", lab, "», окно ", ok0, ", звёздная труба по условию ", stars_hidden, ", работ ", (c.D.get("proj", []) as Array).size())
	res = res and ok0 and stars_hidden and (c.D.get("proj", []) as Array).size() == 12
	# заложить трибуны: золото сразу, клетки под трибунами заняты, мастера у стройки, леса и вывеска
	G.realms[0].gold = maxf(gold0, 1000.0)
	var g1: float = G.realms[0].gold
	var free0: bool = not c.solid_at("yard", 55, 14) and not c.solid_at("yard", 66, 15)
	var st := start("stands")
	c._tick(0.02)
	var cr := _crew()
	var g2: float = G.realms[0].gold
	var sol1: bool = c.solid_at("yard", 55, 14) and c.solid_at("yard", 66, 15)
	var nsite := sites.filter(func(p): return (p[0] as Sprite2D).visible).size()
	var lot := _vis("cur:stands")
	var dr0 := drawn
	print("selftest: стол зодчего — заложены трибуны ", st, " (казна ", g1, " → ", g2, "), клетки свободны ", free0, " → заняты ", sol1, ", мастеров ", cr.size(),
		" (", ", ".join(cr.map(func(n): return String(n.name) + " — " + String(n.sub))), "), лесов ", nsite, ", по условию «cur:stands» ", lot, ", перерисовано ", dr0)
	res = res and st and g2 == g1 - 220.0 and free0 and sol1 and cr.size() == 2 and nsite == 1 and lot >= 2 and dr0 >= 1
	# леса по ходу работ: в начале — низко, к середине — выше (в верхней части картинки больше точек)
	var sp: Array = sites.filter(func(p): return (p[0] as Sprite2D).visible)
	var ok2 := false
	if not sp.is_empty():
		var e: Dictionary = sp[0][1]
		var base := _img(String(e.site.png))
		var lo := site_img(base, String(e.site.en), 0.0)
		var mid := site_img(base, String(e.site.en), 0.5)
		var hi := site_img(base, String(e.site.en), 0.99)
		var hh := base.get_height() / 2
		ok2 = lo.get_size() == base.get_size() and _opaque(lo, hh) < _opaque(mid, hh) and _opaque(mid, hh) <= _opaque(hi, hh)
		print("selftest: стол зодчего — леса ", base.get_size(), ": точек в верхней половине ", _opaque(lo, hh), " → ", _opaque(mid, hh), " → ", _opaque(hi, hh), " (готовое ", _opaque(base, hh), ")")
	SimExt.projCur().prog = 0.5 * float(SimExt.projCur().need)
	c._tick(0.02)
	var ok3: bool = drawn == dr0 + 1
	res = res and ok2 and ok3
	# мастер: «Сейчас …», дать на пиво — работа быстрее, раз в день
	var ok4 := false
	if not cr.is_empty():
		var n: Dictionary = cr[0]
		c.talk_to(n)
		var ch0: Array = (c.hud.dlg.choices as Array) if c.hud.dlg != null else []
		var txt0 := " ".join(c.hud.dlg.pages[0]) if c.hud.dlg != null else ""
		var pr0: float = SimExt.projCur().prog
		var gb: float = G.realms[0].gold
		c.hud.choose(0)
		while c.hud.dlg != null:
			c.hud.close_dlg()
		c.talk_to(n)
		var ch1: Array = (c.hud.dlg.choices as Array) if c.hud.dlg != null else []
		while c.hud.dlg != null:
			c.hud.close_dlg()
		ok4 = ch0.size() == 2 and txt0.contains("Сейчас ставят ярусы скамей") and SimExt.projCur().prog == pr0 + 1.5 and G.realms[0].gold == gb - 10 and ch1.size() == 1 and P.get("beer") == G.day
		print("selftest: стол зодчего — мастер: «", txt0.substr(0, 60), "…», выборов ", ch0.size(), " → ", ch1.size(), ", пиво ", ok4)
	res = res and ok4
	# свернуть: в казну — половина неизрасходованного, клетки свободны, мастера ушли, лесов нет
	var cc: Dictionary = SimExt.projCur()
	var back := JS.rnd(220.0 * 0.5 * (1.0 - float(cc.prog) / float(cc.need)))
	var g3: float = G.realms[0].gold
	SimExt.projStop()
	c._tick(0.02)
	var ok5: bool = G.realms[0].gold == g3 + back and not c.solid_at("yard", 55, 14) and _crew().is_empty() and sites.filter(func(p): return (p[0] as Sprite2D).visible).is_empty() and _vis("cur:stands") == 0
	print("selftest: стол зодчего — свёрнуто ", ok5, " (вернулось ", back, ")")
	res = res and ok5
	# достроить розарий день за днём (projDaily): готово — кусты у фонтана, клетки под ними заняты, супруг(а) рад(а)
	var r0 := _vis("proj:roses")
	start("roses")
	var days := 0
	while SimExt.projCur("roses") != null and days < 40:
		SimExt.projDaily()
		days += 1
	c._tick(0.02)
	var ok6: bool = SimDyn.projDone("roses") and r0 == 0 and _vis("proj:roses") == 5 and c.solid_at("yard", 38, 8) and _crew().is_empty()
	print("selftest: стол зодчего — розарий за ", days, " дн. (скорость ×", JS.fixed(SimExt.projRate(), 2), "), кустов ", r0, " → ", _vis("proj:roses"), ", готово ", ok6)
	res = res and ok6
	# звездочётная готова: проход у трубы свободен (un), труба ночью — погода
	var un0: bool = c.solid_at("upper", 43, 4)
	P.done["observatory"] = {"day": G.day, "king": G.player.char}
	SimExt.proj_rev += 1
	c._tick(0.02)
	var un1: bool = c.solid_at("upper", 43, 4)
	c.go_loc("upper")
	var sa := _act("stars")
	c.king.x = float(sa.get("x", 0))
	c.king.y = float(sa.get("y", 0)) + 4.0
	var tg2: Dictionary = c.nearest_target()
	Game.set_hour(12.0)
	stars()
	var d0: String = " ".join(c.hud.dlg.pages[0]) if c.hud.dlg != null else ""
	while c.hud.dlg != null:
		c.hud.close_dlg()
	Game.set_hour(22.0)
	stars()
	var d1: String = " ".join(c.hud.dlg.pages[0]) if c.hud.dlg != null else ""
	while c.hud.dlg != null:
		c.hud.close_dlg()
	var ok7: bool = un0 and not un1 and tg2.has("a") and String(tg2.a.id) == "stars" and d0.begins_with("Днём в трубу") and d1.begins_with("Вы смотрите в медную трубу.")
	print("selftest: стол зодчего — звездочётная: проход ", un0, " → ", un1, ", труба рядом ", tg2.has("a"), ", днём «", d0.substr(0, 24), "…», ночью «", d1.substr(0, 40), "…»")
	res = res and ok7
	# как было
	P.cur = null
	P.done = done0
	G.realms[0].gold = gold0
	SimExt.proj_rev += 1
	c._tick(0.02)
	print("selftest: стол зодчего — ", "OK" if res else "FAIL")
	return res
