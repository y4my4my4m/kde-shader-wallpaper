#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 iMouse;
    vec3 iResolution;
} ubuf;

float distanceToSegment(vec2 a, vec2 b, vec2 p) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h);
}

void main() {
    // Normalize coordinates to [0, 1]
    vec2 p = qt_TexCoord0;
    vec2 cen = 0.5*ubuf.iResolution.xy/ubuf.iResolution.x;
    
    // Normalize mouse coordinates
    vec2 currentMousePos = ubuf.iMouse.xy / ubuf.iResolution.xy;
    vec2 lastClickPos = ubuf.iMouse.zw / ubuf.iResolution.xy;

    vec3 col = vec3(0.0);

    // If there was a click, calculate distance to segment for visualization
    if(lastClickPos != vec2(0)) { // Assuming 0,0 is not a valid click position, or very unlikely
        float d = distanceToSegment(currentMousePos, lastClickPos, p);
        col = mix(col, vec3(1.0, 1.0, 0.0), 1.0 - smoothstep(0.004, 0.008, d));
    }

    // Example visualization around last click position
    col = mix(col, vec3(1.0, 0.0, 0.0), 1.0 - smoothstep(0.03, 0.035, length(p - currentMousePos)));
    col = mix(col, vec3(0.0, 0.0, 1.0), 1.0 - smoothstep(0.03, 0.035, length(p - lastClickPos)));

    fragColor = vec4(col, 1.0);
}