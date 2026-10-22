// Tamagotchi — Buffer A: the pet's life and the LCD dot matrix.
// @channels self
// @sim-max-height 128
//
// Layout and state are described in tamagotchi_common.frag. Every state
// texel runs the same update from the previous step, so all of them agree.
// The dot matrix is drawn on the last substep of a frame from the state the
// step started with, and copied on the other substeps.

const float GRAVITY = 150.0;     // dots / s^2
const float RUN_SPEED = 13.0;    // dots / s
const float FLUSH_TIME = 2.6;    // s for the flush wave to cross the matrix
const float EAT_TIME = 3.4;
const float BALL_GRAVITY = 95.0;
const float POOP_AFTER_MEAL = 140.0; // s, plus up to as much again
const float SICK_AFTER = 900.0;      // s a poop may lie before the pet falls ill

// Need drift, fraction per second.
const float FOOD_DRAIN = 1.0 / (4.5 * 3600.0);
const float JOY_DRAIN = 1.0 / (3.0 * 3600.0);
const float NRG_DRAIN = 1.0 / (14.0 * 3600.0);
const float NRG_SLEEP = 1.0 / (7.0 * 3600.0);
const float NRG_NAP = 1.0 / (25.0 * 60.0);

const int SP_BABY_A = 0;
const int SP_BABY_B = 1;
const int SP_CHILD0_A = 2;
const int SP_CHILD0_B = 3;
const int SP_CHILD1_A = 4;
const int SP_CHILD1_B = 5;
const int SP_CAT_A = 6;
const int SP_CAT_B = 7;
const int SP_BUNNY_A = 8;
const int SP_BUNNY_B = 9;
const int SP_CHICK_A = 10;
const int SP_CHICK_B = 11;
const int SP_FROG_A = 12;
const int SP_FROG_B = 13;
const int SP_BEAR_A = 14;
const int SP_BEAR_B = 15;
const int SP_EGG = 16;
const int SP_POOPA = 17;
const int SP_POOPB = 18;
const int SP_STINK = 19;
const int SP_ONIGIRI = 20;
const int SP_CAKE = 21;
const int SP_BOWL = 22;
const int SP_PILL = 23;
const int SP_BALL = 24;
const int SP_HEART = 25;
const int SP_HS = 26;
const int SP_HO = 27;
const int SP_ZBIG = 28;
const int SP_ZSMALL = 29;
const int SP_EXCL = 30;
const int SP_QUEST = 31;
const int SP_NOTE = 32;
const int SP_SKULL = 33;
const int SP_BULB = 34;
const int SP_FOOD5 = 35;
const int SP_JOY5 = 36;
const int SP_NRG5 = 37;
const int SP_CLN5 = 38;
const int SP_SPARKLE = 39;
const int SP_SUN = 40;
const int SP_MOON = 41;
const int SP_CLOUD = 42;
const int SP_TUFT = 43;

const int SPR_COUNT = 44;
// Sprite table: offset into SPR, width, height. Rows top first; bit x of
// the low half is ink at column x, the high half is the occluding fill.
const ivec3 SPR_META[44] = ivec3[44](
    ivec3(0, 10, 10),
    ivec3(10, 10, 10),
    ivec3(20, 14, 15),
    ivec3(35, 14, 15),
    ivec3(50, 14, 14),
    ivec3(64, 14, 14),
    ivec3(78, 16, 14),
    ivec3(92, 16, 14),
    ivec3(106, 16, 15),
    ivec3(121, 16, 15),
    ivec3(136, 16, 15),
    ivec3(151, 16, 15),
    ivec3(166, 16, 13),
    ivec3(179, 16, 13),
    ivec3(192, 16, 14),
    ivec3(206, 16, 14),
    ivec3(220, 12, 14),
    ivec3(234, 8, 7),
    ivec3(241, 8, 7),
    ivec3(248, 5, 3),
    ivec3(251, 9, 7),
    ivec3(258, 9, 7),
    ivec3(265, 9, 7),
    ivec3(272, 6, 6),
    ivec3(278, 5, 5),
    ivec3(283, 7, 6),
    ivec3(289, 5, 5),
    ivec3(294, 5, 5),
    ivec3(299, 5, 5),
    ivec3(304, 4, 4),
    ivec3(308, 1, 5),
    ivec3(313, 3, 5),
    ivec3(318, 4, 5),
    ivec3(323, 5, 5),
    ivec3(328, 5, 5),
    ivec3(333, 5, 5),
    ivec3(338, 5, 5),
    ivec3(343, 5, 5),
    ivec3(348, 5, 5),
    ivec3(353, 5, 5),
    ivec3(358, 9, 9),
    ivec3(367, 7, 7),
    ivec3(374, 14, 6),
    ivec3(380, 5, 2)
);
const uint SPR[382] = uint[382](
    0x00780078u, 0x01FE0186u, 0x03FF0201u, 0x03FF0201u, 0x03FF0201u, 0x03FF0201u, 0x03FF0201u, 0x03FF0201u,
    0x01FE0102u, 0x00FC00FCu, 0x00000000u, 0x00780078u, 0x01FE0186u, 0x03FF0201u, 0x03FF0201u, 0x03FF0201u,
    0x03FF0201u, 0x03FF0201u, 0x01FE0102u, 0x00FC00FCu, 0x00C000C0u, 0x01E00120u, 0x00C000C0u, 0x00800080u,
    0x03F003F0u, 0x0FFC0C0Cu, 0x1FFE1002u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x1FFE1002u,
    0x0FFC0FFCu, 0x0F3C0924u, 0x0F3C0F3Cu, 0x00000000u, 0x00C000C0u, 0x01E00120u, 0x00C000C0u, 0x00800080u,
    0x03F003F0u, 0x0FFC0C0Cu, 0x1FFE1002u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x1FFE1002u,
    0x0FFC0FFCu, 0x0E1C0E1Cu, 0x00C000C0u, 0x01E00120u, 0x03F00210u, 0x07F80408u, 0x0FFC0804u, 0x1FFE1002u,
    0x1FFE1002u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x1FFE1002u, 0x0FFC0FFCu, 0x0E1C0A14u, 0x0E1C0E1Cu,
    0x00000000u, 0x00C000C0u, 0x01E00120u, 0x03F00210u, 0x07F80408u, 0x0FFC0804u, 0x1FFE1002u, 0x3FFF2001u,
    0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x1FFE1002u, 0x0FFC0FFCu, 0x0E1C0E1Cu, 0x10021002u, 0x18061806u,
    0x1C0E140Au, 0x1FFE13F2u, 0x3FFF2001u, 0xBFFFA001u, 0xBFFFA001u, 0xBFFFA001u, 0x7FFF6001u, 0x3FFF2001u,
    0x1FFE1002u, 0x0FFC0FFCu, 0x0F3C0924u, 0x0F3C0F3Cu, 0x00000000u, 0x10021002u, 0x18061806u, 0x1C0E140Au,
    0x3FFF27F9u, 0x3FFF2001u, 0xBFFFA001u, 0xBFFFA001u, 0x7FFF6001u, 0x3FFF2001u, 0x1FFE1002u, 0x0FFC0FFCu,
    0x0F3C0B34u, 0x0F3C0F3Cu, 0x0C0C0C0Cu, 0x1E1E1212u, 0x1E1E1212u, 0x1E1E1212u, 0x1E1E1212u, 0x0FFC09E4u,
    0x1FFE1002u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x1FFE1002u, 0x0FFC0FFCu,
    0x0C0C0C0Cu, 0x00000000u, 0x0C0C0C0Cu, 0x1E1E1212u, 0x1E1E1212u, 0x0E1C0A14u, 0x0FFC09E4u, 0x1FFE1002u,
    0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x1FFE1002u, 0x0FFC0FFCu, 0x1C0E1C0Eu,
    0x01400140u, 0x00800080u, 0x03F003F0u, 0x0FFC0C0Cu, 0x1FFE1002u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u,
    0x7FFF6001u, 0x7FFF4001u, 0x3FFF2001u, 0x1FFE1002u, 0x0FFC0FFCu, 0x04080408u, 0x0C0C0C0Cu, 0x00000000u,
    0x01400140u, 0x00800080u, 0x03F003F0u, 0x0FFC0C0Cu, 0x1FFE1002u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u,
    0x7FFF6001u, 0x7FFF4001u, 0x3FFF2001u, 0x1FFE1002u, 0x0FFC0FFCu, 0x0E1C0E1Cu, 0x3C3C3C3Cu, 0x7E7E4242u,
    0xFFFF8181u, 0xFFFF8001u, 0xFFFF8001u, 0x7FFE4002u, 0xFFFF8001u, 0xFFFF8001u, 0xFFFF8001u, 0x7FFE4002u,
    0x3FFC3FFCu, 0x64266426u, 0xC423C423u, 0x00000000u, 0x3C3C3C3Cu, 0x7E7E4242u, 0xFFFF8181u, 0xFFFF8001u,
    0xFFFF8001u, 0xFFFF8001u, 0xFFFF8001u, 0xFFFF8001u, 0x7FFE4002u, 0x3FFC3FFCu, 0x7C366C36u, 0xF003F003u,
    0x1C0E1C0Eu, 0x3E1F2A15u, 0x3FFF23F1u, 0x1FFE1002u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u,
    0x3FFF2001u, 0x3FFF2001u, 0x1FFE1002u, 0x0FFC0FFCu, 0x0F3C0924u, 0x0F3C0F3Cu, 0x00000000u, 0x1C0E1C0Eu,
    0x3E1F2A15u, 0x3FFF23F1u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u, 0x3FFF2001u,
    0x1FFE1002u, 0x0FFC0FFCu, 0x0F3C0B34u, 0x0F3C0F3Cu, 0x00F000F0u, 0x03FC030Cu, 0x07FE0402u, 0x07FE0432u,
    0x0FFF0B31u, 0x0FFF0B01u, 0x0FFF0801u, 0x0FFF0801u, 0x0FFF080Du, 0x0FFF098Du, 0x07FE0582u, 0x07FE0402u,
    0x03FC030Cu, 0x00F000F0u, 0x00180018u, 0x00100010u, 0x003C003Cu, 0x007E0042u, 0x007E007Eu, 0x00FF0081u,
    0x007E007Eu, 0x00300030u, 0x00100010u, 0x003C003Cu, 0x007E0042u, 0x007E007Eu, 0x00FF0081u, 0x007E007Eu,
    0x00110011u, 0x00020002u, 0x00110011u, 0x00380038u, 0x007C0044u, 0x00FE0082u, 0x00FE0082u, 0x01FF0139u,
    0x01FF017Du, 0x00FE00FEu, 0x00100010u, 0x00380038u, 0x00FE00FEu, 0x01FF0101u, 0x01FF01FFu, 0x01FF0155u,
    0x01FF01FFu, 0x00920092u, 0x00490049u, 0x00FE00FEu, 0x01FF0101u, 0x01FF01FFu, 0x00FE0082u, 0x007C007Cu,
    0x000C000Cu, 0x001E0012u, 0x001E0012u, 0x001E001Eu, 0x001E001Eu, 0x000C000Cu, 0x000E000Eu, 0x001F0015u,
    0x001F0015u, 0x001F0015u, 0x000E000Eu, 0x00360036u, 0x007F007Fu, 0x007F007Fu, 0x003E003Eu, 0x001C001Cu,
    0x00080008u, 0x001B001Bu, 0x001F001Fu, 0x001F001Fu, 0x000E000Eu, 0x00040004u, 0x001B001Bu, 0x001F0015u,
    0x001F0011u, 0x000E000Au, 0x00040004u, 0x001F001Fu, 0x00080008u, 0x00040004u, 0x00020002u, 0x001F001Fu,
    0x000F000Fu, 0x00040004u, 0x00020002u, 0x000F000Fu, 0x00010001u, 0x00010001u, 0x00010001u, 0x00000000u,
    0x00010001u, 0x00070007u, 0x00040004u, 0x00060006u, 0x00000000u, 0x00020002u, 0x000E000Eu, 0x000A000Au,
    0x000A000Au, 0x000B000Bu, 0x00030003u, 0x000E000Eu, 0x001F001Fu, 0x001F0015u, 0x001F001Fu, 0x000A000Au,
    0x000E000Eu, 0x001F0011u, 0x001F0011u, 0x000E000Eu, 0x000E000Eu, 0x00150015u, 0x00150015u, 0x001F001Fu,
    0x00040004u, 0x00040004u, 0x000E000Eu, 0x001F0015u, 0x001F001Fu, 0x001F0011u, 0x000E000Eu, 0x000C000Cu,
    0x00060006u, 0x001F001Fu, 0x000C000Cu, 0x00060006u, 0x00040004u, 0x000E000Eu, 0x001F001Fu, 0x001F001Fu,
    0x000E000Eu, 0x00040004u, 0x00040004u, 0x001F001Bu, 0x00040004u, 0x00040004u, 0x01110111u, 0x00820082u,
    0x00380038u, 0x007C0044u, 0x01FF01C7u, 0x007C0044u, 0x00380038u, 0x00820082u, 0x01110111u, 0x001C001Cu,
    0x00060006u, 0x00030003u, 0x00030003u, 0x00030003u, 0x00060006u, 0x001C001Cu, 0x00E000E0u, 0x03F80318u,
    0x07FE0406u, 0x1FFF1801u, 0x3FFF2001u, 0x1FFE1FFEu, 0x000A000Au, 0x00150015u
);

const ivec4 FACE[8] = ivec4[8](
    ivec4(3, 3, 6, 6),
    ivec4(7, 4, 8, 9),
    ivec4(7, 3, 9, 9),
    ivec4(6, 3, 9, 9),
    ivec4(8, 3, 9, 10),
    ivec4(6, 3, 9, 8),
    ivec4(2, 3, 11, 7),
    ivec4(6, 3, 9, 9)
);
const int MOUTH_C2[8] = int[8](9, 13, 13, 13, 13, 13, 15, 13);

const int EYE_NORMAL = 0;
const int EYE_BLINK = 1;
const int EYE_HAPPY = 2;
const int EYE_WIDE = 3;
const int EYE_SQL = 4;
const int EYE_SQR = 5;
const int EYE_SMALL = 6;
const int EYE_SBLINK = 7;
const int EYE_SWIDE = 8;
const int MOUTH_SMILE = 0;
const int MOUTH_OPEN = 1;
const int MOUTH_CHOMP = 2;
const int MOUTH_FLAT = 3;
const int MOUTH_FROWN = 4;
const int MOUTH_WAVY = 5;
const int MOUTH_CAT = 6;
const int MOUTH_BEAK = 7;
const int MOUTH_WIDE = 8;
const int MOUTH_DOT = 9;
const int MOUTH_O2 = 10;
const int MOUTH_GRIN = 11;
// Face patterns: bit (row * 8 + col), rows top first; width, height.
const ivec3 EYE_PAT[9] = ivec3[9](ivec3(771, 2, 2), ivec3(768, 2, 2), ivec3(1282, 3, 2), ivec3(197379, 2, 3), ivec3(66049, 2, 3), ivec3(131330, 2, 3), ivec3(257, 1, 2), ivec3(256, 1, 2), ivec3(65793, 1, 3));
const ivec3 MOUTH_PAT[12] = ivec3[12](ivec3(1545, 4, 2), ivec3(395526, 4, 3), ivec3(15, 4, 1), ivec3(6, 4, 1), ivec3(2310, 4, 2), ivec3(1290, 4, 2), ivec3(4653, 6, 2), ivec3(1551, 4, 2), ivec3(7713, 6, 2), ivec3(3, 2, 1), ivec3(771, 2, 2), ivec3(1551, 4, 2));

// 3x5 digits: bit (row * 3 + col), rows top first.
const int DIGIT[10] = int[10](31599, 18724, 29671, 31207, 18925, 31183, 31695, 18727, 31727, 31215);

// ------------------------------------------------------------- state

struct State {
    vec2 pos;  vec2 vel;
    float facing; int mode; float modeT; float tx;
    float food; float joy; float energy; float sick;
    float age; float lightsOff; float dark; float inited;
    float pressPrev; float cursorIdle; float hoverT; float lightsManual;
    vec4 poops;
    float nextPoop; float dirtyT; int stage; int species;
    vec2 ballPos; vec2 ballVel;
    float ballT; float foodKind; float iconT; float iconK;
    float heartT; float bubble; float bubbleT; float cool;
    float flushT; float statusT; float tapT; float evolveT;
    vec2 tapPos; float coveredT; float lastMeal;
    float decideT; float rng; float attn; float platform;
    vec2 look; float kickT; float kicks;
    float starveT; float landT; float escaping;
};

vec4 ld(int k) { return texelFetch(iChannel0, ivec2(k, int(iResolution.y) - 1), 0); }

State load()
{
    State s;
    vec4 t;
    t = ld(0);  s.pos = t.xy; s.vel = t.zw;
    t = ld(1);  s.facing = t.x; s.mode = int(t.y + 0.5); s.modeT = t.z; s.tx = t.w;
    t = ld(2);  s.food = t.x; s.joy = t.y; s.energy = t.z; s.sick = t.w;
    t = ld(3);  s.age = t.x; s.lightsOff = t.y; s.dark = t.z; s.inited = t.w;
    t = ld(4);  s.pressPrev = t.x; s.cursorIdle = t.y; s.hoverT = t.z; s.lightsManual = t.w;
    s.poops = ld(5);
    t = ld(6);  s.nextPoop = t.x; s.dirtyT = t.y; s.stage = int(t.z + 0.5); s.species = int(t.w + 0.5);
    t = ld(7);  s.ballPos = t.xy; s.ballVel = t.zw;
    t = ld(8);  s.ballT = t.x; s.foodKind = t.y; s.iconT = t.z; s.iconK = t.w;
    t = ld(9);  s.heartT = t.x; s.bubble = t.y; s.bubbleT = t.z; s.cool = t.w;
    t = ld(10); s.flushT = t.x; s.statusT = t.y; s.tapT = t.z; s.evolveT = t.w;
    t = ld(11); s.tapPos = t.xy; s.coveredT = t.z; s.lastMeal = t.w;
    t = ld(12); s.decideT = t.x; s.rng = t.y; s.attn = t.z; s.platform = t.w;
    t = ld(13); s.look = t.xy; s.kickT = t.z; s.kicks = t.w;
    t = ld(14); s.starveT = t.x; s.landT = t.y; s.escaping = t.w;
    return s;
}

vec4 packState(State s, int k)
{
    if (k == 0)  return vec4(s.pos, s.vel);
    if (k == 1)  return vec4(s.facing, float(s.mode), s.modeT, s.tx);
    if (k == 2)  return vec4(s.food, s.joy, s.energy, s.sick);
    if (k == 3)  return vec4(s.age, s.lightsOff, s.dark, s.inited);
    if (k == 4)  return vec4(s.pressPrev, s.cursorIdle, s.hoverT, s.lightsManual);
    if (k == 5)  return s.poops;
    if (k == 6)  return vec4(s.nextPoop, s.dirtyT, float(s.stage), float(s.species));
    if (k == 7)  return vec4(s.ballPos, s.ballVel);
    if (k == 8)  return vec4(s.ballT, s.foodKind, s.iconT, s.iconK);
    if (k == 9)  return vec4(s.heartT, s.bubble, s.bubbleT, s.cool);
    if (k == 10) return vec4(s.flushT, s.statusT, s.tapT, s.evolveT);
    if (k == 11) return vec4(s.tapPos, s.coveredT, s.lastMeal);
    if (k == 12) return vec4(s.decideT, s.rng, s.attn, s.platform);
    if (k == 13) return vec4(s.look, s.kickT, s.kicks);
    return vec4(s.starveT, s.landT, 0.0, s.escaping);
}

float rnd(inout State s)
{
    s.rng += 1.0;
    return hash11(s.rng * 7.31 + 0.37);
}

void setMode(inout State s, int m)
{
    s.mode = m;
    s.modeT = 0.0;
    s.escaping = 0.0;
}

void showBubble(inout State s, int b)
{
    s.bubble = float(b);
    s.bubbleT = 0.0;
}

// ------------------------------------------------------------- the pet's shape

// Index into FACE / body sprite pairs.
int bodyIndex(int stage, int species)
{
    if (stage <= ST_BABY) return 0;
    if (stage == ST_CHILD) return 1 + species - (species / 2) * 2;
    return 3 + species;
}

ivec2 petSize(State s)
{
    if (s.stage == ST_EGG) return SPR_META[SP_EGG].yz;
    return SPR_META[bodyIndex(s.stage, s.species) * 2].yz;
}

bool asleepMode(int m) { return m == M_SLEEP || m == M_NAP || m == M_YAWN || m == M_STIR; }
bool freeMode(int m) { return m == M_IDLE || m == M_WALK; }

float walkSpeed(State s)
{
    float v = s.stage == ST_BABY ? 3.5 : (s.stage == ST_CHILD ? 4.5 : 5.5);
    if (s.sick > 0.0) v *= 0.5;
    else if (s.food < 0.2) v *= 0.75;
    return v;
}

int poopCount(State s)
{
    return int(s.poops.x >= 0.0) + int(s.poops.y >= 0.0) + int(s.poops.z >= 0.0) + int(s.poops.w >= 0.0);
}

// x of a poop within r dots of x, or -1.
float poopNear(State s, float x, float r)
{
    for (int k = 0; k < 4; k++) {
        if (s.poops[k] >= 0.0 && abs(s.poops[k] - x) < r) return s.poops[k];
    }
    return -1.0;
}

// Matrix x of the flush wave front t seconds after it starts.
float flushX(float t, Grid g) { return float(g.cols) + 6.0 - t / FLUSH_TIME * (float(g.cols) + 14.0); }

// ------------------------------------------------------------- windows in dots

// Window i at fraction f between last frame (0) and this frame (1):
// min xy, max xy in dots.
vec4 winAt(int i, float f, Grid g)
{
    vec4 c = iWindowRects[i];
    vec4 p = iWindowRectsPrev[i];
    if (p.z < 1.0 || abs(p.z - c.z) > 0.5 || abs(p.w - c.w) > 0.5) p = c;
    vec4 r = mix(p, c, f);
    return vec4(toDots(g, r.xy / iResolution.y), toDots(g, (r.xy + r.zw) / iResolution.y));
}

bool winValid(int i) { return iWindowRects[i].z >= 1.0 && iWindowRects[i].w >= 1.0; }

bool coveredDots(vec2 p, Grid g)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 r = winAt(i, 1.0, g);
        if (p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w) return true;
    }
    return false;
}

// Nearest floor x where the pet's face is clear of windows; returns -1 when
// the whole floor is covered.
float clearSpot(State s, Grid g, float hw, float faceY)
{
    float lo = hw + 2.0;
    float hi = float(g.cols) - hw - 2.0;
    for (int k = 1; k <= 90; k++) {
        float dx = float(k) * 3.0;
        float xl = s.pos.x - dx;
        float xr = s.pos.x + dx;
        bool okL = xl >= lo && !coveredDots(vec2(xl, faceY), g);
        bool okR = xr <= hi && !coveredDots(vec2(xr, faceY), g);
        if (okR && (!okL || s.facing > 0.0)) return min(xr + 3.0, hi);
        if (okL) return max(xl - 3.0, lo);
        if (xl < lo && xr > hi) break;
    }
    return -1.0;
}

// Lowest top among windows covering point p that the pet can stand on.
float coverTop(vec2 p, Grid g, float h)
{
    float best = -1.0;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 r = winAt(i, 1.0, g);
        if (p.x > r.x + 2.0 && p.x < r.z - 2.0 && p.y > r.y && p.y < r.w
            && r.w > float(FLOOR) + 3.0 && r.w < float(g.rows) - h - 1.0) {
            best = best < 0.0 ? r.w : min(best, r.w);
        }
    }
    return best;
}

// x extent (dots) of the window top the pet stands on; (0, -1) on the floor.
vec2 platformSpan(State s, Grid g)
{
    if (s.platform < 0.5) return vec2(0.0, -1.0);
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 b = winAt(i, 1.0, g);
        if (abs(b.w - s.pos.y) < 1.2 && s.pos.x > b.x - 0.5 && s.pos.x < b.z + 0.5) return vec2(b.x, b.z);
    }
    return vec2(0.0, -1.0);
}

// ------------------------------------------------------------- actions

bool needsFood(State s, float hr)
{
    float mw = mealWindow(hr);
    bool fed = s.lastMeal >= 0.0 && hr - s.lastMeal >= 0.0 && hr - s.lastMeal <= mw + 0.001;
    return s.food < 0.3 || (mw >= 0.0 && !fed && s.food < 0.85);
}

int topNeed(State s, float hr)
{
    if (s.sick > 0.0) return BU_SKULL;
    if (needsFood(s, hr)) return BU_FOOD;
    if (poopCount(s) > 0 && s.dirtyT > 45.0) return BU_POOP;
    if (s.joy < 0.3) return BU_HEART;
    return BU_NONE;
}

void petThePet(inout State s)
{
    if (s.mode == M_EGG || s.mode == M_EVOLVE) {
        showBubble(s, BU_QUEST);
        return;
    }
    if (asleepMode(s.mode)) {
        if (s.mode != M_YAWN) {
            int back = s.mode == M_STIR ? int(s.tx + 0.5) : s.mode;
            setMode(s, M_STIR);
            s.tx = float(back);
            showBubble(s, BU_QUEST);
        }
        return;
    }
    s.heartT = 0.0;
    s.joy = min(1.0, s.joy + 0.1 * (1.1 - s.joy));
    if (freeMode(s.mode) || s.mode == M_HAPPY || s.mode == M_PLAY && s.ballT <= 0.0) {
        setMode(s, M_HAPPY);
        s.vel.x = 0.0;
    }
}

void feed(inout State s, float hr)
{
    if (!freeMode(s.mode) && s.mode != M_HAPPY && s.mode != M_PLAY) return;
    bool hungry = needsFood(s, hr);
    if (!hungry && s.food > 0.92) {
        setMode(s, M_REFUSE);
        s.vel.x = 0.0;
        return;
    }
    if (s.mode == M_PLAY) s.ballT = 0.0;
    setMode(s, M_EAT);
    s.vel.x = 0.0;
    if (hungry || s.food < 0.75) {
        s.foodKind = rnd(s) < 0.6 ? 0.0 : 2.0;      // meal: rice ball or bowl of rice
        s.food = min(1.0, s.food + 0.45);
        s.lastMeal = hr;
        s.joy = min(1.0, s.joy + 0.05);
    } else {
        s.foodKind = 1.0;                             // snack: cake
        s.food = min(1.0, s.food + 0.08);
        s.joy = min(1.0, s.joy + 0.2);
    }
    s.nextPoop = min(s.nextPoop, POOP_AFTER_MEAL * (1.0 + rnd(s)));
}

void kickBall(inout State s, float dir, float up)
{
    s.ballVel = vec2(dir * (13.0 + 9.0 * rnd(s)), up + 10.0 * rnd(s));
}

void onIcon(inout State s, int k, float hr, Grid g)
{
    s.iconT = 0.0;
    s.iconK = float(k);
    bool asleep = asleepMode(s.mode);
    bool locked = s.mode == M_EGG || s.mode == M_EVOLVE;
    if (k == IC_LIGHT) {
        s.lightsOff = s.lightsOff > 0.5 ? 0.0 : 1.0;
        s.lightsManual = 1.0;
        if (s.lightsOff > 0.5 && !asleep && !locked) {
            s.ballT = 0.0;
            setMode(s, M_YAWN);
            s.vel.x = 0.0;
        } else if (s.lightsOff < 0.5 && s.mode == M_NAP) {
            setMode(s, M_WAKE);
        }
        return;
    }
    if (k == IC_STATUS) {
        s.statusT = s.statusT > 0.0 ? 0.0 : 10.0;
        return;
    }
    if (k == IC_CLEAN) {
        if (s.flushT < 0.0) s.flushT = 0.0;
        return;
    }
    if (k == IC_LOVE) {
        petThePet(s);
        return;
    }
    if (k == IC_ATTN) {
        int b = asleep ? (nightAt(hr) && s.lightsOff < 0.5 ? BU_BULB : BU_NONE) : topNeed(s, hr);
        if (b == BU_NONE && !asleep) b = BU_NOTE;
        if (b != BU_NONE) showBubble(s, b);
        return;
    }
    if (locked) return;
    if (asleep) {
        petThePet(s);
        return;
    }
    if (k == IC_FOOD) {
        feed(s, hr);
    } else if (k == IC_PLAY) {
        if (s.ballT > 0.0) {
            s.ballT = 0.0;
        } else if (s.energy < 0.12 || s.sick > 0.0) {
            setMode(s, M_REFUSE);
            s.vel.x = 0.0;
        } else if (freeMode(s.mode) || s.mode == M_HAPPY) {
            vec2 sz = vec2(petSize(s));
            float side = s.pos.x > float(g.cols) * 0.5 ? -1.0 : 1.0;
            s.ballPos = vec2(s.pos.x + side * (sz.x * 0.5 + 12.0), min(float(g.rows) - 4.0, s.pos.y + sz.y + 14.0));
            s.ballVel = vec2(-side * 6.0, 0.0);
            s.ballT = 30.0;
            s.kicks = 0.0;
            setMode(s, M_PLAY);
            showBubble(s, BU_NOTE);
        }
    } else if (k == IC_MEDS) {
        if (s.sick > 0.0 && (freeMode(s.mode) || s.mode == M_HAPPY)) {
            setMode(s, M_MEDS);
            s.vel.x = 0.0;
        } else if (freeMode(s.mode) || s.mode == M_HAPPY) {
            setMode(s, M_REFUSE);
            s.vel.x = 0.0;
        }
    }
}

// Press at dot position c inside the matrix.
void onTap(inout State s, vec2 c, Grid g)
{
    s.tapPos = c;
    s.tapT = 0.0;
    // Poop
    for (int k = 0; k < 4; k++) {
        float px = s.poops[k];
        if (px >= 0.0 && abs(c.x - px) < 5.0 && c.y < float(FLOOR) + 8.0 && c.y > float(FLOOR) - 3.0) {
            s.poops[k] = -1.0;
            s.joy = min(1.0, s.joy + 0.03);
            return;
        }
    }
    // Ball
    if (s.ballT > 0.0 && length(c - s.ballPos) < 5.0) {
        kickBall(s, c.x < s.ballPos.x ? 1.0 : -1.0, 42.0);
        s.ballT = max(s.ballT, 12.0);
        return;
    }
    // Pet
    vec2 sz = vec2(petSize(s));
    if (abs(c.x - s.pos.x) < sz.x * 0.5 + 1.5 && c.y > s.pos.y - 1.5 && c.y < s.pos.y + sz.y + 1.5) {
        petThePet(s);
        return;
    }
    // Anywhere else: come here.
    if (freeMode(s.mode) && s.stage > ST_EGG) {
        setMode(s, M_WALK);
        s.tx = clamp(c.x, sz.x * 0.5 + 1.0, float(g.cols) - sz.x * 0.5 - 1.0);
        s.escaping = 0.0;
    }
}

// ------------------------------------------------------------- update

void initState(inout State s, Grid g)
{
    float hr = clockHours();
    float dayNo = iDate.x * 372.0 + iDate.y * 31.0 + iDate.z;
    ivec2 egg = SPR_META[SP_EGG].yz;
    float x = float(g.cols) * 0.5;
    float faceY = float(FLOOR) + float(egg.y) * 0.5;
    s.pos = vec2(x, float(FLOOR));
    s.facing = 1.0;
    if (coveredDots(vec2(x, faceY), g)) {
        float c = clearSpot(s, g, float(egg.x) * 0.5, faceY);
        if (c >= 0.0) s.pos.x = c;
    }
    s.vel = vec2(0.0);
    s.mode = M_EGG; s.modeT = 0.0; s.tx = s.pos.x;
    s.food = 0.5; s.joy = 0.7;
    s.energy = nightAt(hr) ? 0.3 : clamp(1.0 - (hr - WAKE_UP) / 18.0, 0.35, 1.0);
    s.sick = 0.0;
    s.age = 0.0; s.lightsOff = 0.0; s.dark = 0.0; s.inited = 1.0;
    s.pressPrev = iMouse.z > 0.0 ? 1.0 : 0.0;
    s.cursorIdle = 100.0; s.hoverT = 0.0; s.lightsManual = 0.0;
    s.poops = vec4(-1.0);
    s.rng = floor(fract(iDate.w * 0.00137) * 1000.0);
    s.nextPoop = 600.0 + 900.0 * hash11(s.rng + 3.0);
    s.dirtyT = 0.0; s.stage = ST_EGG;
    s.species = SPECIES >= 0 ? SPECIES : int(hash11(dayNo * 0.618 + 11.0) * 4.999);
    s.ballPos = vec2(-100.0); s.ballVel = vec2(0.0);
    s.ballT = 0.0; s.foodKind = 0.0; s.iconT = 100.0; s.iconK = -1.0;
    s.heartT = 100.0; s.bubble = 0.0; s.bubbleT = 100.0; s.cool = 0.0;
    s.flushT = -1.0; s.statusT = 0.0; s.tapT = 100.0; s.evolveT = 100.0;
    s.tapPos = vec2(-100.0); s.coveredT = 0.0; s.lastMeal = -1.0;
    s.decideT = 1.0; s.attn = 0.0; s.platform = 0.0;
    s.look = vec2(0.0); s.kickT = 100.0; s.kicks = 0.0;
    s.starveT = 0.0; s.landT = 100.0; s.escaping = 0.0;
}

void physics(inout State s, Grid g, float dt, vec2 sz)
{
    float f0 = float(iSubstep) / float(max(iSubsteps, 1));
    float f1 = float(iSubstep + 1) / float(max(iSubsteps, 1));
    float hw = sz.x * 0.5;
    float top = float(g.rows) - sz.y - 0.5;

    // Standing on a window: carried along with it.
    if (s.platform > 0.5 && s.vel.y <= 0.0) {
        int wi = -1;
        for (int i = 0; i < iWindowCount && i < 16; i++) {
            if (!winValid(i)) continue;
            vec4 a = winAt(i, f0, g);
            if (abs(a.w - s.pos.y) < 1.2 && s.pos.x > a.x - 0.5 && s.pos.x < a.z + 0.5) {
                wi = i;
                break;
            }
        }
        if (wi >= 0) {
            vec4 a = winAt(wi, f0, g);
            vec4 b = winAt(wi, f1, g);
            vec2 d = vec2(b.x - a.x, b.w - a.w);
            if (length(d) < 40.0) s.pos.x += d.x;
            s.pos.y = b.w;
            if (b.w > top || b.w < float(FLOOR) + 1.0) s.platform = 0.0;
        } else {
            s.platform = 0.0;
        }
    }

    s.pos.x = clamp(s.pos.x + s.vel.x * dt, hw + 0.5, float(g.cols) - hw - 0.5);

    // Walked off the edge of the window.
    if (s.platform > 0.5) {
        bool held = false;
        for (int i = 0; i < iWindowCount && i < 16; i++) {
            if (!winValid(i)) continue;
            vec4 b = winAt(i, f1, g);
            if (abs(b.w - s.pos.y) < 1.2 && s.pos.x > b.x - 0.5 && s.pos.x < b.z + 0.5) held = true;
        }
        if (!held) s.platform = 0.0;
    }

    if (s.platform < 0.5) {
        if (s.pos.y > float(FLOOR) + 0.001 || s.vel.y > 0.0) {
            float y0 = s.pos.y;
            s.vel.y -= GRAVITY * dt;
            s.pos.y += s.vel.y * dt;
            if (s.vel.y < 0.0) {
                float land = -1.0;
                for (int i = 0; i < iWindowCount && i < 16; i++) {
                    if (!winValid(i)) continue;
                    vec4 b = winAt(i, f1, g);
                    if (s.pos.x > b.x + 1.0 && s.pos.x < b.z - 1.0 && b.w <= y0 + 0.01 && b.w >= s.pos.y
                        && b.w > float(FLOOR) + 2.0 && b.w < top) land = max(land, b.w);
                }
                if (land >= 0.0) {
                    s.pos.y = land;
                    s.vel.y = 0.0;
                    s.platform = 1.0;
                    s.landT = 0.0;
                } else if (s.pos.y <= float(FLOOR)) {
                    s.pos.y = float(FLOOR);
                    s.vel.y = 0.0;
                    s.landT = 0.0;
                }
            }
        } else {
            s.pos.y = float(FLOOR);
            s.vel.y = 0.0;
        }
    }
    s.pos.y = min(s.pos.y, float(g.rows) - sz.y);
}

void ballPhysics(inout State s, Grid g, float dt)
{
    if (s.ballT <= 0.0) return;
    float r = 2.0;
    s.ballVel.y -= BALL_GRAVITY * dt;
    s.ballPos += s.ballVel * dt;
    float fl = float(FLOOR) + r;
    if (s.ballPos.y < fl) {
        s.ballPos.y = fl;
        s.ballVel.y = abs(s.ballVel.y) > 6.0 ? -s.ballVel.y * 0.72 : 0.0;
    }
    if (s.ballPos.y <= fl + 0.01) s.ballVel.x *= exp(-1.1 * dt);
    if (s.ballPos.x < r + 0.5) { s.ballPos.x = r + 0.5; s.ballVel.x = abs(s.ballVel.x) * 0.8; }
    float xr = float(g.cols) - r - 0.5;
    if (s.ballPos.x > xr) { s.ballPos.x = xr; s.ballVel.x = -abs(s.ballVel.x) * 0.8; }
    float yt = float(g.rows) - r - 0.5;
    if (s.ballPos.y > yt) { s.ballPos.y = yt; s.ballVel.y = -abs(s.ballVel.y) * 0.5; }
}

void update(inout State s, Grid g)
{
    float dt = clamp(iTimeDelta, 0.0, 0.1);
    float hr = clockHours();
    bool night = nightAt(hr);
    s.age = min(s.age + dt, ADULT_SECONDS + 60.0);
    s.modeT = min(s.modeT + dt, 1e4);
    vec2 sz = vec2(petSize(s));
    float hw = sz.x * 0.5;
    vec2 head = s.pos + vec2(0.0, sz.y * 0.6);

    // ---- cursor
    bool moved = length(iMouse.xy - iMousePrev) > 0.25;
    s.cursorIdle = moved ? 0.0 : s.cursorIdle + dt;
    bool onDesk = cursorOnScreen() && !insideWindow(iMouse.xy);
    vec2 cur = toDots(g, iMouse.xy / iResolution.y);
    bool inMatrix = cur.x >= 0.0 && cur.y >= 0.0 && cur.x < float(g.cols) && cur.y < float(g.rows);
    bool curActive = onDesk && inMatrix && s.cursorIdle < 3.0;
    bool overPet = onDesk && abs(cur.x - s.pos.x) < hw + 1.0 && cur.y > s.pos.y - 1.0 && cur.y < s.pos.y + sz.y + 1.0;
    s.hoverT = overPet && s.cursorIdle < 30.0 ? s.hoverT + dt : 0.0;

    // ---- press
    bool pressed = iMouse.z > 0.0;
    if (pressed && s.pressPrev < 0.5) {
        vec2 pp = iMouse.zw;
        bool ok = pp.x >= 0.0 && pp.y >= 0.0 && pp.x < iResolution.x && pp.y < iResolution.y && !insideWindow(pp);
        if (ok && s.inited > 0.5) {
            vec2 ph = pp / iResolution.y;
            int k = iconAt(g, ph);
            vec2 c = toDots(g, ph);
            if (k >= 0) {
                onIcon(s, k, hr, g);
            } else if (c.x >= 0.0 && c.y >= 0.0 && c.x < float(g.cols) && c.y < float(g.rows)) {
                onTap(s, c, g);
            }
        }
    }
    s.pressPrev = pressed ? 1.0 : 0.0;

    // ---- needs
    bool asleep = asleepMode(s.mode);
    int pc = poopCount(s);
    if (s.stage > ST_EGG) {
        if (asleep) {
            s.food -= FOOD_DRAIN * 0.25 * dt;
            s.energy += (s.mode == M_NAP ? NRG_NAP : NRG_SLEEP) * dt;
        } else {
            s.food -= FOOD_DRAIN * dt;
            float drain = 1.0 + 0.5 * float(pc) + (s.sick > 0.0 ? 1.0 : 0.0) + (s.food < 0.15 ? 0.6 : 0.0);
            s.joy -= JOY_DRAIN * drain * dt;
            s.energy -= NRG_DRAIN * dt;
        }
    }
    s.food = clamp(s.food, 0.0, 1.0);
    s.joy = clamp(s.joy, 0.0, 1.0);
    s.energy = clamp(s.energy, 0.0, 1.0);
    s.dirtyT = pc > 0 ? s.dirtyT + dt : 0.0;
    s.starveT = s.food <= 0.0 ? s.starveT + dt : 0.0;
    if (s.sick > 0.0) {
        s.sick += dt;
        if (s.sick > 5400.0) { s.sick = 0.0; s.dirtyT = 0.0; }
    } else if (s.dirtyT > SICK_AFTER || s.starveT > 1200.0) {
        s.sick = 0.001;
    }
    bool hungry = needsFood(s, hr);
    s.attn = (s.stage > ST_EGG && (s.sick > 0.0 || hungry || s.joy < 0.3 || (pc > 0 && s.dirtyT > 45.0)
             || (night && s.mode == M_SLEEP && s.lightsOff < 0.5))) ? 1.0 : 0.0;
    if (!asleep && s.stage > ST_EGG) s.nextPoop -= dt;

    // ---- sleep by the clock
    if (night && s.stage > ST_EGG && (freeMode(s.mode) || s.mode == M_NAP || s.mode == M_PLAY && s.ballT <= 0.0)) {
        s.ballT = 0.0;
        if (s.mode == M_NAP) setMode(s, M_SLEEP); else setMode(s, M_YAWN);
        s.vel.x = 0.0;
    }
    if (!night && s.mode == M_SLEEP) {
        setMode(s, M_WAKE);
        if (s.lightsManual < 0.5 || s.lightsOff > 0.5) s.lightsOff = 0.0;
        s.lightsManual = 0.0;
    }
    if (!night && freeMode(s.mode) && s.stage > ST_EGG && (s.energy < 0.1 || s.lightsOff > 0.5)) {
        setMode(s, M_YAWN);
        s.vel.x = 0.0;
    }

    // ---- windows: startle, covered
    s.cool -= dt;
    float pxPerDot = g.d * iResolution.y;
    if (!asleep && s.stage > ST_EGG && s.cool <= 0.0) {
        vec2 centre = s.pos + vec2(0.0, sz.y * 0.5);
        for (int i = 0; i < iWindowCount && i < 16; i++) {
            if (!winValid(i)) continue;
            vec2 v = iWindowVelocities[i] / pxPerDot;
            if (length(v) < 45.0) continue;
            vec4 r = winAt(i, 1.0, g);
            if (s.platform > 0.5 && abs(r.w - s.pos.y) < 1.5) continue;
            vec2 q = clamp(centre, r.xy, r.zw);
            if (length(q - centre) < 7.0 && (freeMode(s.mode) || s.mode == M_HAPPY || s.mode == M_PLAY)) {
                s.ballT = 0.0;
                setMode(s, M_STARTLE);
                float away = centre.x < 0.5 * (r.x + r.z) ? -1.0 : 1.0;
                if (s.pos.x < hw + 6.0) away = 1.0;
                if (s.pos.x > float(g.cols) - hw - 6.0) away = -1.0;
                s.facing = away;
                s.vel = vec2(0.0, 32.0);
                s.platform = 0.0;
                showBubble(s, BU_EXCL);
                s.cool = 4.0;
                break;
            }
        }
    }
    bool covered = s.stage > ST_EGG && coveredDots(head, g);
    s.coveredT = covered ? s.coveredT + dt : 0.0;
    if (s.coveredT > 0.8 && freeMode(s.mode) && s.escaping < 0.5 && s.vel.y == 0.0) {
        float faceY = float(FLOOR) + sz.y * 0.6;
        float x = clearSpot(s, g, hw, faceY);
        float wt = coverTop(head, g, sz.y);
        bool jump = wt > 0.0 && (x < 0.0 || abs(x - s.pos.x) > 34.0 || rnd(s) < 0.3);
        if (jump) {
            s.vel.y = sqrt(2.0 * GRAVITY * max(wt - s.pos.y + 2.0, 1.0));
            s.platform = 0.0;
            setMode(s, M_IDLE);
            s.decideT = 2.0;
        } else if (x >= 0.0) {
            setMode(s, M_WALK);
            s.tx = x;
            s.escaping = 1.0;
        } else {
            s.coveredT = -30.0;
        }
    }

    // ---- behaviour
    float r;
    int m = s.mode;
    s.decideT -= dt;
    if (m == M_EGG) {
        s.vel.x = 0.0;
        if (s.modeT >= HATCH_SECONDS) {
            s.stage = ST_BABY;
            setMode(s, M_HAPPY);
            s.heartT = 0.0;
            s.evolveT = 0.0;
            showBubble(s, BU_EXCL);
        }
    } else if (m == M_IDLE || m == M_WALK) {
        if (s.stage < ST_ADULT && s.age >= (s.stage == ST_BABY ? CHILD_SECONDS : ADULT_SECONDS)) {
            setMode(s, M_EVOLVE);
            s.vel.x = 0.0;
        } else if (s.nextPoop <= 0.0 && s.vel.y == 0.0 && s.platform < 0.5) {
            if (poopCount(s) < 4) setMode(s, M_POOP);
            s.nextPoop = 1500.0 + 1500.0 * rnd(s);
            s.vel.x = 0.0;
        } else if (m == M_WALK) {
            float dx = s.tx - s.pos.x;
            float v = s.escaping > 0.5 ? RUN_SPEED : walkSpeed(s);
            s.facing = dx >= 0.0 ? 1.0 : -1.0;
            s.vel.x = s.facing * min(v, abs(dx) / max(dt, 1e-4));
            if (abs(dx) < 0.05 || (s.pos.x <= hw + 0.6 && dx < 0.0) || (s.pos.x >= float(g.cols) - hw - 0.6 && dx > 0.0)) {
                setMode(s, M_IDLE);
                s.vel.x = 0.0;
                s.escaping = 0.0;
                s.decideT = 1.0 + 2.5 * rnd(s);
            }
        } else {
            s.vel.x = 0.0;
            if (curActive && abs(cur.x - s.pos.x) > 2.5) s.facing = cur.x > s.pos.x ? 1.0 : -1.0;
            if (s.decideT <= 0.0 && s.vel.y == 0.0) {
                r = rnd(s);
                float dxc = cur.x - s.pos.x;
                s.decideT = 1.5 + 3.0 * rnd(s);
                float pn = s.platform < 0.5 ? poopNear(s, s.pos.x, hw + 4.0) : -1.0;
                if (pn >= 0.0) {
                    float away = s.pos.x >= pn ? 1.0 : -1.0;
                    if (s.pos.x + away * 14.0 > float(g.cols) - hw - 1.0 || s.pos.x + away * 14.0 < hw + 1.0) away = -away;
                    setMode(s, M_WALK);
                    s.tx = clamp(pn + away * (hw + 7.0), hw + 1.0, float(g.cols) - hw - 1.0);
                } else if (curActive && abs(dxc) > 18.0 && r < 0.75) {
                    setMode(s, M_WALK);
                    s.tx = clamp(cur.x - sign(dxc) * (hw + 6.0), hw + 1.0, float(g.cols) - hw - 1.0);
                } else if (r < 0.5) {
                    float t = s.pos.x + (rnd(s) * 2.0 - 1.0) * 45.0;
                    t = clamp(t, hw + 2.0, float(g.cols) - hw - 2.0);
                    vec2 span = platformSpan(s, g);
                    if (span.y > span.x && rnd(s) < 0.85) t = clamp(t, span.x + 2.0, span.y - 2.0);
                    if (coveredDots(vec2(t, head.y), g) && !covered) t = clamp(2.0 * s.pos.x - t, hw + 2.0, float(g.cols) - hw - 2.0);
                    float pt = poopNear(s, t, hw + 4.0);
                    if (pt >= 0.0) t = clamp(pt + (t > pt ? 1.0 : -1.0) * (hw + 5.0), hw + 2.0, float(g.cols) - hw - 2.0);
                    if (abs(t - s.pos.x) > 2.0) {
                        setMode(s, M_WALK);
                        s.tx = t;
                    }
                } else if (r < 0.64 && s.joy > 0.5 && s.sick <= 0.0 && s.food > 0.3) {
                    s.vel.y = 24.0;
                    s.platform = 0.0;
                    if (rnd(s) < 0.4) showBubble(s, BU_NOTE);
                } else if (r < 0.7) {
                    s.facing = -s.facing;
                }
                int need = topNeed(s, hr);
                if (need != BU_NONE && rnd(s) < 0.35) showBubble(s, need);
            }
        }
    } else if (m == M_EAT) {
        s.vel.x = 0.0;
        if (s.modeT > EAT_TIME) {
            setMode(s, M_IDLE);
            s.decideT = 1.0;
            if (s.foodKind > 0.5 && s.foodKind < 1.5) showBubble(s, BU_HEART);
        }
    } else if (m == M_PLAY) {
        if (s.ballT <= 0.0 || s.energy < 0.08) {
            s.ballT = 0.0;
            setMode(s, s.kicks > 0.0 ? M_HAPPY : M_IDLE);
            if (s.kicks > 0.0) showBubble(s, BU_NOTE);
            s.vel.x = 0.0;
        } else {
            s.ballT -= dt;
            float dx = s.ballPos.x - s.pos.x;
            s.facing = dx >= 0.0 ? 1.0 : -1.0;
            float want = abs(dx) - (hw + 1.0);
            s.vel.x = want > 0.0 ? s.facing * min(9.0 + 2.0 * float(s.stage), want / max(dt, 1e-4)) : 0.0;
            bool reach = abs(dx) < hw + 2.6 && s.ballPos.y < s.pos.y + sz.y + 1.5 && s.ballPos.y > s.pos.y - 1.0;
            if (reach && s.kickT > 0.35) {
                kickBall(s, s.facing, 30.0);
                s.kickT = 0.0;
                s.kicks += 1.0;
                s.ballT = max(s.ballT, 10.0);
                s.joy = min(1.0, s.joy + 0.05 * (1.1 - s.joy));
                s.energy = max(0.0, s.energy - 0.008);
                if (s.kicks == 3.0 || s.kicks == 8.0) s.heartT = 0.0;
            }
            if (s.vel.y == 0.0 && s.ballVel.y < 0.0 && abs(dx) < hw + 4.0
                && s.ballPos.y > s.pos.y + sz.y + 1.0 && s.ballPos.y < s.pos.y + sz.y + 9.0) {
                s.vel.y = 30.0;
                s.platform = 0.0;
            }
        }
    } else if (m == M_HAPPY) {
        s.vel.x = 0.0;
        if (s.vel.y == 0.0 && s.modeT < 1.0 && s.landT > 0.08) {
            s.vel.y = 26.0;
            s.platform = 0.0;
        }
        if (s.modeT > 1.5) {
            setMode(s, M_IDLE);
            s.decideT = 1.5;
        }
    } else if (m == M_REFUSE) {
        s.vel.x = 0.0;
        if (s.modeT > 1.3) setMode(s, M_IDLE);
    } else if (m == M_STARTLE) {
        s.vel.x = s.modeT > 0.35 ? s.facing * RUN_SPEED : 0.0;
        if (s.modeT > 1.8) {
            setMode(s, M_IDLE);
            s.vel.x = 0.0;
            s.decideT = 2.0;
        }
    } else if (m == M_MEDS) {
        s.vel.x = 0.0;
        if (s.modeT > 2.0) {
            s.sick = 0.0;
            s.dirtyT = 0.0;
            s.evolveT = 0.0;
            setMode(s, M_HAPPY);
        }
    } else if (m == M_EVOLVE) {
        s.vel.x = 0.0;
        if (s.modeT > 2.6) {
            s.stage = min(s.stage + 1, ST_ADULT);
            s.evolveT = 0.0;
            s.heartT = 0.0;
            setMode(s, M_HAPPY);
            showBubble(s, BU_EXCL);
        }
    } else if (m == M_POOP) {
        s.vel.x = 0.0;
        if (s.modeT > 1.3) {
            float px = clamp(s.pos.x - s.facing * (hw + 5.0), 5.0, float(g.cols) - 5.0);
            for (int k = 0; k < 4; k++) {
                float q = s.poops[k];
                if (q >= 0.0 && abs(q - px) < 9.0) px = clamp(px + (px < float(g.cols) * 0.5 ? 10.0 : -10.0), 5.0, float(g.cols) - 5.0);
            }
            for (int k = 0; k < 4; k++) {
                if (s.poops[k] < 0.0) { s.poops[k] = px; break; }
            }
            setMode(s, M_WALK);
            s.tx = clamp(s.pos.x + s.facing * 12.0, hw + 1.0, float(g.cols) - hw - 1.0);
            showBubble(s, BU_EXCL);
        }
    } else if (m == M_YAWN) {
        s.vel.x = 0.0;
        if (s.modeT > 2.6) setMode(s, night ? M_SLEEP : M_NAP);
    } else if (m == M_SLEEP) {
        s.vel.x = 0.0;
        if (s.modeT > 6.0 && s.lightsManual < 0.5) s.lightsOff = 1.0;
    } else if (m == M_NAP) {
        s.vel.x = 0.0;
        if (s.lightsOff < 0.5 && s.energy > 0.6) setMode(s, M_WAKE);
    } else if (m == M_WAKE) {
        s.vel.x = 0.0;
        if (s.modeT > 2.2) {
            setMode(s, M_IDLE);
            s.decideT = 1.0;
        }
    } else if (m == M_STIR) {
        s.vel.x = 0.0;
        if (s.modeT > 1.6) {
            int back = int(s.tx + 0.5);
            setMode(s, back == M_NAP ? M_NAP : M_SLEEP);
            if (!night && back != M_NAP) setMode(s, M_WAKE);
        }
    }

    // ---- look direction (world space, -1..1)
    if (s.hoverT > 0.0) {
        s.look = vec2(abs(cur.x - s.pos.x) > 2.0 ? sign(cur.x - s.pos.x) : 0.0, 1.0);
    } else if (curActive && freeMode(s.mode) && s.mode == M_IDLE) {
        vec2 d = cur - head;
        s.look = vec2(abs(d.x) > 4.0 ? sign(d.x) : 0.0, d.y > 6.0 ? 1.0 : (d.y < -4.0 ? -1.0 : 0.0));
    } else if (s.mode == M_WALK || s.mode == M_PLAY || s.mode == M_STARTLE) {
        s.look = vec2(s.facing, s.mode == M_PLAY && s.ballPos.y > head.y + 4.0 ? 1.0 : 0.0);
    } else {
        s.look = vec2(0.0);
    }

    physics(s, g, dt, sz);
    ballPhysics(s, g, dt);

    // ---- flush
    if (s.flushT >= 0.0) {
        s.flushT += dt;
        float wx = flushX(s.flushT, g);
        int removed = 0;
        for (int k = 0; k < 4; k++) {
            if (s.poops[k] >= 0.0 && s.poops[k] > wx + 1.0) { s.poops[k] = -1.0; removed++; }
        }
        if (removed > 0) s.joy = min(1.0, s.joy + 0.04 * float(removed));
        if (s.flushT > FLUSH_TIME + 0.4) {
            s.flushT = -1.0;
            if (freeMode(s.mode)) {
                setMode(s, M_HAPPY);
                s.vel.x = 0.0;
            }
        }
    }

    // ---- timers
    s.heartT = min(s.heartT + dt, 1e3);
    s.bubbleT = min(s.bubbleT + dt, 1e3);
    s.iconT = min(s.iconT + dt, 1e3);
    s.tapT = min(s.tapT + dt, 1e3);
    s.evolveT = min(s.evolveT + dt, 1e3);
    s.kickT = min(s.kickT + dt, 1e3);
    s.landT = min(s.landT + dt, 1e3);
    s.cursorIdle = min(s.cursorIdle, 1e3);
    s.hoverT = min(s.hoverT, 1e3);
    s.dirtyT = min(s.dirtyT, 1e4);
    s.starveT = min(s.starveT, 1e4);
    s.coveredT = min(s.coveredT, 1e3);
    s.decideT = max(s.decideT, -10.0);
    s.nextPoop = max(s.nextPoop, -10.0);
    s.cool = max(s.cool, -1.0);
    s.statusT = max(0.0, s.statusT - dt);
    s.dark += clamp(s.lightsOff - s.dark, -dt / 0.9, dt / 0.9);
}

// ------------------------------------------------------------- drawing

// Sprite id at cell p (x from the left, y up from the bottom). x = ink,
// y = occluding fill.
vec2 spr(int id, ivec2 p)
{
    ivec3 m = SPR_META[id];
    if (p.x < 0 || p.y < 0 || p.x >= m.y || p.y >= m.z) return vec2(0.0);
    uint row = SPR[m.x + m.z - 1 - p.y];
    return vec2(float((row >> uint(p.x)) & 1u), float((row >> uint(p.x + 16)) & 1u));
}

// Same, with the sprite's bottom-centre at o; flip mirrors it.
vec2 sprAt(int id, ivec2 c, ivec2 o, bool flip)
{
    ivec3 m = SPR_META[id];
    int x = c.x - (o.x - m.y / 2);
    if (flip) x = m.y - 1 - x;
    return spr(id, ivec2(x, c.y - o.y));
}

// Pattern bit (row * 8 + col), rows from the top.
float pat(ivec3 p, int col, int row)
{
    if (col < 0 || row < 0 || col >= p.y || row >= p.z) return 0.0;
    return float((p.x >> (row * 8 + col)) & 1);
}

void paint(inout vec2 o, vec2 l, float ink, float glow)
{
    if (l.y > 0.5 || l.x > 0.5) o = vec2(l.x * ink, l.x * glow);
}

const int E_NORMAL = 0;
const int E_BLINK = 1;
const int E_HAPPY = 2;
const int E_WIDE = 3;
const int E_SQ = 4;

float eyesAt(int col, int row, int kind, bool small, ivec4 f, int dx, int dy)
{
    int y = f.x + dy;
    int xl = f.y + dx;
    int xr = f.z + dx;
    ivec3 pl = EYE_PAT[small ? EYE_SMALL : EYE_NORMAL];
    ivec3 pr = pl;
    if (kind == E_BLINK) {
        pl = EYE_PAT[small ? EYE_SBLINK : EYE_BLINK];
        pr = pl;
    } else if (kind == E_HAPPY) {
        pl = EYE_PAT[EYE_HAPPY];
        pr = pl;
        xl -= 1;
        if (small) xr -= 1;
    } else if (kind == E_WIDE) {
        pl = EYE_PAT[small ? EYE_SWIDE : EYE_WIDE];
        pr = pl;
        y -= 1;
    } else if (kind == E_SQ) {
        pl = EYE_PAT[small ? EYE_SBLINK : EYE_SQL];
        pr = EYE_PAT[small ? EYE_SBLINK : EYE_SQR];
    }
    return max(pat(pl, col - xl, row - y), pat(pr, col - xr, row - y));
}

int mouthPattern(int kind, int body, int mode)
{
    if (body == 0) {
        if (kind == MOUTH_OPEN) return mode == M_EAT || mode == M_YAWN || mode == M_WAKE ? MOUTH_O2 : MOUTH_SMILE;
        if (kind == MOUTH_GRIN) return MOUTH_SMILE;
        if (kind == MOUTH_FROWN || kind == MOUTH_WAVY) return kind;
        return kind == MOUTH_SMILE ? MOUTH_SMILE : MOUTH_DOT;
    }
    if (body == 5 && kind != MOUTH_OPEN && kind != MOUTH_GRIN) return MOUTH_BEAK;
    if (kind == MOUTH_SMILE && body == 3) return MOUTH_CAT;
    if (kind == MOUTH_SMILE && body == 6) return MOUTH_WIDE;
    return kind;
}

// Expression for the current mode: eyes, mouth, blush, tear.
ivec4 expression(State s, float t)
{
    int m = s.mode;
    float blinkPhase = fract(t / 3.7 + 0.3);
    int eyes = blinkPhase < 0.04 ? E_BLINK : E_NORMAL;
    int mouth = s.joy > 0.62 ? MOUTH_SMILE : (s.joy > 0.3 ? MOUTH_FLAT : MOUTH_FROWN);
    int blush = s.joy > 0.8 ? 1 : 0;
    int tear = s.joy < 0.3 && freeMode(m) ? 1 : 0;
    if (s.sick > 0.0) { mouth = MOUTH_WAVY; if (eyes == E_NORMAL && fract(t * 0.5) < 0.5) eyes = E_SQ; }
    if (s.hoverT > 0.25 && freeMode(m)) { mouth = MOUTH_SMILE; blush = 1; }
    if (m == M_EAT) {
        bool chew = s.modeT < EAT_TIME - 0.6;
        eyes = chew ? (fract(s.modeT * 1.5) < 0.5 ? E_HAPPY : E_NORMAL) : E_HAPPY;
        mouth = chew ? (fract(s.modeT * 4.0) < 0.5 ? MOUTH_OPEN : MOUTH_CHOMP) : MOUTH_SMILE;
        blush = s.foodKind > 0.5 ? 1 : blush;
    } else if (m == M_HAPPY) {
        eyes = E_HAPPY; mouth = MOUTH_GRIN; blush = 1; tear = 0;
    } else if (m == M_REFUSE) {
        eyes = E_SQ; mouth = MOUTH_FLAT;
    } else if (m == M_STARTLE) {
        eyes = E_WIDE; mouth = MOUTH_OPEN; tear = 0;
    } else if (m == M_MEDS) {
        eyes = E_SQ; mouth = MOUTH_WAVY;
    } else if (m == M_POOP) {
        eyes = E_SQ; mouth = MOUTH_FLAT;
    } else if (m == M_PLAY) {
        eyes = s.kickT < 0.5 ? E_HAPPY : eyes;
        mouth = s.kickT < 0.5 ? MOUTH_GRIN : MOUTH_SMILE;
    } else if (m == M_SLEEP || m == M_NAP) {
        eyes = E_BLINK; mouth = MOUTH_DOT; blush = 0;
    } else if (m == M_YAWN) {
        eyes = s.modeT > 0.4 ? E_BLINK : E_NORMAL;
        mouth = s.modeT > 0.4 && s.modeT < 1.8 ? MOUTH_OPEN : MOUTH_FLAT;
    } else if (m == M_WAKE) {
        eyes = s.modeT < 1.0 ? (fract(s.modeT * 3.0) < 0.5 ? E_BLINK : E_NORMAL) : E_NORMAL;
        mouth = s.modeT < 1.2 ? MOUTH_OPEN : MOUTH_SMILE;
    } else if (m == M_STIR) {
        eyes = s.modeT < 1.1 ? E_NORMAL : E_BLINK;
        mouth = MOUTH_DOT;
    } else if (m == M_EVOLVE) {
        eyes = E_HAPPY; mouth = MOUTH_SMILE;
    }
    if (s.vel.y != 0.0 && (m == M_IDLE || m == M_WALK)) { eyes = E_WIDE; mouth = MOUTH_OPEN; }
    return ivec4(eyes, mouth, blush, tear);
}

int petFrame(State s, float t)
{
    int m = s.mode;
    if (m == M_SLEEP || m == M_NAP) return fract(t / 2.4) < 0.5 ? 1 : 0;
    if (m == M_WALK || m == M_STARTLE || m == M_PLAY && s.vel.x != 0.0) return int(mod(floor(s.pos.x * 0.6), 2.0));
    if (m == M_EAT) return fract(s.modeT * 4.0) < 0.5 ? 0 : 1;
    if (m == M_POOP || m == M_YAWN) return 1;
    if (s.vel.y != 0.0) return 0;
    if (s.landT < 0.12) return 1;
    return fract(t * (s.joy > 0.5 ? 0.9 : 0.6)) < 0.5 ? 0 : 1;
}

void drawPet(inout vec2 o, ivec2 c, State s, float t)
{
    int body = bodyIndex(s.stage, s.species);
    if (s.mode == M_EVOLVE && fract(s.modeT * 3.0) < 0.5) body = bodyIndex(s.stage + 1, s.species);
    int frame = petFrame(s, t);
    int id = body * 2 + frame;
    ivec3 m = SPR_META[id];
    int shake = s.mode == M_REFUSE ? (fract(s.modeT * 5.0) < 0.5 ? -1 : 1) : 0;
    ivec2 o2 = ivec2(int(floor(s.pos.x + 0.5)) + shake, int(floor(s.pos.y + 0.5)));
    int x = c.x - (o2.x - m.y / 2);
    int y = c.y - o2.y;
    if (x < -1 || y < -1 || x > m.y || y > m.z) return;
    bool flip = s.facing < 0.0;
    int sx = flip ? m.y - 1 - x : x;
    vec2 b = spr(id, ivec2(sx, y));
    if (b.y < 0.5) return;
    int row = m.z - 1 - y;
    ivec4 f = FACE[body];
    f.x += frame;
    f.w += frame;
    ivec4 e = expression(s, t);
    int lx = int(s.look.x * s.facing);
    int ly = -int(s.look.y);
    if (e.x != E_NORMAL) { lx = 0; ly = 0; }
    bool small = body == 0;
    float ink = b.x;
    ink = max(ink, eyesAt(sx, row, e.x, small, f, lx, ly));
    int mp = mouthPattern(e.y, body, s.mode);
    ivec3 mpat = MOUTH_PAT[mp];
    int mx = (MOUTH_C2[body] - mpat.y + 1) / 2 + (e.x == E_NORMAL ? lx : 0);
    ink = max(ink, pat(mpat, sx - mx, row - f.w));
    float glow = 0.4;
    if (ink < 0.5) {
        int ew = small ? 1 : 2;
        if (e.z > 0 && row == f.x + 2 && (sx == f.y - 1 || sx == f.z + ew)) { ink = 0.45; glow = 0.2; }
        if (e.w > 0) {
            int ty = f.x + 2 + int(fract(t * 0.6) * 4.0);
            if (sx == f.z + ew - 1 && row == ty && ty < f.w + 1) { ink = 1.0; }
        }
    }
    o = vec2(ink, ink * glow);
}

void drawEgg(inout vec2 o, ivec2 c, State s)
{
    float t = s.modeT;
    int wob = 0;
    if ((t > 1.2 && t < 1.8) || (t > 3.0 && t < 3.6) || t > 4.6) {
        float rate = t > 4.6 ? 7.0 : 4.0;
        wob = fract(t * rate) < 0.5 ? -1 : 1;
    }
    ivec2 base = ivec2(int(floor(s.pos.x + 0.5)) + wob, int(floor(s.pos.y + 0.5)));
    vec2 l = sprAt(SP_EGG, c, base, false);
    ivec3 m = SPR_META[SP_EGG];
    int x = c.x - (base.x - m.y / 2);
    int y = c.y - base.y;
    // Crack: zigzag across the egg, widening from the middle.
    if (t > 4.0 && l.y > 0.5) {
        float open = clamp((t - 4.0) / 2.6, 0.0, 1.0) * float(m.y) * 0.5 + 1.0;
        int zig = x - (x / 2) * 2;
        if (y == 7 + zig && abs(float(x) - float(m.y) * 0.5 + 0.5) < open) l.x = 1.0;
        if (y == 6 + zig + (zig == 0 ? 2 : 0) && abs(float(x) - float(m.y) * 0.5 + 0.5) < open) l.x = 0.0;
    }
    paint(o, l, 1.0, 0.5);
}

// Rounded box outline with filled interior; b = min corner, n = size.
vec2 box(ivec2 c, ivec2 b, ivec2 n)
{
    ivec2 p = c - b;
    if (p.x < 0 || p.y < 0 || p.x >= n.x || p.y >= n.y) return vec2(0.0);
    bool cx = p.x == 0 || p.x == n.x - 1;
    bool cy = p.y == 0 || p.y == n.y - 1;
    if (cx && cy) return vec2(0.0);
    return vec2((cx || cy) ? 1.0 : 0.0, 1.0);
}

int glyphFor(int b)
{
    if (b == BU_EXCL) return SP_EXCL;
    if (b == BU_QUEST) return SP_QUEST;
    if (b == BU_NOTE) return SP_NOTE;
    if (b == BU_FOOD) return SP_FOOD5;
    if (b == BU_SKULL) return SP_SKULL;
    if (b == BU_HEART) return SP_HO;
    if (b == BU_BULB) return SP_BULB;
    return SP_STINK;
}

void drawBubble(inout vec2 o, ivec2 c, State s, Grid g, int kind, ivec2 sz)
{
    float side = s.facing;
    ivec2 n = ivec2(9, 9);
    int bx = int(floor(s.pos.x + 0.5)) + (side > 0.0 ? sz.x / 2 - 1 : -sz.x / 2 - n.x + 1);
    int by = int(floor(s.pos.y + 0.5)) + sz.y + 2;
    bx = clamp(bx, 0, g.cols - n.x);
    by = min(by, g.rows - n.y);
    ivec2 b0 = ivec2(bx, by);
    vec2 l = box(c, b0, n);
    // Tail toward the pet.
    ivec2 tp = c - b0;
    int tx = side > 0.0 ? 1 : n.x - 2;
    if ((tp.y == -1 && tp.x == tx) || (tp.y == -2 && tp.x == tx - int(side))) l = vec2(1.0);
    if (l.y > 0.5 && l.x < 0.5) {
        int gid = glyphFor(kind);
        ivec3 m = SPR_META[gid];
        ivec2 q = tp - ivec2((n.x - m.y) / 2, (n.y - m.z) / 2);
        l.x = spr(gid, q).x;
    }
    paint(o, l, 1.0, 1.0);
}

void drawHearts(inout vec2 o, ivec2 c, State s, ivec2 sz, float t)
{
    for (int k = 0; k < 3; k++) {
        float a = s.heartT - (k == 1 ? 0.0 : 0.25 + 0.2 * float(k));
        if (a < 0.0 || a > 1.6) continue;
        float side = float(k) - 1.0;
        vec2 p = vec2(s.pos.x + side * (float(sz.x) * 0.5 + 3.0 + a * 2.0) + sin(a * 6.0 + float(k) * 2.0) * 0.8,
                      s.pos.y + float(sz.y) * (k == 1 ? 1.0 : 0.6) + 1.0 + a * (k == 1 ? 10.0 : 7.0));
        int id = k == 1 ? SP_HEART : SP_HS;
        paint(o, sprAt(id, c, ivec2(floor(p + 0.5)), false), 1.0, 1.0);
    }
}

void drawZz(inout vec2 o, ivec2 c, State s, ivec2 sz, float t)
{
    for (int k = 0; k < 3; k++) {
        float a = fract(t / 3.6 + float(k) / 3.0);
        vec2 p = vec2(s.pos.x + s.facing * (float(sz.x) * 0.25 + a * 15.0),
                      s.pos.y + float(sz.y) - 1.0 + a * 21.0);
        int id = a > 0.5 ? SP_ZBIG : SP_ZSMALL;
        if (a < 0.92) paint(o, sprAt(id, c, ivec2(floor(p + 0.5)), false), 1.0, 1.0);
    }
}

void drawSparkles(inout vec2 o, ivec2 c, State s, ivec2 sz, float age)
{
    if (age > 1.6) return;
    for (int k = 0; k < 5; k++) {
        float an = float(k) * 1.2566 + age * 1.5;
        float rr = float(sz.x) * 0.6 + 2.0 + age * 6.0;
        vec2 p = s.pos + vec2(0.0, float(sz.y) * 0.45) + rr * vec2(cos(an), sin(an) * 0.8);
        if (fract(age * 6.0 + float(k) * 0.37) < 0.6) paint(o, sprAt(SP_SPARKLE, c, ivec2(floor(p + 0.5)) - ivec2(0, 2), false), 1.0, 1.0);
    }
}

// Status panel: clock, then four needs with four hearts each.
void drawStatus(inout vec2 o, ivec2 c, State s, Grid g, ivec2 sz, float hr)
{
    ivec2 n = ivec2(36, 36);
    int px = int(floor(s.pos.x + 0.5));
    int bx = px + sz.x / 2 + 4;
    if (bx + n.x > g.cols) bx = px - sz.x / 2 - 4 - n.x;
    bx = clamp(bx, 0, max(g.cols - n.x, 0));
    int by = clamp(int(floor(s.pos.y + 0.5)), 0, max(g.rows - n.y, 0));
    ivec2 b0 = ivec2(bx, by);
    vec2 l = box(c, b0, n);
    if (l.y < 0.5) return;
    if (l.x < 0.5) {
        ivec2 p = c - b0 - ivec2(3, 3);   // inner origin, bottom-left
        int top = n.y - 7;                 // inner height
        // Clock row
        int ry = p.y - (top - 5);
        if (ry >= 0 && ry < 5) {
            float mins = floor(hr * 60.0);
            int hh = int(mins / 60.0);
            int mm = int(mins - float(hh) * 60.0);
            int dig[4];
            dig[0] = hh / 10; dig[1] = hh - (hh / 10) * 10; dig[2] = mm / 10; dig[3] = mm - (mm / 10) * 10;
            int x = p.x - 5;
            for (int k = 0; k < 4; k++) {
                int dx = x - k * 4 - (k >= 2 ? 3 : 0);
                if (dx >= 0 && dx < 3) l.x = float((DIGIT[dig[k]] >> ((4 - ry) * 3 + dx)) & 1);
            }
            if (x == 8 && (ry == 1 || ry == 3) && fract(iDate.w) < 0.5) l.x = 1.0;
            if (s.sick > 0.0) l.x = max(l.x, spr(SP_SKULL, ivec2(p.x - 24, ry)).x);
        }
        // Needs
        for (int k = 0; k < 4; k++) {
            int yy = p.y - (top - 5 - 3 - 6 * (k + 1) + 1);
            if (yy < 0 || yy >= 5) continue;
            float v = k == 0 ? s.food : (k == 1 ? s.joy : (k == 2 ? s.energy : 1.0 - float(poopCount(s)) * 0.25));
            int icon = k == 0 ? SP_FOOD5 : (k == 1 ? SP_JOY5 : (k == 2 ? SP_NRG5 : SP_CLN5));
            l.x = max(l.x, spr(icon, ivec2(p.x, yy)).x);
            int filled = int(ceil(v * 4.0 - 0.01));
            for (int h = 0; h < 4; h++) {
                int hx = p.x - 7 - h * 6;
                if (hx >= 0 && hx < 5) l.x = max(l.x, spr(h < filled ? SP_HS : SP_HO, ivec2(hx, yy)).x);
            }
        }
    }
    paint(o, l, 1.0, 1.0);
}

void drawDecor(inout vec2 o, ivec2 c, Grid g, float hr, float t)
{
    float rows = float(g.rows);
    float cols = float(g.cols);
    // Ground: a line under the floor, pebbles below it.
    if (c.y == FLOOR - 1) {
        o = vec2(0.24, 0.1);
        return;
    }
    if (c.y < FLOOR - 1) {
        if (hash12(vec2(c) * 1.3 + 7.0) < 0.06) o = vec2(0.2, 0.06);
        return;
    }
    // Grass tufts along the floor.
    int blk = c.x / 13;
    if (hash11(float(blk) * 3.7 + 1.3) < 0.4 && c.y < FLOOR + 2) {
        int x0 = blk * 13 + 2 + int(hash11(float(blk) * 9.1) * 8.0);
        vec2 l = sprAt(SP_TUFT, c, ivec2(x0 + 2, FLOOR), false);
        if (l.x > 0.5) { o = vec2(0.26, 0.08); return; }
    }
    // Sun by day, moon and stars by night.
    bool night = nightAt(hr);
    float ph = night ? fract((hr - BEDTIME + 24.0) / max(24.0 - BEDTIME + WAKE_UP, 1.0)) : clamp((hr - WAKE_UP) / max(BEDTIME - WAKE_UP, 1.0), 0.0, 1.0);
    vec2 sky = vec2(mix(0.06, 0.94, ph) * cols, rows - 7.0 - (1.0 - sin(ph * 3.14159)) * rows * 0.3);
    vec2 l = sprAt(night ? SP_MOON : SP_SUN, c, ivec2(floor(sky + 0.5)) - ivec2(0, 4), false);
    if (l.x > 0.5) { o = vec2(0.32, 0.9); return; }
    if (night && float(c.y) > rows * 0.45) {
        float h = hash12(vec2(c) + 17.0);
        if (h < 0.012 && fract(t * 0.3 + h * 77.0) < 0.8) { o = vec2(0.0, 0.6 + 0.4 * fract(h * 131.0)); return; }
    }
    // Clouds drift with one wind speed, evenly spaced, so they never overlap.
    int nc = 2 + (g.cols * g.rows) / 3400;
    float span = cols + 30.0;
    for (int k = 0; k < 8; k++) {
        if (k >= nc) break;
        float fk = float(k);
        float x = mod((fk + 0.4 * hash11(fk * 1.7 + 0.4)) * span / float(nc) + t * 0.35, span) - 15.0;
        float y = rows - 5.0 - fract(fk * 0.618 + 0.2) * rows * 0.36;
        vec2 q = sprAt(SP_CLOUD, c, ivec2(floor(vec2(x, y) + 0.5)), false);
        if (q.y > 0.5) { o = vec2(q.x * 0.26, q.x * 0.1); return; }
    }
}

vec2 scene(ivec2 c, State s, Grid g)
{
    float t = iDate.w;
    float hr = clockHours();
    vec2 o = vec2(0.0);
    drawDecor(o, c, g, hr, t);

    ivec2 sz = petSize(s);
    int px = int(floor(s.pos.x + 0.5));
    int py = int(floor(s.pos.y + 0.5));

    // Food beside the pet, eaten from the side nearest to it.
    if (s.mode == M_EAT && s.modeT < EAT_TIME - 0.5) {
        int id = s.foodKind < 0.5 ? SP_ONIGIRI : (s.foodKind < 1.5 ? SP_CAKE : SP_BOWL);
        ivec3 m = SPR_META[id];
        ivec2 base = ivec2(px + int(s.facing) * (sz.x / 2 + m.y / 2 + 1), py);
        vec2 l = sprAt(id, c, base, false);
        int bites = int(s.modeT / ((EAT_TIME - 0.6) / 3.0));
        int lx = c.x - (base.x - m.y / 2);
        int fromPet = s.facing > 0.0 ? lx : m.y - 1 - lx;
        if (fromPet < bites * m.y / 3) l = vec2(0.0);
        paint(o, l, 1.0, 0.4);
    }
    if (s.mode == M_MEDS && s.modeT < 1.6) {
        ivec2 base = ivec2(px + int(s.facing) * (sz.x / 2 + 4), py + sz.y / 2 + int(s.modeT * 2.0));
        paint(o, sprAt(SP_PILL, c, base, false), 1.0, 0.5);
    }

    // Ball.
    if (s.ballT > 0.0) {
        ivec2 bp = ivec2(floor(s.ballPos + 0.5));
        ivec2 q = c - (bp - ivec2(2, 2));
        bool turn = mod(floor(s.ballPos.x * 0.5), 2.0) > 0.5;
        if (turn) q = q.yx;
        paint(o, spr(SP_BALL, q), 1.0, 0.5);
    }

    if (s.stage == ST_EGG) drawEgg(o, c, s);
    else drawPet(o, c, s, t);

    // Poops, in front of the pet.
    for (int k = 0; k < 4; k++) {
        float px = s.poops[k];
        if (px < 0.0) continue;
        int fr = fract(t * 1.2 + float(k) * 0.3) < 0.5 ? SP_POOPA : SP_POOPB;
        ivec2 base = ivec2(int(floor(px + 0.5)), FLOOR);
        paint(o, sprAt(fr, c, base, false), 1.0, 0.35);
        if (s.dirtyT > 8.0) {
            bool flip = fract(t * 1.6 + float(k) * 0.5) < 0.5;
            paint(o, sprAt(SP_STINK, c, base + ivec2(0, 8), flip), 0.8, 0.3);
        }
    }

    // Effects above the pet.
    bool asleep = s.mode == M_SLEEP || s.mode == M_NAP;
    if (asleep) drawZz(o, c, s, sz, t);
    drawHearts(o, c, s, sz, t);
    drawSparkles(o, c, s, sz, s.evolveT);
    if (s.mode == M_EVOLVE) drawSparkles(o, c, s, sz, fract(s.modeT / 1.3) * 1.3);
    int bub = BU_NONE;
    if (s.bubbleT < 2.0) bub = int(s.bubble + 0.5);
    else if (!asleep && s.stage > ST_EGG && fract(t / 9.0) < 0.28) bub = topNeed(s, hr);
    if (bub == BU_POOP) bub = BU_NONE;
    if (bub != BU_NONE) drawBubble(o, c, s, g, bub, sz);

    // Flush: a band of rippling water sweeping right to left, spray behind.
    if (s.flushT >= 0.0) {
        float y = float(c.y);
        float d = float(c.x) - (flushX(s.flushT, g) + 1.5 * sin(y * 0.45 + s.flushT * 8.0));
        int ph = int(floor(s.flushT * 8.0));
        if (abs(d) < 0.7) o = vec2(1.0, 1.0);
        else if (d > 0.7 && d < 4.5) o = (c.x + c.y + ph) - ((c.x + c.y + ph) / 2) * 2 == 0 ? vec2(0.6, 0.6) : vec2(0.0);
        else if (abs(d - 4.8) < 0.5) o = vec2(0.6, 0.6);
        else if (d > 5.3 && d < 12.0 && hash12(vec2(c) + float(ph)) < 0.1 - d * 0.007) o = vec2(0.5, 0.5);
    }

    // Status panel on hover or from the status icon.
    if (s.statusT > 0.0 || s.hoverT > 0.5) drawStatus(o, c, s, g, sz, hr);

    // Tap ripple.
    if (s.tapT < 0.35) {
        float rr = 1.0 + s.tapT * 12.0;
        float d = length(vec2(c) - floor(s.tapPos + 0.5));
        if (abs(d - rr) < 0.55) o = vec2(0.8, 0.8);
    }
    return o;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 c = ivec2(fragCoord);
    int stateRow = int(iResolution.y) - 1;
    Grid g = makeGrid(iResolution.xy);

    if (c.y == stateRow) {
        if (c.x >= NSTATE) { fragColor = vec4(0.0); return; }
        State s = load();
        if (iFrame == 0 || s.inited < 0.5) initState(s, g);
        else update(s, g);
        fragColor = packState(s, c.x);
        return;
    }
    if (c.x >= g.cols || c.y >= g.rows) {
        fragColor = vec4(0.0);
        return;
    }
    if (iSubstep < iSubsteps - 1) {
        fragColor = texelFetch(iChannel0, c, 0);
        return;
    }
    State s = load();
    if (s.inited < 0.5) {
        fragColor = vec4(0.0);
        return;
    }
    fragColor = vec4(scene(c, s, g), 0.0, 1.0);
}
