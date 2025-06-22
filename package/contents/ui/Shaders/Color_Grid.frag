// https://www.shadertoy.com/view/4dBSRK
// Credits to inigo quilez - iq/2014

// Created by inigo quilez - iq/2014
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2  px = 4.0*(-iResolution.xy + 2.0*fragCoord.xy) / iResolution.y;

    float id = 0.5 + 0.5*cos(iTime + sin(dot(floor(px+0.5),vec2(113.1,17.81)))*43758.545);

    vec3  co = 0.5 + 0.5*cos(iTime + 2.0*id + vec3(0.0,1.0,2.0) );

    vec2  pa = smoothstep( 0.0, 0.2, id*(0.5 + 0.5*cos(6.2831*px)) );

    fragColor = vec4( co*pa.x*pa.y, 1.0 );
}
