// url: https://www.shadertoy.com/view/NtSBWt
// credits: jvb


const float PI = 3.14159265359;

float angle_trunc(float a)
{
    for( int i = 0; i < 32; i++)
    {
        if( a >= 0.0 )
            break;
        else
        	a += PI * 2.0;
    }
    return a;
}

float seg(vec2 uv, float w)
{
    vec4 lineSeg = vec4(-w,0.0, w, 0.0);
    float alpha = atan(lineSeg.g-uv.y,lineSeg.r-uv.x);
    float beta =  atan(lineSeg.a-uv.y,lineSeg.b-uv.x);
    
    float bright = angle_trunc(alpha - beta);
    if(bright > PI) bright = angle_trunc(beta - alpha);
   
    return pow(bright/PI, 1.8);
}



vec3 digit(vec2 p, int n)
{
	vec3 col = vec3(0);
	float w = 0.25;
	float mx = 0.0;
	float my = 0.0;
	vec3 segcol = vec3(1.0);
	// middle seg
	if (n==2 ||n==3||n==4||n==5||n==6||n==8||n==9) col += segcol*seg(p, w);
	// upper seg
	if (n==0||n==2 ||n==3||n==5||n==6||n==7||n==8||n==9) col += segcol*seg(p-vec2(0,0.5), w);
	// lower seg
	if (n==0||n==2 ||n==3||n==5||n==6||n==8||n==9) col += segcol*seg(p-vec2(0,-0.5), w);

	// left seg up
	if (n==0||n==4||n==5||n==6||n==8||n==9) col += segcol*seg(p.yx-vec2(0.25,-0.25), w*1.0);
	// left seg down
	if (n==0||n==2||n==6||n==8) col += segcol*seg(p.yx-vec2(-0.25,-0.25), w*1.0);
	

	// right seg up
	if (n==0||n==1||n==2||n==3||n==4||n==7||n==8||n==9) col += segcol*seg(p.yx-vec2(0.25,0.25), w*1.0);
	// right seg down
	if (n==0||n==1||n==3||n==4||n==5||n==6||n==7||n==8||n==9) col += segcol*seg(p.yx-vec2(-0.25,0.25), w*1.0);

	return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = 2.0*( fragCoord.xy / iResolution.xy )-1.0;
	
	p.x *= iResolution.x/iResolution.y; 
	vec3 col = vec3(0);
	
	
	

	
	
	vec3 segcol = vec3(0.5,0.8,1.0);
	int n = int(mod(iTime*10.0, 1000.0)); 

	col += segcol*digit(p-vec2(-0.75,0.0), n/100);
	col += segcol*digit(p-vec2(+0.0,0.0),  int(mod(float(n/10), 10.0)));
	col += segcol*digit(p-vec2(+0.75,0.0), int(mod(float(n), 10.0)));
	col *= 0.3;
	col += vec3(0.3);
	col *= clamp(vec3(1)-vec3(1)*length(0.125*p.xy), 0.0, 1.0);
	fragColor = vec4(col, 1.0);
}


