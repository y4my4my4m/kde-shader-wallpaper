// URL: shadertoy.com/view/XtSGWD
// By: mhnewman

const int buildingCount = 40;
const float buildingLifeTime = 5.0;
const float buildingSpread = 1.2;

const float topCurve = 0.9;
const float topOvershoot = 1.2;

const vec3 backgroundFog = vec3(0.2, 0.2, 0.3);
const vec3 streetGlow = vec3(0.3, 0.15, 0.4);

const float buildingScale = buildingLifeTime / (float(buildingCount) - 1.0);
const float buildingLeft = -0.5 * (buildingSpread - 1.0);

float hash11(float p) {
	vec2 p2 = fract(p * vec2(5.3983, 5.4427));
    p2 += dot(p2.yx, p2.xy +  vec2(21.5351, 14.3137));
	return fract(p2.x * p2.y * 95.4337);
}

float hash12(vec2 p) {
	p = fract(p * vec2(5.3983, 5.4427));
    p += dot(p.yx, p.xy + vec2(21.5351, 14.3137));
	return fract(p.x * p.y * 95.4337);
}

float hash13(vec3 p) {
	p = fract(p * vec3(5.3983, 5.4427, 6.9371));
    p += dot(p.zxy, p.xyz + vec3(21.5351, 14.3137, 15.3219));
	return fract(p.x * p.y * p.z * 95.4337);
}

vec2 hash21(float p) {
	vec2 p2 = fract(p * vec2(5.3983, 5.4427));
    p2 += dot(p2.yx, p2.xy +  vec2(21.5351, 14.3137));
	return fract(vec2(p2.x * p2.y * 95.4337, p2.x * p2.y * 97.597));
}

vec3 hash31(float p) {
	vec3 p2 = fract(p * vec3(5.3983, 5.4427, 6.9371));
    p2 += dot(p2.zxy, p2.xyz + vec3(21.5351, 14.3137, 15.3219));
	return fract(vec3(p2.x * p2.y * 95.4337, p2.y * p2.z * 97.597, p2.z * p2.x * 93.8365));
}

float noise12(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
    return 1.0 - 2.0 * mix(mix(hash12(i + vec2(0.0, 0.0)), 
                               hash12(i + vec2(1.0, 0.0)), u.x),
                           mix(hash12(i + vec2(0.0, 1.0)), 
                               hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float screenWidth = iResolution.x / iResolution.y;
    vec2 uv = fragCoord.xy / iResolution.y;
    
    float idOffset = floor(iTime / buildingScale);
    
    vec3 color = backgroundFog;
    for (int i = 0; i < buildingCount; ++i) {
        float id = idOffset + float(i);
        float time = (iTime - buildingScale * id) / buildingLifeTime + 1.0;
        
        
        //	Building
        vec2 hash = hash21(id);        
        float top = topOvershoot * (topCurve * (time - time * time) + time);
        float center = screenWidth * (buildingLeft + buildingSpread * hash.x);
        vec3 buildingColor = (top - uv.y) * streetGlow;
        
        vec2 border = 0.02 + 0.03 * hash21(id);
        vec2 outerWindow = vec2(0.01, 0.015) + vec2(0.02, 0.005) * hash21(id + 0.1);
        vec2 innerWindow = 0.25 * hash21(id + 0.2);
        float innerWidth = outerWindow.x * floor(0.2 * (0.5 + hash.y) / outerWindow.x);
        float outerWidth = innerWidth + border.x;
        
        vec2 pos = (uv - vec2(center, top - border.y)) / outerWindow;
        vec2 local = mod(pos, 1.0);
        vec2 index = floor(pos);
        
        vec3 windowColor = vec3(0.85) + 0.15 * hash31(id);
        float window = hash13(vec3(index, id)) - 0.2 * hash11(id + 0.3);
        window = smoothstep(0.62, 0.68, window);
        window *= step(innerWindow.x, local.x) * step(local.x, 1.0 - innerWindow.x);
        window *= step(innerWindow.y, local.y) * step(local.y, 1.0 - innerWindow.y);
        
        window *= step(index.y, -0.5);
        window *= step(uv.x, center + innerWidth) * step(center - innerWidth, uv.x);
        buildingColor = mix(buildingColor, windowColor, window);
        
        buildingColor = mix(buildingColor, backgroundFog, time);
        
        float inside = step(uv.y, top);
        inside *= step(uv.x, center + outerWidth);
        inside *= step(center - outerWidth, uv.x);
        
        color = mix(color, buildingColor, inside);
        
        //	Sign
        hash = hash21(id + 0.5);
        vec2 signCenter = vec2(center + outerWidth * (2.0 * hash.x - 1.0), top - 0.2 - 0.2 * hash.y);

        hash = hash21(id + 0.6);
        float char2Size = 0.01 + 0.04 * hash.x;
        float char2Count = floor(1.0 + 8.0 * hash.y);
        
        vec2 halfSize = 0.5 * vec2(char2Size, char2Size * char2Count);
        float outline = length(max(abs(uv - signCenter) - halfSize, 0.0));
        
        vec3 signColor = hash31(id + 0.1);
        signColor = signColor / max(max(signColor.r, signColor.g), signColor.b);
        signColor = clamp(vec3(0.2) + signColor, 0.0, 1.0);
        signColor = mix(signColor, backgroundFog, time * time);
        
        vec2 char2Pos = (uv - signCenter + halfSize) / char2Size;
		float char2 = 1.5 + 4.0 * noise12(id + 6.0 * char2Pos);
        char2Pos = fract(char2Pos);
        char2 *= smoothstep(0.0, 0.4, char2Pos.x) * smoothstep(1.0, 0.6, char2Pos.x);
        char2 *= smoothstep(0.0, 0.4, char2Pos.y) * smoothstep(1.0, 0.6, char2Pos.y);
        char2 *= step(outline, 0.001);
        signColor = mix(backgroundFog * time, signColor, clamp(char2, 0.0, 1.0));
	    color = mix(color, signColor, step(outline, 0.01));
        
        vec3 outlineColor = hash31(id + 0.2);
        outlineColor = outlineColor / max(max(outlineColor.r, outlineColor.g), outlineColor.b);
        outlineColor = clamp(vec3(0.2) + outlineColor, 0.0, 1.0);
        outlineColor = mix(outlineColor, backgroundFog, time * time);
        
        outline = smoothstep(0.0, 0.01, outline) * smoothstep(0.02, 0.01, outline);
        color = mix(color, outlineColor, outline);
        
        //	Balls
        hash = hash21(id + 0.8);
        float radius = 0.005 + 0.01 * hash.y;
        float gap = radius + 0.015 * hash.x;
        
        hash = hash21(id + 0.9);
        float ballX = gap * (floor(uv.x / gap) + 0.5);
        float ballOffset = ballX - center;
        float ballY = top - 0.4 - 0.7 * hash.y + (0.03 + 0.05 * hash.x) * ballOffset * ballOffset;
        float ball = length(uv - vec2(ballX, ballY)) / radius;
        color = mix(color, outlineColor, smoothstep(1.0, 0.0, ball));
    }
    fragColor = vec4(color, 1.0);
}
