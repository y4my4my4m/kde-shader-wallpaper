// https://www.shadertoy.com/view/XddBWs
// Credits to noxbuds


/////////////////////////////////////////////////
//                                             //
//                 CONSTANTS                   //
//                                             //
/////////////////////////////////////////////////
#define PI 3.14
#define TA 6.28
#define PH 1.57

/////////////////////////////////////////////////
//                                             //
//              NOISE GENERATION               //
//                                             //
/////////////////////////////////////////////////

// 2D value noise
float noisev(vec2 p)
{
    return fract(sin(p.x * 1234.0 + p.y * 2413.0) * 5647.0);
}

// Smoother noise
float noise(vec2 uv)
{
    // Noise vector
    vec2 nv = vec2(0.0);

    // Local positions
    vec2 lv = fract(uv);
    vec2 id = floor(uv);

    // Interpolate lv
    lv = lv * lv * (3.0 - 2.0 * lv);

    // Calculate each corner
    float bl = noisev(id);
    float br = noisev(id + vec2(1, 0));
    float tl = noisev(id + vec2(0, 1));
    float tr = noisev(id + vec2(1, 1));

    // Interpolate values
    float b = mix(bl, br, lv.x);
    float t = mix(tl, tr, lv.x);
    float n = mix(b, t, lv.y);

    // Return n
    return n;
}

// FBM function
float fbm(vec2 p)
{
    float f = 0.0;
    f += 0.5000 * noise(p); p *= 2.01;
    f += 0.2500 * noise(p+vec2(0.0, 1.0)); p *= 2.02;
    f += 0.1250 * noise(p+vec2(1.0, 0.0)); p *= 2.03;
    f += 0.0625 * noise(p+vec2(1.0, 1.0)); p *= 2.04;
    f /= 0.9375;
    return f;
}

/////////////////////////////////////////////////
//                                             //
//             HYPERSPACE EFFECT               //
//                                             //
/////////////////////////////////////////////////

// Calculates the hyperspace tunnel at uv
vec3 tunnel(vec2 uv)
{
    // Setup colour
    vec3 col = vec3(0.0);

    // Calculate polar co-ordinates
    float r = 0.5 / length(uv) + iTime;
    float mr = mod(r + 1000.0, 700.0);
    if (mr < 400.0)
        mr += 400.0;
    float theta = atan(uv.x, uv.y);

    // Calculate the colour
    // Convert the new polar co-ordinates to cartesian
    vec2 ptc = vec2(mr * cos(theta / TA), mr * sin(theta / TA));

    // Then create some noise
    float snv = fbm(ptc * 2.0);
    if (snv > 0.8)
        col = vec3(1.0);

    // Then make the tunnel. Use two noise values,
    // which are mirrors of each other. Use a small
    // value added to theta to prevent artifacts.
    float fbm1 = fbm(vec2( r, mod(theta + 0.001, PI) ));
    float fbm2 = fbm(vec2( r, PI - mod(theta - 0.001, PI) ));

    // Change fbm1 and fbm2 to make more contrast
    fbm1 = pow(fbm1, 2.0);
    fbm2 = pow(fbm2, 2.0);

    // More mirrored noise for colouring
    float fbm3 = fbm(vec2( r, mod(theta + 0.001, PI) ) * 2.0);
    float fbm4 = fbm(vec2( r, PI - mod(theta - 0.001, PI) ) * 2.0);

    // Colours for the tunnel
    vec3 tc1 = vec3(0.0, 1.0, 0.5);
    vec3 tc2 = vec3(0.0, 0.5, 1.0);

    // Set the noise value based on the angle
    if (theta > 0.0)
        col = mix(col, mix(tc1, tc2, fbm4), fbm2);
    else
        col = mix(col, mix(tc1, tc2, fbm3), fbm1);

    // Return colour
    return col;
}

// Calculates the pixel at uv
vec3 calcPixel(vec2 uv)
{
    // Correct the UV co-ordinates
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    // Setup colour
    vec3 col = vec3(0.0);

    // Draw the tunnel
    col = tunnel(uv);

    // Return colour
    return col;
}

/////////////////////////////////////////////////
//                                             //
//              IMAGE PROCESSING               //
//                                             //
/////////////////////////////////////////////////
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Setup colour
    vec3 col = vec3(0.0);

    // Do some supersampling
    for (float x = -1.0; x < 2.0; x += 0.5)
    {
        for (float y = -1.0; y < 2.0; y += 0.5)
        {
            // Calculate pixel here
            vec3 pixel = calcPixel((fragCoord + vec2(x, y)) / iResolution.xy);

            // Add it, and make a bloom effect
            col += pixel;
        }
    }

    // Average it out
    col /= 16.0;

    // Output to screen
    fragColor = vec4(col,1.0);
}
