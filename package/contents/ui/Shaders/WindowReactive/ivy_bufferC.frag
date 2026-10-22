// Ivy — Buffer C: render hints and leaf rustle.
// @channels bufferA, bufferB, self
// @substeps 1
//
// Refreshed on the last step of each frame and copied through on the
// others. One texel per grid cell:
//   x  1 when a living or withering node lies within NODE_R of the cell
//   y  1 when a falling piece lies within DEBRIS_R of the cell
//   z  rustle of the leaves of the node in this cell, 0..1: set by the
//      cursor moving over bare desktop, decaying over about a second
//   w  1 when any cell of the 5x5 block has rustle
// The image pass searches the 5x5 block around each pixel's cell: x and
// y = 0 mean nothing reaches the cell, w = 0 means no rustle to look up.

vec2 S;
float fdt;
vec2 m0;
vec2 m1;
bool cursorFree;

float rustleAt(ivec2 c, float prev)
{
    float r = prev * exp(-fdt / 1.1);
    if (cursorFree) {
        vec2 q = vec2(c) + 0.5;
        vec2 ba = m1 - m0;
        float h = clamp(dot(q - m0, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        float d = length(q - m0 - ba * h);
        float speed = length(ba) / fdt;
        // A still cursor (also where it rests when mouse input is off) leaves
        // the leaves alone.
        float drive = smoothstep(2.8, 0.6, d) * (speed > 0.3 ? 0.1 + clamp(speed / 30.0, 0.0, 0.9) : 0.0);
        r = max(r, drive);
    }
    return r < 0.004 ? 0.0 : r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    vec2 res = iResolution.xy;
    ivec2 GR = gridSize(res);
    if (!inGrid(ic, GR)) {
        fragColor = vec4(0.0);
        return;
    }
    if (iSubstep != iSubsteps - 1) {
        fragColor = texelFetch(iChannel2, ic, 0);
        return;
    }
    S = vec2(1.0 / cellTexels(res));
    fdt = max(iTimeDelta * float(iSubsteps), 1e-4);
    m1 = iMouse.xy * S;
    m0 = iMousePrev * S;
    cursorFree = windowDist(m1, S) > 0.0;

    vec2 centre = vec2(ic) + 0.5;
    float vine = 0.0;
    float debris = 0.0;
    float gate = 0.0;
    float own = 0.0;
    for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
            ivec2 c = ic + ivec2(dx, dy);
            if (!inGrid(c, GR)) continue;
            vec4 a = texelFetch(iChannel0, c, 0);
            int k = fi(a.x) & 3;
            if (k == K_ALIVE || k == K_WITHER) {
                int g = fi(a.y);
                vec2 N = vec2(c) + (vec2(float(g & 127), float((g >> 7) & 127)) + 0.5) / 128.0;
                if (length(max(abs(N - centre) - 0.5, 0.0)) < NODE_R) vine = 1.0;
            }
            vec4 b = texelFetch(iChannel1, c, 0);
            if (b.w > 0.5) {
                int px = fi(b.x);
                vec2 P = vec2(c) + (vec2(float(px & 4095), float(px >> 12)) + 0.5) / 4096.0;
                if (length(max(abs(P - centre) - 0.5, 0.0)) < DEBRIS_R) debris = 1.0;
            }
            float r = rustleAt(c, texelFetch(iChannel2, c, 0).z);
            if (r > 0.0) gate = 1.0;
            if (dx == 0 && dy == 0) own = r;
        }
    }
    fragColor = vec4(vine, debris, own, gate);
}
