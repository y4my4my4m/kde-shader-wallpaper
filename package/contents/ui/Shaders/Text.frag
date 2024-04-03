// url: https://www.shadertoy.com/view/3dVfDz
// credits: leon

// HOW TO USE:
// apply: Font_Set.png to iChannel0
// repalce the `symbols[]` with the text you want


#define repeat(p,r) (mod(p,r)-r/2.)
mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// from
// https://www.shadertoy.com/view/ld2yDG
#define grid 16.
#define cell 1./16.
const int kA=177,kB=178,kC=179,kD=180,kE=181,kF=182,kG=183,kH=184,kI=185,kJ=186,kK=187;
const int kL=188,kM=189,kN=190,kO=191,kP=160,kQ=161,kR=162,kS=163,kT=164,kU=165,kV=166;
const int kW=167,kX=168,kY=169,kZ=170,kSpace=80;

vec2 getSymbol (int key)
{
	return vec2(mod(float(key),grid),floor(float(key)/grid));
}

vec2 getLetterUV (vec2 target, vec2 offset)
{
    vec2 uvLetter = target;
    uvLetter.x = uvLetter.x;
    uvLetter += offset / grid;
    float crop = step(target.x, cell) * step(target.y, cell);
    crop *= step(0., target.x) * step(0., target.y);
    return uvLetter * crop;
}

vec2 getUVText (vec2 target)
{
    int symbols[] = int[] ( kK, kD, kE);
    int count = symbols.length();
    vec2 space = vec2(0.5,1);
    vec2 textUV = vec2(0);
    for (int i = 0; i < count; ++i) {
        vec2 offset = vec2(i,0)/grid;
        offset.x -= float(count)/grid/2.;
        offset.y -= cell/2.;
    	textUV += getLetterUV(target - offset, getSymbol(symbols[i]));
    }
    return textUV;
}

void mainImage( out vec4 color, in vec2 pixel )
{
    vec2 p = (pixel-0.5*iResolution.xy)/iResolution.y;
    const int count = 8;
    float falloff = 1.0;
    float stroke = 0.0;
    for (int index = 0; index < count; ++index)
    {
        float i = float(count-index)/float(count);
        p.xy = abs(p.xy)-0.2*falloff;
        p *= rot(.5*iTime);
        vec4 font = texture(iChannel0, getUVText(p/falloff));
        stroke += i*smoothstep(0.02, 0.0, max(0., font.a-0.47));
        falloff /= 1.1;
    }

    color = vec4(stroke);
}
