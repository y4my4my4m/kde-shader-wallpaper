// Power by Pudi
// Email: k.a.komissar@gmail.com
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//
// Thanks to Flopine, provod, YX, NuSan, slerpy, wrighter, Shane, z0rg, bendzz, Tater
// BigWings, FabriceNeyret, iq and Blackle for sharing their knowledge
//
// Stinky Girl
//
// More anime girls on shadertoy:
//
// Code:002 by Pidhorskyi
// https://www.shadertoy.com/view/tlsfzf



const vec3 BLOOD_COLOR = vec3(179, 236, 15) / 255.;
const vec3 BACKGROUND_COLOR = vec3(179, 236, 15) / 255.;
const vec3 BRIGHT_RED = vec3(254, 81, 51) / 255.;
const vec3 TEETH_COLOR = vec3(224, 195, 226) / 255. * 1.2;
const vec3 BORDER_COLOR = vec3(0.01);
const vec3 SKIN_COLOR = vec3(158, 0, 24) / 255.;
const vec3 HIGHLIGHT_COLOR = vec3(240, 48, 18) / 255. * 1.2;
const vec3 HAIR_COLOR = vec3(68, 0, 50) / 255.;
const vec3 HAIR_SHADOW_COLOR = vec3(28, 0, 62) / 255.;

const float PI = acos(-1.);
const float TAU = 2. * PI;

#define sat(x) clamp(x, 0., 1.)
mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}
float pow2(float x) {
    return x * x;
}
float dot2(in vec2 v) {
    return dot(v, v);
}
float cross2(in vec2 a, in vec2 b) {
    return a.x * b.y - a.y * b.x;
}

float smooth_hill(float x, float off, float width, float gap) {
    x -= off;
    float start = width, end = width + max(0., gap);
    return smoothstep(-end, -start, x) - smoothstep(start, end, x);
}
float remap(float val, float start1, float stop1, float start2, float stop2) {
    return start2 + (val - start1) / (stop1 - start1) * (stop2 - start2);
}
float remap01(float val, float start, float stop) {
    return start + val * (stop - start);
}

vec3 erot(vec3 p, vec3 ax, float ro) {
    return mix(dot(ax, p) * ax, p, cos(ro)) + sin(ro) * cross(ax, p);
}

float hash11(float p) {
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 3.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(in vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    // f *= f * f * (f * (f * 6. - 15.) + 10.);

    float a = hash21(p + vec2(0, 0));
    float b = hash21(p + vec2(1, 0));
    float c = hash21(p + vec2(0, 1));
    float d = hash21(p + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

mat2 rot45 = mat2(0.707, -0.707, 0.707, 0.707);

float voronoi(vec2 uv) {
    float d = 1e9;
    vec2 id = floor(uv);
    uv = fract(uv);

    for (float i = -1.; i <= 1.; i++) {
        for (float j = -1.; j <= 1.; j++) {
            vec2 nbor = vec2(i, j);
            d = min(d, length(uv - noise(id + nbor) - nbor));
        }
    }
    return d;
}

vec2 clog(vec2 z) {
    float r = length(z);
    return vec2(log(r), atan(z.y, z.x));
}

float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * (1.0 / 4.0);
}
float smax(in float a, in float b, in float k) {
    float h = max(k - abs(a - b), 0.0);
    return max(a, b) + h * h * k * (1.0 / 4.0);
}

float sd_circle(vec2 p, float r) {
    return length(p) - r;
}
float sd_box(vec2 p, vec2 h) {
    p = abs(p) - h;
    return length(max(p, 0.)) + min(0., max(p.x, p.y));
}

float sd_hook(vec2 p, float r, float a, float s) {
    float base = max(sd_circle(p, r), -p.x * sign(s));
    p.x -= r;
    p *= rot(a);
    p.x += r;
    float crop = sd_circle(p, r);

    return max(base, -crop);
}
float sd_line(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float k = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    return distance(p, mix(a, b, k));
}
float sd_line_y(vec2 p, float h, float r) {
    p.y -= clamp(p.y, 0.0, h);
    return length(p) - r;
}

float op_rem_lim(in float p, in float s, in float l) {
    return p - s * clamp(round(p / s), -l, l);
}

float sd_trig_isosceles(in vec2 p, in vec2 q) {
    p.x = abs(p.x);
    vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
    vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
    float s = -sign(q.y);
    vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)),
                 vec2(dot(b, b), s * (p.y - q.y)));
    return -sqrt(d.x) * sign(d.y);
}

float sd_uneven_capsule(vec2 p, vec2 pa, vec2 pb, float ra, float rb) {
    p -= pa;
    pb -= pa;
    float h = dot(pb, pb);
    vec2 q = vec2(dot(p, vec2(pb.y, -pb.x)), dot(p, pb)) / h;

    q.x = abs(q.x);
    float b = ra - rb;
    vec2 c = vec2(sqrt(h - b * b), b);

    float k = cross2(c, q);
    float m = dot(c, q), n = dot(q, q);

    if (k < 0.0) {
        return sqrt(h * (n)) - ra;
    } else if (k > c.x) {
        return sqrt(h * (n + 1.0 - 2.0 * q.y)) - rb;
    }
    return m - ra;
}

// TODO: rb?!?!?!?!?
float sd_egg(in vec2 p, in float ra, in float rb) {
    const float k = sqrt(3.0);
    p.x = abs(p.x);
    float r = ra - rb;
    return ((p.y < 0.0)             ? length(vec2(p.x, p.y)) - r
            : (k * (p.x + r) < p.y) ? length(vec2(p.x, p.y - k * r))
                                    : length(vec2(p.x + r, p.y)) - 2.0 * r) -
           rb;
}

vec3 sd_bezier_base(in vec2 pos, in vec2 A, in vec2 B, in vec2 C) {
    vec2 a = B - A;
    vec2 b = A - 2.0 * B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;

    float kk = 1.0 / dot(b, b);
    float kx = kk * dot(a, b);
    float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
    float kz = kk * dot(d, a);
    float t = 0.;

    float res = 0.0;
    float sgn = 1.0;

    float p = ky - kx * kx;
    float p3 = p * p * p;
    float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
    float h = q * q + 4.0 * p3;

    if (h >= 0.0) {  // 1 root
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
        t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
        vec2 q = d + (c + b * t) * t;
        res = dot2(q);
        sgn = cross2(c + 2.0 * b * t, q);
    } else {  // 3 roots
        float z = sqrt(-p);
        float v = acos(q / (p * z * 2.0)) / 3.0;
        float m = cos(v);
        float n = sin(v) * 1.732050808;
        vec2 tt = clamp(vec2(m + m, -n - m) * z - kx, 0.0, 1.0);
        vec2 qx = d + (c + b * tt.x) * tt.x;
        float dx = dot2(qx), sx = cross2(c + 2.0 * b * tt.x, qx);
        vec2 qy = d + (c + b * tt.y) * tt.y;
        float dy = dot2(qy), sy = cross2(c + 2.0 * b * tt.y, qy);
        if (dx < dy) {
            res = dx;
            sgn = sx;
        } else {
            res = dy;
            sgn = sy;
        }
        t = res;
    }

    return vec3(res, sgn, t);
}
vec2 sd_bezier(in vec2 pos, in vec2 A, in vec2 B, in vec2 C) {
    vec3 bz = sd_bezier_base(pos, A, B, C);
    return vec2(sqrt(bz.x) * sign(bz.y), bz.z);
}

// https://www.shadertoy.com/view/3dtBR4
float sd_bezier_convex(in vec2 pos, in vec2 A, in vec2 B, in vec2 C) {
    if (cross2(C - A, B - A) < 0.0) {
        vec2 t = A;
        A = C;
        C = t;
    }
    float sa = cross2(A - 0., pos - 0.);
    float sc = cross2(C - A, pos - A);
    float s0 = cross2(0. - C, pos - C);
    float o = cross2(C - A, -A);

    float ts = (1.0 - 2.0 * float(sa < 0. && sc < 0. && s0 < 0.));
    float ts2 = (1.0 - 2.0 * float(sa > 0. && sc > 0. && s0 > 0.));
    ts = o > 0. ? ts2 : ts;

    vec3 bz = sd_bezier_base(pos, A, B, C);
    return sqrt(bz.x) * sign(sc < 0. ? 1.0 : -bz.y) * ts;
}

vec4 sd_bezier_rep(in vec2 pos, in vec2 A, in vec2 B, in vec2 C) {
    vec2 bz = sd_bezier(pos, A, B, C);
    float t = bz.y;
    vec2 tangent = normalize((2.0 - 2.0 * t) * (B - A) + 2.0 * t * (C - B));
    vec2 normal = vec2(tangent.y, -tangent.x);
    mat2 mm = mat2(normal, tangent);
    pos = mix(mix(A, B, t), mix(B, C, t), t) - pos;
    return vec4(bz.x, pos * mm, t);
}

vec4 alpha_blending(vec4 d, vec4 s) {
    // return mix(d, s, s.a);
    vec4 res = vec4(0.);
    res.a = mix(1., d.a, s.a);
    if (res.a == 0.) {
        res.rgb = vec3(0.);
    } else {
        res.rgb = mix(d.rgb * d.a, s.rgb, s.a) / res.a;
    }
    return res;
}
void alpha_blend_inplace(inout vec4 d, in vec4 s) {
    d = alpha_blending(d, s);
}

float AAstep(float thre, float val) {
    return smoothstep(-.5, .5, (val - thre) / min(0.03, fwidth(val - thre)));
}
float AAstep(float val) {
    return AAstep(val, 0.);
}

vec4 render(float d, vec4 color) {
    return vec4(color.rgb, color.a * AAstep(d));
}
vec4 render(float d, vec3 color) {
    return render(d, vec4(color, 1.0));
}

vec4 render_stroked_masked(float d,
                           vec4 color,
                           float stroke,
                           float stroke_mask) {
    vec4 stroke_layer = vec4(vec3(0.01), AAstep(d));
    vec4 color_layer = vec4(color.rgb, AAstep(d + stroke));
    return vec4(mix(mix(stroke_layer.rgb, color_layer.rgb, AAstep(stroke_mask)),
                    color_layer.rgb, color_layer.a),
                stroke_layer.a * color.a);
}
vec4 render_stroked(float d, vec4 color, float stroke) {
    return render_stroked_masked(d, color, stroke, 1.);
}
vec4 render_stroked(float d, vec3 color, float stroke) {
    return render_stroked(d, vec4(color, 1.), stroke);
}

#define LayerFlat(d, color) alpha_blend_inplace(final_color, render(d, color))
#define LayerStroked(d, color, stroke) \
    alpha_blend_inplace(final_color, render_stroked(d, color, stroke))
#define LayerStrokedMask(d, color, stroke, mask) \
    alpha_blend_inplace(final_color,             \
                        render_stroked_masked(d, color, stroke, mask))

void draw_highlight(inout vec4 final_color, float highlight) {
    LayerFlat(highlight, HIGHLIGHT_COLOR);
    float s = 0.15;
    alpha_blend_inplace(final_color, vec4(HIGHLIGHT_COLOR,
                                          0.07 * smoothstep(s, 0., highlight)));
}


float fbm(vec2 st, float n) {
    st *= 3.;

    float s = .5;
    float ret = 0.;
    for (float i = min(0., float(iFrame)); i < n; i++) {
        ret += noise(st) * s;
        st *= 2.5, s /= 2.;
        st *= rot45;
        st.y += iTime * 0.05;
    }
    return ret;
}

vec3 background(vec2 uv) {
    uv *= rot(-PI / 2.);
    uv = clog(uv);
    uv.x -= iTime * 0.1;
    uv /= PI;
    float fa1 = fbm(uv * rot(sin(uv.x) * 0.001), 5.);
    float fb1 = fbm(uv, 5.);

    float fa2 = fbm(uv + sin(uv.x * 15.) + fa1 * 5., 4.);
    float fb2 = fbm(uv + fb1, 5.);

    //float fa3 = fbm(uv * 1.5 + fa2, 5.);

    vec3 col = vec3(0);
    col = mix(col, BACKGROUND_COLOR, pow(sat(fb2 * 2.4), 1.5));
    col = mix(col, vec3(0.4, 0.3, 0.7), pow(sat(fb2 * .7), 1.9));
    col = mix(col, vec3(0.3, 0.6, 0.6), pow(sat(fa2 * 1.5), 20.) * 0.7);
    col = mix(col, vec3(0.), voronoi(uv * 10. + fa1 * 4.) * .8);

    col.yz *= rot(-0.16);

    return col;
}

struct Params {
    float stroke;
    float displacement;
    float time;
    float shift;
};

float sd_teeth(vec2 coords,
               float t,
               float width,
               float spacing,
               vec2 size,
               vec2 fang_range,
               float fang_length,
               float x) { 
    // center on the curve middle point
    coords.y -= (t - 0.5) * width;
    coords.y = op_rem_lim(coords.y, spacing, width + spacing / 1.3);
    coords *= rot(-1.57);
    // make fangs longer
    fang_range *= spacing / width * 2.;
    float off =
        fang_length * smoothstep(fang_range.x, fang_range.y, abs(t * 2. - 1.));
    size += vec2(x * off, off);
    // move outwards
    coords.y += size.y;
    float tooth = sd_trig_isosceles(coords, size);
    return tooth;
}

float make_mouth(inout vec4 final_color, vec2 uv, Params p) {
    uv *= 1.15;
    uv.y -= -0.02;
    uv *= rot(0.03);
    float poff = remap01(p.shift, -0.05, 0.05);
    float lip_off = remap01(p.shift, 0., 0.2);

    vec2 a = vec2(-0.5, 0.0 + poff);
    vec2 b = vec2(0., -0.70);
    vec2 c = vec2(0.5, 0.0 + poff);

    float width = 3.8;
    float spacing = .26;
    vec2 size = vec2(0.25, 0.07);
    vec4 curve_lower = sd_bezier_rep(uv, a, b, c);
    float teeth_lower = sd_teeth(curve_lower.yz, curve_lower.w, width, spacing,
                                 size, vec2(2.4, 5.3), 0.031, -8.);

    vec2 la = c - vec2(0.04, 0.02);
    vec2 lb = vec2(0., 0.1 + lip_off);
    vec2 lc = a - vec2(-0.04, 0.02);

    width = 3.7;
    spacing = .31;
    size = vec2(0.24, 0.09);
    vec4 curve_upper = sd_bezier_rep(uv, la, lb, lc);
    float teeth_upper = sd_teeth(curve_upper.yz, curve_upper.w, width, spacing,
                                 size, vec2(3., 4.), 0.06, -1.);

    float mouth = max(curve_lower.x, curve_upper.x);
    LayerFlat(mouth, SKIN_COLOR * 0.35);
    vec2 tuv = uv - vec2(0., -0.48 + poff);
    tuv.x = abs(tuv.x);
    float tongue = sd_line(tuv, vec2(0.1, 0.20), vec2(-0.3, 0.)) - 0.19 +
                   p.displacement * 0.002;
    tongue = max(tongue, mouth);
    LayerFlat(tongue, BRIGHT_RED);
    LayerStroked(teeth_upper, TEETH_COLOR, p.stroke * 1.3);
    LayerStroked(teeth_lower, TEETH_COLOR, p.stroke * 1.3);
    float border = smin(abs(curve_lower.x), abs(curve_upper.x), 0.1);
    LayerFlat(border - 0.004, BORDER_COLOR);

    vec2 huv = uv - vec2(0.06, -0.38 + poff * 0.4);
    huv *= rot(-0.15);
    huv *= vec2(0.3, 1.);
    huv.y -= sqrt(pow2(huv.x) + 0.0001) * 0.5;
    float highlight =
        sd_circle(huv, max(0.015, smoothstep(-0.8, 1., p.shift) * 0.02));
    draw_highlight(final_color, highlight);

    return curve_lower.x - p.stroke * 0.5;
}

vec2 head_tranform(vec2 uv, Params p, float amp) {
    vec2 head_uv = uv;
    head_uv.y -= 0.85;
    head_uv -= vec2(0.04, 0.1) * p.shift * amp;
    head_uv *= rot(remap01(p.shift, 0., 0.05));
    return head_uv;
}

vec2 head_tranform_point(vec2 p, Params par, float amp) {
    vec2 head_p = p;
    head_p += vec2(0.04, 0.1) * par.shift * amp;
    head_p *= rot(-remap01(par.shift, 0., 0.05));
    return head_p;
}

float make_head(inout vec4 final_color, vec2 uv, Params p) {
    uv -= vec2(0.00, 0.8);
    float egg = sd_egg(vec2(uv.x, -uv.y), 0.95, 0.3);

    vec2 euv = uv - vec2(0.84, -0.71);
    float b = dot(euv - 0.35, vec2(-4.88, 0.2));
    float ear =
        sd_uneven_capsule(euv, vec2(0.04, -0.04), vec2(0.17, 0.33), 0.07, 0.20);
    ear = smax(ear, -b, 0.4);
    float head = smin(egg, ear, 0.13);
    LayerStroked(head, SKIN_COLOR, p.stroke);

    float snail =
        sd_uneven_capsule(euv, vec2(0.04, 0.05), vec2(0.17, 0.35), 0.10, 0.13);
    snail = smax(snail, -b, 0.87);
    snail = smax(snail, -egg, 0.4);
    snail = smax(snail, -sd_circle(euv - vec2(0.01, 0.15), 0.05), 0.54);
    LayerStroked(snail, vec3(0.5, 0.1, 0.1) * 0.4, p.stroke * 0.7);
    float snail_inner = sd_uneven_capsule(
        euv - pow2(uv.x) * 0.00, vec2(0.08, 0.15), vec2(0.09, 0.3), 0.03, 0.07);
    snail_inner = max(snail_inner, snail);
    LayerStroked(snail_inner, vec3(0.5, 0.1, 0.1) * 0.25, p.stroke * 0.9);

    float highlight = 1e9;
    float base = abs(egg - 0.015) - 0.01;
    float right = base + smooth_hill(uv.x, -0.62, -0.26, 0.505);
    highlight = min(highlight, right);
    float left = base + smooth_hill(uv.x, 0.56, -0.39, 0.58) * 0.1;
    left = max(left, dot(uv, vec2(2.14, -0.13)) - 1.82);
    highlight = min(highlight, left);
    highlight = max(highlight, egg);
    float on_ear = abs(ear - 0.015) - 0.01;
    on_ear += smooth_hill(uv.x, 1., -0.61, 0.98) * 0.1;
    on_ear = max(on_ear, dot(uv, vec2(-0.54, 0.54)) + 0.88);
    on_ear = max(on_ear, ear);
    highlight = min(highlight, on_ear);

    draw_highlight(final_color, highlight);

    return head;
}

void make_nose(inout vec4 final_color, vec2 uv, Params p) {
    uv.y -= -0.02;
    vec2 nuv = vec2(abs(uv.x), uv.y);
    uv -= vec2(0.08, 0.14 + remap01(p.shift, 0., 0.15));
    nuv -= vec2(0.08, 0.14 + remap01(p.shift, 0., 0.15));
    vec2 def = vec2(-1.06, 0.21);
    nuv.x -= max(0.0, dot(nuv, def));
    float shadow = sd_line(uv, vec2(-0.02, 0.03), vec2(0.05, 0.04)) - 0.02;
    float ds =
        sd_line(uv, vec2(0.05, 0.06), vec2(0.06, 0.08 + p.shift * 0.06)) - 0.01;
    shadow = smin(shadow, ds, 0.10);
    float nostrils = sd_circle(nuv, 0.04);
    shadow = max(shadow, -nostrils + 0.008);
    nostrils = abs(nostrils) - 0.004;
    nostrils = max(nostrils, dot(nuv - vec2(0., 0.025), vec2(-0.06, -0.21)));
    LayerFlat(nostrils, BORDER_COLOR);
    draw_highlight(final_color, shadow);
}

vec2 translate_rotate(in vec2 p, in vec2 off, in float a) {
    p = p - off;
    p *= rot(a);
    return p;
}

float intersection(float d1, float d2) {
    float dmin = min(abs(d1), abs(d2));
    return dmin * sign(d1) * sign(d2);
}

float make_body(inout vec4 final_color, vec2 uv, Params p) {
    vec2 left_shoulder = vec2(0.98, -0.33), left_top = vec2(0.51, 1.06);    
    vec2 a = left_shoulder, b = vec2(-0.001, -0.29), c = left_top;
    float base = sd_bezier_convex(uv, a, b, c);
    float body = base;

    vec2 right_shoulder = vec2(-1.16, -0.22), right_top = vec2(-0.37, 1.06);
    
    right_top += head_tranform_point(vec2(1.), p, 50.) * 0.05;
    
    a = right_top, b = vec2(-0.16, -0.30), c = right_shoulder;
    base = sd_bezier_convex(uv, a, b, c);
    body = intersection(body, base);

    a = left_top, c = right_top, b = (a + c) / 2. - vec2(0., 0.1);
    base = sd_bezier_convex(uv, a, b, c);
    body = intersection(body, base);

    vec2 right_side = vec2(-2.14, -1.71);
    vec2 left_side = vec2(2.07, -2.17);

    a = right_side, c = left_side, b = (a + c) / 2. + vec2(0., -0.1);
    base = sd_bezier_convex(uv, a, b, c);
    body = intersection(body, base);

    a = right_shoulder, b = vec2(-2.3, -0.02), c = right_side;
    float rbase = sd_bezier_convex(uv, a, b, c);
    body = intersection(body, rbase);

    a = left_side, b = vec2(2.79, -0.24), c = left_shoulder;
    float lbase = sd_bezier_convex(uv, a, b, c);
    body = intersection(body, lbase);

    float arm = sd_line(uv, vec2(1.6, -1.03), vec2(2.76, -1.73)) - 0.5;
    body = smin(body, arm, 0.1);

    vec2 huv = head_tranform(uv, p, 0.5) - vec2(0., -0.15);
    float head_shadow = sd_egg(vec2(huv.x, -huv.y), 0.5, 0.07);
    head_shadow = max(head_shadow, body);

    // collar bones
    float areas = 1e9, strokes = 1e9;
    a = vec2(-0.28, 0.09), b = vec2(-0.07, -0.53), c = vec2(-0.64, -0.56);
    base = sd_bezier_convex(uv, a, b, c);
    areas = intersection(areas, base);
    b = vec2(-0.09, -0.63);
    base = sd_bezier_convex(uv, a, b, c);
    areas = intersection(areas, base);

    a = vec2(-1.27, -0.28), c = vec2(-0.26, -0.60), b = vec2(-1.06, -0.52);
    float bone_base = sd_bezier(uv, a, b, c).x;
    strokes = min(strokes, abs(bone_base) - 0.005);
    areas = max(areas, bone_base);
    vec2 tuv = uv + vec2(1.11, 0.345);
    tuv *= rot(-2.72);
    float edge = sd_trig_isosceles(tuv, vec2(0.3, 0.2)) - 0.1;
    edge = max(edge, bone_base);
    areas = min(areas, edge);
    c = vec2(1.23, -0.43), a = vec2(0.22, -0.60), b = vec2(1.18, -0.60);
    bone_base = sd_bezier(uv, a, b, c).x;
    strokes = min(strokes, abs(bone_base) - 0.005);
    tuv = uv + vec2(-1.09, 0.47);
    tuv *= rot(-3.3);
    edge = sd_trig_isosceles(tuv, vec2(0.3, 0.2)) - 0.1;
    edge = max(edge, bone_base);
    areas = min(areas, edge);
    a = vec2(-0.24, -0.61), c = vec2(0.20, -0.6), b = vec2(-0.01, -0.84);
    strokes = smin(strokes, abs(sd_bezier(uv, a, b, c).x) - 0.005, 0.02);

    a = vec2(0.28, 0.08), b = vec2(0.14, -0.51), c = vec2(0.51, -0.60);
    base = sd_bezier_convex(uv, a, b, c);
    areas = intersection(areas, base);
    b = vec2(0.069, -0.62);
    base = sd_bezier_convex(uv, a, b, c);
    areas = intersection(areas, base);

    // arms
    a = vec2(1.70, -1.17), b = vec2(1.52, -1.81), c = vec2(5.63, -4.82);
    vec2 bz = sd_bezier(uv, a, b, c);
    areas = min(areas, abs(bz.x) - 0.6 * smoothstep(-0.04, 0.91, bz.y));
    a = vec2(-1.31, -1.09), b = vec2(-1.20, -1.48), c = vec2(-1.63, -2.13);
    bz = sd_bezier(uv, a, b, c);
    areas = min(areas, abs(bz.x) - 0.05 * smoothstep(-0.11, 0.39, bz.y));

    // chest
    a = vec2(-0.26, -0.98), b = vec2(0.07, -1.12), c = vec2(0.23, -2.24);
    bz = sd_bezier(uv, a, b, c);
    float cleavage = abs(bz.x) - 0.1 * smoothstep(-0.07, 0.9, bz.y) -
                     0.025 * pow2(sin(bz.y * 6.32 + 12.76));
    areas = min(areas, cleavage);
    
    float w = 0.003;
    float on_neck = sd_line_y(uv - vec2(0.17, -0.08), 0.3, w * 2.);
    on_neck =
        smin(on_neck, sd_line_y(uv - vec2(0.16, 0.02), 0.2, w * 2.), 0.02);
    vec2 luv = translate_rotate(uv, vec2(0.21, 0.), 0.1);
    on_neck = min(on_neck, sd_line_y(luv, 0.2, w * 1.5));

    float weirmo = sin(uv.x * 10. + p.displacement * 24. + 3.1) * 0.003;
    LayerStroked(body, SKIN_COLOR, p.stroke);
    LayerFlat(on_neck, BLOOD_COLOR);
    LayerFlat(head_shadow, vec4(SKIN_COLOR * 0.01, 0.5));
    // TODO: should be the same color as head shadow
    LayerStrokedMask(areas, vec4(vec3(0.3, 0.1, 0.1) * .25, 0.9), p.stroke,
                     weirmo);
    LayerFlat(strokes + weirmo, BORDER_COLOR);

    float hbase = abs(body - 0.015) - 0.01;
    float highlight = hbase + smooth_hill(uv.x, 1.94, -1.05, 0.55) * 0.05;
    highlight =
        min(highlight, hbase + smooth_hill(uv.x, -1.63, -0.49, 0.28) * 0.05);
    highlight = max(highlight, body);
    draw_highlight(final_color, highlight);

    return body;
}

float make_hair_back(inout vec4 final_color, vec2 uv, Params p) {
    // right side
    vec2 c = vec2(1.16, 1.69), b = vec2(1.49, 0.69), a = vec2(3.36, -0.04);
    c = head_tranform_point(c, p, .75);
    vec2 base = sd_bezier(uv, a, b, c);
    float hair = max(base.x, -uv.x);
    vec2 cuv = translate_rotate(uv - vec2(1., 1.) * p.shift * 0.01,
                                vec2(-0.19, -3.03), -1.11);
    float cuts = sd_hook(cuv, 4.22, 0.25, 1.);
    cuv = translate_rotate(uv - vec2(1., 1.) * p.shift * 0.02,
                           vec2(-1.48, -2.51), 5.8);
    cuts = min(cuts, sd_hook(cuv, 4.22, 0.1, 1.));
    cuv = translate_rotate(uv, vec2(-2.65, -1.53), 5.8);
    cuts = min(cuts, sd_hook(cuv, 4.22, 0.25, 1.));
    cuv = translate_rotate(uv, vec2(-3.71, -0.12), 6.24);
    cuts = min(cuts, sd_hook(cuv, 4.22, 0.25, 1.));

    float highlight = abs(base.x + 0.020) - 0.008;
    highlight = max(highlight, base.x);

    // left side
    a = vec2(-1.53, 2.5), c = vec2(-1.66, 0.64), b = vec2(-0.76, 0.90);
    a = head_tranform_point(a, p, 1.);
    float left_base = sd_bezier_convex(uv, a, b, c);
    a = vec2(-1.56, 0.66), b = vec2(-2.98, 0.47), c = vec2(-3.15, -0.42);
    c = head_tranform_point(c, p, 1.);
    left_base = min(left_base, sd_bezier_convex(uv, a, b, c));
    left_base = min(left_base, uv.y);
    hair = min(hair, max(left_base, uv.x));
    cuv = translate_rotate(uv, vec2(-1.01, -1.51), 0.73);
    cuts = min(cuts,
               sd_hook(cuv - vec2(-1., 1.) * p.shift * 0.02, 2.22, 0.25, -1.));
    cuv = translate_rotate(uv, vec2(1.55, -2.34), 0.3);
    cuts = min(cuts,
               sd_hook(cuv - vec2(-1., 0.) * p.shift * 0.02, 4.22, 0.05, -1.));
    cuv = translate_rotate(uv, vec2(2.0, -2.33), 0.33);
    cuts = min(cuts, sd_hook(cuv, 4.22, 0.3, -1.));
    hair = max(hair, -cuts);

    float left_highlight = abs(left_base + 0.025) - 0.011;
    left_highlight = max(left_highlight, left_base);
    left_highlight = max(left_highlight, uv.x + 0.8);
    left_highlight = max(left_highlight, -uv.y + 0.3);
    highlight = min(highlight, left_highlight);
    vec2 luv = translate_rotate(uv - vec2(-1., 1.) * p.shift * 0.02,
                                vec2(-0.95, -1.49), 0.72);
    float clight = sd_hook(luv, 2.22, 0.25, -1.);
    luv = translate_rotate(uv - vec2(1., 1.) * p.shift * 0.01,
                           vec2(-0.33, -3.00), -1.06);
    clight = min(clight, sd_hook(luv, 4.22, 0.25, 1.));
    clight = max(hair + p.stroke * 0.9, clight);
    highlight = min(highlight, clight);

    vec2 huv = (uv + vec2(0.02, 1.02)) * vec2(2., 1.);
    huv = head_tranform(huv, p, 1.);
    vec3 hair_color =
        mix(HAIR_COLOR, HAIR_SHADOW_COLOR, AAstep(sd_circle(huv, 1.6), 0.));
    LayerStroked(hair, hair_color, p.stroke * 1.2);

    draw_highlight(final_color, highlight);

    return hair;
}

void make_hair_front(inout vec4 final_color,
                     vec2 uv,
                     Params p,
                     float dhead,
                     float dbody,
                     float dbhair) {
    vec2 head_uv = head_tranform(uv, p, 1.);
    vec2 cuv = head_uv - vec2(5.14, -0.81);
    float right_hair = sd_circle(cuv, 5.99);
    right_hair = abs(right_hair) - 0.2;
    right_hair = max(right_hair, cuv.x);
    right_hair = max(right_hair, -dbody);

    float hbase = abs(right_hair - 0.015) - 0.01;
    float highlight = hbase + smooth_hill(uv.y, 0.42, -0.67, 1.09) * 0.1;
    highlight = max(highlight, right_hair);
    highlight = max(highlight, uv.x + 0.7);

    vec2 suv = uv - vec2(2.26, 0.13);
    suv *= rot(0.13);
    float right_hair_shadow = sd_hook(suv, 3.1, 0.19, -1.);
    right_hair_shadow = max(right_hair_shadow, -dbody);

    float skin_shadow = -sd_circle(head_uv - vec2(0.91, -0.32), 1.51);
    skin_shadow = max(skin_shadow, dhead);
    skin_shadow = max(skin_shadow, -right_hair);
    skin_shadow = max(skin_shadow, head_uv.x);

    vec2 a = vec2(-0.22, 1.53), c = vec2(-2.9, -1.52), b = vec2(-1.11, -1.04);
    a = head_tranform_point(a, p, .3);
    vec2 vuv = uv;
    vec2 base = sd_bezier(vuv, a, b, c);
    float right_curl = base.x;
    right_curl = abs(right_curl) -
                 remap(sin(base.y * 4.93 + 1.93), -1., 1., 0.01, 0.14) +
                 smoothstep(0.43, 1.94, base.y) * 0.1;
    vec2 huv = uv - vec2(-3.21, 2.74);
    huv -= 0.1 * p.shift;
    huv *= rot(0.64);
    skin_shadow = min(skin_shadow, sd_hook(huv, 3.43, -0.1, 1.));

    hbase = abs(right_curl - 0.015) - 0.01;
    float clight = hbase + smooth_hill(base.y, 0.31, -0.15, 0.24) * 0.1;
    clight = max(clight, right_curl);
    clight = max(clight, dot(uv, vec2(0.28, -0.19)) + 0.26);
    highlight = min(highlight, clight);

    a = vec2(1.26, 1.02), c = vec2(1.00, -0.24), b = vec2(1.55, 0.43);
    a = head_tranform_point(a, p, .3);
    base = sd_bezier(uv, a, b, c);
    float left_curl = base.x, t = base.y, tt = base.y;
    a = c, c = vec2(1.28, -1.75), b = vec2(0.32, -1.07);
    left_curl =
        abs(left_curl) - remap(sin(t * -2.05 + 3.6), -1., 1., 0.01, 0.20);
    base = sd_bezier(uv, a, b, c);
    float sec = base.x;
    t = 1. - base.y;
    sec = abs(sec) - remap(sin(t * -2.05 + 3.6), -1., 1., 0.01, 0.20);
    left_curl = min(left_curl, sec);
    huv = translate_rotate(uv, vec2(1.99, -1.3), 0.47);
    float lcurl_shadow = sd_hook(huv, 1.5, 0.2, -1.);
    lcurl_shadow = max(lcurl_shadow, left_curl + p.stroke);
    huv = translate_rotate(uv, vec2(-0.19, 0.95), 0.05);
    float sh = sd_hook(huv, 1.5, 0.2, 1.);
    sh = max(sh, -left_curl);
    sh = max(sh, -dbody);
    sh = max(sh, dbhair + p.stroke * 1.2);
    lcurl_shadow = min(lcurl_shadow, sh);

    hbase = abs(left_curl - 0.015) - 0.01;
    clight = hbase + smooth_hill(tt, 0.54, -0.46, 0.7) * 0.1;
    clight = max(clight, left_curl);
    clight = max(clight, dot(uv, vec2(-0.47, 0.07)) + 0.62);
    highlight = min(highlight, clight);

    // LayerFlat(skin_shadow, vec4(SKIN_COLOR * 0.3, 0.5));
    LayerFlat(skin_shadow, vec4(final_color.rgb * 0.2, 0.5));
    float mask = dot(head_uv, vec2(5.13, 1.31)) + 3.81;
    LayerStrokedMask(right_hair, vec4(HAIR_COLOR, 1.), p.stroke, mask);
    mask = dot(suv, vec2(-3.86, -0.54)) + -12.;
    LayerStrokedMask(right_hair_shadow, vec4(HAIR_SHADOW_COLOR, 1.),
                     p.stroke * 1.4, mask);

    LayerStroked(right_curl, HAIR_COLOR, p.stroke * 1.1);
    mask = dot(uv, vec2(0.6, -0.48)) + -0.33;
    LayerStrokedMask(left_curl, vec4(HAIR_COLOR, 1.), p.stroke * 1.4, mask);
    LayerFlat(lcurl_shadow, vec4(HAIR_SHADOW_COLOR, 1.));

    draw_highlight(final_color, highlight);
}

void make_blood(inout vec4 final_color,
                vec2 uv,
                Params p,
                float dmouth,
                float dhead) {
    vec2 head_uv = head_tranform(uv, p, 1.);
    float blood = 1e9;

    float w = 0.003;
    vec2 luv = translate_rotate(head_uv, vec2(0.64, 0.04), -0.53);
    float lines = sd_line_y(luv, 0.15, w);
    luv = translate_rotate(head_uv, vec2(0.66, 0.07), -0.53);
    lines = min(lines, sd_line_y(luv, 0.11, w));
    luv = translate_rotate(head_uv, vec2(0.68, 0.09), -0.63);
    lines = min(lines, sd_line_y(luv, 0.09, w * 1.5));
    blood = min(blood, lines);

    luv = translate_rotate(head_uv, vec2(0.55, -0.18), -0.1);
    float on_chin = sd_line_y(luv, 0.15, 0.015);
    on_chin =
        smin(on_chin, sd_circle(head_uv - vec2(0.57, -0.24), 0.015), 0.09);
    float cut_plane = dot(head_uv, vec2(0.71, 0.52)) - 0.36;
    on_chin = max(on_chin, cut_plane);
    blood = min(blood, on_chin);

    float on_mouth = sd_circle(head_uv - vec2(0.24, -0.53), 0.016);
    on_mouth = smin(
        on_mouth, sd_line_y(head_uv - vec2(0.235, -0.53), 0.34, w * 2.5), 0.05);
    on_mouth =
        max(on_mouth, -sd_line_y(head_uv - vec2(0.22, -0.535), 0.19, w * 3.5));
    float poff = remap01(p.shift, -0.05, 0.05);
    luv =
        translate_rotate(uv, vec2(0.19 + poff * 0.3, 0.64 + poff * 1.40), 0.9);
    float s = 0.12;
    on_mouth = smin(
        on_mouth,
        sd_line_y(luv / s, 1.4, 0.0025) * s - fbm(head_uv * 2.73 + 0.1, 4.) * s,
        0.06);
    on_mouth = smin(on_mouth, dmouth + 0.004, 0.07);
    on_mouth = max(on_mouth, -dmouth + 0.002);
    blood = min(blood, on_mouth);

    LayerFlat(blood, BLOOD_COLOR);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = (2. * fragCoord - iResolution.xy) / iResolution.y;

    uv *= 1.5;
    uv.y -= 0.1;
    float time = iTime;

    float t = (time) + 0.1;
    uv += (vec2(fbm(vec2(t, 0.), 3.), fbm(vec2(t, 1.), 3.)) * 2. - 1.) * 0.025 *
          (1. - length(uv * 0.05));
    Params p;
    p.time = time;
    p.shift = cos(p.time) * 0.5 + 0.5;
    p.displacement = fbm(uv * 2.91, 2.) * 0.42;
    p.stroke = fwidth(uv.y) * 0.5 + p.displacement * 0.05;

    uv *= rot(0.05);

    vec4 final_color = vec4(vec3(0.051), 1.);
    final_color.rgb = background(uv);

    float dbhair = make_hair_back(final_color, uv, p);
    float dbody = make_body(final_color, uv, p);
    vec2 head_uv = head_tranform(uv, p, 1.);
    float dhead = 1e9, dmouth = 1e9;
    if (uv.y > -0.1) {
        dhead = make_head(final_color, head_uv, p);
        dmouth = make_mouth(final_color, head_uv, p);
        make_nose(final_color, head_uv, p);
        make_blood(final_color, uv, p, dmouth, dhead);
    }
    make_hair_front(final_color, uv, p, dhead, dbody, dbhair);

    final_color.rgb =
        mix(final_color.rgb, vec3(0.), smoothstep(1.50, -2.84, uv.y));

    vec3 col = final_color.rgb;

    col = sat(col);
    col = pow(col, vec3(1. / 1.9));
    col = smoothstep(0., 1., col);
    col = pow(col, vec3(1.74, 1.71, 1.48));
    // col = pow(col, vec3(2.33, 1.47, 2.1));
    // col = pow(col, vec3(2.15, 1.29, 1.43));
    //col = pow(col, vec3(1. / 2.2));
    
    vec2 in_uv = fragCoord / iResolution.xy;
    col *= sat(pow(500. * in_uv.x * in_uv.y * (1. - in_uv.x) * (1. - in_uv.y), .256));
    
    col += noise(uv * 500.) * .015 * smoothstep(-1.47, 0.58, uv.y);
    fragColor = vec4(col, 1.0);
}