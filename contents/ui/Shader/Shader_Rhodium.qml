import QtQuick 2.12
import QtQuick.Controls 2.12
Item {
    property string pixelShader: "// ***********************************************************
// Alcatraz / Rhodium 4k Intro liquid carbon
// by Jochen 'Virgill' Feldkötter
//
// 4kb executable: http://www.pouet.net/prod.php?which=68239
// Youtube: https://www.youtube.com/watch?v=YK7fbtQw3ZU
// ***********************************************************

#define time iTime
#define res iResolution

const float GA =2.399;
const mat2 rot = mat2(cos(GA),sin(GA),-sin(GA),cos(GA));

// 	simplyfied version of Dave Hoskins blur
vec3 dof(sampler2D tex,vec2 uv,float rad)
{
	vec3 acc=vec3(0);
    vec2 pixel=vec2(.002*res.y/res.x,.002),angle=vec2(0,rad);;
    rad=1.;
	for (int j=0;j<80;j++)
    {
        rad += 1./rad;
	    angle*=rot;
        vec4 col=texture(tex,uv+pixel*(rad-1.)*angle);
		acc+=col.xyz;
	}
	return acc/80.;
}

//-------------------------------------------------------------------------------------------
void mainImage(out vec4 fragColor,in vec2 fragCoord)
{
	vec2 uv = gl_FragCoord.xy / res.xy;
	fragColor=vec4(dof(iChannel0,uv,texture(iChannel0,uv).w),1.);
}"
}
