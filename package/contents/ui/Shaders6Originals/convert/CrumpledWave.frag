// https://www.shadertoy.com/view/3ttSzr
// credits to nasana
void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    vec2 uv =  (2.0 * fragCoord - ubuf.iResolution.xy) / min(ubuf.iResolution.x, ubuf.iResolution.y);

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

    for(float i = 1.0; i < 8.0; i++){
        uv.y += i * 0.1 / i * 
        sin(uv.x * i * i + ubuf.iTime * 0.5) * sin(uv.y * i * i + ubuf.iTime * 0.5);
    }

    vec3 col = vec3(uv.y - 0.1, uv.y + 0.3, uv.y + 0.95);
    fragColor = vec4(col,1.0);
}
void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
