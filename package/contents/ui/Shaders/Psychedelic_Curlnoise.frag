// url: https://www.shadertoy.com/view/tdcXDf
// credits: pitushslayer

// Remap function to perform an affine transformation on a float
float remap(float x, float a, float b, float c, float d)
{
    return (((x - a) / (b - a)) * (d - c)) + c;
}

// Hash functions by Dave_Hoskins
float hash12(vec2 p)
{
	uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673U, 3812015801U);
	uint n = (q.x ^ q.y) * 1597334673U;
	return float(n) * (1.0 / float(0xffffffffU));
}

vec2 hash22(vec2 p)
{
	uvec2 q = uvec2(ivec2(p))*uvec2(1597334673U, 3812015801U);
	q = (q.x ^ q.y) * uvec2(1597334673U, 3812015801U);
	return vec2(q) * (1.0 / float(0xffffffffU));
}

float perlin (vec2 uv) {
    vec2 id = floor(uv);
    vec2 gv = fract(uv);

    // Four corners in 2D of a tile
    float a = hash12(id);
    float b = hash12(id + vec2(1.0, 0.0));
    float c = hash12(id + vec2(0.0, 1.0));
    float d = hash12(id + vec2(1.0, 1.0));

    vec2 u = gv * gv * (3.0 - 2.0 * gv);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

vec2 curl (vec2 uv)
{
    vec2 eps = vec2(0., 1.);
    
    float n1, n2, a, b;
    n1 = perlin(uv+eps);
    n2 = perlin(uv-eps);
    a = (n1-n2)/(2.*eps.y); // ∂x1/∂y
    
    n1 = perlin(uv+eps.yx);
    n2 = perlin(uv-eps.yx);
    b = (n1-n2)/(2.*eps.y); // ∂y1/∂x
    
    return vec2(a, -b);
}


float worley(vec2 uv, float freq, float t)
{
    uv *= freq;
    uv += t;
    
    vec2 id = floor(uv);
    vec2 gv = fract(uv);
    
    float minDist = 100.;
    for (float y = -1.; y <= 1.; ++y)
    {
        for(float x = -1.; x <= 1.; ++x)
        {
            vec2 offset = vec2(x, y);
            vec2 h = hash22(id + offset) * .8 + .1; // .1 - .9
    		h += offset;
            vec2 d = gv - h;
           	minDist = min(minDist, dot(d, d));
        }
    }
    
    return minDist + .4;
}

// Worley noise fbm using uvs offset by curl noise
vec3 fbmCurlWorley(vec2 uv, float freq, float t)
{
    float worley1 = 1. - worley(uv, freq * 2., t * 2.);
    float worley2 = 1. - worley(uv, freq * 4., t * 4.);
    float worley3 = 1. - worley(uv, freq * 8., t * 8.);
    float worley4 = 1. - worley(uv, freq * 16., t * 16.);
    
    float fbm1 = worley1 * .625 + worley2 * .25 + worley3 * .125;
    float fbm2 = worley2 * .625 + worley3 * .25 + worley4 * .125;
    float fbm3 = worley3 * .75 + worley4 * .25;
    return vec3(fbm1, fbm2, fbm3);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float aspectRatio = iResolution.x/iResolution.y;
    vec2 uv = fragCoord / iResolution.xy;
    uv.x *= aspectRatio;
    uv += curl(uv * 7.); // offset uvs for advection
    
    float t = iTime * .3;
    
    vec3 curlWorleyFbm = fbmCurlWorley(uv, 4., t);
    float curlWorley = curlWorleyFbm.r * .625 + curlWorleyFbm.g * .25 + 
        curlWorleyFbm.b * .125;
    
    vec3 col = vec3(0.);
    col += remap(curlWorley, 0., 1., .25, 1.);
    col *= cos(t * 3. + uv.xyx + vec3(0, 2, 4)) + .5;
    fragColor = vec4(col, 1.0);
}
