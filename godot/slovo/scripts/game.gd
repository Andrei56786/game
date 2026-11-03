extends Node
# Общее состояние (как G в браузерной версии). Пока — часы двора, зерно и шрифт.
const VERSION := "0.1.0"
const MIN_PER_SEC := 4.0        # 1 секунда = 4 игровые минуты: сутки ≈ 6 минут (скорость 1)
const SPEEDS := [0.0, 1.0, 3.0, 8.0]
var seed := 777
var day := 1
var minutes := 7.0 * 60.0       # время суток в минутах
var speed := 1
var font: Font
const MONTHS := ["весна", "лето", "осень", "зима"]

func _ready() -> void:
	font = load("res://slovo_serif.woff") if ResourceLoader.exists("res://slovo_serif.woff") else ThemeDB.fallback_font

func advance(dt: float) -> void:
	minutes += dt * MIN_PER_SEC * SPEEDS[speed]
	while minutes >= 1440.0:
		minutes -= 1440.0
		day += 1

func hour() -> float:
	return minutes / 60.0

# 0 — ясный день, 1 — глубокая ночь (плавно на рассвете и в сумерках)
func night() -> float:
	var h := hour()
	if h < 5.0 or h >= 21.5:
		return 1.0
	if h < 7.0:
		return 1.0 - (h - 5.0) / 2.0
	if h >= 19.0:
		return (h - 19.0) / 2.5
	return 0.0

func clock_text() -> String:
	var m := int(minutes)
	return "День %d · %s · %02d:%02d" % [day, MONTHS[int((day - 1) / 30) % 4], m / 60, m % 60]

# детерминированный шум (как hash2 в браузерной версии)
func hash2(x: int, y: int, s: int) -> float:
	var h := (x * 374761393 + y * 668265263 + s * 2147483647) & 0x7fffffff
	h = ((h ^ (h >> 13)) * 1274126177) & 0x7fffffff
	return float(h % 10000) / 10000.0
