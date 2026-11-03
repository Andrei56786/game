// Карта через год (season2.js): вид точки по её теплу, как у двора в том же краю (seaVar). Снег и лёд зимой, оттепель пятнами,
// свежая зелень весной, сухая трава и пашня осенью, мягкая зима юга. Нужны map_common (hash2, vnoise, temp_at) и местность TR.
// Виды: 0 лето, 1 оттепель (th), 2 цветение (sp), 3–5 осень (au1–au3), 6 снег (w), 7 мягкая зима (wm).
uniform ivec3 sv3 = ivec3(0);   // вид дня для тепла 0.2 / 0.5 / 0.85 (MSEA.V)
const int SV_TH = 1; const int SV_SP = 2; const int SV_AU1 = 3; const int SV_AU2 = 4; const int SV_AU3 = 5; const int SV_W = 6; const int SV_WM = 7;
const vec3 SEA_SNOW[7] = { vec3(106.0, 122.0, 150.0), vec3(136.0, 152.0, 178.0), vec3(166.0, 182.0, 202.0), vec3(194.0, 206.0, 222.0), vec3(216.0, 226.0, 236.0), vec3(234.0, 240.0, 246.0), vec3(248.0, 251.0, 255.0) };
const vec3 SEA_ICE[6] = { vec3(62.0, 98.0, 130.0), vec3(90.0, 130.0, 162.0), vec3(126.0, 164.0, 192.0), vec3(162.0, 194.0, 216.0), vec3(196.0, 220.0, 234.0), vec3(226.0, 238.0, 246.0) };
const vec3 R_YOUNG[7] = { vec3(18.0, 48.0, 26.0), vec3(30.0, 74.0, 34.0), vec3(46.0, 106.0, 42.0), vec3(74.0, 144.0, 50.0), vec3(112.0, 178.0, 62.0), vec3(152.0, 204.0, 82.0), vec3(192.0, 228.0, 120.0) };
const vec3 R_GOLD[7] = { vec3(44.0, 30.0, 8.0), vec3(84.0, 56.0, 14.0), vec3(126.0, 90.0, 20.0), vec3(168.0, 128.0, 30.0), vec3(204.0, 158.0, 44.0), vec3(230.0, 188.0, 68.0), vec3(246.0, 216.0, 112.0) };
const vec3 R_ORNG[7] = { vec3(44.0, 18.0, 8.0), vec3(86.0, 36.0, 12.0), vec3(132.0, 60.0, 18.0), vec3(176.0, 88.0, 26.0), vec3(208.0, 122.0, 40.0), vec3(232.0, 156.0, 62.0), vec3(246.0, 190.0, 98.0) };
const vec3 R_RED[7] = { vec3(38.0, 10.0, 12.0), vec3(74.0, 20.0, 20.0), vec3(116.0, 30.0, 26.0), vec3(158.0, 46.0, 34.0), vec3(194.0, 70.0, 44.0), vec3(218.0, 106.0, 60.0), vec3(236.0, 144.0, 88.0) };
// MS_C
const vec3 MS_SPROUT = vec3(134.0, 184.0, 80.0); const vec3 MS_PLOUGH = vec3(110.0, 80.0, 52.0); const vec3 MS_STUB = vec3(200.0, 170.0, 90.0);
const vec3 MS_FRESH = vec3(140.0, 204.0, 80.0); const vec3 MS_DRY = vec3(168.0, 154.0, 80.0); const vec3 MS_BROWN = vec3(122.0, 106.0, 70.0);
const vec3 MS_WM = vec3(106.0, 122.0, 90.0); const vec3 MS_ICE1 = vec3(166.0, 196.0, 218.0); const vec3 MS_ICE2 = vec3(200.0, 222.0, 236.0);
const vec3 MS_TWIG = vec3(90.0, 72.0, 56.0); const vec3 MS_TWIG2 = vec3(122.0, 102.0, 86.0); const vec3 MS_TWIGS = vec3(154.0, 140.0, 128.0);
const vec3 MS_SNOW = vec3(238.0, 243.0, 248.0);
bool ms_on() { return any(notEqual(sv3, ivec3(0))); }
int ms_var(float tmp) { return tmp < 0.34 ? sv3.x : tmp > 0.7 ? sv3.z : sv3.y; }
// тепло точки: клетки и чуть-чуть шума (msTmp)
float ms_tmp(int tx, int ty, float px, float py) { return temp_at(tx, ty) + (vnoise(px / 13.0, py / 13.0, 7) - 0.5) * 0.06; }
int jrnd(float v) { return int(floor(v + 0.5)); }
vec3 c255(vec4 c) { return floor(c.rgb * 255.0 + 0.5); }
vec4 c01(vec3 c) { return vec4(c / 255.0, 1.0); }
// cmix: каналы отбрасывают дробь (pk(…) & 255); t — с двумя знаками, так что запас 0.001 не меняет честных дробей
vec3 cmix3(vec3 a, vec3 b, float t) { return floor(a + (b - a) * t + 0.001); }
float lum3(vec3 c) { return (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255.0; }
vec3 ramp7(int r, float l, float lo, float hi) {
	int i = clamp(jrnd((l - lo) / (hi - lo) * 6.0), 0, 6);
	return r == 0 ? R_YOUNG[i] : r == 1 ? R_GOLD[i] : r == 2 ? R_ORNG[i] : r == 3 ? R_RED[i] : SEA_SNOW[i];
}
vec3 ms_snow(vec3 c, int px, int py) {
	float l = lum3(c), d = l - 0.43;
	return SEA_SNOW[clamp(jrnd(4.0 + d * (d < 0.0 ? 5.0 : 2.2) + (hash2(px, py, 91) - 0.5) * 0.7), 2, 6)];
}
// последний снег лежит большими пятнами
bool ms_thaw(int px, int py) { return vnoise(float(px) / 26.0, float(py) / 26.0, 4) * 0.65 + vnoise(float(px) / 7.0, float(py) / 7.0, 5) * 0.35 > 0.6; }
vec3 ms_ice(int px, int py) {
	return hash2(px >> 1, py, 92) < 0.04 ? SEA_ICE[1] : SEA_ICE[clamp(jrnd(3.0 + (vnoise(float(px) / 6.0, float(py) / 6.0, 9) - 0.5) * 3.0), 2, 5)];
}
vec3 ms_land(vec3 c, int T, int sv, int px, int py) {
	if (sv == SV_W || (sv == SV_TH && T != FARM && ms_thaw(px, py))) { vec3 s = ms_snow(c, px, py); return T == MARSH ? cmix3(s, c, 0.25) : s; }
	if (T == FARM) {
		if (sv == SV_SP || sv == SV_TH) return cmix3(c, MS_SPROUT, 0.45);
		if (sv == SV_AU2 || sv == SV_AU3 || sv == SV_WM) return cmix3(c, MS_PLOUGH, sv == SV_AU2 ? 0.4 : 0.55);
		if (sv == SV_AU1) return cmix3(c, MS_STUB, 0.3);
		return c;
	}
	if (T == GRASS || T == HILLS || T == STEPPE || T == FOREST || T == DFOREST || T == MARSH) {
		if (sv == SV_SP) return cmix3(c, MS_FRESH, 0.14);
		if (sv == SV_AU1) return cmix3(c, MS_DRY, 0.1);
		if (sv == SV_AU2) return cmix3(c, MS_DRY, 0.24);
		if (sv == SV_AU3 || sv == SV_TH) return cmix3(c, MS_BROWN, 0.32);
		if (sv == SV_WM) return cmix3(c, MS_WM, 0.25);
	}
	return c;
}
