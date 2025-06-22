// url: shadertoy.com/view/fdKXRR
// credits: leon

// taste of noise 9 by leon denise 2021/10/15
// result of experimentation with organic patterns
// using code from Inigo Quilez, David Hoskins and NuSan
// thanks to Fabrice Neyret for code reviews
// licensed under hippie love conspiracy

// global variable
float material;
float rng;


// Dave Hoskins
// https://www.shadertoy.com/view/4djSRW
float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}


// Inigo Quilez
// https://iquilezles.org/articles/distfunctions
float sdBox( vec3 p, vec3 b ) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

// rotation matrix
mat2 rot(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

#define repeat(p,r) (mod(p,r)-r/2.)

// sdf
float map (vec3 p)
{
    // time
    float t = iTime;
    
    // keep original pos
    vec3 pp = p;
    
    // domain repeat
    float grid = 2.5;
    p.z += t * 0.05;
    vec3 cell = floor((p+grid/2.)/grid);
    p = repeat(p+grid/2.,grid);
    
    // rotation parameter
    vec3 angle = vec3(-.1,-.2,.3)+cell*78.-t*.01;
    
    // kif
    const float count = 11.0;
    float a = 1.0;
    float scene = 1000.;
    float shape = 1000.;
    for (float index = 0.0; index < count; ++index)
    {        
        
        // fold
        p.xz = abs(p.xz)-0.5*a;
        
        // rotate
        p.yx *= rot(angle.z/a);
        p.xz *= rot(angle.y/a);
        p.yz *= rot(angle.x/a);
        
        // sdf object
        shape = sdBox(p, vec3(0.05,0.2,0.01)*a*2.5);
        
        // material
        material = shape < scene ? index : material;
        
        // add
        scene = min(scene, shape);
        
        // falloff
        a /= 1.25;
    }
    
    // crop tunnel
    scene = max(scene, -sdBox(pp,vec3(0.1,0.05,.5)));
        
    return scene;
}

// return color from pixel coordinate
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // reset color
    fragColor = vec4(0,0,0,1);
    material = 0.0;
    
    // white noise
    vec3 seed = vec3(gl_FragCoord.xy, iTime);
    rng = hash13(seed);
    
    // camera coordinates
    vec2 uv = (fragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
    vec3 eye = vec3(0,0,0);
    vec3 at = vec3(0,0,1);
    vec2 mouse = (iMouse.xy/iResolution.xy-.5)*step(0.5,iMouse.z);
    at.yz *= rot(-mouse.y);
    at.xz *= rot(mouse.x);
    vec3 z = normalize(at-eye);
    vec3 x = normalize(cross(z, vec3(0,1,0)));
    vec3 y = (cross(x, z));
    vec3 ray = normalize(vec3(z * .5 + uv.x * x + uv.y * y));
    vec3 pos = eye;
    
    float pixelSize = 1./iResolution.y;
    
    // raymarch
    const float steps = 30.0;
    float index;
    for (index = steps; index > 0.0; --index)
    {
        // volume estimation
        float dist = map(pos);
        if (dist < pixelSize)
        {            
            break;
        }
        
        // dithering
        dist *= 0.9 + .1 * rng;
        
        // raymarch
        pos += ray * dist;
    }
    
    float shade = index/steps;

    // compute normal by NuSan (https://www.shadertoy.com/view/3sBGzV)
    vec2 off=vec2(pixelSize,0);
    vec3 normal = normalize(map(pos)-vec3(map(pos-off.xyy), map(pos-off.yxy), map(pos-off.yyx)));

    // lighting
    float ld = dot(reflect(ray, normal), vec3(0,1,0))*0.5+0.5;
    vec3 light = vec3(0.914,0.569,0.086) * sqrt(ld);
    ld = dot(reflect(ray, normal), vec3(0,1,0))*0.5+0.5;
    light += vec3(0.576,0.898,0.941) * pow(ld, 5.);

    // Inigo Quilez color palette (https://iquilezles.org/articles/palettes)
    vec3 tint = .5+.5*cos(vec3(1,2,3)+material*2.+length(pos)*.5-2.);

    // pixel color
    fragColor.rgb = (tint + light) * shade;
}


