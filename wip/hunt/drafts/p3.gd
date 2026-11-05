
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
