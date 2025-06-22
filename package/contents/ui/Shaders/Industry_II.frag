// URL: shadertoy.com/view/Xd2GW3
// By: srtuss

// srtuss, 2014

vec2 rotate(vec2 p, float a)
{
	return vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
}

float rand11(float p)
{
    return fract(sin(p * 591.32) * 43758.5357);
}

#define aav 16.0 / iResolution.y

float sig(float x)
{
	return 1.0 / (1.0 + exp(-x));
}

float res(float x)
{
	float fl = floor(x);
	float fr = fract(x);
	float v = fl + 1.0 / (exp((fr - 0.5) * -100.0) + 1.0);
	float ph = fract(fr - 0.5);
	v += sin(ph * 20.0) * 0.5 * exp(ph * -8.0);
	return v;
}

vec2 rand22(vec2 p)
{
	vec2 ra = (456.789 * sin(789.123 * p.xy));
	vec2 rb = (456.789 * cos(789.123 * p.xy));
	return vec2(fract(ra.x * ra.y + p.x), fract(rb.x * rb.y + p.y));
}

#define ITS 13

vec2 circuit(vec2 p)
{
	p = mod(p, 2.0) - 1.0;
	float w = 1e38;
	vec2 cut = vec2(1.0, 0.0);
	vec2 e1 = vec2(-1.0);
	vec2 e2 = vec2(1.0);
	float rnd = 0.23;
	float pos, plane, cur;
	float fact = 0.9;
	float j = 0.0;
	for(int i = 0; i < ITS; i ++)
	{
		pos = mix(dot(e1, cut), dot(e2, cut), (rnd - 0.5) * fact + 0.5);
		plane = dot(p, cut) - pos;
		if(plane > 0.0)
		{
			e1 = mix(e1, vec2(pos), cut);
			rnd = fract(rnd * 19827.5719);
			cut = cut.yx;
		}
		else
		{
			e2 = mix(e2, vec2(pos), cut);
			rnd = fract(rnd * 5827.5719);
			cut = cut.yx;
		}
		j += step(rnd, 0.2);
		w = min(w, abs(plane));
	}
	return vec2(j / float(ITS - 1), w);
}


#define pi 3.1415926535897932384626433832795
#define pi2 6.283185307179586476925286766559

float s(float x)
{
	return sin(x * 2.0 * pi);
}

vec2 invk(vec2 p, float l1, float l2)
{
	float a1, a2;
	
	float g = atan(p.y, p.x);
	float l3 = length(p);
	
	a1 = acos((l1*l1 + l3*l3 - l2*l2) / (2.0 * l1*l3));
	a2 = acos((l1*l1 + l2*l2 - l3*l3) / (2.0 * l1*l2));
	
	return vec2(a1 + g, a2 + pi);
}

float tri(float x)
{
	return abs(fract(x) * 2.0 - 1.0);
}

float sig2(float x)
{
	return (1.0 / (1.0 + exp(-x))) * 2.0 - 1.0;
}


vec2 wlk(float t)
{
	vec2 o;
	o.x = sig2((tri(t) - 0.5) * 10.0) * 0.3;
	o.y = -0.8 + smoothstep(0.5, 1.0, tri(t - 0.3)) * 0.3;
	return o;
}

float walkw(float t)
{
	float fr = fract(t * 2.0);
	float fl = floor(t * 2.0);
	return (sig((tri(fr * 0.5) - 0.5) * 10.0) - fl * 1.0);
}

vec2 mech(vec2 p, float t)
{
	vec2 q = p;
	float mrk = 1e38;
	
	float v;
	
	
	vec2 j0, j1, j2;
	j0 = vec2(0.0, sin(t * 200.0) * 0.006 + pow(abs(s(t)), 8.0) * 0.1);
	j2 = wlk(t);
	vec2 ia = invk(j2 - j0, 0.5, 0.45);
	
	q -= j0;
	v = max(abs(q.x) - 0.35, abs(q.y) - 0.2);
	vec2 qq = q;
	q.x += 0.2;
	q.y += 0.1;
	q = rotate(q, ia.x);
	q.x += 0.3;
	v = min(v, max(abs(q.x) - 0.35, abs(q.y) - 0.12));
	q.x += 0.35;
	q = rotate(q, ia.y);
	q.x += 0.1;
	v = min(v, max(abs(q.x) - 0.36, abs(q.y) - 0.1));
	q.x += 0.35;
	q = rotate(q, pi * -0.5 - (ia.x + ia.y));
	q.x += 0.1;
	v = min(v, max(abs(q.x) - 0.03, abs(q.y) - 0.2));
	j2 = wlk(t + 0.5);
	ia = invk(j2 - j0, 0.5, 0.45);
	q = qq;
	q.x += 0.2;
	q.y += 0.1;
	q = rotate(q, ia.x);
	q.x += 0.3;
	v = min(v, max(abs(q.x) - 0.35, abs(q.y) - 0.12));
	q.x += 0.35;
	q = rotate(q, ia.y);
	q.x += 0.1;
	v = min(v, max(abs(q.x) - 0.36, abs(q.y) - 0.1));
	q.x += 0.35;
	q = rotate(q, pi * -0.5 - (ia.x + ia.y));
	q.x += 0.1;
	v = min(v, max(abs(q.x) - 0.03, abs(q.y) - 0.2));	
	return vec2(v, mrk);
}

float guy(vec2 p, float t)
{
	vec2 q, qq;
	p.y -= abs(sin((t + 0.6) * pi2)) * 0.15;
	q = rotate(p, sig(sin(t * pi2) * 2.0) * -0.9 + 0.25);
	q.y += 0.15;
	float v = max(abs(q.x) - 0.1, abs(q.y) - 0.3);
	q.y += 0.3;
	q = rotate(q, sig(sin((t + 0.21) * pi2) * 2.0) * 1.2);
	q.y += 0.3;
	v = min(v, max(abs(q.x) - 0.1, abs(q.y) - 0.35));
	q.y += 0.4;
	q = rotate(q, sig(sin((t + 0.3) * pi2) * 5.0 - 2.0) * 0.5);
	q.x -= 0.1;
	q.y += 0.03;
	v = min(v, max(abs(q.x) - 0.18, abs(q.y) - 0.05));
	q = rotate(p, sig(sin((t + 0.5) * pi2) * 2.0) * -0.9 + 0.25);
	q.y += 0.15;
	v = min(v, max(abs(q.x) - 0.1, abs(q.y) - 0.3));
	q.y += 0.3;
	q = rotate(q, sig(sin((t + 0.21 + 0.5) * pi2) * 2.0) * 1.2);
	//q = rotate(q, sig(sin((t + 0.2 + 0.5) * pi2) * 2.0) * 1.0);
	q.y += 0.3;
	v = min(v, max(abs(q.x) - 0.1, abs(q.y) - 0.35));
	q.y += 0.4;
	q = rotate(q, sig(sin((t + 0.3 + 0.5) * pi2) * 5.0 - 2.0) * 0.5);
	q.x -= 0.1;
	q.y += 0.03;
	v = min(v, max(abs(q.x) - 0.18, abs(q.y) - 0.05));
	//*/
	float ht = smoothstep(0.3, -0.3, sin(t)) * 0.1 + smoothstep(0.3, -0.3, sin(t * 3.0)) * -0.1;
	q = p - vec2(0.0, 0.2);
	q = rotate(q, 0.1 + sin(t * pi2 * 0.5) * 0.02 + ht * 0.7);
	q.y -= 0.3;
	v = min(v, max(abs(q.x) - 0.1, abs(q.y) - 0.4));
	qq = q;
	q -= vec2(0.0, 0.45);
	q = rotate(q, -0.2 - sin((t + 0.5) * pi2) * 0.01 + ht);
	q.y -= 0.25;
	v = min(v, max(abs(q.x) - 0.15, abs(q.y) - 0.25));
	q -= vec2(0.0, 0.15);
	v = min(v, max(abs(q.x) - 0.18, abs(q.y) - 0.1));
	q -= vec2(0.1, -0.09);
	float hp = t;
	v = min(v, max(abs(q.x) - 0.2 * (1.0 + 0.5 * sin(hp)), abs(q.y) - 0.01));
	float ap = sin(t * pi2) * -0.08;
	q = qq;
	q.x += ap;
	q.y -= 0.2;
	q = rotate(q, sig(sin((t + 0.5) * pi2) * 2.0) * 0.6 - 0.3);
	q.y += 0.2;
	v = min(v, max(abs(q.x) - 0.1, abs(q.y) - 0.3));
	q.y += 0.3;
	q = rotate(q, sig(sin((t + 0.2) * pi2) * 2.0) * -0.3);
	q.y += 0.2;
	v = min(v, max(abs(q.x) - 0.07, abs(q.y) - 0.3));
	q.y += 0.4;
	v = min(v, max(abs(q.x) - 0.3, abs(q.y) - 0.2));
	float at = 1.8 * smoothstep(0.6, 1.0, abs(fract(t * 0.1) * 2.0 - 1.0));
	q = qq;
	q.x -= ap;
	q.y -= 0.2;
	q = rotate(q, sig(sin((t) * pi2) * 2.0) * 0.6 - 0.3 - at * 0.7);
	q.y += 0.2;
	v = min(v, max(abs(q.x) - 0.1, abs(q.y) - 0.3));
	q.y += 0.3;
	q = rotate(q, sig(sin((t + 0.2 + 0.5) * pi2) * 2.0) * -0.3 - at * 0.5);
	q.y += 0.2;
	v = min(v, max(abs(q.x) - 0.07, abs(q.y) - 0.3));
	return v;
}

float pip1(float r, vec2 p, float l)
{
	float v = max(abs(p.x) - r, abs(p.y) - l);
	v = min(v, max(abs(p.x) - 0.07, abs(abs(p.y) - (l - 0.05)) - 0.02));
	return v;
}

float pip2(float r, vec2 p, float l)
{
	float v = max(abs(p.y) - r, abs(p.x) - l);
	v = min(v, max(abs(p.y) - 0.07, abs(abs(p.x) - (l - 0.05)) - 0.02));
	return v;
}

float pip3(float r, vec2 p, float rad, vec2 d)
{
	float v = max(max(abs(length(p) - rad) - r, p.x * d.x), p.y * d.y);
	return v;
}

float pipeset(vec2 uv)
{
	float v;
	v = pip2(0.06, uv, 0.3);
	v = min(v, pip3(0.05, uv - vec2(-0.3, 0.2), 0.2, vec2(1.0, 1.0)));
	v = min(v, pip1(0.05, uv - vec2(-0.5, 0.6), 0.4));
	v = min(v, pip3(0.05, uv - vec2(0.3, -0.2), 0.2, vec2(-1.0, -1.0)));
	v = min(v, pip1(0.05, uv - vec2(0.5, -0.6), 0.4));
	
	
	v = min(v, pip2(0.05, uv - vec2(0.45, 0.2), 0.5));
	v = min(v, pip3(0.05, uv - vec2(-0.05, 0.3), 0.1, vec2(1.0, 1.0)));
	v = min(v, pip1(0.05, uv - vec2(-0.15, 0.7), 0.4));
	v = min(v, pip3(0.05, uv - vec2(0.95, 0.0), 0.2, vec2(-1.0, -1.0)));
	v = min(v, pip1(0.05, uv - vec2(1.15, -0.5), 0.5));
	
	
	v = min(v, pip2(0.03, uv - vec2(0.2, -0.2), 0.5));
	v = min(v, pip3(0.03, uv - vec2(0.7, -0.3), 0.1, vec2(-1.0, -1.0)));
	v = min(v, pip1(0.03, uv - vec2(-0.4, -0.1), 1.1));
	v = min(v, pip3(0.03, uv - vec2(-0.3, -0.1), 0.1, vec2(1.0, 1.0)));
	v = min(v, pip1(0.03, uv - vec2(0.8, -0.8), 0.5));
	
	v = min(v, length(uv - vec2(-0.1, -0.1)) - 0.03);
	v = min(v, length(uv - vec2(0.2, 0.29)) - 0.03);
	return v;
}

vec2 voronoi(in vec2 x)
{
	vec2 n = floor(x); // grid cell id
	vec2 f = fract(x); // grid internal position
	vec2 mg; // shortest distance...
	float md = 8.0;
	
	float corner = 0.0;
	
	for(int j = -1; j <= 1; j ++)
	{
		for(int i = -1; i <= 1; i ++)
		{
			vec2 g = vec2(float(i), float(j)); // cell id
			vec2 o = rand22(n + g); // offset to edge point
			vec2 r = g + o - f;
			
			float d = max(abs(r.x), abs(r.y)); // distance to the edge
			
			if(d < md)
			{
				md = d;
				mg = g;
			}
		}
	}
	return n + mg;
}

#define SH45(p) dot(p, vec2(0.707, 0.707))
#define SH45X(p) dot(p, vec2(-0.707, 0.707))

float gear(vec2 q)
{
	float a = atan(q.y, q.x);
	float l = length(q);
	float w = l + smoothstep(-0.9, 0.9, sin(a * 20.0)) * 0.1 - 1.0;
	w = max(w, -l + 0.7);
	w = min(w, l - 0.3);
	w = min(w, max(l - 0.8, min(abs(q.x), abs(q.y)) - 0.1));
	return w;
}

vec2 layerA(vec2 uv, vec2 co, float t)
{	
	
	vec2 p, q;
	p = uv;
	
	float w;
	float v = guy(uv - vec2(co.x, 0.0), t * 0.6);
	v = min(v, guy(vec2(mod(-uv.x - t + 2.0, 30.0) - 15.0, uv.y), t * 0.6 + 0.2));
	
	w = circuit(uv / 4.0).y * 4.0;
	//v = min(v, w);
	
	
	q = uv;
    q.x = mod(q.x + 11.11, 11.11 * 2.) - 11.11;
    v = min(v, gear(rotate(q + vec2(1.9, 4.4), res(t) * .2 + .18)));	
    v = min(v, gear(rotate(q + vec2(0.005, 4.), res(t) * -.2)));
	
	
	
	q = uv * 2.0;
	q.x = mod(q.x, 30.0) - 15.0;
	
	vec2 qq = q;
	qq.y += 6.0;
	w = max(0.1 - min(SH45(qq), SH45X(qq)), abs(q.y + 3.0) - 0.7);
	v = min(v, w);
	
	q.y = mod(q.y, 2.0) - 1.0;
	w = min(abs(dot(q, vec2(0.707, 0.707))), abs(dot(q, vec2(-0.707, 0.707))));
	w = min(w, abs(abs(q.x) - 1.0) - 0.02);
	w = min(w, max(abs(q.x) - 0.1, abs(q.y) - 0.1));
	w = (w - 0.04) / 2.0;
	
	v = min(v, w);
	
	v = min(v, abs(uv.y + 1.25) - 0.1);
	
	
	
	
	
	v = smoothstep(0.0, aav, v);
	
	v = mix(0.0, v, step(abs(voronoi(uv * 0.4).y) - 2.0, 0.0));
	return vec2(0.0, v);
}


vec2 layerC(vec2 uv, vec2 co, float t)
{	
	
	vec2 p, q;
	p = uv;
	
	float w;
	float v = 1e38;
	
	
	
	
	q = uv * 2.0;
	q.x = mod(q.x, 30.0) - 15.0;
	
	vec2 qq = q;
	qq.y += 6.0;
	w = max(0.1 - min(SH45(qq), SH45X(qq)), abs(q.y + 3.0) - 0.7);
	v = min(v, w);
	
	q.y = mod(q.y, 2.0) - 1.0;
	w = min(abs(dot(q, vec2(0.707, 0.707))), abs(dot(q, vec2(-0.707, 0.707))));
	w = min(w, abs(abs(q.x) - 1.0) - 0.02);
	w = min(w, max(abs(q.x) - 0.1, abs(q.y) - 0.1));
	w = (w - 0.04) / 2.0;
	
	v = min(v, w);
	
	v = min(v, abs(uv.y + 1.25) - 0.1);
	
	
	
	v = smoothstep(0.0, aav, v);
	
	v = mix(0.0, v, step(abs(voronoi(uv * 0.4).y) - 2.0, 0.0));
	

	
	
	
	return vec2(0.0, (1.0 - v) * step(0.0, 7.0 + p.y));
}


vec2 layerD(vec2 p, float t)
{
	float v;
    p.x = mod(p.x + 17., 35.) - 17.;
	v = pipeset(p / 5.0) * 5.0;
	
	v = smoothstep(0.0, aav, v);
	return vec2(0.0, v);
}



vec2 layerB(vec2 p, float t)
{
	float v;
	float s = 8.0;
	
	vec2 q = p / s;
	
	float tt = t * 0.4 + 1.5;
	q.x += walkw(tt) * 0.6;
	q.x = mod(q.x, 8.0) - 4.0;
	v = mech(q, tt).x * s;
	v = smoothstep(0.0, aav, v);
	//v = mix(0.0, v, step(abs(voronoi(p * 0.4).y) - 2.0, 0.0));
	return vec2(0.0, v);
}

float plane(vec3 ro, vec3 rd, vec3 n, float d, out vec3 its)
{
	float t = -(dot(ro, n) + d) / dot(rd, n);
	its = ro + rd * t;
	return t;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	uv = uv * 2.0 - 1.0;
	uv.x *= iResolution.x / iResolution.y;
	
	//uv = floor(uv * 90.0) / 90.0;
	
	vec2 co = vec2(iTime * 1.0 * 1.3, 0.0);
	
	
	vec3 ro = vec3(co.x, 0.0, -10.0 + sin(iTime * 0.25) * 1.5);
	
	float s = iTime;
	ro += (vec3(rand11(s), rand11(s - 11.11), rand11(s + 11.11)) * 2.0 - 1.0) * exp(fract(iTime * 0.8) * -10.0) * 0.2;
	
	vec3 rd = normalize(vec3(uv, 1.66));
	rd.xz = rotate(rd.xz, sin(iTime * 0.2) * 0.04);
	rd.yz = rotate(rd.yz, sin(iTime * 0.3) * 0.04);
	
	vec3 r; float v;
	
	// floor plane
	float d = plane(ro, rd, normalize(vec3(0.0, 1.0, 0.0)), 7.0, r);
		
	vec3 col = vec3(1.0);vec3(0.5, 0.4, 0.3);
	
	//float vfloor = mix(1.0, circuit(r.xz * 0.02).x * 0.9 + 0.2, exp(d * -0.03));
	float vfloor = (1.0 - exp(circuit(r.xz * 0.04).y * -100.0)) * 0.3 + 0.0;
	//vfloor = 0.5;
	vfloor = mix(1.0, vfloor, exp(d * -0.03));
	
	col = mix(col, vec3(vfloor), step(0.0, d));
	
	// layer 4
	plane(ro, rd, normalize(vec3(0.0, 0.0, 1.0)), -20.0, r);
	v = layerC(r.xy, co, iTime).y;
	col = mix(col, vec3(0.8), v);
	
	// layer 3
	plane(ro, rd, normalize(vec3(0.0, 0.0, 1.0)), -10.0, r);
	v = layerC(r.xy, co, iTime).y;
	col = mix(col, vec3(0.4), v);
	
	
	// layer 2
	plane(ro, rd, normalize(vec3(0.0, 0.0, 1.0)), -8.0, r);
	v = layerB(r.xy, iTime).y;
	col = mix(col, vec3(0.2), 1.0 - v);
	
	// layer 1
	plane(ro, rd, normalize(vec3(0.0, 0.0, 1.0)), 0.0, r);
	v = layerA(r.xy, co, iTime).y;
	col = mix(col, vec3(0.0), 1.0 - v);
	
	
	// layer 0
	plane(ro, rd, normalize(vec3(0.0, 0.0, 1.0)), 1.5, r);
	v = layerD(r.xy, iTime).y;
	col = mix(col, vec3(0.0), 1.0 - v);
	
	
	
	col = pow(col, vec3(1.0 / 2.2));
	
	fragColor = vec4(col, 1.0);
}
