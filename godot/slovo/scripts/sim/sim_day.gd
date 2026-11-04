class_name SimDay
## День королевства — перенос dailyTick (events.js) без того, что Godot ещё не считает: жизни двора (совет, династия, науки,
## DAILY_EXT — кроме распутицы из march.js), собора, случайных событий. Замыслы держав (SimAI.aiRealm: войны, мир, походы,
## вера и обман — SimBel) и походы ИИ (SimAI.aiArmy: осады, купцы, разбойники, приказы короля — SimCmd) — с 0.6.
## Войска (army.js: dailyArmy с обёрткой march.js — мороз и служба ополчения), поселения (dailySett), смена сезона,
## недельная дипломатия (diplo.js), разбойники у пустых логовищ, пленники, гонцы, падение держав и победа — как в HTML.
## Эталон — pageDay в tools/sim_export.mjs: тот же день в HTML; tools/state_check.gd сверяет состояние каждый день.
## День можно растянуть на несколько кадров: dailyTick(бюджет в мкс) — корутина, между частями ждёт следующего кадра;
## при бюджете 0 день считается целиком сразу (проверки, догонялка без экрана). Порядок расчётов от этого не меняется.

const MW := WorldData.MW
const MH := WorldData.MH
const NT := WorldData.NT
const N8 := [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
const RG := ["n", "p", "f", "f", "f", "p", "p"]   # род названий держав (diplo.js)
const SVC_DAYS := 40.0
const MUDK := {"rain": 0.22, "storm": 0.38, "snow": 0.08, "fog": -0.04, "cloud": -0.07, "clear": -0.16, "wind": -0.28, "heat": -0.34}
const SEASON_T := ["Пришла весна. Дороги развезло, но травы поднимаются — кони снова пасутся.", "Лето. Сухие дороги, много корма — лучшее время для походов.",
	"Осень. Урожай собран: фуражировка богаче всего. Скоро холода.", "Зима. Корма нет, болезни косят войска в поле, походы медленны. Мудрый стоит на зимних квартирах."]
const DESERT_PRO := {"sword": 0.3, "horse": 0.3, "knight": 0.2, "harch": 0.35, "xbow": 0.6}

static var budget_us := 0            # время на кадр, мкс (0 — без пауз)
static var slice_t := 0
static var busy := false             # день считается (между кадрами)
static var ms_day := 0.0             # сколько счёта ушло на последний день, мс (без ожидания кадров)
static var frames := 0               # на сколько кадров он растянулся
static var calc_us := 0
static var done_frame := -1          # кадр, в котором досчитан последний день
static var n_days := 0               # дней посчитано с начала игры (для проверок: среднее и худшее время дня)
static var sum_ms := 0.0
static var max_ms := 0.0
static var prof := {}                # время частей дня, мкс (накопительно): войска, рынки, поселения, замыслы, походы…
static var nb_cache := {"d": -1.0, "m": {}}
static var alerts: Array = []        # для экрана: события, которые в HTML открывают окно (UI.alert)
static var near_ok := -1             # в каждой клетке не больше одного поселения (тогда settNear ищет по соседним клеткам)
static var gar_base := {}            # baseGarrison по типу поселения (только для чтения)
static var peace_of := PackedByteArray()   # dailySett: у державы нет войн (dailyTick считает перед поселениями)


# ---------- кадры ----------
static func due() -> bool:
	return budget_us > 0 and Time.get_ticks_usec() - slice_t > budget_us

static func pause() -> void:
	calc_us += Time.get_ticks_usec() - slice_t
	frames += 1
	await Engine.get_main_loop().process_frame
	slice_t = Time.get_ticks_usec()


## время части дня — в prof (паузы между кадрами тоже попадают; без бюджета их нет)
static func _prof(k: String, t0: int) -> int:
	var t := Time.get_ticks_usec()
	prof[k] = int(prof.get(k, 0)) + t - t0
	return t


# ---------- день ----------
## dailyTick (events.js) без двора; budget — мкс счёта на кадр (0 — весь день сразу)
static func dailyTick(budget := 0) -> void:
	busy = true
	budget_us = budget
	slice_t = Time.get_ticks_usec()
	calc_us = 0
	frames = 1
	var G := Sim.G
	if fmod(G.day, 2.0) == 0.0:
		Sim.revealWater()
	G.day += 1.0
	G.weather.days -= 1.0
	if G.weather.days <= 0:
		Sim.rollWeather()
	if fmod(G.day, Sim.DAYS_SEASON) == 0.0:
		onSeason()
	var pt := Time.get_ticks_usec()
	for a in G.armies.duplicate():
		if JS.t(a.alive):
			await dailyArmy(a)
		if due():
			await pause()
	pt = _prof("army", pt)
	await SimEcon.econDaily()
	pt = _prof("econ", pt)
	for r in 5:
		if alive(r):
			SimEcon.realmEconomy(r)
	if due():
		await pause()
	var i := 0
	settsPrep()
	for S in G.setts:
		dailySett(S)
		i += 1
		if (i & 63) == 0 and due():
			await pause()
	pt = _prof("setts", pt)
	# замыслы держав и походы ИИ (ai.js с обёртками belief.js и command.js)
	for r in 5:
		SimAI.aiRealm(r)
		if due():
			await pause()
	pt = _prof("realm", pt)
	for a in G.armies.duplicate():
		if JS.t(a.alive) and a.kind != "player":
			await SimAI.aiArmy(a)
		if due():
			await pause()
	pt = _prof("aiArmy", pt)
	if fmod(G.day, 7.0) == 0.0:
		diploWeekly()
	# разбойники возвращаются в пустые логова
	if fmod(G.day, 5.0) == 0.0:
		for k in Sim.W.lairs.size():
			var has := false
			for a in G.armies:
				if JS.t(a.alive) and a.kind == "bandit" and JS.n(a.get("lair", -1.0)) == float(k) and a.has("lair"):
					has = true
					break
			if not has and Sim.R.f() < 0.12:
				Sim.spawnBandits(k)
	# пленники: полководцев ИИ со временем отпускают
	for c in G.chars:
		if c.prison >= 0 and c.prison != G.player.realm and Sim.R.f() < 0.03:
			c.prison = -1.0
	var king: Dictionary = Sim.charOf(G.player.char)
	if king.prison >= 0:
		kingCaptured(king)
	var pr: Dictionary = G.realms[int(G.player.realm)]
	if pr.gold < 0 and fmod(G.day, 3.0) == 0.0:
		Sim.glog("Казна пуста! Войску не платят — боевой дух падает.", "bad")
	for m in G.msgs:
		if not JS.t(m.get("done")) and m.until < G.day:
			m.done = 1.0
			if m.kind == "call":
				declineCall(m)
	G.msgs = G.msgs.filter(func(m): return not JS.t(m.get("done")) or G.day - m.day < 2)
	G.armies = G.armies.filter(func(a): return JS.t(a.alive))
	# день двора (events.js: councilDaily, dynastyDaily, researchDaily, courtExileCheck, затем DAILY_EXT)
	if G.has("court"):
		SimCourt.councilDaily()
		SimDyn.dynastyDaily()
		SimTech.researchDaily()
		SimPlayer.courtExileCheck()
		# DAILY_EXT — в порядке сборки: projects, feast, chapel, supply, march, reign, birds, sick
		SimExt.projDaily()
		SimExt.feastDaily()
		SimExt.ransomDaily()
		SimExt.supWarn()
		mudDaily()
		SimExt.reignDaily()
		SimBirds.birdsDaily()
		SimSick.sickDaily()
	checkRealms()
	checkVictory()
	if Sim.dayOfYear(G.day) == Sim.DAYS_SEASON * 3 and G.day > 0:
		SimExt.holdCouncil()
	if G.day > 6 and Sim.R.f() < 0.055 and not JS.t(G.get("over")):
		SimExt.randomEvent()
	if due():
		await pause()
	pt = _prof("rest", pt)
	SimIntel.computeVision()
	SimIntel.updateSigns()
	_prof("vision", pt)
	calc_us += Time.get_ticks_usec() - slice_t
	ms_day = calc_us / 1000.0
	n_days += 1
	sum_ms += ms_day
	max_ms = maxf(max_ms, ms_day)
	done_frame = Engine.get_process_frames()
	budget_us = 0
	busy = false


static func onSeason() -> void:
	Sim.glog(SEASON_T[Sim.seasonOf(Sim.G.day)], "season")


static func kingCaptured(king: Dictionary) -> void:
	var G := Sim.G
	var r: Dictionary = G.realms[int(G.player.realm)]
	var ransom := 120.0 + JS.rnd(G.day / 2.0)
	r.gold -= ransom
	king.prison = -1.0
	r.prestige = JS.n(r.get("prestige")) - 20.0
	Sim.glog("Король был пленён и выкуплен за " + JS.s(ransom) + " зол. Позор ляжет на летописи.", "bad")


static func declineCall(m: Dictionary) -> void:
	var t: float = m.from
	var p: float = Sim.G.player.realm
	setRel(p, t, "ally", 0.0)
	addOpn(t, p, -35.0)
	Sim.glog("Мы не пришли на помощь союзнику (" + Sim.realmName(t) + "). Союз расторгнут.", "bad")


## распутица (march.js, DAILY_EXT): дождь размачивает землю, оттепель — тоже; солнце, ветер и мороз сушат
static func mudDaily() -> void:
	var G := Sim.G
	var s := Sim.seasonOf(G.day)
	var k: String = G.weather.k
	var din := fmod(fmod(G.day, Sim.DAYS_YEAR), Sim.DAYS_SEASON)
	var m := JS.n(G.get("mud"))
	if s == 3:
		m -= 0.3 if k == "snow" or k == "blizzard" else 0.08
	else:
		m += float(MUDK.get(k, 0.0))
		if s == 0 and din < 7:
			m += 0.2
	G.mud = JS.clp(m, 0, 1)
	if G.mud >= 0.5 and not JS.t(G.get("mudOn")):
		G.mudOn = 1.0
		Sim.glog("Распутица: снег сошёл, дороги раскисли — обозы вязнут по ступицу." if s == 0 and din < 8 else "Распутица: дожди размыли дороги — вне трактов войска вязнут в грязи.", "info")
	elif G.mud < 0.25 and JS.t(G.get("mudOn")):
		G.mudOn = 0.0
		Sim.glog("Земля подсохла: дороги снова проезжи.", "info")


# ---------- поселения ----------
static func baseGarrison(S: Dictionary) -> Dictionary:
	var t: String = Sim.W.setts[int(S.id)].type
	if not gar_base.has(t):
		gar_base[t] = _baseGarrison(t)
	return gar_base[t]

static func _baseGarrison(t: String) -> Dictionary:
	var o: Dictionary
	if t == "village":
		o = {"levy": 12.0, "archer": 3.0}
	elif t == "castle":
		o = {"levy": 30.0, "spear": 30.0, "sword": 12.0, "archer": 20.0, "xbow": 4.0, "horse": 4.0}
	elif t == "town":
		o = {"levy": 50.0, "spear": 30.0, "sword": 10.0, "archer": 22.0, "xbow": 8.0, "horse": 4.0}
	else:
		o = {"levy": 60.0, "spear": 60.0, "sword": 40.0, "archer": 40.0, "xbow": 10.0, "horse": 12.0, "knight": 4.0}
	return Sim.assign(Sim.emptyU(), o)


## перед поселениями дня: у каких держав нет войн (dailySett спрашивает это ~1000 раз)
static func settsPrep() -> void:
	peace_of.resize(5)
	for r in 5:
		peace_of[r] = 1 if warsOf(r).is_empty() else 0


static func dailySett(S: Dictionary) -> void:
	var G := Sim.G
	var W := Sim.W
	var ws: Dictionary = W.setts[int(S.id)]
	var P: Dictionary = G.provs[ws.prov]
	var sg := JS.t(S.siege)
	if not sg:
		S.food = minf(S.foodMax, S.food + 0.4)
		Sim.refillPool(S, 1)
	P.dev = maxf(0.0, P.dev - 0.004)
	if S.ctrl == S.owner:
		P.unrest = maxf(0.0, P.unrest - 0.4)
	else:
		P.unrest = minf(100.0, P.unrest + 0.15)
	var peace: bool = peace_of[int(S.ctrl) if S.ctrl < 5 else 0] == 1
	S.prosp = JS.clp(S.prosp + (-0.3 if sg else (0.04 if peace else 0.01)) - P.dev * 0.05, 5, 100)
	# гарнизоны понемногу пополняются из запаса людей, пока нет осады
	if not sg and S.ctrl < 5 and fmod(G.day, 3.0) == 0.0:
		var base := baseGarrison(S)
		for u in Sim.UT:
			if JS.n(S.gar.get(u)) < base[u] and JS.n(S.pool.get(u)) >= 1:
				S.gar[u] += 1.0
				S.pool[u] -= 1.0
	# смута — бунт: мятежники уходят в леса разбойниками
	if P.unrest > 80 and ws.type != "village" and Sim.R.f() < 0.02:
		P.unrest = 50.0
		var lx: float = ws.x + Sim.R.i(-2, 2)
		var ly: float = ws.y + Sim.R.i(-2, 2)
		if inMap(lx, ly) and passable(W.ter[int(ly) * MW + int(lx)]):
			var b := Sim.spawnBanditsAt(lx, ly, -1.0)
			b.u.levy += 40.0
			if S.ctrl == G.player.realm:
				Sim.glog("Бунт в провинции " + String(W.provs[ws.prov].name) + "! Мятежники ушли в леса.", "bad")


static func inMap(x: float, y: float) -> bool:
	return x >= 0 and y >= 0 and x < MW and y < MH

static func passable(t: int) -> bool:
	return float(Sim.TINFO[t].cost) > 0


# ---------- войска: день в поле (army.js, march.js) ----------
## ближайшее поселение не дальше r клеток (settNear): при равных — с большим номером, как в HTML
static func settNear(x: float, y: float, r: float) -> int:
	var W := Sim.W
	var best := -1
	var bd := r * r
	if near_ok < 0 or Sim.s_at_w != W:
		Sim.settAtTile(0)
		var n := 0
		for i in NT:
			if Sim.s_at[i] >= 0:
				n += 1
		near_ok = 1 if n == W.setts.size() else 0
	if near_ok == 0:
		for s in W.setts:
			var dx: float = s.x + 0.5 - x
			var dy: float = s.y + 0.5 - y
			var d := dx * dx + dy * dy
			if d <= bd:
				bd = d
				best = s.id
		return best
	# по клеткам вокруг; поселения — по возрастанию номера, как в обходе WD.setts
	var x0 := maxi(0, int(floorf(x - 0.5 - r)))
	var x1 := mini(MW - 1, int(ceilf(x - 0.5 + r)))
	var y0 := maxi(0, int(floorf(y - 0.5 - r)))
	var y1 := mini(MH - 1, int(ceilf(y - 0.5 + r)))
	var ids := PackedInt32Array()
	for ty in range(y0, y1 + 1):
		for tx in range(x0, x1 + 1):
			var id: int = Sim.s_at[ty * MW + tx]
			if id >= 0:
				ids.append(id)
	if ids.size() > 1:
		ids.sort()
	for id in ids:
		var s: Dictionary = W.setts[id]
		var dx: float = s.x + 0.5 - x
		var dy: float = s.y + 0.5 - y
		var d := dx * dx + dy * dy
		if d <= bd:
			bd = d
			best = id
	return best


static func powerU(u: Dictionary, xp: Variant) -> float:
	var s := 0.0
	for t in Sim.UT:
		var U: Dictionary = Sim.UNIT[t]
		var x := JS.n(xp.get(t)) if xp != null else 0.0
		s += JS.n(u.get(t)) * (U.atk + U.def) * (U.hp / 12.0) * (1.25 if Sim.T.MOUNTED.has(t) else 1.0) * (1 + x * 0.004)
	return s / 10.0


static func provRealmsAround(p: int) -> int:
	var s := {Sim.ownerOfProv(p): true}
	for n in Sim.W.provs[p].nb:
		s[Sim.ownerOfProv(int(n))] = true
	s.erase(6.0)
	return s.size()


## borderDist(realm)[t] (army.js): клеток до земель державы. В HTML — волна по всей карте (по 4 соседям, без преград),
## то есть манхэттенское расстояние до ближайшей клетки державы (до 254, дальше — 255). Здесь — кольцами вокруг клетки до
## lim: groundOf сравнивает его только с 8 и 14·SEAT_K, дальше lim ответ тот же.
static func borderDist(realm: float, t: int, lim: int) -> int:
	var W := Sim.W
	var G := Sim.G
	var own := PackedFloat64Array()
	own.resize(W.provs.size())
	for p in W.provs.size():
		own[p] = G.setts[W.provs[p].seat].ctrl
	var x0 := t % MW
	var y0 := t / MW
	var pr := W.prov
	var p0 := pr[t]
	if p0 >= 0 and own[p0] == realm:
		return 0
	for d in range(1, mini(lim, 254) + 1):
		for k in d:
			# четыре стороны ромба радиуса d
			for q in 4:
				var dx: int
				var dy: int
				match q:
					0: dx = d - k; dy = k
					1: dx = -k; dy = d - k
					2: dx = -(d - k); dy = -k
					_: dx = k; dy = -(d - k)
				var x := x0 + dx
				var y := y0 + dy
				if x < 0 or y < 0 or x >= MW or y >= MH:
					continue
				var p := pr[y * MW + x]
				if p >= 0 and own[p] == realm:
					return d
	return 255


static func groundOf(a: Dictionary) -> String:
	var G := Sim.G
	var W := Sim.W
	var t := Sim.armyTile(a)
	var p := W.prov[t]
	var T := W.ter[t]
	# смертельная: враги вокруг с двух сторон и сильнее нас
	var hp := 0.0
	var mine := powerU(a.u, a.xp)
	var qd := [0, 0, 0, 0]
	for b in G.armies:
		if not JS.t(b.alive) or is_same(b, a) or not Sim.hostile(a.realm, b.realm) or b.kind == "caravan":
			continue
		var d := JS.hypot(b.x - a.x, b.y - a.y)
		if d < 7:
			hp += powerU(b.u, b.xp)
			qd[(1 if b.x > a.x else 0) + (2 if b.y > a.y else 0)] = 1
	var dirs: int = qd[0] + qd[1] + qd[2] + qd[3]
	if dirs >= 2 and hp > mine * 1.2:
		return "death"
	if T == WorldData.MOUNT or T == WorldData.HILLS or T == WorldData.DFOREST:
		var npass := 0
		var x := t % MW
		var y := t / MW
		for v in N8:
			var nx: int = x + v[0]
			var ny: int = y + v[1]
			if inMap(nx, ny):
				var c := float(Sim.TINFO[W.ter[ny * MW + nx]].cost)
				if c > 0 and c < 3:
					npass += 1
		if npass <= 3:
			return "hemmed"
	if W.bridge[t] or W.ford[t] or (W.road[t] and T == WorldData.MOUNT) or (T == WorldData.HILLS and W.road[t]):
		return "contentious"
	if T == WorldData.FOREST or T == WorldData.DFOREST or T == WorldData.MARSH or T == WorldData.MOUNT:
		return "difficult"
	if p < 0:
		return "open"
	var ctrl: float = G.setts[W.provs[p].seat].ctrl
	if ctrl == a.realm:
		return "dispersive"
	if provRealmsAround(p) >= 3:
		return "intersecting"
	var bd := borderDist(a.realm, t, int(ceilf(14.0 * Sim.SEAT_K)) + 1)
	if bd > 14.0 * Sim.SEAT_K and ctrl != 5.0:
		return "serious"
	if T == WorldData.GRASS or T == WorldData.STEPPE or T == WorldData.FARM:
		return "facile" if bd <= 8 else "open"
	return "facile"


## доля дневной воды из ручьёв и родников на месте (springCover)
static func springCover(a: Dictionary, t: int) -> float:
	var W := Sim.W
	var k := 0.0
	match int(W.ter[t]):
		WorldData.GRASS: k = 0.6
		WorldData.FARM: k = 0.8
		WorldData.FOREST: k = 0.8
		WorldData.DFOREST: k = 0.9
		WorldData.HILLS: k = 0.6
		WorldData.MOUNT: k = 0.5
		WorldData.PEAK: k = 0.3
		WorldData.MARSH: k = 1.0
		WorldData.STEPPE: k = 0.15
		WorldData.SNOW: k = 1.0
		WorldData.BEACH: k = 0.2
	var men := Sim.armyMen(a) + JS.n(a.get("wounded")) + JS.n(a.get("sick"))
	var big := JS.clp(700.0 / maxf(1.0, men), 0.35, 1)
	return k * big * [1.0, 0.75, 0.9, 1.0][Sim.seasonOf(Sim.G.day)] + (0.15 if W.road[t] else 0.0)


static func nearWater(t: int) -> bool:
	if Sim.W.fwd[t] <= 2:
		return true
	return settNear(t % MW + 0.5, t / MW + 0.5, 2.2) >= 0


## вода за день (waterDay): full — бочки полны, d — дней воды прибавилось (+) или убыло (−), s — отчего
static func waterDay(a: Dictionary, t: int = -1, Wt: Variant = null) -> Dictionary:
	if t < 0:
		t = Sim.armyTile(a)
	if Wt == null:
		Wt = Sim.weatherOf()
	if nearWater(t):
		return {"full": 1.0, "d": 0.0, "s": "река, озеро или колодцы поселения рядом — бочки полны"}
	if JS.t(Wt.get("wet")) or JS.t(Wt.get("cold")):
		return {"d": (1.0 if JS.t(Wt.get("wet")) else 0.0) + (1.0 if JS.t(Wt.get("sick")) else 0.0), "s": "дождь: воду ловят в плащи и бочки" if JS.t(Wt.get("wet")) else "топят снег"}
	var heat := JS.t(Wt.get("heat"))
	var need := 1.5 if heat else 1.0
	var cov := minf(need, springCover(a, t))
	var s: String
	if cov >= need - 0.01:
		s = "ручьи и родники дают всю воду"
	elif cov > 0.05:
		s = "ручьи и родники дают " + JS.s(JS.rnd(cov / need * 100)) + "% нужды" + (" (жара)" if heat else "")
	else:
		s = "вокруг сухо" + (", жара" if heat else "")
	return {"d": -(need - cov), "s": s}


static func forageYield(a: Dictionary) -> float:
	var G := Sim.G
	var W := Sim.W
	var t := Sim.armyTile(a)
	var p := W.prov[t]
	if p < 0:
		return 0.0
	var P: Dictionary = W.provs[p]
	var season := Sim.seasonOf(G.day)
	var base: float = (120.0 + P.mix[WorldData.FARM] * 2600.0 + P.villages.size() * 60.0) * [0.55, 1.0, 1.4, 0.25][season] * (1 - G.provs[p].dev)
	var y := minf(Sim.armyMen(a) * 1.6, base)
	if a.realm == G.player.realm and groundOf(a) == "serious":
		y *= 1.5
	return maxf(0.0, y)


static func eatK() -> float:
	return 1.2 if Sim.seasonOf(Sim.G.day) == 3 else 1.0


static func armyLoad(a: Dictionary) -> float:
	return a.food + a.fodder + a.arrows / 10.0 + a.weap * 2.0 + a.pitch * 5.0


static func docInCamp() -> bool:
	var G := Sim.G
	var C: Variant = G.get("court")
	var d: Variant = C.get("doc") if C != null else null
	return d != null and JS.t(d) and JS.t(d.get("camp")) and not JS.t(G.get("atCourt"))


## снабжение войска ИИ в своём поселении (ai.js): докупает провиант, фураж и стрелы; пустой рынок — реквизиция
static func aiResupply(a: Dictionary, S: Dictionary) -> void:
	var G := Sim.G
	var men := Sim.armyMen(a)
	var r: Variant = G.realms[int(a.realm)] if a.realm < G.realms.size() else null
	if r == null or a.realm >= 5:
		a.food = maxf(a.food, men * 6.0)
		return
	var buy := func(k: String, want: float) -> void:
		if want <= 0 or r.gold < 15:
			return
		var pk := SimEcon.priceOf(S, k) * (0.6 if k == "food" or k == "fodder" else 1.0)
		var n := maxf(0.0, minf(minf(want, JS.n(S.mk.get(k))), (r.gold - 10) / pk))
		a[k] += n
		SimEcon.mkTake(S, k, n)
		r.gold -= n * pk
	buy.call("food", men * 12.0 - a.food)
	buy.call("fodder", (Sim.mountedN(a.u) + a.wagons * 2.0) * 8.0 - a.fodder)
	buy.call("arrows", Sim.rangedN(a.u) * 30.0 - a.arrows)
	if a.food < men * 4 and JS.n(S.mk.get("food")) < men and S.ctrl == a.realm:
		a.food += men * 1.5
		S.prosp = maxf(10.0, S.prosp - 0.3)
		var pv: int = Sim.W.setts[int(S.id)].prov
		if pv >= 0:
			G.provs[pv].unrest = minf(100.0, G.provs[pv].unrest + 0.6)
	a.water = Sim.waterCap(a)


## купцы покупают хлеб и овёс на свои деньги на любом дружественном рынке (econ.js)
static func caravanSupply(a: Dictionary, S: Dictionary, days := 0.0) -> void:
	if S.ctrl < 5 and a.realm < 5 and S.ctrl != a.realm and Sim.hostile(a.realm, S.ctrl):
		return
	var men := Sim.armyMen(a)
	var horsesN := Sim.mountedN(a.u) + JS.n(a.get("wagons")) * 2.0
	var dd := maxf(days, 12.0 if JS.t(a.get("path")) else 20.0)
	var buy := func(k: String, want: float) -> void:
		if want <= 0 or a.cash < 5:
			return
		var pk := SimEcon.priceOf(S, k)
		var n := maxf(0.0, minf(minf(want, JS.n(S.mk.get(k)) * 0.5), (a.cash - 2) / pk))
		if n <= 0:
			return
		a[k] = JS.n(a.get(k)) + n
		SimEcon.mkTake(S, k, n)
		a.cash -= n * pk
	buy.call("food", men * dd - a.food)
	buy.call("fodder", horsesN * dd * 0.7 - JS.n(a.get("fodder")))
	a.water = Sim.waterCap(a)


## убрать n человек поровну из всех родов войск (болезни, голод)
static func takeMen(a: Dictionary, n: float) -> float:
	var men := Sim.armyMen(a)
	if men <= 0 or n <= 0:
		return 0.0
	n = minf(n, men)
	var left := n
	for u in Sim.UT:
		var k := minf(a.u[u], JS.rnd(n * a.u[u] / men))
		a.u[u] -= k
		left -= k
	for u in Sim.UT:
		if left <= 0:
			break
		var k := minf(a.u[u], left)
		a.u[u] -= k
		left -= k
	return n - left


## выздоровевшие возвращаются поровну (только целые люди: дробь ждёт завтра)
static func returnMen(a: Dictionary, n: float) -> void:
	if n <= 0:
		return
	n += JS.n(a.get("retAcc"))
	var k := floorf(n)
	a.retAcc = n - k
	if k <= 0:
		return
	var men := Sim.armyMen(a)
	if men <= 0:
		a.u.levy += k
		return
	var left := k
	var sh := []
	for u in Sim.UT:
		sh.append([u, k * a.u[u] / men])
	for e in sh:
		var f := floorf(e[1])
		a.u[e[0]] += f
		left -= f
	JS.sort(sh, func(x, y): return fmod(y[1], 1.0) - fmod(x[1], 1.0))
	for e in sh:
		if left <= 0:
			break
		a.u[e[0]] += 1.0
		left -= 1.0


static func endSiege(a: Dictionary) -> void:
	var G := Sim.G
	var si := int(a.siegeOf)
	var S: Variant = G.setts[si] if si >= 0 and si < G.setts.size() else null
	if S != null and JS.t(S.siege) and S.siege.by == a.id:
		S.siege = null
	a.siegeOf = -1.0
	if a.mode == "siege":
		a.mode = "march"


static func destroyArmy(a: Dictionary, why: String) -> void:
	var G := Sim.G
	if not JS.t(a.alive):
		return
	a.alive = 0.0
	a.path = null
	if a.siegeOf >= 0:
		endSiege(a)
	if a.kind == "player":
		onPlayerArmyLost(a, why)
	if a.realm == 0.0 and a.kind == "lord" and G.has("court"):
		cmdLost(a, why)
	elif a.kind == "lord":
		var g: Variant = Sim.charOf(a.gen)
		if g != null:
			g.army = -1.0


## войско короля разбито (onPlayerArmyLost): король бежит в свою крепость с горсткой верных
static func onPlayerArmyLost(a: Dictionary, _why: String) -> void:
	var G := Sim.G
	var W := Sim.W
	var cap: float = G.realms[int(G.player.realm)].capital
	if G.has("court") and cap >= 0 and G.setts[int(cap)].ctrl == G.player.realm and not JS.t(G.get("atCourt")):
		SimPlayer.fleeHome()
		return
	var S: Variant = null
	for s in G.setts:
		if s.ctrl == G.player.realm and s.id == cap:
			S = s
			break
	if S == null:
		for s in G.setts:
			if s.ctrl == G.player.realm and W.setts[int(s.id)].type != "village":
				S = s
				break
	if S == null:
		G.over = {"win": false, "why": "Держава пала: у короля не осталось ни одной крепости."}
		return
	var ws: Dictionary = W.setts[int(S.id)]
	var na := Sim.mkArmy(G.player.realm, "player", G.player.char, ws.x, ws.y, {"levy": 20.0, "spear": 10.0, "sword": 0.0, "archer": 0.0, "horse": 10.0})
	Sim.assign(na, {"food": 200.0, "water": 4.0, "morale": 40.0})
	G.player.army = na.id
	Sim.glog("Войско короля разбито! Король бежал в " + String(ws.name) + " с горсткой верных.", "bad")


## войско короны погибло (command.js: cmdLost): гонец с вестью, командир мог попасть в плен
static func cmdLost(a: Dictionary, why: String) -> void:
	var G := Sim.G
	var g: Variant = Sim.charOf(a.gen)
	G.couriers = (G.get("couriers", []) as Array).filter(func(c): return c.to != a.id)
	if not G.has("court"):
		return
	if g != null and Sim.R.chance(0.35):
		g.prison = 1.0
		Sim.glog(Sim.charName(g) + " попал в плен.", "bad")
	SimDyn.addLetter({"from": "Уцелевший сотник", "fc": -1.0, "subj": "Войско разбито", "text": "Государь, беда: войско " + (Sim.charName(g) if g != null else "короны") + " " + (why if why != "" else "разбито") + ". Немногие спаслись." + (" Командир в плену." if g != null and g.prison > 0 else ""), "x": a.x, "y": a.y})
	if g != null:
		g.army = -1.0
		if g.prison < 0:
			g.atCourt = 1.0


## кони падают без фуража (starveHorses): сначала запасные, потом упряжки и боевые; спешенный всадник бьётся пешим
static func starveHorses(a: Dictionary, isP: bool) -> void:
	var rid := Sim.mountedN(a.u)
	var teams := JS.n(a.get("wagons")) * 2.0
	var lost := ceilf((a.horses + rid + teams) * 0.03 * minf(2.0, 1 + JS.n(a.get("starveH")) * 0.15))
	if lost <= 0:
		return
	var sp := minf(a.horses, lost)
	a.horses -= sp
	lost -= sp
	if lost <= 0:
		return
	var tot := rid + teams
	if tot <= 0:
		return
	var wl := minf(JS.n(a.get("wagons")), JS.rnd(lost * teams / tot / 2.0))
	var rl := lost - wl * 2.0
	var DM := {"horse": "spear", "harch": "archer", "knight": "sword"}
	var N2 := ["всадника", "конных лучника", "рыцаря"]
	var N5 := ["всадников", "конных лучников", "рыцарей"]
	var out := []
	var i := 0
	for t in ["horse", "harch", "knight"]:
		if rl <= 0:
			break
		var k0 := maxf(0.0, JS.rnd(rl * a.u[t] / maxf(1.0, rid)))
		if k0 == 0.0:
			k0 = 1.0 if rl > 0 and JS.t(a.u[t]) else 0.0
		var k := minf(a.u[t], k0)
		if k == 0.0:
			i += 1
			continue
		a.u[t] -= k
		a.u[DM[t]] += k
		a.xp[DM[t]] = maxf(JS.n(a.xp.get(DM[t])), minf(JS.n(a.xp.get(t)), 60.0))
		rl -= k
		out.append(JS.s(k) + " " + Sim.plural(k, String(Sim.UNIT[t].n1), N2[i], N5[i]))
		i += 1
	if wl > 0:
		a.wagons -= wl
		var ld := armyLoad(a) - Sim.armyCap(a)
		if ld > 0:
			a.food = maxf(0.0, a.food - ld)
	if isP and (out.size() > 0 or wl > 0):
		Sim.glog("Кони падают от бескормицы: " + (", ".join(out) + " — спешились" if out.size() > 0 else "") + ("; " if out.size() > 0 and wl > 0 else "") + ("брошено " + JS.s(wl) + " " + Sim.plural(wl, "повозка", "повозки", "повозок") + " без упряжки" if wl > 0 else "") + ".", "bad")


static func _voinLost(k: float, one: String, many: String) -> String:
	return (one if fmod(k, 10.0) == 1.0 and fmod(k, 100.0) != 11.0 else many) + JS.s(k) + " " + Sim.plural(k, "воин", "воина", "воинов")


## день войска (army.js: dailyArmy): вода, снабжение, провиант, фураж, усталость, болезни, раны, голод и жажда,
## учения, лагерь, боевой дух, дезертирство; затем обёртка march.js — мороз и сорок дней ополчения
static func dailyArmy(a: Dictionary) -> void:
	var moved0 := JS.n(a.get("moved")) > 0.3
	await _dailyArmy(a)
	if not JS.t(a.alive) or a.kind == "caravan" or a.kind == "bandit":
		return
	var G := Sim.G
	var isP: bool = a.realm == G.player.realm and a.kind == "player"
	var cr := coldRisk(a, moved0)
	if cr > 0:
		var men := Sim.armyMen(a)
		var n := JS.rnd(men * cr * Sim.R.range(0.6, 1.4))
		if n >= 1:
			var k := takeMen(a, n)
			var sick := JS.rnd(k * 0.7)
			a.sick += sick
			a.deaths = JS.n(a.get("deaths")) + (k - sick)
			a.fat = JS.clp(a.fat + 3, 0, 100)
			if isP:
				a.frostAcc = JS.n(a.get("frostAcc")) + k
				if a.frostAcc >= 8 or not JS.t(a.get("frostLog")) or G.day - a.frostLog >= 5:
					Sim.glog("Мороз: обморожения — " + JS.s(a.frostAcc) + " " + Sim.plural(a.frostAcc, "воин слёг", "воина слегли", "воинов слегли") + ("" if JS.t(a.wagons) else " (палатки и дрова везут в обозе)") + ".", "bad")
					a.frostAcc = 0.0
					a.frostLog = G.day
	if not isP:
		return
	var p := Sim.W.prov[Sim.armyTile(a)]
	var home: bool = p >= 0 and Sim.ownerOfProv(p) == a.realm
	a.svc = maxf(0.0, JS.n(a.get("svc")) - 3) if home else JS.n(a.get("svc")) + 1
	if home and a.svc == 0:
		a.svcPaid = 0.0
	var lim := svcDays() + JS.n(a.get("svcPaid"))
	var lv := JS.n(a.u.get("levy"))
	if lv <= 0:
		return
	if a.svc == lim - 5:
		alerts.append({"k": "svc", "army": a.id, "levy": lv})
	if a.svc > lim:
		var k := minf(lv, maxf(1.0, JS.rnd(lv * minf(0.15, 0.025 + 0.01 * (a.svc - lim)) * Sim.R.range(0.7, 1.3))))
		a.u.levy -= k
		Sim.glog("Ополченцы уходят по домам: " + JS.s(k) + ". Сорок дней службы вышли" + (" — и оплаченные тоже" if JS.t(a.get("svcPaid")) else "") + ".", "bad")


static func svcDays() -> float:
	return SVC_DAYS + (20.0 if SimDyn.hasTech("standing") else 0.0)


## мороз (coldRisk): зимой в поле, в горах и на леднике — обморожения; под крышей своего поселения — нет
static func coldRisk(a: Dictionary, moved: bool) -> float:
	var G := Sim.G
	var s := Sim.seasonOf(G.day)
	var k: String = G.weather.k
	var T := Sim.W.ter[Sim.armyTile(a)]
	var high := T == WorldData.MOUNT or T == WorldData.PEAK or T == WorldData.SNOW
	if s != 3 and not (high and (T == WorldData.PEAK or T == WorldData.SNOW)):
		return 0.0
	var sid := settNear(a.x, a.y, 1.2)
	if sid >= 0 and G.setts[sid].ctrl == a.realm:
		return 0.0
	var r := (0.011 if k == "blizzard" else (0.0045 if k == "snow" else 0.0016)) if s == 3 else 0.0012
	if high:
		r *= 1.6
	if a.mode == "fort" and a.fortDays >= 2:
		r *= 0.5
	elif not moved:
		r *= 0.75
	var men := maxf(1.0, Sim.armyMen(a))
	r *= 1 - 0.45 * minf(1.0, JS.n(a.get("wagons")) * 150.0 / men)
	if JS.t(a.hunger):
		r *= 1.6
	return r


static func _dailyArmy(a: Dictionary) -> void:
	var G := Sim.G
	var W := Sim.W
	var UT := Sim.UT
	for u in UT:
		if fmod(a.u[u], 1.0) != 0.0:
			a.u[u] = JS.rnd(a.u[u])
	var men := Sim.armyMen(a)
	if men <= 0:
		destroyArmy(a, "разбежалось")
		return
	var t := Sim.armyTile(a)
	var season := Sim.seasonOf(G.day)
	var Wt := Sim.weatherOf()
	var p := W.prov[t]
	var sid := settNear(a.x, a.y, 1.2)
	var inOwn: bool = sid >= 0 and G.setts[sid].ctrl == a.realm
	var isP: bool = a.kind == "player"
	var moved := JS.n(a.get("moved")) > 0.3
	a.moved = 0.0
	var gr := groundOf(a) if isP or a.kind == "lord" else "open"
	a.ground = gr
	# вода: реки, озёра и поселения наполняют бочки; ручьи, родники и колодцы ферм дают часть дневной нужды
	var wd := waterDay(a, t, Wt)
	if JS.t(wd.get("full")) or a.kind == "caravan":
		a.water = Sim.waterCap(a)
		a.thirst = 0.0
	else:
		a.water = minf(Sim.waterCap(a), a.water + wd.d)
		if a.water < 0:
			a.water = 0.0
			a.thirst += 1.0
		else:
			a.thirst = 0.0
	# снабжение ИИ в своих поселениях
	if a.kind == "caravan":
		if sid >= 0:
			caravanSupply(a, G.setts[sid])
	elif not isP and inOwn and a.kind != "bandit":
		aiResupply(a, G.setts[sid])
	# провиант
	var aiLive: bool = a.kind == "lord" and p >= 0 and Sim.ownerOfProv(p) != a.realm and a.food < men * 4
	if a.mode == "forage" or (a.kind == "bandit" and not moved) or (a.kind == "lord" and a.mode == "siege") or aiLive:
		var y := forageYield(a) * (1.0 if a.mode == "forage" else (0.6 if a.mode == "siege" else 0.5))
		a.food += y
		if p >= 0:
			G.provs[p].dev = minf(0.9, G.provs[p].dev + y / 9000.0)
			if isP and Sim.ownerOfProv(p) == a.realm:
				G.provs[p].unrest = minf(100.0, G.provs[p].unrest + 3)
		a.foraged = y
	var eat: float = (men + a.wounded + a.sick) * eatK()
	a.townFed = 0.0
	if isP and inOwn:
		# на постое в своём городе: город кормит войско по рыночной цене, пока казна платит
		var S: Dictionary = G.setts[sid]
		var R0: Dictionary = G.realms[int(a.realm)]
		var pf := SimEcon.priceOf(S, "food")
		var n := maxf(0.0, floorf(minf(minf(eat, JS.n(S.mk.get("food"))), (R0.gold - 20) / pf)))
		if n > 0:
			SimEcon.mkTake(S, "food", n)
			R0.gold -= n * pf
			eat -= n
			a.townFed = n
	if a.kind == "caravan" and a.food < eat:
		a.cash -= (eat - a.food) * 0.07
		a.food = eat
		if a.cash < 0:
			a.cash = 0.0
			destroyArmy(a, "разорились")
			return
	a.food -= eat
	if a.food < 0:
		a.food = 0.0
		a.hunger += 1.0
	else:
		a.hunger = 0.0
	# фураж
	var horsesN: float = Sim.mountedN(a.u) + a.horses + a.wagons * 2
	var T := W.ter[t]
	var grassy := T == WorldData.GRASS or T == WorldData.STEPPE or T == WorldData.FARM or T == WorldData.HILLS or T == WorldData.BEACH
	var graze: float = ([0.7, 0.9, 0.5, 0.0] if grassy else [0.3, 0.4, 0.2, 0.0])[season]
	a.fodder -= horsesN * (1 - graze)
	if a.fodder < 0:
		a.fodder = 0.0
		starveHorses(a, isP)
		a.starveH = JS.n(a.get("starveH")) + 1
	else:
		a.starveH = 0.0
	# усталость
	if moved:
		a.fat += 11.0 if JS.t(a.forced) else 3.5 + (2.0 if T == WorldData.MOUNT or T == WorldData.MARSH or T == WorldData.DFOREST else 0.0) + (1.5 if JS.t(Wt.get("heat")) else 0.0)
	elif inOwn:
		a.fat -= 20.0
	elif a.mode == "fort":
		a.fat -= 10.0
	elif a.mode == "drill":
		a.fat += 2.0
	else:
		a.fat -= 6.0 if gr == "difficult" else 12.0
	if JS.t(a.hunger):
		a.fat += 4.0
	if JS.t(a.thirst):
		a.fat += 6.0
	a.fat = JS.clp(a.fat, 0, 100)
	# болезни
	var sr := 0.0012
	if T == WorldData.MARSH:
		sr *= 5
	if season == 3 and not inOwn:
		sr *= 2.5
	if JS.t(a.hunger):
		sr *= 3
	if JS.t(a.thirst):
		sr *= 4
	if JS.t(Wt.get("sick")):
		sr *= float(Wt.sick)
	if gr == "difficult":
		sr *= 1.5
	if a.stay > 12 and not inOwn:
		sr *= 2
	if a.mode == "siege" and a.stay > 15:
		sr *= 1.6
	var ns := men * sr * Sim.R.range(0.5, 1.5)
	if ns >= 1:
		var k := takeMen(a, JS.rnd(ns))
		a.sick += k
	# больные и раненые: выздоравливают или умирают
	if a.sick > 0:
		var rec: float = a.sick * (0.14 if inOwn else 0.06) * (1.4 if a.realm == 0.0 and SimDyn.hasTech("surgery") else 1.0) * (1.25 if a.kind == "player" and docInCamp() else 1.0)
		var die: float = a.sick * (0.03 if T == WorldData.MARSH else 0.012) * (2.0 if JS.t(a.hunger) else 1.0)
		a.sick = maxf(0.0, a.sick - rec - die)
		returnMen(a, rec)
		a.deaths = JS.n(a.get("deaths")) + die
	if a.wounded > 0:
		var rec: float = a.wounded * (0.09 if inOwn else 0.035)
		var die: float = a.wounded * 0.006
		a.wounded = maxf(0.0, a.wounded - rec - die)
		returnMen(a, rec)
	# голод и жажда
	if a.hunger > 3:
		var k := takeMen(a, ceilf(men * 0.01 * (a.hunger - 3)))
		if isP and k != 0.0:
			Sim.glog("Голод: " + _voinLost(k, "умер ", "умерли ") + ".", "bad")
	if a.thirst > 1:
		var k := takeMen(a, ceilf(men * 0.02 * a.thirst))
		if isP and k != 0.0:
			Sim.glog("Жажда: " + _voinLost(k, "погиб ", "погибли ") + ".", "bad")
	# учения
	if a.mode == "drill":
		for u in UT:
			a.xp[u] = minf(100.0, a.xp[u] + 0.6 * (1 - a.xp[u] / 120.0))
	# укреплённый лагерь
	if a.mode == "fort":
		a.fortDays = minf(3.0, a.fortDays + 1)
	if not moved:
		a.stay += 1.0
	else:
		a.stay = 0.0
	# боевой дух
	var gen: Variant = Sim.charOf(a.gen)
	var tgt := 62.0 + (Sim.traitSum(gen, "mor") if gen != null else 0.0)
	if JS.t(a.hunger):
		tgt -= 18 + a.hunger * 3
	if JS.t(a.thirst):
		tgt -= 25
	tgt -= a.fat / 5.0
	tgt -= (a.sick / maxf(1.0, men)) * 60
	if a.realm < 5 and G.realms[int(a.realm)].gold < 0:
		tgt -= 25
	if JS.t(a.vict):
		tgt += a.vict
		a.vict *= 0.93
		if absf(a.vict) < 0.5:
			a.vict = 0.0
	if gr == "serious":
		tgt += 5
	if gr == "dispersive":
		tgt -= 3
	if gr == "facile" and not moved:
		tgt -= 4
	if inOwn:
		tgt += 6
	if a.mode == "fort" and a.fortDays >= 2:
		tgt += 4
	if a.mode == "drill":
		tgt += 2
	if season == 3 and not inOwn:
		tgt -= 6
	a.morale += (JS.clp(tgt, 5, 100) - a.morale) * 0.15
	a.morale = JS.clp(a.morale, 0, 100)
	# дезертирство
	if a.morale < 35 and a.kind != "caravan" and gr != "serious" and gr != "death":
		var k: float = (35 - a.morale) / 35.0 * 0.03 * (2.0 if gr == "dispersive" else 1.0) * (0.4 if JS.n(a.get("disc")) > G.day else 1.0)
		var lost := 0.0
		for u in UT:
			var pro: float = DESERT_PRO.get(u, 1.0)
			var n := floorf(a.u[u] * k * pro * Sim.R.range(0.6, 1.4))
			a.u[u] -= n
			lost += n
		if isP and lost > 0:
			Sim.glog("Дезертирство: " + _voinLost(lost, "ушёл ", "ушли ") + ". Боевой дух слишком низок.", "bad")
	if a.mode == "siege":
		await SimArmy.siegeDaily(a)
	if Sim.armyMen(a) <= 0 and JS.t(a.alive):
		destroyArmy(a, "погибло")


# ---------- дипломатия (diplo.js) ----------
static func alive(r: int) -> bool:
	return r < 5 and not JS.t(Sim.G.realms[r].get("dead"))

static func warsOf(r: float) -> Array:
	var o := []
	var R: Array = Sim.G.rel[int(r)]
	for t in 5:
		if float(t) != r and JS.t(R[t].war):
			o.append(float(t))
	return o

static func setRel(a: float, b: float, k: String, v: float) -> void:
	Sim.G.rel[int(a)][int(b)][k] = v
	Sim.G.rel[int(b)][int(a)][k] = v

static func addOpn(a: float, b: float, v: float) -> void:
	var r: Dictionary = Sim.G.rel[int(a)][int(b)]
	r.opn = JS.clp(r.opn + v, -100, 100)

static func rulerOf(r: int) -> Variant:
	return Sim.charOf(Sim.G.realms[r].ruler)

static func rV(r: int, f: String, n: String, p: String) -> String:
	var g: String = RG[r]
	return f if g == "f" else (n if g == "n" else p)

## державы-соседи r (ai.js: neighbours): чьи провинции граничат с её провинциями
static func neighbours(r: float) -> Dictionary:
	var G := Sim.G
	var W := Sim.W
	var s := {}
	for P in W.provs:
		if G.setts[P.seat].ctrl != r:
			continue
		for n in P.nb:
			var o: float = G.setts[W.provs[int(n)].seat].ctrl
			if o != r:
				s[o] = true
	return s

static func neighboursSet(r: float) -> Dictionary:
	if nb_cache.d != Sim.G.day:
		nb_cache = {"d": Sim.G.day, "m": {}}
	if not nb_cache.m.has(r):
		nb_cache.m[r] = neighbours(r)
	return nb_cache.m[r]

## что x думает о y (opinionBreakdown): слагаемые отношения
static func opinionBreakdown(x: int, y: int) -> Array:
	var G := Sim.G
	var r: Dictionary = G.rel[x][y]
	var o := []
	o.append({"t": "Отношения", "v": JS.rnd(r.opn)})
	if JS.t(r.ally):
		o.append({"t": "Союз", "v": 25.0})
	if r.pact > G.day:
		o.append({"t": "Пакт о ненападении", "v": 10.0})
	if JS.t(r.war):
		o.append({"t": "Война", "v": -40.0})
	if r.truce > G.day:
		o.append({"t": "Недавняя война", "v": -10.0})
	var ce := 0
	for t in warsOf(x):
		if JS.t(G.rel[y][int(t)].war):
			ce += 1
	if ce:
		o.append({"t": "Общий враг", "v": 15.0 * ce})
	var ry: Dictionary = rulerOf(y)
	var rx: Dictionary = rulerOf(x)
	if rx.traits.has("honest") and ry.traits.has("honest"):
		o.append({"t": "Оба честны", "v": 10.0})
	if rx.traits.has("cunning") and ry.traits.has("honest"):
		o.append({"t": "Хитрец не доверяет честному", "v": -5.0})
	if rx.traits.has("proud") and JS.n(G.realms[y].get("prestige")) > JS.n(G.realms[x].get("prestige")) + 30:
		o.append({"t": "Зависть гордеца", "v": -10.0})
	var pr := JS.rnd(JS.n(G.realms[y].get("prestige")) / 10.0)
	if pr != 0.0:
		o.append({"t": "Слава державы", "v": JS.clp(pr, -15, 15)})
	return o

static func opinionOf(x: int, y: int) -> float:
	var s := 0.0
	for l in opinionBreakdown(x, y):
		s += l.v
	return JS.clp(s, -100, 100)

## раз в неделю: отношения тянутся к соседству и войне; державы ИИ заключают союзы и пакты
static func diploWeekly() -> void:
	var G := Sim.G
	for a in 5:
		for b in 5:
			if a == b:
				continue
			var r: Dictionary = G.rel[a][b]
			var tgt := 0.0
			if neighboursSet(a).has(float(b)):
				tgt -= 12
			if JS.t(r.war):
				tgt -= 30
			r.opn += (tgt - r.opn) * 0.03
	var me := int(G.player.realm)
	for a in range(1, 5):
		for b in range(a + 1, 5):
			if not alive(a) or not alive(b) or a == me or b == me:
				continue
			var r: Dictionary = G.rel[a][b]
			if JS.t(r.war) or JS.t(r.ally):
				continue
			var common := false
			for t in warsOf(a):
				if JS.t(G.rel[b][int(t)].war):
					common = true
					break
			if common and opinionOf(a, b) > 0 and opinionOf(b, a) > 0 and Sim.R.f() < 0.3:
				setRel(a, b, "ally", 1.0)
				Sim.glog(Sim.realmName(a) + " и " + Sim.realmName(b) + " заключили союз.", "info")
			elif r.pact < G.day and opinionOf(a, b) > 15 and Sim.R.f() < 0.08:
				setRel(a, b, "pact", G.day + Sim.DAYS_YEAR * 2)

## державы без крепостей и войск падают (checkRealms)
static func checkRealms() -> void:
	var G := Sim.G
	var W := Sim.W
	for r in 5:
		var R0: Dictionary = G.realms[r]
		if JS.t(R0.get("dead")):
			continue
		var forts := 0
		var owned := 0
		for S in G.setts:
			if S.ctrl == float(r) and W.setts[int(S.id)].type != "village":
				forts += 1
			if S.owner == float(r):
				owned += 1
		var field := false
		for a in G.armies:
			if JS.t(a.alive) and a.realm == float(r) and (a.kind == "lord" or a.kind == "player"):
				field = true
				break
		if (forts == 0 and owned == 0) or (forts == 0 and not field):
			if float(r) == G.player.realm:
				if not JS.t(G.get("over")):
					G.over = {"win": false, "why": "Держава пала: у короля не осталось ни одной крепости."}
				continue
			R0.dead = 1.0
			for t in 7:
				if t != r and t != 6:
					setRel(r, t, "war", 0.0)
					setRel(r, t, "ally", 0.0)
			for a in G.armies:
				if JS.t(a.alive) and a.realm == float(r) and a.kind != "caravan":
					destroyArmy(a, "держава пала")
			for S in G.setts:
				if S.owner == float(r):
					S.owner = 5.0 if S.ctrl == float(r) else S.ctrl
			Sim.glog("Держава " + Sim.realmName(r) + " " + rV(r, "пала", "пало", "пали") + "!", "bad" if float(r) == G.player.realm else "title")
			Sim.pol_dirty = 1

## победа мечом: своя столица и две чужие (checkVictory)
static func checkVictory() -> void:
	var G := Sim.G
	var p: float = G.player.realm
	if JS.t(G.get("over")):
		return
	var own: bool = G.setts[int(G.realms[int(p)].capital)].ctrl == p
	var others := 0
	for r in 5:
		if float(r) != p and G.setts[int(G.realms[r].capital)].ctrl == p:
			others += 1
	G.capsHeld = float(others)
	if own and others >= 2:
		G.over = {"win": true, "kind": "sword", "why": "Король держит свою столицу и две чужие. Земли склонились перед мечом."}
