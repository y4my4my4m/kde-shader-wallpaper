// Shadertoy: https://www.shadertoy.com/view/wdtyDH
// Image pass — pond refraction over wallpaper.
//
// Reads pre-computed pressure gradient (.zw) from BufferA. BufferA does
// the wave simulation with anti-checkerboard mitigation — see comments
// in water_ripple_windows_bufferA.frag for the stability story.

const float REFRACTION = 0.2;

// Final safety clamp on the gradient. With BufferA's pressure cap and
// wider gradient stencil this should never trigger in normal use, but
// if a future shader edit destabilises BufferA we still won't smear the
// wallpaper into a stripe pattern.
const float MAX_GRAD = 1.0;

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;

    vec4 data = texture(iChannel0, uv);

    vec2 bufRes = iChannelResolution[0].xy;
    vec2 grad = data.zw * (bufRes / iResolution.xy);
    grad = clamp(grad, vec2(-MAX_GRAD), vec2(MAX_GRAD));

    fragColor = texture(iChannel1, uv + REFRACTION * grad);

    vec3 normal = normalize(vec3(-grad.x, 0.2, -grad.y));
    float glint = pow(max(0.0, dot(normal, normalize(vec3(-3.0, 10.0, 3.0)))), 60.0);
    fragColor += vec4(glint * 0.65);
}
