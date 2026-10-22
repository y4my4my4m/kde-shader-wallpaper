// Ant Colony — constants, state layout and helpers shared by every pass.
//
// Lengths are in world units U = min(width, height) pixels of the pass's own
// target, so every pass (the buffers run on a smaller grid of the same
// aspect) and every screen shape agree on sizes. The world spans
// worldSize() = iResolution.xy / U. Times are in seconds, angles in radians,
// headings counter-clockwise from +x. Pixel inputs (iMouse, iWindowRects)
// arrive in each pass's own pixels; divide by U.
//
// Buffer A: ants, food and colony state, one texel per record; every other
// texel is unused. A record of zeros is "never written".
//   (2(i % 32) + k, i / 32)   ant i, k = 0:
//       xy  position, z heading,
//       w   mode + 4 carry + 0.999 strength: mode 0 absent, 1 in the nest,
//           2 searching, 3 returning; carry 0 none, else food kind + 1;
//           strength 0..1 of the scent it lays
//   (2(i % 32) + 1, i / 32)   ant i, k = 1:
//       x   seconds since leaving the nest (searching), since the pickup
//           (returning) or since entering (in the nest)
//       y   > 0: alarm seconds left (scattering from the cursor);
//           < 0: seconds left ignoring trails (after a dead end or in a
//           crowd)
//       z   gait phase, cycles 0..1
//       w   wander turn rate (rad/s, |w| <= 4) outside the nest; 10 + s
//           spent working at food; rest length (s) inside the nest
//   (k, PILE_ROW)       food pile k: xy position, z crumbs left, w crumbs at
//                       the start; z < 0.5 = free slot, then w < 0 is minus
//                       1 minus the seconds since the last crumb went
//   (k, PILE_ROW + 1)   food pile k: x kind, y age, z crumbs before the
//                       latest drop onto it, w seconds since that drop
//   (0, GLOBAL_ROW)     x seconds since the cursor last moved (capped),
//                       y 1 while a button was held last step,
//                       z seconds toward the next natural food item,
//                       w 1 once initialised
//   (1, GLOBAL_ROW)     x food items spawned (random stream), y seconds
//                       until the next natural item, z animation clock
//                       (s, wraps at 1000 TAU), w step counter modulo
//                       PICK_TURNS (whose turn it is to take a crumb)
//
// Buffer B: nearest-ant tracking, one texel per grid cell. Each channel
// holds an ant id + 1 (0 = none); the four ants whose bodies pass closest to
// the cell centre, nearest first.
//
// Buffer C: fields, one texel per grid cell.
//   x  "to food" scent, laid by ants carrying food home
//   y  "to home" scent, laid by searching ants
//   z  walking distance to the nest around windows, grid cells
//   w  1 once initialised

// @shared tweaks of ant_colony.frag:
//   ANTS       colony size on a 16:9 screen; scales with area, max MAX_ANTS
//   ANT_SPEED  multiplier of SPEED in Buffer A
//   FOOD_RATE  natural food: one item per 30-75 s at 1, at most 3 out;
//              0 = clicks only
//   NIGHT      1: most ants stay in the nest at night by the local clock

const int MAX_ANTS   = 1024;
const int ANT_COLS   = 32;      // ants per row of Buffer A
const int PILE_ROW   = 33;
const int NPILE      = 8;
const int GLOBAL_ROW = 36;

const int MODE_ABSENT = 0;
const int MODE_NEST   = 1;
const int MODE_SEARCH = 2;
const int MODE_RETURN = 3;

const int FOOD_CRUMBS = 0;
const int FOOD_SUGAR  = 1;
const int FOOD_BERRY  = 2;
const int FOOD_LEAF   = 3;

const float ANT_LEN    = 0.0095;  // nominal body length, U
const float NEST_HOLE  = 0.0065;  // entrance radius, U
const float MOUND_R    = 0.05;    // spoil mound radius, U
const float WIN_MARGIN = 0.0055;  // ant centres keep this far outside windows, U
const float FAR        = 1.0e4;   // walking distance of unreachable cells

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

vec2 hash22(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// ------------------------------------------------------------- stepping

// The buffers simulate once per frame, on the last substep, and copy
// themselves on the others: ants move a quarter grid cell per frame at
// 60 fps, and a full RGBA32F pass costs its bandwidth whatever it computes.
bool simStep() { return iSubstep == iSubsteps - 1; }

// Seconds simulated by this frame's step, capped so a stalled frame cannot
// carry an ant through a window.
float simDt() { return min(iTimeDelta * float(iSubsteps), 0.05); }

// ------------------------------------------------------------- world

float unitPx() { return min(iResolution.x, iResolution.y); }
vec2 worldSize() { return iResolution.xy / unitPx(); }

vec2 nestPos()
{
    vec2 ws = worldSize();
    return vec2(0.36 * ws.x, max(0.24 * ws.y, 0.13));
}

int antCount()
{
    vec2 ws = worldSize();
    float n = float(ANTS) * (ws.x * ws.y) / 1.7778;
    return int(clamp(n, 32.0, float(MAX_ANTS)));
}

// Scouts keep searching at night.
bool isScout(int i) { return (i % 12) == 5; }

ivec2 antTexel(int i, int k) { return ivec2(2 * (i % ANT_COLS) + k, i / ANT_COLS); }

int modeOf(float code) { return int(code) & 3; }
int carryOf(float code) { return int(code) >> 2; }
float strengthOf(float code) { return fract(code); }
float packCode(int mode, int carry, float strength)
{
    return float(mode + 4 * carry) + 0.999 * clamp(strength, 0.0, 1.0);
}

// Window i in world units: min corner, max corner.
vec4 windowBox(int i)
{
    vec4 r = iWindowRects[i] / unitPx();
    return vec4(r.xy, r.xy + r.zw);
}

bool windowValid(int i)
{
    vec4 r = iWindowRects[i];
    return r.z >= 1.0 && r.w >= 1.0;
}

// A window over the nest entrance is no obstacle: the ants use the nest under it.
bool coversNest(vec4 b)
{
    vec2 n = nestPos();
    return n.x > b.x && n.y > b.y && n.x < b.z && n.y < b.w;
}

// Index of the first window (grown by margin) containing p, else -1.
int windowAt(vec2 p, float margin)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!windowValid(i)) continue;
        vec4 b = windowBox(i);
        if (coversNest(b)) continue;
        if (p.x > b.x - margin && p.y > b.y - margin && p.x < b.z + margin && p.y < b.w + margin) return i;
    }
    return -1;
}

// True when pixel-space point p lies inside any window.
bool insideWindowPx(vec2 p)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        if (p.x >= r.x && p.y >= r.y && p.x <= r.x + r.z && p.y <= r.y + r.w) return true;
    }
    return false;
}

// 0 by day, 1 at night, by the local clock; dusk 19:45-21:15, dawn 5:15-6:45.
float nightAmount()
{
    float h = mod(iDate.w / 3600.0, 24.0);
    return smoothstep(19.75, 21.25, h) + 1.0 - smoothstep(5.25, 6.75, h);
}

// Crumbs a food item starts with.
float crumbsOf(int kind)
{
    if (kind == FOOD_SUGAR) return 80.0;
    if (kind == FOOD_BERRY) return 60.0;
    if (kind == FOOD_LEAF) return 90.0;
    return 40.0;
}

// Spacing of the crumbs in a pile: crumb j sits CRUMB_STEP * sqrt(j + 0.5)
// from the centre on a golden-angle spiral.
const float CRUMB_STEP = 0.0036;

// Reach of a food item with `left` of its `start` crumbs, U.
float pileRadius(int kind, float left, float start)
{
    float f = clamp(left / max(start, 1.0), 0.0, 1.0);
    if (kind == FOOD_SUGAR) return 0.012 * (0.35 + 0.65 * sqrt(f));
    if (kind == FOOD_BERRY) return 0.011 * (0.4 + 0.6 * sqrt(f));
    if (kind == FOOD_LEAF) return 0.021;
    return CRUMB_STEP * sqrt(max(left, 1.0)) + 0.003;
}
