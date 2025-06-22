// URL: https://www.shadertoy.com/view/WlsSzM
// By: 104

// credits: Dave_Hoskins Hash functions: https://www.shadertoy.com/view/4djSRW

const float PI = 3.141592654;

vec3 hash32(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
}
// returns { RGB, dist to edge (0 = edge, 1 = center) }
vec4 disco(vec2 uv) {
    float v = abs(cos(uv.x * PI * 2.) + cos(uv.y *PI * 2.)) * .5;
    uv.x -= .5;
    vec3 cid2 = hash32(vec2(floor(uv.x - uv.y), floor(uv.x + uv.y))); // generate a color
    return vec4(cid2, v);
}

void mainImage( out vec4 o, in vec2 fragCoord)
{
    vec2 R = iResolution.xy;
    vec2 uv = fragCoord / R;
    uv.x *= R.x / R.y; // aspect correct

    float t = iTime * .6; //t = 0.;
    uv *= 8.;
    uv -= vec2(t*.5, -t*.3);
    
    o = vec4(1);
    for(float i = 1.; i <= 4.; ++i) {
        uv /= i*.9;
        vec4 d = disco(uv);
        float curv = pow(d.a, .44-((1./i)*.3));
        curv = pow(curv, .8+(d.b * 2.));
        o *= clamp(d * curv,.35, 1.);
        uv += t*(i+.3);
    }
    
    // post
    o = clamp(o,.0,1.);
    vec2 N = (fragCoord / R )- .5;
    o = 1.-pow(1.-o, vec4(30.));// curve
    o.rgb += hash32(fragCoord + iTime).r*.07;//noise
    o *= 1.1-smoothstep(.4,.405,abs(N.y));
    o *= 1.0-dot(N,N*1.7);// vingette
    o.a = 1.;
}



