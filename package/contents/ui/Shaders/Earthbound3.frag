// From https://www.shadertoy.com/view/wtXyz4
// Credits to thefox231
// Modified by @y4my4my4m
// TODO: modify pixelization and colors via GUI
const vec3 mainColor = vec3(.23, .15, .82);

float spiral(vec2 m, float t) {
	float r = length(m);
	float a = atan(m.y, m.x);
	float v = sin(50.*(sqrt(r)-0.02*a-.3*t));
	return clamp(v,0.,1.);

}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord/iResolution.xy;

    // fix aspect ratio
    float aspectRatio = iResolution.x / iResolution.y;
    uv.x *= aspectRatio;
    uv.x -= (aspectRatio - 1.) * .5;

    // pixelate
    float pxAmt = 256.;

    uv.x = floor(uv.x * pxAmt) / pxAmt;
    uv.y = floor(uv.y * pxAmt) / pxAmt;

    // interlacing .
    if (mod(fragCoord.y, 2.) < 1.) {
        uv += .4 + sin(iTime * .5 + uv.y * 5.) * (.3 + sin(iTime) * .1);
    } else {
        uv -= .4 + sin(iTime * .5 + uv.y * 5. + .5) * (.3 + sin(iTime) * .1);
    }

    // spiralllllllllllllll
    vec3 color = mainColor * spiral(uv - .5, iTime * .2 + sin(uv.y * 7.) * .2);

    // color shortening
    // gives it a kind of like snes-like palette
    float shortAmt = 4.0;
    color = ceil(color * shortAmt) / shortAmt;

    fragColor = vec4(color,1.0);
}
