// Orbits — a gravity sandbox in deep space.
// @channels bufferA, tex1, bufferB
// @sim-max-height 360
//
// Every window is a massive body: it weighs in proportion to its area, its
// gravity well glows around its edges and the stars behind it bend. Moons
// orbit the windows trailing light, and asteroids drift in from the screen
// edges and swing past. Drag a window and its well goes with it: orbits
// wobble, bodies are flung away in slingshots, and anything that touches a
// window edge shatters into sparks. Bodies that collide merge. With no
// windows (Show Desktop) a star lights up in the middle of the screen.
//
// Press on bare desktop and pull back to aim: the dotted path shows where
// the body will fly, and releasing launches it the other way, like a
// slingshot. A plain click places a small moon on a circular orbit around
// the nearest window. The cursor over a body highlights it.
//
// iChannel0  Buffer A: bodies, bursts and input (see orbits_common.frag).
// iChannel1  Wallpaper ("Image 2" in the settings), darkened, as the sky.
//            Without one a nebula and a parallax star field are drawn.
// iChannel2  Buffer B: trail light.
//
// Lengths are in H units: pixels / iResolution.y.

const float GRAVITY         = 1.0;   // @range(0.25, 3.0, 0.05) @label("Gravity") @shared
const float TRAIL_SECONDS   = 4.0;   // @range(0.3, 12.0, 0.1) @label("Trail length (s)") @shared
const int   MAX_BODIES      = 40;    // @range(8, 64, 1) @label("Max bodies") @shared
const bool  ASTEROIDS       = true;  // @label("Ambient asteroids") @shared
const bool  CENTRAL_STAR    = true;  // @label("Star when no windows") @shared
const bool  TRAILS_BY_SPEED = false; // @label("Colour trails by speed") @shared
const float LAUNCH_POWER    = 1.0;   // @range(0.3, 3.0, 0.05) @label("Slingshot power") @shared
const float BODY_SIZE       = 1.0;   // @range(0.5, 2.5, 0.05) @label("Body size") @shared
const float TRAIL_GLOW      = 1.0;   // @range(0.0, 2.5, 0.05) @label("Trail brightness")
const float WELL_GLOW       = 1.0;   // @range(0.0, 2.0, 0.05) @label("Window glow")
const vec3  WELL_COLOUR     = vec3(0.60, 0.55, 1.00); // @color @label("Window glow colour")
const float LENSING         = 1.0;   // @range(0.0, 2.0, 0.05) @label("Lensing")
const float NEBULA          = 1.0;   // @range(0.0, 2.0, 0.05) @label("Nebula")
const float STARFIELD       = 1.0;   // @range(0.0, 2.0, 0.05) @label("Star field")
const float IMAGE_DIM       = 0.4;   // @range(0.05, 1.0, 0.05) @label("Image 2 brightness")

float gRatio;  // image aspect / Buffer A aspect: Buffer A x times gRatio is image x
float gPx;     // one pixel, H
float gClock;  // animation clock, s, wraps at LOOP
float gStar;   // central star 0..1

// ------------------------------------------------------------- noise

float vnoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), w.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), w.x), w.y);
}

// Value noise periodic in x with an integer period.
float pnoise(vec2 p, float period)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, period);
    float x1 = mod(i.x + 1.0, period);
    return mix(mix(hash12(vec2(x0, i.y)), hash12(vec2(x1, i.y)), w.x),
               mix(hash12(vec2(x0, i.y + 1.0)), hash12(vec2(x1, i.y + 1.0)), w.x), w.y);
}

float fbm(vec2 p)
{
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        s += a * vnoise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.0;
        a *= 0.5;
    }
    return s / 0.9375;
}

// Sine making n whole cycles per LOOP seconds of the clock, seamless across
// its wrap.
float wave(float n, float phase) { return sin(TAU * (n * gClock / LOOP + phase)); }

// ------------------------------------------------------------- sky

// Deflection of the sky behind the windows and the star: each mass shifts
// the image away from its core by GM K / d (point-lens form, softened).
vec2 lensOffset(vec2 p)
{
    const float K = 0.075;
    vec2 o = vec2(0.0);
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = winNow(i);
        if (!windowOk(r)) continue;
        float s;
        vec2 dv = coreOffset(p, r, s);
        o += dv * (winGM(r) / GRAVITY * K / (dot(dv, dv) + s * s));
    }
    if (gStar > 0.0) {
        vec2 dv = p - starPos();
        o += dv * (STAR_GM * gStar * K / (dot(dv, dv) + 0.0016));
    }
    return o * LENSING;
}

// One layer of stars on a grid of `cells` per H; `dens` of the cells hold a
// star.
vec3 starLayer(vec2 q, float cells, float dens, float bright, float seed)
{
    vec2 g = q * cells;
    vec2 id = floor(g);
    float h = hash12(id + seed);
    if (h > dens) return vec3(0.0);
    vec2 f = fract(g) - 0.5 - (vec2(hash12(id + seed + 17.3), hash12(id + seed + 41.9)) - 0.5) * 0.6;
    vec2 d = f / cells;
    float mag = pow(hash12(id + seed + 5.1), 5.0);
    // Radius in H, widened to 0.6 px with the peak lowered by r0 / r, so
    // the field looks alike at every render scale.
    float r0 = 0.0006 * (0.6 + 1.4 * mag);
    float r = max(r0, 0.6 * gPx);
    float core = exp(-dot(d, d) / (r * r)) * r0 / r;
    // Diffraction cross on the brightest.
    float spike = mag > 0.55 ? (exp(-abs(d.x) / (0.5 * gPx)) * exp(-abs(d.y) / 0.003)
                              + exp(-abs(d.y) / (0.5 * gPx)) * exp(-abs(d.x) / 0.003)) * 0.3 * mag : 0.0;
    float tw = 0.78 + 0.22 * wave(floor(2000.0 + 5000.0 * hash12(id + seed + 3.3)), h * 7.0);
    vec3 tint = mix(vec3(0.68, 0.80, 1.00), vec3(1.00, 0.86, 0.68), hash12(id + seed + 9.7));
    return tint * (core + spike) * (0.4 + 1.8 * mag) * tw * bright;
}

vec3 sky(vec2 q, vec2 par)
{
    if (iChannelResolution[1].x > 0.0) {
        vec2 uv = q / vec2(iResolution.x / iResolution.y, 1.0);
        vec2 texRes = iChannelResolution[1].xy;
        float sa = iResolution.x / iResolution.y;
        float ta = texRes.x / texRes.y;
        vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
        vec3 c = texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        return mix(vec3(l), c, 0.8) * IMAGE_DIM * vec3(0.86, 0.92, 1.08);
    }
    vec2 nq = q + par * 0.25;
    float n1 = fbm(nq * 1.3 + vec2(3.1, 7.7));
    float n2 = fbm(nq * 2.4 + vec2(2.0 * n1, -1.3 * n1));
    float lanes = fbm(nq * 5.0 + vec2(n2, 11.0));
    float dens = smoothstep(0.42, 0.95, 0.55 * n1 + 0.65 * n2);
    vec3 col = vec3(0.006, 0.008, 0.020);
    vec3 neb = mix(vec3(0.16, 0.05, 0.22), vec3(0.03, 0.15, 0.22), smoothstep(0.35, 0.75, n2));
    neb = mix(neb, vec3(0.28, 0.10, 0.18), smoothstep(0.65, 0.9, n1) * 0.5);
    col += neb * dens * (0.35 + 0.65 * smoothstep(0.25, 0.75, lanes)) * 0.75 * NEBULA;
    col += vec3(0.02, 0.025, 0.05) * smoothstep(0.2, 0.9, n1) * NEBULA;

    vec3 st = starLayer(q + par * 0.2, 80.0, 0.25, 0.45, 0.0);
    st += starLayer(q + par * 0.5, 32.0, 0.20, 0.75, 31.0);
    st += starLayer(q + par * 1.0, 14.0, 0.16, 1.05, 77.0);
    return col + st * STARFIELD * (0.8 + 0.4 * dens);
}

// ------------------------------------------------------------- wells

// Glow around each window: a hot rim on the edge, an accretion band with
// thin filaments flowing counter-clockwise, and a broad cool halo; brighter
// for heavier windows, smeared behind a moving one.
vec3 wellGlow(vec2 p)
{
    vec3 acc = vec3(0.0);
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = winNow(i);
        if (!windowOk(r)) continue;
        vec2 hs = 0.5 * r.zw;
        vec2 q = p - r.xy - hs;
        vec2 lag = -iWindowVelocities[i] / iResolution.y * 0.07;
        float d = sdBox(q, hs);
        float dl = min(sdBox(q - 0.5 * lag, hs), sdBox(q - lag, hs));
        if (min(d, dl) > 0.5) continue;
        float k = sqrt(clamp(r.z * r.w, AREA_MIN, AREA_MAX) / AREA_MAX);
        float de = max(d, 0.0);
        float rim = exp(-de / (1.2 * gPx + 0.0006));
        float band = exp(-de / (0.005 + 0.008 * k));
        float halo = exp(-de / (0.06 + 0.08 * k));
        float smear = exp(-max(dl, 0.0) / 0.015) * (1.0 - exp(-de / 0.008));
        float fil = 0.0;
        if (de < 0.05) {
            // Filaments: long along the edge (cells of about 0.07 H around
            // the perimeter), thin across it.
            float N = max(floor(4.0 * (hs.x + hs.y) / 0.07), 3.0);
            float u = (atan(q.y / hs.y, q.x / hs.x) / TAU + 0.5) * N;
            float f1 = pnoise(vec2(u - gClock * 0.35, de * 300.0 + float(i) * 17.0), N);
            float f2 = pnoise(vec2(2.0 * u - gClock * 0.6, de * 520.0 + 5.0), 2.0 * N);
            fil = smoothstep(0.5, 1.0, 0.6 * f1 + 0.4 * f2 + 0.1);
        }
        vec3 violet = vec3(0.50, 0.25, 0.95);
        acc += k * (vec3(1.0, 0.92, 0.80) * rim * 0.45
                    + WELL_COLOUR * band * (0.10 + 0.45 * fil)
                    + mix(WELL_COLOUR, violet, 0.6) * exp(-de / 0.022) * 0.05
                    + vec3(0.30, 0.34, 1.0) * halo * 0.05)
             + WELL_COLOUR * smear * 0.3 * k;
    }
    return acc * WELL_GLOW;
}

vec3 centralStar(vec2 p)
{
    if (gStar <= 0.0) return vec3(0.0);
    float a = smoothstep(0.0, 1.0, gStar);
    vec2 q = p - starPos();
    float d = length(q);
    float R = STAR_R * a;
    float ang = atan(q.y, q.x) / TAU + 0.5;
    float rays = pnoise(vec2(ang * 28.0, gClock * 0.35), 28.0) * 0.6
               + pnoise(vec2(ang * 61.0, gClock * 0.6 + 9.0), 61.0) * 0.4;
    float corona = exp(-max(d - R, 0.0) / (0.012 + 0.03 * rays * rays)) * 0.75
                 + exp(-max(d - R, 0.0) / 0.09) * 0.22 + exp(-d / 0.4) * 0.06;
    vec3 col = vec3(1.0, 0.66, 0.34) * corona * a;
    if (d < R + gPx) {
        float mu = sqrt(max(1.0 - d * d / (R * R), 0.0));
        float gran = vnoise(q / max(R, 1e-3) * 7.0 + vec2(gClock * 0.05, 0.0));
        vec3 disc = mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.97, 0.88), pow(mu, 0.5)) * (0.9 + 0.1 * gran);
        float cov = clamp((R - d) / gPx + 0.5, 0.0, 1.0);
        col = mix(col, disc * 1.15, cov);
    }
    return col;
}

// ------------------------------------------------------------- bodies

float segDist(vec2 p, vec2 a, vec2 b, out float h)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-10), 0.0, 1.0);
    return length(pa - ba * h);
}

// Direction from point b towards its strongest attractor, the source of the
// light on its disc.
vec2 lightFrom(vec2 b)
{
    vec2 c = vec2(0.0, 1.0) + b;
    float best = 0.0;
    if (gStar > 0.0) {
        c = starPos();
        best = STAR_GM * gStar / max(dot(b - c, b - c), 1e-4);
    }
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = winNow(i);
        if (!windowOk(r)) continue;
        vec2 wc = r.xy + 0.5 * r.zw;
        float a = winGM(r) / GRAVITY / max(dot(b - wc, b - wc), 1e-4);
        if (a > best) {
            best = a;
            c = wc;
        }
    }
    return normalize(c - b);
}

void drawBurst(int j, vec2 p, inout vec3 col)
{
    vec2 sx = vec2(gRatio, 1.0);
    vec4 E = texelFetch(iChannel0, ivec2(j, ROW_E), 0);
    if (E.w < 0.5 || E.z >= BURST_LIFE) return;
    vec2 dc = p - E.xy * sx;
    vec4 F = texelFetch(iChannel0, ivec2(j, ROW_F), 0);
    float reach = (0.31 * F.z + length(F.xy)) / SPARK_DRAG + 0.08;
    if (dot(dc, dc) > reach * reach) return;
    float t = E.z;
    vec3 bc = burstColour(E.w);
    float fr = 0.004 + 0.014 * F.z;
    col += mix(bc, vec3(1.0), 0.6) * (1.3 * exp(-t * 10.0) * exp(-dot(dc, dc) / (fr * fr)));
    float rr = 0.005 + 0.06 * F.z * (1.0 - exp(-4.5 * t));
    float rd = (length(dc) - rr) / (0.0012 + 0.003 * t);
    col += bc * (0.55 * F.z * exp(-rd * rd) * exp(-t * 3.2));
    float sz = 1.1 * gPx + 0.0007;
    for (int k = 0; k < SPARKS; k++) {
        vec3 s = sparkAt(E, F, k, t);
        if (s.z <= 0.0) continue;
        vec2 e = dc - s.xy * sx;
        float tw = 0.7 + 0.3 * sin(t * 30.0 + float(k) * 2.1);
        col += mix(bc, vec3(1.0), 0.45) * (1.5 * s.z * tw * exp(-dot(e, e) / (sz * sz)));
    }
}

// Bursts within reach of p, found through the cull row.
void drawBursts(vec2 p, inout vec3 col)
{
    const float REACH = 0.3;
    vec2 sx = vec2(gRatio, 1.0);
    for (int k = 0; k < (MAX_BODIES + 3) / 4; k++) {
        vec4 c = texelFetch(iChannel0, ivec2(k, ROW_S), 0);
        if (c.x + c.y + c.z + c.w < 0.5) continue;
        vec2 d0 = p - unpackPos(c.x) * sx;
        vec2 d1 = p - unpackPos(c.y) * sx;
        vec2 d2 = p - unpackPos(c.z) * sx;
        vec2 d3 = p - unpackPos(c.w) * sx;
        if (c.x > 0.5 && dot(d0, d0) < REACH * REACH) drawBurst(4 * k, p, col);
        if (c.y > 0.5 && dot(d1, d1) < REACH * REACH) drawBurst(4 * k + 1, p, col);
        if (c.z > 0.5 && dot(d2, d2) < REACH * REACH) drawBurst(4 * k + 2, p, col);
        if (c.w > 0.5 && dot(d3, d3) < REACH * REACH) drawBurst(4 * k + 3, p, col);
    }
}

void drawBody(int i, vec2 p, vec2 mouse, inout vec3 col)
{
    vec2 sx = vec2(gRatio, 1.0);
    vec4 P = texelFetch(iChannel0, ivec2(i, ROW_P), 0);
    vec2 bp = P.xy * sx;
    vec2 bv = P.zw * sx;
    vec2 d = p - bp;
    float sp = length(bv);
    float tl = min(sp * 0.09, 0.05);
    float reach = 0.045 + tl;
    if (dot(d, d) > reach * reach) return;
    vec4 Q = texelFetch(iChannel0, ivec2(i, ROW_Q), 0);
    if (Q.w < 0.5) return;
    int kind = kindOf(Q.z);
    float r = radiusOf(Q.x);
    vec3 bc = bodyColour(Q.z);
    float a = 1.0;
    float form = 1.0;
    if (condensing(Q.z)) {
        form = smoothstep(0.0, FADE_IN, Q.y);
        a = form;
    }
    if (Q.w >= 1.5) a *= 1.0 - clamp(Q.w - 2.0, 0.0, 1.0);
    float glowK = kind == K_ROCK ? 0.45 : 1.0;
    float dist = length(d);

    // Short crisp tail along the velocity.
    if (sp > 1e-4) {
        float h;
        float dd = segDist(p, bp, bp - bv / sp * tl, h);
        float wd = r * 0.5 * (1.0 - h) + 0.6 * gPx;
        col += bc * (0.55 * glowK * a * (1.0 - h) * (1.0 - h) * exp(-dd * dd / (wd * wd)));
    }

    float glow = exp(-dist / (r * 1.4)) * 0.75 + exp(-dist / (r * 5.0)) * 0.16;
    col += bc * (glow * glowK * a);

    if (dist < r + gPx) {
        vec3 n = vec3(d / r, sqrt(max(1.0 - dot(d, d) / (r * r), 0.0)));
        vec3 L = normalize(vec3(lightFrom(bp), 0.45));
        float diff = max(dot(n, L), 0.0);
        vec3 surf;
        if (kind == K_ROCK) {
            float spots = vnoise(d / r * 2.5 + float(i) * 7.0);
            surf = bc * (0.22 + 0.8 * diff) * (0.75 + 0.35 * spots);
        } else {
            surf = mix(bc * 0.5, mix(bc, vec3(1.0), 0.6), diff);
            surf += bc * pow(1.0 - n.z, 2.0) * 0.5;
        }
        float cov = clamp((r - dist) / gPx + 0.5, 0.0, 1.0);
        col = mix(col, surf, cov * a);
    }

    // Condensing: a ring of dust drawing in.
    if (form < 1.0) {
        float rr = r + 0.035 * (1.0 - form);
        float rd = (dist - rr) / (0.0015 + 0.004 * (1.0 - form));
        col += bc * (0.5 * (1.0 - form) * form * 4.0 * exp(-rd * rd));
    }

    // Cursor highlight.
    float md = length(mouse - bp);
    if (md < r + 0.02) {
        float hk = 1.0 - smoothstep(r, r + 0.02, md);
        float rd = (dist - r - 0.007) / (0.9 * gPx + 0.0006);
        col += mix(bc, vec3(1.0), 0.6) * (0.6 * hk * a * exp(-rd * rd));
        col += bc * (0.25 * hk * a * exp(-dist / (r * 3.0)));
    }
}

// Bodies within reach of p, found through the cull row: glow 0.045 H, tail
// up to 0.05 H, and one substep of travel at SPEED_MAX.
void drawBodies(vec2 p, vec2 mouse, inout vec3 col)
{
    const float REACH = 0.11;
    vec2 sx = vec2(gRatio, 1.0);
    for (int k = 0; k < (MAX_BODIES + 3) / 4; k++) {
        vec4 c = texelFetch(iChannel0, ivec2(k, ROW_R), 0);
        if (c.x + c.y + c.z + c.w < 0.5) continue;
        vec2 d0 = p - unpackPos(c.x) * sx;
        vec2 d1 = p - unpackPos(c.y) * sx;
        vec2 d2 = p - unpackPos(c.z) * sx;
        vec2 d3 = p - unpackPos(c.w) * sx;
        if (c.x > 0.5 && dot(d0, d0) < REACH * REACH) drawBody(4 * k, p, mouse, col);
        if (c.y > 0.5 && dot(d1, d1) < REACH * REACH) drawBody(4 * k + 1, p, mouse, col);
        if (c.z > 0.5 && dot(d2, d2) < REACH * REACH) drawBody(4 * k + 2, p, mouse, col);
        if (c.w > 0.5 && dot(d3, d3) < REACH * REACH) drawBody(4 * k + 3, p, mouse, col);
    }
}

void drawAim(vec2 p, vec2 mouse, inout vec3 col)
{
    vec4 g0 = texelFetch(iChannel0, ivec2(0, ROW_G), 0);
    if (g0.x < 0.5) return;
    vec2 sx = vec2(gRatio, 1.0);
    vec2 o = texelFetch(iChannel0, ivec2(1, ROW_G), 0).xy * sx;
    float launches = texelFetch(iChannel0, ivec2(3, ROW_G), 0).y;
    vec3 c = hueColour(int(mod(launches, 6.0)));
    float pull = length(o - mouse);
    bool click = pull < CLICK_DRAG;
    float r = radiusOf(click ? GM_MOON : GM_PLANET);
    float appear = smoothstep(0.0, 0.15, g0.z);

    // Ghost of the body at the press point, with a breathing ring.
    float d = length(p - o);
    col += c * (0.5 * appear * exp(-d / (r * 1.4)));
    float rr = r + 0.012 + 0.003 * sin(g0.z * 6.0);
    float rd = (d - rr) / (0.9 * gPx + 0.0005);
    col += c * (0.5 * appear * exp(-rd * rd));

    // The pulled band, dashed.
    if (!click) {
        float h;
        float dd = segDist(p, o, mouse, h);
        float dash = smoothstep(0.35, 0.5, abs(fract(h * pull / 0.012) - 0.5) * 2.0);
        float bw = 0.8 * gPx + 0.0005;
        col += vec3(0.85, 0.9, 1.0) * (0.22 * appear * (1.0 - dash) * exp(-dd * dd / (bw * bw)));
    }

    // Trajectory preview.
    for (int k = 0; k < NPREV; k++) {
        vec4 V = texelFetch(iChannel0, ivec2(k, ROW_V), 0);
        if (V.w < 0.5) continue;
        vec2 e = p - V.xy * sx;
        if (V.w > 1.5) {
            // Impact: a small cross.
            vec2 ae = abs(mat2(0.7071, 0.7071, -0.7071, 0.7071) * e);
            float arm = max(ae.x, ae.y) < 0.008 ? exp(-pow(min(ae.x, ae.y) / (0.8 * gPx + 0.0004), 2.0)) : 0.0;
            col += vec3(1.0, 0.55, 0.35) * (0.8 * appear * arm);
            continue;
        }
        float sz = gPx * 0.9 + 0.0016 * (0.4 + 0.6 * V.z);
        col += mix(c, vec3(1.0), 0.3) * (0.85 * appear * (0.25 + 0.75 * V.z) * exp(-dot(e, e) / (sz * sz)));
    }
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float H = iResolution.y;
    vec2 p = fragCoord / H;
    gPx = 1.0 / H;
    vec2 bres = iChannelResolution[0].xy;
    gRatio = bres.y > 0.0 ? (iResolution.x / H) / (bres.x / bres.y) : 1.0;
    vec4 g1 = texelFetch(iChannel0, ivec2(1, ROW_G), 0);
    vec4 g2 = texelFetch(iChannel0, ivec2(2, ROW_G), 0);
    gClock = g2.w;
    gStar = g2.z;
    vec2 mouse = iMouse.xy / H;
    vec2 par = (g1.zw * vec2(gRatio, 1.0) - starPos()) * vec2(-0.012, -0.012);

    vec3 col = sky(p - lensOffset(p), par);

    vec2 uv = fragCoord / iResolution.xy;
    vec2 tx = 1.0 / max(iChannelResolution[2].xy, vec2(1.0));
    vec3 tr = texture(iChannel2, uv).rgb;
    vec3 bl = texture(iChannel2, uv + vec2(1.9, 1.1) * tx).rgb + texture(iChannel2, uv - vec2(1.9, 1.1) * tx).rgb;
    vec3 t = (tr * 0.75 + bl * 0.22) * TRAIL_GLOW;
    col += t / (1.0 + 0.35 * t);

    col += wellGlow(p);
    col += centralStar(p);
    drawBursts(p, col);
    drawBodies(p, mouse, col);
    drawAim(p, mouse, col);

    // Highlight shoulder above 0.75.
    vec3 over = max(col - 0.75, 0.0);
    col = min(col, vec3(0.75)) + 0.25 * (1.0 - exp(-over / 0.25));
    fragColor = vec4(col, 1.0);
}
