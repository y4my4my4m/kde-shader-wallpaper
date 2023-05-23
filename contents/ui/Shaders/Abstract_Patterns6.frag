// url: shadertoy.com/view/ftjBDh
// credits: leon


// Abstract Patterns #6 by Leon Denise 2022/05/09

// Inspired by Martijn Steinrucken "Math Zoo - Alien Orb"
// https://www.youtube.com/watch?v=b0AayhCO7s8
// https://www.shadertoy.com/view/tlcXWX

// Using code from Martijn Steinrucken, Dave Hoskins,
// Inigo Quilez, Antoine Zanuttini and many more

const float scale = 5.;
const float shell = .3;
const float carve = .3;
const float falloff = 1.8;
const float blend = .02;

// Inigo Quilez
// https://iquilezles.org/articles/distfunctions/
float smin(float d1, float d2, float k)
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

// Dave Hoskins
// https://www.shadertoy.com/view/4djSRW
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
// signed distance function
float map(vec3 p)
{
    vec3 pp = p;
    float d = 100.;
    float a = 1.;
    
    // gyroid multi scale pattern
    for (float i = 0.; i < 3.; ++i)
    {
        p = pp * scale / a;
        p.z -= iTime * a;
        d = smin(d, abs(dot(sin(p),cos(p.yzx))/scale*a), blend);
        a /= falloff;
    }
    
    // invert volume
    d = -d;
    
    // ripple surface
    d += sin(p.z*10.+iTime*20.)*0.002;
    
    // substract sphere
    d = smin(d, -(length(pp)-shell), -carve);
    
    return d;
}

// NuSan
// https://www.shadertoy.com/view/3sBGzV
vec3 getNormal (vec3 pos)
{
    vec2 noff = vec2(0.001,0);
    return normalize(map(pos)-vec3(map(pos-noff.xyy), map(pos-noff.yxy), map(pos-noff.yyx)));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // coordinates
    vec2 uv = (fragCoord.xy - iResolution.xy / 2.)/iResolution.y;
    float dither = hash12(fragCoord);
    vec3 ray = normalize(vec3(uv, -0.5));
    vec3 pos = vec3(0);

    // raymarching
    float index = 0.;
    const float count = 17.;
    for (index = count; index > 0.; --index)
    {
        float dist = map(pos);
        if (dist < .001) break;
        dist *= .9+.1*dither;
        pos += ray*dist;
    }

    // coloring
    vec3 normal = getNormal(pos);
    vec3 color = .5+.2*normal;
    float backLight = dot(normal, vec3(0,0,-1))*.5+.5;
    float bottomLight = dot(normal, vec3(0,-1,0))*.5+.5;
    vec3 tint = .9*cos(vec3(1,2,3)+pos.z*18.-iTime);
    color += vec3(1,-.5,-.5)*backLight;
    color += tint * bottomLight;
    color *= index/count;

    fragColor = vec4(color, 1.);
}
