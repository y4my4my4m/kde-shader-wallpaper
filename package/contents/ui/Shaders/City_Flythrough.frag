// url: https://www.shadertoy.com/view/7slcRX
// credits leon

// "are we arrived yet?"
// city fly through with blinking rectangles
// leon denise 2022 01 18
    
// rotation matrix
mat2 rot(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

// domain repetition
#define repeat(p,r) (mod(p+r/2.,r)-r/2.)

// hash by 4tfyW4 and Inigo Quilez https://www.shadertoy.com/view/XlXcW4
vec3 hash( uvec3 x ) {
    uint k = 1103515245U;
    x = ((x>>8U)^x.yzx)*k;
    x = ((x>>8U)^x.yzx)*k;
    x = ((x>>8U)^x.yzx)*k;
    return vec3(x)*(1.0/float(0xffffffffU));
}

// geometry
vec3 plocal;
float map(vec3 p)
{
    vec3 pp = p;
    float dist = 100.;
    float tt = iTime * .02; // speed
    p.z += tt; // translate
    float cell = 1.; // size of repetition
    float pz = floor(p.z/cell); // index of cell in line
    p.z = repeat(p.z, cell); // repeat space z
    p.z *= mix(-1., 1., step(0., p.z)); // mirror z per cell in line
    float t = floor(pp.z/cell); // rotation
    const float count = 9.; // number of shapes
    float a = 1.; // amplitude of falloff
    for (float i = 0.; i < count; ++i) { // kifing
        p.xz *= rot(t/a); // twist
        p = abs(p)-.15*a; // fold space
        dist = min(dist, max(p.x, max(p.y, p.z))); // space
        a /= 1.7; // falloff curve
    }
    plocal = p; // for colors
    dist = -dist; // invert volume
    dist = max(dist, -(max(abs(pp.x)-.005, abs(pp.y)-.01))); // crop tunnel
    return dist;
}

void mainImage( out vec4 color, in vec2 coordinate )
{
    // coodinates
    vec2 pixel = (coordinate - iResolution.xy / 2.) / iResolution.y;
    vec3 eye = vec3(0,.002,-1.);
    vec3 ray = normalize(vec3(pixel, 1.+.5*sin(iTime/3.)));
    ray.yz *= rot(-cos(iTime/4.)*.2);
    ray.xz *= rot(sin(iTime/5.)*.2);
    vec3 pos = eye;
    vec3 rng = hash(uvec3(coordinate, mod(iTime, 1000.)*60.));
    
    // raymarch
    const float count = 30.;
    float i = 0.;
    for (i = count; i > 0.; --i) {
        float dist = map(pos);
        if (dist < .0001) break;
        dist *= .9 + .1 * rng.z;
        pos += ray * dist;
    }
    
    // coloring
    float shade = i/count;
    float sat = (1.-shade)*smoothstep(1.,0.,length(pixel));
    
    // vertical colored lines
    vec3 rainbow = (1.-sat)+sat*cos(vec3(.0,.3,.6)*6.3+pixel.y*1.+2.);
    vec3 tint = mix(vec3(0), rainbow, smoothstep(.1, .0, sin(plocal.y*4000.)));
    
    // horizontal colored lines
    rainbow = (1.-sat)+sat*cos(vec3(.0,.3,.6)*6.3+pixel.x*1.+2.5);
    tint = mix(tint, rainbow, smoothstep(.1, .0, sin(plocal.x*1000.)+.4));
    
    // blinking rectangles
    // vec3 mosaic = hash(uvec3(floor(abs(plocal)*1500.)+floor(iTime/.1)));
    // tint += step(.98, mosaic.x);
    
    color = vec4(tint*shade, 1);
}
