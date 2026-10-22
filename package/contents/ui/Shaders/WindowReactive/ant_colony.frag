// Ant Colony — a colony foraging on the desktop.
// @channels bufferA, tex1, bufferB, bufferC
// @sim-max-height 360
//
// The desktop is the ground seen from above, with an ant nest in the lower
// left. Ants leave the nest to search for food. One that finds some carries
// a crumb home and lays a scent trail that others follow, so highways form
// between the nest and the food and fade once it is gone. Click bare
// desktop to drop a pile of crumbs, click a pile to add more; a sugar cube,
// a berry or a leaf also turns up now and then. Windows are walls: ants walk
// around them, trails re-route, and ants caught under a window walk out. A
// fast cursor scatters the ants nearby; a moving one is a fingertip they
// walk around. At night by the local clock most ants stay in the nest and a
// few scouts wander under the moon.
//
// iChannel0  Buffer A: ants, food and colony state.
// iChannel1  Wallpaper ("Image 2" in the settings) as the ground. Without
//            one a sandy ground is drawn.
// iChannel2  Buffer B: nearest ants per grid cell.
// iChannel3  Buffer C: scent and walking-distance fields.
//
// Colony size, the food rate and whether ants sleep at night change the
// simulation in every pass; they are set in ant_colony_common.frag.

const float ANT_SIZE    = 1.0;  // @range(0.5, 2.5, 0.05) @label("Ant size")
const vec3  ANT_COLOUR  = vec3(0.11, 0.07, 0.05); // @color @label("Ant colour")
const float TRAILS      = 0.35; // @range(0.0, 1.0, 0.05) @label("Trail visibility")
const vec3  GROUND_TINT = vec3(0.80, 0.68, 0.50); // @color @label("Ground colour (no wallpaper)")
const float MOONLIGHT   = 1.0;  // @range(0.0, 1.0, 0.05) @label("Moonlit night")

// ------------------------------------------------------------- utilities

// Light from the upper left; shadows fall to the lower right.
vec3 lightDir() { return normalize(vec3(-0.55, 0.8, 0.9)); }

float vnoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), w.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), w.x), w.y);
}

float fbm3(vec2 p)
{
    return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.15 * vnoise(p * 4.1 + 2.3);
}

vec2 rot(vec2 p, float a)
{
    float c = cos(a);
    float s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float sdSeg(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float sdEll(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }

float sdRoundBox(vec2 p, vec2 b, float r)
{
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Brightness of a dome over the ellipse-normalised point e (|e| <= 1), lit
// from lightDir() rotated into the shape's frame by -ang.
float domeLight(vec2 e, float ang, out float spec)
{
    vec3 L = lightDir();
    L.xy = rot(L.xy, -ang);
    vec3 n = normalize(vec3(e, 1.2 * sqrt(max(1.0 - dot(e, e), 0.0))));
    spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 20.0);
    return max(dot(n, L), 0.0);
}

// Thin stroke coverage: strokes thinner than a pixel draw a pixel wide and
// fainter.
float stroke(float d, float halfW, float px)
{
    float w = max(halfW, 0.5 * px);
    return clamp(0.5 - (d - w) / px, 0.0, 1.0) * (halfW / w);
}

// ------------------------------------------------------------- ground

vec3 wallpaper(vec2 fc)
{
    vec2 uv = fc / iResolution.xy;
    vec2 texRes = iChannelResolution[1].xy;
    float sa = iResolution.x / iResolution.y;
    float ta = texRes.x / texRes.y;
    vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
    return texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
}

// Pebbles on a jittered grid, a third of the cells occupied.
vec3 pebbles(vec2 p, float px, vec3 col)
{
    float S = 0.05;
    vec2 base = floor(p / S - 0.5);
    float shadow = 0.0;
    vec4 top = vec4(0.0);
    for (int j = 0; j < 2; j++) {
        for (int i = 0; i < 2; i++) {
            vec2 cid = base + vec2(float(i), float(j));
            float h0 = hash12(cid * 1.31 + 5.0);
            if (h0 > 0.34) continue;
            vec2 h = hash22(cid + 17.0);
            vec2 c = (cid + 0.2 + 0.6 * h) * S;
            float r = S * (0.04 + 0.2 * pow(h0 / 0.34, 3.0));
            vec2 dp = p - c;
            if (dot(dp, dp) > 4.0 * r * r) continue;
            float h3 = hash12(cid + 91.7);
            float ang = h.x * TAU;
            vec2 rr = r * vec2(1.0, 0.62 + 0.3 * h.y);
            vec2 q = rot(dp, -ang);
            float a = atan(q.y, q.x);
            float wob = 1.0 + 0.07 * sin(3.0 * a + h.y * 20.0) + 0.04 * sin(5.0 * a + h3 * 13.0);
            vec2 qs = rot(dp - vec2(0.3, -0.4) * r, -ang);
            shadow = max(shadow, smoothstep(0.35 * r, -0.4 * r, (length(qs / rr) - wob) * rr.y));
            float d = (length(q / rr) - wob) * rr.y;
            if (d > px) continue;
            vec3 pc = h3 < 0.4 ? vec3(0.58, 0.56, 0.53) : (h3 < 0.75 ? vec3(0.62, 0.50, 0.38) : vec3(0.60, 0.42, 0.33));
            pc = mix(pc, vec3(0.80, 0.78, 0.74), step(0.92, h3));
            pc *= 0.86 + 0.2 * h.y;
            pc *= 0.93 + 0.14 * vnoise(q / r * 5.0 + h * 9.0);
            float spec;
            float lit = domeLight(q / (rr * wob), ang, spec);
            vec3 shaded = pc * (0.52 + 0.58 * lit) + 0.07 * spec;
            top = mix(top, vec4(shaded, 1.0), clamp(0.5 - d / px, 0.0, 1.0));
        }
    }
    col *= 1.0 - 0.3 * shadow;
    return mix(col, top.rgb, top.a);
}

// Dry grass stems and twigs lying on the sand.
vec3 litter(vec2 p, float px, vec3 col)
{
    float S = 0.11;
    vec2 base = floor(p / S - 0.5);
    float shadow = 0.0;
    vec4 top = vec4(0.0);
    for (int j = 0; j < 2; j++) {
        for (int i = 0; i < 2; i++) {
            vec2 cid = base + vec2(float(i), float(j));
            float h0 = hash12(cid * 2.17 + 31.0);
            if (h0 > 0.3) continue;
            vec2 h = hash22(cid + 57.0);
            vec2 c = (cid + 0.25 + 0.5 * h) * S;
            float len = 0.012 + 0.03 * h.y;
            vec2 dp = p - c;
            if (dot(dp, dp) > len * len * 1.3) continue;
            vec2 q = rot(dp, -h.x * TAU);
            float bend = (h0 / 0.3 - 0.5) * 0.25;
            float u = clamp(q.x / len, -1.0, 1.0);
            float v = q.y - bend * len * u * u;
            float w = (h0 < 0.08 ? 0.0011 : 0.0006) * (1.0 - 0.5 * abs(u));
            float d = max(abs(v) - w, abs(q.x) - len);
            vec2 qs = rot(dp - vec2(0.0012, -0.0016), -h.x * TAU);
            float us = clamp(qs.x / len, -1.0, 1.0);
            shadow = max(shadow, smoothstep(0.0012, -0.0004, max(abs(qs.y - bend * len * us * us) - w, abs(qs.x) - len)));
            vec3 sc = h0 < 0.08 ? vec3(0.42, 0.30, 0.20) : vec3(0.82, 0.72, 0.48);
            sc *= 0.85 + 0.25 * fract(h.y * 7.3);
            top = mix(top, vec4(sc, 1.0), stroke(abs(v) + max(abs(q.x) - len, 0.0), w, px));
        }
    }
    col *= 1.0 - 0.25 * shadow;
    return mix(col, top.rgb, top.a);
}

// Grass along the left, right and top edges: low cover right at the edge,
// then clumps of thin blades thinning out inward, swaying.
vec3 grass(vec2 p, float px, vec3 col, float clk)
{
    vec2 ws = worldSize();
    float edge = min(min(p.x, ws.x - p.x), ws.y - p.y);
    if (edge > 0.12) return col;
    float n0 = vnoise(p * 14.0);
    float cover = smoothstep(0.035, 0.0, edge + 0.025 * (n0 - 0.5));
    vec3 moss = mix(vec3(0.36, 0.40, 0.20), vec3(0.50, 0.48, 0.28), vnoise(p * 60.0)) * (0.85 + 0.2 * n0);
    col = mix(col, moss, 0.75 * cover);

    float T = 0.032;
    vec2 base = floor(p / T - 0.5);
    float shadow = 0.0;
    vec4 top = vec4(0.0);
    for (int j = 0; j < 2; j++) {
        for (int i = 0; i < 2; i++) {
            vec2 cid = base + vec2(float(i), float(j));
            vec2 root = (cid + 0.2 + 0.6 * hash22(cid + 41.0)) * T;
            float re = min(min(root.x, ws.x - root.x), ws.y - root.y);
            float dens = smoothstep(0.075, 0.0, re + 0.035 * (vnoise(root * 9.0) - 0.5));
            float hc = hash12(cid + 3.3);
            if (hc > dens * 1.2) continue;
            float size = T * (0.6 + 0.5 * dens) * (0.8 + 0.4 * fract(hc * 13.7));
            vec2 dp = p - root;
            if (dot(dp, dp) > size * size * 1.1) continue;
            shadow = max(shadow, 0.8 * smoothstep(0.6 * size, 0.0, length(dp - vec2(0.002, -0.0028))));
            float n = 9.0 + floor(hash12(cid + 8.8) * 7.0);
            float sway = 0.05 * sin(clk + root.x * 7.0 + root.y * 3.0) + 0.025 * sin(2.0 * clk + root.y * 11.0);
            vec3 green = mix(vec3(0.34, 0.44, 0.18), vec3(0.54, 0.58, 0.26), hash12(cid + 2.2));
            float a0 = hc * TAU + sway;
            // Blade b points at a0 + (b + jitter) / n turns; only the four
            // nearest the pixel's direction can reach it.
            float rel = mod(atan(dp.y, dp.x) - a0, TAU) / TAU * n;
            float b0 = floor(rel - 0.9);
            for (int k = 0; k < 4; k++) {
                float bf = mod(b0 + float(k), n);
                vec2 hb = hash22(cid * 3.7 + bf * 1.37);
                float ang = a0 + (bf + 0.8 * hb.x) / n * TAU + sway * hb.y;
                float len = size * (0.35 + 0.65 * hb.y);
                float bend = (fract(hb.x * 9.1) - 0.5) * 1.2;
                float wdt = 0.0011 * (0.8 + 0.5 * fract(hb.y * 3.1));
                vec2 q = rot(dp, -ang);
                if (q.x < -0.002 || q.x > len + 0.002) continue;
                float u = clamp(q.x / len, 0.0, 1.0);
                float v = q.y - bend * len * u * u * 0.4;
                float cov = stroke(abs(v) + max(max(-q.x, q.x - len), 0.0), wdt * (1.0 - 0.9 * u), px);
                if (cov <= 0.0) continue;
                vec3 bc = green * (0.6 + 0.6 * u) * (0.85 + 0.3 * fract(hb.y * 5.3));
                bc = mix(bc, vec3(0.72, 0.66, 0.42), step(0.9, fract(hb.x * 17.0)));
                bc *= v * sign(bend + 1e-3) > 0.0 ? 1.07 : 0.9;
                top = mix(top, vec4(bc, 1.0), cov);
            }
        }
    }
    col *= 1.0 - 0.3 * shadow;
    return mix(col, top.rgb, top.a);
}

vec3 sand(vec2 p, vec2 fc, float px, float clk)
{
    vec3 base = GROUND_TINT;
    float n = fbm3(p * 1.7 + 3.7);
    float m = vnoise(p * 10.0 + 1.3);
    float g = vnoise(p * 230.0);
    vec3 col = base * (0.95 + 0.1 * n);
    col = mix(col, col * vec3(0.9, 0.86, 0.82), 0.6 * smoothstep(0.5, 0.8, n));
    col *= 0.965 + 0.06 * m;
    col *= 0.975 + 0.045 * g;
    col *= 0.985 + 0.03 * hash12(fc);

    // Grit: a dark or light grain in some cells of a fine grid.
    float G = 0.007;
    vec2 cg = floor(p / G);
    vec2 hg = hash22(cg + 3.1);
    if (hg.x < 0.5) {
        vec2 c = (cg + 0.2 + 0.6 * hash22(cg + 7.7)) * G;
        float r = 0.0004 + 0.0007 * hg.y * hg.y;
        float cov = clamp(0.5 - (distance(p, c) - r) / px, 0.0, 1.0);
        col = mix(col, col * (fract(hg.y * 17.0) > 0.45 ? 1.1 : 0.8), cov * 0.75);
    }

    col = pebbles(p, px, col);
    col = litter(p, px, col);
    col = grass(p, px, col, clk);
    vec2 ws = worldSize();
    vec2 v = (p / ws - 0.5) * vec2(ws.x / ws.y, 1.0);
    col *= 1.0 - 0.1 * smoothstep(0.3, 1.2, length(v));
    return col;
}

// ------------------------------------------------------------- nest

float moundHeight(float x) { return smoothstep(0.08, 0.35, x) * (1.0 - smoothstep(0.35, 1.0, x)); }

// Spoil mound around the entrance: a low ring of excavated soil pellets
// with the dark entrance at its centre.
vec3 nestMound(vec2 p, float px, vec3 col)
{
    vec2 nest = nestPos();
    vec2 d = p - nest;
    float r = length(d);
    if (r > MOUND_R * 1.4) return col;
    float a = atan(d.y, d.x);
    float ragged = 1.0 + 0.16 * (vnoise(vec2(a * 1.6 + 4.0, 2.0)) - 0.5) + 0.05 * sin(3.0 * a + 1.0);
    float xr = r / (MOUND_R * ragged);
    // Ring height: crest at 0.35 R, slopes in to the entrance and out to R.
    float hgt = moundHeight(xr);
    float slope = (moundHeight(xr + 0.02) - hgt) / 0.02;
    vec3 nrm = normalize(vec3(-normalize(d + 1e-6) * slope * 0.45, 1.0));
    float lit = max(dot(nrm, lightDir()), 0.0) / lightDir().z;
    vec3 soil = col * vec3(0.88, 0.77, 0.66);
    float cover = smoothstep(1.0, 0.55, xr);
    vec3 mound = mix(col, soil * (0.45 + 0.6 * lit), cover);

    // Pellets, densest on the crest, two sizes.
    vec4 grain = vec4(0.0);
    float sh = 0.0;
    for (int layer = 0; layer < 2; layer++) {
        float S = layer == 0 ? 0.0034 : 0.0021;
        vec2 base = floor(p / S - 0.5);
        for (int j = 0; j < 2; j++) {
            for (int i = 0; i < 2; i++) {
                vec2 cid = base + vec2(float(i), float(j));
                vec2 h = hash22(cid + 11.0 + float(layer) * 7.0);
                vec2 c = (cid + 0.25 + 0.5 * h) * S;
                float cx = distance(c, nest) / (MOUND_R * ragged);
                float dens = smoothstep(0.1, 0.3, cx) * (1.0 - smoothstep(0.45, 1.05, cx)) * (layer == 0 ? 0.4 : 0.65);
                if (hash12(cid + 4.4 + float(layer)) > dens) continue;
                float gr = S * (0.26 + 0.2 * h.y);
                vec2 q = p - c;
                float dd = length(q) - gr;
                sh = max(sh, smoothstep(gr * 0.5, -gr * 0.3, length(q - vec2(0.35, -0.45) * gr) - gr));
                if (dd > px) continue;
                float spec;
                float l = domeLight(q / gr, 0.0, spec);
                vec3 gc = soil * (0.86 + 0.24 * h.x) * (0.66 + 0.42 * l);
                grain = mix(grain, vec4(gc, 1.0), clamp(0.5 - dd / px, 0.0, 1.0));
            }
        }
    }
    mound *= 1.0 - 0.22 * sh;
    mound = mix(mound, grain.rgb, grain.a);
    // The mound's own shadow on the sand to the lower right.
    float spill = smoothstep(1.2, 0.85, length(d - vec2(0.005, -0.007)) / (MOUND_R * ragged)) * (1.0 - cover);
    col = mix(col * (1.0 - 0.16 * spill), mound, max(cover, grain.a * step(xr, 1.1)));

    // Entrance: a dark hole, its far (lower right) wall catching the light.
    float hr = NEST_HOLE * (1.0 + 0.12 * sin(3.0 * a + 0.7) + 0.06 * sin(5.0 * a + 2.0));
    float inside = smoothstep(hr + px, hr - px, r);
    float depth = smoothstep(hr, 0.25 * hr, r);
    vec3 hole = mix(soil * 0.32, vec3(0.03, 0.022, 0.015), depth);
    hole += soil * 0.25 * max(dot(normalize(d + 1e-6), -lightDir().xy), 0.0) * (1.0 - depth);
    return mix(col, hole, inside);
}

// ------------------------------------------------------------- food

vec3 crumbColour(float h, float u) { return mix(vec3(0.93, 0.80, 0.55), vec3(0.74, 0.50, 0.24), smoothstep(0.55, 0.95, h) + 0.25 * u); }

vec3 crumbPile(vec2 p, float px, vec4 f0, vec4 f1, vec3 col)
{
    int n = int(f0.z + 0.5);
    int before = int(f1.z + 0.5);
    float land = smoothstep(0.0, 0.35, f1.w);
    vec2 q = p - f0.xy;
    float seed = hash12(f0.xy * 917.0);
    float shadow = 0.0;
    vec4 top = vec4(0.0);
    for (int j = 0; j < 100; j++) {
        if (j >= n) break;
        float fj = float(j);
        float hj = hash12(vec2(fj, seed * 91.0));
        float hk = hash12(vec2(seed * 37.0, fj));
        vec2 c = CRUMB_STEP * sqrt(fj + 0.5) * (0.85 + 0.3 * hk) * vec2(cos(fj * 2.39996 + seed * TAU), sin(fj * 2.39996 + seed * TAU));
        float lift = 0.0;
        if (j >= before) {
            c *= land;
            lift = 1.0 - land;
        }
        float s = (0.0021 + 0.0017 * hj) * (1.0 + 0.4 * lift);
        vec2 qc = q - c;
        if (dot(qc, qc) > 4.0 * s * s + 0.0001) continue;
        vec2 er = vec2(1.0, 0.65 + 0.3 * hj);
        vec2 qr = rot(qc, -hk * TAU);
        float a = atan(qr.y, qr.x);
        float wob = 1.0 + 0.1 * sin(2.0 * a + hj * 30.0) + 0.07 * sin(5.0 * a + hk * 20.0);
        float d = (length(qr / (er * s)) - wob) * s * er.y;
        float dsh = (length(rot(qc - vec2(0.45, -0.6) * s * (1.0 + 3.0 * lift), -hk * TAU) / (er * s)) - wob) * s * er.y;
        shadow = max(shadow, smoothstep(0.4 * s, -0.4 * s, dsh));
        if (d > px) continue;
        float spec;
        float l = domeLight(qr / (s * er * wob), hk * TAU, spec);
        vec3 cc = crumbColour(hj, 1.0 - clamp(-d / s, 0.0, 1.0)) * (0.62 + 0.5 * l) + 0.08 * spec;
        cc *= 0.95 + 0.1 * vnoise(qc / s * 3.0 + hj * 9.0);
        top = mix(top, vec4(cc, 1.0), clamp(0.5 - d / px, 0.0, 1.0));
    }
    col *= 1.0 - 0.35 * shadow;
    return mix(col, top.rgb, top.a);
}

vec3 sugarCube(vec2 p, float px, vec4 f0, vec4 f1, vec3 col)
{
    float f = clamp(f0.z / f0.w, 0.0, 1.0);
    float seed = hash12(f0.xy * 733.0);
    float drop = 1.0 - smoothstep(0.0, 0.4, f1.y);
    float hs = 0.0095 * (0.35 + 0.65 * sqrt(f)) * (1.0 + 0.5 * drop);
    float ang = seed * TAU;
    vec2 q = rot(p - f0.xy, -ang);
    // Loose grains around it.
    vec4 top = vec4(0.0);
    float shadow = 0.0;
    for (int k = 0; k < 7; k++) {
        vec2 h = hash22(vec2(float(k), seed * 50.0));
        vec2 c = (0.013 + 0.008 * h.x) * vec2(cos(h.y * TAU), sin(h.y * TAU));
        vec2 qg = rot(q - c, h.x * 3.0);
        float dg = sdRoundBox(qg, vec2(0.0011), 0.0003);
        top = mix(top, vec4(vec3(0.97, 0.96, 0.94) * (0.85 + 0.15 * h.y), 1.0), clamp(0.5 - dg / px, 0.0, 1.0));
    }
    float bite = (1.0 - f) * hs * 0.5 * vnoise(q / hs * 4.0 + seed * 20.0);
    float d = sdRoundBox(q, vec2(hs), hs * 0.2) + bite;
    vec2 off = rot(vec2(0.35, -0.5) * hs * (1.0 + 4.0 * drop), -ang);
    float ds = sdRoundBox(q - off, vec2(hs), hs * 0.3);
    shadow = smoothstep(0.35 * hs, -0.35 * hs, ds);
    col *= 1.0 - 0.38 * shadow;
    col = mix(col, top.rgb, top.a);
    if (d > px) return col;
    // Bevel: faces toward the light brighter.
    vec2 e = q / hs;
    float edge = smoothstep(0.55, 1.0, max(abs(e.x), abs(e.y)));
    vec2 L = rot(lightDir().xy, -ang);
    vec2 en = abs(e.x) > abs(e.y) ? vec2(sign(e.x), 0.0) : vec2(0.0, sign(e.y));
    float face = 1.0 + 0.25 * edge * dot(en, L);
    float grit = hash12(floor(q / 0.0009) + seed * 100.0);
    vec3 sc = vec3(0.97, 0.965, 0.95) * face * (0.9 + 0.1 * grit);
    sc = mix(sc, vec3(0.80, 0.84, 0.92), 0.25 * edge * max(-dot(en, L), 0.0));
    return mix(col, sc, clamp(0.5 - d / px, 0.0, 1.0));
}

vec3 berry(vec2 p, float px, vec4 f0, vec4 f1, vec3 col)
{
    float f = clamp(f0.z / f0.w, 0.0, 1.0);
    float seed = hash12(f0.xy * 541.0);
    float drop = 1.0 - smoothstep(0.0, 0.4, f1.y);
    float r = 0.0095 * (1.0 + 0.4 * drop);
    vec2 q = p - f0.xy;
    // Juice stain, darker as the berry is eaten.
    float st = smoothstep(r * 1.6, r * 0.6, length(q) * (1.0 + 0.2 * vnoise(q / r * 3.0)));
    col = mix(col, col * vec3(0.72, 0.45, 0.48), st * 0.5 * (1.0 - f));
    vec2 bc = r * 1.05 * vec2(cos(seed * TAU), sin(seed * TAU));
    float br = r * 1.15 * sqrt(1.0 - f);
    float d = max(length(q) - r, -(length(q - bc) - br));
    float ds = max(length(q - vec2(0.4, -0.55) * r * (1.0 + 4.0 * drop)) - r, -(length(q - bc) - br));
    col *= 1.0 - 0.4 * smoothstep(0.35 * r, -0.35 * r, ds);
    if (d > px) return col;
    float spec;
    float l = domeLight(q / r, 0.0, spec);
    vec3 skin = mix(vec3(0.42, 0.03, 0.06), vec3(0.86, 0.12, 0.12), l);
    // Bitten flesh inside the bite.
    float flesh = smoothstep(-0.25 * r, 0.0, -(length(q - bc) - br) - 0.0);
    skin = mix(skin, vec3(0.93, 0.45, 0.42), flesh * step(0.001, 1.0 - f));
    skin += vec3(1.0, 0.9, 0.9) * spec * 0.8;
    // Dried calyx.
    float cal = length(q + vec2(0.2, -0.25) * r) - r * 0.16 * (1.0 + 0.4 * sin(5.0 * atan(q.y, q.x)));
    skin = mix(skin, vec3(0.20, 0.10, 0.06), clamp(0.5 - cal / px, 0.0, 1.0) * 0.8);
    return mix(col, skin, clamp(0.5 - d / px, 0.0, 1.0));
}

vec3 leaf(vec2 p, float px, vec4 f0, vec4 f1, vec3 col)
{
    float f = clamp(f0.z / f0.w, 0.0, 1.0);
    float seed = hash12(f0.xy * 353.0);
    float drop = 1.0 - smoothstep(0.0, 0.6, f1.y);
    float ang = seed * TAU + 0.6 * drop;
    float L = 0.03 * (1.0 + 0.3 * drop);
    float W = 0.015 * (1.0 + 0.3 * drop);
    vec2 q = rot(p - f0.xy, -ang);
    vec2 qs = rot(p - f0.xy - vec2(0.004, -0.0055) * (1.0 + 3.0 * drop), -ang);
    float u = q.x / L;
    float hw = W * pow(max(1.0 - u * u, 0.0), 0.7) * (1.0 - 0.15 * u);
    float d = (abs(q.y) - hw) * 0.8;
    d = max(d, abs(q.x) - L);
    float us = qs.x / L;
    float ds = max((abs(qs.y) - W * pow(max(1.0 - us * us, 0.0), 0.7)) * 0.8, abs(qs.x) - L);
    // Bites eaten from the edges.
    float bites = (1.0 - f) * W * 1.2 * (0.45 + 0.55 * vnoise(vec2(q.x / L * 6.0 + seed * 40.0, sign(q.y) * 3.0)));
    d += bites;
    ds += bites;
    float stem = sdSeg(q, vec2(-0.8 * L, 0.0), vec2(-L - 0.008, 0.0025)) - 0.0007;
    col *= 1.0 - 0.35 * smoothstep(0.003, -0.002, min(ds, stem + 0.0015));
    float cov = clamp(0.5 - min(d, stem) / px, 0.0, 1.0);
    if (cov <= 0.0) return col;
    float hue = hash12(f0.xy * 77.0);
    vec3 lc = hue < 0.6 ? vec3(0.36, 0.55, 0.18) : (hue < 0.85 ? vec3(0.78, 0.58, 0.16) : vec3(0.72, 0.30, 0.12));
    lc *= 0.9 + 0.15 * vnoise(q / W * 2.0 + seed * 9.0);
    float rib = 1.0 - smoothstep(0.0003, 0.0009 + px * 0.5, abs(q.y));
    float vein = 1.0 - smoothstep(0.0, 0.08, abs(fract((q.x + abs(q.y) * 1.3) / (L * 0.28)) - 0.5) * 2.0 - 0.9);
    vec3 c = lc * (1.0 + 0.25 * rib + 0.08 * vein * step(abs(q.y), hw * 0.85));
    c *= 0.9 + 0.12 * sign(q.y) * dot(rot(vec2(0.0, 1.0), ang), lightDir().xy);
    c = mix(c, lc * 0.6, stem < d ? 1.0 : 0.0);
    return mix(col, c, cov);
}

vec3 food(vec2 p, float px, vec3 col)
{
    for (int k = 0; k < NPILE; k++) {
        vec4 f0 = texelFetch(iChannel0, ivec2(k, PILE_ROW), 0);
        if (f0.z < 0.5 || distance(p, f0.xy) > 0.05) continue;
        vec4 f1 = texelFetch(iChannel0, ivec2(k, PILE_ROW + 1), 0);
        int kind = int(f1.x + 0.5);
        if (kind == FOOD_SUGAR) col = sugarCube(p, px, f0, f1, col);
        else if (kind == FOOD_BERRY) col = berry(p, px, f0, f1, col);
        else if (kind == FOOD_LEAF) col = leaf(p, px, f0, f1, col);
        else col = crumbPile(p, px, f0, f1, col);
    }
    return col;
}

// ------------------------------------------------------------- ants

// Body outline (gaster, petiole, thorax, head) in body lengths, x forward.
float antBody(vec2 q)
{
    float dG = sdEll(q - vec2(-0.25, 0.0), vec2(0.21, 0.145));
    float dP = sdEll(q - vec2(-0.035, 0.0), vec2(0.045, 0.032));
    float dT = sdEll(q - vec2(0.10, 0.0), vec2(0.125, 0.064));
    float dH = sdEll(q - vec2(0.30, 0.0), vec2(0.095, 0.086));
    return min(min(dG, dP), min(dT, dH));
}

// Carried food in body lengths: distance, colour.
float carried(vec2 q, int kind, out vec3 c)
{
    if (kind == FOOD_LEAF) {
        vec2 lq = rot(q - vec2(0.2, 0.02), -0.35);
        float a = atan(lq.y, lq.x);
        c = vec3(0.38, 0.58, 0.2);
        return sdEll(lq, vec2(0.27, 0.19)) + 0.025 * sin(5.0 * a);
    }
    vec2 cq = q - vec2(0.49, 0.0);
    if (kind == FOOD_SUGAR) {
        c = vec3(0.97, 0.96, 0.94);
        return sdRoundBox(rot(cq, 0.4), vec2(0.06), 0.015);
    }
    if (kind == FOOD_BERRY) {
        c = vec3(0.80, 0.14, 0.14);
        return length(cq) - 0.068;
    }
    c = vec3(0.88, 0.72, 0.46);
    return length(cq) - 0.08 * (1.0 + 0.2 * sin(3.0 * atan(cq.y, cq.x) + 1.0));
}

// Ant at q (body lengths, x forward, heading ang) with pixel size pxL.
// Returns colour and coverage.
vec4 antLook(vec2 q, float pxL, float gait, float wig, int kind, float ang)
{
    if (dot(q, q) > 0.5) return vec4(0.0);
    float side = q.y >= 0.0 ? 1.0 : -1.0;
    vec2 qa = vec2(q.x, abs(q.y));

    // Legs: tripod gait, L1 R2 L3 against R1 L2 R3.
    float legD = 1e9;
    float ph = gait * TAU;
    for (int j = 0; j < 3; j++) {
        float fj = float(j);
        vec2 hip = vec2(0.15 - 0.05 * fj, 0.035);
        vec2 rest = j == 0 ? vec2(0.36, 0.24) : (j == 1 ? vec2(0.07, 0.29) : vec2(-0.22, 0.27));
        float grp = mod(fj + (side > 0.0 ? 0.0 : 1.0), 2.0);
        float sw = sin(ph + PI * grp);
        vec2 foot = rest + vec2(0.075 * sw, -0.025 * max(cos(ph + PI * grp), 0.0));
        vec2 knee = mix(hip, foot, 0.42) + vec2(0.02 * (1.0 - fj), 0.06);
        legD = min(legD, min(sdSeg(qa, hip, knee), sdSeg(qa, knee, foot)));
    }
    float w = wig * side;
    vec2 elbow = vec2(0.46 + 0.02 * w, 0.125);
    vec2 tip = vec2(0.58 + 0.015 * w, 0.10 - 0.02 * w);
    float antD = min(sdSeg(qa, vec2(0.37, 0.04), elbow), sdSeg(qa, elbow, tip));
    float manD = sdSeg(qa, vec2(0.375, 0.04), vec2(0.43, 0.012));

    float body = antBody(q);
    float limbs = max(stroke(legD, 0.02, pxL), max(stroke(antD, 0.014, pxL), stroke(manD, 0.018, pxL)));
    float bodyA = clamp(0.5 - body / pxL, 0.0, 1.0);

    vec3 base = ANT_COLOUR;
    vec3 col = base * 1.35 + 0.02;
    float a = limbs * 0.95;
    if (bodyA > 0.0) {
        // Shade the nearest segment as a glossy dome.
        vec2 c = vec2(-0.25, 0.0);
        vec2 r = vec2(0.21, 0.145);
        float dT = sdEll(q - vec2(0.10, 0.0), vec2(0.125, 0.064));
        float dH = sdEll(q - vec2(0.30, 0.0), vec2(0.095, 0.086));
        if (dT < body + 1e-4) { c = vec2(0.10, 0.0); r = vec2(0.125, 0.064); }
        if (dH < body + 1e-4) { c = vec2(0.30, 0.0); r = vec2(0.095, 0.086); }
        float spec;
        float l = domeLight((q - c) / r, ang, spec);
        vec3 bc = base * (0.6 + 0.75 * l) + vec3(0.85, 0.8, 0.75) * spec * 0.45;
        col = mix(col, bc, bodyA);
        a = max(a, bodyA);
    }
    if (kind >= 0) {
        vec3 fc;
        float d = carried(q, kind, fc);
        float fa = clamp(0.5 - d / pxL, 0.0, 1.0) * (kind == FOOD_LEAF ? 0.93 : 1.0);
        if (fa > 0.0) {
            float spec;
            float l = domeLight(clamp((q - vec2(0.45, 0.0)) / 0.1, -1.0, 1.0), ang, spec);
            fc *= kind == FOOD_LEAF ? 0.95 + 0.1 * sign(q.y) : 0.75 + 0.35 * l;
            col = mix(col, fc, fa);
            a = max(a, fa);
        }
    }
    return vec4(col, a);
}

float antShadow(vec2 q, int kind)
{
    if (dot(q, q) > 0.5) return 0.0;
    float d = antBody(q);
    if (kind >= 0) {
        vec3 c;
        d = min(d, carried(q, kind, c));
    }
    return smoothstep(0.07, -0.07, d);
}

vec3 ants(vec2 p, float px, vec3 col, float clk)
{
    vec2 gres = iChannelResolution[2].xy;
    if (gres.x < 1.0) return col;
    ivec2 gc = clamp(ivec2(p * min(gres.x, gres.y)), ivec2(0), ivec2(gres) - 1);
    vec4 ids = texelFetch(iChannel2, gc, 0);
    float len = ANT_LEN * ANT_SIZE;
    float pxL = px / len;
    vec2 nest = nestPos();

    // Nearest last, so it draws on top.
    vec4 rec[4];
    int idv[4];
    int n = 0;
    for (int k = 3; k >= 0; k--) {
        int id = int(ids[k] + 0.5) - 1;
        if (id < 0) continue;
        vec4 a0 = texelFetch(iChannel0, antTexel(id, 0), 0);
        if (modeOf(a0.w) < MODE_SEARCH || distance(p, a0.xy) > 0.75 * len + 0.002) continue;
        rec[n] = a0;
        idv[n] = id;
        n++;
    }
    if (n == 0) return col;

    vec2 shOff = vec2(0.06, -0.09);
    float shadow = 0.0;
    for (int k = 0; k < 4; k++) {
        if (k >= n) break;
        vec4 a0 = rec[k];
        int kind = carryOf(a0.w) - 1;
        vec2 q = rot(p - a0.xy, -a0.z) / len;
        vec2 qs = q - rot(shOff, -a0.z);
        float fade = smoothstep(0.6, 1.8, distance(a0.xy, nest) / NEST_HOLE);
        shadow = max(shadow, antShadow(qs, kind) * fade);
    }
    col *= 1.0 - 0.38 * shadow;
    for (int k = 0; k < 4; k++) {
        if (k >= n) break;
        vec4 a0 = rec[k];
        vec4 a1 = texelFetch(iChannel0, antTexel(idv[k], 1), 0);
        int kind = carryOf(a0.w) - 1;
        vec2 q = rot(p - a0.xy, -a0.z) / len;
        float wig = sin(clk * 9.0 + float(idv[k]) * 1.7) * 0.6 + 0.4 * sin(clk * 14.0 + float(idv[k]));
        vec4 c = antLook(q, pxL, a1.z, wig, kind, a0.z);
        // Ants at the entrance sink into it.
        float fade = smoothstep(0.6, 1.8, distance(a0.xy, nest) / NEST_HOLE);
        col = mix(col, c.rgb * mix(0.6, 1.0, fade), c.a * fade);
    }
    return col;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float U = unitPx();
    vec2 p = fragCoord / U;
    float px = 1.0 / U;
    float clk = texelFetch(iChannel0, ivec2(1, GLOBAL_ROW), 0).z;

    vec3 col = iChannelResolution[1].x > 0.0 ? wallpaper(fragCoord) : sand(p, fragCoord, px, clk);

    // Trails: compacted, darker ground where the scent is strong.
    vec4 fld = texture(iChannel3, fragCoord / iResolution.xy);
    float tf = smoothstep(0.03, 0.9, fld.x);
    float th = smoothstep(0.1, 1.2, fld.y);
    col = mix(col, col * vec3(0.82, 0.76, 0.68), TRAILS * min(0.85 * tf + 0.2 * th, 1.0));

    col = nestMound(p, px, col);
    col = food(p, px, col);
    col = ants(p, px, col, clk);

    // Moonlight: dark, blue and desaturated, brighter toward the upper right.
    float nk = nightAmount() * MOONLIGHT;
    if (nk > 0.0) {
        vec2 ws = worldSize();
        float lum = dot(col, vec3(0.3, 0.55, 0.15));
        vec3 moon = mix(vec3(lum), col, 0.45) * vec3(0.44, 0.50, 0.66);
        moon *= 0.85 + 0.3 * smoothstep(0.0, 1.0, 0.5 * (p.x / ws.x + p.y / ws.y));
        col = mix(col, moon, nk);
    }
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
