
float distanceToSegment(vec2 a, vec2 b, vec2 p) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Normalize coordinates to [0, 1]
    vec2 p = fragCoord / iResolution.xy;
    
    // Normalize mouse coordinates
    vec2 currentMousePos = iMouse.xy / iResolution.xy;
    vec2 lastClickPos = iMouse.zw / iResolution.xy;

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