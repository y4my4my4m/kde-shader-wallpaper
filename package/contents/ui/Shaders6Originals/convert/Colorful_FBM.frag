// url: https://www.shadertoy.com/view/XtKSWm
// credits: Homaniac
// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd

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

float random (in vec2 st) { 
  return fract(sin(dot(st.xy,
                       vec2(12.9898,78.233)))* 
               43758.5453123);
}

float noise (in vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);

  // Four corners in 2D of a tile
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) + 
      (c - a)* u.y * (1.0 - u.x) + 
      (d - b) * u.x * u.y;
}

#define OCTAVES 16
float fbm (in vec2 st) {
  // Initial values
  float value = 0.0;
  float amplitude = 1.;
  float frequency = 2.;
  //
  // Loop of octaves
  for (int i = 0; i < OCTAVES; i++) {
    value += amplitude * noise(st);
    st *= 3.;
    amplitude *= .5;
  }
  return value;
}

float fbmWarp2(in vec2 st, out vec2 q, out vec2 r)  {
  q.x = fbm(st + vec2(0.0,0.0));
  q.y = fbm(st + vec2(5.2,1.3));

  r.x = fbm( st + 4.0*q + vec2(1.7,9.2) + 0.7*ubuf.iTime);
  r.y = fbm( st + 4.0*q + vec2(8.3,2.8) + 0.7*ubuf.iTime);

  return fbm( st + 4.0*r);
}

vec3 hsb2rgb( in vec3 c ){
  vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
                           6.0)-3.0)-1.0,
                   0.0,
                   1.0 );
  rgb = rgb*rgb*(3.0-2.0*rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 st = gl_FragCoord.xy/ubuf.iResolution.xy;
  st.x *= ubuf.iResolution.x/ubuf.iResolution.y;

  vec3 color = vec3(0.0);
  vec2 q = vec2(0.);
  vec2 r = vec2(0.);
  float height = fbmWarp2(st*10., q, r);

  color += hsb2rgb(vec3(0.3,1.0 - (0.5*sin(ubuf.iTime) + 0.5),height));
  color = mix(color, hsb2rgb(vec3(0.0,q.x,0.2 + (0.2*sin(0.7*ubuf.iTime) + 0.2))), length(q));
  color = mix(color, hsb2rgb(vec3(0.58,r.x,0.0 + (0.25*sin(0.3*ubuf.iTime) + 0.25))), r.y);

  fragColor = vec4(color,1.0);
}


void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
