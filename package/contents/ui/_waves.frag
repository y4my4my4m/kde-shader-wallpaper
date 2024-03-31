#version 450

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf { 
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    vec3 iResolution;
} ubuf;

layout(binding = 1) uniform sampler2D iChannel0;

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

void main()
{
      //vec3 backdrop = mix(C, C, C);
      vec3 backdrop;
  	//   vec2 uvTrue = qt_TexCoord0.xy / ubuf.iResolution.xy;
  	  vec2 uvTrue = qt_TexCoord0.xy;
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
		  uv.y += (0.2 * sin(uv.x + i / 7.0 - ubuf.iTime * 0.4));
      float Y = uv.y + getWeight(pow(i, 2.0) * 20.0) * (texture(iChannel0, vec2(uvTrue.x, 1)).x - 0.5);
      li = 0.4 + pow(1.2 * abs(mod(uvTrue.x + i / 1.1 + ubuf.iTime, 2.0) - 1.0), 2.0);
	    gw = abs(li / (150.0 * Y));

      ts  = gw * (GWM + sin(ubuf.iTime * TM));
      tsr = gw * (GWM + sin(ubuf.iTime * TM * 1.10));
      tsg = gw * (GWM + sin(ubuf.iTime * TM * 1.20));
      tsb = gw * (GWM + sin(ubuf.iTime * TM * 1.50));
	    color += vec3(tsr, tsg, tsb);

      backdrop = mix(C * normalize(color), C * normalize(color), C * normalize(color));
	}

	fragColor = vec4(color + backdrop, 0.5);
}
