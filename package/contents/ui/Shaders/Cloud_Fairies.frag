// url: https://www.shadertoy.com/view/3stfzB
// credits: athibaul

// Simplified lighting of clouds

// Iterating on the ideas I used for "Fishermen at sea" and "Distress Flare"
// https://www.shadertoy.com/view/tdKcWD
// https://www.shadertoy.com/view/3dGyRc

// They were in turn inspired by "Clouds" by iq,
// who uses a non-physical lighting where light intensity
// is a function of the density difference between the current
// point and a point further toward the source.
// https://www.shadertoy.com/view/XslGRr

#define R(a) mat2(cos(a),sin(a),-sin(a),cos(a))
//#define T(p) smoothstep(0.,1.,textureLod(iChannel0,(p)/256.,0.).r)
#define T(p) textureLod(iChannel0,(p)/256.,0.).r

float fbm(vec2 p)
{
    p += T(p.yx*5. + iTime*0.1)*0.1;
    return T(p)/2. + T(p*2.)/4. + T(p*4.)/8. + T(p*8.)/16. + T(p*16.)/32. + T(p*32.)/64.;
}


float density(vec2 p) 
{
    return smoothstep(0.2,0.8,fbm(p-0.1*iTime))*3.;
}


float light(vec2 p, vec3 source)
{
    float dist = length(source - vec3(p,0));
    float dist2D = length(source.xy-p);
    //float lerpFactor = 1.0/dist;
    float T = 1.; // Integrate transmittance along the trajectory
    float d1 = density(p);
    float STEPS = 3.;
    float MAXL = 0.25;
    for(float lerpFactor = 0.; lerpFactor<MAXL; lerpFactor+=MAXL/STEPS)
    {
        vec2 q = mix(p, source.xy, lerpFactor);
        float d2 = density(q);
        //T *= exp(-d2 * 0.1 * dist2D*exp(-lerpFactor*10.)*10.);
        // Approximate version. Cheaper?
        T /= 1.0 + d2/STEPS*dist2D*exp(-lerpFactor*10.)*10.;
    }
    return d1*T/(dist*dist);
}


void mainImage( out vec4 o, in vec2 u )
{
    vec2 p = (u*2.-iResolution.xy)/iResolution.y;

    #if 1
    // Camera motion inspired from Shane's shaders
    // "Precalculated Voronoi Heightmap" by Shane
    // https://www.shadertoy.com/view/ldtGWj
    p *= 2.;
    p.xy *= R(cos(0.32*iTime)+sin(0.1*iTime));
    p.x -= iTime*2.;
    p.y -= cos(iTime);
    vec3 source = vec3(-iTime*2.+sin(iTime*0.62)*1.62,cos(iTime*2.0)*0.5,2.5 + cos(iTime*0.4));
    vec3 source2 = vec3(-iTime*2.+cos(iTime),sin(iTime*1.62)*0.62,2.5 + sin(iTime));
    #else
    p *= 2.;
    vec3 source = vec3(cos(iTime),sin(iTime*0.62),2.5);
    #endif
    
    //vec3 col = vec3(fbm(p * 2.));
    
    vec3 col = light(p, source) * vec3(8.,3.,1.);
    col += light(p, source2) * vec3(1.,6.,8.);
    
    #if 1
    col = 1.-exp(-col);
    #else
    // ACES tone mapping
    // https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
    // Used in https://www.shadertoy.com/view/ts3Bz7
    col = (col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
    #endif

    // Output to screen
    o = vec4(pow(col,vec3(0.45)),1.0);
    o.rgb += (texture(iChannel0, u / iChannelResolution[0].xy + iTime).r * 2. - 1.) * .01;
}
