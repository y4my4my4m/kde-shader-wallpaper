// Audio integrator for Ysin_Mist_Audio (16F-safe: stores PHASES wrapped to
// 2pi, never a growing time value - half-float precision dies past ~6.0).
// iChannel0 = audio FFT, iChannel1 = self (previous frame).
// State texels (x thirds):  left  (.17,.5): phases travel1, morph1/2/3
//                           mid   (.50,.5): travel2, travel3, smoothed E, raw E
//                           right (.83,.5): smoothed MIDS (vocal band), raw mids
void mainImage(out vec4 C, in vec2 U)
{
    vec4 sA = texture(iChannel1, vec2(.17, .5));
    vec4 sB = texture(iChannel1, vec2(.50, .5));
    vec4 sC = texture(iChannel1, vec2(.83, .5));

    float E = 0.;
    for (int i = 0; i < 12; i++)
        E += texture(iChannel0, vec2(.02 + float(i)*.08, .25)).r;
    E /= 12.;
    E = 1. - exp(-2.5*E);          // soft compression, never pins at 1
    float Es = mix(sB.b, E, .05);

    // vocal / mids band (~1-3 kHz in the 512-bin spectrum)
    float M = 0.;
    for (int i = 0; i < 5; i++)
        M += texture(iChannel0, vec2(.08 + float(i)*.055, .25)).r;
    M /= 5.;
    M = 1. - exp(-3.5*M);
    float Ms = mix(sC.x, M, .08);

    float dt = clamp(iTimeDelta, 0., .05);
    float r  = (.35 + 5.0*Es) * dt * 3.;
    const float TAU = 6.2831853;

    vec4 A = vec4( mod(sA.x + 1.2*r, TAU),
                   mod(sA.y + .23*r, TAU),
                   mod(sA.z + .11*r, TAU),
                   mod(sA.w + .07*r, TAU) );
    vec4 B = vec4( mod(sB.x + .7*r, TAU),
                   mod(sB.y + .5*r, TAU),
                   Es, E );
    vec4 Cst = vec4(Ms, M, 0., 1.);
    float fx = U.x / iResolution.x;
    C = (fx < .333) ? A : (fx < .667) ? B : Cst;
}
