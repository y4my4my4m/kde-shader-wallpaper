// From https://www.shadertoy.com/view/mtVSDy
// Credits to mrange

// CC0: Computers were made for cubes



#define TIME            iTime
#define RESOLUTION      iResolution

#define PI              3.141592654
#define TAU             (2.0*PI)

#define TOLERANCE       0.0001
#define MAX_RAY_LENGTH  22.0
#define MAX_RAY_MARCHES 70
#define NORM_OFF        0.001
#define ROT(a)          mat2(cos(a), sin(a), -sin(a), cos(a))

// License: WTFPL, author: sam hocevar, found: https://stackoverflow.com/a/17897228/418488
const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}
// License: WTFPL, author: sam hocevar, found: https://stackoverflow.com/a/17897228/418488
//  Macro version of above to enable compile-time constants
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))

const float hoff      = 0.0;
const vec3 skyCol     = HSV2RGB(vec3(hoff+0.57, 0.70, 0.25));
const vec3 glowCol0   = HSV2RGB(vec3(hoff+0.05, 0.85, 0.00125));
const vec3 glowCol1   = HSV2RGB(vec3(hoff+0.55, 0.85, 0.05));
const vec3 sunCol1    = HSV2RGB(vec3(hoff+0.60, 0.50, 0.5));
const vec3 sunCol2    = HSV2RGB(vec3(hoff+0.05, 0.75, 25.0));
const vec3 diffCol    = HSV2RGB(vec3(hoff+0.60, 0.75, 0.25));
const vec3 sunDir1    = normalize(vec3(3., 3.0, -7.0));

// License: Unknown, author: Matt Taylor (https://github.com/64), found: https://64.github.io/tonemapping/
vec3 aces_approx(vec3 v) {
  v = max(v, 0.0);
  v *= 0.6f;
  float a = 2.51f;
  float b = 0.03f;
  float c = 2.43f;
  float d = 0.59f;
  float e = 0.14f;
  return clamp((v*(a*v+b))/(v*(c*v+d)+e), 0.0f, 1.0f);
}

mat3 rotX(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(
    1.0 , 0.0 , 0.0
  , 0.0 , +c  , +s
  , 0.0 , -s  , +c
  );
}

mat3 rotY(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(
    +c  , 0.0 , +s
  , 0.0 , 1.0 , 0.0
  , -s  , 0.0 , +c
  );
}

mat3 rotZ(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(
    +c  , +s  , 0.0
  , -s  , +c  , 0.0
  , 0.0 , 0.0 , 1.0
  );
}

// License: Unknown, author: Unknown, found: shadertoy somewhere, don't remember where
float dfcos(float x) {
  return sqrt(x*x+1.0)*0.8-1.8;
}

// License: Unknown, author: Unknown, found: shadertoy somewhere, don't remember where
float dfcos(vec2 p, float freq) {
  // Approximate distance to cos
  float x = p.x;
  float y = p.y;
  x *= freq;

  float x1 = abs(mod(x+PI,TAU)-PI);
  float x2 = abs(mod(x   ,TAU)-PI);

  float a = 0.18*freq;

  x1 /= max( y*a+1.0-a,1.0);
  x2 /= max(-y*a+1.0-a,1.0);
  return (mix(-dfcos(x2)-1.0,dfcos(x1)+1.0,clamp(y*0.5+0.5,0.0,1.0)))/max(freq*0.8,1.0)+max(abs(y)-1.0,0.0)*sign(y);
}

float rayPlane(vec3 ro, vec3 rd, vec4 p) {
  return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
float box(vec2 p, vec2 b) {
  vec2 d = abs(p)-b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/distfunctions/
float box(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/distfunctions/
float boxf(vec3 p, vec3 b, float e) {
       p = abs(p  )-b;
  vec3 q = abs(p+e)-e;
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
float segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

// License: MIT, author: Inigo Quilez, found: https://www.iquilezles.org/www/articles/smin/smin.htm
float pmin(float a, float b, float k) {
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float pmax(float a, float b, float k) {
  return -pmin(-a, -b, k);
}

float lug00ber(vec2 p) {
  vec2 p0 = p;
  p0.y = abs(p0.y);
  p0 -= vec2(-0.705, 0.41);
  float d0 = length(p0)-0.16;
  
  float topy = 0.68;
  vec2 bp = p-vec2(0.27, -0.8);
  float d1 = segment(p, vec2(0.72, topy), vec2(0.27, -0.8))-0.06;
  float d2 = segment(p, vec2(-0.13, topy), vec2(0.33, -0.8))-0.1;
  float d3 = p.y-(topy-0.066);

  float d4 = box(p-vec2(-0.1, topy), vec2(0.25, 0.03))-0.01;
  float d5 = box(p-vec2(0.685, topy), vec2(0.19, 0.03))-0.01;
  float d6 = min(d4, d5);
  
  vec2 ax7 = normalize(vec2(vec2(0.72, topy)-vec2(0.27, -0.8)));
  vec2 nor7 = vec2(ax7.y, -ax7.x);
  float d7 = dot(p, nor7)+dot(nor7, -vec2(vec2(0.72, topy)))+0.05;
  
  d2 = max(d2, d7);
  float d = d1;
  d = pmin(d,d2, 0.025);
  d = max(d, d3);
  d = pmin(d, d6, 0.1);
  d = min(d,d0);
  
  return d; 
}

mat3 g_rot;
float g_gd;

float df(vec3 p) {
  vec3 p0 = p;
  p0 *= g_rot;
  float d0 = box(p0, vec3(3.0));
  vec3 p1 = p0;
  float d1 = boxf(p1, vec3(3.01), 0.)-0.01;

  float d = d0;
//  d = max(d, -(d1-0.03));
  d = min(d, d1);
  
  g_gd = min(g_gd, abs(d1));

  return d;
}

vec3 normal(vec3 pos) {
  vec2  eps = vec2(NORM_OFF,0.0);
  vec3 nor;
  nor.x = df(pos+eps.xyy) - df(pos-eps.xyy);
  nor.y = df(pos+eps.yxy) - df(pos-eps.yxy);
  nor.z = df(pos+eps.yyx) - df(pos-eps.yyx);
  return normalize(nor);
}

float rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  const float tol = TOLERANCE;
  vec2 dti = vec2(1e10,0.0);
  int i = 0;
  for (i = 0; i < MAX_RAY_MARCHES; ++i) {
    float d = df(ro + rd*t);
    if (d<dti.x) { dti=vec2(d,t); }
    if (d < TOLERANCE || t > MAX_RAY_LENGTH) {
      break;
    }
    t += d;
  }
//  if(i==MAX_RAY_MARCHES) { t=dti.y; };
  return t;
}

vec3 render0(vec3 ro, vec3 rd) {
  vec3 col = vec3(0.0);
  float sd = max(dot(sunDir1, rd), 0.0);
  float sf = 1.0001-sd;


  col += clamp(vec3(1.0/abs(rd.y))*glowCol0, 0.0, 1.0);
  col += 0.75*skyCol*pow((1.0-abs(rd.y)), 8.0);
  col += 2.0*sunCol1*pow(sd, 100.0);
  col += sunCol2*pow(sd, 800.0);

  float tp1  = rayPlane(ro, rd, vec4(vec3(0.0, -1.0, 0.0), -6.0));

  if (tp1 > 0.0) {
    vec3 pos  = ro + tp1*rd;
    vec2 pp = pos.xz;
    float db = box(pp, vec2(5.0, 9.0))-3.0;
    
    col += vec3(4.0)*skyCol*rd.y*rd.y*smoothstep(0.25, 0.0, db);
    col += vec3(0.8)*skyCol*exp(-0.5*max(db, 0.0));
    col += 0.25*sqrt(skyCol)*max(-db, 0.0);
  }

  return clamp(col, 0.0, 10.0);
}

vec3 render1(vec3 ro, vec3 rd, vec2 sp) {
  int iter;

  g_gd = 1E3;
  float t = rayMarch(ro, rd);
  vec3 ggcol = (glowCol1)*inversesqrt(max(g_gd, 0.00025));
  vec3 col = render0(ro, rd);

  vec3 p = ro+rd*t;
  vec3 n = normal(p);
  vec3 r = reflect(rd, n);
  float fre0 = 1.0+dot(rd, n);
  float fre = fre0;
  fre *= fre;
  float dif = dot(sunDir1, n); 

  if (t < MAX_RAY_LENGTH) {
    col = vec3(0.0);
    col += sunCol1*dif*dif*diffCol*0.25;
    col += mix(0.33, 1.0, fre)*render0(p, r);
  }
  
  col *= smoothstep(0.1, -0.1, cos((TAU*TIME-2.0*sp.y)/30.0));
  col += clamp(ggcol, 0.0, 4.0);

  return col;
}

vec3 overlay(vec3 col, vec2 p) {
  vec2 p0 = p;
  float dl = lug00ber(p);

  const float z1 = 0.25;
  vec2 p1 = p;
  p1.x += 0.1*TIME;
  p1 /= z1;
  float dc = dfcos(p1, 0.5)*z1;
  dc = abs(dc)- mix(0.025, 0.00, smoothstep(0., 2.0, abs(p.x)));
  float aa = 4.0/RESOLUTION.y;
  
  float d = dl;
  d = pmax(d, -(dc-0.025), 0.025);
  d = min(d, dc);
  
  col = mix(col, vec3(1.0), smoothstep(0.0, -aa, d));
  return col;
}

vec3 effect(vec2 p, vec2 pp) {
  float tm  = TIME*0.5+10.0;
  
  g_rot = rotX(0.333*tm)*rotZ(0.5*tm)*rotY(0.23*tm);
  
  vec3 ro = 2.0*vec3(5.0, 1.0, 0.);
  ro.xz *= ROT(-0.1*tm);
  const vec3 la = vec3(0.0, 0.0, 0.0);
  const vec3 up = normalize(vec3(0.0, 1.0, 0.0));

  vec3 ww = normalize(la - ro);
  vec3 uu = normalize(cross(up, ww ));
  vec3 vv = (cross(ww,uu));
  const float fov = tan(TAU/6.);
  vec3 rd = normalize(-p.x*uu + p.y*vv + fov*ww);

  vec3 col = render1(ro, rd, p);
  col -= 0.05*length(pp);
  col *= smoothstep(1.5, 0.5, length(pp));

  col = aces_approx(col); 
  col *= smoothstep(2.0, 6.0, TIME);
  col = overlay(col, p);
  col = sqrt(col);
  
  return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 q = fragCoord/RESOLUTION.xy;
  vec2 p = -1. + 2. * q;
  vec2 pp = p;
  p.x *= RESOLUTION.x/RESOLUTION.y;
  vec3 col = vec3(0.0);
  col = effect(p, pp);
  fragColor = vec4(col, 1.0);
}
