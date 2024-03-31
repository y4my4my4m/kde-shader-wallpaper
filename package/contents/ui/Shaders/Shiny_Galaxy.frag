// https://www.shadertoy.com/view/4t23Rw
// Credits to guil

// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// Created by S. Guillitte 2015
// Galaxy morphology based on http://iopscience.iop.org/0004-637X/783/2/138/pdf/0004-637X_783_2_138.pdf

float zoom=1.;
const float arms = 2.;
const float winding = 12.;


mat2 rot(float a) {
	return mat2(cos(a),sin(a),-sin(a),cos(a));
}


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

float noise(in vec3 p)
{

	p*=2.;
    float res=0.;
    float f=1.;
	for( int i=0; i< 3; i++ )
	{
        p.xy=m2*p.xy;
        p=p.zxy*f+.6;
        f*=1.15;
        res+=sin(p.y+1.3*sin(1.2*p.x)+1.7*sin(1.7*p.z));
	}
	return res/3.;

}


float fbmdisk( vec3 p ) {

	float f=1.;
	float r = 0.0;
    for(int i = 1;i<5;i++){
		r += abs(noise( p*(f) ))/f;
	    f +=f;

	}
	return 1.2/(.07+r);
}


float fbmgal( vec3 p ) {

    p=p*4.;

	float f=1.;
	float r = 0.0;
    for(int i = 1;i<5;i++){
		r += noise( p*(20.+3.*f) )/f;
        p.xz*=m2;
	    f +=1.;

	}
	return pow(abs(r),4.);
}



float fbmdust( vec3 p ) {

	float f=1.;
	float r = 0.0;
    for(int i = 1;i<5;i++){
		r += 1./abs(noise( p*(f) ))/f;
	    f +=f;

	}
	return pow(abs(1.-1./(.01+r)),4.);
}


float theta(float r, float wb, float wn){
	return atan(exp(1./r)/wb)*2.*wn;
}

float arm(float n, float aw, float wb, float wn,vec2 p){
    float t = atan(p.y,p.x);
    float r = length(p);
	return pow(1.-.15*sin((theta(r,wb,wn)-t)*n),aw)*exp(-r*r)*exp(-.07/r);
}


float bulb(vec2 p){
    float r = exp(-dot(p,p)*1.2);
    //p.y-=.2;
	return (.8*r+2.*exp(-dot(p,p)*16.));
}


float map(in vec3 p) {
	vec2 q=p.xz;
    vec3 res= vec3(0.);
	float a= arm(arms,6.,.7,winding,q);
    float r = max(a+.5,bulb(q));
    return 4.*exp(-28.*(abs(p.y)-r/16.));
}



vec3 raymarch( in vec3 ro, vec3 rd)
{
    float t = 1.5;
    float dt = .065;
    vec3 col= vec3(0.);
    float c = 0.,s=0.,d=0.;
    for( int i=0; i<50; i++ )
	{
        t+=dt*exp(-.2*c*s);
        if(t>6.)break;
        vec3 pos = ro+t*rd;

        c = map(pos);
        if(c>.2){
        	s = fbmdisk(pos*32.)/1.5;
        	d = fbmdust(pos*4.)/4.;
            c*=d;
        }
        //col = .98*col+ .05*vec3(c*c*c, c*c, c);
        col = .98*col+ .02*vec3(c*c, 1.3*c*s,1.8* s)*c;

    }
    return .8*col;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	float time = iTime;
    vec2 q = fragCoord.xy / iResolution.xy;
    vec2 p = -1.0 + 2.0 * q;
    p.x *= iResolution.x/iResolution.y;
    vec2 m = vec2(0.);
	if( iMouse.z>0.0 )m = iMouse.xy/iResolution.xy*3.14;
    m-=.5;

    // camera

    vec3 ro = zoom*vec3(2.);
    ro.yz*=rot(m.y);
    ro.xz*=rot(m.x+ 0.05*time);
    vec3 ta = vec3( 0.0 , 0.0, 0.0 );
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
    vec3 rd = normalize( p.x*uu + p.y*vv + 4.0*ww );



	// raymarch
    vec3 col = raymarch(ro,rd);
    float g = .4*fbmgal(rd);
    col +=.3*vec3(g*g*g, g*g*1.3, 1.5*g);


	// shade

    col =  .5 *(log(1.+col));
    col = clamp(col,0.,1.);
    fragColor = vec4( col, 1.0 );

}
