// Ysin_Ember_Big_Beat - _08 with every rate recomputed instead of guessed.
// Same shapes, same audio work, same braid on the music; what changed is the
// set of numbers that decide how fast things move and how they line up.
//
// Shadertoy port: https://www.shadertoy.com/view/sftSDB
//
// Two yardsticks were used, because "smooth" and "choreographed" are not the
// same question.
//
// FLUIDITY - angular velocity. Converting screen units to degrees for a 27"
// 1440p panel at arm's length (46 deg of horizontal field, 13.0 deg per p.x
// unit) turned the guesswork into arithmetic. _08 read like this:
//
//     wave fundamental   29.7 deg/s     braid strands   1.6-2.6 deg/s
//     wave 2nd harmonic   8.7           braid shiver    9.1
//     wave 3rd harmonic   4.1           flame sweep     7.1
//
// One element was racing at three times comfortable pursuit speed and 11-18x
// everything around it. That is the whole of what made the scene feel busy.
// _09 brings the wave to 11.6 deg/s and leaves the braid where it already was
// (1.7-2.8), so the spread across the frame is 4-7x instead of 11-18x.
//
// CHOREOGRAPHY - a common grid. The measured tempo of the material this was
// tuned on is 120.0 BPM (onset autocorrelation, r=0.69, peak at exactly
// 0.500 s), so one bar is 2 s. Every period in the scene is now a power of
// two of that bar at median loudness:
//
//     wave crossing        2 bars      attention sweep     8 bars
//     morph phase 1        8 bars      attention lag       1 bar per strand
//     morph phase 2       16 bars      flame sweep         4 bars
//     morph phase 3       32 bars      drum ripple         1/2 bar
//
// Nothing tracks the beat - the flow follows loudness, not tempo - so this is
// a NOMINAL lock, exact near 120 BPM and drifting either side of it. It still
// does the work: the ratios between elements are simple, which is what reads
// as deliberate rather than accidental. Real beat tracking would mean
// estimating the period from the onset detector in the buffer; that is a
// bigger change and is not attempted here.
//
// The last free-running traveller, the flame's sweep, moved onto the music
// clock as well. Only the frame rotation (.03*t, one meander per ~105 bars)
// and the braid's shiver are still on iTime, both on purpose.
//
// The two things that travel across the screen turn out to be driven by two
// unrelated mechanisms, and they were never the same speed:
//
//   the MAIN WAVE flows on phases accumulated in the buffer at a rate the
//   music set - 3.07 rad per unit of r on ordinary material, which worked out
//   at 4.57 screen units per second, or one crossing every 0.78 s;
//   the BRAID runs straight off iTime at a fixed rate, 1..2 rad/s against a
//   spatial frequency of 4..5, i.e. 0.25-0.40 units/s - one crossing every
//   9-14 s. Nothing about it ever depended on the audio.
//
// So the wave was travelling 11 to 18 times faster than the braid it sits in,
// and only one of the two answered the music. _07 halves both: wave 2.28
// units/s at the median (1.56 s per crossing), braid 0.125-0.20 (18-28 s).
// The ratio between them is unchanged - halving both preserves it - so the
// braid still drifts far more slowly than the wave; it is the absolute pace
// that drops.
//
// The wave's music coupling is KEPT, halved rather than removed. It was
// measured first: on a real track it gives a 1.50x spread in flow rate, and
// the speed departs from its own 2 s average by more than 20% on 15% of
// frames - a visible ebb and flow, so replacing it with a constant would have
// cost something for nothing. The buffer's header carries the numbers and the
// alternative tuning if the silence-to-music jump (8.8x) is the part that
// grates rather than the pace.
//
// The braid's TREMBLE keeps its original frequency on purpose: it is a shiver,
// not a drift, and halving it as well made the strands look sluggish rather
// than calm. Same for the flame's sweep (.55*t) and the frame rotation
// (.03*t), both untouched.
//
// Otherwise identical to _06: the flame bound to the low bass. Everything else is the Mix as it stands: six strands over six
// bands, the braid breathing with the mix, the main wave answering the drums.
// The paired Ysin_Ember_Big_Beat_bufferA.frag holds the bands, their AGC
// and all the per-frame state; the engine finds it BY NAME, so a copy must
// rename both.
//
// What _06 changes, and only this:
//   * the buffer grows a tenth column carrying a detector for 35-78 Hz alone
//     - the kick's fundamental and the sub under it, with the 100-200 Hz
//     region (bass guitar, low toms) deliberately left out;
//   * the flame's HEIGHT is that detector and nothing else. It rests at .55
//     of the Mix's height and reaches 2.25 on an ordinary hit - 3.15 on a
//     deep one, because the gain is weighted by the spectral tilt across the
//     bass region (see 'deepness' in the buffer). A bass note does not
//     brighten the fire, it grows it. Between hits the flame is not merely
//     smaller: the turbulence bite in 'fire' is divided by the height, so a
//     low flame also breaks into embers, and a hit fuses it into one tongue.
//   * brightness stays on the full-kit pulse on purpose - snare and hats
//     still tick, they just no longer lift the fire.
// Every constant behind that detector was measured; the arithmetic is in the
// buffer's header, the visible half in the TUNING block below.
//
// TRIED AND REJECTED: the two drivers swapped, i.e. the main line's tremble on
// the bass and the flame on the whole kit. Two things came out of it, both
// worth not repeating:
//   * the kit pulse is far more material-dependent than this detector. On a
//     loud, compressed track with a soft kick it fired 3.9 times a minute
//     against the bass detector's 37.5, which left the flame frozen near its
//     resting height; on a bass-heavy track it was fine (103/min). The bass
//     detector normalises against its own deviation and has no such swing.
//   * a driver tuned for the FLAME does not transfer to the tremble. With
//     knee .40 and a .18 s decay the detector is below .05 on only 4% of
//     frames - continuous, which is what the flame's height wants and exactly
//     what a per-hit ripple must not have: the line turned into a permanently
//     open sine. Sharpening it (knee .70, decay .09) fixed the line and would
//     have made the flame twitch instead of breathe.
//
// ===========================================================================
// TUNING - what to turn, and what it does. Everything here is safe to nudge;
// the numbers in the main-wave block below are not (that half is shared with
// Ysin_Ember and kept identical on purpose).
//
//   braid speed           Lives in the buffer now (the .109 next to 'rb'):
//                         the braid and the wave share one music-driven rate
//                         and differ only by their coefficients. .109 holds
//                         the median at _07's pace; raise it for a faster
//                         braid, and expect the music spread to scale with it
//                         since it multiplies r.
//
//   braidMax = .82        Ceiling on how far a strand leaves the axis. The
//                         screen is uv.y in [-1,1] and the main wave stops at
//                         .82, so .9 is the practical maximum - past that the
//                         braid clips through the top and bottom edges. The
//                         tanh below only bends the peak, so raising this
//                         mostly buys headroom, not visible size.
//
//   swing  (.18 + .75*band)
//                         .18 = how much a strand moves when ITS band is
//                         quiet (raise for a livelier braid overall, lower
//                         for stillness between hits); .75 = how much its own
//                         band adds (raise for more contrast BETWEEN strands,
//                         which is the whole point of this variant).
//
//   tremble = .30*band    The fast shiver - what used to be the vocal-driven
//                         wobble, now per band. Raise for nervier strands.
//   tremble rate (2.5*speed + 1.75)  and  (1.9*height)
//                         How fast the shiver runs in time and along x. This
//                         is the one rate still read off iTime rather than
//                         the music clock, deliberately: it is texture, not
//                         choreography.
//
//   flame height (.55 + 1.7*bass)
//                         _06's knob. .55 = the flame's height with no bass
//                         at all (0 would put it out between notes; below
//                         ~.35 the ember stage stops reading as fire), 1.7 =
//                         how far a hit stretches it. Measured on a loud
//                         track the multiplier sits at .71 half the time and
//                         passes 1.5 on 8% of frames; on the same track 24 dB
//                         quieter, .95 and 20%. Raise 1.7 for a taller
//                         column, raise .55 for a steadier one - they trade
//                         against each other and their sum is the peak.
//                         The four knobs that decide WHEN it fires (band,
//                         reference, knee/span, decay) live in the buffer.
//
//   ampG = .45 + .55*Es   The braid as a body breathing with the mix: .45 is
//                         its size in silence, .55 how much loudness inflates
//                         it. Keep .45+.55 <= 1.0 or peaks live in the tanh.
//
//   strand brightness (.18 + 1.7*b)
//                         .18 = glow of an idle strand, 1.7 = how hard a busy
//                         band lights its own strand. Drop 1.7 if the braid
//                         out-shines the main wave on loud tracks.
//
//   drive  clamp((f-m)*2.6 + .38, 0, 1)
//                         2.6 = sensitivity to a band sitting above its own
//                         average (higher = twitchier, and it clips sooner);
//                         .38 = the baseline every strand keeps while its
//                         band is merely average.
//   gate S(.03, .12, Es)  Where silence ends and the braid wakes up. Raise
//                         the pair to make quiet passages calmer.
//
//   per strand: speed 1.+ti, height 4.+ti, colour vec3(.2+ti*.7, .2+ti*.4, .3)
//                         ti runs 0..1 over the six strands, so these keep the
//                         Discoteq gradient: strand 0 = bass = darkest/slowest.
//                         Swap the colour line to re-map the spectrum look.
// ===========================================================================

// Ysin_Ember_NoAudio - Mist5 + Discoteq companion lines; amplitude morphs the shape, no zoom
// (mist ported from the blue rectangles shadertoy: fbm + ripple + reciprocal
//  coloring; the flow frame rotates and meanders so directions keep changing)

const vec3 bgColor = vec3(.42,.26,.02);
const float noiseIntensity = 2.8;
const float noiseDefinition = .6;
const vec2 glowPos = vec2(-2.,0.);

float random(vec2 co){ return fract(sin(dot(co.xy, vec2(12.9898,78.233)))*43758.5453); }
vec2 gradv(vec2 i){ float a=random(i)*6.2831853; return vec2(cos(a),sin(a)); }
float noise(in vec2 p){
    p *= noiseIntensity;
    vec2 i=floor(p), f=fract(p);
    vec2 u=f*f*f*(f*(f*6.-15.)+10.);
    float a=dot(gradv(i),f),            b=dot(gradv(i+vec2(1,0)),f-vec2(1,0)),
          c=dot(gradv(i+vec2(0,1)),f-vec2(0,1)), e=dot(gradv(i+vec2(1,1)),f-vec2(1,1));
    return .5+.95*mix(mix(a,b,u.x), mix(c,e,u.x), u.y);
}
mat2 rotate2d(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }

// 3D noise from Flame (anatole duprat - XT95/2013, CC BY-NC-SA 3.0)
float fnoise3(vec3 p){
    vec3 i = floor(p);
    vec4 a = dot(i, vec3(1., 57., 21.)) + vec4(0., 57., 21., 78.);
    vec3 f = cos((p-i)*acos(-1.))*(-.5)+.5;
    a = mix(sin(cos(a)*a), sin(cos(1.+a)*(1.+a)), f.x);
    a.xy = mix(a.xz, a.yw, f.y);
    return mix(a.x, a.y, f.z);
}

#define S smoothstep

// One braid strand. 'band' is this strand's own normalised band level and
// 'amp' the whole-mix loudness, so the strand swings wider when its band is
// busy AND the braid as a body breathes with the track. 'band' also feeds a
// second, faster term: that is the tremble the vocals used to drive alone.
// Hard ceiling on how far a strand may travel from the axis. The screen is
// uv.y in [-1,1], so anything past this leaves through the top or bottom;
// the main wave limits itself the same way (.82*tanh) and the braid must not
// out-swing it. tanh only bends the top of the range, so the strands keep
// their differences and only the peaks are held back.
const float braidMax = .82;

// _07's braid knob, RETIRED in _08: the drift is no longer computed from
// iTime here, it arrives as a phase the buffer accumulates. Its replacement is
// the .109 coefficient next to 'rb' in the buffer, which was chosen so the
// median braid speed matches exactly what this .5 produced.

vec4 Line(vec2 uv, float speed, float height, vec3 col, float band, float amp, float ph) {
    float mid = .25 + .75*S(1.6, 0., abs(uv.x));   // widest mid-screen
    // _08: the drift phase arrives from the buffer, where it was advanced at
    // a music-driven rate (see 'rb' there) instead of read off iTime. Same
    // term otherwise - same sign, so the strand travels the way it always did.
    // The tremble below still reads iTime: it is a shiver, not a drift, and
    // it keeps the frequency it has had since _06.
    float swing   = sin(ph + uv.x*height) * (.18 + .75*band) * amp;
    // 2.5/1.75 = _08's 3.1/2.2 scaled by .8. The shiver stays on iTime and
    // stays the fastest thing in the braid - that is what makes it read as
    // texture rather than drift - but at 9.1 deg/s it was also the fastest
    // thing on screen after the wave, which is a lot of attention for a
    // detail. 7.3 deg/s keeps the character and gives the eye somewhere else
    // to look.
    float tremble = .30 * band * sin(iTime*(2.5*speed + 1.75) + uv.x*(1.9*height));
    uv.y += braidMax * tanh(mid * (swing + tremble) / braidMax);
    // junctions: early, gentle blur ramp + strong dissolve = subtle fade-out
    float blur = .008 + .12 * S(.75, 1.78, abs(uv.x));   // floor = anti-aliasing
    float melt = 1. - .75*S(1.15, 1.78, abs(uv.x));
    return vec4(S(blur, 0., abs(uv.y) - .006) * col * .6 * melt, 1.0);
}

// --- audio (iChannel0: 512x2, spectrum row y=.25, waveform row y=.75) ------
float aTap(float x){ return texture(iChannel0, vec2(x, .25)).r; }

void mainImage(out vec4 C, in vec2 U){
    vec2 R=iResolution.xy;
    vec2 uv = U/R*2.-1.; uv.x *= R.x/R.y;
    float t=iTime;

    float treb = (aTap(.45)+aTap(.65))*.5;   // main-wave sparkle, unchanged

    // integrator state from buffer A (six columns; see that file)
    // Thirteen columns since _08 (sub-bass state, deepness, braid phases).
    vec4 sA  = texture(iChannel1, vec2( 1./26., .5));
    vec4 sB  = texture(iChannel1, vec2( 3./26., .5));
    vec4 m1  = texture(iChannel1, vec2(11./26., .5));   // slow means b4,b5
    // The drive is finished in the buffer now (expanded, then smoothed);
    // reading it here keeps the main pass free of per-frame state.
    vec4 sd0 = texture(iChannel1, vec2(15./26., .5));   // drives b0..b3
    vec4 sd1 = texture(iChannel1, vec2(17./26., .5));   // drives b4,b5
    float Es = sB.b;
    // percussion pulses: kick leads, snare/hats add a lighter tick
    vec4 sP = texture(iChannel1, vec2(13./26., .5));
    vec4 sQ = texture(iChannel1, vec2(19./26., .5));   // low-bass onset (_06)
    vec4 sR = texture(iChannel1, vec2(21./26., .5));   // its deepness (_06)
    vec4 sS0 = texture(iChannel1, vec2(23./26., .5));  // braid phases 0..3 (_08)
    vec4 sS1 = texture(iChannel1, vec2(25./26., .5));  // braid phases 4,5  (_08)
    // Expanded before use. The raw envelope was MEASURED on the running
    // desktop (a debug bar whose length was the pulse): it reads ~0.07-0.16
    // between hits and reaches ~0.5 on strong ones. At that scale the first
    // version of the flick below came out ~6 px tall - present in the maths,
    // invisible on the screen. x2.2 puts ordinary hits in the visible range
    // and lets strong ones saturate.
    float pulse = clamp((sP.x + .55*sP.z) * 2.2, 0., 1.);
    // Drum PRESSURE: the same pulse averaged over ~4 s (buffer column 5's
    // spare slot). A single hit flicks the wave; this says whether the
    // passage has drums at all, and scales how far the wave swings.
    float press = clamp(m1.z, 0., 1.);

    // Each strand is judged against ITS OWN running average, not against the
    // other bands: a band sitting above its mean is "busy" whatever its
    // absolute level, which is what makes this work on any material. Silence
    // still stops everything - the gate rides the full-band fill.
    float gate = S(.03, .12, Es);
    // The flame's driver. Gated with the braid so a silent desktop is still,
    // and clamped because the buffer's AGC can overshoot on a first hit after
    // a quiet passage.
    float bass = clamp(sQ.x, 0., 1.) * gate;
    // 0 = the hit sat mostly above 80 Hz, 1 = it had real sub weight under it.
    // Latched at the onset in the buffer, so it holds for the whole flare.
    float deep = clamp(sR.x, 0., 1.);
    float swp = sd1.z;          // attention-wave phase, read BEFORE the gate
    vec4 d0 = sd0 * gate;
    vec4 d1 = sd1 * gate;
    float ampG = .45 + .55*Es;               // the braid as a body breathes

    float angS = .35*sin(.03*t+2.);
    vec3 color = vec3(0.);

    // --- main wave: identical to Ysin_Ember ---------------------------
    vec2 p = rotate2d(angS)*uv;
    float k = 6.28318/2.6;
    float env = S(1.5, .1, abs(p.x));
    // WHERE THE BIG SWINGS COME FROM.
    // Until now: three morph phases out of buffer A (sA.y/z/w), free-running
    // sines. The music only set how FAST they turned (the phase rate carries
    // Es), so the wave went through its whole repertoire - including its
    // widest shapes - whatever the track was doing. That is the "evolves to
    // max on its own" the eye picks up on.
    //
    // Now each harmonic's SIZE is bound to the part of the spectrum it stands
    // for, and the morph phase only decides how that size is spent (including
    // its sign, which is what flips the waveform's character):
    //   a1, the fundamental  <- lows   (22-357 Hz)
    //   a2, second harmonic  <- mids   (141-1437 Hz)
    //   a3, third harmonic   <- highs  (902-9263 Hz)
    // A bass-heavy passage draws one broad arc; a bright, busy one breaks the
    // line into ripples; near-silence leaves a small calm wave, because every
    // drive falls to zero through the gate.
    float lo = .5*(d0.x + d0.y);
    float md = .5*(d0.z + d0.w);
    float hi = .5*(d1.x + d1.y);
    float a1 = (.26 + .34*lo) + .18*sin(sA.y)*(.35 + .65*lo);
    float a2 = .18*sin(sA.z + 2.) * (.30 + .95*md);
    float a3 = .11*sin(sA.w + 4.) * (.25 + 1.05*hi);
    float y = env*( a1*sin(k*p.x - sA.x)
                  + a2*sin(2.*k*p.x + sB.x)
                  + a3*sin(3.*k*p.x - sB.y + 1.) );
    // How far the wave swings follows the drums: a busy passage opens it up,
    // a drumless one keeps it low. .60 is its size with no percussion at all;
    // press is a ~4 s average, so this is a slow opening and closing, not a
    // per-beat jump (that is the *= 1+.20*pulse below).
    y *= .60 + .95*press;
    // The drum flick, in two parts because one alone does not read: a brief
    // WIDENING of the whole wave (that is what the eye catches on a beat) and
    // a fast ripple travelling along it (that is what makes it a drum rather
    // than a swell). Both are applied BEFORE the limiter, so a heavy beat
    // cannot push the crest off screen.
    y *= 1. + .20*pulse;

    // TEST KNOB: a quarter of the original slow swing (halved twice), so the
    // main line runs well inside the braid rather than arcing over it.
    // Applied BEFORE the tremble below, so the drum flick keeps its absolute
    // size and now dominates the line's motion. Set back to 1. to undo.
    y *= .25;
    // NOT multiplied by env, on purpose: env pins the wave to the axis at the
    // edges, so an env-shaped ripple only shivers in the middle third. Left
    // bare, the tremble runs the WHOLE length of the line - at the edges it
    // wobbles around the axis instead of around a crest, which is exactly
    // where the wave is otherwise motionless.
    // 1.9x the original .11. The flame still carries most of the beat, but the
    // wave keeps a visible tremble of its own.
    // .155, chosen by measurement rather than taste. Two criteria met the same
    // number: it is the midpoint of the .103/.206 pair that bracketed it, and
    // it is the largest tremble whose 95th-percentile crest (.236) still sits
    // at or below the braid's MIDDLE strand (.239 median, measured frame by
    // frame on a real track). So the wave's strongest beats reach into the
    // braid's body without ever rising through it - at no value up to .206
    // does the line actually cross the braid, because the x.25 scale keeps it
    // low; if the line should be more present, that scale is the knob, not
    // this one.
    // 6.283 rather than 7.0: exactly 1 Hz, i.e. one cycle per half-bar at the
    // nominal tempo, so the drum ripple lands on the grid like everything
    // else. A 10% change, made only because it was free.
    y += .155 * pulse * sin(4.5*k*p.x - 6.283*t);
    y = .82*tanh(y/.82);   // taller swing, soft-limited so the crest never leaves the screen
    // the flame packet's geometry is needed BEFORE the core is drawn: the core
    // colour depends on whether the fire is passing over it
    float dy = p.y - y;                              // height above the curve
    // Sweep position from the buffer's phase instead of from iTime, so the
    // flame's travel follows the music with everything else. The phase is
    // wrapped to 2pi, and mapping it onto the 4.4-wide track reproduces the
    // old sawtooth exactly - same path, same direction, musical pace.
    float xc = -2.2 + 4.4 * sS1.z / 6.2831853;       // sweep position
    float sweep = exp(-pow((p.x - xc)*1.1, 2.));

    float d = abs(p.y - y);
    float w = (.75+.35*sin(.35*t - 2.)) * (.85+.40*sin(k*.8*p.x + .9*t));
    w = clamp(w, .25, 1.5);
    float wd = d/w;
    // Under the flame the core takes the FIRE's colour instead of going white.
    // The reciprocal term peaks well above 1, so core + root + bridge used to
    // clip every channel at once - and three saturated channels are white by
    // definition, however warm each of them was on its own.
    vec3 coreCol = mix(vec3(.55,.42,.10), vec3(.95,.34,.04), .8*sweep);
    color += coreCol*(.007*(1.+.9*treb+.6*pulse)/(wd+.006));  // core; treble sparkle + beat
    color += vec3(.42,.28,.04)*.005/(wd*wd*20.+.030); // halo, dim

    // flitting flame packet racing along the wave (Flame noise + palette)
    float turb = fnoise3(vec3(p.x*2.5, dy*3. - 2.2*t, .6*t));
    // The flame is what answers the drums now: its height still follows the
    // smoothed band fill (the slow part), and the pulse doubles it on a hit -
    // so where the wave used to shake, the fire shoots instead.
    // HEIGHT FROM THE LOW BASS - the one line _06 is about. The Mix had
    // (1. + 1.0*pulse) here: full height at rest, doubled by any drum. Now the
    // rest height is .55 and only a 35-78 Hz hit lifts it, up to 2.25. Same
    // sweep and same fill term, so where the flame travels and how much fuel
    // the mix gives it are unchanged; what it does when the bass lands is not.
    // The gain itself follows HOW DEEP the hit was: 1.7 for one that lives
    // above 80 Hz, 2.6 for one with real sub under it. Measured on a
    // bass-heavy track that puts the flame's visible tip at .44 of the screen
    // half the time and 1.12 at the 99th percentile - so the deepest hits do
    // lick past the top edge, on about 3% of frames, which is the point of
    // letting depth buy height. Drop .9 to 0 for a flat response.
    float fh = (.30*sweep + .04)*(.35 + 2.8*Es)*(.55 + (1.7 + .9*deep)*bass);
    float fire = clamp((fh - dy - .12*turb)/fh, 0., 1.);
    // The base is the WEAKEST part, but not empty: fading it to zero left a
    // black band between the line and the flame body. The ramp therefore runs
    // down to a FLOOR (.22) rather than to nothing, so the gap carries a dim
    // ember veil - the wave core and the braid still show through it, which is
    // what makes the fire read as translucent instead of painted on.
    float baseRamp = smoothstep(-.01, .14, dy);
    fire *= mix(.22, 1., baseRamp) * smoothstep(0., .15, sweep);
    fire *= fire;
    // amber rather than yellow: green pulled down relative to red, and the
    // whole body dimmed - intensity was what made it look like paint. Down at
    // the base the colour also loses saturation, so the veil filling the gap
    // reads as smoke lit from within rather than as a second flame.
    vec3 bodyCol = mix(vec3(.30, .20, .12), vec3(.62, .32, .10), baseRamp);
    color += fire * bodyCol * (1. + .5*pulse);   // flame body, brighter on the beat
    color += fire*fire*fire * vec3(.50, .32, .14);   // hot inner tongue, dimmed

    // The bridge over the dark band between the line and the flame body.
    // Needed as its OWN term because 'fire' is squared above: the .22 floor
    // there comes out as ~.05 on screen, which against black is still black.
    // This one is not squared, so what is written is what is seen. Copper,
    // not yellow - green and blue pulled right down - and it peaks in the gap
    // (around .06 above the curve), fading out by the time the body starts.
    float bridge = sweep * smoothstep(-.03, .04, dy) * smoothstep(.26, .05, dy);
    color += bridge * vec3(.34, .17, .07) * (.85 + .6*pulse);
    // the blue root of the original Flame, kept as a hint only: at .7 it was
    // the main thing turning the line cold-white wherever the fire passed
    color += smoothstep(.025, 0., abs(dy)) * sweep * vec3(.15,.45,1.2)*.16; // blue root

    // --- braid: strand i belongs to band i, dark/low -> bright/high --------
    for (int i = 0; i < 6; i++){
        float ti = float(i)/5.;                      // speeds and colours as before
        float b = (i == 0) ? d0.x : (i == 1) ? d0.y : (i == 2) ? d0.z
                : (i == 3) ? d0.w : (i == 4) ? d1.x : d1.y;
        // The attention wave: the same slow phase reaches each strand a little
        // later, so a change in the music travels along the braid instead of
        // hitting all six at once. This is the "one after another" look, and
        // it is choreography, not data - the bands themselves carry no such
        // ordering (see the buffer's header for the measurements).
        b *= max(0., .72 + .28*sin(swp - float(i)*.785));
        float ph = (i == 0) ? sS0.x : (i == 1) ? sS0.y : (i == 2) ? sS0.z
                 : (i == 3) ? sS0.w : (i == 4) ? sS1.x : sS1.y;
        color += Line(p, 1.+ti, 4.+ti, vec3(.2+ti*.7, .2+ti*.4, .3), b, ampG, ph).rgb
               * (.18 + 1.7*b);
    }

    C = vec4(color, 1.);
}
