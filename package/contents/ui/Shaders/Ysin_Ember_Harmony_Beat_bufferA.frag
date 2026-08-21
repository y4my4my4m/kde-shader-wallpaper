// Audio integrator for Ysin_Ember_Harmony_Beat: six band drives for the braid,
// a percussion onset detector, a SUB-BASS onset detector that drives the
// flame's height, and the phases the wave flows on.
//
// Shadertoy port (Buffer A tab there): https://www.shadertoy.com/view/7cdXWB
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
//   low-bass detector      Column 9, the only thing _06 adds. Taps sit on
//     (.0032 .0045          FFT bins 1..3 (35-78 Hz) - the kick's
//      .0058 .0071)         fundamental and the sub under it, with the
//                          200 Hz region the ordinary kick detector uses
//                          deliberately left out. Never tap below u=.0030:
//                          a LINEAR fetch there mixes in texel 0, the DC
//                          bin.
//   ref .25 / scale 3.     Reference the hit is measured against, and the
//                          time constant of its own deviation SCALE. The
//                          scale is what makes the flame behave the same at
//                          any playback volume - see the block itself.
//   knee .40 / span 1.5    How many of its own deviations count as a hit,
//                          and how many saturate it. Lower knee = more
//                          hits; lower span = harder hits.
//   decay .18              How long the flame stays up after a hit. This is
//                          the flame's fall time and the most visible knob
//                          of the four.
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
    // FOURTEEN columns now, not nine: the layout grew with the sub-bass
    // state, its deepness, the six braid phases and the beat tracker, so
    // every tap here and in the main pass reads (2i+1)/28.
    vec4 sA = texture(iChannel1, vec2(1./28., .5));
    vec4 sB = texture(iChannel1, vec2(3./28., .5));
    vec4 sF0 = texture(iChannel1, vec2(5./28., .5));
    vec4 sF1 = texture(iChannel1, vec2(7./28., .5));
    vec4 sM0 = texture(iChannel1, vec2(9./28., .5));
    vec4 sM1 = texture(iChannel1, vec2(11./28., .5));
    vec4 sP  = texture(iChannel1, vec2(13./28., .5));   // percussion state
    vec4 sD0 = texture(iChannel1, vec2(15./28., .5));   // smoothed drives 0..3
    vec4 sD1 = texture(iChannel1, vec2(17./28., .5));   // smoothed drives 4,5
    vec4 sQ  = texture(iChannel1, vec2(19./28., .5));   // low-bass state (_06)
    vec4 sR  = texture(iChannel1, vec2(21./28., .5));   // latched deepness (_06)
    vec4 sS0 = texture(iChannel1, vec2(23./28., .5));   // braid phases 0..3 (_08)
    vec4 sS1 = texture(iChannel1, vec2(25./28., .5));   // braid phases 4,5  (_08)
    vec4 sT  = texture(iChannel1, vec2(27./28., .5));

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
    float poison = dot((sA + sB + sF0 + sF1 + sM0 + sM1 + sP + sD0 + sD1 + sQ + sR + sS0 + sS1 + sT), vec4(1.));
    // legit state sums to at most a few hundred (phases wrap at 2pi), so
    // 1e5 catches a runaway that is still technically finite
    if (isnan(poison) || isinf(poison) || abs(poison) > 1e5) {
        sA = vec4(0.);
        sB = vec4(0.);
        sF0 = vec4(0.);
        sF1 = vec4(0.);
        sM0 = vec4(0.);
        sM1 = vec4(0.);
        sP = vec4(0.);
        sD0 = vec4(0.);
        sD1 = vec4(0.);
        sQ = vec4(0.);
        sR = vec4(0.);
        sS0 = vec4(0.);
        sS1 = vec4(0.);
        sT = vec4(0.);
    }
   // beat tracker (_10)

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

    // --- LOW BASS ALONE: what _06 exists for -------------------------------
    // The flame's height follows this and nothing else. It is a separate
    // detector rather than a slice of the kick pulse above, for two reasons
    // measured on a real track:
    //
    //  1. FREQUENCY. The kick detector spans 50-116 Hz, which is also where
    //     bass guitar, low toms and the left hand of a piano live. These four
    //     taps land on FFT bins 1..3 - 35 to 78 Hz - so what moves the flame
    //     is the thump itself, not the note that follows it.
    //
    //  2. SCALE. The kick detector compares against a FIXED threshold
    //     (.015) with a FIXED gain (5). On loud, compressed material the low
    //     band sits at .87-.99 of the dB window (measured: 5th percentile
    //     .871, median .950), so the deviations left to detect are a few
    //     hundredths and that detector fires about twice a minute - the flame
    //     would simply never move. Turning the gain up instead breaks the
    //     quiet case: at -24 dB the same band spreads over .56-.82 and a fixed
    //     gain of 22 pins the pulse at 1.0 two thirds of the time.
    //
    //     So the hit is measured in units of THIS BAND'S OWN movement: lsc is
    //     a ~3 s average of |deviation|, and a rise of .40 lsc starts the
    //     flame while 1.9 lsc saturates it. Measured over a 24 dB range of
    //     playback level, that keeps the flame at 65-95 hits per minute (the
    //     fixed detector: 2 to 106) and never pins it at full height.
    //
    // Seeded like the band means below - an all-zero state means the buffer
    // was never written, and starting the reference at 0 would read as one
    // enormous bass hit for the first quarter second.
    bool  qseed = dot(sQ, vec4(1.)) < 1e-4;
    float lb = .25*( aTap(.0032) + aTap(.0045) + aTap(.0058) + aTap(.0071) );
    float lr = qseed ? lb : mix(sQ.y, lb, clamp(dt/.25, 0., 1.));
    float ldev = lb - lr;
    float lsc = qseed ? .02 : mix(sQ.z, abs(ldev), clamp(dt/3., 0., 1.));
    float lscf = max(lsc, .004);          // floor: keeps silence from ringing
    float lraw = clamp((ldev - .40*lscf) / (1.5*lscf), 0., 1.);
    float lheld = sQ.x*exp(-dt/.18);
    float lbp = max(lraw, lheld);

    // HOW DEEP the hit was, as opposed to how hard. The spectral tilt across
    // the bass region: 25-40 Hz (bins 1-2) against 85-108 Hz (bins 4-5). A
    // kick with real sub weight reads high, a slappy one that lives mostly
    // above 80 Hz reads low.
    //
    // This is worth having only because the two ends move independently -
    // measured on a bass-heavy track they correlate 0.52, and across strong
    // hits the deepness spreads from .07 at the 10th percentile to .94 at the
    // 90th (sd .30). Do NOT try to split the 35-78 Hz band itself into "deep"
    // and "less deep": at 21.5 Hz per bin that is two texels apart and the
    // FFT simply does not resolve it - the tilt against the region ABOVE the
    // band is what carries the information.
    //
    // Latched at the onset and held through the decay, so the flame's gain is
    // fixed for the whole of one flare instead of drifting while it falls.
    // .072 / .106 are the 10th and 90th percentile span of the tilt at hits.
    float dlo = .5*( aTap(.0032) + aTap(.0045) );      //  25- 40 Hz
    float dup = .5*( aTap(.0085) + aTap(.0105) );      //  85-108 Hz
    float deepNow = clamp((dlo - dup + .072) / .106, 0., 1.);
    float deepHeld = (lraw > lheld) ? deepNow : (qseed ? .5 : sR.x);

    // How much bass this passage has at all, over ~4 s. The beat lift in the
    // main pass rides this, so a track with no low end never gets one.
    float bassPresence = qseed ? lbp : mix(sR.y, lbp, clamp(dt/4., 0., 1.));

    // --- _10: BEAT TRACKING ------------------------------------------------
    // Not a comb filter over a spectral-flux history - there is nowhere to
    // keep one here - but an inter-onset-interval tracker, which needs four
    // floats and, measured against a 120.0 BPM track, is good enough:
    // period estimate settled at 0.491 +- 0.015 s (122.2 +- 3.7 BPM) and the
    // phase locked to the real onsets with a circular concentration of 0.86,
    // mean phase .051 - i.e. hits land just after the predicted beat, which is
    // the right side to be on.
    //
    // An EDGE is a rise that clears .35 from below, not merely lraw > lheld:
    // the decay tail re-triggers constantly and would feed the tracker a
    // stream of tiny intervals. 69 edges in 30 s here, against a true 61 beats.
    //
    // Half/double-time tolerance is what keeps it from locking onto the
    // off-beat: an interval near 2x or 0.5x the estimate is folded rather than
    // rejected, so a missed beat or an extra ghost note does not restart the
    // search. Anything outside .28-1.6 s (37-214 BPM) is ignored outright, and
    // an interval that fits nothing moves the estimate at a third of the rate.
    bool edge = (lraw > lheld) && (lraw > .35) && (lheld < .35);
    float tsl = sT.x + dt;                       // time since the last accept
    float per = (sT.y < .05) ? .5 : sT.y;        // period estimate, seeded 0.5
    float bconf = sT.w;
    float bph = fract(sT.z + dt/max(per, .05));  // predicted beat phase
    if (edge) {
        float iv = tsl;
        if (iv > .28 && iv < 1.6) {
            float rel = iv/per;
            bool dbl = abs(rel - 2.) < .30, hlf = abs(rel - .5) < .12;
            bool good = abs(rel - 1.) < .18 || dbl || hlf;
            iv = dbl ? iv*.5 : (hlf ? iv*2. : iv);
            per += (iv - per) * (good ? .18 : .063);
            bconf += ((good ? 1. : 0.) - bconf) * .15;
            // pull the phase to 0 along the shorter arc - a soft reset, so a
            // single stray onset cannot yank the beat off where it belongs
            bph = fract(bph - .55*((bph < .5) ? bph : bph - 1.));
        }
        tsl = 0.;
    }


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

    // _07: HALF THE SPEED, SAME COUPLING. Both coefficients of _06's
    // (.35 + 5.0*Es) are halved, so every property of the flow is preserved
    // exactly and only the pace drops: median rate 3.07 -> 1.53, and the wave
    // crosses the screen in 1.56 s instead of 0.78.
    //
    // The coupling is kept because it was measured and it earns its place. On
    // a real track Es runs .396 to .630 between the 5th and 95th percentile,
    // which is a 1.50x spread in flow rate (CV 13.7%), and the speed departs
    // from its own 2 s average by more than 20% on 15% of frames. That is an
    // ebb and flow the eye can follow, not a constant wearing a variable's
    // clothes - a constant would throw it away for nothing.
    //
    // Worth knowing before retuning: at the median only 11% of the rate comes
    // from the fixed term, so this is close to "speed proportional to
    // loudness", and the silence-to-music jump is 8.8x. If that jump is the
    // objectionable part rather than the pace, raise the floor instead of
    // scaling both - (.55 + 2.1*Es) keeps the same median but cuts the jump to
    // 3.1x, at the cost of shrinking the within-track spread to 1.35x.
    // _09: (.24 + .66*Es), which puts the median rate at 1.797 rad/s. Every
    // period in the scene is derived from that number - see the table in the
    // main file's header. Two decisions are folded into this one line:
    //
    //  1. PACE. At _08's 4.605 the main wave travelled 29.7 deg/s across a 27"
    //     1440p screen at arm's length. That is roughly three times the speed
    //     at which the eye tracks something comfortably, and 11 to 18 times
    //     everything else in the frame - one element racing while the rest
    //     drifted. 1.797 brings it to 11.6 deg/s, inside comfortable pursuit
    //     and within 4-7x of the braid.
    //
    //  2. THE SILENCE JUMP. _08's coefficients were 11% fixed / 89% music, so
    //     starting a track multiplied the flow by 8.8x - a lurch. Here it is
    //     2.5x, while the WITHIN-track spread only falls from 1.50x to 1.31x
    //     (Es runs .396 to .630 between the 5th and 95th percentile). Almost
    //     all of the visible modulation is kept and the lurch is not.
    float r = (.24 + .66*Es) * dt * 3.;
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
    // .219 rather than .18: one full sweep now takes 7.98 bars at the nominal
    // 120 BPM, and with the 0.785 rad step in the main file each strand lags
    // its neighbour by exactly one bar. The rate is unchanged in character -
    // still the slow common modulation that measured 24% less jitter.
    float swp = mod(sD1.z + .219*r, TAU);
    aD1 = vec4(aD1.x, aD1.y, swp, 1.);
    // The three morph phases, rounded onto the bar grid: 8, 16 and 32 bars.
    // .11 was already exactly 16 bars at the new rate and did not move.
    vec4 A = vec4( mod(sA.x + 1.2*r, TAU),
                   mod(sA.y + .219*r, TAU),
                   mod(sA.z + .110*r, TAU),
                   mod(sA.w + .055*r, TAU) );
    vec4 B = vec4( mod(sB.x + .7*r, TAU),
                   mod(sB.y + .5*r, TAU),
                   Es, E );

    // --- _08: THE BRAID ON THE SAME CLOCK AS THE WAVE ----------------------
    // Up to _07 the braid ran off iTime: sin(iTime*speed_i + x*height_i), a
    // free-running drift that no sound could touch. Here each strand gets an
    // accumulated phase instead, advanced every frame by its own speed times
    // the SAME music-driven rate r the main wave uses. Nothing else about the
    // braid changes - same six speeds (1.0 .. 2.0), same direction, same
    // spatial frequencies - so it looks exactly as it did and only the pace
    // now breathes with the track.
    //
    // The coefficient is different from the wave's on purpose. .109 is what
    // makes the median braid speed come out at _07's .5*speed_i: r sits at
    // 4.605 rad/s on ordinary material (Es~.544), and .109*4.605 = .50. So
    // _08 is _07 at the same average pace, with the 1.50x music spread added.
    // Raise .109 for a faster braid, and note it multiplies r, so the spread
    // scales with it.
    //
    // Phases are wrapped to 2pi like every other phase here: this is an
    // RGBA16F buffer and a growing time value loses resolution past ~6. One
    // shared clock would have been cheaper but cannot be wrapped - the six
    // strands multiply it by different speeds, and a wrap would then jump
    // each of them by a different, non-2pi amount.
    // .298, not _08's .109: the braid keeps the pace it had (1.74-2.78 deg/s
    // against 1.63-2.61) even though r itself dropped 2.6x. This was the point
    // of retuning rather than scaling - the wave was the outlier, the braid was
    // already where it belonged, and only the ratio between them changes.
    float rb = .298 * r;
    vec4 S0 = vec4( mod(sS0.x + 1.0*rb, TAU),
                    mod(sS0.y + 1.2*rb, TAU),
                    mod(sS0.z + 1.4*rb, TAU),
                    mod(sS0.w + 1.6*rb, TAU) );
    // z: the FLAME SWEEP's phase, moved onto the music clock in _09. It used
    // to be mod(.55*iTime, 4.4) in the main pass - a sawtooth off a free
    // clock, and the last travelling element that ignored the track. .439*r
    // makes one pass take 3.98 bars.
    vec4 S1 = vec4( mod(sS1.x + 1.8*rb, TAU),
                    mod(sS1.y + 2.0*rb, TAU),
                    mod(sS1.z + .439*r, TAU), 1. );

    vec4 P = vec4(kp, kr, hp, hr);
    // w = 1. is the "this buffer has been written" marker the seed test above
    // relies on; do not zero it.
    vec4 Q = vec4(lbp, lr, lsc, 1.);
    // --- IS THERE ANY LIVE AUDIO AT ALL? -----------------------------------
    // Deliberately NOT "is it quiet". A suspended sink or a disconnected
    // stream leaves the capture ring holding its last samples, and the FFT
    // then returns the same non-zero spectrum forever - so a test on the
    // LEVEL would call a frozen stream "loud music". What actually separates
    // the two is that a dead input stops CHANGING, and that one test covers
    // all three cases: digital silence, a frozen ring, and no stream at all.
    //
    // sB.w is the previous frame's raw E, which is already stored - so the
    // whole detector costs one subtraction and two floats of state.
    //
    // Thresholds from measurement: on real music the 1.5 s mean of |dE| ran
    // .0048 to .0143 between the 1st and 95th percentile, and its lowest
    // value anywhere in a 30 s track was .0021. The ramp sits at .0012 down
    // to .0002 - below the quietest music observed by a factor of 1.8, and
    // above a genuinely dead input (exactly 0) by any margin you like.
    //
    // TWO criteria, ORed, and the first one is deliberately NOT a new
    // threshold:
    //
    //   quiet    the inverse of the gate the whole shader already uses to
    //            decide the music has stopped - smoothstep(.03, .12, Es).
    //            Reusing it means idle can never disagree with the braid about
    //            whether there is audio, and it inherits tuning that has been
    //            in service since the first audio version. This is the case
    //            that fires when a player stops: the stream goes to digital
    //            zero (verified with parec on the sink monitor - peak 0 over
    //            12 s), Es follows it down and the gate shuts.
    //
    //   frozen   the |dE| test above. A suspended sink or a disconnected
    //            stream leaves the capture ring holding its last samples, so
    //            the FFT returns the same non-zero spectrum forever - the
    //            level stays wherever the music left it and only the fact
    //            that it has stopped MOVING gives it away. Band .0004-.0018,
    //            against a measured 1.5 s mean of |dE| of .0048-.0143 for
    //            music (1st to 95th percentile, lowest point anywhere .0021).
    //
    // Asymmetric in time: ~3 s of stillness before the idle animation is fully
    // up, ~0.4 s to drop it when sound returns. Waking should be immediate;
    // falling asleep should not happen between tracks.
    float chg  = abs(E - sB.w);
    float live = mix(sR.w, chg, clamp(dt/1.5, 0., 1.));
    // The frozen band is RELATIVE to how much this input has been moving
    // lately, not absolute, because the absolute value could not be pinned
    // down: with nothing playing the effect settled at about a third of full
    // idle, and the only way to read the state back (rendering it out and
    // screenshotting) turned out not to capture the wallpaper surface at all -
    // a calibration frame writing 0.5/0.25/0.75 read back as 0.137/0.149/0.153.
    // So the detector was made scale-free instead of tuned to a number that
    // could not be verified.
    //
    // lmax tracks the largest recent |dE| with a 45 s decay and a floor, and a
    // tenth of that is "not moving". Music runs an order of magnitude above
    // its own floor; silence and a frozen ring both fall far below it, whatever
    // the absolute levels happen to be on a given host.
    float lmax = max(max(live, sS1.w*exp(-dt/45.)), .006);
    float quiet  = 1. - smoothstep(.03, .12, Es);
    float frozen = 1. - smoothstep(.10*lmax, .30*lmax, live);
    float silent = max(quiet, frozen);
    S1.w = lmax;                 // S1 is assembled above; w carries lmax
    float idle = mix(sR.z, silent, clamp(dt/((silent > .5) ? 3.0 : 0.4), 0., 1.));

    vec4 Rq = vec4(deepHeld, bassPresence, idle, live);
    vec4 T  = vec4(tsl, per, bph, bconf);
    float fx = U.x / iResolution.x * 14.;
    C = (fx < 1.) ? A : (fx < 2.) ? B : (fx < 3.) ? aF0
      : (fx < 4.) ? aF1 : (fx < 5.) ? aM0 : (fx < 6.) ? aM1
      : (fx < 7.) ? P : (fx < 8.) ? aD0 : (fx < 9.) ? aD1
      : (fx < 10.) ? Q : (fx < 11.) ? Rq : (fx < 12.) ? S0
      : (fx < 13.) ? S1 : T;
}
