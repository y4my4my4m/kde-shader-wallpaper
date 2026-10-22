// Rainy Window — a rain-covered windowpane on a cosy evening.
// @channels bufferA, tex1, bufferB, bufferC
// @sim-max-height 360
//
// The desktop is the glass. Behind it, out of focus, a city: lit windows,
// street lamps and slow traffic on a wet road as soft bokeh by night, the
// same street under a grey sky by day, by the local clock. Rain beads the
// pane; drops grow, merge and run down in wobbly zig-zags, each one a small
// lens holding an upside-down view of the street. Running drops swallow the
// beads they cross and leave clear trails that slowly bead over again.
// Condensation fogs the glass over a few minutes; the cursor wipes it like
// a fingertip and it creeps back. Windows are frames on the glass: water
// gathers along their top edges, overflows, runs down their sides and drips
// from their bottom corners, and the glass just below them stays drier.
// Drag a window and its water smears and sheds behind it. Click bare glass
// to tap it: the beads shiver and nearby drops let go. The rain swells and
// eases over minutes; in heavy spells distant lightning softly lights the
// sky (no hard flashes, and it can be turned off).
//
// iChannel0  Buffer A: drops, screen tiles, input and window state.
// iChannel1  Wallpaper ("Image 2" in the settings), seen blurred behind the
//            glass and through the drops. Without one the city is drawn.
// iChannel2  Buffer B: fog, beads and trails on the glass.
// iChannel3  Buffer C: the city, out of focus.
//
// Lengths are in H, one screen height.

const float RAIN         = 1.0;  // @range(0.2, 3.0, 0.05) @label("Rain") @shared
const float DROP_SIZE    = 1.0;  // @range(0.5, 2.0, 0.05) @label("Drop size") @shared
const float FOG_AMOUNT   = 1.0;  // @range(0.0, 1.5, 0.05) @label("Fog")
const float FOG_REGROW   = 1.0;  // @range(0.0, 5.0, 0.05) @label("Fog regrowth") @shared
const float FINGER       = 1.0;  // @range(0.4, 3.0, 0.05) @label("Wipe width") @shared
const float BLUR         = 1.0;  // @range(0.3, 2.0, 0.05) @label("Background blur") @shared
const float WARMTH       = 0.75; // @range(0.0, 1.0, 0.05) @label("Light warmth") @shared
const bool  LIGHTNING    = true; // @label("Distant lightning") @shared
const bool  FOLLOW_CLOCK = true; // @label("Day and night by the clock") @shared

float gAsp;      // screen aspect
float gPx;       // one pixel, H
bool  gWall;     // wallpaper bound
bool  gCityTex;  // Buffer C holds the city
vec2  gFit;      // wallpaper cover-fit scale
float gTexPerH;  // wallpaper texels per H
vec3  gLamp;     // room light glinting on the drops

struct Lens {
    float cov;   // coverage 0..1
    vec2  q;     // position in the lens, unit radius
    vec2  c;     // centre, H
    float r;     // radius, H
    float view;  // radius of the scene the lens takes in, H
    float haze;  // share of the fog drawn over it
};

float sdUnevenCapsule(vec2 p, float r1, float r2, float h)
{
    p.x = abs(p.x);
    float b = (r1 - r2) / h;
    float a = sqrt(max(1.0 - b * b, 0.0));
    float k = dot(p, vec2(-b, a));
    if (k < 0.0) return length(p) - r1;
    if (k > a * h) return length(p - vec2(0.0, h)) - r2;
    return dot(p, vec2(a, b)) - r1;
}

// ------------------------------------------------------------- behind the glass

vec2 wallUV(vec2 p)
{
    return clamp((p / vec2(gAsp, 1.0) - 0.5) * gFit + 0.5, 0.0, 1.0);
}

vec3 wallGrade(vec3 c)
{
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(l), 0.2);
    c *= mix(vec3(0.92, 0.95, 1.0), vec3(0.58, 0.54, 0.56), cNight);
    return c + vec3(0.4, 0.45, 0.6) * cFlash * 0.2;
}

// Wallpaper blurred by cBl: seven taps of a mip level about that wide.
vec3 wallBlur(vec2 p)
{
    float lod = log2(max(cBl * gTexPerH * 0.7, 1.0));
    vec2 uv = (p / vec2(gAsp, 1.0) - 0.5) * gFit + 0.5;
    vec2 o = vec2(cBl * 0.6 / gAsp, cBl * 0.6) * gFit;
    vec3 c = textureLod(iChannel1, clamp(uv, 0.0, 1.0), lod).rgb * 0.25;
    for (int k = 0; k < 6; k++) {
        float a = float(k) * 1.0472 + 0.3;
        c += textureLod(iChannel1, clamp(uv + o * vec2(cos(a), sin(a)), 0.0, 1.0), lod).rgb * 0.125;
    }
    return wallGrade(c);
}

// Buffer C's city at screen uv.
vec3 cityAt(vec2 uv) { return texture(iChannel3, uv).rgb; }

// The backdrop behind point p.
vec3 sceneBlur(vec2 p)
{
    if (gWall) return wallBlur(p);
    if (gCityTex) return cityAt(p / vec2(gAsp, 1.0));
    return city(p, cBl, gPx);
}

// The scene seen through a lens at p, fp = pixel footprint there (H). Big
// drops see the city in focus; beads see Buffer C's bokeh minified.
vec3 sceneLens(vec2 p, float fp, bool focus)
{
    if (gWall) return wallGrade(textureLod(iChannel1, wallUV(p), log2(max(fp * gTexPerH, 1.0))).rgb);
    if (gCityTex && !focus) return cityAt(clamp(p / vec2(gAsp, 1.0), 0.0, 1.0));
    return city(p, 0.004, fp);
}

// Light the fog scatters from behind p: the backdrop spread over ~0.1 H.
vec3 sceneDiffuse(vec2 p)
{
    if (gWall) return wallGrade(textureLod(iChannel1, wallUV(p), log2(max(0.12 * gTexPerH, 1.0))).rgb);
    return cityDiffuse(p);
}

// ------------------------------------------------------------- water

// Shake of a bead at c after a tap: a ring travelling out at 0.2 H/s.
vec2 shiver(vec2 c, vec4 tap)
{
    if (tap.w <= 0.0 || tap.z > 1.5) return vec2(0.0);
    vec2 d = c - tap.xy * vec2(gAsp, 1.0);
    float l = length(d);
    float a = tap.z;
    float amp = 0.0016 * exp(-a * 3.5) * exp(-l / 0.07) * sin(a * 60.0 - l * 300.0);
    return d / max(l, 1e-4) * amp;
}

void takeLens(inout Lens L, float cov, vec2 q, vec2 c, float r, float view, float haze)
{
    if (cov > L.cov) L = Lens(cov, q, c, r, view, haze);
}

// Drops from Buffer A whose reach covers this pixel's tile.
void bigDrops(inout Lens L, vec2 P, vec2 uv, vec4 tap)
{
    vec2 gres = iChannelResolution[0].xy;
    int TX = tilesX(gres.x / gres.y);
    vec2 tf = min(uv * vec2(float(TX), float(TILE_ROWS)), vec2(float(TX) - 1.0, float(TILE_ROWS) - 1.0));
    int parts = dropsActive(gres.x / gres.y) > 96 ? 2 : 1;
    for (int part = 0; part < parts; part++) {
        uvec4 mask = uvec4(texelFetch(iChannel0, tileTexel(ivec2(tf), part), 0));
        for (int ch = 0; ch < 4; ch++) {
            uint bits = mask[ch];
            for (int n = 0; n < 24; n++) {
                if (bits == 0u) break;
                uint low = bits & (~bits + 1u);
                bits ^= low;
                int i = part * 96 + ch * 24 + int(round(log2(float(low))));
                vec4 d0 = texelFetch(iChannel0, dropTexel(i, 0), 0);
                int st = dropState(d0.w);
                if (st == ST_FREE) continue;
                vec2 c = d0.xy * vec2(gAsp, 1.0);
                float r = d0.z;
                vec2 rel = P - c;
                if (dot(rel, rel) > 12.0 * r * r) continue;
                vec4 d1 = texelFetch(iChannel0, dropTexel(i, 1), 0);
                if (st == ST_REST) {
                    r *= smoothstep(0.0, 0.08, d1.z);
                    c += shiver(c, tap);
                    rel = P - c;
                }
                float sd;
                vec2 q;
                vec2 lc = c;
                float lr = r;
                if (st == ST_REST) {
                    float a = atan(rel.y, rel.x);
                    float wob = 1.0 + 0.07 * sin(2.0 * a + TAU * d1.w) + 0.045 * sin(3.0 * a + 17.0 * d1.w);
                    vec2 rs = rel * vec2(1.0, 1.07);
                    lr = r * wob;
                    sd = length(rs) - lr;
                    q = rs / lr;
                } else {
                    vec2 ax = vec2(0.0, 1.0);
                    float len;
                    if (st == ST_RUN) {
                        float sp = length(d1.xy);
                        if (sp > 1e-4) ax = -d1.xy / sp;
                        len = tailLen(r, d1.xy);
                    } else if (st == ST_EDGE) {
                        len = 1.4 * r;
                    } else {
                        len = 1.2 * r;
                    }
                    len = max(len, 1e-5);
                    float r2 = max(0.5 * r, r - 0.6 * len);
                    vec2 pl = vec2(dot(rel, vec2(ax.y, -ax.x)), dot(rel, ax));
                    sd = sdUnevenCapsule(pl, r, r2, len);
                    float tt = clamp(pl.y / len, 0.0, 1.0);
                    lr = mix(r, r2, tt);
                    lc = c + ax * (tt * len);
                    q = (P - lc) / lr;
                }
                takeLens(L, clamp(0.5 - sd / gPx, 0.0, 1.0), q, lc, lr, 0.2 + 4.0 * r, st == ST_RUN ? 0.05 : 0.15);
            }
        }
    }
}

// Small static beads, one per cell at most; a bead shows once the bead
// cover at its centre passes the cell's threshold and grows with it.
void beadLayer(inout Lens L, vec2 P, float cell, float rMax, float thrLo, float empty, float seed, vec4 tap)
{
    // Each layer's lattice is turned by its own angle so no rows line up.
    float a = 0.45 + 0.7 * seed;
    mat2 rot = mat2(cos(a), sin(a), -sin(a), cos(a));
    vec2 o = vec2(17.3, 5.9) * seed;
    vec2 id = floor(rot * P / cell + o);
    vec4 h = hash43(vec3(id, seed * 3.1 + 0.5));
    if (h.w < empty) return;
    vec2 c = ((id + 0.5 + (h.xy - 0.5) * 0.44 - o) * cell) * rot;
    vec4 g = texture(iChannel2, c / vec2(gAsp, 1.0));
    float thr = thrLo + 0.5 * h.z + 0.6 * (g.w - 0.5);
    float b = g.y;
    if (b <= thr) return;
    float r = rMax * (0.55 + 0.45 * h.x) * smoothstep(thr, thr + 0.2, b);
    c += shiver(c, tap);
    vec2 rel = (P - c) * vec2(1.0, 1.06);
    takeLens(L, clamp(0.5 - (length(rel) - r) / gPx, 0.0, 1.0), rel / max(r, 1e-6), c, r, 8.0 * r, 0.25);
}

// Water held by the windows: a meniscus and beads along the top edge,
// streams down the sides once the pool overflows, a film and small beads
// under the bottom edge.
void windowWater(inout Lens L, vec2 P)
{
    for (int k = 0; k < 16; k++) {
        if (k >= iWindowCount) break;
        vec4 R = iWindowRects[k] / iResolution.y;
        if (R.z <= 0.0 || R.w <= 0.0) continue;
        float top = R.y + R.w;
        if (P.x < R.x - 0.012 || P.x > R.x + R.z + 0.012 || P.y < R.y - 0.012 || P.y > top + 0.02) continue;
        float pool = texelFetch(iChannel0, ivec2(SLOT0 + k, 0), 0).x;
        float fk = float(k);

        if (P.x > R.x && P.x < R.x + R.z && P.y >= top - gPx) {
            float corner = exp(-min(P.x - R.x, R.x + R.z - P.x) / 0.015);
            float m = (0.0016 + pool * 0.004 * (0.6 + 0.8 * vnoise1(P.x * 45.0 + fk * 7.0))) * (1.0 + 0.7 * corner) * DROP_SIZE;
            float dy = P.y - top;
            takeLens(L, clamp(0.5 - (dy - m) / gPx, 0.0, 1.0), vec2(-0.32, clamp(dy / m, 0.0, 1.0)), vec2(P.x, top), m, 6.0 * m, 0.2);
            float cw = 0.024 * DROP_SIZE;
            float c0 = floor((P.x - R.x) / cw - 0.5);
            for (int j = 0; j < 2; j++) {
                float ci = c0 + float(j);
                vec3 h = hash32(vec2(ci, fk * 13.0 + 1.0));
                if (h.x > 0.2 + 0.6 * pool) continue;
                float rb = (0.0035 + 0.0065 * h.y * h.y) * (0.3 + 0.7 * pool) * DROP_SIZE;
                vec2 bc = vec2(R.x + (ci + 0.5 + (h.z - 0.5) * 0.4) * cw, top + 0.4 * rb);
                if (bc.x < R.x + rb || bc.x > R.x + R.z - rb) continue;
                vec2 rel = P - bc;
                takeLens(L, clamp(0.5 - (length(rel) - rb) / gPx, 0.0, 1.0), rel / rb, bc, rb, 6.0 * rb, 0.2);
            }
        }

        float flow = smoothstep(0.7, 0.95, pool);
        if (flow > 0.0 && P.y > R.y && P.y < top) {
            float dxl = R.x - P.x;
            float dxr = P.x - R.x - R.z;
            float dx = max(dxl, dxr);
            if (dx > -gPx && dx < 0.006) {
                float sk = dxl > dxr ? 0.0 : 1.0;
                float slug = smoothstep(0.55, 0.95, pnoise1(P.y * 40.0 + cClock * 2.4 + fk * 37.0 + sk * 11.0, 1440.0));
                float w = flow * (0.0016 + 0.0036 * slug) * DROP_SIZE;
                vec2 ec = vec2(sk > 0.5 ? R.x + R.z : R.x, P.y);
                takeLens(L, clamp(0.5 - (dx - w) / gPx, 0.0, 1.0), vec2((2.0 * sk - 1.0) * clamp(dx / w, 0.0, 1.0), 0.4), ec, w, 6.0 * w, 0.2);
            }
        }

        if (P.x > R.x && P.x < R.x + R.z && P.y < R.y + gPx) {
            float dy = R.y - P.y;
            float m = (0.0006 + 0.0012 * pool) * DROP_SIZE;
            takeLens(L, clamp(0.5 - (dy - m) / gPx, 0.0, 1.0), vec2(0.0, -clamp(dy / m, 0.0, 1.0)), vec2(P.x, R.y), m, 6.0 * m, 0.2);
            const float cw = 0.028;
            float ci = floor((P.x - R.x) / cw);
            vec3 h = hash32(vec2(ci, fk * 7.0 + 5.0));
            if (h.x < 0.45 * pool + 0.1) {
                float rb = (0.0012 + 0.0022 * h.y) * DROP_SIZE;
                vec2 bc = vec2(R.x + (ci + 0.5 + (h.z - 0.5) * 0.4) * cw, R.y - 0.55 * rb);
                vec2 rel = (P - bc) * vec2(1.0, 0.9);
                takeLens(L, clamp(0.5 - (length(rel) - rb) / gPx, 0.0, 1.0), rel / rb, bc, rb, 6.0 * rb, 0.2);
            }
        }
    }
}

// A drop or bead as a lens: the street behind, upside down, with bright
// points gaining (the lens focuses them); toward the rim the surface turns
// and mirrors the room (colour `room`), edged by a dark contact line; light
// from behind gathers just inside the lower rim; the room's lamp glints on
// top. Beads a few pixels across mostly pass the light from straight behind.
vec3 lensColor(Lens L, vec3 behind, vec3 room)
{
    vec2 q = L.q;
    float rq2 = min(dot(q, q), 1.0);
    float rq = sqrt(rq2);
    float z = sqrt(1.0 - rq2);
    float big = smoothstep(1.5, 6.0, L.r / gPx);
    vec2 sp = L.c - q * L.view * (1.0 + 0.5 * rq2);
    vec3 v = sceneLens(sp, gPx * L.view / L.r * (1.0 + rq2), L.r > 5.0 * gPx);
    v *= 1.0 + 1.5 * v;
    v = mix(v, behind, mix(0.5, 0.3, big));
    float fres = pow(1.0 - z, 1.5) * (0.55 + 0.45 * dot(q / max(rq, 1e-4), vec2(-0.6, 0.8)));
    v = mix(v, room + behind * 0.4, clamp(fres, 0.0, 1.0) * (0.5 + 0.5 * big));
    v *= 1.0 - 0.6 * big * smoothstep(0.88, 1.0, rq);
    float ring = smoothstep(0.55, 0.85, rq) * (1.0 - smoothstep(0.9, 1.0, rq));
    v += (behind + 0.5 * room) * ring * (0.4 - 0.4 * q.y) * big;
    vec2 g = q - vec2(-0.3, 0.42);
    vec2 g2 = q - vec2(0.32, -0.4);
    return v + gLamp * (exp(-dot(g, g) * mix(30.0, 45.0, big)) * (0.35 + 0.75 * big)
                      + exp(-dot(g2, g2) * 60.0) * 0.25 * big);
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    gAsp = iResolution.x / iResolution.y;
    gPx = 1.0 / iResolution.y;
    if (windowAt(fragCoord, 1.0) >= 0) {
        fragColor = vec4(0.04, 0.04, 0.05, 1.0);
        return;
    }
    vec2 uv = fragCoord / iResolution.xy;
    vec2 P = fragCoord * gPx;

    cityBegin(texelFetch(iChannel0, ivec2(0, 0), 0).x);
    gWall = iChannelResolution[1].x > 0.0;
    gCityTex = !gWall && iChannelResolution[3].y >= CITY_ROWS;
    if (gWall) {
        vec2 texRes = iChannelResolution[1].xy;
        float ta = texRes.x / texRes.y;
        gFit = gAsp > ta ? vec2(1.0, ta / gAsp) : vec2(gAsp / ta, 1.0);
        gTexPerH = gFit.y * texRes.y;
    }
    gLamp = mix(vec3(0.80, 0.83, 0.86) * 0.55, vec3(1.0, 0.80, 0.55) * 0.9, cNight);
    vec4 tap = texelFetch(iChannel0, ivec2(1, 0), 0);
    vec4 glass = texture(iChannel2, uv);

    Lens L = Lens(0.0, vec2(0.0), vec2(0.0), 1.0, 0.0, 0.0);
    bigDrops(L, P, uv, tap);
    if (L.cov < 1.0) {
        float ds = DROP_SIZE;
        beadLayer(L, P, 0.024 * ds, 0.0066 * ds, 0.35, 0.15, 0.0, tap);
        beadLayer(L, P, 0.013 * ds, 0.0036 * ds, 0.2, 0.25, 1.0, tap);
        beadLayer(L, P, 0.0075 * ds, 0.0018 * ds, 0.1, 0.5, 2.0, tap);
        windowWater(L, P);
    }

    vec3 room = mix(vec3(0.58, 0.60, 0.62), vec3(0.11, 0.12, 0.145), cNight);
    vec3 bg = sceneBlur(P);
    vec3 fogC = room + sceneDiffuse(P) * mix(0.45, 1.0, cNight);
    float grain = hash12(floor(fragCoord * 0.5));
    // Bright lights glow through the fog.
    float fogA = clamp(FOG_AMOUNT * glass.x, 0.0, 1.0) * (0.88 + 0.12 * grain) * 0.93
               * (1.0 - 0.45 * smoothstep(0.1, 0.6, dot(bg, vec3(0.3, 0.5, 0.2))));
    vec3 col = mix(bg, fogC, fogA);
    // The room seen mirrored in the curve of a drop: lamp-lit by night.
    vec3 mirrored = mix(vec3(0.5, 0.53, 0.57), vec3(0.34, 0.23, 0.13), cNight);
    if (L.cov > 0.0) col = mix(col, mix(lensColor(L, bg, mirrored), fogC, fogA * L.haze), L.cov * (1.0 - 0.4 * fogA * L.haze));

    // The room's lamp reflected faintly in the glass, and a soft vignette.
    col += vec3(0.07, 0.04, 0.018) * cNight * exp(-length((P - vec2(0.12 * gAsp, -0.15)) * vec2(0.8, 1.1)) / 0.5);
    vec2 vq = uv - 0.5;
    col *= 1.0 - 0.3 * dot(vq, vq);
    col = mix(col, 1.0 - 0.3 * exp(-(col - 0.7) / 0.3), step(0.7, col));
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
