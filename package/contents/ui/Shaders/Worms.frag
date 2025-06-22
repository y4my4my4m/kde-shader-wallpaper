// https://www.shadertoy.com/view/XsjXR1
// Credits to inigo quilez - iq/2014

// Created by inigo quilez - iq/2014
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

// You can buy a metal print of this shader here:
// https://www.redbubble.com/i/metal-print/Worms-with-code-by-InigoQuilez/39863456.0JXQP

#define AA 1

float hash( vec2 p ) { return fract(sin(1.0+dot(p,vec2(127.1,311.7)))*43758.545); }
vec2  sincos( float x ) { return vec2( sin(x), cos(x) ); }
vec3  opU( vec3 d1, vec3 d2 ){ return (d1.x<d2.x) ? d1 : d2;}

vec2 sdCylinder( in vec3 p )
{
    return vec2( length(p.xz), (p.y+50.0)/100.0 );
}

vec3 map( vec3 p )
{
    float time = iTime*1.0;

    vec2  id = floor( (p.xz+1.0)/2.0 );
    float ph = hash(id+113.1);
    float ve = hash(id);

    p.xz = mod( p.xz+1.0, 2.0 ) - 1.0;
    p.xz += 0.5*cos( 2.0*ve*time + (p.y+ph)*vec2(0.53,0.32) - vec2(1.57,0.0) );

    vec3 p1 = p; p1.xz += 0.15*sincos(p.y-ve*time*ve+0.0);
    vec3 p2 = p; p2.xz += 0.15*sincos(p.y-ve*time*ve+2.0);
    vec3 p3 = p; p3.xz += 0.15*sincos(p.y-ve*time*ve+4.0);

    vec2 h1 = sdCylinder( p1 );
    vec2 h2 = sdCylinder( p2 );
    vec2 h3 = sdCylinder( p3 );

    return opU( opU( vec3(h1.x-0.15*(0.8+0.2*sin(200.0*h1.y)), ve + 0.000, h1.y),
                     vec3(h2.x-0.15*(0.8+0.2*sin(200.0*h2.y)), ve + 0.015, h2.y) ),
                     vec3(h3.x-0.15*(0.8+0.2*sin(200.0*h3.y)), ve + 0.030, h3.y) );

}

vec3 intersect( in vec3 ro, in vec3 rd, in float px, const float maxdist )
{
    vec3 res = vec3(-1.0);
    float t = 0.0;
    for( int i=0; i<256; i++ )
    {
        vec3 h = map(ro + t*rd);
        res = vec3( t, h.yz );
        if( abs(h.x)<(px*t) || t>maxdist ) break;
        t += min( h.x, 0.5 )*0.85;
    }
    return res;
}

vec3 calcNormal( in vec3 pos )
{
    const vec2 e = vec2(1.0,-1.0)*0.003;
    return normalize( e.xyy*map( pos + e.xyy ).x +
                      e.yyx*map( pos + e.yyx ).x +
                      e.yxy*map( pos + e.yxy ).x +
                      e.xxx*map( pos + e.xxx ).x );
}

float calcOcc( in vec3 pos, in vec3 nor )
{
    const float h = 0.1;
    float ao = 0.0;
    for( int i=0; i<8; i++ )
    {
        vec3 dir = sin( float(i)*vec3(1.0,7.13,13.71)+vec3(0.0,2.0,4.0) );
        dir = dir + 2.0*nor*max(0.0,-dot(nor,dir));
        float d = map( pos + h*dir ).x;
        ao += h-d;
    }
    return clamp( 1.0 - 0.7*ao, 0.0, 1.0 );
}

vec3 render( in vec3 ro, in vec3 rd, in float px )
{
    vec3 col = vec3(0.0);

    const float maxdist = 32.0;
    vec3 res = intersect( ro, rd, px, maxdist );
    if( res.x < maxdist )
    {
        vec3  pos = ro + res.x*rd;
        vec3  nor = calcNormal( pos );
        float occ = calcOcc( pos, nor );

        col = 0.5 + 0.5*cos( res.y*30.0 + vec3(0.0,4.4,4.0) );
        col *= 0.5 + 1.5*nor.y;
        col += clamp(1.0+dot(rd,nor),0.0,1.0);
        float u = 800.0*res.z - sin(res.y)*iTime;
        col *= 0.95 + 0.05*cos( u + 3.1416*cos(1.5*u + 3.1416*cos(3.0*u)) + vec3(0.0,1.0,2.0) );
        col *= vec3(1.5,1.0,0.7);
        col *= occ;

        float fl = mod( (0.5+cos(2.0+res.y*47.0))*iTime + res.y*7.0, 4.0 )/4.0;
        col *= 2.5 - 1.5*smoothstep(0.02,0.04,abs(res.z-fl));

        col *= exp( -0.1*res.x );
        col *= 1.0 - smoothstep( 20.0, 30.0, res.x );
    }

    return pow( col, vec3(0.5,1.0,1.0) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    #define ZERO (min(iFrame,0))

    vec3 tot = vec3(0.0);
#if AA>1
    for( int m=ZERO; m<AA; m++ )
    for( int n=ZERO; n<AA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
#else
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
#endif

        vec3  ro = vec3(0.6,2.4,1.2);
        vec3  ta = vec3(0.0,0.0,0.0);
        float fl = 3.0;
        vec3  ww = normalize( ta - ro);
        vec3  uu = normalize( cross( vec3(0.0,1.0,0.0), ww ) );
        vec3  vv = normalize( cross(ww,uu) );
        vec3  rd = normalize( p.x*uu + p.y*vv + fl*ww );

        vec3 col = render( ro, rd, 1.0/(iResolution.y*fl) );

        tot += col;
#if AA>1
    }
    tot /= float(AA*AA);
#endif

    vec2 q = fragCoord.xy/iResolution.xy;
    tot *= pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1 );

    fragColor = vec4( tot, 1.0 );
}

void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir )
{
    vec3 ro = fragRayOri + vec3( 1.0, 0.0, 1.0 );
    vec3 rd = fragRayDir;
    vec3 col = render( ro, rd, 0.001 );

    fragColor = vec4( col, 1.0 );
}
