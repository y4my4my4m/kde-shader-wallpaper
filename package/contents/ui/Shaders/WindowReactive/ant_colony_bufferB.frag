// Ant Colony — Buffer B: nearest-ant tracking.
// @channels bufferA, self
//
// One texel per grid cell: ids + 1 of the four ants whose bodies pass
// closest to the cell centre, nearest first, 0 = none. Each update merges
// the cell's own list, the lists of its four edge neighbours and two random
// ants, so an ant's region spreads one cell per update and follows it as it
// walks (Shadertoy "voronoi particle tracking").
//
// iChannel0  Buffer A (this substep), iChannel1 this buffer.

// Distance from cell centre c to ant id's body axis, or 1e9 when the ant is
// out of sight (absent or in the nest).
float antDistance(int id, vec2 c)
{
    vec4 a = texelFetch(iChannel0, antTexel(id, 0), 0);
    if (modeOf(a.w) < MODE_SEARCH) return 1e9;
    vec2 ax = vec2(cos(a.z), sin(a.z)) * (0.3 * ANT_LEN);
    vec2 pa = c - a.xy;
    float h = clamp(dot(pa, ax) / dot(ax, ax), -1.0, 1.0);
    return length(pa - ax * h);
}

void consider(int id, vec2 c, inout ivec4 ids, inout vec4 ds)
{
    if (id < 0 || id == ids.x || id == ids.y || id == ids.z || id == ids.w) return;
    float d = antDistance(id, c);
    if (d >= ds.w) return;
    if (d < ds.x) {
        ds = vec4(d, ds.xyz);
        ids = ivec4(id, ids.xyz);
    } else if (d < ds.y) {
        ds = vec4(ds.x, d, ds.yz);
        ids = ivec4(ids.x, id, ids.yz);
    } else if (d < ds.z) {
        ds.zw = vec2(d, ds.z);
        ids.zw = ivec2(id, ids.z);
    } else {
        ds.w = d;
        ids.w = id;
    }
}

void considerList(vec4 list, vec2 c, inout ivec4 ids, inout vec4 ds)
{
    ivec4 l = ivec4(list + 0.5) - 1;
    consider(l.x, c, ids, ds);
    consider(l.y, c, ids, ds);
    consider(l.z, c, ids, ds);
    consider(l.w, c, ids, ds);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    vec4 own = texelFetch(iChannel1, ic, 0);
    if (!simStep()) {
        fragColor = own;
        return;
    }
    ivec2 hi = ivec2(iResolution.xy) - 1;
    vec2 c = (vec2(ic) + 0.5) / unitPx();
    ivec4 ids = ivec4(-1);
    vec4 ds = vec4(1e9);
    considerList(own, c, ids, ds);
    considerList(texelFetch(iChannel1, clamp(ic + ivec2(1, 0), ivec2(0), hi), 0), c, ids, ds);
    considerList(texelFetch(iChannel1, clamp(ic - ivec2(1, 0), ivec2(0), hi), 0), c, ids, ds);
    considerList(texelFetch(iChannel1, clamp(ic + ivec2(0, 1), ivec2(0), hi), 0), c, ids, ds);
    considerList(texelFetch(iChannel1, clamp(ic - ivec2(0, 1), ivec2(0), hi), 0), c, ids, ds);
    int n = antCount();
    uint h = hashu(uint(ic.x) * 73856093u ^ uint(ic.y) * 19349663u ^ uint(iFrame) * 83492791u);
    consider(int(hashu(h) % uint(n)), c, ids, ds);
    consider(int(hashu(h ^ 0x9e3779b9u) % uint(n)), c, ids, ds);
    fragColor = vec4(ids + 1);
}
