// url: https://www.shadertoy.com/view/ftBfWm
// credits: VPas

float noise(vec2 p) {
  return texture(iChannel0, p*.065).r;
}

vec3 noise3(vec2 p) {
  return texture(iChannel0, p*.01).rgb;
}

mat2 rot=mat2(.6,.8,-.8,.6);
float fbm(vec2 p) {
  float r;
  r  = noise(p)*.5000; p = rot * p * 1.99;
  r += noise(p)*.2500; p = rot * p * 2.01;
  r += noise(p)*.1250; p = rot * p *2.04;
  r += noise(p)*.0625;
  return r/0.9375;
}

vec3 pFbm(vec2 p){
  vec3 r;
  r  = noise3(p)*.5000; p=rot*p*1.99;
  r += noise3(p)*.2500; p=rot*p*2.01;
  r += noise3(p)*.1250; p=rot*p*2.04;
  r += noise3(p)*.0625;
  return r/0.9375;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    vec2 r = iResolution.xy;
    vec2 fG = fragCoord;
    vec2 uv = fG / min(r.x, r.y) + vec2(.01, .014) * iTime;
    vec3 pf = pFbm(uv * 20.);
    float v = 0.2 / fbm(pf.xy + vec2(1.,-1.) * .05 * iTime);
    float w = 0.4 / fbm(pf.zx);
    vec3 col = vec3(v*w*w, w*v, w*v);
    col*=col;
    col*=2.;
    fragColor = vec4(col / (1. + col), 1.0 );
}
