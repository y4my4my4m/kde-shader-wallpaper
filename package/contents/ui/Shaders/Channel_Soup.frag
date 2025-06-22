// url: https://www.shadertoy.com/view/tdBSWR
// credits: Blokatt

// Channel Soup
// 24/03/19:
// Tiny thing written by @blokatt on his phone (hence why the code might be messy).
// Might clean it up later, right now, I'm lazy.
// 10/04/19: Update.


mat2 rotate(float a) {
  return mat2(
    cos(a), -sin(a),
    sin(a), cos(a));
}

float rand(vec2 p){
	return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
}

float valueNoise(vec2 uv){
    vec2 i = fract(uv);
    vec2 f = floor(uv);
	float a = rand(f);
    float b = rand(f + vec2(1.0, 0.0));
    float c = rand(f + vec2(0.0, 1.0));
    float d = rand(f + vec2(1.0, 1.0));    
    return mix(mix(a, b, i.x), mix(c, d, i.x), i.y);
}

float noise(vec2 uv){
    float v = 0.;
    float freq = 1.;
    float amp = 0.4;
    uv  += 2.;
    for (int i = 0; i < 5; ++i) {
    	v += valueNoise((uv + iTime) * freq) * amp;
        amp *= .6;
        freq *= 1.75;
    }

    return v;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  float time = iTime;
  vec2 uv = fragCoord/iResolution.xy - .5;
  uv.x *= iResolution.x / iResolution.y;
  uv *= .5;  
  vec2 nuv = uv;
  uv *= rotate((length(uv) * 5. + time * .5));
  uv *= 20. - length(uv) * 5.;
  uv *= 1.5 + 2. * ((sin(time * .2 + length(uv) * .8) * .5) + .5);
  vec3 color =vec3(1);
    
  float coff = 1. + length(uv) * .01;
  color.r = sin(uv.y * uv.x + time * 5.) + cos(uv.y  + time) * 3.;
  color.g = sin(uv.y * uv.x + time * 5. + .4 * coff) + cos(uv.y + time + .5 * coff) * 3.;
  color.b = sin(uv.y * uv.x + time * 5. + .8 * coff) + cos(uv.y + time + 1. * coff) * 3.;
  color *= 1.2 - pow(length(nuv), .1);

  float overlay = noise(uv + vec2(noise(uv), noise(uv * 2.)) *  rotate(noise(uv)));
  overlay = (overlay - .5) * 5. + .5;
  fragColor = vec4(color - (.3 * overlay), 1.0 );

}

