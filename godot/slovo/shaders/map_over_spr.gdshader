// Горы и холмы обзорной карты (renderOverview): маленькие спрайты q:* в точке клетки / 4, сглаженно (imageSmoothingEnabled),
// по клеткам по порядку — каждая точка собирает спрайты, которые её накрывают. Атлас с предумноженной альфой (как у холста).
shader_type canvas_item;
render_mode blend_premul_alpha, unshaded;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_item.gdshaderinc"
uniform sampler2D atlas_tex : filter_linear;
uniform vec2 atlas_size;
uniform ivec2 qmax;
bool qspr(int tx, int ty, out int s, out vec2 p) {
	s = 0; p = vec2(0.0);
	int T = ter_at(tx, ty);
	if (T != MOUNT && T != PEAK && T != HILLS) return false;
	float h0 = hash2(tx, ty, 21), tmp = temp_at(tx, ty);
	float x, y;
	if (T == HILLS) {
		if (h0 < 0.4) return false;
		s = gbase(tmp < 0.3 ? G_QHILLC : (tmp > 0.78 ? G_QHILLW : G_QHILL)) + int(floor(hash2(tx, ty, 25) * 6.0));
		x = 4.0 + (hash2(tx, ty, 26) - 0.5) * 4.0; y = 6.0 + (hash2(tx, ty, 27) - 0.5) * 4.0;
	} else {
		if (T == MOUNT && h0 < 0.04) return false;
		bool snowy = T == PEAK || tmp < 0.25 || texelFetch(rel_tex, ivec2(tx, ty), 0).r > 0.8;
		s = gbase(T == PEAK ? G_QPEAK : (snowy ? G_QMOUNTS : G_QMOUNT)) + int(floor(hash2(tx, ty, 22) * 6.0));
		x = 4.0 + (hash2(tx, ty, 23) - 0.5) * 5.0; y = 7.0 + (hash2(tx, ty, 24) - 0.5) * 3.0;
	}
	vec4 r = srect(s);
	p = vec2(float(tx * 2), float(ty * 2)) + vec2(x, y) / 4.0 - vec2(r.z / 2.0, r.w);
	return true;
}
void fragment() {
	vec2 pc = floor(FRAGCOORD.xy) + 0.5;
	int tx0 = max(0, int(floor((pc.x - 1.7 - float(qmax.x) / 2.0) / 2.0))), tx1 = min(MW - 1, int(floor((pc.x - 0.3 + float(qmax.x) / 2.0) / 2.0)) + 1);
	int ty0 = max(0, int(floor((pc.y - 2.2) / 2.0))), ty1 = min(MH - 1, int(floor((pc.y - 0.9 + float(qmax.y)) / 2.0)) + 1);
	vec4 acc = vec4(0.0);
	for (int ty = ty0; ty <= ty1; ty++) {
		for (int tx = tx0; tx <= tx1; tx++) {
			int s; vec2 p;
			if (!qspr(tx, ty, s, p)) continue;
			vec4 r = srect(s);
			vec2 u = pc - p;
			if (u.x < 0.0 || u.y < 0.0 || u.x >= r.z || u.y >= r.w) continue;
			vec4 c = texture(atlas_tex, (r.xy + u) / atlas_size);
			acc = c + acc * (1.0 - c.a);
		}
	}
	COLOR = acc;
}
