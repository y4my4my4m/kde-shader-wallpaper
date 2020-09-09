// https://www.shadertoy.com/view/llj3Rz
// Credits to inigo quilez - iq/2015

// Created by inigo quilez - iq/2015
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// property Image iChannel0: Image { source: "./Shadertoy_Organic_2.jpg" }
// property Image iChannel1: Image { source: "./Shadertoy_Stars.jpg" }
// property Image iChannel2: Image { source: "./Shadertoy_Gray_Noise_Medium.png" }

vec3 fancyCube( sampler2D sam, in vec3 d, in float s, in float b )
{
    vec3 colx = texture( sam, 0.5 + s*d.yz/d.x, b ).xyz;
    vec3 coly = texture( sam, 0.5 + s*d.zx/d.y, b ).xyz;
    vec3 colz = texture( sam, 0.5 + s*d.xy/d.z, b ).xyz;

    vec3 n = d*d;

    return (colx*n.x + coly*n.y + colz*n.z)/(n.x+n.y+n.z);
}


vec2 hash( vec2 p ) { p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }

vec2 voronoi( in vec2 x )
{
    vec2 n = floor( x );
    vec2 f = fract( x );

	vec3 m = vec3( 8.0 );
    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec2  g = vec2( float(i), float(j) );
        vec2  o = hash( n + g );
        vec2  r = g - f + o;
		float d = dot( r, r );
        if( d<m.x )
            m = vec3( d, o );
    }

    return vec2( sqrt(m.x), m.y+m.z );
}

float shpIntersect( in vec3 ro, in vec3 rd, in vec4 sph )
{
    vec3 oc = ro - sph.xyz;
    float b = dot( rd, oc );
    float c = dot( oc, oc ) - sph.w*sph.w;
    float h = b*b - c;
    if( h>0.0 ) h = -b - sqrt( h );
    return h;
}

float sphDistance( in vec3 ro, in vec3 rd, in vec4 sph )
{
	vec3 oc = ro - sph.xyz;
    float b = dot( oc, rd );
    float h = dot( oc, oc ) - b*b;
    return sqrt( max(0.0,h)) - sph.w;
}

float sphSoftShadow( in vec3 ro, in vec3 rd, in vec4 sph, in float k )
{
    vec3 oc = sph.xyz - ro;
    float b = dot( oc, rd );
    float c = dot( oc, oc ) - sph.w*sph.w;
    float h = b*b - c;
    return (b<0.0) ? 1.0 : 1.0 - smoothstep( 0.0, 1.0, k*h/b );
}


vec3 sphNormal( in vec3 pos, in vec4 sph )
{
    return (pos - sph.xyz)/sph.w;
}

//=======================================================

vec3 background( in vec3 d, in vec3 l )
{
    vec3 col = vec3(0.0);
         col += 0.5*pow( fancyCube( iChannel1, d, 0.05, 5.0 ).zyx, vec3(2.0) );
         col += 0.2*pow( fancyCube( iChannel1, d, 0.10, 3.0 ).zyx, vec3(1.5) );
         col += 0.8*vec3(0.80,0.5,0.6)*pow( fancyCube( iChannel1, d, 0.1, 0.0 ).xxx, vec3(6.0) );
    float stars = smoothstep( 0.3, 0.7, fancyCube( iChannel1, d, 0.91, 0.0 ).x );


    vec3 n = abs(d);
    n = n*n*n;

    vec2 vxy = voronoi( 50.0*d.xy );
    vec2 vyz = voronoi( 50.0*d.yz );
    vec2 vzx = voronoi( 50.0*d.zx );
    vec2 r = (vyz*n.x + vzx*n.y + vxy*n.z) / (n.x+n.y+n.z);
    col += 0.9 * stars * clamp(1.0-(3.0+r.y*5.0)*r.x,0.0,1.0);

    col = 1.5*col - 0.2;
    col += vec3(-0.05,0.1,0.0);

    float s = clamp( dot(d,l), 0.0, 1.0 );
    col += 0.4*pow(s,5.0)*vec3(1.0,0.7,0.6)*2.0;
    col += 0.4*pow(s,64.0)*vec3(1.0,0.9,0.8)*2.0;

    return col;

}

//--------------------------------------------------------------------

vec4 sph1 = vec4( 0.0, 0.0, 0.0, 1.0 );

float rayTrace( in vec3 ro, in vec3 rd )
{
    return shpIntersect( ro, rd, sph1 );
}

float map( in vec3 pos )
{
    vec2 r = pos.xz - sph1.xz;
    float h = 1.0-2.0/(1.0 + 0.3*dot(r,r));
    return pos.y - h;
}

float rayMarch( in vec3 ro, in vec3 rd, float tmax )
{
    float t = 0.0;

    // bounding plane
    float h = (1.0-ro.y)/rd.y;
    if( h>0.0 ) t=h;

    // raymarch
    for( int i=0; i<20; i++ )
    {
        vec3 pos = ro + t*rd;
        float h = map( pos );
        if( h<0.001 || t>tmax ) break;
        t += h;
    }
    return t;
}

vec3 render( in vec3 ro, in vec3 rd )
{
    vec3 lig = normalize( vec3(1.0,0.2,1.0) );
    vec3 col = background( rd, lig );

    // raytrace stuff
    float t = rayTrace( ro, rd );

    if( t>0.0 )
    {
        vec3 mat = vec3( 0.18 );
        vec3 pos = ro + t*rd;
        vec3 nor = sphNormal( pos, sph1 );

        float am = 0.1*iTime;
        vec2 pr = vec2( cos(am), sin(am) );
        vec3 tnor = nor;
        tnor.xz = mat2( pr.x, -pr.y, pr.y, pr.x ) * tnor.xz;

        float am2 = 0.08*iTime - 1.0*(1.0-nor.y*nor.y);
        pr = vec2( cos(am2), sin(am2) );
        vec3 tnor2 = nor;
        tnor2.xz = mat2( pr.x, -pr.y, pr.y, pr.x ) * tnor2.xz;

        vec3 ref = reflect( rd, nor );
        float fre = clamp( 1.0+dot( nor, rd ), 0.0 ,1.0 );

        float l = fancyCube( iChannel0, tnor, 0.03, 0.0 ).x;
        l += -0.1 + 0.3*fancyCube( iChannel0, tnor, 8.0, 0.0 ).x;

        vec3 sea  = mix( vec3(0.0,0.07,0.2), vec3(0.0,0.01,0.3), fre );
        sea *= 0.15;

        vec3 land = vec3(0.02,0.04,0.0);
        land = mix( land, vec3(0.05,0.1,0.0), smoothstep(0.4,1.0,fancyCube( iChannel0, tnor, 0.1, 0.0 ).x ));
        land *= fancyCube( iChannel0, tnor, 0.3, 0.0 ).xyz;
        land *= 0.5;

        float los = smoothstep(0.45,0.46, l);
        mat = mix( sea, land, los );

        vec3 wrap = -1.0 + 2.0*fancyCube( iChannel1, tnor2.xzy, 0.025, 0.0 ).xyz;
        float cc1 = fancyCube( iChannel1, tnor2 + 0.2*wrap, 0.05, 0.0 ).y;
        float clouds = smoothstep( 0.3, 0.6, cc1 );

        mat = mix( mat, vec3(0.93*0.15), clouds );

        float dif = clamp( dot(nor, lig), 0.0, 1.0 );
        mat *= 0.8;
        vec3 lin  = vec3(3.0,2.5,2.0)*dif;
        lin += 0.01;
        col = mat * lin;
        col = pow( col, vec3(0.4545) );
        col += 0.6*fre*fre*vec3(0.9,0.9,1.0)*(0.3+0.7*dif);

        float spe = clamp( dot(ref,lig), 0.0, 1.0 );
        float tspe = pow( spe, 3.0 ) + 0.5*pow( spe, 16.0 );
        col += (1.0-0.5*los)*clamp(1.0-2.0*clouds,0.0,1.0)*0.3*vec3(0.5,0.4,0.3)*tspe*dif;;
    }

    // raymarch stuff
    float tmax = 20.0;
    if( t>0.0 ) tmax = t;
    t = rayMarch( ro, rd, tmax );
    if( t<tmax )
    {
            vec3 pos = ro + t*rd;

            vec2 scp = sin(2.0*6.2831*pos.xz);

            vec3 wir = vec3( 0.0 );
            wir += 1.0*exp(-12.0*abs(scp.x));
            wir += 1.0*exp(-12.0*abs(scp.y));
            wir += 0.5*exp( -4.0*abs(scp.x));
            wir += 0.5*exp( -4.0*abs(scp.y));
            wir *= 0.2 + 1.0*sphSoftShadow( pos, lig, sph1, 4.0 );

            col += wir*0.5*exp( -0.05*t*t );;
    }

    if( dot(rd,sph1.xyz-ro)>0.0 )
    {
    float d = sphDistance( ro, rd, sph1 );
    vec3 glo = vec3(0.0);
    glo += vec3(0.6,0.7,1.0)*0.3*exp(-2.0*abs(d))*step(0.0,d);
    glo += 0.6*vec3(0.6,0.7,1.0)*0.3*exp(-8.0*abs(d));
    glo += 0.6*vec3(0.8,0.9,1.0)*0.4*exp(-100.0*abs(d));
    col += glo*2.0;
    }

    col *= smoothstep( 0.0, 6.0, iTime );

    return col;
}


mat3 setCamera( in vec3 ro, in vec3 rt, in float cr )
{
	vec3 cw = normalize(rt-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, -cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (-iResolution.xy +2.0*fragCoord.xy) / iResolution.y;

    float zo = 1.0 + smoothstep( 5.0, 15.0, abs(iTime-48.0) );
    float an = 3.0 + 0.05*iTime + 6.0*iMouse.x/iResolution.x;
    vec3 ro = zo*vec3( 2.0*cos(an), 1.0, 2.0*sin(an) );
    vec3 rt = vec3( 1.0, 0.0, 0.0 );
    mat3 cam = setCamera( ro, rt, 0.35 );
    vec3 rd = normalize( cam * vec3( p, -2.0) );

    vec3 col = render( ro, rd );

    vec2 q = fragCoord.xy / iResolution.xy;
    col *= 0.2 + 0.8*pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1 );

	fragColor = vec4( col, 1.0 );
}

void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir )
{
    float zo = 1.0 + smoothstep( 5.0, 15.0, abs(iTime-48.0) );
    float an = 3.0 + 0.05*iTime;
    vec3 ro = zo*vec3( 2.0*cos(an), 1.0, 2.0*sin(an) );

    vec3 rt = vec3( 1.0, 0.0, 0.0 );
    mat3 cam = setCamera( ro, rt, 0.35 );

    fragColor = vec4( render( ro + cam*fragRayOri,
                                   cam*fragRayDir ), 1.0 );

}
