// Ivy — Buffer B: falling debris.
// @channels bufferA, self
//
// One piece per grid cell, handed from cell to cell as it falls; a piece
// moves less than a cell per step. A cell takes the first piece of its 3x3
// block whose new position lands in it, itself first; colliding pieces are
// dropped, as are pieces that leave the grid. Spawns, read from this step's
// Buffer A, win over arrivals: a torn node becomes a stem piece carrying its
// leaf and flower; a leaf or petal event leaves a leaf or petal where the
// living one was.
//   x  position in the cell, 1/4096 per axis: x + 4096 y
//   y  velocity, (v + 32) * 64 cells/s per axis: vx + 4096 vy
//   z  age, real seconds
//   w  bits 0-1    kind: 0 none, 1 stem piece, 2 leaf, 3 petal
//      bits 2-3    species
//      bits 4-7    tint: 0 green .. 15 dead brown
//      bits 8-13   starting angle, 1/64 turn
//      bit  14     the stem piece's leaf is on its left
//      bit  15     the stem piece carries a flower
//      bit  16     the stem piece carries a leaf
//      bits 17-19  leaf length, 0.7 + 0.1 q cells
//      bits 20-23  random

const float LIFE = 40.0;   // real seconds a piece lasts

vec2 S;
ivec2 GR;

struct Piece {
    int kind;
    vec2 pos;
    vec2 vel;
    float age;
    int bits;
};

Piece decodePiece(vec4 t)
{
    Piece d;
    d.bits = fi(t.w);
    d.kind = d.bits & 3;
    int px = fi(t.x);
    d.pos = (vec2(float(px & 4095), float(px >> 12)) + 0.5) / 4096.0;
    int pv = fi(t.y);
    d.vel = vec2(float(pv & 4095), float(pv >> 12)) / 64.0 - 32.0;
    d.age = t.z;
    return d;
}

vec4 encodePiece(Piece d)
{
    ivec2 q = clamp(ivec2(d.pos * 4096.0), 0, 4095);
    ivec2 v = clamp(ivec2(floor((d.vel + 32.0) * 64.0 + 0.5)), 0, 4095);
    return vec4(float(q.x + 4096 * q.y), float(v.x + 4096 * v.y), d.age, float(d.bits));
}

int angleBits(float a)
{
    return int(floor(fract(a / TAU) * 64.0 + 0.5)) & 63;
}

// One step of a piece's flight: gravity, air drag toward the breeze, and a
// side-to-side flutter for leaves and petals. Cells/s and cells/s^2.
void fly(inout Piece d, float dt)
{
    float sd = float((d.bits >> 20) & 15);
    vec2 acc;
    float wind = 0.45 * sin(iTime * 0.037 + 1.3) + 0.2;
    if (d.kind == 1) {
        acc = vec2(0.0, -11.0) + (vec2(wind, 0.0) - d.vel) * 1.3;
    } else if (d.kind == 2) {
        float fl = 7.0 * sin(d.age * (2.2 + 0.08 * sd) + sd);
        acc = vec2(fl, -9.0) + (vec2(wind, 0.0) - d.vel) * 2.4;
    } else {
        float fl = 6.0 * sin(d.age * (3.0 + 0.1 * sd) + sd * 1.7);
        acc = vec2(fl, -5.5) + (vec2(wind * 1.3, 0.0) - d.vel) * 2.9;
    }
    d.vel = clamp(d.vel + acc * dt, vec2(-31.0), vec2(31.0));
    d.age += dt;
}

// Cursor velocity in cells/s, for flinging torn pieces along a drag.
vec2 cursorVel()
{
    float fdt = max(iTimeDelta * float(iSubsteps), 1e-3);
    vec2 v = (iMouse.xy - iMousePrev) * S / fdt;
    float l = length(v);
    return l > 12.0 ? v * (12.0 / l) : v;
}

vec4 spawnTorn(ivec2 c, Node n)
{
    Piece d;
    d.kind = 1;
    d.pos = n.pos;
    d.age = 0.0;
    float h1 = hashC(c, 51);
    float h2 = hashC(c, 52);
    d.vel = vec2((h1 - 0.5) * 2.4, 0.3 + 1.5 * h2) + cursorVel() * 0.18;
    float te = endTangent(n, c);
    Leaf lf;
    vec2 N = vec2(c) + n.pos;
    uint key = cellKey(c);
    bool leaf = leafOf(n, c, key, N, te, lf);
    bool flower = hasFlower(n, key);
    int tint = leaf ? int(clamp((lf.phase - 0.8) * 70.0, 0.0, 15.0)) : 0;
    int lq = int(clamp((lf.len - 0.7) * 10.0 + 0.5, 0.0, 7.0));
    d.bits = 1 | (n.species << 2) | (tint << 4) | (angleBits(te) << 8)
           | ((lf.side > 0.0 ? 1 : 0) << 14) | ((flower ? 1 : 0) << 15) | ((leaf ? 1 : 0) << 16)
           | (lq << 17) | (int(h1 * 16.0) << 20);
    return encodePiece(d);
}

// Leaf or petal event of a node in the block around c whose leaf (or
// flower) centre lies in c.
bool spawnEvent(ivec2 c, out vec4 outv)
{
    outv = vec4(0.0);
    for (int k = -1; k < 8; k++) {
        ivec2 nc = k < 0 ? c : c + DIRS[k];
        if (!inGrid(nc, GR)) continue;
        vec4 raw = texelFetch(iChannel0, nc, 0);
        int f = fi(raw.x);
        if ((f & 0xC00) == 0) continue;
        Node n = decodeNode(raw);
        vec2 N = vec2(nc) + n.pos;
        float te = endTangent(n, nc);
        uint key = cellKey(nc);
        if (n.evLeaf) {
            Leaf lf;
            if (leafOf(n, nc, key, N, te, lf)) {
                vec2 ctr = lf.base + dirOf(lf.ang) * (0.5 * lf.len);
                if (ivec2(floor(ctr)) == c) {
                    Piece d;
                    d.kind = 2;
                    d.pos = ctr - vec2(c);
                    d.age = 0.0;
                    float h = hashC(nc, 53);
                    d.vel = vec2((h - 0.5) * 0.6, 0.0);
                    int tint = n.kind == K_WITHER ? 14 + int(h * 2.0) : 9 + int(h * 5.0);
                    int lq = int(clamp((lf.len - 0.7) * 10.0 + 0.5, 0.0, 7.0));
                    d.bits = 2 | (n.species << 2) | (min(tint, 15) << 4) | (angleBits(lf.ang) << 8)
                           | ((lf.side > 0.0 ? 1 : 0) << 14) | (lq << 17) | (int(h * 16.0) << 20);
                    outv = encodePiece(d);
                    return true;
                }
            }
        }
        if (n.evPetal) {
            vec4 fl = flowerOf(n, nc, key, N, te);
            float h = hashC(nc, 54 + int(n.age));
            vec2 ctr = fl.xy + (vec2(h, fract(h * 13.7)) - 0.5) * fl.z;
            if (ivec2(floor(ctr)) == c) {
                Piece d;
                d.kind = 3;
                d.pos = ctr - vec2(c);
                d.age = 0.0;
                d.vel = vec2((h - 0.5) * 0.8, 0.2);
                d.bits = 3 | (n.species << 2) | (angleBits(h * TAU) << 8) | (int(fract(h * 7.1) * 16.0) << 20);
                outv = encodePiece(d);
                return true;
            }
        }
    }
    return false;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    vec2 res = iResolution.xy;
    GR = gridSize(res);
    if (!inGrid(ic, GR)) {
        fragColor = vec4(0.0);
        return;
    }
    S = vec2(1.0 / cellTexels(res));
    float dt = iTimeDelta;

    vec4 a = texelFetch(iChannel0, ic, 0);
    if ((fi(a.x) & 3) == K_TORN) {
        fragColor = spawnTorn(ic, decodeNode(a));
        return;
    }
    vec4 ev;
    if (spawnEvent(ic, ev)) {
        fragColor = ev;
        return;
    }
    for (int k = -1; k < 8; k++) {
        ivec2 sc = k < 0 ? ic : ic + DIRS[k];
        if (!inGrid(sc, GR)) continue;
        vec4 raw = texelFetch(iChannel1, sc, 0);
        if (raw.w < 0.5) continue;
        Piece d = decodePiece(raw);
        if (d.kind == 0) continue;
        fly(d, dt);
        if (d.age > LIFE) continue;
        vec2 np = vec2(sc) + d.pos + d.vel * dt;
        if (ivec2(floor(np)) != ic) continue;
        d.pos = np - vec2(ic);
        fragColor = encodePiece(d);
        return;
    }
    fragColor = vec4(0.0);
}
