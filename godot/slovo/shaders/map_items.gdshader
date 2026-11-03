// Деревья, горы, холмы, камыш… куска (mapItems). Порядок — отсортированные ключи (map_ikey) в ord_tex, по экземпляру на тень и на спрайт.
// landAt — точка опоры на суше: в мире, не вода (расчёт) и не река (метка в альфе копии экрана после рек).
// Сезон (msSpr): дерево, гора, холм, камыш меняются на двойника того же места в атласе — свой у каждого режима перекраски.
shader_type canvas_item;
render_mode unshaded, blend_premul_alpha;
#include "res://shaders/map_common.gdshaderinc"
#include "res://shaders/map_item.gdshaderinc"
#include "res://shaders/map_season.gdshaderinc"
uniform sampler2D ord_tex : filter_nearest;
uniform sampler2D scr : hint_screen_texture, filter_nearest;
uniform ivec2 origin;
uniform ivec2 t0;      // первая клетка окна
uniform int lo;        // floor(b·1024) верха окна по модулю 2^19
uniform int cnt = 0;   // предметов
uniform vec2 atlas_size;
varying vec2 auv;
varying flat ivec2 anc;
varying flat int kind;   // −1 нет, 0 спрайт, 1 тень дерева, 2 тень горы
varying flat int chk;
// виды спрайтов (строка 2 spr_tex): 1 лиственное, 2 берёза, 3 ель, 4 гора, 5 холм, 6 камыш и трава, 7 лужа;
// строка 2 + режим — номер двойника. Режимы — как SEA_MODES в map_gpu.gd.
const int M_SP = 1; const int M_SPB = 2; const int M_GOLD = 3; const int M_ORNG = 4; const int M_RED = 5; const int M_AU3 = 6; const int M_BARE = 7;
const int M_BARES = 8; const int M_DULL = 9; const int M_SNOW = 10; const int M_DRY = 11; const int M_SNOWG = 12; const int M_ICE = 13; const int M_ALT = 14;
int ms_spr(int s, int sv, float h) {
	int k = int(texelFetch(spr_tex, ivec2(s, 2), 0).r + 0.5);
	int m = 0;
	if (k == 1 || k == 2) {
		if (sv == SV_SP) m = (k == 1 && h < 0.14) ? M_SPB : M_SP;
		else if (sv == SV_AU1) m = (k == 2 || h < 0.3) ? M_GOLD : 0;
		else if (sv == SV_AU2) m = h > 0.92 ? 0 : (k == 2 || h < 0.45) ? M_GOLD : h < 0.75 ? M_ORNG : M_RED;
		else if (sv == SV_AU3) m = h < 0.55 ? M_BARE : M_AU3;
		else if (sv == SV_W) m = M_BARES;
		else if (sv == SV_TH) m = M_BARE;
		else if (sv == SV_WM) m = k == 2 ? M_BARE : M_DULL;
	} else if (k == 3) { if (sv == SV_W || (sv == SV_TH && h < 0.5)) m = M_ALT; }
	else if (k == 4) { if (sv == SV_W) m = M_ALT; }
	else if (k == 5) { m = sv == SV_W ? M_SNOW : (sv == SV_AU2 || sv == SV_AU3) ? M_DRY : 0; }
	else if (k == 6) { if (sv == SV_W) m = M_SNOWG; }
	else if (k == 7) { if (sv == SV_W) m = M_ICE; }
	return m == 0 ? s : int(texelFetch(spr_tex, ivec2(s, 2 + m), 0).r + 0.5);
}
void vertex() {
	int j = int(INSTANCE_CUSTOM.x + 0.5) + int(INSTANCE_CUSTOM.y + 0.5) * 1024;
	int i = j >> 1, part = j & 1;
	vec2 uv = VERTEX * 0.5 + 0.5;
	kind = -1;
	VERTEX = vec2(-64.0);
	if (i < cnt) {
		ivec4 c = ivec4(texelFetch(ord_tex, ivec2(i & 127, i >> 7), 0) * 255.0 + 0.5);
		int key = c.r | (c.g << 8) | (c.b << 16) | (c.a << 24);
		int k = key & 7, st = (key >> 3) & 1, txl = (key >> 4) & 255, bq = key >> 12;
		int tx = t0.x + ((txl - t0.x) & 255);
		int ty = t0.y + (((bq - lo) & 0x7FFFF) >> 13) - st;
		It it;
		if (item(tx, ty, k, it)) {
			vec4 r = srect(it.s);
			if (ms_on()) {
				// вид места спрайта: середина по ширине и низ (it.x + w/2, it.b)
				int x = it.pos.x + (int(r.z + 0.5) >> 1), b = ty * 8 + int(floor(it.frac));
				int stx = clamp(x >> 3, 0, MW - 1), sty = clamp(b >> 3, 0, MH - 1);
				int sv = ms_var(ms_tmp(stx, sty, float(x), float(b)));
				if (sv != 0) r = srect(ms_spr(it.s, sv, hash2(stx * 7 + (it.pos.x & 7), sty, 93)));
			}
			vec2 p0 = vec2(it.pos - origin);
			vec4 q = vec4(-64.0, -64.0, 0.0, 0.0);
			int w = int(r.z + 0.5), h = int(r.w + 0.5);
			if (part == 1) { q = vec4(p0, r.zw); kind = 0; }
			else if (it.sh == 1) { q = vec4(p0.x + 1.0, p0.y + float(h - 1), float(w), 2.0); kind = 1; }
			else if (it.sh == 2) { q = vec4(p0.x + float(w >> 1), p0.y + float(h - 2), float((w >> 1) + 2), 3.0); kind = 2; }
			VERTEX = q.xy + uv * q.zw;
			auv = (r.xy + uv * r.zw) / atlas_size;
			anc = it.anc - origin;
			chk = it.chk ? 1 : 0;
		}
	}
}
void fragment() {
	if (kind < 0) discard;
	if (chk == 1) {
		vec2 vs = 1.0 / SCREEN_PIXEL_SIZE;
		float a = texture(scr, (vec2(anc) + 0.5) * SCREEN_PIXEL_SIZE).a;
		if (anc.x < 0 || anc.y < 0 || float(anc.x) >= vs.x || anc.y >= 288 || !in_world(origin + anc) || water_px(origin + anc) || (a > 0.5 && a < 0.999)) discard;
	}
	// Тени смешиваются как на холсте (Skia, 8 бит): d' = ((d·(256−a)) >> 8) + round(S·a/255), a = 71 (0.28) и 56 (0.22).
	// Сложение с умноженной альфой: src.a = a/256, src.rgb = round(S·a/255) − ½ (+ 1/512 от ничьих) — округление GPU даёт тот же floor.
	if (kind == 1) COLOR = vec4((vec3(3.0, 6.0, 3.0) - 0.5 + 1.0 / 512.0) / 255.0, 71.0 / 256.0);      // rgb(10,20,10)
	else if (kind == 2) COLOR = vec4((vec3(4.0, 4.0, 7.0) - 0.5 + 1.0 / 512.0) / 255.0, 56.0 / 256.0); // rgb(20,16,30)
	else { COLOR = texture(TEXTURE, auv); COLOR.rgb *= COLOR.a; }
}
