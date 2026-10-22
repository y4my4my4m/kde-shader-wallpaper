// Aquarium — Buffer A: fish, food flakes, shed bubbles and input state.
// @channels self
//
// Texel (x, y): x = slot, y = row. Positions in H units, velocities in H/s,
// times in seconds. A w of 0 marks a texel never written; the engine clears
// buffers to zero on load.
//   row 0  fish i: position, velocity
//   row 1  fish i: facing (-1 left .. +1 right), tail phase (cycles, 0..1),
//          fear 0..1, puff 0..1 (pufferfish) or recent bites (others)
//   row 2  fish i: seconds to the next wander target, wander target,
//          1 + targets picked
//   row 3  fish i: seconds since it last ate, seconds of puff left,
//          sleepiness 0..1, interest in the cursor 0..1
//   row 4  flake j: position, age (< 0 while queued), state: 0 none,
//          1 + s/2 drifting, 2 + s/2 on the sand (s = per-flake seed 0..1)
//   row 5  bubble k: position, age, radius (0 = none)
//   row 6  (0) button held last step, seconds since the cursor moved,
//              seconds since it last moved fast or left the desktop, 1
//          (1) flakes dropped, bubbles shed (counters wrapping at 128 rings;
//              slot = count mod ring size), bubble budget, 1
//          (2) school centre, its velocity
//          (3) school waypoint, waypoints picked, seconds left on it
//          (4) animation clock 0..1 (one turn per LOOP seconds), 0, 0, 1
// Every texel derives events from the previous step, so the fish, flake,
// bubble and counter texels agree on them. iMouse, iMousePrev, window rects
// and velocities arrive scaled to this grid.

const float FAST_CURSOR = 0.9;  // H/s; a faster cursor over the desktop startles
const float STARTLE_R = 0.16;   // H, reach of a startle around the cursor path
const float HIDE_FEAR = 0.3;    // fear above which a fish heads for cover
const float FULL_DECAY = 12.0;  // seconds for one bite to wear off

vec4 st(int x, int y) { return texelFetch(iChannel0, ivec2(x, y), 0); }
vec4 glob(int k) { return st(k, ROW_G); }

struct Inp {
    float A;      // aspect
    float dt;
    vec2 m;       // cursor at this substep
    vec2 m0;      // cursor last frame
    vec2 m1;      // cursor this frame
    float speed;  // H/s
    bool onDesk;
    bool held;
    bool click;   // press began on bare desktop above the panel, off the pufferfish
    bool poke;    // press began on the pufferfish
    bool fast;
    float still;
    float calm;
    float night;
    float clock;  // animation clock 0..1
    bool init;
};

Inp readInputs()
{
    Inp I;
    I.A = iResolution.x / iResolution.y;
    I.dt = clamp(iTimeDelta, 0.0, 0.05);
    I.m1 = iMouse.xy / iResolution.y;
    I.m0 = iMousePrev / iResolution.y;
    int n = max(iSubsteps, 1);
    I.m = mix(I.m0, I.m1, (float(iSubstep) + 1.0) / float(n));
    float frameDt = max(iTimeDelta * float(n), 1e-4);
    I.speed = length(I.m1 - I.m0) / frameDt;
    bool onScreen = (iMouse.x > 1.0 || iMouse.y > 1.0)
                    && iMouse.x < iResolution.x - 0.5 && iMouse.y < iResolution.y - 0.5;
    I.onDesk = onScreen && !insideAnyWindow(I.m1);
    vec4 g0 = glob(0);
    vec4 g4 = glob(4);
    I.init = g4.w < 0.5;
    I.held = iMouse.z > 0.0;
    bool press = I.held && g0.x < 0.5 && !I.init && I.onDesk && I.m1.y > PANEL;
    int pf = pufferSlot();
    vec2 pp = st(pf, ROW_P).xy;
    float pr = bodyLen(SP_PUFFER) * fishUnit(I.A) * depthScale(depthOf(pf)) * 0.75;
    bool onPuffer = distance(I.m1, pp) < pr;
    I.click = press && !onPuffer;
    I.poke = press && onPuffer;
    I.fast = I.onDesk && I.speed > FAST_CURSOR;
    bool moved = length(I.m1 - I.m0) > 0.0008;
    // The cursor counts as long still at load: no nibbling before it moves.
    I.still = I.init ? 1000.0 : (moved ? 0.0 : min(g0.y + I.dt, 1000.0));
    I.calm = I.init ? 0.0 : ((I.fast || !I.onDesk) ? 0.0 : min(g0.z + I.dt, 1000.0));
    I.night = FOLLOW_CLOCK > 0.5 ? clockNight() : 0.0;
    I.clock = g4.x;
    return I;
}

// ------------------------------------------------------------- steering

// Acceleration that keeps a body of clearance `clr` out of the windows and
// slides it along their edges. Window `skip` is ignored.
vec2 avoidWindows(vec2 pos, vec2 vel, float clr, int skip, float A)
{
    vec2 acc = vec2(0.0);
    float margin = 0.05 + clr;
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        if (k == skip || !winValid(k)) continue;
        vec4 r = winRect(k);
        if (winHuge(r, A)) continue;
        float d = sdRect(pos, r) - clr;
        if (d > margin) continue;
        vec2 n = rectNormal(pos, r);
        if (d < 0.0) {
            acc += n * 0.35;
        } else {
            float w = 1.0 - d / margin;
            acc += n * 0.5 * w * w;
            float vn = dot(vel, n);
            if (vn < 0.0) acc -= n * vn * 5.0 * w;
        }
    }
    return acc;
}

// Moves t out of every (non-huge) window, `clr` clear of its edges.
vec2 outOfWindows(vec2 t, float clr, float A)
{
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        if (!winValid(k)) continue;
        vec4 r = winRect(k);
        if (winHuge(r, A)) continue;
        vec4 e = r + vec4(-clr, -clr, clr, clr);
        if (t.x > e.x && t.x < e.z && t.y > e.y && t.y < e.w) {
            vec4 dd = vec4(t.x - e.x, t.y - e.y, e.z - t.x, e.w - t.y);
            float m = min(min(dd.x, dd.y), min(dd.z, dd.w));
            if (m == dd.x) t.x = e.x;
            else if (m == dd.y) t.y = e.y;
            else if (m == dd.z) t.x = e.z;
            else t.y = e.w;
        }
    }
    return t;
}

vec2 clampTank(vec2 p, float A, float mx, float mlo, float mhi)
{
    p.x = clamp(p.x, mx, A - mx);
    p.y = clamp(p.y, sandTop(p.x) + mlo, SURFACE - mhi);
    return p;
}

vec2 boundsForce(vec2 pos, float A, float mx, float mlo, float mhi)
{
    vec2 acc = vec2(0.0);
    float band = 0.06;
    acc.x += 0.6 * max(0.0, 1.0 - (pos.x - mx) / band);
    acc.x -= 0.6 * max(0.0, 1.0 - (A - mx - pos.x) / band);
    acc.y += 0.6 * max(0.0, 1.0 - (pos.y - sandTop(pos.x) - mlo) / band);
    acc.y -= 0.6 * max(0.0, 1.0 - (SURFACE - mhi - pos.y) / band);
    return acc;
}

// A point near the edge of a random window, or a random point in the band.
vec2 pickSpot(float seed, float A, float ylo, float yhi, float edgeChance, float clr)
{
    vec2 r = hash22(vec2(seed * 0.917 + 3.1, seed * 1.37 + 0.5));
    float r3 = hash12(vec2(seed * 1.31, 9.7));
    float x = mix(0.07 * A, 0.93 * A, r.x);
    vec2 t = vec2(x, mix(ylo, yhi, r.y));
    if (r3 < edgeChance && iWindowCount > 0) {
        int k = min(int(hash11(seed * 3.3 + 1.1) * float(iWindowCount)), iWindowCount - 1);
        if (winValid(k)) {
            vec4 w = winRect(k);
            if (!winHuge(w, A)) {
                float e = hash11(seed * 5.9 + 2.2);
                float u = hash11(seed * 7.1 + 0.3);
                float gap = 0.035 + clr;
                if (e < 0.4) t = vec2(mix(w.x, w.z, u), w.y - gap);
                else if (e < 0.7) t = vec2(w.x - gap, mix(w.y, w.w, u));
                else t = vec2(w.z + gap, mix(w.y, w.w, u));
            }
        }
    }
    return t;
}

// Nearest window able to cover a fish of length L, as a target deep inside
// it; returns -1 when there is none within reach.
int hideSpot(vec2 pos, float L, float A, out vec2 spot)
{
    int best = -1;
    float bd = 0.9;
    spot = pos;
    float inset = 0.7 * L + 0.012;
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        if (!winValid(k)) continue;
        vec4 r = winRect(k);
        if (winHuge(r, A)) continue;
        vec4 e = vec4(r.xy + inset, r.zw - inset);
        e.y = max(e.y, sandTop(0.5 * (r.x + r.z)) + 0.02);
        e.w = min(e.w, SURFACE - 0.03);
        if (e.z <= e.x || e.w <= e.y) continue;
        vec2 s = clamp(pos, e.xy, e.zw);
        float d = distance(s, pos);
        if (d < bd) {
            bd = d;
            best = k;
            spot = s;
        }
    }
    return best;
}

float segDist(vec2 p, vec2 a, vec2 b)
{
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
    return length(p - a - ab * t);
}

// ------------------------------------------------------------- fish

// Window reaching down over the floor line gy that can cover a bottom
// dweller of length L near x; hx is the cover point.
bool floorCover(float x, float gy, float L, float A, out float hx)
{
    hx = x;
    float bd = 0.9;
    bool found = false;
    float inset = 0.7 * L + 0.012;
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        if (!winValid(k)) continue;
        vec4 r = winRect(k);
        if (winHuge(r, A) || r.y > gy - 0.3 * L || r.w < gy + 0.4 * L || r.z - r.x < 2.0 * inset) continue;
        float s = clamp(x, r.x + inset, r.z - inset);
        if (abs(s - x) < bd) {
            bd = abs(s - x);
            hx = s;
            found = true;
        }
    }
    return found;
}

// Night resting place of swimmer i in the plants on one side of the tank:
// side 0 left, 1 right.
vec2 restSpot(int i, int sp, float A, float side)
{
    float h = hash11(float(i) * 12.9898 + 4.1);
    float u = side < 0.5 ? 0.12 : 0.86;
    float rx = (u + (fract(h * 13.1) - 0.5) * 0.16) * A;
    float ry = sandTop(rx) + (sp == SP_ANGEL ? 0.17 : 0.06) + 0.14 * fract(h * 7.7);
    return vec2(rx, ry);
}

// Side of the tank the school sleeps on tonight.
float nightSide() { return hash11(floor(iDate.z) + 0.5) < 0.5 ? 0.0 : 1.0; }

struct Fish {
    vec4 P;
    vec4 Q;
    vec4 R;
    vec4 S;
};

Fish initFish(int i, Inp I)
{
    int sp = speciesOf(i);
    int v = variantOf(i);
    float z = depthOf(i);
    float A = I.A;
    float L = fishLen(i, A);
    float h1 = hash11(float(i) * 7.13 + 0.37);
    float h2 = hash11(float(i) * 3.71 + 1.91);
    float h3 = hash11(float(i) * 9.17 + 5.3);
    vec2 pos;
    vec2 vel;
    if (sp == SP_TETRA) {
        float a = h1 * 6.2831853;
        float r = sqrt(h2);
        pos = vec2(0.34 * A, 0.56) + vec2(cos(a) * 0.17, sin(a) * 0.08) * r;
        vel = vec2(0.10, 0.01) + (vec2(h2, h3) - 0.5) * 0.03;
    } else if (sp == SP_ANGEL) {
        pos = v == 0 ? vec2(0.66 * A, 0.62) : vec2(0.22 * A, 0.46);
        vel = vec2(v == 0 ? -0.04 : 0.04, 0.0);
    } else if (sp == SP_PUFFER) {
        pos = vec2(0.5 * A, 0.34);
        vel = vec2(-0.03, 0.0);
    } else {
        float x = sp == SP_CORY ? (v == 0 ? 0.3 : 0.62) : (v == 0 ? 0.44 : 0.8);
        pos = vec2(x * A, floorY(x * A, z) + groundLift(sp) * L);
        vel = vec2(v == 0 ? 0.02 : -0.02, 0.0);
    }
    bool bottom = sp == SP_CORY || sp == SP_SHRIMP;
    if (I.night > 0.5 && !bottom) {
        float side = sp == SP_TETRA ? nightSide() : (hash11(float(i) * 12.9898 + 4.1) < 0.5 ? 0.0 : 1.0);
        pos = restSpot(i, sp, A, side);
        vel *= 0.2;
    }
    Fish F;
    F.P = vec4(pos, vel);
    F.Q = vec4(facingSign(vel.x), h3, 0.0, 0.0);
    F.R = vec4(1.0 + 3.0 * h1, pos, 1.0);
    F.S = vec4(100.0, 0.0, I.night, 0.0);
    return F;
}

Fish updateFish(int i, Inp I, vec4 school)
{
    Fish F;
    F.P = st(i, ROW_P);
    F.Q = st(i, ROW_Q);
    F.R = st(i, ROW_R);
    F.S = st(i, ROW_S);
    if (F.R.w < 0.5 || I.init) return initFish(i, I);

    int sp = speciesOf(i);
    float A = I.A;
    float z = depthOf(i);
    float L = fishLen(i, A);
    float dt = I.dt;
    float h = hash11(float(i) * 12.9898 + 4.1);
    bool bottom = sp == SP_CORY || sp == SP_SHRIMP;

    vec2 pos = F.P.xy;
    vec2 vel = F.P.zw;
    float facing = F.Q.x;
    float phase = F.Q.y;
    float fear = F.Q.z;
    float puff = F.Q.w;
    float timer = F.R.x;
    vec2 tgt = F.R.yz;
    float picks = F.R.w;
    float ate = F.S.x;
    float puffT = F.S.y;
    float sleep = F.S.z;
    float interest = F.S.w;

    float cruise = SWIM_SPEED * (sp == SP_TETRA ? 0.10 : (sp == SP_ANGEL ? 0.045 : (sp == SP_PUFFER ? 0.04 : (sp == SP_CORY ? 0.035 : 0.014))));
    float vmax = SWIM_SPEED * (sp == SP_TETRA ? 0.55 : (sp == SP_ANGEL ? 0.3 : (sp == SP_PUFFER ? 0.22 : (sp == SP_CORY ? 0.28 : 0.45))));
    float resp = sp == SP_TETRA ? 2.5 : (sp == SP_ANGEL ? 1.2 : (sp == SP_PUFFER ? 1.5 : 3.0));
    float clr = L * (sp == SP_ANGEL ? 0.55 : 0.45);
    float mx = 0.012 * A + 0.5 * L;
    float mlo = sp == SP_ANGEL ? 0.6 * L + 0.02 : 0.35 * L + 0.015;
    float mhi = sp == SP_ANGEL ? 0.6 * L + 0.01 : 0.3 * L + 0.006;

    vec2 mouth = mouthOf(sp, pos, facing, L);

    // Food: the nearest flake this fish notices; eating ends the flake in
    // its own texel on the same step. Tetras feed in mid-water; a fish that
    // has had its fill (bites decay over FULL_DECAY seconds) stops chasing.
    float bites = sp == SP_PUFFER ? 0.0 : puff;
    float fill = sp == SP_TETRA ? 2.0 : (sp == SP_ANGEL ? 3.0 : 4.0);
    float sight = bottom ? 0.9 : (sp == SP_TETRA ? 0.5 : 0.7);
    float floorFeed = sp == SP_TETRA ? 0.22 : 0.06;
    vec2 food = vec2(0.0);
    float foodD = 1e9;
    bool chomp = false;
    for (int j = 0; j < NFLAKE; j++) {
        vec4 f = st(j, ROW_FLAKE);
        if (f.w < 0.5 || f.z < 0.0) continue;
        if (eatsFlake(sp, mouth, L, ate, f)) chomp = true;
        bool settled = f.w > 1.5;
        float d;
        if (bottom) {
            if (!settled && f.y > sandTop(f.x) + 0.12) continue;
            d = abs(f.x - mouth.x) + 0.5 * max(f.y - sandTop(f.x), 0.0);
        } else {
            if (settled || f.y < sandTop(f.x) + floorFeed) continue;
            d = distance(f.xy, mouth);
        }
        if (d < foodD) {
            foodD = d;
            food = f.xy;
        }
    }
    bites = chomp ? bites + 1.0 : max(bites - dt / FULL_DECAY, 0.0);
    bool hungry = foodD < sight && bites < fill;
    ate = chomp ? 0.0 : min(ate + dt, 100.0);

    // Startle: a fast cursor across the desktop, or water shoved by a
    // dragged window.
    float dCur = segDist(pos, I.m0, I.m1);
    bool startled = I.fast && dCur < STARTLE_R + L;
    vec2 push = vec2(0.0);
    float pushMag = 0.0;
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        if (!winValid(k)) continue;
        vec2 wv = iWindowVelocities[k] / iResolution.y;
        float s = length(wv);
        if (s < 0.05) continue;
        vec4 r = winRect(k);
        float d = sdRect(pos, r);
        if (d > 0.2) continue;
        float f = exp(-max(d, 0.0) / 0.05);
        push += wv * f;
        pushMag = max(pushMag, s * f);
    }

    if (sp == SP_PUFFER) {
        if (startled || I.poke || pushMag > 0.8) puffT = 3.5 + 1.5 * h;
        puffT = max(puffT - dt, 0.0);
        puff = puffT > 0.0 ? min(puff + dt * 5.0, 1.0) : max(puff - dt * 0.35, 0.0);
        startled = false;
    }
    if (pushMag > 0.6) fear = max(fear, 0.55);
    if (startled) {
        fear = 1.0;
        vec2 away = pos - I.m;
        float la = length(away);
        away = la > 1e-5 ? away / la : vec2(-facingSign(facing), 0.0);
        if (sp == SP_SHRIMP) {
            vel = vec2(-facingSign(facing) * 0.35, 0.28);
        } else if (sp == SP_CORY) {
            vel.x = sign(away.x + 1e-4) * 0.3;
        } else {
            vel += away * vmax * 0.8;
        }
    }

    // Tetras: separation, alignment, cohesion; fear spreads through the
    // school. Separation is weak between fish at different depths, which
    // pass in front of each other.
    vec2 acc = vec2(0.0);
    if (sp == SP_TETRA) {
        vec2 sep = vec2(0.0);
        vec2 sumV = vec2(0.0);
        vec2 sumP = vec2(0.0);
        float n = 0.0;
        float fearN = 0.0;
        float rSep = 0.95 * L;
        for (int j = NBACK; j < NBACK + TETRAS; j++) {
            if (j == i) continue;
            vec4 pj = st(j, ROW_P);
            vec2 d = pos - pj.xy;
            float r = length(d);
            if (r > 0.13) continue;
            n += 1.0;
            sumV += pj.zw;
            sumP += pj.xy;
            float near = abs(depthOf(j) - z) < 0.1 ? 1.0 : 0.2;
            if (r < rSep) sep += d / max(r, 1e-4) * (1.0 - r / rSep) * near;
            fearN = max(fearN, st(j, ROW_Q).z);
        }
        fear = max(fear, fearN - 0.12);
        if (n > 0.0) {
            float loose = hungry ? 0.25 : 1.0 - 0.85 * sleep;
            acc += sep * 1.2;
            acc += (sumV / n - vel) * 0.9 * loose;
            acc += (sumP / n - pos) * 0.3 * loose;
        }
    }

    // Goal, by rising priority: wander spot or school, rest, the cursor,
    // food, cover.
    float sleepT = I.night * (1.0 - fear) * (hungry ? 0.0 : 1.0);
    sleep += (sleepT - sleep) * min(dt * 0.4, 1.0);

    timer -= dt;
    if (timer <= 0.0 || (!bottom && distance(tgt, pos) < max(L, 0.03))) {
        picks += 1.0;
        float seed = float(i) * 31.7 + picks;
        if (bottom) {
            float x = pos.x + (hash11(seed * 1.7) - 0.5) * 0.7;
            x = clamp(x, 0.05 * A, 0.95 * A);
            tgt = vec2(x, 0.0);
            timer = 4.0 + 6.0 * hash11(seed * 2.3);
        } else {
            float ylo = sp == SP_ANGEL ? 0.4 : sandTop(0.5 * A) + 0.08;
            float yhi = sp == SP_ANGEL ? 0.8 : 0.62;
            tgt = pickSpot(seed, A, ylo, yhi, 0.45, clr);
            tgt = outOfWindows(tgt, clr + 0.02, A);
            tgt = clampTank(tgt, A, mx + 0.03, mlo + 0.03, mhi + 0.03);
            timer = 6.0 + 8.0 * hash11(seed * 2.3);
        }
    }

    vec2 goal = tgt;
    float gs = cruise;
    float gw = sp == SP_TETRA ? 0.0 : 1.0;
    if (sp == SP_TETRA) {
        // Each tetra circles its own spot in the school, so members trade
        // places.
        vec2 hv = hash22(vec2(float(i) * 1.7, 2.9));
        float turns = 10.0 + floor(16.0 * hv.x);
        float a = 6.2831853 * fract(I.clock * turns + hv.y);
        float rad = 0.03 + 0.1 * fract(hv.x * 7.3);
        goal = school.xy + vec2(cos(a), 0.45 * sin(a)) * rad;
        gs = cruise * (0.9 + 0.3 * h);
        gw = 0.5;
    }
    if (sleep > 0.5 && !bottom) {
        float side = sp == SP_TETRA ? nightSide() : (h < 0.5 ? 0.0 : 1.0);
        float w = 6.2831853 * I.clock;
        goal = restSpot(i, sp, A, side) + 0.02 * vec2(sin(w * 3.0 + h * 6.0), sin(w * 5.0 + h * 9.0));
        gs = cruise * 0.35;
        gw = 1.0;
    }

    // CURIOSITY scales the share of nibbling tetras and divides the wait
    // before a fish joins; 0 leaves the cursor alone.
    bool nibbler = CURIOSITY > 0.0 && (sp == SP_PUFFER || sp == SP_ANGEL || (sp == SP_TETRA && h < 0.22 * CURIOSITY));
    float want = 0.0;
    if (nibbler && I.onDesk && !I.held && fear < 0.2 && !hungry && sleep < 0.5) {
        float join = (0.6 + 1.6 * h) / max(CURIOSITY, 0.01);
        float leave = 8.0 + 8.0 * fract(h * 7.3);
        if (I.calm > join && I.still < leave && distance(I.m1, pos) < 0.6) want = 1.0;
    }
    interest += (want - interest) * min(dt * 2.0, 1.0);
    if (interest > 0.3) {
        float side = facingSign(pos.x - I.m.x);
        float a = (fract(h * 17.3) - 0.5) * 2.4;
        float peck = 0.5 + 0.5 * sin(6.2831853 * (I.clock * 768.0 + h));
        float gap = 0.004 + 0.18 * L * peck + 0.5 * L * fract(h * 5.1);
        float reach = (sp == SP_ANGEL || sp == SP_PUFFER ? 0.4 : 0.47) * L + gap;
        goal = I.m + vec2(side * cos(a), sin(a) * 0.6) * reach;
        gs = cruise * 1.5;
        gw = 1.0;
    }

    if (hungry && !bottom) {
        goal = food - (mouth - pos);
        gs = vmax * 0.75;
        gw = 1.4;
    }

    int hideK = -1;
    if (fear > HIDE_FEAR && !bottom) {
        vec2 spot;
        hideK = hideSpot(pos, L, A, spot);
        if (hideK >= 0) {
            goal = spot;
        } else {
            vec2 away = pos - I.m1;
            goal = pos + (length(away) > 1e-5 ? normalize(away) : vec2(1.0, 0.0)) * 0.3;
        }
        gs = vmax * (0.4 + 0.5 * fear);
        gw = 1.5;
    }
    bool hidden = hideK >= 0 && sdRect(pos, winRect(hideK)) < -0.5 * L;
    fear = max(fear - dt * (hidden ? 0.1 : 0.2), 0.0);

    if (bottom) {
        // Walk the sand: towards the target or food, pausing to sift.
        float gy = floorY(pos.x, z) + groundLift(sp) * L;
        float tx = tgt.x;
        float spd = cruise;
        if (hungry) {
            tx = food.x - (mouth.x - pos.x);
            spd = SWIM_SPEED * (sp == SP_CORY ? 0.12 : 0.05);
        }
        if (fear > HIDE_FEAR) {
            float hx;
            tx = floorCover(pos.x, gy, L, A, hx) ? hx : pos.x + facingSign(pos.x - I.m1.x) * 0.3;
            spd = SWIM_SPEED * (sp == SP_CORY ? 0.22 : 0.08);
        }
        if (sleep > 0.5) spd = 0.0;
        float dx = tx - pos.x;
        // Stop-and-go gait.
        float gait = sp == SP_CORY ? 0.55 + 0.45 * sin(6.2831853 * (I.clock * 256.0 + h)) : 1.0;
        float vx = clamp(dx * 3.0, -spd, spd) * (hungry || fear > HIDE_FEAR ? 1.0 : gait);
        bool air = pos.y > gy + 0.002 || vel.y > 0.0;
        if (air) {
            vel.y -= 0.7 * dt;
            vel.x *= exp(-dt * 1.5);
            vel += push * dt * 2.0;
        } else {
            vel.x += (vx - vel.x) * min(resp * dt, 1.0);
            vel.x += push.x * dt * 2.0;
            vel.y = 0.0;
        }
        pos += vel * dt;
        gy = floorY(pos.x, z) + groundLift(sp) * L;
        if (pos.y <= gy) {
            pos.y = gy;
            vel.y = max(vel.y, 0.0);
        }
        pos.y = min(pos.y, SURFACE - 0.03);
        if (pos.x < mx || pos.x > A - mx) vel.x = 0.0;
        pos.x = clamp(pos.x, mx, A - mx);
        bool flip = sp == SP_SHRIMP && fear > 0.5;
        if (!flip && abs(vel.x) > 0.006) facing += clamp(sign(vel.x) - facing, -4.0 * dt, 4.0 * dt);
        if (!flip && hungry && abs(dx) < 0.01) facing += clamp(sign(food.x - pos.x) - facing, -4.0 * dt, 4.0 * dt);
    } else {
        // Swim: steer to the goal, keep out of windows and inside the tank.
        vec2 to = goal - pos;
        float d = length(to);
        float spd = min(gs, d * 2.5 + 0.004);
        vec2 desired = d > 1e-5 ? to / d * spd : vec2(0.0);
        acc += (desired - vel) * resp * gw;
        acc += avoidWindows(pos, vel, clr, hideK, A);
        acc += boundsForce(pos, A, mx, mlo, mhi);
        if (sp == SP_PUFFER) acc.y += 0.03 * puff;
        vel += acc * dt;
        vel += push * dt * 3.0;
        float s = length(vel);
        float cap = (fear > 0.2 || hungry) ? vmax : vmax * 0.6;
        if (sp == SP_PUFFER) cap *= 1.0 - 0.75 * puff;
        if (s > cap) vel *= cap / s;
        float floorV = sp == SP_TETRA ? 0.35 * cruise * (1.0 - sleep) : 0.0;
        if (s < floorV && s > 1e-6) vel *= floorV / s;
        vel *= exp(-dt * (0.3 + 1.5 * sleep));
        pos += vel * dt;
        vec2 c = clampTank(pos, A, mx, mlo, mhi);
        if (c.x != pos.x) vel.x = 0.0;
        if (c.y != pos.y) vel.y = 0.0;
        pos = c;
        float wantF = facing;
        if (abs(vel.x) > 0.35 * cruise) wantF = sign(vel.x);
        if (interest > 0.5) wantF = facingSign(I.m1.x - pos.x);
        float turn = sp == SP_TETRA ? 5.0 : 2.5;
        facing += clamp(wantF - facing, -turn * dt, turn * dt);
    }

    float base = sp == SP_TETRA ? 1.6 : (sp == SP_ANGEL ? 0.55 : (sp == SP_PUFFER ? 0.9 : 1.0));
    float rate = base * (1.0 - 0.6 * sleep) + 0.45 * length(vel) / L;
    phase = fract(phase + dt * rate);

    F.P = vec4(pos, vel);
    F.Q = vec4(clamp(facing, -1.0, 1.0), phase, fear, sp == SP_PUFFER ? puff : bites);
    F.R = vec4(timer, tgt, mod(picks, 4096.0) + 1.0);
    F.S = vec4(ate, puffT, sleep, interest);
    return F;
}

// ------------------------------------------------------------- flakes, bubbles

vec4 updateFlake(int j, Inp I)
{
    vec4 f = st(j, ROW_FLAKE);
    float dropped = glob(1).x;
    if (I.click) {
        float k = mod(float(j) - dropped, float(NFLAKE));
        if (k < float(FLAKES_PER_CLICK)) {
            float s = hash12(vec2(dropped + k, 7.7));
            float x = I.m1.x + (s - 0.5) * 0.1 + (k - 0.5 * float(FLAKES_PER_CLICK)) * 0.014;
            x = clamp(x, 0.02 * I.A, 0.98 * I.A);
            return vec4(x, SURFACE - 0.003, -(k * 0.06 + s * 0.06), 1.0 + 0.5 * fract(s * 13.7));
        }
    }
    if (f.w < 0.5) return vec4(0.0);
    float dt = I.dt;
    f.z += dt;
    if (f.z < 0.0) return f;
    for (int i = 0; i < NFISH; i++) {
        vec4 p = st(i, ROW_P);
        int sp = speciesOf(i);
        float L = fishLen(i, I.A);
        if (eatsFlake(sp, mouthOf(sp, p.xy, st(i, ROW_Q).x, L), L, st(i, ROW_S).x, f)) return vec4(0.0);
    }
    float s = fract(f.w) * 2.0;
    if (f.w < 1.75) {
        float floatT = 0.5 + 1.3 * s;
        if (f.z < floatT) {
            f.y = SURFACE - 0.003 + 0.0012 * sin(f.z * 7.0 + s * 6.0);
            f.x += 0.004 * sin(f.z * 1.3 + s * 9.0) * dt;
        } else {
            float sink = 0.04 + 0.03 * s;
            f.y -= sink * dt;
            f.x += 0.02 * cos(f.z * (1.6 + s) + s * 6.2831853) * dt;
            float rest = sandTop(f.x) - fract(s * 7.31) * 0.032;
            if (f.y <= rest) {
                f.y = rest;
                f.z = 0.0;
                f.w = 2.0 + 0.5 * s;
            }
        }
        f.x = clamp(f.x, 0.01 * I.A, 0.99 * I.A);
    } else if (f.z > FLAKE_LIFE) {
        return vec4(0.0);
    }
    return f;
}

// Bubble shed this step by the fastest dragged window, if any. Writes the new
// bubble budget.
bool shedBubble(vec4 g1, Inp I, out vec4 bubble, out float budget)
{
    bubble = vec4(0.0);
    float best = 0.0;
    int bk = -1;
    float add = 0.0;
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        if (!winValid(k)) continue;
        float s = length(iWindowVelocities[k]) / iResolution.y;
        if (s < 0.12) continue;
        add += min(s - 0.12, 1.0) * I.dt * 30.0;
        if (s > best) {
            best = s;
            bk = k;
        }
    }
    if (bk < 0) {
        budget = 0.0;
        return false;
    }
    budget = min(g1.z + add, 2.0);
    if (budget < 1.0) return false;
    budget -= 1.0;
    vec2 hh = hash22(vec2(g1.y * 1.13, 3.7));
    vec4 r = winRect(bk);
    vec2 v = iWindowVelocities[bk];
    vec2 p;
    bool lead = hh.y < 0.35;
    if (abs(v.x) > abs(v.y)) p = vec2((v.x > 0.0) != lead ? r.x : r.z, mix(r.y, r.w, hh.x));
    else p = vec2(mix(r.x, r.z, hh.x), (v.y > 0.0) != lead ? r.y : r.w);
    p.x = clamp(p.x, 0.0, I.A);
    if (p.y > SURFACE - 0.02 || p.y < sandTop(p.x)) return false;
    float rs = fract(hh.y * 17.3);
    bubble = vec4(p, 0.0, 0.003 + 0.006 * rs * rs);
    return true;
}

vec4 updateBubble(int k, Inp I)
{
    vec4 b = st(k, ROW_BUB);
    vec4 g1 = glob(1);
    vec4 nb;
    float budget;
    if (shedBubble(g1, I, nb, budget) && int(mod(g1.y, float(NBUB))) == k) return nb;
    if (b.w <= 0.0) return vec4(0.0);
    float dt = I.dt;
    b.z += dt;
    b.y += (0.05 + b.w * 12.0) * dt;
    b.x += 0.03 * cos(b.z * 9.0 + float(k)) * dt;
    if (b.y > SURFACE - b.w) return vec4(0.0);
    return b;
}

// ------------------------------------------------------------- school

vec4 schoolCentre(Inp I)
{
    if (I.init) return vec4(I.night > 0.5 ? vec2((nightSide() < 0.5 ? 0.12 : 0.86) * I.A, 0.3) : vec2(0.34 * I.A, 0.56), 0.0, 0.0);
    vec4 c = glob(2);
    vec4 w = glob(3);
    float dt = I.dt;
    vec2 pos = c.xy;
    vec2 vel = c.zw;
    vec2 to = w.xy - pos;
    float d = length(to);
    float spd = min(0.075, d * 1.5 + 0.01);
    vec2 desired = d > 1e-5 ? to / d * spd : vec2(0.0);
    vec2 acc = (desired - vel) * 0.8;
    // Weave.
    float ang = 6.2831853 * I.clock * 40.0;
    acc += vec2(-desired.y, desired.x) * 2.0 * sin(ang);
    acc += avoidWindows(pos, vel, 0.05, -1, I.A);
    acc += boundsForce(pos, I.A, 0.12, 0.1, 0.1);
    vel += acc * dt;
    pos += vel * dt;
    // Stay with the fish.
    if (TETRAS > 0) {
        vec2 sum = vec2(0.0);
        for (int j = NBACK; j < NBACK + TETRAS; j++) sum += st(j, ROW_P).xy;
        pos += (sum / float(TETRAS) - pos) * min(dt * 0.4, 1.0);
    }
    pos = clampTank(pos, I.A, 0.08, 0.08, 0.08);
    return vec4(pos, vel);
}

vec4 schoolWaypoint(Inp I, vec2 centre)
{
    if (I.init) return vec4(0.7 * I.A, 0.5, 1.0, 12.0);
    vec4 w = glob(3);
    w.w -= I.dt;
    if (w.w <= 0.0 || distance(w.xy, centre) < 0.07) {
        w.z = mod(w.z + 1.0, 4096.0);
        float seed = w.z * 3.7 + 11.0;
        vec2 t = pickSpot(seed, I.A, 0.3, 0.72, 0.4, 0.08);
        if (I.night > 0.5) {
            float u = nightSide() < 0.5 ? 0.12 : 0.86;
            t = vec2(u * I.A, sandTop(u * I.A) + 0.12);
        }
        w.xy = outOfWindows(t, 0.1, I.A);
        w.xy = clampTank(w.xy, I.A, 0.1, 0.1, 0.1);
        w.w = 10.0 + 10.0 * hash11(seed);
    }
    return w;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    fragColor = vec4(0.0);
    if (ic.y > ROW_G || ic.x >= 64) return;
    Inp I = readInputs();

    if (ic.y <= ROW_S) {
        if (ic.x >= NFISH) return;
        vec4 school = I.init ? vec4(0.34 * I.A, 0.56, 0.0, 0.0) : glob(2);
        Fish F = updateFish(ic.x, I, school);
        fragColor = ic.y == ROW_P ? F.P : (ic.y == ROW_Q ? F.Q : (ic.y == ROW_R ? F.R : F.S));
        return;
    }
    if (ic.y == ROW_FLAKE) {
        if (ic.x < NFLAKE) fragColor = updateFlake(ic.x, I);
        return;
    }
    if (ic.y == ROW_BUB) {
        if (ic.x < NBUB) fragColor = updateBubble(ic.x, I);
        return;
    }
    // Globals.
    if (ic.x == 0) {
        fragColor = vec4(I.held ? 1.0 : 0.0, I.still, I.calm, 1.0);
    } else if (ic.x == 1) {
        vec4 g1 = I.init ? vec4(0.0) : glob(1);
        vec4 nb;
        float budget;
        bool shed = shedBubble(g1, I, nb, budget);
        float dropped = I.click ? mod(g1.x + float(FLAKES_PER_CLICK), float(NFLAKE * 128)) : g1.x;
        float shedN = shed ? mod(g1.y + 1.0, float(NBUB * 128)) : g1.y;
        fragColor = vec4(dropped, shedN, budget, 1.0);
    } else if (ic.x == 2) {
        fragColor = schoolCentre(I);
    } else if (ic.x == 3) {
        vec2 c = I.init ? vec2(0.34 * I.A, 0.56) : glob(2).xy;
        fragColor = schoolWaypoint(I, c);
    } else if (ic.x == 4) {
        float c = I.init ? 0.0 : glob(4).x;
        fragColor = vec4(fract(c + I.dt / LOOP), 0.0, 0.0, 1.0);
    }
}
