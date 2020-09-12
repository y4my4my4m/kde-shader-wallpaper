// https://www.shadertoy.com/view/4dfSDj
// Credits to XBE <xbe>

/////////////////////////////////////////////////////////////////////////////
// XBE
// Retro style terrain rendering
//

const float PI = 3.141592654;

// Noise from IQ
vec2 hash( vec2 p )
{
	p = vec2( dot(p,vec2(127.1,311.7)),
			  dot(p,vec2(269.5,183.3)) );
	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

float noise( in vec2 p )
{
	const float K1 = 0.366025404;
	const float K2 = 0.211324865;

	vec2 i = floor( p + (p.x+p.y)*K1 );

	vec2 a = p - i + (i.x+i.y)*K2;
	vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
	vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0*K2;

	vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );

	vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));

	return dot( n, vec3(70.0) );
}

const mat2 m = mat2( 0.80,  0.60, -0.60,  0.80 );

float fbm4( in vec2 p )
{
    float f = 0.0;
    f += 0.5000*noise( p ); p = m*p*2.02;
    f += 0.2500*noise( p ); p = m*p*2.03;
    f += 0.1250*noise( p ); p = m*p*2.01;
    f += 0.0625*noise( p );
    return f;
}

float fbm6( in vec2 p )
{
    float f = 0.0;
    f += 0.5000*noise( p ); p = m*p*2.02;
    f += 0.2500*noise( p ); p = m*p*2.03;
    f += 0.1250*noise( p ); p = m*p*2.01;
    f += 0.0625*noise( p ); p = m*p*2.04;
    f += 0.031250*noise( p ); p = m*p*2.01;
    f += 0.015625*noise( p );
    return f;
}

mat4 CreatePerspectiveMatrix(in float fov, in float aspect, in float near, in float far)
{
    mat4 m = mat4(0.0);
    float angle = (fov / 180.0) * PI;
    float f = 1. / tan( angle * 0.5 );
    m[0][0] = f / aspect;
    m[1][1] = f;
    m[2][2] = (far + near) / (near - far);
    m[2][3] = -1.;
    m[3][2] = (2. * far*near) / (near - far);
    return m;
}

mat4 CamControl( vec3 eye, float pitch)
{
    float cosPitch = cos(pitch);
    float sinPitch = sin(pitch);
    vec3 xaxis = vec3( 1, 0, 0. );
    vec3 yaxis = vec3( 0., cosPitch, sinPitch );
    vec3 zaxis = vec3( 0., -sinPitch, cosPitch );
    // Create a 4x4 view matrix from the right, up, forward and eye position vectors
    mat4 viewMatrix = mat4(
        vec4(       xaxis.x,            yaxis.x,            zaxis.x,      0 ),
        vec4(       xaxis.y,            yaxis.y,            zaxis.y,      0 ),
        vec4(       xaxis.z,            yaxis.z,            zaxis.z,      0 ),
        vec4( -dot( xaxis, eye ), -dot( yaxis, eye ), -dot( zaxis, eye ), 1 )
    );
    return viewMatrix;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy/iResolution.xy;
    vec2 p = 2.*uv-1.;
	p.x *= iResolution.x/iResolution.y;

	vec3 eye = vec3(0., 0.25+0.25*cos(0.5*iTime), -1.);
    mat4 projmat = CreatePerspectiveMatrix(50., iResolution.x/iResolution.y, 0.1, 10.);
    mat4 viewmat = CamControl(eye, -5.*PI/180.);
    mat4 vpmat = viewmat*projmat;

	vec3 col = vec3(0.);
	vec3 acc = vec3(0.);
	float d;

    vec4 pos = vec4(0.);
	float lh = -iResolution.y;
	float off = 0.1*iTime;
	float h = 0.;
	float z = 0.1;
	float zi = 0.05;
	for (int i=0; i<24; ++i)
	{
        pos = vec4(p.x, 0.5*fbm4(0.5*vec2(eye.x+p.x, z+off)), eye.z+z, 1.);
        h = (vpmat*pos).y - p.y;
		if (h>lh)
		{
			d = abs(h);
			col = vec3( d<0.005?smoothstep(1.,0.,d*192.):0. );
			col *= exp(-0.1*float(i));
            acc += col;
			lh = h;
		}
		z += zi;
	}
	col = sqrt(clamp(acc, 0., 1.));
    // Background
	vec3 bkg = vec3(0.32,0.36,0.4) + p.y*0.1;
	col += bkg;
	// Vignetting
	vec2 r = -1.0 + 2.0*(uv);
	float vb = max(abs(r.x), abs(r.y));
	col *= (0.15 + 0.85*(1.0-exp(-(1.0-vb)*30.0)));
	fragColor = vec4(col,1.0);
}
