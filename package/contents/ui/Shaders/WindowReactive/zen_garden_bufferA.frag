// Zen Garden — Buffer A: rocks, stones, the gardener, press tracking,
// leaves, tile masks and the gravel field.
// @channels self
//
// State layout in zen_garden_common.frag. Every texel derives its update
// from the previous step only, so texels that share an event agree on it.
// State texels advance once per frame; field texels every substep.
//
// Records. A window that rests REST_TIME s without a rock under it is set
// down: the lowest free record becomes a rock with its rect and a rake lap
// starts (all windows present at reset are set down fully raked). A rock
// whose window has been gone or moved for GRACE s is lifted and fades. A
// click on bare gravel drops a stone into the lowest free record, after any
// lifted stone; past MAX_STONES the oldest one is lifted; a click on a
// stone lifts it. Free records are handed out by rank, so texels agree on
// which window or click each one takes.
//
// Field. Each substep a texel
//   * is carved by the hand rake (cursor segment of this substep), unless
//     the segment touches a window or the press began on one,
//   * is pressed flat under a live rock or stone (smoothed, imprint 2,
//     dropping to 1 once the rock is lifted); windows covering more than
//     FOOTPRINT_MAX of the screen leave none, so restoring a maximized
//     window does not flatten the garden,
//   * is re-raked as a lap front or a stone's ring front passes it,
//   * smooths out inside the zone of a lifted rock, unless live rings
//     stand there,
//   * is re-raked as a gardener's head passes it, outside all
//     zones.
// Gardeners walk the bands of RAKE_TINES lines in turn, boustrophedon, and
// show only while disturbed gravel lies ahead of them. A settled rock whose
// zone shows a disturbance for RELAP_DELAY s gets a fresh lap over its
// standing rings.

const float HOVER_DEPTH   = 0.55;  // furrow strength of a cursor moving without a button
const float FOOTPRINT_MAX = 0.3;   // screen share above which a rock leaves no footprint

vec4 st(int x, int y) { return texelFetch(iChannel0, ivec2(x, y), 0); }

// State texels advance once per frame, on its last substep: window rects
// and the cursor change per frame only. Field texels run every substep and
// see the state of the previous frame.
float frameDt() { return iTimeDelta * float(max(iSubsteps, 1)); }

float aspectG() { return iResolution.x / iResolution.y; }

Rec recAt(int r)
{
    return decodeRec(st(2 * r, ROW_REC), st(2 * r + 1, ROW_REC), st(r, ROW_EXT));
}

bool startupStep() { return st(0, ROW_GLOB).w < 0.5; }

bool rectClose(vec4 a, vec4 b, float aspect)
{
    vec4 d = abs(a - b) * vec4(aspect, 1.0, aspect, 1.0);
    return max(max(d.x, d.y), max(d.z, d.w)) < WIN_TOL;
}

bool onScreen(vec2 m)
{
    return m.x >= 0.0 && m.y >= 0.0 && m.x <= iResolution.x && m.y <= iResolution.y;
}

// Inside a window or its resize border.
bool nearWindow(vec2 m, float margin)
{
    for (int i = 0; i < iWindowCount && i < NWIN; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        if (m.x >= r.x - margin && m.y >= r.y - margin && m.x <= r.x + r.z + margin && m.y <= r.y + r.w + margin) return true;
    }
    return false;
}

struct Click {
    bool fire;
    vec2 pos;    // screen fractions
};

Click clickEvent()
{
    vec4 g0 = st(0, ROW_GLOB);
    vec4 g1 = st(1, ROW_GLOB);
    vec4 g2 = st(2, ROW_GLOB);
    Click c;
    c.pos = g1.xy;
    c.fire = g0.z > 0.5 && iMouse.z <= 0.0 && g2.x > 0.5 && g1.z < 0.012 && g1.w < 0.6;
    return c;
}

// Field value at a point in H units, or zero off the field.
vec4 fieldAtH(vec2 p)
{
    ivec2 c = ivec2(floor(p * iResolution.y));
    if (c.x < 0 || c.y < STATE_ROWS || c.x >= int(iResolution.x) || c.y >= int(iResolution.y)) return vec4(0.0);
    return texelFetch(iChannel0, c, 0);
}

// Inside a live rock's or stone's rect (pad H), or inside any zone when
// zones is set. Only records the point's tile lists are tested.
bool coveredByRecords(vec2 p, float aspect, float pad, bool zones)
{
    int nb = int(st(2, ROW_GLOB).y + 0.5);
    ivec2 tile = ivec2(clamp(floor(p / vec2(aspect, 1.0) * float(TILES)), 0.0, float(TILES - 1)));
    vec4 tm = st(tile.x + TILES * tile.y, ROW_TILE);
    int recLo = int(tm.y + 0.5);
    int recHi = int(tm.z + 0.5);
    for (int r = 0; r < NREC; r++) {
        if (r >= nb) break;
        int bit = r < 16 ? (recLo >> r) & 1 : (recHi >> (r - 16)) & 1;
        if (bit == 0) continue;
        Rec rc = recAt(r);
        if (rc.kind == K_FREE) continue;
        if (!zones && !isLive(rc.kind)) continue;
        Zone z = zoneOf(rc, aspect);
        float d = sdgRoundBox(p - z.c, z.b, z.rc).x;
        if (d < (zones ? z.outer + spacing() : pad)) return true;
    }
    return false;
}

bool zoneDisturbed(Rec me, Zone z, float aspect, float clock)
{
    vec2 bc = z.b - z.rc;
    float P = zonePerimeter(z);
    float ph = fract(clock * 0.37);
    for (int j = 0; j < 24; j++) {
        float fj = (float(j) + ph) / 24.0;
        float dm = z.rc + mix(z.gap, z.outer, (j % 2 == 0) ? 0.3 : 0.75);
        vec4 pa = pathAt(fj * P, bc, dm);
        vec2 p = z.c + pa.xy;
        if (p.x < 0.0 || p.y < 0.03 || p.x > aspect || p.y > 1.0) continue;
        vec4 f = fieldAtH(p);
        if (f.x < 0.3 && f.y < 0.25 && f.w < 0.3) continue;
        if (f.w > 1.5 || nearWindow(p * iResolution.y, 0.0)) continue;
        return true;
    }
    return false;
}

void recordUpdate(int r, bool extTexel, out vec4 oRect, out vec4 oState, out vec4 oExt)
{
    float dt = frameDt();
    float A = aspectG();
    bool startup = startupStep();
    float clock = st(0, ROW_GLOB).x;
    vec4 rawState = st(2 * r + 1, ROW_REC);
    Rec me = recAt(r);
    oRect = me.rect;
    oState = rawState;
    oExt = st(r, ROW_EXT);

    // One pass over the records: free ranks, stones, the stone under a
    // click and the windows that already have a rock (bit i of matched).
    Click ck = clickEvent();
    vec2 ckH = ck.pos * vec2(A, 1.0);
    int hitStone = -1;
    int stones = 0;
    int oldest = -1;
    float oldestT = -1.0;
    int freeCount = 0;
    int rank = 0;
    int matched = 0;
    int nw = min(iWindowCount, NWIN);
    for (int k = 0; k < NREC; k++) {
        vec4 b = st(2 * k + 1, ROW_REC);
        int kind = int(b.x + 0.5);
        if (kind == K_FREE) {
            freeCount++;
            if (k < r) rank++;
            continue;
        }
        vec4 a = st(2 * k, ROW_REC);
        if (kind == K_ROCK) {
            for (int i = 0; i < NWIN; i++) {
                if (i >= nw) break;
                if (rectClose(a, windowFrac(i, iResolution.xy), A)) matched |= 1 << i;
            }
        } else if (kind == K_STONE) {
            stones++;
            if (b.y > oldestT) {
                oldestT = b.y;
                oldest = k;
            }
            Rec o = decodeRec(a, b, vec4(0.0));
            Zone oz = zoneOf(o, A);
            if (ck.fire && hitStone < 0 && sdgRoundBox(ckH - oz.c, oz.b, oz.rc).x < 0.6 * spacing()) hitStone = k;
        }
    }
    bool dropStone = ck.fire && hitStone < 0 && freeCount > 0;

    if (me.kind == K_FREE) {
        oRect = vec4(0.0);
        oState = vec4(0.0);
        oExt = vec4(0.0);
        if (dropStone) {
            if (rank == 0) {
                vec2 h = hash22(ck.pos * 917.0 + clock);
                float rad = 0.015 + 0.008 * h.x;
                vec2 hs = rad * vec2(1.0 + 0.3 * h.y, 1.0 - 0.12 * h.y);
                if (h.x > 0.5) hs = hs.yx;
                vec2 lo = ckH - hs;
                oRect = vec4(lo.x / A, lo.y, 2.0 * hs.x / A, 2.0 * hs.y);
                oState = vec4(float(K_STONE), 0.0, hash12(ck.pos * 311.0 + 7.0), 0.0);
                return;
            }
            rank--;
        }
        for (int i = 0; i < NWIN; i++) {
            if (i >= nw) break;
            if ((matched & (1 << i)) != 0) continue;
            vec4 wf = windowFrac(i, iResolution.xy);
            if (!usableWindow(wf)) continue;
            if (!startup) {
                if (st(32 + i, ROW_GLOB).x < REST_TIME) continue;
                vec4 d = abs(wf - st(16 + i, ROW_GLOB)) * vec4(A, 1.0, A, 1.0);
                if (max(max(d.x, d.y), max(d.z, d.w)) > 0.0005) continue;
            }
            if (rank == 0) {
                oRect = wf;
                oState = vec4(float(K_ROCK), startup ? 1000.0 : 0.0, hash12(wf.xy * 557.0 + clock), 0.0);
                return;
            }
            rank--;
        }
        return;
    }

    Zone z = zoneOf(me, A);
    if (me.kind == K_ROCK) {
        bool held = false;
        for (int i = 0; i < NWIN; i++) {
            if (i >= nw) break;
            if (rectClose(me.rect, windowFrac(i, iResolution.xy), A)) held = true;
        }
        oState.w = held ? 0.0 : me.aux + dt;
        oState.y = min(me.t + dt, 1e4);
        if (oState.w > GRACE) {
            float rev = me.relap > 0.5 ? 1.0 : lapProgress(me, z);
            oState = vec4(float(K_FADE_ROCK), 0.0, me.s0, rev);
            oExt = vec4(0.0, me.relap, 0.0, 0.0);
            return;
        }
    } else if (me.kind == K_STONE) {
        oState.y = min(me.t + dt, 1e4);
        if (hitStone == r || (dropStone && stones + 1 > MAX_STONES && oldest == r)) {
            oState = vec4(float(K_FADE_STONE), 0.0, me.s0, me.relap > 0.5 ? 1.0 : lapProgress(me, z));
            oExt = vec4(0.0, me.relap, 0.0, 0.0);
            return;
        }
    } else {
        float life = me.kind == K_FADE_ROCK ? FADE_ROCK : FADE_STONE;
        oState.y = me.t + dt;
        if (oState.y > life) {
            oRect = vec4(0.0);
            oState = vec4(0.0);
            oExt = vec4(0.0);
        }
        return;
    }

    // A settled rock or stone: a disturbance seen in its zone for
    // RELAP_DELAY s earns a new lap. Only the ext texel scans the zone;
    // both texels act on the previous step's count.
    if (oExt.x > RELAP_DELAY / RERAKE_SPEED) {
        oState.y = me.kind == K_STONE ? STONE_FALL : 0.0;
        oExt = vec4(0.0, 1.0, 0.0, 0.0);
        return;
    }
    float lt = me.kind == K_STONE ? STONE_FALL + STONE_RIPPLE : lapTime(z);
    if (extTexel && me.t > lt + 2.0) {
        bool seen = oExt.x > 0.0 || zoneDisturbed(me, z, A, clock);
        oExt.x = seen ? oExt.x + dt : 0.0;
    }
}

vec4 globalTexel(int x)
{
    float dt = frameDt();
    float A = aspectG();
    bool startup = startupStep();
    vec4 g0 = st(0, ROW_GLOB);
    vec4 g1 = st(1, ROW_GLOB);
    vec4 g2 = st(2, ROW_GLOB);
    bool held = iMouse.z > 0.0;
    bool heldPrev = g0.z > 0.5;
    vec2 mf = iMouse.xy / iResolution.xy;

    if (x == 0) {
        float nb = bandCount();
        float rate = bandRate(A);
        float clock = startup ? mod(iDate.w, CLOCK_PERIOD) : mod(g0.x + dt, CLOCK_PERIOD);
        float P = startup ? mod(iDate.w * rate, nb) : mod(g0.y + dt * rate, nb);
        return vec4(clock, P, held ? 1.0 : 0.0, 1.0);
    }
    if (x == 1) {
        if (held && !heldPrev) return vec4(mf, 0.0, 0.0);
        if (held) return vec4(g1.xy, max(g1.z, length((mf - g1.xy) * vec2(A, 1.0))), g1.w + dt);
        return g1;
    }
    if (x == 2) {
        float ok = g2.x;
        if (held && !heldPrev) {
            bool bare = onScreen(iMouse.xy) && mf.y > 0.065 && !nearWindow(iMouse.xy, 0.008 * iResolution.y);
            ok = bare ? 1.0 : 0.0;
        }
        int hi = 0;
        for (int r = 0; r < NREC; r++) {
            if (int(st(2 * r + 1, ROW_REC).x + 0.5) != K_FREE) hi = r + 1;
        }
        return vec4(ok, float(min(hi + 2, NREC)), 0.0, 0.0);
    }
    if (x >= 4 && x < 8) {
        int g = x - 4;
        float vis = st(x, ROW_GLOB).x;
        if (g >= gardenerCount(A)) return vec4(0.0);
        vec3 gd = gardenerAt(g, g0.y, A);
        float bh = bandHeight();
        float yc = (gd.x + 0.5) * bh;
        float dist = 0.0;
        for (int j = 0; j < 6; j++) {
            for (int k = 0; k < 2; k++) {
                vec2 p = vec2(gd.y + gd.z * (float(j) * 0.06 - 0.02), yc + (float(k) - 0.5) * 0.56 * bh);
                if (p.x < 0.0 || p.x > A || p.y < 0.0 || p.y > 1.0) continue;
                vec4 f = fieldAtH(p);
                float m = max(max(f.x, f.y), f.w);
                if (m < 0.12 || f.w > 1.5 || nearWindow(p * iResolution.y, 0.0)) continue;
                if (coveredByRecords(p, A, 0.0, true)) continue;
                dist = max(dist, m);
            }
        }
        bool hidden = coveredByRecords(vec2(gd.y, yc), A, 0.02, false) || nearWindow(vec2(gd.y, yc) * iResolution.y, 0.02 * iResolution.y);
        float target = (dist > 0.12 && !hidden) ? 1.0 : 0.0;
        vis += (target - vis) * min(1.0, dt / (target > vis ? 0.6 : 1.4));
        return vec4(vis, 0.0, 0.0, 0.0);
    }
    if (x >= 16 && x < 16 + NWIN) {
        int i = x - 16;
        return i < iWindowCount ? windowFrac(i, iResolution.xy) : vec4(0.0);
    }
    if (x >= 32 && x < 32 + NWIN) {
        int i = x - 32;
        if (i >= iWindowCount) return vec4(0.0);
        vec4 cur = windowFrac(i, iResolution.xy);
        vec4 last = st(16 + i, ROW_GLOB);
        vec4 d = abs(cur - last) * vec4(A, 1.0, A, 1.0);
        bool still = max(max(d.x, d.y), max(d.z, d.w)) < 0.0005;
        return vec4(still ? st(x, ROW_GLOB).x + dt : 0.0, 0.0, 0.0, 0.0);
    }
    return vec4(0.0);
}

bool boxesOverlap(vec2 alo, vec2 ahi, vec2 blo, vec2 bhi)
{
    return all(lessThan(alo, bhi)) && all(lessThan(blo, ahi));
}

vec4 tileTexel(int x)
{
    float A = aspectG();
    vec2 ts = vec2(A, 1.0) / float(TILES);
    vec2 lo = vec2(float(x % TILES), float(x / TILES)) * ts;
    vec2 hi = lo + ts;
    int season = seasonNow();
    float clock = st(0, ROW_GLOB).x;
    int lm = 0;
    for (int j = 0; j < NLEAF; j++) {
        if (j >= leafSlots(season)) break;
        Leaf lf;
        if (!leafAt(j, season, clock, A, lf)) continue;
        float rr = 0.05 + 0.36 * lf.z;
        if (boxesOverlap(lo, hi, lf.pos - rr, lf.pos + rr)) lm |= 1 << j;
    }
    int m0 = 0;
    int m1 = 0;
    for (int r = 0; r < NREC; r++) {
        Rec rc = recAt(r);
        if (rc.kind == K_FREE) continue;
        Zone z = zoneOf(rc, A);
        float reach = recordReach(rc, z);
        if (!boxesOverlap(lo, hi, z.c - z.b - reach, z.c + z.b + reach)) continue;
        if (r < 16) m0 |= 1 << r;
        else m1 |= 1 << (r - 16);
    }
    return vec4(float(lm), float(m0), float(m1), 1.0);
}

vec4 fieldTexel(ivec2 ic)
{
    float dt = frameDt();
    float A = aspectG();
    float S = spacing();
    float texH = 1.0 / iResolution.y;
    vec4 f = texelFetch(iChannel0, ic, 0);
    vec2 P = (vec2(ic) + 0.5) * texH;
    vec4 g0 = st(0, ROW_GLOB);
    bool startup = g0.w < 0.5;

    // Hand rake: this substep's stretch of the cursor path.
    bool held = iMouse.z > 0.0;
    float n = float(max(iSubsteps, 1));
    vec2 m0 = mix(iMousePrev, iMouse.xy, float(iSubstep) / n);
    vec2 m1 = mix(iMousePrev, iMouse.xy, float(iSubstep + 1) / n);
    bool pressOk = !held || st(2, ROW_GLOB).x > 0.5;
    if (!startup && (HOVER_RAKE || held) && pressOk && onScreen(m0) && onScreen(m1)) {
        vec2 a = m0 * texH;
        vec2 b = m1 * texH;
        float len = length(b - a);
        float tS = HAND_TINE * S;
        float hw = 0.5 * float(HAND_TINES) * tS;
        float reach = hw + 1.8 * tS;
        bool jump = length(iMouse.xy - iMousePrev) * texH > 0.12;
        bool panel = a.y < 0.06 && b.y < 0.06;
        if (!jump && !panel && len > 1e-5 && abs(P.x - a.x) < len + reach && abs(P.y - a.y) < len + reach
            && !nearWindow(m0, 0.0) && !nearWindow(m1, 0.0)) {
            vec2 dir = (b - a) / len;
            vec2 nn = vec2(-dir.y, dir.x);
            float along = dot(P - a, dir);
            float o = dot(P - a, nn);
            if (along > -hw && along < len && abs(o) < reach) {
                float depth = held ? 1.0 : HOVER_DEPTH;
                float kn = (1.0 - smoothstep(hw + 0.3 * tS, hw + 1.2 * tS, abs(o))) * depth;
                if (abs(o) < hw + 0.3 * tS) {
                    f.y = kn;
                    f.z = o;
                    f.w *= 0.3;
                } else if (kn >= f.y) {
                    f.y = kn;
                    f.z = o;
                } else if (f.y < 0.02) {
                    f.z = o;
                }
            }
        }
    }

    bool interior = false;
    bool liveZone = false;
    bool liveRevealed = false;
    bool restore = false;
    bool fadeZone = false;
    bool fadeRec = false;
    float fadeAmt = 0.0;
    // Records the tile lists; they are two substeps behind the records
    // themselves, which the lap restore below allows for.
    int nb = int(st(2, ROW_GLOB).y + 0.5);
    ivec2 tile = ivec2(clamp(floor(P / vec2(A, 1.0) * float(TILES)), 0.0, float(TILES - 1)));
    vec4 tm = st(tile.x + TILES * tile.y, ROW_TILE);
    int recLo = int(tm.y + 0.5);
    int recHi = int(tm.z + 0.5);
    for (int r = 0; r < NREC; r++) {
        if (r >= nb) break;
        int bit = r < 16 ? (recLo >> r) & 1 : (recHi >> (r - 16)) & 1;
        if (bit == 0) continue;
        vec4 b = st(2 * r + 1, ROW_REC);
        int kind = int(b.x + 0.5);
        if (kind == K_FREE) continue;
        Rec rc = decodeRec(st(2 * r, ROW_REC), b, st(r, ROW_EXT));
        Zone z = zoneOf(rc, A);
        vec2 q = P - z.c;
        if (any(greaterThan(abs(q), z.b + z.outer + 2.0 * S))) continue;
        float d = sdgRoundBox(q, z.b, z.rc).x;
        if (isLive(kind)) {
            if (d < 0.0) {
                if (rc.rect.z * rc.rect.w < FOOTPRINT_MAX) interior = true;
                continue;
            }
            if (d > z.outer + 0.5 * S) continue;
            liveZone = true;
            if (revealAt(rc, z, q, d) > 0.5) liveRevealed = true;
            float slack = 3.0 * texH;
            if (kind == K_STONE) {
                float fr = stoneFront(z, rc.t);
                float fp = stoneFront(z, rc.t - dt);
                if (rc.t > STONE_FALL && d < fr && d > fp - slack) restore = true;
            } else {
                float lt = lapTime(z);
                if (rc.t < lt + dt) {
                    vec3 ps = perimS(q, z.b - z.rc, z.dm);
                    float srel = mod(ps.x - rc.s0 * ps.y, ps.y);
                    float fr = min(rc.t / lt, 1.0) * ps.y;
                    float fp = rc.t < 4.0 * dt ? -1.0 : (rc.t - dt) / lt * ps.y;
                    if (srel < fr && srel > fp - slack / ps.z) restore = true;
                }
            }
        } else if (d < z.outer + 0.5 * S) {
            fadeRec = true;
            if (d > 0.0) {
                fadeZone = true;
                fadeAmt = max(fadeAmt, rc.t / (kind == K_FADE_ROCK ? FADE_ROCK : FADE_STONE));
            }
        }
    }

    if (interior) return vec4(1.0, 0.0, f.z, 2.0);
    f.w = min(f.w, 1.0);
    if (restore) f = vec4(0.0, 0.0, f.z, 0.0);
    if (fadeZone && !liveRevealed) {
        float nz = vnoise(P * 38.0);
        float a = smoothstep(0.45 * nz, 0.45 * nz + 0.55, fadeAmt);
        f.x = max(f.x, a);
    }
    if (!liveZone && !fadeRec && !startup) {
        float bh = bandHeight();
        float band = floor(lineY(P) / bh);
        float stepH = dt * bandRate(A) * (A + 2.0 * BAND_MARGIN);
        for (int g = 0; g < 4; g++) {
            if (g >= gardenerCount(A)) break;
            vec3 gd = gardenerAt(g, g0.y, A);
            if (gd.x != band) continue;
            float behind = (gd.y - P.x) * gd.z;
            if (behind >= 0.0 && behind < stepH + 3.0 * texH) f = vec4(0.0, 0.0, f.z, 0.0);
        }
    }
    return f;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    if (ic.x < 64 && ic.y < STATE_ROWS) {
        if (iSubstep != iSubsteps - 1) {
            fragColor = texelFetch(iChannel0, ic, 0);
            return;
        }
        if (ic.y == ROW_REC) {
            vec4 a, b, e;
            recordUpdate(ic.x / 2, false, a, b, e);
            fragColor = (ic.x % 2 == 0) ? a : b;
        } else if (ic.y == ROW_EXT) {
            vec4 a, b, e;
            if (ic.x >= LEAF_X) {
                int j = (ic.x - LEAF_X) / 2;
                int season = seasonNow();
                Leaf lf;
                bool on = j < leafSlots(season) && leafAt(j, season, st(0, ROW_GLOB).x, aspectG(), lf);
                if (!on) fragColor = vec4(0.0);
                else fragColor = ((ic.x - LEAF_X) % 2 == 0) ? vec4(lf.pos, lf.z, lf.a) : vec4(lf.ang, lf.tumble, lf.size, lf.seed);
            } else if (ic.x < NREC) {
                recordUpdate(ic.x, true, a, b, e);
                fragColor = e;
            } else {
                fragColor = vec4(0.0);
            }
        } else if (ic.y == ROW_TILE) {
            fragColor = tileTexel(ic.x);
        } else {
            fragColor = globalTexel(ic.x);
        }
        return;
    }
    fragColor = fieldTexel(ic);
}
