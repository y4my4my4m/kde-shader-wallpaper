// url: https://www.shadertoy.com/view/ttcfRH
// credits: Zi7ar21

// Something like the Night Sky by Zi7ar21 --- February 1st, 2020
// Updated February 1st, 17:15 Mountain Time

// If you didn't find this on Shadertoy, the original can be found at:
// https://www.shadertoy.com/view/ttcfRH

/*
This is a somewhat Night-Sky like scene. It is rendered in 2D, and is NOT physically accurate.
I didn't take into account proper gas colors, gas distribution, etc.
Also the stars have a Blackbody pallete but the probability of a random sampled star's
color and luminance is not based on something accurate like Hertzsprung-Russell.
*/

// Hashes https://www.shadertoy.com/view/4djSRW

float hash11(float p){
    p = fract(p*0.1031);
    p *= p+33.33;
    p *= p+p;
    return fract(p);
}

float hash12(vec2 pos){
	vec3 p3  = fract(vec3(pos.xyx)*0.1031);
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
}

float hash13(vec3 p3){
	p3 = fract(p3*0.1031);
    p3 += dot(p3, p3.zyx+31.32);
    return fract((p3.x+p3.y)*p3.z);
}

vec3 hash33(vec3 p3){
	p3 = fract(p3*vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy+p3.yxx)*p3.zyx);

}

float noise(vec2 n){
    vec4 b = vec4(floor(n), ceil(n)); 
    vec2 f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
	return mix(mix(hash12(b.xy), hash12(b.zy), f.x), mix(hash12(b.xw), hash12(b.zw), f.x), f.y);
}

// Atmospheric Distortion "Twinkling"
float noise(vec2 coord, float n){
    float componenta = hash13(vec3(coord, round(n-0.5)));
    float componentb = hash13(vec3(coord, round(n+0.5)));
    float componentc = mix(componenta, componentb, mod(n, 1.0));
    return componentc;
}

// FBM Terrain Line
float noise(float coord){
    float componenta = hash11(round(coord-0.5));
    float componentb = hash11(round(coord+0.5));
    return mix(componenta, componentb, mod(coord, 1.0));
}

// Color Offset, as Reccomended by user "elenzil"
// https://www.shadertoy.com/user/elenzil
vec3 colorednoise(vec2 coord, float n){
    vec3 componenta = hash33(vec3(coord, round(n-0.5)));
    vec3 componentb = hash33(vec3(coord, round(n+0.5)));
    vec3 componentc = mix(componenta, componentb, mod(n, 1.0));
    return componentc;
}

// FBM https://www.shadertoy.com/view/3dSBRh
#define octaves 8
float fbm(vec2 x){
	float v = 0.0;
	float a = 0.4;
	for (int i = 0; i < octaves; i++){
		v += a*noise(x);
		x = x*2.0;
		a *= 0.6;
	}
	return v;
}

float fbm(float x){
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < octaves; i++){
		v += a*noise(x);
		x = x*2.0;
		a *= 0.5;
	}
	return v;
}

// Blackbody Coloration (Made into a Function by LoicVDB)
// https://www.shadertoy.com/view/4tdGWM
vec3 blackbody(float temperature){
    vec3 O = vec3(0.0);
    for (float i = 0.0; i < 3.0; i += 0.1){
        float f = 1.0+0.5*i; 
        O[int(i)] += 10.0*(f*f*f)/(exp((19E3*f/temperature))-1.0);
    }
    return O;
}

// Stars
vec3 stars(vec2 coord){
    float luminance = max(0.0, (hash12(coord)-0.985));
    float temperature = (hash12(coord+iResolution.xy)*6000.0)+4000.0;
    vec3 colorshift = normalize(colorednoise(coord, float(iTime*16.0)));
    return (luminance*noise(coord, iTime*4.0))*blackbody(temperature)*4.0*(colorshift*0.5+1.0);
}

// Galaxy
float galaxygas(vec2 coord){
    return max(0.0, fbm((coord*4.0)+fbm(coord*4.0))-0.35);
}

float galaxydust(vec2 coord){
    return max(0.0, fbm((coord*2.0)+fbm(coord*2.0)+vec2(4.0, 4.0))-0.5);
}

// Nebula
float nebula(vec2 coord){
    float gas0 = max(0.0, fbm((coord*2.0)+fbm(coord*2.0)+vec2(4.0, 4.0))-length(coord));
    float gas1 = max(0.0, fbm((coord*4.0)+fbm(coord*2.0)+vec2(4.0, 4.0))-length(coord*1.01));
    return max(0.0, gas0-gas1);
}

// Main Image
void mainImage(out vec4 fragColor, vec2 fragCoord){
    vec2 uv = 2.0*(fragCoord.xy-0.5*iResolution.xy)/max(iResolution.x, iResolution.y);
    if(fbm((uv.x+4.0)*4.0) > (uv.y+0.5)*4.0){
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    vec3 star = stars(fragCoord);
    float gas = galaxygas(uv);
    vec3 dust = galaxydust(uv)*vec3(0.5, 0.4, 0.3);
    vec3 nebulae = nebula(uv)*vec3(0.6, 0.5, 0.75);
    vec3 color = star+mix(vec3(gas), dust*0.5, 0.75)+nebulae;
    fragColor = vec4(color, 1.0);
}
