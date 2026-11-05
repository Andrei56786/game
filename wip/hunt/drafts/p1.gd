extends RefCounted
## Королевская охота (hunt.js, hunt2.js, hunt3.js; бросок зверя — hurt.js): лес за восточными воротами — ловчий, гончие, спутник;
## лук, сулицы, рогатина и сокол. Дичь пасётся на полянах, чует короля по ветру (ветер всегда с запада), настораживается, убегает,
## подранок оставляет кровь и залегает; гончие гонят и держат зверя; кабан и медведь бросаются — отскочить или принять на рогатину.
## Свой прицел (hunt3.js): зажать левую кнопку — натянуть лук, навести, отпустить; стрелы летят по-настоящему, втыкаются в землю
## и в деревья, их подбирают. Ловчий может уйти с гончими к дальней поляне и протрубить, подняв зверя (G). Итоги — мясо в погреба,
## шкуры в казну, престиж, трофеи и рекорды двора, белый олень. Без охоты лес живёт тихим набором дичи (huntFauna('')).
## Случайности — randf (не зерно королевства); время — c.t (NOW в HTML).
const Hurt = preload("res://scripts/court_hurt.gd")
const CT := 16
const HUNTK := {
	"deer": {"n": "Гон оленя", "d": "Гончие поднимут оленя и погонят его. Стреляйте, когда собаки остановят зверя, — но вплотную к оленю у бая не подходите: бьёт рогами."},
	"boar": {"n": "Охота на кабана", "d": "Кабан бросается, если подойти близко, а раненый — почти всегда. Нужно несколько стрел или рогатина. Опасно — зато какая слава!"},
	"falcon": {"n": "Соколиная охота", "d": "Сокол бьёт фазанов, уток и зайцев. Спокойная забава — и любимая при дворе."},
}
## hp (hunt3.js), скорость бегства, чутьё, размер (к меткости), мясо (меры в погреба), шкура (золото), престиж; имена на 1 / 2–4 / 5+
const GAME := {
	"deer": {"hp": 2.0, "sp": 112.0, "det": 120.0, "sz": 0.0, "meat": 30, "fur": 0, "pr": 2, "n": "олень", "n2": "оленя", "n5": "оленей"},
	"doe": {"hp": 1.5, "sp": 108.0, "det": 125.0, "sz": 0.0, "meat": 22, "fur": 0, "pr": 0, "n": "лань", "n2": "лани", "n5": "ланей", "f": 1},
	"boar": {"hp": 4.0, "sp": 92.0, "det": 85.0, "sz": 0.02, "meat": 35, "fur": 0, "pr": 2, "n": "кабан", "n2": "кабана", "n5": "кабанов", "fierce": 1},
	"bear": {"hp": 7.0, "sp": 78.0, "det": 95.0, "sz": 0.08, "meat": 50, "fur": 10, "pr": 4, "n": "медведь", "n2": "медведя", "n5": "медведей", "fierce": 1},
	"wolf": {"hp": 2.0, "sp": 108.0, "det": 135.0, "sz": -0.04, "meat": 0, "fur": 5, "pr": 1, "n": "волк", "n2": "волка", "n5": "волков"},
	"fox": {"hp": 1.0, "sp": 104.0, "det": 100.0, "sz": -0.12, "meat": 0, "fur": 6, "pr": 0, "n": "лиса", "n2": "лисы", "n5": "лис", "f": 1},
	"hare": {"hp": 1.0, "sp": 122.0, "det": 70.0, "sz": -0.15, "meat": 3, "fur": 0, "pr": 0, "n": "заяц", "n2": "зайца", "n5": "зайцев", "zig": 1},
	"pheasant": {"hp": 1.0, "sp": 30.0, "det": 58.0, "sz": -0.15, "meat": 2, "fur": 0, "pr": 0, "n": "фазан", "n2": "фазана", "n5": "фазанов", "bird": 1},
	"duck": {"hp": 1.0, "sp": 20.0, "det": 80.0, "sz": -0.15, "meat": 2, "fur": 0, "pr": 0, "n": "утка", "n2": "утки", "n5": "уток", "f": 1, "bird": 1, "swim": 1},
}
const HWPN := {"bow": {"n": "лук", "act": "Выстрелить", "rng": 150.0}, "jav": {"n": "сулицы", "act": "Метнуть сулицу", "rng": 85.0}, "pike": {"n": "рогатина", "act": "Ударить рогатиной", "rng": 30.0}}
const HWPN_ORD := ["bow", "jav", "pike"]
## свой лук (hunt3.js): натяг до полного, дальность без натяга / прибавка за полный, скорость, разброс
const HBOW := {"bow": {"tf": 0.75, "r0": 70.0, "r1": 190.0, "v0": 240.0, "v1": 260.0, "sp": 1.0}, "jav": {"tf": 0.5, "r0": 45.0, "r1": 85.0, "v0": 170.0, "v1": 110.0, "sp": 1.3}}
const GACC := {"doe": "лань", "fox": "лису", "duck": "утку"}
const DIRV := {"left": [-1.0, 0.0], "right": [1.0, 0.0], "up": [0.0, -1.0], "down": [0.0, 1.0]}
const SEATS := ["marshal", "chancellor", "eye", "treasurer", "seneschal", "magister", "justice"]

var c: Node2D
var HU: Variant = null       # COURT.hunt — охота идёт (только пока длится, в сохранение не идёт)
var flash := -10.0           # COURT.flash: белая вспышка — удар зверя, шальная стрела
var pend: Variant = null     # HEAL.pend: {t, f} — «Беда на охоте» через 2,2 с после удара
var hart_f := false          # COURT.hartF: белый олень наверняка (для проверок)
var hold_t := -1.0           # левая кнопка зажата над лесом с этого времени (input.down[0].t); -1 — отпущена
var hold_used := false       # md.hunt: это нажатие уже натянуло лук

func _init(court: Node2D) -> void:
	c = court

static func _k() -> Dictionary:
	return SimPlayer.kingC()

static func _day() -> float:
	return float(Game.day)

func _P() -> Dictionary:
	return c.king

func _L() -> Dictionary:
	return c.D["locs"]["forest"]

static func gk(a: Dictionary) -> String:
	return "doe" if a["kind"] == "deer" and a["col"] == "doe" else String(a["kind"])

static func game_of(a: Dictionary) -> Dictionary:
	return GAME.get(gk(a), GAME["hare"])

static func _pick(arr: Array) -> Variant:
	return arr[randi() % arr.size()]

static func ucf(s: String) -> String:
	return s if s.is_empty() else s.substr(0, 1).to_upper() + s.substr(1)

static func poods(n: int) -> String:
	return str(n) + " " + Sim.plural(n, "пуд", "пуда", "пудов")

static func tines(n: int) -> String:
	return str(n) + " " + Sim.plural(n, "отросток", "отростка", "отростков")

static func g_acc(k: String) -> String:
	return GACC.get(k, GAME[k]["n2"])

static func dist(a: Dictionary, b: Dictionary) -> float:
	return Vector2(float(a["x"]) - float(b["x"]), float(a["y"]) - float(b["y"])).length()

func _hn() -> Dictionary:
	return c.npc_by("srv_hunter")

func _say(n: Dictionary, s: String, dur: float) -> void:
	if not n.is_empty():
		c.people.say(n, s, dur)

static func _bub(n: Dictionary) -> bool:
	return String(n.get("bub", "")) != ""

func _toast(s: String) -> void:
	c.hud.toast(s)

static func face_to(o: Dictionary, dx: float, dy: float) -> void:
	o["dir"] = ("right" if dx > 0 else "left") if absf(dx) > absf(dy) else ("down" if dy > 0 else "up")

func now() -> float:
	return c.t

func on() -> bool:
	return HU != null and not JS.t(HU.get("ended"))

func in_forest() -> bool:
	return c.loc_id == "forest"

func _wk() -> String:
	return String(Sim.G["weather"]["k"]) if not Sim.G.is_empty() else String(c.D.get("weather", {}).get("k", "clear"))

## ветер (windX): сильнее при ветре и метели, слабее в тишь
func wind_x() -> float:
	var k := _wk()
	return 2.2 if k == "wind" or k == "blizzard" else 1.6 if k == "storm" else 0.6

static func bag_str(bag: Array) -> String:
	var cnt := {}
	var order: Array = []
	for b in bag:
		if not cnt.has(b.k):
			order.append(b.k)
		cnt[b.k] = int(cnt.get(b.k, 0)) + 1
	var out: Array = []
	for k in order:
		var g: Dictionary = GAME[k]
		var n: int = cnt[k]
		out.append(String(g.n) if n == 1 else str(n) + " " + Sim.plural(n, g.n, g.n2, g.n5))
	return ", ".join(out)

static func dir_word(dx: float, dy: float) -> String:
	var a := int(roundf(atan2(dy, dx) / (PI / 4.0)))
	return ["на восток", "на юго-восток", "на юг", "на юго-запад", "на запад", "на северо-запад", "на север", "на северо-восток"][posmod(a + 8, 8)]

func _solid(tx: int, ty: int) -> bool:
	return c.solid_at("forest", tx, ty)

func ani_free(x: float, y: float, a: Variant = null) -> bool:
	var L := _L()
	var tx := floori(x / CT)
	var ty := floori(y / CT)
	if tx < 1 or ty < 1 or tx >= int(L.w) - 1 or ty >= int(L.h) - 1:
		return false
	if a != null and JS.t(a.get("swim")):
		return c.ter_at("forest", tx, ty) == 7
	return not _solid(tx, ty)

func line_free(x0: float, y0: float, x1: float, y1: float) -> bool:
	var n := maxi(1, ceili(Vector2(x1 - x0, y1 - y0).length() / 6.0))
	for i in range(1, n + 1):
		if _solid(floori((x0 + (x1 - x0) * i / n) / CT), floori((y0 + (y1 - y0) * i / n) / CT)):
			return false
	return true

func forest_ani() -> Array:
	var out: Array = []
	for a in c.ani:
		if a["loc"] == "forest" and int(a["game"]) == 1:
			out.append(a)
	return out

func hounds_in_forest() -> Array:
	var out: Array = []
	for h in c.ani:
		if int(h["game"]) == 2 and h["loc"] == "forest":
			out.append(h)
	return out

func any_hound() -> bool:
	for h in c.ani:
		if int(h["game"]) == 2:
			return true
	return false

# ---------- дичь леса: свежий набор на каждую охоту, тихий — без неё (huntFauna; белый олень — hunt2.js; дальние поляны — hunt3.js) ----------
func _add(k: String, ci: int, col: String, n: int, kind: String) -> void:
	var CL: Array = _L()["clearings"]
	var cl: Array = CL[ci]
	var cx: int = cl[0]
	var cy: int = cl[1]
	var g: Dictionary = GAME["doe" if k == "deer" and col == "doe" else k]
	var swim := JS.t(g.get("swim"))
	var r: Array = [cx - 3, cy - 2, cx + 3, cy + 2] if swim else [cx - int(cl[2]) + 1, cy - int(cl[3]) + 1, cx + int(cl[2]) - 1, cy + int(cl[3]) - 1]
	for i in maxi(1, n):
		var a: Dictionary = c.mk_ani(k, "forest", r, 0.0, 0.0, col)
		a["game"] = 1
		a["st"] = "graze"
		a["hp"] = float(g.hp)
		a["swim"] = swim
		if k == "duck":
			a["c"] = _pick(["drake", "hen", "drake", "hen", "hen"])
		for t in 40:
			a["x"] = (r[0] + randf() * (r[2] - r[0] + 1)) * CT
			a["y"] = (r[1] + randf() * (r[3] - r[1] + 1)) * CT
			if ani_free(a.x, a.y, a):
				break
		if ani_free(a.x, a.y, a):
			c.ani.append(a)

func fauna(kind: String) -> void:
	var L := _L()
	if not L.has("clearings"):
		return
	var keep: Array = []
	for a in c.ani:
		if a["loc"] == "forest" and int(a["game"]) == 1:
			if a["node"] != null:
				(a["node"] as Node).queue_free()
		else:
			keep.append(a)
	c.ani = keep
	var snow := Game.season() == 3
	var hunt := kind != ""
	var sn := "snow" if snow else ""
	_add("pheasant", 0, "", 4 if kind == "falcon" else 2 if hunt else 1, kind)
	_add("hare", 0, sn, 2 if kind == "falcon" else 1, kind)
	_add("deer", 1, "", 1, kind)
	_add("deer", 1, "doe", 2 if hunt else 1, kind)
	_add("duck", 2, "", 5 if kind == "falcon" else 3, kind)
	if hunt:
		_add("deer", 2, "", 1, kind)
	_add("boar", 3, "", 3 if kind == "boar" else 2, kind)
	if randf() < 0.3:
		_add("wolf", 4, "", randi_range(2, 3), kind)
	else:
		_add("deer", 4, "doe", 2, kind)
	if kind == "boar":
		_add("boar", 4, "", 1, kind)
	_add("hare", 5, sn, 3 if kind == "falcon" else 2, kind)
	_add("fox", 5, "", 1, kind)
	if kind == "falcon":
		_add("pheasant", 5, "", 2, kind)
	if randf() < 0.12:
		_add("bear", 6, "", 1, kind)
	else:
		_add("deer", 6, "", 1, kind)
		_add("deer", 6, "doe", 1, kind)
	# белый олень (hunt2.js): на гоне оленя — один из оленей подальше от ворот, в десятую долю дней
	if kind == "deer" and HU != null and (hart_f or randf() < 0.1):
		var sp: Dictionary = L["spots"]["f_gate"]
		var best: Variant = null
		var bd := 0.0
		for a in forest_ani():
			if a["kind"] == "deer" and a["col"] == "":
				var d := Vector2(float(a.x) - float(sp.x), float(a.y) - float(sp.y)).length()
				if d > bd:
					bd = d
					best = a
		if best != null:
			best["col"] = "hart"
			best["hart"] = 1
			best["pts"] = _pick([12, 14, 16])
			HU["hart"] = best
	# дальние поляны большого леса (hunt3.js): ольховый овраг, медвежий угол, глухариный бор, старая гарь, лосиная топь
	if (L["clearings"] as Array).size() < 12:
		return
	_add("hare", 7, sn, 3 if kind == "falcon" else 1, kind)
	_add("fox", 7, "", 1, kind)
	_add("pheasant", 7, "", 3 if kind == "falcon" else 1, kind)
	if hunt:
		_add("deer", 7, "doe", 1, kind)
	if randf() < (0.35 if hunt else 0.2):
		_add("bear", 8, "", 1, kind)
	else:
		_add("boar", 8, "", 2, kind)
	_add("deer", 9, "", 1, kind)
	_add("deer", 9, "doe", 2 if hunt else 1, kind)
	_add("pheasant", 9, "", 3 if kind == "falcon" else 1, kind)
	_add("boar", 10, "", 3 if kind == "boar" else 2, kind)
	_add("hare", 10, sn, 1, kind)
	if randf() < 0.4:
		_add("wolf", 11, "", randi_range(2, 3), kind)
	else:
		_add("deer", 11, "doe", 2, kind)
	_add("deer", 11, "", 1, kind)

# ---------- движение: обойти деревья; застрял — путь по клеткам (steer, moveTo) ----------
func steer(a: Dictionary, tx: float, ty: float, sp: float, dt: float, away: bool) -> bool:
	var ang := atan2(float(a.y) - ty, float(a.x) - tx) if away else atan2(ty - float(a.y), tx - float(a.x))
	if JS.t(a.get("zig")):
		ang += sin(now() * 6.0 + float(a.x) * 0.1) * 0.7
	var st := sp * dt
	var sd: float = a.get("side", 1.0)
	for da in [0.0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]:
		var an: float = ang + da * sd
		var cx := cos(an)
		var cy := sin(an)
		var nx: float = float(a.x) + cx * st
		var ny: float = float(a.y) + cy * st
		if ani_free(nx, ny, a) and ani_free(nx + cx * 6.0, ny + cy * 4.0, a):
			a["x"] = nx
			a["y"] = ny
			a["f"] = float(a.f) + st
			if absf(cx) > 0.2:
				a["flip"] = cx > 0
			a["moving"] = true
			return true
	a["side"] = -sd
	a["moving"] = false
	return false

func _path(x0: float, y0: float, tx: float, ty: float) -> Variant:
	var e: Vector2i = c.near_free("forest", floori(tx / CT), floori(ty / CT))
	return c.find_path("forest", Vector2i(floori(x0 / CT), floori(y0 / CT)), e)

func move_to(o: Dictionary, tx: float, ty: float, sp: float, dt: float) -> void:
	var pth: Variant = o.get("pth")
	if pth is Array and not (pth as Array).is_empty():
		var p: Vector2i = pth[0]
		var gx := p.x * CT + 8.0
		var gy := p.y * CT + 10.0
		var dx := gx - float(o.x)
		var dy := gy - float(o.y)
		var d := Vector2(dx, dy).length()
		var st := sp * dt
		if d <= st:
			o["x"] = gx
			o["y"] = gy
			(pth as Array).pop_front()
		else:
			o["x"] = float(o.x) + dx / d * st
			o["y"] = float(o.y) + dy / d * st
			if absf(dx) > 0.5:
				o["flip"] = dx > 0
		o["f"] = float(o.f) + st
		o["moving"] = true
		if now() > float(o.get("pthT", 0.0)):
			o["pth"] = null
		return
	if Vector2(tx - float(o.x), ty - float(o.y)).length() < 3.0:
		o["moving"] = false
		return
	if steer(o, tx, ty, sp, dt, false):
		o["stk"] = 0.0
		return
	o["stk"] = float(o.get("stk", 0.0)) + dt
	if float(o.stk) > 0.5:
		o["stk"] = 0.0
		var p2: Variant = _path(o.x, o.y, tx, ty)
		if p2 is Array and not (p2 as Array).is_empty() and (p2 as Array).size() < 60:
			o["pth"] = p2
			o["pthT"] = now() + 2.5
