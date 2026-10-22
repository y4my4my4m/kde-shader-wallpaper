// Snowdrift — Buffer A: snow on the ground and on window tops, clumps that
// slide off windows, click bursts and the clocks.
// @channels self
//
// State layout in snowdrift_common.frag. Every texel derives its update
// from the previous step only, so texels that share an event agree on it: a
// pile segment that sheds is cleared in the step its clump texel spawns,
// and a clump that lands deposits into the samples under it in the step its
// own texel turns into a puff.
//
// Piles are height fields, one height per grid column: the ground's in
// screen columns, each window's in columns counted from its left edge, so
// snow rides a window without resampling. Each step a pile
//   * gains snow where no window shelters it, slowing toward its cap,
//   * slumps toward the angle of repose (neighbour flux above REPOSE grid px
//     of rise per column) and spills off window ends,
//   * is pushed sideways out of a moving window and fades out of a resting
//     one, so no snow is left inside a window,
//   * melts under the cursor, and settles back when above its cap.
// A window faster than SHED_LO..SHED_HI U/s loses its pile segment by
// segment, trailing end first; a window that disappears loses all of it.
// With no windows at all (Show Desktop) the slots sleep and wake when
// windows of the same sizes return. Slots follow windows across list
// reordering by size.
//
// Window rects and the cursor are interpolated across the frame's substeps
// (iSubstep / iSubsteps). Rates are per second; the engine runs this pass
// at about 240 steps/s.

const float ACCUM      = 0.0006;        // U/s of fresh snow
const float SUBLIMATE  = 1.0 / 2400.0;  // 1/s
const float SETTLE     = 1.0 / 20.0;    // 1/s, decay of snow above the cap
const float REPOSE     = 0.6;           // rise per run at rest, ~31 degrees
const float SLUMP      = 50.0;          // 1/s, excess slope relaxation
const float CREST      = 1.5;           // 1/s, crest diffusion
const float MELT_SPEED = 0.45;          // U/s at the centre of the cursor
const float WET_DECAY  = 7.0;           // s
const float SHED_LO    = 0.55;          // U/s
const float SHED_HI    = 1.4;           // U/s
const float VEL_SMOOTH = 0.06;          // s
const float CARRY      = 0.25;          // share of window velocity a clump keeps
const float GRAVITY    = 1.4;           // U/s^2
const float CLUMP_DRAG = 0.8;           // 1/s
const float MIN_FLIGHT = 0.04;          // s before a clump may land
const float MIN_CLUMP  = 0.5;           // grid px^2
const float MIN_THICK  = 1.2;           // grid px; thinner shed snow turns to powder
const float SEED_TIME  = 4.0;           // s after reset in which new windows arrive snowed on
const float MOVING     = 0.03;          // U/s; slower windows are resting
const float FADE_RATE  = 10.0;          // 1/s, snow inside a resting window

const int LAND_NONE   = -1;
const int LAND_LOST   = -2;
const int LAND_GROUND = 16;

vec4 st(int x, int y) { return texelFetch(iChannel0, ivec2(x, y), 0); }

int gridW() { return int(iResolution.x); }

float subFrac() { return float(iSubstep + 1) / float(max(iSubsteps, 1)); }

// Window i at this substep. A rect that changed size since last frame is a
// different window or a resize and is taken as is.
vec4 winRect(int i)
{
    vec4 a = iWindowRectsPrev[i];
    vec4 b = iWindowRects[i];
    if (any(greaterThan(abs(a.zw - b.zw), vec2(2.0)))) return b;
    return mix(a, b, subFrac());
}

vec2 cursorNow() { return mix(iMousePrev, iMouse.xy, subFrac()); }

// ------------------------------------------------------------- slots

vec4 slotRect(int p) { return st(p, ROW_SLOT); }
vec2 slotVel(int p) { return st(NSLOT + p, ROW_SLOT).xy; }

bool sameSize(vec4 s, vec4 r)
{
    vec2 tol = max(vec2(1.5), 0.03 * r.zw);
    return s.z > 0.0 && all(lessThan(abs(s.zw - r.zw), tol));
}

// Previous slot whose pile current window i (rect r) inherits, or -1.
int matchSlot(int i, vec4 r)
{
    if (sameSize(slotRect(i), r)) return i;
    for (int p = 0; p < NSLOT; p++) {
        if (p == i) continue;
        vec4 s = slotRect(p);
        if (!sameSize(s, r)) continue;
        if (distance(s.xy, r.xy) > 0.3 * unitLen()) continue;
        if (p < iWindowCount && sameSize(s, winRect(p))) continue;
        return p;
    }
    return -1;
}

// Current window that inherits previous slot p, or -1.
int heirOf(int p)
{
    if (p < iWindowCount && sameSize(slotRect(p), winRect(p))) return p;
    for (int i = 0; i < iWindowCount && i < NSLOT; i++) {
        if (i != p && matchSlot(i, winRect(i)) == p) return i;
    }
    return -1;
}

vec2 slotVelocity(int src, vec4 r)
{
    if (src < 0) return vec2(0.0);
    vec2 raw = (r.xy - slotRect(src).xy) / max(iTimeDelta, 1e-4);
    return mix(slotVel(src), raw, 1.0 - exp(-iTimeDelta / VEL_SMOOTH));
}

int segmentOf(float j, float n)
{
    return clamp(int(floor(j * float(NSEG) / max(n, 1.0))), 0, NSEG - 1);
}

// Segment s of previous slot p slides off this step. heir: the window now
// holding p (-1 when it vanished), vel its smoothed velocity.
bool sheds(int p, int s, int heir, vec2 vel)
{
    if (clumpStateOf(st(p * NSEG + s, ROW_CLUMP + 1)) != 0) return false;
    if (heir < 0) return iWindowCount > 0;
    vec2 v = vel / unitLen();
    float e = abs(v.x) + 1.2 * max(-v.y, 0.0) + 0.4 * max(v.y, 0.0);
    float along = (float(s) + 0.5) / float(NSEG);
    float lead = v.x >= 0.0 ? along : 1.0 - along;
    float th = mix(SHED_LO, SHED_HI, 0.5 * hash11(float(p * NSEG + s) * 7.31 + 0.5) + 0.5 * lead);
    if (e <= th) return false;
    // Past the threshold a segment lets go at a rate rising with the excess
    // speed, so a yank sheds in a quick ragged cascade.
    float rate = 30.0 * clamp((e - th) / (0.6 * th), 0.08, 1.0);
    float roll = hash12(vec2(float(p * NSEG + s) + 0.5, st(0, ROW_GLOBAL).z * 240.0));
    return roll < 1.0 - exp(-rate * iTimeDelta);
}

// ------------------------------------------------------------- surfaces

float groundAt(float x)
{
    int c = int(floor(x));
    if (c < 0 || c >= gridW()) return 0.0;
    return st(c, ROW_GROUND).x;
}

float pileAt(int i, float lx, float n)
{
    if (lx < 0.0 || lx >= min(n, iResolution.x)) return 0.0;
    return st(int(lx), ROW_PILE + i).x;
}

// Advances a falling clump one step into na. Returns the surface it lands
// on (window index, LAND_GROUND), LAND_NONE, or LAND_LOST when it left the
// screen; landY is the surface height.
int clumpFall(vec4 a, vec4 b, out vec4 na, out float landY)
{
    float G = unitLen();
    float dt = iTimeDelta;
    vec2 vel = a.zw;
    vel.y -= GRAVITY * G * dt;
    vel *= exp(-CLUMP_DRAG * dt);
    vec2 pos = a.xy + vel * dt;
    na = vec4(pos, vel);
    landY = 0.0;
    if (pos.x < -b.y || pos.x > iResolution.x + b.y || pos.y < -0.2 * G || b.z > 8.0) return LAND_LOST;
    if (b.z < MIN_FLIGHT) return LAND_NONE;
    float bottom = pos.y - 0.5 * clumpThickness(b);
    int src = clumpSourceOf(b);
    int hit = LAND_NONE;
    float best = -1e9;
    for (int i = 0; i < iWindowCount && i < NSLOT; i++) {
        if (i == src) continue;
        vec4 r = winRect(i);
        if (pos.x < r.x || pos.x > r.x + r.z) continue;
        float top = r.y + r.w;
        float s = top + pileAt(i, pos.x - r.x, ceil(r.z));
        if (bottom <= s && bottom > top - 4.0 && s > best) {
            hit = i;
            best = s;
        }
    }
    if (hit == LAND_NONE) {
        float g = groundAt(pos.x);
        if (bottom <= g) {
            hit = LAND_GROUND;
            best = g;
        }
    }
    landY = best;
    return hit;
}

// Snow landing this step at screen column x on surface `target`. The
// in-use masks lag the clump rows by one step; a clump cannot land within
// MIN_FLIGHT of spawning, so none is missed.
float depositAt(float x, int target)
{
    if (st(8, ROW_GLOBAL).y < 0.5) return 0.0;
    ivec4 m = ivec4(st(9, ROW_GLOBAL) + 0.5);
    float add = 0.0;
    for (int k = 0; k < NCLUMP; k++) {
        int g = k / 16;
        int bits = g == 0 ? m.x : (g == 1 ? m.y : (g == 2 ? m.z : m.w));
        if (((bits >> (k - g * 16)) & 1) == 0) continue;
        vec4 b = st(k, ROW_CLUMP + 1);
        if (clumpStateOf(b) != 1) continue;
        vec4 a = st(k, ROW_CLUMP);
        float hw = b.y + 4.0;
        if (abs(x - a.x) > hw + 8.0) continue;
        vec4 na;
        float ly;
        if (clumpFall(a, b, na, ly) != target) continue;
        float d = x - na.x;
        if (abs(d) >= hw) continue;
        add += b.x * (0.5 + 0.5 * cos(3.14159265 * d / hw)) / hw;
    }
    return add;
}

// Share of falling snow reaching height y at column x; window `self` is
// the surface itself. A window shelters fully what lies just under it;
// wind-blown snow reaches under one floating higher up.
float exposure(float x, float y, int self)
{
    float G = unitLen();
    float cover = 0.0;
    for (int i = 0; i < iWindowCount && i < NSLOT; i++) {
        if (i == self) continue;
        vec4 r = winRect(i);
        if (r.y + r.w <= y + 0.5) continue;
        float inside = min(x - r.x, r.x + r.z - x);
        float gap = max(r.y - y, 0.0);
        cover = max(cover, smoothstep(-1.5, 1.5, inside) * (1.0 - 0.75 * smoothstep(0.03 * G, 0.4 * G, gap)));
    }
    return 1.0 - cover;
}

// Snow of a pile (base y0, height h at column x) that lies inside another
// window. A moving window pushes it out sideways: returns the height moved
// to the neighbour in direction dir. A resting window takes it as `fade`.
float intrusion(float x, float y0, float h, int self, out float dir, out float fade)
{
    dir = 0.0;
    fade = 0.0;
    float pushed = 0.0;
    if (h <= 0.0) return 0.0;
    for (int i = 0; i < iWindowCount && i < NSLOT; i++) {
        if (i == self) continue;
        vec4 r = winRect(i);
        if (x < r.x || x > r.x + r.z || r.y + r.w <= y0) continue;
        float excess = h - max(r.y - y0, 0.0);
        if (excess <= 0.0) continue;
        vec2 v = iWindowVelocities[i];
        if (length(v) > MOVING * unitLen()) {
            if (excess > pushed) {
                pushed = excess;
                dir = abs(v.x) > 0.5 * abs(v.y) ? sign(v.x)
                    : (x - r.x < r.x + r.z - x ? -1.0 : 1.0);
            }
        } else {
            fade = max(fade, excess);
        }
    }
    return pushed;
}

float slumpFlux(float a, float b, float k)
{
    float d = a - b;
    return k * (max(d - REPOSE, 0.0) - max(-d - REPOSE, 0.0));
}

// Height left at column x of a pile based at y0 by a disc of radius R at m:
// the pile is cut down to the disc's lower edge. 1e9 when the disc misses
// the column or lies wholly below the base.
float carveTarget(float x, float y0, vec2 m, float R)
{
    float dx = x - m.x;
    if (abs(dx) >= R) return 1e9;
    float hh = sqrt(R * R - dx * dx);
    if (m.y + hh <= y0) return 1e9;
    return max(0.0, m.y - hh - y0);
}

bool pressStarted()
{
    return iMouse.z > 0.0 && st(0, ROW_GLOBAL).y < 0.5 && cursorLive(iMouse.xy)
        && iMouse.y > 0.06 * iResolution.y;
}

// One pile sample: h, wetness and neighbours hl, hr (already resolved for
// edges). Returns the new (h, wetness).
vec2 updatePile(float h, float wet, float hl, float hr, float x, float y0, float cap,
                int self, bool leftOpen, bool rightOpen)
{
    float dt = iTimeDelta;
    float G = unitLen();
    float elapsed = st(0, ROW_GLOBAL).x;

    // Fresh snow, slowing toward the cap; above it, settling back.
    float rate = SNOW_RATE * ACCUM * G * (1.0 + 2.0 * exp(-elapsed / 25.0));
    float e = exposure(x, y0, self);
    if (h < cap) h += rate * e * (1.0 - h / cap) * dt;
    else h -= (h - cap) * SETTLE * dt;
    h -= h * SUBLIMATE * dt;

    // Slump toward the angle of repose and round the crests. Open ends of a
    // window spill: the missing neighbour is bare.
    float k = min(0.24, SLUMP * dt);
    float out0 = slumpFlux(h, hl, k) + slumpFlux(h, hr, k);
    float c = min(0.2, CREST * dt);
    float diff = c * (hl + hr - 2.0 * h);
    h += diff - out0;

    // Windows pushed into the pile shove it aside.
    float dl, dr, dc, fl, fr, fc;
    float pc = intrusion(x, y0, h, self, dc, fc);
    float pl = leftOpen ? 0.0 : intrusion(x - 1.0, y0, hl, self, dl, fl);
    float pr = rightOpen ? 0.0 : intrusion(x + 1.0, y0, hr, self, dr, fr);
    h += (dl > 0.5 ? pl : 0.0) + (dr < -0.5 ? pr : 0.0) - pc;
    h -= fc * (1.0 - exp(-FADE_RATE * dt));

    // The warm cursor melts a path.
    float before = h;
    vec2 m = cursorNow();
    float R = MELT_RADIUS * G;
    if (R > 0.5 && cursorLive(iMouse.xy)) {
        float t = carveTarget(x, y0, m, R);
        if (h > t) {
            float w = 1.0 - (x - m.x) * (x - m.x) / (R * R);
            h -= min(h - t, MELT_SPEED * G * dt * (0.3 + 0.7 * w));
        }
    }
    // A click scoops snow out of the pile under it.
    if (pressStarted()) {
        float t = carveTarget(x, y0, iMouse.xy, max(1.3 * R, 0.03 * G));
        if (h > t) h = mix(h, t, 0.85);
    }
    float melted = max(before - h, 0.0);
    wet = clamp(wet * exp(-dt / WET_DECAY) + melted / (0.003 * G), 0.0, 1.0);

    h += depositAt(x, self < 0 ? LAND_GROUND : self);
    h = clamp(h, 0.0, 2.0 * cap + 2.0);
    return vec2(h, wet);
}

// ------------------------------------------------------------- passes

vec4 groundTexel(int c)
{
    float G = unitLen();
    float W = iResolution.x;
    vec4 s = st(c, ROW_GROUND);
    float x = float(c) + 0.5;
    float cap = groundCap(x, G, W);
    if (s.w < 0.5) {
        // A night's snowfall already down: two thirds to four fifths of the cap.
        return vec4(cap * (0.66 + 0.14 * vnoise1(x / G * 13.0 + 4.0)), 0.0, 0.0, 1.0);
    }
    float hl = c > 0 ? st(c - 1, ROW_GROUND).x : s.x;
    float hr = c < gridW() - 1 ? st(c + 1, ROW_GROUND).x : s.x;
    vec2 hw = updatePile(s.x, s.y, hl, hr, x, 0.0, cap, -1, false, false);
    return vec4(hw, 0.0, 1.0);
}

vec4 windowPileTexel(int i, int j)
{
    if (iWindowCount == 0) return st(j, ROW_PILE + i);
    if (i >= iWindowCount) return vec4(0.0);
    float G = unitLen();
    vec4 r = winRect(i);
    float n = ceil(r.z);
    float fj = float(j);
    if (fj >= n) return vec4(0.0);
    float cap = windowCap(fj + 0.5, r.zw, G);

    int src = matchSlot(i, r);
    if (src < 0) {
        if (st(0, ROW_GLOBAL).x > SEED_TIME) return vec4(0.0, 0.0, 0.0, 1.0);
        float edge = min(fj + 0.5, n - fj - 0.5);
        return vec4(min(cap * 0.6, edge * REPOSE * 0.8), 0.0, 0.0, 1.0);
    }
    float nsrc = ceil(slotRect(src).z);
    if (fj >= nsrc) return vec4(0.0, 0.0, 0.0, 1.0);
    vec2 vel = slotVelocity(src, r);
    if (sheds(src, segmentOf(fj, nsrc), i, vel)) return vec4(0.0, 0.0, 0.0, 1.0);

    vec4 s = st(j, ROW_PILE + src);
    bool leftOpen = j == 0;
    bool rightOpen = fj + 1.0 >= min(min(n, nsrc), iResolution.x);
    float hl = leftOpen ? 0.0 : st(j - 1, ROW_PILE + src).x;
    float hr = rightOpen ? 0.0 : st(j + 1, ROW_PILE + src).x;
    if (!leftOpen && sheds(src, segmentOf(fj - 1.0, nsrc), i, vel)) hl = 0.0;
    if (!rightOpen && sheds(src, segmentOf(fj + 1.0, nsrc), i, vel)) hr = 0.0;

    float x = r.x + fj + 0.5;
    vec2 hw = updatePile(s.x, s.y, hl, hr, x, r.y + r.w, cap, i, leftOpen, rightOpen);
    return vec4(hw, 0.0, 1.0);
}

vec4 slotTexel(int x)
{
    vec4 s = st(x, ROW_SLOT);
    if (iWindowCount == 0) return s;
    int i = x < NSLOT ? x : x - NSLOT;
    if (i >= iWindowCount) return vec4(0.0);
    vec4 r = winRect(i);
    if (x < NSLOT) return r;
    return vec4(slotVelocity(matchSlot(i, r), r), 0.0, 1.0);
}

// Both clump texels run the same update and keep their half.
void clumpUpdate(int k, out vec4 outA, out vec4 outB)
{
    float G = unitLen();
    float dt = iTimeDelta;
    vec4 a = st(k, ROW_CLUMP);
    vec4 b = st(k, ROW_CLUMP + 1);
    int state = clumpStateOf(b);
    outA = vec4(0.0);
    outB = vec4(0.0);

    if (state == 0) {
        if (iWindowCount == 0) return;
        int p = k / NSEG;
        int s = k - p * NSEG;
        vec4 sp = slotRect(p);
        if (sp.z <= 0.0) return;
        int heir = heirOf(p);
        vec4 r = heir >= 0 ? winRect(heir) : sp;
        vec2 vel = heir >= 0 ? slotVelocity(p, r) : vec2(0.0);
        if (!sheds(p, s, heir, vel)) return;
        float n = ceil(sp.z);
        int j0 = int(floor(float(s) * n / float(NSEG)));
        int j1 = int(floor(float(s + 1) * n / float(NSEG)));
        float mass = 0.0;
        float xc = 0.0;
        float lo = 1e9;
        float hi = -1e9;
        for (int j = j0; j < j1 && j < gridW(); j++) {
            float h = st(j, ROW_PILE + p).x;
            if (h <= 0.0) continue;
            mass += h;
            xc += h * (float(j) + 0.5);
            if (h > 0.25) {
                lo = min(lo, float(j));
                hi = max(hi, float(j));
            }
        }
        if (mass < MIN_CLUMP) return;
        xc /= mass;
        float width = hi >= lo ? max(hi - lo + 1.0, 2.0) : 2.0;
        float thick = mass / width;
        if (thick < MIN_THICK) {
            // Too thin to hold together: blows off as powder.
            width = max(float(j1 - j0), 2.0);
            outA = vec4(r.x + xc, r.y + r.w, 0.0, 0.0);
            outB = vec4(mass, width, 0.0, 2.0);
            return;
        }
        vec2 kick = (hash22(vec2(float(k), floor(st(0, ROW_GLOBAL).z * 7.0))) - vec2(0.5, 0.25)) * vec2(0.2, 0.2) * G;
        outA = vec4(r.x + xc, r.y + r.w + 0.5 * thick, vel * CARRY + kick);
        outB = vec4(mass, width, 0.0, 1.0 + 4.0 * float(heir + 1));
        return;
    }
    if (state == 1) {
        vec4 na;
        float ly;
        int land = clumpFall(a, b, na, ly);
        if (land == LAND_LOST) return;
        if (land == LAND_NONE) {
            outA = na;
            outB = vec4(b.xy, b.z + dt, b.w);
            return;
        }
        outA = vec4(na.x, ly, 0.0, 0.0);
        outB = vec4(b.xy, 0.0, 2.0);
        return;
    }
    float age = b.z + dt;
    if (age > PUFF_TIME) return;
    outA = a;
    outB = vec4(b.xy, age, b.w);
}

vec4 globalTexel(int x)
{
    float dt = iTimeDelta;
    vec4 g0 = st(0, ROW_GLOBAL);
    vec4 s = st(x, ROW_GLOBAL);
    float clock = mod(g0.z + dt, CLOCK_PERIOD);
    if (x == 0) {
        return vec4(min(g0.x + dt, 1e5), iMouse.z > 0.0 ? 1.0 : 0.0, clock, 1.0);
    }
    if (x <= 3) {
        float gust = 0.3 + 0.7 * gustAt(clock);
        int l = (x - 1) * 2;
        vec3 L0 = flakeLayer(l);
        vec3 L1 = flakeLayer(l + 1);
        vec4 o = vec4(mod(s.x + L0.y / L0.x * dt, 256.0), mod(s.y + L0.z / L0.x * gust * dt, 16384.0),
                      mod(s.z + L1.y / L1.x * dt, 256.0), mod(s.w + L1.z / L1.x * gust * dt, 16384.0));
        if (l + 1 >= NLAYER) o.zw = vec2(0.0);
        return o;
    }
    vec4 g8 = st(8, ROW_GLOBAL);
    bool press = pressStarted();
    if (x < 4 + NCLICK) {
        if (press && x - 4 == int(g8.x + 0.5)) return vec4(iMouse.xy, 0.0, 1.0);
        if (s.w > 0.5) s.z = min(s.z + dt, CLICK_TIME + 1.0);
        return s;
    }
    if (x == 8) {
        float falling = 0.0;
        for (int k = 0; k < NCLUMP; k++) {
            if (clumpStateOf(st(k, ROW_CLUMP + 1)) == 1) falling = 1.0;
        }
        int clicks = 0;
        for (int c = 0; c < NCLICK; c++) {
            vec4 cs = st(4 + c, ROW_GLOBAL);
            if ((cs.w > 0.5 && cs.z < CLICK_TIME) || (press && c == int(g8.x + 0.5))) clicks |= 1 << c;
        }
        float n = press ? mod(g8.x + 1.0, float(NCLICK)) : g8.x;
        return vec4(n, falling, gustAt(clock), float(clicks));
    }
    // Clumps not free, 16 per component, bit k % 16 of component k / 16.
    ivec4 m = ivec4(0);
    for (int k = 0; k < 16; k++) {
        int bit = 1 << k;
        if (clumpStateOf(st(k, ROW_CLUMP + 1)) != 0) m.x |= bit;
        if (clumpStateOf(st(16 + k, ROW_CLUMP + 1)) != 0) m.y |= bit;
        if (clumpStateOf(st(32 + k, ROW_CLUMP + 1)) != 0) m.z |= bit;
        if (clumpStateOf(st(48 + k, ROW_CLUMP + 1)) != 0) m.w |= bit;
    }
    return vec4(m);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    fragColor = vec4(0.0);
    if (ic.y == ROW_GROUND) {
        fragColor = groundTexel(ic.x);
    } else if (ic.y < ROW_PILE + NSLOT) {
        fragColor = windowPileTexel(ic.y - ROW_PILE, ic.x);
    } else if (ic.y == ROW_SLOT) {
        if (ic.x < 2 * NSLOT) fragColor = slotTexel(ic.x);
    } else if (ic.y == ROW_CLUMP || ic.y == ROW_CLUMP + 1) {
        if (ic.x < NCLUMP) {
            vec4 a, b;
            clumpUpdate(ic.x, a, b);
            fragColor = ic.y == ROW_CLUMP ? a : b;
        }
    } else if (ic.y == ROW_GLOBAL) {
        if (ic.x <= 9) fragColor = globalTexel(ic.x);
    }
}
