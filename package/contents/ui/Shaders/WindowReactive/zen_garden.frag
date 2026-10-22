// Zen Garden — a raked dry garden of pale gravel around your windows.
// @channels bufferA, tex1
// @sim-max-height 360
//
// Rake lines run across the garden and every window is a rock: around it
// the lines give way to concentric rings. Move a window and the rings where
// it stood smooth out while a rake draws fresh rings around its new place.
// The cursor is a small hand rake that carves furrows as it moves (deeper
// with a button held); a gardener comes by and re-rakes disturbed gravel one
// band at a time over a few minutes, and a rock whose rings were disturbed
// gets a fresh lap. Click bare gravel to drop a stone that sends out its
// own rings; click a stone to pick it up. The light follows the clock: a
// low warm sun in the morning and evening, a high one at noon, cool
// moonlight and two glowing stone lanterns at night. Moss islands with
// boulders and stepping stones, a pebble edging, and the season by the
// date: cherry petals in spring, a few green leaves in summer, maple leaves
// in autumn, a dusting of snow in winter.
//
// Groove depth, sway, gravel colour, season, leaves, clock light, Image 2
// tint and decor shape only what is drawn. Line spacing, rings around
// windows, re-rake speed, hover raking, stones kept, sway and season are
// shared with Buffer A.
//
// iChannel0  Buffer A: rocks, stones, gardener, leaves and the gravel field
//            (layout in zen_garden_common.frag).
// iChannel1  Image 2: when bound, its colours tint the gravel.
//
// Lengths are in H, the screen height.

const float LINE_SPACING = 1.0;   // @range(0.6, 2.0, 0.05) @label("Rake line spacing") @shared
const float GROOVE_DEPTH = 1.0;   // @range(0.2, 2.0, 0.05) @label("Groove depth")
const float WAVE         = 0.25;  // @range(0.0, 1.0, 0.05) @label("Sway of the rake lines") @shared
const int   WINDOW_RINGS = 5;     // @range(2, 10, 1) @label("Rings around windows") @shared
const float RERAKE_SPEED = 1.0;   // @range(0.25, 4.0, 0.05) @label("Re-rake speed") @shared
const bool  HOVER_RAKE   = true;  // @label("Cursor rakes without a click") @shared
const int   MAX_STONES   = 5;     // @range(1, 12, 1) @label("Stones kept") @shared
const int   SEASON       = 0;     // @range(0, 4, 1) @label("Season: 0 by date, 1 spring, 2 summer, 3 autumn, 4 winter") @shared
const bool  LEAVES       = true;  // @label("Falling leaves and petals")
const bool  CLOCK_LIGHT  = true;  // @label("Light follows the clock")
const float FIXED_HOUR   = 15.5;  // @range(0.0, 24.0, 0.25) @label("Hour when not following the clock")
const vec3  GRAVEL       = vec3(0.80, 0.78, 0.73); // @color @label("Gravel colour")
const float IMAGE_TINT   = 0.4;   // @range(0.0, 1.0, 0.05) @label("Gravel tint from Image 2")
const bool  DECOR        = true;  // @label("Moss islands, lanterns and edging")

const float EDGE_W    = 0.030;   // H, pebble edging strip on each side
const float CURB_W    = 0.007;   // H, granite curb inside the edging
const float HANDLE_L  = 0.20;    // H, rake handle length
const float LANTERN_R = 0.027;   // H, roof apothem

float gA;       // aspect
float gS;       // rake line period, H
float gPx;      // H per output pixel
float gClock;   // s, mod CLOCK_PERIOD
vec3  gL;       // towards the key light
vec2  gL2;      // its ground direction, unit
float gCot;     // ground shadow length per unit height
vec3  gKey;     // key light colour
vec3  gAmb;     // sky light colour
float gNight;   // 0 day .. 1 night
int   gSeason;  // 1 spring .. 4 winter
vec3  gLamp;    // lantern light reaching this pixel, flat ground

// ------------------------------------------------------------- helpers

float sq(float x) { return x * x; }

vec3 sminG(vec3 a, vec3 b, float k)
{
    float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
    return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
}

// Value noise with its gradient (iq).
vec3 vnoiseD(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 du = 6.0 * f * (1.0 - f);
    float a = hash12(i);
    float b = hash12(i + vec2(1, 0));
    float c = hash12(i + vec2(0, 1));
    float d = hash12(i + vec2(1, 1));
    float e = a - b - c + d;
    return vec3(a + (b - a) * u.x + (c - a) * u.y + e * u.x * u.y,
                du * vec2(b - a + e * u.y, c - a + e * u.x));
}

float sdSegment(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

float sdBox(vec2 p, vec2 b)
{
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Flat top and bottom, corners at 0 and 60 degrees; r is the apothem (iq).
float sdHexagon(vec2 p, float r)
{
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}

vec2 rot(vec2 p, float a)
{
    float c = cos(a);
    float s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float cover(float d) { return clamp(0.5 - d / gPx, 0.0, 1.0); }

// Groove profile: x height (1 on a crest, 0 in a groove), y d/dphase.
// Crests at integer phase.
vec2 prof(float phi)
{
    float c = cos(TAU * phi);
    float q = max(0.5 + 0.5 * c, 1e-4);
    float h = pow(q, 0.6);
    return vec2(h, -0.6 * h / q * PI * sin(TAU * phi));
}

// Hand rake furrow across lateral offset x (tine pitches): four grooves,
// gravel heaped on both sides.
vec2 furrowProf(float x)
{
    float ax = abs(x);
    float sg = x < 0.0 ? -1.0 : 1.0;
    vec2 g = prof(x) * 0.95 - vec2(0.12, 0.0);
    float u = (ax - 2.4) / 0.42;
    float e = exp(-u * u);
    vec2 r = vec2(0.5 + 0.75 * e, -0.75 * e * 2.0 * u / 0.42 * sg);
    float t = clamp((ax - 1.7) / 0.4, 0.0, 1.0);
    float w = t * t * (3.0 - 2.0 * t);
    float dw = 6.0 * t * (1.0 - t) / 0.4 * sg;
    return vec2(mix(g.x, r.x, w), mix(g.y, r.y, w) + (r.x - g.x) * dw);
}

// ------------------------------------------------------------- light

void setupLight()
{
    float hr = CLOCK_LIGHT ? mod(iDate.w / 3600.0, 24.0) : FIXED_HOUR;
    float day = smoothstep(5.2, 7.0, hr) * (1.0 - smoothstep(17.6, 19.4, hr));
    gNight = 1.0 - day;
    float alt = clamp(sin(PI * (hr - 6.0) / 12.0), 0.0, 1.0);
    float el = mix(0.16, 1.12, alt);
    float az = 0.5 * PI + clamp((hr - 12.0) / 6.0, -1.0, 1.0) * 1.2;
    vec3 sun = vec3(cos(az) * cos(el), sin(az) * cos(el), sin(el));
    vec3 moon = normalize(vec3(-0.45, 0.62, 0.62));
    gL = normalize(mix(moon, sun, day));
    gL2 = normalize(gL.xy + vec2(0.0, 1e-4));
    gCot = min(length(gL.xy) / max(gL.z, 0.12), 4.0);
    vec3 sunCol = mix(vec3(1.0, 0.80, 0.60), vec3(1.0, 0.96, 0.90), smoothstep(0.05, 0.7, alt));
    gKey = mix(vec3(0.42, 0.48, 0.62) * 0.40, sunCol * mix(0.70, 0.82, alt), day);
    gAmb = mix(vec3(0.19, 0.22, 0.31) * 0.36, mix(vec3(0.66, 0.64, 0.70), vec3(0.60, 0.68, 0.84), alt) * mix(0.50, 0.40, alt), day);
}

// Diffuse from the key light relative to flat ground, so relief reads
// stronger under a low sun.
float keyDiffuse(vec3 n)
{
    return clamp(dot(n, gL) / max(gL.z, 0.45), 0.0, 1.8);
}

float specular(vec3 n, float pw)
{
    return pow(max(dot(reflect(-gL, n), vec3(0.0, 0.0, 1.0)), 0.0), pw);
}

// Lit surface: albedo under sky, key light (sh: key light blocked) and
// lantern light.
vec3 shade(vec3 alb, vec3 n, float sh)
{
    return alb * (gAmb * (0.75 + 0.35 * n.z) + gKey * keyDiffuse(n) * (1.0 - sh) + gLamp * (0.6 + 0.4 * n.z));
}

// ------------------------------------------------------------- decor layout

int islandCount() { return int(clamp(floor(gA * 1.7 + 0.5), 2.0, 5.0)); }

// Island j: xy centre (H), z scale, w rotation.
vec4 islandAt(int j)
{
    float n = float(islandCount());
    float h1 = hash11(float(j) * 7.31 + 1.7);
    float h2 = hash11(float(j) * 3.17 + 5.1);
    float x = ((float(j) + 0.5) / n + (h1 - 0.5) * 0.18 / n) * gA;
    float y = (j % 2 == 0) ? 0.70 + 0.10 * h2 : 0.27 + 0.08 * h2;
    return vec4(x, y, 0.8 + 0.45 * h2, h1 * TAU);
}

// Moss outline of island j (no edge noise) in H, with gradient.
vec3 islandSd(vec2 p, vec4 isl)
{
    vec2 q = rot(p - isl.xy, -isl.w) / isl.z;
    vec3 d = vec3(length(q) - 0.060, normalize(q + 1e-6));
    vec2 q2 = q - vec2(0.070, 0.018);
    d = sminG(d, vec3(length(q2) - 0.040, normalize(q2 + 1e-6)), 0.03);
    vec2 q3 = q - vec2(-0.062, -0.012);
    d = sminG(d, vec3(length(q3) - 0.034, normalize(q3 + 1e-6)), 0.03);
    return vec3(d.x * isl.z, rot(d.yz, isl.w));
}

// Boulder k (0..2) on island j: xy centre (H), z radius, w seed.
vec4 islandRock(vec4 isl, int k)
{
    vec2 o = k == 0 ? vec2(0.006, 0.010) : (k == 1 ? vec2(0.072, 0.022) : vec2(-0.058, -0.016));
    float r = k == 0 ? 0.034 : (k == 1 ? 0.020 : 0.013);
    return vec4(isl.xy + rot(o * isl.z, isl.w), r * isl.z, isl.w * 3.1 + float(k) * 1.7);
}

// Stepping stone k (0..3) leading out of odd island j: xy centre (H), z
// half length, w rotation.
vec4 steppingStone(vec4 isl, int k)
{
    float a = isl.w + 2.3;
    vec2 dir = vec2(cos(a), sin(a));
    float fk = float(k);
    vec2 c = isl.xy + dir * (0.135 * isl.z + 0.05 * fk) + vec2(-dir.y, dir.x) * 0.014 * sin(fk * 1.9 + 0.6);
    return vec4(c, 0.020 + 0.005 * hash11(isl.w * 7.0 + fk), a + 0.4 * sin(fk * 2.3 + isl.w));
}

// Distance to stepping stone s at P with its gradient.
vec3 steppingSd(vec2 P, vec4 st)
{
    vec2 q = rot(P - st.xy, -st.w);
    vec2 b = vec2(st.z, st.z * 0.74);
    vec3 d = sdgRoundBox(q, b, b.y * 0.75);
    float th = atan(q.y, q.x);
    d.x -= st.z * (0.07 * sin(3.0 * th + st.w * 5.0) + 0.04 * sin(5.0 * th + st.w * 9.0));
    return vec3(d.x, rot(d.yz, st.w));
}

vec2 lanternAt(int j)
{
    return j == 0 ? vec2(EDGE_W + 0.075, 0.64) : vec2(gA - EDGE_W - 0.075, 0.36);
}

// ------------------------------------------------------------- objects

// A weathered granite boulder of radius R: rgb lit colour, a coverage.
vec4 boulder(vec2 P, vec2 c, float R, float seed, float sh)
{
    vec2 q = P - c;
    float r = length(q);
    if (r > R * 1.3) return vec4(0.0);
    float th = atan(q.y, q.x);
    float Rt = R * (1.0 + 0.10 * sin(3.0 * th + seed) + 0.06 * sin(5.0 * th + 2.0 * seed) + 0.025 * sin(11.0 * th + 3.0 * seed));
    float cv = cover(r - Rt);
    if (cv <= 0.0) return vec4(0.0);
    float u = clamp(r / Rt, 0.0, 1.0);
    vec2 radial = q / max(r, 1e-6);
    vec3 n1 = vnoiseD(P / (R * 0.6) + seed);
    vec3 n2 = vnoiseD(P / (R * 0.22) + seed * 2.3);
    vec3 n3 = vnoiseD(P / 0.0011 + seed);
    // Dome with a broad top, folded by ridged noise into craggy faces.
    float sl = u / sqrt(max(1.0 - 0.9 * u * u, 0.06)) * smoothstep(0.2, 0.8, u);
    float s1 = n1.x < 0.5 ? -1.0 : 1.0;
    vec2 g = radial * sl * 0.95 + s1 * n1.yz * 0.45 + n2.yz * 0.16 + n3.yz * 0.07;
    vec3 n = normalize(vec3(g, 1.0));
    float crev = 1.0 - smoothstep(0.0, 0.12, abs(n1.x - 0.5));
    vec3 alb = mix(vec3(0.26, 0.25, 0.24), vec3(0.47, 0.45, 0.42), 0.5 * n2.x + 0.5 * vnoise(P / (R * 0.4) + seed * 5.0));
    alb *= 0.82 + 0.36 * n3.x;
    alb = mix(alb, vec3(0.60, 0.62, 0.54), smoothstep(0.72, 0.86, vnoise(P / (R * 0.12) + seed)) * 0.35);
    alb *= 1.0 - 0.35 * crev;
    float ao = mix(0.5, 1.0, smoothstep(1.0, 0.72, u));
    vec3 lit = shade(alb * ao, n, sh) + gKey * specular(n, 14.0) * 0.10 * (1.0 - sh);
    if (gSeason == 4) {
        float cap = smoothstep(0.72, 0.6, u + 0.35 * (n2.x - 0.5) + 0.15 * (n3.x - 0.5));
        vec3 sn = normalize(vec3(g * 0.35, 1.0));
        lit = mix(lit, shade(vec3(0.90, 0.92, 0.96), sn, sh), cap * 0.92);
    }
    return vec4(lit, cv);
}

// Moss of island j at P; d is the island outline distance with gradient.
vec4 moss(vec2 P, vec3 d, float sh)
{
    float edge = d.x + 0.006 * (vnoise(P * 95.0) - 0.5) + 0.003 * (vnoise(P * 330.0) - 0.5);
    float cv = cover(edge);
    if (cv <= 0.0) return vec4(0.0);
    vec3 c1 = vnoiseD(P * 240.0);
    vec3 c2 = vnoiseD(P * 820.0 + 5.0);
    float t = clamp(-edge / 0.02, 0.0, 1.0);
    vec2 mound = -d.yz * 6.0 * t * (1.0 - t) * 0.6;
    vec3 n = normalize(vec3(mound - c1.yz * 0.32 - c2.yz * 0.18, 1.0));
    vec3 alb = mix(vec3(0.11, 0.20, 0.05), vec3(0.27, 0.40, 0.10), c1.x);
    alb = mix(alb, vec3(0.42, 0.52, 0.16), smoothstep(0.62, 0.95, c2.x) * 0.6);
    alb *= mix(0.7, 1.0, smoothstep(0.0, 0.5, t));
    vec3 lit = shade(alb, n, sh);
    if (gSeason == 4) lit = mix(lit, shade(vec3(0.92, 0.94, 0.98), n, sh), smoothstep(0.45, 0.8, 0.6 * c1.x + 0.4 * c2.x) * 0.85);
    return vec4(lit, cv);
}

// Stone lantern seen from above: a hexagonal roof with six facets, hip
// ridges, upturned corners and a jewel finial.
vec4 lantern(vec2 P, int j, float sh)
{
    vec2 q = P - lanternAt(j);
    if (dot(q, q) > sq(LANTERN_R * 1.6)) return vec4(0.0);
    float ang0 = 0.26 + float(j) * 0.5;
    vec2 qr = rot(q, -ang0);
    float R = LANTERN_R;
    float d = sdHexagon(qr, R);
    for (int k = 0; k < 6; k++) {
        vec2 cp = rot(vec2(R * 1.1547 + 0.0012, 0.0), float(k) * PI / 3.0);
        d = min(d, length(qr - cp) - 0.0017);
    }
    float cv = cover(d);
    if (cv <= 0.0) return vec4(0.0);
    float r = length(qr);
    float ang = atan(qr.y, qr.x);
    float sector = (floor(ang / (PI / 3.0)) + 0.5) * (PI / 3.0);
    vec2 fdir = vec2(cos(sector), sin(sector));
    float rho = dot(qr, fdir) / R;
    float slope = rho < 0.9 ? mix(1.4, 0.55, smoothstep(0.15, 0.85, rho)) : -0.7;
    vec3 n = normalize(vec3(rot(fdir, ang0) * slope, 1.0));
    float hip = abs(sin(3.0 * ang)) * r;
    float ridge = smoothstep(0.0011, 0.0003, hip) * smoothstep(0.2, 0.35, rho);
    vec3 nz = vnoiseD(qr * 900.0);
    vec3 alb = mix(vec3(0.40, 0.39, 0.37), vec3(0.52, 0.51, 0.48), nz.x);
    alb = mix(alb, vec3(0.33, 0.38, 0.24), smoothstep(0.62, 0.9, vnoise(qr * 240.0 + float(j) * 9.0)) * 0.4);
    alb *= 1.0 - 0.15 * smoothstep(0.86, 0.98, rho);
    vec3 lit = shade(alb, normalize(n + vec3(nz.yz * 0.0006, 0.0)), sh);
    lit = mix(lit, shade(alb * 1.12, vec3(0.0, 0.0, 1.0), sh), ridge * 0.6);
    // Finial on a lotus collar.
    float fr = r / (R * 0.22);
    if (fr < 1.6) {
        float collar = cover(r - R * 0.3) * (1.0 - cover(r - R * 0.22));
        vec3 cn = normalize(vec3(qr / max(r, 1e-5) * 0.5 * sin(atan(qr.y, qr.x) * 8.0), 1.0));
        lit = mix(lit, shade(alb * 0.95, cn, sh), collar);
        float fc = cover(r - R * 0.22);
        vec3 fnrm = normalize(vec3(rot(qr, ang0) / (R * 0.22) * 1.1, 1.0));
        vec3 fin = shade(vec3(0.50, 0.49, 0.47), fnrm, sh) + gKey * specular(fnrm, 18.0) * 0.25 * (1.0 - sh);
        lit = mix(lit, fin, fc);
    }
    if (gSeason == 4) lit = mix(lit, shade(vec3(0.92, 0.94, 0.98), n, sh), smoothstep(0.92, 0.5, rho) * 0.85 * (1.0 - smoothstep(0.0, 0.0012, -hip + 0.0006) * 0.3));
    lit += vec3(1.0, 0.6, 0.3) * 0.10 * gNight * smoothstep(0.75, 1.0, rho);
    return vec4(lit, cv);
}

// Edging strip: black river pebbles in a dark bed, held by a granite curb.
vec4 edging(vec2 P, float sh)
{
    float ex = min(P.x, gA - P.x);
    if (ex > EDGE_W + CURB_W + 2.0 * gPx) return vec4(0.0);
    float side = P.x < 0.5 * gA ? 1.0 : -1.0;
    vec3 col;
    if (ex < EDGE_W) {
        float cs = 0.0115;
        vec2 cp = P / cs;
        vec2 ci = floor(cp);
        float best = 1e3;
        vec2 bc = vec2(0.0);
        vec2 bq = vec2(0.0);
        float br = 0.5;
        for (int yy = -1; yy <= 1; yy++) {
            for (int xx = -1; xx <= 1; xx++) {
                vec2 cc = ci + vec2(xx, yy);
                vec2 h = hash22(cc);
                vec2 dq = rot(cp - cc - (0.2 + 0.6 * h), h.x * 6.0);
                dq.y *= 1.15 + 0.35 * h.y;
                float rr = 0.40 + 0.14 * hash12(cc + 2.0);
                float dd = length(dq) - rr;
                if (dd < best) {
                    best = dd;
                    bc = cc;
                    bq = dq;
                    br = rr;
                }
            }
        }
        float pc = clamp(0.5 - best * cs / gPx, 0.0, 1.0);
        float u = clamp(length(bq) / br, 0.0, 1.0);
        vec3 pn = normalize(vec3(bq / max(length(bq), 1e-5) * u * 1.3, 1.0));
        float tone = hash12(bc + 7.0);
        vec3 pa = mix(vec3(0.09, 0.09, 0.10), vec3(0.26, 0.25, 0.24), tone * tone);
        pa = mix(pa, vec3(0.30, 0.26, 0.22), step(0.86, tone) * 0.7);
        vec3 lit = shade(pa, pn, sh) + gKey * specular(pn, 30.0) * 0.5 * (1.0 - sh);
        vec3 bed = shade(vec3(0.07, 0.07, 0.07), vec3(0.0, 0.0, 1.0), sh) * 0.7;
        col = mix(bed, lit, pc);
        // Curb shadow over the bed.
        col *= mix(0.6, 1.0, smoothstep(0.0, 0.004, EDGE_W - ex));
        if (gSeason == 4) col = mix(col, shade(vec3(0.90, 0.92, 0.96), normalize(pn + vec3(0.0, 0.0, 1.0)), sh), smoothstep(0.5, 0.75, u * 0.3 + vnoise(P * 70.0) * 0.8) * 0.6 * pc);
    } else {
        float blk = 0.11;
        float seg = floor(P.y / blk);
        float joint = smoothstep(0.0012, 0.0004, blk * 0.5 - abs(mod(P.y, blk) - blk * 0.5));
        float tone = hash11(seg + side * 7.0);
        vec3 cs = mix(vec3(0.56, 0.55, 0.53), vec3(0.66, 0.64, 0.61), tone) * (0.93 + 0.1 * vnoise(P * 420.0));
        float u = (ex - EDGE_W) / CURB_W;
        vec3 cn = normalize(vec3(side * (smoothstep(0.75, 1.0, u) - smoothstep(0.25, 0.0, u)) * 0.8, 0.0, 1.0));
        col = shade(cs, cn, sh) * (1.0 - 0.5 * joint);
        if (gSeason == 4) col = mix(col, shade(vec3(0.94, 0.96, 1.0), cn, sh), 0.55);
    }
    return vec4(col, cover(ex - EDGE_W - CURB_W));
}

// ------------------------------------------------------------- the rake

struct Layer {
    vec3 col;     // premultiplied
    float a;
    float shadow; // key light blocked on the ground, 0..1
    float bump;   // gravel heaped at rake heads, height units
};

void over(inout Layer L, vec3 c, float a)
{
    L.col += (1.0 - L.a) * c * a;
    L.a += (1.0 - L.a) * a;
}

// A wooden rake: head bar centred at c across the motion dir with teeth
// dragging behind it, one per groove (n teeth a spacing apart), and a
// bamboo handle running ahead of it, rising toward the gardener.
void drawRake(inout Layer L, vec2 p, vec2 c, vec2 dir, float n, float vis)
{
    if (vis < 0.003) return;
    float hs = 0.5 * n * gS + 0.25 * gS;
    vec2 nrm = vec2(-dir.y, dir.x);
    vec2 q = p - c;
    if (dot(q, q) > sq(HANDLE_L + hs + 0.12)) return;
    vec2 qd = vec2(dot(q, dir), dot(q, nrm));
    float across = abs(qd.y) < hs ? 1.0 : 0.0;

    // Gravel heaped ahead of the head.
    L.bump += 0.6 * vis * exp(-sq((qd.x - 0.0075) / 0.0035)) * (1.0 - smoothstep(hs - 0.004, hs + 0.002, abs(qd.y)));

    // Shadows: head at tine height, handle end HANDLE_L * 0.5 up.
    vec2 sh0 = -gL2 * 0.006 * gCot;
    vec2 sh1 = -gL2 * (0.006 + HANDLE_L * 0.5) * gCot;
    vec2 qs = q - sh0;
    vec2 qsd = vec2(dot(qs, dir), dot(qs, nrm));
    float dsh = sdBox(qsd, vec2(0.0035, hs));
    vec2 a0 = c + sh0 + dir * 0.004;
    vec2 a1 = c + dir * HANDLE_L + sh1;
    float dsh2 = sdSegment(p, a0, a1) - 0.0025;
    float tt = clamp(dot(p - a0, a1 - a0) / dot(a1 - a0, a1 - a0), 0.0, 1.0);
    float pen = 0.0015 + 0.005 * tt;
    float shade0 = max(1.0 - smoothstep(-0.0015, 0.0015, dsh), (1.0 - smoothstep(-pen, pen, dsh2)) * (0.85 - 0.4 * tt) * (1.0 - smoothstep(0.7, 1.0, tt)));
    L.shadow = max(L.shadow, shade0 * vis * 0.75);

    // Head bar and teeth.
    float db = sdBox(qd, vec2(0.0040, hs)) - 0.0010;
    float ty = mod(qd.y + 0.5 * n * gS, gS) - 0.5 * gS;
    float dt = sdBox(vec2(qd.x + 0.0062, ty), vec2(0.0024, 0.0013)) - 0.0004;
    dt = max(dt, abs(qd.y) - 0.5 * n * gS);
    if (dt < gPx) {
        vec3 tn = normalize(vec3(nrm * clamp(ty / 0.0015, -1.0, 1.0) * 0.8, 1.0));
        over(L, shade(vec3(0.36, 0.26, 0.17), tn, 0.0), cover(dt) * vis);
    }
    if (db < gPx) {
        float grain = 0.5 + 0.5 * sin(qd.y * 700.0 + 4.0 * sin(qd.y * 70.0 + qd.x * 300.0));
        vec3 wood = mix(vec3(0.44, 0.31, 0.19), vec3(0.58, 0.44, 0.28), grain);
        vec3 bn = normalize(vec3(dir * clamp(qd.x / 0.005, -1.0, 1.0) * 0.9 + nrm * sign(qd.y) * smoothstep(hs - 0.002, hs + 0.0008, abs(qd.y)), 1.0));
        over(L, shade(wood, bn, 0.0) + gKey * specular(bn, 12.0) * 0.08, cover(db) * vis);
    }
    // Handle: bamboo with nodes, ending where the gardener holds it.
    float dh = sdSegment(qd, vec2(0.0, 0.0), vec2(HANDLE_L, 0.0)) - 0.0031 * (1.0 + 0.4 * clamp(qd.x / HANDLE_L, 0.0, 1.0));
    float fadeH = 1.0 - smoothstep(HANDLE_L * 0.75, HANDLE_L, qd.x);
    if (dh < gPx) {
        float node = smoothstep(0.0014, 0.0004, abs(mod(qd.x, 0.042) - 0.021));
        vec3 bam = mix(vec3(0.74, 0.64, 0.38), vec3(0.50, 0.42, 0.22), node);
        float w = 0.0031 * (1.0 + 0.4 * clamp(qd.x / HANDLE_L, 0.0, 1.0));
        vec3 hn = normalize(vec3(nrm * clamp(qd.y / w, -1.0, 1.0) * 1.2, 1.0));
        over(L, shade(bam, hn, 0.0) + gKey * specular(hn, 20.0) * 0.2, cover(dh) * vis * fadeH);
    }
}

// ------------------------------------------------------------- leaves

bool leafFetch(int j, out Leaf lf)
{
    vec4 a = texelFetch(iChannel0, ivec2(LEAF_X + 2 * j, ROW_EXT), 0);
    vec4 b = texelFetch(iChannel0, ivec2(LEAF_X + 2 * j + 1, ROW_EXT), 0);
    lf.pos = a.xy;
    lf.z = a.z;
    lf.a = a.w;
    lf.ang = b.x;
    lf.tumble = b.y;
    lf.size = b.z;
    lf.seed = b.w;
    return a.w > 0.003;
}

// Leaf shape at local q (unit size, y along the leaf): x signed distance
// in unit sizes, y vein 0..1.
vec2 leafShape(vec2 q, int season)
{
    if (season == 1) {
        // Cherry petal: notched at the tip.
        float d = length(vec2(q.x * 1.45, q.y - 0.05)) - 0.95;
        d = max(d, 0.30 - length(q - vec2(0.0, 1.02)));
        return vec2(d * 0.7, smoothstep(0.6, -0.9, q.y));
    }
    if (season == 2) {
        float w = 0.42 * (1.0 - sq(clamp(q.y, -1.0, 1.0)));
        float d = max(abs(q.x) - w, abs(q.y) - 1.0) * 0.8;
        float vein = smoothstep(0.05, 0.0, abs(q.x)) * step(abs(q.y), 0.95);
        d = min(d, sdSegment(q, vec2(0.0, -0.95), vec2(0.02, -1.25)) - 0.03);
        return vec2(d, vein);
    }
    if (season == 3) {
        // Japanese maple: seven pointed lobes spread like fingers.
        vec2 c = q + vec2(0.0, 0.3);
        float d = length(c) - 0.24;
        float vein = 0.0;
        for (int i = 0; i < 7; i++) {
            float k = float(i) - 3.0;
            float a = k * 0.50;
            float L = abs(k) < 0.5 ? 1.15 : (abs(k) < 1.5 ? 1.05 : (abs(k) < 2.5 ? 0.80 : 0.45));
            vec2 ax = vec2(sin(a), cos(a));
            float t = dot(c, ax);
            float pp = abs(c.x * ax.y - c.y * ax.x);
            float tt = clamp(t / L, 0.0, 1.0);
            float w = 0.50 * L * pow(1.0 - tt, 1.1) * (0.45 + tt) * (1.0 + 0.10 * sin(t * 45.0));
            float dl = t < 0.0 ? length(c) - 0.12 : (t > L ? length(c - ax * L) : pp - w);
            d = min(d, dl);
            vein = max(vein, smoothstep(0.035, 0.0, pp) * step(0.0, t) * step(t, 0.85 * L));
        }
        d = min(d, sdSegment(q, vec2(0.0, -0.3), vec2(0.06, -0.95)) - 0.03);
        return vec2(d * 0.85, vein);
    }
    return vec2(length(q) - 1.0, 0.0);
}

vec3 leafColour(int season, float seed)
{
    if (season == 1) return mix(vec3(0.95, 0.62, 0.72), vec3(0.99, 0.80, 0.86), seed);
    if (season == 2) return mix(vec3(0.24, 0.45, 0.13), vec3(0.42, 0.60, 0.18), seed);
    if (season == 3) {
        vec3 a = vec3(0.72, 0.10, 0.05);
        vec3 b = vec3(0.90, 0.36, 0.07);
        vec3 c = vec3(0.92, 0.66, 0.14);
        return seed < 0.5 ? mix(a, b, seed * 2.0) : mix(b, c, seed * 2.0 - 1.0);
    }
    return vec3(0.97, 0.98, 1.0);
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    gA = iResolution.x / iResolution.y;
    gS = spacing();
    gPx = 1.0 / iResolution.y;
    vec4 g0 = texelFetch(iChannel0, ivec2(0, ROW_GLOB), 0);
    gClock = g0.x;
    setupLight();
    gSeason = seasonNow();
    vec2 P = fragCoord * gPx;
    float S = gS;

    // ------------------------------------------------ the field
    vec2 fres = iChannelResolution[0].xy;
    vec2 fc = P * fres.y;
    fc.y = max(fc.y, float(STATE_ROWS) + 0.5);
    vec4 fld = fres.x > 0.0 ? texture(iChannel0, fc / fres) : vec4(0.0);
    fld.w = min(fld.w, 1.0);
    // Screen-space gradients per H of the interpolated field.
    vec2 dSm = vec2(dFdx(fld.x), dFdy(fld.x)) / gPx;
    vec2 dK = vec2(dFdx(fld.y), dFdy(fld.y)) / gPx;
    vec2 dO = vec2(dFdx(fld.z), dFdy(fld.z)) / gPx;
    vec2 dI = vec2(dFdx(fld.w), dFdy(fld.w)) / gPx;
    if (dot(dO, dO) > 2.25) dO = normalize(dO) * 1.5;

    // Lantern light on flat ground.
    gLamp = vec3(0.0);
    float lampGlow = 0.0;
    vec3 lampVec = vec3(0.0);
    if (DECOR && gNight > 0.01) {
        for (int j = 0; j < 2; j++) {
            vec2 q = lanternAt(j) - P;
            float r = length(q);
            if (r > 0.45) continue;
            float fall = 1.0 / (1.0 + sq(r / 0.085)) * (1.0 - smoothstep(0.22, 0.45, r)) * smoothstep(LANTERN_R * 0.7, LANTERN_R * 1.15, r);
            float flick = 0.93 + 0.07 * sin(gClock * 7.3 + float(j) * 2.0) * sin(gClock * 3.1 + 1.0);
            vec3 Lp = normalize(vec3(q, 0.035));
            float w = 1.5 * fall * flick * gNight;
            gLamp += vec3(1.0, 0.62, 0.30) * w * Lp.z;
            lampVec += Lp * w;
            lampGlow += exp(-r / 0.045) * gNight * flick;
        }
    }

    // ------------------------------------------------ ring sources
    // Ring sources: x zone-relative distance (0 on the outer crest,
    // negative inside), yz gradient. U decor, R live rocks and stones, F
    // rings of lifted ones. F is left out where live rings stand, as
    // Buffer A smooths a lifted zone everywhere else, so neither a lift nor
    // the end of a fade changes the visible pattern.
    vec3 U = vec3(1e3, 0.0, 0.0);
    vec3 R = vec3(1e3, 0.0, 0.0);
    vec3 F = vec3(1e3, 0.0, 0.0);
    float kU = 2.2 * S;

    Layer top;
    top.col = vec3(0.0);
    top.a = 0.0;
    top.shadow = 0.0;
    top.bump = 0.0;

    vec3 mossD = vec3(1e3, 0.0, 0.0);
    int mossJ = -1;
    vec3 stepD = vec3(1e3, 0.0, 0.0);
    vec4 stepS = vec4(0.0);
    if (DECOR) {
        int ni = islandCount();
        for (int j = 0; j < 5; j++) {
            if (j >= ni) break;
            vec4 isl = islandAt(j);
            if (length(P - isl.xy) > (j % 2 == 1 ? 0.15 * isl.z + 0.24 : 0.2 * isl.z + 0.12)) continue;
            vec3 d = islandSd(P, isl);
            if (d.x < mossD.x) {
                mossD = d;
                mossJ = j;
            }
            float gap = 0.5 * S;
            float outer = gap + 4.0 * S;
            U = sminG(U, vec3(max(d.x - outer, gap - outer), d.x > gap ? d.yz : vec2(0.0)), kU);
            if (j % 2 == 1) {
                for (int k = 0; k < 4; k++) {
                    vec4 ss = steppingStone(isl, k);
                    if (length(P - ss.xy) > 0.06) continue;
                    vec3 sd = steppingSd(P, ss);
                    if (sd.x < stepD.x) {
                        stepD = sd;
                        stepS = ss;
                    }
                    float sg = 0.35 * S;
                    float so = sg + 1.0 * S;
                    U = sminG(U, vec3(max(sd.x - so, sg - so), sd.x > sg ? sd.yz : vec2(0.0)), kU);
                }
            }
        }
        for (int j = 0; j < 2; j++) {
            vec2 q = P - lanternAt(j);
            float r = length(q);
            if (r > 0.12) continue;
            float gap = 0.45 * S;
            float outer = gap + 2.0 * S;
            float d = r - LANTERN_R * 1.2;
            U = sminG(U, vec3(max(d - outer, gap - outer), d > gap ? q / max(r, 1e-6) : vec2(0.0)), kU);
        }
        float de = min(P.x, gA - P.x) - EDGE_W - CURB_W;
        if (de < 0.06) {
            float gap = 0.45 * S;
            float outer = gap + 1.0 * S;
            vec2 gr = vec2(P.x < 0.5 * gA ? 1.0 : -1.0, 0.0);
            U = sminG(U, vec3(max(de - outer, gap - outer), de > gap ? gr : vec2(0.0)), kU);
        }
    }

    // Records: rocks under windows, stones, lifted ones; only those the
    // tile lists.
    ivec2 tile = ivec2(clamp(floor(P / vec2(gA, 1.0) * float(TILES)), 0.0, float(TILES - 1)));
    vec4 tm = texelFetch(iChannel0, ivec2(tile.x + TILES * tile.y, ROW_TILE), 0);
    int leafMask = int(tm.x + 0.5);
    int recLo = int(tm.y + 0.5);
    int recHi = int(tm.z + 0.5);
    int nb = int(texelFetch(iChannel0, ivec2(2, ROW_GLOB), 0).y + 0.5);
    float stoneD = 1e3;
    vec4 stoneInfo = vec4(0.0);   // x kind, y t, z seed
    vec4 stoneGeo = vec4(0.0);    // xy centre, zw half size
    float bumpRing = 0.0;
    float rockShadow = 0.0;
    float aoRock = 1.0;
    for (int r = 0; r < NREC; r++) {
        if (r >= nb) break;
        int bit = r < 16 ? (recLo >> r) & 1 : (recHi >> (r - 16)) & 1;
        if (bit == 0) continue;
        vec4 sb = texelFetch(iChannel0, ivec2(2 * r + 1, ROW_REC), 0);
        int kind = int(sb.x + 0.5);
        if (kind == K_FREE) continue;
        Rec rc = decodeRec(texelFetch(iChannel0, ivec2(2 * r, ROW_REC), 0), sb, vec4(0.0));
        Zone z = zoneOf(rc, gA);
        vec2 q = P - z.c;
        float lt = lapTime(z);
        bool raking = kind == K_ROCK && rc.t < lt + 0.6;
        if (any(greaterThan(abs(q), z.b + recordReach(rc, z)))) continue;
        vec3 d = sdgRoundBox(q, z.b, z.rc);
        vec3 D = vec3(max(d.x - z.outer, z.gap - z.outer), d.x > z.gap ? d.yz : vec2(0.0));
        if (kind == K_ROCK) {
            // Ground shadow and contact darkening of a set-down window rock,
            // fading in when set down and out as soon as it is lifted.
            float sw = smoothstep(0.0, 0.3, rc.t) * (1.0 - smoothstep(0.0, 0.25, rc.aux));
            vec2 v = -gL2 * min(0.022 * gCot, 0.14);
            float t = clamp(dot(q, v) / max(dot(v, v), 1e-6), 0.0, 1.0);
            float ds = sdBox(q - t * v, z.b);
            float pen = 0.003 + 0.012 * t;
            rockShadow = max(rockShadow, (1.0 - smoothstep(-pen, pen, ds)) * (0.8 - 0.35 * t) * sw);
            aoRock = min(aoRock, mix(1.0, mix(0.72, 1.0, smoothstep(0.0, 0.025, d.x)), sw));
        }
        if (isLive(kind)) {
            if (rc.t < lt + STONE_FALL + STONE_RIPPLE) rc.relap = texelFetch(iChannel0, ivec2(r, ROW_EXT), 0).y;
            float rev = revealAt(rc, z, q, d.x);
            D.x += (1.0 - rev) * (z.outer + 2.0 * S);
            R = sminG(R, D, kU);
        } else {
            // Rings as they stood when lifted.
            float rev = 1.0;
            if (rc.aux < 0.999) {
                if (kind == K_FADE_STONE) {
                    float f = mix(-S, z.outer + S, 1.0 - sq(1.0 - rc.aux));
                    rev = 1.0 - smoothstep(f - 0.5 * S, f, d.x);
                } else {
                    vec3 ps = perimS(q, z.b - z.rc, z.dm);
                    float srel = mod(ps.x - rc.s0 * ps.y, ps.y);
                    rev = clamp((rc.aux * ps.y - srel) * ps.z / (0.4 * S), 0.0, 1.0);
                }
            }
            D.x += (1.0 - rev) * (z.outer + 2.0 * S);
            F = sminG(F, D, kU);
        }
        if (isStoneKind(kind) && d.x < stoneD) {
            stoneD = d.x;
            stoneInfo = vec4(float(kind), rc.t, rc.s0, 0.0);
            stoneGeo = vec4(z.c, z.b);
        }
        if (kind == K_STONE && rc.t > STONE_FALL && rc.t < STONE_FALL + STONE_RIPPLE + 0.2) {
            float fr = stoneFront(z, rc.t);
            float k = clamp((rc.t - STONE_FALL) / STONE_RIPPLE, 0.0, 1.0);
            bumpRing += 0.7 * exp(-sq((d.x - fr) / (0.45 * S))) * (1.0 - k);
        }
        if (raking) {
            float k = clamp(rc.t / lt, 0.0, 1.0);
            vec4 pa = pathAt((rc.s0 + k) * zonePerimeter(z), z.b - z.rc, z.dm);
            float vis = smoothstep(0.0, 0.3, rc.t) * (1.0 - smoothstep(lt, lt + 0.5, rc.t));
            drawRake(top, P, z.c + pa.xy, pa.zw, float(WINDOW_RINGS), vis);
        }
    }

    float liveCover = 1.0 - smoothstep(-0.3 * S, 0.1 * S, R.x);
    U = sminG(U, R, kU);
    if (F.x < 1e2) U = sminG(U, F + vec3(liveCover * (float(WINDOW_RINGS) + 3.0) * S, 0.0, 0.0), kU);

    // Gardeners.
    {
        int G = gardenerCount(gA);
        float bh = bandHeight();
        for (int g = 0; g < 4; g++) {
            if (g >= G) break;
            float vis = texelFetch(iChannel0, ivec2(4 + g, ROW_GLOB), 0).x;
            if (vis < 0.003) continue;
            vec3 gd = gardenerAt(g, g0.y, gA);
            float yc = (gd.x + 0.5) * bh;
            vec2 c = vec2(gd.y, 2.0 * yc - lineY(vec2(gd.y, yc)));
            drawRake(top, P, c, vec2(gd.z, 0.0), float(RAKE_TINES), vis);
        }
    }

    // ------------------------------------------------ gravel height
    // Heights in groove-depth units with their gradient per H.
    float yl = lineY(P);
    vec2 pl = prof(yl / S);
    vec3 h = vec3(pl.x, pl.y / S * lineYdx(P), pl.y / S);

    float mU = 1.0 - smoothstep(-0.2 * S, 0.2 * S, U.x);
    if (mU > 0.0) {
        vec2 pr = prof(U.x / S);
        vec3 hR = vec3(pr.x, pr.y / S * U.yz);
        vec2 dm = -6.0 * mU * (1.0 - mU) / (0.4 * S) * U.yz;
        h = vec3(mix(h.x, hR.x, mU), mix(h.yz, hR.yz, mU) + (hR.x - h.x) * dm);
    }
    float hPattern = h.x;

    // Smoothed gravel settles at mid height, with soft broom sweeps.
    h = vec3(mix(h.x, 0.55, fld.x), h.yz * (1.0 - fld.x) + (0.55 - h.x) * dSm);
    if (fld.x > 0.01) {
        vec2 bp = rot(P, 0.5 + 0.6 * vnoise(P * 6.0)) * vec2(28.0, 260.0);
        vec3 bn = vnoiseD(bp);
        h += fld.x * 0.22 * vec3(bn.x - 0.5, rot(bn.yz * vec2(28.0, 260.0), -0.5) * 0.35);
    }
    // Hand rake furrows.
    float tS = HAND_TINE * S;
    if (fld.y > 0.002) {
        vec2 fp = furrowProf(fld.z / tS);
        vec3 hf = vec3(fp.x, fp.y / tS * dO);
        h = vec3(mix(h.x, hf.x, fld.y), mix(h.yz, hf.yz, fld.y) + (hf.x - h.x) * dK);
    }
    // Footprints of lifted rocks.
    h -= 0.25 * vec3(fld.w, dI);
    h.x += top.bump + bumpRing;

    // ------------------------------------------------ gravel shading
    float amp = 0.22 * S * GROOVE_DEPTH;
    vec2 slope = h.yz * amp;
    // Grain: pebbles about 2.2 mH across, faded out below 2 px.
    float peb = 0.0022;
    float pebPx = peb / gPx;
    vec3 n1 = vnoiseD(P / peb);
    vec3 n2 = vnoiseD(P / (peb * 0.55) + 17.0);
    float grainAmp = 0.30 * smoothstep(1.2, 2.6, pebPx);
    slope += (n1.yz * 0.9 + n2.yz * 0.55) * grainAmp;
    vec3 nrm = normalize(vec3(-slope, 1.0));

    // Albedo: pale granite gravel, a few dark speckles, Image 2 tint.
    vec3 alb = GRAVEL * (0.90 + 0.16 * n1.x + 0.08 * n2.x);
    vec2 cell = floor(P / (peb * 1.6));
    vec2 cj = fract(P / (peb * 1.6)) - 0.5 - (hash22(cell) - 0.5) * 0.4;
    float hsp = hash12(cell + 3.1);
    float speck = smoothstep(0.28, 0.14, length(cj)) * step(0.90, hsp) * smoothstep(1.0, 2.0, pebPx);
    alb = mix(alb, mix(vec3(0.30, 0.29, 0.28), vec3(0.62, 0.55, 0.48), hash12(cell + 9.7)), speck * 0.8);
    if (iChannelResolution[1].x > 0.0 && IMAGE_TINT > 0.0) {
        vec2 uv = P / vec2(gA, 1.0);
        vec2 texRes = iChannelResolution[1].xy;
        float ta = texRes.x / texRes.y;
        vec2 fit = gA > ta ? vec2(1.0, ta / gA) : vec2(gA / ta, 1.0);
        vec3 img = textureLod(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0), 5.0).rgb;
        float lum = dot(img, vec3(0.299, 0.587, 0.114));
        vec3 chroma = clamp(img / max(lum, 0.08), 0.0, 1.8);
        alb *= mix(vec3(1.0), chroma * (0.9 + 0.2 * lum), IMAGE_TINT * 0.35);
    }
    alb *= 1.0 - 0.03 * fld.w;

    // Shadows on the ground: rocks, decor, stones, rakes, leaves.
    float shadow = max(top.shadow, rockShadow);
    if (DECOR && mossJ >= 0) {
        vec4 isl = islandAt(mossJ);
        if (length(P - isl.xy) < 0.13 * isl.z + min(0.045 * gCot, 0.2)) {
            for (int k = 0; k < 3; k++) {
                vec4 rk = islandRock(isl, k);
                vec2 v = -gL2 * min(rk.z * 1.1 * gCot, 0.2);
                vec2 q = P - rk.xy;
                float t = clamp(dot(q, v) / max(dot(v, v), 1e-6), 0.0, 1.0);
                float d = length(q - t * v) - rk.z * 0.92;
                float pen = 0.002 + 0.01 * t;
                shadow = max(shadow, (1.0 - smoothstep(-pen, pen, d)) * (0.85 - 0.3 * t));
            }
        }
    }
    if (DECOR) {
        for (int j = 0; j < 2; j++) {
            vec2 q = P - lanternAt(j);
            if (length(q) > LANTERN_R + min(0.06 * gCot, 0.22) + 0.01) continue;
            vec2 v = -gL2 * min(0.06 * gCot, 0.22);
            float t = clamp(dot(q, v) / max(dot(v, v), 1e-6), 0.0, 1.0);
            float d = length(q - t * v) - LANTERN_R * (1.05 - 0.5 * t);
            float pen = 0.002 + 0.01 * t;
            shadow = max(shadow, (1.0 - smoothstep(-pen, pen, d)) * (0.85 - 0.3 * t) * (1.0 - gNight));
        }
    }
    if (stoneD < 0.1) {
        vec2 q = P - stoneGeo.xy;
        float fall = 1.0 - smoothstep(0.0, STONE_FALL, stoneInfo.y);
        float lift = stoneInfo.x > 3.5 ? smoothstep(0.0, 0.6, stoneInfo.y) : 0.0;
        float ht = 0.010 + 0.12 * (fall + lift);
        vec2 sc = -gL2 * min(ht * gCot, 0.25);
        float d = sdgRoundBox(q - sc, stoneGeo.zw * 0.95, min(stoneGeo.z, stoneGeo.w)).x;
        float pen = 0.002 + 0.02 * (fall + lift);
        float vis = 1.0 - smoothstep(0.35, 0.6, lift);
        shadow = max(shadow, (1.0 - smoothstep(-pen, pen, d)) * 0.75 * vis * (1.0 - 0.5 * (fall + lift)));
    }
    // Leaves: shadows on the ground, and the one leaf over this pixel.
    int ns = leafSlots(gSeason);
    int leafHit = -1;
    if (LEAVES) {
        for (int j = 0; j < NLEAF; j++) {
            if (j >= ns) break;
            if (((leafMask >> j) & 1) == 0) continue;
            vec4 la = texelFetch(iChannel0, ivec2(LEAF_X + 2 * j, ROW_EXT), 0);
            if (la.w <= 0.003) continue;
            vec2 sp = la.xy - gL2 * (0.002 + la.z * 0.18) * min(gCot, 2.0);
            float r = length(P - sp);
            if (r > 0.045 && length(P - la.xy) > 0.035) continue;
            vec4 lb = texelFetch(iChannel0, ivec2(LEAF_X + 2 * j + 1, ROW_EXT), 0);
            float sr = lb.z * (gSeason == 3 ? 0.8 : 0.7) * mix(1.0, lb.y, 0.6) + 0.004 * la.z;
            float sh = (1.0 - smoothstep(sr * 0.4, sr * 1.3, r)) * la.w * (0.5 - 0.3 * la.z);
            shadow = max(shadow, sh);
            if (length(P - la.xy) < lb.z * 1.8) leafHit = j;
        }
    }

    vec3 lampN = gLamp;
    if (gNight > 0.01) lampN = gLamp / max(lampVec.z, 1e-4) * max(dot(nrm, lampVec), 0.0);
    float ao = mix(mix(0.58, 1.0, clamp(h.x, 0.0, 1.1)), 0.93, fld.x * (1.0 - fld.y)) * aoRock;
    float key = keyDiffuse(nrm) * (1.0 - shadow);
    vec3 col = alb * (gAmb * ao * 1.15 + gKey * key * mix(0.8, 1.0, ao) + lampN);

    // Winter: a dusting of snow on the crests, gone where the rake cut.
    if (gSeason == 4) {
        float crest = smoothstep(0.55, 0.95, hPattern * (1.0 - fld.x) + 0.6 * fld.x);
        float dust = clamp(crest * 0.85 + (n1.x - 0.5) * 0.6, 0.0, 1.0) * (1.0 - 0.85 * fld.y);
        vec3 snow = vec3(0.95, 0.97, 1.0) * (gAmb * 1.2 + gKey * keyDiffuse(normalize(vec3(-slope * 0.4, 1.0))) * (1.0 - shadow) + lampN);
        col = mix(col, snow, dust * 0.75);
    }

    // ------------------------------------------------ decor
    if (DECOR) {
        vec4 e = edging(P, shadow);
        col = mix(col, e.rgb, e.a);
        if (mossJ >= 0 && mossD.x < 0.02) {
            vec4 isl = islandAt(mossJ);
            vec4 m = moss(P, mossD, shadow);
            col = mix(col, m.rgb, m.a);
            for (int k = 0; k < 3; k++) {
                vec4 rk = islandRock(isl, k);
                vec4 b = boulder(P, rk.xy, rk.z, rk.w, 0.0);
                col = mix(col, b.rgb, b.a);
            }
        }
        if (stepD.x < 0.004) {
            // Flat slab with a rounded rim.
            float cv = cover(stepD.x + 0.0012 * (vnoise(P * 400.0) - 0.5));
            vec3 sn1 = vnoiseD(P / 0.006 + stepS.w * 5.0);
            vec3 sn2 = vnoiseD(P / 0.0014 + stepS.w);
            float rim = smoothstep(-0.006, 0.0, stepD.x);
            vec3 n = normalize(vec3(stepD.yz * rim * 1.3 + sn1.yz * 0.05 + sn2.yz * 0.04, 1.0));
            vec3 alb = mix(vec3(0.42, 0.40, 0.36), vec3(0.58, 0.55, 0.50), 0.6 * sn1.x + 0.4 * hash11(stepS.w * 3.0));
            alb *= (0.88 + 0.24 * sn2.x) * mix(1.0, 0.75, rim);
            vec3 lit = shade(alb, n, shadow);
            if (gSeason == 4) lit = mix(lit, shade(vec3(0.90, 0.92, 0.96), vec3(0.0, 0.0, 1.0), shadow), smoothstep(0.0, -0.008, stepD.x + 0.004 * (sn1.x - 0.5)) * 0.85);
            col = mix(col, lit, cv);
        }
        vec3 lampSave = gLamp;
        gLamp *= 0.12;
        for (int j = 0; j < 2; j++) {
            vec4 l = lantern(P, j, 0.0);
            vec2 q = P - lanternAt(j);
            float halo = exp(-max(length(q) - LANTERN_R * 1.05, 0.0) / 0.006) * gNight;
            col += vec3(1.0, 0.64, 0.32) * halo * 0.35 * (1.0 - l.a);
            col = mix(col, l.rgb, l.a);
        }
        gLamp = lampSave;
    }

    // Stones dropped with a click.
    if (stoneD < 0.05) {
        vec2 q = P - stoneGeo.xy;
        float fall = 1.0 - smoothstep(0.0, STONE_FALL, stoneInfo.y);
        float lift = stoneInfo.x > 3.5 ? smoothstep(0.0, 0.6, stoneInfo.y) : 0.0;
        float scale = 1.0 + 0.35 * sq(fall) + 0.25 * lift;
        float alpha = (1.0 - smoothstep(0.25, 0.6, lift)) * smoothstep(0.0, 0.08, stoneInfo.y);
        vec2 b = stoneGeo.zw * scale;
        float rr = min(b.x, b.y);
        float th = atan(q.y, q.x);
        float wob = 0.06 * rr * sin(3.0 * th + stoneInfo.z * 20.0) + 0.03 * rr * sin(5.0 * th + stoneInfo.z * 7.0);
        vec3 d = sdgRoundBox(q, b, rr);
        float sc = cover(d.x - wob) * alpha;
        if (sc > 0.0) {
            float u = clamp(1.0 + d.x / rr, 0.0, 1.0);
            vec3 bn = vnoiseD(q / 0.0035 + stoneInfo.z * 50.0);
            vec3 sn = normalize(vec3(d.yz * pow(u, 1.8) * 1.5 + bn.yz * 0.08, 1.0));
            float tone = stoneInfo.z;
            vec3 base = tone < 0.33 ? vec3(0.20, 0.21, 0.23) : (tone < 0.66 ? vec3(0.34, 0.30, 0.27) : vec3(0.44, 0.44, 0.45));
            base *= 0.9 + 0.2 * bn.x;
            vec3 lit = shade(base, sn, 0.0) + gKey * specular(sn, 30.0) * 0.45;
            if (gSeason == 4) lit = mix(lit, shade(vec3(0.92, 0.94, 0.98), sn, 0.0), smoothstep(0.5, 0.15, u) * 0.7 * smoothstep(1.0, 8.0, stoneInfo.y));
            col = mix(col, lit, sc);
        }
    }

    // Leaves on the ground and in the air.
    Leaf lf;
    if (leafHit >= 0 && leafFetch(leafHit, lf)) {
        vec2 q = P - lf.pos;
        vec2 lq = rot(q, -lf.ang) / lf.size;
        lq.x /= max(lf.tumble, 0.2);
        vec2 sh = leafShape(lq, gSeason);
        float aa = gPx / lf.size * 1.2 / max(lf.tumble, 0.3);
        float c = (1.0 - smoothstep(-aa, aa, sh.x)) * lf.a;
        if (gSeason == 4) c = (1.0 - smoothstep(0.2, 1.0, length(lq))) * lf.a * 0.9;
        vec3 lc = leafColour(gSeason, lf.seed);
        lc = gSeason == 1 ? mix(lc, vec3(1.0, 0.95, 0.96), 0.55 * sh.y) : lc * (1.0 - 0.3 * sh.y);
        vec3 ln = normalize(vec3(rot(vec2(lq.x * 0.3, -0.1), lf.ang), 1.0));
        col = mix(col, shade(lc, ln, shadow * (1.0 - lf.z)), c);
    }

    // Rakes above everything on the ground.
    col = col * (1.0 - top.a) + top.col;

    // Lantern bloom at night.
    col += vec3(1.0, 0.62, 0.30) * lampGlow * 0.08;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
