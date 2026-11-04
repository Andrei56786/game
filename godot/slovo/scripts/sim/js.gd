class_name JS
## Поведение JavaScript для переноса симуляции (state.js, econ.js, dynasty.js, intel.js…): генератор mkRng с числами
## двойной точности, истинность значений, «v || 0», Math.round, Math.hypot, устойчивая сортировка как Array.sort.
## Состояние игры — словари и массивы, как объекты JS; все числа в нём — float (в JS чисел-целых нет).


## mkRng (engine.js): mulberry32. В отличие от JSM.Rng, i() даёт float — числа идут прямо в состояние игры.
class Rng:
	var st: int = 0

	func _init(s: int = 0) -> void:
		st = s & 0xFFFFFFFF

	func f() -> float:
		st = (st + 0x6D2B79F5) & 0xFFFFFFFF
		var t: int = JSM.imul(st ^ (st >> 15), 1 | st)
		t = ((t + JSM.imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
		return float((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

	func i(a: float, b: float) -> float:
		return a + floorf(f() * (b - a + 1.0))

	## a[Math.floor(f() * a.length)]: из пустого массива — null (в JS undefined), случайное число всё равно тратится
	func pick(a: Array) -> Variant:
		var k := int(floorf(f() * a.size()))
		return a[k] if k < a.size() else null

	func chance(p: float) -> bool:
		return f() < p

	func range(a: float, b: float) -> float:
		return a + (b - a) * f()

	func reseed(s: int) -> void:
		st = s & 0xFFFFFFFF

	func wpick(a: Array, wf: Callable) -> Variant:
		var s := 0.0
		for x in a:
			s += float(wf.call(x))
		var k := f() * s
		for x in a:
			k -= float(wf.call(x))
			if k <= 0.0:
				return x
		return a[a.size() - 1] if a.size() > 0 else null

	func shuffle(a: Array) -> Array:
		var k := a.size() - 1
		while k > 0:
			var j := int(floorf(f() * (k + 1)))
			var t: Variant = a[k]
			a[k] = a[j]
			a[j] = t
			k -= 1
		return a


## Истинность по правилам JS: пустые массив и объект — истина (в GDScript — ложь!), 0, NaN, "" и null — ложь.
static func t(v: Variant) -> bool:
	match typeof(v):
		TYPE_NIL:
			return false
		TYPE_BOOL:
			return v
		TYPE_INT:
			return v != 0
		TYPE_FLOAT:
			return v != 0.0 and not is_nan(v)
		TYPE_STRING, TYPE_STRING_NAME:
			return v != ""
	return true


## «v || 0» для чисел: null, false, 0 и NaN → 0
static func n(v: Variant) -> float:
	match typeof(v):
		TYPE_FLOAT:
			return 0.0 if is_nan(v) else v
		TYPE_INT:
			return float(v)
		TYPE_BOOL:
			return 1.0 if v else 0.0
	return 0.0


## «v || d»: значение, если истинно, иначе запасное
static func o(v: Variant, d: Variant) -> Variant:
	return v if t(v) else d


## Math.round (V8): половины — вверх
static func rnd(x: float) -> float:
	var c := ceilf(x)
	return c - 1.0 if c - 0.5 > x else c


static func hypot(a: float, b: float) -> float:
	return JSM.hypot(a, b)


## clamp из engine.js: v < a ? a : v > b ? b : v
static func clp(v: float, a: float, b: float) -> float:
	return a if v < a else (b if v > b else v)


static func mn(a: float, b: float) -> float:
	return a if a < b else b


static func mx(a: float, b: float) -> float:
	return a if a > b else b


## Array.prototype.sort с функцией сравнения (число <0, 0, >0): устойчивая сортировка слиянием — тот же порядок, что у V8.
static func sort(a: Array, cmp: Callable) -> Array:
	var n0 := a.size()
	if n0 < 2:
		return a
	var src := a.duplicate()
	var dst := []
	dst.resize(n0)
	var w := 1
	while w < n0:
		var lo := 0
		while lo < n0:
			var mid := mini(lo + w, n0)
			var hi := mini(lo + 2 * w, n0)
			var i := lo
			var j := mid
			var k := lo
			while i < mid and j < hi:
				if float(cmp.call(src[j], src[i])) < 0.0:
					dst[k] = src[j]
					j += 1
				else:
					dst[k] = src[i]
					i += 1
				k += 1
			while i < mid:
				dst[k] = src[i]
				i += 1
				k += 1
			while j < hi:
				dst[k] = src[j]
				j += 1
				k += 1
			lo += 2 * w
		var tmp := src
		src = dst
		dst = tmp
		w *= 2
	for k in n0:
		a[k] = src[k]
	return a


## Number → String (как String(n) в JS) для целых и простых дробей: 3 → "3", 2.5 → "2.5"
static func s(x: float) -> String:
	if x == floorf(x) and absf(x) < 1e15:
		return str(int(x))
	return str(x)


## Ключ-индекс массива по правилам JS ("0", "17"; без ведущих нулей, меньше 2³²−1)
static func isIdx(k: String) -> bool:
	var n := k.length()
	if n == 0 or n > 10 or not k.is_valid_int() or k[0] == "-" or k[0] == "+" or (n > 1 and k[0] == "0"):
		return false
	return k.to_int() < 4294967295


## obj[k] = v по правилам объекта JS: ключи-индексы ("0", "17"…) идут первыми по возрастанию, остальные — в порядке
## добавления. Новый ключ-индекс встаёт на своё место (словарь перестраивается на месте — ссылки на него не теряются).
static func oset(d: Dictionary, k: String, v: Variant) -> void:
	if d.has(k) or not isIdx(k):
		d[k] = v
		return
	var ki := k.to_int()
	var keys := d.keys()
	var at := -1
	for i in keys.size():
		var kk: String = keys[i]
		if not isIdx(kk) or kk.to_int() > ki:
			at = i
			break
	if at < 0:
		d[k] = v
		return
	var vals := d.values()
	d.clear()
	for i in keys.size():
		if i == at:
			d[k] = v
		d[keys[i]] = vals[i]
