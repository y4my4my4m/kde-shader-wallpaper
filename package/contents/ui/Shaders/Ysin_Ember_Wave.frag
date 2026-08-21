// Ysin_Ember_Wave - Wave_01 with the braid spread across the spectrum
// and put on the music's clock. The main line is untouched: still the pure
// spectrum shape, still no beat in it.
//
// Shadertoy port: https://www.shadertoy.com/view/7fdXWB
//
// Two changes, both in the braid:
//
//   REGIONS. Each of the six strands now follows its own frequency band
//   (centres 55/140/360/900/2300/5800 Hz, tiling with no overlap, darkest
//   strand lowest), judged against that band's own 4 s average rather than
//   its absolute level - the dB-mapped texture makes absolute levels useless,
//   they sit near the top and span about one percent. Wave_01 drove all six
//   strands from one mids signal, so they moved as a single body.
//
//   SPEED. The braid's travel comes from phases accumulated in the buffer at
//   .109*r, the same music-driven rate the main wave has always used, instead
//   of being read off iTime. Wave_02 used .326, which held the median pace at
//   exactly Wave_01's; Wave_03 is that divided by three - 0.084-0.134 screen
//   units per second, one crossing every 27 to 43 s, against Wave_02's 9 to
//   14 s. The shape breathing is NOT slowed with it; only the drift is.
//
// NO SHIVER, on purpose. The Mix family gave every strand a fast second term
// and a drum flick on top; neither is here. One slow quantity moves each
// strand and nothing else. The beat is still measured and still allowed to
// matter, but only as PRESSURE - a ~4 s average of the pulse that opens the
// weave in a drum-heavy passage and closes it in a drumless one. Evolution,
// not vibration.
//
// The paired Ysin_Ember_Wave_bufferA.frag holds the regions, their
// AGC, the phases and all per-frame state; the engine finds it BY NAME, so a
// copy must rename both files.
//
// ===========================================================================
// TUNING - the braid. The wave's half is Wave_01's and is left alone.
//
//   swing (.18 + .80*band)  .18 = how far a strand moves when ITS region is
//                         quiet; .80 = how much its own region adds. Raise
//                         the second for more contrast BETWEEN strands, which
//                         is the point of this version.
//   ampG (.45 + .55*Es) * (.85 + .30*press)
//                         The braid as one body: size in silence, how much
//                         loudness inflates it, and then the slow drum
//                         pressure term. Set .30 to 0 for a braid the beat
//                         cannot reach at all.
//   brightness (.20 + 1.6*band)
//                         Glow of an idle strand and how hard a busy region
//                         lights its own.
//   braid speed           .109*r in the buffer - see there. Wave_02's value
//                         was .326; this is a third of it.
//   drive smoothing       If the strands still change SHAPE too eagerly, that
//                         is a different knob: the .08/.035 asymmetric pair in
//                         the buffer (swell ~0.2 s, settle ~0.5 s). Speed and
//                         shape are independent here.
// ===========================================================================
//
// Ysin_Ember - Ysin_Ember_NoAudio coupled to the audio FFT (iChannel0)
#define A(v) mat2(cos(m.v+radians(vec4(0, -90, 90, 0))))  // rotate
#define W(v) length(vec3(p.yz-v(p.x+vec2(0, pi_2)+t), 0))-lt  // wave
//#define W(v) length(p-vec3(round(p.x*pi)/pi, v(t+p.x), v(t+pi_2+p.x)))-lt  // alt wave
#define P(v) length(p-vec3(0, v(t), v(t+pi_2)))-pt  // point

// Ysin_Ember_NoAudio — Mist5 + Discoteq companion lines; amplitude morphs the shape, no zoom
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
float fbm(in vec2 uv){
    uv *= 5.0;
    mat2 m = mat2(1.6,1.2,-1.2,1.6);
    float f = .5000*noise(uv); uv=m*uv;
    f += .2500*noise(uv); uv=m*uv;
    f += .1250*noise(uv); uv=m*uv;
    f += .0625*noise(uv); uv=m*uv;
    f += .0313*noise(uv);
    return .5+.5*f;
}
mat2 rotate2d(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }

vec3 bg(vec2 uv){
    float velocity = iTime/1.6;
    float intensity = sin(uv.x*3.+velocity*2.)*1.1+1.5;
    uv.y -= 2.;
    vec2 bp = uv+glowPos;
    uv *= noiseDefinition;
    float rb = fbm(vec2(uv.x*.5-velocity*.03, uv.y))*.1;   // ripple
    uv += rb;
    float rz = fbm(uv*.9+vec2(-velocity*.35, 0.));         // coloring, drifts opposite the wave
    rz *= dot(bp*intensity,bp)+1.2;
    vec3 col = bgColor/(.1-rz);
    return sqrt(abs(col));
}



// 3D noise from Flame (anatole duprat - XT95/2013, CC BY-NC-SA 3.0)
float fnoise3(vec3 p){
    vec3 i = floor(p);
    vec4 a = dot(i, vec3(1., 57., 21.)) + vec4(0., 57., 21., 78.);
    vec3 f = cos((p-i)*acos(-1.))*(-.5)+.5;
    a = mix(sin(cos(a)*a), sin(cos(1.+a)*(1.+a)), f.x);
    a.xy = mix(a.xz, a.yw, f.y);
    return mix(a.x, a.y, f.z);
}

// Braid drive from buffer A: the mids band's deviation from its own running
// average, normalised by its own spread and smoothed to a swell (~0.2 s up,
// ~0.5 s down). Set in mainImage, read by Line().
//
// It replaced the raw band LEVEL for one measured reason: the spectrum
// texture is dB-mapped, a level therefore sits near the top on real music,
// and the old factor (.40 + .45*level) moved between 0.81 and 0.82 - the
// braid had, in practice, a constant size. This drive uses the full 0..1 on
// any material, and it changes AMPLITUDE only; the shiver stays out of this
// shader (that is what Ysin_Ember_Mix is for).
// gDrive is gone: there is no single braid drive any more, each strand
// carries its own region. Line() takes it as an argument instead.

// Percussion pulse from buffer A: onset envelopes of the kick and hat bands,
// instant attack and ~0.18 s decay. It is the only fast term in this shader -
// a flick on the beat, kept small on purpose, while gDrive above does the
// slow swelling. Declared here because Line() reads it (a global used inside
// a helper must be declared above that helper or the engine reports
// "undefined variable" and retries the compile every frame).
// gPulse is gone from the braid as well - the beat reaches it only through
// the slow pressure term applied to ampG in the main pass.

// Ceiling on how far a strand may travel from the axis: the screen is
// uv.y in [-1,1] and the main wave stops at .82, so the braid must not
// out-swing it. tanh bends only the peak, so the swelling stays visible.
const float braidMax = .82;

#define S smoothstep
vec4 Line(vec2 uv, float height, vec3 col, float band, float amp, float ph) {
    // Braid: swings widest mid-screen, and how wide is what THIS strand's
    // region decides. 'ph' arrives from the buffer, where it was advanced at a
    // music-driven rate - Wave_01 had sin(iTime*speed + ...) here instead.
    // One term, and only one: no fast carrier, no drum flick. The tanh still
    // bends the peak so a swell can never push a strand off the screen.
    float mid = .25 + .75*S(1.6, 0., abs(uv.x));
    float off = mid * sin(ph + uv.x * height) * (.18 + .80*band) * amp;
    uv.y += braidMax * tanh(off / braidMax);
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

    // pitch-black background; the shared axis still sways
    // treble sparkle on the main wave's core; falls to 0 in silence / with
    // capture off. Bass and mids are no longer read here - the braid takes
    // its drive from buffer A, where it has a reference to compare against.
    float treb = (aTap(.45)+aTap(.65))*.5;
    // integrator state from buffer A: six phases wrapped to 2pi (16F-safe),
    // advancing forward only, faster when the music is loud
    // Eleven columns since Wave_02 - see the buffer's header for the layout.
    vec4 sA  = texture(iChannel1, vec2( 1./22., .5));
    vec4 sB  = texture(iChannel1, vec2( 3./22., .5));
    vec4 sM1 = texture(iChannel1, vec2(13./22., .5));   // .z = drum pressure
    vec4 sG0 = texture(iChannel1, vec2(15./22., .5));   // drives, regions 0..3
    vec4 sG1 = texture(iChannel1, vec2(17./22., .5));   // drives, regions 4,5
    vec4 sP0 = texture(iChannel1, vec2(19./22., .5));   // braid phases 0..3
    vec4 sP1 = texture(iChannel1, vec2(21./22., .5));   // braid phases 4,5
    float Es = sB.b;
    // Silence still stops the braid: the gate rides the full-band fill, so a
    // quiet desktop leaves the strands at rest instead of chasing noise.
    float gate = S(.03, .12, Es);
    vec4 d0 = sG0 * gate;
    vec4 d1 = sG1 * gate;
    // The braid as one body: breathing with the mix, and opened slowly by how
    // present the drums are. press is a ~4 s average, so this is a swell over
    // seconds - the only route the beat has into the braid.
    float press = clamp(sM1.z, 0., 1.);
    float ampG = (.45 + .55*Es) * (.85 + .30*press);

    float angS = .35*sin(.03*t+2.);
    vec3 color = vec3(0.);

    // sinusoid in its own gently tilting frame,
    // with breathing amplitude and pulsing thickness
    vec2 p = rotate2d(angS)*uv;
    float k = 6.28318/2.6;
    // amplitude grows by MORPHING the waveform, not by zooming:
    // edge-pinned envelope + harmonics with evolving weights
    float env = S(1.5, .1, abs(p.x));
    // the wave group lives on integrated PHASES from buffer A: they only
    // ever advance, faster when the music is loud, settling in silence
    float a1 = .42 + .26*sin(sA.y);
    float a2 = .18*sin(sA.z + 2.);
    float a3 = .11*sin(sA.w + 4.);
    float y = env*( a1*sin(k*p.x - sA.x)
                  + a2*sin(2.*k*p.x + sB.x)
                  + a3*sin(3.*k*p.x - sB.y + 1.) );
    y = .82*tanh(y/.82);   // taller swing, soft-limited so the crest never leaves the screen
    float d = abs(p.y - y);
    float w = (.75+.35*sin(.35*t - 2.)) * (.85+.40*sin(k*.8*p.x + .9*t));
    w = clamp(w, .25, 1.5);
    float wd = d/w;
    color += vec3(.55,.42,.10)*(.007*(1.+.9*treb)/(wd+.006));  // core; treble sparkle
    color += vec3(.42,.28,.04)*.005/(wd*wd*20.+.030); // halo, dim

    // flitting flame packet racing along the wave (Flame noise + palette)
    float dy = p.y - y;                              // height above the curve
    float xc = -2.2 + mod(.55*t, 4.4);               // sweep position
    float sweep = exp(-pow((p.x - xc)*1.1, 2.));
    float turb = fnoise3(vec3(p.x*2.5, dy*3. - 2.2*t, .6*t));
    float fh = (.30*sweep + .04)*(.35 + 2.8*Es);     // flame follows smoothed band fill
    float fire = clamp((fh - dy - .12*turb)/fh, 0., 1.);
    fire *= smoothstep(-.05, .01, dy) * smoothstep(0., .15, sweep);
    fire *= fire;
    color += fire * vec3(.80, .58, .14);             // flame body, dark gold
    color += fire*fire*fire * vec3(.75, .58, .22);   // hot inner tongue, softened
    color += smoothstep(.025, 0., abs(dy)) * sweep * vec3(.15,.45,1.2)*.7; // blue root

    // Discoteq companion lines: original spatial frequencies and colour
    // sweep, one frequency region each, dark/low -> bright/high.
    for (int i = 0; i < 6; i++){
        float ti = float(i)/5.;
        float b  = (i == 0) ? d0.x : (i == 1) ? d0.y : (i == 2) ? d0.z
                 : (i == 3) ? d0.w : (i == 4) ? d1.x : d1.y;
        float ph = (i == 0) ? sP0.x : (i == 1) ? sP0.y : (i == 2) ? sP0.z
                 : (i == 3) ? sP0.w : (i == 4) ? sP1.x : sP1.y;
        color += Line(p, 4.+ti, vec3(.2+ti*.7, .2+ti*.4, .3), b, ampG, ph).rgb
               * (.20 + 1.6*b);
    }

    C = vec4(color, 1.);
}
