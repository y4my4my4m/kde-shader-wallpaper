// url: https://www.shadertoy.com/view/stjyRR
// credits: CyrilGhys

// License :
// 3.2 - https://www.riotgames.com/en/terms-of-service
//    "We reserve all the rights to our IP, but do allow for some personal, non-commercial uses, like fan art."
// https://www.riotgames.com/en/legal
//    "Cool free stuff for the community to enjoy, with some exceptions."

// Reference :
// https://www.artstation.com/artwork/wJ09bX

// Constants
#define PI                       3.1415
#define TWO_PI                   6.283185

// Global parameters
#define SSAA                     1

// Raymarching parameters
#define MAX_STEPS                128
#define MAX_DIST                 5.
#define SURFACE_DIST             .0001

// ----------------------------------------------- HEXCORE PARAMS ---------------------------------------------

// ------------------------------------------------- SHORTHANDS ------------------------------------------------

// @source https://iquilezles.org/articles/distfunctions/
float dot2( in vec3 v ) { return dot(v,v); }
float dot2( in vec2 v ) { return dot(v,v); }

// ------------------------------------------------- CONVERSION ------------------------------------------------

// example input : 134. 
// example output: 2.14
float convertSecondsToMinutes(float seconds)
{
    // 0.017 = 1. / 60.
    return floor(seconds * .017) + mod(seconds, 60.) * .01;
}

// example input : 2.14 
// example output: 134.
float convertMinutesToSeconds(float minutes)
{
    return floor(minutes) * 60. + fract(minutes) * 100.;
}

// ----------------------------------------------------- SDFs -------------------------------------------------

vec4 sdSphere( vec3 p, float radius )
{
    return vec4(length(p) - radius, p);
}

float sdCylinder( vec3 p, float radius )
{
    return length(p.xz)-radius;
}

// @source https://iquilezles.org/articles/distfunctions/
float sdBox( vec3 point, vec3 b )
{
    vec3 d = abs(point) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

// @source https://iquilezles.org/articles/distfunctions/
// Triangle - exact   (https://www.shadertoy.com/view/4sXXRN)
float udTriangle( vec3 p, vec3 a, vec3 b, vec3 c )
{
  vec3 ba = b - a; vec3 pa = p - a;
  vec3 cb = c - b; vec3 pb = p - b;
  vec3 ac = a - c; vec3 pc = p - c;
  vec3 nor = cross( ba, ac );

  return sqrt(
    (sign(dot(cross(ba,nor),pa)) +
     sign(dot(cross(cb,nor),pb)) +
     sign(dot(cross(ac,nor),pc))<2.0)
     ?
     min( min(
     dot2(ba*clamp(dot(ba,pa)/dot2(ba),0.0,1.0)-pa),
     dot2(cb*clamp(dot(cb,pb)/dot2(cb),0.0,1.0)-pb) ),
     dot2(ac*clamp(dot(ac,pc)/dot2(ac),0.0,1.0)-pc) )
     :
     dot(nor,pa)*dot(nor,pa)/dot2(nor) );
}


// ------------------------------------------------- POSITIONING ----------------------------------------------

// rot Z, X, Y in radians
vec3 rotate(vec3 point, float rotX, float rotY, float rotZ)
{
    vec3 rotatedPoint = point;
    
    rotatedPoint = mat3(cos(rotZ), -sin(rotZ), 0,
                        sin(rotZ),  cos(rotZ), 0,
                        0,          0,         1) 
                        
                 * mat3(1, 0,          0,
                        0, cos(rotX), -sin(rotX), 
                        0, sin(rotX),  cos(rotX))
    
                 * mat3(cos(rotY),  0, sin(rotY),
                        0,          1, 0,
                        -sin(rotY), 0, cos(rotY))
                        
                 * point;
    
    return rotatedPoint;
}

// --------------------------------------------- PRIMITIVE COMBINATIONS ---------------------------------------
// -------------------------------- https://iquilezles.org/articles/distfunctions/ ----------------------------

float opUnion( float d1, float d2 ) { return min(d1,d2); }

float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }

float opIntersection( float d1, float d2 ) { return max(d1,d2); }

float opSmoothUnion( float d1, float d2, float k )
{
    float h = max(k-abs(d1-d2),0.0);
    return min(d1, d2) - h*h*0.25/k;
	//float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
	//return mix( d2, d1, h ) - k*h*(1.0-h);
}

float opSmoothSubtraction( float d1, float d2, float k )
{
    float h = max(k-abs(-d1-d2),0.0);
    return max(-d1, d2) + h*h*0.25/k;
	//float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
	//return mix( d2, -d1, h ) + k*h*(1.0-h);
}

float opSmoothIntersection( float d1, float d2, float k )
{
    float h = max(k-abs(d1-d2),0.0);
    return max(d1, d2) + h*h*0.25/k;
	//float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
	//return mix( d2, d1, h ) + k*h*(1.0-h);
}

// ---------------------------------------- DEFORMATIONS & DISTORTIONS ----------------------------------------

vec3 opTwist( in vec3 p, float amount )
{
    const float k = 10.0; // or some other amount
    float c = cos(amount*p.y);
    float s = sin(amount*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    return q;
}

vec3 opCheapBend( in vec3 p, float amount )
{
    const float k = 10.0; // or some other amount
    float c = cos(amount*p.x);
    float s = sin(amount*p.x);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xy,p.z);
    return q;
}

// ---------------------------------------------------- NOISE ------------------------------------------------

// @source https://www.shadertoy.com/view/4djSRW
//  1 out, 2 in...
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
// @source https://www.shadertoy.com/view/4djSRW
//  1 out, 3 in...
float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}
// @source https://www.shadertoy.com/view/4djSRW
///  2 out, 2 in...
vec2 hash22(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);

}
// @source https://www.shadertoy.com/view/4djSRW
///  3 out, 3 in...
vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);

}

// @source https://iquilezles.org/articles/voronoilines/
vec2 voronoi2D( in vec2 x )
{
    vec2 p = floor( x );
    vec2  f = fract( x );

    vec2 res = vec2( 8.0 );
    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec2 b = vec2(i, j);
        vec2  r = vec2(b) - f + hash22(p + b);
        float d = dot(r, r);

        if( d < res.x )
        {
            res.y = res.x;
            res.x = d;
        }
        else if( d < res.y )
        {
            res.y = d;
        }
    }

    return sqrt( res );
}

// @source https://www.shadertoy.com/view/lsf3WH
float valueNoise2D( in vec2 p )
{
    vec2 i = floor( p );
    vec2 f = fract( p );
	
	vec2 u = f*f*(3.0-2.0*f);

    return mix( mix( hash12( i + vec2(0.0,0.0) ), 
                     hash12( i + vec2(1.0,0.0) ), u.x),
                mix( hash12( i + vec2(0.0,1.0) ), 
                     hash12( i + vec2(1.0,1.0) ), u.x), u.y);
}

// @source https://www.shadertoy.com/view/4sfGzS
// Value Noise 3D 
float valueNoise3D( in vec3 x )
{
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
	
    return mix(mix(mix( hash13(i+vec3(0,0,0)), 
                        hash13(i+vec3(1,0,0)),f.x),
                   mix( hash13(i+vec3(0,1,0)), 
                        hash13(i+vec3(1,1,0)),f.x),f.y),
               mix(mix( hash13(i+vec3(0,0,1)), 
                        hash13(i+vec3(1,0,1)),f.x),
                   mix( hash13(i+vec3(0,1,1)), 
                        hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}

// @source https://www.shadertoy.com/view/ldl3Dl
// returns closest, second closest, and cell id
vec3 voronoi3D( in vec3 x )
{
    vec3 p = floor( x );
    vec3 f = fract( x );

	float id = 0.0;
    vec2 res = vec2( 100.0 );
    for( int k=-1; k<=1; k++ )
    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec3 b = vec3( float(i), float(j), float(k) );
        vec3 r = vec3( b ) - f + hash33( p + b );
        float d = dot( r, r );

        if( d < res.x )
        {
			id = dot( p+b, vec3(1.0,57.0,113.0 ) );
            res = vec2( d, res.x );			
        }
        else if( d < res.y )
        {
            res.y = d;
        }
    }

    return vec3( sqrt( res ), abs(id) );
}

float hexcoreBreathingFrequency = 2.;
float hexcoreBreathingAmplitude = .005;

float pyramidOffset = .10;
float pyramidScale = 2.5;
float pyramidHeight = .01;
float pyramidCapWidthT;
float pyramidCapHeightT;
float pyramidCapCylinderRadius;
vec3 pyramidSymbolColour;
float pyramidSymbolScale;
float pyramidVerticalMaskPaddingBottom;
float pyramidVerticalMaskHeight;
float pyramidVerticalMaskFade;
float pyramidHorizontalMaskWidth;
float pyramidHorizontalMaskFade;

float pyramidCountPerCircle = 8.;

float triangleThickness = .001;

float ringsHeight = .004;
float ringsThickness = .006;
float ringOuterSize = .17;
float ringOuterSpeed;
float ringMidSize = .135;
float ringMidSpeed;
float ringInnerSize = .10;
float ringInnerSpeed;
vec3 ringLinesColour;

float orbRadius = .03;
vec3 orbBaseColour;
vec3 orbNoiseColour;
vec3 orbLightColour;

// #D4AF37
vec3 edgeColour = vec3(.831, .686, .216);
float edgeHatOffset;
float edgeStrength;

float breathing;
float hexcoreRadius;

vec3 fxColor;
float uvScale = 30.;
float rotFactor = 0.;

void adaptParams(float musicLoudness, float time)
{
    // pyramidHeight = mix(.01, .02, musicLoudness);
    pyramidCapWidthT = mix(.8, 1., musicLoudness);
    pyramidCapHeightT = mix(.8, 1., musicLoudness);
    pyramidCapCylinderRadius = mix(.002, 0., musicLoudness);
    pyramidSymbolColour = mix(vec3(0., .1, .8), vec3(0.494,0.071,0.553), musicLoudness);
    pyramidSymbolScale = mix(200., 400., musicLoudness);
    pyramidVerticalMaskPaddingBottom = mix(.01, 0., pow(musicLoudness, 3.));
    pyramidVerticalMaskHeight = mix(.025, .035, musicLoudness);
    pyramidVerticalMaskFade = mix(.005, .001, musicLoudness);
    pyramidHorizontalMaskWidth = mix(.005, .001, musicLoudness);
    pyramidHorizontalMaskFade = mix(.8, 0., musicLoudness);
    
    ringOuterSpeed = mix(.4, 2., musicLoudness);
    ringMidSpeed = mix(1.5, 5., musicLoudness);
    ringInnerSpeed = mix(2.5, 10., musicLoudness);
    ringLinesColour = mix(vec3(0.039,0.067,0.322), vec3(0.318,0.043,0.467), musicLoudness);
    
    orbBaseColour = mix(vec3(0.271,0.416,0.761), vec3(0.275,0.020,0.294), musicLoudness);
    orbNoiseColour = mix(vec3(0.043,0.294,0.957), vec3(0.306,0.059,0.369), musicLoudness);
    orbLightColour = mix(vec3(.0, .2, .8), vec3(0.353,0.008,0.541), musicLoudness);
    
    edgeHatOffset = mix(.028, .035, musicLoudness);
    edgeStrength = .1 + .9 * (1. - musicLoudness);
    
    breathing = sin(time * hexcoreBreathingFrequency) * hexcoreBreathingAmplitude;
    hexcoreRadius = pyramidOffset + breathing;
    
    fxColor = mix( vec3(0.055,0.129,0.439), vec3(0.361,0.106,0.447), musicLoudness );
}

// ---------------------------------------------------- MUSIC -------------------------------------------------

bool hasMusicStarted = false;
float musicLengthSeconds = 3. * 60. + 33.;

// down : 0.00 - 0.36
// mid : 0:36 - 1:00
// down : 1:00 - 1:04 'what could have been'
// mid : 1:04 - 1:16
// up : 1:16 - 1:28
// down : 1:28 - 2:00
// mid : 2:00 - 2:32
// up : 2:32 - 3:24
// down : 3:24 - 3:33
float timings[8] = float[](
    36.,
    60.,
    64.,
    77.,
    88.,
    120.,
    152.,
    204.);
float fade = 2.;

float musicFunction(float timer)
{
    return .5 * smoothstep(timings[0]-fade, timings[0]+fade, timer)
         - .5 * smoothstep(timings[1]-fade, timings[1]+fade, timer)
         + .5 * smoothstep(timings[2]-fade, timings[2]+fade, timer)
         + .5 * smoothstep(timings[3]-fade, timings[3]+fade, timer)
         - 1. * smoothstep(timings[4]-fade, timings[4]+fade, timer)
         + .5 * smoothstep(timings[5]-fade, timings[5]+fade, timer)
         + .5 * smoothstep(timings[6]-fade, timings[6]+fade, timer)
         - 1. * smoothstep(timings[7]-fade, timings[7]+fade, timer);
}

float musicLoudness;
float musicVelocity;

// I could not figure out a satisfying way to make 'musicLoudness'
// depends on the actual music (frequency / waveform analysis to get music's 'strength')
// So, instead, I'm using time to filter what I want
void processMusic(float time)
{
    // TEMP: Use time to filter 'strong' parts of the music
    if ( texture( iChannel0, vec2( 0.01, 0.25 ) ).x > 0.1 && hasMusicStarted == false )
    {
        hasMusicStarted = true;
    }
    
    if ( hasMusicStarted )
    {        
        float musicTimer = mod(time, musicLengthSeconds);
        musicLoudness = clamp( musicFunction(musicTimer), 0., 1.);
        //musicVelocity = clamp( (musicLoudness - musicFunction(musicTimer - 1.)) * 3., -1., 1.);
    }
    
    // TODO: Analyze and filter music's frequencies and/or waveform
    {
    // @source https://www.shadertoy.com/view/Xds3Rr
    //freqs[0] = texture( iChannel0, vec2( 0.01, 0.25 ) ).x;
    //freqs[1] = texture( iChannel0, vec2( 0.07, 0.25 ) ).x;
    //freqs[2] = texture( iChannel0, vec2( 0.15, 0.25 ) ).x;
    //freqs[3] = texture( iChannel0, vec2( 0.30, 0.25 ) ).x;
    
    // average music strength for the given Shadertoy interval
    // (I don't how many last milliseconds)
    //float median = 0.;
    //float maxValue = 0.;
    //float minValue = 0.;
    //float average = 0.;
    //float nbSteps = 20.;
    //for ( float f=0.5; f < 1.; f+=(1./nbSteps) )
    //{
    //    //average += texture( iChannel0, vec2( f, 0.75 ) ).x;
    //    average += texture( iChannel0, vec2( f, 0.75 ) ).x;
    //    maxValue = max(maxValue, texture( iChannel0, vec2( f, 0.25 ) ).x);
    //    minValue = min(minValue, texture( iChannel0, vec2( f, 0.25 ) ).x);
    //}
    //average /= nbSteps;
    //median = (maxValue - minValue);
    
    //musicLoudness = smoothstep( .4, .42, pow( average/nbSteps, 1.) );
    }
}

// ------------------------------------------------ CUSTOM SDFs -----------------------------------------------

// @source https://www.shadertoy.com/view/ltdBR8
vec4 hexcorePyramid(vec3 p, float sector, float time)
{
    p /= pyramidScale;
    
    {
    // Input function to ease rotation, using fract(time) [0,1]
    //float time01 = pow(fract(time), 2.);
    
    // Overshoot ?
    //float tRatioOvershoot = .1;
    //float isOvershooting = step(1. - tRatioOvershoot, time01);
    
    // (time01 * PI * .5)                                  -> 90 turn = 1 sec
    // (time01 * PI * .5) * (1. / PYRAMID_TIME_TO_90_TURN) -> 90 turn = PYRAMID_TIME_TO_90_TURN
    //float rot = 
    //    (time01 * PI * .55) * (1. / (PYRAMID_TIME_TO_90_TURN * (1. - tRatioOvershoot))) * (1. - isOvershooting)
    //     + (time01 * -PI * .05) * (1. / (PYRAMID_TIME_TO_90_TURN * tRatioOvershoot)) * isOvershooting;
    
    // Only one sector at a time
    //float shouldRotate =
    //    step(sector + 1., floor( mod(time, 8.) )) 
    //    - step(sector, floor( mod(time, 8.) ));
    // & only odd ones
    //shouldRotate *= mod(sector, 2.);
    // & only the right amount of time
    //shouldRotate *= step(1. - PYRAMID_TIME_TO_90_TURN, time01);
    //rot *= shouldRotate;
    
    // Rotate it
    //p.xz = mat2(cos(rot), -sin(rot),
    //            sin(rot),  cos(rot)) * p.xz;
    }
        
    // Pyramid basis
    vec2 size = vec2(cos(PI * .25), sin(PI * .25));
    float d = 0.0;
    d = max( d, abs( dot(p, vec3( -size.x, size.y, 0 )) ));
    d = max( d, abs( dot(p, vec3(  size.x, size.y, 0 )) ));
    d = max( d, abs( dot(p, vec3(  0,      size.y, size.x )) ));
    d = max( d, abs( dot(p, vec3(  0,      size.y,-size.x )) ));
    float octa = d - pyramidHeight;
    
    // Capping box (both corners, peak and bottom)
    float boxHeight = mix(0., size.x*pyramidHeight, pyramidCapHeightT);
    float boxWidth =  mix(0., 1./pyramidScale*.05, pyramidCapWidthT);
    p.xz = mat2(cos(PI * .25), -sin(PI * .25),
                sin(PI * .25),  cos(PI * .25)) * p.xz;
    float box = sdBox(p-vec3(0.,boxHeight,0.), vec3(boxWidth, boxHeight, boxWidth));
    
    // Details
    float angle = TWO_PI / 4.;
    float sec = round(atan(p.z, p.x) / angle);
    
    vec3 pointSectorized = p;
    pointSectorized.xz = mat2(cos(sec * angle), -sin(sec * angle),
                              sin(sec * angle),  cos(sec * angle)) * p.xz;
    
    vec3 q1 = rotate(pointSectorized, 0., 0., PI * .25);
    float cyl1 = sdCylinder(q1-vec3(.014,.0,.0), pyramidCapCylinderRadius);
        
    d = opIntersection(box, octa);
    d = opSubtraction(cyl1, d);
    
    return vec4(d * pyramidScale, p);
}

vec4 hexcorePyramidsCircle(vec3 p, float index, float time)
{
    float angle = TWO_PI / pyramidCountPerCircle;
    // atan(p.z, p.y)                         -> [-PI, PI]
    // atan(p.z, p.y) / (TWO_PI / 8)          -> [-4., 4.]
    // round( atan(p.z, p.y) / (TWO_PI / 8) ) -> [-4][-3][-2][-1][0][1][2][3]
    float sector = round(atan(p.z, p.y) / angle);
    
    vec3 pointSectorized = p;
    pointSectorized.yz = mat2(cos(sector * angle), -sin(sector * angle),
                              sin(sector * angle),  cos(sector * angle)) * p.yz;
    
    return hexcorePyramid((pointSectorized - vec3(0., hexcoreRadius, 0.)), (sector + pyramidCountPerCircle * .5) + index, time);
}

vec4 hexcoreTriangle(vec3 p, vec3 a, vec3 b, vec3 c)
{    
    float triangle = udTriangle(abs(p), a, b, c) - triangleThickness;
    
    vec3 average = (a+b+c) * .333;
    float t = .8;
    float box = sdBox(abs(p)-average, t*vec3(a.x-average.x, b.y-average.y, c.z-average.z));
    
    float d = opIntersection(triangle, box);
    
    return vec4(d, p);
}

vec4 hexcoreRing(vec3 p, float size)
{
    // take absolute value so we carve the cylinder
    float ring = abs(length(p.xz) - size * .5);
    // cap it, with absolute value, at top and bottom
    ring = abs(max(ring, abs(p.y) - ringsHeight * .5)) - ringsThickness;
    
    return vec4(ring, p);
}

// ------------------------------------------------- RAYMARCHING ----------------------------------------------
// returns the distance from point to the closest object in the scene
vec4 map(vec3 point, float time)
{    
    // PYRAMIDS
    vec4 pyramids1 = hexcorePyramidsCircle(point.xyz, 00., time);
    vec4 pyramids2 = hexcorePyramidsCircle(point.yzx, 10., time);
    vec4 pyramids3 = hexcorePyramidsCircle(point.zxy, 20., time);
    
    // TRIANGLES
    vec2 tri = vec2(hexcoreRadius * cos(PI * .14), hexcoreRadius * sin(PI * .14));
    vec4 triangles = hexcoreTriangle(point, tri.xyy, tri.yxy, tri.yyx);
    
    // RING 1
    vec3 ring1RotatedPoint = rotate(point, TWO_PI * .250, time * ringOuterSpeed, 0.);
    vec4 ring1 = hexcoreRing(ring1RotatedPoint, ringOuterSize);
    // RING 2
    vec3 ring2RotatedPoint = rotate(point, TWO_PI * .125, time * ringMidSpeed, 0.);
    vec4 ring2 = hexcoreRing(ring2RotatedPoint, ringMidSize);
    // RING 3
    vec3 ring3RotatedPoint = rotate(point, TWO_PI * .825, time * ringInnerSpeed, 0.);
    vec4 ring3 = hexcoreRing(ring3RotatedPoint, ringInnerSize);
    
    // ORB
    vec4 orb = sdSphere(point, orbRadius);
    
    vec4 d = orb;
    
    // UNIONS
    vec4 t;
    t = ring1; if( t.x<d.x ) d=t;
    t = ring2; if( t.x<d.x ) d=t;
    t = ring3; if( t.x<d.x ) d=t;
    t = pyramids1; if( t.x<d.x ) d=t;
    t = pyramids2; if( t.x<d.x ) d=t;
    t = pyramids3; if( t.x<d.x ) d=t;
    t = triangles; if( t.x<d.x ) d=t;
    
    return d;
}

// @source https://youtu.be/bdICU2uvOdU?t=4788
vec2 iSphere( in vec3 ro, in vec3 rd, vec3 center, float radius )
{
    ro -= center;
    float b = dot(rd, ro);
    float c = dot2(ro) - radius*radius;
    float h = b*b - c;
    if ( h < 0.0 ) return vec2(-1.0);
    h = sqrt(h);
    return vec2( -b-h, -b+h );
}

// returns the distance from origin to the closest object in the scene
// will iterate into 'map' function multiple times
// taking as many safe smallest steps as possible
// before either : hitting an object ; getting too far away from origin ; getting too many steps
vec4 intersect(vec3 rayOrigin, vec3 rayDirection, float time)
{
    // distance from origin to furthest safe point (if any) ; the one we'll return
    vec4 res = vec4(-1.0);
    
    vec2 vol = iSphere( rayOrigin, rayDirection, vec3(0.), hexcoreRadius+.035 );
    
    if ( vol.y>0.0 )
    {
        float t = max( vol.x,0.0 );
        // March as long as we didn't get too many steps, or if we aren't too far away from the scene
        for (int i=0; i < MAX_STEPS && t < vol.y; i++)
        {
            // point = current furthest safe point ; center of the sphere (sphere tracing)
            vec3 point = rayOrigin + rayDirection * t;

            // distanceToScene = largest safe next distance to march ; radius of the sphere (sphere tracing)
            vec4 distancePointScene = map(point, time);

            // If we are really close to the object
            if (distancePointScene.x < SURFACE_DIST)
            {
                res = vec4(t, distancePointScene.yzw);
                break;
            }

            t += distancePointScene.x;
        }
    }
    
    return res;
}

// -------------------------------------------------- LIGHTING ------------------------------------------------
// @source https://iquilezles.org/articles/normalsSDF
vec3 getNormal(vec3 point, float time)
{
#if 0
    vec2 offset = vec2(1.0,-1.0) * 0.5773 * 0.0005;
    return normalize( offset.xyy * map( point + offset.xyy ) + 
					  offset.yyx * map( point + offset.yyx ) + 
					  offset.yxy * map( point + offset.yxy ) + 
					  offset.xxx * map( point + offset.xxx ) );
#else
    // inspired by tdhooper and klems - a way to prevent the compiler from inlining map() 4 times
    vec3 normal = vec3(0.0);
    for( int i=0; i<4; i++ )
    {
        vec3 offset = 0.5773 * (2.0 * vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        normal += offset * map(point + 0.0005 * offset, time).x;
      //if( normal.x + normal.y + normal.z>100.0 ) break;
    }
    return normalize(normal);
#endif    
}

float getAO( in vec3 pos, in vec3 nor, in float time )
{
	float occlusion = 0.0;
    float scale = 1.0;
    for( int i=0; i<5; i++ )
    {
        float height = 0.01 + 0.12*float(i)/4.0;
        float dist = map( pos + height * nor, time ).x;
				// as long as we're getting away from a surface
				// height - distance will be 0
        occlusion += (height - dist) * scale ;
        scale *= 0.95;
    }
		// clamp01 the result for precision purpose
    return clamp( 1.0 - 3.0*occlusion, 0.0, 1.0 );
}

// @source https://iquilezles.org/articles/rmshadows/
float getSoftShadow( in vec3 ro, in vec3 rd, float mint, float maxt, float k, float time )
{
    float res = 1.0;
    
    vec2 vol = iSphere( ro, rd, vec3(0.), hexcoreRadius+.035 );
    if ( vol.y>0.0 )
    {
        float t = max( .001,vol.x );
        for( float t=mint; t<maxt; )
        {
            float h = map(ro + rd*t, time).x;
            if( h<SURFACE_DIST )
                return 0.0;
            res = min( res, k*h/t );
            t += h;
        }
    }
    
    return res;
}

vec4 getVolumetricLighting( in vec3 normal, float mint, float maxt, float time )
{
    float t = .001;
    vec4 res;
    for( float t=mint; t<maxt; )
    {
        res = map(normal*t, time);
        if( res.x < SURFACE_DIST )
            return vec4(0.);
        t += res.x;
    }
    
    return vec4(t, res.yzw);
}

// ----------------------------------------------------- MAIN -------------------------------------------------
mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv =          ( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 tot = vec3(0.0);
    
    // if ssaa is on, sample multiple fragment per pixel
    #if SSAA >1
    for( int m=0; m<SSAA; m++ )
    for( int n=0; n<SSAA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(SSAA) - 0.5;
        vec2 uv = (2.0*(fragCoord+o)-iResolution.xy)/iResolution.y;
        float dither = .5 + .5 * sin(fragCoord.x*111.0) * sin(fragCoord.y*125.546);
        float time = iTime - (1./48.)*(float(m+SSAA+n)+dither)/float(SSAA*SSAA);
        #else    
        vec2 uv = (2.0*fragCoord-iResolution.xy)/iResolution.y;
        float time = iTime;
        #endif
        
        processMusic(time);
        adaptParams(musicLoudness, time);
    
        // camera
        float angle = TWO_PI * time / 40.;
        vec3 turnAxis = vec3( 0.0, 0.0, 0.0 );
        float rotDistance = .5+.5*musicLoudness;
        vec3 rayOrigin = turnAxis + vec3( rotDistance*cos(angle), .3+.2*musicLoudness, rotDistance*sin(angle) );

        // camera-to-world transformation
        mat3 cameraWorldMatrix = setCamera(rayOrigin, turnAxis, 0.0 );

        // ray direction
        float focalLength = 3.5;
        vec3 rayDirection = cameraWorldMatrix * normalize(vec3(uv, focalLength));
        
        // background
        vec3 colour = vec3(1.0 + rayDirection.y) * 0.03;

        // raymarch geometry
        vec4 t = intersect(rayOrigin, rayDirection, time);
        if (t.x > 0.0)
        {
            vec3 pointNearObject = rayOrigin + rayDirection * t.x;

            // --- Normal
            vec3 normal = getNormal(pointNearObject, time);
            
            // --- 'Handpainted' ambient occlusion
            // occlude everything pointing inwards
            float fakeOcclusion = 
                0.1+0.9*clamp(0.5 + 0.5 * dot(normal, normalize(pointNearObject)), 0., 1.);
            // occlude things in a certain radius from origin
            fakeOcclusion *= 0.1+0.9*clamp(length(pointNearObject) / .1, 0., 1.);
            
            // --- Computed ambient occlusion
            float occlusion = clamp(getAO(pointNearObject, normal, time) * fakeOcclusion, 0., 1.);
            
            vec3 specLightPos = vec3(cos(time), 3., sin(time));

            // --- Orb lighting
            {
                // Choose the orb only
                float orbMask = 1. - clamp( step(orbRadius + .01, length(pointNearObject)), 0., 1. );
                
                float noise = 0.;
                vec3 q = 24.0*pointNearObject+time*.2;
                noise  = 0.5000*valueNoise3D( q ); q = q*2.01;
                noise += 0.2500*valueNoise3D( q ); q = q*2.02;
                noise += 0.1250*valueNoise3D( q ); q = q*2.03;
                noise += 0.0625*valueNoise3D( q ); q = q*2.01;
                noise = pow(clamp(noise, 0., 1.), 3.) * 1.5;
                float facing = pow(abs(dot(normal, rayDirection)), 5.) * 2.;
                
                float fresnel = clamp( 1. + dot(rayDirection, normal), 0., 1. );
                fresnel = pow(fresnel, 5.);
                
                vec3 reflection = reflect(normalize(specLightPos), normal);
                float d = 1. - clamp(.5 + .5 * dot(-reflection, rayDirection), 0., 1.);
                float specular = smoothstep(.94, .98, d);
                
                // Light from orb            
                float facingInwards = clamp(dot(normal, -normalize(pointNearObject)), 0., 1. );
                                
                // Lights the orb receive
                colour += .005*orbBaseColour*orbMask
                    + noise*orbNoiseColour*facing*orbMask
                    + 1.5*orbBaseColour*fresnel*orbMask
                    + specular*orbMask;
                // Lights from the orb
                colour += 30.*orbLightColour*facingInwards*occlusion;
            }
            
            // --- Rings lighting
            {
                // Choose the rings only
                float ringsMask = step(ringInnerSize*.5-.007, length(pointNearObject))
                    - step(ringOuterSize*.5+.007, length(pointNearObject));
                
                // Fish-eye lens
                vec3 t3 = t.yzw;
                float delta2 = dot(t3.xz, t3.xz);
                float delta_offset = 1. - delta2 * 100.;
                t3.xz *= delta_offset + 0.;
                
                // Naive voronoi borders
                vec3 noise = voronoi3D( 48.*t3+2. );
                float dist = noise.y - noise.x;
                float smth = 1.0 - smoothstep(0.0, 0.05, dist);
                    
                colour += .8*ringLinesColour*smth*ringsMask;
            }
            
            // --- Pyramids
            {
                // Rings' shadows projected onto pyramids' inwards
                float shadow = getSoftShadow(
                    vec3(0.), 
                    normalize(pointNearObject), 
                    orbRadius + .005,
                    hexcoreRadius,
                    128.,
                    time);
                shadow = 0.5+0.5*clamp(shadow, 0., 1.);
                float facingInwards = clamp(dot(normal, -normalize(pointNearObject)), 0., 1. );
                
                // Naive voronoi borders
                vec3 t3 = t.yzw;
                vec3 noise = voronoi3D( pyramidSymbolScale*t3+8. );
                float dist = noise.y - noise.x;
                float smth = 1.0 - smoothstep(0.0, 0.05, dist);
                // plus some other noise
                vec3 q = 128.0*pointNearObject+time;
                float noise2 = valueNoise3D(q+5.);
                
                // Choose the pyramids faces only
                float verticalMask = smoothstep(hexcoreRadius+pyramidVerticalMaskPaddingBottom, hexcoreRadius+pyramidVerticalMaskPaddingBottom+pyramidVerticalMaskFade, length(pointNearObject))
                    - smoothstep(hexcoreRadius+pyramidVerticalMaskHeight-pyramidVerticalMaskFade, hexcoreRadius+pyramidVerticalMaskHeight, length(pointNearObject));
                
                // Inverse XYZ cross mask, to sort out the pyramids' edges
                float horizontalMask = 1. -
                    ( smoothstep(pyramidHorizontalMaskWidth, pyramidHorizontalMaskWidth*pyramidHorizontalMaskFade, abs(t3.x))
                    + smoothstep(pyramidHorizontalMaskWidth, pyramidHorizontalMaskWidth*pyramidHorizontalMaskFade, abs(t3.z)) );
                horizontalMask = clamp(horizontalMask, 0., 1.);
                
                colour *= mix(1., shadow, facingInwards);
                colour += 2.*pyramidSymbolColour*(.2*smth+0.8*3.*smth*smoothstep(.6, .7, noise2))*verticalMask*horizontalMask;
                //colour = vec3(1.)*verticalMask*horizontalMask;
            }
            
            // --- Edge detection goldening + pyramid hat
            {                
                float edgeMask = smoothstep(t.x-.02, t.x-.01, length(rayOrigin)) - 
                    (1. - clamp( step(orbRadius + .02, length(pointNearObject)), 0., 1. ));
                edgeMask = clamp(edgeMask, 0., 1.);
                
                // fwidth(normal) same as abs(dFdx(normal))+abs(dFdy(normal))
                float dfNormal = clamp( round( dot(fwidth(normal), vec3(1.))*10. )/10., 0., 1.);
                
                float h = mix(0., cos(PI*.25)*pyramidHeight, pyramidCapHeightT)*pyramidScale*2.;
                float hatMask = step(hexcoreRadius + h, length(pointNearObject));
                
                colour += .5*edgeColour*edgeMask*dfNormal*occlusion*edgeStrength + .1*edgeColour*hatMask*edgeStrength;
            }
            
            // --- Top light
            {
                float dif = clamp(normal.y, 0., 1.);
                
                float fre = clamp(1. + dot(rayDirection, normal), 0., 1.);
                fre = pow(fre, 3.);
                
                colour += .5*vec3(0., .1, .5) *  dif * occlusion
                    + vec3(0., .1, .5) * fre;
            }
            
            // --- Side light
            {
                float dif = clamp( dot(normal, normalize(vec3(.7, .2, -.4))) , 0., 1.);
                
                colour += .07*vec3(.9, .3, .0) *  dif * occlusion;
            }
            
            // colour = vec3(1.) * pow(length(t.yzx), 10.);
            // colour = vec3(1.) * pow(length(pointNearObject), 1.);
            // colour = 0.5 + 0.5 * normal;
        }
        else
        {
            // --- Spiral fx background
            float fxMask = 1. - smoothstep(0., .8, pow( length(uv) - .5, 3. ));
            
            float fxInhaleStrength = 5. * ( 1. - smoothstep( 0., 1., length(uv) * .5 ) );
            vec2 rotUVs = mat2(cos(fxInhaleStrength), -sin(fxInhaleStrength),
                               sin(fxInhaleStrength),  cos(fxInhaleStrength)) * (uv) * uvScale;
            float an = time * rotFactor;
            rotUVs = mat2(cos(an), -sin(an),
                          sin(an),  cos(an)) * (rotUVs);
            
            float noise = valueNoise2D( rotUVs );
            
            noise = smoothstep(.8, 1., noise);
            
            colour += .1 * fxColor * noise * fxMask;
        }
        
        // --- Lightnings
        {
            //float mask = 1. - smoothstep(0., .05, pow( length(uv) - .5, 3. ));
            //mask *= 1. - step( 0.15, mod( time - length(uv), 2.) );
            //mask *= smoothstep( .8, .85, valueNoise2D( .1 * time - uv * 5. ) );
            
            //vec2 voro = voronoi2D( time - abs(uv * 8.) );
            //float dist = voro.y - voro.x;
            //float bord = 1. - smoothstep(0., .05, dist);
            
            //colour += fxColor * bord * mask;
        }
        
        // --- Volumetric lighting?
        {
            //vec3 normal = vec3(0.);
            
            //vec2 intersections = iSphere( rayOrigin, rayDirection, vec3(0.), orbRadius );
            //if (intersections.x > 0.)
           // {
             //   normal = normalize(rayOrigin + rayDirection * intersections.x);
            //}
            
            //vec4 vol = getVolumetricLighting( 
             //   normal,  
              //  orbRadius + .005,
               // hexcoreRadius * 1.3,
                //time);
            
            //colour += vec3(1.) * vol.x;
        }
        
        // vignetting
        colour *= 1. - .25*dot(uv, uv);

        // gamma        
        tot += pow(colour,vec3(.45));
        
    // if ssaa is on, take the average of the samples
    #if SSAA >1
    }
    tot /= float(SSAA*SSAA);
    #endif
    
    // dithering
    tot += (1./512.)*(sin(fragCoord.y*111.0) * sin(fragCoord.x*125.546));

    fragColor = vec4(tot,1.0);
}
