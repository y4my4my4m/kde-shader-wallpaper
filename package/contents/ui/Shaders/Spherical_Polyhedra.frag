// url: https://www.shadertoy.com/view/4dBXWD
// credits: nimitz

// Spherical polyhedra by nimitz (twitter: @stormoid)
// https://www.shadertoy.com/view/4dBXWD
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// Contact the author for other licensing options

/*
	Follow up to my "Sphere mappings" shader (https://www.shadertoy.com/view/4sjXW1)
	
	I was thinking about a cheap way to do icosahedral mapping and realized
	I could just project on an axis and rotate the sphere for each projected
	"facet".
	
	Here I am showing only tilings of the regular polyhedra but this technique can
	be used for any tilings of the sphere, regular or not. (or even arbitrary projections)

	I omitted the tetraedron since the small number of projections
	results in heavy deformation.

	Perhaps there is a way to make that process cheaper? Let me know.
*/

#define time iTime

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}
vec3 rotx(vec3 p, float a){ float s = sin(a), c = cos(a);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }
vec3 roty(vec3 p, float a){ float s = sin(a), c = cos(a);
    return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
vec3 rotz(vec3 p, float a){ float s = sin(a), c = cos(a);
    return vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z); }

//---------------------------Textures--------------------------------
//-------------------------------------------------------------------
vec3 texpent(in vec2 p, in float idx)
{   
    float siz = iResolution.x *.007;
    vec2 q = abs(p);
    float rz = sin(clamp(max(max(q.x*1.176-p.y*0.385, q.x*0.727+p.y),
                             -p.y*1.237)*33.,0.,25.))*siz+siz;
    vec3 col = (sin(vec3(1,1.5,5)*idx)+2.)*(rz+0.25);
    col -= sin(dot(p,p)*10.+time*5.)*0.4;
	return col;
}

vec3 textri2(in vec2 p, in float idx)
{   
    float siz = iResolution.x *.007;
    vec2 q = abs(p);
    float rz = sin(clamp(max(q.x*1.73205+p.y, -p.y*2.)*32.,0.,25.))*siz+siz;
    vec3 col = (sin(vec3(1,1.7,5)*idx)+2.)*(rz+0.25);
    col -= sin(p.x*20.+time*5.)*0.2;
    return col;
}

vec3 texcub(in vec2 p, in float idx)
{   
    float siz = iResolution.x *.007;
    float rz = sin(clamp(max(abs(p.x),abs(p.y))*24.,0.,25.))*siz+siz;
    vec3 col = (sin(vec3(4,3.,5)*idx*.9)+2.)*(rz+0.25);
    float a= atan(p.y,p.x);
    col -= sin(a*15.+time*11.)*0.15-0.15;
    return col;
}

vec3 textri(in vec2 p, in float idx)
{	
    float siz = iResolution.x *.001;
    p*=1.31;
    vec2 bp = p;
    p.x *= 1.732;
	vec2 f = fract(p)-0.5;
    float d = abs(f.x-f.y);
    d = min(abs(f.x+f.y),d);
    
    float f1 = fract((p.y-0.25)*2.);
    d = min(d,abs(f1-0.5));
    d = 1.-smoothstep(0.,.1/(siz+.7),d);
    
    vec2 q = abs(bp);
    p = bp;
    d -= smoothstep(1.,1.3,(max(q.x*1.73205+p.y, -p.y*2.)));
    vec3 col = (sin(vec3(1.,1.5,5)*idx)+2.)*((1.-d)+0.25);
    col -= sin(p.x*10.+time*8.)*0.15-0.1;
    return col;
}

//----------------------------------------------------------------------------
//----------------------------------Sphere Tilings----------------------------
//----------------------------------------------------------------------------

//All the rotation matrices can be precomputed for better performance.

//5 mirrored pentagons for the dodecahedron
vec3 dod(in vec3 p)
{
    vec3 col = vec3(1);
    vec2 uv = vec2(0);
    for (float i = 0.;i<=4.;i++)
    {
        p = roty(p,0.81);
        p = rotx(p,0.759);
        p = rotz(p,0.3915);
    	uv = vec2(p.z,p.y)/((p.x));
    	col = min(texpent(uv,i+1.),col);
    }
    p = roty(p,0.577);
    p = rotx(p,-0.266);
    p = rotz(p,-0.848);
    uv = vec2(p.z,-p.y)/((p.x));
   	col = min(texpent(uv,6.),col);
    
    return 1.-col;
}

//10 mirrored triangles for the icosahedron
vec3 ico(in vec3 p)
{
    vec3 col = vec3(1);
    vec2 uv = vec2(0);
    
    //center band
    const float n1 = .7297;
    const float n2 = 1.0472;
    for (float i = 0.;i<5.;i++)
    {
        if(mod(i,2.)==0.)
        {
            p = rotz(p,n1);
        	p = rotx(p,n2);
        }
		else
        {
            p = rotz(p,n1);
        	p = rotx(p,-n2);
        }
        uv = vec2(p.z,p.y)/((p.x));
    	col = min(textri(uv,i+1.),col);
    }
    p = roty(p,1.048);
    p = rotz(p,.8416);
    p = rotx(p,.7772);
    //top caps
    for (float i = 0.;i<5.;i++)
    {
        p = rotz(p,n1);
        p = rotx(p,n2);

    	uv = vec2(p.z,p.y)/((p.x));
    	col = min(textri(uv,i+6.),col);
    }
    
    return 1.-col;
}

//4 mirrored triangles for octahedron
vec3 octa(in vec3 p)
{
    vec3 col = vec3(1);
    vec2 uv = vec2(0);
    const float n1 = 1.231;
    const float n2 = 1.047;
    for (float i = 0.;i<4.;i++)
    {
       	p = rotz(p,n1);
       	p = rotx(p,n2);
    	uv = vec2(p.z,p.y)/((p.x));
    	col = min(textri2(uv*.54,i+1.),col);
    }
    
    return 1.-col;
}

//cube using the same technique for completeness
vec3 cub(in vec3 p)
{
    vec3 col = vec3(1);
    vec2 uv = vec2(p.z,p.y)/((p.x));
   	col = min(texcub(uv*1.01,15.),col);
    p = rotz(p,1.5708);
    uv = vec2(p.z,p.y)/((p.x));
   	col = min(texcub(uv*1.01,4.),col);
    p = roty(p,1.5708);
    uv = vec2(p.z,p.y)/((p.x));
    col = min(texcub(uv*1.01,5.),col);
    
    return 1.-col;
}

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

vec2 iSphere2(in vec3 ro, in vec3 rd)
{
    vec3 oc = ro;
    float b = dot(oc, rd);
    float c = dot(oc,oc) - 1.;
    float h = b*b - c;
    if(h <0.0) return vec2(-1.);
    else return vec2((-b - sqrt(h)), (-b + sqrt(h)));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
    vec2 bp = p+0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 um = iMouse.xy / iResolution.xy-.5;
	um.x *= iResolution.x/iResolution.y;
	
    //camera
	vec3 ro = vec3(0.,0.,3.5);
    vec3 rd = normalize(vec3(p,-1.4));
    mat2 mx = mm2(time*0.25+um.x*6.);
    mat2 my = mm2(time*0.27+um.y*6.); 
    ro.xz *= mx;rd.xz *= mx;
    ro.xy *= my;rd.xy *= my;
    
    float sel = mod(floor((time+10.)*0.2),4.);
    //sel=0.;
    vec2 t = iSphere2(ro,rd);
    vec3 col = vec3(0.);
    float bg = clamp(dot(-rd,vec3(0.577))*0.3+.6,0.,1.);
    if (sel == 0.) col = dod(rd)*1.2;
    else if (sel == 1.) col = ico(rd)*1.2;
    else if (sel == 2.) col = cub(rd)*1.2;
    else if (sel == 3.) col = octa(rd)*1.2;
    
    if (t.x > 0.)
    {
    	vec3 pos = ro+rd*t.x;
        vec3 pos2 = ro+rd*t.y;
        vec3 rf = reflect(rd,pos);
        if (sel == 0.)
        {
            vec3 col2 = max(dod(pos)*2.,dod(pos2)*.6);
            col = mix(max(col,col2),col2,0.6);
        }
        else if (sel == 1.)
        {
            vec3 col2  = max(ico(pos2)*0.6,ico(pos)*2.);
            col = mix(max(col,col2),col2,0.6);
        }
        else if (sel == 2.)
        {
            vec3 col2  = max(cub(pos2)*0.6,cub(pos)*2.);
            col = mix(max(col,col2),col2,0.6);
        }
        else if (sel == 3.) 
        {
            vec3 col2  = max(octa(pos2)*0.6,octa(pos)*2.);
            col = mix(max(col,col2),col2,0.6);
        }
    }
    
	fragColor = vec4(col, 1.0);
}
