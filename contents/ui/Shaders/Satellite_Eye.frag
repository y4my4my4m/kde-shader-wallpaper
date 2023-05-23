// url:
// credits:

// Satellite's eye by nimitz (twitter: @stormoid)
// https://www.shadertoy.com/view/4tX3Ws
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// Contact the author for other licensing options

/*
Very few shaders on shadertoy use iq's great anylitic noise derivative technique 
(https://iquilezles.org/articles/morenoise)

The main goal was to get terrain that looks good enough at the "continental" scale
*/

#define time iTime

#define CLOUDS

vec2 mo = vec2(0);
mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
mat2 m2 = mat2( 0.80,  0.60, -0.60,  0.80 );
float noise( in vec2 x ){return textureLod(iChannel0, x*.01,0.0).x;}

//for clouds
float fbm( in vec2 p )
{	
	float z=2.;
	float rz = 0.;
	vec2 bp = p;
	for (float i= 1.;i<5.;i++ )
	{
        rz+= (sin(noise(p)*5.)*.5+0.5)/z;
		z = z*2.3;
        p*= m2;
		p = p*2.3;
	}
	return rz;
}


//https://iquilezles.org/articles/morenoise
vec3 noised( in vec2 x )
{
    vec2 p = floor(x);
    vec2 f = fract(x);
    vec2 u = f*f*(3.0-2.0*f);
    //vec2 u = f*f*f*(f*(f*6. - 15.) + 10.); //Quintic smoothsing
	float a = textureLod(iChannel0,(p+vec2(0.5,0.5))/256.0,0.0).x;
	float b = textureLod(iChannel0,(p+vec2(1.5,0.5))/256.0,0.0).x;
	float c = textureLod(iChannel0,(p+vec2(0.5,1.5))/256.0,0.0).x;
	float d = textureLod(iChannel0,(p+vec2(1.5,1.5))/256.0,0.0).x;
	return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y,
				6.0*f*(1.0-f)*(vec2(b-a,c-a)+(a-b-c+d)*u.yx));
}

float terrain(in vec2 p)
{
    float a = 0.0;
    float z = 1.;
    vec2 bp = p;
	vec2  d = vec2(0.0);
    for( int i=0; i<7; i++ )
    {
        vec3 n = noised(p);
        d += n.yz*mo.x;
        a += z * n.x/(dot(d,d)+1.);
        
		z *= .49;
        p = m2*p*2.17;
    }
    
    a += mo.y*0.5-0.15;
    
    a *= exp(a*1.5-2.5);
    a = smoothstep(-0.5,.3,a)*.15 + (smoothstep(.3,.5,a)*.5) + smoothstep(.65,3.,a)*5. - smoothstep(.9,-.35,a)*.25;
    return a;
}


vec3 normal(in vec2 p, in float h, in float w)
{
    vec2 e = vec2(w,0.);
    return normalize( vec3( terrain(p+e.xy) - terrain(p-e.xy), h, terrain( p+e.yx)-terrain(p-e.yx) ) );
}

vec3 tex(in vec2 p)
{
    vec3 col = vec3(1);
    
    float rz = terrain(p);
    vec2 dd = vec2(.707);
    
    //coastal smoothing
    float coast = smoothstep(0.,.2, rz)-smoothstep(0.2,.65, rz);
    
    float dif = clamp(dot( normal(p, 0.019+coast*0.05, 0.008-coast*0.004),(vec3(dd.x,0.1,dd.y)) )*0.5+0.5,0.0,1.);
    float dif2 = clamp(dot( normal(p, .9, .25),(vec3(dd.x,.7,dd.y)) )*0.5+0.5,0.0,1.);
    
    float fbm1 = fbm(p*0.75);
    float nz = texture(iChannel0,p*iResolution.xy*0.0015).r*0.4+0.5;
    
    float wtr = smoothstep(-1.,.1, rz)-smoothstep(-.05,.2, rz);
    col -= wtr*vec3(1.,0.85,.7)*1.1 + smoothstep(0.3,.7,fbm1)*0.1*wtr;
    
    
    float grass = smoothstep(0.2,.6, rz)-smoothstep(0.6,.7, rz);
    col -= (smoothstep(-1.,0.,rz)*(nz*0.5+0.5))*grass;
    col += col*grass*vec3(0.25,0.5,0.05)*1.5;
    
    col -= coast*(nz*.4)*vec3(.7,.75,1.1);
    
    float mount = smoothstep(0.52,.7, rz);
    col -= col*mount*vec3(.5,.75,1.)*(fbm(p*3.)-0.1)*0.45;
    
    col *= dif*dif2;
    
    #ifdef CLOUDS
    p.y -= time*0.016;
    const float scl = .55;
    float clo2 = fbm(p*scl);
    vec2 e = vec2(0.07+fbm(p*2.)*0.6,0.);
    vec3 cldn = normalize( vec3( fbm((p+e.xy)*scl) - clo2, .3, fbm( (p+e.yx)*scl) - clo2 ) );
    float cldif = max(dot(cldn,(vec3(dd.x,0.4,dd.y))),0.);
    clo2 = smoothstep(.0,1.,cldif * ((cldif-clo2)*1.+0.));
    col = mix(col, vec3(1.), clo2);
    #endif
    
    col = clamp(col,0.,1.);
    col = pow(col,vec3(.75));
    
    return col;
}

float sphere(in vec3 ro, in vec3 rd)
{
    vec3 oc = ro;
    float b = dot(oc, rd);
    float c = dot(oc,oc) - 1.;
    float h = b*b - c;
    
    if(h <0.0) return -1.;
    else return -b + sqrt(h);
}

vec3 rotx(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord.xy / iResolution.xy-0.5;
	p.x *= iResolution.x/iResolution.y*1.3;
	mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(0.0,-0.05):mo;
    mo.x = mo.x*0.75+0.5;
    mo.y += mo.x*0.5;
    
    vec3 ro = vec3(0,0.,.66);
    vec3 rd = normalize(vec3(p,-7.));
    rd = rotx(rd,0.58);
    float t = sphere(ro,rd);
    
    vec3 col = vec3(0);
    if (t > 0.)
    {
        vec3 pos = ro + rd*t;
        pos.xy /= pos.z;
        pos.y -= time*0.025;
        col = tex(pos.xy*5.);
        
    }
	
	fragColor = vec4(col,1.0);
}
