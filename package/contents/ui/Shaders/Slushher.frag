void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    //timescale
    float angle = iTime * 0.1;
    vec2 uv = fragCoord / iResolution.xy * 2.0 - 1.0;
    //color
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
    
    float rotationAngle = angle;
    
    mat2 rotationMatrix = mat2(
        cos(rotationAngle), -sin(rotationAngle),
        sin(rotationAngle), cos(rotationAngle)
    );
    
    //iterations, ranges between 32 and 64 look nice
    for (float i = 0.0; i < 64.0; i += 1.0) {
        uv = abs(uv);
        //zoom
        uv -= 0.5;
        //i wouldnt change that one
        uv *= 1.1;
        uv = rotationMatrix * uv;
        uv = vec2(uv.x - (cos(iTime)) / 3.0, uv.y - (-sin(iTime)) / 4.0);
        length(uv + vec2(0.2, -0.3));
        length(uv + vec2(-0.2, 0.1));
    }
    //if you dont want it to be rgb you can remove color vector
    fragColor = vec4(vec3(length(uv)) * col, 1.0);
}
