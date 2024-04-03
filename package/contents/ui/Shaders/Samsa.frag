/* "Samsa - Fragment IV"
    2024
    by KΛTUR
    License - Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International Unported License.

    Fragment I   - https://www.shadertoy.com/view/MflGDM
    Fragment II  - https://www.shadertoy.com/view/XX2SRR
    Fragment III - https://www.shadertoy.com/view/XX2SWR
    Fragment IV  - https://www.shadertoy.com/view/4XBSRK
    
    https://lichterloh.tv/portfolio/samsa/
    
//========================================================//

               ∧∨∧∨∧∨∧∨∧∨∧∨∧∨∧○∨∧∧∨∧∨∧∨∧∨∧∨∧∨∧
               █████¬█████¬██¬¬¬██¬█████¬█████
               █¬¬¬¬¬██¬¬█¬███¬███¬█¬¬¬¬¬██¬¬█
               █████¬██■■█¬█¬¬█¬¬█¬█████¬██■■█
               ¬¬¬¬█¬██¬¬█¬█¬¬¬¬¬█¬¬¬¬¬█¬██¬¬█
               █████¬██¬¬█¬█¬¬¬¬¬█¬█████¬██¬¬█
               ∨∧∨∧∨∧∨∧∨∧∨∧∨∧∨●∧∨∨∧∨∧∨∧∨∧∨∧∨∧∨

        An exploration of light and form, continuously
          adapting on a quest to find equilibrium.

             Motivated by the uncluttered yet
                 intricate beauty of math.

//========================================================//

Anti Aliasing from https://www.shadertoy.com/view/wtjfRV
AA 0 = no AA
AA 1 = with AA
(GPU intense - Any better solution welcome :)  <3  )      */

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

    
#define MAX_STEPS 100
#define MAX_DIST 20.
#define SURF_DIST .001

mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);}

//===================================================================//
// below by https://iquilezles.org/



float Smin( float d1, float d2, float k )
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}
    
float Smax( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) + k*h*(1.0-h); }

float Sphere(vec3 p,float s){
    return length(p)-s;
    }

float Torus( vec3 p, vec2 t){
  vec2 q = vec2(length(p.zx)-t.x,p.y);
  return length(q)-t.y;
    }

// above by https://iquilezles.org/
//===================================================================//

vec3 CastRay(vec2 uv, vec3 p, vec3 a, float z) {
    vec3 
        f = normalize(a-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f,r),
        c = f*z,
        i = c + uv.x*r + uv.y*u;
    return normalize(i);
}

#define AA 0

vec3 CamTransform(float t){
    t *= .1;
    return vec3(sin(t)*sin(t*.9)*7.,
                sin(t+sin(t*.6)*5.),
                cos(t)*-7.);
}

float SDF(vec3 p){
    
float t = ubuf.iTime*.2;
      t += sin(ubuf.iTime*.5)*.3;
        
    // TORUS
    float tor = 1e9;
    for(float i=min(t,0.);i<3.;i++){
        vec3 pt = p;
        float s = sin(t+i)*.5+1.;
        pt.x += sin(t*.15+i*1.3)*3.;
        pt.y += sin(t*.32+i*1.2);
        pt.z += sin(t*.52+i*1.1)*3.;
        pt.xz *= Rot(t*.59-i);
        pt.xy *= Rot(t*.62+i);
        pt.yz *= Rot(t*.47-i);
    tor = Smin(tor,Torus(pt,vec2(s,s*.1)),1.5);}   
    tor += (sin(t+p.x*2.)*cos(t+p.y))*.2-.2; // deformation
    
    // SPHERE
    float sph = 1e9;
    for(float i=min(t,0.);i<2.;i++){
        vec3 ps = p;
        ps.x += sin(t*.33-i*1.5)*2.5;
        ps.y += sin(t*.41+i)*2.+.5;
        ps.z += sin(t*.27+i*i)*2.5;
    sph = Smin(sph,Sphere(ps,sin(t+i)*.4+.6),1.);}
        
    // GYROID I
    float sg = 2.;
    float gyr = abs(dot(sin(p*sg),cos(p.zxy*sg)))/sg-.2;
    
    // GYROID II
    float gyr2 = abs(dot(sin(p),cos(p.zxy)))-1.;
    
    // PLANE
    vec3  pp = p;
    pp.y += 2.;
    float pla = pp.y;
    
    // COMPOSITION                  // == Boolsche Operation ==
        float d = 1e9;
        gyr = Smax(gyr,tor-.3,.03); // Intersection::Gyroid I AND bigger Tori  
        d = min(d,gyr);             // Union:::::::::Sdf  OR  Gyroid
        d = Smin(d,pla,1.);         // Union:::::::::Sdf  OR  Plane
        d = Smin(d,sph,1.);         // Union:::::::::Sdf  OR  Spheres
        d = Smax(d,-tor,.1);        // Subtraction:::Sdf  NOT Tori
  float e = Smax(tor-.2,gyr2,.5);   // Intersection2:Tori AND Gyroid II
        d = max(d,-e);              // Subtraction:::Sdf  NOT Intersection2

    // DEFORMATION
    float b = 73.;
    d += clamp(0.,2.,p.y+1.7) * pow( (sin(t+p.x*p.z*p.y*.5)*.5+.5),8.) *( (asin(sin(p.x*b)) + asin(sin(p.y*b)) +asin(sin(p.z*b)))*0.01);
    
    // CAMERA BOUNDING SPHERE
    d = Smax(d,-Sphere(p-CamTransform(ubuf.iTime),.3),.5)*.9; // Sphere Subtraction
    
    return d;
}

float March(vec3 ro, vec3 rd, float side){
    float o=0.;
    for(int i=0;i<MAX_STEPS; i++){
        vec3 p = ro + rd*o;
        float dS = SDF(p)*side;
        o += dS;
        if(o>MAX_DIST||abs(dS)<SURF_DIST) break;
    }
    return o;
}

vec3 CalcNormal (vec3 p){
    // inspired by tdhooper and klems - a way to prevent the compiler from inlining map() 4 times
    vec3 n = vec3(0.0);
    for( int i=min(ubuf.iFrame,0); i<4; i++ ){
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*SDF(p+.001*e);
    }
    return normalize(n);
}

//by https://iquilezles.org/
float AO (in vec3 pos, in vec3 n){
	float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<8; i++ )
    {
        float h = 0.001+0.15*float(i)/4.0;
        float d = SDF(pos+h*n);
        occ += (h-d)*sca;
        sca *= .95;
    }
    return clamp(1.0-1.5*occ, 0.05, 1.);    
}

vec4 Color ( in vec2 fragCoord )
{
    float t = ubuf.iTime*.1;
    
    vec2 uv = (2.*fragCoord-ubuf.iResolution.xy)/ubuf.iResolution.y;
    vec3 ro = CamTransform(ubuf.iTime),
         rd = CastRay(uv, ro, vec3(0), 2.),
         col = vec3(1);       
    
    float d = March(ro, rd, 1.);
    
    float IOR = 1.45; // index of refraction

    if(d<MAX_DIST){
    
        vec3 p = ro + rd * d; 
        vec3 n = CalcNormal(p); 
        vec3 r = reflect(rd, n);
        
// :::: Refraction from https://www.shadertoy.com/view/sllGDN :::: //

        vec3 refOutside = texture(iChannel0, r).rgb;
        vec3 rdIn = refract(rd, n, 1./IOR);
        
        vec3 pEnter = p - n*SURF_DIST*4.;
        float dIn = March(pEnter, rdIn, -1.);
        
        vec3 pExit = pEnter + rdIn * dIn;
        vec3 nExit = -CalcNormal(pExit); 
        
        vec3 reflTex = vec3(0);
        vec3 rdOut = vec3(0);
        float abb = clamp(0.,.02,p.y+1.);
        
        // red
        rdOut = refract(rdIn, nExit, IOR-abb);
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit);
        reflTex.r = texture(iChannel0, rdOut).r;
        
        // green
        rdOut = refract(rdIn, nExit, IOR);
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit);
        reflTex.g = texture(iChannel0, rdOut).g;
        
        // blue
        rdOut = refract(rdIn, nExit, IOR+abb);
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit);
        reflTex.b = texture(iChannel0, rdOut).b;
        
        /*
        // density of the medium
        
        float dens = .1;
        float optDist = exp(-dIn*dens);
        
        reflTex = reflTex*optDist;
        */
        
        float fresnel = pow(1.+dot(rd, n), 5.);
        
        col = mix(reflTex, refOutside, fresnel);
    }
    
    col = mix( col, vec3(texture(iChannel0,rd).rgb)*.9, 1.-exp(-pow(.08*d,6.)));//fog
    col = pow(col, vec3(.4545)); //gamma correction
	return vec4(col, 1);
}


// AA from https://www.shadertoy.com/view/wtjfRV
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = Color(fragCoord);
#if AA == 1
    fragColor = vec4(0);
    float A = 2.,  // Change A to define the level of anti-aliasing (1 to 16) ... higher numbers are REALLY slow!
          s = 1./A, x, y;
    for (x=-.5; x<.5; x+=s) for (y=-.5; y<.5; y+=s)
    fragColor += min ( Color(vec2(x,y)+fragCoord), 1.0);     
	fragColor /= A*A;
#endif
    
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
