// URL: https://www.shadertoy.com/view/sdsXD2
// By: ninjapretzel

precision mediump float;
#define PI 3.14159265359

float _seed;
float _scale;
float _persistence;

//1d Hash
float hash(float n) { return fract(sin(n)*_seed); }
//3d hash (uses 1d hash at prime scale offsets for y/z)
float hash3(vec3 v) { return hash(v.x + v.y * 113.0 + v.z * 157.0); }
//Quick 3d smooth noise
float noise(vec3 x) {
	vec3 p = floor(x);
	vec3 f = fract(x);
	f       = f*f*(3.0-2.0*f);
	float n = p.x + p.y*157.0 + 113.0*p.z;
	return mix(mix(	mix( hash(n+0.0), hash(n+1.0),f.x),
			mix( hash(n+157.0), hash(n+158.0),f.x),f.y),
		   mix(	mix( hash(n+113.0), hash(n+114.0),f.x),
			mix( hash(n+270.0), hash(n+271.0),f.x),f.y),f.z);
}

float nnoise(vec3 pos, float factor) {	
	float total = 0.0
		, frequency = _scale
		, amplitude = 1.0
		, maxAmplitude = 0.0;
	
	//Accumulation
	for (int i = 0; i < 6; i++) {
		total += noise(pos * frequency) * amplitude;
		frequency *= 2.0, maxAmplitude += amplitude;
		amplitude *= _persistence;
	}
	
	//Normalization
	float avg = maxAmplitude * .5;
	if (factor != 0.0) {
		float range = avg * clamp(factor, 0.0, 1.0);
		float mmin = avg - range;
		float mmax = avg + range;
		
		float val = clamp(total, mmin, mmax);
		return val = (val - mmin) / (mmax - mmin);
	} 
	
	if (total > avg) { return 1.0; }
	return 0.0;
}
//Default normalization factor of .5
//This maps the range (.25,.75) to (0, 1)
float nnoise(vec3 pos) { return nnoise(pos, .5); }

float saturate(float v) { return clamp(v, 0., 1.); }
#define ADD 1
#define IGNORE 2
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    float time = iTime;
    vec2 uv = fragCoord/iResolution.xy;
    uv.y -= .9;
    //uv.y *= .50;
    uv.x -= .5;
    uv.x *= .10;
    
    
    float rate = 1.1;
    float scale = 10.1;
    
	_seed = 1333.0;
	_scale = 2.0;
	_persistence = .95;
    
    float dscale = 1.90;
    
	float amp = 1.60 + .20 * nnoise(vec3(time*rate + uv.x*scale, time*.05, 0));
	int num = 9;
	vec4 cc = vec4(0,0,0,1);
    float occ = 0.0; // near occludes far
	for (int i = 0; i < num; i++) {
		
        vec2 pos = uv;
		pos *= 5.0;
        pos.y /= amp * 3.0;
        pos.y += float(num-i) * .05;
		pos.x *= .10 * dscale;
		pos.x -= 35.0;
		
	    // wire position 
		float v = noise(vec3(time*rate + pos.x * scale, pos.x * .05, 0.0)) - .5;
        
        _seed = 1337.0;
        _scale = .65;
        _persistence = .8 ;
        v *= 3.0 * nnoise(vec3(time*rate + pos.x * scale, 0.0, 0.0)) - .5;
        
        float off = pos.y - v;
        if (i == 0) { occ = off; }
        
        // Occlusion is incorrect, but the artifacts kinda look cool.
        int mode = ADD;
        if (off > occ) { mode = IGNORE; }
        else { occ = off; }

        float d = length(pos.y - v);

        //d *= (16.0 + 14.50 * sin(-2. * time + float(i)/9.0*2.0*PI));
        float elec = nnoise(vec3(time * -6. + pos.x * 16.50, .01 * pos.x, 1.0));
        d *= .1 + 20.0 * elec * elec;

        float r = .04 + .05 * sin(time + 2.0 * PI * ((float(i)+0.0)/9.0));
        float g = .04 + .05 * sin(time + 2.0 * PI * ((float(i)+3.0)/9.0));
        float b = .04 + .05 * sin(time + 2.0 * PI * ((float(i)+6.0)/9.0));
        r = saturate(r); g = saturate(g); b = saturate(b);
        if (mode == ADD) {
            cc.r += r/d;
            cc.g += g/d;
            cc.b += b/d;
        }
        
		dscale *= 1.75;
		
		amp *= .62;
	}
	vec4 c = cc;//vec4(r/d, g/d, b/d, 1);
	fragColor = c;
}

