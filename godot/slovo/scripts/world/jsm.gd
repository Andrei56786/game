class_name JSM
## Точные копии чисел HTML-версии (JavaScript): генератор случайностей mulberry32 (mkRng), шум Перлина (mkNoise),
## хэш клеток (hash2), Math.round и Math.hypot (как в V8). Нужны, чтобы одно зерно давало тот же мир, что в HTML.
## Числа с плавающей точкой в GDScript — двойной точности, как в JS; массивы Float32 — PackedFloat32Array.

const U32 := 0xFFFFFFFF


## Math.imul для 32-битных чисел без знака: младшие 32 бита произведения (без переполнения int64).
static func imul(a: int, b: int) -> int:
	a &= U32
	b &= U32
	return ((a * (b & 0xFFFF)) + (((a * (b >> 16)) & 0xFFFF) << 16)) & U32


## hash2 из worldgen.js: дешёвый хэш клетки → [0, 1).
static func hash2(x: float, y: float, s: float = 0.0) -> float:
	var h: int = int(x * 374761393.0 + y * 668265263.0 + s * 982451653.0) & U32
	h = ((h ^ (h >> 13)) * 1274126177) & U32
	h ^= h >> 16
	return float(h) / 4294967296.0


## Math.round (V8): ceil(x), и на единицу меньше, если ceil(x) − 0.5 > x. Половины — вверх (−2.5 → −2).
static func jround(x: float) -> float:
	var c := ceilf(x)
	return c - 1.0 if c - 0.5 > x else c


## Math.hypot (V8): нормировка на больший из модулей и сумма квадратов — в последнем знаке не всегда равно sqrt(a²+b²).
static func hypot(a: float, b: float) -> float:
	a = absf(a)
	b = absf(b)
	var m := a if a > b else b
	if m == 0.0:
		return 0.0
	var n0 := a / m
	var n1 := b / m
	return sqrt(n0 * n0 + n1 * n1) * m


## Число двойной точности из двух 32-битных слов (так HTML выгружает точные значения).
static func f64(w: Array) -> float:
	var b := PackedByteArray()
	b.resize(8)
	b.encode_u32(0, int(w[0]))
	b.encode_u32(4, int(w[1]))
	return b.decode_double(0)


## mkRng (engine.js): mulberry32, всё состояние — одно 32-битное число.
class Rng:
	var st: int = 0

	func _init(seed: int = 0) -> void:
		st = seed & 0xFFFFFFFF

	func f() -> float:
		st = (st + 0x6D2B79F5) & 0xFFFFFFFF
		var t: int = JSM.imul(st ^ (st >> 15), 1 | st)
		t = ((t + JSM.imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
		return float((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

	func i(a: int, b: int) -> int:
		return a + int(floorf(f() * (b - a + 1)))

	func pick(arr: Array) -> Variant:
		return arr[int(floorf(f() * arr.size()))]

	func chance(p: float) -> bool:
		return f() < p

	func range(a: float, b: float) -> float:
		return a + (b - a) * f()

	func shuffle(arr: Array) -> Array:
		var k := arr.size() - 1
		while k > 0:
			var j := int(floorf(f() * (k + 1)))
			var t: Variant = arr[k]
			arr[k] = arr[j]
			arr[j] = t
			k -= 1
		return arr


## mkNoise (worldgen.js): шум Перлина с перестановкой и градиентами от генератора; fbm и ridge — октавы.
class PNoise:
	var p := PackedInt32Array()
	var gx := PackedFloat32Array()
	var gy := PackedFloat32Array()

	func _init(rng: Rng) -> void:
		var perm: Array = []
		for k in 256:
			perm.append(k)
		rng.shuffle(perm)
		p.resize(512)
		for k in 512:
			p[k] = perm[k & 255]
		gx.resize(256)
		gy.resize(256)
		for k in 256:
			var a := rng.f() * PI * 2.0
			gx[k] = cos(a)
			gy[k] = sin(a)

	func n2(x: float, y: float) -> float:
		var xi := floorf(x)
		var yi := floorf(y)
		var xf := x - xi
		var yf := y - yi
		var X := int(xi) & 255
		var Y := int(yi) & 255
		var u := xf * xf * xf * (xf * (xf * 6.0 - 15.0) + 10.0)
		var v := yf * yf * yf * (yf * (yf * 6.0 - 15.0) + 10.0)
		var pa := p[X]
		var pb := p[X + 1]
		var h00 := p[pa + Y]
		var h10 := p[pb + Y]
		var h01 := p[pa + Y + 1]
		var h11 := p[pb + Y + 1]
		var d00 := gx[h00] * xf + gy[h00] * yf
		var d10 := gx[h10] * (xf - 1.0) + gy[h10] * yf
		var d01 := gx[h01] * xf + gy[h01] * (yf - 1.0)
		var d11 := gx[h11] * (xf - 1.0) + gy[h11] * (yf - 1.0)
		var a := d00 + (d10 - d00) * u
		var b := d01 + (d11 - d01) * u
		return (a + (b - a) * v) * 1.41

	## fbm: та же сумма октав, n2 встроен в цикл (вызовы функций в GDScript дороги).
	func fbm(x: float, y: float, oct: int) -> float:
		var a := 1.0
		var f := 1.0
		var s := 0.0
		var n := 0.0
		for i in oct:
			var px := x * f + i * 31.7
			var py := y * f - i * 17.3
			var xi := floorf(px)
			var yi := floorf(py)
			var xf := px - xi
			var yf := py - yi
			var X := int(xi) & 255
			var Y := int(yi) & 255
			var u := xf * xf * xf * (xf * (xf * 6.0 - 15.0) + 10.0)
			var v := yf * yf * yf * (yf * (yf * 6.0 - 15.0) + 10.0)
			var pa := p[X]
			var pb := p[X + 1]
			var h00 := p[pa + Y]
			var h10 := p[pb + Y]
			var h01 := p[pa + Y + 1]
			var h11 := p[pb + Y + 1]
			var d00 := gx[h00] * xf + gy[h00] * yf
			var d10 := gx[h10] * (xf - 1.0) + gy[h10] * yf
			var d01 := gx[h01] * xf + gy[h01] * (yf - 1.0)
			var d11 := gx[h11] * (xf - 1.0) + gy[h11] * (yf - 1.0)
			var aa := d00 + (d10 - d00) * u
			var bb := d01 + (d11 - d01) * u
			s += a * ((aa + (bb - aa) * v) * 1.41)
			n += a
			a *= 0.5
			f *= 2.03
		return s / n

	func ridge(x: float, y: float, oct: int) -> float:
		var a := 1.0
		var f := 1.0
		var s := 0.0
		var n := 0.0
		for i in oct:
			var px := x * f + i * 17.3
			var py := y * f - i * 9.1
			var xi := floorf(px)
			var yi := floorf(py)
			var xf := px - xi
			var yf := py - yi
			var X := int(xi) & 255
			var Y := int(yi) & 255
			var u := xf * xf * xf * (xf * (xf * 6.0 - 15.0) + 10.0)
			var v := yf * yf * yf * (yf * (yf * 6.0 - 15.0) + 10.0)
			var pa := p[X]
			var pb := p[X + 1]
			var h00 := p[pa + Y]
			var h10 := p[pb + Y]
			var h01 := p[pa + Y + 1]
			var h11 := p[pb + Y + 1]
			var d00 := gx[h00] * xf + gy[h00] * yf
			var d10 := gx[h10] * (xf - 1.0) + gy[h10] * yf
			var d01 := gx[h01] * xf + gy[h01] * (yf - 1.0)
			var d11 := gx[h11] * (xf - 1.0) + gy[h11] * (yf - 1.0)
			var aa := d00 + (d10 - d00) * u
			var bb := d01 + (d11 - d01) * u
			var r := 1.0 - absf((aa + (bb - aa) * v) * 1.41)
			r *= r
			s += a * r
			n += a
			a *= 0.5
			f *= 2.1
		return s / n
