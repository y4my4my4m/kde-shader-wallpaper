// Nacre — liquid glass, shaped and lit analytically in one pass.
// Author: maxiarat1 (Nacre contributors)
// Category: Abstract
// License: MIT
// SPDX-License-Identifier: MIT
// @channels tex0, none, none, none
// Image 1 is optional: without it, the glass refracts an analytical gradient.
// Select a background in Inputs -> Images -> Image 1 and enable that slot.
// Customize the annotated constants through Gallery -> Tweak this shader.

/*
MIT License

Copyright (c) 2026 Nacre contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const float SPEED = 0.035; // @range(0.0, 0.15, 0.005) @label("Flow speed")
const float FOLDS = 1.45; // @range(0.6, 2.5, 0.05) @label("Ribbon count")
const float WIDTH = 0.16; // @range(0.06, 0.30, 0.01) @label("Ribbon width")
const float BEND = 0.55; // @range(0.0, 1.0, 0.02) @label("Bend amount")
const float SHADE_STRENGTH = 0.08; // @range(0.0, 0.4, 0.01) @label("Tube color strength")
const float SHADE_SCALE = 0.85; // @range(0.1, 3.0, 0.05) @label("Gradient scale")
const float SHADE_DRIFT = 0.4; // @range(0.0, 2.0, 0.05) @label("Color drift")
const vec3 GRADIENT_A = vec3(0.05, 0.68, 0.65); // @color @label("Gradient first color")
const vec3 GRADIENT_B = vec3(0.48, 0.22, 0.86); // @color @label("Gradient second color")
const float ANGLE = -0.35; // @range(-3.14, 3.14, 0.05) @label("Angle")
const float REFRACTION = 0.45; // @range(0.0, 1.2, 0.02) @label("Glass depth")
const float TRANSPARENCY = 0.96; // @range(0.0, 1.0, 0.02) @label("Transparency")
const float GLOSS = 0.90; // @range(0.0, 1.0, 0.02) @label("Gloss")
const float SOFTNESS = 0.15; // @range(0.0, 1.0, 0.02) @label("Edge softness")
const float BRIGHTNESS = 1.0; // @range(0.3, 1.8, 0.05) @label("Brightness")
const float IMAGE_BLEND = 1.0; // @range(0.0, 1.0, 0.05) @label("Background image blend")
const float IMAGE_BRIGHTNESS = 1.0; // @range(0.1, 1.5, 0.05) @label("Background image brightness")
const float IMAGE_ZOOM = 1.0; // @range(1.0, 3.0, 0.05) @label("Background image zoom")
const vec3 COLOR_A = vec3(0.08, 0.68, 0.60); // @color @label("Ambient first tint")
const vec3 COLOR_B = vec3(0.40, 0.30, 0.78); // @color @label("Ambient second tint")
const vec3 BACKGROUND = vec3(0.008, 0.013, 0.027); // @color @label("Background")
const vec3 HIGHLIGHT = vec3(0.78, 0.91, 1.0); // @color @label("Reflection tint")

vec3 backdrop(vec2 p)
{
    vec2 a = (p - vec2(-0.85, 0.45)) * vec2(0.85, 1.3);
    vec2 b = (p - vec2(0.95, -0.35)) * vec2(0.9, 1.1);
    vec3 color = BACKGROUND + 0.28 * COLOR_A / (1.0 + 2.0 * dot(a, a))
                            + 0.24 * COLOR_B / (1.0 + 2.0 * dot(b, b));
    if (IMAGE_BLEND > 0.0 && iChannelResolution[0].x > 0.0 && iChannelResolution[0].y > 0.0) {
        float screenAspect = iResolution.x / iResolution.y;
        float imageAspect = iChannelResolution[0].x / iChannelResolution[0].y;
        vec2 crop = min(vec2(1.0), vec2(screenAspect / imageAspect, imageAspect / screenAspect));
        vec2 uv = 0.5 + 0.5 * p / vec2(screenAspect, 1.0) * crop / IMAGE_ZOOM;
        // The host repeats textures; keep the whole filtered footprint inside.
        vec2 dx = dFdx(uv) * iChannelResolution[0].xy;
        vec2 dy = dFdy(uv) * iChannelResolution[0].xy;
        float footprint = sqrt(max(dot(dx, dx), dot(dy, dy)));
        vec2 inset = min(vec2(0.49), max(0.5, footprint) / iChannelResolution[0].xy);
        vec4 image = texture(iChannel0, clamp(uv, inset, 1.0 - inset));
        color = mix(color, image.rgb * IMAGE_BRIGHTNESS, IMAGE_BLEND * image.a);
    }
    return color;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    float t = iTime * SPEED;
    float c = cos(ANGLE), s = sin(ANGLE);
    vec2 q = mat2(c, s, -s, c) * p;
    vec2 gx = vec2(c, -s), gy = vec2(s, c);
    // The earlier, simpler ribbon flow: two gentle sequential shears.
    float phase = 1.3 * q.y + t;
    gx += 0.715 * BEND * cos(phase) * gy;
    q.x += 0.55 * BEND * sin(phase);
    phase = 1.2 * q.x - t;
    gy += 0.336 * BEND * cos(phase) * gx;
    q.y += 0.28 * BEND * sin(phase);
    float field = FOLDS * (q.y + 0.45 * sin(1.5 * q.x + t)) - 0.07 * t;
    float band = fract(field + 0.5) - 0.5;

    // Exact field derivatives avoid 2x2-pixel stepping in the glass rims.
    // Measure width in screen space so corner bends cannot balloon outward.
    vec2 gradient = FOLDS * (gy + 0.675 * cos(1.5 * q.x + t) * gx);
    float gradientLength = max(length(gradient), 0.0001);
    // Smoothly cap width: a hard min creates tangent breaks at the switch.
    float widthRatio = WIDTH * gradientLength / 0.42;
    float ratioSquared = widthRatio * widthRatio;
    float halfWidth = WIDTH * inversesqrt(sqrt(1.0 + ratioSquared * ratioSquared));
    float distanceInside = halfWidth - abs(band) / gradientLength;
    // A circular pixel footprint keeps filtering smooth as a ribbon turns.
    float aa = 2.4 / iResolution.y * (0.7 + SOFTNESS);
    float coverage = smoothstep(-aa, aa, distanceInside);
    gradient *= -sign(band) / gradientLength;
    float bevelWidth = 0.018 + 0.055 * REFRACTION;
    float bevel = 1.0 - smoothstep(0.0, bevelWidth, max(distanceInside, 0.0));
    vec2 slope = -0.94 * gradient * bevel;
    vec3 normal = vec3(slope, sqrt(max(1.0 - dot(slope, slope), 0.0)));
    float f = 1.0 - normal.z;
    float fresnel = f * f; fresnel *= fresnel; fresnel *= f;

    // The image and gradient share the same refraction coordinates.
    vec3 behind = backdrop(p);
    vec2 shift = REFRACTION * (0.38 * slope + vec2(0.035, -0.025));
    vec3 transmitted;
    transmitted.r = backdrop(p + shift * 1.045).r;
    transmitted.g = backdrop(p + shift).g;
    transmitted.b = backdrop(p + shift * 0.955).b;
    vec3 tint = mix(COLOR_A, COLOR_B, 0.5);
    vec3 glass = transmitted * mix(tint, vec3(1.0), TRANSPARENCY);

    // A faint color wash follows each tube, independently of the background.
    float ribbonId = floor(field + 0.5);
    float shadePhase = SHADE_SCALE * (1.2 * q.x + 0.65 * q.y)
                     + 0.8 * ribbonId + SHADE_DRIFT * t;
    vec3 tubeColor = mix(GRADIENT_A, GRADIENT_B, 0.5 + 0.5 * sin(shadePhase));
    float across = clamp(0.5 + 0.5 * band / (halfWidth * gradientLength), 0.0, 1.0);
    float clearRim = smoothstep(0.0, 1.5 * bevelWidth, max(distanceInside, 0.0));
    glass += SHADE_STRENGTH * tubeColor * (0.35 + 0.65 * across) * clearRim;

    float specular = max(dot(normal, vec3(-0.35, 0.45, 0.82158)), 0.0);
    specular *= specular; specular *= specular;
    specular *= specular; specular *= specular;
    float sharp = specular * specular;
    sharp *= sharp; sharp *= sharp;
    float lineLimit = 1.0 / (aa * aa);
    float outerLine = 1.0 / (1.0 + min(160000.0, lineLimit) * distanceInside * distanceInside);
    float innerDistance = distanceInside - 0.85 * bevelWidth;
    float innerLine = 1.0 / (1.0 + min(180000.0, lineLimit) * innerDistance * innerDistance);
    float reflectionDistance = distanceInside - 0.45 * bevelWidth;
    float facing = dot(gradient, vec2(-0.6, 0.8));
    float facingDelta = facing - 0.15;
    float smoothFacing = 0.5 * (facing + 0.15 + sqrt(facingDelta * facingDelta + 0.0004));
    float reflection = smoothFacing
        / (1.0 + min(mix(20000.0, 180000.0, GLOSS), lineLimit) * reflectionDistance * reflectionDistance);
    float filteredGloss = GLOSS / (1.0 + 4.0 * length(fwidth(normal)));
    glass += HIGHLIGHT * (0.9 * mix(specular, sharp, filteredGloss)
                       + 0.5 * fresnel + 0.60 * outerLine + 0.20 * innerLine + 0.45 * reflection);
    float shadowDistance = distanceInside + 0.012;
    behind *= 1.0 - 0.24 / (1.0 + 8000.0 * shadowDistance * shadowDistance);
    vec3 color = mix(behind, glass, coverage);
    color *= BRIGHTNESS / (1.0 + 0.08 * dot(p, p));
    fragColor = vec4(color, 1.0);
}
