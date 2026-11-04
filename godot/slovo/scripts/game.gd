extends Node
# Общее состояние (как G в браузерной версии): день, доля суток, скорость, календарь, свет неба, шрифт.
# Часы общие для двора и карты. Королевство (Sim.G — с первого открытия карты) живёт по этим часам: каждый час —
# шаг движения войск (SimArmy.substep: походы и встречи, 24 шага на сутки — как эталон HTML), когда часы ушли в новые
# сутки — оставшиеся шаги и день королевства (SimDay.dailyTick), растянутый на несколько кадров. Пока день не
# досчитан, часы ждут на исходе суток (4:59), поэтому королевство не отстаёт от календаря больше чем на день —
# кроме догонялки после сна, команды day или долгой жизни при дворе до первого открытия карты: тогда шаги и дни
# идут подряд, сколько влезет в долю кадра. Карта рисует войска плавно (view_pos): на час позже счёта, между
# положениями до и после последнего шага.
const VERSION := "0.6.0"
const DAY_SEC := [0.0, 360.0, 180.0, 60.0]   # секунд на игровые сутки при дворе (COURT_SPD в HTML)
const MAP_SPD := [0.0, 1.6, 0.8, 0.3]        # секунд на сутки на карте (SPD в HTML)
const DAYS_SEASON := 21
const DAYS_YEAR := 84
const SEASONS := ["Весна", "Лето", "Осень", "Зима"]
const WDAY := ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
# доля кадра на счёт королевства (шаги и дни): обычно, на карте при скорости 3 или когда часы ждут, в догонялке
# (отстали больше чем на день); при 60 кадрах в секунду это 5, 9 и 13 мс. На медленной машине кадры длиннее — и доля
# та же, чтобы дни шли с той же скоростью, пусть и при меньшем числе кадров (но не больше 0,25 с счёта за кадр, в
# догонялке — 1 с: когда кадр рисуется секунду, как в swiftshader без видеокарты, иначе она шла бы по дню в несколько секунд).
const SHARE := 0.3
const SHARE_MAP3 := 0.55
const SHARE_CATCH := 0.8
const CAP_US := 250000.0
const CAP_CATCH_US := 1000000.0
var seed := 777
var day := 0
var frac := 0.0          # доля суток; 0 — 5:00 утра, как в HTML (hourAbs = 5 + frac·24)
var speed := 1
var last_speed := 1      # к ней возвращает Пробел после паузы (UI.lastSpeed)
var sim_run := true      # дни королевства идут сами (самопроверка без экрана считает их сама)
var map_frame := -10     # кадр, в котором карта последний раз двигала часы
var lag_max := 0         # для проверок: наибольшее отставание королевства от часов, дней
var dt_avg := 1.0 / 60.0 # средняя длина кадра по часам, с (delta в _process — не длиннее 8/60 с: max_physics_steps_per_frame)
var last_us := 0
const STEPS := 24        # шагов движения на сутки (pageStep эталона: 24 за день)
var steps := 0           # шагов, сделанных за текущий день королевства (Sim.G.day)
var step_at := 0.0       # к какому времени (день + доля) относится последний шаг
var pos0 := {}           # войско (id) → Vector2: где оно было до последнего шага
var steps_n := 0         # для проверок: шагов с начала игры и время последнего, мс
var step_ms := 0.0
var b_ms := 0.0          # для проверок: доля кадра на счёт королевства в последнем кадре и сколько ушло, мс
var work_ms := 0.0
var font: Font

func _ready() -> void:
	font = load("res://slovo_serif.woff") if ResourceLoader.exists("res://slovo_serif.woff") else ThemeDB.fallback_font

## скорость (setSpeed): 0 — пауза
func set_speed(i: int) -> void:
	speed = clampi(i, 0, 3)
	if speed > 0:
		last_speed = speed

func toggle_pause() -> void:
	set_speed(0 if speed > 0 else last_speed)

## ход часов: при дворе — сутки за DAY_SEC[speed] секунд, на карте — за MAP_SPD[speed] (кадр не длиннее 0,1 с, как в HTML)
func advance(dt: float, on_map := false) -> void:
	if on_map:
		map_frame = Engine.get_process_frames()
	if speed <= 0:
		return
	frac += minf(dt, 0.1) / MAP_SPD[speed] if on_map else dt / DAY_SEC[speed]
	while frac >= 1.0:
		if sim_behind():
			frac = 0.9999
			return
		frac -= 1.0
		day += 1

## королевство ещё не досчитало текущий день
func sim_behind() -> bool:
	return sim_run and not Sim.G.is_empty() and (SimDay.busy or Sim.G.day < day)

## дни королевства: шаги движения по часам (k-й — в k-й час суток), в новых сутках — оставшиеся шаги и день; что
## не влезло в долю кадра — в следующих кадрах (день — кусками, SimDay.due/pause), доля — каждый кадр заново
func _process(dt: float) -> void:
	var now := Time.get_ticks_usec()
	var fr := dt if last_us == 0 else (now - last_us) / 1e6
	last_us = now
	dt_avg = lerpf(dt_avg, clampf(fr, 0.001, 2.0), 0.25)
	if not sim_run or Sim.G.is_empty():
		return
	var f := Engine.get_process_frames()
	var lag := day - int(Sim.G.day)          # пока день считается, Sim.G.day — уже он
	var sh := SHARE
	var cap := CAP_US
	if lag > (0 if SimDay.busy else 1):
		sh = SHARE_CATCH
		cap = CAP_CATCH_US
	elif (f - map_frame <= 2 and speed >= 3) or frac >= 0.9999:
		sh = SHARE_MAP3
	var b := int(clampf(sh * dt_avg * 1e6, 3000.0, cap))
	b_ms = b / 1000.0
	if SimDay.busy:
		SimDay.budget_us = b                 # следующий кусок дня — в начале следующего кадра (process_frame)
		return
	# день мог досчитаться в этом кадре (последний кусок — до _process): его время — в счёт этого кадра
	var t0 := SimDay.slice_t if SimDay.done_frame == f else Time.get_ticks_usec()
	while true:
		lag = day - int(Sim.G.day)
		var want := STEPS if lag > 0 else mini(STEPS - 1, int(frac * STEPS))
		while steps < want and Time.get_ticks_usec() - t0 < b:
			step()
		var left := b - (Time.get_ticks_usec() - t0)
		work_ms = (b - left) / 1000.0
		if steps < want or lag <= 0 or left <= 0:
			return
		lag_max = maxi(lag_max, lag)
		steps = 0
		SimDay.dailyTick(left)
		if SimDay.alerts.size() > 200:
			SimDay.alerts = SimDay.alerts.slice(-100)
		work_ms = (Time.get_ticks_usec() - t0) / 1000.0
		if SimDay.busy:
			return

## шаг движения: войска идут 1/24 суток, встречи врагов (aiContacts); положения до шага — для плавного рисования
func step() -> void:
	var t0 := Time.get_ticks_usec()
	pos0.clear()
	for a: Dictionary in Sim.G.armies:
		if JS.t(a.alive):
			pos0[a.id] = Vector2(a.x, a.y)
	SimArmy.substep(1.0 / STEPS)
	steps += 1
	steps_n += 1
	step_at = Sim.G.day + float(steps) / STEPS
	step_ms = (Time.get_ticks_usec() - t0) / 1000.0

## где рисовать войско (в клетках): на час позже счёта — между положением до последнего шага и после него
func view_pos(a: Dictionary) -> Vector2:
	var p := Vector2(a.x, a.y)
	var p0: Variant = pos0.get(a.id)
	if p0 == null or not sim_run:
		return p
	var t := clampf((day + frac - step_at) * STEPS, 0.0, 1.0)
	return (p0 as Vector2).lerp(p, t)

func hour_abs() -> float:
	return 5.0 + frac * 24.0

func hour() -> float:
	return fmod(hour_abs(), 24.0)

# поставить часы: 0..24 (часы до 5 утра — ночь того же игрового дня)
func set_hour(h: float) -> void:
	var ha := h if h >= 5.0 else h + 24.0
	frac = clampf((ha - 5.0) / 24.0, 0.0, 0.9999)

func is_night() -> bool:
	var h := hour_abs()
	return h >= 20.5 or h < 6.0

func season() -> int:
	return int(posmod(day, DAYS_YEAR) / DAYS_SEASON)

func date_text() -> String:
	return "%s, %d д. · %s · %d г." % [WDAY[day % 7], day % DAYS_SEASON + 1, SEASONS[season()], day / DAYS_YEAR + 1]

func clock_text() -> String:
	var h := hour_abs()
	return "%02d:%02d" % [int(h) % 24, int(fmod(h, 1.0) * 6.0) * 10]

func day_k() -> float:
	var h := hour_abs()
	if h < 6.0 or h > 20.5:
		return 0.0
	if h < 8.0:
		return (h - 6.0) / 2.0
	if h > 18.5:
		return (20.5 - h) / 2.0
	return 1.0

# долгие летние вечера, короткие зимние дни (seaSolar в HTML)
func sea_solar(h: float) -> float:
	var d := float(posmod(day, DAYS_YEAR)) + frac
	var c := cos(TAU * (d - 31.5) / DAYS_YEAR)
	var sr := 7.0 - 0.9 * c
	var ss := 19.8 + 1.2 * c
	if h < sr:
		return 5.0 + (h - 5.0) * (2.0 / (sr - 5.0))
	if h < 13.4:
		return 7.0 + (h - sr) * (6.4 / (13.4 - sr))
	if h < ss:
		return 13.4 + (h - 13.4) * (6.4 / (ss - 13.4))
	return 19.8 + (h - ss) * (9.2 / (29.0 - ss))

const SKY := [[5.0, [70, 80, 140]], [6.0, [110, 105, 160]], [7.0, [230, 190, 170]], [8.5, [255, 250, 245]], [16.5, [255, 250, 240]], [18.5, [255, 205, 160]], [19.8, [190, 140, 150]], [21.0, [80, 90, 150]], [29.0, [70, 80, 140]]]
# свет под открытым небом: множитель 0..255 по каналам (ambientOut)
func ambient_out(h0: float) -> Vector3:
	var h := sea_solar(h0)
	for i in SKY.size() - 1:
		var a: Array = SKY[i]
		var b: Array = SKY[i + 1]
		if h >= a[0] and h <= b[0]:
			var t: float = (h - a[0]) / (b[0] - a[0])
			var c0: Array = a[1]
			var c1: Array = b[1]
			return Vector3(roundf(c0[0] + (c1[0] - c0[0]) * t), roundf(c0[1] + (c1[1] - c0[1]) * t), roundf(c0[2] + (c1[2] - c0[2]) * t))
	return Vector3(255, 255, 255)

# в помещениях: полумрак днём, свечи ночью (ambientIn)
func ambient_in(h: float) -> Vector3:
	var o := ambient_out(h)
	var d := Vector3(196, 184, 196)
	return Vector3(roundf(minf(d.x, o.x * 0.55 + d.x * 0.35)), roundf(minf(d.y, o.y * 0.55 + d.y * 0.35)), roundf(minf(d.z, o.z * 0.55 + d.z * 0.35)))

# детерминированный шум (как hash2 в браузерной версии)
func hash2(x: int, y: int, s: int) -> float:
	var h := (x * 374761393 + y * 668265263 + s * 2147483647) & 0x7fffffff
	h = ((h ^ (h >> 13)) * 1274126177) & 0x7fffffff
	return float(h % 10000) / 10000.0
