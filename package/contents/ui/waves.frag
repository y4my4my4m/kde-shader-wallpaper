#version 450

layout(location = 0) in vec2 coord; // Receive texture coordinates from the vertex shader
layout(location = 0) out vec4 outColor; // Output color of the fragment

uniform float iTime; // Assuming a uniform for time is passed in for animation

// Modified functions or direct calculation without texture sampling
float getWave(float x, float y, float time) {
    return sin(x * 10.0 + time) * cos(y * 10.0 + time);
}

void main() {
    vec2 uv = coord * 2.0 - 1.0; // Adjust coord to [-1, 1] range
    float wave = getWave(uv.x, uv.y, iTime);

    // Use wave calculation for color modulation
    vec3 color = mix(vec3(0.12, 0.11, 0.37), vec3(0.5, 0.5, 0.5), (wave + 1.0) / 2.0);

    outColor = vec4(color, 1.0);
}
