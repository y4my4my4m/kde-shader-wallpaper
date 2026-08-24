#define A(v) mat2(cos(m.v+radians(vec4(0, -90, 90, 0))))  // rotate
#define W(v) length(vec3(p.yz-v(p.x+vec2(0, pi_2)+t), 0))-lt  // wave
//#define W(v) length(p-vec3(round(p.x*pi)/pi, v(t+p.x), v(t+pi_2+p.x)))-lt  // alt wave
#define P(v) length(p-vec3(0, v(t), v(t+pi_2)))-pt  // point

// Ysin_Ring — sinusoid bent into a rotating ring (oscilloscope flower)

// --- animated mist: breathing density + double domain-warp vortices ---
float fhash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float fnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    float a=fhash(i), b=fhash(i+vec2(1,0)), c=fhash(i+vec2(0,1)), e=fhash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,e,f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<5;i++){ v+=a*fnoise(p); p=m*p; a*=.5; } return v; }
float fogStrength(float t){ return .2 + .8*(.5+.5*sin(.35*t - 1.5)); }
vec2 fogWarp(vec2 uv, float t){
    float s = fogStrength(t);
    return .06*s*(vec2(fbm(uv*3. + .20*t), fbm(uv*3. + vec2(7.,3.) - .15*t)) - .5);
}
vec3 applyFog(vec3 col, vec2 uv, float t){
    vec2 p = uv*2.6 + vec2(.05*t, .02*t);
    vec2 q = vec2(fbm(p + .12*t), fbm(p + vec2(5.2,1.3) - .09*t));
    vec2 w = vec2(fbm(p + 2.2*q + vec2(1.7,9.2) + .10*t),
                  fbm(p + 2.2*q + vec2(8.3,2.8) - .07*t));
    float den = smoothstep(.25,.85, fbm(p + 2.5*w));
    den *= fogStrength(t);
    col *= 1. - .8*den;                      // veil the lines
    col += vec3(.85,.75,.55) * den * .12;    // faint glow of the mist itself
    return col;
}

void mainImage(out vec4 C, in vec2 U){
    vec2 R=iResolution.xy; vec2 uv=(U-.5*R)/R.y; float t=iTime;
    uv += fogWarp(uv, t);
    vec3 col=vec3(0.);
    float r=length(uv), a=atan(uv.y,uv.x);
    float rad=.42+.10*sin(6.*a+2.0*t);
    float d=abs(r-rad);
    col+=vec3(1.,.84,.20)*(.010/(d+.004));
    col+=vec3(1.,.65,.05)*.008/(d*d*40.+.020);
    float rad2=.26+.06*sin(4.*a-1.5*t+1.0);
    float d2=abs(r-rad2);
    col+=vec3(.80,.55,.10)*.0025/(d2+.010);
    col*=smoothstep(1.15,.45,r+.15);
    col = applyFog(col, uv, t);
    col=1.-exp(-col);
    C=vec4(col,1.);
}
