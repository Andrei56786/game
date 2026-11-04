// Поле боя (bscreen.js: buildField) — построчный перенос на GPU. Клетка поля — 4×4 точки; цвет точки: палитра земли по
// шуму, высоты (светлый склон к северо-западу, тень к юго-востоку, ступени уступов), дороги, вода с бликами, броды, мосты,
// болота, лес, стены и ворота, при штурме — мостовая за стеной; второй проход buildField — песчаные кромки берегов.
shader_type canvas_item;

uniform sampler2D cells : filter_nearest;   // RG8: r — вид клетки (GC: 0 поле … 8 дорога), g — высота 0..3
uniform int BCW = 160;
uniform int BCH = 68;
uniform int FW = 640;
uniform int FH = 272;
uniform int seed = 0;
uniform vec3 pal0;   // палитра земли, 0..255 (bscreen.js: pal по основе и зиме)
uniform vec3 pal1;
uniform vec3 pal2;
uniform vec3 pal3;
uniform bool winter = false;
uniform int wall = 100000;    // при штурме: столбец стены (F.rv.wall), иначе — за краем поля

const int OPEN = 0; const int FOREST = 1; const int WATER = 2; const int FORD = 3; const int MARSH = 4;
const int WALL = 5; const int GATE = 6; const int BRIDGE = 7; const int ROAD = 8;

// hash2 из worldgen.js (24 старших бита — как в шейдерах карты)
float hash2(int x, int y, int s) {
	uint h = uint(x) * 374761393u + uint(y) * 668265263u + uint(s) * 982451653u;
	h = (h ^ (h >> 13u)) * 1274126177u;
	h ^= h >> 16u;
	return float(h >> 8u) / 16777216.0;
}
float vnoise(float x, float y, int s) {
	float xi = floor(x), yi = floor(y), xf = x - xi, yf = y - yi;
	float u = xf * xf * (3.0 - 2.0 * xf), v = yf * yf * (3.0 - 2.0 * yf);
	int x0 = int(xi), y0 = int(yi);
	float a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
vec2 cell(int cx, int cy) { return texelFetch(cells, ivec2(clamp(cx, 0, BCW - 1), clamp(cy, 0, BCH - 1)), 0).rg * 255.0 + 0.5; }
int code(int cx, int cy) { return int(cell(cx, cy).x); }
int hgt(int cx, int cy) { return int(cell(cx, cy).y); }
vec3 hexc(int h) { return vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)); }

void fragment() {
	ivec2 p = ivec2(floor(UV * vec2(float(FW), float(FH))));
	int x = p.x, y = p.y;
	int k = code(x >> 2, y >> 2), h = hgt(x >> 2, y >> 2);
	float n = vnoise(float(x) * 0.04, float(y) * 0.04, seed) * 0.6 + vnoise(float(x) * 0.15, float(y) * 0.15, seed + 1) * 0.4;
	int ci = clamp(int(floor(n * 4.0)), 0, 3);
	vec3 c = ci == 0 ? pal0 : ci == 1 ? pal1 : ci == 2 ? pal2 : pal3;
	float f = 1.0 + float(h) * 0.07;
	if (h > 0) {
		if (y >= 4 && x >= 4 && hgt((x - 4) >> 2, (y - 4) >> 2) < h) f += 0.08;
		if (y < FH - 4 && x < FW - 4 && hgt((x + 4) >> 2, (y + 4) >> 2) < h) f -= 0.1;
	}
	if (k == ROAD) { c = winter ? hexc(0xb8b0a0) : hexc(0xa08a5a); f *= 0.92 + n * 0.16; }
	else if (k == WATER) { c = hexc(0x3a7eaa); f = 0.9 + sin(float(x) * 0.3 + float(y) * 0.1) * 0.05 + (hash2(x, y, 5) < 0.02 ? 0.25 : 0.0); }
	else if (k == FORD) { c = hexc(0x7aa0a0); f = 0.95 + n * 0.1 + (hash2(x, y, 6) < 0.04 ? -0.2 : 0.0); }
	else if (k == BRIDGE) { c = hexc(0x8a5a34); f = (y % 3 == 0) ? 0.75 : 1.0; }
	else if (k == MARSH) { c = n > 0.62 ? hexc(0x3e6a72) : hexc(0x56704a); }
	else if (k == FOREST) { f *= 0.78; }
	else if (k == WALL) { c = hexc(0x8a8478); f = ((x + (y >> 2) * 3) % 6 == 0 || y % 4 == 0) ? 0.7 : 1.0 - n * 0.1; }
	else if (k == GATE) { c = hexc(0x5a3a20); f = x % 3 == 0 ? 0.7 : 1.0; }
	if ((x >> 2) > wall + 2 && k != WALL && k != GATE) { c = hexc(0x9a8a70); f = ((x >> 3) + (y >> 3)) % 2 == 1 ? 0.95 : 1.02; }
	if (h > 0 && k != WATER) { if (hgt(x >> 2, max(0, (y - 1) >> 2)) != h && (y & 3) == 0) f *= 0.85; }
	vec3 o = floor(clamp(c * f, 0.0, 255.0));
	// кромка берега: точка суши рядом с водой (в клетке слева или справа)
	if (y >= 1 && y < FH - 1 && x >= 1 && x < FW - 1 && k != WATER && (code((x - 1) >> 2, y >> 2) == WATER || code((x + 1) >> 2, y >> 2) == WATER)) o = vec3(200.0, 180.0, 130.0);
	COLOR = vec4(o / 255.0, 1.0);
}
