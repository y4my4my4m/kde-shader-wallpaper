// Zen Garden — state layout and helpers shared by Buffer A and the image pass.
//
// Units: H = screen height. A point in H units has x in [0, aspect] and y in
// [0, 1], origin bottom-left. Record rects are stored as screen fractions so
// each pass places them exactly at its own resolution.
//
// Buffer A, state texels (x < 64, rows 0..3), advanced once per frame:
//   (2r, 0)        record r: rect x, y, w, h as screen fractions
//   (2r + 1, 0)    record r: x kind, y seconds in this state, z lap start as
//                  a fraction of the perimeter, w aux (rock: seconds without
//                  a matching window; lifted: reveal fraction when lifted)
//   (0, 1)         x clock (s, mod CLOCK_PERIOD), y gardener progress
//                  (bands, mod band count), z 1 while a button is held, w 1
//                  once written
//   (1, 1)         press: xy start (screen fractions), z travel (H), w s held
//   (2, 1)         x 1 when the press began on bare gravel, y loop bound for
//                  records (highest used index + 2)
//   (4 + g, 1)     gardener g: x visibility 0..1
//   (16 + i, 1)    window i: rect last frame (screen fractions)
//   (32 + i, 1)    window i: x seconds at rest
//   (r, 2)         record r: x seconds since a disturbance was seen in its
//                  zone (0 none), y 1 for a re-rake lap over standing rings
//   (32 + 2j, 2)   leaf slot j: xy position (H), z height 0..1, w opacity
//                  (0 empty)
//   (33 + 2j, 2)   leaf slot j: x angle, y tumble, z size (H), w seed
//   (tx + 8ty, 3)  tile (tx, ty) of an 8 x 8 screen grid: x bit j set when
//                  leaf j or its shadow may reach the tile, y bits of records
//                  0..15 and z of records 16..31 whose drawing may reach it
// Buffer A, every other texel: the gravel field, advanced every substep
//   x smoothed 0..1 (0 crisp pattern, 1 flat), y furrow strength 0..1,
//   z furrow lateral offset (H), w footprint imprint 0..1, 2 under a live
//   rock.
// All zero is a freshly raked garden.

const int NREC = 32;
const int NWIN = 16;
const int ROW_REC = 0;
const int ROW_GLOB = 1;
const int ROW_EXT = 2;
const int ROW_TILE = 3;
const int STATE_ROWS = 4;
const int TILES = 8;

const int NLEAF = 14;
const int LEAF_X = 32;

const int K_FREE = 0;
const int K_ROCK = 1;
const int K_STONE = 2;
const int K_FADE_ROCK = 3;
const int K_FADE_STONE = 4;

const float CLOCK_PERIOD = 3600.0;   // s; leaf and flake cycles divide it
const float SPACING_BASE = 0.0135;   // H, rake line period at spacing 1
const float ROCK_GAP     = 0.55;     // spacings from a window edge to the first crest
const float STONE_GAP    = 0.35;     // spacings from a stone edge to the first crest
const int   STONE_RINGS  = 3;
const int   RAKE_TINES   = 7;        // gardener rake; one band is this many lines
const int   HAND_TINES   = 4;
const float HAND_TINE    = 0.62;     // hand rake tine pitch, spacings
const float GRACE        = 1.0;      // s a rock waits for its window before fading
const float REST_TIME    = 0.35;     // s a window rests before it is set down
const float FADE_ROCK    = 3.5;      // s, rings of a lifted rock smooth out
const float FADE_STONE   = 2.5;      // s
const float STONE_FALL   = 0.32;     // s from click to impact
const float STONE_RIPPLE = 1.7;      // s for the rings to spread out
const float LAP_SPEED    = 0.85;     // H/s, rake head along the ring band
const float GARDENER_V   = 0.055;    // H/s at re-rake speed 1
const float RELAP_DELAY  = 30.0;     // s from a disturbance in a ring zone to its re-rake
const float BAND_MARGIN  = 0.35;     // H the gardener walks past each screen edge
const float WIN_TOL      = 0.004;    // H, a window this close to a rock's rect still holds it
const float PI = 3.14159265;
const float TAU = 6.28318531;

float spacing() { return SPACING_BASE * LINE_SPACING; }

// ------------------------------------------------------------- hashing

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

vec2 hash22(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), w.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), w.x), w.y);
}

// ------------------------------------------------------------- geometry

// Signed distance to a box of half size b with corner radius r, and its
// gradient (iq, sdgBox).
vec3 sdgRoundBox(vec2 q, vec2 b, float r)
{
    vec2 w = abs(q) - (b - r);
    vec2 s = vec2(q.x < 0.0 ? -1.0 : 1.0, q.y < 0.0 ? -1.0 : 1.0);
    float g = max(w.x, w.y);
    vec2 m = max(w, 0.0);
    float l = length(m);
    vec2 grad = s * (g > 0.0 ? m / max(l, 1e-7) : (w.x > w.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0)));
    return vec3((g > 0.0 ? l : g) - r, grad);
}

// Arc position around a box of half size b, measured on the path at
// distance dm from it, counter-clockwise from (+b.x, 0); corners count
// angle * dm. x: arc position, y: perimeter, z: arc length per unit of x at
// the point's own distance from the box.
vec3 perimS(vec2 q, vec2 b, float dm)
{
    vec2 a = abs(q);
    vec2 u = a - min(a, b);
    float qa = 0.5 * PI * dm;
    float lq = b.x + b.y + qa;
    float s1;
    float sc = 1.0;
    if (u.x > 0.0 && u.y > 0.0) {
        s1 = b.y + atan(u.y, u.x) * dm;
        sc = length(u) / dm;
    } else if (u.x > 0.0 || (u.y <= 0.0 && b.x - a.x < b.y - a.y)) {
        s1 = a.y;
    } else {
        s1 = b.y + qa + (b.x - a.x);
    }
    float s = q.y >= 0.0 ? (q.x >= 0.0 ? s1 : 2.0 * lq - s1)
                         : (q.x < 0.0 ? 2.0 * lq + s1 : 4.0 * lq - s1);
    return vec3(s, 4.0 * lq, sc);
}

// Inverse of perimS on its own path: xy point relative to the box centre,
// zw counter-clockwise unit tangent.
vec4 pathAt(float s, vec2 b, float dm)
{
    float qa = 0.5 * PI * dm;
    float lq = b.x + b.y + qa;
    s = mod(s, 4.0 * lq);
    float quad = floor(s / lq);
    float s1 = s - quad * lq;
    if (quad == 1.0 || quad == 3.0) s1 = lq - s1;
    vec2 p;
    vec2 t;
    if (s1 < b.y) {
        p = vec2(b.x + dm, s1);
        t = vec2(0.0, 1.0);
    } else if (s1 < b.y + qa) {
        float an = (s1 - b.y) / dm;
        p = b + dm * vec2(cos(an), sin(an));
        t = vec2(-sin(an), cos(an));
    } else {
        p = vec2(b.x - (s1 - b.y - qa), b.y + dm);
        t = vec2(-1.0, 0.0);
    }
    if (quad == 1.0) return vec4(-p.x, p.y, t.x, -t.y);
    if (quad == 2.0) return vec4(-p, -t);
    if (quad == 3.0) return vec4(p.x, -p.y, -t.x, t.y);
    return vec4(p, t);
}

// ------------------------------------------------------------- records

struct Rec {
    vec4 rect;   // screen fractions
    int kind;
    float t;     // s in this state
    float s0;    // lap start, fraction of the perimeter
    float aux;
    float relap; // 1 for a re-rake lap over standing rings
};

// Ring zone of a record in H units. d below is the distance to the rock's
// rounded rect; crests lie at d = gap + n * spacing up to d = outer.
struct Zone {
    vec2 c;      // centre
    vec2 b;      // half size
    float rc;    // corner radius
    float gap;
    float outer;
    float dm;    // lap path: distance from the core box (b - rc)
};

bool isLive(int k) { return k == K_ROCK || k == K_STONE; }
bool isStoneKind(int k) { return k == K_STONE || k == K_FADE_STONE; }

Rec decodeRec(vec4 a, vec4 b, vec4 e)
{
    Rec r;
    r.rect = a;
    r.kind = int(b.x + 0.5);
    r.t = b.y;
    r.s0 = b.z;
    r.aux = b.w;
    r.relap = e.y;
    return r;
}

Zone zoneOf(Rec r, float aspect)
{
    Zone z;
    float S = spacing();
    vec2 lo = r.rect.xy * vec2(aspect, 1.0);
    vec2 sz = r.rect.zw * vec2(aspect, 1.0);
    z.b = 0.5 * sz;
    z.c = lo + z.b;
    if (isStoneKind(r.kind)) {
        z.rc = min(z.b.x, z.b.y);
        z.gap = STONE_GAP * S;
        z.outer = z.gap + float(STONE_RINGS) * S;
    } else {
        z.rc = min(0.3 * S, min(z.b.x, z.b.y));
        z.gap = ROCK_GAP * S;
        z.outer = z.gap + float(WINDOW_RINGS) * S;
    }
    z.dm = z.rc + 0.5 * (z.gap + z.outer);
    return z;
}

float zonePerimeter(Zone z)
{
    vec2 bc = z.b - z.rc;
    return 4.0 * (bc.x + bc.y) + TAU * z.dm;
}

float lapTime(Zone z)
{
    return clamp(zonePerimeter(z) / LAP_SPEED, 2.4, 4.0);
}

// Front of a stone's spreading rings, distance from the stone's edge.
float stoneFront(Zone z, float t)
{
    float k = clamp((t - STONE_FALL) / STONE_RIPPLE, 0.0, 1.0);
    k = 1.0 - (1.0 - k) * (1.0 - k);
    return mix(-spacing(), z.outer + spacing(), k);
}

// Lap progress 0..1 of a live record: rock laps run around the zone, stone
// rings spread outward.
float lapProgress(Rec r, Zone z)
{
    if (r.kind == K_STONE) return clamp((r.t - STONE_FALL) / STONE_RIPPLE, 0.0, 1.0);
    return clamp(r.t / lapTime(z), 0.0, 1.0);
}

// How much of a live record's rings stand at q (relative to the zone
// centre), d its distance to the rect. Reveal is soft over 0.4 spacing
// behind the front.
float revealAt(Rec r, Zone z, vec2 q, float d)
{
    if (r.relap > 0.5) return 1.0;
    float S = spacing();
    if (r.kind == K_STONE) {
        float f = stoneFront(z, r.t);
        return 1.0 - smoothstep(f - 0.5 * S, f, d);
    }
    float k = r.t / lapTime(z);
    if (k >= 1.0) return 1.0;
    vec3 ps = perimS(q, z.b - z.rc, z.dm);
    float srel = mod(ps.x - r.s0 * ps.y, ps.y);
    float front = k * ps.y;
    return clamp((front - srel) * ps.z / (0.4 * S), 0.0, 1.0);
}

// Farthest a record's drawing reaches beyond its rect, H: rings, a rock's
// ground shadow, a lap rake's handle, a falling or lifted stone's shadow.
float recordReach(Rec r, Zone z)
{
    float reach = max(z.outer + 2.0 * spacing(), r.kind == K_ROCK ? 0.17 : 0.0);
    if (r.kind == K_ROCK && r.t < lapTime(z) + 0.6) reach = max(reach, 0.25 + z.outer);
    if ((r.kind == K_STONE && r.t < STONE_FALL + 0.1) || r.kind == K_FADE_STONE) reach = max(reach, 0.3);
    return reach;
}

// ------------------------------------------------------------- the pattern

// Line ordinate with the gentle sway of the rake lines, H units.
float lineY(vec2 p)
{
    float S = spacing();
    return p.y + WAVE * S * (1.4 * sin(p.x * 4.1 + 0.8) + 0.7 * sin(p.x * 9.3 + p.y * 1.7 + 2.0));
}

float lineYdx(vec2 p)
{
    float S = spacing();
    return WAVE * S * (1.4 * 4.1 * cos(p.x * 4.1 + 0.8) + 0.7 * 9.3 * cos(p.x * 9.3 + p.y * 1.7 + 2.0));
}

// ------------------------------------------------------------- gardener

float bandHeight() { return float(RAKE_TINES) * spacing(); }
float bandCount() { return ceil(1.0 / bandHeight()); }
int gardenerCount(float aspect) { return int(clamp(floor(aspect * 1.1 + 0.5), 1.0, 4.0)); }
float bandRate(float aspect) { return GARDENER_V * RERAKE_SPEED / (aspect + 2.0 * BAND_MARGIN); }

// Gardener g from global progress P: x band index, y head x (H), z walking
// direction (+1 right, -1 left).
vec3 gardenerAt(int g, float P, float aspect)
{
    float nb = bandCount();
    float pg = mod(P + float(g) * nb / float(gardenerCount(aspect)), nb);
    float band = floor(pg);
    float f = pg - band;
    float span = aspect + 2.0 * BAND_MARGIN;
    float dir = mod(band, 2.0) < 0.5 ? 1.0 : -1.0;
    float x = dir > 0.0 ? -BAND_MARGIN + f * span : aspect + BAND_MARGIN - f * span;
    return vec3(band, x, dir);
}

// ------------------------------------------------------------- seasons

int seasonNow()
{
    if (SEASON > 0) return SEASON;
    int m = int(iDate.y + 0.5);
    if (m >= 3 && m <= 5) return 1;
    if (m >= 6 && m <= 8) return 2;
    if (m >= 9 && m <= 11) return 3;
    return 4;
}

// Falling leaves, petals or flakes: slot j follows a fixed schedule on the
// clock. Buffer A evaluates the slots and their tile masks once per frame;
// the image pass reads them back.
struct Leaf {
    vec2 pos;     // H
    float z;      // height above ground 0..1
    float ang;
    float tumble; // across-scale while in the air
    float a;
    float seed;
    float size;   // H
};

int leafSlots(int season)
{
    if (season == 1) return 14;
    if (season == 2) return 3;
    if (season == 3) return 8;
    return 14;
}

// Slot j of the season's falling things; false while the slot is empty.
bool leafAt(int j, int season, float clock, float aspect, out Leaf lf)
{
    float tc = season == 1 ? 60.0 : (season == 2 ? 120.0 : (season == 3 ? 90.0 : 30.0));
    float tf = season == 1 ? 13.0 : (season == 2 ? 9.0 : (season == 3 ? 15.0 : 18.0));
    float t = clock + hash11(float(j) * 13.7 + float(season)) * tc;
    float cyc = floor(t / tc);
    float tau = t - cyc * tc;
    // Cycle number mod the clock period keeps each leaf across the wrap.
    float seed = hash12(vec2(float(j) * 1.37, mod(cyc, CLOCK_PERIOD / tc) + float(season) * 17.0));
    lf.seed = seed;
    if (hash11(seed * 91.0) < (season == 2 ? 0.45 : 0.25)) return false;
    vec2 land = vec2(hash11(seed * 31.7) * aspect, 0.08 + 0.88 * hash11(seed * 47.3));
    vec2 wind = vec2(0.020, -0.005) * (0.7 + 0.6 * hash11(seed * 5.3));
    float u = clamp(tau / tf, 0.0, 1.0);
    float zz = pow(1.0 - u, 1.3);
    float rem = tf - min(tau, tf);
    vec2 sway = vec2(-wind.y, wind.x) * 8.0 * sin(tau * 1.3 + seed * 20.0) * zz;
    lf.pos = land - wind * rem * (0.6 + 0.4 * zz) + sway;
    lf.z = zz;
    lf.ang = seed * TAU + (season == 4 ? 0.0 : 0.9 * rem * (0.5 + seed));
    lf.tumble = mix(1.0, 0.35 + 0.65 * abs(cos(tau * 1.9 + seed * 9.0)), smoothstep(0.0, 0.15, zz));
    lf.a = smoothstep(0.0, 1.5, tau);
    float life = season == 4 ? tf + 2.5 : tc - 0.5;
    if (tau > tf) {
        float rest = tau - tf;
        if (season == 4) {
            lf.a *= 1.0 - smoothstep(0.0, 2.5, rest);
        } else {
            float k = max(rest - (tc - 6.0 - tf), 0.0);
            lf.pos += wind * k * k * 0.25;
            lf.ang += k * k * 0.15;
            lf.a *= 1.0 - smoothstep(0.0, 5.5, k);
        }
    }
    if (tau > life) return false;
    float base = season == 1 ? 0.0085 : (season == 2 ? 0.014 : (season == 3 ? 0.0155 : 0.0040));
    lf.size = base * (0.8 + 0.4 * hash11(seed * 3.9)) * (1.0 + 0.4 * zz);
    return lf.a > 0.003;
}

// ------------------------------------------------------------- windows

vec4 windowFrac(int i, vec2 res)
{
    vec4 r = iWindowRects[i];
    return vec4(r.xy / res, r.zw / res);
}

bool usableWindow(vec4 wf)
{
    return wf.z > 0.012 && wf.w > 0.02;
}
