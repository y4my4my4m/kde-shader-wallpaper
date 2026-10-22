// Tamagotchi — layout, state layout and helpers shared by Buffer A and the
// image pass.
//
// Lengths are in H units: pixel position / iResolution.y, in either pass
// (Buffer A runs on a smaller grid of the same aspect). The screen is a
// pastel shell around an LCD; the LCD has an icon strip at the top and at the
// bottom and a dot matrix between them. Dot (0, 0) is the bottom-left dot of
// the matrix; the pet walks on row FLOOR.
//
// Buffer A layout (texel coordinates):
//   (i, j), i < cols, j < rows   dot matrix: x = ink 0..1, y = glow with the
//                                light off
//   (k, height - 1), k < NSTATE  state, all times in seconds:
//     0  pet feet position (dots), velocity (dots/s)
//     1  facing (+1 right), mode (M_*), time in mode, walk target x (dots;
//        mode to return to while stirring)
//     2  fullness, happiness, energy (0..1), time sick (0 = healthy)
//     3  session time (capped once grown up), light off (0/1), darkness
//        (0..1), 1 once initialised
//     4  button held last step, time since the cursor moved, time the cursor
//        has rested on the pet, light set by hand (0/1)
//     5  poop x positions (dots), -1 = none
//     6  time to the next poop, time a poop has lain, stage (ST_*), species
//     7  ball position (dots), velocity (dots/s)
//     8  ball time left, food kind (0 rice ball, 1 cake, 2 bowl), time since
//        an icon fired, icon fired (IC_*)
//     9  time since hearts, bubble kind (BU_*), bubble age, startle cooldown
//     10 flush age (-1 = none), status panel time left, tap age, sparkle age
//     11 tap position (dots), time covered by a window, clock hour of the
//        last meal (-1 = none)
//     12 decision countdown, random counter, needs attention (0/1), standing
//        on a window (0/1)
//     13 look direction (-1..1 each), time since the last kick, kicks this
//        game
//     14 time at zero fullness, time since landing, unused, escaping a
//        window (0/1)

const int NSTATE = 15;

const float FRAME    = 0.045;  // shell margin, units of min(width, height)
const float STRIP    = 0.105;  // icon strip height, same units
const float DOT_SIZE = 0.0147; // dot pitch, same units
const float ICON_SIZE = 0.074; // icon side, same units
const int   FLOOR    = 3;      // row the pet stands on

// @shared tweaks of tamagotchi.frag: BEDTIME, WAKE_UP, BREAKFAST, LUNCH,
// DINNER (local clock hours), CHILD_MINUTES, ADULT_MINUTES, and SPECIES
// (adult species: 0 cat, 1 bunny, 2 chick, 3 frog, 4 bear; -1 picks one from
// the date). Children come in two shapes, species modulo 2.

const float CLOCK_SHIFT = 0.0; // hours added to the clock
const float MEALS[3] = float[3](BREAKFAST, LUNCH, DINNER); // each lasts 1.5 h

// Session seconds at which the pet grows. Adulthood never precedes
// childhood: the session clock caps at ADULT_SECONDS + 60.
const float HATCH_SECONDS = 7.0;
const float CHILD_SECONDS = CHILD_MINUTES * 60.0;
const float ADULT_SECONDS = max(ADULT_MINUTES, CHILD_MINUTES) * 60.0;

const int ST_EGG = 0;
const int ST_BABY = 1;
const int ST_CHILD = 2;
const int ST_ADULT = 3;

const int M_EGG = 0;
const int M_IDLE = 1;
const int M_WALK = 2;
const int M_EAT = 3;
const int M_PLAY = 4;
const int M_SLEEP = 5;
const int M_HAPPY = 6;
const int M_REFUSE = 7;
const int M_STARTLE = 8;
const int M_MEDS = 9;
const int M_EVOLVE = 10;
const int M_POOP = 11;
const int M_YAWN = 12;
const int M_WAKE = 13;
const int M_STIR = 14;
const int M_NAP = 15;

// Icons: 0..3 top strip, 4..7 bottom strip.
const int IC_FOOD = 0;
const int IC_LIGHT = 1;
const int IC_PLAY = 2;
const int IC_MEDS = 3;
const int IC_CLEAN = 4;
const int IC_STATUS = 5;
const int IC_LOVE = 6;
const int IC_ATTN = 7;

const int BU_NONE = 0;
const int BU_EXCL = 1;
const int BU_QUEST = 2;
const int BU_NOTE = 3;
const int BU_FOOD = 4;
const int BU_SKULL = 5;
const int BU_HEART = 6;
const int BU_BULB = 7;
const int BU_POOP = 8;

struct Grid {
    vec2 origin; // bottom-left of dot (0, 0), H units
    float d;     // dot pitch, H units
    int cols;
    int rows;
    vec4 lcd;    // LCD rectangle: min xy, max xy
    float unit;  // min(width, height), H units
};

Grid makeGrid(vec2 res)
{
    Grid g;
    float a = res.x / res.y;
    g.unit = min(a, 1.0);
    float f = FRAME * g.unit;
    float s = STRIP * g.unit;
    g.lcd = vec4(f, f, a - f, 1.0 - f);
    g.d = DOT_SIZE * g.unit;
    vec2 lo = vec2(f + 0.5 * g.d, f + s);
    vec2 hi = vec2(a - f - 0.5 * g.d, 1.0 - f - s);
    g.cols = int(floor((hi.x - lo.x) / g.d));
    g.rows = int(floor((hi.y - lo.y) / g.d));
    g.origin = lo + 0.5 * ((hi - lo) - vec2(float(g.cols), float(g.rows)) * g.d);
    return g;
}

vec2 toDots(Grid g, vec2 h) { return (h - g.origin) / g.d; }

// Icon centre, H units.
vec2 iconCentre(Grid g, int k)
{
    float a = g.lcd.z + g.lcd.x;
    float span = g.lcd.z - g.lcd.x - 0.12 * g.unit;
    float pitch = min(span / 4.0, 0.34 * g.unit);
    float col = float(k - (k / 4) * 4) - 1.5;
    float s = STRIP * g.unit;
    float y = k < 4 ? g.lcd.w - 0.5 * s : g.lcd.y + 0.5 * s;
    return vec2(0.5 * a + col * pitch, y);
}

float iconSide(Grid g) { return ICON_SIZE * g.unit; }

// Icon under point h (H units), or -1.
int iconAt(Grid g, vec2 h)
{
    float r = 0.62 * iconSide(g);
    for (int k = 0; k < 8; k++) {
        vec2 q = abs(h - iconCentre(g, k));
        if (q.x < r && q.y < r) return k;
    }
    return -1;
}

float hash11(float p)
{
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float clockHours() { return mod(iDate.w / 3600.0 + CLOCK_SHIFT, 24.0); }

bool nightAt(float h)
{
    return BEDTIME > WAKE_UP ? (h >= BEDTIME || h < WAKE_UP) : (h >= BEDTIME && h < WAKE_UP);
}

// Hours awake, either order of BEDTIME and WAKE_UP.
float dayHours() { return mod(BEDTIME - WAKE_UP + 24.0, 24.0); }

// Hours since the current mealtime began, or -1 outside mealtimes.
float mealWindow(float h)
{
    for (int i = 0; i < 3; i++) {
        float d = h - MEALS[i];
        if (d >= 0.0 && d < 1.5) return d;
    }
    return -1.0;
}

// True when pixel-space point p lies inside a window.
bool insideWindow(vec2 p)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        if (p.x >= r.x && p.y >= r.y && p.x <= r.x + r.z && p.y <= r.y + r.w) return true;
    }
    return false;
}

bool cursorOnScreen()
{
    return (iMouse.x > 1.0 || iMouse.y > 1.0) && iMouse.x < iResolution.x && iMouse.y < iResolution.y;
}
