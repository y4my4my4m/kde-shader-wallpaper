#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    vec4 iMouse;
    vec3 iResolution;
    vec3 iChannelResolution[4];
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;
layout(binding = 2) uniform sampler2D iChannel1;

// configuration
#define MIRRORS (5.0)
#define ZOOM (1.5)

// possible values: MSAA2X, MSAA4X, MSAA8X, MSAA16X
// if no MSAAnX defined, msaa is disabled
#define MSAA2X

// helpers
#define PI 3.14159265
#define degPerRad 57.2957795130823
#define deg(a) ((a) * degPerRad)
#define rad(a) ((a) / degPerRad)

const vec2 base = vec2(1.0, 0.0);

mat2 rotate(float aDeg){
  float aRad = rad(aDeg);
  return mat2(
    cos(aRad), -sin(aRad),
    sin(aRad), cos(aRad)
  );
}

vec3 compute(vec2 xy, sampler2D Texture, float mirrors, float density, vec2 repeat) {
  float my_time = ubuf.iTime / 4.00;
  vec2 my_mouse = ubuf.iMouse.xy; //vec2(643.0,815.0);// ubuf.iMouse;
  vec2 coord = xy / ubuf.iResolution.xy;
  coord = fract(coord * repeat);
  coord -= 0.5; // place at center
  // coord -= my_mouse/ubuf.iResolution-0.5; // follow mouse
  coord *= density;
  coord.x *= ubuf.iResolution.x/ubuf.iResolution.y;
  coord.x /= repeat.x/repeat.y;
  // coord *= rotate(60.0);
  float lfo1 = sin(2.0*ubuf.iTime/3.14)*0.20+0.25;
  float lfo2 = sin(2.0*ubuf.iTime/2.44)*0.20+0.25;
  float lfo3 = sin(2.0*ubuf.iTime/5.16)*0.20+0.25;
  float lfo = (lfo1/1.13+lfo2+lfo3)/4.0;
  coord *= rotate(180.0 * lfo);
  coord *= rotate(deg(sin((length(coord)-ubuf.iTime/5.0)*6.0)*(sin((length(coord)))*0.5+0.5)*0.2));


  float dp = dot(base, coord);
  float cosa = dp / (length(base) * length(coord));
  float a = deg(acos(cosa));
  if (coord.y < 0.0) {
    a = 360.0 - a;
  }

  float segmentAngle = 360.0/mirrors;

  float b = mod(a, segmentAngle);

  vec2 texOffset = vec2(0.0, 0.0);
  
  texOffset += vec2(0.5, 0.5);

  // texture follows mouse
  // texOffset += vec2(-1.0, 1.0)*(my_mouse/ubuf.iResolution.xy*ubuf.iChannelResolution[0].xy)/ubuf.iChannelResolution[0].xy;//vec2(-0.05, 0.0);
  texOffset += vec2(-1.0, 1.0)*(my_mouse/ubuf.iResolution.xy);
  // texture slides
  texOffset += (texOffset/2.0) * vec2(sin(my_time/2.05)*density, -cos(my_time/2.00)*density/5.0) + (texOffset/2.0);

  mat2 rotationMatrix;

  if (b < segmentAngle/2.0) {
    rotationMatrix = rotate(-b);
  } else {
    rotationMatrix = rotate(b-segmentAngle);
  }

  vec2 coordTex = vec2(length(coord), 0.0);
  //coordTex = (coordTex+texOffset) * rotationMatrix;
  coordTex = coordTex * rotationMatrix + texOffset;
  coordTex *= vec2(0.5, 0.5);

  vec2 rotCenter = vec2(-0.0, -0.2);//0.1 * sin(my_time/1.0)/2.0;

  // texture wiggles
  coordTex = (coordTex-rotCenter) * rotate(deg(cos(my_time*0.05*sin(my_time*0.152)/2.0)/5.0)/10.0) + rotCenter;
  
  // texture rotates
  coordTex = (coordTex-rotCenter) * rotate(mod(my_time*2.5, 360.0)) + rotCenter;

  return texture(
    Texture,
    coordTex
  ).rgb;
}

// MSAA offsets
#if defined(MSAA2X)
vec2[] msaaOffsets = vec2[] (vec2(0.0, 0.0), vec2(-4.0, -4.0), vec2( 4.0,  4.0));
#elif defined(MSAA4X)
vec2[] msaaOffsets = vec2[] (vec2(0.0, 0.0), vec2(-2.0, -6.0), vec2( 6.0, -2.0), vec2(-6.0,  2.0), vec2( 2.0,  6.0));
#elif defined(MSAA8X)
vec2[] msaaOffsets = vec2[] (vec2(0.0, 0.0), vec2( 1.0, -3.0), vec2(-1.0,  3.0), vec2( 5.0,  1.0), vec2(-3.0, -5.0), vec2(-5.0,  5.0), vec2(-7.0, -1.0), vec2( 3.0,  7.0), vec2( 7.0, -7.0));
#elif defined MSAA16X
vec2[] msaaOffsets = vec2[] (vec2(0.0, 0.0), vec2( 1.0,  1.0), vec2(-1.0, -3.0), vec2(-3.0,  2.0), vec2( 4.0, -1.0), vec2(-5.0, -2.0), vec2( 2.0,  5.0), vec2( 5.0,  3.0), vec2( 3.0, -5.0), vec2(-2.0,  6.0), vec2( 0.0, -7.0), vec2(-4.0, -6.0), vec2(-6.0,  4.0), vec2(-8.0,  0.0), vec2( 7.0, -4.0), vec2( 6.0,  7.0), vec2(-7.0, -8.0));
#else
vec2[] msaaOffsets = vec2[] (vec2(0.0, 0.0));
#endif

int msaaSamplesCount = msaaOffsets.length();
float msaaOffsetSize = 1.0/8.0;

vec3 computeWithMsaa(vec2 coord, sampler2D Texture, float mirrors, float density, vec2 repeat) {
    vec3 accum = vec3(0.0);


    for (int i=0; i<msaaSamplesCount; i++) {
        accum += (compute(coord + msaaOffsetSize*msaaOffsets[i], Texture, mirrors, density, repeat));
    }

    accum /= float(msaaSamplesCount);

    return vec3(accum);
}

void main()
{
    vec2 coord = qt_TexCoord0 * ubuf.iResolution.xy; // Scale back to pixel coordinates

  	float lfo1 = sin(2.0*ubuf.iTime/2.88)*0.20+0.25;
  	float lfo2 = sin(2.0*ubuf.iTime/2.06)*0.20+0.25;
  	float lfo3 = sin(2.0*ubuf.iTime/3.33)*0.20+0.25;
  	float lfoA = (lfo1-lfo2*lfo3)/3.0+0.5;
    float lfoB = (lfo1+lfo2+lfo3)/3.0+0.5;

    vec3 color1 = computeWithMsaa(coord, iChannel0, MIRRORS * 1.0, ZOOM * 3.0 * lfoA, vec2(1.0, 1.0)).brr / 2.5;
    vec3 color2 = computeWithMsaa(coord, iChannel1, MIRRORS * 2.0, ZOOM * 2.0 * lfoB, vec2(1.0, 1.0)).gbr;
    //vec3 color = mix(color1, color2, sin(ubuf.iTime)/4.0+0.25);
    vec3 color = mix(dot(color1, vec3(1.0)) > dot(color2, vec3(1.0)) ? color1 : color2, color2/(color1*5.0), lfo1+lfo3);
    //vec3 color = dot(color1, vec3(1.0)) > dot(color2, vec3(1.0)) ? color1 : color2;
    fragColor = vec4(color, 1.0);
}