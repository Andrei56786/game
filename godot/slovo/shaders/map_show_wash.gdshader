// Державы цветом (renderPolitics: polq) поверх кусков, сглаженно, с прозрачностью 0.72 (дальний масштаб — в map_show_over).
shader_type canvas_item;
render_mode unshaded;
#include "res://shaders/map_borders.gdshaderinc"
uniform sampler2D qp_tex : filter_nearest;
uniform vec3 cam = vec3(4320.0, 2700.0, 1.0);
varying vec2 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	vec2 g = floor(lp) + 0.5;
	vec4 c = wash_at(qp_tex, cam.xy + (g - vec2(320.0, 180.0)) / cam.z);
	COLOR = c.a > 0.0 ? vec4(c.rgb / c.a, c.a * 0.72) : vec4(0.0);
}
