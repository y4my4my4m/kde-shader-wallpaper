// Murmuration — starlings over a reed bed.
// @channels bufferA, tex1, bufferB, bufferC
// @sim-max-height 360
//
// A sky over a lake shore where a flock of starlings wheels, folds and
// pulses as one: each bird follows its seven nearest neighbours. Window
// tops are perches: birds peel off in small groups to land in a row along
// them, then sit, hop, preen, look about and now and then flutter over a
// neighbour; some take off to rejoin the flock while others land. Moving
// a window, covering a perch or flicking the cursor past them sends the
// perched birds up all at once. The cursor is a falcon: moving fast near
// the flock opens a hole in it and sends an alarm wave rippling through
// the birds; a slow cursor is ignored. Click open sky and a falcon stoops
// through the point, splitting the flock; around sunset a wild one comes
// by every minute or two.
//
// The sky follows the local clock: a loose flock by day, the full display
// from the hour before sunset, then the birds pour down into the reeds and
// only those perched on windows stay, asleep under the stars and the moon
// (its phase from the date). At dawn they rise out of the reeds and leave.
//
// Tweaks set the number of birds, how tightly they flock, their size,
// perching, the wild falcon, the clock (or a fixed hour, golden hour by
// default), the sky colours and the clouds. All but the last four are shared
// with the buffer passes.
//
// iChannel0  Buffer A: birds and globals (murmuration_common.frag).
// iChannel1  Wallpaper ("Image 2" in the settings) as the sky. Without one
//            a sky with clouds, a far shore, water and reeds is drawn.
// iChannel2  Buffer B: the nearest birds per grid cell.
// iChannel3  Buffer C: flock density.
//
// Lengths are world units: pixels / min(width, height).

const int   BIRDS        = 3600;  // @range(300, 4000, 50) @label("Starlings") @shared
const float COHESION     = 1.0;   // @range(0.4, 2.0, 0.05) @label("Flock tightness") @shared
const float BIRD_SIZE    = 1.0;   // @range(0.5, 2.0, 0.05) @label("Bird size") @shared
const bool  PERCHING     = true;  // @label("Birds perch on windows") @shared
const bool  WILD_FALCON  = true;  // @label("A falcon hunts around sunset") @shared
const bool  FOLLOW_CLOCK = true;  // @label("Sky follows the clock") @shared
const float FIXED_HOUR   = 18.3;  // @range(0.0, 24.0, 0.1) @label("Hour when not following the clock") @shared
const vec3  GLOW_COLOUR  = vec3(1.00, 0.55, 0.24); // @color @label("Sunset glow")
const vec3  EVENING_SKY  = vec3(0.36, 0.38, 0.62); // @color @label("Evening sky")
const vec3  DAY_SKY      = vec3(0.32, 0.56, 0.88); // @color @label("Day sky")
const float CLOUDS       = 1.0;   // @range(0.0, 1.5, 0.05) @label("Clouds")

float gPx;     // one pixel, world units
vec2  gWs;     // world size
vec4  gDc;     // dayCycle()
vec2  gSun;    // sun centre, world units
float gClk;    // animation clock, s, wraps at CLOCK_WRAP
float gYH;     // horizon height, world units
bool  gMorning;

// ------------------------------------------------------------- utilities

float vnoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), w.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), w.x), w.y);
}

float vnoise1(float x)
{
    float i = floor(x);
    float f = fract(x);
    return mix(hash12(vec2(i, 3.7)), hash12(vec2(i + 1.0, 3.7)), f * f * (3.0 - 2.0 * f));
}

float fbm(vec2 p)
{
    const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        s += a * vnoise(p);
        p = M * p + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return s;
}

// Periodic in the animation clock: k whole turns per CLOCK_WRAP.
float wave(float k, float ph) { return sin(TAU * k * gClk / CLOCK_WRAP + ph); }

vec2 rot(vec2 p, float a)
{
    float c = cos(a);
    float s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float sdSeg(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
    return length(pa - ba * h);
}

float sdTaper(vec2 p, vec2 a, vec2 b, float ra, float rb)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
    return length(pa - ba * h) - mix(ra, rb, h);
}

// Signed distance to triangle p0 p1 p2 (Inigo Quilez); a degenerate
// triangle reads as its longest edge.
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2)
{
    vec2 e0 = p1 - p0;
    vec2 e1 = p2 - p1;
    vec2 e2 = p0 - p2;
    vec2 v0 = p - p0;
    vec2 v1 = p - p1;
    vec2 v2 = p - p2;
    vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / max(dot(e0, e0), 1e-12), 0.0, 1.0);
    vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / max(dot(e1, e1), 1e-12), 0.0, 1.0);
    vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / max(dot(e2, e2), 1e-12), 0.0, 1.0);
    float s = e0.x * e2.y - e0.y * e2.x >= 0.0 ? 1.0 : -1.0;
    vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
                     vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))),
                 vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
    return -sqrt(d.x) * sign(d.y);
}

float sdEll(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }

float smin(float a, float b, float k)
{
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float cover(float d) { return clamp(0.5 - d / gPx, 0.0, 1.0); }

// ------------------------------------------------------------- sky

// Sky gradient, sun glow and horizon glow at p (world units).
vec3 skyColour(vec2 p)
{
    float e = gDc.w;
    float v = clamp((p.y - gYH) / max(gWs.y - gYH, 0.1), 0.0, 1.0);
    vec3 dayZ = DAY_SKY * vec3(0.82, 0.88, 0.97);
    vec3 dayH = mix(DAY_SKY, vec3(0.88, 0.92, 0.96), 0.68);
    vec3 golZ = EVENING_SKY;
    vec3 golH = mix(GLOW_COLOUR, vec3(1.0, 0.88, 0.62), 0.4);
    vec3 setZ = EVENING_SKY * vec3(0.62, 0.58, 0.75);
    vec3 setH = GLOW_COLOUR * vec3(1.0, 0.78, 0.72);
    vec3 duskZ = vec3(0.075, 0.09, 0.22);
    vec3 duskH = mix(GLOW_COLOUR * 0.55, vec3(0.50, 0.30, 0.42), 0.6);
    vec3 nightZ = vec3(0.012, 0.018, 0.045);
    vec3 nightH = vec3(0.035, 0.05, 0.10);
    float wDay = smoothstep(0.9, 2.6, e);
    float wSet = 1.0 - smoothstep(-0.1, 0.7, e);
    float wDusk = 1.0 - smoothstep(-0.75, -0.15, e);
    float wNight = 1.0 - smoothstep(-1.5, -0.85, e);
    vec3 z = mix(golZ, dayZ, wDay);
    vec3 h = mix(golH, dayH, wDay);
    z = mix(z, setZ, wSet);
    h = mix(h, setH, wSet);
    z = mix(z, duskZ, wDusk);
    h = mix(h, duskH, wDusk);
    z = mix(z, nightZ, wNight);
    h = mix(h, nightH, wNight);
    vec3 col = mix(h, z, pow(v, 0.55));
    // By day the sky pales toward the sun high above the screen.
    vec2 hiSun = vec2(gSun.x, gWs.y + 0.6);
    col = mix(col, vec3(0.9, 0.94, 0.98), 0.35 * wDay * exp(-distance(p, hiSun) * 1.1));

    // Glow along the horizon on the sun's side, and around the sun.
    float side = exp(-abs(p.x - gSun.x) / (0.7 * gWs.y));
    float gk = smoothstep(-1.0, -0.1, e) * (1.0 - smoothstep(0.8, 2.2, e));
    col += GLOW_COLOUR * exp(-v * 6.0) * (0.15 + 0.4 * side) * gk;
    float d = distance(p, gSun);
    float up = smoothstep(-0.6, 0.2, e) * (1.0 - 0.6 * wDay);
    col += mix(GLOW_COLOUR, vec3(1.0, 0.9, 0.7), 0.5) * (0.45 * exp(-d * 7.0) + 0.35 * exp(-d * 22.0) + 0.4 * exp(-d * 70.0)) * up;
    return col;
}

float cloudAlpha;

// Clouds on a plane above the horizon, lit from the sun's side.
vec3 clouds(vec2 p, vec3 col)
{
    cloudAlpha = 0.0;
    if (CLOUDS <= 0.0) return col;
    float hgt = (p.y - gYH) / gWs.y;
    if (hgt <= 0.0) return col;
    float e = gDc.w;
    float pz = 1.0 / (hgt + 0.08);
    float drift = mod(iDate.w, 86400.0) * 0.0035;
    vec2 cp = vec2((p.x - 0.5 * gWs.x) * pz * 0.55 + drift, pz * 1.25);
    float n = fbm(cp * 0.8);
    vec2 toSun = normalize(vec2(gSun.x - p.x, 0.6 * (gSun.y - p.y)) + 1e-5);
    float n2 = fbm(cp * 0.8 + toSun * 0.18);
    float dayC = smoothstep(0.9, 2.6, e);
    float cov = mix(0.70, 0.46, clamp(CLOUDS, 0.0, 1.5) / 1.5) - 0.05 * dayC;
    float dens = smoothstep(cov, cov + mix(0.2, 0.12, dayC), n) * smoothstep(0.0, 0.06, hgt) * (1.0 - 0.5 * smoothstep(0.55, 0.95, hgt));
    if (dens <= 0.001) return col;
    float lit = clamp((n - n2) * 5.0 + 0.55, 0.0, 1.0);
    float sunNear = exp(-distance(p, gSun) * 2.2);

    float wDay = smoothstep(0.9, 2.6, e);
    float wSet = 1.0 - smoothstep(-0.1, 0.7, e);
    float wDusk = 1.0 - smoothstep(-0.75, -0.15, e);
    float wNight = 1.0 - smoothstep(-1.5, -0.85, e);
    vec3 li = mix(mix(GLOW_COLOUR * 1.1, vec3(1.0, 0.9, 0.75), 0.25 + 0.3 * sunNear), vec3(0.98, 0.98, 1.0), wDay);
    vec3 sh = mix(mix(EVENING_SKY, GLOW_COLOUR, 0.2) * 0.85, vec3(0.62, 0.66, 0.75), wDay);
    li = mix(li, GLOW_COLOUR * vec3(1.05, 0.62, 0.62), wSet);
    sh = mix(sh, EVENING_SKY * vec3(0.55, 0.45, 0.6), wSet);
    li = mix(li, vec3(0.42, 0.25, 0.32), wDusk);
    sh = mix(sh, vec3(0.13, 0.12, 0.2), wDusk);
    li = mix(li, vec3(0.08, 0.09, 0.13), wNight);
    sh = mix(sh, vec3(0.025, 0.03, 0.05), wNight);
    vec3 cc = mix(sh, li, lit);
    cc += GLOW_COLOUR * sunNear * 0.5 * (1.0 - wDay) * (1.0 - wNight) * lit;
    cloudAlpha = dens * 0.92;
    return mix(col, cc, cloudAlpha);
}

// The moon crosses the sky from sunset to sunrise.
vec2 moonPos()
{
    float ss = sunsetHour();
    float len = 24.0 - ss + sunriseHour();
    float f = clamp(mod(clockHour() - ss + 24.0, 24.0) / len, 0.0, 1.0);
    return vec2(mix(0.16, 0.84, f) * gWs.x, gYH + (0.42 + 0.38 * sin(PI * f)) * (gWs.y - gYH));
}

// Stars and the moon by night.
vec3 nightSky(vec2 p, vec3 col)
{
    float nk = 1.0 - smoothstep(-1.3, -0.5, gDc.w);
    if (nk <= 0.0 || p.y < gYH) return col;
    float clear = (1.0 - cloudAlpha) * smoothstep(0.0, 0.08, (p.y - gYH) / gWs.y);

    vec2 g = p * 70.0;
    vec2 id = floor(g);
    float h = hash12(id);
    if (h > 0.93) {
        vec2 sp = id + 0.2 + 0.6 * vec2(hash12(id + 3.1), hash12(id + 7.7));
        float d = length(g - sp) / 70.0;
        float b = (h - 0.93) / 0.07;
        float tw = 0.75 + 0.25 * sin(TAU * (gClk * 0.37 + hash12(id + 1.3)) * 3.0);
        col += vec3(0.85, 0.9, 1.0) * b * b * tw * exp(-d * d / (gPx * gPx * 0.8)) * nk * clear;
    }

    // Moon: age from the synodic month since the new moon of 2000-01-06.
    float yr = iDate.x;
    float mo = iDate.y;
    float dy = iDate.z;
    float days = 367.0 * yr - floor(7.0 * (yr + floor((mo + 9.0) / 12.0)) / 4.0) + floor(275.0 * mo / 9.0) + dy - 730530.0;
    float age = fract((days - 6.76 + iDate.w / 86400.0) / 29.53059);
    vec2 mc = moonPos();
    float mr = 0.026;
    vec2 m = (p - mc) / mr;
    float r = length(m);
    float lum = abs(age - 0.5) < 0.47 ? 1.0 : 0.0;
    col += vec3(0.55, 0.6, 0.75) * 0.25 * exp(-r * 0.6) * nk * lum * (0.3 + 0.7 * (1.0 - abs(age - 0.5) * 2.0));
    if (r < 1.05) {
        float s = sqrt(max(1.0 - m.y * m.y, 0.0));
        float c = cos(TAU * age) * s;
        float litM = age < 0.5 ? smoothstep(c - 0.08, c + 0.08, m.x) : 1.0 - smoothstep(-c - 0.08, -c + 0.08, m.x);
        float disc = clamp(0.5 - (r - 1.0) * mr / gPx, 0.0, 1.0);
        float mare = 0.82 + 0.18 * vnoise(m * 2.3 + 4.0);
        vec3 mcol = vec3(0.95, 0.93, 0.85) * mare * litM + vec3(0.04, 0.05, 0.08) * (1.0 - litM);
        col = mix(col, mcol, disc * nk * mix(0.6, 1.0, 1.0 - cloudAlpha));
    }
    return col;
}

// ------------------------------------------------------------- landscape

// Far shore: signed distance (world units) to a hedge with rounded trees in
// clumps and a poplar here and there; q.y is height above the horizon.
float shoreSd(vec2 q)
{
    const float CW = 0.016;
    float d = q.y - (0.0035 + 0.003 * vnoise1(q.x * 45.0) + 0.0015 * vnoise1(q.x * 230.0));
    if (q.y > 0.046 + gPx) return 1.0;
    float c = floor(q.x / CW);
    for (int k = -2; k <= 2; k++) {
        float cell = c + float(k);
        float h1 = hash12(vec2(cell, 41.0));
        float h2 = hash12(vec2(cell, 57.0));
        float h3 = hash12(vec2(cell, 73.0));
        float clump = vnoise1(cell * CW * 3.1 + 7.0);
        if (h1 > 0.25 + clump) continue;
        float cx = (cell + 0.5 + 0.7 * (h2 - 0.5)) * CW;
        if (h3 > 0.965) {
            d = min(d, sdTaper(q, vec2(cx, 0.003), vec2(cx, 0.03 + 0.012 * h1), 0.0042, 0.0004));
            continue;
        }
        float r = 0.009 + 0.011 * h2;
        if (abs(q.x - cx) > 1.3 * r) continue;
        float ht = 0.004 + 0.012 * h3 * (0.4 + clump);
        d = min(d, sdSeg(q, vec2(cx, 0.0), vec2(cx, ht + 0.3 * r)) - 0.0007);
        for (int j = 0; j < 3; j++) {
            float fj = float(j) - 1.0;
            float hj = hash12(vec2(cell, 91.0 + float(j)));
            vec2 lc = vec2(cx + fj * 0.5 * r * (0.8 + 0.4 * hj), ht + r * (0.3 + 0.2 * hj - 0.2 * abs(fj)));
            d = min(d, length(q - lc) - r * (0.5 + 0.2 * hj));
        }
    }
    return d + 0.0009 * (vnoise(q * 1100.0) - 0.5);
}

vec3 landColour(vec3 sky)
{
    float e = gDc.w;
    vec3 dark = mix(vec3(0.12, 0.08, 0.12), vec3(0.17, 0.24, 0.19), smoothstep(0.9, 2.6, e));
    dark = mix(dark, vec3(0.012, 0.014, 0.025), 1.0 - smoothstep(-1.4, -0.5, e));
    return mix(dark, sky, 0.35);
}

// Far shore, water with the sky's reflection and the sun's glitter path.
vec3 landscape(vec2 p, vec3 col)
{
    if (p.y > gYH + 0.05) return col;
    float shore = gYH - 0.003 * gWs.y;
    if (p.y >= shore) {
        float a = cover(shoreSd(vec2(p.x, p.y - gYH)));
        if (a <= 0.0) return col;
        return mix(col, landColour(skyColour(vec2(p.x, gYH + 0.01))), a);
    }
    vec3 land = landColour(skyColour(vec2(p.x, gYH + 0.01)));

    // Water: the sky mirrored about the horizon, rippled, darker.
    float depth = (gYH - p.y) / gYH;
    float rip = 0.6 * vnoise(vec2(p.x * 9.0, p.y * 160.0 + wave(240.0, 0.0) * 0.6)) - 0.3;
    float my = 2.0 * gYH - p.y + rip * 0.012 * depth;
    vec3 refl = skyColour(vec2(p.x + rip * 0.004, my));
    float treeR = smoothstep(-0.003, 0.002, shoreSd(vec2(p.x + rip * 0.003, my - gYH)));
    refl = mix(land * 0.8, refl, treeR);
    vec3 w = refl * mix(vec3(0.78, 0.8, 0.86), vec3(0.55, 0.6, 0.7), depth);
    // Glitter: broken streaks below the sun while it is up.
    float e = gDc.w;
    float sunUp = smoothstep(-0.2, 0.2, e) * (1.0 - smoothstep(1.5, 3.0, e));
    float path = exp(-abs(p.x - gSun.x) / (0.012 + 0.09 * depth));
    float sp = vnoise(vec2(p.x * 140.0, p.y * 900.0 + wave(600.0, 1.0) * 1.5));
    w += mix(GLOW_COLOUR, vec3(1.0, 0.9, 0.7), 0.5) * path * smoothstep(0.55, 0.85, sp) * sunUp * 0.9;
    // Shoreline band.
    w = mix(w, land * 0.7, smoothstep(gYH - 0.006 * gWs.y, gYH - 0.002 * gWs.y, p.y));
    return w;
}

// Reed bed: three layers of stems with plumes, swaying in the wind.
vec3 reeds(vec2 p, vec3 col)
{
    float top = REED_TOP * gWs.y;
    if (p.y > top + 0.05) return col;
    float e = gDc.w;
    float day = smoothstep(0.9, 2.6, e);
    float night = 1.0 - smoothstep(-1.4, -0.5, e);
    float backlit = smoothstep(-0.6, 0.0, e) * (1.0 - day);
    vec3 stemC = mix(vec3(0.075, 0.05, 0.04), vec3(0.46, 0.38, 0.22), day);
    stemC = mix(stemC, vec3(0.012, 0.012, 0.02), night);
    vec3 plumeC = mix(vec3(0.16, 0.10, 0.07), vec3(0.58, 0.48, 0.36), day);
    plumeC = mix(plumeC, vec3(0.02, 0.02, 0.03), night);
    vec3 rimC = mix(GLOW_COLOUR, vec3(1.0, 0.85, 0.6), 0.3);

    for (int L = 0; L < 3; L++) {
        float fl = float(L);
        float cw = 0.0065 + 0.004 * fl;
        float hBase = top * (0.62 + 0.22 * fl);
        vec3 shade = mix(mix(col, stemC, 0.55), stemC, fl * 0.5);
        float cx = floor(p.x / cw);
        for (int k = -1; k <= 1; k++) {
            float c = cx + float(k);
            float h1 = hash12(vec2(c, 11.0 + fl * 7.0));
            float h2 = hash12(vec2(c, 23.0 + fl * 5.0));
            float x0 = (c + 0.15 + 0.7 * h1) * cw;
            float hgt = hBase * (0.7 + 0.5 * h2);
            if (p.y > hgt + 0.03) continue;
            float sway = 0.10 * wave(516.0, x0 * 3.0) + 0.05 * wave(1203.0, x0 * 7.0 + h2 * 4.0) + 0.12 * (h1 - 0.5);
            float bend = sway * hgt * 0.35;
            float t = clamp(p.y / hgt, 0.0, 1.0);
            float sx = x0 + bend * t * t;
            float hw = (0.0011 + 0.0006 * fl) * (1.0 - 0.55 * t);
            float d = abs(p.x - sx) - hw;
            d = p.y > hgt ? length(vec2(p.x - (x0 + bend), p.y - hgt)) - hw : d;
            float a = clamp(0.5 - d / gPx, 0.0, 1.0) * step(-0.01, p.y);
            col = mix(col, shade * mix(0.55 + 0.25 * fl * (1.0 - day), 1.0, mix(1.0, t, day)), a);
            // Leaf: a long blade off the stem, arching outward.
            float lh = hgt * (0.25 + 0.3 * h1);
            float ls = h2 < 0.5 ? -1.0 : 1.0;
            vec2 lb = vec2(x0 + bend * (lh / hgt) * (lh / hgt), lh);
            vec2 lm = lb + vec2(ls * 0.011 + bend * 0.2, 0.014 + 0.012 * h2);
            vec2 lt = lm + vec2(ls * 0.012 + bend * 0.3, -0.004 - 0.006 * h1);
            float lw = 0.0011 + 0.0004 * fl;
            float dl = min(sdTaper(p, lb, lm, lw * 0.6, lw), sdTaper(p, lm, lt, lw, 0.0001));
            col = mix(col, shade, cover(dl) * 0.95);
            // Plume: a drooping feathery head.
            vec2 tip = vec2(x0 + bend, hgt);
            vec2 dir = normalize(vec2(bend * 2.0 / hgt + 0.25 * sign(bend + 1e-4) * (0.4 + h1), 1.0));
            vec2 q = p - tip - dir * 0.009 * (0.8 + 0.4 * fl);
            vec2 ql = vec2(dot(q, vec2(dir.y, -dir.x)), dot(q, dir));
            float fe = 0.75 + 0.25 * sin(ql.y * 900.0 + c * 3.0) * sin(ql.x * 2000.0 + c);
            float dp = sdEll(ql, vec2(0.0026 + 0.0012 * fl, 0.011 + 0.003 * fl) * vec2(fe, 1.0));
            float pa = cover(dp) * (0.75 + 0.2 * vnoise(vec2(ql.x * 1500.0, ql.y * 500.0) + c));
            vec3 pc = mix(mix(col, plumeC, 0.6), plumeC, fl * 0.5);
            pc += rimC * backlit * 0.55 * smoothstep(-0.004, 0.0, dp) * (0.6 + 0.4 * h2);
            col = mix(col, pc, pa);
        }
    }
    // Dense base of the bed: tangled stems, darker toward the ground.
    float base = top * (0.38 + 0.12 * vnoise1(p.x * 60.0) + 0.06 * vnoise1(p.x * 210.0));
    float tex = 0.75 + 0.25 * vnoise(vec2(p.x * 900.0, p.y * 140.0)) * vnoise(vec2(p.x * 300.0, p.y * 40.0));
    vec3 bc = stemC * mix(0.4, 0.85, clamp(p.y / max(base, 1e-3), 0.0, 1.0)) * mix(1.0, tex, day);
    col = mix(col, bc, clamp(0.5 - (p.y - base) / (gPx * 2.0), 0.0, 1.0));
    return col;
}

// ------------------------------------------------------------- birds

vec3 birdTone()
{
    float e = gDc.w;
    vec3 c = mix(vec3(0.035, 0.028, 0.04), vec3(0.075, 0.075, 0.095), smoothstep(0.9, 2.6, e));
    return mix(c, vec3(0.01, 0.01, 0.015), 1.0 - smoothstep(-1.4, -0.5, e));
}

// Flying starling seen from the side: body, triangular wings, short tail.
// c centre, v velocity, bank roll (rad), ph wing phase (cycles), amp
// flap amplitude 0 glide .. 1, span wingspan (world), sweep wingtip lag
// (spans), tail length (half spans). Returns the signed distance to the
// silhouette.
float flyerDist(vec2 p, vec3 c, vec3 v, float bank, float ph, float amp, float span, float sweep, float tail)
{
    float sp = length(v);
    vec3 f = sp > 1e-5 ? v / sp : vec3(1.0, 0.0, 0.0);
    vec3 up0 = vec3(0.0, 1.0, 0.0) - f * f.y;
    up0 = dot(up0, up0) < 1e-4 ? vec3(0.0, 0.0, 1.0) : normalize(up0);
    vec3 side0 = cross(f, up0);
    vec3 up = up0 * cos(bank) + side0 * sin(bank);
    vec3 sd = cross(f, up);
    float th = amp * 0.95 * sin(TAU * ph) + 0.12;
    float L = 0.5 * span;
    vec3 wing = sd * cos(th) + up * sin(th);
    vec3 rootF = c + f * 0.20 * L;
    vec3 rootB = c - f * 0.24 * L;
    vec3 tipR = c + wing * 0.5 * span - f * sweep * span;
    vec3 tipL = c - sd * cos(th) * 0.5 * span + up * sin(th) * 0.5 * span - f * sweep * span;
    vec3 midR = c + wing * 0.27 * span - f * 0.02 * span;
    vec3 midL = c - sd * cos(th) * 0.27 * span + up * sin(th) * 0.27 * span - f * 0.02 * span;
    float d = sdTaper(p, (c - f * 0.5 * L).xy, (c + f * 0.55 * L).xy, 0.075 * span, 0.05 * span);
    d = min(d, sdTri(p, rootF.xy, rootB.xy, midR.xy));
    d = min(d, sdTri(p, midR.xy - (f * 0.06 * span).xy, rootB.xy, tipR.xy));
    d = min(d, sdTri(p, rootF.xy, rootB.xy, midL.xy));
    d = min(d, sdTri(p, midL.xy - (f * 0.06 * span).xy, rootB.xy, tipL.xy));
    vec3 tb = c - f * 0.45 * L;
    d = min(d, sdTri(p, tb.xy, (tb - f * tail * L + sd * 0.07 * span).xy, (tb - f * tail * L - sd * 0.07 * span).xy));
    return d;
}

// Flap amplitude: flapping bouts and glides, steady flapping when alarmed,
// climbing or landing.
float flapAmp(int id, vec3 v, float exc, int mode)
{
    float h = hashf(uint(id) * 7u + 3u);
    float g = sin(TAU * (gClk * 0.37 + h)) + 0.6 * sin(TAU * (gClk * 0.83 + h * 3.1));
    float amp = smoothstep(-0.7, 0.0, g);
    amp = max(amp, exc);
    amp = max(amp, clamp(v.y / max(length(v), 1e-4) * 3.0, 0.0, 1.0));
    if (mode == M_LAND) amp = 1.0;
    return amp;
}

// Perched starling in profile; q in units of perchLen() with the feet at
// the origin, facing +x. tAct and tLeft: seconds into and left of the
// current action. Returns colour and coverage.
vec4 perchedBird(vec2 q, float px, int act, float tAct, float tLeft, float sleep, float hop, vec2 lightDir)
{
    float env = smoothstep(0.0, 0.25, tAct) * smoothstep(0.0, 0.25, tLeft);
    float preen = act == ACT_PREEN ? env * (0.8 + 0.2 * sin(tAct * 9.0)) : 0.0;
    float look = act == ACT_LOOK ? env : 0.0;
    preen *= 1.0 - sleep;
    look *= 1.0 - sleep;

    vec2 bc = mix(vec2(-0.02, 0.40), vec2(-0.02, 0.37), sleep);
    vec2 br = mix(vec2(0.31, 0.185), vec2(0.30, 0.25), sleep);
    float ba = mix(0.62, 0.32, sleep);
    vec2 qb = rot(q - bc, -ba);
    float body = sdEll(qb, br);
    vec2 hc = mix(vec2(0.17, 0.665), vec2(0.11, 0.56), sleep);
    hc = mix(hc, vec2(-0.05, 0.58), preen);
    float head = length(q - hc) - mix(0.13, 0.12, sleep);
    float d = smin(body, head, 0.07);
    vec2 bdir = normalize(mix(mix(vec2(0.96, -0.24), vec2(-0.97, -0.12), look), vec2(-0.55, -0.8), preen));
    float beakLen = mix(0.30, 0.12, sleep);
    vec2 b0 = hc + bdir * 0.08;
    vec2 b1 = hc + bdir * beakLen;
    float beak = sdTaper(q, b0, b1, 0.036, 0.006);
    float tail = sdTaper(q, vec2(-0.17, 0.25), vec2(-0.40, -0.03), 0.065, 0.05);
    float legLen = mix(0.2, 0.12, hop);
    float leg = min(sdSeg(q, vec2(0.0, 0.21), vec2(-0.01, 0.21 - legLen)), sdSeg(q, vec2(0.07, 0.21), vec2(0.08, 0.21 - legLen))) - 0.018;
    float sil = min(min(d, tail), leg);
    sil = sleep > 0.5 ? sil : min(sil, beak);
    float a = clamp(0.5 - sil / px, 0.0, 1.0);
    if (a <= 0.0) return vec4(0.0);

    // Plumage: glossy black with a purple and green sheen, buff-edged
    // wing feathers, lit by the sky above and rimmed by the sun.
    float e = gDc.w;
    float day = smoothstep(0.9, 2.6, e);
    float night = 1.0 - smoothstep(-1.4, -0.5, e);
    vec3 base = mix(vec3(0.04, 0.035, 0.045), vec3(0.06, 0.055, 0.065), day);
    float sheenT = smoothstep(0.35, 0.65, q.y + 0.08 * sin(q.x * 18.0));
    vec3 sheen = mix(vec3(0.20, 0.07, 0.26), vec3(0.06, 0.22, 0.12), sheenT);
    vec2 n = normalize(qb / br + 1e-4);
    n = rot(n, ba);
    float skyL = clamp(0.5 + 0.5 * n.y, 0.0, 1.0);
    vec3 col = base + sheen * (0.25 + 0.55 * day) * skyL * (1.0 - night * 0.8);
    col += skyL * 0.12 * (1.0 - night * 0.7);
    vec2 wc = rot(q - vec2(-0.09, 0.39), -ba);
    float wingD = sdEll(wc, vec2(0.25, 0.115) * mix(1.0, 0.9, sleep));
    float feather = 0.5 + 0.5 * sin(wc.x * 70.0);
    col = mix(col, vec3(0.20, 0.15, 0.10) * (0.6 + 0.4 * day) * (1.0 - night * 0.8), smoothstep(0.0, -0.02, wingD) * smoothstep(0.75, 1.0, feather) * 0.6 * (1.0 - sleep * 0.5));
    if (beak < sil + 0.001 && sleep < 0.5) col = mix(vec3(0.85, 0.66, 0.18), vec3(0.25, 0.2, 0.1), night) * (0.55 + 0.45 * skyL);
    if (leg < min(d, tail) && leg < beak) col = vec3(0.42, 0.24, 0.22) * (1.0 - night * 0.8);
    // Eye: a glint, shut in sleep.
    vec2 ec = hc + vec2(mix(0.05, -0.05, look), 0.025);
    col += vec3(0.6) * clamp(0.5 - (length(q - ec) - 0.022) / px, 0.0, 1.0) * (1.0 - sleep) * (1.0 - preen) * (1.0 - night * 0.6);
    // Rim light from the sun or the moon.
    vec2 gn = normalize(vec2(sil - min(min(sdEll(rot(q + vec2(0.01, 0.0) - bc, -ba), br), length(q + vec2(0.01, 0.0) - hc) - 0.13), tail),
                             sil - min(min(sdEll(rot(q + vec2(0.0, 0.01) - bc, -ba), br), length(q + vec2(0.0, 0.01) - hc) - 0.13), tail)) + 1e-5);
    float rim = smoothstep(-0.07, -0.01, sil) * max(dot(gn, lightDir), 0.0);
    vec3 rimC = mix(mix(GLOW_COLOUR * 1.2, vec3(1.0, 0.95, 0.85), day), vec3(0.35, 0.42, 0.6), night);
    col += rimC * rim * mix(0.9, 0.5, day);
    return vec4(col, a);
}

// A bird of Buffer A drawn at world point p over col.
vec3 drawBird(vec2 p, int id, vec4 s0, vec3 col, vec3 bg)
{
    int mode = modeOf(s0.w);
    vec4 s3 = texelFetch(iChannel0, birdTexel(id, 3), 0);
    float phi = alarmOf(s0.w);
    float exc = phi > 0.0 && phi < ALARM_EXC ? sin(PI * phi / ALARM_EXC) : 0.0;
    if (mode == M_PERCH) {
        float pl = perchLen();
        float face = sign(s3.w);
        int act = int(abs(s3.w) + 0.5) - 1;
        vec2 q = (p - s0.xy) / pl;
        q.x *= face;
        if (dot(q - vec2(0.0, 0.45), q - vec2(0.0, 0.45)) > 0.5) return col;
        vec4 s4 = texelFetch(iChannel0, birdTexel(id, 4), 0);
        float hop = clamp((s0.y - s4.y) / (0.3 * pl), 0.0, 1.0);
        if (act == ACT_SWAP && s0.y - s4.y > 0.15 * pl) {
            // Fluttering over a neighbour: wings out.
            vec3 c = vec3(s0.xy + vec2(0.0, 0.42 * pl), 0.0);
            vec3 v = vec3(face, 0.25 * sign(s4.x + s4.z - s0.x + 1e-6), 0.0);
            float d = flyerDist(p, c, v, 1.1, fract(gClk * 9.0 + float(id) * 0.37), 1.0, flySpan() * 0.8, 0.1, 0.3);
            return mix(col, birdTone(), cover(d));
        }
        vec2 toL = gSun - s0.xy;
        if (gDc.w < -0.5) toL = moonPos() - s0.xy;
        vec2 ld = normalize(toL + 1e-5);
        ld.x *= face;
        float sleep = smoothstep(0.4, 0.6, gDc.z);
        vec4 b = perchedBird(q, gPx / pl, act, s4.w - s3.y, s3.y, sleep, hop, ld);
        return mix(col, b.rgb, b.a);
    }
    vec4 s1 = texelFetch(iChannel0, birdTexel(id, 1), 0);
    float sc = depthScale(s0.z);
    float span = flySpan() * sc;
    if (distance(p, s0.xy) > 0.6 * span + gPx) return col;
    float amp = flapAmp(id, s1.xyz, exc, mode);
    float d = flyerDist(p, s0.xyz, s1.xyz, s3.z, s1.w, amp, span, 0.16, 0.3);
    float a = cover(d);
    if (a <= 0.0) return col;
    float hz = clamp(AERIAL * s0.z, 0.0, 0.6) * mix(1.0, 1.25, smoothstep(0.9, 2.6, gDc.w));
    vec3 bc = mix(birdTone(), bg, hz);
    bc = mix(bc, mix(GLOW_COLOUR, vec3(1.0), 0.4) * 0.55, 0.3 * exc * (1.0 - gDc.z));
    return mix(col, bc, a);
}

// The stooping falcon: wings tucked in the dive, half open through the
// swoop, beating in the climb.
vec3 falcon(vec2 p, vec3 col)
{
    vec4 st = texelFetch(iChannel0, ivec2(1, 0), 0);
    if (st.z < 0.0 || st.z >= STOOP_TIME) return col;
    float t = st.z;
    vec2 prey = texelFetch(iChannel0, ivec2(4, 0), 0).xy;
    vec2 fp = stoopPos(t, st.xy, prey, st.w, gWs);
    float span = flySpan() * 1.45;
    if (distance(p, fp) > 0.9 * span + 0.06) return col;
    vec2 fv = (stoopPos(t + 0.02, st.xy, prey, st.w, gWs) - fp) / 0.02;
    float open = smoothstep(0.6, 1.0, t);
    float beat = smoothstep(1.45, 1.75, t);
    float bank = mix(0.15, 1.0, open) * st.w * (1.0 - 0.4 * beat);
    float d = flyerDist(p, vec3(fp, 0.0), vec3(fv, 0.0), bank, t * 3.2, beat, span * mix(0.5, 1.0, open), mix(0.5, 0.17, open), 0.75);
    // Speed blur along the dive.
    float tr = sdTaper(p, fp, fp - fv * 0.06, 0.07 * span, 0.0);
    float ta = cover(tr) * 0.3 * (1.0 - open);
    vec3 fc = birdTone() * 0.7;
    col = mix(col, fc, ta);
    return mix(col, fc, cover(d));
}

vec3 wallpaper(vec2 fc)
{
    vec2 uv = fc / iResolution.xy;
    vec2 texRes = iChannelResolution[1].xy;
    float sa = iResolution.x / iResolution.y;
    float ta = texRes.x / texRes.y;
    vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
    return texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float U = unitPx();
    vec2 p = fragCoord / U;
    gPx = 1.0 / U;
    gWs = worldSize();
    gDc = dayCycle();
    gYH = HORIZON * gWs.y;
    gClk = texelFetch(iChannel0, ivec2(0, 0), 0).y;
    float h = clockHour();
    gMorning = hoursFrom(h, 0.5 * (sunriseHour() + sunsetHour())) < 0.0;
    gSun = vec2((gMorning ? 0.26 : 0.74) * gWs.x, gYH + 0.27 * gDc.w * gWs.y);

    bool wp = iChannelResolution[1].x > 0.0;
    vec3 col;
    if (wp) {
        col = wallpaper(fragCoord);
        cloudAlpha = 0.0;
    } else {
        col = skyColour(p);
        // Sun disc, flattened and reddened at the horizon, brighter at the centre.
        float e = gDc.w;
        if (e > -0.3) {
            vec2 dq = p - gSun;
            dq.y *= mix(1.25, 1.0, smoothstep(0.0, 0.5, e));
            float r = length(dq) / 0.03;
            vec3 sc = mix(vec3(1.0, 0.62, 0.32), vec3(1.0, 0.97, 0.88), smoothstep(0.0, 1.4, e));
            sc = mix(sc, vec3(1.0, 0.99, 0.95), 0.55 * (1.0 - r * r));
            col = mix(col, sc, clamp(0.5 - (r - 1.0) * 0.03 / gPx, 0.0, 1.0));
        }
        col = clouds(p, col);
        col = nightSky(p, col);
        col = landscape(p, col);
    }
    vec3 bg = col;

    // Birds near this pixel, from Buffer B, far ones first.
    vec2 gres = iChannelResolution[2].xy;
    int ids[4];
    vec4 sts[4];
    int n = 0;
    if (gres.x >= 1.0) {
        ivec2 gc = clamp(ivec2(p * min(gres.x, gres.y)), ivec2(0), ivec2(gres) - 1);
        ivec4 l = ivec4(texelFetch(iChannel2, gc, 0) + 0.5) - 1;
        for (int k = 0; k < 4; k++) {
            int id = l[k];
            if (id < 0) continue;
            vec4 s0 = texelFetch(iChannel0, birdTexel(id, 0), 0);
            int m = modeOf(s0.w);
            if (m == M_NONE || m == M_HIDDEN) continue;
            if (distance(p, birdCentre(s0)) > birdReach(s0) * 1.15 + gPx) continue;
            ids[n] = id;
            sts[n] = s0;
            n++;
        }
    }
    for (int a = 0; a < 3; a++) {
        for (int b = 0; b < 3 - a; b++) {
            if (b + 1 < n && sts[b].z < sts[b + 1].z) {
                vec4 ts = sts[b];
                sts[b] = sts[b + 1];
                sts[b + 1] = ts;
                int ti = ids[b];
                ids[b] = ids[b + 1];
                ids[b + 1] = ti;
            }
        }
    }

    // Unresolved birds: a haze where the flock is dense, darker where the
    // alarm wave passes. x is birds per wingspan squared.
    if (iChannelResolution[3].x >= 1.0) {
        vec2 dn = texture(iChannel3, fragCoord / iResolution.xy).xy;
        float Ug = min(iChannelResolution[3].x, iChannelResolution[3].y);
        float sf = flySpan() * depthScale(Z_FLOCK);
        float x = dn.x * Ug * Ug * sf * sf;
        float exm = dn.y / max(dn.x, 1e-4);
        float ha = 1.0 - exp(-HAZE * max(x - HAZE_MIN, 0.0) * (1.0 + 0.9 * exm));
        float hz = clamp(AERIAL * Z_FLOCK, 0.0, 0.6);
        col = mix(col, mix(birdTone(), bg, hz), ha * 0.78);
    }

    for (int k = 0; k < 4; k++) {
        if (k >= n) break;
        if (sts[k].z < 0.6) continue;
        col = drawBird(p, ids[k], sts[k], col, bg);
    }
    col = falcon(p, col);
    if (!wp) col = reeds(p, col);
    for (int k = 0; k < 4; k++) {
        if (k >= n) break;
        if (sts[k].z >= 0.6) continue;
        col = drawBird(p, ids[k], sts[k], col, bg);
    }

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
