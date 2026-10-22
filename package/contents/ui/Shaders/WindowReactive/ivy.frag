// Ivy — living vines that climb your windows.
// @channels bufferA, tex1, bufferB, bufferC
// @sim-max-height 128
//
// Vines sprout along the bottom and sides of the screen and hang from its
// top. They follow window edges, climbing the sides, running along the tops
// and draping from the corners, and send curling tendrils across open space
// toward the nearest window. Leaves unfurl, age, yellow and fall; branches
// die back and regrow, so the desktop never overgrows. Morning glories open
// in the morning and furl in the evening; moonflowers open at night with a
// faint glow (local clock). Dragging a window tears off the vines clinging
// to it; the stump regrows toward the window's new place over the next
// minutes. Vines on windows that vanish (Show Desktop, minimise) wither
// instead if the windows stay away for a few seconds. Moving the cursor over
// the leaves rustles them; a click on bare desktop above the panel plants a
// seed that sprouts a new vine.
//
// iChannel0  Buffer A: the vines (layout in ivy_common.frag).
// iChannel1  Wallpaper ("Image 2" in the settings). Without one, a lime-washed
//            stone garden wall lit by the time of day.
// iChannel2  Buffer B: falling leaves, petals and torn pieces.
// iChannel3  Buffer C: render hints and leaf rustle.
//
// Growth speed and maximum coverage (share of the visible desktop cells
// vines may occupy) are shared with the buffer passes.
// Lengths are in cells (see ivy_common.frag).

const vec3  LEAF_COLOUR   = vec3(0.16, 0.34, 0.11); // @color @label("Leaf colour")
const vec3  FLOWER_COLOUR = vec3(0.40, 0.47, 0.97); // @color @label("Morning glory colour")
const float FLOWERS       = 1.0;  // @range(0.0, 1.0, 1.0) @label("Flowers")
const float LEAF_SIZE     = 1.0;  // @range(0.6, 1.2, 0.05) @label("Leaf size")
const float GROWTH        = 1.0;  // @range(0.2, 4.0, 0.05) @label("Growth speed") @shared
const float COVERAGE      = 0.15; // @range(0.03, 0.5, 0.01) @label("Coverage") @shared

// ------------------------------------------------------------- utilities

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), w.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), w.x), w.y);
}

float cross2(vec2 a, vec2 b)
{
    return a.x * b.y - a.y * b.x;
}

float smin(float a, float b, float k)
{
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Distance from p to the quadratic Bezier A-C-B drawn as two chords.
// t: curve parameter of the nearest point; tg: chord direction there;
// r: p minus the nearest point.
float bezDist(vec2 p, vec2 A, vec2 C, vec2 B, out float t, out vec2 tg, out vec2 r)
{
    vec2 M = 0.25 * A + 0.5 * C + 0.25 * B;
    vec2 pa = p - A;
    vec2 ba = M - A;
    float h1 = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    vec2 r1 = pa - ba * h1;
    vec2 pm = p - M;
    vec2 bm = B - M;
    float h2 = clamp(dot(pm, bm) / max(dot(bm, bm), 1e-8), 0.0, 1.0);
    vec2 r2 = pm - bm * h2;
    if (dot(r1, r1) < dot(r2, r2)) {
        t = 0.5 * h1;
        tg = ba;
        r = r1;
        return length(r1);
    }
    t = 0.5 + 0.5 * h2;
    tg = bm;
    r = r2;
    return length(r2);
}

// Exact distance from p to the quadratic Bezier A-C-B (Inigo Quilez, "2D
// distance functions", sdBezier), with the same outputs as bezDist. Falls
// back to bezDist for a nearly straight curve, where the cubic degenerates.
float bezExact(vec2 p, vec2 A, vec2 C, vec2 B, out float t, out vec2 tg, out vec2 r)
{
    vec2 a = C - A;
    vec2 b = A - 2.0 * C + B;
    if (dot(b, b) <= 1e-4 * dot(a, a) + 1e-12) return bezDist(p, A, C, B, t, tg, r);
    vec2 c = a * 2.0;
    vec2 d = A - p;
    float kk = 1.0 / dot(b, b);
    float kx = kk * dot(a, b);
    float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
    float kz = kk * dot(d, a);
    float pp = ky - kx * kx;
    float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
    float h = q * q + 4.0 * pp * pp * pp;
    if (h >= 0.0) {
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
        t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
    } else {
        float z = sqrt(-pp);
        float v = acos(clamp(q / (pp * z * 2.0), -1.0, 1.0)) / 3.0;
        float m = cos(v);
        float n = sin(v) * 1.732050808;
        vec2 tt = clamp(vec2(m + m, -n - m) * z - kx, 0.0, 1.0);
        vec2 r0 = d + (c + b * tt.x) * tt.x;
        vec2 r1 = d + (c + b * tt.y) * tt.y;
        t = dot(r0, r0) < dot(r1, r1) ? tt.x : tt.y;
    }
    r = -(d + (c + b * t) * t);
    tg = a + b * t;
    return length(r);
}

float segDist(vec2 p, vec2 a, vec2 b, out float h)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    return length(pa - ba * h);
}

// ------------------------------------------------------------- light

struct Sky {
    vec3 tint;     // light colour on the wall and the vines
    float day;     // 1 by day, 0 at night
    vec2 shadow;   // shadow offset on the wall, cells
    vec3 L;        // direction toward the light
};

Sky skyAt(float hr)
{
    Sky s;
    s.day = smoothstep(5.0, 7.5, hr) * (1.0 - smoothstep(18.0, 20.5, hr));
    float gold = clamp(exp(-pow((hr - 18.3) / 1.2, 2.0)) + 0.7 * exp(-pow((hr - 6.9) / 1.0, 2.0)), 0.0, 1.0);
    vec3 dayC = mix(vec3(1.0, 0.985, 0.95), vec3(1.05, 0.91, 0.76), gold);
    s.tint = mix(vec3(0.40, 0.45, 0.63), dayC, s.day);
    // Sun on the left in the morning, on the right in the evening; the moon
    // stands high.
    float sx = mix(-0.25, clamp((13.0 - hr) / 6.0, -1.0, 1.0), s.day);
    s.shadow = vec2(0.13 * sx, -0.17);
    s.L = normalize(vec3(-0.6 * sx - 0.15, 0.62, 0.8));
    return s;
}

// The desktop behind the vines: the wallpaper, cover-fitted, or a lime
// plastered garden wall with dappled light by day.
vec3 backdrop(vec2 fc, Sky sk, bool wallpaper)
{
    vec2 uv = fc / iResolution.xy;
    if (wallpaper) {
        vec2 texRes = iChannelResolution[1].xy;
        float sa = iResolution.x / iResolution.y;
        float ta = texRes.x / texRes.y;
        vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
        return texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
    }
    vec2 q = fc / min(iResolution.x, iResolution.y);
    float n1 = vnoise(q * 2.2 + 3.1);
    float n2 = vnoise(q * 6.3 + 7.7);
    float n3 = vnoise(q * 34.0);
    vec3 col = vec3(0.86, 0.82, 0.74);
    col *= 0.95 + 0.05 * n1 + 0.025 * n2 + 0.02 * n3;
    // Faint courses of dressed stone under the lime wash, 0.12 of the short
    // side tall; each course is shifted by a random fraction of a block.
    vec2 b = q / vec2(0.26, 0.12);
    b.x += hash12(vec2(floor(b.y), 7.0));
    vec2 jb = abs(fract(b) - 0.5) * vec2(0.26, 0.12);
    float edge = min(0.13 - jb.x, 0.06 - jb.y) + 0.004 * (n3 - 0.5) + 0.003 * (n2 - 0.5);
    float joint = 1.0 - smoothstep(0.001, 0.005, edge);
    col *= 1.0 - 0.03 * joint * (0.6 + 0.4 * n2);
    col *= 1.0 + 0.025 * (hash12(floor(b)) - 0.5);
    col = mix(col, col * vec3(1.02, 1.0, 0.95), smoothstep(0.3, 0.8, n1));
    // Broad light from above, falling off toward the ground.
    col *= 0.88 + 0.13 * smoothstep(-0.1, 1.0, uv.y);
    float t = mod(iTime, 3600.0);
    float dap = vnoise(q * 3.1 + vec2(t * 0.011, t * 0.004)) * vnoise(q * 6.7 - vec2(t * 0.008, 0.0));
    col *= 1.0 + 0.045 * sk.day * smoothstep(0.22, 0.45, dap);
    return col * sk.tint;
}

// ------------------------------------------------------------- shapes

// Tapered capsule from pa (radius ra) to pb (radius rb) (Inigo Quilez,
// "2D distance functions", sdUnevenCapsule).
float sdUCap(vec2 p, vec2 pa, vec2 pb, float ra, float rb)
{
    p -= pa;
    pb -= pa;
    float h = dot(pb, pb);
    vec2 q = vec2(dot(p, vec2(pb.y, -pb.x)), dot(p, pb)) / h;
    q.x = abs(q.x);
    float b = ra - rb;
    vec2 c = vec2(sqrt(h - b * b), b);
    float k = cross2(c, q);
    float m = dot(c, q);
    float n = dot(q, q);
    if (k < 0.0) return sqrt(h * n) - ra;
    if (k > c.x) return sqrt(max(h * (n + 1.0 - 2.0 * q.y), 0.0)) - rb;
    return m - ra;
}

// Leaf coordinates: petiole at the origin, tip at (1, 0).
// Ivy: three pointed lobes and two small basal ones; v varies the lobing.
float ivyLeaf(vec2 q, float v)
{
    q.y = abs(q.y);
    v *= 0.6;
    float t = sdUCap(q, vec2(0.33, 0.0), vec2(0.98, 0.0), mix(0.35, 0.40, v), 0.035);
    float l = sdUCap(q, vec2(0.33, 0.0), vec2(mix(0.47, 0.52, v), mix(0.48, 0.42, v)), mix(0.28, 0.30, v), 0.035);
    float b = sdUCap(q, vec2(0.26, 0.0), vec2(0.04, 0.33), 0.21, 0.035);
    float d = smin(smin(t, l, mix(0.11, 0.15, v)), b, 0.11);
    return max(d, 0.045 - length(q + vec2(0.035, 0.0)));
}

// Heart-shaped leaf with a drawn-out tip (after Inigo Quilez's sdHeart).
float heartLeaf(vec2 q)
{
    float t = clamp((q.x - 0.3) / 0.7, 0.0, 1.0);
    vec2 h = vec2(abs(q.y) * (1.25 + 0.9 * t * sqrt(t)), (1.0 - q.x) * 0.92 + 0.08);
    float d;
    if (h.y + h.x > 1.0) {
        d = length(h - vec2(0.25, 0.75)) - 0.35355;
    } else {
        vec2 a = h - vec2(0.0, 1.0);
        vec2 b = h - 0.5 * max(h.x + h.y, 0.0);
        d = sqrt(min(dot(a, a), dot(b, b))) * sign(h.x - h.y);
    }
    return d * 0.75;
}

// Palmate veins from the petiole; 1 on a vein.
float veins(vec2 q, bool heart, float len, float px)
{
    vec2 b = q - vec2(0.02, 0.0);
    float r = length(b);
    float a = abs(atan(b.y, b.x));
    // Veins bow toward the tip.
    a += 0.22 * r * smoothstep(0.1, 1.2, a);
    float d = a * r;
    if (heart) {
        d = min(d, abs(a - 0.62) * r);
        d = min(d, abs(a - 1.25) * r);
    } else {
        d = min(d, abs(a - 0.80) * r);
        d = min(d, abs(a - 1.50) * r);
    }
    float w = (0.012 + 0.016 * max(1.0 - r, 0.0)) * len;
    float aa = px * 0.7;
    return (1.0 - smoothstep(w - aa, w + aa, d * len)) * smoothstep(0.95, 0.35, r);
}

// ------------------------------------------------------------- colour

vec3 leafBase(int species, float h, float phase, float grow, float wither)
{
    vec3 c = LEAF_COLOUR;
    if (species == S_IVY2) c *= vec3(0.78, 0.9, 1.08);
    // Heart-leaved climbers are lighter and softer than ivy.
    if (species >= S_GLORY) c = c * vec3(1.3, 1.25, 1.15) + 0.02;
    c *= 0.84 + 0.32 * h;
    c.r += (fract(h * 7.31) - 0.5) * 0.04;
    // Young ivy leaves are bronzed, young heart leaves pale.
    float young = 1.0 - smoothstep(0.2, 1.0, grow);
    vec3 cy = species < S_GLORY ? c * 1.25 + vec3(0.14, 0.04, 0.0) : c * 1.45 + vec3(0.05, 0.06, 0.0);
    c = mix(c, cy, 0.6 * young);
    c = mix(c, vec3(0.80, 0.66, 0.16), smoothstep(0.875, 0.92, phase));
    c = mix(c, vec3(0.56, 0.34, 0.12), 0.8 * smoothstep(0.915, LEAF_FALL, phase));
    c = mix(c, vec3(0.50, 0.38, 0.21), wither);
    return c;
}

// Lit leaf colour at leaf coordinates q (d: shape distance there). The two
// halves fold up from the midrib and the blade arches toward its edges.
// flip < 0 shows the paler underside.
vec3 shadeLeaf(vec2 q, float d, float ang, vec3 base, bool heart, float len, float px,
               Sky sk, float flip)
{
    float s = q.y >= 0.0 ? 1.0 : -1.0;
    vec3 nl = normalize(vec3(-0.3 * (q.x - 0.45), 0.34 * s + 0.75 * q.y, 1.0));
    vec2 u = dirOf(ang);
    vec3 n = vec3(u * nl.x + vec2(-u.y, u.x) * (nl.y * sign(flip)), nl.z);
    float diff = max(dot(n, sk.L), 0.0);
    vec3 col = base * (0.45 + 0.75 * diff);
    if (flip < 0.0) col = mix(col, base * 1.25 + 0.05, 0.5);
    float vn = veins(q, heart, len, px);
    col = mix(col, base * 1.55 + vec3(0.07, 0.08, 0.03), vn * (heart ? 0.3 : 0.55));
    col *= 1.0 - 0.25 * smoothstep(-0.1, 0.0, d);
    col *= 0.82 + 0.18 * smoothstep(-0.05, 0.4, q.x);
    vec3 hv = normalize(sk.L + vec3(0.0, 0.0, 1.0));
    float sp = pow(max(dot(n, hv), 0.0), 26.0) * (heart ? 0.12 : 0.3) * (0.4 + 0.6 * sk.day);
    return col * sk.tint + sp * vec3(0.9, 0.95, 0.85);
}

// ------------------------------------------------------------- flowers

// Flower seen from the front: a tilted funnel when open, a twisted bud when
// furled. F: centre, radius, facing angle (flowerOf); o: opening 0..1.
// Returns colour and coverage; glow gets the moonflower's night light.
vec4 flowerAt(vec2 p, vec4 F, int species, float o, float h, float px, Sky sk, inout vec3 glow)
{
    vec2 d = p - F.xy;
    float R = max(F.z, 1e-3);
    if (dot(d, d) > 2.6 * R * R + 0.1) return vec4(0.0);
    bool moon = species == S_MOON;
    vec3 rim = moon ? vec3(0.96, 0.96, 0.92) : FLOWER_COLOUR;
    vec4 outc = vec4(0.0);

    // Bud: points away from the node, twisted stripes.
    float shut = 1.0 - smoothstep(0.12, 0.5, o);
    if (shut > 0.0) {
        vec2 u = dirOf(F.w);
        vec2 l = vec2(dot(d, u), dot(d, vec2(-u.y, u.x))) / R;
        float x = l.x + 0.6;
        float wid = 0.42 * sqrt(max(x, 0.0)) * max(1.0 - x / 1.5, 0.0) + 0.03;
        float sd = max(abs(l.y) - wid, max(-x, x - 1.5)) * R * 0.8;
        float a = smoothstep(px, -px, sd) * shut;
        if (a > 0.0) {
            float stripe = 0.5 + 0.5 * sin((x * 6.0 + l.y * 22.0) * 1.0);
            vec3 bc = mix(rim * 0.8, rim * 1.1 + 0.08, stripe * 0.6);
            bc = mix(vec3(0.30, 0.45, 0.16), bc, smoothstep(0.15, 0.5, x));
            bc *= 0.75 + 0.35 * smoothstep(-0.3, 0.3, l.y);
            outc = vec4(bc * sk.tint, a);
        }
    }

    // Open funnel.
    float k = smoothstep(0.08, 0.95, o);
    if (k > 0.0) {
        float ta = h * TAU;
        vec2 u = vec2(cos(ta), sin(ta));
        vec2 l = vec2(dot(d, u), dot(d, vec2(-u.y, u.x)));
        l.x /= mix(0.7, 1.0, fract(h * 7.3));
        float rr = length(l) / R;
        float a = atan(l.y, l.x);
        float a0 = h * 9.0 + (1.0 - o) * 1.4;
        float c5 = cos(5.0 * (a - a0));
        float rad = (0.25 + 0.75 * k) * (1.0 - 0.06 * (0.5 - 0.5 * c5)
                    - (1.0 - k) * 0.3 * (0.5 + 0.5 * sin(5.0 * (a - a0))));
        float sd = (rr - rad) * R;
        float a2 = smoothstep(px, -px, sd);
        if (a2 > 0.0) {
            float rn = rr / max(rad, 1e-3);
            vec3 throat = moon ? vec3(0.86, 0.92, 0.66) : vec3(0.99, 0.95, 0.74);
            vec3 inner = moon ? vec3(0.97, 0.98, 0.94) : mix(vec3(0.97, 0.97, 1.0), rim, 0.25);
            vec3 col = mix(throat, inner, smoothstep(0.06, 0.24, rn));
            col = mix(col, rim, smoothstep(0.22, 0.7, rn) * (moon ? 0.4 : 1.0));
            float rib = pow(max(c5, 0.0), 10.0) * smoothstep(0.12, 0.4, rn);
            vec3 ribC = moon ? vec3(0.82, 0.88, 0.70) : mix(rim, vec3(0.97, 0.9, 1.0), 0.55);
            col = mix(col, ribC, rib * 0.55);
            col *= 0.9 + 0.1 * c5;
            col *= 0.78 + 0.22 * smoothstep(0.0, 0.3, rn);
            // The funnel slopes up from the throat toward the light.
            vec2 dirN = l / max(length(l), 1e-4);
            vec3 n = normalize(vec3(-dirN * 0.45 * smoothstep(0.0, 0.7, rn), 1.0));
            col *= 0.72 + 0.4 * max(dot(n, sk.L), 0.0);
            col *= 1.0 - 0.18 * smoothstep(-0.07, 0.0, sd / R);
            vec3 lit = col * sk.tint;
            if (moon) lit = mix(lit, col * 0.95, 0.55 * (1.0 - sk.day));
            outc = vec4(mix(outc.rgb, lit, a2), max(outc.a, a2));
        }
        if (moon) {
            float rr2 = length(d) / R;
            glow += vec3(0.75, 0.85, 1.0) * (0.24 * k * (1.0 - sk.day) * exp(-rr2 * 1.4));
        }
    }
    return outc;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float hr = mod(iDate.w / 3600.0, 24.0);
    Sky sk = skyAt(hr);
    bool wallpaper = iChannelResolution[1].x > 0.0;
    vec3 bg = backdrop(fragCoord, sk, wallpaper);
    if (wallpaper) sk.tint = mix(vec3(1.0), sk.tint, 0.55);

    vec2 simRes = iChannelResolution[0].xy;
    if (simRes.x < 8.0) {
        fragColor = vec4(bg, 1.0);
        return;
    }
    float ct = cellTexels(simRes);
    vec2 toCell = simRes / (iResolution.xy * ct);
    vec2 p = fragCoord * toCell;
    float px = toCell.y;
    float aa = 0.75 * px;
    ivec2 G = gridSize(simRes);
    vec2 W = worldSize(simRes);
    ivec2 pc = ivec2(floor(p));
    vec4 hint = texelFetch(iChannel3, clamp(pc, ivec2(0), G - 1), 0);
    if (hint.x < 0.5 && hint.y < 0.5) {
        fragColor = vec4(bg, 1.0);
        return;
    }

    float T = mod(iTime, 3600.0);
    vec2 shOff = sk.shadow;
    float shK = mix(0.24, 0.42, sk.day);
    bool flowersOn = FLOWERS > 0.5;

    float stemSd = 1e9;
    vec3 stemCol = vec3(0.0);
    float stemSh = 0.0;
    vec3 Lc = vec3(0.0);
    float La = 0.0;
    float baseSh = 1.0;
    vec3 glow = vec3(0.0);

    // Farthest any part of a node draws from it: the leaf with its shadow, or
    // the stem back to the parent.
    float reach = max(1.65, 1.14 * 1.42 * LEAF_SIZE + 0.27);
    float reach2 = reach * reach;
    if (hint.x > 0.5) {
        for (int dy = -2; dy <= 2; dy++) {
            for (int dx = -2; dx <= 2; dx++) {
                ivec2 c = pc + ivec2(dx, dy);
                if (!inGrid(c, G)) continue;
                vec4 raw = texelFetch(iChannel0, c, 0);
                int kd = fi(raw.x) & 3;
                if (kd != K_ALIVE && kd != K_WITHER) continue;
                Node n = decodeNode(raw);
                vec2 N = vec2(c) + n.pos;
                vec2 dN = p - N;
                if (dot(dN, dN) > reach2) continue;
                float wf = kd == K_WITHER ? clamp(n.age / WITHER_T, 0.0, 1.0) : 0.0;
                float fade = 1.0 - smoothstep(0.5, 1.0, wf);
                uint key = cellKey(c);
                float hN = keyHash(key, 60);
                vec2 P = N;
                float bend = 0.0;
                if (n.pdir > 0) {
                    P = parentPos(n, c);
                    bend = arcBend(P, N, n.tau);
                }
                float te = n.tau + 2.0 * bend;

                // Stem.
                float w0 = n.order == 0 ? 0.08 : (n.order == 1 ? 0.062 : 0.05);
                if (n.role == R_TENDRIL) w0 = mix(0.03, 0.05, smoothstep(30.0, 200.0, n.age));
                float wN = w0 * (0.5 + 0.6 * (1.0 - exp(-n.age / 400.0))) * (1.0 - wf);
                vec3 sc = mix(vec3(0.33, 0.46, 0.17), vec3(0.37, 0.28, 0.20),
                              smoothstep(30.0, 300.0, n.age) * (n.role == R_TENDRIL ? 0.15 : 1.0));
                sc = mix(sc, vec3(0.45, 0.40, 0.33), wf);
                vec2 A = N;
                vec2 C = N;
                vec2 E = N;
                float wA = wN;
                float wE = wN;
                bool hasStem = false;
                if (n.pdir > 0) {
                    vec2 Cc = P + dirOf(n.tau) * (0.5 * length(N - P) / cos(bend));
                    float e = kd == K_ALIVE ? smoothstep(0.0, 1.0, n.age) : 1.0;
                    A = P;
                    C = mix(P, Cc, e);
                    E = mix(C, mix(Cc, N, e), e);
                    wA = wN * 1.12 + 0.004 * (1.0 - wf);
                    wE = mix(wA, wN, e) * mix(0.6, 1.0, e);
                    hasStem = e > 0.02;
                } else if (!n.seed) {
                    // Root: the stem comes from behind a screen edge or a
                    // window.
                    vec2 back = vec2(0.0);
                    if (N.y < 2.2 || N.x < 2.2 || N.x > W.x - 2.2 || N.y > W.y - 2.2) {
                        back = -dirOf(te);
                    } else if (n.attached) {
                        float best = 1e9;
                        for (int i = 0; i < iWindowCount && i < 16; i++) {
                            if (!winValid(i)) continue;
                            vec2 nr;
                            float dw = boxDist(N, winBox(i, toCell), nr);
                            if (dw < best) {
                                best = dw;
                                back = -nr;
                            }
                        }
                    }
                    if (back != vec2(0.0)) {
                        A = N + back * 1.8;
                        C = 0.5 * (A + N);
                        E = N;
                        wA = wN * 1.2;
                        hasStem = true;
                    }
                }
                vec2 bmin = min(min(A, C), E) - 0.35;
                vec2 bmax = max(max(A, C), E) + 0.35;
                if (hasStem && all(greaterThan(p, bmin)) && all(lessThan(p, bmax))) {
                    float t;
                    vec2 tg;
                    vec2 rr;
                    float d = bezExact(p, A, C, E, t, tg, rr);
                    float w = mix(wA, wE, t);
                    float sd = d - w;
                    if (sd < stemSd && sd < aa) {
                        float across = clamp(cross2(normalize(tg), rr) / max(w, 1e-4), -1.0, 1.0);
                        vec2 tn = normalize(tg);
                        vec3 n3 = vec3(vec2(-tn.y, tn.x) * across, sqrt(1.0 - across * across));
                        float diff = max(dot(n3, sk.L), 0.0);
                        stemCol = sc * (0.42 + 0.78 * diff) * sk.tint;
                    }
                    stemSd = min(stemSd, sd);
                    if (sd < 0.32) {
                        float ds = bezDist(p - shOff, A, C, E, t, tg, rr);
                        stemSh = max(stemSh, 1.0 - smoothstep(w - 0.02, w + 0.1, ds));
                    }
                }
                if (n.seed && n.pdir == 0) {
                    // Planted seed, with a ring that spreads as it lands.
                    vec2 u = dirOf(te + 1.2);
                    vec2 l = vec2(dot(dN, u), dot(dN, vec2(-u.y, u.x)));
                    float sd = length(l / vec2(0.2, 0.13)) - 1.0;
                    sd *= 0.13;
                    if (sd < stemSd && sd < aa) {
                        float hi = smoothstep(0.1, -0.05, l.y) * smoothstep(0.2, -0.1, l.x);
                        stemCol = mix(vec3(0.36, 0.24, 0.13), vec3(0.6, 0.45, 0.3), hi * 0.6) * sk.tint;
                    }
                    stemSd = min(stemSd, sd);
                    float ring = abs(length(dN) - (0.25 + n.age * 1.3)) - 0.03;
                    float ra = (1.0 - smoothstep(0.0, 1.2, n.age)) * smoothstep(aa, -aa, ring);
                    glow += vec3(0.5, 0.75, 0.3) * 0.5 * ra;
                }
                if (n.role == R_TENDRIL && n.children == 0 && kd == K_ALIVE) {
                    // Curl at the searching tip: two arcs of shrinking radius.
                    float e = smoothstep(0.3, 2.5, n.age);
                    float side = hN < 0.5 ? 1.0 : -1.0;
                    vec2 tt = dirOf(te);
                    vec2 nn = vec2(-tt.y, tt.x) * side;
                    float r1 = 0.2;
                    vec2 c1 = N + nn * r1;
                    vec2 q1 = p - c1;
                    float a1 = atan(q1.y, q1.x);
                    float start = atan(-nn.y, -nn.x);
                    float rel = mod((a1 - start) * side, TAU);
                    float sw = 3.6 * e;
                    float dc = rel < sw ? abs(length(q1) - r1 * (1.0 - 0.45 * rel / 3.6))
                                        : length(p - N);
                    float sdc = dc - wN * (1.0 - 0.5 * rel / 3.6);
                    if (sdc < stemSd && sdc < aa) stemCol = vec3(0.42, 0.56, 0.22) * (0.6 + 0.4 * sk.day) * sk.tint;
                    stemSd = min(stemSd, sdc);
                }

                // Leaf.
                Leaf lf;
                if (leafOf(n, c, key, N, te, lf)) {
                    float len = lf.len * LEAF_SIZE;
                    float sway = 0.05 * sin(T * 1.3 + N.x * 0.31 + N.y * 0.17 + hN * 3.0)
                               * (0.6 + 0.4 * sin(T * 0.21 + N.x * 0.05));
                    if (hint.w > 0.5) {
                        float r = texelFetch(iChannel3, c, 0).z;
                        sway += r * (0.3 * sin(T * 11.0 + hN * 40.0) + 0.12 * lf.side);
                    }
                    float ang = lf.ang + sway;
                    vec2 u = dirOf(ang);
                    vec2 v = vec2(-u.y, u.x);
                    vec2 base = N + u * (PETIOLE * len);
                    vec2 ctr = base + u * (0.5 * len);
                    float lreach = 0.62 * len + 0.25;
                    vec2 rc = p - ctr;
                    if (dot(rc, rc) < lreach * lreach) {
                        bool heart = n.species >= S_GLORY;
                        float bendL = (keyHash(key, 61) - 0.5) * 0.3;
                        vec2 rb = p - base;
                        vec2 q = vec2(dot(rb, u), dot(rb, v)) / len;
                        q.y -= bendL * q.x * q.x;
                        float d = heart ? heartLeaf(q) : ivyLeaf(q, keyHash(key, 62));
                        float a = smoothstep(aa, -aa, d * len) * fade;
                        // Shadow on everything under this leaf.
                        vec2 rs = rb - shOff;
                        vec2 qs = vec2(dot(rs, u), dot(rs, v)) / len;
                        float es = length((qs - vec2(0.47, 0.0)) / vec2(0.56, 0.46));
                        float s = (1.0 - smoothstep(0.45, 1.15, es)) * fade * shK;
                        Lc *= 1.0 - s;
                        baseSh *= 1.0 - s;
                        // Petiole.
                        float hp;
                        float dp = segDist(p, N, base + u * (0.06 * len), hp) - (0.014 + 0.01 * len);
                        float ap = smoothstep(aa, -aa, dp) * fade;
                        if (ap > 0.0) {
                            vec3 pcol = mix(sc, vec3(0.38, 0.24, 0.17), 0.35) * (0.7 + 0.3 * sk.day) * sk.tint;
                            Lc = pcol * ap + Lc * (1.0 - ap);
                            La = ap + La * (1.0 - ap);
                        }
                        if (a > 0.0) {
                            vec3 b = leafBase(n.species, keyHash(key, 63), lf.phase, lf.grow, wf);
                            vec3 col = shadeLeaf(q, d, ang, b, heart, len, px, sk, 1.0);
                            Lc = col * a + Lc * (1.0 - a);
                            La = a + La * (1.0 - a);
                        }
                    }
                }

                // Flower.
                if (flowersOn && hasFlower(n, key)) {
                    vec4 F = flowerOf(n, c, key, N, te);
                    float o = flowerOpen(n.species, hr, key) * (1.0 - wf);
                    // Stalk from the node.
                    float hs;
                    float dst = segDist(p, N, F.xy, hs) - 0.018;
                    float ast = smoothstep(aa, -aa, dst) * fade * step(0.05, F.z);
                    if (ast > 0.0) {
                        vec3 scol = vec3(0.32, 0.46, 0.17) * (0.7 + 0.3 * sk.day) * sk.tint;
                        Lc = scol * ast + Lc * (1.0 - ast);
                        La = ast + La * (1.0 - ast);
                    }
                    vec4 fc = flowerAt(p, F, n.species, o, keyHash(key, 64), px, sk, glow);
                    fc.a *= fade;
                    if (fc.a > 0.0) {
                        vec2 fs = p - shOff - F.xy;
                        float s = (1.0 - smoothstep(0.5, 1.2, length(fs) / max(F.z, 1e-3))) * shK * 0.8
                                * smoothstep(0.1, 0.6, o);
                        Lc *= 1.0 - s;
                        baseSh *= 1.0 - s;
                        Lc = fc.rgb * fc.a + Lc * (1.0 - fc.a);
                        La = fc.a + La * (1.0 - fc.a);
                    }
                }
            }
        }
    }

    vec3 col = bg * (1.0 - shK * stemSh);
    col = mix(col, stemCol, smoothstep(aa, -aa, stemSd));
    col *= baseSh;
    col = col * (1.0 - La) + Lc;

    // Falling pieces, over everything.
    if (hint.y > 0.5) {
        for (int dy = -2; dy <= 2; dy++) {
            for (int dx = -2; dx <= 2; dx++) {
                ivec2 c = pc + ivec2(dx, dy);
                if (!inGrid(c, G)) continue;
                vec4 raw = texelFetch(iChannel2, c, 0);
                if (raw.w < 0.5) continue;
                int bits = fi(raw.w);
                int kind = bits & 3;
                int px2 = fi(raw.x);
                vec2 P = vec2(c) + (vec2(float(px2 & 4095), float(px2 >> 12)) + 0.5) / 4096.0;
                float age = raw.z;
                vec2 dP = p - P;
                if (dot(dP, dP) > DEBRIS_R * DEBRIS_R) continue;
                int species = (bits >> 2) & 3;
                float tint = float((bits >> 4) & 15) / 15.0;
                float a0 = float((bits >> 8) & 63) * (TAU / 64.0);
                float sd = float((bits >> 20) & 15) / 15.0;
                float spin = (sd - 0.5) * (kind == 1 ? 5.0 : 2.4);
                float ang = a0 + spin * age;
                float tumble = cos(age * (1.4 + 1.6 * sd));
                float fadeD = 1.0 - smoothstep(34.0, 40.0, age);
                if (kind == 3) {
                    if (!flowersOn) continue;
                    // Petal: a rounded wedge in the flower's colour.
                    vec2 u = dirOf(ang);
                    vec2 l = vec2(dot(dP, u), dot(dP, vec2(-u.y, u.x)));
                    l.y /= max(abs(tumble), 0.25);
                    // Wider at the rim end (+x), narrowing to the throat.
                    float wdt = 0.17 + 0.07 * clamp(l.x / 0.3, -1.0, 1.0);
                    float dd = length(vec2(l.x / 0.3, l.y / wdt)) - 1.0;
                    float a = smoothstep(px, -px, dd * 0.18) * fadeD;
                    vec2 ls = dP - shOff * 2.5;
                    float s = (1.0 - smoothstep(0.05, 0.45, length(ls))) * 0.2 * fadeD;
                    col *= 1.0 - s;
                    vec3 pcol = species == S_MOON ? vec3(0.96, 0.96, 0.92) : FLOWER_COLOUR;
                    pcol = mix(pcol, vec3(0.97, 0.95, 0.85), smoothstep(0.05, -0.3, l.x) * 0.6);
                    pcol *= (0.82 + 0.25 * smoothstep(-0.3, 0.3, l.x)) * (tumble < 0.0 ? 0.85 : 1.0);
                    col = mix(col, pcol * sk.tint, a);
                    continue;
                }
                float lenL = (0.7 + 0.1 * float((bits >> 17) & 7)) * LEAF_SIZE;
                bool heart = species >= S_GLORY;
                vec3 b = leafBase(species, sd, 0.8 + 0.14 * tint, 1.0, 0.0);
                vec2 u = dirOf(ang);
                vec2 v = vec2(-u.y, u.x);
                if (kind == 2) {
                    // Leaf, tumbling about its centre.
                    vec2 base = P - u * (0.5 * lenL);
                    vec2 rb = p - base;
                    vec2 q = vec2(dot(rb, u), dot(rb, v)) / lenL;
                    q.y /= max(abs(tumble), 0.12);
                    float d = heart ? heartLeaf(q) : ivyLeaf(q, sd);
                    float a = smoothstep(aa, -aa, d * lenL * max(abs(tumble), 0.12)) * fadeD;
                    vec2 rs = rb - shOff * 2.5;
                    vec2 qs = vec2(dot(rs, u), dot(rs, v)) / lenL;
                    float s = (1.0 - smoothstep(0.4, 1.3, length((qs - vec2(0.47, 0.0)) / vec2(0.6, 0.5 * abs(tumble) + 0.1))))
                            * 0.3 * fadeD;
                    col *= 1.0 - s;
                    if (a > 0.0) col = mix(col, shadeLeaf(q, d, ang, b, heart, lenL, px, sk, tumble), a);
                } else {
                    // Torn stem piece: a curved stub of stem with its leaf.
                    float hs;
                    vec2 tg;
                    vec2 rr;
                    float wS = 0.055;
                    vec2 s0 = P - u * 0.5 + v * 0.08;
                    vec2 s1 = P + u * 0.4 + v * 0.08;
                    float dsg = bezDist(p, s0, P, s1, hs, tg, rr) - wS * (1.0 - 0.35 * hs);
                    float dss = bezDist(p - shOff * 2.5, s0, P, s1, hs, tg, rr) - wS;
                    float s = (1.0 - smoothstep(-0.02, 0.14, dss)) * 0.22;
                    col *= 1.0 - s * fadeD;
                    vec3 stc = mix(vec3(0.33, 0.44, 0.18), vec3(0.38, 0.30, 0.20), sd);
                    col = mix(col, stc * (0.7 + 0.3 * sk.day) * sk.tint, smoothstep(aa, -aa, dsg) * fadeD);
                    if (((bits >> 15) & 1) != 0 && flowersOn) {
                        // The flower it carried, crumpled.
                        vec2 fq = p - (P - v * 0.4 + u * 0.1);
                        fq = vec2(dot(fq, u), dot(fq, v) / max(abs(tumble), 0.3));
                        float fr = length(fq);
                        float fd = fr - 0.3 * (1.0 + 0.12 * sin(5.0 * atan(fq.y, fq.x) + sd * 9.0));
                        vec3 fcol = species == S_MOON ? vec3(0.95, 0.95, 0.9) : FLOWER_COLOUR;
                        fcol = mix(vec3(0.97, 0.95, 0.8), fcol, smoothstep(0.04, 0.18, fr));
                        col = mix(col, fcol * (0.75 + 0.3 * smoothstep(-0.3, 0.3, fq.x)) * sk.tint,
                                  smoothstep(aa, -aa, fd) * fadeD);
                    }
                    if (((bits >> 16) & 1) != 0) {
                        float sideL = ((bits >> 14) & 1) != 0 ? 1.0 : -1.0;
                        float la = ang + sideL * 1.25;
                        vec2 lu = dirOf(la);
                        vec2 lv = vec2(-lu.y, lu.x);
                        vec2 base = P + lu * (PETIOLE * lenL);
                        vec2 rb = p - base;
                        vec2 q = vec2(dot(rb, lu), dot(rb, lv)) / lenL;
                        q.y /= max(abs(tumble), 0.15);
                        float d = heart ? heartLeaf(q) : ivyLeaf(q, sd);
                        float a = smoothstep(aa, -aa, d * lenL * max(abs(tumble), 0.15)) * fadeD;
                        vec2 rs = rb - shOff * 2.5;
                        vec2 qs = vec2(dot(rs, lu), dot(rs, lv)) / lenL;
                        float sl = (1.0 - smoothstep(0.4, 1.3, length((qs - vec2(0.47, 0.0)) / vec2(0.6, 0.5 * abs(tumble) + 0.1))))
                                 * 0.25 * fadeD;
                        col *= 1.0 - sl;
                        if (a > 0.0) col = mix(col, shadeLeaf(q, d, la, b, heart, lenL, px, sk, tumble), a);
                    }
                }
            }
        }
    }

    col += glow;
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
