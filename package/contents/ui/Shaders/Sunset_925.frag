// https://www.shadertoy.com/view/MdsSzf
// Credits to sepych

vec3 toGLColor(vec3 color)
{
	return color * 0.00392156862;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.x;
	float smoothness = 0.002;

	vec2 p = vec2(0.5, 0.5*iResolution.y/iResolution.x);

	vec3 col1 = toGLColor(vec3(203, 136, 180));
	vec3 col2 = toGLColor(vec3(149, 165, 166));
	vec3 col3 = toGLColor(vec3(52, 152, 219));
	vec3 col4 = toGLColor(vec3(22, 160, 133));
	vec3 col5 = toGLColor(vec3(14, 122, 160));
	vec3 col6 = toGLColor(vec3(14, 12, 60));
	vec3 col7 = toGLColor(vec3(241, 200, 165));
	vec3 col8 = vec3(1., 1., 1.);
	vec3 col9 = vec3(1., 1., 1.);

	vec3 col = col2;


	// shadow shape
	vec2 q = p - uv;
	q *= vec2(0.5, 2.5); // scale
	q += vec2(0.0, -0.6); // translate
	float shape = 1. - smoothstep(0., 0.15, length(q));
	col = col + col9*0.3*shape;

	// object shape
	q = p - uv;
	float qLen = length(q);
	float sfunc = 0.2 + 0.01*exp(sin(atan(q.y, q.x)*4.)*0.9);
	shape = 1. - smoothstep(sfunc, sfunc + smoothness, qLen);
	col = mix(col, col1, shape);

	float gradShape = 1. - smoothstep(sfunc-0.05, sfunc, qLen);
	float rayShape = shape;
	float waveShape1 = shape;
	float waveShape2 = shape;

	// rays and sun
	sfunc = 0.05 + 0.01*exp(sin(atan(q.y, q.x)*10.)*0.5);
	rayShape *= 1. - smoothstep(sfunc, sfunc + 0.2, qLen);
	float spec = 40. + 3.*sin(iTime) + sin(iTime*0.8);
	col7 += pow(1.-qLen, spec);
	col = mix(col, col7, rayShape);

	// wave 1
	float waveFunc = 0.3 + (0.01*sin(uv.x * 35. + iTime*2.))
		+ (0.005*sin(uv.x * 20. + iTime*0.5));
	waveShape1 *= 1. - smoothstep(waveFunc, waveFunc + smoothness, uv.y);
	col = mix(col, col3, waveShape1);

	// wave 2
	waveFunc = 0.3 + (0.02*sin(uv.x * 20. + iTime*2.))
		+ (0.005*sin(uv.x * 30. + iTime*0.7));
	waveShape2 *= 1. - smoothstep(waveFunc, waveFunc + smoothness, uv.y);
	float waveTop = 1. - smoothstep(waveFunc-0.005, waveFunc, uv.y);
	col5 = mix(col6, col5, 0.5+uv.y*1.7);
	col4 = mix(col3, col5, waveTop);
	col = mix(col, col4, waveShape2);

	// inner shadow
	col8 *= gradShape;
	col = col + col8*0.05;


	// highlight
	q += vec2(-0.2, 0.15);
	shape = 1. - smoothstep(0., 0.2, length(q));
	col = col + col8*0.6*shape;

	fragColor = vec4(col,1.0);
}
