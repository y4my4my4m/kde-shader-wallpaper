// Aquarium — tank layout, fish slots and helpers shared by Buffer A, Buffer B
// and the image pass.
//
// Lengths are in H units: pixels / iResolution.y of the running pass, so y
// spans 0 (bottom) .. 1 (top) and x spans 0 .. aspect. The buffer grid keeps
// the screen aspect to within one texel, so H positions agree between passes.
// The tank: sand from the bottom up to sandTop(x), water up to SURFACE, air
// above.
//
// Fish slots, back to front (slot order is draw order):
//   0 angelfish, 1 panda corydoras, 2 cherry shrimp,
//   3 .. 3 + TETRAS - 1 neon tetras,
//   then pufferfish, koi angelfish, bronze corydoras, cherry shrimp.
//
// TETRAS, SWIM_SPEED, CURIOSITY and FOLLOW_CLOCK are @shared tweaks of
// aquarium.frag.

const int NBACK = 3;
const int NFRONT = 4;
const int NFISH = NBACK + TETRAS + NFRONT; // at most 47: two 24-bit tile sets
const int NFLAKE = 24;
const int NBUB = 24;
const int FLAKES_PER_CLICK = 12;
const float CHEW = 0.7;           // seconds after a bite before a fish bites again

// Buffer A rows.
const int ROW_P = 0;
const int ROW_Q = 1;
const int ROW_R = 2;
const int ROW_S = 3;
const int ROW_FLAKE = 4;
const int ROW_BUB = 5;
const int ROW_G = 6;

const int SP_TETRA = 0;
const int SP_ANGEL = 1;
const int SP_PUFFER = 2;
const int SP_CORY = 3;
const int SP_SHRIMP = 4;

const float SURFACE = 0.935;     // water line, H
const float PANEL = 0.065;       // bottom band left to the Plasma panel, H
const float FLOOR_DEPTH = 0.042; // sand band height between back and front rows, H
const float LOOP = 512.0;        // seconds per turn of the animation clock
const float FLAKE_LIFE = 14.0;   // seconds a flake lies on the sand

int speciesOf(int i)
{
    if (i < NBACK) return i == 0 ? SP_ANGEL : (i == 1 ? SP_CORY : SP_SHRIMP);
    if (i < NBACK + TETRAS) return SP_TETRA;
    int k = i - NBACK - TETRAS;
    return k == 0 ? SP_PUFFER : (k == 1 ? SP_ANGEL : (k == 2 ? SP_CORY : SP_SHRIMP));
}

// 0 for the back specials and the pufferfish, 1 for the front pair members.
int variantOf(int i)
{
    return i < NBACK + TETRAS ? 0 : (i - NBACK - TETRAS > 0 ? 1 : 0);
}

int pufferSlot() { return NBACK + TETRAS; }

// Depth behind the front glass, 0 front .. 1 back.
float depthOf(int i)
{
    if (i < NBACK) return i == 0 ? 0.85 : (i == 1 ? 0.55 : 0.5);
    if (i < NBACK + TETRAS) {
        float k = float(i - NBACK) / max(float(TETRAS - 1), 1.0);
        return 0.65 - 0.4 * k;
    }
    int k = i - NBACK - TETRAS;
    return k == 0 ? 0.25 : (k == 1 ? 0.18 : (k == 2 ? 0.1 : 0.05));
}

// Fish scale for the screen shape: 1 on landscape, smaller on portrait.
float fishUnit(float aspect) { return clamp(aspect * 1.2, 0.6, 1.0); }

float depthScale(float z) { return 1.0 - 0.22 * z; }

// Nose-to-tail length at scale 1, H.
float bodyLen(int sp)
{
    if (sp == SP_TETRA) return 0.050;
    if (sp == SP_ANGEL) return 0.105;
    if (sp == SP_PUFFER) return 0.072;
    if (sp == SP_CORY) return 0.068;
    return 0.052;
}

float fishLen(int i, float aspect)
{
    return bodyLen(speciesOf(i)) * fishUnit(aspect) * depthScale(depthOf(i));
}

float facingSign(float f) { return f >= 0.0 ? 1.0 : -1.0; }

vec2 mouthOf(int sp, vec2 pos, float facing, float L)
{
    float dy = sp == SP_CORY ? -0.12 : (sp == SP_SHRIMP ? 0.02 : -0.01);
    float dx = sp == SP_ANGEL ? 0.40 : (sp == SP_PUFFER ? 0.40 : 0.47);
    return pos + vec2(facingSign(facing) * dx, dy) * L;
}

// Buffer B tiles are tileSpan x tileSpan texels of its grid, so a grid
// enlarged by the bufferSimulationMaxHeight setting keeps about 128 tile rows.
int tileSpan(float gridRows) { return max(1, int(gridRows / 128.0)); }

// ------------------------------------------------------------- hashes

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

// ------------------------------------------------------------- tank

// Back edge of the sand, H.
float sandTop(float x)
{
    return 0.152 + 0.020 * sin(x * 1.9 + 0.7) + 0.011 * sin(x * 4.3 + 2.1) + 0.005 * sin(x * 9.7 + 1.3);
}

// Sand line a creature at depth z stands on.
float floorY(float x, float z) { return sandTop(x) - (1.0 - z) * FLOOR_DEPTH; }

// Body centre height of a bottom dweller above its floor line, units of L.
float groundLift(int sp) { return sp == SP_CORY ? 0.17 : 0.13; }

// Night by the local clock, 0 day .. 1 night: the tank light dims over
// 21:30-22:30 and comes back over 7:00-8:00.
float clockNight()
{
    float h = mod(iDate.w / 3600.0, 24.0);
    float on = smoothstep(7.0, 8.0, h) * (1.0 - smoothstep(21.5, 22.5, h));
    return 1.0 - on;
}

// ------------------------------------------------------------- windows

// Window k as (x0, y0, x1, y1), H.
vec4 winRect(int k)
{
    vec4 r = iWindowRects[k] / iResolution.y;
    return vec4(r.xy, r.xy + r.zw);
}

bool winValid(int k)
{
    vec4 r = iWindowRects[k];
    return r.z > 2.0 && r.w > 2.0;
}

// A window covering most of the screen is ignored by the fish.
bool winHuge(vec4 r, float aspect)
{
    return (r.z - r.x) * (r.w - r.y) > 0.6 * aspect;
}

float sdRect(vec2 p, vec4 r)
{
    vec2 c = 0.5 * (r.xy + r.zw);
    vec2 q = abs(p - c) - 0.5 * (r.zw - r.xy);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// Outward direction from rect r at p.
vec2 rectNormal(vec2 p, vec4 r)
{
    vec2 c = 0.5 * (r.xy + r.zw);
    vec2 h = 0.5 * (r.zw - r.xy);
    vec2 d = p - c;
    vec2 q = abs(d) - h;
    if (q.x > 0.0 || q.y > 0.0) {
        vec2 o = max(q, 0.0) * sign(d);
        float l = length(o);
        return l > 1e-6 ? o / l : vec2(0.0, 1.0);
    }
    return q.x > q.y ? vec2(sign(d.x), 0.0) : vec2(0.0, sign(d.y));
}

bool insideAnyWindow(vec2 p)
{
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        if (!winValid(k)) continue;
        vec4 r = winRect(k);
        if (p.x >= r.x && p.y >= r.y && p.x <= r.z && p.y <= r.w) return true;
    }
    return false;
}

// True when a fish with mouth at `mouth`, `ate` seconds after its last
// bite, eats flake f (Buffer A row 4).
bool eatsFlake(int sp, vec2 mouth, float L, float ate, vec4 f)
{
    if (f.w < 0.5 || f.z < 0.0 || ate < CHEW) return false;
    bool settled = f.w > 1.5;
    if (sp == SP_CORY || sp == SP_SHRIMP) {
        if (!settled && f.y > sandTop(f.x) + 0.02) return false;
        return abs(f.x - mouth.x) < 0.3 * L + 0.004 && abs(f.y - mouth.y) < 0.06;
    }
    if (settled) return false;
    return distance(f.xy, mouth) < 0.22 * L + 0.005;
}
