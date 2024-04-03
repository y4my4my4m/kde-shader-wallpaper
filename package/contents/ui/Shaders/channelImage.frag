#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    vec4 iMouse;
    vec3 iResolution;
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;
layout(binding = 2) uniform sampler2D iChannel1;
layout(binding = 3) uniform sampler2D iChannel2;

void main(){
    vec2 uv = qt_TexCoord0;

    vec4 channel0 = texture(iChannel0, uv.xy);
    vec4 channel1 = texture(iChannel1, uv.xy);

    float opacity = mod(ubuf.iTime / 4.0, 1.0);

    fragColor = mix(channel0, channel1, opacity);
}