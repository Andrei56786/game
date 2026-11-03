#!/usr/bin/env python3
"""Сборка «Слово короля» v3: склеивает src/*.js в фиксированном порядке в один HTML.
Восстановлено по выжимке (оригинальный build.py утерян вместе со старой папкой).
Использование: python3 tools/build.py [выходной.html]   (по умолчанию dist/index.html)"""
import os, sys, re, subprocess, tempfile, collections, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf8'))['version']  # версия — в package.json
ORDER = ['engine', 'audio', 'audio2', 'pix', 'art', 'bfig', 'portrait', 'chars', 'courtart', 'yardart', 'art2', 'fauna', 'fauna2', 'worldgen',
         'render', 'state', 'econ', 'army', 'intel', 'ai', 'battle', 'battlesim', 'captains', 'diplo', 'events', 'ui',
         'screens', 'screens2', 'bscreen', 'bdraw', 'tutorial', 'devsheet', 'courtmap', 'court', 'courtui', 'season', 'dialog',
         'council', 'audience', 'dynasty', 'research', 'command', 'screens3', 'econui', 'scene', 'season2', 'castle2', 'projects', 'hunt', 'hunt2', 'hurt', 'feast', 'chapel', 'village', 'folk', 'folktalk', 'folkacts', 'visit', 'visit2', 'visit3', 'help33', 'supply', 'herald', 'march', 'reign', 'reignui', 'sndui', 'main']
# каждый модуль держим меньше ~55 КБ: подключение GitHub принимает не больше 64 КБ за один вызов
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf8').read()
mods = [(n + '.js', rd('src/' + n + '.js')) for n in ORDER]
js = ''.join('\n// ---- %s ----\n%s' % (n, c) for n, c in mods)
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf8') as f:
    f.write('(function(){\n' + js + '\n})();\n')
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
os.unlink(f.name)
if r.returncode: sys.exit('Ошибка синтаксиса:\n' + r.stderr)
decl = collections.Counter(m.group(1) for _, c in mods
                           for m in re.finditer(r'^(?:function\s+(\w+)|(?:const|let|var)\s+(\w+))', c, re.M) for _ in [0]
                           if m.group(1)) + collections.Counter(m.group(1) for _, c in mods
                           for m in re.finditer(r'^(?:const|let|var)\s+(\w+)', c, re.M))
dups = [k for k, v in decl.items() if v > 1]
if dups: print('Внимание, повторные объявления:', ', '.join(sorted(dups)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'index.html')
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf8').write(rd('tools/head.html').replace('{VERSION}', VERSION) + '<script>\n(function(){\n' + js + '\n})();\n</script>' + rd('tools/tail.html'))
print('Собрано:', out, '· v' + VERSION, '·', len(mods), 'модулей ·', sum(c.count('\n') for _, c in mods), 'строк')
