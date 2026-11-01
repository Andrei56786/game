#!/usr/bin/env python3
"""Точечные правки: python3 tools/patch.py file <<< JSON [[old, new, count?], ...]. Падает, если фрагмент не найден ровно count раз."""
import sys, json
path = sys.argv[1]; s = open(path, encoding='utf8').read(); edits = json.load(sys.stdin)
for e in edits:
    old, new = e[0], e[1]; cnt = e[2] if len(e) > 2 else 1; n = s.count(old)
    if n != cnt: sys.exit(f'{path}: найдено {n} (ожидалось {cnt}) для: {old[:120]!r}')
    s = s.replace(old, new)
open(path, 'w', encoding='utf8').write(s); print(path, 'ok', len(edits))
