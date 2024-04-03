// https://www.shadertoy.com/view/4dBSRK
// Credits to inigo quilez - iq/2014
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

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
    vec2  px = 4.0*(-ubuf.iResolution.xy + 2.0*fragCoord.xy) / ubuf.iResolution.y;

    float id = 0.5 + 0.5*cos(ubuf.iTime + sin(dot(floor(px+0.5),vec2(113.1,17.81)))*43758.545);

    vec3  co = 0.5 + 0.5*cos(ubuf.iTime + 2.0*id + vec3(0.0,1.0,2.0) );

    vec2  pa = smoothstep( 0.0, 0.2, id*(0.5 + 0.5*cos(6.2831*px)) );

    fragColor = vec4( co*pa.x*pa.y, 1.0 );
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
