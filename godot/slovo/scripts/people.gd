extends RefCounted
# Распорядок двора (как schedTick/npcGoToSp/npcUpdate в HTML): каждый идёт к месту по расписанию,
# через двери в другие помещения; «stairs» — уйти к себе (с глаз долой) или в свою постель; «wander:…» — бродить.
const CT := 16
var c: Node2D   # court.gd

func _init(court: Node2D) -> void:
	c = court

func make(p: Dictionary) -> Dictionary:
	var n := p.duplicate()
	n["x"] = float(p["x"])
	n["y"] = float(p["y"])
	n["away"] = int(p.get("away", 0)) == 1
	n["path"] = null
	n["pi"] = 0
	n["goal"] = null
	n["f"] = 0.0
	n["sit"] = null
	n["lie"] = false
	n["wander"] = null
	n["idle"] = 0.0
	n["cur"] = ""
	n["away_sp"] = null
	n["bub"] = ""
	n["bub_t"] = 0.0
	n["fresh"] = true
	n["node"] = null
	return n

static func _f(sp: Dictionary, k: String) -> bool:
	return sp.has(k) and bool(sp[k])

func spot_of(nm: String) -> Dictionary:
	return c.spots.get(nm, {})

func place(n: Dictionary, sp: Dictionary) -> void:
	n["loc"] = sp["loc"]
	n["x"] = float(sp["x"])
	n["y"] = float(sp["y"])
	n["dir"] = sp["dir"]
	n["path"] = null

func sched_target(n: Dictionary) -> String:
	if not n.has("sched"):
		return ""
	var S: Array = n["sched"]
	var h := Game.hour_abs()
	var cur: Array = S[0]
	for e in S:
		if float(e[0]) <= h:
			cur = e
	if cur[1] == "stairs" and n.has("bed") and not spot_of(n["bed"]).is_empty():
		return n["bed"]
	return cur[1]

func sched_tick(n: Dictionary) -> void:
	var tg := sched_target(n)
	if tg == "" or tg == n["cur"]:
		return
	n["cur"] = tg
	n["wander"] = null
	if tg.begins_with("wander:"):
		var a := tg.substr(7).split("@")
		var r: Array = []
		for v in a[0].split(","):
			r.append(int(v))
		var sp := {"loc": a[1], "x": roundf((r[0] + r[2]) / 2.0) * CT + 8, "y": roundf((r[1] + r[3]) / 2.0) * CT + 12, "dir": "down"}
		go_sp(n, sp, r)
		return
	var sp := spot_of(tg)
	if not sp.is_empty():
		go_sp(n, sp, null)

func go_sp(n: Dictionary, sp: Dictionary, wander) -> void:
	n["goal"] = {"sp": sp, "wander": wander, "door": null}
	n["sit"] = null
	n["lie"] = false
	if n["away"]:
		var from = n["away_sp"]
		if from == null:
			from = spot_of(n.get("home", "stairs"))
			if from.is_empty():
				from = sp
		place(n, from)
		n["away"] = false
	repath(n)

func door_toward(from: String, to: String) -> Variant:
	if from == to:
		return null
	var prev := {from: null}
	var q: Array = [from]
	while not q.is_empty():
		var id: String = q.pop_front()
		for d in c.D["locs"][id]["doors"]:
			var t2: String = d["to"]
			if not c.D["locs"].has(t2) or prev.has(t2):
				continue
			prev[t2] = [id, d]
			if t2 == to:
				var s: Array = prev[to]
				while s[0] != from:
					s = prev[s[0]]
				return s[1]
			q.append(t2)
	return null

func repath(n: Dictionary) -> void:
	var g = n["goal"]
	if g == null:
		return
	var sp: Dictionary = g["sp"]
	var tgt: Vector2i
	if sp["loc"] != n["loc"]:
		var d = null
		for dd in c.D["locs"][n["loc"]]["doors"]:
			if dd["to"] == sp["loc"]:
				d = dd
				break
		if d == null:
			d = door_toward(n["loc"], sp["loc"])
		if d == null:
			place(n, sp)
			n["path"] = []
			n["pi"] = 0
			return
		tgt = Vector2i(int(d["x0"]), int(d["y1"]))
		g["door"] = d
	else:
		tgt = c.near_free(n["loc"], floori(float(sp["x"]) / CT), floori(float(sp["y"]) / CT))
		g["door"] = null
	var st: Vector2i = c.near_free(n["loc"], floori(float(n["x"]) / CT), floori(float(n["y"]) / CT))
	var p = c.find_path(n["loc"], st, tgt)
	n["path"] = p if p != null else []
	n["pi"] = 0

func arrive(n: Dictionary) -> void:
	var g = n["goal"]
	if g == null:
		n["path"] = null
		return
	if g["door"] != null:
		var d: Dictionary = g["door"]
		n["loc"] = d["to"]
		n["x"] = float(d["ax"])
		n["y"] = float(d["ay"])
		n["dir"] = d["dir"]
		repath(n)
		return
	var sp: Dictionary = g["sp"]
	n["x"] = float(sp.get("sx", sp["x"]))
	n["y"] = float(sp.get("sy", sp["y"]))
	n["dir"] = sp["dir"]
	n["path"] = null
	n["goal"] = null
	n["sit"] = sp if _f(sp, "sit") else null
	n["lie"] = _f(sp, "lie")
	if _f(sp, "away"):
		n["away"] = true
		n["away_sp"] = sp
	if g["wander"] != null:
		n["wander"] = g["wander"]
		n["idle"] = 0.3

func update(n: Dictionary, dt: float) -> void:
	if n["away"]:
		return
	if n["bub"] != "" and n["bub_t"] < c.t:
		n["bub"] = ""
	if n["path"] != null:
		var p: Array = n["path"]
		if n["pi"] >= p.size():
			arrive(n)
			return
		var cell: Vector2i = p[n["pi"]]
		var gx := cell.x * CT + 8.0
		var gy := cell.y * CT + 12.0
		var dx: float = gx - n["x"]
		var dy: float = gy - n["y"]
		var d := sqrt(dx * dx + dy * dy)
		var step: float = float(n["spd"]) * dt
		if d <= step:
			n["x"] = gx
			n["y"] = gy
			n["pi"] += 1
		else:
			n["x"] += dx / d * step
			n["y"] += dy / d * step
			n["f"] += step
			n["dir"] = ("right" if dx > 0 else "left") if absf(dx) > absf(dy) else ("down" if dy > 0 else "up")
		return
	if n["wander"] != null:
		n["idle"] -= dt
		if n["idle"] < 0.0:
			var r: Array = n["wander"]
			var tx := randi_range(r[0], r[2])
			var ty := randi_range(r[1], r[3])
			if not c.solid_at(n["loc"], tx, ty):
				var p = c.find_path(n["loc"], Vector2i(floori(float(n["x"]) / CT), floori(float(n["y"]) / CT)), Vector2i(tx, ty))
				if p != null:
					n["path"] = p
					n["pi"] = 0
					n["goal"] = {"sp": {"loc": n["loc"], "x": tx * CT + 8, "y": ty * CT + 12, "dir": ["down", "left", "right", "up"][randi() % 4]}, "wander": r, "door": null}
			n["idle"] = randf_range(2.0, 7.0)

# сразу поставить всех туда, где им положено быть сейчас (вход во двор, сон, перевод часов)
func snap(only_fresh: bool) -> void:
	for n in c.npcs:
		if only_fresh and not n["fresh"]:
			continue
		n["fresh"] = false
		if n.has("post"):
			var ps := spot_of(n["post"])
			if not ps.is_empty():
				place(n, ps)
			n["away"] = false
			continue
		n["cur"] = ""
		sched_tick(n)
		var g = n["goal"]
		if g == null:
			continue
		var sp: Dictionary = g["sp"]
		if _f(sp, "away"):
			n["away"] = true
			n["away_sp"] = sp
			n["goal"] = null
			n["path"] = null
		else:
			place(n, sp)
			n["away"] = false
			n["x"] = float(sp.get("sx", sp["x"]))
			n["y"] = float(sp.get("sy", sp["y"]))
			n["sit"] = sp if _f(sp, "sit") else null
			n["lie"] = _f(sp, "lie")
			n["path"] = null
			n["goal"] = null
			if g["wander"] != null:
				n["wander"] = g["wander"]
				n["idle"] = 0.3

func say(n: Dictionary, s: String, dur: float) -> void:
	n["bub"] = s
	n["bub_t"] = c.t + dur
