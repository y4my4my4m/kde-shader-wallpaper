// URL: https://www.shadertoy.com/view/fdXSDX
// By: totetmatt

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

float box(vec2 uv,vec2 b){
    vec2 q = abs(uv)-b;
    return length(max(q,vec2(0.)))+ min(max(q.x,q.y),0.);
}
vec3 pal(float t){
    return vec3(.5,.4,.5)+vec3(.5,.4,.5)*cos(6.28*(vec3(1.,1.,1.)*t+vec3(.40,.55,.60)));
}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (fragCoord.xy -.5* ubuf.iResolution.xy)/ubuf.iResolution.y;
    float tempo=clamp(sin(ubuf.iTime*.33),0.,.5);
    uv*=4.+tempo;
    uv+=fract(ubuf.iTime*.01)*3.1415*2.;

    uv*=rot(.785);
    vec2 id = floor(uv);
   uv = fract(uv)-.5;
    if(mod(id.x,2.)==1.) { uv.x*=-1.;}
        if(mod(id.y,2.)==1.) { uv.y*=-1.;}
    vec3 col = vec3(.1);
    float ll = 50.;
     float  a= 1./30.;
      if(uv.x >uv.y){
      a+=sin(uv.y*4.)*.05+.05;
      }
      else {
       a+=sin(uv.x*4.)*.05+.05;
      }
      a+=clamp(cos(ubuf.iTime*.99)*.5,-.00,.25);
     float rto = dot(vec2(1,1),vec2(1,0)*rot(3.1415*a));
     
     float d = 0.;
    for(float i=0.;i<=ll;i++){
    float l = box(uv,vec2(1.0));
      

      l = smoothstep(0.02,0.00099,(abs(l)-(.005-(1.-i)*.005)));
      

      d+=l;
     
      uv*=rot(3.1415*a);
      
      float q = rto;
      uv*= q;
  
      
    }
    //d= d/ll;
    
    col = mix(vec3(0.1)+pal(tempo),vec3(.3,.5,.7),vec3(d));pal(d/ll);
    fragColor = vec4(col,1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
