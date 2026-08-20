// Ysin_Ember_NoAudio - the Ember family's ancestor, before any of it was
// wired to the audio FFT: the same golden wave, travelling flame packet and
// six Discoteq braid strands, all running off iTime alone. Every audio
// version in this family started as a copy of this file.
//
// Named Ysin_Ember_NoAudio until the family was renamed - the "Mist" it referred
// to (the fbm background in bg()) is defined below but never called from
// mainImage, in this file and in every descendant.
//
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

#define S smoothstep
vec4 Line(vec2 uv, float speed, float height, vec3 col) {
    // braid: swing up to the main wave's max amplitude, widest mid-screen
    uv.y += (.25 + .75*S(1.6, 0., abs(uv.x))) * sin(iTime * speed + uv.x * height) * .6;
    // junctions: early, gentle blur ramp + strong dissolve = subtle fade-out
    float blur = .008 + .12 * S(.75, 1.78, abs(uv.x));   // floor = anti-aliasing
    float melt = 1. - .75*S(1.15, 1.78, abs(uv.x));
    return vec4(S(blur, 0., abs(uv.y) - .006) * col * .6 * melt, 1.0);
}

void mainImage(out vec4 C, in vec2 U){
    vec2 R=iResolution.xy;
    vec2 uv = U/R*2.-1.; uv.x *= R.x/R.y;
    float t=iTime;

    // pitch-black background; the shared axis still sways
    float angS = .35*sin(.03*t+2.);
    vec3 color = vec3(0.);

    // sinusoid in its own gently tilting frame,
    // with breathing amplitude and pulsing thickness
    vec2 p = rotate2d(angS)*uv;
    float k = 6.28318/2.6;
    // amplitude grows by MORPHING the waveform, not by zooming:
    // edge-pinned envelope + harmonics with evolving weights
    float env = S(1.5, .1, abs(p.x));
    float a1 = .42 + .26*sin(.23*t);
    float a2 = .18*sin(.11*t + 2.);
    float a3 = .11*sin(.07*t + 4.);
    float y = env*( a1*sin(k*p.x - 1.2*t)
                  + a2*sin(2.*k*p.x + .7*t)
                  + a3*sin(3.*k*p.x - .5*t + 1.) );
    y = .82*tanh(y/.82);   // taller swing, soft-limited so the crest never leaves the screen
    float d = abs(p.y - y);
    float w = (.75+.35*sin(.35*t - 2.)) * (.85+.40*sin(k*.8*p.x + .9*t));
    w = clamp(w, .25, 1.5);
    float wd = d/w;
    color += vec3(.55,.42,.10)*(.007/(wd+.006));     // core, dim
    color += vec3(.42,.28,.04)*.005/(wd*wd*20.+.030); // halo, dim

    // flitting flame packet racing along the wave (Flame noise + palette)
    float dy = p.y - y;                              // height above the curve
    float xc = -2.2 + mod(.55*t, 4.4);               // sweep position
    float sweep = exp(-pow((p.x - xc)*1.1, 2.));
    float turb = fnoise3(vec3(p.x*2.5, dy*3. - 2.2*t, .6*t));
    float fh = .30*sweep + .04;                      // local flame height
    float fire = clamp((fh - dy - .12*turb)/fh, 0., 1.);
    fire *= smoothstep(-.05, .01, dy) * smoothstep(0., .15, sweep);
    fire *= fire;
    color += fire * vec3(.80, .58, .14);             // flame body, dark gold
    color += fire*fire*fire * vec3(.75, .58, .22);   // hot inner tongue, softened
    color += smoothstep(.025, 0., abs(dy)) * sweep * vec3(.15,.45,1.2)*.7; // blue root

    // Discoteq companion lines: original speeds AND original color sweep
    for (float i=0.; i<=5.; i+=1.){
        float ti = i/5.;
        color += Line(p, 1.+ti, 4.+ti, vec3(.2+ti*.7, .2+ti*.4, .3)).rgb;
    }

    C = vec4(color, 1.);
}
