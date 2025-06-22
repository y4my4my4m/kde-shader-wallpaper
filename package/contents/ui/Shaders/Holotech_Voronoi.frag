// url: https://www.shadertoy.com/view/flSBWG
// credits: Dubswitcher

float hash(in vec2 uv){
    return fract(sin(dot(uv, vec2(14.478473612, 53.252567))) * 37482.1);
}

vec2 hash2(in vec2 uv)
{
    vec3 o = fract(vec3(uv.yxx*893.335)*vec3(0.146651, 0.185677, 0.135812));
    o += dot(o.zxy, o.yzx+60.424);
    return fract((o.yx+o.zy)*o.xz);
}

vec3 rcol(in vec2 uv)
{
    vec3 o = fract(vec3(uv.yxx*879.346)*vec3(0.163128, 0.131784, 0.178327));
    o += dot(o.zxy, o.yzx+56.213);
    return fract((o.yxz+o.zyx)*o.xzy);
}

float dtfi (in vec2 a, in vec2 b, in vec2 c)
{
    float o = (dot(normalize(a-b),b-c)+distance(a,b))/distance(a,b);
    return min(o,-o+2.);
}

float tridistance (in vec2 a, in vec2 b)
{
    float t = radians(0.);
    vec2 uv = (a-b) * mat2(cos(t),-sin(t),sin(t),cos(t));
    float o = uv.x;
    t = radians(120.);
    uv = (a-b) * mat2(cos(t),-sin(t),sin(t),cos(t));
    o = max(o,uv.x);
    t = radians(240.);
    uv = (a-b) * mat2(cos(t),-sin(t),sin(t),cos(t));
    o = max(o,uv.x);
    return o;
}

float voronoi (in vec2 uv, in float zPos, in float seed, in float wall)
{
    float build = 0.;
    float dist = 0.;
    for (float x = -2.; x <= 2.; x++)
    {
        for (float y = -2.; y <= 2.; y++)
        {
            vec2 cell = vec2(x,y);
            vec2 ID = floor(uv)-cell+seed;
            float rand = (zPos+hash(ID))*(hash(ID)*0.5+0.5);
            float B = fract(rand);
            vec3 offs = vec3(floor(rand),ceil(rand),B*B*(3.-2.*B));
            vec2 point = mix(hash2(ID+offs.x),hash2(ID+offs.y),offs.z);
            
            float distP = tridistance(point,fract(uv)+cell)-3.;
            build = mix(distP,build,smoothstep(build-wall,build+wall,distP));
            dist = min(dist,distP);
        }
    }
    return smoothstep(dist,dist+0.05,build);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord-0.5*iResolution.xy)/iResolution.y;
    float c = voronoi(uv*4.,iTime,0.,0.1);
    vec3 col = mix(vec3(0.,0.1,0.2),vec3(0.7,0.8,1.),c);
    fragColor = vec4(col,1.0);
}
