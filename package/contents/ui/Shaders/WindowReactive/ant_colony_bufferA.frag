// Ant Colony — Buffer A: ants, food and colony state.
// @channels self, bufferC, bufferB
// @substeps 1
//
// Layout in ant_colony_common.frag. iChannel0 is this buffer's previous
// step; iChannel1 is Buffer C (fields) and iChannel2 Buffer B (nearest
// ants) as of the previous frame, since both run after A. The simulation
// steps once per frame (simStep in the common file).
//
// Both texels of an ant run the same update from the previous step and keep
// their half, so they agree. Ants take crumbs in turns; a food pile texel
// replays the pickup test of the ants whose turn it is, on the same inputs,
// to count the crumbs taken this step.
//
// Searching ants wander, follow the "to food" trail outward and walk
// straight to food they smell; on a pickup they turn for home. Returning
// ants descend the walking-distance field (path integration around the
// windows) with the "to home" trail as a tie-break, and enter the nest.

const float SPEED       = 0.04 * ANT_SPEED; // U/s
const float STRIDE      = 0.0042; // U walked per gait cycle
const float SENSE_DIST  = 0.012;  // U
const float SENSE_ANG   = 0.62;
const float MAX_TURN    = 7.0;    // rad/s
const float TRAIL_MIN   = 0.03;   // weakest scent an ant follows
const float FINGER_R    = 0.010;  // U
const float FINGER_TIME = 1.5;    // s the cursor blocks after it stops
const float SCATTER_V   = 0.55;   // U/s of cursor travel that alarms ants
const float LAY_TIME    = 50.0;   // s for laid scent to fall to 1/e
const float HANDLING    = 10.0;   // ant record w >= HANDLING: working at food for w - HANDLING s
const int   PICK_TURNS  = 16;     // steps in a round of pickup turns
const float GHOST_TIME  = 30.0;   // s a finished food item still turns searchers away

vec4 P0[NPILE];
vec4 P1[NPILE];
vec4 G0;
vec4 G1;

vec4 field(vec2 p)
{
    ivec2 c = clamp(ivec2(p * unitPx()), ivec2(0), ivec2(iResolution.xy) - 1);
    return texelFetch(iChannel1, c, 0);
}

vec2 dirOf(float a) { return vec2(cos(a), sin(a)); }

float wrapAngle(float a) { return mod(a + PI, TAU) - PI; }

// Signed turn from heading a toward heading b, -PI..PI.
float turnTo(float a, float b) { return wrapAngle(b - a); }

uint stepSeed(int i)
{
    return hashu(uint(i) * 0x9E3779B9u ^ hashu(uint(iFrame) * 8u + uint(iSubstep)));
}

bool underAnyWindow(vec2 p, float margin)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!windowValid(i)) continue;
        vec4 b = windowBox(i);
        if (p.x > b.x - margin && p.y > b.y - margin && p.x < b.z + margin && p.y < b.w + margin) return true;
    }
    return false;
}

bool cursorOnDesktop()
{
    bool on = (iMouse.x > 1.0 || iMouse.y > 1.0) && iMouse.x < iResolution.x && iMouse.y < iResolution.y;
    return on && !insideWindowPx(iMouse.xy);
}

bool blockedAt(vec2 p, bool finger, vec2 cur)
{
    vec2 ws = worldSize();
    if (p.x < 0.004 || p.y < 0.004 || p.x > ws.x - 0.004 || p.y > ws.y - 0.004) return true;
    if (finger && distance(p, cur) < FINGER_R) return true;
    return windowAt(p, WIN_MARGIN) >= 0;
}

// ------------------------------------------------------------- food

bool pileOpen(int k) { return P0[k].z > 0.5 && P1[k].y > 0.4; }

float pileR(int k) { return pileRadius(int(P1[k].x + 0.5), P0[k].z, P0[k].w); }

// Food within an ant's reach at p, else -1.
int reachPile(vec2 p)
{
    for (int k = 0; k < NPILE; k++) {
        if (pileOpen(k) && distance(p, P0[k].xy) < pileR(k) + 0.0045) return k;
    }
    return -1;
}

// Seconds ant i works at the food before a crumb comes loose.
float handleTime(int i) { return 1.2 + 1.6 * hashf(uint(i) * 2246822519u + 5u); }

// Ants take crumbs in turns: on a step only ids congruent to the step
// counter modulo PICK_TURNS may, so a pile replays 1/PICK_TURNS of the colony.
int pickTurn() { return int(G1.w + 0.5); }

// Pile ant i (records a0, a1 of the previous step) takes a crumb from this
// step, else -1.
int pickedPile(int i, vec4 a0, vec4 a1)
{
    if (i % PICK_TURNS != pickTurn()) return -1;
    if (modeOf(a0.w) != MODE_SEARCH || a1.w < HANDLING) return -1;
    if (a1.w - HANDLING + simDt() < handleTime(i)) return -1;
    return reachPile(a0.xy);
}

int countPickups(int k)
{
    if (!pileOpen(k)) return 0;
    vec2 c = P0[k].xy;
    float r = pileR(k) + 0.0045;
    int n = 0;
    int cnt = antCount();
    int turn = pickTurn();
    // Eight fetches in flight per round; one at a time is latency bound.
    for (int r0 = 0; r0 < MAX_ANTS / PICK_TURNS; r0 += 8) {
        if (turn + r0 * PICK_TURNS >= cnt) break;
        vec4 b[8];
        for (int j = 0; j < 8; j++) b[j] = texelFetch(iChannel0, antTexel(min(turn + (r0 + j) * PICK_TURNS, MAX_ANTS - 1), 0), 0);
        for (int j = 0; j < 8; j++) {
            int i = turn + (r0 + j) * PICK_TURNS;
            if (i >= cnt || modeOf(b[j].w) != MODE_SEARCH || distance(b[j].xy, c) >= r) continue;
            if (pickedPile(i, b[j], texelFetch(iChannel0, antTexel(i, 1), 0)) == k) n++;
        }
    }
    return n;
}

// Reach of a food item's smell beyond its edge, U.
float smellOf(int kind) { return kind == FOOD_CRUMBS ? 0.12 : (kind == FOOD_LEAF ? 0.07 : 0.09); }

// Nearest food a searching ant at p smells, else -1. Food under a window
// gives no scent.
int smelledPile(vec2 p)
{
    int best = -1;
    float bd = 1e9;
    for (int k = 0; k < NPILE; k++) {
        if (!pileOpen(k)) continue;
        float d = distance(p, P0[k].xy) - pileR(k);
        if (d < smellOf(int(P1[k].x + 0.5)) && d < bd && !underAnyWindow(P0[k].xy, 0.0)) {
            bd = d;
            best = k;
        }
    }
    return best;
}

// True near a food item finished less than GHOST_TIME ago.
bool nearGhost(vec2 p)
{
    for (int k = 0; k < NPILE; k++) {
        if (P0[k].z < 0.5 && P0[k].w < -0.5 && distance(p, P0[k].xy) < 0.045) return true;
    }
    return false;
}

// The first food item: up and to the right of the nest where the straight
// way there is clear of windows. Its kind changes daily.
int initKind() { return 1 + int(mod(iDate.z, 3.0)); }

vec2 initFoodPos()
{
    vec2 nest = nestPos();
    vec2 ws = worldSize();
    for (int k = 0; k < 12; k++) {
        float ang = 0.5 + float(k) * 0.83;
        float r = 0.46 - 0.06 * float(k % 3);
        vec2 p = nest + r * dirOf(ang);
        if (p.x < 0.08 || p.y < 0.14 || p.x > ws.x - 0.08 || p.y > ws.y - 0.08) continue;
        bool clear = true;
        for (int j = 0; j <= 12; j++) {
            if (underAnyWindow(mix(nest, p, float(j) / 12.0), 0.02)) clear = false;
        }
        if (clear) return p;
    }
    return clamp(nest + vec2(0.4, 0.25), vec2(0.08, 0.14), ws - 0.08);
}

// A free slot for new food: an empty one, else the oldest finished one,
// else -1.
int freeSlot()
{
    int slot = -1;
    float oldest = 1.0;
    for (int k = 0; k < NPILE; k++) {
        if (P0[k].z > 0.5) continue;
        if (P0[k].w > -0.5) return k;
        if (P0[k].w < oldest) { oldest = P0[k].w; slot = k; }
    }
    return slot;
}

// Food dropped this step: the slot (-1 none) and its records. topUp is
// true when a click lands on a crumb pile, which then gains crumbs.
int spawnEvent(out vec4 n0, out vec4 n1, out bool topUp)
{
    n0 = vec4(0.0);
    n1 = vec4(0.0);
    topUp = false;
    vec2 ws = worldSize();

    bool pressStart = iMouse.z > 0.0 && G0.y < 0.5;
    if (pressStart && cursorOnDesktop() && iMouse.y > 0.065 * iResolution.y) {
        vec2 c = iMouse.xy / unitPx();
        for (int k = 0; k < NPILE; k++) {
            if (P0[k].z > 0.5 && int(P1[k].x + 0.5) == FOOD_CRUMBS && distance(c, P0[k].xy) < pileR(k) + 0.008) {
                topUp = true;
                n0 = P0[k];
                n0.z = min(n0.z + 20.0, 100.0);
                n0.w = max(n0.w, n0.z);
                n1 = P1[k];
                n1.z = P0[k].z;
                n1.w = 0.0;
                return k;
            }
        }
        int slot = freeSlot();
        float fewest = 1e9;
        for (int k = 0; k < NPILE; k++) {
            if (slot < 0 && P0[k].z < fewest) { fewest = P0[k].z; slot = k; }
        }
        float n = crumbsOf(FOOD_CRUMBS);
        n0 = vec4(c, n, n);
        n1 = vec4(float(FOOD_CRUMBS), 0.0, 0.0, 0.0);
        return slot;
    }

    // A natural item when its timer runs out, at most three at a time.
    if (G1.y > 0.0 && G0.z >= G1.y) {
        int slot = freeSlot();
        int natural = 0;
        for (int k = 0; k < NPILE; k++) {
            if (P0[k].z > 0.5 && int(P1[k].x + 0.5) != FOOD_CRUMBS) natural++;
        }
        if (slot < 0 || natural >= 3) return -1;
        uint s = uint(G1.x) * 977u + 12345u;
        vec2 nest = nestPos();
        for (int t = 0; t < 10; t++) {
            uint h = hashu(s * 16u + uint(t));
            float ang = hashf(h) * TAU;
            float r = 0.25 + 0.8 * hashf(h ^ 0x5bd1e995u);
            vec2 p = nest + r * dirOf(ang);
            if (p.x < 0.07 || p.y < 0.14 || p.x > ws.x - 0.07 || p.y > ws.y - 0.07) continue;
            if (underAnyWindow(p, 0.03) || distance(p, nest) < MOUND_R + 0.12) continue;
            bool crowded = false;
            for (int k = 0; k < NPILE; k++) {
                if (P0[k].z > 0.5 && distance(p, P0[k].xy) < 0.12) crowded = true;
            }
            if (crowded) continue;
            // Sugar, berry and leaf take turns.
            int kind = FOOD_SUGAR + (int(G1.x + 0.5) + initKind()) % 3;
            float n = crumbsOf(kind);
            n0 = vec4(p, n, n);
            n1 = vec4(float(kind), 0.0, 0.0, 0.0);
            return slot;
        }
    }
    return -1;
}

// ------------------------------------------------------------- ants

// Crowding: the ants tracked around a point just ahead. A close ant ahead
// going the same way makes this one queue behind it; any close ant ahead
// makes it step aside, so oncoming traffic passes in two lanes. Returns
// the number of tracked ants within a body length.
int avoid(int i, vec2 pos, float hd, inout float turn, inout float slow)
{
    vec2 fwd = dirOf(hd);
    ivec2 c = clamp(ivec2((pos + fwd * 0.4 * ANT_LEN) * unitPx()), ivec2(0), ivec2(iResolution.xy) - 1);
    vec4 ids = texelFetch(iChannel2, c, 0);
    int crowd = 0;
    for (int k = 0; k < 4; k++) {
        int j = int(ids[k] + 0.5) - 1;
        if (j < 0 || j == i) continue;
        vec4 b = texelFetch(iChannel0, antTexel(j, 0), 0);
        if (modeOf(b.w) < MODE_SEARCH) continue;
        vec2 d = b.xy - pos;
        float dist = length(d);
        if (dist < ANT_LEN) crowd++;
        if (dist > 1.1 * ANT_LEN || dot(d, fwd) <= 0.0) continue;
        float close = 1.0 - dist / (1.1 * ANT_LEN);
        turn -= 4.0 * close * (fwd.x * d.y - fwd.y * d.x >= 0.0 ? 1.0 : -1.0);
        if (dot(dirOf(b.z), fwd) > 0.3) slow = min(slow, mix(1.0, 0.65, close));
    }
    return crowd;
}

// Ants that follow food trails; the others keep exploring.
bool follower(int i) { return hashf(uint(i) * 3266489917u + 11u) < 0.55; }

// Seconds a searching ant keeps looking before it heads home.
float patience(int i) { return 55.0 + 70.0 * hashf(uint(i) * 2654435761u + 7u); }

// Load: ants on the way to and from the first food, a crowd searching
// around the nest, the rest about to come out.
void seedAnt(int i, out vec4 o0, out vec4 o1)
{
    o0 = vec4(0.0);
    o1 = vec4(0.0);
    if (i >= antCount()) return;
    vec2 nest = nestPos();
    vec2 food = initFoodPos();
    vec2 ws = worldSize();
    uint h = hashu(uint(i) * 747796405u + 2891336453u);
    float f = hashf(h);
    float r1 = hashf(h ^ 0x68e31da4u);
    float r2 = hashf(h ^ 0xb5297a4du);
    float r3 = hashf(h ^ 0x1b56c4e9u);
    float gait = hashf(h ^ 0x7fb5d329u);
    vec2 axis = food - nest;
    float len = length(axis);
    vec2 fwd = axis / len;
    vec2 pos;
    float hd;
    int mode;
    int carry = 0;
    float t;
    if (f < 0.06) {
        pos = nest + fwd * mix(0.02, len - 0.02, r1) + vec2(-fwd.y, fwd.x) * (r2 - 0.5) * 0.006;
        if (r3 < 0.55) {
            mode = MODE_RETURN;
            carry = initKind() + 1;
            hd = atan(-fwd.y, -fwd.x) + (r2 - 0.5) * 0.4;
            t = (1.0 - r1) * len / SPEED;
        } else {
            mode = MODE_SEARCH;
            hd = atan(fwd.y, fwd.x) + (r2 - 0.5) * 0.4;
            t = r1 * len / SPEED;
        }
    } else if (f < 0.85) {
        float r = 0.07 + 0.6 * sqrt(r1);
        float a = r2 * TAU;
        pos = nest + r * dirOf(a);
        hd = a + (r3 - 0.5) * 2.5;
        mode = MODE_SEARCH;
        t = r / SPEED * 1.4;
    } else {
        o0 = vec4(nest, r1 * TAU, packCode(MODE_NEST, 0, 0.0));
        o1 = vec4(0.0, 0.0, gait, 1.0 + 16.0 * r2);
        return;
    }
    if (blockedAt(pos, false, vec2(-1.0))) {
        o0 = vec4(nest, r1 * TAU, packCode(MODE_NEST, 0, 0.0));
        o1 = vec4(0.0, 0.0, gait, 1.0 + 12.0 * r2);
        return;
    }
    float strength = (mode == MODE_SEARCH || carry > 0) ? exp(-t / LAY_TIME) : 0.0;
    o0 = vec4(pos, wrapAngle(hd), packCode(mode, carry, strength));
    o1 = vec4(t, 0.0, gait, (r3 - 0.5) * 1.5);
}

// Way out from under window w: toward its nearest edge whose far side is
// free.
vec2 escapeDir(vec2 p, int w)
{
    vec4 b = windowBox(w);
    float m = WIN_MARGIN + 0.002;
    vec4 d = vec4(p.x - (b.x - m), (b.z + m) - p.x, p.y - (b.y - m), (b.w + m) - p.y);
    vec2 dirs[4] = vec2[4](vec2(-1.0, 0.0), vec2(1.0, 0.0), vec2(0.0, -1.0), vec2(0.0, 1.0));
    vec2 ws = worldSize();
    vec2 best = dirs[0];
    float bd = 1e9;
    vec2 fallback = dirs[0];
    float fd = 1e9;
    for (int k = 0; k < 4; k++) {
        float dk = d[k];
        if (dk < fd) { fd = dk; fallback = dirs[k]; }
        vec2 q = p + dirs[k] * (dk + 0.002);
        bool off = q.x < 0.004 || q.y < 0.004 || q.x > ws.x - 0.004 || q.y > ws.y - 0.004;
        if (off || windowAt(q, WIN_MARGIN) >= 0) continue;
        if (dk < bd) { bd = dk; best = dirs[k]; }
    }
    return bd < 1e8 ? best : fallback;
}

void updateAnt(int i, out vec4 o0, out vec4 o1)
{
    vec4 a0 = texelFetch(iChannel0, antTexel(i, 0), 0);
    vec4 a1 = texelFetch(iChannel0, antTexel(i, 1), 0);
    float dt = simDt();
    int mode = modeOf(a0.w);
    int carry = carryOf(a0.w);
    vec2 nest = nestPos();
    uint seed = stepSeed(i);
    float night = NIGHT > 0.5 ? nightAmount() : 0.0;
    bool sleepy = night > 0.5 && !isScout(i);
    float indiv = 0.86 + 0.28 * hashf(uint(i) * 7919u + 13u);

    if (i >= antCount()) {
        o0 = vec4(0.0);
        o1 = vec4(0.0);
        return;
    }
    if (mode == MODE_ABSENT) {
        o0 = vec4(nest, 0.0, packCode(MODE_NEST, 0, 0.0));
        o1 = vec4(0.0, 0.0, 0.0, 2.0 + 10.0 * hashf(seed));
        return;
    }

    if (mode == MODE_NEST) {
        float t = min(a1.x + dt, 1e4);
        float rest = a1.w;
        // A food trail at the entrance calls resting ants out sooner.
        float best = 0.0;
        float bestAng = hashf(seed ^ 0x9e37u) * TAU;
        for (int k = 0; k < 6; k++) {
            float a = float(k) * (TAU / 6.0) + 0.3;
            float v = field(nest + 0.022 * dirOf(a)).x;
            if (v > best) { best = v; bestAng = a; }
        }
        float recruit = follower(i) ? smoothstep(TRAIL_MIN, 0.3, best) : 0.0;
        if (sleepy) rest = max(rest, t * (1.0 + recruit) + 1.0);
        if (t * (1.0 + recruit) < rest) {
            o0 = vec4(nest, a0.z, packCode(MODE_NEST, 0, 0.0));
            o1 = vec4(t, 0.0, a1.z, rest);
            return;
        }
        float ang = follower(i) && hashf(seed ^ 0x51u) < 0.8 * recruit
            ? bestAng + (hashf(seed ^ 0x77u) - 0.5) * 0.5
            : hashf(seed ^ 0x99u) * TAU;
        o0 = vec4(nest + NEST_HOLE * 0.9 * dirOf(ang), wrapAngle(ang), packCode(MODE_SEARCH, 0, 1.0));
        o1 = vec4(0.0, 0.0, a1.z, (hashf(seed ^ 0x33u) - 0.5) * 1.5);
        return;
    }

    vec2 pos = a0.xy;
    float hd = a0.z;
    float t = min(a1.x + dt, 1e4);
    float alarm = a1.y > 0.0 ? max(a1.y - dt, 0.0) : 0.0;
    float bored = a1.y < 0.0 ? min(a1.y + dt, 0.0) : 0.0;
    float gait = a1.z;
    float wander = a1.w;
    vec2 ws = worldSize();
    pos = clamp(pos, vec2(0.005), ws - 0.005);

    // Cursor: a fingertip while it moves, a scare when it moves fast.
    vec2 cur = iMouse.xy / unitPx();
    bool curOn = cursorOnDesktop();
    float curSpeed = distance(iMouse.xy, iMousePrev) / unitPx() / max(iTimeDelta * float(iSubsteps), 1e-4);
    vec2 away = pos - cur;
    float curDist = length(away);
    // An ant the fingertip lands on walks out from under it.
    bool pinned = curOn && G0.x < FINGER_TIME && curDist < FINGER_R;
    bool finger = curOn && G0.x < FINGER_TIME && !pinned;
    if (curOn && curSpeed > SCATTER_V && curDist < clamp(curSpeed * 0.08, 0.04, 0.11)) {
        alarm = 0.8 + 0.5 * hashf(seed ^ 0xabcdu);
    }

    if (mode == MODE_SEARCH) {
        int k = pickedPile(i, a0, a1);
        int at = reachPile(pos);
        if (k >= 0) {
            mode = MODE_RETURN;
            carry = int(P1[k].x + 0.5) + 1;
            t = 0.0;
            hd += PI;
            wander = 0.0;
        } else if (at >= 0 && alarm <= 0.0 && !sleepy && windowAt(pos, WIN_MARGIN) < 0) {
            // Working a crumb loose: stand facing the food.
            vec2 to = P0[at].xy - pos;
            hd += turnTo(hd, atan(to.y, to.x)) * min(8.0 * dt, 1.0);
            float work = (wander >= HANDLING ? wander : HANDLING) + dt;
            o0 = vec4(pos, wrapAngle(hd), packCode(mode, carry, 0.0));
            o1 = vec4(t, alarm > 0.0 ? alarm : bored, gait, work);
            return;
        } else if (wander >= HANDLING) {
            wander = 0.0;
        }
        if (mode == MODE_SEARCH && (t > patience(i) || sleepy)) {
            mode = MODE_RETURN;
            carry = 0;
            t = 0.0;
        }
    } else if (distance(pos, nest) < NEST_HOLE * 0.8) {
        float rest = carry > 0 ? 1.0 + 4.0 * hashf(seed ^ 0x1234u) : 3.0 + 10.0 * hashf(seed ^ 0x4321u);
        o0 = vec4(nest, hd, packCode(MODE_NEST, 0, 0.0));
        o1 = vec4(0.0, 0.0, gait, rest);
        return;
    }

    // Under a window that moved onto it: walk out by the nearest free edge.
    int w = windowAt(pos, WIN_MARGIN);
    if (w >= 0) {
        vec2 d = escapeDir(pos, w);
        hd = atan(d.y, d.x);
        float spd = SPEED * indiv * 1.4;
        pos += d * spd * dt;
        gait = fract(gait + spd * dt / STRIDE);
        o0 = vec4(pos, hd, packCode(mode, carry, 0.0));
        o1 = vec4(t, alarm > 0.0 ? alarm : bored, gait, 0.0);
        return;
    }

    vec2 pL = pos + SENSE_DIST * dirOf(hd + SENSE_ANG);
    vec2 pC = pos + SENSE_DIST * dirOf(hd);
    vec2 pR = pos + SENSE_DIST * dirOf(hd - SENSE_ANG);
    vec4 sL = field(pL);
    vec4 sC = field(pC);
    vec4 sR = field(pR);
    bool bL = blockedAt(pL, finger, cur);
    bool bC = blockedAt(pC, finger, cur);
    bool bR = blockedAt(pR, finger, cur);

    // Wander: an Ornstein-Uhlenbeck turn rate, calmer for some ants.
    float calm = 0.6 + 0.8 * hashf(uint(i) * 40503u + 3u);
    float noise = (hashf(seed ^ 0xA1u) - 0.5) * 3.4641;
    wander += -2.0 * wander * dt + 1.15 * calm * noise * sqrt(dt) * (mode == MODE_SEARCH ? 1.0 : 0.7);

    float turn = wander;
    float slow = 1.0;
    int crowd = alarm <= 0.0 ? avoid(i, pos, hd, turn, slow) : 0;
    // A searcher in a crowd loses interest in trails and distant food for a
    // few seconds; this caps the traffic on a trail and around food.
    if (mode == MODE_SEARCH && crowd >= 3 && bored >= 0.0 && hashf(seed ^ 0x5Au) < 1.5 * dt) {
        bored = -3.0 - 4.0 * hashf(seed ^ 0x6Bu);
    }

    if (alarm > 0.0 || pinned) {
        if (curOn && curDist < 0.2) turn += 9.0 * turnTo(hd, atan(away.y, away.x));
    } else if (mode == MODE_SEARCH) {
        int sm = smelledPile(pos);
        if (sm >= 0 && bored < 0.0 && distance(pos, P0[sm].xy) - pileR(sm) > 0.02) sm = -1;
        if (sm >= 0) {
            vec2 to = P0[sm].xy - pos;
            turn += 7.0 * turnTo(hd, atan(to.y, to.x));
        } else if (bored >= 0.0 && follower(i)) {
            float m = max(sC.x, max(sL.x, sR.x));
            vec4 here = field(pos);
            if ((here.x > 0.12 && m < 0.3 * here.x) || nearGhost(pos)) {
                // The trail ends here with no food: leave it for a while.
                bored = -6.0 - 6.0 * hashf(seed ^ 0xD7u);
                hd += (hashf(seed ^ 0xE1u) - 0.5) * 3.0;
            } else if (m > TRAIL_MIN) {
                float sum = sL.x + sC.x + sR.x + 1e-4;
                turn += 6.0 * (sL.x - sR.x) / sum;
                if (sC.x < m) turn += sL.x > sR.x ? 2.5 : -2.5;
                wander *= 1.0 - 1.5 * dt;
                // On a trail but walking toward the nest: turn back out now and then.
                if (here.w > 0.5 && sC.z < here.z - 2.0 && hashf(seed ^ 0xC3u) < 0.4 * dt) hd += PI;
            }
        }
    } else {
        float dn = distance(pos, nest);
        vec2 to = nest - pos;
        if (sC.w < 0.5 || dn < 0.04) {
            turn += 6.0 * turnTo(hd, atan(to.y, to.x));
        } else {
            // Descend the walking distance; the home scent breaks ties.
            float cL = sL.z - 3.0 * sL.y;
            float cC = sC.z - 3.0 * sC.y;
            float cR = sR.z - 3.0 * sR.y;
            float span = SENSE_DIST * unitPx();
            turn += 5.0 * clamp((cR - cL) / span, -1.0, 1.0);
            if (cC > min(cL, cR)) turn += cL < cR ? 3.0 : -3.0;
        }
    }

    // Walls ahead: turn toward the open side.
    if (bC) turn += (bL && !bR) ? -8.0 : ((bR && !bL) ? 8.0 : (wander >= 0.0 ? 8.0 : -8.0));
    else if (bL && !bR) turn -= 3.0;
    else if (bR && !bL) turn += 3.0;

    hd += clamp(turn, -MAX_TURN, MAX_TURN) * dt;

    float spd = SPEED * indiv * slow * (alarm > 0.0 ? 2.2 : 1.0) * (carry > 0 ? 0.9 : 1.0) * (1.0 - 0.25 * night);
    vec2 v = dirOf(hd) * spd * dt;
    vec2 np = pos + v;
    if (blockedAt(np, finger, cur)) {
        // Slide along the wall and turn to walk along it.
        vec2 nx = pos + vec2(v.x, 0.0);
        vec2 ny = pos + vec2(0.0, v.y);
        bool fx = !blockedAt(nx, finger, cur);
        bool fy = !blockedAt(ny, finger, cur);
        if (fx && (!fy || abs(v.x) >= abs(v.y))) {
            np = nx;
            hd += turnTo(hd, v.x >= 0.0 ? 0.0 : PI) * min(12.0 * dt, 1.0);
        } else if (fy) {
            np = ny;
            hd += turnTo(hd, v.y >= 0.0 ? 0.5 * PI : -0.5 * PI) * min(12.0 * dt, 1.0);
        } else {
            np = pos;
            hd += (wander >= 0.0 ? 1.0 : -1.0) * 6.0 * dt;
        }
    }
    gait = fract(gait + distance(np, pos) / STRIDE);
    pos = np;

    float strength = 0.0;
    if (alarm <= 0.0 && (mode == MODE_SEARCH || carry > 0)) strength = exp(-t / LAY_TIME);
    o0 = vec4(pos, wrapAngle(hd), packCode(mode, carry, strength));
    o1 = vec4(t, alarm > 0.0 ? alarm : bored, gait, clamp(wander, -4.0, 4.0));
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    fragColor = vec4(0.0);
    bool antTexelHere = ic.x < 2 * ANT_COLS && ic.y < MAX_ANTS / ANT_COLS;
    bool pileTexel = (ic.y == PILE_ROW || ic.y == PILE_ROW + 1) && ic.x < NPILE;
    bool globalTexel = ic.y == GLOBAL_ROW && ic.x < 2;
    if (!antTexelHere && !pileTexel && !globalTexel) return;
    if (!simStep()) {
        fragColor = texelFetch(iChannel0, ic, 0);
        return;
    }

    G0 = texelFetch(iChannel0, ivec2(0, GLOBAL_ROW), 0);
    G1 = texelFetch(iChannel0, ivec2(1, GLOBAL_ROW), 0);
    for (int k = 0; k < NPILE; k++) {
        P0[k] = texelFetch(iChannel0, ivec2(k, PILE_ROW), 0);
        P1[k] = texelFetch(iChannel0, ivec2(k, PILE_ROW + 1), 0);
    }
    bool init = G0.w < 0.5;
    float dt = simDt();

    if (antTexelHere) {
        int i = ic.y * ANT_COLS + ic.x / 2;
        vec4 o0, o1;
        if (init) seedAnt(i, o0, o1);
        else updateAnt(i, o0, o1);
        fragColor = (ic.x & 1) == 0 ? o0 : o1;
        return;
    }

    if (pileTexel) {
        int k = ic.x;
        vec4 p0 = P0[k];
        vec4 p1 = P1[k];
        if (init) {
            p0 = vec4(0.0);
            p1 = vec4(0.0);
            if (k == 0) {
                float n = crumbsOf(initKind());
                p0 = vec4(initFoodPos(), n, n);
                p1 = vec4(float(initKind()), 5.0, 0.0, 5.0);
            }
        } else {
            // Only the first record counts crumbs; the second keeps its
            // values once the pile is empty (z < 0.5 marks the slot free).
            if (p0.z > 0.5) {
                if (ic.y == PILE_ROW) p0.z -= float(countPickups(k));
                p1.y = min(p1.y + dt, 1e4);
                p1.w = min(p1.w + dt, 1e4);
                if (p0.z < 0.5) p0 = vec4(p0.xy, 0.0, -1.0);
            } else if (p0.w < 0.0) {
                p0.w -= dt;
                if (p0.w < -GHOST_TIME) p0 = vec4(0.0);
            }
            vec4 n0, n1;
            bool topUp;
            if (spawnEvent(n0, n1, topUp) == k) {
                p0 = n0;
                p1 = n1;
            }
        }
        fragColor = ic.y == PILE_ROW ? p0 : p1;
        return;
    }

    // Globals.
    if (init) {
        fragColor = ic.x == 0 ? vec4(0.0, iMouse.z > 0.0 ? 1.0 : 0.0, 0.0, 1.0) : vec4(0.0, 20.0, 0.0, 0.0);
        return;
    }
    bool due = G1.y > 0.0 && G0.z >= G1.y;
    if (ic.x == 0) {
        bool moved = distance(iMouse.xy, iMousePrev) > iResolution.y / 1400.0;
        fragColor = vec4(moved ? 0.0 : min(G0.x + dt, 100.0),
                         iMouse.z > 0.0 ? 1.0 : 0.0,
                         due ? 0.0 : G0.z + dt * FOOD_RATE,
                         1.0);
    } else {
        float n = G1.x + (due ? 1.0 : 0.0);
        float next = due ? 30.0 + 45.0 * hashf(uint(n) * 2246822519u + 99u) : G1.y;
        fragColor = vec4(n, next, mod(G1.z + dt, 1000.0 * TAU), mod(G1.w + 1.0, float(PICK_TURNS)));
    }
}
