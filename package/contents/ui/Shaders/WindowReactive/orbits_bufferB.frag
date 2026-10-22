// Orbits — Buffer B: trail light.
// @channels bufferA, self
//
// One texel per grid cell: rgb trail light, w unused. Once per frame (last
// substep) the light decays by exp(-frame dt / TRAIL_SECONDS) and every body
// deposits the chord it travelled this frame (Buffer A ROW_T start to ROW_P
// position) as a soft line whose brightness does not depend on speed. Burst
// sparks deposit their own short streaks, and a fresh burst leaves a fading
// puff. On the other substeps the buffer copies itself.
//
// iChannel0  Buffer A (this substep), iChannel1 this buffer.

// Light deposited at p by a chord from a to b: a gaussian of half width w
// across the line, times a weight along it that ramps over w at both ends,
// so consecutive chords sharing an endpoint sum to one.
float chord(vec2 p, vec2 a, vec2 b, float w)
{
    vec2 ba = b - a;
    float L = length(ba);
    vec2 t = L > 1e-7 ? ba / L : vec2(1.0, 0.0);
    vec2 pa = p - a;
    float along = dot(pa, t);
    float across = dot(pa, vec2(-t.y, t.x));
    float wt = clamp(along / w + 0.5, 0.0, 1.0) - clamp((along - L) / w + 0.5, 0.0, 1.0);
    return wt * exp(-across * across / (w * w));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    vec4 own = texelFetch(iChannel1, ic, 0);
    if (iSubstep != iSubsteps - 1) {
        fragColor = own;
        return;
    }
    float H = iResolution.y;
    vec2 c = (vec2(ic) + 0.5) / H;
    float frameDt = min(iTimeDelta * float(iSubsteps), 0.1);
    vec3 col = own.rgb * exp(-frameDt / TRAIL_SECONDS);

    // Line half width: one texel, at least 0.0015 H.
    float w = max(1.0 / H, 0.0015);
    // Bodies through the cull row (one substep behind): a frame's chord
    // lies within 0.1 H of it.
    float reach = 0.11 + 3.0 * w;
    for (int k = 0; k < (MAX_BODIES + 3) / 4; k++) {
        vec4 cr = texelFetch(iChannel0, ivec2(k, ROW_R), 0);
        if (cr.x + cr.y + cr.z + cr.w < 0.5) continue;
        for (int n = 0; n < 4; n++) {
            float v = n == 0 ? cr.x : (n == 1 ? cr.y : (n == 2 ? cr.z : cr.w));
            if (v < 0.5) continue;
            vec2 dq = c - unpackPos(v);
            if (dot(dq, dq) > reach * reach) continue;
            int i = 4 * k + n;
            vec4 t = texelFetch(iChannel0, ivec2(i, ROW_T), 0);
            if (t.z <= 0.0) continue;
            vec2 p = texelFetch(iChannel0, ivec2(i, ROW_P), 0).xy;
            vec2 lo = min(t.xy, p) - 3.0 * w;
            vec2 hi = max(t.xy, p) + 3.0 * w;
            if (c.x < lo.x || c.y < lo.y || c.x > hi.x || c.y > hi.y) continue;
            col += trailColour(t.w) * (t.z * chord(c, t.xy, p, w));
        }
    }

    // Burst sparks through the cull row: the chord each spark travelled
    // this frame, and a puff around a burst in its first instants.
    for (int k = 0; k < (MAX_BODIES + 3) / 4; k++) {
        vec4 cs = texelFetch(iChannel0, ivec2(k, ROW_S), 0);
        if (cs.x + cs.y + cs.z + cs.w < 0.5) continue;
        for (int n = 0; n < 4; n++) {
            float v = n == 0 ? cs.x : (n == 1 ? cs.y : (n == 2 ? cs.z : cs.w));
            if (v < 0.5) continue;
            vec2 dq = c - unpackPos(v);
            if (dot(dq, dq) > 0.09) continue;
            int j = 4 * k + n;
            vec4 E = texelFetch(iChannel0, ivec2(j, ROW_E), 0);
            if (E.w < 0.5 || E.z >= BURST_LIFE) continue;
            vec2 dc = c - E.xy;
            vec4 F = texelFetch(iChannel0, ivec2(j, ROW_F), 0);
            float br = (0.31 * F.z + length(F.xy)) / SPARK_DRAG + 0.05;
            if (dot(dc, dc) > br * br) continue;
            vec3 bc = burstColour(E.w);
            float puff = exp(-E.z * 7.0) * min(frameDt * 7.0, 1.0) * F.z;
            float pr = 0.006 + 0.012 * F.z;
            col += bc * (0.45 * puff * exp(-dot(dc, dc) / (pr * pr)));
            float t0 = max(E.z - frameDt, 0.0);
            for (int m = 0; m < SPARKS; m++) {
                vec3 sa = sparkAt(E, F, m, t0);
                vec3 sb = sparkAt(E, F, m, E.z);
                if (sb.z <= 0.0) continue;
                // Streaks start clear of the centre, where all sparks overlap.
                float clear = smoothstep(0.004, 0.016, length(sb.xy));
                col += mix(bc, vec3(1.0), 0.35) * (0.25 * sb.z * clear * chord(dc, sa.xy, sb.xy, w));
            }
        }
    }
    fragColor = vec4(min(col, vec3(8.0)), 1.0);
}
