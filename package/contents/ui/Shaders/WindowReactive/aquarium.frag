// Aquarium — a planted tank behind the desktop.
// @channels bufferA, tex1, bufferB
// @sim-max-height 128
//
// A side view into a freshwater tank: a school of neon tetras, two angelfish,
// a pea pufferfish, two corydoras and two cherry shrimp among swaying
// vallisneria, with caustics on the sand, light rays from the surface and a
// bubbler in the corner. Windows are the rocks: fish swim around them, linger
// at their edges, and frightened fish hide behind them. A fast cursor startles
// the fish; a cursor held still draws the curious ones to nibble at it. Click
// bare desktop to sprinkle food flakes, click the pufferfish to make it puff
// up. A dragged window shoves the water and sheds bubbles. The tank light
// follows the local clock: at night it dims to moonlight, the fish rest low
// among the plants and the neon stripes glow. The school size is TETRAS in
// aquarium_common.frag.
//
// iChannel0  Buffer A: fish, flakes, bubbles and input state (see the file).
// iChannel1  Wallpaper ("Image 2" in the settings) as the tank's back wall.
//            Without one a deep-water backdrop with distant rocks and plants
//            is drawn.
// iChannel2  Buffer B: per-tile sets of fish, flakes and bubbles.
//
// Lengths are in H units: pixels / iResolution.y.

const vec3  WATER_TINT   = vec3(0.30, 0.70, 0.72); // @color @label("Water tint")
const float CAUSTICS     = 1.0;  // @range(0.0, 2.0, 0.05) @label("Caustics")
const float LIGHT_RAYS   = 1.0;  // @range(0.0, 2.0, 0.05) @label("Light rays")
const float PLANTS       = 1.0;  // @range(0.0, 1.5, 0.05) @label("Plants")
const float FISH_SCALE   = 1.0;  // @range(0.6, 1.6, 0.05) @label("Fish size")
const float FOLLOW_CLOCK = 1.0;  // @range(0.0, 1.0, 1.0) @label("Night by the clock")

float gA;      // aspect
float gPx;     // one pixel, H
float gRatio;  // image aspect / Buffer A aspect
float gClock;  // animation clock 0..1, one turn per LOOP seconds
float gNight;  // 0 day .. 1 night
float gU;      // fish unit for the screen shape

// Angle of a motion making `turns` whole turns per LOOP; seamless across the
// clock's wrap.
float TW(float turns) { return 6.2831853 * fract(turns * gClock); }

// ------------------------------------------------------------- shapes

float vnoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), w.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), w.x), w.y);
}

float vnoise1(float x)
{
    float i = floor(x);
    float f = fract(x);
    return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f));
}

mat2 rot(float a)
{
    float c = cos(a);
    float s = sin(a);
    return mat2(c, s, -s, c);
}

float smin(float a, float b, float k)
{
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Approximate ellipse distance (Inigo Quilez, "2D distance functions").
float sdEllipse(vec2 p, vec2 r)
{
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / max(k1, 1e-6);
}

float sdSeg(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// Inigo Quilez, "2D distance functions", sdTriangle.
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2)
{
    vec2 e0 = p1 - p0;
    vec2 e1 = p2 - p1;
    vec2 e2 = p0 - p2;
    vec2 v0 = p - p0;
    vec2 v1 = p - p1;
    vec2 v2 = p - p2;
    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    float s = sign(e0.x * e2.y - e0.y * e2.x);
    vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                     vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                     vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
    return -sqrt(d.x) * sign(d.y);
}

float cover(float d, float aa) { return clamp(0.5 - d / aa, 0.0, 1.0); }

// Paints colour c with coverage a over o (straight alpha).
void over(inout vec4 o, vec3 c, float a)
{
    float na = a + o.a * (1.0 - a);
    o.rgb = (c * a + o.rgb * o.a * (1.0 - a)) / max(na, 1e-5);
    o.a = na;
}

// ------------------------------------------------------------- fish

struct FishView {
    vec2 q;       // local position, units of L, +x towards the nose
    float aa;     // one pixel in local units
    float phase;  // tail beat, cycles
    float fear;
    float puff;
    float sleep;
    float blink;  // 0 open .. 1 shut
    float chomp;  // 1 just ate .. 0
    float speed;  // body lengths per second
    vec2 look;    // pupil offset direction, local
    int variant;
};

// Body wave: lateral offset of the spine at local x, towards the tail.
float spine(FishView f, float amp, float x)
{
    return amp * sin(6.2831853 * f.phase - 3.2 * x) * smoothstep(0.15, -0.5, x);
}

// Cartoon eye at e with radius r.
void eye(inout vec4 o, FishView f, vec2 e, float r, vec3 iris, vec3 lid)
{
    vec2 d = f.q - e;
    float de = length(d) - r;
    float a = cover(de, f.aa);
    if (a <= 0.0) return;
    vec3 c = vec3(0.97, 0.98, 1.0);
    vec2 pc = e + f.look * r * 0.24;
    float pr = r * mix(0.74, 0.5, f.fear);
    float dp = length(f.q - pc);
    c = mix(c, iris, cover(dp - pr, f.aa));
    c = mix(c, vec3(0.02, 0.03, 0.06), cover(dp - pr * 0.66, f.aa));
    c = mix(c, vec3(1.0), cover(length(f.q - pc - vec2(0.26, 0.3) * r) - 0.26 * r, f.aa));
    c = mix(c, vec3(1.0), 0.8 * cover(length(f.q - pc + vec2(0.22, 0.28) * r) - 0.11 * r, f.aa));
    c *= 1.0 - 0.45 * smoothstep(-0.18 * r - f.aa, 0.0, de);
    // Lid closes from the top; asleep it rests half shut.
    float shut = max(f.blink, 0.62 * f.sleep);
    if (shut > 0.01) {
        float ly = e.y + r * (1.0 - 2.1 * shut);
        float lidA = cover(ly - f.q.y, f.aa);
        c = mix(c, lid, lidA);
        c = mix(c, lid * 0.45, cover(abs(f.q.y - ly) - 0.08 * r, f.aa) * smoothstep(0.0, 0.1, shut));
    }
    over(o, c, a);
}

vec4 drawTetra(FishView f, inout vec3 glow)
{
    vec2 q = f.q;
    float aa = f.aa;
    q.y -= spine(f, 0.07, q.x);
    float body = sdEllipse(q - vec2(0.05, 0.0), vec2(0.40, 0.13));
    body = smin(body, sdSeg(q, vec2(-0.18, 0.0), vec2(-0.38, 0.0)) - 0.038, 0.08);
    float ta = 0.32 * sin(6.2831853 * f.phase - 2.4);
    vec2 tq = rot(ta) * (q - vec2(-0.38, 0.0));
    float tail = min(sdTri(tq, vec2(0.04, 0.025), vec2(-0.19, 0.16), vec2(-0.1, 0.0)),
                     sdTri(tq, vec2(0.04, -0.025), vec2(-0.19, -0.16), vec2(-0.1, 0.0))) - 0.015;
    float dors = sdTri(q, vec2(0.05, 0.1), vec2(-0.11, 0.23), vec2(-0.14, 0.08)) - 0.012;
    float anal = sdTri(q, vec2(-0.02, -0.09), vec2(-0.22, -0.19), vec2(-0.26, -0.06)) - 0.012;
    float pa = 0.5 * sin(6.2831853 * f.phase * 2.0);
    float pect = sdEllipse(rot(0.5 + pa) * (q - vec2(0.12, -0.05)) + vec2(0.06, 0.0), vec2(0.07, 0.03));
    float fins = min(min(tail, dors), anal);
    if (min(body, fins) > aa) return vec4(0.0);

    vec4 o = vec4(0.0);
    over(o, vec3(0.86, 0.9, 0.94), 0.42 * cover(fins, aa));

    vec3 c = mix(vec3(0.95, 0.96, 0.98), vec3(0.62, 0.68, 0.6), smoothstep(-0.05, 0.05, q.y));
    c = mix(c, vec3(0.34, 0.4, 0.34), smoothstep(0.05, 0.11, q.y));
    float red = smoothstep(0.08, -0.04, q.x) * smoothstep(0.035, -0.02, q.y);
    c = mix(c, vec3(0.98, 0.14, 0.22), red * smoothstep(-0.46, -0.3, q.x));
    float th = 0.022 + 0.018 * smoothstep(-0.35, 0.1, q.x);
    float stripe = cover(abs(q.y - 0.035 + 0.02 * q.x) - th, aa)
                 * smoothstep(-0.36, -0.26, q.x) * smoothstep(0.36, 0.26, q.x);
    vec3 neon = mix(vec3(0.05, 0.45, 1.0), vec3(0.25, 0.95, 1.0), 0.5 + 0.5 * sin(q.x * 14.0 + 6.2831853 * f.phase));
    c = mix(c, neon, stripe);
    c += 0.18 * smoothstep(0.05, 0.0, abs(q.y - 0.075)) * smoothstep(0.25, 0.0, abs(q.x - 0.08));
    c *= 1.0 - 0.32 * smoothstep(-0.035, 0.0, body);
    float ab = cover(body, aa);
    over(o, c, ab);
    glow += neon * stripe * ab;
    over(o, vec3(0.9, 0.94, 0.97), 0.35 * cover(pect, aa));
    if (f.chomp > 0.0) over(o, vec3(0.25, 0.08, 0.1), cover(length(q - vec2(0.43, -0.015)) - 0.03 * f.chomp, aa));
    eye(o, f, vec2(0.27, 0.025), 0.1, vec3(0.75, 0.6, 0.35), vec3(0.6, 0.66, 0.58));
    return o;
}

vec4 drawAngel(FishView f, inout vec3 glow)
{
    vec2 q = f.q;
    float aa = f.aa;
    q.y -= spine(f, 0.03, q.x);
    float body = sdEllipse(q - vec2(0.02, 0.0), vec2(0.28, 0.25));
    body = smin(body, sdEllipse(q - vec2(0.24, 0.03), vec2(0.14, 0.085)), 0.08);
    body = smin(body, sdSeg(q, vec2(-0.1, 0.0), vec2(-0.3, 0.0)) - 0.06, 0.1);
    float sw = 0.04 * sin(6.2831853 * f.phase - 1.0);
    float dors = sdTri(q, vec2(0.12, 0.18), vec2(-0.3 + sw, 0.8), vec2(-0.26, 0.08)) - 0.03;
    float anal = sdTri(q, vec2(0.08, -0.18), vec2(-0.34 + sw, -0.86), vec2(-0.24, -0.08)) - 0.03;
    float ta = 0.22 * sin(6.2831853 * f.phase - 2.2);
    vec2 tq = rot(ta) * (q - vec2(-0.3, 0.0));
    float tail = sdTri(tq, vec2(0.04, 0.0), vec2(-0.22, 0.23), vec2(-0.22, -0.23)) - 0.02;
    tail = max(tail, -(length(tq - vec2(-0.34, 0.0)) - 0.13));
    float fl = 0.06 * sin(6.2831853 * f.phase - 0.5);
    float fil = min(sdSeg(q, vec2(0.12, -0.2), vec2(0.03 + fl * 0.5, -0.56)),
                    sdSeg(q, vec2(0.03 + fl * 0.5, -0.56), vec2(-0.06 + fl, -0.9))) - 0.012;
    float fins = min(min(dors, anal), tail);
    if (min(min(body, fins), fil) > aa) return vec4(0.0);

    bool koi = f.variant == 1;
    // Vertical bands, leaning back, through the eye, the body and the fins.
    float bx = q.x + 0.12 * q.y;
    float bands = max(max(cover(abs(bx - 0.21) - 0.035, aa), cover(abs(bx - 0.0) - 0.05, aa)),
                      cover(abs(bx + 0.24) - 0.04, aa));
    vec3 base = vec3(0.84, 0.87, 0.9);
    vec3 dark = vec3(0.1, 0.1, 0.13);
    if (koi) {
        float n = vnoise(q * 6.0 + 3.7);
        float n2 = vnoise(q * 9.0 + 11.0);
        base = mix(vec3(1.0, 0.62, 0.18), vec3(0.98, 0.96, 0.92), smoothstep(0.45, 0.6, n));
        bands = smoothstep(0.62, 0.7, n2) * 0.9;
    }
    vec4 o = vec4(0.0);
    vec3 fc = mix(base * vec3(0.95, 0.97, 1.0), dark, bands * 0.85);
    float af = cover(fins, aa);
    float edge = smoothstep(-0.05, 0.0, fins);
    over(o, mix(fc, vec3(0.97), 0.35 * edge), af * mix(0.72, 0.5, edge));
    over(o, mix(base, dark, 0.3), 0.8 * cover(fil, aa));

    vec3 c = base * (0.92 + 0.14 * smoothstep(-0.2, 0.2, q.y));
    c += vec3(0.1, 0.08, 0.02) * smoothstep(0.05, 0.22, q.y);
    c = mix(c, dark, bands * 0.92);
    c += 0.16 * smoothstep(0.14, 0.0, length((q - vec2(0.1, 0.13)) / vec2(1.6, 1.0)));
    c *= 1.0 - 0.3 * smoothstep(-0.03, 0.0, body);
    over(o, c, cover(body, aa));
    if (f.chomp > 0.0) over(o, vec3(0.3, 0.1, 0.1), cover(length(q - vec2(0.37, 0.03)) - 0.025 * f.chomp, aa));
    eye(o, f, vec2(0.21, 0.07), 0.075, koi ? vec3(0.95, 0.45, 0.15) : vec3(0.85, 0.25, 0.15), base * 0.9);
    return o;
}

vec4 drawPuffer(FishView f, inout vec3 glow)
{
    vec2 q = f.q;
    float aa = f.aa;
    float p = f.puff;
    q.y -= spine(f, 0.02 * (1.0 - p), q.x);
    vec2 R = mix(vec2(0.36, 0.27), vec2(0.45, 0.43), p);
    vec2 b = q - vec2(0.0, 0.04 * p);
    float body = sdEllipse(b, R);
    float ang = atan(b.y, b.x);
    body -= p * 0.04 * pow(abs(sin(ang * 9.0)), 8.0);
    float ta = 0.35 * sin(6.2831853 * f.phase - 2.0);
    vec2 tq = rot(ta) * (q - vec2(-R.x + 0.04, 0.0));
    float tail = sdTri(tq, vec2(0.03, 0.0), vec2(-0.16, 0.12), vec2(-0.16, -0.12)) - 0.02;
    float dors = sdTri(q, vec2(-0.12, R.y * 0.8), vec2(-0.26, R.y + 0.06), vec2(-0.3, R.y * 0.45)) - 0.015;
    float anal = sdTri(q, vec2(-0.12, -R.y * 0.8), vec2(-0.26, -R.y - 0.05), vec2(-0.3, -R.y * 0.45)) - 0.015;
    float pf = 0.7 * sin(6.2831853 * f.phase * 3.0);
    float pect = sdEllipse(rot(0.4 + pf) * (q - vec2(0.02, -0.04)) + vec2(0.06, 0.0), vec2(0.08, 0.045));
    float fins = min(min(tail, dors), anal);
    if (min(body, fins) > aa) return vec4(0.0);

    vec4 o = vec4(0.0);
    over(o, vec3(0.85, 0.88, 0.6), 0.55 * cover(fins, aa));
    float belly = smoothstep(0.04, -0.06, b.y - 0.18 * b.x * b.x + 0.03 + 0.1 * p);
    vec3 back = vec3(0.80, 0.84, 0.32);
    float spots = smoothstep(0.58, 0.66, vnoise(b * 8.0 + vec2(1.7, 4.1))) * (1.0 - belly);
    vec3 c = mix(back, vec3(0.36, 0.42, 0.16), spots);
    c = mix(c, vec3(0.99, 0.97, 0.88), belly);
    c += 0.18 * smoothstep(0.1, 0.0, length((b - vec2(0.02, R.y * 0.55)) / vec2(1.6, 1.0)) - 0.02);
    c = mix(c, vec3(1.0, 0.55, 0.6), 0.35 * cover(sdEllipse(q - vec2(0.17, -0.07 + 0.02 * p), vec2(0.07, 0.04)), aa));
    c *= 1.0 - 0.3 * smoothstep(-0.03, 0.0, body);
    over(o, c, cover(body, aa));
    over(o, vec3(0.9, 0.93, 0.65), 0.6 * cover(pect, aa));
    // Mouth: a small o.
    vec2 mp = vec2(R.x - 0.03, -0.03 + 0.02 * p);
    float mr = 0.022 + 0.015 * f.chomp + 0.01 * p;
    over(o, vec3(0.45, 0.2, 0.2), cover(abs(length(q - mp) - mr) - 0.008, aa));
    eye(o, f, vec2(0.15, 0.1 + 0.07 * p), 0.11 + 0.01 * p, vec3(0.35, 0.65, 0.45), back);
    return o;
}

vec4 drawCory(FishView f, inout vec3 glow)
{
    vec2 q = f.q;
    float aa = f.aa;
    q.y -= spine(f, 0.04, q.x);
    // Deep head with a sloping brow, arched back, flat belly.
    float body = sdEllipse(q - vec2(-0.03, 0.03), vec2(0.33, 0.17));
    body = smin(body, sdTri(q, vec2(0.41, -0.07), vec2(0.08, 0.21), vec2(0.06, -0.13)) - 0.04, 0.08);
    body = smin(body, sdSeg(q, vec2(-0.2, 0.02), vec2(-0.38, 0.035)) - 0.055, 0.08);
    body = max(body, -(q.y + 0.125));
    float ta = 0.3 * sin(6.2831853 * f.phase - 2.4);
    vec2 tq = rot(ta) * (q - vec2(-0.39, 0.035));
    float tail = min(sdTri(tq, vec2(0.03, 0.02), vec2(-0.17, 0.15), vec2(-0.1, 0.0)),
                     sdTri(tq, vec2(0.03, -0.02), vec2(-0.17, -0.15), vec2(-0.1, 0.0))) - 0.015;
    float dors = sdTri(q, vec2(0.13, 0.17), vec2(0.02, 0.46), vec2(-0.1, 0.16)) - 0.015;
    float adip = sdEllipse(q - vec2(-0.27, 0.13), vec2(0.05, 0.03));
    float pect = sdTri(q, vec2(0.2, -0.09), vec2(0.03, -0.21), vec2(0.08, -0.1)) - 0.012;
    float sn = 0.03 * sin(6.2831853 * f.phase * 2.0);
    float barb = min(sdSeg(q, vec2(0.38, -0.09), vec2(0.48, -0.15 + sn)),
                     sdSeg(q, vec2(0.36, -0.11), vec2(0.43, -0.2 - sn))) - 0.01;
    float fins = min(min(tail, dors), min(adip, pect));
    if (min(min(body, fins), barb) > aa) return vec4(0.0);

    bool panda = f.variant == 0;
    vec4 o = vec4(0.0);
    vec3 finC = panda ? vec3(0.93, 0.92, 0.9) : vec3(0.78, 0.72, 0.56);
    float dorsDark = panda ? cover(dors, aa) * smoothstep(0.12, 0.24, q.y) : 0.0;
    over(o, mix(finC, vec3(0.1), dorsDark), 0.55 * cover(fins, aa) + 0.4 * dorsDark);
    over(o, vec3(0.88, 0.8, 0.72), cover(barb, aa));

    vec3 c;
    vec3 lid;
    if (panda) {
        c = mix(vec3(1.0, 0.88, 0.8), vec3(0.97, 0.96, 0.94), smoothstep(-0.1, 0.06, q.y));
        float mask = cover(sdEllipse(rot(-0.25) * (q - vec2(0.22, 0.07)), vec2(0.075, 0.16)), aa);
        float band = cover(abs(q.x + 0.3) - 0.045, aa) * smoothstep(-0.06, 0.02, q.y);
        c = mix(c, vec3(0.1, 0.1, 0.12), max(mask, band));
        lid = vec3(0.1, 0.1, 0.12);
    } else {
        c = mix(vec3(0.98, 0.86, 0.7), vec3(0.8, 0.52, 0.28), smoothstep(-0.1, 0.06, q.y));
        float sheen = smoothstep(0.09, 0.0, abs(q.y - 0.03 + 0.05 * q.x)) * smoothstep(0.1, -0.05, q.x);
        c = mix(c, vec3(0.2, 0.62, 0.56), 0.75 * sheen);
        c = mix(c, vec3(0.45, 0.3, 0.18), 0.5 * smoothstep(0.08, 0.16, q.y));
        lid = c;
    }
    // Armour plates along the flank.
    c *= 1.0 - 0.1 * cover(abs(q.y - 0.01 + 0.06 * q.x) - 0.006, aa) * step(q.x, 0.1);
    c += 0.12 * smoothstep(0.05, 0.0, abs(q.y - 0.16)) * smoothstep(0.25, 0.0, abs(q.x - 0.02));
    c *= 1.0 - 0.3 * smoothstep(-0.03, 0.0, body);
    over(o, c, cover(body, aa));
    eye(o, f, vec2(0.22, 0.075), 0.072, vec3(0.5, 0.58, 0.7), lid);
    return o;
}

vec4 drawShrimp(FishView f, inout vec3 glow)
{
    vec2 q = f.q;
    float aa = f.aa;
    float body = sdEllipse(q - vec2(0.14, 0.06), vec2(0.2, 0.12));
    body = smin(body, length(q - vec2(-0.06, 0.07)) - 0.105, 0.03);
    body = smin(body, length(q - vec2(-0.17, 0.06)) - 0.095, 0.03);
    body = smin(body, length(q - vec2(-0.27, 0.03)) - 0.082, 0.03);
    body = smin(body, length(q - vec2(-0.35, -0.02)) - 0.068, 0.03);
    body = smin(body, length(q - vec2(-0.41, -0.07)) - 0.055, 0.03);
    float fan = sdTri(q, vec2(-0.42, -0.08), vec2(-0.58, -0.01), vec2(-0.56, -0.17)) - 0.015;
    float ros = sdTri(q, vec2(0.28, 0.12), vec2(0.45, 0.14), vec2(0.3, 0.07));
    float wv = 0.04 * sin(TW(64.0) + float(f.variant) * 2.0);
    float ant = min(min(sdSeg(q, vec2(0.3, 0.1), vec2(0.62, 0.3 + wv)), sdSeg(q, vec2(0.62, 0.3 + wv), vec2(0.98, 0.26 + 2.0 * wv))),
                    sdSeg(q, vec2(0.3, 0.08), vec2(0.6, 0.12 - wv))) - 0.007;
    float legs = 1e9;
    float walk = f.speed > 0.05 ? 6.2831853 * f.phase * 3.0 : 0.0;
    for (int k = 0; k < 5; k++) {
        float x = 0.2 - float(k) * 0.08;
        float sw = 0.04 * sin(walk + float(k) * 1.3);
        legs = min(legs, sdSeg(q, vec2(x, -0.02), vec2(x + 0.03 + sw, -0.13)));
    }
    legs -= 0.006;
    if (min(min(body, fan), min(min(ros, ant), legs)) > aa) return vec4(0.0);

    vec4 o = vec4(0.0);
    vec3 red = vec3(0.9, 0.16, 0.14);
    over(o, red * 0.85, 0.75 * cover(min(legs, ant), aa));
    over(o, red * 1.05, 0.8 * cover(min(fan, ros), aa));
    vec3 c = mix(red * 0.8, red * 1.15 + vec3(0.06, 0.04, 0.03), smoothstep(-0.05, 0.12, q.y));
    float seg = 0.5 + 0.5 * cos((q.x + 0.06) * 32.0);
    c *= 1.0 - 0.15 * seg * step(q.x, -0.02);
    c += 0.22 * smoothstep(0.05, 0.0, abs(q.y - 0.14)) * smoothstep(0.15, 0.0, abs(q.x - 0.12));
    c *= 1.0 - 0.25 * smoothstep(-0.025, 0.0, body);
    over(o, c, 0.93 * cover(body, aa));
    float de = length(q - vec2(0.27, 0.11)) - 0.045;
    vec3 ec = mix(vec3(0.02), vec3(1.0), cover(length(q - vec2(0.282, 0.125)) - 0.014, aa));
    over(o, ec, cover(de, aa));
    return o;
}

// Fish i at screen point p (H). Composites into col.
void drawFish(int i, vec2 p, inout vec3 col, inout vec3 glow, vec3 fog)
{
    vec4 P = texelFetch(iChannel0, ivec2(i, ROW_P), 0);
    vec2 c = vec2(P.x * gRatio, P.y);
    int sp = speciesOf(i);
    float L = fishLen(i, gA) * FISH_SCALE;
    vec2 d = p - c;
    if (max(abs(d.x), abs(d.y)) > L * 1.05) return;
    vec4 Q = texelFetch(iChannel0, ivec2(i, ROW_Q), 0);
    vec4 S = texelFetch(iChannel0, ivec2(i, ROW_S), 0);
    float sgn = facingSign(Q.x);
    vec2 v = P.zw;
    float spd = length(v);
    bool bottom = sp == SP_CORY || sp == SP_SHRIMP;
    float pitch = bottom ? 0.0 : clamp(atan(v.y, abs(v.x) + 0.02), -0.55, 0.55) * smoothstep(0.004, 0.03, spd);
    if (sp == SP_ANGEL) pitch *= 0.5;
    if (sp == SP_CORY) pitch = -0.12 * smoothstep(0.02, 0.0, spd) * (0.5 + 0.5 * sin(TW(96.0) + float(i)));
    vec2 q = rot(-pitch * sgn) * d / L;
    float sq = max(abs(Q.x), 0.16);
    q.x *= sgn / sq;

    FishView f;
    f.q = q;
    f.aa = gPx / L * mix(1.0, 1.0 / sq, 0.5);
    f.phase = Q.y;
    f.fear = Q.z;
    f.puff = sp == SP_PUFFER ? Q.w : 0.0;
    f.sleep = gNight > 0.0 ? S.z * smoothstep(0.3, 0.7, gNight) : 0.0;
    float bp = fract(gClock * (90.0 + float(i * 7)) + hash11(float(i) * 3.3));
    f.blink = bp < 0.03 ? sin(3.14159 * bp / 0.03) : 0.0;
    f.chomp = max(0.0, 1.0 - S.x / 0.3);
    f.speed = spd / L;
    vec2 lk = vec2(1.0, 0.0);
    if (S.w > 0.3 || Q.z > 0.3) {
        vec2 m = iMouse.xy / iResolution.y - c;
        if (length(m) > 1e-4) lk = normalize(m);
        lk = rot(pitch * sgn) * lk;
        lk.x *= sgn;
    }
    f.look = lk;
    f.variant = variantOf(i);

    vec4 o;
    if (sp == SP_TETRA) o = drawTetra(f, glow);
    else if (sp == SP_ANGEL) o = drawAngel(f, glow);
    else if (sp == SP_PUFFER) o = drawPuffer(f, glow);
    else if (sp == SP_CORY) o = drawCory(f, glow);
    else o = drawShrimp(f, glow);
    if (o.a <= 0.0) return;
    float z = depthOf(i);
    vec3 fc = mix(o.rgb, fog, 0.05 + 0.2 * z);
    col = mix(col, fc, o.a);
}

// ------------------------------------------------------------- scenery

vec3 waterColour(vec2 p)
{
    vec3 hi = mix(WATER_TINT, vec3(1.0), 0.42);
    vec3 lo = WATER_TINT * vec3(0.2, 0.36, 0.44);
    vec3 c = mix(lo, hi, smoothstep(0.0, 1.05, p.y));
    float pool = exp(-pow((p.x / gA - 0.5) * 2.2, 2.0));
    return c * (0.9 + 0.18 * pool * smoothstep(0.2, 0.9, p.y));
}

// Vallisneria-like blades in clusters of four, at most one cluster per cell
// `spacing` wide, roots at x < xmax. Heights count from base, the root line
// at the pixel's x; whatever is drawn over it hides the roots. Returns
// (coverage, shade, height fraction, blade hash) of the strongest blade at p.
vec4 blades(vec2 p, float base, float seed, float spacing, float hmul, float width, float density, int reach, float xmax)
{
    vec4 best = vec4(0.0);
    float y = p.y - base;
    if (y < 0.0 || y > hmul) return best;
    float cx = floor(p.x / spacing);
    for (int k = -reach; k <= reach; k++) {
        float cell = cx + float(k);
        vec2 hc = hash22(vec2(cell, seed));
        if (hc.x > density) continue;
        float rx = (cell + 0.15 + 0.7 * fract(hc.y * 7.3)) * spacing;
        if (rx > xmax) continue;
        float u = rx / gA;
        float env = 0.55 + 0.45 * max(smoothstep(0.4, 0.05, u), smoothstep(0.6, 0.95, u));
        float H = hmul * env * (0.35 + 0.65 * hc.y);
        if (y > H || abs(p.x - rx) > H * 0.4 + width) continue;
        float sway = 0.1 * sin(TW(26.0) + rx * 7.0) + 0.04 * sin(TW(61.0) + rx * 13.0);
        for (int b = 0; b < 4; b++) {
            float fb = float(b) - 1.5;
            float hb = fract(hc.y * (13.7 + 5.3 * float(b)) + hc.x * 3.1);
            float bh = H * (0.55 + 0.45 * hb);
            float s = y / bh;
            if (s > 1.0) continue;
            float lean = (hb - 0.5) * 0.3 + fb * 0.07;
            float sw = sway * (0.7 + 0.6 * hb);
            float bx = rx + fb * width * 1.2 + (lean * s + sw * s * s) * bh;
            float slope = lean + 2.0 * sw * s;
            float w = width * (1.0 - 0.3 * s) * sqrt(clamp((1.0 - s) * bh / (1.5 * width), 0.0, 1.0));
            float dd = abs(p.x - bx) * inversesqrt(1.0 + slope * slope) - w;
            float a = cover(dd, gPx);
            if (a > best.x) {
                float twist = 0.5 + 0.5 * sin(y * 55.0 + hb * 6.2831853);
                best = vec4(a, 0.72 + 0.28 * twist - 0.25 * smoothstep(-w * 0.2, 0.0, dd), s, hb);
            }
        }
    }
    return best;
}

vec3 bladeColour(vec4 b, vec3 base, vec3 tip)
{
    vec3 c = mix(base, tip, smoothstep(0.3, 1.0, b.z));
    c *= 0.85 + 0.3 * b.w;
    return c * b.y;
}

// Rounded boulders on the far floor, at most one per cell, each reaching only
// into the nearer half of a neighbouring cell: coverage in x, shade in y.
vec2 boulders(vec2 p, float seed, float spacing, float scale)
{
    if (p.y > sandTop(p.x) + 2.2 * scale) return vec2(0.0, 1.0);
    float cx = floor(p.x / spacing);
    float side = fract(p.x / spacing) < 0.5 ? -1.0 : 1.0;
    vec2 best = vec2(0.0, 1.0);
    for (int k = 0; k < 2; k++) {
        float cell = cx + float(k) * side;
        float h = hash11(cell * 2.31 + seed);
        if (h > 0.75) continue;
        float r = scale * (0.5 + 0.7 * hash11(cell * 4.7 + seed));
        vec2 c = vec2((cell + 0.5 + 0.4 * (hash11(cell * 6.1 + seed) - 0.5)) * spacing, sandTop((cell + 0.5) * spacing) + 0.25 * r);
        vec2 d = (p - c) / vec2(1.35, 1.0);
        float dist = length(d) - r;
        float a = cover(dist, gPx * 1.5);
        if (a > best.x) best = vec2(a, 0.75 + 0.35 * clamp(d.y / r, -1.0, 1.0) - 0.1 * clamp(d.x / r, -1.0, 1.0));
    }
    return best;
}

vec3 backWall(vec2 p, vec3 water)
{
    if (iChannelResolution[1].x > 0.0) {
        vec2 uv = p / vec2(gA, 1.0);
        vec2 texRes = iChannelResolution[1].xy;
        float ta = texRes.x / texRes.y;
        vec2 fit = gA > ta ? vec2(1.0, ta / gA) : vec2(gA / ta, 1.0);
        vec3 w = texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
        if (p.y > SURFACE) return w * 0.92 + 0.05;
        float depth = clamp((SURFACE - p.y) / SURFACE, 0.0, 1.0);
        vec3 absorb = mix(vec3(1.0), WATER_TINT * 1.35, 0.45 + 0.35 * depth);
        return mix(w * absorb, water, 0.22 + 0.25 * depth);
    }
    if (p.y > SURFACE) return mix(water, vec3(0.92, 0.97, 0.96), 0.55);
    vec3 col = water;
    // Faint texture on the back glass.
    col *= 0.97 + 0.05 * vnoise(p * vec2(3.0, 5.0) + 7.0);
    // Far plants and boulders, fogged by distance.
    vec4 fb = blades(p, sandTop(p.x) - 0.01, 41.0, 0.11, 0.45, 0.006, 0.7, 1, 1e3);
    col = mix(col, mix(water, WATER_TINT * vec3(0.35, 0.55, 0.45), 0.35) * (0.8 + 0.2 * fb.y), fb.x * 0.8);
    vec2 b1 = boulders(p, 3.0, 0.42, 0.11);
    col = mix(col, water * mix(0.86, 1.0, b1.y - 0.6), b1.x * 0.8);
    vec2 b2 = boulders(p, 9.0, 0.3, 0.07);
    col = mix(col, water * vec3(0.78, 0.8, 0.82) * mix(0.85, 1.05, b2.y - 0.6), b2.x * 0.9);
    return col;
}

// Animated caustic net: edges of a jittered Voronoi diagram; two layers
// multiplied so the bright crossings stand out.
float causticLayer(vec2 p, float t)
{
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(ip + g);
            o = 0.5 + 0.42 * sin(t + 6.2831853 * o);
            vec2 r = g + o - fp;
            float d = dot(r, r);
            if (d < d1) {
                d2 = d1;
                d1 = d;
            } else if (d < d2) {
                d2 = d;
            }
        }
    }
    return exp(-(sqrt(d2) - sqrt(d1)) * 7.0);
}

float caustics(vec2 cp)
{
    float a = causticLayer(cp, TW(37.0));
    float b = causticLayer(cp * 1.31 + 3.7, TW(29.0) + 1.7);
    return pow(a * b, 1.2) * 2.2 + a * 0.12;
}

vec3 sand(vec2 p, float top, float light)
{
    float v = clamp((top - p.y) / max(top, 1e-3), 0.0, 1.0);
    vec3 c = mix(vec3(0.91, 0.83, 0.66), vec3(0.80, 0.70, 0.54), v);
    c *= 0.95 + 0.07 * vnoise(p * vec2(220.0, 320.0)) + 0.07 * vnoise(p * vec2(14.0, 26.0));
    // Gravel in three sizes, larger towards the glass; one pebble per
    // jittered cell, most cells empty.
    for (int l = 0; l < 3; l++) {
        float s = l == 0 ? 130.0 : (l == 1 ? 62.0 : 30.0);
        float keep = l == 0 ? 0.22 : (l == 1 ? 0.22 * smoothstep(0.1, 0.5, v) : 0.2 * smoothstep(0.45, 0.85, v));
        vec2 g = p * vec2(s, s * 1.5);
        vec2 cell = floor(g);
        vec2 h = hash22(cell + float(l) * 17.0);
        if (h.x > keep) continue;
        float r = 0.24 + 0.18 * fract(h.y * 7.1);
        vec2 ctr = cell + 0.5 + (hash22(cell * 1.7 + 3.1) - 0.5) * (0.9 - 2.0 * r);
        vec2 d = (g - ctr) / vec2(1.0 + 0.3 * fract(h.y * 3.7), 0.8);
        float dist = length(d) - r;
        float a = cover(dist, gPx * s * 1.5);
        float k = fract(h.y * 13.3);
        vec3 pc = k < 0.3 ? vec3(0.66, 0.64, 0.62) : (k < 0.55 ? vec3(0.84, 0.74, 0.58) : (k < 0.8 ? vec3(0.72, 0.55, 0.42) : vec3(0.94, 0.92, 0.88)));
        float sh = clamp(d.y / r, -1.0, 1.0);
        pc *= 0.8 + 0.3 * sh + 0.18 * smoothstep(0.55, 0.0, length(d / r - vec2(-0.2, 0.45)));
        // Soft shade on the sand just below a pebble.
        float under = smoothstep(r * 1.4, r * 0.6, length((g - ctr + vec2(0.0, r * 0.55)) / vec2(1.2, 0.6))) * (1.0 - a);
        c *= 1.0 - 0.12 * under;
        c = mix(c, pc, a * (l == 0 ? 0.45 : 0.9));
    }
    // The back edge catches the light; the front sits in shade.
    c *= mix(1.06, 0.74, v * v);
    c += 0.08 * smoothstep(0.012, 0.0, top - p.y);
    float caus = caustics(vec2(p.x * 7.5, (top - p.y) * 26.0 / (0.6 + v)));
    c += vec3(1.0, 0.98, 0.85) * caus * 0.3 * CAUSTICS * light * (1.0 - 0.6 * v);
    return c;
}

// Light reaching p past the windows: they shade the water below them.
float windowLight(vec2 p)
{
    float l = 1.0;
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        if (!winValid(k)) continue;
        vec4 r = winRect(k);
        if (p.y >= r.y) continue;
        float below = r.y - p.y;
        float x = p.x - below * 0.15;
        float blur = 0.006 + below * 0.22;
        float inX = smoothstep(r.x - blur, r.x + blur, x) * smoothstep(r.z + blur, r.z - blur, x);
        l *= 1.0 - 0.5 * inX * exp(-below * 1.6);
    }
    return l;
}

float godRays(vec2 p)
{
    float depth = SURFACE - p.y;
    if (depth < 0.0) return 0.0;
    float u = p.x + depth * 0.3;
    float a = vnoise1(u * 9.0 + 1.5 * sin(TW(2.0)));
    float b = vnoise1(u * 23.0 - 2.0 * sin(TW(3.0) + 1.0) + 5.0);
    float r = smoothstep(0.35, 1.0, a) * (0.4 + 0.6 * b);
    return r * exp(-depth * 1.4) * smoothstep(0.0, 0.05, depth);
}

// Bubbler stream from the air stone at x0. Each bubble rises on its own
// whole number of turns per LOOP; size and drift change every rise.
void bubbler(vec2 p, float x0, float y0, inout vec3 col)
{
    if (abs(p.x - x0) > 0.05 || p.y < y0 - 0.01) return;
    float px = gPx;
    for (int k = 0; k < 20; k++) {
        float fk = float(k);
        float turns = 80.0 + floor(hash11(fk * 3.1 + 0.4) * 40.0);
        float ph = gClock * turns + hash11(fk * 7.7 + 1.3);
        float age = fract(ph);
        float hc = hash12(vec2(fk, mod(floor(ph), turns)));
        float y = y0 + 0.008 + pow(age, 0.85) * (SURFACE - y0);
        float r = (0.0022 + 0.0042 * hc * hc) * (1.0 + 0.35 * age) * gU;
        float x = x0 + (hc - 0.5) * 0.014 + 0.007 * sin(age * 17.0 + hc * 6.2831853) * age;
        vec2 d = p - vec2(x, y);
        if (abs(d.y) > r + px || abs(d.x) > r + px) continue;
        float dist = length(d) - r;
        float a = cover(dist, px);
        float rim = cover(abs(dist + 0.25 * r) - 0.2 * r, px);
        vec3 c = mix(col * 0.92 + 0.06, vec3(0.95, 1.0, 1.0), rim * 0.6);
        c = mix(c, vec3(1.0), cover(length(d - vec2(-0.35, 0.35) * r) - 0.25 * r, px));
        col = mix(col, c, a);
    }
}

// Air stone with a soft glow at its top.
void airStone(vec2 p, float x0, float y0, inout vec3 col)
{
    vec2 d = p - vec2(x0, y0);
    float s = sdEllipse(d, vec2(0.028, 0.013) * gU);
    if (s > 0.02) return;
    col *= 1.0 - 0.25 * smoothstep(0.012, 0.0, sdEllipse(d + vec2(0.0, 0.006), vec2(0.026, 0.008) * gU));
    vec3 c = mix(vec3(0.45, 0.5, 0.55), vec3(0.7, 0.75, 0.8), smoothstep(-0.008, 0.008, d.y));
    c *= 0.9 + 0.2 * vnoise(p * 600.0);
    col = mix(col, c, cover(s, gPx));
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 res = iResolution.xy;
    gA = res.x / res.y;
    gPx = 1.0 / res.y;
    vec2 p = fragCoord / res.y;
    bool haveState = iChannelResolution[0].y > 0.0;
    gRatio = haveState ? gA / (iChannelResolution[0].x / iChannelResolution[0].y) : 1.0;
    gClock = haveState ? texelFetch(iChannel0, ivec2(4, ROW_G), 0).x : fract(iTime / LOOP);
    gNight = FOLLOW_CLOCK > 0.5 ? clockNight() : 0.0;
    gU = fishUnit(gA);

    float top = sandTop(p.x);
    vec3 water = waterColour(p);
    float light = windowLight(p);
    vec3 col = backWall(p, water);
    vec3 glow = vec3(0.0);

    // Caustics dance on the back wall just above the sand.
    if (p.y > top && p.y < top + 0.15) {
        float k = exp(-(p.y - top) * 16.0);
        col += vec3(0.9, 1.0, 0.9) * caustics(p * 8.0) * 0.12 * k * CAUSTICS * light;
    }

    // Back plants, then the sand band.
    if (p.y < 0.85) {
        vec4 b = blades(p, top - 0.01, 7.0, 0.075, 0.62 * PLANTS, 0.0065 * gU, 0.75 * min(PLANTS, 1.0), 2, 1e3);
        if (b.x > 0.0) {
            vec3 pc = bladeColour(b, vec3(0.16, 0.42, 0.22), vec3(0.55, 0.78, 0.3));
            col = mix(col, mix(pc, water, 0.28), b.x);
            glow += vec3(0.1, 0.9, 0.6) * b.x * smoothstep(0.85, 1.0, b.z) * 0.25;
        }
    }
    float stoneX = gA - 0.075;
    if (p.y < top + gPx) {
        vec3 s = sand(p, top, light);
        col = mix(col, s, cover(p.y - top, gPx));
    }

    // Mid-ground plants rooted in the sand band.
    if (p.y < 0.7) {
        vec4 b = blades(p, top - 0.02, 19.0, 0.16, 0.5 * PLANTS, 0.009 * gU, 0.45 * min(PLANTS, 1.0), 2, 1e3);
        if (b.x > 0.0) {
            vec3 pc = bladeColour(b, vec3(0.1, 0.36, 0.14), vec3(0.42, 0.7, 0.2));
            col = mix(col, mix(pc, water, 0.12), b.x);
            glow += vec3(0.1, 0.9, 0.6) * b.x * smoothstep(0.85, 1.0, b.z) * 0.25;
        }
    }

    // Low tufts along the sand.
    if (p.y < top + 0.05) {
        vec4 b = blades(p, top - 0.032, 5.0, 0.02, 0.07 * PLANTS, 0.0026 * gU, 0.35 * min(PLANTS, 1.0), 1, 1e3);
        if (b.x > 0.0) col = mix(col, bladeColour(b, vec3(0.2, 0.5, 0.15), vec3(0.6, 0.85, 0.3)), b.x);
    }

    // Flakes, fish, shed bubbles from the tile sets.
    vec4 sets = vec4(0.0);
    if (iChannelResolution[2].x > 0.0) {
        int n = tileSpan(iChannelResolution[2].y);
        ivec2 tile = ivec2(fragCoord / res * iChannelResolution[2].xy);
        tile = clamp(tile, ivec2(0), ivec2(iChannelResolution[2].xy) - 1);
        sets = texelFetch(iChannel2, (tile / n) * n, 0);
    }
    uint fl = uint(sets.z);
    while (fl != 0u) {
        uint bit = fl & (~fl + 1u);
        fl ^= bit;
        int j = int(log2(float(bit)) + 0.5);
        vec4 f = texelFetch(iChannel0, ivec2(j, ROW_FLAKE), 0);
        vec2 c = vec2(f.x * gRatio, f.y);
        float s = fract(f.w) * 2.0;
        bool settled = f.w > 1.75;
        float fade = settled ? 1.0 - smoothstep(FLAKE_LIFE - 4.0, FLAKE_LIFE, f.z) : 1.0;
        float spin = s * 6.2831853 + (settled ? 0.0 : f.z * (1.2 + s));
        vec2 d = rot(spin) * (p - c);
        float r = 0.005 * gU * (0.8 + 0.5 * s);
        float dist = sdEllipse(d, vec2(r, r * (0.55 + 0.3 * fract(s * 5.1))));
        float k = fract(s * 3.7);
        vec3 fc = k < 0.35 ? vec3(0.98, 0.55, 0.15) : (k < 0.6 ? vec3(0.98, 0.82, 0.3) : (k < 0.8 ? vec3(0.88, 0.25, 0.2) : vec3(0.5, 0.75, 0.25)));
        fc *= 0.85 + 0.3 * smoothstep(-r, r, d.y);
        col = mix(col, fc, cover(dist, gPx) * fade);
        // Ripple ring where a flake lands on the surface.
        if (!settled && f.y > SURFACE - 0.01) {
            float age = f.z;
            float rr = 0.004 + age * 0.03;
            vec2 rd = (p - c) / vec2(1.0, 0.3);
            float ring = cover(abs(length(rd) - rr) - 0.0012, gPx * 1.5);
            col += vec3(0.6, 0.7, 0.7) * ring * 0.5 * exp(-age * 3.0);
        }
    }

    for (int ch = 0; ch < 2; ch++) {
        uint m = uint(ch == 0 ? sets.x : sets.y);
        while (m != 0u) {
            uint bit = m & (~m + 1u);
            m ^= bit;
            int i = int(log2(float(bit)) + 0.5) + ch * 24;
            drawFish(i, p, col, glow, water);
        }
    }

    // Front plants: a thicket in the left corner.
    if (p.x < 0.14 * gA + 0.25 && p.y < 0.9) {
        vec4 b = blades(p, top - 0.035, 77.0, 0.035, 0.75 * PLANTS, 0.011 * gU, 0.9 * min(PLANTS, 1.0), 3, 0.14 * gA);
        if (b.x > 0.0) {
            vec3 pc = bladeColour(b, vec3(0.06, 0.26, 0.1), vec3(0.3, 0.6, 0.15));
            col = mix(col, pc, b.x);
            glow += vec3(0.1, 0.9, 0.6) * b.x * smoothstep(0.85, 1.0, b.z) * 0.3;
        }
    }

    // Bubbles: the bubbler, and those shed by dragged windows.
    airStone(p, stoneX, sandTop(stoneX) - 0.014, col);
    bubbler(p, stoneX, sandTop(stoneX) - 0.008, col);
    uint bm = uint(sets.w);
    while (bm != 0u) {
        uint bit = bm & (~bm + 1u);
        bm ^= bit;
        int k = int(log2(float(bit)) + 0.5);
        vec4 b = texelFetch(iChannel0, ivec2(k, ROW_BUB), 0);
        vec2 d = p - vec2(b.x * gRatio, b.y);
        float r = b.w;
        float dist = length(d) - r;
        float a = cover(dist, gPx);
        if (a <= 0.0) continue;
        float rim = cover(abs(dist + 0.25 * r) - 0.2 * r, gPx);
        vec3 c = mix(col * 0.92 + 0.06, vec3(0.95, 1.0, 1.0), rim * 0.6);
        c = mix(c, vec3(1.0), cover(length(d - vec2(-0.35, 0.35) * r) - 0.25 * r, gPx));
        col = mix(col, c, a);
    }

    // Light from the surface: rays, shade under windows.
    float rays = godRays(p) * LIGHT_RAYS * light;
    col += mix(vec3(1.0, 0.98, 0.88) * 0.22, vec3(0.35, 0.55, 1.0) * 0.1, gNight) * rays;
    col *= mix(0.72, 1.0, light);

    // Surface: a bright rippling line, a silvery underside, air above.
    float ys = SURFACE + 0.0022 * sin(p.x * 31.0 + TW(48.0)) + 0.0014 * sin(p.x * 57.0 - TW(70.0) + 1.0)
             + 0.0008 * sin(p.x * 97.0 + TW(110.0));
    float ds = p.y - ys;
    if (ds > 0.0) {
        vec3 air = backWall(p, water);
        air *= 1.0 + 0.25 * smoothstep(0.05, 0.0, ds);
        col = mix(col, air, cover(-ds, gPx));
    } else if (ds > -0.02) {
        float k = 1.0 + ds / 0.02;
        float shimmer = 0.5 + 0.5 * sin(p.x * 140.0 + TW(90.0) + 8.0 * ds / 0.02);
        col = mix(col, col * 1.12 + vec3(0.07, 0.09, 0.09), k * k * (0.45 + 0.35 * shimmer));
    }
    col += vec3(0.85, 1.0, 1.0) * exp(-abs(ds) / (1.3 * gPx)) * 0.55;

    // Night: moonlight, glowing plankton and neon.
    if (gNight > 0.0) {
        vec3 moon = col * vec3(0.3, 0.42, 0.74) + vec3(0.0, 0.01, 0.03);
        col = mix(col, moon, gNight);
        if (p.y < SURFACE) {
            vec2 g = p * 22.0 + vec2(0.4 * sin(TW(3.0)), 0.6 * sin(TW(2.0) + 1.0));
            vec2 cell = floor(g);
            vec2 h = hash22(cell);
            vec2 d = g - cell - 0.25 - 0.5 * h;
            float tw = 0.5 + 0.5 * sin(TW(40.0 + floor(h.x * 30.0)) + h.y * 6.2831853);
            float speck = step(0.55, h.y) * exp(-dot(d, d) * mix(1400.0, 500.0, fract(h.x * 9.1))) * tw;
            glow += vec3(0.25, 0.9, 1.0) * speck * 0.9;
        }
        col += glow * 0.7 * gNight;
    }

    // Soft vignette.
    vec2 uv = fragCoord / res;
    col *= 1.0 - 0.22 * pow(length((uv - 0.5) * vec2(1.0, 1.2)), 2.4);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
