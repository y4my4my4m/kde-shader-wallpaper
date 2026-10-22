// Tamagotchi — a virtual pet on the desktop.
// @channels bufferA
// @sim-max-height 128
//
// A virtual pet in a pastel handheld whose LCD spans the desktop. An egg
// hatches on load and the pet grows from baby to child to adult over the
// session, a different species each day; it eats at mealtimes and sleeps at
// night by the local clock, and hops onto window tops to ride dragged
// windows. Click the pet to pet it, the floor to call it, a poop to clean it
// up, the ball to kick it; hover the pet for its needs. Icons: food, light,
// play, medicine on top; clean, status, love and attention (lit when the pet
// needs something, click to ask what) below.
//
// The pet's schedule (bedtime, wake-up and mealtimes in local clock hours),
// its growth times and a fixed species are tweaks shared with Buffer A.
// Species: -1 picks one from the date, 0 cat, 1 bunny, 2 chick, 3 frog,
// 4 bear.
//
// iChannel0  Buffer A: state and the dot matrix (see tamagotchi_common.frag).

const vec3  SHELL_A    = vec3(0.98, 0.80, 0.86); // @color @label("Shell")
const vec3  SHELL_B    = vec3(0.80, 0.80, 0.98); // @color @label("Shell, second colour")
const vec3  LCD_COLOUR = vec3(0.76, 0.81, 0.69); // @color @label("Screen")
const vec3  INK_COLOUR = vec3(0.14, 0.17, 0.15); // @color @label("Pixels")
const vec3  NIGHT_LCD  = vec3(0.08, 0.10, 0.13); // @color @label("Screen with the light off")
const vec3  NIGHT_INK  = vec3(0.60, 0.74, 0.68); // @color @label("Pixels with the light off")
const float GRID       = 1.0;  // @range(0.0, 2.0, 0.05) @label("Pixel grid")
const float SHADOW     = 1.0;  // @range(0.0, 2.0, 0.05) @label("Pixel shadow")
const float PATTERN    = 1.0;  // @range(0.0, 1.0, 0.05) @label("Shell pattern")
const float GLARE      = 1.0;  // @range(0.0, 2.0, 0.05) @label("Screen glare")
const float BEDTIME    = 22.0; // @range(0.0, 24.0, 0.25) @label("Bedtime (hour)") @shared
const float WAKE_UP    = 7.5;  // @range(0.0, 24.0, 0.25) @label("Wake-up (hour)") @shared
const float BREAKFAST  = 8.0;  // @range(0.0, 22.5, 0.25) @label("Breakfast (hour)") @shared
const float LUNCH      = 12.5; // @range(0.0, 22.5, 0.25) @label("Lunch (hour)") @shared
const float DINNER     = 19.0; // @range(0.0, 22.5, 0.25) @label("Dinner (hour)") @shared
const float CHILD_MINUTES = 5.0;  // @range(0.5, 60.0, 0.5) @label("Child after (minutes)") @shared
const float ADULT_MINUTES = 30.0; // @range(1.0, 240.0, 1.0) @label("Adult after (minutes)") @shared
const int   SPECIES    = -1;   // @range(-1, 4, 1) @label("Species (-1 = by date)") @shared

// Icons, 16 x 16, rows top first, bit x = column x: food, light, play,
// medicine, clean, status, love, attention.
const uint ICON[128] = uint[128](
    0x0000u, 0x1054u, 0x1854u, 0x1C54u, 0x1C54u, 0x1C7Cu, 0x1C38u, 0x1C10u,
    0x0810u, 0x0810u, 0x0810u, 0x0810u, 0x0810u, 0x0810u, 0x0000u, 0x0000u,
    0x0000u, 0x03C0u, 0x0C30u, 0x1008u, 0x1008u, 0x2004u, 0x2184u, 0x2244u,
    0x1248u, 0x0990u, 0x0420u, 0x07E0u, 0x0420u, 0x07E0u, 0x03C0u, 0x0000u,
    0x0000u, 0x07E0u, 0x1818u, 0x2004u, 0x4102u, 0x4382u, 0x87F1u, 0x83E1u,
    0x8361u, 0x8631u, 0x4002u, 0x4002u, 0x2004u, 0x1818u, 0x07E0u, 0x0000u,
    0x0000u, 0x3FFCu, 0x4002u, 0x4182u, 0x4182u, 0x47E2u, 0x47E2u, 0x4182u,
    0x4182u, 0x4002u, 0x3FFCu, 0x0000u, 0x0000u, 0x0000u, 0x0000u, 0x0000u,
    0x0000u, 0x01E0u, 0x0210u, 0x04C8u, 0x04CEu, 0x0409u, 0x320Eu, 0x4E10u,
    0x4008u, 0x4064u, 0x2384u, 0x2008u, 0x1FF0u, 0x0000u, 0x0000u, 0x0000u,
    0x0000u, 0x4000u, 0x4C00u, 0x4C00u, 0x4CC0u, 0x4CC0u, 0x4CCCu, 0x4CCCu,
    0x4CCCu, 0x7FFEu, 0x0000u, 0x0000u, 0x0000u, 0x0000u, 0x0000u, 0x0000u,
    0x0000u, 0x1C38u, 0x3E7Cu, 0x7FFEu, 0x7FFEu, 0x7FFEu, 0x3FFCu, 0x1FF8u,
    0x0FF0u, 0x07E0u, 0x03C0u, 0x0180u, 0x0000u, 0x0000u, 0x0000u, 0x0000u,
    0x0000u, 0x3FFCu, 0x4002u, 0x4182u, 0x4182u, 0x4182u, 0x4182u, 0x4002u,
    0x4182u, 0x7E7Cu, 0x0140u, 0x0080u, 0x0000u, 0x0000u, 0x0000u, 0x0000u
);

vec4 st(int k)
{
    return texelFetch(iChannel0, ivec2(k, int(iChannelResolution[0].y) - 1), 0);
}

float sdBox(vec2 p, vec2 b, float r)
{
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Heart of height ~1 centred on the origin (Inigo Quilez, "2D distance
// functions", sdHeart).
float sdHeart(vec2 p)
{
    p.y += 0.55;
    p.x = abs(p.x);
    if (p.y + p.x > 1.0) return sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - 0.35355;
    vec2 a = p - vec2(0.0, 1.0);
    vec2 b = p - 0.5 * max(p.x + p.y, 0.0);
    return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}

vec2 dotAt(ivec2 c, Grid g)
{
    if (c.x < 0 || c.y < 0 || c.x >= g.cols || c.y >= g.rows) return vec2(0.0);
    return texelFetch(iChannel0, c, 0).xy;
}

float iconBit(int k, ivec2 q)
{
    if (q.x < 0 || q.y < 0 || q.x > 15 || q.y > 15) return 0.0;
    return float((ICON[k * 16 + q.y] >> uint(q.x)) & 1u);
}

vec3 shell(vec2 p, float a, Grid g)
{
    float t = clamp(p.x / max(a, 1e-3) * 0.75 + (1.0 - p.y) * 0.25, 0.0, 1.0);
    vec3 col = mix(SHELL_A, SHELL_B, smoothstep(0.05, 0.95, t));
    // Embossed pattern: little hearts and dots on a diagonal lattice.
    float sc = 0.034 * g.unit;
    vec2 q = p / sc;
    q.x += 0.5 * floor(q.y);
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash12(cell);
    float d = h < 0.33 ? sdHeart(f / 0.34) * 0.34 : length(f) - 0.09;
    float px = 1.0 / (iResolution.y * sc);
    float m = smoothstep(px, -px, d);
    float rim = smoothstep(px, -px, d + 0.03) - m;
    col = mix(col, col * 1.07 + 0.025, m * PATTERN * 0.75);
    col -= rim * PATTERN * 0.03;
    // Plastic sheen.
    col *= 0.96 + 0.07 * p.y;
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 res = iResolution.xy;
    float a = res.x / res.y;
    vec2 p = fragCoord / res.y;
    float px = 1.0 / res.y;
    Grid g = makeGrid(res);
    bool haveState = iChannelResolution[0].y >= 2.0;

    vec4 s3 = haveState ? st(3) : vec4(0.0);
    vec4 s8 = haveState ? st(8) : vec4(0.0);
    vec4 s10 = haveState ? st(10) : vec4(-1.0, 0.0, 0.0, 0.0);
    vec4 s12 = haveState ? st(12) : vec4(0.0);
    float dark = s3.z;

    vec3 col = shell(p, a, g);

    // Screen opening: recessed, with a darker lip.
    vec2 lc = 0.5 * (g.lcd.xy + g.lcd.zw);
    vec2 lh = 0.5 * (g.lcd.zw - g.lcd.xy);
    float rad = 0.035 * g.unit;
    float sd = sdBox(p - lc, lh, rad);
    float lip = 0.007 * g.unit;
    float lipMask = smoothstep(px, -px, sd - lip);
    vec3 lipCol = mix(SHELL_A, SHELL_B, 0.5) * 0.78;
    float lipLight = clamp(0.5 - (p.y - lc.y) / lh.y * 0.5, 0.0, 1.0);
    lipCol = mix(lipCol, lipCol * 1.22, lipLight * smoothstep(-lip, 0.0, sd));
    col = mix(col, lipCol, lipMask);
    // Soft shadow of the shell around the opening.
    col *= 1.0 - 0.10 * exp(-max(sd - lip, 0.0) / (0.01 * g.unit)) * (1.0 - lipMask);

    if (sd < px) {
        vec3 lcd = LCD_COLOUR * (0.97 + 0.05 * (p.y - g.lcd.y) / (2.0 * lh.y));
        // Recess shadow along the top and left edges.
        float inner = -sd;
        float sTop = sdBox(p - lc - vec2(0.006, -0.010) * g.unit, lh, rad);
        float recess = smoothstep(0.0, 0.016 * g.unit, -sTop);
        lcd *= mix(0.80, 1.0, recess);
        lcd *= 0.94 + 0.06 * smoothstep(0.0, 0.05 * g.unit, inner);

        vec3 night = NIGHT_LCD * (0.9 + 0.2 * (p.y - g.lcd.y) / (2.0 * lh.y));
        night *= mix(0.6, 1.0, recess);

        vec3 c = lcd;
        vec3 cn = night;

        // Dot matrix.
        vec2 q = (p - g.origin) / g.d;
        ivec2 cell = ivec2(floor(q));
        bool inGrid = q.x >= 0.0 && q.y >= 0.0 && cell.x < g.cols && cell.y < g.rows;
        float aa = px / g.d;
        if (q.x > -1.0 && q.y > -1.0 && q.x < float(g.cols) + 1.0 && q.y < float(g.rows) + 1.0) {
            vec2 ink = dotAt(cell, g);
            vec2 f = fract(q) - 0.5;
            float cov = smoothstep(aa, -aa, sdBox(f, vec2(0.43), 0.13));
            vec2 q2 = q + vec2(-0.2, 0.22);
            vec2 ink2 = dotAt(ivec2(floor(q2)), g);
            float sh = ink2.x * smoothstep(0.14, -0.14, sdBox(fract(q2) - 0.5, vec2(0.43), 0.13));
            vec3 bg = lcd * (1.0 - 0.24 * SHADOW * sh);
            vec3 off = bg * (1.0 - 0.05 * GRID);
            c = inGrid ? mix(bg, mix(off, INK_COLOUR, ink.x * 0.94), cov) : lcd;
            float glow = ink.y;
            vec3 nOff = night * (1.0 + 0.25 * GRID);
            vec3 nOn = mix(nOff, NIGHT_INK, glow);
            cn = inGrid ? mix(night * (1.0 - 0.3 * SHADOW * ink2.y), nOn, cov) : night;
        }

        // Icons.
        float side = iconSide(g);
        vec2 m = iMouse.xy / res.y;
        bool mouseOk = cursorOnScreen() && !insideWindow(iMouse.xy);
        int hover = mouseOk ? iconAt(g, m) : -1;
        int pressK = -1;
        if (iMouse.z > 0.0 && !insideWindow(iMouse.zw)) pressK = iconAt(g, iMouse.zw / res.y);
        float sstrip = STRIP * g.unit;
        if (p.y > g.lcd.w - sstrip || p.y < g.lcd.y + sstrip) {
            int k0 = p.y > lc.y ? 0 : 4;
            vec2 c0 = iconCentre(g, k0);
            vec2 c1 = iconCentre(g, k0 + 1);
            float pitch = c1.x - c0.x;
            int k = k0 + clamp(int(floor((p.x - c0.x) / pitch + 0.5)), 0, 3);
            vec2 ic = iconCentre(g, k);
            bool down = pressK == k && hover == k;
            if (down) ic += vec2(0.0015, -0.0015) * g.unit;
            vec2 u = (p - ic) / side + 0.5;
            float ipx = px / side * 16.0;
            float lit = 0.0;
            float attn = s12.z;
            if (k == hover || down) lit = 1.0;
            if (k == IC_LIGHT && s3.y > 0.5) lit = 1.0;
            if (k == IC_PLAY && s8.x > 0.0) lit = 1.0;
            if (k == IC_STATUS && s10.y > 0.0) lit = 1.0;
            if (k == IC_CLEAN && s10.x >= 0.0) lit = 1.0;
            if (k == IC_ATTN && attn > 0.5) lit = max(lit, fract(iDate.w * 0.9) < 0.6 ? 1.0 : 0.0);
            if (int(s8.w + 0.5) == k && s8.z < 0.45) lit = 1.0;
            vec2 iq = u * 16.0;
            ivec2 ic16 = ivec2(floor(iq));
            float bit = iconBit(k, ivec2(ic16.x, 15 - ic16.y));
            vec2 ff = fract(iq) - 0.5;
            float icov = smoothstep(ipx, -ipx, sdBox(ff, vec2(0.44), 0.16));
            vec2 iq2 = iq + vec2(-0.25, 0.28);
            ivec2 ic2 = ivec2(floor(iq2));
            float bit2 = iconBit(k, ivec2(ic2.x, 15 - ic2.y));
            float ish = bit2 * smoothstep(0.15, -0.15, sdBox(fract(iq2) - 0.5, vec2(0.44), 0.16));
            float level = mix(0.17, 0.94, lit);
            vec3 ibg = c * (1.0 - 0.22 * SHADOW * ish * lit);
            c = mix(ibg, mix(ibg, INK_COLOUR, level), bit * icov);
            vec3 nbg = cn;
            cn = mix(nbg, mix(nbg, NIGHT_INK, mix(0.06, 0.85, lit)), bit * icov);
            // Selection brackets around the hovered icon.
            if (k == hover) {
                vec2 b = abs(p - ic) / side;
                float e = max(b.x, b.y);
                float br = smoothstep(0.66 + ipx / 16.0, 0.66 - ipx / 16.0, e) - smoothstep(0.62 + ipx / 16.0, 0.62 - ipx / 16.0, e);
                float corner = step(0.42, min(b.x, b.y));
                c = mix(c, INK_COLOUR, br * corner * 0.85);
                cn = mix(cn, NIGHT_INK, br * corner * 0.8);
            }
        }

        // Glass glare: a soft diagonal band near the top left.
        float gl = (p.x - g.lcd.x) * 0.45 + (g.lcd.w - p.y);
        float band = smoothstep(0.05, 0.12, gl) * (1.0 - smoothstep(0.16, 0.34, gl));
        c += GLARE * 0.035 * band * vec3(1.0);
        cn += GLARE * 0.015 * band * vec3(1.0);

        vec3 screen = mix(c, cn, dark);
        col = mix(col, screen, smoothstep(px, -px, sd));
    }

    // The shell dims with the light off.
    col = mix(col, col * mix(1.0, 0.42, dark), smoothstep(-px, px, sd));
    fragColor = vec4(col, 1.0);
}
