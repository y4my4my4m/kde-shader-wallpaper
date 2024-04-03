// https://www.shadertoy.com/view/4ty3WW
// Credits to vox
//-----------------CONSTANTS MACROS-----------------

#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    float iTimeDelta;
    float iFrameRate;
    float iSampleRate;
    int iFrame;
    vec4 iDate;
    vec4 iMouse;
    vec3 iResolution;
    float iChannelTime[4];
    vec3 iChannelResolution[4];
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;
layout(binding = 1) uniform sampler2D iChannel1;
layout(binding = 1) uniform sampler2D iChannel2;
layout(binding = 1) uniform sampler2D iChannel3;

vec2 fragCoord = vec2(qt_TexCoord0.x, 1.0 - qt_TexCoord0.y) * ubuf.iResolution.xy;

#define PI 3.14159265359
#define E 2.7182818284
#define GR 1.61803398875

//-----------------UTILITY MACROS-----------------

#define time ((sin(float(__LINE__))*GR/2.0/PI+GR/PI)*ubuf.iTime+100.0)
#define flux(x) (vec3(cos(x),cos(4.0*PI/3.0+x),cos(2.0*PI/3.0+x))*.5+.5)
#define rotatePoint(p,n,theta) (p*cos(theta)+cross(n,p)*sin(theta)+n*dot(p,n) *(1.0-cos(theta)))

float saw(float x)
{
    float f = mod(floor(abs(x)), 2.0);
    float m = mod(abs(x), 1.0);
    return f*(1.0-m)+(1.0-f)*m;
}
vec2 saw(vec2 x)
{
    return vec2(saw(x.x), saw(x.y));
}

vec3 saw(vec3 x)
{
    return vec3(saw(x.x), saw(x.y), saw(x.z));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / ubuf.iResolution.xy*2.0-1.0;
    uv.x *= ubuf.iResolution.x/ubuf.iResolution.y;
    
	vec3 eye = vec3(cos(ubuf.iTime), sin(ubuf.iTime*.5), sin(ubuf.iTime))*2.0;
    vec3 look = vec3(0.0, 0.0, 0.0);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 foward = normalize(look-eye);
    vec3 right = normalize(cross(foward, up));
    up = normalize(cross(right, foward));
    vec3 ray = normalize(foward+uv.x*right+uv.y*up);
    
 	const float outerCount = 8.0;
 	const float innerCount = 8.0;
        
    float map = 0.0;
    float sum = 0.0;
    
    for(float i = 0.0; i < outerCount; i+=1.0)
    {
        float theta1 = i/outerCount*2.0*PI;
        
        for(float j = 0.0; j < innerCount; j+=1.0)
        {
            float theta2 = theta1+j/innerCount*PI*2.0;

            
            float omega1 = theta1;
            float omega2 = theta2+time*sign(cos(i*PI));
            
            
       	 	vec3 p1 = vec3(cos(omega1)*sin(omega2),
                           sin(omega1)*sin(omega2),
                           cos(omega2));
                           
       	 	vec3 p2 = vec3(cos(omega1)*sin(omega2+PI/8.0),
                           sin(omega1)*sin(omega2+PI/8.0),
                           cos(omega2+PI/8.0));
            
            vec3 ray2 = normalize(p2-p1);
            
            float a = dot(ray,ray);
            float b = dot(ray,ray2);
            float c = dot(ray2,ray2);
            float d = dot(ray,eye-p1);
            float e = dot(eye-p1,ray2);
            
            float t1 = (b*e-c*d)/(a*c-b*b);
            float t2 = (a*e-b*d)/(a*c-b*b);
            
            float dist = length((eye+ray*t1)-(p1+ray2*t2));
            
            float lineWidth = 50.0/max(ubuf.iResolution.x, ubuf.iResolution.y);
            
            float lineLength = 2.5+.5*sin(time);
            
            float isFoward = (sign(t1)*.5+.5);
            
            
            
                float sides = (1.0-smoothstep(0.0, lineWidth, dist));
                float ends = (1.0-smoothstep(0.0, lineLength, abs(t2)));
                float line = sides*ends*isFoward;
                
                map += (1.-map)*line;
                sum += 1.0*line*isFoward;
        }
    }
    
	fragColor = vec4(flux(PI*map/sum+time)*clamp(map, 0.0, 1.0), 1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
