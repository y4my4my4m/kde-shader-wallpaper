// Falling Sand — a falling-sand toy on the desktop.
// @channels bufferA, tex1
// @sim-max-height 180
//
// Hold the mouse on the bare desktop to pour the selected material from the
// cursor; the palette in the top-right corner picks sand, water, seeds,
// stone, snow or the eraser. Sand piles up and darkens where water soaks
// in, and wet sand holds steeper slopes. Water flows, levels out and slowly
// evaporates. Seeds that land on wet sand sprout into small plants that
// leaf, flower, wilt and drop a seed. Stone stays where it is drawn and
// weathers to gravel; snow melts into water. Windows are solid: material
// piles up on them, falls when a window moves away, and is shoved aside or
// over the top when a window is dragged through it. Now and then a rain
// shower, a trickle of sand from the top, a gust of seeds or, in winter,
// snow passes through, and old sand sinks into the floor, so the screen
// never fills up. Presses that start on a window are ignored.
//
// iChannel0  Buffer A: cells and state (see falling_sand_common.frag).
// iChannel1  Wallpaper ("Image 2" in the settings). Without one, a soft sky
//            tinted by the local clock.
//
// Grain size follows the buffer height: @sim-max-height above, or the
// simulation max height setting. Pouring speed, ambient events and
// evaporation are shared with Buffer A; the other tweaks reach only this
// pass.

const vec3  SAND_COLOUR  = vec3(0.89, 0.75, 0.50); // @color @label("Sand colour")
const vec3  WATER_COLOUR = vec3(0.24, 0.55, 0.93); // @color @label("Water colour")
const float LIGHTING     = 1.0;  // @range(0.0, 2.0, 0.05) @label("Soft light and shadows")
const float GRAIN_RELIEF = 1.0;  // @range(0.0, 2.0, 0.05) @label("Grain relief")
const float CLOCK_SKY    = 1.0;  // @range(0.0, 1.0, 1.0) @label("Sky follows the clock (no wallpaper)")
const float POUR_RATE    = 1.0;  // @range(0.1, 4.0, 0.05) @label("Pouring speed") @shared
const float AMBIENT      = 1.0;  // @range(0.0, 1.0, 1.0) @label("Rain, snow and seed showers") @shared
const float EVAPORATION  = 1.0;  // @range(0.0, 5.0, 0.05) @label("Evaporation") @shared

// Palette icons, 16 x 16, rows top first, 2 bits per pixel (bits 2x..2x+1 =
// column x): 0 clear, 1 outline, 2 base, 3 accent. Order as T_*.
const uint ICON_ART[96] = uint[96](
    0x00000000u, 0x00008000u, 0x00000000u, 0x00080000u, 0x00002000u, 0x00000000u, 0x00014000u, 0x00069000u,
    0x001BA400u, 0x006AA900u, 0x01BAAE40u, 0x06ABAA90u, 0x1BAAABA4u, 0x15555554u, 0x00000000u, 0x00000000u,
    0x00000000u, 0x00004000u, 0x00019000u, 0x00019000u, 0x0006A400u, 0x0006A400u, 0x001AA900u, 0x001AB900u,
    0x006AAE40u, 0x006AAE40u, 0x006ABA40u, 0x006AAA40u, 0x001AA900u, 0x00055400u, 0x00000000u, 0x00000000u,
    0x00000000u, 0x01500150u, 0x06A406A4u, 0x06A91AA4u, 0x01AA6A90u, 0x005AA940u, 0x00169400u, 0x00018000u,
    0x00059000u, 0x001FF400u, 0x007FFD00u, 0x007FFD00u, 0x007FFD00u, 0x001FF400u, 0x00055000u, 0x00000000u,
    0x00000000u, 0x00000000u, 0x00000000u, 0x00000000u, 0x00055000u, 0x005BE500u, 0x01AABE40u, 0x06AAAB90u,
    0x06AAAA90u, 0x1AAAAAA4u, 0x1AAAAAA4u, 0x1AAAAAA4u, 0x05555550u, 0x00000000u, 0x00000000u, 0x00000000u,
    0x00000000u, 0x00008000u, 0x00088800u, 0x0002A000u, 0x02008020u, 0x00808080u, 0x00208200u, 0x2AAAEAA8u,
    0x00208200u, 0x00808080u, 0x02008020u, 0x0002A000u, 0x00088800u, 0x00008000u, 0x00000000u, 0x00000000u,
    0x00000000u, 0x00000000u, 0x01500000u, 0x06A40000u, 0x1AA90000u, 0x1AAA4000u, 0x06AA9000u, 0x01AAB400u,
    0x006AFD00u, 0x001BFF40u, 0x0007FFD0u, 0x0001FFD0u, 0x00007F40u, 0x00001500u, 0x00000000u, 0x00000000u
);

int gRows;
int gCols;
vec3 gLight;

vec4 cellAt(ivec2 c)
{
    if (c.x < 0 || c.y < 0 || c.x >= gCols || c.y >= gRows) return vec4(0.0);
    return texelFetch(iChannel0, c, 0);
}

vec4 stateAt(int k) { return texelFetch(iChannel0, ivec2(k, int(iChannelResolution[0].y) - 1), 0); }

// Cell c lies wholly inside a window: a wall in the simulation (same rule
// as Buffer A's windowInterior).
bool inWindowCell(ivec2 c)
{
    vec2 k = vec2(float(gCols), float(gRows)) / iResolution.xy;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        ivec2 lo = ivec2(ceil(r.xy * k - 0.001));
        ivec2 hi = ivec2(floor((r.xy + r.zw) * k + 0.001));
        if (c.x >= lo.x && c.y >= lo.y && c.x < hi.x && c.y < hi.y) return true;
    }
    return false;
}

// Open air: empty, inside the grid and outside every window.
bool air(ivec2 c) { return c.y >= 0 && matOf(cellAt(c)) == M_EMPTY && !inWindowCell(c); }

float sdBox(vec2 p, vec2 b, float r)
{
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 rot(vec2 p, float a)
{
    float c = cos(a);
    float s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// ------------------------------------------------------------- sky

const float SKY_HOURS[8] = float[8](0.0, 5.0, 7.0, 10.0, 16.0, 18.6, 20.6, 24.0);
const vec3 SKY_TOP[8] = vec3[8](
    vec3(0.09, 0.11, 0.22), vec3(0.09, 0.11, 0.22), vec3(0.42, 0.50, 0.74), vec3(0.50, 0.72, 0.94),
    vec3(0.50, 0.72, 0.94), vec3(0.36, 0.38, 0.66), vec3(0.11, 0.12, 0.26), vec3(0.09, 0.11, 0.22));
const vec3 SKY_LOW[8] = vec3[8](
    vec3(0.20, 0.19, 0.33), vec3(0.20, 0.19, 0.33), vec3(0.99, 0.76, 0.62), vec3(0.89, 0.93, 0.97),
    vec3(0.89, 0.93, 0.97), vec3(1.00, 0.66, 0.48), vec3(0.27, 0.23, 0.40), vec3(0.20, 0.19, 0.33));
const vec3 SKY_LIGHT[8] = vec3[8](
    vec3(0.47, 0.50, 0.68), vec3(0.47, 0.50, 0.68), vec3(1.00, 0.86, 0.76), vec3(1.00, 0.99, 0.96),
    vec3(1.00, 0.99, 0.96), vec3(1.00, 0.80, 0.66), vec3(0.54, 0.54, 0.72), vec3(0.47, 0.50, 0.68));

// Sky top, horizon and light colour for the local clock (noon with
// CLOCK_SKY off).
void skyAt(out vec3 top, out vec3 low, out vec3 light)
{
    float h = CLOCK_SKY > 0.5 ? mod(iDate.w / 3600.0, 24.0) : 12.0;
    top = SKY_TOP[0];
    low = SKY_LOW[0];
    light = SKY_LIGHT[0];
    for (int i = 0; i < 7; i++) {
        if (h >= SKY_HOURS[i] && h < SKY_HOURS[i + 1]) {
            float f = smoothstep(SKY_HOURS[i], SKY_HOURS[i + 1], h);
            top = mix(SKY_TOP[i], SKY_TOP[i + 1], f);
            low = mix(SKY_LOW[i], SKY_LOW[i + 1], f);
            light = mix(SKY_LIGHT[i], SKY_LIGHT[i + 1], f);
        }
    }
}

// The desktop behind the sand: the wallpaper (cover-fitted) or the sky,
// greyed while it rains or snows.
vec3 backdrop(vec2 p, vec2 res, float overcast)
{
    vec2 uv = p / res;
    if (iChannelResolution[1].x > 0.0) {
        vec2 texRes = iChannelResolution[1].xy;
        float sa = res.x / res.y;
        float ta = texRes.x / texRes.y;
        vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
        return texture(iChannel1, clamp((uv - 0.5) * fit + 0.5, 0.0, 1.0)).rgb;
    }
    vec3 top, low, light;
    skyAt(top, low, light);
    vec3 col = mix(low, top, pow(uv.y, 0.85));
    // Soft sun glow from the upper left, the side the light comes from.
    vec2 q = p / res.y;
    float glow = exp(-length(q - vec2(0.12 * res.x / res.y, 1.02)) * 2.2);
    col += light * glow * 0.10;
    // Faint twinkling stars once the sky is dark.
    float night = 1.0 - smoothstep(0.15, 0.40, dot(top, vec3(0.3, 0.5, 0.2)));
    if (night > 0.0) {
        vec2 sc = q * 70.0;
        vec2 sid = floor(sc);
        float h = hash12(sid + 17.0);
        if (h > 0.975) {
            float d = length(fract(sc) - 0.5 - (vec2(hash12(sid), hash12(sid + 5.0)) - 0.5) * 0.5);
            float tw = 0.6 + 0.4 * sin(iDate.w * (1.0 + 2.0 * h) + h * 40.0);
            col += vec3(0.9, 0.92, 1.0) * night * tw * smoothstep(0.09, 0.0, d) * smoothstep(0.25, 0.8, uv.y) * 0.8;
        }
    }
    float grey = dot(col, vec3(0.3, 0.5, 0.2));
    col = mix(col, vec3(grey) * vec3(0.92, 0.95, 1.0), 0.45 * overcast) * (1.0 - 0.12 * overcast);
    return col;
}

// ------------------------------------------------------------- cells

// Empty cell c resting on water with water within three cells on both
// sides: a short gap in a water surface, drawn as water.
bool waterGap(ivec2 c)
{
    if (matOf(cellAt(c)) != M_EMPTY || matOf(cellAt(c - ivec2(0, 1))) != M_WATER) return false;
    bool l = false;
    bool r = false;
    for (int k = 1; k <= 3; k++) {
        l = l || matOf(cellAt(c - ivec2(k, 0))) == M_WATER;
        r = r || matOf(cellAt(c + ivec2(k, 0))) == M_WATER;
    }
    return l && r;
}

// Shadow weight a cell casts.
float occ(vec4 v)
{
    int m = matOf(v);
    if (m == M_EMPTY) return 0.0;
    if (m == M_WATER) return 0.3;
    if (m >= M_LEAF || m == M_SEED || m == M_LITTER) return 0.55;
    return 1.0;
}

// Soft drop shadow at cell position q, light from the upper left.
float castShadow(vec2 q)
{
    vec2 p = q + vec2(-0.32, 0.42) - 0.5;
    ivec2 i0 = ivec2(floor(p));
    vec2 t = smoothstep(0.0, 1.0, p - vec2(i0));
    float a = occ(cellAt(i0));
    float b = occ(cellAt(i0 + ivec2(1, 0)));
    float c = occ(cellAt(i0 + ivec2(0, 1)));
    float d = occ(cellAt(i0 + ivec2(1, 1)));
    return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}

// Square grain shading: brighter toward the upper left, a fine seam at the
// edge. f is the position in the cell, px one output pixel in cell units.
float relief(vec2 f, float px, float strength)
{
    vec2 e = f - 0.5;
    float seam = smoothstep(0.5 - 1.3 * px, 0.5, max(abs(e.x), abs(e.y)));
    return 1.0 + GRAIN_RELIEF * strength * (0.07 * (e.y - e.x) - 0.08 * seam);
}

vec3 flowerColour(float s)
{
    int k = int(fract(s * 3.17 + 0.41) * 5.0);
    if (k == 0) return vec3(1.00, 0.56, 0.72);
    if (k == 1) return vec3(0.98, 0.96, 0.90);
    if (k == 2) return vec3(0.74, 0.60, 0.96);
    if (k == 3) return vec3(1.00, 0.52, 0.38);
    return vec3(0.52, 0.72, 1.00);
}

// Plant colour after wilting: browner and duller toward the end of life.
vec3 wilt(vec3 c, vec4 v)
{
    float k = smoothstep(plantLife(v.y) - 12.0, plantLife(v.y) + WILT_TIME, v.w);
    return mix(c, vec3(0.56, 0.42, 0.24) * (0.8 + 0.3 * dot(c, vec3(0.33))), k * 0.85);
}

// Sprite drawn into a cell: colour in rgb, coverage in a.
vec4 sprite(int m, vec4 v, vec2 f, float px, ivec2 ci)
{
    float aa = 1.2 * px;
    // Leaves and flowers sway gently, more toward the top of the cell.
    if (m >= M_LEAF) f.x -= 0.05 * f.y * sin(iDate.w * 1.3 + float(ci.x) * 0.45 + v.y * 6.0);
    if (m == M_SEED) {
        vec2 p = rot(f - vec2(0.5, 0.42), (v.y - 0.5) * 1.2);
        float d = length(p / vec2(0.28, 0.37)) - 1.0;
        vec3 c = vec3(0.52, 0.33, 0.17) * (0.85 + 0.3 * v.y);
        c = mix(c * 0.7, c, smoothstep(0.0, -0.35, d));
        c = mix(c, c * 1.5, smoothstep(0.1, -0.2, length(p - vec2(-0.08, 0.12)) - 0.12));
        return vec4(c, smoothstep(aa / 0.3, -aa / 0.3, d));
    }
    if (m == M_LITTER) {
        vec2 p = rot(f - 0.5, v.y * 6.283);
        float d = length(p / vec2(0.44, 0.22)) - 1.0;
        vec3 c = mix(vec3(0.62, 0.40, 0.18), vec3(0.82, 0.52, 0.20), fract(v.y * 5.3));
        c = mix(c, vec3(0.58, 0.55, 0.26), step(0.7, fract(v.y * 11.1)));
        c = mix(c * 0.75, c, smoothstep(0.0, -0.3, d));
        return vec4(c, smoothstep(aa / 0.25, -aa / 0.25, d));
    }
    if (m == M_STEM || m == M_TIP) {
        float w = 0.22;
        float x = (f.x - 0.5) / w;
        float d = (abs(f.x - 0.5) - w);
        if (m == M_TIP) d = max(d, f.y - 0.55);
        vec3 c = vec3(0.30, 0.62, 0.24) * (1.08 - 0.28 * smoothstep(-0.6, 1.0, x));
        if (m == M_STEM && abs(f.x - 0.5) > w - aa) {
            float sd = f.x > 0.5 ? 1.0 : -1.0;
            vec4 n = cellAt(ci + ivec2(int(sd), 0));
            if (matOf(n) == M_LEAF && n.z * sd > 0.5) d = min(d, abs(f.y - 0.20) - 0.07);
        }
        float a = smoothstep(aa, -aa, d);
        if (m == M_TIP) {
            float bud = length((f - vec2(0.5, 0.56)) / vec2(0.30, 0.34)) - 1.0;
            vec3 b = mix(vec3(0.40, 0.72, 0.30), vec3(0.62, 0.88, 0.44), smoothstep(0.2, -0.6, length(f - vec2(0.42, 0.66)) - 0.1));
            c = mix(c, b, smoothstep(aa / 0.3, -aa / 0.3, bud));
            a = max(a, smoothstep(aa / 0.3, -aa / 0.3, bud));
        }
        return vec4(wilt(c, v), a);
    }
    if (m == M_LEAF) {
        // A leaf one or two cells long rising outward from the stem; u is
        // the distance from the stem in cells. The inner half (|z| = 1)
        // looks at its neighbour for an outer half (|z| = 2).
        float side = v.z > 0.0 ? 1.0 : -1.0;
        bool outer = abs(v.z) > 1.5;
        float len = outer ? 2.0 : 1.0;
        if (!outer) {
            vec4 n = cellAt(ci + ivec2(int(side), 0));
            if (matOf(n) == M_LEAF && n.z * side > 1.5) len = 2.0;
        }
        float u = (f.x - 0.5) * side + 0.5 + (outer ? 1.0 : 0.0);
        float s = clamp((u - 0.12) / (len - 0.12), 0.0, 1.0);
        float centre = 0.20 + 0.28 * u;
        float halfW = (len > 1.5 ? 0.36 : 0.28) * pow(sin(3.1416 * s), 0.65) * (1.0 - 0.25 * s);
        float d = abs(f.y - centre) - max(halfW, u < 0.3 ? 0.07 : 0.0);
        vec3 c = vec3(0.42, 0.76, 0.30) * (0.94 + 0.12 * fract(v.y * 13.7));
        c = mix(c * 0.82, c * 1.10, smoothstep(-0.15, 0.15, f.y - centre));
        c = mix(c, c * 0.74, smoothstep(aa, -aa, abs(f.y - centre) - 0.03) * step(0.12, s) * step(s, 0.85));
        c = mix(c * 0.72, c, smoothstep(0.0, -0.07, d));
        return vec4(wilt(c, v), smoothstep(aa, -aa, d));
    }
    vec3 petal = flowerColour(v.y);
    if (m == M_FLOWER) {
        float back = length(f - 0.5) - 0.52;
        float heart = length(f - 0.5) - 0.30;
        vec3 c = mix(petal * 0.88, vec3(1.00, 0.80, 0.28), smoothstep(aa, -aa, heart));
        c = mix(c, vec3(1.0, 0.94, 0.60), smoothstep(0.14, 0.0, length(f - vec2(0.42, 0.60))) * 0.7);
        c = mix(c * 0.8, c, smoothstep(0.0, -0.06, heart) + step(0.0, heart));
        return vec4(wilt(c, v), smoothstep(aa, -aa, back));
    }
    if (m == M_PETAL) {
        vec2 dir = v.z < 0.5 ? vec2(-1.0, 0.0) : (v.z < 1.5 ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
        vec2 p = f - 0.5;
        float along = dot(p, dir);
        float across = dot(p, vec2(-dir.y, dir.x));
        // Rounded lobe joined to the flower centre on the inner side.
        float d = (length(vec2(max(along + 0.02, 0.0) / 0.48, across / 0.44)) - 1.0) * 0.44;
        d = max(d, -along - 0.5);
        vec3 c = petal * (0.90 + 0.14 * smoothstep(-0.3, 0.3, along));
        c = mix(c * 0.78, c, smoothstep(0.0, -0.06, d));
        return vec4(wilt(c, v), smoothstep(aa, -aa, d));
    }
    return vec4(0.0);
}

// Colour of a full-cell material grain.
vec3 grainColour(int m, vec4 v)
{
    float t = v.y;
    if (m == M_SAND) {
        // Four tones, a few warmer and a few paler grains.
        vec3 c = SAND_COLOUR * (0.90 + 0.06 * floor(t * 4.0));
        float k = fract(t * 7.3);
        c *= k > 0.92 ? vec3(1.07, 0.97, 0.86) : (k < 0.06 ? vec3(1.06, 1.06, 1.04) : vec3(1.0));
        return mix(c, c * vec3(0.64, 0.58, 0.52), smoothstep(0.06, 0.7, v.z));
    }
    if (m == M_GRAVEL) {
        vec3 c = vec3(0.60, 0.59, 0.57) * (0.76 + 0.1 * floor(t * 4.0));
        return mix(c, c * vec3(1.0, 0.92, 0.82), step(0.75, fract(t * 5.7)));
    }
    if (m == M_STONE) return vec3(0.50, 0.52, 0.57) * (0.84 + 0.07 * floor(t * 4.0));
    return vec3(0.95, 0.97, 1.0) * (0.96 + 0.015 * floor(t * 4.0));
}

vec3 shadeCells(vec2 fragCoord, vec2 res, vec3 bg)
{
    vec2 cellPx = res / vec2(float(gCols), float(gRows));
    vec2 q = fragCoord / cellPx;
    ivec2 ci = ivec2(floor(q));
    vec2 f = q - vec2(ci);
    float px = 1.0 / cellPx.y;
    float lit = LIGHTING;

    vec4 v = cellAt(ci);
    int m = matOf(v);
    vec4 dn = cellAt(ci - ivec2(0, 1));
    vec3 shadowed = bg * (1.0 - 0.22 * lit * castShadow(q));
    if (m == M_EMPTY) {
        int dm = matOf(dn);
        if (dm == M_WATER && waterGap(ci)) {
            v = dn;
            m = M_WATER;
        } else {
            // Motion streak, two cells long, above a falling grain or drop.
            float tail = 0.0;
            vec4 g = dn;
            if (dm == M_EMPTY && ci.y > 2) {
                g = cellAt(ci - ivec2(0, 2));
                dm = matOf(g);
                tail = 1.0;
            }
            if ((dm == M_SAND || dm == M_GRAVEL || dm == M_WATER) && air(ci - ivec2(0, 2 + int(tail)))) {
                float w = dm == M_WATER ? 0.14 : 0.30;
                vec3 sc = dm == M_WATER ? WATER_COLOUR * 0.85 : grainColour(dm, g);
                float a = (dm == M_WATER ? 0.6 : 0.45) * (1.0 - 0.5 * (f.y + tail));
                return mix(shadowed, sc * gLight, a * smoothstep(px, -px, abs(f.x - 0.5) - w));
            }
            return shadowed;
        }
    }

    vec4 up = cellAt(ci + ivec2(0, 1));
    float upOcc = occ(up);

    if (m >= M_SEED && m != M_STONE && m != M_SNOW && m != M_GRAVEL) {
        // Under a grain the sprite is buried: sand shows around it.
        int um = matOf(up);
        if (um == M_SAND || um == M_GRAVEL || um == M_SNOW || um == M_STONE)
            shadowed = grainColour(um, up) * gLight * (1.0 - 0.08 * lit) * relief(f, px, 1.0);
        vec4 s = sprite(m, v, f, px, ci);
        vec3 c = s.rgb * gLight * (1.0 - 0.06 * lit * upOcc);
        return mix(shadowed, c, s.a);
    }

    bool airborne = matOf(dn) == M_EMPTY && ci.y > 0 && !inWindowCell(ci - ivec2(0, 1));
    vec4 u2 = cellAt(ci + ivec2(0, 2));

    if (m == M_WATER) {
        vec3 w = WATER_COLOUR * gLight;
        if (airborne) {
            // A falling drop.
            float d = length((f - vec2(0.5, 0.40)) / vec2(0.24, 0.48)) - 1.0;
            vec3 c = mix(w * 0.85, vec3(0.9, 0.96, 1.0) * gLight, 0.45 * smoothstep(0.0, -0.8, length(f - vec2(0.44, 0.30)) - 0.1));
            return mix(shadowed, c, smoothstep(px * 2.0, -px * 2.0, d));
        }
        bool gap = matOf(up) == M_EMPTY && waterGap(ci + ivec2(0, 1));
        float deep = (matOf(up) == M_WATER || gap ? 1.0 : 0.0) + (matOf(u2) == M_WATER ? 1.0 : 0.0);
        vec3 c = mix(shadowed * 0.92, w, 0.52 + 0.12 * deep);
        if (matOf(up) == M_EMPTY && !gap) {
            float shimmer = 0.5 + 0.5 * sin(iDate.w * 2.3 + float(ci.x) * 0.9 + v.y * 6.0);
            c = mix(c, vec3(0.92, 0.97, 1.0) * gLight, smoothstep(0.72, 0.90, f.y) * (0.35 + 0.2 * shimmer) * lit);
        }
        return c;
    }

    if (m == M_SNOW && airborne) {
        float d = length(f - 0.5) - 0.3;
        return mix(shadowed, vec3(0.97, 0.98, 1.0) * gLight, smoothstep(px * 2.0, -px * 2.0, d));
    }

    // Light from the upper left: cover along that direction darkens, a face
    // open to it brightens, the top of a pile catches a rim of light.
    vec4 ul = cellAt(ci + ivec2(-1, 1));
    vec4 ur = cellAt(ci + ivec2(1, 1));
    float cover = upOcc + 0.7 * occ(u2) + 0.5 * occ(ul) + 0.25 * occ(ur)
                + 0.6 * occ(cellAt(ci + ivec2(-1, 4))) + 0.5 * occ(cellAt(ci + ivec2(-2, 7)));
    float shade = 1.0 - 0.045 * lit * cover;
    shade += lit * (occ(ul) < 0.5 ? 0.05 : (occ(ur) < 0.5 ? -0.03 : 0.0));
    float rim = upOcc < 0.5 ? 0.10 * lit * smoothstep(0.4, 1.0, f.y) : 0.0;

    vec3 c = grainColour(m, v);
    float rel = relief(f, px, m == M_STONE ? 1.8 : 1.0);
    if (airborne && m != M_STONE) {
        float d = sdBox(f - 0.5, vec2(0.42), 0.18);
        return mix(shadowed, c * gLight * rel, smoothstep(px, -px, d));
    }
    if (m == M_SNOW) c = mix(c, c * vec3(0.80, 0.86, 0.98), 0.15 * lit * cover);
    c *= rel * shade * (1.0 + rim);
    return c * gLight;
}

// ------------------------------------------------------------- palette

float iconBits(int k, ivec2 a)
{
    if (a.x < 0 || a.y < 0 || a.x > 15 || a.y > 15) return 0.0;
    return float((ICON_ART[k * 16 + 15 - a.y] >> uint(2 * a.x)) & 3u);
}

vec3 iconColour(int k, float code)
{
    vec3 base = vec3(0.0);
    vec3 accent = vec3(0.0);
    if (k == T_SAND) { base = SAND_COLOUR; accent = mix(SAND_COLOUR, vec3(1.0), 0.6); }
    else if (k == T_WATER) { base = WATER_COLOUR; accent = vec3(0.82, 0.93, 1.0); }
    else if (k == T_SEED) { base = vec3(0.42, 0.76, 0.34); accent = vec3(0.60, 0.40, 0.22); }
    else if (k == T_STONE) { base = vec3(0.56, 0.58, 0.63); accent = vec3(0.80, 0.82, 0.86); }
    else if (k == T_SNOW) { base = vec3(0.52, 0.70, 0.95); accent = vec3(1.0); }
    else { base = vec3(0.98, 0.62, 0.70); accent = vec3(0.55, 0.70, 0.95); }
    if (code < 1.5) return k == T_SNOW ? base * 0.55 : base * 0.42;
    return code < 2.5 ? base : accent;
}

vec3 drawPalette(vec3 col, vec2 p, vec2 res)
{
    float H = res.y;
    float art = max(1.0, floor(palIconSide(res) * H / 16.0 + 0.5));
    float side = 16.0 * art;
    float pitch = palPitch(res) * H;
    vec2 c0 = palIconCentre(0, res) * H;
    vec2 c1 = palIconCentre(NTOOLS - 1, res) * H;
    vec2 mid = 0.5 * (c0 + c1);
    vec2 ext = vec2(0.5 * (c1.x - c0.x) + 0.5 * pitch + 0.10 * side, 0.5 * pitch + 0.10 * side);
    float r = 0.38 * side;
    float dp = sdBox(p - mid, ext, r);
    if (dp > 0.5 * side) return col;

    // Panel: frosted plate with a soft shadow.
    float sh = sdBox(p - mid - vec2(0.04, -0.09) * side, ext, r);
    col *= 1.0 - 0.16 * exp(-max(sh, 0.0) / (0.10 * side)) * smoothstep(-2.0, 2.0, dp);
    float inside = smoothstep(1.0, -1.0, dp);
    vec3 plate = mix(vec3(0.97, 0.96, 0.93), vec3(1.0), smoothstep(-ext.y, ext.y, p.y - mid.y) * 0.5);
    col = mix(col, mix(col, plate, 0.88), inside);
    col = mix(col, vec3(0.70, 0.66, 0.60), smoothstep(1.2, 0.0, abs(dp + 0.5)) * 0.5);
    if (inside <= 0.0) return col;

    int k = clamp(int(floor((p.x - c0.x) / pitch + 0.5)), 0, NTOOLS - 1);
    vec2 ic = floor(palIconCentre(k, res) * H + 0.5);
    int sel = int(stateAt(1).z + 0.5);
    bool mouseOk = cursorOnScreen() && !insideWindow(iMouse.xy);
    int hover = mouseOk ? palIconAt(iMouse.xy / H, res) : -1;
    bool down = hover == k && iMouse.z > 0.0;

    // Tile under the icon: tinted when selected, lighter when hovered.
    float dt = sdBox(p - ic, vec2(0.5 * pitch - 0.08 * side), 0.26 * side);
    vec3 tint = k == sel ? mix(vec3(1.0), iconColour(k, 2.0), 0.28) : vec3(0.93, 0.92, 0.89);
    if (k == hover) tint = mix(tint, vec3(1.0), 0.55);
    col = mix(col, tint, smoothstep(1.0, -1.0, dt) * (k == sel || k == hover ? 0.95 : 0.55));

    // Icon, lifted one art pixel when hovered, pressed in when held.
    vec2 o = ic - 0.5 * side + (k == hover ? vec2(0.0, art) : vec2(0.0)) + (down ? vec2(0.0, -art) : vec2(0.0));
    ivec2 a = ivec2(floor((p - o) / art));
    float code = iconBits(k, a);
    float shadowCode = iconBits(k, ivec2(floor((p - o - vec2(0.6, -0.8) * art) / art)));
    if (code < 0.5 && shadowCode > 0.5) col *= 1.0 - (k == hover ? 0.20 : 0.12);
    if (code > 0.5) {
        vec3 ink = iconColour(k, code);
        if (k != sel && k != hover) ink = mix(ink, vec3(0.80, 0.78, 0.74), 0.30);
        col = ink;
    }

    // Selection brackets at the tile corners.
    if (k == sel) {
        vec2 b = abs(p - ic);
        float e = 0.5 * pitch - 0.02 * side;
        float th = max(1.0, art * 0.75);
        float edge = max(b.x, b.y);
        bool ring = edge > e - th && edge <= e;
        bool corner = min(b.x, b.y) > e - 0.32 * side;
        if (ring && corner) col = vec3(0.24, 0.20, 0.17);
    }
    return col;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 res = iResolution.xy;
    vec2 bres = iChannelResolution[0].xy;
    bool haveSim = bres.y >= 32.0;

    float overcast = 0.0;
    if (haveSim) {
        vec4 e = stateAt(2);
        vec4 e3 = stateAt(3);
        int kind = int(e.x + 0.5);
        if (kind == E_RAIN || kind == E_SNOW)
            overcast = clamp(e.y / 4.0, 0.0, 1.0) * clamp((e3.x - e.y) / 4.0, 0.0, 1.0);
    }
    vec3 bg = backdrop(fragCoord, res, overcast);

    vec3 top, low;
    skyAt(top, low, gLight);
    if (iChannelResolution[1].x > 0.0) gLight = vec3(1.0);
    gLight *= 1.0 - 0.10 * overcast;

    vec3 col = bg;
    if (haveSim) {
        gRows = gridRows(bres);
        gCols = gridCols(bres);
        col = shadeCells(fragCoord, res, bg);
        col = drawPalette(col, fragCoord, res);
    }
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
