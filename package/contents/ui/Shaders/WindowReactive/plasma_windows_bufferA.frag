// Plasma Windows — Buffer A: arc afterglow.
// @channels self
//
// x = arc core persistence, y = arc glow persistence, z = wake of moving
// windows. Each re-rolled arc path keeps glowing for a fraction of a second
// after the next strike; a dragged window leaves a fading plasma trail. A
// little diffusion per step makes the traces bloom outward while they fade.

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    if (iFrame == 0) {
        fragColor = vec4(0.0);
        return;
    }
    ivec2 ic = ivec2(fragCoord);
    ivec2 hi = ivec2(iResolution.xy) - 1;
    vec4 prev = texelFetch(iChannel0, ic, 0);
    vec4 nb = texelFetch(iChannel0, clamp(ic + ivec2(1, 0), ivec2(0), hi), 0)
            + texelFetch(iChannel0, clamp(ic - ivec2(1, 0), ivec2(0), hi), 0)
            + texelFetch(iChannel0, clamp(ic + ivec2(0, 1), ivec2(0), hi), 0)
            + texelFetch(iChannel0, clamp(ic - ivec2(0, 1), ivec2(0), hi), 0);

    // Diffusion and decay per unit time, so the trail looks the same at any
    // frame rate (the engine substeps this pass to ~240 steps/s).
    float step240 = clamp(iTimeDelta * 240.0, 0.0, 1.0);
    vec4 s = mix(prev, nb * 0.25, 0.22 * step240);
    s.xyz *= exp(-iTimeDelta * vec3(10.0, 4.5, 2.2));

    vec3 f = arcField(fragCoord, 2.2 * unitPx(), 0.36 * iResolution.y, 0.32 * iResolution.y);
    s.x = max(s.x, f.x * 0.9);
    s.y = max(s.y, f.y * 0.8);

    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        float speed = length(iWindowVelocities[i]);
        if (r.z < 2.0 || r.w < 2.0 || speed < 40.0) continue;
        float d = sdRoundBox(fragCoord, r.xy + r.zw * 0.5, r.zw * 0.5, 6.0 * unitPx());
        float edge = exp(-abs(d) / (6.0 * unitPx()));
        s.z = max(s.z, edge * smoothstep(40.0, 350.0, speed));
    }

    fragColor = vec4(s.xyz, 1.0);
}
