// https://www.shadertoy.com/view/MlXGzr
// Credits to Kali
// "Jelly-something" by Kali

const int Iterations=7;  
const float Wavelength=.5; 
const float Scale=1.5; 
const float Amplitude=.1; 
const float Speed=.3; 

vec3 z;

const vec3 fore=vec3(200.,20.,30.)/255.;
const vec3 back=vec3(45.,52.,55.)/255.;
const vec3 innards=vec3(250.,0.,0.)/255.;
const float detail=.04;

const vec3 lightdir=-vec3(-1.0,0.5,-0.5);

mat2 rot2D(float angle)
{
	float a=radians(angle);
	return mat2(cos(a),sin(a),-sin(a),cos(a));

}



float de (in vec3 p);

vec3 normal(vec3 p) {
	vec3 e = vec3(0.0,detail,0.0);
	
	return normalize(vec3(
			de(p+e.yxx)-de(p-e.yxx),
			de(p+e.xyx)-de(p-e.xyx),
			de(p+e.xxy)-de(p-e.xxy)
			)
		);	
}


vec3 light(in vec3 p, in vec3 dir) {
	vec3 ldir=normalize(lightdir);
	vec3 n=normal(p);
	float diff=max(0.,dot(ldir,-n));
	vec3 r = reflect(ldir,n);
	float spec=max(0.,dot(dir,-r));
	return diff*fore+pow(spec,40.)*.4+fore*.2+back*.3;	
		}

float kaliset(vec3 p) {
	p.x+=.23;
	p.z+=.18;
    p*=.5;
    p.y+=iTime*1.5;
    p.y=abs(2.-mod(p.y,4.));
    for (int i=0;i<8;i++) p=abs(p)/dot(p,p)-.8;
    return p.y;
}

float rnd(vec2 co){
	return fract(sin(iTime*.1+dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}


vec3 raymarch(in vec3 from, in vec3 dir) 
{
    vec3 odir=dir;
    float totdist=0., v=0.;
	vec3 col=vec3(0.), p;
	float d=9999.;
	for (int i=0; i<80; i++) {
        if (d>detail && totdist<50.) {
        	p=from+totdist*dir;
			d=de(p);
			totdist+=d*.8; 
            v++;
			dir=normalize(odir+pow(max(0.,totdist*totdist-9.),2.)*.0000003*vec3(rnd(dir.xy*5.21358),rnd(dir.yz*3.12568),rnd(dir.zx*2.12358)));
        }
	}
	totdist=min(50.,totdist);
		dir=normalize(odir+.1*vec3(rnd(dir.xy*5.21358),rnd(dir.yz*3.12568),rnd(dir.zx*2.12358)));
    vec3 backg=back*(1.+pow(1.-dot(normalize(90.*dir),normalize(lightdir)),2.5));
    if (d<detail) {
		float k=kaliset(p);
        col=light(p-detail*dir, dir)+k*.05*(innards+.3); 
    } else {
        col=backg+v*.015*pow(1.-dot(normalize(90.*dir),normalize(lightdir)),2.5);
    }
	col = mix(col*1.2, backg, 1.0-exp(-.0045*totdist*totdist));
	return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 mouse=iMouse.xy/iResolution.xy;
	float time=iTime*.5;
	vec2 uv = fragCoord.xy / iResolution.xy;
	uv=uv*2.-1.;
	uv.y*=iResolution.y/iResolution.x;
	uv=uv.yx;
	vec3 from=vec3(.5,0.,-18.+cos(time*.8)*4.5);
	vec3 dir=normalize(vec3(uv*.8,1.));
	mat2 camrot1=rot2D(50.);
	mat2 camrot2=rot2D(190.+sin(time*.5)*80.);
	mat2 camrot3=rot2D((sin(time))*10.);
	from.xz=from.xz*camrot1;
	dir.xz=dir.xz*camrot1;
	from.xy=from.xy*camrot2;
	dir.xy=dir.xy*camrot2;
	dir.yz=dir.yz*camrot3;
	
	vec3 col=raymarch(from,dir); 
	col=pow(col,vec3(1.3))*vec3(1.,1.2,1.2);
	fragColor = vec4(col,1.0);
}


float de(vec3 pos)
{
	float time=iTime;
	z=pos;
	float O=7.;
	float sc=1.;
	float tsc=pow(Scale,float(Iterations));
	float t=time*Speed*10./tsc+100.;
	float amp1=Amplitude;
	float amp2=amp1*1.1256;
	float amp3=amp1*1.0586;
	float amp4=amp1*0.9565;
	float l1=length(z.xy-vec2(O*1.1586,0));
	float l2=length(z.xy+vec2(O*.98586,0));
	float l3=length(z.xy+vec2(0,O*1.13685));
	float l4=length(z.xy-vec2(0,O));
	for (int n=0; n<Iterations ; n++) {
		z+=sin(length(z.xy)*sc*Wavelength-t)*amp1/sc*2.;
		z+=sin(l1*sc*Wavelength-t)*amp1/sc;
		z+=sin(l2*sc*Wavelength-t)*amp2/sc;
		z+=sin(l3*sc*Wavelength-t)*amp3/sc;
		z+=sin(l4*sc*Wavelength-t)*amp4/sc;
		t=t*Scale*Scale;
		sc*=Scale;
	}
	//z.z*=3.;
	float wd=-z.z+2.;
	return length(z)-6.;
}
