// Ysin_Mist_Audio - Ysin_Mist_03 coupled to the audio FFT (iChannel0)
#define A(v) mat2(cos(m.v+radians(vec4(0, -90, 90, 0))))  // rotate
#define W(v) length(vec3(p.yz-v(p.x+vec2(0, pi_2)+t), 0))-lt  // wave
//#define W(v) length(p-vec3(round(p.x*pi)/pi, v(t+p.x), v(t+pi_2+p.x)))-lt  // alt wave
#define P(v) length(p-vec3(0, v(t), v(t+pi_2)))-pt  // point

// Ysin_Mist_03 — Mist5 + Discoteq companion lines; amplitude morphs the shape, no zoom
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
// shader (that is what Ysin_Mist_Audio_Mix is for).
float gDrive = 0.;

// Percussion pulse from buffer A: onset envelopes of the kick and hat bands,
// instant attack and ~0.18 s decay. It is the only fast term in this shader -
// a flick on the beat, kept small on purpose, while gDrive above does the
// slow swelling. Declared here because Line() reads it (a global used inside
// a helper must be declared above that helper or the engine reports
// "undefined variable" and retries the compile every frame).
float gPulse = 0.;

// Ceiling on how far a strand may travel from the axis: the screen is
// uv.y in [-1,1] and the main wave stops at .82, so the braid must not
// out-swing it. tanh bends only the peak, so the swelling stays visible.
const float braidMax = .82;

#define S smoothstep
vec4 Line(vec2 uv, float speed, float height, vec3 col) {
    // braid: swings widest mid-screen, and how wide is what the music decides
    float mid = .25 + .75*S(1.6, 0., abs(uv.x));
    float off = mid * sin(iTime * speed + uv.x * height) * (.18 + .80*gDrive);
    // the drum flick: rides on top of the swell, inside the same limiter, so
    // a loud beat can never push a strand off the screen
    off += mid * .13 * gPulse * sin(iTime*(3.4*speed + 5.) + uv.x*(2.1*height));
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
    vec4 sA = texture(iChannel1, vec2(1./12., .5));
    vec4 sB = texture(iChannel1, vec2(3./12., .5));
    float Es = sB.b;
    gDrive = texture(iChannel1, vec2(5./12., .5)).y;   // smoothed braid drive
    // percussion pulses: kick leads, snare/hats add a lighter tick
    vec4 sD = texture(iChannel1, vec2(7./12., .5));
    vec4 sF = texture(iChannel1, vec2( 9./12., .5));   // band envelopes  lo/mid/hi
    vec4 sM = texture(iChannel1, vec2(11./12., .5));   // their means; .w = drum pressure
    // same expansion the Mix family measured as worth it: the raw deviation
    // only ever used about a fifth of its range
    vec4 bd = S(vec4(.30), vec4(.85), clamp((sF - sM)*2.6 + .38, 0., 1.));
    float gateW = S(.03, .12, Es);
    float lo = bd.x*gateW, md = bd.y*gateW, hi = bd.z*gateW;
    float press = clamp(sM.w, 0., 1.);
    gPulse = clamp(sD.x + .55*sD.z, 0., 1.);
    // The wave gets the pulse EXPANDED (x2.2, the Mix family's measured
    // setting: the raw envelope reads .07-.16 between hits and ~.5 on strong
    // ones, which is too small to see). Kept separate so the braid, which is
    // not being changed here, keeps the response it already had.
    float pulseW = clamp(gPulse * 2.2, 0., 1.);

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
    // Each harmonic's SIZE now follows the part of the spectrum it stands for
    // (lows -> fundamental, mids -> second, highs -> third); the morph phase
    // only decides how that size is spent, including its sign. Before this the
    // shape cycled through its whole repertoire regardless of the music.
    float a1 = (.26 + .34*lo) + .18*sin(sA.y)*(.35 + .65*lo);
    float a2 = .18*sin(sA.z + 2.) * (.30 + .95*md);
    float a3 = .11*sin(sA.w + 4.) * (.25 + 1.05*hi);
    float y = env*( a1*sin(k*p.x - sA.x)
                  + a2*sin(2.*k*p.x + sB.x)
                  + a3*sin(3.*k*p.x - sB.y + 1.) );
    // How far the wave swings follows the drums: a busy passage opens it up, a
    // drumless one keeps it low (.60 is its size with no percussion at all).
    y *= .60 + .95*press;
    // and a brief widening on each hit
    y *= 1. + .20*pulseW;
    // A QUARTER of the old swing, so the line runs inside the braid rather
    // than arcing over it - the same scale the Mix family settled on.
    y *= .25;
    // The tremble, at HALF the Mix setting (.206 -> .103): here the flame is
    // left as it was, so the wave does not have to hand the beat over to it.
    // Not multiplied by env, so it runs the whole length of the line.
    y += .103 * pulseW * sin(4.5*k*p.x - 7.0*t);
    y = .82*tanh(y/.82);   // soft-limited so the crest never leaves the screen
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

    // Discoteq companion lines: original speeds AND original color sweep
    for (float i=0.; i<=5.; i+=1.){
        float ti = i/5.;
        color += Line(p, 1.+ti, 4.+ti, vec3(.2+ti*.7, .2+ti*.4, .3)).rgb * (.22 + 1.5*gDrive + .30*gPulse);
    }

    C = vec4(color, 1.);
}
