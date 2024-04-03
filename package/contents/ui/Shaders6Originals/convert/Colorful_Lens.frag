// url: https://www.shadertoy.com/view/tdGfz1
// credits: leon

//
// Shader coded for the Cookie Collective live coding stream
// https://cookie.paris/
// https://www.twitch.tv/cookiedemoparty
// 
// Leon Denise 2020.11.28
// Licensed under hippie love conspiracy
//

// constants
const float PI = 3.1415;
const float TAU = 6.283;

// rotation matrix
mat2 rotation(float a)
{
    float c = cos(a), s = sin(a);
    return mat2(c,-s,s,c);
}

// color palette by Inigo Quilez
// https://iquilezles.org/articles/palettes
vec3 palette(float t)
{
    return vec3(0.5)+vec3(0.5)*cos(vec3(1,2,3)*t);
}

void mainImage(out vec4 color, in vec2 coordinate)
{
    vec2 p = (coordinate-0.5*iResolution.xy)/iResolution.y;
    
    // space distortion
    p = normalize(p) * sin(pow(length(p), 0.5)*PI - iTime * 0.3);
    
    vec2 origin = p;
    vec3 tint = vec3(0);
	
    // background disks
    const int disks = 10;
    float falloff = 1.0;
    for (int i = 0; i < disks; ++i)
    {
        float ratio = float(i)/float(disks-1);
        
        // rotation
        p *= rotation(sin(iTime * 0.1) * 0.1 / falloff + 0.1 * iTime / falloff);
        
        // fold
        p.x = abs(p.x)-0.3*falloff;
        
        // shape
        float shape = min(1., 0.001 / max(0., length(p)-0.05));
        
        // color
        tint += palette(ratio * 2. + p.y*8.) * shape;
        
        // falloff iteration
        falloff /= 1.1;
    }
    
    // animated dots
    const int dots = 100;
    for (int i = 0; i < dots; ++i)
    {
        float ratio = float(i)/float(dots);
        float timeline = fract(ratio * 135.1654 + iTime * 0.5);
        float angle = TAU * ratio * 15.547 + iTime * 0.1;
        float radius = (0.5 + 0.5 * abs(sin(float(i)*1654.))) * timeline * 2.;
        
        // reset transform
        p = origin;
        
        // translate
        p += vec2(cos(angle),sin(angle)) * radius;
		
        // shape
        float shape = min(1., 0.0005 / max(0., length(p)-0.02));
        
        // color
        tint += palette(angle*0.1 + length(origin)*2.) * shape;
    }

    color = vec4(tint,1);
}
