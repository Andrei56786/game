extends Node
# Корень: заставка → двор ↔ карта королевства (Tab). Новая игра и «Продолжить правление» — через экран загрузки по шагам (как
# runSteps в HTML); сохранение — раз в 7 дней, из меню (Esc), при выходе в главное меню и при закрытии окна. Без экрана:
# -- --selftest (двор живёт сутки, королевство — восемь дней с походами ИИ, сохранение и загрузка, проверки, выход с кодом).
# В веб-сборке — window.slovo('команда') для скриншот-тестов: court, title, map, help, time 21, day 30 (вперёд; королевство
# догонит), days 3, speed 2, goto 0, talk, next, close, walk 1 0 0.5, state; menu, menu save|load|exit, save, kstate; на заставке —
# newgame [go [сложность [open]]], continue, snd; на карте — cam x y z, zoom 1, mode pol, sett Имя, army lord, hover x y, reveal,
# dump over, lum, state; battle — бой на экране: войско короны против ближайшего врага (на поле — fight, speed 4, ov, sel C,
# order adv, win, flee, end, cam x y, state).
const Title = preload("res://scripts/title.gd")
const Court = preload("res://scripts/court.gd")
const MapView = preload("res://scripts/world/map_view.gd")
const BView = preload("res://scripts/battle/bview.gd")
const MapUI = preload("res://scripts/world/map_ui.gd")
var cur: Node
var court: Node            # двор живёт, пока смотрят карту
var mapv: Node             # экран карты (камера и режим сохраняются)
var gpu: MapGPU            # карта на GPU: готовится один раз при первом открытии
var bview: Node            # экран боя, пока идёт бой
var js_cb
var js_hide

func _ready() -> void:
	if "--selftest" in OS.get_cmdline_user_args():
		_selftest.call_deferred()
		return
	if "--council" in OS.get_cmdline_user_args():   # только совет (быстро): -- --council
		_council_only.call_deferred()
		return
	if "--snd" in OS.get_cmdline_user_args():       # только звук (быстро): -- --snd
		_snd_only.call_deferred()
		return
	if "--save" in OS.get_cmdline_user_args():      # только сохранение и загрузка (быстро): -- --save
		_save_only.call_deferred()
		return
	if "--chapel" in OS.get_cmdline_user_args():    # только часовня, книги и темница (быстро): -- --chapel
		_chapel_only.call_deferred()
		return
	if "--feast" in OS.get_cmdline_user_args():     # только пир (быстро): -- --feast
		_feast_only.call_deferred()
		return
	if "--works" in OS.get_cmdline_user_args():     # только стол зодчего (быстро): -- --works
		_works_only.call_deferred()
		return
	if "--tour" in OS.get_cmdline_user_args():      # только турнир и раны (быстро): -- --tour
		_tour_only.call_deferred()
		return
	if "--acts" in OS.get_cmdline_user_args():      # только простые дела двора и сон (быстро): -- --acts
		_acts_only.call_deferred()
		return
	_hooks()
	show_title()
	if OS.has_feature("web"):
		js_cb = JavaScriptBridge.create_callback(_js_cmd)
		JavaScriptBridge.get_interface("window").slovo = js_cb
		# вкладку прячут или закрывают (beforeunload в HTML): сохранить, если можно сразу
		js_hide = JavaScriptBridge.create_callback(func(_a): _save_on_leave())
		JavaScriptBridge.get_interface("window").slovo_hide = js_hide
		JavaScriptBridge.eval("document.addEventListener('visibilitychange', () => { if (document.hidden) window.slovo_hide(); }); window.addEventListener('pagehide', () => window.slovo_hide());")
	else:
		get_tree().set_auto_accept_quit(false)    # закрытие окна — сперва сохранить (_notification)
	print("READY ", Game.VERSION, " · ", Engine.get_version_info().string)

## король при дворе или на карте и игра не окончена — есть что сохранять при уходе
func _in_game() -> bool:
	return not Sim.G.is_empty() and not JS.t(Sim.G.get("over")) and cur != null and (cur == court or cur == mapv)

func _save_on_leave() -> void:
	if _in_game():
		Game.save_game()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST and not OS.has_feature("web"):
		_quit()

func _quit() -> void:
	if _in_game():
		await Game.save_safe()
	get_tree().quit()

## окна текущего экрана (двор или карта): разговоры королевства — туда
func cur_ui() -> Variant:
	if court != null and cur == court:
		return court.hud
	if mapv != null and cur == mapv:
		return mapv.ui
	return null

## слова королевства на экране (DLG.say и say в HTML): ответ советника на поручение — над его головой (если он здесь;
## иначе — строкой), весть о смерти короля — разговором, «Как назовёте?» при рождении — разговором с выбором имени
func _hooks() -> void:
	SimCourt.say_hook = func(k: String, line: String) -> bool:
		if court == null or cur != court:
			return false
		var n: Dictionary = court.npc_by("seat_" + k)
		if n.is_empty():
			return false
		if n["loc"] == court.loc_id and not n["away"]:
			court.people.say(n, line, 4.0)
		else:
			court.hud.toast(SimDyn.seatName(k) + ": «" + line + "»")
		return true
	SimDyn.say_hook = func(k: Variant, text: String) -> void:
		if k == null:
			var u: Variant = cur_ui()
			if u != null:
				u.say(null, text)
		elif court != null and cur == court:
			var n: Dictionary = court.npc_by(String(k))
			if not n.is_empty() and n["loc"] == court.loc_id and not n["away"]:
				court.people.say(n, text, 4.0)
	SimDyn.birth_hook = func(text: String, opts: Array, mk: Callable) -> void:
		var u: Variant = cur_ui()
		if u == null:
			mk.call(String(opts[0]))
			return
		var ch: Array = []
		for nm in opts:
			ch.append({"t": String(nm), "fx": func(): mk.call(String(nm))})
		u.say(null, text, {"name": "Рождение", "choices": ch, "esc": 0})

func _set_cur(n: Node) -> void:
	if cur == n:
		return
	if cur:
		if cur == court or cur == mapv:
			remove_child(cur)
		else:
			cur.queue_free()
	cur = n
	add_child(n)
	_snd_screen(n)

## звук по экрану (sndui): заставка — своя пьеса, двор и карта — по месту и часу (auto), бой — «Битва» или «Осада»
func _snd_screen(n: Node) -> void:
	var sc: Variant = n.get_script()
	if sc == Title:
		Snd.screen = "title"
		Snd.court = null
		Snd.music("title")
	elif sc == Court:
		Snd.screen = "court"
		Snd.court = n
		Snd.music("auto")
	elif sc == MapView:
		Snd.screen = "map"
		Snd.music("auto")
	elif sc == BView:
		Snd.screen = "battle"
		Snd.music("battle")

func _drop_court() -> void:
	if court:
		if court.get_parent():
			court.get_parent().remove_child(court)
		court.queue_free()
		court = null

func _drop_map() -> void:
	if mapv:
		if mapv.get_parent():
			mapv.get_parent().remove_child(mapv)
		mapv.queue_free()
		mapv = null

## заставка: двор и экран карты закрываются (королевство в памяти; «Продолжить правление» читает сохранение заново, как в HTML)
func show_title() -> void:
	var t: Node = Title.new()
	t.act.connect(_title_act)
	_set_cur(t)
	_drop_court()
	_drop_map()

func _title_act(k: String, opt: Dictionary) -> void:
	if k == "new":
		new_game(opt)
	elif k == "load":
		load_game()

## меню в игре: загрузить сохранение или выйти в главное меню (сохранено — меню сделало)
func _menu_act(k: String) -> void:
	if k == "load":
		load_game()
	elif k == "exit":
		show_title()
		print("TITLE")

func show_court() -> void:
	var c: Node = Court.new()
	c.leave.connect(show_title)
	c.to_map.connect(show_map)
	c.ride_out.connect(_ride_out)
	_set_cur(c)
	_drop_court()
	court = c
	c.hud.menu_act.connect(_menu_act)
	print("COURT")

# ---------- новая игра и загрузка (startNew, startLoad, afterLoad) ----------
## шаги на экране загрузки: подпись — и что делать (Callable → "" или почему нельзя); каждый — после кадра на экране
func _run(texts: Array, fns: Array) -> bool:
	var t: Node = cur if cur != null and cur.get_script() == Title else null
	if t == null:
		show_title()
		t = cur
	t.begin_load(texts)
	for i in fns.size():
		t.ld.i = i
		await get_tree().process_frame
		await get_tree().process_frame
		# день или шаг движения королевства досчитываются — потом его можно заменить
		while SimDay.busy or Game.stepping:
			await get_tree().process_frame
		var e: Variant = (fns[i] as Callable).call()
		if e is String and e != "":
			t.ld.err = e
			print("LOAD FAIL ", e)
			return false
	return true

## новая игра (startNew: newGame3 и buildCourt): opt — {diff, open}; король — у трона
func new_game(opt: Dictionary) -> void:
	var ok: bool = await _run(["Сотворение мира: горы, реки, озёра…", "Проводим границы держав…", "Возводим замок: зал, покои, двор…"],
		[_new_kingdom.bind(opt), _prep_paths, _enter_court])
	if ok:
		print("NEW GAME ", int(opt.get("diff", 1)), " ", JS.t(opt.get("open")))

func _new_kingdom(opt: Dictionary) -> String:
	var w: WorldData = Sim.W if Sim.W != null and Sim.W.seed == Game.seed else WorldData.load_export("res://art")
	if w == null:
		return "нет данных мира (res://art/world.json)"
	_drop_court()
	_drop_map()
	SimSave.reset_runtime()
	Sim.G = {}
	Game.set_clocks({})
	Sim.start(w, Game.seed, {"diff": float(opt.get("diff", 1)), "tut": false, "mapOpen": JS.t(opt.get("open"))})
	return ""

func _prep_paths() -> String:
	SimArmy.prep()
	return ""

func _enter_court() -> String:
	show_court()
	return ""

## «Продолжить правление» и «Загрузить» (startLoad → afterLoad): королевство и часы из сохранения; король при дворе — двор у
## трона, в поле — карта у войска
func load_game() -> void:
	var ok: bool = await _run(["Читаем летопись…", "Проводим границы держав…", "Возводим замок: зал, покои, двор…"], [_load_kingdom, _prep_paths, _after_load])
	if ok:
		print("LOADED ", int(Sim.G.day), " ", "court" if cur == court else "map")

func _load_kingdom() -> String:
	var o: Variant = SimSave.read(Game.save_path)
	if not (o is Dictionary):
		return "Нет сохранения" if not Game.has_save() else "Сохранение не читается."
	if Sim.W == null or Sim.W.seed != Game.seed:
		Sim.W = WorldData.load_export("res://art")
		if Sim.W == null:
			return "нет данных мира (res://art/world.json)"
	var gd: Dictionary = o.get("gd") if o.get("gd") is Dictionary else {}
	o.erase("gd")
	var err := SimSave.load_data(o)
	if err != "":
		return err
	_drop_court()
	_drop_map()
	Game.set_clocks(gd)
	print("LOAD DIG ", SimSave.digest(SimSave.save_data(true)), " ", int(Sim.G.day))
	return ""

func _after_load() -> String:
	if JS.t(Sim.G.get("atCourt")) or Sim.playerArmy() == null:
		show_court()
	else:
		show_map()
	return ""

## к столу карт (Tab во дворе): двор не закрывается, время при дворе стоит, пока открыта карта
func show_map() -> void:
	if gpu == null:
		gpu = MapGPU.new()
		gpu.name = "MapGPU"
		add_child(gpu)
		gpu.prepare()
	var first := mapv == null
	var pa: Variant = null if Sim.G.is_empty() else Sim.playerArmy()
	if pa == null:
		# вести, пока король сидел при дворе, — не окна карты (при дворе — свои)
		SimDay.alerts = []
		SimPlayer.toasts.clear()
		if court != null and cur == court:
			Snd.sfx("paper")      # стол карт (openMapFromCourt)
	if first:
		mapv = MapView.new()
		mapv.G = gpu
		mapv.leave.connect(back_to_court)
	elif gpu.ok:
		if pa != null:
			mapv.center_army()
		else:
			mapv.center_capital()
	_set_cur(mapv)
	mapv.ui.court = court       # окна двора на карте (Малый совет, письма) знают о дворе
	if first:
		mapv.ui.battle.connect(show_battle)
		mapv.ui.to_court.connect(_to_court)
		mapv.ui.menu_act.connect(_menu_act)
	print("MAP")

## король выезжает из замка (ворота или конюшня): войско короля — на карте, пауза «укажите путь»
func _ride_out(a: Variant) -> void:
	if Sim.G.is_empty():
		return
	SimPlayer.leaveCourt(a)
	show_map()
	mapv.ui.rode_out()
	print("RIDE OUT ", Sim.G.player.army, " ", Sim.armyMen(Sim.playerArmy()))

## король въехал в замок (enterCourt) или бежал ко двору (G.toCourt): двор — у ворот или у трона
func _to_court(spot: String) -> void:
	mapv.ui.modals.clear()
	mapv.ui.win = null
	mapv.ui.target = null
	SimPlayer.modal = false
	back_to_court()
	court.cmd(PackedStringArray(["spot", spot]))
	print("TO COURT ", spot)

## бой на экране (startBattle): A и Bs — стороны (SimCapt.sideFromArmy / sideFromGarrison), tile — клетка карты,
## o — {b, siege, works, sett, amb, tplA}. Шаг движения или день королевства, если считаются, сперва досчитываются.
func show_battle(A: Dictionary, Bs: Dictionary, tile: int, o: Dictionary = {}) -> void:
	while SimDay.busy or Game.stepping:
		await get_tree().process_frame
	var v: Control = BView.new()
	v.name = "Battle"
	Snd.siege = JS.t(o.get("siege"))
	_set_cur(v)
	v.setup(A, Bs, tile, o)
	v.finished.connect(_battle_done)
	bview = v
	print("BATTLE ", v.B.units.size())

## «На карту» после боя (endBattleScreen): карта и пауза (autoPause('Битва окончена'))
func _battle_done(res: Dictionary) -> void:
	bview = null
	show_map()
	mapv.ui.auto_pause("Битва окончена")
	print("BATTLE DONE ", res.get("win"))

## для проверок: войско игрока (или первое войско лорда его державы) и ближайший к нему враг (иначе — любое чужое войско)
func test_pair() -> Array:
	var G := Sim.G
	if G.is_empty():
		return []
	var A: Variant = Sim.playerArmy()
	if A == null:
		for a: Dictionary in G.armies:
			if JS.t(a.alive) and a.realm == G.player.realm and String(a.kind) == "lord" and Sim.armyMen(a) > 50:
				A = a
				break
	if A == null:
		return []
	var Bn: Variant = null
	var bd := INF
	for b: Dictionary in G.armies:
		if not JS.t(b.alive) or b == A or b.realm == A.realm or Sim.armyMen(b) < 20 or String(b.kind) == "caravan":
			continue
		var d := Vector2(b.x - A.x, b.y - A.y).length() + (0.0 if Sim.hostile(A.realm, b.realm) else 1000.0)
		if d < bd:
			bd = d
			Bn = b
	return [] if Bn == null else [A, Bn]

func test_battle() -> bool:
	var ab := test_pair()
	if ab.is_empty():
		print("BATTLE: нет войск")
		return false
	show_battle(SimCapt.sideFromArmy(ab[0]), SimCapt.sideFromArmy(ab[1]), Sim.armyTile(ab[0]), {"b": ab[1].id, "tplA": "std"})
	return true

func back_to_court() -> void:
	if court == null:
		show_court()
		return
	if cur == mapv and mapv != null:
		Snd.sfx("door")           # от стола карт ко двору (backToCourt)
	_set_cur(court)
	court.cam.make_current()
	print("COURT")

func _js_cmd(a: Array) -> void:
	var p: PackedStringArray = String(a[0]).split(" ") if a.size() > 0 else PackedStringArray([""])
	match p[0]:
		"court":
			if cur == mapv and court:
				back_to_court()
			else:
				show_court()
		"title":
			show_title()
		"map":
			if court == null:
				show_court()
			show_map()
		"time":
			Game.set_hour(float(p[1]))
		"speed":
			if bview and cur == bview:
				bview.cmd(p)
			else:
				Game.set_speed(int(p[1]))
		"day":
			# календарь не уходит назад от дня королевства: вперёд — королевство догонит, день за днём
			Game.day = maxi(maxi(0, int(p[1])), -1 if Sim.G.is_empty() else int(Sim.G.day))
		"days":
			Game.day += maxi(0, int(p[1]))
		"battle":
			if bview == null:
				test_battle()
		"menu":
			var u: Variant = cur_ui()
			if u == null:
				return
			if p.size() == 1:
				u.open_menu()
			elif p[1] == "save":
				u._m_save()
			elif p[1] == "load":
				u._m_load()
			elif p[1] == "exit":
				u._m_exit()
		"gold":
			# казна (для проверок): gold 1000
			if not Sim.G.is_empty() and p.size() > 1:
				Sim.G.realms[0].gold = float(p[1])
		"save":
			_js_save()
		"savestat":
			# что сколько весит в сохранении (сжатое, КБ): самые тяжёлые части
			if not Sim.G.is_empty():
				var o := SimSave.save_data()
				print("SAVESTAT ", snappedf(SimSave.pack(o).size() / 1024.0, 0.1), " ", JSON.stringify(SimSave.stat(o)))
		"kstate":
			var G := Sim.G
			print("KSTATE ", JSON.stringify({"screen": "court" if cur == court and court != null else ("map" if cur == mapv and mapv != null else "other"),
				"day": int(G.get("day", -1)), "gday": Game.day, "frac": snappedf(Game.frac, 0.0001), "speed": Game.speed, "steps": Game.steps,
				"gold": snappedf(float(G.realms[0].gold), 0.01) if not G.is_empty() else 0.0, "atCourt": JS.t(G.get("atCourt")), "diff": G.get("diff", -1), "mapOpen": JS.t(G.get("mapOpen")),
				"save": SimSave.head(Game.save_path), "saved": Game.saved_day, "save_ms": Game.save_ms, "save_kb": Game.save_kb}))
		_:
			if cur and cur.has_method("cmd"):
				cur.cmd(p)

## сохранить по команде (для проверок): записано — и отпечаток записанного
func _js_save() -> void:
	var ok := SimPlayer.ensure_sim() and await Game.save_safe()
	print("SAVE DIG ", SimSave.file_digest(Game.save_path) if ok else "-", " ", int(Sim.G.get("day", -1)))

func _selftest() -> void:
	Game.sim_run = false      # дни королевства здесь считаются явно
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.selftest()
	remove_child(c)           # дальше — королевство без двора (окна двора не берут вести карты)
	c.queue_free()
	var sok: bool = await _sim_selftest()
	ok = sok and ok
	var pok: bool = await _player_selftest()
	ok = pok and ok
	var bok: bool = await _battle_selftest()
	ok = bok and ok
	var cok: bool = await _council_selftest()
	ok = cok and ok
	var hok: bool = await _chapel_selftest()
	ok = hok and ok
	var fok: bool = await _feast_selftest()
	ok = fok and ok
	var wok: bool = await _works_selftest()
	ok = wok and ok
	var tok: bool = await _tour_selftest()
	ok = tok and ok
	var aok: bool = await _acts_selftest()
	ok = aok and ok
	var nok: bool = await _snd_selftest()
	ok = nok and ok
	var vok: bool = await _save_selftest()
	ok = vok and ok
	print("SELFTEST OK" if ok else "SELFTEST FAIL")
	get_tree().quit(0 if ok else 1)

func _snd_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _snd_selftest()
	print("SND OK" if ok else "SND FAIL")
	get_tree().quit(0 if ok else 1)

func _save_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _save_selftest()
	print("SAVE OK" if ok else "SAVE FAIL")
	get_tree().quit(0 if ok else 1)

func _chapel_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _chapel_selftest()
	print("CHAPEL OK" if ok else "CHAPEL FAIL")
	get_tree().quit(0 if ok else 1)

func _feast_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _feast_selftest()
	print("FEAST OK" if ok else "FEAST FAIL")
	get_tree().quit(0 if ok else 1)

func _works_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _works_selftest()
	print("WORKS OK" if ok else "WORKS FAIL")
	Snd.stop_all()
	await get_tree().create_timer(0.3).timeout   # звук отпускает записи — без «утечек» при выходе
	get_tree().quit(0 if ok else 1)

func _tour_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _tour_selftest()
	print("TOUR OK" if ok else "TOUR FAIL")
	Snd.stop_all()
	await get_tree().create_timer(0.3).timeout   # звук отпускает записи — без «утечек» при выходе
	get_tree().quit(0 if ok else 1)

func _acts_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _acts_selftest()
	print("ACTS OK" if ok else "ACTS FAIL")
	Snd.stop_all()
	await get_tree().create_timer(0.3).timeout   # звук отпускает записи — без «утечек» при выходе
	get_tree().quit(0 if ok else 1)

## простые дела двора (court_acts.gd): кучки золота и мешки по казне и амбару, колыбель, постель и сон (часы бегут,
## весть будит), чучело и Меч короля, фонтан, лавка купца, амбар, кухня, колодец, кузня
func _acts_selftest() -> bool:
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.acts.selftest()
	remove_child(c)
	c.queue_free()
	return ok

## турнир на ристалище и раны короля (court_tour.gd, court_hurt.gd): трибуны, зрители и герольд, поединки, выход короля
## к барьеру, награда, конец турнира; носилки, постель и дни лечения
func _tour_selftest() -> bool:
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.trn.selftest()
	remove_child(c)
	c.queue_free()
	return ok

## стол зодчего (court_works.gd): окно, заложить и свернуть, клетки под стройкой, мастера и пиво, леса по ходу работ,
## готовый розарий, звездочётная и труба
func _works_selftest() -> bool:
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.wrk.selftest()
	remove_child(c)
	c.queue_free()
	return ok

## пир в пиршественном зале (court_feast.gd): гости и места, король во главе стола, три дела, гость и менестрель, конец пира
func _feast_selftest() -> bool:
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.fst.selftest()
	remove_child(c)
	c.queue_free()
	return ok

## часовня, книги и темница (court_chapel.gd): молитва, чтение, воскресная обедня, узники и тюремщик
func _chapel_selftest() -> bool:
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.chp.selftest()
	print("selftest: часовня, книги и темница — ", "OK" if ok else "FAIL")
	remove_child(c)
	c.queue_free()
	return ok

func _council_only() -> void:
	Game.sim_run = false
	var ok := SimPlayer.ensure_sim() and await _council_selftest()
	print("COUNCIL OK" if ok else "COUNCIL FAIL")
	get_tree().quit(0 if ok else 1)

## совет при дворе на данных королевства (court.council_test), люди двора из королевства и приём прошений (court.people_test)
func _council_selftest() -> bool:
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var ok: bool = c.council_test()
	var pok: bool = c.people_test()
	print("selftest: двор из королевства и прошения — ", "OK" if pok else "FAIL")
	ok = ok and pok
	remove_child(c)
	c.queue_free()
	return ok

## сохранение и загрузка без экрана (saveGame / loadGame): записать королевство и часы; загрузить — то же королевство до знака
## (отпечаток как у записанного), те же часы; день после загрузки идёт одинаково, сколько раз ни загружай (счёт вне G сброшен);
## двор после загрузки — из загруженного королевства; король в поле — после загрузки снова в поле
func _save_selftest() -> bool:
	if Sim.G.is_empty() and not SimPlayer.ensure_sim():
		return false
	Game.save_path = "user://selftest.sav"
	Game.day = int(Sim.G.day)
	Game.frac = 0.4375
	Game.speed = 2
	Game.steps = 10
	Game.step_at = Sim.G.day + 10.0 / Game.STEPS
	var c0 := Game.clocks()
	var day0 := int(Sim.G.day)
	# товара на рынке почти нет (в записи — 0) и нет вовсе (в запись не попадёт, после загрузки initEcon добавит 0) — как в HTML
	for S: Dictionary in Sim.G.setts:
		if S.get("mk") is Dictionary and (S.mk as Dictionary).size() > 2:
			S.mk[S.mk.keys()[0]] = 0.02
			S.mk[S.mk.keys()[1]] = 0.0
			break
	var sv := Game.save_game()
	var ms_save := Game.save_ms
	var kb := Game.save_kb
	var fdig := SimSave.file_digest(Game.save_path)
	var digs: Array = []
	var days: Array = []
	var ms_load := 0
	for k in 2:
		Game.set_clocks({})
		if k == 1:
			# вторая загрузка — как «Продолжить правление» сразу после запуска: таблиц игры и цен клеток ещё нет
			Sim.T = {}
			SimArmy.cls_w = null
		var t0 := Time.get_ticks_msec()
		var e := _load_kingdom()
		if k == 1:
			SimArmy.prep()
		ms_load = Time.get_ticks_msec() - t0
		digs.append(SimSave.digest(SimSave.save_data(true)) if e == "" else "error: " + e)
		SimDay.budget_us = 0
		for i in Game.STEPS:
			await SimArmy.substep(1.0 / Game.STEPS)
		await SimDay.dailyTick(0)
		days.append(SimSave.digest(SimSave.save_data()))
	_load_kingdom()
	var cok: bool = Game.clocks() == c0
	# двор из загруженного королевства
	var c: Node = Court.new()
	add_child(c)
	await get_tree().process_frame
	var st: Dictionary = c.state()
	var court_ok: bool = st.npcs >= 30 and st.seats >= 3
	remove_child(c)
	c.queue_free()
	# король в поле: выезд, сохранение, загрузка — снова в поле, с тем же войском
	var pa: Dictionary = SimPlayer.leaveCourt(SimPlayer.capitalArmy())
	var men := Sim.armyMen(pa)
	var sv2 := Game.save_game()
	_load_kingdom()
	var pb: Variant = Sim.playerArmy()
	var fok: bool = sv2 and pb != null and String(pb.kind) == "player" and not JS.t(Sim.G.get("atCourt")) and absf(Sim.armyMen(pb) - men) < 0.01
	SimPlayer.enterCourt()
	SimSave.remove(Game.save_path)
	Game.save_path = Game.SAVE
	var ok: bool = sv and fdig != "" and digs[0] == fdig and digs[1] == fdig and days[0] == days[1] and cok and court_ok and fok and kb > 50
	print("selftest: сохранение дня %d — %.0f мс, %d КБ; загрузка %d мс, отпечаток %s (записано %s), день после загрузки %s/%s, часы %s, двор %d чел. (%d в совете), в поле %s — %s" % [day0,
		ms_save, kb, ms_load, str(digs), fdig, str(days[0]), str(days[1]), str(cok), st.npcs, st.seats, str(fok), "OK" if ok else "FAIL"])
	return ok

## звук без экрана (Snd): записи на месте (пьесы — OGG своей длины, звуки, шумы ровно по 2 с), музыка по месту, часу и экрану
## (resolve), пьеса начинается, звуки из очереди симуляции, шумы места, земля под ногами (surfAt) и шаги
func _snd_selftest() -> bool:
	if not Snd.ok:
		print("selftest: звук — нет записей (snd/index.json; tools/snd_export.mjs) — FAIL")
		return false
	var I: Dictionary = Snd.idx
	var pe: Dictionary = I.music.get("peace", {})
	var ps: AudioStream = Snd._st(String(pe.get("f", "")))
	var cl: AudioStream = Snd._st("sfx/click.wav")
	var bd: AudioStream = Snd._st("bed/wind.wav")
	var ok: bool = I.music.size() >= 40 and I.sfx.size() >= 25 and I.amb.size() >= 30 and I.bed.size() >= 9 and I.step.size() >= 9
	ok = ok and ps != null and absf(ps.get_length() - float(pe.get("len", 0))) < 1.0 and cl != null and cl.get_length() > 0.01 and bd != null and absf(bd.get_length() - 2.0) < 0.01
	var h0 := Game.hour_abs()
	var c: Node = Court.new()
	_set_cur(c)
	await get_tree().process_frame
	var R := {}
	for e in [["keep", 12.0], ["keep", 23.0], ["dungeon", 12.0], ["chapel", 12.0], ["hall", 12.0], ["yard", 12.0], ["forest", 7.0]]:
		if c.loc_id != e[0]:
			c.go_loc(e[0])
		Game.set_hour(e[1])
		R["%s@%d" % [e[0], int(e[1])]] = Snd.resolve()
	var rok: bool = R["keep@23"] == "night" and R["dungeon@12"] == "dungeon" and R["chapel@12"] == "chapel" and (String(R["yard@12"]).begins_with("outdoor") or R["yard@12"] in ["garden", "war"])
	rok = rok and R["keep@12"] in ["court", "war", "sick", "throne", "study", "council"] and Snd.FAM.has(R["keep@12"]) and Snd.FAM.has(R["forest@7"])
	# пьеса двора начинается (через 0,05 с), голоса и шумы двора днём, звуки из очереди симуляции и окон
	c.cmd(PackedStringArray(["spot", "throne_front"]))
	Game.set_hour(12.0)
	Snd.music("auto")
	var n0 := Snd.n_pieces
	var s0 := Snd.n_sfx
	Sim.sfx("coin")
	c.hud.say(null, "Проверка звука.")
	await get_tree().create_timer(0.9).timeout
	var st := Snd.state()
	var mok: bool = Snd.n_pieces > n0 and Snd.fam_list(Snd.family()).has(Snd.mood()) and Snd.n_sfx >= s0 + 2 and "coin" in st.last and "paper" in st.last
	var pl0 := "%s «%s»" % [Snd.family(), Snd.mood()]
	c.hud.close_dlg()
	c.go_loc("yard")
	c.cmd(PackedStringArray(["spot", "well"]) if c.spots.has("well") else PackedStringArray(["goto", "0"]))
	await get_tree().create_timer(1.2).timeout
	var beds0: Dictionary = Snd.state().beds
	var bok: bool = beds0.has("wind")
	var sf := Snd.surf_at(float(c.king.x), float(c.king.y))
	var k0 := Snd.n_steps
	Snd.step(sf, 0.05)
	var fok: bool = Snd.STEPV.has(sf) and Snd.n_steps == k0 + 1
	# карта и бой: семьи пьес по экрану
	Snd.screen = "map"
	var rm := Snd.resolve()
	Snd.screen = "battle"
	Snd.want = "battle"
	Snd.siege = true
	var rs := Snd.resolve()
	Snd.siege = false
	var rb := Snd.resolve()
	var sok: bool = Snd.FAM.has(rm) and rs == "siege" and rb == "battle"
	Snd.stop_all()
	remove_child(c)
	c.queue_free()
	cur = null
	Game.set_hour(h0)
	await get_tree().create_timer(0.3).timeout     # звук отпускает записи
	var all := ok and rok and mok and bok and fok and sok
	print("selftest: звук — пьес %d (%s), звуков %d, голосов %d, шумов %d; музыка: %s, карта %s, бой %s/%s; играет %s, звуки %s, шумы во дворе %s, земля «%s» — %s" % [I.music.size(),
		String(I.enc), I.sfx.size(), I.amb.size(), I.bed.size(), str(R), rm, rb, rs, pl0, str(st.last), str(beds0), sf,
		"OK" if all else "FAIL (%s)" % str([ok, rok, mok, bok, fok, sok])])
	return all

## королевство без экрана: новая игра в мире из выгрузки, подсказки всех поселений и войск, обзор, казна
func _sim_selftest() -> bool:
	var w := WorldData.load_export("res://art")
	if w == null:
		print("SIM: нет мира")
		return false
	var t0 := Time.get_ticks_msec()
	Sim.start(w, Game.seed)
	var ms := Time.get_ticks_msec() - t0
	var G := Sim.G
	var n := 0
	for s: Dictionary in w.setts:
		n += SimText.settTip(s.id).size()
	for a: Dictionary in G.armies:
		n += SimText.armyTip(a).size()
	for t in range(0, WorldData.NT, 997):
		n += SimText.tileTip(t).length()
	var ex := (G.explored as PackedByteArray).count(1)
	var vis := (G.vis as PackedByteArray).count(2)
	var seen := 0
	for a: Dictionary in G.armies:
		if JS.t(a.alive) and SimIntel.armyVisible(a):
			seen += 1
	var bv := SimText.bar_vals()
	print("SIM: новая игра %d мс, людей %d, войск %d (видно %d), разведано %d клеток, видно %d, казна %.1f, доход %.2f (в выгрузке двора: %s и %s), строк подсказок %d" % [ms,
		G.chars.size(), G.armies.size(), seen, ex, vis, bv.gold, bv.net, str(Art.D.get("gold")), str(Art.D.get("net")), n])
	var ok: bool = G.chars.size() > 100 and G.armies.size() > 40 and G.setts.size() == w.setts.size() and ex > 1000 and ex < WorldData.NT and vis > 100 and seen > 0 and seen < G.armies.size()
	# казна та же, что в выгрузке двора (HTML, то же зерно): с доходом за прожитые при дворе дни
	var D: Dictionary = Art.D
	var dg := float(D.get("gold", 0)) + float(D.get("net", 0.0)) * maxi(0, Game.day - int(D.get("day", 0)))
	ok = ok and absf(bv.gold - dg) < 1.0 and absf(bv.net - float(D.get("net", 0.0))) < 0.01
	if not ok:
		print("SIM: проверка королевства не прошла")
	# время: неделя королевства сразу (как догонялка: 24 шага движения и день), восьмой день — как при игре: часы Game
	# ушли в новые сутки, шаги и день — по кадрам с малым бюджетом
	var g0: float = G.realms[0].gold
	var log0: int = G.log.size()
	var p0 := _pos_sum()
	var wk := {}
	var tu := Time.get_ticks_usec()
	for i in 7:
		SimDay.budget_us = 0
		for k in Game.STEPS:
			await SimArmy.substep(1.0 / Game.STEPS)
		await SimDay.dailyTick(0)
		wk[String(G.weather.k)] = true
	var ms7 := (Time.get_ticks_usec() - tu) / 7000.0
	var st0 := Game.steps_n
	Game.day = int(G.day) + 1
	Game.frac = 0.0
	Game.sim_run = true
	var fr := 0
	while (G.day < Game.day or SimDay.busy) and fr < 3000:
		await get_tree().process_frame
		fr += 1
	Game.sim_run = false
	var g1: float = G.realms[0].gold
	var march := 0
	var sieges := 0
	var kinds := {}
	for a: Dictionary in G.armies:
		if JS.t(a.alive) and a.path != null:
			march += 1
		if JS.t(a.alive) and a.siegeOf >= 0:
			sieges += 1
		kinds[String(a.kind)] = int(kinds.get(String(a.kind), 0)) + 1
	var moved := absf(_pos_sum() - p0)
	print("SIM: 8 дней — %.1f мс на день, восьмой день за %d кадров (шагов %d, день %d кадров, %.1f мс счёта), казна %.1f → %.1f, погода %s, записей летописи +%d" % [ms7,
		fr, Game.steps_n - st0, SimDay.frames, SimDay.ms_day, g0, g1, ",".join(wk.keys()), G.log.size() - log0])
	print("SIM: войска %s, в походе %d, в осаде %d, сдвиг Σ(7x+13y) %.0f, путей %d, призраков %d" % [str(kinds), march, sieges, moved, SimArmy.path_n, (G.get("know", {}) as Dictionary).size()])
	var tok: bool = G.day == 8.0 and not SimDay.busy and SimDay.frames > 1 and absf(g1 - g0) > 0.01 and G.weather.has("k") and Game.steps_n - st0 == Game.STEPS
	tok = tok and march > 3 and moved > 50 and SimArmy.path_n > 10 and kinds.get("caravan", 0) > 0
	if not tok:
		print("SIM: дни королевства не идут как надо")
	return ok and tok

## король в поле (leaveCourt … enterCourt) без экрана карты: выезд с войском столицы, путь и шаги движения, гонец к войску
## лорда короны и приказ по прибытии, встреча с врагом — окно и автобой (итог — окно bres), штурм без экрана, въезд в замок
func _player_selftest() -> bool:
	var G := Sim.G
	var ui: Control = MapUI.new()
	add_child(ui)
	SimDay.alerts = []
	SimPlayer.modal = false
	var a0: Variant = SimPlayer.capitalArmy()
	var m0 := Sim.armyMen(a0) if a0 != null else 0.0
	var pa: Dictionary = SimPlayer.leaveCourt(a0)
	var ok: bool = a0 != null and Sim.playerArmy() == pa and not JS.t(G.atCourt) and pa.kind == "player" and Sim.armyMen(pa) > m0
	# путь: проходимая клетка в 5–8 клетках от войска
	var tgt := -1
	var t0 := Sim.armyTile(pa)
	for r in range(5, 9):
		for k in 16:
			var t: int = t0 + roundi(cos(k * TAU / 16) * r) + roundi(sin(k * TAU / 16) * r) * WorldData.MW
			if tgt < 0 and t >= 0 and t < WorldData.NT and SimDay.passable(Sim.W.ter[t]) and SimArmy.planPath(pa, t) != null:
				tgt = t
	var mv_ok := tgt >= 0 and SimPlayer.orderMove(tgt)
	var x0: float = pa.x
	var y0: float = pa.y
	for k in 12:
		await SimArmy.substep(1.0 / Game.STEPS)
	var moved := Vector2(pa.x - x0, pa.y - y0).length()
	# гонец: приказ «Стоять» войску лорда короны вдали — едет, пока не доскачет
	var lord: Variant = null
	for a: Dictionary in SimPlayer.crownArmies():
		if Vector2(a.x - pa.x, a.y - pa.y).length() > 4.0:
			lord = a
			break
	var days := -1.0
	var nc := 0
	var steps := 0
	var got := false
	if lord != null:
		days = SimPlayer.sendOrder(lord, {"o": "hold", "t": -1.0, "mode": "order"})
		nc = (G.couriers as Array).size()
		while (G.couriers as Array).size() > 0 and steps < Game.STEPS * 20:
			await SimArmy.substep(1.0 / Game.STEPS)
			steps += 1
		got = lord.cmd is Dictionary and String(lord.cmd.o) == "hold" and not JS.t(lord.get("pend"))
	# встреча: шайка вплотную — окно «Встреча с врагом», автобой — окно итога
	var b: Variant = null
	for a: Dictionary in G.armies:
		if JS.t(a.alive) and a != pa and Sim.hostile(pa.realm, a.realm) and String(a.kind) != "caravan" and (b == null or Sim.armyMen(a) < Sim.armyMen(b)):
			b = a
	var enc_ok := false
	var bres: Variant = null
	if b != null:
		b.x = pa.x + 0.4
		b.y = pa.y
		G.encCool = {}
		SimPlayer.modal = false
		SimDay.alerts = []
		SimPlayer.checkEncounters()
		ui.tick()
		enc_ok = not ui.modals.is_empty() and String(ui.modals[0].k) == "enc" and SimPlayer.modal
		var mb := Sim.armyMen(b)
		var t1 := Time.get_ticks_msec()
		await ui.enc_auto(b, false)
		bres = ui.modals[0].d if not ui.modals.is_empty() and String(ui.modals[0].k) == "bres" else null
		print("PLAYER: встреча с %s (%d) — автобой %d мс, итог %s" % [SimArmy.armyLabel(b), roundi(mb), Time.get_ticks_msec() - t1, JSON.stringify(bres.sides) if bres != null else "нет"])
		if bres != null:
			ui.bres_ok(bres)
	# штурм без экрана: ближайшее чужое поселение; войны нет — объявлена для проверки
	var S: Variant = null
	for s: Dictionary in G.setts:
		if int(s.ctrl) != 0 and int(s.ctrl) < 5 and (S == null or Vector2(Sim.W.setts[int(s.id)].x - pa.x, Sim.W.setts[int(s.id)].y - pa.y).length() < Vector2(Sim.W.setts[int(S.id)].x - pa.x, Sim.W.setts[int(S.id)].y - pa.y).length()):
			S = s
	var as_ok := false
	if S != null:
		var r := int(S.ctrl)
		G.rel[0][r].war = 1.0
		G.rel[r][0].war = 1.0
		var ws: Dictionary = Sim.W.setts[int(S.id)]
		pa.x = ws.x + 0.5
		pa.y = ws.y + 0.5
		pa.path = null
		ui.siege_start(int(S.id))
		var sg: bool = pa.siegeOf == float(S.id)
		await ui.assault(int(S.id), false)
		var ar: Variant = ui.modals[0].d if not ui.modals.is_empty() and String(ui.modals[0].k) == "bres" else null
		as_ok = sg and ar is Dictionary and int(ar.get("sett", -1)) == int(S.id) and (not ar.win or int(S.ctrl) == 0)
		print("PLAYER: осада %s (%s), штурм — %s, поселение за %d" % [String(ws.name), str(sg), "взято" if ar != null and ar.win else "отбились", int(S.ctrl)])
		ui.modals.clear()
	SimPlayer.modal = false
	# въезд в замок: войско у стен под началом рыцаря, король — при дворе
	SimPlayer.enterCourt()
	var in_ok: bool = JS.t(G.atCourt) and Sim.playerArmy() == null or (Sim.playerArmy() != null and Sim.playerArmy().kind != "player")
	print("PLAYER: выезд с войском столицы (%d → %d чел.), путь %s, за 12 шагов %.2f кл., гонец (%d в пути, %.2f дн.) доскакал за %d шагов: %s, встреча — окно %s, итог %s, штурм %s, въезд %s" % [roundi(m0),
		roundi(Sim.armyMen(pa)), str(mv_ok), moved, nc, days, steps, str(got), str(enc_ok), str(bres != null), str(as_ok), str(in_ok)])
	ok = ok and mv_ok and moved > 0.3 and lord != null and nc == 1 and got and enc_ok and bres != null and as_ok and in_ok
	ui.queue_free()
	if not ok:
		print("PLAYER: король в поле — что-то не так")
	return ok

## бой на экране без экрана: войско короны против ближайшего врага — расстановка, бой на скорости 4 (кадры по 0,1 с),
## итог (applyBattle), «На карту»: потери в войсках, королевство снова идёт
func _battle_selftest() -> bool:
	var ab := test_pair()
	if ab.is_empty():
		print("BATTLE: нет войск для проверки")
		return false
	var A: Dictionary = ab[0]
	var Bn: Dictionary = ab[1]
	var m0 := [Sim.armyMen(A), Sim.armyMen(Bn)]
	var v: Control = BView.new()
	add_child(v)
	var t0 := Time.get_ticks_msec()
	v.setup(SimCapt.sideFromArmy(A), SimCapt.sideFromArmy(Bn), Sim.armyTile(A), {"b": Bn.id, "tplA": "std"})
	var res_box := []
	v.finished.connect(func(r): res_box.append(r))
	var ms_setup := Time.get_ticks_msec() - t0
	var n0: int = v.B.units.size()
	for i in 5:
		await get_tree().process_frame
	var hold0 := Game.hold
	v.cmd(PackedStringArray(["sel", "C"]))
	var sel0: int = v.B.sel.size()
	v.cmd(PackedStringArray(["fight"]))
	v.cmd(PackedStringArray(["speed", "4"]))
	var fr := 0
	t0 = Time.get_ticks_msec()
	while v.B.res == null and fr < 2400:
		await get_tree().process_frame
		fr += 1
		if fr == 1200 and v.B.over == null:
			v.cmd(PackedStringArray(["win"]))
	var st: Dictionary = v.state()
	print("BATTLE: %s (%d) против %s (%d): отрядов %d, расстановка %d мс, выбран полк %d отр., бой %.0f с за %d кадров (%d мс), итог %s, люди %s" % [String(A.get("name", A.kind)),
		roundi(m0[0]), String(Bn.get("name", Bn.kind)), roundi(m0[1]), n0, ms_setup, sel0, v.B.t, fr, Time.get_ticks_msec() - t0, JSON.stringify(v.B.over), str(st.men)])
	var ok: bool = n0 > 4 and hold0 and v.B.res != null and sel0 > 0
	if v.B.res != null:
		v.cmd(PackedStringArray(["end"]))
		await get_tree().process_frame
	var m1 := [Sim.armyMen(A), Sim.armyMen(Bn)]
	print("BATTLE: после боя люди %s → %s, королевство ждёт: %s, итог наружу: %s" % [str(m0.map(roundi)), str(m1.map(roundi)), str(Game.hold), str(res_box.size())])
	ok = ok and not Game.hold and res_box.size() == 1 and (m1[0] < m0[0] or m1[1] < m0[1])
	v.queue_free()
	if not ok:
		print("BATTLE: бой на экране не прошёл")
	return ok

func _pos_sum() -> float:
	var s := 0.0
	for a: Dictionary in Sim.G.armies:
		s = s + a.x * 7 + a.y * 13
	return s
