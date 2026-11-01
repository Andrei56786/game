#!/usr/bin/env python3
"""Готовит отправку коммитов в GitHub через подключение ассистента (инструмент push_files).
  python3 tools/ghpush.py [база [до]] [-m сообщение]  — изменения база..до (база по умолчанию — метка gh-synced, до — HEAD)
  python3 tools/ghpush.py --all [до] [-m сообщение]    — все файлы снимка
Пишет аргументы push_files в /tmp/ghpush/NN.json (каждый ≤ 900 КБ: лимит подключения — 1 МБ на вызов)
и печатает, какие файлы удалить (delete_file). Двоичные и слишком большие файлы пропускает (с предупреждением).
После успешной отправки: git tag -f gh-synced <до>."""
import json, os, shutil, subprocess, sys
OWNER, REPO, BRANCH, LIMIT, OUT = 'Andrei56786', 'game', 'main', 900 * 1024, '/tmp/ghpush'
def git(*a, raw=False):
    r = subprocess.run(['git', *a], capture_output=True, check=True)
    return r.stdout if raw else r.stdout.decode('utf-8')
args, msg = sys.argv[1:], None
if '-m' in args: i = args.index('-m'); msg = args[i + 1]; del args[i:i + 2]
full = '--all' in args; args = [a for a in args if a != '--all']
if full: base, top = None, (args[0] if args else 'HEAD')
else: base, top = (args[0] if args else 'gh-synced'), (args[1] if len(args) > 1 else 'HEAD')
changed, deleted = [], []
if full: changed = [f for f in git('ls-tree', '-r', '--name-only', top).split('\n') if f]
else:
    for l in git('diff', '--name-status', '--no-renames', base, top).split('\n'):
        if l: st, f = l.split('\t', 1); (deleted if st == 'D' else changed).append(f)
if not msg:
    if full: msg = git('log', '--format=%B', '-n', '1', top).strip()
    else:
        subj = [s for s in git('log', '--reverse', '--format=%s', base + '..' + top).split('\n') if s]
        msg = git('log', '--format=%B', '-n', '1', top).strip() if len(subj) == 1 else str(len(subj)) + ' изменений:\n' + '\n'.join('- ' + s for s in subj)
chunks, cur, size, skipped = [], [], 0, []
for f in changed:
    b = git('show', top + ':' + f, raw=True)
    try: s = b.decode('utf-8')
    except UnicodeDecodeError: skipped.append(f + ' (двоичный)'); continue
    n = len(json.dumps({'path': f, 'content': s}, ensure_ascii=False).encode('utf-8'))
    if n > LIMIT: skipped.append(f + ' (%d КБ — слишком большой)' % (n // 1024)); continue
    if cur and size + n > LIMIT: chunks.append(cur); cur, size = [], 0
    cur.append({'path': f, 'content': s}); size += n
if cur: chunks.append(cur)
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
for i, ch in enumerate(chunks):
    m = msg if len(chunks) == 1 else msg.replace('\n', ' (%d/%d)\n' % (i + 1, len(chunks)), 1) if '\n' in msg else msg + ' (%d/%d)' % (i + 1, len(chunks))
    p = os.path.join(OUT, '%02d.json' % (i + 1))
    with open(p, 'w', encoding='utf-8') as fh: json.dump({'owner': OWNER, 'repo': REPO, 'branch': BRANCH, 'message': m, 'files': ch}, fh, ensure_ascii=False)
    print(p, len(ch), 'файлов', os.path.getsize(p) // 1024, 'КБ')
if deleted: print('Удалить (delete_file):', ' '.join(deleted))
if skipped: print('Пропущено:', '; '.join(skipped))
if not chunks and not deleted: print('Отправлять нечего.')
