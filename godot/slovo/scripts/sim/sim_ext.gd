class_name SimExt
## Дни двора сверх совета (DAILY_EXT в HTML, тот же порядок): королевские работы (projects.js), пир без короля (feast.js),
## выкупы пленников (chapel.js), снабженец в походе (supply.js), смена эпох, завет и сословия (reign.js); Совет короны
## зимой (diplo.js: holdCouncil) и случайные события похода (events.js: EVENTS, randomEvent).

## двору пересобрать стройки и людей (projApply, courtPopulate)
static var proj_rev := 0

# ---------- королевские работы (projects.js) ----------
static func projK(k: String) -> Variant:
	return Sim.T.PROJK.get(k)

static func projState() -> Variant:
	var G := Sim.G
	if G.is_empty() or not G.has("court"):
		return null
	var C: Dictionary = G.court
	if not JS.t(C.get("proj")):
		C.proj = {"done": {}, "cur": null}
	return C.proj

static func projCur(k := "") -> Variant:
	var G := Sim.G
	var P: Variant = G.court.get("proj") if not G.is_empty() and G.has("court") else null
	return P.cur if JS.t(P) and JS.t(P.get("cur")) and (k == "" or P.cur.k == k) else null

static func projRate() -> float:
	var s: Variant = SimDyn.seatChar("seneschal")
	return JS.clp(0.8 + float(JS.o(s.get("stew"), 8.0)) / 25, 0.9, 1.7) if s != null else 0.75

## день работ: стройка идёт (в бурю и метель под открытым небом — втрое медленнее), статуя и летопись дают славу каждый сезон
static func projDaily() -> void:
	var G := Sim.G
	var P: Variant = projState()
	if P == null:
		return
	var c: Variant = P.cur
	if JS.t(c):
		var bad: bool = JS.t(G.get("weather")) and (G.weather.k == "storm" or G.weather.k == "blizzard") and JS.t(projK(c.k).get("out"))
		c.prog += projRate() * (0.3 if bad else 1.0)
		if c.prog >= c.need:
			projFinish(c.k)
	if Sim.seasonOf(G.day) != Sim.seasonOf(G.day - 1):
		var p := 0.0
		if SimDyn.projDone("statue"):
			p += 1
		if SimDyn.projDone("chronicle"):
			p += 1
		if p != 0.0:
			SimCourt.prestige(p)
	if P.has("lastKing") and P.lastKing != G.player.char:
		var old: Variant = P.done.get("chronicle")
		if JS.t(old) and old.king == P.lastKing:
			for H0 in G.houses:
				SimPlayer.houseLoy(H0, 4)
			Sim.glog("Летопись прежнего царствования читают вслух: знатные дома помнят, кому присягали их отцы.", "good")
	P.lastKing = G.player.char

static func projFinish(k: String) -> void:
	var G := Sim.G
	var P: Dictionary = projState()
	var d: Dictionary = projK(k)
	P.cur = null
	P.done[k] = {"day": G.day, "king": G.player.char}
	var sp: Variant = Sim.charOf(SimPlayer.kingC().get("spouse"))
	match k:
		"statue":
			SimCourt.prestige(6)
		"portrait":
			SimCourt.prestige(3)
		"stainglass":
			SimCourt.prestige(2)
		"stands":
			SimCourt.prestige(1)
	if k == "roses" and sp != null and JS.t(sp.alive):
		sp.loy = JS.clp(float(JS.o(sp.get("loy"), 50.0)) + 10, 0, 100)
	Sim.glog("Достроено: «" + String(d.n) + "». " + String(d.fx), "good")
	if SimSick.court_vis:
		SimPlayer.toast("Готово: «" + String(d.n) + "»!")
		Sim.sfx("bell")
	proj_rev += 1

static func projStart(k: String) -> bool:
	var G := Sim.G
	var P: Dictionary = projState()
	var d: Variant = projK(k)
	var r: Dictionary = G.realms[0]
	if d == null or JS.t(P.cur) or SimDyn.projDone(k):
		return false
	if r.gold < d.cost:
		SimPlayer.toast("Не хватает золота.")
		return false
	r.gold -= d.cost
	P.cur = {"k": k, "prog": 0.0, "need": float(d.days), "day": G.day}
	Sim.glog("Заложено: «" + String(d.n) + "» (" + JS.s(d.cost) + " зол.).", "info")
	Sim.sfx("coin")
	proj_rev += 1
	return true

static func projStop() -> void:
	var G := Sim.G
	var P: Dictionary = projState()
	var c: Variant = P.cur
	if not JS.t(c):
		return
	var d: Dictionary = projK(c.k)
	var back := JS.rnd(d.cost * 0.5 * (1 - c.prog / c.need))
	G.realms[0].gold += back
	P.cur = null
	Sim.glog("Стройка «" + String(d.n) + "» свёрнута. В казну вернулось " + JS.s(back) + " зол.", "info")
	proj_rev += 1

# ---------- пир без короля (feast.js) ----------
static func feastDaily() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var st: Variant = C.get("feast")
	if JS.t(st) and st.day == G.day - 1 and C.get("feastDay") == st.day and JS.t(st.get("home")) and not JS.t(st.get("sat")):
		for H0 in G.houses:
			if JS.t(H0.alive):
				SimPlayer.houseLoy(H0, -1)
		Sim.glog("Знать пировала без короля: в зале шептались, что государь пренебрегает гостями.", "bad")

# ---------- выкупы пленников (chapel.js): C.pris[id] = {rans: {gold, day}, ref} ----------
static func ransomDaily() -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	if not JS.t(C.get("pris")):
		return
	for id in (C.pris as Dictionary).keys():
		var P: Dictionary = C.pris[id]
		var c: Variant = Sim.charOf(String(id).to_float())
		if c == null or not JS.t(c.alive) or c.prison != 0.0:
			C.pris.erase(id)
			continue
		var RS: Variant = P.get("rans")
		if not JS.t(RS) or RS.day > G.day:
			continue
		P.rans = null
		var r := int(c.realm)
		if r <= 0 or r >= 5 or not SimDay.alive(r):
			continue
		var Rr: Dictionary = G.realms[r]
		var ru: Variant = SimDay.rulerOf(r)
		var ws: Variant = Sim.W.setts[int(Rr.capital)] if Rr.capital >= 0 else null
		var tr: Array = ru.traits if ru != null else []
		var pay: bool = Rr.gold >= RS.gold and Sim.R.chance(JS.clp(0.55 + G.rel[r][0].opn / 200 + (0.4 if c.role == "ruler" else 0.0) + (float(JS.o(c.get("mar"), 10.0)) - 10) * 0.02 - (0.15 if tr.has("greedy") else 0.0), 0.15, 0.95))
		var L := {"from": String(ru.title) + " " + String(ru.name) if ru != null else Sim.realmName(r), "fc": ru.id if ru != null else -1.0, "subj": "Выкуп: " + String(c.name)}
		if ws != null:
			L.x = float(ws.x)
			L.y = float(ws.y)
		if pay:
			Rr.gold -= RS.gold
			G.realms[0].gold += RS.gold
			c.prison = -1.0
			C.pris.erase(id)
			SimDay.addOpn(r, 0, 4)
			L.text = "«Золото отправлено с моим гонцом: " + JS.s(RS.gold) + " зол. Пусть мой человек, " + String(c.name) + ", вернётся домой — и больше не попадается вам в руки»."
			Sim.glog("Получен выкуп: +" + JS.s(RS.gold) + " зол. " + String(c.name) + " отпущен домой.", "good")
			Sim.sfx("coin")
			proj_rev += 1
		else:
			P.ref = G.day
			L.text = "«Казна моя пуста, и последнего я за него не отдам. Держите его у себя»." if Rr.gold < RS.gold else "«Я не торгуюсь с теми, кто держит моих людей в цепях»."
			Sim.glog("Держава " + Sim.realmName(r) + " отказалась платить выкуп (" + String(c.name) + ").", "info")
		SimDyn.addLetter(L)

# ---------- снабженец в походе (supply.js) ----------
const DIR8 := ["востоку", "юго-востоку", "югу", "юго-западу", "западу", "северо-западу", "северу", "северо-востоку"]

static func supS() -> Dictionary:
	var G := Sim.G
	var H: Dictionary = G.court if JS.t(G.get("court")) else G
	if not JS.t(H.get("sup")):
		H.sup = {}
	var o: Dictionary = H.sup
	if not o.has("days"):
		Sim.assign(o, {"on": 1.0, "days": 14.0, "route": 1.0, "wag": 1.0, "res": 100.0, "dest": -1.0, "last": "", "lastDay": -9.0, "sid": -1.0, "sidDay": -9.0, "warnD": -9.0})
	return o

static func dn(d: float) -> String:
	return JS.s(d) + " " + Sim.plural(d, "день", "дня", "дней")

static func supMen(a: Dictionary) -> float:
	return Sim.armyMen(a) + JS.n(a.get("wounded")) + JS.n(a.get("sick"))

static func supHorses(a: Dictionary) -> float:
	return Sim.mountedN(a.u) + JS.n(a.get("horses")) + JS.n(a.get("wagons")) * 2

static func supGraze() -> float:
	return [0.55, 0.7, 0.4, 0.0][Sim.seasonOf(Sim.G.day)] * 0.8

static func supDaysOf(a: Dictionary) -> Dictionary:
	var m := maxf(1, supMen(a))
	var h := supHorses(a)
	var r := Sim.rangedN(a.u)
	return {"food": JS.n(a.get("food")) / (m * SimDay.eatK()), "fodder": JS.n(a.get("fodder")) / maxf(0.05, h * (1 - supGraze())) if h != 0.0 else 99.0,
		"water": JS.n(a.get("water")), "arrows": JS.n(a.get("arrows")) / r if r != 0.0 else -1.0}

static func kmDir(a: Dictionary, x: float, y: float) -> String:
	var dx: float = x - a.x
	var dy: float = y - a.y
	var km := maxf(1, JS.rnd(JS.hypot(dx, dy) * float(Sim.T.KM_PER_TILE)))
	return "в " + JS.s(km) + " км к " + String(DIR8[posmod(int(JS.rnd(atan2(dy, dx) / (PI / 4))), 8)])

static func supMarketNear(a: Dictionary) -> Variant:
	var G := Sim.G
	var best: Variant = null
	var bd := 1e9
	for ws in Sim.W.setts:
		var S: Variant = G.setts[int(ws.id)] if int(ws.id) < G.setts.size() else null
		if S == null or Sim.hostile(G.player.realm, S.ctrl) or JS.t(S.get("siege")) or JS.n(S.mk.get("food")) < 50:
			continue
		var d := JS.hypot(ws.x + 0.5 - a.x, ws.y + 0.5 - a.y)
		if d < bd:
			bd = d
			best = ws
	return best

static func supWaterTile(a: Dictionary) -> int:
	var t := Sim.armyTile(a)
	return -1 if Sim.W.fwd[t] <= 2 else SimAI.waterTileNear(t)

## снабженец предупреждает: еды, воды или фуража на день-два
static func supWarn() -> void:
	var G := Sim.G
	var pa: Variant = Sim.playerArmy()
	if pa == null:
		return
	var o := supS()
	if G.day - o.warnD < 2:
		return
	var d := supDaysOf(pa)
	var wd: Dictionary = SimDay.waterDay(pa)
	var wl: float = 99.0 if JS.t(wd.get("full")) or wd.d >= 0 else JS.n(pa.get("water")) / -wd.d
	var bad: Array = []
	if d.food < 3:
		bad.append("еды на " + dn(maxf(0, floorf(d.food))))
	if wl < 2:
		bad.append("воды на " + dn(maxf(0, floorf(wl))))
	if supHorses(pa) != 0.0 and d.fodder < 2:
		bad.append("фуража на " + dn(maxf(0, floorf(d.fodder))))
	if bad.is_empty():
		return
	o.warnD = G.day
	var s := "Снабженец: " + ", ".join(bad) + "."
	if wl < 2:
		var wt := supWaterTile(pa)
		if wt >= 0:
			s += " Ближайшая вода — " + kmDir(pa, wt % Sim.MW + 0.5, floorf(wt / Sim.MW) + 0.5) + " (O → «Вести к воде»)."
	if d.food < 3 or (supHorses(pa) != 0.0 and d.fodder < 2):
		var m: Variant = supMarketNear(pa)
		if m != null:
			s += " Ближайший рынок — " + String(m.name) + ", " + kmDir(pa, m.x + 0.5, m.y + 0.5) + "."
	Sim.glog(s, "bad")

# ---------- эпохи, завет, сословия (reign.js) ----------
static func reignDaily() -> void:
	var G := Sim.G
	var R0: Variant = SimArmy.reignInit()
	if R0 == null:
		return
	var e := float(SimArmy.eraNow())
	if not G.has("eraSeen"):
		G.eraSeen = e
	if e > G.eraSeen:
		G.eraSeen = e
		var E: Dictionary = Sim.T.ERAS[int(e)]
		var L: Array = []
		var TT: Dictionary = SimTech.TECH()
		for x in TT:
			if float(TT[x].era) == e:
				L.append(String(TT[x].n))
		Sim.glog("Наступает новая эпоха — " + String(E.n) + ". Магистру открыты новые знания: " + ", ".join(L) + ".", "title")
		SimArmy.chron("Новая эпоха: " + String(E.n) + ".", "hourglass", "era", 2)
		SimDay.alerts.append({"k": "ev", "court": 1, "e": {"id": "era", "title": String(E.n), "ic": "hourglass", "opts": [{"t": "Открыть «Знания»", "win": "tech"}, {"t": "Позже"}]},
			"text": "Времена меняются. В мастерских и школах — новое: " + ", ".join(L) + ". Магистр может взяться за них."})
	var g: Variant = R0.goal
	if JS.t(g) and not JS.t(g.get("done")) and SimDyn.goalDone(g):
		g.done = G.day
		SimCourt.prestige(6)
		var t: String = g.t
		SimArmy.chron("Завет исполнен: " + (t.left(-1) if t.ends_with(".") else t) + ".", "star", "goal", 3)
		Sim.glog("Завет исполнен! Слава +6.", "good")
		SimPlayer.toast("Завет исполнен")
	if SimDyn.hasTech("estates"):
		for P in G.provs:
			if G.setts[int(Sim.W.provs[int(P.id)].seat)].owner == 0.0:
				P.unrest = maxf(0, P.unrest - 0.1)
		if fmod(G.day, Sim.DAYS_SEASON) == 0.0:
			for H0 in G.houses:
				if JS.t(H0.alive):
					SimPlayer.houseLoy(H0, 1)

# ---------- Совет короны (diplo.js): зимой правители голосуют за Верховного короля ----------
static func councilScore(x: int, c: int) -> float:
	var G := Sim.G
	var rx: Dictionary = SimDay.rulerOf(x)
	var tot := 0.0
	for k in 5:
		if SimDay.alive(k):
			tot += SimAI.realmPower(k)
	var share := func(r: int) -> float: return SimAI.realmPower(r) / maxf(1, tot)
	if c == x:
		return 18 + (22.0 if rx.traits.has("proud") else 0.0) + JS.n(G.realms[x].get("prestige")) * 0.15 + share.call(x) * 60
	var r: Dictionary = G.rel[x][c]
	var s: float = SimDay.opinionOf(x, c) * 0.8 + (20.0 if JS.t(r.get("ally")) else 0.0) - (200.0 if JS.t(r.get("war")) else 0.0) + JS.n(G.realms[c].get("prestige")) * 0.12 + share.call(c) * 40
	if float(c) == G.player.realm:
		s += minf(30, JS.n(G.realms[c].get("fear")) * 0.5)
	return s

static func councilVotes() -> Array:
	var G := Sim.G
	var v: Array = []
	for x in 5:
		if not SimDay.alive(x):
			continue
		if float(x) == G.player.realm:
			v.append({"x": float(x), "c": float(x)})
			continue
		var best := x
		var bs := -1e9
		for c in 5:
			if not SimDay.alive(c):
				continue
			var s := councilScore(x, c)
			if s > bs:
				bs = s
				best = c
		v.append({"x": float(x), "c": float(best), "s": bs})
	return v

static func holdCouncil() -> void:
	var G := Sim.G
	var v := councilVotes()
	var n := 0.0
	for e in v:
		if e.c == G.player.realm:
			n += 1
	G.lastCouncil = {"day": G.day, "votes": v, "n": n}
	var ru: Dictionary = SimDay.rulerOf(int(G.player.realm))
	Sim.glog("Совет короны собрался. За короля " + String(ru.name) + " — " + JS.s(n) + " " + Sim.plural(n, "голос", "голоса", "голосов") + " из " + str(v.size()) + ".", "good" if n >= 3 else "title")
	SimDay.alerts.append({"k": "council", "court": 1, "v": v})
	if n >= 3:
		G.over = {"win": true, "kind": "word", "why": "Совет короны признал короля " + String(ru.name) + " Верховным королём. «Лучшая победа — победа без сражения»."}

# ---------- случайные события похода (events.js) ----------
static var _evT := 0.0
static var _evP := 0

static func _gold() -> Dictionary:
	return Sim.G.realms[int(Sim.G.player.realm)]

static func _xp(a: Dictionary, v: float) -> void:
	for u in Sim.UT:
		a.xp[u] = minf(100, a.xp[u] + v)

static func _rel(t: int) -> Dictionary:
	return Sim.G.rel[0][t]

static func _envoyT() -> int:
	var G := Sim.G
	for t in [1, 2, 3, 4]:
		if SimDay.alive(t) and not JS.t(_rel(t).get("war")) and SimDay.opinionOf(t, 0) > 10 and JS.n(_rel(t).get("pact")) < G.day and not JS.t(_rel(t).get("ally")):
			return t
	return 0

static func EVENTS() -> Array:
	var G := Sim.G
	var pr := func() -> Variant: return Sim.playerArmy()
	return [
		{"id": "merchant", "w": 3, "cond": func(): return JS.n(pr.call().food) < Sim.armyMen(pr.call()) * 10,
			"title": "Купец у лагеря", "ic": "wagon", "text": func(): return "Седой купец с тремя возами пригнал к лагерю зерно. «Слышал, войску короля нужен хлеб. Продам дешевле, чем в городе — но за золото сразу».\n\nСунь-цзы: «Перевозить припасы издалека — разорять народ». Купленное на месте дешевле привезённого.",
			"opts": [{"t": "Купить 800 провианта за 30 зол.", "ok": func(): return _gold().gold >= 30, "fx": func():
				_gold().gold -= 30
				pr.call().food += 800}, {"t": "Отказать", "fx": func(): pass}]},
		{"id": "fever", "w": 3, "cond": func(): return JS.n(pr.call().get("sick")) > Sim.armyMen(pr.call()) * 0.04,
			"title": "Лихорадка в лагере", "ic": "sick", "text": func(): return "Лекарь докладывает: лихорадка ползёт по шатрам. Больных уже " + JS.s(JS.rnd(JS.n(pr.call().get("sick")))) + ".\n\nСунь-цзы: «Войско предпочитает высокое и сухое, избегает низкого и сырого. Где войско бережёт себя от болезней — там победа».",
			"opts": [{"t": "Отделить больных и оставить в ближайшей деревне", "tip": "Больные уходят из войска (часть вернётся домой).", "fx": func():
				var a: Dictionary = pr.call()
				a.sick = 0.0
				a.morale -= 3}, {"t": "Выхаживать всех (−40 провианта в день не изменится)", "tip": "Боевой дух +5: король не бросает своих.", "fx": func(): pr.call().morale += 5}]},
		{"id": "deserter", "w": 2, "cond": func(): return not SimDay.warsOf(G.player.realm).is_empty(),
			"title": "Перебежчик", "ic": "spy", "text": func():
				var t: float = Sim.R.pick(SimDay.warsOf(G.player.realm))
				_evT = t
				return "Ночью к дозорным вышел человек в плаще войска державы " + Sim.realmName(t) + ". Говорит, что знает, где стоят их отряды, и просит золота.\n\nСунь-цзы: «Сведения нельзя получить от духов… их получают от людей». Но перебежчик может быть и подосланным.",
			"opts": [{"t": "Заплатить 25 зол. и выслушать", "ok": func(): return _gold().gold >= 25, "fx": func():
				_gold().gold -= 25
				if Sim.R.f() < 0.75:
					G.spies.append({"type": "inward", "realm": _evT, "until": G.day + 14, "d0": G.day})
					Sim.glog("Перебежчик не солгал: 14 дней мы видим все войска державы " + Sim.realmName(_evT) + ".", "good")
					SimIntel.computeVision()
				else:
					Sim.glog("Перебежчик исчез ночью вместе с золотом. Обман.", "bad")}, {"t": "Прогнать", "fx": func(): pass}]},
		{"id": "quarrel", "w": 2, "cond": func(): return Sim.armyMen(pr.call()) > 150,
			"title": "Ссора в войске", "ic": "sword", "text": func(): return "Латники и ополченцы подрались из-за места у костров. Двое ранены. Воеводы ждут королевского слова.\n\nСунь-цзы: «Если с воинами обращаться ласково, но не уметь приказывать, — они как избалованные дети, ни на что не годны».",
			"opts": [{"t": "Наказать зачинщиков плетьми", "tip": "Дух −4, опыт +3: порядок прежде всего.", "fx": func():
				var a: Dictionary = pr.call()
				a.morale -= 4
				_xp(a, 3)}, {"t": "Выкатить бочку вина и помирить", "tip": "−15 зол., дух +6.", "ok": func(): return _gold().gold >= 15, "fx": func():
				_gold().gold -= 15
				pr.call().morale += 6}]},
		{"id": "omen", "w": 1, "cond": func(): return true,
			"title": "Знамение", "ic": "star", "text": func(): return "В ночном небе прошла хвостатая звезда. Воины шепчутся: к беде или к победе?\n\nСунь-цзы: «Запрещай гадания и пресекай сомнения — и до самой смерти воины не дрогнут».",
			"opts": [{"t": "Объявить звезду добрым знаком", "tip": "Дух +8.", "fx": func(): pr.call().morale += 8}, {"t": "Запретить толки о знамениях", "tip": "Дух +3, опыт +2.", "fx": func():
				var a: Dictionary = pr.call()
				a.morale += 3
				_xp(a, 2)}]},
		{"id": "guide", "w": 2, "cond": func():
				var p: int = Sim.W.prov[Sim.armyTile(pr.call())]
				return p >= 0 and JS.n(G.provs[p].get("guides")) <= G.day,
			"title": "Охотник-проводник", "ic": "eye", "text": func():
				var p: int = Sim.W.prov[Sim.armyTile(pr.call())]
				_evP = p
				return "Местный охотник предлагает провести войско тропами провинции " + String(Sim.W.provs[p].name) + " — через леса и топи, где не пройдёт чужак.\n\nСунь-цзы: «Кто не пользуется местными проводниками, тот не извлечёт выгод из местности».",
			"opts": [{"t": "Нанять за 10 зол. (марш −20% на 30 дней)", "ok": func(): return _gold().gold >= 10, "fx": func():
				_gold().gold -= 10
				G.provs[_evP].guides = G.day + 30}, {"t": "Обойдёмся", "fx": func(): pass}]},
		{"id": "mercs", "w": 2, "cond": func(): return _gold().gold > 100,
			"title": "Вольный отряд", "ic": "flag", "text": func(): return "Кондотьер вольного отряда предлагает мечи: 25 копейщиков и 15 лучников. «Плата вперёд, ваше величество, мы люди простые».\n\nСунь-цзы: «Где войско стоит долго — истощаются силы государства». Наёмники обходятся дорого.",
			"opts": [{"t": "Нанять за 110 зол.", "ok": func(): return _gold().gold >= 110, "fx": func():
				_gold().gold -= 110
				var a: Dictionary = pr.call()
				a.u.spear += 25
				a.u.archer += 15
				a.arrows += 300}, {"t": "Отказать", "fx": func(): pass}]},
		{"id": "harvest", "w": 2, "cond": func(): return Sim.seasonOf(G.day) == 2,
			"title": "Богатый урожай", "ic": "food", "text": func(): return "Крестьяне собрали небывалый урожай. Старосты спрашивают, можно ли продать излишки в чужие земли.\n\nСунь-цзы: «Искусный в войне не набирает ополчение дважды и не возит провиант трижды».",
			"opts": [{"t": "Разрешить торговлю", "tip": "Казна +40.", "fx": func(): _gold().gold += 40}, {"t": "Засыпать в королевские житницы", "tip": "Амбары столицы +1 500 мер, запас крепостей ×1.5, провиант на рынках +.", "fx": func():
				if JS.t(G.get("court")):
					G.court.grain = minf(SimCourt.granCap(), JS.n(G.court.get("grain")) + 1500)
				for S in G.setts:
					if S.ctrl == G.player.realm:
						S.food = minf(S.foodMax * 1.5, S.food * 1.5)
						S.mk.food = JS.n(S.mk.get("food")) * 1.3}]},
		{"id": "envoy", "w": 2, "cond": func(): return _envoyT() > 0,
			"title": "Посол", "ic": "scroll", "text": func():
				_evT = _envoyT()
				return "Прибыл посол державы " + Sim.realmName(_evT) + " с предложением пакта о ненападении на два года.\n\nСунь-цзы: «Не зная замыслов соседей, нельзя заключать с ними союзы».",
			"opts": [{"t": "Принять пакт", "fx": func():
				SimDay.setRel(0, _evT, "pact", G.day + Sim.DAYS_YEAR * 2)
				SimDay.addOpn(_evT, 0, 5)
				Sim.glog("Пакт о ненападении: " + Sim.realmName(_evT) + ".", "good")}, {"t": "Вежливо отказать", "fx": func(): SimDay.addOpn(_evT, 0, -5)}]},
		{"id": "deserters", "w": 2, "cond": func(): return pr.call().morale < 45,
			"title": "Пойманы беглецы", "ic": "men", "text": func(): return "Дозор поймал шестерых, бежавших ночью из лагеря. Войско смотрит, что сделает король.\n\nСунь-цзы: «Если наказывать воинов прежде, чем они привязались к тебе, — они не будут покорны. Если привязались, а наказаний нет — они бесполезны».",
			"opts": [{"t": "Казнить для острастки", "tip": "Дезертирство меньше, но дух −5.", "fx": func():
				var a: Dictionary = pr.call()
				a.morale -= 5
				a.disc = G.day + 20}, {"t": "Помиловать и накормить", "tip": "Дух +4.", "fx": func(): pr.call().morale += 4}]},
	]

## окно, поднятое в этот день и ещё не показанное (в HTML UI.alert сразу делает UI.modalOpen())
const MODAL_K := ["war", "captured", "svc", "ev", "council", "reign", "enc"]

static func _modalPending() -> bool:
	for e in SimDay.alerts:
		if String(e.get("k", "")) in MODAL_K:
			return true
	return false

## событие похода: король в поле и нет окна — одно из подходящих (каждое не чаще раза в 60 дней)
static func randomEvent() -> void:
	var G := Sim.G
	var pa: Variant = Sim.playerArmy()
	if pa == null or SimPlayer.modal or _modalPending():
		return
	var seen: Variant = G.get("evSeen")
	var L: Array = EVENTS().filter(func(e): return (not JS.t(seen) or float(JS.o(seen.get(e.id), -99.0)) < G.day - 60) and bool((e.cond as Callable).call()))
	if L.is_empty():
		return
	var e: Dictionary = Sim.R.wpick(L, func(x): return x.w)
	if not JS.t(G.get("evSeen")):
		G.evSeen = {}
	G.evSeen[e.id] = G.day
	var text: String = (e.text as Callable).call()
	SimDay.alerts.append({"k": "ev", "e": e, "text": text})
