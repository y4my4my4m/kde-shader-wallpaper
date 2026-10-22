// Orbits — Buffer A: bodies, bursts, input and the aim preview.
// @channels self
//
// Layout in orbits_common.frag. Every texel of slot i runs the same update
// of body i from the previous step and keeps its own part, so they agree.
// Spawns and launches take slots from a scan of the previous step that
// every texel computes alike.
//
// A step: overlapping bodies merge into the heaviest of them, momentum
// kept; survivors take two kick-drift-kick (velocity Verlet) half steps in
// the field of the windows, interpolated across the frame, the star and the
// other bodies (their pull held over the step); a body touching a window or
// the star bursts. Bodies far off screen are dropped; above the cap the
// oldest fades out. A press on bare desktop starts aiming: a short click
// releases a moon on a circular orbit, a pull launches a body the opposite
// way (slingshot), and the preview row traces its path.

const float INIT_DELAY  = 0.25;  // s before the first bodies, so window rects have arrived
const int   AMBIENT_CAP = 14;    // live bodies above which nothing ambient spawns
const int   MOON_MIN    = 5;     // fewer moons than this and a new one condenses
const int   MOON_TRIES  = 8;
const int   SPARSE      = 7;     // fewer live bodies than this and spawns come faster
const float SPEED_MAX   = 3.0;   // H/s

struct Body {
    vec2 p;
    vec2 v;
    float gm;
    float age;
    float code;
    float state;
};

struct Event {
    int kind;      // -1 none, else B_*
    vec2 at;
    vec2 drift;
    float energy;
    float dir;
    float code;    // code of the body that burst
};

Body freeBody()
{
    Body o;
    o.p = FAR;
    o.v = vec2(0.0);
    o.gm = 0.0;
    o.age = 0.0;
    o.code = 0.0;
    o.state = 0.0;
    return o;
}

Body makeBody(vec2 p, vec2 v, float gm, int kind, int hue, bool fadeIn)
{
    Body o;
    o.p = p;
    o.v = v;
    o.gm = gm;
    o.age = 0.0;
    o.code = packCode(kind, hue, fadeIn);
    o.state = 1.0;
    return o;
}

Body loadBody(int i)
{
    vec4 a = texelFetch(iChannel0, ivec2(i, ROW_P), 0);
    vec4 b = texelFetch(iChannel0, ivec2(i, ROW_Q), 0);
    Body o;
    o.p = a.xy;
    o.v = a.zw;
    o.gm = b.x;
    o.age = b.y;
    o.code = b.z;
    o.state = b.w;
    return o;
}

// The k-th valid window, current rect in H units.
vec4 nthWindow(int k)
{
    int n = 0;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = winNow(i);
        if (!windowOk(r)) continue;
        if (n == k) return r;
        n++;
    }
    return vec4(0.0);
}

vec2 boxNormal(vec2 q, vec2 hs)
{
    vec2 s = vec2(q.x < 0.0 ? -1.0 : 1.0, q.y < 0.0 ? -1.0 : 1.0);
    vec2 d = abs(q) - hs;
    if (d.x > 0.0 || d.y > 0.0) return normalize(max(d, 0.0) * s);
    return d.x > d.y ? vec2(s.x, 0.0) : vec2(0.0, s.y);
}

bool outranks(float gmA, int a, float gmB, int b) { return gmA > gmB || (gmA == gmB && a < b); }

// ------------------------------------------------------------- spawning

// Field of the current windows and the star at p; lowers `clear` to the
// clearance (H) of a body of radius r from them.
vec2 fieldClear(vec2 p, float star, float r, inout float clear)
{
    vec2 a = vec2(0.0);
    if (star > 0.0) {
        a = starAccel(p, star);
        clear = min(clear, length(p - starPos()) - STAR_R * star - r);
    }
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 rc = winNow(i);
        if (!windowOk(rc)) continue;
        a += wellAccel(p, rc);
        clear = min(clear, sdBox(p - rc.xy - 0.5 * rc.zw, 0.5 * rc.zw) - r);
    }
    return a;
}

// Flight test of a body of radius r launched at (p, v) in the current field
// for up to 8 s: the seconds it survives before touching a window or the
// star or leaving the screen; a full flight scores 9 plus a bonus for
// clearance and minus one for time spent off screen. -1 for a bad start.
float orbitScore(vec2 p, vec2 v, float r, float star)
{
    float A = aspectNow();
    if (p.x < 0.03 || p.x > A - 0.03 || p.y < PANEL + 0.02 || p.y > 0.97) return -1.0;
    if (windowHit(p, 1.0, r + 0.02) >= 0) return -1.0;
    const float h = 0.05;
    const int N = 160;
    float clear = 1.0;
    float off = 0.0;
    vec2 a = fieldClear(p, star, r, clear);
    for (int s = 0; s < N; s++) {
        v += a * (0.5 * h);
        p += v * h;
        a = fieldClear(p, star, r, clear);
        v += a * (0.5 * h);
        float o = max(max(-p.x, p.x - A), max(PANEL - p.y, p.y - 1.0));
        if (o > 0.0) off += 1.0;
        if (clear < 0.0 || o > 0.8 * CULL) return float(s) * h;
    }
    return float(N) * h + 1.0 + 5.0 * min(clear, 0.1) - off / float(N);
}

// A moon on a near-circular counter-clockwise orbit around a window or the
// star, the best of MOON_TRIES candidates by orbitScore, none when the best
// survives less than 3 s. The first half of the candidates circle host
// `pref` when it is a valid host index.
Body spawnMoon(uint seed, int pref, float star, out bool ok)
{
    int nWin = windowsValid();
    int hosts = nWin + (star > 0.5 ? 1 : 0);
    ok = false;
    Body best = freeBody();
    if (hosts == 0) return best;
    float bestScore = 3.0;
    float r = radiusOf(GM_MOON);
    int hue = int(hashf(seed ^ 0x5bd1e995u) * 6.0);
    for (int c = 0; c < MOON_TRIES; c++) {
        uint h = hashu(seed * 0x2c1b3c6du + uint(c) * 0x297a2d39u + 1u);
        int host = min(int(hashf(h) * float(hosts)), hosts - 1);
        if (pref >= 0 && pref < hosts && c < MOON_TRIES / 2) host = pref;
        float ang = hashf(h ^ 0x1u) * TAU;
        vec2 dir = vec2(cos(ang), sin(ang));
        vec2 p;
        if (host >= nWin) {
            p = starPos() + dir * (STAR_R + 0.07 + 0.26 * hashf(h ^ 0x2u));
        } else {
            vec4 rc = nthWindow(host);
            vec2 ext = 0.5 * rc.zw;
            float t = 1.0 / max(abs(dir.x) / ext.x, abs(dir.y) / ext.y);
            p = rc.xy + ext + dir * (t + 0.04 + 0.14 * hashf(h ^ 0x2u));
        }
        vec2 v = orbitVelocity(p, star) * (0.97 + 0.25 * hashf(h ^ 0x3u));
        if (dot(v, v) <= 0.0) continue;
        float s = orbitScore(p, v, r, star);
        if (s > bestScore) {
            bestScore = s;
            best = makeBody(p, v, GM_MOON, K_MOON, hue, true);
            ok = true;
        }
    }
    return best;
}

// An asteroid entering from just outside a screen edge, aimed to pass beside
// a window or the star.
Body spawnRock(uint seed, float star)
{
    float A = aspectNow();
    vec2 p = FAR;
    for (int c = 0; c < 4; c++) {
        uint h = hashu(seed + uint(c) * 0x51ed27u + 7u);
        float s = hashf(h) * 2.0 * (A + 1.0);
        vec2 q;
        if (s < A) q = vec2(s, -0.04);
        else if (s < A + 1.0) q = vec2(A + 0.04, s - A);
        else if (s < 2.0 * A + 1.0) q = vec2(s - A - 1.0, 1.04);
        else q = vec2(-0.04, s - 2.0 * A - 1.0);
        if (windowHit(q, 1.0, 0.06) < 0) {
            p = q;
            break;
        }
    }
    if (p.x < -1.0) return freeBody();
    uint h2 = hashu(seed ^ 0xa511e9b3u);
    int nWin = windowsValid();
    float ang = hashf(h2 ^ 0x1u) * TAU;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 tgt;
    if (nWin > 0) {
        vec4 rc = nthWindow(min(int(hashf(h2) * float(nWin)), nWin - 1));
        tgt = rc.xy + 0.5 * rc.zw + dir * length(0.5 * rc.zw) * (1.25 + 0.6 * hashf(h2 ^ 0x2u));
    } else if (star > 0.5) {
        tgt = starPos() + dir * (0.12 + 0.25 * hashf(h2 ^ 0x2u));
    } else {
        tgt = vec2((0.2 + 0.6 * hashf(h2 ^ 0x3u)) * A, 0.25 + 0.5 * hashf(h2 ^ 0x4u));
    }
    float spd = (0.26 + 0.3 * hashf(h2 ^ 0x5u)) * sqrt(GRAVITY);
    vec2 v = normalize(tgt - p) * spd;
    return makeBody(p, v, GM_ROCK * (0.6 + 0.8 * hashf(h2 ^ 0x6u)), K_ROCK, 0, false);
}

// An asteroid condensing at a random spot of bare desktop on an eccentric
// orbit (initial scene).
Body screenRock(uint seed, float star)
{
    float A = aspectNow();
    for (int c = 0; c < 6; c++) {
        uint h = hashu(seed * 0x9e3779b9u + uint(c) * 0x85ebca6bu + 3u);
        vec2 p = vec2(0.05 + hashf(h) * (A - 0.1), PANEL + 0.05 + hashf(h ^ 0x1u) * (0.9 - PANEL));
        if (windowHit(p, 1.0, 0.05) >= 0) continue;
        if (star > 0.5 && length(p - starPos()) < STAR_R + 0.08) continue;
        vec2 v = orbitVelocity(p, star) * (0.55 + 0.35 * hashf(h ^ 0x2u));
        float a = hashf(h ^ 0x3u) * TAU;
        v += vec2(cos(a), sin(a)) * 0.04;
        return makeBody(p, v, GM_ROCK * (0.6 + 0.8 * hashf(h ^ 0x4u)), K_ROCK, 0, true);
    }
    return freeBody();
}

Body initialBody(int i, float star)
{
    int hosts = windowsValid() + (star > 0.5 ? 1 : 0);
    int nMoons = hosts > 0 ? clamp(2 * hosts, 4, 8) : 0;
    int nRocks = hosts > 0 ? 3 : 6;
    uint seed = hashu(uint(i) * 0x27d4eb2du + 0x165667b1u);
    if (i < nMoons) {
        bool ok;
        Body b = spawnMoon(seed, i % hosts, star, ok);
        b.code = packCode(K_MOON, (i + 1) % 6, true);
        return b;
    }
    if (i < nMoons + nRocks) return screenRock(seed, star);
    return freeBody();
}

// Launch velocity for a press at o released at m: a plain click gives the
// circular orbit velocity, a pull flings the body the opposite way.
vec2 launchVelocity(vec2 o, vec2 m, float star)
{
    vec2 d = o - m;
    if (length(d) < CLICK_DRAG) return orbitVelocity(o, star);
    vec2 v = d * LAUNCH_K * LAUNCH_POWER * sqrt(GRAVITY);
    float s = length(v);
    float cap = LAUNCH_MAX * sqrt(GRAVITY);
    return s > cap ? v * (cap / s) : v;
}

float launchGM(vec2 o, vec2 m) { return length(o - m) < CLICK_DRAG ? GM_MOON : GM_PLANET; }

Body launchBody(vec2 o, vec2 m, float launches, float star)
{
    bool click = length(o - m) < CLICK_DRAG;
    int hue = int(mod(launches, 6.0));
    return makeBody(o, launchVelocity(o, m, star), launchGM(o, m), click ? K_MOON : K_PLANET, hue, false);
}

// ------------------------------------------------------------- stepping

// Slot of the heaviest live body overlapping body j, j itself when none
// outranks it.
int topOverlap(int j, vec2 pj, float gmj)
{
    int top = j;
    float topGm = gmj;
    float rj = radiusOf(gmj);
    for (int k = 0; k < MAX_BODIES; k++) {
        if (k == j) continue;
        vec4 q = texelFetch(iChannel0, ivec2(k, ROW_Q), 0);
        if (q.w < 0.5 || q.w >= 1.5) continue;
        vec2 pk = texelFetch(iChannel0, ivec2(k, ROW_P), 0).xy;
        float rr = (rj + radiusOf(q.x)) * 0.85;
        if (dot(pk - pj, pk - pj) < rr * rr && outranks(q.x, k, topGm, top)) {
            top = k;
            topGm = q.x;
        }
    }
    return top;
}

Body stepBody(int i, Body b, float star, float dt, out Event ev)
{
    ev.kind = -1;
    ev.at = b.p;
    ev.drift = vec2(0.0);
    ev.energy = 0.0;
    ev.dir = 0.0;
    ev.code = b.code;
    if (b.state < 0.5) return b;
    bool fading = b.state >= 1.5;
    float ri = radiusOf(b.gm);
    float gm = b.gm;
    vec2 mom = b.v * b.gm;
    vec2 acc = vec2(0.0);

    for (int j = 0; j < MAX_BODIES; j++) {
        if (j == i) continue;
        vec4 q = texelFetch(iChannel0, ivec2(j, ROW_Q), 0);
        if (q.w < 0.5) continue;
        vec4 pj = texelFetch(iChannel0, ivec2(j, ROW_P), 0);
        vec2 dv = pj.xy - b.p;
        float d2 = dot(dv, dv);
        float s2 = d2 + BODY_SOFT * BODY_SOFT;
        acc += GRAVITY * q.x * dv / (s2 * sqrt(s2));
        if (fading || q.w >= 1.5) continue;
        float rj = radiusOf(q.x);
        float rr = (ri + rj) * 0.85;
        if (d2 >= rr * rr) continue;
        if (outranks(q.x, j, b.gm, i)) {
            ev.kind = B_MERGE;
            ev.at = b.p + dv * (ri / (ri + rj));
            ev.drift = 0.35 * (b.v * b.gm + pj.zw * q.x) / (b.gm + q.x);
            ev.energy = clamp(length(b.v - pj.zw) / 0.5, 0.25, 1.1);
            ev.dir = atan(-dv.y, -dv.x);
            return freeBody();
        }
        if (topOverlap(j, pj.xy, q.x) == i) {
            gm += q.x;
            mom += pj.zw * q.x;
        }
    }

    vec2 v = mom / gm;
    gm = min(gm, GM_MAX);
    vec2 p = b.p;
    float r = radiusOf(gm);
    float f0 = float(iSubstep) / float(iSubsteps);
    float df = 0.5 / float(iSubsteps);
    float h = 0.5 * dt;
    vec2 a = fieldAt(p, f0, star) + acc;
    for (int k = 0; k < 2; k++) {
        float f1 = f0 + df * float(k + 1);
        v += a * (0.5 * h);
        p += v * h;
        a = fieldAt(p, f1, star) + acc;
        v += a * (0.5 * h);
        for (int w = 0; w < iWindowCount && w < 16; w++) {
            vec4 rc = winAt(w, f1);
            if (!windowOk(rc)) continue;
            vec2 hs = 0.5 * rc.zw;
            vec2 q = p - rc.xy - hs;
            float sd = sdBox(q, hs);
            if (sd >= r) continue;
            vec2 n = boxNormal(q, hs);
            vec2 vw = iWindowVelocities[w] / iResolution.y;
            vec2 vr = v - vw;
            float vn = dot(vr, n);
            ev.kind = B_SHATTER;
            ev.at = p - n * (sd - 0.003);
            ev.drift = vw * 0.7 + (vr - 1.6 * min(vn, 0.0) * n) * 0.22;
            ev.energy = clamp(length(vr) / 0.45, 0.35, 1.5) * (0.75 + 0.25 * sqrt(gm / GM_MOON));
            ev.dir = atan(n.y, n.x);
            return freeBody();
        }
        if (star > 0.05) {
            vec2 ds = p - starPos();
            float l = length(ds);
            if (l < STAR_R * star + 0.5 * r) {
                vec2 n = ds / max(l, 1e-5);
                ev.kind = B_BURN;
                ev.at = starPos() + n * STAR_R * star;
                ev.drift = n * 0.03;
                ev.energy = 0.9;
                ev.dir = atan(n.y, n.x);
                return freeBody();
            }
        }
    }
    float sp = length(v);
    if (sp > SPEED_MAX) v *= SPEED_MAX / sp;

    float A = aspectNow();
    if (p.x < -CULL || p.y < -CULL || p.x > A + CULL || p.y > 1.0 + CULL) return freeBody();

    Body o = b;
    o.p = p;
    o.v = v;
    o.gm = gm;
    o.age = min(b.age + dt, 1.0e4);
    if (fading) {
        o.state = b.state + dt / FADE_OUT;
        if (o.state >= 3.0) return freeBody();
    }
    return o;
}

// Fade-in, fade-out and kind brightness of a body's trail.
float trailIntensity(Body b)
{
    int kind = kindOf(b.code);
    float k = kind == K_ROCK ? 0.38 : (kind == K_MOON ? 0.8 : 1.0);
    if (condensing(b.code)) k *= smoothstep(0.0, FADE_IN, b.age);
    if (b.state >= 1.5) k *= 1.0 - clamp(b.state - 2.0, 0.0, 1.0);
    return k * (0.6 + 0.4 * smoothstep(0.08, 0.7, length(b.v)));
}

// ------------------------------------------------------------- preview

// Aim preview dot k: the launch integrated (k + 1) DOT_DT seconds in the
// current field. Dots past an impact are dropped; the dot whose interval
// holds the impact marks it (w = 2).
vec4 previewDot(int k, vec2 o, vec2 m, float star)
{
    const int SUB = 4;
    float h = DOT_DT / float(SUB);
    vec2 v = launchVelocity(o, m, star);
    vec2 p = o;
    float r = radiusOf(launchGM(o, m));
    float A = aspectNow();
    int n = (k + 1) * SUB;
    vec2 a = fieldAt(p, 1.0, star);
    for (int s = 0; s < NPREV * SUB; s++) {
        if (s >= n) break;
        v += a * (0.5 * h);
        p += v * h;
        a = fieldAt(p, 1.0, star);
        v += a * (0.5 * h);
        bool hit = windowHit(p, 1.0, r) >= 0 || (star > 0.05 && length(p - starPos()) < STAR_R * star + 0.5 * r);
        if (hit) return s >= n - SUB ? vec4(p, 1.0 - float(k) / float(NPREV), 2.0) : vec4(0.0);
        if (p.x < -0.1 || p.y < -0.1 || p.x > A + 0.1 || p.y > 1.1) return vec4(0.0);
    }
    return vec4(p, 1.0 - float(k) / float(NPREV), 1.0);
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    // Texels outside the state corner are never read.
    if (ic.x >= MAXB || ic.y > ROW_S) discard;
    if (ic.y >= ROW_R) {
        // Cull rows from the previous step.
        vec4 o = vec4(0.0);
        for (int c = 0; c < 4; c++) {
            int i = 4 * ic.x + c;
            float v = 0.0;
            if (i < MAX_BODIES) {
                if (ic.y == ROW_R) {
                    if (texelFetch(iChannel0, ivec2(i, ROW_Q), 0).w > 0.5)
                        v = packPos(texelFetch(iChannel0, ivec2(i, ROW_P), 0).xy);
                } else {
                    vec4 e = texelFetch(iChannel0, ivec2(i, ROW_E), 0);
                    if (e.w > 0.5 && e.z < BURST_LIFE) v = packPos(e.xy);
                }
            }
            if (c == 0) o.x = v;
            else if (c == 1) o.y = v;
            else if (c == 2) o.z = v;
            else o.w = v;
        }
        fragColor = o;
        return;
    }
    int slot = ic.x;
    float dt = min(iTimeDelta, 1.0 / 60.0);
    float H = iResolution.y;

    vec4 g0 = texelFetch(iChannel0, ivec2(0, ROW_G), 0);
    vec4 g1 = texelFetch(iChannel0, ivec2(1, ROW_G), 0);
    vec4 g2 = texelFetch(iChannel0, ivec2(2, ROW_G), 0);
    vec4 g3 = texelFetch(iChannel0, ivec2(3, ROW_G), 0);
    vec2 m = iMouse.xy / H;
    bool held = iMouse.z > 0.0;
    int nWin = windowsValid();
    float starTarget = (CENTRAL_STAR && nWin == 0) ? 1.0 : 0.0;
    if (g0.w < 0.5) {
        // A button held at load is not a press.
        g0 = vec4(0.0, held ? 1.0 : 0.0, 0.0, 1.0);
        g1 = vec4(m, m);
        g2 = vec4(2.5, 0.0, starTarget, 0.0);
        g3 = vec4(0.0);
    }

    bool heldBefore = g0.y > 0.5;
    bool aimingBefore = g0.x > 0.5;
    bool pressStart = held && !heldBefore && m.y > PANEL && windowHit(m, 1.0, 0.0) < 0;
    bool release = aimingBefore && !held;
    bool aiming = pressStart || (aimingBefore && held);
    vec2 origin = pressStart ? m : g1.xy;
    float star = g2.z;
    float sinceLoad = g3.x;
    bool started = sinceLoad >= INIT_DELAY;
    bool initNow = !started && sinceLoad + dt >= INIT_DELAY;
    float timer = g2.x - dt;
    bool fire = started && timer <= 0.0;

    // Slot scan of the previous step.
    int alive = 0;
    int moons = 0;
    int free0 = -1;
    int free1 = -1;
    int oldest = -1;
    float oldestAge = -1.0;
    for (int j = 0; j < MAX_BODIES; j++) {
        vec4 q = texelFetch(iChannel0, ivec2(j, ROW_Q), 0);
        if (q.w < 0.5) {
            if (free0 < 0) free0 = j;
            else if (free1 < 0) free1 = j;
            continue;
        }
        if (q.w >= 1.5) continue;
        alive++;
        if (kindOf(q.z) != K_ROCK) moons++;
        if (q.y > oldestAge) {
            oldestAge = q.y;
            oldest = j;
        }
    }
    if (ic.y == ROW_G) {
        if (slot == 0) {
            float since = aiming && !pressStart ? min(g0.z + dt, 100.0) : 0.0;
            fragColor = vec4(aiming ? 1.0 : 0.0, held ? 1.0 : 0.0, since, 1.0);
        } else if (slot == 1) {
            fragColor = vec4(origin, mix(g1.zw, m, 1.0 - exp(-3.0 * dt)));
        } else if (slot == 2) {
            float r = hashf(uint(g2.y) * 0x632be5abu + 11u);
            float next = fire ? (moons < MOON_MIN || alive < SPARSE ? 0.7 + 1.0 * r : 2.0 + 2.5 * r) : timer;
            float s = clamp(star + sign(starTarget - star) * dt / 1.2, 0.0, 1.0);
            fragColor = vec4(next, g2.y + (fire ? 1.0 : 0.0), s, mod(g2.w + dt, LOOP));
        } else if (slot == 3) {
            fragColor = vec4(min(sinceLoad + dt, 1.0e4), g3.y + (release ? 1.0 : 0.0), 0.0, 0.0);
        } else {
            fragColor = vec4(0.0);
        }
        return;
    }

    if (ic.y == ROW_V) {
        if (!aiming || slot >= NPREV) {
            fragColor = vec4(0.0);
        } else if (iSubstep != iSubsteps - 1) {
            fragColor = texelFetch(iChannel0, ic, 0);
        } else {
            fragColor = previewDot(slot, origin, m, star);
        }
        return;
    }

    if (slot >= MAX_BODIES) {
        fragColor = ic.y == ROW_P ? vec4(FAR, 0.0, 0.0) : vec4(0.0);
        return;
    }

    int launchSlot = release ? (free0 >= 0 ? free0 : oldest) : -1;
    int ambientSlot = -1;
    if (fire && alive < min(AMBIENT_CAP, MAX_BODIES - 3))
        ambientSlot = launchSlot == free0 ? free1 : free0;
    bool retire = alive > MAX_BODIES - 3 && slot == oldest;

    Body prev = loadBody(slot);
    Body b;
    Event ev;
    ev.kind = -1;
    bool spawned = true;
    if (initNow) {
        b = initialBody(slot, star);
    } else if (slot == launchSlot) {
        b = launchBody(origin, m, g3.y, star);
    } else if (slot == ambientSlot) {
        uint seed = hashu(uint(g2.y) * 0x9e3779b9u + 0x7f4a7c15u);
        int hosts = nWin + (star > 0.5 ? 1 : 0);
        bool ok = false;
        if (moons < MOON_MIN && hosts > 0 && (hashf(seed ^ 0x3c6ef372u) < 0.7 || !ASTEROIDS))
            b = spawnMoon(seed, -1, star, ok);
        if (!ok) b = ASTEROIDS ? spawnRock(seed, star) : freeBody();
    } else {
        spawned = false;
        b = stepBody(slot, prev, star, dt, ev);
        if (retire && b.state > 0.5 && b.state < 1.5) b.state = 2.0;
    }
    bool live = b.state > 0.5;

    if (ic.y == ROW_P) {
        fragColor = live ? vec4(b.p, b.v) : vec4(FAR, 0.0, 0.0);
    } else if (ic.y == ROW_Q) {
        fragColor = live ? vec4(b.gm, b.age, b.code, b.state) : vec4(0.0);
    } else if (ic.y == ROW_T) {
        vec4 t = texelFetch(iChannel0, ic, 0);
        vec2 start = (spawned || prev.state < 0.5) ? b.p : (iSubstep == 0 ? prev.p : t.xy);
        float key = TRAILS_BY_SPEED ? length(b.v) : (kindOf(b.code) == K_ROCK ? 7.0 : float(hueOf(b.code)));
        fragColor = vec4(start, live ? trailIntensity(b) : 0.0, key);
    } else {
        vec4 o = texelFetch(iChannel0, ic, 0);
        if (ev.kind >= 0) {
            float hue = kindOf(ev.code) == K_ROCK ? 7.0 : float(hueOf(ev.code));
            o = ic.y == ROW_E ? vec4(ev.at, 0.0, 1.0 + float(ev.kind) + 4.0 * hue)
                              : vec4(ev.drift, ev.energy, ev.dir);
        } else if (ic.y == ROW_E && o.w > 0.5) {
            o.z = min(o.z + dt, BURST_LIFE + 1.0);
        }
        fragColor = o;
    }
}
