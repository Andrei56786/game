// Предметы клетки (mapItems из render.js): деревья, горы, холмы, камыш… Считает и таблица ключей (map_ikey), и сами спрайты (map_items).
// Всё — от угла клетки в малых числах, чтобы округления совпадали с JS (bx + h·8 в float32 у края мира теряет точность).
uniform sampler2D road_tex : filter_nearest;  // R8 — дорога в клетке
uniform sampler2D spr_tex : filter_nearest;   // RGBAF: строка 0 — спрайты атласа (x, y, w, h), строка 1 — начало группы (r)
const int G_OAK = 0; const int G_PINE = 1; const int G_SPINE = 2; const int G_BIRCH = 3; const int G_MOUNT = 4; const int G_MOUNTS = 5;
const int G_PEAK = 6; const int G_HILL = 7; const int G_HILLW = 8; const int G_HILLC = 9; const int G_REED = 10; const int G_PUD = 11;
const int G_TUFT = 12; const int G_ROCK = 13; const int G_BUSH = 14; const int G_QMOUNT = 15; const int G_QMOUNTS = 16; const int G_QPEAK = 17;
const int G_QHILL = 18; const int G_QHILLW = 19; const int G_QHILLC = 20;
int gbase(int g) { return int(texelFetch(spr_tex, ivec2(g, 1), 0).r + 0.5); }
vec4 srect(int s) { return texelFetch(spr_tex, ivec2(s, 0), 0); }
bool road_at(int x, int y) { return texelFetch(road_tex, ivec2(x, y), 0).r > 0.001; }
struct It { int s; ivec2 pos; ivec2 anc; int sh; bool chk; float frac; };
// Math.round(v) для v ≥ −0.5 с половинами вверх
int jr(float v) { return int(floor(v + 0.5)); }
// предмет k клетки (tx, ty) без проверки landAt (её делает шейдер спрайтов): false — нет предмета.
// pos — левый верх спрайта, anc — точка опоры (мир), sh: 1 тень дерева, 2 тень горы; frac = b − угол клетки (порядок рисования)
bool item(int tx, int ty, int k, out It it) {
	int T = ter_at(tx, ty);
	it.s = 0; it.sh = 0; it.chk = true; it.frac = 0.0; it.pos = ivec2(0); it.anc = ivec2(0);
	if (T <= BEACH || T == FARM) return false;
	float tmp = temp_at(tx, ty);
	ivec2 b0 = ivec2(tx * 8, ty * 8);
	float h0 = hash2(tx, ty, 21);
	if (T == FOREST || T == DFOREST) {
		bool df = T == DFOREST;
		if (k >= (df ? 5 : 3)) return false;
		float x = hash2(tx, ty, 30 + k) * 8.0, y = hash2(tx, ty, 40 + k) * 8.0;
		if (road_at(tx, ty) && hash2(tx, ty, 50 + k) < 0.6) return false;
		bool conifer = tmp < 0.3 || (df && hash2(tx, ty, 60 + k) < 0.45) || hash2(tx, ty, 61 + k) < 0.15;
		int v = int(floor(hash2(tx, ty, 70 + k) * 4.0));
		int sz = df ? (hash2(tx, ty, 80 + k) < 0.6 ? 2 : 1) : (hash2(tx, ty, 80 + k) < 0.5 ? 1 : (hash2(tx, ty, 81 + k) < 0.5 ? 0 : 2));
		int g = conifer ? (tmp < 0.22 ? G_SPINE : G_PINE) : ((tmp < 0.36 && hash2(tx, ty, 90 + k) < 0.3) ? G_BIRCH : G_OAK);
		it.s = gbase(g) + v * 3 + sz;
		vec4 r = srect(it.s);
		it.pos = b0 + ivec2(jr(x - r.z / 2.0), jr(y - r.w + 1.0));
		it.anc = b0 + ivec2(int(x), int(y));
		it.sh = 1; it.frac = y;
		return true;
	}
	if (k != 0 && T != HILLS && T != MARSH) return false;
	if (T == MOUNT || T == PEAK) {
		if (T == MOUNT && h0 < 0.04) return false;
		int v = int(floor(hash2(tx, ty, 22) * 6.0));
		bool snowy = T == PEAK || tmp < 0.25 || texelFetch(rel_tex, ivec2(tx, ty), 0).r > 0.8;
		it.s = gbase(T == PEAK ? G_PEAK : (snowy ? G_MOUNTS : G_MOUNT)) + v;
		vec4 r = srect(it.s);
		float x = 4.0 + (hash2(tx, ty, 23) - 0.5) * 5.0, y = 7.0 + (hash2(tx, ty, 24) - 0.5) * 3.0;
		it.pos = b0 + ivec2(jr(x - r.z / 2.0), jr(y - r.w));
		it.sh = 2; it.chk = false; it.frac = y;
		return true;
	}
	if (T == HILLS) {
		if (h0 < 0.4 || k > 1) return false;
		float x = 4.0 + (hash2(tx, ty, 26) - 0.5) * 4.0, y = 6.0 + (hash2(tx, ty, 27) - 0.5) * 4.0;
		it.anc = b0 + ivec2(int(x), int(y));
		if (k == 0) {
			int v = int(floor(hash2(tx, ty, 25) * 6.0));
			it.s = gbase(tmp < 0.3 ? G_HILLC : (tmp > 0.78 ? G_HILLW : G_HILL)) + v;
			vec4 r = srect(it.s);
			it.pos = b0 + ivec2(jr(x - r.z / 2.0), jr(y - r.w));
			it.frac = y;
			return true;
		}
		if (hash2(tx, ty, 28) >= 0.25) return false;
		it.s = gbase(G_OAK) + int(floor(hash2(tx, ty, 29) * 4.0)) * 3;
		it.pos = b0 + ivec2(jr(x + 3.0), jr(y - 6.0));
		it.sh = 1; it.frac = y + 0.5;
		return true;
	}
	if (T == MARSH) {
		if (k > 2) return false;
		float x = hash2(tx, ty, 31 + k) * 7.0, y = hash2(tx, ty, 41 + k) * 7.0;
		it.s = (k == 0 && h0 < 0.6) ? gbase(G_PUD) + int(floor(hash2(tx, ty, 9) * 2.0)) : gbase(G_REED) + int(floor(hash2(tx, ty, 51 + k) * 3.0));
		it.pos = b0 + ivec2(int(x), int(y)); it.anc = it.pos; it.frac = y;
		return true;
	}
	if (T == STEPPE) {
		if (h0 >= 0.5) return false;
		float x = hash2(tx, ty, 32) * 7.0, y = hash2(tx, ty, 42) * 7.0;
		it.s = gbase(G_TUFT) + (h0 < 0.25 ? 0 : 1);
		it.pos = b0 + ivec2(int(x), int(y)); it.anc = it.pos; it.frac = y;
		return true;
	}
	if (T == SNOW) {
		if (h0 >= 0.35) return false;
		float x = hash2(tx, ty, 33) * 7.0, y = hash2(tx, ty, 43) * 7.0;
		it.s = h0 < 0.12 ? gbase(G_SPINE) + int(floor(hash2(tx, ty, 34) * 4.0)) * 3 : gbase(G_ROCK) + (h0 < 0.22 ? 0 : 1);
		it.pos = b0 + ivec2(int(x), int(y)); it.anc = it.pos; it.frac = y;
		it.sh = h0 < 0.12 ? 1 : 0;
		return true;
	}
	if (T == GRASS) {
		if (h0 < 0.06 && !road_at(tx, ty)) {
			float x = hash2(tx, ty, 35) * 7.0, y = hash2(tx, ty, 45) * 7.0;
			it.s = gbase(G_OAK) + int(floor(hash2(tx, ty, 36) * 4.0)) * 3 + 1;
			vec4 r = srect(it.s);
			it.pos = b0 + ivec2(jr(x - r.z / 2.0), jr(y - r.w));
			it.anc = b0 + ivec2(int(x), int(y));
			it.sh = 1; it.frac = y;
			return true;
		}
		if (h0 < 0.12) {
			float x = hash2(tx, ty, 37) * 7.0, y = hash2(tx, ty, 47) * 7.0;
			it.s = gbase(G_BUSH);
			it.pos = b0 + ivec2(int(x), int(y)); it.anc = it.pos; it.frac = y;
			return true;
		}
	}
	return false;
}
