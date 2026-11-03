// Глубина воды (renderBase: wdep): расстояние по четырём соседям до ближайшей суши, не больше 9 (как обход в ширину).
shader_type canvas_item;
render_mode blend_disabled, unshaded;
uniform sampler2D ter_tex : filter_nearest;
varying vec2 lp;
void vertex() { lp = VERTEX; }
bool land(int x, int y) { return x >= 0 && y >= 0 && x < 1080 && y < 675 && texelFetch(ter_tex, ivec2(x, y), 0).r * 255.0 > 2.5; }
void fragment() {
	int x = int(floor(lp.x)), y = int(floor(lp.y));
	int d = 9;
	if (land(x, y)) d = 0;
	else {
		for (int r = 1; r <= 8 && d == 9; r++) {
			for (int k = 0; k < r && d == 9; k++) {
				int a = k, b = r - k;
				if (land(x + a, y + b) || land(x - b, y + a) || land(x - a, y - b) || land(x + b, y - a)) d = r;
			}
		}
	}
	COLOR = vec4(float(d) / 255.0, 0.0, 0.0, 1.0);
}
