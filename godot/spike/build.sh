#!/bin/sh
# Проба Godot: шрифт из src/fontdata.js → импорт → сборки в веб и Windows (build/web, build/win).
# GODOT — путь к Godot 4.7.2 (шаблоны экспорта — см. notes/plan-v4.md).
set -e
cd "$(dirname "$0")"
G=${GODOT:-/data/tools/godot/Godot_v4.7.2-stable_linux.x86_64}
node -e "const f=require('fs'),s=f.readFileSync('../../src/fontdata.js','utf8');f.writeFileSync('slovo_serif.woff',Buffer.from(s.match(/VF_DATA = '([^']+)'/)[1],'base64'))"
mkdir -p build/web build/win && touch build/.gdignore
"$G" --headless --import --path . >/dev/null 2>&1 || true
"$G" --headless --path . --export-release "Web" build/web/index.html
"$G" --headless --path . --export-release "Windows" build/win/slovo.exe
ls -la build/web/index.wasm build/win/slovo.exe
