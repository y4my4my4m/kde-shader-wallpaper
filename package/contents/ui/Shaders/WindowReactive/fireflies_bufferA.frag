// Fireflies — Buffer A: firefly records and globals.
// @channels self, bufferC
// @substeps 1
//
// Layout in fireflies_common.frag. iChannel0 is this buffer's previous
// step, iChannel1 Buffer C (light fields) as of the previous frame. The
// simulation steps once per frame (simStep in the common file); both texels
// of a record run the same update and keep their half.
//
// Flash phases are locally coupled oscillators:
//   dphase/dt = w_i + K/(2 pi) Im(Z e^{-2 pi i phase}) + E L prc(phase)
//               + W/(2 pi) sin(2 pi (wave(p, t) - phase))
// Z is the phase field around the firefly normalised by its weight (a
// local Kuramoto order parameter), L the flash light there and prc a phase
// response that only advances late in the cycle (pulse coupling: a
// neighbour's flash fires those about to flash). The last term entrains
// the swarm to rings of flashes spreading from a slowly wandering source;
// their spacing changes over minutes. K, E and W swell and fade over
// MOOD_CYCLE, so the swarm locks into waves of flashes and drifts apart
// again.
//
// Flight: a random-walk heading at a per-layer cruising speed, a spring to
// a home altitude, a rise while lit, soft screen walls and window walls.
// A slow cursor on bare desktop is a lantern the curious circle; a fast one
// scatters and startles those it passes. Mid-layer fireflies perch on
// window edges, ride along while the window moves gently and are shaken
// off by a fast one.

const float PERIOD     = 2.8;   // s, mean natural flash period
const float WAVE_HZ    = 1286.0 / CLOCK_WRAP; // flashes/s of the wave, whole cycles per CLOCK_WRAP
const float SPREAD     = 0.2;   // relative spread of natural periods
const float K_MAX      = 0.9;   // rad/s, phase-field coupling at SYNC 1, full mood
const float E_MAX      = 1.0;   // cycles/s per unit flash light at SYNC 1, full mood
const float W_MAX      = 0.45;  // rad/s, entrainment to the wave at SYNC 1, full mood
const float MOOD_CYCLE = 240.0; // s, divides CLOCK_WRAP
const float TAU_V      = 0.9;   // s, velocity relaxation
const float SCATTER_V  = 0.9;   // H/s of cursor travel that scatters
const float SCATTER_R  = 0.1;   // H
const float SHAKE_V    = 0.25;  // H/s of window travel that shakes perched fireflies off

vec4 G0;
vec4 G1;
vec4 G2;
float gAspect;
float gDt;
float gMood;
int gBase;
int gRing;
bool gJar;
bool gCurValid;
vec2 gCur;
vec2 gCurPrev;

// Per-step random number k of firefly i.
float stepRand(int i, int k)
{
    return hashf(hashu(uint(i) * 0x9E3779B9u ^ uint(k) * 0x632BE5ABu) ^ uint(iFrame) * 0x85EBCA6Bu);
}

vec2 rot(vec2 v, float a)
{
    float c = cos(a);
    float s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// ------------------------------------------------------------- inputs

vec4 winRect(int k) { return iWindowRects[k] / iResolution.y; }
vec4 winPrev(int k) { return iWindowRectsPrev[k] / iResolution.y; }
bool winValid(vec4 r) { return r.z > 0.004 && r.w > 0.004; }

bool insideAnyWindow(vec2 p)
{
    for (int k = 0; k < iWindowCount && k < 16; k++) {
        vec4 r = winRect(k);
        if (!winValid(r)) continue;
        if (p.x > r.x && p.y > r.y && p.x < r.x + r.z && p.y < r.y + r.w) return true;
    }
    return false;
}

// Bilinear sample of Buffer C at p.
vec4 fieldAt(vec2 p)
{
    vec2 g = p * BINS_PER_H - 0.5;
    ivec2 hi = ivec2(binCols(gAspect), int(BINS_PER_H)) - 1;
    ivec2 i0 = ivec2(floor(g));
    vec2 f = g - floor(g);
    vec4 a = texelFetch(iChannel1, clamp(i0, ivec2(0), hi), 0);
    vec4 b = texelFetch(iChannel1, clamp(i0 + ivec2(1, 0), ivec2(0), hi), 0);
    vec4 c = texelFetch(iChannel1, clamp(i0 + ivec2(0, 1), ivec2(0), hi), 0);
    vec4 d = texelFetch(iChannel1, clamp(i0 + ivec2(1, 1), ivec2(0), hi), 0);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 1 while the swarm leans to synchrony, 0 while it drifts apart.
float moodAt(float t) { return smoothstep(-0.45, 0.45, cos(TAU * t / MOOD_CYCLE)); }

// Wave source (H), wandering over and beyond the screen; periods divide
// CLOCK_WRAP. Wide screens get a second source, and the two sets of rings
// meet and merge.
vec2 waveSource(float t, int k)
{
    vec2 s = vec2(0.5 + 0.62 * sin(TAU * t / 900.0 + 1.0), 0.32 + 0.3 * sin(TAU * t / 600.0));
    if (k == 1) s = vec2(1.0 - s.x, 0.64 - s.y);
    return vec2(s.x * gAspect, s.y);
}

// Target phase (cycles) of the wave at p: rings spreading from the source
// at WAVE_HZ, 0.25 to 0.75 rings per H.
float wavePhase(vec2 p, float t)
{
    float r = distance(p, waveSource(t, 0));
    if (gAspect > 2.4) r = min(r, distance(p, waveSource(t, 1)));
    float k = 0.5 + 0.25 * sin(TAU * t / 1200.0 + 2.0);
    return fract(WAVE_HZ * t) - k * r;
}

// ------------------------------------------------------------- flight

// Altitude band (H) of each layer.
vec2 band(int layer)
{
    if (layer == LAYER_FAR) return vec2(0.27, 0.43);
    if (layer == LAYER_MID) return vec2(0.13, 0.62);
    return vec2(0.06, 0.82);
}

float homeY(int i, int layer)
{
    vec2 b = band(layer);
    return mix(b.x, b.y, pow(flyRand(i, 3), 1.3));
}

float cruise(int layer, int i)
{
    float s = layer == LAYER_FAR ? 0.010 : (layer == LAYER_MID ? 0.020 : 0.030);
    return s * (0.7 + 0.6 * flyRand(i, 9));
}

// Seconds of life a jar firefly in slot i starts with.
float jarLife(int i) { return 24.0 + 18.0 * flyRand(i, 22); }

int seedLayer(int i)
{
    float u = flyRand(i, 1);
    return u < 0.36 ? LAYER_FAR : (u < 0.85 ? LAYER_MID : LAYER_NEAR);
}

void seedFly(int i, out vec4 o0, out vec4 o1)
{
    o0 = vec4(0.0);
    o1 = vec4(0.0);
    if (i >= gBase) return;
    int layer = seedLayer(i);
    vec2 b = band(layer);
    vec2 p = vec2(flyRand(i, 2) * gAspect, mix(b.x, b.y, flyRand(i, 4)));
    // Partly ordered phases, close to the wave, so the first rings spread
    // within seconds.
    float ph = fract(wavePhase(p, 0.0) + 0.4 * (flyRand(i, 5) - 0.5));
    float hd = TAU * flyRand(i, 6);
    o0 = vec4(p, ph, packCode(layer, MODE_FLY, 1.0));
    o1 = vec4(0.01 * cos(hd), 0.005 * sin(hd), 8.0 * flyRand(i, 7), hd);
}

// Firefly k of a jar opened at the cursor this step, in slot i.
void spawnJar(int i, int k, out vec4 o0, out vec4 o1)
{
    float r = stepRand(i, 3);
    int layer = r < 0.12 ? LAYER_FAR : (r < 0.86 ? LAYER_MID : LAYER_NEAR);
    float a = float(k) * 2.39996 + 0.5 * stepRand(i, 4);
    vec2 dir = vec2(cos(a), sin(a));
    float sp = 0.06 + 0.14 * stepRand(i, 5);
    vec2 v = dir * sp + vec2(-dir.y, dir.x) * 0.08;
    // Staggered phases: the jar sparkles open over about a second.
    float ph = fract(0.985 - 0.45 * float(k) / float(JAR_SIZE));
    o0 = vec4(gCur + dir * (0.006 + 0.03 * float(k) / float(JAR_SIZE)), ph, packCode(layer, MODE_FLY, 0.4));
    o1 = vec4(v, jarLife(i), a);
}

void takeOff(int i, vec2 v, inout int mode, inout float timer, inout float aux, inout vec2 vel)
{
    mode = MODE_FLY;
    vel = v;
    aux = 0.5 * PI + 1.6 * (stepRand(i, 6) - 0.5);
    timer = 6.0 + 20.0 * stepRand(i, 7);
}

void updateFly(int i, out vec4 o0, out vec4 o1)
{
    vec4 a0 = texelFetch(iChannel0, flyTexel(i, 0), 0);
    vec4 a1 = texelFetch(iChannel0, flyTexel(i, 1), 0);
    bool extra = i >= gBase;
    if (extra && gJar) {
        int k = (i - gBase - gRing + 2 * EXTRA_SLOTS) % EXTRA_SLOTS;
        if (k < JAR_SIZE) {
            spawnJar(i, k, o0, o1);
            return;
        }
    }
    o0 = a0;
    o1 = a1;
    int mode = modeOf(a0.w);
    if (mode == MODE_ABSENT) return;

    int layer = layerOf(a0.w);
    float vis = visOf(a0.w);
    vec2 p = a0.xy;
    vec2 v = a1.xy;
    float ph = a0.z;
    float timer = a1.z;
    float aux = a1.w;
    float dt = gDt;

    // Phase.
    vec4 F = fieldAt(p);
    float ang = TAU * ph;
    // The field is a running average of e^{2 pi i phase} with time constant
    // PHASE_TAU: at the wave's rate it lags by atan(2 pi WAVE_HZ PHASE_TAU)
    // and shrinks; multiplying by 1 + 2 pi i WAVE_HZ PHASE_TAU undoes both.
    float lagc = TAU * WAVE_HZ * PHASE_TAU;
    vec2 Z = vec2(F.y - lagc * F.z, F.z + lagc * F.y);
    float kur = (Z.y * cos(ang) - Z.x * sin(ang)) / (F.w + 0.6);
    float K = SYNC * K_MAX * (0.05 + 0.95 * gMood);
    float E = SYNC * E_MAX * (0.15 + 0.85 * gMood);
    float W = SYNC * W_MAX * gMood;
    float omega = 1.0 / (PERIOD * (1.0 + SPREAD * (flyRand(i, 8) - 0.5)));
    omega *= 1.0 + 0.3 * (stepRand(i, 1) - 0.5);
    float prc = smoothstep(0.6, 0.95, ph);
    float dph = omega + K / TAU * kur + E * F.x * prc + W / TAU * sin(TAU * (wavePhase(p, G0.x) - ph));
    ph = fract(ph + max(dph, 0.15 * omega) * dt);

    // A fast cursor passing close scatters and startles.
    vec2 kick = vec2(0.0);
    if (gCurValid) {
        vec2 ab = gCur - gCurPrev;
        float speed = length(ab) / dt;
        if (speed > SCATTER_V) {
            float h = clamp(dot(p - gCurPrev, ab) / dot(ab, ab), 0.0, 1.0);
            vec2 c = gCurPrev + ab * h;
            float d = distance(p, c);
            if (d < SCATTER_R) {
                vec2 n = d > 1e-4 ? (p - c) / d : normalize(vec2(-ab.y, ab.x));
                kick = n * (0.25 + 0.08 * min(speed, 4.0)) * (1.0 - d / SCATTER_R);
                if (ph > 0.3) ph = 0.985;
            }
        }
    }

    if (mode == MODE_PERCH) {
        int side = int(aux / 100.0);
        float left = aux - float(side) * 100.0;
        bool found = false;
        vec2 wv = vec2(0.0);
        for (int k = 0; k < iWindowCount && k < 16; k++) {
            vec4 pr = winPrev(k);
            vec4 cr = winRect(k);
            if (!winValid(pr) || !winValid(cr)) continue;
            bool on;
            vec2 delta;
            if (side == 0) {
                on = abs(p.y - (pr.y + pr.w + PERCH_GAP)) < 0.003 && p.x > pr.x - 0.002 && p.x < pr.x + pr.z + 0.002;
                delta = vec2(cr.x - pr.x, cr.y + cr.w - pr.y - pr.w);
            } else if (side == 1) {
                on = abs(p.x - (pr.x - PERCH_GAP)) < 0.003 && p.y > pr.y - 0.002 && p.y < pr.y + pr.w + 0.002;
                delta = cr.xy - pr.xy;
            } else {
                on = abs(p.x - (pr.x + pr.z + PERCH_GAP)) < 0.003 && p.y > pr.y - 0.002 && p.y < pr.y + pr.w + 0.002;
                delta = vec2(cr.x + cr.z - pr.x - pr.z, cr.y - pr.y);
            }
            if (on) {
                found = true;
                p += delta;
                wv = iWindowVelocities[k] / iResolution.y;
                wv = length(delta) / dt > length(wv) ? delta / dt : wv;
                break;
            }
        }
        left -= dt;
        v = vec2(0.0);
        aux = float(side) * 100.0 + max(left, 0.0);
        if (found && length(wv) > SHAKE_V) {
            vec2 off = vec2(0.12 * (stepRand(i, 8) - 0.5), 0.06 + 0.08 * stepRand(i, 9));
            takeOff(i, wv * 0.6 + off, mode, timer, aux, v);
            if (ph > 0.3) ph = 0.985;
        } else if (!found || left <= 0.0 || length(kick) > 0.0) {
            takeOff(i, vec2(0.03 * (stepRand(i, 8) - 0.5), 0.035) + kick, mode, timer, aux, v);
        }
    } else {
        float spd = cruise(layer, i);
        float flash = flashOf(ph, i);
        aux += (stepRand(i, 2) - 0.5) * 3.46 * 1.6 * sqrt(dt);
        vec2 vd = spd * vec2(cos(aux), 0.6 * sin(aux));
        float spring = layer == LAYER_FAR ? 1.6 : 0.8;
        vd.y += clamp((homeY(i, layer) - p.y) * spring, -1.0, 1.0) * spd * 2.0;
        // The flash is J-shaped: fireflies rise while lit.
        vd.y += 0.8 * spd * flash;
        vd.x += 2.0 * (max(0.03 - p.x, 0.0) - max(p.x - (gAspect - 0.03), 0.0));
        vd.y += 2.0 * (max(0.04 - p.y, 0.0) - max(p.y - 0.92, 0.0));

        // Windows: keep out, leave if caught inside a small one, and perch.
        bool percher = layer == LAYER_MID && !extra && timer <= 0.0 && flyRand(i, 13) < 0.35;
        int side = flyRand(i, 14) < 0.7 ? 0 : (flyRand(i, 15) < 0.5 ? 1 : 2);
        float bestD = 0.22;
        vec2 bestT = vec2(0.0);
        for (int k = 0; k < iWindowCount && k < 16; k++) {
            vec4 r = winRect(k);
            if (!winValid(r)) continue;
            vec2 hs = 0.5 * r.zw;
            vec2 q = p - (r.xy + hs);
            vec2 dq = abs(q) - hs;
            float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0);
            if (sd < 0.0) {
                // Under a large window a firefly drifts on unseen.
                if (r.z * r.w < 0.45 * gAspect) {
                    vd += (dq.x > dq.y ? vec2(sign(q.x), 0.0) : vec2(0.0, sign(q.y))) * 0.1;
                }
            } else if (sd < 0.05) {
                vec2 n = normalize(max(dq, 0.0) * sign(q) + 1e-6);
                vd += n * 0.05 * (1.0 - sd / 0.05);
            }
            if (!percher || r.z < 0.06 || r.w < 0.06) continue;
            if (length(iWindowVelocities[k]) / iResolution.y > 0.05) continue;
            vec2 ea;
            vec2 eb;
            vec2 off;
            if (side == 0) {
                ea = vec2(r.x + 0.01, r.y + r.w);
                eb = vec2(r.x + r.z - 0.01, r.y + r.w);
                off = vec2(0.0, PERCH_GAP);
            } else {
                float ex = side == 1 ? r.x : r.x + r.z;
                ea = vec2(ex, r.y + 0.02);
                eb = vec2(ex, r.y + r.w - 0.02);
                off = vec2(side == 1 ? -PERCH_GAP : PERCH_GAP, 0.0);
            }
            vec2 e = eb - ea;
            vec2 c = ea + e * clamp(dot(p - ea, e) / dot(e, e), 0.0, 1.0) + off;
            float d = distance(p, c);
            if (d < bestD && !insideAnyWindow(c)) {
                bestD = d;
                bestT = c;
            }
        }
        if (percher && bestD < 0.22) {
            vec2 to = (bestT - p) / max(bestD, 1e-4);
            vd = mix(vd, to * max(spd * 1.6, min(bestD * 2.0, 0.03)), 0.85 * smoothstep(0.22, 0.12, bestD));
            if (bestD < 0.006) {
                mode = MODE_PERCH;
                p = bestT;
                v = vec2(0.0);
                aux = float(side) * 100.0 + 8.0 + 12.0 * flyRand(i, 16);
            }
        }

        // Lantern: the curious drift to a slow cursor and circle it.
        float lw = clamp(G0.z * LANTERN, 0.0, 1.0);
        if (mode == MODE_FLY && lw > 0.005 && flyRand(i, 17) < 0.5) {
            vec2 d = gCur - p;
            float r = length(d);
            float w = lw * (1.0 - smoothstep(0.2, 0.4, r));
            w *= layer == LAYER_MID ? 1.0 : (layer == LAYER_FAR ? 0.35 : 0.3);
            if (w > 0.0) {
                float ro = 0.035 + 0.13 * flyRand(i, 18);
                vec2 n = d / max(r, 1e-4);
                vec2 t = vec2(-n.y, n.x) * (flyRand(i, 19) < 0.7 ? 1.0 : -1.0);
                float radial = clamp((r - ro) * 1.2, -0.04, 0.06);
                float orbit = (0.02 + 0.03 * flyRand(i, 20)) * smoothstep(3.0 * ro, ro, r);
                vec2 vl = n * radial + t * orbit + 0.3 * spd * vec2(cos(aux), sin(aux));
                vd = mix(vd, vl, w);
            }
        }

        if (mode == MODE_FLY) {
            bool young = extra && timer > jarLife(i) - 2.5;
            if (young) {
                // Jar fireflies spiral out, then settle into the swarm.
                v = rot(v, 3.0 * dt) * exp(-dt / 2.2);
                v += (vd - v) * (1.0 - exp(-dt / 4.0));
            } else {
                v += (vd - v) * (1.0 - exp(-dt / TAU_V));
            }
            v += kick;
            float sp = length(v);
            if (sp > 1.2) v *= 1.2 / sp;
            p = clamp(p + v * dt, vec2(-0.2), vec2(gAspect + 0.2, 1.2));
        }
    }

    if (extra) {
        timer -= dt;
        if (timer < 0.0) {
            vis -= dt / 4.0;
            if (vis <= 0.0) {
                o0 = vec4(0.0);
                o1 = vec4(0.0);
                return;
            }
        } else {
            vis = min(vis + 2.0 * dt, 1.0);
        }
    } else {
        if (mode == MODE_FLY) timer = max(timer - dt, 0.0);
        vis = min(vis + dt, 1.0);
    }
    o0 = vec4(p, ph, packCode(layer, mode, vis));
    o1 = vec4(v, timer, aux);
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    fragColor = vec4(0.0);
    bool rec = ic.x < 2 * FLY_COLS && ic.y < MAX_FLIES / FLY_COLS;
    bool glob = ic.y == GLOBAL_ROW && ic.x < 3;
    if (!rec && !glob) return;
    if (!simStep()) {
        fragColor = texelFetch(iChannel0, ic, 0);
        return;
    }

    gAspect = iResolution.x / iResolution.y;
    gBase = baseCount(gAspect);
    gDt = simDt();
    int i = ic.y * FLY_COLS + ic.x / 2;
    if (rec && i >= slotCount(gAspect)) return;

    G0 = texelFetch(iChannel0, ivec2(0, GLOBAL_ROW), 0);
    G1 = texelFetch(iChannel0, ivec2(1, GLOBAL_ROW), 0);
    G2 = texelFetch(iChannel0, ivec2(2, GLOBAL_ROW), 0);
    bool init = G0.w < 0.5;

    gCur = iMouse.xy / iResolution.y;
    gCurPrev = iMousePrev / iResolution.y;
    bool inScreen = (iMouse.x > 1.0 || iMouse.y > 1.0) && iMouse.x < iResolution.x && iMouse.y < iResolution.y;
    gCurValid = inScreen && (iMousePrev.x > 1.0 || iMousePrev.y > 1.0);
    bool onDesktop = inScreen && !insideAnyWindow(gCur);
    bool held = iMouse.z > 0.0;
    gJar = !init && held && G1.z < 0.5 && onDesktop && gCur.y > 0.06;
    gRing = int(G1.w + 0.5) % EXTRA_SLOTS;
    gMood = moodAt(G0.x);

    if (rec) {
        vec4 o0;
        vec4 o1;
        if (init) seedFly(i, o0, o1);
        else updateFly(i, o0, o1);
        fragColor = (ic.x & 1) == 0 ? o0 : o1;
        return;
    }

    if (init) {
        G0 = vec4(0.0, 1000.0, 0.0, 1.0);
        G1 = vec4(0.0, 0.0, held ? 1.0 : 0.0, 0.0);
        G2 = vec4(0.0, 0.0, 1000.0, 0.0);
    } else {
        float dt = gDt;
        bool moved = distance(iMouse.xy, iMousePrev) > iResolution.y / 1400.0;
        vec2 vInst = gCurValid ? (gCur - gCurPrev) / dt : vec2(0.0);
        G1.xy += (vInst - G1.xy) * (1.0 - exp(-dt / 0.15));
        G0.y = moved ? 0.0 : min(G0.y + dt, 1000.0);
        // The lantern lights while the cursor rests or moves slowly on bare
        // desktop above the panel strip, and dims after half a minute of
        // stillness.
        float lit = onDesktop && gCur.y > 0.06 && length(G1.xy) < 0.5 ? 1.0 - smoothstep(25.0, 40.0, G0.y) : 0.0;
        G0.z += (lit - G0.z) * (1.0 - exp(-dt / 1.2));
        G0.x = mod(G0.x + dt, CLOCK_WRAP);
        G1.z = held ? 1.0 : 0.0;
        if (gJar) {
            G1.w = float((gRing + JAR_SIZE) % EXTRA_SLOTS);
            G2.xyz = vec3(gCur, 0.0);
        } else {
            G2.z = min(G2.z + dt, 1000.0);
        }
        G2.w = min(G2.w + dt, 1e5);
    }
    fragColor = ic.x == 0 ? G0 : (ic.x == 1 ? G1 : G2);
}
