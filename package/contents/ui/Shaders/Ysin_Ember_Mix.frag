// Ysin_Ember_Mix - the audio-reactive Ysin with the braid spread across
// the spectrum: each of the six strands follows its own frequency band (low
// to high, bass on the darkest strand), the whole braid breathes with the
// mix, and the main wave answers the drums. The paired
// Ysin_Ember_Mix_bufferA.frag holds the bands, their AGC and all the
// per-frame state; the engine finds it BY NAME, so a copy must rename both.
//
// Shadertoy port: https://www.shadertoy.com/view/7ctSDB
//
// Where it differs from Ysin_Ember: that one keeps a single mids-driven
// braid and its original yellow flame; this one splits the braid six ways,
// lets the flame answer the beat as well, and carries the attention wave that
// walks activity along the strands.
//
// ===========================================================================
// TUNING - what to turn, and what it does. Everything here is safe to nudge;
// the numbers in the main-wave block below are not (that half is shared with
// Ysin_Ember and kept identical on purpose).
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
//   tremble rate (3.1*speed + 2.2)  and  (1.9*height)
//                         How fast the shiver runs in time and along x.
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

vec4 Line(vec2 uv, float speed, float height, vec3 col, float band, float amp) {
    float mid = .25 + .75*S(1.6, 0., abs(uv.x));   // widest mid-screen
    float swing   = sin(iTime*speed + uv.x*height) * (.18 + .75*band) * amp;
    float tremble = .30 * band * sin(iTime*(3.1*speed + 2.2) + uv.x*(1.9*height));
    uv.y += braidMax * tanh(mid * (swing + tremble) / braidMax);
    // junctions: early, gentle blur ramp + strong dissolve = subtle fade-out
    float blur = .008 + .12 * S(.75, 1.78, abs(uv.x));   // floor = anti-aliasing
    float melt = 1. - .75*S(1.15, 1.78, abs(uv.x));
    return vec4(S(blur, 0., abs(uv.y) - .006) * col * .6 * melt, 1.0);
}

// --- audio: NONE here - the buffer exports treb (main-wave sparkle, its
// only image-side use) in a spare state component, so on Shadertoy the
// music is bound ONCE, on Buffer A. iChannel1 = Buffer A.

void mainImage(out vec4 C, in vec2 U){
    vec2 R=iResolution.xy;
    vec2 uv = U/R*2.-1.; uv.x *= R.x/R.y;
    float t=iTime;

    float treb = texture(iChannel1, vec2(17./18., .5)).w;   // main-wave sparkle, unchanged

    // integrator state from buffer A (six columns; see that file)
    vec4 sA  = texture(iChannel1, vec2( 1./18., .5));
    vec4 sB  = texture(iChannel1, vec2( 3./18., .5));
    vec4 m1  = texture(iChannel1, vec2(11./18., .5));   // slow means b4,b5
    // The drive is finished in the buffer now (expanded, then smoothed);
    // reading it here keeps the main pass free of per-frame state.
    vec4 sd0 = texture(iChannel1, vec2(15./18., .5));   // drives b0..b3
    vec4 sd1 = texture(iChannel1, vec2(17./18., .5));   // drives b4,b5
    float Es = sB.b;
    // percussion pulses: kick leads, snare/hats add a lighter tick
    vec4 sP = texture(iChannel1, vec2(13./18., .5));
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
    y += .155 * pulse * sin(4.5*k*p.x - 7.0*t);
    y = .82*tanh(y/.82);   // taller swing, soft-limited so the crest never leaves the screen
    // the flame packet's geometry is needed BEFORE the core is drawn: the core
    // colour depends on whether the fire is passing over it
    float dy = p.y - y;                              // height above the curve
    float xc = -2.2 + mod(.55*t, 4.4);               // sweep position
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
    float fh = (.30*sweep + .04)*(.35 + 2.8*Es)*(1. + 1.0*pulse);
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
        b *= max(0., .72 + .28*sin(swp - float(i)*1.15));
        color += Line(p, 1.+ti, 4.+ti, vec3(.2+ti*.7, .2+ti*.4, .3), b, ampG).rgb
               * (.18 + 1.7*b);
    }

    C = vec4(color, 1.);
}
