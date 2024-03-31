// url: https://www.shadertoy.com/view/NljfzV
// credits: morimea


// Created by Danil (2022+) https://github.com/danilw
// License - CC0 or use as you wish


// main point of this shader is - fractal that generate different image depends of parameters
// look map function



// to play with parameters and use Mouse control
//#define use_func 5


// to test animation loop with mouse
//#define mouse_loop


#define cam_orbit 2.05

// params
#define psz 8

// scale
float p0[psz] = float[]( 0.7, 0.7, 0.7, 0.7, 0.57, 0.697, .09, 2.57);


// biggest visual impact 
float p1[psz] = float[]( 0.07,  0.07, -0.107, -0.07, -0.69,  -0.69,   -0.1069,  -0.69);

float p2[psz] = float[](-0.15, -0.15,  1.84,  -0.15, -0.015,  0.015,  -0.02015, -0.015);

float p3[psz] = float[]( 0.465, 0.184, 0.465,  0.465, 0.2465, 0.1465,  1.465,    0.2465);


// number of loops, keep low (clamped to 1 to 30 to not kill your GPU)
int p5[psz] = int[](5,5,10,5,5,5,10,5);



// main fractal func
float map(in vec3 p, int idx) {
	
	float res = 0.;
    vec3 c = p;
	for (int i = 0; i < clamp(p5[idx],1,30); ++i) {    
        p =p0[idx]*abs(p)/max(dot(p,p+p2[idx]*p/(p+0.0001*(1.-abs(sign(p))))),0.0001) + p1[idx];
        p=p.zxy;
        res += exp(-33. * abs(dot(p,p3[idx]*c)));        
	}
	return res;
}


vec3 postProcess(vec3 col, float ct);
vec3 march(vec3 ro, vec3 rd, int idx, float c_timer, float ct2) {
  float t   = 0.;
  float dt  = 0.152;
  vec3 col  = vec3(0.0);
  float c   = 0.;
  const int max_iter = 48;
  for(int i = 0; i < max_iter; ++i) {
      t += dt*exp(-1.50*c);
      vec3 pos = ro+t*rd;
      c = map(pos,idx); 
      
      //c *= 0.025+2.*iMouse.y/iResolution.y; //test color with mouse
      c *= 0.025+2.*c_timer;
      float center = -0.35; // center of color shift
      float dist = (abs(pos.x + pos.y + center))*2.5;
      vec3 dcol = vec3(c*c+0.5*c*c-c*dist, c*c-c, c); // color func
      col = col + dcol*1./float(max_iter);
  }
  col *= 0.18;
  col=clamp(col,0.,1.);
  return postProcess(col, ct2);
}

vec3 postProcess(vec3 col, float ct) {
  col = col*0.85+0.85*col*col.brb;
  col = col*0.6+0.64*col*col*(3.0-2.0*col)+0.5*col*col;
  col = col+0.4*(col.rrb-vec3(dot(col, vec3(0.33))));
  vec3 c1=col-0.344*(col.brb-vec3(dot(col, vec3(0.33))));
  vec3 c2=col+0.64*(col.ggr-vec3(dot(col, vec3(0.33))));
  col=mix(col,c1,min(ct*2.,1.));
  col=mix(col,c2,-clamp(ct*2.-1.,0.,1.));
  //col*=1.5;
  col=col*01.5+0.5*col*col;
  return col;
}



// fractal color function

#define PI 3.14159265
vec4 get_color(vec2 p , int idx, float timer, float c_timer)
{
    idx = idx%psz;
    vec4 fragColor;
	float time = iTime;
    vec3 ret_col = vec3(0.0);
    float mouseY = 0.15 * PI;
    mouseY = (1.0 - 0.5*1.15 * (1.83-timer)) * 0.5 * PI;
#ifdef use_func
    mouseY = (1.0 - 1.15 * iMouse.y / iResolution.y) * 0.5 * PI; //test MOUSE
#endif
#ifndef mouse_loop
    if(iMouse.z>0.&&iMouse.w<iResolution.y)mouseY = (1.0 - 1.15 * iMouse.y / iResolution.y) * 0.5 * PI;
#endif
    float mouseX = -1.25*PI;
    mouseX+=-(timer*1.5+0.25) * .5 * PI;
#ifdef use_func
    mouseX=-1.25*PI-(iMouse.x / iResolution.x) * 3. * PI; //test MOUSE
#endif
#ifndef mouse_loop
    if(iMouse.z>0.&&iMouse.z<iResolution.x)mouseX=-1.25*PI-(iMouse.x / iResolution.x) * 3. * PI;
#endif
    vec3 eye = cam_orbit*vec3(cos(mouseX) * cos(mouseY), sin(mouseX) * cos(mouseY), sin(mouseY));
    eye = eye+0.0001*(1.-abs(sign(eye)));
    vec3 ro = eye;

    vec3 w = normalize(-eye);
    vec3 up = vec3(0., 0., 1.);
    vec3 u = normalize(cross(w, up));
    vec3 v = cross(u, w);

    vec3 rd = normalize(w + p.x * u + p.y * v);
    
    vec3 col =  march(ro, rd, idx, timer*0.30+0.15*timer*timer+0.25, c_timer);
    col = clamp(col,0.,1.);
    fragColor = vec4( col, 1.0 );
    return fragColor;
}



// everything else is just Shadertoy presentation, not related to fractal
// mainImage has godrays + image slider logic

vec2 plane(vec2 uv, float timer);
float GetBayerFromCoordLevel(vec2 pixelpos);
vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d );
float hash(vec2 p);

void mainImage( out vec4 fragColor, in vec2 fragCoord)
{
    fragColor = vec4(0.);
    vec2 res = iResolution.xy/iResolution.y;
    vec2 uv = fragCoord/iResolution.y;

#ifdef use_func
    fragColor = get_color((uv-res*0.5)*2., use_func, 0.65, 0.);
    return;
#endif

    const float grn = 7.; // number of tiles for slider

    float sx = 0.5*(1./grn)+0.5*0.25*(floor(res.x/(1./grn))-0.5*res.x/(1./grn));
    uv.x += sx;
    vec2 gid = floor(uv*grn);
    uv = fract(uv*grn)-0.5;
    
    // timers
    float gtime = iTime*.645;
    // gtime=float(psz)*6. sec loop
    
#ifdef mouse_loop
    gtime=float(psz)*6.*iMouse.x/iResolution.x; //test MOUSE
#endif

    // timer logic
    float tt = mod(gtime,12.);
    float tt2 = mod(gtime+6.,12.);
    float i1 = smoothstep(3.,6.,tt);float i2 = smoothstep(9.,12.,tt);
    float ltime = (i1+i2)*3.+floor(gtime/12.)*6.;
    float s_timer = (smoothstep(3.,12.,tt2));
    float s_timer2 = (smoothstep(3.,12.,tt));
    int itdx = int(ltime+3.)/6;
    int itdx2 = int(ltime)/6;
    
    float gmix1 = 0.5-0.5*cos(gtime/6.*0.35);
    float gmix2 = 0.5-0.5*cos(gtime/6.*0.25);

    // godrays 
    vec3 occ_col=vec3(0.);
    {
        #define DECAY .974
        #define EXPOSURE .116907
        #define SAMPLES	32
        #define DENSITY	.595
        #define WEIGHT .25
        vec2 coord = fragCoord.xy/iResolution.xy;
        float cd = 1.75*length(coord-0.5);
        float occ=0.;
        vec2 lightpos = vec2(0.51,0.503);
        float dither = GetBayerFromCoordLevel(fragCoord);    
        vec2 dtc = (coord - lightpos) * (1. / float(SAMPLES) * DENSITY);
        float illumdecay = 1.;
        for(int i=0; i<SAMPLES; i++)
        {
            coord -= dtc;
            vec2 otuv = coord+(dtc*dither);
            vec2 tuv = otuv*res;
            tuv.x += sx; vec2 lgid = floor(tuv*grn); tuv = fract(tuv*grn)-0.5;
            float lctimer = 0.0;
            float lctime = ltime - (lgid.y/grn - lgid.x/(grn*res.x))*1.-grn/16.+2.;
            lctime = mod(lctime, 6.);
            lctimer += smoothstep(0.0, 1.0, lctime);
            lctimer += 1. - smoothstep(3.0, 4.0, lctime);
            lctimer = abs(lctimer-1.0);
            vec2 tuv_pl = plane(tuv,lctimer);
            float noplx = float(abs(tuv_pl.x)>0.5||abs(tuv_pl.y)>0.5);
            float s = (noplx)*(1.-smoothstep(-0.03,0.75,.5*length(otuv-0.5)));
            s *= illumdecay * WEIGHT;
            occ += s;
            illumdecay *= DECAY;
        }
        occ=1.5*occ*EXPOSURE;
        occ_col = occ*(1./max(cd,0.0001))*
            pal( mix(cd*occ*0.35,cd+occ*0.35,gmix1), 
            vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(2.0,1.0,0.0),vec3(0.5,0.20,0.25) ).gbr;
        occ_col=clamp(occ_col,0.,1.);
    }
    //----

    float timer = 0.0;
    float time = ltime - (gid.y/grn - gid.x/(grn*res.x))*1.-grn/16.+2.;
    time = mod(time, 6.);
    timer += smoothstep(0.0, 1.0, time);
    timer += 1. - smoothstep(3.0, 4.0, time);
    timer = abs(timer-1.0);
    float side = step(0.5, timer);
    vec2 uv_pl = plane(uv,timer);
    
    vec2 tp = (fragCoord.xy/iResolution.xy-0.5)*2.;
    tp = pow(abs(tp), vec2(2.0)); 
    float tcd = 0.5+0.5*clamp(1.0 - dot(tp, tp),0.,1.);
    float cineshader_alpha = smoothstep(0.,1.,(timer))*0.5*tcd;
    //float cineshader_alpha = smoothstep(0.,1.,2.*abs(timer-.5))*0.5*tcd;
    
    bool nopl = abs(uv_pl.x)>0.5||abs(uv_pl.y)>0.5;
    uv_pl += 0.5;
    if(side<0.5)uv_pl.x=1.-uv_pl.x;
    
    if (nopl)
    {
        fragColor = vec4(occ_col,cineshader_alpha);
        return;
    }
    vec2 tuv = ((uv_pl*1./res)*1./grn+((gid*1./grn)+vec2(-sx,0.))*1./res);
    if(side>0.5)fragColor = get_color((tuv-0.5)*res*2.,0+itdx*2,s_timer, gmix2);
    else fragColor = get_color((tuv-0.5)*res*2.,1+itdx2*2,s_timer2, gmix2);
    
    //fragColor.rgb*=smoothstep(0.,1.,2.*abs(timer-.5));
    
    fragColor = vec4(fragColor.rgb+occ_col,cineshader_alpha);
    fragColor.rgb = clamp(fragColor.rgb,0.,1.);
}


vec2 plane(vec2 uv, float timer)
{
    timer = radians(timer*180.0);
    vec4 n = vec4(cos(timer),0,sin(timer),-sin(timer));
    vec3 d = vec3(1.0,uv.y,uv.x);
    vec3 p = vec3(-1.0+n.w/4.0,0.,0.);
    
    vec3 up = vec3(0.,1.,0.);
    vec3 right = cross(up, n.xyz);
    float dn = dot(d, n.xyz);dn+=0.00001*(1.-abs(sign(dn)));
    float pn = dot(p, n.xyz);
    vec3 hit = p - d / dn * pn;
    return vec2(dot(hit, right), dot(hit, up));
}


float GetBayerFromCoordLevel(vec2 pixelpos)
{
    ivec2 ppos = ivec2(pixelpos);
    int sum = 0; const int MAX_LEVEL = 3;
    for(int i=0; i<MAX_LEVEL; i++)
    {
        ivec2 tv = ppos>>(MAX_LEVEL-1-i)&1;
        sum += ((4-(tv).x-((tv).y<<1))%4)<<(2*i);
    }
    return float(sum) / float(2<<(MAX_LEVEL*2-1));
}

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

