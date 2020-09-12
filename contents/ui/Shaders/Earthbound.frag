// From https://www.shadertoy.com/view/wlsczH
// Credits to thefox231
// Modified by @y4my4my4m
const float thickness = 0.02;
const vec3 mainColor = vec3(0.32, .51, .75);

bool equals(float a, float b) {
    return abs(a - b) < thickness;
}

float sum(vec2 a) {
    return a.x + a.y;
}
float sum(vec3 a) {
    return a.x + a.y + a.z;
}

mat2 rotate2d(float angle) {
    return mat2(cos(angle),-sin(angle),
                sin(angle),cos(angle));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord/iResolution.xy;

    vec3 color = vec3(.0);

    // fix aspect ratio
    uv.x *= iResolution.x / iResolution.y;

    // pixelate
    float pxAmt = 256.0;

    uv.x = floor(uv.x * pxAmt) / pxAmt;
    uv.y = floor(uv.y * pxAmt) / pxAmt;

    vec2 uvOrig = uv;

    // unfix aspect ratio
    uvOrig.x /= iResolution.x / iResolution.y;

    // interlacing .
    float pixAmt = 2.;
    if (mod(fragCoord.y, pixAmt) < pixAmt * 0.5) {
        uv += 0.1 + tan(iTime * 0.2 + uv.y * 8.) * 0.05;
    } else {
        uv -= 0.1 + tan(iTime * 0.2 + uv.y * 8. + .5) * 0.05;
    }

    // move ing...
    uv.x += sin(iTime * 1.6) * 0.3;
    uv.y += cos(iTime * .2) * 2.5;

    // rotate......
    uv.xy *= rotate2d(iTime * 0.15);

    // bg waves
    if (equals(sin(uvOrig.x * 90. + iTime) * 0.1 + 0.2, mod(uvOrig.y + sin(iTime * 0.4) * 0.2 + sin(uv.x) * 0.3, 0.3146))) {
        color += mainColor * 0.2;
    }
    if (equals(sin(uvOrig.y * 50. + iTime) * 0.1 + 0.2, mod(uvOrig.x + sin(iTime * 0.7) * 0.2 + sin(uv.y) * 0.3, 0.3146))) {
        color += mainColor * 0.2;
    }

    // rotating squares
    // repeat them
    float repeatNum = 4.3;
   	uv = mod(uv, 1. / repeatNum) * repeatNum;

    vec2 seed = floor(uv);

    float brightness = 1.0;

    vec3 squareColor = vec3(.0);
    vec2 squarePos = vec2(.5, .5);
    squareColor = mainColor * brightness * sum(abs(uv - squarePos));
    if (sum(abs(uv - squarePos)) < .6) {
        squareColor -= 0.2;
    }

    // glowy......
    squareColor += sin(iTime) * 0.1;

    if (sum(squareColor) > .1) {
    	color = squareColor;
    }

    // also add some circles, for good measure
    uv = uvOrig;

    // move ing...
    uv.x += sin(iTime * .6) * 0.7;
    uv.y += cos(iTime * .9) * 1.5;

    // rotate......
    uv.xy *= rotate2d(iTime * 0.18);

    // fix aspect ratio
    uv.x *= iResolution.x / iResolution.y;

    // interlacing .
    if (mod(fragCoord.y, pixAmt) < pixAmt * 0.5) {
        uv += 0.2 + sin(iTime * 0.2 + uv.y * 8.) * 0.05;
    } else {
        uv -= 0.2 + cos(iTime * 0.5 + uv.y * 8. + .5) * 0.05;
    }

    repeatNum = 1.3;
   	uv = mod(uv, 1. / repeatNum) * repeatNum;

    vec2 circlePosition = vec2(.5, .5);
    color += mainColor * 1.0 - length(circlePosition - uv);

    // color shortening
    // gives it a kind of like snes-like palette
    float shortAmt = 14.0;
    color = ceil(color * shortAmt) / shortAmt;

    fragColor = vec4(color, 1.0);
}
