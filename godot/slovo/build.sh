#!/bin/sh
# «Слово короля» на Godot: шрифт из src/fontdata.js → импорт → проверка без экрана → сборки в веб и Windows (build/web, build/win).
# GODOT — путь к Godot 4.7.2 (шаблоны экспорта — notes/plan-v4.md). Только проверка: sh build.sh test
set -e
cd "$(dirname "$0")"
G=${GODOT:-/data/tools/godot/Godot_v4.7.2-stable_linux.x86_64}
node -e "const f=require('fs'),s=f.readFileSync('../../src/fontdata.js','utf8');f.writeFileSync('slovo_serif.woff',Buffer.from(s.match(/VF_DATA = '([^']+)'/)[1],'base64'))"
mkdir -p build/web build/win && touch build/.gdignore
"$G" --headless --import --path . >/dev/null 2>&1 || true
# самопроверка без экрана: двор живёт сутки, люди ходят, разговоры открываются; любая ошибка скрипта — провал
timeout 300 "$G" --headless --path . -- --selftest 2>&1 | tee build/selftest.log
grep -q "SELFTEST OK" build/selftest.log && ! grep -q "SCRIPT ERROR\|Parse Error\|ERROR:" build/selftest.log || { echo "самопроверка не прошла"; exit 1; }
[ "$1" = "test" ] && exit 0
"$G" --headless --path . --export-release "Web" build/web/index.html
"$G" --headless --path . --export-release "Windows" build/win/slovo.exe
ls -la build/web/index.wasm build/win/slovo.exe
