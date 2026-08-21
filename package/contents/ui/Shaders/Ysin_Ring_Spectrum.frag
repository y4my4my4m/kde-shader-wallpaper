// Ysin_Ring_Spectrum - Ysin_Ring split into six rotating rings, one per
// frequency band: bass innermost (slow, thick, deep indigo), highs
// outermost (fast, thin, yellow). Neighbouring rings spin in opposite
// directions; both thickness and luminance walk the depth-to-flame
// gradient outward.
//
// PAIRED with Ysin_Ring_Spectrum_bufferA.frag - the engine finds it BY
// NAME, so a copy must rename both. The buffer holds what a stateless
// pass cannot: the integrated ring phases (spin SPEED follows loudness,
// Ember-style, without the position jumping), the kick onset envelope,
// the shockwave phases with their birth strengths, and the spark-field
// hysteresis. Everything else is computed per-frame from the audio
// texture (512x2: spectrum row y=.25, waveform row y=.75).
//
// Per ring, the band drives three things:
//   ARC LENGTH  - quiet band = short dashes, loud band = closed circle
//   GLOW GAIN   - brightness and a soft halo
//   RADIUS WOBBLE - a slight k-lobed deformation, only when the band is up
// The innermost ring answers the bass beyond that: length and width snap
// on the kick (with a saturation escape - see below), and cerulean mist
// waves born at each hit carry its colour outward. Ring 2 (360 Hz) is the
// reference response and is deliberately left untouched.
//
// Band centres 55/140/360/900/2300/5800 Hz; on the FFT row (y=.25) that is
// x = f/11760. Each band averages taps at 0.72x/1x/1.38x of its centre.
// The dB-mapped texture tilts down with frequency, so the presence curve
// lifts each band by .07 per ring before expansion - without it the two
// outer rings barely light up on real music.

// --- animated mist (Ysin_Ring's, unchanged) --------------------------------
float fhash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float fnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    float a=fhash(i), b=fhash(i+vec2(1,0)), c=fhash(i+vec2(0,1)), e=fhash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,e,f.x), f.y); }
// octave count per call site: the warp only DISPLACES (its high octaves are
// invisible), the density is what the eye sees. 19 noise evals per pixel
// where the original Ysin_Ring spends 35 (7 calls x 5 octaves).
float fbm(vec2 p, int oct){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<oct;i++){ v+=a*fnoise(p); p=m*p; a*=.5; } return v; }
float fogStrength(float t){ return .2 + .8*(.5+.5*sin(.35*t - 1.5)); }
vec2 fogWarp(vec2 uv, float t){
    float s = fogStrength(t);
    return .06*s*(vec2(fbm(uv*3. + .20*t, 3), fbm(uv*3. + vec2(7.,3.) - .15*t, 3)) - .5);
}
vec3 applyFog(vec3 col, vec2 uv, float t){
    vec2 p = uv*2.6 + vec2(.05*t, .02*t);
    vec2 q = vec2(fbm(p + .12*t, 4), fbm(p + vec2(5.2,1.3) - .09*t, 4));
    // single warp stage: the second one (w through q) was two more fbm calls
    // for a swirl the mist's own motion already provides
    float den = smoothstep(.25,.85, fbm(p + 2.4*q, 5));
    den *= fogStrength(t);
    col *= 1. - .8*den;
    col += vec3(.85,.75,.55) * den * .12;
    return col;
}

// --- audio (iChannel0: 512x2, spectrum row y=.25) --------------------------
float band(float x){
    return ( texture(iChannel0, vec2(x*.72, .25)).r
           + texture(iChannel0, vec2(x,     .25)).r
           + texture(iChannel0, vec2(x*1.38,.25)).r ) / 3.;
}

void mainImage(out vec4 C, in vec2 U){
    vec2 R=iResolution.xy; vec2 uv=(U-.5*R)/R.y; float t=iTime;
    uv += fogWarp(uv, t);
    float r=length(uv), a=atan(uv.y,uv.x);

    // six bands, low to high, plus their mix mean for spatial contrast
    float b0=band(.0047), b1=band(.0119), b2=band(.0306),
          b3=band(.0765), b4=band(.196),  b5=band(.493);
    float m=(b0+b1+b2+b3+b4+b5)/6.;

    // ring phases from the buffer (iChannel1): integrated there so the spin
    // SPEED can follow the music without the position jumping - the same
    // reason Ysin_Ember's main line flows on a buffered phase. Base-speed
    // ladder and directions are unchanged; one loudness factor scales all
    // six in proportion. With no buffer bound these read 0 and the rings
    // stand still - if that happens, check the pair got installed together.
    vec4 ph03 = texture(iChannel1, vec2(.125,.5));
    vec2 ph45 = texture(iChannel1, vec2(.375,.5)).xy;

    // kick from the buffer: an onset ENVELOPE (instant attack, ~150 ms
    // decay) computed once per frame there, replacing the per-frame
    // waveform product that flickered when a 30 ms hit straddled frames.
    // zw carry the two shockwave phases, born on the onset edge.
    vec4 kb = texture(iChannel1, vec2(.625,.5));
    float kick = kb.x;

    vec3 col=vec3(0.);
    for(int i=0;i<6;i++){
        float fi=float(i);
        float bi = (i==0)?b0:(i==1)?b1:(i==2)?b2:(i==3)?b3:(i==4)?b4:b5;
        // presence: absolute floor (tilt-lifted), scaled by how much the
        // band stands out of the mix - a flat loud mix lights all rings
        // evenly, one hot band lights its own ring first
        // tilt per ring: .07/ring lifted the outer pair so far into the
        // responsive window that their arcs sat at one length from the
        // first bar, moving only on real overload. A smaller tilt parks
        // them lower, so ordinary treble variation shows as length again.
        // Rings 0-3 - including ring 2, the untouchable reference - keep
        // the original constant exactly.
        float tilt = (i>=4 ? .045 : .07) * fi;
        float e = smoothstep(.30,.85, bi + tilt)
                * (.35 + .65*smoothstep(-.05,.15, bi-m));
        float eRaw = e;
        // saturation escape, innermost ring only: on heavy material the
        // smoothed bass pins at the top of its dB range and e freezes at 1 -
        // the ring sat closed, thin and DEAD precisely through the loudest
        // passages, coming alive only in quiet intros and bare bass. Ring 2
        // never pins (its band lives mid-range), which is why it reads as
        // the reference; it is left untouched. Here the UNSMOOTHED transient
        // re-modulates the drive, so every hit shakes length, wobble,
        // breathing and width even when the average is glued to the ceiling.
        if (i==0) e = min(1., e*(.55 + .45*kick));
        float dir = (mod(fi,2.)<1.) ? 1. : -1.;
        float ph = (i==0)?ph03.x:(i==1)?ph03.y:(i==2)?ph03.z
                 : (i==3)?ph03.w:(i==4)?ph45.x:ph45.y;
        float k  = 3. + fi;                        // arc count
        float rad = (.14 + .068*fi) * (1. + .06*e)   // ring breathes OUT with its band
                  + .014*e*sin(k*a + 2.*t*dir);      // wobble only when loud
        float d = abs(r-rad);
        // .85 floor: in silence the dashes are short sparks; a loud band
        // closes the circle - the length now spans most of the visual range.
        //
        // The innermost ring's LENGTH gets its own, deeper escape than the
        // width/wobble one: with the shared .55 floor the arcs were already
        // two-thirds closed between hits, so under full pounding the ring
        // only trembled. Length now falls to a .30 floor between hits and
        // snaps to a full circle on each one - lengthen-and-shrink restored
        // at heavy load, while width keeps the gentler tremble.
        // .52 floor, not .30: the deep floor made the arcs SHORTER between
        // hits than _23 ever had them - visibly dwindling under pounding.
        // The higher floor keeps the ring substantial at all times; the
        // kick still snaps it to a full circle, so the cycle survives.
        float eL = (i==0) ? min(1., eRaw*(.52+.48*kick) + .40*kick) : e;
        float arc = smoothstep(mix(.85,-1.,eL), 1., cos(k*(a - dir*ph)));
        // depth-to-flame walk: deep indigo at the bass core, through sea
        // green, out to gold and ember orange at the rim. What keeps this
        // from turning fairground-rainbow: the in-between hues are
        // DESATURATED and the luminance climbs monotonically outward, so
        // the eye reads one gradient instead of six stripes.
        // outer three separated on purpose - the previous green-gold / warm
        // gold / yellow trio all lived in one lane and read as a single hue
        vec3 pal[6] = vec3[](
            vec3(.10,.20,.55),      // deep indigo (bass, innermost)
            vec3(.15,.38,.62),      // cerulean - the second blue, clearly lighter
            vec3(.13,.42,.44),      // teal - between green and blue
            vec3(.18,.52,.20),      // proper green, no gold in it
            vec3(.60,.68,.15),      // chartreuse - between yellow and green
            vec3(1.,.85,.15)        // the yellowest, rim
        );
        vec3 tint = pal[i];
        // .005 base (was .0035): sparse music left the screen nearly empty -
        // the skeleton stays faintly present even between hits
        //
        // the innermost ring answers the bass the old way again: the line
        // gets LONGER (eL above) and THINNER on the hit - a crisp snap,
        // where _14's fattening read as sluggish. No width normalisation
        // on purpose: narrowing raises the peak on its own, and that
        // sharpening IS the liveliness. Sustained bass thins it steadily,
        // the kick snaps it; idle it rests slightly softer than the rest.
        // thickness GRADIENT across the scene: fattest line innermost,
        // thinnest at the rim - weight sits in the depth, the rim stays
        // filigree. The bass ring (thicker again, .012 idle) keeps its
        // hit-tightening; rings 1-5 taper linearly .0054 -> .0022. Ring 2
        // keeps its untouched dynamics - only its static width joins the
        // taper, per the gradient.
        // the previous taper (.0054->.0022, bass .012->.006) read as "all
        // the same": under pounding the bass e pins high so its mix sat at
        // the thin end beside ring 1, and a 2x spread does not survive the
        // saturated-core glow. The gradient has to be coarse to be seen:
        // bass 3x ring 1, ring 1 4x ring 5.
        float wd = (i==0)
            ? mix(.020, .011, max(e, kick))
            : .0070 - .0011*fi;
        // (wd/.004) peak compensation, scene-wide: 1/(d+wd) dims as it
        // widens (the .012 bass ring lost 3x peak and nearly vanished -
        // camera-verified). With the peak held, the taper reads as
        // THICKNESS, not as a brightness gradient.
        col += tint*(.005+.012*eL)*arc*(wd/.004)/(d+wd);
        col += tint*.004*e/(d*d*160.+.06);         // halo on a strong band
    }

    // treble sparks: fast round EMBERS in the outer annulus - one dot per
    // cell, flying outward on its own desynced life phase and gone in a
    // fraction of a second. exp() falloff keeps them round; the old version
    // lit whole floor() cells, which read as slow blinking squares.
    // _08 rework: the _06 dot flew .9 of a cell while only its OWN cell can
    // render it, so it vanished a third into its life. Flight now fits the
    // cell (jitter .3 + travel .45 stays under the .5 edge minus dot radius),
    // the grid is denser, the annulus twice as wide, and a soft floor keeps
    // a few embers alive even in quiet passages.
    float tre = smoothstep(.25,.70, max(b4,b5)+.10);
    // COUNT from the buffer's hysteresis envelope (instant attack, ~1.4 s
    // release): the field grows the moment treble arrives and LINGERS,
    // dying down after it stops instead of being cut off. tb.y is the
    // treble FLASH - a ~120 ms transient envelope that pops the whole
    // field on every hat, the strong reaction the smoothed density gate
    // could never show.
    vec4 tb = texture(iChannel1, vec2(.875,.5));
    float treE = tb.x;
    if (tre > .005 || treE > .005){
        vec2  g   = uv*30.;
        vec2  id  = floor(g);
        float rn  = fhash(id);
        // .25+.45, not .12+.88: with hats pinning the smoothed treble the
        // full-swing gate strobed the whole field at hat rate (4 Hz, FFT-
        // confirmed). Slow energy decides WHICH embers exist.
        if (fhash(id+9.3) < .25 + .45*treE){
            float ph  = fract(t*(3.+2.*rn) + rn*7.);   // 3-5 lives per second
            vec2  jit = (vec2(fhash(id+3.1), fhash(id+5.7)) - .5)*.6;
            vec2  dp  = fract(g)-.5 - jit
                      - normalize((id+.5)/30. + 1e-4)*ph*.45;  // radial, in-cell
            // three calm hues from Ember's scene, hashed per cell: white-gold,
            // ember orange, and the flame's blue root - variety, not rainbow
            float cs = fhash(id+7.7);
            vec3 scol = cs<.45 ? vec3(1.,.92,.66)
                      : cs<.80 ? vec3(1.,.55,.18)
                      :          vec3(.40,.58,1.0);
            float spark = exp(-dot(dp,dp)*(80.+70.*fhash(id+4.9)))  // sized
                        * (1.-ph)*(.55+.45*tre);
            col += scol * 2.2 * (1. + 1.8*tb.y)
                 * smoothstep(.20,.04, abs(r-.44)) * spark;
        }
    }

    // bass shockwaves as CERULEAN MIST: born at the hit (phases from the
    // buffer), thick soft gaussian bands with a wispy noise edge instead of
    // a crisp line, sparser (min spacing enforced in the buffer), and
    // scaled by the remembered BIRTH STRENGTH - a soft kick drifts out as
    // a faint veil, a hard one as a dense ring of fog.
    for(int j=0;j<2;j++){
        float ph  = (j==0) ? kb.z : kb.w;
        float str = (j==0) ? tb.z : tb.w;
        if (ph >= 1. || str < .01) continue;
        float dd  = abs(r - (.10 + .55*ph));
        float sig = .026 + .024*str;               // harder hit = thicker
        float mist = exp(-dd*dd/(2.*sig*sig))
                   * (.80 + .45*fnoise(uv*9. + vec2(0., -3.*ph)));
        // sqrt(str) lifts the ordinary hits (gate rarely reaches 1), decay
        // linear instead of squared, gain doubled: same veil shape, VISIBLE
        col += vec3(.22,.48,.85) * sqrt(str)*(1.-ph) * 1.2 * mist;
    }


    // the bass accent is a HUE shift, not a brightness hit: red and green
    // dip as blue rises, so luminance stays near constant (dY ~ -3%) and
    // the scene TURNS deep blue on the kick instead of flaring - a clear
    // accent that cannot blind
    col *= vec3(1.-.12*kick, 1.-.04*kick, 1.+.30*kick);
    // a faint indigo veil in the depth, kept well under blinding
    col += vec3(.03,.06,.20)*kick*smoothstep(.55,.05,r);

    // core pulse on the overall mix - COLD, matching the indigo depth it
    // sits in: the old fire-coloured glow was washing both inner blues into
    // a milky haze; a cool core lets the depth read as depth
    float E=smoothstep(.35,.8,m);
    col += vec3(.65,.75,1.)*(.002+.015*E+.012*kick)/(r+.02);

    col*=smoothstep(1.15,.45,r+.15);
    col = applyFog(col, uv, t);
    col=1.-exp(-col);
    C=vec4(col,1.);
}
