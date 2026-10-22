// Ivy — Buffer A: the vines.
// @channels self
//
// One texel per grid cell; layout and globals in ivy_common.frag. Every
// texel derives its update from the previous step only, so a tip and the
// empty cell it grows into agree on the growth decision: both evaluate
// intentOf() on the tip's previous state.
//
// Every step: ages advance; a node that clung to a window and lost it tears
// off (the window moved) or withers (windows vanished: Show Desktop,
// minimise, desktop switch); a node whose parent is gone follows unless it
// clings to a support itself, in which case it becomes a root; children are
// recounted. Every growth tick (TICK growth seconds, never on consecutive
// steps, so child counts are current): tips extend, young nodes branch,
// roots sprout along the screen edges and from behind windows, old childless
// nodes wither. A press on bare desktop plants a seed.

vec4 G0;
vec4 G1;
bool tick;
int tickN;
float rate;
float load;
float cover;
float cfac;
float cfacSup;
float pressure;
bool gentle;
bool hold;
bool vanished;
bool pressStart;
vec2 S;      // pass pixels to cells
vec2 W;      // screen size, cells
ivec2 GR;    // grid size

vec4 cellRaw(ivec2 c)
{
    return inGrid(c, GR) ? texelFetch(iChannel0, c, 0) : vec4(0.0);
}

int kindAt(ivec2 c)
{
    return fi(cellRaw(c).x) & 3;
}

bool occupied(ivec2 c)
{
    int k = kindAt(c);
    return k == K_ALIVE || k == K_WITHER;
}

// ------------------------------------------------------------- growth

struct Steer {
    float ang;
    int role;
};

// A shoot heading clearly away from a support, or away and already clear of
// it, or on its first step, ignores it.
bool leaving(float d, vec2 nr, vec2 h, bool fresh)
{
    float a = dot(h, nr);
    return a > 0.75 || (a > 0.3 && (d > 1.2 || fresh));
}

void consider(float d, vec2 nr, vec2 h, bool fresh, inout float dF, inout vec2 nF)
{
    if (d < 0.0) return;
    if (leaving(d, nr, h, fresh)) return;
    if (d < dF) {
        dF = d;
        nF = nr;
    }
}

// Desired heading for a shoot at N heading th. Supports within HUG_R are
// followed along their tangent, preferring up; windows within SENSE draw a
// curling tendril; otherwise shoots turn toward the light and drapes hang.
// A shoot ignores a support it is growing away from.
Steer steerAt(vec2 N, float th, int role, bool fresh, bool seeker, int run, int order)
{
    Steer s;
    s.role = role;
    if (role == R_DRAPE) {
        s.ang = -0.5 * PI + 0.3 * sin(float(run) * 0.9 + float(order));
        return s;
    }
    vec2 h = dirOf(th);
    float dF = 1e9;
    vec2 nF = vec2(0.0, 1.0);
    float dW = 1e9;
    vec2 nW = vec2(0.0, 1.0);
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec2 nr;
        float d = boxDist(N, winBox(i, S), nr);
        if (d < 0.0) continue;
        if (leaving(d, nr, h, fresh)) continue;
        if (d < dF) {
            dF = d;
            nF = nr;
        }
        if (d < dW) {
            dW = d;
            nW = nr;
        }
    }
    consider(max(N.y - GROUND, 0.0), vec2(0.0, 1.0), h, fresh, dF, nF);
    consider(max(N.x - 0.5, 0.0), vec2(1.0, 0.0), h, fresh, dF, nF);
    consider(max(W.x - 0.5 - N.x, 0.0), vec2(-1.0, 0.0), h, fresh, dF, nF);

    if (dF < HUG_R) {
        vec2 t = vec2(-nF.y, nF.x);
        if (dot(t, h) + 0.35 * t.y < -dot(t, h) - 0.35 * t.y) t = -t;
        vec2 want = t + nF * clamp((HUG_D - dF) * 1.6, -1.0, 1.0);
        s.ang = atan(want.y, want.x);
        s.role = R_CLIMB;
        return s;
    }
    if (seeker && dW < SENSE) {
        float r = float(run);
        float wob = 0.45 * sin(r * 0.95 + float(order) * 2.1) + 0.25 * sin(r * 2.3 + 1.7);
        s.ang = atan(-nW.y, -nW.x) + wob;
        s.role = R_TENDRIL;
        return s;
    }
    // Free shoot: rises, leans the way it already leans, then droops.
    float lean = h.x >= 0.0 ? -1.0 : 1.0;
    s.ang = 0.5 * PI + lean * clamp(float(run) * 0.24 - 0.2, 0.0, 1.7);
    s.role = R_CLIMB;
    return s;
}

float lifespan(Node n, ivec2 c)
{
    float base = n.order == 0 ? 1500.0 : (n.order == 1 ? 520.0 : 260.0);
    if (n.role == R_TENDRIL) base = min(base, 700.0);
    if (n.role == R_DRAPE) base = min(base, 600.0);
    bool loose = n.run > 0 || n.role != R_CLIMB;
    if (n.role == R_TENDRIL && n.children == 0 && n.run >= 24) base *= 0.25;
    return base * (0.6 + 0.8 * hashC(c, 21)) * mix(1.0, loose ? 0.25 : 0.6, pressure);
}

// A tip that ran too far without support, or hung too far down, stops.
bool stopped(Node n, ivec2 c)
{
    int rmax = n.role == R_TENDRIL ? 24 : (n.vigor ? 16 : 4 + int(7.0 * hashC(c, 22)));
    if (n.run >= rmax) return true;
    int dmax = n.role == R_DRAPE ? 3 + int(8.0 * hashC(c, 23)) : 2 + int(5.0 * hashC(c, 23));
    return n.down >= dmax;
}

struct Intent {
    bool go;
    bool branch;
    ivec2 target;
    vec2 pos;
    float tau;
    int role;
};

Intent intentOf(Node n, ivec2 c)
{
    Intent it;
    it.go = false;
    it.branch = false;
    it.target = c;
    it.pos = vec2(0.5);
    it.tau = 0.0;
    it.role = n.role;
    if (n.kind != K_ALIVE) return it;
    int salt = (tickN & 0xfffff) * 8;
    float roll = hashC(c, salt + 1);
    bool tip = n.children == 0;
    float life = lifespan(n, c);
    if (tip) {
        if (n.age > life || stopped(n, c)) return it;
        float p = n.role == R_TENDRIL ? 0.42 : (n.role == R_DRAPE ? 0.22 : (n.attached ? 0.36 : 0.30));
        if (n.vigor) p = min(p * 2.6, 0.95);
        if (n.dormant) p = 0.012;
        float f = n.vigor ? 1.0 : ((n.run == 0 || n.role == R_TENDRIL) ? cfacSup : cfac);
        if (roll >= p * f) return it;
    } else if (n.seed && n.pdir == 0 && n.children < 3 && n.age > 1.5 && n.age < 40.0) {
        // A seed puts out up to three shoots.
        if (roll >= 0.25) return it;
        it.branch = true;
    } else if (n.children == 1 && n.order < 3 && n.role != R_TENDRIL && n.age > 5.0 && n.age < 0.5 * life) {
        if (roll >= 0.012 * (n.run == 0 ? cfacSup : cfac)) return it;
        it.branch = true;
    } else {
        return it;
    }

    vec2 N = vec2(c) + n.pos;
    float te = endTangent(n, c);
    float th0 = te;
    int role = n.role;
    if (it.branch) {
        th0 += (hashC(c, salt + 2) < 0.5 ? -1.0 : 1.0) * (0.75 + 0.5 * hashC(c, salt + 3));
        role = sin(th0) < -0.55 ? R_DRAPE : R_CLIMB;
    }
    Steer s = steerAt(N, th0, role, it.branch || n.pdir == 0, n.seeker, n.run, n.order);
    float maxTurn = s.role == R_TENDRIL ? 0.45 : 0.32;
    float th1 = th0 + clamp(wrapAngle(s.ang - th0), -maxTurn, maxTurn)
              + (hashC(c, salt + 4) - 0.5) * 0.35;
    if (tip && n.fails > 0) {
        // Retries fan out to both sides of the blocked heading.
        float side = ((n.fails & 1) == 1) == (hashC(c, 24) < 0.5) ? -1.0 : 1.0;
        th1 += float((n.fails + 1) / 2) * 0.55 * side;
    }
    // The new node lands one step along th1, in whichever neighbour cell
    // that step reaches.
    vec2 q = N + dirOf(th1) * (1.0 + 0.2 * (hashC(c, salt + 5) - 0.5));
    ivec2 t = ivec2(floor(q));
    if (t == c) {
        q = N + dirOf(th1) * 1.45;
        t = ivec2(floor(q));
    }
    t = clamp(t, c - 1, c + 1);
    it.pos = clamp(q - vec2(t), 0.03, 0.97);
    vec2 ch = vec2(t) + it.pos - N;
    float tc = atan(ch.y, ch.x);
    it.tau = tc - clamp(wrapAngle(tc - th0), -0.6, 0.6);
    it.target = t;
    it.role = s.role;
    it.go = true;
    return it;
}

bool edgeSupport(vec2 Q)
{
    return Q.y - GROUND < HUG_R || Q.x < HUG_R + 0.5 || Q.x > W.x - HUG_R - 0.5
        || Q.y > W.y - HUG_R - 0.5;
}

// Occupancy of the block around t: bit k for t + DIRS[k], bit 8 for t.
int occupancy(ivec2 t)
{
    int m = 0;
    for (int k = 0; k < 8; k++) {
        if (occupied(t + DIRS[k])) m |= 1 << k;
    }
    if (kindAt(t) != K_EMPTY) m |= 256;
    return m;
}

// The target must be free, on screen, clear of windows, and have at most
// one occupied neighbour besides the growing node and its parent; two along
// a support, where vines crowd.
bool validTarget(Intent it, ivec2 from, Node n, int occ)
{
    if (!inGrid(it.target, GR) || (occ & 256) != 0) return false;
    vec2 Q = vec2(it.target) + it.pos;
    if (Q.x < 0.15 || Q.y < 0.15 || Q.x > W.x - 0.15 || Q.y > W.y - 0.15) return false;
    float dw = windowDist(Q, S);
    if (dw < 0.22) return false;
    int allowed = (dw < HUG_R || edgeSupport(Q)) ? 2 : 1;
    ivec2 gp = n.pdir > 0 ? from + DIRS[n.pdir - 1] : ivec2(-99);
    int count = 0;
    for (int k = 0; k < 8; k++) {
        ivec2 nc = it.target + DIRS[k];
        if ((occ & (1 << k)) != 0 && nc != from && nc != gp) count++;
    }
    return count <= allowed;
}

int dirIndex(ivec2 d)
{
    for (int k = 0; k < 8; k++) {
        if (DIRS[k] == d) return k;
    }
    return 0;
}

Node makeChild(Node par, ivec2 from, ivec2 c, Intent it)
{
    Node ch;
    ch.kind = K_ALIVE;
    ch.pdir = dirIndex(from - c) + 1;
    ch.children = 0;
    ch.dormant = false;
    ch.evLeaf = false;
    ch.evPetal = false;
    ch.species = par.species;
    ch.seed = false;
    ch.role = it.role;
    ch.order = min(par.order + (it.branch ? 1 : 0), 3);
    ch.fails = 0;
    ch.pos = it.pos;
    ch.tau = it.tau;
    ch.age = 0.0;
    ch.ppos = par.pos;
    vec2 Q = vec2(c) + it.pos;
    float dw = windowDist(Q, S);
    bool sup = (dw >= 0.0 && dw < HUG_R) || edgeSupport(Q);
    ch.attached = dw >= 0.0 && dw < ATTACH_D;
    ch.run = sup ? 0 : par.run + 1;
    ch.vigor = par.vigor && !sup;
    if (ch.vigor && ch.role == R_TENDRIL) ch.role = R_CLIMB;
    ch.seeker = (it.branch && !par.seed) ? hashC(c, 34) < 0.06 : par.seeker;
    vec2 chord = Q - (vec2(from) + par.pos);
    ch.down = chord.y < -0.5 * length(chord) ? par.down + 1 : 0;
    return ch;
}

Node emptyNode()
{
    return decodeNode(vec4(0.0));
}

Node newRoot(vec2 pos, float th, int species, int role)
{
    Node r = emptyNode();
    r.kind = K_ALIVE;
    r.species = species;
    r.role = role;
    r.pos = pos;
    r.tau = th;
    return r;
}

// Roots sprout along the bottom, from the sides, hang from the top and
// emerge from behind windows along their edges; more densely during the
// start-up burst, and only while coverage is low.
bool rootHere(ivec2 c, out Node r)
{
    r = emptyNode();
    float low = 1.0 - smoothstep(0.5, 0.85, cover / COVERAGE);
    if (low <= 0.0) return false;
    float early = 1.0 - smoothstep(2.0, 7.0, load);
    bool bottom = c.y == 0 && c.x > 1 && c.x < GR.x - 2;
    bool side = (c.x == 0 || c.x == GR.x - 1) && c.y > 4 && c.y < GR.y - 4;
    bool top = c.y == GR.y - 1 && c.x > 2 && c.x < GR.x - 3;
    float p = bottom ? mix(0.0005, 0.004, early)
            : side ? mix(0.00015, 0.0012, early)
            : top ? mix(0.0001, 0.0006, early)
            : mix(0.00006, 0.002, early);
    if (hashC(c, (tickN & 0xfffff) * 8 + 6) >= p * low) return false;
    float hx = hashC(c, 31);
    float th;
    int role = R_CLIMB;
    vec2 pos;
    if (bottom) {
        // Half run along the ground, half rise from it.
        float hr = hashC(c, 33);
        th = hr < 0.5 ? (hr < 0.25 ? 0.15 : PI - 0.15) : 0.5 * PI + (hx - 0.5) * 0.9;
        pos = vec2(0.2 + 0.6 * hx, 0.65);
    } else if (side) {
        th = (c.x == 0 ? 0.4 : PI - 0.4) + (hx - 0.5) * 0.5;
        pos = vec2(c.x == 0 ? 0.55 : 0.45, 0.2 + 0.6 * hx);
    } else if (top) {
        th = -0.5 * PI + (hx - 0.5) * 0.4;
        role = R_DRAPE;
        pos = vec2(0.2 + 0.6 * hx, 0.5);
    } else {
        // Along a window edge, heading up it or along it.
        vec2 Q = vec2(c) + 0.5;
        float best = 1e9;
        vec2 nrm = vec2(0.0, 1.0);
        for (int i = 0; i < iWindowCount && i < 16; i++) {
            if (!winValid(i)) continue;
            vec2 nr;
            float d = boxDist(Q, winBox(i, S), nr);
            if (d < best) {
                best = d;
                nrm = nr;
            }
        }
        if (best < 0.3 || best > 1.0) return false;
        vec2 t = vec2(-nrm.y, nrm.x);
        if (t.y < -0.1 || (abs(t.y) <= 0.1 && hx < 0.5)) t = -t;
        th = atan(t.y, t.x);
        pos = vec2(0.5);
    }
    for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -5; dx <= 5; dx++) {
            if (occupied(c + ivec2(dx, dy))) return false;
        }
    }
    float wd = windowDist(vec2(c) + pos, S);
    if (wd < 0.3 || ((bottom || side || top) && wd < 0.6)) return false;
    float hs = hashC(c, 32);
    int sp = hs < 0.42 ? S_IVY : (hs < 0.62 ? S_IVY2 : (hs < 0.84 ? S_GLORY : S_MOON));
    r = newRoot(pos, th, sp, role);
    r.seeker = hashC(c, 35) < 0.35;
    r.attached = wd < ATTACH_D;
    return true;
}

// A press on bare desktop above the panel plants a seed in the cell under
// the cursor, or the first free neighbour when that cell is taken.
bool seedHere(ivec2 c, out Node r)
{
    r = emptyNode();
    if (!pressStart) return false;
    vec2 m = iMouse.xy * S;
    if (m.y < 0.06 * W.y || m.x < 0.0 || m.x > W.x || m.y > W.y) return false;
    if (windowDist(m, S) < 0.4) return false;
    ivec2 mc = ivec2(floor(m));
    if (!inGrid(mc, GR)) return false;
    ivec2 target = mc;
    if (kindAt(mc) != K_EMPTY) {
        target = ivec2(-99);
        for (int k = 0; k < 8; k++) {
            ivec2 nc = mc + DIRS[k];
            if (inGrid(nc, GR) && kindAt(nc) == K_EMPTY) {
                target = nc;
                break;
            }
        }
    }
    if (c != target) return false;
    vec2 pos = c == mc ? clamp(m - vec2(c), 0.1, 0.9) : vec2(0.5);
    float hs = hashC(c, (tickN & 0xfffff) * 8 + 7);
    int sp = hs < 0.3 ? S_IVY : (hs < 0.4 ? S_IVY2 : (hs < 0.75 ? S_GLORY : S_MOON));
    r = newRoot(pos, 0.5 * PI + (hs - 0.5) * 0.6, sp, R_CLIMB);
    r.seed = true;
    r.vigor = true;
    r.seeker = true;
    return true;
}

// ------------------------------------------------------------- globals

float burst(float t)
{
    return 1.0 + 23.0 * (1.0 - smoothstep(4.0, 10.0, t));
}

vec4 updateG0()
{
    float acc = G0.y + iTimeDelta * rate;
    if (tick) acc = min(acc - TICK, TICK);
    int fl = (tick ? 1 : 0) | (iMouse.z > 0.0 ? 2 : 0);
    float tc = tick ? mod(G0.z + 1.0, 1048576.0) : G0.z;
    return vec4(min(G0.x + iTimeDelta, 1e4), acc, tc, float(fl));
}

vec4 updateG1()
{
    float cov = G1.x;
    if (tick) {
        float occ = 0.0;
        float vis = 0.0;
        for (int k = 0; k < 128; k++) {
            ivec2 key = ivec2(k, tickN & 1023);
            vec2 u = (vec2(float(k & 15), float(k >> 4)) + vec2(hashC(key, 41), hashC(key, 42)))
                   / vec2(16.0, 8.0);
            ivec2 sc = ivec2(u * vec2(GR));
            if (windowDist(vec2(sc) + 0.5, S) < 0.0) continue;
            vis += 1.0;
            if (occupied(sc)) occ += 1.0;
        }
        if (vis > 6.0) cov = G1.w < 0.5 ? occ / vis : mix(cov, occ / vis, 0.12);
    }
    float gl = max(G1.z - iTimeDelta, 0.0);
    if (vanished) gl = GRACE + GENTLE_T;
    return vec4(cov, float(iWindowCount), gl, 1.0 + float(iVirtualDesktop));
}

// ------------------------------------------------------------- cells

vec4 updateEmpty(ivec2 c)
{
    Node r;
    if (seedHere(c, r)) return encodeNode(r);
    if (!tick) return vec4(0.0);
    int occ = -1;
    for (int k = 0; k < 8; k++) {
        ivec2 nb = c + DIRS[k];
        if (!inGrid(nb, GR)) continue;
        vec4 raw = texelFetch(iChannel0, nb, 0);
        if ((fi(raw.x) & 3) != K_ALIVE) continue;
        Node m = decodeNode(raw);
        Intent it = intentOf(m, nb);
        if (!it.go || it.target != c) continue;
        if (occ < 0) occ = occupancy(c);
        if (!validTarget(it, nb, m, occ)) continue;
        return encodeNode(makeChild(m, nb, c, it));
    }
    if (rootHere(c, r)) return encodeNode(r);
    return vec4(0.0);
}

vec4 updateAlive(ivec2 c, vec4 raw)
{
    Node prev = decodeNode(raw);
    Node n = prev;
    n.evLeaf = false;
    n.evPetal = false;
    float dAge = iTimeDelta * rate;
    n.age = min(prev.age + dAge, 1e5);
    vec2 N = vec2(c) + n.pos;

    // Support.
    float dw = windowDist(N, S);
    bool winNear = dw < (n.attached ? RELEASE : HUG_R);
    bool selfSup = n.seed || edgeSupport(N) || winNear;
    bool parentOK = true;
    bool parentWither = false;
    if (n.pdir > 0) {
        vec4 pr = cellRaw(c + DIRS[n.pdir - 1]);
        int pk = fi(pr.x) & 3;
        parentOK = pk == K_ALIVE && pr.z >= prev.age;
        parentWither = pk == K_WITHER;
    }
    // A torn node keeps its age for one step so Buffer B can rebuild its leaf
    // and flower; a withering one counts real seconds from here.
    if (n.attached && !selfSup && !hold) {
        n.kind = gentle ? K_WITHER : K_TORN;
        if (gentle) n.age = 0.0;
        return encodeNode(n);
    }
    if (!parentOK) {
        if (!selfSup) {
            n.kind = (gentle || parentWither) ? K_WITHER : K_TORN;
            if (n.kind == K_WITHER) n.age = 0.0;
            return encodeNode(n);
        }
        n.tau = endTangent(prev, c);
        n.pdir = 0;
    }

    // Children: neighbours whose parent direction points here.
    int kids = 0;
    for (int k = 0; k < 8; k++) {
        vec4 nr = cellRaw(c + DIRS[k]);
        int f = fi(nr.x);
        int kk = f & 3;
        if ((kk == K_ALIVE || kk == K_WITHER) && ((f >> 2) & 15) == ((k + 4) & 7) + 1
            && nr.z <= n.age) kids++;
    }
    n.children = min(kids, 3);
    if (kids > 0) {
        n.fails = 0;
        n.dormant = false;
    }

    if (tick) {
        Intent it = intentOf(prev, c);
        if (it.go && !it.branch && !validTarget(it, c, prev, occupancy(it.target))) {
            n.fails = prev.fails + 1;
            if (n.fails >= 6) {
                n.dormant = true;
                n.fails = 0;
            }
        }
        if (prev.children == 0 && prev.age > lifespan(prev, c)
            && hashC(c, (tickN & 0xfffff) * 8 + 7) < 0.12) {
            n.kind = K_WITHER;
            n.age = 0.0;
            return encodeNode(n);
        }
    }

    // Leaf and petal events for Buffer B.
    uint key = cellKey(c);
    if (hasLeafSlot(n, key)) {
        float cyc = leafCycle(key);
        if (fract(prev.age / cyc) < LEAF_FALL && fract(n.age / cyc) >= LEAF_FALL) n.evLeaf = true;
    }
    if (hasFlower(n, key) && flowerOpen(n.species, iDate.w / 3600.0, key) > 0.75) {
        float per = petalPeriod(key);
        float o = keyHash(key, 20);
        if (floor(prev.age / per + o) != floor(n.age / per + o)) n.evPetal = true;
    }
    return encodeNode(n);
}

vec4 updateWither(ivec2 c, vec4 raw)
{
    Node n = decodeNode(raw);
    float a0 = n.age;
    n.evLeaf = false;
    n.evPetal = false;
    n.age = a0 + iTimeDelta;
    if (n.age >= WITHER_T) return vec4(0.0);
    if (a0 < LEAF_DROP_W && n.age >= LEAF_DROP_W && hasLeafSlot(n, cellKey(c))) n.evLeaf = true;
    return encodeNode(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    vec2 res = iResolution.xy;
    ivec2 R = ivec2(res);
    G0 = texelFetch(iChannel0, R - 1, 0);
    G1 = texelFetch(iChannel0, R - ivec2(2, 1), 0);
    GR = gridSize(res);
    float ct = cellTexels(res);
    S = vec2(1.0 / ct);
    W = res / ct;
    load = G0.x;
    rate = GROWTH * burst(load);
    tick = G0.y + iTimeDelta * rate >= TICK && (fi(G0.w) & 1) == 0;
    tickN = int(G0.z);
    cover = G1.x;
    cfac = 1.0 - smoothstep(0.75, 0.95, cover / COVERAGE);
    cfacSup = 1.0 - smoothstep(0.95, 1.15, cover / COVERAGE);
    pressure = smoothstep(0.95, 1.2, cover / COVERAGE);
    // Windows that vanish (Show Desktop, minimise, desktop switch) are given
    // GRACE seconds to return before their vines wither.
    vanished = G1.w > 0.5 && (float(iWindowCount) < G1.y - 0.5
                              || abs(G1.w - 1.0 - float(iVirtualDesktop)) > 0.5);
    gentle = G1.z > 0.0 || vanished;
    hold = G1.z > GENTLE_T || vanished;
    pressStart = iMouse.z > 0.0 && (fi(G0.w) & 2) == 0;

    if (ic == R - 1) {
        fragColor = updateG0();
        return;
    }
    if (ic == R - ivec2(2, 1)) {
        fragColor = updateG1();
        return;
    }
    if (!inGrid(ic, GR)) {
        fragColor = vec4(0.0);
        return;
    }
    vec4 raw = texelFetch(iChannel0, ic, 0);
    int kind = fi(raw.x) & 3;
    if (kind == K_EMPTY) fragColor = updateEmpty(ic);
    else if (kind == K_ALIVE) fragColor = updateAlive(ic, raw);
    else if (kind == K_WITHER) fragColor = updateWither(ic, raw);
    else fragColor = vec4(0.0);
}
