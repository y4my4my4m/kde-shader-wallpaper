// Sciencelab — Buffer A: portal gun state.
// @channels self
//
// Texels on row 0 carry state; every other texel is unused. A w of 0 means
// "never written": the engine clears buffers to zero on load.
//   (0,0)  x  seconds the cursor has rested on the bare desktop (capped)
//          y  colour of the next shot, 0 blue / 1 orange
//          z  seconds since the cursor last moved (capped)
//          w  1 armed, 2 disarmed until the cursor moves (after a click)
//   (1,0)  blue portal:   xy position as uv, z seconds since opened or
//                         since closing began, w 1 open / 2 closing / 0 none
//   (2,0)  orange portal: same layout
//   (3,0)  x  1 while a mouse button was held last step
// Resting the cursor for SHOT_DELAY seconds fires the next colour; a colour
// that already exists moves there. Clicking a portal closes it. Every texel
// recomputes events from the previous step, so they agree within a substep.
// iMouse and iWindowRects arrive scaled to this pass's grid. SHOT_DELAY
// and PORTAL_SIZE are @shared tweaks of sciencelab.frag.

const float CLOSE_TIME = 0.35;

bool insideWindow(vec2 p)
{
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        if (p.x >= r.x && p.y >= r.y && p.x <= r.x + r.z && p.y <= r.y + r.w) return true;
    }
    return false;
}

// Portal hit test with the image pass's size (95/1000 of the height times
// PORTAL_SIZE, width 0.58 of the height) and a small margin.
bool hitPortal(vec4 p, vec2 m)
{
    if (p.w < 0.5 || p.w > 1.5) return false;
    float h = 0.095 * PORTAL_SIZE * iResolution.y * 1.15;
    vec2 q = (m - p.xy * iResolution.xy) / vec2(h * 0.58, h);
    return dot(q, q) < 1.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    if (ic.y != 0 || ic.x > 3) {
        fragColor = vec4(0.0);
        return;
    }

    vec4 gun = texelFetch(iChannel0, ivec2(0, 0), 0);
    vec4 blue = texelFetch(iChannel0, ivec2(1, 0), 0);
    vec4 orange = texelFetch(iChannel0, ivec2(2, 0), 0);
    bool heldBefore = texelFetch(iChannel0, ivec2(3, 0), 0).x > 0.5;
    if (gun.w < 0.5) gun = vec4(0.0, 0.0, 0.0, 1.0);

    vec2 m = iMouse.xy;
    bool held = iMouse.z > 0.0;
    bool onDesktop = (m.x > 0.05 || m.y > 0.05) && !insideWindow(m);
    // About 1 px of cursor travel on the full-resolution screen.
    bool moved = distance(m, iMousePrev) > iResolution.y / 1400.0;
    bool pressStart = held && !heldBefore && onDesktop;

    bool closeBlue = pressStart && hitPortal(blue, m);
    bool closeOrange = pressStart && hitPortal(orange, m);
    bool overPortal = hitPortal(blue, m) || hitPortal(orange, m);

    bool armed = gun.w < 1.5;
    if (pressStart) armed = false;
    else if (moved) armed = true;

    float rest = (moved || !onDesktop || held || overPortal) ? 0.0 : min(gun.x + iTimeDelta, 10.0);
    bool shot = armed && gun.x < SHOT_DELAY && rest >= SHOT_DELAY;
    float shotColour = gun.y;

    if (ic.x == 0) {
        float still = moved ? 0.0 : min(gun.z + iTimeDelta, 10.0);
        fragColor = vec4(rest, shot ? 1.0 - shotColour : shotColour, still, armed ? 1.0 : 2.0);
        return;
    }
    if (ic.x == 3) {
        fragColor = vec4(held ? 1.0 : 0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 p = ic.x == 1 ? blue : orange;
    float mine = float(ic.x - 1);
    bool closeMine = ic.x == 1 ? closeBlue : closeOrange;
    if (shot && abs(shotColour - mine) < 0.5) {
        p = vec4(m / iResolution.xy, 0.0, 1.0);
    } else if (closeMine) {
        p.z = 0.0;
        p.w = 2.0;
    } else if (p.w > 1.5) {
        p.z += iTimeDelta;
        if (p.z > CLOSE_TIME) p = vec4(0.0);
    } else if (p.w > 0.5) {
        p.z = min(p.z + iTimeDelta, 1000.0);
    }
    fragColor = p;
}
