class_name WorldData
extends RefCounted
## Мир — то же, что WD в HTML-версии (worldgen.js): клетки 1080×675, у каждой местность, река, дорога, провинция.
## Берётся из выгрузки HTML (art/world.json + world.bin) или строится генератором (WorldGen) по зерну.

const MW := 1080
const MH := 675
const NT := MW * MH
const TS := 8
const WPW := MW * TS
const WPH := MH * TS
# местность (TR в HTML)
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
const WATER: Array[int] = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

var wv := 3
var seed := 0
var sea := 0.0
var ter := PackedByteArray()
var elev := PackedFloat32Array()
var rel := PackedFloat32Array()
var moist := PackedFloat32Array()
var temp := PackedFloat32Array()
var river := PackedByteArray()
var down := PackedInt32Array()
var acc := PackedFloat32Array()
var road := PackedByteArray()
var bridge := PackedByteArray()
var ford := PackedByteArray()
var prov := PackedInt32Array()
var ocean := PackedByteArray()
var lake := PackedByteArray()
var fwd := PackedByteArray()
var dOcean := PackedByteArray()
var main := PackedByteArray()
## провинции: {id, seat, x, y, area, cx, cy, nb: Array, mix: PackedFloat32Array(14), coast, river, villages: Array, name, cul}
var provs: Array = []
## поселения: {id, name, type: capital|castle|town|village, x, y, i, prov, coast}
var setts: Array = []
var lairs: Array = []   # [x, y, i, prov]
var owner := PackedInt32Array()   # держава провинции (−1 — ничья)
var caps: Array = []
var labels: Array = []  # {t, x, y, kind: lake|mount, n}
var rivers: Array = []  # PackedInt32Array клеток от истока к устью
var roads: Array = []   # [уровень, PackedInt32Array клеток]
var ms := 0
var tt := {}
## для карты: палитры, цвета, державы, спрайты карты и поселений (из world.json)
var meta := {}


## Загрузка выгрузки HTML: оглавление и списки в world.json, массивы клеток — gzip-куски world.bin (и world_ref.bin).
static func load_export(dir: String, with_ref := false) -> WorldData:
	var js: Variant = JSON.parse_string(FileAccess.get_file_as_string(dir + "/world.json"))
	if typeof(js) != TYPE_DICTIONARY:
		return null
	var W := WorldData.new()
	W.wv = int(js.wv)
	W.seed = int(js.seed)
	W.sea = JSM.f64(js.sea)
	var bins := {"": FileAccess.get_file_as_bytes(dir + "/world.bin")}
	if with_ref and FileAccess.file_exists(dir + "/world_ref.bin"):
		bins["ref"] = FileAccess.get_file_as_bytes(dir + "/world_ref.bin")
	for k: String in js.arrays:
		var a: Array = js.arrays[k]
		var src: String = a[4] if a.size() > 4 else ""
		if not bins.has(src):
			continue
		var raw: PackedByteArray = bins[src].slice(int(a[2]), int(a[2]) + int(a[3])).decompress(int(a[1]), FileAccess.COMPRESSION_GZIP)
		match String(a[0]):
			"u8": W.set(k, raw)
			"i32": W.set(k, raw.to_int32_array())
			"f32": W.set(k, raw.to_float32_array())
	for P: Dictionary in js.provs:
		var q := {"id": int(P.id), "seat": int(P.seat), "x": int(P.x), "y": int(P.y), "area": int(P.area), "cx": JSM.f64(P.cx), "cy": JSM.f64(P.cy),
			"nb": P.nb.map(func(v): return int(v)), "mix": Marshalls.base64_to_raw(P.mix).to_float32_array(), "coast": int(P.coast), "river": int(P.river),
			"villages": P.villages.map(func(v): return int(v)), "name": P.name, "cul": P.cul}
		W.provs.append(q)
	for s: Dictionary in js.setts:
		W.setts.append({"id": int(s.id), "name": s.name, "type": s.type, "x": int(s.x), "y": int(s.y), "i": int(s.i), "prov": int(s.prov), "coast": int(s.coast)})
	for l: Array in js.lairs:
		W.lairs.append([int(l[0]), int(l[1]), int(l[2]), int(l[3])])
	W.owner = PackedInt32Array(js.owner)
	W.caps = js.caps.map(func(v): return int(v))
	for L: Dictionary in js.labels:
		W.labels.append({"t": L.t, "x": JSM.f64(L.x), "y": JSM.f64(L.y), "kind": L.kind, "n": int(L.n)})
	for r: Array in js.rivers:
		W.rivers.append(PackedInt32Array(r))
	for r: Array in js.roads:
		W.roads.append([int(r[0]), PackedInt32Array(r.slice(1))])
	W.meta = load_meta(js)
	return W


## Отрисовочная часть выгрузки (не зависит от зерна): палитры TPAL, цвета, REALM_DEF, спрайты карты и поселений.
static func load_meta(js: Variant = null) -> Dictionary:
	if js == null:
		js = JSON.parse_string(FileAccess.get_file_as_string("res://art/world.json"))
	var m := {}
	for k in ["tpal", "cols", "rwid", "realms", "tinfo", "mspr", "msprq", "sett", "crown"]:
		if js.has(k):
			m[k] = js[k]
	return m


## Отпечатки частей мира (SHA-256): для сверки Godot-генератора с HTML. Одинаковые отпечатки — одинаковый мир.
func digest() -> Dictionary:
	var o := {}
	for k in ["ter", "elev", "rel", "moist", "temp", "river", "down", "acc", "road", "bridge", "ford", "prov", "ocean", "lake", "fwd", "dOcean", "main"]:
		var v: Variant = get(k)
		var b: PackedByteArray
		match typeof(v):
			TYPE_PACKED_BYTE_ARRAY: b = v
			TYPE_PACKED_INT32_ARRAY: b = (v as PackedInt32Array).to_byte_array()
			TYPE_PACKED_FLOAT32_ARRAY: b = (v as PackedFloat32Array).to_byte_array()
		if b.is_empty():
			continue
		o[k] = _sha(b)
	var pi := PackedInt32Array()
	var pf := PackedFloat64Array()
	var names := PackedStringArray()
	for P: Dictionary in provs:
		pi.append_array([P.id, P.seat, P.x, P.y, P.area, P.coast, P.river, P.nb.size()])
		pi.append_array(PackedInt32Array(P.nb))
		pi.append(P.villages.size())
		pi.append_array(PackedInt32Array(P.villages))
		pf.append(P.cx)
		pf.append(P.cy)
		for t in 14:
			pf.append(P.mix[t])
		names.append(String(P.name) + "/" + String(P.cul))
	o.provs = _sha(pi.to_byte_array() + pf.to_byte_array() + "|".join(names).to_utf8_buffer())
	var si := PackedInt32Array()
	var sn := PackedStringArray()
	for s: Dictionary in setts:
		si.append_array([s.id, s.x, s.y, s.i, s.prov, s.coast])
		sn.append(String(s.type) + ":" + String(s.name))
	o.setts = _sha(si.to_byte_array() + "|".join(sn).to_utf8_buffer())
	var li := PackedInt32Array()
	for l: Array in lairs:
		li.append_array(l)
	o.lairs = _sha(li.to_byte_array())
	o.owner = _sha(owner.to_byte_array() + PackedInt32Array(caps).to_byte_array())
	var lf := PackedFloat64Array()
	var ln := PackedStringArray()
	for L: Dictionary in labels:
		lf.append(L.x)
		lf.append(L.y)
		ln.append(String(L.t) + ":" + String(L.kind) + ":" + str(L.n))
	o.labels = _sha(lf.to_byte_array() + "|".join(ln).to_utf8_buffer())
	var ri := PackedInt32Array()
	for r: PackedInt32Array in rivers:
		ri.append(r.size())
		ri.append_array(r)
	o.rivers = _sha(ri.to_byte_array())
	var di := PackedInt32Array()
	for r: Array in roads:
		di.append(r[0])
		di.append(r[1].size())
		di.append_array(r[1])
	o.roads = _sha(di.to_byte_array())
	var sb := PackedFloat64Array([sea])
	o.sea = _sha(sb.to_byte_array())
	return o


static func _sha(b: PackedByteArray) -> String:
	var h := HashingContext.new()
	h.start(HashingContext.HASH_SHA256)
	if not b.is_empty():
		h.update(b)
	return h.finish().hex_encode().substr(0, 16)
