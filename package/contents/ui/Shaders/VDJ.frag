// https://www.shadertoy.com/view/WtSGzW
// Created by drak92 in 2019-05-23

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
	// Normalized pixel coordinates (from 0 to 1)
	vec2 uv = fragCoord/ubuf.iResolution.xy;

	// Time varying pixel color
	vec3 col = 0.5 + 0.5*cos(ubuf.iTime+uv.xyx+vec3(0,2,4));

	// Output to screen
	fragColor = vec4(col,1.0);
}


void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
