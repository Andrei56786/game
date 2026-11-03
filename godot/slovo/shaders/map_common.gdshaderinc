// Общие функции карты королевства — построчный перенос render.js (renderBase/shadeRegion) на GPU.
// Мир: клетки MW×MH, в клетке TS×TS точек; искажение берегов — сетка GW×GH (шаг 4 точки), её считает map_warp.
const int MW = 1080;
const int MH = 675;
const float TS = 8.0;
const int WPW = 8640;
const int WPH = 5400;
const int GW = 2162;
const int GH = 1352;
// местность (TR)
const int DEEP = 0; const int SHALLOW = 1; const int LAKE = 2; const int BEACH = 3; const int GRASS = 4; const int FARM = 5;
const int FOREST = 6; const int DFOREST = 7; const int HILLS = 8; const int MOUNT = 9; const int PEAK = 10; const int MARSH = 11;
const int STEPPE = 12; const int SNOW = 13;

uniform sampler2D ter_tex : filter_nearest;   // R8 — местность клетки
uniform sampler2D rel_tex : filter_nearest;   // RF — рельеф
uniform sampler2D temp_tex : filter_nearest;  // RF — тепло
uniform sampler2D wdep_tex : filter_nearest;  // глубина воды (0..9), r = d/255 (map_wdep)
uniform sampler2D warp_tex : filter_nearest;  // искажение: (wgx, wgy) по 16 бит (map_warp)
uniform sampler2D prov_tex : filter_nearest;  // провинция клетки: байты int32

// hash2 из worldgen.js: целочисленные умножения по модулю 2^32; 24 старших бита — чтобы было < 1, как в JS
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
int ter_at(int x, int y) { return int(texelFetch(ter_tex, ivec2(x, y), 0).r * 255.0 + 0.5); }
bool is_water(int T) { return T <= LAKE; }
float wf_at(int x, int y) { return ter_at(x, y) <= LAKE ? 1.0 : -1.0; }
float wdep_at(int x, int y) { return floor(texelFetch(wdep_tex, ivec2(x, y), 0).r * 255.0 + 0.5); }
float temp_at(int x, int y) { return texelFetch(temp_tex, ivec2(x, y), 0).r; }
float shd_at(int x, int y) {
	float a = texelFetch(rel_tex, ivec2(max(0, x - 1), max(0, y - 1)), 0).r;
	float b = texelFetch(rel_tex, ivec2(min(MW - 1, x + 1), min(MH - 1, y + 1)), 0).r;
	return clamp((a - b) * 9.0, -1.0, 1.0);
}
int prov_at(int t) {
	vec4 c = texelFetch(prov_tex, ivec2(t % MW, t / MW), 0);
	if (c.a > 0.5) return -1;
	return int(c.r * 255.0 + 0.5) + int(c.g * 255.0 + 0.5) * 256;
}
vec2 warp_at(int gx, int gy) {
	vec4 c = floor(texelFetch(warp_tex, ivec2(gx, gy), 0) * 255.0 + 0.5);
	return vec2(c.r * 256.0 + c.g, c.b * 256.0 + c.a) / 2048.0 - 16.0;
}
// билинейно по клеткам, как bil() в shadeRegion (A: 0 wf, 1 wdep, 2 shd, 3 temp)
float cell(int A, int x, int y) { return A == 0 ? wf_at(x, y) : A == 1 ? wdep_at(x, y) : A == 2 ? shd_at(x, y) : temp_at(x, y); }
float bil(int A, float fx, float fy) {
	fx -= 0.5; fy -= 0.5;
	int x0 = int(floor(fx)), y0 = int(floor(fy));
	float u = fx - float(x0), v = fy - float(y0);
	int x1 = min(MW - 1, max(0, x0 + 1)), y1 = min(MH - 1, max(0, y0 + 1));
	x0 = min(MW - 1, max(0, x0)); y0 = min(MH - 1, max(0, y0));
	float a = cell(A, x0, y0), b = cell(A, x1, y0), c = cell(A, x0, y1), d = cell(A, x1, y1);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// искажение в точке мира (билинейно по сетке)
vec2 warp_px(float px, float py) {
	float gx = px / 4.0, gy = py / 4.0;
	int gx0 = min(GW - 2, int(floor(gx))), gy0 = min(GH - 2, int(floor(gy)));
	float gu = gx - float(gx0), gv = gy - float(gy0);
	vec2 a = warp_at(gx0, gy0), b = warp_at(gx0 + 1, gy0), c = warp_at(gx0, gy0 + 1), d = warp_at(gx0 + 1, gy0 + 1);
	return a + (b - a) * gu + (c - a) * gv + (a - b - c + d) * gu * gv;
}
bool in_world(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < WPW && p.y < WPH; }
// точка мира (полная детализация): клетка под ней (с дрожанием краёв) и вода
struct Px { int t; int tx; int ty; float fx; float fy; vec2 w; float n1; float n2; bool water; };
Px px_info(ivec2 p) {
	Px r;
	float px = float(p.x), py = float(p.y);
	r.w = warp_px(px, py);
	float jx = (hash2(p.x >> 1, p.y >> 1, 5) - 0.5) * 5.0, jy = (hash2(p.y >> 1, p.x >> 1, 6) - 0.5) * 5.0;
	r.fx = (px + r.w.x + jx) / TS; r.fy = (py + r.w.y + jy) / TS;
	r.tx = r.fx < 0.0 ? 0 : r.fx >= float(MW) ? MW - 1 : int(r.fx);
	r.ty = r.fy < 0.0 ? 0 : r.fy >= float(MH) ? MH - 1 : int(r.fy);
	r.t = r.ty * MW + r.tx;
	r.n1 = vnoise(px / 5.0, py / 5.0, 1);
	r.n2 = hash2(p.x, p.y, 2);
	float wv = bil(0, (px + r.w.x * 0.4) / TS, (py + r.w.y * 0.4) / TS) + (r.n1 - 0.5) * 0.35;
	r.water = wv > 0.0;
	return r;
}
// только клетка под точкой (с дрожанием краёв), как PT в renderChunk
ivec2 px_cell(ivec2 p) {
	float px = float(p.x), py = float(p.y);
	vec2 w = warp_px(px, py);
	float jx = (hash2(p.x >> 1, p.y >> 1, 5) - 0.5) * 5.0, jy = (hash2(p.y >> 1, p.x >> 1, 6) - 0.5) * 5.0;
	float fx = (px + w.x + jx) / TS, fy = (py + w.y + jy) / TS;
	return ivec2(fx < 0.0 ? 0 : fx >= float(MW) ? MW - 1 : int(fx), fy < 0.0 ? 0 : fy >= float(MH) ? MH - 1 : int(fy));
}
// только «вода ли» (для соседей: пена, берег)
bool water_px(ivec2 p) {
	float px = float(p.x), py = float(p.y);
	vec2 w = warp_px(px, py);
	float n1 = vnoise(px / 5.0, py / 5.0, 1);
	return bil(0, (px + w.x * 0.4) / TS, (py + w.y * 0.4) / TS) + (n1 - 0.5) * 0.35 > 0.0;
}
// озеро ли вода в клетке (сама клетка — озеро, или суша рядом с озером)
bool lake_at(int tx, int ty) {
	int T = ter_at(tx, ty);
	if (T == LAKE) return true;
	if (is_water(T)) return false;
	for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
		if (dx == 0 && dy == 0) continue;
		int nx = tx + dx, ny = ty + dy;
		if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && ter_at(nx, ny) == LAKE) return true;
	}
	return false;
}
// маска точки, как MK в renderChunk: 0 суша (и вне мира), 1 море, 2 озеро
int mask_px(ivec2 p) {
	if (!in_world(p)) return 0;
	Px r = px_info(p);
	if (!r.water) return 0;
	return lake_at(r.tx, r.ty) ? 2 : 1;
}
