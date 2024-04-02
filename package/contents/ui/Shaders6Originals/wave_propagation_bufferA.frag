#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    vec4 iMouse;
    vec3 iResolution;
    int iFrame;
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;

void main() {
   vec3 e = vec3(vec2(1.) / ubuf.iResolution.xy, 0.);
   vec2 q = qt_TexCoord0;

   vec4 c = texture(iChannel0, q);

   float p11 = c.y;

   float p10 = texture(iChannel0, q - e.zy).x;
   float p01 = texture(iChannel0, q - e.xz).x;
   float p21 = texture(iChannel0, q + e.xz).x;
   float p12 = texture(iChannel0, q + e.zy).x;

   float d = 0.;

   if (ubuf.iMouse.z > 0.) {
      d = smoothstep(4.5, .5, length(ubuf.iMouse.xy / ubuf.iResolution.xy - q));
   } else {
      float t = ubuf.iTime * 2.;
      vec2 pos = fract(floor(t) * vec2(0.456665, 0.708618));
      float amp = 1. - step(.05, fract(t));
      d = -amp * smoothstep(2.5, .5, length(pos - q));
   }

   d += -(p11 - .5) * 2. + (p10 + p01 + p21 + p12 - 2.);
   d *= .99;
   d *= float(ubuf.iFrame >= 2);
   d = d * .5 + .5;

   fragColor = vec4(d, c.x, 0, 0);
}
