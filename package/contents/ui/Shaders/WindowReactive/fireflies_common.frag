// Fireflies — constants, state layout and helpers shared by every pass.
//
// Lengths are in H units: fractions of the pass's own target height. The
// world spans x in [0, aspect], y in [0, 1], GL origin bottom-left. The
// buffers run on a reduced grid of the same aspect; pixel inputs (iMouse,
// iWindowRects) arrive in each pass's own pixels, so dividing them by
// iResolution.y gives H units in every pass. The grid's aspect differs only
// when the engine widens a narrow grid to 64 texels; the image pass then
// rescales x. Times are in seconds, flash phases in cycles [0, 1),
// headings in radians counter-clockwise from +x.
//
// Buffer A: one record of two texels per firefly slot, plus globals. A
// record of zeros is an absent firefly.
//   (2(i % 32),     i / 32)  xy position, z flash phase,
//                            w layer + 4 mode + 0.999 visibility
//                            (layer 0 far, 1 mid, 2 near; mode 0 absent,
//                            1 flying, 2 perched on a window edge)
//   (2(i % 32) + 1, i / 32)  xy velocity (H/s),
//                            z extras: seconds of life left; base swarm:
//                              seconds until it may perch again
//                            w flying: wander heading; perched:
//                              100 edge + seconds left on the perch
//                              (edge 0 top, 1 left, 2 right)
//   (0, GLOBAL_ROW)  x clock (s, wraps at CLOCK_WRAP), y seconds since the
//                    cursor last moved (capped), z lantern strength 0..1,
//                    w 1 once initialised
//   (1, GLOBAL_ROW)  xy smoothed cursor velocity (H/s), z 1 while a button
//                    was held last step, w jar ring position (extra slots)
//   (2, GLOBAL_ROW)  xy last jar position (H), z seconds since it opened
//                    (capped), w seconds since load (capped)
// Slots [0, baseCount) are the resident swarm; the EXTRA_SLOTS after it are
// a ring that jars release into, JAR_SIZE at a time.
//
// Buffer B: firefly bins. Bin (x, y) is the square [x, x+1] x [y, y+1] /
// BINS_PER_H in the lower-left corner; it lists the ids + 1 of up to eight
// fireflies whose glow reaches it, two per channel (a * 2048 + b, a first),
// filled from the first channel on, 0 = none.
//
// Buffer C: light fields sampled at the bin centres (layout in its file).

const int   MAX_FLIES   = 1024;
const int   FLY_COLS    = 32;      // records per row of Buffer A
const int   GLOBAL_ROW  = 33;
const int   EXTRA_SLOTS = 160;
const int   JAR_SIZE    = 40;
const float BINS_PER_H  = 40.0;
const float CLOCK_WRAP  = 3600.0;
const float PERCH_GAP   = 0.003;   // H from a window edge to a perched firefly's centre
const float PHASE_TAU   = 0.25;    // s, time constant of the phase field (Buffer C)

const int LAYER_FAR  = 0;
const int LAYER_MID  = 1;
const int LAYER_NEAR = 2;

const int MODE_ABSENT = 0;
const int MODE_FLY    = 1;
const int MODE_PERCH  = 2;

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

// Fixed per-firefly random number k.
float flyRand(int i, int k) { return hashf(uint(i) * 0x9E3779B9u + uint(k) * 0x85EBCA6Bu + 17u); }

// Cheap fixed per-firefly numbers for the gather loops: additive
// recurrences on the plastic and golden ratios, equidistributed over ids.
float flyR1(int i) { return fract(float(i) * 0.7548776662 + 0.31); }
float flyR2(int i) { return fract(float(i) * 0.6180339887 + 0.17); }

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// ------------------------------------------------------------- records

ivec2 flyTexel(int i, int k) { return ivec2(2 * (i % FLY_COLS) + k, i / FLY_COLS); }

int layerOf(float code) { return int(code) & 3; }
int modeOf(float code) { return int(code) >> 2; }
float visOf(float code) { return clamp(fract(code) / 0.999, 0.0, 1.0); }
float packCode(int layer, int mode, float vis) { return float(layer + 4 * mode) + 0.999 * clamp(vis, 0.0, 1.0); }

// Resident swarm size: FIREFLIES on a 16:9 screen, scaled with the width.
int baseCount(float aspect)
{
    float n = float(FIREFLIES) * clamp(aspect / 1.7778, 0.6, 2.0);
    return int(clamp(n, 8.0, float(MAX_FLIES - EXTRA_SLOTS)));
}

int slotCount(float aspect) { return baseCount(aspect) + EXTRA_SLOTS; }

int binCols(float aspect) { return int(ceil(aspect * BINS_PER_H)); }

// ------------------------------------------------------------- flashes

// Flash intensity 0..1 at phase ph: a 50 ms rise and a 200 ms fall at the
// nominal 2.8 s period. Three in ten fireflies add a weaker second blink.
float flashOf(float ph, int i)
{
    float f = smoothstep(0.0, 0.018, ph) * exp(-max(ph - 0.018, 0.0) / 0.055);
    if (flyR1(i) < 0.3) {
        float q = ph - 0.13;
        f = max(f, 0.65 * smoothstep(0.0, 0.018, q) * exp(-max(q - 0.018, 0.0) / 0.045));
    }
    return f;
}

// Relative light of each depth layer in the flash field.
float layerGain(int layer) { return layer == LAYER_FAR ? 0.45 : (layer == LAYER_MID ? 1.0 : 0.8); }

// Per-firefly size factor.
float flySize(int i) { return 0.8 + 0.45 * flyR2(i); }

// Seconds since firefly i left the newest jar, 1e3 if it is not one of
// its fireflies. g1, g2 are the globals (1, GLOBAL_ROW), (2, GLOBAL_ROW).
float jarAge(int i, int base, vec4 g1, vec4 g2)
{
    if (i < base || g2.z > 100.0) return 1e3;
    int k = (i - base - int(g1.w + 0.5) + JAR_SIZE + 2 * EXTRA_SLOTS) % EXTRA_SLOTS;
    return k < JAR_SIZE ? g2.z : 1e3;
}

// 1 for a firefly fresh out of a jar, fading to 0 at 2.5 s: it shows as a
// tight twinkling spark.
float sparkOf(float age) { return 1.0 - smoothstep(0.8, 2.5, age); }

// Radius (H) beyond which a firefly's glow is negligible: 2.6 halo sigmas
// while it flashes; between flashes far and mid fireflies show little more
// than their core, and so do sparks.
float glowReach(int layer, int i, float flash, float spark)
{
    float s = flySize(i) * GLOW_SIZE * (1.0 - 0.6 * spark);
    float lit = smoothstep(0.0, 0.05, flash);
    if (layer == LAYER_FAR) return 0.014 * s * mix(0.6, 1.0, lit);
    if (layer == LAYER_MID) return 0.033 * s * mix(0.55, 1.0, lit);
    return 0.055 * s;
}

// ------------------------------------------------------------- stepping

// Buffers simulate once per frame, on the last substep, and copy
// themselves on the others.
bool simStep() { return iSubstep == iSubsteps - 1; }

// Seconds simulated by this frame's step, capped after a stall.
float simDt() { return min(iTimeDelta * float(iSubsteps), 0.05); }
