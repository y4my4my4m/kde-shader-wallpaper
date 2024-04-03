// url: https://www.shadertoy.com/view/7lBBzd
// credits: bsodium

//#define Use_Perlin
//#define Use_Value
#define Use_Simplex

// ========= Hash ===========

// Grab from https://www.shadertoy.com/view/4djSRW
//#define MOD3 vec3(.1031,.11369,.13787)
#define MOD3 vec3(443.8975,397.2973, 491.1871)
#define ROTSPEED 0.2

float hash31(vec3 p3)
{
	p3  = fract(p3 * MOD3);
    p3 += dot(p3, p3.yzx + 19.19);
    return -1.0 + 2.0 * fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * MOD3);
    p3 += dot(p3, p3.yxz+19.19);
    return -1.0 + 2.0 * fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

// ========= Noise ===========

float value_noise(vec3 p)
{
    vec3 pi = floor(p);
    vec3 pf = p - pi;
    
    vec3 w = pf * pf * (3.0 - 2.0 * pf);
    
    return 	mix(
        		mix(
        			mix(hash31(pi + vec3(0, 0, 0)), hash31(pi + vec3(1, 0, 0)), w.x),
        			mix(hash31(pi + vec3(0, 0, 1)), hash31(pi + vec3(1, 0, 1)), w.x), 
                    w.z),
        		mix(
                    mix(hash31(pi + vec3(0, 1, 0)), hash31(pi + vec3(1, 1, 0)), w.x),
        			mix(hash31(pi + vec3(0, 1, 1)), hash31(pi + vec3(1, 1, 1)), w.x), 
                    w.z),
        		w.y);
}

float perlin_noise(vec3 p)
{
    vec3 pi = floor(p);
    vec3 pf = p - pi;
    
    vec3 w = pf * pf * (3.0 - 2.0 * pf);
    
    return 	mix(
        		mix(
                	mix(dot(pf - vec3(0, 0, 0), hash33(pi + vec3(0, 0, 0))), 
                        dot(pf - vec3(1, 0, 0), hash33(pi + vec3(1, 0, 0))),
                       	w.x),
                	mix(dot(pf - vec3(0, 0, 1), hash33(pi + vec3(0, 0, 1))), 
                        dot(pf - vec3(1, 0, 1), hash33(pi + vec3(1, 0, 1))),
                       	w.x),
                	w.z),
        		mix(
                    mix(dot(pf - vec3(0, 1, 0), hash33(pi + vec3(0, 1, 0))), 
                        dot(pf - vec3(1, 1, 0), hash33(pi + vec3(1, 1, 0))),
                       	w.x),
                   	mix(dot(pf - vec3(0, 1, 1), hash33(pi + vec3(0, 1, 1))), 
                        dot(pf - vec3(1, 1, 1), hash33(pi + vec3(1, 1, 1))),
                       	w.x),
                	w.z),
    			w.y);
}

float simplex_noise(vec3 p)
{
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;
    
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    
    // thx nikita: https://www.shadertoy.com/view/XsX3zB
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
	vec3 i1 = e * (1.0 - e.zxy);
	vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    
    vec3 d1 = d0 - (i1 - 1.0 * K2);
    vec3 d2 = d0 - (i2 - 2.0 * K2);
    vec3 d3 = d0 - (1.0 - 3.0 * K2);
    
    vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
    vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));
    
    return dot(vec4(31.316), n);
}

float noise(vec3 p) {
#ifdef Use_Perlin
    return perlin_noise(p * 2.0);
#elif defined Use_Value
    return value_noise(p * 2.0);
#elif defined Use_Simplex
    return simplex_noise(p);
#endif
    
    return 0.0;
}


float sphere( vec3 p, float s )
{
  return length(p)-s;
}

float box( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float plane( vec3 p, vec4 n )
{
  // n must be normalized
  return dot(p,n.xyz) + n.w;
}

float bottom(vec3 ro, vec3 ray)
{
    float t = 0.0;
    for (int i = 0; i < 256; i++) {
        float res = plane(ro + ray * t, vec4(0.0, 1.0, 0.0, 10.0));
        if( res < 0.00001 ) return t;
        t += res;
    }

    return -1.0;
}

float map(vec3 p)
{
	float pl = plane(p, vec4(0.0, 1.0, 0.0, 10.0));
    float s = sphere(p - vec3(1.5, -8.0, 0.0), 1.0);
    float b1 = box(p - vec3(-1.5, -8.0, 0.0), vec3(1.0));
    float b2 = box(p - vec3(-26, -9.0, 0.0), vec3(20, 1, 50));
    float d = min(pl, s);
    d = min(b1, d);
    d = min(b2, d);
    return d;
}

vec2 scene(vec3 ro, vec3 ray)
{
    float t = 0.0;
    for (int i = 0; i < 128; i++) {
        float res = map(ro+ray*t);
        if( res < 0.00001 ) return vec2(t, res);
        t += res;
    }

    return vec2(-1.0);
}

vec2 intersect2(vec3 ro, vec3 ray)
{
    float t = 0.0;
    for (int i = 0; i < 128; i++) {
        float res = plane((ro+ray*t), vec4(0.0, 1.0, 0.0, 10.0));
        if( res < 0.00001 ) return vec2(t, res);
        t += res;
    }

    return vec2(-1.0);
}

vec2 water(vec3 ro, vec3 ray)
{
    float t = 0.0;
    for (int i = 0; i < 32; i++) {
        float res = plane(ro+ray*t, vec4(0.0, 1.0, 0.0, -1.0));
        if( res < 0.0001 ) return vec2(t, res);
        t += res;
    }

    return vec2(-1.0);
}

vec3 waterNormal(vec3 p, float e) {
    vec3 ee = vec3(e, 0., 0.);
    vec3 pp = p * 1.0;
	float h1 = noise(p + ee.xyy);
    float h2 = noise(p - ee.xyy);
    float h3 = noise(p + ee.yyx);
    float h4 = noise(p - ee.yyx);
    vec3 du = vec3(1., 0., h2 - h1);
    vec3 dv = vec3(0., 1., h4 - h3);
    return normalize(cross(du, dv)) * 0.5 + 0.5;
    //return vec3(h1, h2, h3);
}

float caustics(vec3 p, vec3 lp) {
    vec3 ray = normalize(p - lp);

    vec2 shadow = scene(lp, ray);
    float l = distance(lp + ray * shadow.x, p);
    if (l > 0.01) {
        return 0.0;
    }

    vec2 d = water(lp, ray);
    vec3 waterSurface = lp + ray * d.x;

    vec3 refractRay = refract(ray, vec3(0., 1., 0.), 1.0/1.333);
    float beforeHit = bottom(waterSurface, refractRay);
    vec3 beforePos = waterSurface + refractRay * beforeHit;

    vec3 noisePos = waterSurface + vec3(0.,iTime * 2.0,0.);
    float height = noise(noisePos);
    vec3 deformedWaterSurface = waterSurface + vec3(0., height, 0.);

    refractRay = refract(ray, waterNormal(noisePos, 0.5), 1.0/1.333);
    float afterHit = bottom(deformedWaterSurface, refractRay);
    vec3 afterPos = deformedWaterSurface + refractRay * afterHit;

    float beforeArea = length(dFdx(beforePos)) * length(dFdy(beforePos));
    float afterArea = length(dFdx(afterPos)) * length(dFdy(afterPos));
    return max(beforeArea / afterArea, .001);
}

vec3 normal(vec3 pos, float e )
{
    vec3 eps = vec3(e,0.0,0.0);

	return normalize( vec3(
           map(pos+eps.xyy) - map(pos-eps.xyy),
           map(pos+eps.yxy) - map(pos-eps.yxy),
           map(pos+eps.yyx) - map(pos-eps.yyx) ) );
}

mat3 createCamera(vec3 ro, vec3 ta, float cr )
{
	vec3 cw = normalize(ta - ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // fragment position
    vec2 p = (fragCoord.xy * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);

    // camera
    vec3 ro = vec3(sin(iTime * ROTSPEED) * 10.0, 0.0, cos(iTime * ROTSPEED) * 10.0) * 2.0;
    vec3 ta = vec3(0.0, -8.0, 0.0);
    mat3 cm = createCamera(ro, ta, 0.0);
    vec3 ray = cm * normalize(vec3(p, 4.0));
    
    // marching loop
    vec2 res = scene(ro, ray);
    
    // hit check
    if(res.y > -0.5) {
        vec3 p = ro + ray * res.x;
       	vec3 n = normal(p, 0.0001);
        vec3 l = vec3(10.0, 10.0, 10.0);
        vec3 v = -normalize(p - l);
        fragColor = vec4(normal(ro + ray * res.x, 0.0001), 1.0);
        float c = caustics(ro + ray * res.x, l) * 0.6;
        vec3 co = vec3(c,c,c) *  + vec3(0.30,0.90,0.80);
        float li = max(dot(v, n), 0.0);
        vec3 col = co * li + vec3(0.0,0.04,0.05);
        col = pow(col, vec3(1.0/2.2));
        fragColor = vec4(mix(col, vec3(0.07,0.20,0.57), res.x / 100.0), 1.0);
    } else {
        fragColor = vec4(vec3(0.10,0.34,0.49), 1.0);
    }
}
