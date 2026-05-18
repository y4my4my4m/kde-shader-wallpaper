#version 320 es
precision highp float;

// Boring Dots shader: drifting colorful dots over a plasma background
// shady@dfsmith.net

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    float iTimeDelta;
    float iFrameRate;
    float iSampleRate;
    int iFrame;
    vec4 iDate;
    vec4 iMouse;
    vec3 iResolution;
    float iChannelTime[4];
    vec3 iChannelResolution[4];
} ubuf;

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

float hashf(float n) { return fract(sin(n) * 43758.5453123); }
vec2 hash2(float n){ return vec2(hashf(n+0.1), hashf(n+37.0)); }

vec3 hsb2rgb(vec3 c){
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

void mainImage(out vec4 color, in vec2 uv)
{
    float aspect_ratio = ubuf.iResolution.x / ubuf.iResolution.y;
    vec2 aspect = aspect_ratio > 1.0 ? vec2(aspect_ratio, 1.0) : vec2(1.0, 1.0 / aspect_ratio);
    vec2 center = aspect * 0.5;
    uv *= aspect;
       
    // drifting colorful dots
    vec3 dot_field = vec3(0.0);
    for (int particle = 0; particle < 32; ++particle) {
        float fparticle = float(particle);
        float t = ubuf.iTime;

        // particle base position
        vec2 pxy = hash2(fparticle*0.123) * aspect;

        // particle motion: base + orbit + noise drift
        vec2 seed = hash2(fparticle*0.371);
        float speed = 0.5 + hashf(fparticle+9.0)*1.5;
        float ang = t * (0.2 + seed.x*1.6) + seed.y * 6.28318;
        float rad = 0.006 + 0.06 * hashf(fparticle+4.0);
        vec2 jitter = vec2(cos(ang), sin(ang)) * rad;
        jitter += 0.12 * vec2(sin(t*speed + seed.x*10.0), cos(t*speed*0.7 + seed.y*10.0));
        vec2 pos = pxy + jitter;

        // particle color based on seed
        float hue = hashf(fparticle*0.7 + 0.3);
        vec3 col = hsb2rgb(vec3(hue, 0.9, 1.0));

        // draw particle
        float plen = distance(uv, pos);
        float intensity = smoothstep(0.01, 0.002, plen);
        float glow = smoothstep(0.2, 0.0, plen);

        dot_field += col * (intensity*10.0 + glow*2.0);
    }

    // animated plasma background
    float t = ubuf.iTime * 2.6;
    float p = sin((uv.x*8.0 + t)) + sin((uv.y*10.0 - t*0.9)) + sin((uv.x+uv.y)*6.0 + t*0.7);
    p *= 1.3333;
    vec3 plasma_field = vec3(0.5 + 0.5*sin(2.0 +     p + t*0.2),
                             0.5 + 0.5*sin(4.0 + 1.5*p + t*0.25),
                             0.5 + 0.5*sin(6.0 + 2.5*p + t*0.15));
    float vignette = smoothstep(1.0, 0.1, distance(uv, center));
    plasma_field *= vignette;

    // compose
    color = vec4(pow(plasma_field*0.3 + dot_field * 0.2, vec3(0.9)), 1.0);
}

void main()
{
    mainImage(fragColor, vec2(qt_TexCoord0.x, qt_TexCoord0.y));
}
