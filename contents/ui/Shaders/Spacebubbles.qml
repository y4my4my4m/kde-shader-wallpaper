// https://www.shadertoy.com/view/Xtl3zn
// Credits to srtuss

// srtuss, 2014

float strs(vec3 p)
{
    vec3 pos = p;
    p += vec3(1.35, 1.54, 1.23);
    p *= .3;
    for(int i = 0; i < 18; i++)
    {
        p.xyz = abs(p.xyz);
        p = p / dot(p,p);
        p = p * 1. - vec3(.9);
    }
    return pow(length(p),1.5)*.04;
}

float hash(float p)
{
    return fract(sin(p * 11.111111) * 91962.592632);
}

float hash(vec2 p)
{
    return fract(sin(p.x + p.y * 3.3333333) * 91962.592632);
}

float nse(float p)
{
    float fl = floor(p);
    p = fract(p);
    p = p * p * (3.0 - 2.0 * p);
    return mix(hash(fl), hash(fl + 1.0), p);
}

float nse(vec2 p)
{
    vec2 fl = floor(p);
    p = fract(p);
    p = p * p * (3.0 - 2.0 * p);

    return mix(
        mix(hash(fl), hash(fl + vec2(1.0, 0.0)), p.x),
           mix(hash(fl + vec2(0.0, 1.0)), hash(fl + vec2(1.0, 1.0)), p.x),
           p.y);
}

float fbm(vec2 p)
{
    return nse(p * 0.5) * 0.4 + nse(p) * 0.5 + nse(p * 2.0 - 3.3333) * 0.25 + nse(p * 4.01 + 3.3333) * 0.125;
}

float fbm2(vec2 p)
{
    return nse(p) * 0.5 + nse(p * 2.0 - 3.3333) * 0.25 + nse(p * 4.01 + 3.3333) * 0.125 + nse(p * 10.01) * 0.09;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv = 2.0 * uv - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    //uv *= 1.5 - exp(iTime * -0.01) * 0.5;

    float sd = iTime;//fragCoord.x * 7.0 + fragCoord.y * 1.11111;
    uv += (fract(vec2(cos(sd), sin(sd)) * 192925.1972) - 0.5) * 0.01 * exp(iTime * -0.04);

    float v = 0.0;

    float sf = strs(vec3(uv * 0.1, 0.0));

    vec2 p = vec2(uv.yx + sf * 0.13);
    vec2 c = vec2(0.1, 0.7);
    float fo = 20.0, it = 1.0 * exp(iTime * -0.01);
    for(int i = 0; i < 8; i++)
    {
        p = vec2(p.x * p.x - p.y * p.y, 2.0 * p.x * p.y) + c;
        //p += nse(p * 20.0) * 0.02;
        v += exp(abs(dot(p, p) - iTime * 0.03) * -fo) * it;
        it *= 0.7;
        fo *= 0.8;
    }

    float v2 = /*v * 0.8 +*/ sf + abs(fbm(uv * 2.1 + fbm2(uv * 10.0) * 0.6) - 0.5);

    //v *= 2.0;

    vec3 col;

    //col = pow(vec3(clamp(v2 - v * 0.5, 0.0, 1.0) + length(uv) * 0.15), vec3(1.0, 0.8, 0.5) * 4.5) * 3.0;
    //col += pow(vec3(v * 1.0), vec3(0.5, 0.5, 0.7) * 6.5) * 4.0;

    float lit = pow(nse(iTime * 10.0), 3.0) * nse(uv * 4.0 - iTime) * (0.5 + v2 * 1.0) * exp(iTime * -0.04) + 0.5;

    vec3 cp = mix(vec3(1.0, 0.8, 0.5), vec3(0.3, 0.6, 0.7), smoothstep(0.0, 1.0, v2 + v));
    col = pow(vec3(v2 + v * 0.4) + exp(length(uv) * -2.0) * lit, cp * 7.0) * 4.0;


    //1.0 - fbm(uv * 2.0) * 0.5


    col = pow(col, vec3(1.0 / 2.2));

    fragColor = vec4(col, 1.0);
}
