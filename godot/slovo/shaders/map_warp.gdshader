// Сетка искажения берегов (renderBase: wgx, wgy), GW×GH точек, по 16 бит на значение: q = (v + 16)·2048.
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_noise.gdshaderinc"
varying vec2 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	float x = floor(lp.x), y = floor(lp.y);
	float wx = pfbm(x / 9.0, y / 9.0, 3) * 7.0 + pn2(x / 2.2 + 50.0, y / 2.2) * 1.6;
	float wy = pfbm(x / 9.0 + 40.0, y / 9.0 + 17.0, 3) * 7.0 + pn2(x / 2.2, y / 2.2 + 50.0) * 1.6;
	uint qx = uint(clamp(floor((wx + 16.0) * 2048.0 + 0.5), 0.0, 65535.0)), qy = uint(clamp(floor((wy + 16.0) * 2048.0 + 0.5), 0.0, 65535.0));
	COLOR = vec4(float(qx >> 8u), float(qx & 255u), float(qy >> 8u), float(qy & 255u)) / 255.0;
}
