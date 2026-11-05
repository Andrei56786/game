extends Node
## Звук (src/audio.js, audio2.js, music3.js, sndui.js) на записях HTML-версии: синтез WebAudio не переносится, поэтому
## tools/snd_export.mjs записывает его без окна в snd/ — пьесы (по одной записи сочинения каждой, OGG), звуки, голоса мест,
## шумы-петли и шаги (WAV → QOA). Музыка — по месту, часу и событию, как resolve в sndui.js и music3.js: семья пьес (FAM),
## пьесы семьи идут одна за другой (nextPiece), новая семья — плавная смена (1,6 с); у комнат свои пьесы (LEAD). Звуки игры —
## из очереди Sim.sfxq (симуляция не знает об экране), боя (B.snd) и окон (щелчок, бумага, дверь); шум сечи (battleNoise).
## Голоса мест вокруг короля (K.hooks.amb): птицы по месту, часу, времени года и погоде, звери двора, колокол в 6, 12 и 18,
## огонь, кузня, капель и цепи темницы, люди рядом; шумы ветра, дождя, листвы, огня, комнаты, гром (ambTick); шаги короля по
## земле места (surfAt). M — звук вкл/выкл (Snd.toggle); громкости — user://sound.cfg (как sk2_audio в HTML).

const ROOT := "res://snd/"
const LEAD := {"study": "study", "throne": "throne", "council": "council", "garden": "maying", "sick": "vigil", "feast_w": "carol"}
const ROOMF := {"Библиотека": "study", "Звездочётная": "study", "Тронный зал": "throne", "Зал совета": "council"}
## громкости шин HTML по умолчанию — с ними сделаны записи; в игре шина = выбранная громкость / эта
const PV0 := {"mv": 0.55, "sv": 0.8, "av": 0.7, "fv": 0.45}
const GAINK := {"crickets": 7.0, "frogs": 5.0, "lark": 6.0, "wren": 5.0, "coo": 4.0, "snort": 3.5, "bell": 0.6, "anvil": 1.5, "axe": 2.0, "cart": 5.0, "drip": 4.0, "chain": 4.0,
	"laugh": 3.0, "talk": 3.0, "crier": 2.5, "bees": 6.0, "crackle": 1.5}
const BEASTK := {"horse": [["snort", 3], ["horse", 1]], "hen": [["hen", 1]], "pigeon": [["coo", 1]], "dog": [["dog", 1]], "hound": [["dog", 1]], "sheep": [["sheep", 1]],
	"cow": [["cow", 1]], "goat": [["goat", 1]], "pig": [["pig", 1]], "duck": [["duck", 1]], "cat": [["cat", 1]]}
const BEASTG := {"horse": [9, 24], "hen": [7, 18], "pigeon": [9, 22], "dog": [16, 45], "hound": [10, 30], "sheep": [10, 26], "cow": [18, 45], "goat": [16, 38], "pig": [12, 30],
	"duck": [10, 26], "cat": [50, 120]}
const STEPV := {"stone": 0.05, "wood": 0.055, "grass": 0.06, "leaves": 0.055, "dirt": 0.08, "snow": 0.09, "mud": 0.085, "water": 0.045, "straw": 0.05}
const BEDS := ["wind", "leaves", "water", "crowd", "fire", "room", "surf"]

var ok := false
var idx := {}
var FAM := {}
var P := {"on": 1, "mus": 1, "sfx": 1, "gv": 1.0, "mv": 0.55, "sv": 0.8, "av": 0.7, "fv": 0.45}
var want := "title"            # Snd.music(m): title, auto, battle…
var screen := "title"          # title, court, map, battle
var court: Node = null         # двор (место, король, люди, звери) — для музыки, голосов мест и шагов
var siege := false             # бой на экране — штурм (музыка «Осада»)
var cur := {}                  # пьеса: {mood, fam, pl, at — когда начать}
var fading: Array = []         # [{pl, v0, t0}] — затихают 1,6 с
var pool: Array = []
var pool_i := 0
var cache := {}
var last_play := {}
var beds := {}                 # шум → {pl, v, ph}
var NX := {}                   # due(): когда следующий голос
var S := {}                    # что вокруг короля (scan, дважды в секунду)
var sc_t := -9.0
var last_h := -1
var next_thunder := 0.0
var bn_t := 0.0
var bn_acc := 0.0
var roar_v := 0.0
var tick_t := 0.0
var step_k := -1
var step_loc := ""
var step_t := 0.0
var stk := {}                  # шаг людей рядом: ключ → номер шага
var sg_k := -1
var sg_v := false
var n_sfx := 0                 # для проверок: сколько звуков, голосов и шагов сыграно, последние
var n_amb := 0
var n_steps := 0
var n_pieces := 0
var log_sfx: Array = []
var log_amb: Array = []

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	# проверки-сценарии (--script tools/*.gd): звук молчит, иначе играющие пьесы не успевают освободиться к выходу
	if Engine.get_main_loop().get_script() != null:
		return
	var cf := ConfigFile.new()
	if cf.load("user://sound.cfg") == OK:
		for k in P:
			P[k] = cf.get_value("snd", k, P[k])
	var f := FileAccess.open(ROOT + "index.json", FileAccess.READ)
	if f != null:
		var o: Variant = JSON.parse_string(f.get_as_text())
		if o is Dictionary and (o as Dictionary).has("music"):
			idx = o
			FAM = idx.get("fam", {})
			ok = true
	_buses()
	for i in 16:
		var p := AudioStreamPlayer.new()
		add_child(p)
		pool.append(p)
	_apply()

func _bus(nm: String, to := "Master") -> int:
	var i := AudioServer.get_bus_index(nm)
	if i < 0:
		AudioServer.add_bus()
		i = AudioServer.bus_count - 1
		AudioServer.set_bus_name(i, nm)
	AudioServer.set_bus_send(i, to)
	return i

func _buses() -> void:
	var m := AudioServer.get_bus_index("Master")
	if AudioServer.get_bus_effect_count(m) == 0:
		var lim := AudioEffectHardLimiter.new()
		lim.ceiling_db = -0.5
		AudioServer.add_bus_effect(m, lim)
	for nm in ["Music", "Sfx", "Amb"]:
		_bus(nm)
	_bus("Step", "Sfx")
	# слева и справа (панорама ∓0,6): голоса мест, звон сечи, шаги людей рядом
	for b in ["Amb", "Sfx", "Step"]:
		for e in [["L", -0.6], ["R", 0.6]]:
			var i := _bus(b + e[0], b)
			if AudioServer.get_bus_effect_count(i) == 0:
				var pn := AudioEffectPanner.new()
				pn.pan = e[1]
				AudioServer.add_bus_effect(i, pn)
	var fi := _bus("AmbFar", "Amb")
	if AudioServer.get_bus_effect_count(fi) == 0:
		var lp := AudioEffectLowPassFilter.new()
		lp.cutoff_hz = 3500.0
		AudioServer.add_bus_effect(fi, lp)

## громкости шин по настройкам (setBus): общая — Master, музыка, звуки, голоса мест, шаги
func _apply() -> void:
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), not P.on)
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index("Master"), linear_to_db(maxf(0.0001, float(P.gv))))
	_vol("Music", float(P.mv) / PV0.mv if P.mus else 0.0)
	_vol("Sfx", float(P.sv) / PV0.sv if P.sfx else 0.0)
	_vol("Amb", float(P.av) / PV0.av)
	_vol("Step", float(P.fv) / PV0.fv)

func _vol(bus: String, v: float) -> void:
	var i := AudioServer.get_bus_index(bus)
	AudioServer.set_bus_mute(i, v <= 0.0001)
	AudioServer.set_bus_volume_db(i, linear_to_db(maxf(0.0001, v)))

func save() -> void:
	var cf := ConfigFile.new()
	for k in P:
		cf.set_value("snd", k, P[k])
	cf.save("user://sound.cfg")

func muted() -> bool:
	return not P.on

func toggle() -> void:
	P.on = 0 if P.on else 1
	save()
	_apply()

func set_vol(k: String, v: float) -> void:
	P[k] = clampf(v, 0.0, 1.0)
	if k == "mv":
		P.mus = 1 if v > 0 else 0
	if k == "sv":
		P.sfx = 1 if v > 0 else 0
	save()
	_apply()

func _input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo and (e as InputEventKey).keycode == KEY_M:
		toggle()

func _st(rel: String) -> AudioStream:
	if cache.has(rel):
		return cache[rel]
	var s: AudioStream = null
	if ResourceLoader.exists(ROOT + rel):
		s = load(ROOT + rel)
	cache[rel] = s
	return s

func _play(s: AudioStream, bus: String, lin: float, pitch := 1.0) -> void:
	if s == null:
		return
	var p: AudioStreamPlayer = null
	for i in pool.size():
		var q: AudioStreamPlayer = pool[(pool_i + i) % pool.size()]
		if not q.playing:
			p = q
			pool_i = (pool_i + i + 1) % pool.size()
			break
	if p == null:
		p = pool[pool_i]
		pool_i = (pool_i + 1) % pool.size()
	p.stop()
	p.stream = s
	p.bus = bus
	p.volume_db = linear_to_db(maxf(0.0001, lin))
	p.pitch_scale = pitch
	p.play()

# ---------- звуки (Snd.sfx) ----------
func sfx(nm: String) -> void:
	if not ok or not P.on or not P.sfx or not idx.sfx.has(nm):
		return
	var t := now()
	if t - float(last_play.get(nm, -9.0)) < 0.06:
		return
	last_play[nm] = t
	_play(_st("sfx/" + nm + ".wav"), "Sfx", 1.0)
	n_sfx += 1
	log_sfx.append(nm)
	if log_sfx.size() > 12:
		log_sfx.pop_front()

## шум сечи (Snd.battleNoise): n — полков в схватке; звон, удары, крики чаще с числом полков, гул поверх
func battle_noise(n: int) -> void:
	if not ok or not P.on or not P.sfx:
		return
	var t := now()
	var dt := minf(0.1, maxf(0.0, t - (bn_t if bn_t > 0.0 else t)))
	bn_t = t
	bn_acc += dt * minf(9.0, 1.2 + n * 0.9)
	var k := 0
	while bn_acc >= 1.0 and k < 4:
		bn_acc -= 1.0
		k += 1
		var r := randf()
		var c := 0 if r < 0.5 else (1 if r < 0.8 else 2)
		_play(_st("sfx/clash%d%d.wav" % [c, randi() % 4]), ["Sfx", "SfxL", "SfxR"][randi() % 3] if c == 0 else "Sfx", 1.0, randf_range(0.94, 1.06))
	roar_v = minf(0.1, 0.018 + n * 0.011)

static func now() -> float:
	return Time.get_ticks_msec() / 1000.0

# ---------- музыка ----------
func music(m: String) -> void:
	want = m
	if ok:
		_music_tick()

func mood() -> String:
	return String(cur.get("mood", ""))

func family() -> String:
	return String(cur.get("fam", ""))

func fam_list(f: String) -> Array:
	return FAM.get(f, [f])

func _music_tick() -> void:
	var fam: String = resolve() if P.on and P.mus else ""
	var lead: String = LEAD.get(fam, "")
	if lead != "" and not idx.music.has(lead):
		lead = ""
	if fam == "":
		if not cur.is_empty():
			_fade(cur)
			cur = {}
	elif cur.is_empty() or (cur.fam != fam and (not fam_list(fam).has(cur.mood) or (lead != "" and lead != cur.mood))):
		var had := not cur.is_empty()
		if had:
			_fade(cur)
		var L0: Array = fam_list(fam).filter(func(k): return idx.music.has(k))
		var m: String = lead if lead != "" else (String(L0[randi() % L0.size()]) if not L0.is_empty() else "peace")
		_start(m, fam, now() + (0.6 if had else 0.05))
	else:
		cur.fam = fam

func _start(m: String, fam: String, at: float) -> void:
	var e: Dictionary = idx.music.get(m, {})
	if e.is_empty():
		cur = {}
		return
	var p := AudioStreamPlayer.new()
	p.bus = "Music"
	p.stream = _st(String(e.f))
	add_child(p)
	cur = {"mood": m, "fam": fam, "pl": p, "at": at, "t0": at}
	p.finished.connect(func(): _next(p))

## пьеса кончилась — следующая из семьи (nextPiece: другая, чем эта)
func _next(p: AudioStreamPlayer) -> void:
	if cur.is_empty() or cur.pl != p:
		return
	var L0: Array = fam_list(String(cur.fam) if cur.fam != "" else String(cur.mood))
	var nm: String = cur.mood
	if L0.size() > 1:
		var i := L0.find(cur.mood)
		nm = String(L0[0]) if i < 0 else String(L0[(i + 1 + randi() % (L0.size() - 1)) % L0.size()])
	if not idx.music.has(nm):
		nm = cur.mood
	p.queue_free()
	_start(nm, String(cur.fam), now())

func _fade(c: Dictionary) -> void:
	var p: AudioStreamPlayer = c.pl
	if not p.playing:
		p.queue_free()
		return
	fading.append({"pl": p, "v0": db_to_linear(p.volume_db), "t0": now()})

func _night(h: float) -> bool:
	return h >= 21.5 or h < 4.5

func _season() -> int:
	return int(posmod(Game.day, Game.DAYS_YEAR) / Game.DAYS_SEASON)

## вид места: снаружи — вид двора по дню (seaVarOf), в доме — по времени года
func _sv() -> String:
	if screen == "court" and court != null and court.L.get("out", 0):
		return court.sea_key
	return ["sp", "", "au2", "w"][_season()]

static func _wintry(sv: String) -> bool:
	return sv == "w" or sv == "wm"

static func _autumnal(sv: String) -> bool:
	return sv.begins_with("au")

func _war() -> bool:
	return not Sim.G.is_empty() and not SimDay.warsOf(float(Sim.G.player.realm)).is_empty()

## семья пьес для места и часа (K.hooks.resolve: sndui.js, поверх — music3.js; иначе — сама просьба)
func resolve() -> String:
	if want == "sick":
		return "sick"
	var r := _resolve0()
	if want == "feast":
		return "feast_w" if r == "feast" and _season() == 3 else r
	if want != "auto" or r == "":
		return r if r != "" else want
	var s := _season()
	if screen == "court" and court != null:
		if r == "court":
			return "sick" if _sick_grave() else String(ROOMF.get(court.room, r))
		if r == "outdoor":
			return "garden" if court.room == "Сад" and s < 2 else ("outdoor_sp" if s == 0 else r)
	return r

func _resolve0() -> String:
	if want == "battle":
		return "siege" if siege else "battle"
	if want == "feast":
		return "feast"
	if want != "auto":
		return ""
	var h := Game.hour_abs()
	var night := _night(h)
	var war := _war()
	if screen == "court" and court != null and court.loc_id != "":
		var id: String = court.loc_id
		var sv := _sv()
		if court.get("trn") != null and court.trn.on:
			return "tourney"
		if id == "dungeon":
			return "dungeon"
		if "chap" in id:
			return "chapel"
		if night:
			return "night"
		if not court.L.get("out", 0):
			return "war" if war else "court"
		if war and id == "yard":
			return "war"
		return "outdoor_w" if _wintry(sv) else ("outdoor_au" if _autumnal(sv) else "outdoor")
	if screen == "map":
		var pa: Variant = null if Sim.G.is_empty() else Sim.playerArmy()
		if pa != null:
			return "camp" if night else ("campaign" if war else "travel")
		if war:
			return "war"
		if night:
			return "night"
		return "map_w" if _season() == 3 else "map"
	return ""

## кто-то из королевского дома тяжело болен (sickGrave: дважды в час)
func _sick_grave() -> bool:
	if Sim.G.is_empty() or not Sim.G.has("court"):
		return false
	var k := int(Game.day) * 48 + int(Game.hour_abs() * 2.0)
	if k == sg_k:
		return sg_v
	sg_k = k
	sg_v = false
	var L: Array = [SimPlayer.kingC()]
	L.append_array(SimDyn.royalFamily())
	for c in L:
		if c is Dictionary and JS.t(c.get("alive")) and c.get("ill") is Dictionary and JS.t(c.ill.get("bed")) and SimSick.DIS.has(c.ill.k) \
				and float(SimSick.DIS[c.ill.k].m[SimSick.ageCls(c)]) > 0.0:
			sg_v = true
			break
	return sg_v

# ---------- каждый кадр: очереди, шаги; 11 раз в секунду — музыка, погода и голоса мест ----------
func _process(dt: float) -> void:
	for k in Sim.sfxq:
		sfx(String(k))
	Sim.sfxq.clear()
	if not ok:
		return
	var t := now()
	if not cur.is_empty() and cur.has("at") and t >= float(cur.at):
		cur.erase("at")
		cur.pl.play()
		n_pieces += 1
	for i in range(fading.size() - 1, -1, -1):
		var e: Dictionary = fading[i]
		var k := 1.0 - (t - float(e.t0)) / 1.6
		if k <= 0.0 or not is_instance_valid(e.pl):
			if is_instance_valid(e.pl):
				e.pl.queue_free()
			fading.remove_at(i)
		else:
			e.pl.volume_db = linear_to_db(maxf(0.0001, float(e.v0) * k))
	_steps(dt)
	tick_t -= dt
	if tick_t > 0.0:
		return
	tick_t = 0.09
	_music_tick()
	_amb_tick(t)

# ---------- шумы, погода, голоса мест ----------
func _bed(k: String, v: float, t: float, tau := 0.8) -> void:
	var b: Dictionary = beds.get(k, {})
	if b.is_empty():
		if v <= 0.0005:
			return
		var s: AudioStream = _st("bed/" + k + ".wav")
		if s == null:
			return
		if s is AudioStreamWAV:
			var w := s as AudioStreamWAV
			w.loop_mode = AudioStreamWAV.LOOP_FORWARD
			w.loop_begin = 0
			w.loop_end = int(round(w.get_length() * w.mix_rate))
		var p := AudioStreamPlayer.new()
		p.stream = s
		p.bus = "Sfx" if k == "roar" else "Amb"
		p.volume_db = -80.0
		add_child(p)
		p.play(randf() * 1.9)
		b = {"pl": p, "v": 0.0, "ph": randf() * 6.0}
		beds[k] = b
	b.ph += 0.09
	var mod := 1.0
	if k == "wind" or k == "leaves":
		mod = 0.6 + 0.4 * sin(b.ph * 0.23) * sin(b.ph * 0.071 + 1.0)
	elif k == "surf":
		mod = 0.55 + 0.45 * sin(b.ph * 0.5)
	elif k == "crowd":
		mod = 0.8 + 0.2 * sin(b.ph * 0.37)
	b.v += (v * mod - b.v) * (1.0 - exp(-0.09 / tau))
	var bv: float = float(idx.bed.get(k, {}).get("v", 0.05))
	b.pl.volume_db = linear_to_db(maxf(0.00001, b.v / bv))

func _beds_off(t: float, keep := {}) -> void:
	for k in beds:
		if not keep.has(k):
			_bed(k, 0.0, t)

## голос места: vol 0..1, pan −1..1, far 0..1 (дальние — без верхов); записан с громкостью 0,9 × вес
func _amb(nm: String, vol: float, pan: float, far: float) -> void:
	if not idx.amb.has(nm):
		return
	var bus := "AmbFar" if far >= 0.45 else ("AmbL" if pan < -0.3 else ("AmbR" if pan > 0.3 else "Amb"))
	_play(_st("amb/" + nm + ".wav"), bus, vol / 0.9, randf_range(0.97, 1.03))
	n_amb += 1
	log_amb.append(nm)
	if log_amb.size() > 12:
		log_amb.pop_front()

func _at(nm: String, x: float, y: float, vol: float, far := 0.0) -> void:
	if vol > 0.02:
		_amb(nm, vol, clampf((x - float(S.px)) / 230.0, -0.9, 0.9), far if far > 0.0 else clampf(Vector2(x - float(S.px), y - float(S.py)).length() / 420.0, 0.0, 0.75))

func _around(nm: String, vol: float, far: float) -> void:
	_amb(nm, vol, randf() * 1.6 - 0.8, far)

func _due(key: String, t: float, a: float, b: float) -> bool:
	var nx: Variant = NX.get(key)
	if nx == null or float(nx) > t + b + 1.0:
		NX[key] = t + randf() * b
		return false
	if t < float(nx):
		return false
	NX[key] = t + a + randf() * (b - a)
	return true

static func _fall(d: float, R: float) -> float:
	return 0.0 if d >= R else pow(1.0 - d / R, 1.6)

static func _pickw(a: Array) -> String:
	var s := 0.0
	for x in a:
		s += float(x[1])
	var k := randf() * s
	for x in a:
		k -= float(x[1])
		if k <= 0.0:
			return String(x[0])
	return String(a[0][0])

func _near(A: Array, x: float, y: float) -> Dictionary:
	var b := 1e18
	var bp: Variant = null
	for p in A:
		var d := (float(p[0]) - x) * (float(p[0]) - x) + (float(p[1]) - y) * (float(p[1]) - y)
		if d < b:
			b = d
			bp = p
	return {} if bp == null else {"d": sqrt(b), "p": bp}

func _wk() -> String:
	if Sim.G.is_empty() or not Sim.G.get("weather") is Dictionary:
		return "clear"
	return String(Sim.G.weather.get("k", "clear"))

## что вокруг короля (scan): место, снаружи ли, вид года, час, источники звука, звери и люди рядом
func _scan() -> Dictionary:
	var s := {"where": "", "out": 0, "id": "", "sv": _sv(), "h": Game.hour_abs(), "kind": ""}
	if screen == "court" and court != null and court.loc_id != "" and not court.king.is_empty():
		var L: Dictionary = court.L
		var k: Dictionary = court.king
		s.where = "court"
		s.id = court.loc_id
		s.out = 1 if L.get("out", 0) else 0
		s.px = float(k.x)
		s.py = float(k.y)
		s.src = L.get("snd", {})
		s.kind = "forest" if s.id == "forest" else "home"
		var wa: Array = s.src.get("water", [])
		var w := _near(wa, s.px, s.py)
		s.wd = float(w.d) if not w.is_empty() else 1e9
		s.wp = w.get("p")
		s.coast = not (s.src.get("boat", []) as Array).is_empty()
		s.ani = []
		for a in court.ani:
			if a.loc == s.id and not a.get("dead", false):
				var d := Vector2(float(a.x) - s.px, float(a.y) - s.py).length()
				if d < 340.0:
					s.ani.append({"k": String(a.kind), "x": float(a.x), "y": float(a.y), "d": d})
		s.ppl = []
		var crowd := 0
		for n in court.npcs:
			if n.loc == s.id and not n.get("away", false):
				crowd += 1
				if Vector2(float(n.x) - s.px, float(n.y) - s.py).length() < 150.0:
					s.ppl.append(n)
		s.crowd = crowd
	elif screen == "map":
		s.where = "map"
		s.out = 1
	return s

## птицы по месту, времени года, часу и погоде: [имя, вес] и промежуток (birdPool)
func _bird_pool(s: Dictionary, wk: String) -> Dictionary:
	var h: float = s.h
	var sv: String = s.sv
	var wet := wk == "rain" or wk == "storm" or wk == "blizzard"
	var win := _wintry(sv)
	var aut := _autumnal(sv)
	var d := posmod(Game.day, Game.DAYS_YEAR)
	var night := h >= 21.5 or h < 4.3
	var dawn := h >= 4.3 and h < 8.0
	var dusk := h >= 19.0 and h < 21.5
	var f: bool = s.kind == "forest"
	var vil: bool = s.kind == "village" or s.kind == "town"
	var P0: Array = []
	var A := func(n: String, w: float) -> void:
		if w > 0.0:
			P0.append([n, w])
	if wet:
		if not night and not win:
			A.call("crow", 1.0)
		return {"pool": P0, "gap": [14.0, 30.0]}
	if night:
		A.call("owl", 3.0 if f else 1.5)
		A.call("owl2", 2.0 if f else 1.0)
		if not win and not aut and d >= 8 and d < 34:
			A.call("nightingale", 4.0 if f else 2.0)
		return {"pool": P0, "gap": [6.0, 16.0] if f else [12.0, 30.0]}
	if win:
		A.call("crow", 3.0)
		A.call("tit", 2.0)
		A.call("robin", 1.2)
		if not f:
			A.call("sparrow", 1.2)
		if f:
			A.call("woodpecker", 1.0)
		return {"pool": P0, "gap": [6.0, 14.0] if f else [10.0, 24.0]}
	if dawn:
		A.call("robin", 3.0)
		A.call("blackbird", 3.0)
		A.call("wren", 2.0)
		A.call("chaffinch", 2.0)
		A.call("tit", 1.0)
		if not aut and d < 40:
			A.call("cuckoo", 1.2 if f else 0.5)
		if vil and not aut:
			A.call("lark", 2.0)
	elif dusk:
		A.call("blackbird", 3.0)
		A.call("robin", 2.0)
		A.call("crow", 1.0)
		if not aut and d < 40:
			A.call("cuckoo", 0.4)
	else:
		A.call("chaffinch", 2.0)
		A.call("tit", 2.0)
		A.call("robin", 1.0)
		A.call("blackbird", 1.0)
		A.call("wren", 1.5 if f else 0.6)
		if not f:
			A.call("sparrow", 3.0 if vil else 2.0)
		if vil and not aut:
			A.call("lark", 1.5)
		if f:
			A.call("woodpecker", 1.2)
		if not aut and d < 40:
			A.call("cuckoo", 0.8 if f else 0.3)
		A.call("pigeon", 0.8 if f else 0.5)
		A.call("crow", 2.0 if aut else 0.5)
		if s.get("coast", false):
			A.call("gull", 3.0)
	var g: Array = ([1.4, 4.0] if dawn else [3.0, 8.0]) if f else ([7.0, 16.0] if s.kind == "town" else ([2.5, 7.0] if dawn else [5.0, 12.0]))
	return {"pool": P0, "gap": [g[0] * 1.6, g[1] * 1.6] if aut else g}

func _amb_tick(t: float) -> void:
	# погода (ambTick в audio.js): дождь и ветер по погоде, в доме тише; гром в грозу
	var k := ""
	var ins := 0
	if (screen == "map" or screen == "court") and (screen == "map" or court != null):
		k = _wk()
		if screen == "court" and not court.L.get("out", 0):
			ins = 1
	if not P.on or float(P.av) <= 0.0:
		k = ""
	var rv := 0.035 if k == "rain" else (0.07 if k == "storm" else 0.0)
	var wv0 := {"blizzard": 0.09, "snow": 0.03, "wind": 0.05, "storm": 0.03, "cloud": 0.008}.get(k, 0.0) as float
	if k != "" or beds.has("w_rain") or beds.has("w_wind"):
		_bed("w_rain", rv * (0.3 if ins else 1.0), t, 1.2)
		_bed("w_wind", wv0 * (0.4 if ins else 1.0), t, 1.5)
	if k == "storm" and t > next_thunder:
		if next_thunder > 0.0:
			_play(_st("amb/thunder.wav"), "Sfx", 1.0)
		next_thunder = t + 12.0 + randf() * 20.0
	if roar_v > 0.0 or beds.has("roar"):
		if t - bn_t > 0.35:
			roar_v = 0.0
		_bed("roar", roar_v if screen == "battle" else 0.0, t, 0.3)
	# голоса мест (K.hooks.amb в sndui.js)
	if t - sc_t > 0.45:
		S = _scan()
		sc_t = t
	if k == "" or S.is_empty() or S.where == "":
		_beds_off(t, {"w_rain": 1, "w_wind": 1, "roar": 1})
		return
	var s := S
	var h: float = s.h
	var night := h >= 21.5 or h < 4.3
	var sv: String = s.sv
	var wv := 1.0 if k == "blizzard" else (0.8 if k == "storm" else (0.6 if k == "wind" else (0.4 if k == "snow" else 0.2)))
	var live := 0.5 if Game.speed == 0 and SimPlayer.modal else 1.0
	var B := {"wind": 0.0, "leaves": 0.0, "water": 0.0, "crowd": 0.0, "fire": 0.0, "room": 0.0, "surf": 0.0}
	if s.where == "map":
		B.wind = 0.012 + wv * 0.02 + (0.012 if _season() == 3 else 0.0)
	elif not s.out:
		B.room = 0.022 if s.id == "dungeon" or "chap" in String(s.id) else 0.012
	else:
		B.wind = 0.008 + wv * 0.018 + (0.004 if s.kind == "forest" else 0.0)
		if s.kind == "forest" and not _wintry(sv):
			B.leaves = 0.006 + wv * 0.01
		if s.wd < 260.0:
			B.water = 0.03 * _fall(s.wd, 260.0)
		if s.coast and s.wd < 300.0:
			B.surf = 0.05 * _fall(s.wd, 300.0)
	if s.where == "court":
		var src: Dictionary = s.src
		var f := _near(src.get("fire", []), s.px, s.py)
		if not f.is_empty():
			B.fire = 0.05 * _fall(f.d, 120.0 if s.out else 170.0)
		var fo := _near(src.get("fount", []), s.px, s.py)
		if not fo.is_empty():
			B.water = maxf(B.water, 0.035 * _fall(fo.d, 200.0))
		B.crowd = minf(0.02, (s.ppl as Array).size() * 0.002)
		if not f.is_empty() and f.d < 110.0 and _due("crk", t, 0.6, 2.2):
			_at("crackle", float(f.p[0]), float(f.p[1]), 1.3 * _fall(f.d, 110.0))
		if s.id == "dungeon":
			if _due("drip", t, 1.2, 5.0):
				_around("drip", 0.7 + randf() * 0.6, 0.2)
			if _due("chain", t, 9.0, 26.0):
				_around("chain", 0.8, 0.3)
		if not (s.ppl as Array).is_empty() and _due("pplk", t, 5.0, 14.0):
			var n: Dictionary = s.ppl[randi() % s.ppl.size()]
			if n.get("sit") == null or randf() < 0.5:
				_at("talk", float(n.x), float(n.y), 0.7 * _fall(Vector2(float(n.x) - s.px, float(n.y) - s.py).length(), 150.0), 0.1)
		var work := h > 7.5 and h < 18.5 and not night
		var an_src: Array = src.get("anvil", [])
		if an_src.is_empty() and court.L.has("forge"):
			an_src = [court.L.forge]
		var an := _near(an_src, s.px, s.py)
		if not an.is_empty() and work and an.d < 320.0 and _due("anvil", t, 3.5, 9.0):
			_at("anvil", float(an.p[0]), float(an.p[1]), _fall(an.d, 320.0) * (1.0 if s.out else 0.4))
		var hv := _near(src.get("hive", []), s.px, s.py)
		if not hv.is_empty() and hv.d < 90.0 and work and not _wintry(sv) and k != "rain" and _due("bees", t, 1.8, 3.2):
			_at("bees", float(hv.p[0]), float(hv.p[1]), 1.4 * _fall(hv.d, 90.0))
		if s.out and work and s.kind == "home" and _due("cart", t, 40.0, 110.0):
			_around("cart", 0.7, 0.55)
		if s.out and work and s.kind == "forest" and not _wintry(sv) and _due("axe", t, 45.0, 120.0):
			_around("axe", 0.6, 0.7)
		# колокол в 6, 12 и 18: часовня
		var hh := int(floor(h))
		if last_h >= 0 and hh != last_h and (hh == 6 or hh == 12 or hh == 18) and s.kind != "forest":
			var bl: Array = src.get("bell", [])
			if not bl.is_empty() and s.out:
				_at("bell", float(bl[0][0]), float(bl[0][1]), 0.9, 0.35)
			else:
				_around("bell", 0.8 if s.out else 0.4, 0.55 if s.out else 0.8)
		last_h = hh
		# звери: ближайший каждого рода подаёт голос время от времени
		var seen := {}
		for a in s.ani:
			if not BEASTK.has(a.k) or (seen.has(a.k) and seen[a.k].d <= a.d):
				continue
			seen[a.k] = a
		for kk in seen:
			var a: Dictionary = seen[kk]
			var g: Array = BEASTG[kk]
			if (night and kk != "dog") or not _due("b_" + kk, t, g[0] / live, g[1] / live):
				continue
			_at(_pickw(BEASTK[kk]), a.x, a.y, 0.95 * _fall(a.d, 340.0))
		if s.out and h >= 4.4 and h < 7.5 and seen.has("hen") and _due("rooster", t, 22.0, 60.0):
			var a: Dictionary = seen.hen
			_at("rooster", a.x, a.y, 0.9 * _fall(a.d, 400.0) + 0.2)
		if night and s.out and s.kind == "home" and _due("ndog", t, 40.0, 120.0):
			_around("dog", 0.4, 0.75)
	else:
		last_h = int(floor(h))
	# снаружи: птицы, сверчки, волки
	if s.out:
		var bp := _bird_pool(s, k)
		var m: bool = s.where == "map"
		if not (bp.pool as Array).is_empty() and Game.speed > 0 and _due("bird", t, bp.gap[0] * (2.5 if m else 1.0), bp.gap[1] * (2.5 if m else 1.0)):
			_around(_pickw(bp.pool), 0.45 if m else 0.6 + randf() * 0.5, 0.5 if m else randf() * 0.5)
		var d := posmod(Game.day, Game.DAYS_YEAR)
		var warm_n := d >= 18 and d < 56 and (h >= 19.5 or h < 4.0) and k != "rain" and k != "storm"
		if warm_n and s.where == "court" and _due("crick", t, 1.6, 4.5):
			_around("crickets", 0.8 + randf() * 0.4, 0.2)
		if warm_n and s.where == "court" and s.wd < 240.0 and s.wp != null and _due("frogs", t, 3.0, 9.0):
			_at("frogs", float(s.wp[0]), float(s.wp[1]), 1.1 * _fall(s.wd, 240.0) + 0.2)
		if _wintry(sv) and night and (s.kind == "forest" or m) and _due("wolf", t, 45.0, 130.0):
			_around("wolf", 0.7, 0.8)
	for kk in B:
		_bed(kk, float(B[kk]) * (0.3 if ins and kk != "room" and kk != "fire" and kk != "crowd" else 1.0), t)

# ---------- шаги короля (surfAt: земля места, вид года и погода) ----------
func surf_at(x: float, y: float) -> String:
	var L: Dictionary = court.L
	var ter: String = L.get("ter", "")
	var w := int(L.get("w", 0))
	var tx := floori(x / 16.0)
	var ty := floori((y - 2.0) / 16.0)
	var out: bool = L.get("out", 0)
	if ter == "" or tx < 0 or ty < 0 or tx >= w or ty >= int(L.get("h", 0)):
		return "stone"
	var tt := ter.substr(ty * w + tx, 1).hex_to_int()
	var sv: String = court.sea_key if out else ""
	var wk := _wk()
	var wet := out and (wk == "rain" or wk == "storm")
	var snow := out and (sv == "w" or wk == "blizzard")
	match tt:
		1:
			return "snow" if snow else ("mud" if sv == "th" else ("leaves" if court.loc_id == "forest" and (sv == "au2" or sv == "au3") else "grass"))
		2, 6, 10:
			return "straw" if not out else ("snow" if snow else ("mud" if wet or sv == "th" or sv == "au3" else "dirt"))
		3, 4, 11, 12, 13, 8:
			return "snow" if snow else "stone"
		5, 9:
			return "wood"
		7:
			return "water"
	return ("snow" if snow else "grass") if out else "stone"

func step(sf: String, vel: float, pan := 0.0) -> void:
	if not ok or not P.on or not idx.step.has(sf):
		return
	var bus := "StepL" if pan < -0.3 else ("StepR" if pan > 0.3 else "Step")
	_play(_st("step/%s%d.wav" % [sf, randi() % int(idx.step[sf].get("n", 1))]), bus, vel / float(idx.step[sf].get("v", 0.06)), randf_range(0.96, 1.04))
	n_steps += 1

## шаг короля — каждые 14 px пути (playerUpdate), тише крадучись; трое идущих рядом — раз в 0,1 с, тише и в стороне
func _steps(dt: float) -> void:
	if screen != "court" or court == null or court.king.is_empty():
		step_k = -1
		return
	var k: Dictionary = court.king
	var kk := floori((float(k.get("f", 0.0)) + 7.0) / 14.0)
	if court.loc_id != step_loc:
		step_loc = court.loc_id
		step_k = kk
		stk.clear()
		return
	if kk != step_k:
		if step_k >= 0 and k.get("sit") == null and k.get("moving", false):
			var sf := surf_at(float(k.x), float(k.y))
			step(sf, float(STEPV.get(sf, 0.05)) * (0.35 if court.sneak else 1.0) * (0.85 + randf() * 0.3))
		step_k = kk
	step_t -= dt
	if step_t > 0.0:
		return
	step_t = 0.1
	var px := float(k.x)
	var py := float(k.y)
	var n3 := 0
	for n in court.npcs:
		if n3 >= 3:
			break
		if n.loc != court.loc_id or n.get("away", false) or not (n.get("path") != null or n.get("moving", false)):
			continue
		if absf(float(n.x) - px) >= 110.0 or absf(float(n.y) - py) >= 90.0:
			continue
		n3 += 1
		var key := String(n.get("key", ""))
		var nk := floori((float(n.get("f", 0.0)) + 7.0) / 14.0)
		if stk.has(key) and nk != int(stk[key]):
			var d := Vector2(float(n.x) - px, float(n.y) - py).length()
			if d < 110.0:
				var sf := surf_at(float(n.x), float(n.y))
				step(sf, float(STEPV.get(sf, 0.05)) * 0.45 * _fall(d, 110.0), clampf((float(n.x) - px) / 230.0, -0.9, 0.9))
		stk[key] = nk

## всё стихло (перед выходом из проверок: звучащее при выходе держит записи — «resources still in use»)
func stop_all() -> void:
	want = ""
	screen = ""
	court = null
	for p in pool:
		p.stop()
		p.stream = null
	for k in beds:
		beds[k].pl.stop()
		beds[k].pl.queue_free()
	beds.clear()
	for e in fading:
		if is_instance_valid(e.pl):
			e.pl.stop()
			e.pl.queue_free()
	fading.clear()
	if not cur.is_empty():
		cur.pl.stop()
		cur.pl.queue_free()
		cur = {}

## для проверок: что звучит
func state() -> Dictionary:
	var o := {"ok": ok, "on": bool(P.on), "enc": String(idx.get("enc", "")), "pieces": (idx.get("music", {}) as Dictionary).size(), "want": want, "screen": screen,
		"fam": family(), "mood": mood(), "started": n_pieces, "sfx": n_sfx, "last": log_sfx.slice(-6), "amb": n_amb, "amb_last": log_amb.slice(-6), "steps": n_steps}
	if not cur.is_empty():
		o.playing = (cur.pl as AudioStreamPlayer).playing
		o.pos = snappedf((cur.pl as AudioStreamPlayer).get_playback_position(), 0.01)
	var bv := {}
	for k in beds:
		if float(beds[k].v) > 0.0005:
			bv[k] = snappedf(float(beds[k].v), 0.001)
	o.beds = bv
	return o
