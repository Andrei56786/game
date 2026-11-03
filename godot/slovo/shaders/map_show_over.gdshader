// Экран карты, нижний слой: обзорная карта (drawLayer(quarter)), при дальнем масштабе — державы цветом (polq, 0.72) и границы (bordQ).
// Точка экрана → точка мира: cam.xy + (x + 0.5 − 320) / z. z = 0.25 — по точкам, иначе сглаженно (крупнее — пока нет кусков).
shader_type canvas_item;
render_mode unshaded;
#include "res://shaders/map_borders.gdshaderinc"
uniform sampler2D over_tex : filter_nearest;
uniform sampler2D qp_tex : filter_nearest;
uniform vec3 cam = vec3(4320.0, 2700.0, 0.25);
uniform bool borders = true;
uniform bool wash_on = false;
const int QW = 2160;
const int QH = 1350;
const vec4 BG = vec4(26.0, 56.0, 102.0, 255.0) / 255.0;
varying vec2 lp;
void vertex() { lp = VERTEX; }
vec4 bord(ivec2 o) {
	if (o.x < 1 || o.y < 1 || o.x >= QW - 1 || o.y >= QH - 1) return vec4(0.0);
	int p = code_at(qp_tex, o);
	if (p < 3) return vec4(0.0);
	int r = owner_of(p);
	bool eR = false, eP = false;
	ivec2 d4[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
	for (int d = 0; d < 4; d++) {
		int q = code_at(qp_tex, o + d4[d]);
		if (q == 1) continue;
		if (q != p) { if (q < 3 || owner_of(q) != r) eR = true; else eP = true; }
	}
	if (eR) return realm_edge(p, r);
	if (eP) return vec4(30.0 / 255.0, 24.0 / 255.0, 20.0 / 255.0, 70.0 / 255.0);
	return vec4(0.0);
}
vec4 texq(ivec2 o) { return texelFetch(over_tex, clamp(o, ivec2(0), ivec2(QW - 1, QH - 1)), 0); }
vec4 pre(vec4 c) { return vec4(c.rgb * c.a, c.a); }
void fragment() {
	vec2 g = floor(lp) + 0.5;
	vec2 w = cam.xy + (g - vec2(320.0, 180.0)) / cam.z;
	vec2 u = w / 4.0;
	if (w.x < 0.0 || w.y < 0.0 || w.x >= 8640.0 || w.y >= 5400.0) COLOR = BG;
	else if (cam.z == 0.25) {
		ivec2 o = ivec2(floor(u));
		vec4 c = texq(o);
		if (wash_on) { vec4 k = wash_at(qp_tex, w); c.rgb = c.rgb * (1.0 - 0.72 * k.a) + k.rgb * 0.72; }
		if (borders) { vec4 b = bord(o); c.rgb = mix(c.rgb, b.rgb, b.a); }
		COLOR = vec4(c.rgb, 1.0);
	} else {
		vec2 f = u - 0.5;
		ivec2 o = ivec2(floor(f));
		vec2 t = f - floor(f);
		vec4 c00 = texq(o), c10 = texq(o + ivec2(1, 0)), c01 = texq(o + ivec2(0, 1)), c11 = texq(o + ivec2(1, 1));
		vec4 c = mix(mix(c00, c10, t.x), mix(c01, c11, t.x), t.y);
		if (wash_on) { vec4 k = wash_at(qp_tex, w); c.rgb = c.rgb * (1.0 - 0.72 * k.a) + k.rgb * 0.72; }
		if (borders && cam.z < 0.25) {
			vec4 b = mix(mix(pre(bord(o)), pre(bord(o + ivec2(1, 0))), t.x), mix(pre(bord(o + ivec2(0, 1))), pre(bord(o + ivec2(1, 1))), t.x), t.y);
			c.rgb = c.rgb * (1.0 - b.a) + b.rgb;
		}
		COLOR = vec4(c.rgb, 1.0);
	}
}
