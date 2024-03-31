#version 450

layout(std140, binding = 0) uniform Buf {
    vec3 iResolution; // Image resolution: width, height, width/height ratio
    float iTime; // Shader time
    // Additional uniforms can be defined here
};
layout(location = 0) out vec4 outColor; // Output color of the fragment
layout(binding = 1) uniform sampler2D iChannel0; // Assuming a texture sampler for iChannel0

// Function definitions
float getAmp(float frequency) {
    return texture(iChannel0, vec2(frequency / 512.0, 0)).x;
}

float getWeight(float f) {
    return (getAmp(f - 2.0) + getAmp(f - 1.0) +
            getAmp(f + 2.0) + getAmp(f + 13.0) +
            getAmp(f)) / 5.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec3 C = vec3(0.12, 0.11, 0.37);
    float GWM = 1.15;
    float TM = 0.25;
    vec3 backdrop;
    vec2 uvTrue = fragCoord.xy / iResolution.xy;
    vec2 uv = 2.5 * uvTrue - 1.33;
    vec3 color = vec3(0.0);
    for(float i = 0.0; i < 5.0; i++) {
        uv.y += (0.2 * sin(uv.x + i / 7.0 - iTime * 0.4));
        float Y = uv.y + getWeight(pow(i, 2.0) * 20.0) * (texture(iChannel0, vec2(uvTrue.x, 1)).x - 0.5);
        float li = 0.4 + pow(1.2 * abs(mod(uvTrue.x + i / 1.1 + iTime, 2.0) - 1.0), 2.0);
        float gw = abs(li / (150.0 * Y));
        float ts = gw * (GWM + sin(iTime * TM));
        float tsr = gw * (GWM + sin(iTime * TM * 1.10));
        float tsg = gw * (GWM + sin(iTime * TM * 1.20));
        float tsb = gw * (GWM + sin(iTime * TM * 1.50));
        color += vec3(tsr, tsg, tsb);
    }
    backdrop = mix(C * normalize(color), C * normalize(color), C * normalize(color));
    fragColor = vec4(color + backdrop, 0.5);
}

void main() {
    mainImage(outColor, gl_FragCoord.xy);
}
