// https://www.shadertoy.com/view/XdXXzr
// Credits to ddoodm

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 mouse = iMouse.xy / iResolution.xy;

	float bg = (cos(uv.x*3.14159*2.0) + sin((uv.y)*3.14159)) * 0.15;

	vec2 p = uv*2.0 - 1.0;
	p *= 15.0;
	vec2 sfunc = vec2(p.x, p.y + 5.0*sin(uv.x*10.0-iTime*2.0 + cos(iTime*7.0) )+2.0*cos(uv.x*25.0+iTime*4.0));
	sfunc.y *= uv.x*2.0+0.05;
	sfunc.y *= 2.0 - uv.x*2.0+0.05;
	sfunc.y /= 0.1; // Thickness fix

	vec3 c = vec3(abs(sfunc.y));
	c = pow(c, vec3(-0.5));
	c *= vec3(0.3,0.85,1.0);
	//c += vec3(bg, bg*0.8, bg*0.4);

	fragColor = vec4(c,1.0);
}
