// Snowdrift — snow falling over the desktop and settling on the windows.
// @channels bufferA, tex1
// @sim-max-height 200
//
// Flakes fall in five parallax layers that sway and drift with the wind's
// gusts, and settle into soft drifts along the bottom of the screen and on
// the top edge of every window. Piles slump to a natural angle of repose and
// level off at a steady depth. Move a window gently and it carries its snow;
// drag it fast or yank it and the snow slides off in clumps that burst into
// powder where they land. A window pushed into a drift shoves the snow
// aside. The cursor is warm: moving it through snow melts a path that steams
// for a while and slowly fills in again. Click bare desktop for a burst of
// powder and a few big crystal flakes.
//
// iChannel0  Buffer A: piles, window slots, clumps, clocks (layout in
//            snowdrift_common.frag).
// iChannel1  Wallpaper ("Image 2" in the settings), darkened and cooled.
//            Without one a winter landscape is drawn: hills, pines and a lit
//            cabin under a dusk-blue sky by day and a starry one at night,
//            by the local clock.
//
// The tweaks below shape what is drawn. Settling rate, drift height and melt
// radius drive Buffer A and are fixed in snowdrift_common.frag.

const float SNOWFALL   = 1.0;  // @range(0.25, 3.0, 0.05) @label("Snowfall")
const float WIND       = 1.0;  // @range(0.0, 3.0, 0.05) @label("Wind")
const float FLAKE_SIZE = 1.0;  // @range(0.4, 2.5, 0.05) @label("Flake size")
const float SPARKLE    = 1.0;  // @range(0.0, 2.0, 0.05) @label("Sparkle")
const vec3  SNOW_TINT  = vec3(0.95, 0.97, 1.0); // @color @label("Snow tint")

struct Light {
    vec3 amb;   // sky light on snow
    vec3 key;   // moon or low sun
    vec2 dir;   // towards the key light
};

vec2  gK;       // grid px per image px
float gU;       // image px per U (shorter screen side)
float gClock;   // s, mod CLOCK_PERIOD
float gView;    // cursor x in U; shifts sparkle phases
Light gL;

float fallOff(float a, float b, float x) { return 1.0 - smoothstep(a, b, x); }

float sdSegment(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// 1 at night, 0 by day, by the local clock.
float nightAmount()
{
    float h = mod(iDate.w / 3600.0, 24.0);
    return 1.0 - smoothstep(5.5, 7.5, h) * (1.0 - smoothstep(18.0, 20.0, h));
}

// ------------------------------------------------------------- backdrop

float ridge(float x, float base, float amp, float freq, float seed)
{
    float n = 0.65 * vnoise1(x * freq + seed) + 0.35 * vnoise1(x * freq * 2.9 + seed * 1.7);
    return base + amp * (2.0 * n - 1.0);
}

// Pines standing on a ridge: x coverage, y snow on the boughs.
vec2 pines(vec2 p, float cellW, float tall, float base, float amp, float freq, float seed, float aa)
{
    vec2 res = vec2(0.0);
    float ci = floor(p.x / cellW);
    for (int d = -1; d <= 1; d++) {
        float c = ci + float(d);
        float h = hash11(c * 1.37 + seed);
        if (h > 0.62) continue;
        float x0 = (c + 0.15 + 0.7 * hash11(c * 3.1 + seed)) * cellW;
        float th = tall * (0.5 + 0.7 * hash11(c * 5.7 + seed));
        float b = ridge(x0, base, amp, freq, seed) - 0.08 * th;
        float v = (p.y - b) / th;
        if (v < -0.02 || v > 1.02) continue;
        float dx = abs(p.x - x0);
        float tier = fract(v * 4.0 + h * 2.0);
        float w = th * 0.27 * pow(max(1.0 - v, 0.0), 0.85) * (0.5 + 0.5 * (1.0 - tier));
        float cov = fallOff(w - aa, w + aa, dx) * step(0.08, v);
        cov = max(cov, fallOff(th * 0.022 - aa, th * 0.022 + aa, dx) * step(-0.02, v) * step(v, 0.2));
        float snow = smoothstep(0.55, 0.9, 1.0 - tier) * smoothstep(0.15, 0.7, dx / max(w, 1e-4));
        res.x = max(res.x, cov);
        res.y = max(res.y, snow * cov);
    }
    return res;
}

// Cabin with its base centre at the origin of cp (screen heights).
vec3 cabin(vec3 col, vec2 cp, float aa, float night)
{
    const float W = 0.024;   // half width of the walls
    const float WH = 0.02;   // wall height
    float gust = texelFetch(iChannel0, ivec2(8, ROW_GLOBAL), 0).z;

    // Smoke from the chimney, leaning with the wind.
    vec2 sp = cp - vec2(0.013, WH + 0.026);
    if (sp.y > 0.0 && sp.y < 0.13) {
        float lean = sp.y * (0.35 + 0.5 * gust) + 0.004 * sin(sp.y * 60.0 - TAU * fract(gClock * 0.1));
        float wdt = 0.003 + 0.12 * sp.y;
        float n = vnoise2(vec2((sp.x - lean) / 0.008, (sp.y - gClock * 0.012) / 0.012));
        float smoke = exp(-pow((sp.x - lean) / wdt, 2.0)) * smoothstep(0.25, 0.75, n) * exp(-sp.y / 0.06)
                      * smoothstep(0.0, 0.004, sp.y);
        col = mix(col, mix(vec3(0.74, 0.74, 0.80), vec3(0.26, 0.28, 0.35), night), 0.7 * smoke);
    }

    vec3 wallC = mix(vec3(0.34, 0.27, 0.27), vec3(0.075, 0.065, 0.075), night);
    vec3 roofC = mix(vec3(0.24, 0.21, 0.25), vec3(0.05, 0.05, 0.07), night);
    vec3 snowC = mix(vec3(0.86, 0.89, 0.96), vec3(0.44, 0.49, 0.62), night);
    vec3 lampC = vec3(1.0, 0.72, 0.36);

    // Warm light spilling from the windows.
    float glow = exp(-length((cp - vec2(0.0, 0.009)) * vec2(0.6, 1.0)) / 0.018);
    col += vec3(0.9, 0.5, 0.2) * glow * mix(0.08, 0.22, night);

    float roofTop = WH + 0.019 - 0.8 * abs(cp.x);
    float wall = fallOff(W - aa, W + aa, abs(cp.x)) * smoothstep(-0.01, -0.01 + aa, cp.y) * fallOff(WH - aa, WH + aa, cp.y);
    float chim = fallOff(0.003 - aa, 0.003 + aa, abs(cp.x - 0.013)) * smoothstep(WH, WH + aa, cp.y) * fallOff(WH + 0.026 - aa, WH + 0.026 + aa, cp.y);
    float roof = fallOff(roofTop - aa, roofTop + aa, cp.y) * smoothstep(WH - 0.002, WH - 0.002 + aa, cp.y) * fallOff(W + 0.007 - aa, W + 0.007 + aa, abs(cp.x));
    col = mix(col, wallC, wall);
    col = mix(col, roofC, max(roof, chim));
    // Snow on the roof and on the chimney cap.
    float roofSnow = roof * smoothstep(roofTop - 0.0055, roofTop - 0.0045, cp.y);
    float capSnow = fallOff(0.0042 - aa, 0.0042 + aa, abs(cp.x - 0.013)) * smoothstep(WH + 0.025, WH + 0.025 + aa, cp.y) * fallOff(WH + 0.029 - aa, WH + 0.029 + aa, cp.y);
    col = mix(col, snowC, max(roofSnow, capSnow));
    // Two windows and a door.
    vec2 wq = vec2(abs(abs(cp.x) - 0.012), cp.y - 0.009);
    float win = fallOff(0.0042 - aa, 0.0042 + aa, max(wq.x, abs(wq.y))) * wall;
    float bar = fallOff(0.0005 - aa, 0.0005 + aa, min(wq.x, abs(wq.y)));
    col = mix(col, lampC * (0.8 + 0.2 * night) * (1.0 - 0.6 * bar), win);
    float door = fallOff(0.0035 - aa, 0.0035 + aa, abs(cp.x)) * fallOff(0.013 - aa, 0.013 + aa, cp.y) * wall;
    col = mix(col, wallC * 0.6, door);
    // Snow banked against the walls, merging into the hillside below.
    vec3 hillC = mix(vec3(0.60, 0.65, 0.83), vec3(0.19, 0.22, 0.32), night);
    float bank = 0.003 + 0.0015 * sin(cp.x * 260.0) + 0.004 * smoothstep(0.012, W + 0.008, abs(cp.x));
    float drift = fallOff(bank - aa, bank + aa, cp.y) * fallOff(W + 0.006, W + 0.014, abs(cp.x))
                * smoothstep(-0.012, -0.003, cp.y);
    col = mix(col, mix(hillC, snowC, smoothstep(-0.006, bank, cp.y) * 0.6), drift);
    return col;
}

vec3 landscape(vec2 fc, float night)
{
    float H = iResolution.y;
    vec2 p = fc / H;
    float aspect = iResolution.x / H;
    float aa = 1.0 / H;

    vec3 dTop = vec3(0.15, 0.23, 0.43), dMid = vec3(0.34, 0.43, 0.64), dHor = vec3(0.70, 0.66, 0.77);
    vec3 nTop = vec3(0.012, 0.018, 0.050), nMid = vec3(0.030, 0.045, 0.100), nHor = vec3(0.075, 0.100, 0.185);
    float y = p.y;
    vec3 day = mix(dHor, dMid, smoothstep(0.28, 0.6, y));
    day = mix(day, dTop, smoothstep(0.55, 1.0, y));
    day += vec3(0.20, 0.08, 0.02) * exp(-max(y - 0.3, 0.0) / 0.12);
    vec3 nite = mix(nHor, nMid, smoothstep(0.25, 0.55, y));
    nite = mix(nite, nTop, smoothstep(0.5, 1.0, y));
    vec3 col = mix(day, nite, night);

    // Stars, twinkling on integer cycles of the clock period.
    if (night > 0.01) {
        float cell = 0.011;
        vec2 id = floor(p / cell);
        float h = hash12(id + 3.0);
        if (h > 0.86) {
            vec2 sp = (id + 0.25 + 0.5 * hash22(id)) * cell;
            float d = length(p - sp) * H;
            float n = floor(60.0 + 240.0 * hash11(h * 77.0));
            float tw = 0.6 + 0.4 * sin(TAU * fract(gClock * n / CLOCK_PERIOD) + h * 50.0);
            float b = (h - 0.86) / 0.14;
            float sz = 0.6 + 1.1 * b * b;
            col += vec3(0.85, 0.9, 1.0) * fallOff(sz * 0.4, sz + 0.7, d) * (0.25 + 0.75 * b) * tw
                   * night * smoothstep(0.3, 0.55, y);
        }
    }

    // Moon with a soft halo.
    vec2 mc = vec2(aspect * 0.78, 0.8);
    float mr = 0.042;
    float md = length(p - mc);
    vec3 moonCol = mix(vec3(0.86, 0.87, 0.92), vec3(1.0, 0.97, 0.88), night);
    float halo = exp(-max(md - mr, 0.0) / 0.05) * 0.22 + exp(-max(md - mr, 0.0) / 0.22) * 0.09;
    col += moonCol * halo * mix(0.45, 1.0, night);
    if (md < mr + aa) {
        float disc = fallOff(mr - aa, mr + aa, md);
        float maria = vnoise2((p - mc) / mr * 2.2 + 5.0) * 0.6 + vnoise2((p - mc) / mr * 5.0) * 0.4;
        vec3 face = moonCol * (0.86 + 0.14 * smoothstep(0.35, 0.7, 1.0 - maria));
        col = mix(col, face, disc * mix(0.55, 1.0, night));
    }

    vec3 haze = mix(vec3(0.66, 0.66, 0.78), vec3(0.09, 0.115, 0.20), night);

    // Far hills.
    float rf = ridge(p.x, 0.36, 0.045, 1.1, 2.0);
    if (y < rf + aa) {
        vec3 hc = mix(vec3(0.60, 0.63, 0.78), vec3(0.14, 0.17, 0.27), night);
        hc = mix(haze, hc, smoothstep(rf - 0.12, rf, y) * 0.6 + 0.2);
        col = mix(col, hc, fallOff(rf - aa, rf + aa, y));
    }
    // Middle hills with a pine wood.
    float rm = ridge(p.x, 0.26, 0.06, 1.7, 11.0);
    vec2 pm = y < 0.26 + 0.06 + 0.06 && y > 0.12 ? pines(p, 0.022, 0.05, 0.26, 0.06, 1.7, 11.0, aa) : vec2(0.0);
    if (y < rm + aa || pm.x > 0.0) {
        vec3 hc = mix(vec3(0.56, 0.61, 0.79), vec3(0.17, 0.20, 0.30), night);
        hc *= 0.92 + 0.12 * smoothstep(rm - 0.05, rm, y);
        hc = mix(haze, hc, 0.35 + 0.55 * smoothstep(rm - 0.14, rm, y));
        col = mix(col, hc, fallOff(rm - aa, rm + aa, y));
        vec3 pc = mix(vec3(0.30, 0.36, 0.52), vec3(0.05, 0.07, 0.13), night);
        pc = mix(pc, mix(vec3(0.66, 0.70, 0.84), vec3(0.20, 0.24, 0.36), night), pm.y);
        col = mix(col, mix(haze, pc, 0.75), pm.x);
    }
    // A cabin on the middle hills, its windows lit, smoke from the chimney.
    float cx = aspect * 0.23;
    float cb = min(ridge(cx - 0.02, 0.26, 0.06, 1.7, 11.0), ridge(cx + 0.02, 0.26, 0.06, 1.7, 11.0)) + 0.002;
    vec2 cp = p - vec2(cx, cb);
    if (abs(cp.x) < 0.12 && cp.y > -0.02 && cp.y < 0.16) col = cabin(col, cp, aa, night);

    // Near hills, taller pines.
    float rn = ridge(p.x, 0.15, 0.06, 2.4, 23.0);
    vec2 pn = y < 0.15 + 0.06 + 0.125 && y > 0.0 ? pines(p, 0.04, 0.11, 0.15, 0.06, 2.4, 23.0, aa) : vec2(0.0);
    if (y < rn + aa || pn.x > 0.0) {
        vec3 hc = mix(vec3(0.66, 0.71, 0.87), vec3(0.23, 0.265, 0.37), night);
        hc *= 0.9 + 0.14 * smoothstep(rn - 0.06, rn, y);
        hc = mix(haze, hc, 0.6 + 0.4 * smoothstep(rn - 0.15, rn, y));
        col = mix(col, hc, fallOff(rn - aa, rn + aa, y));
        vec3 pc = mix(vec3(0.17, 0.22, 0.34), vec3(0.03, 0.045, 0.085), night);
        pc = mix(pc, mix(vec3(0.74, 0.78, 0.90), vec3(0.24, 0.28, 0.42), night), pn.y);
        col = mix(col, pc, pn.x);
    }
    return col;
}

vec3 wallpaper(vec2 fc, float night)
{
    vec2 uv = fc / iResolution.xy;
    vec2 texRes = iChannelResolution[1].xy;
    float sa = iResolution.x / iResolution.y;
    float ta = texRes.x / texRes.y;
    vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
    vec3 c = texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(l), 0.25) * vec3(0.80, 0.87, 0.98) * mix(0.82, 0.62, night);
    return c + vec3(0.02, 0.03, 0.06) * smoothstep(0.4, 1.0, uv.y);
}

// ------------------------------------------------------------- flakes

vec3 drawFlakes(vec3 col, vec2 fc, float night)
{
    vec2 p = fc / gU;
    float gust = texelFetch(iChannel0, ivec2(8, ROW_GLOBAL), 0).z;
    vec3 fcol = mix(vec3(0.95, 0.96, 1.0), vec3(0.78, 0.84, 0.98), night) * SNOW_TINT;
    for (int l = 0; l < NLAYER; l++) {
        vec3 L = flakeLayer(l);
        vec4 o4 = texelFetch(iChannel0, ivec2(1 + l / 2, ROW_GLOBAL), 0);
        vec2 off = (l - (l / 2) * 2) == 0 ? o4.xy : o4.zw;
        float fl = float(l);
        float baseR = 0.9 * pow(1.55, fl);
        float blur = l == 4 ? 0.9 : 0.22 + 0.08 * fl;
        float bright = l == 4 ? 0.42 : 0.35 + 0.17 * fl;
        float dens = min(0.95, (0.56 - 0.08 * fl) * SNOWFALL);

        vec2 q = p / L.x + vec2(-WIND * off.y, off.x);
        vec2 id = floor(q);
        vec2 f = fract(q) - 0.5;
        vec2 hid = vec2(mod(id.x, 4096.0), mod(id.y, 256.0)) + fl * 31.7;
        float pres = hash12(hid);
        if (pres > dens) continue;
        vec2 h = hash22(hid + 3.7);
        float n = floor(150.0 + 330.0 * h.x);
        float sway = sin(TAU * fract(gClock * n / CLOCK_PERIOD) + h.y * TAU) * (0.07 + 0.08 * gust);
        vec2 c = (h - 0.5) * 0.4 + vec2(sway, 0.0);
        float r = baseR * FLAKE_SIZE * gU / 1000.0 * (0.65 + 0.7 * fract(pres * 13.1));
        float d = length(f - c) * L.x * gU;
        float soft = max(0.7, r * blur);
        float a = fallOff(r - soft, r + soft, d);
        col = mix(col, fcol, a * bright * (0.75 + 0.25 * h.x));
    }
    return col;
}

// ------------------------------------------------------------- piles

vec2 fetchPile(int row, int j, int n, bool ground)
{
    if (ground) j = clamp(j, 0, n - 1);
    else if (j < 0 || j >= n) return vec2(0.0);
    return texelFetch(iChannel0, ivec2(j, row), 0).xy;
}

// Cubic B-spline through a pile row at sample coordinate x (grid px from
// the row origin): height, slope (rise per run), wetness.
vec3 pileSpline(int row, float x, int n, bool ground)
{
    float t = x - 0.5;
    float i0 = floor(t);
    float f = t - i0;
    int j = int(i0);
    vec2 s0 = fetchPile(row, j - 1, n, ground);
    vec2 s1 = fetchPile(row, j, n, ground);
    vec2 s2 = fetchPile(row, j + 1, n, ground);
    vec2 s3 = fetchPile(row, j + 2, n, ground);
    float f2 = f * f;
    float f3 = f2 * f;
    float g = 1.0 - f;
    vec4 w = vec4(g * g * g, 3.0 * f3 - 6.0 * f2 + 4.0, -3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0, f3) / 6.0;
    vec4 dw = vec4(-0.5 * g * g, 1.5 * f2 - 2.0 * f, -1.5 * f2 + f + 0.5, 0.5 * f2);
    vec4 hs = vec4(s0.x, s1.x, s2.x, s3.x);
    vec4 ws = vec4(s0.y, s1.y, s2.y, s3.y);
    return vec3(dot(w, hs), dot(dw, hs), dot(w, ws));
}

float sparkle(vec2 sp, float depth)
{
    float cell = max(2.0, 0.0024 * gU);
    vec2 id = floor(sp / cell);
    float h = hash12(id + 17.0);
    if (h < 0.955) return 0.0;
    vec2 o = (hash22(id) - 0.5) * 0.5 * cell;
    float d = length(sp - (id + 0.5) * cell - o);
    float n = floor(30.0 + 90.0 * hash11(h * 91.0));
    float tw = 0.5 + 0.5 * sin(TAU * fract(gClock * n / CLOCK_PERIOD) + h * 40.0 + gView * 9.0 * hash11(h * 13.0));
    tw = pow(tw, 14.0);
    return tw * exp(-depth / (0.01 * gU)) * fallOff(0.25, 1.1, d);
}

float steamAt(float above, float wet, vec2 sp)
{
    if (wet < 0.02 || above < -2.0 || above > 0.08 * gU) return 0.0;
    float rise = gClock * 0.03 * gU;
    float curl = 0.8 * sin(above / (0.016 * gU) + TAU * fract(gClock * 0.2));
    vec2 q = vec2(sp.x / (0.011 * gU) + curl, (above - rise) / (0.024 * gU));
    float n = 0.65 * vnoise2(q) + 0.35 * vnoise2(q * 2.1 + 7.0);
    return sqrt(wet) * smoothstep(0.42, 0.8, n) * exp(-above / (0.028 * gU)) * smoothstep(-2.0, 5.0, above);
}

vec3 snowColor(float depth, float slope, float wet, vec2 sp, float glow)
{
    vec2 nrm = normalize(vec2(-slope, 1.0));
    float ndl = dot(nrm, gL.dir);
    float near = exp(-depth / (0.045 * gU));
    // The surface normal lights a skin; deeper in, the body is lit evenly.
    vec3 lit = gL.amb + gL.key * mix(0.6, max(ndl, 0.0), exp(-depth / (0.012 * gU)));
    vec3 deep = gL.amb * vec3(0.80, 0.86, 0.97);
    vec3 c = mix(deep, lit, 0.45 + 0.55 * near) * SNOW_TINT;
    c += gL.key * 0.16 * exp(-depth / (0.0025 * gU)) * max(ndl, 0.0);
    c *= 0.97 + 0.045 * vnoise2(mat2(0.8, 0.6, -0.6, 0.8) * sp / (0.007 * gU));
    c = mix(c, c * vec3(0.72, 0.79, 0.90), 0.55 * wet);
    c += wet * 0.22 * exp(-depth / (0.0018 * gU)) * (gL.key + 0.25);
    c += vec3(0.9, 0.95, 1.0) * SPARKLE * sparkle(sp, depth) * (1.0 - 0.6 * wet);
    c += vec3(1.0, 0.52, 0.2) * 0.28 * glow;
    return c;
}

// Composites a pile with surface s (height, slope, wetness in grid units)
// at a pixel `y` image px above the pile's base.
vec3 drawPile(vec3 col, vec3 s, float y, vec2 sp, float baseCut, vec2 glowPos, float glowR)
{
    float hs = s.x / gK.y;
    float slope = s.y * gK.x / gK.y;
    float d = (hs - y) / sqrt(1.0 + slope * slope);
    float a = clamp(d / 1.1 + 0.5, 0.0, 1.0) * baseCut * clamp(hs / 0.6, 0.0, 1.0);
    float glow = glowR > 0.0 ? exp(-dot(glowPos, glowPos) / (2.0 * glowR * glowR)) : 0.0;
    // Powder haze just above the surface.
    float above = max(-d, 0.0);
    col += (gL.amb + gL.key) * 0.06 * exp(-above / (0.004 * gU)) * clamp(hs / 3.0, 0.0, 1.0) * baseCut;
    float st = steamAt(-d, s.z, sp);
    col = mix(col, (gL.amb + 0.5 * gL.key) * 0.95 + 0.25 * glow, st * 0.55);
    if (a <= 0.0) return col;
    return mix(col, snowColor(max(d, 0.0), slope, clamp(s.z, 0.0, 1.0), sp, glow), a);
}

// ------------------------------------------------------------- clumps

float sdRoundBox(vec2 p, vec2 b, float r)
{
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// A slab of snow the size of the pile segment it came from (wid x thick
// px), breaking into nf pieces that drift apart and tumble as it falls.
vec3 fallingClump(vec3 col, vec2 fc, vec2 pos, vec2 vel, float wid, float thick, float age, float seed)
{
    float reach = 0.6 * wid + 3.0 * thick + (0.03 + 0.08 * age) * gU;
    vec2 q = fc - pos;
    if (abs(q.x) > reach || abs(q.y) > reach) return col;

    // Faint powder streaming off the top.
    float sp = length(vel);
    if (sp > 1.0) {
        vec2 vd = vel / sp;
        float along = -dot(q, vd);
        float perp = dot(q, vec2(-vd.y, vd.x));
        float tw = 0.3 * wid + 0.5 * thick;
        float trail = exp(-perp * perp / (tw * tw)) * exp(-max(along, 0.0) / (0.02 * gU)) * step(0.0, along);
        col = mix(col, SNOW_TINT * (gL.amb + 0.5 * gL.key), 0.12 * trail * min(1.0, age * 5.0));
    }

    int nf = int(clamp(wid / max(2.2 * thick, 4.0), 1.0, 5.0));
    float flen = wid / float(nf);
    float spin = (hash11(seed) - 0.5) * 1.6 * age;
    mat2 rot = mat2(cos(spin), sin(spin), -sin(spin), cos(spin));
    float apart = smoothstep(0.0, 0.5, age);
    float dmin = 1e9;
    vec2 lp = vec2(0.0);
    vec2 hsBest = vec2(1.0);
    for (int f = 0; f < 5; f++) {
        if (f >= nf) break;
        vec2 h = hash22(vec2(seed, float(f) + 0.5)) - 0.5;
        float u = (float(f) + 0.5) / float(nf) - 0.5;
        vec2 off = rot * vec2(u * wid * (1.0 + 0.4 * apart) + h.x * 0.03 * gU * age,
                              h.y * 0.12 * gU * age * age);
        float a = spin * (1.0 + 1.5 * h.x) + h.y * 0.5 * apart;
        mat2 fr = mat2(cos(a), -sin(a), sin(a), cos(a));
        vec2 p = fr * (q - off);
        vec2 hs = vec2(0.5 * flen * (0.9 - 0.15 * apart), 0.5 * thick * (1.0 + 0.15 * apart));
        float d = sdRoundBox(p, hs, min(hs.x, hs.y) * 0.95);
        d += thick * 0.3 * (vnoise2(p / max(0.4 * thick, 1.5) + seed + float(f) * 7.0) - 0.5);
        if (d < dmin) {
            dmin = d;
            lp = p;
            hsBest = hs;
        }
    }
    float alpha = clamp(-dmin / 1.1 + 0.5, 0.0, 1.0);
    if (alpha <= 0.0) return col;
    float up = clamp(lp.y / hsBest.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = SNOW_TINT * (gL.amb * (0.8 + 0.2 * up) + gL.key * (0.25 + 0.75 * up));
    c *= 0.95 + 0.08 * vnoise2(lp / (0.006 * gU) + seed);
    c += gL.key * 0.1 * exp(dmin / 1.5);
    return mix(col, c, alpha);
}

// Powder thrown up where a clump lands: a cloud that billows up and thins
// out, and grains on ballistic paths.
vec3 powderPuff(vec3 col, vec2 fc, vec2 pos, float wid, float massPx, float age, float seed)
{
    float grow = 1.0 - exp(-4.0 * age);
    float rx = (0.55 * wid + 0.02 * gU) * (0.45 + 0.9 * grow);
    float ry = 0.55 * rx + 0.015 * gU * grow;
    float reach = rx * 1.8 + 0.12 * gU;
    vec2 q = fc - pos;
    if (abs(q.x) > reach || q.y > reach || q.y < -0.03 * gU) return col;
    float life = age / PUFF_TIME;
    float fade = pow(max(1.0 - life, 0.0), 1.3);
    float strength = clamp(massPx / max(wid, 1.0) / (0.012 * gU), 0.2, 1.0);
    vec3 pc = SNOW_TINT * (gL.amb + 0.7 * gL.key) * 1.08 + 0.04;

    vec2 c = pos + vec2(0.0, ry * (0.35 + 0.5 * grow));
    vec2 e = (fc - c) / vec2(rx, ry);
    vec2 np = (fc - pos) / (0.02 * gU) + seed + vec2(0.0, -1.2 * age);
    float n = 0.65 * vnoise2(np) + 0.35 * vnoise2(np * 2.1 + 4.0);
    float cloud = exp(-dot(e, e) * 1.6) * smoothstep(0.1, 0.8, n + 0.3 * (1.0 - life));
    // Shade the cloud: lit top, the side away from the light dimmer.
    float shade = 0.82 + 0.18 * clamp(e.y * 0.5 + 0.5, 0.0, 1.0);
    col = mix(col, pc * shade, clamp(cloud * fade * strength, 0.0, 0.92));

    // Grains: linear drag k = 3 /s, gravity 1 U/s^2.
    float k = 3.0;
    float e1 = (1.0 - exp(-k * age)) / k;
    float rr = max(0.9, 0.0016 * gU);
    for (int g = 0; g < 12; g++) {
        vec2 h = hash22(vec2(seed * 3.1, float(g) + 0.5));
        vec2 v0 = vec2((h.x - 0.5) * 3.4 * (0.5 * wid + 0.05 * gU), (0.35 + 0.65 * h.y) * 0.6 * gU);
        vec2 gp = pos + v0 * e1 - vec2(0.0, gU * (age - e1) / k);
        float d = length(fc - gp);
        float a = fallOff(rr - 0.4, rr + 0.9, d) * fade;
        col = mix(col, vec3(1.0), a);
    }
    return col;
}

// Clumps base .. base + 15 whose bits are set in `bits`.
vec3 drawClumps(vec3 col, vec2 fc, int base, float bits)
{
    int m = int(bits + 0.5);
    if (m == 0) return col;
    for (int i = 0; i < 16; i++) {
        if (((m >> i) & 1) == 0) continue;
        int k = base + i;
        vec4 b = texelFetch(iChannel0, ivec2(k, ROW_CLUMP + 1), 0);
        int state = clumpStateOf(b);
        if (state == 0) continue;
        vec4 a = texelFetch(iChannel0, ivec2(k, ROW_CLUMP), 0);
        vec2 pos = a.xy / gK;
        float seed = float(k) * 7.13 + 1.0;
        if (state == 1) {
            col = fallingClump(col, fc, pos, a.zw / gK, b.y / gK.x, clumpThickness(b) / gK.y, b.z, seed);
        } else {
            col = powderPuff(col, fc, pos, b.y / gK.x, b.x / (gK.x * gK.y), b.z, seed);
        }
    }
    return col;
}

// ------------------------------------------------------------- click burst

// Six-fold snow crystal of radius R centred at the origin.
float crystal(vec2 p, float R)
{
    float r = length(p);
    float a = atan(p.y, p.x);
    a = mod(a + 3.14159265 / 6.0, 3.14159265 / 3.0) - 3.14159265 / 6.0;
    vec2 q = vec2(cos(a), abs(sin(a))) * r;
    float w = 0.06 * R;
    vec2 b1 = vec2(0.45 * R, 0.0);
    vec2 b2 = vec2(0.72 * R, 0.0);
    float d = sdSegment(q, vec2(0.0), vec2(R, 0.0)) - w;
    d = min(d, sdSegment(q, b1, b1 + 0.33 * R * vec2(0.5, 0.866)) - 0.85 * w);
    d = min(d, sdSegment(q, b2, b2 + 0.2 * R * vec2(0.5, 0.866)) - 0.75 * w);
    return min(d, r - 0.13 * R);
}

vec3 clickBurst(vec3 col, vec2 fc, vec2 pos, float age, float seed, float night)
{
    vec2 q = fc - pos;
    if (abs(q.x) > 0.3 * gU || q.y > 0.25 * gU || q.y < -0.32 * gU) return col;
    vec3 pc = SNOW_TINT * (gL.amb + 0.6 * gL.key);

    // Powder cloud.
    float rc = 0.045 * gU * (0.35 + 1.2 * (1.0 - exp(-5.0 * age)));
    vec2 e = (q - vec2(0.0, 0.015 * gU * age)) / rc;
    vec2 np = q / (0.018 * gU) + seed - vec2(0.0, age);
    float n = 0.65 * vnoise2(np) + 0.35 * vnoise2(np * 2.2 + 3.0);
    float cloud = exp(-dot(e, e) * 1.5) * smoothstep(0.1, 0.8, n + 0.3) * exp(-2.0 * age);
    col = mix(col, pc * 1.08 + 0.03, clamp(cloud, 0.0, 0.85));

    // Grains: radial burst, drag 3.5 /s, gravity 0.8 U/s^2.
    float rr = max(0.8, 0.0012 * gU);
    if (age < 1.6) {
        float k = 3.5;
        float e1 = (1.0 - exp(-k * age)) / k;
        float fade = 1.0 - age / 1.6;
        for (int g = 0; g < 16; g++) {
            vec2 h = hash22(vec2(seed + 1.7, float(g) + 0.5));
            float ang = TAU * (float(g) + 0.6 * h.x) / 16.0;
            vec2 v0 = vec2(cos(ang), sin(ang) + 0.45) * (0.22 + 0.4 * h.y) * gU;
            vec2 gp = pos + v0 * e1 - vec2(0.0, 0.8 * gU * (age - e1) / k);
            col = mix(col, pc * 1.08, fallOff(rr - 0.4, rr + 0.8, length(fc - gp)) * fade);
        }
    }

    // Crystal flakes: tossed up, then fluttering down at 0.04 U/s.
    float k = 2.5;
    float e1 = (1.0 - exp(-k * age)) / k;
    float vis = smoothstep(0.0, 0.12, age) * fallOff(CLICK_TIME - 1.3, CLICK_TIME, age);
    vec3 cc = mix(vec3(0.97, 0.99, 1.0), vec3(0.85, 0.92, 1.0), night) * SNOW_TINT;
    for (int i = 0; i < 5; i++) {
        vec2 h = hash22(vec2(seed + 9.1, float(i) + 0.5));
        vec2 v0 = vec2((float(i) - 2.0) * 0.05 + (h.x - 0.5) * 0.22, 0.16 + 0.34 * h.y) * gU;
        vec2 cp = pos + v0 * e1 - vec2(0.0, 0.1 * gU * (age - e1) / k);
        cp.x += 0.012 * gU * sin(TAU * age * (0.35 + 0.2 * h.y) + h.x * 6.0) * smoothstep(0.2, 1.2, age);
        float R = (0.016 + 0.01 * h.y) * gU * FLAKE_SIZE;
        vec2 lp = fc - cp;
        if (dot(lp, lp) > 4.0 * R * R + 25.0) continue;
        float ang = age * (h.x - 0.5) * 1.6 + h.y * 3.0;
        lp = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * lp;
        float d = crystal(lp, R);
        float glint = pow(0.5 + 0.5 * sin(age * 3.0 + h.x * 9.0 + gView * 4.0), 8.0);
        float a = fallOff(-0.6, 0.9, d) * vis;
        col = mix(col, cc * (1.0 + 0.3 * glint), a);
        col += cc * 0.18 * exp(-max(d, 0.0) / (0.003 * gU)) * vis * (0.6 + glint);
    }
    return col;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    gU = unitLen();
    gK = iChannelResolution[0].xy / iResolution.xy;
    vec4 g0 = texelFetch(iChannel0, ivec2(0, ROW_GLOBAL), 0);
    gClock = g0.z;
    float night = nightAmount();
    bool hasWall = iChannelResolution[1].x > 0.0;

    if (hasWall) {
        gL.amb = mix(vec3(0.64, 0.68, 0.80), vec3(0.40, 0.44, 0.55), night);
        gL.key = mix(vec3(0.34, 0.32, 0.30), vec3(0.30, 0.32, 0.36), night);
        gL.dir = normalize(vec2(-0.4, 1.0));
    } else {
        gL.amb = mix(vec3(0.70, 0.74, 0.87), vec3(0.36, 0.40, 0.50), night);
        gL.key = mix(vec3(0.36, 0.31, 0.27), vec3(0.36, 0.37, 0.40), night);
        gL.dir = normalize(mix(vec2(-0.6, 1.0), vec2(0.5, 1.0), night));
    }

    bool live = cursorLive(iMouse.xy);
    vec2 m = iMouse.xy;
    gView = live ? m.x / gU : 0.0;
    float glowR = live ? 1.3 * MELT_RADIUS * gU : 0.0;

    vec3 col = hasWall ? wallpaper(fragCoord, night) : landscape(fragCoord, night);
    col = drawFlakes(col, fragCoord, night);

    // Ground drift.
    vec2 simRes = iChannelResolution[0].xy;
    float groundTop = (3.5 * DRIFT_HEIGHT + 0.08) * gU + 4.0;
    if (fragCoord.y < groundTop) {
        vec3 s = pileSpline(ROW_GROUND, fragCoord.x * gK.x, int(simRes.x), true);
        col = drawPile(col, s, fragCoord.y, fragCoord, 1.0, fragCoord - m, glowR);
    }

    // Window ledges.
    float ledgeTop = (2.8 * DRIFT_HEIGHT * WINDOW_SHARE + 0.08) * gU + 4.0;
    for (int i = 0; i < iWindowCount && i < NSLOT; i++) {
        vec4 r = iWindowRects[i];
        float top = r.y + r.w;
        float y = fragCoord.y - top;
        if (y < -1.0 || y > ledgeTop) continue;
        float pad = 3.0 / gK.x;
        if (fragCoord.x < r.x - pad || fragCoord.x > r.x + r.z + pad) continue;
        int n = min(int(ceil(r.z * gK.x)), int(simRes.x));
        vec3 s = pileSpline(ROW_PILE + i, (fragCoord.x - r.x) * gK.x, n, false);
        // Past the window's ends the underside of the overhang curls up.
        float out0 = max(max(r.x - fragCoord.x, fragCoord.x - r.x - r.z), 0.0);
        float under = y - 1.4 * out0;
        col = drawPile(col, s, y, fragCoord - r.xy, clamp(under + 0.5, 0.0, 1.0), fragCoord - m, glowR);
    }

    vec4 masks = texelFetch(iChannel0, ivec2(9, ROW_GLOBAL), 0);
    col = drawClumps(col, fragCoord, 0, masks.x);
    col = drawClumps(col, fragCoord, 16, masks.y);
    col = drawClumps(col, fragCoord, 32, masks.z);
    col = drawClumps(col, fragCoord, 48, masks.w);

    int clicks = int(texelFetch(iChannel0, ivec2(8, ROW_GLOBAL), 0).w + 0.5);
    for (int c = 0; c < NCLICK; c++) {
        if (((clicks >> c) & 1) == 0) continue;
        vec4 cs = texelFetch(iChannel0, ivec2(4 + c, ROW_GLOBAL), 0);
        if (cs.w < 0.5 || cs.z > CLICK_TIME) continue;
        col = clickBurst(col, fragCoord, cs.xy / gK, cs.z, float(c) * 13.7 + floor(cs.x) * 0.37, night);
    }

    vec2 uv = fragCoord / iResolution.xy - 0.5;
    col *= 1.0 - 0.22 * dot(uv * vec2(1.0, 0.9), uv * vec2(1.0, 0.9));
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
