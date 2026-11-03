// Ключи порядка рисования предметов на весь мир: точка (tx·5 + k, ty) — предмет k клетки. Ключ int32 (байты RGBA, младший — R):
// биты 30..12 — floor(b·1024) по модулю 2^19 (b — y основания, порядок как items.sort по b), 11..4 — tx & 255, 3 — «b ниже клетки»
// (горы и дерево холма могут уйти в следующую строку клеток), 2..0 — k. Нет предмета — 0x7FFFFFFF (в конце после сортировки).
shader_type canvas_item;
render_mode blend_disabled, unshaded;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_item.gdshaderinc"
void fragment() {
	ivec2 q = ivec2(floor(FRAGCOORD.xy));
	int tx = q.x / 5, k = q.x % 5, ty = q.y;
	It it;
	int key = 0x7FFFFFFF;
	if (tx < MW && ty < MH && item(tx, ty, k, it)) {
		int fq = int(floor(it.frac * 1024.0));
		key = (((ty * 8192 + fq) & 0x7FFFF) << 12) | ((tx & 255) << 4) | ((fq >= 8192 ? 1 : 0) << 3) | k;
	}
	COLOR = vec4(float(key & 255), float((key >> 8) & 255), float((key >> 16) & 255), float((key >> 24) & 255)) / 255.0;
}
