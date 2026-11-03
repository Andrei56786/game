// Сезон куска после спрайтов (msChunkPost): реки замерзают, берега и дороги под снегом. Как в HTML — по точному цвету
// готовой картинки (вода реки, берег, обочина, дорога, тропа), так что тени и спрайты поверх них остаются как есть.
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_season.gdshaderinc"
uniform sampler2D scr : hint_screen_texture, filter_nearest;
uniform ivec2 origin;
bool is_c(vec3 k, vec3 c) { return all(equal(k, c)); }
void fragment() {
	vec4 c = texture(scr, SCREEN_UV);
	vec3 k = c255(c);
	int kind = is_c(k, vec3(52.0, 110.0, 168.0)) ? 0 : is_c(k, vec3(78.0, 140.0, 196.0)) ? 1 : is_c(k, vec3(58.0, 86.0, 60.0)) ? 2
		: (is_c(k, vec3(160.0, 128.0, 84.0)) || is_c(k, vec3(108.0, 84.0, 56.0)) || is_c(k, vec3(170.0, 146.0, 102.0))) ? 3 : -1;
	ivec2 p = origin + ivec2(floor(FRAGCOORD.xy));
	if (kind < 0 || !in_world(p)) discard;
	ivec2 t = px_cell(p);
	float tmp = ms_tmp(t.x, t.y, float(p.x), float(p.y));
	int sv = ms_var(tmp);
	vec3 o = k;
	if (kind <= 1) { if (sv == SV_W && tmp < 0.46) o = (kind == 1 || hash2(p.x, p.y, 94) < 0.2) ? MS_ICE2 : MS_ICE1; }
	else if (kind == 2) { if (sv == SV_W) o = SEA_SNOW[2]; }
	else if (sv == SV_W || sv == SV_TH) o = cmix3(k, SEA_SNOW[4], sv == SV_W ? 0.4 : 0.15);
	if (all(equal(o, k))) discard;
	COLOR = vec4(o / 255.0, c.a);
}
