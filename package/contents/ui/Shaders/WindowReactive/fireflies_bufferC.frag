// Fireflies — Buffer C: light fields.
// @channels bufferA, bufferB, self
//
// Texel (x, y), x < binCols, y < BINS_PER_H, holds fields at the bin centre
// (x + 0.5, y + 0.5) / BINS_PER_H:
//   x   flash light: 1 at a lone firefly at full flash, more in a crowd
//   yz  phase field: weighted sum of (cos, sin)(2 pi phase) around the bin
//   w   its weight, about 7 at the mean density of a 16:9 swarm of 320
// Every other texel is zero.
//
// Each substep the fields diffuse, decay and take in a splat of the
// fireflies listed in the bin by Buffer B:
//   F' = F + dt (D lap F + (S - F) / tau)
// a leaky diffusion whose steady state blurs the splats over a length of
// sqrt(D tau): 0.05 H for the flash light, 0.08 H for the phase field. The
// phase field lags the swarm by its time constant; Buffer A undoes the lag.
// The explicit step is stable while D dt / bin^2 < 0.25; dt is capped at
// 1/200 s to keep it so.
//
// iChannel0  Buffer A, iChannel1 Buffer B (both this substep), iChannel2 this buffer.

const float FLASH_TAU  = 0.1;     // s
const float FLASH_D    = 0.025;   // H^2/s
const float FLASH_GAIN = 27.0;
const float PHASE_D    = 0.025;   // H^2/s
const float PHASE_GAIN = 60.0;
const float SPLAT_R    = 0.03;    // H

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    float aspect = iResolution.x / iResolution.y;
    int cols = binCols(aspect);
    if (ic.x >= cols || ic.y >= int(BINS_PER_H)) {
        fragColor = vec4(0.0);
        return;
    }
    ivec2 hi = ivec2(cols - 1, int(BINS_PER_H) - 1);
    vec4 f = texelFetch(iChannel2, ic, 0);
    vec4 lap = texelFetch(iChannel2, clamp(ic + ivec2(1, 0), ivec2(0), hi), 0)
             + texelFetch(iChannel2, clamp(ic - ivec2(1, 0), ivec2(0), hi), 0)
             + texelFetch(iChannel2, clamp(ic + ivec2(0, 1), ivec2(0), hi), 0)
             + texelFetch(iChannel2, clamp(ic - ivec2(0, 1), ivec2(0), hi), 0) - 4.0 * f;
    lap *= BINS_PER_H * BINS_PER_H;

    // Splat: kernel (1 - d^2 / R^2)^2, normalised to unit sum over bins.
    vec2 c = (vec2(ic) + 0.5) / BINS_PER_H;
    float norm = 3.0 / (PI * SPLAT_R * SPLAT_R * BINS_PER_H * BINS_PER_H);
    vec4 s = vec4(0.0);
    vec4 l = texelFetch(iChannel1, ic, 0);
    for (int k = 0; k < 8; k++) {
        float v = l[k / 2];
        float hv = floor(v / 2048.0);
        int id = int((k % 2 == 0) ? hv : v - hv * 2048.0) - 1;
        if (id < 0) break;
        vec4 a = texelFetch(iChannel0, flyTexel(id, 0), 0);
        if (modeOf(a.w) == MODE_ABSENT) continue;
        vec2 d = a.xy - c;
        float kk = max(1.0 - dot(d, d) / (SPLAT_R * SPLAT_R), 0.0);
        float w = visOf(a.w) * kk * kk * norm;
        float ang = TAU * a.z;
        s.x += w * flashOf(a.z, id) * layerGain(layerOf(a.w));
        s.yzw += w * vec3(cos(ang), sin(ang), 1.0);
    }
    s.x *= FLASH_GAIN;
    s.yzw *= PHASE_GAIN;

    float dt = min(iTimeDelta, 0.005);
    vec4 D = vec4(FLASH_D, PHASE_D, PHASE_D, PHASE_D);
    vec4 tau = vec4(FLASH_TAU, PHASE_TAU, PHASE_TAU, PHASE_TAU);
    fragColor = f + dt * (D * lap + (s - f) / tau);
}
