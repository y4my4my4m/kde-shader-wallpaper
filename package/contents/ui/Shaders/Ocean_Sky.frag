// url: https://www.shadertoy.com/view/MsfBW8
// credits: Ebanflo

//clouds
#define cloudIterations 4
#define cloudScale .1
#define cloudThickness .3
#define cloudSpeed .1
#define cloudDir vec2(.866, .5)
#define skyHeight 40.0
//waves
#define bigWaveDir vec2(.866, .5)
#define smallWaveDir vec2(.866, -.5)
#define bigWaveHeight 10.0
#define smallWaveHeight 5.0
#define bigWaveSpeed 1.0
#define smallWaveSpeed 2.0
#define bigWaveLength 5.0
#define smallWaveLength 5.0
//ripples
#define rippleHeight .5
#define rippleDensity 1.0
#define rippleFreq 3.0
//colors
#define skyColor vec3(.3, .8, 1)
#define cloudColor vec3(.7, .84, .84)
#define fogColor vec3(.74, .84, .94)
#define waterColor vec3(.05, .546, .85)
//util
#define pi 3.141592654
#define steps 20
#define heightThreshold .01
#define epsilon .01
#define stepsize .1
//misc
#define cameraHeight 25.0
#define light vec3(1)

vec3 r(vec3 v, vec2 r){//rodolphito's rotation
    vec4 t = sin(vec4(r, r + 1.5707963268));
    float g = dot(v.yz, t.yw);
    return vec3(v.x * t.z - g * t.x,
                v.y * t.w - v.z * t.y,
                v.x * t.x + g * t.z);
}

vec3 hash33(vec3 p3)//Dave_Hoskins https://www.shadertoy.com/view/4djSRW
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy + p3.yxx)*p3.zyx);

}

float hash13(vec3 p3)//Dave_Hoskins https://www.shadertoy.com/view/4djSRW
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float hashNoise(vec3 x)
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
	
    return mix(mix(mix(hash13(p+vec3(0,0,0)), 
                       hash13(p+vec3(1,0,0)),f.x),
                   mix(hash13(p+vec3(0,1,0)), 
                       hash13(p+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash13(p+vec3(0,0,1)), 
                       hash13(p+vec3(1,0,1)),f.x),
                   mix(hash13(p+vec3(0,1,1)), 
                       hash13(p+vec3(1,1,1)),f.x),f.y),f.z);
}

float ripples(vec2 x){
    vec3 p = vec3(x, rippleFreq * iTime);
    p *= rippleDensity;
    float d = 9e9;
    vec3 g = floor(p);
    for(int i = -1; i < 2; i++){
        for(int j = -1; j < 2; j++){
            for(int k = -1; k < 2; k++){
				vec3 g0 = g + vec3(i, j, k);
                vec3 v = p - g0 - hash33(g0);
            	d = min(d, dot(v, v));
            }
        }
    }
    return rippleHeight*d;
}
                
float heightMap(vec2 x){
    float result = -2.0 * (bigWaveHeight + smallWaveHeight + 2.0 * rippleHeight);
    result += bigWaveHeight * sin(dot(x, bigWaveDir) / bigWaveLength 
                                   + bigWaveSpeed * iTime);
    result += smallWaveHeight * sin(dot(x, smallWaveDir) / smallWaveLength
                                   + smallWaveSpeed * iTime);
    result += ripples(x);
	return result;
}

float hpotential(vec3 pos){return pos.y - heightMap(pos.xz);}

vec3 getNormal(vec3 pos){
    vec2 e = vec2(1.0, 0.0);
    return normalize(vec3(
        hpotential(pos + epsilon * e.xyy),
        hpotential(pos + epsilon * e.yxy),
        hpotential(pos + epsilon * e.yyx))
        - hpotential(pos));
}

float doSun(vec3 rd){
    float l = max(0.0, dot(rd, normalize(light)));
    l *= l;
    l *= l;
    l *= l;
    return l;
}

float doClouds(vec2 x){
    x *= cloudScale;
    x.x += 1000.0;
    x += cloudSpeed * iTime * cloudDir;
    float result = 0.0;
    float scale = .5;
    for(int n = 0; n < cloudIterations; n++){
        result += hashNoise(vec3(x, cloudSpeed * iTime) * scale) / scale;
        scale *= 2.0;
        
    }
    result *= .5;
    result = smoothstep(1.0 - cloudThickness, 1.0, result);
    return result;
}

vec3 doSky(vec3 rd, vec3 ro){
    vec2 skyPos = ro.xz + rd.xz * (skyHeight - ro.y) / rd.y;
    vec3 result = cloudColor;
    float sun = doSun(rd);
    float clouds = doClouds(skyPos);
    result += clouds;
    result = mix(result, skyColor, clouds);
    result += pow(vec3(.9, .4, .1), (.8 - vec3(sun * clouds)) * 20.0);
    return result;
}

vec3 render(vec3 rd, vec3 ro){
    if(rd.y < 0.0){
        float rdParam = rd.y + length(rd.xz);
        vec3 intrsect = ro + cameraHeight * rd / rd.y;
        float dist = length(intersect.xz);
        float d = distance(intersect, ro);
        vec3 pos = intersect;
        for(int n = 0; n < steps; n++){
        	pos = d * rd + ro;
        	float h = hpotential(pos);
        	if(h < heightThreshold) break;
        	else d += rdParam/h;
    	}
        vec3 n = getNormal(pos);
        pos.y += cameraHeight;
        vec3 refl = doSky(reflect(rd, n), pos);
        return refl * waterColor;
    }
    else return doSky(rd, ro);
}

void mainImage(out vec4 fragColor, vec2 fragCoord){
    fragColor = vec4(vec3(0.0), 1.0);
    vec2 xy = (2.0 * fragCoord - iResolution.xy ) / iResolution.y;
    vec3 ro = vec3(0.0, cameraHeight, 0.0);
	vec3 rd = normalize(vec3(xy, 2.5));
    vec2 m = 2.0 * (2.0 * iMouse.xy - iResolution.xy) / iResolution.y;
    if(iMouse.xy == vec2(0)) m = vec2(0);
    rd = r(rd, m);
    fragColor.xyz = mix(render(rd, ro), fogColor, max(0.0, 1.0 - abs(10.0 * rd.y)));
}e
