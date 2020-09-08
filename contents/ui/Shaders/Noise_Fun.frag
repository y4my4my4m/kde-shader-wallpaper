// https://www.shadertoy.com/view/tlt3Ds
// Credits to ndxbxrme

//simplex noise from https://thebookofshaders.com/edit.php#11/iching-03.frag
vec3 random3(vec3 c) {
    float j = 4096.0*sin(dot(c,vec3(17.0, 59.4, 15.0)));
    vec3 r;
    r.z = fract(512.0*j);
    j *= .125;
    r.x = fract(512.0*j);
    j *= .125;
    r.y = fract(512.0*j);
    return r-0.5;
}

const float F3 =  0.3333333;
const float G3 =  0.1666667;
float snoise(vec3 p) {

    vec3 s = floor(p + dot(p, vec3(F3)));
    vec3 x = p - s + dot(s, vec3(G3));

    vec3 e = step(vec3(0.0), x - x.yzx);
    vec3 i1 = e*(1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy*(1.0 - e);

    vec3 x1 = x - i1 + G3;
    vec3 x2 = x - i2 + 2.0*G3;
    vec3 x3 = x - 1.0 + 3.0*G3;

    vec4 w, d;

    w.x = dot(x, x);
    w.y = dot(x1, x1);
    w.z = dot(x2, x2);
    w.w = dot(x3, x3);

    w = max(0.6 - w, 0.0);

    d.x = dot(random3(s), x);
    d.y = dot(random3(s + i1), x1);
    d.z = dot(random3(s + i2), x2);
    d.w = dot(random3(s + 1.0), x3);

    w *= w;
    w *= w;
    d *= w;

    return dot(d, vec4(52.0));
}

vec2 bezier(in vec2 p1, in vec2 p2, in vec2 p3, in float t)
{
    float oneminust = 1. - t;
    return oneminust * oneminust * p1 + 2. * oneminust * t * p2 + t * t * p3;
}

float wobbler(in vec2 uv, in float offset)
{
    float n = snoise(uv.xyx + iTime * offset);
	vec2 p1 = vec2(0.0, .5 + .2 * sin(iTime) + n * .2);
    vec2 p2 = vec2(0.5, 0.5 + n * .1);
    vec2 p3 = vec2(1.0, .5 + .2 * cos(iTime) + n * .2);
    vec2 p = bezier(p1, p2, p3, uv.x);
    float y = p.y + n * .1;
    return pow(smoothstep(p.y + .34, p.y + .3, uv.y) * smoothstep(y, y + .04, uv.y), 5.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    uv.y += .2;
    float f = wobbler(uv, .1) * .3;
    f += wobbler(uv, .2) * .3;
    f += wobbler(uv, .11) * .3;
    vec3 col = vec3(0.2, 0.5, 0.7) * vec3(f) * 1.5 + .2 - length(uv - vec2(.5, .8)) * .1;
    fragColor = vec4(col,1.0);
}
