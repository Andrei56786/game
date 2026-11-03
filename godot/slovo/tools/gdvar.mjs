// Значения JS → двоичный формат Variant Godot 4 (bytes_to_var): числа — float64 без потерь, объекты — Dictionary с ключами-строками
// в порядке JS, массивы — Array, Uint8Array → PackedByteArray, Int32Array/Int16Array/Uint16Array → PackedInt32Array,
// Float32Array → PackedFloat32Array, Float64Array → PackedFloat64Array. Функции и undefined в объектах пропускаются (как в JSON).
// Используется в браузере (pageExport) и в Node: encodeVariant(v) → Uint8Array.
export function encodeVariant(root) {
  let buf = new Uint8Array(1 << 16), dv = new DataView(buf.buffer), n = 0;
  const te = new TextEncoder();
  const need = k => { if (n + k <= buf.length) return; let L = buf.length * 2; while (L < n + k) L *= 2; const b = new Uint8Array(L); b.set(buf.subarray(0, n)); buf = b; dv = new DataView(buf.buffer); };
  const u32 = v => { need(4); dv.setUint32(n, v >>> 0, true); n += 4; };
  const pad = () => { while (n % 4) { need(1); buf[n++] = 0; } };
  const T = { NIL: 0, BOOL: 1, INT: 2, FLOAT: 3, STRING: 4, DICT: 27, ARRAY: 28, PBYTE: 29, PI32: 30, PF32: 32, PF64: 33 }, F64 = 1 << 16;
  const str = s => { const b = te.encode(s); u32(b.length); need(b.length); buf.set(b, n); n += b.length; pad(); };
  const enc = v => {
    if (v === null || v === undefined) { u32(T.NIL); return; }
    const t = typeof v;
    if (t === 'boolean') { u32(T.BOOL); u32(v ? 1 : 0); return; }
    if (t === 'number') { u32(T.FLOAT | F64); need(8); dv.setFloat64(n, v, true); n += 8; return; }
    if (t === 'string') { u32(T.STRING); str(v); return; }
    if (t === 'function') { u32(T.NIL); return; }
    if (v instanceof Uint8Array || v instanceof Uint8ClampedArray) { u32(T.PBYTE); u32(v.length); need(v.length); buf.set(v, n); n += v.length; pad(); return; }
    if (v instanceof Int32Array || v instanceof Int16Array || v instanceof Uint16Array || v instanceof Int8Array) { u32(T.PI32); u32(v.length); need(v.length * 4); for (let i = 0; i < v.length; i++) { dv.setInt32(n, v[i], true); n += 4; } return; }
    if (v instanceof Float32Array) { u32(T.PF32); u32(v.length); need(v.length * 4); for (let i = 0; i < v.length; i++) { dv.setFloat32(n, v[i], true); n += 4; } return; }
    if (v instanceof Float64Array) { u32(T.PF64); u32(v.length); need(v.length * 8); for (let i = 0; i < v.length; i++) { dv.setFloat64(n, v[i], true); n += 8; } return; }
    if (Array.isArray(v)) { u32(T.ARRAY); u32(v.length); for (const x of v) enc(typeof x === 'function' ? null : x); return; }
    if (v instanceof Map || v instanceof Set) throw new Error('Map/Set не переводятся');
    if (typeof v.toJSON === 'function') { enc(v.toJSON()); return; }
    const ks = Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function');
    u32(T.DICT); u32(ks.length); for (const k of ks) { u32(T.STRING); str(k); enc(v[k]); }
  };
  enc(root);
  return buf.slice(0, n);
}
