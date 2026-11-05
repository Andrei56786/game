
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
