// Murmuration — Buffer A: birds and globals.
// @channels self, bufferB
//
// Record layout: murmuration_common.frag. Stepping: simStep(). Every texel of a bird's record runs the same update and keeps its
// own part, except the neighbour list, which only texel 2 refines.
//
// Flight follows the topological model of Hildenbrandt, Carere & Hemelrijk
// (2010, "StarDisplay"): each bird steers by its 7 nearest flying
// neighbours in 3D (separation, cohesion, alignment), banks into its turns,
// holds a cruise speed and turns back toward a wandering roost point when
// it strays. Deviation: a weak spring toward the whole flock's centroid,
// without which topological cohesion breaks a long flock into separate
// balls. Neighbour lists refine from the bird's own list, the list of one
// of its neighbours, the nearest birds of Buffer B and a random bird.
// Alarm is an excitable wave: a bird whose neighbour is excited becomes
// excited ALARM_LAG of a cycle later, swerves away from the threat and
// banks hard, then stays refractory for the rest of the cycle.
//
// iChannel0 this buffer, iChannel1 Buffer B (previous substep).

const float FAST_LO = 1.1;    // cursor speed (units/s) where it starts to frighten
const float FAST_HI = 2.2;    // and where it frightens fully
const float CURSOR_R = 0.11;  // reach of a fast cursor
const float FALCON_R = 0.17;  // reach of a stooping falcon
const float RSEP_DAY = 0.021;  // separation radius, loose day flock
const float RSEP_SHOW = 0.009; // and sunset display
const float COH_DAY = 1.6;    // cohesion gain (1/s^2)
const float COH_SHOW = 1.5;
const float ALI_DAY = 1.6;    // alignment gain (1/s)
const float ALI_SHOW = 3.0;
const float SEP_GAIN = 1.7;   // separation acceleration at contact (units/s^2)
const float ROOST_FREE = 0.12; // horizontal distance from the roost point flown freely
const float ROOST_TURN = 0.35; // turning acceleration back toward it (units/s^2)
const float ROOST_PULL_Y = 0.1; // vertical spring
const float LEVEL = 0.02;      // damping of climb and descent (1/s)
const float GATHER_DAY = 0.1;  // spring toward the flock centroid (1/s^2)
const float GATHER_SHOW = 0.15;
const float NOISE_DAY = 0.066; // random acceleration (units/s^1.5)
const float NOISE_SHOW = 0.036;

vec4 ld(int x, int y) { return texelFetch(iChannel0, ivec2(x, y), 0); }
vec4 birdS(int i, int k) { return texelFetch(iChannel0, birdTexel(i, k), 0); }

uint gSeed;
float rnd(uint k) { return hashf(gSeed ^ (k * 0x632BE5ABu + 0x9E3779B9u)); }

// ------------------------------------------------------------- neighbours

int nId[8];
float nD[8];
vec4 nS[8];
vec3 gP;
int gSelf;
int gN;
int gLander;   // a landing bird met among the candidates, or -1

void consider(int id)
{
    if (id < 0 || id >= gN || id == gSelf) return;
    for (int k = 0; k < 8; k++)
        if (nId[k] == id) return;
    vec4 q = birdS(id, 0);
    int m = modeOf(q.w);
    if (m == M_LAND) gLander = id;
    if (m != M_FLY && m != M_LEAVE) return;
    float d = distance(q.xyz, gP);
    if (d >= nD[7]) return;
    int k = 7;
    for (int j = 7; j > 0; j--) {
        if (nD[j - 1] <= d) break;
        nD[j] = nD[j - 1];
        nId[j] = nId[j - 1];
        nS[j] = nS[j - 1];
        k = j - 1;
    }
    nD[k] = d;
    nId[k] = id;
    nS[k] = q;
}

void considerPacked(vec4 v)
{
    for (int c = 0; c < 4; c++) {
        float a = floor(v[c] / 4096.0);
        float b = v[c] - a * 4096.0;
        consider(int(a + 0.5) - 1);
        consider(int(b + 0.5) - 1);
    }
}

void considerCell(vec2 p)
{
    ivec2 hi = ivec2(iResolution.xy) - 1;
    ivec2 c = clamp(ivec2(p * unitPx()), ivec2(0), hi);
    ivec4 ids = ivec4(texelFetch(iChannel1, c, 0) + 0.5) - 1;
    consider(ids.x);
    consider(ids.y);
    consider(ids.z);
    consider(ids.w);
}

vec4 packIds()
{
    vec4 r;
    for (int c = 0; c < 4; c++) r[c] = float(nId[2 * c] + 1) * 4096.0 + float(nId[2 * c + 1] + 1);
    return r;
}

// ------------------------------------------------------------- perches

// Window whose top edge has left end and height lt, preferring index hint.
int findWindow(vec2 lt, int hint)
{
    float eps = 1.6 / unitPx();
    if (hint < iWindowCount && hint < 16 && windowValid(hint)) {
        vec4 w = windowTop(hint);
        if (abs(w.x - lt.x) < eps && abs(w.y - lt.y) < eps) return hint;
    }
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!windowValid(i)) continue;
        vec4 w = windowTop(i);
        if (abs(w.x - lt.x) < eps && abs(w.y - lt.y) < eps) return i;
    }
    return -1;
}

bool perchable(int w, vec2 ws)
{
    if (w < 0 || w >= iWindowCount || w >= 16 || !windowValid(w)) return false;
    vec4 t = windowTop(w);
    float pl = perchLen();
    return t.z > 3.0 * pl && t.y < ws.y - 1.3 * pl && t.y > 0.14 * ws.y;
}

// Nearest perched birds on the edge at height top around x, other than
// self: distance to the left (x) and to the right (y), 1e9 when none.
vec2 wireGaps(float x, float top, int self)
{
    float pl = perchLen();
    vec2 gaps = vec2(1e9);
    ivec2 hi = ivec2(iResolution.xy) - 1;
    for (int k = 0; k < 4; k++) {
        float ox = (k < 2 ? -1.0 : 1.0) * (k == 0 || k == 3 ? 1.35 : 0.55) * pl;
        ivec2 c = clamp(ivec2(vec2(x + ox, top + 0.45 * pl) * unitPx()), ivec2(0), hi);
        ivec4 ids = ivec4(texelFetch(iChannel1, c, 0) + 0.5) - 1;
        for (int j = 0; j < 4; j++) {
            int id = ids[j];
            if (id < 0 || id >= gN || id == self) continue;
            vec4 q = birdS(id, 0);
            if (modeOf(q.w) != M_PERCH || abs(q.y - top) > 0.8 * pl) continue;
            float dx = q.x - x;
            if (dx < 0.0 || (dx == 0.0 && id < self)) gaps.x = min(gaps.x, -dx);
            else gaps.y = min(gaps.y, dx);
        }
    }
    return gaps;
}

// A perch spot on window w at offset rx from its left edge: on the edge,
// not covered by a window and clear of perched birds.
bool spotFree(int w, float rx, int self)
{
    vec4 t = windowTop(w);
    float pl = perchLen();
    if (rx < 0.6 * pl || rx > t.z - 0.6 * pl) return false;
    vec2 p = vec2(t.x + rx, t.y);
    if (insideAnyWindow(p + vec2(0.0, 0.45 * pl)) || insideAnyWindow(p + vec2(0.0, 0.9 * pl))) return false;
    vec2 g = wireGaps(p.x, p.y, self);
    return min(g.x, g.y) > 0.85 * pl;
}

// ------------------------------------------------------------- update

void updateBird(int i, int texel, out vec4 o0, out vec4 o1, out vec4 o2, out vec4 o3, out vec4 o4)
{
    vec4 s0 = birdS(i, 0);
    vec4 s1 = birdS(i, 1);
    vec4 s2 = birdS(i, 2);
    vec4 s3 = birdS(i, 3);
    vec4 s4 = birdS(i, 4);
    vec4 g0 = ld(0, 0);
    vec4 st = ld(1, 0);
    vec4 cur = ld(2, 0);
    vec2 ws = worldSize();
    float pl = perchLen();
    float dt = simDt();
    vec4 dc = dayCycle();
    vec3 R = roostTarget(ws, dc, iDate.w);
    bool wanted = hashf(uint(i) * 0x2C1B3C6Du + 17u) < dc.x;
    float show = dc.y;
    uint ui = uint(i);

    // ---- first step: the flock in a ribbon, some birds already perched
    if (g0.x < 0.5) {
        int rows = 24;
        float nu = ceil(float(gN) / float(rows));
        float u = (float(i / rows) + 0.5) / nu;
        float v = (float(i % rows) + 0.5) / float(rows) * 2.0 - 1.0;
        float L = min(0.85 * ws.x, 1.15);
        vec3 c = R + vec3((u - 0.5) * L, 0.11 * sin(u * 5.0 + 0.5) - 0.06 * cos(u * 3.1), 0.3 * cos(u * 4.0));
        vec3 tg = normalize(vec3(L, 0.55 * cos(u * 5.0 + 0.5) + 0.19 * sin(u * 3.1), -1.2 * sin(u * 4.0)));
        float tw = u * 3.5;
        vec3 bn = normalize(vec3(0.0, cos(tw), sin(tw)));
        float wd = 0.03 + 0.08 * sin(PI * u);
        vec3 jit = vec3(hashf(ui * 3u + 1u), hashf(ui * 3u + 2u), hashf(ui * 3u + 3u)) - 0.5;
        vec3 p = c + bn * v * wd + jit * 0.008;
        vec3 vel = tg * 0.16 + jit * 0.03;
        int mode = wanted ? M_FLY : M_HIDDEN;
        if (!wanted) p = vec3(-1.0, -1.0, Z_FLOCK);
        o3 = vec4(0.0, 1.0 + 3.0 * hashf(ui + 5u), 0.0, 1.0);
        o4 = vec4(0.0);

        // Perched from the start: the last 16 * 16 ids, 16 per window.
        int r = gN - 1 - i;
        int w = r / 16;
        int k = r % 16;
        if (PERCHING && w < iWindowCount && w < 16 && perchable(w, ws)) {
            vec4 t = windowTop(w);
            int slots = clamp(int(t.z / (2.6 * pl)), 0, 16);
            if (k < slots) {
                float rx = (float(k) + 0.5 + 0.3 * (hashf(ui + 9u) - 0.5)) * t.z / float(slots);
                vec2 fp = vec2(t.x + rx, t.y);
                if (!insideAnyWindow(fp + vec2(0.0, 0.45 * pl))) {
                    mode = M_PERCH;
                    p = vec3(fp, 0.0);
                    vel = vec3(0.0);
                    o3.w = hashf(ui + 11u) < 0.75 ? 1.0 : -1.0;
                    o4 = vec4(t.x, t.y, rx, 0.0);
                }
            }
        }
        o0 = vec4(p, packCode(mode, mode == M_PERCH ? w : 0, 0.0));
        o1 = vec4(vel, hashf(ui + 7u));
        int nb[8];
        nb[0] = i - 1; nb[1] = i + 1; nb[2] = i - rows; nb[3] = i + rows;
        nb[4] = i - rows - 1; nb[5] = i + rows + 1; nb[6] = i - 2; nb[7] = i + 2;
        if (i % rows == 0) { nb[0] = i + 3; nb[4] = i + rows + 2; nb[6] = i - rows + 1; }
        if (i % rows == rows - 1) { nb[1] = i - 3; nb[5] = i - rows - 2; nb[7] = i + rows - 1; }
        for (int j = 0; j < 8; j++) nId[j] = (nb[j] >= 0 && nb[j] < gN) ? nb[j] : -1;
        o2 = packIds();
        return;
    }

    int mode = modeOf(s0.w);
    int win = winOf(s0.w);
    float phi = alarmOf(s0.w);
    vec3 p = s0.xyz;
    vec3 v = s1.xyz;
    float phase = s1.w;
    float tMode = min(s3.x + dt, 1000.0);
    float timer = s3.y;
    float bank = s3.z;
    float face = s3.w == 0.0 ? 1.0 : s3.w;
    vec4 o4n = s4;

    // ---- threats
    vec2 mp = cur.xy;
    float cursorFear = cur.w;
    bool stoop = st.z >= 0.0 && st.z < STOOP_TIME;
    vec2 fp = stoop ? stoopPos(st.z, st.xy, ld(4, 0).xy, st.w, ws) : vec2(-9.0);
    vec2 threat = stoop ? fp : mp;

    // ---- perched
    if (mode == M_PERCH) {
        vec2 lt = s4.xy;
        int w = findWindow(lt, win);
        bool burst = w < 0;
        if (!burst) {
            win = w;
            vec4 t = windowTop(w);
            if (s4.z > t.z - 0.3 * pl) burst = true;
        }
        vec2 body = p.xy + vec2(0.0, 0.45 * pl);
        if (insideAnyWindow(body)) burst = true;
        if (cursorFear > 0.3 && distance(mp, body) < 0.08) burst = true;
        if (stoop && distance(fp, body) < 0.22) burst = true;
        if (!PERCHING) burst = true;
        bool asleep = dc.z > 0.5;

        if (!burst) {
            float rx = p.x - lt.x;
            float target = s4.z;
            int act = int(abs(face) + 0.5) - 1;
            float dir = sign(face);
            timer -= dt;
            bool hopping = abs(target - rx) > 1e-5;
            if (hopping) {
                float spd = act == ACT_SWAP ? 0.16 : 0.11;
                float step = min(abs(target - rx), spd * dt);
                rx += sign(target - rx) * step;
                float len = max(s4.w, 1e-4);
                float f = clamp(1.0 - abs(target - rx) / len, 0.0, 1.0);
                float arc = (act == ACT_SWAP ? 1.15 : 0.32) * pl;
                p.y = lt.y + arc * 4.0 * f * (1.0 - f);
                if (abs(target - rx) <= 1e-5) {
                    rx = target;
                    p.y = lt.y;
                    act = ACT_IDLE;
                    timer = 0.6 + 1.5 * rnd(1u);
                }
            } else {
                p.y = lt.y;
                vec2 gap = wireGaps(p.x, lt.y, i);
                float crowd = min(gap.x, gap.y);
                if (crowd < 0.62 * pl && !asleep) {
                    // Too close: shuffle away from the nearer neighbour.
                    float away = gap.x < gap.y ? 1.0 : -1.0;
                    float tx = clamp(rx + away * (0.8 * pl - crowd), 0.5 * pl, windowTop(win).z - 0.5 * pl);
                    if (abs(tx - rx) > 0.02 * pl) {
                        target = tx;
                        o4n.w = abs(tx - rx);
                        act = ACT_HOP;
                        dir = away;
                    }
                } else if (timer <= 0.0 && !asleep) {
                    float r = rnd(2u);
                    float pTake = dawnTime() ? 0.45 : mix(0.03, 0.035, show);
                    if (r < pTake) {
                        burst = true;
                    } else {
                        float r2 = rnd(3u);
                        float width = windowTop(win).z;
                        if (r2 < 0.28) {
                            act = ACT_LOOK;
                            timer = 0.8 + 1.8 * rnd(4u);
                            o4n.w = timer;
                        } else if (r2 < 0.42) {
                            act = ACT_IDLE;
                            dir = -dir;
                            timer = 1.0 + 2.5 * rnd(4u);
                        } else if (r2 < 0.60) {
                            act = ACT_PREEN;
                            timer = 1.5 + 3.0 * rnd(4u);
                            o4n.w = timer;
                        } else if (r2 < 0.82) {
                            float side = rnd(5u) < 0.5 ? -1.0 : 1.0;
                            float room = side < 0.0 ? gap.x : gap.y;
                            float hop = min((0.35 + 0.5 * rnd(6u)) * pl, room - 0.75 * pl);
                            float tx = clamp(rx + side * hop, 0.5 * pl, width - 0.5 * pl);
                            if (hop > 0.1 * pl && abs(tx - rx) > 0.05 * pl) {
                                target = tx;
                                o4n.w = abs(tx - rx);
                                act = ACT_HOP;
                                dir = side;
                            }
                            timer = 0.5 + rnd(7u);
                        } else {
                            // Swap: flutter over the nearer neighbour.
                            float side = gap.x < gap.y ? -1.0 : 1.0;
                            float gn = min(gap.x, gap.y);
                            float tx = rx + side * (gn + 0.8 * pl);
                            if (gn < 1.4 * pl && tx > 0.5 * pl && tx < width - 0.5 * pl) {
                                target = tx;
                                o4n.w = abs(tx - rx);
                                act = ACT_SWAP;
                                dir = side;
                            }
                            timer = 0.5 + rnd(7u);
                        }
                        if (act == ACT_IDLE && timer <= 0.0) timer = 1.0 + 3.0 * rnd(8u);
                    }
                } else if (timer <= 0.0) {
                    act = ACT_IDLE;
                    timer = 2.0;
                }
            }
            if (!burst) {
                p.x = lt.x + rx;
                o4n.z = target;
                face = dir * (1.0 + float(act));
                if (phi > 0.0) phi = phi + dt / ALARM_TIME >= 1.0 ? 0.0 : phi + dt / ALARM_TIME;
                o0 = vec4(p, packCode(M_PERCH, win, phi));
                o1 = vec4(0.0, 0.0, 0.0, phase);
                o2 = s2;
                o3 = vec4(tMode, timer, 0.0, face);
                o4 = o4n;
                return;
            }
        }
        // Burst into flight.
        mode = wanted ? M_FLY : M_LEAVE;
        p.y = s4.y;
        v = vec3((rnd(10u) - 0.5) * 0.22 + sign(face) * 0.05, 0.2 + 0.14 * rnd(11u), 0.35 + 0.35 * rnd(12u));
        phi = 0.001;
        tMode = 0.0;
        timer = 0.0;
        phase = rnd(13u);
        face = sign(face);
        if (mode == M_LEAVE) {
            float side = rnd(14u) < 0.5 ? -0.25 : ws.x + 0.25;
            o4n = vec4(side, ws.y * (0.5 + 0.4 * rnd(15u)), 0.0, 0.0);
        }
        o0 = vec4(p, packCode(mode, 0, phi));
        o1 = vec4(v, phase);
        o2 = vec4(0.0);
        o3 = vec4(0.0, 0.0, 0.0, face);
        o4 = o4n;
        return;
    }

    // ---- hidden: roosting in the reeds or away
    if (mode == M_HIDDEN) {
        o2 = vec4(0.0);
        o3 = vec4(tMode, 0.0, 0.0, face);
        o4 = vec4(0.0);
        if (wanted && rnd(20u) < 0.5 * dt) {
            if (dawnTime()) {
                p = vec3(ws.x * (0.08 + 0.84 * rnd(21u)), REED_TOP * ws.y * 0.5, Z_FLOCK + (rnd(22u) - 0.5) * 0.8);
                v = vec3((rnd(23u) - 0.5) * 0.12, 0.17 + 0.06 * rnd(24u), 0.0);
            } else {
                // Small groups arrive together from one side.
                uint grp = uint(i % 29) * 7919u + uint(iDate.w / 12.0) * 104729u;
                float h = hashf(grp);
                float h2 = hashf(grp + 1u);
                vec2 e = h < 0.4 ? vec2(-0.06, ws.y * (0.45 + 0.45 * h2))
                       : (h < 0.8 ? vec2(ws.x + 0.06, ws.y * (0.45 + 0.45 * h2))
                                  : vec2(ws.x * (0.1 + 0.8 * h2), ws.y + 0.06));
                p = vec3(e + (vec2(rnd(25u), rnd(26u)) - 0.5) * 0.05, Z_FLOCK + (hashf(grp + 2u) - 0.5) * 0.8);
                v = vec3(normalize(R.xy - e) * 0.17, 0.0);
            }
            o0 = vec4(p, packCode(M_FLY, 0, 0.0));
            o1 = vec4(v, rnd(27u));
            o3 = vec4(0.0, 0.0, 0.0, face);
            return;
        }
        o0 = vec4(-1.0, -1.0, Z_FLOCK, packCode(M_HIDDEN, 0, 0.0));
        o1 = vec4(0.0, 0.0, 0.0, phase);
        return;
    }

    // ---- flying: FLY, LAND, LEAVE
    gP = p;
    for (int k = 0; k < 8; k++) {
        nId[k] = -1;
        nD[k] = 1e9;
        nS[k] = vec4(0.0);
    }
    considerPacked(s2);
    float sp0 = length(v);
    if (texel == 2) {
        // The list texel refines the list; the others steer by last step's.
        int nb = nId[int(hashu(gSeed) % 7u)];
        if (nb >= 0) considerPacked(birdS(nb, 2));
        considerCell(p.xy);
        if (sp0 > 1e-4) considerCell(p.xy + v.xy / sp0 * 0.012);
        consider(int(hashu(gSeed + 1u) % uint(gN)));
        o0 = s0;
        o1 = s1;
        o2 = packIds();
        o3 = s3;
        o4 = s4;
        return;
    }

    vec3 sep = vec3(0.0);
    vec3 cen = vec3(0.0);
    vec3 avg = vec3(0.0);
    float cnt = 0.0;
    bool passOn = false;
    float rsep = mix(RSEP_DAY, RSEP_SHOW, show) / sqrt(COHESION);
    for (int k = 0; k < 7; k++) {
        if (nId[k] < 0) break;
        vec3 q = nS[k].xyz;
        float d = nD[k];
        if (d < rsep) sep += (p - q) / max(d, 1e-4) * (1.0 - d / rsep);
        cen += q;
        avg += birdS(nId[k], 1).xyz;
        cnt += 1.0;
        float pn = alarmOf(nS[k].w);
        if (pn > ALARM_LAG && pn < ALARM_EXC) passOn = true;
    }

    float v0 = mix(0.135, 0.175, show);
    vec3 acc = vec3(0.0);
    vec3 align = vec3(0.0);
    if (cnt > 0.0) {
        cen /= cnt;
        avg /= cnt;
        acc += SEP_GAIN * sep;
        acc += mix(COH_DAY, COH_SHOW, show) * COHESION * (cen - p);
        float al = length(acc);
        if (al > 4.0) acc *= 4.0 / al;
        // Alignment relaxes exactly, stable at any step length.
        align = (avg - v) * (1.0 - exp(-mix(ALI_DAY, ALI_SHOW, show) * dt)) / dt;
    }

    // Threats: a fast cursor and the falcon open a hole and start the alarm.
    bool scared = false;
    if (cursorFear > 0.05) {
        float d = distance(p.xy, mp);
        float r = CURSOR_R * (0.7 + 0.5 * cursorFear);
        if (d < r) {
            acc.xy += normalize(p.xy - mp + 1e-5) * 2.6 * cursorFear * (1.0 - d / r);
            scared = cursorFear > 0.35;
        }
    }
    if (stoop) {
        float d = distance(p.xy, fp);
        if (d < FALCON_R) {
            acc.xy += normalize(p.xy - fp + 1e-5) * 5.5 * (1.0 - d / FALCON_R);
            scared = true;
        }
    }
    if (phi > 0.0) {
        phi += dt / ALARM_TIME;
        if (phi >= 1.0) phi = 0.0;
    } else if (scared || (passOn && mode == M_FLY)) {
        phi = 0.001;
    }
    float exc = phi > 0.0 && phi < ALARM_EXC ? sin(PI * phi / ALARM_EXC) : 0.0;
    float sgn = hashf(ui + 31u) < 0.5 ? -1.0 : 1.0;

    if (mode == M_FLY) {
        if (exc > 0.0) {
            acc.xy += normalize(p.xy - threat + 1e-5) * 0.9 * exc;
            acc += v / max(sp0, 1e-4) * 0.4 * exc;
        }
        vec4 fc = ld(3, 0);
        if (fc.w > 0.0) acc += mix(GATHER_DAY, GATHER_SHOW, show) * (fc.xyz - p);
        // Roost: beyond ROOST_FREE horizontally, turn toward the roost point
        // without changing speed; a weak spring holds the altitude.
        vec3 dR = R - p;
        float dh = length(dR.xz);
        vec3 want = vec3(dR.x, 0.0, dR.z) / max(dh, 1e-4);
        vec3 fw = v / max(sp0, 1e-4);
        float pull = smoothstep(ROOST_FREE, ROOST_FREE + 0.3, dh);
        acc += ROOST_TURN * pull * (want - fw * dot(want, fw) + 0.2 * want);
        acc.y += ROOST_PULL_Y * dR.y;
        acc.y -= LEVEL * v.y;
        acc += 1.5 * (v0 - sp0) * v / max(sp0, 1e-4);
        vec3 nz = vec3(rnd(40u), rnd(41u), rnd(42u)) - 0.5;
        acc += nz * mix(NOISE_DAY, NOISE_SHOW, show) / sqrt(max(dt, 1e-4));
        // Soft walls: screen sides, above the reeds, below the top, depth band.
        float floorY = ws.y * 0.24;
        acc.x += 1.4 * pow(clamp((0.14 - p.x) / 0.14, 0.0, 1.0), 2.0);
        acc.x -= 1.4 * pow(clamp((p.x - ws.x + 0.14) / 0.14, 0.0, 1.0), 2.0);
        acc.y += 1.6 * pow(clamp((floorY + 0.1 - p.y) / 0.1, 0.0, 1.0), 2.0);
        acc.y -= 1.6 * pow(clamp((p.y - ws.y + 0.1) / 0.1, 0.0, 1.0), 2.0);
        acc.z += 1.0 * clamp(Z_FLOCK - 1.5 - p.z, 0.0, 2.0) - 1.0 * clamp(p.z - Z_FLOCK - 1.5, 0.0, 2.0);

        v += (acc + align) * dt;
        float sp = length(v);
        float vmax = v0 * (2.2 + 1.2 * exc);
        if (sp > vmax) v *= vmax / sp;
        if (sp < 0.45 * v0) v *= 0.45 * v0 / max(sp, 1e-5);
        p += v * dt;

        // Leave when the share of the flock out shrinks.
        if (!wanted && rnd(50u) < 0.35 * dt) {
            mode = M_LEAVE;
            tMode = 0.0;
            if (roostingTime()) {
                o4n = vec4(clamp(R.x + (rnd(51u) - 0.5) * 0.7 * ws.x, 0.05, ws.x - 0.05), -0.04, 1.0, 0.0);
            } else {
                float h = hashf(uint(i % 23) + 900u);
                o4n = h < 0.45 ? vec4(-0.3, ws.y * (0.5 + 0.4 * rnd(52u)), 0.0, 0.0)
                    : (h < 0.9 ? vec4(ws.x + 0.3, ws.y * (0.5 + 0.4 * rnd(52u)), 0.0, 0.0)
                               : vec4(ws.x * rnd(52u), ws.y + 0.3, 0.0, 0.0));
            }
        }

        // Perch: a few birds peel off to a window top, more when a neighbour does.
        bool tryLand = false;
        int lw = -1;
        float lrx = 0.0;
        bool dusk = roostingTime() && mode == M_LEAVE && rnd(53u) < 0.08;
        if (PERCHING && dc.z < 0.5 && iWindowCount > 0 && mode == M_FLY && tMode > 3.0) {
            float pBase = 0.25 * float(iWindowCount) / max(float(gN) * dc.x, 40.0);
            if (gLander >= 0 && rnd(54u) < 1.1 * dt) {
                vec4 l4 = birdS(gLander, 4);
                lw = findWindow(l4.xy, winOf(birdS(gLander, 0).w));
                lrx = l4.z + (rnd(55u) < 0.5 ? -1.0 : 1.0) * (1.0 + 2.0 * rnd(56u)) * pl;
                tryLand = true;
            } else if (rnd(57u) < pBase * dt) {
                lw = int(hashu(gSeed + 58u) % uint(iWindowCount));
                tryLand = true;
            }
        }
        if (PERCHING && dusk && iWindowCount > 0) {
            lw = int(hashu(gSeed + 58u) % uint(iWindowCount));
            tryLand = true;
        }
        if (tryLand && perchable(lw, ws)) {
            vec4 t = windowTop(lw);
            if (gLander < 0 || dusk) lrx = (0.08 + 0.84 * rnd(59u)) * t.z;
            if (spotFree(lw, lrx, i)) {
                mode = M_LAND;
                win = lw;
                tMode = 0.0;
                o4n = vec4(t.x, t.y, lrx, 0.0);
            }
        }
    } else if (mode == M_LAND) {
        int w = findWindow(s4.xy, win);
        if (w < 0 || tMode > 10.0 || !PERCHING) {
            mode = M_FLY;
            tMode = 0.0;
        } else {
            win = w;
            vec2 P = vec2(s4.x + s4.z, s4.y);
            vec2 tgt = P + vec2(0.0, 0.03 * clamp(p.z, 0.0, 1.5) + 0.004);
            vec2 dxy = tgt - p.xy;
            float dist = length(dxy);
            float spd = min(0.34, 0.025 + dist * 2.2);
            v.xy += (dxy / max(dist, 1e-5) * spd - v.xy) * (1.0 - exp(-dt * 5.0));
            float zt = Z_FLOCK * smoothstep(0.02, 0.55, dist);
            v.z += ((zt - p.z) * 2.2 - v.z) * (1.0 - exp(-dt * 5.0));
            if (exc > 0.0 || (stoop && distance(p.xy, fp) < FALCON_R)) {
                mode = M_FLY;
                tMode = 0.0;
            }
            p += v * dt;
            p.z = max(p.z, 0.0);
            if (dist < 0.05 && p.z < 0.6 && !spotFree(w, s4.z, i)) {
                // Taken: try the next spot along, else give up.
                float nx = s4.z + (hashf(ui + uint(tMode * 10.0)) < 0.5 ? -1.0 : 1.0) * 0.95 * pl;
                if (spotFree(w, nx, i)) o4n.z = nx;
                else {
                    mode = M_FLY;
                    tMode = 0.0;
                }
            } else if (distance(p.xy, P) < 0.006 && p.z < 0.06) {
                mode = M_PERCH;
                p = vec3(P, 0.0);
                face = abs(v.x) > 0.01 ? sign(v.x) : (rnd(60u) < 0.5 ? -1.0 : 1.0);
                o3 = vec4(0.0, 0.8 + 1.5 * rnd(61u), 0.0, face);
                o4n.w = 0.0;
                o0 = vec4(p, packCode(M_PERCH, win, phi));
                o1 = vec4(0.0, 0.0, 0.0, phase);
                o2 = packIds();
                o4 = o4n;
                return;
            }
        }
    } else {
        // M_LEAVE: stream toward the exit, loosely together.
        vec2 ex = s4.xy;
        vec2 dxy = ex - p.xy;
        float dist = length(dxy);
        vec2 vd = dxy / max(dist, 1e-5) * v0 * (s4.z > 0.5 ? 1.25 : 1.15);
        acc = 0.45 * (acc + align);
        acc.xy += (vd - v.xy) * 1.8;
        acc.z += 0.3 * (Z_FLOCK - p.z) - 0.5 * v.z;
        if (exc > 0.0) acc.xy += normalize(p.xy - threat + 1e-5) * 1.3 * exc;
        v += acc * dt;
        float sp = length(v);
        if (sp > 2.5 * v0) v *= 2.5 * v0 / sp;
        p += v * dt;
        bool gone = p.x < -0.12 || p.x > ws.x + 0.12 || p.y > ws.y + 0.12;
        if (s4.z > 0.5) gone = p.y < REED_TOP * ws.y * 0.45;
        if (gone) {
            o0 = vec4(-1.0, -1.0, Z_FLOCK, packCode(M_HIDDEN, 0, 0.0));
            o1 = vec4(0.0, 0.0, 0.0, phase);
            o2 = vec4(0.0);
            o3 = vec4(0.0, 0.0, 0.0, face);
            o4 = vec4(0.0);
            return;
        }
        if (wanted && s4.z < 0.5 && tMode > 1.0) {
            mode = M_FLY;
            tMode = 0.0;
        }
    }

    // Bank into the turn; excited birds roll hard.
    float sp = max(length(v), 1e-4);
    vec3 f = v / sp;
    vec3 up0 = vec3(0.0, 1.0, 0.0) - f * f.y;
    up0 = dot(up0, up0) < 1e-4 ? vec3(0.0, 0.0, 1.0) : normalize(up0);
    vec3 side0 = cross(f, up0);
    float lat = mode == M_LAND ? 0.0 : dot(acc, side0);
    float bt = clamp(atan(lat / 0.5), -1.1, 1.1) + 1.25 * exc * sgn;
    bank += (bt - bank) * (1.0 - exp(-dt * 7.0));

    // Wing beats: 6-8.5 Hz, faster while climbing or alarmed.
    float hz = 6.0 + 2.5 * hashf(ui + 33u) + 3.0 * exc + 2.0 * clamp(v.y / sp, 0.0, 1.0);
    phase = fract(phase + hz * dt);

    o0 = vec4(p, packCode(mode, mode == M_LAND ? win : 0, phi));
    o1 = vec4(v, phase);
    o2 = packIds();
    o3 = vec4(tMode, timer, bank, sign(face));
    o4 = o4n;
}

// ------------------------------------------------------------- globals

vec4 globalTexel(int x)
{
    vec4 g0 = ld(0, 0);
    vec4 st = ld(1, 0);
    vec4 cur = ld(2, 0);
    vec2 ws = worldSize();
    float U = unitPx();
    float dt = simDt();
    bool init = g0.x < 0.5;
    bool stoop = !init && st.z >= 0.0 && st.z < STOOP_TIME;
    vec4 dc = dayCycle();
    bool wild = WILD_FALCON && !stoop && g0.w <= 0.0 && dc.y > 0.6 && !init;

    if (x == 0) {
        if (init) return vec4(1.0, 0.0, 0.0, 35.0 + 30.0 * hashf(uint(iDate.w)));
        float clk = mod(g0.y + dt, CLOCK_WRAP);
        float held = iMouse.z > 0.0 ? 1.0 : 0.0;
        float next = g0.w - (dc.y > 0.6 ? dt : 0.0);
        if (wild) next = 50.0 + 70.0 * hashf(uint(g0.y * 1000.0));
        return vec4(1.0, clk, held, max(next, -1.0));
    }
    // Stoop: a click on open sky, or a wild falcon at the display. The
    // falcon dives through the aim point and swoops on the flock when it is
    // within reach.
    vec4 fc = ld(3, 0);
    vec2 m = iMouse.xy / U;
    bool click = !init && !stoop && iMouse.z > 0.0 && g0.z < 0.5 && iFrame > 2 && !insideAnyWindow(m) && m.y > 0.065 * ws.y;
    vec2 aim = m;
    vec2 prey = m + vec2(m.x < 0.5 * ws.x ? 0.45 : -0.45, -0.08);
    if (fc.w > 0.0 && distance(fc.xy, m) < 1.1) prey = fc.xy;
    if (wild && !click) {
        float side = hashf(uint(g0.y * 977.0)) < 0.5 ? -1.0 : 1.0;
        prey = fc.w > 0.0 ? fc.xy : roostTarget(ws, dc, iDate.w).xy;
        aim = prey + vec2(-side * 0.32, 0.1 + 0.1 * hashf(uint(g0.y * 613.0)));
    }
    float dir = prey.x >= aim.x ? 1.0 : -1.0;
    if (x == 1) {
        if (init) return vec4(0.0, 0.0, -1.0, 1.0);
        if (stoop) {
            st.z += dt;
            if (st.z >= STOOP_TIME) st.z = -1.0;
            return st;
        }
        if (click || wild) return vec4(aim, 0.0, dir);
        return vec4(st.xy, -1.0, st.w);
    }
    if (x == 4) {
        if (!init && !stoop && (click || wild)) return vec4(prey, 0.0, 0.0);
        return init ? vec4(0.0) : ld(4, 0);
    }
    if (x == 3) {
        // Flock centroid from 96 random birds, smoothed over about 0.4 s.
        int n = birdCount(iResolution.y);
        vec3 sum = vec3(0.0);
        float cnt = 0.0;
        uint h = hashu(uint(iFrame) * 2654435761u + 77u);
        for (int k = 0; k < 96; k++) {
            vec4 b = birdS(int(hashu(h + uint(k) * 0x9E3779B9u) % uint(n)), 0);
            if (modeOf(b.w) != M_FLY) continue;
            sum += b.xyz;
            cnt += 1.0;
        }
        vec4 c = init ? vec4(0.0) : ld(3, 0);
        if (cnt < 1.0) return vec4(c.xyz, 0.0);
        vec3 m = sum / cnt;
        c.xyz = c.w > 0.0 ? mix(c.xyz, m, 1.0 - exp(-dt / 0.4)) : m;
        return vec4(c.xyz, cnt / 96.0);
    }
    if (x == 2) {
        vec2 m = iMouse.xy / U;
        vec2 mp = iMousePrev / U;
        float fdt = max(iTimeDelta * float(iSubsteps), 1e-4);
        float spd = iFrame > 3 && !insideAnyWindow(m) ? min(length(m - mp) / fdt, 20.0) : 0.0;
        float sm = init ? 0.0 : cur.z;
        sm = mix(sm, spd, 1.0 - exp(-dt * 25.0));
        float fear = smoothstep(FAST_LO, FAST_HI, sm);
        return vec4(m, sm, fear);
    }
    return vec4(0.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    int col = ic.x / REC;
    gN = birdCount(iResolution.y);
    int i = (ic.y - 1) * BIRD_COLS + col;
    // Texels outside the records stay at the zeros both ping-pong targets
    // are cleared to; skipping their writes saves the bandwidth.
    bool used = ic.y == 0 ? ic.x < 5 : (col < BIRD_COLS && i < gN);
    if (!used) discard;
    if (!simStep()) {
        fragColor = texelFetch(iChannel0, ic, 0);
        return;
    }
    if (ic.y == 0) {
        fragColor = globalTexel(ic.x);
        return;
    }
    gSelf = i;
    gLander = -1;
    gSeed = hashu(uint(i) * 0x9E3779B9u ^ hashu(uint(iFrame)));
    vec4 o0, o1, o2, o3, o4;
    int k = ic.x - col * REC;
    updateBird(i, k, o0, o1, o2, o3, o4);
    fragColor = k == 0 ? o0 : (k == 1 ? o1 : (k == 2 ? o2 : (k == 3 ? o3 : o4)));
}
