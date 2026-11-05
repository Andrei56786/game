# сборка JSON для push_files: файлы, изменённые с метки gh-synced до HEAD, кусками до ~700 КБ
import json, subprocess, sys, os
msg = sys.argv[1]
lim = int(sys.argv[2]) if len(sys.argv) > 2 else 700000   # предел куска, байт
os.chdir('/data/game')
names = subprocess.check_output(['git', 'diff', '--name-only', '--diff-filter=ACMR', 'gh-synced', 'HEAD'], text=True).split()
gone = subprocess.check_output(['git', 'diff', '--name-only', '--diff-filter=D', 'gh-synced', 'HEAD'], text=True).split()
for f in os.listdir('/data/push'):
    if f.endswith('.json'): os.remove('/data/push/' + f)
chunks, cur, size = [], [], 0
for n in names:
    c = subprocess.check_output(['git', 'show', 'HEAD:' + n]).decode('utf-8')   # как в коммите, не рабочая копия
    if cur and size + len(c.encode()) > lim:
        chunks.append(cur); cur, size = [], 0
    cur.append({'path': n, 'content': c}); size += len(c.encode())
if cur: chunks.append(cur)
for i, ch in enumerate(chunks):
    m = msg if len(chunks) == 1 else f'{msg} ({i + 1}/{len(chunks)})'
    json.dump({'owner': 'Andrei56786', 'repo': 'game', 'branch': 'godot-0.9-castle', 'message': m, 'files': ch}, open(f'/data/push/{i + 1:02d}.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{i + 1:02d}.json', len(ch), 'файлов', sum(len(x["content"].encode()) for x in ch), 'байт')
print('удалено:', gone)
