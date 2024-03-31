// Url: https://www.shadertoy.com/view/stSfDt
// Credits: Wabrion

#define DRAW_GRID 01
#define DRAW_TRI 01
#define DRAW_POLAR_GRID 0

#define R    1.0
#define ZOOM 5.0
#define GLOW(r, d, i) pow(r/(d), i)
#define RX 1.0 / min(iResolution.x, iResolution.y)
#define CIRCLE(r, p) length(p) - abs(r)

mat2 rot2D(float angle, float clock) {

    float c = cos(angle);
    float s = sin(angle);

    return mat2(
        c, clock*s,
        -clock*s, c
    );

}

float plot(float p, float t) {                                                                  
                                                                                                                                        
    return 1.0 - smoothstep(t - RX * 1.5, t + RX * 1.5, p);

}

float gridp(float x, float t) {

    float k = 0.5;
    float f = fract(x);
    
    return smoothstep(k - t, k, f) * (1.0 - smoothstep(k, k + t, f));
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy - 0.5;
    float aspect = iResolution.x / iResolution.y;
    
    uv.x *= aspect;
    uv *= ZOOM;

    float t = -1.25*iTime;

    float pos = -0.1;

    /* -- Sin Wave -- */
    vec2 s = uv + vec2(pos + aspect, 0.0);
    float cMid = step(1.1, s.x);

    s.y += sin(s.x + 2.04 + t);

    /* -------------- */

    /* --- Circle --- */
    float cpos = 0.75;
    vec2 cc = uv + vec2(cpos + aspect, 0.0); // circle center

    vec2 rcc = cc * rot2D(t, 1.0); // rotated Circle Center
    vec2 dr  = rcc + vec2(-R, 0);  // Dot

    float len = step( abs(rcc.x), R );
    float side = step( 0.0, rcc.x*R );

    float diam = step( abs(cc.x), R );
    /* -------------- */

    /* --- Line ----- */
    float lpos = -1.2;
    vec2 l = uv + vec2(lpos + aspect, 0.0);

    float p = l.x + (-lpos + cpos) - cos(t);

    //float crop = step(-R*R, -dot(cc, cc)) + step(-1.0, -abs(cc.y)) * step(-1.7, -cc.x) * step(0.0, cc.x);
    //float siz = step(-1.0, dr.x);

    l.y -= sin(t);

    float len1 = step( 0.0, abs(l.x) );
    float side1 = step( 0.0, -p*l.x );

    /* -------------- */

    vec3 col = vec3(0);

#if DRAW_POLAR_GRID

    //#define PI_OVER_12 0.261799
    
    // Polar Grid
    vec2 polarGrid = vec2(
        fract(2.0*length(cc)),
        fract(atan(cc.y, cc.x) / 6.283185 * 20.0)
    );

    float cgrid = step(-1.1, -s.x);

    col = mix(
        col,
        vec3(0.25),
        max(plot(polarGrid.x, 0.025),
        plot(abs(cc.x), 0.01) +
        plot(abs(cc.y), 0.01) + 
        plot(abs(polarGrid.y), 0.04)) * cgrid
    );

#endif

#if DRAW_GRID

    vec2 grid = fract(1.25*cc + vec2(t, 0));

    // Grid
    col = mix(
        col,
        vec3(0.25),
        max(gridp(grid.x, 0.03), gridp(grid.y, 0.03)) * cMid
    );

#endif

    // Sine wave
    col = mix(
        col,
        1.0 + vec3(1.0, 0.0, 0.5),
        GLOW(0.0085, abs(s.y), 0.7) * cMid
    );

    // Circle
    col = mix(
        col,
        vec3(0.0157, 0.4275, 0.8431),
        GLOW(0.02, abs( CIRCLE(R, cc) ), 0.8)
    );

    // Radius
    col = mix(
        col,
        vec3(1),
        GLOW(0.01, abs(rcc.y), 1.4) * len * side
    );

#if DRAW_TRI

    float cropMidC = step(-sin(t), l.y) * step(0.0, -l.y) + step(sin(t), -l.y) * step(0.0, l.y);

    // Triangle
    col = mix(
        col,
        vec3(1),
        GLOW(0.01, abs(p), 1.4) * cropMidC
    );

    // Dot in the Diameter
    col = mix(
        col,
        vec3(1),
        plot( CIRCLE(0.04, cc - vec2(cos(t), 0)), 0.01 )
    );

#endif

    /* Dot in the center */
    col = mix(
        col,
        vec3(1),
        plot( CIRCLE(0.04, cc), 0.01 )
    );
    /* --------------------- */

    // Line
    col = mix(
        col,
        vec3(1),
        GLOW(0.01, abs(l.y), 1.4) * len1 * side1
    );

    /* Dot in the circunference */
    col = mix(
        col,
        vec3(0.0157, 0.4275, 0.8431),
        GLOW(0.008, CIRCLE(0.05, dr), 1.0)
    );

    col = mix(
        col,
        vec3(1),
        plot( CIRCLE(0.05, dr), 0.01 )
    );
    /* ------------------------- */

    //Separetor
    col = mix(
        col,
        vec3(1),
        GLOW(0.01, abs(l.x), 0.9)
    );

    /* Dot in the separator */
    float a = CIRCLE(0.05, l);

    col = mix(
        col,
        vec3(1.0, 0.0, 0.5),
        GLOW(0.0085, a, 1.0)
    );

    col = mix(
        col,
        vec3(1),
        plot( a, 0.01 )
    );
    /* -------------------- */

#if DRAW_TRI

    // Diameter
    col = mix(
        col,
        vec3(1),
        GLOW(0.01, abs(cc.y), 1.4) * diam
    );
    
    // Dots
    col = mix(
        col,
        vec3(1),
        plot( CIRCLE(0.04, cc + vec2(R, 0)), 0.01 ) +
        plot( CIRCLE(0.04, cc - vec2(R, 0)), 0.01 )
    );

#endif

    fragColor = vec4(col, 1);
}

