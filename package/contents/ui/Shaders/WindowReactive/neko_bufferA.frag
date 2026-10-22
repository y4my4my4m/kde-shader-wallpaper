// Neko — Buffer A: the cat's mind and body, the yarn ball and the object
// on a window top. State lives on row 0 (layout in neko_common.frag); every
// other texel is zero. Each state texel runs the whole update and keeps its
// own slice, so all texels agree.
//
// iChannel0  Buffer A (self), previous step.

struct State {
    vec2 pos; vec2 vel;
    int mode; float modeT; float facing; float support;
    float frame; float eye; float roll; float rollV;
    vec2 goal; int goalKind; int route;
    float takeoffX; vec2 land; float steps;
    vec2 mLast; float still; float pet;
    vec2 yPos; vec2 yVel;
    float yAge; float yAngle; float yIdle; float yRest;
    vec2 oPos; vec2 oVel;
    int oKind; int oStage; float oT; float oAngle;
    float heartClock; float heartStop; float bubbleT; float bubbleKind;
    float held; float stir; float exclT;
    float rng; float inited; float decide; float autoStep;
    float rideT; float coveredT; vec2 span;
    float landT; float landV; vec2 dust;
    float mealDone; float mealStage; float mealT; float kibble;
    float shadowY; vec2 oWinSpan;
    vec2 impact; float impactT;
    vec2 winVel; float mischT; float lastChoice;
};

State S;
float gA;      // aspect
float gDt;     // substep, s
float gF0;     // window interpolation at the start of this substep
float gF1;     // and at its end
vec2 gM;       // cursor, H units
bool gMOk;     // cursor on screen
float gMSpeed; // cursor speed, H/s

vec4 ld(int k) { return texelFetch(iChannel0, ivec2(k, 0), 0); }

void load()
{
    vec4 v;
    v = ld(T_CAT);   S.pos = v.xy; S.vel = v.zw;
    v = ld(T_MODE);  S.mode = int(v.x + 0.5); S.modeT = v.y; S.facing = v.z; S.support = v.w;
    v = ld(T_ANIM);  S.frame = v.x; S.eye = v.y; S.roll = v.z; S.rollV = v.w;
    v = ld(T_GOAL);  S.goal = v.xy; S.goalKind = int(v.z + 0.5); S.route = int(v.w + 0.5);
    v = ld(T_PLAN);  S.takeoffX = v.x; S.land = v.yz; S.steps = v.w;
    v = ld(T_MOUSE); S.mLast = v.xy; S.still = v.z; S.pet = v.w;
    v = ld(T_YARN);  S.yPos = v.xy; S.yVel = v.zw;
    v = ld(T_YARN2); S.yAge = v.x; S.yAngle = v.y; S.yIdle = v.z; S.yRest = v.w;
    v = ld(T_OBJ);   S.oPos = v.xy; S.oVel = v.zw;
    v = ld(T_OBJ2);  S.oKind = int(v.x + 0.5); S.oStage = int(v.y + 0.5); S.oT = v.z; S.oAngle = v.w;
    v = ld(T_FX);    S.heartClock = v.x; S.heartStop = v.y; S.bubbleT = v.z; S.bubbleKind = v.w;
    v = ld(T_INPUT); S.held = v.x; S.stir = v.y; S.exclT = v.w;
    v = ld(T_MISC);  S.rng = v.x; S.inited = v.y; S.decide = v.z; S.autoStep = v.w;
    v = ld(T_WIN);   S.rideT = v.x; S.coveredT = v.y; S.span = v.zw;
    v = ld(T_LAND);  S.landT = v.x; S.landV = v.y; S.dust = v.zw;
    v = ld(T_CLOCK); S.mealDone = v.x; S.mealStage = v.y; S.mealT = v.z; S.kibble = v.w;
    v = ld(T_AUX);   S.shadowY = v.x; S.oWinSpan = v.zw;
    v = ld(T_SHARD); S.impact = v.xy; S.impactT = v.z;
    v = ld(T_RIDE);  S.winVel = v.xy; S.mischT = v.z; S.lastChoice = v.w;
}

vec4 slice(int k)
{
    if (k == T_CAT)   return vec4(S.pos, S.vel);
    if (k == T_MODE)  return vec4(float(S.mode), S.modeT, S.facing, S.support);
    if (k == T_ANIM)  return vec4(S.frame, S.eye, S.roll, S.rollV);
    if (k == T_GOAL)  return vec4(S.goal, float(S.goalKind), float(S.route));
    if (k == T_PLAN)  return vec4(S.takeoffX, S.land, S.steps);
    if (k == T_MOUSE) return vec4(S.mLast, S.still, S.pet);
    if (k == T_YARN)  return vec4(S.yPos, S.yVel);
    if (k == T_YARN2) return vec4(S.yAge, S.yAngle, S.yIdle, S.yRest);
    if (k == T_OBJ)   return vec4(S.oPos, S.oVel);
    if (k == T_OBJ2)  return vec4(float(S.oKind), float(S.oStage), S.oT, S.oAngle);
    if (k == T_FX)    return vec4(S.heartClock, S.heartStop, S.bubbleT, S.bubbleKind);
    if (k == T_INPUT) return vec4(S.held, S.stir, 0.0, S.exclT);
    if (k == T_MISC)  return vec4(S.rng, S.inited, S.decide, S.autoStep);
    if (k == T_WIN)   return vec4(S.rideT, S.coveredT, S.span);
    if (k == T_LAND)  return vec4(S.landT, S.landV, S.dust);
    if (k == T_CLOCK) return vec4(S.mealDone, S.mealStage, S.mealT, S.kibble);
    if (k == T_AUX)   return vec4(S.shadowY, 0.0, S.oWinSpan);
    if (k == T_SHARD) return vec4(S.impact, S.impactT, 0.0);
    if (k == T_RIDE)  return vec4(S.winVel, S.mischT, S.lastChoice);
    return vec4(0.0);
}

float rand()
{
    S.rng += 1.0;
    return hash11(S.rng * 0.61803 + 0.37);
}

// ------------------------------------------------------------- geometry

float catH() { return 24.0 * spx(); }           // visible cat height
float reach() { return 11.0 * spx(); }          // feet centre to a batting paw
float xMin() { return 0.035 + 10.0 * spx(); }
float xMax() { return gA - 0.035 - 10.0 * spx(); }
float edgeM() { return 5.0 * spx(); }           // feet centre to a window edge

bool platformOk(vec4 r)
{
    return r.z - r.x > 0.10 && r.w > FLOOR_Y + 0.05 && r.w < 1.0 - 0.6 * catH();
}

// Window whose top holds a body at p (feet), at fraction f; -1 if none.
int supportAt(vec2 p, float f, float tol)
{
    int best = -1;
    float bd = tol;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 r = winAt(i, f);
        if (!platformOk(r)) continue;
        float d = abs(r.w - p.y);
        if (d < bd && p.x > r.x - 0.002 && p.x < r.z + 0.002) {
            bd = d;
            best = i;
        }
    }
    return best;
}

// Highest surface at x not above y: (surface y, window index or -1).
vec2 surfaceBelow(float x, float y, float margin)
{
    float best = FLOOR_Y;
    float idx = -1.0;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 r = winAt(i, 1.0);
        if (!platformOk(r)) continue;
        if (x > r.x + margin && x < r.z - margin && r.w <= y + 1e-4 && r.w > best) {
            best = r.w;
            idx = float(i);
        }
    }
    return vec2(best, idx);
}

// Window top through point (x, y), or vec4(0) when none.
vec4 topAt(float x, float y)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 r = winAt(i, 1.0);
        if (platformOk(r) && abs(r.w - y) < 0.004 && x > r.x - 0.004 && x < r.z + 0.004) return r;
    }
    return vec4(0.0);
}

// Standing span on the cat's current support.
vec2 currentSpan()
{
    if (S.support < 0.5) return vec2(xMin(), xMax());
    vec4 r = topAt(S.pos.x, S.pos.y);
    if (r.z <= r.x) return vec2(S.pos.x);
    return vec2(max(r.x + edgeM(), xMin()), min(r.z - edgeM(), xMax()));
}

// Where the cat goes for the cursor: the top of the window under it, or the
// highest surface below it on bare desktop. xyz = goal x, surface y, 1.
vec3 cursorGoal(vec2 m)
{
    int wi = -1;
    float area = 1e9;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 r = winAt(i, 1.0);
        if (m.x > r.x && m.x < r.z && m.y > r.y && m.y < r.w) {
            float a = (r.z - r.x) * (r.w - r.y);
            if (a < area) {
                area = a;
                wi = i;
            }
        }
    }
    if (wi >= 0) {
        vec4 r = winAt(wi, 1.0);
        if (platformOk(r)) return vec3(clamp(m.x, r.x + edgeM(), r.z - edgeM()), r.w, 1.0);
        return vec3(clamp(m.x, xMin(), xMax()), FLOOR_Y, 1.0);
    }
    vec2 s = surfaceBelow(m.x, m.y, edgeM());
    return vec3(clamp(m.x, xMin(), xMax()), s.x, 1.0);
}

bool catCovered()
{
    return coveredAt(S.pos + vec2(0.0, 0.7 * catH()));
}

bool overCat(vec2 m, float grow)
{
    vec2 d = m - S.pos;
    return abs(d.x) < (13.0 + grow) * spx() && d.y > -2.0 * spx() && d.y < catH() + grow * spx();
}

// ------------------------------------------------------------- modes

void setMode(int m)
{
    if (S.mode != m) {
        S.mode = m;
        S.modeT = 0.0;
    }
}

bool airborne() { return S.mode == M_AIR || S.mode == M_STARTLE; }

// Modes a new wish may cut short.
bool interruptible()
{
    if (airborne() || S.mode == M_CROUCH || S.mode == M_LAND || S.mode == M_RIDE) return false;
    if (S.mode == M_STRETCH && S.modeT < 1.0) return false;
    if (S.mode == M_MEOW && S.modeT < 0.9) return false;
    if (S.mode == M_BAT && S.modeT < 0.35) return false;
    return true;
}

void launch(vec2 v, float spin)
{
    S.vel = v;
    S.support = -1.0;
    S.rollV = spin;
    setMode(M_AIR);
}

// Ballistic jump from the feet to target t, apex a little above the higher
// end and below the top of the screen.
void leapTo(vec2 t)
{
    vec2 p = S.pos;
    float top = max(p.y, t.y) + 0.05 + 0.6 * catH() + 0.1 * abs(t.x - p.x);
    top = min(top, max(1.0 - 1.2 * catH(), max(p.y, t.y) + 0.02));
    float vy = sqrt(2.0 * GRAVITY * max(top - p.y, 1e-4));
    float dy = t.y - p.y;
    float disc = max(vy * vy - 2.0 * GRAVITY * dy, 0.0);
    float tf = (vy + sqrt(disc)) / GRAVITY;
    float vx = (t.x - p.x) / max(tf, 0.05);
    if (abs(vx) > 1e-3) S.facing = sign(vx);
    launch(vec2(vx, vy), 0.0);
}

// ------------------------------------------------------------- navigation

// Plans the route to S.goal from where the cat stands; sets S.route,
// S.takeoffX and S.land. Returns the x the cat should walk to now.
float planRoute()
{
    vec2 span = currentSpan();
    S.span = span;
    bool sameY = abs(S.goal.y - S.pos.y) < 0.004;
    bool inSpan = S.goal.x > span.x - 0.01 && S.goal.x < span.y + 0.01;
    if (sameY && (inSpan || S.support < 0.5)) {
        S.route = R_WALK;
        return clamp(S.goal.x, span.x, span.y);
    }
    if (S.goal.y > S.pos.y + 0.004) {
        vec4 r = topAt(S.goal.x, S.goal.y);
        if (r.z > r.x) {
            float off = 16.0 * spx() + 0.05;
            float lx = r.x - off;
            float rx = r.z + off;
            bool lOk = lx > span.x && lx < span.y;
            bool rOk = rx > span.x && rx < span.y;
            float lo = max(span.x, r.x + edgeM() + 0.02);
            float hi = min(span.y, r.z - edgeM() - 0.02);
            S.route = R_UP;
            if (lOk && (!rOk || abs(lx - S.pos.x) < abs(rx - S.pos.x))) {
                S.takeoffX = lx;
                S.land = vec2(r.x + edgeM() + 0.04, r.w);
            } else if (rOk) {
                S.takeoffX = rx;
                S.land = vec2(r.z - edgeM() - 0.04, r.w);
            } else if (lo < hi) {
                S.takeoffX = clamp(S.pos.x, lo, hi);
                S.land = vec2(clamp(S.goal.x, lo, hi), r.w);
                S.land.x = S.takeoffX + clamp(S.land.x - S.takeoffX, -0.12, 0.12);
            } else {
                S.route = R_DOWN;
                S.takeoffX = S.goal.x < S.pos.x ? span.x : span.y;
                return S.takeoffX;
            }
            return S.takeoffX;
        }
    }
    // Lower, or another surface at this height: hop off the nearer edge that
    // has screen beyond it.
    if (S.support < 0.5) {
        S.route = R_WALK;
        return clamp(S.goal.x, span.x, span.y);
    }
    vec4 w = topAt(S.pos.x, S.pos.y);
    bool lOk = w.x - 0.01 > xMin();
    bool rOk = w.z + 0.01 < xMax();
    if (!lOk && !rOk) {
        S.route = R_WALK;
        return S.pos.x;
    }
    bool left = S.goal.x < span.x || (S.goal.x <= span.y && S.goal.x - span.x < span.y - S.goal.x);
    if (!lOk) left = false;
    if (!rOk) left = true;
    S.route = R_DOWN;
    S.takeoffX = left ? span.x : span.y;
    return S.takeoffX;
}

// Walks or runs toward x. Returns true on arrival.
bool moveTo(float x, float tol, bool hurry)
{
    float dx = x - S.pos.x;
    if (abs(dx) < tol) {
        S.vel.x = 0.0;
        return true;
    }
    bool run = hurry || abs(dx) > 0.30;
    float sp = run ? 0.62 * RUN_SPEED : 0.13 * mix(1.0, RUN_SPEED, 0.5);
    S.facing = sign(dx);
    float v = S.facing * min(sp, abs(dx) / gDt);
    S.vel.x = mix(S.vel.x, v, 1.0 - exp(-14.0 * gDt));
    if (abs(S.vel.x) > abs(dx) / gDt) S.vel.x = dx / gDt;
    if (S.mode != M_RUN && S.mode != M_WALK) setMode(run ? M_RUN : M_WALK);
    if (run && S.mode == M_WALK && abs(S.vel.x) > 0.3 * RUN_SPEED) setMode(M_RUN);
    if (!run && S.mode == M_RUN && abs(S.vel.x) < 0.2) setMode(M_WALK);
    return false;
}

// Drives the cat toward S.goal. Returns true once it stands there.
bool travel(float tol, bool hurry)
{
    float x = planRoute();
    if (S.route == R_WALK) {
        if (moveTo(x, tol, hurry)) {
            if (S.mode == M_WALK || S.mode == M_RUN) setMode(M_SIT);
            return true;
        }
        return false;
    }
    if (moveTo(x, 0.006, hurry)) {
        if (S.route == R_UP) {
            S.facing = S.land.x > S.pos.x + 0.004 ? 1.0 : (S.land.x < S.pos.x - 0.004 ? -1.0 : S.facing);
            setMode(M_CROUCH);
        } else {
            float dir = S.takeoffX < 0.5 * (S.span.x + S.span.y) ? -1.0 : 1.0;
            S.facing = dir;
            launch(vec2(dir * 0.38 * mix(1.0, RUN_SPEED, 0.4), 0.55), 0.0);
        }
    }
    return false;
}

// ------------------------------------------------------------- choices

// Index of a random window top the cat could stand on and be seen, or -1.
int pickWindow(int avoid)
{
    int n = 0;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i) || i == avoid) continue;
        vec4 r = winAt(i, 1.0);
        if (!platformOk(r) || r.z - r.x < 0.2) continue;
        vec2 c = vec2(0.5 * (r.x + r.z), r.w + 0.04);
        if (coveredAt(c) || c.x < 0.0 || c.x > gA) continue;
        n++;
    }
    if (n == 0) return -1;
    int k = int(rand() * float(n));
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i) || i == avoid) continue;
        vec4 r = winAt(i, 1.0);
        if (!platformOk(r) || r.z - r.x < 0.2) continue;
        vec2 c = vec2(0.5 * (r.x + r.z), r.w + 0.04);
        if (coveredAt(c) || c.x < 0.0 || c.x > gA) continue;
        if (k == 0) return i;
        k--;
    }
    return -1;
}

int currentWindow()
{
    if (S.support < 0.5) return -1;
    return supportAt(S.pos, 1.0, 0.006);
}

// A spot on window top r, away from its edges and from other windows.
float spotOn(vec4 r)
{
    float lo = r.x + edgeM() + 0.04;
    float hi = r.z - edgeM() - 0.04;
    float x = mix(lo, hi, rand());
    for (int k = 0; k < 6; k++) {
        if (!coveredAt(vec2(x, r.w + 0.6 * catH()))) break;
        x = mix(lo, hi, rand());
    }
    return clamp(x, max(lo, xMin()), min(hi, xMax()));
}

// Nearest floor x where the cat would be seen; -1 when the floor is covered.
float clearFloor(float x0)
{
    for (int k = 0; k < 40; k++) {
        float d = float(k) * 0.05;
        float a = x0 + d;
        float b = x0 - d;
        if (a < xMax() && !coveredAt(vec2(a, FLOOR_Y + 0.6 * catH()))) return a;
        if (b > xMin() && !coveredAt(vec2(b, FLOOR_Y + 0.6 * catH()))) return b;
    }
    return -1.0;
}

void goTo(int kind, vec2 g)
{
    S.goalKind = kind;
    S.goal = g;
}

// Puts a mug or a pencil near an edge of a visible window top.
bool placeObject()
{
    int wi = pickWindow(-1);
    if (wi < 0) return false;
    vec4 r = winAt(wi, 1.0);
    if (r.z - r.x < 0.25) return false;
    // Off the edge with floor room beyond it.
    float dir = rand() < 0.5 ? -1.0 : 1.0;
    if (r.x < 0.3) dir = 1.0;
    if (r.z > gA - 0.3) dir = r.x < 0.3 ? (rand() < 0.5 ? -1.0 : 1.0) : -1.0;
    float ox = dir > 0.0 ? r.z - 0.03 : r.x + 0.03;
    S.oKind = rand() < 0.55 ? O_MUG : O_PENCIL;
    S.oStage = 0;
    S.oT = 0.0;
    S.oPos = vec2(ox, r.w);
    S.oVel = vec2(0.0);
    S.oAngle = 0.0;
    S.oWinSpan = vec2(r.x, r.z);
    return true;
}

void knockGoal()
{
    float dir = S.oPos.x > 0.5 * (S.oWinSpan.x + S.oWinSpan.y) ? 1.0 : -1.0;
    goTo(G_KNOCK, vec2(S.oPos.x - dir * (reach() + 3.0 * spx()), S.oPos.y));
}

// A window standing on the floor with a side edge on screen to peek round:
// xy = edge x, side (-1 left edge, +1 right edge); z = 0 when none.
vec3 peekSpot()
{
    int n = 0;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 w = winAt(i, 1.0);
        if (w.y > FLOOR_Y + 0.02 || w.w < FLOOR_Y + 0.2) continue;
        if (w.x > 0.15 || w.z < gA - 0.15) n++;
    }
    if (n == 0) return vec3(0.0);
    int k = int(rand() * float(n));
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 w = winAt(i, 1.0);
        if (w.y > FLOOR_Y + 0.02 || w.w < FLOOR_Y + 0.2) continue;
        if (!(w.x > 0.15 || w.z < gA - 0.15)) continue;
        if (k-- > 0) continue;
        float side = rand() < 0.5 ? -1.0 : 1.0;
        if (w.x <= 0.15) side = 1.0;
        if (w.z >= gA - 0.15) side = -1.0;
        return vec3(side < 0.0 ? w.x : w.z, side, 1.0);
    }
    return vec3(0.0);
}

// Picks the next thing to do on its own, weighted by what is possible here
// and never the same nap, groom or peek twice running.
void decideAuto()
{
    int here = currentWindow();
    if (S.autoStep < 0.5) {
        // First outing: up onto a window, where it is seen.
        S.autoStep = 1.0;
        int wi = pickWindow(here);
        if (wi >= 0) {
            vec4 w = winAt(wi, 1.0);
            goTo(G_SPOT, vec2(spotOn(w), w.w));
            return;
        }
    }
    int last = int(S.lastChoice + 0.5);
    int other = pickWindow(here);
    vec3 pk = peekSpot();
    bool objWaiting = MISCHIEF && S.oKind != O_NONE && S.oStage == 0;
    float w1 = other >= 0 ? (here < 0 ? 4.0 : 2.5) : 0.0;           // another window
    float w2 = 2.0;                                                   // wander
    float w3 = last == 3 ? 0.0 : 1.3;                                 // nap
    float w4 = pk.z > 0.5 && last != 4 ? 2.5 : 0.0;                   // peek
    float w5 = objWaiting ? 5.0 : (MISCHIEF && S.oKind == O_NONE && S.mischT > 45.0 ? 1.6 : 0.0);
    float w6 = last == 6 ? 0.0 : 0.8;                                 // groom
    float w7 = here >= 0 ? 1.5 : 0.0;                                 // down
    float r = rand() * (w1 + w2 + w3 + w4 + w5 + w6 + w7);
    int c = 2;
    if ((r -= w1) < 0.0) c = 1;
    else if ((r -= w2) < 0.0) c = 2;
    else if ((r -= w3) < 0.0) c = 3;
    else if ((r -= w4) < 0.0) c = 4;
    else if ((r -= w5) < 0.0) c = 5;
    else if ((r -= w6) < 0.0) c = 6;
    else c = 7;
    S.lastChoice = float(c);
    if (c == 1) {
        vec4 w = winAt(other, 1.0);
        goTo(rand() < 0.3 ? G_NAP : G_SPOT, vec2(spotOn(w), w.w));
    } else if (c == 2) {
        vec2 span = currentSpan();
        float x = mix(span.x, span.y, rand());
        if (here < 0) {
            float cf = clearFloor(x);
            if (cf > 0.0) x = cf;
        }
        goTo(G_SPOT, vec2(x, S.pos.y));
    } else if (c == 3) {
        goTo(G_NAP, S.pos);
    } else if (c == 4) {
        goTo(G_PEEK, vec2(pk.x - pk.y * 18.0 * spx(), FLOOR_Y));
        S.land = pk.xy;
    } else if (c == 5) {
        if (objWaiting) {
            knockGoal();
        } else if (placeObject()) {
            S.mischT = 0.0;
            knockGoal();
        }
    } else if (c == 6) {
        setMode(rand() < 0.5 ? M_WASH : M_SCRATCH);
        S.goalKind = G_NONE;
    } else {
        vec2 span = currentSpan();
        goTo(G_SPOT, vec2(clamp(S.pos.x < 0.5 * (span.x + span.y) ? span.x - 0.2 : span.y + 0.2, xMin(), xMax()), FLOOR_Y));
    }
}

// ------------------------------------------------------------- init

void init()
{
    S.pos = vec2(clamp(0.38 * gA, xMin(), xMax()), FLOOR_Y);
    S.vel = vec2(0.0);
    S.mode = M_SIT;
    S.modeT = 0.0;
    S.facing = 1.0;
    S.support = 0.0;
    S.frame = 0.0;
    S.eye = 0.0;
    S.roll = 0.0;
    S.rollV = 0.0;
    S.goal = S.pos;
    S.goalKind = G_NONE;
    S.route = R_WALK;
    S.mLast = gM;
    S.still = 100.0;
    S.pet = 0.0;
    S.yAge = 0.0;
    S.oKind = O_NONE;
    S.heartClock = 10.0;
    S.heartStop = 0.0;
    S.bubbleT = 100.0;
    S.exclT = 100.0;
    S.held = iMouse.z > 0.0 ? 1.0 : 0.0;
    S.rng = floor(fract(iDate.w * 0.0137) * 1000.0);
    S.inited = 1.0;
    S.decide = 1.2;
    S.autoStep = 0.0;
    S.landT = 100.0;
    S.mealDone = -1.0;
    S.shadowY = FLOOR_Y;
    S.impactT = -1.0;
    S.mischT = 40.0;
    S.lastChoice = 0.0;
}

// ------------------------------------------------------------- bodies

// Carries the cat on its window top; drops it when the window goes.
void supportStep()
{
    if (S.support < 0.5 || airborne()) {
        S.winVel = vec2(0.0);
        return;
    }
    int wi = supportAt(S.pos, gF0, 0.008);
    if (wi < 0) {
        S.exclT = 0.0;
        launch(vec2(0.0, 0.1), 0.0);
        return;
    }
    vec4 a = winAt(wi, gF0);
    vec4 b = winAt(wi, gF1);
    vec2 d = vec2(b.x - a.x, b.w - a.w);
    if (length(d) > 0.08) {
        launch(vec2(0.0, 0.0), 0.0);
        return;
    }
    S.pos.x += d.x;
    S.pos.y = b.w;
    float sp = length(d) / max(gDt, 1e-4);
    S.winVel = mix(S.winVel, d / max(gDt, 1e-4), 1.0 - exp(-10.0 * gDt));
    S.rideT = sp > 0.15 ? S.rideT + gDt : max(S.rideT - 2.0 * gDt, 0.0);
    if (S.pos.x < b.x - 0.002 || S.pos.x > b.z + 0.002) launch(vec2(S.vel.x, 0.0), 0.0);
    // Flung off by a fast drag.
    if (sp > 3.0 && S.mode != M_AIR) {
        float dir = d.x > 0.0 ? -1.0 : 1.0;
        S.facing = dir;
        launch(vec2(dir * 0.3 + 0.2 * d.x / gDt, 0.7), dir * 13.0);
    }
}

void airStep()
{
    if (!airborne()) return;
    float y0 = S.pos.y;
    S.vel.y -= GRAVITY * gDt;
    S.pos += S.vel * gDt;
    if (S.pos.x < xMin()) { S.pos.x = xMin(); S.vel.x = abs(S.vel.x) * 0.2; }
    if (S.pos.x > xMax()) { S.pos.x = xMax(); S.vel.x = -abs(S.vel.x) * 0.2; }
    if (S.pos.y > 1.0 - catH()) S.vel.y = min(S.vel.y, 0.0);
    // Righting reflex: roll eases back upright on the way down.
    S.roll += S.rollV * gDt;
    if (S.vel.y < 0.0 || abs(S.rollV) < 1.0) {
        float target = 6.2831853 * floor(S.roll / 6.2831853 + 0.5);
        S.rollV += (-60.0 * (S.roll - target) - 11.0 * S.rollV) * gDt;
    }
    if (S.vel.y >= 0.0) return;
    float land = -1.0;
    float m = 3.0 * spx();
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 r = winAt(i, gF1);
        if (!platformOk(r)) continue;
        if (S.pos.x > r.x + m && S.pos.x < r.z - m && r.w <= y0 + 1e-4 && r.w >= S.pos.y) land = max(land, r.w);
    }
    bool hit = false;
    if (land > 0.0) {
        S.pos.y = land;
        S.support = 1.0;
        hit = true;
    } else if (S.pos.y <= FLOOR_Y) {
        S.pos.y = FLOOR_Y;
        S.support = 0.0;
        hit = true;
    }
    if (hit) {
        S.landV = -S.vel.y;
        S.landT = 0.0;
        S.dust = S.pos;
        S.vel = vec2(0.0);
        S.roll = 0.0;
        S.rollV = 0.0;
        bool wasStartle = S.mode == M_STARTLE;
        setMode(M_LAND);
        if (wasStartle) S.modeT = 0.1;
    }
}

void yarnStep()
{
    if (S.yAge <= 0.0) return;
    S.yAge += gDt;
    S.yIdle += gDt;
    float r = YARN_R * spx();
    if (S.yIdle > 70.0) {
        S.yAge = 0.0;
        return;
    }
    if (S.yRest > 0.5) {
        // Resting: carried by a window top, rolls with friction, drops off edges.
        vec2 foot = S.yPos - vec2(0.0, r);
        if (foot.y > FLOOR_Y + 0.002) {
            int wi = supportAt(foot, gF0, 0.006);
            if (wi < 0) {
                S.yRest = 0.0;
            } else {
                vec4 a = winAt(wi, gF0);
                vec4 b = winAt(wi, gF1);
                S.yPos.x += b.x - a.x;
                S.yPos.y = b.w + r;
                if (S.yPos.x < b.x || S.yPos.x > b.z) S.yRest = 0.0;
            }
        }
        S.yVel.y = 0.0;
        S.yVel.x *= exp(-1.1 * gDt);
        S.yPos.x += S.yVel.x * gDt;
    }
    if (S.yRest < 0.5) {
        float y0 = S.yPos.y - r;
        S.yVel.y -= GRAVITY * gDt;
        S.yPos += S.yVel * gDt;
        if (S.yVel.y < 0.0) {
            float land = -1.0;
            for (int i = 0; i < iWindowCount && i < 16; i++) {
                if (!winValid(i)) continue;
                vec4 w = winAt(i, gF1);
                if (!platformOk(w)) continue;
                if (S.yPos.x > w.x && S.yPos.x < w.z && w.w <= y0 + 1e-4 && w.w >= S.yPos.y - r) land = max(land, w.w);
            }
            if (land < 0.0 && S.yPos.y - r <= FLOOR_Y) land = FLOOR_Y;
            if (land > 0.0) {
                S.yPos.y = land + r;
                if (S.yVel.y < -0.25) {
                    S.yVel.y = -S.yVel.y * 0.55;
                    S.yVel.x *= 0.8;
                } else {
                    S.yVel.y = 0.0;
                    S.yRest = 1.0;
                }
            }
        }
    }
    float lo = 0.01 + r;
    float hi = gA - 0.01 - r;
    if (S.yPos.x < lo) { S.yPos.x = lo; S.yVel.x = abs(S.yVel.x) * 0.7; }
    if (S.yPos.x > hi) { S.yPos.x = hi; S.yVel.x = -abs(S.yVel.x) * 0.7; }
    if (S.yPos.y > 1.0 - r) { S.yPos.y = 1.0 - r; S.yVel.y = -abs(S.yVel.y) * 0.5; }
    S.yAngle = mod(S.yAngle - S.yVel.x / r * gDt, 6.2831853);
}

void objectStep()
{
    if (S.impactT >= 0.0) {
        S.impactT += gDt;
        if (S.impactT > 9.0) S.impactT = -1.0;
    }
    if (S.oKind == O_NONE) return;
    S.oT += gDt;
    if (S.oStage == 0) {
        int wi = supportAt(S.oPos, gF0, 0.008);
        if (wi < 0) {
            S.oStage = 1;
            S.oT = 0.0;
            S.oVel = vec2(0.0);
        } else {
            vec4 a = winAt(wi, gF0);
            vec4 b = winAt(wi, gF1);
            S.oPos.x += b.x - a.x;
            S.oPos.y = b.w;
            S.oWinSpan = vec2(b.x, b.z);
            if (S.oPos.x < b.x - 0.002 || S.oPos.x > b.z + 0.002) {
                S.oStage = 1;
                S.oT = 0.0;
            }
        }
        // Left alone too long: it fades away.
        if (S.oT > 90.0) S.oKind = O_NONE;
        return;
    }
    if (S.oStage == 1) {
        float y0 = S.oPos.y;
        S.oVel.y -= GRAVITY * gDt;
        S.oPos += S.oVel * gDt;
        float spin = S.oKind == O_PENCIL ? 9.0 : 5.0;
        S.oAngle += sign(S.oVel.x + 1e-4) * -spin * gDt;
        if (S.oVel.y >= 0.0) return;
        float land = -1.0;
        for (int i = 0; i < iWindowCount && i < 16; i++) {
            if (!winValid(i)) continue;
            vec4 w = winAt(i, gF1);
            if (!platformOk(w)) continue;
            if (S.oPos.x > w.x && S.oPos.x < w.z && w.w <= y0 + 1e-4 && w.w >= S.oPos.y) land = max(land, w.w);
        }
        if (land < 0.0 && S.oPos.y <= FLOOR_Y) land = FLOOR_Y;
        if (land > 0.0) {
            S.oPos.y = land;
            if (S.oKind == O_MUG) {
                S.impact = S.oPos;
                S.impactT = 0.0;
                S.oKind = O_NONE;
            } else if (S.oVel.y < -0.3) {
                S.oVel.y = -S.oVel.y * 0.42;
                S.oVel.x *= 0.6;
            } else {
                S.oStage = 2;
                S.oT = 0.0;
                S.oVel = vec2(0.0);
                S.oAngle = 3.14159265 * floor(S.oAngle / 3.14159265 + 0.5);
            }
        }
        return;
    }
    // Landed: rests, then fades.
    int wi = supportAt(S.oPos, gF0, 0.008);
    if (wi >= 0) {
        vec4 a = winAt(wi, gF0);
        vec4 b = winAt(wi, gF1);
        S.oPos.x += b.x - a.x;
        S.oPos.y = b.w;
    }
    if (S.oT > 8.0) S.oKind = O_NONE;
}

// ------------------------------------------------------------- the mind

void emitHearts(bool on)
{
    if (on) {
        if (S.heartStop >= 0.0 && S.heartClock - S.heartStop > 2.0) S.heartClock = 0.0;
        S.heartStop = -1.0;
    } else if (S.heartStop < 0.0) {
        S.heartStop = S.heartClock;
    }
}

void meow(float kind)
{
    S.bubbleT = 0.0;
    S.bubbleKind = kind;
    S.vel.x = 0.0;
    setMode(M_MEOW);
}

void think()
{
    float hr = clockHours();
    bool night = NIGHT_BASKET && nightAt(hr);
    int meal = MEALTIMES ? mealAt(hr) : -1;
    float mealKey = meal >= 0 ? iDate.z * 2.0 + float(meal) : -1.0;
    bool grounded = S.support >= 0.0 && !airborne();
    bool cursorLive = FOLLOW_CURSOR && gMOk && S.still < 1.5;
    bool yarnLive = S.yAge > 0.0 && S.yIdle < 22.0;
    bool inBasket = S.goalKind == G_BASKET && S.mode == M_SLEEP;

    // ---- clicks
    bool held = iMouse.z > 0.0;
    if (held && S.held < 0.5) {
        vec2 c = gM;
        bool ignore = !gMOk || coveredAt(c) || c.y < 0.06;
        if (!ignore) {
            if (overCat(c, 4.0)) {
                if (grounded && interruptible()) {
                    if (S.mode == M_SLEEP) {
                        S.bubbleT = 0.0;
                        S.bubbleKind = 1.0;
                        if (!inBasket) setMode(M_YAWN);
                    } else {
                        meow(rand() < 0.5 ? 0.0 : 1.0);
                    }
                }
            } else {
                S.yPos = c;
                S.yVel = vec2(0.0);
                S.yAge = 0.001;
                S.yIdle = 0.0;
                S.yRest = 0.0;
                yarnLive = true;
            }
        }
    }
    S.held = held ? 1.0 : 0.0;

    // ---- petting
    // A parked cursor (or mouse input off) stops petting after a few seconds.
    bool hover = gMOk && overCat(gM, 0.0) && gMSpeed < 0.9 && S.still < 6.0 && !coveredAt(gM);
    S.pet = hover && grounded ? min(S.pet + gDt, 1.0) : max(S.pet - 2.5 * gDt, 0.0);
    bool petted = S.pet > 0.35;
    emitHearts(petted || (S.mode == M_MEOW && S.bubbleKind > 0.5 && S.modeT < 0.8));

    if (!grounded) return;

    // ---- riding a dragged window
    if (S.support > 0.5 && S.rideT > 0.12 && S.mode != M_RIDE && S.mode != M_CROUCH) setMode(M_RIDE);
    if (S.mode == M_RIDE) {
        S.vel.x = 0.0;
        if (S.modeT > 1.1 || (S.rideT <= 0.0 && S.modeT > 0.6)) {
            if (S.rideT <= 0.0) {
                setMode(M_SIT);
            } else {
                // Off the trailing side, so the window slides away beneath.
                vec2 span = currentSpan();
                float dir = S.pos.x - span.x < span.y - S.pos.x ? -1.0 : 1.0;
                if (abs(S.winVel.x) > 0.1) dir = -sign(S.winVel.x);
                S.facing = dir;
                S.rideT = 0.0;
                launch(vec2(dir * 0.5 + 0.5 * S.winVel.x, 0.85), dir * 12.0);
            }
        }
        return;
    }

    if (S.mode == M_LAND) {
        S.vel.x = 0.0;
        if (S.modeT > 0.2) setMode(M_SIT);
        return;
    }
    if (S.mode == M_CROUCH) {
        S.vel.x = 0.0;
        if (S.modeT > 0.42) {
            S.exclT = 100.0;
            leapTo(S.land);
        }
        return;
    }

    // ---- startled awake by the cursor
    if (S.mode == M_SLEEP && !inBasket && FOLLOW_CURSOR && S.stir > 0.05) {
        S.stir = 0.0;
        S.exclT = 0.0;
        S.facing = gM.x < S.pos.x ? -1.0 : 1.0;
        launch(vec2(0.0, 0.8), 0.0);
        setMode(M_STARTLE);
        return;
    }

    if (!interruptible()) {
        if (S.mode == M_MEOW || S.mode == M_BAT || S.mode == M_STRETCH) S.vel.x = 0.0;
        return;
    }

    // ---- being petted
    if (petted) {
        S.vel.x = 0.0;
        if (S.mode != M_SLEEP && S.mode != M_PURR && S.mode != M_LOAF) setMode(M_PURR);
        if (S.mode == M_PURR && gMOk) S.facing = gM.x < S.pos.x - 0.01 ? -1.0 : (gM.x > S.pos.x + 0.01 ? 1.0 : S.facing);
        return;
    }
    if (S.mode == M_PURR) {
        if (S.modeT > 0.4 && S.pet <= 0.0) setMode(M_SIT);
        else return;
    }

    // ---- what to want
    if (yarnLive) {
        S.goalKind = G_YARN;
    } else if (S.goalKind == G_YARN) {
        S.goalKind = G_NONE;
        S.decide = 3.0;
    }
    if (S.goalKind != G_YARN) {
        if (night) {
            if (S.goalKind != G_BASKET) {
                goTo(G_BASKET, vec2(basketX(gA), FLOOR_Y));
                if (S.mode == M_SLEEP) setMode(M_STRETCH);
            }
        } else {
            if (S.goalKind == G_BASKET) S.goalKind = G_NONE;
            if (cursorLive) {
                if (S.goalKind != G_CURSOR && S.mode == M_SLEEP) setMode(M_STRETCH);
                S.goalKind = G_CURSOR;
            } else if (meal >= 0 && S.mealDone != mealKey && S.goalKind != G_CURSOR && S.goalKind != G_BOWL) {
                goTo(G_BOWL, vec2(bowlX(gA) + 15.0 * spx(), FLOOR_Y));
                S.mealStage = 0.0;
                S.mealT = 0.0;
            }
        }
    }
    if (S.mode == M_STRETCH) {
        S.vel.x = 0.0;
        if (S.modeT < 1.2) return;
        setMode(M_SIT);
    }

    // ---- doing it
    if (S.goalKind == G_YARN) {
        float r = YARN_R * spx();
        vec2 sb = surfaceBelow(S.yPos.x, S.yPos.y - r + 0.002, 0.0);
        float side = S.yPos.x < S.pos.x ? -1.0 : 1.0;
        S.goal = vec2(clamp(S.yPos.x - side * reach(), xMin(), xMax()), sb.x);
        bool near = abs(S.yPos.x - (S.pos.x + S.facing * reach())) < 6.0 * spx()
                 && S.yPos.y - r - S.pos.y < 0.03 && S.yPos.y - r - S.pos.y > -0.01;
        if (near && (S.mode == M_SIT || S.mode == M_WALK || S.mode == M_RUN)) {
            S.facing = side;
            S.vel.x = 0.0;
            setMode(M_BAT);
            S.steps = 0.0;
            return;
        }
        if (S.mode == M_BAT) {
            if (S.modeT > 0.12 && S.steps < 0.5) {
                S.steps = 1.0;
                if (abs(S.yPos.x - S.pos.x) < reach() + 8.0 * spx()) {
                    S.yVel = vec2(S.facing * (0.45 + 0.45 * rand()), 0.45 + 0.5 * rand());
                    S.yRest = 0.0;
                    S.yIdle = 0.0;
                }
            }
            if (S.modeT < 0.5) return;
            setMode(M_SIT);
        }
        if (S.mode == M_SIT && S.modeT < 0.25) return;
        travel(4.0 * spx(), true);
        return;
    }

    if (S.goalKind == G_CURSOR) {
        if (gMOk) {
            vec3 g = cursorGoal(gM);
            float side = gM.x < S.pos.x ? 1.0 : -1.0;
            S.goal = vec2(g.x, g.y);
            // Stop beside the cursor, not under it, when it rests low.
            if (abs(gM.y - g.y) < 0.12) S.goal.x = clamp(g.x + side * 18.0 * spx(), xMin(), xMax());
        }
        bool there = S.route == R_WALK && abs(S.goal.x - S.pos.x) < 6.0 * spx() && abs(S.goal.y - S.pos.y) < 0.004;
        if (!there || S.still < 0.3) {
            if (S.mode == M_SLEEP || S.mode == M_WASH || S.mode == M_SCRATCH || S.mode == M_YAWN || S.mode == M_LOAF) {
                if (S.mode == M_SLEEP) setMode(M_STRETCH);
                else setMode(M_SIT);
                return;
            }
            if (!there) {
                travel(5.0 * spx(), abs(S.goal.x - S.pos.x) > 0.12 || abs(S.goal.y - S.pos.y) > 0.01);
                return;
            }
        }
        // There, and the cursor rests: sit, groom, doze off.
        S.vel.x = 0.0;
        if (gMOk && abs(gM.x - S.pos.x) > 0.02 && S.mode == M_SIT) S.facing = gM.x < S.pos.x ? -1.0 : 1.0;
        float st = S.still;
        int want = M_SIT;
        if (st > 4.0 && st < 7.0) want = M_WASH;
        else if (st > 8.0 && st < 10.0) want = M_SCRATCH;
        else if (st > 10.0 && st < 11.6) want = M_YAWN;
        else if (st > 11.6) want = M_SLEEP;
        if (st > 45.0) {
            S.goalKind = G_NONE;
            S.decide = 2.0 + 3.0 * rand();
            setMode(M_STRETCH);
            return;
        }
        if (want != S.mode && !(S.mode == M_SIT && want == M_SIT)) setMode(want);
        return;
    }

    if (S.goalKind == G_BASKET) {
        if (S.mode == M_SLEEP) {
            S.vel.x = 0.0;
            S.facing = -1.0;
            return;
        }
        if (travel(2.0 * spx(), false)) {
            S.facing = -1.0;
            if (S.mode == M_SIT && S.modeT > 0.8) setMode(M_YAWN);
            if (S.mode == M_YAWN && S.modeT > 1.4) setMode(M_SLEEP);
        } else if (S.mode == M_YAWN && S.modeT > 1.4) {
            setMode(M_SLEEP);
        }
        return;
    }

    if (S.goalKind == G_BOWL) {
        if (S.mealStage < 0.5 && !(S.route == R_WALK && abs(S.goal.x - S.pos.x) < 3.0 * spx() && abs(S.goal.y - S.pos.y) < 0.004)) {
            travel(2.0 * spx(), false);
            return;
        }
        S.vel.x = 0.0;
        S.facing = -1.0;
        S.mealT += gDt;
        if (S.mealStage < 0.5) {
            S.mealStage = 1.0;
            S.mealT = 0.0;
            setMode(M_SIT);
        }
        if (S.mealStage < 1.5) {
            // Asks for food.
            if (S.mode != M_MEOW && fract(S.mealT / 3.2) < 0.02 && S.mealT > 0.5) meow(0.0);
            if (S.mode == M_MEOW && S.modeT > 1.2) setMode(M_SIT);
            if (S.mealT > 9.0) {
                S.mealStage = 2.0;
                S.mealT = 0.0;
                S.kibble = 1.0;
                setMode(M_EAT);
            }
            return;
        }
        if (S.mealStage < 2.5) {
            setMode(M_EAT);
            S.kibble = max(1.0 - S.mealT / 16.0, 0.0);
            if (S.mealT > 16.0) {
                S.mealStage = 3.0;
                S.mealT = 0.0;
                setMode(M_WASH);
            }
            return;
        }
        if (S.mealT > 3.5) {
            S.mealDone = mealKey;
            S.goalKind = G_NONE;
            S.decide = 2.0;
            setMode(M_SIT);
        }
        return;
    }

    if (S.goalKind == G_KNOCK) {
        if (S.oKind == O_NONE || S.oStage != 0) {
            if (S.mode != M_KNOCK) {
                S.goalKind = G_NONE;
                S.decide = 2.0;
                return;
            }
        }
        float dir = S.oPos.x > S.pos.x ? 1.0 : -1.0;
        if (S.mode != M_KNOCK) {
            if (S.oKind != O_NONE) knockGoal();
            bool there = abs(S.goal.y - S.pos.y) < 0.004 && abs(S.goal.x - S.pos.x) < 3.0 * spx();
            if (!there) {
                travel(2.0 * spx(), false);
                return;
            }
            S.vel.x = 0.0;
            S.facing = dir;
            setMode(M_KNOCK);
            S.steps = 0.0;
            return;
        }
        // Stare, look at the viewer, tap it over the edge, watch it fall.
        S.vel.x = 0.0;
        if (S.oKind != O_NONE && S.oStage == 0) {
            S.facing = dir;
            float t = S.modeT - 2.4;
            if (t > 0.0) {
                float tap = floor(t / 0.55);
                if (tap > S.steps - 0.5 && fract(t / 0.55) > 0.45) {
                    S.steps = tap + 1.0;
                    S.oPos.x += dir * 4.5 * spx();
                    float edge = dir > 0.0 ? S.oWinSpan.y : S.oWinSpan.x;
                    if ((S.oPos.x - edge) * dir > -0.002) {
                        S.oStage = 1;
                        S.oT = 0.0;
                        S.oVel = vec2(dir * 0.16, 0.12);
                        S.modeT = 100.0;
                    }
                }
            }
            // Taps that miss after the object moved away: follow it.
            if (abs(S.oPos.x - S.pos.x) > reach() + 9.0 * spx()) S.pos.x += dir * min(0.1 * gDt, abs(S.oPos.x - S.pos.x) - reach());
            return;
        }
        if (S.modeT < 100.0) S.modeT = 100.0;
        if (S.modeT > 103.2) {
            S.goalKind = G_NONE;
            S.decide = 2.0 + 2.0 * rand();
            setMode(M_SIT);
        }
        return;
    }

    if (S.goalKind == G_PEEK) {
        if (S.mode != M_PEEK) {
            if (travel(2.0 * spx(), false)) {
                setMode(M_PEEK);
                S.facing = S.land.y;
            }
            return;
        }
        // Slide out until the head clears the edge, look, duck back, again.
        S.vel.x = 0.0;
        float side = S.land.y;
        float t = S.modeT;
        float k = smoothstep(0.0, 0.7, t) * (1.0 - smoothstep(3.2, 3.7, t))
                + smoothstep(4.4, 4.7, t) * (1.0 - smoothstep(6.8, 7.4, t));
        float hidden = 17.0;
        float shown = t > 4.4 ? 0.0 : 3.0;
        S.pos.x = S.land.x - side * mix(hidden, shown, k) * spx();
        S.facing = side;
        if (t > 7.6) {
            S.goalKind = G_SPOT;
            S.goal = vec2(clamp(S.land.x + side * 0.08, xMin(), xMax()), FLOOR_Y);
            setMode(M_WALK);
        }
        return;
    }

    if (S.goalKind == G_SPOT || S.goalKind == G_NAP) {
        if ((S.mode == M_LOAF || S.mode == M_SLEEP) && S.coveredT > 6.0) {
            setMode(M_STRETCH);
            S.goalKind = G_NONE;
            S.decide = 0.0;
            return;
        }
        if (S.mode == M_LOAF || S.mode == M_SLEEP) {
            S.vel.x = 0.0;
            if (S.mode == M_LOAF && S.modeT > 5.0) setMode(M_SLEEP);
            if (S.mode == M_SLEEP && S.modeT > 15.0) {
                setMode(M_STRETCH);
                S.goalKind = G_NONE;
                S.decide = 2.0;
            }
            return;
        }
        if (travel(4.0 * spx(), false)) {
            if (S.goalKind == G_NAP) {
                setMode(M_LOAF);
                S.facing = S.pos.x < 0.5 * gA ? 1.0 : -1.0;
            } else {
                S.goalKind = G_NONE;
                S.decide = 2.5 + 4.0 * rand();
            }
        }
        return;
    }

    // ---- idle
    S.vel.x = 0.0;
    if ((S.mode == M_WASH && S.modeT > 3.0) || (S.mode == M_SCRATCH && S.modeT > 2.0)
        || (S.mode == M_YAWN && S.modeT > 1.5) || (S.mode == M_MEOW && S.modeT > 1.3)
        || (S.mode == M_STRETCH && S.modeT > 1.2) || S.mode == M_WALK || S.mode == M_RUN
        || (S.mode == M_BAT && S.modeT > 0.5) || S.mode == M_KNOCK || S.mode == M_PEEK || S.mode == M_EAT) setMode(M_SIT);
    // Hidden behind a window for a while: come out.
    if (S.coveredT > 4.0) {
        S.coveredT = 0.0;
        float x = S.support < 0.5 ? clearFloor(S.pos.x) : -1.0;
        if (x > 0.0) goTo(G_SPOT, vec2(x, FLOOR_Y));
        else decideAuto();
        return;
    }
    if (S.mode == M_SIT || S.mode == M_LOAF) {
        S.decide -= gDt;
        if (S.decide <= 0.0) {
            S.decide = 3.0 + 4.0 * rand();
            decideAuto();
        }
    }
}

// ------------------------------------------------------------- animation

void animate()
{
    float t = S.modeT;
    int f = F_SIT;
    int e = EYE_OPEN;
    float clk = iDate.w;
    float blink = fract(clk / 3.7 + 0.31) < 0.04 ? 1.0 : 0.0;
    float sp = spx();
    if (S.mode == M_SIT) {
        f = fract(clk / 4.3) < 0.12 ? F_SIT_FLICK : F_SIT;
        e = blink > 0.5 ? EYE_BLINK : EYE_OPEN;
    } else if (S.mode == M_WALK) {
        // One stride (four frames) per 30 sprite pixels walked.
        float ph = (S.facing > 0.0 ? S.pos.x : -S.pos.x) / (30.0 * sp);
        f = F_WALK1 + int(mod(floor(ph * 4.0), 4.0));
    } else if (S.mode == M_RUN) {
        float ph = (S.facing > 0.0 ? S.pos.x : -S.pos.x) / (64.0 * sp);
        f = F_RUN1 + int(mod(floor(ph * 4.0), 4.0));
        if (abs(S.vel.x) < 0.25) f = F_WALK1 + int(mod(floor(ph * 8.5), 4.0));
    } else if (S.mode == M_CROUCH) {
        f = fract(t * 5.0) < 0.5 ? F_CROUCH1 : F_CROUCH2;
    } else if (S.mode == M_AIR) {
        f = S.vel.y > 0.2 ? F_LEAP : F_FALL;
        e = S.exclT < 1.0 ? EYE_WIDE : EYE_OPEN;
    } else if (S.mode == M_LAND || S.mode == M_RIDE) {
        f = F_CROUCH1;
        e = S.mode == M_RIDE ? EYE_WIDE : EYE_BLINK;
    } else if (S.mode == M_WASH) {
        f = fract(t * 1.6) < 0.5 ? F_WASH1 : F_WASH2;
        e = EYE_SLEEP;
    } else if (S.mode == M_SCRATCH) {
        f = fract(t * 7.0) < 0.5 ? F_SCRATCH1 : F_SCRATCH2;
        e = EYE_SLEEP;
    } else if (S.mode == M_YAWN) {
        f = t > 0.2 && t < 1.2 ? F_YAWN : F_SIT;
        e = EYE_SLEEP;
    } else if (S.mode == M_SLEEP) {
        f = fract(clk / 3.4) < 0.5 ? F_SLEEP1 : F_SLEEP2;
        e = S.pet > 0.35 ? EYE_HAPPY : EYE_SLEEP;
    } else if (S.mode == M_STARTLE) {
        f = F_STARTLE;
        e = EYE_WIDE;
    } else if (S.mode == M_PURR) {
        f = F_PURR;
        e = EYE_HAPPY;
    } else if (S.mode == M_MEOW) {
        f = t < 0.9 ? F_MEOW : F_SIT;
        e = S.bubbleKind > 0.5 ? EYE_HAPPY : EYE_OPEN;
    } else if (S.mode == M_BAT) {
        f = t < 0.1 ? F_BAT1 : (t < 0.32 ? F_BAT2 : F_SITP);
    } else if (S.mode == M_LOAF) {
        f = F_LOAF;
        e = S.pet > 0.35 ? EYE_HAPPY : (fract(clk / 5.0) < 0.12 ? EYE_BLINK : EYE_HALF);
    } else if (S.mode == M_PEEK) {
        f = F_SITP;
        e = blink > 0.5 ? EYE_BLINK : EYE_OPEN;
    } else if (S.mode == M_STRETCH) {
        f = t < 1.0 ? F_STRETCH : F_SIT;
        e = EYE_SLEEP;
    } else if (S.mode == M_EAT) {
        f = fract(t * 2.5) < 0.5 ? F_EAT1 : F_EAT2;
        e = EYE_SLEEP;
    } else if (S.mode == M_KNOCK) {
        if (t < 1.3) {
            f = F_SITP;
        } else if (t < 2.4) {
            f = F_SIT;
            e = t > 1.9 && t < 2.0 ? EYE_BLINK : EYE_OPEN;
        } else if (t < 100.0) {
            float u = fract((t - 2.4) / 0.55);
            f = u < 0.45 ? F_BAT1 : (u < 0.8 ? F_BAT2 : F_SITP);
        } else if (t < 101.6) {
            f = F_SITP;
        } else {
            f = F_SIT;
            e = t > 102.2 && t < 102.35 ? EYE_BLINK : EYE_OPEN;
        }
    }
    S.frame = float(f);
    S.eye = float(e);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 px = ivec2(fragCoord);
    if (px.y > 0 || px.x >= NSTATE) {
        fragColor = vec4(0.0);
        return;
    }
    gA = iResolution.x / iResolution.y;
    gDt = clamp(iTimeDelta, 0.0, 0.05);
    gF0 = float(iSubstep) / float(max(iSubsteps, 1));
    gF1 = float(iSubstep + 1) / float(max(iSubsteps, 1));
    gMOk = cursorOnScreen();
    gM = iMouse.xy / iResolution.y;

    load();
    if (S.inited < 0.5 || iFrame == 0) init();

    float mv = length(gM - S.mLast);
    gMSpeed = mv / max(gDt, 1e-4);
    if (gMOk && mv > 0.0015) {
        S.still = 0.0;
        if (S.mode == M_SLEEP) S.stir += mv;
    } else {
        S.still = min(S.still + gDt, 1000.0);
        S.stir = max(S.stir - 0.02 * gDt, 0.0);
    }
    S.mLast = gM;

    S.modeT = min(S.modeT + gDt, 1000.0);
    S.bubbleT = min(S.bubbleT + gDt, 100.0);
    S.exclT = min(S.exclT + gDt, 100.0);
    S.mischT = min(S.mischT + gDt, 1000.0);
    S.landT = min(S.landT + gDt, 100.0);
    S.heartClock += gDt;
    // Wraps by a whole number of 0.7 s emission periods.
    if (S.heartClock > 700.0) S.heartClock -= 700.0;
    S.coveredT = catCovered() && !airborne() && S.mode != M_PEEK ? S.coveredT + gDt : 0.0;

    supportStep();
    think();
    if (!airborne()) {
        vec2 span = currentSpan();
        S.pos.x = clamp(S.pos.x + S.vel.x * gDt, min(span.x, S.pos.x), max(span.y, S.pos.x));
        if (S.support < 0.5) S.pos.y = FLOOR_Y;
        if (S.mode == M_PEEK) S.pos.x = clamp(S.pos.x, xMin(), xMax());
    }
    airStep();
    yarnStep();
    objectStep();
    S.shadowY = surfaceBelow(S.pos.x, S.pos.y + 0.001, 0.0).x;
    animate();

    fragColor = slice(px.x);
}
