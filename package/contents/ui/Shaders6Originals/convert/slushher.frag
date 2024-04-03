
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
void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    //timescale
    float angle = ubuf.iTime * 0.1;
    vec2 uv = fragCoord / ubuf.iResolution.xy * 2.0 - 1.0;
    //color
    vec3 col = 0.5 + 0.5 * cos(ubuf.iTime + uv.xyx + vec3(0, 2, 4));
    
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
        uv = vec2(uv.x - (cos(ubuf.iTime)) / 3.0, uv.y - (-sin(ubuf.iTime)) / 4.0);
        length(uv + vec2(0.2, -0.3));
        length(uv + vec2(-0.2, 0.1));
    }
    //if you dont want it to be rgb you can remove color vector
    fragColor = vec4(vec3(length(uv)) * col, 1.0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
