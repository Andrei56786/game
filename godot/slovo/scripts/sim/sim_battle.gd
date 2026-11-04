class_name SimBattle
## Бой (battle.js и battlesim.js): поле боя, строи, полки и воеводы, расстановка; ход боя — приказы гонцами, сигналы,
## обзор, движение, рукопашная, стрельба, дух, гибель полководцев. Тактика воевод, ИИ полководца, бой без экрана и итоги —
## в SimCapt (captains.js). Состояние боя не входит в G: поле, отряды, полки и сам бой — классы с полями (быстрее словарей);
## всё, что попадает в G (воеводы войск, итоги боя), — как в JS, до последнего знака. Случайности — тот же Sim.R.

const CELL := 4.0
const FSZ := {"S": [640.0, 272.0], "M": [800.0, 384.0], "L": [960.0, 480.0]}
const OPEN := 0
const FOREST := 1
const WATER := 2
const FORD := 3
const MARSH := 4
const WALL := 5
const GATE := 6
const BRIDGE := 7
const ROAD := 8
const TR_GRASS := 4
const TR_FARM := 5
const TR_FOREST := 6
const TR_DFOREST := 7
const TR_HILLS := 8
const TR_MOUNT := 9
const TR_MARSH := 11
const BN8X := [1, -1, 0, 0, 1, 1, -1, -1]
const BN8Y := [0, 0, 1, -1, 1, -1, 1, -1]
const MW := WorldData.MW

# размер поля (BF.W, BF.H, BCW, BCH в JS — общие для всех боёв: useField перед каждым шагом)
static var BW := 640.0
static var BH := 272.0
static var BCW := 160
static var BCH := 68


class BFld:
	var g := PackedByteArray()
	var hgt := PackedByteArray()
	var base := 4
	var rv: Variant = null        # {x} — река, {wall} — стена; иначе null
	var tile := 0
	var siege := false
	var temp := 0.0
	var W := 640.0
	var H := 272.0
	var size := "S"
	var defSide := -1
	var forest: Array = [null, null]
	var forestPos: Variant = null
	var dfc := {}


## отряд (блок) на поле; поля, которых в JS сначала нет, — со значениями, дающими то же поведение
class BU:
	var id := 0
	var side := 0
	var type := ""
	var men := 0.0
	var men0 := 0.0
	var mor0 := 0.0
	var morale := 0.0
	var fat := 0.0
	var xp := 0.0
	var x := 0.0
	var y := 0.0
	var face := 0.0
	var order: Variant = null     # {k, x, y, f, dis, vmax, t, pur} или null
	var state := "idle"
	var ammo := 0.0
	var cd := 0.0
	var contact: Array[BU] = []
	var ch := 0.0
	var gen := false
	var routT := 0.0
	var hidden := false
	var kills := 0.0
	var lastHit := -9.0
	var lastArr := -9.0
	var lastShot := -9.0
	var shots := 0.0
	var reg := "C":
		set(v):
			reg = v
			regI = SimBattle.REGI[v]
	var regI := 0                 # номер полка в REGK
	var form := "line":           # с множителями строя (FORMS) — чтобы не искать в словаре на каждом шаге
		set(v):
			form = v
			var f: Dictionary = SimBattle.FORMS[v]
			fSp = f.sp
			fAtk = f.atk
			fDef = f.def
			fArr = f.arr
			fFr = f.fr
			fR = f.r
	var formTo := "":             # null в JS — пустая строка
		set(v):
			formTo = v
			ftSp = SimBattle.FORMS[v].sp if v != "" else 1.0
	var fSp := 1.0
	var fAtk := 1.0
	var fDef := 1.0
	var fArr := 1.0
	var fFr := 1.0
	var fR := 1.0
	var ftSp := 1.0
	var formT := 0.0
	var formLock := false
	var man := false
	var sx := 0.0
	var sy := 0.0
	var pend: Variant = null      # {at, ord}
	var pendF: Variant = null     # {at, f, lock}
	var tx := 0.0
	var ty := 0.0
	var wantF: Variant = null     # число или null (undefined)
	var wp: Variant = null        # {t, tx, ty, p}
	var hrT := 0.0
	var harT := 0.0               # (u.harT || -9): 0 — ещё не было
	var meleeT := 0.0
	var recoil := 0.0             # 0 — нет (в JS undefined)
	var shy := 0.0
	var atkN := 0
	var rallied := false
	var fled := false
	var recover := false
	var ladders := false
	var h11 := 0.0                # JSM.hash2(id, 1, 1): куда отклоняется бегущий
	# постоянное для рода войск (UNIT, UST, MOUNTED, RANGED) — чтобы не искать в словарях на каждом шаге
	var U: Dictionary
	var ust := 0.0
	var mounted := false
	var ranged := false
	var charger := false
	var uatk := 0.0
	var udef := 0.0
	var uhp := 1.0
	var urng := 150.0             # UNIT.rng || 150
	var ucd := 0.0
	var disc0 := 1.0              # (55 / UNIT.mor) ** 1.5
	# путевая точка (u.wp в JS): когда и к какой цели проложена, куда идти (null — прямо)
	var wpOn := false
	var wpT := 0.0
	var wpTx := 0.0
	var wpTy := 0.0
	var wpP: Variant = null


class BReg:
	var side := 0
	var k := "C"
	var cmd: Variant = null       # воевода: {n, t, mar, tr, gen, ch, alive, away, fate, up, ref, cul, age, seed}
	var order := {"k": "hold"}
	var pend: Variant = null
	var then := "adv"
	var ax := 0.0
	var ay := 0.0
	var af := 0.0
	var thinkT := 0.0
	var lead := -1
	var engT := 0.0
	var cur := "hold"
	var fl := 0
	var vmin := 12.0
	var backTo: Variant = null
	var lastT: Variant = null
	var tgt := -1


class Bat:
	var F: BFld
	var units: Array[BU] = []
	var t := 0.0
	var phase := "deploy"
	var sides: Array = []
	var fx: Array = []
	var arrows: Array = []
	var couriers: Array = []
	var dead: Array = []
	var over: Variant = null
	var sel: Array = []
	var selRegs: Array = []
	var speed := 1.0
	var log: Array = []
	var aiT: Array = [0.5, 0.5]
	var o: Dictionary = {}
	var tile := 0
	var bmax := 40.0
	var regs: Array = [{}, {}]
	var tpl: Array = ["std", "std"]
	var ghost: Array = [[], []]   # по номеру отряда: {x, y, t, type, men, reg, face} или null
	var visT := 0.0
	var sigT: Array = [-99.0, -99.0]
	var rallyT: Array = [-99.0, -99.0]
	var stance: Array = ["hold", "hold"]
	var tl := 360.0
	var ai: Array = [true, true]
	var cam := {"x": 0.0, "y": 0.0}
	var stat := {}
	var vis: Array = []
	var scout: Array = [0.0, 0.0]
	var headless := false
	var genU: Array = [null, null]
	var lostF: Variant = null
	var lfT := 0.0
	var stT := 0.0
	var weather: Variant = null
	var pursuit := 0.0
	var snd: Array = []           # звуки для экрана боя (Snd.sfx)
	var gOpen: Array = [false, false]   # местность сторон (sides[s].ground): open, contentious, death — раз на бой
	var gCont: Array = [false, false]
	var gDeath: Array = [false, false]
	var res: Variant = null       # итог для экрана (B.res)


## разорвать взаимные ссылки отрядов (contact), чтобы бой освободился из памяти
static func freeBattle(B: Bat) -> void:
	for u: BU in B.units:
		u.contact.clear()
	B.genU = [null, null]




static func useField(F: BFld) -> void:
	if F != null and F.W != 0.0:
		BW = F.W
		BH = F.H
		BCW = int(F.W / CELL)
		BCH = int(F.H / CELL)


static func fieldSizeFor(men: float) -> String:
	return "L" if men > 1900 else ("M" if men > 760 else "S")


static func _cnt(cnt: Dictionary, k: int) -> float:
	return float(cnt.get(k, 0))


## поле боя вокруг клетки tile: холмы, леса, болота, дорога, река с бродами или мостом, стена при осаде
static func bField(tile: int, o: Dictionary) -> BFld:
	var G := Sim.G
	var W := Sim.W
	var sz := "S"
	if o.get("size") is String and FSZ.has(o.size):
		sz = o.size
	var F := BFld.new()
	F.W = FSZ[sz][0]
	F.H = FSZ[sz][1]
	useField(F)
	var rng := JS.Rng.new(int(tile * 31 + G.day * 7 + 5))
	var g := PackedByteArray()
	g.resize(BCW * BCH)
	g.fill(0)
	var hgt := PackedByteArray()
	hgt.resize(BCW * BCH)
	hgt.fill(0)
	var x0 := tile % MW
	var y0 := tile / MW
	var cnt := {}
	var river := 0
	var bridge := 0
	var ford := 0
	var road := 0
	var RX := 3 if sz == "S" else 4
	var RY := 2 if sz == "S" else 3
	for dy in range(-RY, RY + 1):
		for dx in range(-RX, RX + 1):
			var x := x0 + dx
			var y := y0 + dy
			if not SimDay.inMap(x, y):
				continue
			var i := y * MW + x
			var T := int(W.ter[i])
			cnt[T] = int(cnt.get(T, 0)) + 1
			if absi(dx) <= 1 and absi(dy) <= 1:
				if W.river[i]:
					river = maxi(river, int(W.river[i]))
				if W.bridge[i]:
					bridge = 1
				if W.ford[i]:
					ford = 1
			if W.road[i]:
				road = 1
	var ar := BW * BH / (640.0 * 272.0)
	var nF := minf(JS.rnd(5 * ar), JS.rnd((_cnt(cnt, TR_FOREST) + _cnt(cnt, TR_DFOREST) * 1.4) / 5))
	var nH := minf(JS.rnd(3 * ar), JS.rnd((_cnt(cnt, TR_HILLS) + _cnt(cnt, TR_MOUNT) * 1.5) / 6))
	var nM := minf(JS.rnd(3 * ar), JS.rnd(_cnt(cnt, TR_MARSH) / 5))
	if not JS.t(o.get("siege")):
		if nH == 0 and rng.f() < 0.45:
			nH = 1
		if nF == 0 and (_cnt(cnt, TR_FOREST) + _cnt(cnt, TR_DFOREST) + _cnt(cnt, TR_GRASS) + _cnt(cnt, TR_FARM)) > 0 and rng.f() < 0.4:
			nF = 1
		if JS.t(o.get("ambush")) and nF == 0:
			nF = 1
	var k := 0
	while k < nH:
		var cx := rng.i(25, BCW - 25)
		var cy := rng.i(12, BCH - 12)
		var rx := rng.i(14, 26)
		var ry := rng.i(9, 16)
		_blob(g, hgt, tile, cx, cy, rx, ry, 0)
		k += 1
	k = 0
	while k < nF:
		var cx := rng.i(int(BCW * 0.3), int(BCW * 0.42)) if k == 0 and JS.t(o.get("ambush")) else rng.i(10, BCW - 10)
		var cy := rng.i(6, BCH - 6)
		var rx := rng.i(7, 16)
		var ry := rng.i(5, 11)
		_blob(g, hgt, tile, cx, cy, rx, ry, 1)
		k += 1
	k = 0
	while k < nM:
		var cx := rng.i(30, BCW - 30)
		var cy := rng.i(8, BCH - 8)
		var rx := rng.i(8, 14)
		var ry := rng.i(5, 9)
		_blob(g, hgt, tile, cx, cy, rx, ry, 2)
		k += 1
	if road:
		var y := rng.i(BCH * 0.3, BCH * 0.7)
		for x in BCW:
			y += (JSM.hash2(x, 3, tile) - 0.5) * 1.2
			y = JS.clp(y, 4, BCH - 5)
			for kk in range(-1, 1):
				var i := int(JS.rnd(y) + kk) * BCW + x
				if g[i] != WATER:
					g[i] = ROAD
	var rv: Variant = null
	if river and not JS.t(o.get("siege")):
		rv = {"x": BCW / 2.0 + rng.i(-8, 8)}
		var wid := 2.0 + river
		var fy := [rng.i(8, int(BCH * 0.45)), rng.i(int(BCH * 0.55), BCH - 8)]
		if not ford and not bridge and rng.f() < 0.5:
			fy.pop_back()
		for y in BCH:
			var cx: float = rv.x + sin(y * 0.12 + tile) * 5
			var x := int(floorf(cx - wid))
			var x1 := int(ceilf(cx + wid))
			while x <= x1:
				if x >= 0 and x < BCW:
					var i := y * BCW + x
					var fi := -1
					for q in fy.size():
						if absf(y - fy[q]) <= 3:
							fi = q
							break
					g[i] = (BRIDGE if bridge and fi == 0 else FORD) if fi >= 0 else WATER
					hgt[i] = 0
				x += 1
	if JS.t(o.get("siege")):
		var wx := BCW - 40
		for y in BCH:
			for x in range(wx, wx + 3):
				var i := y * BCW + x
				g[i] = GATE if absf(y - BCH / 2.0) < 4 else WALL
				hgt[i] = 2
		for y in BCH:
			for x in range(wx + 3, BCW):
				var i := y * BCW + x
				if g[i] == FOREST or g[i] == MARSH:
					g[i] = 0
				hgt[i] = 1
		rv = {"wall": float(wx)}
	var ks: Array = cnt.keys()
	ks.sort()
	var land := []
	for t in ks:
		if not JS.t(Sim.TINFO[t].get("water")):
			land.append(t)
	JS.sort(land, func(a, b): return _cnt(cnt, b) - _cnt(cnt, a))
	F.g = g
	F.hgt = hgt
	F.base = TR_GRASS if land.is_empty() else int(land[0])
	F.rv = rv
	F.tile = tile
	F.siege = JS.t(o.get("siege"))
	F.temp = W.temp[tile]
	F.size = sz
	return F


## пятно на поле (холм, лес, болото): kind 0 — высота, 1 — лес, 2 — болото, где нет ничего другого
static func _blob(g: PackedByteArray, hgt: PackedByteArray, tile: int, cx: float, cy: float, rx: float, ry: float, kind: int) -> void:
	var y := int(maxf(0, cy - ry - 3))
	var y1 := minf(BCH, cy + ry + 3)
	while y < y1:
		var x := int(maxf(0, cx - rx - 3))
		var x1 := minf(BCW, cx + rx + 3)
		while x < x1:
			var qx := (x - cx) / rx
			var qy := (y - cy) / ry
			var d := qx * qx + qy * qy + (JSM.hash2(x, y, tile) - 0.5) * 0.35
			if d < 1:
				var i := y * BCW + x
				if kind == 0:
					hgt[i] = maxi(hgt[i], 3 if d < 0.3 else (2 if d < 0.62 else 1))
				elif kind == 1:
					g[i] = FOREST
				elif g[i] == 0:
					g[i] = MARSH
			x += 1
		y += 1


static func cellAt(x: float, y: float) -> int:
	var cx := clampi(int(floorf(x / CELL)), 0, BCW - 1)
	var cy := clampi(int(floorf(y / CELL)), 0, BCH - 1)
	return cy * BCW + cx


static func passCell(F: BFld, i: int, u: BU) -> bool:
	var k := F.g[i]
	if k == WATER:
		return false
	if k == WALL:
		return u.side == F.defSide or (u.ladders and not u.mounted)
	return true


## расстояния по полю до клетки tc (поиск в ширину, 8 соседей; cls 1 — через стены можно); последние 48 — в запасе
static func distField(F: BFld, tc: int, cls: int) -> PackedInt32Array:
	var key := tc * 2 + cls
	if F.dfc.has(key):
		return F.dfc[key]
	var n := BCW * BCH
	var d := PackedInt32Array()
	d.resize(n)
	d.fill(-1)
	var q := PackedInt32Array()
	q.resize(n)
	var g := F.g
	var h := 0
	var t := 0
	d[tc] = 0
	q[t] = tc
	t += 1
	var W1 := BCW - 1
	var H1 := BCH - 1
	while h < t:
		var i := q[h]
		h += 1
		var x := i % BCW
		var y := i / BCW
		var nd := d[i] + 1
		var x0 := -1 if x > 0 else 0
		var x1 := 1 if x < W1 else 0
		var yy := -1 if y > 0 else 0
		var y1 := 1 if y < H1 else 0
		while yy <= y1:
			var row := i + yy * BCW
			var xx := x0
			while xx <= x1:
				var j := row + xx
				if d[j] < 0:
					var k := g[j]
					if k != WATER and (k != WALL or cls == 1):
						d[j] = nd
						q[t] = j
						t += 1
				xx += 1
			yy += 1
	if F.dfc.size() > 48:
		F.dfc.erase(F.dfc.keys()[0])
	F.dfc[key] = d
	return d


static func lineClear(F: BFld, u: BU, x0: float, y0: float, x1: float, y1: float) -> bool:
	var n := ceilf(JS.hypot(x1 - x0, y1 - y0) / 3)
	var k := 1.0
	while k <= n:
		if not passCell(F, cellAt(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n), u):
			return false
		k += 1
	return true


## путь в обход воды и стен: точка, куда идти сейчас (null — прямая свободна)
static func steerPoint(F: BFld, u: BU, tx: float, ty: float) -> Variant:
	if lineClear(F, u, u.x, u.y, tx, ty):
		return null
	var cls := 1 if (u.side == F.defSide or (u.ladders and not u.mounted)) else 0
	var df := distField(F, cellAt(tx, ty), cls)
	var c := cellAt(u.x, u.y)
	var best: Variant = null
	for k in 14:
		var x := c % BCW
		var y := c / BCW
		var nb := -1
		var bd := float(df[c]) if df[c] >= 0 else 1e9
		for m in 8:
			var X: int = x + BN8X[m]
			var Y: int = y + BN8Y[m]
			if X < 0 or Y < 0 or X >= BCW or Y >= BCH:
				continue
			var j := Y * BCW + X
			if df[j] >= 0 and df[j] < bd:
				bd = df[j]
				nb = j
		if nb < 0:
			break
		c = nb
		var px := (c % BCW) * CELL + 2
		var py := (c / BCW) * CELL + 2
		if k < 2 or lineClear(F, u, u.x, u.y, px, py):
			best = [px, py]
		else:
			break
	return best


## лес в своей зоне расстановки, где спрячется полк (засада)
static func findForest(F: BFld, side: int) -> Variant:
	var z := deployZoneF(F, side)
	var best: Variant = null
	var bs := -1e9
	var cy := 6
	while cy < BCH - 6:
		var cx := 4
		while cx < BCW - 4:
			var x := cx * CELL + 2
			var y := cy * CELL + 2
			if x < z[0] + 20 or x > z[1] + 24 or F.g[cy * BCW + cx] != FOREST:
				cx += 2
				continue
			var n := 0
			for dy in range(-3, 4):
				for dx in range(-3, 4):
					if F.g[(cy + dy) * BCW + cx + dx] == FOREST:
						n += 1
			if n >= 26:
				var s := n * 2 - absf(y - BH / 2) * 0.35 - absf(x - (z[1] if side == 0 else z[0])) * 0.25
				if s > bs:
					bs = s
					best = [x, y]
			cx += 2
		cy += 2
	return best


static func deployZoneF(F: BFld, side: int) -> Array:
	var z: float = F.rv.wall * CELL - 30 if F.siege else JS.rnd(F.W * 0.38)
	return [14.0, z] if side == 0 else [F.W - z, F.W - 14]


# ---------- строи ----------
const FORMS := {
	"line": {"n": "Строй", "sp": 1.0, "atk": 1.0, "def": 1.0, "arr": 1.0, "fr": 1.0, "r": 1.0},
	"close": {"n": "Стена щитов", "sp": 0.6, "atk": 0.9, "def": 1.35, "arr": 0.55, "fr": 0.9, "r": 0.85},
	"loose": {"n": "Рассыпной", "sp": 1.1, "atk": 0.75, "def": 0.7, "arr": 0.45, "fr": 0.8, "r": 1.3},
	"wedge": {"n": "Клин", "sp": 1.05, "atk": 1.25, "def": 0.85, "arr": 1.1, "fr": 0.85, "r": 0.95},
	"square": {"n": "Ёж", "sp": 0.0, "atk": 0.85, "def": 1.2, "arr": 1.3, "fr": 0.6, "r": 0.9},
	"column": {"n": "Колонна", "sp": 1.35, "atk": 0.7, "def": 0.7, "arr": 1.2, "fr": 0.55, "r": 0.9},
}
const FORMK := ["line", "close", "loose", "wedge", "square", "column"]
const FORM_OK := {"levy": ["line", "loose", "square", "column"], "spear": ["line", "close", "square", "column"], "sword": ["line", "close", "wedge", "column"],
	"archer": ["line", "loose", "column"], "xbow": ["line", "close", "loose", "column"], "horse": ["line", "wedge", "loose", "column"],
	"harch": ["loose", "line", "column"], "knight": ["wedge", "line", "column"]}


static func formName(t: String, k: String) -> String:
	return "Павезы" if t == "xbow" and k == "close" else FORMS[k].n


static func setForm(B: Bat, u: BU, k: String, lock: Variant = null) -> bool:
	if not FORM_OK[u.type].has(k):
		return false
	if lock != null:
		u.formLock = JS.t(lock)
	if B.phase == "deploy":
		u.form = k
		u.formTo = ""
		return true
	if (u.formTo if u.formTo != "" else u.form) == k:
		return true
	if u.form == k:
		u.formTo = ""
		return true
	u.formTo = k
	u.formT = B.t + (3.0 if k == "square" else 2.2) * (1.25 - u.xp / 250) * (1.35 if u.type == "levy" else 1.0) * (1.6 if u.contact.size() else 1.0)
	return true


# ---------- полки и воеводы ----------
const REGK := ["C", "R", "L", "V", "S"]
const REGI := {"C": 0, "R": 1, "L": 2, "V": 3, "S": 4}
const REGN := {"C": "Большой полк", "R": "Полк правой руки", "L": "Полк левой руки", "V": "Передовой полк", "S": "Засадный полк"}
const REGS := {"C": "Большой", "R": "Правой руки", "L": "Левой руки", "V": "Передовой", "S": "Засадный"}
const ORDN := {"hold": "Стоять", "adv": "Наступать", "flank": "Обход", "skirm": "Перестрелка", "wait": "Ждать сигнала", "pursue": "Преследовать", "back": "Отход", "auto": "На усмотрение", "move": "Идут", "attack": "Атакуют", "reserve": "В резерве"}
const CAPT_T := ["Воевода", "Хирдман", "Капитан", "Брат", "Кентарх", "Сотник", "Атаман"]
const CAPT_POOL := ["brave", "brave", "cautious", "cautious", "reckless", "craven"]


static func mkCaptain(realm: Variant, rng: JS.Rng = null) -> Dictionary:
	if rng == null:
		rng = Sim.R
	var r := 6 if realm == null or float(realm) < 0 or float(realm) > 6 else int(realm)
	var cul: String = Sim.REALM_DEF[r].key
	var c := {"n": Sim.pickName(cul, 0, rng), "t": CAPT_T[r]}
	c.mar = rng.i(2, 8) if r == 6 else rng.i(3, 11)
	c.tr = [rng.pick(CAPT_POOL)] if rng.f() < 0.55 else []
	c.xp = 0.0
	c.age = rng.i(22, 50)
	c.seed = rng.i(1, 1e9)
	c.cul = cul
	return c


## у двух воевод одного войска не бывает одного имени
static func uniqCapts(L: Array, taken: Array, rng: JS.Rng = null) -> Array:
	var used := {}
	for n in taken:
		used[n] = true
	for c in L:
		var k := 0
		while used.has(c.n) and k < 10:
			k += 1
			c.n = Sim.pickName(String(c.cul) if JS.t(c.get("cul")) else "K", 0, rng if rng != null else Sim.R)
		used[c.n] = true
	return L


static func ensureCapts(a: Dictionary) -> Array:
	var L := []
	for c in (a.capts if JS.t(a.get("capts")) else []):
		if JS.t(c) and not JS.t(c.get("dead")):
			L.append(c)
	a.capts = L
	while L.size() < 4:
		L.append(mkCaptain(a.realm))
	var g: Variant = Sim.charOf(a.gen) if a.has("gen") and a.gen != null and a.gen >= 0 else null
	return uniqCapts(L, [g.name] if g != null else [])


static func hasTr(c: Variant, t: String) -> bool:
	return c != null and JS.t(c.get("tr")) and (c.tr as Array).has(t)


static func mkReg(side: int, k: String) -> BReg:
	var g := BReg.new()
	g.side = side
	g.k = k
	g.then = "auto" if k == "S" else "adv"
	g.af = PI if side else 0.0
	g.thinkT = Sim.R.f() * 1.2
	return g


static func latS(side: int) -> float:
	return 1.0 if side == 0 else -1.0


static func slotOf(g: BReg, u: BU) -> Array:
	var c := cos(g.af)
	var s := sin(g.af)
	return [g.ax + c * u.sx - s * u.sy, g.ay + s * u.sx + c * u.sy]


static func setSlot(g: BReg, u: BU) -> void:
	var dx := u.x - g.ax
	var dy := u.y - g.ay
	var c := cos(g.af)
	var s := sin(g.af)
	u.sx = dx * c + dy * s
	u.sy = -dx * s + dy * c


static func regUnits(B: Bat, side: int, k: String, all := false) -> Array:
	var r := []
	for u in B.units:
		if u.side == side and u.reg == k and u.men > 0.5 and u.state != "gone" and (all or u.state != "rout"):
			r.append(u)
	return r


static func leadOf(B: Bat, g: BReg) -> BU:
	if g == null or g.lead < 0:
		return null
	var u: BU = B.units[g.lead] if g.lead < B.units.size() else null
	return u if u != null and bAlive(u) and u.state != "rout" else null


static func cmdOk(g: BReg) -> Variant:
	return g.cmd if g != null and g.cmd != null and JS.t(g.cmd.get("alive")) and not JS.t(g.cmd.get("away")) else null


const LEADP := {"knight": 0, "sword": 1, "horse": 2, "spear": 3, "levy": 4, "xbow": 5, "archer": 6, "harch": 7}


## первый после устойчивой сортировки по роду (LEADP) и числу людей (больше — раньше)
static func pickLead(us: Array) -> BU:
	var best: BU = us[0]
	for i in range(1, us.size()):
		var u: BU = us[i]
		var d: int = LEADP[u.type] - LEADP[best.type]
		if d < 0 or (d == 0 and best.men - u.men < 0):
			best = u
	return best


static func genOf(B: Bat, side: int) -> BU:
	for x in B.units:
		if x.side == side and x.gen and bAlive(x):
			return x
	return null


# ---------- расстановка ----------
const BORD := ["sword", "spear", "levy", "knight", "horse", "harch", "archer", "xbow"]
const UST := {"levy": 13.0, "spear": 12.0, "sword": 11.0, "archer": 13.0, "xbow": 12.0, "horse": 26.0, "harch": 28.0, "knight": 21.0}


static func mkBlocks(B: Bat, side: int, S: Dictionary, bmax: float) -> void:
	var mor := (25.0 if S.get("ground") == "death" else 0.0) + (-5.0 if S.get("ground") == "dispersive" else 0.0) + (Sim.traitSum(S.gen, "mor") if S.get("gen") != null else 0.0)
	var xpd: Variant = S.get("xp")
	for t in BORD:
		var n := JS.rnd(JS.n(S.u.get(t)))
		if n <= 0:
			continue
		var parts := maxf(1, ceilf(n / bmax))
		var k := 0.0
		while k < parts:
			var m := JS.rnd(n * (k + 1) / parts) - JS.rnd(n * k / parts)
			k += 1
			if m <= 0:
				continue
			var u := BU.new()
			u.id = B.units.size()
			u.h11 = JSM.hash2(u.id, 1, 1)
			u.side = side
			u.type = t
			u.men = m
			u.men0 = m
			var xv := JS.n(xpd.get(t)) if JS.t(xpd) else 0.0
			u.morale = JS.clp(S.morale + mor + (Sim.UNIT[t].mor - 55) * 0.5 + xv * 0.15, 10, 100)
			u.fat = JS.n(S.get("fat"))
			u.xp = xv
			u.face = 0.0 if side == 0 else PI
			u.U = Sim.UNIT[t]
			u.ust = UST[t]
			u.mounted = Sim.T.MOUNTED.has(t) and JS.t(Sim.T.MOUNTED[t])
			u.ranged = Sim.T.RANGED.has(t) and JS.t(Sim.T.RANGED[t])
			u.charger = t == "horse" or t == "knight"
			var U: Dictionary = u.U
			u.uatk = U.atk
			u.udef = U.def
			u.uhp = U.hp
			u.urng = U.rng if JS.t(U.get("rng")) else 150.0
			u.ucd = JS.n(U.get("cd"))
			u.disc0 = pow(55.0 / U.mor, 1.5)
			u.ammo = (S.ammo if JS.t(S.get("ammo")) else 30.0) if u.ranged else 0.0
			u.cd = Sim.R.f() * 2
			u.form = "loose" if t == "harch" else "line"
			B.units.append(u)


## полки (большой, правой и левой руки, передовой, засадный) и их места по замыслу tpl
static func deployRegs(B: Bat, side: int, tpl: String) -> void:
	useField(B.F)
	var F := B.F
	var us := []
	for u in B.units:
		if u.side == side and bAlive(u):
			us.append(u)
	if us.is_empty():
		return
	var regs: Dictionary = B.regs[side]
	for u in us:
		u.hidden = false
		u.man = false
		u.order = null
		u.pend = null
		u.state = "idle"
		u.formLock = false
		u.form = "loose" if u.type == "harch" else "line"
		u.formTo = ""
	if F.siege and side == F.defSide:
		B.tpl[side] = "wall"
		siegeDeploy(B, side)
		assignLeads(B, side)
		initOrders(B, side)
		return
	if tpl == "amb" and F.forest[side] == null:
		tpl = "std"
	if tpl == "":
		tpl = "std"
	B.tpl[side] = tpl
	var dir := 1.0 if side == 0 else -1.0
	var a0 := 0.0 if side == 0 else PI
	var lat := latS(side)
	var midY := BH / 2
	var qual := {"sword": 3.0, "spear": 2.0, "levy": 1.0}
	var inf := []
	for u in us:
		if qual.has(u.type):
			inf.append(u)
	var isDef := tpl == "def"
	JS.sort(inf, func(a, b):
		var d := ((-1.0 if a.type == "spear" else 0.0) - (-1.0 if b.type == "spear" else 0.0)) if isDef else 0.0
		if d != 0:
			return d
		d = qual[b.type] - qual[a.type]
		if d != 0:
			return d
		return b.men - a.men)
	var L := {"C": [], "R": [], "L": [], "V": [], "S": []}
	var share := {"C": 0.3, "R": 0.35, "L": 0.35} if tpl == "cres" else {"C": 0.5, "R": 0.25, "L": 0.25}
	if inf.size() <= 2:
		L.C = inf.duplicate()
	else:
		for u in inf:
			var best := "C"
			var bd := -1e9
			var n: float = L.C.size() + L.R.size() + L.L.size() + 1
			for k in (["R", "L", "C"] if tpl == "cres" else ["C", "R", "L"]):
				var d: float = share[k] * n - L[k].size()
				if d > bd + 1e-6:
					bd = d
					best = k
			L[best].append(u)
	L.V = _byType(us, "archer") + _byType(us, "xbow")
	var hs := _byType(us, "horse")
	var kn := _byType(us, "knight")
	var ha := _byType(us, "harch")
	if tpl == "amb":
		L.S = kn + hs
	else:
		L.S = kn.duplicate()
		var wing := hs.duplicate()
		if kn.is_empty() and wing.size() >= 3:
			L.S.append(wing.pop_back())
		for i in wing.size():
			L["L" if i % 2 else "R"].append(wing[i])
	for i in ha.size():
		L["L" if i % 2 else "R"].append(ha[i])
	for k in REGK:
		for u in L[k]:
			u.reg = k
	L.L.reverse()
	var sp := 2 * bRadN(B.bmax) + 5
	var avail := BH - 40
	var per := {"C": maxf(1, L.C.size()), "R": maxf(1, L.R.size()), "L": maxf(1, L.L.size())}
	var wid := func(k: String) -> float: return minf(per[k], L[k].size()) * sp if L[k].size() else 0.0
	var gi := 0
	while gi < 40 and wid.call("C") + wid.call("R") + wid.call("L") + 16 > avail and maxf(per.C, maxf(per.R, per.L)) > 1:
		var kk := "C"
		for k in ["R", "L"]:
			if wid.call(k) > wid.call(kk):
				kk = k
		per[kk] -= 1
		gi += 1
	var z := deployZoneF(F, side)
	var bx: float = JS.rnd(z[1] * 0.62) if side == 0 else BW - JS.rnd((BW - z[0]) * 0.62)
	var T: Dictionary = {"std": {"C": 0, "R": 0, "L": 0, "V": 50, "S": -64}, "def": {"C": 0, "R": -22, "L": -22, "V": -38, "S": -70},
		"amb": {"C": 0, "R": 0, "L": 0, "V": 50, "S": 0}, "wedge": {"C": -12, "R": -14, "L": -14, "V": -48, "S": 40},
		"cres": {"C": -28, "R": 28, "L": 28, "V": 46, "S": -68}}[tpl]
	var wC: float = wid.call("C")
	var wR: float = wid.call("R")
	var wL: float = wid.call("L")
	var anch := {"C": [T.C, 0.0], "R": [T.R, wC / 2 + (8 + wR / 2 if wR else 0.0)], "L": [T.L, -(wC / 2 + (8 + wL / 2 if wL else 0.0))], "V": [T.V, 0.0], "S": [T.S, 0.0]}
	for k in REGK:
		var g: BReg = regs[k]
		var A: Array = anch[k]
		g.af = a0
		g.ax = bx + dir * A[0]
		g.ay = midY + lat * A[1]
		var list: Array = L[k]
		if list.is_empty():
			continue
		if k == "S" and tpl == "amb":
			var fp: Array = F.forest[side]
			g.ax = fp[0]
			g.ay = fp[1]
			for i in list.size():
				var u: BU = list[i]
				var r := floorf(i / 2.0)
				var c := i % 2
				u.x = fp[0] - dir * r * sp * 0.8
				u.y = fp[1] + (c - 0.5) * sp * 0.8 * (1.0 if list.size() > 1 else 0.0)
				u.hidden = true
			continue
		var pr: float = maxf(1, floorf(avail / (sp * 1.15))) if k == "V" else (maxf(2, ceilf(list.size() / 2.0)) if k == "S" else per[k])
		var gap := sp * 1.15 if k == "V" else sp
		for i in list.size():
			var u: BU = list[i]
			var r := floorf(i / pr)
			var n := minf(pr, list.size() - r * pr)
			var c := i - r * pr
			var sx := -r * sp * 0.95
			var sy := (c - (n - 1) / 2) * gap
			u.x = g.ax + dir * sx - 0 * sy
			u.y = g.ay + lat * sy
	for u in us:
		u.x = JS.clp(u.x, 16, BW - 16)
		u.y = JS.clp(u.y, 16, BH - 16)
		u.face = a0
		var n := 0
		while not passCell(F, cellAt(u.x, u.y), u) and n < 40:
			n += 1
			u.x -= dir * 4
	if tpl == "def":
		for u in us:
			if u.reg == "C" and (u.type == "spear" or u.type == "sword"):
				u.form = "close"
	if tpl == "wedge":
		for u in us:
			if u.reg == "S" and FORM_OK[u.type].has("wedge"):
				u.form = "wedge"
	for k in REGK:
		for u in us:
			if u.reg == k:
				setSlot(regs[k], u)
	assignLeads(B, side)
	initOrders(B, side)


static func _byType(us: Array, t: String) -> Array:
	var r := []
	for u in us:
		if u.type == t:
			r.append(u)
	return r


static func siegeDeploy(B: Bat, side: int) -> void:
	var us := []
	for u in B.units:
		if u.side == side and bAlive(u):
			us.append(u)
	var wx: float = B.F.rv.wall * CELL
	var regs: Dictionary = B.regs[side]
	var shoot := []
	var inf := []
	var cav := []
	for u in us:
		if u.ranged and u.type != "harch":
			shoot.append(u)
	for u in us:
		if not u.mounted and not shoot.has(u):
			inf.append(u)
		if u.mounted:
			cav.append(u)
	for k in shoot.size():
		var u: BU = shoot[k]
		u.reg = "V"
		u.x = wx + 6
		u.y = 40 + (k + 0.5) * (BH - 80) / maxf(1, shoot.size())
	for k in inf.size():
		var u: BU = inf[k]
		u.reg = "C"
		u.x = wx + 40 + (k % 2) * 30
		u.y = 40 + (k + 0.5) * (BH - 80) / maxf(1, inf.size())
	for k in cav.size():
		var u: BU = cav[k]
		u.reg = "S"
		u.x = minf(BW - 16, wx + 100)
		u.y = BH / 2 + (k - (cav.size() - 1) / 2.0) * 30
	for k in REGK:
		var g: BReg = regs[k]
		g.af = PI
		g.ax = wx + 6 if k == "V" else (minf(BW - 16, wx + 100) if k == "S" else wx + 50)
		g.ay = BH / 2
	for u in us:
		u.face = PI
		setSlot(regs[u.reg], u)


## полководец едет с лучшим отрядом большого полка, каждый воевода — с лучшим отрядом своего
static func assignLeads(B: Bat, side: int) -> void:
	var s: Dictionary = B.sides[side]
	for u in B.units:
		if u.side == side:
			u.gen = false
	for k in REGK:
		var g: BReg = B.regs[side][k]
		var us := regUnits(B, side, k)
		g.lead = pickLead(us).id if us.size() else -1
	if s.get("gen") != null and not JS.t(s.get("genFate")):
		var C: BReg = B.regs[side].C
		var gu: BU = B.units[C.lead] if C.lead >= 0 else null
		if gu == null:
			var any := []
			for u in B.units:
				if u.side == side and bAlive(u):
					any.append(u)
			gu = pickLead(any) if any.size() else null
			if gu != null:
				C.lead = gu.id
		if gu != null:
			gu.gen = true


static func initOrders(B: Bat, side: int) -> void:
	var tpl: String = B.tpl[side]
	var ai: bool = B.ai[side]
	var F := B.F
	for k in REGK:
		var g: BReg = B.regs[side][k]
		var o: String
		if F.siege:
			o = "hold" if side == F.defSide else ("adv" if ai else "hold")
		elif ai:
			o = "wait" if k == "S" and tpl == "amb" else "auto"
		else:
			o = ("hold" if tpl == "def" or tpl == "wedge" else "skirm") if k == "V" else (("hold" if tpl == "wedge" else "wait") if k == "S" else "hold")
		g.order = {"k": o}
		g.cur = o
		g.then = "auto" if k == "S" else "adv"
		g.pend = null
		g.fl = 0
		g.backTo = null


static func aiTemplate(B: Bat, side: int) -> String:
	var F := B.F
	var s: Dictionary = B.sides[side]
	var o: Dictionary = B.sides[1 - side]
	if F.siege:
		return "std"
	var ratio := SimDay.powerU(s.u, s.xp) / maxf(1, SimDay.powerU(o.u, o.xp))
	var g: Variant = s.get("gen")
	var mar: float = g.mar if g != null else 4.0
	var men := maxf(1, Sim.menOf(s.u))
	var kn := JS.n(s.u.get("knight")) / men
	var cav := Sim.mountedN(s.u) / men
	var rng := JS.Rng.new(int(B.tile * 7 + side * 13 + Sim.G.day))
	var tr := func(t: String) -> bool: return g != null and (g.traits as Array).has(t)
	if F.forest[side] != null and cav > 0.1 and (tr.call("cunning") or tr.call("cautious") or rng.f() < 0.2 + mar * 0.02):
		return "amb"
	if ratio < 0.8 or (tr.call("cautious") and ratio < 1.1):
		return "def"
	if kn > 0.08 and (tr.call("reckless") or tr.call("brave") or rng.f() < 0.4):
		return "wedge"
	if ratio > 1.35 and mar >= 8 and rng.f() < 0.6:
		return "cres"
	return "std"


static func scoutQ(s: Dictionary) -> float:
	var men := maxf(1, Sim.menOf(s.u))
	var lc := (JS.n(s.u.get("horse")) + JS.n(s.u.get("harch")) * 1.4) / men
	return minf(0.55, lc * 3) + 0.08 + (s.gen.mar * 0.02 + Sim.traitSum(s.gen, "scout") * 0.1 if s.get("gen") != null else 0.0)


## A, Bs: {u, xp, morale, fat, gen (человек), ammo, realm, name, capts…}; o: {size, siege, works, ambush, amb, tplA, tplB, ai, sett}
static func setupBattle(A: Dictionary, Bs: Dictionary, tile: int, o: Dictionary = {}) -> Bat:
	var menA := Sim.menOf(A.u)
	var menB := Sim.menOf(Bs.u)
	var size: String = o.size if o.get("size") is String and FSZ.has(o.size) else fieldSizeFor(menA + menB)
	var fo := o.duplicate()
	fo.size = size
	var F := bField(tile, fo)
	F.defSide = 1 if JS.t(o.get("siege")) else -1
	F.forest = [findForest(F, 0), findForest(F, 1)]
	F.forestPos = F.forest[0]
	var B := Bat.new()
	B.F = F
	B.sides = [A, Bs]
	for k in 2:
		var gk: Variant = B.sides[k].get("ground")
		B.gOpen[k] = gk == "open"
		B.gCont[k] = gk == "contentious"
		B.gDeath[k] = gk == "death"
	B.o = o
	B.tile = tile
	B.bmax = JS.clp(JS.rnd(maxf(menA, menB) / 9), 40, 150)
	B.tl = {"S": 360.0, "M": 480.0, "L": 600.0}[size]
	B.ai = o.ai if o.get("ai") is Array else [true, true]
	B.stat = {"mel": [0.0, 0.0], "pur": [0.0, 0.0], "sht": [0.0, 0.0], "chg": [0.0, 0.0], "flk": [0.0, 0.0], "ff": [0.0, 0.0]}
	for side in [0, 1]:
		for k in REGK:
			B.regs[side][k] = mkReg(side, k)
		mkBlocks(B, side, B.sides[side], B.bmax)
	var nu := B.units.size()
	for side in 2:
		var v := PackedByteArray()
		v.resize(nu)
		v.fill(0)
		B.vis.append(v)
		var gh := []
		gh.resize(nu)
		B.ghost[side] = gh
	for side in [0, 1]:
		var s: Dictionary = B.sides[side]
		var caps: Array = (s.capts as Array).duplicate() if JS.t(s.get("capts")) else []
		var ci := 0
		for k in REGK:
			var g: BReg = B.regs[side][k]
			if k == "C" and s.get("gen") != null:
				var gn: Dictionary = s.gen
				g.cmd = {"n": gn.name, "t": gn.get("title") if JS.t(gn.get("title")) else "", "mar": gn.mar, "tr": gn.traits, "gen": 1.0, "ch": gn, "alive": 1.0}
			else:
				var c: Variant = caps[ci] if ci < caps.size() else null
				ci += 1
				g.cmd = {"n": c.n, "t": c.t, "mar": c.mar, "tr": c.tr, "ref": c, "alive": 1.0, "cul": c.cul, "age": c.age, "seed": c.seed} if c != null else null
	deployRegs(B, 0, String(o.tplA) if JS.t(o.get("tplA")) else (aiTemplate(B, 0) if B.ai[0] else "std"))
	deployRegs(B, 1, String(o.tplB) if JS.t(o.get("tplB")) else aiTemplate(B, 1))
	for u in B.units:
		var c: Variant = B.regs[u.side][u.reg].cmd
		if hasTr(c, "brave"):
			u.morale = minf(100, u.morale + 4)
		if hasTr(c, "craven"):
			u.morale -= 4
	if JS.t(o.get("siege")):
		for u in B.units:
			if u.side == 0:
				u.ladders = JS.n(o.get("works")) >= 1
	B.scout = [scoutQ(A) + (0.6 if JS.t(o.get("amb")) else 0.0), scoutQ(Bs) - (0.5 if JS.t(o.get("amb")) else 0.0)]
	return B


# ---------- ход боя (battlesim.js) ----------
const ARM := {"levy": [1.0, 1.0], "spear": [0.8, 0.95], "sword": [0.55, 0.85], "archer": [1.0, 1.0], "xbow": [0.9, 0.95], "horse": [0.95, 0.95], "harch": [1.0, 1.0], "knight": [0.45, 0.8]}
const SHOT := {"archer": {"hit": 0.3, "wet": 0.6, "vol": 1.0}, "xbow": {"hit": 0.42, "wet": 0.8, "vol": 1.45}, "harch": {"hit": 0.3, "wet": 0.6, "vol": 1.0}}


## Math.hypot из V8 (как JSM.hypot) — здесь, чтобы не звать через два класса
static func hyp(a: float, b: float) -> float:
	a = absf(a)
	b = absf(b)
	var m := a if a > b else b
	if m == 0.0:
		return 0.0
	var n0 := a / m
	var n1 := b / m
	return sqrt(n0 * n0 + n1 * n1) * m


static func bAlive(u: BU) -> bool:
	return u.men > 0.5 and u.state != "gone"


static func bRadN(m: float) -> float:
	return 6 + sqrt(m) * 0.9


static func bRad(u: BU) -> float:
	return (6 + sqrt(u.men) * 0.9) * u.fR


## дисциплина: (55 / дух рода)^1.5 — в отряде (disc0)
static func DISC(u: BU, q: float) -> float:
	return u.disc0 * (1 - u.xp / 300) / (q if q != 0.0 else 1.0)


## рука воеводы: умелый заставляет полк драться крепче и стоять дольше, сильнее всего — где едет сам
static func capQ(B: Bat, u: BU) -> float:
	var g: BReg = B.regs[u.side][u.reg]
	var c: Variant = cmdOk(g)
	if c == null:
		return 0.88
	var L := leadOf(B, g)
	var near := L != null and absf(L.x - u.x) < 120 and hyp(L.x - u.x, L.y - u.y) < 120
	return 1 + (c.mar - 5) * (0.03 if near else 0.015)


static func terrMul(F: BFld, u: BU) -> float:
	var k := F.g[cellAt(u.x, u.y)]
	if k == FOREST:
		return (0.4 if u.type == "knight" else 0.45) if u.mounted else 0.65
	if k == MARSH:
		return 0.4 if u.mounted else 0.5
	if k == FORD:
		return 0.45
	if k == WALL:
		return 0.4
	if k == ROAD:
		return 1.1
	return 1.0


static func bSpeed(F: BFld, u: BU, Wt: Dictionary) -> float:
	var f: float = minf(u.fSp, u.ftSp) * 0.5 if u.formTo != "" else u.fSp
	return u.ust * f * terrMul(F, u) * (1 - u.fat / 250) * (0.85 if JS.t(Wt.get("cold")) else 1.0)


static func bRange(B: Bat, u: BU) -> float:
	var h := B.F.hgt[cellAt(u.x, u.y)]
	var r := u.urng + h * 12
	var Wt: Dictionary = B.weather if B.weather != null else Sim.weatherOf()
	if Wt.vis < 0.6:
		r *= 0.65
	return r


static func bsay(B: Bat, x: float, y: float, t: String, c := "#f7d35c") -> void:
	if B.headless:
		return
	B.fx.append({"k": "txt", "x": x, "y": y, "t": t, "c": c, "t0": B.t})
	B.log.append({"t": B.t, "s": t, "c": c, "x": x, "y": y})
	if B.log.size() > 40:
		B.log.pop_front()


## звук боя (Snd.sfx в HTML) — экран заберёт из B.snd
static func sfx(B: Bat, k: String) -> void:
	if not B.headless:
		B.snd.append(k)


## приказ отряду: везёт гонец от полководца (приказы игрока и полководцев); воеводы свои отдают сразу
static func courierDelay(B: Bat, u: BU, show: bool) -> float:
	var g := genOf(B, u.side)
	if g != null and g.id == u.id:
		return 0.1
	var d := hyp(g.x - u.x, g.y - u.y) if g != null else 300.0
	var sg: Variant = B.sides[u.side].get("gen")
	var sk: float = sg.mar if sg != null else 5.0
	var delay := (0.3 + d / 140) * (1.0 if g != null else 2.0) * (1.15 - sk * 0.015)
	if g != null and show:
		B.couriers.append({"x0": g.x, "y0": g.y, "u": u.id, "t0": B.t, "t1": B.t + delay, "side": u.side})
	return delay


static func issue(B: Bat, u: BU, ord: Dictionary, delay: Variant = null) -> void:
	if B.phase == "deploy":
		bApply(B, u, ord)
		return
	if delay == null:
		delay = courierDelay(B, u, true)
	u.pend = {"at": B.t + delay, "ord": ord}


## смена строя — тоже с гонцом (f null: пусть воевода выбирает снова)
static func issueForm(B: Bat, u: BU, f: Variant, lock: Variant = null) -> void:
	if B.phase == "deploy":
		if JS.t(f):
			setForm(B, u, f, lock)
		else:
			u.formLock = false
		return
	u.pendF = {"at": B.t + courierDelay(B, u, u.pend == null), "f": f, "lock": lock}


static func bApply(B: Bat, u: BU, ord: Dictionary) -> void:
	u.order = ord
	if ord.k == "move":
		u.tx = ord.x
		u.ty = ord.y
	if u.state == "idle" or u.state == "move":
		u.state = "move"
	if (u.form == "square" or u.formTo == "square") and (ord.k == "move" or ord.k == "attack"):
		u.formLock = false
		setForm(B, u, "line")


## свой приказ воеводы отряду полка (без гонца); повторы пропускает
static func cmd(B: Bat, u: BU, ord: Dictionary) -> void:
	var o: Variant = u.order
	if o != null and o.k == ord.k:
		if ord.k == "attack" and o.get("t") == ord.get("t"):
			return
		if ord.k == "move" and hyp(o.x - ord.x, o.y - ord.y) < 8 and JS.t(o.get("dis")) == JS.t(ord.get("dis")):
			o.vmax = ord.get("vmax")
			o.f = ord.get("f")
			return
	if o == null and ord.k == "move" and hyp(u.x - ord.x, u.y - ord.y) < 5:
		if ord.get("f") != null:
			u.wantF = ord.f
		return
	bApply(B, u, ord)


## приказ полку: гонец скачет от полководца к воеводе полка
static func issueReg(B: Bat, g: BReg, ord: Dictionary) -> void:
	if B.phase == "deploy":
		setRegOrder(B, g, ord)
		return
	var side := g.side
	var gu := genOf(B, side)
	var L := leadOf(B, g)
	if L == null:
		var ru := regUnits(B, side, g.k)
		L = ru[0] if ru.size() else null
	if L == null:
		setRegOrder(B, g, ord)
		return
	var sg: Variant = B.sides[side].get("gen")
	var sk: float = sg.mar if sg != null else 5.0
	var d := hyp(gu.x - L.x, gu.y - L.y) if gu != null else 300.0
	var delay := (0.3 + d / 140) * (1.0 if gu != null else 2.0) * (1.15 - sk * 0.015)
	if gu != null and gu.reg == g.k:
		delay = 0.15
	if gu != null and gu != L and delay > 0.2:
		B.couriers.append({"x0": gu.x, "y0": gu.y, "u": L.id, "t0": B.t, "t1": B.t + delay, "side": side, "reg": g.k})
	g.pend = {"at": B.t + delay, "ord": ord}


static func setRegOrder(B: Bat, g: BReg, ord: Dictionary) -> void:
	g.order = ord.duplicate()
	g.fl = 0
	g.backTo = null
	g.thinkT = minf(g.thinkT, 0.25)
	var us := regUnits(B, g.side, g.k)
	if ord.get("x") != null and (ord.k == "move" or ord.k == "hold"):
		if ord.get("f") != null:
			g.af = ord.f
		g.ax = ord.x
		g.ay = ord.y
		if ord.k == "hold" and JS.t(ord.get("re")):
			for u: BU in us:
				setSlot(g, u)
	if ord.k != "wait":
		for u: BU in us:
			u.man = false
	if B.phase == "deploy":
		g.cur = ord.k


## рог: полки, ждущие сигнала, бьют разом
static func bSignal(B: Bat, side: int) -> int:
	if B.t - B.sigT[side] < 2:
		return 0
	var n := 0
	for k in REGK:
		var g: BReg = B.regs[side][k]
		if g.order.k == "wait" and regUnits(B, side, k).size():
			setRegOrder(B, g, {"k": g.then if g.then != "" else "auto"})
			n += 1
	if n:
		B.sigT[side] = B.t
		var gu := genOf(B, side)
		if gu == null:
			for u: BU in B.units:
				if u.side == side and bAlive(u):
					gu = u
					break
		if gu != null:
			bsay(B, gu.x, gu.y - 30, "Сигнал! Засадный полк — вперёд!" if side == 0 else "Враг трубит в рог!", "#f7d35c" if side == 0 else "#ffb4a8")
		sfx(B, "horn")
	return n


## полководец объезжает строй: дрогнувшие крепнут, часть бегущих возвращается
static func rally(B: Bat, side: int) -> bool:
	var gu := genOf(B, side)
	if gu == null or B.t - B.rallyT[side] < 30 or gu.state == "rout":
		return false
	B.rallyT[side] = B.t
	var sg: Variant = B.sides[side].get("gen")
	var mar: float = sg.mar if sg != null else 5.0
	var R0 := 90 + mar * 4
	for u: BU in B.units:
		if u.side != side or not bAlive(u) or hyp(u.x - gu.x, u.y - gu.y) > R0:
			continue
		if u.state == "rout":
			if u.men > u.men0 * 0.15 and Sim.R.f() < 0.35 + mar * 0.04:
				u.state = "idle"
				u.order = null
				u.man = false
				u.morale = maxf(u.morale, 30 + mar)
				bsay(B, u.x, u.y - 20, "Вернулись!", "#9fe07a")
		else:
			u.morale = minf(100, u.morale + 8 + mar)
	bsay(B, gu.x, gu.y - 30, ("Король" if side == 0 and JS.t(B.sides[0].get("king")) else "Полководец") + ": «За мной!»", "#fff2c8")
	sfx(B, "horn_short")
	return true


static func enemyOf(B: Bat, u: BU, maxD := 0.0) -> BU:
	var best: BU = null
	var bd := maxD if maxD != 0.0 else 1e9
	var V: PackedByteArray = B.vis[u.side]
	for v: BU in B.units:
		if v.side == u.side or not (v.men > 0.5 and v.state != "gone") or v.state == "rout":
			continue
		if not V[v.id]:
			continue
		var dx := v.x - u.x
		var dy := v.y - u.y
		if absf(dx) >= bd or absf(dy) >= bd:     # hypot не меньше большего из катетов — дальше не ближе
			continue
		var d := hyp(dx, dy)
		if d < bd:
			bd = d
			best = v
	return best


static func angDiff(a: float, b: float) -> float:
	var d := a - b
	while d > PI:
		d -= TAU
	while d < -PI:
		d += TAU
	return d


## кто кого видит: в поле далеко, лес прячет всех, кроме ближних, засада видна, лишь когда уже поздно
static func updateVis(B: Bat) -> void:
	var us := B.units
	var F := B.F
	var Wt: Dictionary = B.weather if B.weather != null else Sim.weatherOf()
	var n := us.size()
	var sight := PackedFloat64Array()
	sight.resize(n)
	var alive := PackedByteArray()
	alive.resize(n)
	for i in n:
		var u: BU = us[i]
		if u.men > 0.5 and u.state != "gone":
			alive[i] = 1
			sight[i] = (330 * Wt.vis + F.hgt[cellAt(u.x, u.y)] * 30) * (1.1 if u.mounted else 1.0)
		else:
			alive[i] = 0
			sight[i] = 0.0
	for side in 2:
		var V: PackedByteArray = B.vis[side]
		var gh: Array = B.ghost[side]
		for v: BU in us:
			if v.side == side:
				continue
			var s := 0
			var va := alive[v.id] == 1
			if va:
				if v.contact.size() and _anySide(v.contact, side) or (B.phase == "deploy" and not v.hidden and B.scout[side] >= 0.25):
					s = 1
				else:
					var inF := F.g[cellAt(v.x, v.y)] == FOREST
					var lim := 46.0 if v.hidden else ((140.0 if B.t - v.lastShot < 2 else 54.0) if inF else 1e9)
					for u: BU in us:
						if u.side != side or alive[u.id] == 0:
							continue
						var d := hyp(u.x - v.x, u.y - v.y)
						if d < lim and d < sight[u.id]:
							s = 1
							break
			if V[v.id] and not s and va:
				gh[v.id] = {"x": v.x, "y": v.y, "t": B.t, "type": v.type, "men": v.men, "reg": v.reg, "face": v.face}
			if s or not va:
				gh[v.id] = null
			V[v.id] = s


static func _anySide(L: Array, side: int) -> bool:
	for c: BU in L:
		if c.side == side:
			return true
	return false


static func _aliveSide(us: Array, s: int) -> bool:
	for u: BU in us:
		if u.side == s and u.men > 0.5 and u.state != "gone" and u.state != "rout":
			return true
	return false


static func _pwSide(us: Array, s: int) -> float:
	var a := 0.0
	for u: BU in us:
		a += u.men * (u.uatk + u.udef) * (0.5 + u.morale / 200) if u.side == s and u.men > 0.5 and u.state != "gone" and u.state != "rout" else 0.0
	return a


## отряд по номеру (B.units[i] в JS; нет такого — null)


static func _ui(B: Bat, i: Variant) -> BU:
	if i == null:
		return null
	var k := int(i)
	return B.units[k] if k >= 0 and k < B.units.size() else null

