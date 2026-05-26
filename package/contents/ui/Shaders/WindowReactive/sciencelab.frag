// Aperture Science — desktop test chamber.
//
// Theme: clean, sterile, scientific. Portal palette (cyan / orange).
//   * Subtle test-chamber tile background — wallpaper visible through it.
//   * Each window has a thin glowing border + soft halo.
//     Idle windows pulse cyan; MOVING windows flash safety orange
//     (Aperture's "active surface" colour).
//   * Energy beams between adjacent windows: clean lines with a single
//     pulse travelling along them (NOT chaotic lightning).
//   * Mouse cursor = portal ring opening at the pointer position.
//   * Cool tint + vignette to sell the lab feel.
//
// All effects are analytical / single-pass — no feedback buffer, no PDE,
// no chance of the simulation going unstable.

// -------------------- palette (Aperture Science) --------------------
const vec3 APERTURE_CYAN   = vec3(0.20, 0.70, 1.00);   // portal blue
const vec3 APERTURE_ORANGE = vec3(1.00, 0.55, 0.10);   // portal orange
const vec3 LAB_TINT        = vec3(0.85, 0.95, 1.05);   // cool wallpaper grade
const vec3 TILE_GROUT      = vec3(0.04, 0.05, 0.07);   // dark seams between tiles
const vec3 TILE_HIGHLIGHT  = vec3(1.00, 1.00, 1.00);   // subtle tile light edge

// -------------------- tuning ----------------------------------------
const float TILE_SIZE_PX   = 96.0;   // chamber tile size in screen pixels
const float TILE_LINE_PX   = 1.2;    // grout line thickness
const float BORDER_REACH   = 70.0;   // how far the window halo extends
const float BEAM_RANGE_PX  = 420.0;  // beam connection max gap
const float MOUSE_RING_R   = 42.0;   // portal ring radius in px
const float MOUSE_RING_W   = 6.0;    // ring thickness

// -------------------- helpers ---------------------------------------
float sdRoundedBox(vec2 p, vec2 center, vec2 halfSize, float cornerR) {
    vec2 q = abs(p - center) - halfSize + cornerR;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cornerR;
}

// Anti-aliased line: 1.0 at edge, 0.0 inside / far outside.
float aaLine(float dist, float halfWidth) {
    float pxScale = max(1.0, length(fwidth(vec2(dist))));
    return 1.0 - smoothstep(halfWidth - pxScale, halfWidth + pxScale, abs(dist));
}

// Tile grid: returns intensity of grout line at this pixel.
// float chamberTiles(vec2 fragCoord) {
//     vec2 t = fragCoord / TILE_SIZE_PX;
//     vec2 f = abs(fract(t) - 0.5);
//     vec2 d = 0.5 - f;                       // distance to nearest cell edge
//     float edge = min(d.x, d.y) * TILE_SIZE_PX;
//     return 1.0 - smoothstep(0.0, TILE_LINE_PX, edge);
// }

// Window border + soft outer halo. Returns vec2(line, halo) for separate tinting.
vec2 windowFrame(vec2 fragCoord, vec4 r) {
    vec2 center   = r.xy + r.zw * 0.5;
    vec2 halfSize = r.zw * 0.5;
    float d = sdRoundedBox(fragCoord, center, halfSize, 4.0);

    // Crisp 2px line right at the edge (works both inside & outside).
    float line = exp(-abs(d) * 0.55);
    line = pow(line, 2.0);

    // Soft outward halo only — doesn't bleed into the window interior.
    float halo = exp(-max(d, 0.0) / BORDER_REACH * 4.0);
    halo *= step(0.0, d);   // outside only

    return vec2(line, halo);
}

// Closest-point on a rounded-rect perimeter to a target point — used to
// pick where to anchor a beam (cleaner than rect centers, especially
// for big windows that are close at one corner).
vec2 nearestBoxPoint(vec2 target, vec4 r) {
    vec2 center = r.xy + r.zw * 0.5;
    vec2 halfSize = r.zw * 0.5;
    return center + clamp(target - center, -halfSize, halfSize);
}

// Sterile beam between two anchor points: a constant soft line with ONE
// pulse travelling end-to-end on a slow loop. Looks like a scanning probe.
vec2 beam(vec2 p, vec2 a, vec2 b, float pulseSeed) {
    vec2 ab = b - a;
    float lenAB = length(ab);
    if (lenAB < 1.0) return vec2(0.0);

    vec2 dir = ab / lenAB;
    vec2 ap = p - a;
    float t = dot(ap, dir);
    if (t < -2.0 || t > lenAB + 2.0) return vec2(0.0);

    float tc = clamp(t, 0.0, lenAB);
    vec2 closest = a + dir * tc;
    float perp = distance(p, closest);

    // Base beam: thin glow line.
    float beam = exp(-perp * 0.18);

    // Single travelling pulse — period ~3.5 sec, seeded per pair so they
    // don't all fire in sync.
    float period = 3.5;
    float pulseT = fract((iTime + pulseSeed) / period);
    float pulsePos = pulseT * lenAB;
    // Gaussian along the beam, tight in the perpendicular direction.
    float along = exp(-pow(tc - pulsePos, 2.0) * 0.0012);
    float across = exp(-perp * 0.35);
    float pulse = along * across;

    return vec2(beam, pulse);  // x=line, y=pulse
}

// Portal ring at the mouse cursor. Two coaxial rings cross-fading
// orange (outer) -> cyan (inner) for the Aperture portal feel.
// vec2 portalRing(vec2 p, vec2 center) {
//     float d = distance(p, center);
//     float ring = exp(-pow(d - MOUSE_RING_R, 2.0) / (MOUSE_RING_W * MOUSE_RING_W));
//     float core = exp(-d * 0.08);
//     return vec2(ring, core);
// }

// -------------------- main ------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 wallpaper = texture(iChannel1, uv).rgb;

    // 1) Lab grade: pull toward a cool tint, hold luminance.
    float luma = dot(wallpaper, vec3(0.2126, 0.7152, 0.0722));
    vec3 lab = mix(wallpaper, luma * LAB_TINT, 0.25);
    lab *= 0.78;   // overall darken for "monitor" vibe

    // 2) Test-chamber tile overlay. Dark grout + faint bright edge ridge
    // so it reads as physical tile rather than a flat grid.
    // float grout = chamberTiles(fragCoord);
    // lab = mix(lab, TILE_GROUT, grout * 0.65);
    // lab += TILE_HIGHLIGHT * grout * 0.03;

    // 3) Window frames + halos. Cyan when idle, orange when moving.
    // Track "any window moving" so the mouse ring matches the mood.
    vec3 borderAdd = vec3(0.0);
    bool anyMoving = false;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec2 lh = windowFrame(fragCoord, iWindowRects[i]);
        float vmag = length(iWindowVelocities[i]);
        float motion = smoothstep(40.0, 400.0, vmag);
        if (vmag > 30.0) anyMoving = true;

        vec3 col = mix(APERTURE_CYAN, APERTURE_ORANGE, motion);
        // Crisp edge brighter than the halo; motion intensifies both.
        borderAdd += col * (lh.x * (1.4 + motion * 0.6)
                          + lh.y * (0.55 + motion * 0.4));
    }
    lab += borderAdd;

    // 4) Scanning beams between adjacent windows. We anchor at the
    // closest point on each rect (perimeter clamp) so beams visually
    // connect to the window edges, not floating centers.
    vec3 beamAdd = vec3(0.0);
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        for (int j = i + 1; j < iWindowCount && j < 16; j++) {
            vec4 ri = iWindowRects[i];
            vec4 rj = iWindowRects[j];
            vec2 ci = ri.xy + ri.zw * 0.5;
            vec2 cj = rj.xy + rj.zw * 0.5;
            // Anchor closest perimeter point of each rect toward the other.
            vec2 ai = nearestBoxPoint(cj, ri);
            vec2 aj = nearestBoxPoint(ci, rj);

            float gap = distance(ai, aj);
            if (gap > BEAM_RANGE_PX) continue;

            float w = smoothstep(BEAM_RANGE_PX, BEAM_RANGE_PX * 0.25, gap);
            vec2 bm = beam(fragCoord, ai, aj, float(i * 7 + j) * 0.41);
            // Line stays cyan; the travelling pulse brightens toward white.
            beamAdd += APERTURE_CYAN * bm.x * 0.25 * w;
            beamAdd += mix(APERTURE_CYAN, vec3(1.0), 0.55) * bm.y * 0.9 * w;
        }
    }
    lab += beamAdd;

    // 5) Portal ring under the cursor. Guard the (0,0) sentinel.
    // if (iMouse.x > 1.0 || iMouse.y > 1.0) {
    //     vec2 pr = portalRing(fragCoord, iMouse.xy);
    //     vec3 ringCol = mix(APERTURE_ORANGE, APERTURE_CYAN, anyMoving ? 0.0 : 1.0);
    //     lab += ringCol * pr.x * 1.1;
    //     lab += APERTURE_CYAN * pr.y * 0.06;
    // }

    // 6) Subtle vignette to focus attention center-screen.
    float vig = smoothstep(1.35, 0.55, length(uv - 0.5) * 1.6);
    lab *= mix(0.55, 1.0, vig);

    // Tone down extreme highlights so beams/borders don't clip ugly.
    lab = lab / (1.0 + lab * 0.25);

    fragColor = vec4(lab, 1.0);
}
