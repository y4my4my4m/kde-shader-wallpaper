// URL: https://www.shadertoy.com/view/wdBGWD
// By lsdlive

/*

@lsdlive
CC-BY-NC-SA

This is my part for "Mist" by Ohno, a 4 kilobytes demo released at the Cookie 2018.

pouet: http://www.pouet.net/prod.php?which=79350
youtube: https://www.youtube.com/watch?v=UUtU3WVB144

Code/Graphics: Flopine
Code/Graphics: Lsdlive
Music: Triace from Desire

Part1 from Flopine here: https://www.shadertoy.com/view/tdBGWD

Information about my process for making this demo here:
https://twitter.com/lsdlive/status/1090627411379716096

*/

float time = 0.;

float random(vec2 uv) {
	return fract(sin(dot(uv, vec2(12.2544, 35.1571))) * 5418.548416);
}

mat2 r2d(float a) {
	float c = cos(a), s = sin(a);
	// Explained here why you still get an anti-clockwise rotation with this matrix:
	// https://www.shadertoy.com/view/wdB3DW
	return mat2(c, s, -s, c);
}

vec3 re(vec3 p, float d) {
	return mod(p - d * .5, d) - d * .5;
}

void amod2(inout vec2 p, float d) {
	// should be atan(p.y, p.x) but I had this function for a while
	// and putting parameters like this add a PI/6 rotation.
	float a = re(vec3(atan(p.x, p.y)), d).x; 
	p = vec2(cos(a), sin(a)) * length(p);
}

void mo(inout vec2 p, vec2 d) {
	p = abs(p) - d;
	if (p.y > p.x)p = p.yx;
}

vec3 get_cam(vec3 ro, vec3 ta, vec2 uv) {
	vec3 fwd = normalize(ta - ro);
	vec3 right = normalize(cross(fwd, vec3(0, 1, 0)));

	//vec3 right = normalize(vec3(-fwd.z, 0, fwd.x));
	return normalize(fwd + right * uv.x + cross(right, fwd) * uv.y);
}

// signed cube
// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float cube(vec3 p, vec3 b) {
	b = abs(p) - b;
	return min(max(b.x, max(b.y, b.z)), 0.) + length(max(b, 0.));
}

// iq's signed cross sc() - http://iquilezles.org/www/articles/menger/menger.htm
float sc(vec3 p, float d) {
	p = abs(p);
	p = max(p, p.yzx);
	return min(p.x, min(p.y, p.z)) - d;
}


////////////////////////// SHADER LSDLIVE //////////////////////////

float prim(vec3 p) {

	p.xy *= r2d(3.14 * .5 + p.z * .1); // .1

	amod2(p.xy, 6.28 / 3.); // 3.
	p.x = abs(p.x) - 9.; // 9.

	p.xy *= r2d(p.z * .2); // .2

	amod2(p.xy, 6.28 /
		mix(
			mix(10., 5., smoothstep(59.5, 61.5, time)), // T4
			3.,
			smoothstep(77.5, 77.75, time)) // T8
	); // 3.
	mo(p.xy, vec2(2.)); // 2.

	p.x = abs(p.x) - .6; // .6
	return length(p.xy) - .2;//- smoothstep(80., 87., time)*(.5+.5*sin(time)); // .2
}

float g = 0.; // glow
float de(vec3 p) {

	if (time > 109.2) {
		mo(p.xy, vec2(.2));
		p.x -= 10.;
	}

	if (time > 101.4) {
		p.xy *= r2d(time*.2);
	}

	if (time > 106.5) {
		mo(p.xy, vec2(5. + sin(time)*3.*cos(time*.5), 0.));
	}

	if (time > 104.) {
		amod2(p.xy, 6.28 / 3.);
		p.x += 5.;
	}

	if (time > 101.4) {
		mo(p.xy, vec2(2. + sin(time)*3.*cos(time*.5), 0.));
	}

	p.xy *= r2d(time * .05); // .05

	p.xy *= r2d(p.z *
		mix(.05, .002, step(89.5, time)) // P2 - T11
	); // .05 & .002

	p.x += sin(time) * smoothstep(77., 82., time);

	amod2(p.xy, 6.28 /
		mix(
			mix(1., 2., smoothstep(63.5, 68.5, time)), // T6
			5.,
			smoothstep(72., 73.5, time)) // T7
	); // 5.
	p.x -= 21.; // 21.

	vec3 q = p;

	p.xy *= r2d(p.z * .1); // .1

	amod2(p.xy, 6.28 / 3.); // 3.
	p.x = abs(p.x) -
		mix(20., 5., smoothstep(49.5, 55., time)) // T2
		; // 5.

	p.xy *= r2d(p.z *
		mix(1., .2, smoothstep(77.5, 77.75, time)) // T8b
	); // .2

	p.z = re(p.zzz, 3.).x; // 3.

	p.x = abs(p.x);
	amod2(p.xy, 6.28 /
		mix(6., 3., smoothstep(77.75, 78.5, time)) // T10
	); // 3.
	float sc1 = sc(p,
		mix(8., 1., smoothstep(45.5, 51., time)) // T1
	); // 1.

	amod2(p.xz, 6.28 /
		mix(3., 8., smoothstep(61.5, 65.5, time)) // T5
	); // 8.
	mo(p.xz, vec2(.1)); // .1

	p.x = abs(p.x) - 1.;// 1.

	float d = cube(p, vec3(.2, 10, 1)); // fractal primitive: cube substracted by a signed cross
	d = max(d, -sc1) -
		mix(.01, 2., smoothstep(56., 58.5, time)) // T3
		; // 2.


	g += .006 / (.01 + d * d); // first layer of glow

	d = min(d, prim(q)); // add twisted cylinders

	g += .004 / (.013 + d * d); // second layer of glow (after the union of two geometries)

	return d;
}


////////////////////////// RAYMARCHING FUNCTIONS //////////////////////////


vec3 raymarch_lsdlive(vec3 ro, vec3 rd, vec2 uv) {
	vec3 p;
	float t = 0., ri;

	float dither = random(uv);

	for (float i = 0.; i < 1.; i += .02) {// 50 iterations to keep it "fast"
		ri = i;
		p = ro + rd * t;
		float d = de(p);
		d *= 1. + dither * .05; // avoid banding & add a nice "artistic" little noise to the rendering (leon gave us this trick)
		d = max(abs(d), .002); // phantom mode trick from aiekick https://www.shadertoy.com/view/MtScWW
		t += d * .5;
	}

	// Shading: uv, iteration & glow:
	vec3 c = mix(vec3(.9, .8, .6), vec3(.1, .1, .2), length(uv) + ri);
	c.r += sin(p.z * .1) * .2;
	c += g * .035; // glow trick from balkhan https://www.shadertoy.com/view/4t2yW1

	return c;
}

// borrowed from (mmerchante) : https://www.shadertoy.com/view/MltcWs
void glitch(inout vec2 uv, float start_time_stamp, float end_time_stamp)
{
	int offset = int(floor(time)*2.) + int((uv.x + uv.y) * 8.0);
	float res = mix(10., 100.0, random(vec2(offset)));

	// glitch pixellate
	if (time > start_time_stamp && time <= end_time_stamp) uv = floor(uv * res) / res;

	int seedX = int(gl_FragCoord.x + time) / 32;
	int seedY = int(gl_FragCoord.y + time) / 32;
	int seed = mod(time, 2.) > 1. ? seedX : seedY;


	// glitch splitter
	uv.x += (random(vec2(seed)) * 2.0 - 1.0)
		* step(random(vec2(seed)), pow(sin(time * 4.), 7.0))
		* random(vec2(seed))
		* step(start_time_stamp, time)
		* (1. - step(end_time_stamp, time));
}

////////////////////////// MAIN FUNCTION //////////////////////////

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	vec2 q = fragCoord.xy / iResolution.xy;
    vec2 uv = (q - .5) * iResolution.xx / iResolution.yx;

	/* just code for the shadertoy port */
	time = mod(iTime, 43. + 10.4);
	time = time + 45.;
	if (time > 88. && time <= 98.6) // 98.
		time += 10.6;


	// added glitch
	glitch(uv, 0., 2.);

	glitch(uv, 98., 99.);
	// lsdlive 2nd part
	glitch(uv, 100.5, 101.5);
	glitch(uv, 103., 104.);
	glitch(uv, 105.5, 106.5);

	vec3 lsd_ro = vec3(0, 0, -4. + time * 8.);
	vec3 lsd_target = vec3(0., 0., time * 8.);
	vec3 lsd_cam = get_cam(lsd_ro, lsd_target, uv);

	vec3 col = vec3(0.);

	if (time > 45. && time <= 88.) // 43 seconds
		col = raymarch_lsdlive(lsd_ro, lsd_cam, uv);

	if (time > 98.6 && time <= 109.) // 10.4 seconds
		col = raymarch_lsdlive(lsd_ro, lsd_cam, uv);


	// vignetting (iq)
	col *= 0.5 + 0.5*pow(16.0*q.x*q.y*(1.0 - q.x)*(1.0 - q.y), 0.25);

	// fading out - end of the demo
	//col *= 1. - smoothstep(120., 125., time);

	fragColor = vec4(col, 1.);
}
