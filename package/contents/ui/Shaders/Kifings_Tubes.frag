// url: https://www.shadertoy.com/view/ssfcR2
// credits: leon

// are we arrived yet?
// kifings tubes with a twist
// leon denise 2022 01 16

// smooth union by Inigo Quilez
// https://iquilezles.org/articles/distfunctions
float smin( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}
    
// rotation matrix
mat2 rot(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

// repetition domain
#define repeat(p,r) (mod(p+r/2.,r)-r/2.)

// geometry
float map(vec3 p)
{
    vec3 pp = p;
    float dist = 100.;
    p.z += iTime * .1; // translate
    float cell = .7; // size of repetition
    float pz = floor(p.z/cell); // index of cell in line
    p.z = repeat(p.z, cell); // repeat space z
    p.z *= mix(-1., 1., step(0.5, mod(p.z, 2.))); // mirror z per cell in line
    float d = length(p); // distance from origin
    float t = iTime * .1; // time rotation
    const float count = 6.; // number of shapes
    float a = 1.; // amplitude of falloff
    for (float i = 0.; i < count; ++i) { // kifing
        p.yz *= rot(t); // twist
        p.yx *= rot(t); // twist
        p = abs(p)-(.05+d*.2)*a; // fold space
        dist = smin(dist, length(p.xz)-(.01+d*.1)*a, (.01+d*.8)*a); // smoothly add tube
        a /= 2.; // falloff curve
    }
    return abs(dist)-.0001; // shell volume
}

void mainImage( out vec4 color, in vec2 coordinate )
{
    // coodinates
    vec2 pixel = (coordinate - iResolution.xy / 2.) / iResolution.y;
    vec3 eye = vec3(0,0,-1.);
    vec3 ray = normalize(vec3(pixel, 1.5));
    vec3 pos = eye + ray * .5; // start ahead, carve volume
    
    // raymarch
    const float count = 30.;
    float i = 0.;
    for (i = count; i > 0.; --i) {
        float dist = map(pos);
        if (dist < .0001) break;
        pos += ray * dist;
    }
    
    // coloring
    float shade = i/count;
    // Inigo Quilez color palette (https://iquilezles.org/articles/palettes)
    vec3 tint = .9 + .1 * cos(vec3(.0, .3, .6) * 6.283 + shade * 6. + pos.z * 18. + 2.);
    color = vec4(tint * shade,1.0);
}
