#version 450

layout(location = 0) out vec4 outColor;

// layout(std140, binding = 0) uniform Globals {
//     vec2 iResolution; // The resolution of the viewport
// };

void main() {
    float red = gl_FragCoord.x / 1920;
    float green = gl_FragCoord.y / 1080;
    outColor = vec4(red, green, 0.0, 1.0);
}