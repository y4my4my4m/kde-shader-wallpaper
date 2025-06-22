// https://www.shadertoy.com/view/Xt2cDt
// Credits to DrLuke

// This work is licensed under a Creative Commons Attribution 4.0 International License.
// https://creativecommons.org/licenses/by/4.0/

// Inspiration: http://kingsanda.tumblr.com/post/166772103767

#define LASERCOL vec3(1., 0.1, 0.1)

float notsosmoothstep(float edge0, float edge1, float x)
{
    x = clamp((x - edge0)/(edge1 - edge0), 0.0, 1.0);
    return mix(x*x*(3. - 2.*x), x, 0.6);
}

#define horiz(s, e, p) if(s.x < p.x && p.x <= e.x) return mix(s.y, e.y, notsosmoothstep(0., 1., (p.x - s.x) / (e.x - s.x)));
float horizonHeight1(vec2 pos)
{
    horiz( vec2(-1, 0.1), vec2(-0.9, 0.3), pos );
    horiz( vec2(-0.9, 0.3), vec2(-0.75, 0.5), pos );
    horiz( vec2(-0.75, 0.5), vec2(-0.6, 0.2), pos );
    horiz( vec2(-0.6, 0.2), vec2(-0.3, 0.25), pos );
    horiz( vec2(-0.3, 0.25), vec2(-0., 0.2), pos );
    horiz( vec2(-0., 0.2), vec2(.1, 0.3), pos );
    horiz( vec2(.1, 0.3), vec2(.24, 0.32), pos );
    horiz( vec2(.24, 0.32), vec2(.3, 0.3), pos );
    horiz( vec2(.3, 0.3), vec2(.34, 0.32), pos );
    horiz( vec2(.34, 0.32), vec2(.36, 0.31), pos );
    horiz( vec2(.36, 0.31), vec2(.4, 0.27), pos );
    horiz( vec2(.4, 0.27), vec2(.47, 0.23), pos );
    horiz( vec2(.47, 0.23), vec2(.6, 0.15), pos );
    horiz( vec2(.6, 0.15), vec2(.8, 0.3), pos );
    horiz( vec2(.8, 0.3), vec2(1., 0.2), pos );
}

float horizonHeight2(vec2 pos)
{
    #define P21 vec2(-1, 0.1)
    #define P22 vec2(-0.93, 0.03)
    #define P23 vec2(-0.8, -0.3)
    #define P24 vec2(-0.7, -0.35)
    #define P25 vec2(-0.3, 0.05)
    #define P26 vec2(-0.1, -0.05)
    #define P27 vec2(-0.03, -0.02)
    #define P28 vec2(-0., 0.07)
    #define P29 vec2(0.05, 0.1)
    #define P210 vec2(0.1, 0.14)
    #define P211 vec2(0.25, 0.1)
    #define P212 vec2(0.4, 0.24)
    #define P213 vec2(0.5, 0.2)
    #define P214 vec2(0.7, 0.3)
    #define P215 vec2(0.8, 0.1)
    #define P216 vec2(0.88, 0.14)
    #define P217 vec2(1., -0.1)

    horiz( P21, P22, pos );
	horiz( P22, P23, pos );
    horiz( P23, P24, pos );
    horiz( P24, P25, pos );
    horiz( P25, P26, pos );
    horiz( P26, P27, pos );
    horiz( P27, P28, pos );
    horiz( P28, P29, pos );
    horiz( P29, P210, pos );
    horiz( P210, P211, pos );
    horiz( P211, P212, pos );
    horiz( P212, P213, pos );
    horiz( P213, P214, pos );
    horiz( P214, P215, pos );
    horiz( P215, P216, pos );
    horiz( P216, P217, pos );
}

float horizonHeight3(vec2 pos)
{
    #define P31 vec2(-1, -0.04)
    #define P32 vec2(-0.93, -0.03)
    #define P33 vec2(-0.8, 0.05)
    #define P34 vec2(-0.7, 0.07)
    #define P35 vec2(-0.6, 0.04)
    #define P36 vec2(-0.4, -0.1)
    #define P37 vec2(0.5, -0.1)
    #define P38 vec2(0.72, 0.32)
    #define P39 vec2(0.78, 0.32)
    #define P310 vec2(0.81, 0.26)
    #define P311 vec2(0.85, 0.3)
    #define P312 vec2(0.92, 0.34)
    #define P313 vec2(1., 0.4)


    horiz( P31, P32, pos );
	horiz( P32, P33, pos );
    horiz( P33, P34, pos );
    horiz( P34, P35, pos );
    horiz( P35, P36, pos );
    horiz( P36, P37, pos );
    horiz( P37, P38, pos );
    horiz( P38, P39, pos );
    horiz( P39, P310, pos );
    horiz( P310, P311, pos );
    horiz( P311, P312, pos );
    horiz( P312, P313, pos );

}

// Thanks to izutionix
float grid(vec2 uv)
{
    #define VANTAGE vec2(0,-0.21)
    uv = uv - VANTAGE;
    float m = max(sign(-uv.y),0.); //mask

    uv /= 1.; //zoom
    float d = -1./uv.y; //depth
    vec2 pv = vec2(uv.x*d, d); //perspective
    pv *= 1.4545; //scale
    pv.y += iTime; //offset

	// http://iquilezles.org/www/articles/filterableprocedurals/filterableprocedurals.htm
    const float N = 16.;
    vec2 w = fwidth(pv) + 0.001;
    vec2 a = pv + 0.5*w;
    vec2 b = pv - 0.5*w;
    vec2 i = (floor(a)+min(fract(a)*N,1.0)-floor(b)-min(fract(b)*N,1.0))/(N*w);
    return (i.x + i.y - i.x*i.y)*m;
}

float gridAA(vec2 uv)
{
    #define Xsamps 2
    #define Ysamps 2
    #define Xoff (1./float(2*Xsamps + 1)*float(i))
    #define Yoff (1./float(2*Ysamps + 1)*float(j))
    #define PXSIZE ( (vec2(1) / iResolution.xy) * (iResolution.x/iResolution.y) )

    float v = 0.0;
    for(int i=-Xsamps; i <= Xsamps; i++)
    for(int j=-Ysamps; j <= Ysamps; j++)
    {
        v += grid(uv + vec2(Xoff, Yoff) * PXSIZE);
    }

    return v / float((2*Xsamps + 1) * (2*Ysamps + 1));
}


float burst1(vec2 uv)
{
    return clamp(-uv.y+0.3-abs(uv.x*0.1), 0., 1.);
}

float burst2(vec2 uv)
{
    return clamp(-uv.y+0.8-abs(uv.x*0.1), 0., 1.);
}

float burst3(vec2 uv)
{
    return clamp(-uv.y+0.1+cos(uv.x*0.5), 0., 1.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uvo = (fragCoord.xy * 2. / iResolution.xy) - vec2(1);
	vec2 uv = uvo * vec2(iResolution.x/iResolution.y, 1);	// uv coordinates with corrected aspect ratio



    float bmask = 0.0;
    #define sunmaskfeather (7. / iResolution.y)
    float sunmask1 = smoothstep(-sunmaskfeather, sunmaskfeather, uvo.y - horizonHeight1(uvo)*0.8 + 0.15);
    bmask += sunmask1 * burst1(uvo);
    float sunmask2 = smoothstep(-sunmaskfeather, sunmaskfeather, uvo.y - horizonHeight2(uvo) - 0.42);
    bmask += sunmask1 * sunmask2 * burst2(uvo);
    float sunmask3 = smoothstep(-sunmaskfeather, sunmaskfeather, uvo.y - horizonHeight3(uvo) - 0.36);
    bmask += sunmask1 * sunmask2 * sunmask3 * burst3(uvo);

    bmask *= 1.-texture(iChannel0, fragCoord.xy/iChannelResolution[0].xy).r*0.4*pow((0.9-bmask*0.9), 2.);

    fragColor.rgb = bmask*LASERCOL;

    float g = gridAA(uv);
    g *= 1.-texture(iChannel0, fragCoord.xy/iChannelResolution[0].xy).r*0.1*pow((0.9-bmask*0.9), 2.);
    fragColor.rgb += g*LASERCOL;

    fragColor.a = 1.0;
}
