// ===== AUDIO: all music & sound synthesized in WebAudio (no samples, no assets) =====
const Snd = (() => {
  let ac = null, master, comp, musBus, sfxBus, revIn, NB = null, FW = null, timer = 0;
  const P = { on: 1, mus: 1, sfx: 1, mv: 0.55, sv: 0.8 };
  try { Object.assign(P, JSON.parse(localStorage.getItem('sk2_audio') || '{}')); } catch (_) { }
  const save = () => { try { localStorage.setItem('sk2_audio', JSON.stringify(P)); } catch (_) { } };
  const rnd = Math.random, mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const pickW = a => { let s = 0; for (const x of a) s += x[1]; let k = rnd() * s; for (const x of a) { k -= x[1]; if (k <= 0) return x[0]; } return a[0][0]; };
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------- graph ----------
  function mkIR(dur, dec) {
    const sr = ac.sampleRate, n = Math.floor(sr * dur), b = ac.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) { const k = i / n, damp = 0.55 - 0.45 * k; lp += ((rnd() * 2 - 1) - lp) * damp; d[i] = lp * Math.pow(1 - k, dec); }
      for (let e = 0; e < 7; e++) { const i = Math.floor(sr * (0.008 + rnd() * 0.07)); d[i] += (rnd() < 0.5 ? -1 : 1) * (0.5 - e * 0.05); }
    }
    return b;
  }
  function init(ctx) {
    ac = ctx;
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -15; comp.knee.value = 12; comp.ratio.value = 3.2; comp.attack.value = 0.005; comp.release.value = 0.22;
    master = ac.createGain(); master.gain.value = P.on ? 1 : 0; master.connect(comp); comp.connect(ac.destination);
    const conv = ac.createConvolver(); conv.buffer = mkIR(2.8, 2.6); revIn = ac.createGain(); const rOut = ac.createGain(); rOut.gain.value = 0.85;
    revIn.connect(conv); conv.connect(rOut); rOut.connect(master);
    musBus = ac.createGain(); musBus.gain.value = P.mus ? P.mv : 0; musBus.connect(master);
    const mr = ac.createGain(); mr.gain.value = 0.34; musBus.connect(mr); mr.connect(revIn);
    sfxBus = ac.createGain(); sfxBus.gain.value = P.sfx ? P.sv : 0; sfxBus.connect(master);
    const sr = ac.createGain(); sr.gain.value = 0.16; sfxBus.connect(sr); sr.connect(revIn);
    NB = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    const im = [0, 1, 0.42, 0.17, 0.08, 0.045, 0.022, 0.011]; FW = ac.createPeriodicWave(new Float32Array(im.length), new Float32Array(im));
  }
  const G_ = (v, dest) => { const g = ac.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
  function pan(dest, p) { if (!ac.createStereoPanner) return dest; const s = ac.createStereoPanner(); s.pan.value = cl(p, -1, 1); s.connect(dest); return s; }
  function filt(type, f, q, dest) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (dest) b.connect(dest); return b; }
  // envelope helpers (exp ramps need >0)
  function envAD(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f0, f1, t, dur, vel, dest, a) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const A = a || 0.003, g = G_(0, dest); envAD(g, t, A, vel, dur); o.connect(g); o.start(t); o.stop(t + dur + A + 0.05); return o;
  }
  function nz(t, dur, type, f, q, vel, dest, o) {
    const s = ac.createBufferSource(); s.buffer = NB; s.loop = true; const fl = filt(type, f, q);
    if (o && o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = G_(0, dest); envAD(g, t, (o && o.a) || 0.002, vel, dur); s.connect(fl); fl.connect(g); s.start(t, rnd() * 1.8); s.stop(t + dur + 0.1); return g;
  }

  // ---------- instruments ----------
  const KS = {};
  function ksBuf(m) { // Karplus–Strong plucked string, pre-rendered once per pitch
    if (KS[m]) return KS[m];
    const sr = ac.sampleRate, f = mtof(m), N = Math.max(4, Math.round(sr / f - 0.5)), f0 = sr / (N + 0.5);
    const T60 = cl(3.4 - (m - 38) * 0.045, 0.9, 3.4), len = Math.floor(sr * (T60 * 0.75 + 0.25));
    const buf = ac.createBuffer(1, len, sr), out = buf.getChannelData(0), ring = new Float32Array(N);
    let lp = 0, mean = 0; for (let i = 0; i < N; i++) { lp += ((rnd() * 2 - 1) - lp) * 0.6; ring[i] = lp; mean += lp; } mean /= N; for (let i = 0; i < N; i++) ring[i] -= mean;
    const rho = Math.pow(10, -3 / (T60 * f0)); let idx = 0;
    for (let i = 0; i < len; i++) { const nx = idx + 1 === N ? 0 : idx + 1, v = ring[idx]; out[i] = v; ring[idx] = (v + ring[nx]) * 0.5 * rho; idx = nx; }
    const pd = Math.max(1, Math.round(N * 0.17)); for (let i = len - 1; i >= pd; i--) out[i] -= 0.55 * out[i - pd];
    let pk = 0; for (let i = 0; i < len; i++) { const a = Math.abs(out[i]); if (a > pk) pk = a; }
    const g = 0.9 / (pk || 1), fade = Math.floor(sr * 0.04); for (let i = 0; i < len; i++) out[i] *= g * (i > len - fade ? (len - i) / fade : 1);
    return KS[m] = { buf, rate: f / f0 };
  }
  function lute(m, t, vel, dest, mute) {
    const k = ksBuf(m), s = ac.createBufferSource(); s.buffer = k.buf; s.playbackRate.value = k.rate;
    const g = G_(vel, dest); s.connect(g);
    if (mute) { g.gain.setValueAtTime(vel, t + mute); g.gain.exponentialRampToValueAtTime(0.0001, t + mute + 0.07); s.start(t); s.stop(t + mute + 0.1); }
    else s.start(t);
  }
  function strum(ms, t, vel, dest, gap) { ms.forEach((m, i) => lute(m, t + i * (gap || 0.018), vel * (1 - i * 0.08), dest)); }
  function flute(m, t, dur, vel, dest) {
    const f = mtof(m), o = ac.createOscillator(); o.setPeriodicWave(FW);
    o.frequency.setValueAtTime(f * 0.982, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const lfo = ac.createOscillator(); lfo.frequency.value = 4.6 + rnd() * 0.9; const lg = G_(0); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.0065, t + Math.max(0.06, Math.min(0.45, dur * 0.7))); lfo.connect(lg); lg.connect(o.frequency);
    const g = G_(0, dest), a = 0.04, s1 = Math.max(t + a + 0.01, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.linearRampToValueAtTime(vel * 0.8, t + a + Math.min(0.15, dur * 0.4)); g.gain.setValueAtTime(vel * 0.8, s1); g.gain.linearRampToValueAtTime(0, s1 + 0.09);
    o.connect(g);
    const ch = nz(t, 0.09, 'bandpass', f * 2.1, 1.4, vel * 0.55, dest); // chiff
    const n = ac.createBufferSource(); n.buffer = NB; n.loop = true; const bp = filt('bandpass', f * 1.5, 0.9); const ng = G_(0, dest);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vel * 0.09, t + 0.05); ng.gain.setValueAtTime(vel * 0.09, s1); ng.gain.linearRampToValueAtTime(0, s1 + 0.08); n.connect(bp); bp.connect(ng);
    const e = s1 + 0.12; o.start(t); lfo.start(t); n.start(t, rnd() * 1.5); o.stop(e); lfo.stop(e); n.stop(e);
  }
  function shawm(m, t, dur, vel, dest) {
    const f = mtof(m), o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = f; o2.frequency.value = f * 1.004;
    const lfo = ac.createOscillator(); lfo.frequency.value = 5.2; const lg = G_(f * 0.004); lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const lp = filt('lowpass', Math.min(5200, f * 7), 0.6), pk = ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1250; pk.Q.value = 1.6; pk.gain.value = 7;
    const m2 = G_(0.35); o1.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(pk);
    const g = G_(0, dest), s1 = Math.max(t + 0.08, t + dur); pk.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.05); g.gain.linearRampToValueAtTime(vel * 0.75, t + 0.2); g.gain.setValueAtTime(vel * 0.75, s1); g.gain.linearRampToValueAtTime(0, s1 + 0.12);
    const e = s1 + 0.15;[o1, o2, lfo].forEach(o => { o.start(t); o.stop(e); });
  }
  function horn(m, t, dur, vel, dest, bright) {
    const f = mtof(m), o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = o2.type = 'sawtooth'; o2.detune.value = 7;
    [o1, o2].forEach(o => { o.frequency.setValueAtTime(f * 0.93, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); });
    const lp = filt('lowpass', f * 1.3, 1.2), b = bright || 1;
    lp.frequency.setValueAtTime(f * 1.3, t); lp.frequency.exponentialRampToValueAtTime(Math.min(7000, f * (4 + 4 * b)), t + 0.08); lp.frequency.exponentialRampToValueAtTime(Math.min(5000, f * 3 * b), t + 0.35);
    o1.connect(lp); o2.connect(lp); const g = G_(0, dest), s1 = Math.max(t + 0.1, t + dur); lp.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.05); g.gain.linearRampToValueAtTime(vel * 0.82, t + 0.25); g.gain.setValueAtTime(vel * 0.82, s1); g.gain.linearRampToValueAtTime(0, s1 + 0.2);
    const e = s1 + 0.25; o1.start(t); o2.start(t); o1.stop(e); o2.stop(e);
  }
  function drone(m, t, dur, vel, dest) {
    const lp = filt('lowpass', 520, 0.7), g = G_(0, dest); lp.connect(g);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.13 + rnd() * 0.08; const lg = G_(170); lfo.connect(lg); lg.connect(lp.frequency);
    const os = [[m, 1, 'sawtooth'], [m + 7, 0.55, 'sawtooth'], [m - 12, 0.5, 'triangle']].map(([mm, v, ty]) => { const o = ac.createOscillator(); o.type = ty; o.frequency.value = mtof(mm); o.detune.value = (rnd() - 0.5) * 8; const og = G_(v); o.connect(og); og.connect(lp); return o; });
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 1.4); g.gain.setValueAtTime(vel, t + Math.max(1.5, dur - 1.2)); g.gain.linearRampToValueAtTime(0, t + dur);
    os.concat([lfo]).forEach(o => { o.start(t); o.stop(t + dur + 0.1); });
  }
  function drum(k, t, vel, dest) {
    if (k === 'low') { tone('sine', 125, 54, t, 0.42, vel, dest, 0.003); nz(t, 0.05, 'bandpass', 900, 0.8, vel * 0.25, dest); }
    else if (k === 'big') { tone('sine', 92, 41, t, 0.95, vel, dest, 0.004); tone('sine', 150, 72, t, 0.3, vel * 0.35, dest, 0.003); nz(t, 0.28, 'lowpass', 420, 0.7, vel * 0.5, dest); }
    else if (k === 'tak') { nz(t, 0.06, 'bandpass', 3200, 1.1, vel * 0.6, dest); tone('triangle', 430, 380, t, 0.05, vel * 0.25, dest); }
    else if (k === 'jingle') { for (let i = 0; i < 3; i++) nz(t + i * 0.024, 0.07, 'highpass', 6800, 0.7, vel * (1 - i * 0.25), dest); }
  }
  function voice(m, t, dur, vel, dest) { // a monk's voice: two detuned saws through 'ah' formants, a slow swell and vibrato
    const f = mtof(m), g = G_(0, dest), f1 = filt('bandpass', 650, 3.2, g), f2 = filt('bandpass', 1080, 4.5, g), A = Math.min(0.22, dur * 0.35), s1 = Math.max(t + A + 0.02, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + A); g.gain.setValueAtTime(vel, s1); g.gain.linearRampToValueAtTime(0, s1 + 0.3);
    const lfo = ac.createOscillator(); lfo.frequency.value = 4.8 + rnd() * 0.6; const lg = G_(0); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.005, t + 0.4); lfo.connect(lg);
    const os = [-7, 6].map(dt => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; lg.connect(o.frequency); o.connect(f1); o.connect(f2); return o; });
    const e = s1 + 0.35; os.concat([lfo]).forEach(o => { o.start(t); o.stop(e); }); }
  function bellV(f, t, vel, dur, dest) {
    [[0.5, 0.3, 1.3], [1, 1, 1], [1.19, 0.45, 0.7], [1.5, 0.35, 0.6], [2, 0.4, 0.5], [2.52, 0.22, 0.4], [2.66, 0.2, 0.35], [3.01, 0.15, 0.3], [4.1, 0.08, 0.2]]
      .forEach(([r, a, d]) => tone('sine', f * r, 0, t, dur * d, vel * a, dest, 0.002));
  }

  // ---------- generative medieval music ----------
  const SC = { dor: [0, 2, 3, 5, 7, 9, 10], mix: [0, 2, 4, 5, 7, 9, 10], aeo: [0, 2, 3, 5, 7, 8, 10], phr: [0, 1, 3, 5, 7, 8, 10] };
  const d2m = (base, sc, d) => { const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7; return base + o * 12 + SC[sc][i]; };
  const R6 = [[3, 3], [2, 1, 3], [1, 1, 1, 3], [2, 1, 2, 1], [3, 2, 1], [1, 1, 1, 1, 2], [2, 1, 1, 2]], C6 = [[3, 3], [2, 1, 3], [6], [1, 1, 1, 3]];
  const R8 = [[4, 4], [2, 2, 4], [3, 1, 2, 2], [2, 1, 1, 4], [1, 1, 2, 4], [2, 2, 2, 2], [3, 1, 4]], C8 = [[4, 4], [2, 2, 4], [8], [3, 1, 4]];
  const RB = [[4, 4], [3, 1, 4], [2, 2, 4], [6, 2], [4, 2, 2]], CB = [[8], [4, 4], [6, 2]];
  const MOODS = {
    title: { g: 1.6, root: 50, sc: 'dor', st: 0.33, meter: 6, prog: [[0, 6, 0, 3], [0, 2, 6, 0], [3, 6, 4, 0], [0, 3, 6, 0]], lute: 'arp', mel: 'flute', mb: 74, lo: -2, hi: 8, drum: 'soft', dr: 38, dv: 0.03, lv: 0.3, mv: 0.1, rest: 0.05,
      theme: [{ p: [0, 6, 0, 3], m: [[[0, 3], [2, 2], [1, 1]], [[-1, 2], [0, 1], [1, 2], [-1, 1]], [[0, 2], [2, 1], [4, 3]], [[5, 2], [4, 1], [3, 3]]] },
      { p: [0, 6, 4, 0], m: [[[4, 3], [2, 2], [0, 1]], [[-1, 2], [1, 1], [3, 2], [1, 1]], [[1, 2], [0, 1], [-1, 3]], [[-1, 1], [0, 1], [1, 1], [0, 3]]] }] },
    peace: { g: 1.65, root: 55, sc: 'mix', st: 0.28, meter: 6, prog: [[0, 6, 3, 0], [0, 3, 6, 0], [0, 4, 6, 0], [3, 0, 6, 0]], lute: 'arp', mel: 'flute', mb: 67, lo: 0, hi: 9, drum: 'dance', dr: 43, dv: 0.018, lv: 0.28, mv: 0.09, rest: 0.06, pause: [2, 5] },
    tension: { g: 1.75, root: 45, sc: 'aeo', st: 0.42, meter: 8, prog: [[0, 5, 6, 0], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 4]], lute: 'sparse', mel: 'shawm', mb: 57, lo: 0, hi: 7, drum: 'heart', dr: 45, dv: 0.036, lv: 0.32, mv: 0.06, rest: 0.3, pause: [2, 3] },
    feast: { g: 1.5, root: 57, sc: 'mix', st: 0.2, meter: 6, prog: [[0, 4, 0, 4], [0, 3, 4, 0], [3, 4, 0, 0], [0, 6, 4, 0]], lute: 'arp', mel: 'shawm', mb: 69, lo: 0, hi: 9, drum: 'dance', dr: 46, dv: 0.028, lv: 0.3, mv: 0.065, rest: 0.04, pause: [1, 2] },
    // v3.4: more music — a stately pavane indoors, a night piece, a village estampie with pipes, plainchant in the chapel, a fife-and-tabor march
    pavane: { g: 2.1, root: 50, sc: 'dor', st: 0.36, meter: 8, prog: [[0, 3, 4, 0], [0, 6, 3, 4], [5, 3, 4, 0], [0, 4, 5, 0]], lute: 'pav', mel: 'flute', mb: 62, lo: 0, hi: 8, drum: 'tabor', dr: 38, dv: 0.02, lv: 0.3, mv: 0.085, rest: 0.1, pause: [1, 3] },
    nocturne: { g: 2.4, root: 45, sc: 'aeo', st: 0.42, meter: 6, prog: [[0, 5, 3, 4], [0, 3, 6, 0], [0, 5, 6, 0], [5, 3, 4, 0]], lute: 'harp', mel: 'flute', mb: 64, lo: 0, hi: 7, drum: 'none', dr: 33, dv: 0.016, lv: 0.26, mv: 0.06, rest: 0.3, pause: [2, 4] },
    estampie: { g: 1.65, root: 52, sc: 'mix', st: 0.17, meter: 6, prog: [[0, 6, 0, 4], [0, 3, 0, 4], [0, 6, 3, 4], [3, 0, 4, 0]], lute: 'arp', mel: 'shawm', mb: 64, lo: 0, hi: 8, drum: 'jig', dr: 40, dv: 0.03, lv: 0.24, mv: 0.055, rest: 0.03, pause: [1, 2] },
    chant: { g: 2.4, root: 50, sc: 'dor', st: 0.55, meter: 8, prog: [[0, 3, 0, 4], [0, 6, 3, 0], [0, 4, 3, 0], [0, 3, 6, 0]], lute: 'none', mel: 'chant', mb: 57, lo: -1, hi: 6, drum: 'none', dr: 38, dv: 0.03, lv: 0, mv: 0.15, rest: 0.08, pause: [2, 3] },
    march: { g: 2.0, root: 48, sc: 'mix', st: 0.25, meter: 8, prog: [[0, 4, 0, 4], [0, 3, 4, 0], [0, 6, 4, 0], [3, 4, 0, 0]], lute: 'ost', mel: 'fife', mb: 72, lo: 0, hi: 8, drum: 'march', dr: 36, dv: 0.02, lv: 0.18, mv: 0.07, rest: 0.05, pause: [1, 2] },
    battle: { g: 0.85, root: 40, sc: 'phr', st: 0.24, meter: 8, prog: [[0, 1, 0, 6], [0, 5, 6, 0], [0, 1, 6, 0], [5, 6, 0, 0]], lute: 'ost', mel: 'horn', mb: 52, lo: 0, hi: 7, drum: 'war', dr: 40, dv: 0.026, lv: 0.24, mv: 0.075, rest: 0.08 },
  };
  const STEPW = [[0, 6], [1, 30], [-1, 30], [2, 11], [-2, 11], [3, 4], [-3, 4], [4, 2], [-4, 2]];
  function walk(d, M) { let s = pickW(STEPW); const mid = (M.lo + M.hi) / 2; if ((d > mid + 2 && s > 0) || (d < mid - 2 && s < 0)) if (rnd() < 0.45) s = -s; let n = d + s; if (n > M.hi || n < M.lo) n = d - s; return cl(n, M.lo, M.hi); }
  const isCT = (d, c) => { const k = ((d - c) % 7 + 7) % 7; return k === 0 || k === 2 || k === 4; };
  function nearCT(d, c, M) { for (const o of [0, -1, 1, -2, 2, -3, 3]) { const n = d + o; if (n >= M.lo && n <= M.hi && isCT(n, c)) return n; } return d; }
  function nearRoot(d, c, M) { for (const o of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6]) { const n = d + o; if (n >= M.lo && n <= M.hi && ((n - c) % 7 + 7) % 7 === 0) return n; } return nearCT(d, c, M); }
  function genBar(M, rhy, c, d0, cad) {
    const out = []; let s = 0, d = d0; const beat = M.meter === 6 ? 3 : 4;
    rhy.forEach((l, i) => {
      if (i > 0 || rnd() < 0.85) d = walk(d, M);
      const strong = s % beat === 0, last = i === rhy.length - 1;
      if (strong || l >= beat) d = nearCT(d, c, M);
      if (cad && last) d = nearRoot(d, c, M);
      out.push({ s, l, d, r: !strong && !last && rnd() < M.rest, acc: strong ? 1 : 0.78 }); s += l;
    });
    return out;
  }
  const RH = M => M.meter === 6 ? R6 : M.mel === 'horn' ? RB : R8, CAD = M => M.meter === 6 ? C6 : M.mel === 'horn' ? CB : C8;
  const lastD = b => b[b.length - 1].d;
  function genPhrase(M, p, d0) {
    const r0 = pick(RH(M)), b0 = genBar(M, r0, p[0], d0, false); let b1;
    if (rnd() < 0.5) { let sh = p[1] - p[0]; if (sh > 3) sh -= 7; if (sh < -3) sh += 7; b1 = b0.map(n => Object.assign({}, n, { d: cl(n.d + sh, M.lo, M.hi) })); }
    else b1 = genBar(M, r0, p[1], lastD(b0), false);
    const b2 = genBar(M, pick(RH(M)), p[2], lastD(b1), false), b3 = genBar(M, pick(CAD(M)), p[3], lastD(b2), true);
    return [b0, b1, b2, b3];
  }
  function vary(M, ph, p) { const b2 = genBar(M, pick(RH(M)), p[2], lastD(ph[1]), false); return [ph[0], ph[1], b2, genBar(M, pick(CAD(M)), p[3], lastD(b2), true)]; }
  const themeBars = th => th.m.map(bar => { let s = 0; return bar.map(([d, l]) => { const n = { s, l, d, acc: s % 3 === 0 ? 1 : 0.8 }; s += l; return n; }); });
  function compose(mood) {
    const M = MOODS[mood], pa = pick(M.prog), pb = pick(M.prog.filter(x => x !== pa));
    const mid = Math.round((M.lo + M.hi) / 2), A = genPhrase(M, pa, nearCT(mid, pa[0], M)), B = genPhrase(M, pb, nearCT(M.hi - 2, pb[0], M)), A2 = vary(M, A, pa);
    const L = (lute, mel, drum, drone) => ({ lute, mel, drum, drone }), F = [];
    if (mood === 'title') {
      const T1 = { p: M.theme[0].p, m: themeBars(M.theme[0]) }, T2 = { p: M.theme[1].p, m: themeBars(M.theme[1]) };
      F.push({ p: T1.p, ly: L(1, 0, 0, 1) }, { p: T1.p, m: T1.m, ly: L(1, 1, 0, 1) }, { p: T2.p, m: T2.m, ly: L(1, 1, 1, 1) }, { p: pb, m: B, ly: L(1, 1, 1, 0) }, { p: pa, m: A, ly: L(1, 1, 1, 1) }, { p: T1.p, m: T1.m, ly: L(1, 1, 1, 1) }, { p: T2.p, m: T2.m, ly: L(1, 1, 0, 1) });
    } else if (mood === 'battle') {
      F.push({ p: pa, ly: L(1, 0, 1, 1) }, { p: pa, m: A, ly: L(1, 1, 1, 1) }, { p: pb, m: B, ly: L(1, 1, 1, 1) }, { p: pa, m: A2, ly: L(1, 1, 1, 1) }, { p: pb, ly: L(1, 0, 1, 1) });
    } else if (mood === 'chant') {
      F.push({ p: pa, ly: L(0, 0, 0, 1) }, { p: pa, m: A, ly: L(0, 1, 0, 1) }, { p: pb, m: B, ly: L(0, 1, 0, 1) }, { p: pa, m: A2, ly: L(0, 1, 0, 1) }, { rest: M.pause[0] + Math.floor(rnd() * (M.pause[1] - M.pause[0] + 1)), ly: L(0, 0, 0, 1), p: [0, 0, 0, 0] });
    } else if (mood === 'tension') {
      F.push({ p: pa, ly: L(0, 0, 1, 1) }, { p: pa, m: A, ly: L(1, 1, 1, 1) }, { p: pb, m: B, ly: L(1, 1, 0, 1) }, { p: pa, m: A2, ly: L(1, 1, 1, 1) }, { rest: M.pause[0] + Math.floor(rnd() * (M.pause[1] - M.pause[0] + 1)), ly: L(0, 0, 0, 1), p: [0, 0, 0, 0] });
    } else {
      F.push({ p: pa, ly: L(1, 0, 0, 0) }, { p: pa, m: A, ly: L(1, 1, 0, 0) }, { p: pa, m: A2, ly: L(1, 1, 1, 1) }, { p: pb, m: B, ly: L(1, 1, 1, 0) }, { p: pa, m: A, ly: L(1, 1, 1, 1) }, { rest: M.pause[0] + Math.floor(rnd() * (M.pause[1] - M.pause[0] + 1)), ly: L(0, 0, 0, 0), p: [0, 0, 0, 0] });
    }
    return { F, si: 0, bi: 0, k: 0.96 + rnd() * 0.08 };
  }
  const LUTE = {
    none() { },
    harp(S, c, t, st, v, bus) { const M = S.M, b = c > 3 ? c - 7 : c; [0, 2, 4, 7, 9, 11].forEach((x, i) => lute(d2m(M.root, M.sc, b + x), t + i * st + (rnd() - 0.5) * 0.01, v * (0.9 - i * 0.08), bus)); },
    pav(S, c, t, st, v, bus) { const M = S.M, b = c > 3 ? c - 7 : c; strum([0, 4, 7, 9].map(x => d2m(M.root, M.sc, b + x)), t, v * 0.7, bus, 0.03);
      lute(d2m(M.root, M.sc, b - 7), t + 2 * st, v * 0.5, bus); lute(d2m(M.root, M.sc, b + 4), t + 4 * st, v * 0.45, bus); lute(d2m(M.root, M.sc, b + 2), t + 6 * st, v * 0.4, bus); },
    arp(S, c, t, st, v, bus) { const M = S.M, b = c > 3 ? c - 7 : c, h = () => (rnd() - 0.5) * 0.012;
      if (rnd() < 0.22) { strum([0, 4, 7, 9].map(x => d2m(M.root, M.sc, b + x)), t, v * 0.75, bus); [[3, 7, 0.5], [4, 9, 0.45], [5, 4, 0.4]].forEach(([s, x, vv]) => lute(d2m(M.root, M.sc, b + x), t + s * st + h(), v * vv, bus)); }
      else [0, 4, 7, 9, 7, 4].forEach((x, i) => lute(d2m(M.root, M.sc, b + x), t + i * st + h(), v * [0.95, 0.5, 0.62, 0.55, 0.5, 0.45][i] * (0.9 + rnd() * 0.2), bus)); },
    sparse(S, c, t, st, v, bus) { const M = S.M, b = c > 3 ? c - 7 : c; strum([0, 4, 7].map(x => d2m(M.root, M.sc, b + x)), t, v * 0.8, bus, 0.05);
      if (rnd() < 0.55) lute(d2m(M.root, M.sc, b + pick([7, 9])), t + 4 * st, v * 0.35, bus); if (rnd() < 0.3) lute(d2m(M.root, M.sc, b + 4), t + 6 * st, v * 0.28, bus); },
    ost(S, c, t, st, v, bus) { const M = S.M, b = c > 3 ? c - 7 : c; [0, 0, 4, 0, 7, 0, 4, 0].forEach((x, i) => lute(d2m(M.root, M.sc, b + x), t + i * st, v * [1, 0.5, 0.7, 0.5, 0.9, 0.5, 0.7, 0.6][i], bus, 0.13)); },
  };
  const MEL = {
    flute(m, t, d, v, bus, n) { if (n.l >= 2 && rnd() < 0.13) flute(m + (SC.dor.includes((m + 1) % 12) ? 2 : 1), t - 0.055, 0.05, v * 0.7, bus); flute(m, t, d, v, bus); },
    shawm(m, t, d, v, bus) { shawm(m, t, d, v, bus); },
    fife(m, t, d, v, bus) { flute(m, t, d * 0.82, v, bus); },
    chant(m, t, d, v, bus) { voice(m, t, d, v, bus); voice(m - 7, t + 0.02, d, v * 0.5, bus); }, // organum: the line doubled a fifth below
    horn(m, t, d, v, bus) { horn(m, t, d, v, bus); horn(m - 7, t + 0.01, d, v * 0.6, bus, 0.8); },
  };
  const DRUM = {
    none() { },
    tabor(t, st, bi, bus) { drum('low', t, 0.28, bus); drum('tak', t + 2 * st, 0.09, bus); drum('tak', t + 4 * st, 0.13, bus); drum('tak', t + 6 * st, 0.09, bus); },
    jig(t, st, bi, bus) { drum('low', t, 0.34, bus); drum('tak', t + st, 0.07, bus); drum('tak', t + 2 * st, 0.1, bus); drum('low', t + 3 * st, 0.24, bus); drum('tak', t + 5 * st, 0.12, bus); if (bi % 2) drum('jingle', t, 0.08, bus); },
    march(t, st, bi, bus) { drum('low', t, 0.4, bus); drum('tak', t + 2 * st, 0.2, bus); drum('low', t + 4 * st, 0.32, bus); drum('tak', t + 6 * st, 0.16, bus); drum('tak', t + 7 * st, 0.12, bus); if (bi === 3) for (let i = 0; i < 4; i++) drum('tak', t + (6 + i * 0.5) * st, 0.1 + i * 0.03, bus); },
    soft(t, st, bi, bus) { drum('low', t, 0.32, bus); drum('low', t + 3 * st, 0.16, bus); },
    dance(t, st, bi, bus) { drum('low', t, 0.36, bus); drum('tak', t + 2 * st, 0.12, bus); drum('low', t + 3 * st, 0.22, bus); drum('tak', t + 5 * st, 0.14, bus); if (bi % 2) drum('jingle', t + 3 * st, 0.1, bus); },
    heart(t, st, bi, bus) { drum('low', t, 0.36, bus); drum('low', t + 0.24, 0.22, bus); if (bi === 3) drum('big', t + 6 * st, 0.22, bus); },
    war(t, st, bi, bus) { drum('big', t, 0.8, bus); drum('low', t + 2 * st, 0.32, bus); drum('low', t + 3 * st, 0.42, bus); drum('big', t + 4 * st, 0.7, bus); drum('tak', t + 6 * st, 0.38, bus); drum('tak', t + 7 * st, 0.3, bus);
      if (bi === 3) for (let i = 0; i < 8; i++) drum('low', t + (4 + i * 0.5) * st, 0.2 + i * 0.04, bus); },
  };
  function schedBar(S, t) {
    const M = S.M, pc = S.pc, sec = pc.F[pc.si], st = M.st * pc.k, barD = st * M.meter, ly = sec.ly;
    if (ly.drone && pc.bi === 0) drone(M.dr, t, barD * (sec.rest || 4) + 0.6, M.dv, S.b.dr);
    if (!sec.rest) {
      const c = sec.p[pc.bi];
      if (ly.lute) LUTE[M.lute](S, c, t, st, M.lv, S.b.lu);
      if (ly.mel && sec.m) for (const n of sec.m[pc.bi]) if (!n.r) MEL[M.mel](d2m(M.mb, M.sc, n.d), t + n.s * st + (rnd() - 0.5) * 0.01, n.l * st * 0.94, M.mv * n.acc * (0.92 + rnd() * 0.16), S.b.me, n);
      if (ly.drum) DRUM[M.drum](t, st, pc.bi, S.b.dm);
    }
    pc.bi++; if (pc.bi >= (sec.rest || 4)) { pc.bi = 0; pc.si++; if (pc.si >= pc.F.length) nextPiece(S, t + barD); }
    return barD;
  }
  function startSeq(mood, t) {
    const pg = G_(0, musBus); pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(MOODS[mood].g || 1, t + 1.2);
    const body = ac.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 240; body.Q.value = 0.9; body.gain.value = 3; const lp = filt('lowpass', 5200, 0.5, pan(pg, -0.22)); body.connect(lp);
    return { mood, M: MOODS[mood], pc: compose(mood), t: t + 0.1, pg, b: { lu: body, me: pan(pg, 0.2), dm: pan(pg, 0.05), dr: pg } };
  }
  function fadeOut(S) { const t = ac.currentTime, g = S.pg.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 1.6); setTimeout(() => { try { S.pg.disconnect(); } catch (_) { } }, 2600); }
  // playlists: the place and hour pick a family of pieces; a family plays its pieces in turn, so the music changes from piece to piece
  const FAM = { war: ['tension', 'march'], night: ['nocturne'], chapel: ['chant'], indoor: ['pavane', 'peace'], outdoor: ['peace', 'estampie'], village: ['estampie', 'peace'], map: ['peace', 'march', 'estampie'], feast: ['feast', 'estampie'] };
  const famList = f => FAM[f] || [f];
  function nextPiece(S, t) { const L0 = famList(S.fam || S.mood); let nm = S.mood; if (L0.length > 1) { const i = L0.indexOf(S.mood); nm = i < 0 ? L0[0] : L0[(i + 1 + Math.floor(rnd() * (L0.length - 1))) % L0.length]; }
    if (nm !== S.mood && MOODS[nm]) { S.mood = nm; S.M = MOODS[nm]; const g = S.pg.gain; g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(S.M.g || 1, t + 1); } S.pc = compose(S.mood); }
  let cur = null, want = 'title';
  function resolve() {
    if (want !== 'auto') return want;
    try { if (typeof G !== 'undefined' && G && G.player && warsOf(G.player.realm).length) return 'war'; } catch (_) { }
    try { const h = hourAbs(), night = h >= 21.5 || h < 4.5;
      if (SCREEN === 'court' && COURT.loc) { const id = COURT.loc, L = LOCS[id]; if (/chap/.test(id)) return 'chapel'; if (night) return 'night'; if (L && !L.out) return 'indoor'; return G.visit && (G.visit.kind === 'village' || G.visit.kind === 'town') ? 'village' : 'outdoor'; }
      return night ? 'night' : 'map'; } catch (_) { }
    return 'outdoor';
  }

  // ---------- ambience (weather) & battle roar ----------
  let amb = null, ambK = null, roar = null, bnT = 0, bnAcc = 0, nextBird = 0, nextThunder = 0;
  function loopNoise(type, f, q, dest) { const s = ac.createBufferSource(); s.buffer = NB; s.loop = true; const fl = filt(type, f, q); const g = G_(0, dest); s.connect(fl); fl.connect(g); s.start(); return { s, fl, g }; }
  function ensureAmb() {
    if (amb) return; amb = { rain: loopNoise('highpass', 1100, 0.5, sfxBus), wind: loopNoise('bandpass', 420, 1.2, sfxBus) };
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.09; const lg = G_(220); lfo.connect(lg); lg.connect(amb.wind.fl.frequency); lfo.start();
  }
  function bird(t) { const f = 2600 + rnd() * 1600, n = 2 + Math.floor(rnd() * 4), p = pan(sfxBus, rnd() * 1.6 - 0.8); for (let i = 0; i < n; i++) { const tt = t + i * (0.09 + rnd() * 0.05); tone('sine', f * (1 + rnd() * 0.15), f * (0.75 + rnd() * 0.5), tt, 0.07, 0.025, p, 0.01); } }
  function thunder(t) { nz(t, 2.8, 'lowpass', 260, 0.8, 0.22, sfxBus, { a: 0.15, f1: 70 }); nz(t + 0.05, 0.5, 'lowpass', 900, 0.6, 0.12, sfxBus, { a: 0.01, f1: 200 }); }
  function ambTick(now) {
    let k = null;
    let ins = 0; try { if (typeof SCREEN !== 'undefined' && (SCREEN === 'map' || SCREEN === 'court') && typeof G !== 'undefined' && G && G.weather) { k = G.weather.k; if (SCREEN === 'court' && LOCS[COURT.loc] && !LOCS[COURT.loc].out) ins = 1; } } catch (_) { }
    const on = P.sfx && P.on; if (!on) k = null;
    if (k || amb) { ensureAmb();
      const rv = k === 'rain' ? 0.035 : k === 'storm' ? 0.07 : 0, wv = k === 'blizzard' ? 0.09 : k === 'snow' ? 0.03 : k === 'wind' ? 0.05 : k === 'storm' ? 0.03 : k === 'cloud' ? 0.008 : 0;
      amb.rain.g.gain.setTargetAtTime(rv * (ins ? 0.3 : 1), now, 1.2); amb.wind.g.gain.setTargetAtTime(wv * (ins ? 0.4 : 1), now, 1.5); }
    if (k === 'storm' && now > nextThunder) { if (nextThunder) thunder(now + 0.1); nextThunder = now + 12 + rnd() * 20; }
    if ((k === 'clear' || k === 'cloud') && now > nextBird) { let s = 1; try { s = seasonOf(G.day); } catch (_) { } if (nextBird && s < 2 && G.speed > 0 && !ins && !(SCREEN === 'court' && typeof isNight === 'function' && isNight())) bird(now + 0.05); nextBird = now + 4 + rnd() * 9; }
    ambK = k;
    if (roar && now - bnT > 0.35) roar.g.gain.setTargetAtTime(0, now, 0.35);
  }
  function clash(t) {
    const p = pan(sfxBus, rnd() * 1.4 - 0.7), r = rnd();
    if (r < 0.5) { const f = 1700 + rnd() * 1600, v = 0.035 + rnd() * 0.05; [[1, 1, 0.22], [1.52, 0.6, 0.16], [2.33, 0.45, 0.1], [3.1, 0.25, 0.07]].forEach(([k, a, d]) => tone('sine', f * k, 0, t, d, v * a, p, 0.001)); nz(t, 0.025, 'highpass', 3500, 0.7, v * 0.9, p); }
    else if (r < 0.8) { nz(t, 0.09, 'lowpass', 700, 0.8, 0.09, p); tone('sine', 150, 80, t, 0.1, 0.06, p); }
    else { const f = 160 + rnd() * 110, o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.4);
      const b1 = filt('bandpass', 750 + rnd() * 200, 3), b2 = filt('bandpass', 1250, 4), g = G_(0, p); o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g); envAD(g, t, 0.04, 0.05, 0.38); o.start(t); o.stop(t + 0.5); }
  }

  // ---------- sound effects ----------
  const SFX = {
    door(t) { nz(t, 0.2, 'lowpass', 260, 0.9, 0.26, sfxBus, { a: 0.005, f1: 120 }); tone('sine', 92, 58, t, 0.18, 0.12, sfxBus); tone('sawtooth', 240, 170, t + 0.03, 0.26, 0.01, sfxBus, 0.05); },
    chime(t) { bellV(880, t, 0.035, 1.1, sfxBus); bellV(1320, t + 0.12, 0.02, 0.9, sfxBus); },
    swish(t) { nz(t, 0.14, 'bandpass', 1900, 1.4, 0.14, sfxBus, { a: 0.03, f1: 700 }); },
    thud(t) { nz(t, 0.09, 'lowpass', 500, 0.8, 0.16, sfxBus); tone('sine', 130, 70, t, 0.09, 0.08, sfxBus); },
    click(t) { nz(t, 0.022, 'bandpass', 2600, 1.3, 0.2, sfxBus); tone('triangle', 900, 600, t, 0.035, 0.09, sfxBus); },
    paper(t) { for (let i = 0; i < 5; i++) nz(t + i * 0.035 + rnd() * 0.02, 0.05 + rnd() * 0.05, 'bandpass', 2800 + rnd() * 2800, 0.8, 0.1 + rnd() * 0.08, sfxBus); },
    coin(t) { const n = 2 + (rnd() < 0.5 ? 1 : 0); for (let k = 0; k < n; k++) { const tt = t + k * 0.07 + rnd() * 0.02, f = 2100 + rnd() * 500; [[1, 0.14, 0.3], [1.47, 0.08, 0.22], [2.09, 0.06, 0.16], [2.83, 0.03, 0.1]].forEach(([r, v, d]) => tone('sine', f * r, 0, tt, d, v, sfxBus, 0.001)); nz(tt, 0.012, 'highpass', 5000, 0.7, 0.12, sfxBus); } },
    horn(t) { horn(43, t, 1.35, 0.2, sfxBus, 0.9); horn(50, t + 0.03, 1.3, 0.1, sfxBus, 0.8); },
    horn_low(t) { horn(38, t, 0.9, 0.18, sfxBus, 0.7); },
    horn_short(t) { horn(50, t, 0.26, 0.15, sfxBus); horn(57, t + 0.01, 0.24, 0.07, sfxBus); },
    arrows(t) { for (let i = 0; i < 6; i++) { const tt = t + rnd() * 0.3; nz(tt, 0.16 + rnd() * 0.08, 'bandpass', 3800 + rnd() * 1500, 2.2, 0.05, pan(sfxBus, rnd() * 1.2 - 0.6), { a: 0.05, f1: 900 }); } nz(t + 0.45, 0.06, 'lowpass', 900, 0.7, 0.05, sfxBus); },
    march(t) { for (let i = 0; i < 4; i++) { const tt = t + i * 0.15 + rnd() * 0.03; nz(tt, 0.09, 'lowpass', 380, 0.8, 0.12 - i * 0.015, sfxBus); if (i % 2 === 0) nz(tt + 0.01, 0.05, 'highpass', 6000, 0.8, 0.03, sfxBus); } },
    raven(t) { [0, 0.34].forEach((d, i) => { const tt = t + d, f = 520 - i * 40, o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 0.72, tt + 0.26);
      const am = ac.createOscillator(); am.frequency.value = 34; const ag = G_(0.5); am.connect(ag); const b = filt('bandpass', 1350, 2.2), g = G_(0, sfxBus); const g2 = G_(0.5); ag.connect(g2.gain); o.connect(b); b.connect(g2); g2.connect(g); envAD(g, tt, 0.02, 0.22, 0.26); o.start(tt); am.start(tt); o.stop(tt + 0.35); am.stop(tt + 0.35); }); },
    bell(t) { bellV(196, t, 0.16, 4.5, sfxBus); bellV(294, t + 1.2, 0.1, 3.6, sfxBus); },
    fire(t) { nz(t, 1.8, 'lowpass', 500, 0.6, 0.1, sfxBus, { a: 0.3, f1: 300 }); for (let i = 0; i < 22; i++) nz(t + rnd() * 1.6, 0.012 + rnd() * 0.02, 'highpass', 2500 + rnd() * 3000, 0.9, 0.04 + rnd() * 0.08, sfxBus); },
    fanfare(t) { const seq = [[62, 0, 0.11], [62, 0.13, 0.11], [62, 0.26, 0.11], [69, 0.39, 0.42], [66, 0.84, 0.18], [69, 1.04, 0.18], [74, 1.24, 0.9]];
      seq.forEach(([m, d, l]) => { horn(m, t + d, l, 0.12, sfxBus, 1.3); horn(m - (m === 74 ? 5 : m === 69 ? 3 : 3), t + d + 0.005, l, 0.07, sfxBus, 1.1); }); drum('big', t + 1.24, 0.5, sfxBus); drum('low', t + 0.39, 0.3, sfxBus); },
    fanfare_small(t) { [62, 66, 69, 74].forEach((m, i) => lute(m, t + i * 0.07, 0.24, sfxBus)); bellV(587, t + 0.3, 0.05, 2, sfxBus); },
    bow(t) { tone('triangle', 196, 128, t, 0.16, 0.09, sfxBus, 0.002); tone('sine', 392, 250, t, 0.07, 0.035, sfxBus, 0.002); nz(t + 0.03, 0.22, 'bandpass', 2600, 1.8, 0.07, sfxBus, { a: 0.02, f1: 800 }); },
    hit(t) { nz(t, 0.05, 'lowpass', 900, 0.8, 0.15, sfxBus); tone('sine', 180, 90, t, 0.07, 0.07, sfxBus); },
    bark(t) { for (let i = 0; i < 2; i++) { const tt = t + i * 0.2 + rnd() * 0.05, f = 400 + rnd() * 120, p = pan(sfxBus, rnd() * 1.2 - 0.6), o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 0.62, tt + 0.1);
      const b = filt('bandpass', 1100, 1.4), g = G_(0, p); o.connect(b); b.connect(g); envAD(g, tt, 0.008, 0.13, 0.11); o.start(tt); o.stop(tt + 0.17); nz(tt, 0.06, 'bandpass', 1700, 1.2, 0.04, p); } },
    growl(t) { nz(t, 0.7, 'lowpass', 320, 1.5, 0.2, sfxBus, { a: 0.08, f1: 150 }); tone('sawtooth', 72, 52, t, 0.6, 0.05, sfxBus, 0.06); },
    clink(t) { for (let k = 0; k < 2; k++) { const tt = t + k * 0.09 + rnd() * 0.02, f = 1500 + rnd() * 400; [[1, 0.07, 0.25], [2.4, 0.03, 0.15], [3.9, 0.012, 0.08]].forEach(([r, v, d]) => tone('sine', f * r, 0, tt, d, v, sfxBus, 0.001)); } },
    cheer(t) { for (let i = 0; i < 10; i++) { const tt = t + rnd() * 0.45; nz(tt, 0.45 + rnd() * 0.6, 'bandpass', 550 + rnd() * 900, 2.4, 0.03, pan(sfxBus, rnd() * 1.6 - 0.8), { a: 0.07, f1: 380 + rnd() * 300 }); } },
    crack(t) { nz(t, 0.07, 'highpass', 1800, 0.7, 0.2, sfxBus); nz(t + 0.01, 0.2, 'bandpass', 900, 1.2, 0.12, sfxBus, { a: 0.004, f1: 380 }); tone('triangle', 230, 90, t, 0.12, 0.05, sfxBus, 0.002); },
    gallop(t) { for (let i = 0; i < 8; i++) { const tt = t + i * 0.15 + (i % 2) * 0.045; nz(tt, 0.05, 'lowpass', 420, 0.9, 0.08, sfxBus); } },
    strum(t) { strum([55, 59, 62, 67, 71], t, 0.22, sfxBus, 0.035); },
    choir(t) { [50, 57, 62, 66].forEach((m, i) => { const f = 440 * Math.pow(2, (m - 69) / 12); tone('sine', f, 0, t + i * 0.05, 2.4, 0.022, sfxBus, 0.5); tone('triangle', f * 2, 0, t + i * 0.05, 2.1, 0.006, sfxBus, 0.6); }); },
    flap(t) { for (let i = 0; i < 5; i++) nz(t + i * 0.075, 0.05, 'bandpass', 650 + rnd() * 350, 1, 0.06, sfxBus); },
    defeat(t) { [[57, 0, 0.55], [55, 0.6, 0.55], [53, 1.2, 0.55], [52, 1.8, 1.5]].forEach(([m, d, l]) => { horn(m, t + d, l, 0.11, sfxBus, 0.6); horn(m - 12, t + d, l, 0.08, sfxBus, 0.5); drum('low', t + d, 0.3, sfxBus); }); },
  };
  const lastPlay = {};
  function tick() {
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime, fam = P.mus && P.on ? resolve() : null;
    if (!fam) { if (cur) { fadeOut(cur); cur = null; } }
    else if (!cur || (cur.fam !== fam && !famList(fam).includes(cur.mood))) { if (cur) fadeOut(cur); const L0 = famList(fam).filter(k => MOODS[k]); cur = startSeq(L0[Math.floor(rnd() * L0.length)] || 'peace', now + (cur ? 0.6 : 0.05)); cur.fam = fam; }
    else cur.fam = fam;
    const ahead = document.hidden ? 1.6 : 0.45;
    if (cur) { if (cur.t < now - 1) cur.t = now + 0.05; let g = 0; while (cur.t < now + ahead && g++ < 8) cur.t += schedBar(cur, cur.t); }
    ambTick(now);
  }
  function unlock() {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; try { init(new C()); } catch (_) { ac = null; return; } timer = setInterval(tick, 90); }
    if (ac.state === 'suspended') ac.resume().catch(() => { });
  }
  addEventListener('keydown', unlock);
  function setBus(b, v) { if (!ac) return; const t = ac.currentTime; b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(v, t + 0.25); }
  return {
    unlock,
    sfx(name) { if (!ac || ac.state !== 'running' || !P.sfx || !P.on || !SFX[name]) return; const now = ac.currentTime; if (lastPlay[name] && now - lastPlay[name] < 0.06) return; lastPlay[name] = now; try { SFX[name](now + 0.01); } catch (e) { console.warn('sfx', name, e); } },
    battleNoise(n) {
      if (!ac || ac.state !== 'running' || !P.sfx || !P.on) return; const now = ac.currentTime, dt = Math.min(0.1, Math.max(0, now - (bnT || now))); bnT = now;
      bnAcc += dt * Math.min(9, 1.2 + n * 0.9); let k = 0; while (bnAcc >= 1 && k++ < 4) { bnAcc -= 1; clash(now + 0.02 + rnd() * 0.08); }
      if (!roar) { roar = loopNoise('bandpass', 520, 0.6, sfxBus); }
      roar.g.gain.setTargetAtTime(Math.min(0.1, 0.018 + n * 0.011), now, 0.3);
    },
    music(m) { want = m; if (ac) tick(); },
    mood: () => cur ? cur.mood : null, family: () => cur ? cur.fam : null,
    muted: () => !P.on, toggle() { P.on = P.on ? 0 : 1; save(); unlock(); if (ac) setBus(master, P.on ? 1 : 0); },
    musOn: () => !!P.mus, toggleMusic() { P.mus = P.mus ? 0 : 1; save(); if (ac) setBus(musBus, P.mus ? P.mv : 0); },
    sfxOn: () => !!P.sfx, toggleSfx() { P.sfx = P.sfx ? 0 : 1; save(); if (ac) setBus(sfxBus, P.sfx ? P.sv : 0); },
    vol(k, v) { if (k === 'mus') { P.mv = cl(v, 0, 1); if (ac && P.mus) setBus(musBus, P.mv); } else { P.sv = cl(v, 0, 1); if (ac && P.sfx) setBus(sfxBus, P.sv); } save(); },
    prefs: () => P,
    // offline render for testing: returns stats of mood (or sfx list) rendered for secs
    async _test(what, secs, wav) {
      const sr = 44100, oc = new OfflineAudioContext(2, sr * secs, sr); const keep = [ac, cur]; init(oc); for (const k in KS) delete KS[k];
      if (MOODS[what]) { const S = startSeq(what, 0); let t = 0.1; while (t < secs) t += schedBar(S, t); }
      else { what.split(',').forEach((n, i) => SFX[n](0.05 + i * 1.2)); }
      const buf = await oc.startRendering(); let pk = 0, ss = 0, nan = 0; const n = buf.length;
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) { const v = d[i]; if (v !== v) nan++; const a = Math.abs(v); if (a > pk) pk = a; ss += v * v; } }
      for (const k in KS) delete KS[k]; ac = keep[0]; cur = keep[1];
      if (wav) { const d0 = buf.getChannelData(0), d1 = buf.getChannelData(1), N = Math.floor(n / 2), b = new DataView(new ArrayBuffer(44 + N * 2)); const ws = (o, s) => { for (let i = 0; i < s.length; i++) b.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF'); b.setUint32(4, 36 + N * 2, true); ws(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, sr / 2, true); b.setUint32(28, sr, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); ws(36, 'data'); b.setUint32(40, N * 2, true);
        for (let i = 0; i < N; i++) { const v = Math.max(-1, Math.min(1, (d0[i * 2] + d1[i * 2]) * 0.5)); b.setInt16(44 + i * 2, v * 32767, true); }
        let bin = ''; const u8 = new Uint8Array(b.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(bin); }
      return { peak: +pk.toFixed(3), rms: +Math.sqrt(ss / n / 2).toFixed(4), nan };
    },
  };
})();
