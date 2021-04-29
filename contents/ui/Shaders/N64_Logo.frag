// URL: shadertoy.com/view/NdsSWX
// By: ccincotti3

#define MAX_STEPS 100
#define SURFACE_DIST.0001
#define MAX_DIST 10.
#define SAMPLES 10

#define HEIGHT 1.
#define WIDTH 1.
#define DEPTH 1.
#define PI 3.14159265359
#define WEIGHT DEPTH*.21
#define SPACE_BETWEEN DEPTH*.42

mat2 Rot(float a){
    float s=sin(a),c=cos(a);
    return mat2(c,-s,s,c);
}

vec2 rand( const float n ) {
	return (fract(sin(vec2(n,n+1.))*vec2(43758.5453123)) - .5)/500.;
}

/*
* SDFs
*/
float sdBox(vec3 p,vec3 b){
    vec3 q=abs(p)-b;
    return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);
}

float sdPlane(vec3 p,vec3 r){
    return dot(p,normalize(r));
}

float sdTri(vec3 p,float cBd,vec3 cutPlane){
    float cPd=sdPlane(p,cutPlane);
    return-max(cPd,cBd);
}

float sdN(vec3 p){
    float dpth=DEPTH*.29;
    float box=sdBox(p,vec3(WIDTH,HEIGHT,dpth));// main box that forms N.
    
    vec3 cutPlane=vec3(0,HEIGHT,0.);
    cutPlane.xy*=Rot(PI/2.-atan(SPACE_BETWEEN/(dpth*2.)));
    
    // Build triangles to cut out of box to build N
    float cBd=sdBox(p,vec3(SPACE_BETWEEN,(29./WEIGHT)*SPACE_BETWEEN,.3));// box to slice into triangle
    
    vec3 triLoc=p+vec3(.0,SPACE_BETWEEN+.025,0);// bottom tri
    float tri=sdTri(triLoc,cBd,cutPlane);
    
    triLoc=p-vec3(.0,SPACE_BETWEEN+.025,0);// top tri
    triLoc.xy*=Rot(PI);
    float tri2=sdTri(triLoc,cBd,cutPlane);
    
    float d=max(max(tri,tri2),box);// cut
    return d;
}

// Could probably simplify this down to one N draw
float GetDist(vec3 p){
    vec3 bp=p;
    if(sign(bp.z)<0.)
        bp.xz*=Rot(PI);
    float dN1=sdN(bp-vec3(0.,0,WIDTH/2.+WEIGHT));
    p.xz*=Rot(PI/2.);
    if(sign(p.z)<0.)
        p.xz*=Rot(PI);
    float dN2=sdN(p-vec3(WIDTH/2.-.5,0,WIDTH/2.+WEIGHT));
    return min(dN1,dN2);
}

float RayMarch(vec3 ro,vec3 rd){
    float dO=0.;
    for(int i=0;i<MAX_STEPS;i++){
        vec3 p=ro+dO*rd;// point along the ray
        float dS=GetDist(p);
        dO+=dS;
        if(dS<SURFACE_DIST||dO>MAX_DIST)break;
    }
    return dO;
}

vec3 GetNormal(vec3 p){
    vec2 e=vec2(.01,0);
    float d=GetDist(p);
    vec3 n=d-vec3(
        GetDist(p-e.xyy),
        GetDist(p-e.yxy),
        GetDist(p-e.yyx)
    );
    return normalize(n);
}

// TK
float GetLight(vec3 p, vec3 lightPos){
    vec3 l=normalize(lightPos-p);// direction vector of the surface point to the light pos
    vec3 n=GetNormal(p);
    float dif=clamp(dot(n,l),0.,1.);// value between -1 and 1. Something to be aware of. Should clamp to avoid probs.
    return dif;
}

vec3 GetRayDir(vec2 uv,vec3 ro,vec3 lookAt,float zoom){
    vec3 globalUp=vec3(0,1,0);
    vec3 forward=normalize(lookAt-ro);
    vec3 right=normalize(cross(globalUp,forward));
    vec3 up=cross(forward,right);
    vec3 center=forward*zoom;//center of screen
    vec3 i=center+uv.x*right+uv.y*up;
    return normalize(i);
}

vec3 colorByNormals(vec3 p,vec3 n,float d){
    vec3 col;
    if(abs(n.z)>0.){
        col=vec3(0.2470,0.6353,0.2667);
    }
    
    if(
        (abs(n.y)>0.49&&abs(n.x)>0.49)||
        (n.y<-.01&&n.z>0.)||
        (p.x>0.&&n.y<-.01&&n.z<0.)
    ){
        col=vec3(0.76862,0,0.149);
    }
    
    if(abs(n.y)>.9){
        col=vec3(0.94902,0.6706,0.);
    }
    
    if(abs(n.x)>.9||
    (p.z<0.&&n.x<-.1&&n.y<0.)||
    (p.z>0.&&n.x>.1&&n.y<0.)
    ){
        col=vec3(0.2196,0.2196,0.7725);
    }

    if(d>7.){
        col=vec3(0.);
    }

    return col;
}

void mainImage(out vec4 fragColor,in vec2 fragCoord)
{
    // Normalized pixel coordinates (from -.5 to .5)
    // opposed to vec2 uv = fragCoord/iResolution.xy;  (from 0 to 1)

    vec2 uv=(fragCoord-.5*iResolution.xy)/iResolution.y;
    vec2 m=iMouse.xy/iResolution.xy;
    vec3 col;
    float oTime = iTime;
    vec3 ro=vec3(0.,-3.,-5.);
    ro.yz*=Rot(-m.y*3.14+1.);
    ro.xz*=Rot(-m.x*6.2831);
    ro.xz*=Rot(-oTime/4.*6.2831);


    vec3 lookAt=vec3(0.,0.,0.);
    float zoom=1.;
    for( int j=0; j<SAMPLES; j++ ) {
        float time = iTime;
        float fj = float(j);
        vec3 rd=GetRayDir(uv+rand(fj+iTime),ro,lookAt,zoom);

        float d=RayMarch(ro,rd);
        vec3 p=ro+rd*d;// get point to shade with light
        vec3 normal=GetNormal(p);
        vec3 lightPos=vec3(-5,0,-3);
        lightPos.xz *= inverse(Rot(oTime/4.*6.2831));

        float dif = GetLight(p, lightPos);
        col+= dif*.3;
        col+=colorByNormals(p,normal,d);
    }
    // Output to screen
    fragColor=vec4(col/float(SAMPLES),1.);
}
