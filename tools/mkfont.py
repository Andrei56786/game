#!/usr/bin/env python3
"""Книжный шрифт игры: подмножество PT Serif (ParaType, SIL OFL 1.1) → src/fontdata.js (WOFF в base64).
Имена «PT Serif»/«ParaType» зарезервированы лицензией, поэтому изменённая (урезанная) копия
переименована в «Slovo Serif». Лицензия — fonts/OFL-PT-Serif.txt.
Использование: python3 tools/mkfont.py путь/PT_Serif-Web-Regular.ttf"""
import sys, os, base64, io
from fontTools.ttLib import TTFont
from fontTools import subset
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]
U = [*range(0x20, 0x7F), *range(0xA0, 0x100), *range(0x400, 0x460), *range(0x2010, 0x2028), *range(0x2030, 0x203B),
     0x2116, *range(0x2190, 0x2194), 0x2212, 0x2248, 0x221E, 0x221A, 0x2020, 0x25A0, 0x25B6, 0x25BC, 0x25B8]
f = TTFont(src)
o = subset.Options(); o.flavor = 'woff'; o.layout_features = ['kern', 'liga']; o.hinting = False; o.desubroutinize = True
o.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]; o.notdef_outline = True
s = subset.Subsetter(o); s.populate(unicodes=U); s.subset(f)
NEW = 'Slovo Serif'
for r in f['name'].names:
    if r.nameID in (1, 4, 16): r.string = NEW
    elif r.nameID == 6: r.string = 'SlovoSerif-Regular'
    elif r.nameID == 3: r.string = 'Slovo Serif (subset of PT Serif by ParaType)'
f.flavor = 'woff'; b = io.BytesIO(); f.save(b); data = b.getvalue()
lic = open(os.path.join(ROOT, 'fonts', 'OFL-PT-Serif.txt'), encoding='utf8').read().split('\n')[:3]
js = ("'use strict';\n// ===== FONT DATA: «Slovo Serif» — урезанная копия PT Serif. " + ' '.join(l.strip() for l in lic if l.strip()) +
      " Полный текст лицензии — fonts/OFL-PT-Serif.txt. Собрано tools/mkfont.py =====\n"
      "const VF_DATA = '" + base64.b64encode(data).decode() + "';\n")
open(os.path.join(ROOT, 'src', 'fontdata.js'), 'w', encoding='utf8').write(js)
print('src/fontdata.js:', len(js), 'байт, woff', len(data))
