// url: https://www.shadertoy.com/view/XsSfW1
// credits: Flyguy

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

//With AA (239 c)

void mainImage( out vec4 c, vec2 o )
{
    vec2 r = ubuf.iResolution.xy;
    o = vec2(length(o -= r/2.) / r.y - .3, atan(o.y,o.x));    
    vec4 s = c.yzwx = .1*cos(1.6*vec4(0,1,2,3) + ubuf.iTime + o.y + sin(o.y) * sin(ubuf.iTime)*2.),
    f = min(o.x-s, c-o.x);
    c = dot(40.*(s-c), clamp(f*r.y, 0., 1.)) * (s-.1) - f;
}


//No AA (233c)
/*
void mainImage( out vec4 c, vec2 o )
{
    vec2 r = ubuf.iResolution.xy;
    o = vec2(length(o -= r/2.) / r.y - .3, atan(o.y,o.x));    
    vec4 s = c.yzwx = .1*cos(1.6*vec4(0,1,2,3) + ubuf.iTime + o.y + sin(o.y) * sin(ubuf.iTime)*2.);
    c = dot(40.*(s-c), step(1./r.y, c = min(o.x-s,c-o.x))) * (s-.1) - c;
}
*/




void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
