// ===== MUSIC 3 (v3.6): more pieces — each with a theme of its own, an old tune as it was sung, new instruments;
// music of the rooms (library, throne room, council hall, garden), of spring and of sickness at court =====
(() => {
  if (typeof Snd === 'undefined' || !Snd._k) return;
  const K = Snd._k, { MOODS, MEL, DRUM, FAM, pick, rnd, mtof } = K, A = () => K.ac;
  K.SC.hmin = [0, 2, 3, 5, 7, 8, 11]; // harmonic minor: the raised seventh of a cadence
  // ---------- instruments ----------
  function gemshorn(m, t, dur, vel, dest) { // an ox-horn ocarina: a hollow, soft tone, a breath at the start, a slow vibrato
    const ac = A(), f = mtof(m), o = ac.createOscillator(), o3 = ac.createOscillator(); o.type = o3.type = 'sine'; o.frequency.value = f; o3.frequency.value = f * 3.002;
    const vib = ac.createOscillator(), vg = K.G_(0); vib.frequency.value = 4.3 + rnd() * 0.6; vib.connect(vg); vg.connect(o.frequency); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.004, t + Math.min(0.7, dur * 0.7));
    const g = K.G_(0, dest), g3 = K.G_(0.06, g); o.connect(g); o3.connect(g3); const s1 = Math.max(t + 0.09, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.07); g.gain.setValueAtTime(vel, s1); g.gain.linearRampToValueAtTime(0.0001, s1 + 0.14);
    K.nz(t, Math.min(0.22, dur), 'bandpass', f * 1.5, 0.9, vel * 0.16, dest); const e = s1 + 0.18; o.start(t); o3.start(t); vib.start(t); o.stop(e); o3.stop(e); vib.stop(e);
  }
  function crumhorn(m, t, dur, vel, dest) { // a capped double reed: buzzing, nasal, no vibrato
    const ac = A(), f = mtof(m), o = ac.createOscillator(), o2 = ac.createOscillator(); o.type = 'square'; o2.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.988, t); o.frequency.linearRampToValueAtTime(f, t + 0.035); o2.frequency.value = f * 1.003;
    const lp = K.filt('lowpass', Math.min(3600, f * 6), 0.9), pk = K.filt('peaking', 950, 2.2), g = K.G_(0, dest), m2 = K.G_(0.4); pk.gain.value = 5; o.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(pk); pk.connect(g);
    const s1 = Math.max(t + 0.04, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.016); g.gain.setValueAtTime(vel * 0.9, s1); g.gain.linearRampToValueAtTime(0.0001, s1 + 0.04);
    o.start(t); o2.start(t); o.stop(s1 + 0.08); o2.stop(s1 + 0.08);
  }
  function citole(m, t, vel, dest) { const lp = K.filt('lowpass', 2100, 0.7, dest); K.lute(m, t, vel, lp); K.nz(t, 0.018, 'bandpass', 2600, 1.2, vel * 0.18, dest); } // a quill-plucked citole: darker than the lute
  Object.assign(MEL, {
    gemshorn(m, t, d, v, bus) { gemshorn(m, t, d, v, bus); },
    crumhorn(m, t, d, v, bus, n) { if (n && n.l >= 2 && rnd() < 0.12) crumhorn(m + 2, t - 0.05, 0.045, v * 0.7, bus); crumhorn(m, t, d, v, bus); },
    citole(m, t, d, v, bus) { citole(m, t, v, bus); if (d > 0.55) for (let x = 0.16; x < d - 0.08; x += 0.16) citole(m, t + x, v * 0.42, bus); }, // long notes: a quill tremolo
  });
  Object.assign(DRUM, {
    waltz(t, st, bi, bus) { K.drum('low', t, 0.24, bus); K.drum('tak', t + 2 * st, 0.06, bus); K.drum('tak', t + 4 * st, 0.08, bus); if (bi === 3) K.drum('jingle', t + 4 * st, 0.05, bus); },
    tambour(t, st, bi, bus) { K.drum('low', t, 0.3, bus); K.drum('jingle', t + 1.5 * st, 0.06, bus); K.drum('tak', t + 3 * st, 0.12, bus); K.drum('jingle', t + 4.5 * st, 0.07, bus); },
  });
  // ---------- new pieces: themeA is the piece's own tune (its bars 3–4 are varied on the repeat), the rest grows from it ----------
  const T = (p, ...m) => ({ p, m });
  Object.assign(MOODS, {
    maying: { form: 1, g: 1.95, root: 55, sc: 'mix', st: 0.2, meter: 6, prog: [[0, 6, 4, 0], [0, 3, 6, 0], [3, 0, 4, 0], [0, 6, 3, 0]], lute: 'pluck', lute2: 'arp', mel: 'recorder', mel2: 'fiddle', mb: 67, mb2: 62, mv2: 0.05, lo: -1, hi: 8, drum: 'tambour', dr: 43, dv: 0.011, lv: 0.24, mv: 0.07, ctr: 'third', ctrI: 'recorder', cv: 0.028, brk: 1, pause: [1, 2],
      themeA: T([0, 6, 4, 0], [[4, 2], [3, 1], [2, 2], [0, 1]], [[1, 2], [3, 1], [1, 2], [-1, 1]], [[1, 1], [2, 1], [3, 1], [4, 2], [3, 1]], [[2, 2], [1, 1], [0, 3]]) },
    study: { form: 1, g: 2.0, root: 50, sc: 'dor', st: 0.4, meter: 8, prog: [[0, 3, 6, 0], [0, 6, 3, 0], [0, 4, 3, 0], [5, 3, 4, 0]], lute: 'harp2', lute2: 'organ', mel: 'gemshorn', mel2: 'citole', mb: 62, mb2: 62, mv2: 0.2, lo: 0, hi: 8, drum: 'none', dr: 38, dv: 0.012, lv: 0.24, mv: 0.075, ctr: 'sus', ctrI: 'organ', cv: 0.018, pause: [2, 3],
      themeA: T([0, 3, 6, 0], [[4, 4], [2, 2], [3, 2]], [[5, 3], [4, 1], [3, 4]], [[1, 2], [3, 2], [6, 3], [5, 1]], [[4, 2], [2, 2], [0, 4]]) },
    throne: { form: 1, g: 2.0, root: 50, sc: 'mix', st: 0.32, meter: 8, prog: [[0, 4, 3, 0], [0, 3, 4, 0], [3, 0, 6, 0], [0, 6, 4, 0]], lute: 'pav', lute2: 'organ', mel: 'fiddle', mel2: 'shawm', mb: 62, mb2: 62, mv2: 0.045, lo: 0, hi: 8, drum: 'tabor', dr: 38, dv: 0.014, lv: 0.28, mv: 0.06, ctr: 'third', ctrI: 'recorder', cv: 0.026, pause: [1, 2],
      themeA: T([0, 4, 3, 0], [[0, 2], [2, 2], [4, 3], [5, 1]], [[4, 3], [3, 1], [1, 4]], [[3, 2], [5, 2], [7, 2], [6, 2]], [[4, 2], [2, 2], [0, 4]]) },
    council: { form: 1, g: 2.1, root: 45, sc: 'aeo', st: 0.38, meter: 8, prog: [[0, 5, 6, 0], [0, 3, 4, 0], [5, 6, 0, 0], [0, 6, 5, 4]], lute: 'sparse', lute2: 'walk', mel: 'fiddle', mel2: 'recorder', mb: 57, mb2: 69, mv2: 0.06, lo: -1, hi: 7, drum: 'brush', dr: 33, dv: 0.016, lv: 0.26, mv: 0.065, ctr: 'sus', ctrI: 'fiddle', cv: 0.022, pause: [1, 3],
      themeA: T([0, 5, 6, 0], [[4, 3], [2, 1], [0, 4]], [[0, 2], [2, 2], [5, 3], [4, 1]], [[3, 2], [1, 2], [-1, 2], [1, 2]], [[2, 2], [1, 2], [0, 4]]) },
    vigil: { form: 1, g: 1.9, root: 52, sc: 'aeo', st: 0.52, meter: 6, prog: [[0, 3, 5, 4], [0, 5, 3, 0], [3, 0, 4, 0], [5, 3, 4, 0]], lute: 'harp2', mel: 'gemshorn', mel2: 'harpm', mb: 64, mb2: 64, mv2: 0.18, lo: 0, hi: 7, drum: 'none', dr: 40, dv: 0.014, lv: 0.22, mv: 0.07, ctr: 'sus', ctrI: 'fiddle', cv: 0.016, pause: [2, 4],
      themeA: T([0, 3, 5, 4], [[4, 3], [2, 2], [3, 1]], [[5, 2], [4, 1], [3, 3]], [[2, 2], [4, 1], [5, 3]], [[4, 2], [3, 1], [1, 3]]) },
    summer: { form: 1, g: 1.6, root: 57, sc: 'mix', st: 0.18, meter: 6, prog: [[0, 6, 4, 0], [0, 6, 0, 4], [0, 3, 6, 0], [3, 6, 0, 0]], lute: 'arp', mel: 'recorder', mel2: 'crumhorn', mb: 69, mb2: 57, mv2: 0.045, lo: 0, hi: 8, drum: 'dance', dr: 45, dv: 0.01, lv: 0.24, mv: 0.07, ctr: 'third', ctrI: 'fiddle', cv: 0.024, brk: 1, pause: [1, 2],
      themeA: T([0, 6, 4, 0], [[0, 1], [2, 1], [4, 1], [7, 2], [4, 1]], [[6, 2], [3, 1], [1, 2], [3, 1]], [[4, 1], [5, 1], [6, 1], [4, 2], [1, 1]], [[2, 2], [1, 1], [0, 3]]) },
    harvest: { form: 1, g: 2.4, root: 50, sc: 'dor', st: 0.24, meter: 6, prog: [[0, 3, 6, 0], [0, 6, 3, 0], [0, 6, 0, 4], [3, 6, 0, 0]], lute: 'buzz', lute2: 'walk', mel: 'fiddle', mel2: 'crumhorn', mb: 62, mb2: 62, mv2: 0.045, lo: 0, hi: 8, drum: 'frame', dr: 38, dv: 0.01, lv: 0.24, mv: 0.05, brk: 1, pause: [1, 2],
      themeA: T([0, 3, 6, 0], [[0, 2], [2, 1], [4, 2], [2, 1]], [[3, 2], [5, 1], [7, 2], [5, 1]], [[6, 1], [5, 1], [6, 1], [3, 2], [1, 1]], [[2, 1], [1, 1], [2, 1], [0, 3]]) },
    carol: { form: 1, g: 1.9, root: 55, sc: 'mix', st: 0.25, meter: 6, prog: [[0, 4, 3, 0], [0, 3, 0, 4], [3, 0, 4, 0], [0, 6, 3, 0]], lute: 'pluck', mel: 'recorder', mel2: 'singer', mb: 67, mb2: 55, mv2: 0.11, lo: 0, hi: 8, drum: 'soft', dr: 43, dv: 0.012, lv: 0.24, mv: 0.07, ctr: 'bells', cv: 0.016, pause: [1, 3],
      themeA: T([0, 4, 3, 0], [[4, 2], [4, 1], [4, 2], [2, 1]], [[1, 2], [4, 1], [6, 2], [4, 1]], [[5, 2], [4, 1], [3, 2], [2, 1]], [[1, 2], [1, 1], [0, 3]]) },
    starlight: { form: 1, g: 3.4, root: 50, sc: 'aeo', st: 0.5, meter: 6, prog: [[0, 5, 3, 4], [0, 3, 5, 0], [5, 6, 0, 0], [0, 5, 6, 0]], lute: 'harp2', mel: 'harpm', mel2: 'gemshorn', mb: 62, mb2: 62, mv2: 0.065, lo: 0, hi: 8, drum: 'none', dr: 38, dv: 0.012, lv: 0.22, mv: 0.2, ctr: 'bells', cv: 0.011, pause: [2, 4],
      themeA: T([0, 5, 3, 4], [[7, 3], [4, 3]], [[5, 2], [4, 1], [2, 3]], [[3, 1], [5, 1], [7, 1], [5, 3]], [[6, 2], [4, 1], [4, 3]]) },
    litany: { form: 1, g: 0.9, root: 43, sc: 'mix', st: 0.56, meter: 8, prog: [[0, 6, 3, 0], [0, 3, 0, 4], [0, 6, 0, 0], [3, 6, 0, 0]], lute: 'organ', mel: 'singer', mel2: 'gemshorn', mb: 55, mb2: 67, mv2: 0.06, lo: -1, hi: 6, drum: 'none', dr: 43, dv: 0.02, lv: 1, mv: 0.13, ctr: 'fifth', ctrI: 'singer', cv: 0.05, pause: [2, 3],
      themeA: T([0, 6, 3, 0], [[0, 2], [1, 2], [2, 4]], [[3, 2], [1, 2], [-1, 4]], [[0, 2], [2, 2], [3, 2], [2, 2]], [[1, 4], [0, 4]]) },
    watch: { form: 1, g: 1.85, root: 45, sc: 'phr', st: 0.46, meter: 8, prog: [[0, 1, 6, 0], [0, 5, 6, 0], [0, 6, 1, 0], [5, 6, 0, 0]], lute: 'sparse', mel: 'fiddle', mel2: 'gemshorn', mb: 57, mb2: 69, mv2: 0.06, lo: -1, hi: 7, drum: 'heart', dr: 33, dv: 0.028, lv: 0.26, mv: 0.06, ctr: 'sus', ctrI: 'fiddle', cv: 0.02, pause: [2, 3],
      themeA: T([0, 1, 6, 0], [[4, 4], [2, 2], [3, 2]], [[1, 4], [3, 2], [1, 2]], [[-1, 4], [1, 2], [3, 2]], [[2, 2], [1, 2], [0, 4]]) },
    greenwood: { form: 1, g: 1.5, root: 50, sc: 'mix', st: 0.17, meter: 6, prog: [[0, 4, 0, 0], [0, 6, 0, 4], [0, 3, 4, 0], [3, 0, 6, 0]], lute: 'ost', mel: 'horn', mel2: 'recorder', mb: 62, mb2: 74, mv2: 0.06, lo: 0, hi: 8, drum: 'gallop', dr: 38, dv: 0.012, lv: 0.2, mv: 0.06, brk: 1, introDrum: 1, pause: [1, 1],
      themeA: T([0, 4, 0, 0], [[0, 1], [2, 1], [4, 1], [7, 3]], [[4, 2], [4, 1], [1, 2], [4, 1]], [[7, 2], [4, 1], [2, 2], [4, 1]], [[0, 3], [0, 3]]) },
    // the sequence of the dead, «Dies irae» (13th c.): its first lines as the chant has them, then the organ goes on alone
    requiem: { form: 1, g: 0.85, root: 50, sc: 'dor', st: 0.55, meter: 8, prog: [[0, 6, 0, 0], [0, 3, 6, 0], [0, 4, 0, 0], [5, 6, 0, 0]], lute: 'organ', mel: 'singer', mel2: 'organ', mb: 62, mb2: 62, mv2: 0.06, lo: -1, hi: 6, drum: 'toll', dr: 38, dv: 0.02, lv: 1, mv: 0.13, ctr: 'fifth', ctrI: 'singer', cv: 0.045, pause: [2, 4],
      themeA: T([0, 6, 0, 0], [[2, 2], [1, 2], [2, 2], [0, 2]], [[1, 2], [-1, 2], [0, 4]], [[2, 1], [2, 1], [3, 2], [2, 2], [1, 1], [0, 1]], [[-1, 1], [1, 1], [2, 2], [1, 2], [0, 2]]) },
    // «Greensleeves» (England, 16th c.): verse and refrain as written; the lute plays the old ground (romanesca) under it
    greensl: { g: 1.9, root: 57, sc: 'aeo', st: 0.22, meter: 6, beat: 2, prog: [[0, 0, 6, 6]], lute: 'harp2', mel: 'recorder', mel2: 'fiddle', mb: 69, mb2: 69, mv2: 0.055, lo: -3, hi: 7, drum: 'waltz', dr: 45, dv: 0, lv: 0.26, mv: 0.075, pause: [2, 3],
      tune: {
        intro: { p: [0, 0, 4, 4], sc: [0, 0, 'hmin', 'hmin'], m: [[], [], [], [[null, 4], [0, 2]]] },
        v1: { p: [0, 0, 6, 6], m: [[[2, 4], [3, 2]], [[4, 3], [5, 1], [4, 2]], [[3, 4], [1, 2]], [[-1, 3], [0, 1], [1, 2]]] },
        v2: { p: [0, 0, 4, 4], sc: [0, 0, 'hmin', 'hmin'], m: [[[2, 4], [0, 2]], [[0, 3], [-1, 1, 1], [0, 2]], [[1, 4], [-1, 2, 1]], [[-3, 4], [0, 2]]] },
        v3: { p: [2, 2, 6, 6], m: [[[2, 4], [3, 2]], [[4, 3], [5, 1], [4, 2]], [[3, 4], [1, 2]], [[-1, 3], [0, 1], [1, 2]]] },
        v4: { p: [0, 4, 0, 0], sc: [0, 'hmin', 0, 0], m: [[[2, 3], [1, 1], [0, 2]], [[-1, 3, 1], [-2, 1, 1], [-1, 2, 1]], [[0, 6]], [[0, 4], [null, 2]]] },
        c1: { p: [2, 2, 6, 6], m: [[[6, 6]], [[6, 3], [5, 1, 1], [4, 2]], [[3, 4], [1, 2]], [[-1, 3], [0, 1], [1, 2]]] },
        c2: { p: [0, 0, 4, 4], sc: [0, 0, 'hmin', 'hmin'], m: [[[2, 4], [0, 2]], [[0, 3], [-1, 1, 1], [0, 2]], [[1, 4], [-1, 2, 1]], [[-3, 6]]] },
        c4: { p: [0, 4, 0, 0], sc: [0, 'hmin', 0, 0], m: [[[2, 3], [1, 1], [0, 2]], [[-1, 3, 1], [-2, 1, 1], [-1, 2, 1]], [[0, 6]], [[0, 4], [0, 2]]] },
        end: { p: [0, 4, 0, 0], sc: [0, 'hmin', 0, 0], m: [[[2, 3], [1, 1], [0, 2]], [[-1, 3, 1], [-2, 1, 1], [-1, 2, 1]], [[0, 6]], [[0, 6]]] },
        form: [['intro', 0, 0], ['v1', 0, 0], ['v2', 0, 0], ['v3', 0, 0], ['v4', 0, 0], ['c1', 0, 1], ['c2', 0, 1], ['c1', 0, 1], ['c4', 0, 1],
          ['v1', 2, 1], ['v2', 2, 1], ['v3', 2, 1], ['v4', 2, 1], ['c1', 0, 1], ['c2', 0, 1], ['c1', 0, 1], ['end', 0, 0]] } },
  });
  // ---------- composing: a theme of its own, or a written tune ----------
  const TB = (M, m) => m.map(bar => { let s = 0; return bar.map(([d, l, sh]) => { const n = { s, l, d: d === null ? 0 : d, acc: s % (M.beat || (M.meter === 6 ? 3 : 4)) === 0 ? 1 : 0.8 }; if (d === null) n.r = 1; if (sh) n.sh = sh; s += l; return n; }); });
  const L = (lute, mel, drum, drone, ctr) => ({ lute, mel, drum, drone, ctr }), restOf = M => ({ rest: M.pause[0] + Math.floor(rnd() * (M.pause[1] - M.pause[0] + 1)), ly: L(0, 0, 0, 0), p: [0, 0, 0, 0] });
  function tuneOf(M) { const U = M.tune, F = [];
    for (const [k, inst, dr] of U.form) { const x = U[k]; F.push({ p: x.p, m: TB(M, x.m), scB: x.sc, mel: inst === 2 ? M.mel2 : undefined, ly: L(1, 1, dr, 0) }); }
    F.push(restOf(M)); return { F, si: 0, bi: 0, k: 0.97 + rnd() * 0.06 }; }
  const c0 = K.hooks.compose;
  K.hooks.compose = mood => { const M = MOODS[mood]; if (M && M.tune) return tuneOf(M); if (!M || !M.themeA) return c0 ? c0(mood) : null;
    const pa = M.themeA.p, A0 = TB(M, M.themeA.m), pb = pick(M.prog.filter(x => x.join() !== pa.join())), pc = pick(M.prog), m2 = M.mel2, F = [];
    const B = K.genPhrase(M, pb, K.nearCT(M.hi - 2, pb[0], M)), A2 = K.vary(M, A0, pa), B2 = K.vary(M, B, pb);
    F.push({ p: pa, ly: L(1, 0, M.introDrum ? 1 : 0, 1) }, { p: pa, m: A0, ly: L(1, 1, 1, 1) }, { p: pa, m: A2, ly: L(1, 1, 1, 1, 1) });
    F.push({ p: pb, m: B, mel: m2, lute: M.lute2, ly: L(1, 1, 1, 0) }, { p: pb, m: B2, mel: m2, lute: M.lute2, ly: L(1, 1, 1, 1, 1) });
    if (M.brk) F.push({ p: pc, ly: L(1, 0, 1, 1) });
    F.push({ p: pa, m: A0, ly: L(1, 1, 1, 1, 1) }, { p: pa, m: A2, ly: L(1, 1, 0, 1) }, restOf(M));
    return { F, si: 0, bi: 0, k: 0.96 + rnd() * 0.08 }; };
  // ---------- where they play ----------
  const COURTF = ['basse', 'pavane', 'rondeau', 'peace', 'greensl', 'study', 'throne', 'council'];
  Object.assign(FAM, {
    court: COURTF, study: COURTF, throne: COURTF, council: COURTF, sick: ['vigil', 'pavane', 'study'],
    outdoor: ['rondeau', 'peace', 'saltarello', 'estampie', 'summer', 'maying'], outdoor_sp: ['maying', 'rondeau', 'peace', 'saltarello', 'summer'], garden: ['maying', 'rondeau', 'peace', 'summer', 'saltarello'],
    outdoor_au: ['autumn', 'rondeau', 'peace', 'harvest'], outdoor_w: ['winter', 'nocturne', 'autumn', 'carol'],
    village: ['bransle', 'estampie', 'saltarello', 'peace', 'summer'], village_au: ['harvest', 'bransle', 'estampie', 'peace'], village_w: ['winter', 'bransle', 'tavern', 'carol'],
    town: ['estampie', 'bransle', 'rondeau', 'saltarello', 'greensl'], tavern: ['tavern', 'feast', 'estampie', 'bransle', 'greensl'],
    feast: ['feast', 'tavern', 'basse', 'estampie', 'greensl'], feast_w: ['carol', 'feast', 'tavern', 'basse'],
    night: ['nocturne', 'lullaby', 'starlight'], chapel: ['chant', 'hymn', 'litany'], camp: ['campfire', 'nocturne', 'watch'],
    hunt: ['chasse', 'saltarello', 'greenwood'], lament: ['lament', 'requiem'],
    map: ['peace', 'pilgrim', 'rondeau', 'road', 'summer'], map_w: ['winter', 'pilgrim', 'nocturne', 'carol'],
  });
  const LEAD = { study: 'study', throne: 'throne', council: 'council', garden: 'maying', sick: 'vigil', feast_w: 'carol' };
  K.hooks.lead = fam => (LEAD[fam] && MOODS[LEAD[fam]] ? LEAD[fam] : null);
  let sgK = -1, sgV = false; // someone of the royal house lies gravely ill (looked at twice an hour)
  function sickGrave() { if (!G || !G.court || typeof DIS === 'undefined') return false; const k = G.day * 48 + Math.floor(hourAbs() * 2); if (k === sgK) return sgV; sgK = k;
    const P = [kingC()].concat(typeof royalFamily === 'function' ? royalFamily() : []); sgV = P.some(c => c && c.alive && c.ill && c.ill.bed && DIS[c.ill.k] && DIS[c.ill.k].m[ageCls(c)] > 0); return sgV; }
  const r0 = K.hooks.resolve, ROOMF = { 'Библиотека': 'study', 'Звездочётная': 'study', 'Тронный зал': 'throne', 'Зал совета': 'council' };
  K.hooks.resolve = want => {
    if (want === 'sick') return 'sick';
    const r = r0 ? r0(want) : null;
    try {
      if (want === 'feast') return r === 'feast' && seasonOf(G.day) === 3 ? 'feast_w' : r;
      if (want !== 'auto' || !r || !G) return r;
      const s = seasonOf(G.day);
      if (SCREEN === 'court' && !G.visit) {
        if (r === 'court') return sickGrave() ? 'sick' : ROOMF[COURT.room] || r;
        if (r === 'outdoor') return COURT.room === 'Сад' && s < 2 ? 'garden' : s === 0 ? 'outdoor_sp' : r;
      }
      if (r === 'village' && s === 2) return 'village_au';
    } catch (_) { }
    return r;
  };
  if (typeof SNDU !== 'undefined' && SNDU.NAME) Object.assign(SNDU.NAME, { maying: 'Майская', study: 'Размышление', throne: 'Тронная', council: 'Совет', vigil: 'Бдение у постели', summer: 'Летняя', harvest: 'Жатва',
    carol: 'Святочная', starlight: 'Звёздная ночь', litany: 'Литания', watch: 'Ночной дозор', greenwood: 'Лесная', requiem: 'Dies irae', greensl: 'Зелёные рукава' });
})();
