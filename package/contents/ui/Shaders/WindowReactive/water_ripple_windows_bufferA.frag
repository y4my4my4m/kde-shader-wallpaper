// Water simulation — exact port of Shadertoy https://www.shadertoy.com/view/wdtyDH (Buffer A).
//
// Runs at FULL native resolution with the original 1-pixel stencil: the
// same fine ripples and 20-pixel click cone you get running the Shadertoy
// fullscreen on this monitor. PDE, damping and output layout are the
// original, byte for byte.
//
// Adaptations:
//
//   1) TIMESTEP. The original advances delta=1.0 once per frame, so its
//      wave speed and decay are proportional to FPS. Here the sim must be
//      FPS-independent (only shaderSpeed may change the feel). A single
//      pass can't substep (neighbours come from last frame's texture), so
//      the frame's time budget D = iTimeDelta * REF_FPS is split between
//      the stencil SPACING h and the step size: lattice wave speed goes
//      as h * sqrt(delta) per step, so h = ceil(D), delta = (D/h)^2 keeps
//      pixels-per-second constant at any FPS. Low FPS trades fine ripple
//      detail (coarser stencil) for correct speed, never the other way.
//      Damping is applied as exp(-rate * D): time-based, FPS-independent,
//      tuned to settle like https://www.shadertoy.com/view/dldSR7
//      (0.98/frame at 60fps) rather than the original's near-immortal
//      0.998/step.
//
//   2) DISTURBANCES. Shadertoy stamps a radius-20 cone while the mouse
//      button is held; the cursor here stamps the same cone along its
//      movement segment (iMousePrev -> iMouse) — dragging with the button
//      down, permanently. Windows float like planks: while moving they
//      press a shallow ring imprint around their outline and the PDE
//      radiates the bow wave / wake itself. Constraints, not impulses —
//      no energy accumulation, no standing plaid.

const float MOUSE_R  = 20.0;   // Shadertoy click radius, native pixels
const float REF_FPS  = 240.0;  // timestep reference ("the feel")

const float WIN_CORNER = 16.0; // window hull corner radius
const float WIN_BAND   = 32.0; // ring imprint half-width around the hull

float distToSegment(vec2 p, vec2 a, vec2 b)
{
    vec2 ab = b - a;
    float ab2 = dot(ab, ab);
    if (ab2 < 1e-4) return distance(p, a);
    float t = clamp(dot(p - a, ab) / ab2, 0.0, 1.0);
    return distance(p, a + ab * t);
}

// Original: fragColor.x += 1.0 - dist / 20.0, applied along the drag segment.
float mouseTrail(vec2 p, vec2 a, vec2 b)
{
    float d = distToSegment(p, a, b);
    if (d > MOUSE_R) return 0.0;
    return 1.0 - d / MOUSE_R;
}

float sdRoundedBox(vec2 p, vec2 center, vec2 halfSize, float cornerR)
{
    vec2 q = abs(p - center) - halfSize + cornerR;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cornerR;
}

bool anyWindowActive()
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        if (length(iWindowVelocities[i]) > 30.0) return true;
    }
    return false;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    if (iFrame == 0) {
        fragColor = vec4(0.0);
        return;
    }

    // Frame time budget in reference steps. Split into stencil spacing h
    // and per-step delta so wave speed (px/sec) is the same at any FPS:
    // lattice speed ~ h * sqrt(delta) per step, so keep h*sqrt(delta) = D
    // with delta capped at 1.0 (the original's proven-stable step — 1.4
    // is where instability begins under continuous forcing).
    float D = clamp(iTimeDelta * REF_FPS, 0.05, 8.0);
    int   h = int(ceil(D));
    float delta = clamp((D / float(h)) * (D / float(h)), 0.05, 1.0);

    ivec2 ifc = ivec2(fragCoord);
    float pressure = texelFetch(iChannel0, ifc, 0).x;
    float pVel     = texelFetch(iChannel0, ifc, 0).y;

    float p_right = texelFetch(iChannel0, ifc + ivec2( h,  0), 0).x;
    float p_left  = texelFetch(iChannel0, ifc + ivec2(-h,  0), 0).x;
    float p_up    = texelFetch(iChannel0, ifc + ivec2( 0,  h), 0).x;
    float p_down  = texelFetch(iChannel0, ifc + ivec2( 0, -h), 0).x;

    // Change values so the screen boundaries aren't fixed.
    float fh = float(h);
    if (fragCoord.x < fh)                      p_left  = p_right;
    if (fragCoord.x > iResolution.x - fh)      p_right = p_left;
    if (fragCoord.y < fh)                      p_down  = p_up;
    if (fragCoord.y > iResolution.y - fh)      p_up    = p_down;

    // Apply horizontal wave function
    pVel += delta * (-2.0 * pressure + p_right + p_left) / 4.0;
    // Apply vertical wave function (these could just as easily have been one line)
    pVel += delta * (-2.0 * pressure + p_up + p_down) / 4.0;

    // Change pressure by pressure velocity
    pressure += delta * pVel;

    // "Spring" motion. This makes the waves look more like water waves
    // and less like sound waves.
    pVel -= 0.005 * D * pressure;

    // Damping, time-based (exp(-rate*D), FPS-independent). Rates chosen to
    // settle like dldSR7's 0.98/frame at 60fps (~exp(-1.2)/sec): ripples
    // ring for a moment, then the surface actually calms down.
    pVel     *= exp(-0.005 * D);
    pressure *= exp(-0.002 * D);

    // --- Cursor ripples ---------------------------------------------------
    float stamp = 0.0;
    bool windowsBusy = anyWindowActive();

    // Suppressed while a window is moving (the drag cursor sits inside the
    // window; stamping there looks wrong).
    if (!windowsBusy) {
        vec2 a = iMousePrev;
        vec2 b = iMouse.xy;
        bool aValid = a.x >= 0.0 && a.y >= 0.0 && a.x <= iResolution.x && a.y <= iResolution.y;
        bool bValid = b.x >= 0.0 && b.y >= 0.0 && b.x <= iResolution.x && b.y <= iResolution.y;
        bool aNonzero = (a.x > 1.0 || a.y > 1.0);
        bool bNonzero = (b.x > 1.0 || b.y > 1.0);
        // Only stamp while the cursor is moving — the wallpaper equivalent
        // of Shadertoy's "while mouse button held" drag.
        bool moved = dot(b - a, b - a) > 0.25;
        if (aValid && bValid && aNonzero && bNonzero && moved) {
            float len2 = dot(b - a, b - a);
            // Ignore teleports (cursor warped across screens; 600px/frame).
            if (len2 < 360000.0) {
                stamp += mouseTrail(fragCoord, a, b);
            }
        }
    }

    // Cap at the amplitude of one Shadertoy click.
    pressure += min(stamp, 1.0);

    // --- Window hulls: floating-plank ring imprint --------------------------
    // A moving window presses the surface toward a shallow depression in a
    // ring around its outline (the wake physically forms at the hull edge —
    // pressing the whole underside displaces a huge volume and sloshes).
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec2 vel = iWindowVelocities[i];
        float speed = length(vel);
        if (speed < 30.0) continue;

        vec4 r = iWindowRects[i];
        vec2 center = r.xy + r.zw * 0.5;
        vec2 halfSize = r.zw * 0.5;
        float d = sdRoundedBox(fragCoord, center, halfSize, WIN_CORNER);
        if (abs(d) > WIN_BAND) continue;

        // Smooth bump centred on the outline, zero WIN_BAND away on
        // either side.
        float ring = 1.0 - abs(d) / WIN_BAND;
        ring = ring * ring * (3.0 - 2.0 * ring);

        // Press harder the faster the window moves (full depth at a brisk
        // drag, native pixels/second).
        float strength = clamp(speed / 600.0, 0.0, 1.0);

        // Full-depth constraint: the depression amplitude matches a cursor
        // stamp (1.0 — one Shadertoy click), so window wakes read as
        // strongly as cursor ripples. Still a constraint, not an impulse:
        // pressure is pinned toward a fixed depth, so no energy can
        // accumulate along the hull (the old standing-plaid failure mode).
        float k = clamp(ring * strength * min(D, 1.0), 0.0, 1.0);
        pressure = mix(pressure, -1.0 * strength, k);
        pVel     = mix(pVel, 0.0, k);
    }

    // Hard backstop: no physical wave here ever exceeds ~1.5 (one click
    // plus superposition). If anything drifts toward instability it hits
    // this wall and damps out instead of snowballing across the screen.
    pressure = clamp(pressure, -2.0, 2.0);
    pVel     = clamp(pVel, -2.0, 2.0);

    // x = pressure. y = pressure velocity. Z and W = X and Y gradient —
    // divided by the stencil spacing so refraction/glint magnitude in the
    // image pass doesn't change with FPS.
    fragColor = vec4(pressure, pVel, (p_right - p_left) / (2.0 * fh), (p_up - p_down) / (2.0 * fh));
}
