// URL: https://www.shadertoy.com/view/fdlSDl
// By: mrange

// License CC0: Cloudy crystal
// Late to the party I discovered: https://www.shadertoy.com/view/MtX3Ws
// Played around with it for a bit and thought it looked quite nice so I shared

#define TIME              iTime
#define RESOLUTION        iResolution
#define ROT(a)            mat2(cos(a), sin(a), -sin(a), cos(a))
#define PI                3.141592654
#define TAU               (2.0*PI)
#define L2(x)             dot(x, x)

#define RAYSHAPE(ro, rd)  raySphere4(ro, rd, 0.5)
#define IRAYSHAPE(ro, rd) iraySphere4(ro, rd, 0.5)

const float miss          = 1E4;
const float refrIndex     = 0.85;
const vec3  lightPos      = 2.0*vec3(1.5, 2.0, 1.0);
const vec3  skyCol1        = pow(vec3(0.2, 0.4, 0.6), vec3(0.25))*1.0;
const vec3  skyCol2        = pow(vec3(0.4, 0.7, 1.0), vec3(2.0))*1.0;
const vec3  sunCol         = vec3(8.0,7.0,6.0)/8.0;

float tanh_approx(float x) {
//  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}

// https://stackoverflow.com/questions/15095909/from-rgb-to-hsv-in-opengl-glsl
vec3 hsv2rgb(vec3 c) {
  const vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Various ray object intersection from IQ:
//  https://www.iquilezles.org/www/articles/intersectors/intersectors.htm
float raySphere4(vec3 ro, vec3 rd, float ra) {
    float r2 = ra*ra;
    vec3 d2 = rd*rd; vec3 d3 = d2*rd;
    vec3 o2 = ro*ro; vec3 o3 = o2*ro;
    float ka = 1.0/dot(d2,d2);
    float k3 = ka* dot(ro,d3);
    float k2 = ka* dot(o2,d2);
    float k1 = ka* dot(o3,rd);
    float k0 = ka*(dot(o2,o2) - r2*r2);
    float c2 = k2 - k3*k3;
    float c1 = k1 + 2.0*k3*k3*k3 - 3.0*k3*k2;
    float c0 = k0 - 3.0*k3*k3*k3*k3 + 6.0*k3*k3*k2 - 4.0*k3*k1;
    float p = c2*c2 + c0/3.0;
    float q = c2*c2*c2 - c2*c0 + c1*c1;
    float h = q*q - p*p*p;
    if (h<0.0) return miss; //no intersection
    float sh = sqrt(h);
    float s = sign(q+sh)*pow(abs(q+sh),1.0/3.0); // cuberoot
    float t = sign(q-sh)*pow(abs(q-sh),1.0/3.0); // cuberoot
    vec2  w = vec2( s+t,s-t );
    vec2  v = vec2( w.x+c2*4.0, w.y*sqrt(3.0) )*0.5;
    float r = length(v);
    return -abs(v.y)/sqrt(r+v.x) - c1/r - k3;
}

vec3 sphere4Normal(vec3 pos) {
  return normalize( pos*pos*pos );
}

float iraySphere4(vec3 ro, vec3 rd, float ra) {
  // Computes inner intersection by intersecting a reverse outer intersection
  vec3 rro = ro + rd*ra*4.0;
  vec3 rrd = -rd;
  float rt = raySphere4(rro, rrd, ra);

  if (rt == miss) return miss;
  
  vec3 rpos = rro + rrd*rt;
  return length(rpos - ro);
}

float rayPlane(vec3 ro, vec3 rd, vec4 p ) {
  return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}

vec3 skyColor(vec3 ro, vec3 rd) {
  const vec3 sunDir = normalize(lightPos);
  float sunDot = max(dot(rd, sunDir), 0.0);  
  vec3 final = vec3(0.);

  final += mix(skyCol1, skyCol2, rd.y);
  final += 0.5*sunCol*pow(sunDot, 20.0);
  final += 4.0*sunCol*pow(sunDot, 400.0);    

  float tp  = rayPlane(ro, rd, vec4(vec3(0.0, 1.0, 0.0), 0.505));
  if (tp > 0.0) {
    vec3 pos  = ro + tp*rd;
    vec3 ld   = normalize(lightPos - pos);
    float ts4 = RAYSHAPE(pos, ld);
    vec3 spos = pos + ld*ts4;
    float its4= IRAYSHAPE(spos, ld);
    // Extremely fake soft shadows
    float sha = ts4 == miss ? 1.0 : (1.0-1.0*tanh_approx(its4*1.5/(0.5+.5*ts4)));
    vec3 nor  = vec3(0.0, 1.0, 0.0);
    vec3 icol = 1.5*skyCol1 + 4.0*sunCol*sha*dot(-rd, nor);
    vec2 ppos = pos.xz*0.75;
    ppos = fract(ppos+0.5)-0.5;
    float pd  = min(abs(ppos.x), abs(ppos.y));
    vec3  pcol= mix(vec3(0.4), vec3(0.3), exp(-60.0*pd));

    vec3 col  = icol*pcol;
    col = clamp(col, 0.0, 1.25);
    float f   = exp(-10.0*(max(tp-10.0, 0.0) / 100.0));
    return mix(final, col , f);
  } else{
    return final;
  }
}

// Marble fractal from https://www.shadertoy.com/view/MtX3Ws
vec2 cmul(vec2 a, vec2 b) { 
  return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); 
}

vec2 csqr(vec2 a) { 
  return vec2(a.x*a.x - a.y*a.y, 2.*a.x*a.y); 
}

float marble_df(vec3 p) {  
  float res = 0.;

  vec3 c = p;
  float scale = 0.72;
  const int max_iter = 10;
  for (int i = 0; i < max_iter; ++i) {
    p    = scale*abs(p)/dot(p,p) - scale;
    p.yz = csqr(p.yz);
    p    = p.zxy;
    res  += exp(-19. * abs(dot(p,c)));
  }
  return res;
}

vec3 marble_march(vec3 ro, vec3 rd, vec2 tminmax) {
  float t   = tminmax.x;
  float dt  = 0.02;
  vec3 col  = vec3(0.0);
  float c   = 0.;
  const int max_iter = 64;
  for(int i = 0; i < max_iter; ++i) {
      t += dt*exp(-2.0*c);
      if(t>tminmax.y) { 
        break; 
      }
      vec3 pos = ro+t*rd;
        
      c = marble_df(ro+t*rd); 
      c *= 0.5;
        
      float dist = (abs(pos.x + pos.y-0.15))*10.0;
      vec3 dcol = vec3(c*c*c-c*dist, c*c-c, c);
      col = col + dcol;
  }    
  const float scale = 0.005;
  float td = (t - tminmax.x)/(tminmax.y - tminmax.x);
  col *= exp(-10.0*td);
  col *= scale;
  return col;
}

vec3 render1(vec3 ro, vec3 rd) {
  vec3 ipos = ro;
  vec3 ird  = rd;
  
  float its4  = IRAYSHAPE(ipos, ird);
  return marble_march(ipos, ird, vec2(0.0, its4));
}

vec3 render(vec3 ro, vec3 rd) {
  vec3 skyCol = skyColor(ro, rd);
  vec3 col = vec3(0.0);

  float t   = 1E6;
  float ts4 = RAYSHAPE(ro, rd);
  if (ts4 < miss) {
    t = ts4;
    vec3 pos  = ro + ts4*rd;
    vec3 nor  = sphere4Normal(pos);
    vec3 refr = refract(rd, nor, refrIndex);
    vec3 refl = reflect(rd, nor);
    vec3 rcol = skyColor(pos, refl);
    float fre = mix(0.0, 1.0, pow(1.0-dot(-rd, nor), 4.0));

    vec3 lv   = lightPos - pos;
    float ll2 = L2(lv);
    float ll  = sqrt(ll2);
    vec3 ld   = lv / ll;

    float dm  = min(1.0, 40.0/ll2);
    float dif = pow(max(dot(nor,ld),0.0), 8.0)*dm;
    float spe = pow(max(dot(reflect(-ld, nor), -rd), 0.), 100.);
    float l   = dif;

    float lin = mix(0.0, 1.0, l);
    const vec3 lcol = 2.0*sqrt(sunCol);
    col = render1(pos, refr);
    vec3 diff = hsv2rgb(vec3(0.7, fre, 0.075*lin))*lcol;
    col += fre*rcol+diff+spe*lcol;
    if (refr == vec3(0.0)) {
      // Not expected to happen as the refraction index < 1.0
      col = vec3(1.0, 0.0, 0.0);
    }
    
  } else {
    // Ray intersected sky
    return skyCol;
  }

  return col;
}

vec3 effect(vec2 p, vec2 q) { 
  vec3 ro = 0.6*vec3(2.0, 0, 0.2)+vec3(0.0, 0.75, 0.0);
  ro.xz *= ROT(PI/2.0+sin(TIME*0.05));
  ro.yz *= ROT(0.5+0.25*sin(TIME*0.05*sqrt(0.5))*0.5);

  vec3 ww = normalize(vec3(0.0, 0.0, 0.0) - ro);
  vec3 uu = normalize(cross( vec3(0.0,1.0,0.0), ww));
  vec3 vv = normalize(cross(ww,uu));
  float rdd = 2.0;
  vec3 rd = normalize( p.x*uu + p.y*vv + rdd*ww);

  vec3 col = render(ro, rd);
  return col;
}

vec3 postProcess(vec3 col, vec2 q) {
  col = clamp(col, 0.0, 1.0);
  col = pow(col, vec3(1.0/2.2));
  col = col*0.6+0.4*col*col*(3.0-2.0*col);
  col = mix(col, vec3(dot(col, vec3(0.33))), -0.4);
  col *=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 q = fragCoord/RESOLUTION.xy;
  vec2 p = -1. + 2. * q;
  p.x *= RESOLUTION.x/RESOLUTION.y;

  vec3 col = effect(p, q);
  col = postProcess(col, q);

  fragColor = vec4(col, 1.0);
}

