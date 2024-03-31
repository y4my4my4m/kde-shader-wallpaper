
// Glass Candy by Leon Denise 2022/05/13
// Using code from Inigo Quilez, Antoine Zanuttini and many more

// A classic kaleidoscopic iterated function with spheres
// I was playing with reflections and inversed the ray and normal for curiosity
// It gave a funky fake refraction that was fun to play with

const float falloff = 1.2;
const float size = .5;
const float range = 1.1;

float colorOffset;

mat2 rot (float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

// signed distance function
float map(vec3 p)
{
    float d = 100.;
    float s = 100.;
    float a = 1.;
    float t = 196.+iTime * .1;
    for (float i = 0.; i < 12.; ++i)
    {
        p.x = abs(p.x)-range*a;
        p.xz *= rot(t/a);
        p.yx *= rot(t/a);
        s = length(p)-size*a;
        colorOffset = s < d ? i : colorOffset;
        d = min(d, s);
        a /= falloff;
    }
    
    return d;
}

// Antoine Zanuttini
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
    vec3 noise = texture(iChannel0, fragCoord.xy/1024.).rgb;
    vec3 ray = normalize(vec3(uv, 1));
    vec3 pos = vec3(0,0,-3);
    
    // init variables
    vec3 color, normal, tint;
    float index, shade, light;
    const float count = 25.;
    colorOffset = 0.;

    // ray marching
    for (index = count; index > 0.; --index)
    {
        float dist = map(pos);
        if (dist < .001) break;
        dist *= .9+.1*noise.z;
        pos += ray*dist;
    }
    
    // lighting
    shade = index/count;
    normal = getNormal(pos);
    light = pow(dot(reflect(ray, normal), vec3(0,1,0))*.5+.5, 4.);
    light += pow(dot(normal, ray)*.5+.5, .5);
    color = vec3(.5) * shade * light;
    
    // ray bouncing (where the funky stuff happens)
    ray = reflect(normal, ray); // should be ray = reflect(ray, normal);
    pos += ray * (.2+.19*sin(iTime*2.+length(uv)*6.)); // jumpy bounce
    for (index = count; index > 0.; --index)
    {
        float dist = map(pos);
        if (dist < .001) break;
        dist *= .9+.1*noise.z;
        pos += ray*dist;
    }

    // coloring
    normal = getNormal(pos);
    light = pow(dot(normal, ray)*.5+.5, 1.);
    tint = .5+.5*cos(vec3(0,.3,.6)*6.+colorOffset*2.+pos.y*2.+light);
    color += tint * shade * index/count * (noise.r*.3+.7);

    fragColor = vec4(color, 1.);
}
