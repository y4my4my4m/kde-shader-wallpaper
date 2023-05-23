// url: https://www.shadertoy.com/view/NtSBR3
// credits: supah

float map(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

float bar(vec2 uv, float start, float height) {
    return step(uv.y, height + start) - step(uv.y, start);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    
    vec3 col = vec3(0.3, 0.0, 0.0);
    
    
    for (float i = -0.; i < 1.3; i += 0.1) {
        float wave = sin((i*12. + iTime * 2. + uv.x * 5.) * .4) * .08 * (1.1 - i);
        uv.y += wave;
        col += vec3(.1 + i * .005, i * .1, 0.003) * bar(uv, i + .1, i + 1.);
    }
    
    fragColor = vec4(col + vec3(0., 0., col.r * sin(.3 + iTime) * .3),1.0);
}
