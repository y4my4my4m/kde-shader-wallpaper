// From https://www.shadertoy.com/view/clVyR1
// Credits to amagitakayosi

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



#define N  120
#define PI 3.141593

float circle(vec2 p, float r) {
    return smoothstep(.1, .0, abs(length(p) - r));
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/ubuf.iResolution.xy;
    vec2 p = uv * 2. - 1.;
    p.x *= ubuf.iResolution.x / ubuf.iResolution.y;
    p *= 2.;
    
    float a = atan(p.y, p.x);    

    vec3 col = vec3(0.0,0.0,0.0);
   

    for (int i = 0; i < N; i++) {
        float fi = float(i);
        float t = fi / float(N);
        float aa = (t + ubuf.iTime / 12.) * 2. * PI;
        
        float size = .3 + sin(t * 6.* PI) * .1;
    
    
        float a1 = -ubuf.iTime * PI / 3. + aa;       
        a1 += sin(length(p) * 3. + ubuf.iTime * PI / 2.) * 0.3;
        vec2 c1 = vec2(cos(a1), sin(a1));
        
        float a2 = aa * 4.;            
        vec2 c2 = vec2(cos(a2), sin(a2)) * 0.3 + c1;
        col.r += .001 / abs(length(p - c2) - size);        
        col.g += .0013 / abs(length(p - c2) - size * 1.05);        
        col.b += .0015 / abs(length(p - c2) - size * 1.09);                
    }

    fragColor = vec4(col, 1.);
}



void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
