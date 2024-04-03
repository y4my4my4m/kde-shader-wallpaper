// url: https://www.shadertoy.com/view/NtSBR3
// credits: supah

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

float map(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

float bar(vec2 uv, float start, float height) {
    return step(uv.y, height + start) - step(uv.y, start);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/ubuf.iResolution.xy;
    
    vec3 col = vec3(0.3, 0.0, 0.0);
    
    
    for (float i = -0.; i < 1.3; i += 0.1) {
        float wave = sin((i*12. + ubuf.iTime * 2. + uv.x * 5.) * .4) * .08 * (1.1 - i);
        uv.y += wave;
        col += vec3(.1 + i * .005, i * .1, 0.003) * bar(uv, i + .1, i + 1.);
    }
    
    fragColor = vec4(col + vec3(0., 0., col.r * sin(.3 + ubuf.iTime) * .3),1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
