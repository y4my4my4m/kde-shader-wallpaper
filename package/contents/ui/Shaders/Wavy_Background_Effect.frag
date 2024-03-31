// https://www.shadertoy.com/view/ltGSWD
// Credits to gigaherz

float gradient(float p)
{
    vec2 pt0 = vec2(0.00,0.0);
    vec2 pt1 = vec2(0.86,0.1);
    vec2 pt2 = vec2(0.955,0.40);
    vec2 pt3 = vec2(0.99,1.0);
    vec2 pt4 = vec2(1.00,0.0);
    if (p < pt0.x) return pt0.y;
    if (p < pt1.x) return mix(pt0.y, pt1.y, (p-pt0.x) / (pt1.x-pt0.x));
    if (p < pt2.x) return mix(pt1.y, pt2.y, (p-pt1.x) / (pt2.x-pt1.x));
    if (p < pt3.x) return mix(pt2.y, pt3.y, (p-pt2.x) / (pt3.x-pt2.x));
    if (p < pt4.x) return mix(pt3.y, pt4.y, (p-pt3.x) / (pt4.x-pt3.x));
    return pt4.y;
}

float waveN(vec2 uv, vec2 s12, vec2 t12, vec2 f12, vec2 h12)
{
    vec2 x12 = sin((iTime * s12 + t12 + uv.x) * f12) * h12;

    float g = gradient(uv.y / (0.5 + x12.x + x12.y));

	return g * 0.27;
}

float wave1(vec2 uv)
{
    return waveN(vec2(uv.x,uv.y-0.25), vec2(0.03,0.06), vec2(0.00,0.02), vec2(8.0,3.7), vec2(0.06,0.05));
}

float wave2(vec2 uv)
{
    return waveN(vec2(uv.x,uv.y-0.25), vec2(0.04,0.07), vec2(0.16,-0.37), vec2(6.7,2.89), vec2(0.06,0.05));
}

float wave3(vec2 uv)
{
    return waveN(vec2(uv.x,0.75-uv.y), vec2(0.035,0.055), vec2(-0.09,0.27), vec2(7.4,2.51), vec2(0.06,0.05));
}

float wave4(vec2 uv)
{
    return waveN(vec2(uv.x,0.75-uv.y), vec2(0.032,0.09), vec2(0.08,-0.22), vec2(6.5,3.89), vec2(0.06,0.05));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;

    float waves = wave1(uv) + wave2(uv) + wave3(uv) + wave4(uv);

	float x = uv.x;
	float y = 1.0 - uv.y;

    vec3 bg = mix(vec3(0.05,0.05,0.3),vec3(0.1,0.65,0.85), (x+y)*0.55);
    vec3 ac = bg + vec3(1.0,1.0,1.0) * waves;

    fragColor = vec4(ac, 1.0);
}
