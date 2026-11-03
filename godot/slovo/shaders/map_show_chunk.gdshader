// Кусок на экране (drawChunks): окно куска 288×548 — сверху картинка с полем 16, снизу коды провинций с полем 2 (260×260).
// Границы — chunkBorders: half = масштаб 0.5 (картинка сглаженно вдвое меньше, границы через точку), иначе полная детализация с подсветкой.
shader_type canvas_item;
render_mode unshaded;
#include "res://shaders/map_borders.gdshaderinc"
uniform bool half = false;
uniform float lay_a = 0.85;
uniform bool borders = true;
const int VM = 16;
const int PRY = 288;
int P(sampler2D t, int x, int y) { return code_at(t, ivec2(x + 2, PRY + y + 2)); }
vec4 cb(sampler2D t, int X, int Y, int sc) {
	int p = P(t, X, Y);
	if (p < 3) return vec4(0.0);
	int r = owner_of(p);
	bool eR = false, eP = false;
	ivec2 d4[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
	for (int d = 0; d < 4; d++) {
		int q = P(t, X + d4[d].x * sc, Y + d4[d].y * sc);
		if (q == 1 || q == 0) continue;
		if (q != p) { if (q < 3 || owner_of(q) != r) eR = true; else eP = true; }
	}
	if (eR) return realm_edge(p, r);
	if (eP && (sc > 1 || ((X + Y) & 1) == 1)) return vec4(30.0 / 255.0, 24.0 / 255.0, 20.0 / 255.0, (sc > 1 ? 70.0 : 90.0) / 255.0);
	if (sc == 1 && r >= 0) {
		ivec2 d8[8] = ivec2[8](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1), ivec2(2, 0), ivec2(-2, 0), ivec2(0, 2), ivec2(0, -2));
		for (int d = 0; d < 8; d++) { int q = P(t, X + d8[d].x, Y + d8[d].y); if (q >= 3 && owner_of(q) != r) return vec4(realm_rgb(p), 150.0 / 255.0); }
	}
	return vec4(0.0);
}
// альфа окна: 0 вне мира, у воды рек 254 (метка для дорог и предметов) — на экране всё непрозрачно
vec4 px(sampler2D t, ivec2 q) { vec4 v = texelFetch(t, q, 0); v.a = v.a > 0.0 ? 1.0 : 0.0; return v; }
void fragment() {
	vec2 rl = (UV / TEXTURE_PIXEL_SIZE) - float(VM);   // точка куска (0..256)
	vec4 c;
	vec4 b = vec4(0.0);
	if (half) {
		ivec2 k = ivec2(floor(rl / 2.0)) * 2;
		vec4 a0 = px(TEXTURE, k + VM), a1 = px(TEXTURE, k + VM + ivec2(1, 0)), a2 = px(TEXTURE, k + VM + ivec2(0, 1)), a3 = px(TEXTURE, k + VM + ivec2(1, 1));
		c = vec4(a0.rgb * a0.a + a1.rgb * a1.a + a2.rgb * a2.a + a3.rgb * a3.a, a0.a + a1.a + a2.a + a3.a) / 4.0;
		c = c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);
		if (borders) b = cb(TEXTURE, k.x + 1, k.y + 1, 2);
	} else {
		ivec2 k = ivec2(floor(rl));
		c = px(TEXTURE, k + VM);
		if (borders) b = cb(TEXTURE, k.x, k.y, 1);
	}
	float ba = b.a * lay_a;
	COLOR = vec4(mix(c.rgb, b.rgb, ba / max(0.001, ba + c.a * (1.0 - ba))), ba + c.a * (1.0 - ba));
}
