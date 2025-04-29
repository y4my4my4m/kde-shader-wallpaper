// https://www.shadertoy.com/view/t3f3RS
// Created by diatribes in 2025-03-28

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

#define P(z) vec3(sin(ubuf.iTime),0,(z))
#define T ubuf.iTime
#define rot(a) mat2(cos(a+vec4(0,33,11,0)))

void mainImage( out vec4 o, in vec2 u )
{
	float s=.002,d=0.,i=0.;
	vec3  r = ubuf.iResolution;

	vec3  p = P(T),ro=p,
	Z = normalize( P(T+1.) - p),
	X = normalize(vec3(Z.z,0,-Z)),
	D = vec3(rot(sin(T*.4)*3.)*(u-r.xy/2.)/r.y, 1)
	* .5 * mat3(-X, cross(X, Z), Z);
	o -= o;
	for(; i++ < 120. && s > .001;) {
		p = ro + D *d;
		float g = dot(sin(.55*p)+sin(p),sin(.75*p)) +
		dot(sin(.35*p),cos(p*.4));
		p.x -= .5;
		p.y += sin(p.z)*g*.3 + sin(6.*T+p.z*6.)*.1;
		s = length(p.xy - P(p.z).xy) - .1;
		for (float a = .5; a < 4.;
		     s -= abs(dot(sin(T+T+T+p * a * 16.), vec3(.0125))) / a,
		     a += a);
		d += s;
		o.rgb += sin(p*10.) *.012 + .02;
	}

	o.rgb = pow(o.rgb * exp(-d/5.), vec3(.45));
}


void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
