import QtQuick 2.12
import QtQuick.Controls 2.12
Item {
    property ShaderEffect iChannel0: ShaderEffect { source: "/home/y4my4m/Dev/kde-shadertoy-wallpaper/contents/ui/Shader/Shadertoy_SimpleBufferA.frag" }
    property string pixelShader: `
    // From https://www.shadertoy.com/view/3dsGzs
    // By fish

    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
    	vec2 uv = fragCoord.xy / iResolution.xy;
        vec4 col = texture(iChannel0, uv);
        fragColor = vec4(col.rgb, 1.);
    }

`
}
