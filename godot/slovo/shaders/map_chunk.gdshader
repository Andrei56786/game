// Кусок карты в полной детализации: shadeRegion (с сезоном — снег, лёд озёр, пашня, осень) + пена и мокрый песок (renderChunk).
// Точка окна → точка мира: origin + пиксель.
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_noise.gdshaderinc"
#include "res://shaders/map_pal.gdshaderinc"
#include "res://shaders/map_season.gdshaderinc"
uniform ivec2 origin;
bool land_or_out(ivec2 q) { return !in_world(q) || !water_px(q); }
vec4 shade(ivec2 p, Px r, bool lake) {
	int T = ter_at(r.tx, r.ty);
	if (r.water) {
		float dep = bil(1, r.fx, r.fy) + (r.n1 - 0.5) * 1.2 + (r.n2 - 0.5) * 0.5;
		vec4 col;
		if (lake) col = pal(P_LAKE + clamp(3 - int(floor(dep * 1.3)), 0, 3), 4);
		else if (dep < 2.2) col = pal(P_SHAL + clamp(3 - int(floor(dep * 1.4)), 0, 3), 4);
		else col = pal(P_DEEP + clamp(3 - int(floor((dep - 2.2) * 0.75)), 0, 3), 4);
		if (!lake && dep > 3.2 && hash2(p.x >> 2, p.y, 7) < 0.012 && (p.x & 3) != 3 && (p.y & 1) == 1) col = C_WAVE;
		return col;
	}
	if (is_water(T)) T = T == LAKE ? GRASS : BEACH;
	float s = bil(2, r.fx, r.fy), tmp = bil(3, r.fx, r.fy) + (r.n2 - 0.5) * 0.05;
	int sIdx = clamp(int(floor(4.0 + s * (T == HILLS || T == MOUNT || T == PEAK ? 4.2 : 2.4) + (r.n2 - 0.5) * 0.9 + 0.5)), 0, 8);
	int nIdx = clamp(int(floor(r.n1 * 3.2 + r.n2 * 1.1 - 0.15)), 0, 3);
	if (T == FARM) {
		float px = float(p.x), py = float(p.y);
		float fxp = px + pn2(px / 23.0, py / 23.0) * 3.0, fyp = py + pn2(px / 23.0 + 9.0, py / 23.0) * 3.0;
		int cxI = int(floor(fxp / 9.0)), cyI = int(floor(fyp / 7.0));
		float hsh = hash2(cxI, cyI, 11);
		float lx = fxp - float(cxI) * 9.0, ly = fyp - float(cyI) * 7.0;
		if (lx < 1.0 || ly < 1.0) return hsh < 0.5 ? C_HEDGE : pal(P_GRASST + 1, sIdx);
		int st = fract(hsh * 97.0) < 0.5 ? (int(floor(lx)) & 1) : (int(floor(ly)) & 1);
		return pal(P_CROPS + int(floor(hsh * 6.0)) * 2 + st, clamp(sIdx + (r.n2 < 0.1 ? -1 : 0), 0, 8));
	}
	return pal(land_pal(T, tmp) + nIdx, sIdx);
}
void fragment() {
	ivec2 p = origin + ivec2(floor(FRAGCOORD.xy));
	if (!in_world(p)) { COLOR = vec4(0.0); }
	else {
		Px r = px_info(p);
		bool lake = r.water && lake_at(r.tx, r.ty);
		vec4 col = shade(p, r, lake);
		if (ms_on()) {
			float tmp = ms_tmp(r.tx, r.ty, float(p.x), float(p.y));
			int sv = ms_var(tmp);
			if (sv != 0) {
				if (r.water) { if (lake && sv == SV_W && tmp < 0.55) col = c01(ms_ice(p.x, p.y)); }
				else col = c01(ms_land(c255(col), ter_at(r.tx, r.ty), sv, p.x, p.y));
			}
		}
		if (r.water) {
			if (land_or_out(p + ivec2(-1, 0)) || land_or_out(p + ivec2(1, 0)) || land_or_out(p + ivec2(0, -1)) || land_or_out(p + ivec2(0, 1))) col = lake ? C_FOAM2 : C_FOAM;
			else if (!lake && ((p.x + p.y) & 1) == 1 && (land_or_out(p + ivec2(-2, 0)) || land_or_out(p + ivec2(2, 0)) || land_or_out(p + ivec2(0, -2)) || land_or_out(p + ivec2(0, 2)))) col = C_FOAM2;
		} else if (mask_px(p + ivec2(-1, 0)) == 1 || mask_px(p + ivec2(1, 0)) == 1 || mask_px(p + ivec2(0, -1)) == 1 || mask_px(p + ivec2(0, 1)) == 1) col = C_WET;
		COLOR = col;
	}
}
