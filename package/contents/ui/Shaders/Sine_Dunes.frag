// https://www.shadertoy.com/view/slBfWD
// Credits to VPaltoDance

#define COORDS_SCALE 10.0

#define OFFSET 0.7
#define WAVE_OFFSET 0.6
#define SCALE 0.3
#define WAVE_SCALE 0.4

#define WAVE_FREQ 2.0
#define WAVE_SPEED 0.5

#define NEAR_COLOR vec3(0.75, 0.65, 0.3)
#define FAR_COLOR vec3(0.55, 0.33, 0.1)
#define TIME_SCALE 0.05

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    vec2 coords = uv * COORDS_SCALE;
    float var = coords.x + coords.y + WAVE_SPEED * iTime + WAVE_OFFSET + WAVE_SCALE * sin(coords.x + WAVE_FREQ * iTime);
    
    float coeff = OFFSET + SCALE * smoothstep(0.0, 1.0, fract(var)) 
                         - SCALE * smoothstep(0.97, 1.0, fract(var)); // anti-aliasing
    
    vec3 res = mix(NEAR_COLOR, FAR_COLOR, uv.x + uv.y) * coeff;
    
    fragColor = vec4(res, 1.0);
}