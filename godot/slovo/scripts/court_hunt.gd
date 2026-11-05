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

# ---------- повадки дичи: пасётся → настораживается → убегает (или взлетает) → успокаивается; у бая перед гончими; лютые бросаются ----------
## ветер всегда с запада и несёт запах короля на восток (hunt2.js): зверь с подветренной стороны чует издалека
func wind_word() -> String:
	var w := wind_x()
	return "сильный ветер с запада" if w >= 2.0 else "ветер с запада" if w >= 1.0 else "ветерок с запада"

func wind_tip() -> String:
	return ucf(wind_word()) + ": заходите на зверя с востока — не учует."

func wind_mul(a: Dictionary, P: Dictionary) -> float:
	var dx: float = float(a.x) - float(P.x)
	var d := Vector2(dx, float(a.y) - float(P.y)).length()
	if d == 0.0:
		d = 1.0
	return 1.0 + clampf(0.12 + wind_x() * 0.18, 0.2, 0.5) * dx / d

## угроза (huntThreat с ветром hunt2.js): король — если близко и виден, гончая — если рядом; {o, d, king}
func threat(a: Dictionary, P: Dictionary, g: Dictionary) -> Variant:
	var det: float = float(g.det) * wind_mul(a, P) * (1.25 if JS.t(a.get("hart")) else 1.0) * (0.5 if c.sneak else 1.0) * (1.0 if P.moving else 0.7)
	var dk := dist(a, P)
	var thr: Variant = null
	var td := 1e9
	if in_forest() and dk < det and (dk < det * 0.4 or line_free(P.x, float(P.y) - 8.0, a.x, float(a.y) - 4.0)):
		thr = {"o": P, "d": dk, "king": true}
		td = dk
	for h in hounds_in_forest():
		var d := dist(h, a)
		if d < (50.0 if JS.t(g.get("bird")) else 80.0) and d < td:
			thr = {"o": h, "d": d, "king": false}
			td = d
	return thr

func game_flee(a: Dictionary, from: Variant = null) -> void:
	if JS.t(game_of(a).get("bird")):
		bird_up(a, from if from != null else _P())
		return
	if from != null:
		a["fx"] = float(from.x)
		a["fy"] = float(from.y)
	a["st"] = "flee"
	a["ft"] = 0.0
	a["stk"] = 0.0
	a["moving"] = true
	a["zig"] = JS.t(game_of(a).get("zig"))

func game_settle(a: Dictionary) -> void:
	var L := _L()
	a["st"] = "graze"
	a["moving"] = false
	a["zig"] = false
	a["t"] = randf_range(1, 3)
	var tx := floori(float(a.x) / CT)
	var ty := floori(float(a.y) / CT)
	var cl: Variant = null
	for q in L.get("clearings", []):
		if pow((tx - float(q[0])) / float(q[2]), 2) + pow((ty - float(q[1])) / float(q[3]), 2) <= 1.0:
			cl = q
			break
	if cl != null and not JS.t(a.get("swim")):
		a["r"] = [int(cl[0]) - int(cl[2]) + 1, int(cl[1]) - int(cl[3]) + 1, int(cl[0]) + int(cl[2]) - 1, int(cl[1]) + int(cl[3]) - 1]
	elif not JS.t(a.get("swim")):
		a["r"] = [clampi(tx - 3, 1, int(L.w) - 2), clampi(ty - 2, 1, int(L.h) - 2), clampi(tx + 3, 1, int(L.w) - 2), clampi(ty + 2, 1, int(L.h) - 2)]

## бросок (hurt.js): зверь роет землю, потом несётся по прямой; отскочить вбок — или принять на рогатину
func game_charge(a: Dictionary) -> void:
	a["st"] = "charge"
	a["cp"] = "wind"
	a["ct"] = 0.0
	a["cw"] = randf_range(1.1, 1.5) if a["kind"] == "bear" else randf_range(0.85, 1.25)
	a["tried"] = 0
	a["recv"] = 0
	a["moving"] = false
	a["tries"] = int(a.get("tries", 0)) + 1
	Snd.sfx("growl")
	Snd._amb("snort", 1.0, 0.0, 0.0)
	_say(_hn(), _pick(["Медведь встал на дыбы! Берегитесь!", "Сейчас кинется, государь!"] if a["kind"] == "bear" else ["Роет землю — сейчас кинется!", "Берегитесь, государь! Вбок, вбок!"]), 2.5)

func bird_up(a: Dictionary, from: Dictionary) -> void:
	if a["st"] == "dead":
		return
	a["st"] = "fly"
	a["fly"] = 1.0
	a["moving"] = false
	var an := atan2(float(a.y) - float(from.y), float(a.x) - float(from.x)) + randf_range(-0.6, 0.6)
	a["vx"] = cos(an) * 92.0
	a["vy"] = sin(an) * 66.0
	a["flip"] = float(a.vx) > 0
	a["ft"] = randf_range(1.6, 2.6)
	if JS.t(a.get("swim")):
		var cl: Array = _L()["clearings"][2]
		a["pcx"] = float(cl[0]) * CT + 8.0
		a["pcy"] = float(cl[1]) * CT + 8.0
		a["ca"] = atan2(float(a.y) - float(a.pcy), float(a.x) - float(a.pcx))
		a["ft"] = randf_range(2.6, 3.6)
	Snd.sfx("flap")

func bird_fly(a: Dictionary, dt: float) -> void:
	var L := _L()
	a["ft"] = float(a.ft) - dt
	a["f"] = float(a.f) + dt * 40.0
	if JS.t(a.get("swim")):
		if float(a.ft) > 0.0:
			a["ca"] = float(a.ca) + dt * 1.5
			a["x"] = float(a.pcx) + cos(a.ca) * 64.0
			a["y"] = float(a.pcy) + sin(a.ca) * 40.0
			a["flip"] = -sin(a.ca) > 0
			a["h"] = minf(36.0, float(a.h) + 50.0 * dt)
			return
		if float(a.get("lx", 0.0)) == 0.0:
			var r: Array = a.r
			for k in 20:
				var x: float = (r[0] + randf() * (r[2] - r[0] + 1)) * CT
				var y: float = (r[1] + randf() * (r[3] - r[1] + 1)) * CT
				if ani_free(x, y, a):
					a["lx"] = x
					a["ly"] = y
					break
			if float(a.get("lx", 0.0)) == 0.0:
				a["lx"] = a.pcx
				a["ly"] = a.pcy
		var dx: float = float(a.lx) - float(a.x)
		var dy: float = float(a.ly) - float(a.y)
		var d := Vector2(dx, dy).length()
		var st := 70.0 * dt
		a["h"] = maxf(0.0, float(a.h) - 26.0 * dt)
		if d > st:
			a["x"] = float(a.x) + dx / d * st
			a["y"] = float(a.y) + dy / d * st
			a["flip"] = dx > 0
		else:
			a["x"] = a.lx
			a["y"] = a.ly
		if d <= st and float(a.h) <= 0.0:
			a["lx"] = 0.0
			a["fly"] = 0.0
			a["st"] = "graze"
			a["t"] = randf_range(1, 3)
		return
	a["x"] = float(a.x) + float(a.vx) * dt
	a["y"] = float(a.y) + float(a.vy) * dt
	if float(a.x) < 2 * CT or float(a.x) > (int(L.w) - 2) * CT:
		a["vx"] = -float(a.vx)
		a["flip"] = float(a.vx) > 0
	if float(a.y) < 2 * CT or float(a.y) > (int(L.h) - 2) * CT:
		a["vy"] = -float(a.vy)
	if float(a.ft) > 0.0:
		a["h"] = minf(32.0, float(a.h) + 60.0 * dt)
		return
	a["h"] = maxf(0.0, float(a.h) - 40.0 * dt)
	if float(a.h) > 0.0:
		return
	if ani_free(a.x, a.y, a):
		a["fly"] = 0.0
		game_settle(a)
	else:
		a["ft"] = 0.4
		a["h"] = 6.0

func graze_move(a: Dictionary, dt: float) -> void:
	if a["moving"]:
		var dx: float = float(a.tx) - float(a.x)
		var dy: float = float(a.ty) - float(a.y)
		var d := Vector2(dx, dy).length()
		var sp: float = float(c.D["anisp"].get(a["kind"], 20.0)) * dt
		if d <= sp or not ani_free(float(a.x) + dx / d * sp, float(a.y) + dy / d * sp, a):
			a["moving"] = false
			a["t"] = randf_range(1.5, 6)
		else:
			a["x"] = float(a.x) + dx / d * sp
			a["y"] = float(a.y) + dy / d * sp
			if absf(dx) > 0.5:
				a["flip"] = dx > 0
			a["f"] = float(a.f) + sp
		return
	a["t"] = float(a.t) - dt
	a["peck"] = (a["kind"] == "pheasant" or a["kind"] == "duck") and sin(now() * 5.0 + float(a.x) * 0.7) > 0.75
	if float(a.t) < 0.0:
		var r: Array = a.r
		for k in 5:
			var tx: float = (r[0] + randf() * (r[2] - r[0] + 1)) * CT
			var ty: float = (r[1] + randf() * (r[3] - r[1] + 1)) * CT
			if ani_free(tx, ty, a) and (JS.t(a.get("swim")) or line_free(a.x, a.y, tx, ty)):
				a["tx"] = tx
				a["ty"] = ty
				a["moving"] = true
				break
		a["t"] = randf_range(1, 4)

## gameUpd целиком: лютый зверь кидается на подошедшего, олень у бая бьёт рогами (hunt3.js) → бросок (hurt.js) →
## подранок: кровь, залегает (hunt2.js) → обычные повадки (hunt.js)
func game_upd(a: Dictionary, dt: float, P: Dictionary) -> void:
	var g := game_of(a)
	var live: bool = on() and in_forest() and not (float(P.get("downT", 0.0)) > now())
	if live and JS.t(g.get("fierce")) and (a["st"] == "graze" or a["st"] == "alert"):
		var kd := dist(a, P)
		var bear: bool = a["kind"] == "bear"
		var near := 100.0 if bear else 80.0
		if kd < near and not JS.t(a.get("dec")) and (a["st"] == "alert" or threat(a, P, g) != null):
			a["dec"] = now() + 3.0
			var p := (0.45 if bear else 0.4) + (0.4 if JS.t(a.get("hurt")) else 0.0) + (0.25 if kd < near * 0.6 else 0.0) + (0.05 if Game.season() == 3 else 0.0)
			if randf() < p:
				a["flip"] = float(P.x) > float(a.x)
				game_charge(a)
				return
		if JS.t(a.get("dec")) and now() > float(a.dec):
			a["dec"] = 0.0
	if live and a["st"] == "bay" and a["kind"] == "deer" and a["col"] != "doe" and not JS.t(a.get("lunged")) and HU.wpn != "pike":
		var kd := dist(a, P)
		if kd < 70.0 and not JS.t(HU.get("stagSaid")):
			HU["stagSaid"] = 1
			if not JS.t(HU.get("split")):
				_say(_hn(), "Не подходите вплотную, государь, — олень у бая бьёт рогами!", 4)
		if kd < 34.0:
			a["lunged"] = 1
			if randf() < 0.35 + (0.1 if float(_k().get("age", 30)) > 50 else 0.0):
				stag_lunge(a, P)
				game_flee(a, P)
				a["ft"] = 4.0
				a["free"] = now() + 3.0
				return
	if a["st"] == "charge":
		if a.get("cp") != null and String(a.get("cp", "")) != "":
			charge_upd(a, dt, P)
		else:
			game_charge(a)
		return
	if not on() or a["st"] == "dead" or a["st"] == "fly":
		_game_upd0(a, dt, P)
		return
	var kd := dist(a, P)
	if a["st"] == "lie":
		a["moving"] = false
		lie_upd(a, P, kd, g)
		return
	var st0: String = a["st"]
	_game_upd0(a, dt, P)
	if not JS.t(a.get("hurt")) or a["st"] == "dead":
		return
	if not JS.t(a.get("hs")):
		a["hs"] = 1
		bleed(a, true)
		if not JS.t(HU.get("bloodSaid")) and not _hn().is_empty():
			HU["bloodSaid"] = 1
			_say(_hn(), "Есть кровь! Подранок далеко не уйдёт — гончие найдут по следу.", 4)
	if a["moving"]:
		bleed(a, false)
	if (a["st"] == "graze" and st0 != "graze") or (a["st"] == "flee" and float(a.get("ft", 0.0)) > 10.0):
		lie_down(a)

## обычные повадки (gameUpd в hunt.js)
func _game_upd0(a: Dictionary, dt: float, P: Dictionary) -> void:
	var g := game_of(a)
	if a["st"] == "dead":
		if float(a.h) > 0.0:
			a["h"] = maxf(0.0, float(a.h) - 70.0 * dt)
		return
	if a["st"] == "fly":
		bird_fly(a, dt)
		return
	var th: Variant = threat(a, P, g)
	var kd := dist(a, P)
	if th != null:
		a["fx"] = float(th.o.x)
		a["fy"] = float(th.o.y)
		a["calm"] = 0.0
	else:
		a["calm"] = float(a.get("calm", 0.0)) + dt
	var fierce: bool = on() and JS.t(g.get("fierce")) and in_forest()
	var sk := 0.5 if c.sneak else 1.0
	match String(a["st"]):
		"graze":
			if th == null:
				graze_move(a, dt)
				return
			if JS.t(g.get("bird")):
				bird_up(a, th.o)
				return
			if fierce and th.king and kd < 56.0 and randf() < 0.4:
				game_charge(a)
				return
			if th.king and float(th.d) > float(g.det) * sk * 0.45:
				a["st"] = "alert"
				a["at"] = randf_range(0.5, 1.1)
				a["moving"] = false
				a["flip"] = float(P.x) > float(a.x)
				return
			game_flee(a)
		"alert":
			a["at"] = float(a.get("at", 0.0)) - dt
			a["moving"] = false
			if th != null:
				a["flip"] = float(th.o.x) > float(a.x)
			if th != null and (not th.king or float(th.d) < float(g.det) * sk * 0.4):
				game_flee(a)
			elif float(a.at) <= 0.0:
				if th != null:
					game_flee(a)
				else:
					a["st"] = "graze"
		"flee":
			a["ft"] = float(a.get("ft", 0.0)) + dt
			var ft: float = a.ft
			var sp: float = float(g.sp) * (0.82 if JS.t(a.get("hurt")) else 1.0) * (0.7 if ft < 0.4 else 1.0) * clampf(1.0 - (ft - 2.0) / 10.0, 0.75 if (JS.t(g.get("zig")) or a["kind"] == "fox") else 0.55, 1.0)
			if not steer(a, float(a.get("fx", P.x)), float(a.get("fy", P.y)), sp, dt, true):
				a["stk"] = float(a.get("stk", 0.0)) + dt
				if float(a.stk) > 0.5:
					a["st"] = "bay"
					a["bt"] = randf_range(2.5, 4)
					a["stk"] = 0.0
			else:
				a["stk"] = 0.0
			if float(a.calm) > 2.5 and float(a.ft) > 2.0:
				game_settle(a)
		"bay":
			a["bt"] = float(a.get("bt", 0.0)) - dt
			a["moving"] = false
			var hd := 1e9
			for h in hounds_in_forest():
				var d := dist(h, a)
				if d < hd:
					hd = d
					a["flip"] = float(h.x) > float(a.x)
			if fierce and kd < 70.0 and randf() < dt * 0.8:
				game_charge(a)
				return
			if kd < (15.0 if HU != null and HU.wpn == "pike" else 34.0) or float(a.bt) <= 0.0:
				game_flee(a, P if kd < 80.0 else null)
				a["ft"] = 4.0
				a["free"] = now() + 2.5

## бросок (chargeUpd, hurt.js): wind — роет землю, rush — несётся почти по прямой, turn — разворот: снова или прочь
func charge_upd(a: Dictionary, dt: float, P: Dictionary) -> void:
	var g := game_of(a)
	var kd := dist(a, P)
	var bear: bool = a["kind"] == "bear"
	if not on() or not in_forest() or kd > 240.0 or float(P.get("downT", 0.0)) > now():
		a["cp"] = null
		game_flee(a, P)
		return
	a["ct"] = float(a.ct) + dt
	if a["cp"] == "wind":
		a["moving"] = false
		a["flip"] = float(P.x) > float(a.x)
		if randf() < dt * 7.0:
			c.parts.append({"k": "dust", "x": float(a.x) + (-5.0 if a.flip else 5.0), "y": a.y, "vx": (-1.0 if a.flip else 1.0) * 12.0, "vy": -5.0, "t": 0.0, "life": 0.5})
		if float(a.ct) >= float(a.cw):
			var dx: float = float(P.x) - float(a.x)
			var dy: float = float(P.y) - 2.0 - float(a.y)
			var d := maxf(1.0, Vector2(dx, dy).length())
			a["cp"] = "rush"
			a["ct"] = 0.0
			a["rx"] = dx / d
			a["ry"] = dy / d
			a["rd"] = 0.0
			a["rl"] = d + 46.0
			a["best"] = 1e9
			Snd.sfx("growl")
		return
	if a["cp"] == "rush":
		if float(a.rd) < float(a.rl) - 34.0:
			var want := atan2(float(P.y) - 2.0 - float(a.y), float(P.x) - float(a.x))
			var cur := atan2(float(a.ry), float(a.rx))
			var da := want - cur
			while da > PI:
				da -= TAU
			while da < -PI:
				da += TAU
			var an := cur + clampf(da, -0.8 * dt, 0.8 * dt)
			a["rx"] = cos(an)
			a["ry"] = sin(an)
		var sp: float = float(g.sp) * (1.25 if bear else 1.55) * minf(1.0, 0.45 + float(a.ct) * 2.4)
		var st := sp * dt
		var nx: float = float(a.x) + float(a.rx) * st
		var ny: float = float(a.y) + float(a.ry) * st
		if not ani_free(nx, ny, a):
			a["cp"] = "turn"
			a["ct"] = 0.0
			a["moving"] = false
			Snd.sfx("thud")
			return
		a["x"] = nx
		a["y"] = ny
		a["f"] = float(a.f) + st
		a["rd"] = float(a.rd) + st
		a["moving"] = true
		if absf(a.rx) > 0.2:
			a["flip"] = float(a.rx) > 0
		if randf() < dt * 12.0:
			c.parts.append({"k": "dust", "x": a.x, "y": a.y, "vx": -float(a.rx) * 10.0, "vy": -4.0, "t": 0.0, "life": 0.45})
		if HU.wpn == "pike" and not JS.t(a.get("recv")) and kd < 22.0 and not P.moving:
			a["recv"] = 1
			a["cp"] = null
			pike_strike(a, true)
			return
		if kd < 40.0 and not JS.t(a.get("tried")):
			a["tried"] = 1
			var hn := _hn()
			var cn: Dictionary = c.npc_by(String(HU.comp)) if HU.comp != null else {}
			if not hn.is_empty() and dist(hn, P) < 70.0 and randf() < 0.4:
				a["cp"] = null
				kill(a, "hunter")
				_say(hn, "Ага, попался! На рогатину его!", 3)
				return
			var cc: Variant = c.people.real(cn) if not cn.is_empty() else null
			if cc != null and float(cc.get("mar", 0)) >= 12 and dist(cn, P) < 70.0 and randf() < 0.3:
				a["cp"] = null
				kill(a, "hunter")
				_say(cn, "Не тронешь короля, зверюга!", 3)
				return
		if kd < float(a.best):
			a["best"] = kd
		if kd < 10.0:
			a["cp"] = "turn"
			a["ct"] = 0.0
			boar_contact(a, P)
			return
		if float(a.rd) > float(a.rl) or (float(a.best) < 44.0 and kd > float(a.best) + 16.0):
			a["cp"] = "turn"
			a["ct"] = 0.0
			if float(a.best) < 26.0:
				_toast("Медведь проносится мимо!" if bear else "Кабан проносится мимо — клыки в пяди от ноги!")
				_say(_hn(), "Ловко, государь!", 2)
		return
	a["moving"] = float(a.ct) < 0.35
	if a["moving"]:
		var st: float = float(g.sp) * 0.6 * (1.0 - float(a.ct) / 0.35) * dt
		if ani_free(float(a.x) + float(a.rx) * st, float(a.y) + float(a.ry) * st, a):
			a["x"] = float(a.x) + float(a.rx) * st
			a["y"] = float(a.y) + float(a.ry) * st
			a["f"] = float(a.f) + st
	else:
		a["flip"] = float(P.x) > float(a.x)
	if float(a.ct) > 0.8:
		if int(a.get("tries", 0)) < 3 and kd < 150.0 and randf() < (0.6 if bear else 0.5):
			a["cp"] = "wind"
			a["ct"] = 0.0
			a["cw"] = randf_range(0.55, 0.9)
			a["tries"] = int(a.get("tries", 0)) + 1
			a["tried"] = 0
			Snd.sfx("growl")
		else:
			a["cp"] = null
			game_flee(a, P)

## миг встречи: отскок поперёк его пути — или удар (boarContact)
func boar_contact(a: Dictionary, P: Dictionary) -> void:
	var k := _k()
	var v: Array = DIRV.get(P.dir, [0.0, 0.0])
	var cross: float = absf(v[0] * float(a.ry) - v[1] * float(a.rx)) if P.moving else 0.0
	var dodge: float = (0.22 + 0.5 * cross if P.moving else 0.08) + (float(k.get("mar", 10)) - 10.0) * 0.02 - (0.15 if Hurt.hurt(k) else 0.0) - (0.1 if c.sneak else 0.0) - (0.08 if float(k.get("age", 30)) > 50 else 0.0)
	if randf() < dodge:
		_toast(_pick(["Вы отскакиваете — клыки рвут только плащ!", "Прыжок в сторону — зверь проносится мимо!"]))
		_say(_hn(), "Ух! Цел, государь?", 2)
		return
	king_hit(a, false)

## рогатина соскользнула (huntGored, hurt.js): ещё роет землю — кинется сразу; принимал на рогатину и промахнулся — без отскока
func gored(a: Dictionary) -> void:
	if a["st"] == "charge" and a.get("cp") != null and a.get("cp") != "rush":
		a["cp"] = "wind"
		a["ct"] = a.get("cw", 1.0)
		return
	king_hit(a, true)

func king_hit(a: Dictionary, close: bool) -> void:
	if not on():
		return
	var P := _P()
	var k := _k()
	var bear: bool = a["kind"] == "bear"
	var r := randf() + (0.22 if bear else 0.0) + (0.1 if close else 0.0) + (0.08 if float(k.get("age", 30)) > 50 else 0.0) - (float(k.get("mar", 10)) - 10.0) * 0.015
	var sev := 1 if r < 0.52 else 2 if r < 0.9 else 3
	var part: String = _pick(["плечо", "бок", "руку"]) if bear else _pick(["бедро", "голень", "бедро"])
	var days := Hurt.wound_king(sev, part, "медведь" if bear else "кабан")
	P["downT"] = now() + (1.4 if sev == 1 else 2.4)
	P["moving"] = false
	c.path = []
	c.on_arrive = Callable()
	flash = now()
	Snd.sfx("thud")
	Snd.sfx("hit")
	Snd.sfx("growl")
	a["cp"] = null
	a["st"] = "flee"
	a["ft"] = 0.0
	a["fx"] = P.x
	a["fy"] = P.y
	a["free"] = now() + 6.0
	a["moving"] = true
	HU["hurtN"] = int(HU.get("hurtN", 0)) + 1
	_say(_hn(), "Цел, государь? Вставайте!" if sev == 1 else "Государь ранен! Рогатину, живо!", 3)
	if sev == 1:
		_toast(("Медведь" if bear else "Кабан") + " сбил вас с ног. Ушиб — до свадьбы заживёт.")
		return
	HU["wound"] = days
	var t: String
	if sev == 3:
		t = ("Медведь подминает вас и рвёт когтями " + part + " до кости." if bear else "Клык входит глубоко в " + part + " — кровь не унять.") + " Ловчие перетягивают рану ремнём. Рана тяжёлая: лекарь ничего не обещает."
	else:
		t = ("Медведь бьёт лапой — когти распарывают " + part + "." if bear else "Кабан сбивает вас с ног и распарывает клыком " + part + ".") + " Ловчий отгоняет зверя рогатиной. Рана глубокая, но заживёт — дней за " + str(days) + "."
	pend = {"t": now() + 2.2, "f": func() -> void: c.hud.say(null, t, {"name": "Беда на охоте", "choices": [{"t": "Домой, на носилках", "fx": func() -> void: end_hunt("wound")}], "esc": 0})}

# ---------- подранок: кровит, устаёт и залегает в чаще; гончие идут по крови (hunt2.js) ----------
func bleed(a: Dictionary, big: bool) -> void:
	if big or not a.has("_bx") or Vector2(float(a.x) - float(a._bx), float(a.y) - float(a._by)).length() > 7.0:
		a["_bx"] = a.x
		a["_by"] = a.y
		var B: Array = HU.blood
		B.append({"x": float(a.x) + randf_range(-2, 2), "y": float(a.y) + randf_range(-1, 1), "t": now(), "r": randf(), "big": 1 if big else 0})
		if B.size() > 260:
			B.pop_front()

func lie_down(a: Dictionary) -> void:
	a["st"] = "lie"
	a["moving"] = false
	a["zig"] = false
	a["pth"] = null
	var g := game_of(a)
	if not _hn().is_empty() and not JS.t(HU.get("lieSaid")):
		HU["lieSaid"] = 1
		_say(_hn(), ("Подранок залёг, государь. Раненый " + String(g.n) + " — самый опасный зверь: берите рогатину (Q).") if JS.t(g.get("fierce")) else (("Залегла раненая " if JS.t(g.get("f")) else "Залёг раненый ") + String(g.n) + "! Пойдём по крови — тихо, с Shift."), 4.5)

func lie_upd(a: Dictionary, P: Dictionary, kd: float, g: Dictionary) -> void:
	var hd := 1e9
	for h in hounds_in_forest():
		hd = minf(hd, dist(h, a))
	if hd < 18.0:
		a["st"] = "bay"
		a["bt"] = randf_range(6.5, 9)
		hound_bark()
		_say(_hn(), "Подняли подранка! Держат — " + dir_word(float(a.x) - float(P.x), float(a.y) - float(P.y)) + "!", 3.5)
		return
	if in_forest() and kd < float(g.det) * (0.3 if c.sneak else 0.45) * wind_mul(a, P):
		a["flip"] = float(P.x) > float(a.x)
		if JS.t(g.get("fierce")) and kd < 60.0:
			game_charge(a)
		else:
			game_flee(a, P)

# ---------- гончие: у ноги, по следу, держат зверя у бая (hunt.js; по крови — hunt2.js; за ловчим — hunt3.js) ----------
func hound_bark() -> void:
	if HU != null and now() > float(HU.get("barkT", 0.0)):
		Snd.sfx("bark")
		HU["barkT"] = now() + randf_range(0.9, 1.7)

func scent(h: Dictionary) -> Variant:
	var best: Variant = null
	var bd := 520.0
	for a in forest_ani():
		if JS.t(a.get("hurt")) and a["st"] != "dead" and now() >= float(a.get("free", 0.0)):
			var d := dist(a, h)
			if d < bd:
				bd = d
				best = a
	if best != null:
		return best
	var bs := 1e9
	var want: Array = ["boar"] if HU.kind == "boar" else ["deer", "doe"] if HU.kind == "deer" else ["hare", "fox"]
	for a in forest_ani():
		if a["st"] == "dead" or a["st"] == "fly" or JS.t(game_of(a).get("bird")) or now() < float(a.get("free", 0.0)):
			continue
		var d := dist(a, h)
		if d > 160.0:
			continue
		var s := d * (0.6 if gk(a) in want else 1.0)
		if s < bs and line_free(h.x, float(h.y) - 4.0, a.x, float(a.y) - 4.0):
			bs = s
			best = a
	return best

func hound_upd(h: Dictionary, dt: float, P: Dictionary) -> void:
	if JS.t(HU.get("split")):
		var hn := _hn()
		if not hn.is_empty():
			var s0: bool = c.sneak
			c.sneak = false
			_hound_upd0(h, dt, {"x": hn.x, "y": hn.y, "moving": true, "dir": hn.dir})
			c.sneak = s0
			return
	_hound_upd0(h, dt, P)

func _hound_upd0(h: Dictionary, dt: float, P: Dictionary) -> void:
	var kd := dist(h, P)
	if h["st"] != "heel":
		var q: Variant = h.get("q")
		if q == null or q.st == "dead" or q.st == "fly" or dist(q, P) > 640.0 or now() - float(h.get("qT", 0.0)) > 35.0:
			h["st"] = "heel"
			h["q"] = null
			h["rest"] = now() + 2.0
			if HU.get("quarry") != null and q != null and is_same(HU.quarry, q):
				HU["quarry"] = null
	if h["st"] == "heel":
		if not c.sneak and now() > float(h.get("rest", 0.0)):
			var qq: Variant = HU.get("quarry")
			var q: Variant = qq if qq != null and qq.st != "dead" and qq.st != "fly" else scent(h)
			if q != null:
				HU["quarry"] = q
				h["st"] = "chase"
				h["q"] = q
				h["qT"] = now()
				hound_bark()
		if h["st"] == "heel":
			if kd > 400.0:
				var e: Vector2i = c.near_free("forest", floori(float(P.x) / CT) + 1, floori(float(P.y) / CT))
				h["x"] = e.x * CT + 8.0
				h["y"] = e.y * CT + 10.0
				h["pth"] = null
				return
			var an: float = float(h.get("oa", 0.0)) + now() * 0.25
			var tx: float = float(P.x) + cos(an) * 26.0
			var ty: float = float(P.y) + sin(an) * 12.0 + 4.0
			if Vector2(tx - float(h.x), ty - float(h.y)).length() > 16.0:
				move_to(h, tx, ty, 125.0 if kd > 90.0 else 36.0 if c.sneak else 78.0, dt)
			else:
				h["moving"] = false
				h["pth"] = null
				if absf(float(P.x) - float(h.x)) > 3.0:
					h["flip"] = float(P.x) > float(h.x)
			return
	var q: Dictionary = h.q
	var qd := dist(q, h)
	if q.st == "bay":
		var an: float = float(h.get("oa", 0.0)) + now() * 1.2
		move_to(h, float(q.x) + cos(an) * 20.0, float(q.y) + sin(an) * 9.0, 95.0, dt)
		if qd < 40.0:
			h["flip"] = float(q.x) > float(h.x)
		if randf() < dt * 0.9:
			hound_bark()
		return
	move_to(h, q.x, q.y, 128.0, dt)
	if randf() < dt * 0.6:
		hound_bark()
	if qd < 16.0:
		if q.kind == "hare" or q.kind == "fox":
			if now() > float(h.get("bite", 0.0)):
				h["bite"] = now() + 0.8
				if randf() < 0.45:
					kill(q, "hounds")
		elif q.st == "flee" and now() > float(q.get("free", 0.0)):
			q["st"] = "bay"
			q["bt"] = randf_range(6.5, 9)
			q["moving"] = false
			_say(_hn(), ("Держат! Гончие держат зверя — " if randf() < 0.5 else "Встал! Скорее, государь, — ") + dir_word(float(q.x) - float(_P().x), float(q.y) - float(_P().y)) + "!", 3.5)

# ---------- люди на охоте: ловчий и спутник держатся у короля (folUpd); ловчий, ушедший с гончими, — splitMove (hunt3.js) ----------
func fol_upd(n: Dictionary, i: int, dt: float, P: Dictionary) -> void:
	if HU != null and JS.t(HU.get("split")) and n["key"] == "srv_hunter":
		split_move(n, dt, P)
		return
	if _bub(n) and float(n.get("bub_t", 0.0)) < now():
		n["bub"] = ""
	n["loc"] = "forest"
	n["away"] = false
	n["sit"] = null
	n["lie"] = false
	var d := dist(n, P)
	var sp := 34.0 if c.sneak else 92.0 if d > 80.0 else 74.0
	if d > 420.0:
		var e: Vector2i = c.near_free("forest", floori(float(P.x) / CT) - 1, floori(float(P.y) / CT) + (-1 if i else 1))
		n["x"] = e.x * CT + 8.0
		n["y"] = e.y * CT + 12.0
		n["path"] = null
		return
	n["rp"] = float(n.get("rp", 0.0)) - dt
	if d > 40.0 and float(n.rp) <= 0.0:
		n["rp"] = 0.5
		var fx: float = {"left": -1.0, "right": 1.0}.get(P.dir, 0.0)
		var fy: float = {"up": -1.0, "down": 1.0}.get(P.dir, 0.0)
		var bx: float = float(P.x) - fx * 22.0 + ((-14.0 if i else 14.0) if fy != 0.0 else 0.0)
		var by: float = float(P.y) - fy * 18.0 + ((-12.0 if i else 12.0) if fx != 0.0 else 0.0)
		var e: Vector2i = c.near_free("forest", floori(bx / CT), floori(by / CT))
		var p: Variant = c.find_path("forest", Vector2i(floori(float(n.x) / CT), floori((float(n.y) - 2.0) / CT)), e)
		n["path"] = p if p is Array and (p as Array).size() < 75 else null
		n["pi"] = 0
	if d < 24.0:
		n["path"] = null
	var pth: Variant = n.get("path")
	if pth is Array and int(n.get("pi", 0)) < (pth as Array).size():
		var cell: Vector2i = pth[n.pi]
		var gx := cell.x * CT + 8.0
		var gy := cell.y * CT + 12.0
		var dx: float = gx - float(n.x)
		var dy: float = gy - float(n.y)
		var dd := Vector2(dx, dy).length()
		var st := sp * dt
		if dd <= st:
			n["x"] = gx
			n["y"] = gy
			n["pi"] = int(n.pi) + 1
		else:
			n["x"] = float(n.x) + dx / dd * st
			n["y"] = float(n.y) + dy / dd * st
			n["f"] = float(n.get("f", 0.0)) + st
			face_to(n, dx, dy)
	else:
		n["path"] = null
		if d < 70.0:
			face_to(n, float(P.x) - float(n.x), float(P.y) - float(n.y))

func split_move(n: Dictionary, dt: float, P: Dictionary) -> void:
	var S: Dictionary = HU.split
	var L := _L()
	if _bub(n) and float(n.get("bub_t", 0.0)) < now():
		n["bub"] = ""
	n["loc"] = "forest"
	n["away"] = false
	n["sit"] = null
	n["lie"] = false
	var q: Variant = null if S.st == "back" else split_q()
	var tx: float
	var ty: float
	var sp := 78.0
	if S.st == "back":
		tx = P.x
		ty = P.y
		sp = 100.0
	elif q != null:
		var d := dist(q, n)
		if d < 44.0:
			n["path"] = null
			n["moving"] = false
			face_to(n, float(q.x) - float(n.x), float(q.y) - float(n.y))
			return
		tx = q.x
		ty = q.y
		sp = 96.0
	elif S.st == "search":
		if S.get("wp") == null or now() > float(S.get("wpT", 0.0)) or Vector2(float(S.wp[0]) - float(n.x), float(S.wp[1]) - float(n.y)).length() < 8.0:
			var cl: Array = L["clearings"][S.ci]
			var e: Vector2i = c.near_free("forest", int(cl[0]) + randi_range(1 - int(cl[2]), int(cl[2]) - 1), int(cl[1]) + randi_range(1 - int(cl[3]), int(cl[3]) - 1))
			S["wp"] = [e.x * CT + 8.0, e.y * CT + 12.0]
			S["wpT"] = now() + 5.0
			n["path"] = null
		tx = S.wp[0]
		ty = S.wp[1]
		sp = 46.0
	else:
		var cl: Array = L["clearings"][S.ci]
		tx = float(cl[0]) * CT + 8.0
		ty = float(cl[1]) * CT + 12.0
	var pth: Variant = n.get("path")
	if not (pth is Array) or int(n.get("pi", 0)) >= (pth as Array).size() or now() > float(n.get("rpT", 0.0)):
		n["rpT"] = now() + (1.2 if q != null or S.st == "back" else 4.0)
		var e: Vector2i = c.near_free("forest", floori(tx / CT), floori(ty / CT))
		var p: Variant = c.find_path("forest", Vector2i(floori(float(n.x) / CT), floori((float(n.y) - 2.0) / CT)), e)
		n["path"] = p if p is Array else null
		n["pi"] = 0
		pth = n["path"]
	if pth is Array and int(n.pi) < (pth as Array).size():
		var cell: Vector2i = pth[n.pi]
		var gx := cell.x * CT + 8.0
		var gy := cell.y * CT + 12.0
		var dx: float = gx - float(n.x)
		var dy: float = gy - float(n.y)
		var dd := Vector2(dx, dy).length()
		var st := sp * dt
		if dd <= st:
			n["x"] = gx
			n["y"] = gy
			n["pi"] = int(n.pi) + 1
		else:
			n["x"] = float(n.x) + dx / dd * st
			n["y"] = float(n.y) + dy / dd * st
			n["f"] = float(n.get("f", 0.0)) + st
			face_to(n, dx, dy)
		n["moving"] = true
	else:
		n["moving"] = false

# ---------- лук, сулицы, рогатина и сокол: прицел ловчего (E или щелчок по зверю — по шансу) ----------
func hit_chance(a: Dictionary, d: float) -> float:
	var g := game_of(a)
	var k := _k()
	var P := _P()
	var p: float = 0.85 - d / 300.0 + (float(k.get("mar", 10)) - 10.0) * 0.015 + float(g.sz)
	if a["st"] == "flee":
		p -= 0.2
	elif a["st"] == "bay":
		p += 0.25
	elif a["st"] == "charge":
		p += 0.05
	elif not a["moving"]:
		p += 0.1
	if P.moving:
		p -= 0.1
	if Hurt.hurt(k):
		p -= 0.1
	return clampf(p, 0.05, 0.95)

static func falcon_chance(a: Dictionary, d: float) -> float:
	return clampf(0.72 + (0.12 if a["st"] == "fly" else 0.0) - d / 1200.0 - (0.15 if a["kind"] == "hare" else 0.0), 0.3, 0.92)

func jav_chance(a: Dictionary, d: float) -> float:
	var g := game_of(a)
	var k := _k()
	var P := _P()
	var p: float = 0.95 - d / 110.0 + (float(k.get("mar", 10)) - 10.0) * 0.02 + float(g.sz) * 1.5
	if a["st"] == "flee":
		p -= 0.25
	elif a["st"] == "bay" or a["st"] == "lie":
		p += 0.2
	elif a["st"] == "charge":
		p += 0.1
	elif not a["moving"]:
		p += 0.08
	if P.moving:
		p -= 0.12
	if Hurt.hurt(k):
		p -= 0.15
	return clampf(p, 0.05, 0.95)

func pike_chance(a: Dictionary) -> float:
	var g := game_of(a)
	var k := _k()
	var P := _P()
	var p: float = {"lie": 0.85, "bay": 0.72, "charge": 0.5, "alert": 0.45, "graze": 0.55, "flee": 0.2}.get(a["st"], 0.4)
	p += (float(k.get("mar", 10)) - 10.0) * 0.03 - (0.12 if a["kind"] == "bear" else 0.0) + float(g.sz)
	if P.moving:
		p -= 0.15 if a["st"] == "charge" else 0.05
	if Hurt.hurt(k):
		p -= 0.15
	return clampf(p, 0.05, 0.95)

func wpn_chance(a: Dictionary, d: float, use_f: bool) -> float:
	if use_f:
		return falcon_chance(a, d)
	var w: String = HU.wpn
	return jav_chance(a, d) if w == "jav" else pike_chance(a) if w == "pike" else hit_chance(a, d)

## меткий выстрел валит сразу, иначе зверь уходит подранком (lethalP)
func lethal_p(a: Dictionary, d: float) -> float:
	var k := _k()
	return clampf(0.5 + (float(k.get("mar", 10)) - 10.0) * 0.025 + (-0.1 if a["moving"] else 0.12) + (0.15 if a["st"] == "bay" or a["st"] == "lie" else 0.0) - d / 500.0, 0.2, 0.85)

func can_shoot(a: Dictionary, d: float, use_f: bool, P: Dictionary) -> bool:
	var w: String = HU.get("wpn", "bow")
	if use_f:
		return d < 210.0
	if w == "bow":
		return int(HU.arrows) > 0 and a["st"] != "fly" and d < 150.0 and line_free(P.x, float(P.y) - 10.0, a.x, float(a.y) - 6.0)
	if a["st"] == "fly" or float(a.h) > 0.0:
		return false
	if w == "jav":
		return int(HU.jav) > 0 and d < HWPN.jav.rng and line_free(P.x, float(P.y) - 12.0, a.x, float(a.y) - 6.0)
	return d < HWPN.pike.rng

func why_not(a: Dictionary, d: float, use_f: bool) -> String:
	var w: String = "fal" if use_f else String(HU.get("wpn", "bow"))
	if w == "bow" and int(HU.arrows) <= 0:
		return "колчан пуст — возьмите сулицы или рогатину (Q)"
	if w == "jav" and int(HU.jav) <= 0:
		return "сулиц не осталось — подберите брошенные"
	if w != "fal" and (a["st"] == "fly" or float(a.h) > 0.0):
		return "в полёте — " + ("луком" if w == "bow" else "так") + " не достать"
	if d >= (210.0 if w == "fal" else float(HWPN[w].rng)):
		return "рогатиной бьют вплотную — подойдите" if w == "pike" else "далеко — подойдите ближе (Shift — красться)"
	return "мешают деревья"

func aim(P: Dictionary) -> Variant:
	var best: Variant = null
	var bs := 1e9
	var fx: float = {"left": -1.0, "right": 1.0}.get(P.dir, 0.0)
	var fy: float = {"up": -1.0, "down": 1.0}.get(P.dir, 0.0)
	for a in forest_ani():
		if a["st"] == "dead":
			continue
		var g := game_of(a)
		var d := dist(a, P)
		if d > 210.0:
			continue
		var use_f: bool = HU.kind == "falcon" and HU.get("fal") == null and (JS.t(g.get("bird")) or a["kind"] == "hare")
		if not can_shoot(a, d, use_f, P):
			continue
		var dot: float = ((float(a.x) - float(P.x)) * fx + (float(a.y) - float(P.y)) * fy) / maxf(1.0, d)
		var s := d * (1.0 if dot > 0.3 else 1.8) * (0.3 if a["st"] == "charge" else 1.0)
		if s < bs:
			bs = s
			best = {"a": a, "d": d, "useF": use_f}
	return best

static func st_word(a: Dictionary) -> String:
	var g := game_of(a)
	var f := JS.t(g.get("f"))
	if a["st"] == "lie":
		return "залегла" if f else "залёг"
	return {"graze": "не замечает вас" if JS.t(g.get("bird")) else "пасётся, не чует вас", "alert": "насторожилась" if f else "насторожился", "flee": "убегает", "bay": "гончие держат зверя", "charge": "бросается на вас!", "fly": "в полёте"}.get(a["st"], "")

## цель для «E» (huntTarget с оружием hunt2.js)
func target_of(t: Dictionary) -> Dictionary:
	var a: Dictionary = t.a
	var g := game_of(a)
	var w: String = HU.get("wpn", "bow")
	var act: String = "Пустить сокола" if t.useF else "Принять на рогатину" if w == "pike" and a["st"] == "charge" else String(HWPN[w].act)
	var sub := st_word(a) + ((", ранен" + ("а" if JS.t(g.get("f")) else "")) if JS.t(a.get("hurt")) else "")
	if JS.t(a.get("hart")):
		sub = "пощадить или взять? · " + sub
	return {"label": act + ": " + ("белый олень" if JS.t(a.get("hart")) else String(g.n)) + " · " + str(roundi(wpn_chance(a, t.d, t.useF) * 100.0)) + "%", "sub": sub, "x": a.x, "y": float(a.y) - 8.0 - float(a.h), "d": 0.5,
		"go": func() -> void: shoot(a, t.useF)}

func _face(P: Dictionary, a: Dictionary) -> void:
	face_to(P, float(a.x) - float(P.x), float(a.y) - float(P.y))
	c.path = []

## выстрел ловчего: лук (с меткостью — hunt2.js), сулица, рогатина, сокол
func shoot(a: Dictionary, use_f: bool) -> void:
	if not on() or now() < float(HU.get("cool", 0.0)) or a["st"] == "dead":
		return
	var P := _P()
	var w: String = HU.get("wpn", "bow")
	var d := dist(a, P)
	var g := game_of(a)
	var dx: float = float(a.x) - float(P.x)
	_face(P, a)
	var hn := _hn()
	if use_f:
		if HU.get("fal") != null:
			return
		HU["fal"] = {"x": P.x, "y": P.y, "h": 22.0, "st": "out", "q": a, "p": falcon_chance(a, d), "t": 0.0, "flip": dx > 0}
		HU["cool"] = now() + 0.5
		Snd.sfx("flap")
		if JS.t(g.get("bird")):
			if a["st"] != "fly":
				bird_up(a, P)
		elif a["st"] != "flee":
			game_flee(a, P)
		_say(hn, "Пошёл, пошёл!", 2)
		return
	if w == "jav":
		jav_throw(a, d)
		return
	if w == "pike":
		pike_strike(a, false)
		return
	if int(HU.arrows) <= 0:
		_toast("Колчан пуст — стрел больше нет.")
		return
	HU["arrows"] = int(HU.arrows) - 1
	HU["shots"] = int(HU.shots) + 1
	HU["cool"] = now() + 0.75
	HU["bowT"] = now()
	Snd.sfx("bow")
	var hit := randf() < hit_chance(a, d)
	var ox := 0.0 if hit else randf_range(9, 20) * (-1.0 if randf() < 0.5 else 1.0)
	var oy := 0.0 if hit else randf_range(-7, 7)
	var f := {"x0": float(P.x) + (5.0 if dx > 0 else -5.0), "y0": float(P.y) - 15.0, "tx": float(a.x) + ox, "ty": float(a.y) - 7.0 + oy, "t": 0.0, "dur": maxf(0.12, d / 380.0), "hit": hit, "a": a}
	if hit:
		f["dmg"] = 2.0 if randf() < lethal_p(a, d) else 1.0
	(HU.fl as Array).append(f)
	alarm_near(a, P)

## спугнуть пасущихся рядом (alarmNear)
func alarm_near(a: Dictionary, P: Dictionary) -> void:
	for b in forest_ani():
		if not is_same(b, a) and b["st"] == "graze" and dist(b, a) < 60.0:
			b["fx"] = P.x
			b["fy"] = P.y
			if JS.t(game_of(b).get("bird")):
				bird_up(b, P)
			else:
				b["st"] = "alert"
				b["at"] = randf_range(0.2, 0.6)

func jav_throw(a: Dictionary, d: float) -> void:
	var P := _P()
	if int(HU.jav) <= 0:
		_toast("Сулиц не осталось — подберите брошенные.")
		return
	HU["jav"] = int(HU.jav) - 1
	HU["jshots"] = int(HU.jshots) + 1
	HU["cool"] = now() + 1.1
	HU["thrT"] = now()
	Snd.sfx("swish")
	var hit := randf() < jav_chance(a, d)
	var ox := 0.0 if hit else randf_range(8, 16) * (-1.0 if randf() < 0.5 else 1.0)
	var oy := 0.0 if hit else randf_range(-6, 6)
	(HU.jf as Array).append({"x0": float(P.x) + (4.0 if float(a.x) > float(P.x) else -4.0), "y0": float(P.y) - 21.0, "tx": float(a.x) + ox, "ty": float(a.y) - 7.0 + oy, "t": 0.0, "dur": maxf(0.18, d / 240.0), "hit": hit, "a": a,
		"dmg": 3.0 if randf() < lethal_p(a, d) + 0.15 else 2.0})
	alarm_near(a, P)

func wound_beast(a: Dictionary, dmg: float, P: Dictionary) -> void:
	a["hp"] = float(a.hp) - dmg
	if float(a.hp) <= 0.0:
		kill(a, "king")
		return
	var g := game_of(a)
	a["hurt"] = 1
	if JS.t(g.get("fierce")) and dist(a, P) < 130.0 and randf() < 0.7:
		game_charge(a)
	else:
		game_flee(a, P)
	_toast("Попали! " + ("Раненая " if JS.t(g.get("f")) else "Раненый ") + String(g.n) + " ещё на ногах.")

func jav_upd(dt: float, P: Dictionary) -> void:
	var JF: Array = HU.jf
	for i in range(JF.size() - 1, -1, -1):
		var f: Dictionary = JF[i]
		var a: Dictionary = f.a
		f["t"] = float(f.t) + dt
		if f.hit and a["st"] != "dead":
			f["tx"] = a.x
			f["ty"] = float(a.y) - 7.0 - float(a.h)
		if float(f.t) < float(f.dur):
			continue
		JF.remove_at(i)
		if f.hit and a["st"] != "dead":
			HU["jhits"] = int(HU.jhits) + 1
			Snd.sfx("hit")
			wound_beast(a, f.dmg, P)
			continue
		(HU.sj as Array).append({"x": f.tx, "y": float(f.ty) + 7.0, "dx": float(f.tx) - float(f.x0), "dy": float(f.ty) - float(f.y0)})
		if a["st"] != "dead":
			if JS.t(game_of(a).get("bird")):
				if a["st"] != "fly":
					bird_up(a, P)
			elif a["st"] != "charge" and a["st"] != "bay":
				game_flee(a, P)
		if randf() < 0.6:
			_say(_hn(), _pick(["Мимо! Сулицу потом подберём.", "Эх, в землю ушла…", "Ближе, государь, ближе подпускайте!"]), 2.5)
	var SJ: Array = HU.sj
	for i in range(SJ.size() - 1, -1, -1):
		var s: Dictionary = SJ[i]
		if Vector2(float(s.x) - float(P.x), float(s.y) - float(P.y)).length() < 12.0:
			SJ.remove_at(i)
			HU["jav"] = int(HU.jav) + 1
			Snd.sfx("click")
			_toast("Сулица подобрана — их у вас " + str(HU.jav) + ".")

## рогатина: удар вплотную — или, когда зверь бросается, стоять и принять его на перекладину (pikeStrike)
func pike_strike(a: Dictionary, recv: bool) -> void:
	var P := _P()
	var g := game_of(a)
	var p := pike_chance(a) + (0.1 if recv and not P.moving else 0.0)
	var hn := _hn()
	HU["cool"] = now() + 0.9
	HU["thrT"] = now()
	HU["pk"] = int(HU.pk) + 1
	Snd.sfx("swish")
	if randf() < p:
		HU["pkh"] = int(HU.pkh) + 1
		Snd.sfx("hit")
		a["pike"] = 1
		a["hp"] = 0.0
		kill(a, "king")
		_say(hn, _pick(["На рогатину! Вот это по-королевски!", "Принял зверя, как деды принимали! Слава!"]) if JS.t(g.get("fierce")) else "Чисто взяли, государь!", 3.5)
		return
	if recv or a["st"] == "charge":
		gored(a)
		return
	if JS.t(g.get("fierce")) and randf() < 0.6:
		game_charge(a)
	else:
		game_flee(a, P)
	_say(hn, _pick(["Соскользнула! Берегитесь!", "Увернулся, зверюга!"]), 2.5)

func arrows_upd(dt: float, P: Dictionary) -> void:
	var FL: Array = HU.fl
	for i in range(FL.size() - 1, -1, -1):
		var f: Dictionary = FL[i]
		var a: Dictionary = f.a
		f["t"] = float(f.t) + dt
		if f.hit and a["st"] != "dead":
			f["tx"] = a.x
			f["ty"] = float(a.y) - 7.0 - float(a.h)
		if float(f.t) < float(f.dur):
			continue
		FL.remove_at(i)
		if f.hit and a["st"] != "dead":
			HU["hits"] = int(HU.hits) + 1
			Snd.sfx("hit")
			wound_beast(a, float(f.get("dmg", 1.0)), P)
			continue
		var ST: Array = HU.stuck
		ST.append({"x": f.tx, "y": float(f.ty) + 7.0, "dx": float(f.tx) - float(f.x0), "dy": float(f.ty) - float(f.y0), "t": now()})
		if ST.size() > 12:
			ST.pop_front()
		if a["st"] != "dead":
			if JS.t(game_of(a).get("bird")):
				if a["st"] != "fly":
					bird_up(a, P)
			elif a["st"] != "charge" and a["st"] != "bay":
				game_flee(a, P)
		if randf() < 0.6:
			_say(_hn(), _pick(["Эх, мимо!", "Чуть бы выше, государь…", "Ветер снёс, не иначе.", "Ушёл! Ничего, догоним."]), 2.5)

func falcon_upd(dt: float, P: Dictionary) -> void:
	var f: Variant = HU.get("fal")
	if f == null:
		return
	f["t"] = float(f.t) + dt
	var q: Variant = f.q
	if f.st == "out":
		if q == null or q.st == "dead" or float(f.t) > 9.0:
			f["st"] = "back"
		else:
			var dx: float = float(q.x) - float(f.x)
			var dy: float = float(q.y) - float(f.y)
			var d := Vector2(dx, dy).length()
			var st := 200.0 * dt
			f["h"] = float(f.h) + (float(q.h) + 4.0 + minf(30.0, d * 0.2) - float(f.h)) * minf(1.0, dt * 4.0)
			if d <= maxf(st, 6.0):
				if randf() < float(f.p):
					kill(q, "falcon")
					f["st"] = "kill"
					f["kt"] = 1.2
				else:
					f["st"] = "back"
					if JS.t(game_of(q).get("bird")) and q.st != "fly":
						bird_up(q, P)
					_say(_hn(), "Упустил… Ничего, вернётся на перчатку.", 2.5)
			else:
				f["x"] = float(f.x) + dx / d * st
				f["y"] = float(f.y) + dy / d * st
				f["flip"] = dx > 0
		return
	if f.st == "kill":
		f["kt"] = float(f.kt) - dt
		f["x"] = q.x
		f["y"] = q.y
		f["h"] = maxf(0.0, float(q.h) + 2.0)
		if float(f.kt) <= 0.0:
			f["st"] = "back"
		return
	var dx: float = float(P.x) - float(f.x)
	var dy: float = float(P.y) - float(f.y)
	var d := Vector2(dx, dy).length()
	var st := 170.0 * dt
	f["h"] = float(f.h) + (24.0 - float(f.h)) * minf(1.0, dt * 3.0)
	if d <= maxf(st, 8.0):
		HU["fal"] = null
		return
	f["x"] = float(f.x) + dx / d * st
	f["y"] = float(f.y) + dy / d * st
	f["flip"] = dx > 0

## зверь взят (huntKill): стрелы и сулицы из туши — назад (hunt3.js), трофей — рога, вес, белый олень (hunt2.js)
func kill(a: Dictionary, by: String) -> void:
	if HU != null and a["st"] != "dead":
		if int(a.get("arw", 0)) > 0 and HU.has("ar"):
			HU["arrows"] = int(HU.arrows) + int(a.arw)
		if int(a.get("jv", 0)) > 0 and HU.has("jf"):
			HU["jav"] = int(HU.jav) + int(a.jv)
	a["arw"] = 0
	a["jv"] = 0
	var g := game_of(a)
	a["st"] = "dead"
	a["moving"] = false
	a["fly"] = 0.0
	a["zig"] = false
	a["pth"] = null
	if HU == null:
		return
	var b := {"k": gk(a), "by": by}
	(HU.bag as Array).append(b)
	if HU.get("quarry") != null and is_same(HU.quarry, a):
		HU["quarry"] = null
	Snd.sfx("thud")
	var ts: String = ("Сражена " if JS.t(g.get("f")) else "Сражён ") + String(g.n) + String({"hounds": " — гончие взяли!", "falcon": " — сокол не промахнулся!", "hunter": " — ловчий не сплоховал!", "comp": " — меткая стрела спутника!"}.get(by, "!"))
	var hn := _hn()
	if by == "king":
		_say(hn, _pick(["Славный выстрел, государь!", "Вот это рука! Прямо под лопатку.", "Хорош! Будет что рассказать за столом."]), 3.5)
	if by == "hounds":
		_say(hn, "Ату его! Молодцы, собачки!", 3)
	var x: Array = []
	if JS.t(a.get("hart")):
		b["hart"] = 1
		x.append("белый олень")
	if a["kind"] == "deer" and a["col"] != "doe":
		b["pts"] = c.fa_pts(a)
		x.append("рога в " + tines(b.pts))
	if a["kind"] == "boar":
		if not a.has("wt"):
			a["wt"] = randi_range(4, 9)
		b["wt"] = a.wt
		x.append(("матёрый секач, " if int(b.wt) >= 7 else "") + poods(b.wt))
	if a["kind"] == "bear":
		if not a.has("wt"):
			a["wt"] = randi_range(10, 18)
		b["wt"] = a.wt
		x.append(poods(b.wt))
	if JS.t(a.get("pike")):
		b["pike"] = 1
		x.append("взят на рогатину")
	_toast(ts + ((" " + ucf(", ".join(x)) + ".") if not x.is_empty() else ""))

func wpn_next() -> void:
	if not on():
		return
	HU["draw"] = null
	HU["wpn"] = HWPN_ORD[(HWPN_ORD.find(HU.wpn) + 1) % 3]
	Sim.G.court["huntWpn"] = HU.wpn
	HU["aim"] = null
	Snd.sfx("click")
	_toast({"bow": "В руках лук: стрел — " + str(HU.arrows) + ". Бьёт далеко, шагов на 150.", "jav": "В руках сулицы: " + str(HU.jav) + " шт. Бросок ближе лука, зато бьёт сильнее; промах можно подобрать.", "pike": "В руках рогатина: бить вплотную. Бросится кабан — стойте на месте и примите его на рогатину."}[HU.wpn])

# ---------- свой лук (hunt3.js): зажать — натянуть, навести мышью, отпустить; стрела летит по шагам — дичь, люди, деревья ----------
func own() -> bool:
	return on() and not JS.t(Sim.G.court.get("huntAuto")) and (HU.wpn == "bow" or HU.wpn == "jav")

static func draw_k(D: Variant, t: float) -> float:
	return 0.0 if D == null else clampf((t - float(D.t0)) / float(HBOW[D.w].tf), 0.0, 1.0)

## разброс (радианы в обе стороны): рука короля, натяг, ходьба, рана, годы — и дрожь, если держать слишком долго
func aim_spread(D: Dictionary) -> float:
	var k := _k()
	var P := _P()
	var k1 := draw_k(D, now())
	var held: float = now() - float(D.t0) - float(HBOW[D.w].tf) - 1.6
	var s: float = (0.1 - (float(k.get("mar", 10)) - 10.0) * 0.004) * (1.7 - 0.7 * k1) * float(HBOW[D.w].sp)
	if P.moving:
		s += 0.04 if c.sneak else 0.08
	if Hurt.hurt(k):
		s += 0.04
	if float(k.get("age", 30)) > 55:
		s += 0.02
	if held > 0.0:
		s += minf(0.14, held * 0.06)
	return clampf(s, 0.03, 0.4)

func aim_pt() -> Vector2:
	if aim_o != null:
		return aim_o
	var P := _P()
	var m: Vector2 = c.hud.get_local_mouse_position()
	if m.x < 0 or m.y < 0 or m.x > c.hud.size.x or m.y > c.hud.size.y:
		var v: Array = DIRV.get(P.dir, [1.0, 0.0])
		return Vector2(float(P.x) + v[0] * 120.0, float(P.y) - 14.0 + v[1] * 120.0)
	return c.cam_tl + m / c.Z

func draw_start() -> void:
	var w: String = HU.wpn
	if HU.get("draw") != null or now() < float(HU.get("cool", 0.0)) or float(_P().get("downT", 0.0)) > now():
		return
	if w == "bow" and int(HU.arrows) <= 0:
		_toast("Колчан пуст — подберите стрелы, что легли мимо, или возьмите сулицы (Q).")
		HU["cool"] = now() + 1.0
		return
	if w == "jav" and int(HU.jav) <= 0:
		_toast("Сулиц не осталось — подберите брошенные.")
		HU["cool"] = now() + 1.0
		return
	HU["draw"] = {"t0": now(), "w": w}
	c.path = []
	c.on_arrive = Callable()
	if w == "bow":
		Snd.sfx("draw")

func draw_loose(cancel: bool) -> void:
	var D: Variant = HU.get("draw")
	if D == null:
		return
	HU["draw"] = null
	HU["drawEnd"] = now()
	var k1 := draw_k(D, now())
	if cancel or k1 < 0.25:
		if not cancel:
			_toast("Тетива едва натянута — держите кнопку дольше." if D.w == "bow" else "Замах слишком слабый — держите кнопку дольше.")
		return
	var P := _P()
	var ap := aim_pt()
	var ox: float = P.x
	var oy: float = float(P.y) - 14.0
	var an := atan2(ap.y - oy, ap.x - ox) + (randf() + randf() - 1.0) * aim_spread(D)
	face_to(P, ap.x - ox, ap.y - oy)
	launch({"x": ox, "y": oy, "an": an, "k": k1, "w": D.w, "by": "king"})

func launch(o: Dictionary) -> void:
	var B: Dictionary = HBOW[o.w]
	(HU.ar as Array).append({"x": o.x, "y": o.y, "x0": o.x, "y0": o.y, "ux": cos(o.an), "uy": sin(o.an), "sp": float(B.v0) + float(B.v1) * float(o.k), "s": 0.0, "max": float(B.r0) + float(B.r1) * float(o.k),
		"w": o.w, "k": o.k, "by": o.by, "who": o.get("who", ""), "near": 0, "done": 0})
	if o.by != "king":
		Snd.sfx("bow")
		return
	HU["cool"] = now() + (0.4 if o.w == "bow" else 0.8)
	if o.w == "bow":
		HU["arrows"] = int(HU.arrows) - 1
		HU["shots"] = int(HU.shots) + 1
		HU["bowT"] = now()
		Snd.sfx("bow")
	else:
		HU["jav"] = int(HU.jav) - 1
		HU["jshots"] = int(HU.jshots) + 1
		HU["thrT"] = now()
		Snd.sfx("swish")

## рамка зверя в мире (aBox): по кадру 0
func a_box(a: Dictionary) -> Array:
	var s: Vector2 = c.fa_box(a)
	var hw := s.x * 0.42
	var h: float = a.h
	return [float(a.x) - hw, float(a.y) - h - s.y + 2.0, float(a.x) + hw, float(a.y) - h]

## чуть позади передней ноги и пониже: сердце и лёгкие
static func vital(a: Dictionary, b: Array, x: float, y: float) -> bool:
	if JS.t(game_of(a).get("bird")):
		return true
	var w: float = b[2] - b[0]
	var h: float = b[3] - b[1]
	var cx: float = (b[0] + b[2]) / 2.0 + (1.0 if a.flip else -1.0) * w * 0.12
	return absf(x - cx) < w * 0.2 and y > b[1] + h * 0.3 and y < b[1] + h * 0.85

static func vital_ray(a: Dictionary, b: Array, f: Dictionary) -> bool:
	var x: float = f.x
	var y: float = f.y
	var i := 0
	while i < 60 and x >= b[0] - 1 and x <= b[2] + 1 and y >= b[1] - 1 and y <= b[3] + 1:
		if vital(a, b, x, y):
			return true
		i += 1
		x += float(f.ux)
		y += float(f.uy)
	return false

func ar_upd(dt: float, P: Dictionary) -> void:
	var AR: Array = HU.ar
	for i in range(AR.size() - 1, -1, -1):
		var f: Dictionary = AR[i]
		var st: float = float(f.sp) * dt
		while st > 0.0 and not JS.t(f.done):
			var d := minf(3.0, st)
			st -= d
			f["x"] = float(f.x) + float(f.ux) * d
			f["y"] = float(f.y) + float(f.uy) * d
			f["s"] = float(f.s) + d
			ar_step(f, P)
		if JS.t(f.done):
			AR.erase(f)

func ar_step(f: Dictionary, P: Dictionary) -> void:
	var L := _L()
	for a in forest_ani():
		if a["st"] == "dead":
			continue
		var b := a_box(a)
		if f.x >= b[0] and f.x <= b[2] and f.y >= b[1] and f.y <= b[3]:
			f["done"] = 1
			ar_hit(f, a, b, P)
			return
		if (a["st"] == "graze" or a["st"] == "alert") and f.x > b[0] - 16 and f.x < b[2] + 16 and f.y > b[1] - 12 and f.y < b[3] + 10:   # свист стрелы рядом
			if JS.t(game_of(a).get("bird")):
				bird_up(a, {"x": f.x0, "y": f.y0})
			else:
				game_flee(a, {"x": f.x0, "y": f.y0})
	if float(f.s) > 12.0:
		if f.by != "king" and absf(float(f.x) - float(P.x)) < 5.0 and float(f.y) > float(P.y) - 27.0 and float(f.y) < float(P.y) - 3.0 and not (float(P.get("downT", 0.0)) > now()):
			f["done"] = 1
			stray_hit(f, P)
			return
		if f.by == "king" and not JS.t(f.near):
			for n in c.npcs:
				if JS.t(n.get("follow")) and n["loc"] == "forest" and absf(float(f.x) - float(n.x)) < 6.0 and float(f.y) > float(n.y) - 27.0 and float(f.y) < float(n.y) - 2.0:
					f["near"] = 1
					near_miss(n)
					break
	var h: float = 14.0 * (1.0 - float(f.s) / float(f.max))
	var tx := floori(float(f.x) / CT)
	var ty := floori((float(f.y) + h) / CT)
	if tx < 0 or ty < 0 or tx >= int(L.w) or ty >= int(L.h):
		f["done"] = 1
		return
	var wet: bool = c.ter_at("forest", tx, ty) == 7
	if _solid(tx, ty) and not wet and float(f.s) > 8.0:
		f["done"] = 1
		ar_stick(f, h, true)
		return
	if float(f.s) >= float(f.max):
		f["done"] = 1
		if wet:
			for i in 5:
				c.parts.append({"k": "dust", "x": float(f.x) + randf_range(-2, 2), "y": f.y, "vx": randf_range(-8, 8), "vy": -10.0, "t": 0.0, "life": 0.4})
			Snd.sfx("swish")
		else:
			ar_stick(f, 0.0, false)

func ar_hit(f: Dictionary, a: Dictionary, b: Array, P: Dictionary) -> void:
	var g := game_of(a)
	var vit := vital_ray(a, b, f)
	var base: float = 2.0 if f.w == "jav" else 1.0 if float(f.k) >= 0.85 else 0.75 if float(f.k) >= 0.55 else 0.5
	var dmg := base * (2.0 if vit else 1.0)
	Snd.sfx("hit")
	if f.w == "bow":
		a["arw"] = mini(4, int(a.get("arw", 0)) + 1)
	else:
		a["jv"] = int(a.get("jv", 0)) + 1
	if f.by != "king":
		a["hp"] = float(a.hp) - dmg
		var cn: Dictionary = c.npc_by(String(f.who)) if String(f.who) != "" else {}
		if float(a.hp) <= 0.0:
			kill(a, "comp")
			_say(cn, _pick(["Есть! Видели, государь?", "Попал! Попал!", "Вот это выстрел!"]), 3)
			return
		a["hurt"] = 1
		if JS.t(g.get("fierce")) and not cn.is_empty() and dist(a, cn) < 110.0 and randf() < 0.5:
			game_charge(a)
		else:
			game_flee(a, {"x": f.x0, "y": f.y0})
		return
	if f.w == "bow":
		HU["hits"] = int(HU.hits) + 1
	else:
		HU["jhits"] = int(HU.jhits) + 1
	wound_beast(a, dmg, P)
	if a["st"] == "dead":
		return
	if vit:
		_toast("Под лопатку! " + ("Раненая " if JS.t(g.get("f")) else "Раненый ") + String(g.n) + " ещё на ногах — но далеко не уйдёт.")
	elif base < 1.0 and f.w == "bow":
		_toast("Тетива была натянута вполсилы — стрела вошла неглубоко.")
	elif float(a.hp) > 0.0 and float(g.hp) >= 4.0 and not JS.t(HU.get("toughSaid")):
		HU["toughSaid"] = 1
		_say(_hn(), "Шкура толстая, государь: одной стрелой " + g_acc(gk(a)) + " не взять. Бейте под лопатку!", 4)

func ar_stick(f: Dictionary, h: float, tree: bool) -> void:
	var gx: float = f.x
	var gy: float = float(f.y) + h
	if f.w == "jav":
		(HU.sj as Array).append({"x": gx, "y": gy, "dx": f.ux, "dy": f.uy})
	else:
		var SA: Array = HU.sa
		SA.append({"x": gx, "y": gy, "h": h, "ux": f.ux, "uy": f.uy, "tree": tree, "t": now()})
		if SA.size() > 40:
			SA.pop_front()
	if tree:
		Snd.sfx("stick")
	for b in forest_ani():
		if b["st"] == "graze" and Vector2(float(b.x) - gx, float(b.y) - gy).length() < 50.0:
			b["fx"] = f.x0
			b["fy"] = f.y0
			if JS.t(game_of(b).get("bird")):
				bird_up(b, {"x": f.x0, "y": f.y0})
			else:
				b["st"] = "alert"
				b["at"] = randf_range(0.3, 0.8)
				b["flip"] = float(f.x0) > float(b.x)
	var hn := _hn()
	if f.by == "king" and not hn.is_empty() and not _bub(hn) and not JS.t(HU.get("split")) and randf() < 0.35:
		_say(hn, _pick(["Мимо, государь!", "Ушла стрела… Подберём потом.", "В дерево! Стреляйте, где чисто." if tree else "Ниже бери, государь, — стрела над спиной прошла.", "Ведите стрелу перед зверем, коли бежит."]), 2.4)

func near_miss(n: Dictionary) -> void:
	if n["key"] == "srv_hunter":
		_say(n, _pick(["Государь! Я же не олень!", "Эй! Своих не бейте!"]), 2.5)
	else:
		_say(n, _pick(["Ах! Осторожнее, государь!", "Стрела у самого уха!"]), 2.5)
	_toast("Стрела свистнула над головой спутника. Осторожнее!")

func pick_up(P: Dictionary) -> void:
	var SA: Array = HU.sa
	for i in range(SA.size() - 1, -1, -1):
		var s: Dictionary = SA[i]
		if Vector2(float(s.x) - float(P.x), float(s.y) - float(P.y)).length() > 12.0:
			continue
		SA.remove_at(i)
		if randf() < 0.78:
			HU["arrows"] = int(HU.arrows) + 1
			Snd.sfx("click")
			_toast("Стрела подобрана — в колчане " + str(HU.arrows) + ".")
		else:
			_toast("Наконечник засел в стволе — стрелу не вытащить." if s.tree else "Стрела сломалась.")

# ---------- лук спутника: помогает по бегущему, бросившемуся или у бая — и порой стреляет, когда не следует ----------
func comp_shoot(P: Dictionary) -> void:
	var cn: Dictionary = c.npc_by(String(HU.comp)) if HU.comp != null else {}
	var cc: Variant = c.people.real(cn) if not cn.is_empty() else null
	if cc == null or cn["loc"] != "forest" or float(cc.get("age", 30)) < 14 or now() < float(HU.get("cShot", 0.0)) or float(P.get("downT", 0.0)) > now():
		return
	HU["cShot"] = now() + randf_range(1.5, 3)
	var best: Variant = null
	var bd := 140.0
	for a in forest_ani():
		if a["st"] == "dead" or JS.t(game_of(a).get("bird")) or not (a["st"] in ["flee", "bay", "charge", "lie"]):
			continue
		var d := dist(a, cn)
		if d < bd and d > 24.0 and line_free(cn.x, float(cn.y) - 10.0, a.x, float(a.y) - 6.0):
			bd = d
			best = a
	if best == null or not randf() < 0.45:
		return
	var ox: float = cn.x
	var oy: float = float(cn.y) - 14.0
	var an := atan2(float(best.y) - 8.0 - oy, float(best.x) - ox)
	var ux := cos(an)
	var uy := sin(an)
	var kx: float = float(P.x) - ox
	var ky: float = float(P.y) - 14.0 - oy
	var along := kx * ux + ky * uy
	var perp := absf(-kx * uy + ky * ux)
	if along > 0 and along < bd + 30.0 and perp < 14.0:
		var eager := (0.16 if JS.t(HU.get("split")) else 0.08) * (2.0 if float(cc.get("loy", 50)) < 35 else 1.0)
		if not randf() < eager:
			if randf() < 0.3:
				_say(cn, "Отойдите, государь, — не выстрелить!", 2)
			return
	var sp := clampf(0.13 - (float(cc.get("mar", 8)) - 10.0) * 0.006, 0.05, 0.2)
	face_to(cn, ux, uy)
	launch({"x": ox, "y": oy, "an": an + (randf() + randf() - 1.0) * sp, "k": 0.9, "w": "bow", "by": "comp", "who": cn["key"]})
	HU["cShot"] = now() + randf_range(6, 11)
	HU["cs"] = int(HU.get("cs", 0)) + 1

# ---------- беды: шальная стрела, олень у бая, падение в погоне (бросок кабана — в charge_upd) ----------
func mishap(sev: int, part: String, by: String, t1: String, t2: String) -> void:
	if not on():
		return
	var P := _P()
	var days := Hurt.wound_king(sev, part, by)
	P["downT"] = now() + (1.4 if sev == 1 else 2.4)
	P["moving"] = false
	c.path = []
	c.on_arrive = Callable()
	flash = now()
	Snd.sfx("thud")
	HU["hurtN"] = int(HU.get("hurtN", 0)) + 1
	HU["draw"] = null
	if not JS.t(HU.get("split")):
		_say(_hn(), "Цел, государь? Вставайте!" if sev == 1 else "Государь ранен! Сюда, живо!", 3)
	if sev == 1:
		_toast(t1)
		return
	HU["wound"] = days
	var t := t2 + (" Рана тяжёлая: лекарь ничего не обещает." if sev == 3 else " Заживёт — дней за " + str(days) + ".")
	pend = {"t": now() + 2.2, "f": func() -> void: c.hud.say(null, t, {"name": "Беда на охоте", "choices": [{"t": "Домой, на носилках", "fx": func() -> void: end_hunt("wound")}], "esc": 0})}

func stray_hit(f: Dictionary, P: Dictionary) -> void:
	var k := _k()
	var cn: Dictionary = c.npc_by(String(f.who)) if String(f.who) != "" else {}
	var cc: Variant = c.people.real(cn) if not cn.is_empty() else null
	var nm: String = String(cn.get("name", "Кто-то из свиты")) if not cn.is_empty() else "Кто-то из свиты"
	var fe := "а" if cc != null and JS.t(cc.get("fem")) else ""
	var r := randf() + (0.05 if float(k.get("age", 30)) > 50 else 0.0)
	var sev := 1 if r < 0.45 else 2 if r < 0.88 else 3
	var part: String = _pick(["грудь", "бок"]) if sev == 3 else _pick(["плечо", "руку", "бедро"])
	if sev == 3:
		k["woundFv"] = 0.6
	Snd.sfx("hit")
	mishap(sev, part, "шальная стрела", "Стрела бьёт в рукав и застревает в сукне! " + nm + " бледнеет: «Простите, государь, я метил" + fe + " в зверя!»",
		"Шальная стрела! " + nm + " стрелял" + fe + " в зверя — и попал" + fe + " в вас: наконечник вошёл в " + part + ".")
	if cc != null:
		cc["loy"] = clampf(float(cc.get("loy", 50)) + (6.0 if sev > 1 else 2.0), 0.0, 100.0)
		_say(cn, "Государь! Нет, нет… Лекаря!" if sev > 1 else "Простите, государь! Сам" + ("а" if fe != "" else "") + " не знаю, как…", 3)

func stag_lunge(a: Dictionary, P: Dictionary) -> void:
	var k := _k()
	var r := randf() + (0.1 if float(k.get("age", 30)) > 50 else 0.0)
	var sev := 1 if r < 0.55 else 2 if r < 0.93 else 3
	var part: String = "живот" if sev == 3 else _pick(["бок", "бедро", "руку"])
	a["flip"] = float(P.x) > float(a.x)
	Snd.sfx("growl")
	mishap(sev, part, "олень", "Олень бьёт рогами — вы отлетаете в траву. Ушиб, не более.", "Прижатый гончими олень бросается на вас: рога поддевают за пояс и швыряют наземь — отросток вспарывает " + part + ".")

func chase_fall() -> void:
	var k := _k()
	var r := randf() + (0.05 if float(k.get("age", 30)) > 50 else 0.0)
	var sev := 1 if r < 0.8 else 2 if r < 0.97 else 3
	var part: String = "голову" if sev == 3 else _pick(["колено", "лоб", "локоть"])
	mishap(sev, part, "падение", "В погоне вы спотыкаетесь о корень и летите в папоротник. Ушиб.",
		"В погоне вы срываетесь в овраг и бьётесь головой о корень. Ловчие приводят вас в чувство не сразу." if sev == 3 else "В погоне вы срываетесь в овраг и рассекаете " + part + " о камни.")

# ---------- разделиться (hunt3.js): ловчий с гончими уходит к дальней поляне, поднимает зверя и трубит ----------
func split_pick(P: Dictionary, skip: Array) -> int:
	var want: Array = ["boar", "bear"] if HU.kind == "boar" else ["deer", "doe"] if HU.kind == "deer" else ["hare", "fox", "pheasant"]
	var best := -1
	var bs := -1e9
	var CL: Array = _L()["clearings"]
	for i in CL.size():
		if i == 0 or i in skip:
			continue
		var cl: Array = CL[i]
		var cx := float(cl[0]) * CT + 8.0
		var cy := float(cl[1]) * CT + 8.0
		var d := Vector2(cx - float(P.x), cy - float(P.y)).length()
		if d < 220.0:
			continue
		var n := 0
		for a in forest_ani():
			if a["st"] != "dead" and gk(a) in want and Vector2(float(a.x) - cx, float(a.y) - cy).length() < 150.0:
				n += 1
		var s := n * 3.0 - d / 300.0 + randf()
		if s > bs:
			bs = s
			best = i
	return best

## имя места леса (roomName по лесу, где бы ни был король)
func _room_at(tx: int, ty: int) -> String:
	var L := _L()
	for r in L["rooms"]:
		if tx >= r[0] and tx <= r[2] and ty >= r[1] and ty <= r[3]:
			return r[4]
	return L["name"]

func cl_name(i: int) -> String:
	var cl: Array = _L()["clearings"][i]
	return _room_at(int(cl[0]), int(cl[1]))

func split_start() -> void:
	var hn := _hn()
	if not on() or HU.get("split") != null or hn.is_empty():
		return
	if not any_hound():
		_toast("Гончих нет — разделяться не с кем.")
		return
	var P := _P()
	var ci := split_pick(P, [])
	if ci < 0:
		_say(hn, "Тут и так всё рядом, государь.", 3)
		return
	HU["split"] = {"st": "go", "ci": ci, "t": now(), "tried": [ci], "hornT": 0.0, "hornAt": -9.0}
	hn["path"] = null
	var nm := cl_name(ci)
	var cl: Array = _L()["clearings"][ci]
	_say(hn, "Добро, государь. Я с гончими — к «" + nm + "». Подниму зверя — протрублю. Идите на рог!", 5)
	Snd.sfx("bark")
	_toast("Ловчий с гончими уходит " + dir_word(float(cl[0]) * CT - float(P.x), float(cl[1]) * CT - float(P.y)) + ", к «" + nm + "». G — протрубить, чтобы вернулся.")

func split_q() -> Variant:
	for a in c.ani:
		if int(a["game"]) == 2 and a["loc"] == "forest" and a["st"] == "chase" and a.get("q") != null and a.q.st != "dead" and a.q.st != "fly":
			return a.q
	return null

func split_end(hn: Dictionary, q: Variant) -> void:
	HU["split"] = null
	if not hn.is_empty():
		hn["path"] = null
		hn["moving"] = false      # в Godot «идёт» = moving или path: после splitMove сбросить
		_say(hn, ("Вот он, государь! Держат — бейте!" if q.st == "bay" else "Гоним, государь! За мной!") if q != null else "Вот и вы, государь. Дальше — вместе.", 3.5)

func split_call() -> void:
	var S: Variant = HU.get("split") if HU != null else null
	if S == null or S.st == "back":
		return
	S["st"] = "back"
	Snd.sfx("horn")
	_toast("Вы трубите в рог: ловчий с гончими возвращается.")
	var hn := _hn()
	if not hn.is_empty():
		hn["path"] = null

func split_key() -> void:
	if not on():
		return
	if HU.get("split") != null:
		split_call()
	else:
		split_start()

func split_word() -> String:
	var S: Variant = HU.get("split")
	var P := _P()
	var hn := _hn()
	if hn.is_empty():
		return "Без ловчего"
	if S == null:
		return "Ловчий рядом  ·  G — разделиться"
	var dw := dir_word(float(hn.x) - float(P.x), float(hn.y) - float(P.y))
	var q: Variant = split_q() if S.st == "drive" else null
	if S.st == "back":
		return "Ловчий возвращается — " + dw
	if q != null:
		return "Рог! Гончие " + ("держат " if q.st == "bay" else "гонят ") + g_acc(gk(q)) + " — " + dw
	return "Ловчий " + ("идёт к" if S.st == "go" else "ищет у") + " «" + cl_name(int(S.ci)) + "» — " + dw + "  ·  G — созвать"

func split_upd(P: Dictionary) -> void:
	var S: Variant = HU.get("split")
	if S == null:
		return
	var hn := _hn()
	if hn.is_empty():
		HU["split"] = null
		return
	var dk := dist(hn, P)
	var q: Variant = null if S.st == "back" else split_q()
	if dk < 100.0 and now() - float(S.t) > 4.0:
		split_end(hn, q)
		return
	if q != null:
		S["st"] = "drive"
		if now() > float(S.hornT):
			S["hornT"] = now() + (7.0 if q.st == "bay" else 10.0)
			S["hornAt"] = now()
			Snd.sfx("horn_short")
			_toast("Рог ловчего — " + dir_word(float(hn.x) - float(P.x), float(hn.y) - float(P.y)) + ": гончие " + ("держат " if q.st == "bay" else "гонят ") + g_acc(gk(q)) + "!")
		if q.st == "bay" and not JS.t(q.get("sB")):
			q["sB"] = 1
			q["bt"] = float(q.get("bt", 0.0)) + randf_range(7, 10)
		return
	if S.st == "drive":
		S["st"] = "search"
		S["t2"] = now()
	if S.st == "go":
		var cl: Array = _L()["clearings"][S.ci]
		if Vector2(float(hn.x) - float(cl[0]) * CT - 8.0, float(hn.y) - float(cl[1]) * CT - 12.0).length() < 56.0 or now() - float(S.t) > 90.0:
			S["st"] = "search"
			S["t2"] = now()
	if S.st == "search" and now() - float(S.t2) > 26.0:
		var ci := split_pick(P, S.tried) if (S.tried as Array).size() < 3 else -1
		hn["path"] = null
		Snd.sfx("horn_low")
		S["hornAt"] = now()
		if ci >= 0:
			S["ci"] = ci
			(S.tried as Array).append(ci)
			S["st"] = "go"
			S["t"] = now()
			_toast("Ловчий трубит коротко: здесь пусто, идёт дальше — к «" + cl_name(ci) + "».")
		else:
			S["st"] = "back"
			_toast("Ловчий трубит отбой поиску: зверя не нашёл, возвращается к вам.")

# ---------- выезд: почему нельзя (huntWhyNot + sick2.js), псарня (huntAct), спутник (huntComp), начало (huntStart) ----------
func why_hunt_not() -> Variant:
	var k := _k()
	var h := Game.hour_abs()
	var C: Dictionary = Sim.G.court
	var w := _wk()
	if Hurt.hurt(k):
		var n := int(JS.n(k.wound) - _day())
		return Hurt.wound_not(k) + ", государь. Лекарь велел беречься — ещё " + str(n) + " " + Sim.plural(n, "день", "дня", "дней") + "."
	if C.get("huntDay") != null and JS.n(C.huntDay) == _day():
		return "Собаки сегодня уже набегались, государь. Завтра на рассвете — хоть на медведя!"
	if h < 6.0:
		return "Ещё темно, государь. Выедем с рассветом, к шести."
	if h >= 16.0:
		return "Поздно, государь: до темноты зверя не поднять. Завтра с утра."
	if w == "storm" or w == "blizzard":
		return "В такую непогоду собаки след не возьмут, государь. Переждём."
	var s: String = Hurt.sick_not(k)
	if s != "":
		return s + ". Охота подождёт."
	return null

func act() -> void:
	if HU != null or JS.t(Sim.G.get("visit")):
		return
	var hn := _hn()
	var who: Variant = hn if not hn.is_empty() else null
	var o := {} if who != null else {"name": "Псарня"}
	var why: Variant = why_hunt_not()
	if why != null:
		c.hud.say(who, why, o)
		print("HUNT NOT ", why)
		return
	var ch: Array = [{"t": String(HUNTK.deer.n) + " — с гончими", "tip": HUNTK.deer.d, "fx": func() -> void: comp("deer")},
		{"t": String(HUNTK.boar.n) + " (опасно)", "tip": HUNTK.boar.d, "fx": func() -> void: comp("boar")}]
	if SimDyn.projDone("falconry"):
		ch.append({"t": HUNTK.falcon.n, "tip": HUNTK.falcon.d, "fx": func() -> void: comp("falcon")})
	else:
		ch.append({"t": HUNTK.falcon.n, "tip": "Нужна соколятня — её можно заложить у стола зодчего (P).", "ok": func() -> bool: return false,
			"why": "Сначала постройте соколятню (P — замыслы и стройки).", "fx": func() -> void: pass})
	ch.append({"t": "Не сегодня", "fx": func() -> void: pass})
	o["choices"] = ch
	o["esc"] = ch.size() - 1
	c.hud.say(who, _pick(["Гончие застоялись, государь! На кого пойдём?", "Кони осёдланы, собаки на сворах. Куда прикажете?", "Лес нынче полон зверя, государь. Выбирайте."]), o)
	print("HUNT MENU ", ch.size())

func comp_name(n: Dictionary) -> String:
	var ch: Variant = c.people.real(n)
	var nm: String = String(ch.name) if ch != null else String(n.get("name", ""))
	if String(n.get("seat", "")) != "":
		return String(n.name)            # npcTitle: «Маршал: …»
	if String(n.key).begins_with("ward"):
		return "Воспитанник: " + nm
	return SimDyn.famRole(ch) + ": " + nm

func comp(kind: String) -> void:
	var cand: Array = []
	var sp: Dictionary = c.npc_by("spouse")
	var spc: Variant = c.people.real(sp) if not sp.is_empty() else null
	if spc != null and JS.t(spc.alive) and JS.n(spc.get("prison", -1)) < 0:
		cand.append(sp)
	for n in c.npcs:
		var ch: Variant = c.people.real(n)
		if ch != null and (String(n.key).begins_with("kid") or String(n.key).begins_with("ward")) and JS.n(ch.age) >= 14 and JS.n(ch.get("prison", -1)) < 0:
			cand.append(n)
	for s in SEATS:
		var n: Dictionary = c.npc_by("seat_" + s)
		var ch: Variant = c.people.real(n) if not n.is_empty() else null
		if ch != null and JS.n(ch.get("prison", -1)) < 0:
			cand.append(n)
	var ch2: Array = []
	for n in cand.slice(0, 5):
		var nn: Dictionary = n
		ch2.append({"t": comp_name(nn), "tip": "Расположение +4…8" + (", и день вместе" if nn.key == "spouse" else "") + ".", "fx": func() -> void: start(kind, nn)})
	ch2.append({"t": "Без свиты — только ловчий и собаки", "fx": func() -> void: start(kind, {})})
	var hn := _hn()
	c.hud.say(hn if not hn.is_empty() else null, "Кого возьмёте с собой, государь?", {"choices": ch2, "esc": ch2.size() - 1})

func start(kind: String, comp_n: Dictionary) -> void:
	if HU != null:
		return
	var C: Dictionary = Sim.G.court
	C["huntDay"] = _day()
	HU = {"kind": kind, "day": Game.day, "arrows": 15, "bag": [], "comp": String(comp_n.key) if not comp_n.is_empty() else null, "shots": 0, "hits": 0,
		"fl": [], "stuck": [], "fal": null, "aim": null, "quarry": null, "cool": 0.0, "sayT": now() + 7.0, "ended": 0,
		"wpn": String(JS.o(C.get("huntWpn"), "bow")), "jav": 4, "jf": [], "sj": [], "blood": [], "jshots": 0, "jhits": 0, "pk": 0, "pkh": 0, "windT": now() + 9.0,
		"ar": [], "sa": [], "draw": null, "split": null, "t0": now(), "cShot": now() + 8.0}
	print("HUNT START ", kind, " ", HU.comp)
	c.fade_to(func() -> void: _start_fade(kind, comp_n))

func _start_fade(kind: String, comp_n: Dictionary) -> void:
	var sp: Dictionary = _L()["spots"]["f_gate"]
	var P := _P()
	c.go_loc("forest")
	P["x"] = float(sp.x)
	P["y"] = float(sp.y)
	P["dir"] = "right"
	P["sit"] = null
	P["lie"] = false
	c.path = []
	c.on_arrive = Callable()
	fauna(kind)
	var fol: Array = []
	var hn := _hn()
	if not hn.is_empty():
		fol.append(hn)
	if not comp_n.is_empty():
		fol.append(comp_n)
	for i in fol.size():
		var n: Dictionary = fol[i]
		n["follow"] = true
		n["hold"] = true
		n["away"] = false
		n["sit"] = null
		n["lie"] = false
		n["goal"] = null
		n["path"] = null
		n["loc"] = "forest"
		n["dir"] = "right"
		n["bub"] = ""
		n["x"] = float(sp.x) - 12.0 - i * 10.0
		n["y"] = float(sp.y) + (-16.0 if i else 16.0)
	var hs: Array = c.ani.filter(func(a): return a["kind"] == "hound")
	for i in mini(hs.size(), 2 if kind == "falcon" else 3):
		var a: Dictionary = hs[i]
		a["game"] = 2
		a["loc"] = "forest"
		a["st"] = "heel"
		a["q"] = null
		a["pth"] = null
		a["moving"] = false
		a["oa"] = i * 2.1
		a["x"] = float(sp.x) + 20.0 + i * 10.0
		a["y"] = float(sp.y) + (i - 1) * 10.0
	c.snap_cam()
	c.parts.clear()
	c.room = ""
	Snd.sfx("horn")
	_toast(String(HUNTK[kind].n) + ": в королевский лес!")

# ---------- ловчий: подсказки (huntHint + подранок hunt2.js), разговор (hunt3.js), болтовня ----------
func hint() -> String:
	if HU == null:
		return ""
	var P := _P()
	var w: Variant = null
	var wd := 1e9
	for a in forest_ani():
		if JS.t(a.get("hurt")) and a["st"] != "dead":
			var d := dist(a, P)
			if d < wd:
				wd = d
				w = a
	if w != null:
		var g := game_of(w)
		var f := JS.t(g.get("f"))
		return ((("Залегла раненая " if f else "Залёг раненый ") + String(g.n)) if w.st == "lie" else "Кровь на траве, государь: " + ("раненая " if f else "раненый ") + String(g.n) + " уходит") \
			+ " — " + dir_word(float(w.x) - float(P.x), float(w.y) - float(P.y)) + (", совсем рядом" if wd < 170.0 else "") + "." + (" Берите рогатину." if w.st == "lie" and JS.t(g.get("fierce")) else "")
	var s := _hint0(P)
	return s + " " + wind_tip() if randf() < 0.3 else s

func _hint0(P: Dictionary) -> String:
	var want: Array = ["deer", "doe"] if HU.kind == "deer" else ["boar"] if HU.kind == "boar" else ["pheasant", "duck", "hare"]
	var best: Variant = null
	var bd := 1e9
	for a in forest_ani():
		if a["st"] != "dead" and gk(a) in want:
			var d := dist(a, P)
			if d < bd:
				bd = d
				best = a
	if best == null:
		return _pick(["Пусто кругом, государь. Зверь ушёл в самую чащу.", "Тихо… Даже сойки молчат. Поищем у ручья?"])
	if bd < 170.0:
		return _pick(["Тише, государь… Зверь рядом.", "Чуете? Совсем близко. Ступайте мягче — с Shift."])
	var g := game_of(best)
	var rn := _room_at(floori(float(best.x) / CT), floori(float(best.y) / CT))
	return "Свежий след, государь: " + String(g.n) + " — " + dir_word(float(best.x) - float(P.x), float(best.y) - float(P.y)) + (", там «" + rn + "»" if rn != "" and rn != String(_L().name) else "") + "."

## разговор с ловчим (n.talk): без охоты — псарня; на охоте — дальше, разделиться, отбой
func hunter_talk(n: Dictionary) -> void:
	if HU == null:
		act()
		return
	var ch: Array = [{"t": "Охотимся дальше", "fx": func() -> void: pass}]
	if on() and HU.get("split") == null and any_hound():
		ch.append({"t": "Разделимся: ищи зверя с гончими (G)", "tip": "Ловчий с гончими уйдёт к дальней поляне, поднимет зверя и протрубит в рог — идите на рог. Гончие продержат зверя дольше. Но без ловчего рядом опаснее: кабан, шальная стрела.",
			"fx": func() -> void: split_start()})
	ch.append({"t": "Трубить отбой — домой", "fx": func() -> void: end_hunt("horn")})
	c.hud.say(n, hint() + " Стрел в колчане: " + str(HU.arrows) + ".", {"choices": ch, "esc": 0})

func chatter() -> void:
	if now() < float(HU.sayT):
		return
	HU["sayT"] = now() + randf_range(13, 22)
	var hn := _hn()
	var cn: Dictionary = c.npc_by(String(HU.comp)) if HU.comp != null else {}
	var k := _k()
	if not cn.is_empty() and randf() < 0.4 and not _bub(cn):
		var L0: Array
		if cn.key == "spouse":
			L0 = ["Как хорошо вырваться из душных покоев!", "Обещайте мне беречься кабанов.", "Смотрите, какие следы!"]
		elif String(cn.key).begins_with("kid"):
			L0 = [("Матушка" if JS.t(k.get("fem")) else "Отец") + ", а можно мне выстрелить?", "Я видел оленя! Вон там, за деревьями!", "Когда-нибудь я возьму медведя!"]
		else:
			L0 = ["Добрая охота, государь.", "Свежий воздух лучше любого совета.", "Говорят, ваш дед взял здесь медведя."]
		_say(cn, _pick(L0), 4)
		return
	if not hn.is_empty() and not _bub(hn):
		_say(hn, hint(), 4.5)

# ---------- конец: рог, ворота, сумерки — или рана (huntDusk, huntRelease, huntEnd + hurt.js + sick.js, huntAbort) ----------
func dusk() -> void:
	if not on() or c.hud.modal_open() or c.fade > 0.0:
		return
	if Game.day != int(HU.day):
		end_hunt("dusk")
		return
	HU["duskAsked"] = 1
	var hn := _hn()
	c.hud.say(hn if not hn.is_empty() else null, "Смеркается, государь. В темноте зверя не возьмёшь — пора домой.", {"choices": [{"t": "Трубить отбой", "fx": func() -> void: end_hunt("dusk")}], "esc": 0})

func release() -> void:
	var P := _P()
	var i := 0
	for n in c.npcs:
		if not JS.t(n.get("follow")):
			continue
		n["follow"] = false
		n["hold"] = false
		n["path"] = null
		n["goal"] = null
		n["cur"] = ""
		n["bub"] = ""
		n["moving"] = false
		var e: Vector2i = c.near_free("yard", floori(float(P.x) / CT) - 1 - i, floori(float(P.y) / CT) + 1)
		n["loc"] = "yard"
		n["x"] = e.x * CT + 8.0
		n["y"] = e.y * CT + 12.0
		i += 1
	for a in c.ani:
		if int(a["game"]) == 2:
			var r: Array = a["r"]
			a["game"] = 0
			a["loc"] = "yard"
			a["st"] = ""
			a["q"] = null
			a["pth"] = null
			a["moving"] = false
			a["run"] = false
			a["t"] = 1.0
			a["x"] = (r[0] + randf() * (r[2] - r[0] + 1)) * CT
			a["y"] = (r[1] + randf() * (r[3] - r[1] + 1)) * CT

func end_hunt(why: String, door_: Variant = null) -> void:
	if not on():
		return
	var k := _k()
	HU["ended"] = 1
	if why == "wound" and JS.n(JS.o(k.get("woundK"), 2.0)) >= 2 and Hurt.hurt(k):
		c.heal.start({"from": "hunt", "HU": HU})       # hurt.js: на носилках — домой (litter: release, HU = null, fauna(""))
	else:
		var hu: Dictionary = HU
		c.fade_to(func() -> void: _end_fade(hu, why, door_))
	# sick.js: старого короля в погоне может хватить удар (Филипп IV, 1314)
	if why != "wound" and JS.t(k.alive) and not JS.t(k.get("ill")) and JS.n(k.age) >= 55 and randf() < 0.012 + (JS.n(k.age) - 55.0) * 0.002:
		SimSick.sickStart(k, "stroke", "на охоте")
		_toast("На обратном пути у короля немеет рука, лицо перекашивает. Удар!")
	print("HUNT END ", why)

func _end_fade(hu: Dictionary, why: String, door_: Variant) -> void:
	var P := _P()
	c.go_loc("yard")
	P["sit"] = null
	P["lie"] = false
	c.path = []
	c.on_arrive = Callable()
	if door_ != null:
		P["x"] = float(door_.ax)
		P["y"] = float(door_.ay)
		P["dir"] = door_.dir
	else:
		var sp: Dictionary = c.spots["hunter"]
		var e: Vector2i = c.near_free("yard", floori(float(sp.x) / CT) + 1, floori(float(sp.y) / CT))
		P["x"] = e.x * CT + 8.0
		P["y"] = e.y * CT + 11.0
		P["dir"] = "up"
	release()
	HU = null
	fauna("")
	c.snap_cam()
	c.parts.clear()
	Snd.sfx("horn_short")
	summary(hu, why)

func abort() -> void:
	if HU == null:
		return
	HU = null
	release()
	fauna("")

static func unrest_all(v: float) -> void:
	var G := Sim.G
	for P in G.provs:
		if G.setts[Sim.W.provs[int(P.id)].seat].owner == 0.0:
			P.unrest = clampf(float(P.unrest) + v, 0.0, 100.0)

## итоги (huntSummary + huntSum2): мясо, шкуры, престиж, трофеи, спутник, Меч короля, рекорды, рогатина, белый олень
func summary(hu: Dictionary, why: String) -> void:
	var k := _k()
	var C: Dictionary = Sim.G.court
	var bag: Array = hu.bag
	var meat := 0
	var fur := 0
	var pr := 0
	for b in bag:
		var g: Dictionary = GAME[b.k]
		meat += int(g.meat)
		fur += int(g.fur)
		pr += int(g.pr) if b.by == "king" or b.by == "falcon" else floori(int(g.pr) / 2.0)
	if hu.kind == "falcon" and bag.size() >= 2:
		pr += 1
	pr = mini(pr, 6)
	C["grain"] = JS.n(C.get("grain", 0)) + meat
	Sim.G.realms[0].gold = float(Sim.G.realms[0].gold) + fur
	if pr != 0:
		SimCourt.prestige(pr)
	if not (C.get("trophies") is Dictionary):
		C["trophies"] = {}
	for b in bag:
		if b.by == "king" and (b.k == "deer" or b.k == "boar" or b.k == "bear"):
			C.trophies[b.k] = JS.n(C.trophies.get(b.k, 0)) + 1
	var T: Array = []
	if why == "wound":
		T.append("Охота кончилась бедой — но король жив, а это главное.")
	T.append("Добыча: " + bag_str(bag) + "." if not bag.is_empty() else _pick(["Зверь ушёл — сегодня лес оказался хитрее.", "Без добычи. Зато гончие размяли лапы."]))
	if meat:
		T.append("Мясо — на кухню и в погреба: +" + str(meat) + " мер.")
	if fur:
		T.append("Шкуры ловчий продаст: +" + str(fur) + " зол.")
	if pr:
		T.append("Слава охотника: престиж +" + str(pr) + ".")
	var cn: Dictionary = c.npc_by(String(hu.comp)) if hu.comp != null else {}
	var cc: Variant = c.people.real(cn) if not cn.is_empty() else null
	if cc != null:
		var v := 4 + mini(4, bag.size())
		cc["loy"] = clampf(JS.n(JS.o(cc.get("loy"), 50)) + v, 0.0, 100.0)
		if cn.key == "spouse":
			C["together"] = _day()
		T.append(comp_name(cn) + " — расположение +" + str(v) + ".")
	if bag.any(func(b): return b.by == "king" and (b.k == "boar" or b.k == "bear")):
		k["mx"] = JS.n(k.get("mx", 0)) + 1
		if JS.n(k.mx) >= 6:
			k["mx"] = 0.0
			k["mar"] = minf(20.0, JS.n(k.mar) + 1)
			T.append("Рука крепнет: Меч короля +1.")
	sum2(hu, T)
	if int(hu.shots) > 0:
		T.append("Стрел пущено: " + str(hu.shots) + ", в цель: " + str(hu.hits) + ".")
	Sim.glog("Королевская охота" + (": " + bag_str(bag) if not bag.is_empty() else " без добычи") + ".", "good" if not bag.is_empty() else "info")
	c.hud.say(null, " ".join(T), {"name": "Итоги охоты"})
	print("HUNT SUM ", bag.size(), " ", why)

func sum2(hu: Dictionary, T: Array) -> void:
	var C: Dictionary = Sim.G.court
	if not (C.get("huntRec") is Dictionary):
		C["huntRec"] = {}
	var rec: Dictionary = C.huntRec
	var best := {"deer": 0, "boar": 0, "bear": 0}
	var bag: Array = hu.bag
	var pr := 0
	for b in bag:
		if b.by == "king":
			if b.k == "deer" and int(b.get("pts", 0)) > int(best.deer):
				best.deer = int(b.pts)
			if (b.k == "boar" or b.k == "bear") and int(b.get("wt", 0)) > int(best[b.k]):
				best[b.k] = int(b.wt)
	for key in ["deer", "boar", "bear"]:
		var v: int = best[key]
		if v == 0:
			continue
		var s := "олень, рога в " + tines(v) if key == "deer" else ("секач в " if key == "boar" else "медведь в ") + poods(v)
		if not JS.t(rec.get(key)):
			rec[key] = v
			T.append("Трофей: " + s + " — ловчий записал его в книгу двора.")
		elif v > JS.n(rec[key]):
			T.append("Трофей: " + s + " — новый рекорд двора (было " + JS.s(rec[key]) + ")! Престиж +1.")
			rec[key] = v
			pr += 1
		else:
			T.append("Трофей: " + s + " (рекорд двора — " + JS.s(rec[key]) + ").")
	var pk := mini(2, bag.filter(func(b): return JS.t(b.get("pike")) and JS.t(GAME[b.k].get("fierce"))).size())
	if pk:
		pr += pk
		T.append(("Звери взяты" if pk > 1 else "Зверь взят") + " на рогатину — о такой охоте споют менестрели: престиж +" + str(pk) + ".")
	if hu.get("hart") != null:
		var hb: Variant = null
		for b in bag:
			if JS.t(b.get("hart")):
				hb = b
				break
		if hb != null and hb.by == "king":
			pr += 3
			unrest_all(2)
			T.append("Белый олень пал от вашей руки. Слава громкая — престиж +3, — но старики качают головами: не к добру.")
		elif hb != null:
			unrest_all(2)
			T.append("Гончие взяли белого оленя… Ловчий хмур: не к добру.")
		elif JS.t(hu.get("hartSeen")):
			pr += 1
			unrest_all(-4)
			T.append("Белого оленя вы пощадили — добрый знак. Молва о милостивом короле разойдётся по округе: престиж +1, в провинциях спокойнее.")
	if pr:
		SimCourt.prestige(pr)
	if int(hu.get("jshots", 0)) > 0:
		T.append("Сулиц метнуто: " + str(hu.jshots) + ", в цель: " + str(hu.jhits) + ".")

# ---------- хуки двора: ворота леса (DOOR_EXT), клавиши (CKEY_EXT), цель «E» (TARGET_EXT), щелчок (PICK_EXT), мышь ----------
func door(d: Dictionary) -> bool:
	if not on() or not in_forest() or d.to != "yard":
		return false
	var P := _P()
	P["x"] = float(P.x) + 14.0
	c.path = []
	c.on_arrive = Callable()
	var hn := _hn()
	c.hud.say(hn if not hn.is_empty() else null, "Уже домой, государь? " + ("Добыча славная!" if not (HU.bag as Array).is_empty() else "Зверь ещё не взят…"),
		{"choices": [{"t": "Трубить отбой — домой", "fx": func() -> void: end_hunt("gate", d)}, {"t": "Ещё поохотимся", "fx": func() -> void: pass}], "esc": 1})
	return true

## клавиша (CKEY_EXT hunt2 + hunt3): Q — оружие, G — ловчий, E/Enter при своём прицеле без цели — подсказка
func key(k: int) -> bool:
	if not on() or not in_forest():
		return false
	if k == KEY_Q:
		wpn_next()
		return true
	if k == KEY_G:
		split_key()
		return true
	if (k == KEY_E or k == KEY_ENTER) and own() and c.nearest_target().is_empty():
		if now() > float(HU.get("eTip", 0.0)):
			HU["eTip"] = now() + 6.0
			_toast("Свой прицел: зажмите левую кнопку мыши — натянуть, отпустите — выстрел. Прицел ловчего (E) — в панели охоты.")
		return true
	return false

func target() -> Dictionary:
	if on() and HU.get("aim") != null and in_forest():
		return target_of(HU.aim)
	return {}

## щелчок по зверю (PICK_EXT): свой прицел (hunt3.js, первым) — подсказка; иначе — прицел ловчего (hunt.js)
func pick(wx: float, wy: float) -> Dictionary:
	if not on() or not in_forest():
		return {}
	var P := _P()
	if own():
		var o := _pick3(wx, wy, P)
		if not o.is_empty():
			return o
	for a in forest_ani():
		if a["st"] == "dead":
			continue
		var s: Vector2 = c.fa_box(a)
		var hw := s.x / 2.0 + 2.0
		var top: float = float(a.y) - s.y - float(a.h) - 2.0
		if wx < float(a.x) - hw or wx > float(a.x) + hw or wy < top or wy > float(a.y) + 3.0:
			continue
		var g := game_of(a)
		var d := dist(a, P)
		var use_f: bool = HU.kind == "falcon" and HU.get("fal") == null and (JS.t(g.get("bird")) or a["kind"] == "hare")
		if can_shoot(a, d, use_f, P):
			return target_of({"a": a, "d": d, "useF": use_f})
		var why := why_not(a, d, use_f)
		return {"label": ucf(String(g.n)), "sub": why, "x": a.x, "y": float(a.y) - 8.0 - float(a.h), "d": 1e9, "go": func() -> void: _toast("Не выстрелить: " + why + ".")}
	return {}

func _pick3(wx: float, wy: float, P: Dictionary) -> Dictionary:
	for a in forest_ani():
		if a["st"] == "dead":
			continue
		var b := a_box(a)
		if wx < b[0] - 3 or wx > b[2] + 3 or wy < b[1] - 3 or wy > b[3] + 4:
			continue
		var g := game_of(a)
		if HU.kind == "falcon" and HU.get("fal") == null and (JS.t(g.get("bird")) or a["kind"] == "hare"):
			return {}         # добыча сокола — пусть щелчок решит hunt.js
		var top: float = b[1] + 14.0
		var nm := "Белый олень" if JS.t(a.get("hart")) else ucf(String(g.n))
		if HU.get("draw") != null:
			var d := roundi(dist(a, P))
			var B: Dictionary = HBOW[HU.draw.w]
			return {"label": nm + " · " + str(d) + " шагов", "sub": "не долетит — подойдите ближе" if d > float(B.r0) + float(B.r1) else "", "x": a.x, "y": top, "d": 1e9, "go": func() -> void: pass}
		var f := JS.t(g.get("f"))
		return {"label": nm, "sub": st_word(a) + ((", ранена" if f else ", ранен") if JS.t(a.get("hurt")) else "") + ((" · стрел в " + ("ней" if f else "нём") + ": " + str(a.arw)) if int(a.get("arw", 0)) > 0 else "")
			+ " · зажмите кнопку — " + ("натянуть лук" if HU.wpn == "bow" else "замах"), "x": a.x, "y": top, "d": 1e9, "go": func() -> void:
				if now() > float(HU.get("eTip", 0.0)):
					HU["eTip"] = now() + 4.0
					_toast("Зажмите левую кнопку мыши — " + ("натянуть тетиву" if HU.wpn == "bow" else "замахнуться") + ", наведите и отпустите.")}
	return {}

## мышь (input.down[0] в HTML): нажали левую — с этого времени; на дворе ли (не над окнами)
var hold_court := false
func press(on_court: bool) -> void:
	hold_t = now()
	hold_used = false
	hold_court = on_court

func up() -> void:
	hold_t = -1.0

## обёртка courtClick (hunt3.js): натянут — отпустить (ПКМ — ослабить); щелчок сразу после выстрела — съесть. b: 0 — ЛКМ, 2 — ПКМ
func click_hook(b: int) -> bool:
	if HU == null:
		return false
	if HU.get("draw") != null:
		if b != 0 and hold_t >= 0.0:
			HU["eatUp"] = 1
		draw_loose(b != 0)
		return true
	if (JS.t(HU.get("eatUp")) and b == 0) or (HU.get("drawEnd") != null and now() - float(HU.drawEnd) < 0.08):
		HU["eatUp"] = 0
		return true
	return false

func drawing() -> bool:
	return HU != null and HU.get("draw") != null

## при натяге король идёт медленно (dt × 0.45, в court._tick) и смотрит на прицел
func face_aim() -> void:
	if drawing():
		var P := _P()
		var ap := aim_pt()
		face_to(P, ap.x - float(P.x), ap.y - float(P.y) + 14.0)

# ---------- каждый кадр (UPD_EXT hunt → hunt2 → hurt → hunt3) ----------
func update(dt: float) -> void:
	if JS.t(Sim.G.get("visit")):
		return
	var P := _P()
	if on() and (Game.day != int(HU.day) or (Game.hour_abs() >= 19.5 and not JS.t(HU.get("duskAsked")))):
		dusk()
	if in_forest():
		for a in c.ani:
			if a["loc"] != "forest":
				continue
			if int(a["game"]) == 1:
				game_upd(a, dt, P)
			elif int(a["game"]) == 2 and HU != null:
				hound_upd(a, dt, P)
		if on():
			var i := 0
			for n in c.npcs:
				if JS.t(n.get("follow")):
					fol_upd(n, i, dt, P)
					i += 1
			arrows_upd(dt, P)
			falcon_upd(dt, P)
			HU["aim"] = aim(P)
			chatter()
			var ST: Array = HU.stuck
			if not ST.is_empty() and now() - float(ST[0].t) > 10.0:
				ST.pop_front()
			# hunt2.js
			jav_upd(dt, P)
			var hn := _hn()
			if float(HU.get("windT", 0.0)) > 0.0 and now() > float(HU.windT):
				HU["windT"] = 0.0
				_say(hn, wind_tip(), 4.5)
			var h: Variant = HU.get("hart")
			if h != null and not JS.t(HU.get("hartSeen")) and h.st != "dead" and dist(h, P) < 170.0 and line_free(P.x, float(P.y) - 10.0, h.x, float(h.y) - 10.0):
				HU["hartSeen"] = 1
				_toast("Белый олень! Пощадить — к удаче, взять — к славе.")
				_say(hn, "Государь… белый олень! Старики говорят: кто его пощадит — тому удача, а кто возьмёт — тому слава.", 6)
			var BL: Array = HU.blood
			if not BL.is_empty() and now() - float(BL[0].t) > 240.0:
				BL.pop_front()
	# hurt.js: король встаёт; «Беда на охоте» — через 2,2 с
	if float(P.get("downT", 0.0)) > 0.0 and float(P.downT) <= now():
		P["downT"] = 0.0
		P["hide"] = c.heal.on and c.heal.sh == "litter"
	if pend != null and now() >= float(pend.t) and not c.hud.dlg_open():
		var f: Callable = pend.f
		pend = null
		f.call()
	if on() and in_forest():
		_upd3(dt, P)

func _upd3(dt: float, P: Dictionary) -> void:
	var hn := _hn()
	var md := hold_t >= 0.0
	if own() and not (HU.get("aim") != null and JS.t(HU.aim.useF)):
		HU["aim"] = null           # свой прицел: без рамки ловчего (сокол — по-прежнему E)
	if JS.t(HU.get("eatUp")) and not md:
		HU["eatUp"] = 0
	if own() and not c.blocked() and not (float(P.get("downT", 0.0)) > now()):
		if HU.get("draw") == null and md and not hold_used and now() - hold_t > 0.14:
			hold_used = true
			if hold_court:
				draw_start()
		if HU.get("draw") != null and not md:
			draw_loose(false)
		elif HU.get("draw") != null:
			c.path = []
			c.on_arrive = Callable()
	elif HU.get("draw") != null:
		draw_loose(true)
	ar_upd(dt, P)
	pick_up(P)
	comp_shoot(P)
	split_upd(P)
	if P.moving and not c.sneak and not (float(P.get("downT", 0.0)) > now()) and pend == null:
		var k := _k()
		var near := false
		for h in c.ani:
			if int(h["game"]) == 2 and h["st"] == "chase" and dist(h, P) < 260.0:
				near = true
				break
		if near and randf() < dt * 0.0006 * (2.0 if Game.season() == 3 else 1.0) * (1.6 if JS.n(k.age) > 50 else 1.0) * (1.5 if Hurt.hurt(k) else 1.0):
			chase_fall()
	if not hn.is_empty() and HU.get("split") == null and not _bub(hn):
		if not JS.t(HU.get("boarSaid")):
			for a in forest_ani():
				if JS.t(game_of(a).get("fierce")) and a["st"] != "dead" and dist(a, P) < 150.0 and line_free(P.x, float(P.y) - 10.0, a.x, float(a.y) - 6.0):
					HU["boarSaid"] = 1
					_say(hn, "Медведь, государь! Близко не подходите. Семь стрел ему мало — берегитесь." if a.kind == "bear" else "Секач, государь! Подойдёте близко — кинется. Бейте издали, а кинется — вбок или на рогатину.", 5)
					break
		if not JS.t(HU.get("splitSaid")) and now() - float(HU.t0) > 55.0 and (HU.bag as Array).is_empty() and any_hound():
			HU["splitSaid"] = 1
			_say(hn, "Зверь затаился, государь. Разделимся? Я с гончими обойду дальние поляны и протрублю, как подниму. (G)", 6)

# ---------- рисование (CRENDER, CRENDER2, SPR_EXT в hunt.js, hunt2.js, hunt3.js, hurt.js): узлы c.xnode — каждый кадр ----------
const PO := Color8(27, 20, 32)          # PAL.o
const TIP_PANEL := ["Королевская охота", "Свой прицел: зажмите левую кнопку мыши — король натягивает лук (полоска над головой), наведите и отпустите. Чем дольше натяг — тем дальше и точнее; держать слишком долго — рука дрожит. Правая кнопка — ослабить тетиву.",
	"Под лопатку (чуть позади передней ноги) — вдвое сильнее. Кабану нужно 3–4 стрелы, медведю — 6–7.", "Shift — красться: зверь подпустит ближе. Отбой — через ворота леса или у ловчего."]
const TIP_WPN := ["Оружие (Q — сменить)", "Лук — шагов до 260 при полном натяге, стрел 15; промахнувшиеся стрелы можно подобрать.",
	"Сулицы — 4 метательных копья: шагов до 130, бьют вдвое сильнее стрелы. Промахнулись — подберите.", "Рогатина — вплотную. Бросится кабан или медведь — стойте и примите его на рогатину: слава, но и риск."]
const TIP_AIM := ["Прицел (щёлкните — сменить)", "Свой: натягиваете и целитесь мышью сами — стрела летит, куда навели, с разбросом от руки короля.",
	"Ловчего: E или щелчок по зверю — выстрел по шансу, как прежде. Проще, но слава та же."]
const TIP_SPLIT := ["Разделиться (G)", "Ловчий с гончими уходит к дальней поляне, поднимает зверя и трубит в рог; стрелка на краю экрана покажет, где он. Гончие продержат зверя у бая дольше.",
	"G ещё раз — протрубить, чтобы вернулся. Без ловчего рядом опаснее: некому подстраховать с рогатиной, а спутник может выстрелить сгоряча."]
const TIP_WIND := ["Ветер", "Ветер несёт ваш запах на восток: зверь с подветренной стороны учует издалека. Заходите с востока — подпустит ближе.",
	"Подранок оставляет кровь на траве; устав, он залегает. Гончие найдут его по следу."]
var _hcc := {}                          # цвета по строке
var _xk := {}                           # ключи узлов прошлого кадра: чего нет в этом — убрать

static func _mr(v: float) -> float:     # Math.round
	return floorf(v + 0.5)

func _hc(h: String) -> Color:
	var v: Variant = _hcc.get(h)
	if v == null:
		v = Color.html(h)
		_hcc[h] = v
	return v

func _xdrop(k: String) -> void:
	var nd: Variant = c.xn.get(k)
	if nd != null and is_instance_valid(nd):
		(nd as Node).queue_free()
	c.xn.erase(k)

## drawArrowPx (hunt.js): древко, наконечник (x, y), оперение
func _arrow(nd: Node2D, x: float, y: float, ux: float, uy: float, n: int) -> void:
	var cs := _hc("#d8c090")
	for i in range(1, n):
		nd.draw_rect(Rect2(_mr(x - ux * i), _mr(y - uy * i), 1, 1), cs)
	nd.draw_rect(Rect2(_mr(x), _mr(y), 1, 1), _hc("#e8eef4"))
	nd.draw_rect(Rect2(_mr(x - ux * (n - 1)), _mr(y - uy * (n - 1)), 1, 1), _hc("#c83030"))

## pxLine (hunt2.js): по точкам
func _line(nd: Node2D, col: String, x0: float, y0: float, x1: float, y1: float) -> void:
	var n := maxf(1.0, maxf(absf(x1 - x0), absf(y1 - y0)))
	var cl := _hc(col)
	var i := 0.0
	while i <= n:
		nd.draw_rect(Rect2(_mr(x0 + (x1 - x0) * i / n), _mr(y0 + (y1 - y0) * i / n), 1, 1), cl)
		i += 1.0

## drawJav (hunt2.js): древко сулицы и наконечник
func _jav(nd: Node2D, x: float, y: float, ux: float, uy: float, n: float) -> void:
	_line(nd, "#8a6638", x - ux * n, y - uy * n, x - ux * 2.0, y - uy * 2.0)
	_line(nd, "#d8dee6", x - ux * 2.0, y - uy * 2.0, x, y)

func _r1(nd: Node2D, col: String, x: float, y: float, w: float, h: float) -> void:
	nd.draw_rect(Rect2(x, y, w, h), _hc(col))

## кадр листа зверя (fauna) в мире: зеркально — шириной < 0
static func _fa_spr(nd: Node2D, i: int, x: float, y: float, flip: bool) -> void:
	var r := Art.rect(i)
	if flip:
		nd.draw_texture_rect_region(Art.page(i), Rect2(x + r.size.x, y, -r.size.x, r.size.y), r)
	else:
		nd.draw_texture_rect_region(Art.page(i), Rect2(x, y, r.size.x, r.size.y), r)

## узлы рисунка (после _sync_nodes): кровь — под спрайтами; «!» над встревоженной дичью (и без охоты), стрелы и сулицы,
## сокол, оружие в руках, прицел и натяг — поверх всех, под светом; стрелы в земле, в деревьях и в тушах — по глубине
## среди людей; сбитый с ног король — лёжа (hurt.js); белая вспышка удара — поверх света
func sync() -> void:
	var P := _P()
	var t := now()
	var keys := {}
	if float(P.get("downT", 0.0)) > t:
		P["hide"] = true
		keys["hnt_down"] = 1
		c.xnode("hnt_down", float(P.y), _draw_down)
	if in_forest():
		var al := HU != null
		if not al:
			for a in forest_ani():
				if int(a["game"]) == 1 and (a["st"] == "alert" or a["st"] == "charge"):
					al = true
					break
		if al:
			keys["hnt_x"] = 1
			c.xnode("hnt_x", 0.0, _draw_top, 1)
		if HU != null:
			if not (HU.blood as Array).is_empty():
				keys["hnt_bl"] = 1
				c.xnode("hnt_bl", -1e5, _draw_blood)
			var SA: Array = HU.sa
			for i in SA.size():
				var s: Dictionary = SA[i]
				var k := "hnt_s" + str(i)
				keys[k] = 1
				c.xnode(k, float(s.y) + (2.0 if JS.t(s.tree) else 0.5), _draw_sa.bind(s))
			for i in c.ani.size():
				var a: Dictionary = c.ani[i]
				if a["loc"] == "forest" and int(a["game"]) == 1 and int(a.get("arw", 0)) > 0:
					var k := "hnt_w" + str(i)
					keys[k] = 1
					c.xnode(k, _mr(float(a.y)) + 0.5, _draw_arw.bind(a))
	if t - flash < 0.18:
		keys["hnt_fl"] = 1
		c.xnode("hnt_fl", 0.0, _draw_flash, 70)
	for k in _xk:
		if not keys.has(k):
			_xdrop(k)
	_xk = keys

## drawLying (hurt.js): тень и король на земле
func _draw_down(nd: Node2D) -> void:
	var P := _P()
	var shi: int = Art.D.get("shadowMid", Art.D["shadow"])
	var r := Art.rect(shi)
	nd.draw_texture_rect_region(Art.page(shi), Rect2(_mr(float(P.x) - 7.0), _mr(float(P.y)) - 3.0, r.size.x, r.size.y), r)
	Hurt.lying(nd, P.sheet, float(P.x), float(P.y) - 5.0, -PI / 2.0 if P.dir == "left" else PI / 2.0, -nd.position.y)

## кровь подранка на траве (hunt2.js CRENDER): бледнеет за 5 минут
func _draw_blood(nd: Node2D) -> void:
	if HU == null:
		return
	var t := now()
	for b in HU.blood:
		var col := _hc("#7a1010" if float(b.r) < 0.5 else "#9a1c1c")
		col.a = clampf(1.0 - (t - float(b.t)) / 300.0, 0.45, 0.95)
		var x := _mr(float(b.x))
		var y := _mr(float(b.y))
		if JS.t(b.big):
			nd.draw_rect(Rect2(x - 2, y, 4, 1), col)
			nd.draw_rect(Rect2(x - 1, y - 1, 2, 1), col)
			nd.draw_rect(Rect2(x + 3, y - 1, 1, 1), col)
			nd.draw_rect(Rect2(x - 4, y + 1, 1, 1), col)
		else:
			nd.draw_rect(Rect2(x, y, 1, 1), col)
			if float(b.r) > 0.6:
				nd.draw_rect(Rect2(x + 1, y + (1.0 if float(b.r) > 0.8 else 0.0), 1, 1), col)

## стрела в земле или в дереве (hunt3.js SPR_EXT)
func _draw_sa(nd: Node2D, s: Dictionary) -> void:
	if JS.t(s.tree):
		_arrow(nd, float(s.x) - float(s.ux) * 2.0, float(s.y) - float(s.h) - 2.0, float(s.ux), float(s.uy) * 0.3, 6)
	else:
		_arrow(nd, float(s.x), float(s.y), float(s.ux) * 0.7, float(s.uy) * 0.4 - 0.55, 6)

## стрелы в туше (hunt3.js SPR_EXT): у бока, у мёртвого — ниже
func _draw_arw(nd: Node2D, a: Dictionary) -> void:
	var s: Vector2 = c.fa_box(a)
	var top: float = float(a.y) - s.y - float(a.get("h", 0.0))
	var fx := -1.0 if JS.t(a.flip) else 1.0
	var c1 := _hc("#d8c090")
	var c2 := _hc("#c83030")
	for i in int(a.get("arw", 0)):
		var x := _mr(float(a.x) + (i - 1) * 3.0 - fx)
		var y := _mr(top + s.y * (0.6 if a.st == "dead" else 0.42) + (i % 2))
		nd.draw_rect(Rect2(x, y - 3, 1, 3), c1)
		nd.draw_rect(Rect2(x + fx, y - 4, 1, 1), c1)
		nd.draw_rect(Rect2(x + fx, y - 5, 1, 1), c2)

## белая вспышка (courtui.js: COURT.flash < 0,18 с) — на весь вид, поверх света
func _draw_flash(nd: Node2D) -> void:
	var k := 1.0 - (now() - flash) / 0.18
	if k <= 0.0:
		return
	var o: Vector2 = c.cam_tl.floor()
	nd.draw_rect(Rect2(o.x - 2.0, o.y - 2.0, 640.0 / c.Z + 6.0, 360.0 / c.Z + 6.0), Color(235 / 255.0, 240 / 255.0, 1.0, 0.5 * k))

## поверх всех, под светом (CRENDER2): hunt.js — «!», стрелы в земле и в полёте, сокол, лук после выстрела;
## hunt2.js — сулицы в земле и в полёте, оружие в руках; hunt3.js — стрелы своего лука, прицел и натяг
func _draw_top(nd: Node2D) -> void:
	var P := _P()
	var t := now()
	for a in forest_ani():
		if int(a["game"]) == 1 and (a["st"] == "alert" or a["st"] == "charge"):
			var s: Vector2 = c.fa_box(a)
			var x := _mr(float(a.x))
			var y := _mr(float(a.y) - s.y - float(a.get("h", 0.0)) - 7.0)
			nd.draw_rect(Rect2(x - 1, y - 1, 3, 7), PO)
			var cl := _hc("#ff4030" if a["st"] == "charge" else "#ffe060")
			nd.draw_rect(Rect2(x, y, 1, 3), cl)
			nd.draw_rect(Rect2(x, y + 4, 1, 1), cl)
	if HU == null:
		return
	for s in HU.stuck:
		var d := Vector2(float(s.dx), float(s.dy)).length()
		if d == 0.0:
			d = 1.0
		_arrow(nd, float(s.x), float(s.y), float(s.dx) / d * 0.7, float(s.dy) / d * 0.4 - 0.5, 6)
	for f in HU.fl:
		var k := minf(1.0, float(f.t) / float(f.dur))
		var x0: float = f.x0
		var y0: float = f.y0
		var tx: float = f.tx
		var ty: float = f.ty
		var dd := Vector2(tx - x0, ty - y0).length()
		if dd == 0.0:
			dd = 1.0
		var arc := sin(PI * k) * minf(14.0, dd * 0.06)
		var vy := (ty - y0) / dd - cos(PI * k) * 0.25
		var vx := (tx - x0) / dd
		var vn := Vector2(vx, vy).length()
		if vn == 0.0:
			vn = 1.0
		_arrow(nd, x0 + (tx - x0) * k, y0 + (ty - y0) * k - arc, vx / vn, vy / vn, 7)
	var F: Variant = HU.get("fal")
	var fs: Variant = c.D["fauna"].get("falcon|") if c.D.has("fauna") else null
	if F != null and fs != null:
		var idx: int = fs[5 if F.st == "kill" else 6 + int(floorf(t * 12.0)) % 4]
		var shi: int = Art.D["shadowSmall"]
		var r := Art.rect(shi)
		nd.draw_texture_rect_region(Art.page(shi), Rect2(_mr(float(F.x) - 4.5), _mr(float(F.y) - 2.0), r.size.x, r.size.y), r)
		var sz := Art.size(idx)
		_fa_spr(nd, idx, _mr(float(F.x) - sz.x / 2.0), _mr(float(F.y) - sz.y - float(F.h)), JS.t(F.flip))
	var bt := float(HU.get("bowT", 0.0))
	if bt > 0.0 and t - bt < 0.3:
		var sx: float = {"left": -1.0, "right": 1.0}.get(P.dir, 0.0)
		var x := _mr(float(P.x) + sx * 7.0)
		var y := _mr(float(P.y) - 22.0)
		var cl := _hc("#6a4020")
		for i in range(-5, 6):
			if sx != 0.0:
				nd.draw_rect(Rect2(x + _mr(sx * (2.0 - i * i / 12.0)), y + i, 1, 1), cl)
			else:
				nd.draw_rect(Rect2(x + i, y + _mr((-1.0 if P.dir == "up" else 1.0) * (2.0 - i * i / 12.0)) + 6.0, 1, 1), cl)
	# hunt2.js: сулицы в земле (с бликом) и в полёте, оружие в руках
	for s in HU.sj:
		var d := Vector2(float(s.dx), float(s.dy)).length()
		if d == 0.0:
			d = 1.0
		var ux := float(s.dx) / d * 0.6
		var x := _mr(float(s.x))
		var y := _mr(float(s.y))
		_jav(nd, x + ux * 2.0, y + 1.0, ux, -0.8, 10.0)
		if sin(t * 4.0 + float(s.x)) > 0.85:
			nd.draw_rect(Rect2(x - _mr(ux * 8.0), y - 8.0, 1, 1), _hc("#fff6c0"))
	for f in HU.jf:
		var k := minf(1.0, float(f.t) / float(f.dur))
		var x0: float = f.x0
		var y0: float = f.y0
		var tx: float = f.tx
		var ty: float = f.ty
		var dd := Vector2(tx - x0, ty - y0).length()
		if dd == 0.0:
			dd = 1.0
		var arc := sin(PI * k) * minf(18.0, dd * 0.12)
		var vy := (ty - y0) / dd - cos(PI * k) * 0.45
		var vx := (tx - x0) / dd
		var vn := Vector2(vx, vy).length()
		if vn == 0.0:
			vn = 1.0
		_jav(nd, x0 + (tx - x0) * k, y0 + (ty - y0) * k - arc, vx / vn, vy / vn, 10.0)
	if P.get("sit") == null and not JS.t(P.get("lie")) and not JS.t(P.get("hide")):
		_held(nd, P)
	n_drawn += 1
	# hunt3.js: стрелы и сулицы своего лука в полёте; прицел — точки, разброс, крест, стрела на тетиве; полоска натяга
	for f in HU.ar:
		if f.w == "jav":
			_jav(nd, float(f.x), float(f.y), float(f.ux), float(f.uy), 10.0)
		else:
			_arrow(nd, float(f.x), float(f.y), float(f.ux), float(f.uy), 7)
	var D: Variant = HU.get("draw")
	if D == null:
		return
	var B: Dictionary = HBOW[D.w]
	var k1 := draw_k(D, t)
	var ap := aim_pt()
	var ox := float(P.x)
	var oy := float(P.y) - 14.0
	var an := atan2(ap.y - oy, ap.x - ox)
	var sp := aim_spread(D)
	var R0: float = float(B.r0) + float(B.r1) * k1
	var full := k1 >= 1.0
	var col := "#f7d35c" if full else "#d8c8a0"
	_dots(nd, ox, oy, R0, an, 10.0, 3.0, col, 0.95)
	for e in [-1.0, 1.0]:
		_dots(nd, ox, oy, R0, an + e * sp, 16.0, 5.0, "#fff0c8", 0.55)
	var ex := _mr(ox + cos(an) * R0)
	var ey := _mr(oy + sin(an) * R0)
	nd.draw_rect(Rect2(ex - 1, ey, 3, 1), _hc(col))
	nd.draw_rect(Rect2(ex, ey - 1, 1, 3), _hc(col))
	if D.w == "bow":
		_arrow(nd, ox + cos(an) * 8.0, oy + sin(an) * 8.0, cos(an), sin(an), int(_mr(6.0 - 3.0 * k1)) + 3)
	var held: float = t - float(D.t0) - float(B.tf) - 1.6
	var mx := _mr(float(P.x) - 8.0)
	var my := _mr(float(P.y) - 38.0)
	var jit := _mr(sin(t * 40.0) * minf(1.0, held)) if held > 0.0 else 0.0
	nd.draw_rect(Rect2(mx - 1, my - 1, 18, 4), PO)
	nd.draw_rect(Rect2(mx, my, 16, 2), _hc("#3a2a1a"))
	if k1 > 0.0:
		nd.draw_rect(Rect2(mx + jit, my, _mr(16.0 * k1), 2), _hc("#ff8040" if held > 0.0 else ("#f7d35c" if full else "#c8a868")))
	n_aim += 1

## точки прицела от плеча до дальности натяга (с тенью)
func _dots(nd: Node2D, ox: float, oy: float, R0: float, a2: float, s0: float, ds: float, col: String, al: float) -> void:
	var co := PO
	co.a = al * 0.7
	var cl := _hc(col)
	cl.a = al
	var s := s0
	while s < R0:
		var x := _mr(ox + cos(a2) * s)
		var y := _mr(oy + sin(a2) * s)
		nd.draw_rect(Rect2(x, y + 1, 1, 1), co)
		nd.draw_rect(Rect2(x, y, 1, 1), cl)
		s += ds

## оружие в руках короля (drawHeld, hunt2.js): лук — сбоку или за спиной, сулица — древком вверх, рогатина — вперёд или вверх
func _held(nd: Node2D, P: Dictionary) -> void:
	var t := now()
	var w: String = HU.wpn
	var x := _mr(float(P.x))
	var y := _mr(float(P.y))
	var d: String = P.dir
	var side := d == "left" or d == "right"
	var s := -1.0 if d == "left" else 1.0
	var tt := float(HU.get("thrT", 0.0))
	var th := 1.0 - (t - tt) / 0.35 if tt > 0.0 and t - tt < 0.35 else 0.0
	var bx := x - 9.0 if d == "up" else x + s * 8.0
	if w == "bow":
		var bt := float(HU.get("bowT", 0.0))
		if bt > 0.0 and t - bt < 0.3:
			return
		if d == "up":   # за спиной
			_line(nd, "#5a3818", x - 5, y - 21, x + 5, y - 7)
			_line(nd, "#b8b098", x - 4, y - 21, x + 6, y - 8)
			return
		for i in range(-6, 7):
			_r1(nd, "#5a3818" if i * i > 25 else "#6e4422", bx + s * _mr(2.0 * (1.0 - i * i / 36.0)), y - 12 + i, 1, 1)
		_line(nd, "#c8c0a8", bx, y - 17, bx, y - 7)
		return
	if w == "jav":
		if th > 0.3 or int(HU.jav) <= 0:
			return
		_line(nd, "#8a6638", bx, y - 2, bx, y - 25)
		_r1(nd, "#d8dee6", bx, y - 29, 1, 4)
		_r1(nd, "#b8c0c8", bx - 1, y - 27, 3, 1)
		return
	if side:
		var push := _mr(th * 5.0)
		var X := func(dx: float) -> float: return x + s * (dx + push)
		_line(nd, "#6e4a26", X.call(-5.0), y - 15, X.call(12.0), y - 9)
		_line(nd, "#3a2a1a", X.call(12.0), y - 12, X.call(12.0), y - 6)
		_r1(nd, "#c0c8d0", minf(X.call(13.0), X.call(15.0)), y - 10, 3, 3)
		_r1(nd, "#eef2f6", minf(X.call(16.0), X.call(17.0)), y - 9, 2, 1)
		return
	_line(nd, "#6e4a26", bx, y - 1, bx, y - 27)
	_line(nd, "#3a2a1a", bx - 2, y - 27, bx + 2, y - 27)
	_r1(nd, "#c0c8d0", bx - 1, y - 32, 3, 5)
	_r1(nd, "#eef2f6", bx, y - 34, 1, 2)

# ---------- поверх двора (HUD_EXT): уголки прицела ловчего, панель охоты и нижняя строка, стрелка к ловчему ----------
func draw_hud(u: Variant) -> void:
	if HU == null:
		return
	var A: Variant = HU.get("aim")
	var ta: Variant = A.get("a") if A != null else null
	if ta != null and ta.st != "dead" and in_forest() and not c.blocked():
		var Z := float(c.Z)
		var s: Vector2 = c.fa_box(ta)
		var p0: Vector2 = c.w2s(Vector2(float(ta.x) - s.x / 2.0 - 2.0, float(ta.y) - s.y - float(ta.get("h", 0.0)) - 2.0))
		var x0 := _mr(p0.x)
		var y0 := _mr(p0.y)
		var w := (s.x + 4.0) * Z
		var h := (s.y + 4.0) * Z
		var col: Color = u.cc("#a8d8ff" if JS.t(A.get("useF")) else ("#ff9a6a" if HU.wpn == "pike" else "#f7d35c"))
		var k := 3.0 + Z * 2.0
		u.ga = 0.75 + 0.25 * sin(now() * 6.0)
		for q in [[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + w, y0 + h, -1, -1]]:
			var cx: float = q[0]
			var cy: float = q[1]
			var xa := cx if q[2] > 0 else cx - k
			var ya := cy if q[3] > 0 else cy - 2.0
			var xb := cx if q[2] > 0 else cx - 2.0
			var yb := cy if q[3] > 0 else cy - k
			u.rect(xa - 1, ya - 1, k + 2, 4, PO)
			u.rect(xb - 1, yb - 1, 4, k + 2, PO)
			u.rect(xa, ya, k, 2, col)
			u.rect(xb, yb, 2, k, col)
		u.ga = 1.0
	_panel(u)
	_split_arrow(u)

## huntPanel (hunt3.js): справа вверху — вид охоты, оружие (Q), прицел, ловчий, ветер, добыча; внизу — что нажимать
func _panel(u: Variant) -> void:
	var F := "s"
	var W := 640.0
	var H := 360.0
	var auto := JS.t(Sim.G.court.get("huntAuto"))
	var fal := ("  ·  сокол: " + ("в полёте" if HU.get("fal") != null else "на перчатке")) if HU.kind == "falcon" else ""
	var t1: String = String(HUNTK[HU.kind].n) + fal + "  ·  до 19:30"
	var tA := "Прицел: ловчего (E, клик)" if auto else "Прицел: свой (зажать ЛКМ)"
	var tS := split_word()
	var t3 := ucf(wind_word()) + " →"
	var BG: Array = HU.bag
	var t4 := ("Добыча: " + bag_str(BG)) if not BG.is_empty() else "Добычи пока нет"
	var ws := [["bow", "лук: " + str(HU.arrows)], ["jav", "сулицы: " + str(HU.jav)], ["pike", "рогатина"]]
	var sep := "   "
	var ww: float = u.tw(sep, F) * 2.0 + u.tw("Q  ", F)
	for e in ws:
		ww += u.tw(e[1], F)
	var w: float = maxf(maxf(maxf(u.tw(t1, F), u.tw(tA, F)), maxf(u.tw(tS, F), u.tw(t3, F))), maxf(u.tw(t4, F), ww)) + 12.0
	var x := W - w - 6.0
	var y := 22.0
	var h := 57.0
	u.rect(x, y, w, h, "rgba(20,14,12,0.84)")
	u.stroke_r(x, y, w, h, "#8a6a3a")
	u.txt(t1, x + 6, y + 3, u.cc("#e8d5a8"), F)
	var cx := x + 6.0
	u.txt("Q", cx, y + 12, u.cc("#8aa8c8"), F)
	cx += u.tw("Q  ", F)
	for e in ws:
		var on_: bool = HU.wpn == e[0]
		u.txt(e[1], cx, y + 12, u.cc("#f7d35c" if on_ else "#8a7a62"), F)
		if on_:
			u.rect(cx, y + 20, u.tw(e[1], F), 1, "#f7d35c")
		cx += u.tw(String(e[1]) + sep, F)
	u.txt(tA, x + 6, y + 21, u.cc("#fff0c0" if u.hov("haim") else "#d8c8a0"), F)
	u.txt(tS, x + 6, y + 30, u.cc("#f7d35c" if HU.get("split") != null else ("#fff0c0" if u.hov("hsplit") else "#a8b898")), F)
	u.txt(t3, x + 6, y + 39, u.cc("#a8c8d8"), F)
	u.txt(t4, x + 6, y + 48, u.cc("#c8e8a0" if not BG.is_empty() else "#a89878"), F)
	u.hit(x, y, w, 10, {"id": "hpanel", "tip": TIP_PANEL, "on": _on_hpanel})
	u.hit(x, y + 10, w, 10, {"id": "hwpn", "tip": TIP_WPN, "on": func(_c): wpn_next()})
	u.hit(x, y + 19, w, 9, {"id": "haim", "tip": TIP_AIM, "on": _on_haim})
	u.hit(x, y + 28, w, 9, {"id": "hsplit", "tip": TIP_SPLIT, "on": func(_c): split_key()})
	u.hit(x, y + 37, w, 20, {"id": "hwind", "tip": TIP_WIND})
	if in_forest() and not c.hud.dlg_open():
		var s: String
		if own():
			s = "Зажать ЛКМ — натянуть, отпустить — " + ("выстрел" if HU.wpn == "bow" else "бросок") + "  ·  ПКМ — ослабить"
		else:
			s = "E / клик по зверю — " + (("сокол или " + String({"bow": "стрела", "jav": "сулица", "pike": "рогатина"}[HU.wpn])) if HU.kind == "falcon" else String(HWPN[HU.wpn].act).to_lower())
		s += "  ·  Q — оружие  ·  G — ловчий  ·  Shift — красться"
		var w2: float = u.tw(s, F) + 10.0
		u.rect(8, H - 14, w2, 11, "rgba(20,14,12,0.8)")
		u.txt(s, 13, H - 11, u.cc("#c8d8e8"), F)

func _on_hpanel(_c: Variant) -> void:
	var n := _hn()
	if HU != null and not n.is_empty() and not c.hud.dlg_open() and HU.get("split") == null:
		hunter_talk(n)

## прицел: свой ↔ ловчего (G.court.huntAuto)
func _on_haim(_c: Variant) -> void:
	var auto := JS.t(Sim.G.court.get("huntAuto"))
	Sim.G.court["huntAuto"] = 0 if auto else 1
	if HU != null:
		HU["draw"] = null
	_toast("Свой прицел: зажмите левую кнопку мыши, наведите, отпустите." if auto else "Прицел ловчего: E или щелчок по зверю.")

## ловчий ушёл с гончими (hunt3.js HUD_EXT): за краем экрана — стрелка с рожком; протрубил — «рог!»
func _split_arrow(u: Variant) -> void:
	var S: Variant = HU.get("split")
	if S == null or JS.t(HU.get("ended")) or not in_forest() or c.blocked():
		return
	var hn := _hn()
	if hn.is_empty():
		return
	var W := 640.0
	var H := 360.0
	var p: Vector2 = c.w2s(Vector2(float(hn.x), float(hn.y) - 16.0))
	var sx := _mr(p.x)
	var sy := _mr(p.y)
	var m := 18.0
	if sx > m and sx < W - m and sy > 40 and sy < H - 26:
		return
	var cx := W / 2.0
	var cy := H / 2.0
	var dx := sx - cx
	var dy := sy - cy
	var k := minf((W / 2.0 - m) / maxf(1.0, absf(dx)), (H / 2.0 - 32.0) / maxf(1.0, absf(dy)))
	var x := _mr(cx + dx * k)
	var y := _mr(cy + dy * k)
	var an := atan2(dy, dx)
	var hot := now() - float(JS.o(S.get("hornAt"), -9.0)) < 2.5
	var col: Color = u.cc("#f7d35c" if hot else "#c8b890")
	u.ga = 0.8 + 0.2 * sin(now() * 12.0) if hot else 0.85
	var ca := cos(an)
	var sa := sin(an)
	var tip := Vector2(x + ca * 14.0, y + sa * 14.0)
	for i in range(-4, 5):
		var bx := x + ca * 7.0 - sa * i * 0.9
		var by := y + sa * 7.0 + ca * i * 0.9
		u.pline(_mr(bx), _mr(by), _mr(tip.x), _mr(tip.y), col)
	_disc(u, x, y, 8, PO)
	_disc(u, x, y, 7, u.cc("#3a2a1a"))
	u.rect(x - 4, y - 1, 3, 3, col)      # рожок: мундштук, тулово, раструб
	u.rect(x - 1, y - 2, 3, 5, col)
	u.rect(x + 2, y - 3, 2, 7, col)
	var t := "рог!" if hot else "ловчий"
	var tx := clampf(_mr(x - u.tw(t, "s") / 2.0), 4.0, W - u.tw(t, "s") - 4.0)
	var ty := y - 16.0 if y > H / 2.0 else y + 8.0
	u.txt(t, tx, ty, col, "s")
	u.ga = 1.0

## disc (engine.js): круг по строкам
static func _disc(u: Variant, cx: float, cy: float, r: int, col: Color) -> void:
	for yy in range(-r, r + 1):
		var w := floorf(sqrt(r * r - yy * yy + r * 0.8))
		u.rect(cx - w, cy + yy, w * 2.0 + 1.0, 1, col)

# ---------- для проверок: команды (court.cmd «hunt») и самопроверка без экрана (-- --hunt) ----------
var aim_o: Variant = null               # точка прицела вместо мыши (hunt draw)
var n_drawn := 0                        # рисунок поверх леса сделан (кадров)
var n_aim := 0                          # прицел и полоска натяга нарисованы (кадров)

## ближайший живой зверь леса (вид: kind, gk или "" — любой), кроме белого оленя
func _nearest(kind: String) -> Variant:
	var P := _P()
	var best: Variant = null
	var bd := 1e9
	for a in forest_ani():
		if a["st"] != "dead" and not JS.t(a.get("hart")) and (kind == "" or a["kind"] == kind or gk(a) == kind):
			var d := dist(a, P)
			if d < bd:
				bd = d
				best = a
	return best

## король — в трёх клетках к востоку от зверя (как __go в tests/hunt3.json), зверь пасётся
func _go_near(a: Dictionary) -> void:
	var P := _P()
	var e: Vector2i = c.near_free("forest", floori(float(a.x) / CT) + 3, floori(float(a.y) / CT))
	P["x"] = e.x * CT + 8.0
	P["y"] = e.y * CT + 12.0
	P["moving"] = false
	c.path = []
	c.on_arrive = Callable()
	a["st"] = "graze"
	a["moving"] = false
	c.snap_cam()

## hunt start вид [ключ спутника] — сразу в лес (без псарни); kill [вид] — сразить ближайшего зверя (стрела короля);
## end — отбой (рог); hart — белый олень наверняка; near [вид] — король у зверя; shoot — выстрел по зверю в прицеле ловчего (E);
## split — разделиться или созвать (G); draw — натянуть свой лук в полную силу на ближайшего зверя; loose — отпустить;
## auto 0|1 — прицел свой или ловчего; fall — король сбит с ног (ушиб)
func cmd(p: PackedStringArray) -> void:
	var P := _P()
	var arg := p[2] if p.size() > 2 else ""
	match p[1]:
		"start":
			if HU == null and not c.hud.is_open():
				Sim.G.court.erase("huntDay")
				start(arg if arg != "" else "deer", c.npc_by(p[3]) if p.size() > 3 else {})
		"kill":
			var a: Variant = _nearest(arg)
			if a != null:
				kill(a, "king")
		"end":
			end_hunt("horn")
		"hart":
			hart_f = true
		"near":
			var a: Variant = _nearest(arg)
			if a != null and in_forest():
				_go_near(a)
		"shoot":
			var A: Variant = aim(P) if on() else null
			if A != null:
				HU["cool"] = 0.0
				shoot(A.a, A.useF)
		"split":
			split_key()
		"draw":
			if on():
				var a: Variant = _nearest(arg)
				aim_o = Vector2(float(a.x), float(a.y) - 8.0) if a != null else null
				HU["cool"] = 0.0
				draw_start()
				if HU.get("draw") != null:
					HU.draw.t0 = float(HU.draw.t0) - float(HBOW[HU.draw.w].tf)
				hold_t = now()            # кнопка «зажата»: натяг держится до hunt loose
				hold_used = true
		"loose":
			if on() and HU.get("draw") != null:
				hold_t = -1.0
				draw_loose(false)
			aim_o = null
		"auto":
			Sim.G.court["huntAuto"] = int(arg) if arg != "" else 1
		"fall":
			mishap(1, "бедро", "корень", "Конь споткнулся о корень — вы на земле. Ушиб.", "")
	print("HUNT ", " ".join(p.slice(1)), " → ", JSON.stringify(state()))

func _close() -> void:
	while c.hud.dlg != null:
		c.hud.close_dlg()

## кадры двора, пока cond не станет true (не больше n)
func _until(cond: Callable, n := 2000) -> int:
	for i in n:
		if cond.call():
			return i
		c._tick(0.05)
	return -1

func _hour(h: float) -> void:
	Game.set_hour(h)
	c.last_ha = Game.day * 24.0 + Game.hour_abs()

func _dlg_text() -> String:
	if c.hud.dlg == null:
		return ""
	var t := ""
	for pg in c.hud.dlg.pages:
		t += " ".join(pg) + " "
	return t

func _chs() -> Array:
	return (c.hud.dlg.choices as Array).map(func(x): return String(x.get("t", ""))) if c.hud.dlg != null else []

func _hits() -> Array:
	return (c.hud.last_hits as Array).map(func(h): return String(h.get("id", "")))

## два кадра движка: рисунок узлов леса и панели охоты (в проверке без экрана — тоже)
func _frames() -> void:
	c.hud.queue_redraw()
	await c.get_tree().process_frame
	await c.get_tree().process_frame

## лес без охоты; псарня — выбор охоты и свиты; в лесу — ловчий и гончие у ноги, белый олень, музыка охоты, панель;
## свой лук — натяг, прицел, выстрел, стрела летит; выстрел ловчего; сулицы (Q) — бросок и подбор; кровь подранка и стрелы
## в туше — в рисунке; сражён — в добыче; разделиться с ловчим (G); сбит с ног — лежит и встаёт; отбой — двор, итоги, мясо
## в погреба; второй раз за день — нельзя
func selftest() -> bool:
	if Sim.G.is_empty():
		print("selftest: охота — нет королевства")
		return false
	var G := Sim.G
	var C: Dictionary = G.court
	var k := _k()
	var r0: Dictionary = G.realms[0]
	var keep := {}
	for f in ["wound", "woundK", "woundP", "woundBy", "woundDay", "age", "mx", "mar", "ill"]:
		keep[f] = k.get(f)
	var keep_c := {}
	for f in ["grain", "trophies", "huntRec", "huntDay", "huntWpn", "huntAuto", "together", "prestige"]:
		keep_c[f] = (C[f] as Dictionary).duplicate(true) if C.get(f) is Dictionary else C.get(f)
	var gold0 := JS.n(r0.gold)
	var wk0: Variant = G.weather.get("k")
	var day0 := Game.day
	var frac0 := Game.frac
	var spd0 := Game.speed
	var snd0: Array = [Snd.screen, Snd.court, Snd.want]
	var res := true
	seed(20240925)
	Game.speed = 1
	Snd.screen = "court"
	Snd.court = c
	Snd.want = "auto"
	k["age"] = 30.0
	for f in ["wound", "woundK", "ill"]:
		k.erase(f)
	for f in ["huntDay", "huntWpn", "huntAuto"]:
		C.erase(f)
	G.weather["k"] = "clear"
	_close()
	_hour(8.0)
	c._tick(0.05)
	# лес без охоты: тихий набор дичи
	var q0 := forest_ani().size()
	var ok0: bool = HU == null and q0 >= 10 and why_hunt_not() == null and hounds_in_forest().is_empty()
	print("selftest: охота — лес без охоты: дичи ", q0, ", препятствие ", why_hunt_not(), " ", ok0)
	res = res and ok0
	if not ok0:
		return false
	# псарня: на кого (олень, кабан, соколиная — без соколятни нельзя, не сегодня), кого с собой; в лес
	hart_f = true
	c.do_act({"id": "kennel", "label": ""})
	var ch0 := _chs()
	var ok1a: bool = ch0.size() == 4 and String(ch0[0]) == "Гон оленя — с гончими" and String(ch0[3]) == "Не сегодня"
	c.hud.choose(0)
	var ch1 := _chs()
	var ok1b: bool = not ch1.is_empty() and String(ch1[-1]) == "Без свиты — только ловчий и собаки" and c.hud.dlg.name == String(_hn().get("name", ""))
	c.hud.choose(ch1.size() - 1)
	var i1 := _until(func(): return c.loc_id == "forest" and c.fade == 0.0, 80)
	hart_f = false
	var hn := _hn()
	var hs := hounds_in_forest()
	var ok1: bool = ok1a and ok1b and i1 >= 0 and on() and HU.kind == "deer" and HU.wpn == "bow" and int(HU.arrows) == 15 and int(HU.jav) == 4 \
		and HU.get("hart") != null and String(HU.hart.col) == "hart" and not hn.is_empty() and JS.t(hn.get("follow")) and hn.loc == "forest" \
		and hs.size() >= 1 and hs.all(func(h): return h.st == "heel") and Snd.resolve() == "hunt" and JS.n(C.get("huntDay")) == float(Game.day)
	print("selftest: охота — псарня: ", ch0.size(), " выбора, свита ", ch1.size(), "; в лесу за ", i1, " кадров, ловчий ", JS.t(hn.get("follow")), ", гончих ", hs.size(), ", белый олень ", HU.get("hart") != null if HU != null else false, ", музыка ", Snd.resolve(), " ", ok1)
	res = res and ok1
	if not ok1:
		return false
	# панель охоты и нижняя строка, «!» и прочее поверх леса — в рисунке
	c._tick(0.05)
	await _frames()
	var H0 := _hits()
	var ok2: bool = ["hpanel", "hwpn", "haim", "hsplit", "hwind"].all(func(id): return H0.has(id)) and n_drawn > 0 and c.xn.has("hnt_x")
	print("selftest: охота — панель ", H0.filter(func(id): return String(id).begins_with("h")), ", рисунок ", n_drawn, " ", ok2)
	res = res and ok2
	# свой лук: зажать — натянуть до полного (полоска, прицел), отпустить — стрела летит, ложится или попадает
	C["huntAuto"] = 0
	var doe: Variant = _nearest("doe")
	_go_near(doe)
	aim_o = Vector2(float(doe.x), float(doe.y) - 8.0)
	HU["cool"] = 0.0
	press(true)
	var i3 := _until(func(): return HU.get("draw") != null and draw_k(HU.draw, now()) >= 1.0, 60)
	var walk_k := 0.45 if drawing() else 1.0
	await _frames()
	var aimed := n_aim > 0
	up()
	c._tick(0.05)
	var flying: bool = (HU.ar as Array).size() == 1 and int(HU.arrows) == 14 and int(HU.shots) == 1 and HU.get("draw") == null
	var i4 := _until(func(): return (HU.ar as Array).is_empty(), 120)
	aim_o = null
	var ok3: bool = i3 >= 0 and walk_k == 0.45 and aimed and flying and i4 >= 0
	print("selftest: охота — свой лук: натяг за ", i3, " кадров, прицел ", aimed, ", стрела в полёте ", flying, ", легла за ", i4, " (в земле ", (HU.sa as Array).size(), ", попаданий ", HU.hits, ") ", ok3)
	res = res and ok3
	# стрела в земле — подобрать
	var ok3b := true
	if not (HU.sa as Array).is_empty():
		var s0: Dictionary = HU.sa[0]
		var n_sa: int = (HU.sa as Array).size()
		c._tick(0.05)
		var keyed: bool = c.xn.has("hnt_s0")
		var P := _P()
		P["x"] = float(s0.x)
		P["y"] = float(s0.y)
		c._tick(0.05)
		ok3b = keyed and (HU.sa as Array).size() == n_sa - 1
		print("selftest: охота — стрела в земле видна ", keyed, ", подобрана ", (HU.sa as Array).size() == n_sa - 1, " (в колчане ", HU.arrows, ") ", ok3b)
	res = res and ok3b
	# прицел ловчего: E — выстрел по шансу, стрела долетает
	C["huntAuto"] = 1
	var hare: Variant = _nearest("doe")
	if hare == null:
		hare = _nearest("")
	_go_near(hare)
	HU["cool"] = 0.0
	var A: Variant = aim(_P())
	var sh0 := int(HU.shots)
	if A != null:
		shoot(A.a, A.useF)
	var fl1: int = (HU.fl as Array).size()
	var i5 := _until(func(): return (HU.fl as Array).is_empty(), 120)
	var ok4: bool = A != null and fl1 == 1 and int(HU.shots) == sh0 + 1 and i5 >= 0
	print("selftest: охота — прицел ловчего: цель ", String(A.a.kind) if A != null else "-", ", стрела ", fl1, ", долетела за ", i5, " кадров ", ok4)
	res = res and ok4
	# Q — сулицы; бросок; сулицу в земле — подобрать
	key(KEY_Q)
	var jq: bool = HU.wpn == "jav" and String(C.get("huntWpn", "")) == "jav"
	var tg: Variant = _nearest("")
	_go_near(tg)
	HU["cool"] = 0.0
	A = aim(_P())
	if A != null:
		shoot(A.a, false)
	var jf1: int = (HU.jf as Array).size()
	var i6 := _until(func(): return (HU.jf as Array).is_empty(), 120)
	var jav_ok: bool = int(HU.jshots) == 1 and int(HU.jav) == 3
	if not (HU.sj as Array).is_empty():
		var sj0: Dictionary = HU.sj[0]
		var P := _P()
		P["x"] = float(sj0.x)
		P["y"] = float(sj0.y)
		c._tick(0.05)
		jav_ok = jav_ok and int(HU.jav) == 4 and (HU.sj as Array).is_empty()
	var ok5: bool = jq and A != null and jf1 == 1 and i6 >= 0 and jav_ok
	print("selftest: охота — сулицы: Q ", jq, ", бросок ", jf1, ", долетела за ", i6, " кадров, сулиц ", HU.jav, " ", ok5)
	res = res and ok5
	# подранок: кровь на траве; стрелы в туше; сражён — в добыче
	var b: Variant = _nearest("doe")
	if b == null:
		b = _nearest("")
	bleed(b, true)
	b["arw"] = 2
	c._tick(0.05)
	var bi: int = c.ani.find(b)
	var drawn_b: bool = c.xn.has("hnt_bl") and c.xn.has("hnt_w" + str(bi))
	await _frames()
	var nb0: int = (HU.bag as Array).size()
	var ar0 := int(HU.arrows)
	kill(b, "king")
	c._tick(0.05)
	var ok6: bool = drawn_b and (HU.bag as Array).size() == nb0 + 1 and int(HU.arrows) == ar0 + 2 and b.st == "dead" and not c.xn.has("hnt_w" + str(bi)) \
		and String(c.hud.toast_s).begins_with("Сражен")
	print("selftest: охота — кровь и стрелы в туше ", drawn_b, ", сражён: «", c.hud.toast_s, "», добыча ", bag_str(HU.bag), " ", ok6)
	res = res and ok6
	# G — ловчий с гончими уходит к дальней поляне; G ещё раз — трубить, чтобы вернулся
	split_key()
	var sw1 := split_word()
	var st1: String = String(HU.split.st) if HU.get("split") != null else ""
	split_key()
	var st2: String = String(HU.split.st) if HU.get("split") != null else ""
	var ok7: bool = st1 == "go" and sw1.begins_with("Ловчий идёт к «") and st2 == "back" and split_word().begins_with("Ловчий возвращается")
	print("selftest: охота — разделиться: «", sw1, "», созвать: ", st2, " ", ok7)
	res = res and ok7
	# сбит с ног: лежит (рисунок), белая вспышка; встаёт
	cmd(PackedStringArray(["hunt", "fall"]))
	c._tick(0.05)
	var down: bool = c.blocked() and JS.t(_P().get("hide")) and c.xn.has("hnt_down") and c.xn.has("hnt_fl")
	await _frames()
	var i8 := _until(func(): return not c.blocked(), 80)
	var ok8: bool = down and i8 >= 0 and not JS.t(_P().get("hide")) and not c.xn.has("hnt_down") and not c.xn.has("hnt_fl")
	print("selftest: охота — сбит с ног ", down, ", встал за ", i8, " кадров ", ok8)
	res = res and ok8
	# отбой: двор, итоги — мясо в погреба; свита и гончие — по местам, лес — тихий
	var gr0 := JS.n(C.get("grain"))
	var bag9: Array = (HU.bag as Array).duplicate()
	_close()
	end_hunt("horn")
	var i9 := _until(func(): return c.loc_id == "yard" and c.fade == 0.0, 80)
	var meat := 0
	for bb in bag9:
		meat += int(GAME[bb.k].meat)
	var t9 := _dlg_text()
	var ok9: bool = i9 >= 0 and HU == null and c.hud.dlg != null and c.hud.dlg.name == "Итоги охоты" and t9.contains("Добыча: ") and JS.n(C.get("grain")) == gr0 + meat \
		and not JS.t(_hn().get("follow")) and hounds_in_forest().is_empty() and c.xn.keys().all(func(kk): return not String(kk).begins_with("hnt_")) and Snd.resolve() != "hunt"
	print("selftest: охота — отбой за ", i9, " кадров: «", t9.substr(0, 90), "…», мяса +", meat, " ", ok9)
	res = res and ok9
	_close()
	# второй раз за день: с ушибом — сперва лекарь; без него — собаки набегались
	var w10 := String(why_hunt_not())
	k.erase("wound")
	var ok10: bool = w10.begins_with("Ушиб ещё не прошёл") and String(why_hunt_not()).begins_with("Собаки сегодня уже набегались")
	print("selftest: охота — второй раз за день: «", w10.substr(0, 18), "…», без ушиба: ", why_hunt_not(), " ", ok10)
	res = res and ok10
	# как было
	for f in keep:
		if keep[f] == null:
			k.erase(f)
		else:
			k[f] = keep[f]
	for f in keep_c:
		if keep_c[f] == null:
			C.erase(f)
		else:
			C[f] = keep_c[f]
	r0.gold = gold0
	G.weather["k"] = wk0
	Game.day = day0
	Game.frac = frac0
	Game.speed = spd0
	c.last_ha = Game.day * 24.0 + Game.hour_abs()
	c._tick(0.02)
	Snd.screen = snd0[0]
	Snd.court = snd0[1]
	Snd.want = snd0[2]
	print("selftest: охота — ", "OK" if res else "FAIL")
	return res

func state() -> Dictionary:
	var o := {"on": on(), "fauna": forest_ani().size(), "hounds": hounds_in_forest().size()}
	if HU == null:
		return o
	o.merge({"kind": HU.kind, "wpn": HU.wpn, "arrows": HU.arrows, "jav": HU.jav, "bag": bag_str(HU.bag), "nbag": (HU.bag as Array).size(),
		"split": String(HU.split.st) if HU.get("split") != null else "", "draw": HU.get("draw") != null, "ar": (HU.ar as Array).size(), "sa": (HU.sa as Array).size(),
		"hart": HU.get("hart") != null, "aim": HU.get("aim") != null, "follow": c.npcs.filter(func(n): return JS.t(n.get("follow"))).size()})
	return o
