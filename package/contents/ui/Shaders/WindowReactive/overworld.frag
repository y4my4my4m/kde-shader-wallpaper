// Overworld — a blocky side-view world on the desktop.
// @channels bufferA
// @sim-max-height 64
//
// Grass hills, trees, a sea, caves with ore and lava, and a sky that follows
// the clock: sunrise, square sun and moon, stars and drifting slab clouds.
// Pigs, sheep and chickens wander about, hop up single steps and walk along
// the tops of your windows.
//
// Point at a block to select it; hold the mouse button to mine it. Click an
// animal and it hops around happily. Keep the cursor on the bare desktop near
// a creeper and it comes after it — stay too long and it blows a crater.
//
// World rules and the Buffer A layout are in overworld_common.frag.
// Textures are 16x16 texels per block, like the real thing.

const float DAY_MINUTES   = 0.0;  // @range(0.0, 60.0, 1.0) @label("Day length in minutes (0 = follow the clock)")
const float TIME_OFFSET   = 0.0;  // @range(0.0, 24.0, 0.5) @label("Hours added to the clock")
const float NIGHT_LIGHT   = 0.22; // @range(0.05, 1.0, 0.01) @label("Brightness at night")
const float CLOUDS        = 1.0;  // @range(0.0, 1.0, 1.0) @label("Clouds")

const float TEXELS = 16.0;

// ------------------------------------------------------------- time of day

// 0.25 sunrise, 0.5 noon, 0.75 sunset.
float dayPhase()
{
    if (DAY_MINUTES > 0.0) return fract(iTime / (DAY_MINUTES * 60.0) + 0.35);
    return fract(iDate.w / 86400.0 + TIME_OFFSET / 24.0);
}

// ------------------------------------------------------------- block textures

vec3 oreColour(int b)
{
    if (b == COAL) return vec3(0.10, 0.10, 0.10);
    if (b == IRON) return vec3(0.85, 0.68, 0.55);
    if (b == GOLD) return vec3(0.98, 0.86, 0.25);
    return vec3(0.42, 0.95, 0.92);
}

// Colour of texel tp (0..15) of block b in cell `cell`.
vec3 blockTexel(int b, ivec2 tp, ivec2 cell)
{
    vec2 seed = vec2(tp) + vec2(cell) * 17.0 + float(b) * 31.7;
    float n = hash12(seed);
    float m = hash12(seed + 3.3);

    if (b == GRASS) {
        // Green top, ragged into the dirt side.
        int edge = 12 - int(hash11(float(tp.x) + float(cell.x) * 16.0) * 3.0);
        if (tp.y >= edge) {
            return mix(vec3(0.30, 0.58, 0.17), vec3(0.47, 0.74, 0.26), n) * (tp.y == 15 ? 1.08 : 1.0);
        }
        b = DIRT;
    }
    if (b == DIRT) {
        vec3 c = mix(vec3(0.47, 0.33, 0.22), vec3(0.58, 0.42, 0.29), n);
        if (m < 0.12) c = vec3(0.36, 0.25, 0.16);
        if (m > 0.93) c = vec3(0.66, 0.50, 0.36);
        return c;
    }
    if (b == STONE || b == COAL || b == IRON || b == GOLD || b == DIAMOND) {
        float clump = vnoise2(vec2(tp) * 0.35 + vec2(cell) * 5.1);
        vec3 c = vec3(0.49, 0.49, 0.50) * (0.82 + 0.25 * n) * (0.9 + 0.2 * clump);
        if (b != STONE) {
            float ore = vnoise2(vec2(tp) * 0.55 + vec2(cell) * 3.7 + 11.0);
            if (ore > 0.58 && tp.x > 1 && tp.x < 14 && tp.y > 1 && tp.y < 14) {
                c = oreColour(b) * (0.8 + 0.35 * n);
            }
        }
        return c;
    }
    if (b == SAND) return vec3(0.86, 0.80, 0.58) * (0.9 + 0.14 * n) * (m < 0.08 ? 0.88 : 1.0);
    if (b == LOG) {
        float stripe = hash11(float(tp.x) + float(cell.x) * 7.0);
        vec3 c = mix(vec3(0.34, 0.25, 0.15), vec3(0.47, 0.36, 0.22), stripe) * (0.92 + 0.12 * n);
        if (tp.x % 4 == 0 || (m < 0.06)) c *= 0.75;
        return c;
    }
    if (b == LEAVES) {
        vec3 c = mix(vec3(0.16, 0.42, 0.10), vec3(0.30, 0.62, 0.18), n);
        if (m < 0.14) c = vec3(0.08, 0.22, 0.06);
        return c;
    }
    if (b == BEDROCK) return mix(vec3(0.10), vec3(0.42), step(0.55, n) * (0.6 + 0.4 * m));
    if (b == LAVA) {
        float t = iTime;
        float f = vnoise2(vec2(tp) * 0.4 + vec2(cell) * 4.0 + vec2(t * 0.6, t * 0.35));
        return mix(vec3(0.85, 0.25, 0.02), vec3(1.0, 0.75, 0.15), f) * 1.25;
    }
    if (b == COBBLE) {
        // Rounded stones in staggered 5-texel courses with dark mortar.
        int row = tp.y / 5;
        int x = tp.x + (row % 2 == 1 ? 2 : 0);
        ivec2 stone = ivec2(x / 5, row);
        ivec2 inStone = ivec2(x % 5, tp.y % 5);
        float shade = 0.42 + 0.2 * hash12(vec2(stone) + vec2(cell) * 3.0);
        if (inStone.x == 4 || inStone.y == 4) return vec3(0.22);
        return vec3(shade) * (0.92 + 0.12 * n) * (inStone.y == 3 ? 0.85 : 1.0);
    }
    if (b == OBSIDIAN) {
        vec3 c = mix(vec3(0.06, 0.04, 0.10), vec3(0.11, 0.07, 0.17), n);
        if (m > 0.9) c = vec3(0.30, 0.20, 0.42);
        return c;
    }
    return vec3(0.0);
}

// Base colour of a block, for particles.
vec3 blockColour(int b)
{
    return blockTexel(b, ivec2(6, 7), ivec2(3, 5));
}

// ------------------------------------------------------------- sky

vec3 skyColour(vec2 pb, float phase, float daylight, float elevation)
{
    float y = pb.y / float(ROWS);
    vec3 dayTop = vec3(0.33, 0.53, 0.96);
    vec3 dayLow = vec3(0.62, 0.78, 1.0);
    vec3 nightTop = vec3(0.008, 0.012, 0.045);
    vec3 nightLow = vec3(0.03, 0.045, 0.11);
    vec3 col = mix(mix(nightLow, nightTop, y), mix(dayLow, dayTop, y), daylight);
    // Sunrise and sunset glow on the horizon.
    float dusk = exp(-abs(elevation) * 7.0) * (1.0 - y);
    col = mix(col, vec3(1.0, 0.52, 0.28), dusk * 0.65);

    // Stars, one candidate per sixth of a block.
    float starsVis = 1.0 - smoothstep(0.0, 0.35, daylight);
    if (starsVis > 0.0) {
        vec2 sc = floor(pb * 6.0);
        float h = hash12(sc + 7.0);
        if (h < 0.006) {
            float tw = 0.6 + 0.4 * sin(iTime * (1.0 + 400.0 * h) + h * 3000.0);
            col += vec3(0.9, 0.92, 1.0) * starsVis * tw;
        }
    }
    return col;
}

// Square sun and moon. Returns colour in rgb, coverage in a.
vec4 sunMoon(vec2 pb, float phase, float cols)
{
    vec4 res = vec4(0.0);
    for (int k = 0; k < 2; k++) {
        float ph = fract(phase + (k == 0 ? 0.0 : 0.5));
        // Crosses the screen between rise (0.25) and set (0.75).
        float s = (ph - 0.25) / 0.5;
        if (s < -0.1 || s > 1.1) continue;
        vec2 c = vec2(mix(-1.0, cols + 1.0, s), 12.0 + sin(s * 3.14159) * 9.5);
        vec2 d = abs(pb - c);
        float size = k == 0 ? 1.4 : 1.1;
        float glow = exp(-max(max(d.x, d.y) - size, 0.0) * 1.2) * (k == 0 ? 0.45 : 0.15);
        res.rgb += (k == 0 ? vec3(1.0, 0.85, 0.55) : vec3(0.75, 0.8, 0.95)) * glow;
        if (max(d.x, d.y) < size) {
            vec3 body;
            if (k == 0) {
                body = vec3(1.0, 0.97, 0.75);
            } else {
                // Moon: grey square with a few craters.
                ivec2 tp = ivec2(floor((pb - c + size) / (2.0 * size) * 8.0));
                body = vec3(0.86, 0.88, 0.92) * (hash12(vec2(tp) + 4.0) < 0.2 ? 0.75 : 1.0);
            }
            res = vec4(body, 1.0);
        }
    }
    return res;
}

// Flat slab clouds drifting across. Returns colour in rgb, coverage in a.
vec4 clouds(vec2 pb, float daylight)
{
    if (CLOUDS < 0.5 || pb.y < 19.0 || pb.y > 21.5) return vec4(0.0);
    vec2 q = vec2(pb.x + iTime * 0.25, pb.y);
    vec2 cell = floor(q * vec2(1.0, 2.0));
    float n = vnoise2(cell * vec2(0.17, 0.6) + 2.0) * 0.7 + vnoise2(cell * vec2(0.41, 1.0)) * 0.3;
    float band = 1.0 - abs(pb.y - 20.25) / 1.25;
    if (n * band < 0.32) return vec4(0.0);
    float shade = fract(q.y * 2.0) < 0.5 && pb.y < 20.0 ? 0.85 : 1.0;
    vec3 c = mix(vec3(0.35, 0.37, 0.45), vec3(1.0), daylight) * shade;
    return vec4(c, 0.88);
}

// ------------------------------------------------------------- decorations

// Flowers, grass tufts and torches on a grass block's top, in the air cell
// above it. Returns colour, coverage; `torch` is set for torch columns.
vec4 decoration(int c, ivec2 tp, out bool torch)
{
    torch = false;
    float h = hash11(float(c) * 5.31 + 0.7);
    if (isTreeColumn(c)) return vec4(0.0);
    if (h < 0.06) {
        torch = true;
        if (tp.x >= 7 && tp.x <= 8 && tp.y < 9) return vec4(vec3(0.45, 0.32, 0.18), 1.0);
        if (tp.x >= 7 && tp.x <= 8 && tp.y >= 9 && tp.y <= 11) {
            float f = 0.8 + 0.2 * sin(iTime * 13.0 + float(c));
            return vec4(mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.95, 0.5), float(tp.y - 9) / 2.0) * f * 1.3, 1.0);
        }
        return vec4(0.0);
    }
    if (h < 0.22) {
        // Flower: stem and a 3x3 head, red or yellow.
        bool red = hash11(float(c) * 9.1) < 0.5;
        if (tp.x == 7 && tp.y < 6) return vec4(0.2, 0.5, 0.12, 1.0);
        if (tp.x >= 6 && tp.x <= 8 && tp.y >= 6 && tp.y <= 8) {
            if (tp.x == 7 && tp.y == 7) return vec4(red ? vec3(0.15, 0.1, 0.05) : vec3(1.0, 0.95, 0.4), 1.0);
            return vec4(red ? vec3(0.85, 0.12, 0.1) : vec3(0.98, 0.84, 0.15), 1.0);
        }
        return vec4(0.0);
    }
    if (h < 0.5) {
        // Tall grass: a few blades of hashed height.
        float bh = hash11(float(tp.x) + float(c) * 16.0) * 7.0;
        if (tp.x % 3 != 1 && float(tp.y) < bh) return vec4(mix(vec3(0.25, 0.52, 0.15), vec3(0.4, 0.68, 0.22), float(tp.y) / 7.0), 1.0);
    }
    return vec4(0.0);
}

// ------------------------------------------------------------- mobs

vec3 pick(float n, vec3 a, vec3 b, vec3 c)
{
    return n < 0.33 ? a : (n < 0.66 ? b : c);
}

// Sprite texel colour and coverage. p: texel coordinates, x centred on the
// mob and facing +x, y = 0 at the feet. legs: walking phase.
vec4 creeperSprite(ivec2 p, float legs, float seed)
{
    int x = p.x + 4;
    int y = p.y;
    if (x < 0 || x > 7 || y < 0 || y > 25) return vec4(0.0);
    float n = hash12(vec2(p) + seed);
    vec3 c = pick(n, vec3(0.13, 0.55, 0.13), vec3(0.30, 0.70, 0.25), vec3(0.45, 0.82, 0.38));
    if (hash12(vec2(p) + seed + 9.0) < 0.12) c = vec3(0.70, 0.86, 0.62);
    if (y < 6) {
        // Two pairs of stubby feet, shuffling when walking.
        int shift = legs > 0.0 ? 1 : 0;
        bool leg = (x <= 2 && x >= 0 + shift) || (x >= 5 && x <= 7 - (1 - shift));
        if (!leg) return vec4(0.0);
        return vec4(c * 0.85, 1.0);
    }
    if (y < 18) {
        if (x < 1 || x > 6) return vec4(0.0);
        return vec4(c, 1.0);
    }
    // Face: rows counted from the top of the head.
    int fy = 25 - y;
    bool eye = (fy == 2 || fy == 3) && (x == 1 || x == 2 || x == 5 || x == 6);
    bool mouthTop = (fy == 4 || fy == 5) && (x == 3 || x == 4);
    bool mouthWide = fy == 6 && x >= 2 && x <= 5;
    bool mouthFeet = fy == 7 && (x == 2 || x == 5);
    if (eye || mouthTop || mouthWide || mouthFeet) return vec4(vec3(0.03, 0.05, 0.03), 1.0);
    return vec4(c, 1.0);
}

vec4 pigSprite(ivec2 p, float legs, float seed)
{
    int x = p.x;
    int y = p.y;
    float n = hash12(vec2(p) + seed);
    vec3 pink = mix(vec3(0.93, 0.60, 0.60), vec3(0.98, 0.70, 0.70), n);
    // Legs: four 2-texel posts, alternate pairs lifted when walking.
    if (y < 4) {
        int lift = legs > 0.0 ? 1 : 0;
        bool front = (x >= 3 && x <= 4) || (x >= -6 && x <= -5);
        bool back = (x >= 0 && x <= 1) || (x >= -3 && x <= -2);
        if ((front && y >= lift) || (back && y >= 1 - lift)) return vec4(pink * 0.82, 1.0);
        return vec4(0.0);
    }
    if (x >= -7 && x <= 5 && y >= 4 && y <= 10) return vec4(pink, 1.0);
    if (x >= 6 && x <= 11 && y >= 5 && y <= 11) {
        if (x == 9 && y == 9) return vec4(0.05, 0.05, 0.05, 1.0);
        if (x == 8 && y == 9) return vec4(0.97, 0.97, 0.97, 1.0);
        return vec4(pink, 1.0);
    }
    if (x >= 12 && x <= 13 && y >= 6 && y <= 8) {
        if (y == 7) return vec4(0.6, 0.3, 0.3, 1.0);
        return vec4(0.98, 0.76, 0.76, 1.0);
    }
    return vec4(0.0);
}

vec4 sheepSprite(ivec2 p, float legs, float seed)
{
    int x = p.x;
    int y = p.y;
    float n = hash12(vec2(p) + seed);
    if (y < 5) {
        int lift = legs > 0.0 ? 1 : 0;
        bool front = (x >= 3 && x <= 4) || (x >= -6 && x <= -5);
        bool back = (x >= 0 && x <= 1) || (x >= -3 && x <= -2);
        if ((front && y >= lift) || (back && y >= 1 - lift)) return vec4(vec3(0.82, 0.78, 0.72), 1.0);
        return vec4(0.0);
    }
    if (x >= -8 && x <= 6 && y >= 5 && y <= 13) {
        // Wool: lumpy outline, soft speckle.
        if ((x == -8 || x == 6) && (y == 5 || y == 13)) return vec4(0.0);
        return vec4(mix(vec3(0.86, 0.86, 0.84), vec3(0.98, 0.98, 0.97), n), 1.0);
    }
    if (x >= 7 && x <= 11 && y >= 8 && y <= 13) {
        if (x == 10 && y == 11) return vec4(0.05, 0.05, 0.05, 1.0);
        return vec4(mix(vec3(0.70, 0.60, 0.52), vec3(0.78, 0.68, 0.60), n), 1.0);
    }
    return vec4(0.0);
}

vec4 chickenSprite(ivec2 p, float legs, float seed)
{
    int x = p.x;
    int y = p.y;
    float n = hash12(vec2(p) + seed);
    vec3 white = mix(vec3(0.9, 0.9, 0.88), vec3(1.0), n);
    if (y < 3) {
        int lift = legs > 0.0 ? 1 : 0;
        if ((x == -1 && y >= lift) || (x == 1 && y >= 1 - lift)) return vec4(0.95, 0.75, 0.2, 1.0);
        return vec4(0.0);
    }
    if (x >= -4 && x <= 2 && y >= 3 && y <= 7) {
        if (x == -4 && y == 7) return vec4(0.0);
        return vec4(white * (x <= -2 && y <= 5 ? 0.9 : 1.0), 1.0);
    }
    if (x >= 1 && x <= 4 && y >= 7 && y <= 11) {
        if (x == 3 && y == 10) return vec4(0.05, 0.05, 0.05, 1.0);
        return vec4(white, 1.0);
    }
    if (x >= 5 && x <= 6 && y == 9) return vec4(0.98, 0.65, 0.15, 1.0);
    if (x == 5 && y >= 7 && y <= 8) return vec4(0.85, 0.12, 0.1, 1.0);
    return vec4(0.0);
}

// Pixel heart, 7x6 texels; p relative to its bottom-left.
bool heart(ivec2 p)
{
    if (p.x < 0 || p.x > 6 || p.y < 0 || p.y > 5) return false;
    int rowsMask[6] = int[6](8, 28, 62, 127, 127, 54);
    return ((rowsMask[p.y] >> p.x) & 1) != 0;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float bs = blockSize();
    vec2 pb = fragCoord / bs;                 // block units
    ivec2 cell = ivec2(floor(pb));
    ivec2 tp = ivec2(floor(fract(pb) * TEXELS));
    vec2 texelPos = floor(pb * TEXELS);       // texel grid, for crisp sprites
    float cols = float(columns());

    float phase = dayPhase();
    float elevation = sin((phase - 0.25) * 6.28318);
    float daylight = smoothstep(-0.12, 0.22, elevation);
    float ambient = mix(NIGHT_LIGHT, 1.0, daylight);

    // Sky, sun and moon, clouds.
    vec3 col = skyColour(pb, phase, daylight, elevation);
    vec4 sm = sunMoon(pb, phase, cols);
    col = mix(col + sm.rgb * (1.0 - sm.a), sm.rgb, sm.a);
    vec4 cl = clouds(pb, daylight);
    col = mix(col, cl.rgb, cl.a);

    int surf = surfaceHeight(cell.x);
    int b = blockAt(cell.x, cell.y);

    // Flowing fluid fills its cell to level/8; sources and columns with the
    // same fluid above fill it completely.
    ivec2 fluid = fluidAt(cell.x, cell.y);
    float fill = 1.0;
    bool fluidTop = false;
    if (fluid.x > 0) {
        ivec2 above = fluidAt(cell.x, cell.y + 1);
        bool full = fluid.x >= 8 || (above.x > 0 && above.y == fluid.y);
        fill = full ? 1.0 : (float(fluid.x) + 1.0) / 9.0;
        fluidTop = !(above.x > 0 && above.y == fluid.y);
    }
    if ((b == WATER || b == LAVA) && fract(pb.y) > fill) b = AIR;

    // Torch light at night: warm pools around nearby torches.
    vec3 torchLight = vec3(0.0);
    if (daylight < 0.95) {
        for (int d = -5; d <= 5; d++) {
            int tc = cell.x + d;
            if (hash11(float(tc) * 5.31 + 0.7) >= 0.06 || isTreeColumn(tc)) continue;
            int ts = surfaceHeight(tc);
            if (ts <= SEA || blockAt(tc, ts + 1) != AIR || blockAt(tc, ts) != GRASS) continue;
            vec2 tpos = vec2(float(tc) + 0.5, float(ts) + 1.65);
            float dist = length(pb - tpos);
            float k = max(1.0 - dist / 5.5, 0.0);
            torchLight += vec3(1.0, 0.68, 0.35) * k * k * (1.0 - daylight) * 1.1;
        }
    }

    // Light reaching a block: sky light fading with depth below the
    // surface, plus torches.
    float depth = float(max(surf - cell.y, 0));
    vec3 light = vec3(ambient * clamp(1.0 - depth * 0.085, 0.28, 1.0)) + torchLight;

    if (b != AIR && b != WATER) {
        vec3 tex = blockTexel(b, tp, cell);
        col = b == LAVA ? tex : tex * light;
    } else if (cell.y < surf && cell.y >= 0) {
        // Underground air (caves, mined holes): the dark wall behind.
        int back = cell.y >= surf - 3 ? DIRT : STONE;
        col = blockTexel(back, tp, cell) * 0.36 * light;
    } else if (cell.y == surf + 1 && blockAt(cell.x, surf) == GRASS && b == AIR) {
        bool torch;
        vec4 deco = decoration(cell.x, tp, torch);
        if (deco.a > 0.0) col = torch && deco.r > 0.9 ? deco.rgb : deco.rgb * light;
    }

    if (b == LAVA && fluidTop && fract(pb.y) > fill - 2.0 / 16.0) col *= 1.15;

    // Water: translucent, darker with depth, rippling surface.
    if (b == WATER) {
        bool surface = fluidTop;
        vec3 water = vec3(0.16, 0.32, 0.78) * (0.85 + 0.15 * vnoise2(texelPos * 0.2 + vec2(iTime * 1.5, 0.0)));
        float waterDepth = float(SEA - cell.y);
        // What lies behind the water: the sea floor wall.
        int back = cell.y >= surf - 3 ? DIRT : STONE;
        vec3 behind = cell.y <= surf ? blockTexel(back, tp, cell) * 0.5 : col;
        vec3 lit = max(light, vec3(ambient * 0.55));
        col = mix(behind, water * lit * (1.05 - waterDepth * 0.05), 0.8);
        float topTexel = fill * 16.0;
        if (surface && float(tp.y) >= topTexel - 3.0) {
            float wave = sin(float(tp.x) * 0.8 + float(cell.x) * 2.0 + iTime * 2.0);
            if (float(tp.y) > topTexel - 3.0 + wave) col = mix(col, vec3(0.55, 0.7, 1.0) * light, 0.5);
        }
    }

    // Mining: crack overlay and the selection outline.
    ivec2 cur = cursorCell();
    if (cur.x >= 0 && cell == cur && isSolid(b) && b != BEDROCK) {
        float progress = texelFetch(iChannel0, cur, 0).y;
        if (progress > 0.0) {
            float ridge = 1.0 - abs(vnoise2(vec2(tp) * 0.45 + 3.0) * 2.0 - 1.0);
            float spoke = 1.0 - abs(fract(atan(float(tp.y) - 7.5, float(tp.x) - 7.5) * 1.27) - 0.5) * 2.0;
            float crack = max(ridge, spoke * 0.9);
            if (crack > 1.0 - progress * 0.45) col *= 0.35;
        }
        if (tp.x == 0 || tp.y == 0 || tp.x == 15 || tp.y == 15) col = mix(col, vec3(0.0), 0.8);
    }

    // Mobs.
    for (int i = 0; i < NMOB; i++) {
        vec4 ma = texelFetch(iChannel0, ivec2(i, MOB_ROW), 0);
        vec4 mb = texelFetch(iChannel0, ivec2(i, MOB_ROW + 1), 0);
        if (mb.x < 0.5 || mb.w > 0.0) continue;
        int kind = mobKindOf(i, mb);
        vec2 sz = mobSize(kind);
        vec2 rel = pb - ma.xy;
        if (abs(rel.x) > sz.x * 0.7 + 0.6 || rel.y < -0.2 || rel.y > sz.y + 1.6) continue;

        float facing = mb.y < 0.0 ? -1.0 : 1.0;
        bool moving = abs(ma.z) > 0.1;
        float legs = moving ? sin(iTime * 11.0 + float(i) * 1.7) : 0.0;
        float seed = float(i) * 37.0;

        // Creeper fuse: swell and flash white, faster towards the end.
        float fuse = kind == CREEPER ? clamp(mb.z / FUSE_TIME, 0.0, 1.0) : 0.0;
        float swell = 1.0 + 0.12 * fuse * fuse;

        vec2 lp = rel * TEXELS / swell;
        lp.x *= facing;
        ivec2 p = ivec2(floor(lp + vec2(0.0, 0.0)));
        vec4 s;
        if (kind == CREEPER) s = creeperSprite(p, legs, seed);
        else if (kind == PIG) s = pigSprite(p, legs, seed);
        else if (kind == SHEEP) s = sheepSprite(p, legs, seed);
        else s = chickenSprite(p, legs, seed);
        if (s.a > 0.0) {
            vec3 c = s.rgb * light;
            if (fuse > 0.0) {
                float blink = step(0.5, fract(iTime * (2.0 + fuse * 8.0)));
                c = mix(c, vec3(1.0), blink * (0.25 + 0.6 * fuse));
            }
            col = c;
        }
        // Soft shadow on the ground under the mob.
        if (rel.y > -0.12 && rel.y < 0.04 && abs(rel.x) < sz.x * 0.55 && s.a == 0.0) col *= 0.75;

        // Hearts above a happy animal.
        if (kind != CREEPER && mb.z > 0.0) {
            for (int k = 0; k < 3; k++) {
                float life = fract((3.0 - mb.z) * 0.7 + float(k) * 0.33);
                vec2 hp = vec2((float(k) - 1.0) * 0.45, sz.y + 0.2 + life * 1.2);
                ivec2 q = ivec2(floor((rel - hp) * TEXELS * 0.75)) + ivec2(3, 0);
                if (heart(q)) col = mix(col, vec3(0.95, 0.2, 0.3), 1.0 - life * 0.7);
            }
        }
    }

    // Block-break particles: little cubes of the broken block.
    vec4 brk = texelFetch(iChannel0, ivec2(1, EVENT_ROW), 0);
    if (brk.w > 0.5 && brk.z < 0.7) {
        vec3 pc = blockColour(int(brk.w + 0.5) - 1);
        for (int k = 0; k < 10; k++) {
            float fk = float(k);
            vec2 v = vec2(hash11(fk * 3.1 + brk.x) - 0.5, hash11(fk * 7.7 + brk.y)) * vec2(6.0, 5.0) + vec2(0.0, 2.0);
            vec2 pp = brk.xy + 0.5 + v * brk.z + vec2(0.0, -12.0) * brk.z * brk.z;
            vec2 d = abs(floor(pb * TEXELS) - floor(pp * TEXELS));
            if (max(d.x, d.y) <= 1.0) col = pc * light * (0.8 + 0.4 * hash11(fk));
        }
    }

    // Explosion: flash and pixel smoke.
    vec4 ex = texelFetch(iChannel0, ivec2(0, EVENT_ROW), 0);
    if (ex.w > 0.5 && ex.z < 1.8) {
        float age = ex.z;
        col += vec3(1.0, 0.95, 0.85) * exp(-age * 18.0) * exp(-length(pb - ex.xy) * 0.4) * 1.5;
        for (int k = 0; k < 14; k++) {
            float fk = float(k);
            float ang = hash11(fk * 4.3 + ex.x) * 6.28318;
            float rad = (0.6 + 2.0 * hash11(fk * 9.1 + ex.y)) * (1.0 - exp(-age * 4.0));
            vec2 c = ex.xy + vec2(cos(ang), sin(ang)) * rad + vec2(0.0, age * 0.8);
            float size = (0.35 + 0.5 * hash11(fk + 2.0)) * (0.6 + age * 0.6);
            vec2 d = abs(floor(pb * 8.0) - floor(c * 8.0)) / 8.0;
            if (max(d.x, d.y) < size) {
                float a = (1.0 - age / 1.8) * 0.85;
                col = mix(col, mix(vec3(0.95), vec3(0.45), hash11(fk * 1.3)) * mix(0.5, 1.0, daylight), a);
            }
        }
    }

    // A mob that walked into lava: a puff of dark smoke.
    vec4 burn = texelFetch(iChannel0, ivec2(4, EVENT_ROW), 0);
    if (burn.w > 0.5 && burn.z < 1.2) {
        for (int k = 0; k < 6; k++) {
            float fk = float(k);
            vec2 c = burn.xy + vec2((hash11(fk * 3.7 + burn.x) - 0.5) * 0.9, burn.z * (1.2 + hash11(fk * 1.9)));
            float size = 0.18 + 0.2 * burn.z;
            vec2 d = abs(floor(pb * 8.0) - floor(c * 8.0)) / 8.0;
            if (max(d.x, d.y) < size) col = mix(col, vec3(0.25), (1.0 - burn.z / 1.2) * 0.8);
        }
    }

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
