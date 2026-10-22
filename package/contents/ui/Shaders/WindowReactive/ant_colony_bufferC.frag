// Ant Colony — Buffer C: scent and walking-distance fields.
// @channels bufferA, bufferB, self
//
// One texel per grid cell:
//   x  "to food" scent, laid by ants carrying food home
//   y  "to home" scent, laid by searching ants
//   z  walking distance to the nest around windows, cells (FAR = cut off)
//   w  1 once initialised
// Scent diffuses, evaporates and is cleared under windows; window cells
// reflect diffusion, so no scent crosses them. The distance field is
// relaxed from the eight neighbours every step (Bellman-Ford), so it grows
// and shrinks as windows move, one cell per frame. Ants deposit through the
// nearest-ant lists of Buffer B.
//
// iChannel0  Buffer A, iChannel1 Buffer B (both this substep), iChannel2 this buffer.

const float FOOD_LIFE = 16.0;  // s for "to food" scent to fall to 1/e
const float HOME_LIFE = 30.0;  // s, "to home"
const float DIFFUSE   = 0.35;  // cells^2 / s
const float DEPOSIT   = 4.0;   // scent / s under an ant laying at full strength
const float CAP       = 1.0;

void deposit(float idf, vec2 c, float cell, inout vec2 add)
{
    int id = int(idf + 0.5) - 1;
    if (id < 0) return;
    vec4 a = texelFetch(iChannel0, antTexel(id, 0), 0);
    float w = max(1.0 - distance(c, a.xy) / (1.5 * cell), 0.0);
    if (w <= 0.0) return;
    int m = modeOf(a.w);
    float s = strengthOf(a.w) * w;
    if (m == MODE_SEARCH) add.y += s;
    else if (m == MODE_RETURN && carryOf(a.w) > 0) add.x += s;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    ivec2 hi = ivec2(iResolution.xy) - 1;
    float U = unitPx();
    float cell = 1.0 / U;
    vec2 c = (vec2(ic) + 0.5) * cell;
    vec2 nest = nestPos();
    float toNest = distance(c, nest) * U;
    float dt = simDt();

    vec4 s = texelFetch(iChannel2, ic, 0);
    if (!simStep()) {
        fragColor = s;
        return;
    }
    if (s.w < 0.5) {
        // Load: a trail to the first food and home scent around the nest.
        vec4 p0 = texelFetch(iChannel0, ivec2(0, PILE_ROW), 0);
        float trail = 0.0;
        if (p0.z > 0.5) {
            vec2 ab = p0.xy - nest;
            float h = clamp(dot(c - nest, ab) / dot(ab, ab), 0.0, 1.0);
            float d = distance(c, nest + ab * h) * U;
            trail = (0.1 + 0.6 * h) * exp(-d * d / 3.0);
        }
        s = vec4(trail, 0.4 * exp(-distance(c, nest) / 0.2), toNest, 1.0);
        fragColor = windowAt(c, 0.0) >= 0 ? vec4(0.0, 0.0, FAR, 1.0) : s;
        return;
    }

    if (windowAt(c, 0.0) >= 0) {
        fragColor = vec4(0.0, 0.0, FAR, 1.0);
        return;
    }

    vec4 nE = texelFetch(iChannel2, clamp(ic + ivec2(1, 0), ivec2(0), hi), 0);
    vec4 nW = texelFetch(iChannel2, clamp(ic - ivec2(1, 0), ivec2(0), hi), 0);
    vec4 nN = texelFetch(iChannel2, clamp(ic + ivec2(0, 1), ivec2(0), hi), 0);
    vec4 nS = texelFetch(iChannel2, clamp(ic - ivec2(0, 1), ivec2(0), hi), 0);
    vec4 nNE = texelFetch(iChannel2, clamp(ic + ivec2(1, 1), ivec2(0), hi), 0);
    vec4 nNW = texelFetch(iChannel2, clamp(ic + ivec2(-1, 1), ivec2(0), hi), 0);
    vec4 nSE = texelFetch(iChannel2, clamp(ic + ivec2(1, -1), ivec2(0), hi), 0);
    vec4 nSW = texelFetch(iChannel2, clamp(ic - ivec2(1, 1), ivec2(0), hi), 0);

    // Window cells (and the screen edge, by clamping) reflect.
    vec2 e = nE.z >= FAR || ic.x == hi.x ? s.xy : nE.xy;
    vec2 wv = nW.z >= FAR || ic.x == 0 ? s.xy : nW.xy;
    vec2 n = nN.z >= FAR || ic.y == hi.y ? s.xy : nN.xy;
    vec2 so = nS.z >= FAR || ic.y == 0 ? s.xy : nS.xy;
    vec2 xy = s.xy + 4.0 * DIFFUSE * dt * (0.25 * (e + wv + n + so) - s.xy);
    xy *= exp(-dt / vec2(FOOD_LIFE, HOME_LIFE));

    vec4 ids = texelFetch(iChannel1, ic, 0);
    vec2 add = vec2(0.0);
    deposit(ids.x, c, cell, add);
    deposit(ids.y, c, cell, add);
    deposit(ids.z, c, cell, add);
    deposit(ids.w, c, cell, add);
    xy = min(xy + DEPOSIT * dt * add, vec2(CAP));

    float nav = min(min(nE.z, nW.z), min(nN.z, nS.z)) + 1.0;
    nav = min(nav, min(min(nNE.z, nNW.z), min(nSE.z, nSW.z)) + 1.41421);
    if (toNest < 1.5) nav = toNest;
    fragColor = vec4(xy, min(nav, FAR), 1.0);
}
