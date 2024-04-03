// https://www.shadertoy.com/view/XsBXRw
// Credits to mplanck

// The atmosphere fog effect is a pretty expensive part of the shader since I'm
// recomputing the effect once per time feature.  I rescale and shift the atmos
// effect per time feature to provide the illusion of depth.  Decrease the number
// of ATMOS_DETAIL_ITERATIONS if your gpu is melting, or to get more detail in the
// atmosphere, increase it to 8.
//

#define ATMOS_DETAIL_ITERATIONS 4

#define MONTH_WIDTH .05
#define DAY_WIDTH .025
#define HOUR_WIDTH .0125
#define MINUTE_WIDTH .006
#define SECOND_WIDTH .0015
#define TICK_WIDTH .1

// ------------------------------------
// following grabbed and modified from Fire from @301z - https://www.shadertoy.com/view/Xsl3zN
// hash grabbed from David Hoskins - https://www.shadertoy.com/view/4djSRW

float hash12(vec2 p)
{
	p  = fract(p * vec2(5.3983, 5.4427));
    p += dot(p.yx, p.xy + vec2(21.5351, 14.3137));
	return fract(p.x * p.y * 95.4337);
}

float noise(vec2 n) 
{
	const vec2 d = vec2(0.0, 1.0);
	vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));

    return mix(mix(hash12(b), 
                   hash12(b + d.yx), f.x), 
               mix(hash12(b + d.xy), 
                   hash12(b + d.yy), f.x), 
               f.y);
}

float fbm(vec2 n) 
{
	float total = 0.0, amplitude = 1.0;
	for (int i = 0; i < ATMOS_DETAIL_ITERATIONS; i++) 
    {
		total += noise(n) * amplitude;
		n += n;
		amplitude *= 0.5;
	}
	return total;
}

float atmos( vec2 p )
{
	float q = fbm(p - iTime * 0.1);
	vec2 r = vec2(fbm(p + q + iTime * 0.01 - p.x - p.y), fbm(p + q - iTime * 0.04));
	return mix(.1, .4, fbm(p + r)) + mix(.6, .8, r.x) - mix(.0, .4, r.y);
}

// ------------------------------------

vec3 draw_grid(vec2 uv) 
{
    float gridLine = fract(60. * uv.x);
    float mask = smoothstep(0., .1, uv.y) * smoothstep(1., .9, uv.y) ;
    
    mask *= smoothstep( .05, .0, abs(gridLine - .5));
    return mask * 0.05 * vec3(1., 1., 1.);
}

vec3 draw_bg_and_tick(vec2 uv)
{ 
    float tickCenter = (1. + 2. * TICK_WIDTH) * fract(iTime * .1) - TICK_WIDTH;
    float f = abs(uv.x - tickCenter);

    float beamSpread = .1;
    float lightBeam = smoothstep( TICK_WIDTH + beamSpread, TICK_WIDTH - beamSpread, f);
            
    vec3 lightColor = mix(vec3(1., 0., 0.),  vec3(1.4, .4, .3), lightBeam);
    
    lightColor *= atmos( 6. * (uv + vec2(50., 50.)) ); // scale and shift fog to fake depth

    return .3 * mix( lightColor, vec3(.1,.1,.1), uv.y);
}

vec3 draw_second(vec2 uv) 
{
    float secondCenter = fract(floor(iDate.w) / 60.);
    float f = abs(uv.x - secondCenter);
    
    float lightBeam = max(smoothstep(0., 1., uv.y), 4. * smoothstep(.001, .0, pow(uv.y, 1.5)));    
    float beamSpread = .001;    
    lightBeam *= smoothstep( SECOND_WIDTH + beamSpread, SECOND_WIDTH - beamSpread, f);
    
    float lightIntensity = lightBeam * 6.2;
    lightIntensity += .8 * smoothstep(.1, .0, uv.y) * smoothstep(.05, .0, abs(uv.x - secondCenter)); 
    
    lightIntensity *= atmos( 5.5 * (uv + vec2(50., 50.)) ); // scale and shift fog to fake depth
    
    return vec3(1., .12, .1) * lightIntensity;
}

vec3 draw_minute(vec2 uv) 
{
    float minuteCenter = fract(iDate.w / 3600.); 
    float f = abs(uv.x - minuteCenter);
    
    float lightBeam = max(smoothstep(0., 1., uv.y), smoothstep(.02, .0, pow(uv.y, 1.6)));
    float beamSpread = .005 + .05 * max(0., pow((.9 - uv.y), 3.));
    lightBeam *= smoothstep( MINUTE_WIDTH + beamSpread, MINUTE_WIDTH - beamSpread, abs(uv.x - minuteCenter));
    
    float lightIntensity = lightBeam;
    lightIntensity += .8 * smoothstep(.03, .0, uv.y) * smoothstep(.03, .0, abs(uv.x - minuteCenter)); 
    
    lightIntensity *= atmos( 4.5 * (uv + vec2(40., 40.)) ); // scale and shift fog to fake depth
    
    return vec3(1., .41, .18) * lightIntensity;
}

vec3 draw_hour(vec2 uv) 
{
    float hourCenter = fract(iDate.w / 86400.);  
    float f = abs(uv.x - hourCenter);
    
    float lightBeam = max(smoothstep(0., 1., uv.y), smoothstep(.03, .0, pow(uv.y, 1.5)));    
    float beamSpread = .008 + .05 * max(0., pow((1. - uv.y), 3.));
    lightBeam *= smoothstep( HOUR_WIDTH + beamSpread, HOUR_WIDTH - beamSpread, f);
        
    float lightIntensity = lightBeam * .8;    
    lightIntensity += smoothstep(.02, -.01, uv.y) * smoothstep(.05, .0, f);     
    
    lightIntensity *= atmos( 4. * (uv + vec2(30., 30.)) ); // scale and shift fog to fake depth
    
    return vec3(1., .6, .3) * lightIntensity;
    
}

vec3 draw_day(vec2 uv) 
{
    float dayCenter = iDate.z / 31.;
	float f = abs(uv.x - dayCenter);
    
    float lightBeam = max(smoothstep(0., 1., uv.y), smoothstep(.05, .0, pow(uv.y, 1.4)));
    float beamSpread = .01 + .1 * max(0., pow((1. - uv.y), 3.));
    lightBeam *= smoothstep( DAY_WIDTH + beamSpread, DAY_WIDTH - beamSpread, f);
    
    float lightIntensity = lightBeam * .6;
    lightIntensity += smoothstep(.02, -.01, uv.y) * smoothstep(.13, .0, f);
    
    lightIntensity *= atmos( 3.5 * (uv + vec2(20., 20.)) ); // scale and shift fog to fake depth
    
    return vec3(1., 0.7, 0.5) * lightIntensity;
    
}

vec3 draw_month(vec2 uv) 
{
    float monthCenter = iDate.y / 12.;
    
    float lightBeam = max(smoothstep(0., 1., uv.y), smoothstep(.15, .0, pow(uv.y, 1.3)));        
    float f = .03 + .1 * max(0., pow((1.2 - uv.y), 3.));    
    lightBeam *= smoothstep( MONTH_WIDTH + f, MONTH_WIDTH - f, abs(uv.x - monthCenter));
    
    float lightIntensity = lightBeam * .4;
    lightIntensity += .5 * smoothstep(.012, .0, uv.y) * smoothstep(.18, .0, abs(uv.x - monthCenter)); 
    
    lightIntensity *= atmos( 3. * (uv + vec2(10., 10.)) ); // scale and shift fog to fake depth

    return vec3(1., 0.8, 0.7) * lightIntensity;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 uv = fragCoord.xy / iResolution.xy;
    
    vec3 scene_color = vec3(0.);
    scene_color += draw_month(uv);
    scene_color += draw_day(uv);
    scene_color += draw_hour(uv);
    scene_color += draw_minute(uv);
    scene_color += draw_second(uv);    
    scene_color += draw_bg_and_tick(uv);
    scene_color += draw_grid(uv);
    
    fragColor.rgb = scene_color;
    
    //fragColor.rgb = vec3(atmos(5. * uv));
}
                                
