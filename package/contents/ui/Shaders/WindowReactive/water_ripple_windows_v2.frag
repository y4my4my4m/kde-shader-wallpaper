// Water Ripple v2 — image pass.
// @channels bufferA, tex1
// @sim-max-height 600
//
// Looks straight down through a sunlit water surface. The cursor drags a
// wake, clicks splash, dragged windows push bow waves and every window floats
// above the water, casting a soft shadow that ripples with the surface.
//
// iChannel0  Buffer A: x = height, y = velocity, zw = gradient per cell, on a
//            grid coarser than the screen. Sampled through a cubic B-spline so
//            the upscaled surface stays smooth.
// iChannel1  Optional wallpaper ("Image 2" in the settings). Unbound, iChannelResolution[1]
//            is zero and a procedural lagoon floor is drawn instead.
//
// Units: p is in screen heights (y in [0, 1]); slope is dimensionless.
// Rain, cursor wake strength and ripple damping are shared with Buffer A.

const vec3  WATER_COLOR    = vec3(0.04, 0.62, 0.70); // @color @label("Water colour")
const vec3  DEEP_COLOR     = vec3(0.00, 0.19, 0.33); // @color @label("Deep water colour")
const vec3  SAND_COLOR     = vec3(0.96, 0.91, 0.78); // @color @label("Sand colour")
const float DEPTH          = 0.55; // @range(0.0, 1.0, 0.01) @label("Water depth")
const float REFRACTION     = 1.0;  // @range(0.0, 3.0, 0.05) @label("Refraction")
const float CAUSTICS       = 0.8;  // @range(0.0, 3.0, 0.05) @label("Caustics")
const bool  CAUSTICS_ON_IMAGE = false; // @label("Caustics over Image 2")
const float GLINTS         = 1.0;  // @range(0.0, 3.0, 0.05) @label("Sun glints")
const float AMBIENT_SWELL  = 1.0;  // @range(0.0, 3.0, 0.05) @label("Ambient swell")
const float WINDOW_SHADOW  = 0.45; // @range(0.0, 1.0, 0.01) @label("Window shadows")
const float WALLPAPER_TINT = 0.0;  // @range(0.0, 1.0, 0.01) @label("Wallpaper water tint")

const float RAIN_AMOUNT    = 1.0;  // @range(0.0, 5.0, 0.05) @label("Raindrops") @shared
const float CURSOR_WAKE    = 1.0;  // @range(0.0, 1.8, 0.05) @label("Cursor wake") @shared
const float RIPPLE_DAMPING = 1.0;  // @range(0.0, 5.0, 0.05) @label("Ripple damping") @shared

const vec3  SUN_DIR        = vec3(-0.30, 0.36, 0.88); // towards the sun, z up @range(-1.0, 1.0, 0.01) @label("Sun direction")
const vec3  SUN_COLOR      = vec3(1.00, 0.95, 0.85); // @color @label("Sun colour")
const float SLOPE_PER_CELL = 3.2;   // sim gradient -> surface slope @range(0.0, 8.0, 0.1) @label("Ripple relief")
const float WINDOW_LIFT    = 0.05;  // window height above the floor, screen heights @range(0.0, 0.2, 0.005) @label("Window height")
const float SURFACE_RELIEF = 1.4;   // brightness change per unit slope towards the sun @range(0.0, 4.0, 0.05) @label("Surface shading")

// SUN_DIR held above the horizon and at least 20 degrees from the zenith;
// nearer the zenith the broad glint lobe covers flat water.
const float SUN_Z  = max(SUN_DIR.z, 0.05);
const vec2  SUN_XY = length(SUN_DIR.xy) > 0.001 ? SUN_DIR.xy : vec2(-0.0006, 0.0008);
const vec3  SUN    = vec3(SUN_XY * max(1.0, 0.36 * SUN_Z / length(SUN_XY)), SUN_Z);

// ------------------------------------------------------------- noise

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
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p, int octaves)
{
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < octaves; i++) {
        v += a * vnoise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

// ------------------------------------------------------------- sampling

vec4 bsplineWeights(float t)
{
    vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - t;
    vec4 s = n * n * n;
    float x = s.x;
    float y = s.y - 4.0 * s.x;
    float z = s.z - 4.0 * s.y + 6.0 * s.x;
    float w = 6.0 - x - y - z;
    return vec4(x, y, z, w) * (1.0 / 6.0);
}

// Cubic B-spline from four bilinear taps (Sigg & Hadwiger, GPU Gems 2 ch. 20).
vec4 textureBSpline(sampler2D tex, vec2 uv, vec2 size)
{
    vec2 st = uv * size - 0.5;
    vec2 f = fract(st);
    st -= f;
    vec4 wx = bsplineWeights(f.x);
    vec4 wy = bsplineWeights(f.y);
    vec4 c = st.xxyy + vec2(-0.5, 1.5).xyxy;
    vec4 s = vec4(wx.xz + wx.yw, wy.xz + wy.yw);
    vec4 o = (c + vec4(wx.yw, wy.yw) / s) / size.xxyy;
    vec4 t0 = texture(tex, o.xz);
    vec4 t1 = texture(tex, o.yz);
    vec4 t2 = texture(tex, o.xw);
    vec4 t3 = texture(tex, o.yw);
    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);
    return mix(mix(t3, t2, sx), mix(t1, t0, sx), sy);
}

// ------------------------------------------------------------- surface

// Slow directional swell: a few long, low waves so the light keeps moving
// when the simulation is calm. Returns the slope (dh/dx, dh/dy).
vec2 swellSlope(vec2 p, float t)
{
    vec2 g = vec2(0.0);
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float ang = 0.6 + fi * 1.13;
        vec2 dir = vec2(cos(ang), sin(ang));
        float k = 9.0 + fi * 5.3;               // radians per screen height
        float w = sqrt(9.81 * k) * 0.22;         // deep-water dispersion, slowed
        float amp = 0.0016 / (1.0 + fi * 0.6);
        g += dir * (k * amp * cos(dot(p, dir) * k - t * w + fi * 2.1));
    }
    return g;
}

// ------------------------------------------------------------- floor

// Animated caustic net: edges of a jittered Voronoi diagram, two layers at
// different scales multiplied so only their bright crossings survive.
float causticLayer(vec2 p, float t)
{
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(ip + g);
            o = 0.5 + 0.42 * sin(t + 6.2831 * o);
            vec2 r = g + o - fp;
            float d = dot(r, r);
            if (d < d1) { d2 = d1; d1 = d; }
            else if (d < d2) { d2 = d; }
        }
    }
    float e = sqrt(d2) - sqrt(d1);
    return exp(-e * 9.0);
}

float caustics(vec2 p, float t)
{
    vec2 warp = vec2(vnoise(p * 2.3 + t * 0.07), vnoise(p * 2.3 - t * 0.05 + 7.3)) - 0.5;
    vec2 q = p * 3.6 + warp * 1.3;
    float a = causticLayer(q, t * 0.55);
    float b = causticLayer(q * 1.37 + 3.7, t * 0.43 + 1.7);
    return pow(a * b, 1.3) * 2.4 + a * 0.18;
}

// Sand with ripple marks and weed patches. Returns colour and
// writes a 0..1 relief term used to vary the water depth.
vec3 lagoonFloor(vec2 p, out float relief)
{
    float large = fbm(p * 1.6 + 11.0, 3);
    float grain = vnoise(p * 300.0);
    vec3 col = SAND_COLOR * (0.82 + 0.28 * large) * (0.96 + 0.08 * grain);

    // Wind ripples in the sand, bent by low-frequency noise, lit from the sun
    // side through their derivative.
    float phase = dot(p, vec2(0.83, 0.55)) * 46.0 + fbm(p * 3.1, 2) * 9.0;
    float ridge = sin(phase);
    float lit = cos(phase) * dot(normalize(vec2(0.83, 0.55)), normalize(SUN.xy));
    col *= 1.0 + 0.16 * lit * smoothstep(0.3, 0.7, large);
    relief = large + 0.05 * ridge;

    // Weed / dark patches.
    float weed = smoothstep(0.58, 0.78, fbm(p * 2.2 - 4.0, 3));
    col = mix(col, vec3(0.25, 0.32, 0.20) * (0.8 + 0.4 * grain), weed * 0.55);
    relief -= weed * 0.2;

    return col;
}

// ------------------------------------------------------------- windows

float sdBox(vec2 p, vec2 center, vec2 halfSize, float r)
{
    vec2 q = abs(p - center) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Soft shadow the floating windows cast on the floor at floor point fc (px).
float windowShadow(vec2 fc)
{
    float px = iResolution.y;
    vec2 offset = -SUN.xy / SUN.z * WINDOW_LIFT * px;
    float soft = 0.035 * px;
    float occ = 0.0;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 2.0 || r.w < 2.0) continue;
        float d = sdBox(fc - offset, r.xy + r.zw * 0.5, r.zw * 0.5, 0.01 * px);
        occ = max(occ, 1.0 - smoothstep(-soft, soft, d));
    }
    return occ;
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = fragCoord / iResolution.y;
    float t = iTime;

    // Simulation grid size: the engine reports Buffer A's size here.
    vec2 simSize = iChannelResolution[0].xy;
    if (simSize.x < 1.0) simSize = iResolution.xy;
    vec2 cellUV = 1.0 / simSize;

    vec4 s = textureBSpline(iChannel0, uv, simSize);
    vec2 simSlope = s.zw * SLOPE_PER_CELL;

    // Curvature from the divergence of the smoothed gradient over 3 cells:
    // concave troughs focus light. The B-spline taps low-pass the short
    // dispersive ripples that a 1-cell difference would amplify into hatching.
    vec2 cs = 1.5 * cellUV;
    float gxR = textureBSpline(iChannel0, uv + vec2(cs.x, 0.0), simSize).z;
    float gxL = textureBSpline(iChannel0, uv - vec2(cs.x, 0.0), simSize).z;
    float gyU = textureBSpline(iChannel0, uv + vec2(0.0, cs.y), simSize).w;
    float gyD = textureBSpline(iChannel0, uv - vec2(0.0, cs.y), simSize).w;
    float curvature = (gxR - gxL + gyU - gyD) / 3.0;

    vec2 slope = simSlope + swellSlope(p, t) * AMBIENT_SWELL;
    vec3 n = normalize(vec3(-slope, 1.0));

    bool hasWallpaper = iChannelResolution[1].x > 0.0;

    // Refraction: the floor seen through a tilted surface shifts against the
    // slope, more where the water is deeper.
    // Bathymetry: sandbars and deeper channels, drifting very slowly.
    float bathy = smoothstep(0.28, 0.72, fbm(p * 0.85 + vec2(3.7, 1.3) + t * 0.004, 3));
    float depthHere = DEPTH * mix(0.12, 2.0, bathy);
    vec2 shift = -slope * 0.075 * REFRACTION * (0.35 + depthHere);

    vec3 col;
    float depth = hasWallpaper ? DEPTH : depthHere;
    vec2 fp = p + shift;
    vec2 floorPx = fp * iResolution.y;

    if (hasWallpaper) {
        // Cover-fit the wallpaper: fill the screen, crop the overflow.
        vec2 texRes = iChannelResolution[1].xy;
        float sa = iResolution.x / iResolution.y;
        float ta = texRes.x / texRes.y;
        vec2 fit = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
        vec2 wuv = clamp(uv + shift * vec2(iResolution.y / iResolution.x, 1.0), 0.0, 1.0);
        col = texture(iChannel1, (wuv - 0.5) * fit + 0.5).rgb;
        // Luminance-preserving tint toward the water colour.
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        vec3 hue = WATER_COLOR / max(dot(WATER_COLOR, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
        col = mix(col, luma * hue, WALLPAPER_TINT * 0.5);
        depth *= WALLPAPER_TINT * 0.4;
    } else {
        float relief;
        col = lagoonFloor(fp, relief);
        depth = clamp(depthHere + 0.2 * (0.5 - relief), 0.02, 1.6);
    }

    // Light on the floor: shadows of the floating windows, then caustics.
    // Both are evaluated at the refracted floor point so they wobble with the
    // surface.
    float shadow = windowShadow(floorPx);
    float light = 1.0 - WINDOW_SHADOW * shadow;
    float caust = 0.0;
    if (!hasWallpaper || CAUSTICS_ON_IMAGE) {
        caust = caustics(fp, t) * (0.55 + 0.45 * (1.0 - depth));
    }
    caust += clamp(-curvature * 70.0, -0.6, 2.0) * (hasWallpaper ? 0.6 : 1.0);
    col *= light * (1.0 + CAUSTICS * 0.55 * caust * (1.0 - shadow));

    // Absorption and in-scattering through the water column. Extinction is
    // strongest for the colours the water lacks; in-scatter shifts from the
    // water colour in the shallows to the deep colour over channels.
    vec3 sigma = (1.0 - WATER_COLOR) * 2.2 + 0.25;
    vec3 trans = exp(-sigma * depth);
    float scatterAmt = 1.0 - exp(-1.3 * depth);
    vec3 scatter = mix(WATER_COLOR, DEEP_COLOR, smoothstep(0.3, 1.5, depth));
    col = col * trans + scatter * scatterAmt;

    // Surface: faces tilted towards the sun read brighter (the sky dome is
    // brightest there), sky reflection by Fresnel, a sharp and a broad sun
    // lobe for glints.
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(SUN);
    float facing = dot(slope, normalize(L.xy));
    col *= 1.0 + SURFACE_RELIEF * clamp(facing, -0.4, 0.4);
    vec3 H = normalize(L + V);
    float cosV = max(n.z, 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
    vec3 R = reflect(-V, n);
    vec3 sky = mix(vec3(0.62, 0.80, 0.95), vec3(0.92, 0.96, 1.0), smoothstep(-0.3, 0.6, dot(R.xy, L.xy)));
    // Over a wallpaper only the part of the reflection that ripples add is
    // kept, so calm water leaves the picture untouched.
    float reflection = hasWallpaper ? (fresnel - 0.02) * 4.0 : fresnel * 4.0;
    col = mix(col, sky, clamp(reflection, 0.0, 0.5));
    float nh = max(dot(n, H), 0.0);
    float spec = pow(nh, 500.0) * 3.0 + pow(nh, 90.0) * 0.10;
    col += SUN_COLOR * spec * GLINTS * light;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
