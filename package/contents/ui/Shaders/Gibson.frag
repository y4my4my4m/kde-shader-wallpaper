// https://www.shadertoy.com/view/ttByRm
// Credits to dean_the_coder
// Modified (Buffer A not included)

// 'Hacking the Gibson'
// Thanks to Evvvvil, Flopine, Nusan, BigWings, Iq and a bunch of others for sharing their knowledge!
// Thanks FabriceNeyret2 for the text code: https://www.shadertoy.com/view/llySRh

float time = 0.0;

// Random number generator.
float hash(float p) {
    return fract(sin(dot(p, 123.45)) * 5432.3);
}

// 2D rotation matrix.
mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, s, -s, c);
}

// SDF box function.
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// SDF line function.
float sdLine(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// SDF to a lightning bolt-stle line.
float sdBolt(vec3 p, vec3 a, vec3 b, float id)
{
    float d = 1e7;
    vec3 dp = (b - a) / 5.0;
    for (float i = 0.0; i < 5.0; i++) {
        float t = i + floor((time + id) * 2.0);
        d = min(d, sdLine(p, a + vec3(0.0, hash(t), 0.0), a + dp + vec3(0.0, hash(t + 1.0), 0.0)));
        a += dp;
    }

    return d;
}

// SDF 'framed' box function.
float sdFramedBox(vec3 p, vec3 b) {
    // Thanks iq.
    p = abs(p) - b;
    vec3 q = abs(p);
    return min(min(
        length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
        length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)),
        length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0));
}

vec3 getRayDir(vec3 ro, vec3 lookAt, vec2 uv) {
    vec3 forward = normalize(lookAt - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    return normalize(forward + right * uv.x + up * uv.y);
}

vec4 minD(vec4 a, vec4 b) {
    return a.x < b.x ? a : b;
}

const vec3 s = vec3(2.0, 6.0, 2.0);
vec2 sdTower(vec3 p) {
    p.y -= s.y;

    // Frame glow.
    float outline = sdFramedBox(p, s);
    float glow = 0.001 / (0.001 + outline * outline);

    // Base glow.
    float d = sdBox(p + vec3(0.0, s.y, 0.0), vec3(s.x, 0.01, s.z));
    glow += 0.001 / (0.001 + d * d);

    // Writing glow.
    d = sdBox(p, s);
    if (d > 0.0 && d < 0.075) {
        glow += 0.03;

        vec2 uv = (p.xy + s.xy) / (2.0 * s.xy);
        uv.x *= 0.8;
        uv.y = mod(uv.y * 1.6 - 0.5, 1.0);
        //glow += texture(iChannel0, uv).r;
    }

    return vec2(d, glow);
}

void applyTowerGap(inout vec3 p) {
    p.z = mod(p.z, 9.0) - 4.5;
}

// Distance to the lightning bolts.
float bolt(vec3 p, float id) {
    float t = fract(time * 0.04 * hash(id) + id);
    if (id > 12.5) t = 1.0 - t;
    float h = mix(-50.0, s.y * 1.95, t);

    vec3 a = vec3(s.x, h, -s.z);
    vec3 b = vec3(s.x, h, s.z);

    if (hash(id) > 0.5) {
        a.x = -a.x;
        b.x = -b.x;
    }

    return sdBolt(p, a, b, id);
}

// Collection of towers.
vec4 sdTowers(vec3 p) {
    float id = hash(floor(p.z / 9.0)) * 25.0;
    p.x = mod(p.x, 12.0) - 6.0;
    applyTowerGap(p);

    // Lightning bolts.
    float boltD = bolt(p, id);
    float boltGlow = step(0.0, p.y) * 0.01 / (0.01 + boltD * boltD);

    return vec4(sdTower(p), 0.0, boltGlow);
}

// SDF to the floor.
vec3 sdFloor(vec3 p) {
    if (p.y > 3.0) {
        // Ray not near the ground - Abort early.
        return vec3(1e10, 0.0, 0.0);
    }

    vec3 pp = p;

    applyTowerGap(p);

    p.x = abs(p.x + 1.6) - 0.4;
    p.z -= 4.5;

    const vec2 wh = vec2(0.1, 0.01);
    float d = sdBox(p, vec3(wh, 1e10));
    d = min(d, sdBox(p.zyx - vec3(0.0, 0.0, 100.0), vec3(wh, 100.0)));

    if (pp.x > 0.0) {
        d = min(d, sdBox(p - vec3(2.0, 0.0, 0.0), vec3(wh, 3.0)));
        d = min(d, sdBox(p - vec3(4.0, 0.0, -6.0), vec3(wh, 3.0)));
        d = min(d, sdBox(p - vec3(3.0, 0.0, -3.0), vec3(wh, 1.1).zyx));
    } else {
        d = min(d, sdBox(p - vec3(2.5, 0.0, -8.0), vec3(wh, 1.5)));
    }

    float glow = 0.001 / (0.001 + d * d);
    float t = time * 10.0;

    float pulse1 = sin((pp.z + t) * 0.02);
    float pulse2 = sin((pp.z + t) * 0.02 - 0.6);
    float pulse = step(0.999, pow(0.5 + 0.5 * max(pulse1, pulse2), 10.0));
    return vec3(d, glow - pulse, sqrt(glow) * pulse * 3.0);
}

vec4 map(vec3 p) {
    // dist/white_glow/yellow_glow/blue_glow
    return minD(sdTowers(p), vec4(sdFloor(p), 0.0));
}

vec3 calcNormal(in vec3 p) {
    // Thanks iq.
    vec2 e = vec2(1.0, -1.0) * 0.5773 * 0.0005;
    return normalize(e.xyy * map(p + e.xyy).x +
                     e.yyx * map(p + e.yyx).x +
                     e.yxy * map(p + e.yxy).x +
                     e.xxx * map(p + e.xxx).x);
}

/**********************************************************************************/


vec3 vignette(vec3 col, vec2 fragCoord) {
    vec2 q = fragCoord.xy / iResolution.xy;
    col *= 0.5 + 0.5 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.4);
    return col;
}

void initCamera(out vec3 ro, out vec3 rd, vec2 uv) {
    vec3 lookat;
    float intro = time / 32.0;

    ro = vec3(2.0 * sin(time * 0.1), 1.5 + 12.0 * smoothstep(0.0, 1.0, (0.5 + 0.5 * cos(time * 0.05))), time - 32.0 + 6.4);
    lookat = ro + vec3(-smoothstep(-2.0, 2.0, ro.x) * 0.2, -sin(time * 0.06) * 0.4, 2.0);
    if (intro < 1.2) {
        vec3 intro_ro = vec3(-6.0 * (1.0 - intro), 11.5 - time / 32.0, 6.7);
        vec3 intro_lookat = intro_ro + vec3(0.0, -0.5, 1.0);

        {
            float trans = clamp((intro - 1.0) * 5.0, 0.0, 1.0);
            ro = mix(intro_ro, ro, trans);
            lookat = mix(intro_lookat, lookat, trans);
        }
    }

    rd = getRayDir(ro, lookat, uv);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    time = iTime * 8.0;

    // Position camera and view direction.
    vec3 ro, rd;
    initCamera(ro, rd, uv);

    vec3 col = vec3(0.3, 0.1, 0.4) * max(0.0, rd.y * 0.2); // Sky gradient

    // Raymarch.
    const float maxDist = 100.0;
    float d = 0.0;
    float alpha = 1.0;
    for (float steps = 0.0; steps < 80.0; steps++) {
        vec3 p = ro + rd * d;
        vec4 h = map(p); // Distance, glow1, glow2, glow3

        if (abs(h.x) < 0.005) {
            // We've hit something. Reduce opacity and keep marching.
            h.x = 0.1;
            alpha *= 0.2;
        }

        if (d >= maxDist) // Max draw distance reached - Stop.
            break;
        if (p.y < -0.5) // Ray is below the ground - Stop.
            break;

        // Accumulate the glow.
        float fog = pow(1.0 - d / maxDist, 3.0);
        vec3 whiteGlow = vec3(0.5, 0.6, 1.0);
        vec3 rgb = whiteGlow * max(0.0, (h.y - h.z)) + vec3(1.0, 0.4, 0.02) * h.z;
        rgb += whiteGlow * max(0.0, (h.y - h.w)) + vec3(0.2, 0.3, 1.0) * h.w;
        col += rgb * fog * alpha;

        d += abs(h.x);
    }

    // Output to screen.
    col = pow(col, vec3(0.4545)); // Gamma correction
    col = vignette(col, fragCoord); // Fade screen corners
    fragColor = vec4(col, 1.0);
}
