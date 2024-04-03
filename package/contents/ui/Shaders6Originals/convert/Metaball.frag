// url: https://www.shadertoy.com/view/stBBD3
// credits: jiaolyulu1

//https://www.shadertoy.com/view/lsXGzM reference
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


float speed=1.;
float n=2.0;

float N21 (vec2 p){
	float d = fract(sin(p.x*110.+(8.21-p.y)*331.)*1218.);
    return d;
}

float Noise2D(vec2 uv){
    vec2 st = fract(uv);
    vec2 id = floor(uv);
    st = st*st*(3.0-2.0*st);
    float c=mix(mix(N21(id),N21(id+vec2(1.0,0.0)),st.x),mix(N21(id+vec2(0.0,1.0)),N21(id+vec2(1.0,1.0)),st.x),st.y);
	return c;
}


float blob(float x,float y,float fx,float fy,float size){
   float xx = x+abs(ubuf.iMouse.x/ ubuf.iResolution.x-0.5)*sin(ubuf.iTime/speed*size+fx)*size*7.*(1.-abs(ubuf.iMouse.x/ ubuf.iResolution.x-0.5));
   float yy = y+abs(ubuf.iMouse.x/ ubuf.iResolution.x-0.5)*cos(ubuf.iTime/speed*size+fy)*size*7.*(1.-abs(ubuf.iMouse.x/ ubuf.iResolution.x-0.5));
   float value=sqrt(xx*xx+yy*yy);

   return min(60.,20.0/value);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
   vec2 position = ( fragCoord.xy / ubuf.iResolution.xy )-0.5;
   position*=vec2(ubuf.iResolution.x/ubuf.iResolution.y,1.);
   position+=(Noise2D(position*3.+vec2(ubuf.iTime/4.))-0.5)/5.;
   position*=0.7;
   
   float mouseX=abs(ubuf.iMouse.x/ ubuf.iResolution.x-0.5);
   position*=1.0*pow((1.5-mouseX),2.);
   float x = position.x*2.0;
   float y = position.y*2.0;
   
   float a = blob(x,y,mouseX*1.+2.,1.9-mouseX,0.7) + blob(x,y,mouseX*1.+3.,1.9+mouseX,0.6) + blob(x,y,mouseX*2.+1.,0.9+1.4*mouseX,0.3) ;
   float b = blob(x,y,-mouseX*0.8+1.,1.9-1.4*mouseX,0.9) + blob(x,y,mouseX*0.25+2.,1.9-mouseX,0.3)+ blob(x,y,-mouseX*0.4+1.,1.9-0.4*mouseX,0.7) ;
   float c = blob(x,y,1.-mouseX*1.,1.9-1.3*mouseX,0.5) + blob(x,y,mouseX*1.0+1.4,1.9+2.*mouseX,0.3)+blob(x,y,-mouseX*0.2+1.,1.9-1.4*mouseX,0.7);
   a=a/170.;
   b=b/170.;
   c=c/170.;
   vec3 originABC= vec3(a,b,c);
   originABC= min(vec3(1.),originABC);
   vec3 originColor;
   originColor= mix( originABC, vec3(a*1.0,a,0.0), smoothstep(0.6,0.85,0.) );
   originColor = mix( originColor, vec3(a,a,0.0), smoothstep(0.7,0.0,1.-a) );
   originColor = mix( originColor, vec3(0.0,b,b), smoothstep(0.6,0.85,b) );
   originColor = mix( originColor, vec3(0.0,b,b), smoothstep(0.7,0.0,1.-b) );
   originColor = mix( originColor, vec3(0.,0.0,0.8*c), smoothstep(0.6,0.85,c) );
   originColor = mix( originColor, vec3(0.,0.0,c), smoothstep(0.7,0.0,1.-c) );
   originColor=min(vec3(1.),originColor);
   originColor=max(vec3(0.),originColor);
   vec3 d = 1.3-originColor*1.5;
   d=min(vec3(1.),d);
   d=max(vec3(0.),d);


   fragColor = vec4(d,1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
