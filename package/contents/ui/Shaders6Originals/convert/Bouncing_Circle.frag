// url: https://www.shadertoy.com/view/7lBBzV
// credits: Desdby

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

const float e   = 0.577215664901532;
const float pi  = 3.141592653589793;
const float tau = 6.283185307179586;

float circle (vec2 p , vec2 pos){
    return distance(p,pos)*1.16; 
}


void mainImage( out vec4 fragColor, in vec2 fragCoord ){

    //Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/ubuf.iResolution.xy;
    float factor = ubuf.iResolution.y/ubuf.iResolution.x;
    
    uv = vec2 (uv.x , uv.y*factor);
    float x = uv.x, y = uv.y;
    float t = ubuf.iTime;
    
    vec2  c0pos = vec2(0.5 , abs(0.5*factor*sin(t)));
    
    float c0 = circle(uv,c0pos);
    float c = sqrt(c0);
    vec3 col = vec3(c,c,c) + 0.1*cos(t+uv.xyx + vec3(1.1,2.2,3.3))*tanh(pi*sin(t)+cos(x+y));
     
    // Output to screen
    fragColor = vec4(col,1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
