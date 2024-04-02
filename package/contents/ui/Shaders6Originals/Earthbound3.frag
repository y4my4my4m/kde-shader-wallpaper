// From https://www.shadertoy.com/view/wtXyz4
// Credits to thefox231
// Modified by @y4my4my4m
// TODO: modify pixelization and colors via GUI
#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    vec3 iResolution;
    vec3 iChannelResolution[4];
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;
vec2 fragCoord = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * ubuf.iResolution.xy;

float iTime = ubuf.iTime;
vec3 iResolution = ubuf.iResolution;

const vec3 mainColor = vec3(.23, .15, .82);

float spiral(vec2 m, float t) {
	float r = length(m);
	float a = atan(m.y, m.x);
	float v = sin(50.*(sqrt(r)-0.02*a-.3*t));
	return clamp(v,0.,1.);

}

void main(){
    vec2 uv = fragCoord/iResolution.xy;

    // fix aspect ratio
    float aspectRatio = iResolution.x / iResolution.y;
    uv.x *= aspectRatio;
    uv.x -= (aspectRatio - 1.) * .5;

    // pixelate
    float pxAmt = 256.;

    uv.x = floor(uv.x * pxAmt) / pxAmt;
    uv.y = floor(uv.y * pxAmt) / pxAmt;

    // interlacing .
    if (mod(fragCoord.y, 2.) < 1.) {
        uv += .4 + sin(iTime * .5 + uv.y * 5.) * (.3 + sin(iTime) * .1);
    } else {
        uv -= .4 + sin(iTime * .5 + uv.y * 5. + .5) * (.3 + sin(iTime) * .1);
    }

    // spiralllllllllllllll
    vec3 color = mainColor * spiral(uv - .5, iTime * .2 + sin(uv.y * 7.) * .2);

    // color shortening
    // gives it a kind of like snes-like palette
    float shortAmt = 4.0;
    color = ceil(color * shortAmt) / shortAmt;

    fragColor = vec4(color,1.0);
}
