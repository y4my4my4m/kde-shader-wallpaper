// URL: https://www.shadertoy.com/view/NdlXDX
// By: avin

#define PI 3.141592653589

#define BACKGROUND vec3(238, 238, 254) / 255.
#define PURPLE vec3(98, 53, 167) / 255.
#define YELLOW vec3(248, 205, 58) / 255.
#define RED vec3(224, 64, 86) / 255.
#define BLUE vec3(67, 102, 251) / 255.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - iResolution.xy * .5) / iResolution.y;
  uv *= 1.25;

  float t = iTime * 2.5;

  vec3 rCol = BACKGROUND;
  float f = 0.;
  vec2 vuv = vec2(0.);
  float fillFactor = 0.;

  float size = .20;
  float stepFactor = .05;
  float moveFactor = size + stepFactor;

  // PHASE 1 (circle)

  vuv = uv + vec2(moveFactor, 0.);
  fillFactor = step(-size, vuv.x) * step(vuv.x, size) * step(-size, vuv.y) * step(vuv.y, size);
  f = step(fract(length(vuv) * 10. - iTime), .5);
  rCol = mix(rCol, YELLOW, fillFactor * f);

  // PHASE 2 (arrow down)

  vuv = uv - vec2(moveFactor, 0.);
  fillFactor = step(-size, vuv.x) * step(vuv.x, size) * step(-size, vuv.y) * step(vuv.y, size);
  f = step(fract(vuv.y * 7. - abs(vuv.x * 7.) + t), .5);
  rCol = mix(rCol, RED, fillFactor * f);

  // PHASE 3 (corner)

  vuv = uv + vec2(moveFactor * 3., 0.);
  fillFactor = step(-size, vuv.x) * step(vuv.x, size) * step(-size, vuv.y) * step(vuv.y, size);
  float ca = cos(PI * .25);
  float sa = sin(PI * .25);
  mat2 rot = mat2(ca, -sa, sa, ca);
  vuv *= rot;
  f = step(fract(vuv.y * 7. - abs(vuv.x * 7.) + t), .5);
  rCol = mix(rCol, PURPLE, fillFactor * f);

  // PHASE 3 (lines)

  vuv = uv - vec2(moveFactor * 3., 0.);
  fillFactor = step(-size, vuv.x) * step(vuv.x, size) * step(-size, vuv.y) * step(vuv.y, size);
  f = step(fract(uv.y * 10. + t), .5);
  rCol = mix(rCol, BLUE, fillFactor * f);

  fragColor = vec4(rCol, 1.0);
}

