// Audio integrator for Ysin_Ember (16F-safe: stores PHASES wrapped to
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

// mean of four taps spread across one region (the braid's six bands)
float qband(float lo, float hi){
    return .25*( aTap(mix(lo, hi, .125)) + aTap(mix(lo, hi, .375))
               + aTap(mix(lo, hi, .625)) + aTap(mix(lo, hi, .875)) );
}

void mainImage(out vec4 C, in vec2 U)
{
    vec4 sA = texture(iChannel1, vec2(1./28., .5));
    vec4 sB = texture(iChannel1, vec2(3./28., .5));
    vec4 sC = texture(iChannel1, vec2(5./28., .5));
    vec4 sD = texture(iChannel1, vec2(7./28., .5));
    vec4 sF = texture(iChannel1, vec2(9./28., .5));    // band envelopes + pulse
    vec4 sM = texture(iChannel1, vec2(11./28., .5));   // their slow means + drum pressure
    // --- the Wave_03 braid's state (added when the braid moved to regions) --
    vec4 sR0 = texture(iChannel1, vec2(13./28., .5));   // region envelopes 0..3
    vec4 sR1 = texture(iChannel1, vec2(15./28., .5));   // region envelopes 4,5
    vec4 sN0 = texture(iChannel1, vec2(17./28., .5));   // their slow means 0..3
    vec4 sN1 = texture(iChannel1, vec2(19./28., .5));   // their slow means 4,5
    vec4 sG0 = texture(iChannel1, vec2(21./28., .5));   // smoothed drives 0..3
    vec4 sG1 = texture(iChannel1, vec2(23./28., .5));   // smoothed drives 4,5
    vec4 sP0 = texture(iChannel1, vec2(25./28., .5));   // braid phases 0..3
    vec4 sP1 = texture(iChannel1, vec2(27./28., .5));

    // --- POISON GUARD: recover from a non-finite state --------------------
    // The engine NEVER clears this buffer once created: ensureBufferFBOs()
    // returns early unless the size changed, and the glClear lives only in the
    // creation branch. So the state survives a shader switch, a recompile,
    // everything short of a resize or a plasmashell restart.
    //
    // That turns any single NaN/Inf into a PERMANENT black wallpaper: mix()
    // and mod() propagate it, and every seed test here is a COMPARISON, which
    // is false for NaN - so the buffer can never re-seed itself and the next
    // shader you load inherits the poison too.
    //
    // Cheapest total check: sum the whole state into one float. If that is not
    // finite (or has run away), zero every state vector - the existing seed
    // tests below then fire on their own and rebuild it in one frame.
    float poison = dot((sA + sB + sC + sD + sF + sM + sR0 + sR1 + sN0 + sN1 + sG0 + sG1 + sP0 + sP1), vec4(1.));
    // legit state sums to at most a few hundred (phases wrap at 2pi), so
    // 1e5 catches a runaway that is still technically finite
    if (isnan(poison) || isinf(poison) || abs(poison) > 1e5) {
        sA = vec4(0.);
        sB = vec4(0.);
        sC = vec4(0.);
        sD = vec4(0.);
        sF = vec4(0.);
        sM = vec4(0.);
        sR0 = vec4(0.);
        sR1 = vec4(0.);
        sN0 = vec4(0.);
        sN1 = vec4(0.);
        sG0 = vec4(0.);
        sG1 = vec4(0.);
        sP0 = vec4(0.);
        sP1 = vec4(0.);
    }
   // braid phases 4,5

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

    // --- THE BRAID, rebuilt from Wave_03 -----------------------------------
    // The braid used to run off a single mids drive (Cst.y, still computed
    // above and still stored - the main wave's block is untouched) with a
    // fast drum flick on top. Both are gone from the braid here: six regions,
    // one per strand, and no beat term at all.
    //
    // Regions tile the spectrum edge to edge, centres 55/140/360/900/2300/
    // 5800 Hz, half-width +-0.675 octave. x = frequency / 11025.
    float q0 = qband(.0031, .0080);   //   34 -   88 Hz
    float q1 = qband(.0080, .0203);   //   88 -  224 Hz
    float q2 = qband(.0204, .0521);   //  225 -  575 Hz
    float q3 = qband(.0511, .1304);   //  564 - 1437 Hz
    float q4 = qband(.1306, .3332);   // 1440 - 3673 Hz
    float q5 = qband(.3294, .8401);   // 3632 - 9263 Hz

    // fast envelope, then a 4 s mean per region: each strand is judged against
    // its OWN average, which is what lets a treble strand on a quartet move as
    // much as a bass strand on techno. Absolute levels are useless here - the
    // texture is dB-mapped and a level sits near the top, spanning about one
    // percent. Seeded, or every region reads as far above average for the
    // first seconds and the whole braid pins open.
    vec4 g0 = vec4(q0, q1, q2, q3), g1 = vec4(q4, q5, 0., 1.);
    vec4 aR0 = mix(sR0, g0, mix(vec4(.12), vec4(.45), step(sR0, g0)));
    vec4 aR1 = mix(sR1, g1, mix(vec4(.12), vec4(.45), step(sR1, g1)));
    float qm = clamp(dt/4., 0., 1.);
    bool  seedQ = dot(sN0, vec4(1.)) + dot(sN1, vec4(1.)) < 1e-4;
    vec4 aN0 = seedQ ? g0 : mix(sN0, g0, qm);
    vec4 aN1 = seedQ ? g1 : mix(sN1, g1, qm);

    // deviation -> EXPAND -> SMOOTH, in that order. The raw deviation uses
    // about a fifth of its range, so the smoothstep nearly doubles the visible
    // motion; expansion also multiplies frame-to-frame noise, so the smoothing
    // after it is not optional. Asymmetric and slow on purpose - swells in
    // ~0.2 s, settles in ~0.5 s, which is what makes a strand breathe rather
    // than react.
    vec4 rq0 = clamp((aR0 - aN0)*2.6 + .38, 0., 1.);
    vec4 rq1 = clamp((aR1 - aN1)*2.6 + .38, 0., 1.);
    vec4 eq0 = smoothstep(vec4(.30), vec4(.85), rq0);
    vec4 eq1 = smoothstep(vec4(.30), vec4(.85), rq1);
    vec4 aG0 = mix(sG0, eq0, mix(vec4(.035), vec4(.08), step(sG0, eq0)));
    vec4 aG1 = mix(sG1, eq1, mix(vec4(.035), vec4(.08), step(sG1, eq1)));

    float r  = (.35 + 5.0*Es) * dt * 3.;
    const float TAU = 6.2831853;

    // Travel on the music's clock, at Wave_03's rate: .109*r, a third of the
    // pace that held the median at the original 1.0-2.0 rad/s. Measured, that
    // is 0.084-0.134 screen units per second - one crossing every 27 to 43 s.
    // Six separate wrapped phases, not one shared clock scaled six ways: this
    // is an RGBA16F buffer, a shared clock must be wrapped, and a wrap shifts
    // each strand by a different non-2pi amount.
    float rb = .109 * r;
    vec4 P0 = vec4( mod(sP0.x + 1.0*rb, TAU),
                    mod(sP0.y + 1.2*rb, TAU),
                    mod(sP0.z + 1.4*rb, TAU),
                    mod(sP0.w + 1.6*rb, TAU) );
    vec4 P1 = vec4( mod(sP1.x + 1.8*rb, TAU),
                    mod(sP1.y + 2.0*rb, TAU),
                    (aTap(.45)+aTap(.65))*.5, 1. );  // z = treb export

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
    float fx = U.x / iResolution.x * 14.;
    C = (fx < 1.) ? A : (fx < 2.) ? B : (fx < 3.) ? Cst
      : (fx < 4.) ? D : (fx < 5.) ? aF : (fx < 6.) ? aM
      : (fx < 7.) ? aR0 : (fx < 8.) ? aR1 : (fx < 9.) ? aN0
      : (fx < 10.) ? aN1 : (fx < 11.) ? aG0 : (fx < 12.) ? aG1
      : (fx < 13.) ? P0 : P1;
}
