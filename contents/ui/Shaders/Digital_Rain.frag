// url: https://www.shadertoy.com/view/ldccW4
// credits: WillKirkby

float text(vec2 fragCoord)
{
    vec2 uv = mod(fragCoord.xy, 16.)*.0625;
    vec2 block = fragCoord*.0625 - uv;
    uv = uv*.8+.1; // scale the letters up a bit
    uv += floor(texture(iChannel1, block/iChannelResolution[1].xy + iTime*.002).xy * 16.); // randomize letters
    uv *= .0625; // bring back into 0-1 range
    uv.x = -uv.x; // flip letters horizontally
    return texture(iChannel0, uv).r;
}

vec3 rain(vec2 fragCoord)
{
	fragCoord.x -= mod(fragCoord.x, 16.);
    //fragCoord.y -= mod(fragCoord.y, 16.);
    
    float offset=sin(fragCoord.x*15.);
    float speed=cos(fragCoord.x*3.)*.3+.7;
   
    float y = fract(fragCoord.y/iResolution.y + iTime*speed + offset);
    return vec3(.1,1,.35) / (y*20.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(text(fragCoord)*rain(fragCoord),1.0);
}
