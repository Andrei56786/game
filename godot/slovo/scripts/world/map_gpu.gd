class_name MapGPU
extends Node
## Карта королевства на GPU — перенос render.js. Данные мира — в текстуры; искажение берегов (сетка wgx/wgy) и глубина воды
## считаются шейдерами один раз; обзорная карта (1 точка = 4×4 точки мира) рисуется сразу, куски 256×256 в полной детализации —
## по требованию (местность и пена — шейдер, реки и дороги — штампы, мосты, деревья и горы — спрайты) и хранятся в кэше на 56 кусков.
## Границы держав и заливка державами — при показе (шейдеры map_show_*), по кодам провинций, которые куски рисуют рядом с картинкой.
## Вид года (season2.js): обзор перекрашивается отдельным проходом (map_over_sea), куски — в своих шейдерах (местность, двойники
## спрайтов в атласе) и проходом по цвету готовой картинки (map_cpost: лёд рек, снег на берегах и дорогах).

const MW := WorldData.MW
const MH := WorldData.MH
const TS := WorldData.TS
const WPW := WorldData.WPW
const WPH := WorldData.WPH
const GW := (WPW >> 2) + 2
const GH := (WPH >> 2) + 2
const CH := 256          # кусок
const CHM := 24          # поле куска в HTML: предметы с соседних клеток, указатель линий
const VM := 16           # поле в окне куска (опоры деревьев у края)
const VPW := CH + 2 * VM # 288: окно куска — картинка сверху, коды провинций снизу (260×260 с полем 2)
const QS := 4
const QW := WPW / QS
const QH := WPH / QS
const NCX := (WPW + CH - 1) / CH
const NCY := (WPH + CH - 1) / CH
const KEEP := 56
const SH0 := 16           # строк таблицы отрезков куска на старте (по 64 отрезка)
const RWID := [0.0, 0.75, 1.15, 1.7]

var W: WorldData
var M: Dictionary
var ok := false
var stage := ""
var ms := {}
var T := {}
var warp := PackedByteArray()
var rivP: Array = []
var roadP: Array = []
var roadL := PackedInt32Array()
var idxR: Array = []
var idxD: Array = []
var atlas: ImageTexture
var A := {}              # "f:oak" / "q:mount" → [Rect2i…] в атласе карты
var over_vp: SubViewport
var qp_vp: SubViewport
var mini_vp: SubViewport
var mini_mat: ShaderMaterial
var chunks := {}         # номер куска → запись окна
var order: Array = []    # недавно виденные — в конце
var free_e: Array = []
var own := PackedInt32Array()
var own_img: Image
var col := {}
var sq: ArrayMesh         # квадрат [−1, 1]² — штампы и спрайты кусков (вершины считает шейдер)
var mms: Array = []       # общие MultiMesh по размерам: в custom — номер экземпляра
var ikey := PackedByteArray()   # ключи порядка предметов (map_ikey): по 5 int32 на клетку
var brk := {}             # кусок → мосты и броды окна (клетка; брод — −1 − клетка)
var atlas_pm: ImageTexture
var shaders := {}
var nbuilt := 0
var cms := 0.0
var prof := {}            # время частей сборки куска, мс (сумма)
var nspr := 0             # спрайтов в атласе (с сезонными двойниками)
var sea_k := Vector3i(-1, -1, -1)   # вид года карты (sv3: холод, середина, юг)
var sea_vp: SubViewport   # обзор с сезоном (из обзора без сезона)
var sea_mat: ShaderMaterial
var nsea := 0             # кусков перерисовано из-за смены вида года
var busy := false

static func u32c(v) -> Color:
	var n := int(v)
	return Color8(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255)


## Мир из выгрузки HTML (res://art/world.json + world.bin) и подготовка карты; можно не ждать — смотреть ok и stage.
func prepare(dir := "res://art") -> void:
	if busy or ok:
		return
	busy = true
	stage = "мир"
	await get_tree().process_frame
	await get_tree().process_frame
	var t0 := Time.get_ticks_msec()
	var w := WorldData.load_export(dir)
	if w == null:
		stage = "нет данных мира (res://art/world.json)"
		push_error("MAP: " + stage)
		return
	ms.load = Time.get_ticks_msec() - t0
	# королевство (как newGame3 в HTML): державы, люди, поселения, войска, рынки — по зерну игры, в том же мире
	if Sim.G.is_empty():
		stage = "королевство: люди, войска, рынки"
		await get_tree().process_frame
		await get_tree().process_frame
		t0 = Time.get_ticks_msec()
		Sim.start(w, Game.seed)
		ms.sim = Time.get_ticks_msec() - t0
	await build(w)
	print("MAP READY ", JSON.stringify(ms))

## Подготовка: текстуры → предрасчёт на GPU → линии рек и дорог → атлас → обзорная карта. Ждать: await build(w).
func build(w: WorldData) -> void:
	busy = true
	W = w
	M = w.meta if not w.meta.is_empty() else WorldData.load_meta()
	var t0 := Time.get_ticks_msec()
	stage = "текстуры"
	for k in ["map_warp", "map_wdep", "map_chunk", "map_prov", "map_lines", "map_roads", "map_items", "map_ikey", "map_over", "map_over_spr", "map_mini",
			"map_cpost", "map_over_sea"]:
		shaders[k] = load("res://shaders/%s.gdshader" % k)
	for k in M.cols:
		col[k] = u32c(M.cols[k])
	_textures()
	_meshes()
	ms.tex = Time.get_ticks_msec() - t0
	stage = "искажение берегов"
	var t1 := Time.get_ticks_msec()
	var vw := _vp(Vector2i(GW, GH))
	_rect(vw, Vector2(GW, GH), _mat("map_warp"))
	var vd := _vp(Vector2i(MW, MH))
	_rect(vd, Vector2(MW, MH), _mat("map_wdep"))
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	T.warp = vw.get_texture()
	T.wdep = vd.get_texture()
	var wi := vw.get_texture().get_image()
	if wi.get_format() != Image.FORMAT_RGBA8:
		wi.convert(Image.FORMAT_RGBA8)
	warp = wi.get_data()
	ms.gpu = Time.get_ticks_msec() - t1
	stage = "реки и дороги"
	await get_tree().process_frame
	t1 = Time.get_ticks_msec()
	_lines_prep()
	_bridges_prep()
	ms.lines = Time.get_ticks_msec() - t1
	stage = "обзорная карта"
	await get_tree().process_frame
	t1 = Time.get_ticks_msec()
	_atlas()
	var vk := _vp(Vector2i(MW * 5, MH))
	_rect(vk, Vector2(MW * 5, MH), _mat("map_ikey"))
	_overview()
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var ki := vk.get_texture().get_image()
	if ki.get_format() != Image.FORMAT_RGBA8:
		ki.convert(Image.FORMAT_RGBA8)
	ikey = ki.get_data()
	vk.queue_free()
	T.over0 = over_vp.get_texture()
	T.qp = qp_vp.get_texture()
	# вид года — отдельным проходом по готовому обзору (смена сезона перекрашивает только его)
	sea_vp = _vp(Vector2i(QW, QH))
	sea_mat = _mat("map_over_sea")
	sea_mat.set_shader_parameter("over0_tex", T.over0)
	sea_mat.set_shader_parameter("qp_tex", T.qp)
	if sea_k.x < 0:
		sea_k = sea_key(Game.day)
	sea_mat.set_shader_parameter("sv3", sea_k)
	_rect(sea_vp, Vector2(QW, QH), sea_mat)
	await RenderingServer.frame_post_draw
	T.over = sea_vp.get_texture()
	mini_vp = _vp(Vector2i(128, 80))
	mini_mat = _mat("map_mini")
	mini_mat.set_shader_parameter("over_tex", T.over)
	mini_mat.set_shader_parameter("qp_tex", T.qp)
	if T.has("exp"):
		mini_mat.set_shader_parameter("exp_tex", T.exp)
		mini_mat.set_shader_parameter("fog_on", true)
	_rect(mini_vp, Vector2(128, 80), mini_mat)
	await RenderingServer.frame_post_draw
	T.mini = mini_vp.get_texture()
	ms.over = Time.get_ticks_msec() - t1
	ms.all = Time.get_ticks_msec() - t0
	ok = true
	busy = false
	stage = ""


# ---------- данные-текстуры ----------
func _img_tex(w: int, h: int, f: Image.Format, b: PackedByteArray) -> ImageTexture:
	return ImageTexture.create_from_image(Image.create_from_data(w, h, false, f, b))

func _textures() -> void:
	T.ter = _img_tex(MW, MH, Image.FORMAT_R8, W.ter)
	T.rel = _img_tex(MW, MH, Image.FORMAT_RF, W.rel.to_byte_array())
	T.temp = _img_tex(MW, MH, Image.FORMAT_RF, W.temp.to_byte_array())
	T.prov = _img_tex(MW, MH, Image.FORMAT_RGBA8, W.prov.to_byte_array())
	T.road = _img_tex(MW, MH, Image.FORMAT_R8, W.road)
	# палитры: строки по 9 ступеней, порядок — как P_* в map_pal.gdshaderinc
	var pb := PackedByteArray()
	var tp: Dictionary = M.tpal
	for k in ["grassT", "grassW", "grassC", "steppe", "tundra", "forest", "dforest", "hills", "hillsW", "hillsC", "mount", "peak", "marsh", "beach", "deep", "shal", "lake"]:
		for row: Array in tp[k]:
			for c in row:
				pb.append_array(_u32b(c))
	for cp: Array in tp.crops:
		for row: Array in cp:
			for c in row:
				pb.append_array(_u32b(c))
	T.pal = _img_tex(9, pb.size() / 36, Image.FORMAT_RGBA8, pb)
	# шум mkNoise(mkRng(seed + 99)) — тот же, что у renderBase
	var nz := JSM.PNoise.new(JSM.Rng.new(W.seed + 99))
	var pp := PackedByteArray()
	for v in nz.p:
		pp.append(v)
	T.perm = _img_tex(512, 1, Image.FORMAT_R8, pp)
	var gg := PackedFloat32Array()
	for i in 256:
		gg.append(nz.gx[i])
		gg.append(nz.gy[i])
	T.grad = _img_tex(256, 1, Image.FORMAT_RGF, gg.to_byte_array())
	own.resize(W.provs.size())
	for p in W.provs.size():
		own[p] = W.owner[p] if W.owner[p] >= 0 else 5   # ничьи провинции — Вольные земли (newGame)
	own_img = Image.create(W.provs.size() + 3, 1, false, Image.FORMAT_RGBA8)
	_own_fill()
	T.own = ImageTexture.create_from_image(own_img)

func _u32b(v) -> PackedByteArray:
	var n := int(v)
	return PackedByteArray([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255])

func _own_fill() -> void:
	for p in own.size():
		var r := own[p]
		var c := Color.html(String(M.realms[r].col)) if r >= 0 and r < M.realms.size() else Color(0, 0, 0)
		c.a = float(r + 1) / 255.0
		own_img.set_pixel(p + 3, 0, c)

## держава провинции изменилась (завоевание) — границы и заливка перерисуются сами
func set_prov_owner(p: int, r: int) -> void:
	if own[p] == r:
		return
	own[p] = r
	_own_fill()
	(T.own as ImageTexture).update(own_img)
	if mini_vp:
		mini_vp.render_target_update_mode = SubViewport.UPDATE_ONCE

func _mat(sh: String) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shaders[sh]
	for k in ["ter", "rel", "temp", "prov", "pal", "perm", "grad", "wdep", "warp", "own", "road", "spr"]:
		if T.has(k):
			m.set_shader_parameter(k + "_tex", T[k])
	return m

func _vp(sz: Vector2i, once := true) -> SubViewport:
	var v := SubViewport.new()
	v.size = sz
	v.transparent_bg = true
	v.disable_3d = true
	v.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	v.render_target_update_mode = SubViewport.UPDATE_ONCE if once else SubViewport.UPDATE_DISABLED
	add_child(v)
	return v

func _rect(v: Node, sz: Vector2, m: Material, pos := Vector2.ZERO) -> ColorRect:
	var r := ColorRect.new()
	r.position = pos
	r.size = sz
	r.material = m
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(r)
	return r

func _meshes() -> void:
	var q := PackedVector2Array([Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)])
	sq = _mesh(q, q, PackedInt32Array([0, 1, 2, 0, 2, 3]))

## общий MultiMesh не меньше n экземпляров: преобразования единичные, custom = (номер & 1023, номер >> 10) — всё считает шейдер
func _mm(n: int) -> MultiMesh:
	for m: MultiMesh in mms:
		if m.instance_count >= n:
			return m
	var c := 1024
	while c < n:
		c *= 2
	var tq := Time.get_ticks_usec()
	var m := MultiMesh.new()
	m.transform_format = MultiMesh.TRANSFORM_2D
	m.use_custom_data = true
	m.mesh = sq
	m.instance_count = c
	var b := PackedFloat32Array()
	b.resize(c * 12)
	for j in c:
		var o := j * 12
		b[o] = 1.0
		b[o + 5] = 1.0
		b[o + 8] = j & 1023
		b[o + 9] = j >> 10
	m.buffer = b
	mms.append(m)
	_pf("mm", tq)
	mms.sort_custom(func(x: MultiMesh, y: MultiMesh) -> bool: return x.instance_count < y.instance_count)
	return m

func _mesh(v: PackedVector2Array, uv: PackedVector2Array, idx: PackedInt32Array) -> ArrayMesh:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	if not uv.is_empty():
		arr[Mesh.ARRAY_TEX_UV] = uv
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m


# ---------- точки мира ----------
func _warp_at(gx: int, gy: int) -> Vector2:
	var o := (gy * GW + gx) * 4
	return Vector2((warp[o] * 256 + warp[o + 1]) / 2048.0 - 16.0, (warp[o + 2] * 256 + warp[o + 3]) / 2048.0 - 16.0)

## середина клетки на картинке (MAPR.tileCenter): клетка сдвинута тем же искажением, что и берега
func tile_center(t: int) -> Vector2:
	var x := (t % MW) * TS + TS / 2
	var y := (t / MW) * TS + TS / 2
	var w := _warp_at(clampi(x >> 2, 0, GW - 2), clampi(y >> 2, 0, GH - 2))
	return Vector2(x - w.x * 0.85, y - w.y * 0.85)

func warp_pt(x: float, y: float) -> Vector2:
	var w := _warp_at(clampi(floori(x / 4.0), 0, GW - 2), clampi(floori(y / 4.0), 0, GH - 2))
	return Vector2(x - w.x * 0.85, y - w.y * 0.85)

## клетка под точкой мира (MAPR.pxTile) — щелчок попадает в то, что нарисовано
func px_tile(px: int, py: int) -> int:
	var gx := px / 4.0
	var gy := py / 4.0
	var gx0 := clampi(floori(gx), 0, GW - 2)
	var gy0 := clampi(floori(gy), 0, GH - 2)
	var gu := gx - gx0
	var gv := gy - gy0
	var a := _warp_at(gx0, gy0)
	var b := _warp_at(gx0 + 1, gy0)
	var c := _warp_at(gx0, gy0 + 1)
	var d := _warp_at(gx0 + 1, gy0 + 1)
	var w := a + (b - a) * gu + (c - a) * gv + (a - b - c + d) * gu * gv
	var jx := (JSM.hash2(px >> 1, py >> 1, 5) - 0.5) * 5.0
	var jy := (JSM.hash2(py >> 1, px >> 1, 6) - 0.5) * 5.0
	var fx := (px + w.x + jx) / TS
	var fy := (py + w.y + jy) / TS
	var tx := 0 if fx < 0 else (MW - 1 if fx >= MW else int(fx))
	var ty := 0 if fy < 0 else (MH - 1 if fy >= MH else int(fy))
	return ty * MW + tx


# ---------- реки и дороги: сглаженные ломаные, указатель по кускам ----------
static func chaikin(p: PackedFloat64Array, it: int) -> PackedFloat64Array:
	for _k in it:
		var n := p.size() / 3
		var o := PackedFloat64Array()
		o.resize((n - 1) * 6 + 6)
		o[0] = p[0]
		o[1] = p[1]
		o[2] = p[2]
		var j := 3
		for i in n - 1:
			var ax := p[i * 3]
			var ay := p[i * 3 + 1]
			var bx := p[i * 3 + 3]
			var by := p[i * 3 + 4]
			o[j] = ax * 0.75 + bx * 0.25
			o[j + 1] = ay * 0.75 + by * 0.25
			o[j + 2] = p[i * 3 + 2]
			o[j + 3] = ax * 0.25 + bx * 0.75
			o[j + 4] = ay * 0.25 + by * 0.75
			o[j + 5] = p[i * 3 + 5]
			j += 6
		o[j] = p[(n - 1) * 3]
		o[j + 1] = p[(n - 1) * 3 + 1]
		o[j + 2] = p[(n - 1) * 3 + 2]
		p = o
	return p

func _lines_prep() -> void:
	var NCH := NCX * NCY
	var ir: Array = []
	var id_: Array = []
	for i in NCH:
		ir.append([])
		id_.append([])
	for k in W.rivers.size():
		var r: PackedInt32Array = W.rivers[k]
		var p := PackedFloat64Array()
		for t in r:
			var c := tile_center(t)
			p.append_array([c.x, c.y, maxf(1.0, W.river[t])])
		var P := PackedFloat32Array(Array(chaikin(p, 3)))
		_index(ir, P, k, CHM + 4)
		rivP.append(P)
	for lvl in [1, 2]:
		for R0: Array in W.roads:
			if R0[0] != lvl:
				continue
			var p := PackedFloat64Array()
			for t in R0[1]:
				var c := tile_center(t)
				p.append_array([c.x, c.y, 0.0])
			var P := PackedFloat32Array(Array(chaikin(p, 2)))
			_index(id_, P, roadP.size(), CHM + 3)
			roadP.append(P)
			roadL.append(lvl)
	for i in NCH:
		idxR.append(PackedInt32Array(ir[i]))
		idxD.append(PackedInt32Array(id_[i]))

func _index(arr: Array, P: PackedFloat32Array, id: int, pad: float) -> void:
	for i in P.size() / 3 - 1:
		var ax := P[i * 3]
		var ay := P[i * 3 + 1]
		var bx := P[i * 3 + 3]
		var by := P[i * 3 + 4]
		var c0 := clampi(floori((minf(ax, bx) - pad) / CH), 0, NCX - 1)
		var c1 := clampi(floori((maxf(ax, bx) + pad) / CH), 0, NCX - 1)
		var r0 := clampi(floori((minf(ay, by) - pad) / CH), 0, NCY - 1)
		var r1 := clampi(floori((maxf(ay, by) + pad) / CH), 0, NCY - 1)
		for r in range(r0, r1 + 1):
			for c in range(c0, c1 + 1):
				var a: Array = arr[r * NCX + c]
				a.append(id)
				a.append(i)


# ---------- атлас спрайтов карты (с полем в точку — для сглаженной обзорной карты) ----------
func _atlas() -> void:
	var list: Array = []
	for k in M.mspr:
		for j in M.mspr[k].size():
			list.append(["f:" + k, int(M.mspr[k][j])])
	for k in M.msprq:
		for j in M.msprq[k].size():
			list.append(["q:" + k, int(M.msprq[k][j])])
	var pages := {}
	var imgs: Array[Image] = []
	var gidx := {}
	for n in list.size():
		var e: Array = list[n]
		var pg := int(Art.D.spr[e[1]][0])
		if not pages.has(pg):
			var pi: Image = Art.pages[pg].get_image()
			if pi.get_format() != Image.FORMAT_RGBA8:
				pi.convert(Image.FORMAT_RGBA8)
			pages[pg] = pi
		imgs.append((pages[pg] as Image).get_region(Rect2i(Art.rect(e[1]))))
		if not gidx.has(e[0]):
			gidx[e[0]] = []
		gidx[e[0]].append(n)
	# сезонные двойники: перекраска (msRecol) — новые спрайты в конце; ель и гора зимой — готовые spine и mountS
	var kinds := PackedInt32Array()
	kinds.resize(list.size())
	var vars := {}
	for n in list.size():
		var kd: int = SEA_KIND.get(list[n][0], 0)
		kinds[n] = kd
		if KIND_MODES.has(kd):
			for m: int in KIND_MODES[kd]:
				vars[n * 16 + m] = imgs.size()
				imgs.append(ms_recol(imgs[n], SEA_MODES[m]))
		elif kd == 3 or kd == 4:
			var i: int = gidx[list[n][0]].find(n)
			vars[n * 16 + 14] = gidx["f:spine" if kd == 3 else "f:mountS"][i]
	var AW := 512
	var x := 1
	var y := 1
	var rh := 0
	var place: Array[Vector2i] = []
	for im in imgs:
		var w := im.get_width()
		var h := im.get_height()
		if x + w + 1 > AW:
			x = 1
			y += rh + 1
			rh = 0
		place.append(Vector2i(x, y))
		x += w + 1
		rh = maxi(rh, h)
	var AH := 1
	while AH < y + rh + 1:
		AH *= 2
	var img := Image.create(AW, AH, false, Image.FORMAT_RGBA8)
	for n in imgs.size():
		img.blit_rect(imgs[n], Rect2i(Vector2i.ZERO, imgs[n].get_size()), place[n])
		if n < list.size():
			if not A.has(list[n][0]):
				A[list[n][0]] = []
			A[list[n][0]].append(Rect2i(place[n], imgs[n].get_size()))
	atlas = ImageTexture.create_from_image(img)
	# таблица для шейдеров: строка 0 — прямоугольники спрайтов по номеру, строка 1 — начало группы (порядок G_* в map_item),
	# строка 2 — вид спрайта для сезона, строки 2 + режим — номер двойника (map_items: ms_spr)
	var groups := ["f:oak", "f:pine", "f:spine", "f:birch", "f:mount", "f:mountS", "f:peak", "f:hill", "f:hillW", "f:hillC", "f:reed", "f:pud",
		"f:tuft", "f:rock", "f:bush", "q:mount", "q:mountS", "q:peak", "q:hill", "q:hillW", "q:hillC"]
	var SW := 512
	var SR := 3 + 14
	assert(imgs.size() <= SW)
	var tb := PackedFloat32Array()
	tb.resize(SW * SR * 4)
	for n in imgs.size():
		tb[n * 4] = place[n].x
		tb[n * 4 + 1] = place[n].y
		tb[n * 4 + 2] = imgs[n].get_width()
		tb[n * 4 + 3] = imgs[n].get_height()
	for n in list.size():
		tb[(SW * 2 + n) * 4] = kinds[n]
	for k: int in vars:
		tb[(SW * (2 + (k & 15)) + (k >> 4)) * 4] = vars[k]
	var qm := Vector2i.ZERO
	for g in groups.size():
		tb[(SW + g) * 4] = gidx[groups[g]][0] if gidx.has(groups[g]) else -1
		if String(groups[g]).begins_with("q:"):
			for r: Rect2i in A[groups[g]]:
				qm = qm.max(r.size)
	T.spr = _img_tex(SW, SR, Image.FORMAT_RGBAF, tb.to_byte_array())
	T.qmax = qm
	nspr = imgs.size()
	var pm := img.duplicate()
	pm.premultiply_alpha()
	atlas_pm = ImageTexture.create_from_image(pm)


# ---------- сезоны (season2.js): карта через год ----------
## вид спрайта для сезона: 1 лиственное (дуб, куст), 2 берёза, 3 ель (зимой — заснеженная), 4 гора (зимой — в снегу), 5 холм,
## 6 камыш и трава, 7 лужа (msKinds)
const SEA_KIND := {"f:oak": 1, "f:bush": 1, "f:birch": 2, "f:pine": 3, "f:mount": 4, "f:hill": 5, "f:hillW": 5, "f:hillC": 5, "f:reed": 6, "f:tuft": 6, "f:pud": 7}
## режимы перекраски по номеру (M_* в map_items.gdshader); 14 — другой готовый спрайт
const SEA_MODES := ["", "sp", "spb", "gold", "orng", "red", "au3", "bare", "bareS", "dull", "snow", "dry", "snowg", "ice", "alt"]
const KIND_MODES := {1: [1, 2, 3, 4, 5, 6, 7, 8, 9], 2: [1, 3, 4, 5, 6, 7, 8], 5: [10, 11], 6: [12], 7: [13]}
const SEA_PAL := {
	"snow": ["#6a7a96", "#8898b2", "#a6b6ca", "#c2cede", "#d8e2ec", "#eaf0f6", "#f8fbff"],
	"young": ["#12301a", "#1e4a22", "#2e6a2a", "#4a9032", "#70b23e", "#98cc52", "#c0e478"],
	"gold": ["#2c1e08", "#54380e", "#7e5a14", "#a8801e", "#cc9e2c", "#e6bc44", "#f6d870"],
	"orng": ["#2c1208", "#56240c", "#843c12", "#b0581a", "#d07a28", "#e89c3e", "#f6be62"],
	"red": ["#260a0c", "#4a1414", "#741e1a", "#9e2e22", "#c2462c", "#da6a3c", "#ec9058"],
	"au3": ["#28221a", "#403422", "#5a4a2c", "#746036", "#8c7642", "#a48c54", "#bca468"]}
const SV := {"": 0, "th": 1, "sp": 2, "au1": 3, "au2": 4, "au3": 5, "w": 6, "wm": 7}
static var _sp := {}

## цвет '#rrggbb' → число, как hx() в pix.js (байты RGBA по возрастанию)
static func hx(h: String) -> int:
	var n := h.substr(1, 6).hex_to_int()
	return (255 << 24) | ((n & 255) << 16) | (n & 0xFF00) | ((n >> 16) & 255)

static func _pal(k: String) -> PackedInt32Array:
	if not _sp.has(k):
		var a := PackedInt32Array()
		for c: String in SEA_PAL[k]:
			a.append(hx(c))
		_sp[k] = a
	return _sp[k]

static func lum_p(c: int) -> float:
	return ((c & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + ((c >> 16) & 255) * 0.114) / 255.0

static func is_green(c: int) -> bool:
	var r := c & 255
	var g := (c >> 8) & 255
	return g > r + 4 and g >= ((c >> 16) & 255)

static func ramp_at(R: PackedInt32Array, l: float, lo: float, hi: float) -> int:
	return R[clampi(int(JSM.jround((l - lo) / (hi - lo) * (R.size() - 1))), 0, R.size() - 1)]

## cmix из pix.js: каналы отбрасывают дробь
static func cmix(a: int, b: int, t: float) -> int:
	var o := 0
	for sh: int in [0, 8, 16, 24]:
		var x := (a >> sh) & 255
		var y := (b >> sh) & 255
		o |= (int(x + (y - x) * t) & 255) << sh
	return o

## перекраска точки спрайта (msPix): x, y — в спрайте, o — исходные точки (RGBA8), i — смещение точки
static func ms_pix(p: int, mode: String, x: int, y: int, w: int, o: PackedByteArray, i: int) -> int:
	var l := lum_p(p)
	var gr := is_green(p)
	match mode:
		"sp":
			return ramp_at(_pal("young"), l, 0.08, 0.62) if gr else p
		"spb":
			if not gr:
				return p
			if JSM.hash2(x, y, 96) < 0.2:
				return hx("#f8f0f4") if JSM.hash2(y, x, 97) < 0.5 else hx("#f0c0d4")
			return ramp_at(_pal("young"), l, 0.08, 0.62)
		"gold", "orng", "red", "au3":
			return ramp_at(_pal(mode), l, 0.08, 0.6) if gr else p
		"dull":
			return cmix(p, hx("#6a7a5a"), 0.35) if gr else p
		"bare", "bareS":
			if not gr:
				return p
			if JSM.hash2(x, y, 98) > 0.55:
				return 0
			var up := y == 0
			if not up:
				var q := o.decode_u32(i - w * 4)
				up = (q >> 24) < 40 or (is_green(q) and JSM.hash2(x, y - 1, 98) > 0.55)
			if mode == "bareS" and up:
				return hx("#eef3f8")
			return hx("#7a6656") if l > 0.3 else hx("#5a4838")
		"snow":
			return ramp_at(_pal("snow"), l, 0.2, 0.7)
		"dry":
			return cmix(p, hx("#a89a50"), 0.3)
		"snowg":
			return cmix(p, hx("#c8d0d8"), 0.6)
		"ice":
			return hx("#a6c4da")
	return p

## сезонный двойник спрайта (msRecol): точки с альфой меньше 40 не трогаются
static func ms_recol(src: Image, mode: String) -> Image:
	var w := src.get_width()
	var h := src.get_height()
	var o := src.get_data()
	var d := o.duplicate()
	for y in h:
		for x in w:
			var i := (y * w + x) * 4
			if o[i + 3] < 40:
				continue
			d.encode_u32(i, ms_pix(o.decode_u32(i), mode, x, y, w, o, i))
	return Image.create_from_data(w, h, false, Image.FORMAT_RGBA8, d)

## вид места по дню года и теплу (seaVar): '' лето · th оттепель · sp цветение · au1–au3 осень · w снег · wm мягкая зима
static func sea_var(day: int, tmp: float) -> String:
	var d := posmod(day, 84)
	var cold := tmp < 0.34
	var warm := tmp > 0.7
	if d < 21:
		if not warm and d < (8 if cold else 4):
			return "th"
		return "sp" if d < (11 if warm else (16 if cold else 14)) else ""
	if d < 42:
		return ""
	if d < 63:
		if cold:
			return "au1" if d < 47 else ("au2" if d < 53 else ("au3" if d < 58 else "w"))
		if warm:
			return "au1" if d < 53 else "au2"
		return "au1" if d < 49 else ("au2" if d < 57 else "au3")
	return "wm" if warm else "w"

## виды дня для холода, середины и юга (MSEA.V: тепло 0.2, 0.5, 0.85)
static func sea_key(day: int) -> Vector3i:
	return Vector3i(SV[sea_var(day, 0.2)], SV[sea_var(day, 0.5)], SV[sea_var(day, 0.85)])

## новый день: если вид карты сменился — перекрасить обзор и мини-карту, куски перерисует MapView (stale), по одному-два за кадр
func set_day(day: int) -> bool:
	var k := sea_key(day)
	if k == sea_k:
		return false
	sea_k = k
	if sea_mat:
		sea_mat.set_shader_parameter("sv3", k)
		sea_vp.render_target_update_mode = SubViewport.UPDATE_ONCE
		_mini_later()
	return true

## туман войны на мини-карте: маска разведанного (R8, 1 точка на клетку); после смены маски — перерисовать
func set_fog(tex: Texture2D) -> void:
	T.exp = tex
	if mini_mat:
		mini_mat.set_shader_parameter("exp_tex", tex)
		mini_mat.set_shader_parameter("fog_on", tex != null)
		mini_vp.render_target_update_mode = SubViewport.UPDATE_ONCE

func fog_changed() -> void:
	if mini_vp:
		mini_vp.render_target_update_mode = SubViewport.UPDATE_ONCE

func _mini_later() -> void:
	await RenderingServer.frame_post_draw
	if mini_vp:
		mini_vp.render_target_update_mode = SubViewport.UPDATE_ONCE

## кусок нарисован в другом виде года
func stale(ci: int) -> bool:
	var e: Variant = chunks.get(ci)
	return e != null and e.sk != sea_k

## перерисовать кусок в нынешнем виде года (старая картинка видна, пока не готова новая)
func reseason(ci: int) -> void:
	var e: Dictionary = chunks[ci]
	_sea_set(e)
	e.vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	nsea += 1

func _sea_set(e: Dictionary) -> void:
	for k in ["terr", "items", "cpost"]:
		(e[k].material as ShaderMaterial).set_shader_parameter("sv3", sea_k)
	# снег и лёд на реках и дорогах — только при снеге или оттепели
	var post := false
	for i in 3:
		post = post or sea_k[i] == 1 or sea_k[i] == 6
	e.cpost.visible = post
	e.cbb.visible = post
	e.sk = sea_k


# ---------- обзорная карта ----------
func _overview() -> void:
	over_vp = _vp(Vector2i(QW, QH))
	_rect(over_vp, Vector2(QW, QH), _mat("map_over"))
	var ln := Node2D.new()
	over_vp.add_child(ln)
	ln.draw.connect(_over_lines.bind(ln))
	# горы и холмы маленькими спрайтами — поверх линий, в порядке клеток (сбор по точкам в шейдере)
	var sm := _mat("map_over_spr")
	sm.set_shader_parameter("atlas_tex", atlas_pm)
	sm.set_shader_parameter("atlas_size", Vector2(atlas.get_width(), atlas.get_height()))
	sm.set_shader_parameter("qmax", T.qmax)
	_rect(over_vp, Vector2(QW, QH), sm)
	qp_vp = _vp(Vector2i(QW, QH))
	var m := _mat("map_prov")
	m.set_shader_parameter("q", 4)
	_rect(qp_vp, Vector2(QW, QH), m)

func _pts(P: PackedFloat32Array, a: int, b: int) -> PackedVector2Array:
	var o := PackedVector2Array()
	for i in range(a, b + 1):
		o.append(Vector2(P[i * 3], P[i * 3 + 1]) / QS)
	return o

## линия как у холста Chrome (Skia): там тоньше точки — «волосок» с прозрачностью по толщине; сглаженная линия Godot
## «жирнее» (край), поэтому она прозрачнее — коэффициент подобран по снимку обзора HTML (ошибка у линий 14,8 → 10,8)
const LINE_K := 0.6
func _skia_line(n: Node2D, pts: PackedVector2Array, c: Color, lw: float) -> void:
	c.a *= LINE_K
	n.draw_polyline(pts, c, lw, true)

func _over_lines(n: Node2D) -> void:
	for k in roadP.size():
		if roadL[k] == 1:
			_skia_line(n, _pts(roadP[k], 0, roadP[k].size() / 3 - 1), Color8(170, 146, 102, 115), 0.45)
	for k in roadP.size():
		if roadL[k] == 2:
			_skia_line(n, _pts(roadP[k], 0, roadP[k].size() / 3 - 1), Color8(150, 118, 76, 217), 0.7)
	for w in [1, 2, 3]:
		var c := Color8(58, 116, 172) if w == 3 else Color8(52, 110, 168)
		var lw: float = [0.0, 0.55, 0.75, 1.05][w]
		for P: PackedFloat32Array in rivP:
			var on := -1
			var n3 := P.size() / 3
			for i in n3:
				var okw: bool = int(floorf(P[i * 3 + 2] + 0.5)) == w
				if okw and on < 0:
					on = i
				elif not okw and on >= 0:
					_skia_line(n, _pts(P, on, i), c, lw)
					on = -1
			if on >= 0 and on < n3 - 1:
				_skia_line(n, _pts(P, on, n3 - 1), c, lw)

# ---------- куски полной детализации ----------
## картинка куска, если готова; иначе null (MapView покажет обзорную карту и попросит нарисовать)
func chunk_tex(ci: int) -> Texture2D:
	var e: Variant = chunks.get(ci)
	if e == null or Engine.get_frames_drawn() <= int(e.at):
		return null
	return e.vp.get_texture()

func has_chunk(ci: int) -> bool:
	return chunks.has(ci)

## отметить кусок как недавно виденный (не выбрасывать из кэша)
func touch(ci: int) -> void:
	var k := order.find(ci)
	if k >= 0:
		order.remove_at(k)
		order.append(ci)

## нарисовать кусок (если кэш полон — выбросить давно не виденный, кроме seen). Процессор только собирает отрезки рек и дорог
## и порядок предметов (сортировка готовых ключей), остальное — шейдеры окна куска.
func render_chunk(cx: int, cy: int, seen: Dictionary) -> void:
	var ci := cy * NCX + cx
	if chunks.has(ci):
		return
	var t0 := Time.get_ticks_usec()
	var e: Dictionary
	if chunks.size() >= KEEP:
		for k in order:
			if not seen.has(k):
				e = chunks[k]
				chunks.erase(k)
				order.erase(k)
				break
	var tq := Time.get_ticks_usec()
	if e.is_empty():
		e = free_e.pop_back() if not free_e.is_empty() else _entry()
	_pf("entry", tq)
	var o := Vector2i(cx * CH - VM, cy * CH - VM)
	for k in ["terr", "lines", "roads", "items", "cpost"]:
		(e[k].material as ShaderMaterial).set_shader_parameter("origin", o)
	_sea_set(e)
	(e.pr.material as ShaderMaterial).set_shader_parameter("origin", Vector2i(cx * CH - 2, cy * CH - 2))
	tq = Time.get_ticks_usec()
	_segs(e, ci)
	_pf("segs", tq)
	tq = Time.get_ticks_usec()
	_order(e, cx, cy)
	_pf("order", tq)
	e.brl = brk.get(ci, PackedInt32Array())
	e.br.position = Vector2(-o)
	e.br.queue_redraw()
	e.ci = ci
	e.vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	e.at = Engine.get_frames_drawn()
	chunks[ci] = e
	order.append(ci)
	nbuilt += 1
	var dt := (Time.get_ticks_usec() - t0) / 1000.0
	cms = dt if nbuilt == 1 else cms * 0.9 + dt * 0.1

func _pf(k: String, t: int) -> void:
	prof[k] = snappedf(float(prof.get(k, 0.0)) + (Time.get_ticks_usec() - t) / 1000.0, 0.01)

func _mmi(vp: SubViewport, sh: String) -> MultiMeshInstance2D:
	var n := MultiMeshInstance2D.new()
	n.material = _mat(sh)
	n.multimesh = _mm(1024)
	vp.add_child(n)
	return n

func _entry() -> Dictionary:
	var vp := _vp(Vector2i(VPW, VPW + CH + 4), false)
	var e := {"vp": vp, "ci": -1, "at": 0, "brl": PackedInt32Array()}
	e.terr = _rect(vp, Vector2(VPW, VPW), _mat("map_chunk"))
	e.sh = SH0
	e.sf = PackedFloat32Array()
	e.sf.resize(SH0 * 512)
	e.simg = Image.create(128, SH0, false, Image.FORMAT_RGBAF)
	e.stex = ImageTexture.create_from_image(e.simg)
	e.lines = _mmi(vp, "map_lines")
	var bb := BackBufferCopy.new()
	bb.copy_mode = BackBufferCopy.COPY_MODE_VIEWPORT
	vp.add_child(bb)
	e.roads = _mmi(vp, "map_roads")
	for k in ["lines", "roads"]:
		(e[k].material as ShaderMaterial).set_shader_parameter("seg_tex", e.stex)
	var br := Node2D.new()
	vp.add_child(br)
	br.draw.connect(_draw_br.bind(e))
	e.br = br
	e.oimg = Image.create(128, 64, false, Image.FORMAT_RGBA8)
	e.otex = ImageTexture.create_from_image(e.oimg)
	e.items = _mmi(vp, "map_items")
	e.items.texture = atlas
	var im: ShaderMaterial = e.items.material
	im.set_shader_parameter("atlas_size", Vector2(atlas.get_width(), atlas.get_height()))
	im.set_shader_parameter("ord_tex", e.otex)
	# сезон по цвету готовой картинки: реки подо льдом, берега и дороги под снегом (msChunkPost)
	var bb2 := BackBufferCopy.new()
	bb2.copy_mode = BackBufferCopy.COPY_MODE_RECT
	bb2.rect = Rect2(0, 0, VPW, VPW)
	vp.add_child(bb2)
	e.cbb = bb2
	e.cpost = _rect(vp, Vector2(VPW, VPW), _mat("map_cpost"))
	e.sk = Vector3i(-1, -1, -1)
	e.pr = _rect(vp, Vector2(CH + 4, CH + 4), _mat("map_prov"), Vector2(0, VPW))
	return e

## отрезки куска в таблицу seg_tex: реки — сначала все берега, потом вся вода; дороги — по дорогам: обочины, потом середина
func _segs(e: Dictionary, ci: int) -> void:
	var f: PackedFloat32Array = e.sf
	var j := 0
	var idx: PackedInt32Array = idxR[ci]
	for pass_ in 2:
		for k in range(0, idx.size(), 2):
			var P: PackedFloat32Array = rivP[idx[k]]
			var i := idx[k + 1] * 3
			var ax := P[i]
			var ay := P[i + 1]
			var bx := P[i + 3]
			var by := P[i + 4]
			var n := maxi(1, ceili(sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) * 2.0))
			var ks := 0
			while ks <= n:
				if j + 8 > f.size():
					f = _seg_grow(e)
				f[j] = ax
				f[j + 1] = ay
				f[j + 2] = bx
				f[j + 3] = by
				f[j + 4] = P[i + 2]
				f[j + 5] = P[i + 5]
				f[j + 6] = n
				f[j + 7] = pass_ + 8 * ks
				j += 8
				ks += 16
	var nr := j / 8
	idx = idxD[ci]
	var k0 := 0
	while k0 < idx.size():
		var id := idx[k0]
		var k1 := k0
		while k1 < idx.size() and idx[k1] == id:
			k1 += 2
		var P: PackedFloat32Array = roadP[id]
		var lvl := roadL[id]
		for pass_ in (2 if lvl == 2 else 1):
			var kind := (2 + pass_) if lvl == 2 else 4
			for k in range(k0, k1, 2):
				var i := idx[k + 1] * 3
				var ax := P[i]
				var ay := P[i + 1]
				var bx := P[i + 3]
				var by := P[i + 4]
				var n := maxi(1, ceili(sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) * 1.5))
				var ks := 0
				while ks <= n:
					if j + 8 > f.size():
						f = _seg_grow(e)
					f[j] = ax
					f[j + 1] = ay
					f[j + 2] = bx
					f[j + 3] = by
					f[j + 4] = 0.0
					f[j + 5] = 0.0
					f[j + 6] = n
					f[j + 7] = kind + 8 * ks
					j += 8
					ks += 16
		k0 = k1
	e.sf = f
	var ne := j / 8
	var sh: int = e.sh
	(e.simg as Image).set_data(128, sh, false, Image.FORMAT_RGBAF, f.to_byte_array())
	(e.stex as ImageTexture).update(e.simg)
	var ml: ShaderMaterial = e.lines.material
	ml.set_shader_parameter("cnt", nr)
	e.lines.multimesh = _mm(maxi(1, nr * 16))
	var md: ShaderMaterial = e.roads.material
	md.set_shader_parameter("e0", nr)
	md.set_shader_parameter("cnt", ne - nr)
	e.roads.multimesh = _mm(maxi(1, (ne - nr) * 16))

func _seg_grow(e: Dictionary) -> PackedFloat32Array:
	var f: PackedFloat32Array = e.sf
	e.sh = int(e.sh) * 2
	f.resize(int(e.sh) * 512)
	e.sf = f
	e.simg = Image.create(128, e.sh, false, Image.FORMAT_RGBAF)
	e.stex = ImageTexture.create_from_image(e.simg)
	for k in ["lines", "roads"]:
		(e[k].material as ShaderMaterial).set_shader_parameter("seg_tex", e.stex)
	return f

## порядок предметов окна: ключи строк клеток (готовы с подготовки) → сортировка → ord_tex
func _order(e: Dictionary, cx: int, cy: int) -> void:
	var X0 := cx * CH - CHM
	var Y0 := cy * CH - CHM
	var RW := CH + 2 * CHM
	var tx0 := maxi(0, floori(X0 / float(TS)))
	var tx1 := mini(MW - 1, floori((X0 + RW - 1) / float(TS)))
	var ty0 := maxi(0, floori(Y0 / float(TS)))
	var ty1 := mini(MH - 1, floori((Y0 + RW - 1) / float(TS)))
	var kb := PackedByteArray()
	var rb := (tx1 - tx0 + 1) * 20
	for ty in range(ty0, ty1 + 1):
		var o := (ty * MW + tx0) * 20
		kb.append_array(ikey.slice(o, o + rb))
	var ks := kb.to_int32_array()
	ks.sort()
	var n := ks.bsearch(0x7FFFFFFF)
	var lo := (ty0 * 8192) & 0x7FFFF
	if (ty0 * 8192) >> 19 != (ty1 * 8192 + 8703) >> 19:
		var sp := ks.bsearch(lo << 12)
		ks = ks.slice(sp, n) + ks.slice(0, sp)
	else:
		ks.resize(n)
	var bytes := ks.to_byte_array()
	bytes.resize(128 * 64 * 4)
	(e.oimg as Image).set_data(128, 64, false, Image.FORMAT_RGBA8, bytes)
	(e.otex as ImageTexture).update(e.oimg)
	var im: ShaderMaterial = e.items.material
	im.set_shader_parameter("t0", Vector2i(tx0, ty0))
	im.set_shader_parameter("lo", lo)
	im.set_shader_parameter("cnt", n)
	e.items.multimesh = _mm(maxi(1, n * 2))

## мосты и броды по кускам (окно куска с полем CHM), по порядку клеток, как в renderChunk
func _bridges_prep() -> void:
	var lists := {}
	for pass_ in 2:
		var arr: PackedByteArray = W.bridge if pass_ == 0 else W.ford
		var t := arr.find(1)
		while t >= 0:
			if pass_ == 0 or not W.bridge[t]:
				var tx := t % MW
				var ty := t / MW
				for cy in range(maxi(0, ceili((ty - 34) / 32.0)), mini(NCY - 1, floori((ty + 3) / 32.0)) + 1):
					for cx in range(maxi(0, ceili((tx - 34) / 32.0)), mini(NCX - 1, floori((tx + 3) / 32.0)) + 1):
						var ci := cy * NCX + cx
						if not lists.has(ci):
							lists[ci] = []
						lists[ci].append(t)
			t = arr.find(1, t + 1)
	for ci in lists:
		var a: Array = lists[ci]
		a.sort()
		var out := PackedInt32Array()
		for t: int in a:
			out.append(t if W.bridge[t] else -1 - t)
		brk[ci] = out

func _draw_br(e: Dictionary) -> void:
	var n: Node2D = e.br
	for v in e.brl:
		var t: int = v if v >= 0 else -1 - v
		var c := tile_center(t)
		var X := int(floorf(c.x + 0.5))
		var Y := int(floorf(c.y + 0.5))
		if v >= 0:
			n.draw_rect(Rect2(X - 3, Y - 2, 6, 4), Color8(0x3a, 0x2a, 0x1a))
			n.draw_rect(Rect2(X - 2, Y - 1, 4, 2), Color8(0xa0, 0x7a, 0x4a))
			n.draw_rect(Rect2(X - 2, Y - 1, 4, 1), Color8(0xc8, 0xa0, 0x70))
		else:
			for k in range(-1, 2):
				n.draw_rect(Rect2(X + k * 2 - 1, Y + k, 2, 1), Color8(0xc8, 0xd8, 0xd0))


# ---------- для проверок: картинки карты в PNG ----------
## "over" — обзорная карта, "qp" — коды провинций обзора, "mini" — мини-карта, "chunk:ci" — окно куска (картинка и коды)
func dump(what: String) -> PackedByteArray:
	var t: Texture2D = null
	if what.begins_with("chunk:"):
		var e: Variant = chunks.get(int(what.substr(6)))
		if e != null:
			t = e.vp.get_texture()
	else:
		t = T.get(what)
	if t == null:
		return PackedByteArray()
	var img := t.get_image()
	if img.get_format() != Image.FORMAT_RGBA8:
		img.convert(Image.FORMAT_RGBA8)
	return img.save_png_to_buffer()
