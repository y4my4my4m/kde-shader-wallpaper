// Plasma Windows — image pass.
// @channels bufferA, tex1
// @sim-max-height 540
//
// Every window is a charged electrode. A corona crackles along its edges,
// growing while the window moves; windows close to each other arc across the
// gap, and the window nearest the cursor reaches for it like a plasma globe
// touching a fingertip. Arc paths re-roll several times a second and Buffer A
// keeps their afterglow.
//
// iChannel0  Buffer A (arc and moving-window afterglow, coarser grid).
// iChannel1  Optional wallpaper ("Image 2" in the settings); without one a dark nebula is
//            drawn instead (iChannelResolution[1] is zero when unbound).

const vec3  ARC_CORE      = vec3(0.92, 0.95, 1.00); // @color @label("Arc core")
const vec3  ARC_GLOW      = vec3(0.58, 0.32, 1.00); // @color @label("Arc glow")
const vec3  EDGE_COLOR    = vec3(0.36, 0.72, 1.00); // @color @label("Edge corona")
const float INTENSITY     = 1.0;  // @range(0.0, 2.0, 0.05) @label("Intensity")
const float CORONA        = 1.0;  // @range(0.0, 2.0, 0.05) @label("Edge corona")
const float WALLPAPER_DIM = 0.72; // @range(0.2, 1.0, 0.01) @label("Wallpaper brightness")
const float STARS         = 1.0;  // @range(0.0, 2.0, 0.05) @label("Stars (no wallpaper)")

float vnoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p)
{
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p;
        a *= 0.5;
    }
    return v;
}

vec3 nebula(vec2 p, float t)
{
    vec2 q = p * 1.3;
    q += 0.7 * vec2(fbm(q + vec2(0.0, t * 0.015)), fbm(q + vec2(3.1, -t * 0.012)));
    float n = fbm(q * 1.4 + 2.0);
    float m = fbm(q * 2.7 - 5.0);
    vec3 col = vec3(0.010, 0.008, 0.022);
    col += vec3(0.20, 0.07, 0.34) * smoothstep(0.35, 0.95, n);
    col += vec3(0.03, 0.12, 0.22) * smoothstep(0.50, 0.95, m) * 0.9;

    // Sparse stars, one candidate per 7x7 px cell, twinkling slowly.
    vec2 cell = floor(p * iResolution.y / 7.0);
    float h = hash12(cell);
    if (h > 0.985) {
        vec2 c = (cell + 0.5 + 0.3 * (vec2(hash12(cell + 1.3), hash12(cell + 7.1)) - 0.5)) * 7.0;
        float d = length(p * iResolution.y - c);
        float tw = 0.6 + 0.4 * sin(t * (0.6 + 2.0 * h) + h * 40.0);
        col += vec3(0.75, 0.80, 1.0) * exp(-d * d * 0.6) * tw * STARS * (h - 0.985) * 60.0;
    }
    return col;
}

// Arc-length coordinate of the rect edge nearest p, counter-clockwise from
// the bottom-left corner. Continuous along each edge, jumps only at corners.
float perimeterCoord(vec2 p, vec4 r)
{
    vec2 lo = r.xy;
    vec2 hi = r.xy + r.zw;
    vec2 c = clamp(p, lo, hi);
    float db = c.y - lo.y;
    float dr = hi.x - c.x;
    float dt = hi.y - c.y;
    float dl = c.x - lo.x;
    float m = min(min(db, dr), min(dt, dl));
    if (m == db) return c.x - lo.x;
    if (m == dr) return r.z + (c.y - lo.y);
    if (m == dt) return r.z + r.w + (hi.x - c.x);
    return 2.0 * r.z + r.w + (hi.y - c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = fragCoord / iResolution.y;
    float t = iTime;
    float u = unitPx();

    vec3 bg;
    if (iChannelResolution[1].x > 0.0) {
        vec2 texRes = iChannelResolution[1].xy;
        float sa = iResolution.x / iResolution.y;
        float ta = texRes.x / texRes.y;
        vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
        bg = texture(iChannel1, (uv - 0.5) * fit + 0.5).rgb * WALLPAPER_DIM;
    } else {
        bg = nebula(p, t);
    }

    vec3 add = vec3(0.0);
    vec3 f = arcField(fragCoord, 1.6 * u, 0.36 * iResolution.y, 0.32 * iResolution.y);

    // Edge corona.
    int n = min(iWindowCount, 16);
    for (int i = 0; i < n; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 2.0 || r.w < 2.0) continue;
        vec2 halfSize = r.zw * 0.5;
        float d = sdRoundBox(fragCoord, r.xy + halfSize, halfSize, 6.0 * u);
        if (d > 90.0 * u || d < -3.0 * u) continue;

        float speed = length(iWindowVelocities[i]);
        float activity = 0.22 + 0.78 * smoothstep(30.0, 700.0, speed);
        float s = perimeterCoord(fragCoord, r) / u;
        float dd = max(d, 0.0);
        // Filaments: noise along the edge, sheared with distance so each
        // streamer bends and forks instead of standing straight out.
        float bend = (vnoise(vec2(s * 0.02 + float(i) * 5.0, t * 0.7)) - 0.5) * dd / u * 0.9;
        float flow = (s + bend) * 0.055 - t * 1.6 + float(i) * 13.0;
        float streak = vnoise(vec2(flow, t * 4.0 + float(i) + dd / u * 0.02));
        streak = pow(streak, 3.0) * 2.4;
        float reach = (5.0 + 22.0 * streak * activity) * u;
        float halo = exp(-dd / (14.0 * u)) * 0.25;
        float corona = (exp(-dd / reach) * (0.12 + streak) + halo) * activity;

        // Charge pulse running around the perimeter.
        float perim = 2.0 * (r.z + r.w) / u;
        float ps = mod(t * 420.0 + float(i) * 211.0, perim);
        float ds = abs(s - ps);
        ds = min(ds, perim - ds);
        float pulse = exp(-ds * ds / 900.0) * exp(-dd / (3.0 * u));

        float line = exp(-abs(d) / (1.1 * u));
        add += EDGE_COLOR * (corona * 0.9 + line * 0.55 * (0.5 + activity)) * CORONA;
        add += ARC_CORE * pulse * 1.2 * CORONA;
    }

    // Crisp arcs plus Buffer A's afterglow.
    vec4 trail = texture(iChannel0, uv);
    add += ARC_CORE * f.x * 2.6;
    add += ARC_GLOW * f.y * 1.3;
    add += ARC_GLOW * (trail.x * 1.2 + trail.y * 0.6);
    add += mix(EDGE_COLOR, ARC_GLOW, 0.5) * trail.z * 0.8 * CORONA;

    // Spark where the arc touches the cursor.
    if (f.z > 0.0) {
        float dm = length(fragCoord - iMouse.xy);
        add += mix(ARC_GLOW, ARC_CORE, 0.6) * f.z * exp(-dm / (7.0 * u)) * (0.7 + 0.3 * sin(t * 50.0));
    }

    add *= INTENSITY;
    // Light spill tints the background, highlights compress smoothly.
    vec3 col = bg * (1.0 + 0.3 * add) + add / (1.0 + 0.35 * add);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
