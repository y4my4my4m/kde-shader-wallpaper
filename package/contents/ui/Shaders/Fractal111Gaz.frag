// Title: Fractal 111 gaz
// By: gaz
// Url: https://www.shadertoy.com/view/fsfBW7 
#define R(p,a,t) mix(a*dot(p,a),p,cos(t))+sin(t)*cross(p,a)
#define H(h) (cos((h)*6.3+vec3(0,23,21))*.5+.5)

void mainImage(out vec4 O, vec2 C)
{
    vec3 r=iResolution,c=vec3(0);
    vec4 p,d=normalize(vec4(C-.5*r.xy,r.y,.5));
 	for(float i=0.,s,e,g=0.,t=asin(sin(iTime/60.))*60.;i++<80.;){
        p=g*d;
        p.xyz=R(p.xyz,normalize(H(t*.07)*2.-1.),g*.5);
        p.xyz=R(p.xyz,vec3(.577),clamp(sin(t*.5+sin(t*2.)*.3)*6.,-1.,-.5)+.6);
        p+=vec4(sin(t*.3 +sin(t*.5)*.2)*.03,sin(t*.2+sin(t*.5)*.1)*.02,t*.3,0) ;
        p=asin(sin(abs(p)*(2.+sin(t*.5+sin(t*.3)*.2)*.05)));
        s=3.;
        for(int i=0;i++<6;)
            p=p.x<p.y?p.wzxy:p.wzyx,
            s*=e=max(1./dot(p,p),1.4),
                p=abs(p)*e-vec4(1.2,1.5,1.2,.8),
            p.yzw=R(p.yzw,normalize(H(t*.05)),t*.2);
        g+=e=length(p.xw)/s+1e-4;
	    c+=mix(vec3(1),H(log(s)*.3+t*.3),.4)*.02/exp(.08*i*i*e);
	}
	c*=c*c*c*c;
    O=vec4(c,1);
}
