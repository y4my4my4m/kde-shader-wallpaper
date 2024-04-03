// by: Xor
// url: https://www.shadertoy.com/view/cttyzf

/*
    "Waves" by @XorDev

    X: X.com/XorDev/status/1722433311685906509
    
    <300 chars playlist: shadertoy.com/playlist/fXlGDN
*/
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


void mainImage( out vec4 O, vec2 I)
{
    O *= 0.;
    vec3 p,r=ubuf.iResolution;for(float i=texture(iChannel0,I/1024.).r+9.; i++<1e2; 
    O+=max(cos(dot(cos(p=vec3((I-r.xy*.5)/r.x*i,i+ubuf.iTime/.1)*.2),sin(p.yzx*.8))*4.+p.z+vec4(0,1,2,3)),0.)/i*.7); 
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
