// Orbits — constants, Buffer A layout and helpers shared by every pass.
//
// Lengths are in H units: pixels / iResolution.y of the running pass, so y
// spans 0 (bottom) .. 1 (top) and x spans 0 .. aspect. The buffer grid keeps
// the screen aspect to within one texel; the image pass rescales Buffer A x
// coordinates by gRatio. Velocities are H/s, gravitational parameters GM are
// H^3/s^2, times seconds. Pixel inputs (iMouse, iWindowRects,
// iWindowVelocities) arrive in each pass's own pixels.
//
// Buffer A: one texel per record in the bottom-left MAXB x 9 corner; every
// other texel is unused. Zero is "never written".
//   (i, ROW_P)  body i: xy position, zw velocity; FAR when the slot is free
//   (i, ROW_Q)  body i: x GM, y age (s), z code = kind + 4 hue + 32 fade-in,
//               w state: 0 free, 1 alive, 2 + f fading out (f 0..1)
//   (i, ROW_T)  body i: xy position at the start of this frame, z trail
//               intensity (0 none), w trail colour key: hue index, or speed
//               (H/s) when trails are coloured by speed
//   (i, ROW_E)  burst left by the last collision of slot i: xy position,
//               z age (s), w 1 + kind + 4 hue (0 none)
//   (i, ROW_F)  burst i: xy drift (H/s), z energy (about 0.2 .. 1.5),
//               w direction of the spray (rad)
//   (k, ROW_G)  globals:
//      k = 0  x 1 while a launch is aimed, y 1 while a button was held last
//             step, z seconds since the press (capped), w 1 once initialised
//      k = 1  xy press origin, zw smoothed cursor (parallax)
//      k = 2  x seconds until the next ambient spawn, y spawns so far,
//             z central star 0..1, w animation clock (s, wraps at LOOP)
//      k = 3  x seconds since load (capped), y launches so far
//   (k, ROW_V)  aim preview dot k: xy position, z alpha, w 1 dot / 2 impact
//   (k, ROW_R)  cull row: bodies 4k .. 4k + 3 in x, y, z, w, each a position
//               packed by packPos (0 = free), one step behind ROW_P
//   (k, ROW_S)  cull row: bursts 4k .. 4k + 3, packed positions of the
//               bursts still alive (0 = none), one step behind ROW_E
//
// Buffer B: trail light, rgb, accumulated and decayed once per frame.
//
// GRAVITY, TRAIL_SECONDS, MAX_BODIES, ASTEROIDS, CENTRAL_STAR,
// TRAILS_BY_SPEED, LAUNCH_POWER and BODY_SIZE are @shared tweaks of
// orbits.frag.

const int MAXB  = 64;     // body slots; MAX_BODIES <= MAXB
const int NPREV = 48;     // aim preview dots
const int ROW_P = 0;
const int ROW_Q = 1;
const int ROW_T = 2;
const int ROW_E = 3;
const int ROW_F = 4;
const int ROW_G = 5;
const int ROW_V = 6;
const int ROW_R = 7;
const int ROW_S = 8;

const int K_ROCK   = 0;   // ambient asteroid
const int K_MOON   = 1;   // moon: initial, condensed or plain click
const int K_PLANET = 2;   // slingshot launch

const int B_SHATTER = 0;  // hit a window edge
const int B_MERGE   = 1;  // absorbed by a heavier body
const int B_BURN    = 2;  // fell into the star

const vec2  FAR        = vec2(-9.0);
const float LOOP       = 3600.0;  // s per turn of the animation clock
const float PANEL      = 0.065;   // bottom band left to the Plasma panel, H
const float CULL       = 0.45;    // bodies this far outside the screen are dropped, H
const float WIN_G      = 0.13;    // window GM per H^2 of area
const float AREA_MIN   = 0.03;    // H^2
const float AREA_MAX   = 0.40;    // H^2
const float CORE       = 0.4;     // elongation of a window's mass core, 0 point .. 1 full
const float STAR_GM    = 0.035;
const float STAR_R     = 0.042;   // H
const float GM_ROCK    = 0.00012;
const float GM_MOON    = 0.0003;
const float GM_PLANET  = 0.0006;
const float GM_MAX     = 0.003;
const float R_MOON     = 0.0045;  // radius of a body of GM_MOON, H
const float BODY_SOFT  = 0.012;   // body-body softening, H
const float BURST_LIFE = 1.8;     // s
const float FADE_IN    = 1.2;     // s, condensing bodies
const float FADE_OUT   = 1.5;     // s, bodies retired by the cap
const float CLICK_DRAG = 0.014;   // drags shorter than this are plain clicks, H
const float LAUNCH_K   = 2.6;     // launch speed per H of pull, 1/s
const float LAUNCH_MAX = 1.6;     // H/s
const float DOT_DT     = 0.075;   // s between aim preview dots

const float PI  = 3.14159265;
const float TAU = 6.28318531;

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

// ------------------------------------------------------------- packing

// Position in H units, x in [-1, 7), y in [-1, 2), as a 24-bit integer
// stored exactly in a float: 12 bits of x (1/512 H), 12 bits of y
// (3/4096 H). 0 decodes off screen.
float packPos(vec2 p)
{
    vec2 q = clamp((p + 1.0) * vec2(512.0, 4096.0 / 3.0), vec2(0.0), vec2(4095.0));
    return float(int(q.x + 0.5) * 4096 + int(q.y + 0.5));
}

vec2 unpackPos(float f)
{
    int v = int(f + 0.5);
    return vec2(float(v >> 12) / 512.0, float(v & 4095) * (3.0 / 4096.0)) - 1.0;
}

// ------------------------------------------------------------- bodies

int kindOf(float code) { return int(code + 0.5) & 3; }
int hueOf(float code) { return (int(code + 0.5) >> 2) & 7; }
bool condensing(float code) { return (int(code + 0.5) & 32) != 0; }
float packCode(int kind, int hue, bool fadeIn) { return float(kind + 4 * hue + (fadeIn ? 32 : 0)); }

float radiusOf(float gm) { return R_MOON * BODY_SIZE * pow(max(gm, 1e-6) / GM_MOON, 0.3333); }

// Body palette, six hues.
vec3 hueColour(int h)
{
    if (h == 0) return vec3(0.45, 0.80, 1.00);
    if (h == 1) return vec3(1.00, 0.78, 0.38);
    if (h == 2) return vec3(1.00, 0.46, 0.62);
    if (h == 3) return vec3(0.48, 1.00, 0.70);
    if (h == 4) return vec3(0.72, 0.56, 1.00);
    return vec3(1.00, 0.56, 0.36);
}

const vec3 ROCK_COLOUR = vec3(0.80, 0.70, 0.60);

vec3 bodyColour(float code)
{
    return kindOf(code) == K_ROCK ? ROCK_COLOUR : hueColour(hueOf(code));
}

// Trail ramp by speed: violet at 0.08 H/s, cyan, warm white, orange at
// 0.63 H/s and above.
vec3 speedColour(float v)
{
    float t = clamp((v - 0.08) / 0.55, 0.0, 1.0);
    vec3 a = vec3(0.42, 0.36, 1.00);
    vec3 b = vec3(0.30, 0.85, 1.00);
    vec3 c = vec3(1.00, 0.95, 0.82);
    vec3 d = vec3(1.00, 0.52, 0.22);
    if (t < 0.33) return mix(a, b, t / 0.33);
    if (t < 0.66) return mix(b, c, (t - 0.33) / 0.33);
    return mix(c, d, (t - 0.66) / 0.34);
}

vec3 trailColour(float key)
{
    if (TRAILS_BY_SPEED) return speedColour(key);
    if (key > 6.5) return ROCK_COLOUR;
    return hueColour(int(key + 0.5));
}

// ------------------------------------------------------------- windows

float aspectNow() { return iResolution.x / iResolution.y; }
vec2 starPos() { return vec2(0.5 * aspectNow(), 0.5); }

bool windowOk(vec4 r) { return r.z >= 0.01 && r.w >= 0.01; }

// Window i in H units as (x, y, w, h).
vec4 winNow(int i) { return iWindowRects[i] / iResolution.y; }

// Window i at fraction f of this frame, between the previous frame's rect
// and the current one. A previous rect of another size belongs to another
// window (the list changed) and is ignored.
vec4 winAt(int i, float f)
{
    vec4 c = iWindowRects[i];
    vec4 p = iWindowRectsPrev[i];
    if (p.z < 1.0 || p.w < 1.0 || abs(p.z - c.z) + abs(p.w - c.w) > 0.05 * iResolution.y) p = c;
    return mix(p, c, f) / iResolution.y;
}

int windowsValid()
{
    int n = 0;
    for (int i = 0; i < iWindowCount && i < 16; i++)
        if (windowOk(winNow(i))) n++;
    return n;
}

float winGM(vec4 r) { return GRAVITY * WIN_G * clamp(r.z * r.w, AREA_MIN, AREA_MAX); }

float sdBox(vec2 q, vec2 b)
{
    vec2 d = abs(q) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Offset of p from the closest point of window r's mass core, and the
// softening length. The core is the rect shrunk by its smaller half size,
// scaled by CORE: a point for a square window, a short bar for a wide one.
vec2 coreOffset(vec2 p, vec4 r, out float soft)
{
    vec2 hs = 0.5 * r.zw;
    float m = min(hs.x, hs.y);
    vec2 core = (hs - m) * CORE;
    vec2 q = p - r.xy - hs;
    soft = 0.3 * m;
    return q - clamp(q, -core, core);
}

// Acceleration from window r: gradient of -GM / sqrt(d^2 + soft^2), d the
// distance to the core.
vec2 wellAccel(vec2 p, vec4 r)
{
    float s;
    vec2 dv = coreOffset(p, r, s);
    float d2 = dot(dv, dv) + s * s;
    return -winGM(r) * dv / (d2 * sqrt(d2));
}

vec2 starAccel(vec2 p, float star)
{
    vec2 dv = p - starPos();
    float d2 = dot(dv, dv) + 0.0004;
    return -GRAVITY * STAR_GM * star * dv / (d2 * sqrt(d2));
}

// Field of the windows (at frame fraction f) and the star.
vec2 fieldAt(vec2 p, float f, float star)
{
    vec2 a = star > 0.0 ? starAccel(p, star) : vec2(0.0);
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = winAt(i, f);
        if (windowOk(r)) a += wellAccel(p, r);
    }
    return a;
}

// Velocity of a counter-clockwise circular orbit through p around the
// strongest single attractor, in the total field. Zero without one.
vec2 orbitVelocity(vec2 p, float star)
{
    vec2 c = vec2(0.0);
    float best = 0.0;
    if (star > 0.0) {
        best = length(starAccel(p, star));
        c = starPos();
    }
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = winNow(i);
        if (!windowOk(r)) continue;
        float a = length(wellAccel(p, r));
        if (a > best) {
            best = a;
            c = r.xy + 0.5 * r.zw;
        }
    }
    if (best <= 0.0) return vec2(0.0);
    vec2 rv = p - c;
    float d = max(length(rv), 1e-4);
    float ar = max(dot(fieldAt(p, 1.0, star), -rv / d), 0.0);
    return vec2(-rv.y, rv.x) / d * sqrt(ar * d);
}

// Index of the window whose rect (at fraction f, grown by margin) contains p,
// else -1.
int windowHit(vec2 p, float f, float margin)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = winAt(i, f);
        if (!windowOk(r)) continue;
        if (sdBox(p - r.xy - 0.5 * r.zw, 0.5 * r.zw) < margin) return i;
    }
    return -1;
}

// ------------------------------------------------------------- bursts

int burstKind(float w) { return (int(w + 0.5) - 1) & 3; }
int burstHue(float w) { return ((int(w + 0.5) - 1) >> 2) & 7; }

const int   SPARKS = 14;
const float SPARK_DRAG = 2.4;     // 1/s

// Spark k of burst (E, F) at age t: offset from the burst centre (H), and
// its brightness 0..1 in w. Shatter sprays a half-cone along F.w, the other
// kinds a full circle.
vec3 sparkAt(vec4 E, vec4 F, int k, float t)
{
    uint h = hashu(floatBitsToUint(E.x) * 747796405u ^ floatBitsToUint(E.y) * 2891336453u ^ uint(k) * 0x9e3779b9u);
    int kind = burstKind(E.w);
    float spread = kind == B_SHATTER ? 2.7 : (kind == B_BURN ? 3.2 : TAU);
    float ang = F.w + (hashf(h) - 0.5) * spread;
    float r1 = hashf(h ^ 0x68e31da4u);
    float spd = F.z * (0.05 + 0.26 * r1 * r1);
    float life = 0.45 + 1.15 * hashf(h ^ 0xb5297a4du);
    vec2 v = vec2(cos(ang), sin(ang)) * spd + F.xy;
    vec2 off = v * (1.0 - exp(-SPARK_DRAG * t)) / SPARK_DRAG;
    float b = clamp(1.0 - t / life, 0.0, 1.0);
    return vec3(off, b * b);
}

vec3 burstColour(float w)
{
    int kind = burstKind(w);
    if (kind == B_BURN) return vec3(1.0, 0.62, 0.28);
    int hue = burstHue(w);
    return hue > 6 ? ROCK_COLOUR : hueColour(hue);
}
