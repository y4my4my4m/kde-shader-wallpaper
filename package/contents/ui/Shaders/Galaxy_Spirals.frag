// https://www.shadertoy.com/view/llSGR1
// Credits to S.Guillitte <guil>

// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// Created by S.Guillitte
// Galaxy morphology based on http://iopscience.iop.org/0004-637X/783/2/138/pdf/0004-637X_783_2_138.pdf


int windows = 0;
vec2 m = vec2(2.,6.);
const float pi = 3.141592;

const mat2 m2 = mat2(.8,.6,-.6,.8);


float noise(in vec2 p){

    float res=0.;
    float f=2.;
    for( int i=0; i< 4; i++ )
    {
        p=m2*p*f+.6;
        f*=1.0;
        res+=sin(p.x+sin(2.*p.y));
    }
    return res/4.;
}


float fbmabs( vec2 p ) {

    float f=1.;
    float r = 0.0;
    for(int i = 0;i<8;i++){
        r += abs(noise( p*f ))/f;
        f *=2.;
        p-=vec2(-.01,.08)*r;
    }
    return r;
}

float fbmstars( vec2 p ) {

    p=floor(p*50.)/50.;

    float f=1.;
    float r = 0.0;
    for(int i = 1;i<5;i++){
        r += noise( p*(20.+3.*f) )/f;
        p*=m2;
        f +=1.;

    }
    return pow(r,8.);
}

float fbmdisk( vec2 p ) {

    float f=1.;
    float r = 0.0;
    for(int i = 1;i<7;i++){
        r += abs(noise( p*(f) ))/f;
        f +=1.;

    }
    return 1./r;
}


float fbmdust( vec2 p ) {

    float f=1.;
    float r = 0.0;
    for(int i = 1;i<7;i++){
        r += 1./abs(noise( p*(f) ))/f;
        f +=1.;

    }
    return pow(1.-1./r,4.);
}


float theta(float r, float wb, float wn){
    return atan(exp(1./r)/wb)*2.*wn;
}

float arm(float n, float aw, float wb, float wn,vec2 p){
    float t = atan(p.y,p.x);
    float r = length(p);
    return pow(1.-.15*sin((theta(r,wb,wn)-t)*n),aw)*exp(-r*r)*exp(-.07/r);
}

vec2 maparm(float n, float aw, float wb, float wn,vec2 p){
    float t = atan(p.y,p.x);
    float r = length(p);

    return vec2((theta(r,wb,wn)-t)*n,r);
}

float bulb(vec2 p){
    float r = exp(-dot(p,p)*1.2);
    p.y-=.2;
    return r+.5*exp(-dot(p,p)*12.);
}

float map(vec2 p){


    float a= arm(m.x,6.,.7,m.y,p);
    float d = fbmdust(p);
    float r = max(a*(.4+.1*arm(m.x+1.,4.,.7,m.y,p*m2))*(.1+.6*d+.4*fbmdisk(p)),bulb(p)*(.7+.2*d+.2*fbmabs(p)));
    return max(r, a*fbmstars(p*4.));
}


vec2 rotate(in vec2 p, in float t)
{
    return p * cos(-t) + vec2(p.y, -p.x) * sin(-t);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord ) {

    vec2 p = 2.*fragCoord.xy /iResolution.xy-1.;
    p*=2.;
    if(p.y>0.){
        if(p.x>0.)windows =1;
        else    windows =0;}
    else{
        if(p.x>0.)windows =3;
        else windows =2;}


    p = rotate(p,-.02*iTime);

    if(iMouse.z>0.)m = floor(iMouse.xy/iResolution.xy*10.);
    m.y*=2.;

    float r;
    vec3 light = normalize(vec3(4., 2., -1.));

    float k=1.5*map(p);
    float b=.3*map(p*m2)+.4;
    r=.2;

    fragColor = clamp(vec4(r*k*k, r*k, k*.5+b*.4, 1.0),0.,1.);
}
