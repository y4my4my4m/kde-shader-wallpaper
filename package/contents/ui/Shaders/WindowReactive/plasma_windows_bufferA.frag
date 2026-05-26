// Buffer A: Electric plasma with VISIBLE lightning arcs between windows

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// Distance to line segment
float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// Signed distance to rectangle
float sdBox(vec2 p, vec2 center, vec2 size) {
    vec2 d = abs(p - center) - size * 0.5;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Lightning bolt between two points
float lightning(vec2 p, vec2 a, vec2 b, float time, float seed) {
    vec2 dir = b - a;
    float len = length(dir);
    if (len < 0.001) return 0.0;
    
    dir /= len;
    vec2 perp = vec2(-dir.y, dir.x);
    
    // Project point onto line
    vec2 pa = p - a;
    float t = dot(pa, dir) / len;
    
    if (t < 0.0 || t > 1.0) return 0.0;
    
    // Calculate expected position on straight line
    vec2 linePoint = a + dir * (t * len);
    
    // Add jagged displacement - multiple frequencies for lightning look
    float displacement = 0.0;
    displacement += sin(t * 15.0 + time * 8.0 + seed) * 0.03;
    displacement += sin(t * 25.0 - time * 12.0 + seed * 2.0) * 0.015;
    displacement += sin(t * 45.0 + time * 15.0 + seed * 3.0) * 0.008;
    
    // Noise for organic randomness
    displacement += (fbm(vec2(t * 10.0 + seed, time * 2.0)) - 0.5) * 0.04;
    
    // Taper at ends
    float taper = sin(t * 3.14159);
    displacement *= taper;
    
    // Displaced line point
    vec2 boltPoint = linePoint + perp * displacement;
    
    // Distance to bolt
    float dist = length(p - boltPoint);
    
    // Bolt thickness (thicker in middle)
    float thickness = 0.004 + 0.006 * taper;
    
    // Core (bright)
    float core = smoothstep(thickness, 0.0, dist);
    
    // Glow (softer)
    float glow = smoothstep(thickness * 4.0, 0.0, dist) * 0.5;
    
    return core + glow;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec2 p = uv * vec2(aspect, 1.0);
    
    float plasma = 0.0;
    float arcTotal = 0.0;
    float minDist = 1000.0;
    
    // Collect window data
    vec2 centers[16];
    vec2 sizes[16];
    
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 win = iWindowRects[i];
        centers[i] = (win.xy + win.zw * 0.5) / iResolution.xy * vec2(aspect, 1.0);
        sizes[i] = win.zw / iResolution.xy * vec2(aspect, 1.0);
        
        float dist = sdBox(p, centers[i], sizes[i]);
        minDist = min(minDist, dist);
    }
    
    // === TIGHT BORDER GLOW ===
    float borderGlow = smoothstep(0.02, 0.0, minDist);
    plasma += borderGlow;
    
    // Small tendrils from border
    if (minDist > 0.0 && minDist < 0.05) {
        float angle = atan(p.y - 0.5, p.x - 0.5 * aspect);
        float tendril = pow(sin(angle * 12.0 + iTime * 3.0) * 0.5 + 0.5, 2.0);
        float tendrilDist = 0.02 + tendril * 0.02;
        plasma += smoothstep(tendrilDist, 0.005, minDist) * 0.6;
    }
    
    // === LIGHTNING ARCS BETWEEN ALL WINDOW PAIRS ===
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        for (int j = i + 1; j < iWindowCount && j < 16; j++) {
            vec2 c1 = centers[i];
            vec2 c2 = centers[j];
            vec2 s1 = sizes[i];
            vec2 s2 = sizes[j];
            
            // Find closest edges between windows
            vec2 edge1 = c1 + clamp(c2 - c1, -s1 * 0.5, s1 * 0.5);
            vec2 edge2 = c2 + clamp(c1 - c2, -s2 * 0.5, s2 * 0.5);
            
            float gap = length(edge2 - edge1);
            
            // Only draw arcs if windows are somewhat close
            if (gap < 0.35) {
                // Arc strength based on distance (closer = stronger)
                float strength = smoothstep(0.35, 0.05, gap);
                
                // Main lightning bolt
                float bolt1 = lightning(p, edge1, edge2, iTime, 0.0);
                
                // Secondary bolts (offset timing/seed)
                float bolt2 = lightning(p, edge1, edge2, iTime + 0.3, 5.0) * 0.6;
                float bolt3 = lightning(p, edge1, edge2, iTime + 0.7, 10.0) * 0.4;
                
                // Branching bolts (from midpoint)
                vec2 mid = (edge1 + edge2) * 0.5;
                vec2 branch1End = mid + vec2(0.05, 0.03) * (fbm(vec2(iTime)) - 0.5) * 4.0;
                vec2 branch2End = mid + vec2(-0.04, 0.04) * (fbm(vec2(iTime + 5.0)) - 0.5) * 4.0;
                
                float branch1 = lightning(p, mid, branch1End, iTime * 1.5, 20.0) * 0.3;
                float branch2 = lightning(p, mid, branch2End, iTime * 1.3, 25.0) * 0.3;
                
                float arc = (bolt1 + bolt2 + bolt3 + branch1 + branch2) * strength;
                
                // Flickering
                float flicker = 0.7 + 0.3 * sin(iTime * 20.0 + float(i + j) * 3.0);
                arc *= flicker;
                
                arcTotal += arc;
            }
        }
    }
    
    plasma += arcTotal;
    
    // === MOUSE creates arc to nearest window ===
    if (iMouse.z > 0.0 && iWindowCount > 0) {
        vec2 mouseP = iMouse.xy / iResolution.xy * vec2(aspect, 1.0);
        
        // Find nearest window
        float nearestDist = 1000.0;
        vec2 nearestEdge = mouseP;
        
        for (int i = 0; i < iWindowCount && i < 16; i++) {
            vec2 edge = centers[i] + clamp(mouseP - centers[i], -sizes[i] * 0.5, sizes[i] * 0.5);
            float d = length(mouseP - edge);
            if (d < nearestDist) {
                nearestDist = d;
                nearestEdge = edge;
            }
        }
        
        if (nearestDist < 0.4) {
            float mouseBolt = lightning(p, mouseP, nearestEdge, iTime, 100.0);
            float mouseBolt2 = lightning(p, mouseP, nearestEdge, iTime + 0.2, 105.0) * 0.5;
            plasma += (mouseBolt + mouseBolt2) * smoothstep(0.4, 0.1, nearestDist);
        }
        
        // Glow at mouse
        plasma += smoothstep(0.03, 0.0, length(p - mouseP));
    }
    
    fragColor = vec4(clamp(plasma, 0.0, 1.0), minDist, arcTotal, 1.0);
}