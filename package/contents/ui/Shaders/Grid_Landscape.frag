// https://www.shadertoy.com/view/3dlSz2
// Credits to postrediori

//Raymarch settings

#define MIN_DIST 0.001
#define MAX_DIST 32.0
#define MAX_STEPS 96
#define STEP_MULT 0.9
#define NORMAL_OFFS 0.01
#define FOCAL_LENGTH 0.8

//Scene settings

//Colors
#define GRID_COLOR_1 vec3(0.00, 0.05, 0.20)
#define GRID_COLOR_2 vec3(1.00, 0.20, 0.60)

//Parameters
#define GRID_SIZE 0.20
#define GRID_LINE_SIZE 1.25

//Object IDs
#define SKYDOME 0.
#define FLOOR 1.

float pi = atan(1.0) * 4.0;
float tau = atan(1.0) * 8.0;

struct MarchResult
{
    vec3 position;
    vec3 normal;
    float dist;
    float steps;
    float id;
};

//Returns a rotation matrix for the given angles around the X,Y,Z axes.
mat3 Rotate(vec3 angles)
{
    vec3 c = cos(angles);
    vec3 s = sin(angles);

    mat3 rotX = mat3( 1.0, 0.0, 0.0, 0.0,c.x,s.x, 0.0,-s.x, c.x);
    mat3 rotY = mat3( c.y, 0.0,-s.y, 0.0,1.0,0.0, s.y, 0.0, c.y);
    mat3 rotZ = mat3( c.z, s.z, 0.0,-s.z,c.z,0.0, 0.0, 0.0, 1.0);

    return rotX * rotY * rotZ;
}

//==== Distance field operators/functions by iq. ====
vec2 opU(vec2 d1, vec2 d2)
{
    return (d1.x < d2.x) ? d1 : d2;
}

vec2 opS(vec2 d1, vec2 d2)
{
    return (-d1.x > d2.x) ? d1*vec2(-1,1) : d2;
}

vec2 sdSphere(vec3 p, float s, float id)
{
    return vec2(length(p) - s, id);
}

vec2 sdPlane(vec3 p, vec4 n, float id)
{
  // n must be normalized
    return vec2(dot(p,n.xyz) + n.w, id);
}

vec2 heightmapNormal(vec2 p)
{
    return vec2(sin(p.x+iTime*0.25)*0.15, sin(p.y-iTime*0.125)*0.15);
}

//Distance to the scene
vec2 Scene(vec3 p)
{
    vec2 d = vec2(MAX_DIST, SKYDOME);

    d = opU(sdPlane(p, normalize(vec4(heightmapNormal(p.xy),-1, 0)), FLOOR), d);

	return d;
}

//Surface normal at the current position
vec3 Normal(vec3 p)
{
    vec3 off = vec3(NORMAL_OFFS, 0, 0);
    return normalize
    (
        vec3
        (
            Scene(p + off.xyz).x - Scene(p - off.xyz).x,
            Scene(p + off.zxy).x - Scene(p - off.zxy).x,
            Scene(p + off.yzx).x - Scene(p - off.yzx).x
        )
    );
}

//Raymarch the scene with the given ray
MarchResult MarchRay(vec3 orig,vec3 dir)
{
    float steps = 0.0;
    float dist = 0.0;
    float id = 0.0;

    for(int i = 0;i < MAX_STEPS;i++)
    {
        vec2 object = Scene(orig + dir * dist);

        //Add the sky dome and have it follow the camera.
        object = opU(object, -sdSphere(dir * dist, MAX_DIST, SKYDOME));

        dist += object.x * STEP_MULT;

        id = object.y;

        steps++;

        if(abs(object.x) < MIN_DIST * dist)
        {
            break;
        }
    }

    MarchResult result;

    result.position = orig + dir * dist;
    result.normal = Normal(result.position);
    result.dist = dist;
    result.steps = steps;
    result.id = id;

    return result;
}

//Scene texturing/shading
vec3 Shade(MarchResult hit, vec3 direction, vec3 camera)
{
    vec3 color = vec3(0.0);

    if(hit.id == FLOOR)
    {
        vec2 uv = abs(mod(hit.position.xy + GRID_SIZE/2.0, GRID_SIZE) - GRID_SIZE/2.0);

        uv /= fwidth(hit.position.xy);

        float riverEdge = 1.0; //dfRiver(hit.position, 0.0).x / fwidth(hit.position.xy).x;

        float gln = min(min(uv.x, uv.y), riverEdge) / GRID_SIZE;

        color = mix(GRID_COLOR_1, GRID_COLOR_2, 1.0 - smoothstep(0.0, GRID_LINE_SIZE / GRID_SIZE, gln));
    }

    //Distance fog
    color *= 1.0 - smoothstep(0.0, MAX_DIST*0.9, hit.dist);

    return color;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 res = iResolution.xy / iResolution.y;
	vec2 uv = fragCoord.xy / iResolution.y;

    //Camera stuff
    vec3 angles = vec3(0);

    //Auto mode
    if(iMouse.xy == vec2(0,0))
    {
        angles.y = tau * (1.4 / 8.0);
        angles.x = tau * (3.9 / 8.0) + sin(iTime * 0.1) * 0.3;
    }
    else
    {
    	angles = vec3((iMouse.xy / iResolution.xy) * pi, 0);
        angles.xy *= vec2(2.0, 1.0);
    }

    angles.y = clamp(angles.y, 0.0, 15.5 * tau / 64.0);

    mat3 rotate = Rotate(angles.yzx);

    vec3 orig = vec3(0, 0,-2) * rotate;

    vec3 dir = normalize(vec3(uv - res / 2.0, FOCAL_LENGTH)) * rotate;

    //Ray marching
    MarchResult hit = MarchRay(orig, dir);

    //Shading
    vec3 color = Shade(hit, dir, orig);

	fragColor = vec4(color, 1.0);
}
