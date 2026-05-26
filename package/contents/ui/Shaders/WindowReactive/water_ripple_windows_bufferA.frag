// Water simulation — Shadertoy wave PDE + anti-checkerboard mitigation.
//
// Why this approach:
//   * A discrete-grid wave equation is the only way to get those nice
//     EXPANDING ripples from a disturbance (procedural fakes can't do
//     that without per-event history tracking).
//   * The 5-point discrete Laplacian has unstable high-frequency modes
//     (full checkerboard, axis-aligned stripes). When we stamp energy
//     into the field every frame, those modes can grow and produce the
//     visible plaid we saw on the wallpaper.
//
// Mitigations layered here:
//   1) HIGH-FREQ DIFFUSION (5% per step). After the PDE update, pressure
//      is blended 5% toward the 5-point neighbor average. Smooth modes
//      have tiny Laplacian so they're barely affected; checkerboard mode
//      has huge Laplacian so it gets killed fast.
//   2) WIDER OUTPUT GRADIENT. The .zw channels of this buffer feed the
//      image pass's refraction. We sample 2 pixels apart instead of 1,
//      which zeroes the 2-pixel-period stripe mode in the gradient even
//      if a trace of it survives the diffusion.
//   3) STAMPS CLAMPED. The total disturbance added to a pixel each frame
//      is capped at 1.0 — the same amplitude Shadertoy uses for a click,
//      which we know is well inside the PDE's stable region.
//   4) PRESSURE CLAMPED. Belt-and-suspenders: even if something exceeds
//      the stamp cap, pressure can't escape [-2, 2].
//
// Disturbance sources:
//   * Mouse: smooth SEGMENT trail from iMousePrev -> iMouse so a fast
//     cursor doesn't leave a sparse string of dots (which read as stutter).
//   * Window: per-axis bow wave driven by iWindowVelocities. On diagonals
//     BOTH leading faces wake (top + left when moving NW), each weighted
//     by |md.x| / |md.y|. Push is continuous between WindowTracker polls
//     because velocity stays valid (~30Hz poll, 60Hz render).

const float delta = 1.0;

const float MOUSE_R    = 20.0;
const float WIN_CORNER = 16.0;
const float WIN_REACH  = 20.0;

float distToSegment(vec2 p, vec2 a, vec2 b)
{
    vec2 ab = b - a;
    float ab2 = dot(ab, ab);
    if (ab2 < 1e-4) return distance(p, a);
    float t = clamp(dot(p - a, ab) / ab2, 0.0, 1.0);
    return distance(p, a + ab * t);
}

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

// 2-axis leading-face push. Cardinal motion: one face. Diagonal: two
// faces weighted by axis fraction.
float leadingExteriorPush(vec2 p, vec4 r, vec2 dir)
{
    if (length(dir) < 1e-4) return 0.0;

    vec2 center = r.xy + r.zw * 0.5;
    vec2 halfSize = r.zw * 0.5;
    float d = sdRoundedBox(p, center, halfSize, WIN_CORNER);
    if (d <= 0.0 || d > WIN_REACH) return 0.0;

    vec2 md = normalize(dir);
    float faceSum = 0.0;

    if (abs(md.x) > 1e-3) {
        vec2 outward = vec2(sign(md.x), 0.0);
        vec2 edgeMid = vec2(outward.x > 0.0 ? (r.x + r.z) : r.x, center.y);
        float inFront = dot(p - edgeMid, outward);
        float faceW = smoothstep(-MOUSE_R * 0.35, MOUSE_R, inFront);
        faceSum += faceW * abs(md.x);
    }
    if (abs(md.y) > 1e-3) {
        vec2 outward = vec2(0.0, sign(md.y));
        vec2 edgeMid = vec2(center.x, outward.y > 0.0 ? (r.y + r.w) : r.y);
        float inFront = dot(p - edgeMid, outward);
        float faceW = smoothstep(-MOUSE_R * 0.35, MOUSE_R, inFront);
        faceSum += faceW * abs(md.y);
    }

    if (faceSum <= 0.0) return 0.0;
    float hullW = 1.0 - d / WIN_REACH;
    hullW *= hullW;
    return hullW * faceSum;
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

    ivec2 ifc = ivec2(fragCoord);
    float pressure = texelFetch(iChannel0, ifc, 0).x;
    float pVel     = texelFetch(iChannel0, ifc, 0).y;

    // 1-pixel neighbors — used for the PDE step and for diffusion.
    float p_right = texelFetch(iChannel0, ifc + ivec2( 1,  0), 0).x;
    float p_left  = texelFetch(iChannel0, ifc + ivec2(-1,  0), 0).x;
    float p_up    = texelFetch(iChannel0, ifc + ivec2( 0,  1), 0).x;
    float p_down  = texelFetch(iChannel0, ifc + ivec2( 0, -1), 0).x;

    // Reflective boundary so waves bounce off the screen edges cleanly.
    if (fragCoord.x <= 1.0)                       p_left  = p_right;
    if (fragCoord.x >= iResolution.x - 1.0)       p_right = p_left;
    if (fragCoord.y <= 1.0)                       p_down  = p_up;
    if (fragCoord.y >= iResolution.y - 1.0)       p_up    = p_down;

    // Standard 5-point wave PDE (Shadertoy original).
    pVel += delta * (-2.0 * pressure + p_right + p_left) / 4.0;
    pVel += delta * (-2.0 * pressure + p_up    + p_down) / 4.0;
    pressure += delta * pVel;
    pVel     -= 0.005 * delta * pressure;
    pVel     *= 1.0 - 0.002 * delta;
    pressure *= 0.999;

    // (1) High-frequency diffusion. The 5-point neighbor average is the
    // pressure of an idealised "smooth" field around this cell; blending
    // toward it kills checkerboard / stripe modes without dulling waves.
    float pAvg = (p_right + p_left + p_up + p_down) * 0.25;
    pressure = mix(pressure, pAvg, 0.05);

    // --- Accumulate stamps (mouse + windows) -----------------------------
    float stamp = 0.0;
    bool windowsBusy = anyWindowActive();

    if (!windowsBusy) {
        vec2 a = iMousePrev;
        vec2 b = iMouse.xy;
        bool aValid = a.x >= 0.0 && a.y >= 0.0 && a.x <= iResolution.x && a.y <= iResolution.y;
        bool bValid = b.x >= 0.0 && b.y >= 0.0 && b.x <= iResolution.x && b.y <= iResolution.y;
        bool aNonzero = (a.x > 1.0 || a.y > 1.0);
        bool bNonzero = (b.x > 1.0 || b.y > 1.0);
        if (aValid && bValid && aNonzero && bNonzero) {
            float len2 = dot(b - a, b - a);
            if (len2 < 360000.0) {
                stamp += mouseTrail(fragCoord, a, b);
            }
        }
    }

    float dt = clamp(iTimeDelta, 1.0/240.0, 1.0/30.0);
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec2 vel = iWindowVelocities[i];
        float velMag = length(vel);
        if (velMag < 30.0) continue;
        float frameMove = clamp(velMag * dt * 0.25, 0.0, 1.0);
        // 0.5 keeps multiple overlapping windows from saturating.
        stamp += 0.5 * frameMove * leadingExteriorPush(fragCoord, iWindowRects[i], vel);
    }

    // (3) Clamp total per-pixel stamp to the same amplitude as one
    // Shadertoy click — proven stable.
    pressure += min(stamp, 1.0);

    // (4) Belt-and-suspenders pressure clamp.
    pressure = clamp(pressure, -2.0, 2.0);

    // (2) Wider output gradient — sample 2 pixels apart so the
    // 2-pixel-period stripe mode is mathematically zero in the gradient
    // that the image pass uses for refraction. Plaid-immune by design.
    float p_right2 = texelFetch(iChannel0, ifc + ivec2( 2,  0), 0).x;
    float p_left2  = texelFetch(iChannel0, ifc + ivec2(-2,  0), 0).x;
    float p_up2    = texelFetch(iChannel0, ifc + ivec2( 0,  2), 0).x;
    float p_down2  = texelFetch(iChannel0, ifc + ivec2( 0, -2), 0).x;
    if (fragCoord.x <= 2.0)                       p_left2  = p_right2;
    if (fragCoord.x >= iResolution.x - 2.0)       p_right2 = p_left2;
    if (fragCoord.y <= 2.0)                       p_down2  = p_up2;
    if (fragCoord.y >= iResolution.y - 2.0)       p_up2    = p_down2;

    fragColor = vec4(
        pressure,
        pVel,
        (p_right2 - p_left2) / 4.0,   // /(2 * stencil_width) = /4
        (p_up2    - p_down2) / 4.0
    );
}
