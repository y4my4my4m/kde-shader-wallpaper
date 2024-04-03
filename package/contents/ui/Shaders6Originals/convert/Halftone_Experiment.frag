// From https://www.shadertoy.com/view/lft3zS
// Credits to HaleyHalcyon 

#define SQRT2 1.41421356
#define HALFPI 1.5707963
#define ROT(x) mat2x2(cos(vec4(0, 1, -1, 0) * HALFPI + x))

#define HEX(x) vec3((ivec3(x) >> ivec3(16, 8, 0)) & 255) / 255.

float distGrid(vec2 uv) {
    return pow( // visual adjustment near t = 0 and 1
        length(uv - round(uv)) * SQRT2,
        1.5
    );
}

vec2 distGrids(vec2 uv) {
    return vec2(
        distGrid(uv + vec2(0.5, 0)),
        1. - distGrid(uv + vec2(0, 0.5))
    );
}

float halftone(vec2 uv, float lightness) {
    
    vec2 grids = distGrids(uv);
    float grid = mix(
        grids.x, grids.y,
        smoothstep(0.3, 0.7, lightness)
    );
    float w = max(0.1, fwidth(grid) * .75);
    // avoid artifacts close to 0 and 1 I couldn’t avoid with fwidth...
    if (abs(lightness - 0.5) >= 0.498) {
        return step(0.5, lightness);
    }
    return smoothstep(-w, +w, lightness - grid);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float t = fract(iTime / 32.0);
    vec2 uv = (2. * fragCoord - iResolution.xy) / length(iResolution.xy);
    float r = log(0.17 + length(uv));
    //float a = atan(uv.y, uv.x) / (4. * HALFPI);
    
    const float HILLSPERLOOP = 2.;
    float spiral = (
        + HILLSPERLOOP * t
        + 0.7 * r
    );
    vec2 uvs = uv * 24.0 * ROT(
        0.3 * (
            (floor(spiral * 2.) - 2. * HILLSPERLOOP * t) * (-1. + 2. * floor(mod(spiral * 2., 2.)))
        )
    );
    float halftoned = halftone(uvs, -.05 + 1.1 * abs(1. - fract(spiral) * 2.));
    vec3 col = mix(
        mix(
            HEX(0x009BE8),
            HEX(0xfff100),
            step(1., mod(spiral + 8., 2.))
        ), mix(
            HEX(0xEB0072),
            HEX(0x010a31),
            step(1., mod(spiral + 7.5, 2.))
        ), halftoned
    );

    // Output to screen
    fragColor = vec4(col,1.0);
}