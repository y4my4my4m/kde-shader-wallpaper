// Nebula Fall
// Author: q8itz
// License: CC-BY-4.0
//
// Depicts an endless, gracefully tumbling 3D flight through a richly defined
// volumetric cosmic nebula with deep saturated colors, sculpted cloud pillars
// and dark dust rifts, optical chromatic aberration, and a deep-space backdrop
// of varied stars, gas clouds, and occasional galaxies.

#define PI 3.14159265359
#define TAU 6.28318530718

// Fast screen-space hash for raymarch dithering (eliminates banding)
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// 3D hashes for procedural stars & galaxies
float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
}

mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// Gyroid-based 3D turbulence (4 octaves)
float gyroidFbm(vec3 p) {
    float n = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
        n += amp * dot(sin(p), cos(p.yzx));
        p = p * 2.07 + vec3(1.7, -2.3, 1.1);
        p.xz *= rot2(0.45);
        amp *= 0.5;
    }
    return n;
}

// 3-octave gyroid FBM
float gyroidFbm3(vec3 p) {
    float n = 0.0;
    float amp = 0.58;
    for (int i = 0; i < 3; i++) {
        n += amp * dot(sin(p), cos(p.yzx));
        p = p * 2.11 + vec3(-1.3, 2.1, -0.9);
        p.xy *= rot2(0.41);
        amp *= 0.5;
    }
    return n;
}

// Smooth 2-octave gyroid FBM
float gyroidFbm2(vec3 p) {
    float n = 0.58 * dot(sin(p), cos(p.yzx));
    p = p * 1.93 + vec3(1.4, -1.7, 0.8);
    p.xz *= rot2(0.52);
    n += 0.30 * dot(sin(p), cos(p.yzx));
    return n;
}

// Deep, saturated cosmic nebula palette (kept rich without washing out to white)
vec3 nebulaPalette(float t) {
    vec3 a = vec3(0.40, 0.34, 0.46);
    vec3 b = vec3(0.39, 0.34, 0.40);
    vec3 c = vec3(1.00, 1.00, 1.00);
    vec3 d = vec3(0.05, 0.32, 0.62);
    return max(a + b * cos(TAU * (c * t + d)), vec3(0.02));
}

// Endless smooth 3D flight path through the nebula
vec3 flightPath(float t) {
    return vec3(
        3.4 * sin(t * 0.095) + 1.5 * cos(t * 0.053),
        2.2 * cos(t * 0.078) + 1.0 * sin(t * 0.125),
        t * 1.10
    );
}

// Evaluate well-defined volumetric nebula density, sculpted dark rifts,
// saturated ionization knots, and local color phase.
// Returns vec3(density, coreGlow, colorPhase)
vec3 sampleNebula(vec3 p, float t) {
    vec3 drift = vec3(t * 0.022, -t * 0.016, t * 0.014);

    // Domain warp for sweeping organic cosmic pillars and sculpted edges
    float warp = gyroidFbm2(p * 0.17 + drift);
    vec3 wp = p * 0.26 + 0.62 * vec3(
        sin(warp * 2.4 + p.z * 0.09),
        cos(warp * 2.1 - p.x * 0.09),
        sin(warp * 2.5 + p.y * 0.09)
    );

    float baseCloud = gyroidFbm(wp + drift * 0.5);
    float detail    = gyroidFbm3(wp * 2.35 - drift * 0.9);
    float wisps     = gyroidFbm2(wp * 4.10 + drift * 0.7);

    // Sculpted cloud mass with clear, dark negative space between formations
    float shape = baseCloud + 0.42 * detail + 0.16 * wisps;
    float density = smoothstep(0.06, 0.82, shape);
    density = pow(density, 1.60);

    // Dark cosmic dust rifts that carve crisp definition into cloud banks
    float dustRift = smoothstep(0.32, 0.86, gyroidFbm2(wp * 1.65 + vec3(2.1, -1.4, 0.7)));
    density *= mix(1.0, 0.22, dustRift * 0.85);

    // Crisp glowing filamentary ridges along cloud boundaries
    float ridge = smoothstep(0.45, 0.0, abs(detail)) * smoothstep(0.02, 0.55, baseCloud);
    density += ridge * 0.36;

    // Embedded saturated ionization knots (brighter color, not white)
    float knotField = gyroidFbm2(p * 0.40 - drift * 0.5);
    float coreGlow = smoothstep(0.62, 1.08, knotField) * smoothstep(0.12, 0.75, baseCloud);

    // Rich spatial + temporal color phase that shifts as we pass through clouds
    float colorPhase = t * 0.026
                     + p.z * 0.036
                     + 0.24 * baseCloud
                     + 0.18 * detail
                     + 0.12 * sin(p.x * 0.19 + p.y * 0.16);

    return vec3(density, coreGlow, colorPhase);
}

// Blackbody-inspired stellar color from temperature parameter `temp` in [0, 1]
vec3 starColor(float temp) {
    vec3 mRed   = vec3(1.00, 0.38, 0.16); // M-type red dwarf
    vec3 kOrng  = vec3(1.00, 0.68, 0.38); // K-type orange
    vec3 gYel   = vec3(1.00, 0.92, 0.78); // G-type solar yellow-white
    vec3 aWht   = vec3(0.95, 0.97, 1.00); // A/F-type white
    vec3 obBlue = vec3(0.62, 0.78, 1.00); // O/B-type blue giant

    vec3 c = mix(mRed, kOrng, smoothstep(0.0, 0.25, temp));
    c = mix(c, gYel,   smoothstep(0.25, 0.52, temp));
    c = mix(c, aWht,   smoothstep(0.52, 0.76, temp));
    c = mix(c, obBlue, smoothstep(0.76, 1.00, temp));
    return c;
}

// Single 3D grid layer of varied stars
vec3 starLayer(vec3 rd, float scale, float densityThresh, float sizeBase, float t) {
    vec3 p = rd * scale;
    vec3 id = floor(p);
    vec3 f = fract(p) - 0.5;

    float rnd = hash31(id);
    if (rnd < densityThresh) return vec3(0.0);

    vec3 rnd3 = hash33(id + 17.3);
    vec3 offset = (rnd3 - 0.5) * 0.68;
    float d = length(f - offset);

    float starSize = sizeBase * (0.55 + 0.90 * rnd3.x);
    float core = exp(-d * d / (starSize * starSize));

    // Subtle scintillation
    float twinkle = 0.86 + 0.14 * sin(t * (1.2 + 2.5 * rnd3.y) + rnd * TAU);

    // Brightness distribution (most stars faint, rare bright giants)
    float mag = pow(fract(rnd * 13.37), 2.4) * 1.45 + 0.14;
    vec3 col = starColor(rnd3.z);

    // Subtle soft halo on brighter stars
    float halo = exp(-d * 10.0) * 0.14 * smoothstep(0.8, 1.6, mag);

    return col * (core * mag + halo) * twinkle;
}

// Occasional distant spiral galaxies in 3D sky cells
vec3 galaxyLayer(vec3 rd) {
    vec3 p = rd * 3.2;
    vec3 id = floor(p);
    vec3 f = fract(p) - 0.5;

    float rnd = hash31(id + 91.7);
    if (rnd < 0.88) return vec3(0.0); // Occasional (~12% of sky cells)

    vec3 rnd3 = hash33(id + 43.1);
    vec3 center = (rnd3 - 0.5) * 0.36;
    vec3 rel = f - center;

    // Random galaxy disk orientation
    vec3 normal = normalize(hash33(id + 7.9) - 0.5);
    vec3 upRef = abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 uAxis = normalize(cross(upRef, normal));
    vec3 vAxis = cross(normal, uAxis);

    vec2 gUv = vec2(dot(rel, uAxis), dot(rel, vAxis));
    float planeDist = abs(dot(rel, normal));

    float galScale = 0.11 + 0.06 * rnd3.x;
    float r = length(gUv) / galScale;
    if (r > 1.6) return vec3(0.0);

    float thickness = exp(-planeDist * planeDist / 0.00055);

    float angle = atan(gUv.y, gUv.x);
    float armTwist = angle + log(max(r, 0.04)) * 3.2 * (rnd3.y > 0.5 ? 1.0 : -1.0);
    float arms = 0.5 + 0.5 * cos(armTwist * 2.0);
    arms = pow(arms, 1.8);

    float bulge = exp(-r * r * 14.0);
    float disk = exp(-r * 2.3) * (0.32 + 0.68 * arms);

    vec3 bulgeCol = vec3(1.00, 0.80, 0.55);
    vec3 armCol   = mix(vec3(0.55, 0.72, 1.00), vec3(0.95, 0.60, 0.45), rnd3.z);

    vec3 col = bulgeCol * bulge * 0.70 + armCol * disk * 0.36;
    return col * thickness * smoothstep(1.6, 0.4, r);
}

// Deep space background: varied stars, occasional galaxies, and distant cosmic gas clouds
vec3 sampleDeepSpace(vec3 rd, float t) {
    vec3 space = vec3(0.002, 0.002, 0.004);

    // Distant background gas clouds
    float nebA = gyroidFbm(rd * 2.3 + vec3(0.4, -0.7, 0.2));
    float nebB = gyroidFbm3(rd * 4.6 + vec3(-1.1, 0.5, 0.9));
    float cloudMask = smoothstep(-0.15, 0.95, nebA);
    float wispMask  = smoothstep(0.0, 0.85, nebB);

    vec3 dustTeal   = vec3(0.022, 0.050, 0.080);
    vec3 dustViolet = vec3(0.050, 0.020, 0.065);
    vec3 dustAmber  = vec3(0.080, 0.028, 0.015);

    vec3 nebCol = mix(dustTeal, dustViolet, smoothstep(-0.6, 0.6, nebB));
    nebCol = mix(nebCol, dustAmber, smoothstep(0.25, 0.95, nebA * nebB));
    space += nebCol * (cloudMask * 0.50 + wispMask * 0.25);

    // Occasional distant galaxies
    space += galaxyLayer(rd);

    // Multi-scale starfield with diverse spectral types
    space += starLayer(rd, 26.0, 0.84, 0.045, t);
    space += starLayer(rd, 55.0, 0.72, 0.038, t);
    space += starLayer(rd, 110.0, 0.58, 0.032, t);

    return space;
}

// Compute camera ray direction from screen UV
vec3 getRayDir(vec2 uv, vec3 forward, vec3 right, vec3 up, float rollAngle) {
    vec2 ruv = rot2(rollAngle) * uv;
    return normalize(forward + ruv.x * right + ruv.y * up);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;

    // Graceful, endless flight through the nebula
    vec3 ro = flightPath(t);
    vec3 baseTarget = flightPath(t + 3.2);
    vec3 baseForward = normalize(baseTarget - ro);
    vec3 baseRight   = normalize(cross(baseForward, vec3(0.0, 1.0, 0.0)));
    vec3 baseUp      = cross(baseRight, baseForward);

    // Random-feeling, graceful 3D camera spin (incommensurate smooth harmonics)
    float yaw   = 0.75 * sin(t * 0.073) + 0.42 * cos(t * 0.131 + 1.2) + 0.18 * sin(t * 0.217);
    float pitch = 0.52 * cos(t * 0.061 + 0.7) + 0.28 * sin(t * 0.113 + 2.4) + 0.14 * cos(t * 0.193);
    float rollAngle = t * 0.095 + 0.65 * sin(t * 0.089 + 0.5) + 0.32 * cos(t * 0.147);

    // Optional subtle mouse look offset
    if (iMouse.z > 0.0) {
        vec2 mouseOffset = (iMouse.xy / iResolution.xy - 0.5) * vec2(2.4, 1.6);
        yaw   += mouseOffset.x;
        pitch += mouseOffset.y;
    }

    // Apply graceful yaw and pitch to camera basis
    vec3 forward = normalize(baseForward * cos(yaw) + baseRight * sin(yaw));
    vec3 right   = normalize(cross(forward, baseUp));
    forward      = normalize(forward * cos(pitch) + baseUp * sin(pitch));
    vec3 up      = cross(right, forward);

    // Optical chromatic aberration: radial RGB ray dispersion
    vec2 vUv = fragCoord / iResolution.xy - 0.5;
    float r2 = dot(vUv, vUv);
    vec2 caOffset = vUv * (0.0045 + 0.0125 * r2);

    vec3 rd  = getRayDir(uv, forward, right, up, rollAngle);
    vec3 rdR = getRayDir(uv + caOffset, forward, right, up, rollAngle);
    vec3 rdB = getRayDir(uv - caOffset, forward, right, up, rollAngle);

    vec3 caWorldDir = rdR - rdB;
    float caMag = length(caOffset);

    vec3 accumColor = vec3(0.0);
    float transmittance = 1.0;

    // Volumetric raymarch through the defined nebula clouds
    const int STEPS = 68;
    const float T_START = 0.25;
    const float T_END   = 24.0;
    float stepSize = (T_END - T_START) / float(STEPS);
    float dither = hash12(fragCoord + fract(t) * 100.0);
    float dist = T_START + stepSize * dither;

    for (int i = 0; i < STEPS; i++) {
        vec3 p = ro + rd * dist;
        vec3 neb = sampleNebula(p, t);

        float dens  = neb.x;
        float core  = neb.y;
        float phase = neb.z;

        if (dens > 0.004 || core > 0.002) {
            // Saturated, shifting colors across clouds without white blowout
            vec3 primaryCol = nebulaPalette(phase);
            vec3 accentCol  = nebulaPalette(phase + 0.26);
            vec3 emitCol    = mix(primaryCol, accentCol, smoothstep(0.15, 0.85, dens));

            // Ionization knots glow with richer, deeper saturation rather than white
            emitCol = mix(emitCol, emitCol * 1.45 + vec3(0.08, 0.02, 0.12), core * 0.55);

            // Volumetric chromatic aberration along radial lens vector
            float dispSample = dot(sin(p * 0.85 + caWorldDir * dist * 1.4), cos(p.yzx * 0.85));
            vec3 caShift = vec3(
                1.0 + 0.24 * caMag * 45.0 * (0.5 + 0.5 * dispSample),
                1.0,
                1.0 + 0.24 * caMag * 45.0 * (0.5 - 0.5 * dispSample)
            );
            emitCol *= caShift;

            // Smooth near-camera fade and far fade
            float nearFade = smoothstep(0.25, 2.2, dist);
            float farFade  = smoothstep(T_END, T_END - 5.5, dist);
            float envelope = nearFade * farFade;

            // Higher absorption relative to emission keeps clouds defined and non-washed-out
            float sigma = (dens * 0.44 + core * 0.18) * envelope;
            float alpha = 1.0 - exp(-sigma * stepSize * 1.35);
            vec3 stepLight = emitCol * (dens * 0.34 + core * 0.46) * stepSize * 0.82 * envelope;

            accumColor += transmittance * stepLight;
            transmittance *= (1.0 - alpha * 0.82);

            if (transmittance < 0.015) {
                break;
            }
        }

        dist += stepSize;
    }

    // Deep space background with chromatic aberration on R, G, B channels
    if (transmittance > 0.005) {
        float bgR = sampleDeepSpace(rdR, t).r;
        float bgG = sampleDeepSpace(rd,  t).g;
        float bgB = sampleDeepSpace(rdB, t).b;
        accumColor += transmittance * vec3(bgR, bgG, bgB);
    }

    // ACES-like filmic tone mapping
    vec3 col = accumColor;
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

    // Gentle vignette
    col *= 1.0 - 0.28 * r2;

    // Gamma correction
    col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

    fragColor = vec4(col, 1.0);
}
