// Мини-карта (rebuildMini): обзорная карта, сглаженно уменьшенная до 128×80 (по 16 отсчётов на точку), и державы цветом (0.55).
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_borders.gdshaderinc"
uniform sampler2D over_tex : filter_linear;
uniform sampler2D qp_tex : filter_nearest;
const vec2 Q = vec2(2160.0, 1350.0);
varying vec2 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	vec2 g = floor(lp);
	vec2 k = Q / vec2(128.0, 80.0);
	vec3 c = vec3(0.0);
	vec4 w = vec4(0.0);
	for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
		vec2 u = (g + (vec2(float(i), float(j)) + 0.5) / 4.0) * k;
		c += texture(over_tex, u / Q).rgb;
		w += wash_q(qp_tex, ivec2(floor(u)));
	}
	c /= 16.0;
	w /= 16.0;
	COLOR = vec4(c * (1.0 - 0.55 * w.a) + w.rgb * 0.55, 1.0);
}
