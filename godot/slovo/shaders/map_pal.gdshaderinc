// Палитры местности TPAL (render.js): 4 оттенка × 9 ступеней света, строки текстуры pal_tex (9×80), и цвета берегов.
uniform sampler2D pal_tex : filter_nearest;
const int P_GRASST = 0; const int P_GRASSW = 4; const int P_GRASSC = 8; const int P_STEPPE = 12; const int P_TUNDRA = 16;
const int P_FOREST = 20; const int P_DFOREST = 24; const int P_HILLS = 28; const int P_HILLSW = 32; const int P_HILLSC = 36;
const int P_MOUNT = 40; const int P_PEAK = 44; const int P_MARSH = 48; const int P_BEACH = 52; const int P_DEEP = 56;
const int P_SHAL = 60; const int P_LAKE = 64; const int P_CROPS = 68;
vec4 pal(int row, int s) { return texelFetch(pal_tex, ivec2(s, row), 0); }
const vec4 C_FOAM = vec4(170.0, 206.0, 222.0, 255.0) / 255.0;
const vec4 C_FOAM2 = vec4(120.0, 168.0, 200.0, 255.0) / 255.0;
const vec4 C_WET = vec4(150.0, 132.0, 92.0, 255.0) / 255.0;
const vec4 C_HEDGE = vec4(76.0, 104.0, 52.0, 255.0) / 255.0;
const vec4 C_WAVE = vec4(52.0, 94.0, 150.0, 255.0) / 255.0;
// палитра суши по местности и теплу
int land_pal(int T, float tmp) {
	if (T == GRASS) return tmp < 0.32 ? P_GRASSC : tmp > 0.78 ? P_GRASSW : P_GRASST;
	if (T == STEPPE) return P_STEPPE;
	if (T == SNOW) return P_TUNDRA;
	if (T == FOREST) return P_FOREST;
	if (T == DFOREST) return P_DFOREST;
	if (T == HILLS) return tmp < 0.3 ? P_HILLSC : tmp > 0.78 ? P_HILLSW : P_HILLS;
	if (T == MOUNT) return P_MOUNT;
	if (T == PEAK) return P_PEAK;
	if (T == MARSH) return P_MARSH;
	if (T == BEACH) return P_BEACH;
	return P_GRASST;
}
