// https://www.shadertoy.com/view/4s23Wc
// Credits to pfhunk

// http://www.fractalforums.com/new-theories-and-research/very-simple-formula-for-fractal-patterns/

const int iterations=20;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 z=fragCoord.xy / iResolution.xy-.5;
	z.y*=iResolution.y/iResolution.x;

	z.x += sin(z.y*2.0+iTime * .2)/10.0;
	z*=.6+pow(sin(iTime*.05),10.)*10.;
	z+=vec2(sin(iTime*.08),cos(iTime*.01));
	z=abs(vec2(z.x*cos(iTime*.12)-z.y*sin(iTime*.12)
			  ,z.y*cos(iTime*.12)+z.x*sin(iTime*.12)));

	vec2 c=vec2(.2, 0.188);

	float expsmooth=0.;
	float average=0.;
	float l=length(z);
	float prevl;

	for (int i=0; i<iterations; i++)
	{
		z = abs(z * (2.2 + cos(iTime*0.2)))/(z.x*z.y)-c;

		prevl=l;
		l=length(z);
		expsmooth+=exp(-.2/abs(l-prevl));
		average+=abs(l-prevl);
	}

	float brightness = expsmooth*.002;

	average/=float(iterations) * 22.87;

	vec3 myColor=vec3(max(abs(sin(iTime)), 0.45),max(abs(cos(iTime * 0.2)), 0.45),max(abs(sin(iTime* 2.)), 0.45));
	vec3 finalColor;

	finalColor.r = (float(average)/myColor.r);
	finalColor.g = (float(average)/myColor.g);
	finalColor.b = (float(average)/myColor.b);

	fragColor = vec4(finalColor*brightness,1.0);
}
