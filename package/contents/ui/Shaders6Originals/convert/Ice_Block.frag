// From https://www.shadertoy.com/view/Mf33D2
// Credits to akr51



void mainImage( out vec4 c, in vec2 u)
{
    
    
    vec2 r = iResolution.xy, uv = (u + u - r) / r.y;
   
    
    //float t = iTime * 2.1 + 555622.0;
    float t = iTime * 2.1;

    float ii = cos(sin((uv.x + t) * 0.25 * cos((uv.y + t) * 0.1) * 1.0 + t));
   
    float s = fract(length(uv + vec2(ii * 4.0 + t, -ii)) + t * 0.01);
   
    uv *= 2.0;

    s = sin(s * 3.0);
    
    uv.x += cos(uv.y + t) * 0.95;
    uv.y += sin(uv.x + t) * 0.95;
   
    float w = sin(uv.x * s + t) - cos(uv.y * s + t);
    float k = sin(uv.x * 2.0 + s) + cos(uv.y);
    float z = sin(k * uv.x * uv.y + t);
    
    vec3 v = vec3(sin(w + t), cos(k * 1.0 * s + s), z);
    vec3 j = vec3(w - w, k - z, z * sin(z * 1.0));
    vec3 h = vec3(w * uv.x, z, k * k * s * cos(uv.x + t));
    
    vec3 f = cross(sin(v * 7.0 + t), j) * 0.1 + cross(h, sin(j * 7.0 + t)) * 0.1 + h * 0.1 - j * 0.1 + v * 0.1;
    f = sin(f * 5.0 + t);
    f.r = pow(2.1, sin(f.r * 2.0 + t));
    f.g = pow(1.1, f.g);
    f.b = pow(1.1, f.b);
    f = vec3(pow(f.r, 2.0), pow(f.g, 1.5), pow(f.b, 2.0));
    
    c = vec4(vec3(f * 0.74), 1.0);
}