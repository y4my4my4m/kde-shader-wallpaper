// Author @patriciogv - 2015
// http://patriciogonzalezvivo.com
// From: https://www.shadertoy.com/view/MlfXzN
// Modified by: @y4my4my4m

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

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
	vec2 st = fragCoord.xy / iResolution.xy;
    st.y *= iResolution.y/iResolution.x;
	vec3 fontColorMixed;
    vec3 fontColor;
    vec3 bgColor = vec3(.1,.025,.075);
    fontColor = vec3(0.3,0.7,0.5);
    fontColor = mix(matrix(st) * fontColor, matrix(st) * fontColor, matrix(st) * fontColor);
	fragColor = vec4(fontColor + bgColor,.5);
}
