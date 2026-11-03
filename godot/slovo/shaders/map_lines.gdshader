// Реки куска: сначала берега всех рек (только на суше), потом вода (везде в мире) — то же, что в HTML по рекам по очереди:
// берег не ложится на уже нарисованную воду, а вода поверх всего. Вода пишет альфу 254 — метку реки.
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_seg.gdshaderinc"
void vertex() {
	vec2 V; vec4 col; ivec2 cp;
	skind = seg_eval(VERTEX, INSTANCE_CUSTOM, V, col, cp);
	lp = VERTEX;
	VERTEX = V; scol = col; cpx = cp;
}
void fragment() {
	if (skind < 0 || dot(lp, lp) > 1.0) discard;
	ivec2 p = origin + ivec2(floor(FRAGCOORD.xy));
	if (!in_world(p) || (skind == 0 && water_px(p))) discard;
	COLOR = scol;
}
