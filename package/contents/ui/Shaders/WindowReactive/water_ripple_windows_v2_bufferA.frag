// Water Ripple v2 — Buffer A: height-field simulation.
// @channels self
// @sim-max-height 600
//
// State per cell: x = height, y = vertical velocity, zw = height gradient
// (central difference, height units per cell).
//
// Scheme: the wdtyDH 5-point wave equation with its 1-cell stencil and
// "spring" term, integrated with symplectic Euler at delta = D <= 1. The
// engine substeps buffer passes to ~240 steps/s and hands each pass its share
// of the frame in iTimeDelta, so D = iTimeDelta * 240 stays near 1 at any
// render FPS. Wave speed is delta/2 cells per step: 120 cells/s, about a
// fifth of the screen height per second on the 600-row grid requested above.
//
// Every disturbance is a constraint (height pulled toward a target at a rate
// of 1 - exp(-rate * D)), never an additive impulse: per-step impulses scale
// with the substep count and pile energy into a standing checkerboard.
//
// Deviations from v1:
//   * Coarse grid (@sim-max-height). Ripple size and cost no longer scale
//     with monitor resolution.
//   * Absorbing border: a sponge layer damps waves leaving the screen, so the
//     surface reads as open water instead of a bathtub.
//   * Resting windows are walls: the surface under them is held flat, so
//     ripples reflect off window edges. A moving window raises a bow wave on
//     its leading edge and a trough on its trailing edge.
//   * The cursor wake depth follows cursor speed; a press without motion
//     drops a splash.
//   * Window and cursor positions are interpolated across the frame's
//     substeps (iSubstep / iSubsteps), so wakes are the same at 30 and
//     240 FPS.
//   * Biharmonic velocity filter removes grid-scale noise behind obstacles
//     that outrun the wave speed.
//   * Sparse rain keeps the surface alive when nothing moves.

const float REF_FPS       = 240.0;  // substep rate the sim is tuned for

const float CURSOR_R      = 12.0;   // finger radius, cells
const float CURSOR_DEPTH  = 1.6;    // depth at a brisk drag
const float CURSOR_RATE   = 0.35;   // constraint stiffness per step
const float SPLASH_R      = 9.0;
const float SPLASH_DEPTH  = 1.6;

const float WIN_CORNER    = 10.0;   // window corner radius, cells
const float WIN_BAND      = 18.0;   // bow/stern band width outside the hull
const float WIN_AMP       = 1.1;    // bow height at full speed
const float WIN_FULL_SPD  = 380.0;  // cells/s at which the wake saturates
const float WIN_RATE      = 0.12;
const float WALL_SOFT     = 3.0;    // wall ramp width inside the hull, cells

const float RAIN_PER_SEC  = 0.45;   // drops per second per stream (2 streams)
const float RAIN_R        = 5.0;
const float RAIN_DEPTH    = 0.55;

const float SPRING        = 0.005;  // wdtyDH restoring term
const float DAMP_VEL      = 0.0028; // per step; exp(-0.67)/s at 240 steps/s
const float DAMP_HEIGHT   = 0.0012;
// Stable while 64 * HYPERVISCOSITY + 8 * VISCOSITY <= 1 (velocity factor at
// the Nyquist mode stays non-negative under the wave coupling).
const float VISCOSITY      = 0.01;
const float HYPERVISCOSITY = 0.012;
const float SPONGE_CELLS  = 24.0;
const float SPONGE_RATE   = 0.06;

vec4 cell(ivec2 c, ivec2 hi)
{
    return texelFetch(iChannel0, clamp(c, ivec2(0), hi), 0);
}

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2  hash21(float n) { return fract(sin(vec2(n * 127.1, n * 311.7)) * 43758.5453); }

float sdRoundedBox(vec2 p, vec2 center, vec2 halfSize, float r)
{
    vec2 q = abs(p - center) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Outward unit normal of the rounded box at p (finite difference of the SDF).
vec2 boxNormal(vec2 p, vec2 center, vec2 halfSize, float r)
{
    const vec2 e = vec2(0.5, 0.0);
    vec2 g = vec2(sdRoundedBox(p + e.xy, center, halfSize, r) - sdRoundedBox(p - e.xy, center, halfSize, r),
                  sdRoundedBox(p + e.yx, center, halfSize, r) - sdRoundedBox(p - e.yx, center, halfSize, r));
    float l = length(g);
    return l > 1e-5 ? g / l : vec2(0.0);
}

float distToSegment(vec2 p, vec2 a, vec2 b)
{
    vec2 ab = b - a;
    float ab2 = dot(ab, ab);
    if (ab2 < 1e-4) return distance(p, a);
    float t = clamp(dot(p - a, ab) / ab2, 0.0, 1.0);
    return distance(p, a + ab * t);
}

// Smooth compact bump: 1 at r = 0, 0 at r >= R, zero slope at both ends.
float bump(float r, float R)
{
    float x = clamp(r / R, 0.0, 1.0);
    float c = 0.5 + 0.5 * cos(3.14159265 * x);
    return c * c;
}

// Pull v toward target with per-step stiffness `rate`, FPS-independent.
void constrain(inout float h, inout float v, float target, float rate, float weight, float D)
{
    float k = (1.0 - exp(-rate * D)) * clamp(weight, 0.0, 1.0);
    h = mix(h, target, k);
    v = mix(v, 0.0, k);
}

bool onScreen(vec2 p)
{
    return p.x > 1.0 && p.y > 1.0 && p.x < iResolution.x - 1.0 && p.y < iResolution.y - 1.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    if (iFrame == 0) {
        fragColor = vec4(0.0);
        return;
    }

    // Do not trade substeps for a wider stencil: a spacing of h > 1 cells
    // splits the lattice into h^2 uncoupled sub-grids and the decoupled
    // checkerboard mode grows without bound.
    float D = clamp(iTimeDelta * REF_FPS, 0.05, 1.0);

    ivec2 ic = ivec2(fragCoord);
    ivec2 hi = ivec2(iResolution.xy) - 1;
    vec4 s  = texelFetch(iChannel0, ic, 0);
    float h = s.x;
    float v = s.y;
    // Clamped fetches: a border cell's missing neighbour is itself.
    vec2 nR = cell(ic + ivec2( 1,  0), hi).xy;
    vec2 nL = cell(ic + ivec2(-1,  0), hi).xy;
    vec2 nU = cell(ic + ivec2( 0,  1), hi).xy;
    vec2 nD = cell(ic + ivec2( 0, -1), hi).xy;
    float hR = nR.x, hL = nL.x, hU = nU.x, hD = nD.x;

    // Velocity filter: biharmonic term (13-point stencil, eigenvalue up to
    // 64 at the Nyquist checkerboard, ~0.02 for a 16-cell ripple) plus a
    // little plain viscosity. Grid-scale wake noise from obstacles moving
    // faster than the 120 cells/s wave speed dies within a few steps; the
    // visible ripples are not touched.
    float vSum4 = nR.y + nL.y + nU.y + nD.y;
    float vDiag = cell(ic + ivec2( 1,  1), hi).y + cell(ic + ivec2(-1,  1), hi).y
                + cell(ic + ivec2( 1, -1), hi).y + cell(ic + ivec2(-1, -1), hi).y;
    float vFar  = cell(ic + ivec2( 2,  0), hi).y + cell(ic + ivec2(-2,  0), hi).y
                + cell(ic + ivec2( 0,  2), hi).y + cell(ic + ivec2( 0, -2), hi).y;
    float lapV = vSum4 - 4.0 * v;
    float biLapV = 20.0 * v - 8.0 * vSum4 + 2.0 * vDiag + vFar;

    v += D * (hR + hL + hU + hD - 4.0 * h) / 4.0;
    v += D * (VISCOSITY * lapV - HYPERVISCOSITY * biLapV);
    h += D * v;
    v -= SPRING * D * h;
    v *= exp(-DAMP_VEL * D);
    h *= exp(-DAMP_HEIGHT * D);

    // Sponge layer: waves fade out at the screen border instead of bouncing.
    float edge = min(min(fragCoord.x, iResolution.x - fragCoord.x),
                     min(fragCoord.y, iResolution.y - fragCoord.y));
    float sponge = 1.0 - smoothstep(0.0, SPONGE_CELLS, edge);
    v *= exp(-SPONGE_RATE * sponge * sponge * D);
    h *= exp(-SPONGE_RATE * 0.5 * sponge * sponge * D);

    // Inputs advance once per rendered frame while this pass runs several
    // substeps. Each substep sees its share of the frame's motion, so a fast
    // window or cursor sweeps across the lattice instead of jumping.
    float f0 = float(iSubstep) / float(max(iSubsteps, 1));
    float f1 = float(iSubstep + 1) / float(max(iSubsteps, 1));

    // --- Windows ----------------------------------------------------------
    bool windowMoving = false;
    float wall = 0.0;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 2.0 || r.w < 2.0) continue;
        vec4 rp = iWindowRectsPrev[i];
        // A previous rect of another size or far away is a different window
        // (stacking order changed) or the first frame: no interpolation.
        if (all(lessThan(abs(rp.zw - r.zw), vec2(1.0))) && distance(rp.xy, r.xy) < 0.2 * iResolution.y)
            r.xy = mix(rp.xy, r.xy, f1);
        vec2 halfSize = r.zw * 0.5;
        vec2 center = r.xy + halfSize;
        float d = sdRoundedBox(fragCoord, center, halfSize, WIN_CORNER);
        vec2 vel = iWindowVelocities[i];
        float speed = length(vel);
        if (speed > 20.0) windowMoving = true;

        // Soft wall (3-cell ramp; a hard edge moving one cell at a time
        // radiates grid-scale noise). A moving window stops being a wall:
        // sweeping a pinned region faster than the wave speed sheds
        // grid-scale ripples, so its wake comes from the bow/stern band.
        float s01 = smoothstep(20.0, WIN_FULL_SPD, speed);
        wall = max(wall, smoothstep(1.0, -WALL_SOFT, d) * (1.0 - s01));
        if (speed < 20.0 || d < 0.0 || d > WIN_BAND) continue;

        // Bow wave ahead of the hull, trough behind it, nothing alongside.
        // The band rises from zero at the hull so it meets the wall smoothly.
        vec2 n = boxNormal(fragCoord, center, halfSize, WIN_CORNER);
        float lead = dot(n, vel / speed);
        float band = sin(3.14159265 * d / WIN_BAND);
        band *= band;
        float target = WIN_AMP * s01 * (lead > 0.0 ? lead : 0.6 * lead);
        constrain(h, v, target, WIN_RATE, band * abs(lead) * (0.35 + 0.65 * s01), D);
    }

    // --- Cursor -------------------------------------------------------------
    vec2 mPrev = iMousePrev;
    vec2 mCur = iMouse.xy;
    vec2 a = mix(mPrev, mCur, f0);
    vec2 b = mix(mPrev, mCur, f1);
    if (!windowMoving && onScreen(mPrev) && onScreen(mCur)) {
        vec2 seg = mCur - mPrev;
        float len2 = dot(seg, seg);
        // 0.25 cell^2 dead zone; > 300 cells per frame is a cross-screen warp.
        if (len2 > 0.25 && len2 < 90000.0) {
            // iMousePrev is one RENDER frame old; iTimeDelta here is a
            // substep's share, so the frame period comes from iFrameRate.
            float speed = sqrt(len2) * max(iFrameRate, 1.0);   // cells/s
            float depth = CURSOR_DEPTH * smoothstep(20.0, 500.0, speed);
            float w = bump(distToSegment(fragCoord, a, b), CURSOR_R);
            if (w > 0.0) constrain(h, v, -depth, CURSOR_RATE, w, D);
        }
    }
    // Press without drag: the held cursor keeps a dimple, the PDE turns its
    // onset into an outgoing ring.
    if (iMouse.z > 0.0 && onScreen(mCur) && distance(mPrev, mCur) < 0.5 && !windowMoving) {
        float w = bump(distance(fragCoord, mCur), SPLASH_R);
        if (w > 0.0) constrain(h, v, -SPLASH_DEPTH, 0.08, w, D);
    }

    // --- Rain ---------------------------------------------------------------
    for (int stream = 0; stream < 2; stream++) {
        float fs = float(stream);
        float slot = floor(iTime * RAIN_PER_SEC + fs * 0.37);
        float seed = slot * 1.618 + fs * 17.0;
        float tIn = fract(iTime * RAIN_PER_SEC + fs * 0.37) / RAIN_PER_SEC;
        float t0 = hash11(seed) * 0.6 / RAIN_PER_SEC;
        if (tIn > t0 && tIn < t0 + 0.06) {
            vec2 c = (0.08 + 0.84 * hash21(seed + 3.1)) * iResolution.xy;
            float amp = RAIN_DEPTH * (0.5 + 0.5 * hash11(seed + 7.7));
            float w = bump(distance(fragCoord, c), RAIN_R);
            if (w > 0.0) constrain(h, v, -amp, 0.25, w, D);
        }
    }

    // Walls last: the surface under a window is held flat, so ripples
    // reflect off window edges.
    h *= 1.0 - wall;
    v *= 1.0 - wall;

    // No physical state here exceeds ~2; the clamp turns a numerical runaway
    // into a damped plateau instead of a screen-wide blow-up.
    h = clamp(h, -3.0, 3.0);
    v = clamp(v, -3.0, 3.0);

    fragColor = vec4(h, v, (hR - hL) * 0.5, (hU - hD) * 0.5);
}
