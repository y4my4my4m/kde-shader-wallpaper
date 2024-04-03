// https://www.shadertoy.com/view/td3XW2
// Credits to andremichelle

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

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord-ubuf.iResolution.xy*0.5)/ubuf.iResolution.y*2.0;

    float a = atan(uv.y, uv.x);
    float l = length(uv);

    float x = 48.0*(l-0.3+sin(ubuf.iTime)*0.06125);
    float c = abs(cos(x*2.0)/x)*max(0.0,(1.75-abs(x*0.001*(0.5*sin(ubuf.iTime)*0.5))));
    float d = 0.0;
    float t = ubuf.iTime*0.75;
    d += sin(a*1.0+t*0.5);
    d += sin(a*2.0-t*1.2);
    d += sin(a*3.0+t*1.5);
    d += sin(a*2.0-t*1.7);
    d += sin(a*1.0+t*3.8);
    float amount = c*d;
    vec3 col = vec3(1.0,0.8,0.2)*(0.05+amount*0.3);
    fragColor = vec4(col,1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
