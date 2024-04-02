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

void main() {
    vec2 q = qt_TexCoord0;

    // #if TEXTURED == 1
    
    vec3 e = vec3(vec2(1.) / ubuf.iResolution.xy, 0.);
    float p10 = texture(iChannel0, q - e.zy).x;
    float p01 = texture(iChannel0, q - e.xz).x;
    float p21 = texture(iChannel0, q + e.xz).x;
    float p12 = texture(iChannel0, q + e.zy).x;
    
    vec3 grad = normalize(vec3(p21 - p01, p12 - p10, 1.));
    vec4 c = texture(iChannel1, q + grad.xy * .35);
    vec3 light = normalize(vec3(.2, -.5, .7));
    float diffuse = dot(grad, light);
    float spec = pow(max(0., -reflect(light, grad).z), 32.);
    fragColor = mix(c, vec4(.7, .8, 1., 1.), .25) * max(diffuse, 0.) + spec;
    
    // #else
    
    // float h = texture(iChannel0, q).x;
    // float sh = 1.35 - h * 2.;
    // vec3 c = vec3(exp(pow(sh - .75, 2.) * -10.),
    //              exp(pow(sh - .50, 2.) * -20.),
    //              exp(pow(sh - .25, 2.) * -10.));
    // fragColor = vec4(c, 1.);
    
    // #endif
}
