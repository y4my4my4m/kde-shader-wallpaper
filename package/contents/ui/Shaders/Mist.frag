// URL: https://www.shadertoy.com/view/wdBGWD
// By lsdlive
//
// "Mist" by Ohno (Cookie 2018) — Lsdlive's 4 KiB demo part.
// Original sources: pouet.net/prod.php?which=79350
//                   youtube.com/watch?v=UUtU3WVB144
//
// Notes on this port:
//   The original assigns to non-trivial swizzles and feeds them to
//   inout helpers (e.g. `p.xy *= r2d(t);`, `amod2(p.xz, …)`). With
//   the engine's GLSL 330 wrapper, several NVIDIA driver versions
//   crash the linker with the internal error
//       C9999: Can't convert to expr: vec3:@p…[ivec2:@TMP]
//   while trying to lower those compound-swizzle ops into IR. We
//   route every swizzle mutation through small helpers that take and
//   return a vec3, so the swizzle is never an LHS or an out-param.

float time = 0.;

float random(vec2 uv) {
    return fract(sin(dot(uv, vec2(12.2544, 35.1571))) * 5418.548416);
}

mat2 r2d(float a) {
    float c = cos(a), s = sin(a);
    // Original anti-clockwise convention preserved.
    return mat2(c, s, -s, c);
}

vec3 re(vec3 p, float d) {
    return mod(p - d * .5, d) - d * .5;
}

void amod2(inout vec2 p, float d) {
    float a = mod(atan(p.y, p.x) + d * .5, d) - d * .5;
    p = vec2(cos(a), sin(a)) * length(p);
}

void mo(inout vec2 p, vec2 d) {
    p = abs(p) - d;
    if (p.y > p.x) p = p.yx;
}

// -- vec3 helpers ----------------------------------------------------
// Each takes a vec3 by value, mutates a vec2 _local_ contiguous
// copy, and returns the rebuilt vec3. This keeps the bad NV
// optimizer paths (compound swizzle assigns, non-contiguous out
// params) out of the main body entirely.
vec3 rotXY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x * c + p.y * s, -p.x * s + p.y * c, p.z);
}

vec3 amodXY(vec3 p, float d) {
    vec2 q = p.xy;
    amod2(q, d);
    return vec3(q, p.z);
}

vec3 moXY(vec3 p, vec2 d) {
    vec2 q = p.xy;
    mo(q, d);
    return vec3(q, p.z);
}

vec3 amodXZ(vec3 p, float d) {
    vec2 q = vec2(p.x, p.z);
    amod2(q, d);
    return vec3(q.x, p.y, q.y);
}

vec3 moXZ(vec3 p, vec2 d) {
    vec2 q = vec2(p.x, p.z);
    mo(q, d);
    return vec3(q.x, p.y, q.y);
}
// --------------------------------------------------------------------

vec3 get_cam(vec3 ro, vec3 ta, vec2 uv) {
    vec3 fwd = normalize(ta - ro);
    vec3 right = normalize(cross(fwd, vec3(0, 1, 0)));
    return normalize(fwd + right * uv.x + cross(right, fwd) * uv.y);
}

// signed cube — iq, https://iquilezles.org/articles/distfunctions/
float cube(vec3 p, vec3 b) {
    b = abs(p) - b;
    return min(max(b.x, max(b.y, b.z)), 0.) + length(max(b, 0.));
}

// iq's signed cross sc() — https://iquilezles.org/articles/menger/
float sc(vec3 p, float d) {
    p = abs(p);
    p = max(p, p.yzx);
    return min(p.x, min(p.y, p.z)) - d;
}


////////////////////////// SHADER LSDLIVE //////////////////////////

float prim(vec3 p) {
    p = rotXY(p, 3.14 * .5 + p.z * .1);
    p = amodXY(p, 6.28 / 3.);
    p.x = abs(p.x) - 9.;

    p = rotXY(p, p.z * .2);

    p = amodXY(p, 6.28 / mix(
        mix(10., 5., smoothstep(59.5, 61.5, time)),
        3.,
        smoothstep(77.5, 77.75, time)));
    p = moXY(p, vec2(2.));

    p.x = abs(p.x) - .6;
    return length(p.xy) - .2;
}

float g = 0.; // glow

float de(vec3 p) {

    if (time > 109.2) {
        p = moXY(p, vec2(.2));
        p.x -= 10.;
    }

    if (time > 101.4) {
        p = rotXY(p, time * .2);
    }

    if (time > 106.5) {
        p = moXY(p, vec2(5. + sin(time) * 3. * cos(time * .5), 0.));
    }

    if (time > 104.) {
        p = amodXY(p, 6.28 / 3.);
        p.x += 5.;
    }

    if (time > 101.4) {
        p = moXY(p, vec2(2. + sin(time) * 3. * cos(time * .5), 0.));
    }

    p = rotXY(p, time * .05);
    p = rotXY(p, p.z * mix(.05, .002, step(89.5, time)));

    p.x += sin(time) * smoothstep(77., 82., time);

    p = amodXY(p, 6.28 / mix(
        mix(1., 2., smoothstep(63.5, 68.5, time)),
        5.,
        smoothstep(72., 73.5, time)));
    p.x -= 21.;

    vec3 q = p;

    p = rotXY(p, p.z * .1);

    p = amodXY(p, 6.28 / 3.);
    p.x = abs(p.x) - mix(20., 5., smoothstep(49.5, 55., time));

    p = rotXY(p, p.z * mix(1., .2, smoothstep(77.5, 77.75, time)));

    // Scalar form of `re()` for p.z; avoids the .zzz swizzle round-
    // trip through a vec3 helper that NV's optimizer crashed on.
    p.z = mod(p.z + 1.5, 3.) - 1.5;

    p.x = abs(p.x);
    p = amodXY(p, 6.28 / mix(6., 3., smoothstep(77.75, 78.5, time)));

    float sc1 = sc(p, mix(8., 1., smoothstep(45.5, 51., time)));

    p = amodXZ(p, 6.28 / mix(3., 8., smoothstep(61.5, 65.5, time)));
    p = moXZ(p, vec2(.1));

    p.x = abs(p.x) - 1.;

    float d = cube(p, vec3(.2, 10., 1.));
    d = max(d, -sc1) - mix(.01, 2., smoothstep(56., 58.5, time));

    g += .006 / (.01 + d * d);

    d = min(d, prim(q));

    g += .004 / (.013 + d * d);

    return d;
}


////////////////////////// RAYMARCHING FUNCTIONS //////////////////////////


vec3 raymarch_lsdlive(vec3 ro, vec3 rd, vec2 uv) {
    vec3 p = vec3(0.0);
    float t = 0.;
    float ri = 0.;

    float dither = random(uv);

    // Fixed integer loop (50 iterations) — keeps the compiler from
    // unrolling a float-stepped loop and producing a giant inlined
    // mess that historically tripped NV's linker.
    for (int j = 0; j < 50; ++j) {
        ri = float(j) * .02;
        p = ro + rd * t;
        float d = de(p);
        d *= 1. + dither * .05; // anti-banding noise (leon)
        d = max(abs(d), .002);  // phantom mode (aiekick)
        t += d * .5;
    }

    vec3 c = mix(vec3(.9, .8, .6), vec3(.1, .1, .2), length(uv) + ri);
    c.r += sin(p.z * .1) * .2;
    c += g * .035; // glow (balkhan)
    return c;
}

// borrowed from (mmerchante) — https://www.shadertoy.com/view/MltcWs
// All seeds turned into floats — the original mixed `int` and `mod()`
// on time which forced extra integer conversions that NV's optimizer
// did not love when combined with the rest of this shader.
void glitch(inout vec2 uv, float start_time_stamp, float end_time_stamp)
{
    float offset = floor(time) * 2.0 + (uv.x + uv.y) * 8.0;
    float res = mix(10., 100.0, random(vec2(offset, offset + 17.0)));

    if (time > start_time_stamp && time <= end_time_stamp) uv = floor(uv * res) / res;

    float seedX = floor((gl_FragCoord.x + time) / 32.0);
    float seedY = floor((gl_FragCoord.y + time) / 32.0);
    float seed  = mix(seedY, seedX, step(1.0, mod(time, 2.0)));
    float r     = random(vec2(seed, seed + 13.37));

    uv.x += (r * 2.0 - 1.0)
        * step(r, pow(abs(sin(time * 4.0)), 7.0))
        * r
        * step(start_time_stamp, time)
        * (1.0 - step(end_time_stamp, time));
}

////////////////////////// MAIN FUNCTION //////////////////////////

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 q  = fragCoord.xy / iResolution.xy;
    vec2 uv = (q - .5) * iResolution.xx / iResolution.yx;

    time = mod(iTime, 43. + 10.4);
    time = time + 45.;
    if (time > 88. && time <= 98.6)
        time += 10.6;

    glitch(uv, 0., 2.);
    glitch(uv, 98., 99.);
    glitch(uv, 100.5, 101.5);
    glitch(uv, 103., 104.);
    glitch(uv, 105.5, 106.5);

    vec3 lsd_ro     = vec3(0, 0, -4. + time * 8.);
    vec3 lsd_target = vec3(0., 0., time * 8.);
    vec3 lsd_cam    = get_cam(lsd_ro, lsd_target, uv);

    vec3 col = vec3(0.);

    if (time > 45. && time <= 88.)
        col = raymarch_lsdlive(lsd_ro, lsd_cam, uv);

    if (time > 98.6 && time <= 109.)
        col = raymarch_lsdlive(lsd_ro, lsd_cam, uv);

    col *= 0.5 + 0.5 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.25);

    fragColor = vec4(col, 1.);
}
