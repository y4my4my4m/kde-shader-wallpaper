// https://www.shadertoy.com/view/MsVXWD
// Credits to JasonD

// FIXED VERSION of Satori: https://www.shadertoy.com/view/XsS3DV
// COMMENTS BELOW show what was changed.

float k = 20.0;
float field = 0.0;

vec2 center ( vec2 border , vec2 offset , vec2 vel ) {
	vec2 c;
	if ( vel.x == 0.0 && vel.y == 0.0 ) {
		c = vec2(iMouse.x, iMouse.y);
	}
	else {
		c = offset + vel * iTime * 0.5;
		c = mod ( c , 2. - 4. * border );
		if ( c.x > 1. - border.x ) c.x = 2. - c.x - 2. * border.x;
		if ( c.x < border.x ) c.x = 2. * border.x - c.x;
		if ( c.y > 1. - border.y ) c.y = 2. - c.y - 2. * border.y;
		if ( c.y < border.y ) c.y = 2. * border.y - c.y;
	}
	return c;
}

// ADDED: ------------------------------------------------------
vec2 g_fragCoord;

void circle ( float r , vec3 col , vec2 offset , vec2 vel ) {

	// CHANGED: ------------------------------------------------------
	vec2 pos = g_fragCoord.xy / iResolution.y;

	float aspect = iResolution.x / iResolution.y;
	vec2 c = center ( vec2 ( r / aspect , r ) , offset , vel );
	c.x *= aspect;
	float d = distance ( pos , c );
	field += ( k * r ) / ( d*d );
}

vec3 band ( float shade, float low, float high, vec3 col1, vec3 col2 ) {

	if ( (shade >= low) && (shade <= high) ) {
		float delta = (shade - low) / (high - low);
		vec3 colDiff = col2 - col1;
		return col1 + (delta * colDiff);
	}
	else
		return vec3(0.0,0.0,0.0);
}

vec3 gradient ( float shade ) {
	vec3 colour = vec3( (sin(iTime/2.0)*0.25)+0.25,0.0,(cos(iTime/2.0)*0.25)+0.25);

	vec2 mouseScaled = iMouse.xy/iResolution.xy;
	vec3 col1 = vec3(mouseScaled.x, 0.0, 1.0-mouseScaled.x);
	vec3 col2 = vec3(1.0-mouseScaled.x, 0.0, mouseScaled.x);
	vec3 col3 = vec3(mouseScaled.y, 1.0-mouseScaled.y, mouseScaled.y);
	vec3 col4 = vec3((mouseScaled.x+mouseScaled.y)/2.0, (mouseScaled.x+mouseScaled.y)/2.0, 1.0 - (mouseScaled.x+mouseScaled.y)/2.0);
	vec3 col5 = vec3(mouseScaled.y, mouseScaled.y, mouseScaled.y);

	colour += band ( shade, 0.0, 0.3, colour, col1 );
	colour += band ( shade, 0.3, 0.6, col1, col2 );
	colour += band ( shade, 0.6, 0.8, col2, col3 );
	colour += band ( shade, 0.8, 0.9, col3, col4 );
	colour += band ( shade, 0.9, 1.0, col4, col5 );

	return colour;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {

    // ADDED: ------------------------------------------------------
    g_fragCoord = fragCoord;

	circle ( .03 , vec3 ( 0.7 , 0.2 , 0.8 ) , vec2 ( .6 ) , vec2 ( .30 , .70 ) );
	circle ( .05 , vec3 ( 0.7 , 0.9 , 0.6 ) , vec2 ( .1 ) , vec2 ( .02 , .20 ) );
	circle ( .07 , vec3 ( 0.3 , 0.4 , 0.1 ) , vec2 ( .1 ) , vec2 ( .10 , .04 ) );
	circle ( .10 , vec3 ( 0.2 , 0.5 , 0.1 ) , vec2 ( .3 ) , vec2 ( .10 , .20 ) );
	circle ( .20 , vec3 ( 0.1 , 0.3 , 0.7 ) , vec2 ( .2 ) , vec2 ( .40 , .25 ) );
	circle ( .30 , vec3 ( 0.9 , 0.4 , 0.2 ) , vec2 ( .0 ) , vec2 ( .15 , .20 ) );
	circle ( .30 , vec3 ( 0.0 , 0.0 , 0.0 ) , vec2 ( .0 ),  vec2 ( 0.0, 0.0 ) );

	float shade = min ( 1.0, max ( field/256.0, 0.0 ) );

	fragColor = vec4( gradient(shade), 1.0 );
}
