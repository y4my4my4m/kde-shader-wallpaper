qsb is in `/usr/lib/qt6/bin` 
`export PATH:$PATH:/usr/lib/qt6/bin` and now we can all it anywhere

https://doc.qt.io/qt-6/qtshadertools-qsb.html

`Executing qsb -o shader.frag.qsb shader.frag results in generating shader.frag.qsb. Inspecting this file with qsb -d shader.frag.qsb`

`qsb --glsl "100 es,120,150" --hlsl 50 --msl 12 -o waves.frag.qsb waves.frag`


## Install the package

`kpackagetool6 -t Plasma/Wallpaper -i package`


https://invent.kde.org/plasma/libplasma


## Add this to shaders

```hlsl
// add this at the top of the file
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

// either rename them in the frag or add this (probably costs some performance)

// int iFrame = ubuf.iFrame;
// float iTime = ubuf.iTime;
// float iTimeDelta = ubuf.iTimeDelta;
// vec3 iResolution = ubuf.iResolution;
// vec4 iMouse = ubuf.iMouse;
// etc...

// these must be modified as you cant do that with arrays afaik:
// float iChannelTime[4];
// vec3 iChannelResolution[4];

// add this at the end
void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
```