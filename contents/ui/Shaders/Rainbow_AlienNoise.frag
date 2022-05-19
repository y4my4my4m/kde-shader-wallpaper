// url: https://www.shadertoy.com/view/NdSBWw
// credits: leon


// Rainbow Alien Noise by Leon Denise 2022/03/04
// variation of https://www.shadertoy.com/view/NsBfW1

// Using code from Martijn Steinrucken, Dave Hoskins,
// Inigo Quilez, Antoine Zanuttini, Shane and many more

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
    return normalize(map(pos)-vec3(map(pos-noff.xyy), map(pos-noff.yxy), map(pos-noff.yyx))); }

// Shane
float sAbs(float x, float c){ return sqrt(x*x + c); }

// Inigo Quilez
// https://www.shadertoy.com/view/Xds3zN
float getAO( in vec3 pos, in vec3 nor, in float scale) {
	float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ ) {
        float h = 0.001 + scale*float(i)/4.0;
        float d = map( pos + h*nor );
        occ += (h-d)*sca;
        sca *= 0.95;
        if( occ>0.35 ) break;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );
}

// geometry
float map(vec3 p) {
  float dist = p.y;
  float scale = 3.;
  float gyroid = 100.;
  float a = 1.0;
  float t = iTime*1.;
  float w = sin(iTime+length(p)*3.);
  float b = .1+.2*w;
  // fractalish gyroid accumulation
  for (float i = 0.; i < 3.; ++i) {
    vec3 s = p*scale/a;
    s.y += t+p.z/a;
    gyroid = smin(gyroid, sAbs(dot(sin(s), cos(s.yzx))/scale*a, .00015) - b*a, 1.*a);
    a /= 3.;
  }
  b = .3+.2*w;
  dist = smin(dist, gyroid, -b);
  return dist;
}


void mainImage( out vec4 color, in vec2 pixel )
{
    // coordinates
    vec2 p = (pixel.xy - iResolution.xy / 2.)/iResolution.y;
    vec3 pos = vec3(0,1,1.5);
    vec3 z = normalize(-pos);
    vec3 x = cross(z, vec3(0,1,0));
    vec3 y = cross(x, z);
    vec3 ray = normalize(z * 1.5 + x * p.x + y * p.y);
    float rng = hash12(pixel);
    // raymarch
    float shade = 1.;
    for (shade; shade > 0.; shade -= 1./40.) {
        float d = map(pos);
        if (d < .001) break;
        d *= .9+.1*rng;
        pos += ray * d;
    }
    // color
    vec3 normal = getNormal(pos);
    float rn = abs(dot(ray,normal));
    float lp = length(pos);
    vec3 rainbow = .5+.5*cos(vec3(.0,.3,.6)*6.28 + lp + iTime);
    vec3 tint = (1.-rn)*(normal*.5+.5)*.5;
    tint += vec3(.3)*pow(rn,3.);
    tint += rn*rainbow*getAO(pos, normal, 0.2);
    color = vec4(tint*shade, 1.);
}
