// Audio integrator for Ysin_Mist_Audio (16F-safe: stores PHASES wrapped to
// 2pi, never a growing time value - half-float precision dies past ~6.0).
// iChannel0 = audio FFT, iChannel1 = self (previous frame).
// State texels (x quarters): (.125,.5) phases travel1, morph1/2/3
//                            (.375,.5) travel2, travel3, smoothed E, raw E
//                            (.625,.5) smoothed mids, braid DRIVE,
//                                      the drive's slow mean and spread
//                            (.875,.5) PERCUSSION: kick pulse + its reference,
//                                      hat pulse + its reference
void mainImage(out vec4 C, in vec2 U)
{
    vec4 sA = texture(iChannel1, vec2(.125, .5));
    vec4 sB = texture(iChannel1, vec2(.375, .5));
    vec4 sC = texture(iChannel1, vec2(.625, .5));
    vec4 sD = texture(iChannel1, vec2(.875, .5));

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

    // Braid drive: the DEVIATION of that band from its own running average,
    // not its level. The spectrum texture is already dB-mapped, so on real
    // music a level sits near the top and barely moves - measured on this
    // host, the old level-driven amplitude factor spanned 0.81..0.82, i.e.
    // one percent, which is why the braid looked like it had a fixed size.
    //
    // The deviation is then divided by its OWN mean magnitude (Md), so the
    // drive fills 0..1 whatever the track's dynamics are, with no constant to
    // retune per genre. Both references run at ~4 s and are seeded on the
    // first frame (an unseeded mean reads every band as far above average and
    // pins the braid wide open for the first seconds).
    float dt = clamp(iTimeDelta, 0., .05);
    float k4 = clamp(dt/4., 0., 1.);
    bool  seedC = (sC.z + sC.w) < 1e-4;
    float Mm = seedC ? Ms  : mix(sC.z, Ms, k4);                    // slow mean
    float Md = seedC ? .05 : mix(sC.w, abs(Ms - Mm), k4);          // its spread
    float drv = clamp(.5 + .5*(Ms - Mm)/max(2.*Md, .02), 0., 1.);
    // Smoothed asymmetrically: swells in ~0.2 s, settles in ~0.5 s. This is
    // deliberately slower than the Mix variant's per-band drive - the braid
    // should breathe, not shiver.
    float Ds = mix(sC.y, drv, drv > sC.y ? .08 : .035);

    // --- percussion: onset detection, not level -----------------------------
    // A drum is a sudden RISE, so what matters is how far a band has jumped
    // above where it was a moment ago - its own level says nothing (a steady
    // bass line sits as high as a kick). Two bands, because a kit lives in
    // two places: 44-121 Hz for the kick, 3.9-9.4 kHz for snare/hats.
    // The reference tracks at ~0.25 s, so it follows the groove but not the
    // hit itself, and a small threshold (.015) keeps ordinary wobble out.
    // Constants measured against a real track: they put the pulse above .25
    // for about a fifth of the time at ~180 hits/min - a flick on the beat.
    // Raising the gain to 9 with no threshold (the first attempt) left it
    // saturated 75% of the time, which reads as shimmer, not as a pulse.
    float kb = .25*( texture(iChannel0, vec2(.0045,.25)).r + texture(iChannel0, vec2(.0065,.25)).r
                   + texture(iChannel0, vec2(.0085,.25)).r + texture(iChannel0, vec2(.0105,.25)).r );
    float hb = .25*( texture(iChannel0, vec2(.38,.25)).r + texture(iChannel0, vec2(.50,.25)).r
                   + texture(iChannel0, vec2(.65,.25)).r + texture(iChannel0, vec2(.80,.25)).r );
    float kr = mix(sD.y, kb, clamp(dt/.25, 0., 1.));      // kick reference
    float hr = mix(sD.w, hb, clamp(dt/.25, 0., 1.));      // hat reference
    // Instant attack, ~0.13 s decay: one hit = one visible flick that fades,
    // which is a pulse rather than a shiver.
    float dec = exp(-dt/.13);
    float kp = max(clamp((kb - kr - .015)*5., 0., 1.), sD.x*dec);
    float hp = max(clamp((hb - hr - .015)*5., 0., 1.), sD.z*dec);

    float r  = (.35 + 5.0*Es) * dt * 3.;
    const float TAU = 6.2831853;

    vec4 A = vec4( mod(sA.x + 1.2*r, TAU),
                   mod(sA.y + .23*r, TAU),
                   mod(sA.z + .11*r, TAU),
                   mod(sA.w + .07*r, TAU) );
    vec4 B = vec4( mod(sB.x + .7*r, TAU),
                   mod(sB.y + .5*r, TAU),
                   Es, E );
    // third texel: level, SMOOTHED BRAID DRIVE, its slow mean, its spread
    vec4 Cst = vec4(Ms, Ds, Mm, Md);
    vec4 D   = vec4(kp, kr, hp, hr);
    float fx = U.x / iResolution.x * 4.;
    C = (fx < 1.) ? A : (fx < 2.) ? B : (fx < 3.) ? Cst : D;
}
