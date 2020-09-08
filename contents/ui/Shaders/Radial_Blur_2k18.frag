// https://www.shadertoy.com/view/MtjfRd
// Credits to PrzemyslawZaworski

//Just combination of two shaders:
//https://www.shadertoy.com/view/4sfGRn by Inigo Quilez
//https://www.shadertoy.com/view/ld2fRt by Przemyslaw Zaworski

#define factor 74

float hash (vec3 n)
{
    return fract(sin(dot(n, vec3(95.43583, 93.323197, 94.993431))) * 65536.32);
}

float noise (vec3 n)
{
    vec3 base = floor(n * 64.0) * 0.015625;
    vec3 dd = vec3(0.015625, 0.0, 0.0);
    float a = hash(base);
    float b = hash(base + dd.xyy);
    float c = hash(base + dd.yxy);
    float d = hash(base + dd.xxy);
    vec3 p = (n - base) * 64.0;
    float t = mix(a, b, p.x);
    float tt = mix(c, d, p.x);
    return mix(t, tt, p.y);
}

float fbm(vec3 n)
{
    float total = 0.0;
    float m1 = 1.0;
    float m2 = 0.1;
    for (int i = 0; i < 5; i++)
    {
        total += noise(n * m1) * m2;
        m2 *= 2.0;
        m1 *= 0.5;
    }
    return total;
}

float heightmap (vec3 n)
{
    return fbm((5.0 * n) + fbm((5.0 * n) * 3.0 - 1000.0) * 0.05);
}

vec3 surface(vec2 uv)
{
    float color = clamp(heightmap(vec3(uv.xy*5.0,2.0)*0.02)-1.0,0.0,1.0);
    if (color<0.1) return vec3(0.35,0.40,0.44);
    else if (color<0.2) return vec3(0.29,0.32,0.35);
    else if (color<0.3) return vec3(0.20,0.21,0.22);
    else if (color<0.55) return vec3(0.09,0.11,0.09);
    else if (color<0.65) return vec3(0.18,0.19,0.14);
    else if (color<0.75) return vec3(0.52,0.52,0.33);
    else if (color<0.85) return vec3(0.45,0.37,0.27);
    else if (color<0.95) return vec3(0.34,0.25,0.17);
    else if (color<0.99) return vec3(0.59,0.34,0.29);
    else return vec3(0.14,0.09,0.08);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    vec3  col = vec3(0.0,0.0,0.0);
    vec2  d = (vec2(0.0,0.0)-p)/float(factor);
    float w = 1.0;
    vec2  s = p;
    for( int i=0; i<factor; i++ )
    {
        vec3 res = surface(vec2(s.x+iTime,s.y)+sin(iTime));
        col += w*smoothstep( 0.0, 1.0, res );
        w *= .985;
        s += d;
    }
    col = col * 4.5 / float(factor);
    fragColor = vec4( col,1.0 );
}
