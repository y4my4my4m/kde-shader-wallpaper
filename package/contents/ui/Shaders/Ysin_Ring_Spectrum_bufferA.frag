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
// Layout (read at y=.5):
//   x<.25       phases of rings 0-3
//   .25<=x<.5   xy = phases of rings 4,5, z = smoothed press, w = 1
//   .5<=x<.75   x = kick envelope, y = previous gate (edge memory),
//               zw = shockwave phases (0 at birth, >1 = done)
//   x>=.75      x = spark-field envelope (instant attack, ~1.4 s release -
//               the field lingers and dies down after the treble stops),
//               y = treble FLASH (raw transient gated by the high bands,
//               ~120 ms decay - every hat pops the whole field),
//               zw = shockwave birth STRENGTHS (gate value at launch)

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
    vec4 s0 = texture(iChannel1, vec2(.125,.5));   // phases 0-3
    vec4 s1 = texture(iChannel1, vec2(.375,.5));   // ph4, ph5, press, mark
    vec4 s2 = texture(iChannel1, vec2(.625,.5));   // kickEnv, prevGate, shocks
    vec4 s3 = texture(iChannel1, vec2(.875,.5));   // spark envelopes
    float dt = clamp(iTimeDelta, .001, .1);

    // loudness, Ember-style: the mean of the six ring bands, smoothed ~.6 s
    // so the carousel accelerates into a loud passage instead of twitching
    float m = ( band(.0047)+band(.0119)+band(.0306)
              + band(.0765)+band(.196) +band(.493) )/6.;
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

    // sp spans .30 (near silence: a calm drift) to ~1.8 (pounding);
    // at mid press it passes ~1.05, i.e. the old fixed speed
    float sp = .30 + 1.5*press;
    const float TAU = 6.28318530718;
    s0    = mod(s0    + vec4(.25,.47,.69,.91)*sp*dt, TAU);
    s1.xy = mod(s1.xy + vec2(1.13,1.35)      *sp*dt, TAU);

    float fx = U.x/iResolution.x;
    C = (fx < .25) ? s0
      : (fx < .5)  ? vec4(s1.xy, press, 1.)
      : (fx < .75) ? vec4(kickEnv, gate, shp)
      :              vec4(treEnv, treFlash, sst);
}
