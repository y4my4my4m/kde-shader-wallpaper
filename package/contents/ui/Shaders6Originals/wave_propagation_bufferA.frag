//
// A simplified water effect by Tom@2016
//
// Based on: http://freespace.virgin.net/hugo.elias/graphics/x_water.htm
// A very old Hugo Elias water tutorial :)
//
// Using the same technique as:
//  https://www.shadertoy.com/view/4sd3WB by overlii
// A clever trick to utilize two channels
// and keep buffer A in x/r and buffer B in y/g.
//
// However, now it is twice as slower as my original:
//  https://www.shadertoy.com/view/Xsd3DB
//

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

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
   vec3 e = vec3(vec2(1.)/ubuf.iResolution.xy,0.);
   vec2 q = fragCoord.xy/ubuf.iResolution.xy;
   
   vec4 c = texture(iChannel0, q);
   
   float p11 = c.y;
   
   float p10 = texture(iChannel0, q-e.zy).x;
   float p01 = texture(iChannel0, q-e.xz).x;
   float p21 = texture(iChannel0, q+e.xz).x;
   float p12 = texture(iChannel0, q+e.zy).x;
   
   float d = 0.;
    
   if (ubuf.iMouse.z > 0.) 
   {
      // Mouse interaction:
      d = smoothstep(4.5,.5,length(ubuf.iMouse.xy - fragCoord.xy));
   }
   else
   {
      // Simulate rain drops
      float t = ubuf.iTime*2.;
      vec2 pos = fract(floor(t)*vec2(0.456665,0.708618))*ubuf.iResolution.xy;
      float amp = 1.-step(.05,fract(t));
      d = -amp*smoothstep(2.5,.5,length(pos - fragCoord.xy));
   }

   // The actual propagation:
   d += -(p11-.5)*2. + (p10 + p01 + p21 + p12 - 2.);
   d *= .99; // dampening
   d *= float(ubuf.iFrame>=2); // clear the buffer at ubuf.iFrame < 2
   d = d*.5 + .5;
   
   // Put previous state as "y":
   fragColor = vec4(d, c.x, 0, 0);
}

void main() {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    fragColor = color;
}
