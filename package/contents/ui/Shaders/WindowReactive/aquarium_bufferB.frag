// Aquarium — Buffer B: what each screen tile has to draw.
// @channels bufferA
// @substeps 1
//
// The texel at the lower-left corner of each tileSpan x tileSpan block holds
// the sets for the screen fraction the block covers; other texels are 0.
// Each channel holds a 24-bit set as an exact float integer; bit order is
// draw order:
//   x  fish 0..23     y  fish 24..47
//   z  flakes 0..23   w  bubbles 0..23
// Bounds assume the largest fish size the image pass offers (FISH_SCALE
// 1.6). Only the last substep of a frame computes the sets.

const float MAX_FISH_SCALE = 1.6;

// Radius around the body centre that holds the drawn fish, units of L.
float fishReach(int sp)
{
    if (sp == SP_ANGEL) return 0.95;
    if (sp == SP_PUFFER) return 0.85;
    if (sp == SP_SHRIMP) return 1.0;
    return 0.62;
}

bool overlaps(vec2 c, float r, vec2 lo, vec2 hi)
{
    return c.x + r > lo.x && c.x - r < hi.x && c.y + r > lo.y && c.y - r < hi.y;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    fragColor = vec4(0.0);
    if (iSubstep != iSubsteps - 1) return;
    int n = tileSpan(iResolution.y);
    ivec2 ic = ivec2(fragCoord);
    if (ic.x % n != 0 || ic.y % n != 0) return;
    float A = iResolution.x / iResolution.y;
    vec2 lo = vec2(ic) / iResolution.y;
    vec2 hi = lo + float(n) / iResolution.y;

    uint s0 = 0u;
    uint s1 = 0u;
    for (int i = 0; i < NFISH; i++) {
        vec4 p = texelFetch(iChannel0, ivec2(i, ROW_P), 0);
        float r = fishLen(i, A) * MAX_FISH_SCALE * fishReach(speciesOf(i));
        if (!overlaps(p.xy, r, lo, hi)) continue;
        if (i < 24) s0 |= 1u << uint(i);
        else s1 |= 1u << uint(i - 24);
    }
    uint s2 = 0u;
    float U = fishUnit(A);
    for (int j = 0; j < NFLAKE; j++) {
        vec4 f = texelFetch(iChannel0, ivec2(j, ROW_FLAKE), 0);
        if (f.w < 0.5 || f.z < 0.0) continue;
        // Floating flakes carry a surface ripple ring.
        float r = (f.w < 1.75 && f.y > SURFACE - 0.01) ? 0.035 : 0.009 * U;
        if (overlaps(f.xy, r, lo, hi)) s2 |= 1u << uint(j);
    }
    uint s3 = 0u;
    for (int k = 0; k < NBUB; k++) {
        vec4 b = texelFetch(iChannel0, ivec2(k, ROW_BUB), 0);
        if (b.w <= 0.0) continue;
        if (overlaps(b.xy, b.w + 0.004, lo, hi)) s3 |= 1u << uint(k);
    }
    fragColor = vec4(float(s0), float(s1), float(s2), float(s3));
}
