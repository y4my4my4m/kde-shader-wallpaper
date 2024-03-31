#version 450

layout(location = 0) out vec4 outColor; // Output color of the fragment

// layout(std140, binding = 0) uniform TimeBlock {
//     float iTime; // Time uniform inside a block
// };

float iTime = 1;

// Simplified function definitions or direct calculations without texture sampling
// For example, a procedural wave based on time and screen position

float wavePattern(vec2 position, float time) {
    // Procedural wave pattern, replacing the need for texture-based amplitude calculation
    float wave = sin(position.x * 10.0 + time) * cos(position.y * 10.0 + time);
    return wave;
}

void main() {
    vec2 position = gl_FragCoord.xy / vec2(800, 600); // Example resolution, adjust as needed
    position = position * 2.0 - 1.0; // Transform to [-1, 1] range

    float wave = wavePattern(position, iTime);

    // Use the wave calculation for color modulation
    vec3 color = mix(vec3(0.12, 0.11, 0.37), vec3(0.5, 0.5, 0.5), (wave + 1.0) / 2.0);

    outColor = vec4(color, 1.0);
}
