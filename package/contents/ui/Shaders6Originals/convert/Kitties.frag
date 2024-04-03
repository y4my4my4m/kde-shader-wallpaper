// From https://www.shadertoy.com/view/7lcyz8
// Credits to Xibanya

// designs inspired by https://www.freepik.com/premium-vector/cute-cats-collection-cats-faces_10120615.htm
// comment this out to get four rows of procgen cats rather than 2
// #define BIGGER




#define PUPIL vec3(0.18, 0.17, 0.165)
#define CAT_BASE_1 vec3(0.9, 0.77, 0.55)
#define CAT_BASE_2 vec3(0.4, 0.37, 0.37)
#define CAT_BASE_3 vec3(0.7, 0.6, 0.5)
#define CAT_BASE_4 vec3(0.7, 0.6, 0.5)
#define CAT_BASE_5 vec3(0.9, 0.9, 0.83)
#define CAT_LIGHT_1 vec3(0.97, 0.9, 0.7)
#define CAT_LIGHT_2 vec3(1., 0.95, 0.97)
#define CAT_LIGHT_3 vec3(1., 0.95, 0.85) 
#define CAT_LIGHT_4 vec3(1., 0.96, 0.78)
#define CAT_LIGHT_5 vec3(0.9, 0.9, 0.83)
#define CAT_DARK_1 vec3(0.7, 0.5, 0.4)
#define CAT_DARK_2 vec3(0.25, 0.2, 0.2)
#define CAT_DARK_3 vec3(0.5, 0.4, 0.35)
#define CAT_DARK_4 vec3(0.5, 0.4, 0.35)
#define CAT_DARK_5 vec3(0.44, 0.37, 0.36)
#define CAT_OUTLINE_1 vec3(0.37, 0.2, 0.13)
#define CAT_OUTLINE_2 vec3(0.18, 0.18, 0.16)
#define CAT_OUTLINE_3 vec3(0.35, 0.3, 0.26)
#define CAT_OUTLINE_4 vec3(0.35, 0.3, 0.26)
#define CAT_OUTLINE_5 vec3(0.35, 0.3, 0.26)
#define CAT_EYE_1 vec3(1.)
#define CAT_EYE_2 vec3(0.8, 0.76, 0.38)
#define CAT_EYE_3 vec3(0.6, 0.86, 0.9)
#define CAT_EYE_4 vec3(0.6, 0.86, 0.9)
#define CAT_EYE_5 vec3(0.9)
#define CAT_BELLY_1 vec3(0.97, 0.9, 0.7)
#define CAT_BELLY_2 vec3(1., 0.95, 0.97)
#define CAT_BELLY_3 vec3(0.7, 0.6, 0.5) * 1.1
#define CAT_BELLY_4 vec3(1., 0.96, 0.78)
#define CAT_BELLY_5 vec3(0.9, 0.9, 0.83)

#define TABBY_SPOT 0.075

#define MAX_ROTATION 150.
#define MIN_ROTATION -150.
#define MAX_EAR_DOWN 225.
#define MAX_EAR_UP 195.

#ifdef BIGGER
    #define OUTLINE_THICKNESS 0.04
#else
    #define OUTLINE_THICKNESS 0.02
#endif
#define OUTLINE_THRESHOLD 0.7

struct Cat {
    float butt; // width of the lower end of the body
    float height; // body length
    float rotation; // body rotation in degrees
    vec3 baseColor;
    vec3 lightColor;
    vec3 darkColor;
    vec3 outlineColor;
    vec3 eyeColor;
    vec3 belly;
    float f; // this is to cache the FBM noise value
    float r; // progress from min rotation value to max rotation value from 0 to 1
    float faceDark;
    float heart;
    float spots;
    float tabby;
    int type;
};
mat2 Rotate2DMatrix(float a)
{
    float ca = cos(a);
    float sa = sin(a);
    return mat2(ca, -sa, sa, ca);
}
vec2 Rotate2D(vec2 p, float a)
{
    return Rotate2DMatrix(radians(a)) * p;
}
vec3 DoOutline(float d, vec3 color, float thickness, vec3 outColor)
{
    if (d < 0.)
    {
        float t = -d / thickness;
        t = t * t;
        color = mix(outColor, color, step(OUTLINE_THRESHOLD, t));
    }
    return color;
}
float InvLerp(in float from, float to, float value)
{
    return (value - from) / (to - from);
}
vec2 interpolate(vec2 a, vec2 b, vec2 c, vec2 d, float p)
{
    vec2 v0 = mix(a, b, p);
    vec2 v1 = mix(b, c, p);
    vec2 v2 = mix(c, d, p);
    vec2 v3 = mix(v0, v1, p);
    vec2 v4 = mix(v1, v2, p);
    
    return mix(v3, v4, p);
}
float Spline(in vec2 p, in vec2 a, in vec2 b)
{
    vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa,ba) / dot(ba,ba), 0., 1.);	
	return length(pa - ba * h);
}
// 2D SDF functions from https://iquilezles.org/articles/distfunctions2d/
float dot2( in vec2 v ) { return dot(v,v); }
float dot2( in vec3 v ) { return dot(v,v); }
float Heart( in vec2 p )
{
    p.x = abs(p.x);

    if( p.y+p.x>1.0 )
        return sqrt(dot2(p-vec2(0.25,0.75))) - sqrt(2.0)/4.0;
    return sqrt(min(dot2(p-vec2(0.00,1.00)),
                    dot2(p-0.5*max(p.x+p.y,0.0)))) * sign(p.x-p.y);
}
float UnevenCapsule( vec2 p, float r1, float r2, float h )
{
    p.x = abs(p.x);
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(p,vec2(-b,a));
    if( k < 0.0 ) return length(p) - r1;
    if( k > a*h ) return length(p-vec2(0.0,h)) - r2;
    return dot(p, vec2(a,b) ) - r1;
}
float EquiTriSDF(in vec2 p)
{
    const float k = sqrt(3.0);
    p.x = abs(p.x) - 1.0;
    p.y = p.y + 1.0/k;
    if( p.x+k*p.y>0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
    p.x -= clamp( p.x, -2.0, 0.0 );
    return -length(p)*sign(p.y);
}
float Isosceles( in vec2 p, in vec2 q )
{
    p.x = abs(p.x);
    vec2 a = p - q*clamp( dot(p,q)/dot(q,q), 0.0, 1.0 );
    vec2 b = p - q*vec2( clamp( p.x/q.x, 0.0, 1.0 ), 1.0 );
    float s = -sign( q.y );
    vec2 d = min( vec2( dot(a,a), s*(p.x*q.y-p.y*q.x) ),
                  vec2( dot(b,b), s*(p.y-q.y)  ));
    return -sqrt(d.x)*sign(d.y);
}
float Egg( in vec2 p, in float ra, in float rb )
{
    const float k = sqrt(3.0);
    p.x = abs(p.x);
    float r = ra - rb;
    return ((p.y<0.0)       ? length(vec2(p.x,  p.y    )) - r :
            (k*(p.x+r)<p.y) ? length(vec2(p.x,  p.y-k*r)) :
                              length(vec2(p.x+r,p.y    )) - 2.0*r) - rb;
}
float Circle( vec2 p, float r )
{
    return length(p) - r;
}
float FBMRandom(vec2 st)
{
    vec2 m = vec2(iMouse.xy);
    return fract(sin(dot(st.xy, m + vec2(12.9898, 78.233))) *
                    43758.5453123);
}
Cat GetCat(vec2 uv)
{
    // declaring the arrays outside the function doesn't work on some platforms
    // so gotta do this rigamarole here
    vec3[5] base;
    base[0] = CAT_BASE_1; base[1] = CAT_BASE_2; base[2] = CAT_BASE_3; 
    base[3] = CAT_BASE_4; base[4] = CAT_BASE_5;

    vec3[5] light;
    light[0] = CAT_LIGHT_1; light[1] = CAT_LIGHT_2; light[2] = CAT_LIGHT_3; 
    light[3] = CAT_LIGHT_4; light[4] = CAT_LIGHT_5;

    vec3[5] dark;
    dark[0] = CAT_DARK_1; dark[1] = CAT_DARK_2; dark[2] = CAT_DARK_3; 
    dark[3] = CAT_DARK_4; dark[4] = CAT_DARK_5;

    vec3[3] eye;
    eye[0] = CAT_EYE_1; eye[1] = CAT_EYE_2; eye[2] = CAT_EYE_3;

    vec3[5] outline;
    outline[0] = CAT_OUTLINE_1; outline[1] = CAT_OUTLINE_2; outline[2] = CAT_OUTLINE_3; 
    outline[3] = CAT_OUTLINE_4; outline[4] = CAT_OUTLINE_5;

    vec3[5] belly;
    belly[0] = CAT_BELLY_1; belly[1] = CAT_BELLY_2;
    belly[2] = CAT_BELLY_3; belly[3] = CAT_BELLY_4;
    belly[4] = CAT_BELLY_5;

    Cat cat;

    vec2 cUV = floor(uv * 2.);

    float f = clamp(0., 1., FBMRandom(cUV));
    cat.f = f;
    int i = 0;
    float count = 5.;
    float mul = 1000.;
    float cF = fract(f + cUV.x + cUV.y * 0.5);
    if (mod(floor(cF * mul) + 1., count) == 0.) i = 1;
    else if (mod(floor(cF * mul) + 2., count) == 0.) i = 2; 
    else if (mod(floor(cF * mul) + 3., count) == 0.) i = 3; 
    else if (mod(floor(cF * mul) + 4., count) == 0.) i = 4;

    cat.type = i;
    
    cat.baseColor = base[i];
    cat.lightColor = light[i];
    cat.darkColor = dark[i];
    cat.outlineColor = outline[i];
    cat.belly = belly[i];
    cat.eyeColor = mod(floor(f * 100.), 3.) == 0.? eye[0] : 
        (mod(floor(f * 100.) + 1., 3.) == 0.? eye[1] : eye[2]);

    cat.rotation = mix(MIN_ROTATION, MAX_ROTATION, fract(f + cUV.x * 0.3));
    cat.r = InvLerp(MIN_ROTATION, MAX_ROTATION, cat.rotation);
    cat.height = mix(0.5, 1., fract(f + 0.5 + cUV.y));
    cat.butt = mix(0.7, 0.9, abs(f * 2. - 1.));
   
    cat.faceDark = mod(floor((1. - cat.f) * 5.), 4.) == 0.? 1. : 0.;
    cat.heart = mod(floor(fract(cat.f + 0.75) * 10.), 2.) == 0.? 1. : 0.;
    cat.spots = mod(floor(cat.f * 1450.), 2.) == 0.? 1. : 0.;
    cat.tabby = mod(floor(fract(cat.f + 0.25) * 1329.), 3.) == 0.? 1. : 0.;
    return cat;
}
float Smooth(float sdf) { return 1. - smoothstep(-0.025, -0.01, sdf);}
float TopMarks(vec2 headUV)
{
    float xSign = sign(headUV.x);  
    vec2 mUV = headUV * vec2(7., 1.) + vec2(0., 2.);
    float markScale = 1.;
    float mSDF = Circle(mUV, markScale);

    vec2 mUV1 = Rotate2D(headUV, 16. * xSign);
    mUV1 = mUV1 * vec2(10., 1.) + vec2(-1. * -xSign, 2.2);
    mSDF = min(mSDF, Circle(mUV1, markScale));
    return mSDF;
}
float HeartMark(vec2 headUV)
{
    vec2 heartUV = headUV * vec2(0.15, 0.2) + vec2(0., 1.05);
    return Heart(heartUV);
}
void HeadMarkings(vec2 p, Cat cat, inout vec3 col)
{
    float xSign = sign(p.x);
    vec3 light = mix(cat.lightColor * 1.1, cat.lightColor, 
        clamp(0., 1., dot(p, p)));
    if (cat.heart == 1.)
    {
        float heartSDF = HeartMark(p);
        col = heartSDF < 0.? col : light;
    }
   
    if (cat.faceDark == 1.)
    {
        float spots = 0.;
        vec3 sColor = cat.darkColor;
        if (cat.spots == 1.)
        {
            float w =  sin(p.x * 50.) * 0.025;
            vec2 stUV = p + vec2(1., 1.4);
            stUV.y += w;
            spots = Circle(stUV * vec2(1., 1.2), 1.2);
            stUV -= vec2(2.3, 0.1);
            spots = min(spots, Circle(Rotate2D(stUV, 25.) * vec2(1., 1.75), 0.75));
            if (cat.heart == 0.)
            {
                stUV = p - vec2(0.8, 1.4);
                stUV.y += w * 0.2;
                stUV.x *= 0.7;
                spots = min(spots, Circle(stUV, 0.75));
            }
            if (cat.tabby == 1.) sColor += TABBY_SPOT;
        }
        else
        {
            vec2 sideUV = p - vec2(1.6 * xSign, -0.9);
            spots = Circle(sideUV, 1.5);
        }
         col = mix(col, sColor, Smooth(spots));
    }
    if (cat.tabby == 1.)
    {
        float mSDF = TopMarks(p);
        col = mix(col, cat.darkColor, Smooth(mSDF));
    }
    if (mod(floor(cat.f * 1000.), 2.) == 0.)
    {
        float muzzle = Isosceles(p * 3. + vec2(0., 0.1), vec2(0.9, 1.)) - 1.;
        col = mix(col, light, Smooth(muzzle));
    }
}
void Eyes(vec2 headUV, Cat cat, inout vec3 col)
{
    float xSign = sign(headUV.x);  
    vec2 eyeUV = headUV + vec2(0., 0.5);
    eyeUV.x -= 0.8 * xSign;

    // blinky blinky
    float t = sin(iTime * max(0.5, cat.f) + cat.f) * 0.5 + 0.5;
    float b = smoothstep(0., 1., InvLerp(0.999, 1., t));
    eyeUV.y = mix(eyeUV.y, eyeUV.y * 7., b);

    float eyeScale = mix(0.5, 0.55, cat.f);
    float eyeSDF = Circle(eyeUV, eyeScale);
    vec3 eyeCol = cat.eyeColor;
    float pupil = Circle(eyeUV, eyeScale * 0.75);
    eyeCol = mix(eyeCol, PUPIL, Smooth(pupil));
    vec2 shineUV = eyeUV + vec2(0.2, 0.15);
    float shine = Circle(shineUV, eyeScale * 0.3);
    shine = min(shine, Circle(shineUV + vec2(0.1, -0.2), eyeScale * 0.15));
    eyeCol = mix(eyeCol, vec3(1.), Smooth(shine));
    vec2 lidUV = eyeUV * vec2(1., 0.95) + vec2(0., 0.05);
    lidUV.y = mix(lidUV.y, lidUV.y * 0.95 - 0.02, b);
    float lid = Circle(lidUV, eyeScale);
    vec3 lidColor = cat.faceDark == 1.? cat.outlineColor : cat.darkColor;
    eyeCol = mix(lidColor, eyeCol, Smooth(eyeSDF));
    eyeSDF = min(eyeSDF, lid);
    col = mix(col, eyeCol, Smooth(eyeSDF));
}
float Head(vec2 p, Cat cat, out vec3 col)
{
    float headHeight = cat.height * 1.2;
    float headScale = 2.5;
    vec2 headUV = (p - vec2(0., headHeight)) * headScale;
    headUV = Rotate2D(headUV, -cat.rotation);
    headUV.y *= -1.;
    float xSign = sign(headUV.x);  
    float headSDF = Egg(headUV, 2., 3.) + 0.1;
    vec2 huv = headUV + vec2(0., 0.);
    col = mix(cat.baseColor * 1.2, cat.baseColor, 
        smoothstep(0., 1.5, dot(huv, huv)));

    // markings
    HeadMarkings(headUV, cat, col);

    //Ears
    vec2 earUV = headUV;
    earUV.x -= 1.1 * xSign;
    earUV.y += 1.1;
    float earRot = mix(MAX_EAR_DOWN, MAX_EAR_UP, fract(cat.f * 25.));
    float earTip = 1.;
    if (mod(floor(cat.f * 0.35 * 1000.), 3.) == 0.) earTip = 0.75;
    earUV = Rotate2D(earUV, earRot * xSign);
    float ear = Egg(earUV, 2., earTip) + 1.2;
    vec3 earColor = cat.darkColor;
    earUV = Rotate2D(earUV, -5. * xSign);
    float earNeg = Egg(earUV * vec2(1.1, 1.) + vec2(0.2 * xSign, 0.), 2., 1.) + 1.4;
    earColor = mix(earColor, cat.lightColor, Smooth(earNeg));
    col = mix(earColor, col, Smooth(headSDF));
    headSDF = min(headSDF, ear);
   
    // nose
    vec3 noseColor = cat.outlineColor;
    float noseScale = 8.;
    vec2 noseUV = headUV;
   
    float bridge = Isosceles(noseUV * noseScale + vec2(0., 2.3), 
        vec2(0.7, 2.5)) - .75;
    vec3 bridgeCol = cat.darkColor;
    if (cat.type == 1) bridgeCol = cat.baseColor;
    else if (mod(floor(cat.f * 2324321.), 2.) == 0.)
    {
        bridgeCol = cat.baseColor * 1.1;
    }
    col = mix(col, bridgeCol, Smooth(bridge));

    noseUV *= vec2(1., -1.);
    noseUV.y += 0.2;
    float noseSDF = Isosceles(noseUV * noseScale, vec2(1.1, 0.8)) - .5;
    col = mix(col, noseColor, Smooth(noseSDF));

    // Eyes
    Eyes(headUV, cat, col);

    // Mouth
    vec2 mouthUV = headUV - vec2(0., 0.3);
    mouthUV.x *= 0.8;
    mouthUV.x -= 0.19 * xSign;
    float mouthScale = 0.2;
    float mouth = Circle(mouthUV, mouthScale);
    mouthUV = mouthUV * vec2(1.2, 0.9) + vec2(0., 0.1);
    mouth = max(mouth, -Circle(mouthUV, mouthScale));
    col = mix(col, cat.outlineColor, Smooth(mouth));

    // head outline before whiskers
    col = DoOutline(headSDF, col, OUTLINE_THICKNESS * headScale, cat.outlineColor);

    // whiskers
    vec2 wUV = headUV;
    wUV.x -= 2. * xSign;
    wUV.y -= 1.;
    float wScale = 1.2;
    float whisker = Circle(wUV, wScale);
    vec2 wUV2 = wUV * vec2(0.8, 1.) - vec2(0.1 * xSign, 0.075);
    whisker = max(whisker, -Circle(wUV2, wScale));

    wUV.x += 0.35 * xSign;
    wUV.y -= 0.25;
    float w2 = Circle(wUV, wScale);
    wUV2 = wUV * vec2(0.8, 1.) + vec2(0.1 * xSign, -0.075);
    w2 = max(w2, -Circle(wUV2, wScale));
    whisker = min(whisker, w2);

    wUV.x += 0.1 * xSign;
    wUV.y -= 0.15;
    w2 = Circle(wUV, wScale);
    wUV2 = wUV * vec2(0.75, 1.) + vec2(0.2 * xSign, -0.05);
    w2 = max(w2, -Circle(wUV2, wScale));
    whisker = min(whisker, w2);

    col = whisker < 0.? cat.outlineColor : col;

    headSDF = min(headSDF, whisker);
    return headSDF;
}
float Tail(vec2 uv, Cat cat)
{
    float rSign = sign(cat.rotation);
    float xMul = cat.r * 2. - 1.;
    float invX = 1. - abs(xMul);
    float t = (sin(iTime * cat.f + cat.f) * 0.5 + 0.5);

    vec2 a = vec2(0., 0.6);
    vec2 b = vec2(1. * xMul * t, 1. * abs(xMul));
    vec2 c = vec2((-0.5 + 0.5 *invX) * xMul + 1.5 * invX + t * 0.5, 1. - 0.5 * invX);
    vec2 d = vec2((0.3 + 0.5 * invX) * xMul * t, 1.5 + 0.15 * abs(xMul) * t * 2.);

    float tail = 0.;
    const float STEPS = 20.;
    for (float i = 0.; i < STEPS; ++i)
    {
        vec2  p0 = interpolate(a, b, c, d, (i   ) / STEPS);
        vec2  p1 = interpolate(a, b, c, d, (i+1.) / STEPS);
        float l = Spline(uv, p0, p1) - 0.1;
        tail = min(tail, l);
    }   
    return tail;
}
void BackPattern(vec2 p, Cat cat, inout vec3 col)
{
    float r = cat.r * 2. - 1.;
    float aR = abs(r);
    float rSign = sign(r);
    
    //spots
    if ((cat.spots == 1. || cat.faceDark == 1.))
    {
        vec2 spotUV = p * 7.;
        spotUV.y += mix(10., 2., aR) * rSign;
        spotUV.x += mix(-10., -3., aR) * rSign;

        // if smooth face marks, spots should also be smooth
        if (cat.spots == 1.) spotUV.y += sin(spotUV.x * 10.) * 0.1;
       
        float spot = EquiTriSDF(spotUV) - 2.;
        spot = min(spot, EquiTriSDF(spotUV * 2. + 
            vec2(10. * rSign + 10. * step(rSign, 0.), 6. + 5. * step(rSign, 0.))) - 2.);

        vec3 spotColor = cat.darkColor;
        if (cat.tabby == 1.) spotColor += TABBY_SPOT;
        
        col = spot < 0.? spotColor : col;
    }
    
    // tabby stripes
    if (cat.tabby == 1.)
    {
        float xSign = sign(p.x);
        vec2 uv = p;
        
        if (rSign > 0.)
        {
            uv.x += mix(-2., -.05, aR);
            uv = Rotate2D(uv, 25. * aR);
        }
        else if (rSign < 0.)
        {
            uv.x += mix(2., 0.5, aR);
            uv = Rotate2D(uv, -50. * aR);
        }
        uv *= vec2(1., 8.);
        float l = Circle(uv, 0.5);
        l = min(l, Circle(uv + vec2(0., 1.5), 0.5));
        l = min(l, Circle(uv - vec2(0, 1.5), 0.5));
        col = l < 0.? cat.darkColor : col;
    }
}
float SceneSDF(vec2 p, out vec3 col)
{
    Cat cat = GetCat(p);
    p = fract(p * 2.) - 0.5;
    #ifdef BIGGER
    float scale = 4.;
    p.y += 0.1;
    #else
     float scale = 4.5;
    #endif
    
    vec2 bodyUV = p * scale;
   
    col = mix(cat.baseColor, cat.baseColor * 1.2, dot(bodyUV, bodyUV) * 0.5 + 0.5);
    cat.rotation += mix(-10., 10., cos(iTime * 0.2 * cat.f + (cat.f * 2. - 1.)) * 0.5 + 0.5);
    bodyUV = Rotate2D(bodyUV, cat.rotation);
    float sdf = UnevenCapsule(bodyUV, cat.butt, 0.5, cat.height);

    BackPattern(bodyUV, cat, col);

    vec2 bellyUV = bodyUV;
    bellyUV.y += sin(bodyUV.x * 75.) * 0.025;
    float b = InvLerp(-90., 90., cat.rotation);
    float bX = 0.75;
    bellyUV.x += mix(-bX, bX, b);
    bellyUV.y += mix(-0.1, 0.1, b);
    float width = mix(0.7, 0.5, abs(b * 2. - 1.));
    float belly = UnevenCapsule(bellyUV * 1.5, width, 0.5, cat.height) - 0.2;
    col = mix(col, cat.belly, Smooth(belly));
    col = DoOutline(sdf, col, OUTLINE_THICKNESS, cat.outlineColor);

    // head casting shadow on the body
    float shadow = Circle(bodyUV - vec2(0., cat.height * 1.1), 0.5);
    col = shadow < 0.? col * 0.9 : col;

    vec3 headCol;
    float headSDF = Head(bodyUV, cat, headCol);
    col = headSDF < 0.? headCol : col;
    sdf = min(sdf, headSDF);

    float tail = Tail(p * scale, cat);
    vec3 tailCol = DoOutline(tail, cat.baseColor, OUTLINE_THICKNESS, cat.outlineColor);
    col = sdf < 0.? col : tailCol;
    sdf = min(sdf, tail);
    
    // body casting shadow on the floor
    vec2 sUV = Rotate2D(bodyUV, -cat.rotation);
    sUV = sUV * vec2(1., 3.) + vec2(0., 1.7);
    shadow = Circle(sUV, 1.);
    vec3 shadowCol = mix(vec3(1.), vec3(0.7), 
        (1. - smoothstep(-0.5, -0.001, shadow)));
    col = sdf < 0.? col : shadowCol;
    sdf = min(sdf, shadow);

    return sdf;
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    p.x += (iTime + 3000.) * 0.25;
    #ifdef BIGGER
        // adjusting for how it looks different in shadertoy 
        // than from VSCode where I authored this...
        p *= 0.5;
        p.y += 0.01;
    #else
        p.y += 0.025;
    #endif

    vec3 col = vec3(1.);
    vec3 fg = vec3(0.);
    
    float sdf = SceneSDF(p, fg);
    col = sdf < 0.? fg : col;
	fragColor = vec4(col,1.0);
}