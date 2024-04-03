// URL: shadertoy.com/view/MlsGWX
// By: sben

// Created by sofiane benchaa - sben/2015
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
#define FIELD 20.0
#define HEIGHT 0.7
#define ITERATION 2
#define TONE vec3(0.5,0.2,0.3)

float eq(vec2 p,float t){
	float x = sin( p.y +cos(t+p.x*.2) ) * cos(p.x-t);
	x *= acos(x);
	return - x * abs(x-.5) * p.x/p.y;
}

void mainImage( out vec4 O, vec2 U ) {
	O -= O; vec4 X=O;
	vec2  p = 20.*(U / iResolution.xy  +.5);
	float t = iTime,i,
         hs = 20.*(.7+cos(t)*.1),
	      x = eq(p,t), y = p.y-x;
    
    for(float i=0.; i<2.; ++i)
		p.x *= 2.,
        X = x + vec4(0, eq(p,t+i+1.), eq(p,t+i+2.) ,0),
        x = X.z += X.y,
        O += vec4(.5,.2,.3,0) / abs(y-X-hs);
}

