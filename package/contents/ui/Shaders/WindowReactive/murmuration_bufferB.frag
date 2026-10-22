// Murmuration — Buffer B: nearest-bird tracking.
// @channels bufferA, self
//
// One texel per grid cell: ids + 1 of the four birds whose drawn shapes
// reach closest to the cell centre, nearest first, 0 = none. Distance is
// measured from the shape's centre minus its reach, so a large near bird
// owns every cell it covers. Each step merges the cell's own list, the
// lists of its four edge neighbours and two random birds, so a bird's
// region spreads one cell per step and follows it as it flies (Shadertoy
// "voronoi particle tracking").
//
// iChannel0 Buffer A (this substep), iChannel1 this buffer.

int gN;
ivec4 gRej;    // the last four ids rejected, so repeats in neighbouring lists cost no fetch
int gRejN;

float birdDistance(int id, vec2 c)
{
    vec4 s0 = texelFetch(iChannel0, birdTexel(id, 0), 0);
    int m = modeOf(s0.w);
    if (m == M_NONE || m == M_HIDDEN) return 1e9;
    return distance(c, birdCentre(s0)) - birdReach(s0);
}

void consider(int id, vec2 c, inout ivec4 ids, inout vec4 ds)
{
    if (id < 0 || id >= gN || id == ids.x || id == ids.y || id == ids.z || id == ids.w) return;
    if (id == gRej.x || id == gRej.y || id == gRej.z || id == gRej.w) return;
    float d = birdDistance(id, c);
    if (d >= ds.w) {
        gRej[gRejN & 3] = id;
        gRejN++;
        return;
    }
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
    if (!simStep()) {
        fragColor = texelFetch(iChannel1, ic, 0);
        return;
    }
    ivec2 hi = ivec2(iResolution.xy) - 1;
    gN = birdCount(iResolution.y);
    vec2 c = (vec2(ic) + 0.5) / unitPx();
    ivec4 ids = ivec4(-1);
    vec4 ds = vec4(1e9);
    gRej = ivec4(-1);
    gRejN = 0;
    considerList(texelFetch(iChannel1, ic, 0), c, ids, ds);
    considerList(texelFetch(iChannel1, clamp(ic + ivec2(1, 0), ivec2(0), hi), 0), c, ids, ds);
    considerList(texelFetch(iChannel1, clamp(ic - ivec2(1, 0), ivec2(0), hi), 0), c, ids, ds);
    considerList(texelFetch(iChannel1, clamp(ic + ivec2(0, 1), ivec2(0), hi), 0), c, ids, ds);
    considerList(texelFetch(iChannel1, clamp(ic - ivec2(0, 1), ivec2(0), hi), 0), c, ids, ds);
    uint h = hashu(uint(ic.x) * 73856093u ^ uint(ic.y) * 19349663u ^ uint(iFrame) * 83492791u);
    consider(int(hashu(h) % uint(gN)), c, ids, ds);
    consider(int(hashu(h ^ 0x9e3779b9u) % uint(gN)), c, ids, ds);
    fragColor = vec4(ids + 1);
}
