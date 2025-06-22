// ----------------------------------------------
// CC0: Phosphorescent Purple Pixel Peaks
// ----------------------------------------------
//  `----- - --- ---------?\___/?\/zS!?\___/?\/-o
//                mrange & virgill              |
//  `----- - --- ------ -----\___/?\/!?\___/?\/-o
//                                              |
//   release: Phosphorescent Purple Pixel Peaks |
//      type: Windows 4k intro                  |
//      date: 17.02.2024                        |
//     party: Mountainbytes 2024                |
//                                              |
//                                              |
//  code: mrange                                |
//  music: Virgill                              |
//                                              |
//                                              |
// mrange - So, in this release, I set out to   |
// whip up a terrain marcher in a snug 4KiB     |
// space. Started with your usual terrain,      |
// thinking, "Let's give it a synthwave twist." |
// Now, my previous attempts at a synthwave-    |
// style terrain marcher were kinda meh, but    |
// guess what? Lightning struck, and I managed  |
// to sculpt some visually pleasing mountains.  |
//                                              |
// They're not a perfect match for the synthwave|
// vibe, but hey, check out these transparent,  |
// glowing ice cream peaks. Cool, right?        |
//                                              |
// Big shoutout to Virgill for dropping another |
// killer tune that totally catches the vibe.   |
// Sadly, we had to ditch some funky sound      |
// effects this time around—blame it on the     |
// space crunch. Fingers crossed, next time,    |
// we'll pack in the funk.                      |
//                                              |
// Oh, and a quick nod to sointu by our main    |
// man Pestis. This nifty tool churns out tunes |
// that sound fantastic, and even a music novice|
// like me could tinker around with its         |
// user-friendly tracker.                       |
//                                              |
// We're banking on you having a blast with our |
// creation, hoping it dishes out that feel-good|
// synthwave goodness. Cheers!                  |
//                                              |
//                                         _  .:!
//  <----- ----- -  -   -     - ----- ----\/----'

#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    float iTimeDelta;
    float iFrameRate;
    float iSampleRate;
    int iFrame;
    vec4 iDate;
    vec4 iMouse;
    vec3 iResolution;
    float iChannelTime[4];
    vec3 iChannelResolution[4];
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;
layout(binding = 1) uniform sampler2D iChannel1;
layout(binding = 1) uniform sampler2D iChannel2;
layout(binding = 1) uniform sampler2D iChannel3;

vec2 fragCoord = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * ubuf.iResolution.xy;




#define TIME        ubuf.iTime
#define RESOLUTION  ubuf.iResolution

const float 
  pi        = acos(-1.)
;

const vec3 
  Units     = vec3(0, 1, 1E-2)
;

mat2 rot(float a) {
  float c=cos(a),s=sin(a);
  return mat2(c,s,-s,c);
}

// License: Unknown, author: Unknown, found: don't remember
float hash2(vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,58.233))) * 13758.5453);
}


// License: MIT, author: Inigo Quilez, found: https://www.shadertoy.com/view/lsf3WH
//  Value noise function
float vnoise(vec2 p) {
 vec2 i = floor(p);
 vec2 f = fract(p);
    
 vec2 u = f*f*(3.-2.*f);

 float a = hash2(i);
 float b = hash2(i+Units.yx);
 float c = hash2(i+Units.xy);
 float d = hash2(i+Units.yy);
   
 float m0 = mix(a, b, u.x);
 float m1 = mix(c, d, u.x);
 float m2 = mix(m0, m1, u.y);
    
 return m2;
}


// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/fbm/
//  Scales and rotates and aggregates multiple layers of value noise
//  to create something that looks like mountains
vec3 fbm(vec2 p, int ii) {
  vec2 np = p;
  vec2 cp = p;
  float nh = 0.0;
  float na = 1.0;
  float ns = 0.0;
  for (int i = 0; i < ii; ++i) {
    nh += na*vnoise(np);
    np += 123.4;
    np *= 2.11*rot(1.);
    ns += na;
    na *= 0.5;
  }
  
  nh /= ns;

  return vec3(nh);
}

#define IDONTLIKETHEFLASHING

#define hifbm iChannel0
#define lofbm iChannel1

const float 
  tau       = 2.*pi
, max_dist  = 14.
, near_dist = 10.
, tolerance = 1E-3
, eps1      = 1E-1
, path_a    = .2
, path_b    = 3.
, minh      = .5
, maxh      = 2.5
, wl        = .3
, innerAdj  = .25
, ch        = .0175
, ibpm      = 6./9.
, per       = 32.*ibpm
, stp       = 66.
, lp        = .33*tau/stp
, fof       = log(20.)
, rnd       = 123.4
, period    = 92.
;

const vec3
  sunCol0    = vec3(.3  , .1 , 1)
, sunCol1    = vec3(.1  , .7 , 1)
, gridCol0   = vec3(.8  , .1 , 1)
, gridCol1   = vec3(.1  , .5 , 1)
, roadGlow   = vec3(1   , .3 , .2)*2E-5
, bikeFlash  = vec3(.5  , .1 , .2)*5E-4
, skyCol     = gridCol0/3.
, innerGlow  = sunCol1*8.
, absorbCol  = -4.*vec3(.5, 2., 1.)
, sunDir     = normalize(vec3(0., .2, -1.))
, upDir      = Units.xyx
;

const vec4 
  planet = vec4(1.25,.5,-1,.45)*1E5
;
  
const int
  lo_max_iter = 10
, hi_max_iter = 90
;

float g_time;
float g_beat;
float g_part;

vec2 segment(vec2 p) {
  float d0 = length(p);
  return vec2(p.y>0.?d0:abs(p.x), d0);
}

// License: MIT, author: Inigo Quilez, found: https://www.iquilezles.org/www/articles/spherefunctions/spherefunctions.htm
float raySphere(vec3 ro, vec3 rd, vec4 sph) {
  vec3 oc = ro - sph.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - sph.w*sph.w;
  float h = b*b - c;
  return h>0. ? -b - sqrt(h) :  -1.;
}

// Camera path
vec3 cam_path(float z) {
  return vec3(sin(z*path_a)*path_b, 1.-.4*cos(z*lp), -z);
}

// Derivate of Camera path, used to determine which direction camera points in
vec3 dcam_path(float z) {
  return (cam_path(z+eps1) - cam_path(z-eps1))/(2.*eps1);
}

// Derivate of Derivate of Camera path, used to determine camera tilt
vec3 ddcam_path(float z) {
  return (dcam_path(z+eps1) - dcam_path(z-eps1))/(2.*eps1); 
}

// License: Unknown, author: Unknown, found: don't remember
float hash1(float co) {
  return fract(sin(co*12.9898) * 13758.5453);
}

// Diffuse lighting
float dif(vec3 n, vec3 ld) {
  return max(dot(n, ld),0.);
}

// Fake fresnel effect (more reflective at "edges")
float fre(vec3 rd, vec3 n, float pwr) {
  return pow(1.+dot(rd,n), pwr);
}

// License: MIT OR CC-BY-NC-4.0, author: mercury, found: https://mercury.sexy/hg_sdf/
float mod1(inout float p, float size) {
  float halfsize = .5*size;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize, size) - halfsize;
  return c;
}


// License: MIT, author: Inigo Quilez, found: https://www.iquilezles.org/www/articles/smin/smin.htm
//  Soft max function, used in the sun for example to round the edges
float pmax(float a, float b, float k) {
  float h = clamp(.5+.5*(a-b)/k, 0., 1.);
  return mix(b, a, h) + k*h*(1.-h);
}

// Height function for mountains
float hf(sampler2D sampler, vec2 p) {
  vec3 cam = cam_path(p.y);
  float f = abs(cam.x+p.x);
  // Global height function
  float g = mix(minh, maxh*(.5-.5*cos(lp*p.y)), smoothstep(.3, 2.-.5*sin(lp*p.y), f));
  p *= .125;
  p += .5;
  vec2 n = fract(.5*floor(p));
  p = fract(p);
  p.x = n.x == 0. ? p.x : 1.-p.x;
  p.y = n.y == 0. ? p.y : 1.-p.y;
  // Combine global height function and mountain FBM
  return mix(wl-1E-2, g*texture(sampler, p).x, g_part > 1. ?smoothstep(.06, .12, f) : 1.);
}

// Raymarches against height function
float rayMarch(sampler2D sampler, vec3 ro, vec3 rd, int maxi, float initt, float yadj, float sgn, float wlt) {
  float t = initt;
  float stp = .9;
  float lastt;

  int i;

  for (i = 0; i < maxi; ++i) {
    if (t > max_dist) {
      break;
    }
    vec3 p = ro+rd*t;
    if (p.y < wl) {
      return wlt;
    }

    float h = hf(sampler, p.xz)-yadj;
    float d = sgn*(p.y - h);

    if (d < tolerance) {
      // If we have an intercept we just step back a bit and tries again
      //  To reduce the potentiel overshoots
      if (stp >= .125) {
        stp *= .5;
        t = lastt;
      } else {
        break;
      }
    }
    lastt = t;

    t += max(stp*d, tolerance);
  }

  return t;
}

vec3 normal(sampler2D sampler, vec2 p) {
   return normalize(vec3(
      hf(sampler, p - Units.zx) - hf(sampler, p + Units.zx)
    , 2.*Units.z
    , hf(sampler, p - Units.xz) - hf(sampler, p + Units.xz)
   ));
}

float lorayMarch(vec3 ro, vec3 rd, float initt, float yadj, float sgn, float wlt) {
  return rayMarch(lofbm, ro, rd, lo_max_iter, initt, yadj, sgn, wlt);
}

vec3 lonormal(vec2 p) {
  return normal(lofbm, p);
}

float hirayMarch(vec3 ro, vec3 rd, float initt, float wlt) {
  return rayMarch(hifbm, ro, rd, hi_max_iter, initt, 0., 1., wlt);
}

vec3 hinormal(vec2 p) {
  return normal(hifbm, p);
}

float sun(vec2 p) {
  p.y += -.2;
  float d0 = length(p) - .5;
  float d2 = p.y;
  mod1(p.y, ch*6.);
  float d1 = abs(p.y) -  ch;
  return pmax(d0, -max(d1, d2), ch);
}

// The sky
vec3 skyRender(vec3 ro, vec3 rd) {
  vec2 sp   = rd.xy*2.;
  float ds = sun(sp);

  vec3 bscol = mix(sunCol0, sunCol1, clamp(1.4*sp.y, 0., 1.));
  bscol*=sqrt(bscol*2.);

  // The Sun
  vec3 col = 1E-2/max(abs(ds), 1E-2)*bscol;
  col += bscol*smoothstep(3E-3, 0.0, ds);

  float gd = rd.y+5E-3;

  float t = 1.;
  if (g_part > 2.) {
      // The City
      col += 1E-3/max(abs(sp.x*(sp.y*sp.y+1.)), 2E-3)*(0.5+2.*g_beat)*sunCol1;
      for (float i = 0.; i < 4.; ++i) {
        vec2 cp = sp;
        cp *= 1.+.1*i;
        float cn = mod1(cp.x, .015);
        float ch = hash1(cn+rnd*i)*smoothstep(32., 4., abs(cn));
        t = min(t, mix((i+1.)*.125, 1., step(.2*ch, cp.y)));
      }
    col *= t;
  }

  float 
    si = raySphere(ro, rd, planet)
  ;
  
  vec3 
    spos = ro+rd*si
  , sn = normalize(spos-planet.xyz+Units.xyx*5E3*sin(1E3*spos.y/1E5))
  , sr = reflect(rd, sn)
  ;

  if (si > 0.) {
    // The Planet
    float 
        sdif = dif(sn, sunDir)
      , sspe = 4.*pow(dif(sr, sunDir), 80.)*fre(rd, sn, 4.)
      ;
    col = sunCol0*sdif+sunCol1*sspe;
  }
  
  float at = g_time-48.;
  if (at > 0.) {
    // The Rocket
    vec2 rp = rd.xy-vec2(-.4-.2*rd.y*rd.y, 5E-3*(at*at-1.));
    vec2 dr = segment(rp);
    float rfo = smoothstep(.4, .0, dr.y);
    col += 1E-3*(sunCol0)/max(abs(dr.x), 2E-4*(2.-rfo))*rfo;
    col += 3E-3*sunCol1/abs(dr.y)*hash1(floor(g_time*20.));
  }

  col *= step(0., gd);
  // The horizon
  col += 1E-2/max(sqrt(abs(gd))*(75E-2*rd.x*rd.x+75E-4), 5E-4*(1.+30.*rd.x*rd.x))*(1.+.5*g_beat)*skyCol;
   
  return col;
}

// The ground
vec3 groundRender(vec3 rd, vec3 pp, float pt) {
  
  float 
      gfre  = fre(rd, upDir, 1.)
    , rp    = pp.x
    ;
  rp += cam_path(pp.z).x;    

  // The grid
  vec2 ggp    = pp.xz;
  float gcf   = .5+.5*(sin(ggp.x)*sin(ggp.y));
  ggp         *= 3.;
  ggp         -= round(ggp);
  ggp         = abs(ggp);  
  float ggd   = min(ggp.x, ggp.y) ;

  vec3 gcol = mix(gridCol0, gridCol1, gcf);
  gcol *= sqrt(gcol)*1E-2;

  float fo = exp(-.5*max(pt-2., 0.));
  float sm = .025*smoothstep(.6, 1., gfre)+1E-3;
  float bp = abs(rp)-5E-2;
  float cp = abs(rp)-25E-3;
  float cs = sign(rp);

  vec3 pcol = gcol/max(ggd, sm);
  sm *= 1E-4;
  if (g_part > 1.) {
    // The road
    pcol *= step(0., bp);
    pcol += roadGlow/max((rp*rp), sm)*smoothstep(.25, .5, sin(20.*pp.z));
    pcol += .25/max(bp*bp, sm)*roadGlow;
  }

  float off = pp.z+g_time*3.;
  float noff = mod1(off, 10.);
  float hoff = hash1(noff);
  float ht = hash1(floor(g_time*10.));
  off += 3.*cs*(hoff-.5);
  
  vec2 cp2 = vec2(cp,off);
  if (g_part > 2.) {
    // The motorbikes
    pcol += step(0., off)/max(cp*cp, sm)*smoothstep(2., 0., off)*(cs > 0. ? roadGlow.xzy : roadGlow.zyx)*.25;
    pcol += ht*ht/max(dot(cp2, cp2), sm)*bikeFlash;
  }
  pcol *= fo;
  return pcol;
}

vec3 sceneRender(vec3 ro, vec3 rd) {
  vec3 sky = skyRender(ro, rd);

  float pt = -(ro.y-wl)/rd.y;
  // Intersect the mountains
  float gt = hirayMarch(ro, rd, 1E-2, pt);

  vec3 col = vec3(0);

  float ft = max(gt-near_dist, 0.)/(max_dist-near_dist);
  float fm = exp(-ft*fof);

  vec3 gp = ro+rd*gt;
  vec3 gn = hinormal(gp.xz);
  vec3 sn = lonormal(gp.xz);
  float sdif = dif(sn, sunDir);
  if (pt > 0. && pt <= gt) {
    // Hit the ground
    vec3 pp = ro+pt*rd;
    vec3 pr = reflect(rd, upDir);
    float pfre = fre(rd, upDir, 2.);
    // To find the reflection
    float pgt = hirayMarch(pp, pr, 5E-2, max_dist); 
  
    if (pgt < max_dist) {
      pfre *= .125*smoothstep(2., 4., pgt);
    }

    // The ground
    col = groundRender(rd, pp, pt);
    // The reflection
    col += skyRender(pp, pr)*pfre;
  } else if (gt < max_dist) {
    // The mountains
    vec3 gr = reflect(rd, gn);
    vec3 grr = refract(rd, gn, 1.-.025);
    vec3 sr = reflect(rd, sn);

    // Ray march the inner mountains
    float nlt = lorayMarch(gp, grr, eps1, innerAdj, 1., max_dist);
    float rpt = -(gp.y-wl)/grr.y;

    // Compute inner grid
    vec3 rpp = gp+grr*rpt;
    vec3 groundCol = groundRender(grr, rpp, rpt+gt); 
    vec3 nlp = gp+grr*nlt;

    float gfre = fre(rd, gn, 8.);
    float sfre = fre(rd, sn, 2.);

    float sspe = pow(dif(sr, sunDir), 40.);
    float gspe = pow(dif(gr, sunDir), 100.);
    if (gp.y > mix(.2, .5, .5+.5*sin(gp.z+1.23*gp.x))+.6/max(sqrt(gn.y), .1)) {
      // The snow
      col += sfre*sspe;
      col += sfre*gspe;
      col += sdif*sqrt(sunCol1);
      col += -.125*abs(sn.x*sn.y);
      col += sqrt(skyCol)/sn.y;
    } else {
      if (rpt > 0.) {
        // The inner grid
        col += .5*exp(rpt*absorbCol)*groundCol;
      }

      if (nlt < max_dist) {
        // Raymarch through the inner mountain
        float flt = lorayMarch(nlp, grr, 5E-2, innerAdj, -1., max_dist);
        if (flt >= max_dist) {
          flt = rpt-nlt;
        }
        
        // The inner glow
        col = mix(col, innerGlow*exp((1.5-.5*g_beat)*nlt*absorbCol), exp(.25*flt)-1.);
      }
      col += gfre*.5*skyRender(gp, gr);
    }
  } else {
    // Sky
    col = sky;
  }

  // Apply glow
  col = mix(sky, col, fm);

  return col;
}

vec3 effect(vec2 p) {
  g_time = mod(TIME, period);
  float lt = g_time + .25*ibpm;
  float ct = mod(lt, per);
  float nt = floor(lt/per);
  g_part   = nt;
  // Beats that control mountain and city flashes
  g_beat   = exp(-2.*mod(ct+ibpm, 2.*ibpm))*mod(nt, 2.);

  float pt  = ct+stp*nt;
  vec3 ro   = cam_path(pt);
  vec3 dro  = dcam_path(pt);
  vec3 ddro = ddcam_path(pt);
  dro.zy *= rot(-.11);

  vec3 ww = normalize(dro);
  vec3 uu = normalize(cross(upDir+2.*ddro, ww));
  vec3 vv = cross(ww, uu);
  vec3 rd = normalize(p.x*uu + p.y*vv + 2.*ww);

  vec3 col = sceneRender(ro, rd);
  // Go black if beyond last part
  col *= g_part < 4. ? 1. : 0.;
  float sf = 4.*dot(sunDir, rd);

#ifdef IDONTLIKETHEFLASHING
  col *= 1.0-exp(-4.*ct);
  float ft = ct - 31.75*ibpm;
  if (ft > 0.)
    col *= exp(-16.*ft);
#else
  col += sf*exp(-6.*ct)*sunCol1;
  float ft = ct - 31.75*ibpm;
  if (ft > 0.)
    col += sf*exp(-16.*ft)*sunCol1;
#endif
  col = tanh(col)-3E-2*(length(p)+.125);
  // Fade in
  col *= smoothstep(0., .25*per, g_time-4.+sf);
  col *= 1.25;
  col = sqrt(col);
  return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord) {
  vec2 q = fragCoord/RESOLUTION.xy;
  vec2 p = -1.+2.*q;
  p.x *= RESOLUTION.x/RESOLUTION.y;
  vec3 col = effect(p);
  fragColor = vec4(col,1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
