extends SceneTree
# для разработки: загрузить скрипты (с автозагрузками Art и Game) и показать ошибки разбора
func _initialize() -> void:
	await process_frame
	for p in OS.get_cmdline_user_args():
		var s: Script = load(p)
		print("CHK ", p, " ", "ok" if s != null and s.can_instantiate() else "FAIL")
	quit(0)
