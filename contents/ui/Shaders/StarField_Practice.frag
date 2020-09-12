// https://www.shadertoy.com/view/tllfRX
// Credits to Deadtotem

#define NUM_LAYERS 6.
#define TAU 6.28318
#define PI 3.141592

mat2 Rot(float a){
    float s = sin(a), c=cos(a);
    return mat2(c,-s,s,c);
}

float Star(vec2 uv, float flare){
    float d = length(uv);
    float m = .025/d;
    float rays = max(0., 1.-abs(uv.x*uv.y*1000.));
    m += (rays*flare)*2.;
    uv*=Rot(PI/4.);
    rays = max(0., 1.-abs(uv.x*uv.y*1000.));
    m *= smoothstep(1., .2, d);
    return m;
}

float Hash21(vec2 p){
    p = fract(p*vec2(123.34, 456.21));
    p += dot(p, p+45.32);
    return fract(p.x*p.y);
}


vec3 StarLayer(vec2 uv){
    vec3 col = vec3(0);
    vec2 gv = fract(uv)-.5;
    vec2 id = floor(uv);
    for(int y=-1;y<=1;y++){
        for(int x=-1; x<=1; x++){
            vec2 offs = vec2(x,y);
            float n = Hash21(id+offs);
            float size = fract(n*45.32);
            float star = Star(gv-offs-vec2(n, fract(n*34.))+.5, smoothstep(.8,.9,size)*.46);
            vec3 color = sin(vec3(.2,.3,.9)*fract(n*2345.2)*TAU)*.25+.75;
            color = color*vec3(.9,.59,.9+size);
            star *= sin(iTime*3.+n*TAU)*.25+.5;
            col += star*size*color;
        }
    }
    return col;
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
    vec2 M = (iMouse.xy-iResolution.xy*.5)/iResolution.y;

    float t = iTime*.0162;
    uv *= Rot(t);

    vec3 col = vec3(0);

    for(float i=0.; i<1.; i+=1./NUM_LAYERS){
        float depth = fract(i+t);
        float scale = mix(20., .5, depth);
        float fade = depth*smoothstep(1.,.9,depth);
        col += StarLayer(uv*scale+i*453.2-iTime*.05-M)*fade;
    }

    fragColor = vec4(col,1.0);
}
