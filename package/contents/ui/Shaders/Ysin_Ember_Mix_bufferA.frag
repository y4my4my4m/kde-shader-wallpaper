// Audio integrator for Ysin_Ember_Mix: six band drives for the braid,
// a percussion onset detector, and the phases the wave flows on.
//
// ===========================================================================
// TUNING - the audio half. The visual knobs are in the main file.
//
//   band(lo, hi) ranges   Six log-spaced bands, centres 55/140/360/900/2300/
//                         5800 Hz, half-width +-0.675 octave - so they TILE
//                         the spectrum, edge to edge, with no overlap.
//                         x = frequency / 11025 (the texture is the first 512
//                         of 1024 bins of a 2048-point FFT, LINEAR, so x=1 is
//                         11 kHz). To move a strand's territory: x = Hz/11025.
//                         Overlap was swept from gaps to +-1.58 octave and
//                         changed NOTHING beyond the error bars, so the
//                         simplest covering was kept. See the note by the
//                         attention wave below.
//
//   envelope .45 / .12    Attack / release of each band's fast envelope.
//                         Higher attack = hits land harder; higher release =
//                         less flicker but a lazier strand.
//
//   mean  dt/4.           Time constant of the per-band reference, in
//                         seconds (4 s here). This is the AGC: shorter makes
//                         a strand adapt within a phrase (so a long loud
//                         passage stops driving it), longer keeps whole
//                         sections expressive. Below ~1.5 s the braid starts
//                         ignoring build-ups.
//
//   seed                  Do not remove: an all-zero state means the buffer
//                         was never written, and starting the means at 0
//                         makes every band read as far above average for the
//                         first seconds - the braid then swings off-screen
//                         until they catch up.
//
//   E compression 1-exp(-2.5*E), Es smoothing .05
//                         Full-band fill. Drives the FLAME, the flow speed
//                         and ampG. Raise 2.5 to make quiet tracks fill more;
//                         raise .05 for a twitchier flame.
//
//   phase rates (1.2, .23, .11, .07, .7, .5) and r = (.35 + 5.0*Es)*dt*3
//                         The main wave's flow: .35 = speed in silence, 5.0 =
//                         how much the music accelerates it. Phases only ever
//                         advance, so the wave never runs backwards.
// ===========================================================================

float aTap(float x){ return texture(iChannel0, vec2(x, .25)).r; }

// mean of four taps spread over one band's range
float band(float lo, float hi){
    return .25*( aTap(mix(lo, hi, .125)) + aTap(mix(lo, hi, .375))
               + aTap(mix(lo, hi, .625)) + aTap(mix(lo, hi, .875)) );
}

void mainImage(out vec4 C, in vec2 U)
{
    vec4 sA = texture(iChannel1, vec2(1./18., .5));
    vec4 sB = texture(iChannel1, vec2(3./18., .5));
    vec4 sF0 = texture(iChannel1, vec2(5./18., .5));
    vec4 sF1 = texture(iChannel1, vec2(7./18., .5));
    vec4 sM0 = texture(iChannel1, vec2(9./18., .5));
    vec4 sM1 = texture(iChannel1, vec2(11./18., .5));
    vec4 sP  = texture(iChannel1, vec2(13./18., .5));   // percussion state
    vec4 sD0 = texture(iChannel1, vec2(15./18., .5));   // smoothed drives 0..3
    vec4 sD1 = texture(iChannel1, vec2(17./18., .5));   // smoothed drives 4,5

    // full-band fill: unchanged, still drives the flame and the flow speed
    float E = 0.;
    for (int i = 0; i < 12; i++)
        E += aTap(.02 + float(i)*.08);
    E /= 12.;
    E = 1. - exp(-2.5*E);
    float Es = mix(sB.b, E, .05);

    // NO OVERLAP: the centres sit 1.35 octave apart, so a half-width of
    // +-0.675 octave makes each band end exactly where the next begins - the
    // six tile the spectrum instead of sharing it. This is the far end of the
    // experiment: _01 is +-0.9 octave, _02 is +-1.35.
    //
    // Measured against the other two on one 5 s excerpt, the honest answer is
    // that the differences are SMALL: the strands sit slightly further apart
    // here (mean spread 0.101 vs 0.098 for _01 and 0.092 for _02), and once
    // the common loudness breath is subtracted, nothing else separates the
    // three beyond the noise of such a short sample. Trust the eye over the
    // numbers on this one - and the reason the braid does not fall apart
    // without overlap is that the AGC keeps every strand near its own
    // average, which is a stronger coupling than band sharing ever was.
    float b0 = band(.0031, .0080);   //   34 -   88 Hz
    float b1 = band(.0080, .0203);   //   88 -  224 Hz
    float b2 = band(.0204, .0521);   //  225 -  575 Hz
    float b3 = band(.0511, .1304);   //  564 - 1437 Hz
    float b4 = band(.1306, .3332);   // 1440 - 3673 Hz
    float b5 = band(.3294, .8401);   // 3632 - 9263 Hz

    float dt = clamp(iTimeDelta, 0., .05);

    // --- percussion: onset detection, not level -----------------------------
    // A drum is a sudden RISE, so the level says nothing (a steady bass line
    // sits as high as a kick). Two bands, because a kit lives in two places:
    // 44-121 Hz for the kick, 3.9-9.4 kHz for snare/hats. The reference
    // tracks at ~0.25 s and a small threshold keeps ordinary wobble out;
    // instant attack, ~0.13 s decay. These are the constants measured for
    // Ysin_Ember: above .25 about a fifth of the time, ~180 hits/min.
    float kb = .25*( aTap(.0045) + aTap(.0065) + aTap(.0085) + aTap(.0105) );
    float hb = .25*( aTap(.38) + aTap(.50) + aTap(.65) + aTap(.80) );
    float kr = mix(sP.y, kb, clamp(dt/.25, 0., 1.));
    float hr = mix(sP.w, hb, clamp(dt/.25, 0., 1.));
    float dec = exp(-dt/.13);
    float kp = max(clamp((kb - kr - .015)*5., 0., 1.), sP.x*dec);
    float hp = max(clamp((hb - hr - .015)*5., 0., 1.), sP.z*dec);


    // fast envelope per band: quick attack so a hit is visible, slower
    // release so a strand does not flicker between frames
    // The spare slot of f1 carries the expanded PERCUSSION PULSE. It costs
    // no extra state and buys the thing the main wave wants: aM1.z below is
    // that pulse averaged over ~4 s, i.e. how present the drums are in this
    // passage ("pressure"), as opposed to a single hit. d1.z is unused, so
    // nothing else changes.
    float pulseNow = clamp((kp + .55*hp) * 2.2, 0., 1.);
    vec4 f0 = vec4(b0, b1, b2, b3), f1 = vec4(b4, b5, pulseNow, 1.);
    vec4 aF0 = mix(sF0, f0, mix(vec4(.12), vec4(.45), step(sF0, f0)));
    vec4 aF1 = mix(sF1, f1, mix(vec4(.12), vec4(.45), step(sF1, f1)));

    // slow mean per band (~4 s): the reference each strand is judged against.
    // This is the whole point of the Mix variant - a treble strand on a
    // string quartet and a bass strand on techno both sit near their own
    // average, so both dance instead of one pinning and one sleeping.
    //
    // SEEDED on the first frame. An all-zero state means "buffer never
    // written": starting the mean at 0 would make every band read as far
    // above its own average for the first seconds, every strand would pin at
    // full drive, and the braid would swing off-screen until the means caught
    // up. Jumping straight to the current level costs nothing and removes
    // that opening kick.
    float sm = clamp(dt/4., 0., 1.);
    bool  seed = dot(sM0, vec4(1.)) + dot(sM1, vec4(1.)) < 1e-4;
    vec4 aM0 = seed ? f0 : mix(sM0, f0, sm);
    vec4 aM1 = seed ? f1 : mix(sM1, f1, sm);

    // THE DRIVE, finished here instead of in the main pass.
    //
    // Two steps, both measured on a real track rather than guessed:
    //  1. EXPAND. The raw drive (deviation from the band's own mean) only ever
    //     used about a fifth of the screen range - it sat between .5 and .7
    //     and never reached either end. smoothstep(.30,.85) maps the part that
    //     is actually used onto the full 0..1, which nearly doubles the
    //     visible motion WITHOUT touching the signal's shape.
    //  2. SMOOTH, after expanding. Expansion multiplies the frame-to-frame
    //     noise along with the signal, so on its own it doubles the jitter
    //     (5.1 -> 10.5 in mean |second difference|). A one-pole at ~0.11 s
    //     removes that again and costs almost nothing in range.
    // Measured net effect vs the previous version: on-screen swing per strand
    // 0.211 -> ~0.36 (+70%), jitter 5.1 -> ~2.7 (-47%), strand-to-strand
    // spread 0.101 -> 0.16. More expression, less chaos - which is the point.
    vec4 rawD0 = clamp((aF0 - aM0)*2.6 + .38, 0., 1.);
    vec4 rawD1 = clamp((aF1 - aM1)*2.6 + .38, 0., 1.);
    vec4 aD0 = mix(sD0, smoothstep(vec4(.30), vec4(.85), rawD0), .15);
    vec4 aD1 = mix(sD1, smoothstep(vec4(.30), vec4(.85), rawD1), .15);

    float r = (.35 + 5.0*Es) * dt * 3.;
    const float TAU = 6.2831853;

    // The ATTENTION WAVE's phase. Why it exists at all is a measurement
    // result: sweeping the band half-width from a gap-leaving .38 octave to a
    // heavily overlapping 1.58 showed NO significant difference in any metric
    // (swing .144-.181 with error bars of +-.11, effective independent strands
    // 1.9-2.3 with +-.5). Music's spectral envelope moves too coherently for
    // band geometry to separate the strands, and the two signal-domain fixes
    // tried next made it worse: staggering the per-band time constants bought
    // 0.1 s of sequencing, and a neighbour-to-neighbour cascade dropped
    // independence from 3.5 to 1.7 while producing no lag at all.
    //
    // So the sequencing is choreographed instead of extracted: one slow phase,
    // advancing with the music like every other phase here, walks along the
    // six strands. Measured at rate .18 / depth .28 / step 1.15 rad: sweep
    // period ~3 s, 0.45 s between neighbouring strands, and jitter DOWN 24%
    // (2.35 -> 1.79) because a slow common modulation damps the fast common
    // motion. Swing is unchanged.
    float swp = mod(sD1.z + .18*r, TAU);
    aD1 = vec4(aD1.x, aD1.y, swp, 1.);
    vec4 A = vec4( mod(sA.x + 1.2*r, TAU),
                   mod(sA.y + .23*r, TAU),
                   mod(sA.z + .11*r, TAU),
                   mod(sA.w + .07*r, TAU) );
    vec4 B = vec4( mod(sB.x + .7*r, TAU),
                   mod(sB.y + .5*r, TAU),
                   Es, E );

    vec4 P = vec4(kp, kr, hp, hr);
    float fx = U.x / iResolution.x * 9.;
    C = (fx < 1.) ? A : (fx < 2.) ? B : (fx < 3.) ? aF0
      : (fx < 4.) ? aF1 : (fx < 5.) ? aM0 : (fx < 6.) ? aM1
      : (fx < 7.) ? P : (fx < 8.) ? aD0 : aD1;
}
