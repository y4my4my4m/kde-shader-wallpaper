// Snowdrift — tweaks, state layout and helpers shared by Buffer A and the
// image pass.
//
// Buffer A runs on a grid of at most 200 rows (@sim-max-height in
// snowdrift.frag) with the screen's aspect. A grid px is square; G below is
// the grid height in rows. Lengths in Buffer A are grid px, heights of snow
// are grid px above the surface they rest on. U is the screen's shorter
// side; snow, flakes and speeds scale with it, so portrait screens get the
// same snow as landscape ones.
//
// Buffer A layout (texel coordinates):
//   (c, ROW_GROUND)     ground pile, column c: x snow height, y wetness 0..1,
//                       w 1 once written
//   (j, ROW_PILE + i)   pile on window i, sample j counted from the window's
//                       left edge (one sample per grid column): same layout
//   (i, ROW_SLOT)       slot i: rect (x, y, w, h) of window i last step,
//                       grid px; w = 0 for no window
//   (16 + i, ROW_SLOT)  slot i: smoothed window velocity xy, grid px/s
//   (k, ROW_CLUMP)      clump k: position xy (centre of mass), velocity zw
//   (k, ROW_CLUMP + 1)  clump k: x mass (grid px^2), y width (grid px),
//                       z age (s), w state + 4 * (source window + 1);
//                       state 0 free, 1 falling, 2 powder puff
//   (0, ROW_GLOBAL)     x seconds since reset (capped), y 1 while a button
//                       was held last step, z clock mod CLOCK_PERIOD, w 1
//   (1..3, ROW_GLOBAL)  flake layers in pairs (xy layer 2n, zw layer 2n+1):
//                       fall offset in cells mod 256, drift at unit wind in
//                       cells mod 16384
//   (4..7, ROW_GLOBAL)  click puffs: position xy (grid px), age (s), w 1
//   (8, ROW_GLOBAL)     x clicks so far mod 4, y 1 while any clump falls,
//                       z wind gust 0..1, w bit c set while click c shows
//   (9, ROW_GLOBAL)     clumps in use as bit masks: bit k % 16 of component
//                       k / 16 (one step behind the clump rows)
// Clump k belongs to segment k % NSEG of slot k / NSEG: a window's pile is
// cut into NSEG segments that slide off independently.

// SNOW_RATE (x ACCUM in Buffer A), DRIFT_HEIGHT (U, scale of the ground
// drift cap) and MELT_RADIUS (U) are @shared tweaks of snowdrift.frag.

const int ROW_GROUND = 0;
const int ROW_PILE   = 1;
const int ROW_SLOT   = 17;
const int ROW_CLUMP  = 18;
const int ROW_GLOBAL = 20;
const int NSLOT  = 16;
const int NSEG   = 4;
const int NCLUMP = 64;
const int NCLICK = 4;
const int NLAYER = 5;

const float CLOCK_PERIOD = 600.0;  // s; periodic animation uses multiples of 1/600 Hz
const float WINDOW_SHARE = 0.42;   // window pile cap / ground cap
const float PUFF_TIME    = 1.6;    // s a powder puff lasts
const float CLICK_TIME   = 4.5;    // s a click burst lasts
const float TAU = 6.28318531;

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

vec2 hash22(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
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

// Flake layer l, far to near: cell size (U), fall speed (U/s), drift at
// unit wind (U/s).
vec3 flakeLayer(int l)
{
    if (l == 0) return vec3(0.016, 0.026, 0.030);
    if (l == 1) return vec3(0.025, 0.040, 0.048);
    if (l == 2) return vec3(0.040, 0.058, 0.070);
    if (l == 3) return vec3(0.066, 0.085, 0.105);
    return vec3(0.120, 0.125, 0.160);
}

// Wind gust 0..1 at clock t (s mod CLOCK_PERIOD); periodic in CLOCK_PERIOD.
float gustAt(float t)
{
    float w = TAU * t / CLOCK_PERIOD;
    float g = 0.45 + 0.30 * sin(w * 5.0 + 1.3) + 0.22 * sin(w * 17.0 + 0.4) + 0.12 * sin(w * 43.0 + 2.1);
    return smoothstep(0.15, 0.95, g);
}

// Ground drift cap at column x (grid px) on a grid W columns wide, G = U in
// grid px: rolling drifts, deeper in the corners.
float groundCap(float x, float G, float W)
{
    float u = x / G;
    float n = 0.6 * vnoise1(u * 1.9 + 0.7) + 0.28 * vnoise1(u * 4.7 + 3.1) + 0.12 * vnoise1(u * 10.0 + 5.3);
    float corner = exp(-min(x, W - x) / (0.15 * G));
    return DRIFT_HEIGHT * G * (0.38 + 0.75 * n * n * (3.0 - 2.0 * n)) * (1.0 + 0.5 * corner);
}

// Window pile cap at sample j (grid px from the left edge) of a window of
// size wh (grid px); G = U in grid px.
float windowCap(float j, vec2 wh, float G)
{
    float seed = fract(wh.x * 0.0137 + wh.y * 0.0291) * 97.0;
    float n = 0.7 * vnoise1(j / G * 6.0 + seed) + 0.3 * vnoise1(j / G * 15.0 + seed * 1.3);
    return DRIFT_HEIGHT * WINDOW_SHARE * G * (0.55 + 0.75 * n);
}

float unitLen() { return min(iResolution.x, iResolution.y); }

int clumpStateOf(vec4 b) { return int(mod(b.w + 0.5, 4.0)); }
int clumpSourceOf(vec4 b) { return int(floor((b.w + 0.5) / 4.0)) - 1; }
float clumpThickness(vec4 b) { return b.x / max(b.y, 1.0); }

bool insideWindowRect(vec2 p)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        if (p.x >= r.x && p.y >= r.y && p.x <= r.x + r.z && p.y <= r.y + r.w) return true;
    }
    return false;
}

// Cursor usable for melting: on screen, not over a window, and not the
// fixed screen centre reported while mouse input is disabled.
bool cursorLive(vec2 m)
{
    if (m.x < 0.5 && m.y < 0.5) return false;
    if (m.x < 0.0 || m.y < 0.0 || m.x > iResolution.x || m.y > iResolution.y) return false;
    if (all(lessThan(abs(m - 0.5 * iResolution.xy), vec2(0.01)))) return false;
    return !insideWindowRect(m);
}
