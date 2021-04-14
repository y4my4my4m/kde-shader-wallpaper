// url: https://www.shadertoy.com/view/tlByRc
// from: PinetreeDev 
#define S smoothstep
#define T (iTime)

#define STRIPES_AMOUNT 435.2

float DistanceLine(vec2 p, vec2 a, vec2 b)
{
 	vec2 pa = p-a;
    vec2 ba = b-a;
    float t = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);

    return length(pa - ba*t);
}

float Line(vec2 p, vec2 a, vec2 b)
{
	float d = DistanceLine(p, a, b);
    float m = S(.01, .0, d - .001);

    // if the length of the line segment is bigger han 1.2 = invisible
    // .8 above fades in
    m *= S(1.2, .8, length(a - b));
    return m;
}

float Rnd(vec2 p)
{
    p = fract(p * vec2(284.4, 931.5));
    p += dot(p, p + 24.5);

    return fract(p.x * p.y);
}

vec2 RndPoint(vec2 p)
{
    // X coordinate
	float n = Rnd(p);
    // X & Y
    return vec2(n, Rnd(p + n));
}

vec2 GetPos(vec2 id, vec2 offset)
{
    // Get a noise x, y value
    vec2 n = RndPoint(id + offset) * T;

    return offset + sin(n) * .4;
}

float Dots(vec2 uv)
{
   	vec2 grid = fract(uv) - .5;
    vec2 id = floor(uv);

    float m = 0.0;
	vec2 p[9];

    int i = 0;
    for(float y= -1.0; y <= 1.0; y++)
    {
        for(float x = -1.0; x<= 1.0; x++)
        {
        	p[i++] = GetPos(id, vec2(x,y));
        }
    }

    // Think of it as a matrix
    // 0 1 2
    // 3 4 5
    // 6 7 8
    for(int i =0; i<9; i++)
    {
    	m += Line(grid, p[4], p[i]);

        vec2 j = (p[i] - grid) * 20.0;
        float sparkle = 1./dot(j, j);
        m += sparkle;
    }
    // Then we connect the 4 missing connections from this group
    m += Line(grid, p[1], p[3]);
    m += Line(grid, p[1], p[5]);
    m += Line(grid, p[5], p[7]);
    m += Line(grid, p[7], p[3]);

    return m;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    // Thanks jaszunio15 for the help in the crt effect
    vec2 uv = ((fragCoord - mod(fragCoord, vec2(3,4))) - .5*iResolution.xy)/iResolution.y;

	uv *= .5;
	float m = .0;
    vec2 grid = fract(uv) - .5;

    // 4 layers of dots
    for (float i = .0; i < 1.; i += 1./3.)
    {
        float z = fract(i + T * .01);
        float size = mix(10.0, 0.5, z);
        float fade = S(0., .2, z) * S(1., .6, z);
        m += Dots(uv * size + i * 50.) * fade;
    }
    vec3 col = vec3(m);
	//col.rg = id * .2;
    vec3 base = sin(T * vec3(.45, .123, .542)) * .4 + .6;
    col *= base;
    //if (grid.x > .48 || grid.y > .48) col = vec3(1.0, 0.0, 0.0);

    // Postprocess crt effect (is there a way to do this without the if statements?)
    //int reminder = int(fragCoord.x) % 3;
	//if (reminder == 0) col.gb *= 0.0;
	//else if (reminder == 1) col.rb *= 0.0;
	//else col.rg *= 0.0;

	//if (int(fragCoord.y) % 4 == 0) col *= 0.0;
    // same thing but without if statements
    col *= step(0.9, fract((fragCoord.x + vec3(0.499, 1.499, 2.499)) * 0.3333));

    // ----------------------------------------

    //col = pow(col, vec3(.4545));
    // Output to screen
    fragColor = vec4(col,1.0);
}
