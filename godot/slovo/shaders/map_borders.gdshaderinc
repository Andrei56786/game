// Границы держав и провинций (renderPolitics, chunkBorders). Коды провинций: 0 вне мира, 1 вода, 2 ничья суша, 3+ провинция.
// own_tex: на код — цвет державы (rgb) и держава + 1 (a; 0 — ничья).
uniform sampler2D own_tex : filter_nearest;
int code_at(sampler2D t, ivec2 c) { vec4 v = texelFetch(t, c, 0); return int(v.r * 255.0 + 0.5) + int(v.g * 255.0 + 0.5) * 256; }
int owner_of(int code) { return int(texelFetch(own_tex, ivec2(code, 0), 0).a * 255.0 + 0.5) - 1; }
vec3 realm_rgb(int code) { return texelFetch(own_tex, ivec2(code, 0), 0).rgb; }
// цвет рубежа державы: цвет державы × 0.55 (ничья — 120,110,90)
vec4 realm_edge(int code, int r) {
	vec3 cc = r >= 0 ? realm_rgb(code) * 255.0 : vec3(120.0, 110.0, 90.0);
	return vec4(floor(cc * 0.55) / 255.0, 235.0 / 255.0);
}
// заливка державой точки обзорной карты (renderPolitics: polq), с умножением на прозрачность — для сглаживания
vec4 wash_q(sampler2D qp, ivec2 o) {
	if (o.x < 1 || o.y < 1 || o.x >= 2159 || o.y >= 1349) return vec4(0.0);
	int p = code_at(qp, o);
	if (p < 3) return vec4(0.0);
	int r = owner_of(p);
	vec4 c = r < 0 ? vec4(150.0 / 255.0, 140.0 / 255.0, 120.0 / 255.0, 110.0 / 255.0) : vec4(realm_rgb(p), 150.0 / 255.0);
	return vec4(c.rgb * c.a, c.a);
}
// то же сглаженно (билинейно по точкам обзора) в точке мира w
vec4 wash_at(sampler2D qp, vec2 w) {
	vec2 f = w / 4.0 - 0.5;
	ivec2 o = ivec2(floor(f));
	vec2 t = f - floor(f);
	return mix(mix(wash_q(qp, o), wash_q(qp, o + ivec2(1, 0)), t.x), mix(wash_q(qp, o + ivec2(0, 1)), wash_q(qp, o + ivec2(1, 1)), t.x), t.y);
}
