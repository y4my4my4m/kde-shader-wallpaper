// url: https://www.shadertoy.com/view/NsBfW1
// credits: leon


// Spiky Gyroid by Leon Denise 2022/02/28

// Inspired by Martijn Steinrucken "Math Zoo - Alien Orb"
// https://www.youtube.com/watch?v=b0AayhCO7s8
// https://www.shadertoy.com/view/tlcXWX

// Using code from Martijn Steinrucken, Dave Hoskins,
// Inigo Quilez, Antoine Zanuttini and many more

// Rotation matrix
mat2 rot (float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
float map(vec3 p);

// Dave Hoskins
// https://www.shadertoy.com/view/4djSRW
float hash12(vec2 p) {
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z); }

// Inigo Quilez
// https://iquilezles.org/articles/distfunctions
float smin( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h); }

// Antoine Zanuttini
// https://www.shadertoy.com/view/3sBGzV
vec3 getNormal (vec3 pos) {
    vec2 noff = vec2(0.001,0);
    return normalize(map(pos)-vec3(map(pos-noff.xyy), map(pos-noff.yxy), map(pos-noff.yyx)));
}


// Shane
float sAbs(float x, float c){ return sqrt(x*x + c); }

// Inigo Quilez
// https://www.shadertoy.com/view/Xds3zN
float getAO( in vec3 pos, in vec3 nor, in float scale) {
	float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ ) {
        float h = 0.01 + scale*float(i)/4.0;
        float d = map( pos + h*nor );
        occ += (h-d)*sca;
        sca *= 0.95;
        if( occ>0.35 ) break;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );
}

// geometry
float map(vec3 p) {
  vec3 pp = p;
  float dist = p.y;
  float scale = 10.;
  float gyroid = 100.;
  float a = 1.0;
  // fractalish gyroid accumulation
  for (float i = 0.; i < 3.; ++i) {
    vec3 s = p*scale/a;
    s.y += iTime+pp.z/a;
    
    // hard edges version
    gyroid = smin(gyroid, abs(dot(sin(s),cos(s.yzx))/scale*a)-.1*a, .2*a);
    
    // nice smooth version by Shane
    //gyroid = smin(gyroid, sAbs(dot(sin(s), cos(s.yzx))/scale*a, .00015) - .1*a, .3*a);
    
    a /= 2.;
  }
  dist = smin(abs(dist)-.2, gyroid, -.4);
  return dist;
}


void mainImage( out vec4 color, in vec2 pixel )
{
    // coordinates
    vec2 p = (pixel.xy - iResolution.xy / 2.)/iResolution.y;
    vec3 pos = vec3(1);
    vec3 z = normalize(-pos);
    vec3 x = normalize(cross(z, vec3(0,1,0)));
    vec3 y = normalize(cross(x, z));
    vec3 ray = normalize(z * 2. + x * p.x + y * p.y);
    float rng = hash12(pixel);
    // raymarch
    float shade = 1.;
    for (shade; shade > 0.; shade -= 1./33.) {
        float d = map(pos);
        if (d < .001) break;
        d *= .9+.1*rng;
        pos += ray * d;
    }
    // color
    vec3 normal = getNormal(pos);
    vec3 tint = .6+.2*normal;
    tint += vec3(1,.5,0)*getAO(pos, -normal, 0.05);
    color = vec4(tint*shade, 1.);
}
