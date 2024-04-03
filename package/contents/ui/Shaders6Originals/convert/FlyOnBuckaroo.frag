// URL: https://www.shadertoy.com/view/3sSBDV
// By: blackle

//CC0 1.0 Universal https://creativecommons.org/publicdomain/zero/1.0/
//To the extent possible under law, Blackle Mori has waived all copyright and related or neighboring rights to this work.

vec3 erot(vec3 p, vec3 ax, float ro) {
  return mix(dot(ax,p)*ax, p, cos(ro))+sin(ro)*cross(ax,p);
}

float comp(vec3 p, vec3 ax, float ro) {
  
  p = erot(p,ax,ro);
  p = asin(sin(p));
  return length(p)-1.;
}

float cloudssdf(vec3 p) {
  p.y += iTime*.2;
  float d1 = comp(p, normalize(vec3(1,2,5)), 0.5);
  p.y += iTime*.2;
  float d3 = comp(p*2., normalize(vec3(3,1,1)), 2.5)/2.;
  p.y += iTime*.2;
  float d4 = comp(p*3., normalize(vec3(4,-2,5)), 3.5)/3.;
  return (d1+d3+d4)/3.;
}

float linedist (vec3 p, vec3 a, vec3 b) {
  float k = dot(p-a,b-a)/dot(b-a,b-a);
  return distance(p,mix(a,b,clamp(k,0.,1.)));
}

float body;
float beamm;
float scene(vec3 p) {
  p.z += sin(iTime);
  p = erot(p, vec3(0,1,0), cos(iTime)*.2);
  beamm = 0.9*(linedist(p, vec3(0), vec3(0,0,-10))-.3-sin(p.z*3.+iTime*4.)*.05 - sin(iTime)*.2);
  vec3 p2 =p;
  p2.z = sqrt(p2.z*p2.z+0.02);
  p2.z+=3.;
  body = length(p2)-3.8;
  body += smoothstep(0.8,1.,sin(atan(p2.x,p2.y)*10.))*.02;
  body += smoothstep(0.8,1.,sin(atan(p2.x,p2.y)*45.))*.003;
  float hat = length(p-vec3(0,0,0.8))-0.7;
  return min(min(body,hat), beamm);
}
float bpm = 125.;
float eye;
float buckaroo(vec3 p) {
  float bpmt = iTime/60.*bpm;
  float t = pow(sin(fract(bpmt)*3.14/2.), 20.);
  p.z += sin(iTime);
  p = erot(p, vec3(0,1,0), cos(iTime)*.2);
  p-=vec3(0,0,0.9);
  p.z += t*.1;
  p.x = abs(p.x);
  float b =  length(p)-0.2;
  b = min(b, linedist(p, vec3(0), vec3(.3,0,.3))-.04);
  b = min(b, length(p-vec3(.3,0,.3))-.07);
  b = min(b, linedist(p, vec3(0), vec3(0,0,-.5))-.15);
  eye = length(p-vec3(.1,.18,.0))-.03;
  return min(b, eye);
}

vec3 norm(vec3 p) {
  mat3 k = mat3(p,p,p)-mat3(0.01);
  return normalize(scene(p)-vec3(scene(k[0]), scene(k[1]), scene(k[2])));
}

vec3 norm2(vec3 p) {
  mat3 k = mat3(p,p,p)-mat3(0.01);
  return normalize(buckaroo(p)-vec3(buckaroo(k[0]), buckaroo(k[1]), buckaroo(k[2])));
}

vec3 srgb(float r, float g, float b) {
  return vec3(r*r,g*g,b*b);
}

vec3 clouds(inout vec3 p, vec3 cam, vec3 init, int depth) {
  p = init;
  for (int i = 0; i < depth; i++) {
    float dist = min(scene(p),cloudssdf(p));
    dist = sqrt(dist*dist+0.05);
    p += dist*cam;
  }
  float f1 = length(sin(p)*.5+.5)/sqrt(3.);
  float f2 = smoothstep(0., 30., distance(p,init));
  vec3 sun = max(0.,dot(vec3(1./sqrt(3.)), cam))*vec3(1);
  sun = pow(sun,vec3(9)) + pow(sun,vec3(4))*srgb(0.7,0.5,0.2);
  return mix(srgb(0.2,0.3,0.7), srgb(0.8,0.3,0.3), f1) + mix(srgb(0.2,0.4,0.7), srgb(0.7,0.7,0.7), f2) + sun;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;

  vec3 cam = normalize(vec3(1,uv));
  
  float bpmt = iTime/60.*bpm;
  float t = mix(floor(bpmt) + pow(sin(fract(bpmt)*3.14/2.), 20.), bpmt, 0.8);
  vec3 init = vec3(-8.+sin(t)*2.,0,0.1);
  cam = erot(cam, vec3(0,0,1), t*.2);
  init = erot(init, vec3(0,0,1), t*.2);
  vec3 clp;
  vec3 p = init;
  bool hit = false;
  float dist;
  float glow = 0.;
  for (int i = 0; i < 120 && !hit; i++) {
    dist = scene(p);
    if (!isnan(beamm)) glow += .5/(1.+beamm*100.);
    hit = dist*dist < 1e-6;
    p+=dist*cam;
    if(distance(p,init)>20.)break;
  }
  glow = min(glow,1.);
  bool bdy = (dist == body);
  vec3 n = norm(p);
  vec3 obj = hit ? sin(n)*.5+.5 : vec3(0);
  vec3 clds = clouds(clp, cam, init, 20);
  if (hit) {
    vec3 p2 = p+n*.1;
    float ao = smoothstep(-.1,.1,scene(p2));
    vec3 r = reflect(cam,n);
    float fres = 1.-abs(dot(cam,n))*.5;
    obj = clouds(p2, r, p2, 10)*fres*ao;
    if (!bdy) {
      p2 = p+cam;
      r = refract(cam,n,1.1);
      vec3 p5 = p;
      bool hhit = false;
      float bb;
      for (int i = 0; i < 50 && !hhit; i++) {
        bb = buckaroo(p5);
        hhit = bb*bb< 1e-6;
        p5+=bb*r;
        if(distance(p5,p)>2.)break;
      }
      bool ey = eye==bb;
      if (hhit) {
        vec3 n5 = norm2(p5);
        float fk = length(sin(n5*2.)*.5+.5)/sqrt(3.);
        obj = fk*(ey ? srgb(0.1,0.1,0.1) : srgb(0.3,0.75,0.3)) + obj*.5;
      } else {
      	obj = obj*.5 + clouds(p2, r, p2, 20)*.9;
      }
    }
  }
  obj = obj  + srgb(0.2,0.4,0.6)*glow;
  float fctr = smoothstep(-3.,1., distance(clp,init)-distance(p,init));
  fragColor.xyz = mix(clds, obj, fctr) + glow*glow*.9*sqrt(fctr*.5+.5);
  fragColor.xyz = sqrt(fragColor.xyz);
  fragColor.xyz = abs(erot(fragColor.xyz, normalize(sin(clp*.3+t)), 0.2));
}
