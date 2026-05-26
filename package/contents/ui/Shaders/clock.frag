// 7-segment LED clock — original by author of "7 segment display (wip)"
// Date: 2020/06/26  Tags: led, lcd, seven, clock
//
// Ported to Shadertoy `mainImage(out vec4, in vec2)` form so it works
// with this engine's OpenGL 3.3 path. The previous file shipped as a
// complete Qt6 RHI (#version 450) shader, which collided with the
// engine's own header (duplicate `#version`, `qt_TexCoord0`, `fragColor`,
// `void mainImage()` etc.) and failed to compile.

#define PI 3.14159265358979323846264338327950288419716939937510582
#define TAU (2.*PI)

// Per-digit segment-on tables. Indexed by digit (0..9).
//   seg0 = top, seg1 = top-left, seg2 = top-right, seg3 = middle,
//   seg4 = bottom-left, seg5 = bottom-right, seg6 = bottom.
const float[10] seg0 = float[](1., 0., 1., 1., 0., 1., 1., 1., 1., 1.);
const float[10] seg1 = float[](1., 0., 0., 0., 1., 1., 1., 0., 1., 1.);
const float[10] seg2 = float[](1., 1., 1., 1., 1., 0., 0., 1., 1., 1.);
const float[10] seg3 = float[](0., 0., 1., 1., 1., 1., 1., 0., 1., 1.);
const float[10] seg4 = float[](1., 0., 1., 0., 0., 0., 1., 0., 1., 0.);
const float[10] seg5 = float[](1., 1., 0., 1., 1., 1., 1., 1., 1., 1.);
const float[10] seg6 = float[](1., 0., 1., 1., 0., 1., 1., 0., 1., 1.);

float SDF_lineseg(vec2 p, vec2 a, vec2 b) {
    float t = clamp(dot(p - a, b - a) / dot(b - a, b - a), 0., 1.);
    return length(p - a - (b - a) * t) - .1;
}

#define SDF_plane(p, c, n) (dot(normalize(p - c), n) * length(p - c))

float DE_seg(vec2 p, vec2 a, float rot) {
    p -= a;
    p.xy = p.xy * (1. - rot) + p.yx * rot;
    #define segw .12
    #define segt -.02
    float SDFp = -1e9;
    SDFp = max(SDFp, (SDF_plane(p, vec2(0.),         normalize(vec2(-1., -1.))) - segt));
    SDFp = max(SDFp, (SDF_plane(p, vec2(0.),         normalize(vec2(-1.,  1.))) - segt));
    SDFp = max(SDFp, (SDF_plane(p, vec2(0., -segw),  normalize(vec2( 0., -1.))) - segt));
    SDFp = max(SDFp, (SDF_plane(p, vec2(0.,  segw),  normalize(vec2( 0.,  1.))) - segt));
    SDFp = max(SDFp, (SDF_plane(p, vec2(1.,  0.),    normalize(vec2( 1., -1.))) - segt));
    SDFp = max(SDFp, (SDF_plane(p, vec2(1.,  0.),    normalize(vec2( 1.,  1.))) - segt));
    return SDFp;
}

float DE_7seg(vec2 p, float id) {
    float SDFp = 1e9;
    // top
    SDFp = min(SDFp, DE_seg(p, vec2(0., 0.), 0.) + (1. - seg0[int(id)]) * 1e9);
    // top left
    SDFp = min(SDFp, DE_seg(p, vec2(0., 0.), 1.) + (1. - seg1[int(id)]) * 1e9);
    // top right
    SDFp = min(SDFp, DE_seg(p, vec2(1., 0.), 1.) + (1. - seg2[int(id)]) * 1e9);
    // middle
    SDFp = min(SDFp, DE_seg(p, vec2(0., 1.), 0.) + (1. - seg3[int(id)]) * 1e9);
    // bottom left
    SDFp = min(SDFp, DE_seg(p, vec2(0., 1.), 1.) + (1. - seg4[int(id)]) * 1e9);
    // bottom right
    SDFp = min(SDFp, DE_seg(p, vec2(1., 1.), 1.) + (1. - seg5[int(id)]) * 1e9);
    // bottom
    SDFp = min(SDFp, DE_seg(p, vec2(0., 2.), 0.) + (1. - seg6[int(id)]) * 1e9);
    return SDFp;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Match the original's coordinate setup: normalize to [-1, 1] vertical,
    // origin at the centre of the screen, then push into the segment grid.
    vec2 p = (fragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
    p *= 5.;
    p.y = -p.y;
    p.x -= .5;
    p.y -= -1.;

    // iDate.w is seconds since midnight on Shadertoy. Derive minutes / hours.
    float totalSeconds = iDate.w;
    float minute = floor(totalSeconds / 60.);
    float hour   = floor(totalSeconds / 3600.);
    if (hour > 12.) hour -= 12.;

    float SDFp = 1e9;
    // mm units digit
    SDFp = min(SDFp, DE_7seg(p - vec2( 2., 0.), mod(minute, 10.)));
    // mm tens digit
    SDFp = min(SDFp, DE_7seg(p - vec2( 0., 0.), mod(floor(minute / 10.), 6.)));
    // hh units digit
    SDFp = min(SDFp, DE_7seg(p - vec2(-2., 0.), mod(hour, 10.)));
    // hh tens digit
    SDFp = min(SDFp, DE_7seg(p - vec2(-4., 0.), mod(floor(hour / 10.), 2.)));

    // Colon between hh and mm.
    SDFp = min(SDFp, length(p - vec2(-.5, 0.5)) - .05);
    SDFp = min(SDFp, length(p - vec2(-.5, 1.5)) - .05);

    vec3 retina;
    if (SDFp > 0.) {
        retina = mix(
            vec3(0., 0., 100. / 255.),
            vec3(0., 1., 1.),
            1. / (1. + pow(SDFp, 1.) * 3.)
        );
    } else {
        retina = vec3(1.);
    }

    fragColor = vec4(retina, 1.);
}
