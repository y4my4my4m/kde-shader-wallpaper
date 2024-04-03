// From https://www.shadertoy.com/view/clVyR1
// Credits to amagitakayosi


#define N  120
#define PI 3.141593

float circle(vec2 p, float r) {
    return smoothstep(.1, .0, abs(length(p) - r));
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    vec2 p = uv * 2. - 1.;
    p.x *= iResolution.x / iResolution.y;
    p *= 2.;
    
    float a = atan(p.y, p.x);    

    vec3 col;
   

    for (int i = 0; i < N; i++) {
        float fi = float(i);
        float t = fi / float(N);
        float aa = (t + iTime / 12.) * 2. * PI;
        
        float size = .3 + sin(t * 6.* PI) * .1;
    
    
        float a1 = -iTime * PI / 3. + aa;       
        a1 += sin(length(p) * 3. + iTime * PI / 2.) * 0.3;
        vec2 c1 = vec2(cos(a1), sin(a1));
        
        float a2 = aa * 4.;            
        vec2 c2 = vec2(cos(a2), sin(a2)) * 0.3 + c1;
        col.r += .001 / abs(length(p - c2) - size);        
        col.g += .0013 / abs(length(p - c2) - size * 1.05);        
        col.b += .0015 / abs(length(p - c2) - size * 1.09);                
    }
    


    fragColor = vec4(col, 1.);
}