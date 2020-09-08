// https://www.shadertoy.com/view/3ssfW8
// Credit to BradyInstead

// Fork of "Brady's Reflections" by BradyInstead. https://shadertoy.com/view/tsXfD8
// 2020-04-29 09:06:59


#define MAX_MARCH 12.
#define MAX_MARCH_REFLECT 2.

#define REFLECT_POWER .8

#define NUM_REFLECTIONS 4

float opSmoothUnion( float d1, float d2, float k )
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

float sphere(vec3 p)
{
    float div = 1.05;
    vec3 grid = floor(p/div);
    p.xz = mod(p.xz, div) - div/2.;

    p.y -= abs(sin(iTime + grid.x*2.)*.1);
    p.y -= abs(cos(iTime + grid.z*2.)*.1);

    float sphere = length(p) - .5;
    float amp = .05;

    grid = abs(grid);
    return sphere - amp*sin(iTime*5. + grid.z)*sin(iTime + grid.x)*sin(iTime + grid.z*7.) + amp;
}

float plane( vec3 p)
{
    return abs(p.y);
}

float model(vec3 p)
{
    float amount = .05;

    // movement
    p.xz -= iTime*.5;

    float sp = sphere(p);
    float pl = plane(p + vec3(0, .5, 0.));

    return min(sp, pl);
}

float raymarch(in vec3 ro, in vec3 rd, float maxdist, float modifier)
{
    float dist = 0.;
    for(int i = 0; i < 90; i++)
    {
        float m = model(ro+rd*dist)*modifier;
        dist += m;

        if(m < .001) return dist;
        else if(dist > maxdist) break;
    }
    return -1.;
}

vec3 normal(vec3 pos)
{
    vec3 eps = vec3(.01, -.01, 0.);

    return normalize(vec3(
        model(pos + eps.xzz) - model(pos + eps.yzz),
        model(pos + eps.zxz) - model(pos + eps.zyz),
        model(pos + eps.zzx) - model(pos + eps.zzy)));
}

float shadow(in vec3 pos, in vec3 ld)
{
    float spread = 3.;
    float res = 1.0;
    for(float t = .2; t < .4;)
    {
        float dist = model(pos+ld*t);
        if(dist<.001) return 0.;
        res = min(res, spread*dist/t);
        t += dist;
    }
    return res;
}


vec3 background()
{
    return vec3(0.);
    //return vec3(.2, .3, .1);
}

vec3 shade(vec3 pos, vec3 nor, vec3 rd, float dist)
{
    if(dist < 0.) return background();

    vec3 lp = vec3(2., 2., 0.);
    vec3 ld = normalize(lp-pos);

    float dif = max(dot(nor,ld),0.);
    float sha = 0.;
    if(dif > .01) sha = shadow(pos, ld);
    vec3 lin = vec3(dif) * vec3(sha) * vec3(1.0);

    float sharp = 10.0;
    float inten = .5;
    vec3 ref = 2.0 * dot(ld, nor)*nor-ld;
    lin += pow(max(0., dot(-rd, ref)), sharp) * vec3(inten) * sha;

    vec3 col = lin;
    col *= exp(-.01*dist*dist);
    col *= 0.3+0.7*clamp((pos.y+0.5)*2.0,0.0,1.0);

    return col;
}

//	1. raymarch until you hit something
//	2. calculate the surface normal at that spot
//	3. reflect your marching vector: dir -= 2. * dot(dir, normal) * normal
//	4. march in the new direction until you hit something else
//	5. figure out the colour for the second hit location (use lighting, etc.)
//	6. figure out the colour for the first hit, using the second hit's color as part of the calculation

vec3 reflection(vec3 pos, vec3 rd, vec3 nor, float dist)
{
    if(dist < -.1) return background();

    vec3 rrd = reflect(rd, nor);
    vec3 rro = pos + rrd*.02;

    vec3 col = vec3(0.);
    vec3 fade = vec3(1.);

    for(int i = 0; i < NUM_REFLECTIONS; i++)
    {
        float rdist = raymarch(rro, rrd, MAX_MARCH_REFLECT, 1.);

        vec3 rpos = rro + rrd*rdist;
        vec3 rnor = normal(rpos);

        fade -= pow(1. - rdist/MAX_MARCH_REFLECT, .5) * .3; //* vec3(.5, .9, .1);

        rrd = reflect(rrd, rnor);
        rro = rpos + rrd*.02;

        col += shade(rpos, rnor, rrd, rdist) * fade;
    }

    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (fragCoord - .5*iResolution.xy)/iResolution.y;

    //vec2 s = sign(p);
    p.x = abs(p.x);
    //p.y = pow(p.y, .8);


    vec3 ro = vec3(3., 3., 3.);
    vec3 ta = vec3(0.0, 0., 0.0);

    vec3 w = normalize (ta-ro);
    vec3 u = normalize (cross (w, vec3(0., 1., 0.)));
    vec3 v = normalize (cross (u, w));
    mat3 mat = mat3(u, v, w);
    vec3 rd = normalize (mat*vec3(p.xy,1.5));

    float dist = raymarch(ro, rd, MAX_MARCH, 1.);
    vec3 pos = ro+rd*dist;
    vec3 nor = normal(pos);

    vec3 col = shade(pos, nor, rd, dist);
    vec3 ref = reflection(pos, rd, nor, dist);

    //col = mix(col, ref, REFLECT_POWER);
    col += ref*REFLECT_POWER;

    // Output to screen
    fragColor = vec4(col,1.0);
}
