class_name WorldGen
extends RefCounted
## Генератор мира — построчный перенос genWorld из src/worldgen.js. То же зерно → тот же мир, что в HTML:
## Selftest сравнивает отпечатки всех частей с выгрузкой HTML (art/world.json). Порядок действий и вызовов
## генератора случайностей, округления и типы массивов (Float32, Uint8…) повторяют JS в точности.

const MW := WorldData.MW
const MH := WorldData.MH
const NT := WorldData.NT
const DX8: Array[int] = [1, -1, 0, 0, 1, 1, -1, -1]
const DY8: Array[int] = [0, 0, 1, -1, 1, -1, 1, -1]
const WATER: Array[int] = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const PASS: Array[int] = [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1] # TINFO[t].cost > 0
const DEEP := 0
const SHALLOW := 1
const LAKE := 2
const BEACH := 3
const GRASS := 4
const FARM := 5
const FOREST := 6
const DFOREST := 7
const HILLS := 8
const MOUNT := 9
const PEAK := 10
const MARSH := 11
const STEPPE := 12
const SNOW := 13

var CULT := {}
var LAKEN: Array = []
var MOUNTN: Array = []
var WSCALE := 3.375
var SEAT_K := 0.0
var ED := 0.0
## для экрана ожидания: этап и доля готовности
var stage := ""
var part := 0.0
var TT := {}
var _tl := 0

# массивы, которые меняются во вспомогательных функциях, живут в полях (локальная копия PackedArray при записи раздвоится)
var _blk := PackedByteArray()
var _road := PackedByteArray()
var _bridge := PackedByteArray()
var _river := PackedByteArray()
var _bc := PackedFloat64Array()
var _g := PackedFloat64Array()
var _from := PackedInt32Array()
var _st := PackedInt32Array()
var _cl := PackedInt32Array()
var _gen := 0
var _roadList: Array = []
# шум по полосам строк — в несколько потоков (каждая клетка считается отдельно, результат тот же)
const BAND := 16
var _NZ: JSM.PNoise
var _par := PackedFloat64Array()
var _in := {}
var _bands: Array = []
var _bands2: Array = []
var _bdone := 0
var _mx := Mutex.new()


## tables — раздел gen из art/world.json: имена (CULT, LAKEN, MOUNTN) и точные SEAT_K, ED.
func _init(tables: Dictionary) -> void:
	CULT = tables.CULT
	LAKEN = tables.LAKEN
	MOUNTN = tables.MOUNTN
	WSCALE = sqrt(float(NT) / 64000.0)
	SEAT_K = pow(WSCALE, 0.62)
	ED = 34.0 * pow(WSCALE, 0.8)
	if tables.has("SEAT_K"):
		SEAT_K = JSM.f64(tables.SEAT_K)
		ED = JSM.f64(tables.ED)


func _tick(n: String) -> void:
	var t := Time.get_ticks_msec()
	TT[n] = t - _tl
	_tl = t


## Двоичная куча как Heap в worldgen.js (порядок равных ключей тот же — от него зависят стоки и границы).
class Heap:
	var k := PackedFloat64Array()
	var v := PackedInt32Array()
	var size := 0

	func push(key: float, val: int) -> void:
		if size == k.size():
			var n := maxi(1024, size * 2)
			k.resize(n)
			v.resize(n)
		var i := size
		size += 1
		while i > 0:
			var p := (i - 1) >> 1
			if k[p] <= key:
				break
			k[i] = k[p]
			v[i] = v[p]
			i = p
		k[i] = key
		v[i] = val

	func pop() -> int:
		var top := v[0]
		size -= 1
		var n := size
		var lk := k[n]
		var lv := v[n]
		if n > 0:
			var i := 0
			while true:
				var c := 2 * i + 1
				if c >= n:
					break
				if c + 1 < n and k[c + 1] < k[c]:
					c += 1
				if k[c] >= lk:
					break
				k[i] = k[c]
				v[i] = v[c]
				i = c
			k[i] = lk
			v[i] = lv
		return top


func _mk_name(rng: JSM.Rng, cul: String, used: Dictionary) -> String:
	var C: Dictionary = CULT.get(cul, CULT.K)
	var A: Array = C.a
	var B: Array = C.b
	for k in 60:
		var n: String = rng.pick(A) + rng.pick(B)
		if cul == "T" and rng.chance(0.25):
			n = "Сан-" + n
		if n.length() > 11 and k < 40:
			continue
		if not used.has(n):
			used[n] = true
			return n
	var n2: String = rng.pick(A) + rng.pick(B) + "-" + str(rng.i(2, 9))
	used[n2] = true
	return n2


func _disc(x: int, y: int, r: float) -> void:
	var r2 := r * r
	var ri := int(ceilf(r))
	for dy in range(-ri, ri + 1):
		var yy := y + dy
		if yy < 0 or yy >= MH:
			continue
		var w := sqrt(maxf(0.0, r2 - dy * dy))
		var x0 := maxi(0, int(ceilf(x - w)))
		var x1 := mini(MW - 1, int(floorf(x + w)))
		var o := yy * MW
		for xx in range(x0, x1 + 1):
			_blk[o + xx] = 1


## astar из worldgen.js с ценой дороги roadCost (river — запрет срезать угол у реки). Пустой массив — пути нет.
func _astar_road(start: int, goal: int, hw: float, maxN: int) -> PackedInt32Array:
	if start == goal:
		return PackedInt32Array([start])
	_gen += 1
	var gen := _gen
	var gx := goal % MW
	var gy := goal / MW
	var hp := Heap.new()
	_g[start] = 0.0
	_st[start] = gen
	_from[start] = -1
	hp.push(0.0, start)
	var n := 0
	while hp.size > 0:
		var i := hp.pop()
		if _cl[i] == gen:
			continue
		_cl[i] = gen
		if i == goal:
			break
		n += 1
		if n > maxN:
			return PackedInt32Array()
		var x := i % MW
		var y := i / MW
		var gi := _g[i]
		for d in 8:
			var nx := x + DX8[d]
			var ny := y + DY8[d]
			if nx < 0 or ny < 0 or nx >= MW or ny >= MH:
				continue
			var j := ny * MW + nx
			if _cl[j] == gen:
				continue
			var c := _bc[j]
			if not (c < INF):
				continue
			if _road[j]:
				c = c * 0.22
			if d >= 4:
				var a := y * MW + nx
				var b := ny * MW + x
				if not (_bc[a] < INF) or not (_bc[b] < INF):
					continue
				if (_river[a] or _river[b]) and not _river[j]:
					continue
				c *= 1.4142
			var ng := gi + c
			if _st[j] != gen or ng < _g[j]:
				_g[j] = ng
				_st[j] = gen
				_from[j] = i
				var ddx := nx - gx
				var ddy := ny - gy
				hp.push(ng + sqrt(float(ddx * ddx + ddy * ddy)) * hw, j)
	if _cl[goal] != gen:
		return PackedInt32Array()
	var path := PackedInt32Array()
	var c2 := goal
	while c2 != -1:
		path.append(c2)
		c2 = _from[c2]
	path.reverse()
	return path


func _build(a: int, b: int, lvl: int) -> bool:
	var p := _astar_road(a, b, 0.9, 900000)
	if p.is_empty():
		return false
	for t in p:
		if _road[t] < lvl:
			_road[t] = lvl
		if _river[t]:
			_bridge[t] = 1
	_roadList.append([lvl, p])
	return true


## Полосы по BAND строк: в потоках WorkerThreadPool (в веб-сборке без потоков — по очереди). Возвращает склеенный массив.
func _bands_run(fn: Callable) -> PackedFloat32Array:
	var nb := (MH + BAND - 1) / BAND
	_bands = []
	_bands.resize(nb)
	_bands2 = []
	_bands2.resize(nb)
	_bdone = 0
	if OS.has_feature("web") or OS.get_processor_count() < 2:
		for b in nb:
			fn.call(b)
	else:
		var id := WorkerThreadPool.add_group_task(fn, nb, -1, true, "worldgen")
		while not WorkerThreadPool.is_group_task_completed(id):
			part = float(_bdone) / nb
			OS.delay_msec(5)
		WorkerThreadPool.wait_for_group_task_completion(id)
	return _join(_bands)


func _join(bands: Array) -> PackedFloat32Array:
	var o := PackedFloat32Array()
	for b: PackedFloat32Array in bands:
		o.append_array(b)
	return o


func _band_done(b: int, a: PackedFloat32Array, a2 := PackedFloat32Array()) -> void:
	_mx.lock()
	_bands[b] = a
	_bands2[b] = a2
	_bdone += 1
	_mx.unlock()


func _elev_band(b: int) -> void:
	var NZ := _NZ
	var P := _par
	var ox := P[0]
	var oy := P[1]
	var mx := P[2]
	var my := P[3]
	var qx := P[4]
	var qy := P[5]
	var k72 := P[6]
	var k30 := P[7]
	var k190 := P[8]
	var k95 := P[9]
	var k40 := P[10]
	var FK := P[11]
	var ED := P[12]
	var y0 := b * BAND
	var y1 := mini(MH, y0 + BAND)
	var elev := PackedFloat32Array()
	elev.resize((y1 - y0) * MW)
	for y in range(y0, y1):
		for x in MW:
			var sx := x / k72 + ox
			var sy := y / k72 + oy
			var wx := NZ.fbm(sx * 0.6 + 5.2, sy * 0.6 + 1.3, 3) * 1.1
			var wy := NZ.fbm(sx * 0.6 - 3.1, sy * 0.6 + 7.7, 3) * 1.1
			var e := 0.5 + NZ.fbm(sx + wx, sy + wy, 6) * 0.9
			var d := minf(minf(float(x), float(MW - 1 - x)), minf(y * 1.2, (MH - 1 - y) * 1.2)) + NZ.fbm(x / k30 + 9.1, y / k30 - 4.7, 3) * 20.0 * FK
			if d < ED:
				e -= pow(clampf((ED - d) / ED, 0.0, 1.4), 1.7) * 0.75
			e += NZ.fbm(x / k190 + ox * 0.7 + 3.3, y / k190 + oy * 0.7 - 8.1, 3) * 0.3
			var mt := clampf((NZ.fbm(x / k95 + mx, y / k95 + my, 3) + 0.02) * 3.0, 0.0, 1.0)
			var mask := mt * mt * (3.0 - 2.0 * mt)
			var rdg := NZ.ridge(x / k40 + mx * 2.0, y / k40 + my * 2.0, 4)
			e += mask * pow(rdg, 2.3) * 0.48 + NZ.fbm(x / 9.0 + qx, y / 9.0 + qy, 2) * 0.025
			elev[(y - y0) * MW + x] = e
	_band_done(b, elev)


func _moist_band(b: int) -> void:
	var NZ := _NZ
	var P := _par
	var m1 := P[0]
	var m2 := P[1]
	var k48 := P[2]
	var k60 := P[3]
	var sea := P[4]
	var dE := P[5]
	var elev: PackedFloat32Array = _in.elev
	var dOcean: PackedByteArray = _in.dOcean
	var y0 := b * BAND
	var y1 := mini(MH, y0 + BAND)
	var moist := PackedFloat32Array()
	moist.resize((y1 - y0) * MW)
	var temp := PackedFloat32Array()
	temp.resize((y1 - y0) * MW)
	for y in range(y0, y1):
		for x in MW:
			var i := y * MW + x
			var o := (y - y0) * MW + x
			var r := (elev[i] - sea) / dE
			var m := 0.5 + NZ.fbm(x / k48 + m1, y / k48 + m2, 4) * 0.62
			m += (1.0 - mini(dOcean[i], 24) / 24.0) * 0.12 + (0.5 - x / float(MW)) * 0.34 - maxf(0.0, r - 0.5) * 0.3
			moist[o] = m
			temp[o] = 0.08 + (y / float(MH)) * 0.95 + NZ.fbm(x / k60 + m2, y / k60 + m1, 3) * 0.14 - maxf(0.0, r) * 0.45
	_band_done(b, moist, temp)


func gen(seed: int) -> WorldData:
	var t0 := Time.get_ticks_msec()
	_tl = t0
	TT = {}
	var FK := SEAT_K
	var rng := JSM.Rng.new((seed * 7919 + 13) & 0xFFFFFFFF)
	var NZ := JSM.PNoise.new(rng)
	var elev := PackedFloat32Array()
	elev.resize(NT)
	var moist := PackedFloat32Array()
	moist.resize(NT)
	var temp := PackedFloat32Array()
	temp.resize(NT)
	var ter := PackedByteArray()
	ter.resize(NT)
	var ox := rng.range(0, 500)
	var oy := rng.range(0, 500)
	var mx := rng.range(0, 500)
	var my := rng.range(0, 500)
	var qx := rng.range(0, 500)
	var qy := rng.range(0, 500)
	# 1. высоты
	stage = "высоты"
	var k72 := 72.0 * FK
	var k30 := 30.0 * FK
	var k190 := 190.0 * FK
	var k95 := 95.0 * FK
	var k40 := 40.0 * FK
	_NZ = NZ
	_par = PackedFloat64Array([ox, oy, mx, my, qx, qy, k72, k30, k190, k95, k40, FK, ED])
	elev = _bands_run(_elev_band)
	var sorted := elev.duplicate()
	sorted.sort()
	var sea: float = sorted[int(floorf(NT * 0.37))]
	sorted = PackedFloat32Array()
	_tick("elev")
	# 2. море (связанное с краем)
	stage = "моря"
	var ocean := PackedByteArray()
	ocean.resize(NT)
	var q := PackedInt32Array()
	q.resize(NT)
	var qh := 0
	var qt := 0
	for x in MW:
		for i: int in [x, (MH - 1) * MW + x]:
			if not ocean[i] and elev[i] < sea:
				ocean[i] = 1
				q[qt] = i
				qt += 1
	for y in MH:
		for i: int in [y * MW, y * MW + MW - 1]:
			if not ocean[i] and elev[i] < sea:
				ocean[i] = 1
				q[qt] = i
				qt += 1
	while qh < qt:
		var i := q[qh]
		qh += 1
		var x := i % MW
		if x < MW - 1:
			var j := i + 1
			if not ocean[j] and elev[j] < sea:
				ocean[j] = 1
				q[qt] = j
				qt += 1
		if x > 0:
			var j := i - 1
			if not ocean[j] and elev[j] < sea:
				ocean[j] = 1
				q[qt] = j
				qt += 1
		if i < NT - MW:
			var j := i + MW
			if not ocean[j] and elev[j] < sea:
				ocean[j] = 1
				q[qt] = j
				qt += 1
		if i >= MW:
			var j := i - MW
			if not ocean[j] and elev[j] < sea:
				ocean[j] = 1
				q[qt] = j
				qt += 1
	var maxE := sea
	for i in NT:
		if not ocean[i] and elev[i] > maxE:
			maxE = elev[i]
	var dE := maxE - sea
	# 3. затопление впадин (D4) → дерево стока
	stage = "стоки"
	var filled := PackedFloat32Array()
	filled.resize(NT)
	var down := PackedInt32Array()
	down.resize(NT)
	down.fill(-1)
	var vis := PackedByteArray()
	vis.resize(NT)
	var order := PackedInt32Array()
	order.resize(NT)
	var on := 0
	var hp := Heap.new()
	for i in NT:
		if ocean[i]:
			vis[i] = 1
			filled[i] = sea
			var x := i % MW
			if (x < MW - 1 and not ocean[i + 1]) or (x > 0 and not ocean[i - 1]) or (i < NT - MW and not ocean[i + MW]) or (i >= MW and not ocean[i - MW]):
				hp.push(sea, i)
	while hp.size > 0:
		var i := hp.pop()
		var fi := filled[i]
		var x := i % MW
		for d in 4:
			var j := -1
			match d:
				0: j = i + 1 if x < MW - 1 else -1
				1: j = i - 1 if x > 0 else -1
				2: j = i + MW if i < NT - MW else -1
				3: j = i - MW if i >= MW else -1
			if j < 0 or vis[j]:
				continue
			vis[j] = 1
			filled[j] = maxf(elev[j], fi + 1e-6)
			down[j] = i
			order[on] = j
			on += 1
			hp.push(filled[j], j)
	vis = PackedByteArray()
	# 4. расстояние до моря
	var dOcean := PackedByteArray()
	dOcean.resize(NT)
	dOcean.fill(255)
	qh = 0
	qt = 0
	for i in NT:
		if ocean[i]:
			dOcean[i] = 0
			q[qt] = i
			qt += 1
	while qh < qt:
		var i := q[qh]
		qh += 1
		var x := i % MW
		var nv := mini(254, dOcean[i] + 1)
		if x < MW - 1 and dOcean[i + 1] == 255:
			dOcean[i + 1] = nv
			q[qt] = i + 1
			qt += 1
		if x > 0 and dOcean[i - 1] == 255:
			dOcean[i - 1] = nv
			q[qt] = i - 1
			qt += 1
		if i < NT - MW and dOcean[i + MW] == 255:
			dOcean[i + MW] = nv
			q[qt] = i + MW
			qt += 1
		if i >= MW and dOcean[i - MW] == 255:
			dOcean[i - MW] = nv
			q[qt] = i - MW
			qt += 1
	# 5. влага и тепло
	stage = "влага и тепло"
	var m1 := rng.range(0, 500)
	var m2 := rng.range(0, 500)
	var k48 := 48.0 * FK
	var k60 := 60.0 * FK
	_par = PackedFloat64Array([m1, m2, k48, k60, sea, dE])
	_in = {"elev": elev, "dOcean": dOcean}
	moist = _bands_run(_moist_band)
	temp = _join(_bands2)
	_in = {}
	_tick("flood+moist")
	# 6. озёра во впадинах (и насыпные, если мало)
	stage = "озёра и реки"
	var lake := PackedByteArray()
	lake.resize(NT)
	var lakeList: Array = []
	var seen := PackedByteArray()
	seen.resize(NT)
	if true:
		var cand := PackedByteArray()
		cand.resize(NT)
		for i in NT:
			if not ocean[i] and filled[i] - elev[i] > 0.010:
				cand[i] = 1
		var comps: Array = []
		for i0 in NT:
			if not cand[i0] or seen[i0]:
				continue
			var c := PackedInt32Array()
			qh = 0
			qt = 0
			q[qt] = i0
			qt += 1
			seen[i0] = 1
			while qh < qt:
				var a := q[qh]
				qh += 1
				c.append(a)
				var x := a % MW
				if x < MW - 1 and cand[a + 1] and not seen[a + 1]:
					seen[a + 1] = 1
					q[qt] = a + 1
					qt += 1
				if x > 0 and cand[a - 1] and not seen[a - 1]:
					seen[a - 1] = 1
					q[qt] = a - 1
					qt += 1
				if a < NT - MW and cand[a + MW] and not seen[a + MW]:
					seen[a + MW] = 1
					q[qt] = a + MW
					qt += 1
				if a >= MW and cand[a - MW] and not seen[a - MW]:
					seen[a - MW] = 1
					q[qt] = a - MW
					qt += 1
			comps.append(c)
		# устойчивая сортировка по убыванию размера (как Array.sort в JS)
		var ck := PackedInt64Array()
		for k in comps.size():
			ck.append((NT - (comps[k] as PackedInt32Array).size()) * 1048576 + k)
		ck.sort()
		var maxL := int(JSM.jround(900.0 * FK * FK))
		var top := mini(ck.size(), int(JSM.jround(12.0 * pow(WSCALE, 1.3))))
		for kk in top:
			var c: PackedInt32Array = comps[ck[kk] % 1048576]
			if c.size() < 7 or c.size() > maxL:
				continue
			for a in c:
				lake[a] = 1
			lakeList.append(c)
		var tries := 0
		var wantL := int(JSM.jround(5.0 * WSCALE))
		var gap := 30.0 * FK
		var sq := sqrt(FK)
		while lakeList.size() < wantL:
			var ok_t := tries < 400.0 * WSCALE
			tries += 1
			if not ok_t:
				break
			var x := rng.i(20, MW - 21)
			var y := rng.i(20, MH - 21)
			var i := y * MW + x
			var r := (elev[i] - sea) / dE
			if ocean[i] or r < 0.04 or r > 0.35 or dOcean[i] < 8:
				continue
			var ok := true
			for L: PackedInt32Array in lakeList:
				var c0 := L[0]
				if JSM.hypot(c0 % MW - x, c0 / MW - y) < gap:
					ok = false
					break
			if not ok:
				continue
			var rr := rng.range(2.2, 4.5) * sq
			var c := PackedInt32Array()
			var ex := rng.range(0.7, 1.4)
			var RX := int(ceilf(8.0 * sq))
			var RY := int(ceilf(6.0 * sq))
			for yy in range(-RY, RY + 1):
				for xx in range(-RX, RX + 1):
					if x + xx < 0 or y + yy < 0 or x + xx >= MW or y + yy >= MH:
						continue
					var j := (y + yy) * MW + x + xx
					var dd := JSM.hypot(xx / ex, yy * ex) + NZ.n2((x + xx) / 3.0, (y + yy) / 3.0) * 1.4
					if dd < rr and not ocean[j]:
						lake[j] = 1
						c.append(j)
			if c.size() >= 7:
				lakeList.append(c)
	filled = PackedFloat32Array()
	# 7. сток и реки
	var acc := PackedFloat32Array()
	acc.resize(NT)
	for k in range(on - 1, -1, -1):
		var j := order[k]
		acc[j] = acc[j] + (0.3 + clampf(moist[j], 0.0, 1.2))
		var d := down[j]
		if d >= 0 and not ocean[d]:
			acc[d] = acc[d] + acc[j]
	order = PackedInt32Array()
	var river := PackedByteArray()
	river.resize(NT)
	if true:
		var vals := PackedFloat32Array()
		for i in NT:
			if not ocean[i] and not lake[i]:
				vals.append(acc[i])
		vals.sort()
		var T: float = vals[int(floorf(vals.size() * 0.968))]
		for i in NT:
			if not ocean[i] and not lake[i] and acc[i] >= T:
				river[i] = 3 if acc[i] >= T * 16.0 else (2 if acc[i] >= T * 4.5 else 1)
	var rivers: Array = []
	if true:
		var upR := PackedByteArray()
		upR.resize(NT)
		for i in NT:
			if river[i] and down[i] >= 0:
				upR[down[i]] += 1
		var used := PackedByteArray()
		used.resize(NT)
		for s in NT:
			if not river[s] or upR[s]:
				continue
			var pts := PackedInt32Array()
			var cur := s
			var x := s % MW
			for d in 4:
				var j := -1
				match d:
					0: j = s + 1 if x < MW - 1 else -1
					1: j = s - 1 if x > 0 else -1
					2: j = s + MW if s < NT - MW else -1
					3: j = s - MW if s >= MW else -1
				if j >= 0 and lake[j] and down[j] == s:
					pts.append(j)
					break
			for g in 6000:
				pts.append(cur)
				if used[cur]:
					break
				used[cur] = 1
				var d := down[cur]
				if d < 0:
					break
				if ocean[d] or lake[d]:
					pts.append(d)
					break
				cur = d
			if pts.size() >= 3:
				rivers.append(pts)
	_tick("lakes+rivers")
	# 8. виды местности
	stage = "леса, горы, степи"
	var lr := PackedFloat32Array()
	var ms := PackedFloat32Array()
	for i in NT:
		if not ocean[i] and not lake[i]:
			lr.append((elev[i] - sea) / dE)
			ms.append(moist[i])
	lr.sort()
	ms.sort()
	var nl := lr.size()
	var peakT: float = lr[int(floorf(nl * 0.988))]
	var mountT: float = lr[int(floorf(nl * 0.94))]
	var hillT: float = lr[int(floorf(nl * 0.83))]
	var lowT: float = lr[int(floorf(nl * 0.45))]
	var marshM: float = ms[int(floorf(nl * 0.93))]
	var dforM: float = ms[int(floorf(nl * 0.80))]
	var forM: float = ms[int(floorf(nl * 0.56))]
	var stepM: float = ms[int(floorf(nl * 0.17))]
	var lmM: float = ms[int(floorf(nl * 0.6))]
	lr = PackedFloat32Array()
	ms = PackedFloat32Array()
	for i in NT:
		if ocean[i]:
			ter[i] = DEEP
			continue
		if lake[i]:
			ter[i] = LAKE
			continue
		var r := (elev[i] - sea) / dE
		var m := moist[i]
		var t := temp[i]
		var b := GRASS
		if r > peakT: b = PEAK
		elif r > mountT: b = MOUNT
		elif r > hillT: b = HILLS
		elif t < 0.2: b = FOREST if m > forM else SNOW
		elif m > marshM and r < lowT: b = MARSH
		elif m > dforM: b = DFOREST
		elif m > forM: b = FOREST
		elif m < stepM and t > 0.42: b = STEPPE
		else: b = GRASS
		ter[i] = b
	if true:
		var dl := PackedByteArray()
		dl.resize(NT)
		dl.fill(255)
		qh = 0
		qt = 0
		for i in NT:
			if not ocean[i]:
				dl[i] = 0
				q[qt] = i
				qt += 1
		while qh < qt:
			var i := q[qh]
			qh += 1
			var x := i % MW
			if dl[i] >= 4:
				continue
			var nv := dl[i] + 1
			if x < MW - 1 and dl[i + 1] == 255:
				dl[i + 1] = nv
				q[qt] = i + 1
				qt += 1
			if x > 0 and dl[i - 1] == 255:
				dl[i - 1] = nv
				q[qt] = i - 1
				qt += 1
			if i < NT - MW and dl[i + MW] == 255:
				dl[i + MW] = nv
				q[qt] = i + MW
				qt += 1
			if i >= MW and dl[i - MW] == 255:
				dl[i - MW] = nv
				q[qt] = i - MW
				qt += 1
		for i in NT:
			if ocean[i] and dl[i] <= 2:
				ter[i] = SHALLOW
	for y in MH:
		for x in MW:
			var i := y * MW + x
			var b := ter[i]
			if WATER[b] or b == MOUNT or b == PEAK:
				continue
			var nOc := 0
			var nLake := 0
			var nRiv := 0
			for d in 8:
				var nx := x + DX8[d]
				var ny := y + DY8[d]
				if nx < 0 or ny < 0 or nx >= MW or ny >= MH:
					continue
				var j := ny * MW + nx
				if ocean[j]: nOc += 1
				if lake[j]: nLake += 1
				if river[j]: nRiv += 1
			var r := (elev[i] - sea) / dE
			if nOc and r < 0.07 and b != HILLS and NZ.n2(x / 7.0 + 40.0, y / 7.0) > -0.35 and temp[i] > 0.2:
				ter[i] = BEACH
			elif nLake and moist[i] > lmM and r < 0.2 and b != HILLS and JSM.hash2(x, y, 3) < 0.5:
				ter[i] = MARSH
			elif nRiv and b == STEPPE:
				ter[i] = GRASS
	# 9. до пресной воды (реки, озёра)
	var fwd := PackedByteArray()
	fwd.resize(NT)
	fwd.fill(30)
	qh = 0
	qt = 0
	for i in NT:
		if river[i] or lake[i]:
			fwd[i] = 0
			q[qt] = i
			qt += 1
	while qh < qt:
		var i := q[qh]
		qh += 1
		if fwd[i] >= 29:
			continue
		var x := i % MW
		var y := i / MW
		var nv := fwd[i] + 1
		for d in 8:
			var nx := x + DX8[d]
			var ny := y + DY8[d]
			if nx < 0 or ny < 0 or nx >= MW or ny >= MH:
				continue
			var j := ny * MW + nx
			if fwd[j] > nv:
				fwd[j] = nv
				q[qt] = j
				qt += 1
	_tick("biomes")
	# главная суша (проходимая, связанная по 4 соседям)
	var main := PackedByteArray()
	main.resize(NT)
	var landMain := 0
	if true:
		seen = PackedByteArray()
		seen.resize(NT)
		var best := PackedInt32Array()
		var has_best := false
		for i0 in NT:
			if not PASS[ter[i0]] or seen[i0]:
				continue
			var c := PackedInt32Array()
			qh = 0
			qt = 0
			q[qt] = i0
			qt += 1
			seen[i0] = 1
			while qh < qt:
				var a := q[qh]
				qh += 1
				c.append(a)
				var x := a % MW
				if x < MW - 1 and PASS[ter[a + 1]] and not seen[a + 1]:
					seen[a + 1] = 1
					q[qt] = a + 1
					qt += 1
				if x > 0 and PASS[ter[a - 1]] and not seen[a - 1]:
					seen[a - 1] = 1
					q[qt] = a - 1
					qt += 1
				if a < NT - MW and PASS[ter[a + MW]] and not seen[a + MW]:
					seen[a + MW] = 1
					q[qt] = a + MW
					qt += 1
				if a >= MW and PASS[ter[a - MW]] and not seen[a - MW]:
					seen[a - MW] = 1
					q[qt] = a - MW
					qt += 1
			if not has_best or c.size() > best.size():
				best = c
				has_best = true
		for a in best:
			main[a] = 1
		landMain = best.size()
	# 10. места крепостей и городов (сначала лучшие, ~50 клеток друг от друга)
	stage = "места городов"
	var coast := PackedByteArray() # coastAdj: море среди 8 соседей
	coast.resize(NT)
	for y in MH:
		for x in MW:
			for d in 8:
				var nx := x + DX8[d]
				var ny := y + DY8[d]
				if nx >= 0 and ny >= 0 and nx < MW and ny < MH and ocean[ny * MW + nx]:
					coast[y * MW + x] = 1
					break
	var siteScore := PackedFloat32Array()
	siteScore.resize(NT)
	var BSC := PackedFloat32Array()
	BSC.resize(14)
	BSC[GRASS] = 0.7
	BSC[STEPPE] = 0.35
	BSC[FOREST] = 0.05
	BSC[DFOREST] = -0.4
	BSC[HILLS] = 0.45
	BSC[BEACH] = 0.25
	BSC[SNOW] = -0.3
	for i in NT:
		var b := ter[i]
		var x := i % MW
		var y := i / MW
		if not main[i] or WATER[b] or river[i] or b == MOUNT or b == PEAK or b == MARSH:
			siteScore[i] = -9
			continue
		if x < 5 or y < 5 or x > MW - 6 or y > MH - 6:
			siteScore[i] = -9
			continue
		var s := 1.0 + (1.3 if fwd[i] <= 1 else (0.5 if fwd[i] <= 3 else -0.6)) + (0.6 if coast[i] else 0.0)
		s += BSC[b]
		siteScore[i] = s + JSM.hash2(x, y, seed) * 0.8
	var cands := PackedInt32Array()
	if true:
		var keys := PackedInt64Array()
		for i in NT:
			if siteScore[i] > 0.8:
				keys.append(int(JSM.jround((10.0 - siteScore[i]) * 1e5)) * 2097152 + i)
		keys.sort()
		cands.resize(keys.size())
		for k in keys.size():
			cands[k] = keys[k] % 2097152
	_blk = PackedByteArray()
	_blk.resize(NT)
	var seats: Array = [] # [i, x, y]
	var R0 := 29.0 * SEAT_K
	var wantS := float(landMain) / (R0 * R0) * 0.9
	var rr0 := R0
	for it in 12:
		seats = []
		_blk.fill(0)
		for i in cands:
			if _blk[i]:
				continue
			var x := i % MW
			var y := i / MW
			seats.append([i, x, y])
			_disc(x, y, rr0 - 0.01)
		if seats.size() > wantS * 1.18:
			rr0 *= 1.03
		elif seats.size() < wantS * 0.82:
			rr0 *= 0.97
		else:
			break
	_tick("seats")
	# 11. провинции: Дейкстра от всех мест сразу по цене местности
	stage = "провинции и державы"
	var prov := PackedInt32Array()
	prov.resize(NT)
	prov.fill(-1)
	var np := seats.size()
	if true:
		var PC := {GRASS: 1.0, FARM: 1.0, STEPPE: 1.1, BEACH: 1.2, FOREST: 1.8, DFOREST: 2.6, HILLS: 2.6, MOUNT: 8.0, PEAK: 24.0, MARSH: 3.0, SNOW: 1.8}
		var pcost := PackedFloat32Array()
		pcost.resize(14)
		for t in 14:
			pcost[t] = PC.get(t, 1.0)
		var dd := PackedFloat64Array()
		dd.resize(NT)
		dd.fill(INF)
		var h := Heap.new()
		for k in np:
			var s: Array = seats[k]
			dd[s[0]] = 0.0
			prov[s[0]] = k
			h.push(0.0, s[0])
		while h.size > 0:
			var key := h.k[0]
			var i := h.pop()
			if key > dd[i]:
				continue
			var x := i % MW
			var di := dd[i]
			var pi := prov[i]
			for d in 4:
				var j := -1
				match d:
					0: j = i + 1 if x < MW - 1 else -1
					1: j = i - 1 if x > 0 else -1
					2: j = i + MW if i < NT - MW else -1
					3: j = i - MW if i >= MW else -1
				if j < 0 or not main[j]:
					continue
				var c := di + pcost[ter[j]] + ((4.0 + river[j] * 2) if river[j] else 0.0)
				if c < dd[j]:
					dd[j] = c
					prov[j] = pi
					h.push(c, j)
	var area := PackedInt32Array()
	area.resize(np)
	var sumx := PackedInt64Array()
	sumx.resize(np)
	var sumy := PackedInt64Array()
	sumy.resize(np)
	var mix := PackedFloat32Array()
	mix.resize(np * 14)
	var pcoast := PackedInt32Array()
	pcoast.resize(np)
	var priv := PackedInt32Array()
	priv.resize(np)
	var nbd: Array = []
	for k in np:
		nbd.append({})
	for i in NT:
		var p := prov[i]
		if p < 0:
			continue
		var x := i % MW
		area[p] += 1
		sumx[p] += x
		sumy[p] += i / MW
		mix[p * 14 + ter[i]] += 1.0
		if river[i]:
			priv[p] += 1
		for d in 4:
			var j := -1
			match d:
				0: j = i + 1 if x < MW - 1 else -1
				1: j = i - 1 if x > 0 else -1
				2: j = i + MW if i < NT - MW else -1
				3: j = i - MW if i >= MW else -1
			if j < 0:
				continue
			var pj := prov[j]
			if pj >= 0 and pj != p and not (nbd[p] as Dictionary).has(pj):
				nbd[p][pj] = true
			if ocean[j]:
				pcoast[p] += 1
	var provs: Array = []
	for k in np:
		var s: Array = seats[k]
		var a := maxi(1, area[k])
		var mx14 := PackedFloat32Array()
		mx14.resize(14)
		for t in 14:
			mx14[t] = mix[k * 14 + t] / a
		provs.append({"id": k, "seat": -1, "x": s[1], "y": s[2], "area": area[k], "cx": float(sumx[k]) / a, "cy": float(sumy[k]) / a,
			"nb": (nbd[k] as Dictionary).keys(), "mix": mx14, "coast": pcoast[k], "river": priv[k], "villages": []})
	# 12. державы: от опорных точек и рост по соседям
	var RK := maxf(1.0, np / 45.0 * 0.86)
	var RA := [{"k": "K", "ax": 0.36, "ay": 0.5, "n": 7}, {"k": "C", "ax": 0.5, "ay": 0.1, "n": 7}, {"k": "R", "ax": 0.16, "ay": 0.84, "n": 6},
		{"k": "T", "ax": 0.64, "ay": 0.82, "n": 6}, {"k": "E", "ax": 0.86, "ay": 0.36, "n": 10}]
	for ra: Dictionary in RA:
		ra.n = int(JSM.jround(ra.n * RK))
	var owner := PackedInt32Array()
	owner.resize(np)
	owner.fill(-1)
	var caps: Array = []
	var minA := 250.0 * SEAT_K * SEAT_K
	for r in RA.size():
		var ra: Dictionary = RA[r]
		var best := -1
		var bd := INF
		for minD: float in [62.0, 50.0, 38.0, 0.0]:
			for k in np:
				var P: Dictionary = provs[k]
				if owner[k] >= 0 or P.area < minA:
					continue
				var far := true
				for c: int in caps:
					if JSM.hypot(P.x - provs[c].x, P.y - provs[c].y) < minD * WSCALE:
						far = false
						break
				if not far:
					continue
				var d := JSM.hypot(P.x - ra.ax * MW, (P.y - ra.ay * MH) * 1.3)
				if d < bd:
					bd = d
					best = k
			if best >= 0:
				break
		if best < 0:
			for k in np:
				if owner[k] < 0 and best < 0:
					best = k
		owner[best] = r
		caps.append(best)
	if true:
		var cnt := [1, 1, 1, 1, 1]
		var grew := true
		while grew:
			grew = false
			for r in RA.size():
				if cnt[r] >= RA[r].n:
					continue
				var cp: Dictionary = provs[caps[r]]
				var best := -1
				var bd := INF
				for k in np:
					if owner[k] != r:
						continue
					for nb: int in provs[k].nb:
						if owner[nb] < 0:
							var d := JSM.hypot(provs[nb].x - cp.x, provs[nb].y - cp.y) * (0.85 + JSM.hash2(nb, r, seed) * 0.3)
							if d < bd:
								bd = d
								best = nb
				if best >= 0:
					owner[best] = r
					cnt[r] += 1
					grew = true
	_tick("provs+realms")
	var minR := int(JSM.jround(4.0 * RK))
	for r in RA.size():
		for g in minR:
			var mine: Array = []
			for k in np:
				if owner[k] == r:
					mine.append(k)
			if mine.size() >= minR:
				break
			var best := -1
			var bs := -1
			for k: int in mine:
				for nb: int in provs[k].nb:
					var o := owner[nb]
					if o < 0:
						best = nb
						bs = 99
					elif o != r and not caps.has(nb):
						var sz := owner.count(o)
						if sz > minR + 1 and sz > bs:
							bs = sz
							best = nb
			if best < 0:
				break
			owner[best] = r
	# 13. поселения
	stage = "города и деревни"
	var setts: Array = []
	var usedN := {}
	var realmCult := ["K", "C", "R", "T", "E"]
	_blk.fill(0)
	var VGAP := 9.5
	for k in np:
		var s: Array = seats[k]
		var si: int = s[0]
		var cul: String
		if owner[k] >= 0:
			cul = realmCult[owner[k]]
		else:
			cul = "K" if JSM.hash2(k, 7, seed) < 0.5 else realmCult[1 + int(floorf(JSM.hash2(k, 9, seed) * 4))]
		var P: Dictionary = provs[k]
		P.cul = cul
		var ca := coast[si] != 0
		var nearW := fwd[si] <= 1 or ca
		var type := "castle"
		if caps.has(k):
			type = "capital"
		elif ter[si] == HILLS:
			type = "castle"
		elif (ca and JSM.hash2(k, 3, seed) < 0.8) or (nearW and JSM.hash2(k, 4, seed) < 0.45):
			type = "town"
		var name := _mk_name(rng, cul, usedN)
		if type == "town" and cul == "R" and ca and rng.chance(0.5):
			name = "Порто-" + name
		P.name = name
		P.seat = setts.size()
		setts.append({"id": setts.size(), "name": name, "type": type, "x": s[1], "y": s[2], "i": si, "prov": k, "coast": 1 if ca else 0})
		_disc(s[1], s[2], VGAP + 1.5)
	if true:
		var vc: Array = []
		for k in np:
			vc.append(PackedInt32Array())
		var ssb := siteScore.to_byte_array().to_int32_array() # биты Float32: для положительных чисел порядок тот же
		for i in NT:
			var k := prov[i]
			if k >= 0 and siteScore[i] > 0.6 and ter[i] != SNOW:
				vc[k].append(i)
		for k in np:
			var P: Dictionary = provs[k]
			var want := clampi(int(JSM.jround(P.area / 400.0 + (1 if JSM.hash2(k, 11, seed) < 0.35 else 0))), 2, 8)
			var pc: PackedInt32Array = vc[k]
			var keys := PackedInt64Array()
			keys.resize(pc.size())
			for n in pc.size():
				keys[n] = (0x7FFFFFFF - ssb[pc[n]]) * 2097152 + pc[n]
			keys.sort()
			for key in keys:
				if P.villages.size() >= want:
					break
				var i := key % 2097152
				if _blk[i]:
					continue
				var x := i % MW
				var y := i / MW
				P.villages.append(setts.size())
				setts.append({"id": setts.size(), "name": _mk_name(rng, P.cul, usedN), "type": "village", "x": x, "y": y, "i": i, "prov": k, "coast": 1 if coast[i] else 0})
				_disc(x, y, VGAP)
	# 14. пашни вокруг поселений
	for s: Dictionary in setts:
		var R0s := 3.2 if s.type == "village" else (3.6 if s.type == "castle" else 5.2)
		for dy in range(-6, 7):
			for dx in range(-6, 7):
				var x: int = s.x + dx
				var y: int = s.y + dy
				if x < 0 or y < 0 or x >= MW or y >= MH:
					continue
				var i := y * MW + x
				var b := ter[i]
				if b != GRASS and b != STEPPE and b != FOREST and b != BEACH and b != SNOW:
					continue
				var d := JSM.hypot(dx, dy) + NZ.n2(x / 3.0 + 11.0, y / 3.0) * 1.6
				if d < R0s and (b != FOREST or d < R0s - 1.2) and (b != SNOW or d < 2.0):
					ter[i] = FARM
				elif d < R0s + 1.5 and b == FOREST and JSM.hash2(x, y, 5) < 0.6:
					ter[i] = GRASS
		ter[s.i] = FARM
	_tick("setts")
	# 15. дороги: остов (MST) + лишние связи, деревни к своим крепостям
	stage = "дороги"
	_road = PackedByteArray()
	_road.resize(NT)
	_bridge = PackedByteArray()
	_bridge.resize(NT)
	_river = river
	_roadList = []
	if true:
		var RC := {GRASS: 1.0, FARM: 1.0, STEPPE: 1.05, BEACH: 1.3, FOREST: 2.0, DFOREST: 3.2, HILLS: 2.4, MOUNT: 7.0, MARSH: 5.0, SNOW: 1.8}
		var rcost := PackedFloat32Array()
		rcost.resize(14)
		rcost.fill(INF)
		for t: int in RC:
			rcost[t] = RC[t]
		_bc = PackedFloat64Array()
		_bc.resize(NT)
		for j in NT:
			var kc: float = rcost[ter[j]]
			if kc < INF and river[j]:
				kc += 9 + river[j] * 4
			_bc[j] = kc
		_g = PackedFloat64Array()
		_g.resize(NT)
		_from = PackedInt32Array()
		_from.resize(NT)
		_st = PackedInt32Array()
		_st.resize(NT)
		_cl = PackedInt32Array()
		_cl.resize(NT)
		_gen = 0
		var edges: Array = []
		for k in np:
			for nb: int in provs[k].nb:
				if nb > k:
					edges.append([JSM.hypot(provs[k].x - provs[nb].x, provs[k].y - provs[nb].y), k, nb, edges.size()])
		edges.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0] or (a[0] == b[0] and a[3] < b[3]))
		var par := PackedInt32Array()
		par.resize(np)
		for k in np:
			par[k] = k
		var extra: Array = []
		var nroads := 0
		for e: Array in edges:
			var ra: int = e[1]
			while par[ra] != ra:
				ra = par[ra]
			var rb: int = e[2]
			while par[rb] != rb:
				rb = par[rb]
			if ra != rb:
				par[ra] = rb
				_build(setts[provs[e[1]].seat].i, setts[provs[e[2]].seat].i, 2)
			else:
				extra.append(e)
			nroads += 1
			part = 0.4 * nroads / edges.size()
		for e: Array in extra:
			if JSM.hash2(e[1], e[2], seed) < 0.38 and e[0] < 45.0 * SEAT_K:
				_build(setts[provs[e[1]].seat].i, setts[provs[e[2]].seat].i, 2)
		for k in np:
			part = 0.5 + 0.5 * k / np
			for v: int in provs[k].villages:
				_build(setts[v].i, setts[provs[k].seat].i, 1)
		_g = PackedFloat64Array()
		_from = PackedInt32Array()
		_st = PackedInt32Array()
		_cl = PackedInt32Array()
		_bc = PackedFloat64Array()
	_tick("roads")
	# 16. броды на реках
	var ford := PackedByteArray()
	ford.resize(NT)
	for pts: PackedInt32Array in rivers:
		var since := rng.i(3, 8)
		for k in range(1, pts.size() - 1):
			var t := pts[k]
			if not river[t]:
				continue
			since += 1
			var gp := 26 if river[t] == 3 else (14 if river[t] == 2 else 10)
			var tt := ter[t]
			if since >= gp and not _bridge[t] and (tt == GRASS or tt == FARM or tt == STEPPE or tt == FOREST or tt == SNOW) and rng.chance(0.5):
				ford[t] = 1
				since = 0
	# 17. разбойничьи логова (примерно одно на пять провинций)
	var lairs: Array = []
	var wantLairs := int(JSM.jround(9.0 * np / 45.0))
	var lg := 30.0 * SEAT_K
	var lg2 := lg * lg
	var tries2 := 0
	while tries2 < 3000.0 * WSCALE * WSCALE and lairs.size() < wantLairs:
		tries2 += 1
		var x := rng.i(8, MW - 9)
		var y := rng.i(8, MH - 9)
		var i := y * MW + x
		var tt := ter[i]
		if not (tt == FOREST or tt == DFOREST or tt == HILLS or tt == MARSH) or river[i] or _road[i] or not main[i]:
			continue
		var ok := true
		for s: Dictionary in setts:
			var dx: int = s.x - x
			var dy: int = s.y - y
			if dx * dx + dy * dy < 144:
				ok = false
				break
		for l: Array in lairs:
			var dx: int = l[0] - x
			var dy: int = l[1] - y
			if dx * dx + dy * dy < lg2:
				ok = false
				break
		if ok:
			lairs.append([x, y, i, prov[i]])
	# 18. подписи: озёра и хребты
	var labels: Array = []
	for k in lakeList.size():
		var L: PackedInt32Array = lakeList[k]
		if L.size() < 20:
			continue
		var sx := 0
		var sy := 0
		for a in L:
			sx += a % MW
			sy += a / MW
		labels.append({"t": "озеро " + String(LAKEN[k % LAKEN.size()]), "x": float(sx) / L.size(), "y": float(sy) / L.size(), "kind": "lake", "n": 0})
	if true:
		seen = PackedByteArray()
		seen.resize(NT)
		var k := 0
		var minM := int(JSM.jround(60.0 * SEAT_K * SEAT_K))
		for i0 in NT:
			if (ter[i0] != MOUNT and ter[i0] != PEAK) or seen[i0]:
				continue
			qh = 0
			qt = 0
			q[qt] = i0
			qt += 1
			seen[i0] = 1
			var sx := 0
			var sy := 0
			while qh < qt:
				var a := q[qh]
				qh += 1
				var x := a % MW
				var y := a / MW
				sx += x
				sy += y
				for d in 8:
					var nx := x + DX8[d]
					var ny := y + DY8[d]
					if nx < 0 or ny < 0 or nx >= MW or ny >= MH:
						continue
					var j := ny * MW + nx
					if (ter[j] == MOUNT or ter[j] == PEAK) and not seen[j]:
						seen[j] = 1
						q[qt] = j
						qt += 1
			if qt > minM:
				labels.append({"t": MOUNTN[(k + seed) % MOUNTN.size()], "x": float(sx) / qt, "y": float(sy) / qt, "kind": "mount", "n": qt})
				k += 1
	var relA := PackedFloat32Array()
	relA.resize(NT)
	for i in NT:
		relA[i] = (elev[i] - sea) / dE
	var W := WorldData.new()
	W.seed = seed
	W.sea = sea
	W.ter = ter
	W.elev = elev
	W.rel = relA
	W.moist = moist
	W.temp = temp
	W.river = river
	W.rivers = rivers
	W.down = down
	W.acc = acc
	W.road = _road
	W.roads = _roadList
	W.bridge = _bridge
	W.ford = ford
	W.prov = prov
	W.provs = provs
	W.setts = setts
	W.lairs = lairs
	W.owner = owner
	W.caps = caps
	W.ocean = ocean
	W.lake = lake
	W.fwd = fwd
	W.dOcean = dOcean
	W.labels = labels
	W.main = main
	_road = PackedByteArray()
	_bridge = PackedByteArray()
	_river = PackedByteArray()
	_blk = PackedByteArray()
	_roadList = []
	_tick("rest")
	W.tt = TT
	W.ms = Time.get_ticks_msec() - t0
	stage = "готово"
	part = 1.0
	return W
