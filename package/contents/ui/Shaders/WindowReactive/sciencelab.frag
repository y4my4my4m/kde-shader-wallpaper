// Sciencelab — portals on your desktop.
// @channels bufferA, tex1
// @sim-max-height 64
//
// Rest the cursor on the bare desktop and a portal opens there; the next rest
// opens the other colour, and firing a colour again moves it. Once both exist
// they are linked: each one shows what is around the other — the wallpaper,
// the outlines of nearby windows, and the cursor itself, which steps out of
// one portal when it moves into the other. A lone portal shows a swirl, as in
// the game. Click a portal to close it.
//
// iChannel0  Buffer A: portal gun state on row 0 (see the buffer file).
// iChannel1  Wallpaper ("Image 2" in the settings). Without one a soft
//            backdrop is drawn.
//
// Lengths are in units of u = one thousandth of the screen height. Portal
// size and the resting time before a shot are shared with Buffer A.

const vec3  PORTAL_BLUE   = vec3(0.10, 0.55, 1.00); // @color @label("Blue portal")
const vec3  PORTAL_ORANGE = vec3(1.00, 0.48, 0.05); // @color @label("Orange portal")
const float PORTAL_SIZE   = 1.0;  // @range(0.4, 2.5, 0.05) @label("Portal size") @shared
const float SHOT_DELAY    = 1.1;  // @range(0.3, 5.0, 0.1) @label("Rest before a shot (s)") @shared
const float LIGHT_SPILL   = 1.0;  // @range(0.0, 2.0, 0.05) @label("Portal light on the desktop")
const float FLIP_VIEW     = 0.0;  // @range(0.0, 1.0, 1.0) @label("Mirror the view through a portal")
const vec3  BACKDROP_TOP  = vec3(0.86, 0.89, 0.92); // @color @label("Backdrop top (no wallpaper)")
const vec3  BACKDROP_LOW  = vec3(0.55, 0.59, 0.64); // @color @label("Backdrop bottom (no wallpaper)")

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

float sdRoundBox(vec2 p, vec2 center, vec2 halfSize, float r)
{
    vec2 q = abs(p - center) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// ------------------------------------------------------------- scene

// The desktop behind the windows at pixel p: the wallpaper (cover-fitted)
// or the procedural backdrop.
vec3 backdrop(vec2 p)
{
    vec2 uv = p / iResolution.xy;
    if (iChannelResolution[1].x > 0.0) {
        vec2 texRes = iChannelResolution[1].xy;
        float sa = iResolution.x / iResolution.y;
        float ta = texRes.x / texRes.y;
        vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
        return texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
    }
    // Soft studio backdrop: vertical gradient, a broad light from the upper
    // left and faint mottling, so a portal's view has something to show.
    vec2 q = p / iResolution.y;
    vec3 col = mix(BACKDROP_LOW, BACKDROP_TOP, smoothstep(0.0, 1.0, uv.y));
    col *= 0.88 + 0.16 * exp(-length(q - vec2(0.35, 1.05)) * 1.3);
    col *= 0.97 + 0.04 * vnoise(q * 9.0) + 0.02 * vnoise(q * 40.0);
    return col;
}

// What a portal shows at scene point p: the backdrop, the windows there as
// frosted panes (their contents are not available to a wallpaper) and the
// cursor as a small arrow.
vec3 viewOf(vec2 p, float u)
{
    vec3 col = backdrop(p);
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 2.0 || r.w < 2.0) continue;
        float d = sdRoundBox(p, r.xy + r.zw * 0.5, r.zw * 0.5, 6.0 * u);
        if (d < 0.0) {
            float title = step(r.y + r.w - 28.0 * u, p.y);
            vec3 pane = mix(vec3(0.93, 0.94, 0.96), vec3(0.84, 0.86, 0.89), title);
            col = mix(col, pane, 0.92);
            col *= 1.0 - 0.25 * exp(d / (2.0 * u));
        } else {
            col *= 1.0 - 0.3 * exp(-d / (10.0 * u));
        }
    }
    // Cursor arrow, tip at the cursor, 18 u tall.
    if (iMouse.x > 1.0 || iMouse.y > 1.0) {
        vec2 q = (p - iMouse.xy) / (18.0 * u);
        q.y = -q.y;
        bool body = q.x >= 0.0 && q.y >= 0.0 && q.y <= 1.0 && q.x <= q.y * 0.62
                    && !(q.y > 0.72 && q.x > 0.2 && q.x < 0.55);
        bool tail = q.x > 0.22 && q.x < 0.42 && q.y > 0.6 && q.y < 1.25
                    && q.x > (q.y - 0.6) * 0.35 + 0.18;
        if (body || tail) {
            bool edge = q.x < 0.07 || q.x > q.y * 0.62 - 0.07 || q.y > 0.93;
            col = (edge && body) ? vec3(0.05) : vec3(0.98);
        }
    }
    return col;
}

// ------------------------------------------------------------- portals

struct Portal {
    vec2 c;        // centre, pixels
    vec2 radii;    // half width, half height, pixels
    float age;     // seconds since fired, or since closing began
    bool exists;
    bool closing;
};

Portal portalFrom(vec4 state, float u)
{
    Portal p;
    p.exists = state.w > 0.5;
    p.closing = state.w > 1.5;
    p.c = state.xy * iResolution.xy;
    p.age = max(state.z, 0.0);
    // Opens over 0.45 s with a small overshoot; collapses over 0.35 s.
    float k = clamp(p.age / 0.45, 0.0, 1.0);
    float open = clamp(1.0 + 0.12 * sin(k * 3.14159) - (1.0 - k) * (1.0 - k) * (1.0 - k), 0.0, 1.15);
    if (p.closing) {
        float c = clamp(p.age / 0.35, 0.0, 1.0);
        open = (1.0 - c * c) * (1.0 + 0.15 * sin(c * 3.14159));
    }
    float h = 95.0 * u * PORTAL_SIZE * open;
    p.radii = vec2(h * 0.58, h);
    return p;
}

// Rim and halo colour in rgb, interior coverage in a.
vec4 portalRim(Portal p, vec2 fc, vec3 rimCol, float u, float t, float lift)
{
    if (!p.exists || p.radii.y < 0.5) return vec4(0.0);
    vec2 q = fc - p.c;
    if (abs(q.x) > p.radii.x + 90.0 * u || abs(q.y) > p.radii.y + 90.0 * u) return vec4(0.0);
    float r = length(q / p.radii);
    float ang = atan(q.y, q.x);
    float flick = vnoise(vec2(ang * 3.0 + t * 1.7, t * 2.3)) - 0.5;
    float flick2 = vnoise(vec2(ang * 9.0 - t * 4.0, r * 3.0)) - 0.5;
    float d = (r - 1.0 - 0.03 * flick - 0.018 * flick2) * p.radii.y;

    float rim = exp(-abs(d) / (3.4 * u));
    float rimHot = exp(-abs(d) / (1.3 * u));
    float halo = exp(-max(d, 0.0) / (18.0 * u));
    // Brighter tongues travelling around the edge.
    rim *= 0.75 + 0.5 * vnoise(vec2(ang * 5.0 - t * 3.0, t * 1.5));
    float inside = 1.0 - smoothstep(-1.5 * u, 0.5 * u, d);
    vec3 add = rimCol * (rim * 1.35 + halo * 0.45 * LIGHT_SPILL) * lift + vec3(1.0) * rimHot * 0.55;
    add += rimCol * exp(-p.age * 6.0) * 0.8 * exp(-length(q) / (45.0 * u));
    return vec4(add, inside);
}

// The interior: the view through to the partner, or a swirl when unlinked.
vec3 portalInterior(Portal self, Portal other, vec2 fc, vec3 rimCol, float u, float t)
{
    vec2 q = fc - self.c;
    float r = length(q / max(self.radii, vec2(1e-3)));
    if (other.exists && !other.closing && !self.closing && other.radii.y > 0.5) {
        vec2 off = q;
        if (FLIP_VIEW > 0.5) off.x = -off.x;
        vec3 view = viewOf(other.c + off, u);
        float edge = smoothstep(0.55, 1.0, r);
        return mix(view, view * 0.6 + rimCol * 0.55, edge * 0.8);
    }
    float ang = atan(q.y, q.x);
    float swirl = vnoise(vec2(ang * 2.5 + r * 5.0 - t * 1.2, r * 4.0 - t * 0.8));
    return rimCol * (0.12 + 0.55 * smoothstep(0.2, 1.0, r) + 0.2 * swirl);
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float u = iResolution.y / 1000.0;
    float t = iTime;

    vec3 col = backdrop(fragCoord);

    Portal blue = portalFrom(texelFetch(iChannel0, ivec2(1, 0), 0), u);
    Portal orange = portalFrom(texelFetch(iChannel0, ivec2(2, 0), 0), u);

    // A cursor over or near a portal makes its rim flare.
    bool mouseOn = iMouse.x > 1.0 || iMouse.y > 1.0;
    float nearB = (mouseOn && blue.exists && blue.radii.y > 0.5)
        ? exp(-max(length((iMouse.xy - blue.c) / blue.radii) - 1.0, 0.0) * 3.0) : 0.0;
    float nearO = (mouseOn && orange.exists && orange.radii.y > 0.5)
        ? exp(-max(length((iMouse.xy - orange.c) / orange.radii) - 1.0, 0.0) * 3.0) : 0.0;

    vec4 rb = portalRim(blue, fragCoord, PORTAL_BLUE, u, t, 1.0 + 0.6 * nearB);
    vec4 ro = portalRim(orange, fragCoord, PORTAL_ORANGE, u, t + 7.0, 1.0 + 0.6 * nearO);

    if (rb.a > 0.0) col = mix(col, portalInterior(blue, orange, fragCoord, PORTAL_BLUE, u, t), rb.a);
    if (ro.a > 0.0) col = mix(col, portalInterior(orange, blue, fragCoord, PORTAL_ORANGE, u, t + 7.0), ro.a);

    vec3 add = rb.rgb + ro.rgb;
    col += add / (1.0 + 0.5 * add);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
