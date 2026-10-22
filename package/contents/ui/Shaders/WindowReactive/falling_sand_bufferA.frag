// Falling Sand — Buffer A: the cellular automaton, input and ambient events.
// @channels self
//
// Cell encoding and state texels are in falling_sand_common.frag.
//
// Each substep is one Margolus step: the grid is cut into 2x2 blocks whose
// origin shifts by (1, 1) on alternate substeps (parity of the substep
// counter in state texel 0). Every texel evaluates the transition of its own
// block from the previous state and keeps its own quarter, so the four
// texels of a block agree, and a transition that only permutes the block's
// cells conserves material. Cells outside the block steer decisions but are
// never written. Material appears only by pouring, ambient events and plant
// growth; it leaves only by evaporation, soaking into sand, sinking at the
// floor, decay of litter and seeds, the eraser and the window trap below.
// Snow melting to water and plants crumbling to litter are one for one.
//
// Windows: cells wholly inside a window rect are walls to everything
// outside. Loose material inside (a window moved over it) moves sideways
// toward the window's motion or its nearer side and leaves through that
// side, or climbs out of the top when the side is buried; in a rising
// window it climbs first, so what rests on the window rides up with it.
// Stone and plants caught inside crumble to gravel and litter first.
// Whatever is still inside after TRAP_TIME seconds is removed.
//
// Block cells: 0 bottom left, 1 bottom right, 2 top left, 3 top right.
// Rates are per second; iTimeDelta is one substep.

const float FILL_TARGET = 0.10;  // filled fraction above which the floor sinks faster
const float SINK_BASE   = 0.004; // floor cells lost per second, at or below FILL_TARGET
const float SINK_GAIN   = 0.05;  // added per FILL_TARGET of excess fill, up to 4
const float FILL_LIMIT  = 0.40;  // filled fraction at which pouring stops
const float PLANT_CAP   = 0.004; // plant fraction above which seeds stay dormant
const float TRAP_TIME   = 15.0;  // seconds
const float GROW_RATE   = 3.5;   // plant growth chance per second while the tip
                                 // is in a block's bottom row (half the steps)
const float GERM_RATE   = 0.5;   // sprouting on wet ground, per second

vec2  gScale;   // buffer pixels to cells
int   gRows;
int   gCols;
uint  gStep;
float gDt;
float gWind;    // -1..1, airborne seeds, snow and litter drift with it
ivec2 gBo;      // block origin, cells

vec4 C[4];      // block cells
bool X[4];      // outside the grid
int  WI[4];     // window whose interior holds the cell, or -1
bool MV[4];     // moved this step
vec4 D[2];      // cells below the bottom row
bool DB[2];     // cell below is floor, wall, window interior or material
bool RT[2];     // cell above the top row is a stem or tip: the top cell is a root

vec4 cellPrev(ivec2 c) { return texelFetch(iChannel0, c, 0); }

bool inGrid(ivec2 c) { return c.x >= 0 && c.y >= 0 && c.x < gCols && c.y < gRows; }

float crand(ivec2 c, int k)
{
    return rnd3(uvec3(uint(c.x + 8192), uint(c.y + 8192), gStep * 64u + uint(k + 40)));
}

float brand(int k)
{
    return rnd3(uvec3(uint(gBo.x + 8192), uint(gBo.y + 8192), gStep * 64u + uint(k)));
}

// Interior of window i in cells: x in [lo.x, hi.x), y in [lo.y, hi.y).
// Cells straddling an edge stay outside, drawn partly under the window.
bool windowInterior(int i, out ivec2 lo, out ivec2 hi)
{
    vec4 r = iWindowRects[i];
    lo = ivec2(0);
    hi = ivec2(0);
    if (r.z < 1.0 || r.w < 1.0) return false;
    lo = ivec2(ceil(r.xy * gScale - 0.001));
    hi = ivec2(floor((r.xy + r.zw) * gScale + 0.001));
    return hi.x > lo.x && hi.y > lo.y;
}

int windowAt(ivec2 c)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        ivec2 lo, hi;
        if (!windowInterior(i, lo, hi)) continue;
        if (c.x >= lo.x && c.y >= lo.y && c.x < hi.x && c.y < hi.y) return i;
    }
    return -1;
}

// ------------------------------------------------------------- materials

bool isLoose(int m) { return m >= M_SAND && m <= M_LITTER && m != M_STONE; }

bool floats(int m) { return m == M_SNOW || m == M_LITTER; }

bool flutters(int m) { return m == M_SNOW || m == M_LITTER || m == M_SEED; }

float fallChance(int m)
{
    if (m == M_WATER) return 1.0;
    if (m == M_SNOW) return 0.11;
    if (m == M_LITTER) return 0.16;
    if (m == M_SEED) return 0.3;
    return 0.92;
}

// Wet sand and snow need a drop of two cells to slide: slopes up to 2:1.
bool cohesive(vec4 v)
{
    int m = matOf(v);
    return m == M_SNOW || (m == M_SAND && v.z > 0.3);
}

float slideChance(vec4 v)
{
    int m = matOf(v);
    if (m == M_WATER) return 1.0;
    if (m == M_GRAVEL) return 0.9;
    if (m == M_SAND) return v.z > 0.3 ? 0.5 : 0.85;
    return 0.6;
}

vec4 newCell(int m, ivec2 c)
{
    float z = m == M_WATER ? (crand(c, 6) < 0.5 ? -1.0 : 1.0) : 0.0;
    return vec4(float(m), crand(c, 5), z, 0.0);
}

// ------------------------------------------------------------- block

int mt(int i) { return matOf(C[i]); }

// Empty, inside a window or not.
bool vacant(int i) { return !X[i] && mt(i) == M_EMPTY; }

// Empty and outside every window.
bool clear(int i) { return vacant(i) && WI[i] < 0; }

// What stops or carries a grain outside the windows.
bool blocked(int i) { return X[i] || WI[i] >= 0 || mt(i) != M_EMPTY; }

bool rigid(int i) { return X[i] || WI[i] >= 0 || mt(i) == M_STONE || isPlant(mt(i)); }

// Loose material outside the windows that has not moved this step.
bool mover(int i) { return !X[i] && WI[i] < 0 && !MV[i] && isLoose(mt(i)); }

void swapCells(int a, int b)
{
    vec4 t = C[a];
    C[a] = C[b];
    C[b] = t;
    MV[a] = true;
    MV[b] = true;
}

void loadBlock()
{
    for (int i = 0; i < 4; i++) {
        ivec2 c = gBo + ivec2(i & 1, i >> 1);
        X[i] = !inGrid(c);
        C[i] = X[i] ? vec4(0.0) : cellPrev(c);
        WI[i] = -1;
        MV[i] = false;
    }
    bool dw0 = false;
    bool dw1 = false;
    for (int w = 0; w < iWindowCount && w < 16; w++) {
        ivec2 lo, hi;
        if (!windowInterior(w, lo, hi)) continue;
        if (gBo.x + 1 < lo.x || gBo.x >= hi.x || gBo.y + 1 < lo.y || gBo.y - 1 >= hi.y) continue;
        for (int i = 0; i < 4; i++) {
            ivec2 c = gBo + ivec2(i & 1, i >> 1);
            if (WI[i] < 0 && c.x >= lo.x && c.y >= lo.y && c.x < hi.x && c.y < hi.y) WI[i] = w;
        }
        bool rowIn = gBo.y - 1 >= lo.y && gBo.y - 1 < hi.y;
        dw0 = dw0 || (rowIn && gBo.x >= lo.x && gBo.x < hi.x);
        dw1 = dw1 || (rowIn && gBo.x + 1 >= lo.x && gBo.x + 1 < hi.x);
    }
    for (int i = 0; i < 2; i++) {
        ivec2 a = gBo + ivec2(i, 2);
        int am = inGrid(a) ? matOf(cellPrev(a)) : M_EMPTY;
        RT[i] = am == M_STEM || am == M_TIP;
        ivec2 c = gBo + ivec2(i, -1);
        bool edge = c.y < 0 || c.x < 0 || c.x >= gCols;
        D[i] = (edge || c.y >= gRows) ? vec4(0.0) : cellPrev(c);
        DB[i] = edge || (i == 0 ? dw0 : dw1) || matOf(D[i]) != M_EMPTY;
    }
}

void crumbleInWindows()
{
    for (int i = 0; i < 4; i++) {
        if (WI[i] < 0) continue;
        int m = mt(i);
        if (m == M_STONE) C[i] = vec4(float(M_GRAVEL), C[i].y, 0.0, 0.0);
        else if (isPlant(m)) C[i] = vec4(float(M_LITTER), C[i].y, 0.0, 0.0);
    }
}

bool vacantPrev(ivec2 c) { return inGrid(c) && matOf(cellPrev(c)) == M_EMPTY; }

int   gExitW = -1;  // window whose side openness is cached below
ivec2 gExitLo;
ivec2 gExitHi;
ivec2 gExitOpen;    // open cells beside the left and right side, of six

// Side (-1 or +1) toward which material leaves window w from column x: the
// direction of a fast drag, else the nearer side unless it is buried and
// the other is open (cells beside each side sampled at six heights).
float exitSide(int w, int x)
{
    float vx = iWindowVelocities[w].x * gScale.x;
    if (abs(vx) > 20.0) return sign(vx);
    if (gExitW != w) {
        gExitW = w;
        windowInterior(w, gExitLo, gExitHi);
        gExitOpen = ivec2(0);
        for (int k = 0; k < 6; k++) {
            int y = gExitLo.y + (gExitHi.y - gExitLo.y) * (2 * k + 1) / 12;
            if (vacantPrev(ivec2(gExitLo.x - 1, y))) gExitOpen.x++;
            if (vacantPrev(ivec2(gExitHi.x, y))) gExitOpen.y++;
        }
    }
    int l = gExitOpen.x;
    int r = gExitOpen.y;
    float near = 2 * x + 1 < gExitLo.x + gExitHi.x ? -1.0 : 1.0;
    if (near < 0.0 && l < 2 && r >= l + 2) return 1.0;
    if (near > 0.0 && r < 2 && l >= r + 2) return -1.0;
    return near;
}

void escapeWindows()
{
    for (int b = 0; b < 2; b++) {
        if (WI[b] < 0 || MV[b] || !isLoose(mt(b))) continue;
        int o = 1 - b;
        bool toward = (o > b) == (exitSide(WI[b], gBo.x + b) > 0.0);
        bool rising = iWindowVelocities[WI[b]].y * gScale.y > 10.0;
        if (rising && vacant(b + 2)) swapCells(b, b + 2);
        else if (toward && vacant(o)) swapCells(b, o);
        else if (toward && vacant(o + 2)) swapCells(b, o + 2);
        else if (vacant(b + 2)) swapCells(b, b + 2);
    }
    for (int t = 2; t < 4; t++) {
        if (WI[t] < 0 || MV[t] || !isLoose(mt(t))) continue;
        int o = 5 - t;
        bool toward = (o > t) == (exitSide(WI[t], gBo.x + t - 2) > 0.0);
        if (toward && vacant(o)) swapCells(t, o);
    }
}

void grow()
{
    for (int b = 0; b < 2; b++) {
        if (mt(b) != M_TIP || WI[b] >= 0) continue;
        int t = b + 2;
        vec4 tip = C[b];
        if (clear(t)) {
            if (brand(16 + b) < GROW_RATE * gDt) {
                if (tip.z < 0.5) {
                    C[b] = vec4(float(M_FLOWER), tip.y, 7.0, tip.w);
                } else {
                    C[t] = vec4(float(M_TIP), tip.y, tip.z - 1.0, tip.w);
                    C[b] = vec4(float(M_STEM), tip.y, brand(18 + b) < 0.32 ? 1.0 : 0.0, tip.w);
                    MV[t] = true;
                }
                MV[b] = true;
            }
        } else if (brand(16 + b) < 0.3 * gDt) {
            // A tip with no room above flowers where it is.
            C[b] = vec4(float(M_FLOWER), tip.y, 7.0, tip.w);
        }
    }
}

// A stem left over a one-cell gap (the floor sank under it) roots down
// into the gap.
void rootDown()
{
    for (int col = 0; col < 2; col++) {
        int t = col + 2;
        int m = mt(t);
        if ((m == M_STEM || m == M_TIP) && WI[t] < 0 && clear(col) && DB[col]) {
            C[col] = vec4(float(M_STEM), C[t].y, 0.0, C[t].w);
            MV[col] = true;
        }
    }
}

// Leaves beside stems, petals around flowers.
void sprout()
{
    for (int i = 0; i < 4; i++) {
        if (WI[i] >= 0) continue;
        int m = mt(i);
        int o = i ^ 1;
        bool right = (o & 1) == 1;
        if (m == M_STEM && C[i].z > 0.5) {
            // Leaves alternate sides up the stem.
            bool want = ((gBo.y + (i >> 1)) & 1) == 1;
            if (right == want && clear(o) && brand(20 + i) < 4.0 * gDt) {
                C[o] = vec4(float(M_LEAF), C[i].y, right ? 1.0 : -1.0, C[i].w);
                C[i].z = 0.0;
                MV[o] = true;
            }
        } else if (m == M_LEAF && abs(C[i].z) < 1.5 && right == (C[i].z > 0.0)) {
            // Most leaves grow an outer half.
            ivec2 c = gBo + ivec2(i & 1, i >> 1);
            if (clear(o) && hash12(vec2(c) + 0.73) < 0.8 && brand(20 + i) < 3.0 * gDt) {
                C[o] = vec4(float(M_LEAF), C[i].y, 2.0 * C[i].z, C[i].w);
                MV[o] = true;
            }
        } else if (m == M_FLOWER && C[i].z > 0.5) {
            int bits = int(C[i].z + 0.5);
            int side = right ? 2 : 1;
            if ((bits & side) != 0 && clear(o) && brand(24 + i) < 5.0 * gDt) {
                C[o] = vec4(float(M_PETAL), C[i].y, right ? 1.0 : 0.0, C[i].w);
                bits -= side;
                MV[o] = true;
            }
            if (i < 2 && (bits & 4) != 0 && clear(i + 2) && brand(28 + i) < 5.0 * gDt) {
                C[i + 2] = vec4(float(M_PETAL), C[i].y, 2.0, C[i].w);
                bits -= 4;
                MV[i + 2] = true;
            }
            C[i].z = float(bits);
        }
    }
}

void germinate(float plantFrac)
{
    if (plantFrac > PLANT_CAP) return;
    for (int b = 0; b < 2; b++) {
        if (mt(b) != M_SEED || WI[b] >= 0 || MV[b] || !clear(b + 2)) continue;
        bool wet = (matOf(D[b]) == M_SAND && D[b].z > 0.25)
                   || mt(1 - b) == M_WATER || mt(3 - b) == M_WATER;
        if (wet && brand(30 + b) < GERM_RATE * gDt) {
            C[b] = vec4(float(M_TIP), C[b].y, 4.0 + floor(brand(32 + b) * 11.0), 0.0);
            MV[b] = true;
        }
    }
}

void fall()
{
    for (int col = 0; col < 2; col++) {
        int t = col + 2;
        if (!mover(t) || MV[col] || X[col] || WI[col] >= 0) continue;
        int m = mt(t);
        int n = mt(col);
        float r = brand(col);
        if (n == M_EMPTY) {
            if (r < fallChance(m)) swapCells(t, col);
        } else if (n == M_WATER && m != M_WATER && !floats(m)) {
            // Grains sink through water, slower than through air.
            if (r < (m == M_SEED ? 0.12 : 0.35)) swapCells(t, col);
        } else if (m == M_WATER && floats(n)) {
            if (r < 0.4) swapCells(t, col);
        }
    }
}

// Top cell t slides to the bottom cell d of the other column, empty or
// holding water a grain displaces. A rigid cell beside t blocks the slide
// (nothing squeezes past a corner), and a grain under a stem stays put.
bool canSlide(int t, int d)
{
    if (!mover(t) || X[d] || WI[d] >= 0 || MV[d] || rigid(5 - t) || RT[t - 2]) return false;
    int m = mt(t);
    int n = mt(d);
    if (n != M_EMPTY && !(n == M_WATER && m != M_WATER && !floats(m))) return false;
    bool airborne = !blocked(t - 2);
    if (airborne) return flutters(m) && n == M_EMPTY;
    return !(cohesive(C[t]) && DB[d] && matOf(D[d]) != M_WATER);
}

void slide()
{
    bool a = canSlide(2, 1);
    bool b = canSlide(3, 0);
    if (a && b) {
        if (brand(2) < 0.5) b = false;
        else a = false;
    }
    float wa = mt(1) == M_WATER ? 0.4 : 1.0;
    float wb = mt(0) == M_WATER ? 0.4 : 1.0;
    if (a && brand(3) < wa * (blocked(0) ? slideChance(C[2]) : 0.5 * fallChance(mt(2)))) swapCells(2, 1);
    if (b && brand(4) < wb * (blocked(1) ? slideChance(C[3]) : 0.5 * fallChance(mt(3)))) swapCells(3, 0);
}

// Water runs along what carries it, keeping its direction until something
// other than water stops it (water ahead turns it now and then, so heaps
// level out); airborne light grains drift with the wind.
void flow()
{
    for (int i = 0; i < 4; i++) {
        if (!mover(i)) continue;
        int m = mt(i);
        int o = i ^ 1;
        float toward = (o & 1) == 1 ? 1.0 : -1.0;
        bool carried = i >= 2 ? blocked(i - 2) : DB[i];
        if (m == M_WATER) {
            if (!carried) continue;
            float d = C[i].z;
            if (abs(d) < 0.5) d = brand(6 + i) < 0.5 ? -1.0 : 1.0;
            int at = i;
            if (d == toward) {
                if (clear(o) && !MV[o]) {
                    if (brand(10 + i) < 0.85) {
                        swapCells(i, o);
                        at = o;
                    }
                } else if (mt(o) != M_WATER || brand(36 + i) < 0.1) {
                    d = -d;
                }
            }
            C[at].z = d;
        } else if (!carried && flutters(m) && gWind * toward > 0.0 && clear(o) && !MV[o]) {
            if (brand(10 + i) < abs(gWind) * 0.6) swapCells(i, o);
        }
    }
}

// Water resting on or beside drier sand soaks in.
void soak()
{
    for (int col = 0; col < 2; col++) {
        int t = col + 2;
        if (WI[t] >= 0 || WI[col] >= 0) continue;
        if (mt(t) == M_WATER && mt(col) == M_SAND && C[col].z < 0.35 && brand(12 + col) < 0.04 * gDt) {
            C[t] = vec4(0.0);
            C[col].z = 1.0;
        }
    }
    for (int r = 0; r < 4; r += 2) {
        if (WI[r] >= 0 || WI[r + 1] >= 0) continue;
        int w = -1;
        int s = -1;
        if (mt(r) == M_WATER && mt(r + 1) == M_SAND) { w = r; s = r + 1; }
        if (mt(r + 1) == M_WATER && mt(r) == M_SAND) { w = r + 1; s = r; }
        if (w >= 0 && C[s].z < 0.35 && brand(14 + r) < 0.015 * gDt) {
            C[w] = vec4(0.0);
            C[s].z = 1.0;
        }
    }
}

// Moisture seeps down through sand, wicks up and sideways slowly; the sum
// over a pair is kept.
void spreadMoisture()
{
    float k = min(0.8 * gDt, 0.25);
    for (int col = 0; col < 2; col++) {
        if (mt(col + 2) == M_SAND && mt(col) == M_SAND) {
            float d = C[col + 2].z - C[col].z;
            float f = d * k * (d > 0.0 ? 1.0 : 0.15);
            C[col + 2].z -= f;
            C[col].z += f;
        }
    }
    for (int r = 0; r < 4; r += 2) {
        if (mt(r) == M_SAND && mt(r + 1) == M_SAND) {
            float f = (C[r].z - C[r + 1].z) * k * 0.3;
            C[r].z -= f;
            C[r + 1].z += f;
        }
    }
}

// ------------------------------------------------------------- one cell

bool plantAt(ivec2 c) { return inGrid(c) && isPlant(matOf(cellPrev(c))); }

// Rules that change only this cell: aging, support, decay, melting,
// evaporation and sinking at the floor.
vec4 cellRules(vec4 v, ivec2 c, bool inWin, float fill)
{
    int m = matOf(v);
    if (m == M_EMPTY) return v;
    float r = crand(c, 0);
    if (isLoose(m)) {
        v.w = inWin ? v.w + gDt : 0.0;
        if (v.w > TRAP_TIME) return vec4(0.0);
        if (inWin) return v;
    }
    vec4 up = c.y + 1 < gRows ? cellPrev(c + ivec2(0, 1)) : vec4(0.0);
    vec4 dn = c.y > 0 ? cellPrev(c - ivec2(0, 1)) : vec4(float(M_STONE), 0.0, 0.0, 0.0);
    bool exposed = matOf(up) == M_EMPTY;
    // The floor sinks under the pile, faster the fuller the screen.
    float sink = (SINK_BASE + SINK_GAIN * clamp(fill / FILL_TARGET - 1.0, 0.0, 4.0)) * gDt;

    if (m == M_WATER) {
        if (exposed && r < EVAPORATION * gDt / 100.0) return vec4(0.0);
        if (c.y == 0 && crand(c, 1) < sink + EVAPORATION * gDt / 200.0) return vec4(0.0);
        return v;
    }
    if (m == M_SAND || m == M_GRAVEL || m == M_SEED || m == M_SNOW || m == M_LITTER) {
        if (c.y == 0 && crand(c, 1) < sink) return vec4(0.0);
    }
    if (m == M_SAND) {
        v.z = max(v.z - v.z * EVAPORATION * gDt * (exposed ? 1.0 / 70.0 : 1.0 / 400.0), 0.0);
        return v;
    }
    if (m == M_SNOW) {
        bool wet = matOf(up) == M_WATER || matOf(dn) == M_WATER
                   || (c.x > 0 && matOf(cellPrev(c - ivec2(1, 0))) == M_WATER)
                   || (c.x + 1 < gCols && matOf(cellPrev(c + ivec2(1, 0))) == M_WATER);
        if (r < gDt * (wet ? 1.0 / 6.0 : 1.0 / 50.0)) return vec4(float(M_WATER), v.y, crand(c, 2) < 0.5 ? -1.0 : 1.0, 0.0);
        return v;
    }
    if (m == M_LITTER) {
        if (matOf(dn) != M_EMPTY && r < gDt / 30.0) return vec4(0.0);
        return v;
    }
    if (m == M_SEED) {
        if (r < gDt / 300.0) return vec4(0.0);
        return v;
    }
    if (m == M_STONE) {
        bool open = exposed || matOf(dn) == M_EMPTY
                    || (c.x > 0 && matOf(cellPrev(c - ivec2(1, 0))) == M_EMPTY)
                    || (c.x + 1 < gCols && matOf(cellPrev(c + ivec2(1, 0))) == M_EMPTY);
        if (open && r < gDt / 1200.0) return vec4(float(M_GRAVEL), v.y, 0.0, 0.0);
        return v;
    }

    if (!isPlant(m)) return v;

    // Plants: age, lose support, get crushed under sand, wilt and crumble.
    v.w += gDt;
    bool held = true;
    if (m == M_STEM || m == M_TIP)
        held = matOf(dn) != M_EMPTY || (c.y > 1 && matOf(cellPrev(c - ivec2(0, 2))) != M_EMPTY);
    else if (m == M_FLOWER) held = isPlant(matOf(dn));
    else if (m == M_LEAF) held = plantAt(c - ivec2(int(sign(v.z)), 0));
    else if (m == M_PETAL) {
        ivec2 centre = c + (v.z < 0.5 ? ivec2(1, 0) : (v.z < 1.5 ? ivec2(-1, 0) : ivec2(0, -1)));
        held = inGrid(centre) && matOf(cellPrev(centre)) == M_FLOWER;
    }
    int um = matOf(up);
    bool crushed = (um == M_SAND || um == M_GRAVEL || um == M_STONE) && r < 0.5 * gDt;
    bool dead = crushed || (v.w > plantLife(v.y) + WILT_TIME && r < 0.25 * gDt);
    if (!held || dead) {
        if (m == M_FLOWER) return vec4(float(M_SEED), v.y, 0.0, 0.0);
        return vec4(float(M_LITTER), crand(c, 3), 0.0, 0.0);
    }
    return v;
}

// Material poured from the cursor along its path this substep.
vec4 pour(vec4 v, ivec2 c, bool inWin, vec4 ctl, float fill)
{
    if (iMouse.z <= 0.0 || ctl.y < 0.5 || inWin) return v;
    int tool = int(ctl.z + 0.5);
    float s = float(iSubsteps);
    // A jump of over a quarter of the screen height in one frame is not a stroke.
    vec2 prev = distance(iMousePrev, iMouse.xy) > 0.25 * iResolution.y ? iMouse.xy : iMousePrev;
    vec2 a = mix(prev, iMouse.xy, float(iSubstep) / s) * gScale;
    vec2 b = mix(prev, iMouse.xy, float(iSubstep + 1) / s) * gScale;
    vec2 p = vec2(c) + 0.5;
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float d = length(p - a - ab * t);
    float radius = tool == T_ERASER ? 2.6 : (tool == T_SNOW ? 3.2 : (tool == T_STONE ? 1.3 : (tool == T_SEED ? 1.2 : 1.7)));
    if (d > radius) return v;
    if (tool == T_ERASER) return vec4(0.0);
    if (matOf(v) != M_EMPTY) return v;
    float rate = tool == T_SAND ? 22.0 : (tool == T_WATER ? 30.0 : (tool == T_SEED ? 1.2 : (tool == T_SNOW ? 2.0 : 1e6)));
    rate *= (tool == T_STONE ? 1.0 : POUR_RATE) * clamp((FILL_LIMIT - fill) / 0.05, 0.0, 1.0);
    if (crand(c, 4) >= rate * gDt) return v;
    int m = tool == T_SAND ? M_SAND : (tool == T_WATER ? M_WATER : (tool == T_SEED ? M_SEED : (tool == T_STONE ? M_STONE : M_SNOW)));
    return newCell(m, c);
}

float eventRamp(vec4 e, vec4 e3)
{
    return clamp(e.y / 3.0, 0.0, 1.0) * clamp((e3.x - e.y) / 3.0, 0.0, 1.0);
}

vec4 ambient(vec4 v, ivec2 c, bool inWin, vec4 e, vec4 e3)
{
    int kind = int(e.x + 0.5);
    if (kind == E_NONE || inWin || matOf(v) != M_EMPTY) return v;
    float rate = 0.0;
    int m = M_EMPTY;
    bool top = c.y == gRows - 1;
    if (kind == E_RAIN && top) {
        rate = 0.10;
        m = M_WATER;
    } else if (kind == E_SNOW && top) {
        rate = 0.03;
        m = M_SNOW;
    } else if (kind == E_TRICKLE && top && abs(float(c.x) + 0.5 - e.w * float(gCols)) < 1.0) {
        rate = 40.0;
        m = M_SAND;
    } else if (kind == E_SEEDS && c.x == (e.w > 0.0 ? 0 : gCols - 1) && c.y > gRows / 2 && c.y < gRows * 9 / 10) {
        rate = 2.0 / (0.4 * float(gRows));
        m = M_SEED;
    }
    if (m == M_EMPTY || crand(c, 7) >= rate * eventRamp(e, e3) * gDt) return v;
    return newCell(m, c);
}

// ------------------------------------------------------------- start

float gauss(float x) { return exp(-0.5 * x * x); }

float vnoise1(float x)
{
    float i = floor(x);
    float f = fract(x);
    return mix(hash12(vec2(i, 3.7)), hash12(vec2(i + 1.0, 3.7)), f * f * (3.0 - 2.0 * f));
}

// Size of the starting scene's features relative to the grid height:
// smaller on screens narrower than 16:10.
float sceneScale() { return sqrt(min(float(gCols) / (1.6 * float(gRows)), 1.0)); }

// Starting scene: a dune, a smaller one to its right holding a puddle
// between them, a third mound on wide screens.
float duneHeight(float x)
{
    float W = float(gCols);
    float R = float(gRows) * sceneScale();
    float xa = 0.30 * W;
    float xb = xa + 0.68 * R;
    float h = 0.21 * R * gauss((x - xa) / (0.19 * R)) + 0.13 * R * gauss((x - xb) / (0.10 * R));
    if (W > 2.4 * float(gRows)) h += 0.09 * R * gauss((x - 0.80 * W) / (0.14 * R));
    return h + (vnoise1(x * 0.18) - 0.5) * 1.6 * smoothstep(1.0, 6.0, h);
}

// First empty row above the sand in column x.
int duneTop(int x) { return int(ceil(duneHeight(float(x) + 0.5) - 0.5)); }

vec4 initialCell(ivec2 c)
{
    if (windowAt(c) >= 0) return vec4(0.0);
    float R = float(gRows) * sceneScale();
    float W = float(gCols);
    float x = float(c.x) + 0.5;
    float y = float(c.y) + 0.5;
    float xa = 0.30 * W;
    float xb = xa + 0.68 * R;
    float level = 0.10 * R;
    float tone = hash12(vec2(c) + 0.31);

    // A boulder half buried at the foot of the dune.
    vec2 bq = vec2(x - (xa - 0.34 * R), (y + 0.01 * R) * 1.25);
    if (length(bq) < 0.05 * R + 1.5 * (vnoise1(atan(bq.y, bq.x) * 4.0) - 0.5))
        return vec4(float(M_STONE), tone, 0.0, 0.0);

    // A sprouting plant on the dune's flank above the water, and seeds.
    int px = int(xa + 0.214 * R);
    int p0 = duneTop(px);
    if (c.x == px && c.y >= p0 && c.y < p0 + 2) return vec4(float(M_STEM), 0.2, 0.0, 0.0);
    if (c.x == px && c.y == p0 + 2) return vec4(float(M_TIP), 0.2, 7.0, 0.0);
    if (c.x == px + 1 && c.y == p0 + 1) return vec4(float(M_LEAF), 0.2, 1.0, 0.0);
    int s1 = int(xb - 0.061 * R);
    int s2 = int(xa - 0.12 * R);
    if ((c.x == s1 && c.y == duneTop(s1)) || (c.x == s2 && c.y == duneTop(s2)))
        return vec4(float(M_SEED), tone, 0.0, 0.0);

    float h = duneHeight(x);
    if (y < h) {
        // Damp around the puddle: shores where the dunes cross the water
        // level, fading over a few cells sideways, upward and with depth.
        float shoreL = xa + 0.231 * R;
        float shoreR = xb - 0.072 * R;
        float d = max(shoreL - x, 0.0) + max(x - shoreR, 0.0) + 1.5 * max(y - level, 0.0) + max(h - y - 6.0, 0.0);
        float wet = clamp(1.0 - d / 7.0, 0.0, 1.0) * (0.85 + 0.15 * tone);
        return vec4(float(M_SAND), tone, wet, 0.0);
    }
    if (x > xa && x < xb && y < level)
        return vec4(float(M_WATER), tone, tone < 0.5 ? -1.0 : 1.0, 0.0);
    return vec4(0.0);
}

// ------------------------------------------------------------- state

vec4 stateAt(int k) { return texelFetch(iChannel0, ivec2(k, int(iResolution.y) - 1), 0); }

vec4 stateTexel(int k, bool init)
{
    vec4 s = stateAt(k);
    if (k == 0) {
        if (init) return vec4(0.0, 0.0, 0.0, 1.0);
        float filled = 0.0;
        float plants = 0.0;
        for (int i = 0; i < 48; i++) {
            uvec3 h = pcg3d(uvec3(uint(i), gStep, 977u));
            int m = matOf(cellPrev(ivec2(int(h.x % uint(gCols)), int(h.y % uint(gRows)))));
            if (m != M_EMPTY) filled += 1.0;
            if (isPlant(m)) plants += 1.0;
        }
        float a = 1.0 - exp(-gDt / 4.0);
        return vec4(mod(s.x + 1.0, 1048576.0), mix(s.y, filled / 48.0, a), mix(s.z, plants / 48.0, a), 1.0);
    }
    if (k == 1) {
        if (init) return vec4(0.0, 0.0, float(T_SAND), 1.0);
        bool held = iMouse.z > 0.0;
        float pouring = held ? s.y : 0.0;
        float tool = s.z;
        if (held && s.x < 0.5) {
            bool onWindow = insideWindow(iMouse.xy);
            int icon = palIconAt(iMouse.xy / iResolution.y, iResolution.xy);
            if (!onWindow && icon >= 0) tool = float(icon);
            pouring = (!onWindow && icon < 0 && cursorOnScreen()) ? 1.0 : 0.0;
        }
        return vec4(held ? 1.0 : 0.0, pouring, tool, 1.0);
    }
    // Events: texels 2 and 3 evaluate the same transition.
    vec4 e = stateAt(2);
    vec4 e3 = stateAt(3);
    if (init) {
        e = vec4(float(E_NONE), 0.0, 15.0, 0.0);
        e3 = vec4(0.0, 0.0, 0.0, 1.0);
    } else if (int(e.x + 0.5) != E_NONE) {
        e.y -= gDt;
        if (e.y <= 0.0) e = vec4(float(E_NONE), 0.0, 45.0 + 75.0 * rnd3(uvec3(gStep, 51u, 7u)), 0.0);
    } else {
        e.z -= gDt;
        if (e.z <= 0.0) {
            float fill = stateAt(0).y;
            float r = rnd3(uvec3(gStep, 52u, 7u));
            float r2 = rnd3(uvec3(gStep, 53u, 7u));
            float month = iDate.y;
            float pSnow = (month <= 2.0 || month >= 12.0) ? 0.35 : ((month == 3.0 || month == 11.0) ? 0.12 : 0.0);
            int kind = E_TRICKLE;
            if (e3.y > 0.5) {
                float q = (r - pSnow) / (1.0 - pSnow);
                kind = r < pSnow ? E_SNOW : (q < 0.4 ? E_RAIN : (q < 0.7 ? E_TRICKLE : E_SEEDS));
                // Seeds that blew in are usually rained on next.
                if (int(e3.z + 0.5) == E_SEEDS && r2 < 0.7) kind = E_RAIN;
            }
            if ((kind == E_TRICKLE || kind == E_SNOW) && fill > FILL_TARGET * 1.3) kind = E_RAIN;
            float dur = kind == E_RAIN ? 16.0 + 12.0 * r2 : (kind == E_SNOW ? 20.0 + 10.0 * r2 : 12.0 + 6.0 * r2);
            // Trickles start clear of the palette in the top-right corner.
            float param = kind == E_TRICKLE ? 0.12 + 0.6 * r2 : (r2 < 0.5 ? -1.0 : 1.0);
            if (AMBIENT < 0.5) e = vec4(float(E_NONE), 0.0, 60.0, 0.0);
            else {
                e = vec4(float(kind), dur, 0.0, param);
                e3 = vec4(dur, e3.y + 1.0, float(kind), 1.0);
            }
        }
    }
    return k == 2 ? e : e3;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    vec2 res = iResolution.xy;
    gRows = gridRows(res);
    gCols = gridCols(res);
    gScale = vec2(float(gCols), float(gRows)) / res;
    gDt = iTimeDelta;

    vec4 s0 = stateAt(0);
    bool init = s0.w < 0.5;
    gStep = uint(s0.x);

    if (ic.y == int(res.y) - 1) {
        fragColor = ic.x < NSTATE ? stateTexel(ic.x, init) : vec4(0.0);
        return;
    }
    if (ic.x >= gCols || ic.y >= gRows) {
        fragColor = vec4(0.0);
        return;
    }
    if (init) {
        fragColor = initialCell(ic);
        return;
    }

    vec4 ctl = stateAt(1);
    vec4 e = stateAt(2);
    vec4 e3 = stateAt(3);
    int kind = int(e.x + 0.5);
    gWind = (kind == E_SEEDS ? e.w : (kind == E_SNOW ? 0.35 * e.w : 0.0)) * eventRamp(e, e3);

    ivec2 par = ivec2(int(gStep & 1u));
    gBo = par + 2 * ivec2(floor(vec2(ic - par) * 0.5));
    loadBlock();
    crumbleInWindows();
    escapeWindows();
    grow();
    rootDown();
    sprout();
    germinate(s0.z);
    fall();
    slide();
    flow();
    soak();
    spreadMoisture();

    int me = (ic.x - gBo.x) + 2 * (ic.y - gBo.y);
    vec4 v = C[me];
    bool inWin = WI[me] >= 0;
    v = cellRules(v, ic, inWin, s0.y);
    v = pour(v, ic, inWin, ctl, s0.y);
    v = ambient(v, ic, inWin, e, e3);
    fragColor = v;
}
