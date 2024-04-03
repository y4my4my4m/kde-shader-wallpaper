#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 iMouse;
    vec3 iResolution;
} ubuf;

void main()
{
    // Normalized pixel coordinates (from 0 to 1)
    //vec2 uv = qt_TexCoord0/ubuf.iResolution.xy;
    // vec2 uv = qt_TexCoord0 * 2.0 - vec2(1.0, 1.0);

    vec2 uv = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * 2.0 - vec2(1.0, 1.0);

    vec2 disMouse = vec2(uv.x-ubuf.iMouse.x,uv.y-ubuf.iMouse.y);
    
    float r = 0.1+0.01*sin(atan(disMouse.x,disMouse.y)*8.0);
    //num8 decide how many leafs this cicle has. Amazing!
    
    vec3 col =  vec3(1.0,1.0,1.0);
    vec3 colCircle = vec3(0.2,0.9,0.0);
    vec3 colBackground = vec3(0.24,0.25,0.1);
    
    col *= smoothstep(r,r+0.01,length(disMouse));
    col = mix(colCircle,colBackground,col);
    
    //col =  vec3(1.0,1.0,1.0)*sin(atan(disMouse.x,disMouse.y)*8.0);
       
    // Output to screen
    fragColor = vec4(col,1.0);
}