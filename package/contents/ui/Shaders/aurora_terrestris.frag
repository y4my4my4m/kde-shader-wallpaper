/*


  ||=================================================================================||
  ||     _                               _____                       _        _      ||
  ||    / \  _   _ _ __ ___  _ __ __ _  |_   _|__ _ __ _ __ ___  ___| |_ _ __(_)___  ||
  ||   / _ \| | | | '__/ _ \| '__/ _` |   | |/ _ \ '__| '__/ _ \/ __| __| '__| / __| ||
  ||  / ___ \ |_| | | | (_) | | | (_| |   | |  __/ |  | | |  __/\__ \ |_| |  | \__ \ ||
  || /_/   \_\__,_|_|  \___/|_|  \__,_|   |_|\___|_|  |_|  \___||___/\__|_|  |_|___/ ||
  ||                                                                                 ||
  ||                                    by chronos                                   ||
  ||                                                                                 ||
  ||=================================================================================||


   ----------------------------------------------------
     self link: https://www.shadertoy.com/view/WcdcD7
   ----------------------------------------------------

*/


#define R(a) mat2(cos((a) + vec4(0,-11, 11,0)))

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (2. * fragCoord - iResolution.xy)/iResolution.y;

    vec3 color = vec3(0);

    float speed = -3.5;
    float pos = iTime * speed;

    float focal = 2.;

    float r = 200.;
    vec3 rd = normalize(vec3(uv, -focal));
    vec3 ro = vec3( cos(pos/r)*r, 3. + sin(.1*pos), sin(pos/r)*r );

    rd.xy *= R(.3*sin(.1*iTime)+.4);

    rd.xz *= R(pos/r);

    float hash = fract(631.123123*sin(float(iFrame)+length(uv)*331.+dot(uv, vec2(111.123123,171.3123))));
    float t = 1.+.2*hash;
    const float phi = sqrt(5.)*.5+.5;
    float daynight = smoothstep(-.6, .6, sin(iTime*.05));
    
    mat2 M = R(phi * 3.1415);
    for(int i = 0; i < 99 && t < 1e3; i++)
    {
        vec3 p = rd * t + ro;
        vec3 q = p;

        for(float j = 0.01; j < 11.; j+=j)
        {
            p.xz *= M;
            p.xz -= 1.3*j;
            p += .4*j * cos(p.zxy/j);
        }

        float sdf = max(p.y+1.5, 0.);
        
        sdf = mix(sdf, min(sdf,(7.-.2*p.y)), daynight);
        float dt = abs(sdf) * .3 + 1e-3;

        vec3 cmap = (1. + -cos(p.y*.3+ .1 * (t+1.5*iTime) + vec3(1,2,3)  + length(p-ro)*.1) ) * exp2(2.65*tanh(q.y*.55)-1.55) * exp2(-.01*t);
        color += cmap * dt / (sdf * sdf + 1.);

        t += dt;
    }

    color = tanh(.0025*color*color);
    color = pow(color, vec3(1. / 2.2));
    
    fragColor = vec4(color, 1);
}