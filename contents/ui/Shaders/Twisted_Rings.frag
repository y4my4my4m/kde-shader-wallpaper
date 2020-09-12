// https://www.shadertoy.com/view/Xtj3DW
// Credits to Pol Jeremias - pol/2015

// Created by Pol Jeremias - pol/2015
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define SOUND_MULTIPLIER 2.0

float drawCircle(float r, float polarRadius, float thickness)
{
	return 	smoothstep(r, r + thickness, polarRadius) -
        	smoothstep(r + thickness, r + 2.0 * thickness, polarRadius);
}

float sin01(float v)
{
	return 0.5 + 0.5 * sin(v);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;

    float rstandard = SOUND_MULTIPLIER * texture( iChannel0, vec2(0.1, 0.0) ).x;

    // Center the coordinates and apply the aspect ratio
    vec2 p = uv - vec2(0.5) + vec2(0.05, 0.05) * rstandard;
    p.x *= iResolution.x / iResolution.y;

    // Calculate polar coordinates
    float pr = length(p);
    float pa = atan(p.y, p.x); // * 3.0 / 3.14;

    // Retrieve the information from the texture
    float idx = (pa/3.1415 + 1.0) / 2.0;   // 0 to 1
    float idx2 = idx * 3.1415;             // 0 to PI

    // Get the data from the microphone
    vec2 react = sin(idx2) * SOUND_MULTIPLIER * texture( iChannel0, vec2(idx, 0.0) ).xy;

    // Draw the circles
    float o = 0.0;
    float inc = 0.0;

    for( float i = 1.0 ; i < 8.0 ; i += 1.0 )
    {
        float baseradius = 0.3 * ( 0.3 + sin01(rstandard + iTime * 0.2) );
        float radius = baseradius + inc;

        radius += 0.01 * ( sin01(pa * i + iTime * (i - 1.0) ) );

    	o += drawCircle(radius, pr, 0.008 * (1.0 + react.x * (i - 1.0)));

        inc += 0.005;
    }

    // Calculate the background color
    vec3 bcol = vec3(1.0, 0.22, 0.5 - 0.4*p.y) * (1.0 - 0.6 * pr * react.x);
    vec3 col = mix(bcol, vec3(1.0,1.0,0.7), o);
	fragColor = vec4(col, 1.0);
}
