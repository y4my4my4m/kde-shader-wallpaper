// https://www.shadertoy.com/view/3ttSzr
// credits to nasana
void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    vec2 uv =  (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

    for(float i = 1.0; i < 8.0; i++){
        uv.y += i * 0.1 / i * 
        sin(uv.x * i * i + iTime * 0.5) * sin(uv.y * i * i + iTime * 0.5);
    }

    vec3 col = vec3(uv.y - 0.1, uv.y + 0.3, uv.y + 0.95);
    fragColor = vec4(col,1.0);
}