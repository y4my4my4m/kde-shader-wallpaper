// url: shadertoy.com/view/Nt2fzD
// credits: byt3_m3chanic

/**
    License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
        
    Space Donuts | 5/15/22  
    byt3_m3chainc

*/

#define R iResolution
#define M iMouse
#define T iTime

#define PI  3.1415926535
#define PI2 6.2831853071

#define MIN_DIST .0001
#define MAX_DIST 90.

mat2 rot (float a) { return mat2(cos(a),sin(a),-sin(a),cos(a)); }
float hash21(vec2 a) { return fract(sin(dot(a,vec2(215.23,41.232)))*4123.2323); }

float noise( in vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
	vec2 u = f*f*(3.-2.*f);
    return mix( mix( hash21( i + vec2(0,0) ), 
                     hash21( i + vec2(1,0) ), u.x),
                mix( hash21( i + vec2(0,1) ), 
                     hash21( i + vec2(1,1) ), u.x), u.y);
}

//@iq torus
float torus( vec3 p, vec2 t ) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

vec3 hit,hitPoint,sto,gto;
vec2 gid,sid;
float time;
mat2 r90;
float zoom = 17.;
const vec2 sc = vec2(.125), hsc = .5/sc; 

vec2 map(vec3 p) {
    p.y+=1.;
    p.x+=T*1.5;
    
    vec3 qq=p;
    vec2 id=floor((p.xz-7.)/14.);
    float hs = hash21(id);
    p.xz=mod(p.xz-7.,14.)-7.;
    
    vec2 res = vec2(1e5,0);
    vec3 q = p-vec3(0,1.05,0);
    
    float fs = (.1+hs);
    float rbase = (fs*2.)+T;
    q.yz*=rot(rbase*fs);
    q.xy*=rot(rbase*.75*fs);

    float ns = noise(q.xz)*2.;
    float b2 = torus(q,vec2(2.75 ,1.25 ))-(ns*.15);
    float b3 = torus(q,vec2(2.75 ,1.265 ))-(ns*.2);
    float wv = .2*sin(q.x*3.2)+.2*cos(q.z*2.2);
    float fq = q.y -wv;
    b3=max(fq,b3);
    
    if(b2<res.x) {
        res = vec2(b2,3.);
    	hit=q;
        gid=id;
        gto=vec3(id,.5);
    }

    if(b3<res.x) {
        res = vec2(b3,4.);
    	hit=q;
        gid=id;
        gto=vec3(id,.5);
    }

    // I am clueles on how to place ojects on the
    // surface - so here I make a circle of sprinkles
    // in a circle around the torus..
    
    // it's hacky - so if there is a better way let
    // me know
    
    vec3 q1=q;
    float amount = 42.;
    //@Shane polar rep
    float a = atan(q1.z, q1.x);
    float ia = floor(a/PI2*amount);
    ia = (ia + .5)/amount*PI2;

    float qd = -mod(ia,.0);

    mat2 rxa = rot(ia);
    q1.xz *= rxa;
    q1.xy -= vec2(2.715,0);

    amount = 16.;
    vec3 q2 = q1;
    
    q2.xz*=r90;
    
    a = atan(q2.z, q2.y);
    float da = floor(a/PI2*amount);
    da = (da + .5)/amount*PI2;
    float dd = mod(da,.0);

    rxa = rot(da);
    q2.yz *= rxa;
    q2.yx -= vec2(1.4+(ns*.15),0);
    
    float xs = hash21(vec2(qd,dd));
    
    float d5 = length(q2)-.175;

    if(xs<.6) d5=1.;
    
    if(d5<res.x &&q.y<0.) {
        res = vec2(d5,6.);
    	hit=q;
        gid=vec2(qd,dd)+id;
        gto=vec3(id,.5);
    }
    
    // floor
    float d9 = qq.y;
    d9 = max(d9,-(length(q)-5.25));
    if(d9<res.x) {
        res = vec2(d9,1.);
    	hit=qq;
        gid=id;
        gto=vec3(id,.5);
    }

    return res;
}

// Tri-Planar blending function. Ryan Geiss: 
// https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch01.html
vec3 tex3D(sampler2D t, in vec3 p, in vec3 n ){
    n = max(abs(n), 0.001);
    n /= dot(n, vec3(1));
	vec3 tx = texture(t, p.yz).xyz;//vec3(noise(p.yz*22.));
    vec3 ty = texture(t, p.zx).xyz;//vec3(noise(p.zx*22.)); 
    vec3 tz = texture(t, p.xy).xyz;//vec3(noise(p.xy*22.)); 
    //return mat3(tx*tx, ty*ty, tz*tz)*n;
    return (tx*tx*n.x + ty*ty*n.y + tz*tz*n.z);
}

// https://www.shadertoy.com/view/ld3yDn
vec3 doBumpMap( sampler2D tx, vec3 p, vec3 n, float bf, float per){
    vec2 e = vec2(per*MIN_DIST, 0);   
    mat3 m = mat3( 
        tex3D(tx, p - e.xyy, n), 
        tex3D(tx, p - e.yxy, n), 
        tex3D(tx, p - e.yyx, n)
    );

    const vec3 gn = vec3(0.580,0.839,0.420);
    vec3 g = gn* m; 
    g = (g - dot(tex3D(tx,  p , n), gn) )/e.x; g -= n*dot(n, g);  
    return normalize( n + g*bf );
}

vec3 normal(vec3 p, float t){
    float e = MIN_DIST*t;
    vec2 h =vec2(1,-1)*.5773;
    vec3 n = h.xyy * map(p+h.xyy*e).x+
             h.yyx * map(p+h.yyx*e).x+
             h.yxy * map(p+h.yxy*e).x+
             h.xxx * map(p+h.xxx*e).x;
    return normalize(n);
}

vec3 hue(float t, vec3 d) { 
    return .375 + .375*cos(PI2*t*(vec3(.985,.98,.95)+d)); 
}

vec4 FC = vec4(0.306,0.337,0.353,0.);

vec4 render(inout vec3 ro, inout vec3 rd, inout vec3 ref, bool last, inout float d) {

    vec3 C = vec3(0);
    float m = 0.;
    vec3 p = ro;
    
    for(int i=0;i<75;i++)
    {
        p = ro + rd * d;
        vec2 ray = map(p);
        if(abs(ray.x)<MIN_DIST*d||d>MAX_DIST)break;
        d += i<32? ray.x*.5: ray.x;
        m  = ray.y;
    } 

    hitPoint = hit;
    sid = gid;
    sto = gto;
    
    float alpha = 0.;
    if(d<MAX_DIST)
    {
        vec3 n = normal(p,d);
        vec3 lpos =  vec3(1,18,-13);
        vec3 l = normalize(lpos-p);

        if(m==3.){
            vec3 hp = hitPoint;
            n = doBumpMap(iChannel0, hp*.075, n, .005 ,d);
        }
        
        float diff = clamp(dot(n,l),0.,1.);

        float shdw = 1.0;
        for( float t=.01; t < 18.; ) {
            float h = map(p + l*t).x;
            if( h<MIN_DIST ) { shdw = 0.; break; }
            shdw = min(shdw, 18.*h/t);
            t += h;
            if( shdw<MIN_DIST || t>32. ) break;
        }
        diff = mix(diff,diff*shdw,.75);

        vec3 view = normalize(p - ro);
        vec3 ret = reflect(normalize(lpos), n);
        float spec =  0.5 * pow(max(dot(view, ret), 0.), 14.);

        vec3 h = vec3(.5);
        
        if(m==1.) {
            vec3 hp = hitPoint*sc.xxx;
            h = vec3(.7);
            vec2 f = fract(hp.xz*3.)-.5;
            if(f.x*f.y>0.) h=clamp( hue( sin(hp.x*.25),vec3(0.961,0.541,0.220) )+.2,vec3(0),vec3(1) );
            if(hp.y<.0)h=vec3(.8);
            ref = vec3(h*.5);
        }
        
        if(m==2.) {
            h=vec3(.5);
            ref = h;
        }
        
        if(m==3.) {
            h=mix(vec3(0.573,0.310,0.008),vec3(0.914,0.714,0.169),clamp((hitPoint.y-.25)*.5,0.,1.));
            ref = vec3(.001);
        }
        
        if(m==4.) {
            h=hue(3.+hash21(sid)*1.3,vec3(0.220,0.875,0.961));
            ref = h;
        }
        
        if(m==6.) {
            h=hue(3.+hash21(sid)*.25,vec3(0.914,0.169,0.753));
            ref = h;
        }
        
        C = h*diff+min(shdw,spec);
        C = mix(FC.rgb,C,  exp(-.000025*d*d*d));
    
        ro = p+n*.01;
        rd = reflect(rd,n);
    
    }
    
    return vec4(clamp(C,vec3(.03),vec3(1.)),alpha);
}

void mainImage( out vec4 O, in vec2 F )
{
    time = T*.75;
    r90=rot(1.5707);
    vec2 uv = (2.*F.xy-R.xy)/max(R.x,R.y);

    vec3 ro = vec3(uv*zoom,-zoom);
    vec3 rd = vec3(0,0,1.);

    mat2 rx = rot(-45.*PI/180.);
    ro.yz *= rx;ro.xz *= rx;
    rd.yz *= rx;rd.xz *= rx;

    vec3 C = vec3(0);
    vec3 ref=vec3(0); 
    vec3 fil=vec3(1);
    
    float d =0.;
    float bnc = 2.;
    
    for(float i=0.; i<bnc; i++) {
        d =0.;
        vec4 pass = render(ro, rd, ref, i==bnc-1., d);
        C += pass.rgb*fil;
        fil*=ref;
    }

    C=clamp(C,vec3(.01),vec3(1.));
    
    // gamma correction
    C = pow(C, vec3(.4545));
    O = vec4(C,1.0);
}

