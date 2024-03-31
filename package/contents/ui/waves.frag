// From https://www.shadertoy.com/view/XdtfRB
// Credits to sangwhan
// Modified by @y4my4my4m

//TODO: will make this customizable via GUI
#version 440
layout(location = 0) in vec2 inPosition; // Vertex position, assuming vec2 for simplicity
layout(location = 1) in vec2 inTexCoord; // Texture coordinate
layout(location = 0) out vec4 outColor; // Output color of the fragment

uniform vec3 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;

};
uniform vec3   iResolution;
uniform float  iTime;
uniform float  iTimeDelta;
uniform int    iFrame;
uniform float  iFrameRate;
uniform float  iChannelTime[4];
uniform vec3   iChannelResolution[4];
uniform vec4   iMouse;
uniform vec4    iDate;
uniform float   iSampleRate;

//layout(binding = 1) uniform sampler2D src;

vec3 C = vec3(0.12, 0.11, 0.37);
float GWM = 1.15;
float TM = 0.25;

float getAmp(float frequency) {
    return texture(iChannel0, vec2(frequency / 512.0, 0)).x;
}

float getWeight(float f) {
    return (getAmp(f - 2.0) + getAmp(f - 1.0) + \
            getAmp(f + 2.0) + getAmp(f + 13.0) + \
            getAmp(f)) / 5.0;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord );

void main() {
    vec2 fragCoord = inPosition.xy * iResolution.xy;
    mainImage(outColor, fragCoord);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
      //vec3 backdrop = mix(C, C, C);
      vec3 backdrop;
  	  vec2 uvTrue = fragCoord.xy / iResolution.xy;
      vec2 uv = 2.5 * uvTrue - 1.33;

  	  float li;
      float gw;
      float ts;
      float tsr;
      float tsg;
      float tsb;

      float cr;
      float cg;
      float cb;
      vec3 color = vec3(0.0);

	for(float i = 0.0; i < 5.0; i++) {
		  uv.y += (0.2 * sin(uv.x + i / 7.0 - iTime * 0.4));
      float Y = uv.y + getWeight(pow(i, 2.0) * 20.0) * (texture(iChannel0, vec2(uvTrue.x, 1)).x - 0.5);
      li = 0.4 + pow(1.2 * abs(mod(uvTrue.x + i / 1.1 + iTime, 2.0) - 1.0), 2.0);
	    gw = abs(li / (150.0 * Y));

      ts  = gw * (GWM + sin(iTime * TM));
      tsr = gw * (GWM + sin(iTime * TM * 1.10));
      tsg = gw * (GWM + sin(iTime * TM * 1.20));
      tsb = gw * (GWM + sin(iTime * TM * 1.50));
	    color += vec3(tsr, tsg, tsb);

      backdrop = mix(C * normalize(color), C * normalize(color), C * normalize(color));
	}

	fragColor = vec4(color + backdrop, 0.5);
}
