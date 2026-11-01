'use strict';
// ===== ART: icons, settlements, armies, heraldry, battle figures =====
const ICONS = {
  gold: '.yyy.|yYYYy|yYyYy|yYYYy|.yyy.', men: '.zz..|.zz..|cccc.|.cc..|.c.c.', food: '..b..|.tqt.|tqtqt|.tqt.|..t..',
  fodder: 'q.q.q|.qqq.|qqqqq|.qqq.|..q..', water: '..l..|.lil.|liiil|liiil|.lll.', arrows: 'G.G.G|n.n.n|NNNNN|.NnN.|.NNN.',
  weap: '...G.|..G..|.G...|nG...|n....', bow: '..qq.|.w..q|GGGGq|.w..q|..qq.', xbow: '..q..|..qn.|GGnnn|..qn.|..q..', harch: 'q..nn|.qnnn|qnnn.|n..n.|n..n.', knight: '..rr.|.ggg.|gDgDg|ggggg|.ggg.', horse: '..nn.|.nnnn|nnnn.|n..n.|n..n.', wagon: '.NNN.|NNNNN|nNNNn|.k.k.',
  morale: '.r.r.|rrrrr|rrrrr|.rrr.|..r..', fat: '..y..|.yyy.|yyAyy|.yyy.|..y..', sick: '.f.f.|..f..|fffff|..f..|.f.f.', wound: '.....|.rrr.|rrWrr|.rrr.|.....',
  crown: 'y.y.y|yyyyy|yryry|yyyyy', book: 'nnnnn|nCCCn|nCcCn|nCCCn|nnnnn', scroll: '.CCC.|CPPPC|.CPC.|.CPC.|.CCC.', eye: '.....|.ggg.|gGkGg|.ggg.|.....',
  sword: '....G|...G.|..G..|bG...|.b...', shield: 'uuuuu|uyuyu|uuyuu|.uuu.|..u..', tent: '..n..|.nNn.|nNkNn|nNkNn', fire: '..a..|.aA..|.aAa.|aAyAa|.aaa.',
  hourglass: 'nnnnn|.ccc.|..c..|.c.c.|nnnnn', flag: 'n.....|nrrrr.|nrrrrr|nrrrr.|n.....|n.....', star: '..y..|.yyy.|yyyyy|.yyy.|.y.y.',
  pause: 'ww.ww|ww.ww|ww.ww|ww.ww|ww.ww', play1: 'w....|ww...|www..|ww...|w....', play2: 'w.w..|wwww.|wwwww|wwww.|w.w..', play3: 'w.w.w|wwwww|wwwww|wwwww|w.w.w',
  snd: '..w..|.ww.w|www.w|.ww.w|..w..', mute: '..w..|.ww..|www.r|.ww..|..w..', map: 'f.u.f|fuuuf|uufuu|fuuuf|f.u.f', dip: '.w.w.|wwwww|.www.|..w..|.....',
  close: 'w...w|.w.w.|..w..|.w.w.|w...w', pin: '.rrr.|rrWrr|.rrr.|..r..|..r..', dust: '.....|.s.s.|s.s.s|.sss.|sssss', birds: 'k...k|.k.k.|.....|..k.k|...k.',
  seal: '.rrr.|rRrRr|rrWrr|rRrRr|.rrr.', family: 'zz..z|zz.zz|uu.cc|uuucc|u.u.c', flask: '.ggg.|..g..|.gig.|giiig|.ggg.', castle: 'g.g.g|ggggg|gdgdg|ggggg|gg.gg', moon: '..yy.|.y...|y....|.y...|..yy.', sun: 'y.y.y|.yYy.|yYYYy|.yYy.|y.y.y', quill: '....w|...w.|..w..|.n...|n....', key: '.yy..|y..y.|.yy..|..y..|..yy.', house: 'nrrrn|nrYrn|nrrrn|n.r.n|n...n', talk: 'wwwww|w...w|wwwww|.w...|w....',
  wood: '...nN|..nNn|.nNn.|nNn..|Nn...', ore: '..g..|.gbg.|gdggg|gbgdg|.ggg.', wool: '.w.w.|wwwww|wwWww|wwwww|.w.w.', salt: '..W..|.WwW.|WWwWW|ccccc|.ccc.',
  wine: '.nnn.|..v..|.vvv.|vVvVv|.vvv.', iron: '.....|..ggg|.gGGd|gGGdd|ddd..', cloth: '.uuu.|uUuUu|uuuuu|uUuUu|.uuu.',
  smoke: '..g..|.g...|..g..|.ggg.|..a..', spy: '.kkk.|kkkkk|.zzz.|.kkk.|kk.kk', raven: '..kk.|.kkkk|kkkk.|..k..|.k.k.', coin: '.yy.|yYYy|yYYy|.yy.',
};
function initIcons() { for (const k in ICONS) SPR['i_' + k] = mkSprite(ICONS[k].split('|')); }

// ---------- heraldry ----------
const REALM_DEF = [
  { key: 'K', name: 'Королевство', adj: 'королевский', col: '#3b6fd0', dark: '#22408a', light: '#a8c8ff', charge: 'crown' },
  { key: 'C', name: 'Кланы', adj: 'клановый', col: '#c0353f', dark: '#7a1e2a', light: '#ee9a9a', charge: 'wolf' },
  { key: 'R', name: 'Республика', adj: 'республиканский', col: '#e0a630', dark: '#9a6a10', light: '#f7d980', charge: 'lion' },
  { key: 'T', name: 'Теократия', adj: 'теократический', col: '#8a46b0', dark: '#552a70', light: '#d0a8e8', charge: 'sun' },
  { key: 'E', name: 'Империя', adj: 'имперский', col: '#e8e4dc', dark: '#8a8478', light: '#ffffff', charge: 'eagle' },
  { key: 'F', name: 'Вольные земли', adj: 'вольный', col: '#9a8c74', dark: '#5a5040', light: '#d0c4a8', charge: 'tower' },
  { key: 'B', name: 'Разбойники', adj: 'разбойничий', col: '#3a3430', dark: '#1a1614', light: '#8a8078', charge: 'skull' },
];
const CHARGES = {
  crown: '.......|.y.y.y.|.yyyyy.|.yryry.|.yyyyy.|.......', wolf: '.......|.W...W.|.WWWWW.|..WkW..|..WWW..|...W...',
  lion: '.......|..rr...|.rrrr..|..rrrr.|..r..r.|.......', sun: '...W...|.W.W.W.|..WWW..|WWWyWWW|..WWW..|.W.W.W.',
  eagle: 'k.....k|kk.k.kk|.kkkkk.|..kkk..|..k.k..|.......', tower: '.......|.G.G.G.|.GGGGG.|..GkG..|..GGG..|.......',
  skull: '.......|..WWW..|.WkWkW.|.WWWWW.|..W.W..|.......',
};
function mkShield(ri) {
  const d = REALM_DEF[ri]; const [c, g] = mkCanvas(11, 13);
  const shape = ['.ooooooooo.', 'oFFFFFFFFFo', 'oFFFFFFFFFo', 'oFFFFFFFFFo', 'oFFFFFFFFFo', 'oFFFFFFFFFo', 'oFFFFFFFFFo', 'oFFFFFFFFFo', '.oFFFFFFFo.', '.oFFFFFFFo.', '..oFFFFFo..', '...oFFFo...', '....ooo....'];
  shape.forEach((r, y) => { for (let x = 0; x < 11; x++) { const ch = r[x]; if (ch === '.') continue; g.fillStyle = ch === 'o' ? PAL.o : (y < 2 ? d.light : d.col); g.fillRect(x, y, 1, 1); } });
  g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 1; y < 12; y++) g.fillRect(6, y, 4, 1);
  const ch = CHARGES[d.charge].split('|'); const pal = { y: '#f7d35c', r: d.dark, W: ri === 4 ? '#2a2430' : '#f4ecd8', k: ri === 4 ? '#e8e4dc' : '#1b1420', G: '#c8ccd4' };
  if (ri === 4) { pal.k = '#2a2430'; }
  ch.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const cc = r[x]; if (cc === '.') continue; g.fillStyle = pal[cc] || PAL[cc]; g.fillRect(2 + x, 3 + y, 1, 1); } });
  return c;
}
// ---------- settlements ----------
const CUL_STYLE = {
  K: { roof: ['#a8442e', '#c25a3a'], wall: '#e8dcc0', stone: ['#8a909a', '#a8aeb6', '#c4c8ce'], wood: '#7a5030', spire: '#a8442e' },
  C: { roof: ['#5a4430', '#6e5438'], wall: '#8a6034', stone: ['#6a5a48', '#7e6c56', '#94826a'], wood: '#6a4424', spire: '#4e3a26', turf: '#5a7a3a' },
  R: { roof: ['#c8643a', '#de7a48'], wall: '#f0e0b0', stone: ['#b8a890', '#ccbea4', '#e0d4bc'], wood: '#8a5a34', spire: '#c8643a' },
  T: { roof: ['#5a4a8a', '#6e5ea0'], wall: '#ece8f0', stone: ['#a09cb0', '#b8b4c6', '#d0cddc'], wood: '#6a4a3a', spire: '#e0b040' },
  E: { roof: ['#3e5a8a', '#4e6ea0'], wall: '#f2eee4', stone: ['#b8b4a8', '#d0ccc0', '#e8e4da'], wood: '#7a5a3a', spire: '#e0b040' },
};
function house(g, x, y, w, h, st, rng) {
  const roof = st.roof[rng.i(0, 1)], rh = Math.ceil(w / 2);
  g.fillStyle = PAL.o; g.fillRect(x - 1, y + rh - 1, w + 2, h + 1);
  g.fillStyle = st.wall; g.fillRect(x, y + rh, w, h - 1);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + w - 1, y + rh, 1, h - 1);
  for (let k = 0; k < rh; k++) { g.fillStyle = PAL.o; g.fillRect(x + rh - 1 - k - 1, y + k, (k + 1) * 2 + (w & 1) + 1, 1); g.fillStyle = roof; g.fillRect(x + rh - 1 - k, y + k, (k + 1) * 2 - 1 + (w & 1), 1); }
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 1, y + rh - 1, 1, 1);
  g.fillStyle = '#3a2614'; g.fillRect(x + (w >> 1), y + rh + h - 3, 1, 2);
  if (w >= 5) { g.fillStyle = '#f7d35c'; g.fillRect(x + 1, y + rh + 1, 1, 1); }
}
function tower(g, x, y, w, h, st, roofCol, flagX) {
  g.fillStyle = PAL.o; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = st.stone[1]; g.fillRect(x, y, w, h); g.fillStyle = st.stone[2]; g.fillRect(x, y, 1, h); g.fillStyle = st.stone[0]; g.fillRect(x + w - 1, y, 1, h);
  for (let k = 0; k < w; k += 2) { g.fillStyle = PAL.o; g.fillRect(x + k, y - 2, 1, 1); g.fillStyle = st.stone[1]; g.fillRect(x + k, y - 1, 1, 1); }
  g.fillStyle = '#2a2026'; g.fillRect(x + (w >> 1), y + 2, 1, 2);
  if (roofCol) { const rh = Math.ceil(w / 2) + 1; for (let k = 0; k < rh; k++) { const ww = Math.max(1, Math.round((k + 1) * (w + 2) / rh)); g.fillStyle = PAL.o; g.fillRect(x + ((w - ww) >> 1) - 1, y - rh - 1 + k, ww + 2, 1); g.fillStyle = roofCol; g.fillRect(x + ((w - ww) >> 1), y - rh - 1 + k, ww, 1); } }
}
// returns {c, flags:[[x,y]...], w, h, ax, ay} anchor = bottom center
function mkSettlement(type, cul, v) {
  const st = CUL_STYLE[cul] || CUL_STYLE.K; const rng = mkRng(777 + v * 13 + type.length * 7 + cul.charCodeAt(0));
  const dims = { village: [15, 11], castle: [19, 18], town: [23, 18], capital: [29, 24] }[type];
  const [c, g] = mkCanvas(dims[0], dims[1]); const flags = [];
  const W0 = dims[0], H0 = dims[1];
  if (type === 'village') {
    house(g, 1, 3, 5, 5, st, rng); house(g, 8, 1, 6, 6, st, rng); if (rng.f() < 0.7) house(g, 5, 6, 4, 3, st, rng);
    g.fillStyle = st.wood; for (let x = 0; x < W0; x += 2) g.fillRect(x, H0 - 1, 1, 1);
  } else if (type === 'castle') {
    if (cul === 'C') { // wooden hall + palisade
      g.fillStyle = PAL.o; g.fillRect(0, 8, W0, 10); g.fillStyle = st.wood; g.fillRect(1, 9, W0 - 2, 8);
      for (let x = 1; x < W0 - 1; x += 2) { g.fillStyle = PAL.o; g.fillRect(x, 7, 1, 2); g.fillStyle = '#8a6034'; g.fillRect(x, 8, 1, 1); }
      house(g, 4, 1, 11, 6, { roof: [st.turf, st.turf], wall: '#7a5030' }, rng); flags.push([9, 0]);
      g.fillStyle = '#2a1a10'; g.fillRect(8, 13, 3, 4);
    } else {
      g.fillStyle = PAL.o; g.fillRect(0, 9, W0, 9); g.fillStyle = st.stone[1]; g.fillRect(1, 10, W0 - 2, 7); g.fillStyle = st.stone[2]; g.fillRect(1, 10, W0 - 2, 1);
      for (let x = 1; x < W0 - 1; x += 2) { g.fillStyle = PAL.o; g.fillRect(x, 8, 1, 2); g.fillStyle = st.stone[1]; g.fillRect(x, 9, 1, 1); }
      tower(g, 1, 6, 4, 11, st, cul === 'E' || cul === 'T' ? st.roof[0] : null); tower(g, W0 - 5, 6, 4, 11, st, cul === 'E' || cul === 'T' ? st.roof[0] : null);
      tower(g, 7, 2, 5, 14, st, st.roof[1]); flags.push([9, cul === 'E' || cul === 'T' ? -3 : -3]);
      g.fillStyle = '#2a2026'; g.fillRect(8, 13, 3, 4); g.fillStyle = '#4a3020'; g.fillRect(8, 13, 3, 1);
    }
  } else if (type === 'town') {
    // houses inside wall
    const hs = [[2, 4, 5, 5], [8, 2, 6, 6], [15, 4, 5, 5], [5, 8, 4, 4], [12, 8, 5, 4]];
    for (const [x, y, w, h] of hs) house(g, x, y, w, h, st, rng);
    if (cul === 'R') tower(g, 17, 1, 3, 12, st, st.roof[0]); else if (cul === 'T' || cul === 'K') tower(g, 11, 0, 3, 11, st, st.spire); else if (cul === 'E') { tower(g, 10, 4, 5, 8, st, null); g.fillStyle = PAL.o; g.fillRect(10, 1, 5, 4); g.fillStyle = '#e0b040'; g.fillRect(11, 1, 3, 3); g.fillRect(10, 2, 5, 2); }
    g.fillStyle = PAL.o; g.fillRect(0, 13, W0, 5); g.fillStyle = cul === 'C' ? st.wood : st.stone[1]; g.fillRect(1, 14, W0 - 2, 3); g.fillStyle = cul === 'C' ? '#8a6034' : st.stone[2]; g.fillRect(1, 14, W0 - 2, 1);
    for (let x = 1; x < W0 - 1; x += 2) { g.fillStyle = PAL.o; g.fillRect(x, 12, 1, 2); }
    g.fillStyle = '#2a2026'; g.fillRect(10, 15, 3, 3); flags.push([cul === 'R' ? 18 : 12, cul === 'R' ? -4 : -3]);
  } else {
    const hs = [[1, 10, 5, 5], [22, 10, 6, 5], [6, 13, 4, 4], [19, 13, 4, 4]];
    for (const [x, y, w, h] of hs) house(g, x, y, w, h, st, rng);
    g.fillStyle = PAL.o; g.fillRect(0, 17, W0, 7); g.fillStyle = st.stone[1]; g.fillRect(1, 18, W0 - 2, 5); g.fillStyle = st.stone[2]; g.fillRect(1, 18, W0 - 2, 1);
    for (let x = 1; x < W0 - 1; x += 2) { g.fillStyle = PAL.o; g.fillRect(x, 16, 1, 2); }
    const rc = cul === 'C' ? null : st.roof[0];
    tower(g, 2, 12, 4, 11, st, rc); tower(g, W0 - 6, 12, 4, 11, st, rc);
    tower(g, 8, 6, 5, 16, st, rc); tower(g, 16, 6, 5, 16, st, rc); tower(g, 12, 2, 5, 20, st, st.roof[1]);
    if (cul === 'E' || cul === 'T') { g.fillStyle = PAL.o; g.fillRect(12, -1 + 2, 5, 3); }
    flags.push([14, -3], [10, 1], [18, 1]);
    g.fillStyle = '#2a2026'; g.fillRect(13, 19, 3, 4);
  }
  return { c, flags, w: W0, h: H0 };
}
const SETT_SPR = {};
function settSprite(type, cul, v) { const k = type + cul + (v % 3); if (!SETT_SPR[k]) SETT_SPR[k] = mkSettlement(type, cul, v % 3); return SETT_SPR[k]; }
function drawFlag(x, y, col, dark, t) {
  vline(x, y, 6, PAL.o); const wave = Math.sin(t * 4 + x) > 0 ? 1 : 0;
  rect(x + 1, y, 4, 3, col); rect(x + 1, y + 2, 4, 1, dark); px(x + 5, y + wave, col); px(x + 5, y + 1 + wave, dark);
}
// ---------- army map figures ----------
function mkArmySprites() {
  const S = {};
  // mounted commander (12x12): banner drawn separately
  S.knight = mkSprite([
    '....GG......', '...GGGG.....', '...GzzG.....', '....CC......', '...CCCC.....', '..nCCCCnn...', '.nnnnnnnnn..', 'nnNnnnnnnN..', 'n.nnnnnnn...', '..n.n..n.n..', '..n.n..n.n..', '.kk.k..k.k..',
  ]);
  S.foot = mkSprite(['..G..', '.GGG.', '.zzz.', 'CCCCC', '.CCC.', '.C.C.', '.k.k.']);
  S.bandit = mkSprite(['.kkk.', 'kkkkk', '.zzz.', 'nnnnn', '.nnn.', '.n.n.', '.k.k.']);
  S.wagon = mkSprite(['...CCCCC...', '..CCCCCCC..', '..NNNNNNN..', 'n.NNNNNNN.n', 'nnNNNNNNNnn', '.n.kk.kk...', '...kk.kk...']);
  S.ox = mkSprite(['..nn.', 'nnnnn', 'nnnn.', 'n..n.']);
  S.tent = mkSprite(['....n....', '...nCn...', '..nCCCn..', '.nCCkCCn.', 'nCCCkCCCn', 'nnnnknnnn']);
  S.camp = mkSprite(['..a..', '.aAa.', 'nnynn']);
  for (const k in S) SPR['a_' + k] = S[k];
}
// ---------- battle figures (8x12), tunic color via 'C' replaced at runtime by tint ----------
const FIG = {
  levy: ['...nn...', '..nzzn..', '...zz...', '..CCCC.n', '.zCCCCzn', '..CCCC.n', '..CCCC.n', '..n..n.n', '..n..n..', '.kk..kk.'],
  spear: ['...GG..G', '..GGGG.G', '...zz..G', '..CCCC.G', '.GCCCCzG', '.GCCCC.G', '.GCCCC.G', '..n..n.G', '..n..n..', '.kk..kk.'],
  sword: ['...GG...', '..GgGG..', '..GzzG..', '.GGCCGG.', 'gGCCCCGW', 'gGCCCCGW', '.gGGGG.W', '..g..g..', '..g..g..', '.kk..kk.'],
  archer: ['..nnn...', '.nnzzn..', '...zz.n.', '..CCCCn.', '.zCCCC.n', '..CCCC.n', '..CCCCn.', '..n..nn.', '..n..n..', '.kk..kk.'],
  horse: ['.....GG.....', '....GGGG....', '....GzzG....', '.....CC....G', '....CCCC..G.', '..nnCCCCnG..', '.nnnnnnnnnn.', 'nNnnnnnnnnN.', 'n..nnnnnnn..', '...n.n..n.n.', '...n.n..n.n.', '..kk.k..k.k.'],
};
const FIG_SPR = {};
function figSprite(type, col, dark) {
  const k = type + col; if (FIG_SPR[k]) return FIG_SPR[k];
  const rows = FIG[type]; const pal = { C: col, D: dark };
  FIG_SPR[k] = mkSprite(rows, pal); return FIG_SPR[k];
}
function initArt() {
  initIcons(); mkArmySprites();
  REALM_DEF.forEach((d, i) => { SPR['shield' + i] = mkShield(i); });
}
