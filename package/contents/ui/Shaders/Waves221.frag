// by: Xor
// url: https://www.shadertoy.com/view/cttyzf
// Ray-start dither: interleaved gradient noise in place of Shadertoy's
// 1024x1024 blue-noise texture on iChannel0.

/*
    "Waves" by @XorDev

    X: X.com/XorDev/status/1722433311685906509
    
    <300 chars playlist: shadertoy.com/playlist/fXlGDN
*/

void mainImage( out vec4 O, vec2 I)
{
    O *= 0.;
    vec3 p,r=iResolution;for(float i=fract(52.9829189*fract(dot(I,vec2(.06711056,.00583715))))+9.; i++<1e2; 
    O+=max(cos(dot(cos(p=vec3((I-r.xy*.5)/r.x*i,i+iTime/.1)*.2),sin(p.yzx*.8))*4.+p.z+vec4(0,1,2,3)),0.)/i*.7); 
}
