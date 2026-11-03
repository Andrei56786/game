extends Node
# Общее состояние (как G в браузерной версии): день, доля суток, скорость, календарь, свет неба, шрифт.
const VERSION := "0.2.0"
const DAY_SEC := [0.0, 360.0, 180.0, 60.0]   # секунд на игровые сутки при дворе (COURT_SPD в HTML)
const DAYS_SEASON := 21
const DAYS_YEAR := 84
const SEASONS := ["Весна", "Лето", "Осень", "Зима"]
const WDAY := ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
var seed := 777
var day := 0
var frac := 0.0          # доля суток; 0 — 5:00 утра, как в HTML (hourAbs = 5 + frac·24)
var speed := 1
var font: Font

func _ready() -> void:
	font = load("res://slovo_serif.woff") if ResourceLoader.exists("res://slovo_serif.woff") else ThemeDB.fallback_font

func advance(dt: float) -> void:
	if speed <= 0:
		return
	frac += dt / DAY_SEC[speed]
	while frac >= 1.0:
		frac -= 1.0
		day += 1

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
