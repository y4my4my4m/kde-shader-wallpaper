// Audio integrator for Ysin_Ember_Wave.
//
// Wave_01's integrator with the braid rebuilt: six frequency REGIONS instead
// of one mids band, and the braid's travel moved onto the same music-driven
// clock the main wave has always used. 16F-safe throughout - every phase is
// wrapped to 2pi, never a growing time value (half-float precision dies past
// ~6.0). iChannel0 = audio FFT, iChannel1 = self (previous frame).
//
// ELEVEN columns, tapped at (2i+1)/22 here and in the main pass:
//   0 A   travel1, morph1, morph2, morph3
//   1 B   travel2, travel3, Es, raw E
//   2 D   percussion: kick pulse + reference, hat pulse + reference
//   3 F0  fast envelopes, bands 0..3        4 F1  bands 4,5 + raw pulse
//   5 M0  slow means,     bands 0..3        6 M1  bands 4,5 + drum PRESSURE
//   7 G0  smoothed drives, bands 0..3       8 G1  bands 4,5
//   9 P0  braid phases,    strands 0..3    10 P1  strands 4,5
//
// ===========================================================================
// WHAT THIS VERSION DELIBERATELY DOES NOT HAVE
//
// No shiver. The Mix family gave each strand a second, fast term
// (.30*band*sin(3.1*speed...)) and the braid a drum flick on top of that;
// both are gone here. A region's level moves its strand and nothing else, so
// what the eye sees is one slow quantity per strand rather than a carrier
// with a beat riding on it.
//
// The beat is still measured, and still allowed to matter - but only through
// PRESSURE, a ~4 s average of the pulse (M1.z). That scales the braid as a
// whole in the main pass, so a drum-heavy passage opens the weave and a
// drumless one closes it, over seconds rather than per hit. Evolution, not
// vibration.
// ===========================================================================

float aTap(float x){ return texture(iChannel0, vec2(x, .25)).r; }

// mean of four taps spread across one region
float band(float lo, float hi){
    return .25*( aTap(mix(lo, hi, .125)) + aTap(mix(lo, hi, .375))
               + aTap(mix(lo, hi, .625)) + aTap(mix(lo, hi, .875)) );
}

void mainImage(out vec4 C, in vec2 U)
{
    vec4 sA  = texture(iChannel1, vec2( 1./22., .5));
    vec4 sB  = texture(iChannel1, vec2( 3./22., .5));
    vec4 sD  = texture(iChannel1, vec2( 5./22., .5));
    vec4 sF0 = texture(iChannel1, vec2( 7./22., .5));
    vec4 sF1 = texture(iChannel1, vec2( 9./22., .5));
    vec4 sM0 = texture(iChannel1, vec2(11./22., .5));
    vec4 sM1 = texture(iChannel1, vec2(13./22., .5));
    vec4 sG0 = texture(iChannel1, vec2(15./22., .5));
    vec4 sG1 = texture(iChannel1, vec2(17./22., .5));
    vec4 sP0 = texture(iChannel1, vec2(19./22., .5));
    vec4 sP1 = texture(iChannel1, vec2(21./22., .5));

    float dt = clamp(iTimeDelta, 0., .05);

    // full-band fill: unchanged from Wave_01, still the flow rate and the
    // flame's fuel
    float E = 0.;
    for (int i = 0; i < 12; i++)
        E += aTap(.02 + float(i)*.08);
    E /= 12.;
    E = 1. - exp(-2.5*E);          // soft compression, never pins at 1
    float Es = mix(sB.b, E, .05);

    // THE SIX REGIONS. Centres 55/140/360/900/2300/5800 Hz, half-width
    // +-0.675 octave, so they tile the spectrum edge to edge with no overlap.
    // x = frequency / 11025 (the texture is the first 512 of 1024 bins of a
    // 2048-point FFT, LINEAR). Overlap was swept from gaps to +-1.58 octave
    // on the Mix family and changed nothing beyond the error bars, so the
    // simplest covering is kept. To move a strand's territory: x = Hz/11025.
    float b0 = band(.0031, .0080);   //   34 -   88 Hz
    float b1 = band(.0080, .0203);   //   88 -  224 Hz
    float b2 = band(.0204, .0521);   //  225 -  575 Hz
    float b3 = band(.0511, .1304);   //  564 - 1437 Hz
    float b4 = band(.1306, .3332);   // 1440 - 3673 Hz
    float b5 = band(.3294, .8401);   // 3632 - 9263 Hz

    // --- percussion: onset detection, not level -----------------------------
    // A drum is a sudden RISE, so the level says nothing (a steady bass line
    // sits as high as a kick). Two bands, because a kit lives in two places:
    // 44-121 Hz for the kick, 3.9-9.4 kHz for snare/hats. Reference at
    // ~0.25 s, small threshold, instant attack, ~0.13 s decay. Measured
    // constants: above .25 about a fifth of the time, ~180 hits/min.
    float kb = .25*( aTap(.0045) + aTap(.0065) + aTap(.0085) + aTap(.0105) );
    float hb = .25*( aTap(.38) + aTap(.50) + aTap(.65) + aTap(.80) );
    float kr = mix(sD.y, kb, clamp(dt/.25, 0., 1.));
    float hr = mix(sD.w, hb, clamp(dt/.25, 0., 1.));
    float dec = exp(-dt/.13);
    float kp = max(clamp((kb - kr - .015)*5., 0., 1.), sD.x*dec);
    float hp = max(clamp((hb - hr - .015)*5., 0., 1.), sD.z*dec);
    float pulseNow = clamp((kp + .55*hp) * 2.2, 0., 1.);

    // fast envelope per region: quick attack, slower release. This is only the
    // input to the smoothing below - it is never seen directly.
    vec4 f0 = vec4(b0, b1, b2, b3), f1 = vec4(b4, b5, pulseNow, 1.);
    vec4 aF0 = mix(sF0, f0, mix(vec4(.12), vec4(.45), step(sF0, f0)));
    vec4 aF1 = mix(sF1, f1, mix(vec4(.12), vec4(.45), step(sF1, f1)));

    // slow mean per region (~4 s): what each strand is judged against. This is
    // the AGC that lets a treble strand on a string quartet move as much as a
    // bass strand on techno - each region sits near its own average whatever
    // its absolute level, and the dB-mapped texture makes absolute levels
    // useless anyway (a level sits near the top and spans about one percent).
    //
    // SEEDED on the first frame: an all-zero state means the buffer was never
    // written, and starting the means at 0 reads every region as far above
    // average, pinning the whole braid open for the first seconds.
    float sm = clamp(dt/4., 0., 1.);
    bool  seed = dot(sM0, vec4(1.)) + dot(sM1, vec4(1.)) < 1e-4;
    vec4 aM0 = seed ? f0 : mix(sM0, f0, sm);
    vec4 aM1 = seed ? f1 : mix(sM1, f1, sm);
    // M1.z carries the same 4 s average applied to the pulse: drum PRESSURE,
    // i.e. how present the kit is in this passage rather than a single hit.

    // THE DRIVE - deviation, expanded, then smoothed, in that order.
    //  1. EXPAND. The raw deviation only ever used about a fifth of the
    //     available range (it sat between .5 and .7). smoothstep(.30,.85)
    //     maps the part actually used onto the full 0..1, nearly doubling the
    //     visible motion without touching the signal's shape.
    //  2. SMOOTH, and here Wave_02 parts company with the Mix: instead of the
    //     Mix's symmetric ~0.11 s one-pole, this is Wave_01's asymmetric pair
    //     - swells in ~0.2 s, settles in ~0.5 s. Slower in both directions,
    //     and slower still on the way down, which is what turns a reacting
    //     strand into a breathing one. Expansion multiplies frame-to-frame
    //     noise along with the signal, so the smoothing is not optional.
    vec4 rawD0 = clamp((aF0 - aM0)*2.6 + .38, 0., 1.);
    vec4 rawD1 = clamp((aF1 - aM1)*2.6 + .38, 0., 1.);
    vec4 eD0 = smoothstep(vec4(.30), vec4(.85), rawD0);
    vec4 eD1 = smoothstep(vec4(.30), vec4(.85), rawD1);
    vec4 aG0 = mix(sG0, eD0, mix(vec4(.035), vec4(.08), step(sG0, eD0)));
    vec4 aG1 = mix(sG1, eD1, mix(vec4(.035), vec4(.08), step(sG1, eD1)));

    // flow rate: exactly Wave_01's, still set by the music
    float r = (.35 + 5.0*Es) * dt * 3.;
    const float TAU = 6.2831853;

    // THE BRAID'S TRAVEL, on the same music-driven clock as the wave. Wave_01
    // read iTime directly (sin(iTime*speed + ...)), a free-running drift no
    // sound could touch. Each strand now carries an accumulated phase advanced
    // by its own speed times this coefficient.
    //
    // Wave_03: .109, a THIRD of Wave_02's .326. Wave_02 held the median pace
    // at exactly Wave_01's 1.0-2.0 rad/s, which measured 0.25-0.40 screen
    // units per second - a crossing every 9 to 14 s, or 3.3-5.2 deg/s at a
    // normal viewing distance. Divided by three that becomes 0.084-0.134
    // units/s, a crossing every 27 to 43 s and 1.1-1.7 deg/s.
    //
    // Worth knowing: the slowest strand is now close to the point where drift
    // stops reading as movement at all (~1 deg/s). If it looks static rather
    // than calm, this is why - and the shape breathing, which is untouched,
    // is then carrying the whole effect on its own.
    //
    // Six separate phases rather than one shared clock scaled six ways: this
    // buffer is RGBA16F, a shared clock would have to be wrapped, and a wrap
    // shifts each strand by a different non-2pi amount.
    float rb = .109 * r;
    vec4 P0 = vec4( mod(sP0.x + 1.0*rb, TAU),
                    mod(sP0.y + 1.2*rb, TAU),
                    mod(sP0.z + 1.4*rb, TAU),
                    mod(sP0.w + 1.6*rb, TAU) );
    vec4 P1 = vec4( mod(sP1.x + 1.8*rb, TAU),
                    mod(sP1.y + 2.0*rb, TAU), 0., 1. );

    vec4 A = vec4( mod(sA.x + 1.2*r, TAU),
                   mod(sA.y + .23*r, TAU),
                   mod(sA.z + .11*r, TAU),
                   mod(sA.w + .07*r, TAU) );
    vec4 B = vec4( mod(sB.x + .7*r, TAU),
                   mod(sB.y + .5*r, TAU),
                   Es, E );
    vec4 D = vec4(kp, kr, hp, hr);

    float fx = U.x / iResolution.x * 11.;
    C = (fx < 1.) ? A : (fx < 2.) ? B : (fx < 3.) ? D
      : (fx < 4.) ? aF0 : (fx < 5.) ? aF1 : (fx < 6.) ? aM0
      : (fx < 7.) ? aM1 : (fx < 8.) ? aG0 : (fx < 9.) ? aG1
      : (fx < 10.) ? P0 : P1;
}
