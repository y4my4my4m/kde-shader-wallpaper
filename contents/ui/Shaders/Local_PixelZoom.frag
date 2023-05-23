// url: https://www.shadertoy.com/view/XsSXzV
// credits: leon

// mod by: y4my4my4m

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv.y = 1.0 - uv.y;
    
    vec2 target = vec2(cos(iTime) * 0.5 + 0.5, sin(iTime) * 0.15 + 0.55);
    
    //vec2 mouse = vec2(iMouse.xy / iResolution.xy);
    //mouse.y = 1.0 - mouse.y;
    
    //target = mouse;
    
    float minRange = 4.0; // 4.0
    float maxRange = 16.0; // 12.0
    
    float area = 16.0; // 16.0
    float dist = distance(floor(uv*area)/area, target);
    
    dist += 0.25; //0.25
    dist = max(0.00, min(1.00, 1.25 - dist));
    
    dist = dist * dist;
    
    float details = minRange + floor(dist * maxRange);
    
    details = pow(2.0, details);
    
    uv = floor(uv * details) / details;
    
    
    vec4 color = texture(iChannel0, uv);
    
	fragColor = color;
}
