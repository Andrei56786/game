// Провинция каждой точки (P в renderChunk, QP в renderOverview) для границ: код = провинция + 3 (0 — вне мира, 1 — вода, 2 — ничья суша).
// q = 4: обзорная карта (точка обзора = 4×4 точки мира, без дрожания краёв), иначе — полная детализация.
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_common.gdshaderinc"
uniform ivec2 origin;
uniform int q = 1;
void fragment() {
	ivec2 v = ivec2(floor(FRAGCOORD.xy));
	int code = 0;
	if (q == 4) {
		float px = float(v.x * 4 + 2), py = float(v.y * 4 + 2);
		vec2 w = warp_px(px, py);
		float fx = (px + w.x) / TS, fy = (py + w.y) / TS;
		int tx = clamp(int(fx), 0, MW - 1), ty = clamp(int(fy), 0, MH - 1);
		float n1 = vnoise(px / 5.0, py / 5.0, 1);
		bool wat = bil(0, (px + w.x * 0.4) / TS, (py + w.y * 0.4) / TS) + (n1 - 0.5) * 0.35 > 0.0;
		code = wat ? 1 : prov_at(ty * MW + tx) + 3;
	} else {
		ivec2 p = origin + v - ivec2(0, 288);
		if (in_world(p)) {
			Px r = px_info(p);
			code = r.water ? 1 : prov_at(r.t) + 3;
		}
	}
	COLOR = vec4(float(code & 255), float(code >> 8), 0.0, 255.0) / 255.0;
}
