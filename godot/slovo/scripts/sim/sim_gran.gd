class_name SimGran
## Королевские амбары — перенос granary.js: двор ест каждый день, деревни везут оброк зерном дважды в год (жатва в конце лета
## и обмолот осенью), перед зимой сенешаль докладывает, хватит ли хлеба; примерно раз в девять лет урожай скудный — голодный год.
## Вместимость, запас и осада столицы — в SimCourt (granCap, granRes, granFree, granFamine) и SimArmy (granS, granSiegeFeed).

const GRAN_CARTS := 10.0
const GRAN_REAP := Sim.DAYS_SEASON + 16          # конец лета
const GRAN_THRESH := Sim.DAYS_SEASON * 2 + 4     # осень
const GRAN_WARN := Sim.DAYS_SEASON * 3 - 4       # перед зимой
const GRAN_POOR := 0.78

## сколько мер в день ест двор (стража, слуги, конюшни): зимой больше, с мельницами меньше
static func granEat(s: int = -1) -> float:
	if s < 0:
		s = Sim.seasonOf(Sim.G.day)
	return JS.rnd(24 * (1.3 if s == 3 else 1.0) * (0.85 if SimDyn.hasTech("mills") else 1.0))

## урожай года: в среднем ≈1, «скудный» примерно раз в девять лет (свой у каждого мира и года)
static func granQ(y: float) -> float:
	var t := (Sim.hf(7001, y) + Sim.hf(7002, y)) / 2
	return JS.rnd((0.6 + 0.75 * t) * 100) / 100

static func granWord(q: float) -> String:
	return "скудный" if q < GRAN_POOR else ("небогатый" if q < 0.92 else ("добрый" if q < 1.12 else "обильный"))

static func podv(n: float) -> String:
	return JS.s(n) + " " + Sim.plural(n, "подвода", "подводы", "подвод")

static func mer(n: float) -> String:
	n = JS.rnd(n)
	return JS.s(n) + " " + Sim.plural(n, "мера", "меры", "мер")

static func merA(n: float) -> String:
	n = JS.rnd(n)
	return JS.s(n) + " " + Sim.plural(n, "меру", "меры", "мер")

## деревни, что везут оброк короне: свои, не в осаде; вассальные — вполовину, непокорный дом не даёт ничего
static func granVillages() -> Array:
	var G := Sim.G
	var L: Array = []
	for S in G.setts:
		var ws: Dictionary = Sim.W.setts[int(S.id)]
		if ws.type != "village" or S.owner != 0.0 or S.ctrl != 0.0 or JS.t(S.get("siege")):
			continue
		var seat: Variant = G.setts[int(Sim.W.provs[int(ws.prov)].seat)]
		var H0: Variant = null
		if seat != null and seat.get("house") != null and seat.house >= 0 and G.has("houses"):
			H0 = G.houses[int(seat.house)]
		if H0 != null and H0.defiant > G.day:
			continue
		L.append({"S": S, "k": 0.5 if H0 != null else 1.0})
	return L

static func granDues(part: float, q: Variant = null) -> float:
	var G := Sim.G
	var h := 0.0
	for v in granVillages():
		var P: Dictionary = G.provs[int(Sim.W.setts[int(v.S.id)].prov)]
		h += 75 * v.k * (v.S.prosp / 60) * (1 - JS.n(P.get("dev")))
	return JS.rnd(h * part * (SimArmy.granS().q if q == null else float(q)) * (1.25 if SimDyn.hasTech("rotation") else 1.0) * (1.1 if SimDyn.hasTech("mills") else 1.0) * (1.1 if SimDyn.projDone("granary") else 1.0))

static func granProvs() -> Array:
	var G := Sim.G
	return G.provs.filter(func(P):
		var S: Variant = G.setts[int(Sim.W.provs[int(P.id)].seat)]
		return S != null and S.owner == 0.0 and S.ctrl == 0.0)

static func granSay(t: String, tone := "info") -> void:
	if SimDyn.seatChar("seneschal") != null:
		SimCourt.addReport("seneschal", t)
	else:
		Sim.glog(t, tone)

# ---------- день амбаров ----------
static func granDaily() -> void:
	var G := Sim.G
	if not G.has("court"):
		return
	var C: Dictionary = G.court
	var o := SimArmy.granS()
	var d := Sim.dayOfYear(G.day)
	var y := Sim.yearOf(G.day)
	if o.qy != y:
		o.qy = y
		o.q = granQ(y)
		o.seen = 0.0
		o.reap = 0.0
		o.thr = 0.0
	var e := granEat()
	if JS.n(C.get("grain")) >= e:
		C.grain -= e
	else:
		var n := e - JS.n(C.get("grain"))
		C.grain = 0.0
		granBuyBread(n)
	if fmod(d, Sim.DAYS_SEASON) == 1 and Sim.seasonOf(G.day) != 3:
		o.carts = minf(GRAN_CARTS, JS.n(o.get("carts")) + 3)    # новые подводы от деревень весной, летом и осенью
	if d == GRAN_REAP:
		granBring(0.4, "reap")
	if d == GRAN_THRESH:
		granBring(0.6, "thr")
	if d == GRAN_WARN:
		granWinterWord()
	if SimCourt.granFamine() and o.relY != o.famY:
		for P in granProvs():
			P.unrest = minf(100.0, P.unrest + 0.12)

## амбары пусты: двор покупает хлеб на рынке столицы
static func granBuyBread(n: float) -> void:
	var G := Sim.G
	var S: Dictionary = G.setts[int(G.realms[0].capital)]
	var r: Dictionary = G.realms[0]
	var o := SimArmy.granS()
	var c := n * SimEcon.priceOf(S, "food")
	if r.gold >= c + 5 and JS.n(S.mk.get("food")) >= n:
		r.gold -= c
		SimEcon.mkTake(S, "food", n)
	else:
		SimCourt.prestige(-0.05)
	if G.day - o.buyD >= 7:
		o.buyD = G.day
		Sim.glog("Королевские амбары пусты: двор живёт на покупном хлебе (≈" + JS.s(maxf(1.0, JS.rnd(c))) + " зол. в день).", "bad")

static func granBring(part: float, k: String) -> void:
	var G := Sim.G
	var C: Dictionary = G.court
	var o := SimArmy.granS()
	var n := granDues(part)
	var cap := SimCourt.granCap()
	C.grain = JS.n(C.get("grain")) + n
	o[k] = n
	o.seen = 1.0
	var over := 0.0
	var got := 0.0
	if C.grain > cap:
		over = JS.rnd(C.grain - cap)
		C.grain = cap
		var S: Dictionary = G.setts[int(G.realms[0].capital)]
		got = JS.rnd(over * SimEcon.priceOf(S, "food") * 0.5)
		G.realms[0].gold += got
		S.mk.food = JS.n(S.mk.get("food")) + over
	var t := ("Жатва: урожай нынче " + granWord(o.q) + ". Первые возы с рожью — " + mer(n) + ".") if k == "reap" \
		else ("Обмолот окончен, деревни свезли оброк — " + mer(n) + ". В амбарах " + JS.s(JS.rnd(C.grain)) + " из " + JS.s(cap) + ".")
	if over != 0.0:
		t += " Амбары полны: излишек (" + mer(over) + ") сенешаль продал купцам за " + JS.s(got) + " зол."
	var poor: bool = k == "thr" and o.q < GRAN_POOR
	if poor:
		o.famY = Sim.yearOf(G.day)
		for S in G.setts:
			if S.ctrl == 0.0 and Sim.W.setts[int(S.id)].type != "village":
				S.mk.food = JS.n(S.mk.get("food")) * 0.6
		t += " Год голодный: хлеб на рынках подорожает, а зимой старосты придут просить зерна."
	granSay(t, "bad" if poor else "good")

static func granWinterWord() -> void:
	var C: Dictionary = Sim.G.court
	var need := granNeed()
	var res := SimCourt.granRes()
	var g := JS.rnd(JS.n(C.get("grain")))
	granSay("Зима близко. В амбарах " + mer(g) + "; до новой жатвы двору нужно ≈" + merA(need) + ", неприкосновенный запас — " + JS.s(res) + ". " \
		+ ("Хлеба до лета не хватит — велите закупить зерно." if g < need else "В поход можно взять " + merA(maxf(0.0, g - maxf(res, need))) + ", не трогая хлеба двора."), "bad" if g < need else "info")

## сколько двор съест до новой жатвы
static func granNeed() -> float:
	var d := int(Sim.dayOfYear(Sim.G.day))
	var n := 0.0
	var dd := d
	var i := 0
	while i < int(Sim.DAYS_YEAR) and dd != int(GRAN_REAP):
		n += granEat(int(floorf(dd / Sim.DAYS_SEASON)))
		i += 1
		dd = (dd + 1) % int(Sim.DAYS_YEAR)
	return n

static func granNext() -> String:
	var d := Sim.dayOfYear(Sim.G.day)
	if d < GRAN_REAP:
		return "жатва в конце лета"
	if d < GRAN_THRESH:
		return "обмолот осенью (≈" + SimArmy.fmt(granDues(0.6)) + ")"
	return "только в конце лета — зимой и весной ничего не растёт"

## голодный год: король открыл амбары (прошение старост)
static func granRelief(n: float) -> void:
	var C: Dictionary = Sim.G.court
	var o := SimArmy.granS()
	C.grain = maxf(0.0, JS.n(C.get("grain")) - n)
	o.relY = o.famY
	for P in granProvs():
		P.unrest = maxf(0.0, P.unrest - 12)

# ---------- слова ----------
static func granTip() -> Array:
	var G := Sim.G
	var C: Dictionary = G.court
	var o := SimArmy.granS()
	var g := JS.rnd(JS.n(C.get("grain")))
	var s := Sim.seasonOf(G.day)
	var L: Array = ["Королевские амбары: " + JS.s(g) + " из " + JS.s(SimCourt.granCap()) + " мер зерна" + (" (со слов сенешаля)" if SimDyn.seatChar("seneschal") != null else ""),
		"Неприкосновенный запас — " + JS.s(SimCourt.granRes()) + ": на осаду, голодный год и дорогу до новой жатвы. В поход его не берут.",
		"Двор ест " + merA(granEat()) + " в день" + (" — зима" if s == 3 else ", зимой " + JS.s(granEat(3))) + ". Подвоз: " + granNext() + ".",
		"Обозный двор: " + podv(JS.n(o.get("carts"))) + " от деревень." + (" Урожай нынче " + granWord(o.q) + "." if JS.t(o.get("seen")) else "")]
	if SimCourt.granFamine():
		L.append({"t": "Голодный год: деревни ждут хлеба.", "c": "warn"})
	L.append({"t": "Щелчок — снабжение и запас (O)", "c": "dim"})
	return L

static func granTalk() -> Array:
	var C: Dictionary = Sim.G.court
	var o := SimArmy.granS()
	if not (JS.n(C.seats.get("seneschal", -1)) >= 0):
		return ["Амбар пахнет пылью и хлебом. Сенешаля нет — никто толком не знает, сколько здесь зерна."]
	var c: Variant = SimDyn.seatChar("seneschal")
	var g: float = SimCourt.noisy(JS.n(C.get("grain")), c, "stew") if c != null else JS.rnd(JS.n(C.get("grain")))
	return ["Амбар пахнет пылью и хлебом. Сенешаль ведёт счёт мерам: в закромах около " + JS.s(g) + " мер из " + JS.s(SimCourt.granCap()) + ", неприкосновенный запас — " + JS.s(SimCourt.granRes()) + ".",
		"Деревни везут оброк дважды в год: в конце лета, после жатвы, и осенью, после обмолота. Зимой и весной ничего не растёт — двор живёт тем, что засыпали. " + ("Нынче год голодный: старосты ждут хлеба." if SimCourt.granFamine() else "Следующий подвоз — " + granNext() + "."),
		"На обозном дворе " + podv(JS.n(o.get("carts"))) + " — деревни дают их для королевского обоза. Снабженец берёт их первыми."]
