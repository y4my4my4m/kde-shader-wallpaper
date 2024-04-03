// URL: shadertoy.com/view/MlsGWX
// By: sben

// Created by sofiane benchaa - sben/2015
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

#define FIELD 20.0
#define HEIGHT 0.7
#define ITERATION 2
#define TONE vec3(0.5,0.2,0.3)

float eq(vec2 p,float t){
	float x = sin( p.y +cos(t+p.x*.2) ) * cos(p.x-t);
	x *= acos(x);
	return - x * abs(x-.5) * p.x/p.y;
}

void mainImage( out vec4 O, vec2 U ) {
	O -= O; vec4 X=O;
	vec2  p = 20.*(U / ubuf.iResolution.xy  +.5);
	float t = ubuf.iTime,i,
         hs = 20.*(.7+cos(t)*.1),
	      x = eq(p,t), y = p.y-x;
    
    for(float i=0.; i<2.; ++i)
		p.x *= 2.,
        X = x + vec4(0, eq(p,t+i+1.), eq(p,t+i+2.) ,0),
        x = X.z += X.y,
        O += vec4(.5,.2,.3,0) / abs(y-X-hs);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
