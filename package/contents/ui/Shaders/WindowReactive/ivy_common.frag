// Ivy — constants, state layout and helpers shared by every pass.
//
// Cell space: one unit per grid cell, origin at the bottom-left of the
// screen. A cell is min(simW, simH) / CELLS_SHORT texels of the buffers, so
// vines keep their size relative to the short screen side on every aspect.
// Buffer texel (i, j) holds grid cell (i, j); the grid fills the lower left
// of each buffer and leaves the last texel row and column free.
// Ages are growth seconds: real seconds times GROWTH times the start-up
// burst. Falling and withering run on real seconds. Angles are radians,
// counter-clockwise from +x.
//
// Buffer A, one texel per cell (rules in ivy_bufferA.frag):
//   x  flags, integer:
//        bits 0-1    kind: 0 empty, 1 alive, 2 torn (one step), 3 withering
//        bits 2-5    direction to the parent, 1..8 into DIRS, 0 for a root
//        bit  6      clings to a window edge
//        bits 7-8    children, 0..3
//        bit  9      dormant tip
//        bit  10     leaf fell this step
//        bit  11     petal fell this step
//        bits 12-13  species: 0, 1 ivy, 2 morning glory, 3 moonflower
//        bit  14     planted seed
//        bits 15-16  role: 0 climber, 1 tendril, 2 drape
//        bits 17-18  branch order, 0 for the main axis
//        bits 19-21  failed growth attempts
//        bit  22     seedling: grows fast until it finds a support
//        bit  23     seeker: sends tendrils toward windows in reach
//   y  bits 0-6, 7-13: node position in its cell, x and y in 1/128;
//      bits 14-21: tangent of the stem leaving the parent, 1/256 turn
//   z  age; for a withering node, real seconds since withering began
//   w  bits 0-6, 7-13: parent position in its cell; bits 14-18: nodes since
//      the last support; bits 19-22: consecutive downward nodes
// The stem from parent P to node N is the circular arc leaving P along the
// stored tangent, approximated by a quadratic Bezier.
//
// Buffer A globals:
//   (simW-1, simH-1)  x real seconds since load (capped), y growth seconds
//                     toward the next tick, z tick count, w bit 0 ticked this
//                     step, bit 1 button held this step
//   (simW-2, simH-1)  x coverage estimate, y window count, z seconds left of
//                     the grace and gentle period after windows vanished,
//                     w 1 + virtual desktop index (0 until written)
//
// Buffer B, falling debris, one piece per cell (layout in ivy_bufferB.frag).
// Buffer C, render hints per cell (layout in ivy_bufferC.frag).

// GROWTH (growth speed multiplier) and COVERAGE (share of the visible
// desktop cells vines may occupy) are @shared tweaks of ivy.frag.

// Grid cells across the short screen side: 24.8 px cells at 1440p.
const float CELLS_SHORT = 58.0;

const float PI  = 3.14159265;
const float TAU = 6.28318531;

const int K_EMPTY  = 0;
const int K_ALIVE  = 1;
const int K_TORN   = 2;
const int K_WITHER = 3;

const int R_CLIMB   = 0;
const int R_TENDRIL = 1;
const int R_DRAPE   = 2;

const int S_IVY   = 0;
const int S_IVY2  = 1;
const int S_GLORY = 2;
const int S_MOON  = 3;

// Cell units.
const float GROUND   = 1.3;   // ground line above the bottom edge
const float HUG_D    = 0.55;  // gap a vine keeps to its support
const float HUG_R    = 1.7;   // supports nearer than this are followed
const float ATTACH_D = 1.4;   // a node born this near a window clings to it
const float RELEASE  = 2.2;   // and holds while the edge stays this near
const float SENSE    = 24.0;  // windows this near draw searching tendrils

const float TICK     = 1.0;   // growth seconds per growth tick
const float WITHER_T = 5.0;   // real seconds from withering to removal
const float GRACE    = 3.0;   // real seconds vines wait for vanished windows
const float GENTLE_T = 2.5;   // real seconds after the grace that losses wither
const float LEAF_DROP_W = 1.6; // real seconds into withering the leaf drops

// Farthest a node or a falling piece draws from its own position, cells:
// a leaf at the largest LEAF_SIZE (1.2) with its shadow.
const float NODE_R   = 2.15;
const float DEBRIS_R = 2.0;

const ivec2 DIRS[8] = ivec2[8](ivec2(1, 0), ivec2(1, 1), ivec2(0, 1), ivec2(-1, 1),
                               ivec2(-1, 0), ivec2(-1, -1), ivec2(0, -1), ivec2(1, -1));

// ------------------------------------------------------------- grid

// Buffer texels per cell.
float cellTexels(vec2 simRes)
{
    return max(min(simRes.x, simRes.y) / CELLS_SHORT, 1.0);
}

// Screen size in cells.
vec2 worldSize(vec2 simRes)
{
    return simRes / cellTexels(simRes);
}

ivec2 gridSize(vec2 simRes)
{
    return ivec2(min(floor(worldSize(simRes)), simRes - 1.0));
}

bool inGrid(ivec2 c, ivec2 g)
{
    return c.x >= 0 && c.y >= 0 && c.x < g.x && c.y < g.y;
}

// Window i as (x0, y0, x1, y1) in cells; s converts the pass's pixels to
// cells. Rects cover the visible window, decorations included.
vec4 winBox(int i, vec2 s)
{
    vec4 r = iWindowRects[i];
    vec2 lo = r.xy * s;
    vec2 hi = (r.xy + r.zw) * s;
    return vec4(lo, hi);
}

bool winValid(int i)
{
    vec4 r = iWindowRects[i];
    return r.z >= 1.0 && r.w >= 1.0;
}

// Signed distance from Q to box b and the outward normal of its nearest side.
float boxDist(vec2 Q, vec4 b, out vec2 nrm)
{
    vec2 c = 0.5 * (b.xy + b.zw);
    vec2 hb = 0.5 * (b.zw - b.xy);
    vec2 d = Q - c;
    vec2 q = abs(d) - hb;
    vec2 sg = vec2(d.x < 0.0 ? -1.0 : 1.0, d.y < 0.0 ? -1.0 : 1.0);
    if (q.x > 0.0 || q.y > 0.0) {
        vec2 m = max(q, 0.0);
        float l = length(m);
        nrm = sg * m / max(l, 1e-5);
        return l;
    }
    nrm = q.x > q.y ? vec2(sg.x, 0.0) : vec2(0.0, sg.y);
    return max(q.x, q.y);
}

// Distance from Q to the nearest window, negative inside one.
float windowDist(vec2 Q, vec2 s)
{
    float best = 1e9;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec2 nr;
        best = min(best, boxDist(Q, winBox(i, s), nr));
    }
    return best;
}

// ------------------------------------------------------------- hashing

uint hashU(uint x)
{
    x ^= x >> 16u;
    x *= 0x7feb352du;
    x ^= x >> 15u;
    x *= 0x846ca68bu;
    x ^= x >> 16u;
    return x;
}

// Uniform [0, 1) from a cell and a salt.
float hashC(ivec2 c, int salt)
{
    uint h = hashU(uint(c.x) * 0x9E3779B1u + uint(c.y) * 0x85EBCA77u + uint(salt) * 0x632BE5ABu);
    return float(h >> 8u) * (1.0 / 16777216.0);
}

// Per-cell key, one hash round; keyHash() draws decorrelated uniforms from
// it for the node's fixed traits.
uint cellKey(ivec2 c)
{
    return hashU(uint(c.x) * 0x9E3779B1u + uint(c.y) * 0x85EBCA77u);
}

float keyHash(uint key, int k)
{
    return float((key * (0x2C1B3C6Du + uint(k) * 0x297A2D38u)) >> 8u) * (1.0 / 16777216.0);
}

// ------------------------------------------------------------- nodes

struct Node {
    int kind;
    int pdir;
    bool attached;
    int children;
    bool dormant;
    bool evLeaf;
    bool evPetal;
    int species;
    bool seed;
    int role;
    int order;
    int fails;
    bool vigor;
    bool seeker;
    vec2 pos;
    float tau;
    float age;
    vec2 ppos;
    int run;
    int down;
};

// Stored integers reach 2^24, where float32 steps by 1: v + 0.5 would round.
int fi(float v)
{
    return int(round(v));
}

Node decodeNode(vec4 t)
{
    Node n;
    int f = fi(t.x);
    n.kind = f & 3;
    n.pdir = (f >> 2) & 15;
    n.attached = ((f >> 6) & 1) != 0;
    n.children = (f >> 7) & 3;
    n.dormant = ((f >> 9) & 1) != 0;
    n.evLeaf = ((f >> 10) & 1) != 0;
    n.evPetal = ((f >> 11) & 1) != 0;
    n.species = (f >> 12) & 3;
    n.seed = ((f >> 14) & 1) != 0;
    n.role = (f >> 15) & 3;
    n.order = (f >> 17) & 3;
    n.fails = (f >> 19) & 7;
    n.vigor = ((f >> 22) & 1) != 0;
    n.seeker = ((f >> 23) & 1) != 0;
    int g = fi(t.y);
    n.pos = (vec2(float(g & 127), float((g >> 7) & 127)) + 0.5) / 128.0;
    n.tau = float((g >> 14) & 255) * (TAU / 256.0);
    n.age = t.z;
    int a = fi(t.w);
    n.ppos = (vec2(float(a & 127), float((a >> 7) & 127)) + 0.5) / 128.0;
    n.run = (a >> 14) & 31;
    n.down = (a >> 19) & 15;
    return n;
}

vec4 encodeNode(Node n)
{
    int f = n.kind | (n.pdir << 2) | (int(n.attached) << 6) | (min(n.children, 3) << 7)
          | (int(n.dormant) << 9) | (int(n.evLeaf) << 10) | (int(n.evPetal) << 11)
          | (n.species << 12) | (int(n.seed) << 14) | (n.role << 15) | (min(n.order, 3) << 17)
          | (min(n.fails, 7) << 19) | (int(n.vigor) << 22) | (int(n.seeker) << 23);
    ivec2 q = clamp(ivec2(n.pos * 128.0), 0, 127);
    int ta = int(floor(fract(n.tau / TAU) * 256.0 + 0.5)) & 255;
    int g = q.x | (q.y << 7) | (ta << 14);
    ivec2 pq = clamp(ivec2(n.ppos * 128.0), 0, 127);
    int a = pq.x | (pq.y << 7) | (min(n.run, 31) << 14) | (min(n.down, 15) << 19);
    return vec4(float(f), float(g), n.age, float(a));
}

float wrapAngle(float a)
{
    return a - TAU * floor((a + PI) / TAU);
}

vec2 dirOf(float a)
{
    return vec2(cos(a), sin(a));
}

vec2 parentPos(Node n, ivec2 c)
{
    return vec2(c + DIRS[(n.pdir + 7) & 7]) + n.ppos;
}

// Chord deviation of the arc from P to N that leaves P along tau.
float arcBend(vec2 P, vec2 N, float tau)
{
    vec2 ch = N - P;
    return clamp(wrapAngle(atan(ch.y, ch.x) - tau), -1.2, 1.2);
}

// Tangent of the stem where it arrives at node n.
float endTangent(Node n, ivec2 c)
{
    if (n.pdir == 0) return n.tau;
    vec2 N = vec2(c) + n.pos;
    return n.tau + 2.0 * arcBend(parentPos(n, c), N, n.tau);
}

// ------------------------------------------------------------- foliage

// Leaf cycle length, growth seconds.
float leafCycle(uint key)
{
    return 700.0 * (0.65 + 0.7 * keyHash(key, 11));
}

const float LEAF_FALL = 0.94;   // cycle phase the leaf falls at
const float PETIOLE   = 0.14;   // leaf stalk, fraction of the blade length

bool hasLeafSlot(Node n, uint key)
{
    if (n.role == R_TENDRIL) return n.age > 25.0 && keyHash(key, 12) < 0.75;
    return keyHash(key, 12) < 0.93;
}

struct Leaf {
    vec2 base;     // blade base, cells
    float ang;     // midrib direction
    float len;     // blade length, cells, before LEAF_SIZE
    float side;    // +1 left of the stem, -1 right
    float phase;   // leaf cycle phase, 0..1
    float grow;    // 0..1 unfurled
};

// Leaf of node n at N with arrival tangent te. False when the node bears no
// leaf now. Lengths exclude the LEAF_SIZE tweak.
bool leafOf(Node n, ivec2 c, uint key, vec2 N, float te, out Leaf lf)
{
    lf.base = N;
    lf.ang = 0.0;
    lf.len = 0.0;
    lf.side = 1.0;
    lf.phase = 0.0;
    lf.grow = 0.0;
    if (!hasLeafSlot(n, key)) return false;
    float cyc = leafCycle(key);
    float ageL = n.kind == K_WITHER ? 1e5 : n.age;
    float ph = fract(ageL / cyc);
    if (n.kind == K_WITHER) {
        if (n.age > LEAF_DROP_W && !n.evLeaf) return false;
        ph = 0.5;
    } else if (ph > LEAF_FALL && !n.evLeaf) {
        return false;
    }
    float inCycle = ph * cyc;
    lf.phase = ph;
    lf.grow = smoothstep(0.0, 7.0, inCycle);
    // Tendrils leaf out as they mature.
    if (n.role == R_TENDRIL) lf.grow *= smoothstep(25.0, 140.0, n.age);
    lf.side = ((c.x + c.y) & 1) == 0 ? 1.0 : -1.0;
    float a = te + lf.side * (1.0 + 0.55 * keyHash(key, 13));
    // Blades hang a little toward the ground.
    a += wrapAngle(-0.5 * PI - a) * 0.28;
    lf.ang = a;
    bool heart = n.species >= S_GLORY;
    lf.len = (heart ? 1.05 : 1.0) * (0.95 + 0.4 * keyHash(key, 14)) * (0.35 + 0.65 * lf.grow);
    if (n.role == R_TENDRIL) lf.len *= 0.8;
    lf.base = N + dirOf(a) * (PETIOLE * lf.len);
    return true;
}

bool hasFlower(Node n, uint key)
{
    return n.species >= S_GLORY && n.role != R_TENDRIL && keyHash(key, 15) < 0.3 && n.age > 16.0;
}

// Flower of node n: xy centre, z radius (grows with the bud), w the angle
// the bud points along.
vec4 flowerOf(Node n, ivec2 c, uint key, vec2 N, float te)
{
    float side = ((c.x + c.y) & 1) == 0 ? 1.0 : -1.0;
    float a = te - side * (1.1 + 0.5 * keyHash(key, 16));
    a += wrapAngle(0.5 * PI - a) * 0.2;
    float r = (n.species == S_MOON ? 0.82 : 0.72) * (0.85 + 0.3 * keyHash(key, 17));
    float bud = smoothstep(16.0, 40.0, n.age);
    return vec4(N + dirOf(a) * (0.3 + 0.45 * r * bud), r * bud, a);
}

// Opening by the local clock, hour in [0, 24); h staggers flowers.
float gloryOpen(float hr, float h)
{
    float s = (h - 0.5) * 1.4;
    return smoothstep(5.2 + s, 7.6 + s, hr) * (1.0 - smoothstep(14.5 + s, 18.2 + s, hr));
}

float moonOpen(float hr, float h)
{
    float s = (h - 0.5) * 1.4;
    return max(smoothstep(18.4 + s, 20.6 + s, hr), 1.0 - smoothstep(5.0 + s, 7.6 + s, hr));
}

float flowerOpen(int species, float hr, uint key)
{
    float h = keyHash(key, 18);
    return species == S_MOON ? moonOpen(hr, h) : gloryOpen(hr, h);
}

// Growth seconds between petal drops of an open flower.
float petalPeriod(uint key)
{
    return 110.0 * (0.6 + 0.8 * keyHash(key, 19));
}
