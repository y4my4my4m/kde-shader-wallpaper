# Shader Dev Guide

## Automated Shader Import

### Prerequisite 
To compile shaders, you must use QT6's qsb, by default it isn't in your PATH.
qsb can be found in `/usr/lib/qt6/bin` 
add it to your path like this: `export PATH:$PATH:/usr/lib/qt6/bin` and now we can call it from anywhere

### Processing & Compiling
Currently, kde-shader-wallpaper doesn't support shaders that uses buffers

Place the .frag shaders you want to convert here: `package/contents/ui/Shaders/ConvertMe`

Run:
- `python ShaderProcessor.py` to add the required code to the shader files and process it (!!! it's probably a good idea to manually verify as it's not perfect!!! )
- `python ShaderCompiler.py` to compile it to the `Shaders6` folder

### Install the package
- `kpackagetool6 -t Plasma/Wallpaper -i package`

    ( You may need to remove the previously installed package first, which can be found here: `~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper` )


## Manual Shader Import

### Processing

Add this to your shader .frag file:

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

### Compile
`qsb --glsl "100 es,120,150" --hlsl 50 --msl 12 -o MYSHADER.frag.qsb MYSHADER.frag`


### Install the package
You may need to remove the previously installed package in your `~/.local/share/plasma/wallpapers/online.knowmad.shaderwallpaper`
`kpackagetool6 -t Plasma/Wallpaper -i package`



## Reference

- https://doc.qt.io/qt-6/qtshadertools-qsb.html
- https://invent.kde.org/plasma/libplasma
