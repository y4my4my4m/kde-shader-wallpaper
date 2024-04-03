// https://www.shadertoy.com/view/Wty3zV
// Credits to irwatts

const int ITERATIONS = 64;
const float SPEED = 0.25;
const float PAN = 2.8;
const float MASK_VIS = 0.0; // Set between 0-1 to visualize masks

float vortex(vec2 uv, float dist, float seed, float bias, float offset)
{
    float ang = atan(uv.y, uv.x)+sin(dist+0.1*seed)*(1.2-offset)*2.0;
    ang += 3.14159*(0.01*seed);
    return clamp((sin((ang)*(3.0+offset*float(ITERATIONS)))+bias)/(1.0+bias), 0.0, 1.0);
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord-vec2(iResolution.xy*0.5))/iResolution.y;
    float texel = 1.0/iResolution.y;
    float dist = length(uv);
    vec3 col = vec3(0.0);
    for (int i=0; i<ITERATIONS; i++)
    {
        float offset = float(i)/float(ITERATIONS);
        float seed = 1000.0*fract(3.1379136*floor(iTime*SPEED+offset));
        float time = fract(iTime*SPEED+offset);
        vec2 pan = vec2(0.0, time*PAN);
        float maskA = vortex(uv, dist, seed+100.0*float(i), -0.998+texel, offset);
        float dist2 = length(uv+pan);
        float maskB = vortex(uv+pan, dist2, seed+42.0*float(i), -0.99+texel, offset);
        float radius = pow(((maskA*maskA)+(maskB*maskB)), 2.0);
        float fade = time*(1.0-time);
        float mask = maskA*maskB*fade*radius;
        col = mix(col, vec3(0.42+1.0*dist-0.2*offset-0.1*radius, 0.75-0.5*offset-0.5*dist, 1.0-0.8*dist), mask);
        col = max(vec3(maskA*MASK_VIS, maskB*MASK_VIS+0.1, max(maskA*MASK_VIS*2.0, maskB*MASK_VIS)+0.12)*fade, col);
    }
    fragColor = vec4(col*4.0,1.0);
}
