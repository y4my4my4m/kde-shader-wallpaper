// Neko — layout, state layout and helpers shared by Buffer A and the image
// pass.
//
// Lengths are in H units: pixel position / iResolution.y of the pass. x runs
// 0..aspect, y 0..1, GL origin bottom left. Buffer A runs on a smaller grid
// of the same aspect, except that its width never drops below 64 texels; the
// image pass rescales state x by its aspect over the grid's. The cat's
// position is the centre of its feet. Speeds in H/s, times in seconds.
//
// Buffer A, row 0, texel k:
//   0  T_CAT    position xy, velocity xy
//   1  T_MODE   mode (M_*), time in mode, facing (+1 right), support (0 floor,
//               1 window top, -1 airborne)
//   2  T_ANIM   frame (F_*), eye glyph (EYE_*), body roll (rad), roll rate
//   3  T_GOAL   goal x, goal surface y, goal kind (G_*), route (R_*)
//   4  T_PLAN   take-off x, landing x, landing y (peeking: edge x, side),
//               taps made (knocking) or 1 once the bat landed (yarn)
//   5  T_MOUSE  cursor xy last step, time since it moved, petting time
//   6  T_YARN   position xy, velocity xy
//   7  T_YARN2  age (0 = none), roll angle, time since last touched, resting
//   8  T_OBJ    position xy (bottom centre), velocity xy
//   9  T_OBJ2   kind (O_*), stage (0 on a window, 1 falling, 2 landed),
//               time in stage, angle
//   10 T_FX     heart clock, heart stop (clock value, -1 = emitting), bubble
//               age, bubble kind (0 meow, 1 heart)
//   11 T_INPUT  button held last step, cursor travel while asleep, unused,
//               "!" age
//   12 T_MISC   random counter, 1 once initialised, decision countdown, 1
//               after the first outing
//   13 T_WIN    time the support has been moving, time covered by a window,
//               standing span x0, x1
//   14 T_LAND   time since landing, landing speed, dust xy
//   15 T_CLOCK  meal key done (-1 = none), meal stage, time in stage, kibble
//   16 T_AUX    shadow surface y, unused, object's window x0, x1
//   17 T_SHARD  mug impact xy, impact age (-1 = none), unused
//   18 T_RIDE   support velocity xy (smoothed), time since an object was
//               put out, last autonomous choice

const int NSTATE = 19;
const int T_CAT = 0;
const int T_MODE = 1;
const int T_ANIM = 2;
const int T_GOAL = 3;
const int T_PLAN = 4;
const int T_MOUSE = 5;
const int T_YARN = 6;
const int T_YARN2 = 7;
const int T_OBJ = 8;
const int T_OBJ2 = 9;
const int T_FX = 10;
const int T_INPUT = 11;
const int T_MISC = 12;
const int T_WIN = 13;
const int T_LAND = 14;
const int T_CLOCK = 15;
const int T_AUX = 16;
const int T_SHARD = 17;
const int T_RIDE = 18;

const int M_SIT = 0;
const int M_WALK = 1;
const int M_RUN = 2;
const int M_CROUCH = 3;
const int M_AIR = 4;
const int M_LAND = 5;
const int M_WASH = 6;
const int M_SCRATCH = 7;
const int M_YAWN = 8;
const int M_SLEEP = 9;
const int M_STARTLE = 10;
const int M_PURR = 11;
const int M_MEOW = 12;
const int M_BAT = 13;
const int M_LOAF = 14;
const int M_PEEK = 15;
const int M_STRETCH = 16;
const int M_RIDE = 17;
const int M_KNOCK = 18;
const int M_EAT = 19;

const int G_NONE = 0;
const int G_CURSOR = 1;
const int G_YARN = 2;
const int G_KNOCK = 3;
const int G_SPOT = 4;
const int G_BASKET = 5;
const int G_BOWL = 6;
const int G_PEEK = 7;
const int G_NAP = 8;

const int R_WALK = 0;   // same surface: walk or run there
const int R_UP = 1;     // run to the take-off point, crouch, leap up
const int R_DOWN = 2;   // run to the edge, hop down

// Sprite frames, eye glyphs and props: indices into the tables in neko.frag.
const int F_SIT = 0;
const int F_SIT_FLICK = 1;
const int F_PURR = 2;
const int F_MEOW = 3;
const int F_YAWN = 4;
const int F_STAND = 5;
const int F_WALK1 = 6;
const int F_WALK2 = 7;
const int F_WALK3 = 8;
const int F_WALK4 = 9;
const int F_RUN1 = 10;
const int F_RUN2 = 11;
const int F_RUN3 = 12;
const int F_RUN4 = 13;
const int F_CROUCH1 = 14;
const int F_CROUCH2 = 15;
const int F_LEAP = 16;
const int F_FALL = 17;
const int F_SITP = 18;
const int F_BAT1 = 19;
const int F_BAT2 = 20;
const int F_SCRATCH1 = 21;
const int F_SCRATCH2 = 22;
const int F_WASH1 = 23;
const int F_WASH2 = 24;
const int F_LOAF = 25;
const int F_SLEEP1 = 26;
const int F_SLEEP2 = 27;
const int F_STARTLE = 28;
const int F_STRETCH = 29;
const int F_EAT1 = 30;
const int F_EAT2 = 31;
const int EYE_OPEN = 0;
const int EYE_BLINK = 1;
const int EYE_HAPPY = 2;
const int EYE_SLEEP = 3;
const int EYE_HALF = 4;
const int EYE_WIDE = 5;
const int P_HEART = 0;
const int P_Z = 1;
const int P_EXCL = 2;
const int P_BUBBLE_MEOW = 3;
const int P_BUBBLE_HEART = 4;
const int P_MUG = 5;
const int P_SHARD1 = 6;
const int P_SHARD2 = 7;
const int P_SHARD3 = 8;
const int P_PENCIL = 9;

const int O_NONE = 0;
const int O_MUG = 1;
const int O_PENCIL = 2;

// Scene, H units.
const float FLOOR_Y = 0.062;      // feet on the floor
const float SPRITE_PX = 1.0 / 340.0; // sprite pixel at CAT_SIZE 1, shorter sides
const float GRAVITY = 3.2;        // H/s^2
const float YARN_R = 4.5;         // yarn ball radius, sprite pixels

// Local clock, hours.
const float BEDTIME = 22.0;
const float WAKE_UP = 7.0;
const float BREAKFAST = 7.5;
const float DINNER = 18.5;
const float MEAL_HOURS = 1.0;

// Sprite pixel, H units: 1/340 of the shorter screen side at CAT_SIZE 1.
float spx() { return SPRITE_PX * CAT_SIZE * min(iResolution.x / iResolution.y, 1.0); }

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

float clockHours() { return mod(iDate.w / 3600.0, 24.0); }

bool nightAt(float h) { return h >= BEDTIME || h < WAKE_UP; }

// Meal index (0 breakfast, 1 dinner) when h lies in a mealtime, else -1.
int mealAt(float h)
{
    if (h >= BREAKFAST && h < BREAKFAST + MEAL_HOURS) return 0;
    if (h >= DINNER && h < DINNER + MEAL_HOURS) return 1;
    return -1;
}

// Room furniture, H units: bowl, basket and lamp centres on the floor.
float bowlX(float aspect) { return 0.26 * min(aspect, 1.0); }
float basketX(float aspect) { return aspect - 0.20 * min(aspect, 1.0); }
float lampX(float aspect) { return aspect - 0.37 * min(aspect, 1.0); }

// Window i in H units, (x0, y0, x1, y1), between last frame (f = 0) and this
// frame (f = 1). A resize jumps straight to the new rect.
vec4 winAt(int i, float f)
{
    vec4 c = iWindowRects[i];
    vec4 p = iWindowRectsPrev[i];
    if (p.z < 1.0 || abs(p.z - c.z) > 0.5 || abs(p.w - c.w) > 0.5) p = c;
    vec4 r = mix(p, c, f);
    return vec4(r.xy, r.xy + r.zw) / iResolution.y;
}

bool winValid(int i) { return iWindowRects[i].z >= 1.0 && iWindowRects[i].w >= 1.0; }

// True when H-unit point p lies inside a window.
bool coveredAt(vec2 p)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (!winValid(i)) continue;
        vec4 r = winAt(i, 1.0);
        if (p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w) return true;
    }
    return false;
}

bool cursorOnScreen()
{
    return (iMouse.x > 1.0 || iMouse.y > 1.0) && iMouse.x < iResolution.x && iMouse.y < iResolution.y;
}
