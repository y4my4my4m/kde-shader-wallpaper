// by: Christiano300
// url: https://www.shadertoy.com/view/mlccDl

vec3 palette( float t ) {
    vec3 a = vec3(0.718, 0.761, 0.698);
    vec3 b = vec3(0.424, 0.297, 0.626);
    vec3 c = vec3(1.998, 1.499, 0.913);
    vec3 d = vec3(1.198, -0.115, -0.113);
    
    return a + b*cos( 6.28318*(c*t+d) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = (fragCoord * 2. - iResolution.xy) / iResolution.y;
    vec2 uv0 = uv;
    vec3 finalColor = vec3(0.0);
    
    for (float i = 0.0; i < 4.; i++) {

        uv = fract(.6432 * uv * (sin(iTime * .53843276) / 1.3 + 1.5)) - .5;

        float d = length(uv) * exp(-length(uv0));

        vec3 col = palette(length(uv0) + i * .4 + iTime * .4);

        d = sin(d * 8. + iTime) / 8.;
        d = abs(d);

        d = pow(.007 / d, 1.2);

        finalColor += col * d;
    }
    
    fragColor = vec4(finalColor, 1.);
}
