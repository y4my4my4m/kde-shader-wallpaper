// Phase integrator for Ysin_Ring_Spectrum. The engine finds this BY NAME
// (<name>_bufferA.frag) - a copy must rename both files of the pair.
//
// Why a buffer at all: the rings' spin follows the music the way the main
// line's flow does in Ysin_Ember - speed scales with LOUDNESS. A stateless
// shader cannot do that: angle = w(t)*t jumps position whenever w changes.
// So the six ring phases are integrated here (ph += w*sp*dt) and the image
// pass only reads them. Base speeds keep the original ladder (.25+.22*i,
// inner slow, outer fast, alternating direction applied in the image), and
// one common loudness factor scales them all, so the rings stay in
// proportion while the whole carousel breathes with the music.
//
// Phases wrap at 2pi: RGBA16F loses precision past ~6e0 over time, and the
// image uses cos(k*(a-ph)) with integer k, for which a 2pi wrap is exact.
//
// It also owns the KICK: an onset envelope (instant attack, ~150 ms decay)
// replaces the image's per-frame product, which flickered because a 30 ms
// hit lands unevenly across frames; and two shockwave phases that RESET on
// the onset edge - fronts genuinely born at the hit, which the stateless
// versions could only fake with an eternal clock behind a level gate.
//
// Layout, six columns (read at y=.5, centers x=(k+.5)/6):
//   0: phases of rings 0-3
//   1: xy = phases of rings 4,5, z = smoothed press,
//      w = master-clock FINE accumulator (see below)
//   2: x = kick envelope, y = previous gate (edge memory),
//      zw = shockwave phases (0 at birth, >1 = done)
//   3: x = spark-field envelope (instant attack, ~1.4 s release),
//      y = treble FLASH (~120 ms decay - every hat pops the field),
//      zw = shockwave birth STRENGTHS (gate value at launch)
//   4: the six ring bands b0-b3  } exported so the image needs NO audio
//   5: b4, b5, punch, mix mean   } channel - one music binding, ever

float band(float x){
    return ( texture(iChannel0, vec2(x*.72, .25)).r
           + texture(iChannel0, vec2(x,     .25)).r
           + texture(iChannel0, vec2(x*1.38,.25)).r ) / 3.;
}
// instantaneous amplitude off the WAVEFORM row - no analyser smoothing,
// so hits arrive as sharp transients (moved here from the image pass:
// per-frame state work, not per-pixel)
float waveAmp(){
    float s=0.;
    for(int i=0;i<8;i++)
        s += abs(texture(iChannel0, vec2((float(i)+.5)/8., .75)).r - .5);
    return s/8.;
}

void mainImage(out vec4 C, in vec2 U){
    vec4 s0 = texture(iChannel1, vec2(.0833,.5));  // phases 0-3
    vec4 s1 = texture(iChannel1, vec2(.25,  .5));  // ph4, ph5, press, fine
    vec4 s2 = texture(iChannel1, vec2(.4167,.5));  // kickEnv, prevGate, shocks
    vec4 s3 = texture(iChannel1, vec2(.5833,.5));  // spark envelopes
    float dt = clamp(iTimeDelta, .001, .1);

    // the six ring bands, computed ONCE here and exported to the image in
    // the last two texels: the buffer is the shader's only audio consumer.
    // (On Shadertoy, binding the same music to two tabs creates two
    // parallel players - and our image pass saves 18 taps per pixel.)
    float b0=band(.0047), b1=band(.0119), b2=band(.0306),
          b3=band(.0765), b4=band(.196),  b5=band(.493);

    // loudness, Ember-style: the mean of the six ring bands, smoothed ~.6 s
    // so the carousel accelerates into a loud passage instead of twitching
    float m = (b0+b1+b2+b3+b4+b5)/6.;
    float loud  = smoothstep(.35,.80,m);
    float press = mix(s1.z, loud, 1.-exp(-dt/.60));

    // self-heal: legit state is six wrapped phases (<2pi each) + press -
    // anything NaN/inf/runaway resets in one tick (family convention)
    float poison = dot(s0,vec4(1.)) + dot(s1,vec4(1.))
                 + dot(s2,vec4(1.)) + dot(s3,vec4(1.));
    if (isnan(poison) || isinf(poison) || abs(poison) > 1e3){
        s0 = vec4(0.); s1 = vec4(0.); s2 = vec4(0.,0.,2.,2.);
        s3 = vec4(0.); press = loud;
    }

    // kick: timing from the raw waveform, validity from the low bands
    // (the image's old formula), then an ONSET EDGE and an envelope -
    // instant attack, exp decay ~.15 s - so every hit carries the same
    // visible weight regardless of how it straddles the frames
    float punch = smoothstep(.06,.22, waveAmp());
    float gate  = punch * smoothstep(.62,.88, max(band(.0047),band(.0119)));
    bool  edge  = (gate > .45) && (s2.y < .45);
    float kickEnv = max(s2.x*exp(-dt/.15), gate);

    // shockwaves: sparser and STRENGTH-AWARE. A front launches only when
    // the younger one has cleared 45% of its flight (max ~1 wave/.8 s even
    // under pounding), and it remembers the gate value at birth - a soft
    // kick makes a faint veil, a hard one a dense fog ring. Phase >1 = done.
    vec2 shp = min(s2.zw + dt*.55, vec2(1.25));
    vec2 sst = s3.zw;
    if (edge && min(shp.x, shp.y) > .45){
        if (shp.x >= shp.y){ shp.x = 0.; sst.x = gate; }
        else               { shp.y = 0.; sst.y = gate; }
    }

    // spark-field hysteresis + treble flash
    float trE = smoothstep(.25,.60,
        (band(.196)+band(.30)+band(.493)+band(.65))*.25 + .08);
    float treEnv   = max(s3.x*exp(-dt/1.4), trE);
    float tGate    = punch * smoothstep(.30,.65, max(band(.196),band(.493)));
    float treFlash = max(s3.y*exp(-dt/.12), tGate);

    // Calmer carousel (ladder .22+.14*i, outer/inner 4.2x, sp .27..~1.5)
    // integrated PRECISION-SAFE. The naive ph += w*sp*dt stalls in half-
    // float state: near 2pi the ULP is ~.004 while a quiet-music step is
    // ~.001, so the addition rounds to nothing and rings froze one by one,
    // thawing whenever louder music raised the step - exactly the observed
    // instability. Split master clock instead: a FINE accumulator stays
    // below 1 (ULP .0002 - every dt registers), and on each whole unit the
    // per-ring phases advance by w_i in one COARSE step (>= .22, two
    // orders above any phase ULP). The image adds w_i*fine at read time,
    // so motion stays smooth; the wrap is exact for integer k.
    // v37: ONE angular speed for all rings - ring 2's (.50), the reference.
    // The speed ladder made the rim race even through calm music, drowning
    // the actual musical signal, which is sp: with a uniform base the only
    // thing that changes the spin IS the music. Directions still alternate
    // (applied in the image), and the arc counts (k=3..8) keep the rings
    // visually distinct in pattern, so uniform w does not read as lockstep.
    float sp = .27 + 1.2*press;
    const float TAU = 6.28318530718;
    vec4 w03 = vec4(.50);
    vec2 w45 = vec2(.50);
    float fine = s1.w + sp*dt;
    if (fine >= 1.){
        fine -= 1.;
        s0    = mod(s0    + w03, TAU);
        s1.xy = mod(s1.xy + w45, TAU);
    }

    float fx = U.x/iResolution.x;
    C = (fx < .1667) ? s0
      : (fx < .3333) ? vec4(s1.xy, press, fine)
      : (fx < .5)    ? vec4(kickEnv, gate, shp)
      : (fx < .6667) ? vec4(treEnv, treFlash, sst)
      : (fx < .8333) ? vec4(b0, b1, b2, b3)
      :                vec4(b4, b5, punch, m);
}
