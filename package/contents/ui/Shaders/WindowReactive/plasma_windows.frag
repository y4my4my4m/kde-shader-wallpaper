// Main Image: Render bright electric arcs

vec3 electricColor(float intensity, float time) {
    vec3 cyan = vec3(0.3, 0.9, 1.0);
    vec3 white = vec3(1.0, 1.0, 1.0);
    vec3 purple = vec3(0.7, 0.3, 1.0);
    
    // Core is white/cyan, edges are purple
    vec3 col = mix(purple, cyan, intensity);
    col = mix(col, white, smoothstep(0.5, 1.0, intensity));
    
    return col * intensity * 1.5;  // Boost brightness
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Wallpaper
    vec3 wallpaper = texture(iChannel1, uv).rgb;
    
    // Plasma data
    vec4 data = texture(iChannel0, uv);
    float plasma = data.r;
    float dist = data.g;
    float arcs = data.b;
    
    // Electric color
    vec3 electric = electricColor(plasma, iTime);
    
    // Strong bloom for arcs
    vec2 px = 1.0 / iResolution.xy;
    float bloom = 0.0;
    for (int x = -4; x <= 4; x++) {
        for (int y = -4; y <= 4; y++) {
            float w = 1.0 / (1.0 + float(x*x + y*y) * 0.5);
            bloom += texture(iChannel0, uv + vec2(x, y) * px * 3.0).r * w;
        }
    }
    bloom /= 15.0;
    
    vec3 bloomColor = electricColor(bloom * 0.8, iTime) * 0.6;
    
    // Inside windows = dark
    bool inside = false;
    for (int i = 0; i < iWindowCount; i++) {
        vec4 win = iWindowRects[i];
        vec2 wMin = win.xy / iResolution.xy;
        vec2 wMax = (win.xy + win.zw) / iResolution.xy;
        if (uv.x > wMin.x && uv.x < wMax.x && uv.y > wMin.y && uv.y < wMax.y) {
            inside = true;
            break;
        }
    }
    
    vec3 final;
    if (inside) {
        final = wallpaper * 0.15 + electric * 0.2;
    } else {
        final = wallpaper + electric + bloomColor;
    }
    
    fragColor = vec4(final, 1.0);
}