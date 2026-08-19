// Audio integrator for Ysin_Mist_Audio (16F-safe: stores PHASES wrapped to
// 2pi, never a growing time value - half-float precision dies past ~6.0).
// iChannel0 = audio FFT, iChannel1 = self (previous frame).
// State texels (x quarters): (.125,.5) phases travel1, morph1/2/3
//                            (.375,.5) travel2, travel3, smoothed E, raw E
//                            (.625,.5) smoothed mids, braid DRIVE,
//                                      the drive's slow mean and spread
//                            (.583,.5) PERCUSSION: kick pulse + its reference,
//                                      hat pulse + its reference
//                            (.750,.5) low/mid/high band envelopes + the pulse
//                            (.917,.5) their ~4 s means; .w = drum PRESSURE
float aTap(float x){ return texture(iChannel0, vec2(x, .25)).r; }

void mainImage(out vec4 C, in vec2 U)
{
    vec4 sA = texture(iChannel1, vec2(1./12., .5));
    vec4 sB = texture(iChannel1, vec2(3./12., .5));
    vec4 sC = texture(iChannel1, vec2(5./12., .5));
    vec4 sD = texture(iChannel1, vec2(7./12., .5));
    vec4 sF = texture(iChannel1, vec2(9./12., .5));    // band envelopes + pulse
    vec4 sM = texture(iChannel1, vec2(11./12., .5));   // their slow means + drum pressure

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

    // --- three bands for the MAIN wave's harmonics ---------------------------
    // The wave's big swings used to be pure geometry: three morph phases that
    // cycled through every shape whatever the music did. Bound now to the part
    // of the spectrum each harmonic stands for - low, mid, high - through the
    // same deviation-against-own-mean trick the braid uses, because the dB
    // scale makes raw levels sit near the top and barely move.
    float bLo = .25*( aTap(.0035) + aTap(.0065) + aTap(.0110) + aTap(.0180) );  //  39- 200 Hz
    float bMd = .25*( aTap(.030)  + aTap(.055)  + aTap(.090)  + aTap(.140)  );  // 330-1540 Hz
    float bHi = .25*( aTap(.22)   + aTap(.34)   + aTap(.50)   + aTap(.72)   );  // 2.4-7.9 kHz
    // the expanded pulse rides in .w so its ~4 s mean below comes out as the
    // drum PRESSURE, at no extra state cost
    float pulseNow = clamp((kp + .55*hp) * 2.2, 0., 1.);
    vec4 fNow = vec4(bLo, bMd, bHi, pulseNow);
    vec4 aF   = mix(sF, fNow, mix(vec4(.12), vec4(.45), step(sF, fNow)));
    bool  seedF = dot(sM, vec4(1.)) < 1e-4;
    vec4 aM   = seedF ? aF : mix(sM, aF, clamp(dt/4., 0., 1.));

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
    float fx = U.x / iResolution.x * 6.;
    C = (fx < 1.) ? A : (fx < 2.) ? B : (fx < 3.) ? Cst
      : (fx < 4.) ? D : (fx < 5.) ? aF : aM;
}
