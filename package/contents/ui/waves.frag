#version 450

layout(location = 0) out vec4 outColor; // Output color of the fragment

layout(binding = 0) uniform sampler2D iChannel0; // Texture sampler for iChannel0

// Function to sample amplitude based on frequency
float getAmp(float frequency, vec2 texCoord) {
    return texture(iChannel0, vec2(frequency / 512.0, texCoord.y)).x;
}

// Function to calculate weight based on frequency and texture coordinates
float getWeight(float f, vec2 texCoord) {
    return (getAmp(f - 2.0, texCoord) + getAmp(f - 1.0, texCoord) +
            getAmp(f + 2.0, texCoord) + getAmp(f + 13.0, texCoord) +
            getAmp(f, texCoord)) / 5.0;
}

void main() {
    vec2 texCoord = gl_FragCoord.xy / vec2(textureSize(iChannel0, 0)); // Normalized texture coordinates
    vec3 C = vec3(0.12, 0.11, 0.37);
    float GWM = 1.15;
    float TM = 0.25;
    vec3 color = vec3(0.0);
    vec2 uv = 2.5 * texCoord - 1.33;
    for(float i = 0.0; i < 5.0; i++) {
        uv.y += 0.2 * sin(uv.x + i / 7.0);
        float weight = getWeight(pow(i, 2.0) * 20.0, texCoord);
        color += mix(C * weight, vec3(weight), 0.5);
    }
    outColor = vec4(color, 1.0);
}