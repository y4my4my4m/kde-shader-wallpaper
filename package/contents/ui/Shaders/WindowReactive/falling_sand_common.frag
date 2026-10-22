// Falling Sand — grid, cell encoding, palette layout and helpers shared by
// Buffer A and the image pass.
//
// The screen is a grid of rows x cols cells, cell (0, 0) at the bottom left.
// The grid spans the screen exactly; cells are square to within one cell
// across the width. rows is one less than the buffer height, which
// @sim-max-height sets, capped at MAX_ROWS. Buffer A stores cell (i, j) in
// texel (i, j); its top texel row holds the state texels.
//
// Cell texel:
//   x  material M_*, 0 empty
//   y  tone 0..1, random per grain; plant parts carry their plant's seed
//   z  sand: moisture 0..1
//      water: flow direction, -1 or +1
//      tip: cells of growth left
//      stem: 1 while a leaf is due
//      leaf: side, -1 or +1 for the inner half (its stem at x - side),
//            -2 or +2 for the outer half (the inner half at x - sign)
//      flower: petals due, bits 1 left, 2 right, 4 up
//      petal: direction from the flower centre, 0 left, 1 right, 2 up
//   w  plant parts: plant age, seconds
//      loose materials: seconds spent inside a window
//
// State texels (k, buffer height - 1):
//   0  substep counter (wraps at 2^20), filled fraction and plant fraction
//      of the grid (moving averages of random samples), 1
//   1  button held last step, pouring (press began on bare desktop),
//      selected tool T_*, 1
//   2  ambient event E_*, seconds left, seconds until the next event,
//      parameter (trickle column as a fraction of the width; wind -1 or +1)
//   3  duration of the current event (seconds), events so far, kind of the
//      latest event, 1

// @shared tweaks of falling_sand.frag:
//   POUR_RATE    pouring speed, multiplier
//   AMBIENT      1 ambient events (rain, sand, seeds, snow), 0 none
//   EVAPORATION  evaporation and drying speed, multiplier

const int M_EMPTY  = 0;
const int M_SAND   = 1;
const int M_WATER  = 2;
const int M_SEED   = 3;
const int M_STONE  = 4;
const int M_SNOW   = 5;
const int M_GRAVEL = 6;
const int M_LITTER = 7;
const int M_STEM   = 8;
const int M_TIP    = 9;
const int M_LEAF   = 10;
const int M_FLOWER = 11;
const int M_PETAL  = 12;

const int T_SAND   = 0;
const int T_WATER  = 1;
const int T_SEED   = 2;
const int T_STONE  = 3;
const int T_SNOW   = 4;
const int T_ERASER = 5;
const int NTOOLS   = 6;

const int E_NONE    = 0;
const int E_RAIN    = 1;
const int E_TRICKLE = 2;
const int E_SEEDS   = 3;
const int E_SNOW    = 4;

const int NSTATE   = 4;
const int MAX_ROWS = 400;

// Seconds from the end of a plant's life to its crumbling.
const float WILT_TIME = 20.0;

int gridRows(vec2 bufRes) { return clamp(int(bufRes.y) - 1, 16, MAX_ROWS); }

int gridCols(vec2 bufRes)
{
    return clamp(int(ceil(float(gridRows(bufRes)) * bufRes.x / bufRes.y)), 16, int(bufRes.x));
}

int matOf(vec4 v) { return int(v.x + 0.5); }

bool isPlant(int m) { return m >= M_STEM; }

// Plant lifetime in seconds, from the plant's seed.
float plantLife(float seed) { return 150.0 + 150.0 * fract(seed * 7.31 + 0.17); }

// pcg3d (Jarzynski and Olano, "Hash Functions for GPU Rendering", 2020).
uvec3 pcg3d(uvec3 v)
{
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    return v;
}

float rnd3(uvec3 v) { return float(pcg3d(v).x >> 8u) * (1.0 / 16777216.0); }

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// ------------------------------------------------------------- palette

// Palette geometry in H units (pixels / screen height): a row of NTOOLS
// icons in the top-right corner.
float palUnit(vec2 res) { return min(res.x / res.y, 1.0); }

float palIconSide(vec2 res) { return 0.042 * palUnit(res); }

float palPitch(vec2 res) { return 1.36 * palIconSide(res); }

vec2 palIconCentre(int k, vec2 res)
{
    float u = palUnit(res);
    float side = palIconSide(res);
    float inset = 0.026 * u + 0.75 * side;
    return vec2(res.x / res.y - inset - float(NTOOLS - 1 - k) * palPitch(res), 1.0 - inset);
}

// Icon under point h (H units), or -1.
int palIconAt(vec2 h, vec2 res)
{
    float r = 0.5 * palPitch(res);
    for (int k = 0; k < NTOOLS; k++) {
        vec2 d = abs(h - palIconCentre(k, res));
        if (d.x < r && d.y < r) return k;
    }
    return -1;
}

// ------------------------------------------------------------- input

// True when pixel-space point p lies inside a window.
bool insideWindow(vec2 p)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        if (p.x >= r.x && p.y >= r.y && p.x <= r.x + r.z && p.y <= r.y + r.w) return true;
    }
    return false;
}

bool cursorOnScreen()
{
    return (iMouse.x > 1.0 || iMouse.y > 1.0) && iMouse.x < iResolution.x && iMouse.y < iResolution.y;
}
