// url: https://www.shadertoy.com/view/flSBDV
// credits: leon


// Taste of Noise 15 by Leon Denise 2022/05/17
// Using code from Inigo Quilez, Antoine Zanuttini and many more

// Wanted to play again with FBM noise after understanding
// I could sample the 3d texture to generate cheap value noise
// (well I think it is cheaper?)

// This is definitively one of my favorite noise pattern
// A FBM noise with cyclic absolute value, making it looks
// like a Gogotte stone or an abstract drawing from Moebius.


// rotation matrix
mat2 rot (float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

// transform linear value into cyclic absolute value
vec3 bend(vec3 v)
{
    return abs(sin(v*2.*6.283+iTime*6.283*.1));
}

// fractal brownian motion (layers of multi scale noise)
vec3 fbm(vec3 p)
{
    vec3 result = vec3(0);
    float falloff = 0.5;
    for (float index = 0.; index < 3.; ++index)
    {
        result += bend(texture(iChannel0, p/falloff).xyz) * falloff;
        falloff /= 2.;
    }
    return result;
}

// signed distance function
float map(vec3 p)
{
    float dist = 100.;
    
    // animated fbm noise
    vec3 seed = p * .08;
    seed.z -= iTime*.01;
    vec3 spicy = fbm(seed) * 2. - 1.;
    
    // sphere with distorted surface
    dist = length(p)-1.0 - spicy.x*0.2;
    
    // scale down distance because domain is highly distorted
    return dist * 0.15;
}

// Antoine Zanuttini
// https://www.shadertoy.com/view/3sBGzV
vec3 getNormal (vec3 pos)
{
    vec2 noff = vec2(0.01,0);
    return normalize(map(pos)-vec3(map(pos-noff.xyy), map(pos-noff.yxy), map(pos-noff.yyx)));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // coordinates
    vec2 uv = (fragCoord.xy - iResolution.xy / 2.)/iResolution.y;
    vec3 noise = texture(iChannel1, fragCoord.xy/1024.).rgb;
    vec3 ray = normalize(vec3(uv, 3.));
    vec3 pos = vec3(0,0,-3);
    
    // init variables
    vec3 color, normal, tint;
    float index, shade, light;
    const float count = 50.;

    // ray marching
    for (index = count; index > 0.; --index)
    {
        float dist = map(pos);
        if (dist < .001) break;
        dist *= .8+.1*noise.z;
        pos += ray*dist;
    }
    
    // coloring
    shade = index/count;
    normal = getNormal(pos);
    light = pow(dot(reflect(ray, normal), vec3(0,1,0))*.5+.5, 2.);
    light += pow(dot(normal, ray)*.5+.5, .5);
    float dt = dot(reflect(normal, ray), -normalize(pos));
    color = .5+.5*cos(vec3(1,2,3)+pos.y*3.+dt*3.+.5);
    color = clamp((color + light * .5) * shade, 0., 1.);
    fragColor = vec4(color, 1.);
}
