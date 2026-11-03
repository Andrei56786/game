// Обзорная карта через год (msOverview): один проход по готовой картинке обзора (после линий рек и дорог и спрайтов гор).
// Озёра замерзают, линии рек тоже; кроны лесов желтеют, краснеют, облетают или под снегом; остальная суша — как у кусков (msLand).
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_season.gdshaderinc"
uniform sampler2D over0_tex : filter_nearest;   // обзор без сезона
uniform sampler2D qp_tex : filter_nearest;      // коды провинций обзора: 1 — вода
const vec3 OAK[3] = { vec3(50.0, 100.0, 38.0), vec3(87.0, 144.0, 58.0), vec3(36.0, 72.0, 30.0) };
const vec3 PINE[3] = { vec3(31.0, 74.0, 46.0), vec3(58.0, 112.0, 68.0), vec3(23.0, 58.0, 38.0) };
vec3 canopy(int oi, int sv, float h, vec3 p) {
	float l = lum3(p);
	if (sv == SV_SP) return ramp7(0, l, 0.08, 0.62);
	if (sv == SV_AU1) return h < 0.3 ? ramp7(1, l, 0.08, 0.6) : p;
	if (sv == SV_AU2) return h > 0.9 ? p : ramp7(h < 0.45 ? 1 : h < 0.75 ? 2 : 3, l, 0.08, 0.6);
	if (sv == SV_AU3 || sv == SV_TH) return oi == 1 ? MS_TWIG2 : MS_TWIG;
	if (sv == SV_W) return oi == 1 ? MS_SNOW : oi == 0 ? MS_TWIGS : MS_TWIG2;
	if (sv == SV_WM) return cmix3(p, MS_WM, 0.35);
	return p;
}
void fragment() {
	ivec2 q = ivec2(floor(FRAGCOORD.xy));
	vec4 c0 = texelFetch(over0_tex, q, 0);
	COLOR = c0;
	if (ms_on()) {
		int px = q.x * 4 + 2, py = q.y * 4 + 2, tx = q.x >> 1, ty = q.y >> 1;
		float tmp = ms_tmp(tx, ty, float(px), float(py));
		int sv = ms_var(tmp);
		if (sv != 0) {
			vec3 p = c255(c0);
			int T = ter_at(tx, ty);
			vec4 qc = texelFetch(qp_tex, q, 0);
			if (int(qc.r * 255.0 + 0.5) + int(qc.g * 255.0 + 0.5) * 256 == 1) { if (sv == SV_W && T == LAKE && tmp < 0.55) p = ms_ice(px, py); }
			else if (p.b > p.r + 50.0 && p.b > p.g + 10.0) { if (sv == SV_W && tmp < 0.46) p = MS_ICE1; }   // линия реки
			else {
				int oi = -1, pi = -1;
				if (T == FOREST || T == DFOREST) {
					for (int i = 0; i < 3; i++) { if (all(equal(p, OAK[i]))) oi = i; if (all(equal(p, PINE[i]))) pi = i; }
				}
				if (oi >= 0) p = canopy(oi, sv, hash2(q.x, q.y, 95), p);
				else if (pi >= 0) { if (sv == SV_W && pi == 1) p = MS_SNOW; }
				else p = ms_land(p, T, sv, px, py);
			}
			COLOR = c01(p);
		}
	}
}
