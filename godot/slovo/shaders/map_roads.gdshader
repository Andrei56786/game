// Дороги куска — после рек: штамп целиком пропускается, если его середина на реке (метка в альфе копии экрана), на море или вне мира;
// точки обочины и дороги — только на суше без реки; тропа — одна точка (может лечь на озеро, как в HTML).
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_seg.gdshaderinc"
uniform sampler2D scr : hint_screen_texture, filter_nearest;
bool river_at(ivec2 q, vec2 sps) { float a = texture(scr, (vec2(q) + 0.5) * sps).a; return a > 0.5 && a < 0.999; }
void vertex() {
	vec2 V; vec4 col; ivec2 cp;
	skind = seg_eval(VERTEX, INSTANCE_CUSTOM, V, col, cp);
	lp = VERTEX;
	VERTEX = V; scol = col; cpx = cp;
}
void fragment() {
	if (skind < 0 || dot(lp, lp) > 1.0) discard;
	ivec2 cw = origin + cpx;
	if (!in_world(cw) || mask_px(cw) == 1 || river_at(cpx, SCREEN_PIXEL_SIZE)) discard;
	ivec2 q = ivec2(floor(FRAGCOORD.xy));
	if (skind != 4 && (!in_world(origin + q) || water_px(origin + q) || river_at(q, SCREEN_PIXEL_SIZE))) discard;
	COLOR = scol;
}
