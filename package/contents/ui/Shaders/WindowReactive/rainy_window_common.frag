// Rainy Window — constants, state layout and helpers shared by every pass.
//
// Units: positions are screen fractions (uv, GL origin bottom-left); lengths
// are in H, one screen height, and speeds in H/s. A buffer pass converts
// with its grid's aspect, which is the screen's (a grid is at least 64 px
// wide, so a very small portrait grid stretches slightly).
//
// Buffer A: drops, input and window state, screen tiles. Only the bottom-left
// 64 x (ROW_TILE + 2 TILE_ROWS) texels are written; a zero w is "never set".
//   (0, 0)       x animation clock (s, wraps at CLOCK), y 1 while a button
//                was held last step, z step counter (wraps at 2^20), w 1
//   (1, 0)       tap: xy uv, z age (s, capped at 60), w tap count cycling
//                1..1023 (0 before the first); age 0 is the step of the press
//   (16 + k, 0)  window k: x water pooled on its top edge 0..1, y smoothed
//                speed (H/s), z width (H) last step, w 1
//   (i % 32, ROW_DROP + i / 32)       drop i: xy uv, z radius (H), w mode
//                code
//   (32 + i % 32, ROW_DROP + i / 32)  drop i: xy velocity (H/s), z running:
//                distance run (H, wraps at 64), otherwise age (s, capped at
//                600); w seed 0..1, renewed at each spawn
//   (tx, ROW_TILE + p TILE_ROWS + ty)  screen tile (tx, ty) of tilesX() x
//                TILE_ROWS, drops 96p .. 96p + 95 reaching into it: 24 per
//                channel as exact float integers, drop 96p + k at bit k % 24
//                of channel k / 24
// Slots past dropsActive() stay free: the count follows the screen's area.
// Mode code = state + 8 window + 128 side. States: 0 free, 1 resting,
// 2 running, 3 sliding down a window's side, 4 hanging from a window's
// bottom corner; window and side (0 left, 1 right) apply to 3 and 4.
//
// Buffer B: the glass, one texel per grid cell at uv = fragCoord / iResolution.
//   x fog 0..1, y bead cover 0..1 (count and size of the small static
//   beads), z trail wetness (1 fresh .. 0 dry), w bead clustering 0.05..1,
//   fixed per cell (0 = never set)
//
// Buffer C: the city behind the glass, rgb at uv, w 1; written on the last
// step of each frame only.
//
// @shared tweaks of rainy_window.frag: RAIN (rain strength), DROP_SIZE
// (radius scale of every drop), FOG_REGROW (fog regrowth rate), FINGER
// (cursor wipe width), BLUR, WARMTH, LIGHTNING and FOLLOW_CLOCK (the city,
// drawn in Buffer C).

const int NDROP     = 192;
const int ROW_DROP  = 1;
const int ROW_TILE  = 7;
const int TILE_ROWS = 9;
const int SLOT0     = 16;

const int ST_FREE = 0;
const int ST_REST = 1;
const int ST_RUN  = 2;
const int ST_EDGE = 3;
const int ST_HANG = 4;

const float CLOCK = 600.0;   // s; looping animation uses whole cycles per CLOCK
const float TAU   = 6.28318531;

// Drop radii, H.
const float DU     = 0.0021 * DROP_SIZE;
const float R_MIN  = 1.3 * DU;    // smaller drops dissolve into the beads
const float R_STOP = 3.0 * DU;    // a running drop below this comes to rest
const float R_REF  = 8.0 * DU;    // scale of running speed

const float RAIN_SLANT = 0.18;    // horizontal H per H of fall

const float HORIZON   = 0.28;     // street line of the city, H
const float BOKEH     = 0.025;    // blur radius of the city's lights at BLUR 1, H
const float CITY_ROWS = 200.0;    // smallest grid Buffer C draws the city on

float hash11(float p)
{
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 hash32(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec4 hash43(vec3 p)
{
    vec4 p4 = fract(vec4(p.xyzx) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
    p4 += dot(p4, p4.wzxy + 33.33);
    return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

float vnoise1(float x)
{
    float i = floor(x);
    float f = fract(x);
    return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f));
}

float vnoise2(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), w.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), w.x), w.y);
}

// Slow weather 0..1 at clock t (s since midnight): drizzle near 0, downpour
// near 1. Periods divide a day.
float weatherSlow(float t)
{
    float w = 0.5 + 0.32 * sin(TAU * t / 432.0 + 1.3) + 0.18 * sin(TAU * t / 172.8 + 4.1);
    return clamp(w, 0.0, 1.0);
}

// Rain strength at clock t: 0.3 in drizzle, 1 in a downpour, up to 1.5 in
// a gust; times RAIN.
float rainNow(float t)
{
    float gust = smoothstep(0.62, 0.92, vnoise1(t / 24.0 + 7.0));
    return RAIN * (0.3 + 0.7 * weatherSlow(t) + 0.5 * gust);
}

// Lightning brightness 0..1 at clock t. At most one flash per 53 s slot,
// only in heavy weather, about seven an hour on average: a 0.15 s rise,
// a 0.35 s fall and a fainter second pulse 0.6 s later. Never more than
// two pulses a second.
float lightningNow(float t)
{
    float slot = floor(t / 53.0);
    float storm = smoothstep(0.55, 0.8, weatherSlow(slot * 53.0));
    if (hash11(slot * 1.37 + 0.71) > 0.3 * storm) return 0.0;
    float x = t - slot * 53.0 - (4.0 + 40.0 * hash11(slot * 7.13 + 2.9));
    if (x < 0.0 || x > 4.0) return 0.0;
    float a = smoothstep(0.0, 0.15, x) * exp(-max(x - 0.15, 0.0) / 0.35);
    float b = smoothstep(0.55, 0.75, x) * exp(-max(x - 0.75, 0.0) / 0.6);
    return a + 0.5 * b;
}

int dropState(float code) { return int(mod(code + 0.5, 8.0)); }
int dropWin(float code)   { return int(mod(floor((code + 0.5) / 8.0), 16.0)); }
int dropSide(float code)  { return int(floor((code + 0.5) / 128.0)); }
float dropCode(int st, int win, int side) { return float(st + 8 * win + 128 * side); }

ivec2 dropTexel(int i, int part) { return ivec2(i - (i / 32) * 32 + 32 * part, ROW_DROP + i / 32); }

int tilesX(float asp) { return clamp(int(ceil(float(TILE_ROWS) * asp - 0.01)), 1, 64); }

// Mask texel of tile t for drops 96 part .. 96 part + 95.
ivec2 tileTexel(ivec2 t, int part) { return ivec2(t.x, ROW_TILE + part * TILE_ROWS + t.y); }

// Drop slots in use: 96 on a 16:9 screen, in proportion to the area in H^2.
int dropsActive(float asp) { return clamp(int(96.0 * asp / 1.7778 + 0.5), 48, NDROP); }

// Length of the tail behind a running drop, H.
float tailLen(float r, vec2 v) { return r * 1.4 * smoothstep(0.015, 0.2, length(v)); }

// Radius around a drop's centre that holds everything it draws or clears,
// with a margin for a step of travel (a window's frame of travel for the
// drops it carries).
float dropReach(float r, int st)
{
    if (st == ST_RUN) return 2.5 * r + 0.003;
    if (st == ST_REST) return 1.65 * r + 0.003;
    return 2.6 * r + 0.025;
}

// Rain reaching the glass at uv, 0..1: none under a window, less in the lee
// below one. Window rects are in the pass's pixels.
float shelterAt(vec2 uv, float asp)
{
    float s = 1.0;
    vec2 P = uv * vec2(asp, 1.0);
    for (int i = 0; i < 16; i++) {
        if (i >= iWindowCount) break;
        vec4 r = iWindowRects[i] / iResolution.xyxy;
        if (r.z <= 0.0 || r.w <= 0.0) continue;
        vec4 R = r * vec4(asp, 1.0, asp, 1.0);
        float below = R.y - P.y;
        if (below < -R.w || below > 0.16) continue;
        if (below <= 0.0) {
            if (P.x > R.x && P.x < R.x + R.z) return 0.0;
            continue;
        }
        float x = P.x + RAIN_SLANT * below;
        float edge = min(x - R.x, R.x + R.z - x);
        float lee = smoothstep(-0.004, 0.014, edge) * (1.0 - smoothstep(0.0, 0.16, below));
        s = min(s, 1.0 - 0.85 * lee);
    }
    return s;
}

// Index of the window whose rect (pixels of this pass) holds pixel point p
// shrunk by m pixels on every side, or -1.
int windowAt(vec2 p, float m)
{
    for (int i = 0; i < 16; i++) {
        if (i >= iWindowCount) break;
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        if (p.x > r.x + m && p.y > r.y + m && p.x < r.x + r.z - m && p.y < r.y + r.w - m) return i;
    }
    return -1;
}

// Cursor at pixel m (this pass) usable on the glass: on screen, above the
// panel strip, not over a window, not the fixed centre reported while mouse
// input is off.
bool cursorOnGlass(vec2 m)
{
    vec2 uv = m / iResolution.xy;
    if (uv.x <= 0.001 || uv.y < 0.06 || uv.x >= 0.999 || uv.y >= 0.999) return false;
    if (all(lessThan(abs(m - 0.5 * iResolution.xy), vec2(0.01)))) return false;
    return windowAt(m, 0.0) < 0;
}

// ------------------------------------------------------------- the city

float cNight;   // 0 day .. 1 night
float cFlash;   // lightning 0..1
float cClock;   // s, wraps at CLOCK
float cBl;      // blur radius of the lights, H

void cityBegin(float clock)
{
    float h = mod(iDate.w / 3600.0, 24.0);
    cNight = FOLLOW_CLOCK ? 1.0 - smoothstep(6.0, 8.0, h) * (1.0 - smoothstep(17.0, 19.0, h)) : 1.0;
    cFlash = LIGHTNING ? lightningNow(iDate.w) : 0.0;
    cClock = clock;
    cBl = BOKEH * BLUR;
}

// Value noise with period n (whole number).
float pnoise1(float x, float n)
{
    float i = floor(x);
    float f = fract(x);
    return mix(hash11(mod(i, n)), hash11(mod(i + 1.0, n)), f * f * (3.0 - 2.0 * f));
}

// Out-of-focus light: flat disc, edge softness e, slightly brighter rim.
float disc(float d, float rad, float e)
{
    float k = 1.0 - smoothstep(rad - e, rad + e, d);
    return k * (0.8 + 0.3 * smoothstep(0.3 * rad, rad, d));
}

// Brightness of a light of size lr drawn at radius rad, relative to its
// bokeh at the current blur: the same light energy over a smaller disc.
float lightGain(float lr, float rad)
{
    float k = (lr + cBl) / rad;
    return min(k * k, 12.0);
}

vec3 warmLight(float h)
{
    vec3 warm = mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.78, 0.46), h);
    vec3 cool = mix(vec3(0.70, 0.84, 1.0), vec3(0.95, 0.96, 1.0), h);
    return mix(cool, warm, clamp(WARMTH + 0.5 * (fract(h * 5.3) - 0.5), 0.0, 1.0));
}

float towerTop(float x, float cw, float base, float amp, float lots, float seed)
{
    float c = floor(x / cw);
    float h = hash11(c * 1.37 + seed);
    return base + amp * h * h * step(1.0 - lots, hash11(c * 4.11 + seed * 1.3));
}

// Coverage of a row of towers blurred by e.
float towers(vec2 p, float cw, float base, float amp, float lots, float seed, float e)
{
    float cov = 0.0;
    for (int k = -1; k <= 1; k++) {
        float top = towerTop(p.x + float(k) * 0.6 * e, cw, base, amp, lots, seed);
        cov += 1.0 - smoothstep(top - e, top + e, p.y);
    }
    return cov / 3.0;
}

// Far towers: tops 0.42..0.86 H on every lot. Near towers: tops up to 0.92
// H on 55% of lots, in front.
float farTop(float x)  { return towerTop(x, 0.05, 0.42, 0.44, 1.0, 3.0); }
float nearTop(float x) { return towerTop(x, 0.13, 0.30, 0.62, 0.55, 11.0); }

// Lit windows, one light per cell at most: in the far towers where no near
// tower stands in front (near = false), or in the near towers.
vec3 litWindows(vec2 p, bool near, float bl, float fp)
{
    float lr = near ? 0.006 : 0.003;
    float rad = max(lr + bl, fp);
    float gain = lightGain(lr, rad) * (near ? 0.6 : 0.42) * mix(0.3, 1.0, cNight);
    float cell = max(near ? 0.062 : 0.034, (lr + cBl) / 0.72);
    float dens = near ? 0.55 : 0.7;
    vec2 b0 = floor(p / cell - 0.5);
    vec3 acc = vec3(0.0);
    for (int j = 0; j < 4; j++) {
        vec2 id = b0 + vec2(float(j & 1), float(j >> 1));
        vec4 h = hash43(vec3(id, near ? 13.0 : 7.0));
        if (h.x > dens) continue;
        vec2 c = (id + 0.5 + (h.yz - 0.5) * 0.5) * cell;
        if (c.y < HORIZON + 0.02) continue;
        float nt = nearTop(c.x) - 0.012;
        if (near ? c.y > nt : (c.y < nt + 0.024 || c.y > farTop(c.x) - 0.012)) continue;
        float rr = rad * (0.75 + 0.25 * h.w);
        float k = fract(h.w * 7.31);
        acc += warmLight(h.w) * disc(length(p - c), rr, max(fp, 0.12 * rr)) * (0.2 + 1.1 * k * k * k);
    }
    return acc * gain;
}

vec3 streetLamps(vec2 p, float bl, float fp)
{
    const float lr = 0.010;
    float rad = max(lr + bl, fp);
    float gain = lightGain(lr, rad) * 0.8 * mix(0.3, 1.0, cNight);
    float e = max(fp, 0.1 * rad);
    float cell = max(0.36, 2.0 * (lr + cBl));
    vec3 lc = mix(vec3(0.95, 0.93, 0.86), vec3(1.0, 0.56, 0.2), WARMTH);
    float c0 = floor(p.x / cell - 0.5);
    vec3 acc = vec3(0.0);
    for (int k = 0; k < 2; k++) {
        float c = c0 + float(k);
        float h = hash11(c * 5.31 + 1.7);
        vec2 L = vec2((c + 0.5 + (h - 0.5) * 0.3) * cell, HORIZON + 0.1 + 0.025 * h);
        acc += disc(length(p - L), rad, e);
        vec2 rq = (p - vec2(L.x, HORIZON - 0.11)) / vec2(1.0, 2.5);
        acc += 0.2 * disc(length(rq), rad, e);
    }
    return acc * lc * gain;
}

// Two lanes: tail lights going right far off, headlights coming left near.
// A lane moves n cells per CLOCK, so the clock's wrap is seamless.
vec3 traffic(vec2 p, float bl, float fp)
{
    vec3 acc = vec3(0.0);
    for (int lane = 0; lane < 2; lane++) {
        bool far = lane == 0;
        float y = HORIZON - (far ? 0.032 : 0.075);
        float cell = far ? 0.30 : 0.42;
        float n = far ? 64.0 : 96.0;
        float dir = far ? 1.0 : -1.0;
        float sep = far ? 0.034 : 0.05;
        float lr = far ? 0.006 : 0.009;
        vec3 lc = far ? vec3(1.0, 0.13, 0.07) : mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.84, 0.6), WARMTH);
        float rad = max(lr + bl, fp);
        float gain = lightGain(lr, rad) * (far ? 0.6 : 0.75) * mix(0.55, 1.0, cNight);
        float e = max(fp, 0.12 * rad);
        float off = dir * cell * n * cClock / CLOCK;
        float c0 = floor((p.x - off) / cell - 0.5);
        for (int k = 0; k < 2; k++) {
            float c = c0 + float(k);
            float cm = mod(c, n);
            if (hash11(cm * 3.7 + float(lane) * 19.0) > 0.55) continue;
            float cx = (c + 0.5 + (hash11(cm * 9.1 + 4.0) - 0.5) * 0.3) * cell + off;
            for (int s = 0; s < 2; s++) {
                vec2 L = vec2(cx + (float(s) - 0.5) * sep, y);
                float l = disc(length(p - L), rad, e);
                vec2 rq = (p - vec2(L.x, y - 0.05)) / vec2(1.0, 2.4);
                l += 0.22 * disc(length(rq), rad, e);
                acc += lc * l * gain;
            }
        }
    }
    return acc;
}

// Shop signs: a few big saturated lights, some blinking slowly.
vec3 signs(vec2 p, float bl, float fp)
{
    const float lr = 0.012;
    float rad = max(lr + bl, fp);
    float gain = lightGain(lr, rad) * mix(0.3, 0.5, cNight);
    float cell = max(0.21, (lr + cBl) / 0.72);
    vec2 b0 = floor(p / cell - 0.5);
    vec3 acc = vec3(0.0);
    for (int j = 0; j < 4; j++) {
        vec2 id = b0 + vec2(float(j & 1), float(j >> 1));
        vec4 h = hash43(vec3(id, 41.0));
        if (h.x > 0.2) continue;
        vec2 c = (id + 0.5 + (h.yz - 0.5) * 0.5) * cell;
        if (c.y < HORIZON + 0.03 || c.y > 0.6) continue;
        vec3 sc = h.w < 0.25 ? vec3(1.0, 0.22, 0.55) : h.w < 0.5 ? vec3(0.2, 0.8, 1.0)
                : h.w < 0.75 ? vec3(0.35, 1.0, 0.5) : vec3(1.0, 0.25, 0.12);
        float on = fract(h.w * 9.7) > 0.6 ? smoothstep(0.35, 0.6, pnoise1(cClock * 0.5 + h.w * 100.0, 300.0)) : 1.0;
        acc += sc * disc(length(p - c), rad * (0.8 + 0.2 * h.y), max(fp, 0.1 * rad)) * on;
    }
    return acc * gain;
}

// The street at p (H): bl blurs the lights, fp is the pixel footprint (H).
// Call cityBegin() first.
vec3 city(vec2 p, float bl, float fp)
{
    float e = max(0.6 * bl, fp);
    float sy = clamp((p.y - HORIZON) / (1.0 - HORIZON), 0.0, 1.0);
    vec3 dayS = mix(vec3(0.62, 0.64, 0.67), vec3(0.45, 0.48, 0.53), sy);
    vec3 nightS = mix(vec3(0.17, 0.11, 0.085), vec3(0.05, 0.05, 0.075), pow(sy, 0.7));
    nightS += vec3(0.12, 0.06, 0.025) * exp(-max(p.y - HORIZON, 0.0) / 0.1);
    vec3 col = mix(dayS, nightS, cNight);
    col *= 0.85 + 0.3 * vnoise2(p * vec2(1.3, 3.0) + 3.0);

    float tf = towers(p, 0.05, 0.42, 0.44, 1.0, 3.0, e);
    col = mix(col, mix(vec3(0.36, 0.39, 0.44), vec3(0.035, 0.04, 0.06), cNight), tf);
    float tn = towers(p, 0.13, 0.30, 0.62, 0.55, 11.0, e);
    col = mix(col, mix(vec3(0.26, 0.28, 0.32), vec3(0.016, 0.019, 0.03), cNight), tn);
    float road = 1.0 - smoothstep(HORIZON - e, HORIZON + e, p.y);
    col = mix(col, mix(vec3(0.25, 0.26, 0.28), vec3(0.04, 0.038, 0.045), cNight), road);

    col += litWindows(p, false, bl, fp);
    col += litWindows(p, true, bl, fp);
    col += streetLamps(p, bl, fp);
    col += traffic(p, bl, fp);
    col += signs(p, bl, fp);

    col += vec3(0.5, 0.55, 0.72) * cFlash * (0.12 + 0.5 * sy) * (1.0 - 0.8 * max(tf, tn)) * (1.0 - road);
    return col;
}

// Light scattered by fog from the street behind: the city with no detail.
vec3 cityDiffuse(vec2 p)
{
    float glow = exp(-abs(p.y - HORIZON - 0.08) / 0.22);
    vec3 night = vec3(0.03, 0.035, 0.05) + vec3(0.22, 0.12, 0.05) * glow * (0.5 + 0.5 * WARMTH);
    vec3 day = mix(vec3(0.60, 0.62, 0.64), vec3(0.50, 0.52, 0.55), smoothstep(0.2, 1.0, p.y));
    return mix(day, night, cNight) + vec3(0.4, 0.45, 0.6) * cFlash * 0.4 * smoothstep(0.2, 1.0, p.y);
}
