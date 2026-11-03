'use strict';
// ===== AUDIO 2: more instruments; longer pieces for every place and event; birdsong, beasts and the sounds of places; footsteps =====
// Everything is synthesised on the fly (Web Audio), like audio.js. Buses: ambience and footsteps get their own volume (the mixer in sndui.js).
const SND2 = (() => {
  const K = Snd._k, { MOODS, LUTE, MEL, DRUM, FAM, d2m, pick, rnd, cl, mtof } = K, A = () => K.ac;
  Object.assign(K.P, Object.assign({ gv: 1, av: 0.7, fv: 0.45 }, K.P)); // defaults for the new sliders (kept if already saved)
  K.hooks.init = () => { const ac = A(); K.ambBus = K.G_(K.P.av, K.master); const r = K.G_(0.22, K.revIn); K.ambBus.connect(r); K.stepBus = K.G_(K.P.fv, K.sfxBus); const r2 = K.G_(0.12, K.revIn); K.stepBus.connect(r2); K.stepRev = r2; K.ambRev = r; void ac; };
  // ---------- instruments ----------
  function fiddle(m, t, dur, vel, dest) { // vielle: a bowed string — two detuned saws, delayed vibrato, a bowed swell, body resonances
    const ac = A(), f = mtof(m), o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f * 1.0035;
    const vib = ac.createOscillator(), vg = K.G_(0); vib.frequency.value = 5.1 + rnd() * 0.7; vib.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.0055, t + Math.min(0.4, dur * 0.6));
    const lp = K.filt('lowpass', 3000, 0.6), b1 = K.filt('peaking', 1000, 1.1), b2 = K.filt('peaking', 2600, 1.5); b1.gain.value = 6; b2.gain.value = 4;
    const g = K.G_(0, dest); o1.connect(lp); o2.connect(lp); lp.connect(b1); b1.connect(b2); b2.connect(g);
    const a = Math.min(0.1, dur * 0.3), s1 = Math.max(t + a + 0.02, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.linearRampToValueAtTime(vel * 0.78, t + a + Math.min(0.25, dur * 0.4)); g.gain.setValueAtTime(vel * 0.78, s1); g.gain.linearRampToValueAtTime(0.0001, s1 + 0.1);
    const e = s1 + 0.14; o1.start(t); o2.start(t); vib.start(t); o1.stop(e); o2.stop(e); vib.stop(e);
  }
  function recorder(m, t, dur, vel, dest) { // a soft wooden pipe: nearly a pure tone, a little chiff
    const ac = A(), f = mtof(m), o = ac.createOscillator(), o2 = ac.createOscillator(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2;
    const g = K.G_(0, dest), g2 = K.G_(0.1, g); o.connect(g); o2.connect(g2); const s1 = Math.max(t + 0.05, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.03); g.gain.linearRampToValueAtTime(vel * 0.85, t + 0.12); g.gain.setValueAtTime(vel * 0.85, s1); g.gain.linearRampToValueAtTime(0.0001, s1 + 0.06);
    K.nz(t, 0.035, 'bandpass', f * 3, 1.5, vel * 0.3, dest); o.start(t); o2.start(t); o.stop(s1 + 0.1); o2.stop(s1 + 0.1);
  }
  function pipe(m, t, dur, vel, dest) { // the bagpipe's chanter: reedy, no breath between notes
    const ac = A(), f = mtof(m), o = ac.createOscillator(), o2 = ac.createOscillator(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f * 1.002;
    const b = K.filt('bandpass', 1450, 1.0), lp = K.filt('lowpass', 4200, 0.5), g = K.G_(0, dest), m2 = K.G_(0.35); o.connect(b); o2.connect(m2); m2.connect(b); b.connect(lp); lp.connect(g);
    const s1 = Math.max(t + 0.03, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.012); g.gain.setValueAtTime(vel, s1); g.gain.linearRampToValueAtTime(0.0001, s1 + 0.03);
    o.start(t); o2.start(t); o.stop(s1 + 0.06); o2.stop(s1 + 0.06);
  }
  function pipeDrone(m, t, dur, vel, dest) { // the bag's drones: root, octave below, fifth — buzzing and steady
    const ac = A(); for (const [k, v, fq] of [[0, 1, 900], [-12, 0.8, 700], [7, 0.35, 1100]]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + 12 + k); o.detune.value = (rnd() - 0.5) * 6;
      const lp = K.filt('lowpass', fq, 0.8), g = K.G_(0, dest); o.connect(lp); lp.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * v, t + 0.35); g.gain.setValueAtTime(vel * v, t + Math.max(0.4, dur - 0.4)); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur + 0.05); } }
  function gurdy(m, t, dur, vel, dest) { // hurdy-gurdy melody string: a wheel-bowed nasal tone
    const ac = A(), f = mtof(m), o = ac.createOscillator(), o2 = ac.createOscillator(); o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.006;
    const b = K.filt('bandpass', 1150, 0.8), pk = K.filt('peaking', 2500, 2); pk.gain.value = 7; const g = K.G_(0, dest); o.connect(b); o2.connect(b); b.connect(pk); pk.connect(g);
    const s1 = Math.max(t + 0.04, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.025); g.gain.setValueAtTime(vel * 0.92, s1); g.gain.linearRampToValueAtTime(0.0001, s1 + 0.06); o.start(t); o2.start(t); o.stop(s1 + 0.1); o2.stop(s1 + 0.1);
  }
  function psaltery(m, t, vel, dest) { const hp = K.filt('highpass', 650, 0.7, dest); K.lute(m + 12, t, vel, hp); K.lute(m + 12, t + 0.006, vel * 0.45, hp); } // a doubled course, struck: bright and short
  function organ(m, t, dur, vel, dest) { // a portative organ: flue pipes, a little chiff
    const ac = A(), f = mtof(m), g = K.G_(0, dest), s1 = Math.max(t + 0.06, t + dur);
    for (const [h, a] of [[1, 1], [2, 0.45], [3, 0.22], [4, 0.12], [6, 0.05]]) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * h * (1 + (rnd() - 0.5) * 0.002); const og = K.G_(a, g); o.connect(og); o.start(t); o.stop(s1 + 0.25); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.05); g.gain.setValueAtTime(vel, s1); g.gain.linearRampToValueAtTime(0.0001, s1 + 0.18); K.nz(t, 0.05, 'bandpass', f * 4, 2, vel * 0.25, dest); }
  function naker(t, vel, dest, hi) { K.tone('sine', hi ? 250 : 165, hi ? 150 : 96, t, 0.2, vel, dest, 0.002); K.nz(t, 0.05, 'bandpass', hi ? 1500 : 950, 1.2, vel * 0.45, dest); }
  function frame(t, vel, dest) { K.nz(t, 0.05, 'bandpass', 1900, 1.1, vel * 0.7, dest); for (let i = 0; i < 3; i++) K.nz(t + 0.005 + i * 0.02, 0.06, 'highpass', 7000, 0.7, vel * (0.5 - i * 0.12), dest); } // a frame drum with jingles
  Object.assign(MEL, {
    fiddle(m, t, d, v, bus, n) { if (n && n.l >= 2 && rnd() < 0.12) fiddle(m + 2, t - 0.06, 0.06, v * 0.6, bus); fiddle(m, t, d, v, bus); },
    recorder(m, t, d, v, bus, n) { if (n && n.l >= 2 && rnd() < 0.15) recorder(m + 2, t - 0.05, 0.045, v * 0.6, bus); recorder(m, t, d, v, bus); },
    pipe(m, t, d, v, bus, n) { if (n && n.l >= 2 && rnd() < 0.35) pipe(m + (rnd() < 0.6 ? 2 : 4), t - 0.035, 0.03, v, bus); pipe(m, t, d, v, bus); }, // the piper's cuts
    gurdy(m, t, d, v, bus) { gurdy(m, t, d, v, bus); },
    psaltery(m, t, d, v, bus) { psaltery(m, t, v, bus); if (d > 0.45) psaltery(m, t + d * 0.5, v * 0.5, bus); },
    organ(m, t, d, v, bus) { organ(m, t, d, v, bus); },
    trumpet(m, t, d, v, bus) { K.horn(m, t, d, v, bus, 1.45); },
    singer(m, t, d, v, bus) { K.voice(m, t, d, v, bus); },
    harpm(m, t, d, v, bus) { K.lute(m, t, v, bus); if (d > 0.7) K.lute(m + 12, t + d * 0.5, v * 0.4, bus); },
  });
  const chordB = c => c > 3 ? c - 7 : c;
  Object.assign(LUTE, {
    harp2(S, c, t, st, v, bus) { const M = S.M, b = chordB(c); [0, 4, 7, 9, 11, 9].forEach((x, i) => K.lute(d2m(M.root, M.sc, b + x), t + i * st * M.meter / 6 + (rnd() - 0.5) * 0.012, v * [0.9, 0.5, 0.6, 0.45, 0.4, 0.35][i], bus)); },
    pluck(S, c, t, st, v, bus) { const M = S.M, b = chordB(c); for (let i = 0; i < M.meter; i++) if (i % 2 === 0 || rnd() < 0.3) psaltery(d2m(M.root, M.sc, b + [0, 4, 7, 4, 9, 7, 4, 7][i % 8]), t + i * st, v * (i === 0 ? 0.8 : 0.45), bus); },
    buzz(S, c, t, st, v, bus) { const M = S.M, b = chordB(c), dur = st * M.meter; pipeDrone(d2m(M.root - 12, M.sc, b), t, dur + 0.05, v * 0.08, bus); // drones follow the chord, the 'dog' buzzes on the beats
      for (let i = 0; i < M.meter; i += M.meter === 6 ? 3 : 2) K.nz(t + i * st, 0.07, 'bandpass', 2300, 2.2, v * 0.16, bus); },
    organ(S, c, t, st, v, bus) { const M = S.M, b = chordB(c), dur = st * M.meter * 0.98; [0, 4, 7].forEach((x, i) => organ(d2m(M.root, M.sc, b + x), t, dur, v * [0.07, 0.05, 0.05][i], bus)); },
    walk(S, c, t, st, v, bus) { const M = S.M, b = chordB(c); [0, 4, 7, 4].forEach((x, i) => K.lute(d2m(M.root - 12, M.sc, b + x), t + i * st * M.meter / 4, v * (i ? 0.55 : 0.9), bus, st * M.meter / 4 * 0.9)); },
  });
  Object.assign(DRUM, {
    naker(t, st, bi, bus) { naker(t, 0.3, bus); naker(t + 2 * st, 0.16, bus, 1); naker(t + 4 * st, 0.24, bus); naker(t + 5 * st, 0.12, bus, 1); naker(t + 6 * st, 0.18, bus, 1); if (bi === 3) for (let i = 0; i < 4; i++) naker(t + (6 + i * 0.5) * st, 0.12 + i * 0.04, bus, i % 2); },
    gallop(t, st, bi, bus) { for (const [s, v] of [[0, 0.3], [1, 0.12], [2, 0.18], [3, 0.26], [4, 0.12], [5, 0.18]]) K.drum(s % 3 ? 'tak' : 'low', t + s * st, v, bus); },
    toll(t, st, bi, bus) { if (bi % 2 === 0) K.bellV(98, t, 0.05, 4, bus); },
    frame(t, st, bi, bus) { frame(t, 0.22, bus); frame(t + 2 * st, 0.1, bus); frame(t + 3 * st, 0.16, bus); frame(t + 5 * st, 0.1, bus); if (bi % 2) K.drum('low', t, 0.2, bus); },
    siege(t, st, bi, bus) { K.drum('big', t, 0.7, bus); K.drum('big', t + 4 * st, 0.5, bus); if (bi % 2) K.drum('low', t + 6 * st, 0.3, bus); },
    brush(t, st, bi, bus) { K.drum('low', t, 0.22, bus); if (bi % 2) K.drum('tak', t + (st * 3), 0.05, bus); },
  });
  // ---------- new pieces (form 'long': intro, A, A', B, B', break, A, coda, rest — about a minute each, then the next piece of the family) ----------
  Object.assign(MOODS, {
    basse: { form: 1, g: 2.0, root: 50, sc: 'dor', st: 0.4, meter: 6, prog: [[0, 3, 4, 0], [0, 6, 3, 4], [5, 3, 4, 0], [0, 4, 6, 0]], lute: 'pav', mel: 'fiddle', mel2: 'recorder', mb: 62, mb2: 69, mv2: 0.07, lo: 0, hi: 8, drum: 'tabor', dr: 38, dv: 0.015, lv: 0.28, mv: 0.06, ctr: 'third', ctrI: 'recorder', cv: 0.035, pause: [1, 2] },
    rondeau: { form: 1, g: 1.9, root: 55, sc: 'mix', st: 0.27, meter: 6, prog: [[0, 6, 3, 0], [0, 3, 4, 0], [3, 4, 0, 0], [0, 4, 6, 0]], lute: 'arp', lute2: 'pluck', mel: 'recorder', mel2: 'fiddle', mb: 67, mb2: 62, mv2: 0.055, lo: 0, hi: 8, drum: 'soft', dr: 43, dv: 0.012, lv: 0.26, mv: 0.075, ctr: 'sus', ctrI: 'fiddle', cv: 0.03, pause: [1, 3] },
    saltarello: { form: 1, g: 1.5, root: 50, sc: 'dor', st: 0.15, meter: 6, prog: [[0, 6, 0, 4], [0, 3, 6, 0], [0, 6, 3, 4], [3, 6, 4, 0]], lute: 'arp', mel: 'shawm', mel2: 'recorder', mb: 62, mb2: 69, mv2: 0.07, lo: 0, hi: 8, drum: 'jig', dr: 38, dv: 0.02, lv: 0.22, mv: 0.05, brk: 1, pause: [1, 2] },
    bransle: { form: 1, g: 1.45, root: 55, sc: 'mix', st: 0.2, meter: 8, prog: [[0, 4, 0, 4], [0, 3, 4, 0], [0, 6, 4, 0], [3, 4, 0, 0]], lute: 'none', mel: 'pipe', mel2: 'fiddle', mb: 67, mb2: 62, mv2: 0.05, lo: 0, hi: 7, drum: 'dance', drum2: 'frame', dr: 43, dv: 0.05, dronef: pipeDrone, lv: 0.2, mv: 0.045, brk: 1, pause: [1, 2] },
    tavern: { form: 1, g: 2.4, root: 50, sc: 'dor', st: 0.17, meter: 6, prog: [[0, 6, 0, 4], [0, 3, 6, 0], [0, 6, 3, 4], [0, 4, 0, 0]], lute: 'buzz', mel: 'gurdy', mel2: 'fiddle', mb: 62, mb2: 62, mv2: 0.055, lo: 0, hi: 8, drum: 'frame', dr: 38, dv: 0.01, lv: 0.25, mv: 0.045, brk: 1, pause: [1, 2] },
    winter: { form: 1, g: 2.53, root: 45, sc: 'aeo', st: 0.5, meter: 6, prog: [[0, 5, 3, 4], [0, 3, 6, 0], [0, 5, 6, 0], [5, 3, 4, 0]], lute: 'harp2', mel: 'recorder', mel2: 'psaltery', mb: 69, mb2: 57, mv2: 0.1, lo: 0, hi: 7, drum: 'none', dr: 33, dv: 0.012, lv: 0.24, mv: 0.06, ctr: 'bells', cv: 0.018, pause: [2, 4] },
    autumn: { form: 1, g: 2.0, root: 52, sc: 'dor', st: 0.36, meter: 8, prog: [[0, 6, 3, 0], [0, 3, 4, 0], [5, 3, 6, 0], [0, 4, 6, 0]], lute: 'arp', mel: 'fiddle', mel2: 'recorder', mb: 64, mb2: 71, mv2: 0.06, lo: 0, hi: 8, drum: 'brush', dr: 40, dv: 0.014, lv: 0.26, mv: 0.055, ctr: 'sus', ctrI: 'recorder', cv: 0.026, pause: [1, 3] },
    lullaby: { form: 1, g: 2.4, root: 48, sc: 'aeo', st: 0.48, meter: 6, prog: [[0, 3, 4, 0], [0, 5, 6, 0], [0, 3, 6, 0], [5, 6, 0, 0]], lute: 'harp2', mel: 'recorder', mel2: 'harpm', mb: 67, mb2: 60, mv2: 0.22, lo: 0, hi: 6, drum: 'none', dr: 36, dv: 0.012, lv: 0.24, mv: 0.055, pause: [2, 4] },
    road: { form: 1, g: 1.8, root: 52, sc: 'mix', st: 0.26, meter: 8, prog: [[0, 4, 0, 4], [0, 3, 4, 0], [0, 6, 4, 0], [3, 4, 0, 0]], lute: 'walk', mel: 'fiddle', mel2: 'shawm', mb: 64, mb2: 64, mv2: 0.045, lo: 0, hi: 8, drum: 'march', dr: 40, dv: 0.014, lv: 0.24, mv: 0.055, ctr: 'third', ctrI: 'recorder', cv: 0.03, pause: [1, 2] },
    pilgrim: { form: 1, g: 2.47, root: 50, sc: 'dor', st: 0.3, meter: 6, prog: [[0, 6, 0, 4], [0, 3, 6, 0], [0, 6, 3, 4], [5, 6, 0, 0]], lute: 'pluck', mel: 'psaltery', mel2: 'recorder', mb: 62, mb2: 69, mv2: 0.07, lo: 0, hi: 8, drum: 'tabor', dr: 38, dv: 0.012, lv: 0.24, mv: 0.16, ctr: 'sus', ctrI: 'fiddle', cv: 0.026, pause: [1, 2] },
    warcouncil: { form: 1, g: 1.8, root: 45, sc: 'phr', st: 0.44, meter: 8, prog: [[0, 1, 0, 6], [0, 5, 6, 0], [0, 3, 1, 0], [5, 6, 0, 0]], lute: 'sparse', mel: 'horn', mel2: 'fiddle', mb: 52, mb2: 57, mv2: 0.05, lo: 0, hi: 6, drum: 'heart', dr: 33, dv: 0.03, lv: 0.28, mv: 0.06, ctr: 'sus', ctrI: 'fiddle', cv: 0.025, pause: [2, 3] },
    campfire: { form: 1, g: 3.69, root: 50, sc: 'dor', st: 0.34, meter: 6, prog: [[0, 6, 3, 0], [0, 3, 6, 0], [0, 5, 6, 0], [3, 6, 0, 0]], lute: 'buzz', mel: 'gurdy', mel2: 'singer', mb: 62, mb2: 50, mv2: 0.08, lo: 0, hi: 7, drum: 'none', dr: 38, dv: 0.01, lv: 0.22, mv: 0.04, pause: [2, 3] },
    battle2: { form: 1, g: 0.9, root: 43, sc: 'phr', st: 0.2, meter: 8, prog: [[0, 1, 0, 6], [0, 5, 6, 0], [0, 1, 6, 0], [5, 6, 1, 0]], lute: 'ost', mel: 'trumpet', mel2: 'horn', mb: 55, mb2: 50, mv2: 0.08, lo: 0, hi: 6, drum: 'war', drum2: 'naker', dr: 31, dv: 0.03, lv: 0.24, mv: 0.07, brk: 1, introDrum: 1, pause: [1, 1] },
    siege: { form: 1, g: 1.4, root: 40, sc: 'aeo', st: 0.4, meter: 8, prog: [[0, 5, 6, 0], [0, 3, 4, 0], [0, 6, 5, 4], [5, 6, 0, 0]], lute: 'sparse', mel: 'horn', mel2: 'trumpet', mb: 52, mb2: 55, mv2: 0.06, lo: 0, hi: 6, drum: 'siege', dr: 28, dv: 0.04, lv: 0.24, mv: 0.07, introDrum: 1, pause: [1, 2] },
    chasse: { form: 1, g: 1.4, root: 53, sc: 'mix', st: 0.16, meter: 6, prog: [[0, 4, 0, 4], [0, 3, 4, 0], [0, 4, 3, 0], [3, 4, 0, 0]], lute: 'ost', mel: 'trumpet', mel2: 'shawm', mb: 65, mb2: 65, mv2: 0.05, lo: 0, hi: 5, drum: 'gallop', dr: 41, dv: 0.012, lv: 0.2, mv: 0.06, brk: 1, introDrum: 1, pause: [1, 1] },
    joust: { form: 1, g: 1.82, root: 55, sc: 'mix', st: 0.21, meter: 8, prog: [[0, 4, 0, 4], [0, 3, 4, 0], [3, 4, 0, 0], [0, 6, 4, 0]], lute: 'arp', mel: 'trumpet', mel2: 'shawm', mb: 67, mb2: 67, mv2: 0.05, lo: 0, hi: 5, drum: 'naker', dr: 43, dv: 0.014, lv: 0.22, mv: 0.06, brk: 1, pause: [1, 2] },
    hymn: { form: 1, g: 0.85, root: 50, sc: 'dor', st: 0.58, meter: 8, prog: [[0, 3, 0, 4], [0, 6, 3, 0], [0, 4, 3, 0], [0, 3, 6, 0]], lute: 'organ', mel: 'singer', mel2: 'organ', mb: 57, mb2: 62, mv2: 0.06, lo: -1, hi: 6, drum: 'none', dr: 38, dv: 0.02, lv: 1, mv: 0.13, ctr: 'fifth', ctrI: 'singer', cv: 0.06, pause: [2, 3] },
    lament: { form: 1, g: 2.3, root: 45, sc: 'aeo', st: 0.52, meter: 6, prog: [[0, 5, 3, 4], [0, 3, 4, 0], [0, 5, 6, 4], [5, 3, 4, 0]], lute: 'harp2', mel: 'fiddle', mel2: 'singer', mb: 57, mb2: 52, mv2: 0.1, lo: 0, hi: 7, drum: 'toll', dr: 33, dv: 0.02, lv: 0.22, mv: 0.06, ctr: 'sus', ctrI: 'recorder', cv: 0.02, pause: [2, 4] },
    dungeon: { form: 1, g: 2.53, root: 40, sc: 'phr', st: 0.7, meter: 6, prog: [[0, 1, 0, 6], [0, 5, 1, 0], [0, 1, 6, 0], [5, 1, 0, 0]], lute: 'none', mel: 'harpm', mel2: 'singer', mb: 52, mb2: 45, mv2: 0.06, lo: 0, hi: 5, drum: 'none', dr: 28, dv: 0.03, lv: 0, mv: 0.2, rest: 0.4, pause: [3, 5] },
  });
  // families: the place, hour, season and the events of the reign pick one; its pieces follow each other
  Object.assign(FAM, {
    court: ['basse', 'pavane', 'rondeau', 'peace'], outdoor: ['rondeau', 'peace', 'saltarello', 'estampie'], outdoor_au: ['autumn', 'rondeau', 'peace'], outdoor_w: ['winter', 'nocturne', 'autumn'],
    village: ['bransle', 'estampie', 'saltarello', 'peace'], village_w: ['winter', 'bransle', 'tavern'], town: ['estampie', 'bransle', 'rondeau', 'saltarello'], tavern: ['tavern', 'feast', 'estampie', 'bransle'],
    feast: ['feast', 'tavern', 'basse', 'estampie'], night: ['nocturne', 'lullaby'], chapel: ['chant', 'hymn'], map: ['peace', 'pilgrim', 'rondeau', 'road'], map_w: ['winter', 'pilgrim', 'nocturne'],
    travel: ['road', 'pilgrim', 'march'], campaign: ['march', 'road', 'warcouncil'], camp: ['campfire', 'nocturne'], war: ['tension', 'warcouncil', 'march'],
    battle: ['battle', 'battle2'], siege: ['siege', 'battle2'], hunt: ['chasse', 'saltarello'], tourney: ['joust', 'estampie'], lament: ['lament'], dungeon: ['dungeon'],
  });
  K.hooks.compose = mood => { const M = MOODS[mood]; if (!M || !M.form) return null;
    const pa = pick(M.prog), pb = pick(M.prog.filter(x => x !== pa)), pc = pick(M.prog), mid = Math.round((M.lo + M.hi) / 2);
    const A0 = K.genPhrase(M, pa, K.nearCT(mid, pa[0], M)), B = K.genPhrase(M, pb, K.nearCT(M.hi - 2, pb[0], M)), A2 = K.vary(M, A0, pa), B2 = K.vary(M, B, pb);
    const L = (lute, mel, drum, drone, ctr) => ({ lute, mel, drum, drone, ctr }), m2 = M.mel2, F = [];
    F.push({ p: pa, ly: L(1, 0, M.introDrum ? 1 : 0, 1) });
    F.push({ p: pa, m: A0, ly: L(1, 1, 1, 1) }, { p: pa, m: A2, ly: L(1, 1, 1, 1, 1) });
    F.push({ p: pb, m: B, mel: m2, lute: M.lute2, ly: L(1, 1, 1, 0) }, { p: pb, m: B2, mel: m2, lute: M.lute2, ly: L(1, 1, 1, 1, 1) });
    if (M.brk) F.push({ p: pc, ly: L(1, 0, 1, 1) });
    F.push({ p: pa, m: A0, ly: L(1, 1, 1, 1, 1) }, { p: pa, m: A2, ly: L(1, 1, 0, 1) });
    F.push({ rest: M.pause[0] + Math.floor(rnd() * (M.pause[1] - M.pause[0] + 1)), ly: L(0, 0, 0, 0), p: [0, 0, 0, 0] });
    return { F, si: 0, bi: 0, k: 0.96 + rnd() * 0.08 };
  };
  K.hooks.bar = (S, sec, bi, t, st, barD) => { const M = S.M; // a second voice and a second drum
    if (sec.ly.drum && M.drum2) DRUM[M.drum2](t, st, bi, S.b.dm);
    if (!sec.ly.ctr || !M.ctr) return; const c = sec.p[bi], I = MEL[M.ctrI || M.mel];
    if (M.ctr === 'bells') { if (bi % 2 === 0) K.bellV(mtof(d2m(M.root + 24, M.sc, chordB(c) + (bi ? 4 : 0))), t, M.cv, 2.6, S.b.lu); return; }
    if (M.ctr === 'sus') { const d = K.nearCT(Math.round((M.lo + M.hi) / 2) - 2, c, M); I(d2m(M.mb - 12, M.sc, d), t, barD * 0.96, M.cv, S.b.lu, { l: 6 }); return; }
    if (!sec.m || !sec.m[bi]) return; const sh = M.ctr === 'fifth' ? -4 : -2;
    for (const n of sec.m[bi]) if (!n.r && n.l >= 2) I(d2m(M.mb, M.sc, n.d + sh), t + n.s * st + 0.01, n.l * st * 0.9, M.cv * n.acc, S.b.lu, n);
  };
  // ---------- the sounds of places ----------
  // out(vol, pan, far): a voice's way to the ambience bus; far ones lose their highs
  function out(vol, p, far) { const ac = A(), g = K.G_(vol, K.ambBus); let d = g; if (far > 0) { const lp = K.filt('lowpass', 9000 - far * 7000, 0.5, g); d = lp; } return ac.createStereoPanner ? K.pan(d, p) : d; }
  const T = (f0, f1, t, dur, vel, d, a, type) => K.tone(type || 'sine', f0, f1 || f0, t, dur, vel, d, a || 0.008);
  const BIRD = {
    robin(t, d) { let tt = t; const n = 6 + (rnd() * 7 | 0); for (let i = 0; i < n; i++) { const f = 2800 + rnd() * 3200, l = 0.04 + rnd() * 0.09; T(f, f * (0.75 + rnd() * 0.55), tt, l, 0.016, d); if (rnd() < 0.25) for (let j = 1; j < 4; j++) T(f * 1.1, f * 0.95, tt + l + j * 0.028, 0.022, 0.01, d); tt += l + 0.03 + rnd() * 0.07; } },
    blackbird(t, d) { let tt = t; const n = 3 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const f = 1400 + rnd() * 1300, l = 0.12 + rnd() * 0.2; T(f, f * (0.85 + rnd() * 0.35), tt, l, 0.022, d, 0.03); tt += l + 0.04; } for (let j = 0; j < 2 + (rnd() * 3 | 0); j++) T(5200 + rnd() * 1800, 4300, tt + j * 0.04, 0.03, 0.008, d); },
    chaffinch(t, d) { let tt = t, f = 4300; for (let i = 0; i < 5; i++) { T(f, f * 0.92, tt, 0.045, 0.014, d); tt += 0.075; f *= 0.97; } f = 3400; for (let i = 0; i < 4; i++) { T(f, f * 0.9, tt, 0.04, 0.015, d); tt += 0.058; f *= 0.97; } T(3600, 4700, tt + 0.02, 0.08, 0.016, d); T(3000, 2100, tt + 0.12, 0.12, 0.014, d); },
    tit(t, d) { const n = 3 + (rnd() * 2 | 0); for (let i = 0; i < n; i++) { T(5300, 5100, t + i * 0.3, 0.08, 0.013, d); T(3800, 3700, t + i * 0.3 + 0.13, 0.08, 0.012, d); } },
    wren(t, d) { for (let i = 0; i < 26; i++) { const f = 4200 + rnd() * 3000; T(f, f * (0.8 + rnd() * 0.4), t + i * 0.055, 0.03, 0.009, d); } },
    lark(t, d) { for (let i = 0; i < 60; i++) { const f = 2600 + rnd() * 3600; T(f, f * (0.7 + rnd() * 0.6), t + i * 0.065 + rnd() * 0.02, 0.035 + rnd() * 0.03, 0.006, d); } },
    cuckoo(t, d) { const n = 2 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const tt = t + i * 0.85; T(780, 760, tt, 0.16, 0.022, d, 0.03); T(625, 600, tt + 0.3, 0.3, 0.02, d, 0.04); } },
    pigeon(t, d) { const R = [0, 0.42, 0.95, 1.35, 1.7]; R.forEach((s, i) => { const l = i === 1 ? 0.42 : 0.28; T(430, 380, t + s, l, i === 1 ? 0.026 : 0.018, d, 0.07, 'triangle'); }); },
    sparrow(t, d) { let tt = t; const n = 3 + (rnd() * 5 | 0); for (let i = 0; i < n; i++) { T(3100, 4300, tt, 0.045, 0.012, d); T(4400, 3400, tt + 0.045, 0.035, 0.01, d); tt += 0.12 + rnd() * 0.2; } },
    crow(t, d) { const n = 1 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const tt = t + i * (0.42 + rnd() * 0.1), f = 470 + rnd() * 90, o = A().createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 0.74, tt + 0.28);
      const b = K.filt('bandpass', 1300, 2.2), g = K.G_(0, d); o.connect(b); b.connect(g); K.envAD(g, tt, 0.02, 0.1, 0.27); o.start(tt); o.stop(tt + 0.36); } },
    gull(t, d) { for (let i = 0; i < 3 + (rnd() * 3 | 0); i++) { const tt = t + i * 0.22; T(1500, 2200, tt, 0.06, 0.012, d, 0.01, 'sawtooth'); T(2200, 1300, tt + 0.06, 0.12, 0.012, d, 0.005, 'triangle'); } },
    owl(t, d) { T(420, 400, t, 0.5, 0.03, d, 0.06); const t2 = t + 2.2 + rnd() * 1.5; T(430, 420, t2, 0.14, 0.022, d, 0.03); for (let i = 0; i < 4; i++) T(425, 410, t2 + 0.3 + i * 0.07, 0.05, 0.014, d, 0.01); T(430, 380, t2 + 0.62, 0.95, 0.03, d, 0.08); },
    owl2(t, d) { T(1150, 1450, t, 0.08, 0.016, d, 0.01, 'triangle'); T(1450, 1050, t + 0.08, 0.14, 0.014, d, 0.005, 'triangle'); },
    nightingale(t, d) { let tt = t; const ph = rnd(); if (ph < 0.35) { for (let i = 0; i < 8; i++) { T(1800, 1600, tt, 0.04, 0.016, d); K.nz(tt, 0.01, 'bandpass', 3000, 2, 0.008, d); tt += 0.09; } }
      else if (ph < 0.7) { for (let i = 0; i < 6; i++) { T(3300, 2900, tt, 0.15, 0.006 + i * 0.003, d, 0.03); tt += 0.22; } } else { for (let i = 0; i < 30; i++) T(5000, 4600, tt + i * 0.05, 0.03, 0.01, d); tt += 1.6; }
      T(2600, 4200, tt + 0.1, 0.1, 0.015, d); },
    woodpecker(t, d) { let v = 0.05; const n = 12 + (rnd() * 8 | 0), r = 1 / (16 + rnd() * 5); for (let i = 0; i < n; i++) { K.nz(t + i * r, 0.015, 'bandpass', 1300, 3, v, d); T(950, 800, t + i * r, 0.02, v * 0.3, d, 0.001); v *= 0.94; } },
    crickets(t, d) { for (let c = 0; c < 3; c++) { const f = 4400 + rnd() * 700, o0 = t + rnd() * 0.5; for (let k = 0; k < 3; k++) for (let p = 0; p < 3; p++) T(f, f, o0 + k * 0.6 + p * 0.032, 0.014, 0.0045, d, 0.002); } },
    frogs(t, d) { for (let c = 0; c < 2 + (rnd() * 3 | 0); c++) { const f = 160 + rnd() * 130, o0 = t + rnd() * 1.2; for (let p = 0; p < 5; p++) T(f, f * 0.94, o0 + p * 0.036, 0.024, 0.014, d, 0.002, 'sawtooth'); } },
  };
  function formantVoice(seg, t, d, fq, q, type) { const ac = A(), o = ac.createOscillator(); o.type = type || 'sawtooth'; let tt = t; o.frequency.setValueAtTime(seg[0][0], t); for (const [f, l] of seg) { o.frequency.linearRampToValueAtTime(f, tt + l); tt += l; }
    const g = K.G_(0, d); for (const [ff, qq] of fq) { const b = K.filt('bandpass', ff, qq || q || 2); o.connect(b); b.connect(g); } return { o, g, end: tt }; }
  function voiced(seg, t, vel, d, fq, a, vib) { const v = formantVoice(seg, t, d, fq, 2); v.g.gain.setValueAtTime(0.0001, t); v.g.gain.linearRampToValueAtTime(vel, t + (a || 0.03)); v.g.gain.setValueAtTime(vel, v.end - 0.05); v.g.gain.linearRampToValueAtTime(0.0001, v.end + 0.06);
    if (vib) { const l = A().createOscillator(), lg = K.G_(seg[0][0] * vib[1]); l.frequency.value = vib[0]; l.connect(lg); lg.connect(v.o.frequency); l.start(t); l.stop(v.end + 0.1); } v.o.start(t); v.o.stop(v.end + 0.1); }
  const BEAST = {
    rooster(t, d) { voiced([[560, 0.01], [700, 0.12], [920, 0.13], [1000, 0.18], [960, 0.3], [640, 0.28]], t, 0.05, d, [[1400, 2], [2600, 3]], 0.02, [9, 0.02]); },
    hen(t, d) { for (let i = 0; i < 3; i++) voiced([[300, 0.01], [320, 0.05]], t + i * 0.16, 0.03, d, [[900, 2]]); voiced([[480, 0.01], [540, 0.08], [430, 0.2]], t + 0.55, 0.035, d, [[1000, 2], [2200, 3]]); },
    goose(t, d) { for (let i = 0; i < 2 + (rnd() * 2 | 0); i++) voiced([[420, 0.01], [380, 0.16]], t + i * 0.3, 0.03, d, [[1200, 3], [2400, 4]]); },
    duck(t, d) { for (let i = 0; i < 2 + (rnd() * 3 | 0); i++) voiced([[270, 0.01], [240, 0.11]], t + i * 0.2, 0.03, d, [[1000, 4], [2500, 3]]); },
    dog(t, d) { for (let i = 0; i < 1 + (rnd() * 3 | 0); i++) { const tt = t + i * (0.22 + rnd() * 0.08), f = 380 + rnd() * 140; voiced([[f, 0.01], [f * 0.62, 0.11]], tt, 0.05, d, [[1100, 1.4]]); K.nz(tt, 0.05, 'bandpass', 1700, 1.2, 0.015, d); } },
    horse(t, d) { voiced([[900, 0.05], [1250, 0.25], [1100, 0.35], [760, 0.45], [620, 0.3]], t, 0.03, d, [[1500, 1.5], [2800, 3]], 0.05, [11, 0.05]); K.nz(t + 1.45, 0.3, 'lowpass', 700, 0.8, 0.03, d); },
    snort(t, d) { K.nz(t, 0.25, 'lowpass', 600, 0.8, 0.04, d, { a: 0.02, f1: 300 }); K.nz(t + 0.32, 0.18, 'lowpass', 500, 0.8, 0.03, d); },
    cow(t, d) { const v = formantVoice([[150, 0.01], [140, 0.5], [120, 0.7]], t, d, [], 2); const b = K.filt('bandpass', 300, 3); v.o.connect(b); b.connect(v.g); b.frequency.setValueAtTime(300, t); b.frequency.linearRampToValueAtTime(800, t + 0.5); b.frequency.linearRampToValueAtTime(420, t + 1.2);
      v.g.gain.setValueAtTime(0.0001, t); v.g.gain.linearRampToValueAtTime(0.06, t + 0.2); v.g.gain.setValueAtTime(0.06, t + 1); v.g.gain.linearRampToValueAtTime(0.0001, t + 1.25); v.o.start(t); v.o.stop(t + 1.3); },
    sheep(t, d) { voiced([[330, 0.01], [320, 0.55]], t, 0.03, d, [[1100, 2], [2400, 3]], 0.04, [7, 0.06]); },
    goat(t, d) { voiced([[460, 0.01], [440, 0.45]], t, 0.025, d, [[1300, 2], [2600, 3]], 0.03, [9, 0.08]); },
    pig(t, d) { for (let i = 0; i < 2 + (rnd() * 2 | 0); i++) { K.nz(t + i * 0.2, 0.12, 'lowpass', 420, 2, 0.04, d); T(95, 80, t + i * 0.2, 0.1, 0.02, d, 0.01, 'sawtooth'); } },
    cat(t, d) { voiced([[600, 0.01], [880, 0.25], [520, 0.35]], t, 0.02, d, [[1500, 2], [3000, 3]], 0.05); },
    coo(t, d) { for (let i = 0; i < 3; i++) T(560, 500, t + i * 0.45, 0.3, 0.012, d, 0.06, 'triangle'); },
    wolf(t, d) { voiced([[380, 0.01], [520, 0.6], [560, 1.0], [440, 0.8]], t, 0.03, d, [[900, 2], [1800, 3]], 0.3, [5, 0.01]); },
  };
  const THING = {
    bell(t, d, n) { for (let i = 0; i < (n || 3); i++) K.bellV(220, t + i * 2.4, 0.06, 4.5, d); },
    anvil(t, d) { for (let i = 0; i < 3; i++) { const tt = t + i * 0.34 + (i === 2 ? 0.1 : 0), f = 1700 + rnd() * 300; [[1, 0.05, 0.35], [2.7, 0.025, 0.2], [4.1, 0.012, 0.12]].forEach(([r, v, l]) => T(f * r, f * r, tt, l, i === 2 ? v * 0.5 : v, d, 0.001)); K.nz(tt, 0.02, 'highpass', 3000, 0.7, 0.03, d); } },
    axe(t, d) { for (let i = 0; i < 3 + (rnd() * 2 | 0); i++) { const tt = t + i * 1.1; K.nz(tt, 0.08, 'lowpass', 700, 0.8, 0.06, d); T(170, 90, tt, 0.08, 0.04, d, 0.002); } K.nz(t + 4.6, 0.12, 'bandpass', 900, 1.2, 0.04, d); },
    cart(t, d) { for (let i = 0; i < 6; i++) T(340 + rnd() * 60, 300, t + i * 0.55, 0.18, 0.008, d, 0.05, 'sawtooth'); K.nz(t, 3.2, 'lowpass', 220, 0.7, 0.03, d, { a: 0.4 }); },
    drip(t, d) { const f = 1100 + rnd() * 900; T(f, f * 1.8, t, 0.03, 0.02, d, 0.001); },
    chain(t, d) { for (let i = 0; i < 4; i++) { const f = 2400 + rnd() * 1400; T(f, f, t + i * 0.05 + rnd() * 0.03, 0.06, 0.008, d, 0.001); } },
    laugh(t, d) { const f = 180 + rnd() * 90; for (let i = 0; i < 4; i++) voiced([[f * 1.2, 0.01], [f, 0.09]], t + i * 0.14, 0.02, d, [[800, 2], [1300, 3]]); },
    talk(t, d) { const f = 120 + rnd() * 120; for (let i = 0; i < 3 + (rnd() * 4 | 0); i++) voiced([[f * (0.9 + rnd() * 0.3), 0.01], [f * (0.8 + rnd() * 0.3), 0.08 + rnd() * 0.1]], t + i * 0.18, 0.012, d, [[500 + rnd() * 400, 2], [1200 + rnd() * 600, 3]]); },
    crier(t, d) { const f = 210 + rnd() * 50; voiced([[f, 0.01], [f * 1.3, 0.25], [f * 1.25, 0.4], [f * 0.9, 0.3]], t, 0.025, d, [[700, 2], [1150, 2.5]], 0.05, [5, 0.02]); },
    bees(t, d) { const ac = A(), o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 220 + rnd() * 40; const l = ac.createOscillator(), lg = K.G_(8); l.frequency.value = 3; l.connect(lg); lg.connect(o.frequency); const b = K.filt('bandpass', 500, 1.5), g = K.G_(0, d); o.connect(b); b.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.006, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + 2.4); o.start(t); l.start(t); o.stop(t + 2.5); l.stop(t + 2.5); },
    crackle(t, d) { for (let i = 0; i < 4; i++) K.nz(t + rnd() * 0.5, 0.008 + rnd() * 0.02, 'highpass', 2200 + rnd() * 3000, 0.9, 0.02 + rnd() * 0.04, d); },
  };
  // looping beds: wind, leaves, water, crowd, fire, room tone — gains follow the place
  const BED = {}; const BEDK = { wind: ['bandpass', 380, 0.9], leaves: ['highpass', 2600, 0.6], water: ['bandpass', 1600, 0.5], crowd: ['bandpass', 520, 0.9], fire: ['lowpass', 320, 0.7], room: ['lowpass', 140, 0.7], surf: ['lowpass', 700, 0.6] };
  function bed(k, v, now) { let b = BED[k]; if (!b) { if (v <= 0.0005) return; const [ty, f, q] = BEDK[k]; b = BED[k] = K.loopNoise(ty, f, q, K.ambBus); b.ph = rnd() * 6; }
    b.ph += 0.09; const mod = k === 'wind' || k === 'leaves' ? 0.6 + 0.4 * Math.sin(b.ph * 0.23) * Math.sin(b.ph * 0.071 + 1) : k === 'surf' ? 0.55 + 0.45 * Math.sin(b.ph * 0.5) : k === 'crowd' ? 0.8 + 0.2 * Math.sin(b.ph * 0.37) : 1;
    b.g.gain.setTargetAtTime(v * mod, now, k === 'surf' ? 0.5 : 0.8); }
  function bedsOff(now, keep) { for (const k in BED) if (!keep || !keep[k]) BED[k].g.gain.setTargetAtTime(0, now, 0.8); }
  // a sound by name somewhere around: vol 0..1, pan -1..1, far 0..1
  // loudness of each kind against the music: birds and beasts carry, a bell is not right at your ear
  const GAINK = { crickets: 7, frogs: 5, lark: 6, wren: 5, coo: 4, snort: 3.5, bell: 0.6, anvil: 1.5, axe: 2, cart: 5, drip: 4, chain: 4, laugh: 3, talk: 3, crier: 2.5, bees: 6, crackle: 1.5 };
  const gainOf = n => GAINK[n] || (BIRD[n] ? 4 : BEAST[n] ? 3 : 1);
  function play(name, vol, p, far, n) { const ac = A(); if (!ac || !K.ambBus || ac.state !== 'running') return; const t = ac.currentTime + 0.03, d = out(vol * gainOf(name), p, far || 0);
    const f = BIRD[name] || BEAST[name] || THING[name]; if (f) try { f(t, d, n); } catch (e) { console.warn('amb', name, e); } }
  // ---------- footsteps ----------
  function step(surf, vel, p) { const ac = A(); if (!ac || !K.stepBus || ac.state !== 'running') return; stepAt(surf, vel || 0.06, ac.createStereoPanner ? K.pan(K.stepBus, p || 0) : K.stepBus, ac.currentTime + 0.005); }
  function stepAt(surf, v, d, t) { const j = 0.85 + rnd() * 0.3;
    switch (surf) {
      case 'stone': K.nz(t, 0.03, 'bandpass', 2000 * j, 2.4, v * 0.7, d); K.tone('sine', 150 * j, 80, t, 0.045, v * 0.55, d, 0.002); break;
      case 'wood': K.nz(t, 0.05, 'bandpass', 650 * j, 1.6, v * 0.9, d); K.tone('triangle', 190 * j, 130, t, 0.07, v * 0.45, d, 0.002); break;
      case 'grass': K.nz(t, 0.09, 'highpass', 2600 * j, 0.7, v * 0.45, d, { a: 0.012 }); K.nz(t, 0.05, 'lowpass', 400, 0.7, v * 0.35, d); break;
      case 'leaves': K.nz(t, 0.12, 'highpass', 3000 * j, 0.8, v * 0.55, d, { a: 0.01 }); for (let i = 0; i < 3; i++) K.nz(t + 0.02 + rnd() * 0.08, 0.012, 'highpass', 4000, 0.8, v * 0.35, d); break;
      case 'dirt': K.nz(t, 0.06, 'bandpass', 1250 * j, 1, v * 0.7, d); K.nz(t + 0.015, 0.03, 'highpass', 3000, 0.7, v * 0.22, d); break;
      case 'snow': for (let i = 0; i < 5; i++) K.nz(t + i * 0.022 + rnd() * 0.01, 0.02, 'bandpass', 1600 + rnd() * 1600, 1.2, v * 0.5, d); K.nz(t, 0.12, 'lowpass', 600, 0.7, v * 0.3, d); break;
      case 'mud': K.nz(t, 0.12, 'lowpass', 520 * j, 2.4, v * 0.9, d, { f1: 260 }); K.tone('sine', 260, 140, t + 0.02, 0.08, v * 0.22, d, 0.005); break;
      case 'water': K.nz(t, 0.22, 'highpass', 900, 0.7, v * 0.8, d, { a: 0.01, f1: 2600 }); K.tone('sine', 520, 900, t + 0.04, 0.05, v * 0.2, d); break;
      case 'straw': K.nz(t, 0.08, 'highpass', 3200 * j, 0.8, v * 0.4, d, { a: 0.01 }); break;
      default: K.nz(t, 0.05, 'bandpass', 1200, 1, v * 0.6, d);
    } }
  // offline checks (Snd._test): 'robin', 'anvil', 'step:snow' … at time t
  K.hooks.test = (n, t) => { if (n.startsWith('step:')) { for (let i = 0; i < 6; i++) stepAt(n.slice(5), 0.06, K.stepBus, t + i * 0.18); return; }
    if (n.startsWith('bed:')) { const [k, v] = n.slice(4).split('='), [ty, f, q] = BEDK[k]; K.loopNoise(ty, f, q, K.ambBus).g.gain.value = +v || 0.03; return; }
    const f = BIRD[n] || BEAST[n] || THING[n]; if (!f) throw new Error('no sound ' + n); f(t, out(0.9 * gainOf(n), 0, 0)); };
  return { play, step, bed, bedsOff, BIRD, BEAST, THING, out, fiddle, recorder, pipe, gurdy, organ, psaltery };
})();
