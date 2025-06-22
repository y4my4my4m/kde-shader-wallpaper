// https://www.shadertoy.com/view/4s33Rn
// Credits to movAX13h

// Invaders,Invaders, fragment shader by movAX13h, Nov.2015

vec3 color = vec3(0.2, 0.42, 0.68); // blue 1
//vec3 color = vec3(0.1, 0.3, 0.6); // blue 2
//vec3 color = vec3(0.6, 0.1, 0.3); // red
//vec3 color = vec3(0.1, 0.6, 0.3); // green

float rand(float x) { return fract(sin(x) * 4358.5453123); }
float rand(vec2 co) { return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5357); }

float invader(vec2 p, float n)
{
	p.x = abs(p.x);
	p.y = floor(p.y - 5.0);
    return step(p.x, 2.0) * step(1.0, floor(mod(n/(exp2(floor(p.x - 3.0*p.y))),2.0)));
}

float ring(vec2 uv, float rnd)
{
    float t = 0.6*(iTime+0.2*rnd);
    float i = floor(t/2.0);
    vec2 pos = 2.0*vec2(rand(i*0.123), rand(i*2.371))-1.0;
	return smoothstep(0.2, 0.0, abs(length(uv-pos)-mod(t,2.0)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    if (iMouse.z > 0.5) color = vec3(0.5, 0.3, 0.1);

    vec2 p = fragCoord.xy;
	vec2 uv = p / iResolution.xy - 0.5;
    p.y += 120.0*iTime;
    float r = rand(floor(p/8.0));
    vec2 ip = mod(p,8.0)-4.0;

    float a = -0.3*smoothstep(0.1, 0.8, length(uv)) +
        invader(ip, 809999.0*r) * (0.06 + 0.3*ring(uv,r) + max(0.0, 0.2*sin(10.0*r*iTime)));

	fragColor = vec4(color+a, 1.0);
}
