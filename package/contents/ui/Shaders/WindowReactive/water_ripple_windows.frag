// Image pass — exact port of Shadertoy https://www.shadertoy.com/view/wdtyDH
//
// iChannel0 = BufferA (pressure sim), iChannel1 = wallpaper texture.
// BufferA outputs the per-cell gradient in .zw at the same magnitude as
// the original, so the 0.2 refraction factor and the glint math carry
// over unchanged.

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord / iResolution.xy;

    vec4 data = texture(iChannel0, uv);

    // Color = texture
    fragColor = texture(iChannel1, uv + 0.2 * data.zw);

    // Sunlight glint
    vec3 normal = normalize(vec3(-data.z, 0.2, -data.w));
    fragColor += vec4(1.0) * pow(max(0.0, dot(normal, normalize(vec3(-3.0, 10.0, 3.0)))), 60.0);
}
