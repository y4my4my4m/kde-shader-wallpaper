// https://www.shadertoy.com/view/7lXfz7
// Credits to Drakyen
#define rot(a) mat2(cos(a),sin(a),-sin(a),cos(a))

vec2 uv;
vec3 cp,cn,cr,ss,oc,gl,vb,rp;
vec4 fc,cc;
float tt,cd,sd,md,io,oa,td,tc;
int es=0,ec;



//-------------- CHANGE THIS TO FALSE FOR HIGH QUALITY (but much slower)
#define LOWQ true


float bx(vec3 p,vec3 s){vec3 q=abs(p)-s;return min(max(q.x,max(q.y,q.z)),0.)+length(max(q,0.));}

float h11 (float a){return fract(sin((a)*12.9898)*43758.5453123);}

vec3 rdg = vec3(0);
float dibox(vec3 p,vec3 b,vec3 rd){
    vec3 dir = sign(rd)*b;   
    vec3 rc = (dir-p)/rd;
    return min(rc.x,rc.z); 
}

float mp(vec3 p)
{
		vec3 pp=p;

		p.z = mod(p.z, 25.);
	
		vec4 range = vec4(-25, 50, -25, 50);
	
		vec2 axis = p.xz;
	
		float id = 0.;
	
		vec2 diff = vec2(1);
	
		for(float i = 1.; i < 5.; i++)
		{
			float shiftFreq = pow(i/5.,8.);
			float hash1 = tanh(sin(i*2.+tt+id)*shiftFreq*50.)*0.35+0.5;
			float hash2 = tanh(cos(i*3.+tt+id*3.)*shiftFreq*40.)*0.35+0.5;			
            vec2 pos = vec2(hash1, hash2) * 0.4 + 0.3;
			vec2 di=range.xz+range.yw*pos;
			diff = step(p.xz,di)-vec2(h11(diff.x)*10.,h11(diff.y)*10.);
			id = length(diff)*100.0;
            if(di.x<axis.x){range.y=range.x+range.y-di.x;range.x=di.x;}
            else range.y=di.x-range.x;
            if(di.y<axis.y){range.w=range.z+range.w-di.y;range.z=di.y;}
            else range.w=di.y-range.z;  
		}
	
		p.xz -= range.xz + range.yw * 0.5;
		
		vec3 bs = vec3(range.y*0.5,1,range.w*0.5);
		
		float hid = h11(id);
		
		float h = (hid > 0.5 && length(range.x) > 5. && length(range.z) > 5.) ? clamp(h11(id+1.)*20.,5.,20.) : 1.;
		
		sd = bx(p,bs+vec3(-0.2,h+0.1,-0.2));
        
        vec2 pv = abs(p.xz) - bs.xz + vec2(0.3);
        vec3 pvv = vec3(pv.x, p.y, pv.y);
        
        float ebx = bx(pvv,vec3(0.0,h+0.7,0.0))-0.18;
        
        sd = min(sd, ebx);
		
		float bound = abs(dibox(p, bs+vec3(0,h,0),rdg))+0.02;
		
		sd=min(sd, bound);
		
		float g = pp.y-1.95;
		
		gl += exp(-g*25.) * mix(vec3(0,0.4,1), vec3(0.5,0.2,1.),hid)*2.;
		
		float tb = bx(p - vec3(0,h+1.,0),bs+vec3(0,-0.99,0.));
		
		if(h>1.) gl += exp(-tb*3.) * mix(vec3(0.9,0.2,0.2), vec3(0.2,0.2,0.9),pow(hid,2.))*2.;
		
		vec3 pos = pp-rp-vec3(-1,0,50);
		pos.xz*=rot(tt*0.1);
		float bh = 15.+sin(tt*0.5);
		float bp = bx(pos,vec3(3.5,bh,3.5));
		
		float spire = length(pos-vec3(0,bh+2.,0)) - 6.5;
		
		pos.xz=abs(pos.xz) - 3.5;
		float bpe = bx(pos,vec3(0.01,bh,0.01))-0.05;
		
		sd =min(sd,spire);
        
        
		gl += exp(-bpe*5.) * vec3(0,0.5,1)*5.;
		sd = min(sd, bpe);
		sd = min(sd,bp);
		sd=min(sd,g);
        
        
		if(h>1.) sd=min(sd,tb);

		sd=abs(sd)-0.01;

		if(sd<0.06)
		{	
			io=-1.;
			oc=vec3(0.,0.,0.1);
            float ran = pow(1.-pow(cos(tt*0.3)*0.5+0.5,5.),5.);
			oa=spire<sd+0.1?0.1:mix(0.5,1.,1.-ran);
            if(ebx<sd+0.1)oa=1.;
			ss=vec3(0.);
			ec=2;	
		}
		return sd;
}

void nm(){mat3 k=mat3(cp,cp,cp)-mat3((LOWQ?0.01:0.001));cn=normalize(mp(cp)-vec3(mp(k[0]),mp(k[1]),mp(k[2])));}

float tr(vec3 ro, vec3 rd)
{rdg=rd;cd=0.;md=64.;for(tc=1.;tc<(LOWQ?64.:256.);tc++){mp(cp=ro+rd*cd);cd+=sd;td+=sd;
if(sd<md&&sd<cd-0.06)md=sd;if(sd<(LOWQ?0.01:0.0001)||cd>64.)break;}nm();return cd;}


void px(vec3 rd)
{
  cc.rgb=vec3(0.,0.,0.1)+length(pow(abs(rd+vec3(0,0,0)),vec3(10)))*vec3(0.1,0.,0.1)+gl/tc;
  if(cd>64.){cc.a=1.;return;}cc.a=oa;
    vec3 ld = -normalize(cp+cn-vec3(10.,10,-20.+mod(tt*3.,25.)));
  float df=clamp(length(cn*ld),0.,1.);
  vec3 fr=pow(1.-abs(dot(rd,-cn)),3.)*mix(cc.rgb,vec3(0.4),0.3)*0.5;
  cc.rgb=(oc*(df+fr+ss)+fr+gl/tc);tr(cp+cn*0.06,ld);
	
}

vec3 cam()
{
	return vec3(2.5,4,mod(tt*3.,25.));
}

vec3 look(vec3 ro)
{
	return ro + vec3(sin(tt*0.1)*0.05,sin(tt*0.2)*0.1+0.1,1);
}

vec3 ray(vec3 p, vec3 l, vec2 uv, float z) {
    vec3 f = normalize(l-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f,r),
        c = f*z,
        i = c + uv.x*r + uv.y*u,
        d = normalize(i);
    return d;
}

void render(vec2 frag, vec2 res, float time, out vec4 col)
{
  uv=vec2(frag.x/res.x,frag.y/res.y);
  uv-=0.5;uv/=vec2(res.y/res.x,1);
	tt=mod(time,300.);
  vec3 ro=rp=cam(),rd=ray(ro,look(ro),uv, 1.);
	
	for(int i=0;i<(LOWQ?5:10);i++)
  {
		float d=tr(ro,rd);
		ro=cp-cn*(io<0.?-0.01:0.01);
		cr=refract(rd,cn,i%2==0?1./io:io);
		i=io<0.?i+1:i;
    if((length(cr)==0.&&es<=0)||io<0.)
		{cr=reflect(rd,cn);es=(io<0.?es:ec);}
		px(rd); if(max(es,0)%3==0&&d<64.)rd=cr;es--;
		fc=fc+vec4(cc.rgb*cc.a,cc.a)*(1.-fc.a);
		if(fc.a>=1.)break;
  }
  col = fc/fc.a;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    render(fragCoord.xy,iResolution.xy,iTime,fragColor);
}