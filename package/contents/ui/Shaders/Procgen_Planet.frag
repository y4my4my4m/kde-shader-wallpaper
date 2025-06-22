// url: https://www.shadertoy.com/view/tltXWM
// credits: kchnkrml

// Noise functions and most of the implementation based on
// https://www.shadertoy.com/view/4dS3Wd by Morgan McGuire @morgan3d!

// see also
// https://iquilezles.org/articles/warp
// https://thebookofshaders.com/13/
// for informations on fbm, noise, ...

// please check out stuff like: https://www.shadertoy.com/view/lsGGDd
// for more advanced planet lighting/clouds/...

// Looking for a blue planet? Colors:
// vec3 col_top = vec3(0.0, 0.5, 0.0);
// vec3 col_bot = vec3(0.0, 1.0, 1.0);
// vec3 col_mid1 = vec3(0.0, 1.0, 0.0);
// vec3 col_mid2 = vec3(0.0, 0.0, 1.0);
// vec3 col_mid3 = vec3(0.0, 0.0, 1.0);


// number of octaves of fbm
#define NUM_NOISE_OCTAVES 10
// size of the planet
#define PLANET_SIZE		0.75
// uncomment to use a simple sharpen filter
// #define SHARPEN
// simple and fast smoothing of outside border
#define SMOOTH


//////////////////////////////////////////////////////////////////////////////////////
// Noise functions:
//////////////////////////////////////////////////////////////////////////////////////

// Precision-adjusted variations of https://www.shadertoy.com/view/4djSRW
float hash(float p) { p = fract(p * 0.011); p *= p + 7.5; p *= p + p; return fract(p); }

float noise(vec3 x) {
    const vec3 step = vec3(110, 241, 171);
    vec3 i = floor(x);
    vec3 f = fract(x);
    float n = dot(i, step);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),
               mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
}

float fbm(vec3 x) {
	float v = 0.0;
	float a = 0.5;
	vec3 shift = vec3(100);
	for (int i = 0; i < NUM_NOISE_OCTAVES; ++i) {
		v += a * noise(x);
		x = x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}

//////////////////////////////////////////////////////////////////////////////////////
// Visualization:
//////////////////////////////////////////////////////////////////////////////////////

const float pi          = 3.1415926535;
const float inf         = 9999999.9;
float square(float x) { return x * x; }
float infIfNegative(float x) { return (x >= 0.0) ? x : inf; }

// C = sphere center, r = sphere radius, P = ray origin, w = ray direction
float intersectSphere(vec3 C, float r, vec3 P, vec3 w) {	
	vec3 v = P - C;
	float b = -dot(w, v);
	float c = dot(v, v) - square(r);
	float d = (square(b) - c);
	if (d < 0.0) { return inf; }	
	float dsqrt = sqrt(d);
	
	// Choose the first positive intersection
	return min(infIfNegative((b - dsqrt)), infIfNegative((b + dsqrt)));
}

// returns max of a single vec3
float max3 (vec3 v) {
  return max (max (v.x, v.y), v.z);
}

vec3 getColorForCoord(vec2 fragCoord) {
    // (intermediate) results of fbm
    vec3 q = vec3(0.0);
    vec3 r = vec3(0.0);
	float v = 0.0;
    vec3 color = vec3(0.0);

    // planet rotation
    float theta = iTime * 0.15;  
    mat3 rot = mat3(
        cos(theta), 0, sin(theta),	// column 1
        0, 1, 0,	                // column 2
        -sin(theta), 0, cos(theta)	// column 3
    );

    // Ray-sphere
    const float verticalFieldOfView = 25.0 * pi / 180.0;

    // position of viewpoint (P) and ray of vision (w)
    vec3 P = vec3(0.0, 0.0, 5.0);
    vec3 w = normalize(vec3(fragCoord.xy - iResolution.xy * 0.5, (iResolution.y) / (-2.0 * tan(verticalFieldOfView / 2.0))));

    // calculate intersect with sphere (along the "line" of w from P)
    float t = intersectSphere(vec3(0, 0, 0), PLANET_SIZE, P, w);
    
    // calculate color for sphere/background
    if (t < inf) {
        // calculate point of intersection on the sphere
        vec3 X = P + w*t;

        // apply rotation matrix
        X = rot*X;

        // calculate fbm noise (3 steps)
        q = vec3(fbm(X + 0.025*iTime), fbm(X), fbm(X));
        r = vec3(fbm(X + 1.0*q + 0.01*iTime), fbm(X + q), fbm(X + q));
        v = fbm(X + 5.0*r + iTime*0.005);
    } else {
        // ray missed the sphere
		return vec3(0.0);
    }
    
    // convert noise value into color
    // three colors: top - mid - bottom (mid being constructed by three colors)
    vec3 col_top = vec3(1.0, 1.0, 1.0);
    vec3 col_bot = vec3(0.0, 0.0, 0.0);
    vec3 col_mid1 = vec3(0.1, 0.2, 0.0);
    vec3 col_mid2 = vec3(0.7, 0.4, 0.3);
    vec3 col_mid3 = vec3(1.0, 0.4, 0.2);

    // mix mid color based on intermediate results
    vec3 col_mid = mix(col_mid1, col_mid2, clamp(r, 0.0, 1.0));
    col_mid = mix(col_mid, col_mid3, clamp(q, 0.0, 1.0));
    col_mid = col_mid;

    // calculate pos (scaling betwen top and bot color) from v
    float pos = v * 2.0 - 1.0;
    color = mix(col_mid, col_top, clamp(pos, 0.0, 1.0));
    color = mix(color, col_bot, clamp(-pos, 0.0, 1.0));

    // clamp color to scale the highest r/g/b to 1.0
    color = color / max3(color);
      
    // create output color, increase light > 0.5 (and add a bit to dark areas)
    color = (clamp((0.4 * pow(v,3.) + pow(v,2.) + 0.5*v), 0.0, 1.0) * 0.9 + 0.1) * color;
    
    // apply diffuse lighting  
    float diffuse = max(0.0, dot(P + w*t, vec3(1.0, sqrt(0.5), 1.0)));
    float ambient = 0.1;
    color *= clamp((diffuse + ambient), 0.0, 1.0);
    
#ifdef SMOOTH
    // apply a smoothing to the outside
    color *= (P + w*t).z * 2.0;
#endif    
    
    return color;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord ) {
#ifdef SHARPEN 
    // use a simple sharpen filter (you could improve that immensely!
    fragColor.rgb =
        getColorForCoord(fragCoord) * 3. -
        getColorForCoord(fragCoord + vec2(1.0, 0.0)) * 0.5 -
        getColorForCoord(fragCoord + vec2(0.0, 1.0)) * 0.5 -
        getColorForCoord(fragCoord - vec2(1.0, 0.0)) * 0.5 -
        getColorForCoord(fragCoord - vec2(0.0, 1.0)) * 0.5;
#else
    // just use a single pass
    fragColor.rgb = getColorForCoord(fragCoord);
#endif
}
