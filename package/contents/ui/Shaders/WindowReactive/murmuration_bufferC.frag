// Murmuration — Buffer C: flock density.
// @channels bufferA, bufferB, self
//
// One texel per grid cell:
//   x  flying birds per cell, blurred
//   y  the same weighted by each bird's alarm excitement
//   zw the unblurred splat of x and y, taken on each simulation step
// Every substep the field relaxes toward a bilinear splat of the birds in
// the cell's nearest-bird list through a 3x3 blur of itself: a recursive
// Gaussian of variance (1 - feed) / (2 feed) cells^2, run at the substep
// rate (near 240 Hz) whatever the frame rate. feed sets the radius to a
// flock bird's wingspan on any grid, held at 0.06 or more so the lag stays
// under 70 ms.
//
// iChannel0 Buffer A, iChannel1 Buffer B (both this substep), iChannel2 this buffer.

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    ivec2 hi = ivec2(iResolution.xy) - 1;
    float U = unitPx();
    vec2 c = (vec2(ic) + 0.5) / U;
    float sc = flySpan() * depthScale(Z_FLOCK) * U;
    float feed = clamp(1.0 / (1.0 + 2.0 * sc * sc), 0.06, 1.0);

    vec4 own = texelFetch(iChannel2, ic, 0);
    vec2 s = own.zw;
    if (simStep()) {
        s = vec2(0.0);
        ivec4 l = ivec4(texelFetch(iChannel1, ic, 0) + 0.5) - 1;
        for (int k = 0; k < 4; k++) {
            int id = l[k];
            if (id < 0) continue;
            vec4 b = texelFetch(iChannel0, birdTexel(id, 0), 0);
            int m = modeOf(b.w);
            if ((m != M_FLY && m != M_LEAVE) || b.z < 1.0) continue;
            vec2 w = max(1.0 - abs(b.xy - c) * U, 0.0);
            float phi = alarmOf(b.w);
            float exc = phi > 0.0 && phi < ALARM_EXC ? sin(PI * phi / ALARM_EXC) : 0.0;
            s += w.x * w.y * vec2(1.0, exc);
        }
    }

    vec2 acc = 4.0 * own.xy;
    acc += 2.0 * texelFetch(iChannel2, clamp(ic + ivec2(1, 0), ivec2(0), hi), 0).xy;
    acc += 2.0 * texelFetch(iChannel2, clamp(ic - ivec2(1, 0), ivec2(0), hi), 0).xy;
    acc += 2.0 * texelFetch(iChannel2, clamp(ic + ivec2(0, 1), ivec2(0), hi), 0).xy;
    acc += 2.0 * texelFetch(iChannel2, clamp(ic - ivec2(0, 1), ivec2(0), hi), 0).xy;
    acc += texelFetch(iChannel2, clamp(ic + ivec2(1, 1), ivec2(0), hi), 0).xy;
    acc += texelFetch(iChannel2, clamp(ic + ivec2(-1, 1), ivec2(0), hi), 0).xy;
    acc += texelFetch(iChannel2, clamp(ic + ivec2(1, -1), ivec2(0), hi), 0).xy;
    acc += texelFetch(iChannel2, clamp(ic - ivec2(1, 1), ivec2(0), hi), 0).xy;
    vec2 d = mix(acc / 16.0, s, feed);
    fragColor = vec4(d, s);
}
