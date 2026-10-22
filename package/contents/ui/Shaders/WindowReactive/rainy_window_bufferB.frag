// Rainy Window — Buffer B: the glass.
// @channels self, bufferA
//
// One texel per grid cell: x fog, y bead cover, z trail wetness, w bead
// clustering (rainy_window_common.frag). iChannel1 is Buffer A of this step.
//
// Rain lays beads at a rate set by the weather, fewer in the lee below a
// window; glass under a window slowly dries. Fog creeps back toward a
// steady density, denser low on the pane, slower on wet glass. A running
// drop thins the fog and clears the beads under it, leaving a wet trail
// that dries in 25 s; a resting drop drinks the beads around it. The moving
// cursor wipes like a fingertip, once per frame along its path: fog and
// beads go in streaks along the stroke and water piles up at its rim. A
// dragged window's top edge smears its pooled water over the glass it
// crosses: thinner fog, fresh beads. A tap shakes the beads around it
// together.

float gAsp;

vec4 stateA(ivec2 c) { return texelFetch(iChannel1, c, 0); }

// Distance from p to segment ab (x) and p's signed offset across it (y).
vec2 segDist(vec2 p, vec2 a, vec2 b)
{
    vec2 ba = b - a;
    vec2 pa = p - a;
    float l2 = max(dot(ba, ba), 1e-12);
    float h = clamp(dot(pa, ba) / l2, 0.0, 1.0);
    vec2 n = vec2(-ba.y, ba.x) * inversesqrt(l2);
    return vec2(length(pa - ba * h), dot(pa, n));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;
    gAsp = iResolution.x / iResolution.y;
    vec2 P = uv * vec2(gAsp, 1.0);
    float dt = iTimeDelta;
    vec4 s = texelFetch(iChannel0, ivec2(fragCoord), 0);
    float sh = shelterAt(uv, gAsp);

    if (s.w <= 0.0) {
        float n1 = vnoise2(P * 3.0 + 1.7);
        float n2 = vnoise2(P * 9.0 + 5.1);
        s.x = 0.1 + 0.2 * n1 + 0.15 * (1.0 - smoothstep(0.0, 0.5, uv.y));
        s.y = (0.5 + 0.3 * n2 + 0.2 * n1) * mix(0.25, 1.0, sh);
        s.z = 0.0;
        s.w = 0.05 + 0.95 * clamp(0.7 * n2 + 0.3 * vnoise2(P * 23.0 + 9.0), 0.0, 1.0);
    }
    float rain = rainNow(iDate.w);

    s.y += dt * 0.03 * rain * sh * (1.0 - s.y);
    if (sh <= 0.0) s.y = max(s.y - dt * 0.01, 0.0);
    s.z = max(s.z - dt / 25.0, 0.0);
    float target = 0.9 + 0.12 * (1.0 - smoothstep(0.0, 0.45, uv.y)) - 0.15 * s.w;
    s.x += dt * FOG_REGROW / 110.0 * (target - s.x) * (1.0 - 0.5 * s.z);

    if (iSubstep == 0) {
        // Fingertip wipe along the cursor's path this frame.
        vec2 m = iMouse.xy;
        vec2 mp = iMousePrev;
        float travel = distance(m, mp);
        if (travel > 0.02 && travel < 0.3 * iResolution.y && cursorOnGlass(m) && cursorOnGlass(mp)) {
            vec2 sd = segDist(P, mp / iResolution.y, m / iResolution.y);
            float R = 0.021 * FINGER;
            if (sd.x < 1.4 * R) {
                float k = 1.0 - smoothstep(0.5 * R, R, sd.x);
                float streak = vnoise1(sd.y / max(0.0035, 1.6 / iResolution.y) + 17.0);
                float wipe = k * (0.74 + 0.26 * streak);
                s.x *= 1.0 - wipe;
                s.y *= 1.0 - 0.9 * k;
                s.z = max(s.z, 0.6 * k);
                float rim = smoothstep(0.55 * R, R, sd.x) * (1.0 - smoothstep(R, 1.4 * R, sd.x));
                s.y = min(s.y + 0.3 * rim, 1.0);
            }
        }

        // A dragged window's top edge smears its pool over the glass.
        for (int k = 0; k < 16; k++) {
            if (k >= iWindowCount) break;
            vec4 R = iWindowRects[k] / iResolution.y;
            vec4 Rp = iWindowRectsPrev[k] / iResolution.y;
            if (R.z <= 0.0 || Rp.z <= 0.0) continue;
            vec2 dl = R.xy - Rp.xy;
            if (dot(dl, dl) < 1e-10) continue;
            float pool = stateA(ivec2(SLOT0 + k, 0)).x;
            float top = R.y + R.w;
            float topP = Rp.y + Rp.w;
            float x0 = min(R.x, Rp.x);
            float x1 = max(R.x + R.z, Rp.x + Rp.z);
            float y0 = min(top, topP) - 0.002;
            float y1 = max(top, topP) + 0.006 + 0.004 * pool;
            if (P.x < x0 || P.x > x1 || P.y < y0 || P.y > y1) continue;
            if (P.x > R.x && P.x < R.x + R.z && P.y < top) continue;
            float w = pool * smoothstep(0.0, 0.006, min(P.x - x0, x1 - P.x))
                     * smoothstep(0.0, 0.004, min(P.y - y0, y1 - P.y)) * (0.6 + 0.4 * vnoise1(P.x * 300.0));
            s.x *= 1.0 - 0.3 * w;
            s.y = mix(s.y, 0.8, 0.6 * w);
            s.z = max(s.z, 0.7 * w);
        }
    }

    // Drops reaching into this cell's tile.
    int TX = tilesX(gAsp);
    vec2 tf = min(uv * vec2(float(TX), float(TILE_ROWS)), vec2(float(TX) - 1.0, float(TILE_ROWS) - 1.0));
    int parts = dropsActive(gAsp) > 96 ? 2 : 1;
    for (int part = 0; part < parts; part++) {
        uvec4 mask = uvec4(stateA(tileTexel(ivec2(tf), part)));
        for (int c = 0; c < 4; c++) {
            uint bits = mask[c];
            for (int n = 0; n < 24; n++) {
                if (bits == 0u) break;
                uint low = bits & (~bits + 1u);
                bits ^= low;
                int i = part * 96 + c * 24 + int(round(log2(float(low))));
                vec4 d0 = stateA(dropTexel(i, 0));
                int st = dropState(d0.w);
                if (st == ST_FREE) continue;
                // At least a texel wide, so coarse grids keep whole trails.
                float r = max(d0.z, 0.9 / iResolution.y);
                float d = distance(P, d0.xy * vec2(gAsp, 1.0));
                if (st == ST_RUN) {
                    float w = 1.0 - smoothstep(0.35 * r, 0.8 * r, d);
                    s.x = min(s.x, 1.0 - 0.5 * w);
                    s.y *= 1.0 - w;
                    s.z = max(s.z, w);
                } else {
                    float w = 1.0 - smoothstep(r, 1.6 * r, d);
                    s.y = max(s.y - dt * 0.4 * w, 0.0);
                }
            }
        }
    }

    vec4 tap = stateA(ivec2(1, 0));
    if (tap.z == 0.0 && tap.w > 0.0) {
        float d = distance(P, tap.xy * vec2(gAsp, 1.0));
        s.y *= 1.0 - 0.35 * (1.0 - smoothstep(0.02, 0.1, d));
    }

    fragColor = vec4(clamp(s.xyz, 0.0, 1.0), s.w);
}
