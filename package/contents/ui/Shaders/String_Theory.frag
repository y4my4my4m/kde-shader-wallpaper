// From https://www.shadertoy.com/view/XdSSz1
// Credits to nimitz
// String Theory by nimitz (twitter: @stormoid)
// https://www.shadertoy.com/view/XdSSz1
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// Contact the author for other licensing options

#define BASE_ANGLE 3.5
#define ANGLE_DELTA 0.02
#define XOFF .7

#define time iTime
mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}


float f(vec2 p, float featureSize)
{
	p.x = sin(p.x*1.+time*1.2)*sin(time+p.x*0.1)*3.;	
    p += sin(p.x*1.5)*.1;
    return smoothstep(-0.0,featureSize,abs(p.y));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float aspect = iResolution.x/iResolution.y;
    float featureSize = 60./((iResolution.x*aspect+iResolution.y));

    vec2 p = fragCoord.xy / iResolution.xy*6.5-3.25;
	p.x *= aspect;
	p.y = abs(p.y);
	
	vec3 col = vec3(0);
	for(float i=0.;i<26.;i++)
	{
		vec3 col2 = (sin(vec3(3.3,2.5,2.2)+i*0.15)*0.5+0.54)*(1.-f(p,featureSize));
		col = max(col,col2);
		
        p.x -= XOFF;
        p.y -= sin(time*0.11+1.5)*1.5+1.5;
		p*= mm2(i*ANGLE_DELTA+BASE_ANGLE);
		
        vec2 pa = vec2(abs(p.x-.9),abs(p.y));
        vec2 pb = vec2(p.x,abs(p.y));
        
        p = mix(pa,pb,smoothstep(-.07,.07,sin(time*0.24)+.1));
	}
	fragColor = vec4(col,1.0);
}
