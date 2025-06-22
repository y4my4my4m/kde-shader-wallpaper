#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 iMouse;
    vec3 iResolution;
    int iFrame;
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;
layout(binding = 2) uniform sampler2D iChannel1;
layout(binding = 3) uniform sampler2D iChannel2;


// ShaderToy GLSL Fragment Shader
// Adjusted version for Qt 6 compatibility

#define PI2 6.283185
#define RotNum 5

vec2 scuv(vec2 uv) {
    float zoom = 1.0 - ubuf.iMouse.z / 1000.0;
    return (uv - 0.5) * 1.2 * zoom + 0.5;
}

vec2 uvSmooth(vec2 uv, vec2 res) {
    vec2 f = fract(uv * res);
    return (uv * res + 0.5 - f + 3.0 * f * f - 2.0 * f * f * f) / res;
}

const float ang = PI2 / float(RotNum);
mat2 m = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
mat2 mh = mat2(cos(ang * 0.5), sin(ang * 0.5), -sin(ang * 0.5), cos(ang * 0.5));

vec4 getCol(vec2 uv) { return texture(iChannel0, scuv(uv)); }
float getVal(vec2 uv) { return length(getCol(uv).xyz); }

vec2 getGrad(vec2 uv, float delta) {
    vec2 d = vec2(delta, 0);
    return vec2(getVal(uv + d.xy) - getVal(uv - d.xy),
                getVal(uv + d.yx) - getVal(uv - d.yx)) / delta;
}

float getRot(vec2 pos, vec2 b, vec2 Res0) {
    float l = log2(dot(b, b)) * sqrt(0.125) * 0.0;
    vec2 p = b;
    float rot = 0.0;
    for (int i = 0; i < RotNum; i++) {
        rot += dot(textureLod(iChannel0, ((pos + p) / Res0), l).xy - vec2(0.5), p.yx * vec2(1, -1));
        p = m * p;
    }
    return rot / float(RotNum) / dot(b, b);
}
vec4 myenv(vec3 pos, vec3 dir, float period)
{
    return texture(iChannel2, dir.xy)+.15;
}
void main() {
    vec2 Res0 = vec2(textureSize(iChannel0, 0));
    vec2 Res1 = vec2(textureSize(iChannel1, 0));
    
    vec2 pos = qt_TexCoord0 * ubuf.iResolution.xy;
    vec2 b = cos(float(ubuf.iFrame) * 0.3 - vec2(0, 1.57));
    vec2 v = vec2(0);
    float bbMax = 0.5 * Res0.y; bbMax *= bbMax;
    for (int l = 0; l < 20; l++) {
        if (dot(b, b) > bbMax) break;
        vec2 p = b;
        for (int i = 0; i < RotNum; i++) {
            v += p.yx * getRot(pos + p, -mh * b, Res0);
            p = m * p;
        }
        b *= 2.0;
    }

    vec4 advectedColor = texture(iChannel0, fract((pos - v * vec2(-1, 1) * 5.0 * sqrt(Res0.x / 600.)) / Res0));
    advectedColor.zw += (texture(iChannel1, qt_TexCoord0 * ubuf.iResolution.xy / Res1 * 0.35).zw - 0.5) * 0.002;
    advectedColor.zw += (texture(iChannel1, qt_TexCoord0 * ubuf.iResolution.xy / Res1 * 0.7).zw - 0.5) * 0.001;

    vec2 uv = qt_TexCoord0;
    vec3 n = vec3(-getGrad(uv, 1.4 / ubuf.iResolution.x) * 0.02, 1.);
    n = normalize(n);
    vec2 sc = (qt_TexCoord0 * ubuf.iResolution.xy - Res0 * 0.5) / Res0.x;
    vec3 dir = normalize(vec3(sc, -1.));
    vec3 R = reflect(dir, n);
    // vec3 refl = texture(iChannel2, R.xzy);

    vec3 refl = myenv(vec3(0), R.xyz, 1.).xyz;

    vec4 col = advectedColor + 0.5;
    col = mix(vec4(1), col, 0.35);
    col.xyz *= 0.95 + -0.05 * n;

    fragColor.xyz = col.xyz * refl;

    // fragColor.xyz = col.xyz;
    fragColor.w = 1.0;
}
