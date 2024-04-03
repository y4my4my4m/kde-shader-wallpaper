// https://www.shadertoy.com/view/3tf3zS
// Credits to eiffie

// Crazy Springs by eiffie (re-uploaded)

#define time iTime
#define size iResolution

float f1,f2,f3;
vec3 crazy(vec3 g){return sin(g.yzx*f1+g.zxy*f2+g*f3)*0.25;}
vec3 mcol=vec3(0.0);
float DE(vec3 p){//trying to get by with just the bounding 4 points
 vec3 g=floor(p+0.5);
 vec3 g1=g+crazy(g);
 vec4 dlt=vec4(sign(p-g1),0.0);
 vec3 g2=g+dlt.xww;
 vec3 g3=g+dlt.wyw;
 vec3 g4=g+dlt.wwz;
 g1-=p;
 g2+=crazy(g2)-p;
 g3+=crazy(g3)-p;
 g4+=crazy(g4)-p;
 vec3 gD=g2-g1,gDs=gD;
 float t1=clamp(dot(-g1,gD)/dot(gD,gD),0.0,1.0);
 vec3 p1=mix(g1,g2,t1);
 float m1=dot(p1,p1);
 gD=g3-g1;
 float t2=clamp(dot(-g1,gD)/dot(gD,gD),0.0,1.0);
 vec3 p2=mix(g1,g3,t2);
 float m2=dot(p2,p2);
 if(m2<m1){m1=m2;t1=t2;p1=p2;gDs=gD;}
 gD=g4-g1;
 t2=clamp(dot(-g1,gD)/dot(gD,gD),0.0,1.0);
 vec3 p3=mix(g1,g4,t2);
 m2=dot(p3,p3);
 if(m2<m1){m1=m2;t1=t2;p1=p3;gDs=gD;}
 float d1=sqrt(min(dot(g1,g1),min(dot(g2,g2),min(dot(g3,g3),dot(g4,g4)))))-0.15;
 float len=length(gDs);
 float d2=sqrt(m1)-0.07+len*sqrt(d1)*0.03;//0.02
 float d=0.25;
 if(d2<d && d2<d1){
  if(d2<0.015){
   gDs/=len;
   gD=normalize(cross(gDs,vec3(1.0,0.0,0.0)));
   float b=dot(p1,gD),c=dot(p1,cross(gDs,gD));
   vec2 v=vec2(d2,(fract( (t1*16.0+atan(b,c)*0.795775))-0.5)*0.05*len);
   d2=length(v)-0.01;
  }
  d=d2;
 }
 if(mcol.x>0.0){
   if(d1<0.005)mcol+=vec3(0.6,0.2,0.0)+sin(g*2.0)*0.2;
   else mcol+=vec3(0.5,0.4,0.2)+sin(p*100.0)*0.1;
 }
 return min(d,d1);
}
mat3 lookat(vec3 fw,vec3 up){
 fw=normalize(fw);vec3 rt=normalize(cross(fw,up));return mat3(rt,cross(rt,fw),fw);
}
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
 f1=fract(time*0.01)*6.2832;f2=6.2832*(1.0-fract(time*0.013));f3=6.2832*(fract(time*0.017));
 vec3 ro = vec3(0.5,0.5,time);
 mat3 rotCam=lookat(vec3(sin(time*0.9)*0.5,sin(time*1.4)*0.3,1.0),vec3(sin(time*0.3),cos(time*0.3)*vec2(cos(time*0.5),sin(time*0.5))));
 vec3 rd = rotCam*normalize(vec3((size.xy-2.0*fragCoord.xy)/size.y,1.75));
 float t=0.0,d=1.0,dm=1.0,tm=0.0;
 for(int i=0;i<32;i++){
  t+=d=DE(ro+rd*t);
  if(d<dm){dm=d;tm=t;}
 }
 vec3 L=normalize(vec3(0.3,0.7,-0.4));
 vec3 col=vec3(0.5,0.6,0.7)*pow(0.75+0.25*dot(rd,L),2.0)+rd*0.1;
 float pxl=1.0/size.y;
 if(d<pxl*10.0){
  mcol.x=0.1;
  vec3 p=ro+rd*tm;
  vec2 v=vec2(pxl,0.0);
  vec3 N=normalize(vec3(DE(p+v.xyy)-DE(p-v.xyy),DE(p+v.yxy)-DE(p-v.yxy),DE(p+v.yyx)-DE(p-v.yyx)));
  vec3 scol=mcol*0.16*(1.0+dot(N,L))/(1.0+0.01*t*t);
  scol+=vec3(0.5,0.2,0.75)*pow(max(0.0,dot(reflect(rd,N),L)),8.0);
  mcol=vec3(0.0);
  scol*=clamp((DE(p+N*0.03125)+DE(p+N*0.0125))*20.0,0.25,1.0);//cheat from mu6k
  scol=mix(col,scol,exp(-t*0.4));
  col=mix(scol,col,smoothstep(0.0,0.01,dm));
 }
 fragColor = vec4(clamp(col*1.5,0.0,1.0),1.0);
}
