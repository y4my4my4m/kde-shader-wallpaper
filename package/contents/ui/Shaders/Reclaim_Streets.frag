// URL: https://www.shadertoy.com/view/fdSGWw
// By: evvvvil

// Winning shader made at Revision 2021 Shader Showdown Semi-Final

// The "Shader Showdown" is a demoscene live-coding shader battle competition.
// 2 coders battle for 25 minutes making a shader on stage. No google, no cheat sheets.
// The audience votes for the winner by making noise or by voting on their phone.

// This shader was coded live on stage in 25 minutes. Designed beforehand in several hours.

float t,tt,b,bb,g,a,la;vec2 z,v,e=vec2(.00035,-.00035);vec3 pp,op,cp,po,no,al,ld;
vec4 np; 
mat2 r2(float r){return mat2(cos(r),sin(r),-sin(r),cos(r));}
float bo(vec3 p,vec3 r){p=abs(p)-r;return max(max(p.x,p.y),p.z);}
vec2 fb( vec3 p,float i,float s)
{   
    vec2 h,t=vec2(length(p.xz)-2.-clamp(sin(p.y*5.),-.2,.2)*.2,5);
    t.x=abs(t.x)-.2;
    pp=p;
    pp.y+=1.-float(i)*2.;
    a=max(abs(bo(pp,vec3(.65,2,200)))-.2,abs(pp.y)-1.);
    t.x=min(t.x,mix(a,length(pp.xy-sin(p.z*.5))-.5,b));
    pp.x=mix(abs(pp.x)-0.7,pp.y*.5-.8,b);//lampposts
    pp.z=mod(pp.z,3.)-1.5;
    pp-=mix(vec3(0,1,0),vec3(0.,-1.3,0.)+sin(p.z*.5),b);        
    t.x=min(t.x,bo(pp,vec3(.1,2,.1))); 
    pp.y-=2.;     //lamps
    la=length(pp)-.1;
    g+=0.1/(0.1+la*la*40.);
    t.x=min(t.x,la);
    t.x/=s;    
    t.x=max(t.x,-(length(op.xy-vec2(-2.*b,6.-float(i)*.1))-5.));
    t.x=max(t.x,(abs(op.y)-5.+float(i))); 
    h=vec2(length(p.xz)-1.+(pp.y*.1/float(i*2.+1.)),3); //black
    h.x/=s;
    h.x=max(h.x,-(length(op.xy-vec2(0,6.1+3.*b-float(i)*.1))-5.));    
    h.x=max(h.x,(abs(op.y)-5.5-5.*b+float(i)));
    t=t.x<h.x?t:h;
    if(i<2.){
        h=vec2(abs(length(p.xz)-1.2)-.1,6);
        h.x/=s;    
        h.x=max(h.x,-(length(op.xy-vec2(-1.*b,6.2-float(i)*.1))-5.));    
        h.x=max(h.x,(abs(op.y)-6.+float(i)));        
        t=t.x<h.x?t:h;
    }   
    return t;
}
vec2 mp( vec3 p,float ga)
{  
  p.yz*=r2(mix(-.785,-.6154,bb));
  p.xz*=r2(mix(0.,.785,bb));
  op=p;
  b=clamp(cos(op.z*.1+tt*.4),-.25,.25)*2.+.5;  
  p.z=mod(p.z-tt,10.)-5.;
  vec2 h,t=vec2(1000);
  np=vec4(p,1.);
  for(int i=0;i<5;i++){    
    np.xz=abs(np.xz)-2.1+sin(np.y*.5)*.5*b;
    np.xz*=r2(-.785);
    np*=2.1;    
    h=fb(np.xyz,float(i),np.w);    
    h.x*=0.75;
    t=t.x<h.x?t:h;   
  }
  h=vec2(p.y+2.+3.*cos(p.x*.35),6); 
  h.x=max(h.x,p.y);
  h.x*=0.5;
  t=t.x<h.x?t:h; 
  cp=p;
  return t;
}
vec2 tr( vec3 ro,vec3 rd,int it)
{
  vec2 h,t=vec2(-3.); 
  for(int i=0;i<it;i++){
  h=mp(ro+rd*t.x,1.);     
    if(h.x<.0001||t.x>17.) break;
    t.x+=h.x;t.y=h.y;
  }
  if(t.x>17.) t.y=0.;
	return t;
}
#define a(d) clamp(mp(po+no*d,0.).x/d,0.,1.)
#define s(d) smoothstep(0.,1.,mp(po+ld*d,0.).x/d)
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec2 uv=(fragCoord.xy/iResolution.xy-0.5)/vec2(iResolution.y/iResolution.x,1);
  tt=mod(iTime,62.82)+8.;
  bb=1.-ceil(sin(tt*.4));
  vec3 ro=vec3(uv*8.,-8.),
  rd=vec3(0.,0.,1.),co,fo;
  co=fo=vec3(.13,.1,.12)-length(uv)*.12;
  ld=normalize(vec3(-.5,.5,-.3));
  z=tr(ro,rd,128);t=z.x;  
  if(z.y>0.){   
    po=ro+rd*t;
    no=normalize(e.xyy*mp(po+e.xyy,0.).x+e.yyx*mp(po+e.yyx,0.).x+e.yxy*mp(po+e.yxy,0.).x+e.xxx*mp(po+e.xxx,0.).x);
    al=mix(vec3(.0,.1,.3),vec3(0.4,0.3,0.1),b);
    if(z.y<5.) al=vec3(0);
    if(z.y>5.) al=vec3(1),no-=0.2*ceil(abs(cos((cp)*5.2))-.05),no=normalize(no);    
    float dif=max(0.,dot(no,ld)),
    fr=pow(1.+dot(no,rd),4.),
    sp=pow(max(dot(reflect(-ld,no),-rd),0.),40.);
    co=mix(sp+al*(a(0.05)+.2)*(dif+s(.5)),fo,min(fr,.5));
    co=mix(fo,co,exp(-.001*t*t*t));
  }
  co=mix(co,co.xzy,length(uv*.7));  
  fragColor = vec4(pow(co+g*.2*mix(vec3(1.,.5,0.),vec3(1.),sin(t*5.)*.5-.2),vec3(.45)),1);
}
