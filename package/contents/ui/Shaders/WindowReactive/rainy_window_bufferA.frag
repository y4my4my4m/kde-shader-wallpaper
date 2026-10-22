// Rainy Window — Buffer A: drops, input and window state, screen tiles.
// @channels self, bufferB
//
// Layout in rainy_window_common.frag. iChannel1 is Buffer B (the glass) as
// of two steps ago: B runs after A within a step. Every texel outside the
// state block is discarded.
//
// Both texels of a drop run the same update on the previous step's state,
// so their halves agree. Overlapping drops merge: the larger keeps going
// with the summed volume (r^3) and momentum, the smaller frees its slot.
// Resting drops grow from rain and from the beads around them and run once
// heavy enough. Running drops head for a speed set by their size, stall now
// and then, zig-zag in short straight runs, lean toward wet trails, lose
// water to their trail and gain it from the beads ahead of them. A drop
// that runs into a window joins the water pooled on its top edge. A full
// pool overflows: a drop slides down a side, hangs from the bottom corner,
// grows and drips. A dragged window sheds water behind it. A tap on bare
// glass sets nearby resting drops running and shakes up to three drops
// loose. Free slots respawn as new drops at a rate set by the rain.
// iMouse and iWindowRects arrive scaled to this grid; grid px are square,
// so pixels / iResolution.y are H. Loops over all drops read four records
// per iteration: they run on a few hundred texels and are latency-bound.

float gAsp;
float gDt;
float gRain;
vec4 G0;
vec4 TAP;

vec4 stateAt(ivec2 c) { return texelFetch(iChannel0, c, 0); }

vec4 glassAt(vec2 uv)
{
    ivec2 c = clamp(ivec2(uv * iResolution.xy), ivec2(0), ivec2(iResolution.xy) - 1);
    return texelFetch(iChannel1, c, 0);
}

bool winValid(int k) { return k < iWindowCount && iWindowRects[k].z >= 1.0 && iWindowRects[k].w >= 1.0; }
vec4 winH(int k)     { return iWindowRects[k] / iResolution.y; }
vec4 winPrevH(int k) { return iWindowRectsPrev[k] / iResolution.y; }

bool tapNow() { return TAP.z == 0.0 && TAP.w > 0.0; }

// d0 = (uv, radius, code), d1 = (velocity, distance or age, seed).
void freeDrop(inout vec4 d0, inout vec4 d1)
{
    d0 = vec4(0.0);
    d1 = vec4(0.0, 0.0, 0.0, d1.w);
}

// Drop i on the first step: a pane already wet, a few drops on their way.
void initDrop(int i, out vec4 d0, out vec4 d1)
{
    vec4 h = hash43(vec3(float(i) * 1.731 + 0.5, 0.37, 9.1));
    vec2 uv = vec2(h.x, 0.07 + 0.92 * h.y);
    float seed = fract(h.w * 31.7 + 0.13);
    d0 = vec4(0.0);
    d1 = vec4(0.0, 0.0, 0.0, seed);
    if (i >= dropsActive(gAsp) || windowAt(uv * iResolution.xy, -3.0) >= 0) return;
    float r = DU * (2.2 + 8.5 * h.z * h.z);
    if (h.w < 0.14) {
        d0 = vec4(uv, max(r, 6.0 * DU), dropCode(ST_RUN, 0, 0));
        d1 = vec4(0.0, -0.05, 0.0, seed);
    } else {
        d0 = vec4(uv, r, dropCode(ST_REST, 0, 0));
        d1 = vec4(0.0, 0.0, 0.5, seed);
    }
}

// A free slot: a tap's drops first, then water from window k = i mod 16,
// then rain.
void spawnDrop(int i, inout vec4 d0, inout vec4 d1)
{
    if (i >= dropsActive(gAsp)) return;
    vec4 h = hash43(vec3(float(i) + 0.37, mod(G0.z, 8192.0) + 0.11, d1.w * 977.0 + 3.3));
    vec4 h2 = hash43(vec3(h.yz * 711.0, float(i) * 0.71 + 5.0));
    float seed = fract(h.w * 13.7 + d1.w * 7.1 + 0.123);

    if (tapNow()) {
        int before = 0;
        for (int j = 0; j < NDROP; j++) {
            if (j >= i) break;
            if (dropState(stateAt(dropTexel(j, 0)).w) == ST_FREE) before++;
        }
        if (before < 3) {
            vec2 P = TAP.xy * vec2(gAsp, 1.0) + vec2(h.x - 0.5, h.y - 0.3) * vec2(0.09, 0.06);
            d0 = vec4(P / vec2(gAsp, 1.0), DU * (5.5 + 3.5 * h2.x), dropCode(ST_RUN, 0, 0));
            d1 = vec4(0.0, -0.06, 0.0, seed);
            return;
        }
    }

    int k = i - (i / 16) * 16;
    if (winValid(k)) {
        vec4 S = stateAt(ivec2(SLOT0 + k, 0));
        vec4 R = winH(k);
        float over = smoothstep(0.8, 0.97, S.x);
        if (h.x < gDt * 0.5 * over * (0.3 + gRain)) {
            int side = h.y < 0.5 ? 0 : 1;
            float r = DU * (3.5 + 2.5 * h2.y);
            vec2 P = vec2(side == 0 ? R.x - 0.45 * r : R.x + R.z + 0.45 * r, R.y + R.w - r);
            d0 = vec4(P / vec2(gAsp, 1.0), r, dropCode(ST_EDGE, k, side));
            d1 = vec4(0.0, -0.05, 0.0, seed);
            return;
        }
        float shed = smoothstep(0.12, 0.6, S.y) * S.x;
        if (h.x > 0.5 && h.x - 0.5 < gDt * 7.0 * shed) {
            vec2 wv = iWindowVelocities[k] / iResolution.y;
            vec2 dir = wv / max(length(wv), 1e-5);
            vec2 c = R.xy + 0.5 * R.zw;
            float r = DU * (3.0 + 4.5 * h2.y);
            vec2 P;
            if (abs(dir.x) > abs(dir.y)) {
                P = vec2(c.x - sign(dir.x) * (0.5 * R.z + 1.6 * r), R.y + h.y * R.w);
            } else {
                P = vec2(R.x + h.y * R.z, c.y - sign(dir.y) * (0.5 * R.w + 1.6 * r));
            }
            if (P.y > 0.0 && P.y < 1.0 && P.x > 0.0 && P.x < gAsp) {
                d0 = vec4(P / vec2(gAsp, 1.0), r, dropCode(ST_RUN, 0, 0));
                d1 = vec4(0.0, -0.03, 0.0, seed);
            }
            return;
        }
    }

    if (h2.x < gDt * 0.6 * gRain) {
        vec2 uv = vec2(h2.y, 0.04 + 0.96 * h2.z);
        if (windowAt(uv * iResolution.xy, -3.0) >= 0) return;
        if (h2.w > shelterAt(uv, gAsp)) return;
        float hz = fract(h2.w * 7.77 + h.x);
        d0 = vec4(uv, DU * (2.0 + 6.5 * hz * hz), dropCode(ST_REST, 0, 0));
        d1 = vec4(0.0, 0.0, 0.0, seed);
    }
}

// Drop i (at P, radius r) against drop j's first record b.
void mergeWith(int i, int j, vec4 b, vec2 P, float r,
               inout float vol, inout vec2 mom, inout bool runnerHit, inout bool eaten)
{
    int sj = dropState(b.w);
    if (j == i || sj == ST_FREE) return;
    vec2 dd = b.xy * vec2(gAsp, 1.0) - P;
    float lim = 0.8 * (r + b.z);
    if (dot(dd, dd) > lim * lim) return;
    if (b.z > r || (b.z == r && j < i)) {
        eaten = true;
        return;
    }
    float vj = b.z * b.z * b.z;
    vol += vj;
    mom += stateAt(dropTexel(j, 1)).xy * vj;
    if (sj == ST_RUN) runnerHit = true;
}

void stepDrop(int i, inout vec4 d0, inout vec4 d1)
{
    int st = dropState(d0.w);
    if (st == ST_FREE) {
        spawnDrop(i, d0, d1);
        return;
    }

    vec2 P = d0.xy * vec2(gAsp, 1.0);
    float r = d0.z;
    int k = dropWin(d0.w);
    int side = dropSide(d0.w);
    vec2 v = d1.xy;
    float z = d1.z;
    float seed = d1.w;
    float clock = G0.x;

    // Merge with the overlapping drops among those listed in this drop's
    // tile.
    float vol = r * r * r;
    vec2 mom = v * vol;
    bool runnerHit = false;
    bool eaten = false;
    int TX = tilesX(gAsp);
    ivec2 t = clamp(ivec2(d0.xy * vec2(float(TX), float(TILE_ROWS))), ivec2(0), ivec2(TX - 1, TILE_ROWS - 1));
    int parts = dropsActive(gAsp) > 96 ? 2 : 1;
    for (int part = 0; part < parts; part++) {
        uvec4 mask = uvec4(stateAt(tileTexel(t, part)));
        for (int ch = 0; ch < 4; ch++) {
            uint bits = mask[ch];
            for (int n = 0; n < 24; n++) {
                if (bits == 0u || eaten) break;
                uint low = bits & (~bits + 1u);
                bits ^= low;
                int j = part * 96 + ch * 24 + int(round(log2(float(low))));
                mergeWith(i, j, stateAt(dropTexel(j, 0)), P, r, vol, mom, runnerHit, eaten);
            }
        }
    }
    if (eaten) {
        freeDrop(d0, d1);
        return;
    }
    r = pow(vol, 1.0 / 3.0);
    v = mom / vol;
    if (st == ST_REST && runnerHit) {
        st = ST_RUN;
        z = 0.0;
    }

    if (st == ST_REST) {
        z = min(z + gDt, 600.0);
        v = vec2(0.0);
        // Beads above the drop, outside the ring it has already drunk.
        float b = glassAt((P + vec2(0.0, 2.0 * r)) / vec2(gAsp, 1.0)).y;
        r += gDt * DU * (0.10 * gRain * shelterAt(d0.xy, gAsp) + 0.22 * b);
        float rRun = DU * (7.5 + 4.5 * seed);
        bool tapped = tapNow() && r > R_STOP && distance(P, TAP.xy * vec2(gAsp, 1.0)) < 0.16;
        if (r > rRun || tapped) {
            st = ST_RUN;
            z = 0.0;
            v = vec2(0.0, tapped ? -0.12 : -0.02);
        }
        if (windowAt(P * iResolution.y, 0.0) >= 0) {
            freeDrop(d0, d1);
            return;
        }
    } else if (st == ST_RUN) {
        float sp = length(v);
        z = mod(z + sp * gDt, 64.0);
        // Stick-slip: stalls come and go along the path and in time.
        float slip = smoothstep(0.1, 0.45, vnoise1(z * 55.0 + seed * 517.0 + clock * 0.9));
        slip = max(slip, smoothstep(1.3, 2.2, r / R_REF));
        float vT = 0.32 * pow(clamp((r - R_STOP) / R_REF, 0.0, 1.6), 0.7) + 0.02;
        v.y += (-vT * slip - v.y) * min(gDt * 7.0, 1.0);
        // Zig-zag: a fresh slope every segLen of travel, leaning toward wet glass.
        float segLen = 0.008 + 0.022 * hash11(seed * 311.0);
        float slope = (hash11(seed * 97.0 + floor(z / segLen) * 1.618) - 0.5) * 1.1;
        vec2 across = vec2(1.8 * r / gAsp, -1.5 * r);
        float wl = glassAt(d0.xy - vec2(across.x, -across.y)).z;
        float wr = glassAt(d0.xy + across).z;
        float steer = clamp((wr - wl) * 1.5, -0.7, 0.7);
        float vx = (slope + steer) * max(-v.y, 0.0);
        v.x += (vx - v.x) * min(gDt * 10.0, 1.0);
        // Water lost to the trail, gained from the beads just ahead.
        vec4 g = glassAt((P + v / max(sp, 1e-4) * 1.2 * r) / vec2(gAsp, 1.0));
        r += sp * gDt * DU * (10.0 * g.y * (1.0 - smoothstep(9.0, 12.0, r / DU)) - 6.5 * (1.0 - 0.6 * g.z));
        P += v * gDt;
        if (r < R_STOP) {
            st = ST_REST;
            z = 0.0;
            v = vec2(0.0);
        }
        if (P.y < -r || P.x < -r || P.x > gAsp + r || windowAt(P * iResolution.y, 0.5 * r * iResolution.y) >= 0) {
            freeDrop(d0, d1);
            return;
        }
    } else if (st == ST_EDGE) {
        if (!winValid(k)) {
            st = ST_RUN;
        } else {
            vec4 R = winH(k);
            vec4 Rp = winPrevH(k);
            if (iSubstep == 0) P.y += R.y - Rp.y;
            float slip = smoothstep(0.15, 0.5, vnoise1(clock * 1.3 + seed * 211.0));
            v = vec2(0.0, -0.10 * (0.25 + 0.75 * slip));
            P.y = min(P.y + v.y * gDt, R.y + R.w - r);
            P.x = side == 0 ? R.x - 0.45 * r : R.x + R.z + 0.45 * r;
            z = min(z + gDt, 600.0);
            if (P.y < R.y + 0.3 * r) {
                st = ST_HANG;
                z = 0.0;
            }
        }
    } else if (st == ST_HANG) {
        if (!winValid(k)) {
            st = ST_RUN;
            v = vec2(0.0, -0.02);
        } else {
            vec4 R = winH(k);
            float flung = stateAt(ivec2(SLOT0 + k, 0)).y;
            z = min(z + gDt, 600.0);
            r += gDt * DU * 0.35;
            P = vec2(side == 0 ? R.x + 0.7 * r : R.x + R.z - 0.7 * r, R.y - 1.05 * r);
            v = vec2(0.0);
            if (r > DU * (8.0 + 3.0 * seed) || flung > 0.5) {
                st = ST_RUN;
                z = 0.0;
                v = vec2(0.0, -0.03);
            }
        }
    }

    if (r < R_MIN) {
        freeDrop(d0, d1);
        return;
    }
    if (st != ST_EDGE && st != ST_HANG) {
        k = 0;
        side = 0;
    }
    d0 = vec4(P / vec2(gAsp, 1.0), r, dropCode(st, k, side));
    d1 = vec4(v, z, seed);
}

// Bit k of a tile mask, for drop record b, if its reach grown by a frame of
// travel meets the box lo..hi (H).
vec4 tileBit(int k, vec4 b, vec2 lo, vec2 hi, float travel)
{
    int st = dropState(b.w);
    if (st == ST_FREE) return vec4(0.0);
    vec2 P = b.xy * vec2(gAsp, 1.0);
    float reach = dropReach(b.z, st) + travel;
    vec2 q = clamp(P, lo, hi) - P;
    if (dot(q, q) > reach * reach) return vec4(0.0);
    int c = k / 24;
    return exp2(float(k - c * 24)) * vec4(equal(ivec4(c), ivec4(0, 1, 2, 3)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    if (ic.x >= 64 || ic.y >= ROW_TILE + 2 * TILE_ROWS) discard;

    gAsp = iResolution.x / iResolution.y;
    gDt = iTimeDelta;
    gRain = rainNow(iDate.w);
    G0 = stateAt(ivec2(0, 0));
    TAP = stateAt(ivec2(1, 0));
    bool init = G0.w < 0.5;
    if (init) TAP = vec4(0.0, 0.0, 60.0, 0.0);

    if (ic.y == 0) {
        if (ic.x == 0) {
            float clock = init ? 0.0 : mod(G0.x + gDt, CLOCK);
            float stepN = init ? 0.0 : mod(G0.z + 1.0, 1048576.0);
            fragColor = vec4(clock, iMouse.z > 0.0 ? 1.0 : 0.0, stepN, 1.0);
        } else if (ic.x == 1) {
            bool press = !init && iMouse.z > 0.0 && G0.y < 0.5;
            if (press && cursorOnGlass(iMouse.xy)) {
                fragColor = vec4(iMouse.xy / iResolution.xy, 0.0, mod(TAP.w, 1023.0) + 1.0);
            } else {
                fragColor = vec4(TAP.xy, min(TAP.z + gDt, 60.0), TAP.w);
            }
        } else if (ic.x >= SLOT0 && ic.x < SLOT0 + 16) {
            int k = ic.x - SLOT0;
            if (!winValid(k)) {
                fragColor = vec4(0.0);
                return;
            }
            vec4 S = stateAt(ic);
            vec4 R = winH(k);
            bool fresh = S.w < 0.5 || abs(S.z - R.z) > 0.02;
            float pool = fresh ? (init ? 0.8 : 0.25) : S.x;
            float spd = length(iWindowVelocities[k]) / iResolution.y;
            float sm = fresh ? 0.0 : S.y + (spd - S.y) * min(gDt * 12.0, 1.0);
            pool += gDt * 0.03 * gRain;
            pool -= gDt * 0.05 * smoothstep(0.85, 1.0, pool);
            pool -= gDt * pool * 2.5 * smoothstep(0.1, 0.5, sm);
            fragColor = vec4(clamp(pool, 0.0, 1.0), sm, R.z, 1.0);
        } else {
            fragColor = vec4(0.0);
        }
        return;
    }

    if (ic.y < ROW_TILE) {
        int part = ic.x / 32;
        int i = (ic.y - ROW_DROP) * 32 + ic.x - part * 32;
        vec4 d0 = stateAt(dropTexel(i, 0));
        vec4 d1 = stateAt(dropTexel(i, 1));
        if (init) initDrop(i, d0, d1);
        else stepDrop(i, d0, d1);
        fragColor = part == 0 ? d0 : d1;
        return;
    }

    // Screen tile: the drops reaching into it, from the previous step. Built
    // on the last step of a frame, which the image pass reads, and carried
    // over on the others.
    int TX = tilesX(gAsp);
    int part = (ic.y - ROW_TILE) / TILE_ROWS;
    int ty = ic.y - ROW_TILE - part * TILE_ROWS;
    if (ic.x >= TX) {
        fragColor = vec4(0.0);
        return;
    }
    if (iSubstep < iSubsteps - 1 && !init) {
        fragColor = stateAt(ic);
        return;
    }
    float travel = 0.45 * gDt * float(iSubsteps);
    vec2 cellH = vec2(gAsp / float(TX), 1.0 / float(TILE_ROWS));
    vec2 lo = vec2(float(ic.x), float(ty)) * cellH;
    vec2 hi = lo + cellH;
    vec4 mask = vec4(0.0);
    int j0 = part * 96;
    int n = min(dropsActive(gAsp) - j0, 96);
    for (int k = 0; k < n; k += 4) {
        vec4 b0 = stateAt(dropTexel(j0 + k, 0));
        vec4 b1 = stateAt(dropTexel(j0 + k + 1, 0));
        vec4 b2 = stateAt(dropTexel(j0 + k + 2, 0));
        vec4 b3 = stateAt(dropTexel(j0 + k + 3, 0));
        mask += tileBit(k, b0, lo, hi, travel) + tileBit(k + 1, b1, lo, hi, travel)
              + tileBit(k + 2, b2, lo, hi, travel) + tileBit(k + 3, b3, lo, hi, travel);
    }
    fragColor = mask;
}
