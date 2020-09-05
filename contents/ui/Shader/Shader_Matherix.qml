import QtQuick 2.12
import QtQuick.Controls 2.12
Item {
    property string pixelShader: "
    // From https://www.shadertoy.com/view/wtXyz4
    // Credits to thefox231
    // Modified by @y4my4my4m
    // TODO: modify pixelization and colors via GUI

    float random(in float x){
        return fract(sin(x)*43758.5453);
    }

    float random(in vec2 st){
        return fract(sin(dot(st.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    float randomChar(in vec2 outer,in vec2 inner){
        float grid = 5.;
        vec2 margin = vec2(.2,.05);
        float seed = 23.;
        vec2 borders = step(margin,inner)*step(margin,1.-inner);
        return step(.5,random(outer*seed+floor(inner*grid))) * borders.x * borders.y;
    }

    vec3 matrix(in vec2 st){
        float rows = 120.0;
        vec2 ipos = floor(st*rows)+vec2(1.,0.);

        ipos += vec2(.0,floor(iTime*15.*random(ipos.x)));

        vec2 fpos = fract(st*rows);
        vec2 center = (.5-fpos);

        float pct = random(ipos);
        float glow = (1.0-dot(center,center)*3.0)*2.0;

        return vec3(randomChar(ipos,fpos) * pct * glow);
    }

    const vec3 mainColor = vec3(.4, .20, .95);

    float sawtooth(float a, float freq) {
        if (mod(a, freq) < freq * 0.5) return mod(a, freq * 0.5);
        return freq * 0.5 - mod(a, freq * 0.5);
    }

    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
        vec2 uv = fragCoord/iResolution.xy;
        float resolutionRatio = iResolution.x / iResolution.y;

        float iTime = iTime ;

        // uv fuckery !
        // pixelate

        float pxAmt = 512.0;

        uv.x = (floor(uv.x * pxAmt) / pxAmt) * 4;
        uv.y = (floor(uv.y * pxAmt) / pxAmt) * 4;

        // interlacing .
        float pixAmt = 0.2;
        if (mod(fragCoord.y, pixAmt) < pixAmt * 0.5) {
            uv += 0.1 + sin(iTime * 0.2 + uv.y * 8.) * 0.05;
        } else {
            uv -= 0.1 + sin(iTime * 0.2 + uv.y * 8. + .5) * 0.05;
        }

        vec2 uv2 = uv;

        vec3 color = vec3(0.1);

        // first one (bg-ish thing??)

        color = vec3(mod(abs(sawtooth(uv.x, 0.6) * resolutionRatio + sawtooth(uv.y, 0.6) + iTime * 0.3), 0.4)) * mainColor;

        // second one (stripes-like thing)

        if (uv2.x < 0.5) {
            uv2.x = 1.0 - uv2.x;
        }
        if (uv2.y > 0.5) {
            uv2.y = 1.0 - uv2.y;
        }

        uv2.x += sin(uv2.y * 4.0 + iTime) * 0.1;

        if (mod(abs(uv2.x * resolutionRatio + uv2.y + iTime * 0.1), 0.2) < 0.1) {
            vec3 lines = vec3(cos(uv.x * 1.0 + iTime + uv.y * 3.0)) * mainColor * 0.7;
            color = mix(color, lines, 0.3);
        }

        // color shortening
        // gives it a kind of like snes-like palette
        float shortAmt = 16.0;
        color = ceil(color * shortAmt) / shortAmt;

        // feed the frag color .

        vec2 st = fragCoord.xy / iResolution.xy;
          st.y *= iResolution.y/iResolution.x;
        vec3 fontColorMixed;
          vec3 fontColor;
          vec3 bgColor = vec3(.0,.0,.0);
          fontColor = vec3(0.03,0.07,0.05);
          fontColor = mix(matrix(st) * fontColor, matrix(st) * fontColor, matrix(st) * fontColor);
        fragColor = vec4(color + fontColor , 0.5);
    }
    "
}
