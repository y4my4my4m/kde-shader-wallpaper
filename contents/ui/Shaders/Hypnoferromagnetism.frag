// https://www.shadertoy.com/view/wdSXzK
// Credits to dracusa

/*
A raymarching shader. I thought it would be interesting to tile iq's ellipsoid
approximation, since it can be smoothly turned into an infinite cylinder,
allowing the tiles to connect and disconnect with each other along different
axes over time. I then applied the log-spherical map, so this reveals how the 3
axes are transformed by this map:

- Lines along the rho coordinate converge towards the origin
- Lines along the theta coordinate become like circles of longitude
- Lines along the phi coordinate become like circles of latitude

The ellipsoids also appear nicely twised because rotation is applied in a
gradient (but this can't be pushed very far because it also twists the distance
field).

This is part of a series of explorations on the log-spherical mapping:
https://www.osar.fr/notes/logspherical/
*/

// definitely try changing this value:
#define DENSITY 12.0

#define AA 1
#define M_PI 3.14

float worldtime;
float centerhue;

// ssN: smooth staircase of iteration N, step height = 2 pi
float ss1(float x) { return x - sin(x); }
float ss2(float x) { return ss1(ss1(x)); }

// alternating smooth staircases
float as(float x) { return smoothstep(0.1,0.4,fract(x))+floor(x); }
float asa(float x) { return as(x*(0.25/M_PI)); }
float asb(float x) { return as(x*(0.25/M_PI)+M_PI*0.5); }
// shelves, returns 1 when the staircases are in the middle of steps
float shelves(float x) { return 1.-pow(abs(sin(x*0.5)), 4.)*0.4; }

// map (0-1) to (0-big) with inverse curve
float zeroInf(float x) {
	return -0.99/(x-1.)-0.98;
}

// Axis rotation taken from tdhooper. R(p.xz, a) rotates x towards z.
void pR(inout vec2 p, float a) {
	p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

// iq's ellipsod https://www.shadertoy.com/view/tdS3DG
float sdEllipsoid(in vec3 p, in vec3 r)
{
	float k0 = length(p/r);
	float k1 = length(p/(r*r));
	return k0*(k0-1.0)/k1;
}

float sdf(in vec3 p)
{
	const float lpscale = DENSITY/M_PI;

	// Apply the forward log-spherical map
	float r = length(p);
	p = vec3(log(r), acos(p.z / length(p)), atan(p.y, p.x));

	// Get a scaling factor to compensate for pinching at the poles
	// (there's probably a better way of doing this)
	float xshrink = 1.0/(abs(p.y-M_PI)) + 1.0/(abs(p.y)) - 1.0/M_PI;

	// Scale to fit in the ]-pi,pi] interval
	p *= lpscale;

	// prepare values for rotation and stretching of tile contents
	float rotclock = worldtime*5.-p.x;
	float stretch = shelves(worldtime*5.-p.x*0.5)*0.5+0.5;
	float thik = 0.005/(r+0.03);

	// Apply rho-translation, which yields zooming
	p.x -= worldtime;

	// Turn tiled coordinates into single-tile coordinates
	p = fract(p*0.5) * 2.0 - 1.0;
	p.x *= xshrink;

	// rotate and stretch the primitive
	pR(p.xz, asa(rotclock)*M_PI*0.5);
	pR(p.yz, asb(rotclock)*M_PI*0.5);
	float ret = sdEllipsoid(p, vec3(thik, thik, thik*zeroInf(stretch)));

	// Compensate for all the scaling that's been applied so far
	// (and shorten the steps a bit)
	float mul = 0.9*r/lpscale/xshrink;
	return ret * mul;
}

// Minkowski pillow
vec3 pillow(in vec3 col, in vec2 uv)
{
	uv -= 0.5;
	float mpow = 5.;
	float d = pow(pow(abs(uv.x),mpow)+pow(abs(uv.y),mpow),1./mpow);
	d = smoothstep(0., 1., d*2.-0.64);
	return mix(col, vec3(0.), d);
}

// From http://www.iquilezles.org/www/articles/functions/functions.htm
float gain(float x, float k)
{
	float a = 0.5*pow(2.0*((x<0.5)?x:1.0-x), k);
	return (x<0.5)?a:1.0-a;
}

vec3 gain(vec3 v, float k)
{
	return vec3(
		gain(v.x, k),
		gain(v.y, k),
		gain(v.z, k)
	);
}

// Smooth HSV by iq and Fabrice Neyret: https://www.shadertoy.com/view/MsS3Wc
vec3 hsv2rgb_smooth(in vec3 c)
{
	return c.z * (1.-c.y*smoothstep(2.,1., abs(mod(c.x*6.+vec3(0,4,2), 6.) -3.)));
}

// Shading is flat. The color is an interpolation in HSV space between a
// time-varying hue at the center and a backgroundish color at the outer limits
vec3 shade(in vec3 pos)
{
	float cf = clamp(length(pos*1.6), 0., 1.);
	vec3 hsv1 = vec3(centerhue, 0., 1.);
	vec3 hsv2 = vec3(0.6, 1., 0.2);
    vec3 ret = mix(hsv1, hsv2, cf);
    // and a bit of extra brightness at the center
    ret.y = ret.y*0.2/(ret.y*ret.y+0.025);
	return hsv2rgb_smooth(ret);
}

// Based on http://iquilezles.org/www/articles/raymarchingdf/raymarchingdf.htm
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

	// alternate between moving the camera+color and moving the world
	worldtime = ss1(iTime+6.)*0.5;
	float camtime = ss2(iTime+M_PI+6.);
	centerhue = abs(fract(camtime*0.03)-0.5)*2.2+0.1;

	 // camera movement
	float an = 0.3*camtime;
	float cy = 0.6+sin(an*2.+1.6)*0.5;
	vec3 ro = vec3((1.3-cy*0.5)*sin(an), cy, (1.3-cy*0.5)*cos(an));
	vec3 ta = vec3( 0.0, 0.0, 0.0 );
	// camera matrix
	vec3 ww = normalize(ta - ro);
	vec3 uu = normalize(cross(ww,vec3(0.0,1.0,0.0)));
	vec3 vv = normalize(cross(uu,ww));

	vec3 bg = vec3(0.15, 0.15, 0.18);
	vec3 tot = bg;

	#if AA>1
	for(int m=0; m<AA; m++)
	for(int n=0; n<AA; n++)
	{
		// pixel coordinates
		vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
		vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
		#else
		vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
		#endif

		// create view ray
		vec3 rd = normalize(p.x*uu + p.y*vv + 3.5*ww); // fov

		// raymarch
		const float tmax = 2.7;
		float t = 0.5;
		vec3 pos;
		int i2;
		for( int i=0; i<80; i++ )
		{
			pos = ro + t*rd;
			float h = sdf(pos);
			if( h<0.0001 || t>tmax ) break;
			t += h;
			i2 = i;
		}

		// shading/lighting
		vec3 col = vec3(0.0);
		if( t<tmax )
			col = shade(pos);
		// fog
		col = mix(col, bg, smoothstep(0.8, 2.5, t));
		// glow
		float g = float(i2) * (0.1/80.);
		col += vec3(g);

		tot += col;
	#if AA>1
	}
	tot /= float(AA*AA);
	#endif

	tot = gain(clamp(tot, 0., 1.), 1.5);
	tot = pillow(tot, uv);
	fragColor = vec4(tot, 1.0);
}
