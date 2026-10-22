// Overworld — world definition shared by Buffer A and the image pass.
//
// The screen is a side view of a block world ROWS blocks tall. Block (0, 0)
// is the bottom-left; a block is BS = iResolution.y / ROWS pixels in either
// pass (Buffer A runs on a smaller grid of the same aspect). Buffer A holds
// everything that changes; iChannel0 is Buffer A in both passes. The engine
// clears buffers to zero on load, so zero is "nothing changed" everywhere.
//
// Buffer A layout (texel coordinates):
//   (col, row), row < ROWS
//       x  override: 0 as generated, 1 air, 2 cobblestone, 3 obsidian,
//          4 grass that spread onto dirt
//       y  mining progress 0..1
//       z  flowing fluid in an air cell: +level water, -level lava (1..8)
//       w  iTime of the last override change (world healing)
//   (i, MOB_ROW)       mob i: feet position (blocks), velocity (blocks/s)
//   (i, MOB_ROW + 1)   mob i: kind + 1 (0 = never written), facing,
//                      timer (creeper fuse / happy hops), seconds until it
//                      arrives (> 0 while away)
//   (0, EVENT_ROW)     last explosion: centre, age, 1
//   (1, EVENT_ROW)     last broken block: cell, age, block type + 1
//   (2, EVENT_ROW)     x 1 while a mouse button was held last step
//   (3, EVENT_ROW)     last water tick, last lava tick, last slow tick
//   (4, EVENT_ROW)     last mob lost to lava: position, age, 1

// PEACEFUL, ANIMALS, RETURN_TIME, HEAL_DELAY and FLUID_SPEED are @shared
// tweaks of overworld.frag.

const int ROWS = 24;
const int SEA = 9;
const int CREEPERS = PEACEFUL ? 0 : 2; // mob slots 0 .. CREEPERS - 1
const int NMOB = CREEPERS + ANIMALS;
const int MOB_ROW = 28;
const int EVENT_ROW = 31;

const int AIR = 0;
const int GRASS = 1;
const int DIRT = 2;
const int STONE = 3;
const int SAND = 4;
const int WATER = 5;
const int LOG = 6;
const int LEAVES = 7;
const int COAL = 8;
const int IRON = 9;
const int GOLD = 10;
const int DIAMOND = 11;
const int BEDROCK = 12;
const int LAVA = 13;
const int COBBLE = 14;
const int OBSIDIAN = 15;

const int CREEPER = 0;
const int PIG = 1;
const int SHEEP = 2;
const int CHICKEN = 3;

const float FUSE_TIME = 1.5;     // seconds next to the cursor before a creeper blows
const float BLAST_RADIUS = 3.2;
const float WATER_TICK = 0.25 / FLUID_SPEED; // seconds per flow step; the game's rate at FLUID_SPEED 1
const float LAVA_TICK = 1.0 / FLUID_SPEED;
const float SLOW_TICK = 2.0;     // grass spread and world healing

float blockSize() { return iResolution.y / float(ROWS); }
int columns() { return int(ceil(iResolution.x / blockSize())); }

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

// Height of the top terrain block in column c (rows 6..16).
int surfaceHeight(int c)
{
    float x = float(c);
    float n = 0.55 * vnoise1(x * 0.045 + 3.1) + 0.3 * vnoise1(x * 0.11 + 7.3) + 0.15 * vnoise1(x * 0.27 + 1.7);
    return 6 + int(n * 11.0);
}

bool treeCandidate(int c) { return hash11(float(c) * 3.17 + 0.5) <= 0.16; }

bool isTreeColumn(int c)
{
    if (c < 2 || !treeCandidate(c) || surfaceHeight(c) <= SEA + 1) return false;
    // No trunk within three columns of an earlier one.
    for (int d = 1; d <= 3; d++) {
        if (treeCandidate(c - d) && surfaceHeight(c - d) > SEA + 1) return false;
    }
    return true;
}

int treeHeight(int c) { return 4 + int(hash11(float(c) * 7.7) * 2.0); }

// The world as generated.
int naturalBlock(int c, int r)
{
    if (r <= 0) return BEDROCK;
    if (r == 1 && hash12(vec2(c, 91)) < 0.5) return BEDROCK;
    int s = surfaceHeight(c);
    bool beach = s <= SEA + 1;

    if (r > s) {
        // Trees: trunk in the tree column, leaves around its top.
        for (int d = -2; d <= 2; d++) {
            int tc = c + d;
            if (!isTreeColumn(tc)) continue;
            int ts = surfaceHeight(tc);
            int top = ts + treeHeight(tc);
            if (d == 0 && r > ts && r <= top - 1) return LOG;
            int dy = r - (top - 1);
            int ad = d < 0 ? -d : d;
            if (dy >= -1 && dy <= 1 && ad <= 2) {
                if (ad == 2 && hash12(vec2(c * 13 + r, tc)) < 0.35) continue;
                return LEAVES;
            }
            if (dy == 2 && ad <= 1) return LEAVES;
        }
        return r <= SEA ? WATER : AIR;
    }

    // Caves below the dirt layer.
    if (r < s - 4 && r > 1) {
        float cave = vnoise2(vec2(float(c) * 0.16, float(r) * 0.28) + 4.0);
        if (cave > 0.7) return r <= 3 ? LAVA : AIR;
    }
    if (r == s) return beach ? SAND : GRASS;
    if (r >= s - 3) return beach ? SAND : DIRT;
    float h = hash12(vec2(c, r) * 1.37 + 0.11);
    if (r <= 5 && h < 0.025) return DIAMOND;
    if (r <= 8 && h < 0.05) return GOLD;
    if (h < 0.11) return IRON;
    if (h < 0.2) return COAL;
    return STONE;
}

vec4 cellState(int c, int r) { return texelFetch(iChannel0, ivec2(c, r), 0); }

int overrideOf(vec4 s) { return int(s.x + 0.5); }

// The world as it is now. Flowing fluid reports as WATER / LAVA.
int blockAt(int c, int r)
{
    if (c < 0 || r < 0 || r >= ROWS) return AIR;
    vec4 s = cellState(c, r);
    int o = overrideOf(s);
    if (o == 2) return COBBLE;
    if (o == 3) return OBSIDIAN;
    if (o == 4) return GRASS;
    int b = o == 1 ? AIR : naturalBlock(c, r);
    if (b == AIR) {
        if (s.z > 0.5) return WATER;
        if (s.z < -0.5) return LAVA;
    }
    return b;
}

// Fluid in a cell: level 0..8 in x (8 = source or falling), 1 lava in y.
// A source is a generated water or lava block still in place.
ivec2 fluidAt(int c, int r)
{
    if (c < 0 || r < 0 || r >= ROWS) return ivec2(0);
    vec4 s = cellState(c, r);
    int o = overrideOf(s);
    if (o >= 2) return ivec2(0);
    if (o == 0) {
        int b = naturalBlock(c, r);
        if (b == WATER) return ivec2(8, 0);
        if (b == LAVA) return ivec2(8, 1);
        if (b != AIR) return ivec2(0);
    }
    if (s.z > 0.5) return ivec2(int(s.z + 0.5), 0);
    if (s.z < -0.5) return ivec2(int(-s.z + 0.5), 1);
    return ivec2(0);
}

bool isSource(int c, int r)
{
    if (c < 0 || r < 0 || r >= ROWS) return false;
    if (overrideOf(cellState(c, r)) != 0) return false;
    int b = naturalBlock(c, r);
    return b == WATER || b == LAVA;
}

bool isSolid(int b) { return b != AIR && b != WATER && b != LAVA; }

// Seconds of mining to break a block; 0 = unbreakable.
float hardness(int b)
{
    if (b == LEAVES) return 0.25;
    if (b == DIRT || b == GRASS || b == SAND) return 0.55;
    if (b == LOG) return 0.9;
    if (b == STONE || b == COAL || b == COBBLE) return 1.2;
    if (b == IRON || b == GOLD) return 1.5;
    if (b == DIAMOND) return 2.0;
    if (b == OBSIDIAN) return 4.0;
    return 0.0;
}

// Mob box size in blocks (width, height).
vec2 mobSize(int kind)
{
    if (kind == CREEPER) return vec2(0.62, 1.62);
    if (kind == PIG) return vec2(1.12, 0.75);
    if (kind == SHEEP) return vec2(1.1, 0.95);
    return vec2(0.5, 0.62);
}

// Mob kind from its state texel; slots below CREEPERS are always creepers.
int mobKindOf(int i, vec4 b)
{
    if (i < CREEPERS) return CREEPER;
    int k = int(b.x + 0.5) - 1;
    return (k >= PIG && k <= CHICKEN) ? k : PIG;
}

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

// The block the cursor points at, or (-1, -1) when the cursor is over a
// window or off screen.
ivec2 cursorCell()
{
    if (!cursorOnScreen() || insideWindow(iMouse.xy)) return ivec2(-1);
    return ivec2(floor(iMouse.xy / blockSize()));
}

// Night by the local clock (spawn rules; Buffer A cannot see the image
// pass's day-length setting).
bool clockNight()
{
    float h = iDate.w / 3600.0;
    return h < 6.0 || h > 19.0;
}
