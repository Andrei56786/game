class_name SimSave
## Сохранения как в HTML (saveGame / loadGame из state.js): всё королевство G и генератор R. Рынки — как в HTML: что выводится
## из земли заново (res, wk, mkT, mkCap), не пишется; запасы — до десятых, книги рынка — до сотых, нули не пишутся. При загрузке —
## econReset, initEcon(S, false) для каждого поселения, затем обзор и знаки (worldSteps при «Продолжить правление»); G — как в
## HTML после JSON.parse: wv — первым ключом, vis — последним, rngS убран, письма с выбором — отвечены (выбор в JSON не уходит).
## Файл — двоичный Variant (var_to_bytes, сжат zstd), а не JSON: JSON в Godot читает часть чисел с ошибкой в последнем знаке,
## а после загрузки королевство должно идти до знака как в HTML (state_check сверяет: сохранение дня 28 — загрузка — 7 дней).
## Счёт, которого нет в G (кэши по дням и по G), при загрузке сбрасывается — как в только что открытой игре.

const WORLD_V := 3.0                     # WORLD_V в HTML: сохранение годится только для мира той же версии
const MAGIC := "SLOVO-SAVE"
const VER := 1
const OLDSAVE_TIP := "Летопись велась на прежней, малой карте мира. С новой картой она несовместима — начните новое правление."


## o из saveGame: {wv, …G, rngS} — рынки без выводимого, запасы и книги округлены (exact — без округления: G как его читает
## загрузка, для проверок — после загрузки отпечаток тот же, что у записанного)
static func save_data(exact := false) -> Dictionary:
	var G := Sim.G
	var o := {"wv": WORLD_V}
	for k in G:
		o[k] = G[k]
	var st := Sim.R.st
	o["rngS"] = float(st - 0x100000000 if st >= 0x80000000 else st)    # R.get() — st в HTML: число со знаком (| 0)
	o.erase("vis")
	var ss := []
	for S: Dictionary in G.setts:
		var c := S.duplicate()
		c.erase("res")
		c.erase("wk")
		c.erase("mkT")
		c.erase("mkCap")
		if exact:
			ss.append(c)
			continue
		c["mk"] = _rd(S.get("mk"), 10.0)
		if JS.t(S.get("st")):
			var bk := {}
			for key in S.st:
				bk[key] = _rd(S.st[key], 100.0)
			c["st"] = bk
		ss.append(c)
	o["setts"] = ss
	return o

## rd(src, f) из saveGame: ненулевые числа, округлённые Math.round(v·m)/m
static func _rd(src: Variant, m: float) -> Dictionary:
	var c := {}
	if src is Dictionary:
		for k in src:
			var v: Variant = src[k]
			if JS.t(v):
				c[k] = JSM.jround(float(v) * m) / m
	return c

## загрузить o (как loadGame и обзор со знаками): "" — готово, иначе — почему нельзя
static func load_data(o: Dictionary) -> String:
	var wv := JS.n(o.get("wv"))
	if (wv if JS.t(wv) else 1.0) != WORLD_V:       # (o.wv || 1) !== WORLD_V
		return OLDSAVE_TIP
	if not Sim.load_tables():                     # «Продолжить» сразу после запуска: таблиц ещё нет (их грузит новая игра)
		return "Нет таблиц игры (art/sim_tables.bin)."
	if Sim.W == null or float(o.get("seed", -1.0)) != float(Sim.W.seed):
		return "Сохранение сделано в другом мире (№ %s), а в этой сборке — мир № %d." % [JS.s(o.get("seed")), Sim.W.seed if Sim.W else 0]
	var ex: Variant = o.get("explored")
	if not (ex is PackedByteArray) or (ex as PackedByteArray).size() != Sim.NT:
		return "Сохранение повреждено."
	var vis := PackedByteArray()
	vis.resize(Sim.NT)
	o["vis"] = vis
	if o.get("rngS") is float:
		Sim.R.st = int(o.rngS) & 0xFFFFFFFF
	o.erase("rngS")
	reset_runtime()
	Sim.G = o
	var G := Sim.G
	fix_letters(G)
	SimEcon.econReset()
	for S: Dictionary in G.setts:
		if not S.has("cul"):
			S["cul"] = S.owner
		SimEcon.initEcon(S, false)
	SimIntel.computeVision()
	SimIntel.updateSigns()
	return ""

## письма с выбором: выбор (функции) в сохранение не уходит — такие письма считаются отвеченными (как в HTML)
static func fix_letters(G: Dictionary) -> void:
	var C: Variant = G.get("court")
	if C is Dictionary and C.get("letters") is Array:
		for l: Dictionary in C.letters:
			var ch: Variant = l.get("ch")
			if ch is Array and (ch as Array).any(func(c): return not (c is Dictionary and c.get("fx") is Callable and (c.fx as Callable).is_valid())):
				l.erase("ch")
				l["answered"] = 1.0

## отпечаток сохранения (для проверок): o — как из save_data (или из файла — тогда письма уже без выбора). Рынки и книги
## поселений — без нулей: в запись идут ненулевые, округлённые (там бывает и 0), а после загрузки initEcon добавляет
## недостающие товары нулями — как в HTML; иначе то же королевство давало бы разный отпечаток
static func digest(o: Dictionary) -> String:
	var c := o.duplicate()
	if o.get("setts") is Array:
		var ss := []
		for S: Dictionary in o.setts:
			var q := S.duplicate()
			if q.get("mk") is Dictionary:
				q["mk"] = _nz(q.mk)
			if q.get("st") is Dictionary:
				var b := {}
				for k in q.st:
					var v: Variant = _nz(q.st[k]) if q.st[k] is Dictionary else q.st[k]
					if not (v is Dictionary and (v as Dictionary).is_empty()):
						b[k] = v
				q["st"] = b
			ss.append(q)
		c["setts"] = ss
	var h := HashingContext.new()
	h.start(HashingContext.HASH_MD5)
	h.update(var_to_bytes(c))
	return h.finish().hex_encode().substr(0, 16)

static func _nz(d: Dictionary) -> Dictionary:
	var r := {}
	for k in d:
		if not ((d[k] is float or d[k] is int) and float(d[k]) == 0.0):
			r[k] = d[k]
	return r

## отпечаток записанного: o из файла без часов игры, письма — как после загрузки
static func file_digest(path: String) -> String:
	var o: Variant = read(path)
	if not (o is Dictionary):
		return ""
	o.erase("gd")
	fix_letters(o)
	return digest(o)

## счёт вне G — как в только что открытой игре: доход, знаки, кэши по дням и по G, очереди для экрана
static func reset_runtime() -> void:
	Sim.ECON = {"inc": null, "incDay": -1.0, "ms": 0.0}
	Sim.SIGNS = []
	Sim.fog_dirty = 1
	Sim.pol_dirty = 1
	Sim.feed = []
	Sim.rw_ne = -1
	Sim.rw_g = {}
	Sim.pr_cache = []
	Sim.pr_g = {}
	Sim.sfxq = []
	SimAI.bd_sig = PackedFloat64Array()
	SimAI.bd_c = {}
	SimBirds._fg = null
	SimBirds._fd = -1.0
	SimBirds._fn = -1
	SimBirds._fs = {}
	SimDay.busy = false
	SimDay.nb_cache = {"d": -1.0, "m": {}}
	SimDay.alerts = []
	SimExt._evT = 0.0
	SimExt._evP = 0
	SimPlayer.toasts = []
	SimPlayer.modal = false
	SimPlayer.fol_at = -10.0
	SimCourt.seats_rev += 1
	SimDyn.pop_rev += 1
	SimExt.proj_rev += 1
	SimSick.doc_rev += 1
	SimPlayer.exile_rev += 1

# ---------- файл ----------
## Байты сохранения: метка (длина и «SLOVO-SAVE»), версия, версия мира, зерно, день (double), длина o, o в двоичном Variant,
## сжатом zstd. На ПК — файл (через .tmp); в вебе — ещё и копия в localStorage (base64, как sk3_save в HTML): запись туда
## синхронная, а файл user:// уходит в IndexedDB не сразу — при закрытии вкладки или перезагрузке последнее сохранение
## иначе терялось бы. Читается сперва копия, потом файл.
static var size := 0                     # байт в последнем записанном
static var _heads := {}                  # путь → {has, h}: заставка и меню спрашивают каждый кадр

static func pack(o: Dictionary) -> PackedByteArray:
	var raw := var_to_bytes(o)
	var b := StreamPeerBuffer.new()
	b.put_utf8_string(MAGIC)
	b.put_32(VER)
	b.put_double(JS.n(o.get("wv")))
	b.put_double(JS.n(o.get("seed")))
	b.put_double(JS.n(o.get("day")))
	b.put_64(raw.size())
	b.put_data(raw.compress(FileAccess.COMPRESSION_ZSTD))
	return b.data_array

## заголовок из байтов: {wv, seed, day} или {} — не наше
static func head_of(d: PackedByteArray) -> Dictionary:
	if d.size() < 51 or d.decode_u32(0) != MAGIC.length() or d.slice(4, 14).get_string_from_ascii() != MAGIC or d.decode_u32(14) != VER:
		return {}
	return {"wv": d.decode_double(18), "seed": d.decode_double(26), "day": d.decode_double(34)}

static func unpack(d: PackedByteArray) -> Variant:
	if head_of(d).is_empty():
		return null
	var n := d.decode_s64(42)
	var z := d.slice(50)
	if n <= 0 or z.is_empty():
		return null
	var o: Variant = bytes_to_var(z.decompress(n, FileAccess.COMPRESSION_ZSTD))
	return o if o is Dictionary else null

static func _ls() -> Variant:
	if not OS.has_feature("web"):
		return null
	JavaScriptBridge.eval("window.slovoLS = window.slovoLS || { set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, "
		+ "get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, del: function (k) { try { localStorage.removeItem(k); } catch (e) { } } };", true)
	return JavaScriptBridge.get_interface("slovoLS")

static func _key(path: String) -> String:
	return "slovo:" + path

## записать байты: файл и (в вебе) копия; true — хоть одно удалось
static func store(path: String, d: PackedByteArray) -> bool:
	_heads.erase(path)
	var ok := false
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f != null:
		f.store_buffer(d)
		ok = f.get_error() == OK
		f.close()
		if ok:
			if FileAccess.file_exists(path):
				DirAccess.remove_absolute(path)
			ok = DirAccess.rename_absolute(tmp, path) == OK
	var ls: Variant = _ls()
	if ls != null:
		if ls.set(_key(path), Marshalls.raw_to_base64(d)) == true:
			ok = true
		else:
			ls.del(_key(path))           # старая копия не должна заслонять новый файл
	return ok

static func load_bytes(path: String) -> PackedByteArray:
	var ls: Variant = _ls()
	if ls != null:
		var s: Variant = ls.get(_key(path))
		if s is String and s != "":
			return Marshalls.base64_to_raw(s)
	return FileAccess.get_file_as_bytes(path) if FileAccess.file_exists(path) else PackedByteArray()

static func remove(path: String) -> void:
	_heads.erase(path)
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)
	var ls: Variant = _ls()
	if ls != null:
		ls.del(_key(path))

## что сколько весит (сжатое, КБ): самые тяжёлые части — [[КБ, ключ]…]
static func stat(o: Dictionary, n := 8) -> Array:
	var L := []
	for k in o:
		L.append([snappedf(var_to_bytes(o[k]).compress(FileAccess.COMPRESSION_ZSTD).size() / 1024.0, 0.1), String(k)])
	L.sort_custom(func(a, b): return a[0] > b[0])
	return L.slice(0, n)

## что тяжело внутри списка словарей (войска, люди…): [[КБ, поле, тип, самый тяжёлый id]…]
static func stat_in(L: Variant, n := 6) -> Array:
	var F := {}
	if not (L is Array):
		return []
	for e in L:
		if not (e is Dictionary):
			continue
		for k in e:
			var z := var_to_bytes(e[k]).size()
			if not F.has(k):
				F[k] = [0, type_string(typeof(e[k])), -1.0, 0]
			F[k][0] += z
			if z > F[k][3]:
				F[k][3] = z
				F[k][2] = float(e.get("id", -1))
	var R := []
	for k in F:
		R.append([snappedf(F[k][0] / 1024.0, 0.1), String(k), F[k][1], F[k][2]])
	R.sort_custom(func(a, b): return a[0] > b[0])
	return R.slice(0, n)

## записать o; size — сколько байт
static func write(path: String, o: Dictionary) -> bool:
	var d := pack(o)
	size = d.size()
	return store(path, d)

static func _head_c(path: String) -> Dictionary:
	if not _heads.has(path):
		var d := load_bytes(path)
		_heads[path] = {"has": not d.is_empty(), "h": head_of(d)}
	return _heads[path]

## есть ли сохранение (своё или нет)
static func exists(path: String) -> bool:
	return bool(_head_c(path).has)

## заголовок без разбора всего: {wv, seed, day} или {} — нет или не наше
static func head(path: String) -> Dictionary:
	return _head_c(path).h

## прочитать o (или null)
static func read(path: String) -> Variant:
	return unpack(load_bytes(path))
