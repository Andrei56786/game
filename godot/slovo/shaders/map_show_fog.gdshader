// Туман войны (ui.js: rebuildFog, drawLayer(FOG.vc), drawFogPaper): маска 1 точка на клетку, растянутая сглаженно.
// layer 0 — тень над разведанным, но невидимым сейчас (rgba(16,12,24,80)); layer 1 — старая бумага над неразведанным:
// лист 500×500 (initFog: шум трёх масштабов, крапины, сетка через 50 пунктиром), привязан к миру, ×2z при z ≥ 1/2.
shader_type canvas_item;
render_mode unshaded;
uniform sampler2D exp_tex : filter_nearest;   // R8: 1 — разведано (G.explored)
uniform sampler2D vis_tex : filter_nearest;   // R8: 2 — видно сейчас (G.vis)
uniform vec3 cam = vec3(4320.0, 2700.0, 1.0);
uniform int layer = 0;
const int MW = 1080;
const int MH = 675;
varying vec2 lp;
void vertex() { lp = VERTEX; }
// hash2 и vnoise с периодом (worldgen.js, render.js)
float hash2(int x, int y, int s) {
	uint h = uint(x) * 374761393u + uint(y) * 668265263u + uint(s) * 982451653u;
	h = (h ^ (h >> 13u)) * 1274126177u;
	h ^= h >> 16u;
	return float(h >> 8u) / 16777216.0;
}
float vnp(float x, float y, int s, int p) {
	float xi = floor(x), yi = floor(y), xf = x - xi, yf = y - yi;
	float u = xf * xf * (3.0 - 2.0 * xf), v = yf * yf * (3.0 - 2.0 * yf);
	float P = float(p);
	int x0 = int(mod(xi, P)), y0 = int(mod(yi, P)), x1 = int(mod(xi + 1.0, P)), y1 = int(mod(yi + 1.0, P));
	float a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
vec3 paper(int x, int y) {
	if ((y % 50 == 0 && ((x >> 2) & 1) == 1) || (x % 50 == 0 && ((y >> 2) & 1) == 1)) return vec3(176.0, 150.0, 108.0) / 255.0;
	float fx = float(x), fy = float(y);
	float n = vnp(fx * 0.012, fy * 0.012, 71, 6) * 0.55 + vnp(fx * 0.05, fy * 0.05, 72, 25) * 0.3 + vnp(fx * 0.3, fy * 0.3, 73, 150) * 0.15;
	float f = 0.8 + n * 0.22;
	if (hash2(x >> 1, y, 74) < 0.004) f -= 0.08;
	return floor(clamp(vec3(222.0, 200.0, 150.0) * f, 0.0, 255.0)) / 255.0;
}
float at(ivec2 t) {
	t = clamp(t, ivec2(0), ivec2(MW - 1, MH - 1));
	bool ex = texelFetch(exp_tex, t, 0).r > 0.5 / 255.0;
	if (layer == 1) return ex ? 0.0 : 1.0;
	return ex && texelFetch(vis_tex, t, 0).r < 1.5 / 255.0 ? 1.0 : 0.0;
}
void fragment() {
	vec2 g = floor(lp) + 0.5;
	vec2 w = cam.xy + (g - vec2(320.0, 180.0)) / cam.z;
	if (w.x < 0.0 || w.y < 0.0 || w.x >= 8640.0 || w.y >= 5400.0) discard;
	vec2 f = w / 8.0 - 0.5;
	ivec2 o = ivec2(floor(f));
	vec2 t = f - floor(f);
	float a = mix(mix(at(o), at(o + ivec2(1, 0)), t.x), mix(at(o + ivec2(0, 1)), at(o + ivec2(1, 1)), t.x), t.y);
	if (a <= 0.0) discard;
	if (layer == 0) {
		COLOR = vec4(16.0 / 255.0, 12.0 / 255.0, 24.0 / 255.0, a * 80.0 / 255.0);
	} else {
		float s = cam.z >= 0.5 ? 2.0 * cam.z : 1.0;
		vec2 pp = (g - vec2(320.0 - cam.x * cam.z, 180.0 - cam.y * cam.z)) / s;
		ivec2 q = ivec2(mod(floor(pp), 500.0));
		COLOR = vec4(paper(q.x, q.y), a);
	}
}
