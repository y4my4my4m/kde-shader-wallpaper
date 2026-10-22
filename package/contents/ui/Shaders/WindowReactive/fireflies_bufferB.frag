// Fireflies — Buffer B: firefly bins.
// @channels bufferA, self
//
// Bin (x, y), x < binCols, y < BINS_PER_H, covers the square
// [x, x+1] x [y, y+1] / BINS_PER_H (H units). It lists the ids + 1 of up to
// eight fireflies whose glow reaches the square, two per channel
// (a * 2048 + b), filled from the first channel on, 0 = none; ranked by the
// distance from the square to the firefly over its glow reach, so a crowd
// drops the faintest. Every other texel is zero.
//
// Lists are tracked, not gathered: each step a bin re-ranks the fireflies
// on its own list and on its four edge neighbours' lists, so a firefly's
// entry spreads one bin per step and follows it as it flies (Shadertoy
// "voronoi particle tracking"). New entries come from a sweep of four
// slots per step, from the fireflies of a jar opened nearby, and during
// the first second after a reset from a fast sweep over every slot.
//
// iChannel0  Buffer A (this substep), iChannel1 this buffer.

int ids[8];
float qs[8];
int worst;
vec2 gC;
int gSlots;
int gBase;
vec4 gG1;
vec4 gG2;

const float HB = 0.5 / BINS_PER_H;

void rankWorst()
{
    worst = 0;
    for (int k = 1; k < 8; k++) if (qs[k] > qs[worst]) worst = k;
}

void consider(int i)
{
    if (i < 0 || i >= gSlots) return;
    for (int k = 0; k < 8; k++) if (ids[k] == i) return;
    vec4 a = texelFetch(iChannel0, flyTexel(i, 0), 0);
    if (modeOf(a.w) == MODE_ABSENT) return;
    float reach = glowReach(layerOf(a.w), i, flashOf(a.z, i), sparkOf(jarAge(i, gBase, gG1, gG2)));
    vec2 d = max(abs(a.xy - gC) - HB, 0.0);
    float dd = dot(d, d);
    if (dd >= reach * reach) return;
    float q = sqrt(dd) / reach;
    if (q < qs[worst]) {
        qs[worst] = q;
        ids[worst] = i;
        rankWorst();
    }
}

void considerList(vec4 l)
{
    for (int k = 0; k < 4; k++) {
        float hi = floor(l[k] / 2048.0);
        consider(int(hi) - 1);
        consider(int(l[k] - hi * 2048.0) - 1);
    }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    float aspect = iResolution.x / iResolution.y;
    int cols = binCols(aspect);
    if (ic.x >= cols || ic.y >= int(BINS_PER_H)) {
        fragColor = vec4(0.0);
        return;
    }
    vec4 own = texelFetch(iChannel1, ic, 0);
    if (!simStep()) {
        fragColor = own;
        return;
    }

    gC = (vec2(ic) + 0.5) / BINS_PER_H;
    gSlots = slotCount(aspect);
    gBase = baseCount(aspect);
    gG1 = texelFetch(iChannel0, ivec2(1, GLOBAL_ROW), 0);
    gG2 = texelFetch(iChannel0, ivec2(2, GLOBAL_ROW), 0);
    for (int k = 0; k < 8; k++) {
        ids[k] = -1;
        qs[k] = 2.0;
    }
    worst = 0;

    ivec2 hi = ivec2(cols - 1, int(BINS_PER_H) - 1);
    considerList(own);
    considerList(texelFetch(iChannel1, clamp(ic + ivec2(1, 0), ivec2(0), hi), 0));
    considerList(texelFetch(iChannel1, clamp(ic - ivec2(1, 0), ivec2(0), hi), 0));
    considerList(texelFetch(iChannel1, clamp(ic + ivec2(0, 1), ivec2(0), hi), 0));
    considerList(texelFetch(iChannel1, clamp(ic - ivec2(0, 1), ivec2(0), hi), 0));

    vec4 g1 = gG1;
    vec4 g2 = gG2;
    int h = int(hashu(uint(ic.x) * 73856093u ^ uint(ic.y) * 19349663u) % 4096u);
    for (int k = 0; k < 4; k++) consider((iFrame * 4 + k + h) % gSlots);
    if (g2.w < 1.0) {
        for (int k = 0; k < 48; k++) consider((iFrame * 48 + k) % gSlots);
    }

    // A jar opened in the last 2.5 s: its fireflies, eight per step.
    if (g2.z < 2.5 && distance(gC, g2.xy) < 0.3 + 0.3 * g2.z) {
        int ring = int(g1.w + 0.5) + EXTRA_SLOTS - JAR_SIZE;
        int k0 = (iFrame % (JAR_SIZE / 8)) * 8;
        for (int k = 0; k < 8; k++) consider(gBase + (ring + k0 + k) % EXTRA_SLOTS);
    }

    // Pack the survivors contiguously.
    float v[8];
    int n = 0;
    for (int k = 0; k < 8; k++) v[k] = 0.0;
    for (int k = 0; k < 8; k++) {
        if (ids[k] < 0) continue;
        v[n] = float(ids[k] + 1);
        n++;
    }
    fragColor = vec4(v[0] * 2048.0 + v[1], v[2] * 2048.0 + v[3], v[4] * 2048.0 + v[5], v[6] * 2048.0 + v[7]);
}
