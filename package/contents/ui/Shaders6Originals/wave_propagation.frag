//
// A simplified water effect by Tom@2016
//
// Based on: http://freespace.virgin.net/hugo.elias/graphics/x_water.htm
// A very old Hugo Elias water tutorial :)
//
// Using the same technique as:
//  https://www.shadertoy.com/view/4sd3WB by overlii
// A clever trick to utilize two channels
// and keep buffer A in x/r and buffer B in y/g.
//
// However, now it is twice as slower as my original:
//  https://www.shadertoy.com/view/Xsd3DB
//

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

#define TEXTURED 1

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord.xy/ubuf.iResolution.xy;

#if TEXTURED == 1
    
    vec3 e = vec3(vec2(1.)/ubuf.iResolution.xy,0.);
    float p10 = texture(iChannel0, q-e.zy).x;
    float p01 = texture(iChannel0, q-e.xz).x;
    float p21 = texture(iChannel0, q+e.xz).x;
    float p12 = texture(iChannel0, q+e.zy).x;
    
    // Totally fake displacement and shading:
    vec3 grad = normalize(vec3(p21 - p01, p12 - p10, 1.));
    vec4 c = texture(iChannel1, fragCoord.xy*2./ubuf.iChannelResolution[1].xy + grad.xy*.35);
    vec3 light = normalize(vec3(.2,-.5,.7));
    float diffuse = dot(grad,light);
    float spec = pow(max(0.,-reflect(light,grad).z),32.);
    fragColor = mix(c,vec4(.7,.8,1.,1.),.25)*max(diffuse,0.) + spec;
    
#else
    
    float h = texture(iChannel0, q).x;
    float sh = 1.35 - h*2.;
    vec3 c =
       vec3(exp(pow(sh-.75,2.)*-10.),
            exp(pow(sh-.50,2.)*-20.),
            exp(pow(sh-.25,2.)*-10.));
    fragColor = vec4(c,1.);

#endif
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
