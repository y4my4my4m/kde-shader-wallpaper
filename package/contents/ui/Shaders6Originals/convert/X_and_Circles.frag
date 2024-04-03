// by: Shoving
// url: https://www.shadertoy.com/view/cldcWf

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

vec3 palette(float t ) 
{
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(-0.812, 0.5, 0.5);
    vec3 c = vec3(1.178, 1.588, 1.0);
    vec3 d = vec3(-0.502, 0.333, 0.667);
    
    return a + b*cos( 6.28318*(c*t+d) );
}

float sdRoundedX( in vec2 p, in float w, in float r )
{
    p = abs(p);
    return length(p-min(p.x+p.y,w)*0.5) - r;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = fragCoord / ubuf.iResolution.xy * 2.0 - 1.0;
    vec2 uv = fragCoord / ubuf.iResolution.xy * 2.0 - 1.0;
    uv.x *= ubuf.iResolution.x / ubuf.iResolution.y;
    p.x *= ubuf.iResolution.x / ubuf.iResolution.y;
	float wi = 0.5 + 0.3*cos( ubuf.iTime + 2.0 );
    float ra = 0.1 + 0.08*sin(ubuf.iTime*1.2);
    float o = sdRoundedX( p, wi, ra );
    vec2 uv0 = uv;
    vec3 finalColor = vec3(0.0);
    vec3 otherFinalColor = vec3(0.0);
    
    for (float i = 0.0;i < 2.0;i++){
        uv = fract(uv * 0.2) - 0.5;
        float d = length(uv) * exp(-length(uv0));
        vec3 col = palette(length(uv0) + i*.4 + ubuf.iTime*.4);
        d = sin(d*8. + ubuf.iTime)/8.;
        d = abs(d);
        d = pow(0.01 / d, 0.8);
        //x
        vec3 xCol = palette(length(p) + i*.4 + ubuf.iTime*.4);
        o = abs(o);
        o = pow(0.01 / o, 0.6);
    // end of x
        //otherFinalColor += xCol * o;
        finalColor += col * d * o ;
    }
    fragColor = vec4(finalColor, 1.0);
    //fragColor = vec4(otherFinalColor, 1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
