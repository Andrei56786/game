# Проба Godot 4.7 (3 ноября)

Проверка, что «Слово короля» можно делать на Godot в рабочей среде без экрана: пиксель-арт 640×360 с целым масштабом (режим растяжения `canvas_items`), книжный шрифт PT Serif в разрешении экрана (тот же урезанный шрифт, что в `src/fontdata.js`), ночь (`CanvasModulate`), свет костра (`PointLight2D`), искры (`CPUParticles2D`); сборки в веб и Windows.

```bash
sh godot/spike/build.sh            # GODOT=путь/к/Godot_v4.7.2-stable_linux.x86_64
cd godot/spike/build/web && python3 -m http.server 8765   # веб-сборку открывать через сервер, не из file://
```

Нужны Godot 4.7.2 и шаблоны экспорта (`web_nothreads_*`, `windows_*`); как поставить — `notes/plan-v4.md`. Это проба, а не начало игры: настоящий проект будет рядом, в `godot/`.
