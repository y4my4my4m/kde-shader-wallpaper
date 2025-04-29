// https://www.shadertoy.com/view/DddGzX
// Created by vamoss in 2023-02-28

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

float rand(vec2 uv, float t) {
	return fract(sin(dot(uv, vec2(1225.6548, 321.8942))) * 4251.4865 + t);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	// Normalized pixel coordinates (from 0 to 1)
	vec2 uv = fragCoord/ubuf.iResolution.xy;

	float r = rand(uv, ubuf.iTime);
	float g = rand(uv+0.1, ubuf.iTime);
	float b = rand(uv+0.2, ubuf.iTime);

	// Time varying pixel color
	vec3 col = vec3(r, g, b);

	// Output to screen
	fragColor = vec4(col,1.0);
}


void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
