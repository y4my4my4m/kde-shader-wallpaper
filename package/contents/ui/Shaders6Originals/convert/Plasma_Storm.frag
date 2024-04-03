// url: https://www.shadertoy.com/view/slSBDd
// credits: fuzzmoon

//experimenting with 3D Gradient noise from: https://www.shadertoy.com/view/Xsl3Dl
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

#define layers 5 //int how many layers
#define speed .25 //float speed multiplyer
#define scale 1.2 //float scale multiplyer
vec3 hash( vec3 p )
{
	p = vec3( dot(p,vec3(127.1,311.7, 74.7)),
			  dot(p,vec3(269.5,183.3,246.1)),
			  dot(p,vec3(113.5,271.9,124.6)));
	p = -1.0 + 2.0*fract(sin(p)*43758.5453123);

	return p;
}
float noise( in vec3 p )
{
    vec3 i = floor( p );
    vec3 f = fract( p );
	
	vec3 u = f*f*(3.0-2.0*f);

    return mix( mix( mix( dot( hash( i + vec3(0.0,0.0,0.0) ), f - vec3(0.0,0.0,0.0) ), 
                          dot( hash( i + vec3(1.0,0.0,0.0) ), f - vec3(1.0,0.0,0.0) ), u.x),
                     mix( dot( hash( i + vec3(0.0,1.0,0.0) ), f - vec3(0.0,1.0,0.0) ), 
                          dot( hash( i + vec3(1.0,1.0,0.0) ), f - vec3(1.0,1.0,0.0) ), u.x), u.y),
                mix( mix( dot( hash( i + vec3(0.0,0.0,1.0) ), f - vec3(0.0,0.0,1.0) ), 
                          dot( hash( i + vec3(1.0,0.0,1.0) ), f - vec3(1.0,0.0,1.0) ), u.x),
                     mix( dot( hash( i + vec3(0.0,1.0,1.0) ), f - vec3(0.0,1.0,1.0) ), 
                          dot( hash( i + vec3(1.0,1.0,1.0) ), f - vec3(1.0,1.0,1.0) ), u.x), u.y), u.z );
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //normalized device coordinates from -1 to 1
    vec2 uv = (fragCoord-ubuf.iResolution.xy-.5)/ubuf.iResolution.y;
    //time value
    float t = ubuf.iTime*speed;

    uv *= scale;
    float h = noise(vec3(uv*2.,t));
    //uv distortion loop 
  for (int n = 1; n < layers; n++){
      float i = float(n);
    uv -= vec2(0.7 / i * sin(i * uv.y+i + t*5. + h * i) + 0.8, 0.4 / i * sin(uv.x+4.-i+h + t*5. + 0.3 * i) + 1.6);
  }

    uv -= vec2(1.2 * sin(uv.x + t + h) + 1.8, 0.4 * sin(uv.y + t + 0.3*h) + 1.6);


    // Time varying pixel color
    vec3 col = vec3(.5 * sin(uv.x) + 0.5, .5 * sin(uv.x + uv.y) + 0.5, .5 * sin(uv.y) + 0.8)*0.8;

    // Output to screen
    fragColor = vec4(col,1.0);
}


void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
