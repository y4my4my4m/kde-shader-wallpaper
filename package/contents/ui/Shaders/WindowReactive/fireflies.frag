// Fireflies — a summer meadow at dusk, full of fireflies.
// @channels bufferA, tex1, bufferB, bufferC
// @sim-max-height 90
//
// Hundreds of fireflies drift over a meadow in three depth layers: tiny
// ones far off over the grass, the main swarm, and big out-of-focus ones
// close to the eye. Each blinks to its own rhythm, but neighbours pull one
// another into step, so the swarm falls into waves of flashes rippling
// across the meadow, then slowly drifts apart again. Every flash lights the
// grass, the mist and the pond around it.
//
// Rest or slowly move the cursor on bare desktop and it becomes a lantern:
// curious fireflies drift over and circle it. Sweep it fast and they
// scatter, flashing in alarm. Click bare desktop to open a jar: a burst of
// fireflies spirals out and joins the swarm for a while. Fireflies keep out
// of windows; some perch on window edges, pulsing, until they take off
// again or a fast drag shakes them off.
//
// By the local clock the meadow lies in soft daylight by day, with
// butterflies and drifting dandelion seeds; the fireflies come out as the
// sun sets and leave at dawn.
//
// iChannel0  Buffer A: firefly records and globals.
// iChannel1  Wallpaper ("Image 2" in the settings) as the sky behind the
//            meadow, graded to the time of day. Without one a sky with a
//            moon, stars and a few clouds is drawn.
// iChannel2  Buffer B: firefly bins.
// iChannel3  Buffer C: flash light and phase fields.
//
// Lengths are in H units (fractions of the screen height), y up. The
// swarm size, synchronisation, glow size and lantern pull change the
// simulation and are shared with the buffers.

const int   FIREFLIES   = 400;   // @range(60, 800, 10) @label("Fireflies") @shared
const float SYNC        = 1.0;   // @range(0.0, 2.0, 0.05) @label("Synchronisation") @shared
const float GLOW_SIZE   = 1.0;   // @range(0.5, 2.0, 0.05) @label("Glow size") @shared
const float LANTERN     = 1.0;   // @range(0.0, 2.0, 0.05) @label("Lantern pull") @shared
const vec3  GLOW_COLOUR = vec3(0.80, 1.00, 0.32); // @color @label("Glow colour")
const float BRIGHTNESS  = 1.0;   // @range(0.3, 2.5, 0.05) @label("Glow brightness")
const bool  FORCE_NIGHT = false; // @label("Always night")
const float GRASS       = 1.0;   // @range(0.0, 2.0, 0.05) @label("Grass")
const float WIND        = 1.0;   // @range(0.0, 3.0, 0.05) @label("Wind")
const float MIST        = 1.0;   // @range(0.0, 2.0, 0.05) @label("Mist")
const bool  POND        = true;  // @label("Pond")
const bool  TREE        = true;  // @label("Tree")

const float HORIZON = 0.30;   // H
const float BANK_Y  = 0.115;  // H, near edge of the meadow; the pond lies below

float gT;         // s, clock of Buffer A (wraps at CLOCK_WRAP)
float gDay;       // 0 night .. 1 day
float gGold;      // sunset and sunrise warmth, 0..1
float gFlyVis;    // firefly visibility, 0 by day
float gPx;        // H per pixel
float gAspect;    // image width / height
float gKx;        // buffer x per image x (1 unless the grid aspect differs)
int   gBinCols;
vec2  gBinRes;    // texel size of the buffers
vec3  gGlow;
vec2  gMoon;
vec2  gSun;

// ------------------------------------------------------------- utilities

vec4 hash4(float a, float b)
{
    uint h = hashu(uint(int(a) + 65536) * 0x9E3779B9u ^ hashu(uint(int(b) + 4096) + 0x7F4A7C15u));
    uint h2 = hashu(h + 1u);
    return vec4(float(h & 0xFFFFu), float(h >> 16), float(h2 & 0xFFFFu), float(h2 >> 16)) * (1.0 / 65535.0);
}

float vnoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), w.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), w.x), w.y);
}

// Value noise periodic in x with the given integer period.
float vnoiseP(vec2 p, float period)
{
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 w = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, period);
    float x1 = mod(i.x + 1.0, period);
    return mix(mix(hash12(vec2(x0, i.y)), hash12(vec2(x1, i.y)), w.x),
               mix(hash12(vec2(x0, i.y + 1.0)), hash12(vec2(x1, i.y + 1.0)), w.x), w.y);
}

float noise1(float x)
{
    float i = floor(x);
    float f = x - i;
    return mix(hash12(vec2(i, 3.7)), hash12(vec2(i + 1.0, 3.7)), f * f * (3.0 - 2.0 * f));
}

// Phase (rad) of an oscillation close to hz, exactly periodic over CLOCK_WRAP.
float osc(float hz) { return TAU * fract(floor(hz * CLOCK_WRAP + 0.5) * (gT / CLOCK_WRAP)); }

// Distance travelled at speed v (H/s) wrapped to a whole number of noise
// periods (scale * v * CLOCK_WRAP rounded), for x-periodic noise.
float drift(float v, float scale, out float period)
{
    period = max(floor(abs(v) * scale * CLOCK_WRAP + 0.5), 1.0);
    return sign(v) * period * (gT / CLOCK_WRAP);
}

float sdSeg(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float smin(float a, float b, float k)
{
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float cover(float sd) { return clamp(0.5 - sd / gPx, 0.0, 1.0); }

// Colour by time of day.
vec3 tod(vec3 night, vec3 gold, vec3 day) { return mix(mix(night, day, gDay), gold, gGold); }

// Horizontal sway at x, about -1..1, gusts travelling with the wind.
float windAt(float x)
{
    return WIND * (0.55 * sin(1.3 * x - osc(0.11)) + 0.3 * sin(3.7 * x - osc(0.23) + 1.3)
                   + 0.15 * sin(9.1 * x - osc(0.53) + 4.0));
}

// ------------------------------------------------------------- fields

vec2 toBuffer(vec2 p) { return vec2(p.x * gKx, p.y); }

// Flash light around p, 0..1: Buffer C x through a soft saturation.
float bloomAt(vec2 p)
{
    vec2 g = clamp(toBuffer(p) * BINS_PER_H, vec2(0.5), vec2(float(gBinCols), BINS_PER_H) - 0.5);
    return 1.0 - exp(-0.4 * BRIGHTNESS * texture(iChannel3, g / gBinRes).x);
}

// ------------------------------------------------------------- sky

vec3 skyGradient(float y)
{
    float s = clamp((y - HORIZON) / (1.0 - HORIZON), 0.0, 1.0);
    vec3 night = mix(vec3(0.26, 0.16, 0.32), vec3(0.095, 0.078, 0.215), smoothstep(0.0, 0.4, s));
    night = mix(night, vec3(0.028, 0.033, 0.10), smoothstep(0.35, 1.0, s));
    night = mix(vec3(0.42, 0.24, 0.32), night, smoothstep(0.0, 0.14, s));
    vec3 gold = mix(vec3(1.0, 0.66, 0.38), vec3(0.86, 0.48, 0.45), smoothstep(0.0, 0.25, s));
    gold = mix(gold, vec3(0.30, 0.28, 0.52), smoothstep(0.2, 1.0, s));
    vec3 day = mix(vec3(0.86, 0.90, 0.90), vec3(0.62, 0.77, 0.93), smoothstep(0.0, 0.35, s));
    day = mix(day, vec3(0.33, 0.55, 0.88), smoothstep(0.3, 1.0, s));
    return tod(night, gold, day);
}

vec3 sky(vec2 p)
{
    vec3 col = skyGradient(p.y);
    float night = (1.0 - gDay) * (1.0 - 0.7 * gGold);

    // Clouds: thin wisps drifting east.
    if (p.y > 0.42) {
        float per;
        float off = drift(0.004, 2.0, per);
        vec2 q = vec2(p.x * 2.0 - off, p.y * 11.0);
        float n = 0.65 * vnoiseP(q, per) + 0.35 * vnoiseP(q * vec2(2.0, 2.3) + vec2(0.0, 5.1), 2.0 * per);
        float c = smoothstep(0.55, 0.85, n) * smoothstep(0.42, 0.6, p.y) * (1.0 - smoothstep(0.85, 1.0, p.y));
        vec3 cc = tod(vec3(0.20, 0.17, 0.34), vec3(1.0, 0.62, 0.55), vec3(0.97, 0.97, 0.98));
        col = mix(col, cc, c * tod(vec3(0.55), vec3(0.6), vec3(0.75)));
    }

    // Stars, more of them higher up.
    if (night > 0.01) {
        vec2 cs = p / 0.022;
        vec2 ci = floor(cs);
        vec4 h = hash4(ci.x, ci.y + 300.0);
        float density = smoothstep(0.36, 0.75, p.y);
        if (h.x < 0.32 * density) {
            vec2 sp = (ci + 0.2 + 0.6 * h.yz) * 0.022;
            float r = distance(p, sp);
            float b = pow(h.w, 3.0) * 0.9 + 0.1;
            float tw = 0.65 + 0.35 * sin(osc(0.3 + 1.7 * h.y) + TAU * h.z);
            float pr = max(0.0007, 0.8 * gPx);
            col += vec3(0.85, 0.88, 1.0) * b * tw * night * exp(-r * r / (pr * pr));
        }
    }

    // Moon with a soft halo.
    if (night > 0.01) {
        vec2 d = p - gMoon;
        float r = length(d);
        float mr = 0.03;
        col += vec3(0.55, 0.55, 0.75) * night * (0.10 * exp(-r / 0.09) + 0.05 * exp(-r / 0.3));
        if (r < mr + gPx) {
            float m = 0.82 + 0.18 * vnoise(d * 140.0 + 3.0) - 0.12 * smoothstep(0.35, 0.7, vnoise(d * 45.0));
            vec3 mc = vec3(1.0, 0.97, 0.88) * m;
            // Crescent: the dark part is a larger offset disc, lit faintly by earthshine.
            float lit = smoothstep(-0.004, 0.004, length(d - vec2(-0.022, 0.006)) - 0.037);
            mc = mix(mc * 0.08 + col * 0.6, mc, lit);
            col = mix(col, mc, cover(r - mr) * night);
        }
    }

    // Sun.
    if (gDay > 0.01) {
        float r = distance(p, gSun);
        float a = clamp(gDay * 1.5, 0.0, 1.0);
        vec3 sc = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.97, 0.88), smoothstep(0.4, 1.0, gDay));
        col += sc * a * (0.35 * exp(-r / 0.05) + 0.2 * exp(-r / 0.25));
        col = mix(col, vec3(1.0, 0.98, 0.92), cover(r - 0.032) * a);
    }
    return col;
}

// The wallpaper behind the meadow, cover-fitted and graded to the time of day.
vec3 wallpaper(vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;
    vec2 texRes = iChannelResolution[1].xy;
    float sa = iResolution.x / iResolution.y;
    float ta = texRes.x / texRes.y;
    vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
    vec3 c = texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
    float lum = dot(c, vec3(0.3, 0.55, 0.15));
    vec3 night = mix(vec3(lum), c, 0.5) * vec3(0.24, 0.22, 0.40) + vec3(0.02, 0.015, 0.05);
    vec3 gold = c * vec3(1.05, 0.78, 0.62);
    return tod(night, gold, c);
}

// Distant tree line along the horizon, height (H) at x.
float treeline(float x)
{
    float h = HORIZON + 0.008 + 0.014 * noise1(x * 2.2) + 0.005 * noise1(x * 9.0);
    float cw = 0.045;
    float c = floor(x / cw);
    for (int k = -1; k <= 1; k++) {
        float cc = c + float(k);
        vec4 r = hash4(cc, 77.0);
        if (r.x < 0.4) continue;
        float cx = (cc + 0.5 + 0.4 * (r.y - 0.5)) * cw;
        float w = 0.014 + 0.02 * r.z;
        float dx = (x - cx) / w;
        if (abs(dx) < 1.0) {
            // A crown of three rounded lobes with a ragged top.
            float ht = 0.012 + 0.03 * r.w;
            float l0 = sqrt(max(1.0 - 1.6 * dx * dx, 0.0));
            float l1 = 0.8 * sqrt(max(1.0 - 4.0 * (dx + 0.45) * (dx + 0.45), 0.0));
            float l2 = 0.85 * sqrt(max(1.0 - 4.0 * (dx - 0.45) * (dx - 0.45), 0.0));
            float shape = max(l0, max(l1, l2));
            float rag = 0.003 * (noise1(x * 260.0 + cc) - 0.5) + 0.004 * (noise1(x * 90.0 + cc * 3.0) - 0.5);
            if (shape > 0.0) h = max(h, HORIZON + 0.004 + ht * shape + rag * shape);
        }
    }
    return h;
}

// ------------------------------------------------------------- grass

// Grass layer silhouette: ground below a wavy base line, blades rising from
// it; tufted layers fan several blades from one root, and some roots carry
// a tall stalk with a seed head. Returns the signed distance (H, negative
// inside) and the height fraction of the blade nearest the edge (0 on the
// ground).
vec2 grass(vec2 p, float base, float spacing, int blades, bool tuft, int cells,
           float hMin, float hMax, float width, float stalks, float seed, float frame)
{
    float g = base + 0.007 * sin(p.x * 2.3 + seed) + 0.004 * sin(p.x * 6.1 + seed * 1.7);
    float sd = p.y - g;
    float tip = 0.0;
    float top = max(hMax, stalks > 0.0 ? 1.3 * hMax : 0.0) * GRASS;
    if (GRASS <= 0.0 || p.y > g + top + 0.005 || p.y < g) return vec2(sd, 0.0);
    float cell = floor(p.x / spacing);
    float maxLean = (float(cells) - 0.3) * spacing;
    for (int k = -2; k <= 2; k++) {
        if (abs(k) > cells) continue;
        float c = cell + float(k);
        vec4 root = hash4(c, seed);
        float bx0 = (c + 0.2 + 0.6 * root.x) * spacing;
        float sway = windAt(bx0) + 0.35 * WIND;
        for (int j = 0; j < 3; j++) {
            if (j >= blades) break;
            vec4 r = fract(root.yzwx * (37.17 + 13.31 * float(j)) + vec4(0.13, 0.37, 0.71, 0.53) * float(j + 1));
            float bx = tuft ? bx0 : (c + 0.2 + 0.6 * r.x) * spacing;
            bool stalk = j == 0 && root.w < stalks;
            float h = mix(hMin, hMax, r.y * r.y) * GRASS * (stalk ? 1.3 : 1.0);
            // Framing: taller toward the screen edges.
            float e = min(bx, gAspect - bx) / (0.5 * gAspect);
            h *= mix(1.0, 0.55, frame * smoothstep(0.15, 0.7, e));
            float t = (p.y - g) / h;
            if (t >= (stalk ? 1.02 : 1.0)) continue;
            float fan = tuft ? (float(j) - 1.0) * 0.55 + 0.3 * (r.z - 0.5) : (r.z - 0.5) * 0.9;
            if (stalk) fan *= 0.3;
            float lean = clamp((fan + 0.22 * sway) * h * 0.45, -maxLean, maxLean);
            float xc = bx + lean * t * t;
            float slope = 2.0 * lean * t / h;
            float hw = stalk ? 0.0007 : 0.5 * width * (0.6 + 0.8 * r.w) * pow(max(1.0 - t, 0.0), 0.85);
            float d = (abs(p.x - xc) - hw) * inversesqrt(1.0 + slope * slope);
            if (stalk) {
                // Seed head: a slim spindle over the top eighth.
                vec2 a = vec2(bx + lean * 0.77, g + 0.88 * h);
                vec2 b = vec2(bx + lean, g + h);
                vec2 pa = p - a;
                vec2 ba = b - a;
                float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                d = min(d, length(pa - ba * hh) - (0.0008 + 0.1 * width) * sin(PI * (0.15 + 0.85 * hh)));
            }
            if (d < sd) {
                sd = d;
                tip = min(t, 1.0);
            }
        }
    }
    return vec2(sd, tip);
}

// Shade a silhouette layer: base colour, the firefly light it catches
// (strongest along its edges) and lighter, sunlit blade tips by day.
vec3 shadeLayer(vec3 base, vec2 g, float light, float rimW)
{
    float rim = exp(min(g.x, 0.0) / rimW);
    vec3 c = base * (1.0 + gDay * 0.5 * g.y);
    c += gGlow * light * (0.012 + 0.3 * rim) * gFlyVis;
    return c;
}

// ------------------------------------------------------------- tree

// Foliage clusters of the tree: centre xy and radius, local units. A const
// array here crashes the NVIDIA GLSL compiler.
vec3 crown(int k)
{
    if (k == 0) return vec3(0.36, 0.55, 0.075);
    if (k == 1) return vec3(0.26, 0.66, 0.10);
    if (k == 2) return vec3(0.13, 0.74, 0.11);
    if (k == 3) return vec3(0.0, 0.79, 0.11);
    if (k == 4) return vec3(-0.13, 0.72, 0.10);
    if (k == 5) return vec3(-0.26, 0.60, 0.085);
    if (k == 6) return vec3(0.15, 0.56, 0.08);
    if (k == 7) return vec3(-0.09, 0.57, 0.08);
    if (k == 8) return vec3(0.04, 0.64, 0.09);
    if (k == 9) return vec3(-0.34, 0.50, 0.055);
    return vec3(0.45, 0.46, 0.05);
}

float sdTaper(vec2 p, vec2 a, vec2 b, float ra, float rb)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - mix(ra, rb, h);
}

// Tree silhouette in local coordinates (trunk foot at the origin, about
// 0.9 tall): a broad oak. Returns the signed distance, 1 on foliage or 0
// on wood, and a sunlight factor 0..1 for day shading.
vec3 tree(vec2 q, float seed)
{
    if (q.x < -0.44 || q.x > 0.54 || q.y < -0.02 || q.y > 0.94) return vec3(1.0, 0.0, 0.0);
    vec2 w = q - vec2(windAt(seed) * 0.01 * max(q.y - 0.25, 0.0), 0.0);

    // Wood: a short, curved, tapering trunk with a flared foot and three
    // limbs that fork once.
    float ty = clamp(w.y, 0.0, 0.34);
    float tx = 0.015 * sin(ty * 7.0 + seed) + 0.04 * ty;
    float tw = 0.034 - 0.014 * ty / 0.34 + 0.024 * exp(-max(w.y, 0.0) / 0.03);
    float sd = max(abs(w.x - tx) - tw, max(-w.y, w.y - 0.35));
    vec2 fork = vec2(0.015 * sin(0.3 * 7.0 + seed) + 0.012, 0.3);
    vec2 l1 = vec2(0.20, 0.44);
    vec2 l2 = vec2(-0.12, 0.46);
    vec2 l3 = vec2(0.05, 0.58);
    sd = min(sd, sdTaper(w, fork, l1, 0.017, 0.010));
    sd = min(sd, sdTaper(w, l1, vec2(0.37, 0.52), 0.010, 0.004));
    sd = min(sd, sdTaper(w, l1, vec2(0.26, 0.63), 0.008, 0.003));
    sd = min(sd, sdTaper(w, fork, l2, 0.016, 0.009));
    sd = min(sd, sdTaper(w, l2, vec2(-0.29, 0.53), 0.009, 0.004));
    sd = min(sd, sdTaper(w, l2, vec2(-0.08, 0.65), 0.007, 0.003));
    sd = min(sd, sdTaper(w, fork, l3, 0.014, 0.007));
    sd = min(sd, sdTaper(w, l3, vec2(0.02, 0.75), 0.007, 0.003));

    // Foliage: lumpy clusters, a leafy fringe that stirs in the wind.
    float c = 1.0;
    float best = 1.0;
    vec2 nrm = vec2(0.0);
    for (int k = 0; k < 11; k++) {
        vec3 cl = crown(k);
        vec2 d = w - cl.xy;
        float l = length(d);
        if (l > cl.z * 1.35 + 0.04) continue;
        float a = atan(d.y, d.x);
        float fk = float(k);
        float r = cl.z * (1.0 + 0.11 * sin(a * 5.0 + fk * 1.7) + 0.07 * sin(a * 9.0 + fk * 3.1) + 0.04 * sin(a * 17.0 + fk));
        float dk = l - r;
        c = smin(c, dk, 0.02);
        if (dk < best) {
            best = dk;
            nrm = d / cl.z;
        }
    }
    float sun = 0.0;
    if (c < 0.03) {
        vec2 st = vec2(sin(osc(0.21) + w.y * 4.0), cos(osc(0.17) + w.x * 4.0)) * 0.25 * WIND;
        // Two rotated octaves; one alone shows its lattice.
        float n = 0.6 * vnoise(w * 48.0 + st) + 0.4 * vnoise(mat2(0.8, -0.6, 0.6, 0.8) * w * 83.0 + st) - 0.5;
        c += 0.016 * n + 0.007 * (vnoise(w * 130.0 + 2.0 * st) - 0.5);
        // Sky shows through gaps near the rim.
        float gap = smoothstep(0.76, 0.82, vnoise(w * 34.0 + 9.0 + seed)) * smoothstep(-0.05, -0.012, c);
        c = mix(c, max(c, 0.003), gap);
        sun = clamp(0.5 + 0.55 * dot(nrm, vec2(0.55, 0.83)) + 0.3 * n, 0.0, 1.0);
    }
    if (c < sd) return vec3(c, 1.0, sun);
    return vec3(sd, 0.0, 0.3);
}

// ------------------------------------------------------------- reeds and dandelions

// Reeds and cattails standing in the pond near the left and right edges.
// Returns signed distance and 1 on a cattail head.
vec2 reeds(vec2 p)
{
    float sd = 1.0;
    float head = 0.0;
    // Zones narrow and reeds shorten on narrow screens.
    float zf = clamp(gAspect / 1.78, 0.35, 1.0);
    float zone = max(smoothstep(0.36 * zf, 0.12 * zf, p.x), smoothstep(gAspect - 0.42 * zf, gAspect - 0.12 * zf, p.x));
    if (zone <= 0.0 || p.y > 0.5) return vec2(sd, head);
    float sp = 0.022;
    float cell = floor(p.x / sp);
    for (int k = -2; k <= 2; k++) {
        float c = cell + float(k);
        vec4 r = hash4(c, 501.0);
        float cx = (c + 0.5) * sp;
        float z = max(smoothstep(0.36 * zf, 0.12 * zf, cx), smoothstep(gAspect - 0.42 * zf, gAspect - 0.12 * zf, cx));
        if (r.x > z * 0.85) continue;
        float base = 0.02 + 0.07 * r.y;
        float h = (0.16 + 0.26 * r.z * z) * (0.6 + 0.4 * GRASS) * mix(0.7, 1.0, zf);
        float t = (p.y - base) / h;
        if (t < 0.0 || t > 1.05) continue;
        float bx = (c + 0.2 + 0.6 * r.w) * sp;
        vec4 r2 = hash4(c, 502.0);
        bool cattail = r2.x < 0.45;
        float sway = windAt(bx) * 0.5 + 0.2 * WIND;
        float lean = clamp(((r2.y - 0.5) * (cattail ? 0.15 : 0.8) + 0.12 * sway) * h, -1.7 * sp, 1.7 * sp);
        float xc = bx + lean * t * t;
        float slope = 2.0 * lean * t / h;
        float hw = cattail ? 0.0016 : 0.0045 * pow(max(1.0 - t, 0.0), 0.7);
        float d = (abs(p.x - xc) - hw) * inversesqrt(1.0 + slope * slope);
        if (t > 1.0) d = 1.0;
        float isHead = 0.0;
        if (cattail) {
            // Head: a capsule from 0.72 to 0.88 of the height.
            vec2 a = vec2(bx + lean * 0.5184, base + h * 0.72);
            vec2 b = vec2(bx + lean * 0.7744, base + h * 0.88);
            float hd = sdSeg(p, a, b) - 0.0055;
            if (hd < d) {
                d = hd;
                isHead = 1.0;
            }
        }
        if (d < sd) {
            sd = d;
            head = isHead;
        }
    }
    return vec2(sd, head);
}

// Dandelion clocks along the near bank. Returns the signed distance of the
// stems, and in z, w the head coverage and its rim (0..1).
vec4 dandelions(vec2 p)
{
    vec4 o = vec4(1.0, 0.0, 0.0, 0.0);
    if (p.y < BANK_Y || p.y > 0.42) return o;
    float sp = 0.2;
    float cell = floor(p.x / sp);
    for (int k = -1; k <= 1; k++) {
        float c = cell + float(k);
        vec4 r = hash4(c, 901.0);
        if (r.x > 0.6) continue;
        float bx = (c + 0.15 + 0.7 * r.y) * sp;
        float base = BANK_Y + 0.01 + 0.012 * r.z;
        float h = (0.11 + 0.13 * r.w) * (0.7 + 0.3 * GRASS);
        float sway = windAt(bx) * 0.6 + 0.2 * WIND;
        float lean = (hash4(c, 902.0).x - 0.5) * 0.06 + 0.012 * sway;
        vec2 top = vec2(bx + lean, base + h);
        // Stem: a gentle arc from the foot to the head.
        float t = clamp((p.y - base) / h, 0.0, 1.0);
        float xc = bx + lean * t * t;
        float d = (p.y < base || p.y > top.y) ? 1.0 : abs(p.x - xc) - 0.0011;
        o.x = min(o.x, d);
        float hr = 0.016 + 0.007 * hash4(c, 903.0).y;
        vec2 dq = p - top;
        float rr = length(dq);
        if (rr < hr * 1.25) {
            float ang = atan(dq.y, dq.x);
            float fil = 0.55 + 0.45 * pow(abs(cos(ang * 17.0 + c)), 3.0);
            float edge = hr * (0.9 + 0.1 * fil);
            float cov = smoothstep(edge + gPx, edge - 0.25 * hr, rr) * (0.55 + 0.45 * fil);
            cov = max(cov, smoothstep(0.004 + gPx, 0.004, rr));
            o.z = max(o.z, cov);
            o.w = max(o.w, smoothstep(0.4 * hr, edge, rr) * cov);
        }
    }
    return o;
}

// ------------------------------------------------------------- fireflies

// Light of the fireflies near p, by layer. Perched fireflies sit on window
// edges, above everything, and are returned with the near layer.
vec2 gCur;      // cursor, H
float gLan;     // lantern strength 0..1
int gBase;      // resident swarm size
vec4 gG1;       // Buffer A globals (1, GLOBAL_ROW), (2, GLOBAL_ROW)
vec4 gG2;

void fireflies(vec2 p, out vec3 gFar, out vec3 gMid, out vec3 gNear)
{
    gFar = vec3(0.0);
    gMid = vec3(0.0);
    gNear = vec3(0.0);
    if (gFlyVis <= 0.0) return;
    ivec2 bin = ivec2(floor(toBuffer(p) * BINS_PER_H));
    if (bin.x < 0 || bin.y < 0 || bin.x >= gBinCols || bin.y >= int(BINS_PER_H)) return;
    vec4 pk = texelFetch(iChannel2, bin, 0);
    if (pk.x < 0.5) return;
    for (int k = 0; k < 8; k++) {
        float v = pk[k / 2];
        float hi = floor(v / 2048.0);
        int id = int((k % 2 == 0) ? hi : v - hi * 2048.0) - 1;
        if (id < 0) break;
        vec4 a = texelFetch(iChannel0, flyTexel(id, 0), 0);
        int mode = modeOf(a.w);
        if (mode == MODE_ABSENT) continue;
        int layer = layerOf(a.w);
        vec2 d = p - vec2(a.x / gKx, a.y);
        float r2 = dot(d, d);
        float s = flySize(id) * GLOW_SIZE;
        float fl = flashOf(a.z, id);
        float vis = visOf(a.w);
        float spark = sparkOf(jarAge(id, gBase, gG1, gG2));
        s *= 1.0 - 0.6 * spark;
        vec3 tint = mix(gGlow, gGlow * vec3(1.18, 0.8, 0.55), 0.6 * flyRand(id, 30) * flyRand(id, 31));
        vec3 hot = mix(tint, vec3(1.0, 1.0, 0.92), 0.6);
        if (layer == LAYER_NEAR) {
            // Out of focus: a soft bokeh disc with a brighter rim.
            float bc = (0.08 + 0.92 * fl) * vis;
            float r = sqrt(r2);
            float R = 0.014 * s;
            float disc = smoothstep(R + 0.002 * s, R - 0.007 * s, r) * (0.11 + 0.035 * smoothstep(R - 0.009 * s, R - 0.002 * s, r));
            float halo = 0.09 * exp(-r2 / (0.0004 * s * s));
            gNear += tint * (disc + halo) * bc;
        } else {
            // Between flashes only a faint ember of the core shows; it
            // brightens near the lantern.
            float ember = mode == MODE_PERCH ? 0.35 : (layer == LAYER_FAR ? 0.24 : 0.2);
            vec2 dl = vec2(a.x / gKx, a.y) - gCur;
            ember = min(ember * (1.0 + 2.5 * gLan * exp(-dot(dl, dl) / 0.025)), 0.75);
            ember = mix(ember, 0.55 + 0.45 * sin(gT * 31.0 + float(id) * 2.3), spark);
            float bc = (ember + (1.0 - ember) * fl) * vis * (1.0 + 0.6 * spark);
            float bh = (0.25 * min(ember, 0.3) + fl + 0.5 * spark) * vis;
            float far = layer == LAYER_FAR ? 1.0 : 0.0;
            float rc0 = mix(0.0016, 0.0010, far) * s;
            float rc = max(rc0, 0.7 * gPx);
            float core = exp(-r2 / (rc * rc)) * mix(1.2, 0.9, far) * rc0 / rc;
            float sg = (mode == MODE_PERCH ? 0.006 : mix(0.0125, 0.005, far)) * s;
            float halo = mix(0.4, 0.3, far) * exp(-r2 / (sg * sg));
            vec3 c = (tint * halo * bh + hot * core * bc) * mix(1.0, 0.8, far);
            if (mode == MODE_PERCH) gNear += c;
            else if (layer == LAYER_FAR) gFar += c;
            else gMid += c;
        }
    }
    float k = BRIGHTNESS * gFlyVis;
    gFar *= k;
    gMid *= k;
    gNear *= k;
}

// ------------------------------------------------------------- day life

// Butterflies fluttering over the meadow by day. Returns colour and coverage.
vec4 butterflies(vec2 p)
{
    vec4 o = vec4(0.0);
    if (gDay < 0.45 || p.y < 0.08 || p.y > 0.75) return o;
    int n = int(clamp(3.0 + 3.0 * gAspect, 4.0, 14.0));
    for (int k = 0; k < 14; k++) {
        if (k >= n) break;
        // Home and reach first: most butterflies are far from p.
        vec2 c = vec2((0.08 + 0.84 * fract(float(k) * 0.7548777 + 0.2)) * gAspect, 0.18 + 0.32 * fract(float(k) * 0.5698403 + 0.4));
        if (abs(p.x - c.x) > 0.31 || abs(p.y - c.y) > 0.11) continue;
        vec4 h = hash4(float(k), 1201.0);
        vec4 h2 = hash4(float(k), 1202.0);
        float sz = 0.010 + 0.006 * h.w;
        float ax = osc(0.021 + 0.02 * h.z) + TAU * h2.x;
        c.x += 0.22 * sin(ax) + 0.06 * sin(osc(0.093 + 0.05 * h2.y) + 2.0 * h.z);
        c.y += 0.07 * sin(osc(0.047 + 0.03 * h2.z) + TAU * h2.w) + 0.012 * sin(osc(1.7 + h.z));
        vec2 q = (p - c) / sz;
        if (dot(q, q) > 2.5) continue;
        if (cos(ax) < 0.0) q.x = -q.x;
        float open = 0.25 + 0.75 * abs(sin(osc(5.0 + 3.0 * h.z)));
        vec2 w = vec2(abs(q.x) / max(open, 0.05), q.y);
        float fw = length((w - vec2(0.55, 0.22)) / vec2(0.55, 0.42)) - 1.0;
        float hw = length((w - vec2(0.38, -0.3)) / vec2(0.38, 0.32)) - 1.0;
        float wing = min(fw, hw);
        float body = length(q / vec2(0.09, 0.45)) - 1.0;
        float a = smoothstep(0.08, -0.08, wing) * step(0.02, abs(q.x));
        vec3 col;
        float sp = h2.x;
        if (sp < 0.35) col = vec3(0.98, 0.55, 0.12);
        else if (sp < 0.6) col = vec3(0.97, 0.96, 0.9);
        else if (sp < 0.8) col = vec3(0.45, 0.62, 0.98);
        else col = vec3(1.0, 0.9, 0.35);
        col = mix(col, vec3(0.12, 0.08, 0.06), smoothstep(-0.25, 0.0, wing) * 0.7);
        col *= 0.8 + 0.2 * open;
        float ba = smoothstep(0.15, -0.15, body);
        col = mix(col, vec3(0.1, 0.08, 0.07), ba);
        a = max(a, ba);
        if (a > o.a) o = vec4(col, a);
    }
    o.a *= smoothstep(0.45, 0.8, gDay);
    return o;
}

// Dandelion seeds drifting on the breeze by day. Returns brightness and coverage.
vec2 seeds(vec2 p)
{
    float amt = smoothstep(0.15, 0.6, gDay);
    if (amt <= 0.0 || p.y < 0.14 || p.y > 0.9) return vec2(0.0);
    float cs = 0.13;
    float per;
    float off = drift(0.025, 1.0 / cs, per);
    vec2 q = vec2(p.x / cs - off, p.y / cs);
    vec2 ci = floor(q);
    vec2 o = vec2(0.0);
    for (int k = 0; k < 4; k++) {
        vec2 c = ci - vec2(float(k & 1), float(k >> 1));
        vec2 cw = vec2(mod(c.x, per), c.y + 1300.0);
        if (hash12(cw) > 0.18) continue;
        vec4 h = hash4(cw.x, cw.y);
        vec2 sp = c + vec2(0.5 + 0.35 * sin(osc(0.07 + 0.05 * h.y) + TAU * h.z), 0.5 + 0.3 * sin(osc(0.05 + 0.04 * h.w) + TAU * h.y));
        vec2 d = (q - sp) * cs;
        float r = length(d);
        if (r > 0.02) continue;
        float ang = atan(d.y, d.x) + osc(0.03) * (h.z - 0.5);
        float rad = 0.006;
        float fil = pow(abs(cos(ang * 5.0)), 10.0) * smoothstep(rad + gPx, rad * 0.4, r);
        float tuft = smoothstep(rad * 0.25 + gPx, rad * 0.25, r);
        float stem = smoothstep(gPx * 0.9, 0.0, abs(d.x)) * step(-0.009, d.y) * step(d.y, 0.0);
        float ach = smoothstep(0.0016 + gPx, 0.0016, length(d - vec2(0.0, -0.0095)));
        o.x = max(o.x, max(fil * 0.8, tuft));
        o.y = max(o.y, max(max(fil * 0.8, tuft), max(stem * 0.7, ach)));
    }
    o.y *= amt;
    return o;
}

// ------------------------------------------------------------- main

// Far edge of the meadow, a gentle roll below the tree line.
float meadowEdge(float x)
{
    return HORIZON - 0.012 + 0.009 * sin(x * 2.3 + 0.7) + 0.005 * sin(x * 5.1 + 2.0) + 0.003 * noise1(x * 23.0);
}

// Ground mist: two banks of streaks drifting slowly, 0..1.
float mistAt(vec2 p)
{
    if (MIST <= 0.0 || p.y < 0.1 || p.y > 0.34) return 0.0;
    float per;
    float off = drift(0.005, 1.8, per);
    vec2 q = vec2(p.x * 1.8 - off, p.y * 24.0);
    float n = 0.65 * vnoiseP(q, per) + 0.35 * vnoiseP(q * vec2(2.0, 1.6) + vec2(0.0, 7.3), 2.0 * per);
    float far = exp(-pow((p.y - meadowEdge(p.x) + 0.004) / 0.022, 2.0));
    float low = exp(-pow((p.y - 0.2) / 0.045, 2.0));
    return MIST * (0.55 * far + 0.45 * low) * smoothstep(0.3, 0.75, n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    gAspect = iResolution.x / iResolution.y;
    gPx = 1.0 / iResolution.y;
    vec2 p = fragCoord * gPx;
    gBinRes = iChannelResolution[0].xy;
    float bufAspect = gBinRes.y > 0.0 ? gBinRes.x / gBinRes.y : gAspect;
    gKx = bufAspect / gAspect;
    gBinCols = binCols(bufAspect);
    vec4 G0 = texelFetch(iChannel0, ivec2(0, GLOBAL_ROW), 0);
    gT = G0.x;

    float hr = mod(iDate.w / 3600.0, 24.0);
    gDay = FORCE_NIGHT ? 0.0 : smoothstep(5.4, 7.2, hr) * (1.0 - smoothstep(18.6, 20.6, hr));
    gGold = pow(4.0 * gDay * (1.0 - gDay), 1.5) * 0.9;
    gFlyVis = 1.0 - smoothstep(0.25, 0.75, gDay);
    gGlow = GLOW_COLOUR;
    gMoon = vec2(min(gAspect * 0.8, gAspect - 0.12), 0.8);
    gSun = vec2(min(gAspect * 0.74, gAspect - 0.15), mix(HORIZON + 0.02, 0.84, smoothstep(0.35, 1.0, gDay)));
    bool image2 = iChannelResolution[1].x > 0.0;

    gCur = iMouse.xy * gPx;
    gLan = G0.z;
    gBase = baseCount(bufAspect);
    gG1 = texelFetch(iChannel0, ivec2(1, GLOBAL_ROW), 0);
    gG2 = texelFetch(iChannel0, ivec2(2, GLOBAL_ROW), 0);
    float light = gFlyVis > 0.0 ? bloomAt(p) : 0.0;
    vec3 gFar;
    vec3 gMid;
    vec3 gNear;
    fireflies(p, gFar, gMid, gNear);

    // Lantern: a faint warm light at a resting cursor.
    float lan = G0.z * gFlyVis;
    vec3 lanCol = vec3(1.0, 0.72, 0.38);
    float lanR = distance(p, gCur);
    float lanLight = lan * (0.5 * exp(-lanR * lanR / 0.0012) + 0.25 * exp(-lanR / 0.08));
    // A jar just opened: a soft ring of light spreading from it.
    float jr = distance(p, gG2.xy / vec2(gKx, 1.0));
    float jarRing = gFlyVis * (1.0 - smoothstep(0.0, 1.4, gG2.z)) * exp(-pow((jr - 0.03 - 0.22 * gG2.z) / 0.02, 2.0));

    // Sky, the tree line and the far meadow.
    vec3 col = image2 ? wallpaper(fragCoord) : sky(p);
    // With a wallpaper, its own horizon replaces the tree line and tints the haze.
    vec3 haze = image2 ? wallpaper(vec2(p.x, HORIZON + 0.02) / gPx) : skyGradient(HORIZON + 0.03);
    float tl = p.y < HORIZON + 0.06 && !image2 ? treeline(p.x) : 0.0;
    if (p.y < tl + gPx) {
        vec3 tc = tod(vec3(0.07, 0.055, 0.14), vec3(0.40, 0.27, 0.33), vec3(0.45, 0.57, 0.55));
        tc = mix(tc, haze, 0.3);
        col = mix(col, tc, cover(p.y - tl));
    }
    float me = p.y < HORIZON + 0.03 ? meadowEdge(p.x) : 0.0;
    if (p.y < me + 0.03) {
        vec3 farC = tod(vec3(0.05, 0.042, 0.11), vec3(0.30, 0.20, 0.21), vec3(0.42, 0.56, 0.30));
        farC = mix(farC, haze, (image2 ? 0.35 : 0.18) * smoothstep(me - 0.06, me, p.y));
        vec2 g = grass(p, me - 0.003, 0.004, 1, false, 1, 0.004, 0.014, 0.002, 0.0, 1.0, 0.0);
        col = mix(col, shadeLayer(farC, g, light * 0.4, 0.003), cover(g.x));
    }
    col += gFar;

    // Mid meadow and mist.
    vec3 midC = tod(vec3(0.034, 0.032, 0.085), vec3(0.22, 0.14, 0.14), vec3(0.32, 0.47, 0.20));
    vec2 g = grass(p, 0.235, 0.0075, 2, false, 1, 0.015, 0.05, 0.0032, 0.08, 2.0, 0.0);
    col = mix(col, shadeLayer(midC, g, light * 0.7, 0.004), cover(g.x));

    float m = mistAt(p);
    if (m > 0.0) {
        vec3 mc = mix(haze, tod(vec3(0.5, 0.5, 0.7), vec3(1.0, 0.8, 0.7), vec3(1.0)), 0.25);
        mc += gGlow * light * 0.4 * gFlyVis + lanCol * lanLight * 0.5;
        col = mix(col, mc, clamp(m * mix(0.5, 0.3, gDay), 0.0, 1.0));
    }

    vec3 mid2C = tod(vec3(0.024, 0.024, 0.06), vec3(0.16, 0.095, 0.095), vec3(0.24, 0.40, 0.15));
    g = grass(p, 0.175, 0.012, 2, false, 1, 0.03, 0.1, 0.0048, 0.22, 3.0, 0.3);
    col = mix(col, shadeLayer(mid2C, g, light, 0.005), cover(g.x));

    // The tree, and a second on very wide screens.
    if (TREE) {
        float S = clamp(gAspect / 2.2, 0.35, 0.8);
        vec3 tr = tree((p - vec2(0.11 * S / 0.8, BANK_Y + 0.016)) / S, 0.0);
        tr.x *= S;
        if (gAspect > 2.6) {
            float S2 = 0.66;
            vec2 q = p - vec2(gAspect - 0.09, BANK_Y + 0.02);
            vec3 tr2 = tree(vec2(-q.x, q.y) / S2, 2.3);
            tr2.x *= S2;
            if (tr2.x < tr.x) tr = tr2;
        }
        if (tr.x < gPx) {
            vec3 trunk = tod(vec3(0.012, 0.012, 0.03), vec3(0.09, 0.055, 0.055), vec3(0.22, 0.16, 0.11));
            vec3 leaf = tod(vec3(0.014, 0.018, 0.04), vec3(0.12, 0.09, 0.07), mix(vec3(0.09, 0.19, 0.07), vec3(0.36, 0.53, 0.19), tr.z));
            vec3 tcol = tr.y > 0.5 ? leaf : trunk * (1.0 + gDay * 0.4 * tr.z);
            tcol = shadeLayer(tcol, vec2(tr.x, 0.0), light, 0.008);
            tcol += lanCol * lanLight * 0.3 * exp(min(tr.x, 0.0) / 0.01);
            col = mix(col, tcol, cover(tr.x));
        }
    }

    col += gMid;

    // Near grass and dandelions on the bank.
    vec3 nearC = tod(vec3(0.011, 0.013, 0.033), vec3(0.075, 0.048, 0.048), vec3(0.15, 0.30, 0.10));
    g = grass(p, BANK_Y + 0.008, 0.03, 3, true, 2, 0.05, 0.22, 0.007, 0.35, 4.0, 1.0);
    float gy = POND ? max(g.x, BANK_Y - p.y) : g.x;
    vec3 nc = shadeLayer(nearC, vec2(gy, g.y), light, 0.007) + lanCol * lanLight * 0.25 * exp(min(gy, 0.0) / 0.006);
    col = mix(col, nc, cover(gy));

    vec4 dl = dandelions(p);
    if (dl.x < gPx || dl.z > 0.0) {
        col = mix(col, nearC, cover(dl.x));
        vec3 head = tod(vec3(0.07, 0.075, 0.13), vec3(0.95, 0.75, 0.6), vec3(0.96, 0.96, 0.93));
        head += gGlow * light * (0.3 + 0.9 * dl.w) * gFlyVis + lanCol * lanLight * 0.8;
        col = mix(col, head, dl.z * 0.85);
    }

    // Pond: the sky's glow, the bank's grass hanging upside down in it and
    // the fireflies above, all broken by ripples; lily pads afloat.
    if (POND && p.y < BANK_Y) {
        float dep = (BANK_Y - p.y) / BANK_Y;
        float v = 0.03 / (BANK_Y - p.y + 0.012);
        float ripple = 0.6 * sin(v * 45.0 + 0.5 * sin(p.x * 7.0 + v) - osc(0.35))
                     + 0.8 * (vnoise(vec2(p.x * 40.0 / v, v * 14.0)) - 0.5);
        // Reflections are squashed 1.8x so the water keeps more sky.
        vec2 m2 = vec2(p.x + (0.002 + 0.006 * dep) * ripple, BANK_Y + 1.8 * (BANK_Y - p.y) + 0.002 * ripple);
        float sy = HORIZON + 0.05 + dep * 0.45;
        vec3 refl = image2 ? wallpaper(vec2(m2.x, sy) / gPx) : skyGradient(sy);
        refl *= 0.75;
        vec2 rg = grass(m2, BANK_Y + 0.008, 0.03, 3, true, 2, 0.05, 0.22, 0.007, 0.35, 4.0, 1.0);
        refl = mix(refl, nearC, cover(max(rg.x, BANK_Y - m2.y)) * (0.7 - 0.55 * dep));
        vec3 rf;
        vec3 rm;
        vec3 rn;
        fireflies(m2, rf, rm, rn);
        refl += (rf + rm + rn) * 0.6 + gGlow * bloomAt(m2) * 0.1 * gFlyVis;
        vec3 water = tod(vec3(0.01, 0.014, 0.04), vec3(0.14, 0.09, 0.09), vec3(0.14, 0.24, 0.30));
        vec3 pc = mix(water, refl, 0.8 - 0.3 * dep);
        pc *= 0.9 + 0.1 * ripple;
        pc += lanCol * lanLight * 0.2;

        // Lily pads, flatter toward the far bank.
        float sp = 0.26;
        float cell = floor(p.x / sp);
        for (int k = -1; k <= 1; k++) {
            float c = cell + float(k);
            vec4 r = hash4(c, 1401.0);
            if (r.x > 0.6) continue;
            vec2 ctr = vec2((c + 0.2 + 0.6 * r.y) * sp, 0.018 + 0.07 * r.z);
            ctr.x += 0.004 * sin(osc(0.05) + TAU * r.w);
            float far = ctr.y / BANK_Y;
            float rx = (0.026 + 0.016 * r.w) * (1.0 - 0.45 * far);
            float ry = rx * (0.3 - 0.15 * far);
            vec2 q = (p - ctr) / vec2(rx, ry);
            float d = (length(q) - 1.0) * ry;
            // A notch from the centre to the rim.
            vec2 nd = vec2(cos(TAU * r.y), sin(TAU * r.y));
            float wedge = abs(dot(q, vec2(-nd.y, nd.x))) - 0.12 * max(dot(q, nd), 0.0);
            if (dot(q, nd) > 0.0) d = max(d, -wedge * ry);
            if (d < gPx) {
                vec3 pad = tod(vec3(0.012, 0.02, 0.03), vec3(0.08, 0.06, 0.04), vec3(0.20, 0.40, 0.14));
                pad *= 1.0 + 0.6 * smoothstep(-0.4, 1.0, q.y) * (0.3 + gDay);
                pad += gGlow * light * (0.05 + 0.3 * exp(d / 0.003)) * gFlyVis;
                pc = mix(pc, pad, cover(d));
            }
        }
        pc = mix(pc, nearC, smoothstep(BANK_Y - 0.005, BANK_Y, p.y));
        col = pc;
    }

    // Reeds and cattails, in front of the bank.
    vec2 rd = reeds(p);
    if (rd.x < gPx) {
        vec3 rc = tod(vec3(0.009, 0.011, 0.028), vec3(0.065, 0.04, 0.038), vec3(0.20, 0.34, 0.13));
        if (rd.y > 0.5) rc = tod(vec3(0.02, 0.014, 0.025), vec3(0.14, 0.07, 0.04), vec3(0.36, 0.22, 0.12));
        rc = shadeLayer(rc, vec2(rd.x, 0.5), light, 0.004);
        col = mix(col, rc, cover(rd.x));
    }

    // Day life.
    vec4 bf = butterflies(p);
    col = mix(col, bf.rgb, bf.a);
    vec2 sd = seeds(p);
    if (sd.y > 0.0) {
        vec3 sc = tod(vec3(0.42, 0.44, 0.58), vec3(1.0, 0.85, 0.72), vec3(1.0, 1.0, 0.97));
        col = mix(col, sc * (0.7 + 0.3 * sd.x), sd.y * 0.85);
    }

    // Light in the air: flash bloom, the lantern, the near fireflies.
    col += gGlow * light * 0.07 * gFlyVis;
    col += lanCol * lanLight * 0.35;
    col += mix(gGlow, vec3(1.0, 0.9, 0.6), 0.5) * jarRing * 0.12 * BRIGHTNESS;
    col += gNear;

    // Soft shoulder above 0.75 so bright overlaps do not clip hard.
    col = max(col, 0.0);
    vec3 over = max(col - 0.75, 0.0);
    col = min(col, 0.75) + 0.25 * (1.0 - exp(-over / 0.25));
    fragColor = vec4(col, 1.0);
}
