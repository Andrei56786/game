// Шум Перлина mkNoise(mkRng(seed + 99)) из worldgen.js: перестановка (512) и градиенты (256) — текстуры от JSM.PNoise.
uniform sampler2D perm_tex : filter_nearest;  // R8 512×1
uniform sampler2D grad_tex : filter_nearest;  // RGF 256×1 (cos, sin) как Float32Array
int pm(int i) { return int(texelFetch(perm_tex, ivec2(i, 0), 0).r * 255.0 + 0.5); }
vec2 gr(int i) { return texelFetch(grad_tex, ivec2(i, 0), 0).rg; }
float pn2(float x, float y) {
	float xi = floor(x), yi = floor(y), xf = x - xi, yf = y - yi;
	int X = int(xi) & 255, Y = int(yi) & 255;
	float u = xf * xf * xf * (xf * (xf * 6.0 - 15.0) + 10.0), v = yf * yf * yf * (yf * (yf * 6.0 - 15.0) + 10.0);
	int pa = pm(X), pb = pm(X + 1);
	vec2 g00 = gr(pm(pa + Y)), g10 = gr(pm(pb + Y)), g01 = gr(pm(pa + Y + 1)), g11 = gr(pm(pb + Y + 1));
	float d00 = g00.x * xf + g00.y * yf, d10 = g10.x * (xf - 1.0) + g10.y * yf, d01 = g01.x * xf + g01.y * (yf - 1.0), d11 = g11.x * (xf - 1.0) + g11.y * (yf - 1.0);
	float a = d00 + (d10 - d00) * u, b = d01 + (d11 - d01) * u;
	return (a + (b - a) * v) * 1.41;
}
float pfbm(float x, float y, int oct) {
	float a = 1.0, f = 1.0, s = 0.0, n = 0.0;
	for (int i = 0; i < oct; i++) { s += a * pn2(x * f + float(i) * 31.7, y * f - float(i) * 17.3); n += a; a *= 0.5; f *= 2.03; }
	return s / n;
}
