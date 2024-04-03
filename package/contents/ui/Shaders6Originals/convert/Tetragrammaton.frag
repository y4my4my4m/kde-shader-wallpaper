
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
void mainImage(out vec4 c,in vec2 oo){
vec2 R=ubuf.iResolution.xy;float n=(min(R.x,R.y))/320.0;oo/=n;oo-=R/n/2.0;
vec2 o = oo;float y=floor(o.y/2.0);float x=floor(o.x/2.0);
float r=(x*x+y*y)-ubuf.iTime;float r2=sqrt(x*x+y*y);
c=(vec4(ceil(sin(r))+mod(y,2.0))+vec4(ceil(cos(r))+mod(x,2.0)))*(vec4(ceil(sin(r2))+mod(y,2.0))+vec4(ceil(cos(r2))+mod(x,2.0)));
if(c.x<0.0) c=vec4(1); if (c.x>1.0) c=vec4(1);
if(abs(x)>64.0||abs(y)>64.0) c=vec4(1);
if(abs(x)>56.0)c-=mod(x,2.0)*mod(y,2.0);
if (abs(y-x)>72.0&&abs(y-x)<90.0)c-=mod(x,2.0)*mod(y,2.0);
if(abs(y)>56.0)c-=mod(x,2.0)*mod(y,2.0);
if (abs(y+x)>72.0&&abs(y+x)<90.0)c-=mod(x,2.0)*mod(y,2.0);
if(r2<49.0&&r2>38.0)c-=mod(x,2.0)*mod(y,2.0);
x=float(int(x)/2);y=float(int(y)/2);float r3=pow(x,2.0)+pow(y,2.0);
float r0=(float(int(o.x+256.0)/2))*(float(int(o.x+256.0)/2))+(float(int(o.y+256.0)/2))*(float(int(o.y+256.0)/2))-ubuf.iTime;
if((y)>33.0&&(y)<37.0&&abs(x)<37.0) {c+=vec4(ceil(sin(r0+1.0)*4.0));if(mod(o.x,12.0)<=4.0)c=vec4(1);}
if((y)<-33.0&&(y)>-37.0&&abs(x)<37.0) {c+=vec4(ceil(sin(r0+2.0)*4.0));if(mod(o.x,12.0)<=4.0)c=vec4(1);}
if((x)>33.0&&(x)<37.0&&abs(y)<37.0) {c+=vec4(ceil(sin(r0+3.0)*4.0));if(mod(o.y,12.0)<=4.0)c=vec4(1);}
if((x)<-33.0&&(x)>-37.0&&abs(y)<37.0) {c+=vec4(ceil(sin(r0+4.0)*4.0));if(mod(o.y,12.0)<=4.0)c=vec4(1);}
if(abs(x)>=33.0&&abs(y)>=33.0&&abs(x)<38.0&&abs(y)<38.0)c=vec4(1);
if(abs(x)>=34.0&&abs(y)>=34.0&&abs(x)<37.0&&abs(y)<37.0)c=vec4(mod(floor(o.x/2.0),2.0)*mod(floor(o.y/2.0),2.0));
x*=2.0;y*=2.0;if(abs(x)>75.0||abs(y)>75.0)c=vec4(0);
if(r2<=48.0&&r2>=46.0)c=vec4(1);
if(r2<=42.0&&r2>=40.0)c=vec4(1);
if(r2<=38.0&&r2>=35.0)c=vec4(1);
if(abs(x)==74.0&&(y)<=74.0&&(y)>=-74.0)c=vec4(1);
if(abs(y)==74.0&&(x)<=74.0&&(x)>=-74.0)c=vec4(1);
x=floor((x+26.0)/4.0);
y=float(int(y)/4);
y-=4.0;r=(x*x+y*y)-ubuf.iTime;
vec2 ok=o;o=vec2(int(o.x)/2,int(o.y)/2)*2.0;
if(o.x<172.0-o.y&&o.x>154.0-o.y&&abs(o.x)<112.0&&abs(o.y)<114.0&&oo.x>0.0&&oo.y>0.0){ 
    r2=(o.x*o.x+o.y*o.y)/2.0+ubuf.iTime;
    if(c.x<0.0)c=vec4(0);
    if(c.x>1.0)c=vec4(1.0);
    c+=float(int(mod(floor((o.x+o.y)/8.0),8.0)*mod(floor((o.x-o.y+ubuf.iTime*8.0)/4.0),4.0)==0.0));
}else if(o.x>-170.0-o.y&&o.x<-150.0-o.y&&abs(o.x)<110.0&&(o.y)>-112.0&&o.x<0.0&&o.y<0.0){
    r2=(o.x*o.x+o.y*o.y)/2.0+ubuf.iTime;
    if(c.x<0.0)c=vec4(0);
    if(c.x>1.0)c=vec4(1.0);
    c+=float(int(mod(floor((o.x+o.y)/8.0),8.0)*mod(floor((o.x-o.y+ubuf.iTime*8.0)/4.0),4.0)==0.0));
}else if(o.x<170.0+o.y&&o.x>150.0+o.y&&abs(o.x)<112.0&&abs(o.y)<112.0&&abs(o.x)<120.0&&o.y<0.0&&o.x>0.0){
    r2=(o.x*o.x+o.y*o.y)/2.0+ubuf.iTime;
    if(c.x<0.0)c=vec4(0);
    if(c.x>1.0)c=vec4(1.0);
    c+=float(int(mod(floor((o.x-o.y)/8.0),8.0)*mod(floor((o.x+o.y+(ubuf.iTime)*8.0)/4.0),4.0)==0.0));
}else if(o.x>-170.0+o.y&&o.x<-152.0+o.y&&(o.x)>-112.0&&abs(o.y)<114.0){
    r2=(o.x*o.x+o.y*o.y)/2.0+ubuf.iTime;
    if(c.x<0.0)c=vec4(0);
    if(c.x>1.0)c=vec4(1.0);
    c+=float(int(mod(floor((o.x-o.y)/8.0),8.0)*mod(floor((o.x+o.y+ubuf.iTime*8.0)/4.0),4.0)==0.0));
}  o=ok;if((o.x)>-38.0&&o.x<40.0&&abs(o.y)<14.0){
    c*=vec4(ceil(sin(r)*4.0));
    if(c.x<0.0)c=vec4(0);
    if(c.x>1.0)c=vec4(1.0);
    c +=mod(floor(o.x/2.0),2.0)*mod(floor(o.y/2.0),2.0);
} if(r2<47.0&&r2>41.0){
        r2=(o.x*o.x+o.y*o.y)/1024.0;
        c*=vec4(ceil(sin(r2)*256.0));
        if(c.x<0.0)c=vec4(0);
        if(c.x>1.0)c=vec4(1.0);
        c +=float(mod(degrees(atan(o.y,o.x))+180.0-ubuf.iTime*8.0,8.0)<2.0);
    }if(c.x>1.0)c=vec4(1);
     if((o.y)>=116.0&&(o.y)<=120.0&&abs(o.x)<118.0)c=vec4(1);
     if((o.y)<=-114.0&&(o.y)>=-118.0&&abs(o.x)<118.0)c=vec4(1);
     if((o.x)>=116.0&&(o.x)<=120.0&&abs(o.y)<118.0)c=vec4(1);
     if((o.x)<=-114.0&&(o.x)>=-118.0&&abs(o.y)<118.0)c=vec4(1);
     if((o.y)>=126.0&&(o.y)<=130.0&&abs(o.x)<128.0)c=vec4(1);
     if((o.y)<=-124.0&&(o.y)>=-128.0&&abs(o.x)<128.0)c=vec4(1);
     if((o.x)>=126.0&&(o.x)<=130.0&&abs(o.y)<128.0)c=vec4(1);
     if((o.x)<=-124.0&&(o.x)>=-128.0&&abs(o.y)<128.0)c=vec4(1);
     if(abs(o.y)<112.0&&abs(o.y)>100.0&&abs(o.x)<50.0&&o.x<46.0)c-=vec4(mod(floor(o.x/2.0),2.0)*mod(floor(o.y/2.0),2.0));
     if(o.y<110.0&&(abs(o.y)<112.0||o.y>-112.0&&o.y<0.0)&&abs(o.x)<112.1){
         if(abs(float(int(o.x)/2+int(o.y)/2-76))<1.0)c=vec4(1);
         if(abs(float(int(o.x)/2+int(o.y)/2+74))<1.0)c=vec4(1);
         if(abs(float(int(o.x)/2-int(o.y)/2-75))<1.0)c=vec4(1);
         if(abs(float(int(o.x)/2-int(o.y)/2+75))<1.0)c=vec4(1);
         if(abs(float(int(o.x)/2+int(o.y)/2-86))<1.0)c=vec4(1);
         if(abs(float(int(o.x)/2+int(o.y)/2+84))<1.0)c=vec4(1);
         if(abs(float(int(o.x)/2-int(o.y)/2-85))<1.0)c=vec4(1);
         if(abs(float(int(o.x)/2-int(o.y)/2+85))<1.0)c=vec4(1);
     }if(ok.y<=108.0&&ok.y>=104.0&&abs(o.x)<40.0)c=vec4(1);
     if(ok.y>=-106.0&&ok.y<=-102.0&&abs(o.x)<40.0)c=vec4(1);
     if(ok.y<=114.0&&ok.y>=112.0&&abs(o.x)<60.0&&o.x<64.0)c=vec4(1);
     if(ok.y>=-112.0&&ok.y<=-110.0&&abs(o.x)<60.0&&o.x<64.0)c=vec4(1);
     if((o.x)>-134.0&&(o.x)<-132.0&&abs(o.y)<140.0)c=vec4(1);
     if((o.x)<136.0&&(o.x)>134.0&&abs(o.y)<140.0)c=vec4(1);
     if((o.y)>-134.0&&(o.y)<-132.0&&abs(o.x)<140.0)c=vec4(1);
     if((o.y)<136.0&&(o.y)>134.0&&abs(o.x)<140.0)c=vec4(1);
     if(o.x>146.0&&o.x<150.0&&abs(o.y)<150.0)c=vec4(1);
     if(o.x<-144.0&&o.x>-148.0&&abs(o.y)<148.0)c=vec4(1);
     if(o.y>146.0&&o.y<150.0&&abs(o.x)<148.0)c=vec4(1);
     if(o.y<-144.0&&o.y>-148.0&&abs(o.x)<148.0)c=vec4(1);
     if(x<0.0&&abs(o.y)<62.0&&abs(o.y)>40.0&&abs(o.x)<112.0&&abs(o.x)>110.0)c=vec4(1);
     if(x>0.0&&abs(o.y)<62.0&&abs(o.y)>40.0&&o.x<114.0&&o.x>112.0)c=vec4(1);
 }
void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
