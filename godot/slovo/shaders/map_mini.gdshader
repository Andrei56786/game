// Мини-карта (rebuildMini): обзорная карта, сглаженно уменьшенная до 128×80 (по 16 отсчётов на точку), державы цветом (0.55)
// и неразведанные земли цветом бумаги #d4bf92 (маска тумана, уменьшенная так же).
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_borders.gdshaderinc"
uniform sampler2D over_tex : filter_linear;
uniform sampler2D qp_tex : filter_nearest;
uniform sampler2D exp_tex : filter_nearest;   // R8: 1 — разведано
uniform bool fog_on = false;
const vec2 Q = vec2(2160.0, 1350.0);
varying vec2 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	vec2 g = floor(lp);
	vec2 k = Q / vec2(128.0, 80.0);
	vec3 c = vec3(0.0);
	vec4 w = vec4(0.0);
	float fog = 0.0;
	for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
		vec2 u = (g + (vec2(float(i), float(j)) + 0.5) / 4.0) * k;
		c += texture(over_tex, u / Q).rgb;
		w += wash_q(qp_tex, ivec2(floor(u)));
		if (fog_on && texelFetch(exp_tex, clamp(ivec2(floor(u / 2.0)), ivec2(0), ivec2(1079, 674)), 0).r < 0.5 / 255.0) fog += 1.0;
	}
	c /= 16.0;
	w /= 16.0;
	c = c * (1.0 - 0.55 * w.a) + w.rgb * 0.55;
	COLOR = vec4(mix(c, vec3(212.0, 191.0, 146.0) / 255.0, fog / 16.0), 1.0);
}
