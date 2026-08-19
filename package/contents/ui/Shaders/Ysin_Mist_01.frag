#define A(v) mat2(cos(m.v+radians(vec4(0, -90, 90, 0))))  // rotate
#define W(v) length(vec3(p.yz-v(p.x+vec2(0, pi_2)+t), 0))-lt  // wave
//#define W(v) length(p-vec3(round(p.x*pi)/pi, v(t+p.x), v(t+pi_2+p.x)))-lt  // alt wave
#define P(v) length(p-vec3(0, v(t), v(t+pi_2)))-pt  // point

// Ysin_Mist6 — Mist5 + Discoteq companion lines; amplitude morphs the shape, no zoom
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


#define S smoothstep
vec4 Line(vec2 uv, float speed, float height, vec3 col) {
    // braid: widest swing mid-screen (Discoteq style), small floor at borders
    uv.y += (.25 + .75*S(1.6, 0., abs(uv.x))) * sin(iTime * speed + uv.x * height) * .32;
    // hairline over most of the width, fattening only at the very ends
    return vec4(S(.05 * S(1.15, 1.75, abs(uv.x)), 0., abs(uv.y) - .004) * col * .6, 1.0);
}

void mainImage(out vec4 C, in vec2 U){
    vec2 R=iResolution.xy;
    vec2 uv = U/R*2.-1.; uv.x *= R.x/R.y;
    float t=iTime;

    // mist rides the SAME axis as the wave; it advects the opposite way,
    // so wave and fog slide past each other along one shared line
    float angS = .35*sin(.03*t+2.);
    vec2 uvM = rotate2d(angS)*uv;
    vec3 color = bg(uvM)*(2.-abs(uvM.y*2.));

    // sinusoid in its own gently tilting frame,
    // with breathing amplitude and pulsing thickness
    vec2 p = rotate2d(angS)*uv;
    float k = 6.28318/2.6;
    // amplitude grows by MORPHING the waveform, not by zooming:
    // edge-pinned envelope + harmonics with evolving weights
    float env = S(1.5, .1, abs(p.x));
    float a1 = .28 + .18*sin(.23*t);
    float a2 = .14*sin(.11*t + 2.);
    float a3 = .09*sin(.07*t + 4.);
    float y = env*( a1*sin(k*p.x - 1.2*t)
                  + a2*sin(2.*k*p.x + .7*t)
                  + a3*sin(3.*k*p.x - .5*t + 1.) );
    float d = abs(p.y - y);
    float w = (.75+.35*sin(.35*t - 2.)) * (.85+.40*sin(k*.8*p.x + .9*t));
    w = clamp(w, .25, 1.5);
    float wd = d/w;
    color += vec3(.55,.42,.10)*(.007/(wd+.006));     // core, dim
    color += vec3(.42,.28,.04)*.005/(wd*wd*20.+.030); // halo, dim

    // Discoteq companion lines: original speeds, one distinct color each
    vec3 lineCol[6] = vec3[6](
        vec3(.90,.20,.15),   // ember red
        vec3(1.0,.55,.10),   // amber
        vec3(.95,.85,.25),   // lemon
        vec3(.15,.75,.55),   // emerald
        vec3(.20,.55,.95),   // azure
        vec3(.65,.35,.95));  // violet
    for (float i=0.; i<=5.; i+=1.){
        float ti = i/5.;
        color += Line(p, 1.+ti, 4.+ti, lineCol[int(i)]).rgb;
    }

    C = vec4(color, 1.);
}
