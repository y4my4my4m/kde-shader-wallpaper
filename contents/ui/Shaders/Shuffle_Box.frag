// https://www.shadertoy.com/view/7t3SW8
// Credits To tdhooper

#if HW_PERFORMANCE==1
    const float MAX_DISPERSE = 10.;
    const float MAX_BOUNCE = 5.;
#else
    const float MAX_DISPERSE = 5.;
    const float MAX_BOUNCE = 5.;
#endif

//#define ALTERNATIVE
//#define ALTERNATIVE2



// HG_SDF
// https://www.shadertoy.com/view/Xs3GRB

#define PI 3.14159265359

#define saturate(x) clamp(x, 0., 1.)

void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

float smax(float a, float b, float r) {
    vec2 u = max(vec2(r + a,r + b), vec2(0));
    return min(-r, max (a, b)) + length(u);
}

float vmax(vec2 v) {
	return max(v.x, v.y);
}

float vmin(vec2 v) {
	return min(v.x, v.y);
}

float vmax(vec3 v) {
	return max(max(v.x, v.y), v.z);
}

float vmin(vec3 v) {
	return min(min(v.x, v.y), v.z);
}

float fBox(vec2 p, vec2 b) {
	vec2 d = abs(p) - b;
	return length(max(d, vec2(0))) + vmax(min(d, vec2(0)));
}

float fBox(vec3 p, vec3 b) {
	vec3 d = abs(p) - b;
	return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
}

float sdLine( vec3 p, float h, float r )
{
  p.y -= clamp( p.y, 0.0, h );
  return length( p ) - r;
}

// Spectrum palette
// IQ https://www.shadertoy.com/view/ll2GD3

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
}


//========================================================
// Modelling
//========================================================


float time;

float invertg;

float sin3(vec3 v) {
    return sin(v.x) * sin(v.y) * sin(v.z);
}

vec2 map(vec3 p) {

    float scl = 1.3;
    p /= scl;

    pR(p.yz, .2 * PI);
    pR(p.xz, -.25 * PI);
    
    float flr = p.y+.5;
    
    #ifdef ALTERNATIVE
    p += sin(p * 08. + (time * vec3(-1,-1,-1) + vec3(0,.5,.75)) * PI * 2.) * .1;
    #else 
    p += sin(p * 08. + time * vec3(1,3,2) * PI * 2. + vec3(0,.5,3)) * .1;
    #endif
    // p += sin(p * 07. + (time * vec3(-1,1,1) + vec3(0)) * PI * 2.) * .1;

    vec3 p2 = p;
    
    p += sin3(p * 80.) * .0015;
    
    float b = length(p) - .66;
    b = fBox(p, vec3(.5 - .01)) - .01;
    
    float d3 = 1e12;
    float rr = .0025;
    p2 = abs(p2);
    p2 = vec3(vmin(p2.xz), p2.y, vmax(p2.xz));
    d3 = min(d3, sdLine(p2.xzy - vec3(.5,.7,.5), .2, rr));
    d3 = max(d3, -vmax(p*vec3(1,-1,-1)));

    #ifdef ALTERNATIVE
    float e = .1;
    p.x += sin(p.x * 04. + (time * -1. + .0) * PI * 2.) * e;
    p.z += sin(p.z * 04. + (time * -1. + sign(p.x) * .25 + .25) * PI * 2.) * e;
    p.y += sin(p.y * 04. + (time * -1. + sign(p.z) * .25) * PI * 2.) * e;
    #else
    p += sin(p * 06. + time * vec3(-3,2,1) * PI * 2. * 1. + vec3(.1,.5,.6)) * .1;
    #endif

    b = smax(b, -vmin(abs(p)) + .0125, .01);

    float d2 = b + .1;
    
    float d = max(b, -d2 + .01);
    
    d *= invertg;
    
    d2 = max(d2+.001, b);
    
    float id = 1.;
    
    if (d2 < d) 
    {
        id = 3.;
        d = d2;
    }
    
    #ifndef ALTERNATIVE2
    if (d3 < d) {
        d = d3;
        id = 4.;
    }
    #endif
   
    d *= scl;
    return vec2(d, id);
}

//========================================================
// Lighting
//========================================================

vec3 BGCOL = vec3(.86,.8,1);

float intersectPlane(vec3 rOrigin, vec3 rayDir, vec3 origin, vec3 normal, vec3 up, out vec2 uv) {
    float d = dot(normal, (origin - rOrigin)) / dot(rayDir, normal);
  	vec3 point = rOrigin + d * rayDir;
	vec3 tangent = cross(normal, up);
	vec3 bitangent = cross(normal, tangent);
    point -= origin;
    uv = vec2(dot(tangent, point), dot(bitangent, point));
    return max(sign(d), 0.);
}

mat3 envOrientation;

vec3 light(vec3 origin, vec3 rayDir) {
    origin = -origin;
    rayDir = -rayDir;

    origin *= envOrientation;
    rayDir *= envOrientation;

    vec2 uv;
    vec3 pos = vec3(-6);
    float hit = intersectPlane(origin, rayDir, pos, normalize(pos), normalize(vec3(-1,1,0)), uv);
    float l = smoothstep(.75, .0, fBox(uv, vec2(.5,2)) - 1.);
    l *= smoothstep(6., 0., length(uv));
	return vec3(l) * hit;
}

vec3 env(vec3 origin, vec3 rayDir) {    
    origin = -(vec4(origin, 1)).xyz;
    rayDir = -(vec4(rayDir, 0)).xyz;

    origin *= envOrientation;
    rayDir *= envOrientation;

    float l = smoothstep(.0, 1.7, dot(rayDir, vec3(.5,-.3,1))) * .4;
   	return vec3(l) * BGCOL;
}


//========================================================
// Marching
//========================================================

#define ZERO (min(iFrame,0))

// https://iquilezles.org/articles/normalsSDF
vec3 normal( in vec3 pos )
{
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*map(pos+0.001*e).x;
    }
    return normalize(n);
}

struct Hit {
    vec2 res;
    vec3 p;
    float len;
    float steps;
};

Hit march(vec3 origin, vec3 rayDir, float invert, float maxDist, float understep) {
    vec3 p;
    float len = 0.;
    float dist = 0.;
    vec2 res = vec2(0.);
    vec2 candidate = vec2(0.);
    float steps = 0.;
    invertg = invert;

    for (float i = 0.; i < 800.; i++) {
        len += dist * understep;
        p = origin + len * rayDir;
        candidate = map(p);
        dist = candidate.x;
        steps += 1.;
        res = candidate;
        if (dist < .00005) {
            break;
        }
        if (len >= maxDist) {
            len = maxDist;
            res.y = 0.;
            break;
        }
    }   

    return Hit(res, p, len, steps);
}

mat3 sphericalMatrix(vec2 tp) {
    float theta = tp.x;
    float phi = tp.y;
    float cx = cos(theta);
    float cy = cos(phi);
    float sx = sin(theta);
    float sy = sin(phi);
    return mat3(
        cy, -sy * -sx, -sy * cx,
        0, cx, sx,
        sy, cy * -sx, cy * cx
    );
}

mat3 calcLookAtMatrix(vec3 ro, vec3 ta, vec3 up) {
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww,up));
    vec3 vv = normalize(cross(uu,ww));
    return mat3(uu, vv, ww);
}

// Hex tiling, FabriceNeyret2
// https://www.shadertoy.com/view/4dKXR3
float hex(vec2 U) { 
    
    U *= mat2(1,-1./1.73, 0,2./1.73) *5.;      // conversion to
    vec3 g = vec3(U,1.-U.x-U.y), g2,           // hexagonal coordinates
        id = floor(g);                         // cell id

    g = fract(g);                              // diamond coords
    if (length(g)>1.) g = 1.-g;                // barycentric coords
    g2 = abs(2.*fract(g)-1.);                  // distance to borders
    // length(g2)     = distance to center  
    return length(1.-g2);

}

// http://filmicworlds.com/blog/filmic-tonemapping-operators/
vec3 tonemap2(vec3 texColor) {
    texColor /= 2.;
   	texColor *= 16.;  // Hardcoded Exposure Adjustment
   	vec3 x = max(vec3(0),texColor-0.004);
   	return (x*(6.2*x+.5))/(x*(6.2*x+1.7)+0.06);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    #ifdef ALTERNATIVE
    float duration = 4.;
    #else
    float duration = 8.;
    #endif
    time = mod(iTime / duration + .1, 1.);
    //time= 0.;
    
    envOrientation = sphericalMatrix(((vec2(81.5, 119) / vec2(187)) * 2. - 1.) * 2.);

    vec2 uv = (2. * fragCoord - iResolution.xy) / iResolution.y;
    
    #ifdef ALTERNATIVE2
    uv /= 3.;
    #endif
    
    #ifdef ALTERNATIVE
    float h = hex(uv.yx * 1.08 + time * vec2(.1,.172) * -2.);
    #else
    float h = hex(uv.yx * 1.08 + time * vec2(.1,.172) * 2.);
    #endif
    h -= .03;
    h /= length(fwidth(uv * 10.));
    h = 1. - saturate(h);

    Hit hit, firstHit;
    vec2 res;
    vec3 p, rayDir, origin, sam, ref, raf, nor, camOrigin, camDir;
    float invert, ior, offset, extinctionDist, maxDist, firstLen, bounceCount, wavelength;
    
    vec3 col = vec3(0);

    vec3 bgCol = BGCOL * .08 * .5;
    vec3 bgCol2 = bgCol * .3;
    bgCol = mix(bgCol, bgCol2, h);

    invert = 1.;
    maxDist = 15.; 
    
    float fl = 20.;
    
	camOrigin = vec3(0,0,9.5 * fl);
   	camDir = normalize(vec3(uv * .168, -fl));


    firstHit = march(camOrigin, camDir, invert, maxDist * fl, .6);
    firstLen = firstHit.len;

    float steps = 0.;
    
    for (float disperse = 0.; disperse < MAX_DISPERSE; disperse++) {
        invert = 1.;
    	sam = vec3(0);

        origin = camOrigin;
        rayDir = camDir;

        extinctionDist = 0.;
        wavelength = disperse / MAX_DISPERSE;
		float rand = texture(iChannel0, (fragCoord + floor(iTime * 60.) * 10.) / iChannelResolution[0].xy).r;
        wavelength += (rand * 2. - 1.) * (.5 / MAX_DISPERSE);
        
		bounceCount = 0.;
        vec3 nor;

        for (float bounce = 0.; bounce < MAX_BOUNCE; bounce++) {

            if (bounce == 0.) {
                hit = firstHit;
            } else {
                hit = march(origin, rayDir, invert, 1.2, .6);
            }
            
            steps += hit.steps;
            
            res = hit.res;
            p = hit.p;
            
            if (invert < 0.) {
	            extinctionDist += hit.len;
            }

            // hit background
            if ( res.y == 0.) {
                break;
            }
            
            if ( res.y == 4.) {
                break;
            }
            
            nor = normal(p);            
            ref = reflect(rayDir, nor);
            
            if (res.y > 1.) {
                break;
            }

            // shade
            sam += light(p, ref) * .5;
            sam += pow(max(1. - abs(dot(rayDir, nor)), 0.), 5.) * .1;
            sam *= vec3(.85,.85,.98);


            // refract
            float ior = mix(1.2, 1.8, wavelength);
            ior = invert < 0. ? ior : 1. / ior;
            raf = refract(rayDir, nor, ior);
            bool tif = raf == vec3(0); // total internal reflection
            rayDir = tif ? ref : raf;
            offset = .01 / abs(dot(rayDir, nor));
            origin = p + offset * rayDir;
            //invert = tif ? invert : invert * -1.;
            invert *= -1.; // not correct but gives more interesting results

            bounceCount = bounce;
            
        }
        
        if (res.y > 1.) {
            sam = vec3(0);
            sam += light(p, ref) * .5;
            sam += pow(max(1. - abs(dot(rayDir, nor)), 0.), 5.) * .1;
            sam *= vec3(.85,.85,.98);
            vec3 cc = res.y == 2. ? vec3(1) : vec3(.033);
            rayDir = refract(rayDir, nor, 1./1.3);
            sam += env(p, rayDir) * cc;
        }

        if (bounceCount == 0.) {
            // didn't bounce, so don't bother calculating dispersion
            col += sam * MAX_DISPERSE;
            break;
        }
        
        if (res.y < 2.) {
            sam += env(p, rayDir);
        }

        vec3 extinction = vec3(.5,.5,.5) * .0;
        extinction = 1. / (1. + (extinction * extinctionDist));	
        col += sam * extinction * spectrum(-wavelength+.25);
	}
    
    col /= MAX_DISPERSE;

    if (bounceCount == 0. && res.y == 0.) {
        col = bgCol;
    }

    if (res.y == 4.) {
        col = bgCol2;
    }
    
    col = pow(col, vec3(1.19)) * 2.5;
    
    col = tonemap2(col);
        
    fragColor = vec4(col, 1.);
}
