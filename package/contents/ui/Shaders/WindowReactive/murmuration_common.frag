// Murmuration — constants, state layout and helpers shared by every pass.
//
// World units: U = min(width, height) pixels of the running pass, so every
// pass (the buffers run on a smaller grid of the same aspect) agrees on
// positions. The screen spans worldSize() = iResolution.xy / U, origin
// bottom-left, y up. z is depth in the same units: 0 is the perch plane
// (window tops), the flock flies around Z_FLOCK. The projection is
// orthographic; depth sets only the drawn size (depthScale) and the haze.
//
// Buffer A: a record of 5 texels per bird, 12 birds per row from row 1;
// row 0 holds the globals. A texel of zeros is "never written".
//   (5 (i % 12) + k, 1 + i / 12)  bird i:
//   k = 0  xyz position; w = mode + 8 * window + alarm phase (fraction)
//   k = 1  xyz velocity (units/s); w wing phase (cycles, wraps at 1)
//   k = 2  the 8 nearest flying birds in 3D, nearest first: id + 1 packed
//          in pairs, a * 4096 + b (0 = none); the first 7 steer the bird
//   k = 3  x seconds in the current mode (capped), y action timer (s),
//          z bank angle (rad), w facing (+-1) * (1 + perch action)
//   k = 4  LAND/PERCH: x window left edge, y window top edge, z perch
//          offset from the left edge, w hop length, or the length (s) of
//          the current look or preen
//          LEAVE: xy exit point, z 1 into the reeds, 0 off screen
//   (0, 0)  x 1 once initialised, y animation clock (s, wraps at CLOCK_WRAP),
//           z button held last step, w seconds to the next wild falcon
//   (1, 0)  falcon: xy aim point, z seconds since the stoop began
//           (< 0 none), w dive direction (+-1)
//   (2, 0)  cursor: xy position, z smoothed speed (units/s),
//           w alarm strength 0..1
//   (3, 0)  flock centroid: xyz, w share of sampled birds in the flock
//           (0 = none, centroid stale)
//   (4, 0)  falcon: xy the point it swoops through after the aim point
//
// Buffer B: one texel per grid cell, ids + 1 of the four birds whose drawn
// shapes reach closest to the cell centre, nearest first.
//
// Buffer C: one texel per grid cell, the density of the flying flock
// (layout in its file).
//
// BIRDS, COHESION, BIRD_SIZE, PERCHING, FOLLOW_CLOCK, FIXED_HOUR and
// WILD_FALCON are @shared tweaks of murmuration.frag.

const int MAX_BIRDS  = 4095;   // ids + 1 fit 12 bits, two per float
const int BIRD_COLS  = 12;
const int REC        = 5;

const int M_NONE   = 0;
const int M_HIDDEN = 1;        // roosting in the reeds or away
const int M_FLY    = 2;        // in the flock
const int M_LAND   = 3;        // approaching a perch on a window top
const int M_PERCH  = 4;
const int M_LEAVE  = 5;        // flying out of view

const int ACT_IDLE  = 0;
const int ACT_LOOK  = 1;
const int ACT_PREEN = 2;
const int ACT_HOP   = 3;
const int ACT_SWAP  = 4;

const float Z_FLOCK    = 3.0;     // flock depth
const float DEPTH_K    = 1.25;    // drawn size = 1 / (1 + DEPTH_K z)
const float HORIZON    = 0.165;   // far shore, fraction of the screen height
const float REED_TOP   = 0.085;   // reed bed, fraction of the screen height
const float CLOCK_WRAP = 3600.0;
const float STOOP_TIME = 2.9;     // s
const float ALARM_TIME = 1.1;     // s, one alarm cycle: excited, then refractory
const float ALARM_EXC  = 0.22;    // alarm phase below which a bird is excited
const float ALARM_LAG  = 0.018;   // alarm phase a neighbour must reach to pass it on
const float DAY_SHARE  = 0.38;    // share of the flock out by day
const float HAZE       = 0.75;    // haze opacity per bird per wingspan^2 above HAZE_MIN
const float HAZE_MIN   = 0.5;     // birds per wingspan^2 drawn as birds alone
const float AERIAL     = 0.06;    // blend toward the sky per unit of depth

const float PI  = 3.14159265;
const float TAU = 6.28318531;

// Perched bird height and flying wingspan at z = 0, world units.
float perchLen() { return 0.0165 * BIRD_SIZE; }
float flySpan() { return 0.0275 * BIRD_SIZE; }
float depthScale(float z) { return 1.0 / (1.0 + DEPTH_K * max(z, 0.0)); }

// ------------------------------------------------------------- random

uint hashu(uint x)
{
    // lowbias32 (Chris Wellons, "Hash Prospector").
    x ^= x >> 16;
    x *= 0x7feb352du;
    x ^= x >> 15;
    x *= 0x846ca68bu;
    x ^= x >> 16;
    return x;
}

float hashf(uint x) { return float(hashu(x) >> 8) * (1.0 / 16777216.0); }

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// ------------------------------------------------------------- stepping

// Buffers A and B step on every fourth substep counting back from the
// last and copy themselves on the others: one step per frame at 60 Hz and
// above, two at 30 Hz, so a step never covers more than 1/60 s and a bird
// never outruns the one-cell-per-step tracking of Buffer B.
bool simStep() { return (iSubsteps - 1 - iSubstep) % 4 == 0; }

// Seconds simulated by this step (iTimeDelta is one substep's share),
// capped so a stalled frame cannot fling a bird across the screen.
float simDt() { return min(float(min(iSubstep + 1, 4)) * iTimeDelta, 1.0 / 30.0); }

// ------------------------------------------------------------- layout

float unitPx() { return min(iResolution.x, iResolution.y); }
vec2 worldSize() { return iResolution.xy / unitPx(); }

ivec2 birdTexel(int i, int k) { return ivec2(REC * (i % BIRD_COLS) + k, 1 + i / BIRD_COLS); }

// Birds that fit the buffer grid of `rows` rows.
int birdCount(float rows)
{
    int cap = BIRD_COLS * (int(rows) - 1);
    return clamp(min(BIRDS, cap), 1, MAX_BIRDS);
}

int modeOf(float code) { return int(code) & 7; }
int winOf(float code) { return int(code) >> 3; }
float alarmOf(float code) { return fract(code); }
float packCode(int mode, int win, float alarm)
{
    return float(mode + 8 * win) + min(alarm, 0.999);
}

// Centre and reach of a bird's drawn shape, world units.
vec2 birdCentre(vec4 s0)
{
    return modeOf(s0.w) == M_PERCH ? s0.xy + vec2(0.0, 0.45 * perchLen()) : s0.xy;
}

float birdReach(vec4 s0)
{
    int m = modeOf(s0.w);
    if (m == M_PERCH) return 0.62 * perchLen();
    return 0.55 * flySpan() * depthScale(s0.z);
}

// ------------------------------------------------------------- windows

bool windowValid(int i)
{
    vec4 r = iWindowRects[i];
    return r.z >= 1.0 && r.w >= 1.0;
}

// Window i in world units: x left, y top, z width, w bottom.
vec4 windowTop(int i)
{
    vec4 r = iWindowRects[i] / unitPx();
    return vec4(r.x, r.y + r.w, r.z, r.y);
}

bool insideAnyWindow(vec2 p)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i] / unitPx();
        if (r.z < 0.001 || r.w < 0.001) continue;
        if (p.x >= r.x && p.y >= r.y && p.x <= r.x + r.z && p.y <= r.y + r.w) return true;
    }
    return false;
}

// ------------------------------------------------------------- time of day

float clockHour() { return FOLLOW_CLOCK ? mod(iDate.w / 3600.0, 24.0) : FIXED_HOUR; }

// Sunset 18.6 h at the equinoxes, +-1.2 h with the season (northern mid
// latitudes on summer time); a fixed hour uses the equinox.
float sunsetHour()
{
    if (!FOLLOW_CLOCK) return 18.6;
    float doy = (iDate.y - 1.0) * 30.44 + iDate.z;
    return 18.6 + 1.2 * sin(TAU * (doy - 81.0) / 365.25);
}

float sunriseHour() { return 25.6 - sunsetHour(); }

// Hours from event e to h, wrapped into [-12, 12).
float hoursFrom(float h, float e) { return mod(h - e + 12.0, 24.0) - 12.0; }

// x share of the flock in the sky, y show (0 loose day flock .. 1 tight
// sunset display), z night 0..1, w sun height in hours above the horizon
// (negative below). The morning runs from the middle of the night to noon.
vec4 dayCycle()
{
    float h = clockHour();
    float ss = sunsetHour();
    float sr = sunriseHour();
    float tau = hoursFrom(h, ss);
    float del = hoursFrom(h, sr);
    bool morning = hoursFrom(h, 0.5 * (sr + ss)) < 0.0;
    if (morning) {
        float share = smoothstep(-0.55, -0.1, del) * mix(0.55, DAY_SHARE, smoothstep(0.2, 1.4, del));
        float night = 1.0 - smoothstep(-0.9, -0.3, del);
        return vec4(share, 0.2, night, del);
    }
    float show = smoothstep(-1.6, -0.5, tau);
    float roost = smoothstep(0.25, 0.85, tau);
    float share = mix(DAY_SHARE, 1.0, show) * (1.0 - roost);
    float night = smoothstep(0.45, 1.1, tau);
    return vec4(share, show * (1.0 - 0.5 * roost), night, -tau);
}

// True while birds go down into the reeds rather than off screen.
bool roostingTime()
{
    float tau = hoursFrom(clockHour(), sunsetHour());
    return tau > 0.0 && tau < 6.0;
}

// True while birds come up out of the reeds rather than in from the sides.
bool dawnTime()
{
    float del = hoursFrom(clockHour(), sunriseHour());
    return del > -1.0 && del < 0.8;
}

// ------------------------------------------------------------- flock

// Where the flock is drawn to: wanders over the reed bed, lower at dusk.
// t is seconds since midnight; every rate is a whole number of turns per
// day, so the path is continuous across midnight.
vec3 roostTarget(vec2 ws, vec4 dc, float t)
{
    const float W = TAU / 86400.0;
    float ax = max(0.27 * ws.x - 0.06, 0.08);
    float x = 0.5 * ws.x + ax * (0.7 * sin(t * W * 1234.0) + 0.3 * sin(t * W * 1838.0 + 2.0));
    float hi = mix(0.62, 0.55, dc.y);
    hi = mix(hi, 0.30, (1.0 - smoothstep(0.0, 0.4, dc.x)) * step(dc.w, 0.5));
    float y = ws.y * (hi + 0.12 * sin(t * W * 765.0 + 1.0) + 0.05 * sin(t * W * 2087.0));
    float z = Z_FLOCK + 0.3 * sin(t * W * 949.0);
    return vec3(x, y, z);
}

// ------------------------------------------------------------- falcon

// Falcon stoop t seconds after it began, aimed at a, then at the flock at
// c: three quadratic Beziers with continuous tangents. It falls from above
// the screen top in direction dir (+1 toward +x) through a, swoops down
// and up through c, and climbs out over the top.
vec2 bez(vec2 p0, vec2 p1, vec2 p2, float u) { return mix(mix(p0, p1, u), mix(p1, p2, u), u); }

vec2 stoopPos(float t, vec2 a, vec2 c, float dir, vec2 ws)
{
    vec2 d = normalize(vec2(0.42 * dir, -1.0));
    vec2 p0 = a + vec2(-0.5 * dir, max(ws.y - a.y + 0.12, 0.45));
    vec2 q1 = a - d * 0.38;
    vec2 q2 = a + d * 0.32;
    vec2 q3 = c + normalize(c - q2 + 1e-5) * 0.3;
    vec2 e = c + vec2(0.9 * dir, max(ws.y - c.y + 0.2, 0.5));
    const float T1 = 0.8;
    const float T2 = 1.55;
    if (t < T1) return bez(p0, q1, a, pow(clamp(t / T1, 0.0, 1.0), 1.4));
    if (t < T2) return bez(a, q2, c, (t - T1) / (T2 - T1));
    float u = clamp((t - T2) / (STOOP_TIME - T2), 0.0, 1.0);
    return bez(c, q3, e, u * (2.0 - u) * 0.85 + 0.15 * u);
}
