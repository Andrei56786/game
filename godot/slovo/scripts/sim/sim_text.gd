class_name SimText
## Слова и подсказки карты — перенос engine.js (fmt, plural), army.js (kmTxt), ai.js (armyLabel), econui.js (fq, agoTxt,
## строки рынка и каравана), ui.js (settLabelCol, settTip, armyTip, tileTip, goldTip) и deceitui.js (ghostTip, строки уловок). Строка подсказки — {t, c, ic}:
## текст, цвет (#rrggbb или "") и значок ("shield3", "" — без значка), как строки tip в HTML.

const UIC := {"good": "#9fe07a", "bad": "#ee7a6a", "warn": "#f7d35c", "dim": "#9a8a70", "text": "#f4ecd8", "blue": "#a8c8ff"}
const SETT_T := {"village": "Деревня", "castle": "Замок", "town": "Город", "capital": "Столица"}
const WALLS := ["нет", "частокол", "каменные", "мощные"]


static func row(t: String, c: String = "", ic: String = "") -> Dictionary:
	return {"t": t, "c": c, "ic": ic}


## toFixed(d) с запятой, как в подсказках HTML
static func fixed(v: float, d: int) -> String:
	return (("%." + str(d) + "f") % v)


## fmt: целое; от 10 000 — тысячами с «к»
static func fmt(n: float) -> String:
	n = JS.rnd(n)
	if absf(n) >= 10000.0:
		var k := n / 1000.0
		return JS.s(signf(k) * floorf(absf(k) + 0.5)) + "к"
	return JS.s(n)


static func plural(n: float, a: String, b: String, c: String) -> String:
	return Sim.plural(n, a, b, c)


static func kmTxt(km: float) -> String:
	var v := maxf(1.0, JS.rnd(km)) if km < 20 else (JS.rnd(km / 5) * 5 if km < 100 else JS.rnd(km / 10) * 10)
	return JS.s(v) + " км"


static func agoTxt(d: float) -> String:
	if d <= 0:
		return "сегодня"
	if d == 1:
		return "вчера"
	return JS.s(d) + " " + plural(d, "день", "дня", "дней") + " назад"


## fq: количество товара — доли с запятой, большие — как fmt
static func fq(v: Variant) -> String:
	var x := JS.n(v)
	var a := absf(x)
	if a < 0.005:
		return "—"
	if a < 1:
		return fixed(x, 2).replace(".", ",")
	if a < 10:
		return fixed(x, 1).replace(".", ",")
	return fmt(x)


static func voin(n: float) -> String:
	n = JS.rnd(n)
	return JS.s(n) + " " + plural(n, "воин", "воина", "воинов")


static func realmName(r: Variant) -> String:
	return Sim.realmName(r)


## подпись войска (armyLabel)
static func armyLabel(a: Dictionary) -> String:
	var g: Variant = Sim.charOf(a.gen)
	if a.kind == "bandit":
		return "шайка " + (String(g.name) if g != null else "")
	if a.kind == "caravan":
		return "караван"
	if a.kind == "player":
		return "войско короля"
	return (String(g.name) if g != null else "войско") + " (" + realmName(a.realm) + ")"


## цвет подписи поселения: своё — голубое, враждебное — розовое, прочее — светлое
static func settLabelCol(S: Dictionary) -> String:
	var pr: float = Sim.G.player.realm
	if S.ctrl == pr:
		return "#cfe2ff"
	return "#ffb4a8" if Sim.hostile(pr, S.ctrl) else "#fff2c8"


## строка рынка (settMarketLine): самые дорогие и дешёвые товары, если рынок видели не позже 60 дней назад
static func settMarketLine(S: Dictionary) -> Variant:
	var G := Sim.G
	var sn: Variant = S.get("seen")
	if not JS.t(sn) or Sim.W.setts[int(S.id)].type == "village" or G.day - sn.d > 60:
		return null
	var px: Dictionary = sn.px
	var hi := JS.sort(Sim.GOODS.filter(func(k): return JS.n(px.get(k)) > 1.6), func(a, b): return JS.n(px.get(b)) - JS.n(px.get(a))).slice(0, 3)
	var lo := JS.sort(Sim.GOODS.filter(func(k): return JS.n(px.get(k)) < 0.7 and px.has(k)), func(a, b): return JS.n(px.get(a)) - JS.n(px.get(b))).slice(0, 3)
	var ago := " (" + agoTxt(G.day - sn.d) + ")" if G.day - sn.d > 0 else ""
	if hi.is_empty() and lo.is_empty():
		return row("Рынок: цены обычные" + ago + ".", UIC.dim)
	var nm := func(k): return String(Sim.GD[k].n).to_lower()
	var s := "Рынок" + ago + ": "
	if not hi.is_empty():
		s += "дорого — " + ", ".join(hi.map(nm))
	if not hi.is_empty() and not lo.is_empty():
		s += "; "
	if not lo.is_empty():
		s += "дёшево — " + ", ".join(lo.map(nm))
	return row(s + ".", "#e8d8b0")


## подсказка поселения (settTip)
static func settTip(sid: int) -> Array:
	var G := Sim.G
	var W := Sim.W
	var s: Dictionary = W.setts[sid]
	var S: Dictionary = G.setts[sid]
	var pr: float = G.player.realm
	var own: bool = S.ctrl == pr
	var vis: bool = own or G.vis[int(s.i)] == 2 or SimIntel.hasInward(S.ctrl)
	var L := [row(String(s.name) + " — " + String(SETT_T[s.type]), "", "shield" + JS.s(S.ctrl)),
		row(realmName(S.ctrl) + (" (занято; владелец: " + realmName(S.owner) + ")" if S.owner != S.ctrl else ""), settLabelCol(S)),
		row("Провинция " + String(W.provs[int(s.prov)].name) + " · жителей " + fmt(S.pop))]
	var pa: Variant = Sim.playerArmy()
	var o := Vector2(-1, -1)
	if pa != null:
		o = Vector2(pa.x, pa.y)
	else:
		var cap := int(G.realms[int(pr)].capital)
		if cap >= 0 and cap < W.setts.size():
			o = Vector2(W.setts[cap].x + 0.5, W.setts[cap].y + 0.5)
	if o.x >= 0:
		var kpt: float = Sim.T.KM_PER_TILE
		var dk := JS.hypot(o.x - s.x - 0.5, o.y - s.y - 0.5) * kpt
		if dk > 4:
			L.append(row(kmTxt(dk) + " по прямой от " + ("войска" if pa != null else "столицы") + " (≈" + JS.s(maxf(1.0, JS.rnd(dk / kpt / float(Sim.T.BASE_SPEED)))) + " дн. пути)", UIC.dim))
	if JS.t(S.walls):
		L.append(row("Стены: " + String(WALLS[int(S.walls)])))
	L.append(row("Гарнизон: " + JS.s(Sim.menOf(S.gar)) if vis else "Гарнизон: неизвестно (нет обзора)"))
	if JS.t(S.siege):
		var by: Variant = Sim.armyById(S.siege.by)
		L.append(row("В осаде" + (": " + armyLabel(by) if by != null else "") + " · запасы " + JS.s(JS.rnd(S.food)) + " дн.", UIC.bad))
	var dev: float = JS.n(G.provs[int(s.prov)].get("dev"))
	if dev > 0.15:
		L.append(row("Разорение " + JS.s(JS.rnd(dev * 100)) + "%", UIC.warn))
	var ml: Variant = settMarketLine(S)
	if ml != null:
		L.append(ml)
	if pa == null:
		L.append(row("Король в замке. Щелчок — сведения: послать войско или поехать самому.", UIC.dim))
	elif SimPlayer.settHere(pa) == sid:
		L.append(row("Войско здесь. Щелчок — войти.", UIC.good))
	elif Sim.hostile(G.player.realm, S.ctrl):
		L.append(row("Враждебно. Щелчок — идти на приступ (осада по прибытии).", UIC.dim))
	else:
		L.append(row("Щелчок — идти и войти по прибытии · ПКМ — сведения.", UIC.dim))
	return L


## строки каравана (caravanTipLines)
static func caravanTipLines(a: Dictionary, exact: bool) -> Array:
	var L := []
	var cg: Variant = a.get("cargo")
	var k: Variant = (cg as Dictionary).keys()[0] if typeof(cg) == TYPE_DICTIONARY and not cg.is_empty() else null
	if k != null:
		var to := -1.0
		if typeof(a.get("ai")) == TYPE_DICTIONARY:
			to = JS.n(a.ai.get("to")) if a.ai.has("to") else -1.0
		L.append(row("Везёт: " + String(Sim.GD[k].n).to_lower() + " " + fq(cg[k]) + (" → " + String(Sim.W.setts[int(to)].name) if to >= 0 else ""), "", ""))
	else:
		L.append(row("Идёт порожняком — ищет выгодный товар."))
	if exact or a.realm == Sim.G.player.realm:
		L.append(row("Кошель ≈ " + JS.s(JS.rnd(JS.n(a.get("cash")))) + " зол. · рейсов: " + JS.s(JS.n(a.get("trips")))))
	L.append(row("Купцы платят пошлину тому, чей рынок. Разбитый караван — добыча победителя.", UIC.dim))
	return L


## подсказка войска (armyTip); при дворе своего войска на карте нет — без строк о силе и приказах
static func armyTip(a: Dictionary) -> Array:
	var G := Sim.G
	var e := SimIntel.estimateMen(a)
	var exact := JS.t(e.exact)
	var g: Variant = Sim.charOf(a.gen)
	var isP: bool = a.id == G.player.army
	var L := [row(armyLabel(a), "", "shield" + JS.s(a.realm))]
	if g != null and a.kind != "caravan":
		L.append(row(Sim.charName(g) + " · " + ", ".join((g.traits as Array).map(func(t): return String(Sim.TRAITS[t].n)))))
	L.append(row(("Воинов: " if exact else "Воинов: около ") + fmt(e.n) + (" (костров много!)" if JS.t(a.get("fires")) else "")))
	if exact or isP:
		L.append(row(", ".join(Sim.UT.filter(func(t): return JS.n(a.u.get(t)) > 0).map(func(t): return String(Sim.UNIT[t].n) + " " + JS.s(JS.rnd(a.u[t]))))))
	else:
		L.append(row("Подойдите ближе или пошлите лазутчика, чтобы узнать точнее.", UIC.dim))
	if a.kind == "caravan":
		L.append_array(caravanTipLines(a, exact))
	if not isP:
		var pa: Variant = Sim.playerArmy()
		if pa != null and a.kind != "caravan":
			var r: float = SimAI.perceivedPower(a, G.player.realm) / maxf(1.0, SimDay.powerU(pa.u, pa.xp))
			L.append(row("Сила против нас: " + ("намного слабее" if r < 0.5 else ("слабее" if r < 0.85 else ("равны" if r < 1.2 else ("сильнее" if r < 2 else "намного сильнее")))),
				UIC.good if r < 0.85 else (UIC.warn if r < 1.2 else UIC.bad)))
		if Sim.hostile(G.player.realm, a.realm):
			L.append(row("Враг. Щелчок — преследовать.", UIC.dim))
	else:
		var sh := SimPlayer.settHere(a)
		L.append(row("Щелчок — войти в " + String(Sim.W.setts[sh].name) + " · ПКМ или V — окно войска." if sh >= 0 and a.path == null else "Щелчок — подробности о войске.", UIC.dim))
	# обёртка deceitui.js: свои уловки; что Око знает о замыслах чужого полководца
	if a.realm == G.player.realm:
		if JS.n(a.get("feign")) > G.day:
			L.insert(mini(2, L.size()), row("Притворное отступление · ещё " + JS.s(a.feign - G.day) + " дн.", UIC.warn))
		if JS.t(a.get("feint")):
			var fe: Dictionary = a.feint
			L.insert(mini(2, L.size()), row("Ложный марш" + (": враг стянул " + SimBel.nArm(fe.drew) if JS.t(fe.get("drew")) else "") + (" · ещё " + JS.s(maxf(0.0, fe.until - G.day)) + " дн." if JS.t(fe.get("until")) else ""), UIC.warn))
	elif a.realm >= 1 and a.realm < 5 and a.kind == "lord" and SimBel.insight(a.realm):
		var ai: Variant = a.get("ai")
		var W := Sim.W
		if JS.t(a.get("fires")):
			L.insert(mini(3, L.size()), row("Око: костров вдвое больше, чем людей — на деле ≈" + fmt(JS.rnd(Sim.armyMen(a) / 10) * 10), UIC.good))
		if typeof(ai) == TYPE_DICTIONARY and JS.t(ai.get("feint")) and _sett_ok(ai.feint.s):
			L.insert(mini(3, L.size()), row("Око: это ложный марш на " + String(W.setts[int(ai.feint.s)].name), UIC.good))
		if typeof(ai) == TYPE_DICTIONARY and JS.t(ai.get("guard")) and _sett_ok(ai.guard.s):
			L.insert(mini(3, L.size()), row("Стережёт " + String(W.setts[int(ai.guard.s)].name), UIC.blue))
	return L


static func _sett_ok(s: Variant) -> bool:
	return typeof(s) in [TYPE_FLOAT, TYPE_INT] and s >= 0 and s < Sim.W.setts.size()


const BSRC := {"eye": "свои глаза", "spy": "шпион при нашем дворе", "rumor": "слухи с дорог", "net": "сеть Ока", "icp": "перехваченный гонец", "inw": "внутренний лазутчик"}

## подсказка призрака (ghostTip, deceitui.js): последнее донесение о чужом войске
static func ghostTip(k: Dictionary) -> Array:
	var G := Sim.G
	var g: Variant = Sim.charOf(k.gen)
	var n: float = G.day - k.day
	var L := [row("Последнее донесение", "", "shield" + JS.s(k.realm)), row((Sim.charName(g) if g != null else "Войско") + " (" + realmName(k.realm) + ")"),
		row("Воинов: около " + fmt(k.men) + (" (костров много)" if JS.t(k.get("fires")) else "")),
		row(agoTxt(n) + " · " + String(BSRC.get(String(k.src), String(k.src))), UIC.dim)]
	if JS.n(k.get("tgt", -1.0)) >= 0 and _sett_ok(k.tgt):
		L.append(row("Шло на " + String(Sim.W.setts[int(k.tgt)].name), UIC.warn))
	L.append(row("Где оно сейчас — неизвестно." if n > 0 else "Сейчас его не видно.", UIC.dim))
	return L


## подсказка клетки (tileTip); под туманом — только то, что земли не разведаны
static func tileTip(t: int) -> String:
	var W := Sim.W
	var G := Sim.G
	if not G.is_empty() and not JS.t(G.mapOpen) and not G.explored[t]:
		return "Неразведанные земли"
	var T := W.ter[t]
	var s := String(Sim.TINFO[T].n)
	if W.river[t]:
		s += " · мост" if W.bridge[t] else (" · брод" if W.ford[t] else " · река")
	if W.road[t]:
		s += " · тракт" if W.road[t] == 2 else " · дорога"
	var p := W.prov[t]
	if p >= 0:
		s += " · пров. " + String(W.provs[p].name) + " (" + realmName(G.setts[int(W.provs[p].seat)].ctrl) + ")"
	var pa: Variant = null if G.is_empty() else Sim.playerArmy()
	if pa != null and SimDay.passable(T):
		s += " · ход ×" + "%.1f" % SimArmy.stepCost(pa, t)
	return s


## календарь (calendarTip): по часам двора (Game), совет — по G.court.meetDone
const WEEKDAYS := ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]

static func inDays(n: int) -> String:
	return "сегодня" if n <= 0 else ("завтра" if n == 1 else "через " + str(n) + " " + plural(n, "день", "дня", "дней"))

## дата дня (dateStr): «Чт, 4 д. · Весна · 1 г.»
static func dateStr(d: float) -> String:
	var i := int(d)
	return Game.WDAY[posmod(i, 7)] + ", " + str(posmod(i, Game.DAYS_SEASON) + 1) + " д. · " + Game.SEASONS[int(posmod(i, Game.DAYS_YEAR) / Game.DAYS_SEASON)] + " · " + str(i / Game.DAYS_YEAR + 1) + " г."

static func yrs(n: float) -> String:
	return JS.s(n) + " " + plural(n, "год", "года", "лет")

static func nextCouncilDay() -> int:
	var C: Variant = Sim.G.get("court") if not Sim.G.is_empty() else null
	var d := Game.day
	if d % 7 == 3 and Game.hour_abs() < 12.0 and not (C is Dictionary and C.get("meetDone") != null and float(C.meetDone) == float(d)):
		return d
	d += 1
	while d % 7 != 3:
		d += 1
	return d

static func calendarTip() -> Array:
	var nd := nextCouncilDay()
	var doy := posmod(Game.day, Game.DAYS_YEAR)
	var dd := posmod(Game.DAYS_SEASON * 3 - doy + Game.DAYS_YEAR, Game.DAYS_YEAR)
	if dd == 0:
		dd = Game.DAYS_YEAR
	return [row("Календарь: неделя — 7 дней, сезон — 3 недели (21 день), год — 4 сезона (84 дня)."),
		row("Сегодня " + WEEKDAYS[Game.day % 7] + ", " + str(doy + 1) + "-й день года."),
		row("Малый совет — по четвергам в 9:30. Ближайший: " + Game.WDAY[nd % 7] + ", " + str(nd % Game.DAYS_SEASON + 1) + " д. · " + Game.SEASONS[int(posmod(nd, Game.DAYS_YEAR) / Game.DAYS_SEASON)] + " (" + inDays(nd - Game.day) + ").", "#e8d8b0"),
		row("Совет короны (голоса держав) — раз в год, в первый день зимы: " + inDays(dd) + ".", "#e8d8b0")]

## дата и погода на карте (ui.js, tb_date)
static func dateTip() -> Array:
	var Wt := Sim.weatherOf()
	var L: Array = [row(Game.date_text()), row("Погода: " + String(Wt.n) + (" — марш медленнее ×" + JS.s(Wt.mv) if float(Wt.get("mv", 1.0)) > 1 else "") + (", обзор ×" + JS.s(Wt.vis) if float(Wt.get("vis", 1.0)) < 1 else "") + (", стрелы бьют хуже" if JS.t(Wt.get("wet")) else "") + (", сухо — огонь силён" if JS.t(Wt.get("dry")) else ""))]
	var mud := float(Sim.G.get("mud", 0.0)) if Sim.G.get("mud") != null else 0.0
	if mud >= 0.3:
		L.append(row("Распутица: вне дорог войска идут медленнее (до " + str(roundi(55 * mud)) + "%), обозы вязнут.", UIC.warn))
	return L + calendarTip()

## казна (goldTip)
static func goldTip() -> Array:
	var r: Dictionary = Sim.G.realms[int(Sim.G.player.realm)]
	var C: Variant = Sim.G.get("court")
	return [row(("Казна: " + JS.s(JS.rnd(Sim.bookGold())) + " зол. — по книгам казначея") if C != null else ("Казна: " + JS.s(JS.rnd(r.gold)) + " зол.")),
		row("Доход: +" + fixed(JS.n(r.get("inc")), 1) + " в день (налоги провинций)", UIC.good),
		row("Расход: −" + fixed(JS.n(r.get("exp")), 1) + " в день (жалованье войску и гарнизонам)", UIC.bad),
		row("«Если война длится долго — истощаются средства государства» (гл. 2).", "#e8d8b0")]


## верхняя строка: казна, доход за день, воины, зерно — из королевства (Sim.G), а пока его нет — из выгрузки двора (Art.D).
## Время при дворе идёт, а дневная экономика ещё не перенесена: казна прирастает на доход за каждый прошедший день.
static func bar_vals() -> Dictionary:
	if Sim.G.is_empty():
		var D: Dictionary = Art.D
		var net0: float = float(D.get("net", 0.0))
		return {"gold": float(D.get("gold", 0)) + net0 * maxi(0, Game.day - int(D.get("day", 0))), "net": net0, "men": float(D.get("men", 0)), "grain": float(D.get("grain", 0))}
	var G := Sim.G
	var r: Dictionary = G.realms[int(G.player.realm)]
	var net := JS.n(r.get("inc")) - JS.n(r.get("exp"))
	var men := 0.0
	for a: Dictionary in G.armies:
		if JS.t(a.alive) and a.realm == 0.0 and a.kind == "lord":
			men += Sim.armyMen(a)
	var C: Variant = G.get("court")
	var gold: float = Sim.bookGold() if C != null else float(r.gold)
	return {"gold": gold + net * maxf(0.0, Game.day - G.day), "net": net, "men": men, "grain": JS.n(C.get("grain")) if C != null else 0.0}


## боевой дух: к чему он тянется и почему (moraleTarget, ui.js)
static func moraleTarget(a: Dictionary) -> Array:
	var G := Sim.G
	var men := maxf(1.0, Sim.armyMen(a))
	var gen: Variant = Sim.charOf(a.gen)
	var L := []
	var add := func(t: String, v: float) -> void:
		v = JS.rnd(v)
		if v != 0.0:
			L.append({"t": t, "v": v})
	add.call("Основа", 62.0)
	if gen != null:
		add.call("Полководец", Sim.traitSum(gen, "mor"))
	if JS.t(a.get("hunger")):
		add.call("Голод", -(18.0 + JS.n(a.hunger) * 3.0))
	if JS.t(a.get("thirst")):
		add.call("Жажда", -25.0)
	add.call("Усталость", -JS.n(a.get("fat")) / 5.0)
	add.call("Больные", -(JS.n(a.get("sick")) / men) * 60.0)
	if a.realm < 5 and G.realms[int(a.realm)].gold < 0:
		add.call("Нет жалованья", -25.0)
	if JS.t(a.get("vict")):
		add.call("Недавняя победа" if a.vict > 0 else "Недавнее поражение", a.vict)
	var gr: Variant = a.get("ground")
	if gr == "serious":
		add.call("Тяжёлая земля: сплочённость", 5.0)
	if gr == "dispersive":
		add.call("Рассеивающая земля: тоска по дому", -3.0)
	var sid := SimDay.settNear(a.x, a.y, 1.2)
	var home: bool = sid >= 0 and G.setts[sid].ctrl == a.realm
	if home:
		add.call("В своём поселении", 6.0)
	if a.mode == "fort" and JS.n(a.get("fortDays")) >= 2:
		add.call("Укреплённый лагерь", 4.0)
	if a.mode == "drill":
		add.call("Учения", 2.0)
	if Sim.seasonOf(G.day) == 3 and not home:
		add.call("Зима в поле", -6.0)
	return L


static func moraleTip(a: Dictionary) -> Array:
	var L := moraleTarget(a)
	var s := 0.0
	for l in L:
		s += l.v
	var out := [row("Боевой дух: " + JS.s(JS.rnd(a.morale)) + " → " + JS.s(JS.clp(s, 5, 100)))]
	for l in L:
		out.append(row(("+" if l.v > 0 else "−") + JS.s(absf(l.v)) + " " + String(l.t), UIC.good if l.v > 0 else UIC.bad))
	out.append(row("Ниже 35 — дезертирство.", UIC.dim))
	return out
