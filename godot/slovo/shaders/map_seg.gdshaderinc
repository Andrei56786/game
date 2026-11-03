// Цвета — C_* из render.js (выгрузка cols).
// Штампы рек и дорог (stamp в renderChunk): один экземпляр — одна точка отрезка. Отрезки куска — в seg_tex (RGBAF, по 2 точки на отрезок,
// 64 отрезка в строке): (ax, ay, bx, by) мира, (aw, bw, n, вид + 8·первая точка). Точек на отрезок у экземпляров — 16; длинные отрезки
// делятся на несколько записей. Вид: 0 берег, 1 вода реки, 2 обочина дороги, 3 дорога, 4 тропа (одна точка).
uniform sampler2D seg_tex : filter_nearest;
uniform ivec2 origin;
uniform int e0 = 0;
uniform int cnt = 0;
varying vec2 lp;
varying flat vec4 scol;
varying flat ivec2 cpx;
varying flat int skind;
const vec4 C_BANK = vec4(58.0, 86.0, 60.0, 255.0) / 255.0;
const vec4 C_RIV = vec4(52.0, 110.0, 168.0, 254.0) / 255.0;    // вода реки: альфа 254 — метка «река» для дорог и предметов
const vec4 C_RIVL = vec4(78.0, 140.0, 196.0, 254.0) / 255.0;
const vec4 C_RDE = vec4(108.0, 84.0, 56.0, 255.0) / 255.0;
const vec4 C_RD = vec4(160.0, 128.0, 84.0, 255.0) / 255.0;
const vec4 C_TR = vec4(170.0, 146.0, 102.0, 255.0) / 255.0;
// вид штампа (−1 — нет); V — вершина, col — цвет, cp — точка середины (окно)
int seg_eval(vec2 V0, vec4 cus, out vec2 V, out vec4 col, out ivec2 cp) {
	int j = int(cus.x + 0.5) + int(cus.y + 0.5) * 1024;
	int e = e0 + (j >> 4), k = j & 15;
	V = vec2(-64.0); col = vec4(0.0); cp = ivec2(0);
	if ((j >> 4) >= cnt) return -1;
	vec4 A = texelFetch(seg_tex, ivec2((e & 63) * 2, e >> 6), 0);
	vec4 B = texelFetch(seg_tex, ivec2((e & 63) * 2 + 1, e >> 6), 0);
	int n = int(B.z + 0.5), kw = int(B.w + 0.5), kind = kw & 7, ks = (kw >> 3) + k;
	if (ks > n) return -1;
	float t = float(ks) / float(n);
	vec2 a = A.xy - vec2(origin), b = A.zw - vec2(origin);
	vec2 c = a + (b - a) * t;
	cp = ivec2(floor(c));
	float r;
	if (kind <= 1) {
		float RWID[4] = float[4](0.0, 0.75, 1.15, 1.7);
		float w = RWID[clamp(int(floor(B.x + (B.y - B.x) * t + 0.5)), 0, 3)];
		if (kind == 0) { r = w + 0.9; col = C_BANK; }
		else { r = w; col = (w > 1.2 && (int(floor(c.x + c.y)) + origin.x + origin.y) % 5 == 0) ? C_RIVL : C_RIV; }
	} else if (kind == 2) { r = 1.25; col = C_RDE; }
	else if (kind == 3) { r = 0.75; col = C_RD; }
	else {
		// тропа: одна точка (x|0, y|0), и не каждая
		if ((int(floor(7.0 * c.x + 3.0 * c.y)) + 7 * origin.x + 3 * origin.y) % 4 == 0) return -1;
		col = C_TR;
		V = vec2(cp) + (V0 * 0.5 + 0.5);
		return kind;
	}
	V = c + V0 * r;
	return kind;
}
