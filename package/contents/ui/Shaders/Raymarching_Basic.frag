// https://www.shadertoy.com/view/Ml2XRD
// Created by gyabo in 2015-09-14

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



float map(vec3 p) {
	vec3 n = vec3(0, 1, 0);
	float k1 = 1.9;
	float k2 = (sin(p.x * k1) + sin(p.z * k1)) * 0.8;
	float k3 = (sin(p.y * k1) + sin(p.z * k1)) * 0.8;
	float w1 = 4.0 - dot(abs(p), normalize(n)) + k2;
	float w2 = 4.0 - dot(abs(p), normalize(n.yzx)) + k3;
	float s1 = length(mod(p.xy + vec2(sin((p.z + p.x) * 2.0) * 0.3, cos((p.z + p.x) * 1.0) * 0.5), 2.0) - 1.0) - 0.2;
	float s2 = length(mod(0.5+p.yz + vec2(sin((p.z + p.x) * 2.0) * 0.3, cos((p.z + p.x) * 1.0) * 0.3), 2.0) - 1.0) - 0.2;
	return min(w1, min(w2, min(s1, s2)));
}

vec2 rot(vec2 p, float a) {
	return vec2(
		p.x * cos(a) - p.y * sin(a),
		    p.x * sin(a) + p.y * cos(a));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	float time = ubuf.iTime;
	vec2 uv = ( fragCoord.xy / ubuf.iResolution.xy ) * 2.0 - 1.0;
	uv.x *= ubuf.iResolution.x /  ubuf.iResolution.y;
	vec3 dir = normalize(vec3(uv, 1.0));
	dir.xz = rot(dir.xz, time * 0.23);dir = dir.yzx;
	dir.xz = rot(dir.xz, time * 0.2);dir = dir.yzx;
	vec3 pos = vec3(0, 0, time);
	vec3 col = vec3(0.0);
	float t = 0.0;
	float tt = 0.0;
	for(int i = 0 ; i < 100; i++) {
		tt = map(pos + dir * t);
		if(tt < 0.001) break;
		t += tt * 0.45;
	}
	vec3 ip = pos + dir * t;
	col = vec3(t * 0.1);
	col = sqrt(col);
	fragColor = vec4(0.05*t+abs(dir) * col + max(0.0, map(ip - 0.1) - tt), 1.0); //Thanks! Shane!
	fragColor.a = 1.0 / (t * t * t * t);
}


void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
