// https://www.shadertoy.com/view/4ddGzj
// Credits to jabudcha

const float speed = 0.4;
const float widthFactor = 2.0;

vec3 calcSine(vec2 uv,
              float frequency, float amplitude, float shift, float offset,
              vec3 color, float width, float exponent, bool dir)
{
    float angle = iTime * speed * frequency + (shift + uv.x) * 0.75;

    float y = sin(angle) * amplitude + offset;
    float clampY = clamp(0.0,y,y);
    float diffY = y - uv.y;

    float dsqr = distance(y,uv.y);
    float scale = 1.0;

    if(dir && diffY > 0.0)
    {
        dsqr = dsqr * 4.0;
    }
    else if(!dir && diffY < 0.0)
    {
        dsqr = dsqr * 4.0;
    }

    scale = pow(smoothstep(width * widthFactor, 0.0, dsqr), exponent);

    return min(color * scale, color);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec3 color = vec3(0.0);

    float t1 = (sin(iTime/20.0) / 3.14) + 0.2;
	float t2 = (sin(iTime/10.0) / 3.14) + 0.2;

    color += calcSine(uv, 0.20, 0.2, 0.0, 0.5,  vec3(0.5, 0.5, 0.5), 0.1, 15.0,false);
    color += calcSine(uv, 0.40, 0.15, 0.0, 0.5, vec3(0.5, 0.5, 0.5), 0.1, 17.0,false);
    color += calcSine(uv, 0.60, 0.15, 0.0, 0.5, vec3(0.5, 0.5, 0.5), 0.05, 23.0,false);

    color += calcSine(uv, 0.26, 0.07, 0.0, 0.3, vec3(0.5, 0.5, 0.5), 0.1, 17.0,true);
    color += calcSine(uv, 0.46, 0.07, 0.0, 0.3, vec3(0.5, 0.5, 0.5), 0.05, 23.0,true);
    color += calcSine(uv, 0.58, 0.05, 0.0, 0.3, vec3(0.5, 0.5, 0.5), 0.2, 15.0,true);

    color.x += t1 * (1.0-uv.y);
	color.y += t2 * (1.0-uv.y);

    fragColor = vec4(color,1.0);
}
