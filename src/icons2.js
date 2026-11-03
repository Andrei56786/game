'use strict';
// ===== ICONS2 (v3.6): sharp drawn icons for the book-font mode =====
// With the book font the canvas has RS = 2–3 device pixels per game pixel, and the 5×5 pixel icons became coarse
// blocks. Every i_* icon also has a drawing here, in a box of 4 units per game pixel (20×20 for a 5×5 icon);
// spr() renders it at the real device scale (cached) in the same place and size. The pixel font (RS = 1) keeps the
// pixel icons. A drawing is a list of items joined by ';':
//   <colour>[flags] <shape>[ & <shape>…][ @ tx ty [deg [sx [sy]]]]…
//   colour: a PAL key or #hex. flags: - no outline, + its own outline (a part lying over others), % even-odd, = dashed.
//   shapes: c x y r · e x y rx ry [deg] · r x y w h [rad] · p x y x y… (polygon) · l W x y x y… (line W wide) ·
//           a W x y r deg0 deg1 (arc) · s W <svg path> (stroked) · * x y R r n [deg] (star) · w x y r amp n (wavy disc) ·
//           <svg path starting with M> (filled). A dark outline of the whole drawing goes under it.
Object.assign(ICONS, {
  build: '.ggg.|.ggg.|..n..|..n..|..n..', cloud: '.....|.ww..|wwwww|wwwww|.....', rain: '.ww..|wwww.|.....|l.l.l|.l.l.',
  storm: '.ggg.|ggggg|.....|l.l.l|l.l.l', snow: '.ww..|wwww.|.....|W.W.W|.W.W.', blizz: 'l.l..|.l...|l.l..|..sss|sss..',
  fog: 'sss..|.....|.ssss|.....|ssss.', heat: '..y..|.yyy.|..y..|a.a.a|.a.a.', wind: 'ssss.|....s|sss..|.....|ssss.',
});
const icItems = d => d.split(';').map(s => s.trim()).filter(Boolean);
const icT = (d, t) => icItems(d).map(s => s + ' @ ' + t).join(';');                    // move a whole drawing
const icF = (d, f) => icItems(d).map(s => /^(#\w+|\S)-/.test(s) ? s : s.replace(/^(#\w+|\S)/, '$1' + f)).join(';');
const icN = v => +v.toFixed(2);
const icRays = (x, y, r0, r1, n, w, col, a0) => { const s = []; for (let i = 0; i < n; i++) { const a = (a0 + i * 360 / n) * Math.PI / 180, c = Math.cos(a), d = Math.sin(a); s.push(col + ' l ' + w + ' ' + icN(x + c * r0) + ' ' + icN(y + d * r0) + ' ' + icN(x + c * r1) + ' ' + icN(y + d * r1)); } return s.join(';'); };
const icFlake = (x, y, R, w, col) => { const s = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2, bx = x + Math.cos(a) * R * 0.55, by = y + Math.sin(a) * R * 0.55;
  s.push(col + ' l ' + w + ' ' + x + ' ' + y + ' ' + icN(x + Math.cos(a) * R) + ' ' + icN(y + Math.sin(a) * R));
  for (const d of [-0.8, 0.8]) s.push(col + ' l ' + icN(w * 0.85) + ' ' + icN(bx) + ' ' + icN(by) + ' ' + icN(bx + Math.cos(a + d) * R * 0.38) + ' ' + icN(by + Math.sin(a + d) * R * 0.38)); }
  return s.join(';'); };
const IC_SWORD = 'G p -1.3 4 -1.3 -7 0 -10 1.3 -7 1.3 4;g- l 0.6 0 2.6 0 -7;Y+ r -4.2 3.8 8.4 1.8 0.9;n r -0.85 5.6 1.7 3.4;Y c 0 9.9 1.4';
const IC_DROP = 'M 10 1 C 10 1 3.6 8.8 3.6 13 C 3.6 16.6 6.5 19.2 10 19.2 C 13.5 19.2 16.4 16.6 16.4 13 C 16.4 8.8 10 1 10 1 Z';
const IC_DROPB = 'M 3.6 13 C 3.6 16.6 6.5 19.2 10 19.2 C 13.5 19.2 16.4 16.6 16.4 13 C 15 16 12.6 17.4 10 17.4 C 7.4 17.4 5 16 3.6 13 Z';
const IC_HORSE = 'N M 16.6 19.6 L 16.9 11.5 C 16.9 7.5 15.2 4.8 12.8 3.4 L 13.4 0.8 L 11 2.8 C 8.5 2.8 6.1 4.2 4.4 7.4 L 2 12 C 1.5 13.3 2.2 14.6 3.4 14.6 L 6.2 14.6 C 7.4 14.6 8.2 13.8 8.8 12.8 C 10 14.6 10.2 17 9.8 19.6 Z;n M 16.9 11.5 C 17.4 8 16 5 13.6 3.6 C 15.8 3.6 18 5 19 8.5 C 19.6 11 19 15.5 18.6 19.6 L 16.6 19.6 Z;k- c 9.4 6.9 0.9;n- c 3.6 13 0.6';
const IC_CLOUD = 'M 4.6 16 C 2.2 16 0.8 14.4 0.8 12.4 C 0.8 10.4 2.4 8.9 4.4 8.9 C 4.9 5.9 7.3 4 10 4 C 12.8 4 15 5.8 15.6 8.4 C 17.8 8.6 19.2 10.3 19.2 12.3 C 19.2 14.5 17.6 16 15.4 16 Z';
const IC_CLOUDB = 'M 1.2 13.6 C 2 15.2 3.4 16 4.6 16 L 15.4 16 C 17 16 18.4 15.2 19 13.8 C 14 15 6 15 1.2 13.6 Z';
const IC_GULL = 'S M 1 6.2 C 3 3.8 5.2 4 6.6 6.8 C 8 4 10.2 3.8 12.2 6.2 C 10.2 5.4 8.2 6 6.6 8.2 C 5 6 3 5.4 1 6.2 Z';
const icAst = (x, y, R, col) => [0, 60, 120].map(d => { const a = d * Math.PI / 180, c = Math.cos(a) * R, e = Math.sin(a) * R; return col + ' l 0.9 ' + icN(x - c) + ' ' + icN(y - e) + ' ' + icN(x + c) + ' ' + icN(y + e); }).join(';');
const IC_SPK = 'w M 2 7 L 6 7 L 11 2.6 L 11 17.4 L 6 13 L 2 13 Z';
const HI = {
  gold: 'Y c 10 10 8.8;y- c 10 10 7.1;Y- l 1.5 10 6.4 10 13.6;Y- l 1.5 6.4 10 13.6 10;A- a 1.3 10 10 5.6 200 255',
  coin: 'Y c 8 8 7.2;y- c 8 8 5.7;Y- l 1.2 8 5.3 8 10.7;Y- l 1.2 5.3 8 10.7 8;A- a 1.1 8 8 4.4 200 255',
  men: 'u M 2.5 20 C 2.5 15 5.5 12.8 10 12.8 C 14.5 12.8 17.5 15 17.5 20 Z;U- l 1 10 13.4 10 19.6;z c 10 9.4 3.9;g M 5.6 8.8 C 5.6 4.8 7.6 2.2 10 2.2 C 12.4 2.2 14.4 4.8 14.4 8.8 Z;g r 4.2 7.8 11.6 1.9 0.9;G- e 8.2 5 1 1.6 25',
  food: 'y e 7.2 3.8 1.3 2.6 -25;y e 10 2.9 1.3 2.8 0;y e 12.8 3.8 1.3 2.6 25;B M 4.2 19.2 C 2.4 19.2 1.8 17.2 2.3 14.8 C 3 11.3 5.3 8.8 7.6 7.8 L 12.4 7.8 C 14.7 8.8 17 11.3 17.7 14.8 C 18.2 17.2 17.6 19.2 15.8 19.2 Z;K- e 7 13.6 1.9 3.2 20;B M 7.6 7.6 L 5.8 5.2 L 14.2 5.2 L 12.4 7.6 Z;n r 6.6 6.8 6.8 2 1',
  fodder: 'n l 1.6 10 5 10 0.8;q M 1.5 19 C 1.5 11.5 5 4.5 10 4.5 C 15 4.5 18.5 11.5 18.5 19 Z;Q- s 0.9 M 4.8 18 C 5 13 6.8 9.5 8.8 7.2;Q- s 0.9 M 10 18.5 C 10 13.5 10.2 9.5 10.6 6.5;Q- s 0.9 M 15.2 18 C 15 13.5 13.8 10 12.4 7.6;Q- s 1.2 M 2.4 14.6 C 7 13 13 13 17.6 14.6;t- e 7.4 8.8 2.2 1.2 -40',
  water: 'i ' + IC_DROP + ';I- ' + IC_DROPB + ';l- s 1.4 M 6.6 13.6 C 6.6 11.6 7.4 10 8.5 8.6',
  wound: 'r ' + IC_DROP + ';R- ' + IC_DROPB + ';p- s 1.4 M 6.6 13.6 C 6.6 11.6 7.4 10 8.5 8.6',
  arrows: 'N l 1.1 8.6 11 5.2 3.2;N l 1.1 10 11 10 2.4;N l 1.1 11.4 11 14.8 3.2;w e 5 2.8 1.3 2.4 -25;r e 10 2.1 1.3 2.4 0;w e 15 2.8 1.3 2.4 25;n M 5.8 9 L 14.2 9 L 13.2 19.6 L 6.8 19.6 Z;N- r 6.2 10.4 7.6 1.4;N- r 6.7 16.8 6.6 1.3',
  sword: icT(IC_SWORD, '10 10 45'),
  weap: icT(IC_SWORD, '10 10 45') + ';' + icF(icT(IC_SWORD, '10 10 -45'), '+'),
  bow: 'N s 2.1 M 7 1.6 C 16.5 4.5 16.5 15.5 7 18.4;w- l 0.7 7 1.6 3.8 10 7 18.4;n l 1.1 3.4 10 16 10;G p 15 7.8 19.4 10 15 12.2;r p 1.4 8 4.6 10 1.4 12;n r 13.1 8.5 2 3 0.6',
  xbow: 'n l 2.6 10 5 10 19;N- l 0.9 9.5 6.5 9.5 17.5;g s 1.9 M 1.5 9.5 C 3.5 5.5 6.5 4.6 10 4.6 C 13.5 4.6 16.5 5.5 18.5 9.5;w- l 0.7 1.6 9.5 10 12.2 18.4 9.5;G l 1.1 10 12 10 3;G p 8.4 3.6 10 0.4 11.6 3.6',
  horse: IC_HORSE,
  harch: 'N s 1.8 M 5.6 1.4 C -0.4 5.4 -0.4 13.6 5.6 17.6;w- l 0.6 5.6 1.4 5.6 17.6;' + icT(IC_HORSE, '4 3 0 0.84'),
  knight: 'r M 10 5 C 8.4 3 9 0.8 11.6 0.5 C 13.6 0.3 15.2 1.2 15.8 2.6 C 14 2 12.4 2.6 12 5 Z;g M 3.6 7.6 C 3.6 5.2 6.4 4.2 10 4.2 C 13.6 4.2 16.4 5.2 16.4 7.6 L 16.4 15.6 C 16.4 18 13.8 19.6 10 19.6 C 6.2 19.6 3.6 18 3.6 15.6 Z;G- l 1.2 5.5 8 5.5 15.6;d- l 1.3 10 4.8 10 9;k- r 4.2 9.4 11.6 1.9 0.6;d- l 1.3 10 11.4 10 19;k- c 7.2 14.6 0.6;k- c 7.2 16.8 0.6;k- c 12.8 14.6 0.6;k- c 12.8 16.8 0.6',
  wagon: 'w M 2.6 11.2 C 2.6 5.6 5.4 3 10 3 C 14.6 3 17.4 5.6 17.4 11.2 Z;K- s 0.9 M 7 11 C 6.4 7.6 7.2 4.8 8.4 3.3;K- s 0.9 M 13 11 C 13.6 7.6 12.8 4.8 11.6 3.3;n r 1.2 10.6 17.6 3.6 0.6;N- r 1.8 11.1 16.4 1;L+ c 5.2 16.2 3.1;N- c 5.2 16.2 1.1;L+ c 14.8 16.2 3.1;N- c 14.8 16.2 1.1',
  morale: 'r M 10 18.6 C 4 14 1.4 10.6 1.4 6.8 C 1.4 3.8 3.8 1.8 6.3 1.8 C 8 1.8 9.3 2.8 10 4.2 C 10.7 2.8 12 1.8 13.7 1.8 C 16.2 1.8 18.6 3.8 18.6 6.8 C 18.6 10.6 16 14 10 18.6 Z;R- M 10 18.6 C 16 14 18.6 10.6 18.6 6.8 C 18.6 6 18.4 5.3 18.1 4.7 C 17.6 9.8 14.6 13.4 10 16.6 Z;p- e 5.8 6 1.9 1.3 -40',
  fat: 'l l 1.7 9.6 3 17.4 3 9.6 11 17.4 11;l l 1.4 2.6 11.2 8.2 11.2 2.6 17.2 8.2 17.2',
  sick: '#b5d48c c 10 10.6 8.4;#8fb46a- M 18.4 10.6 A 8.4 8.4 0 0 1 4.2 16.6 C 9 18 15 16 18.4 10.6 Z;k- l 1.3 5.8 8.8 8.4 9.2;k- l 1.3 14.2 8.8 11.6 9.2;k- s 1.2 M 5.9 14 C 6.9 12.8 7.9 12.8 8.9 14 C 9.9 15.2 10.9 15.2 11.9 14 C 12.9 12.8 13.9 12.8 14.6 13.6;l M 16.4 0.6 C 16.4 0.6 14.4 3.6 14.4 4.9 C 14.4 6.1 15.3 6.8 16.4 6.8 C 17.5 6.8 18.4 6.1 18.4 4.9 C 18.4 3.6 16.4 0.6 16.4 0.6 Z',
  crown: 'y c 2 5.6 1.5;y c 10 2.6 1.6;y c 18 5.6 1.5;y M 2 6 L 6 9.6 L 10 3 L 14 9.6 L 18 6 L 16.6 12.4 L 3.4 12.4 Z;y r 3 11.6 14 3.6 0.6;Y- l 0.8 3.6 11.8 16.4 11.8;r- c 10 13.4 1.2;u- c 6 13.4 0.95;u- c 14 13.4 0.95;A- l 0.8 5 8.6 4 11',
  book: 'C r 4.4 2.8 13.4 16.4 1;B- l 0.6 17.2 4.4 17.2 17.6;R r 2.4 1.4 13.4 16.4 1.2;j- r 2.4 1.4 2.2 16.4 0.8;y- l 0.9 5.4 3.4 14.2 3.4;y- l 0.9 5.4 15.4 14.2 15.4;y- p 9.8 5.6 12.8 9.4 9.8 13.2 6.8 9.4;R- p 9.8 7.6 11.2 9.4 9.8 11.2 8.4 9.4',
  chron: 'n M 1 20.4 L 1 5 C 5 3.4 10 3.4 14 5.4 C 18 3.4 23 3.4 27 5 L 27 20.4 C 23 19 18 19 14 21 C 10 19 5 19 1 20.4 Z;C M 2.6 18.6 L 2.6 4.4 C 6 3 10 3 13.6 5 L 13.6 19.4 C 10 17.6 6 17.6 2.6 18.6 Z;C M 25.4 18.6 L 25.4 4.4 C 22 3 18 3 14.4 5 L 14.4 19.4 C 18 17.6 22 17.6 25.4 18.6 Z;H- l 0.9 5 7.4 11.4 7.8;H- l 0.9 5 10.4 11.4 10.8;H- l 0.9 5 13.4 11.4 13.8;H- l 0.9 16.6 7.8 23 7.4;H- l 0.9 16.6 10.8 23 10.4;H- l 0.9 16.6 13.8 21 13.6;K- l 0.8 14 5.4 14 19.6',
  scroll: 'C r 4.4 3.4 11.2 13.2;H- l 0.9 6.8 7 13.2 7;H- l 0.9 6.8 9.6 13.2 9.6;H- l 0.9 6.8 12.2 11.4 12.2;P r 2.6 1.2 14.8 3.6 1.8;B- e 3.2 3 0.8 1.4;P r 2.6 15.2 14.8 3.6 1.8;B- e 16.8 17 0.8 1.4',
  eye: 'w M 1 10 C 4 4.4 16 4.4 19 10 C 16 15.6 4 15.6 1 10 Z;u- c 10 10 3.8;k- c 10 10 1.8;W- c 11.4 8.6 0.9',
  shield: 'y M 2.4 1.8 L 17.6 1.8 L 17.6 8.8 C 17.6 14 14 17.2 10 19.2 C 6 17.2 2.4 14 2.4 8.8 Z;u- M 4 3.4 L 16 3.4 L 16 8.8 C 16 13 13.2 15.6 10 17.4 C 6.8 15.6 4 13 4 8.8 Z;y- r 8.9 3.4 2.2 13.6;y- r 4 7.6 12 2.2',
  tent: 'n l 0.9 10 3.6 10 0.6;r p 10.4 0.4 14.2 1.4 10.4 2.6;w M 10 3 L 18.8 15.2 L 1.2 15.2 Z;r- p 10 3 4.6 15.2 7.8 15.2;r- p 10 3 12.2 15.2 15.4 15.2;k- p 10 8.4 7.8 15.2 12.2 15.2',
  fire: 'a M 10 19 C 4.5 19 2.5 15 3.5 11 C 4.5 7.5 7 6.5 7 2.6 C 9.6 4.4 10.6 7 10 9.2 C 11.6 8 12.2 6 11.6 3.4 C 15.6 6 17.2 10 16.6 13.6 C 16 17 13.6 19 10 19 Z;y- M 10 18.4 C 7 18.4 5.6 16.2 6.2 13.6 C 6.8 11.6 8.6 10.6 9.2 8.6 C 10.8 10.2 11.6 11.4 11.8 10 C 13.8 12 14.4 15 13.4 16.8 C 12.8 17.8 11.6 18.4 10 18.4 Z;A- M 10 18.2 C 8.4 18.2 7.6 17 8 15.6 C 8.4 14.4 9.4 13.8 9.8 12.6 C 10.8 13.6 11.4 14.4 11.6 13.6 C 12.6 15 12.6 16.6 12 17.4 C 11.6 17.9 10.9 18.2 10 18.2 Z',
  hourglass: 'E M 5 3.8 L 15 3.8 C 15 7.5 11 8.5 11 10 C 11 11.5 15 12.5 15 16.2 L 5 16.2 C 5 12.5 9 11.5 9 10 C 9 8.5 5 7.5 5 3.8 Z;q- M 6.8 6 L 13.2 6 C 12.5 7.5 10.6 8.3 10 9.6 C 9.4 8.3 7.5 7.5 6.8 6 Z;q- M 6 16.2 C 7 14 9 13.2 10 13 C 11 13.2 13 14 14 16.2 Z;q- l 0.6 10 9.6 10 13.2;n l 1 4.2 3.4 4.2 16.6;n l 1 15.8 3.4 15.8 16.6;n r 2.8 1.2 14.4 2.6 1;n r 2.8 16.2 14.4 2.6 1',
  flag: 'n l 1.6 3 2.4 3 23.2;y c 3 2 1.5;r M 3.8 3.2 C 8 1.6 11 4.6 15 3.6 C 18 2.8 19.6 2.2 21.6 3 L 21.6 13.2 C 19.6 12.4 18 13 15 13.8 C 11 14.8 8 11.8 3.8 13.2 Z;R- M 11 3.9 C 12.5 4.6 13.8 4.1 15 3.6 L 15 13.8 C 13.8 14.1 12.5 14.6 11 13.8 Z',
  star: 'y * 10 10.8 9.8 4 5;A- c 8.4 8.6 1.2',
  pause: 'w r 4 3 4.2 14 1;w r 11.8 3 4.2 14 1',
  play1: 'w M 6 3 L 16.4 10 L 6 17 Z',
  play2: 'w M 2 4 L 10 10 L 2 16 Z;w M 10 4 L 18 10 L 10 16 Z',
  play3: 'w M 0.6 5 L 7 10 L 0.6 15 Z;w M 6.8 5 L 13.2 10 L 6.8 15 Z;w M 13 5 L 19.4 10 L 13 15 Z',
  snd: IC_SPK + ';w s 1.6 M 13.6 6.6 C 15 8.6 15 11.4 13.6 13.4;w s 1.6 M 16 4 C 19 7.6 19 12.4 16 16',
  mute: IC_SPK + ';r l 1.8 13.6 7 18.6 13;r l 1.8 18.6 7 13.6 13',
  map: 'C M 1.4 4.2 L 7 2.2 L 13 4.2 L 18.6 2.2 L 18.6 16 L 13 18 L 7 16 L 1.4 18 Z;P- M 7 2.2 L 13 4.2 L 13 18 L 7 16 Z;h- e 4.4 8.4 1.8 2.6 15;h- e 15.6 13 1.8 2.4 -10;r-= s 1 M 3.6 14.8 C 6 13.2 7.6 13.4 9.6 10.8 C 11 9 12.6 8.8 14.6 7.8;r- l 1.2 14 5 16.8 7.8;r- l 1.2 16.8 5 14 7.8',
  dip: 'u r 0.4 6.8 4.8 7.8 1;U- l 1 4.4 7.2 4.4 14.2;r r 14.8 6.8 4.8 7.8 1;R- l 1 15.6 7.2 15.6 14.2;F M 15.2 8.4 L 8 8.6 C 6.4 8.6 5.6 10 6 11.4 L 6.6 13.6 C 7 14.6 8 15 9 14.8 L 15.2 14 Z;z+ M 4.8 7.4 C 7.6 6.2 11 6 13.6 7 C 14.6 7.4 15 8.4 14.6 9.4 L 14.4 13.4 C 14.2 14.4 13 14.6 12.4 13.8 L 12 12.4 L 11.6 13.8 C 11.2 14.8 10 14.8 9.6 13.8 L 9.2 12.2 L 8.6 13.4 C 8.2 14.2 7.2 14.2 6.8 13.2 L 6.6 10.8 L 4.8 11.2 Z;Z- s 0.7 M 9.3 9.6 L 9.3 12.2;Z- s 0.7 M 11.9 9.6 L 11.9 12.4;Z- s 0.7 M 6.6 9.2 C 8 8.6 9.6 8.4 11 8.6',
  close: 'w l 2.6 4 4 16 16;w l 2.6 16 4 4 16',
  pin: 'r M 10 19.4 C 10 19.4 3.6 11.8 3.6 7.6 C 3.6 4 6.4 1.2 10 1.2 C 13.6 1.2 16.4 4 16.4 7.6 C 16.4 11.8 10 19.4 10 19.4 Z;W- c 10 7.6 2.5;p- a 1 10 7.6 5 200 250',
  dust: 's M 2.4 18.4 C 0.6 18.4 0.4 15.4 2.6 14.8 C 2.8 12.4 5.6 11.4 7.2 12.8 C 7.8 10.4 11.2 9.8 12.6 11.8 C 14.2 10.6 17.6 11.2 17.6 14.2 C 19.6 14.8 19.6 18.4 17.4 18.4 Z;S- M 0.9 16.6 C 6 17.6 14 17.6 19.2 16.6 C 19.2 17.6 18.6 18.4 17.4 18.4 L 2.4 18.4 C 1.5 18.4 0.9 17.6 0.9 16.6 Z;s c 6 7.6 2;s c 11.4 5.4 1.6;s c 16 8 1.2',
  birds: icT(IC_GULL, '0 0') + ';' + icT(IC_GULL, '7.4 7 0 0.8'),
  seal: 'r w 10 10 8 0.6 9;R- a 1.1 10 10 5 0 360;R- M 7.4 12 L 7.4 8.6 L 8.7 9.9 L 10 8 L 11.3 9.9 L 12.6 8.6 L 12.6 12 Z;p- a 1 10 10 6.6 200 250',
  family: 'u M 1.8 19.6 C 1.8 13.6 4 10.8 7.2 10.8 C 10.4 10.8 12.6 13.6 12.6 19.6 Z;z c 7.2 6.9 3.4;y M 4 4.8 L 4 1.4 L 5.6 2.8 L 7.2 0.8 L 8.8 2.8 L 10.4 1.4 L 10.4 4.8 Z;r+ M 10 19.6 C 10 15.6 11.8 13.4 14.6 13.4 C 17.4 13.4 19 15.6 19 19.6 Z;z+ c 14.6 10.4 2.7',
  flask: 'E M 8 2.4 L 12 2.4 L 12 7.2 C 15.5 8.2 18 10.8 18 14 C 18 17.5 14.5 19.6 10 19.6 C 5.5 19.6 2 17.5 2 14 C 2 10.8 4.5 8.2 8 7.2 Z;i- M 2.4 13.4 C 5 12.4 7 14 10 13.4 C 13 12.8 15 12.4 17.6 13.4 C 17.9 17 14.5 19.1 10 19.1 C 5.5 19.1 2.1 17 2.4 13.4 Z;W- e 5.8 11.4 1 1.8 35;l- c 8.8 16 0.8;l- c 12.2 15.4 0.6;n r 7.4 0.6 5.2 2.4 0.8',
  castle: 'g M 1.5 19.5 L 1.5 2.5 L 3.5 2.5 L 3.5 4.4 L 5.5 4.4 L 5.5 2.5 L 7.5 2.5 L 7.5 8.4 L 9 8.4 L 9 6.8 L 11 6.8 L 11 8.4 L 12.5 8.4 L 12.5 2.5 L 14.5 2.5 L 14.5 4.4 L 16.5 4.4 L 16.5 2.5 L 18.5 2.5 L 18.5 19.5 Z;D- M 7.8 19.5 L 7.8 14.6 C 7.8 13 8.8 12 10 12 C 11.2 12 12.2 13 12.2 14.6 L 12.2 19.5 Z;D- r 3.8 8 1.4 2.6 0.6;D- r 14.8 8 1.4 2.6 0.6;G- l 0.8 2.4 5.6 2.4 18.6',
  moon: 'A M 10.71 1.53 A 8.5 8.5 0 1 0 16.76 15.15 A 7.5 7.5 0 0 1 10.71 1.53 Z',
  sun: icRays(10, 10, 6.8, 9.6, 8, 1.6, 'Y', 0) + ';y c 10 10 5.2;A- c 8.4 8.4 1.5',
  quill: 'w M 26.6 1.4 C 20 2.4 12.6 7 8 14 C 7 15.6 6.6 17 6.2 18.6 L 9.4 21.6 C 11 21 12.6 20.2 14 19 C 20.6 13.6 25 7 26.6 1.4 Z;K- s 0.9 M 25 3.4 C 19 8.6 13 14 7.6 20;K- s 0.6 M 20.4 5.4 L 22 8;K- s 0.6 M 16 8.8 L 18.2 11.4;K- s 0.6 M 12.2 12.6 L 14.2 15;n l 1.6 7.6 20 2.8 25.2;k p 2.8 25.2 0.8 27.4 3.6 25.8',
  key: 'y% c 5.6 10 4.4 & c 5.6 10 2;y r 9.4 8.8 10 2.4 0.6;y r 15 11 1.8 3.4;y r 17.6 11 1.8 2.6;A- l 0.7 10.4 9.5 18.6 9.5',
  house: 'n r 13.4 3 2.4 5;C r 3.4 9 13.2 10.4;r+ M 1 10.4 L 10 2 L 19 10.4 Z;n- r 8.3 13.4 3.4 6;y- r 4.8 11.8 2.4 2.4;y- r 12.8 11.8 2.4 2.4',
  talk: 'w M 3 2 L 17 2 C 18.4 2 19 3 19 4.2 L 19 11.8 C 19 13 18.4 14 17 14 L 9 14 L 4 18.6 L 5 14 L 3 14 C 1.6 14 1 13 1 11.8 L 1 4.2 C 1 3 1.6 2 3 2 Z;k- c 6 8 1.1;k- c 10 8 1.1;k- c 14 8 1.1',
  wood: 'n c 5.8 14 4.6;q- c 5.8 14 3.4;Q- a 0.7 5.8 14 1.9 0 360;Q- c 5.8 14 0.6;n+ c 14.2 14 4.6;q- c 14.2 14 3.4;Q- a 0.7 14.2 14 1.9 0 360;Q- c 14.2 14 0.6;n+ c 10 6.4 4.6;q- c 10 6.4 3.4;Q- a 0.7 10 6.4 1.9 0 360;Q- c 10 6.4 0.6',
  build: 'N r -1.1 -3 2.2 13.6 1 @ 10.6 10.6 -45;g r -5.6 -7.6 11.2 4.8 0.8 @ 10.6 10.6 -45;G- r -4.8 -7.2 9.6 1.2 0.5 @ 10.6 10.6 -45;d- r 3.4 -7.6 2.2 4.8 0.6 @ 10.6 10.6 -45',
  ore: 'g M 2 17 L 3.4 9.6 L 8 5 L 13.6 4.4 L 17.6 8.6 L 18.6 15 L 15 18.6 L 5 18.6 Z;d- M 8 5 L 10 10.6 L 3.4 9.6 Z;d- M 18.6 15 L 13 13 L 15 18.6 Z;G- M 8 5 L 13.6 4.4 L 10 10.6 Z;b- p 9.4 12 11.8 11.2 12.4 13.4 10 14.2;b- c 15 10.4 1.1;b- c 6 14.6 1;y- c 10.6 12.4 0.5',
  wool: 'x l 1.6 6.4 13 6.4 18.8;x l 1.6 9.4 14 9.4 19;x l 1.6 13.2 14 13.2 19;x l 1.6 16 13 16 18.8;J c 8.6 8.4 3.8;J c 12.6 7.4 4;J c 15.8 10 3.4;J c 12.4 12.4 3.8;J c 8 12.2 3.6;K- s 0.9 M 9 11.4 C 10 12.4 11.4 12.6 12.4 11.8;K- s 0.9 M 12.8 8.4 C 13.8 9.2 14.8 9.2 15.6 8.6;x+ e 4.2 9.4 2.6 3.4 25;x e 5.6 5.8 1.8 0.9 -35;W- c 3.4 8.8 0.6',
  salt: 'W M 3.4 11.4 C 4.4 6.4 7.4 3.8 10 3.8 C 12.6 3.8 15.6 6.4 16.6 11.4 Z;E- c 8 8.2 0.7;E- c 11.6 6.6 0.6;E- c 12.8 9.6 0.7;N M 1.4 11 L 18.6 11 C 18.2 15.6 14.6 18.6 10 18.6 C 5.4 18.6 1.8 15.6 1.4 11 Z;n- s 0.8 M 3 13.4 C 7 15 13 15 17 13.4',
  wine: 'n l 1.1 10 5.4 9.2 1;h M 10 4.6 C 11.6 1.6 15.6 0.8 18.4 2.4 C 16.6 5 13.4 5.8 10 4.6 Z;v c 5.8 7.8 2.6;v+ c 14.2 7.8 2.6;v+ c 10 7.8 2.6;v+ c 7.9 11.8 2.6;v+ c 12.1 11.8 2.6;v+ c 10 15.8 2.6;#b07ad0- c 9.2 7 0.8;#b07ad0- c 7.1 11 0.8;#b07ad0- c 11.3 11 0.8;#b07ad0- c 9.2 15 0.8;#b07ad0- c 5 7 0.8;#b07ad0- c 13.4 7 0.8',
  iron: 'g p 1.4 18.6 18.6 18.6 16.6 13.4 3.4 13.4;G p 3.4 13.4 16.6 13.4 15.2 11.8 4.8 11.8;g+ p 4.6 11.8 15.4 11.8 13.8 7.2 6.2 7.2;G p 6.2 7.2 13.8 7.2 12.6 5.6 7.4 5.6;d- p 16.6 13.4 18.6 18.6 17 18.6 15.4 14.4;d- p 13.8 7.2 15.4 11.8 14 11.8 12.9 8.2',
  cloth: 'r r 1.6 12.6 16.8 6.4 2.2;p- l 1 3.6 14.2 16.4 14.2;R- l 0.9 3.6 17.6 16.4 17.6;u+ r 2.6 6.6 14.8 6.6 2.2;l- l 1 4.6 8.2 15.4 8.2;U- l 0.9 4.6 11.6 15.4 11.6;h+ r 4 1.2 12 5.8 2;#a8d878- l 1 6 2.8 14 2.8;e- l 0.9 6 5.8 14 5.8',
  smoke: 'n l 1.4 5.4 19.4 12.6 17.6;n l 1.4 5.4 17.6 12.6 19.4;a M 9 18.6 C 7.4 18.6 6.8 17.4 7.3 16.2 C 7.8 15.2 8.8 14.6 9 13.2 C 10.4 14.2 11.2 15.6 10.9 16.8 C 10.7 17.8 10 18.6 9 18.6 Z;A- c 9 17.2 0.9;g M 9.6 13.4 C 8.4 12.2 9 10.4 10.4 10 C 9.6 8 11 6 13 6.4 C 12.6 4 14.6 2 16.8 2.8 C 18.8 3.6 19.2 6 17.8 7.2 C 18.6 9 17.2 10.6 15.4 10.2 C 14.8 11.8 13 12.4 11.8 11.6 C 11.4 12.8 10.6 13.6 9.6 13.4 Z;G- s 0.9 M 11.6 7.8 C 12 6.8 13 6.4 13.8 6.8;G- s 0.9 M 14.8 4.6 C 15.4 3.8 16.4 3.6 17.2 4',
  spy: 'x M 2.6 19.6 C 3 13 4.6 3.6 10 2 C 15.4 3.6 17 13 17.4 19.6 Z;k- M 6.4 10.2 C 6.4 6.8 8 5.2 10 5.2 C 12 5.2 13.6 6.8 13.6 10.2 C 13.6 12.6 12 14.2 10 14.2 C 8 14.2 6.4 12.6 6.4 10.2 Z;y- c 8.6 9.8 0.85;y- c 11.4 9.8 0.85;S- s 0.9 M 10 14.6 L 10 19.4',
  raven: 'C r 1.4 4 17.2 12.4 1;B- s 0.9 M 2.2 15.6 L 7.6 10.6;B- s 0.9 M 17.8 15.6 L 12.4 10.6;P- M 1.8 4.6 L 10 11.4 L 18.2 4.6 Z;B- s 1 M 2 4.6 L 10 11.2 L 18 4.6;r+ c 10 11 2.6;R- c 10 11 1.2',
  bird: 'n l 0.7 10 15 9.4 18.4;n l 0.7 12 15 12.6 18.4;N M 1.6 9.2 L 6 9.6 C 7.6 7 9.6 6.6 11.2 7 C 11.6 4 13 2.6 15 2.6 C 17 2.6 18 4 18 5.6 C 17.6 11 15 14.6 10.6 15 C 7.6 15.3 5 13.6 4.6 11.6 Z;C- M 11 14.6 C 14.6 14 16.8 11.6 17.2 8 C 15.6 10 13 11 11 11.4 Z;n- M 6.4 10.6 C 8.6 8.6 11.6 9 13 11.6 C 10.6 12.6 8 12.2 6.4 10.6 Z;k- c 15.3 4.9 0.8;Y p 17.8 4.6 20 6 17.8 7.2',
  note: 'w e 6.6 15.6 3.4 2.5 -20;w l 1.5 9.5 14.6 9.5 2;w s 1.5 M 9.5 2 C 11 5 15.6 5.6 15.6 9.6',
  foot: 'N M 5 1.6 L 11.6 1.6 L 11.6 11 C 11.6 12 12.4 12.6 14 12.8 L 17.4 13.4 C 19 13.8 19.6 15 19.6 16.6 L 19.6 18.6 L 5 18.6 Z;n- r 5 16.8 14.6 1.8;n- r 4.6 1.6 7.4 2.4 0.6;K- l 0.8 7 5 7 15',
  bell: 'n c 10 1.8 1.3;y M 10 2.4 C 13.6 2.4 15 5.2 15 9 C 15 12.6 16 14 18 15.6 L 2 15.6 C 4 14 5 12.6 5 9 C 5 5.2 6.4 2.4 10 2.4 Z;Y r 1.6 14.6 16.8 2 1;y c 10 17.8 1.8;A- s 1 M 7.6 5.4 C 7 7.4 7 10 6.8 12.4',
  frost: icFlake(10, 10, 9, 1.5, 'l'),
  mud: 'n a 1.8 10 11.4 6.8 180 360;n l 1.1 10 11.4 10 4.6;n l 1.1 10 11.4 4.4 7.4;n l 1.1 10 11.4 15.6 7.4;N c 10 11.4 1.6;N M 0.6 16 C 0.6 13.4 3.6 12.6 6 13.4 C 8.6 12.2 11.6 12.2 14 13.4 C 16.6 12.6 19.4 13.4 19.4 16 C 19.4 18.6 15.6 19.4 10 19.4 C 4.4 19.4 0.6 18.6 0.6 16 Z;n- e 6.4 16.4 2.8 1.1;n- e 13.8 17 2.6 1;N c 2.6 10.6 0.9;N c 17.6 10.2 0.8;N c 16 8 0.6',
  cross: 'x r 8.6 1 2.8 18.4 0.6;x r 3.8 5 12.4 2.8 0.6;K- l 0.6 9.6 2 9.6 18',
  antler: 'n e 10 17.4 3.2 2.2;N s 1.7 M 8.4 16.4 C 6.6 12.6 3.6 9.6 3.2 3.4;N s 1.4 M 5 11.2 L 1.4 8.6;N s 1.4 M 3.8 7.4 L 5.8 2.6;N s 1.7 M 11.6 16.4 C 13.4 12.6 16.4 9.6 16.8 3.4;N s 1.4 M 15 11.2 L 18.6 8.6;N s 1.4 M 16.2 7.4 L 14.2 2.6',
  cup: 'y M 4 2 L 16 2 C 16 7 13.6 9.6 11 10 L 11 15 C 13 15.6 14.6 16.6 14.6 18.6 L 5.4 18.6 C 5.4 16.6 7 15.6 9 15 L 9 10 C 6.4 9.6 4 7 4 2 Z;Y- M 12.4 2 L 16 2 C 16 7 13.6 9.6 11 10 L 11 8.6 C 12.8 7.6 12.4 4.6 12.4 2 Z;r- c 8.6 5.4 1.2;A- l 0.8 5 3 11.4 3',
  ring: 'y a 2.4 10 12.4 5.4 0 360;Y- a 0.8 10 12.4 4.6 20 160;l+ * 10 5 3 1.8 4 0;W- c 9.2 4.2 0.6',
  insp: '#ffe07a40- c 10 6 5;J r 6.6 9 6.8 12.2 0.8;K- r 11 9.6 1.4 11;W- M 6.6 9.6 C 7.6 9.6 8 11.4 8 12.8 C 8 13.6 7.4 13.8 7 13 L 6.6 12 Z;n r 3 20.6 14 2.8 1;k- l 0.7 10 9 10 7.4;a M 10 1 C 11.6 3.6 12.6 5 12.6 6.4 C 12.6 7.8 11.4 8.6 10 8.6 C 8.6 8.6 7.4 7.8 7.4 6.4 C 7.4 5 8.4 3.6 10 1 Z;A- M 10 4.6 C 10.8 5.8 11.2 6.4 11.2 7 C 11.2 7.6 10.6 8 10 8 C 9.4 8 8.8 7.6 8.8 7 C 8.8 6.4 9.2 5.8 10 4.6 Z',
  chk: 'h l 2.4 3 10.6 8 15.6 17 4.4',
  cloud: 'w ' + IC_CLOUD + ';K- ' + IC_CLOUDB,
  rain: icT('w ' + IC_CLOUD + ';K- ' + IC_CLOUDB, '0 -3.4') + ';l l 1.3 6 15.4 4.6 18.8;l l 1.3 10.6 15.4 9.2 18.8;l l 1.3 15.2 15.4 13.8 18.8',
  storm: icT('g ' + IC_CLOUD + ';d- ' + IC_CLOUDB, '0 -3.6') + ';l l 1.3 4.6 14.6 3 19.2;l l 1.3 8.6 14.6 7 19.2;l l 1.3 12.6 14.6 11 19.2;l l 1.3 16.6 14.6 15 19.2',
  snow: icT('w ' + IC_CLOUD + ';K- ' + IC_CLOUDB, '0 -3.4') + ';' + icAst(5.4, 16.2, 2, 'W') + ';' + icAst(10.4, 18, 2, 'W') + ';' + icAst(15.2, 16.2, 2, 'W'),
  blizz: icT(icFlake(10, 10, 9, 1.5, 'l'), '1.4 1.2 0 0.66') + ';G s 1.4 M 6 14.4 L 16 14.4 C 18 14.4 18.8 12.6 17.6 11.4;G s 1.4 M 3 17.8 L 13 17.8',
  fog: 'K s 1.8 M 2 5.4 C 5 4 7 6.8 10 5.4 C 13 4 15 6.8 18 5.4;K s 1.8 M 2 10.4 C 5 9 7 11.8 10 10.4 C 13 9 15 11.8 18 10.4;K s 1.8 M 2 15.4 C 5 14 7 16.8 10 15.4 C 13 14 15 16.8 18 15.4',
  heat: icRays(10, 8, 5.6, 8, 8, 1.4, 'a', 0) + ';y c 10 8 4;a s 1.4 M 2.6 16 C 5 14.6 7 17.4 10 16 C 13 14.6 15 17.4 17.4 16;a s 1.4 M 4.6 19.4 C 7 18 9 20.8 12 19.4 C 13.6 18.6 14.6 19.2 15.4 19.6',
  wind: 'G s 1.6 M 1.6 7.4 L 12 7.4 C 14.6 7.4 15.6 5.8 15.2 4.4 C 14.8 2.8 12.8 2.6 12 4;G s 1.6 M 1.6 11.4 L 15.6 11.4 C 18.2 11.4 19.4 13.2 18.6 14.8 C 17.8 16.4 15.6 16.2 15.2 14.6;G s 1.6 M 4 15.2 L 10 15.2',
};
// ---------- parsing and painting ----------
const HIP = {}, HIB = new Map();
function hiShape(s) {
  const t = s[0];
  if (t === 'M') return { p: new Path2D(s), st: 0 };
  if (t === 's') { const i = s.indexOf('M'); return { p: new Path2D(s.slice(i)), st: +s.slice(1, i) }; }
  const p = new Path2D(), n = s.slice(1).trim().split(/[\s,]+/).map(Number), D = Math.PI / 180, TAU = Math.PI * 2; let st = 0;
  const poly = (k, f) => { for (let i = 0; i < k; i++) { const [x, y] = f(i); i ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); };
  if (t === 'c') p.arc(n[0], n[1], n[2], 0, TAU);
  else if (t === 'e') p.ellipse(n[0], n[1], n[2], n[3], (n[4] || 0) * D, 0, TAU);
  else if (t === 'r') { const [x, y, w, h] = n, q = Math.min(n[4] || 0, w / 2, h / 2);
    if (!q) p.rect(x, y, w, h); else { p.moveTo(x + q, y); p.arcTo(x + w, y, x + w, y + h, q); p.arcTo(x + w, y + h, x, y + h, q); p.arcTo(x, y + h, x, y, q); p.arcTo(x, y, x + w, y, q); p.closePath(); } }
  else if (t === 'p') poly(n.length >> 1, i => [n[i * 2], n[i * 2 + 1]]);
  else if (t === 'l') { st = n[0]; p.moveTo(n[1], n[2]); for (let i = 3; i + 1 < n.length; i += 2) p.lineTo(n[i], n[i + 1]); }
  else if (t === 'a') { st = n[0]; p.arc(n[1], n[2], n[3], n[4] * D, n[5] * D); }
  else if (t === '*') { const [x, y, R, r, k] = n, a0 = (n[5] === undefined ? -90 : n[5]) * D; poly(k * 2, i => { const a = a0 + i * Math.PI / k, q = i % 2 ? r : R; return [x + Math.cos(a) * q, y + Math.sin(a) * q]; }); }
  else if (t === 'w') { const [x, y, r, am, k] = n; poly(72, i => { const a = i / 72 * TAU, q = r + am * Math.sin(a * k); return [x + Math.cos(a) * q, y + Math.sin(a) * q]; }); }
  return { p, st };
}
function hiParse(name) {
  if (HIP[name]) return HIP[name];
  const P = HIP[name] = [];
  for (const it of icItems(HI[name])) {
    const m = /^(#[0-9a-fA-F]+|\S)([-+%=]*)\s+([\s\S]*)$/.exec(it); if (!m) continue;
    const parts = m[3].split('@'), path = new Path2D(); let mx = null, st = 0;
    for (const tt of parts.slice(1)) { const v = tt.trim().split(/[\s,]+/).map(Number), sx = v[3] === undefined ? 1 : v[3];
      const q = new DOMMatrix().translateSelf(v[0] || 0, v[1] || 0).rotateSelf(v[2] || 0).scaleSelf(sx, v[4] === undefined ? sx : v[4]); mx = mx ? q.multiply(mx) : q; }
    for (const sh of parts[0].split('&')) { const r = hiShape(sh.trim()); if (r.st) st = r.st; if (mx) path.addPath(r.p, mx); else path.addPath(r.p); }
    P.push({ col: m[1][0] === '#' ? m[1] : PAL[m[1]], no: m[2].includes('-'), own: m[2].includes('+'), eo: m[2].includes('%') ? 'evenodd' : 'nonzero', dash: m[2].includes('='), st, p: path });
  }
  return P;
}
function hiPaint(g, P, ol, tint) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  const out = it => { g.fillStyle = g.strokeStyle = PAL.o; g.lineWidth = it.st + ol * 2; g.stroke(it.p); if (!it.st) g.fill(it.p, it.eo); };
  if (!tint) for (const it of P) if (!it.no) out(it);
  for (const it of P) {
    if (it.own && !tint) out(it);
    g.setLineDash(it.dash ? [it.st * 1.2, it.st * 2.2] : []);
    if (it.st) { g.strokeStyle = it.col; g.lineWidth = it.st; g.stroke(it.p); } else { g.fillStyle = it.col; g.fill(it.p, it.eo); }
  }
  g.setLineDash([]);
  if (tint) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = tint; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.globalCompositeOperation = 'source-over'; }
}
// the bitmap of icon `name` at k device pixels per game pixel; pad = margin in device pixels around the box
function hiCanvas(name, k, tint) {
  const key = name + '|' + k + '|' + (tint || ''); let e = HIB.get(key); if (e) return e;
  const s = SPR['i_' + name], u = k / 4, ol = Math.max(1.1, 1 / u), pad = Math.ceil((ol + 1) * u) + 1;
  const c = document.createElement('canvas'); c.width = Math.ceil(s.width * k) + pad * 2; c.height = Math.ceil(s.height * k) + pad * 2;
  const g = c.getContext('2d'); g.setTransform(u, 0, 0, u, pad, pad); hiPaint(g, hiParse(name), ol, tint);
  if (HIB.size > 600) HIB.clear(); e = { c, pad }; HIB.set(key, e); return e;
}
function hiIc(n) { return RS > 1 && typeof n === 'string' && n.charCodeAt(0) === 105 && n.charCodeAt(1) === 95 && !!HI[n.slice(2).split('@')[0]] && !!SPR[n]; }
// top-bar icons next to the big numbers: a drawn icon is 1.4× larger around the centre of its usual box
function sprBar(name, x, y) { if (!hiIc(name)) return spr(name, x, y); const w = sprW(name), h = sprH(name); spr(name, Math.round(x - w * 0.2), Math.round(y - h * 0.2), { scale: 1.4 }); }
{ const spr0 = spr;
  // a drawn icon at its usual size is 1.2× larger around the centre of its box (rounded to device pixels): the book font
  // is taller than the pixel one, and a 5×5 icon looked small beside it
  spr = function (name, x, y, o) {
    if (!hiIc(name)) return spr0(name, x, y, o);
    const at = name.indexOf('@'), base = at < 0 ? name.slice(2) : name.slice(2, at), s = SPR[name], m = ctx.getTransform(), kx = Math.hypot(m.a, m.b);
    const grow = !(o && o.scale) && at < 0 && s.width <= 7 && s.height <= 7 ? 1.2 : 1, sc = ((o && o.scale) || 1) * grow, k = Math.round(kx * sc * 100) / 100;
    if (k <= 1.01) return spr0(name, x, y, o);
    const e = hiCanvas(base, k, at < 0 ? '' : name.slice(at + 1)), f = sc / k, w = e.c.width * f, h = e.c.height * f, p = e.pad * f;
    const X = (x | 0) - Math.round(s.width * (grow - 1) / 2 * kx) / kx, Y = (y | 0) - Math.round(s.height * (grow - 1) / 2 * kx) / kx;
    if (o && o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o && o.flip && !o.scale) { ctx.save(); ctx.translate(X + s.width * grow, Y); ctx.scale(-1, 1); ctx.drawImage(e.c, -p, -p, w, h); ctx.restore(); }
    else ctx.drawImage(e.c, X - p, Y - p, w, h);
    if (o && o.alpha !== undefined) ctx.globalAlpha = 1;
  };
}
