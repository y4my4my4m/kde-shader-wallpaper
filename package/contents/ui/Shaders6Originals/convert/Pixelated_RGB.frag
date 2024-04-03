// https://www.shadertoy.com/view/wscGWl
// Credits to reyemxela

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

float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); } // random noise

float getCellBright(vec2 id) {
    return sin((ubuf.iTime+2.)*rand(id)*2.)*.5+.5; // returns 0. to 1.
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	float mx = max(ubuf.iResolution.x, ubuf.iResolution.y);
	vec2 uv = fragCoord.xy / mx;

    float time = ubuf.iTime*.5;

    uv *= 30.; // grid size

	vec2 id = floor(uv); // id numbers for each cell
    vec2 gv = fract(uv)-.5; // uv within each cell, from -.5 to .5

	vec3 color = vec3(0.);

	float randBright = getCellBright(id);

    vec3 colorShift = vec3(rand(id)*.1); // subtle random color offset per cell

    color = 0.6 + 0.5*cos(time + (id.xyx*.1) + vec3(4,2,1) + colorShift); // RGB with color offset

    float shadow = 0.;
    shadow += smoothstep(.0, .7,  gv.x*min(0., (getCellBright(vec2(id.x-1., id.y)) - getCellBright(id)))); // left shadow
    shadow += smoothstep(.0, .7, -gv.y*min(0., (getCellBright(vec2(id.x, id.y+1.)) - getCellBright(id)))); // top shadow

    color -= shadow*.4;

    color *= 1. - (randBright*.2);

	fragColor = vec4(color, 1.0);

}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
