// URL: shadertoy.com/view/lt2fDz
// By: balkhan

/*
* License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
* Created by bal-khan
*/

vec2	march(vec3 pos, vec3 dir);
vec3	camera(vec2 uv);
void	rotate(inout vec2 v, float angle);

float 	t;			// time
vec3	ret_col;	// torus color
vec3	h; 			// light amount

#define I_MAX		400.
#define E			0.00001
#define FAR			50.
#define PI			3.14

// blackbody by aiekick : https://www.shadertoy.com/view/lttXDn

// -------------blackbody----------------- //

// return color from temperature 
//http://www.physics.sfasu.edu/astro/color/blackbody.html
//http://www.vendian.org/mncharity/dir3/blackbody/
//http://www.vendian.org/mncharity/dir3/blackbody/UnstableURLs/bbr_color.html

vec3 blackbody(float Temp)
{
	vec3 col = vec3(255.);
    col.x = 56100000. * pow(Temp,(-3. / 2.)) + 148.;
   	col.y = 100.04 * log(Temp) - 623.6;
   	if (Temp > 6500.) col.y = 35200000. * pow(Temp,(-3. / 2.)) + 184.;
   	col.z = 194.18 * log(Temp) - 1448.6;
   	col = clamp(col, 0., 255.)/255.;
    if (Temp < 1000.) col *= Temp/1000.;
   	return col;
}

// -------------blackbody----------------- //

void mainImage(out vec4 c_out, in vec2 f)
{
    t  = iTime*.125;
    vec3	col = vec3(0., 0., 0.);
	vec2 R = iResolution.xy,
          uv  = vec2(f-R/2.) / R.y;
	vec3	dir = camera(uv);
    vec3	pos = vec3(.0, .0, 0.0);

    pos.z = 4.5+1.5*sin(t*10.);    
    h*=0.;
    vec2	inter = (march(pos, dir));
    col.xyz = ret_col*(1.-inter.x*.0125);
    col += h * .4;
    c_out =  vec4(col,1.0);
}

float	scene(vec3 p)
{  
    float	var;
    float	mind = 1e5;
    p.z += 10.;
    
    rotate(p.xz, 1.57-.5*iTime );
    rotate(p.yz, 1.57-.5*iTime );
    var = atan(p.x,p.y);
    vec2 q = vec2( ( length(p.xy) )-6.,p.z);
    rotate(q, var*.25+iTime*2.*0.);
    vec2 oq = q ;
    q = abs(q)-2.5;
    if (oq.x < q.x && oq.y > q.y)
    	rotate(q, ( (var*1.)+iTime*0.)*3.14+iTime*0.);
    else
        rotate(q, ( .28-(var*1.)+iTime*0.)*3.14+iTime*0.);
    ret_col = 1.-vec3(.350, .2, .3);
    mind = length(q)+.5+1.05*(length(fract(q*.5*(3.+3.*sin(var*1. - iTime*2.)) )-.5)-1.215);
    h -= vec3(-3.20,.20,1.0)*vec3(1.)*.0025/(.051+(mind-sin(var*1. - iTime*2. + 3.14)*.125 )*(mind-sin(var*1. - iTime*2. + 3.14)*.125 ) );
    h -= vec3(1.20,-.50,-.50)*vec3(1.)*.025/(.501+(mind-sin(var*1. - iTime*2.)*.5 )*(mind-sin(var*1. - iTime*2.)*.5 ) );
    h += vec3(.25, .4, .5)*.0025/(.021+mind*mind);
    
    return (mind);
}

vec2	march(vec3 pos, vec3 dir)
{
    vec2	dist = vec2(0.0, 0.0);
    vec3	p = vec3(0.0, 0.0, 0.0);
    vec2	s = vec2(0.0, 0.0);

	    for (float i = -1.; i < I_MAX; ++i)
	    {
	    	p = pos + dir * dist.y;
	        dist.x = scene(p);
	        dist.y += dist.x*.2; // makes artefacts disappear
            // log trick by aiekick
	        if (log(dist.y*dist.y/dist.x/1e5) > .0 || dist.x < E || dist.y > FAR)
            {
                break;
            }
	        s.x++;
    }
    s.y = dist.y;
    return (s);
}

// Utilities

void rotate(inout vec2 v, float angle)
{
	v = vec2(cos(angle)*v.x+sin(angle)*v.y,-sin(angle)*v.x+cos(angle)*v.y);
}

vec3	camera(vec2 uv)
{
    float		fov = 1.;
	vec3		forw  = vec3(0.0, 0.0, -1.0);
	vec3    	right = vec3(1.0, 0.0, 0.0);
	vec3    	up    = vec3(0.0, 1.0, 0.0);

    return (normalize((uv.x) * right + (uv.y) * up + fov * forw));
}

