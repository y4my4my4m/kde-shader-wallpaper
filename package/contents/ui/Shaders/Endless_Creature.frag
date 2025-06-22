// url: https://www.shadertoy.com/view/tljXWy
// credits: leon

// Weird endless living creature
// inspired by Inigo Quilez live stream shader deconstruction
// Leon Denise (ponk) 2019.08.28
// Licensed under hippie love conspiracy

// Using code from
// Inigo Quilez
// Morgan McGuire

// tweak zone
const int count = 15;
const float speed = 1.;
const float balance = 1.5;
const float range = 1.4;
const float radius = .6;
const float blend = .3;
const float falloff = 1.2;

// increment it at your own GPU risk
const float motion_frames = 1.;

// toolbox
const float PI = 3.1415;
#define repeat(p,r) (mod(p,r)-r/2.)
float random(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
float smoothmin (float a, float b, float r) { float h = clamp(.5+.5*(b-a)/r, 0., 1.); return mix(b, a, h)-r*h*(1.-h); }
float sdSphere (vec3 p, float r) { return length(p)-r; }
vec3 look (vec3 eye, vec3 target, vec2 anchor, float fov) {
    vec3 forward = normalize(target-eye);
    vec3 right = normalize(cross(forward, vec3(0,1,0)));
    vec3 up = normalize(cross(right, forward));
    return normalize(forward * fov + right * anchor.x + up * anchor.y);
}

float geometry (vec3 pos, float time) {
    float scene = 1., a = 1.;
    float t = time * .5 + pos.x / 30.;
    t = floor(t)+smoothstep(0.0,.9,pow(fract(t),2.));
    pos.x = repeat(pos.x+iTime, 5.);
    for (int i = count; i > 0; --i) {
        pos.x = abs(pos.x)-range*a;
        pos.xy *= rot(cos(t)*balance/a+a*2.);
        pos.zy *= rot(sin(t)*balance/a+a*2.);
        scene = smoothmin(scene, sdSphere(pos,(radius*a)), blend*a);
        a /= falloff;
    }
    return scene;
}

float raymarch ( vec3 eye, vec3 ray, float time, out float total ) {
    float dither = random(ray.xy+fract(time));
    total = 0.0;
    const int count = 20;
    for (int index = count; index > 0; --index) {
        float dist = geometry(eye+total*ray,time);
        dist *= 0.9+0.1*dither;
        total += dist;
        if (dist < 0.001 * total) {
            return float(index)/float(count);
        }
    }
    return 0.;
}

vec3 camera (vec3 eye) {
    vec2 mouse = iMouse.xy/iResolution.xy*2.-1.;
    if (iMouse.z > 0.5) {
        eye.yz *= rot(mouse.y*PI);
        eye.xz *= rot(mouse.x*PI);
    }
    return eye;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    vec2 uv = 2.*(fragCoord-0.5*iResolution.xy)/iResolution.y;
    vec3 eye = camera(vec3(0,0,4));
    vec3 ray = look(eye, vec3(0), uv, 1.);
    float total = 0.0;
    fragColor = vec4(0);
    for (float index = motion_frames; index > 0.; --index) {
        float dither = random(ray.xy+fract(iTime+index));
        float time = iTime*speed+(dither+index)/10./motion_frames;
        fragColor += vec4(raymarch(eye, ray, time, total))/motion_frames;
    }
    
    // extra color
    fragColor.rgb *= vec3(.7,.8,.9);
    float d = smoothstep(7.,0.,total);
    fragColor.rgb += vec3(0.8,.6,.5) * d;
}
