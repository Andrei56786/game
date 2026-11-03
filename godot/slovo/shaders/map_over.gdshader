// Обзорная карта (renderOverview): 1 точка = 4×4 точки мира, «облегчённый рецепт» тех же цветов, кромка прибоя и мокрый песок.
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_noise.gdshaderinc"
#include "res://shaders/map_pal.gdshaderinc"
const int QW = 2160;
const int QH = 1350;
vec4 c8(float r, float g, float b) { return vec4(r, g, b, 255.0) / 255.0; }
struct Q { int tx; int ty; float fx; float fy; float n1; bool water; };
Q qinfo(ivec2 q) {
	Q r;
	float px = float(q.x * 4 + 2), py = float(q.y * 4 + 2);
	vec2 w = warp_px(px, py);
	r.fx = (px + w.x) / TS; r.fy = (py + w.y) / TS;
	r.tx = clamp(int(r.fx), 0, MW - 1); r.ty = clamp(int(r.fy), 0, MH - 1);
	r.n1 = vnoise(px / 5.0, py / 5.0, 1);
	r.water = bil(0, (px + w.x * 0.4) / TS, (py + w.y * 0.4) / TS) + (r.n1 - 0.5) * 0.35 > 0.0;
	return r;
}
int qmask(ivec2 q) { Q r = qinfo(q); return !r.water ? 0 : lake_at(r.tx, r.ty) ? 2 : 1; }
vec4 mix8(vec4 a, vec4 c, float k) { return vec4(floor((a.rgb * 255.0) * (1.0 - k) + (c.rgb * 255.0) * k) / 255.0, 1.0); }
void fragment() {
	ivec2 q = ivec2(floor(FRAGCOORD.xy));
	Q r = qinfo(q);
	float px = float(q.x * 4 + 2), py = float(q.y * 4 + 2);
	int T = ter_at(r.tx, r.ty);
	float h = hash2(q.x, q.y, 3);
	int m = 0;
	vec4 col;
	if (r.water) {
		bool lake = lake_at(r.tx, r.ty);
		m = lake ? 2 : 1;
		float dep = bil(1, r.fx, r.fy) + (r.n1 - 0.5) * 1.2;
		col = lake ? pal(P_LAKE + clamp(3 - int(floor(dep * 1.3)), 0, 3), 4) : dep < 2.2 ? pal(P_SHAL + clamp(3 - int(floor(dep * 1.4)), 0, 3), 4) : pal(P_DEEP + clamp(3 - int(floor((dep - 2.2) * 0.75)), 0, 3), 4);
	} else {
		if (is_water(T)) T = T == LAKE ? GRASS : BEACH;
		float s = bil(2, r.fx, r.fy), tmp = bil(3, r.fx, r.fy);
		int sIdx = clamp(int(floor(4.0 + s * (T == HILLS || T == MOUNT || T == PEAK ? 4.2 : 2.4) + 0.5)), 0, 8);
		int nIdx = clamp(int(floor(r.n1 * 3.2 + 0.4)), 0, 3);
		col = pal(land_pal(T, tmp) + nIdx, sIdx);
		if (T == GRASS && h < 0.035) col = c8(50.0, 100.0, 38.0);
		else if (T == SNOW && h < 0.05) col = c8(138.0, 144.0, 140.0);
		else if (T == FOREST || T == DFOREST) {
			bool cold = tmp < 0.3;
			int cn = cold ? (tmp < 0.22 ? 2 : 1) : (T == DFOREST && h > 0.6 ? 1 : 0);
			float k2 = hash2(q.x, q.y, 4);
			vec4 c0 = cn == 0 ? c8(50.0, 100.0, 38.0) : cn == 1 ? c8(31.0, 74.0, 46.0) : c8(60.0, 96.0, 74.0);
			vec4 c1 = cn == 0 ? c8(87.0, 144.0, 58.0) : cn == 1 ? c8(58.0, 112.0, 68.0) : c8(226.0, 234.0, 238.0);
			vec4 c2 = cn == 0 ? c8(36.0, 72.0, 30.0) : cn == 1 ? c8(23.0, 58.0, 38.0) : c8(31.0, 74.0, 46.0);
			col = k2 < (T == DFOREST ? 0.1 : 0.22) ? col : k2 < 0.55 ? c0 : k2 < 0.8 ? c1 : c2;
			if (cold && tmp >= 0.22 && k2 > 0.93) col = c8(200.0, 212.0, 220.0);
		} else if (T == MARSH) { if (h < 0.25) col = c8(106.0, 138.0, 58.0); else if (h < 0.4) col = c8(62.0, 106.0, 114.0); }
		else if (T == FARM) {
			float fxp = px + pn2(px / 23.0, py / 23.0) * 3.0, fyp = py + pn2(px / 23.0 + 9.0, py / 23.0) * 3.0;
			float hsh = hash2(int(floor(fxp / 9.0)), int(floor(fyp / 7.0)), 11);
			col = pal(P_CROPS + int(floor(hsh * 6.0)) * 2 + ((q.x + q.y) & 1), sIdx);
		}
	}
	if (q.x >= 1 && q.y >= 1 && q.x < QW - 1 && q.y < QH - 1) {
		if (m != 0) {
			if (qmask(q + ivec2(-1, 0)) == 0 || qmask(q + ivec2(1, 0)) == 0 || qmask(q + ivec2(0, -1)) == 0 || qmask(q + ivec2(0, 1)) == 0) col = mix8(col, m == 1 ? C_FOAM : C_FOAM2, 0.55);
		} else if (qmask(q + ivec2(-1, 0)) == 1 || qmask(q + ivec2(1, 0)) == 1 || qmask(q + ivec2(0, -1)) == 1 || qmask(q + ivec2(0, 1)) == 1) col = mix8(col, C_WET, 0.45);
	}
	COLOR = col;
}
