// From https://www.shadertoy.com/view/lflGRS
// Credits to amagitakayosi

#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

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

layout(binding = 1) uniform sampler2D iChannel0;
layout(binding = 1) uniform sampler2D iChannel1;
layout(binding = 1) uniform sampler2D iChannel2;
layout(binding = 1) uniform sampler2D iChannel3;

vec2 fragCoord = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * ubuf.iResolution.xy;


// global vars
float light = 999.;
float dark = 1.;
float roty = 0.;
float time;
float mode;
float modetime;

mat2 rot(float t) {
    return mat2(cos(t), -sin(t), sin(t), cos(t));
}

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

vec2 map(vec3 p) {
    p.xz *= rot(roty);
    
    float d1, d2;
    d1 = d2 = 999.;    
    
    // White cells
    for (int i = 0; i < 7; i++) {
        float fi = float(i) * 0.8+ time * 0.3;
        vec3 pp = p + vec3(
            cos(fi* 1.7),
            sin(fi * 2.3),
            sin(fi * 1.9)
        ) * 1.3;
        pp.xz *= rot(fi * 0.1);
        pp.xy *= rot(fi * -0.4);
        pp *= 1. + sin(fi * 3.) * 0.1;
        d1 = min(d1, sdSphere(pp, 1.3));
    }

    // Ikura
    vec3 p2 = p * 2.;   
    vec3 p3 = p2.yxz;       

    p2 = abs(p2);
    p2 -= vec3(2,0,0);        
    d2 = min(d2, sdSphere(p2, 1.));

    p3.xy *= rot(time * .7);
    p3 = abs(p3);        
    p3 -= vec3(2, 1, 2);
    d2 = min(d2, sdSphere(p3, 1.));               

    // Save ikura dist as light power
    light = d2;

    return d1 < d2 ? vec2(d1, 1) : vec2(d2, 2);
}

vec3 getNormal(vec3 p) {
    vec2 d = vec2(0, 0.001);
    return normalize(vec3(
        (map(p + d.yxx) - map(p - d.yxx)).x,
        (map(p + d.xyx) - map(p - d.xyx)).x,
        (map(p + d.xxy) - map(p - d.xxy)).x
    ));
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(49., 489.))) * 39284.);
}

float char(vec2 uv, float i, vec2 offset) {
    uv += offset;
    uv = (uv - .5) * 2. + .5;
    uv = clamp(uv, 0., 1.);
    
    float x = mod(i, 16.);
    float y = 15. - floor(i / 16.);    
    vec4 char = texture(iChannel0, (uv + vec2(x, y)) / 16.);
    return 1. - char.a;
}

float text(vec2 p, bool isEdge) {
    vec2 uv = p * 0.5 * vec2(1, 2.2) + 0.5;    

    // Joint "C" and "T"
    uv.x = max(min(uv.x, .34), min(uv.x, step(.675, uv.x) * uv.x));
        
    float c = 0.;
    c = max(c, char(uv, 82., vec2(0.7, 0)));
    c = max(c, char(uv, 69., vec2(0.51, 0)));
    c = max(c, char(uv, 65., vec2(0.34, 0)));
    c = max(c, char(uv, 67., vec2(0.19, 0)));
    c = max(c, char(uv * .97, 84., vec2(-.18, 0.016))); // Adjust "T"
    c = max(c, char(uv, 73., vec2(-.35, 0)));
    c = max(c, char(uv, 79., vec2(-.5, 0)));
    c = max(c, char(uv, 78., vec2(-.7, 0)));

    return isEdge
        ? smoothstep(.01, 0., abs(c - .5))
        : smoothstep(.5, .52, c);
}

vec3 raymarch(in vec2 p, vec3 ro, vec3 rd) {
    float l = length(p);

    vec3 rp;
    float t;
    vec2 hit;
    float iter;

    vec3 col;            

    // keep the iteration count low; I love the artifact
    for (int i = 0; i < 30; i++) {
        iter = float(i);    
        rp = ro + rd * t;

        hit = map(rp);
        if (hit.x < 0.03) {
            break;
        } else if (t > 30.) {
            hit = vec2(0);
        }
        
        t += hit.x * 0.5;
    }

    vec3 ld = normalize(vec3(1, 1, 0));
    ld.xz *= rot(-roty);

    // Cheap AO with dither
    float ao = pow(iter, .8);
    ao *= (0.8 + 0.2 * hash(p + ubuf.iTime));

    vec3 n = normalize(getNormal(rp) + vec3(0, 0, hash(p * 0.2 + ubuf.iTime) * 0.03));
    if (hit.y == 1.) {                                   
        // diffuse
        float dif = clamp(dot(n, ld), 0., 1.) * .2;
        float amb = 0.8;
        col += vec3(.92, .9, .99) * (dif+amb);

        // specular
        vec3 hv = normalize(ld - rd);                
        col += pow(clamp(dot(n,hv),0.,1.), 88.0) * 0.2;
        
        // reflection
        col *= mix(vec3(1), texture(iChannel1, n).rgb * 3., .07); 
        
        col += pow(.2 / light, 0.8) * vec3(1., .3, 0); // glow
        col -= 0.01 * ao;
        
        col *= smoothstep(-8., 0.7, rp.y); // vertical shadow
    } else if (hit.y == 2.) {     
        // diffuse
        float fre = pow(1. - clamp(dot(-rd, n), 0., 1.), 1.);        
        col += pow(fre, 3.) * 7.; 
        
        // specular
        vec3 hv = normalize(ld - rd);                
        col += pow(clamp(dot(n,hv),0.,1.),99.0) * 0.9; 

        // reflection
        col *= mix(vec3(1), texture(iChannel1, n).rgb * 2., .9);        

        // glow
        fre = pow(1. - clamp(dot(-rd, n), 0., 1.), 8.);
        col += mix(vec3(3., 2., 0), vec3(.2, .0, .0), fre) * 0.8;
        col -= 0.2 * ao;
    } else {    
        // BG
        col = cos(l * 1.2 - 1.2) * vec3(.94, .99, 1.) * 0.9;
        
        // Text animation
        if (mode == 1. || mode == 3.) {                    
            bool isEdge = mode > 2.;
            float y = 0.3;
            for (int i = 0; i < 6; i++) {
                float fi = float(i);
                col -= text(p + vec2(0, -.75 + float(i) * y), isEdge) * 0.7 
                    * step(fi * .1 + .3, modetime) * step(modetime, fi * .1 + 1.3);
                col += text(p + vec2(0, -.75 + float(i) * y), isEdge) * 0.7 
                    * step(fi * .1 + 2., modetime) * step(modetime, fi * .1 + 3.);
            }
        }
    }   

    return col;
}

float spin(float x, float div, float slope) {
    return (1. - exp(mod(x, div) * -3.) + floor(x / div) + x / slope);
}

#define PHASE_1 0.5
#define PHASE_2 4.0
#define PHASE_12 4.5

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/ubuf.iResolution.xy;
    vec2 p = uv * 2. - 1.;
    p.x *= ubuf.iResolution.x / ubuf.iResolution.y;

    time = ubuf.iTime;
    
    // motion blur
    float motion = exp(mod((time - PHASE_1), PHASE_12)* -2.);
    time += motion * hash(p * vec2(.000003, 20.)) * 0.02;
    
    // Update global variables
    roty = spin(time - PHASE_1, PHASE_12, 16.) * 18.;           
    mode = mod(floor(time / PHASE_12) + floor((time - PHASE_1) / PHASE_12) + 1., 4.);
    modetime = min(mod(time, PHASE_12), mod(time - PHASE_1, PHASE_12));

    float l = length(p);

    // Change camera zoom by mode
    float zoom = 1.0;    
    if (mode == 0.) { zoom = 3.0; }
    else if (mode == 1.) { zoom = 1.2; }
    else if (mode == 2.) { zoom = 2.1; p *= rot(.78); }
    else { zoom = 1.1; }    

    vec3 ro = vec3(0, 0, 5);
    vec3 rd = normalize(vec3(p, -zoom + 0.2 * pow(l, 2.)));        

    vec3 col;
    
    // Aberration    
    col.r += raymarch(p, ro, rd).r;
    col.g += raymarch(p*.99, ro, rd).g;
    col.b += raymarch(p*.98, ro, rd).b;    
    
    // Overlay text
    if (mode == 0.) {
        col.rgb += text(p, true) * step(0., sin(time * 50.));
    }
    if (mode == 2.) {        
        col.rgb -= text(abs(uv * 2. - 1.) * vec2(3, 2) - 1., false) * sin(time * 50.);
        col.rgb = 1. - col.grb; // Invert
    }    

    fragColor = vec4(col,1.0);
}


void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
